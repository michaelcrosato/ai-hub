/**
 * ring.js — the arena, the fighters and their animation, on kit.renderer.
 *
 * The look is the original one: a low-poly ring under a warm key spot and a
 * coloured rim light, ACES tone mapping, exponential fog, a ring of boxy fans
 * and neon signs. Static props are baked into a few meshes, the crowd is one
 * instanced batch, and every pose eases on real time (not per frame), so the
 * animation reads the same at 30, 60 or 144 fps.
 */

import * as THREE from 'three/webgpu';
import { bakeInstances } from 'kit/instancing.js';
import { createPost } from 'kit/post.js';
import { OPPONENTS } from './sim.js';

const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent easing factor: the old per-frame lerp `f` at 60 fps is rate -ln(1-f)*60. */
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const rand = (a, b) => a + Math.random() * (b - a);

const HANDS = [-1, 1];
const TELL_GLOW = { straight: 0xffd24a, hook: 0xff7a2f, upper: 0x49e5ff, haymaker: 0xff2a3a };

export function createRing(kit) {
  const renderer = kit.renderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080610);
  scene.fog = new THREE.FogExp2(0x0d0818, 0.032);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
  // Portrait phones: keep at least ~24° across so both fighters stay in frame.
  kit.onResize((w, h) => {
    const aspect = w / h;
    camera.aspect = aspect;
    const minH = THREE.MathUtils.degToRad(24);
    const vForH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / aspect));
    camera.fov = Math.max(43, vForH);
    camera.updateProjectionMatrix();
  });

  // ---- lights (authored for r186 already: physical units, no conversion)
  const hemi = new THREE.HemisphereLight(0x7faaff, 0x321828, 1.3);
  scene.add(hemi);
  const key = new THREE.SpotLight(0xfff1d4, 120, 28, Math.PI / 4, 0.5, 1.3);
  key.position.set(-4, 10, 5);
  key.target.position.set(0, 1, -1);
  key.castShadow = true;
  kit.shadow(key, 2048);
  key.shadow.radius = 2;
  key.shadow.bias = -0.00025;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0x8b4cff, 90, 25, Math.PI / 3, 0.65, 1.4);
  rim.position.set(5, 7, -5);
  rim.target.position.set(0, 1.6, -1);
  scene.add(rim, rim.target);

  const matCache = new Map();
  /** One shared material per look (posts, crowd, trims…). */
  const mat = (color, rough = 0.68, metal = 0.03) => {
    const k = `${color}|${rough}|${metal}`;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    return matCache.get(k);
  };
  /** A material of its own (its colour or glow changes per bout or per frame). */
  const ownMat = (color, rough = 0.68, metal = 0.03) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

  // ---- the ring
  const ring = new THREE.Group();
  scene.add(ring);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.48, 7.2), mat(0x17121e, 0.83));
  platform.position.y = 0.2;
  platform.receiveShadow = true;
  ring.add(platform);
  const canvasMat = ownMat(0x2a3152, 0.9);
  const canvas = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.1, 6.4), canvasMat);
  canvas.position.y = 0.5;
  canvas.receiveShadow = true;
  ring.add(canvas);

  const dummy = new THREE.Object3D();
  const postBatch = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 2.6, 0.24), mat(0x20202a, 0.55, 0.25), 4);
  let n = 0;
  for (const x of [-3.7, 3.7]) {
    for (const z of [-2.95, 2.95]) {
      dummy.position.set(x, 1.65, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postBatch.setMatrixAt(n++, dummy.matrix);
    }
  }
  postBatch.castShadow = true;
  ring.add(bakeInstances(postBatch, { dispose: true }));

  // Twelve ropes: one unit cylinder stretched to each span, baked into one mesh.
  const ropeMat = ownMat(0xff3e59, 0.55, 0.1);
  const ropeBatch = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), ropeMat, 12);
  n = 0;
  const rope = (x1, z1, x2, z2, y) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    dummy.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    dummy.rotation.set(0, -Math.atan2(dz, dx), Math.PI / 2);
    dummy.scale.set(1, Math.hypot(dx, dz), 1);
    dummy.updateMatrix();
    ropeBatch.setMatrixAt(n++, dummy.matrix);
  };
  for (const y of [1.15, 1.65, 2.15]) {
    rope(-3.7, -2.95, 3.7, -2.95, y);
    rope(-3.7, 2.95, 3.7, 2.95, y);
    rope(-3.7, -2.95, -3.7, 2.95, y);
    rope(3.7, -2.95, 3.7, 2.95, y);
  }
  ring.add(bakeInstances(ropeBatch, { dispose: true }));

  // ---- arena wall, crowd and neon
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c0914, roughness: 1, side: THREE.BackSide }));
  wall.position.y = 3.2;
  scene.add(wall);

  // The fans move (they bob and jump), so they are one kit.instanced batch with instance colours.
  const CROWD_MAX = Math.round(150 * 1.25);
  const crowdColors = [0x452458, 0x174e66, 0x653247, 0x494118, 0x253e37].map((c) => new THREE.Color(c));
  const crowd = kit.instanced(new THREE.BoxGeometry(0.22, 0.42, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.03 }), CROWD_MAX);
  const fans = [];
  for (let i = 0; i < CROWD_MAX; i++) {
    // Golden-angle spacing: any first N fans spread evenly round the hall, so the tier can trim the count.
    const a = (i * 2.399963) % (Math.PI * 2);
    const r = rand(7.2, 10.8);
    fans.push({ x: Math.cos(a) * r, y: rand(1.15, 3.4), z: Math.sin(a) * r - 1, rot: -a + Math.PI / 2, phase: Math.random() * 6.28, hype: rand(0.6, 1.2) });
    crowd.setColorAt(i, crowdColors[i % crowdColors.length]);
  }
  crowd.instanceColor.needsUpdate = true;
  crowd.frustumCulled = false;
  const setCrowdCount = () => (crowd.count = kit.detail(150, 40));
  setCrowdCount();
  kit.onQuality(setCrowdCount);
  scene.add(crowd);

  const signMat = new THREE.MeshStandardMaterial({ color: 0x164c55, emissive: 0x49e5ff, emissiveIntensity: 3.2, roughness: 0.38, metalness: 0.18 });
  const signBatch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), signMat, 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 8, rand(2.8, 4.7), Math.sin(a) * 8 - 1);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(rand(0.3, 0.75), rand(0.04, 0.08), 0.03);
    dummy.lookAt(0, 2, -1);
    dummy.updateMatrix();
    signBatch.setMatrixAt(i, dummy.matrix);
  }
  scene.add(bakeInstances(signBatch, { dispose: true }));

  // Photographers' flashbulbs: little bright cards in the crowd that pop on big moments.
  const FLASHES = 14;
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const flashBatch = kit.instanced(new THREE.PlaneGeometry(0.16, 0.16), flashMat, FLASHES);
  flashBatch.frustumCulled = false;
  const flashes = [];
  for (let i = 0; i < FLASHES; i++) flashes.push({ fan: 0, t: 0, delay: 0 });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < FLASHES; i++) flashBatch.setMatrixAt(i, zero);
  scene.add(flashBatch);

  // ---- fighters
  function makeFighter(look, { ownGloves = false } = {}) {
    const scale = look.scale;
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const skin = ownMat(look.skin, 0.78);
    const kitMat = ownMat(look.kit, 0.62, 0.05);
    const trim = ownMat(look.trim, 0.56, 0.1);
    const shoe = ownMat(look.shoe, 0.5, 0.08);
    // Gloves get their own materials so one can glow while the other does not (the tell).
    const gloveMats = ownGloves ? [ownMat(look.glove, 0.43, 0.12), ownMat(look.glove, 0.43, 0.12)] : [ownMat(look.glove, 0.43, 0.12)];
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05 * scale, 1.2 * scale, 0.56 * scale), kitMat);
    torso.position.y = 2.1 * scale;
    body.add(torso);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.95 * scale, 0.48 * scale, 0.58 * scale), trim);
    belly.position.y = 1.52 * scale;
    body.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 8, 6), skin);
    head.scale.set(1, 0.95, 0.86);
    head.position.y = 3.05 * scale;
    body.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.13 * scale, 0.13 * scale, 0.18 * scale), skin);
    nose.position.set(0, 3.03 * scale, 0.4 * scale);
    body.add(nose);
    const extras = [];
    if (look.extra === 'mohawk') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.26 * scale, 0.7 * scale), trim);
      crest.position.set(0, 3.42 * scale, -0.04 * scale);
      body.add(crest);
      extras.push(crest);
    } else if (look.extra === 'belt') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.34 * scale, 0.08 * scale), mat(0xffe27a, 0.28, 0.85));
      plate.position.set(0, 1.55 * scale, 0.31 * scale);
      body.add(plate);
      extras.push(plate);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.65 * scale, 2.55 * scale, 0);
      body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.78 * scale, 0.34 * scale), skin);
      upper.position.y = -0.34 * scale;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.7 * scale;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.62 * scale, 0.32 * scale), skin);
      fore.position.y = -0.28 * scale;
      elbow.add(fore);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 7, 5), gloveMats[ownGloves && side > 0 ? 1 : 0]);
      g.scale.set(1.15, 0.9, 1.15);
      g.position.set(0, -0.62 * scale, 0.05 * scale);
      elbow.add(g);
      arms.push({ shoulder, elbow, glove: g, upper, fore });
    }
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.28 * scale, 1.28 * scale, 0);
      body.add(hip);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.95 * scale, 0.4 * scale), skin);
      leg.position.y = -0.45 * scale;
      hip.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 0.25 * scale, 0.64 * scale), shoe);
      foot.position.set(0, -0.98 * scale, 0.1 * scale);
      hip.add(foot);
      legs.push(hip);
    }
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    return { root, body, head, arms, legs, torso, gloveMats, scale, recoil: 0, hit: 0 };
  }

  const player = makeFighter({ skin: 0xbf734e, kit: 0x1369a0, trim: 0xe8e7dc, glove: 0xe02f47, shoe: 0xf0ede5, scale: 0.86 });
  player.root.position.set(0, 0.5, 2.08);
  player.root.rotation.y = Math.PI;
  scene.add(player.root);
  // The player faces away from the camera, so their left arm is the one on screen left (local +x).
  const playerArm = (hand) => (hand < 0 ? player.arms[1] : player.arms[0]);

  const foes = new Map();
  for (const op of OPPONENTS) {
    const f = makeFighter(op.look, { ownGloves: true });
    f.root.position.set(0, 0.5, -1.14);
    f.root.visible = false;
    scene.add(f.root);
    foes.set(op.id, f);
  }
  let foe = foes.get(OPPONENTS[0].id);
  foe.root.visible = true;

  // ---- impact rings
  const impactGeo = new THREE.RingGeometry(0.14, 0.22, 12);
  const impacts = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(impactGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe269 : 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -0.25;
    scene.add(m);
    impacts.push({ m, t: 0 });
  }
  function burst(x, y, z, strong = 1) {
    const q = impacts.find((i) => i.t <= 0) || impacts.reduce((a, b) => (a.t < b.t ? a : b));
    q.t = 0.2;
    q.m.position.set(x, y, z + 0.36);
    q.m.scale.setScalar(0.5 * (0.8 + strong * 0.4));
    q.m.material.opacity = 0.95 * strong;
  }

  // ---- post: bloom keeps the neon signs, the tells and the impacts glowing on every tier
  const post = createPost(kit, scene, camera, { bloom: { strength: 0.45, radius: 0.35, threshold: 0.82 } });

  // ---- animation state
  let shake = 0;
  let pPunch = 0;
  let pSide = 1;
  let pBody = false;
  let special = 0;
  let flurryT = 0;
  let playerDown = false;
  let foeDown = false;
  let zoom = 1;
  let excite = 0;
  let camX = 0;
  let camDrop = 0;
  let camPush = 0;
  let clock = 0;
  const glowColor = new THREE.Color();
  const black = new THREE.Color(0, 0, 0);
  const crowdM = new THREE.Matrix4();
  const crowdQ = new THREE.Quaternion();
  const crowdP = new THREE.Vector3();
  const crowdS = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);

  function popFlashes(count) {
    const n = Math.min(count, FLASHES);
    for (let i = 0, k = 0; i < FLASHES && k < n; i++) {
      const f = flashes[i];
      if (f.t > 0 || f.delay > 0) continue;
      f.fan = Math.floor(Math.random() * crowd.count);
      f.delay = Math.random() * 0.6;
      f.t = 0;
      k++;
    }
  }

  function setOpponent(op) {
    for (const [id, f] of foes) f.root.visible = id === op.id;
    foe = foes.get(op.id);
    rim.color.setHex(op.arena.rim);
    signMat.emissive.setHex(op.arena.sign);
    ropeMat.color.setHex(op.arena.rope);
  }

  function reset() {
    playerDown = foeDown = false;
    pPunch = special = 0;
    shake = 0;
    player.root.position.x = 0;
    player.root.position.z = 2.08;
    player.body.position.set(0, 0, 0);
    player.body.rotation.set(0, 0, 0);
    for (const f of foes.values()) {
      f.body.position.set(0, 0, 0);
      f.body.rotation.set(0, 0, 0);
      f.recoil = 0;
      for (const m of f.gloveMats) m.emissive.copy(black);
    }
  }

  /** React to a fight event (see sim.js). */
  function event(type, d) {
    switch (type) {
      case 'attack':
        shake = Math.max(shake, d.attack.kind === 'haymaker' ? 0.035 : 0.018);
        break;
      case 'slip':
        shake = Math.max(shake, 0.008);
        break;
      case 'punch':
        pPunch = 0.24;
        pSide = d.hand;
        pBody = d.body;
        break;
      case 'blocked':
        foe.recoil = Math.max(foe.recoil, 0.06);
        break;
      case 'hit':
        shake = Math.max(shake, d.guarded ? 0.03 : d.attack.kind === 'haymaker' ? 0.09 : 0.055);
        player.recoil = d.guarded ? 0.12 : 0.28;
        burst(0, 2.5, 2.1, 0.8);
        break;
      case 'land': {
        shake = Math.max(shake, d.counter ? 0.08 : 0.035);
        foe.recoil = d.counter ? 0.42 : 0.2;
        const s = foe.scale;
        burst(d.hand * 0.27, d.body ? 1.6 * s + 0.1 : 2.6 * s, -0.72, d.counter ? 1 : 0.8);
        if (d.counter) {
          excite = Math.min(1, excite + 0.35);
          popFlashes(3);
        }
        break;
      }
      case 'rush':
        special = 0.7;
        flurryT = 0;
        shake = Math.max(shake, 0.03);
        break;
      case 'foeDown':
        foeDown = true;
        excite = 1;
        popFlashes(d.final ? 14 : 9);
        break;
      case 'foeRise':
        foeDown = false;
        break;
      case 'playerDown':
        playerDown = true;
        excite = Math.max(excite, 0.6);
        popFlashes(5);
        break;
      case 'playerRise':
        playerDown = false;
        break;
      case 'end':
        if (d.result.win) {
          excite = 1;
          popFlashes(14);
        }
        break;
    }
  }

  /**
   * Pose everything for this frame.
   * @param {number} dt  seconds (0 while paused: the pose holds)
   * @param {object|null} s  the fight state, or null on the title screens
   */
  function update(dt, s) {
    clock += dt;
    const t = clock;
    const k22 = ease(14.9, dt);
    const k20 = ease(13.4, dt);
    const k16 = ease(10.5, dt);
    const k18 = ease(11.9, dt);
    const k23 = ease(15.7, dt);
    excite = Math.max(0, excite - dt * 0.35);

    // Crowd: a gentle bob, and a jump when something big happens (held still while paused).
    const amp = 0.02 * (1 + excite * 3);
    for (let i = 0; i < (dt > 0 ? crowd.count : 0); i++) {
      const f = fans[i];
      const jump = excite > 0.05 ? Math.abs(Math.sin(t * 8 * f.hype + f.phase)) * 0.28 * excite * f.hype : 0;
      crowdP.set(f.x, f.y + Math.sin(t * 2.6 + f.phase) * amp + jump, f.z);
      crowdQ.setFromAxisAngle(yAxis, f.rot);
      crowdM.compose(crowdP, crowdQ, crowdS);
      crowd.setMatrixAt(i, crowdM);
    }
    // Only the live fans go to the GPU (the batch is allocated large so it shares shaders).
    if (dt > 0) {
      crowd.instanceMatrix.clearUpdateRanges();
      crowd.instanceMatrix.addUpdateRange(0, crowd.count * 16);
      crowd.instanceMatrix.needsUpdate = true;
    }

    let flashDirty = false;
    for (let i = 0; i < FLASHES; i++) {
      const f = flashes[i];
      if (f.delay > 0) {
        f.delay -= dt;
        if (f.delay <= 0) f.t = 0.16;
        continue;
      }
      if (f.t > 0) {
        f.t = Math.max(0, f.t - dt);
        const fan = fans[f.fan];
        const sc = f.t > 0 ? (f.t / 0.16) * 1.6 : 0;
        crowdP.set(fan.x * 0.97, fan.y + 0.3, fan.z * 0.97);
        crowdQ.setFromAxisAngle(yAxis, fan.rot);
        crowdS.setScalar(sc);
        crowdM.compose(crowdP, crowdQ, crowdS);
        crowdS.setScalar(1);
        flashBatch.setMatrixAt(i, crowdM);
        flashDirty = true;
      }
    }
    if (flashDirty) {
      flashBatch.instanceMatrix.clearUpdateRanges();
      flashBatch.instanceMatrix.addUpdateRange(0, FLASHES * 16);
      flashBatch.instanceMatrix.needsUpdate = true;
    }

    for (const q of impacts) {
      if (q.t > 0) {
        q.t -= dt;
        q.m.scale.multiplyScalar(Math.pow(1.12, dt * 60));
        q.m.material.opacity = Math.max(0, q.t * 4.2);
      }
    }

    // ---- player
    const fight = s && (s.mode === 'fight' || s.mode === 'foeDown' || s.mode === 'playerDown' || s.mode === 'corner');
    const dodgeT = fight ? s.dodgeT : 0;
    const duckT = fight ? s.duckT : 0;
    const guard = fight && s.guard;
    const dodgeX = dodgeT > 0 ? s.dodgeDir * 0.7 : 0;
    const bob = Math.sin(t * 5.6 + 1) * 0.025;
    player.root.position.x = lerp(player.root.position.x, dodgeX, k22);
    player.root.position.z = lerp(player.root.position.z, special > 0.25 ? 1.6 : 2.08, k20);
    player.body.rotation.z = lerp(player.body.rotation.z, dodgeT > 0 ? -dodgeX * 0.28 : 0, k20);
    player.body.position.y = lerp(player.body.position.y, duckT > 0 ? -0.64 : playerDown ? -1.2 : bob, k22);
    player.recoil = Math.max(0, player.recoil - dt * 1.6);
    player.body.rotation.x = lerp(player.body.rotation.x, playerDown ? -0.5 : -player.recoil, k20);
    if (special > 0) {
      flurryT -= dt;
      if (flurryT <= 0) {
        flurryT = 0.09;
        pSide = -pSide;
        pPunch = 0.12;
        pBody = false;
      }
    }
    for (const hand of HANDS) {
      const arm = playerArm(hand);
      const punching = pPunch > 0 && pSide === hand;
      const target = guard ? -1.15 : punching ? (pBody ? -1.55 : -2.05) : -0.35;
      arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, target, k22);
      // arms[0] sits on local -x; its guard tuck is +z (the original values per arm index).
      const tuck = arm === player.arms[0] ? 1 : -1;
      arm.shoulder.rotation.z = lerp(arm.shoulder.rotation.z, (guard ? 0.35 : 0.12) * tuck, k20);
    }
    pPunch = Math.max(0, pPunch - dt * 1.08);
    special = Math.max(0, special - dt * 0.96);

    // ---- opponent
    const fm = s ? s.foe.mode : 'idle';
    const a = s?.foe.attack;
    const kind = a?.kind || 'straight';
    const side = s ? s.foe.side : 0;
    const stun = fm === 'stun';
    const fbob = fm === 'idle' || fm === 'recover' ? Math.sin(t * 5.2) * 0.035 : 0;
    let dip = 0;
    if (fm === 'tell' && kind === 'upper') dip = -0.15;
    if (fm === 'tell' && kind === 'haymaker') dip = -0.08;
    foe.body.position.y = lerp(foe.body.position.y, foeDown ? -1.45 : stun ? 0.12 : fbob + dip, k16);
    foe.body.rotation.z = lerp(foe.body.rotation.z, foeDown ? 1.25 : stun ? Math.sin(t * 34) * 0.12 : 0, k20);
    foe.recoil = Math.max(0, foe.recoil - dt * 1.5);
    foe.body.rotation.x = lerp(foe.body.rotation.x, -foe.recoil, ease(22, dt));
    const attackArm = side < 0 ? 0 : 1;
    const other = 1 - attackArm;
    let punchRot = -1.08;
    let otherRot = -1.02;
    let punchZ = 0;
    let twist = 0;
    if (fm === 'tell') {
      otherRot = -1.18;
      if (kind === 'hook') {
        punchRot = -0.9;
        punchZ = side * 0.7;
        twist = side * 0.3;
      } else if (kind === 'upper') {
        punchRot = 0.15;
      } else if (kind === 'haymaker') {
        punchRot = 0.35;
        punchZ = side * 1.0;
        twist = side * 0.55;
      } else {
        punchRot = -0.58;
        twist = side * 0.18;
      }
    } else if (fm === 'active') {
      otherRot = -1.12;
      if (kind === 'hook') {
        punchRot = -1.6;
        punchZ = -side * 0.4;
        twist = -side * 0.3;
      } else if (kind === 'upper') punchRot = -2.6;
      else if (kind === 'haymaker') {
        punchRot = -1.7;
        punchZ = -side * 0.5;
        twist = -side * 0.5;
      } else punchRot = -2.05;
    } else if (fm === 'recover') {
      punchRot = s.foe.blockT > 0 ? -1.18 : -0.38;
      otherRot = s.foe.blockT > 0 ? -1.18 : -0.44;
    } else if (stun) {
      punchRot = otherRot = -0.22;
    } else if (fm === 'down') {
      punchRot = otherRot = -0.3;
    }
    foe.arms[attackArm].shoulder.rotation.x = lerp(foe.arms[attackArm].shoulder.rotation.x, punchRot, k23);
    foe.arms[attackArm].shoulder.rotation.z = lerp(foe.arms[attackArm].shoulder.rotation.z, punchZ, k20);
    foe.arms[other].shoulder.rotation.x = lerp(foe.arms[other].shoulder.rotation.x, otherRot, k18);
    foe.arms[other].shoulder.rotation.z = lerp(foe.arms[other].shoulder.rotation.z, 0, k18);
    foe.body.rotation.y = lerp(foe.body.rotation.y, twist, k16);

    // The tell glows on the attacking glove, brightest in the counter window.
    for (let i = 0; i < 2; i++) {
      const m = foe.gloveMats[i];
      if (fm === 'tell' && i === attackArm && a) {
        const prog = 1 - s.foe.t / a.tell;
        const inWindow = s.foe.t < a.window;
        glowColor.setHex(TELL_GLOW[kind] || TELL_GLOW.straight);
        m.emissive.copy(glowColor);
        m.emissiveIntensity = inWindow ? 2.6 + Math.sin(t * 40) * 0.6 : prog * 1.2;
      } else if (m.emissiveIntensity !== 0) {
        m.emissiveIntensity = Math.max(0, m.emissiveIntensity - dt * 12);
      }
    }

    // ---- camera: behind the player, easing with the slip, pushing in on knockdowns
    const menu = !s || s.mode === 'ready' || s.mode === 'result';
    const z = 7.45 * zoom;
    const camXTarget = menu ? Math.sin(t * 0.22) * 1.3 : player.root.position.x * 0.25;
    camX = lerp(camX, camXTarget, ease(menu ? 1.5 : 6, dt));
    camDrop = lerp(camDrop, playerDown ? 1 : 0, ease(4, dt));
    camPush = lerp(camPush, foeDown ? 1 : 0, ease(3, dt));
    shake *= Math.exp(-11.9 * dt);
    const sx = shake > 0.001 && dt > 0 ? rand(-shake, shake) : 0;
    const sy = shake > 0.001 && dt > 0 ? rand(-shake, shake) : 0;
    camera.position.set(camX + sx, 3.2 + sy - camDrop * 0.9, z - camPush * 0.9);
    camera.lookAt(camX * 0.4, 2.12 - camDrop * 0.2 - camPush * 0.5, -1.05);
  }

  return {
    scene,
    camera,
    post,
    setOpponent,
    reset,
    event,
    update,
    setZoom(z) {
      zoom = z;
    },
    get zoom() {
      return zoom;
    },
    render() {
      post.render();
    },
  };
}
