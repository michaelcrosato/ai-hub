// The world scene: streaming terrain, wildlife, day and night, weather, and
// the per-frame step the kit loop drives.

import * as THREE from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { CONFIG, rng, lerp, clamp } from './config.js';
import { World, ChunkManager, BoxBatch, RING } from './world.js';
import { Wildlife } from './wildlife.js';
import { Controls } from './controls.js';
import { Precipitation } from './weather.js';

const STEP = CONFIG.simulationStep;
const EYE = CONFIG.eyeHeight;
const VIEW_KEYS = Object.keys(CONFIG.viewRadii);
const WEATHER_SETTINGS = ['clear', 'overcast', 'rain', 'changing'];

const NIGHT_SKY = new THREE.Color(1189947);
const DAY_SKY = new THREE.Color(12639458);
const OVERCAST_SKY = new THREE.Color(12438727);
const RAIN_SKY = new THREE.Color(0x8e9b9e);
const DAWN_SKY = new THREE.Color(15058341);
const _day = new THREE.Color();
const _sky = new THREE.Color();
const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** Weather that follows `from` when the setting is "changing". */
function nextWeather(from) {
  const r = Math.random();
  if (from === 'clear') return r < 0.55 ? 'overcast' : r < 0.85 ? 'clear' : 'rain';
  if (from === 'overcast') return r < 0.4 ? 'rain' : r < 0.8 ? 'clear' : 'overcast';
  return r < 0.6 ? 'overcast' : r < 0.9 ? 'clear' : 'rain';
}

export class Game extends EventTarget {
  constructor(kit) {
    super();
    this.kit = kit;
    this.renderer = kit.renderer;
    this.canvas = kit.canvas;
    this.world = new World();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(13164256);
    this.scene.fog = new THREE.Fog(13164256, 720, 1450);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(57, 1, 0.3, 2500));
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.chunks = new ChunkManager(this.scene, this.world);
    this.wildlife = new Wildlife(this.scene, this.world);
    this.wildlife.maxAnimals = kit.detail(CONFIG.maxAnimals, 16);
    this.controls = new Controls(this.camera, this.world, kit.input);

    this.ambient = new THREE.HemisphereLight(14477289, 6782281, 2.05);
    this.scene.add(this.ambient);

    // The sun: one directional light with cascaded shadow maps (near detail, far reach).
    this.sun = new THREE.DirectionalLight(16772299, 3.15);
    this.sun.castShadow = true;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -6e-5;
    this.sun.shadow.normalBias = 0.3;
    this.csm = new CSMShadowNode(this.sun, { cascades: 3, maxFar: 1400, mode: 'practical', lightMargin: 200 });
    this.csm.fade = true;
    this.sun.shadow.shadowNode = this.csm;
    this.sun.position.set(-60, 100, 40);
    this.scene.add(this.sun, this.sun.target);
    this.applyShadowQuality();

    this.lantern = new THREE.SpotLight(16765852, 0, 110, Math.PI / 4, 0.5, 1.7);
    this.lantern.castShadow = true;
    kit.shadow(this.lantern, 1024);
    this.lantern.shadow.bias = -3e-4;
    this.lantern.shadow.normalBias = 0.12;
    this.lantern.visible = false;
    this.scene.add(this.lantern, this.lantern.target);

    this.hour = 8.7;
    this.day = 1;
    this.cycle = true;
    this.weatherSetting = 'clear';
    this.weather = 'clear';
    this.weatherClock = 3;
    this.cloud = 0;
    this.rain = 0;
    this.snowy = false;
    this.viewDistance = 'balanced';
    this.lanternOn = false;
    this.accumulator = 0;
    this.fps = 0;
    this.frames = 0;
    this.fpsTime = 0;
    this.uiTime = 0;
    this.ready = false;
    this.paused = false;
    this.worldTime = 0;
    this.fogNear = 720;
    this.fogFar = 1450;

    this.precipitation = new Precipitation(this.scene, kit);
    this.environment();
    kit.onQuality(() => {
      this.applyShadowQuality();
      this.wildlife.maxAnimals = kit.detail(CONFIG.maxAnimals, 16);
    });
    kit.onResize(() => this.refreshShadowFrustums());
    this.resetView();
  }

  /** Shadow map size for the tier, on the sun's cascades too (they copy the sun's shadow when created). */
  applyShadowQuality() {
    const size = this.kit.shadowSize(CONFIG.shadowSize);
    this.sun.shadow.mapSize.set(size, size);
    for (const light of this.csm.lights) light.shadow.mapSize.set(size, size);
  }

  /** The cascades follow the camera's aspect and far plane; they only exist after the first render. */
  refreshShadowFrustums() {
    if (this.csm.camera) this.csm.updateFrustums();
  }

  resetView() {
    this.camera.position.set(154, 110, 238);
    this.controls.lookAt(_look.set(-70, 25, -220));
    this.controls.mode = 'fly';
    this.controls.velocityY = 0;
    this.chunks.refresh(this.camera.position);
  }

  environment() {
    const rand = rng(77319);
    const clouds = new BoxBatch();
    for (let i = 0; i < 46; i++) {
      const x = (rand() - 0.5) * 3100;
      const z = (rand() - 0.5) * 3100;
      const y = 280 + rand() * 130;
      for (let u = 0; u < 3; u++) clouds.add(x + u * 26, y + (u % 2) * 6, z + (u % 2) * 9, 50 + rand() * 40, 10 + rand() * 12, 30 + rand() * 35, 15856095);
    }
    this.clouds = new THREE.Group();
    this.clouds.add(clouds.mesh(new THREE.MeshStandardMaterial({ color: 16777215, roughness: 1 })));
    this.scene.add(this.clouds);
    // Silverfall: the upper river drops off its ledge onto the valley floor.
    const rx = this.world.riverX(-300);
    const fall = new BoxBatch();
    for (let i = 0; i < 9; i++) fall.add(rx - 15 + i * 3.8, 28, -299, 3.8, 32, 2.8, i % 3 ? 10606545 : 12641758);
    this.fallMaterial = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
    this.fall = fall.mesh(this.fallMaterial);
    this.scene.add(this.fall);
    const foam = new BoxBatch();
    for (let i = 0; i < 30; i++) foam.add(rx + (rand() - 0.5) * 42, 12.5, -294 + rand() * 15, 1 + rand() * 2, 0.5, 1 + rand() * 3, 13690579);
    this.foam = foam.mesh(this.fallMaterial);
    this.scene.add(this.foam);
    // The sunstone floats over the ring's altar and glows as the light fails.
    this.sunstoneMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b85c, roughness: 0.35, metalness: 0.1, emissive: 0xffa640, emissiveIntensity: 0.3 });
    this.sunstone = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), this.sunstoneMaterial);
    this.sunstone.castShadow = true;
    this.sunstone.rotation.set(0.62, 0, 0.62);
    this.scene.add(this.sunstone);
    this.placeLandmarks();
  }

  /** Landmarks whose height depends on the seed. */
  placeLandmarks() {
    this.sunstoneY = this.world.ringTop() + 4.1;
    this.sunstone.position.set(RING.x, this.sunstoneY, RING.z);
  }

  setViewDistance(key) {
    if (!VIEW_KEYS.includes(key)) key = 'balanced';
    this.viewDistance = key;
    this.chunks.setViewDistance(key);
    const far = CONFIG.viewRadii[key] * 96;
    this.camera.far = far + 180;
    this.camera.updateProjectionMatrix();
    this.fogNear = far * 0.55;
    this.fogFar = far + 100;
    this.csm.maxFar = far;
    this.refreshShadowFrustums();
  }

  setWeather(setting) {
    if (!WEATHER_SETTINGS.includes(setting)) setting = 'clear';
    this.weatherSetting = setting;
    if (setting !== 'changing') this.weather = setting;
    else this.weatherClock = 2 + Math.random() * 3;
  }

  get daylight() {
    return clamp(Math.sin(((this.hour - 6) / 24) * Math.PI * 2) * 3, 0, 1);
  }

  get isNight() {
    return Math.sin(((this.hour - 6) / 24) * Math.PI * 2) < 0;
  }

  /** Early morning, when the sunstone photo counts. */
  get isDawn() {
    return this.hour >= 5.75 && this.hour <= 7.5;
  }

  updateWeather(dt) {
    if (!this.paused && this.weatherSetting === 'changing') {
      this.weatherClock -= (dt * 24) / CONFIG.dayLength;
      if (this.weatherClock <= 0) {
        this.weather = nextWeather(this.weather);
        this.weatherClock = 2 + Math.random() * 4;
      }
    }
    const k = 1 - Math.exp(-dt * 0.6);
    this.cloud += ((this.weather === 'clear' ? 0 : 1) - this.cloud) * k;
    this.rain += ((this.weather === 'rain' ? 1 : 0) - this.rain) * k;
    const p = this.camera.position;
    this.snowy = p.y > 175 || this.world.groundAt(p.x, p.z) > 135;
  }

  lighting() {
    const t = ((this.hour - 6) / 24) * Math.PI * 2;
    const e = Math.sin(t);
    const light = clamp(e * 3, 0, 1);
    const cloud = this.cloud;
    const rain = this.rain;
    _day.copy(DAY_SKY).lerp(OVERCAST_SKY, cloud).lerp(RAIN_SKY, rain * 0.55);
    _sky.copy(NIGHT_SKY).lerp(_day, light);
    if (e > 0 && e < 0.3) _sky.lerp(DAWN_SKY, 0.38 * (1 - rain * 0.6));
    this.scene.background.copy(_sky);
    this.scene.fog.color.copy(_sky);
    this.scene.fog.near = this.fogNear * (1 - rain * 0.55);
    this.scene.fog.far = this.fogFar * (1 - rain * 0.4);
    const night = e < 0;
    _dir.set(Math.cos(t) * 0.75, -Math.max(Math.abs(e), 0.16), -0.43).normalize();
    // The light shines along _dir: it sits up-sun of the origin and aims at it.
    this.sun.position.copy(_dir).multiplyScalar(-100);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = night ? 0.8 : lerp(3.15, 1.4, cloud) * (1 - rain * 0.25);
    this.sun.color.set(night ? 11389421 : 16772299);
    this.ambient.intensity = night ? 0.65 : lerp(1.95, 2, cloud) * (1 - rain * 0.15);
    this.ambient.color.set(night ? 6913703 : 14675181);
    this.renderer.toneMappingExposure = night ? 0.85 : 1.1;
    this.lantern.intensity = this.lanternOn ? 130 : 0;
    this.lantern.visible = this.lanternOn;
    if (this.lanternOn) {
      this.lantern.position.copy(this.camera.position);
      this.camera.getWorldDirection(_look);
      this.lantern.target.position.copy(this.camera.position).addScaledVector(_look, 30);
    }
    this.sunstoneMaterial.emissiveIntensity = 0.3 + (1 - light) * 1.3;
  }

  travel(place) {
    this.controls.mode = 'fly';
    this.controls.velocityY = 0;
    const y = this.world.groundAt(place.x, place.z);
    this.camera.position.set(place.x + 60, y + 75, place.z + 95);
    this.controls.lookAt(_look.set(place.x, y + 4, place.z));
    this.chunks.refresh(this.camera.position);
    this.wildlife.spawnCenter = null;
    this.dispatchEvent(new Event('travel'));
  }

  observe(animal) {
    this.camera.position.set(animal.x + 12, animal.y + 9, animal.z + 18);
    this.controls.mode = 'fly';
    this.controls.velocityY = 0;
    this.controls.keepAboveGround();
    this.controls.lookAt(_look.set(animal.x, animal.y + 1.6, animal.z));
    this.dispatchEvent(new Event('travel'));
  }

  regenerate(seed) {
    this.world.reset(seed);
    this.chunks.clear();
    this.wildlife.reset();
    this.placeLandmarks();
    this.day = 1;
    this.hour = 8.7;
    this.resetView();
    this.dispatchEvent(new Event('travel'));
  }

  setPaused(on) {
    this.paused = on;
    if (on) this.controls.active = false;
  }

  /**
   * Build the GPU pipelines for things that are hidden at first (the lantern's
   * light changes every lit material; rain and snow appear later), so the
   * first lantern or shower does not stutter. The loop pauses meanwhile, or a
   * frame in between would put the scene back the way it was.
   */
  async prepare() {
    const kit = this.kit;
    kit.pause(true);
    // 'ready' fires inside a frame: let that frame finish (it puts the lantern and the rain back) first.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      this.lantern.visible = true;
      this.precipitation.preview(true);
      await this.renderer.compileAsync(this.scene, this.camera);
      this.lantern.visible = this.lanternOn;
      this.precipitation.preview(false);
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* only an optimisation */
    } finally {
      this.lantern.visible = this.lanternOn;
      this.precipitation.preview(false);
      kit.pause(false);
    }
  }

  /** Animals a photo taken now would show: in frame, within 90 m and not behind a hill. */
  animalsInView() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.getWorldDirection(_fwd);
    const from = cam.position;
    const out = [];
    for (const animal of this.wildlife.animals) {
      const height = 1.5 * animal.data.size;
      _v.copy(animal.mesh.position);
      _v.y += height;
      const distance = _v.distanceTo(from);
      if (distance > 90) continue;
      _look.subVectors(_v, from);
      if (_look.dot(_fwd) <= 0) continue;
      _v.project(cam);
      if (Math.abs(_v.x) > 0.96 || Math.abs(_v.y) > 0.96 || _v.z > 1) continue;
      if (this.hiddenByTerrain(from, animal.x, animal.mesh.position.y + height, animal.z)) continue;
      out.push({ animal, distance });
    }
    return out;
  }

  hiddenByTerrain(from, x, y, z) {
    const dist = Math.hypot(x - from.x, z - from.z);
    const steps = Math.ceil(dist / 3);
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      if (this.world.groundAt(lerp(from.x, x, k), lerp(from.z, z, k)) > lerp(from.y, y, k) + 0.5) return true;
    }
    return false;
  }

  /** Draw a frame now and take the canvas as a PNG (same task, so both backends still hold the image). */
  capture() {
    return new Promise((resolve, reject) => {
      try {
        this.renderer.render(this.scene, this.camera);
        this.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Everything worth keeping between visits. */
  getState() {
    const p = this.camera.position;
    const round = (v) => Math.round(v * 100) / 100;
    return {
      v: 1,
      seed: this.world.seed,
      pos: [round(p.x), round(p.y), round(p.z)],
      yaw: round(this.controls.yaw),
      pitch: round(this.controls.pitch),
      mode: this.controls.mode,
      hour: round(this.hour),
      day: this.day,
      cycle: this.cycle,
      weather: this.weatherSetting,
      lantern: this.lanternOn,
      view: this.viewDistance,
    };
  }

  /** Restore a saved state (before the world has streamed in). Invalid fields keep their defaults. */
  applyState(s) {
    if (!s || typeof s !== 'object') return;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (Number.isInteger(s.seed) && s.seed >= 1 && s.seed <= 2147483647 && s.seed !== this.world.seed) {
      this.world.reset(s.seed);
      this.chunks.clear();
      this.wildlife.reset();
      this.placeLandmarks();
    }
    if (VIEW_KEYS.includes(s.view)) this.setViewDistance(s.view);
    if (num(s.hour)) this.hour = clamp(s.hour, 0, 23.99);
    if (Number.isInteger(s.day) && s.day >= 1) this.day = Math.min(s.day, 99999);
    if (typeof s.cycle === 'boolean') this.cycle = s.cycle;
    if (WEATHER_SETTINGS.includes(s.weather)) {
      this.setWeather(s.weather);
      this.cloud = this.weather === 'clear' ? 0 : 1;
      this.rain = this.weather === 'rain' ? 1 : 0;
    }
    if (typeof s.lantern === 'boolean') this.lanternOn = s.lantern;
    if (Array.isArray(s.pos) && s.pos.length === 3 && s.pos.every(num) && Math.abs(s.pos[0]) < 1e6 && Math.abs(s.pos[2]) < 1e6) {
      this.camera.position.set(s.pos[0], clamp(s.pos[1], -50, 700), s.pos[2]);
      if (num(s.yaw)) this.controls.yaw = s.yaw;
      if (num(s.pitch)) this.controls.pitch = clamp(s.pitch, -1.45, 1.45);
      this.controls.rotate();
      if (s.mode === 'walk') {
        this.controls.mode = 'walk';
        const p = this.controls.safePosition(s.pos[0], s.pos[2]);
        this.camera.position.set(p.x, p.y + EYE, p.z);
        this.controls.grounded = true;
      } else {
        this.controls.mode = 'fly';
        this.controls.keepAboveGround();
      }
      this.chunks.refresh(this.camera.position);
    }
  }

  step(dt) {
    this.controls.update(dt);
    this.chunks.refresh(this.camera.position);
    this.chunks.tick(this.ready ? 4 : 15);
    if (!this.ready) {
      let near = 0;
      for (const job of this.chunks.queue) if (job.dist < 3.5) near++;
      this.dispatchEvent(new CustomEvent('progress', { detail: 1 - near / 37 }));
      if (near === 0) {
        this.ready = true;
        this.wildlife.populate(this.camera.position);
        this.dispatchEvent(new Event('ready'));
      }
    }
    if (this.ready && !this.paused) {
      this.wildlife.populate(this.camera.position);
      this.accumulator += dt;
      let n = 0;
      while (this.accumulator >= STEP && n++ < 3) {
        this.wildlife.update(STEP);
        this.accumulator -= STEP;
      }
    }
    this.wildlife.render(clamp(this.accumulator / STEP, 0, 1), this.worldTime / 1000, dt);
    if (this.cycle && !this.paused) {
      this.hour += (dt * 24) / CONFIG.dayLength;
      if (this.hour >= 24) {
        this.hour -= 24;
        this.day++;
      }
    }
    if (!this.paused) this.worldTime += dt * 1000;
    this.clouds.position.x = (this.worldTime * 75e-5) % 150;
    this.foam.position.y = Math.sin(this.worldTime * 0.002) * 0.15;
    this.foam.position.z = Math.sin(this.worldTime * 8e-4) * 0.5;
    this.sunstone.position.y = this.sunstoneY + Math.sin(this.worldTime * 0.0011) * 0.3;
    this.sunstone.rotation.y = this.worldTime * 0.00035;
    this.updateWeather(dt);
    this.lighting();
    this.precipitation.update(this.paused ? 0 : dt, this.camera, this.rain, this.snowy, 0.28 + 0.72 * this.daylight);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.fpsTime += dt;
    this.uiTime += dt;
    if (this.fpsTime > 1) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
    }
    if (this.uiTime > 0.35) {
      this.uiTime = 0;
      this.dispatchEvent(new Event('tick'));
    }
  }

  dispose() {
    this.wildlife.reset();
    this.chunks.dispose();
    this.csm.dispose();
  }
}
