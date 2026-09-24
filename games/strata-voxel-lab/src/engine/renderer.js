import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { PROFILES } from './config.js';
import { sanitiseGraphics } from './settings.js';
import { MAT } from '../voxel/palette.js';
import { makeSky, environmentTexture, waterMaterial, makeMaterialUniforms } from './materials.js';

export class Viewport {
  static async create(container, profile, onLost, graphics = PROFILES[profile].graphics) {
    let renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false,
      forceWebGL: new URLSearchParams(location.search).get('backend') === 'webgl' });
    try { await renderer.init(); }
    catch (firstError) {
      console.warn('WebGPU setup failed. Trying WebGL 2.', firstError);
      try { renderer.dispose(); } catch { /* The first backend can be incomplete. */ }
      renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL: true });
      await renderer.init();
    }
    const defaultLost = renderer.onDeviceLost.bind(renderer);
    renderer.onDeviceLost = info => { defaultLost(info); onLost(info.message || 'Graphics device lost.'); };
    renderer.domElement.setAttribute('aria-label', 'Interactive voxel scene');
    renderer.domElement.setAttribute('tabindex', '0'); container.append(renderer.domElement);
    const view = new Viewport(renderer, profile, graphics);
    const hdr = environmentTexture(), generator = new THREE.PMREMGenerator(renderer);
    try {
      view.environment = await generator.fromEquirectangularAsync(hdr);
      view.scene.environment = view.environment.texture;
    } finally { hdr.dispose(); generator.dispose(); }
    return view;
  }
  constructor(renderer, profile, graphics) {
    this.renderer = renderer; this.scene = new THREE.Scene(); this.profileName = profile;
    this.scene.fog = new THREE.FogExp2(0xabb4aa, 0.006);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 500);
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
    this.post = null; this.pass = null; this.bloomNode = null; this.lastRenderStats = {};
    this.waters = []; this.lamps = []; this.emitters = []; this.lightRevision = 0; this.lampRevision = -1;
    this.lastLampFocus = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.hardwareMaxDimension = this.getHardwareMaxDimension(); this.graphics = null;
    this.applyGraphics(graphics);
  }
  getHardwareMaxDimension() {
    const backend = this.renderer.backend;
    if (backend.device?.limits?.maxTextureDimension2D) return backend.device.limits.maxTextureDimension2D;
    const gl = backend.gl;
    if (gl?.getParameter) return Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    return Infinity;
  }
  decorate(layout) {
    for (const water of this.waters) { this.scene.remove(water); water.geometry.dispose(); water.material.dispose(); }
    this.waters = layout.pools.map(pool => {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(pool.width, pool.depth), waterMaterial(this.materialUniforms));
      water.rotation.x = -Math.PI / 2; water.position.set(pool.x, pool.y, pool.z);
      water.receiveShadow = true; this.scene.add(water); return water;
    });
    this.layout = layout; this.floor.scale.setScalar(Math.max(200, layout.size * 3));
    this.emitters = layout.lights.map((point, i) => ({ position: new THREE.Vector3().fromArray(point), cell: layout.lightCells[i], active: true }));
    this.lightRevision++; this.updateFocus(new THREE.Vector3().fromArray(layout.focus), true);
  }
  updateEmitters(world) {
    for (const emitter of this.emitters) emitter.active = world.get(...emitter.cell) === MAT.GLOW;
    this.lightRevision++;
  }
  home(target = this.layout?.focus || [-0.5, 1.65, -0.4], overview = false) {
    const aspect = innerWidth / innerHeight;
    const distance = Math.max(1, 1.02 / aspect) * (overview ? Math.max(1, this.layout.size / 22) : 1);
    this.camera.position.set(target[0] + 14 * distance, target[1] + 11 * distance, target[2] + 18 * distance);
    this.camera.lookAt(new THREE.Vector3().fromArray(target));
    this.updateFocus(new THREE.Vector3().fromArray(target), true);
  }
  setProfile(name, graphics) {
    if (!Object.hasOwn(PROFILES, name)) throw new RangeError(`Unknown profile: ${name}`);
    this.profileName = name; this.applyGraphics(graphics || PROFILES[name].graphics);
  }
  applyGraphics(values) {
    const previous = this.graphics, g = sanitiseGraphics(this.profileName, values); this.graphics = g;
    for (const [key, node] of Object.entries(this.materialUniforms)) node.value = g[key];
    this.renderer.toneMappingExposure = g.exposure; this.sun.intensity = g.sunIntensity;
    this.scene.environmentIntensity = g.environmentIntensity; this.ambient.intensity = g.ambientIntensity;
    this.scene.fog.density = g.fogDensity;
    this.camera.fov = g.fov; this.camera.far = g.drawDistance; this.camera.updateProjectionMatrix();
    const shadow = this.sun.shadow, shadowEnabled = g.shadowSize > 0;
    if (this.sun.castShadow !== shadowEnabled) {
      this.sun.castShadow = shadowEnabled;
      this.scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
    }
    this.actualShadowSize = shadowEnabled ? Math.min(g.shadowSize, this.hardwareMaxDimension) : 0;
    if (!previous || previous.shadowSize !== g.shadowSize) {
      shadow.mapSize.setScalar(Math.max(1, this.actualShadowSize));
      shadow.map?.setSize(Math.max(1, this.actualShadowSize), Math.max(1, this.actualShadowSize));
    }
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
    this.setBloom(g.bloomStrength);
    if (this.bloomNode) {
      this.bloomNode.strength.value = g.bloomStrength; this.bloomNode.radius.value = g.bloomRadius;
      this.bloomNode.threshold.value = g.bloomThreshold;
    }
    if (!previous || previous.renderScale !== g.renderScale) this.resize();
  }
  setBloom(strength) {
    this.bloomEnabled = strength > 0;
    if (this.bloomEnabled && !this.post) {
      this.post = new THREE.PostProcessing(this.renderer); this.pass = pass(this.scene, this.camera);
      const output = this.pass.getTextureNode('output');
      this.bloomNode = bloom(output, strength, this.graphics.bloomRadius, this.graphics.bloomThreshold);
      this.post.outputNode = output.add(this.bloomNode);
    }
  }
  resize() {
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.scale = this.graphics.renderScale;
    const requestedDpr = (devicePixelRatio || 1) * this.scale;
    // Only a reported hardware limit can reduce the requested drawing-buffer size.
    this.dpr = Math.min(requestedDpr, this.hardwareMaxDimension / width, this.hardwareMaxDimension / height);
    this.resolutionHardwareLimited = this.dpr < requestedDpr;
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(width, height);
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
    if (this.bloomEnabled) this.post.render(); else this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    this.lastRenderStats = { drawCalls: info.render?.drawCalls ?? info.render?.calls ?? 0, triangles: info.render?.triangles ?? 0 };
  }
  burst(point) { this.flash.position.fromArray(point); this.flash.intensity = 18; this.sun.shadow.needsUpdate = true; }
  get backend() { return this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'; }
  dispose() {
    this.bloomNode?.dispose(); this.pass?.dispose(); this.post?.dispose(); this.environment?.dispose();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse(object => { if (object.isMesh) { geometries.add(object.geometry); materials.add(object.material); } });
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
