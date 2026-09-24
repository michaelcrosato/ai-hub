import { COLLIDERS, WORLD, getBoss } from './sim.js';

const PALETTE = {
  dust: 0x9b5b33,
  dustDark: 0x784025,
  sand: 0xd6a15d,
  wood: 0x704027,
  woodLight: 0x9a653a,
  woodDark: 0x4c2a1c,
  cream: 0xe7c987,
  blue: 0x2e6981,
  red: 0x9d382d,
  green: 0x536a3a,
  ink: 0x251d19,
  brass: 0xe7b84f,
  sky: 0x9ec0c2,
};

export async function createRenderSystem({ canvas, THREE, TSL = null, bloomFactory = null, legacy = false, quality = 'auto' }) {
  const T = THREE;
  let renderer;
  let backendLabel = 'WebGL1';

  if (!legacy) {
    renderer = new T.WebGPURenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    await renderer.init();
    backendLabel = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  } else {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl', { alpha: false, antialias: true });
    if (!gl) throw new Error('WebGL1 is not available.');
    renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false, powerPreference: 'high-performance' });
    backendLabel = 'WebGL1 compatibility';
  }

  renderer.setClearColor(PALETTE.sky, 1);
  if ('outputColorSpace' in renderer && T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
  if ('toneMapping' in renderer && T.ACESFilmicToneMapping !== undefined) {
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = !legacy;
    if (T.PCFShadowMap !== undefined) renderer.shadowMap.type = T.PCFShadowMap;
  }

  const scene = new T.Scene();
  scene.background = new T.Color(PALETTE.sky);
  scene.fog = new T.FogExp2(PALETTE.sky, 0.0125);

  const camera = new T.PerspectiveCamera(49, 1, 0.1, 220);
  camera.position.set(0, 26, WORLD.startZ + 20);

  const hemi = new T.HemisphereLight(0xffe6b6, 0x593a32, 2.1);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffd6a0, legacy ? 2.4 : 3.2);
  sun.position.set(-18, 34, 26);
  sun.castShadow = !legacy;
  if (sun.shadow?.mapSize) {
    sun.shadow.mapSize.set(legacy ? 512 : 1536, legacy ? 512 : 1536);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0008;
  }
  scene.add(sun);

  const mats = createMaterials(T);
  const staticRoot = new T.Group();
  scene.add(staticRoot);
  buildTown(T, staticRoot, mats, !legacy);
  const entityRoot = new T.Group();
  scene.add(entityRoot);
  const fxRoot = new T.Group();
  scene.add(fxRoot);
  const dust = buildDust(T, scene, legacy ? 60 : 150);

  let pipeline = null;
  if (!legacy && T.RenderPipeline && TSL?.pass) {
    try {
      const scenePass = TSL.pass(scene, camera);
      const colorNode = scenePass.getTextureNode ? scenePass.getTextureNode('output') : scenePass;
      let output = colorNode;
      if (bloomFactory) {
        const glow = bloomFactory(colorNode, 0.16, 0.16, 1.05);
        if (colorNode?.add) output = colorNode.add(glow);
      }
      pipeline = new T.RenderPipeline(renderer, output);
    } catch (err) {
      console.warn('RenderPipeline disabled:', err);
      pipeline = null;
    }
  }

  const visuals = new Map();
  const fx = [];
  const raycaster = new T.Raycaster();
  const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hitPoint = new T.Vector3();
  const ndc = new T.Vector2();
  const desired = new T.Vector3();
  const look = new T.Vector3();
  let cameraZoom = 1;
  let shake = 0;
  let lastSizeW = 0, lastSizeH = 0;

  function setQuality(nextQuality = quality) {
    quality = nextQuality;
    const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    let cap = mobile ? 1.35 : 1.7;
    if (quality === 'low') cap = 1.0;
    if (quality === 'high') cap = mobile ? 1.6 : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    if (renderer.shadowMap) renderer.shadowMap.enabled = !legacy && quality !== 'low';
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth || innerWidth);
    const h = Math.max(1, canvas.clientHeight || innerHeight);
    if (w === lastSizeW && h === lastSizeH) return;
    lastSizeW = w; lastSizeH = h;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.72 ? 58 : camera.aspect < 1 ? 54 : 49;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  setQuality(quality);
  resize();

  function ensureVisual(entity) {
    if (visuals.has(entity.id)) return visuals.get(entity.id);
    let obj;
    if (entity.kind === 'player') obj = makeCowboy(T, mats, 'player');
    else if (entity.kind === 'grunt') obj = makeCowboy(T, mats, 'grunt');
    else if (entity.kind === 'rifle') obj = makeCowboy(T, mats, 'rifle');
    else if (entity.kind === 'rider') obj = makeRider(T, mats);
    else if (entity.kind === 'boss') obj = makeCowboy(T, mats, 'boss');
    else if (entity.kind === 'playerBullet' || entity.kind === 'enemyBullet') obj = makeBullet(T, mats, entity.kind === 'playerBullet');
    else if (entity.kind === 'posterCrate' || entity.kind === 'lootCrate') obj = makeCrate(T, mats, entity.kind === 'posterCrate');
    else obj = makePickup(T, mats, entity.kind);
    obj.userData.kind = entity.kind;
    entityRoot.add(obj);
    visuals.set(entity.id, obj);
    return obj;
  }

  function syncVisuals(state) {
    const live = new Set();
    const all = [state.player, ...state.enemies, ...state.bullets, ...state.pickups, ...state.destructibles.filter(d => d.alive)];
    const boss = getBoss(state);
    for (const e of all) {
      live.add(e.id);
      const o = ensureVisual(e);
      o.visible = true;
      const y = e.kind.includes?.('Bullet') ? 0.82 : e.kind === 'rider' ? 0.05 : e.kind === 'player' || ['grunt','rifle','boss'].includes(e.kind) ? 0.02 : 0.1;
      const bob = ['poster','coin','medkit','boots','silver'].includes(e.kind) ? Math.sin(state.time * 4 + e.id) * 0.16 + 0.34 : 0;
      o.position.set(e.x, y + bob, e.z);
      if (e.kind === 'player') o.rotation.y = Math.atan2(state.player.aimX, state.player.aimZ);
      else if (['grunt','rifle','rider','boss'].includes(e.kind)) {
        const dx = state.player.x - e.x, dz = state.player.z - e.z;
        o.rotation.y = Math.atan2(dx, dz);
      } else if (e.kind === 'playerBullet' || e.kind === 'enemyBullet') {
        o.rotation.y = Math.atan2(e.dx, e.dz);
      } else if (['poster','coin','medkit','boots','silver'].includes(e.kind)) {
        o.rotation.y = state.time * 1.9 + e.id;
      }
      if (e.kind === 'boss') {
        const ratio = Math.max(0.05, e.hp / e.maxHp);
        o.userData.healthBar?.scale.set(ratio, 1, 1);
      }
    }
    for (const [id, obj] of visuals) {
      if (!live.has(id)) {
        entityRoot.remove(obj);
        disposeObject(obj);
        visuals.delete(id);
      }
    }
    if (boss && !visuals.has(boss.id)) ensureVisual(boss);
  }

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'playerHit') shake = Math.max(shake, 0.42);
      if (ev.type === 'bossShot') shake = Math.max(shake, 0.12);
      if (ev.type === 'bossIntro' || ev.type === 'bossEnrage') shake = Math.max(shake, 0.5);
      if (['hit','woodHit','crateBreak','enemyDown','bossDown','playerShot'].includes(ev.type)) {
        const count = ev.type === 'bossDown' ? 26 : ev.type === 'enemyDown' ? 8 : ev.type === 'crateBreak' ? 12 : 3;
        spawnBurst(ev.x ?? ev.entity?.x ?? 0, ev.z ?? ev.entity?.z ?? 0, count, ev.type);
      }
    }
  }

  function spawnBurst(x, z, count, type) {
    const color = type === 'woodHit' || type === 'crateBreak' ? 0xb97943 : type === 'bossDown' ? 0xffc85a : 0xf4d08b;
    const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    for (let i = 0; i < count; i++) {
      const m = new T.Mesh(new T.IcosahedronGeometry(type === 'bossDown' ? 0.09 : 0.055, 0), mat.clone());
      m.position.set(x, 0.7 + Math.random() * 0.5, z);
      fxRoot.add(m);
      fx.push({ obj: m, vx: (Math.random() - 0.5) * 4.8, vy: 1.8 + Math.random() * 4.2, vz: (Math.random() - 0.5) * 4.8, life: 0.3 + Math.random() * 0.45, max: 0.75 });
    }
  }

  function updateFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      f.vy -= 8.6 * dt;
      f.obj.position.x += f.vx * dt;
      f.obj.position.y += f.vy * dt;
      f.obj.position.z += f.vz * dt;
      f.obj.scale.multiplyScalar(0.985);
      if (f.obj.material) f.obj.material.opacity = Math.max(0, f.life / f.max);
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      if (fx[i].life <= 0) {
        fxRoot.remove(fx[i].obj);
        disposeObject(fx[i].obj);
        fx.splice(i, 1);
      }
    }
  }

  function updateCamera(state, dt) {
    const p = state.player;
    const aimLeadX = p.aimX * 1.2;
    const aimLeadZ = p.aimZ * 2.1;
    const bossMode = state.bossSpawned && !state.bossDefeated;
    const targetZ = bossMode ? Math.min(p.z - 4, -88) : p.z - 7.2 + aimLeadZ;
    look.set(p.x * 0.18 + aimLeadX, 0.3, targetZ);
    const portraitLift = camera.aspect < 0.8 ? 4.8 : 0;
    const height = (25.5 + portraitLift) / cameraZoom;
    const back = (18.5 + portraitLift * 0.55) / cameraZoom;
    desired.set(look.x * 0.42, height, look.z + back);
    const smooth = 1 - Math.exp(-dt * 6.5);
    camera.position.lerp(desired, smooth);
    if (shake > 0.001) {
      const s = shake * 0.32;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s * 0.35;
      shake *= Math.exp(-dt * 8.5);
    }
    camera.lookAt(look);
    sun.position.z = look.z + 30;
    sun.target?.position?.set(0, 0, look.z);
    if (sun.target && !sun.target.parent) scene.add(sun.target);
    if (sun.shadow?.camera) sun.shadow.camera.updateProjectionMatrix?.();
  }

  function updateDust(state, dt) {
    dust.rotation.y += dt * 0.012;
    dust.position.z = state.player.z - 20;
    dust.position.x = state.player.x * 0.15;
  }

  function render(state, dt) {
    resize();
    syncVisuals(state);
    handleEvents(state.events);
    updateFx(dt);
    updateDust(state, dt);
    updateCamera(state, dt);
    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);
  }

  function setZoom(v) {
    cameraZoom = Math.max(0.74, Math.min(1.33, v));
  }

  function getZoom() { return cameraZoom; }

  function screenToGround(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) return { x: hitPoint.x, z: hitPoint.z };
    return null;
  }

  function dispose() {
    pipeline?.dispose?.();
    renderer.dispose?.();
  }

  return { render, screenToGround, setZoom, getZoom, setQuality, backendLabel, dispose, scene, camera, renderer };
}

function createMaterials(T) {
  const std = (color, roughness = 0.88, metalness = 0.0) => new T.MeshStandardMaterial({ color, roughness, metalness });
  return {
    dust: std(PALETTE.dust, 1), dustDark: std(PALETTE.dustDark, 1), sand: std(PALETTE.sand, 1),
    wood: std(PALETTE.wood, 0.94), woodLight: std(PALETTE.woodLight, 0.93), woodDark: std(PALETTE.woodDark, 0.98),
    cream: std(PALETTE.cream, 0.9), blue: std(PALETTE.blue, 0.82), red: std(PALETTE.red, 0.88), green: std(PALETTE.green, 0.92), ink: std(PALETTE.ink, 0.84),
    brass: std(PALETTE.brass, 0.42, 0.35), white: std(0xf4e7ca, 0.88), black: std(0x1f1b1a, 0.86),
    horse: std(0x7e4a2e, 0.96), horseDark: std(0x37251d, 0.96),
    bulletPlayer: new T.MeshBasicMaterial({ color: 0xffda64 }), bulletEnemy: new T.MeshBasicMaterial({ color: 0xff5f44 }),
    poster: std(0xe9ce96, 0.98), pickupGreen: std(0x67a867, 0.85), pickupBlue: std(0x5e94c7, 0.78),
  };
}

function applyShadow(obj, enabled) {
  obj.traverse?.(child => {
    if (child.isMesh) { child.castShadow = enabled; child.receiveShadow = enabled; }
  });
}

function box(T, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cylinder(T, rt, rb, h, sides, mat, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, sides), mat);
  m.position.set(x, y, z);
  return m;
}

function buildTown(T, root, mats, shadows) {
  const ground = new T.Mesh(new T.PlaneGeometry(42, 170), mats.dust);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -30);
  ground.receiveShadow = shadows;
  root.add(ground);

  const track = new T.Mesh(new T.PlaneGeometry(12, 166), mats.dustDark);
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, -0.07, -30);
  root.add(track);

  for (let z = 36; z > -105; z -= 8) {
    const rut = new T.Group();
    rut.add(box(T, 0.16, 0.015, 5.5, mats.sand, -2.8, 0, 0));
    rut.add(box(T, 0.16, 0.015, 5.5, mats.sand, 2.8, 0, 0));
    rut.position.z = z;
    root.add(rut);
  }

  const buildings = [
    [-1, 29, 'SHERIFF', mats.blue], [1, 22, 'GENERAL', mats.cream], [-1, 11, 'SALOON', mats.red], [1, 2, 'BANK', mats.woodLight],
    [-1, -10, 'HOTEL', mats.cream], [1, -22, 'STABLE', mats.green], [1, -35, 'GUNSMITH', mats.woodLight], [1, -47, 'CAFE', mats.blue],
    [-1, -61, 'FREIGHT', mats.red], [1, -73, 'LIVERY', mats.cream], [-1, -83, 'STOCKADE', mats.woodDark]
  ];
  for (const [side, z, name, mat] of buildings) root.add(makeBuilding(T, mats, side, z, name, mat, shadows));

  for (const c of COLLIDERS) {
    if (c.kind === 'trough') root.add(makeTrough(T, mats, c.x, c.z));
    else if (c.kind === 'fence') root.add(makeFence(T, mats, c.x, c.z, c.d > c.w));
    else if (c.kind === 'barrels') root.add(makeBarrelCluster(T, mats, c.x, c.z));
  }

  root.add(makeFence(T, mats, -7.8, -91.2, true, 8));
  root.add(makeFence(T, mats, 7.8, -91.2, true, 8));

  const waterTower = new T.Group();
  const tank = cylinder(T, 2.1, 2.1, 2.6, 10, mats.woodDark, 0, 7.1, 0);
  tank.rotation.z = Math.PI / 2;
  waterTower.add(tank);
  for (const sx of [-1.35, 1.35]) for (const sz of [-1.0, 1.0]) waterTower.add(box(T, 0.28, 6, 0.28, mats.wood, sx, 3, sz));
  waterTower.position.set(12.5, 0, -42);
  applyShadow(waterTower, shadows);
  root.add(waterTower);

  for (let z = 34; z > -96; z -= 14) {
    const side = (Math.floor((z + 100) / 14) % 2) ? -1 : 1;
    const cactus = makeCactus(T, mats);
    cactus.position.set(side * (11.5 + Math.random() * 3), 0, z + Math.random() * 4);
    root.add(cactus);
  }

  applyShadow(root, shadows);
}

function makeBuilding(T, mats, side, z, name, facadeMat, shadows) {
  const g = new T.Group();
  const x = side * 13.1;
  const width = 7.2 + (name.length % 3) * 0.6;
  const depth = 8.2;
  const h = 5.2 + (name.length % 2) * 1.0;
  g.add(box(T, width, h, depth, facadeMat, x, h / 2, z));
  const frontX = x - side * (width / 2 + 0.07);
  g.add(box(T, 0.34, h + 1.6, width + 0.4, facadeMat, frontX, h / 2 + 0.5, z));

  const porch = box(T, 2.4, 0.3, width + 0.8, mats.wood, x - side * (width / 2 + 1.1), 0.34, z);
  g.add(porch);
  const porchX = x - side * (width / 2 + 1.1);
  for (const dz of [-width / 2 + 0.5, width / 2 - 0.5]) g.add(box(T, 0.16, 2.55, 0.16, mats.woodDark, porchX, 1.55, z + dz));
  g.add(box(T, 2.45, 0.18, width + 1.0, mats.woodDark, porchX, 2.78, z));

  // Low stairs and railings make the street read as a navigable 3D space.
  for (let i = 0; i < 3; i++) g.add(box(T, 0.64 + i * 0.35, 0.16, 1.9, mats.woodLight, porchX - side * (1.32 + i * 0.29), 0.08 + i * 0.12, z));
  for (const rz of [-1.2, 1.2]) {
    g.add(box(T, 0.12, 1.0, 0.12, mats.woodDark, porchX - side * 1.18, 0.84, z + rz));
    const rail = box(T, 1.5, 0.1, 0.1, mats.woodDark, porchX - side * 0.4, 1.1, z + rz);
    g.add(rail);
  }

  const sign = makeSign(T, name, name === 'SALOON' ? '#7b2f27' : '#4a3024', '#f3dba2');
  sign.position.set(frontX - side * 0.19, h + 0.4, z);
  sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  g.add(sign);

  const door = box(T, 0.16, 2.5, 1.25, mats.woodDark, frontX - side * 0.19, 1.55, z);
  g.add(door);
  const windowMat = new T.MeshStandardMaterial({ color: 0x8ec0c0, roughness: 0.35, metalness: 0.05 });
  for (const wz of [-2.0, 2.0]) g.add(box(T, 0.12, 1.4, 1.25, windowMat, frontX - side * 0.2, 2.2, z + wz));
  applyShadow(g, shadows);
  return g;
}

function makeSign(T, text, bg = '#5c3c28', fg = '#f3d9a1') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#2a1b16'; ctx.lineWidth = 18; ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  ctx.fillStyle = fg; ctx.font = '700 62px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new T.CanvasTexture(canvas);
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: false });
  return new T.Mesh(new T.PlaneGeometry(3.5, 1.08), mat);
}

function makeFence(T, mats, x, z, alongZ = true, length = 4.6) {
  const g = new T.Group();
  const steps = Math.max(2, Math.floor(length / 1.1));
  for (let i = 0; i <= steps; i++) {
    const p = (i / steps - 0.5) * length;
    const post = box(T, 0.16, 1.4, 0.16, mats.woodDark, alongZ ? 0 : p, 0.7, alongZ ? p : 0);
    g.add(post);
  }
  for (const y of [0.55, 1.05]) {
    const rail = box(T, alongZ ? 0.14 : length, 0.12, alongZ ? length : 0.14, mats.wood, 0, y, 0);
    g.add(rail);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeTrough(T, mats, x, z) {
  const g = new T.Group();
  g.add(box(T, 2.8, 0.55, 1.3, mats.wood, 0, 0.3, 0));
  g.add(box(T, 2.35, 0.08, 0.86, mats.blue, 0, 0.59, 0));
  g.position.set(x, 0, z);
  return g;
}

function makeBarrelCluster(T, mats, x, z) {
  const g = new T.Group();
  for (const [dx, dz] of [[-0.55,0],[0.55,0],[0,0.72]]) {
    const b = cylinder(T, 0.48, 0.48, 1.15, 10, mats.wood, dx, 0.58, dz);
    g.add(b);
    g.add(cylinder(T, 0.5, 0.5, 0.08, 10, mats.ink, dx, 0.33, dz));
    g.add(cylinder(T, 0.5, 0.5, 0.08, 10, mats.ink, dx, 0.83, dz));
  }
  g.position.set(x, 0, z);
  return g;
}

function makeCactus(T, mats) {
  const g = new T.Group();
  g.add(cylinder(T, 0.28, 0.34, 2.6, 7, mats.green, 0, 1.3, 0));
  const arm1 = cylinder(T, 0.18, 0.2, 1.1, 7, mats.green, 0.55, 1.55, 0); arm1.rotation.z = Math.PI / 2; g.add(arm1);
  g.add(cylinder(T, 0.18, 0.22, 0.9, 7, mats.green, 1.0, 1.95, 0));
  const arm2 = cylinder(T, 0.16, 0.19, 0.85, 7, mats.green, -0.5, 1.1, 0); arm2.rotation.z = Math.PI / 2; g.add(arm2);
  return g;
}

function makeCowboy(T, mats, role) {
  const g = new T.Group();
  let shirt = mats.blue, hat = mats.cream, pants = mats.ink, accent = mats.red;
  if (role === 'grunt') { shirt = mats.green; hat = mats.woodLight; accent = mats.ink; }
  if (role === 'rifle') { shirt = mats.red; hat = mats.woodDark; accent = mats.cream; }
  if (role === 'boss') { shirt = mats.black; hat = mats.black; accent = mats.red; }

  g.add(box(T, 0.84, 1.05, 0.55, shirt, 0, 1.18, 0));
  g.add(box(T, 0.75, 0.52, 0.52, pants, 0, 0.42, 0));
  g.add(cylinder(T, 0.3, 0.33, 0.5, 8, mats.cream, 0, 1.95, 0));
  const brim = cylinder(T, 0.58, 0.58, 0.1, 10, hat, 0, 2.23, 0);
  g.add(brim);
  const crown = cylinder(T, 0.35, 0.39, 0.44, 8, hat, 0, 2.46, 0);
  g.add(crown);
  g.add(box(T, 0.92, 0.14, 0.6, accent, 0, 1.52, 0.03));
  for (const sx of [-1, 1]) {
    const arm = box(T, 0.18, 0.68, 0.18, shirt, sx * 0.52, 1.24, -0.05);
    arm.rotation.z = sx * -0.23;
    g.add(arm);
    const gun = box(T, 0.11, 0.11, 0.78, mats.brass, sx * 0.62, 1.03, -0.55);
    g.add(gun);
  }
  if (role === 'boss') {
    g.scale.setScalar(1.18);
    const badge = cylinder(T, 0.14, 0.14, 0.05, 6, mats.brass, 0.22, 1.35, -0.3); badge.rotation.x = Math.PI / 2; g.add(badge);
    const barRoot = new T.Group();
    const back = box(T, 1.5, 0.12, 0.12, mats.ink, 0, 3.1, 0);
    const fill = box(T, 1.42, 0.08, 0.14, mats.red, 0, 3.1, -0.02);
    fill.geometry.translate(0.71, 0, 0); fill.position.x = -0.71;
    barRoot.add(back, fill); g.add(barRoot); g.userData.healthBar = fill;
  }
  applyShadow(g, true);
  return g;
}

function makeRider(T, mats) {
  const g = new T.Group();
  const horse = new T.Group();
  horse.add(box(T, 0.92, 0.92, 1.72, mats.horse, 0, 0.88, 0));
  horse.add(box(T, 0.52, 0.65, 0.68, mats.horse, 0, 1.25, -1.0));
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.55, 0.55]) horse.add(box(T, 0.16, 0.95, 0.16, mats.horseDark, sx, 0.37, sz));
  g.add(horse);
  const rider = makeCowboy(T, mats, 'grunt');
  rider.scale.setScalar(0.78); rider.position.set(0, 1.25, 0.18); g.add(rider);
  applyShadow(g, true);
  return g;
}

function makeBullet(T, mats, player) {
  const geom = T.CapsuleGeometry ? new T.CapsuleGeometry(0.07, 0.25, 2, 5) : new T.SphereGeometry(0.12, 6, 4);
  const m = new T.Mesh(geom, player ? mats.bulletPlayer : mats.bulletEnemy);
  if (m.geometry?.rotateX) m.geometry.rotateX(Math.PI / 2);
  return m;
}

function makeCrate(T, mats, poster) {
  const g = new T.Group();
  g.add(box(T, 1.25, 1.25, 1.25, mats.woodLight, 0, 0.63, 0));
  g.add(box(T, 1.32, 0.12, 0.12, mats.woodDark, 0, 0.72, -0.64));
  g.add(box(T, 0.12, 1.32, 0.12, mats.woodDark, 0, 0.72, -0.64));
  if (poster) {
    const glint = cylinder(T, 0.08, 0.08, 1.5, 6, mats.brass, 0, 1.65, 0);
    glint.scale.x = 0.28; g.add(glint);
  }
  applyShadow(g, true);
  return g;
}

function makePickup(T, mats, kind) {
  const g = new T.Group();
  if (kind === 'poster') {
    const p = box(T, 0.72, 0.9, 0.06, mats.poster, 0, 0.5, 0);
    g.add(p);
    const mark = box(T, 0.18, 0.22, 0.07, mats.ink, 0, 0.58, -0.04); g.add(mark);
  } else if (kind === 'coin') {
    const c = cylinder(T, 0.35, 0.35, 0.08, 10, mats.brass, 0, 0.36, 0); c.rotation.z = Math.PI / 2; g.add(c);
  } else if (kind === 'medkit') {
    g.add(box(T, 0.62, 0.48, 0.46, mats.cream, 0, 0.28, 0));
    g.add(box(T, 0.18, 0.5, 0.5, mats.red, 0, 0.29, -0.03));
    g.add(box(T, 0.5, 0.18, 0.5, mats.red, 0, 0.29, -0.03));
  } else if (kind === 'boots') {
    g.add(box(T, 0.24, 0.48, 0.48, mats.woodDark, -0.18, 0.28, 0));
    g.add(box(T, 0.24, 0.48, 0.48, mats.woodDark, 0.18, 0.28, 0));
  } else if (kind === 'silver') {
    g.add(cylinder(T, 0.35, 0.35, 0.16, 6, mats.pickupBlue, 0, 0.3, 0));
    g.add(cylinder(T, 0.12, 0.12, 0.42, 6, mats.brass, 0, 0.46, 0));
  } else {
    g.add(new T.Mesh(new T.OctahedronGeometry(0.35), mats.pickupGreen));
  }
  applyShadow(g, true);
  return g;
}

function buildDust(T, scene, count) {
  const geo = new T.BufferGeometry();
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    a[i * 3] = (Math.random() - 0.5) * 34;
    a[i * 3 + 1] = 0.1 + Math.random() * 4.2;
    a[i * 3 + 2] = (Math.random() - 0.5) * 62;
  }
  geo.setAttribute('position', new T.BufferAttribute(a, 3));
  const mat = new T.PointsMaterial({ color: 0xe2bb80, size: 0.08, transparent: true, opacity: 0.36, depthWrite: false });
  const pts = new T.Points(geo, mat);
  scene.add(pts);
  return pts;
}

function disposeObject(obj) {
  obj.traverse?.(c => {
    c.geometry?.dispose?.();
    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.()); else c.material?.dispose?.();
  });
}
