export const BALANCE = Object.freeze({
  xpThresholds: [0, 120, 280],
  weapons: [
    { name: 'R-1', rate: 4.8, damage: 1.0, shots: 1, spread: 0 },
    { name: 'R-2', rate: 6.2, damage: 1.15, shots: 1, spread: 0 },
    { name: 'R-3', rate: 7.2, damage: 1.2, shots: 3, spread: 0.12 }
  ],
  enemy: {
    grunt: { hp: 2, xp: 22, score: 120, cadence: 1.55, bulletSpeed: 7.2 },
    turret: { hp: 5, xp: 42, score: 260, cadence: 1.15, bulletSpeed: 8.1 },
    drone: { hp: 3, xp: 35, score: 210, cadence: 1.35, bulletSpeed: 7.6 },
    boss: { hp: 30, xp: 260, score: 2200, cadence: 0.85, bulletSpeed: 9.0 }
  },
  player: { maxHealth: 5, speed: 6.3, jump: 8.7, gravity: 23, grenades: 3 },
  grenade: { damage: 8, radius: 4.5, cooldown: 0.55 }
});

export async function startGame({ THREE, renderer, backendName, modern, pass, bloom }) {
  const $ = (id) => document.getElementById(id);
  const host = $('gameHost');
  const hud = $('hud');
  const touchControls = $('touchControls');
  const pauseButton = $('pauseButton');
  const soundButton = $('soundButton');
  const pauseScreen = $('pauseScreen');
  const completeScreen = $('completeScreen');
  const toastEl = $('toast');
  const damageFlash = $('damageFlash');
  const healthText = $('healthText');
  const healthBar = $('healthBar');
  const armorText = $('armorText');
  const xpBar = $('xpBar');
  const levelText = $('levelText');
  const scoreText = $('scoreText');
  const grenadeText = $('grenadeText');
  const objectiveEl = $('objective');
  const backendBadge = $('backendBadge');
  const missionStats = $('missionStats');
  const letterboxTop = $('letterboxTop');
  const letterboxBottom = $('letterboxBottom');

  const coarsePointer = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const basePixelRatio = Math.min(devicePixelRatio || 1, coarsePointer ? 1.5 : 2.0);
  let resolutionScale = 1;

  renderer.setPixelRatio(basePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  if ('type' in renderer.shadowMap && THREE.PCFSoftShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('toneMapping' in renderer && THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.05;
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D game view');
  renderer.domElement.style.touchAction = 'none';
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07150f);
  scene.fog = new THREE.FogExp2(0x07150f, 0.027);

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 220);
  camera.position.set(8, 6.2, 12);

  const hemi = new THREE.HemisphereLight(0x8bd6a1, 0x142213, modern ? 1.55 : 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c2, modern ? 3.4 : 2.3);
  sun.position.set(18, 28, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarsePointer ? 1024 : 2048, coarsePointer ? 1024 : 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x4d8d72, 0.65);
  fill.position.set(-12, 9, -10);
  scene.add(fill);

  const materials = {
    ground: mat(0x2e6a32, 0.98),
    ground2: mat(0x3e7b38, 1),
    mud: mat(0x4c5330, 1),
    stone: mat(0x647061, 1),
    darkStone: mat(0x394039, 1),
    wood: mat(0x6f4d2c, 1),
    metal: mat(0x4f6258, 0.62, 0.35),
    darkMetal: mat(0x202d27, 0.55, 0.48),
    leaf: mat(0x3d8f39, 1),
    leaf2: mat(0x72aa36, 1),
    bark: mat(0x664124, 1),
    player: mat(0xb7e63f, 0.78),
    playerDark: mat(0x253b20, 0.9),
    skin: mat(0xe5ac73, 0.9),
    enemy: mat(0xd9573d, 0.8),
    enemyDark: mat(0x42251f, 0.85),
    turret: mat(0x7b8a71, 0.7, 0.22),
    warning: emissiveMat(0xff4e2c, 0x7a1000, 2.0),
    bullet: emissiveMat(0xffe66d, 0xd87a00, 3.2),
    enemyBullet: emissiveMat(0xff553f, 0x7f0800, 3.2),
    xp: emissiveMat(0xbaff38, 0x316800, 1.5),
    water: transparentMat(0x246c66, 0.54, 0.35),
    glass: transparentMat(0x7ae6b4, 0.36, 0.2),
    white: mat(0xdde6d5, 0.85),
    black: mat(0x101612, 0.9)
  };

  function mat(color, roughness = 0.9, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  }
  function emissiveMat(color, emissive, intensity = 1) {
    return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.45, metalness: 0.08, flatShading: true });
  }
  function transparentMat(color, opacity, roughness = 0.7) {
    return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness, metalness: 0.05, depthWrite: false, flatShading: true });
  }
  function mesh(geometry, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    scene.add(m);
    return m;
  }
  function box(x, y, z, w, h, d, material, cast = true, receive = true) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, cast, receive);
  }

  const state = {
    running: false,
    paused: false,
    complete: false,
    startedAt: 0,
    pauseStartedAt: 0,
    pausedTotal: 0,
    elapsed: 0,
    kills: 0,
    shots: 0,
    hits: 0,
    score: 0,
    xp: 0,
    level: 1,
    health: BALANCE.player.maxHealth,
    armor: 0,
    grenades: BALANCE.player.grenades,
    objectiveStage: 0,
    checkpoint: { x: 2, z: 0 },
    bossTriggered: false,
    bossDead: false,
    zoom: 1,
    cameraShake: 0,
    toastTimer: 0,
    sound: true
  };

  const input = { mx: 0, mz: 0, fire: false, jumpQueued: false, grenadeQueued: false, keys: new Set() };
  const enemies = [];
  const playerBullets = [];
  const enemyBullets = [];
  const grenades = [];
  const effects = [];
  const pickups = [];
  const obstacles = [];
  const beacons = [];
  let gateDoor = null;
  let gateBarrier = null;
  let boss = null;
  let postPipeline = null;
  let renderFrame = () => renderer.render(scene, camera);
  let audio = null;
  let audioNoise = null;

  buildWorld();
  const player = buildPlayer();
  spawnMission();
  setupPostProcessing();
  setupInput();
  updateHud();
  backendBadge.textContent = backendName;

  function setupPostProcessing() {
    if (!modern || !pass || !bloom || !THREE.RenderPipeline) return;
    try {
      postPipeline = new THREE.RenderPipeline(renderer);
      const scenePass = pass(scene, camera);
      const sceneColor = scenePass.getTextureNode('output');
      const glow = bloom(sceneColor, coarsePointer ? 0.38 : 0.55, 0.16, 0.72);
      postPipeline.outputNode = sceneColor.add(glow);
      renderFrame = () => postPipeline.render();
    } catch (error) {
      console.warn('Post-processing disabled:', error);
      postPipeline = null;
      renderFrame = () => renderer.render(scene, camera);
    }
  }

  function buildWorld() {
    // Layered jungle floor.
    for (let x = -4; x <= 120; x += 8) {
      const g = box(x, -0.45, 0, 8.2, 0.9, 7.7, ((x / 8) & 1) ? materials.ground : materials.ground2, false, true);
      g.rotation.y = ((x / 8) & 1) ? 0.015 : -0.015;
    }

    // Creek gives the center of the level a visual break without forcing precision jumps.
    box(62, 0.035, 0, 15, 0.09, 7.2, materials.water, false, true);
    for (let i = 0; i < 8; i++) {
      const r = box(56 + i * 2.1, 0.16 + (i % 2) * 0.05, (i % 3 - 1) * 1.35, 1.1, 0.32, 0.9, materials.stone, false, true);
      r.rotation.y = i * 0.63;
    }

    // Upper-route staircase and bridge.
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const x = 30.2 + i * 0.43;
      const h = (i + 1) * (3 / steps);
      box(x, h * 0.5, -2.05, 0.48, h, 2.25, materials.wood, true, true);
    }
    box(45.8, 2.78, -2.05, 23.6, 0.45, 2.35, materials.wood, true, true);
    for (let x = 34.5; x <= 57.5; x += 2.3) {
      box(x, 3.72, -2.95, 0.18, 1.45, 0.18, materials.metal, true, true);
      box(x, 3.72, -1.15, 0.18, 1.45, 0.18, materials.metal, true, true);
      box(x, 4.34, -3.0, 2.2, 0.16, 0.16, materials.metal, false, true);
      box(x, 4.34, -1.1, 2.2, 0.16, 0.16, materials.metal, false, true);
      box(x, 3.72, -3.0, 2.2, 0.12, 0.12, materials.metal, false, true);
      box(x, 3.72, -1.1, 2.2, 0.12, 0.12, materials.metal, false, true);
    }
    for (let i = 0; i < steps; i++) {
      const x = 54.1 + i * 0.43;
      const h = 3 - i * (3 / steps);
      box(x, Math.max(0.17, h * 0.5), -2.05, 0.48, Math.max(0.34, h), 2.25, materials.wood, true, true);
    }

    // Outposts and cover.
    buildOutpost(20, 1.7, false);
    buildOutpost(72, -1.5, true);
    buildBunker(101);

    // Directional signs.
    makeSign('UPPER ROUTE', 27.5, 1.1, -1.9, -0.08);
    makeSign('CREEK // 40m', 50, 1.1, 2.35, 0.03);
    makeSign('BUNKER', 83, 1.1, -2.3, 0.06);
    makeSign('EXFIL', 108, 1.1, 2.25, -0.04);

    // Checkpoint beacons and extraction pad.
    makeBeacon(42, 2.25, 2.25);
    makeBeacon(76, 2.25, 2.25);
    makeBeacon(90, 2.25, 2.25);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.16, 12), materials.metal);
    pad.position.set(113, 0.05, 0);
    pad.receiveShadow = true;
    scene.add(pad);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), materials.xp);
      lamp.position.set(113 + Math.cos(a) * 2.45, 0.22, Math.sin(a) * 2.45);
      scene.add(lamp);
    }

    // Dense, low-poly vegetation through instancing.
    const rand = mulberry32(17031);
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.2, 1.8, 6);
    const crownGeo = new THREE.ConeGeometry(0.85, 2.4, 6);
    const treeCount = 72;
    const trunks = new THREE.InstancedMesh(trunkGeo, materials.bark, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, materials.leaf, treeCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const x = -2 + rand() * 122;
      const side = rand() > 0.5 ? 1 : -1;
      const z = side * (4.2 + rand() * 7.5);
      const s = 0.75 + rand() * 1.35;
      dummy.position.set(x, 0.9 * s, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 2.55 * s;
      dummy.rotation.y += rand();
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.castShadow = false; crowns.castShadow = false;
    trunks.receiveShadow = true; crowns.receiveShadow = true;
    scene.add(trunks, crowns);

    // Background polygon hills.
    for (let i = 0; i < 22; i++) {
      const x = i * 6 - 6;
      const z = -12 - (i % 3) * 2.4;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 4), 10 + (i % 3) * 2, 5), i % 2 ? materials.darkStone : materials.leaf);
      hill.position.set(x, 4.2, z);
      hill.rotation.y = i * 0.31;
      hill.castShadow = false;
      hill.receiveShadow = false;
      scene.add(hill);
    }
  }

  function buildOutpost(x, z, elevated) {
    const y = elevated ? 0.15 : 0.15;
    for (const side of [-1, 1]) {
      box(x, y + 0.55, z + side * 1.28, 4.2, 1.1, 0.92, materials.darkStone, true, true);
      box(x, y + 1.35, z + side * 1.28, 3.0, 0.5, 0.78, materials.metal, true, true);
    }
    box(x, y + 1.72, z, 4.2, 0.26, 0.36, materials.metal, true, true);
    box(x - 1.35, y + 2.0, z - 1.05, 0.18, 1.6, 0.18, materials.warning, false, false);
    box(x + 1.35, y + 2.0, z + 1.05, 0.18, 1.6, 0.18, materials.warning, false, false);
    addObstacle(x - 2.1, x + 2.1, z - 1.78, z - 0.83);
    addObstacle(x - 2.1, x + 2.1, z + 0.83, z + 1.78);
  }

  function buildBunker(x) {
    box(x + 1.8, 2.15, -3.15, 5.0, 4.3, 1.1, materials.darkStone, true, true);
    box(x + 1.8, 2.15, 3.15, 5.0, 4.3, 1.1, materials.darkStone, true, true);
    box(x + 2.2, 4.4, 0, 5.8, 1.0, 7.2, materials.darkStone, true, true);
    gateDoor = box(x, 1.75, 0, 0.75, 3.5, 5.0, materials.darkMetal, true, true);
    gateBarrier = addObstacle(x - 0.45, x + 0.45, -3.05, 3.05);
    for (let y = 0.5; y <= 3.0; y += 0.65) {
      const strip = box(x - 0.42, y, 0, 0.08, 0.1, 4.4, materials.warning, false, false);
      strip.rotation.x = 0.06;
    }
  }

  function addObstacle(x1, x2, z1, z2) {
    const o = { x1, x2, z1, z2, active: true };
    obstacles.push(o);
    return o;
  }

  function makeSign(text, x, y, z, rotY) {
    const post = box(x, y * 0.52, z, 0.12, y, 0.12, materials.wood, true, true);
    post.rotation.y = rotY;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1b2d18'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#baff38'; ctx.lineWidth = 8; ctx.strokeRect(7, 7, c.width - 14, c.height - 14);
    ctx.fillStyle = '#efffd9'; ctx.font = '900 46px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex && THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.58), signMat);
    sign.position.set(x, y + 0.42, z);
    sign.rotation.y = rotY;
    scene.add(sign);
  }

  function makeBeacon(x, y, z) {
    const pole = box(x, y * 0.5, z, 0.12, y, 0.12, materials.metal, true, true);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), materials.xp);
    orb.position.set(x, y + 0.12, z);
    scene.add(orb);
    beacons.push({ x, orb, activated: false });
    return pole;
  }

  function buildPlayer() {
    const group = new THREE.Group();
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.48), materials.playerDark);
    hips.position.y = 0.88;
    group.add(hips);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.82, 0.54), materials.player);
    torso.position.y = 1.42;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6), materials.skin);
    head.position.y = 2.03;
    head.castShadow = true;
    group.add(head);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.6), materials.warning);
    band.position.y = 2.04; group.add(band);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.25), materials.playerDark);
    const rightLeg = leftLeg.clone();
    leftLeg.position.set(-0.2, 0.42, -0.13); rightLeg.position.set(0.2, 0.42, 0.13);
    group.add(leftLeg, rightLeg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.18), materials.skin);
    arm.position.set(0.44, 1.45, 0.22); arm.rotation.z = -0.16; group.add(arm);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.18), materials.darkMetal);
    gun.position.set(0.78, 1.55, 0.05); group.add(gun);
    const muzzle = new THREE.Object3D(); muzzle.position.set(1.22, 1.55, 0.05); group.add(muzzle);
    group.position.set(2, 0, 0);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(group);
    return {
      group, leftLeg, rightLeg, muzzle,
      x: 2, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      facing: 1, onGround: true, onUpper: false,
      fireCooldown: 0, grenadeCooldown: 0, invuln: 0, runTime: 0
    };
  }

  function spawnMission() {
    const list = [
      ['grunt', 12, 0, 0], ['grunt', 17, 0, -1.5], ['turret', 25, 0, 1.6],
      ['grunt', 37, 3, -2.0], ['grunt', 43, 0, 1.5], ['drone', 50, 3.2, 0.2],
      ['grunt', 61, 0, -1.8], ['grunt', 66, 0, 1.4], ['turret', 72, 0, -1.5],
      ['drone', 79, 3.1, 0], ['grunt', 82, 0, 1.7], ['grunt', 87, 0, -1.3],
      ['turret', 92, 0, 1.4], ['grunt', 95, 0, -1.6], ['boss', 99.7, 1.55, 0]
    ];
    for (const [type, x, y, z] of list) spawnEnemy(type, x, y, z);
    addPickup('weapon', 38.5, 3.35, -2.0);
    addPickup('armor', 47, 0.55, 1.7);
    addPickup('health', 69, 0.55, -1.8);
    addPickup('grenade', 84, 0.55, 1.5);
  }

  function spawnEnemy(type, x, y, z) {
    const cfg = BALANCE.enemy[type];
    const group = new THREE.Group();
    let radius = 0.65;
    if (type === 'grunt') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.56), materials.enemy);
      body.position.y = 1.18; group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 5), materials.skin);
      head.position.y = 1.79; group.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.42), materials.enemyDark);
      legs.position.y = 0.45; group.add(legs);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.15, 0.16), materials.darkMetal);
      gun.position.set(-0.62, 1.25, 0); group.add(gun);
    } else if (type === 'turret') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.55, 8), materials.turret);
      base.position.y = 0.28; group.add(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.8), materials.darkMetal);
      top.position.y = 0.78; group.add(top);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.16), materials.turret);
      barrel.position.set(-0.72, 0.86, 0); group.add(barrel);
      radius = 0.82;
    } else if (type === 'drone') {
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), materials.enemy);
      group.add(core);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.42), materials.darkMetal);
      group.add(wing);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), materials.warning);
      eye.position.set(-0.48, -0.05, 0); group.add(eye);
      radius = 0.7;
    } else {
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(1.18, 0), materials.darkMetal);
      group.add(shell);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.63, 1), materials.warning);
      core.position.x = -0.55; group.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 6, 18), materials.turret);
      ring.rotation.y = Math.PI / 2; group.add(ring);
      radius = 1.45;
      boss = { core, ring };
    }
    group.position.set(x, y, z);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(group);
    const enemy = { type, group, x, y, z, hp: cfg.hp, maxHp: cfg.hp, radius, cooldown: 0.3 + Math.random() * 0.8, dead: false, hurt: 0, phase: Math.random() * 6.28, cfg };
    enemies.push(enemy);
    if (type === 'boss') boss = { ...boss, enemy };
    return enemy;
  }

  function addPickup(type, x, y, z) {
    const colorMat = type === 'weapon' ? materials.xp : type === 'armor' ? materials.glass : type === 'health' ? materials.warning : materials.bullet;
    const group = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.85), materials.darkMetal);
    crate.rotation.y = Math.PI / 4; group.add(crate);
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), colorMat);
    mark.position.y = 0.58; group.add(mark);
    group.position.set(x, y, z);
    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(group);
    pickups.push({ type, group, x, y, z, picked: false, phase: Math.random() * 6.28 });
  }

  function start() {
    state.running = true;
    state.startedAt = performance.now();
    hud.classList.remove('hidden');
    pauseButton.classList.remove('hidden');
    soundButton.classList.remove('hidden');
    if (coarsePointer) touchControls.classList.remove('hidden');
    showToast('MOVE RIGHT // BREAK THE LINE', 2.3);
    renderer.domElement.focus({ preventScroll: true });
    if (renderer.setAnimationLoop) renderer.setAnimationLoop(frame);
    else requestAnimationFrame(frame);
  }

  let lastTime = performance.now();
  let qualityTimer = 0;
  const frameSamples = [];
  function frame(now = performance.now()) {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (state.running && !state.paused && !state.complete) {
      const dt = rawDt;
      state.elapsed = (now - state.startedAt - state.pausedTotal) / 1000;
      update(dt, now / 1000);
      qualityTimer += dt;
      frameSamples.push(rawDt * 1000);
      if (frameSamples.length > 120) frameSamples.shift();
      if (qualityTimer > 3 && modern) { qualityTimer = 0; adaptResolution(); }
    } else if (state.complete) {
      updateEffects(rawDt);
      updateCamera(rawDt);
    }
    renderFrame();
    if (!renderer.setAnimationLoop) requestAnimationFrame(frame);
  }

  function update(dt, time) {
    updateInputFromKeys();
    updatePlayer(dt, time);
    updateEnemies(dt, time);
    updateProjectiles(dt);
    updateGrenades(dt);
    updatePickups(dt, time);
    updateEffects(dt);
    updateObjectives();
    updateCamera(dt);
    updateWorldAnimation(dt, time);
    updateHud();
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) toastEl.classList.add('hidden');
    }
  }

  function updateInputFromKeys() {
    let x = 0, z = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) z -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) z += 1;
    if (Math.abs(x) + Math.abs(z) > 0) { input.mx = x; input.mz = z; }
    else if (!joystickActive) { input.mx = 0; input.mz = 0; }
    input.fire = input.fire || input.keys.has('KeyJ');
  }

  function updatePlayer(dt, time) {
    player.invuln = Math.max(0, player.invuln - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
    let mx = input.mx, mz = input.mz;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) { mx /= mlen; mz /= mlen; }
    const speed = BALANCE.player.speed * (isCreek(player.x) && !player.onUpper ? 0.83 : 1);
    player.vx = approach(player.vx, mx * speed, dt * 34);
    player.vz = approach(player.vz, mz * speed * 0.7, dt * 28);
    if (Math.abs(mx) > 0.08) player.facing = Math.sign(mx);

    if (input.jumpQueued && player.onGround) {
      player.vy = BALANCE.player.jump;
      player.onGround = false;
      playTone(260, 0.05, 'square', 0.035);
    }
    input.jumpQueued = false;

    player.vy -= BALANCE.player.gravity * dt;
    let nx = clamp(player.x + player.vx * dt, 0.4, 116.2);
    let nz = clamp(player.z + player.vz * dt, -3.15, 3.15);
    ({ x: nx, z: nz } = resolveObstacles(nx, nz, player.x, player.z));
    player.x = nx; player.z = nz;
    player.y += player.vy * dt;

    const floor = floorHeight(player.x, player.z, player.y, player.onUpper);
    if (player.vy <= 0 && player.y <= floor + 0.04) {
      player.y = floor;
      player.vy = 0;
      player.onGround = true;
    } else if (player.y > floor + 0.06) player.onGround = false;
    player.onUpper = player.y > 1.25 && player.x > 29.5 && player.x < 58.5 && player.z < -0.65;

    if (input.fire && player.fireCooldown <= 0) firePlayerWeapon();
    if (input.grenadeQueued && player.grenadeCooldown <= 0 && state.grenades > 0) throwGrenade();
    input.grenadeQueued = false;

    player.group.position.set(player.x, player.y, player.z);
    player.group.scale.x = player.facing;
    const moveMag = Math.hypot(player.vx, player.vz);
    player.runTime += dt * moveMag * 1.25;
    const stride = Math.sin(player.runTime * 2.4) * Math.min(0.55, moveMag * 0.09);
    player.leftLeg.rotation.z = stride;
    player.rightLeg.rotation.z = -stride;
    player.group.rotation.z = player.onGround ? -player.vx * 0.008 : clamp(-player.vy * 0.018, -0.18, 0.18);
    player.group.visible = player.invuln <= 0 || Math.floor(time * 18) % 2 === 0;
  }

  function firePlayerWeapon() {
    const weapon = BALANCE.weapons[state.level - 1];
    player.fireCooldown = 1 / weapon.rate;
    state.shots += weapon.shots;
    const target = selectAimTarget();
    const origin = new THREE.Vector3(player.x + player.facing * 1.05, player.y + 1.5, player.z + 0.02);
    let baseDir;
    if (target) {
      baseDir = new THREE.Vector3(target.x - origin.x, target.y + (target.type === 'boss' ? 0 : 1.0) - origin.y, target.z - origin.z).normalize();
      if (baseDir.x * player.facing < -0.05) baseDir.x = player.facing * Math.abs(baseDir.x);
    } else baseDir = new THREE.Vector3(player.facing, 0, 0);
    const spreadList = weapon.shots === 3 ? [-weapon.spread, 0, weapon.spread] : [0];
    for (const s of spreadList) {
      const dir = baseDir.clone();
      dir.y += s;
      dir.z += s * 0.38;
      dir.normalize();
      spawnBullet(origin, dir, true, weapon.damage);
    }
    playTone(720 + state.level * 90, 0.028, 'square', 0.028);
  }

  function selectAimTarget() {
    let best = null, bestScore = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.type === 'boss' && !state.bossTriggered) continue;
      const dx = e.x - player.x, dz = e.z - player.z, dy = e.y - player.y;
      if (dx * player.facing < -0.8) continue;
      const d = Math.hypot(dx, dz, dy * 0.4);
      if (d > 19) continue;
      const score = d + Math.abs(dz) * 0.7;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function spawnBullet(origin, dir, friendly, damage = 1, speedOverride = null) {
    const material = friendly ? materials.bullet : materials.enemyBullet;
    const bmesh = new THREE.Mesh(new THREE.BoxGeometry(friendly ? 0.26 : 0.22, 0.1, 0.1), material);
    bmesh.position.copy(origin);
    bmesh.castShadow = false;
    scene.add(bmesh);
    const speed = speedOverride || (friendly ? 19.5 : 8.0);
    const b = { mesh: bmesh, x: origin.x, y: origin.y, z: origin.z, vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed, age: 0, damage };
    (friendly ? playerBullets : enemyBullets).push(b);
  }

  function updateProjectiles(dt) {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.mesh.position.set(b.x, b.y, b.z);
      let hit = false;
      for (const e of enemies) {
        if (e.dead || (e.type === 'boss' && !state.bossTriggered)) continue;
        const ey = e.y + (e.type === 'drone' ? 0 : e.type === 'boss' ? 0 : 0.85);
        if (distSq(b.x, b.y, b.z, e.x, ey, e.z) < (e.radius + 0.18) ** 2) {
          damageEnemy(e, b.damage); state.hits++; hit = true; break;
        }
      }
      if (hit || b.age > 1.55 || b.x > 121 || b.x < -3 || Math.abs(b.z) > 8) removeProjectile(playerBullets, i);
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.mesh.position.set(b.x, b.y, b.z);
      if (player.invuln <= 0 && distSq(b.x, b.y, b.z, player.x, player.y + 1.05, player.z) < 0.62 ** 2) {
        hurtPlayer(1); removeProjectile(enemyBullets, i); continue;
      }
      if (b.age > 3.2 || b.x > 121 || b.x < -3 || Math.abs(b.z) > 9) removeProjectile(enemyBullets, i);
    }
  }

  function removeProjectile(list, i) {
    scene.remove(list[i].mesh);
    list[i].mesh.geometry.dispose?.();
    list.splice(i, 1);
  }

  function throwGrenade() {
    state.grenades--;
    player.grenadeCooldown = BALANCE.grenade.cooldown;
    const gm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 0), materials.xp);
    gm.position.set(player.x + player.facing * 0.7, player.y + 1.35, player.z);
    gm.castShadow = true; scene.add(gm);
    grenades.push({ mesh: gm, x: gm.position.x, y: gm.position.y, z: gm.position.z, vx: player.facing * 7.5 + player.vx * 0.3, vy: 6.8, vz: input.mz * 2.2, age: 0, fuse: 0.86 });
    playTone(170, 0.08, 'triangle', 0.03);
  }

  function updateGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.age += dt; g.vy -= 18 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      const fl = floorHeight(g.x, g.z, g.y, false) + 0.16;
      if (g.y < fl) { g.y = fl; g.vy = Math.abs(g.vy) * 0.35; g.vx *= 0.8; g.vz *= 0.8; }
      g.mesh.position.set(g.x, g.y, g.z); g.mesh.rotation.x += dt * 6; g.mesh.rotation.z += dt * 4;
      if (g.age >= g.fuse) { explodeGrenade(g); scene.remove(g.mesh); grenades.splice(i, 1); }
    }
  }

  function explodeGrenade(g) {
    spawnExplosion(g.x, g.y, g.z, 1.0);
    for (const e of enemies) {
      if (e.dead || (e.type === 'boss' && !state.bossTriggered)) continue;
      const d = Math.hypot(e.x - g.x, e.y - g.y, e.z - g.z);
      if (d <= BALANCE.grenade.radius) damageEnemy(e, BALANCE.grenade.damage * (1 - d / (BALANCE.grenade.radius * 1.6)));
    }
    state.cameraShake = Math.max(state.cameraShake, 0.42);
    playExplosion();
  }

  function updateEnemies(dt, time) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.hurt = Math.max(0, e.hurt - dt);
      e.cooldown -= dt;
      if (e.type === 'boss' && !state.bossTriggered) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const d = Math.hypot(dx, dz, (player.y - e.y) * 0.4);
      if (e.type === 'drone') {
        e.group.position.y = e.y + Math.sin(time * 2.1 + e.phase) * 0.38;
        e.group.rotation.x = Math.sin(time * 1.4 + e.phase) * 0.08;
      } else if (e.type === 'boss') {
        e.group.rotation.x = Math.sin(time * 0.8) * 0.06;
        if (boss?.core) boss.core.rotation.x += dt * 1.6;
        if (boss?.ring) boss.ring.rotation.x += dt * 0.8;
      } else if (e.type === 'grunt' && d < 10 && d > 4.5) {
        const step = Math.sign(dx) * Math.min(1.0 * dt, Math.max(0, Math.abs(dx) - 4.2));
        const candidate = resolveObstacles(e.x + step, e.z, e.x, e.z);
        e.x = candidate.x;
        e.group.position.x = e.x;
      }
      e.group.scale.x = dx >= 0 ? -1 : 1;
      if (d < (e.type === 'boss' ? 20 : 14) && e.cooldown <= 0) enemyFire(e);
    }
  }

  function enemyFire(e) {
    e.cooldown = e.cfg.cadence * (0.84 + Math.random() * 0.32);
    const origin = new THREE.Vector3(e.x, e.y + (e.type === 'drone' ? 0 : e.type === 'boss' ? 0.15 : 0.95), e.z);
    const dir = new THREE.Vector3(player.x - origin.x, player.y + 1.0 - origin.y, player.z - origin.z).normalize();
    if (e.type === 'boss') {
      for (const s of [-0.13, 0, 0.13]) {
        const d = dir.clone(); d.y += s; d.z += s * 0.7; d.normalize();
        spawnBullet(origin, d, false, 1, e.cfg.bulletSpeed);
      }
    } else spawnBullet(origin, dir, false, 1, e.cfg.bulletSpeed);
  }

  function damageEnemy(e, amount) {
    e.hp -= amount;
    e.hurt = 0.08;
    flashEnemy(e);
    playTone(120, 0.022, 'sawtooth', 0.018);
    if (e.hp <= 0) killEnemy(e);
  }

  function flashEnemy(e) {
    e.group.scale.y = 0.92;
    setTimeout(() => { if (!e.dead) e.group.scale.y = 1; }, 55);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    state.kills++;
    state.score += e.cfg.score;
    addXP(e.cfg.xp);
    spawnExplosion(e.x, e.y + 0.8, e.z, e.type === 'boss' ? 2.2 : 0.65);
    scene.remove(e.group);
    playExplosion(e.type === 'boss' ? 1.35 : 0.55);
    if (e.type === 'boss') {
      state.bossDead = true;
      gateBarrier.active = false;
      state.objectiveStage = 4;
      showToast('CORE DOWN // EXTRACTION OPEN', 3.0);
      state.score += 1000;
      state.cameraShake = 0.85;
      letterboxTop.classList.add('active'); letterboxBottom.classList.add('active');
      setTimeout(() => { letterboxTop.classList.remove('active'); letterboxBottom.classList.remove('active'); }, 1200);
    }
  }

  function addXP(amount) {
    const oldLevel = state.level;
    state.xp += amount;
    if (state.xp >= BALANCE.xpThresholds[2]) state.level = 3;
    else if (state.xp >= BALANCE.xpThresholds[1]) state.level = 2;
    if (state.level > oldLevel) {
      showToast(`WEAPON ${BALANCE.weapons[state.level - 1].name} ONLINE`, 2.4);
      state.health = Math.min(BALANCE.player.maxHealth, state.health + 1);
      playTone(520, 0.12, 'square', 0.045); setTimeout(() => playTone(780, 0.12, 'square', 0.04), 90);
    }
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0 || state.complete) return;
    player.invuln = 1.05;
    if (state.armor > 0) state.armor = Math.max(0, state.armor - amount);
    else state.health -= amount;
    state.cameraShake = Math.max(state.cameraShake, 0.28);
    damageFlash.classList.add('active'); setTimeout(() => damageFlash.classList.remove('active'), 130);
    playTone(90, 0.12, 'sawtooth', 0.05);
    if (state.health <= 0) respawnPlayer();
  }

  function respawnPlayer() {
    state.health = BALANCE.player.maxHealth;
    state.armor = Math.max(0, state.armor - 1);
    state.score = Math.max(0, state.score - 250);
    player.x = state.checkpoint.x; player.z = state.checkpoint.z; player.y = 0; player.vx = player.vy = player.vz = 0; player.onUpper = false; player.invuln = 2.2;
    showToast('REINSERTED // CHECKPOINT', 2.2);
  }

  function updatePickups(dt, time) {
    for (const p of pickups) {
      if (p.picked) continue;
      p.group.rotation.y += dt * 0.8;
      p.group.position.y = p.y + Math.sin(time * 2.2 + p.phase) * 0.09;
      if (Math.hypot(player.x - p.x, player.y + 0.6 - p.y, player.z - p.z) < 1.15) collectPickup(p);
    }
  }

  function collectPickup(p) {
    p.picked = true; scene.remove(p.group);
    if (p.type === 'weapon') { addXP(95); showToast('FIELD CACHE // +95 XP', 2.0); }
    if (p.type === 'armor') { state.armor = Math.min(3, state.armor + 2); showToast('ARMOR +2', 1.8); }
    if (p.type === 'health') { state.health = BALANCE.player.maxHealth; showToast('VITALS RESTORED', 1.8); }
    if (p.type === 'grenade') { state.grenades = Math.min(5, state.grenades + 2); showToast('GRENADES +2', 1.8); }
    state.score += 150;
    playTone(620, 0.08, 'square', 0.035);
  }

  function spawnExplosion(x, y, z, scale = 1) {
    const flashMaterial = materials.warning.clone(); flashMaterial.transparent = true;
    const ringMaterial = materials.bullet.clone(); ringMaterial.transparent = true;
    const em = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), flashMaterial);
    em.position.set(x, y, z); em.scale.setScalar(scale * 0.5); scene.add(em);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 5, 12), ringMaterial);
    ring.position.set(x, y, z); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(scale * 0.5); scene.add(ring);
    effects.push({ mesh: em, ring, age: 0, life: 0.44, scale });
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; e.age += dt;
      const t = e.age / e.life;
      e.mesh.scale.setScalar(e.scale * (0.45 + t * 1.75));
      e.ring.scale.setScalar(e.scale * (0.5 + t * 2.3));
      e.mesh.rotation.y += dt * 7; e.ring.rotation.z += dt * 2;
      if ('opacity' in e.mesh.material) e.mesh.material.opacity = 1 - t;
      e.mesh.material.opacity = Math.max(0, 1 - t); e.ring.material.opacity = Math.max(0, 1 - t);
      if (e.age >= e.life) { scene.remove(e.mesh, e.ring); e.mesh.geometry.dispose?.(); e.ring.geometry.dispose?.(); e.mesh.material.dispose?.(); e.ring.material.dispose?.(); effects.splice(i, 1); }
    }
  }

  function updateObjectives() {
    if (player.x > 43) activateCheckpoint(42, 0);
    if (player.x > 77) activateCheckpoint(76, 0);
    if (player.x > 89) activateCheckpoint(90, 0);
    if (state.objectiveStage === 0 && player.x > 24) { state.objectiveStage = 1; showToast('ROUTE SPLIT // BRIDGE OR GROUND', 2.4); }
    if (state.objectiveStage === 1 && player.x > 58) { state.objectiveStage = 2; }
    if (state.objectiveStage === 2 && player.x > 78) { state.objectiveStage = 3; }
    if (state.objectiveStage === 3 && player.x > 88 && !state.bossTriggered) {
      state.bossTriggered = true;
      showToast('BUNKER CORE // DESTROY IT', 2.6);
      letterboxTop.classList.add('active'); letterboxBottom.classList.add('active');
      setTimeout(() => { letterboxTop.classList.remove('active'); letterboxBottom.classList.remove('active'); }, 900);
      state.cameraShake = 0.2;
    }
    if (state.bossDead && player.x > 111.2 && !state.complete) finishMission();
  }

  function activateCheckpoint(x, z) {
    if (x <= state.checkpoint.x) return;
    state.checkpoint = { x, z };
    state.health = Math.min(BALANCE.player.maxHealth, state.health + 1);
    const b = beacons.find((v) => Math.abs(v.x - x) < 1.5);
    if (b) { b.activated = true; b.orb.scale.setScalar(1.45); }
    showToast('CHECKPOINT // VITAL +1', 1.8);
  }

  function finishMission() {
    state.complete = true;
    input.fire = false;
    input.mx = input.mz = 0;
    state.score += Math.max(0, Math.round(2000 - state.elapsed * 8));
    letterboxTop.classList.add('active'); letterboxBottom.classList.add('active');
    playTone(440, 0.14, 'square', 0.05); setTimeout(() => playTone(660, 0.18, 'square', 0.05), 130); setTimeout(() => playTone(880, 0.25, 'square', 0.05), 280);
    setTimeout(() => {
      const acc = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
      missionStats.innerHTML = [
        ['TIME', formatTime(state.elapsed)], ['SCORE', String(state.score).padStart(6, '0')],
        ['KILLS', `${state.kills}/15`], ['ACCURACY', `${acc}%`],
        ['WEAPON', BALANCE.weapons[state.level - 1].name], ['BACKEND', backendName]
      ].map(([a,b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
      completeScreen.classList.remove('hidden');
      touchControls.classList.add('hidden');
    }, 900);
  }

  function updateWorldAnimation(dt, time) {
    for (const b of beacons) {
      b.orb.rotation.y += dt * (b.activated ? 3 : 1.1);
      const s = (b.activated ? 1.25 : 1) + Math.sin(time * 3 + b.x) * 0.08;
      b.orb.scale.setScalar(s);
    }
    if (gateDoor && state.bossDead) gateDoor.position.y = Math.min(6.2, gateDoor.position.y + dt * 3.6);
  }

  function updateCamera(dt) {
    state.cameraShake = Math.max(0, state.cameraShake - dt * 1.7);
    const lookAhead = state.complete ? 1.0 : 3.2;
    const targetX = player.x + lookAhead;
    const zoom = state.zoom;
    const desired = new THREE.Vector3(targetX + 0.4, 6.2 * zoom + Math.min(1.2, player.y * 0.18), 11.2 * zoom + player.z * 0.28);
    const k = 1 - Math.exp(-dt * 5.5);
    camera.position.lerp(desired, k);
    if (state.cameraShake > 0) {
      const s = state.cameraShake;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(player.x + 2.0, 1.65 + player.y * 0.18, player.z * 0.38);
    sun.position.x = player.x + 12;
    sun.target.position.set(player.x, 0, 0);
  }

  function updateHud() {
    healthText.textContent = `${state.health}/${BALANCE.player.maxHealth}`;
    healthBar.style.transform = `scaleX(${clamp(state.health / BALANCE.player.maxHealth, 0, 1)})`;
    armorText.textContent = String(state.armor);
    grenadeText.textContent = String(state.grenades);
    scoreText.textContent = String(state.score).padStart(6, '0');
    levelText.textContent = `LV ${state.level}`;
    const a = BALANCE.xpThresholds[state.level - 1];
    const b = BALANCE.xpThresholds[Math.min(state.level, BALANCE.xpThresholds.length - 1)] || a + 1;
    const xpFrac = state.level >= 3 ? 1 : clamp((state.xp - a) / (b - a), 0, 1);
    xpBar.style.transform = `scaleX(${xpFrac})`;
    const objectives = ['Reach the first outpost', 'Choose bridge or ground route', 'Cross the creek line', 'Destroy the bunker core', 'Reach extraction'];
    objectiveEl.textContent = objectives[state.objectiveStage] || objectives[4];
  }

  function adaptResolution() {
    if (frameSamples.length < 40) return;
    const avg = frameSamples.reduce((a,b)=>a+b,0) / frameSamples.length;
    let next = resolutionScale;
    if (avg > 21) next = Math.max(0.68, resolutionScale - 0.08);
    else if (avg < 14.5) next = Math.min(1, resolutionScale + 0.05);
    if (Math.abs(next - resolutionScale) > 0.01) {
      resolutionScale = next;
      renderer.setPixelRatio(basePixelRatio * resolutionScale);
      renderer.setSize(innerWidth, innerHeight, false);
    }
  }

  function floorHeight(x, z, y, onUpper) {
    let h = 0;
    if (z < -0.68) {
      if (x >= 30 && x < 34.1) h = Math.max(h, (x - 30) / 4.1 * 3);
      else if (x >= 34.1 && x <= 54.0 && (onUpper || y > 2.25)) h = Math.max(h, 3);
      else if (x > 54.0 && x <= 58.0 && (onUpper || y > 1.1)) h = Math.max(h, (58 - x) / 4 * 3);
    }
    return Math.max(0, h);
  }

  function resolveObstacles(x, z, oldX, oldZ) {
    const r = 0.38;
    let nx = x, nz = z;
    for (const o of obstacles) {
      if (!o.active) continue;
      if (nx > o.x1 - r && nx < o.x2 + r && nz > o.z1 - r && nz < o.z2 + r) {
        const px = Math.min(Math.abs(nx - (o.x1 - r)), Math.abs(nx - (o.x2 + r)));
        const pz = Math.min(Math.abs(nz - (o.z1 - r)), Math.abs(nz - (o.z2 + r)));
        if (px < pz) nx = oldX; else nz = oldZ;
      }
    }
    return { x: nx, z: nz };
  }

  function isCreek(x) { return x > 55 && x < 68; }

  function setupInput() {
    addEventListener('resize', onResize);
    addEventListener('blur', () => { if (state.running && !state.complete) setPaused(true); });
    addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
      input.keys.add(e.code);
      if (e.code === 'Space') input.jumpQueued = true;
      if (e.code === 'KeyK') input.grenadeQueued = true;
      if (e.code === 'Escape') setPaused(!state.paused);
    }, { passive: false });
    addEventListener('keyup', (e) => { input.keys.delete(e.code); if (e.code === 'KeyJ') input.fire = false; });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) { input.fire = true; ensureAudio(); }
      canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      updatePinchStart();
    }, { passive: false });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!canvasPointers.has(e.pointerId)) return;
      canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      updatePinch();
    }, { passive: false });
    const endCanvasPointer = (e) => {
      canvasPointers.delete(e.pointerId);
      if (e.pointerType === 'mouse') input.fire = false;
      if (canvasPointers.size < 2) pinchStart = null;
    };
    renderer.domElement.addEventListener('pointerup', endCanvasPointer);
    renderer.domElement.addEventListener('pointercancel', endCanvasPointer);
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); state.zoom = clamp(state.zoom + Math.sign(e.deltaY) * 0.07, 0.78, 1.32); }, { passive: false });

    setupJoystick();
    bindHoldButton($('fireButton'), (down) => { input.fire = down; if (down) ensureAudio(); });
    bindTapButton($('jumpButton'), () => { input.jumpQueued = true; ensureAudio(); });
    bindTapButton($('grenadeButton'), () => { input.grenadeQueued = true; ensureAudio(); });

    pauseButton.addEventListener('click', () => setPaused(true));
    $('resumeButton').addEventListener('click', () => setPaused(false));
    $('restartButton').addEventListener('click', () => location.reload());
    $('restartButtonPause').addEventListener('click', () => location.reload());
    soundButton.addEventListener('click', () => { state.sound = !state.sound; soundButton.textContent = state.sound ? 'SFX' : 'MUTE'; if (state.sound) ensureAudio(); });
  }

  let joystickActive = false;
  let joystickPointer = null;
  const joystick = $('joystick');
  const stick = $('stick');
  function setupJoystick() {
    const reset = () => { joystickActive = false; joystickPointer = null; input.mx = input.mz = 0; stick.style.transform = 'translate(0px,0px)'; };
    joystick.addEventListener('pointerdown', (e) => { e.preventDefault(); joystickPointer = e.pointerId; joystickActive = true; joystick.setPointerCapture?.(e.pointerId); moveJoy(e); ensureAudio(); }, { passive:false });
    joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joystickPointer) { e.preventDefault(); moveJoy(e); } }, { passive:false });
    joystick.addEventListener('pointerup', (e) => { if (e.pointerId === joystickPointer) reset(); });
    joystick.addEventListener('pointercancel', reset);
  }
  function moveJoy(e) {
    const r = joystick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width * 0.31; const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    input.mx = dx / max; input.mz = dy / max;
    stick.style.transform = `translate(${dx}px,${dy}px)`;
  }

  function bindHoldButton(el, fn) {
    let pid = null;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; el.setPointerCapture?.(pid); el.classList.add('active'); fn(true); }, { passive:false });
    const up = (e) => { if (pid === null || e.pointerId === pid) { pid = null; el.classList.remove('active'); fn(false); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function bindTapButton(el, fn) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('active'); fn(); }, { passive:false });
    const up = () => el.classList.remove('active'); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  const canvasPointers = new Map();
  let pinchStart = null;
  function updatePinchStart() {
    if (canvasPointers.size !== 2) return;
    const [a,b] = [...canvasPointers.values()];
    pinchStart = { dist: Math.hypot(a.x-b.x, a.y-b.y), zoom: state.zoom };
  }
  function updatePinch() {
    if (canvasPointers.size !== 2 || !pinchStart) return;
    const [a,b] = [...canvasPointers.values()];
    const dist = Math.hypot(a.x-b.x, a.y-b.y);
    state.zoom = clamp(pinchStart.zoom * (pinchStart.dist / Math.max(20, dist)), 0.78, 1.32);
  }

  function setPaused(v) {
    if (!state.running || state.complete) return;
    if (v === state.paused) return;
    const now = performance.now();
    if (v) state.pauseStartedAt = now;
    else if (state.pauseStartedAt) { state.pausedTotal += now - state.pauseStartedAt; state.pauseStartedAt = 0; }
    state.paused = v;
    input.fire = false; input.mx = input.mz = 0;
    pauseScreen.classList.toggle('hidden', !v);
    if (coarsePointer) touchControls.classList.toggle('hidden', v);
    if (audio && v) audio.suspend?.();
    if (audio && !v) audio.resume?.();
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(basePixelRatio * resolutionScale);
    renderer.setSize(innerWidth, innerHeight);
  }

  function showToast(text, seconds = 1.8) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    state.toastTimer = seconds;
  }

  function ensureAudio() {
    if (!state.sound) return null;
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
      audioNoise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate);
      const d = audioNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume?.();
    return audio;
  }
  function playTone(freq, duration, type = 'square', gain = 0.03) {
    const a = ensureAudio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + duration);
  }
  function playExplosion(scale = 0.7) {
    const a = ensureAudio(); if (!a || !audioNoise) return;
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    s.buffer = audioNoise; f.type = 'lowpass'; f.frequency.value = 850; g.gain.setValueAtTime(0.055 * scale, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.22);
    s.connect(f).connect(g).connect(a.destination); s.start(); s.stop(a.currentTime + 0.23);
  }

  function formatTime(sec) { const m = Math.floor(sec/60), s = Math.floor(sec%60); return `${m}:${String(s).padStart(2,'0')}`; }
  function distSq(ax,ay,az,bx,by,bz) { const x=ax-bx,y=ay-by,z=az-bz; return x*x+y*y+z*z; }
  function clamp(v,a,b) { return Math.max(a, Math.min(b,v)); }
  function approach(v,t,d) { return v < t ? Math.min(t,v+d) : Math.max(t,v-d); }
  function mulberry32(a) { return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  return { start, state, pause: () => setPaused(true), resume: () => setPaused(false) };
}
