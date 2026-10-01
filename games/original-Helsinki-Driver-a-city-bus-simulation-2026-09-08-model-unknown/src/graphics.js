import * as THREE from 'three/webgpu';
import { createMaterials, skyTexture, applyWeatherToMaterials, setLegacy } from './materials.js';
import { CityGraphics } from './city.js';
import { BusGraphics } from './bus.js';
import { forward, right, clamp, damp } from './math.js';

/** Looks per weather. Light units are the original's (it already rendered physically correct lights); colours are set as r140 did (setLegacy). */
const WEATHER = {
  dry: { fog: 0xc4d2d9, density: 0.001, sun: 0xffecd3, sunI: 3.0, hemiSky: 0xb3d3e5, hemiGround: 0x7a7964, hemiI: 0.65, exposure: 1.02, sunAt: [-95, 170, -85], headlight: 0 },
  damp: { fog: 0xc4d2d9, density: 0.001, sun: 0xffecd3, sunI: 3.0, hemiSky: 0xb3d3e5, hemiGround: 0x7a7964, hemiI: 0.65, exposure: 1.02, sunAt: [-95, 170, -85], headlight: 0 },
  rain: { fog: 0xb1bec7, density: 0.0019, sun: 0xffecd3, sunI: 1.1, hemiSky: 0xb3d3e5, hemiGround: 0x7a7964, hemiI: 0.65, exposure: 1.12, sunAt: [-95, 170, -85], headlight: 0 },
  evening: { fog: 0x8d8796, density: 0.0013, sun: 0xffb27a, sunI: 1.55, hemiSky: 0x7d8fb8, hemiGround: 0x463a35, hemiI: 0.5, exposure: 1.18, sunAt: [-175, 46, -70], headlight: 48 },
};
const MIRROR_RT = { low: [128, 186], medium: [176, 256], high: [224, 325], ultra: [288, 418] };
const RAIN_MAX = 700;
const _t = new THREE.Vector3();

export class Graphics {
  constructor(kit, world, options = {}) {
    this.kit = kit; this.renderer = kit.renderer; this.world = world; this.mode = 'cockpit'; this.look = { x: 0, y: 0 };
    this.fps = 0; this.fpsClock = 0; this.frameCount = 0; this.calls = 0; this.frame = 0; this.weather = null;
    const renderer = this.renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2(0xc4d2d9, 0.001);
    this.hemi = new THREE.HemisphereLight(0xb3d3e5, 0x7a7964, 0.65); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffecd3, 3.0); this.sun.castShadow = true; kit.shadow(this.sun, 2048);
    this.sun.shadow.bias = -0.00018; this.sun.shadow.normalBias = 0.1; this.sun.shadow.radius = 2; this.applyShadowCamera(kit.tier);
    this.scene.add(this.sun, this.sun.target); this.sunAt = WEATHER.dry.sunAt; this.lastShadow = [Infinity, Infinity];
    this.mats = createMaterials();
    this.city = new CityGraphics(this.scene, world, this.mats); this.city.range = 1050 * kit.tier.drawDistance;
    this.bus = new BusGraphics(this.scene, this.mats, world);
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.06, 1800); this.camera.layers.enable(1); this.scene.add(this.camera);
    this.chasePos = new THREE.Vector3(); this.snap = true; this.sway = { x: 0, y: 0 };
    this.buildMirrors(); this.buildRain();
    this.mirrors = options.mirrors ?? kit.tier.name !== 'low';
    kit.onResize((w, h) => { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.layoutMirrors(w, h); });
    // The mirror targets keep the size picked at load: resizing one that the cab view samples destroys a texture
    // the next main pass still uses on WebGPU. A new quality applies to them on the next load.
    kit.onQuality((tier) => {
      this.city.range = 1050 * tier.drawDistance; this.applyShadowCamera(tier);
      this.rain.geometry.setDrawRange(0, Math.min(RAIN_MAX, kit.detail(RAIN_MAX)) * 2);
    });
    this.setWeather(options.weather || 'dry');
  }
  applyShadowCamera(tier) {
    const d = tier.name === 'low' ? 95 : 140;
    Object.assign(this.sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 5, far: 600 }); this.sun.shadow.camera.updateProjectionMatrix();
  }
  // ---- live rear-view mirrors: small render targets shown on two quads fixed to the camera (layer 1, so the
  // mirror cameras never see them). The main pass draws everything once; mirrors update on alternate frames.
  buildMirrors() {
    this.mirrorViews = [-1, 1].map((side) => {
      const [w, h] = MIRROR_RT[this.kit.tier.name] || MIRROR_RT.high;
      const target = new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      const geo = new THREE.PlaneGeometry(1, 1), uv = geo.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); // mirrored image
      const quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: target.texture, depthTest: false, depthWrite: false, fog: false, transparent: true }));
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.92 })); setLegacy(frame.material.color, 0x0b161c);
      for (const [m, order] of [[quad, 1001], [frame, 1000]]) { m.renderOrder = order; m.frustumCulled = false; m.layers.set(1); m.visible = false; this.camera.add(m); }
      return { side, target, quad, frame, cam: new THREE.PerspectiveCamera(55, 0.69, 0.15, 300) };
    });
  }
  layoutMirrors(W, H) {
    const w = clamp(W * 0.11, 56, 145), h = w * 1.45, top = 114, d = 0.3;
    const halfH = d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), halfW = halfH * (W / H);
    for (const m of this.mirrorViews) {
      const x = m.side < 0 ? 14 : W - w - 14, nx = ((x + w / 2) / W) * 2 - 1, ny = 1 - ((top + h / 2) / H) * 2;
      m.quad.position.set(nx * halfW, ny * halfH, -d); m.quad.scale.set((w / W) * 2 * halfW, (h / H) * 2 * halfH, 1);
      m.frame.position.set(nx * halfW, ny * halfH, -d); m.frame.scale.set(((w + 6) / W) * 2 * halfW, ((h + 6) / H) * 2 * halfH, 1);
      m.cam.aspect = w / h; m.cam.updateProjectionMatrix();
    }
  }
  buildRain() {
    const pos = new Float32Array(RAIN_MAX * 6); this.rainDrops = new Float32Array(RAIN_MAX * 3);
    const r = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < RAIN_MAX; i++) this.rainDrops.set([(Math.abs(r(i + 1)) - 0.5) * 60, Math.abs(r(i + 7)) * 22, (Math.abs(r(i + 13)) - 0.5) * 60], i * 3);
    const geo = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(pos, 3); attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('position', attr);
    geo.setDrawRange(0, Math.min(RAIN_MAX, this.kit.detail(RAIN_MAX)) * 2);
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false })); setLegacy(this.rain.material.color, 0xd9e6e1);
    this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
  }
  updateRain(dt) {
    if (!this.rain.visible) return;
    const drops = this.rainDrops, pos = this.rain.geometry.getAttribute('position'), a = pos.array, c = this.camera.position, n = this.rain.geometry.drawRange.count / 2;
    for (let i = 0; i < Math.min(n, RAIN_MAX); i++) {
      const k = i * 3; let y = drops[k + 1] - dt * 17; if (y < 0) y += 22; drops[k + 1] = y;
      const x = c.x + drops[k], z = c.z + drops[k + 2], yy = c.y - 6 + y, o = i * 6;
      a[o] = x; a[o + 1] = yy; a[o + 2] = z; a[o + 3] = x - 0.08; a[o + 4] = yy - 0.85; a[o + 5] = z + 0.12;
    }
    pos.needsUpdate = true;
  }
  setWeather(weather) {
    if (!WEATHER[weather]) weather = 'dry';
    if (weather === this.weather) return; this.weather = weather; const w = WEATHER[weather];
    const sky = skyTexture(weather); this.scene.background = sky; this.scene.environment = sky;
    setLegacy(this.scene.fog.color, w.fog); this.scene.fog.density = w.density;
    setLegacy(this.sun.color, w.sun); this.sun.intensity = w.sunI; this.sunAt = w.sunAt; this.lastShadow = [Infinity, Infinity];
    setLegacy(this.hemi.color, w.hemiSky); setLegacy(this.hemi.groundColor, w.hemiGround); this.hemi.intensity = w.hemiI;
    this.renderer.toneMappingExposure = w.exposure; applyWeatherToMaterials(this.mats, weather);
    this.rain.visible = weather === 'rain'; this.headlightLevel = w.headlight;
  }
  /** A different city pack: the corridor is rebuilt, the shared materials stay. */
  setWorld(world) {
    this.city.dispose(); this.world = world;
    this.city = new CityGraphics(this.scene, world, this.mats); this.city.range = 1050 * this.kit.tier.drawDistance;
    this.bus.setRoute(world); this.bus.clearRiders(); this.lastShadow = [Infinity, Infinity]; this.snap = true;
  }
  /** A new simulation on the same pack. */
  resetActors() { this.city.resetActors(); this.bus.clearRiders(); this.snap = true; }
  setMode(mode) { this.mode = mode; this.look.x = this.look.y = 0; this.snap = true; }
  cycleCamera() { this.setMode(this.mode === 'cockpit' ? 'chase' : this.mode === 'chase' ? 'street' : 'cockpit'); return this.mode; }
  get mirrorsActive() { return this.mirrors && this.mode === 'cockpit' && !this.inMenu; }
  update(sim, dt, menu = false, time = 0) {
    this.inMenu = menu; const b = sim.bus, cam = this.camera;
    this.city.update(sim); this.bus.update(sim, dt);
    this.bus.headlight.intensity = b.lights ? this.headlightLevel : 0;
    const f = forward(b.yaw), r = right(b.yaw);
    if (menu) {
      // A slow drift around the waiting bus behind the title card.
      const a = Math.sin(time * 0.07) * 0.35, ca = Math.cos(a), sa = Math.sin(a), ox = f[0] * 13 - r[0] * 12, oz = f[1] * 13 - r[1] * 12;
      cam.position.set(b.x + ox * ca - oz * sa, 4.1, b.z + ox * sa + oz * ca); cam.lookAt(b.x, 1.7, b.z); this.snap = true;
    } else if (this.mode === 'cockpit') {
      // A little body sway with braking and cornering; the driver's eye stays put otherwise.
      this.sway.x = damp(this.sway.x, clamp(-b.lateralAcceleration * 0.012, -0.05, 0.05), 4, dt); this.sway.y = damp(this.sway.y, clamp(b.acceleration * 0.006, -0.03, 0.03), 5, dt);
      const ex = b.x + f[0] * 4.0 - r[0] * 0.7 + r[0] * this.sway.x, ez = b.z + f[1] * 4.0 - r[1] * 0.7 + r[1] * this.sway.x;
      cam.position.set(ex, 1.93 - b.kneel * 0.09 + Math.min(0.025, Math.abs(b.acceleration) * 0.004) - this.sway.y, ez);
      const dir = forward(b.yaw + this.look.x); cam.lookAt(ex + dir[0] * 20, 1.2 + this.look.y * 11, ez + dir[1] * 20);
    } else if (this.mode === 'chase') {
      const a = this.look.x, ca = Math.cos(a), sa = Math.sin(a), ox = -f[0] * 14 + r[0] * 3, oz = -f[1] * 14 + r[1] * 3;
      _t.set(b.x + ox * ca - oz * sa, 6.0 + this.look.y * 4, b.z + ox * sa + oz * ca);
      if (this.snap) cam.position.copy(_t); else cam.position.lerp(_t, 1 - Math.exp(-dt * 7));
      cam.lookAt(b.x + f[0] * 4, 1.8, b.z + f[1] * 4);
    } else {
      cam.position.set(b.x + f[0] * 10 - r[0] * 12, 3, b.z + f[1] * 10 - r[1] * 12); cam.lookAt(b.x, 1.4, b.z);
    }
    if (!menu) this.snap = false;
    if (Math.hypot(b.x - this.lastShadow[0], b.z - this.lastShadow[1]) > 4) {
      const x = Math.round(b.x / 4) * 4, z = Math.round(b.z / 4) * 4, o = this.sunAt;
      this.sun.position.set(x + o[0], o[1], z + o[2]); this.sun.target.position.set(x, 0, z); this.lastShadow = [b.x, b.z];
    }
    this.updateRain(dt);
    const showMirrors = this.mirrorsActive; for (const m of this.mirrorViews) m.quad.visible = m.frame.visible = showMirrors;
    if (showMirrors) for (const m of this.mirrorViews) {
      const side = m.side, px = b.x + f[0] * 5.24 + r[0] * side * 1.54, pz = b.z + f[1] * 5.24 + r[1] * side * 1.54;
      m.cam.position.set(px, 2.4 - b.kneel * 0.1, pz); m.cam.lookAt(px - f[0] * 20 + r[0] * side * 2, 1.4, pz - f[1] * 20 + r[1] * side * 2);
    }
  }
  render() {
    const r = this.renderer; this.frame++;
    r.render(this.scene, this.camera); this.calls = r.info.render.calls;
    if (this.mirrorsActive) this.renderMirrors(this.frame % 2);
    const now = performance.now(); this.fpsClock += (now - (this.wallFrame || now)) / 1000; this.wallFrame = now; this.frameCount++;
    if (this.fpsClock > 0.6) { this.fps = this.frameCount / this.fpsClock; this.fpsClock = 0; this.frameCount = 0; }
  }
  /** Render one mirror (or both with which = -1). The sun's shadow map from the main pass is reused. */
  renderMirrors(which = -1) {
    const r = this.renderer, sun = this.sun.shadow;
    sun.autoUpdate = false;
    try { for (let i = 0; i < 2; i++) if (which < 0 || which === i) { const m = this.mirrorViews[i]; r.setRenderTarget(m.target); r.render(this.scene, m.cam); } }
    finally { r.setRenderTarget(null); sun.autoUpdate = true; }
  }
  /** Compile what appears later (mirrors, rain, ramp) behind the loading card. */
  async prewarm(sim) {
    const rain = this.rain.visible, ramp = this.bus.ramp.visible;
    this.rain.visible = true; this.bus.ramp.visible = true;
    try {
      this.update(sim, 1 / 60, false, 0);
      for (const m of this.mirrorViews) m.quad.visible = m.frame.visible = true;
      await Promise.race([this.renderer.compileAsync(this.scene, this.camera), new Promise((res) => setTimeout(res, 4000))]);
      this.render(); this.renderMirrors(-1);
    } catch (e) { console.warn('Precompile skipped:', e); }
    finally { this.rain.visible = rain; this.bus.ramp.visible = ramp; }
  }
}
