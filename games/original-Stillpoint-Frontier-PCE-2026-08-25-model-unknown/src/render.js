/**
 * render.js — everything that makes the frontier look like itself: the
 * vertex-coloured sky dome, sun disc, faceted moon, stars, the still ocean,
 * rain, the single celestial shadow light (sun or moon, whichever is
 * stronger), ambient light, exponential fog with a sun-side scattering glow,
 * a small pool of point lights for relays and camp gear, and the post chain
 * (bloom, colour grade, vignette) on kit/post.js.
 */
import * as THREE from 'three/webgpu';
import { uniform, renderGroup, fog, densityFogFactor, positionWorld, cameraPosition, normalize, dot, max, pow, vec3, vec4, mix, luminance, screenUV, length, smoothstep } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { WORLD } from './data.js';
import { celestialLighting } from './sky.js';
import { srgb, wetSurfaces, setEulerDeg, GEOMETRY } from './primitives.js';
import { srgbToLinear } from './terrain.js';

/** PlayCanvas's diffuse term has no 1/π; three.js lights are scaled by π to match. */
export const PC_LIGHT = Math.PI;
/** Range-limited omni lights: decay 0 plus a window falloff approximates PlayCanvas's linear falloff. */
export const PC_POINT = Math.PI * 0.55;

export const QUALITY_PROFILES = {
  low: { id: 'low', label: 'LOW', worldRadius: 2, shadowDistance: 70 },
  medium: { id: 'medium', label: 'MEDIUM', worldRadius: 2, shadowDistance: 90 },
  high: { id: 'high', label: 'HIGH', worldRadius: 3, shadowDistance: 140 },
  ultra: { id: 'ultra', label: 'ULTRA', worldRadius: 3, shadowDistance: 190 },
};

const _v = new THREE.Vector3();
const _cam = new THREE.Vector3();

/**
 * A fixed number of point lights handed to the nearest emitters. Keeping the
 * light count constant means deploying a campfire never recompiles shaders.
 */
class LightPool {
  constructor(scene, count) {
    this.lights = [];
    this.emitters = new Set();
    this.candidates = [];
    this.clock = 0;
    for (let i = 0; i < count; i += 1) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 0);
      light.castShadow = false;
      scene.add(light);
      this.lights.push(light);
    }
  }

  /** emitter: { position: Vector3, color: [r,g,b] sRGB, intensity (PlayCanvas units), range, enabled?: () => bool } */
  add(emitter) {
    emitter.linear = new THREE.Color();
    srgb(emitter.linear, emitter.color[0], emitter.color[1], emitter.color[2]);
    this.emitters.add(emitter);
    this.clock = 0;
    return () => {
      this.emitters.delete(emitter);
      this.clock = 0;
    };
  }

  update(dt, eye) {
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0.2;
    const list = this.candidates;
    list.length = 0;
    for (const e of this.emitters) {
      if (e.enabled && !e.enabled()) continue;
      const d = e.position.distanceTo(eye) - e.range;
      if (d > 60) continue;
      e.score = d;
      list.push(e);
    }
    list.sort((a, b) => a.score - b.score);
    for (let i = 0; i < this.lights.length; i += 1) {
      const light = this.lights[i];
      const e = list[i];
      if (!e) {
        light.intensity = 0;
        continue;
      }
      light.position.copy(e.position);
      light.color.copy(e.linear);
      light.distance = e.range;
      light.intensity = e.intensity * PC_POINT;
    }
  }
}

export class RenderSystem {
  constructor(kit, scene, camera, materials, { seaLevel }) {
    this.kit = kit;
    this.scene = scene;
    this.camera = camera;
    this.materials = materials;
    this.seaLevel = seaLevel;
    this.features = { grade: true, shadows: true, bloom: true, atmosphere: true };
    this.sunDirection = new THREE.Vector3(-0.4, 0.55, -0.72).normalize();
    this.moonDirection = new THREE.Vector3(0.4, 0.4, 0.82).normalize();
    this.shadowDirection = this.sunDirection.clone();
    this.sunDirectIntensity = 0;
    this.moonDirectIntensity = 0;
    this.moonShadowBlend = 0;
    this.shadowSource = 'sun';
    this.shadowStrength = 0;
    this.precipitationStrength = 0;
    this.rainWind = 0;
    this.rainPhase = 0;
    this.rainWanted = false;
    /** Set by the game while the player is under a roof that hides the sky (the vault). */
    this.sheltered = false;
    this.lastWetness = -1;
    this.lastMoonSun = new THREE.Vector3();
    this.lastMoonIllumination = -1;
    this.shadowResizes = 0;
    this.wet = wetSurfaces(materials);

    const renderer = kit.renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    scene.background = srgb(new THREE.Color(), 0.025, 0.065, 0.075);

    this.ambient = new THREE.AmbientLight(0xffffff, PC_LIGHT);
    srgb(this.ambient.color, 0.12, 0.17, 0.16);
    scene.add(this.ambient);

    this.celestial = this.createCelestialLight();
    this.lights = new LightPool(scene, kit.tier.name === 'low' ? 2 : 4);

    // Exponential fog (PlayCanvas exp2) plus a glow towards the sun or moon that
    // stands in for the original's volumetric fog. Scene-wide uniforms live in the
    // render group so static meshes see every change.
    this.fogColor = uniform(srgb(new THREE.Color(), 0.14, 0.22, 0.22)).setGroup(renderGroup);
    this.fogDensity = uniform(0.0038 / WORLD.drawDistanceMultiplier).setGroup(renderGroup);
    this.scatterDirection = uniform(new THREE.Vector3(0, 1, 0)).setGroup(renderGroup);
    this.scatterColor = uniform(new THREE.Color(0, 0, 0)).setGroup(renderGroup);
    const viewDir = normalize(positionWorld.sub(cameraPosition));
    const glow = pow(max(dot(viewDir, this.scatterDirection), 0), 7);
    scene.fogNode = fog(this.fogColor.add(this.scatterColor.mul(glow)), densityFogFactor(this.fogDensity));

    this.createSky();
    this.createSunDisc();
    this.createMoon();
    this.createStars();
    this.createOcean();
    this.createRain();
    this.createPost();

    this.profile = this.applyQuality(kit.tier);
  }

  get quality() {
    return this.profile;
  }

  featureEnabled(name) {
    return !!this.features[name];
  }

  /* ---------------------------------------------------------------- setup */

  createCelestialLight() {
    const light = new THREE.DirectionalLight(0xffffff, 2.35 * PC_LIGHT);
    srgb(light.color, 1, 0.79, 0.58);
    light.castShadow = true;
    const cam = light.shadow.camera;
    cam.near = 1;
    cam.far = 2400;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.06;
    light.shadow.radius = 2;
    this.scene.add(light, light.target);
    return light;
  }

  createSky() {
    const radius = WORLD.skyRadius;
    const positions = [];
    const colors = [];
    const indices = [];
    for (let ring = 0; ring <= 12; ring += 1) {
      const theta = (ring / 12) * Math.PI;
      const y = Math.cos(theta);
      const r = Math.sin(theta);
      const horizon = (1 - Math.abs(y)) ** 4;
      const up = Math.max(0, y);
      const cr = srgbToLinear(Math.min(1, 0.025 + horizon * 0.28 + Math.max(0, -y) * 0.018));
      const cg = srgbToLinear(Math.min(1, 0.055 + horizon * 0.19 + up * 0.035));
      const cb = srgbToLinear(Math.min(1, 0.08 + horizon * 0.13 + up * 0.08));
      for (let seg = 0; seg <= 28; seg += 1) {
        const phi = (seg / 28) * Math.PI * 2;
        positions.push(Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius);
        colors.push(cr, cg, cb);
      }
    }
    for (let ring = 0; ring < 12; ring += 1) {
      for (let seg = 0; seg < 28; seg += 1) {
        const a = ring * 29 + seg;
        const b = a + 29;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    this.skyDome = new THREE.Mesh(geometry, this.materials.sky);
    this.skyDome.name = 'Sky dome';
    this.skyDome.renderOrder = -2;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
  }

  createSunDisc() {
    const size = 16 * WORLD.drawDistanceMultiplier;
    this.sunDisc = new THREE.Mesh(GEOMETRY.sphere, this.materials.sun);
    this.sunDisc.name = 'Sun disc';
    this.sunDisc.scale.setScalar(size);
    this.sunDisc.renderOrder = -1;
    this.scene.add(this.sunDisc);
  }

  createMoon() {
    const positions = [];
    const normals = [];
    const point = (lat, lon) => {
      const theta = (lat / 7) * Math.PI;
      const phi = (lon / 14) * Math.PI * 2;
      const s = Math.sin(theta);
      return [Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s];
    };
    const facet = (a, b, c) => {
      let [bx, by, bz] = b;
      let [cx, cy, cz] = c;
      const [ax, ay, az] = a;
      let ux = bx - ax;
      let uy = by - ay;
      let uz = bz - az;
      let vx = cx - ax;
      let vy = cy - ay;
      let vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      let len = Math.hypot(nx, ny, nz);
      if (len < 1e-6) return;
      const mx = (ax + bx + cx) / 3;
      const my = (ay + by + cy) / 3;
      const mz = (az + bz + cz) / 3;
      if (nx * mx + ny * my + nz * mz < 0) {
        [bx, by, bz, cx, cy, cz] = [cx, cy, cz, bx, by, bz];
        ux = bx - ax;
        uy = by - ay;
        uz = bz - az;
        vx = cx - ax;
        vy = cy - ay;
        vz = cz - az;
        nx = uy * vz - uz * vy;
        ny = uz * vx - ux * vz;
        nz = ux * vy - uy * vx;
        len = Math.hypot(nx, ny, nz);
      }
      nx /= len;
      ny /= len;
      nz /= len;
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    };
    for (let lat = 0; lat < 7; lat += 1) {
      for (let lon = 0; lon < 14; lon += 1) {
        const a = point(lat, lon);
        const b = point(lat, lon + 1);
        const c = point(lat + 1, lon);
        const d = point(lat + 1, lon + 1);
        facet(a, c, b);
        facet(b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const colorAttr = new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', colorAttr);
    geometry.computeBoundingSphere();
    this.moonNormals = normals;
    // A per-facet shade so the surface reads as faceted rock.
    this.moonFacetShade = [];
    for (let f = 0; f < normals.length / 9; f += 1) {
      const h = Math.sin((f + 3) * 12.9898) * 43758.5453;
      this.moonFacetShade.push(0.76 + (h - Math.floor(h)) * 0.24);
    }
    this.moonDisc = new THREE.Mesh(geometry, this.materials.moon);
    this.moonDisc.name = 'Moon disc / faceted phase';
    this.moonDisc.scale.setScalar(6.5 * WORLD.drawDistanceMultiplier);
    this.moonDisc.renderOrder = -1;
    this.scene.add(this.moonDisc);
  }

  createStars() {
    const positions = [];
    const colors = [];
    let seed = 5312912;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const radius = WORLD.skyRadius * 0.94;
    for (let i = 0; i < 88; i += 1) {
      const y = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      let tx = z;
      let ty = 0;
      let tz = -x;
      let tl = Math.hypot(tx, ty, tz);
      if (tl < 0.08) {
        tx = 1;
        ty = 0;
        tz = 0;
        tl = 1;
      }
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const bx = y * tz - z * ty;
      const by = z * tx - x * tz;
      const bz = x * ty - y * tx;
      const size = 1.6 + rand() * 3.4;
      const px = x * radius;
      const py = y * radius;
      const pz = z * radius;
      const corners = [
        [px - tx * size - bx * size, py - ty * size - by * size, pz - tz * size - bz * size],
        [px + tx * size - bx * size, py + ty * size - by * size, pz + tz * size - bz * size],
        [px - tx * size + bx * size, py - ty * size + by * size, pz - tz * size + bz * size],
        [px + tx * size + bx * size, py + ty * size + by * size, pz + tz * size + bz * size],
      ];
      const brightness = Math.round(150 + rand() * 105);
      const warmth = rand();
      const cr = srgbToLinear(Math.min(255, Math.round(brightness * (0.82 + warmth * 0.18))) / 255);
      const cg = srgbToLinear(Math.min(255, Math.round(brightness * (0.9 + warmth * 0.1))) / 255);
      const cb = srgbToLinear(brightness / 255);
      for (const k of [0, 2, 1, 1, 2, 3]) {
        positions.push(...corners[k]);
        colors.push(cr, cg, cb);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    this.starField = new THREE.Mesh(geometry, this.materials.stars);
    this.starField.name = 'Deterministic star field';
    this.starField.frustumCulled = false;
    this.starField.visible = false;
    this.scene.add(this.starField);
  }

  createOcean() {
    this.ocean = new THREE.Mesh(GEOMETRY.plane, this.materials.water);
    this.ocean.name = 'Still ocean';
    this.ocean.scale.set(WORLD.oceanScale, 1, WORLD.oceanScale);
    this.ocean.position.set(0, this.seaLevel, 0);
    this.ocean.castShadow = false;
    this.ocean.receiveShadow = true;
    this.scene.add(this.ocean);
  }

  createRain() {
    const positions = [];
    const indices = [];
    const quad = (x0, y0, z0, x1, y1, z1, ox, oz) => {
      const base = positions.length / 3;
      positions.push(x0 - ox, y0, z0 - oz, x0 + ox, y0, z0 + oz, x1 - ox, y1, z1 - oz, x1 + ox, y1, z1 + oz);
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    };
    const drops = this.kit.detail(96, 24);
    for (let i = 0; i < drops; i += 1) {
      const angle = i * 2.399963;
      const dist = 4 + ((i * 17) % 23);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = -8 + ((i * 29) % 31) * 0.72;
      const len = 1.2 + (i % 5) * 0.28;
      quad(x, y, z, x - 0.16, y - len, z, 0.025, 0);
      quad(x, y, z, x - 0.16, y - len, z, 0, 0.025);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    this.rain = new THREE.Mesh(geometry, this.materials.rain);
    this.rain.name = 'Visible precipitation field';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  createPost() {
    this.gradeOn = uniform(1).setGroup(renderGroup);
    this.bloomOn = uniform(1).setGroup(renderGroup);
    this.saturation = uniform(0.9).setGroup(renderGroup);
    this.contrast = uniform(1.08).setGroup(renderGroup);
    this.tint = uniform(new THREE.Color(0.97, 1, 0.96)).setGroup(renderGroup);
    this.vignette = uniform(0.2).setGroup(renderGroup);
    this.vignetteColor = uniform(srgb(new THREE.Color(), 0.005, 0.016, 0.018)).setGroup(renderGroup);
    const { gradeOn, bloomOn, saturation, contrast, tint, vignette, vignetteColor } = this;
    this.post = createPost(this.kit, this.scene, this.camera, {
      bloom: { strength: 0.45, radius: 0.5, threshold: 1.1 },
      // Pure node building: it runs again whenever the quality tier changes.
      output: (node, { color }) => {
        const lit = color.add(node.sub(color).mul(bloomOn));
        const rgb = lit.rgb;
        const grey = luminance(rgb);
        const saturated = mix(vec3(grey), rgb, saturation).mul(tint);
        const contrasted = pow(max(saturated.div(0.18), vec3(0)), vec3(contrast)).mul(0.18);
        const edge = length(screenUV.sub(0.5)).mul(1.4142);
        const shade = smoothstep(0.52, 1.08, edge).mul(vignette);
        const graded = mix(contrasted, vignetteColor, shade);
        return vec4(mix(rgb, graded, gradeOn), lit.a);
      },
    });
  }

  /* -------------------------------------------------------------- quality */

  applyQuality(tier) {
    const profile = QUALITY_PROFILES[tier?.name] ?? QUALITY_PROFILES.high;
    this.profile = profile;
    const cam = this.celestial.shadow.camera;
    const d = profile.shadowDistance;
    cam.left = -d;
    cam.right = d;
    cam.top = d;
    cam.bottom = -d;
    cam.updateProjectionMatrix();
    // three r186 keeps stale shadow bindings on meshes when a map returns to a size it
    // had before, so every resize picks a size never used in this session.
    const size = Math.max(256, this.kit.shadowSize(2048) - this.shadowResizes);
    this.shadowResizes += 1;
    this.celestial.shadow.mapSize.set(size, size);
    return profile;
  }

  toggleFeature(name) {
    if (!(name in this.features)) return false;
    this.features[name] = !this.features[name];
    this.applyFeatures();
    return this.features[name];
  }

  applyFeatures() {
    this.gradeOn.value = this.features.grade ? 1 : 0;
    this.bloomOn.value = this.features.bloom ? 1 : 0;
    this.celestial.shadow.intensity = this.features.shadows ? 1 : 0;
    this.celestial.shadow.autoUpdate = this.features.shadows && this.shadowStrength > 0;
  }

  /* ---------------------------------------------------------- environment */

  setEnvironment(e) {
    const day = e.daylight;
    const golden = e.goldenHour;
    const night = e.night;
    const light = celestialLighting(e);
    this.sunDirection.set(e.sunDirection[0], e.sunDirection[1], e.sunDirection[2]).normalize();
    this.moonDirection.set(e.moonDirection[0], e.moonDirection[1], e.moonDirection[2]).normalize();
    this.sunDirectIntensity = light.sunIntensity;
    this.moonDirectIntensity = light.moonIntensity;
    const total = light.sunIntensity + light.moonIntensity;
    this.moonShadowBlend = total > 1e-5 ? light.moonIntensity / total : 0;
    const useMoon = light.shadowSource === 'moon' || (light.shadowSource === 'none' && light.moonIntensity > light.sunIntensity);
    this.shadowDirection.copy(useMoon ? this.moonDirection : this.sunDirection);
    const blend = this.moonShadowBlend;
    const sunShare = 1 - blend;
    this.shadowStrength = light.shadowIntensity;
    this.celestial.intensity = light.shadowIntensity * PC_LIGHT;
    this.celestial.shadow.autoUpdate = this.features.shadows && light.shadowIntensity > 0;
    srgb(
      this.celestial.color,
      (0.7 + golden * 0.3) * sunShare + 0.44 * blend,
      (0.75 + day * 0.16 - golden * 0.2) * sunShare + 0.58 * blend,
      (0.83 + day * 0.13 - golden * 0.38) * sunShare + 0.92 * blend,
    );
    this.shadowSource = light.shadowSource;

    const moonLight = light.moonIntensity;
    srgb(this.ambient.color, 0.018 + day * 0.112 + moonLight * 0.055, 0.032 + day * 0.14 + moonLight * 0.09, 0.058 + day * 0.12 + moonLight * 0.18);
    this.kit.renderer.toneMappingExposure = 0.78 + day * 0.34 + moonLight * 0.11 - e.cloudCover * 0.055;
    this.fogDensity.value = e.fogDensity / WORLD.drawDistanceMultiplier;
    srgb(this.fogColor.value, 0.026 + day * 0.14 + golden * 0.11 + moonLight * 0.025, 0.052 + day * 0.17 + golden * 0.035 + moonLight * 0.05, 0.088 + day * 0.15 + moonLight * 0.11);
    this.scene.background.copy(this.fogColor.value);

    const m = this.materials;
    srgb(m.sky.color, 0.2 + day * 0.8 + golden * 0.34, 0.3 + day * 0.7 + golden * 0.12, 0.58 + day * 0.42 - golden * 0.2).multiplyScalar(0.1 + day * 0.95 + golden * 0.18 + moonLight * 0.06);
    const sunClouds = Math.exp(-(e.cloudCover ** 1.35) * 4.6);
    const moonClouds = Math.exp(-(e.cloudCover ** 1.25) * 5.2);
    srgb(m.sun.color, 1, 0.55, 0.22).multiplyScalar((24 + light.sunVisibility * 34) * sunClouds);
    srgb(m.moon.color, 0.78, 0.86, 1).multiplyScalar(light.moonDiscIntensity * moonClouds);
    srgb(m.stars.color, 0.72, 0.86, 1).multiplyScalar(light.starIntensity * 3.4);
    m.window.emissiveIntensity = 2.2 + night * 9;
    srgb(m.water.emissive, 0.006 + day * 0.012 + moonLight * 0.025, 0.035 + day * 0.04 + moonLight * 0.07, 0.05 + day * 0.055 + moonLight * 0.13);
    m.water.emissiveIntensity = 0.28 + night * 0.34;
    m.water.roughness = Math.max(0.02, 1 - (0.94 + e.precipitation * 0.05));
    this.updateWetSurfaces(e.precipitation);

    this.sunDisc.visible = light.sunVisibility * sunClouds > 0.06;
    this.moonDisc.visible = light.moonVisibility * moonClouds > 0.025 && e.moonIllumination > 0.004;
    if (this.moonDisc.visible) this.updateMoonSurface(e);
    this.starField.visible = light.starIntensity > 0.008;

    this.precipitationStrength = e.precipitation;
    this.rainWind = Math.min(16, e.windKph * 0.18);
    this.rainWanted = e.precipitation > 0.04;
    m.rain.opacity = 0.1 + e.precipitation * 0.34;

    // Scattering glow in the fog towards the shadow-casting body (the old volumetric fog's look).
    const tr = (0.72 + golden * 0.25) * sunShare + 0.42 * blend;
    const tg = (0.85 - golden * 0.18) * sunShare + 0.58 * blend;
    const tb = (0.78 - golden * 0.3) * sunShare + 0.92 * blend;
    const scatter = this.features.atmosphere ? light.shadowIntensity * (0.52 + e.cloudCover * 0.3 + moonLight * 0.18) * (e.weatherId === 'fog' ? 0.045 : 0.025) : 0;
    srgb(this.scatterColor.value, tr, tg, tb).multiplyScalar(scatter);
    this.scatterDirection.value.copy(this.shadowDirection);

    this.saturation.value = 0.96 - e.cloudCover * 0.14;
    this.contrast.value = 1.035 + night * 0.075;
  }

  updateWetSurfaces(precipitation) {
    const t = Math.max(0, Math.min(1, precipitation));
    if (Math.abs(t - this.lastWetness) < 0.002) return;
    this.lastWetness = t;
    for (const [material, dry, wet] of this.wet) material.roughness = Math.max(0.04, 1 - (dry + (wet - dry) * t));
  }

  updateMoonSurface(e) {
    if (this.lastMoonSun.distanceToSquared(this.sunDirection) < 1e-7 && Math.abs(this.lastMoonIllumination - e.moonIllumination) < 1e-4) return;
    this.lastMoonSun.copy(this.sunDirection);
    this.lastMoonIllumination = e.moonIllumination;
    const attr = this.moonDisc.geometry.getAttribute('color');
    const out = attr.array;
    const n = this.moonNormals;
    const ambient = 0.018 + (1 - e.moonIllumination) * 0.035;
    const sx = this.sunDirection.x;
    const sy = this.sunDirection.y;
    const sz = this.sunDirection.z;
    for (let f = 0; f < n.length / 9; f += 1) {
      const k = f * 9;
      const lit = Math.max(0, n[k] * sx + n[k + 1] * sy + n[k + 2] * sz);
      const shade = Math.min(1, (ambient + lit ** 0.72 * 0.96) * this.moonFacetShade[f]);
      const r = srgbToLinear((202 * shade) / 255);
      const g = srgbToLinear((216 * shade) / 255);
      const b = srgbToLinear((242 * shade) / 255);
      for (let v = 0; v < 3; v += 1) {
        out[k + v * 3] = r;
        out[k + v * 3 + 1] = g;
        out[k + v * 3 + 2] = b;
      }
    }
    attr.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- frame */

  update(dt) {
    const eye = this.camera.getWorldPosition(_cam);
    this.skyDome.position.copy(eye);
    this.starField.position.copy(eye);
    const dist = WORLD.skyRadius * 0.78;
    this.sunDisc.position.copy(eye).addScaledVector(this.sunDirection, dist);
    this.moonDisc.position.copy(eye).addScaledVector(this.moonDirection, dist);
    this.ocean.position.set(eye.x, this.seaLevel, eye.z);
    this.rain.visible = this.rainWanted && !this.sheltered;
    if (this.rain.visible) {
      this.rainPhase = (this.rainPhase + dt * (12 + this.precipitationStrength * 18)) % 18;
      this.rain.position.set(eye.x + this.rainWind, eye.y + 12 - this.rainPhase, eye.z);
      setEulerDeg(this.rain, 0, 0, -this.rainWind * 0.42);
    }
    // The shadow map follows the player, snapped to its texel grid to limit shimmer.
    const light = this.celestial;
    const texel = (this.profile.shadowDistance * 2) / Math.max(256, light.shadow.mapSize.x);
    light.target.position.set(Math.round(eye.x / texel) * texel, Math.round(eye.y / texel) * texel, Math.round(eye.z / texel) * texel);
    light.position.copy(light.target.position).addScaledVector(this.shadowDirection, 1000);
    light.target.updateMatrixWorld();
    this.lights.update(dt, eye);
  }

  render() {
    this.post.render();
  }

  /** Register a point-light emitter; returns a disposer. */
  addLight(emitter) {
    return this.lights.add(emitter);
  }

  celestialSnapshot() {
    const eye = this.camera.getWorldPosition(_cam);
    const toward = (mesh) => {
      _v.copy(mesh.position).sub(eye).normalize();
      return [_v.x, _v.y, _v.z];
    };
    return {
      sun: { discDirection: toward(this.sunDisc), rayDirection: [-this.sunDirection.x, -this.sunDirection.y, -this.sunDirection.z], intensity: this.sunDirectIntensity, visible: this.sunDisc.visible },
      moon: { discDirection: toward(this.moonDisc), rayDirection: [-this.moonDirection.x, -this.moonDirection.y, -this.moonDirection.z], intensity: this.moonDirectIntensity, visible: this.moonDisc.visible },
      shadow: {
        rayDirection: [-this.shadowDirection.x, -this.shadowDirection.y, -this.shadowDirection.z],
        intensity: this.celestial.intensity / PC_LIGHT,
        castsShadows: this.celestial.castShadow && this.features.shadows,
        updates: this.celestial.shadow.autoUpdate,
        moonBlend: this.moonShadowBlend,
      },
      shadowSource: this.shadowSource,
      fogLightSource: 'fog-scatter',
    };
  }

  drawStats() {
    const info = this.kit.renderer.info?.render;
    return { drawCalls: info?.drawCalls ?? info?.calls ?? 0, triangles: info?.triangles ?? 0 };
  }
}
