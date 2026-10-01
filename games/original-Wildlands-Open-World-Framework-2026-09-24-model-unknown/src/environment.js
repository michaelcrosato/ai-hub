// environment.js — sky, atmospheric haze, the sun and moon with cascaded shadows,
// clouds and the torch; the water plane; and the camp at the start.
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec3, vec4, positionLocal, positionWorld, normalize, max, pow, mix, dot, smoothstep, step, fract, floor, sin, cos, cameraViewMatrix, materialColor } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { hash2, smooth } from './worldgen.js';

const SKY_TOP_NIGHT = new THREE.Color(0x102443);
const SKY_TOP_DAY = new THREE.Color(0x649bb8);
const HORIZON_NIGHT = new THREE.Color(0x223447);
const HORIZON_DAY = new THREE.Color(0xd0d8c5);
const HORIZON_GOLD = new THREE.Color(0xe3bb8e);
const SUN_DAY = new THREE.Color(0xfff1d0);
const SUN_GOLD = new THREE.Color(0xffc889);
const MOON = new THREE.Color(0x9bbbe1);
const FORWARD = new THREE.Vector3(0, 0, -1);

/** The old GLSL star hash, in TSL. */
const starHash = Fn(([p]) => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453)));

/** Sky, haze, sun and moon light with three shadow cascades, clouds and the torch. */
export class EnvironmentSystem {
  constructor(kit, scene, camera, view) {
    this.kit = kit; this.scene = scene; this.camera = camera; this.view = view;
    this.hours = 15.8; this.cycle = false; this.clock = 0; this.lastClouds = -Infinity; this.daylight = 1;
    this.sunDirection = new THREE.Vector3(); this.lightDirection = new THREE.Vector3(); this.torchDirection = new THREE.Vector3();
    this.skyTop = new THREE.Color(); this.horizon = new THREE.Color(); this.sunColor = new THREE.Color();
    scene.fog = new THREE.Fog(0xc3cfc0, view.distance * 0.21, view.distance * 0.98);
    this.ambient = new THREE.HemisphereLight(0xd7e7f2, 0x525236, 1.65); scene.add(this.ambient);

    // One sun (or moon) light. CSMShadowNode splits its shadow into three cascades that
    // follow the camera: 120 m and 650 m splits, then out to the view's shadow range.
    this.sun = new THREE.DirectionalLight(0xfff1d0, 3.4);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.camera.near = 1; sh.camera.far = 9000;
    sh.bias = -0.000008; sh.normalBias = 0.65; sh.radius = 2;
    sh.mapSize.setScalar(kit.shadowSize(2048));
    this.csm = new CSMShadowNode(this.sun, {
      cascades: 3, maxFar: view.shadowFar, mode: 'custom', lightMargin: 1800,
      customSplitsCallback: (cascades, near, far, out) => { out.push(Math.min(120 / far, 0.15), Math.min(650 / far, 0.58), 1); },
    });
    this.csm.fade = true;
    sh.shadowNode = this.csm;
    scene.add(this.sun, this.sun.target);
    kit.onQuality(() => this.applyShadowSize());

    // The sky dome: gradient, sun disc and glow, moon and stars (the old sky shader in TSL).
    this.uTop = uniform(new THREE.Color(0x5d93b0));
    this.uHorizon = uniform(new THREE.Color(0xd9d9bc));
    this.uSun = uniform(new THREE.Vector3(0, 1, 0));
    this.uDay = uniform(1);
    const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
    skyMaterial.name = 'sky';
    skyMaterial.colorNode = Fn(() => {
      const d = normalize(positionLocal);
      const h = max(d.y, 0.0);
      const col = mix(this.uHorizon, this.uTop, pow(h, 0.5)).toVar();
      const sun = max(0.0, dot(d, this.uSun));
      col.addAssign(vec3(1.0, 0.74, 0.38).mul(pow(sun, 14.0)).mul(0.13).mul(this.uDay));
      col.assign(mix(col, vec3(1.0, 0.94, 0.73), smoothstep(0.99968, 0.99983, sun).mul(this.uDay)));
      const cell = floor(d.mul(850.0));
      const stars = step(0.998, starHash(cell)).mul(pow(starHash(cell.add(4.0)), 6.0));
      col.addAssign(vec3(stars.mul(this.uDay.oneMinus()).mul(smoothstep(0.0, 0.25, d.y)).mul(0.9)));
      const moon = max(0.0, dot(d, this.uSun.negate()));
      col.addAssign(vec3(0.7, 0.83, 1.0).mul(smoothstep(0.99945, 0.99965, moon)).mul(this.uDay.oneMinus()).mul(0.65));
      return vec4(col, 1.0);
    })();
    this.skyMaterial = skyMaterial;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skyMaterial);
    this.sky.name = 'sky'; this.sky.frustumCulled = false; this.sky.renderOrder = -1000; this.sky.scale.setScalar(1500);
    scene.add(this.sky);

    // A low-poly cloud field. The clouds are opaque solids and can cast shadows.
    this.cloudGeo = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf0eee1, roughness: 1, flatShading: true });
    this.clouds = new THREE.InstancedMesh(this.cloudGeo, this.cloudMaterial, 84);
    this.clouds.name = 'clouds'; this.clouds.castShadow = true; this.clouds.receiveShadow = true; this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.cloudObject = new THREE.Object3D();

    // The torch stays in the scene with its shadow decided at load: switching it on and
    // off changes its intensity and whether its shadow map renders, never castShadow or
    // visibility (either would rebuild every material). Sized once: an on-demand shadow
    // map must keep its size on WebGPU.
    this.torchOn = false;
    this.torch = new THREE.SpotLight(0xffe4ae, 0, 130, Math.PI / 5, 0.65, 1.65);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.setScalar(kit.shadowSize(1024));
    this.torch.shadow.bias = -0.0002; this.torch.shadow.normalBias = 0.03; this.torch.shadow.camera.near = 0.3;
    this.torch.shadow.autoUpdate = false; this.torch.shadow.needsUpdate = true; // drawn once at load, then only while lit
    scene.add(this.torch, this.torch.target);
    this.update(0, { x: 0, z: 0 }, true);
  }
  /** Shadow maps follow the kit's quality tier (2048 at high). */
  applyShadowSize() {
    const size = this.kit.shadowSize(2048);
    this.sun.shadow.mapSize.setScalar(size);
    for (const light of this.csm.lights) light.shadow.mapSize.setScalar(size);
  }
  /** Cascades are fitted to the camera frustum; they exist after the first render. */
  refreshCascades() { if (this.csm.camera) this.csm.updateFrustums(); }
  setView(view) {
    this.view = view; this.csm.maxFar = view.shadowFar; this.refreshCascades();
    this.scene.fog.near = view.distance * 0.21; this.scene.fog.far = view.distance * 0.98;
  }
  updateClouds(origin) {
    const cam = this.camera.position, cx = Math.floor((cam.x + origin.x) / 4096) * 4096, cz = Math.floor((cam.z + origin.z) / 4096) * 4096;
    const o = this.cloudObject;
    for (let i = 0; i < 84; i++) {
      const group = Math.floor(i / 3), part = i % 3;
      const x = cx + (hash2(group, 11, 9) - 0.5) * 15000 + part * 160;
      const z = cz + (hash2(group, 23, 9) - 0.5) * 15000;
      const y = 1800 + hash2(group, 43, 9) * 1100 + part * 30;
      o.position.set(x - origin.x + Math.sin(this.clock * 0.003) * 35, y, z - origin.z);
      o.scale.set(160 + hash2(i, 9, 1) * 160, 65 + hash2(i, 13, 5) * 60, 120 + hash2(i, 2, 8) * 180); o.rotation.set(0, hash2(i, 3, 1) * 6, 0); o.updateMatrix(); this.clouds.setMatrixAt(i, o.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
  update(dt, origin, force = false) {
    this.clock += dt; if (this.cycle) this.hours = (this.hours + dt * 24 / CONFIG.daySeconds) % 24;
    const phase = (this.hours - 6) / 24 * Math.PI * 2; this.sunDirection.set(Math.cos(phase) * 0.84, Math.sin(phase), -0.5).normalize();
    const day = smooth(-0.15, 0.22, this.sunDirection.y), gold = 1 - smooth(0.05, 0.75, Math.abs(this.sunDirection.y));
    this.skyTop.copy(SKY_TOP_NIGHT).lerp(SKY_TOP_DAY, day);
    this.horizon.copy(HORIZON_NIGHT).lerp(HORIZON_DAY, day).lerp(HORIZON_GOLD, gold * day * 0.34);
    this.uTop.value.copy(this.skyTop); this.uHorizon.value.copy(this.horizon); this.uDay.value = day; this.uSun.value.copy(this.sunDirection);
    this.scene.fog.color.copy(this.horizon); this.ambient.intensity = 0.32 + day * 1.55;
    const moon = this.sunDirection.y < 0;
    // Light travels from the sun (or the moon, opposite it) toward the ground.
    this.lightDirection.copy(this.sunDirection).multiplyScalar(moon ? 1 : -1);
    const cam = this.camera.position;
    this.sun.target.position.copy(cam);
    this.sun.position.copy(cam).addScaledVector(this.lightDirection, -1000);
    this.sunColor.copy(moon ? MOON : SUN_DAY); if (!moon) this.sunColor.lerp(SUN_GOLD, gold * 0.48);
    this.sun.color.copy(this.sunColor); this.sun.intensity = moon ? 0.4 : 2.5 + day * 0.7;
    this.sky.position.copy(cam);
    if (force || this.clock - this.lastClouds > 0.18) { this.updateClouds(origin); this.lastClouds = this.clock; }
    this.torch.position.copy(cam); this.torch.position.y -= 0.15;
    this.torchDirection.copy(FORWARD).applyQuaternion(this.camera.quaternion);
    this.torch.target.position.copy(this.torch.position).addScaledVector(this.torchDirection, 50);
    this.torch.intensity = this.torchOn ? 1200 : 0;
    this.torch.shadow.autoUpdate = this.torchOn;
    this.daylight = day;
  }
  dispose() {
    this.scene.remove(this.sky, this.clouds, this.ambient, this.torch, this.torch.target, this.sun, this.sun.target);
    this.csm.dispose(); this.sky.geometry.dispose(); this.skyMaterial.dispose(); this.cloudGeo.dispose(); this.cloudMaterial.dispose(); this.clouds.dispose();
  }
}

/** Water: rolling normals and soft colour bands on one plane that follows the camera. */
export class WaterSystem {
  constructor(scene) {
    this.uTime = uniform(0); this.uOffset = uniform(new THREE.Vector2());
    this.material = new THREE.MeshStandardNodeMaterial({ color: 0x488f9b, roughness: 0.28, metalness: 0.18, transparent: true, opacity: 0.91 });
    this.material.name = 'water';
    // World xz plus the render origin, wrapped by a period every wave frequency divides,
    // so the waves line up across a rebase and stay precise far from the start.
    const P = positionWorld.xz.add(this.uOffset), t = this.uTime;
    const wx = sin(P.x.mul(0.14).add(P.y.mul(0.07)).add(t.mul(1.3)));
    const wz = cos(P.y.mul(0.17).sub(P.x.mul(0.05)).add(t.mul(0.9)));
    const waveNormal = normalize(vec3(wx.mul(0.1), 1.0, wz.mul(0.1)));
    this.material.normalNode = normalize(cameraViewMatrix.mul(vec4(waveNormal, 0.0)).xyz);
    const bands = sin(P.x.mul(0.035).add(P.y.mul(0.08)).add(t.mul(0.55))).mul(sin(P.y.mul(0.055).sub(t.mul(0.3))));
    this.material.colorNode = materialColor.mul(bands.mul(0.1).add(0.95));
    this.geometry = new THREE.PlaneGeometry(45000, 45000, 1, 1); this.geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'water'; this.mesh.position.y = CONFIG.seaLevel; this.mesh.receiveShadow = true; this.mesh.castShadow = false; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(dt, camera, origin) {
    this.uTime.value += dt;
    this.mesh.position.x = camera.position.x; this.mesh.position.z = camera.position.z;
    const period = Math.PI * 2 / 0.005;
    this.uOffset.value.set(origin.x % period, origin.z % period);
  }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}

/**
 * Static low-poly parts merged into one vertex-coloured mesh that shares the terrain
 * material (one draw call and no extra shader). `parts` is [geometry, hex colour, matrix].
 */
export function mergedProp(parts) {
  const list = parts.map(([g, hex, m]) => {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    if (geo !== g) g.dispose();
    geo.deleteAttribute('uv');
    if (m) geo.applyMatrix4(m);
    const c = new THREE.Color(hex), n = geo.attributes.position.count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  });
  const merged = mergeGeometries(list);
  for (const g of list) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** A transform for mergedProp. */
export function place(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** A small landmark and a real shadow-casting campfire light at the start area. */
export class CampSystem {
  constructor(kit, scene, generator, material) {
    this.scene = scene; this.generator = generator; this.root = new THREE.Group(); this.root.name = 'camp'; scene.add(this.root);
    this.wx = 250; this.wz = 774; this.h = generator.groundHeight(this.wx, this.wz); this.clock = 0; this.near = false;
    const rock = 0x77766b, wood = 0x72543a, fabric = 0xddd0a3, metal = 0x494c43;
    const parts = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push([new THREE.IcosahedronGeometry(0.4, 0), rock, place(Math.cos(a) * 1.25, 0.3, Math.sin(a) * 1.25, 0, 0, 0, 1, 0.65, 1)]); }
    for (let i = 0; i < 3; i++) parts.push([new THREE.CylinderGeometry(0.16, 0.2, 1.8, 5), wood, place(0, 0.22 + i * 0.07, 0, 0, i * Math.PI / 3, Math.PI / 2)]);
    // Timber bench and a simple survey post. Every solid part casts and receives shadows.
    parts.push([new THREE.BoxGeometry(3.6, 0.25, 0.8), wood, place(0, 0.75, 3.2)]);
    parts.push([new THREE.BoxGeometry(0.25, 0.8, 0.6), wood, place(-1.25, 0.38, 3.2)]);
    parts.push([new THREE.BoxGeometry(0.25, 0.8, 0.6), wood, place(1.25, 0.38, 3.2)]);
    parts.push([new THREE.CylinderGeometry(0.11, 0.16, 4.8, 5), wood, place(-4, 2.4, -1)]);
    parts.push([new THREE.BoxGeometry(1.8, 0.85, 0.025), fabric, place(-3.1, 4.1, -1, 0, 0.3, 0)]);
    parts.push([new THREE.BoxGeometry(0.65, 0.18, 0.5), metal, place(-4, 1.6, -1)]);
    this.geometry = mergedProp(parts);
    this.body = new THREE.Mesh(this.geometry, material);
    this.body.name = 'camp'; this.body.castShadow = this.body.receiveShadow = true; this.root.add(this.body);
    this.flameGeo = new THREE.ConeGeometry(0.42, 1.35, 5);
    this.flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffb253, toneMapped: false });
    this.flame = new THREE.Mesh(this.flameGeo, this.flameMaterial); this.flame.position.set(0, 0.86, 0); this.root.add(this.flame);
    // The fire light keeps castShadow and visibility for good; its shadow map only renders
    // while the player is near (sized once, as on-demand shadows must be).
    this.light = new THREE.PointLight(0xffb86f, 0, 38, 1.7); this.light.position.set(0, 1.6, 0);
    this.light.castShadow = true; this.light.shadow.mapSize.setScalar(kit.shadowSize(512)); this.light.shadow.bias = -0.001; this.light.shadow.camera.near = 0.15;
    this.light.shadow.autoUpdate = false; this.light.shadow.needsUpdate = true;
    this.root.add(this.light);
    this.setOrigin({ x: 0, z: 0 });
  }
  setOrigin(origin) { this.root.position.set(this.wx - origin.x, this.h, this.wz - origin.z); }
  reset(generator) { this.generator = generator; this.h = generator.groundHeight(this.wx, this.wz); }
  distanceTo(p) { return Math.hypot(p.x - this.wx, p.z - this.wz); }
  update(dt, worldPosition) {
    this.clock += dt; const near = this.distanceTo(worldPosition) < 240; this.near = near;
    this.light.intensity = near ? 100 + Math.sin(this.clock * 11) * 10 : 0;
    this.light.shadow.autoUpdate = near;
    this.flame.scale.set(1 + Math.sin(this.clock * 13) * 0.07, 1 + Math.sin(this.clock * 8.1) * 0.14, 1);
  }
  dispose() { this.root.removeFromParent(); this.geometry.dispose(); this.flameGeo.dispose(); this.flameMaterial.dispose(); }
}
