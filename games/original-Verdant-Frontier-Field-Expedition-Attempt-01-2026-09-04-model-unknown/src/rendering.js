import * as THREE from 'three/webgpu';
import { uniform, uv, vec2, vec3, vec4, float, sin, cos, pow, max, abs, length, mix, step, smoothstep, normalize, positionLocal, positionGeometry, positionWorld, materialColor, cameraViewMatrix } from 'three/tsl';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { PRESETS, WORLD } from './config.js';

const SUN_WARM = new THREE.Color(0xfff1d8), SUN_LOW = new THREE.Color(0xffb573), MOON = new THREE.Color(0x9ab9e6);
const HEMI_NIGHT = new THREE.Color(0x8fa9c9), HEMI_DAY = new THREE.Color(0xc8e5f1);
const FOG_NIGHT = new THREE.Color(0x111f35), FOG_DAY = new THREE.Color(0xa5c4cc), FOG_DUSK = new THREE.Color(0xdfae83);
const STAR_COUNT = 1600;

export class RenderingSystem {
  constructor(kit, settings, bus) {
    this.kit = kit; this.settings = settings; this.bus = bus; this.renderer = kit.renderer;
    this.materials = new Set(); this.trash = [];
    // World clock for shaders. It stops while the expedition is paused, like the original.
    this.time = uniform(0); this.underwaterU = uniform(0); this.pulseU = uniform(0);
    this.underwater = 0; this.scanPulse = 0; this.elapsed = 0; this.envBucket = -1; this.lastEnvironmentUpdate = -100; this.envIntensity = -1;
    this.sunColor = new THREE.Color(); this.fogColor = new THREE.Color(); this.lookDir = new THREE.Vector3(); this.dominant = new THREE.Vector3();
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;

    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#96bec9'); this.scene.fog = new THREE.Fog('#9ab8bf', 1400, 10000);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(settings.fov, 1, 0.12, 15000)); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0xc1e0ee, 0x465630, 1.5); this.scene.add(this.hemi);

    // One sky dome. It moves into the environment scene while the PMREM is refreshed.
    this.sky = new SkyMesh(); this.sky.scale.setScalar(450000);
    this.sky.turbidity.value = 3.5; this.sky.rayleigh.value = 2.0; this.sky.mieCoefficient.value = 0.004; this.sky.mieDirectionalG.value = 0.82;
    this.sky.cloudCoverage.value = 0; // the low-poly cloud banks are real meshes
    this.scene.add(this.sky);
    this.sun = new THREE.Vector3();
    this.pmrem = new THREE.PMREMGenerator(r); this.environmentScene = new THREE.Scene(); this.envTarget = null;

    this.flashlight = new THREE.SpotLight(0xfff2db, 0, 160, Math.PI / 7, 0.55, 1.3); this.flashlight.castShadow = true;
    this.flashlight.shadow.bias = -0.0001; this.flashlight.shadow.normalBias = 0.05; this.flashlight.shadow.camera.near = 0.1; this.flashlight.shadow.camera.far = 160;
    this.flashlight.shadow.autoUpdate = false; kit.shadow(this.flashlight, 1024);
    this.flashTarget = new THREE.Object3D(); this.flashlight.target = this.flashTarget; this.scene.add(this.flashlight, this.flashTarget); this.flashEnabled = false; this.lamp = false;
    this.lantern = new THREE.PointLight(0xffaa55, 85, 50, 1.5); this.lantern.position.set(WORLD.spawn.x + 8, 81.5, WORLD.spawn.z - 7); this.lantern.castShadow = true;
    this.lantern.shadow.bias = -0.0002; this.lantern.shadow.normalBias = 0.06; this.lantern.shadow.camera.far = 50; kit.shadow(this.lantern, 512); this.scene.add(this.lantern);

    this.applyPreset(kit.tier.name, true);
    this.makeWater(); this.makeStars(); this.makeClouds(); this.updateLighting(true);
    this.post = createPost(kit, this.scene, this.camera, { bloom: { strength: 0.16, radius: 0.5, threshold: 1.15 }, output: (color, ctx) => this.atmosphere(color, ctx) });
    kit.onQuality(tier => this.applyPreset(tier.name));
    kit.onResize(() => this.refreshShadowFrustums());
  }

  createMaterial(options = {}, kind = 'standard') {
    const material = kind === 'physical' ? new THREE.MeshPhysicalNodeMaterial(options) : new THREE.MeshStandardNodeMaterial({ roughness: 0.94, flatShading: true, ...options });
    this.materials.add(material); return material;
  }

  /** Vegetation sway as a TSL position node. Shadows follow it: the shadow pass keeps positionNode. */
  windify(material) {
    const w = positionLocal; // instancing is already applied, and every plant mesh sits at the world origin
    const sway = sin(this.time.mul(1.1).add(w.x.mul(0.017)).add(w.z.mul(0.012))).mul(max(0.0, positionGeometry.y)).mul(0.017);
    material.positionNode = positionLocal.add(vec3(sway, 0, 0));
    return material;
  }

  /** GTAO is a heavier extra: on High and Ultra with the kit's Advanced WebGPU setting, like the original's AO presets. */
  aoWanted(tier) { return !!PRESETS[tier.name]?.ao && tier.post === 'full' && !!this.kit.settings.get().advanced; }

  /** The old atmosphere ShaderPass in TSL: underwater wobble and tint, vignette, survey-pulse ring. */
  atmosphere(color, ctx) {
    let rgb = color.rgb;
    if (this.aoWanted(ctx.tier)) {
      if (!this.aoNode) {
        this.aoNode = ao(ctx.scenePass.getTextureNode('depth'), null, this.camera);
        this.aoNode.resolutionScale = 0.5; this.aoNode.radius.value = 2.3; this.aoNode.distanceExponent.value = 1.7; this.aoNode.thickness.value = 1.2; this.aoNode.samples.value = 8;
      }
      rgb = rgb.mul(mix(1.0, this.aoNode.getTextureNode().r, 0.7));
    }
    const q = uv(), under = this.underwaterU, pulse = this.pulseU;
    const shift = sin(q.y.mul(32.0).add(this.time.mul(1.7))).mul(0.0015).mul(under);
    rgb = rgb.add(ctx.color.sample(q.add(vec2(shift, 0.0))).rgb.sub(ctx.color.rgb).mul(under));
    const vignette = float(1.0).sub(smoothstep(0.24, 0.92, length(q.sub(0.5).mul(vec2(1.1, 1.0)))));
    rgb = rgb.mul(mix(0.78, 1.0, vignette));
    rgb = mix(rgb, rgb.mul(vec3(0.25, 0.69, 0.75)).add(vec3(0.0, 0.035, 0.04)), under.mul(0.75));
    const ring = float(1.0).sub(smoothstep(0.01, 0.025, abs(length(q.sub(0.5)).sub(pulse.mul(0.85)))));
    rgb = rgb.add(vec3(0.12, 0.42, 0.31).mul(ring).mul(float(1.0).sub(pulse)).mul(step(0.001, pulse)));
    return vec4(rgb, 1.0);
  }

  applyPreset(name, initial = false) {
    const p = PRESETS[name] || PRESETS.high; this.preset = p; this.presetName = PRESETS[name] ? name : 'high';
    this.buildSun(p);
    this.camera.far = p.distance * 1.3; this.camera.updateProjectionMatrix();
    this.refreshShadowFrustums();
    if (this.stars) this.placeStars();
    if (!initial) { this.updateLighting(true); this.bus.emit('preset', this.presetName); }
  }

  /** The sun/moon light with cascaded shadows. Rebuilt when the tier changes the cascade count or range. */
  buildSun(p) {
    if (this.sunLight) {
      const old = this.sunLight, oldCsm = this.csm;
      this.scene.remove(old);
      // Let a few frames pass before freeing GPU resources the last frame may still reference.
      this.trash.push({ frames: 4, dispose: () => { oldCsm.dispose(); for (const node of oldCsm._shadowNodes || []) node.dispose?.(); old.dispose(); } });
    }
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.castShadow = true;
    light.shadow.mapSize.setScalar(this.kit.shadowSize(p.shadow || 2048));
    light.shadow.camera.near = 1; light.shadow.camera.far = 6000;
    light.shadow.bias = 0; light.shadow.normalBias = 0.5; light.shadow.radius = 2;
    const csm = new CSMShadowNode(light, { cascades: p.cascades, maxFar: p.shadowFar, mode: 'practical', lightMargin: 1400 });
    csm.fade = true;
    light.shadow.shadowNode = csm;
    light.position.set(0.6, 0.8, 0.3);
    this.scene.add(light);
    this.sunLight = light; this.csm = csm; this.shadowFov = 0;
  }

  refreshShadowFrustums() { if (this.csm?.camera) this.csm.updateFrustums(); }

  makeWater() {
    const material = this.createMaterial({ color: 0x2e8994, roughness: 0.24, metalness: 0.28, envMapIntensity: 1.2, side: THREE.DoubleSide }, 'physical');
    const w = positionWorld, t = this.time;
    const rip = normalize(vec3(sin(w.x.mul(0.15).add(t.mul(0.9))).mul(0.065).add(cos(w.z.mul(0.27).sub(t)).mul(0.035)), 1.0, cos(w.z.mul(0.12).add(t.mul(0.8))).mul(0.07)));
    material.normalNode = normalize(cameraViewMatrix.mul(vec4(rip, 0.0)).xyz);
    const foam = pow(max(0.0, sin(w.x.mul(0.08).add(w.z.mul(0.13)).add(t.mul(0.4))).mul(cos(w.x.mul(0.16).sub(w.z.mul(0.06)).sub(t.mul(0.7))))), 20.0);
    material.colorNode = materialColor.add(foam.mul(0.055));
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(65536, 65536), material); this.water.rotation.x = -Math.PI / 2; this.water.position.y = WORLD.water; this.water.receiveShadow = true; this.water.name = 'World water'; this.scene.add(this.water);
  }

  makeStars() {
    // Sized star points through kit/points.js (plain points draw at one pixel on WebGPU).
    this.starBase = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) { const a = i * 2.399963, r = Math.sqrt(1 - (i / STAR_COUNT) ** 2), y = i / STAR_COUNT; this.starBase.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
    this.stars = createPoints({ positions: new Float32Array(STAR_COUNT * 3), size: 1.5, sizeAttenuation: false, material: { color: 0xd8eaff, transparent: true, opacity: 0, depthWrite: false, fog: false } });
    this.stars.object.visible = false; this.placeStars(); this.scene.add(this.stars.object);
  }
  placeStars() {
    const radius = this.preset.distance * 0.9, out = this.stars.positions.array;
    for (let i = 0; i < out.length; i++) out[i] = this.starBase[i] * radius;
    this.stars.positions.needsUpdate = true;
  }

  makeClouds() {
    const geometry = new THREE.IcosahedronGeometry(1, 1), material = this.createMaterial({ color: 0xe8ebdf, roughness: 1, flatShading: true });
    this.clouds = new THREE.InstancedMesh(geometry, material, 112); this.cloudData = []; this.cloudDummy = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const x = Math.sin(i * 73.93 + 8) * 14500, z = Math.cos(i * 38.29) * 14500, y = 1900 + (Math.sin(i * 4.3) * 0.5 + 0.5) * 800;
      for (let j = 0; j < 4; j++) this.cloudData.push({ x: x + j * 190, z: z + Math.sin(j * 2.8) * 100, y: y + j * 18, sx: 260 + (i % 3) * 60, sy: 70 + (j % 2) * 40, sz: 130 + (i % 4) * 20 });
    }
    this.clouds.castShadow = this.clouds.receiveShadow = true; this.clouds.frustumCulled = false; this.scene.add(this.clouds); this.moveClouds();
  }
  moveClouds() {
    for (let i = 0; i < this.cloudData.length; i++) { const c = this.cloudData[i]; this.cloudDummy.position.set(c.x + Math.sin(this.elapsed * 0.0008) * 220, c.y, c.z + this.elapsed * 0.8 % 200); this.cloudDummy.scale.set(c.sx, c.sy, c.sz); this.cloudDummy.updateMatrix(); this.clouds.setMatrixAt(i, this.cloudDummy.matrix); }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  /** 0 at night, 1 in full day. */
  get daylight() { return THREE.MathUtils.smoothstep(this.sun.y, -0.12, 0.22); }
  get isNight() { return this.sun.y < -0.05; }

  updateLighting(force = false) {
    const t = this.settings.time, angle = (t - 6) / 24 * Math.PI * 2; this.sun.set(Math.cos(angle) * 0.68, Math.sin(angle), -0.55).normalize();
    const day = this.daylight, sunset = 1 - THREE.MathUtils.smoothstep(Math.abs(this.sun.y), 0, 0.4), up = this.sun.y > 0.02;
    this.sky.sunPosition.value.copy(this.sun);
    this.dominant.copy(this.sun); if (!up) this.dominant.negate();
    this.sunLight.position.copy(this.dominant); // the light shines from here toward its target at the origin
    this.sunColor.copy(SUN_WARM).lerp(SUN_LOW, sunset * 0.65);
    this.sunLight.color.copy(up ? this.sunColor : MOON); this.sunLight.intensity = up ? day * 3.3 : 0.3;
    this.hemi.intensity = 0.24 + day * 1.35; this.hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, day); this.lantern.intensity = THREE.MathUtils.lerp(110, 28, day);
    this.fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_DUSK, sunset * day * 0.32);
    if (this.settings.fog) {
      if (!this.scene.fog) this.scene.fog = new THREE.Fog(this.fogColor, 1200, this.preset.distance);
      this.scene.fog.color.copy(this.fogColor); this.scene.fog.near = this.preset.distance * 0.13; this.scene.fog.far = this.preset.distance;
    } else this.scene.fog = null;
    this.scene.background.copy(this.fogColor);
    if (this.stars) { const o = (1 - day) * 0.85; this.stars.material.opacity = o; this.stars.object.visible = o > 0.01; }
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.85, 1.05, day);
    const intensity = 0.2 + day * 0.35; if (Math.abs(intensity - this.envIntensity) > 0.004) { this.envIntensity = intensity; this.scene.environmentIntensity = intensity; }
    const bucket = Math.floor(t * 2);
    if (force || (bucket !== this.envBucket && this.elapsed - this.lastEnvironmentUpdate > 1)) {
      this.lastEnvironmentUpdate = this.elapsed; this.envBucket = bucket;
      // Re-render the sky into the same PMREM target, so materials keep one environment texture (no rebuilds).
      this.environmentScene.add(this.sky);
      try { this.envTarget = this.pmrem.fromScene(this.environmentScene, 0.04, 0.1, 500000, { renderTarget: this.envTarget }); }
      finally { this.scene.add(this.sky); }
      if (this.scene.environment !== this.envTarget.texture) this.scene.environment = this.envTarget.texture;
    }
  }

  update(dt, player, paused = false) {
    this.elapsed += dt; this.time.value = this.elapsed; if (!paused) this.settings.time = (this.settings.time + dt * this.settings.daySpeed / 60) % 24;
    for (let i = this.trash.length - 1; i >= 0; i--) if (--this.trash[i].frames <= 0) { try { this.trash[i].dispose(); } catch { /* already gone */ } this.trash.splice(i, 1); }
    this.updateLighting(); this.sky.position.copy(this.camera.position); this.stars.object.position.copy(this.camera.position);
    this.camera.getWorldDirection(this.lookDir);
    this.flashlight.position.copy(this.camera.position); this.flashTarget.position.copy(this.camera.position).addScaledVector(this.lookDir, 30);
    this.flashlight.intensity = this.flashEnabled ? (this.lamp ? 260 : 180) : 0; this.flashlight.distance = this.lamp ? 320 : 160; this.flashlight.shadow.camera.far = this.flashlight.distance;
    this.flashlight.shadow.autoUpdate = this.flashEnabled;
    // The lantern's cube shadow only needs refreshing while someone is near the station.
    this.lantern.shadow.autoUpdate = this.camera.position.distanceToSquared(this.lantern.position) < 200 * 200;
    this.underwater = THREE.MathUtils.damp(this.underwater, this.camera.position.y < WORLD.water ? 1 : 0, 6, dt);
    if (this.scanPulse > 0) this.scanPulse = Math.min(1, this.scanPulse + dt * 0.6); if (this.scanPulse === 1) this.scanPulse = 0;
    this.underwaterU.value = this.underwater; this.pulseU.value = this.scanPulse;
    this.camera.updateMatrixWorld();
    if (this.csm.camera && Math.abs((this.shadowFov || 0) - this.camera.fov) > 0.3) { this.shadowFov = this.camera.fov; this.csm.updateFrustums(); }
    this.moveClouds();
  }
  setFlashlight(on) { this.flashEnabled = on; if (on) this.flashlight.shadow.needsUpdate = true; }
  render() { this.renderer.info.reset(); this.post.render(); }
  dispose() {
    this.post.dispose(); this.csm?.dispose(); this.aoNode?.dispose();
    for (const m of this.materials) m.dispose();
    this.water.geometry.dispose(); this.clouds.geometry.dispose(); this.stars.material.dispose(); this.envTarget?.dispose(); this.pmrem.dispose();
  }
}
