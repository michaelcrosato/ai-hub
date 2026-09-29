import * as THREE from 'three/webgpu';
import { createPost } from 'kit/post.js';
import { PROFILES } from './config.js';
import { sanitiseGraphics } from './settings.js';
import { MAT } from '../voxel/palette.js';
import { makeSky, environmentTexture, waterMaterial, makeMaterialUniforms } from './materials.js';

const _target = new THREE.Vector3();

/**
 * The scene, lights and post chain on the kit's renderer. The kit owns the canvas size,
 * pixel ratio, anti-aliasing and backend; this owns the lab's own lighting settings.
 */
export class Viewport {
  static create(kit, profile, graphics = PROFILES[profile].graphics) {
    const view = new Viewport(kit, profile, graphics);
    const hdr = environmentTexture(), generator = new THREE.PMREMGenerator(kit.renderer);
    try {
      view.environment = generator.fromEquirectangular(hdr);
      view.scene.environment = view.environment.texture;
    } finally { hdr.dispose(); generator.dispose(); }
    return view;
  }
  constructor(kit, profile, graphics) {
    const renderer = kit.renderer;
    this.kit = kit; this.renderer = renderer; this.scene = new THREE.Scene(); this.profileName = profile;
    renderer.domElement.setAttribute('aria-label', 'Interactive voxel scene');
    this.scene.fog = new THREE.FogExp2(0xabb4aa, 0.006);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(43, 1, 0.1, 500));
    this.sky = makeSky(); this.scene.add(this.sky);
    this.ambient = new THREE.HemisphereLight(0xd7e6f0, 0x887860, 0.5); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffdfaf, 3.2); this.scene.add(this.sun, this.sun.target);
    this.sun.castShadow = true; this.sun.shadow.bias = -0.00008;
    this.sun.shadow.autoUpdate = false; this.sun.shadow.needsUpdate = true;
    this.focus = new THREE.Vector3(0, 1.65, 0); this.sunOffset = new THREE.Vector3();
    this.flash = new THREE.PointLight(0xffc68b, 0, 7, 2); this.scene.add(this.flash);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardNodeMaterial({ color: 0x9ca697, roughness: 1 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -2.85; this.floor.scale.setScalar(200);
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = false;
    this.materialUniforms = makeMaterialUniforms(graphics);
    // One water material for every pool: it reads the shared uniforms, so settings still apply live.
    this.waterMaterial = waterMaterial(this.materialUniforms);
    this.bloomPost = null; this.plainPost = null; this.lastRenderStats = {};
    this.waters = []; this.lamps = []; this.emitters = []; this.lightRevision = 0; this.lampRevision = -1;
    this.lastLampFocus = new THREE.Vector3(Infinity, Infinity, Infinity);
    // WebGPU reports its texture limit; WebGL2 devices all manage 4096 shadow maps.
    this.hardwareMaxDimension = renderer.backend?.device?.limits?.maxTextureDimension2D || 4096;
    this.graphics = null;
    this.applyGraphics(graphics);
    // Auto shadow maps follow the shared Quality tier.
    kit.onQuality(() => { if (this.graphics?.shadowSize < 0) this.applyShadowSize(); });
  }
  decorate(layout) {
    for (const water of this.waters) { this.scene.remove(water); water.geometry.dispose(); }
    this.waters = layout.pools.map(pool => {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(pool.width, pool.depth), this.waterMaterial);
      water.rotation.x = -Math.PI / 2; water.position.set(pool.x, pool.y, pool.z);
      water.receiveShadow = true; this.scene.add(water); return water;
    });
    this.layout = layout; this.floor.scale.setScalar(Math.max(200, layout.size * 3));
    this.emitters = layout.lights.map((point, i) => ({ position: new THREE.Vector3().fromArray(point), cell: layout.lightCells[i], active: true }));
    this.lightRevision++; this.updateFocus(_target.fromArray(layout.focus), true);
  }
  /** Re-read which amber emitters still stand. Returns how many went out since the last call. */
  updateEmitters(world) {
    let lost = 0;
    for (const emitter of this.emitters) {
      const active = world.get(...emitter.cell) === MAT.GLOW;
      if (emitter.active && !active) lost++;
      emitter.active = active;
    }
    this.lightRevision++;
    return lost;
  }
  get litCount() { let n = 0; for (const emitter of this.emitters) if (emitter.active) n++; return n; }
  get autoShadowSize() { return Math.min(this.kit.shadowSize(2048), this.hardwareMaxDimension); }
  setProfile(name, graphics) {
    if (!Object.hasOwn(PROFILES, name)) throw new RangeError(`Unknown profile: ${name}`);
    this.profileName = name; this.applyGraphics(graphics || PROFILES[name].graphics);
  }
  applyShadowSize() {
    const g = this.graphics, shadow = this.sun.shadow;
    const size = g.shadowSize < 0 ? this.autoShadowSize : Math.min(g.shadowSize, this.hardwareMaxDimension);
    const enabled = size > 0;
    if (this.sun.castShadow !== enabled) {
      this.sun.castShadow = enabled;
      this.scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
    }
    this.actualShadowSize = enabled ? size : 0;
    // r186 resizes the shadow map from mapSize on the next frame; the map itself is never disposed here.
    if (enabled && shadow.mapSize.x !== size) shadow.mapSize.setScalar(size);
    shadow.needsUpdate = true;
  }
  applyGraphics(values) {
    const g = sanitiseGraphics(this.profileName, values); this.graphics = g;
    for (const [key, node] of Object.entries(this.materialUniforms)) node.value = g[key];
    this.renderer.toneMappingExposure = g.exposure; this.sun.intensity = g.sunIntensity;
    this.scene.environmentIntensity = g.environmentIntensity; this.ambient.intensity = g.ambientIntensity;
    this.scene.fog.density = g.fogDensity;
    this.camera.fov = g.fov; this.camera.far = g.drawDistance; this.camera.updateProjectionMatrix();
    this.applyShadowSize();
    const shadow = this.sun.shadow;
    shadow.intensity = g.shadowStrength; shadow.radius = g.shadowSoftness; shadow.normalBias = g.shadowBias;
    const half = g.shadowRange / 2;
    Object.assign(shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.1, far: g.shadowRange * 5 + 100 });
    shadow.camera.updateProjectionMatrix();
    const yaw = THREE.MathUtils.degToRad(g.sunAzimuth), elevation = THREE.MathUtils.degToRad(g.sunElevation);
    const distance = g.shadowRange * 2 + 40;
    this.sunOffset.set(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation)).multiplyScalar(distance);
    this.updateFocus(this.focus, true); shadow.needsUpdate = true;
    while (this.lamps.length > g.lampCount) this.scene.remove(this.lamps.pop());
    while (this.lamps.length < g.lampCount) { const lamp = new THREE.PointLight(0xffbe70, 0, 4, 2); this.scene.add(lamp); this.lamps.push(lamp); }
    this.lightRevision++;
    this.setBloom(g);
  }
  setBloom(g) {
    this.bloomEnabled = g.bloomStrength > 0;
    if (this.bloomEnabled && !this.bloomPost) {
      this.bloomPost = createPost(this.kit, this.scene, this.camera,
        { bloom: { strength: g.bloomStrength, radius: g.bloomRadius, threshold: g.bloomThreshold } });
    }
    const node = this.bloomPost?.bloom;
    if (node) { node.strength.value = g.bloomStrength; node.radius.value = g.bloomRadius; node.threshold.value = g.bloomThreshold; }
  }
  /** Distance and angles for the classic three-quarter view of a target. */
  homeView(overview = false) {
    const aspect = this.kit.size.width / Math.max(1, this.kit.size.height);
    const scale = Math.max(1, 1.02 / aspect) * (overview && this.layout ? Math.max(1, this.layout.size / 22) : 1);
    // The original framing: the camera sits at target + (14, 11, 18) × scale.
    const radius = Math.hypot(14, 11, 18) * scale;
    return { radius, phi: Math.acos(11 / Math.hypot(14, 11, 18)), theta: Math.atan2(14, 18) };
  }
  updateFocus(target, force = false) {
    if (force || this.focus.distanceToSquared(target) > 0.0001) {
      this.focus.copy(target); this.sun.target.position.copy(target);
      this.sun.position.copy(target).add(this.sunOffset); this.sun.shadow.needsUpdate = true;
    }
  }
  updateLamps() {
    if (this.lampRevision === this.lightRevision && this.lastLampFocus.distanceToSquared(this.focus) < 0.25) return;
    const selected = this.emitters.filter(emitter => emitter.active)
      .sort((a, b) => a.position.distanceToSquared(this.focus) - b.position.distanceToSquared(this.focus));
    this.lamps.forEach((lamp, i) => {
      const emitter = selected[i]; lamp.intensity = emitter ? this.graphics.lampIntensity : 0;
      if (emitter) lamp.position.copy(emitter.position);
    });
    this.lastLampFocus.copy(this.focus); this.lampRevision = this.lightRevision;
  }
  render(dt, moving) {
    this.renderer.info.reset();
    if (moving) this.sun.shadow.needsUpdate = true;
    this.sky.position.copy(this.camera.position); this.sky.scale.setScalar(this.camera.far * 0.8);
    this.updateLamps(); this.flash.intensity *= Math.exp(-dt * 9);
    const tier = this.kit.tier;
    if (this.bloomEnabled) this.bloomPost.render();
    else if (!tier.msaa && tier.name !== 'low') (this.plainPost ??= createPost(this.kit, this.scene, this.camera)).render();
    else this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    this.lastRenderStats = { drawCalls: info.render?.drawCalls ?? info.render?.calls ?? 0, triangles: info.render?.triangles ?? 0 };
  }
  burst(point, strength = 1) { this.flash.position.fromArray(point); this.flash.intensity = 18 * strength; this.sun.shadow.needsUpdate = true; }
  get backend() { return this.kit.backendLabel; }
  dispose() {
    this.bloomPost?.dispose(); this.plainPost?.dispose(); this.environment?.dispose();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse(object => { if (object.isMesh) { geometries.add(object.geometry); materials.add(object.material); } });
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
  }
}
