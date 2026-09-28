import {
  platforms, railings, signs, hazards, coins, gems, relics, scenery, shrine,
  keyGate, arenaLeftGate, vaultGate, crown
} from './level.js';

const TAU = Math.PI * 2;

export function createGameScene(THREE, scene, { legacy = false, shadowSize = 1024 } = {}) {
  const root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x07131e);
  scene.fog = new THREE.FogExp2(0x0b1b27, legacy ? 0.020 : 0.016);

  const standard = (color, extra = {}) => legacy
    ? new THREE.MeshLambertMaterial({ color, transparent: extra.transparent, opacity: extra.opacity ?? 1, side: extra.side })
    : new THREE.MeshStandardMaterial({ color, roughness: extra.roughness ?? 0.72, metalness: extra.metalness ?? 0.04, emissive: extra.emissive ?? 0x000000, emissiveIntensity: extra.emissiveIntensity ?? 0, transparent: extra.transparent, opacity: extra.opacity ?? 1, side: extra.side });
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: extra.transparent, opacity: extra.opacity ?? 1, side: extra.side });

  const mat = {
    stone: standard(0x35576a, { roughness: 0.92 }),
    stoneDark: standard(0x203b4c, { roughness: 0.96 }),
    stoneLight: standard(0x557a83, { roughness: 0.88 }),
    brass: standard(0xd49b35, { roughness: 0.38, metalness: legacy ? 0 : 0.78 }),
    gold: standard(0xffcf49, { roughness: 0.26, metalness: legacy ? 0 : 0.72, emissive: 0x5a2d00, emissiveIntensity: legacy ? 0 : 0.32 }),
    cyan: standard(0x57e2d6, { roughness: 0.32, metalness: legacy ? 0 : 0.12, emissive: 0x0b5c62, emissiveIntensity: legacy ? 0 : 0.34 }),
    red: standard(0xc94e45, { roughness: 0.67 }),
    orange: standard(0xf09a3e, { roughness: 0.62 }),
    navy: standard(0x193143, { roughness: 0.78 }),
    cream: standard(0xfff0bd, { roughness: 0.75 }),
    black: standard(0x061018, { roughness: 0.88 }),
    white: standard(0xffffff, { roughness: 0.82 }),
    gem: standard(0x69f0e6, { roughness: 0.12, metalness: legacy ? 0 : 0.1, emissive: 0x176d74, emissiveIntensity: legacy ? 0 : 0.8 }),
    flame: legacy ? basic(0xffbb45) : standard(0xffb23d, { roughness: 0.3, emissive: 0xff6a00, emissiveIntensity: 3.2 }),
    water: standard(0x155f72, { transparent: true, opacity: 0.62, roughness: 0.22, metalness: 0.08 }),
  };

  const addMesh = (geo, material, parent = root, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = !legacy && cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  };

  // Lighting. WebGPU/WebGL2 uses a strong directional key with shadows; WebGL1 keeps the scene cheaper.
  scene.add(new THREE.HemisphereLight(0x9dd9ea, 0x10212c, legacy ? 1.55 : 1.25));
  const key = new THREE.DirectionalLight(0xffe5b3, legacy ? 1.35 : 3.1);
  key.position.set(12, 20, 10);
  if (!legacy) {
    key.castShadow = true;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.left = -18; key.shadow.camera.right = 18;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 1; key.shadow.camera.far = 60;
    key.shadow.bias = -0.00015;
  }
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x55d9ff, legacy ? 0.45 : 1.15);
  rim.position.set(-10, 8, -7);
  scene.add(rim);

  // Background cavern shell.
  const back = addMesh(new THREE.BoxGeometry(100, 18, 1.2), mat.stoneDark, root, { cast: false, receive: true });
  back.position.set(45, 3.0, -4.3);
  const ceiling = addMesh(new THREE.BoxGeometry(100, 1.0, 8), mat.black, root, { cast: false, receive: true });
  ceiling.position.set(45, 10.3, -1.0);

  // Repeating low-poly wall blocks create a toy-brick silhouette without textures.
  // The modern path instances them to keep draw calls low on phones.
  if (!legacy) {
    const geo = new THREE.BoxGeometry(2.85, 1.0, 0.44);
    const transforms = [[], []];
    for (let row = 0; row < 7; row++) {
      for (let x = -1; x < 93; x += 3.2) {
        transforms[row % 2].push({ x: x + (row % 2) * 1.55, y: -0.5 + row * 1.55, z: -3.55, sz: 0.8 + ((x + row) % 3) * 0.06 });
      }
    }
    const dummy = new THREE.Object3D();
    transforms.forEach((list, idx) => {
      const inst = new THREE.InstancedMesh(geo, idx ? mat.stone : mat.stoneLight, list.length);
      inst.castShadow = false; inst.receiveShadow = true;
      list.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(1,1,v.sz); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); });
      inst.instanceMatrix.needsUpdate = true; root.add(inst);
    });
  } else {
    for (let row = 0; row < 7; row++) {
      for (let x = -1; x < 93; x += 6.4) {
        const b = addMesh(new THREE.BoxGeometry(5.9, 1.0, 0.44), row % 2 ? mat.stone : mat.stoneLight, root, { cast: false, receive: true });
        b.position.set(x + (row % 2) * 1.55, -0.5 + row * 1.55, -3.55);
      }
    }
  }

  const platformMeshes = new Map();
  for (const p of platforms) {
    const material = p.breakable ? mat.brass : (p.moving ? mat.cyan : mat.stone);
    const mesh = addMesh(new THREE.BoxGeometry(p.w, p.h, 3.8), material);
    mesh.position.set(p.x, p.y, 0);
    platformMeshes.set(p.id, mesh);
    // Brick studs on selected wide platforms.
    if (p.w > 3.1 && !p.moving && !p.breakable) {
      const count = Math.min(6, Math.max(2, Math.floor(p.w / 2.4)));
      for (let i = 0; i < count; i++) {
        const stud = addMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10), material, mesh, { cast: !legacy, receive: true });
        stud.position.set(-p.w * 0.38 + (p.w * 0.76) * (count === 1 ? 0.5 : i / (count - 1)), p.h / 2 + 0.08, 1.34);
      }
    }
  }

  // Rails and stairs read clearly at phone size.
  for (const r of railings) {
    const g = new THREE.Group(); root.add(g); g.position.set(r.x, r.y, 1.35);
    const bar = addMesh(new THREE.BoxGeometry(r.w, 0.12, 0.12), mat.brass, g); bar.position.y = 0.8;
    for (const sx of [-r.w / 2, 0, r.w / 2]) {
      const post = addMesh(new THREE.BoxGeometry(0.11, 1.65, 0.11), mat.brass, g); post.position.set(sx, 0, 0);
    }
  }

  // Sign boards use tiny generated canvas labels, readable in perspective and cheap to ship.
  for (const s of signs) {
    const g = new THREE.Group(); root.add(g); g.position.set(s.x, s.y, 1.45);
    const post = addMesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), mat.brass, g); post.position.y = 0.35;
    const board = addMesh(new THREE.BoxGeometry(2.15, 0.72, 0.14), mat.navy, g); board.position.y = 1.0;
    const tex = makeLabelTexture(THREE, s.text);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const face = addMesh(new THREE.PlaneGeometry(1.95, 0.52), faceMat, g, { cast: false, receive: false });
    face.position.set(0, 1.0, 0.081);
  }

  // Hazards.
  for (const h of hazards) {
    if (h.type === 'water') {
      const water = addMesh(new THREE.BoxGeometry(h.w, h.h, 3.6), mat.water, root, { cast: false, receive: true });
      water.position.set(h.x, h.y, 0);
    } else {
      const count = Math.max(2, Math.floor(h.w / 0.32));
      for (let i = 0; i < count; i++) {
        const spike = addMesh(new THREE.ConeGeometry(0.18, 0.65, 5), mat.brass);
        spike.position.set(h.x - h.w / 2 + (i + 0.5) * h.w / count, h.y + 0.22, 0.3);
      }
    }
  }

  // Pillars, arches and torches give the level a strong treasure-temple identity.
  for (const x of scenery.pillars) {
    const g = new THREE.Group(); root.add(g); g.position.set(x, 3.55, -2.6);
    const shaft = addMesh(new THREE.CylinderGeometry(0.52, 0.66, 7.4, 8), mat.stone, g, { cast: false, receive: true });
    shaft.scale.z = 0.75;
    const cap1 = addMesh(new THREE.BoxGeometry(1.65, 0.35, 1.15), mat.stoneLight, g, { cast: false, receive: true }); cap1.position.y = 3.55;
    const cap2 = addMesh(new THREE.BoxGeometry(1.48, 0.28, 1.05), mat.stoneLight, g, { cast: false, receive: true }); cap2.position.y = -3.5;
  }

  const torchFlames = [];
  scenery.torches.forEach((x, i) => {
    const g = new THREE.Group(); root.add(g); g.position.set(x, 3.0 + (i % 2) * 0.6, -1.9);
    const bracket = addMesh(new THREE.BoxGeometry(0.13, 0.85, 0.13), mat.brass, g); bracket.rotation.z = -0.25;
    const flame = addMesh(new THREE.ConeGeometry(0.24, 0.8, 7), mat.flame, g, { cast: false, receive: false });
    flame.position.y = 0.8; flame.userData.phase = i * 0.7; torchFlames.push(flame);
  });

  // Springsmith shrine.
  const shrineGroup = new THREE.Group(); root.add(shrineGroup); shrineGroup.position.set(shrine.x, shrine.y - 0.05, 0.7);
  const shrineBase = addMesh(new THREE.CylinderGeometry(0.95, 1.12, 0.45, 10), mat.brass, shrineGroup); shrineBase.position.y = -0.2;
  const shrineCore = addMesh(new THREE.OctahedronGeometry(0.48, 0), mat.gem, shrineGroup); shrineCore.position.y = 0.64;
  const shrineRing = addMesh(new THREE.TorusGeometry(0.72, 0.09, 8, 24), mat.gold, shrineGroup); shrineRing.position.y = 0.64; shrineRing.rotation.x = Math.PI / 2;

  // Gates.
  const gateMeshes = new Map();
  gateMeshes.set('key-gate', makeGate(THREE, root, mat, keyGate.x, keyGate.y, keyGate.h, addMesh));
  gateMeshes.set('arena-left-gate', makeGate(THREE, root, mat, arenaLeftGate.x, arenaLeftGate.y, arenaLeftGate.h, addMesh));
  gateMeshes.set('vault-gate', makeGate(THREE, root, mat, vaultGate.x, vaultGate.y, vaultGate.h, addMesh));

  // Collectibles.
  const collectibleMeshes = new Map();
  for (const c of coins) {
    const g = new THREE.Group(); root.add(g); g.position.set(c.x, c.y, 0.65); g.userData.baseY = c.y; g.userData.phase = c.x * 0.21;
    addMesh(new THREE.TorusGeometry(0.30, 0.095, 8, 20), mat.gold, g);
    const core = addMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), mat.gold, g); core.rotation.x = Math.PI / 2;
    collectibleMeshes.set(c.id, g);
  }
  for (const c of gems) {
    const g = new THREE.Group(); root.add(g); g.position.set(c.x, c.y, 0.65); g.userData.baseY = c.y; g.userData.phase = c.x * 0.31;
    addMesh(new THREE.OctahedronGeometry(0.42, 0), mat.gem, g);
    collectibleMeshes.set(c.id, g);
  }
  for (const r of relics) {
    const g = new THREE.Group(); root.add(g); g.position.set(r.x, r.y, 0.65); g.userData.baseY = r.y; g.userData.phase = 1.2;
    addMesh(new THREE.TorusGeometry(0.55, 0.12, 8, 20), mat.brass, g);
    for (let i = 0; i < 8; i++) {
      const tooth = addMesh(new THREE.BoxGeometry(0.18, 0.18, 0.22), mat.brass, g);
      tooth.position.set(Math.cos(i * TAU / 8) * 0.7, Math.sin(i * TAU / 8) * 0.7, 0);
      tooth.rotation.z = i * TAU / 8;
    }
    collectibleMeshes.set(r.id, g);
  }

  const crownGroup = new THREE.Group(); root.add(crownGroup); crownGroup.position.set(crown.x, crown.y, 0.5); crownGroup.visible = false;
  const moon = addMesh(new THREE.SphereGeometry(0.48, 12, 8), mat.gold, crownGroup);
  moon.scale.set(1.0, 1.18, 0.45);
  addMesh(new THREE.TorusGeometry(0.72, 0.07, 8, 28), mat.gem, crownGroup);
  const crownBase = addMesh(new THREE.CylinderGeometry(0.62, 0.48, 0.28, 8), mat.brass, crownGroup); crownBase.position.y = -0.6;

  // Hero and enemies.
  const player = makePlayer(THREE, mat, addMesh); root.add(player.group);
  const enemyMeshes = new Map();
  // Build by known IDs so no imported simulation object is required.
  for (const id of ['beetle-1','beetle-2','beetle-3','beetle-4']) {
    const beetle = makeBeetle(THREE, mat, addMesh); root.add(beetle); enemyMeshes.set(id, beetle);
  }
  const boss = makeBoss(THREE, mat, addMesh); root.add(boss.group); boss.group.visible = false;

  // Escape rock pool is created lazily.
  const rockMeshes = new Map();

  // Dust motes. No external textures or particles are needed.
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = legacy ? 45 : 110;
  const arr = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    arr[i * 3] = (i * 17.17) % 92;
    arr[i * 3 + 1] = -2 + ((i * 9.31) % 11);
    arr[i * 3 + 2] = -2.8 + ((i * 5.77) % 4) * 0.75;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xc8edf0, size: legacy ? 0.035 : 0.052, transparent: true, opacity: 0.32, depthWrite: false }));
  root.add(dust);

  return {
    root, mat, key, platformMeshes, gateMeshes, collectibleMeshes, crownGroup, player, enemyMeshes, boss, rockMeshes, torchFlames, shrineCore, dust,
    update(snapshot, t) {
      // Platforms and breakables.
      for (const p of platforms) {
        const mesh = platformMeshes.get(p.id);
        if (!mesh) continue;
        mesh.visible = !(p.breakable && snapshot.broken.has(p.id));
        if (p.moving) {
          const rt = snapshot.movingRuntime.get(p.id);
          if (rt) mesh.position.set(rt.x, rt.y, 0);
        }
      }

      gateMeshes.get('key-gate').visible = !snapshot.hasGear;
      gateMeshes.get('arena-left-gate').visible = snapshot.boss.active && snapshot.boss.alive;
      gateMeshes.get('vault-gate').visible = snapshot.boss.alive;

      // Player pose.
      const ps = snapshot.player;
      player.group.position.set(ps.x, ps.y - 0.03, 0.36);
      player.facing.scale.x = ps.facing || 1;
      const speed = Math.min(1, Math.abs(ps.vx) / 6);
      const bob = ps.grounded ? Math.sin(t * 13) * 0.055 * speed : 0;
      player.body.position.y = bob;
      player.head.position.y = 0.51 + bob * 0.7;
      player.footL.rotation.z = Math.sin(t * 12) * 0.35 * speed;
      player.footR.rotation.z = -Math.sin(t * 12) * 0.35 * speed;
      player.staff.visible = ps.pogo;
      player.staff.position.y = ps.pogo ? -0.82 - Math.sin(t * 19) * 0.05 : -0.45;
      player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, clampLite(-ps.vx * 0.028, -0.12, 0.12), 0.12);
      player.group.visible = ps.invuln <= 0 || Math.floor(t * 16) % 2 === 0;

      // Enemies.
      for (const e of snapshot.enemies) {
        const g = enemyMeshes.get(e.id); if (!g) continue;
        g.visible = e.alive;
        g.position.set(e.x, e.y - 0.08, 0.3);
        g.scale.x = e.dir || 1;
        g.rotation.z = Math.sin(t * 8 + e.x) * 0.035;
      }

      // Boss.
      const bs = snapshot.boss;
      boss.group.visible = bs.active || !bs.alive || snapshot.phase === 'crown' || snapshot.phase === 'escape';
      boss.group.position.set(bs.x, bs.y - 0.08, 0.35);
      boss.facing.scale.x = bs.facing || 1;
      boss.group.rotation.z = Math.sin(t * (bs.mode === 'charge' ? 18 : 6)) * (bs.mode === 'charge' ? 0.07 : 0.02);
      boss.tell.visible = bs.alive && bs.mode === 'tell';
      boss.group.visible = bs.alive && (bs.active || snapshot.phase === 'guardian');
      if (bs.invuln > 0 && Math.floor(t * 18) % 2) boss.group.visible = false;

      // Collectibles.
      for (const [id, g] of collectibleMeshes) {
        g.visible = !snapshot.collected.has(id);
        if (!g.visible) continue;
        g.rotation.y = t * 1.8 + g.userData.phase;
        g.rotation.z = Math.sin(t * 1.4 + g.userData.phase) * 0.12;
        g.position.y = g.userData.baseY + Math.sin(t * 2.4 + g.userData.phase) * 0.12;
      }
      crownGroup.visible = !snapshot.boss.alive && !snapshot.hasCrown;
      if (crownGroup.visible) {
        crownGroup.rotation.y = t * 1.1;
        crownGroup.position.y = crown.y + Math.sin(t * 2.0) * 0.12;
      }

      shrineCore.rotation.y = t * 1.6;
      shrineCore.position.y = 0.64 + Math.sin(t * 2.2) * 0.07;
      torchFlames.forEach((f) => { f.scale.y = 0.88 + Math.sin(t * 8 + f.userData.phase) * 0.14; f.rotation.z = Math.sin(t * 5 + f.userData.phase) * 0.12; });
      dust.rotation.y = t * 0.006;

      // Falling rocks.
      const live = new Set(snapshot.rocks.map(r => r.id));
      for (const r of snapshot.rocks) {
        let mesh = rockMeshes.get(r.id);
        if (!mesh) {
          mesh = addMesh(new THREE.DodecahedronGeometry(0.42, 0), mat.stoneLight, root);
          rockMeshes.set(r.id, mesh);
        }
        mesh.visible = true;
        mesh.position.set(r.x, r.y, 0.35);
        mesh.rotation.set(r.rot * 0.7, r.rot, r.rot * 0.45);
      }
      for (const [id, mesh] of rockMeshes) if (!live.has(id)) { mesh.visible = false; rockMeshes.delete(id); root.remove(mesh); mesh.geometry.dispose?.(); }
    }
  };
}

function makeGate(THREE, root, mat, x, y, h, addMesh) {
  const g = new THREE.Group(); root.add(g); g.position.set(x, y, 0.2);
  for (let i = -2; i <= 2; i++) {
    const bar = addMesh(new THREE.BoxGeometry(0.12, h, 0.18), mat.brass, g);
    bar.position.x = i * 0.15;
  }
  const top = addMesh(new THREE.BoxGeometry(0.9, 0.25, 0.28), mat.gold, g); top.position.y = h / 2;
  return g;
}

function makePlayer(THREE, mat, addMesh) {
  const group = new THREE.Group();
  const facing = new THREE.Group(); group.add(facing);
  const body = addMesh(new THREE.BoxGeometry(0.66, 0.72, 0.55), mat.cyan, facing); body.position.y = -0.08;
  body.rotation.z = -0.02;
  const belly = addMesh(new THREE.BoxGeometry(0.54, 0.45, 0.05), mat.cream, facing); belly.position.set(0.02, -0.08, 0.30);
  const head = new THREE.Group(); facing.add(head); head.position.y = 0.51;
  const skull = addMesh(new THREE.SphereGeometry(0.40, 10, 7), mat.cyan, head); skull.scale.z = 0.82;
  const beak = addMesh(new THREE.ConeGeometry(0.23, 0.48, 4), mat.orange, head); beak.rotation.z = -Math.PI / 2; beak.position.set(0.39, -0.05, 0.03);
  const eyeW = addMesh(new THREE.SphereGeometry(0.105, 8, 6), mat.white, head); eyeW.position.set(0.22, 0.12, 0.31);
  const eye = addMesh(new THREE.SphereGeometry(0.052, 7, 5), mat.black, head); eye.position.set(0.245, 0.115, 0.39);
  const capBrim = addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12), mat.red, head); capBrim.position.y = 0.34;
  const cap = addMesh(new THREE.SphereGeometry(0.30, 10, 6, 0, TAU, 0, Math.PI / 2), mat.red, head); cap.position.y = 0.34;
  const footL = addMesh(new THREE.BoxGeometry(0.34, 0.15, 0.48), mat.orange, facing); footL.position.set(-0.18, -0.55, 0.04);
  const footR = addMesh(new THREE.BoxGeometry(0.34, 0.15, 0.48), mat.orange, facing); footR.position.set(0.18, -0.55, 0.04);
  const staff = new THREE.Group(); facing.add(staff); staff.position.set(0.34, -0.82, 0.06);
  const rod = addMesh(new THREE.CylinderGeometry(0.055, 0.055, 1.25, 8), mat.brass, staff); rod.position.y = -0.3;
  const spring = addMesh(new THREE.TorusGeometry(0.15, 0.035, 6, 16), mat.gold, staff); spring.rotation.x = Math.PI / 2; spring.position.y = -0.86;
  const tip = addMesh(new THREE.CylinderGeometry(0.16, 0.22, 0.16, 8), mat.red, staff); tip.position.y = -0.98;
  staff.visible = false;
  return { group, facing, body, head, footL, footR, staff };
}

function makeBeetle(THREE, mat, addMesh) {
  const g = new THREE.Group();
  const shell = addMesh(new THREE.SphereGeometry(0.38, 8, 6), mat.brass, g); shell.scale.set(1.2, 0.75, 0.9);
  const head = addMesh(new THREE.BoxGeometry(0.28, 0.28, 0.42), mat.navy, g); head.position.x = 0.38;
  for (const sy of [-1,1]) for (const sx of [-0.18,0.18]) {
    const leg = addMesh(new THREE.BoxGeometry(0.30, 0.08, 0.08), mat.black, g); leg.position.set(sx, -0.28, sy * 0.22); leg.rotation.z = sy * 0.28;
  }
  const eye = addMesh(new THREE.SphereGeometry(0.055, 7, 5), mat.flame, g, { cast: false, receive: false }); eye.position.set(0.52, 0.05, 0.18);
  return g;
}

function makeBoss(THREE, mat, addMesh) {
  const group = new THREE.Group();
  const facing = new THREE.Group(); group.add(facing);
  const shell = addMesh(new THREE.DodecahedronGeometry(0.82, 0), mat.brass, facing); shell.scale.set(1.16, 0.9, 0.86);
  const plate = addMesh(new THREE.TorusGeometry(0.54, 0.12, 8, 16), mat.gold, facing); plate.position.z = 0.58;
  const head = addMesh(new THREE.BoxGeometry(0.62, 0.48, 0.62), mat.navy, facing); head.position.set(0.82, 0.02, 0.02);
  const eye = addMesh(new THREE.SphereGeometry(0.105, 8, 6), mat.flame, facing, { cast: false, receive: false }); eye.position.set(1.14, 0.10, 0.25);
  for (const x of [-0.55, 0.1, 0.6]) {
    const leg = addMesh(new THREE.BoxGeometry(0.50, 0.16, 0.18), mat.black, facing); leg.position.set(x, -0.67, 0.3); leg.rotation.z = -0.18;
  }
  const tell = addMesh(new THREE.TorusGeometry(1.1, 0.06, 8, 28), mat.flame, group, { cast: false, receive: false }); tell.rotation.x = Math.PI / 2; tell.position.y = -0.63; tell.visible = false;
  return { group, facing, tell };
}

function makeLabelTexture(THREE, text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle = '#0b1a26'; ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle = '#d9a742'; ctx.lineWidth = 10; ctx.strokeRect(6,6,c.width-12,c.height-12);
  ctx.fillStyle = '#fff0bd'; ctx.font = '900 38px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width/2, c.height/2 + 2, c.width - 36);
  const tex = new THREE.CanvasTexture(c);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function clampLite(v, a, b) { return Math.max(a, Math.min(b, v)); }
