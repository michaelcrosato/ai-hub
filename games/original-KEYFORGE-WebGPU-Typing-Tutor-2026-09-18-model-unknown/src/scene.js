/**
 * scene.js — the forge behind the typing lab: a glowing core in orbiting
 * rings over a dark mirror floor, pillars, light bars and drifting dust.
 * It reacts to typing through `fx` (key hits, finished words, misses, the
 * end-of-run celebration) and bloom picks up only what glows (an emissive
 * MRT output), so the scene stays dark and the neon stays crisp.
 */

import * as THREE from 'three/webgpu';
import {
  mrt, output, emissive, uniform, varying, instancedBufferAttribute, modelViewMatrix,
  materialPointSize, materialOpacity, vec4, max, clamp,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';

/** Dust particles at the 'high' tier; kit.detail() scales it per tier. */
const DUST = 4600;
const MISS_TINT = 0xff3c78;
const SHELL_TINT = 0x5c6dff;

/** What typing does to the scene. The tutor calls these; update() eases them back. */
export function createFx() {
  return {
    intensity: 0.2,
    targetIntensity: 0.2,
    shock: 0,
    missPulse: 0,
    celebration: 0,
    keyPulse: 0,
    wordPulse: 0,
    setIntensity(v) {
      this.targetIntensity = v;
    },
    keyHit() {
      this.keyPulse = 1;
    },
    wordHit(streak) {
      this.wordPulse = 1;
      this.shock = Math.min(1.5, 0.35 + streak * 0.03);
    },
    miss() {
      this.missPulse = 1;
      this.shock = 0.5;
    },
    celebrate() {
      this.celebration = 1;
      this.shock = 1.4;
    },
    /** A shockwave across the floor: streak milestones and passed trials. */
    wave: 0,
    wavePower: 1,
    waveColor: 0x6ef2ff,
    waveSerial: 0,
    milestone(power = 1, color = 0x6ef2ff) {
      this.wave = 1;
      this.wavePower = power;
      this.waveColor = color;
      this.waveSerial += 1;
      this.shock = Math.max(this.shock, 0.6 + power * 0.3);
      this.celebration = Math.max(this.celebration, 0.3 * power);
    },
  };
}

export function createBackdrop(kit, fx) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  // r186 dropped PCFSoftShadowMap; PCF with a radius gives the same soft edge.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x050914, 0.024);

  const camera = kit.fitCamera(new THREE.PerspectiveCamera(52, 1, 0.1, 240));
  camera.position.set(0, 5.2, 20.5);
  camera.lookAt(0, 2.1, 0);
  const home = camera.position.clone();
  // Portrait screens widen the view a little so the core is not cropped to a sliver.
  kit.onResize((w, h) => {
    const aspect = w / h;
    camera.fov = aspect < 1 ? Math.min(72, 52 + (1 - aspect) * 40) : 52;
    camera.updateProjectionMatrix();
  });

  // ---- lights (physical units, as the scene was authored for r186)
  scene.add(new THREE.HemisphereLight(0x7298ff, 0x050711, 1.2));
  const spot = new THREE.SpotLight(0x78ddff, 1100, 55, Math.PI / 6.5, 0.5, 1.4);
  spot.position.set(-9, 15, 12);
  spot.target.position.set(0, 1.5, 0);
  spot.castShadow = true;
  spot.shadow.bias = -8e-5;
  spot.shadow.radius = 3;
  kit.shadow(spot, 2048);
  scene.add(spot, spot.target);
  const violet = new THREE.PointLight(0x7b52ff, 420, 34, 1.7);
  violet.position.set(7, 7, -5);
  scene.add(violet);
  const mint = new THREE.PointLight(0x59ffe1, 250, 28, 1.8);
  mint.position.set(-7, 3, 3);
  scene.add(mint);

  // ---- floor: dark clearcoat mirror with a faint grid
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 128),
    new THREE.MeshPhysicalMaterial({ color: 0x050910, roughness: 0.24, metalness: 0.76, clearcoat: 0.6, clearcoatRoughness: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.25;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(80, 80, 0x386eff, 0x172544);
  grid.position.y = -1.22;
  grid.material.transparent = true;
  grid.material.opacity = 0.26;
  scene.add(grid);

  // ---- floor rings
  const ringBase = new THREE.MeshStandardMaterial({ color: 0x0a1930, emissive: 0x347eff, emissiveIntensity: 4, metalness: 0.65, roughness: 0.22 });
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6 + i * 2.65, 0.016 + i * 0.005, 8, 160), ringBase.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.1 + i * 0.025;
    ring.material.emissiveIntensity = 1.6 - i * 0.16;
    scene.add(ring);
    rings.push(ring);
  }
  ringBase.dispose();

  // ---- the core: a bright icosphere in a glassy shell and two orbit rings
  const core = new THREE.Group();
  core.position.set(0, 2.2, -2.2);
  scene.add(core);
  const heartMat = new THREE.MeshStandardMaterial({ color: 0x142d46, emissive: 0x56ebff, emissiveIntensity: 5, metalness: 0.3, roughness: 0.12 });
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 5), heartMat);
  heart.castShadow = true;
  core.add(heart);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x15254a,
    emissive: SHELL_TINT,
    emissiveIntensity: 1.7,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.25,
    transmission: 0.15,
    thickness: 0.5,
    side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.82, 2), shellMat);
  core.add(shell);
  const orbitAMat = new THREE.MeshStandardMaterial({ color: 0x12213a, emissive: 0x67f5ff, emissiveIntensity: 3.5, metalness: 0.82, roughness: 0.22 });
  const orbitBMat = new THREE.MeshStandardMaterial({ color: 0x21173c, emissive: 0x9e69ff, emissiveIntensity: 3.2, metalness: 0.82, roughness: 0.22 });
  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.045, 12, 160), orbitAMat);
  const orbitB = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.035, 12, 160), orbitBMat);
  orbitA.rotation.set(1, 0.35, 0.15);
  orbitB.rotation.set(-0.55, 0.2, 0.85);
  core.add(orbitA, orbitB);

  // ---- pillars around the core
  const dummy = new THREE.Object3D();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0a1224, emissive: 0x244b99, emissiveIntensity: 0.85, metalness: 0.85, roughness: 0.2 });
  const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.28, 1.9, 6, 1), pillarMat, 52);
  pillars.castShadow = true;
  pillars.receiveShadow = true;
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2;
    const r = 10.5 + (i % 3) * 2.8;
    const h = 1.1 + ((i * 17) % 9) * 0.18;
    dummy.position.set(Math.cos(a) * r, -1.2 + h / 2, Math.sin(a) * r - 3);
    dummy.scale.setScalar(0.75 + (i % 5) * 0.06);
    dummy.rotation.set(0.1 * Math.sin(a * 2), -a, 0.03 * Math.cos(a * 3));
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
  }
  scene.add(pillars);

  // ---- light bars down both sides
  const barMat = new THREE.MeshStandardMaterial({ color: 0x0a203b, emissive: 0x4fcfff, emissiveIntensity: 4.3, roughness: 0.2, metalness: 0.4 });
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 4.8, 0.035), barMat, 36);
  for (let i = 0; i < 36; i++) {
    const side = i % 2 ? -1 : 1;
    const z = -5 - Math.floor(i / 2) * 2.6;
    dummy.position.set(side * (7.2 + (i % 3) * 1.25), 1.1 + (i % 4) * 0.25, z);
    dummy.scale.set(1, 0.5 + (i % 5) * 0.18, 1);
    dummy.rotation.set(0, 0, side * 0.045);
    dummy.updateMatrix();
    bars.setMatrixAt(i, dummy.matrix);
  }
  scene.add(bars);

  // ---- milestone shockwave: a thin ring that races out across the floor. It stays in the
  // scene at zero strength so its pipeline is compiled before the first streak milestone.
  const waveMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x6ef2ff,
    emissiveIntensity: 0,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 160), waveMat);
  wave.rotation.x = -Math.PI / 2;
  wave.position.set(0, -1.17, -2.2);
  wave.scale.setScalar(0.01);
  scene.add(wave);
  let waveSerial = 0;

  // ---- dust: sized sprites (WebGPU draws THREE.Points at 1px). Sized like PointsMaterial with
  // attenuation, but never under one CSS pixel; specks that would be smaller fade instead.
  const dustMax = Math.round(DUST * 1.25);
  const positions = new Float32Array(dustMax * 3);
  const colors = new Float32Array(dustMax * 3);
  for (let i = 0; i < dustMax; i++) {
    const o = i * 3;
    const r = 8 + Math.random() * 42;
    const a = Math.random() * Math.PI * 2;
    positions[o] = Math.cos(a) * r;
    positions[o + 1] = -0.3 + Math.random() * 20;
    positions[o + 2] = Math.sin(a) * r - 8 - Math.random() * 30;
    const k = Math.random();
    colors[o] = 0.28 + k * 0.22;
    colors[o + 1] = 0.44 + k * 0.45;
    colors[o + 2] = 0.88 + k * 0.12;
  }
  const dust = createPoints({
    positions,
    colors,
    size: 0.038,
    sizeAttenuation: false,
    material: { transparent: true, opacity: 0.68, depthWrite: false, blending: THREE.AdditiveBlending },
  });
  const halfHeight = uniform(360);
  kit.onResize((w, h) => (halfHeight.value = h * 0.5));
  const viewDepth = max(modelViewMatrix.mul(vec4(instancedBufferAttribute(dust.positions), 1)).z.negate(), 0.1);
  const cssPixels = materialPointSize.mul(halfHeight).div(viewDepth);
  dust.material.sizeNode = max(cssPixels, 1);
  dust.material.opacityNode = materialOpacity.mul(clamp(varying(cssPixels), 0.35, 1));
  const dustMat = dust.material;
  const dustGroup = new THREE.Group();
  dustGroup.add(dust.object);
  scene.add(dustGroup);
  const fitDust = () => dust.setCount(kit.detail(DUST));
  fitDust();
  kit.onQuality(fitDust);

  // ---- post: bloom on the emissive output only, then tone mapping (kit/post.js adds FXAA on medium)
  let glow = null;
  const post = createPost(kit, scene, camera, {
    output: (color, { scenePass, tier }) => {
      if (!glow) {
        scenePass.setMRT(mrt({ output, emissive }));
        glow = bloom(scenePass.getTextureNode('emissive'), 1.08, 0.48, 0.03);
      }
      glow.setResolutionScale(tier.post === 'lite' ? 0.45 : 0.7);
      return color.add(glow);
    },
  });

  let elapsed = 0;
  let dustSpin = 0;

  return {
    scene,
    camera,
    /** Advance the animation and draw one frame. */
    frame(dt) {
      const d = Math.min(0.05, dt);
      elapsed += d;
      const t = elapsed;
      fx.intensity += (fx.targetIntensity - fx.intensity) * Math.min(1, d * 4.2);
      fx.keyPulse = Math.max(0, fx.keyPulse - d * 6.8);
      fx.wordPulse = Math.max(0, fx.wordPulse - d * 2.8);
      fx.missPulse = Math.max(0, fx.missPulse - d * 5.4);
      fx.celebration = Math.max(0, fx.celebration - d * 0.38);
      fx.shock = Math.max(0, fx.shock - d * 3.4);
      const key = fx.keyPulse;
      const word = fx.wordPulse;
      const miss = fx.missPulse;
      const level = fx.intensity;

      heart.rotation.x += d * (0.15 + level * 0.85);
      heart.rotation.y += d * (0.26 + level * 1.1);
      heart.scale.setScalar(1 + key * 0.16 + word * 0.28 - miss * 0.04);
      heartMat.emissiveIntensity = 3.2 + level * 2.2 + key * 5.5 + word * 5.2;
      shell.rotation.x -= d * (0.08 + level * 0.3);
      shell.rotation.y += d * (0.12 + level * 0.34);
      shell.scale.setScalar(1 + Math.sin(t * 2.1) * 0.025 + word * 0.13);
      shellMat.emissiveIntensity = 1.25 + level * 1.1 + miss * 2;
      shellMat.emissive.setHex(miss > 0.1 ? MISS_TINT : SHELL_TINT);
      orbitA.rotation.y += d * (0.3 + level * 1.35);
      orbitA.rotation.z += d * 0.11;
      orbitB.rotation.x -= d * (0.24 + level * 1.1);
      orbitB.rotation.z -= d * 0.07;
      orbitAMat.emissiveIntensity = 2 + level * 2.1 + word * 4;
      orbitBMat.emissiveIntensity = 1.8 + level * 1.9 + key * 2.5;
      core.position.y = 2.15 + Math.sin(t * 0.8) * 0.1 + word * 0.18;
      core.rotation.y = Math.sin(t * 0.23) * 0.15;

      // Integrated, so the dust keeps drifting smoothly when the session speeds it up.
      dustSpin += d * (0.008 + level * 0.014);
      dustGroup.rotation.y = dustSpin;
      dustGroup.position.y = Math.sin(t * 0.25) * 0.16;
      dustMat.opacity = 0.43 + level * 0.2 + fx.celebration * 0.16;
      dustMat.size = 0.032 + level * 0.014 + key * 0.02;

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        ring.rotation.z = t * (0.009 + i * 0.002) * (i % 2 ? -1 : 1);
        ring.material.emissiveIntensity = 0.85 + level * (1 - i * 0.08) + word * (2.2 - i * 0.2) + fx.celebration * 1.4;
      }
      if (fx.waveSerial !== waveSerial) {
        waveSerial = fx.waveSerial;
        waveMat.emissive.setHex(fx.waveColor);
      }
      if (fx.wave > 0) {
        fx.wave = Math.max(0, fx.wave - d * 0.75);
        const k = 1 - fx.wave;
        wave.scale.setScalar(1.6 + (1 - (1 - k) * (1 - k)) * 26);
        waveMat.opacity = fx.wave * 0.9;
        waveMat.emissiveIntensity = fx.wave * fx.wave * 10 * fx.wavePower;
      } else if (waveMat.opacity !== 0) {
        waveMat.opacity = 0;
        waveMat.emissiveIntensity = 0;
        wave.scale.setScalar(0.01);
      }

      barMat.emissiveIntensity = 2.3 + level * 2.2 + word * 1.8 + fx.wave * 2.5 * fx.wavePower;
      mint.intensity = 170 + level * 170 + key * 120;
      violet.intensity = 280 + level * 260 + fx.celebration * 230;
      spot.intensity = 820 + level * 520;

      const shake = fx.shock * 0.045;
      camera.position.x = home.x + Math.sin(t * 72) * shake;
      camera.position.y = home.y + Math.cos(t * 63) * shake + Math.sin(t * 0.25) * 0.04;
      camera.position.z = home.z - word * 0.22 + Math.sin(t * 0.18) * 0.05;
      camera.lookAt(0, 2.05, -1.6);

      post.render();
    },
  };
}
