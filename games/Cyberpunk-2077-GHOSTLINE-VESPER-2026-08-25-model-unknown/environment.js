/**
 * environment.js — Vesper's night: moonlight with shadows, ambient, the sky
 * dome, linear fog plus the blue volumetric haze, rain, and the post chain
 * (bloom, colour enhance, grading, ACES, vignette).
 *
 * The numbers are the PlayCanvas CameraFrame "ultra" preset with the game's
 * ULTRA_VISUAL_TUNING applied on top. The volumetric fog pass (a 28-step ray
 * march) becomes an analytic height-fog integral in the fog node: the same
 * density, falloff, anisotropic moon scattering and tint, without the march.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  exp,
  clamp,
  max,
  min,
  abs,
  select,
  fog,
  dot,
  sqrt,
  length,
  mix,
  pow,
  smoothstep,
  pass,
  screenUV,
  positionWorld,
  positionView,
  cameraPosition,
  acesFilmicToneMapping,
  sRGBTransferOETF,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { DEG, primitive } from './gfx.js';

export const LOOK = Object.freeze({
  ambient: [0.105, 0.12, 0.19],
  exposure: 1.22,
  fogColor: [0.025, 0.035, 0.09],
  fogStart: 64,
  fogEnd: 235,
  moonColor: [0.56, 0.68, 1],
  moonIntensity: 1.55,
  bloom: 0.045,
  grading: { brightness: 1, contrast: 1.08, saturation: 1.08, tint: [0.92, 0.96, 1] },
  enhance: { vibrance: 0.18, dehaze: 0.09 },
  vignette: { intensity: 0.38, inner: 0.58, outer: 1.25, curvature: 0.5 },
  haze: {
    tint: [0.19, 0.26, 0.48],
    density: 0.013,
    heightBase: 1.5,
    heightFalloff: 0.035,
    anisotropy: 0.72,
    intensity: 0.65,
    ambientColor: [0.08, 0.12, 0.24],
    ambientIntensity: 0.12,
    maxDistance: 180,
  },
});

const srgb = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
const raw = (rgb) => new THREE.Color(rgb[0], rgb[1], rgb[2]);

/* The shadow box follows the player; PlayCanvas fitted 125 m of view frustum. */
const SHADOW_HALF = 72;
const SHADOW_AHEAD = 40;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'ZYX');
const _dir = new THREE.Vector3();
const _center = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _rainQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 8 * DEG));

export class Environment {
  constructor(kit, scene, camera, player, simulation, materials) {
    this.kit = kit;
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.simulation = simulation;
    this.materials = materials;

    // PlayCanvas colours are sRGB. Its ambient skips three's 1/π Lambert term, so ×π; the moon
    // keeps its intensity so its GGX highlights match (its diffuse on these near-black walls
    // is below the grading's black point either way).
    this.ambient = new THREE.AmbientLight(srgb(LOOK.ambient), Math.PI);
    scene.add(this.ambient);

    // PlayCanvas filtered the moon's shadow with 5×5 PCF; three's PCF with a radius is the match.
    kit.renderer.shadowMap.enabled = true;
    kit.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.moon = new THREE.DirectionalLight(srgb(LOOK.moonColor), LOOK.moonIntensity);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.05;
    this.moon.shadow.radius = 2;
    Object.assign(this.moon.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 320 });
    this.moon.shadow.camera.updateProjectionMatrix();
    this.applyShadowSize();
    scene.add(this.moon, this.moon.target);
    this.toMoon = new THREE.Vector3(0, 1, 0);

    // Sky dome: an unlit, inside-out ellipsoid that follows the player.
    this.sky = new THREE.Mesh(
      primitive('sphere'),
      materials.get({ color: '#090c20', emissive: '#111943', emissiveIntensity: 1.35, unlit: true, backSide: true })
    );
    this.sky.scale.set(380, 260, 380);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.uniforms = this.buildFog();
    this.buildRain();
    this.buildPost();

    kit.onQuality(() => {
      this.applyShadowSize();
      this.buildPost();
    });
  }

  /** r186 resizes the shadow map from mapSize on the next frame; never dispose or null shadow.map. */
  applyShadowSize() {
    const size = this.kit.shadowSize(2048);
    this.moon.shadow.mapSize.set(size, size);
    this.texel = (SHADOW_HALF * 2) / size;
  }

  /* ---------------------------------------------------------------- fog + haze */

  buildFog() {
    const h = LOOK.haze;
    const u = {
      fogColor: uniform(srgb(LOOK.fogColor)),
      fogStart: uniform(LOOK.fogStart),
      fogEnd: uniform(LOOK.fogEnd),
      density: uniform(h.density),
      base: uniform(h.heightBase),
      falloff: uniform(h.heightFalloff),
      maxDistance: uniform(h.maxDistance),
      g: uniform(h.anisotropy),
      // ×1.12 matches the original's brightness (it marched 28 jittered steps; this integrates exactly).
      moon: uniform(srgb(LOOK.moonColor).multiplyScalar(h.intensity * LOOK.exposure * 1.12)),
      hazeAmbient: uniform(raw(h.ambientColor).multiplyScalar(h.ambientIntensity * LOOK.exposure)),
      tint: uniform(raw(h.tint)),
      toMoon: uniform(new THREE.Vector3(0, 1, 0)),
    };

    const node = Fn(() => {
      // PlayCanvas linear fog on view depth: the share of fog colour.
      const depth = positionView.z.negate();
      const linear = clamp(depth.sub(u.fogStart).div(u.fogEnd.sub(u.fogStart)), 0, 1);

      // Exponential height fog, integrated along the view ray up to maxDistance.
      const toFrag = positionWorld.sub(cameraPosition);
      const dist = length(toFrag);
      const dir = toFrag.div(max(dist, 1e-4));
      const len = min(dist, u.maxDistance);
      const kdy = u.falloff.mul(dir.y);
      const path = select(abs(kdy).greaterThan(1e-4), float(1).sub(exp(kdy.mul(len).negate())).div(kdy), len);
      const tau = u.density.mul(exp(u.falloff.mul(max(cameraPosition.y.sub(u.base), 0)).negate())).mul(path);
      const transmittance = exp(tau.negate());

      // Henyey-Greenstein scattering towards the moon, plus a little ambient.
      const cosTheta = dot(dir, u.toMoon);
      const g2 = u.g.mul(u.g);
      const denom = g2.add(1).sub(u.g.mul(2).mul(cosTheta));
      const phase = float(1).sub(g2).div(denom.mul(sqrt(denom)).mul(12.56637));
      const inscatter = u.moon.mul(phase).add(u.hazeAmbient).mul(u.tint).mul(float(1).sub(transmittance));

      // colour' = (c·(1-lin) + fog·lin)·T + inscatter, written as one mix().
      const factor = float(1).sub(float(1).sub(linear).mul(transmittance));
      const fogged = u.fogColor.mul(linear.mul(transmittance)).add(inscatter).div(max(factor, 1e-5));
      return fog(fogged, factor);
    })();
    this.scene.fogNode = node;
    return u;
  }

  /* ---------------------------------------------------------------- rain */

  buildRain() {
    const count = 54;
    const mat = this.materials.get({ color: '#7bdcff', emissive: '#55aaff', emissiveIntensity: 2.5, opacity: 0.24, unlit: true });
    this.rain = new THREE.InstancedMesh(primitive('box'), mat, count);
    this.rain.frustumCulled = false;
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 32 - 16;
      const z = Math.random() * 32 - 16;
      this.drops.push({ x, y: Math.random() * 18 - 9, z, length: Math.random() * 0.35 + 0.2, velocity: 12 + Math.random() * 9, offsetX: x, offsetZ: z });
    }
    this.scene.add(this.rain);
  }

  updateRain(dt, p) {
    const weather = this.simulation.state.weather;
    this.rain.visible = weather === 'rain' || weather === 'gridstorm';
    if (!this.rain.visible) return;
    const drift = Math.sin(this.simulation.state.playTime * 0.07) * 0.9;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.x += drift * dt;
      d.y -= d.velocity * dt;
      if (d.y < -9) {
        d.y = 9 + Math.random() * 5;
        d.x = d.offsetX;
        d.z = d.offsetZ;
      }
      _m.compose(_pos.set(p.x + d.x, p.y + 8 + d.y, p.z + d.z), _rainQ, _scale.set(0.012, d.length, 0.012));
      this.rain.setMatrixAt(i, _m);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- post */

  buildPost() {
    this.pipeline?.dispose();
    const tier = this.kit.tier;
    const pipeline = new THREE.RenderPipeline(this.kit.renderer);
    const scenePass = pass(this.scene, this.camera);
    const sceneColor = scenePass.getTextureNode('output');

    // PlayCanvas bloom: no threshold, 8 blur levels (2 px to 256 px wide) summed × intensity.
    // BloomNode's 5 mips reach wider; radius −0.25 weights them 1.2, 0.9, 0.6, 0.3, 0 so the
    // glow stays tight around the neon instead of washing the street blue.
    const glow = bloom(sceneColor, LOOK.bloom * 2.7, -0.25, 0);
    glow.setResolutionScale(tier.post === 'lite' ? 0.35 : 0.5);

    const G = LOOK.grading;
    const E = LOOK.enhance;
    const V = LOOK.vignette;
    const enhance = Fn(([c]) => {
      // vibrance
      const hi = max(c.r, max(c.g, c.b));
      const lo = min(c.r, min(c.g, c.b));
      const sat = hi.sub(lo).div(max(hi, 0.001));
      const lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      const grey = vec3(lum.div(max(hi, 1)).mul(hi));
      const vib = mix(grey, c, float(E.vibrance).mul(float(1).sub(sat)).add(1));
      // dehaze
      const peak = max(vib.r, max(vib.g, vib.b));
      const scale = max(peak, 1);
      const norm = vib.div(scale);
      const dark = min(norm.r, min(norm.g, norm.b));
      const t = max(float(1).sub(float(E.dehaze).mul(dark).div(0.95)), 0.1);
      return max(norm.sub(0.95).div(t).add(0.95).mul(scale), vec3(0));
    });
    const grade = Fn(([c]) => {
      const x = c.mul(vec3(...G.tint)).mul(G.brightness);
      const grey = dot(x, vec3(0.3, 0.59, 0.11)).div(max(max(x.r, max(x.g, x.b)), 1));
      return mix(vec3(0.5), mix(vec3(grey), x, G.saturation), G.contrast);
    });

    let color = sceneColor.rgb.add(glow.rgb);
    color = grade(enhance(color));
    color = acesFilmicToneMapping(max(color, vec3(0)), float(LOOK.exposure));
    const curve = pow(abs(screenUV.mul(2).sub(1)), vec2(1 / V.curvature));
    const edge = pow(length(curve), V.curvature);
    color = color.mul(float(1).sub(float(V.intensity).mul(smoothstep(V.inner, V.outer, edge))));
    let out = vec4(sRGBTransferOETF(color), 1);
    if (!tier.msaa && tier.name !== 'low') out = fxaa(out);

    pipeline.outputColorTransform = false;
    pipeline.outputNode = out;
    this.pipeline = pipeline;
  }

  render() {
    this.pipeline.render();
  }

  /* ---------------------------------------------------------------- per frame */

  update(dt) {
    const p = this.player.position;
    this.sky.position.set(p.x, 0, p.z);
    this.updateRain(dt, p);

    // Moon angle drifts with the time of day (degrees, PlayCanvas Euler order).
    const s = (this.simulation.state.timeOfDay / 24) * 360;
    _q.setFromEuler(_e.set((38 + Math.sin(s * DEG) * 18) * DEG, (-32 + s * 0.1) * DEG, 0, 'ZYX'));
    this.toMoon.set(0, 1, 0).applyQuaternion(_q);
    this.uniforms.toMoon.value.copy(this.toMoon);

    // Centre the shadow box ahead of the player, snapped to shadow texels so edges do not crawl.
    const f = this.player.forward;
    const fl = Math.hypot(f.x, f.z) || 1;
    _center.set(p.x + (f.x / fl) * SHADOW_AHEAD, 0, p.z + (f.z / fl) * SHADOW_AHEAD);
    _dir.copy(this.toMoon).negate();
    _right.crossVectors(_dir, Math.abs(_dir.y) > 0.99 ? _up.set(1, 0, 0) : _up.set(0, 1, 0)).normalize();
    _up.crossVectors(_right, _dir);
    const cr = _center.dot(_right);
    const cu = _center.dot(_up);
    _center.addScaledVector(_right, Math.round(cr / this.texel) * this.texel - cr);
    _center.addScaledVector(_up, Math.round(cu / this.texel) * this.texel - cu);
    this.moon.target.position.copy(_center);
    this.moon.position.copy(_center).addScaledVector(this.toMoon, 160);
  }

  get backend() {
    return this.kit.backend;
  }

  get preset() {
    return this.kit.tier.name;
  }

  destroy() {
    this.pipeline?.dispose();
    this.scene.remove(this.moon, this.moon.target, this.ambient, this.sky, this.rain);
    this.rain.dispose();
  }
}
