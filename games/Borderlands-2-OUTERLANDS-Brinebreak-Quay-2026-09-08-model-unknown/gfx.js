// OUTERLANDS: the three.js side. Replaces the original hand-written WebGL renderer.
//
// Look: the original shaded every face in four hard bands from one fixed light
// direction, tinted cool in the dark bands and warm in the lit ones, with ink edge
// lines, faint scratches on shaded walls and a distance fog. That is reproduced with a
// MeshToonNodeMaterial (a 4-step gradient ramp; ambient = the darkest band, the sun adds
// the warm difference) so it also receives real shadow maps, which replace the old
// projected shadow polygons and enemy blob shadows. Colours are written without
// sRGB conversion, as the original did.
import * as THREE from 'three/webgpu';
import { Fn, vec2, vec3, float, uniform, texture, normalize, dot, mix, smoothstep, pow, clamp, max, abs, fract, step, select, positionWorld, cameraPosition, positionView, normalWorld, vertexColor, fog, color as tslColor } from 'three/tsl';
import { C, TAU, lerp } from './util.js';
import * as art from './art.js';

const LIGHT_DIR = new THREE.Vector3(-0.65, 0.95, 0.45).normalize();
// Band colours of the original ramp: base (darkest band) and the warm lit increment.
const AMBIENT = [0.58, 0.655, 0.655];
const SUN = [0.42, 0.325, 0.215];
const FOG = [0.65, 0.79, 0.76];

function triGeo(b) {
  const n = b.v.length / 9;
  if (!n) return null;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0, j = 0; i < b.v.length; i += 9, j += 3) {
    pos[j] = b.v[i];
    pos[j + 1] = b.v[i + 1];
    pos[j + 2] = b.v[i + 2];
    nor[j] = b.v[i + 3];
    nor[j + 1] = b.v[i + 4];
    nor[j + 2] = b.v[i + 5];
    col[j] = b.v[i + 6];
    col[j + 1] = b.v[i + 7];
    col[j + 2] = b.v[i + 8];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

function lineGeo(b) {
  const n = b.l.length / 9;
  if (!n) return null;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0, j = 0; i < b.l.length; i += 9, j += 3) {
    pos[j] = b.l[i];
    pos[j + 1] = b.l[i + 1];
    pos[j + 2] = b.l[i + 2];
    col[j] = b.l[i + 6];
    col[j + 1] = b.l[i + 7];
    col[j + 2] = b.l[i + 8];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

/** Objects created on demand and reused frame to frame (no per-frame allocation). */
class Pool {
  constructor(parent, make) {
    this.parent = parent;
    this.make = make;
    this.items = [];
    this.n = 0;
  }
  begin() {
    this.n = 0;
  }
  next() {
    let it = this.items[this.n];
    if (!it) {
      it = this.make();
      this.items.push(it);
      this.parent.add(it.group);
    }
    it.group.visible = true;
    this.n++;
    return it;
  }
  end() {
    for (let i = this.n; i < this.items.length; i++) this.items[i].group.visible = false;
  }
}

/** One LineSegments rewritten every frame: tracers, rings, arcs, hazards, beacons, snow. */
class LineWriter {
  constructor(parent, max, material) {
    this.max = max;
    this.n = 0;
    this.last = -1;
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 6);
    const g = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa);
    g.setAttribute('color', this.ca);
    g.setDrawRange(0, 0);
    this.object = new THREE.LineSegments(g, material);
    this.object.frustumCulled = false;
    parent.add(this.object);
  }
  begin() {
    this.n = 0;
  }
  seg(ax, ay, az, bx, by, bz, c) {
    if (this.n >= this.max) return;
    const i = this.n++ * 6;
    const p = this.pos;
    const q = this.col;
    p[i] = ax;
    p[i + 1] = ay;
    p[i + 2] = az;
    p[i + 3] = bx;
    p[i + 4] = by;
    p[i + 5] = bz;
    q[i] = q[i + 3] = c[0];
    q[i + 1] = q[i + 4] = c[1];
    q[i + 2] = q[i + 5] = c[2];
  }
  line(a, b, c) {
    this.seg(a[0], a[1], a[2], b[0], b[1], b[2], c);
  }
  ring(x, y, z, r, c, n = 36) {
    let px = x + r;
    let pz = z;
    for (let i = 1; i <= n; i++) {
      const a = (i * TAU) / n;
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      this.seg(px, y, pz, nx, y, nz, c);
      px = nx;
      pz = nz;
    }
  }
  end() {
    this.object.geometry.setDrawRange(0, this.n * 2);
    if (this.n || this.last) {
      this.pa.needsUpdate = true;
      this.ca.needsUpdate = true;
    }
    this.last = this.n;
  }
}

export function createGraphics(kit, world, skyGrid) {
  const renderer = kit.renderer;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color(FOG[0], FOG[1], FOG[2]), 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Distance fog on true eye distance, like the original (three's range fog uses view depth).
  scene.fogNode = fog(tslColor(new THREE.Color(FOG[0], FOG[1], FOG[2])), smoothstep(45, 195, positionView.length()));
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(90, 1, 0.06, 330));
  camera.rotation.order = 'YXZ';

  // ---- materials
  const rampData = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const d = ((i + 0.5) / 256) * 2 - 1;
    const g = d > 0.65 ? 1 : d > 0.15 ? 0.68 : d > -0.3 ? 0.3 : 0;
    const v = Math.round(g * 255);
    rampData[i * 4] = rampData[i * 4 + 1] = rampData[i * 4 + 2] = v;
    rampData[i * 4 + 3] = 255;
  }
  const ramp = new THREE.DataTexture(rampData, 256, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;

  const L = vec3(LIGHT_DIR.x, LIGHT_DIR.y, LIGHT_DIR.z);
  const vc = vertexColor().rgb;
  const dL = dot(normalWorld, L);
  const band = select(dL.greaterThan(0.65), float(1), select(dL.greaterThan(0.15), float(0.84), select(dL.greaterThan(-0.3), float(0.64), float(0.48))));
  const scratch = step(0.965, fract(positionWorld.y.mul(7.3).add(positionWorld.x.mul(4.7)).add(positionWorld.z.mul(5.2))));
  const sideFace = float(1).sub(step(0.65, abs(normalWorld.y)));
  const scratched = vc.mul(float(1).sub(scratch.mul(sideFace).mul(float(1).sub(band)).mul(0.35)));
  const FLASH = vec3(1, 0.94, 0.64);
  const weaponFlash = uniform(0);

  const toon = (colorNode) => {
    const m = new THREE.MeshToonNodeMaterial({ gradientMap: ramp, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    m.colorNode = colorNode;
    return m;
  };
  const mat = {
    toon: toon(scratched),
    toonFlash: toon(mix(vc, FLASH, 0.6)), // enemy hit flash
    weapon: toon(mix(vc, FLASH, weaponFlash)),
    flat: new THREE.MeshBasicNodeMaterial({ vertexColors: true }),
    line: new THREE.LineBasicNodeMaterial({ vertexColors: true }),
    weaponLine: new THREE.LineBasicNodeMaterial({ vertexColors: true, fog: false }),
    particle: new THREE.MeshBasicNodeMaterial(),
  };

  // ---- lights and shadows
  const ambient = new THREE.AmbientLight(new THREE.Color(AMBIENT[0], AMBIENT[1], AMBIENT[2]), Math.PI);
  const sun = new THREE.DirectionalLight(new THREE.Color(SUN[0], SUN[1], SUN[2]), Math.PI);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  const R = 46;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 250 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  sun.shadow.intensity = 0.62; // shadows as light as the original's painted ones
  scene.add(ambient, sun, sun.target);
  const sRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), LIGHT_DIR).normalize();
  const sUp = new THREE.Vector3().crossVectors(LIGHT_DIR, sRight);
  const sTmp = new THREE.Vector3();
  /** Centre the shadow map on (cx, cz), snapped to whole texels so edges do not crawl. */
  function placeSun(cx, cz) {
    sTmp.set(cx, 0, cz);
    const texel = (2 * R) / sun.shadow.mapSize.x;
    const u = Math.round(sTmp.dot(sRight) / texel) * texel;
    const v = Math.round(sTmp.dot(sUp) / texel) * texel;
    const w = sTmp.dot(LIGHT_DIR);
    sun.target.position.copy(sRight).multiplyScalar(u).addScaledVector(sUp, v).addScaledVector(LIGHT_DIR, w);
    sun.position.copy(sun.target.position).addScaledVector(LIGHT_DIR, 120);
  }
  placeSun(0, 18);

  // ---- sky: the original ray-traced gradient, value-noise clouds, sun and moon, in TSL
  const noiseData = new Uint8Array(256 * 256 * 4);
  {
    const sample = (x, y) => skyGrid[(y & 15) * 16 + (x & 15)];
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const xx = x / 16;
        const yy = y / 16;
        const ix = Math.floor(xx);
        const iy = Math.floor(yy);
        let fx = xx - ix;
        let fy = yy - iy;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        const v = lerp(lerp(sample(ix, iy), sample(ix + 1, iy), fx), lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), fx), fy) * 255;
        const j = (y * 256 + x) * 4;
        noiseData[j] = noiseData[j + 1] = noiseData[j + 2] = v;
        noiseData[j + 3] = 255;
      }
  }
  const noiseTex = new THREE.DataTexture(noiseData, 256, 256);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.minFilter = noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.generateMipmaps = false;
  noiseTex.needsUpdate = true;
  const skyTime = uniform(0);
  const noise = (p) => texture(noiseTex, p.mul(0.065)).r;
  const skyColor = Fn(() => {
    const ray = normalize(positionWorld.sub(cameraPosition)).toVar();
    const h = clamp(ray.y, 0.0001, 1);
    const c = mix(vec3(0.71, 0.82, 0.75), vec3(0.22, 0.46, 0.54), pow(h, 0.52)).toVar();
    const uvp = ray.xz.div(abs(ray.y).add(0.17)).mul(1.35).add(vec2(skyTime.mul(0.003), 0)).toVar();
    const n = noise(uvp).add(noise(uvp.mul(2.8)).mul(0.45)).add(noise(uvp.mul(6)).mul(0.2));
    const cloud = smoothstep(0.84, 1.16, n).mul(smoothstep(0.03, 0.32, ray.y));
    c.assign(mix(c, vec3(0.87, 0.89, 0.76), cloud.mul(0.56)));
    const sunDot = dot(ray, vec3(-0.6, 0.6, -1).normalize()).toVar();
    c.addAssign(vec3(0.3, 0.25, 0.12).mul(pow(max(sunDot, 0.0001), 55)));
    c.assign(mix(c, vec3(1, 0.96, 0.73), smoothstep(0.9963, 0.997, sunDot)));
    const moon = dot(ray, vec3(0.78, 0.53, -1.2).normalize()).toVar();
    const mm = smoothstep(0.9914, 0.9918, moon);
    const moonCol = vec3(0.79, 0.85, 0.74).mul(noise(ray.xz.mul(98)).mul(0.15).add(0.85));
    c.assign(mix(c, moonCol, mm.mul(0.79)));
    c.subAssign(vec3(0.025).mul(smoothstep(0.991, 0.992, moon).mul(float(1).sub(smoothstep(0.992, 0.993, moon)))));
    return c;
  });
  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMat.colorNode = skyColor();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // ---- static world
  const addStatic = (b, material, cast, receive, lines = true) => {
    const tg = triGeo(b);
    if (tg) {
      const m = new THREE.Mesh(tg, material);
      m.castShadow = cast;
      m.receiveShadow = receive;
      m.matrixAutoUpdate = false;
      scene.add(m);
    }
    if (lines) {
      const lg = lineGeo(b);
      if (lg) {
        const l = new THREE.LineSegments(lg, mat.line);
        l.matrixAutoUpdate = false;
        scene.add(l);
      }
    }
  };
  addStatic(world.groundB, mat.toon, false, true);
  addStatic(world.rockB, mat.toon, true, true);
  addStatic(world.staticB, mat.toon, true, true);
  addStatic(world.detailB, mat.toon, false, false);
  for (const s of world.signs) {
    const tex = new THREE.CanvasTexture(s.canvas);
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicNodeMaterial({ map: tex }));
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.ry;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    scene.add(m);
  }

  // ---- prototypes shared by every copy (one geometry, one material each)
  const proto = (b, material, opts = {}) => ({ tg: triGeo(b), lg: opts.lines === false ? null : lineGeo(b), material, opts });
  const instance = (p) => {
    const group = new THREE.Group();
    let mesh = null;
    if (p.tg) {
      mesh = new THREE.Mesh(p.tg, p.material);
      mesh.castShadow = !!p.opts.cast;
      mesh.receiveShadow = !!p.opts.receive;
      group.add(mesh);
    }
    if (p.lg) group.add(new THREE.LineSegments(p.lg, p.opts.lineMat || mat.line));
    return { group, mesh };
  };
  const sparkP = proto(art.orbArt(C.yellow), mat.flat, { lines: false });
  const blueOrbP = proto(art.orbArt(C.blue), mat.flat, { lines: false });
  const redOrbP = proto(art.orbArt(C.red), mat.flat, { lines: false });

  const barrelP = proto(art.barrelArt(), mat.toon, { cast: true, receive: true });
  const barrels = world.barrels.map((b) => {
    const it = instance(barrelP);
    it.group.position.set(b.x, 0, b.z);
    scene.add(it.group);
    return it.group;
  });
  const glowP = proto(art.relayGlowArt(), mat.flat, { lines: false });
  const relayGlow = [];
  const relaySpark = [];
  for (const r of world.relays) {
    const g = instance(glowP).group;
    g.position.set(r.x, 1.85, r.z + 0.76);
    const s = instance(sparkP).group;
    s.position.set(r.x, 2.97, r.z);
    s.scale.setScalar(0.11);
    scene.add(g, s);
    relayGlow.push(g);
    relaySpark.push(s);
  }
  const supplyOrbs = world.supplySpots.map((sp) => {
    const g = instance(blueOrbP).group;
    g.position.set(sp.x, 1.8, sp.z);
    g.scale.setScalar(0.11);
    scene.add(g);
    return g;
  });

  // ---- enemies: body, two legs and a muzzle spark per figure
  const enemyP = {};
  for (const kind of ['raider', 'gunner', 'boss', 'lobber', 'badass']) {
    const a = art.enemyArt(kind);
    enemyP[kind] = { body: proto(a.body, mat.toon, { cast: true }), leg: proto(a.leg, mat.toon, { cast: true }), muzzleZ: kind === 'boss' ? 1.8 : kind === 'lobber' ? 1.45 : 1.5 };
  }
  const makeEnemy = (kind) => {
    const p = enemyP[kind];
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    const body = instance(p.body);
    const legL = instance(p.leg);
    const legR = instance(p.leg);
    const muzzle = instance(sparkP);
    muzzle.group.position.set(0.48, 1.3, p.muzzleZ);
    muzzle.group.scale.set(0.25, 0.19, 0.32);
    group.add(body.group, legL.group, legR.group, muzzle.group);
    return { group, body: body.group, bodyMesh: body.mesh, legL: legL.group, legR: legR.group, muzzle: muzzle.group };
  };
  const enemyPools = {};
  for (const kind of Object.keys(enemyP)) enemyPools[kind] = new Pool(scene, () => makeEnemy(kind));
  const stunPool = new Pool(scene, () => {
    const it = instance(blueOrbP);
    it.group.scale.set(0.1, 0.25, 0.1);
    return it;
  });

  const lootPools = {};
  for (const type of art.LOOT_TYPES) {
    const p = proto(art.lootArt(type), mat.toon, { receive: true });
    lootPools[type] = new Pool(scene, () => instance(p));
  }
  const boltPool = new Pool(scene, () => {
    const it = instance(redOrbP);
    it.group.scale.setScalar(0.09);
    return it;
  });
  const lobPool = new Pool(scene, () => {
    const it = instance(blueOrbP);
    it.group.scale.setScalar(0.2);
    return it;
  });
  const grenadeP = proto(art.grenadeArt(), mat.toon, { cast: true });
  const grenadePool = new Pool(scene, () => {
    const it = instance(grenadeP);
    it.group.rotation.order = 'YXZ';
    return it;
  });

  // ---- particles (sparks, debris) as one instanced draw
  const MAXP = 220;
  const particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat.particle, MAXP);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.frustumCulled = false;
  {
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAXP; i++) particleMesh.setColorAt(i, white);
    particleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  particleMesh.count = 0;
  scene.add(particleMesh);
  const pm = new THREE.Matrix4();
  const pc = new THREE.Color();
  const particles = {
    max: MAXP,
    set(i, x, y, z, s, col) {
      pm.makeScale(s, s, s);
      pm.setPosition(x, y, z);
      particleMesh.setMatrixAt(i, pm);
      pc.setRGB(col[0], col[1], col[2]);
      particleMesh.setColorAt(i, pc);
    },
    end(n) {
      particleMesh.count = n;
      if (n) {
        particleMesh.instanceMatrix.needsUpdate = true;
        particleMesh.instanceColor.needsUpdate = true;
      }
    },
  };

  const lines = new LineWriter(scene, 4000, mat.line);

  // ---- first-person weapon, drawn in its own pass over a cleared depth buffer
  const weaponScene = new THREE.Scene();
  weaponScene.add(new THREE.AmbientLight(new THREE.Color(AMBIENT[0], AMBIENT[1], AMBIENT[2]), Math.PI));
  const wsun = new THREE.DirectionalLight(new THREE.Color(SUN[0], SUN[1], SUN[2]), Math.PI);
  wsun.position.copy(LIGHT_DIR);
  weaponScene.add(wsun);
  const weaponCam = kit.fitCamera(new THREE.PerspectiveCamera(70, 1, 0.025, 15));
  const wp = (b) => instance(proto(b, mat.weapon, { lineMat: mat.weaponLine })).group;
  const guns = {
    rifle: wp(art.weaponArt('rifle', C.orange)),
    shotgun: wp(art.weaponArt('shotgun', C.paper)),
    pistol: wp(art.weaponArt('pistol', C.blue)),
    legend: wp(art.weaponArt('rifle', C.yellow)),
    legendShotgun: wp(art.weaponArt('shotgun', C.yellow)),
  };
  for (const g of Object.values(guns)) {
    g.rotation.order = 'YXZ';
    g.visible = false;
    weaponScene.add(g);
  }
  const arms = [wp(art.armArt()), wp(art.armArt())];
  for (const a of arms) {
    a.rotation.order = 'YXZ';
    weaponScene.add(a);
  }
  arms[1].scale.setScalar(0.86);

  function render(showWeapon) {
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    if (showWeapon) {
      renderer.autoClearColor = false;
      renderer.render(weaponScene, weaponCam);
      renderer.autoClearColor = true;
    }
  }

  /** Build pipelines up front (including ones first seen mid-fight) so nothing stutters. */
  async function prewarm() {
    const pools = [...Object.values(enemyPools), stunPool, ...Object.values(lootPools), boltPool, lobPool, grenadePool];
    let k = 0;
    for (const p of pools) {
      p.begin();
      const it = p.next();
      it.group.position.set(-3 + (k++ % 8), 2, 30);
      p.end();
    }
    const flashing = enemyPools.raider.items[0];
    if (flashing?.bodyMesh) flashing.bodyMesh.material = mat.toonFlash;
    particles.set(0, 0, 3, 30, 0.2, C.yellow);
    particles.end(1);
    lines.begin();
    lines.seg(0, 2, 30, 1, 2, 30, C.blue);
    lines.end();
    for (const g of Object.values(guns)) g.visible = true;
    camera.position.set(5, 4.6, 43);
    camera.lookAt(-2, 5.2, -24);
    camera.updateMatrixWorld();
    try {
      await renderer.compileAsync(scene, camera);
      await renderer.compileAsync(weaponScene, weaponCam);
    } catch (err) {
      console.warn('Outerlands: pipeline prewarm skipped', err);
    }
    if (flashing?.bodyMesh) flashing.bodyMesh.material = mat.toon;
    for (const p of pools) {
      p.begin();
      p.end();
    }
    for (const g of Object.values(guns)) g.visible = false;
    particles.end(0);
    lines.begin();
    lines.end();
  }

  return {
    scene,
    camera,
    weaponScene,
    weaponCam,
    mat,
    skyTime,
    weaponFlash,
    placeSun,
    render,
    prewarm,
    barrels,
    relayGlow,
    relaySpark,
    supplyOrbs,
    enemyPools,
    stunPool,
    lootPools,
    boltPool,
    lobPool,
    grenadePool,
    particles,
    lines,
    guns,
    arms,
  };
}
