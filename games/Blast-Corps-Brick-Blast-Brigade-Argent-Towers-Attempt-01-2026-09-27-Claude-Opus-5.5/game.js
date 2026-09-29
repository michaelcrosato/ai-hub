import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  dot,
  emissive,
  float,
  floor,
  fract,
  fwidth,
  hash,
  instanceColor,
  length,
  max,
  min,
  mix,
  mrt,
  normalView,
  normalWorld,
  normalize,
  output,
  pass,
  positionLocal,
  positionWorld,
  pow,
  renderOutput,
  screenUV,
  select,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { boot } from 'kit/boot.js';
import { createWorld } from 'kit/physics.js';

// Brick Blast Brigade — Argent Towers. Rebuilt from the original single-file
// Vite bundle onto the ai-hub 3D stack: three.js r186 and Rapier 0.20 come from
// /lib, the renderer, quality tiers, settings panel and all input from the kit.

/** Rapier 0.20, set once boot() has loaded it. */
let RAPIER = null;

var GAME_TITLE = `BRICK BLAST BRIGADE`;
var MISSION_NAME = `ARGENT TOWERS`;
var BUILD_DATE = `2026-09-27`;
var AI_MODEL = `Claude Opus 5.5 (claude-opus-5-5)`;
var SAVE_KEY = `bbb_save_v1`;
var FIXED_DT = 1 / 60;
var BRICK_H = 1.2;
var PLATE_H = 0.4;
var CARRIER_SPEED = 3.2;
var CARRIER_SPEED_RELAXED = 2.4;
var GROUP = { STATIC: 1, VEHICLE: 2, PLAYER: 4, DEBRIS: 8, PROP: 16, CARRIER: 32, BUILDING: 64, SENSOR: 128 };
function groups(e, t) {
  return ((e & 65535) << 16) | (t & 65535);
}
// The game's two looks: the kit's high and ultra tiers use `high`, low and medium `balanced`.
var PRESETS = {
  high: {
    label: `High`,
    shadowRadius: 3,
    shadowExtent: 55,
    ao: !0,
    bloom: !0,
    bloomStrength: 0.55,
    aa: `smaa`,
    maxDebris: 320,
    maxCrumble: 1600,
    maxParticles: 1400,
    pointLights: !0,
  },
  balanced: {
    label: `Balanced`,
    shadowRadius: 2,
    shadowExtent: 45,
    ao: !1,
    bloom: !0,
    bloomStrength: 0.45,
    aa: `fxaa`,
    maxDebris: 110,
    maxCrumble: 800,
    maxParticles: 600,
    pointLights: !1,
  },
};
var COLORS = {
  grass: 6136122,
  grassDark: 5016111,
  road: 3817029,
  sidewalk: 12433322,
  line: 15855072,
  lineYellow: 15909424,
  brickRed: 11878700,
  yellow: 15909166,
  blue: 3108792,
  white: 15657696,
  tan: 14205850,
  darkGrey: 5725027,
  grey: 10396586,
  lightGrey: 13225427,
  orange: 15234090,
  green: 3971658,
  black: 2369067,
  red: 13120299,
  sand: 14732434,
  teal: 2792858,
  purple: 8015779,
  brown: 8015405,
  concrete: 11117980,
  steel: 8226706,
  silver: 13620442,
  glass: 10473712,
};
var studShade = Fn(([e, t]) => {
  let n = fract(e.div(t)).sub(0.5),
    r = length(n),
    i = fwidth(r).max(5e-4),
    a = smoothstep(i.add(0.29), float(0.29).sub(i), r),
    o = smoothstep(float(0.36).add(i), float(0.3), r).mul(smoothstep(float(0.24).sub(i), float(0.3), r)),
    s = length(n.sub(vec2(-0.06, 0.06))),
    c = smoothstep(float(0.34).add(i), float(0.3), s).mul(float(1).sub(a)),
    l = smoothstep(float(0.5), float(0.12), i.mul(4));
  return float(1).add(l.mul(a.mul(0.07).sub(o.mul(0.12)).sub(c.mul(0.14))));
});
var brickShade = Fn(([e, t]) => {
  let n = select(abs(t.x).greaterThan(abs(t.z)), e.z, e.x),
    r = e.y,
    i = floor(r.div(1.2)),
    a = fract(n.add(i.mod(2).mul(1)).div(2)),
    o = fract(r.div(1.2)),
    s = fwidth(a).max(5e-4),
    c = fwidth(o).max(5e-4),
    l = smoothstep(float(0), s.add(0.012), min(a, float(1).sub(a))),
    u = smoothstep(float(0), c.add(0.02), min(o, float(1).sub(o))),
    d = mix(float(0.62), float(1), l.mul(u)),
    f = floor(vec2(n.add(i.mod(2)).div(2), i)),
    p = mix(float(0.93), float(1.05), hash(f.x.mul(17.13).add(f.y.mul(311.7)))),
    m = mix(float(0.86), float(1), smoothstep(float(0), float(0.25), o)),
    h = smoothstep(float(0.6), float(0.15), max(s, c).mul(6));
  return mix(float(1), d.mul(m), h).mul(p);
});
function vertexColorMaterial(e = {}) {
  let t = new THREE.MeshStandardNodeMaterial({
    color: e.color ?? 16777215,
    roughness: e.roughness ?? 0.42,
    metalness: e.metalness ?? 0,
    vertexColors: e.vertexColors ?? !0,
    flatShading: !1,
  });
  return (
    e.emissive && ((t.emissive = new THREE.Color(e.emissive)), (t.emissiveIntensity = e.emissiveIntensity ?? 1)),
    (t.envMapIntensity = e.env ?? 1),
    t
  );
}
function studGroundMaterial() {
  let e = new THREE.MeshStandardNodeMaterial({ color: 16777215, roughness: 0.78, metalness: 0, vertexColors: !0 }),
    t = positionWorld.xz,
    n = floor(t.div(8));
  return (
    (e.colorNode = vec3(
      mix(float(0.92), float(1.06), hash(n.x.mul(0.1731).add(n.y.mul(7.9123)).add(3.1))).mul(studShade(t, float(1))),
    )),
    e
  );
}
function wallMaterial(e = {}) {
  let t = new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: e.roughness ?? 0.55,
      metalness: 0,
      vertexColors: !0,
    }),
    n = normalWorld;
  return (
    (t.colorNode = vec3(
      select(abs(n.y).greaterThan(0.6), studShade(positionWorld.xz, float(1)), brickShade(positionWorld, n)),
    )),
    t
  );
}
function asphaltMaterial() {
  let e = new THREE.MeshStandardNodeMaterial({ color: 16777215, roughness: 0.86, metalness: 0, vertexColors: !0 }),
    t = floor(positionWorld.xz.div(2));
  return ((e.colorNode = vec3(mix(float(0.94), float(1.04), hash(t.x.mul(0.37).add(t.y.mul(5.1)))))), e);
}
function instanceGlowMaterial(e = 3) {
  let t = new THREE.MeshStandardNodeMaterial({ color: 0, roughness: 0.5, metalness: 0 });
  return ((t.emissiveNode = instanceColor.mul(e)), t);
}
function instanceHotMaterial(e = 4) {
  let t = new THREE.MeshStandardNodeMaterial({ color: 16777215, roughness: 0.3, metalness: 0 });
  return ((t.emissiveNode = pow(instanceColor, vec3(3)).mul(e)), t);
}
function emissiveMaterial(e, t = 2) {
  let n = new THREE.MeshStandardNodeMaterial({ color: 0, roughness: 0.4, metalness: 0 });
  return ((n.emissive = new THREE.Color(e)), (n.emissiveIntensity = t), n);
}
function skyMaterial(e, t, n, r) {
  let i = new THREE.MeshBasicNodeMaterial({ side: 1, depthWrite: !1, fog: !1 }),
    a = normalize(positionLocal),
    o = uniform(e.clone().normalize()),
    s = uniform(new THREE.Color(t)),
    c = uniform(new THREE.Color(n)),
    l = uniform(new THREE.Color(r)),
    u = a.y,
    d = mix(c, s, pow(max(u, 0), 0.55)),
    f = mix(c, l, smoothstep(float(0), float(0.25), u.negate())),
    p = select(u.greaterThan(0), d, f),
    m = max(dot(a, o), 0),
    h = vec3(1, 0.92, 0.75).mul(pow(m, 12).mul(0.35).add(pow(m, 400).mul(18)));
  return ((i.colorNode = p.add(h)), (i.userData.uniforms = { cTop: s, cHor: c, cGnd: l, uSun: o }), i);
}
var clamp = (e, t, n) => (e < t ? t : e > n ? n : e);
var lerp = (e, t, n) => e + (t - e) * n;
var damp = (e, t, n, r) => lerp(e, t, 1 - Math.exp(-n * r));
var wrapAngle = (e) => ((e = (e + Math.PI) % (Math.PI * 2)), e < 0 && (e += Math.PI * 2), e - Math.PI);
var dampAngle = (e, t, n, r) => e + wrapAngle(t - e) * (1 - Math.exp(-n * r));
function makeRng(e = 1) {
  let t = e >>> 0,
    n = () => {
      t = (t + 1831565813) >>> 0;
      let e = t;
      return (
        (e = Math.imul(e ^ (e >>> 15), e | 1)),
        (e ^= e + Math.imul(e ^ (e >>> 7), e | 61)),
        ((e ^ (e >>> 14)) >>> 0) / 4294967296
      );
    };
  return (
    (n.range = (e, t) => e + (t - e) * n()),
    (n.int = (e, t) => Math.floor(e + (t - e + 1) * n())),
    (n.pick = (e) => e[Math.floor(n() * e.length)]),
    n
  );
}
var rng = makeRng(1337);
function formatTime(e) {
  if (!isFinite(e)) return `--:--.-`;
  let t = Math.floor(e / 60),
    n = e - t * 60;
  return `${t}:${n < 10 ? `0` : ``}${n.toFixed(1)}`;
}
function obbHitsAabb(e, t, n, r, i, a, o = 0) {
  let s = Math.sin(i),
    c = Math.cos(i),
    l = s,
    u = c,
    d = c,
    f = -s,
    p = (a.minX + a.maxX) / 2,
    m = (a.minZ + a.maxZ) / 2,
    h = (a.maxX - a.minX) / 2 + o,
    g = (a.maxZ - a.minZ) / 2 + o,
    _ = p - e,
    v = m - t,
    y = Math.abs(d) * n + Math.abs(l) * r;
  if (Math.abs(_) > y + h || ((y = Math.abs(f) * n + Math.abs(u) * r), Math.abs(v) > y + g)) return !1;
  let b = Math.abs(d) * h + Math.abs(f) * g;
  return !(
    Math.abs(_ * d + v * f) > n + b || ((b = Math.abs(l) * h + Math.abs(u) * g), Math.abs(_ * l + v * u) > r + b)
  );
}
var Emitter = class {
  constructor() {
    this._h = new Map();
  }
  on(e, t) {
    return (this._h.has(e) || this._h.set(e, []), this._h.get(e).push(t), () => this.off(e, t));
  }
  off(e, t) {
    let n = this._h.get(e);
    if (!n) return;
    let r = n.indexOf(t);
    r >= 0 && n.splice(r, 1);
  }
  emit(e, ...t) {
    let n = this._h.get(e);
    if (n) for (let e of n.slice()) e(...t);
  }
};
if (globalThis.GPUTexture && GPUTexture.prototype.createView && !GPUTexture.prototype.__bbbPatched) {
  let e = GPUTexture.prototype.createView;
  ((GPUTexture.prototype.createView = function (t) {
    return (t && t.swizzle === `rgba` && ((t = { ...t }), delete t.swizzle), e.call(this, t));
  }),
    (GPUTexture.prototype.__bbbPatched = !0));
}
var SUN_DIR = new THREE.Vector3(0.5, 0.78, -0.38).normalize();
/** The game's two looks. The kit's quality tier picks one (see presetForTier). */
function presetForTier(tier) {
  return tier.name === `high` || tier.name === `ultra` ? `high` : `balanced`;
}
var _shadowFocus = new THREE.Vector3();
var _shadowRight = new THREE.Vector3();
var _shadowUp = new THREE.Vector3();
var RenderSystem = class {
  constructor(e, kit) {
    ((this.container = e),
      (this.kit = kit),
      (this.presetName = `balanced`),
      (this.preset = PRESETS.balanced),
      (this.backend = kit.backendLabel),
      (this.frameMs = 16.7),
      (this.fps = 60),
      (this.area = `surface`),
      (this.onPresetChange = null));
  }
  async init() {
    const kit = this.kit,
      t = kit.renderer;
    ((this.renderer = t),
      (t.toneMapping = THREE.ACESFilmicToneMapping),
      (t.toneMappingExposure = 1),
      (t.shadowMap.enabled = !0),
      (t.shadowMap.type = THREE.PCFShadowMap),
      (this.scene = new THREE.Scene()),
      (this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1400)),
      this.camera.position.set(0, 60, 60),
      (this.scene.fog = new THREE.Fog(12178406, 180, 620)),
      (this.sun = new THREE.DirectionalLight(16773336, 3.1)),
      (this.sun.castShadow = !0),
      (this.sun.shadow.bias = -4e-4),
      (this.sun.shadow.normalBias = 0.04),
      (this.sun.shadow.camera.near = 1),
      (this.sun.shadow.camera.far = 420),
      this.scene.add(this.sun, this.sun.target),
      (this.fill = new THREE.HemisphereLight(13624575, 5925434, 0.35)),
      this.scene.add(this.fill),
      (this.skyMat = skyMaterial(SUN_DIR, 4161488, 13624306, 7307098)),
      (this.sky = new THREE.Mesh(new THREE.IcosahedronGeometry(1e3, 3), this.skyMat)),
      (this.sky.renderOrder = -10),
      (this.sky.frustumCulled = !1),
      this.scene.add(this.sky),
      this._buildEnvironment(),
      (this.flashes = []));
    for (let e = 0; e < 2; e++) {
      let e = new THREE.PointLight(16755285, 0, 40, 2);
      ((e.userData.t = 0), this.scene.add(e), this.flashes.push(e));
    }
    // 2048² at the kit's high tier, scaled for the others. r186 resizes the map
    // from mapSize on the next frame, so the map itself is never disposed here.
    const sizeShadow = () => this.sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
    sizeShadow();
    this._applyPreset(presetForTier(kit.tier));
    kit.onQuality((tier) => {
      sizeShadow();
      this._applyPreset(presetForTier(tier));
    });
    kit.onResize((w, h) => this.resize(w, h));
  }
  _buildEnvironment() {
    let e = new THREE.Scene(),
      t = new THREE.Mesh(new THREE.IcosahedronGeometry(100, 3), this.skyMat);
    e.add(t);
    let n = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(1.6, 1.6, 1.65) });
    for (let t = 0; t < 7; t++) {
      let r = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + (t % 3) * 3, 0), n),
        i = (t / 7) * Math.PI * 2;
      (r.position.set(Math.cos(i) * 70, 25 + (t % 2) * 10, Math.sin(i) * 70), (r.scale.y = 0.4), e.add(r));
    }
    let r = new THREE.PMREMGenerator(this.renderer),
      i = r.fromScene(e, 0.03, 0.1, 500);
    ((this.envTex = i.texture),
      (this.scene.environment = this.envTex),
      (this.scene.environmentIntensity = 0.85),
      r.dispose());
  }
  _buildPipeline() {
    let e = this.preset,
      t = this.scene,
      n = this.camera;
    if (this.pipeline)
      try {
        this.pipeline.dispose();
      } catch {}
    let r = new THREE.RenderPipeline(this.renderer);
    r.outputColorTransform = !1;
    let i = pass(t, n),
      a = { output: output, emissive: emissive };
    (e.ao && (a.normal = normalView), i.setMRT(mrt(a)));
    let o = i.getTextureNode(`output`);
    if (e.ao) {
      let e = ao(i.getTextureNode(`depth`), i.getTextureNode(`normal`), n);
      ((e.resolutionScale = 0.5),
        (e.radius.value = 0.9),
        (e.thickness.value = 1.2),
        (e.distanceExponent.value = 1.4),
        (this.aoNode = e));
      let t = e.getTextureNode().sample(screenUV).r;
      o = vec4(o.rgb.mul(mix(float(1), t, float(0.85))), o.a);
    }
    if (e.bloom) {
      let t = bloom(i.getTextureNode(`emissive`), e.bloomStrength, 0.35, 0);
      ((this.bloomNode = t), (o = o.add(t)));
    }
    let s = renderOutput(o),
      c = length(screenUV.sub(0.5));
    ((s = vec4(s.rgb.mul(float(1).sub(smoothstep(float(0.45), float(0.95), c).mul(0.22))), float(1))),
      (s = e.aa === `smaa` ? smaa(s) : fxaa(s)),
      (r.outputNode = s),
      (this.pipeline = r));
  }
  _applyPreset(e) {
    if (this.pipeline && e === this.presetName) return;
    ((this.presetName = e), (this.preset = PRESETS[e]));
    let t = this.preset;
    this.sun.shadow.radius = t.shadowRadius;
    let n = t.shadowExtent,
      r = this.sun.shadow.camera;
    ((r.left = -n),
      (r.right = n),
      (r.top = n),
      (r.bottom = -n),
      r.updateProjectionMatrix(),
      this._buildPipeline(),
      this.onPresetChange && this.onPresetChange(e));
  }
  // The kit owns the canvas size, pixel ratio and dynamic resolution; the game
  // only widens the field of view on portrait screens.
  resize(e = this.kit.size.width, t = this.kit.size.height) {
    ((this.camera.aspect = e / t),
      (this.camera.fov = this.camera.aspect < 1 ? Math.min(78, 46 / this.camera.aspect ** 0.65) : 46),
      this.camera.updateProjectionMatrix());
  }
  focusShadows(e, t) {
    // Snap the shadow camera to whole texels so the map doesn't shimmer as it follows.
    let n = (2 * this.preset.shadowExtent) / this.sun.shadow.mapSize.x,
      r = _shadowFocus.set(e, 0, t),
      i = SUN_DIR,
      a = _shadowRight.set(0, 1, 0).cross(i).normalize(),
      o = _shadowUp.copy(i).cross(a).normalize(),
      s = Math.round(r.dot(a) / n) * n,
      c = Math.round(r.dot(o) / n) * n,
      l = r.dot(i);
    (this.sun.target.position
      .copy(a)
      .multiplyScalar(s)
      .addScaledVector(o, c)
      .addScaledVector(i, l),
      this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 200),
      this.sun.target.updateMatrixWorld());
  }
  flash(e, t, n, r = 60, i = 16755285) {
    if (!this.preset.pointLights) return;
    let a = this.flashes.find((e) => e.userData.t <= 0) || this.flashes[0];
    (a.position.set(e, t + 3, n), a.color.set(i), (a.userData.t = 0.35), (a.userData.i = r), (a.intensity = r));
  }
  setArea(e) {
    if (this.area === e) return;
    this.area = e;
    let t = e === `underground`;
    ((this.sky.visible = !t),
      this.scene.fog.color.set(t ? 460810 : 12178406),
      (this.scene.fog.near = t ? 25 : 180),
      (this.scene.fog.far = t ? 95 : 620),
      (this.scene.environmentIntensity = t ? 0.22 : 0.85),
      (this.sun.intensity = t ? 0.25 : 3.1),
      (this.fill.intensity = t ? 0.25 : 0.35),
      (this.scene.background = t ? new THREE.Color(329224) : null));
  }
  sampleFrame(e) {
    ((this.frameMs = this.frameMs * 0.92 + e * 0.08), (this.fps = 1e3 / Math.max(1, this.frameMs)));
    for (let t of this.flashes)
      t.userData.t > 0 &&
        ((t.userData.t -= e / 1e3),
        (t.intensity = Math.max(0, t.userData.i * (t.userData.t / 0.35))),
        t.userData.t <= 0 && (t.intensity = 0));
  }
  render() {
    (this.sky.position.copy(this.camera.position), this.pipeline.render());
  }
};
var _interpQuat = new THREE.Quaternion();
var Physics = class {
  constructor() {
    // The kit's conventions: meters, gravity -9.81, a 60 Hz step (FIXED_DT).
    ((this.world = createWorld(RAPIER, { hz: 1 / FIXED_DT })),
      (this.world.numSolverIterations = 4),
      (this.events = new RAPIER.EventQueue(!0)),
      (this.owners = new Map()),
      (this.tracked = new Set()),
      (this.stepCount = 0),
      (this.contactHandlers = []));
  }
  setOwner(e, t) {
    this.owners.set(e.handle, t);
  }
  ownerOf(e) {
    return this.owners.get(e);
  }
  fixedBox(e, t, n, r, i, a, o = {}) {
    let s = RAPIER.RigidBodyDesc.fixed().setTranslation(e, t, n);
    o.rot && s.setRotation(o.rot);
    let c = this.world.createRigidBody(s),
      l = RAPIER.ColliderDesc.cuboid(r, i, a)
        .setFriction(o.friction ?? 0.6)
        .setRestitution(o.restitution ?? 0.1)
        .setCollisionGroups(groups(o.member ?? GROUP.STATIC, o.filter ?? 65535));
    o.events && l.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    let u = this.world.createCollider(l, c);
    return (o.owner && this.setOwner(u, o.owner), { body: c, col: u });
  }
  ramp(e, t, n, r, i, a, o, s = {}) {
    let c = n - e,
      l = r - t,
      u = a - i,
      d = Math.hypot(c, l),
      f = Math.atan2(u, d),
      p = Math.atan2(c, l),
      m = 0.6,
      h = new THREE.Quaternion().setFromEuler(new THREE.Euler(-f, p, 0, `YXZ`)),
      g = new THREE.Vector3(0, 1, 0).applyQuaternion(h),
      _ = (e + n) / 2 - g.x * m,
      v = (i + a) / 2 - g.y * m,
      y = (t + r) / 2 - g.z * m,
      b = Math.hypot(d, u) / 2 + 0.3;
    return this.fixedBox(_, v, y, o / 2, m, b, { ...s, rot: { x: h.x, y: h.y, z: h.z, w: h.w } });
  }
  removeBody(e) {
    if (!e) return;
    let t = e.numColliders();
    for (let n = 0; n < t; n++) this.owners.delete(e.collider(n).handle);
    this.world.removeRigidBody(e);
  }
  removeCollider(e) {
    (this.owners.delete(e.handle), this.world.removeCollider(e, !0));
  }
  track(e, t, n = null) {
    let r = e.translation(),
      i = e.rotation(),
      a = {
        body: e,
        obj: t,
        offset: n,
        p0: new THREE.Vector3(r.x, r.y, r.z),
        p1: new THREE.Vector3(r.x, r.y, r.z),
        q0: new THREE.Quaternion(i.x, i.y, i.z, i.w),
        q1: new THREE.Quaternion(i.x, i.y, i.z, i.w),
      };
    return (this.tracked.add(a), a);
  }
  untrack(e) {
    this.tracked.delete(e);
  }
  snapshot() {
    for (let e of this.tracked) {
      (e.p0.copy(e.p1), e.q0.copy(e.q1));
      let t = e.body.translation(),
        n = e.body.rotation();
      (e.p1.set(t.x, t.y, t.z), e.q1.set(n.x, n.y, n.z, n.w));
    }
  }
  resetInterp(e) {
    let t = e.body.translation(),
      n = e.body.rotation();
    (e.p0.set(t.x, t.y, t.z), e.p1.copy(e.p0), e.q0.set(n.x, n.y, n.z, n.w), e.q1.copy(e.q0));
  }
  interpolate(e) {
    for (let t of this.tracked)
      t.obj &&
        (t.obj.position.lerpVectors(t.p0, t.p1, e),
        _interpQuat.slerpQuaternions(t.q0, t.q1, e),
        t.obj.quaternion.copy(_interpQuat));
  }
  step() {
    (this.world.step(this.events), this.stepCount++, this.snapshot());
  }
  drainCollisions(e) {
    (this.events.drainCollisionEvents((t, n, r) => e(t, n, r)), this.events.drainContactForceEvents(() => {}));
  }
  castRayDown(e, t, n, r, i, a) {
    let o = new RAPIER.Ray({ x: e, y: t, z: n }, { x: 0, y: -1, z: 0 });
    return this.world.castRayAndGetNormal(o, r, !0, void 0, i, void 0, a);
  }
  get bodyCount() {
    return this.world.bodies.len();
  }
};
// Every control goes through kit.input actions: keyboard and mouse, gamepad and
// the kit's touch controls (floating stick, buttons, drag to look, pinch to zoom).
var ACTIONS = {
  move: { type: `vector`, keys: `wasd+arrows`, gamepad: `leftStick+dpad`, touch: `stick` },
  look: { type: `look`, mouse: `drag`, gamepad: `rightStick`, touch: `drag` },
  // Driving: W/S or the triggers for gas and brake, A/D or the left stick to steer (the stick's Y is not gas).
  gas: { type: `axis`, keys: { pos: [`KeyW`, `ArrowUp`], neg: [`KeyS`, `ArrowDown`] }, gamepad: { pos: `RT`, neg: `LT` } },
  steer: { type: `axis`, keys: { pos: [`KeyD`, `ArrowRight`], neg: [`KeyA`, `ArrowLeft`] }, gamepad: `leftStickX` },
  dpad: { type: `vector`, gamepad: `dpad` },
  action: { keys: [`Space`], gamepad: [`A`], touch: `Action` },
  alt: { keys: [`ShiftLeft`, `ShiftRight`, `KeyF`, `KeyK`], gamepad: [`B`], touch: `Alt` },
  enter: { keys: [`KeyE`, `Enter`], gamepad: [`X`], touch: `Enter / Exit` },
  carrier: { keys: [`KeyC`], gamepad: [`Y`], touch: `Carrier view` },
  pause: { keys: [`Escape`, `KeyP`], gamepad: [`Start`], touch: { label: `II`, slot: `top` } },
  camL: { keys: [`KeyQ`], gamepad: [`LB`] },
  camR: { keys: [`KeyR`], gamepad: [`RB`] },
  zoom: { keys: [`KeyV`], gamepad: [`Back`, `RS`] },
  mute: { keys: [`KeyM`] },
  diag: { keys: [`Backquote`, `F3`] },
};
var PRESS_ACTIONS = [`action`, `alt`, `enter`, `carrier`, `pause`, `camL`, `camR`, `zoom`, `mute`, `diag`];
// kit.input.look() is in radians; these keep the original turn rates per device [yaw, pitch].
var LOOK_SCALE = { keyboard: [2.5, 1.67], touch: [1.45, 0.91], gamepad: [1.04, 0.46] };
/** The small input API the game and its menus were written against, on top of kit.input. */
var Input = class {
  constructor(kit) {
    ((this.kit = kit),
      (this.ki = kit.input),
      (this.presses = new Map()),
      (this.cam = { yaw: 0, pitch: 0, zoom: 0 }),
      (this.listeners = []),
      (this._nav = null),
      (this._navHold = !1),
      (this._zoomAcc = 0),
      (this._zoomIdle = 0),
      (this._rumbleT = 0));
  }
  /** 'keyboard' | 'gamepad' | 'touch', for button prompts. */
  get lastDevice() {
    return this.ki.source;
  }
  on(e) {
    this.listeners.push(e);
  }
  _emit(...e) {
    for (let t of this.listeners) t(...e);
  }
  /** Once per frame, before the game reads anything: queue presses, menu steps and camera moves. */
  poll(dt) {
    const ki = this.ki;
    for (const name of PRESS_ACTIONS)
      ki.pressed(name) && (this.presses.set(name, (this.presses.get(name) || 0) + 1), this._emit(`press`, name));
    // Menus step once per push of the stick, d-pad, arrows or WASD.
    const mv = ki.vector(`move`),
      dir = mv.y > 0.6 ? `up` : mv.y < -0.6 ? `down` : mv.x < -0.6 ? `left` : mv.x > 0.6 ? `right` : null;
    this._navHold ? dir || (this._navHold = !1) : dir && dir !== this._nav && this._emit(`nav`, dir);
    this._nav = dir;
    const look = ki.look(`look`),
      [ky, kp] = LOOK_SCALE[ki.source] || LOOK_SCALE.keyboard;
    ((this.cam.yaw -= look.x * ky), (this.cam.pitch += look.y * kp));
    // Wheel and pinch step the zoom level; + is closer.
    const z = ki.zoom();
    z ? ((this._zoomAcc += z), (this._zoomIdle = 0)) : (this._zoomIdle += dt) > 0.4 && (this._zoomAcc = 0);
    Math.abs(this._zoomAcc) >= 0.4 && ((this.cam.zoom -= Math.sign(this._zoomAcc)), (this._zoomAcc = 0));
  }
  /** Ignore the direction held right now until it is let go: the key that opens a menu must not also move in it. */
  holdNav() {
    this._navHold = !0;
  }
  consume(e) {
    return (this.presses.get(e) || 0) > 0 && (this.presses.set(e, 0), !0);
  }
  clearPresses() {
    this.presses.clear();
  }
  isHeld(e) {
    return this.ki.down(e);
  }
  rumble(e = 0.5, t = 120) {
    let n = performance.now();
    n - this._rumbleT < 90 ||
      ((this._rumbleT = n), (this.lastDevice !== `touch` || e > 0.35) && this.ki.rumble(Math.min(1, e), t));
  }
  drive() {
    const pad = this.ki.vector(`dpad`);
    return {
      throttle: clamp(this.ki.value(`gas`) + pad.y, -1, 1),
      steer: clamp(this.ki.value(`steer`) + pad.x, -1, 1),
    };
  }
  moveStick() {
    const v = this.ki.vector(`move`);
    return { x: v.x, y: v.y, mag: Math.min(1, Math.hypot(v.x, v.y)) };
  }
  /** On touch the stick steers toward where it points (point-to-go) instead of gas and steer. */
  usePointToGo() {
    if (this.ki.source !== `touch`) return !1;
    const v = this.ki.vector(`move`);
    return v.x !== 0 || v.y !== 0;
  }
  takeCam() {
    let e = { yaw: this.cam.yaw, pitch: this.cam.pitch, zoom: this.cam.zoom };
    return ((this.cam.yaw = 0), (this.cam.pitch = 0), (this.cam.zoom = 0), e);
  }
};
function dataUriToBuffer(e) {
  let t = e.indexOf(`,`),
    n = atob(e.slice(t + 1)),
    r = n.length,
    i = new Uint8Array(r);
  for (let e = 0; e < r; e++) i[e] = n.charCodeAt(e);
  return i.buffer;
}
var AudioSystem = class {
  constructor() {
    ((this.ctx = null),
      (this.entries = new Map()),
      (this.buffers = new Map()),
      (this.decoding = new Map()),
      (this.vol = { master: 0.85, music: 0.7, sfx: 0.9 }),
      (this.muted = !1),
      (this.music = null),
      (this.musicWanted = null),
      (this.listener = { x: 0, y: 0, z: 0, yaw: 0 }),
      (this.loops = new Set()),
      (this.manifest = null),
      (this._duck = 1),
      (this._lastPlay = new Map()),
      this._readManifest());
  }
  _readManifest() {
    let e = document.getElementById(`audio-manifest`);
    if (!e) {
      console.warn(`No audio manifest`);
      return;
    }
    try {
      let t = JSON.parse(e.textContent);
      this.manifest = t;
      for (let e of t.assets) this.entries.set(e.id, e);
    } catch (e) {
      console.warn(`Bad audio manifest`, e);
    }
  }
  unlock() {
    if (!this.ctx) {
      let e = window.AudioContext || window.webkitAudioContext;
      if (!e) return;
      ((this.ctx = new e({ latencyHint: `interactive` })),
        (this.master = this.ctx.createGain()),
        (this.musicBus = this.ctx.createGain()),
        (this.sfxBus = this.ctx.createGain()),
        (this.comp = this.ctx.createDynamicsCompressor()),
        (this.comp.threshold.value = -14),
        (this.comp.knee.value = 10),
        (this.comp.ratio.value = 4),
        (this.comp.attack.value = 0.004),
        (this.comp.release.value = 0.2),
        this.musicBus.connect(this.master),
        this.sfxBus.connect(this.comp),
        this.comp.connect(this.master),
        this.master.connect(this.ctx.destination),
        this.applyVolumes(),
        document.addEventListener(`visibilitychange`, () => {
          this.ctx && (document.hidden ? this.ctx.suspend() : this.ctx.resume());
        }),
        this.decodeAll());
    }
    this.ctx.state === `suspended` && this.ctx.resume();
  }
  applyVolumes() {
    if (!this.ctx) return;
    let e = this.ctx.currentTime;
    (this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, e, 0.03),
      this.musicBus.gain.setTargetAtTime(this.vol.music * this._duck, e, 0.08),
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, e, 0.03));
  }
  setVolume(e, t) {
    ((this.vol[e] = clamp(t, 0, 1)), this.applyVolumes());
  }
  setMuted(e) {
    ((this.muted = e), this.applyVolumes());
  }
  async decodeAll() {
    let e = [...this.entries.keys()];
    e.sort((e, t) => {
      let n = this.entries.get(e).kind,
        r = this.entries.get(t).kind,
        i = (e, t) => (t === this.musicWanted ? -1 : e === `sfx` ? 0 : e === `jingle` ? 1 : 2);
      return i(n, e) - i(r, t);
    });
    for (let t of e) await this._decode(t);
  }
  _decode(e) {
    if (this.buffers.has(e)) return Promise.resolve(this.buffers.get(e));
    if (this.decoding.has(e)) return this.decoding.get(e);
    let t = this.entries.get(e);
    if (!t || !this.ctx) return Promise.resolve(null);
    // Sounds are files next to the game (audio/…), fetched and decoded after the first gesture.
    let n = (
      t.src.startsWith(`data:`)
        ? Promise.resolve().then(() => dataUriToBuffer(t.src))
        : fetch(new URL(t.src, import.meta.url)).then((r) => {
            if (!r.ok) throw Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
          })
    )
      .then((r) => this.ctx.decodeAudioData(r))
      .then(
        (r) => (
          this.buffers.set(e, r),
          (t._offset = t.mime === `audio/mpeg` && t.duration && r.duration - t.duration > 0.04 ? 0.034531 : 0),
          this.musicWanted === e && (!this.music || this.music.id !== e) && this.playMusic(e, 0.6),
          r
        ),
        (r) => (console.warn(`audio decode failed`, e, r), null),
      );
    return (this.decoding.set(e, n), n);
  }
  playMusic(e, t = 1) {
    if (((this.musicWanted = e), !this.ctx || (this.music && this.music.id === e))) return;
    let n = this.buffers.get(e),
      r = this.ctx.currentTime;
    if (this.music) {
      let e = this.music;
      (e.gain.gain.cancelScheduledValues(r),
        e.gain.gain.setValueAtTime(e.gain.gain.value, r),
        e.gain.gain.linearRampToValueAtTime(0, r + t));
      try {
        e.src.stop(r + t + 0.05);
      } catch {}
      this.music = null;
    }
    if (!e) return;
    if (!n) {
      this._decode(e);
      return;
    }
    let i = this.entries.get(e),
      a = this.ctx.createBufferSource();
    if (((a.buffer = n), i.loop)) {
      a.loop = !0;
      let e = i._offset || 0;
      ((a.loopStart = (i.loopStart || 0) + e), (a.loopEnd = Math.min(n.duration, (i.loopEnd || n.duration) + e)));
    }
    let o = this.ctx.createGain();
    (o.gain.setValueAtTime(0, r),
      o.gain.linearRampToValueAtTime(i.gain ?? 0.8, r + Math.max(0.05, t * 0.6)),
      a.connect(o),
      o.connect(this.musicBus),
      a.start(r, i._offset || 0),
      (this.music = { id: e, src: a, gain: o }));
  }
  stopMusic(e = 0.8) {
    this.playMusic(null, e);
  }
  playJingle(e, t = 0.25) {
    if (!this.ctx) return;
    let n = this.buffers.get(e);
    if (!n) {
      this._decode(e);
      return;
    }
    let r = this.entries.get(e),
      i = this.ctx.createBufferSource();
    i.buffer = n;
    let a = this.ctx.createGain();
    ((a.gain.value = r.gain ?? 0.8),
      i.connect(a),
      a.connect(this.master),
      i.start(this.ctx.currentTime, r._offset || 0),
      (this._duck = t),
      this.applyVolumes(),
      clearTimeout(this._duckT),
      (this._duckT = setTimeout(
        () => {
          ((this._duck = 1), this.applyVolumes());
        },
        (n.duration - 0.3) * 1e3,
      )));
  }
  setListener(e, t, n, r) {
    let i = this.listener;
    ((i.x = e), (i.y = t), (i.z = n), (i.yaw = r));
  }
  _spatial(e) {
    if (!e) return { g: 1, pan: 0 };
    let t = this.listener,
      n = e.x - t.x,
      r = e.z - t.z,
      i = (e.y || 0) - t.y,
      a = Math.sqrt(n * n + r * r + i * i * 0.25),
      o = clamp(1 / (1 + Math.max(0, a - 12) * 0.045), 0, 1),
      s = -Math.cos(t.yaw),
      c = Math.sin(t.yaw);
    return { g: o, pan: a > 0.5 ? clamp((n * s + r * c) / Math.max(a, 8), -0.85, 0.85) : 0 };
  }
  play(e, t = {}) {
    if (!this.ctx || this.ctx.state !== `running`) return null;
    let n = this.buffers.get(e);
    if (!n) return (this._decode(e), null);
    let r = this.ctx.currentTime,
      i = t.minGap ?? 0.03;
    if (r - (this._lastPlay.get(e) || 0) < i) return null;
    this._lastPlay.set(e, r);
    let a = this.entries.get(e),
      { g: o, pan: s } = this._spatial(t.pos),
      c = (t.vol ?? 1) * (a.gain ?? 1) * o;
    if (c < 0.01) return null;
    let l = this.ctx.createBufferSource();
    ((l.buffer = n), (l.playbackRate.value = (t.rate ?? 1) * (t.jitter ? 1 + (Math.random() - 0.5) * t.jitter : 1)));
    let u = this.ctx.createGain();
    u.gain.value = c;
    let d = l;
    if ((d.connect(u), (d = u), this.ctx.createStereoPanner && s !== 0)) {
      let e = this.ctx.createStereoPanner();
      ((e.pan.value = s), d.connect(e), (d = e));
    }
    return (d.connect(this.sfxBus), l.start(r + (t.delay || 0)), l);
  }
  loop(e, t = {}) {
    let n = this,
      r = {
        id: e,
        src: null,
        gain: null,
        pan: null,
        vol: t.vol ?? 1,
        rate: t.rate ?? 1,
        pos: t.pos || null,
        alive: !0,
        _start() {
          if (this.src || !n.ctx) return;
          let t = n.buffers.get(e);
          if (!t) {
            n._decode(e);
            return;
          }
          let r = n.entries.get(e);
          ((this.src = n.ctx.createBufferSource()),
            (this.src.buffer = t),
            (this.src.loop = !0),
            r.loopEnd && ((this.src.loopStart = r.loopStart || 0), (this.src.loopEnd = r.loopEnd)),
            (this.gain = n.ctx.createGain()),
            (this.gain.gain.value = 0),
            this.src.connect(this.gain));
          let i = this.gain;
          (n.ctx.createStereoPanner && ((this.pan = n.ctx.createStereoPanner()), i.connect(this.pan), (i = this.pan)),
            i.connect(n.sfxBus),
            this.src.start(n.ctx.currentTime, Math.random() * t.duration * 0.9),
            (this.base = r.gain ?? 1));
        },
        update() {
          if (!this.alive || !n.ctx || (this.src || this._start(), !this.src)) return;
          let { g: e, pan: t } = n._spatial(this.pos),
            r = n.ctx.currentTime;
          (this.gain.gain.setTargetAtTime(Math.max(0, this.vol * this.base * e), r, 0.05),
            this.src.playbackRate.setTargetAtTime(Math.max(0.05, this.rate), r, 0.05),
            this.pan && this.pan.pan.setTargetAtTime(t, r, 0.05));
        },
        stop() {
          if (((this.alive = !1), n.loops.delete(this), this.src && n.ctx)) {
            let e = n.ctx.currentTime;
            this.gain.gain.setTargetAtTime(0, e, 0.05);
            try {
              this.src.stop(e + 0.3);
            } catch {}
          }
          this.src = null;
        },
      };
    return (this.loops.add(r), r);
  }
  update() {
    for (let e of this.loops) e.update();
  }
  stopAllLoops() {
    for (let e of [...this.loops]) e.stop();
  }
  pauseAll() {
    this.ctx && this.ctx.state === `running` && this.ctx.suspend();
  }
  resumeAll() {
    this.ctx && this.ctx.state === `suspended` && !document.hidden && this.ctx.resume();
  }
};
var SAVE_DEFAULTS = {
  version: 1,
  options: {
    master: 0.85,
    music: 0.7,
    sfx: 0.9,
    muted: !1,
    camera: `chase`,
    diagnostics: !0,
    carrierPace: `normal`,
    shake: 1,
  },
  medals: { carrier: null, demolition: null, trial: null },
  best: { completion: 0, missionTime: null, trialTime: null, fullTime: null },
  stats: { plays: 0, carrierSaved: 0, scientists: 0 },
  trialUnlocked: !1,
};
var MEDAL_RANK = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
var SaveGame = class {
  constructor() {
    ((this.data = structuredClone(SAVE_DEFAULTS)), (this.available = !1), this.load());
  }
  load() {
    try {
      let e = window.localStorage.getItem(SAVE_KEY);
      if (((this.available = !0), e)) {
        let t = JSON.parse(e);
        this.data = {
          ...structuredClone(SAVE_DEFAULTS),
          ...t,
          options: { ...SAVE_DEFAULTS.options, ...(t.options || {}) },
          medals: { ...SAVE_DEFAULTS.medals, ...(t.medals || {}) },
          best: { ...SAVE_DEFAULTS.best, ...(t.best || {}) },
          stats: { ...SAVE_DEFAULTS.stats, ...(t.stats || {}) },
        };
      }
    } catch {
      this.available = !1;
    }
  }
  save() {
    try {
      return (window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)), (this.available = !0), !0);
    } catch {
      return ((this.available = !1), !1);
    }
  }
  reset() {
    let e = this.data.options;
    ((this.data = structuredClone(SAVE_DEFAULTS)), (this.data.options = e), this.save());
  }
  get options() {
    return this.data.options;
  }
  awardMedal(e, t) {
    if (!t) return !1;
    let n = this.data.medals[e];
    return !n || MEDAL_RANK[t] > MEDAL_RANK[n] ? ((this.data.medals[e] = t), !0) : !1;
  }
};
var _fxMat = new THREE.Matrix4();
var _fxPos = new THREE.Vector3();
var _fxQuat = new THREE.Quaternion();
var _fxScale = new THREE.Vector3();
var _fxEuler = new THREE.Euler();
var _fxColor = new THREE.Color();
var Effects = class {
  constructor(e) {
    ((this.scene = e), (this.max = 1400), (this.parts = []));
    let t = new THREE.IcosahedronGeometry(1, 0),
      n = new THREE.MeshStandardNodeMaterial({
        color: 16777215,
        roughness: 1,
        metalness: 0,
        transparent: !0,
        opacity: 0.5,
        depthWrite: !1,
      });
    ((this.lit = new THREE.InstancedMesh(t, n, 1600)),
      (this.glow = new THREE.InstancedMesh(t, instanceGlowMaterial(3.2), 1e3)));
    for (let t of [this.lit, this.glow])
      ((t.frustumCulled = !1),
        t.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        t.setColorAt(0, _fxColor.set(1, 1, 1)),
        t.instanceColor.setUsage(THREE.DynamicDrawUsage),
        (t.count = 0),
        (t.castShadow = !1),
        (t.receiveShadow = !1),
        e.add(t));
    ((this.lit.castShadow = !1), (this.rings = []));
    let r = new THREE.RingGeometry(0.8, 1, 24, 1);
    r.rotateX(-Math.PI / 2);
    for (let t = 0; t < 6; t++) {
      let t = new THREE.Mesh(
        r,
        new THREE.MeshBasicNodeMaterial({ color: 16777215, transparent: !0, opacity: 0, depthWrite: !1, fog: !0 }),
      );
      ((t.visible = !1), (t.userData = { t: 0, life: 1, r0: 1, r1: 10 }), e.add(t), this.rings.push(t));
    }
    let i = new THREE.PlaneGeometry(1, 1);
    i.rotateX(-Math.PI / 2);
    let a = new THREE.MeshStandardNodeMaterial({
      color: 1776413,
      roughness: 0.95,
      transparent: !0,
      opacity: 0.55,
      depthWrite: !1,
    });
    ((a.polygonOffset = !0), (a.polygonOffsetFactor = -2), (a.polygonOffsetUnits = -2));
    let o = () => {
      let t = new THREE.InstancedMesh(i, a, 700);
      return (
        (t.frustumCulled = !1),
        (t.count = 0),
        (t.receiveShadow = !0),
        t.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        (t.userData = { idx: 0, cnt: 0 }),
        e.add(t),
        t
      );
    };
    ((this.skidS = o()),
      (this.skidU = o()),
      (this.skidU.visible = !1),
      (this.trauma = 0),
      (this.shakeScale = 1),
      (this.time = 0));
  }
  setMax(e) {
    this.max = e;
  }
  spawn(e) {
    this.parts.length >= this.max && this.parts.shift();
    let t = {
      x: e.x,
      y: e.y,
      z: e.z,
      vx: e.vx || 0,
      vy: e.vy || 0,
      vz: e.vz || 0,
      life: 0,
      max: e.life || 1,
      s0: e.s0 ?? 0.5,
      s1: e.s1 ?? 0.1,
      peak: e.peak ?? 0.25,
      color: new THREE.Color(e.color ?? 16777215),
      color2: e.color2 == null ? null : new THREE.Color(e.color2),
      glow: !!e.glow,
      drag: e.drag ?? 1.5,
      g: e.g ?? 0,
      rot: rng() * 6,
      spin: (rng() - 0.5) * (e.spin ?? 4),
      floor: e.floor ?? -1e9,
      sy: e.sy ?? 1,
    };
    return (this.parts.push(t), t);
  }
  dust(e, t, n, r = 6, i = 1.4, a = 14077112) {
    for (let o = 0; o < r; o++) {
      let r = rng() * Math.PI * 2,
        o = 1 + rng() * 3;
      this.spawn({
        x: e + (rng() - 0.5) * 1.5,
        y: t + rng() * 0.6,
        z: n + (rng() - 0.5) * 1.5,
        vx: Math.cos(r) * o,
        vy: 0.8 + rng() * 2.2,
        vz: Math.sin(r) * o,
        life: 1.2 + rng() * 1.4,
        s0: i * (0.3 + rng() * 0.3),
        s1: i * (0.9 + rng() * 0.8),
        peak: 0.35,
        color: a,
        drag: 2.2,
        g: -0.3,
        floor: t - 1,
      });
    }
  }
  bigDust(e, t, n, r, i, a = 40, o = 14274493) {
    for (let s = 0; s < a; s++) {
      let a = rng() * Math.PI * 2,
        s = r * (0.5 + rng() * 0.7),
        c = 2 + rng() * 5;
      this.spawn({
        x: e + Math.cos(a) * s,
        y: t + rng() * i,
        z: n + Math.sin(a) * s,
        vx: Math.cos(a) * c,
        vy: 0.5 + rng() * 3,
        vz: Math.sin(a) * c,
        life: 1.8 + rng() * 1.8,
        s0: 0.8 + rng() * 0.6,
        s1: 1.8 + rng() * 1.6,
        peak: 0.3,
        color: o,
        drag: 1.5,
        g: -0.2,
      });
    }
  }
  smoke(e, t, n, r = 3, i = 1, a = 5592924) {
    for (let o = 0; o < r; o++)
      this.spawn({
        x: e + (rng() - 0.5),
        y: t,
        z: n + (rng() - 0.5),
        vx: (rng() - 0.5) * 1.5,
        vy: 2 + rng() * 2.5,
        vz: (rng() - 0.5) * 1.5,
        life: 1.8 + rng() * 1.5,
        s0: i * 0.5,
        s1: i * (1.6 + rng()),
        peak: 0.4,
        color: a,
        drag: 1.2,
        g: 0.4,
      });
  }
  sparks(e, t, n, r = 10, i = null, a = 16761674) {
    for (let o = 0; o < r; o++) {
      let r = (i ? i.x * 6 : 0) + (rng() - 0.5) * 10,
        o = (i ? i.z * 6 : 0) + (rng() - 0.5) * 10;
      this.spawn({
        x: e,
        y: t,
        z: n,
        vx: r,
        vy: 3 + rng() * 7,
        vz: o,
        life: 0.3 + rng() * 0.45,
        s0: 0.14,
        s1: 0.03,
        peak: 0.05,
        color: a,
        glow: !0,
        drag: 0.8,
        g: -20,
        floor: t - 3,
      });
    }
  }
  fireball(e, t, n, r = 1) {
    let i = Math.round(14 * r);
    for (let a = 0; a < i; a++) {
      let i = rng() * Math.PI * 2,
        a = rng() * Math.PI - Math.PI / 2,
        o = (3 + rng() * 7) * r;
      this.spawn({
        x: e,
        y: t + 0.5,
        z: n,
        vx: Math.cos(i) * Math.cos(a) * o,
        vy: Math.abs(Math.sin(a)) * o + 2,
        vz: Math.sin(i) * Math.cos(a) * o,
        life: 0.45 + rng() * 0.5,
        s0: 0.5 * r,
        s1: 1.9 * r,
        peak: 0.22,
        color: rng() < 0.5 ? 16765286 : 16747050,
        color2: 9054736,
        glow: !0,
        drag: 3,
        g: 2,
      });
    }
  }
  explosion(e, t, n, r = 1) {
    (this.fireball(e, t, n, r),
      this.smoke(e, t + 1, n, Math.round(8 * r), 2.2 * r, 4868944),
      this.sparks(e, t + 1, n, Math.round(18 * r)),
      this.dust(e, t, n, Math.round(8 * r), 2 * r),
      this.ring(e, t + 0.3, n, 1, 12 * r, 0.55, 16769712),
      this.shake(0.55 * r));
  }
  firework(e, t, n) {
    let r = [16730682, 16765498, 5111674, 4892927, 16743152],
      i = r[Math.floor(rng() * r.length)];
    for (let r = 0; r < 36; r++) {
      let r = rng() * Math.PI * 2,
        a = Math.acos(2 * rng() - 1),
        o = 9 + rng() * 5;
      this.spawn({
        x: e,
        y: t,
        z: n,
        vx: Math.sin(a) * Math.cos(r) * o,
        vy: Math.cos(a) * o,
        vz: Math.sin(a) * Math.sin(r) * o,
        life: 1.1 + rng() * 0.6,
        s0: 0.35,
        s1: 0.2,
        peak: 0.1,
        color: i,
        glow: !0,
        drag: 1.4,
        g: -6,
      });
    }
  }
  ring(e, t, n, r, i, a = 0.5, o = 16777215) {
    let s = this.rings.find((e) => !e.visible) || this.rings[0];
    (s.position.set(e, t, n),
      (s.visible = !0),
      s.material.color.set(o),
      (s.userData = { t: 0, life: a, r0: r, r1: i }));
  }
  skidMark(e, t, n, r = 0.6, i = 0.55, a = 0.04) {
    let o = a < -3 ? this.skidU : this.skidS,
      s = o.userData,
      c = o.instanceMatrix.count,
      l = s.idx;
    ((s.idx = (s.idx + 1) % c),
      (s.cnt = Math.min(s.cnt + 1, c)),
      _fxQuat.setFromEuler(_fxEuler.set(0, n, 0)),
      _fxMat.compose(_fxPos.set(e, a, t), _fxQuat, _fxScale.set(i, 1, r)),
      o.setMatrixAt(l, _fxMat),
      (o.count = s.cnt),
      (o.instanceMatrix.needsUpdate = !0));
  }
  setArea(e) {
    ((this.skidS.visible = e !== `underground`), (this.skidU.visible = e === `underground`));
  }
  reset() {
    ((this.parts.length = 0), (this.trauma = 0));
    for (let e of [this.skidS, this.skidU]) ((e.count = 0), (e.userData.idx = 0), (e.userData.cnt = 0));
    for (let e of this.rings) e.visible = !1;
    ((this.lit.count = 0), (this.glow.count = 0));
  }
  shake(e) {
    this.trauma = clamp(this.trauma + e * this.shakeScale, 0, 1.2);
  }
  update(e) {
    ((this.time += e), (this.trauma = Math.max(0, this.trauma - e * 1.6)));
    let t = 0,
      n = 0,
      r = this.parts;
    for (let t = r.length - 1; t >= 0; t--) {
      let n = r[t];
      if (((n.life += e), n.life >= n.max)) {
        r.splice(t, 1);
        continue;
      }
      let i = Math.exp(-n.drag * e);
      ((n.vx *= i),
        (n.vz *= i),
        (n.vy = n.vy * i + n.g * e),
        (n.x += n.vx * e),
        (n.y += n.vy * e),
        (n.z += n.vz * e),
        n.y < n.floor && ((n.y = n.floor), (n.vy = Math.abs(n.vy) * 0.3)),
        (n.rot += n.spin * e));
    }
    for (let e of r) {
      let r = e.life / e.max,
        i = Math.max(
          0.001,
          r < e.peak ? e.s0 + (e.s1 - e.s0) * (r / e.peak) : e.s1 * (1 - (r - e.peak) / (1 - e.peak)),
        );
      if (
        (_fxQuat.setFromEuler(_fxEuler.set(e.rot, e.rot * 0.7, 0)),
        _fxMat.compose(_fxPos.set(e.x, e.y, e.z), _fxQuat, _fxScale.set(i, i * e.sy, i)),
        e.glow)
      ) {
        if (n >= this.glow.instanceMatrix.count) continue;
        (this.glow.setMatrixAt(n, _fxMat),
          e.color2 ? _fxColor.copy(e.color).lerp(e.color2, r) : _fxColor.copy(e.color),
          _fxColor.multiplyScalar(1 - r * 0.6),
          this.glow.setColorAt(n, _fxColor),
          n++);
      } else {
        if (t >= this.lit.instanceMatrix.count) continue;
        (this.lit.setMatrixAt(t, _fxMat), this.lit.setColorAt(t, e.color), t++);
      }
    }
    ((this.lit.count = t),
      (this.glow.count = n),
      t && ((this.lit.instanceMatrix.needsUpdate = !0), (this.lit.instanceColor.needsUpdate = !0)),
      n && ((this.glow.instanceMatrix.needsUpdate = !0), (this.glow.instanceColor.needsUpdate = !0)));
    for (let t of this.rings) {
      if (!t.visible) continue;
      let n = t.userData;
      n.t += e;
      let r = n.t / n.life;
      if (r >= 1) {
        t.visible = !1;
        continue;
      }
      let i = n.r0 + (n.r1 - n.r0) * (1 - (1 - r) ** 3);
      (t.scale.set(i, 1, i), (t.material.opacity = (1 - r) * 0.8));
    }
  }
  shakeOffset(e) {
    let t = this.trauma * this.trauma,
      n = this.time * 38;
    return (e.set(Math.sin(n * 1.13) * t * 0.9, Math.sin(n * 1.71 + 1) * t * 0.6, Math.sin(n * 0.93 + 2) * t * 0.9), e);
  }
  count() {
    return this.parts.length;
  }
};
var _meshColor = new THREE.Color();
var MeshBuffer = class {
  constructor() {
    ((this.p = []), (this.n = []), (this.c = []));
  }
  tri(e, t, n, r, i) {
    let a = t[0] - e[0],
      o = t[1] - e[1],
      s = t[2] - e[2],
      c = n[0] - e[0],
      l = n[1] - e[1],
      u = n[2] - e[2],
      d = o * u - s * l,
      f = s * c - a * u,
      p = a * l - o * c,
      m = Math.hypot(d, f, p) || 1;
    ((d /= m), (f /= m), (p /= m));
    for (let a of [e, t, n]) {
      (this.p.push(a[0], a[1], a[2]), this.n.push(d, f, p));
      let e = i ? i(a, f) : 1;
      this.c.push(r.r * e, r.g * e, r.b * e);
    }
  }
  quad(e, t, n, r, i, a) {
    (this.tri(e, t, n, i, a), this.tri(e, n, r, i, a));
  }
  toGeometry() {
    let e = new THREE.BufferGeometry();
    return (
      e.setAttribute(`position`, new THREE.Float32BufferAttribute(this.p, 3)),
      e.setAttribute(`normal`, new THREE.Float32BufferAttribute(this.n, 3)),
      e.setAttribute(`color`, new THREE.Float32BufferAttribute(this.c, 3)),
      e.computeBoundingSphere(),
      e.computeBoundingBox(),
      e
    );
  }
};
function addBevelBox(e, t, n, r, i, a, o, s, c, l) {
  let u = (e, t, n) => [a + e, o + t, s + n],
    d = -n,
    f = n,
    p = n - i;
  (e.quad(u(-t, d, -r), u(t, d, -r), u(t, d, r), u(-t, d, r), c, l),
    e.quad(u(t, d, -r), u(t, p, -r), u(t, p, r), u(t, d, r), c, l),
    e.quad(u(-t, d, r), u(-t, p, r), u(-t, p, -r), u(-t, d, -r), c, l),
    e.quad(u(t, d, r), u(t, p, r), u(-t, p, r), u(-t, d, r), c, l),
    e.quad(u(-t, d, -r), u(-t, p, -r), u(t, p, -r), u(t, d, -r), c, l),
    i > 0 &&
      (e.quad(u(t, p, -r), u(t - i, f, -r + i), u(t - i, f, r - i), u(t, p, r), c, l),
      e.quad(u(-t, p, r), u(-t + i, f, r - i), u(-t + i, f, -r + i), u(-t, p, -r), c, l),
      e.quad(u(t, p, r), u(t - i, f, r - i), u(-t + i, f, r - i), u(-t, p, r), c, l),
      e.quad(u(-t, p, -r), u(-t + i, f, -r + i), u(t - i, f, -r + i), u(t, p, -r), c, l)),
    e.quad(u(-t + i, f, -r + i), u(-t + i, f, r - i), u(t - i, f, r - i), u(t - i, f, -r + i), c, l));
}
function addPrism(e, t, n, r, i, a, o, s, c, l, u = !0, d = !1, f = null) {
  let p = [],
    m = (e, t, n) => {
      if (f) {
        let r = new THREE.Vector3(e, t, n).applyMatrix4(f);
        return [a + r.x, o + r.y, s + r.z];
      }
      return [a + e, o + t, s + n];
    };
  for (let e = 0; e < i; e++) {
    let t = (e / i) * Math.PI * 2 + Math.PI / i;
    p.push([Math.cos(t), Math.sin(t)]);
  }
  let h = -r / 2,
    g = r / 2;
  for (let r = 0; r < i; r++) {
    let a = p[r],
      o = p[(r + 1) % i];
    e.quad(
      m(a[0] * n, h, a[1] * n),
      m(a[0] * t, g, a[1] * t),
      m(o[0] * t, g, o[1] * t),
      m(o[0] * n, h, o[1] * n),
      c,
      l,
    );
  }
  if (u && t > 0.001)
    for (let n = 1; n < i - 1; n++)
      e.tri(
        m(p[0][0] * t, g, p[0][1] * t),
        m(p[n + 1][0] * t, g, p[n + 1][1] * t),
        m(p[n][0] * t, g, p[n][1] * t),
        c,
        l,
      );
  if (d && n > 0.001)
    for (let t = 1; t < i - 1; t++)
      e.tri(
        m(p[0][0] * n, h, p[0][1] * n),
        m(p[t][0] * n, h, p[t][1] * n),
        m(p[t + 1][0] * n, h, p[t + 1][1] * n),
        c,
        l,
      );
}
var STUD_R = 0.3;
var STUD_H = 0.17;
function heightShade(e, t, n = 0.72) {
  return (r, i) => {
    let a = (r[1] - e) / (t - e),
      o = n + (1 - n) * Math.min(1, Math.max(0, a)) ** 0.6;
    return (i < -0.5 && (o *= 0.6), o);
  };
}
function brickGeometry(e, t, n = BRICK_H, r = !0, i = 8) {
  let a = new MeshBuffer(),
    o = 0.035,
    s = (e * 1) / 2 - o,
    c = (t * 1) / 2 - o,
    l = n / 2 - 0.01,
    u = _meshColor.setRGB(1, 1, 1).clone(),
    d = heightShade(-l, l + STUD_H);
  if ((addBevelBox(a, s, l, c, 0.06, 0, 0, 0, u, d), r))
    for (let n = 0; n < e; n++)
      for (let r = 0; r < t; r++) {
        let o = (n - (e - 1) / 2) * 1,
          s = (r - (t - 1) / 2) * 1;
        addPrism(a, STUD_R, STUD_R, STUD_H, i, o, l + STUD_H / 2, s, u, d, !0);
      }
  return a.toGeometry();
}
function windowBrickGeometry() {
  let e = new MeshBuffer(),
    t = 0.035,
    n = 1 / 2 - t,
    r = 1 / 2 - t,
    i = BRICK_H / 2 - 0.01,
    a = new THREE.Color(1, 1, 1),
    o = new THREE.Color(0.16, 0.27, 0.4),
    s = heightShade(-i, i),
    c = 0.33499999999999996,
    l = i - 0.13;
  (e.quad(
    [-0.46499999999999997, i, -0.46499999999999997],
    [-0.46499999999999997, i, r],
    [n, i, r],
    [n, i, -0.46499999999999997],
    a,
    s,
  ),
    e.quad(
      [-0.46499999999999997, -i, -0.46499999999999997],
      [n, -i, -0.46499999999999997],
      [n, -i, r],
      [-0.46499999999999997, -i, r],
      a,
      s,
    ),
    e.quad([n, -i, -0.46499999999999997], [n, i, -0.46499999999999997], [n, i, r], [n, -i, r], a, s),
    e.quad(
      [-0.46499999999999997, -i, r],
      [-0.46499999999999997, i, r],
      [-0.46499999999999997, i, -0.46499999999999997],
      [-0.46499999999999997, -i, -0.46499999999999997],
      a,
      s,
    ));
  for (let t of [1, -1]) {
    let u = r * t,
      d = 0.345 * t,
      f = (e, n, r) => (t > 0 ? [e, n, r] : [-e, n, r]);
    (e.quad(f(-0.46499999999999997, -i, u), f(n, -i, u), f(c, -l, u), f(-0.33499999999999996, -l, u), a, s),
      e.quad(f(-0.33499999999999996, l, u), f(c, l, u), f(n, i, u), f(-0.46499999999999997, i, u), a, s),
      e.quad(
        f(-0.46499999999999997, -i, u),
        f(-0.33499999999999996, -l, u),
        f(-0.33499999999999996, l, u),
        f(-0.46499999999999997, i, u),
        a,
        s,
      ),
      e.quad(f(c, -l, u), f(n, -i, u), f(n, i, u), f(c, l, u), a, s),
      e.quad(f(-0.33499999999999996, -l, u), f(c, -l, u), f(c, -l, d), f(-0.33499999999999996, -l, d), a, s),
      e.quad(f(-0.33499999999999996, l, d), f(c, l, d), f(c, l, u), f(-0.33499999999999996, l, u), a, s),
      e.quad(
        f(-0.33499999999999996, -l, d),
        f(-0.33499999999999996, l, d),
        f(-0.33499999999999996, l, u),
        f(-0.33499999999999996, -l, u),
        a,
        s,
      ),
      e.quad(f(c, -l, u), f(c, l, u), f(c, l, d), f(c, -l, d), a, s),
      e.quad(f(-0.33499999999999996, -l, d), f(c, -l, d), f(c, l, d), f(-0.33499999999999996, l, d), o, () => 1));
  }
  return e.toGeometry();
}
function plateGeometry(e = 2, t = 2, n = !0) {
  return brickGeometry(e, t, PLATE_H, n);
}
var ModelBuilder = class {
  constructor() {
    ((this.buf = new MeshBuffer()), (this.m = new THREE.Matrix4()), (this.stack = []));
  }
  push(e) {
    return (this.stack.push(this.m.clone()), this.m.multiply(e), this);
  }
  pop() {
    return ((this.m = this.stack.pop()), this);
  }
  _tf(e) {
    return e.map((e) => {
      let t = new THREE.Vector3(e[0], e[1], e[2]).applyMatrix4(this.m);
      return [t.x, t.y, t.z];
    });
  }
  box(e, t, n, r, i, a, o, s = {}) {
    let c = new THREE.Color(o),
      l = new MeshBuffer(),
      u = s.flat ? null : heightShade(-t / 2, t / 2, s.shade ?? 0.8);
    if (
      (addBevelBox(l, e / 2, t / 2, n / 2, s.bevel ?? Math.min(0.06, e * 0.15, n * 0.15, t * 0.3), 0, 0, 0, c, u),
      s.studs)
    ) {
      let r = Math.max(1, Math.round(e / 1)),
        i = Math.max(1, Math.round(n / 1)),
        a = s.studScale ?? 1;
      for (let o = 0; o < r; o++)
        for (let s = 0; s < i; s++)
          addPrism(
            l,
            STUD_R * a,
            STUD_R * a,
            STUD_H * a,
            8,
            (o - (r - 1) / 2) * (e / r),
            t / 2 + (STUD_H * a) / 2,
            (s - (i - 1) / 2) * (n / i),
            c,
            u,
            !0,
          );
    }
    return (this._append(l, r, i, a, s.rot), this);
  }
  cyl(e, t, n, r, i, a, o, s, c = {}) {
    let l = new THREE.Color(s),
      u = new MeshBuffer();
    return (
      addPrism(
        u,
        e,
        t,
        n,
        r,
        0,
        0,
        0,
        l,
        c.flat ? null : heightShade(-n / 2, n / 2, c.shade ?? 0.85),
        c.capTop ?? !0,
        c.capBot ?? !1,
      ),
      this._append(u, i, a, o, c.rot),
      this
    );
  }
  wedge(e, t, n, r, i, a, o, s = {}) {
    let c = new THREE.Color(o),
      l = new MeshBuffer(),
      u = e / 2,
      d = t / 2,
      f = n / 2,
      p = s.lowFrac ?? 0.15,
      m = -d + t * p,
      h = heightShade(-d, d, 0.8);
    return (
      l.quad([-u, -d, -f], [u, -d, -f], [u, -d, f], [-u, -d, f], c, h),
      l.quad([-u, -d, -f], [-u, d, -f], [u, d, -f], [u, -d, -f], c, h),
      l.quad([u, -d, f], [u, m, f], [-u, m, f], [-u, -d, f], c, h),
      l.quad([-u, d, -f], [-u, m, f], [u, m, f], [u, d, -f], c, h),
      l.quad([u, -d, -f], [u, d, -f], [u, m, f], [u, -d, f], c, h),
      l.quad([-u, -d, f], [-u, m, f], [-u, d, -f], [-u, -d, -f], c, h),
      this._append(l, r, i, a, s.rot),
      this
    );
  }
  ico(e, t, n, r, i, a = {}) {
    let o = new THREE.Color(i),
      s = new THREE.IcosahedronGeometry(e, a.detail ?? 0);
    s.index && (s = s.toNonIndexed());
    let c = s.attributes.position,
      l = new MeshBuffer();
    for (let t = 0; t < c.count; t += 3) {
      let n = [c.getX(t), c.getY(t) * (a.sy ?? 1), c.getZ(t)],
        r = [c.getX(t + 1), c.getY(t + 1) * (a.sy ?? 1), c.getZ(t + 1)],
        i = [c.getX(t + 2), c.getY(t + 2) * (a.sy ?? 1), c.getZ(t + 2)];
      l.tri(n, r, i, o, (t) => 0.82 + 0.18 * ((t[1] / e) * 0.5 + 0.5));
    }
    return (this._append(l, t, n, r, a.rot), this);
  }
  _append(e, t, n, r, i) {
    let a = new THREE.Matrix4();
    (i && a.makeRotationFromEuler(new THREE.Euler(i[0] || 0, i[1] || 0, i[2] || 0)), a.setPosition(t, n, r));
    let o = this.m.clone().multiply(a),
      s = new THREE.Matrix3().getNormalMatrix(o),
      c = new THREE.Vector3();
    for (let t = 0; t < e.p.length; t += 3)
      (c.set(e.p[t], e.p[t + 1], e.p[t + 2]).applyMatrix4(o),
        this.buf.p.push(c.x, c.y, c.z),
        c
          .set(e.n[t], e.n[t + 1], e.n[t + 2])
          .applyMatrix3(s)
          .normalize(),
        this.buf.n.push(c.x, c.y, c.z),
        this.buf.c.push(e.c[t], e.c[t + 1], e.c[t + 2]));
  }
  get empty() {
    return this.buf.p.length === 0;
  }
  build() {
    return this.buf.toGeometry();
  }
};
function ribbonGeometry(e, t, n, r, i = {}) {
  let a = new MeshBuffer(),
    o = new THREE.Color(r),
    s = t / 2,
    c = [],
    l = [];
  for (let t = 0; t < e.length; t++) {
    let r = e[t],
      i = e[Math.max(0, t - 1)],
      a = e[Math.min(e.length - 1, t + 1)],
      o = a.x - i.x,
      u = a.z - i.z,
      d = Math.hypot(o, u) || 1;
    ((o /= d), (u /= d), c.push([r.x - u * s, n, r.z + o * s]), l.push([r.x + u * s, n, r.z - o * s]));
  }
  for (let t = 0; t < e.length - 1; t++)
    (i.dash && t % i.dash[1] >= i.dash[0]) || a.quad(c[t], c[t + 1], l[t + 1], l[t], o, null);
  return a.toGeometry();
}
function flatQuadGeometry(e, t, n, r, i, a) {
  let o = new MeshBuffer(),
    s = new THREE.Color(a);
  return (o.quad([e, i, t], [e, i, r], [n, i, r], [n, i, t], s, null), o.toGeometry());
}
function mergeMeshBuffers(e) {
  let t = new MeshBuffer();
  for (let n of e) {
    let e = n.attributes.position.array,
      r = n.attributes.normal.array,
      i = n.attributes.color ? n.attributes.color.array : null;
    for (let n = 0; n < e.length; n++) (t.p.push(e[n]), t.n.push(r[n]));
    if (i) for (let e = 0; e < i.length; e++) t.c.push(i[e]);
    else for (let n = 0; n < e.length; n++) t.c.push(1);
  }
  return t.toGeometry();
}
var BRICK_KINDS = [`b1`, `b2`, `b1s`, `b2s`, `p2`, `win`, `sl`];
var DEBRIS_KIND = { b1: `b1s`, b2: `b2s`, b1s: `b1s`, b2s: `b2s`, p2: `p2`, win: `win`, sl: `sl` };
var MOVING_KINDS = [`b1s`, `b2s`, `p2`, `win`, `sl`];
var BRICK_HALF = {
  b1: [0.5, 0.6, 0.5],
  b1s: [0.5, 0.6, 0.5],
  b2: [1, 0.6, 0.5],
  b2s: [1, 0.6, 0.5],
  p2: [1, 0.2, 1],
  win: [0.5, 0.6, 0.5],
  sl: [1, 0.6, 0.5],
};
function slopeGeometry() {
  let e = new ModelBuilder();
  return (e.wedge(1.93, BRICK_H - 0.02, 1 - 0.07, 0, 0, 0, 16777215, { lowFrac: 0.12 }), e.build());
}
var _bMat = new THREE.Matrix4();
var _bQuat = new THREE.Quaternion();
var _bPos = new THREE.Vector3();
var _bScale = new THREE.Vector3(1, 1, 1);
var _bHidden = new THREE.Matrix4().makeScale(0, 0, 0);
var _bUp = new THREE.Vector3(0, 1, 0);
var _bEuler = new THREE.Euler();
var Building = class {
  constructor(e, t) {
    ((this.sys = e),
      (this.def = t),
      (this.id = t.id),
      (this.name = t.name || t.id),
      (this.kind = t.kind || `building`),
      (this.w = t.w),
      (this.d = t.d),
      (this.x0 = t.x - (t.w * 1) / 2),
      (this.z0 = t.z - (t.d * 1) / 2),
      (this.baseY = t.y || 0),
      (this.layers = []),
      (this.bricks = []),
      (this.grid = new Map()),
      (this.maxHp = t.hp ?? 100),
      (this.hp = this.maxHp),
      (this.reinforced = !!t.reinforced),
      (this.filter = t.filter || null),
      (this.survivors = t.survivors || 0),
      (this.counts = t.counts !== !1 && this.kind !== `door`),
      (this.collapsed = !1),
      (this.inPath = !1),
      (this.sHit = 1 / 0),
      (this.lastHit = 0),
      (this.area = t.area || `surface`),
      (this.aabb = {
        minX: this.x0,
        maxX: this.x0 + this.w * 1,
        minZ: this.z0,
        maxZ: this.z0 + this.d * 1,
        minY: this.baseY,
        maxY: this.baseY,
      }));
  }
  key(e, t, n) {
    return (t * 4096 + (n + 1024)) * 4096 + (e + 1024);
  }
  addLayer(e = BRICK_H, t = !1) {
    let n = this.layers[this.layers.length - 1],
      r = n ? n.y0 + n.h : this.baseY;
    return (this.layers.push({ y0: r, h: e, slab: t }), (this.aabb.maxY = r + e), this.layers.length - 1);
  }
  get top() {
    let e = this.layers[this.layers.length - 1];
    return e ? e.y0 + e.h : this.baseY;
  }
  get cx() {
    return this.x0 + (this.w * 1) / 2;
  }
  get cz() {
    return this.z0 + (this.d * 1) / 2;
  }
  place(e, t, n, r, i, a, o, s = 0) {
    let c = [];
    for (let a = 0; a < r; a++)
      for (let r = 0; r < i; r++) {
        let i = this.key(e + a, t, n + r);
        if (this.grid.has(i)) return null;
        c.push([e + a, t, n + r]);
      }
    let l = this.layers[t],
      u = new THREE.Color(o),
      d = 1 + (rng() - 0.5) * 0.07;
    u.multiplyScalar(d);
    let f = {
        t: a,
        slot: -1,
        L: t,
        cells: c,
        alive: !0,
        rot: s,
        color: u,
        b: this,
        x: this.x0 + (e + r / 2) * 1,
        z: this.z0 + (n + i / 2) * 1,
        y: l.y0 + (a === `p2` ? PLATE_H / 2 : BRICK_H / 2),
      },
      p = this.bricks.length;
    this.bricks.push(f);
    for (let e of c) this.grid.set(this.key(e[0], e[1], e[2]), p);
    return (
      (this.aabb.minX = Math.min(this.aabb.minX, this.x0 + e * 1)),
      (this.aabb.maxX = Math.max(this.aabb.maxX, this.x0 + (e + r) * 1)),
      (this.aabb.minZ = Math.min(this.aabb.minZ, this.z0 + n * 1)),
      (this.aabb.maxZ = Math.max(this.aabb.maxZ, this.z0 + (n + i) * 1)),
      f
    );
  }
  ring(e, t, n, r, i, a, o, s = !1) {
    let c = e % 2,
      l = s ? `b1s` : `b1`,
      u = s ? `b2s` : `b2`,
      d = [],
      f = c ? t + 1 : t,
      p = c ? r - 1 : r,
      m = c ? n : n + 1,
      h = c ? i : i - 1;
    (d.push({ axis: `x`, fixed: n, from: f, to: p, side: `n` }),
      d.push({ axis: `x`, fixed: i, from: f, to: p, side: `s` }),
      d.push({ axis: `z`, fixed: t, from: m, to: h, side: `w` }),
      d.push({ axis: `z`, fixed: r, from: m, to: h, side: `e` }));
    for (let t of d) {
      let n = t.from;
      for (; n <= t.to; ) {
        let r = t.axis === `x` ? n : t.fixed,
          i = t.axis === `x` ? t.fixed : n,
          s = o ? o(r, i, t.side, e) : `wall`,
          c = t.axis === `x` ? 0 : Math.PI / 2;
        if (s === `none`) {
          n++;
          continue;
        }
        if (s === `window`) {
          (this.place(r, e, i, 1, 1, `win`, a.trim, c), n++);
          continue;
        }
        if (s === `door`) {
          (this.place(r, e, i, 1, 1, l, a.door ?? 5913122, c), n++);
          continue;
        }
        let d = s === `accent` ? (a.accent ?? a.wall) : a.wall;
        if (n + 1 <= t.to) {
          let a = t.axis === `x` ? n + 1 : t.fixed,
            c = t.axis === `x` ? t.fixed : n + 1;
          if ((o ? o(a, c, t.side, e) : `wall`) === s) {
            (t.axis === `x` ? this.place(r, e, i, 2, 1, u, d, 0) : this.place(r, e, i, 1, 2, u, d, Math.PI / 2),
              (n += 2));
            continue;
          }
        }
        (this.place(r, e, i, 1, 1, l, d, c), n++);
      }
    }
  }
  fill(e, t, n, r, i, a, o = !1) {
    let s = o ? `b1s` : `b1`,
      c = o ? `b2s` : `b2`;
    if (e % 2 == 0)
      for (let o = n; o <= i; o++) {
        let n = t;
        for (; n <= r; )
          n + 1 <= r && this.place(n, e, o, 2, 1, c, a, 0) ? (n += 2) : (this.place(n, e, o, 1, 1, s, a, 0), n++);
      }
    else
      for (let o = t; o <= r; o++) {
        let t = n;
        for (; t <= i; )
          t + 1 <= i && this.place(o, e, t, 1, 2, c, a, Math.PI / 2)
            ? (t += 2)
            : (this.place(o, e, t, 1, 1, s, a, 0), t++);
      }
  }
  roofPlates(e, t, n, r, i, a) {
    let o = this.addLayer(PLATE_H, !0);
    for (let s = e; s <= n; s += 2)
      for (let e = t; e <= r; e += 2) {
        let t = a && ((s + e) / 2) % 2 ? a : i;
        s + 1 <= n && e + 1 <= r ? this.place(s, o, e, 2, 2, `p2`, t, 0) : this.place(s, o, e, 1, 1, `b1s`, t, 0);
      }
    return o;
  }
  gableRoof(e, t) {
    let n = this.d / 2;
    for (let r = 0; r < n; r++) {
      let i = this.addLayer(BRICK_H, !0);
      for (let a = 0; a < this.w; a += 2)
        r < n - 1
          ? (this.place(a, i, r, 2, 1, `sl`, e, Math.PI), this.place(a, i, this.d - 1 - r, 2, 1, `sl`, e, 0))
          : (this.place(a, i, r, 2, 1, `b2s`, t ?? e, 0), this.place(a, i, this.d - 1 - r, 2, 1, `b2s`, t ?? e, 0));
      if (r < n - 1)
        for (let e = r + 1; e < this.d - 1 - r; e += 1)
          (this.place(0, i, e, 1, 1, `b1`, this.def.colors?.wall ?? 16777215, 0),
            this.place(this.w - 1, i, e, 1, 1, `b1`, this.def.colors?.wall ?? 16777215, 0));
    }
  }
  brickAtCell(e, t, n) {
    let r = this.key(e, t, n),
      i = this.grid.get(r);
    return i === void 0 ? -1 : i;
  }
};
var BrickSystem = class extends Emitter {
  constructor(e) {
    (super(),
      (this.ctx = e),
      (this.buildings = []),
      (this.byCollider = new Map()),
      (this.moving = []),
      (this.maxDebris = 110),
      (this.maxCrumble = 800),
      (this.debrisCount = 0),
      (this.time = 0),
      (this.geos = {
        b1: brickGeometry(1, 1, BRICK_H, !1),
        b2: brickGeometry(2, 1, BRICK_H, !1),
        b1s: brickGeometry(1, 1, BRICK_H, !0),
        b2s: brickGeometry(2, 1, BRICK_H, !0),
        p2: plateGeometry(2, 2, !0),
        win: windowBrickGeometry(),
        sl: slopeGeometry(),
      }),
      (this.mat = vertexColorMaterial({ roughness: 0.38 })),
      (this.static = {}),
      (this.movingMesh = {}),
      (this.piles = new Map()));
  }
  setCaps(e, t) {
    for (this.maxDebris = e, this.maxCrumble = t; this.debrisCount > this.maxDebris; ) {
      let e = this.moving.find((e) => e.body);
      if (!e) break;
      this._settle(e);
    }
  }
  create(e) {
    let t = new Building(this, e);
    return (this.buildings.push(t), t);
  }
  finalize() {
    let e = Object.fromEntries(BRICK_KINDS.map((e) => [e, 0]));
    for (let t of this.buildings) for (let n of t.bricks) e[n.t]++;
    for (let t of BRICK_KINDS) {
      let n = Math.max(1, e[t]),
        r = new THREE.InstancedMesh(this.geos[t], this.mat, n);
      ((r.castShadow = !0),
        (r.receiveShadow = !0),
        (r.frustumCulled = !1),
        r.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        (r.count = e[t]),
        (r.name = `bricks_` + t),
        r.setColorAt(0, new THREE.Color(1, 1, 1)),
        this.ctx.scene.add(r),
        (this.static[t] = { mesh: r, used: 0 }));
    }
    for (let e of this.buildings) {
      for (let t of e.bricks) {
        let e = this.static[t.t];
        ((t.slot = e.used++),
          this._writeStatic(t, t.x, t.y, t.z, _bQuat.setFromAxisAngle(_bUp, t.rot)),
          e.mesh.setColorAt(t.slot, t.color));
      }
      this._makeCollider(e);
    }
    for (let e of BRICK_KINDS)
      ((this.static[e].mesh.instanceMatrix.needsUpdate = !0),
        this.static[e].mesh.instanceColor && (this.static[e].mesh.instanceColor.needsUpdate = !0));
    for (let e of MOVING_KINDS) {
      let t = new THREE.InstancedMesh(this.geos[e], this.mat, 2600);
      ((t.castShadow = !0),
        (t.receiveShadow = !0),
        (t.frustumCulled = !1),
        t.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        t.setColorAt(0, new THREE.Color(1, 1, 1)),
        t.instanceColor.setUsage(THREE.DynamicDrawUsage),
        (t.count = 0),
        this.ctx.scene.add(t),
        (this.movingMesh[e] = t));
    }
    this.totalBricks = Object.values(e).reduce((e, t) => e + t, 0);
  }
  _makeCollider(e) {
    let t = e.aabb,
      n = Array(e.layers.length).fill(0);
    for (let t of e.bricks) n[t.L] += t.cells.length;
    let r = Math.max(...n),
      i = e.layers.length - 1;
    for (; i > 0 && n[i] < r * 0.25; ) i--;
    let a = e.layers[i].y0 + e.layers[i].h;
    e.colTop = a;
    let o = (t.maxX - t.minX) / 2,
      s = (t.maxZ - t.minZ) / 2,
      c = (a - t.minY) / 2,
      { col: l, body: u } = this.ctx.physics.fixedBox(
        (t.minX + t.maxX) / 2,
        (t.minY + a) / 2,
        (t.minZ + t.maxZ) / 2,
        o,
        c,
        s,
        { member: GROUP.BUILDING, filter: 65535, friction: 0.25, restitution: 0.25, owner: { type: `building`, b: e } },
      );
    ((e.body = u), (e.collider = l), this.byCollider.set(l.handle, e));
  }
  _writeStatic(e, t, n, r, i) {
    (_bPos.set(t, n, r), _bMat.compose(_bPos, i, _bScale), this.static[e.t].mesh.setMatrixAt(e.slot, _bMat));
  }
  _hideStatic(e) {
    (this.static[e.t].mesh.setMatrixAt(e.slot, _bHidden), (this.static[e.t].mesh.instanceMatrix.needsUpdate = !0));
  }
  buildingOfCollider(e) {
    return this.byCollider.get(e);
  }
  reset() {
    for (let e of this.moving) e.body && this.ctx.physics.removeBody(e.body);
    ((this.moving.length = 0), (this.debrisCount = 0), this.piles.clear());
    for (let e of this.buildings)
      (e.grid.clear(),
        e.bricks.forEach((t, n) => {
          t.alive = !0;
          for (let r of t.cells) e.grid.set(e.key(r[0], r[1], r[2]), n);
          this._writeStatic(t, t.x, t.y, t.z, _bQuat.setFromAxisAngle(_bUp, t.rot));
        }),
        (e.hp = e.maxHp),
        (e.collapsed = !1),
        (e.lastHit = 0),
        e.collider || this._makeCollider(e));
    for (let e of BRICK_KINDS) this.static[e].mesh.instanceMatrix.needsUpdate = !0;
    for (let e of MOVING_KINDS) this.movingMesh[e].count = 0;
  }
  damage(e, t, n, r, i = null, a = null) {
    if (!e || e.collapsed) return { applied: 0 };
    let o = t;
    if (
      (e.filter && !e.filter.includes(r) && (o = 0),
      e.reinforced && o > 0 && (o *= r === `stomp` ? 1 : r === `explosion` ? 0.8 : r === `missile` ? 0.5 : 0.12),
      o <= 0.5)
    )
      return (this.emit(`nohit`, e, n, r), { applied: 0 });
    ((e.hp -= o), (e.lastHit = this.time));
    let s = clamp(Math.ceil(o / 5.5), 1, 26),
      c = clamp(1.1 + o / 45, 1.2, 4.5),
      l = [];
    for (let t = 0; t < e.bricks.length; t++) {
      let r = e.bricks[t];
      if (!r.alive) continue;
      let i = r.x - n.x,
        a = r.y - n.y,
        o = r.z - n.z,
        s = i * i + a * a * 0.7 + o * o;
      s < c * c * 1.8 && l.push([s + rng() * 1.5, t]);
    }
    l.sort((e, t) => e[0] - t[0]);
    let u = i ? new THREE.Vector3(i.x, 0, i.z).normalize() : new THREE.Vector3(e.cx - n.x, 0, e.cz - n.z).normalize(),
      d = clamp(o / 7, 3, 13),
      f = !1;
    for (let t = 0; t < Math.min(s, l.length); t++) {
      let i = e.bricks[l[t][1]];
      i.t === `win` && (f = !0);
      let a = new THREE.Vector3(
        u.x * d + (rng() - 0.5) * 5,
        2 + rng() * 5 + (r === `stomp` ? 3 : 0),
        u.z * d + (rng() - 0.5) * 5,
      );
      if (r === `stomp` || r === `explosion`) {
        let e = i.x - n.x,
          t = i.z - n.z,
          r = Math.hypot(e, t) || 1;
        ((a.x = (e / r) * d * 0.9 + (rng() - 0.5) * 3), (a.z = (t / r) * d * 0.9 + (rng() - 0.5) * 3));
      }
      this._detach(i, a, t < 10 ? `debris` : `crumble`);
    }
    return (
      this._connectivity(e, u),
      this.emit(`hit`, e, o, n, r, f, a),
      e.hp <= 0 ? (this.collapse(e, n, r, a), { applied: o, collapsed: !0 }) : { applied: o, collapsed: !1 }
    );
  }
  _detach(e, t, n) {
    if (!e.alive) return;
    e.alive = !1;
    for (let t of e.cells) e.b.grid.delete(e.b.key(t[0], t[1], t[2]));
    this._hideStatic(e);
    let r = new THREE.Quaternion().setFromAxisAngle(_bUp, e.rot),
      i = new THREE.Vector3(e.x, e.y, e.z);
    n === `debris` && this.debrisCount < this.maxDebris && this.moving.length < 2500
      ? this._spawnDebris(e, i, r, t)
      : this.moving.length < this.maxCrumble
        ? this._spawnCrumble(e, i, r, t)
        : (this._placeRubble(e, i.x + (rng() - 0.5) * 2, i.z + (rng() - 0.5) * 2, e.b.baseY),
          rng() < 0.3 && this.ctx.fx && this.ctx.fx.dust(i.x, e.b.baseY + 0.5, i.z, 1, 0.8));
  }
  _spawnDebris(e, t, n, r) {
    let i = DEBRIS_KIND[e.t],
      a = BRICK_HALF[e.t],
      o = this.ctx.physics,
      s = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(t.x, t.y, t.z)
        .setRotation({ x: n.x, y: n.y, z: n.z, w: n.w })
        .setLinvel(r.x, r.y, r.z)
        .setAngvel({ x: (rng() - 0.5) * 8, y: (rng() - 0.5) * 6, z: (rng() - 0.5) * 8 })
        .setLinearDamping(0.05)
        .setAngularDamping(0.4)
        .setCanSleep(!0),
      c = o.world.createRigidBody(s),
      l = RAPIER.ColliderDesc.cuboid(a[0] * 0.95, a[1] * 0.95, a[2] * 0.95)
        .setDensity(0.35)
        .setFriction(0.8)
        .setRestitution(0.15)
        .setCollisionGroups(
          groups(GROUP.DEBRIS, GROUP.STATIC | GROUP.VEHICLE | GROUP.DEBRIS | GROUP.PROP | GROUP.CARRIER),
        ),
      u = o.world.createCollider(l, c);
    o.setOwner(u, { type: `debris` });
    let d = {
      kind: `debris`,
      br: e,
      mt: i,
      body: c,
      age: 0,
      still: 0,
      color: e.color,
      p0: t.clone(),
      p1: t.clone(),
      q0: n.clone(),
      q1: n.clone(),
    };
    return (this.debrisCount++, this.moving.push(d), d);
  }
  _spawnCrumble(e, t, n, r, i = 0) {
    let a = {
      kind: `crumble`,
      br: e,
      mt: DEBRIS_KIND[e.t],
      age: -i,
      color: e.color,
      p0: t.clone(),
      p1: t.clone(),
      q0: n.clone(),
      q1: n.clone(),
      v: r.clone(),
      w: new THREE.Vector3((rng() - 0.5) * 5, (rng() - 0.5) * 3, (rng() - 0.5) * 5),
      groundY: e.b.baseY,
      bounced: !1,
    };
    return (this.moving.push(a), a);
  }
  _connectivity(e, t) {
    let n = new Uint8Array(e.bricks.length),
      r = [];
    for (let t = 0; t < e.bricks.length; t++) {
      let i = e.bricks[t];
      i.alive && i.L === 0 && ((n[t] = 1), r.push(t));
    }
    for (; r.length; ) {
      let t = r.pop(),
        i = e.bricks[t],
        a = (t, i, a) => {
          if (i < 0 || i >= e.layers.length) return;
          let o = e.brickAtCell(t, i, a);
          o >= 0 && !n[o] && e.bricks[o].alive && ((n[o] = 1), r.push(o));
        };
      for (let t of i.cells)
        (a(t[0], t[1] + 1, t[2]),
          a(t[0], t[1] - 1, t[2]),
          e.layers[i.L].slab &&
            (a(t[0] + 1, t[1], t[2]), a(t[0] - 1, t[1], t[2]), a(t[0], t[1], t[2] + 1), a(t[0], t[1], t[2] - 1)));
    }
    let i = 0;
    for (let r = 0; r < e.bricks.length; r++) {
      let a = e.bricks[r];
      if (a.alive && !n[r]) {
        i++;
        let e = new THREE.Vector3(t.x * 1.5 + (rng() - 0.5) * 2, -0.5 + rng(), t.z * 1.5 + (rng() - 0.5) * 2);
        this._detach(a, e, i < 6 ? `debris` : `crumble`);
      }
    }
    i > 8 && this.emit(`chunk`, e, i);
  }
  collapse(e, t, n, r) {
    if (e.collapsed) return;
    ((e.collapsed = !0),
      (e.hp = 0),
      e.collider &&
        (this.byCollider.delete(e.collider.handle),
        this.ctx.physics.removeBody(e.body),
        (e.collider = null),
        (e.body = null)));
    let i = e.cx,
      a = e.cz,
      o = Math.min(18, this.maxDebris - this.debrisCount),
      s = e.bricks.filter((e) => e.alive);
    t && s.sort((e, n) => (e.x - t.x) ** 2 + (e.z - t.z) ** 2 - ((n.x - t.x) ** 2 + (n.z - t.z) ** 2));
    for (let n of s) {
      n.alive = !1;
      for (let t of n.cells) e.grid.delete(e.key(t[0], t[1], t[2]));
      this._hideStatic(n);
      let r = new THREE.Quaternion().setFromAxisAngle(_bUp, n.rot),
        s = new THREE.Vector3(n.x, n.y, n.z),
        c = n.x - i,
        l = n.z - a,
        u = Math.hypot(c, l) || 1;
      if (o > 0 && t) {
        o--;
        let e = n.x - t.x,
          i = n.z - t.z,
          a = Math.hypot(e, i) || 1;
        this._spawnDebris(
          n,
          s,
          r,
          new THREE.Vector3((e / a) * 7 + (rng() - 0.5) * 3, 3 + rng() * 5, (i / a) * 7 + (rng() - 0.5) * 3),
        );
      } else if (this.moving.length < this.maxCrumble) {
        let e = new THREE.Vector3((c / u) * (0.6 + rng() * 1.6), -rng() * 1.5, (l / u) * (0.6 + rng() * 1.6));
        this._spawnCrumble(n, s, r, e, rng() * 0.18);
      } else this._placeRubble(n, n.x + (c / u) * rng() * 2, n.z + (l / u) * rng() * 2, e.baseY);
    }
    this.emit(`collapse`, e, t, n, r);
  }
  _pileKey(e, t) {
    return (Math.floor(e) + 2048) * 8192 + (Math.floor(t) + 2048);
  }
  _placeRubble(e, t, n, r, i = null) {
    let a = this._pileKey(t, n) + r * 1e8,
      o = this.piles.get(a) || 0,
      s = BRICK_HALF[e.t][1],
      c = r + o + s * 0.8;
    this.piles.set(a, Math.min(o + s * 1.1, 4.5));
    let l =
      i ||
      new THREE.Quaternion().setFromEuler(_bEuler.set((rng() - 0.5) * 0.7, rng() * Math.PI * 2, (rng() - 0.5) * 0.7));
    (this._writeStatic(e, t, c, n, l), (this.static[e.t].mesh.instanceMatrix.needsUpdate = !0));
  }
  pileHeight(e, t, n) {
    return this.piles.get(this._pileKey(e, t) + n * 1e8) || 0;
  }
  _settle(e) {
    let t = this.moving.indexOf(e);
    (t >= 0 && this.moving.splice(t, 1),
      e.body
        ? (this.ctx.physics.removeBody(e.body),
          (e.body = null),
          this.debrisCount--,
          e.p1.y > -40 &&
            (this._writeStatic(e.br, e.p1.x, e.p1.y, e.p1.z, e.q1),
            (this.static[e.br.t].mesh.instanceMatrix.needsUpdate = !0)))
        : this._placeRubble(e.br, e.p1.x, e.p1.z, e.groundY, e.q1));
  }
  step(e) {
    this.time += e;
    let t = 0;
    for (let n = this.moving.length - 1; n >= 0; n--) {
      let r = this.moving[n];
      if (((r.age += e), r.kind === `debris`)) {
        (r.p0.copy(r.p1), r.q0.copy(r.q1));
        let t = r.body.translation(),
          n = r.body.rotation();
        (r.p1.set(t.x, t.y, t.z), r.q1.set(n.x, n.y, n.z, n.w));
        let i = r.body.linvel();
        (i.x * i.x + i.y * i.y + i.z * i.z < 0.3 ? (r.still += e) : (r.still = 0),
          (r.still > 0.6 || r.age > 7 || t.y < -60 || r.body.isSleeping()) && this._settle(r));
      } else {
        if (r.age < 0) continue;
        (r.p0.copy(r.p1),
          r.q0.copy(r.q1),
          (r.v.y += -22 * e),
          r.p1.addScaledVector(r.v, e),
          _bQuat.setFromEuler(_bEuler.set(r.w.x * e, r.w.y * e, r.w.z * e)),
          r.q1.multiply(_bQuat));
        let n = r.groundY + this.pileHeight(r.p1.x, r.p1.z, r.groundY) + BRICK_HALF[r.br.t][1] * 0.8;
        (r.p1.y <= n &&
          (!r.bounced && r.v.y < -6
            ? ((r.bounced = !0),
              (r.p1.y = n),
              (r.v.y = -r.v.y * 0.22),
              (r.v.x *= 0.5),
              (r.v.z *= 0.5),
              r.w.multiplyScalar(0.4),
              t++)
            : ((r.p1.y = n), this._settle(r), t++)),
          r.age > 6 && this._settle(r));
      }
    }
    t > 0 && this.emit(`clatter`, t);
  }
  render(e) {
    let t = {};
    for (let e of MOVING_KINDS) t[e] = 0;
    for (let n of this.moving) {
      n.age < 0 && n.kind === `crumble`
        ? (_bPos.copy(n.p1), _bQuat.copy(n.q1))
        : (_bPos.lerpVectors(n.p0, n.p1, e), _bQuat.slerpQuaternions(n.q0, n.q1, e));
      let r = this.movingMesh[n.mt],
        i = t[n.mt]++;
      i >= r.instanceMatrix.count ||
        (_bMat.compose(_bPos, _bQuat, _bScale), r.setMatrixAt(i, _bMat), r.setColorAt(i, n.color));
    }
    for (let e of MOVING_KINDS) {
      let n = this.movingMesh[e];
      ((n.count = Math.min(t[e], n.instanceMatrix.count)),
        n.count > 0 && ((n.instanceMatrix.needsUpdate = !0), (n.instanceColor.needsUpdate = !0)));
    }
  }
  tally() {
    let e = 0,
      t = 0;
    for (let n of this.buildings) n.counts && (e++, n.collapsed && t++);
    return { total: e, done: t };
  }
  setAreaVisibility(e) {}
};
var MAP_BOUNDS = { minX: -300, maxX: 262, minZ: -208, maxZ: 200 };
var CARRIER_ROUTE = [
  { x: -300, z: 80 },
  { x: -40, z: 80 },
  { x: -40, z: -20 },
  { x: 120, z: -20 },
  { x: 190, z: -90 },
  { x: 232, z: -90 },
];
var ROADS = [
  {
    pts: [
      { x: -40, z: 80 },
      { x: 150, z: 80 },
      { x: 150, z: -20 },
    ],
    w: 11,
  },
  {
    pts: [
      { x: -108, z: 80 },
      { x: -108, z: 196 },
    ],
    w: 10,
  },
  {
    pts: [
      { x: -108, z: 170 },
      { x: 140, z: 170 },
    ],
    w: 10,
  },
  {
    pts: [
      { x: -40, z: -20 },
      { x: -40, z: -122 },
    ],
    w: 10,
  },
  {
    pts: [
      { x: 150, z: 80 },
      { x: 250, z: 80 },
    ],
    w: 10,
  },
];
var LOTS = [
  { r: [-236, 96, -170, 132], c: COLORS.concrete },
  { r: [12, -132, 128, -68], c: 12104616 },
  { r: [210, -118, 262, -62], c: COLORS.concrete },
  { r: [-120, -205, -2, -128], c: 9409691 },
  { r: [30, 125, 110, 158], c: 7106679 },
  { r: [150, 12, 205, 66], c: 8100412 },
];
var BUILDINGS = [
  {
    id: `B1`,
    name: `Corner Deli`,
    style: `shop`,
    x: -150,
    z: 80,
    w: 10,
    d: 8,
    h: 3,
    hp: 85,
    front: `n`,
    sign: !0,
    colors: { wall: COLORS.tan, accent: COLORS.red, roof: COLORS.darkGrey },
  },
  {
    id: `B2`,
    name: `Suds Laundromat`,
    style: `shop`,
    x: -95,
    z: 80,
    w: 8,
    d: 10,
    h: 3,
    hp: 90,
    front: `w`,
    sign: !0,
    colors: { wall: COLORS.lightGrey, accent: COLORS.blue, roof: COLORS.grey },
  },
  {
    id: `B3`,
    name: `Mint Apartments`,
    style: `apartment`,
    x: -40,
    z: 44,
    w: 12,
    d: 10,
    h: 6,
    hp: 140,
    front: `e`,
    colors: { wall: COLORS.brickRed },
  },
  {
    id: `B4`,
    name: `Post Office`,
    style: `house`,
    x: -40,
    z: 6,
    w: 10,
    d: 10,
    h: 4,
    hp: 105,
    front: `e`,
    band: !0,
    colors: { wall: COLORS.white, roof: COLORS.blue, accent: COLORS.red },
  },
  {
    id: `B5`,
    name: `Nuts & Bolts Hardware`,
    style: `warehouse`,
    x: 30,
    z: -20,
    w: 10,
    d: 8,
    h: 4,
    hp: 120,
    front: `s`,
    colors: { wall: COLORS.orange, accent: COLORS.darkGrey, roof: COLORS.lightGrey },
  },
  { id: `B6`, name: `Bank of Argent`, style: `bank`, x: 80, z: -20, w: 10, d: 10, h: 5, hp: 155, front: `s` },
  { id: `B7`, name: `Parking Garage`, style: `garage`, x: 160, z: -60, w: 12, d: 12, floors: 3, hp: 130 },
  { id: `O1`, name: `Gas Station`, style: `gas`, x: -240, z: 52, w: 14, d: 10, hp: 80 },
  {
    id: `O2`,
    name: `Townhouse`,
    style: `house`,
    x: -200,
    z: 58,
    w: 10,
    d: 8,
    h: 4,
    hp: 100,
    front: `s`,
    colors: { wall: COLORS.yellow, roof: COLORS.brickRed },
  },
  {
    id: `O3`,
    name: `Townhouse`,
    style: `house`,
    x: -179,
    z: 58,
    w: 8,
    d: 8,
    h: 4,
    hp: 95,
    front: `s`,
    colors: { wall: COLORS.teal, roof: COLORS.darkGrey },
  },
  { id: `O4`, name: `Newsstand`, style: `hut`, x: -120, z: 62, w: 4, d: 4, hp: 40 },
  {
    id: `O5`,
    name: `Route Diner`,
    style: `shop`,
    x: -150,
    z: 104,
    w: 12,
    d: 8,
    h: 3,
    hp: 110,
    front: `n`,
    sign: !0,
    colors: { wall: COLORS.white, accent: COLORS.teal, roof: COLORS.red },
  },
  {
    id: `O6`,
    name: `Townhouse`,
    style: `house`,
    x: -70,
    z: 104,
    w: 8,
    d: 8,
    h: 4,
    hp: 95,
    front: `n`,
    colors: { wall: COLORS.purple, roof: COLORS.darkGrey },
  },
  {
    id: `O7`,
    name: `Mint Street Warehouse`,
    style: `warehouse`,
    x: -84,
    z: 22,
    w: 16,
    d: 14,
    h: 5,
    hp: 190,
    front: `e`,
    survivors: 2,
  },
  {
    id: `O8`,
    name: `Clock Shop`,
    style: `shop`,
    x: -8,
    z: 50,
    w: 8,
    d: 8,
    h: 3,
    hp: 95,
    front: `w`,
    colors: { wall: COLORS.green, accent: COLORS.yellow },
  },
  {
    id: `O9`,
    name: `Argent Offices`,
    style: `apartment`,
    x: -2,
    z: -52,
    w: 10,
    d: 10,
    h: 8,
    hp: 170,
    front: `s`,
    survivors: 1,
    colors: { wall: COLORS.blue, accent: COLORS.white },
  },
  {
    id: `O10`,
    name: `Bullion Cafe`,
    style: `shop`,
    x: 50,
    z: 6,
    w: 8,
    d: 8,
    h: 3,
    hp: 90,
    front: `n`,
    sign: !0,
    colors: { wall: COLORS.yellow, accent: COLORS.brown },
  },
  {
    id: `O11`,
    name: `Rialto Theater`,
    style: `bank`,
    x: 104,
    z: 10,
    w: 12,
    d: 10,
    h: 5,
    hp: 170,
    front: `n`,
    survivors: 1,
    colors: { wall: COLORS.red, accent: COLORS.yellow },
  },
  {
    id: `T1`,
    name: `Argent Tower West`,
    style: `tower`,
    x: 35,
    z: -96,
    w: 8,
    d: 8,
    h: 18,
    hp: 460,
    reinforced: !0,
    survivors: 1,
  },
  {
    id: `T2`,
    name: `Argent Tower Central`,
    style: `tower`,
    x: 70,
    z: -114,
    w: 8,
    d: 8,
    h: 20,
    hp: 480,
    reinforced: !0,
    survivors: 1,
  },
  {
    id: `T3`,
    name: `Argent Tower East`,
    style: `tower`,
    x: 105,
    z: -94,
    w: 8,
    d: 8,
    h: 18,
    hp: 460,
    reinforced: !0,
    survivors: 1,
  },
  { id: `O12`, name: `Red Barn`, style: `barn`, x: 205, z: 100, w: 12, d: 10, h: 5, hp: 120, front: `w`, survivors: 1 },
  { id: `O13`, name: `Grain Silo`, style: `silo`, x: 226, z: 96, w: 8, d: 8, h: 10, hp: 110 },
  { id: `O14`, name: `Water Tower`, style: `waterTower`, x: 232, z: 140, w: 6, d: 6, hp: 90 },
  {
    id: `O15`,
    name: `Farmhouse`,
    style: `house`,
    x: 180,
    z: 140,
    w: 10,
    d: 8,
    h: 4,
    hp: 100,
    front: `w`,
    colors: { wall: COLORS.sand, roof: COLORS.green },
  },
  {
    id: `O16`,
    name: `Starlite Motel`,
    style: `apartment`,
    x: -10,
    z: 150,
    w: 16,
    d: 8,
    h: 4,
    hp: 160,
    front: `n`,
    survivors: 1,
    colors: { wall: COLORS.teal, accent: COLORS.yellow },
  },
  { id: `O17`, name: `Billboard`, style: `billboard`, x: -60, z: 134, w: 10, d: 1, hp: 60 },
  {
    id: `O18`,
    name: `Guard Hut`,
    style: `hut`,
    x: 196,
    z: -130,
    w: 4,
    d: 4,
    hp: 45,
    colors: { wall: COLORS.white, roof: COLORS.red },
  },
  {
    id: `O19`,
    name: `Compound Shed`,
    style: `hut`,
    x: -60,
    z: -134,
    w: 6,
    d: 4,
    hp: 60,
    colors: { wall: COLORS.brown, roof: COLORS.green },
  },
];
var DOORS = [
  {
    id: `D1`,
    name: `Sealed Blast Door`,
    style: `door`,
    kind: `door`,
    x: -110,
    z: 140,
    w: 1,
    d: 8,
    h: 5,
    axis: `z`,
    y: -12,
    hp: 60,
    filter: [`explosion`],
    area: `underground`,
    counts: !1,
  },
  {
    id: `D2`,
    name: `Hangar Shutter`,
    style: `door`,
    kind: `door`,
    x: 27,
    z: -185,
    w: 1,
    d: 8,
    h: 5,
    axis: `z`,
    y: 6,
    hp: 70,
    filter: [`missile`, `explosion`, `stomp`],
    counts: !1,
    colors: { wall: COLORS.darkGrey, accent: COLORS.yellow },
  },
];
var HQ = { truck: { x: -205, z: 118, yaw: Math.PI / 2 }, spawn: { x: -186, z: 106, yaw: Math.PI / 2 } };
var COMM_POINTS = [
  { id: `CP1`, x: -222, y: 0, z: 104 },
  { id: `CP2`, x: 152.5, y: 26, z: -152.5 },
];
var PILLAR = { x: 150, z: -150, size: 10, h: 26 };
var PLATEAU = { minX: 0, maxX: 60, minZ: -205, maxZ: -135, h: 6 };
var PLATEAU_RAMP = { x0: -32, x1: 0, z: -142, w: 8 };
var HANGAR = { minX: 27, maxX: 50, minZ: -196, maxZ: -174 };
var COMPOUND = { minX: -120, maxX: 0, minZ: -205, maxZ: -128 };
var MAZE = { minX: -80, maxX: -25, minZ: -200, maxZ: -150, cols: 5, rows: 4, seed: 7 };
var DEPOT = { minX: 214, maxX: 262, minZ: -116, maxZ: -64 };
var STAIRWELL = { x0: -176, x1: -152, z0: 138, z1: 142 };
var SERVICE_CHAMBER = { minX: -152, maxX: -110, minZ: 128, maxZ: 152 };
var VEHICLE_RAMP = { x: -130, z0: 152, z1: 188, w: 7 };
var PLATFORM_A = { minX: -110, maxX: -100, minZ: 128, maxZ: 152 };
var SUBWAY_TUNNEL = { minX: -100, maxX: -90, minZ: -172, maxZ: 152 };
var PLATFORM_B = { minX: -110, maxX: -100, minZ: -172, maxZ: -150 };
var STATION_EXIT = { x0: -104, x1: -100, z0: -172, z1: -196 };
var SUBWAY = { x: -95, zA: 142, zB: -160 };
var CONCRETE_BLOCK = { x: -178.5, z: 140, w: 3, h: 3, d: 5.4 };
var SPAWNS = {
  backlash: { x: -186, y: 0, z: 106, yaw: Math.PI / 2 },
  dozer: { x: -146, y: -12, z: 147, yaw: Math.PI / 2 },
  police: { x: -94, y: 0, z: -186, yaw: Math.PI / 2 },
  ballista: { x: -52, y: 0, z: -140, yaw: Math.PI / 2 },
  jbomb: { x: 40, y: 6, z: -185, yaw: -Math.PI / 2 },
  tnt: { x: -133, y: -12, z: 140 },
};
var AMMO_CRATES = [
  { x: -46, y: 0, z: -134 },
  { x: -40, y: 0, z: -146 },
  { x: 12, y: 6, z: -150 },
  { x: 150, y: 0, z: -110 },
  { x: -20, y: 0, z: -100 },
];
function rduLayout() {
  let e = [];
  for (let t = 0; t < 14; t++) e.push({ x: -232 + t * 10, y: 0, z: 90 });
  for (let t = 0; t < 8; t++) e.push({ x: -30, y: 0, z: 70 - t * 10 });
  for (let t = 0; t < 8; t++) e.push({ x: -22 + t * 18, y: 0, z: -29 });
  for (let t = 0; t < 10; t++) {
    let n = (t / 9) * Math.PI * 0.9 + Math.PI * 0.05;
    e.push({ x: 70 + Math.cos(n) * 42, y: 0, z: -95 + Math.sin(n) * 22 });
  }
  for (let t = 0; t < 4; t++) for (let n = 0; n < 5; n++) e.push({ x: 160 + t * 12, y: 0, z: 18 + n * 11 });
  return (
    e.push(
      { x: -145, y: -12, z: 132 },
      { x: -118, y: -12, z: 132 },
      { x: -145, y: -12, z: 148 },
      { x: -118, y: -12, z: 148 },
    ),
    e.push(
      { x: -105, y: -12, z: 132 },
      { x: -105, y: -12, z: 148 },
      { x: -105, y: -12, z: -155 },
      { x: -105, y: -12, z: -168 },
    ),
    e.push({ x: 8, y: 6, z: -150 }, { x: 16, y: 6, z: -160 }, { x: 16, y: 6, z: -170 }, { x: 8, y: 6, z: -180 }),
    e
  );
}
var PARKED_CARS = [
  { x: 40, z: 132, yaw: 0, c: COLORS.red },
  { x: 48, z: 132, yaw: 0, c: COLORS.blue },
  { x: 64, z: 132, yaw: 0, c: COLORS.yellow },
  { x: 80, z: 151, yaw: Math.PI, c: COLORS.green },
  { x: 96, z: 151, yaw: Math.PI, c: COLORS.white },
  { x: -60, z: 92, yaw: Math.PI / 2, c: COLORS.teal },
  { x: 10, z: 68, yaw: 0, c: COLORS.orange },
  { x: 130, z: 20, yaw: Math.PI / 2, c: COLORS.purple },
];
var KICKER_BUMPS = [
  { x: -118, z: 72, yaw: Math.PI / 2 },
  { x: 58, z: -12, yaw: Math.PI / 2 },
];
function roundRoute(e, t) {
  let n = [];
  n.push({ ...e[0] });
  for (let r = 1; r < e.length - 1; r++) {
    let i = e[r - 1],
      a = e[r],
      o = e[r + 1],
      s = a.x - i.x,
      c = a.z - i.z,
      l = Math.hypot(s, c);
    ((s /= l), (c /= l));
    let u = o.x - a.x,
      d = o.z - a.z,
      f = Math.hypot(u, d);
    ((u /= f), (d /= f));
    let p = Math.max(-1, Math.min(1, s * u + c * d)),
      m = t * Math.tan(Math.acos(p) / 2);
    m = Math.min(m, l * 0.45, f * 0.45);
    let h = { x: a.x - s * m, z: a.z - c * m },
      g = { x: a.x + u * m, z: a.z + d * m };
    n.push(h);
    for (let e = 1; e < 16; e++) {
      let t = e / 16,
        r = 1 - t;
      n.push({ x: r * r * h.x + 2 * r * t * a.x + t * t * g.x, z: r * r * h.z + 2 * r * t * a.z + t * t * g.z });
    }
    n.push(g);
  }
  n.push({ ...e[e.length - 1] });
  let r = [0];
  for (let e = 1; e < n.length; e++) r.push(r[e - 1] + Math.hypot(n[e].x - n[e - 1].x, n[e].z - n[e - 1].z));
  let i = r[r.length - 1],
    a = 0.5,
    o = [],
    s = 0;
  for (let e = 0; e <= i + 1e-6; e += a) {
    for (; s < n.length - 2 && r[s + 1] < e; ) s++;
    let t = r[s + 1] - r[s] || 1,
      i = (e - r[s]) / t;
    o.push({ x: n[s].x + (n[s + 1].x - n[s].x) * i, z: n[s].z + (n[s + 1].z - n[s].z) * i, s: e });
  }
  for (let e = 0; e < o.length; e++) {
    let t = o[Math.max(0, e - 2)],
      n = o[Math.min(o.length - 1, e + 2)];
    o[e].yaw = Math.atan2(n.x - t.x, n.z - t.z);
  }
  return {
    pts: o,
    length: i,
    step: a,
    sample(e) {
      e = Math.max(0, Math.min(i, e));
      let t = e / a,
        n = Math.min(o.length - 2, Math.floor(t)),
        r = t - n,
        s = o[n],
        c = o[n + 1],
        l = c.yaw - s.yaw;
      for (; l > Math.PI; ) l -= Math.PI * 2;
      for (; l < -Math.PI; ) l += Math.PI * 2;
      return { x: s.x + (c.x - s.x) * r, z: s.z + (c.z - s.z) * r, yaw: s.yaw + l * r };
    },
  };
}
var evenUp = (e) => (e % 2 ? e + 1 : e);
function frontOf(e) {
  return e.front || `s`;
}
function buildBuilding(e, t) {
  t.style !== `door` && t.style !== `billboard` && ((t.w = evenUp(t.w)), (t.d = evenUp(t.d)));
  let n = e.create(t),
    r = BUILDING_STYLES[t.style];
  if (!r) throw Error(`unknown style ` + t.style);
  return (r(n, t), n);
}
var BUILDING_STYLES = {
  house(e, t) {
    let n = { wall: COLORS.white, trim: COLORS.white, roof: COLORS.red, door: COLORS.brown, ...t.colors },
      r = t.h ?? 4,
      i = frontOf(t),
      a = Math.floor(e.w / 2),
      o = Math.floor(e.d / 2);
    for (let s = 0; s < r; s++)
      (e.addLayer(),
        e.ring(s, 0, 0, e.w - 1, e.d - 1, n, (n, c, l) =>
          (n === 0 || n === e.w - 1) && (c === 0 || c === e.d - 1)
            ? `wall`
            : l === i && s <= 1 && (l === `s` || l === `n` ? n === a : c === o)
              ? `door`
              : (s === 1 || (s === 2 && r > 3)) && (l === `n` || l === `s` ? n % 3 == 1 : c % 3 == 1)
                ? `window`
                : s === r - 1 && t.band
                  ? `accent`
                  : `wall`,
        ));
    e.gableRoof(n.roof, n.ridge);
  },
  shop(e, t) {
    let n = {
        wall: COLORS.tan,
        trim: COLORS.white,
        roof: COLORS.darkGrey,
        accent: COLORS.red,
        door: COLORS.brown,
        ...t.colors,
      },
      r = t.h ?? 3,
      i = frontOf(t);
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, a, o) => {
          if ((n === 0 || n === e.w - 1) && (a === 0 || a === e.d - 1)) return `wall`;
          if (t === r - 1) return `accent`;
          if (o === i) {
            let r = o === `n` || o === `s` ? n : a,
              i = o === `n` || o === `s` ? e.w : e.d;
            if (t <= 1 && r === Math.floor(i / 2)) return `door`;
            if (t <= 1) return `window`;
          } else if (t === 1 && (o === `n` || o === `s` ? n % 3 == 1 : a % 3 == 1)) return `window`;
          return `wall`;
        }));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
    let a = e.addLayer();
    if ((e.fill(a, 1, 1, 2, 2, COLORS.grey, !0), t.sign))
      for (let t = 2; t < e.w - 2; t += 2)
        e.place(t, a, i === `n` ? 0 : e.d - 1, 2, 1, `b2s`, t % 4 ? n.accent : COLORS.white, 0);
  },
  apartment(e, t) {
    let n = {
        wall: COLORS.brickRed,
        trim: COLORS.white,
        roof: COLORS.darkGrey,
        accent: COLORS.white,
        door: COLORS.brown,
        ...t.colors,
      },
      r = t.h ?? 7,
      i = frontOf(t);
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, r, a) => {
          if ((n === 0 || n === e.w - 1) && (r === 0 || r === e.d - 1)) return t % 3 == 2 ? `accent` : `wall`;
          let o = a === `n` || a === `s` ? n : r,
            s = a === `n` || a === `s` ? e.w : e.d;
          return a === i && t <= 1 && o === Math.floor(s / 2)
            ? `door`
            : t % 3 == 2
              ? `accent`
              : t % 3 == 1 && o % 2 == 1 && o > 0 && o < s - 1
                ? `window`
                : `wall`;
        }));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
    let a = e.addLayer();
    (e.ring(a, 0, 0, e.w - 1, e.d - 1, { wall: n.accent }, null, !0), e.fill(a, 2, 2, 3, 3, COLORS.lightGrey, !0));
  },
  warehouse(e, t) {
    let n = {
        wall: COLORS.steel,
        trim: COLORS.white,
        roof: COLORS.lightGrey,
        accent: COLORS.yellow,
        door: COLORS.darkGrey,
        ...t.colors,
      },
      r = t.h ?? 5,
      i = frontOf(t);
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, a, o) => {
          let s = o === `n` || o === `s` ? n : a,
            c = o === `n` || o === `s` ? e.w : e.d;
          return (n === 0 || n === e.w - 1) && (a === 0 || a === e.d - 1)
            ? `accent`
            : o === i && t <= 2 && Math.abs(s - c / 2 + 0.5) < 2.2
              ? `door`
              : t === r - 2 && s % 2 == 0
                ? `window`
                : `wall`;
        }));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof, COLORS.grey);
  },
  bank(e, t) {
    let n = {
        wall: COLORS.sand,
        trim: COLORS.white,
        roof: COLORS.lightGrey,
        accent: COLORS.white,
        door: COLORS.darkGrey,
        ...t.colors,
      },
      r = t.h ?? 5,
      i = frontOf(t);
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, a, o) => {
          let s = o === `n` || o === `s` ? n : a,
            c = o === `n` || o === `s` ? e.w : e.d;
          return ((n === 0 || n === e.w - 1) && (a === 0 || a === e.d - 1)) || t === r - 1
            ? `accent`
            : o === i
              ? t <= 1 && Math.abs(s - c / 2 + 0.5) < 1
                ? `door`
                : s % 2 == 0
                  ? `accent`
                  : `window`
              : t >= 1 && t <= 3 && s % 3 == 1
                ? `window`
                : `wall`;
        }));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
    let a = e.addLayer();
    e.ring(a, 0, 0, e.w - 1, e.d - 1, { wall: COLORS.yellow }, null, !0);
  },
  tower(e, t) {
    let n = { wall: COLORS.silver, trim: COLORS.lightGrey, roof: COLORS.grey, accent: COLORS.steel, ...t.colors },
      r = t.h ?? 18;
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, r, i) =>
          (n === 0 || n === e.w - 1) && (r === 0 || r === e.d - 1)
            ? `accent`
            : t === 0
              ? `wall`
              : t % 3 == 0
                ? `accent`
                : `window`,
        ));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof, COLORS.lightGrey);
    let i = e.addLayer();
    e.ring(i, 1, 1, e.w - 2, e.d - 2, { wall: n.accent }, null, !0);
    for (let t = 0; t < 4; t++)
      ((i = e.addLayer()),
        e.place(
          Math.floor(e.w / 2),
          i,
          Math.floor(e.d / 2),
          1,
          1,
          t === 3 ? `b1s` : `b1`,
          t === 3 ? COLORS.red : COLORS.lightGrey,
          0,
        ));
  },
  garage(e, t) {
    let n = { wall: COLORS.concrete, roof: COLORS.concrete, accent: COLORS.yellow, ...t.colors },
      r = t.floors ?? 3;
    for (let t = 0; t < r; t++) {
      for (let r = 0; r < 2; r++) {
        let i = e.addLayer();
        for (let a of windowColumns(e.w))
          for (let o of windowColumns(e.d)) e.place(a, i, o, 1, 1, `b1`, r === 1 && t === 0 ? n.accent : n.wall, 0);
      }
      let r = e.addLayer(0.4, !0);
      for (let t = 0; t < e.w; t += 2)
        for (let i = 0; i < e.d; i += 2) e.place(t, r, i, 2, 2, `p2`, (t + i) % 4 ? n.roof : COLORS.grey, 0);
    }
    let i = e.addLayer();
    e.ring(i, 0, 0, e.w - 1, e.d - 1, { wall: n.accent }, (e, t) => ((e + t) % 2 ? `wall` : `none`), !0);
  },
  gas(e, t) {
    let n = {
      wall: COLORS.white,
      roof: COLORS.red,
      accent: COLORS.yellow,
      trim: COLORS.white,
      door: COLORS.darkGrey,
      ...t.colors,
    };
    for (let t = 0; t < 3; t++) {
      (e.addLayer(),
        e.ring(t, 0, 0, 3, e.d - 1, n, (e, n, r) =>
          t === 1 && r === `e` ? `window` : t === 0 && r === `e` && n === 2 ? `door` : `wall`,
        ));
      for (let [n, r] of [
        [7, 1],
        [7, e.d - 2],
        [e.w - 2, 1],
        [e.w - 2, e.d - 2],
      ])
        e.place(n, t, r, 1, 1, `b1`, COLORS.lightGrey, 0);
      if (t === 0)
        for (let [n, r] of [
          [10, 3],
          [10, e.d - 4],
        ])
          e.place(n, t, r, 1, 1, `b1s`, COLORS.red, 0);
    }
    let r = e.addLayer(0.4, !0);
    for (let t = 0; t < e.w; t += 2)
      for (let i = 0; i < e.d; i += 2) e.place(t, r, i, 2, 2, `p2`, i === 0 || i >= e.d - 2 ? n.accent : n.roof, 0);
  },
  silo(e, t) {
    let n = { wall: COLORS.lightGrey, roof: COLORS.steel, accent: COLORS.red, ...t.colors },
      r = t.h ?? 10,
      i = e.w / 2;
    for (let t = 0; t < r; t++) {
      e.addLayer();
      for (let r = 0; r < e.w; r++)
        for (let a = 0; a < e.d; a++) {
          let o = r + 0.5 - i,
            s = a + 0.5 - i,
            c = Math.hypot(o, s);
          c < i && c >= i - 1.25 && e.place(r, t, a, 1, 1, `b1`, t % 4 == 3 ? n.accent : n.wall, 0);
        }
    }
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
  },
  waterTower(e, t) {
    let n = { wall: COLORS.teal, roof: COLORS.lightGrey, accent: COLORS.white, ...t.colors };
    for (let t = 0; t < 6; t++) {
      e.addLayer();
      for (let [n, r] of [
        [0, 0],
        [e.w - 1, 0],
        [0, e.d - 1],
        [e.w - 1, e.d - 1],
      ])
        e.place(n, t, r, 1, 1, `b1`, COLORS.darkGrey, 0);
    }
    let r = e.addLayer(0.4, !0);
    for (let t = 0; t < e.w; t += 2) for (let n = 0; n < e.d; n += 2) e.place(t, r, n, 2, 2, `p2`, COLORS.darkGrey, 0);
    for (let t = 0; t < 4; t++) {
      let r = e.addLayer();
      e.ring(r, 0, 0, e.w - 1, e.d - 1, n, (e, n) => (t === 1 ? `accent` : `wall`));
    }
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
  },
  billboard(e, t) {
    let n = { wall: COLORS.yellow, accent: COLORS.blue, ...t.colors };
    for (let t = 0; t < 3; t++)
      (e.addLayer(),
        e.place(1, t, 0, 1, 1, `b1`, COLORS.darkGrey, 0),
        e.place(e.w - 2, t, 0, 1, 1, `b1`, COLORS.darkGrey, 0));
    for (let t = 0; t < 3; t++) {
      let r = e.addLayer();
      for (let i = 0; i < e.w; i += 2)
        e.place(i, r, 0, 2, 1, t === 2 ? `b2s` : `b2`, t === 1 && i % 4 == 2 ? n.accent : n.wall, 0);
    }
  },
  barn(e, t) {
    let n = {
        wall: COLORS.red,
        trim: COLORS.white,
        roof: COLORS.darkGrey,
        accent: COLORS.white,
        door: COLORS.white,
        ...t.colors,
      },
      r = t.h ?? 5,
      i = frontOf(t);
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (n, r, a) => {
          if ((n === 0 || n === e.w - 1) && (r === 0 || r === e.d - 1)) return `accent`;
          let o = a === `n` || a === `s` ? n : r,
            s = a === `n` || a === `s` ? e.w : e.d;
          return a === i && t <= 3 && Math.abs(o - s / 2 + 0.5) < 2 ? ((o + t) % 2 ? `door` : `accent`) : `wall`;
        }));
    e.gableRoof(n.roof, COLORS.black);
  },
  hut(e, t) {
    let n = { wall: COLORS.green, trim: COLORS.white, roof: COLORS.yellow, door: COLORS.brown, ...t.colors },
      r = t.h ?? 2;
    for (let t = 0; t < r; t++)
      (e.addLayer(),
        e.ring(t, 0, 0, e.w - 1, e.d - 1, n, (e, n, r) => (t === 1 && r === `s` && e === 1 ? `window` : `wall`)));
    e.roofPlates(0, 0, e.w - 1, e.d - 1, n.roof);
  },
  door(e, t) {
    let n = { wall: COLORS.steel, accent: COLORS.yellow, ...t.colors },
      r = t.h ?? 4;
    for (let i = 0; i < r; i++)
      if ((e.addLayer(), t.axis === `z`))
        for (let t = 0; t < e.d; t++) e.place(0, i, t, 1, 1, `b1`, (t + i) % 2 ? n.accent : n.wall, 0);
      else for (let t = 0; t < e.w; t++) e.place(t, i, 0, 1, 1, `b1`, (t + i) % 2 ? n.accent : n.wall, 0);
  },
};
function windowColumns(e) {
  let t = [];
  for (let n = 0; n < e - 1; n += 3) t.push(n);
  return (t.push(e - 1), t);
}
function groundCells(e, t) {
  let n = new Set([e.minX, e.maxX]),
    r = new Set([e.minZ, e.maxZ]);
  for (let e of t) (n.add(e.minX), n.add(e.maxX), r.add(e.minZ), r.add(e.maxZ));
  let i = [...n].filter((t) => t >= e.minX && t <= e.maxX).sort((e, t) => e - t),
    a = [...r].filter((t) => t >= e.minZ && t <= e.maxZ).sort((e, t) => e - t),
    o = [];
  for (let e = 0; e < a.length - 1; e++) {
    let n = null;
    for (let r = 0; r < i.length - 1; r++) {
      let s = (i[r] + i[r + 1]) / 2,
        c = (a[e] + a[e + 1]) / 2;
      t.some((e) => s > e.minX && s < e.maxX && c > e.minZ && c < e.maxZ)
        ? (n &&= (o.push(n), null))
        : n
          ? (n.maxX = i[r + 1])
          : (n = { minX: i[r], maxX: i[r + 1], minZ: a[e], maxZ: a[e + 1] });
    }
    n && o.push(n);
  }
  return o;
}
var Level = class {
  constructor(e) {
    ((this.game = e),
      (this.surface = new THREE.Group()),
      (this.surface.name = `surface`),
      (this.under = new THREE.Group()),
      (this.under.name = `underground`),
      (this.always = new THREE.Group()),
      (this.always.name = `transition`),
      e.scene.add(this.surface, this.under, this.always),
      (this.mats = {
        plastic: vertexColorMaterial({ roughness: 0.45 }),
        wall: wallMaterial(),
        ground: studGroundMaterial(),
        asphalt: asphaltMaterial(),
      }),
      (this.mb = {
        surf: new ModelBuilder(),
        surfWall: new ModelBuilder(),
        under: new ModelBuilder(),
        underWall: new ModelBuilder(),
        always: new ModelBuilder(),
        alwaysWall: new ModelBuilder(),
      }),
      (this.route = roundRoute(CARRIER_ROUTE, 16)),
      (this.holes = [
        { minX: STAIRWELL.x0, maxX: STAIRWELL.x1, minZ: STAIRWELL.z0, maxZ: STAIRWELL.z1 },
        {
          minX: VEHICLE_RAMP.x - VEHICLE_RAMP.w / 2,
          maxX: VEHICLE_RAMP.x + VEHICLE_RAMP.w / 2,
          minZ: VEHICLE_RAMP.z0,
          maxZ: VEHICLE_RAMP.z1,
        },
        { minX: STATION_EXIT.x0, maxX: STATION_EXIT.x1, minZ: STATION_EXIT.z1, maxZ: STATION_EXIT.z0 },
      ]),
      (this.lights = []),
      (this.beacons = []),
      (this.clouds = []),
      (this.mazeRDUs = []),
      (this.trees = []),
      (this.lamps = []));
  }
  build() {
    (this._ground(),
      this._roads(),
      this._boundary(),
      this._hills(),
      this._hq(),
      this._stairsAndRamps(),
      this._underground(),
      this._compound(),
      this._maze(),
      this._plateau(),
      this._pillar(),
      this._depot(),
      this._bumps(),
      this._decor(),
      this._clouds(),
      this._buildings(),
      this._flush());
  }
  wall(e, t, n, r, i, a, o, s, c = !0, l = {}) {
    let u = Math.abs(r - t),
      d = Math.abs(i - n),
      f = o - a,
      p = (t + r) / 2,
      m = (n + i) / 2,
      h = (a + o) / 2;
    (this.mb[e].box(u, f, d, p, h, m, s, { flat: !0, bevel: l.bevel ?? 0.05 }),
      c &&
        this.game.physics.fixedBox(p, h, m, u / 2, f / 2, d / 2, {
          member: GROUP.STATIC,
          friction: l.friction ?? 0.3,
          restitution: 0.2,
        }));
  }
  _flush() {
    let e = (e, t, n, r = !0) => {
      if (e.empty) return null;
      let i = new THREE.Mesh(e.build(), t);
      return ((i.castShadow = r), (i.receiveShadow = !0), n.add(i), i);
    };
    (e(this.mb.surf, this.mats.plastic, this.surface),
      e(this.mb.surfWall, this.mats.wall, this.surface),
      e(this.mb.under, this.mats.plastic, this.under),
      e(this.mb.underWall, this.mats.wall, this.under),
      e(this.mb.always, this.mats.plastic, this.always),
      e(this.mb.alwaysWall, this.mats.wall, this.always));
  }
  _ground() {
    let e = this.game.physics,
      t = new THREE.Shape();
    (t.moveTo(-900, -900), t.lineTo(900, -900), t.lineTo(900, 900), t.lineTo(-900, 900), t.lineTo(-900, -900));
    for (let e of this.holes) {
      let n = new THREE.Path();
      (n.moveTo(e.minX, -e.minZ),
        n.lineTo(e.minX, -e.maxZ),
        n.lineTo(e.maxX, -e.maxZ),
        n.lineTo(e.maxX, -e.minZ),
        n.lineTo(e.minX, -e.minZ),
        t.holes.push(n));
    }
    let n = new THREE.ShapeGeometry(t);
    n.rotateX(-Math.PI / 2);
    let r = n.toNonIndexed(),
      i = new THREE.Color(COLORS.grass),
      a = new Float32Array(r.attributes.position.count * 3);
    for (let e = 0; e < a.length; e += 3) ((a[e] = i.r), (a[e + 1] = i.g), (a[e + 2] = i.b));
    (r.setAttribute(`color`, new THREE.BufferAttribute(a, 3)), r.computeVertexNormals());
    let o = new THREE.Mesh(r, this.mats.ground);
    ((o.receiveShadow = !0), (o.name = `ground`), this.surface.add(o));
    let s = [];
    for (let e of LOTS) s.push(flatQuadGeometry(e.r[0], e.r[1], e.r[2], e.r[3], 0.012, e.c));
    let c = new THREE.Mesh(mergeMeshBuffers(s), this.mats.ground);
    ((c.receiveShadow = !0), this.surface.add(c));
    let l = {
      minX: MAP_BOUNDS.minX - 20,
      maxX: MAP_BOUNDS.maxX + 20,
      minZ: MAP_BOUNDS.minZ - 20,
      maxZ: MAP_BOUNDS.maxZ + 20,
    };
    for (let t of groundCells(l, this.holes))
      e.fixedBox((t.minX + t.maxX) / 2, -1, (t.minZ + t.maxZ) / 2, (t.maxX - t.minX) / 2, 1, (t.maxZ - t.minZ) / 2, {
        member: GROUP.STATIC,
        friction: 0.8,
      });
    let u = new ModelBuilder();
    (u.box(0.2, 12, 4, STAIRWELL.x1 + 0.3, -6, 140, 328965, { flat: !0, bevel: 0 }),
      u.box(7, 12, 0.2, VEHICLE_RAMP.x, -6, VEHICLE_RAMP.z0 - 0.3, 328965, { flat: !0, bevel: 0 }),
      u.box(4, 12, 0.2, -102, -6, STATION_EXIT.z0 + 0.3, 328965, { flat: !0, bevel: 0 }));
    let d = new THREE.Mesh(u.build(), new THREE.MeshBasicNodeMaterial({ color: 197379 }));
    this.surface.add(d);
  }
  _roads() {
    let e = this.route,
      t = e.pts.filter((t, n) => n % 4 == 0 || n === e.pts.length - 1),
      n = [],
      r = [],
      i = [],
      a = (e, t) => {
        (r.push(ribbonGeometry(e, t + 5, 0.016, COLORS.sidewalk)),
          n.push(ribbonGeometry(e, t, 0.03, COLORS.road)),
          i.push(ribbonGeometry(e, 0.35, 0.045, COLORS.lineYellow, { dash: [3, 6] })),
          i.push(this._offsetLine(e, t / 2 - 0.6, 0.045)),
          i.push(this._offsetLine(e, -(t / 2 - 0.6), 0.045)));
      };
    a(t, 12);
    for (let e of ROADS) {
      let t = [];
      for (let n = 0; n < e.pts.length - 1; n++) {
        let r = e.pts[n],
          i = e.pts[n + 1],
          a = Math.max(2, Math.round(Math.hypot(i.x - r.x, i.z - r.z) / 2));
        for (let e = 0; e < a; e++) t.push({ x: r.x + (i.x - r.x) * (e / a), z: r.z + (i.z - r.z) * (e / a) });
      }
      (t.push(e.pts[e.pts.length - 1]), a(t, e.w));
    }
    let o = new THREE.Mesh(mergeMeshBuffers(r), this.mats.plastic);
    o.receiveShadow = !0;
    let s = new THREE.Mesh(mergeMeshBuffers(n), this.mats.asphalt);
    s.receiveShadow = !0;
    let c = new THREE.Mesh(mergeMeshBuffers(i), this.mats.plastic);
    ((c.receiveShadow = !0), this.surface.add(o, s, c));
  }
  _offsetLine(e, t, n) {
    return ribbonGeometry(
      e.map((n, r) => {
        let i = e[Math.max(0, r - 1)],
          a = e[Math.min(e.length - 1, r + 1)],
          o = a.x - i.x,
          s = a.z - i.z,
          c = Math.hypot(o, s) || 1;
        return ((o /= c), (s /= c), { x: n.x - s * t, z: n.z + o * t });
      }),
      0.25,
      n,
      COLORS.line,
    );
  }
  _boundary() {
    let e = MAP_BOUNDS,
      t = 3.6,
      n = 9080726;
    (this.wall(`surfWall`, e.minX - 1, e.minZ - 1, e.maxX + 1, e.minZ, 0, t, n),
      this.wall(`surfWall`, e.minX - 1, e.maxZ, e.maxX + 1, e.maxZ + 1, 0, t, n),
      this.wall(`surfWall`, e.minX - 1, e.minZ, e.minX, 70, 0, t, n),
      this.wall(`surfWall`, e.minX - 1, 90, e.minX, e.maxZ, 0, t, n),
      this.game.physics.fixedBox(e.minX - 1.5, 3, 80, 0.5, 3, 10, {
        member: GROUP.STATIC,
        filter: GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.PROP,
      }),
      this.wall(`surfWall`, e.maxX, e.minZ, e.maxX + 1, e.maxZ, 0, t, n));
    let r = e.minX - 1;
    (this.mb.surfWall.box(6, 11, 4, r - 2, 5.5, 68, 7172472, { flat: !0 }),
      this.mb.surfWall.box(6, 11, 4, r - 2, 5.5, 92, 7172472, { flat: !0 }),
      this.mb.surfWall.box(6, 3, 28, r - 2, 9.5, 80, 7172472, { flat: !0 }),
      this.mb.surf.box(1, 1.2, 20, r + 1.2, 10.4, 80, COLORS.yellow, { studs: !0 }));
    for (let e = 0; e < 5; e++)
      this.mb.surf.box(0.6, 0.8, 3.6, r + 1.3, 8.6, 72 + e * 4, e % 2 ? COLORS.black : COLORS.yellow, { flat: !0 });
    (this.mb.surf.box(40, 8, 20, r - 25, 4, 80, 657932, { flat: !0, bevel: 0 }),
      this.mb.surfWall.box(44, 3, 30, r - 25, 9.5, 80, 6119784, { flat: !0 }));
  }
  _hills() {
    let e = makeRng(42),
      t = MAP_BOUNDS,
      n = (t, n) => {
        let r = 2 + Math.floor(e() * 3),
          i = 30 + e() * 30,
          a = 24 + e() * 26,
          o = 0;
        for (let s = 0; s < r; s++) {
          let c = 4 + e() * 6,
            l = s === r - 1 ? COLORS.grassDark : 8153679;
          (this.mb.surfWall.box(i, c, a, t, o + c / 2, n, l, { flat: !0 }), (o += c), (i *= 0.68), (a *= 0.7));
        }
      };
    for (let r = t.minX - 40; r < t.maxX + 60; r += 34 + e() * 16)
      (n(r, t.minZ - 30 - e() * 30), n(r, t.maxZ + 30 + e() * 30));
    for (let r = t.minZ; r < t.maxZ; r += 34 + e() * 16)
      (Math.abs(r - 80) > 26 && n(t.minX - 34 - e() * 26, r), n(t.maxX + 34 + e() * 26, r));
  }
  _hq() {
    let e = this.mb.surf,
      t = HQ.truck;
    (e.push(new THREE.Matrix4().makeRotationY(t.yaw).setPosition(t.x, 0, t.z)),
      e.box(3.4, 1.2, 16, 0, 1.1, -2, COLORS.darkGrey),
      e.box(3.6, 3.8, 12, 0, 3.6, -3.5, COLORS.yellow, { studs: !1 }),
      e.box(3.62, 0.5, 12, 0, 2.2, -3.5, COLORS.black),
      e.box(3.62, 0.5, 12, 0, 4.4, -3.5, COLORS.black),
      e.box(3.4, 3.2, 3.6, 0, 2.6, 5.4, COLORS.red, { studs: !0 }),
      e.box(3, 1.2, 0.2, 0, 3.4, 7.25, COLORS.glass));
    for (let t of [-7, -4, -1, 4.5])
      for (let n of [-1.8, 1.8]) e.cyl(0.8, 0.8, 0.7, 10, n, 0.8, t, COLORS.black, { rot: [0, 0, Math.PI / 2] });
    (e.wedge(3.4, 1.4, 3, 0, 0.7, -11, COLORS.steel, { rot: [0, Math.PI, 0], lowFrac: 0.05 }),
      e.pop(),
      this.game.physics.fixedBox(t.x, 2.5, t.z - 0, 8, 2.5, 1.9, { member: GROUP.STATIC, restitution: 0.3 }),
      e.box(8, 0.4, 6, -225, 3.2, 124, COLORS.orange, { studs: !0 }));
    for (let [t, n] of [
      [-229, 121.5],
      [-221, 121.5],
      [-229, 126.5],
      [-221, 126.5],
    ])
      e.box(0.5, 3, 0.5, t, 1.5, n, COLORS.lightGrey);
    e.box(3, 1.2, 1.5, -225, 0.6, 124, COLORS.steel, { studs: !0 });
    for (let t = 0; t < 6; t++) e.cyl(0.05, 0.45, 1, 6, -212 + t * 5, 0.5, 98, COLORS.orange);
  }
  _stairsAndRamps() {
    let e = this.game.physics,
      t = this.mb.always;
    this.mb.alwaysWall;
    let n = STAIRWELL,
      r = (n.x1 - n.x0) / 20;
    for (let e = 0; e < 20; e++) {
      let i = -0.6 * (e + 1) + 0.6;
      t.box(r, 0.6, n.z1 - n.z0, n.x0 + r * (e + 0.5), i - 0.3, (n.z0 + n.z1) / 2, e % 2 ? COLORS.concrete : 12038822, {
        flat: !0,
        bevel: 0.03,
      });
    }
    (e.ramp(n.x0, 140, n.x1, 140, -0.12, -11.98, n.z1 - n.z0, { member: GROUP.STATIC, friction: 0.1 }),
      this.wall(`alwaysWall`, n.x0, n.z0 - 0.6, n.x1, n.z0, -12, 1.2, 10133670),
      this.wall(`alwaysWall`, n.x0, n.z1, n.x1, n.z1 + 0.6, -12, 1.2, 10133670),
      this.wall(`alwaysWall`, n.x0 - 0.6, n.z0 - 1, n.x0 + 0.2, n.z0 - 0.4, 0, 1.2, COLORS.yellow),
      this.wall(`alwaysWall`, n.x0 - 0.6, n.z1 + 0.4, n.x0 + 0.2, n.z1 + 1, 0, 1.2, COLORS.yellow));
    let i = VEHICLE_RAMP;
    e.ramp(i.x, i.z0, i.x, i.z1, -11.98, -0.12, i.w, { member: GROUP.STATIC, friction: 0.8 });
    for (let e = 0; e < 18; e++) {
      let n = e / 18,
        r = (e + 1) / 18,
        a = i.z0 + ((i.z1 - i.z0) * (n + r)) / 2,
        o = -12 + (12 * (n + r)) / 2;
      t.box(i.w, 0.5, (i.z1 - i.z0) / 18 + 0.02, i.x, o - 0.25, a, e % 2 ? 7304058 : 8027781, {
        flat: !0,
        bevel: 0,
        rot: [-Math.atan2(12, i.z1 - i.z0), 0, 0],
      });
    }
    (this.wall(`alwaysWall`, i.x - i.w / 2 - 0.6, i.z0, i.x - i.w / 2, i.z1, -12, 1.2, 10133670),
      this.wall(`alwaysWall`, i.x + i.w / 2, i.z0, i.x + i.w / 2 + 0.6, i.z1, -12, 1.2, 10133670));
    let a = STATION_EXIT,
      o = (a.z0 - a.z1) / 20;
    for (let e = 0; e < 20; e++) {
      let n = -12 + (12 / 20) * (e + 1);
      t.box(a.x1 - a.x0, 0.6, o, (a.x0 + a.x1) / 2, n - 0.3, a.z0 - o * (e + 0.5), e % 2 ? COLORS.concrete : 12038822, {
        flat: !0,
        bevel: 0.03,
      });
    }
    (e.ramp(-102, a.z0, -102, a.z1, -11.98, -0.12, a.x1 - a.x0, { member: GROUP.STATIC, friction: 0.1 }),
      this.wall(`alwaysWall`, a.x0 - 0.6, a.z1, a.x0, a.z0, -12, 1.2, 10133670),
      this.wall(`alwaysWall`, a.x1, a.z1, a.x1 + 0.6, a.z0, -12, 1.2, 10133670),
      this.wall(`alwaysWall`, a.x0 - 0.6, a.z0, a.x1 + 0.6, a.z0 + 0.6, 0, 1.2, COLORS.yellow),
      this.wall(`alwaysWall`, n.x1, n.z0 - 0.6, n.x1 + 0.6, n.z1 + 0.6, 0, 1.2, COLORS.yellow),
      this.wall(`alwaysWall`, i.x - i.w / 2 - 0.6, i.z0 - 0.6, i.x + i.w / 2 + 0.6, i.z0, 0, 1.2, COLORS.yellow),
      this.mb.surf.box(0.3, 2.2, 3, n.x0 - 1.5, 1.1, n.z0 - 2.5, COLORS.blue, { flat: !0 }),
      this.mb.surf.box(0.35, 0.8, 2.6, n.x0 - 1.5, 1.8, n.z0 - 2.5, COLORS.white, { flat: !0 }));
  }
  _underground() {
    let e = this.game.physics,
      t = this.mb.under;
    this.mb.underWall;
    let n = (t, n) => {
        let r = new THREE.Mesh(flatQuadGeometry(t.minX, t.minZ, t.maxX, t.maxZ, -12, n), this.mats.ground);
        ((r.receiveShadow = !0),
          this.under.add(r),
          e.fixedBox(
            (t.minX + t.maxX) / 2,
            -13,
            (t.minZ + t.maxZ) / 2,
            (t.maxX - t.minX) / 2,
            1,
            (t.maxZ - t.minZ) / 2,
            { member: GROUP.STATIC, friction: 0.8 },
          ));
      },
      r = SERVICE_CHAMBER,
      i = PLATFORM_A,
      a = SUBWAY_TUNNEL,
      o = PLATFORM_B;
    (n(r, 9276034), n(i, 10591376), n(a, 5987681), n(o, 10591376));
    let s = 9207664;
    (this.wall(`underWall`, r.minX - 1, r.minZ - 1, r.maxX + 1, r.minZ, -12, -6, s),
      this.wall(`underWall`, r.minX - 1, r.maxZ, VEHICLE_RAMP.x - VEHICLE_RAMP.w / 2, r.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, VEHICLE_RAMP.x + VEHICLE_RAMP.w / 2, r.maxZ, r.maxX + 1, r.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, r.minX - 1, r.minZ, r.minX, 138, -12, -6, s),
      this.wall(`underWall`, r.minX - 1, 142, r.minX, r.maxZ, -12, -6, s),
      this.wall(`underWall`, r.maxX - 0.2, r.minZ, r.maxX + 0.8, 136, -12, -6, s),
      this.wall(`underWall`, r.maxX - 0.2, 144, r.maxX + 0.8, r.maxZ, -12, -6, s),
      this.wall(`underWall`, i.minX, i.maxZ, a.maxX + 1, i.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, i.minX, i.minZ - 1, a.minX, i.minZ, -12, -6, s),
      this.wall(`underWall`, a.maxX, a.minZ - 1, a.maxX + 1, a.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, a.minX - 1, o.maxZ, a.minX, i.minZ - 1, -12, -6, s),
      this.wall(`underWall`, o.minX - 1, o.minZ - 1, o.minX, o.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, o.minX, o.maxZ, a.minX - 1, o.maxZ + 1, -12, -6, s),
      this.wall(`underWall`, o.minX, o.minZ - 1, STATION_EXIT.x0, o.minZ, -12, -6, s),
      this.wall(`underWall`, STATION_EXIT.x1, o.minZ - 1, a.maxX + 1, o.minZ, -12, -6, s));
    for (let e of [i, o])
      (t.box(0.4, 0.05, e.maxZ - e.minZ, e.maxX - 0.4, -11.97, (e.minZ + e.maxZ) / 2, COLORS.yellow, {
        flat: !0,
        bevel: 0,
      }),
        t.box(0.8, 3.4, 0.8, e.minX + 2, -10.3, (e.minZ + e.maxZ) / 2, COLORS.steel, { studs: !0 }));
    for (let e of [SUBWAY.x - 0.8, SUBWAY.x + 0.8])
      t.box(0.18, 0.2, a.maxZ - a.minZ, e, -11.9, (a.minZ + a.maxZ) / 2, 10133672, { flat: !0, bevel: 0 });
    for (let e = a.minZ + 1; e < a.maxZ; e += 2.4)
      t.box(2.6, 0.12, 0.5, SUBWAY.x, -11.96, e, 5916214, { flat: !0, bevel: 0 });
    let c = new ModelBuilder();
    for (let e = a.minZ + 6; e < a.maxZ; e += 14)
      c.box(0.3, 0.3, 3, a.maxX - 0.2, -7, e, 16773577, { flat: !0, bevel: 0 });
    for (let e = r.minX + 5; e < r.maxX; e += 9)
      (c.box(3, 0.3, 0.3, e, -7, r.minZ + 0.2, 16773577, { flat: !0, bevel: 0 }),
        c.box(3, 0.3, 0.3, e, -7, r.maxZ - 0.2, 16773577, { flat: !0, bevel: 0 }));
    for (let e of [i, o]) c.box(0.3, 0.3, 6, e.minX + 0.2, -7, (e.minZ + e.maxZ) / 2, 16773577, { flat: !0, bevel: 0 });
    let l = new THREE.Mesh(c.build(), emissiveMaterial(16769704, 2.5));
    this.under.add(l);
    for (let [e, t] of [
      [-142, 140],
      [-120, 140],
      [-104, 140],
      [-104, -161],
    ]) {
      let n = new THREE.PointLight(16769200, 90, 36, 1.6);
      (n.position.set(e, -7, t), this.under.add(n), this.lights.push(n));
    }
    for (let [e, n, r] of [
      [-148, 131, COLORS.brown],
      [-146, 131, COLORS.brown],
      [-147, 133, COLORS.orange],
      [-114, 150, COLORS.steel],
    ])
      t.box(1.8, 1.8, 1.8, e, -11.1, n, r, { studs: !0 });
    (t.box(38, 0.6, 0.6, -131, -6.8, 129, 7174790, { flat: !0 }),
      t.box(0.3, 0.05, 8, -110.9, -11.97, 140, COLORS.yellow, { flat: !0, bevel: 0 }));
    for (let e of [a.maxZ - 1.2, a.minZ + 1.2]) t.box(3, 1.4, 0.8, SUBWAY.x, -11.3, e, COLORS.red, { studs: !0 });
  }
  _compound() {
    let e = COMPOUND,
      t = 4.2,
      n = 10327176;
    (this.wall(`surfWall`, e.minX - 1, e.minZ, e.minX, e.maxZ + 1, 0, t, n),
      this.wall(`surfWall`, e.minX, e.minZ - 1, PLATEAU.minX, e.minZ, 0, t, n),
      this.wall(`surfWall`, e.minX - 1, e.maxZ, PLATEAU.minX + 1, e.maxZ + 1, 0, t, n),
      this.wall(`surfWall`, PLATEAU.minX, PLATEAU.maxZ, PLATEAU.minX + 1, e.maxZ, 0, t, n));
    for (let t = e.minX; t < PLATEAU.minX; t += 4)
      this.mb.surf.box(2, 0.4, 1.1, t + 1, 4.4, e.maxZ + 0.5, (t / 4) % 2 ? COLORS.yellow : COLORS.black, { flat: !0 });
    let r = this.mb.surf;
    for (let e of [-3, 3]) r.box(9, 0.04, 0.25, -94, 0.05, -186 + e, COLORS.white, { flat: !0, bevel: 0 });
    (r.box(0.25, 0.04, 6.2, -98.5, 0.05, -186, COLORS.white, { flat: !0, bevel: 0 }),
      r.box(0.3, 2.4, 0.3, -99.4, 1.2, -190, COLORS.lightGrey),
      r.box(0.25, 1.1, 1.8, -99.4, 2.5, -190, COLORS.blue, { flat: !0 }));
  }
  _maze() {
    let e = MAZE,
      t = makeRng(e.seed),
      n = (e.maxX - e.minX) / e.cols,
      r = (e.maxZ - e.minZ) / e.rows,
      i = [];
    for (let t = 0; t < e.cols * e.rows; t++) i.push({ n: !0, s: !0, e: !0, w: !0, v: !1 });
    let a = (t, n) => n * e.cols + t,
      o = [{ c: 0, r: 1 }];
    i[a(0, 1)].v = !0;
    let s = new Map([[a(0, 1), 0]]);
    for (; o.length; ) {
      let n = o[o.length - 1],
        r = [];
      if (
        (n.r > 0 && !i[a(n.c, n.r - 1)].v && r.push({ c: n.c, r: n.r - 1, d: `n`, o: `s` }),
        n.r < e.rows - 1 && !i[a(n.c, n.r + 1)].v && r.push({ c: n.c, r: n.r + 1, d: `s`, o: `n` }),
        n.c > 0 && !i[a(n.c - 1, n.r)].v && r.push({ c: n.c - 1, r: n.r, d: `w`, o: `e` }),
        n.c < e.cols - 1 && !i[a(n.c + 1, n.r)].v && r.push({ c: n.c + 1, r: n.r, d: `e`, o: `w` }),
        !r.length)
      ) {
        o.pop();
        continue;
      }
      let c = r[Math.floor(t() * r.length)];
      ((i[a(n.c, n.r)][c.d] = !1),
        (i[a(c.c, c.r)][c.o] = !1),
        (i[a(c.c, c.r)].v = !0),
        s.set(a(c.c, c.r), s.get(a(n.c, n.r)) + 1),
        (c.parent = n),
        o.push(c));
    }
    i[a(0, 1)].w = !1;
    let c = 0,
      l = 0;
    for (let [e, t] of s) t > c && ((c = t), (l = e));
    let u = l % e.cols,
      d = Math.floor(l / e.cols);
    this.caveCell = { c: u, r: d };
    let f = 4164154,
      p = 2.8,
      m = 0.9,
      h = (t) => e.minX + t * n,
      g = (t) => e.minZ + t * r;
    for (let t = 0; t < e.rows; t++)
      for (let n = 0; n < e.cols; n++) {
        let r = i[a(n, t)];
        (r.n && this.wall(`surfWall`, h(n) - m / 2, g(t) - m / 2, h(n + 1) + m / 2, g(t) + m / 2, 0, p, f),
          r.w && this.wall(`surfWall`, h(n) - m / 2, g(t) + m / 2, h(n) + m / 2, g(t + 1) - m / 2, 0, p, f),
          n === e.cols - 1 &&
            r.e &&
            this.wall(`surfWall`, h(n + 1) - m / 2, g(t) + m / 2, h(n + 1) + m / 2, g(t + 1) - m / 2, 0, p, f),
          t === e.rows - 1 &&
            r.s &&
            this.wall(`surfWall`, h(n) - m / 2, g(t + 1) - m / 2, h(n + 1) + m / 2, g(t + 1) + m / 2, 0, p, f));
      }
    let _ = new Map(),
      v = [a(0, 1)];
    for (_.set(a(0, 1), -1); v.length; ) {
      let t = v.shift(),
        n = t % e.cols,
        r = Math.floor(t / e.cols),
        o = i[t],
        s = (e, n) => {
          e && !_.has(n) && (_.set(n, t), v.push(n));
        };
      (s(!o.n && r > 0, a(n, r - 1)),
        s(!o.s && r < e.rows - 1, a(n, r + 1)),
        s(!o.w && n > 0, a(n - 1, r)),
        s(!o.e && n < e.cols - 1, a(n + 1, r)));
    }
    let y = [],
      b = l;
    for (; b !== -1 && b !== void 0; ) (y.unshift(b), (b = _.get(b)));
    let x = y.map((t) => ({ x: h(t % e.cols) + n / 2, z: g(Math.floor(t / e.cols)) + r / 2 })),
      ee = [];
    for (let e = 0; e < x.length - 1; e++) {
      let t = x[e],
        n = x[e + 1];
      ee.push(t, { x: (t.x + n.x) / 2, z: (t.z + n.z) / 2 });
    }
    let te = Math.max(1, ee.length / 8);
    for (let e = 0; e < 8; e++) {
      let t = ee[Math.min(ee.length - 1, Math.floor(e * te))];
      this.mazeRDUs.push({ x: t.x + (e % 2 ? 1.5 : -1.5), y: 0, z: t.z });
    }
    let ne = h(u) + n / 2,
      S = g(d) + r / 2,
      re = i[l],
      ie = re.n ? `n` : re.e ? `e` : re.s ? `s` : `w`,
      ae = { n: [0, -r / 2 + 2.2], s: [0, r / 2 - 2.2], e: [n / 2 - 2.2, 0], w: [-n / 2 + 2.2, 0] }[ie],
      oe = ne + ae[0],
      se = S + ae[1];
    this.cave = { x: oe, z: se, side: ie, cell: { x: ne, z: S } };
    let ce = this.mb.surfWall;
    ce.box(7, 4.2, 4.4, oe, 2.1, se, 7236196, { flat: !0, rot: [0, ie === `e` || ie === `w` ? Math.PI / 2 : 0, 0] });
    let le = ie === `e` || ie === `w` ? 2.2 : 3.5,
      ue = ie === `e` || ie === `w` ? 3.5 : 2.2;
    (this.game.physics.fixedBox(oe, 2.1, se, le, 2.1, ue, { member: GROUP.STATIC }),
      ce.box(4.6, 2.4, 3, oe, 5.2, se, 7828332, { flat: !0, rot: [0, ie === `e` || ie === `w` ? Math.PI / 2 : 0, 0] }));
    let de = { n: [0, 2.25], s: [0, -2.25], e: [-2.25, 0], w: [2.25, 0] }[ie];
    this.mb.surf.box(
      ie === `e` || ie === `w` ? 0.2 : 3,
      2.6,
      ie === `e` || ie === `w` ? 3 : 0.2,
      oe + de[0],
      1.3,
      se + de[1],
      855311,
      { flat: !0, bevel: 0 },
    );
    let fe = ne - ae[0] * 0.9,
      pe = S - ae[1] * 0.9;
    (this.mb.surf.box(0.5, 3.4, 0.5, fe, 1.7, pe, COLORS.darkGrey), (this.beaconPos = { x: fe, y: 3.8, z: pe }));
    let me = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), emissiveMaterial(16724770, 6));
    (me.position.set(fe, 3.8, pe),
      this.surface.add(me),
      this.beacons.push(me),
      this.mb.surf.box(0.3, 1.6, 4, e.minX - 1.5, 2.2, g(1) + r / 2 - 5, COLORS.yellow, { flat: !0 }));
  }
  _plateau() {
    let e = PLATEAU,
      t = this.game.physics,
      n = (e.minX + e.maxX) / 2,
      r = (e.minZ + e.maxZ) / 2;
    (this.mb.surfWall.box(e.maxX - e.minX, e.h, e.maxZ - e.minZ, n, e.h / 2, r, 9143160, { flat: !0, bevel: 0.3 }),
      t.fixedBox(n, e.h / 2, r, (e.maxX - e.minX) / 2, e.h / 2, (e.maxZ - e.minZ) / 2, {
        member: GROUP.STATIC,
        friction: 0.8,
      }));
    let i = new THREE.Mesh(
      flatQuadGeometry(e.minX + 0.3, e.minZ + 0.3, e.maxX - 0.3, e.maxZ - 0.3, e.h + 0.01, 10131343),
      this.mats.ground,
    );
    ((i.receiveShadow = !0), this.surface.add(i));
    let a = PLATEAU_RAMP;
    t.ramp(a.x0, a.z, a.x1 + 0.5, a.z, 0, e.h + 0.02, a.w, { member: GROUP.STATIC, friction: 0.8 });
    let o = a.x1 - a.x0,
      s = Math.atan2(e.h, o);
    this.mb.surf.box(Math.hypot(o, e.h), 0.6, a.w, (a.x0 + a.x1) / 2, e.h / 2 - 0.3, a.z, 8223348, {
      flat: !0,
      rot: [0, 0, s],
    });
    for (let t of [-a.w / 2 - 0.3, a.w / 2 + 0.3])
      this.mb.surf.box(Math.hypot(o, e.h), 0.5, 0.5, (a.x0 + a.x1) / 2, e.h / 2 + 0.4, a.z + t, COLORS.yellow, {
        flat: !0,
        rot: [0, 0, s],
      });
    let c = HANGAR,
      l = e.h,
      u = 8358549;
    (this.wall(`surfWall`, c.minX, c.minZ, c.maxX, c.minZ + 1, l, l + 7, u),
      this.wall(`surfWall`, c.minX, c.maxZ - 1, c.maxX, c.maxZ, l, l + 7, u),
      this.wall(`surfWall`, c.maxX - 1, c.minZ, c.maxX, c.maxZ, l, l + 7, u),
      this.wall(`surfWall`, c.minX, c.minZ + 1, c.minX + 1, -189, l, l + 7, u),
      this.wall(`surfWall`, c.minX, -181, c.minX + 1, c.maxZ - 1, l, l + 7, u),
      this.wall(`surfWall`, c.minX, -189, c.minX + 1, -181, l + 6, l + 7, u, !1));
    let d = new ModelBuilder();
    (d.box(
      c.maxX - c.minX + 1,
      0.6,
      c.maxZ - c.minZ + 1,
      (c.minX + c.maxX) / 2,
      l + 7 + 0.3,
      (c.minZ + c.maxZ) / 2,
      COLORS.lightGrey,
      { studs: !0 },
    ),
      (this.hangarRoof = new THREE.Mesh(d.build(), this.mats.plastic)),
      (this.hangarRoof.castShadow = !0),
      (this.hangarRoof.receiveShadow = !0),
      this.surface.add(this.hangarRoof),
      this.game.physics.fixedBox(
        (c.minX + c.maxX) / 2,
        l + 7 + 0.3,
        (c.minZ + c.maxZ) / 2,
        (c.maxX - c.minX) / 2,
        0.3,
        (c.maxZ - c.minZ) / 2,
        { member: GROUP.STATIC },
      ),
      this.mb.surf.box(12, 0.06, 8, 38, l + 0.03, -185, COLORS.yellow, { flat: !0, bevel: 0 }));
  }
  _pillar() {
    let e = PILLAR,
      t = [
        [e.size + 6, 8],
        [e.size + 3, 9],
        [e.size, e.h - 17],
      ],
      n = 0;
    for (let [r, i] of t)
      (this.mb.surfWall.box(r, i, r, e.x, n + i / 2, e.z, 9340797, { flat: !0, bevel: 0.2 }),
        this.game.physics.fixedBox(e.x, n + i / 2, e.z, r / 2, i / 2, r / 2, { member: GROUP.STATIC }),
        (n += i));
    let r = new THREE.Mesh(
      flatQuadGeometry(
        e.x - e.size / 2 + 0.2,
        e.z - e.size / 2 + 0.2,
        e.x + e.size / 2 - 0.2,
        e.z + e.size / 2 - 0.2,
        e.h + 0.01,
        6989903,
      ),
      this.mats.ground,
    );
    ((r.receiveShadow = !0), this.surface.add(r));
  }
  _depot() {
    let e = DEPOT,
      t = 7175530;
    (this.wall(`surfWall`, e.minX, e.minZ, e.maxX, e.minZ + 1.5, 0, 12, t),
      this.wall(`surfWall`, e.minX, e.maxZ - 1.5, e.maxX, e.maxZ, 0, 12, t),
      this.wall(`surfWall`, e.maxX - 1.5, e.minZ, e.maxX, e.maxZ, 0, 12, t));
    for (let t = e.minX + 4; t < e.maxX; t += 8)
      this.mb.surf.box(1.2, 1.2, e.maxZ - e.minZ, t, 12.6, (e.minZ + e.maxZ) / 2, COLORS.yellow, { flat: !0 });
    (this.mb.surf.box(22, 0.08, 12, 234, 0.05, -90, COLORS.yellow, { flat: !0, bevel: 0 }),
      this.mb.surf.box(18, 0.1, 8, 234, 0.06, -90, COLORS.black, { flat: !0, bevel: 0 }));
    for (let e = 0; e < 3; e++)
      this.mb.surf.box(1.2, 0.12, 6, 226 + e * 6, 0.07, -90, COLORS.green, { flat: !0, bevel: 0 });
    for (let e of [-112, -68])
      (this.mb.surf.box(0.4, 10, 0.4, 212, 5, e, COLORS.lightGrey),
        this.mb.surf.box(0.2, 1.8, 3, 212, 9, e + 1.6, COLORS.green, { flat: !0 }));
  }
  _bumps() {
    for (let e of KICKER_BUMPS) {
      let t = 5.5,
        n = 1.35,
        r = Math.sin(e.yaw),
        i = Math.cos(e.yaw),
        a = e.x - (r * t) / 2,
        o = e.z - (i * t) / 2,
        s = e.x + (r * t) / 2,
        c = e.z + (i * t) / 2;
      (this.game.physics.ramp(a, o, s, c, 0, n, 5, { member: GROUP.STATIC, friction: 0.7 }),
        this.mb.surf.wedge(5, n, t, e.x, n / 2, e.z, 10189394, { rot: [0, e.yaw + Math.PI, 0], lowFrac: 0.02 }),
        this.mb.surf.box(5, 0.2, 0.6, e.x + r * (t / 2 - 0.3), 1.3, e.z + i * (t / 2 - 0.3), COLORS.yellow, {
          flat: !0,
          rot: [0, e.yaw, 0],
        }));
    }
  }
  _decor() {
    let e = makeRng(9),
      t = this.route;
    for (let n = 20; n < t.pts.length - 20; n += 36) {
      let r = t.pts[n],
        i = Math.cos(r.yaw),
        a = -Math.sin(r.yaw);
      for (let t of [-1, 1]) {
        let o = 11 + e() * 2,
          s = r.x + i * o * t,
          c = r.z + a * o * t;
        n % 72 == 20 ? this.lamps.push({ x: s, z: c }) : this.trees.push({ x: s, z: c, s: 0.85 + e() * 0.4 });
      }
    }
    for (let t = 0; t < 26; t++) this.trees.push({ x: 150 + e() * 100, z: 20 + e() * 160, s: 0.8 + e() * 0.6 });
    for (let t = 0; t < 16; t++) this.trees.push({ x: -290 + e() * 120, z: 140 + e() * 55, s: 0.8 + e() * 0.6 });
    for (let t = 0; t < 10; t++) this.trees.push({ x: -290 + e() * 60, z: -180 + e() * 200, s: 0.8 + e() * 0.6 });
    for (let t = 0; t < 8; t++) this.trees.push({ x: 180 + e() * 70, z: -200 + e() * 60, s: 0.8 + e() * 0.6 });
  }
  _clouds() {
    let e = makeRng(77),
      t = new THREE.MeshStandardNodeMaterial({
        color: 16777215,
        roughness: 1,
        emissive: 8952234,
        emissiveIntensity: 0.25,
      });
    for (let n = 0; n < 12; n++) {
      let n = new ModelBuilder(),
        r = 3 + Math.floor(e() * 4);
      for (let t = 0; t < r; t++)
        n.ico(6 + e() * 7, (t - r / 2) * 7 + e() * 4, e() * 3, e() * 6, 16777215, { sy: 0.55 });
      let i = new THREE.Mesh(n.build(), t);
      (i.position.set(-350 + e() * 700, 95 + e() * 40, -260 + e() * 520),
        (i.castShadow = !1),
        (i.userData.speed = 1 + e() * 1.5),
        this.surface.add(i),
        this.clouds.push(i));
    }
  }
  _buildings() {
    let e = this.game;
    this.buildings = [];
    for (let t of BUILDINGS) this.buildings.push(buildBuilding(e.bricks, { ...t }));
    this.doors = {};
    for (let t of DOORS) {
      let n = t.area === `underground` ? e.bricksUnder : e.bricks;
      this.doors[t.id] = buildBuilding(n, { ...t });
    }
    let t = (e, t) => {
      for (let n of this.buildings) {
        let r = n.aabb;
        if (e > r.minX - 3 && e < r.maxX + 3 && t > r.minZ - 3 && t < r.maxZ + 3) return !0;
      }
      for (let n of this.holes) if (e > n.minX - 3 && e < n.maxX + 3 && t > n.minZ - 3 && t < n.maxZ + 3) return !0;
      let n = COMPOUND;
      if (e > n.minX - 2 && e < PLATEAU.maxX + 2 && t > n.minZ - 2 && t < n.maxZ + 2) return !0;
      let r = DEPOT;
      if (e > r.minX - 4 && t > r.minZ - 4 && t < r.maxZ + 4) return !0;
      let i = PILLAR;
      if (
        (Math.abs(e - i.x) < 12 && Math.abs(t - i.z) < 12) ||
        e < MAP_BOUNDS.minX + 3 ||
        e > MAP_BOUNDS.maxX - 3 ||
        t < MAP_BOUNDS.minZ + 3 ||
        t > MAP_BOUNDS.maxZ - 3
      )
        return !0;
      for (let n = 0; n < this.route.pts.length; n += 6) {
        let r = this.route.pts[n];
        if ((r.x - e) ** 2 + (r.z - t) ** 2 < 64) return !0;
      }
      for (let n of LOTS)
        if (e > n.r[0] - 1 && e < n.r[2] + 1 && t > n.r[1] - 1 && t < n.r[3] + 1 && n.c !== 8100412) return !0;
      return !1;
    };
    ((this.trees = this.trees.filter((e) => !t(e.x, e.z))), (this.lamps = this.lamps.filter((e) => !t(e.x, e.z))));
  }
  update(e, t, n) {
    if (this.hangarRoof && n) {
      let e = HANGAR,
        t = n.x > e.minX - 1 && n.x < e.maxX + 1 && n.z > e.minZ - 1 && n.z < e.maxZ + 1 && n.y < PLATEAU.h + 8;
      this.hangarRoof.visible = !t;
    }
    for (let t of this.clouds) ((t.position.x += t.userData.speed * e), t.position.x > 420 && (t.position.x = -420));
    for (let e of this.beacons) e.visible = Math.sin(t * 7) > 0;
  }
  setArea(e) {
    ((this.surface.visible = e !== `underground`), (this.under.visible = e === `underground`));
  }
};
var hazardStripes = (e, t, n, r, i, a, o, s = 6, c = COLORS.yellow, l = COLORS.black, u = `x`) => {
  for (let d = 0; d < s; d++)
    u === `x`
      ? e.box(t / s, n, r, i - t / 2 + (d + 0.5) * (t / s), a, o, d % 2 ? l : c, { bevel: 0.03 })
      : e.box(t, n, r / s, i, a, o - r / 2 + (d + 0.5) * (r / s), d % 2 ? l : c, { bevel: 0.03 });
};
function wheelGeometry(e, t, n = COLORS.black, r = COLORS.lightGrey) {
  let i = new ModelBuilder();
  return (
    i.cyl(e, e, t, 12, 0, 0, 0, n, { rot: [0, 0, Math.PI / 2], capBot: !0, flat: !0 }),
    i.cyl(e * 0.5, e * 0.5, t + 0.06, 8, 0, 0, 0, r, { rot: [0, 0, Math.PI / 2], capBot: !0, flat: !0 }),
    i.build()
  );
}
function swingbackModel() {
  let e = new ModelBuilder();
  return (
    e.box(2.9, 0.6, 6.1, 0, 0.95, 0, COLORS.darkGrey),
    e.box(3, 1.9, 1.7, 0, 2.2, 2.35, COLORS.orange, { studs: !0 }),
    e.box(2.6, 0.9, 0.12, 0, 2.55, 3.22, COLORS.glass, { flat: !0 }),
    e.box(0.12, 0.8, 1.1, 1.51, 2.55, 2.4, COLORS.glass, { flat: !0 }),
    e.box(0.12, 0.8, 1.1, -1.51, 2.55, 2.4, COLORS.glass, { flat: !0 }),
    e.box(2.8, 0.5, 0.4, 0, 1.35, 3.25, COLORS.black),
    e.box(0.5, 0.3, 0.1, 1, 1.45, 3.46, 16774864, { flat: !0 }),
    e.box(0.5, 0.3, 0.1, -1, 1.45, 3.46, 16774864, { flat: !0 }),
    e.cyl(0.14, 0.14, 1.6, 6, 1.35, 3.6, 1.6, COLORS.steel),
    e.box(3.1, 0.35, 4.5, 0, 1.45, -0.85, COLORS.steel),
    e.box(0.25, 1.35, 4.5, 1.45, 2.3, -0.85, COLORS.steel, { studs: !1 }),
    e.box(0.25, 1.35, 4.5, -1.45, 2.3, -0.85, COLORS.steel),
    e.box(3.1, 1.6, 0.3, 0, 2.4, 1.35, COLORS.grey),
    e.box(2.7, 0.9, 3.9, 0, 2.05, -0.9, 7037520, { flat: !0 }),
    hazardStripes(e, 3.3, 1.7, 0.55, 0, 2.05, -3.15, 6),
    e.box(3.3, 0.35, 0.7, 0, 1, -3.1, COLORS.black),
    e.box(0.4, 0.25, 0.1, 1.2, 1.1, -3.48, COLORS.red, { flat: !0 }),
    e.box(0.4, 0.25, 0.1, -1.2, 1.1, -3.48, COLORS.red, { flat: !0 }),
    {
      geo: e.build(),
      wheels: [
        { x: 1.55, y: 0.78, z: 2.05, r: 0.78, w: 0.55, front: !0 },
        { x: -1.55, y: 0.78, z: 2.05, r: 0.78, w: 0.55, front: !0 },
        { x: 1.55, y: 0.78, z: -1.3, r: 0.78, w: 0.6 },
        { x: -1.55, y: 0.78, z: -1.3, r: 0.78, w: 0.6 },
        { x: 1.55, y: 0.78, z: -2.5, r: 0.78, w: 0.6 },
        { x: -1.55, y: 0.78, z: -2.5, r: 0.78, w: 0.6 },
      ],
    }
  );
}
function bullramModel() {
  let e = new ModelBuilder();
  for (let t of [-1.3, 1.3]) {
    e.box(0.95, 1.1, 4.5, t, 0.6, -0.3, COLORS.black, { bevel: 0.25 });
    for (let n = 0; n < 7; n++) e.box(1, 0.18, 0.28, t, 1.17, -2.3 + n * 0.66, 3816512, { flat: !0, bevel: 0.02 });
  }
  return (
    e.box(2.1, 1.3, 3.6, 0, 1.75, -0.4, COLORS.yellow, { studs: !0 }),
    e.box(1.9, 1.5, 1.7, 0, 3.15, -0.9, COLORS.yellow, { bevel: 0.05 }),
    e.box(1.7, 0.9, 1.75, 0, 3.2, -0.9, COLORS.glass, { flat: !0 }),
    e.box(2, 0.25, 1.9, 0, 4, -0.9, COLORS.black, { studs: !0 }),
    e.cyl(0.13, 0.15, 1.4, 6, 0.7, 3, 0.8, COLORS.darkGrey),
    e.box(0.3, 0.3, 1.8, 0.95, 1.7, 1.9, COLORS.darkGrey),
    e.box(0.3, 0.3, 1.8, -0.95, 1.7, 1.9, COLORS.darkGrey),
    hazardStripes(e, 3.7, 1.9, 0.45, 0, 1.25, 2.85, 7),
    e.box(3.8, 0.3, 0.7, 0, 0.3, 3, COLORS.steel, { bevel: 0.05 }),
    e.box(0.5, 0.3, 0.1, 0.6, 2.2, 0.95, 16774864, { flat: !0 }),
    e.box(0.5, 0.3, 0.1, -0.6, 2.2, 0.95, 16774864, { flat: !0 }),
    e.box(0.8, 0.4, 0.5, 0, 2.55, -2.3, COLORS.red, { flat: !0 }),
    { geo: e.build(), wheels: [] }
  );
}
function arbalestModel() {
  let e = new ModelBuilder();
  (e.box(0.55, 0.5, 2, 0, 0.95, 0, COLORS.darkGrey),
    e.box(0.8, 0.6, 1.1, 0, 1.3, 0.55, COLORS.red, { studs: !0 }),
    e.box(0.6, 0.4, 0.9, 0, 1.25, -0.5, COLORS.black),
    e.box(0.9, 0.12, 0.12, 0, 1.75, 0.95, COLORS.lightGrey, { flat: !0 }),
    e.box(0.5, 0.35, 0.1, 0, 1.55, 1.13, COLORS.glass, { flat: !0 }),
    e.cyl(0.08, 0.08, 1, 6, 0, 1.2, 1, COLORS.lightGrey, { rot: [0.5, 0, 0] }),
    e.cyl(0.08, 0.08, 1, 6, 0, 1.2, -1, COLORS.lightGrey, { rot: [-0.5, 0, 0] }));
  for (let t of [-0.72, 0.72]) {
    e.box(0.42, 0.42, 1.5, t, 1.05, -0.2, COLORS.steel, { studs: !0 });
    for (let n of [-0.1, 0.1])
      (e.cyl(0.08, 0.08, 1, 6, t, 1.05 + n, 0.2, COLORS.white, { rot: [Math.PI / 2, 0, 0] }),
        e.cyl(0, 0.08, 0.2, 6, t, 1.05 + n, 0.8, COLORS.red, { rot: [Math.PI / 2, 0, 0] }));
  }
  return (
    addMinifig(e, 0, 1.2, -0.25, !0),
    {
      geo: e.build(),
      wheels: [
        { x: 0, y: 0.48, z: 1.05, r: 0.48, w: 0.32, front: !0 },
        { x: 0, y: 0.48, z: -1.05, r: 0.48, w: 0.38 },
      ],
    }
  );
}
function patrolModel() {
  let e = new ModelBuilder();
  return (
    e.box(2, 0.65, 4.5, 0, 0.72, 0, COLORS.black),
    e.box(2.02, 0.35, 2.4, 0, 1.2, 0.1, COLORS.white),
    e.box(1.8, 0.7, 2.3, 0, 1.55, -0.25, COLORS.white, { studs: !0 }),
    e.box(1.82, 0.5, 2, 0, 1.55, -0.25, COLORS.glass, { flat: !0 }),
    e.box(1.2, 0.18, 0.5, 0, 1.99, -0.25, COLORS.darkGrey, { flat: !0 }),
    e.box(0.5, 0.25, 0.1, 0.65, 0.85, 2.26, 16774864, { flat: !0 }),
    e.box(0.5, 0.25, 0.1, -0.65, 0.85, 2.26, 16774864, { flat: !0 }),
    e.box(0.5, 0.2, 0.1, 0.65, 0.85, -2.26, COLORS.red, { flat: !0 }),
    e.box(0.5, 0.2, 0.1, -0.65, 0.85, -2.26, COLORS.red, { flat: !0 }),
    e.box(1.9, 0.3, 0.35, 0, 0.55, 2.3, COLORS.darkGrey),
    {
      geo: e.build(),
      wheels: [
        { x: 0.95, y: 0.45, z: 1.4, r: 0.45, w: 0.35, front: !0 },
        { x: -0.95, y: 0.45, z: 1.4, r: 0.45, w: 0.35, front: !0 },
        { x: 0.95, y: 0.45, z: -1.4, r: 0.45, w: 0.35 },
        { x: -0.95, y: 0.45, z: -1.4, r: 0.45, w: 0.35 },
      ],
      lightbar: { y: 2.12, z: -0.25 },
    }
  );
}
function stomperModel() {
  let e = new ModelBuilder();
  (e.box(2.4, 1.9, 1.9, 0, 1.45, 0, COLORS.yellow, { studs: !0 }),
    e.box(2, 0.5, 1.7, 0, 0.3, 0, COLORS.darkGrey),
    e.box(1.5, 0.8, 0.2, 0, 1.75, 0.98, COLORS.glass, { flat: !0 }),
    e.box(1.7, 0.25, 0.2, 0, 2.25, 0.98, COLORS.black, { flat: !0 }),
    hazardStripes(e, 2.4, 0.3, 0.2, 0, 0.72, 0.98, 6));
  for (let t of [-1.5, 1.5])
    (e.box(0.6, 1.4, 0.8, t, 1.3, 0, COLORS.darkGrey), e.box(0.7, 0.6, 0.9, t, 0.45, 0.1, COLORS.yellow));
  for (let t of [-0.6, 0.6])
    (e.cyl(0.42, 0.42, 1.9, 8, t, 1.4, -1.25, COLORS.lightGrey, { capBot: !0 }),
      e.cyl(0.46, 0.3, 0.4, 8, t, 0.25, -1.25, COLORS.darkGrey, { capBot: !0 }));
  e.box(1.9, 0.4, 0.4, 0, 2.2, -1, COLORS.red, { studs: !0 });
  let t = new ModelBuilder();
  return (
    t.box(0.7, 1.2, 0.8, 0, -0.6, 0, COLORS.darkGrey),
    t.box(0.8, 1, 0.9, 0, -1.6, 0.05, COLORS.yellow),
    t.box(1, 0.35, 1.5, 0, -2.2, 0.2, COLORS.black),
    { torso: e.build(), leg: t.build() }
  );
}
function carrierTractorModel() {
  let e = new ModelBuilder();
  (e.box(4.6, 1, 7.3, 0, 1.4, 0, COLORS.darkGrey),
    e.box(4.8, 3, 3.4, 0, 3.4, 1.6, COLORS.red, { studs: !0 }),
    e.box(4.4, 1.2, 0.15, 0, 3.9, 3.33, COLORS.glass, { flat: !0 }),
    e.box(0.15, 1.1, 2.4, 2.41, 3.9, 1.6, COLORS.glass, { flat: !0 }),
    e.box(0.15, 1.1, 2.4, -2.41, 3.9, 1.6, COLORS.glass, { flat: !0 }),
    e.box(4.2, 1.1, 0.4, 0, 2.2, 3.5, COLORS.silver));
  for (let t = 0; t < 6; t++) e.box(0.5, 0.9, 0.1, -1.6 + t * 0.64, 2.2, 3.72, COLORS.darkGrey, { flat: !0 });
  (e.box(0.6, 0.4, 0.12, 1.7, 2.1, 3.72, 16774864, { flat: !0 }),
    e.box(0.6, 0.4, 0.12, -1.7, 2.1, 3.72, 16774864, { flat: !0 }));
  for (let t of [-2, 2]) e.cyl(0.2, 0.2, 3.4, 8, t, 4.6, -0.4, COLORS.silver);
  (e.box(4.6, 0.5, 2.6, 0, 2.2, -2.2, COLORS.black), hazardStripes(e, 4.8, 0.5, 0.4, 0, 1.2, 3.75, 8));
  let t = new ModelBuilder();
  (t.box(4.8, 1, 14, 0, 1.6, 0, COLORS.darkGrey),
    hazardStripes(t, 0.3, 0.6, 14, 2.45, 1.6, 0, 14, COLORS.yellow, COLORS.black, `z`),
    hazardStripes(t, 0.3, 0.6, 14, -2.45, 1.6, 0, 14, COLORS.yellow, COLORS.black, `z`));
  for (let e of [-4, 0, 4]) t.box(3.4, 1, 0.8, 0, 2.5, e, COLORS.steel, { studs: !0 });
  (t.cyl(1.1, 1.1, 10.5, 12, 0, 3.9, 0.3, COLORS.white, { rot: [Math.PI / 2, 0, 0], capBot: !0 }),
    t.cyl(0, 1.1, 2.6, 12, 0, 3.9, 6.85, COLORS.red, { rot: [Math.PI / 2, 0, 0] }));
  for (let e of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    t.box(0.15, 1.3, 1.6, Math.cos(e) * 1.3, 3.9 + Math.sin(e) * 1.3, -4.3, COLORS.red, { rot: [0, 0, e] });
  return (
    t.box(2.3, 0.35, 0.1, 0, 3.9, -4.96, COLORS.darkGrey, { flat: !0 }),
    hazardStripes(t, 2.2, 0.5, 0.12, 0, 5.05, 2.3, 6, COLORS.yellow, COLORS.black),
    t.box(4.4, 0.8, 0.5, 0, 1.4, -7.1, COLORS.red),
    {
      tractor: e.build(),
      trailer: t.build(),
      tractorWheels: [
        [2.35, 1, 2.4],
        [-2.35, 1, 2.4],
        [2.35, 1, -1.2],
        [-2.35, 1, -1.2],
        [2.35, 1, -2.8],
        [-2.35, 1, -2.8],
      ],
      trailerWheels: [
        [2.35, 1, -3.6],
        [-2.35, 1, -3.6],
        [2.35, 1, -5.4],
        [-2.35, 1, -5.4],
      ],
    }
  );
}
function subwayModel() {
  let e = new ModelBuilder();
  (e.box(3, 0.6, 14, 0, 0.8, 0, COLORS.darkGrey),
    e.box(3, 2.6, 13.6, 0, 2.4, 0, COLORS.silver, { studs: !1 }),
    e.box(3.04, 0.35, 13.64, 0, 1.55, 0, COLORS.blue, { flat: !0 }),
    e.box(3.06, 0.8, 11.5, 0, 2.7, 0, COLORS.glass, { flat: !0 }));
  for (let t of [-4.5, 0, 4.5]) e.box(3.1, 2, 1.4, 0, 2.2, t, 4871523, { flat: !0 });
  e.box(2.6, 0.4, 12.5, 0, 3.9, 0, COLORS.lightGrey, { studs: !0 });
  for (let t of [6.85, -6.85])
    (e.box(2.2, 0.9, 0.12, 0, 2.9, t, COLORS.glass, { flat: !0 }),
      e.box(0.5, 0.3, 0.1, 0.8, 1.6, t * 1.005, t > 0 ? 16774864 : COLORS.red, { flat: !0 }),
      e.box(0.5, 0.3, 0.1, -0.8, 1.6, t * 1.005, t > 0 ? 16774864 : COLORS.red, { flat: !0 }));
  for (let t of [-5, -3.6, 3.6, 5])
    for (let n of [-0.8, 0.8])
      e.cyl(0.42, 0.42, 0.3, 10, n, 0.45, t, COLORS.black, { rot: [0, 0, Math.PI / 2], capBot: !0 });
  return e.build();
}
function addMinifig(e, t, n, r, i = !1, a = {}) {
  let o = { hat: COLORS.yellow, skin: 16172354, vest: COLORS.orange, pants: 2969482, ...a };
  i
    ? e.box(0.55, 0.3, 0.7, t, n + 0.15, r + 0.2, o.pants)
    : (e.box(0.24, 0.62, 0.3, t - 0.14, n + 0.31, r, o.pants), e.box(0.24, 0.62, 0.3, t + 0.14, n + 0.31, r, o.pants));
  let s = i ? n + 0.3 : n + 0.62;
  (e.box(0.62, 0.62, 0.34, t, s + 0.31, r, o.vest, { bevel: 0.04 }),
    e.box(0.16, 0.5, 0.2, t - 0.4, s + 0.35, r + (i ? 0.15 : 0), o.vest),
    e.box(0.16, 0.5, 0.2, t + 0.4, s + 0.35, r + (i ? 0.15 : 0), o.vest),
    e.cyl(0.19, 0.19, 0.36, 8, t, s + 0.8, r, o.skin),
    e.cyl(0.26, 0.3, 0.2, 8, t, s + 1.05, r, o.hat),
    e.cyl(0.1, 0.26, 0.12, 8, t, s + 1.2, r, o.hat),
    e.box(0.06, 0.06, 0.02, t - 0.08, s + 0.84, r + 0.19, COLORS.black, { flat: !0, bevel: 0 }),
    e.box(0.06, 0.06, 0.02, t + 0.08, s + 0.84, r + 0.19, COLORS.black, { flat: !0, bevel: 0 }));
}
function minifigModel(e = {}) {
  let t = { hat: COLORS.yellow, skin: 16172354, vest: COLORS.orange, pants: 2969482, hair: null, coat: null, ...e },
    n = new ModelBuilder();
  (n.box(0.62, 0.64, 0.34, 0, 0.94, 0, t.coat ?? t.vest, { bevel: 0.04 }),
    t.coat && n.box(0.2, 0.5, 0.02, 0, 0.98, 0.18, t.vest, { flat: !0 }),
    n.box(0.16, 0.52, 0.2, -0.4, 0.96, 0, t.coat ?? t.vest),
    n.box(0.16, 0.52, 0.2, 0.4, 0.96, 0, t.coat ?? t.vest),
    n.box(0.14, 0.14, 0.14, -0.4, 0.66, 0.03, t.skin),
    n.box(0.14, 0.14, 0.14, 0.4, 0.66, 0.03, t.skin),
    n.cyl(0.19, 0.19, 0.36, 8, 0, 1.44, 0, t.skin),
    t.hair
      ? n.cyl(0.22, 0.22, 0.14, 8, 0, 1.64, -0.02, t.hair)
      : (n.cyl(0.26, 0.3, 0.2, 8, 0, 1.7, 0, t.hat), n.cyl(0.1, 0.26, 0.12, 8, 0, 1.85, 0, t.hat)),
    n.box(0.06, 0.06, 0.02, -0.08, 1.48, 0.19, COLORS.black, { flat: !0, bevel: 0 }),
    n.box(0.06, 0.06, 0.02, 0.08, 1.48, 0.19, COLORS.black, { flat: !0, bevel: 0 }),
    n.box(0.46, 0.12, 0.3, 0, 0.6, 0, t.pants));
  let r = new ModelBuilder();
  return (
    r.box(0.24, 0.6, 0.3, 0, -0.3, 0, t.pants),
    r.box(0.26, 0.1, 0.36, 0, -0.58, 0.03, COLORS.black, { flat: !0 }),
    { body: n.build(), leg: r.build() }
  );
}
function commPointModel() {
  let e = new ModelBuilder();
  (e.box(2.4, 0.5, 2.4, 0, 0.25, 0, COLORS.darkGrey, { studs: !0 }),
    e.box(0.5, 3.2, 0.5, 0, 2.1, 0, COLORS.lightGrey),
    e.box(1.2, 0.6, 1.2, 0, 3.8, 0, COLORS.steel, { studs: !0 }));
  let t = new ModelBuilder();
  return (
    t.cyl(1.9, 0.4, 0.7, 12, 0, 0, 0, COLORS.white, { rot: [-Math.PI / 2 + 0.5, 0, 0], capTop: !1, capBot: !0 }),
    t.cyl(0.06, 0.06, 1.8, 5, 0, 0.35, 0.65, COLORS.darkGrey, { rot: [-Math.PI / 2 + 0.5, 0, 0] }),
    t.box(0.25, 0.25, 0.25, 0, 0.75, 1.35, COLORS.red),
    { base: e.build(), dish: t.build() }
  );
}
function treeModel() {
  let e = new ModelBuilder();
  return (
    e.box(0.8, 2.4, 0.8, 0, 1.2, 0, COLORS.brown),
    e.box(3.4, 1.2, 3.4, 0, 3, 0, 4168252, { studs: !0 }),
    e.box(2.6, 1.2, 2.6, 0, 4.2, 0, 4892740, { studs: !0 }),
    e.box(1.6, 1.2, 1.6, 0, 5.4, 0, 5748046, { studs: !0 }),
    e.build()
  );
}
function lampModel() {
  let e = new ModelBuilder();
  return (
    e.box(0.8, 0.4, 0.8, 0, 0.2, 0, COLORS.darkGrey),
    e.box(0.3, 5.2, 0.3, 0, 2.8, 0, COLORS.darkGrey),
    e.box(1.6, 0.3, 0.5, 0.6, 5.4, 0, COLORS.darkGrey),
    e.box(0.8, 0.2, 0.4, 1, 5.2, 0, 16773568, { flat: !0 }),
    e.build()
  );
}
function ammoCrateModel(e = COLORS.green, t = COLORS.red) {
  let n = new ModelBuilder();
  return (
    n.box(1.4, 1, 1, 0, 0.5, 0, e, { studs: !0 }),
    n.box(1.42, 0.25, 1.02, 0, 0.5, 0, t, { flat: !0 }),
    n.build()
  );
}
function tntModel() {
  let e = new ModelBuilder();
  return (
    e.box(1.6, 1.6, 1.6, 0, 0, 0, COLORS.red, { studs: !0 }),
    e.box(1.62, 0.3, 1.62, 0, 0.45, 0, COLORS.yellow, { flat: !0 }),
    e.box(1.62, 0.3, 1.62, 0, -0.45, 0, COLORS.yellow, { flat: !0 }),
    e.cyl(0.06, 0.06, 0.5, 5, 0.3, 1, 0.3, COLORS.darkGrey),
    e.build()
  );
}
function concreteBlockModel(e, t, n) {
  let r = new ModelBuilder();
  return (
    r.box(e, t, n, 0, 0, 0, COLORS.concrete, { studs: !0 }),
    hazardStripes(r, e + 0.02, 0.4, n + 0.02, 0, -t / 2 + 0.4, 0, 6),
    r.build()
  );
}
function parkedCarModel(e) {
  let t = new ModelBuilder();
  (t.box(1.9, 0.7, 4, 0, 0.75, 0, e),
    t.box(1.7, 0.7, 2, 0, 1.45, -0.2, e, { studs: !0 }),
    t.box(1.72, 0.45, 1.9, 0, 1.45, -0.2, COLORS.glass, { flat: !0 }));
  for (let [e, n] of [
    [0.9, 1.3],
    [-0.9, 1.3],
    [0.9, -1.3],
    [-0.9, -1.3],
  ])
    t.cyl(0.42, 0.42, 0.3, 10, e, 0.42, n, COLORS.black, { rot: [0, 0, Math.PI / 2], capBot: !0 });
  return t.build();
}
function chopperModel() {
  let e = new ModelBuilder();
  (e.box(2.4, 2.2, 4.4, 0, 0, 0, COLORS.yellow, { studs: !0 }),
    e.box(2, 1.2, 1.2, 0, 0.3, 2.5, COLORS.glass, { flat: !0 }),
    e.box(0.8, 0.8, 5.5, 0, 0.4, -4.6, COLORS.yellow),
    e.box(0.2, 1.6, 1, 0, 1, -7.1, COLORS.black),
    hazardStripes(e, 2.42, 0.4, 4.42, 0, -0.6, 0, 6));
  for (let t of [-1.2, 1.2]) e.box(0.2, 0.2, 3.5, t, -1.6, 0, COLORS.darkGrey, { flat: !0 });
  e.box(0.4, 0.8, 0.4, 0, 1.5, 0, COLORS.darkGrey);
  let t = new ModelBuilder();
  return (
    t.box(11, 0.12, 0.5, 0, 0, 0, COLORS.darkGrey, { flat: !0 }),
    t.box(0.5, 0.12, 11, 0, 0, 0, COLORS.darkGrey, { flat: !0 }),
    { body: e.build(), rotor: t.build() }
  );
}
function arrowModel() {
  let e = new ModelBuilder();
  return (
    e.cyl(0, 1.5, 2, 4, 0, 1, 0, 16777215, { rot: [Math.PI, Math.PI / 4, 0], flat: !0 }),
    e.box(0.9, 2.2, 0.9, 0, 3.1, 0, 16777215, { flat: !0, bevel: 0.08 }),
    e.build()
  );
}
var TRACTOR_HALF = { hx: 2.55, hz: 3.9 };
var TRAILER_HALF = { hx: 2.55, hz: 7.3 };
var CARRIER_START_S = 16;
var Carrier = class {
  constructor(e, t) {
    ((this.game = e),
      (this.route = t),
      (this.s = CARRIER_START_S),
      (this.speed = 3.4),
      (this.running = !1),
      (this.arrived = !1),
      (this.destroyed = !1));
    let n = vertexColorMaterial({ roughness: 0.35 }),
      r = carrierTractorModel(),
      i = (t, r) => {
        let i = new THREE.Group(),
          a = new THREE.Mesh(t, n);
        ((a.castShadow = !0), (a.receiveShadow = !0), i.add(a));
        let o = wheelGeometry(1, 0.9),
          s = [];
        for (let [e, t, a] of r) {
          let r = new THREE.Mesh(o, n);
          (r.position.set(e, t, a), (r.castShadow = !0), i.add(r), s.push(r));
        }
        return ((i.userData.wheels = s), e.scene.add(i), i);
      };
    ((this.tractor = i(r.tractor, r.tractorWheels)), (this.trailer = i(r.trailer, r.trailerWheels)));
    let a = emissiveMaterial(16751130, 6);
    this.beacons = [];
    for (let [e, t] of [
      [1.6, 0.2],
      [-1.6, 0.2],
    ]) {
      let n = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), a);
      (n.position.set(e, 5.2, t), this.tractor.add(n), this.beacons.push(n));
    }
    let o = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), emissiveMaterial(16719904, 6));
    (o.position.set(0, 5.4, 2.3), this.trailer.add(o), (this.warnLight = o));
    let s = (t) => {
      let n = e.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()),
        r = e.physics.world.createCollider(
          RAPIER.ColliderDesc.cuboid(t.hx, 2.3, t.hz)
            .setTranslation(0, 2.4, 0)
            .setCollisionGroups(groups(GROUP.CARRIER, GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.PROP))
            .setFriction(0.5),
          n,
        );
      return (e.physics.setOwner(r, { type: `carrier`, obj: this }), n);
    };
    ((this.tBody = s(TRACTOR_HALF)),
      (this.lBody = s(TRAILER_HALF)),
      (this.poses = { tr: { x: 0, z: 0, yaw: 0 }, tl: { x: 0, z: 0, yaw: 0 } }),
      this._pose(this.s, this.poses),
      this._applyBodies(!0),
      (this.prev = JSON.parse(JSON.stringify(this.poses))),
      (this.wheelSpin = 0),
      (this.loop = null),
      (this.beepT = 0));
  }
  _pose(e, t) {
    let n = this.route,
      r = n.sample(e);
    ((t.tr.x = r.x), (t.tr.z = r.z), (t.tr.yaw = r.yaw));
    let i = n.sample(e - 4.6),
      a = n.sample(e - 18);
    return ((t.tl.x = (i.x + a.x) / 2), (t.tl.z = (i.z + a.z) / 2), (t.tl.yaw = Math.atan2(i.x - a.x, i.z - a.z)), t);
  }
  _applyBodies(e = !1) {
    let t = this.poses,
      n = (t, n) => {
        let r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), n.yaw);
        e
          ? (t.setTranslation({ x: n.x, y: 0, z: n.z }, !0), t.setRotation({ x: r.x, y: r.y, z: r.z, w: r.w }, !0))
          : (t.setNextKinematicTranslation({ x: n.x, y: 0, z: n.z }),
            t.setNextKinematicRotation({ x: r.x, y: r.y, z: r.z, w: r.w }));
      };
    (n(this.tBody, t.tr), n(this.lBody, t.tl));
  }
  computeHits(e) {
    let t = { tr: {}, tl: {} };
    for (let t of e) ((t.sHit = 1 / 0), (t.inPath = !1));
    for (let n = CARRIER_START_S; n <= this.route.length; n += 0.25) {
      this._pose(n, t);
      for (let r of e)
        r.sHit < 1 / 0 ||
          r.area !== `surface` ||
          r.kind === `door` ||
          ((obbHitsAabb(t.tr.x, t.tr.z, TRACTOR_HALF.hx, TRACTOR_HALF.hz, t.tr.yaw, r.aabb, 0.2) ||
            obbHitsAabb(t.tl.x, t.tl.z, TRAILER_HALF.hx, TRAILER_HALF.hz, t.tl.yaw, r.aabb, 0.2)) &&
            ((r.sHit = n), (r.inPath = !0)));
    }
    this.pathBuildings = e.filter((e) => e.inPath).sort((e, t) => e.sHit - t.sHit);
  }
  reset(e) {
    ((this.s = CARRIER_START_S),
      (this.speed = e),
      (this.running = !1),
      (this.arrived = !1),
      (this.destroyed = !1),
      this._pose(this.s, this.poses),
      this._applyBodies(!0),
      (this.prev = JSON.parse(JSON.stringify(this.poses))),
      (this.tractor.visible = this.trailer.visible = !0));
  }
  nextObstacle() {
    let e = null;
    for (let t of this.pathBuildings) {
      if (t.collapsed) continue;
      let n = t.sHit - this.s;
      (!e || n < e.dist) && (e = { b: t, dist: n, ttc: n / Math.max(0.1, this.speed) });
    }
    return e;
  }
  ttcOf(e) {
    return (e.sHit - this.s) / Math.max(0.1, this.speed);
  }
  fixedUpdate(e) {
    if (
      ((this.prev.tr = { ...this.poses.tr }),
      (this.prev.tl = { ...this.poses.tl }),
      this.running && !this.arrived && !this.destroyed)
    ) {
      ((this.s = Math.min(this.route.length - 1, this.s + this.speed * e)),
        this._pose(this.s, this.poses),
        this._applyBodies(),
        (this.wheelSpin += this.speed * e));
      for (let e of this.pathBuildings)
        if (!e.collapsed && this.s >= e.sHit) {
          ((this.destroyed = !0), (this.running = !1), this.game.onCarrierCrash(e));
          return;
        }
      this.s >= this.route.length - 1.01 && ((this.arrived = !0), (this.running = !1), this.game.onCarrierArrived());
    }
    let t = this.game;
    !this.destroyed && t.activeArea === `surface` && t.state === `play`
      ? ((!this.loop || !this.loop.alive) && (this.loop = t.audio.loop(`carrier_engine`, { vol: 1 })),
        (this.loop.pos = { x: this.poses.tr.x, y: 2, z: this.poses.tr.z }),
        (this.loop.vol = this.running ? 1 : 0.4),
        (this.loop.rate = this.running ? 1 : 0.7))
      : (this.loop &&= (this.loop.stop(), null));
    let n = this.running ? this.nextObstacle() : null;
    ((this.warnLevel = n ? (n.ttc < 6 ? 3 : n.ttc < 14 ? 2 : +(n.ttc < 25)) : 0),
      this.warnLevel >= 2 &&
        t.state === `play` &&
        ((this.beepT -= e),
        this.beepT <= 0 &&
          (t.audio.play(`carrier_beep`, { pos: { x: this.poses.tr.x, y: 2, z: this.poses.tr.z }, vol: 1.2 }),
          (this.beepT = this.warnLevel === 3 ? 0.35 : 0.9))));
  }
  render(e, t) {
    let n = (t, n, r) => {
      let i = n.yaw - t.yaw;
      for (; i > Math.PI; ) i -= Math.PI * 2;
      for (; i < -Math.PI; ) i += Math.PI * 2;
      (r.position.set(t.x + (n.x - t.x) * e, 0, t.z + (n.z - t.z) * e), r.rotation.set(0, t.yaw + i * e, 0));
    };
    (n(this.prev.tr, this.poses.tr, this.tractor), n(this.prev.tl, this.poses.tl, this.trailer));
    for (let e of [this.tractor, this.trailer]) for (let t of e.userData.wheels) t.rotation.x = this.wheelSpin;
    for (let e = 0; e < this.beacons.length; e++)
      this.beacons[e].scale.setScalar(0.8 + 0.4 * Math.max(0, Math.sin(t * 9 + e * Math.PI)));
    let r = [2, 4, 7, 12][this.warnLevel || 0];
    this.warnLight.visible = Math.sin(t * r * Math.PI) > 0;
  }
  get position() {
    return { x: this.poses.tr.x, y: 0, z: this.poses.tr.z };
  }
  get yaw() {
    return this.poses.tr.yaw;
  }
};
var VEHICLE_SPECS = {
  swingback: {
    id: `swingback`,
    name: `SWINGBACK`,
    source: `Backlash`,
    blurb: `Dump truck. Its armoured rear is the weapon — hold ACTION to power-slide and swing the tailgate into buildings.`,
    hx: 1.55,
    hy: 0.95,
    hz: 3.3,
    clearance: 0.5,
    mass: 9e3,
    maxSpeed: 21,
    maxReverse: 8,
    accel: 13,
    brake: 26,
    coast: 0.35,
    grip: 9,
    slideGrip: 0.85,
    turn: 1.8,
    slideTurn: 2.75,
    turnResp: 9,
    slideResp: 4.2,
    handbrake: !0,
    dmg: { front: 0.8, side: 1.3, rear: 6, sideSlide: 3.8 },
    engine: `engine_heavy`,
    pitch: [0.7, 1.8],
    model: swingbackModel,
  },
  bullram: {
    id: `bullram`,
    name: `BULLRAM`,
    source: `Ramdozer`,
    blurb: `Bulldozer. Ram with the blade, turn on the spot, shove TNT. ACTION = ram boost.`,
    hx: 1.8,
    hy: 1,
    hz: 3.1,
    clearance: 0.25,
    mass: 14e3,
    maxSpeed: 11.5,
    maxReverse: 7,
    accel: 11,
    brake: 30,
    coast: 1.2,
    grip: 16,
    turn: 1.8,
    turnInPlace: !0,
    turnResp: 12,
    boost: { speed: 18, time: 0.9, cooldown: 2 },
    dmg: { front: 3.9, side: 0.5, rear: 0.5 },
    engine: `engine_heavy`,
    pitch: [0.55, 1.45],
    model: bullramModel,
  },
  arbalest: {
    id: `arbalest`,
    name: `ARBALEST`,
    source: `Ballista`,
    blurb: `Missile bike. ACTION fires (hold for rapid fire). Grab green ammo crates.`,
    hx: 0.55,
    hy: 0.7,
    hz: 1.55,
    clearance: 0.3,
    mass: 700,
    maxSpeed: 25,
    maxReverse: 6,
    accel: 17,
    brake: 32,
    coast: 0.3,
    grip: 10,
    turn: 2.8,
    turnResp: 10,
    dmg: { front: 0.25, side: 0.25, rear: 0.25 },
    engine: `engine_bike`,
    pitch: [0.8, 2.2],
    missiles: !0,
    model: arbalestModel,
  },
  patrol: {
    id: `patrol`,
    name: `PATROL CAR`,
    source: `Police Car`,
    blurb: `Fast and grippy. ACTION = horn, ALT = siren.`,
    hx: 1,
    hy: 0.62,
    hz: 2.3,
    clearance: 0.22,
    mass: 1500,
    maxSpeed: 28,
    maxReverse: 9,
    accel: 16,
    brake: 34,
    coast: 0.3,
    grip: 12,
    turn: 2.3,
    turnResp: 11,
    dmg: { front: 0.3, side: 0.3, rear: 0.3 },
    engine: `engine_light`,
    pitch: [0.7, 2],
    siren: !0,
    model: patrolModel,
  },
};
var SUSPENSION_K = 80;
var SUSPENSION_D = 11;
var VEHICLE_GRAVITY = 2;
new THREE.Vector3();
var _vQuat = new THREE.Quaternion();
new THREE.Euler();
var _vUp = new THREE.Vector3(0, 1, 0);
var wheelGeoCache = new Map();
var wheelGeo = (e, t) => {
  let n = e + `:` + t;
  return (wheelGeoCache.has(n) || wheelGeoCache.set(n, wheelGeometry(e, t)), wheelGeoCache.get(n));
};
var Vehicle = class e {
  constructor(e, t, n) {
    ((this.game = e),
      (this.spec = t),
      (this.id = t.id),
      (this.name = t.name),
      (this.driver = null),
      (this.spawn = { ...n }),
      (this.area = n.y < -3 ? `underground` : `surface`),
      (this.restDist = t.hy + t.clearance + (9.81 * VEHICLE_GRAVITY) / SUSPENSION_K));
    let r = e.physics,
      i = n.y + t.hy + t.clearance + 0.05;
    _vQuat.setFromAxisAngle(_vUp, n.yaw);
    let a = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(n.x, i, n.z)
      .setRotation({ x: _vQuat.x, y: _vQuat.y, z: _vQuat.z, w: _vQuat.w })
      .enabledRotations(!1, !0, !1)
      .setLinearDamping(0.02)
      .setAngularDamping(0.3)
      .setCcdEnabled(!0)
      .setCanSleep(!1)
      .setGravityScale(VEHICLE_GRAVITY);
    this.body = r.world.createRigidBody(a);
    let o = Math.min(0.25, t.hy * 0.4),
      s = 8 * t.hx * t.hy * t.hz,
      c = RAPIER.ColliderDesc.roundCuboid(t.hx - o, t.hy - o, t.hz - o, o)
        .setDensity(t.mass / s)
        .setFriction(0.15)
        .setRestitution(0.2)
        .setCollisionGroups(
          groups(
            GROUP.VEHICLE,
            GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.PROP | GROUP.CARRIER,
          ),
        );
    ((this.collider = r.world.createCollider(c, this.body)),
      r.setOwner(this.collider, { type: `vehicle`, obj: this }),
      (this.rayGroups = groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.BUILDING)),
      (this.group = new THREE.Group()),
      (this.group.name = t.name),
      (this.visual = new THREE.Group()),
      this.group.add(this.visual));
    let l = t.model();
    this.mat = vertexColorMaterial({ roughness: 0.4 });
    let u = new THREE.Mesh(l.geo, this.mat);
    ((u.castShadow = !0),
      (u.receiveShadow = !0),
      this.visual.add(u),
      (this.visual.position.y = -(t.hy + t.clearance)),
      (this.wheels = []));
    for (let e of l.wheels || []) {
      let t = new THREE.Group();
      t.position.set(e.x, e.y, e.z);
      let n = new THREE.Mesh(wheelGeo(e.r, e.w), this.mat);
      ((n.castShadow = !0),
        t.add(n),
        this.visual.add(t),
        this.wheels.push({ piv: t, mesh: n, r: e.r, front: !!e.front }));
    }
    (l.lightbar &&
      ((this.lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), emissiveMaterial(16719904, 5))),
      (this.lightB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), emissiveMaterial(2117887, 5))),
      this.lightR.position.set(-0.35, l.lightbar.y, l.lightbar.z),
      this.lightB.position.set(0.35, l.lightbar.y, l.lightbar.z),
      this.visual.add(this.lightR, this.lightB)),
      e.scene.add(this.group),
      (this.rec = r.track(this.body, this.group)),
      (this.yaw = n.yaw),
      (this.vf = 0),
      (this.vs = 0),
      (this.wy = 0),
      (this.grounded = !1),
      (this.airTime = 0),
      (this.pitch = 0),
      (this.roll = 0),
      (this.lean = 0),
      (this.squat = 0),
      (this.wheelSpin = 0),
      (this.steerVis = 0),
      (this.sliding = !1),
      (this.boostT = 0),
      (this.boostCd = 0),
      (this.cool = new Map()),
      (this.preV = new THREE.Vector3()),
      (this.preW = 0),
      (this.preAir = !1),
      (this.skidAcc = 0),
      (this.speed = 0),
      (this.sirenOn = !1),
      (this.hits = []),
      (this.meter = null));
  }
  get pos() {
    return this.body.translation();
  }
  get radius() {
    return Math.max(this.spec.hx, this.spec.hz);
  }
  _readYaw() {
    let e = this.body.rotation();
    this.yaw = 2 * Math.atan2(e.y, e.w);
  }
  static pointToGo(e, t, n, r) {
    if (t.mag < 0.12) return { throttle: 0, steer: 0 };
    let i = Math.sin(n),
      a = Math.cos(n),
      o = -Math.cos(n),
      s = Math.sin(n),
      c = i * t.y + o * t.x,
      l = a * t.y + s * t.x,
      u = wrapAngle(Math.atan2(c, l) - e.yaw),
      d = Math.abs(u) > 2.4 && e.vf < 4,
      f,
      p;
    return (
      d
        ? ((f = clamp(wrapAngle(u + Math.PI) * 2.2, -1, 1)), (p = -t.mag))
        : ((f = clamp(-u * 2.4, -1, 1)),
          (p = t.mag * (r ? clamp(1 - Math.abs(u) / 1.4, 0, 1) : clamp(1.15 - Math.abs(u) / 2.8, 0.35, 1)))),
      { throttle: p, steer: f }
    );
  }
  fixedUpdate(t, n) {
    let r = this.spec,
      i = this.body;
    this._readYaw();
    let a = i.translation(),
      o = i.linvel();
    if (
      ((this.area = a.y < -3 ? `underground` : `surface`),
      this.preV.set(o.x, o.y, o.z),
      (this.preW = i.angvel().y),
      a.y < -45 && this.spawn)
    ) {
      this.teleport(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.yaw);
      return;
    }
    this.preAir = !this.grounded;
    let s = Math.cos(this.yaw),
      c = Math.sin(this.yaw),
      l = [
        [r.hx * 0.8, r.hz * 0.75],
        [-r.hx * 0.8, r.hz * 0.75],
        [r.hx * 0.8, -r.hz * 0.75],
        [-r.hx * 0.8, -r.hz * 0.75],
      ],
      u = 0,
      d = 0,
      f = [];
    for (let [e, t] of l) {
      let n = a.x + e * s + t * c,
        r = a.z - e * c + t * s,
        o = this.game.physics.castRayDown(n, a.y, r, this.restDist + 0.7, this.rayGroups, i);
      if (o) {
        let e = o.timeOfImpact;
        (f.push(e), e < this.restDist + 0.15 && (u++, (d += Math.max(0, this.restDist - e))));
      } else f.push(this.restDist + 0.7);
    }
    let p = this.grounded;
    this.grounded = u >= 2;
    let m = o.y;
    if (u > 0) {
      let e = (d / u) * SUSPENSION_K - SUSPENSION_D * m;
      ((e = Math.max(e, -5)), (m += e * t), m > 12 && (m = 12));
    }
    (this.grounded && !p && this.airTime > 0.35 && this.onLand(-o.y),
      (this.airTime = this.grounded ? 0 : this.airTime + t));
    let h = (f[0] + f[1]) / 2,
      g = (f[2] + f[3]) / 2,
      _ = (f[1] + f[3]) / 2,
      v = (f[0] + f[2]) / 2,
      y = this.grounded ? clamp(Math.atan2(h - g, r.hz * 1.5), -0.5, 0.5) : clamp(-o.y * 0.02, -0.35, 0.35),
      b = this.grounded ? clamp(Math.atan2(_ - v, r.hx * 1.6), -0.4, 0.4) : 0;
    ((this.pitch = damp(this.pitch, y, 10, t)), (this.roll = damp(this.roll, b, 10, t)));
    let x = c,
      ee = s,
      te = s,
      ne = -c,
      S = o.x * x + o.z * ee,
      re = o.x * te + o.z * ne,
      ie = i.angvel().y,
      ae = 0,
      oe = 0,
      se = !1;
    if (n) {
      if (n.pointGo) {
        let t = e.pointToGo(this, n.stick, n.camYaw, r.turnInPlace);
        ((ae = t.throttle), (oe = t.steer));
      } else ((ae = n.throttle), (oe = n.steer));
      ((se = !!(r.handbrake && n.action)), this.handleAction(t, n));
    }
    ((this.boostT = Math.max(0, this.boostT - t)), (this.boostCd = Math.max(0, this.boostCd - t)));
    let ce = this.boostT > 0 ? r.boost.speed : r.maxSpeed;
    if (this.grounded) {
      n
        ? (this.boostT > 0
            ? (S = Math.min(ce, S + r.accel * 3 * t))
            : ae > 0.05
              ? S < -0.5
                ? (S = Math.min(0, S + r.brake * t))
                : S < ce * ae
                  ? (S = Math.min(ce * ae, S + r.accel * t * (1 - (0.55 * Math.max(0, S)) / ce)))
                  : (S *= Math.exp(-r.coast * t))
              : ae < -0.05
                ? (S = S > 0.5 ? Math.max(0, S - r.brake * t) : Math.max(-r.maxReverse * -ae, S - r.accel * 0.7 * t))
                : ((S *= Math.exp(-r.coast * t)), Math.abs(S) < 0.25 && (S = 0)),
          se && (S *= Math.exp(-0.45 * t)))
        : ((S *= Math.exp(-6 * t)), Math.abs(S) < 0.2 && (S = 0));
      let e = n ? (se ? r.slideGrip : r.grip) : 14;
      re *= Math.exp(-e * t);
      let i = 0;
      if (r.turnInPlace) {
        let e = S < -0.3 ? -1 : 1;
        i = -oe * r.turn * e;
      } else {
        let e = clamp(Math.abs(S) / 5, 0, 1) * (1 - 0.3 * clamp(Math.abs(S) / r.maxSpeed, 0, 1));
        ((i = -oe * r.turn * e * Math.sign(S || 1)),
          se && (i = -oe * r.slideTurn * clamp(Math.abs(S) / 4, 0.3, 1) * Math.sign(S || 1)));
      }
      let a = se ? r.slideResp : r.turnResp;
      ((ie = damp(ie, n ? i : 0, a, t)), (this.sliding = Math.abs(re) > 3.2 && Math.abs(S) + Math.abs(re) > 6));
    } else ((ie = damp(ie, -oe * 1.2, 2, t)), (this.sliding = !1));
    let le = x * S + te * re,
      ue = ee * S + ne * re;
    if (
      (i.setLinvel({ x: le, y: m, z: ue }, !0),
      i.setAngvel({ x: 0, y: ie, z: 0 }, !0),
      (this.vf = S),
      (this.vs = re),
      (this.wy = ie),
      (this.speed = Math.hypot(le, ue)),
      (this.steerVis = damp(this.steerVis, oe * 0.45, 12, t)),
      (this.lean = damp(this.lean, clamp(-ie * S * 0.012, -0.12, 0.12), 8, t)),
      (this.squat = damp(this.squat, clamp(ae * 0.04 * !!this.grounded, -0.05, 0.05), 6, t)),
      this.grounded &&
        n &&
        (this.sliding || (Math.abs(ae) > 0.5 && Math.abs(S) < 4 && this.speed > 0.5)) &&
        ((this.skidAcc += this.speed * t), this.skidAcc > 0.6))
    ) {
      this.skidAcc = 0;
      let e = a.y - Math.min(f[2], f[3]);
      for (let t of [-1, 1]) {
        let n = r.hx * 0.8 * t,
          i = -r.hz * 0.6,
          l = a.x + n * s + i * c,
          u = a.z - n * c + i * s;
        (this.game.fx.skidMark(l, u, Math.atan2(o.x, o.z), 0.9, r.hx > 1 ? 0.6 : 0.3, e + 0.065),
          rng() < 0.5 && this.game.fx.dust(l, e + 0.25, u, 1, 0.9, 13682354));
      }
    }
  }
  handleAction(e, t) {
    let n = this.spec;
    (n.boost &&
      t.actionPressed &&
      this.boostCd <= 0 &&
      this.grounded &&
      ((this.boostT = n.boost.time),
      (this.boostCd = n.boost.cooldown),
      this.game.audio.play(`boost`, { pos: this.pos }),
      this.game.fx.shake(0.12)),
      n.boost && (this.meter = { v: 1 - this.boostCd / n.boost.cooldown, label: `RAM BOOST` }),
      n.missiles &&
        ((this.fireCd = Math.max(0, (this.fireCd || 0) - e)),
        (t.actionPressed || (t.action && this.fireCd <= 0 && this._firedOnce)) && this.fireCd <= 0 && this.fire(),
        t.action || (this._firedOnce = !1),
        (this.meter = { v: Math.min(1, (this.ammo || 0) / 12), label: `MISSILES ` + (this.ammo || 0) })),
      n.siren &&
        (t.altPressed && (this.sirenOn = !this.sirenOn),
        t.actionPressed && this.game.audio.play(`horn`, { pos: this.pos })));
  }
  fire() {
    if ((this.ammo || 0) <= 0) {
      (!this._dryT || this.game.time - this._dryT > 0.6) &&
        (this.game.audio.play(`ui_back`, { vol: 0.8 }),
        this.game.ui.toast(`OUT OF MISSILES — find green ammo crates`),
        (this._dryT = this.game.time));
      return;
    }
    (this.ammo--, (this.fireCd = 0.22), (this._firedOnce = !0));
    let e = this.pos,
      t = (this._side = -(this._side || 1)),
      n = Math.sin(this.yaw),
      r = Math.cos(this.yaw),
      i = Math.cos(this.yaw) * 0.72 * t,
      a = -Math.sin(this.yaw) * 0.72 * t;
    this.game.weapons.fireMissile(
      { x: e.x + i + n * 1.2, y: e.y + 0.4, z: e.z + a + r * 1.2 },
      { x: n, y: 0, z: r },
      this,
    );
  }
  onLand(e) {
    if (e > 5) {
      this.game.audio.play(`land`, { pos: this.pos, vol: clamp(e / 14, 0.3, 1) });
      let t = this.pos;
      (this.game.fx.dust(t.x, t.y - this.restDist + 0.3, t.z, 5, 1.6),
        this.driver && this.game.fx.shake(clamp(e / 40, 0.05, 0.3)));
    }
  }
  postStep(e) {
    let t = this.game,
      n = t.physics,
      r = n.world,
      i = t.time,
      a = this.body.translation();
    r.contactPairsWith(this.collider, (e) => {
      let t = n.ownerOf(e.handle);
      if (!t) return;
      if (t.type === `tnt`) {
        t.obj.touch(this);
        return;
      }
      if (t.type !== `building`) return;
      let o = t.b;
      o.collapsed ||
        (this.cool.get(o) || 0) > i ||
        r.contactPair(this.collider, e, (e) => {
          let t = e.numSolverContacts();
          if (!t) return;
          let n = 0,
            r = 0,
            s = 0;
          for (let i = 0; i < t; i++) {
            let t = e.solverContactPoint(i);
            ((n += t.x), (r += t.y), (s += t.z));
          }
          ((n /= t), (r /= t), (s /= t));
          let c = e.normal(),
            l = c.x,
            u = c.y,
            d = c.z;
          ((a.x - n) * l + (a.y - r) * u + (a.z - s) * d < 0 && ((l = -l), (u = -u), (d = -d)),
            this.onBuildingContact(o, { x: n, y: r, z: s }, { x: l, y: u, z: d }, i));
        });
    });
  }
  onBuildingContact(e, t, n, r) {
    let i = this.spec,
      a = this.body.translation(),
      o = t.x - a.x,
      s = t.z - a.z,
      c = this.preW,
      l = this.preV.x + c * s,
      u = this.preV.z - c * o,
      d = this.preV.y,
      f = -(l * n.x + d * n.y + u * n.z);
    if (f < 3.2) return;
    let p = Math.cos(this.yaw),
      m = o * Math.sin(this.yaw) + s * p,
      h = `side`;
    m > i.hz * 0.35 ? (h = `front`) : m < -i.hz * 0.25 && (h = `rear`);
    let g = i.dmg[h];
    (h === `side` && i.dmg.sideSlide && (this.sliding || Math.abs(c) > 1.3) && (g = i.dmg.sideSlide),
      this.boostT > 0 && h === `front` && (g *= 1.25));
    let _ = g * Math.max(0, f - 2.2) ** 1.12;
    this.preAir && (_ *= 1.45);
    let v = h === `front` && i.id === `bullram` ? `ram` : this.sliding ? `slide` : `ram`;
    this.cool.set(e, r + 0.3);
    let y = { x: -n.x, z: -n.z },
      b = e.sys.damage(e, _, t, v, y, this);
    this.game.onVehicleImpact(this, e, b.applied, f, t, h);
  }
  render(e, t) {
    (this.visual.rotation.set(this.pitch + this.squat, 0, this.roll + this.lean),
      (this.wheelSpin += (this.vf * t) / 0.6));
    for (let e of this.wheels)
      ((e.mesh.rotation.x = this.wheelSpin * (0.6 / e.r)), e.front && (e.piv.rotation.y = this.steerVis));
    if (this.lightR) {
      let e = this.sirenOn && Math.sin(this.game.time * 14) > 0;
      ((this.lightR.visible = !this.sirenOn || e), (this.lightB.visible = !this.sirenOn || !e));
    }
  }
  teleport(e, t, n, r) {
    (_vQuat.setFromAxisAngle(_vUp, r),
      this.body.setTranslation({ x: e, y: t + this.spec.hy + this.spec.clearance + 0.1, z: n }, !0),
      this.body.setRotation({ x: _vQuat.x, y: _vQuat.y, z: _vQuat.z, w: _vQuat.w }, !0),
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, !0),
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, !0),
      this.game.physics.resetInterp(this.rec));
  }
};
var STOMPER_SPEC = {
  id: `skystomper`,
  name: `SKYSTOMPER`,
  source: `J-Bomb`,
  blurb: `Jet mech. Hold ACTION to fly, ALT (Shift/F) to dive-stomp. Only it can flatten the reinforced towers.`,
  hx: 1.25,
  hy: 1.75,
  hz: 1.1,
  clearance: 2.2,
  mass: 6e3,
  engine: `jet_loop`,
};
var Stomper = class extends Vehicle {
  constructor(e, t) {
    let n = {
      ...STOMPER_SPEC,
      model: () => ({ geo: new THREE.BoxGeometry(0.01, 0.01, 0.01), wheels: [] }),
      maxSpeed: 6.5,
      maxReverse: 4,
      accel: 14,
      brake: 30,
      coast: 3,
      grip: 18,
      turn: 2.2,
      turnInPlace: !0,
      turnResp: 14,
      dmg: { front: 0, side: 0, rear: 0 },
      pitch: [0.8, 1.3],
    };
    super(e, n, t);
    let r = stomperModel();
    ((this.torso = new THREE.Mesh(r.torso, this.mat)),
      (this.torso.castShadow = !0),
      (this.legL = new THREE.Group()),
      (this.legR = new THREE.Group()));
    let i = new THREE.Mesh(r.leg, this.mat),
      a = new THREE.Mesh(r.leg, this.mat);
    ((i.castShadow = a.castShadow = !0), this.legL.add(i), this.legR.add(a));
    let o = n.hy + n.clearance - 0.1;
    ((this.torso.position.y = o - 0.1),
      this.legL.position.set(-0.7, o, 0),
      this.legR.position.set(0.7, o, 0),
      this.visual.add(this.torso, this.legL, this.legR));
    let s = emissiveMaterial(16752704, 5);
    this.flames = [];
    for (let e of [-0.6, 0.6]) {
      let t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), s);
      ((t.rotation.x = Math.PI),
        t.position.set(e, o - 0.1 + 0.05 - 0.9, -1.25),
        (t.visible = !1),
        this.visual.add(t),
        this.flames.push(t));
    }
    let c = new THREE.RingGeometry(2.2, 2.8, 20);
    (c.rotateX(-Math.PI / 2),
      (this.reticleMat = new THREE.MeshBasicNodeMaterial({
        color: 16765498,
        transparent: !0,
        opacity: 0.8,
        depthWrite: !1,
      })),
      (this.reticle = new THREE.Mesh(c, this.reticleMat)),
      (this.reticle.visible = !1),
      e.scene.add(this.reticle),
      (this.fuel = 100),
      (this.diving = !1),
      (this.thrusting = !1),
      (this.walkPhase = 0),
      (this.altitude = 0));
  }
  fixedUpdate(e, t) {
    let n = this.body,
      r = n.translation(),
      i = this.game.physics.castRayDown(r.x, r.y - 0.5, r.z, 80, this.rayGroups, n);
    ((this.altitude = i ? i.timeOfImpact + 0.5 - this.restDist : 80),
      (this.groundHit = i ? { y: r.y - 0.5 - i.timeOfImpact, col: i.collider } : null));
    let a = t && t.action && this.fuel > 0 && !this.diving;
    if (this.diving) {
      this.diveT = (this.diveT || 0) + e;
      let t = n.linvel().y;
      ((this.diveT > 0.12 && t > -8) || this.diveT > 3) && ((this.preV.y = -30), this._stompImpact(null));
    } else this.diveT = 0;
    super.fixedUpdate(e, t && !this.grounded ? null : t);
    let o = n.linvel(),
      s = o.y,
      c = o.x,
      l = o.z;
    if (
      ((this.thrusting = !1),
      t &&
        (t.altPressed &&
          !this.grounded &&
          this.altitude > 1.6 &&
          !this.diving &&
          ((this.diving = !0), this.game.audio.play(`whoosh`, { pos: r, rate: 0.7 })),
        this.diving
          ? ((s = -34), (c *= 0.85), (l *= 0.85))
          : a &&
            ((this.thrusting = !0),
            (s = Math.min(11, s + (s < 0 ? 38 : 30) * e)),
            r.y > 44 && (s = Math.min(s, 0)),
            (this.fuel = Math.max(0, this.fuel - 21 * e))),
        !this.grounded && !this.diving))
    ) {
      let r = 0,
        i = 0;
      if (t.pointGo) {
        let e = Vehicle.pointToGo(this, t.stick, t.camYaw, !0);
        ((r = Math.max(0, e.throttle)), (i = e.steer));
      } else ((r = t.throttle), (i = t.steer));
      let a = Math.sin(this.yaw),
        o = Math.cos(this.yaw),
        s = a * r * 17,
        u = o * r * 17;
      ((c = damp(c, s, 1.6, e)), (l = damp(l, u, 1.6, e)), n.setAngvel({ x: 0, y: -i * 2, z: 0 }, !0));
    }
    let u = this.game.mapBounds;
    if (
      (u &&
        (r.x < u.minX + 4 && (c = Math.max(c, 4)),
        r.x > u.maxX - 4 && (c = Math.min(c, -4)),
        r.z < u.minZ + 4 && (l = Math.max(l, 4)),
        r.z > u.maxZ - 4 && (l = Math.min(l, -4))),
      this.grounded
        ? (this.fuel = Math.min(100, this.fuel + 45 * e))
        : this.thrusting || (this.fuel = Math.min(100, this.fuel + 6 * e)),
      n.setLinvel({ x: c, y: s, z: l }, !0),
      (this.meter = { v: this.fuel / 100, label: this.diving ? `STOMP!` : `JET FUEL` }),
      this.diving && this.grounded)
    ) {
      let e = this.groundHit && this.game.physics.ownerOf(this.groundHit.col.handle);
      this._stompImpact(e && e.type === `building` ? e.b : null);
    }
    this.speed = Math.hypot(c, l);
  }
  handleAction() {}
  _stompImpact(e, t = null) {
    if (!this.diving) return;
    this.diving = !1;
    let n = this.body.translation(),
      r = n.y - this.restDist,
      i = t ? t.x : n.x,
      a = t ? t.z : n.z,
      o = Math.max(12, -this.preV.y),
      s = clamp(o / 30, 0.5, 1.25),
      c = this.game,
      l = new Set();
    e && l.add(e);
    for (let e of c.allBuildings()) {
      if (e.collapsed || l.has(e)) continue;
      let t = e.aabb,
        n = Math.max(t.minX - i, 0, i - t.maxX),
        o = Math.max(t.minZ - a, 0, a - t.maxZ);
      Math.hypot(n, o) < 5.5 && r < t.maxY + 3.5 && r > t.minY - 2 && l.add(e);
    }
    for (let t of l) {
      let n = (t === e ? 150 : 95) * s,
        l = t.aabb,
        u = { x: clamp(i, l.minX, l.maxX), y: Math.min(r, l.maxY - 0.5), z: clamp(a, l.minZ, l.maxZ) },
        d = t.sys.damage(t, n, u, `stomp`, null, this);
      c.onVehicleImpact(this, t, d.applied, o, u, `stomp`);
    }
    (c.fx.ring(i, r + 0.3, a, 1, 14 * s, 0.6, 16773312),
      c.fx.bigDust(i, r, a, 3, 1, 22),
      c.fx.shake(0.75 * s),
      c.audio.play(`stomp`, { pos: n, vol: 1 }),
      c.hitStop(0.08),
      this.body.setLinvel({ x: 0, y: 9, z: 0 }, !0));
  }
  onBuildingContact(e, t, n, r) {
    this.diving && n.y > 0.4 && this._stompImpact(e, t);
  }
  onLand(e) {
    if ((super.onLand(e), !this.diving && e > 16)) {
      let e = this.body.translation();
      this.game.fx.ring(e.x, e.y - this.restDist + 0.3, e.z, 1, 6, 0.4);
    }
  }
  render(e, t) {
    let n = this.game.time,
      r = this.grounded && Math.abs(this.vf) > 0.5;
    this.walkPhase += r ? this.vf * t * 1.6 : 0;
    let i = r ? Math.sin(this.walkPhase) * 0.55 : this.grounded ? 0 : 0.35;
    ((this.legL.rotation.x = damp(this.legL.rotation.x, i, 12, t)),
      (this.legR.rotation.x = damp(this.legR.rotation.x, this.grounded ? -i : 0.35, 12, t)),
      (this.torso.position.y =
        this.spec.hy + this.spec.clearance - 0.2 + (r ? Math.abs(Math.cos(this.walkPhase)) * 0.12 : 0)),
      this.visual.rotation.set(this.diving ? 0.25 : this.pitch * 0.3, 0, this.roll * 0.3));
    for (let e of this.flames)
      ((e.visible = this.thrusting), e.scale.set(1, 0.8 + Math.sin(n * 40 + e.position.x) * 0.25, 1));
    let a = this.driver && !this.grounded && this.groundHit;
    if (((this.reticle.visible = !!a), a)) {
      let e = this.group.position;
      this.reticle.position.set(e.x, this.groundHit.y + 0.15, e.z);
      let t = this.game.physics.ownerOf(this.groundHit.col.handle),
        r = t && t.type === `building` && !t.b.collapsed;
      this.reticleMat.color.set(this.diving ? 16728096 : r ? 16738874 : 16765498);
      let i = 0.8 + Math.sin(n * 8) * 0.08;
      this.reticle.scale.set(i, 1, i);
    }
  }
};
var PLAYER_HALF_H = 0.45;
var PLAYER_R = 0.42;
var PLAYER_FOOT = 0.87;
var Player = class {
  constructor(e, t) {
    this.game = e;
    let n = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(t.x, t.y + PLAYER_FOOT + 0.05, t.z)
      .enabledRotations(!1, !1, !1)
      .setGravityScale(2)
      .setLinearDamping(0)
      .setCanSleep(!1)
      .setCcdEnabled(!0);
    this.body = e.physics.world.createRigidBody(n);
    let r = RAPIER.ColliderDesc.capsule(PLAYER_HALF_H, PLAYER_R)
      .setFriction(0)
      .setRestitution(0)
      .setDensity(1.2)
      .setCollisionGroups(
        groups(GROUP.PLAYER, GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.PROP | GROUP.CARRIER),
      );
    ((this.collider = e.physics.world.createCollider(r, this.body)),
      e.physics.setOwner(this.collider, { type: `player`, obj: this }),
      (this.group = new THREE.Group()),
      (this.visual = new THREE.Group()),
      (this.visual.position.y = -0.87));
    let i = minifigModel(),
      a = vertexColorMaterial({ roughness: 0.4 }),
      o = new THREE.Mesh(i.body, a);
    ((o.castShadow = !0),
      (this.legL = new THREE.Mesh(i.leg, a)),
      (this.legR = new THREE.Mesh(i.leg, a)),
      (this.legL.castShadow = this.legR.castShadow = !0),
      this.legL.position.set(-0.14, 0.6, 0),
      this.legR.position.set(0.14, 0.6, 0),
      this.visual.add(o, this.legL, this.legR),
      this.visual.scale.setScalar(1.15),
      this.group.add(this.visual),
      e.scene.add(this.group),
      (this.rec = e.physics.track(this.body, this.group)),
      (this.yaw = t.yaw || 0),
      (this.phase = 0),
      (this.active = !0),
      (this.grounded = !1),
      (this.stepAcc = 0),
      (this.area = t.y < -3 ? `underground` : `surface`),
      (this.speed = 0),
      (this.rayGroups = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.BUILDING | GROUP.PROP | GROUP.VEHICLE)));
  }
  get pos() {
    return this.body.translation();
  }
  setActive(e, t, n, r, i) {
    ((this.active = e),
      (this.group.visible = e),
      e
        ? (this.body.setEnabled(!0),
          this.body.setTranslation({ x: t, y: n + PLAYER_FOOT + 0.1, z: r }, !0),
          this.body.setLinvel({ x: 0, y: 0, z: 0 }, !0),
          (this.yaw = i ?? this.yaw),
          this.game.physics.resetInterp(this.rec))
        : this.body.setEnabled(!1));
  }
  fixedUpdate(e, t) {
    if (!this.active) return;
    let n = this.body,
      r = n.translation(),
      i = n.linvel();
    this.area = r.y < -3 ? `underground` : `surface`;
    let a = this.game.physics.castRayDown(r.x, r.y, r.z, 1.47, this.rayGroups, n);
    this.grounded = !!a && a.timeOfImpact < 1.02;
    let o = 0,
      s = 0;
    if (t && t.move.mag > 0.05) {
      let n = 7 * Math.min(1, t.move.mag * 1.2);
      ((o = t.move.x * n), (s = t.move.z * n), (this.yaw = dampAngle(this.yaw, Math.atan2(t.move.x, t.move.z), 14, e)));
    }
    let c = this.grounded ? 16 : 4,
      l = damp(i.x, o, c, e),
      u = damp(i.z, s, c, e),
      d = i.y;
    (a &&
      a.timeOfImpact > 0.9299999999999999 &&
      a.timeOfImpact < 1.37 &&
      d < 0.5 &&
      Math.hypot(o, s) > 0.1 &&
      (d = Math.min(d, -3)),
      n.setLinvel({ x: l, y: d, z: u }, !0),
      (this.speed = Math.hypot(l, u)),
      this.grounded &&
        this.speed > 1 &&
        ((this.stepAcc += this.speed * e),
        this.stepAcc > 1.4 &&
          ((this.stepAcc = 0), this.game.audio.play(`footstep`, { pos: r, jitter: 0.2, vol: 0.8 }))),
      r.y < -40 && this.game.respawnPlayer());
  }
  render(e, t) {
    (this.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw),
      (this.phase += this.speed * t * 1.9));
    let n = this.speed > 0.5 ? Math.sin(this.phase) * 0.7 : 0;
    ((this.legL.rotation.x = n),
      (this.legR.rotation.x = -n),
      (this.visual.position.y = -0.87 + (this.speed > 0.5 ? Math.abs(Math.cos(this.phase)) * 0.06 : 0)));
  }
};
var SubwayTrain = class {
  constructor(e) {
    ((this.game = e), (this.z = SUBWAY.zA), (this.v = 0), (this.y = -10.1));
    let t = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SUBWAY.x, this.y, this.z);
    this.body = e.physics.world.createRigidBody(t);
    let n = RAPIER.ColliderDesc.cuboid(1.5, 1.8, 7).setCollisionGroups(
      groups(GROUP.CARRIER, GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.PROP),
    );
    ((this.collider = e.physics.world.createCollider(n, this.body)),
      e.physics.setOwner(this.collider, { type: `train`, obj: this }),
      (this.group = new THREE.Group()));
    let r = new THREE.Mesh(subwayModel(), vertexColorMaterial({ roughness: 0.3 }));
    ((r.position.y = -1.9), (r.castShadow = !0), (r.receiveShadow = !0), this.group.add(r));
    let i = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 11), emissiveMaterial(16773577, 1.2));
    ((i.position.y = 1.7),
      this.group.add(i),
      e.scene.add(this.group),
      (this.rec = e.physics.track(this.body, this.group)),
      (this.driver = null),
      (this.name = `SUBWAY SHUTTLE`),
      (this.id = `train`),
      (this.area = `underground`),
      (this.loop = null),
      (this.speed = 0),
      (this.dest = `B`),
      (this.latched = !1));
  }
  get pos() {
    return this.body.translation();
  }
  get radius() {
    return 7;
  }
  station() {
    return Math.abs(this.z - SUBWAY.zA) < 2.5 ? `A` : Math.abs(this.z - SUBWAY.zB) < 2.5 ? `B` : null;
  }
  fixedUpdate(e, t) {
    let n = 0,
      r = this.station();
    if (r && this.speed < 0.5) {
      let e = r === `A` ? `B` : `A`;
      e !== this.dest && ((this.dest = e), (this.latched = !0));
    }
    if (t) {
      let e = t.pointGo ? t.stick.mag * (t.stick.y < -0.5 ? -1 : 1) : t.throttle;
      this.latched && Math.abs(e) < 0.1 && (this.latched = !1);
      let r = this.dest === `B` ? -1 : 1;
      n = this.latched ? 0 : r * e * 21;
    }
    let i = SUBWAY.zA - this.z,
      a = this.z - SUBWAY.zB,
      o = Math.sqrt(14 * Math.max(0, i)),
      s = Math.sqrt(14 * Math.max(0, a));
    (n > 0 && (n = Math.min(n, o)), n < 0 && (n = Math.max(n, -s)));
    let c = Math.abs(n) > Math.abs(this.v) ? 6 : 9;
    ((this.v = this.v < n ? Math.min(n, this.v + c * e) : Math.max(n, this.v - c * e)),
      (this.z += this.v * e),
      (this.z = clamp(this.z, SUBWAY.zB, SUBWAY.zA)),
      (this.z === SUBWAY.zB || this.z === SUBWAY.zA) && (this.v = 0),
      this.body.setNextKinematicTranslation({ x: SUBWAY.x, y: this.y, z: this.z }),
      (this.speed = Math.abs(this.v)));
    let l = this.game.activeArea === `underground`;
    this.speed > 0.2 && l
      ? ((!this.loop || !this.loop.alive) && (this.loop = this.game.audio.loop(`train_loop`, { vol: 0.8 })),
        (this.loop.rate = 0.6 + (this.speed / 21) * 0.8),
        (this.loop.vol = clamp(this.speed / 6, 0, 1)),
        (this.loop.pos = this.pos))
      : (this.loop &&= (this.loop.stop(), null));
  }
  render() {}
  exitSpot() {
    return {
      x: -104.5,
      y: -12,
      z: clamp(this.z, this.station() === `A` ? 131 : -170, this.station() === `A` ? 150 : -152),
      yaw: -Math.PI / 2,
    };
  }
};
var _rMat = new THREE.Matrix4();
var _rQuat = new THREE.Quaternion();
var _rPos = new THREE.Vector3();
var _rScale = new THREE.Vector3(1, 1, 1);
var _rHidden = new THREE.Matrix4().makeScale(0, 0, 0);
var _rUp = new THREE.Vector3(0, 1, 0);
var Rdus = class {
  constructor(e, t) {
    ((this.game = e), (this.list = t.map((e) => ({ ...e, lit: !1, area: e.y < -3 ? `underground` : `surface` }))));
    let n = new ModelBuilder();
    (n.cyl(0.42, 0.5, 0.35, 8, 0, 0.18, 0, COLORS.darkGrey),
      n.box(0.16, 0.7, 0.16, 0, 0.6, 0, COLORS.darkGrey, { flat: !0 }));
    let r = n.build(),
      i = new THREE.IcosahedronGeometry(0.34, 1),
      a = vertexColorMaterial({ roughness: 0.5 }),
      o = instanceHotMaterial(3.5);
    this.meshes = {};
    for (let t of [`surface`, `underground`]) {
      let n = this.list.filter((e) => e.area === t),
        s = new THREE.InstancedMesh(r, a, Math.max(1, n.length)),
        c = new THREE.InstancedMesh(i, o, Math.max(1, n.length));
      (n.forEach((e, t) => {
        ((e.mi = t),
          _rMat.makeTranslation(e.x, e.y, e.z),
          s.setMatrixAt(t, _rMat),
          _rMat.makeTranslation(e.x, e.y + 1.15, e.z),
          c.setMatrixAt(t, _rMat),
          c.setColorAt(t, new THREE.Color(0.32, 0.32, 0.36)));
      }),
        (s.count = c.count = n.length),
        (s.castShadow = !0),
        (s.frustumCulled = !1),
        (c.frustumCulled = !1),
        c.instanceColor.setUsage(THREE.DynamicDrawUsage),
        (t === `surface` ? e.level.surface : e.level.under).add(s, c),
        (this.meshes[t] = { base: s, bulbs: c }));
    }
    ((this.count = 0), (this.streak = 0), (this.streakT = 0), (this.pulse = []));
  }
  get total() {
    return this.list.length;
  }
  check(e, t, n, r, i) {
    ((this.streakT -= i), this.streakT <= 0 && (this.streak = 0));
    for (let i = 0; i < this.list.length; i++) {
      let a = this.list[i];
      if (a.lit) continue;
      let o = a.x - e,
        s = a.z - n,
        c = a.y - t;
      o * o + s * s < r * r && Math.abs(c) < 4.5 && this.light(i);
    }
  }
  light(e) {
    let t = this.list[e];
    ((t.lit = !0), this.count++);
    let n = this.meshes[t.area].bulbs;
    (n.setColorAt(t.mi, new THREE.Color(1, 0.86, 0.35)),
      (n.instanceColor.needsUpdate = !0),
      (this.streak = Math.min(this.streak + 1, 12)),
      (this.streakT = 2.2),
      this.game.audio.play(`rdu`, { rate: 1 + this.streak * 0.06, vol: 0.9, minGap: 0.02 }),
      this.game.fx.sparks(t.x, t.y + 1.2, t.z, 6, null, 16769146),
      this.pulse.push({ i: e, t: 0 }),
      this.game.onCollect(`rdu`, t));
  }
  reset() {
    ((this.count = 0), (this.pulse.length = 0));
    for (let e of this.list) {
      e.lit = !1;
      let { bulbs: t } = this.meshes[e.area];
      (t.setColorAt(e.mi, new THREE.Color(0.32, 0.32, 0.36)),
        _rMat.makeTranslation(e.x, e.y + 1.15, e.z),
        t.setMatrixAt(e.mi, _rMat));
    }
    for (let e of Object.values(this.meshes))
      ((e.bulbs.instanceColor.needsUpdate = !0), (e.bulbs.instanceMatrix.needsUpdate = !0));
  }
  update(e) {
    for (let t = this.pulse.length - 1; t >= 0; t--) {
      let n = this.pulse[t];
      n.t += e;
      let r = this.list[n.i],
        i = 1 + Math.sin(Math.min(1, n.t / 0.4) * Math.PI) * 0.8,
        a = this.meshes[r.area].bulbs;
      (_rMat.compose(_rPos.set(r.x, r.y + 1.15, r.z), _rQuat.identity(), _rScale.set(i, i, i)),
        a.setMatrixAt(r.mi, _rMat),
        (a.instanceMatrix.needsUpdate = !0),
        n.t > 0.4 && this.pulse.splice(t, 1));
    }
  }
};
var CommPoints = class {
  constructor(e, t) {
    this.game = e;
    let n = commPointModel(),
      r = vertexColorMaterial({ roughness: 0.4 });
    ((this.list = t.map((t) => {
      let i = new THREE.Group(),
        a = new THREE.Mesh(n.base, r);
      a.castShadow = !0;
      let o = new THREE.Group();
      o.position.y = 4.3;
      let s = new THREE.Mesh(n.dish, r);
      ((s.castShadow = !0), o.add(s));
      let c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), emissiveMaterial(16726832, 5));
      return (
        c.position.set(0, 4.2, 0.75),
        i.add(a, o, c),
        i.position.set(t.x, t.y, t.z),
        e.level.surface.add(i),
        { ...t, g: i, dishPivot: o, light: c, active: !1 }
      );
    })),
      (this.count = 0),
      (this.greenMat = emissiveMaterial(3407718, 6)),
      (this.redMat = this.list[0].light.material));
  }
  get total() {
    return this.list.length;
  }
  check(e, t, n) {
    for (let r of this.list) {
      if (r.active) continue;
      let i = r.x - e,
        a = r.z - n;
      i * i + a * a < 30.25 && Math.abs(r.y - t) < 5 && this.activate(r);
    }
  }
  reset() {
    this.count = 0;
    for (let e of this.list) ((e.active = !1), (e.light.material = this.redMat), (e.dishPivot.rotation.y = 0));
  }
  activate(e) {
    ((e.active = !0),
      this.count++,
      (e.light.material = this.greenMat),
      this.game.audio.play(`cp_activate`, { vol: 1 }),
      this.game.fx.ring(e.x, e.y + 0.3, e.z, 1, 12, 0.8, 8257434),
      this.game.onCollect(`cp`, e));
  }
  update(e, t) {
    for (let n of this.list)
      (n.active ? (n.dishPivot.rotation.y += e * 1.4) : (n.light.visible = Math.sin(t * 5) > 0),
        n.active && (n.light.visible = !0));
  }
};
var PushProp = class {
  constructor(e, t, n, r, i, a = {}) {
    ((this.game = e), (this.sp = { ...n }), (this.half = r));
    let o = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(n.x, n.y + r[1] + 0.02, n.z)
      .setCanSleep(!0)
      .setLinearDamping(a.linDamp ?? 0.4)
      .setAngularDamping(a.angDamp ?? 1.2);
    (n.yaw &&
      (_rQuat.setFromAxisAngle(_rUp, n.yaw), o.setRotation({ x: _rQuat.x, y: _rQuat.y, z: _rQuat.z, w: _rQuat.w })),
      a.lockRot && o.enabledRotations(!1, !0, !1),
      (this.body = e.physics.world.createRigidBody(o)));
    let s = 8 * r[0] * r[1] * r[2],
      c = RAPIER.ColliderDesc.cuboid(r[0], r[1], r[2])
        .setDensity(i / s)
        .setFriction(a.friction ?? 0.7)
        .setRestitution(0.1)
        .setCollisionGroups(
          groups(
            GROUP.PROP,
            GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.PLAYER | GROUP.DEBRIS | GROUP.PROP | GROUP.CARRIER,
          ),
        )
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    (a.stickyFriction && c.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max),
      (this.collider = e.physics.world.createCollider(c, this.body)),
      e.physics.setOwner(this.collider, { type: a.type || `prop`, obj: this }),
      (this.mesh = new THREE.Mesh(t, a.mat || vertexColorMaterial({ roughness: 0.45 }))),
      (this.mesh.castShadow = !0),
      (this.mesh.receiveShadow = !0),
      (this.group = new THREE.Group()),
      this.group.add(this.mesh),
      a.meshOffsetY && (this.mesh.position.y = a.meshOffsetY),
      (a.parent || e.scene).add(this.group),
      (this.rec = e.physics.track(this.body, this.group)));
  }
  get pos() {
    return this.body.translation();
  }
  reset() {
    let e = this.sp;
    (_rQuat.setFromAxisAngle(_rUp, e.yaw || 0),
      this.body.setTranslation({ x: e.x, y: e.y + this.half[1] + 0.02, z: e.z }, !0),
      this.body.setRotation({ x: _rQuat.x, y: _rQuat.y, z: _rQuat.z, w: _rQuat.w }, !0),
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, !0),
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, !0),
      this.game.physics.resetInterp(this.rec));
  }
};
var ConcreteBlock = class extends PushProp {
  constructor(e) {
    let t = CONCRETE_BLOCK;
    super(e, concreteBlockModel(t.w, t.h, t.d), { x: t.x, y: 0, z: t.z }, [t.w / 2, t.h / 2, t.d / 2], 4200, {
      friction: 0.55,
      lockRot: !0,
      linDamp: 1.2,
      parent: e.level.surface,
    });
  }
};
var ParkedCar = class extends PushProp {
  constructor(e, t) {
    super(e, parkedCarModel(t.c), { x: t.x, y: 0, z: t.z, yaw: t.yaw }, [0.95, 0.7, 2], 1100, {
      meshOffsetY: -0.7,
      friction: 0.5,
      parent: e.level.surface,
    });
  }
};
var Tnt = class extends PushProp {
  constructor(e, t) {
    (super(e, tntModel(), t, [0.8, 0.8, 0.8], 260, {
      type: `tnt`,
      friction: 0.9,
      stickyFriction: !0,
      lockRot: !0,
      linDamp: 0.6,
      parent: e.level.under,
    }),
      (this.fuse = -1),
      (this.state = `idle`),
      (this.respawnT = 0),
      (this.label = e.ui.worldLabel(`tnt`, ``)),
      (this.tickT = 0));
  }
  touch(e) {
    this.state === `idle` &&
      ((this.state = `lit`),
      (this.fuse = 15),
      this.game.audio.play(`fuse_tick`, { pos: this.pos }),
      this.game.ui.toast(`TNT fuse lit — push it into the sealed door!`));
  }
  fixedUpdate(e) {
    let t = this.pos;
    if (this.state === `lit`) {
      ((this.fuse -= e),
        (this.tickT -= e),
        this.tickT <= 0 &&
          (this.game.audio.play(`fuse_tick`, { pos: t, rate: this.fuse < 4 ? 1.4 : 1 }),
          (this.tickT = this.fuse < 4 ? 0.25 : 1)),
        rng() < 0.5 && this.game.fx.sparks(t.x + 0.3, t.y + 1.1, t.z + 0.3, 1, null, 16763989));
      let n = this.body.linvel(),
        r = Math.hypot(n.x, n.z),
        i = !1;
      (this.game.physics.world.contactPairsWith(this.collider, (e) => {
        let t = this.game.physics.ownerOf(e.handle);
        t && t.type === `building` && !t.b.collapsed && (i = !0);
      }),
        ((i && r > 1) || this.fuse <= 0) && this.explode(),
        this.label.set(
          Math.ceil(Math.max(0, this.fuse)).toString(),
          t.x,
          t.y + 1.9,
          t.z,
          this.fuse < 4 ? `danger` : `warn`,
        ));
    } else
      this.state === `gone`
        ? (this.label.hide(), (this.respawnT -= e), this.respawnT <= 0 && this.respawn())
        : this.state === `idle`
          ? this.label.set(`TNT`, t.x, t.y + 1.9, t.z, `info`)
          : this.label.hide();
    t.y < -60 && this.state !== `done` && this.respawn();
  }
  fullReset() {
    ((this.state = `idle`),
      (this.fuse = -1),
      (this.respawnT = 0),
      this.body.setEnabled(!0),
      this.reset(),
      (this.group.visible = !0));
  }
  explode() {
    if (this.state === `gone` || this.state === `done`) return;
    let e = this.pos;
    ((this.state = `gone`),
      (this.respawnT = 5),
      this.game.explosion(e.x, e.y, e.z, 8.5, 270, `explosion`, this),
      (this.group.visible = !1),
      this.body.setEnabled(!1));
  }
  respawn() {
    let e = this.game.level.doors.D1;
    if (e && e.collapsed && this.state === `gone`) {
      ((this.state = `done`), this.label.hide());
      return;
    }
    ((this.state = `idle`),
      (this.fuse = -1),
      this.body.setEnabled(!0),
      this.reset(),
      (this.group.visible = !0),
      this.game.fx.dust(this.sp.x, this.sp.y + 0.2, this.sp.z, 6, 1.2));
  }
};
var Breakables = class {
  constructor(e, t, n) {
    this.game = e;
    let r = vertexColorMaterial({ roughness: 0.5 });
    this.items = [];
    let i = (t, n, i) => {
      let a = new THREE.InstancedMesh(t, r, Math.max(1, n.length));
      return (
        (a.castShadow = !0),
        (a.receiveShadow = !0),
        (a.frustumCulled = !1),
        n.forEach((e, t) => {
          let n = e.s || 1;
          (_rQuat.setFromAxisAngle(_rUp, (e.x * 13.37) % 6.28),
            _rMat.compose(_rPos.set(e.x, 0, e.z), _rQuat, _rScale.set(n, n, n)),
            a.setMatrixAt(t, _rMat),
            this.items.push({
              kind: i,
              im: a,
              i: t,
              x: e.x,
              z: e.z,
              r: i === `tree` ? 1.2 * n : 0.5,
              alive: !0,
              m0: _rMat.clone(),
            }));
        }),
        (a.count = n.length),
        e.level.surface.add(a),
        a
      );
    };
    ((this.treeMesh = i(treeModel(), t, `tree`)), (this.lampMesh = i(lampModel(), n, `lamp`)), (this.broken = 0));
  }
  reset() {
    this.broken = 0;
    for (let e of this.items) ((e.alive = !0), e.im.setMatrixAt(e.i, e.m0));
    ((this.treeMesh.instanceMatrix.needsUpdate = !0), (this.lampMesh.instanceMatrix.needsUpdate = !0));
  }
  check(e, t, n, r) {
    if (!(r < 2.5))
      for (let i of this.items) {
        if (!i.alive) continue;
        let a = i.x - e,
          o = i.z - t,
          s = i.r + n;
        a * a + o * o < s * s && this.breakItem(i, e, t, r);
      }
  }
  breakItem(e, t, n, r) {
    ((e.alive = !1), this.broken++, e.im.setMatrixAt(e.i, _rHidden), (e.im.instanceMatrix.needsUpdate = !0));
    let i = this.game.fx,
      a = e.x - t,
      o = e.z - n,
      s = Math.hypot(a, o) || 1;
    if (e.kind === `tree`) {
      for (let t = 0; t < 10; t++)
        i.spawn({
          x: e.x,
          y: 2 + rng() * 3,
          z: e.z,
          vx: (a / s) * r * 0.4 + (rng() - 0.5) * 6,
          vy: 3 + rng() * 5,
          vz: (o / s) * r * 0.4 + (rng() - 0.5) * 6,
          life: 1.4,
          s0: 0.45,
          s1: 0.4,
          peak: 0.1,
          color: rng() < 0.7 ? 4892740 : 8015405,
          drag: 0.6,
          g: -18,
          floor: 0.2,
        });
      this.game.audio.play(`brick_clatter`, { pos: { x: e.x, y: 1, z: e.z }, jitter: 0.2 });
    } else (i.sparks(e.x, 5, e.z, 10), this.game.audio.play(`glass`, { pos: { x: e.x, y: 1, z: e.z }, jitter: 0.2 }));
    this.game.fx.shake(0.04);
  }
};
var AmmoCrates = class {
  constructor(e, t) {
    this.game = e;
    let n = ammoCrateModel(COLORS.green, COLORS.red),
      r = vertexColorMaterial();
    this.list = t.map((t) => {
      let i = new THREE.Mesh(n, r);
      return (
        (i.castShadow = !0),
        i.position.set(t.x, t.y, t.z),
        e.level.surface.add(i),
        { ...t, m: i, t: 0, alive: !0 }
      );
    });
  }
  reset() {
    for (let e of this.list) ((e.alive = !0), (e.m.visible = !0), (e.t = 0));
  }
  update(e, t, n) {
    for (let r of this.list) {
      if (!r.alive) {
        ((r.t -= e), r.t <= 0 && ((r.alive = !0), (r.m.visible = !0)));
        continue;
      }
      if (
        ((r.m.rotation.y = t * 1.5 + r.x),
        (r.m.position.y = r.y + 0.25 + Math.sin(t * 3 + r.z) * 0.15),
        n && n.spec && n.spec.missiles)
      ) {
        let e = n.pos;
        (e.x - r.x) ** 2 + (e.z - r.z) ** 2 < 9 &&
          Math.abs(e.y - r.y) < 3 &&
          ((r.alive = !1),
          (r.m.visible = !1),
          (r.t = 30),
          (n.ammo = Math.min(24, (n.ammo || 0) + 8)),
          this.game.audio.play(`pickup`),
          this.game.ui.popup(`+8 MISSILES`, r.x, r.y + 2, r.z, `good`));
      }
    }
  }
};
var Weapons = class {
  constructor(e) {
    ((this.game = e), (this.list = []));
    let t = new ModelBuilder();
    (t.cyl(0.14, 0.14, 1.2, 6, 0, 0, 0, COLORS.white, { rot: [Math.PI / 2, 0, 0], capBot: !0 }),
      t.cyl(0, 0.14, 0.35, 6, 0, 0, 0.77, COLORS.red, { rot: [Math.PI / 2, 0, 0] }),
      (this.geo = t.build()),
      (this.mat = vertexColorMaterial()),
      (this.flameMat = emissiveMaterial(16756800, 6)),
      (this.pool = []),
      (this.rayGroups = groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.BUILDING | GROUP.PROP)));
  }
  fireMissile(e, t, n) {
    let r = this.game,
      i = null,
      a = 1e9;
    for (let n of r.allBuildings()) {
      if (n.collapsed) continue;
      let r = (n.aabb.minX + n.aabb.maxX) / 2,
        o = (n.aabb.minZ + n.aabb.maxZ) / 2,
        s = r - e.x,
        c = o - e.z,
        l = Math.hypot(s, c);
      if (l > 85 || l < 2) continue;
      let u = (s * t.x + c * t.z) / l;
      if (u < 0.86 || Math.abs(n.aabb.minY - e.y) > 12) continue;
      let d = l * (2 - u);
      d < a && ((a = d), (i = n));
    }
    let o = this.pool.pop();
    if (!o) {
      let e = new THREE.Group(),
        t = new THREE.Mesh(this.geo, this.mat);
      t.castShadow = !0;
      let n = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 5), this.flameMat);
      ((n.rotation.x = -Math.PI / 2), (n.position.z = -0.95), e.add(t, n), (o = { grp: e }));
    }
    ((o.grp.visible = !0),
      this.game.scene.add(o.grp),
      Object.assign(o, {
        x: e.x,
        y: e.y,
        z: e.z,
        vx: t.x * 44,
        vy: 0.6,
        vz: t.z * 44,
        life: 0,
        target: i,
        owner: n,
        px: e.x,
        py: e.y,
        pz: e.z,
      }),
      this.list.push(o),
      r.audio.play(`missile_launch`, { pos: e, jitter: 0.1 }),
      r.fx.smoke(e.x, e.y, e.z, 2, 0.6, 10132122));
  }
  step(e) {
    let t = this.game,
      n = t.physics.world;
    for (let r = this.list.length - 1; r >= 0; r--) {
      let i = this.list[r];
      if (((i.life += e), (i.px = i.x), (i.py = i.y), (i.pz = i.z), i.target && !i.target.collapsed && i.life > 0.08)) {
        let t = i.target.aabb,
          n = clamp(i.x, t.minX + 0.5, t.maxX - 0.5),
          r = clamp(i.z, t.minZ + 0.5, t.maxZ - 0.5),
          a = clamp(i.y, t.minY + 1, t.maxY - 1),
          o = (t.minX + t.maxX) / 2,
          s = (t.minZ + t.maxZ) / 2,
          c = lerp(n, o, 0.5),
          l = lerp(r, s, 0.5),
          u = Math.hypot(i.vx, i.vy, i.vz),
          d = c - i.x,
          f = a - i.y,
          p = l - i.z,
          m = Math.hypot(d, f, p) || 1;
        ((d /= m), (f /= m), (p /= m));
        let h = Math.min(1, 3.2 * e);
        ((i.vx = lerp(i.vx / u, d, h) * u), (i.vy = lerp(i.vy / u, f, h) * u), (i.vz = lerp(i.vz / u, p, h) * u));
      }
      let a = Math.hypot(i.vx, i.vy, i.vz) * e,
        o = new RAPIER.Ray({ x: i.x, y: i.y, z: i.z }, { x: (i.vx * e) / a, y: (i.vy * e) / a, z: (i.vz * e) / a }),
        s = n.castRay(o, a, !0, void 0, this.rayGroups, void 0, i.owner && i.owner.body);
      if (s || i.life > 2.6) {
        let e = s ? s.timeOfImpact : a,
          n = i.x + o.dir.x * e,
          c = i.y + o.dir.y * e,
          l = i.z + o.dir.z * e,
          u = null;
        if (s) {
          let e = t.physics.ownerOf(s.collider.handle);
          (e && e.type === `building` && (u = e.b), e && e.type === `tnt` && e.obj.explode());
        }
        if (u) {
          let e = u.sys.damage(u, 34, { x: n, y: c, z: l }, `missile`, { x: i.vx, z: i.vz }, i.owner);
          t.onVehicleImpact(i.owner, u, e.applied, 20, { x: n, y: c, z: l }, `missile`);
        }
        (t.explosion(n, c, l, 3.8, 14, `missile`, i.owner, u, 0.55), this._remove(r));
        continue;
      }
      ((i.x += i.vx * e),
        (i.y += i.vy * e),
        (i.z += i.vz * e),
        Math.floor(i.life * 60) % 2 == 0 &&
          t.fx.spawn({
            x: i.x,
            y: i.y,
            z: i.z,
            vx: rng() - 0.5,
            vy: 0.6,
            vz: rng() - 0.5,
            life: 0.7,
            s0: 0.25,
            s1: 0.7,
            peak: 0.2,
            color: 13619151,
            drag: 2,
          }));
    }
  }
  _remove(e) {
    let t = this.list[e];
    (this.list.splice(e, 1), (t.grp.visible = !1), this.pool.push(t));
  }
  render(e) {
    for (let t of this.list)
      (t.grp.position.set(lerp(t.px, t.x, e), lerp(t.py, t.y, e), lerp(t.pz, t.z, e)),
        t.grp.rotation.set(0, Math.atan2(t.vx, t.vz), 0),
        t.grp.rotateX(-Math.atan2(t.vy, Math.hypot(t.vx, t.vz))));
  }
  clear() {
    for (let e = this.list.length - 1; e >= 0; e--) this._remove(e);
  }
};
var People = class {
  constructor(e) {
    ((this.game = e), (this.mat = vertexColorMaterial({ roughness: 0.4 })));
    let t = e.level.cave,
      n = minifigModel({ coat: COLORS.white, vest: 10473712, pants: COLORS.darkGrey, hair: 12105912 });
    this.scientist = this._fig(n);
    let r = { n: [0, 3.6], s: [0, -3.6], e: [-3.6, 0], w: [3.6, 0] }[t.side];
    ((this.sciPos = { x: t.x + r[0], y: 0, z: t.z + r[1] }),
      this.scientist.position.set(this.sciPos.x, 0, this.sciPos.z),
      (this.scientist.rotation.y = Math.atan2(t.cell.x - t.x, t.cell.z - t.z)),
      (this.sciYaw = this.scientist.rotation.y),
      e.level.surface.add(this.scientist),
      (this.sciFound = !1),
      (this.survivors = []));
    let i = chopperModel();
    this.chopper = new THREE.Group();
    let a = new THREE.Mesh(i.body, this.mat);
    ((a.castShadow = !0),
      (this.rotor = new THREE.Mesh(i.rotor, this.mat)),
      (this.rotor.position.y = 1.95),
      this.chopper.add(a, this.rotor),
      (this.chopper.visible = !1),
      e.level.surface.add(this.chopper),
      (this.queue = []),
      (this.chop = null),
      (this.chopLoop = null),
      (this.figs = []));
  }
  reset() {
    ((this.sciFound = !1),
      (this.scientist.visible = !0),
      (this.scientist.userData.lift = !1),
      this.scientist.position.set(this.sciPos.x, 0, this.sciPos.z),
      this.scientist.rotation.set(0, this.sciYaw, 0),
      this.scientist.scale.setScalar(1.15));
    for (let e of this.figs) e.removeFromParent();
    ((this.figs.length = 0),
      (this.queue.length = 0),
      (this.chop = null),
      (this.chopper.visible = !1),
      (this.chopLoop &&= (this.chopLoop.stop(), null)));
  }
  _fig(e) {
    let t = new THREE.Group(),
      n = new THREE.Mesh(e.body, this.mat);
    n.castShadow = !0;
    let r = new THREE.Mesh(e.leg, this.mat),
      i = new THREE.Mesh(e.leg, this.mat);
    return (
      r.position.set(-0.14, 0.6, 0),
      i.position.set(0.14, 0.6, 0),
      t.add(n, r, i),
      (t.userData = { l: r, r: i }),
      t.scale.setScalar(1.15),
      t
    );
  }
  checkScientist(e, t, n) {
    this.sciFound ||
      (Math.hypot(e - this.sciPos.x, n - this.sciPos.z) < 7 &&
        Math.abs(t - this.sciPos.y) < 4 &&
        ((this.sciFound = !0),
        this.game.onCollect(`scientist`, this.sciPos),
        this.queue.push({ figs: [this.scientist], x: this.sciPos.x, z: this.sciPos.z, y: 0 })));
  }
  spawnSurvivors(e) {
    if (!e.survivors) return;
    let t = [COLORS.red, COLORS.blue, COLORS.green, COLORS.purple, COLORS.teal, COLORS.yellow],
      n = [],
      r = e.aabb,
      i = this.game.focusPos(),
      a = (r.minX + r.maxX) / 2,
      o = (r.minZ + r.maxZ) / 2,
      s = 3.5,
      c = [
        [a, r.minZ - s],
        [a, r.maxZ + s],
        [r.minX - s, o],
        [r.maxX + s, o],
        [r.minX - s, r.minZ - s],
        [r.maxX + s, r.minZ - s],
        [r.minX - s, r.maxZ + s],
        [r.maxX + s, r.maxZ + s],
      ],
      l = c[0],
      u = 1e9;
    for (let e of c) {
      let t = Math.hypot(e[0] - i.x, e[1] - i.z),
        n = t < 7 ? t + 1e3 : t;
      n < u && ((u = n), (l = e));
    }
    let d = l[0],
      f = l[1];
    for (let r = 0; r < e.survivors; r++) {
      let i = this._fig(
        minifigModel({ vest: t[(r + e.id.length) % t.length], pants: COLORS.darkGrey, hat: t[(r + 2) % t.length] }),
      );
      (i.position.set(d + (r - (e.survivors - 1) / 2) * 1.4, e.baseY, f),
        (i.userData.jump = rng() * 6),
        this.game.level.surface.add(i),
        n.push(i));
    }
    (this.figs.push(...n), this.queue.push({ figs: n, x: d, z: f, y: e.baseY }));
  }
  update(e, t) {
    for (let t of this.figs)
      t.userData.lift ||
        ((t.userData.jump += e * 7),
        (t.position.y = t.userData.baseY ?? t.position.y),
        (t.children[0].position.y = Math.abs(Math.sin(t.userData.jump)) * 0.35),
        (t.rotation.y += e * 0.8));
    if (
      (this.sciFound ||
        ((this.scientist.children[0].position.y = Math.abs(Math.sin(t * 5)) * 0.2),
        (this.scientist.rotation.y += Math.sin(t) * e * 0.5)),
      !this.chop && this.queue.length)
    ) {
      let e = this.queue.shift();
      (this.game.focusPos(),
        (this.chop = { job: e, t: 0, from: new THREE.Vector3(e.x - 120, 70, e.z - 60), stage: `in` }),
        (this.chopper.visible = !0),
        (!this.chopLoop || !this.chopLoop.alive) &&
          (this.chopLoop = this.game.audio.loop(`chopper_loop`, { vol: 0.9 })));
    }
    if (this.chop) {
      let t = this.chop;
      t.t += e;
      let n = new THREE.Vector3(t.job.x, t.job.y + 14, t.job.z);
      if (t.stage === `in`) {
        let e = Math.min(1, t.t / 3.2);
        if (
          (this.chopper.position.lerpVectors(t.from, n, 1 - (1 - e) ** 3),
          this.chopper.rotation.set(0.25 * (1 - e), Math.atan2(n.x - t.from.x, n.z - t.from.z), 0),
          e >= 1)
        ) {
          ((t.stage = `lift`), (t.t = 0));
          for (let e of t.job.figs) e.userData.lift = !0;
        }
      } else if (t.stage === `lift`) {
        this.chopper.position.copy(n).add(new THREE.Vector3(0, Math.sin(t.t * 2) * 0.4, 0));
        let e = Math.min(1, t.t / 2.2);
        for (let r of t.job.figs)
          ((r.position.y = lerp(t.job.y, n.y - 1.5, e * e)), r.scale.setScalar(1.15 * (1 - e * 0.6)));
        if (e >= 1) {
          for (let e of t.job.figs) e.visible = !1;
          ((t.stage = `out`), (t.t = 0), (t.out = n.clone()));
        }
      } else {
        let e = Math.min(1, t.t / 3);
        (this.chopper.position.copy(t.out).add(new THREE.Vector3(e * e * 160, e * 50, -e * e * 40)),
          this.chopper.rotation.set(0.3 * e, Math.PI / 2 - 0.3, 0),
          e >= 1 &&
            ((this.chop = null),
            (this.chopper.visible = !1),
            !this.queue.length && this.chopLoop && (this.chopLoop.stop(), (this.chopLoop = null))));
      }
      (this.chop &&
        (!this.chopLoop || !this.chopLoop.alive) &&
        (this.chopLoop = this.game.audio.loop(`chopper_loop`, { vol: 0.9 })),
        this.chopLoop &&
          (this.chopLoop.pos = { x: this.chopper.position.x, y: this.chopper.position.y, z: this.chopper.position.z }));
    }
    this.rotor.rotation.y += e * 30;
  }
};
var RollerDoor = class {
  constructor(e) {
    this.game = e;
    let t = VEHICLE_RAMP.x,
      n = VEHICLE_RAMP.z1 - 1.2;
    ((this.x = t), (this.z = n), (this.open = 0), (this.target = 0));
    let r = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(t, 2, n);
    ((this.body = e.physics.world.createRigidBody(r)),
      e.physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(VEHICLE_RAMP.w / 2, 2.2, 0.3).setCollisionGroups(groups(GROUP.STATIC, 65535)),
        this.body,
      ));
    let i = new ModelBuilder();
    for (let e = 0; e < 7; e++)
      i.box(VEHICLE_RAMP.w, 0.6, 0.35, 0, -2 + e * 0.63, 0, e % 2 ? COLORS.steel : COLORS.lightGrey, {
        flat: !0,
        bevel: 0.05,
      });
    (i.box(VEHICLE_RAMP.w, 0.3, 0.4, 0, -2.15, 0, COLORS.yellow, { flat: !0 }),
      (this.mesh = new THREE.Mesh(i.build(), vertexColorMaterial())),
      (this.mesh.castShadow = !0),
      this.mesh.position.set(t, 2, n),
      e.level.always.add(this.mesh));
    let a = new ModelBuilder();
    (a.box(0.8, 5.2, 0.8, -VEHICLE_RAMP.w / 2 - 0.4, 2.6, 0, COLORS.yellow),
      a.box(0.8, 5.2, 0.8, VEHICLE_RAMP.w / 2 + 0.4, 2.6, 0, COLORS.yellow),
      a.box(VEHICLE_RAMP.w + 1.6, 0.8, 1, 0, 5.4, 0, COLORS.darkGrey, { studs: !0 }));
    let o = new THREE.Mesh(a.build(), vertexColorMaterial());
    (o.position.set(t, 0, n), (o.castShadow = !0), e.level.always.add(o));
  }
  reset() {
    ((this.open = 0), (this.target = 0), (this._played = !1));
  }
  update(e, t) {
    (t && t.y < -1 && t.z > VEHICLE_RAMP.z0 - 6 && Math.abs(t.x - this.x) < 10 && (this.target = 1),
      this.target &&
        this.open < 1 &&
        ((this.open = Math.min(1, this.open + e * 0.8)),
        this._played || ((this._played = !0), this.game.audio.play(`door_clunk`, { rate: 0.6 }))));
    let n = 2 + this.open * 4.6;
    (this.body.setNextKinematicTranslation({ x: this.x, y: n, z: this.z }), (this.mesh.position.y = n));
  }
};
var ZOOM_DISTANCES = [26, 36, 50];
var CameraRig = class {
  constructor(e) {
    ((this.game = e),
      (this.cam = e.renderSys.camera),
      (this.target = new THREE.Vector3()),
      (this.look = new THREE.Vector3()),
      (this.yaw = Math.PI / 2 - 0.35),
      (this.userYaw = 0),
      (this.pitch = 0.9),
      (this.userPitch = 0),
      (this.zoom = 1),
      (this.dist = ZOOM_DISTANCES[1]),
      (this.mode = `chase`),
      (this.idle = 0),
      (this.carrierBlend = 0),
      (this.lead = new THREE.Vector3()),
      (this._sh = new THREE.Vector3()),
      (this._c = new THREE.Vector3()),
      (this._cp = new THREE.Vector3()),
      (this.orbitT = 0));
  }
  snap(e, t) {
    (this.target.set(e.x, e.y, e.z), t !== void 0 && (this.yaw = t), this.lead.set(0, 0, 0));
  }
  update(e, t, n = {}) {
    let r = this.game.input,
      i = r.takeCam();
    if (
      (Math.abs(i.yaw) + Math.abs(i.pitch) > 0 &&
        ((this.userYaw += i.yaw), (this.userPitch = clamp(this.userPitch + i.pitch, -0.35, 0.4)), (this.idle = 0)),
      i.zoom && (this.zoom = clamp(this.zoom + Math.sign(i.zoom), 0, 2)),
      r.consume(`zoom`) && (this.zoom = (this.zoom + 1) % 3),
      r.consume(`camL`) && ((this.userYaw += Math.PI / 4), (this.idle = 0)),
      r.consume(`camR`) && ((this.userYaw -= Math.PI / 4), (this.idle = 0)),
      (this.idle += e),
      n.orbit)
    ) {
      this.orbitT += e * 0.06;
      let t = n.orbit.r,
        r = n.orbit.h,
        i = n.orbit.p;
      (this.cam.position.set(i.x + Math.sin(this.orbitT) * t, i.y + r, i.z + Math.cos(this.orbitT) * t),
        this.cam.lookAt(i.x, i.y + n.orbit.ly, i.z));
      return;
    }
    if (n.path) {
      (this.cam.position.copy(n.path.pos), this.cam.lookAt(n.path.look));
      return;
    }
    let a = t,
      o = a.vel || { x: 0, z: 0 },
      s = a.flying ? 0.5 : 0.45;
    ((this.lead.x = damp(this.lead.x, clamp(o.x * s, -9, 9), 2.5, e)),
      (this.lead.z = damp(this.lead.z, clamp(o.z * s, -9, 9), 2.5, e)));
    let c = this._c.set(a.x + this.lead.x, a.y, a.z + this.lead.z),
      l = +!!n.carrierView;
    ((this.carrierBlend = damp(this.carrierBlend, l, 5, e)),
      this.carrierBlend > 0.01 &&
        n.carrierPos &&
        c.lerp(this._cp.set(n.carrierPos.x, 0, n.carrierPos.z), this.carrierBlend));
    let u = a.snap ? 60 : 7;
    ((this.target.x = damp(this.target.x, c.x, u, e)),
      (this.target.z = damp(this.target.z, c.z, u, e)),
      (this.target.y = damp(this.target.y, c.y, a.flying ? 3 : 6, e)));
    let d = this.game.save.options.camera;
    (d === `chase` &&
      a.heading !== void 0 &&
      a.speed > 3 &&
      this.idle > 1.2 &&
      (this.yaw = dampAngle(this.yaw, a.heading, 0.9, e)),
      d === `chase` && this.idle > 3 && a.speed > 3 && (this.userYaw = damp(wrapAngle(this.userYaw), 0, 0.7, e)));
    let f = this.yaw + this.userYaw,
      p = (n.underground ? 1.12 : a.flying ? 1 : 0.88) + this.userPitch,
      m =
        ZOOM_DISTANCES[this.zoom] * (n.underground ? 0.82 : 1) * (a.distK || 1) +
        (a.flying ? 10 : 0) +
        this.carrierBlend * 22;
    (a.big && (m += 4), (this.dist = damp(this.dist, m, 4, e)), (p = clamp(p, 0.45, 1.35)));
    let h = Math.cos(p) * this.dist,
      g = Math.sin(p) * this.dist,
      _ = this.game.fx.shakeOffset(this._sh);
    (this.cam.position.set(
      this.target.x - Math.sin(f) * h + _.x,
      this.target.y + g + _.y,
      this.target.z - Math.cos(f) * h + _.z,
    ),
      this.look.set(this.target.x + _.x * 0.5, this.target.y + 1.2, this.target.z + _.z * 0.5),
      this.cam.lookAt(this.look),
      (this.viewYaw = f));
  }
};
var TRIAL_TARGETS = { platinum: 80, gold: 100, silver: 130, bronze: 170 };
var Game = class {
  constructor({ renderSys: e, audio: t, input: n, save: r, ui: i }) {
    ((this.renderSys = e),
      (this.scene = e.scene),
      (this.audio = t),
      (this.input = n),
      (this.save = r),
      (this.ui = i),
      (this.time = 0),
      (this.state = `boot`),
      (this.mode = `mission`),
      (this.acc = 0),
      (this.timeScale = 1),
      (this.hitStopT = 0),
      (this.activeArea = `surface`),
      (this.missionTime = 0),
      (this.carrierSafe = !1),
      (this.pendingPressed = { action: !1, alt: !1 }));
  }
  async init(e = () => {}) {
    (e(0.05, `Physics`),
      (this.physics = new Physics()),
      (this.fx = new Effects(this.scene)),
      e(0.1, `Level`),
      (this.level = new Level(this)),
      (this.bricks = new BrickSystem({
        scene: this.level.surface,
        physics: this.physics,
        fx: this.fx,
        audio: this.audio,
      })),
      (this.bricksUnder = new BrickSystem({
        scene: this.level.under,
        physics: this.physics,
        fx: this.fx,
        audio: this.audio,
      })),
      this.level.build(),
      e(0.35, `Bricks`),
      this.bricks.finalize(),
      this.bricksUnder.finalize(),
      this._bindBrickEvents(this.bricks),
      this._bindBrickEvents(this.bricksUnder),
      e(0.5, `Carrier`),
      (this.carrier = new Carrier(this, this.level.route)),
      this.carrier.computeHits(this.bricks.buildings),
      (this.countable = this.bricks.buildings.filter((e) => e.counts)),
      e(0.6, `Vehicles`),
      (this.vehicles = {
        swingback: new Vehicle(this, VEHICLE_SPECS.swingback, SPAWNS.backlash),
        bullram: new Vehicle(this, VEHICLE_SPECS.bullram, SPAWNS.dozer),
        arbalest: new Vehicle(this, VEHICLE_SPECS.arbalest, SPAWNS.ballista),
        patrol: new Vehicle(this, VEHICLE_SPECS.patrol, SPAWNS.police),
        stomper: new Stomper(this, SPAWNS.jbomb),
      }),
      (this.vehicleList = Object.values(this.vehicles)),
      (this.player = new Player(this, { x: SPAWNS.backlash.x, y: 0, z: SPAWNS.backlash.z - 4, yaw: 0 })),
      (this.train = new SubwayTrain(this)),
      this.level.under.add(this.train.group),
      e(0.72, `Props`));
    let t = [...rduLayout(), ...this.level.mazeRDUs];
    ((this.rdus = new Rdus(this, t)),
      (this.cps = new CommPoints(this, COMM_POINTS)),
      (this.tnt = new Tnt(this, SPAWNS.tnt)),
      (this.block = new ConcreteBlock(this)),
      (this.cars = PARKED_CARS.map((e) => new ParkedCar(this, e))),
      (this.breakables = new Breakables(this, this.level.trees, this.level.lamps)),
      (this.ammo = new AmmoCrates(this, AMMO_CRATES)),
      (this.weapons = new Weapons(this)),
      (this.people = new People(this)),
      (this.rollerDoor = new RollerDoor(this)),
      this._makeArrows(),
      (this.cam = new CameraRig(this)),
      (this.mapBounds = MAP_BOUNDS),
      (this.totals = {
        buildings: this.countable.length,
        rdus: this.rdus.total,
        survivors: this.countable.reduce((e, t) => e + (t.survivors || 0), 0),
        cps: this.cps.total,
        scientists: 1,
      }),
      e(0.85, `Ready`),
      (this.controlled = this.vehicles.swingback),
      (this.vehicles.swingback.driver = this.player),
      this.player.setActive(!1),
      this._resetMissionState(),
      (this.state = `title`),
      this._applyArea(`surface`, !0),
      console.log(
        `[BBB] bricks`,
        this.bricks.totalBricks,
        `+`,
        this.bricksUnder.totalBricks,
        `path buildings`,
        this.carrier.pathBuildings.map((e) => e.id).join(`,`),
        `route`,
        this.level.route.length.toFixed(0) + `m`,
      ),
      e(1, `Done`));
  }
  allBuildings() {
    return [...this.bricks.buildings, ...this.bricksUnder.buildings];
  }
  bricksFor(e) {
    return e.sys;
  }
  focusPos() {
    let e = this.controlled.pos;
    return { x: e.x, y: e.y, z: e.z };
  }
  hitStop(e) {
    this.hitStopT = Math.max(this.hitStopT, e);
  }
  _makeArrows() {
    this.arrows = [];
    let e = arrowModel();
    for (let t of this.carrier.pathBuildings) {
      let n = new THREE.MeshStandardNodeMaterial({ color: 0, roughness: 0.5 });
      ((n.emissive = new THREE.Color(3407701)), (n.emissiveIntensity = 2.2));
      let r = new THREE.Mesh(e, n);
      (r.position.set(t.cx, t.top + 3, t.cz),
        (r.castShadow = !1),
        this.level.surface.add(r),
        this.arrows.push({ b: t, m: r, mat: n }));
    }
  }
  _bindBrickEvents(e) {
    (e.on(`hit`, (e, t, n, r, i) => {
      (i && this.audio.play(`glass`, { pos: n, jitter: 0.2, vol: 0.7 }),
        this.fx.dust(n.x, n.y, n.z, Math.min(8, 2 + Math.floor(t / 15)), 1.4),
        (e.counts || e.kind === `door`) && this.ui.showBuildingHP(e));
    }),
      e.on(`nohit`, (e, t, n) => {
        (this._noHitT && this.time - this._noHitT < 0.8) ||
          ((this._noHitT = this.time),
          this.audio.play(`hit_light`, { pos: t, rate: 1.4 }),
          this.fx.sparks(t.x, t.y, t.z, 6),
          e.kind === `door` &&
            this.ui.popup(e.id === `D1` ? `NEEDS EXPLOSIVES!` : `NEEDS MISSILES!`, t.x, t.y + 2, t.z, `warn`));
      }),
      e.on(`chunk`, (e, t) => {
        this.audio.play(`brick_clatter`, { pos: { x: e.cx, y: 3, z: e.cz }, vol: 1 });
      }),
      e.on(`clatter`, (e) => {
        rng() < 0.35 &&
          this.audio.play(`brick_clatter`, {
            pos: this.focusPos(),
            vol: clamp(e / 12, 0.15, 0.6),
            jitter: 0.3,
            minGap: 0.08,
          });
      }),
      e.on(`collapse`, (e, t) => this._onCollapse(e, t)));
  }
  _onCollapse(e, t) {
    let n = { x: e.cx, y: e.baseY + 3, z: e.cz };
    this.audio.play(`collapse`, { pos: n, vol: 1.1 });
    let r = Math.max(e.w, e.d);
    this.fx.bigDust(e.cx, e.baseY, e.cz, r * 0.6, (e.top - e.baseY) * 0.4, clamp(Math.round(r * 3), 14, 50));
    let i = this.focusPos(),
      a = Math.hypot(i.x - e.cx, i.z - e.cz);
    if ((this.fx.shake(clamp(0.6 - a / 120, 0.1, 0.6)), e.kind === `door`)) {
      (this.ui.banner(e.id === `D1` ? `BLAST DOOR OPEN!` : `HANGAR OPEN!`, `good`, 1.6),
        this.audio.playJingle(`celebration`, 0.4));
      return;
    }
    if (e.counts) {
      if (
        (this.ui.popup(e.name.toUpperCase() + ` DESTROYED`, e.cx, e.top + 1, e.cz, e.inPath ? `path` : `good`),
        e.survivors &&
          (this.people.spawnSurvivors(e),
          (this.survivorsFound += e.survivors),
          this.audio.play(`survivor`, { vol: 1 }),
          this.ui.toast(`+${e.survivors} SURVIVOR${e.survivors > 1 ? `S` : ``} RESCUED`, `good`)),
        e.inPath)
      ) {
        let e = this.carrier.pathBuildings.filter((e) => !e.collapsed).length;
        (this.ui.toast(e ? `PATH OBSTACLE CLEARED — ${e} LEFT` : `CARRIER PATH CLEAR!`, `path`),
          !e && this.mode === `trial` && this.state === `play` && this._finishTrial());
      }
      this._checkFull();
    }
  }
  onVehicleImpact(e, t, n, r, i, a) {
    if (n <= 0) return;
    let o = n > 35;
    (this.audio.play(o ? `hit_heavy` : `hit_light`, {
      pos: i,
      vol: clamp(n / 60, 0.5, 1.2),
      jitter: 0.12,
      minGap: 0.05,
    }),
      this.fx.sparks(i.x, i.y, i.z, o ? 12 : 5),
      this.fx.shake(clamp(n / 170, 0.06, 0.55)),
      e === this.controlled && this.input.rumble(clamp(n / 90, 0.2, 1), 140),
      n > 60 && this.hitStop(0.05),
      e === this.controlled && a === `rear` && n > 45 && e.id === `swingback`
        ? this.ui.popup(`TAILGATE SMASH!`, i.x, i.y + 3, i.z, `hit`)
        : n > 90 && this.ui.popup(`HUGE HIT!`, i.x, i.y + 3, i.z, `hit`));
  }
  explosion(e, t, n, r, i, a, o, s = null, c = 1) {
    (this.fx.explosion(e, t, n, c),
      this.renderSys.flash(e, t, n, 70 * c),
      this.audio.play(`explosion`, { pos: { x: e, y: t, z: n }, vol: clamp(c, 0.5, 1.2), jitter: 0.1 }));
    let l = this.focusPos(),
      u = Math.hypot(l.x - e, l.z - n);
    (this.fx.shake(clamp((0.8 - u / 60) * c, 0.05, 0.8)),
      u < 40 && this.input.rumble(clamp((1 - u / 40) * c, 0.2, 1), 220));
    for (let c of this.allBuildings()) {
      if (c.collapsed || c === s) continue;
      let l = c.aabb,
        u = Math.max(l.minX - e, 0, e - l.maxX),
        d = Math.max(l.minZ - n, 0, n - l.maxZ),
        f = Math.max(l.minY - t, 0, t - l.maxY),
        p = Math.hypot(u, f, d);
      if (p > r) continue;
      let m = i * (1 - (p / r) * 0.6),
        h = { x: clamp(e, l.minX, l.maxX), y: clamp(t, l.minY + 0.5, l.maxY - 0.5), z: clamp(n, l.minZ, l.maxZ) };
      c.sys.damage(c, m, h, a === `missile` ? `missile` : `explosion`, { x: h.x - e, z: h.z - n }, o);
    }
    let d = (i) => {
      if (!i || !i.isEnabled() || !i.isDynamic()) return;
      let a = i.translation(),
        o = a.x - e,
        s = a.y - t,
        l = a.z - n,
        u = Math.hypot(o, s, l);
      if (u > r * 1.4 || u < 0.01) return;
      let d = (1 - u / (r * 1.4)) * 12 * i.mass() * c;
      i.applyImpulse({ x: (o / u) * d, y: d * 0.6, z: (l / u) * d }, !0);
    };
    for (let e of [this.bricks, this.bricksUnder]) for (let t of e.moving) t.body && d(t.body);
    for (let e of this.cars) d(e.body);
    if ((d(this.block.body), this.tnt.state === `idle` || this.tnt.state === `lit`)) {
      let i = this.tnt.pos;
      Math.hypot(i.x - e, i.y - t, i.z - n) < r && this.tnt !== o && this.tnt.explode();
    }
  }
  onCollect(e, t) {
    (e === `rdu`
      ? this.rdus.count === this.rdus.total &&
        (this.ui.banner(`ALL RDUs LIT!`, `good`, 2), this.audio.playJingle(`celebration`))
      : e === `cp`
        ? this.ui.banner(`COMMUNICATION POINT ACTIVATED`, `good`, 2.2)
        : e === `scientist` && (this.ui.banner(`SCIENTIST FOUND!`, `good`, 3), this.audio.playJingle(`scientist`, 0.2)),
      this._checkFull());
  }
  _checkFull() {
    this.mode !== `mission` ||
      this.fullDone ||
      (this.completion().pct >= 100 &&
        this.carrierSafe &&
        ((this.fullDone = !0),
        (this.fullTime = this.missionTime),
        this.ui.banner(`100% COMPLETE!`, `gold`, 3),
        this.audio.playJingle(`accomplishment`, 0.2)));
  }
  completion() {
    let e = this.totals,
      t = this.countable.filter((e) => e.collapsed).length;
    return {
      cats: {
        buildings: [t, e.buildings],
        rdus: [this.rdus.count, e.rdus],
        survivors: [this.survivorsFound, e.survivors],
        cps: [this.cps.count, e.cps],
      },
      pct: Math.floor(
        ((t / e.buildings + this.rdus.count / e.rdus + this.survivorsFound / e.survivors + this.cps.count / e.cps) /
          4) *
          100 +
          1e-6,
      ),
      scientist: +!!this.people.sciFound,
    };
  }
  _resetMissionState() {
    ((this.missionTime = 0),
      (this.carrierSafe = !1),
      (this.fullDone = !1),
      (this.fullTime = null),
      (this.survivorsFound = 0),
      (this.trialTime = null),
      (this.crashB = null),
      (this._fireworks = 0));
  }
  resetWorld() {
    (this.weapons.clear(),
      this.bricks.reset(),
      this.bricksUnder.reset(),
      this.fx.reset(),
      this.rdus.reset(),
      this.cps.reset(),
      this.tnt.fullReset(),
      this.block.reset());
    for (let e of this.cars) e.reset();
    (this.breakables.reset(), this.ammo.reset(), this.people.reset(), this.rollerDoor.reset());
    let e = SPAWNS,
      t = this.vehicles;
    (t.swingback.teleport(e.backlash.x, e.backlash.y, e.backlash.z, e.backlash.yaw),
      t.bullram.teleport(e.dozer.x, e.dozer.y, e.dozer.z, e.dozer.yaw),
      t.arbalest.teleport(e.ballista.x, e.ballista.y, e.ballista.z, e.ballista.yaw),
      t.patrol.teleport(e.police.x, e.police.y, e.police.z, e.police.yaw),
      t.stomper.teleport(e.jbomb.x, e.jbomb.y, e.jbomb.z, e.jbomb.yaw),
      (t.arbalest.ammo = 6),
      (t.stomper.fuel = 100),
      (t.stomper.diving = !1));
    for (let e of this.vehicleList)
      ((e.driver = null),
        (e.sirenOn = !1),
        e.cool.clear(),
        (e.boostT = 0),
        (e.boostCd = 0),
        (e.engineLoop &&= (e.engineLoop.stop(), null)),
        (e.skidLoop &&= (e.skidLoop.stop(), null)));
    ((this.train.z = SUBWAY.zA),
      (this.train.v = 0),
      (this.train.dest = `B`),
      (this.train.driver = null),
      this.train.body.setTranslation({ x: SUBWAY.x, y: this.train.y, z: this.train.z }, !0),
      this.physics.resetInterp(this.train.rec));
    for (let e of this.arrows) e.m.visible = !0;
    (this.carrier.reset(this.save.options.carrierPace === `relaxed` ? CARRIER_SPEED_RELAXED : CARRIER_SPEED),
      this.player.setActive(!1),
      (this.controlled = t.swingback),
      (t.swingback.driver = this.player),
      this._resetMissionState(),
      this.cam.snap(t.swingback.pos, e.backlash.yaw - 0.5),
      (this.cam.userYaw = 0),
      (this.cam.zoom = 1),
      this._applyArea(`surface`, !0),
      (this.acc = 0));
  }
  startMission(e = `mission`) {
    ((this.mode = e),
      (this.runId = (this.runId || 0) + 1),
      this.input.clearPresses(),
      (this.pendingPressed.action = !1),
      (this.pendingPressed.alt = !1),
      (this.hitStopT = 0),
      this.resetWorld(),
      this.save.data.stats.plays++,
      this.save.save(),
      e === `trial`
        ? ((this.state = `countdown`),
          (this.countT = 3.2),
          this.audio.playMusic(`level_critical`, 0.6),
          this.ui.showHUD(!0, e))
        : ((this.state = `briefing`),
          (this.briefT = 0),
          this.audio.playMusic(`briefing`, 0.6),
          this.ui.showBriefing(this)));
  }
  skipBriefing() {
    this.state === `briefing` &&
      ((this.state = `countdown`),
      (this.countT = 3.2),
      this.input.clearPresses(),
      this.ui.hideBriefing(),
      this.ui.showHUD(!0, this.mode),
      this.cam.snap(this.controlled.pos));
  }
  _go() {
    ((this.state = `play`),
      this.ui.banner(`GO!`, `go`, 1),
      this.audio.play(`go`, { vol: 1 }),
      this.mode === `mission` && ((this.carrier.running = !0), this.audio.playMusic(`level`, 0.5)));
  }
  pause(e) {
    e && this.state === `play`
      ? ((this.state = `paused`), this.ui.showPause(!0), this.audio.stopAllLoops())
      : !e && this.state === `paused` && ((this.state = `play`), this.ui.showPause(!1), this.input.clearPresses());
  }
  onCarrierArrived() {
    ((this.carrierSafe = !0),
      this.ui.banner(`CARRIER SAFE!`, `gold`, 3.5),
      this.audio.playJingle(`mission_complete`, 0.15),
      this.save.awardMedal(`carrier`, `gold`),
      (this.save.data.trialUnlocked = !0),
      this.save.data.stats.carrierSaved++,
      (this.save.data.best.missionTime == null || this.missionTime < this.save.data.best.missionTime) &&
        (this.save.data.best.missionTime = this.missionTime),
      this.save.save());
    let e = this.runId;
    ((this._replayMusicAt = this.time + 5.2),
      setTimeout(() => {
        this.state === `play` &&
          this.runId === e &&
          this.carrierSafe &&
          (this.audio.playMusic(`replay`, 1.2),
          this.ui.toast(
            `Keep going for 100%: flatten every building, light every RDU, rescue survivors, find comm points — then return to the HQ truck.`,
            `info`,
            7,
          ));
      }, 5200));
    for (let e of this.arrows) e.m.visible = !1;
    ((this._fireworks = 10), this._checkFull());
  }
  onCarrierCrash(e) {
    if (this.state !== `play`) return;
    ((this.crashB = e),
      (this.state = `crash`),
      (this.crashT = 0),
      this.activeArea !== `surface` && (this.ui.fade(), this._applyArea(`surface`)));
    let t = this.carrier.position;
    (this.audio.stopMusic(0.2),
      this.audio.play(`nuke`, { vol: 1.3 }),
      this.audio.play(`klaxon`, { vol: 1 }),
      this.fx.explosion(t.x, 2, t.z, 3),
      this.fx.bigDust(t.x, 0, t.z, 10, 6, 60, 9075306),
      this.fx.ring(t.x, 0.5, t.z, 2, 60, 1.6, 16773824),
      this.renderSys.flash(t.x, 4, t.z, 400, 16769696),
      this.fx.shake(1.2),
      this.ui.whiteFlash(),
      (this.carrier.tractor.visible = !1),
      (this.carrier.trailer.visible = !1),
      e.sys.collapse(e, { x: t.x, y: 2, z: t.z }, `explosion`));
  }
  endMission() {
    if (this.mode === `trial`) return;
    if (!this.carrierSafe) {
      this.ui.toast(`The carrier is still en route — clear its path first!`, `warn`);
      return;
    }
    this.state = `results`;
    let e = this.completion(),
      t = e.pct >= 100 ? `gold` : e.pct >= 80 ? `silver` : e.pct >= 50 ? `bronze` : null,
      n = this.save.awardMedal(`demolition`, t),
      r = this.save.data.best,
      i = e.pct > r.completion;
    (i && (r.completion = e.pct),
      e.pct >= 100 && (r.fullTime == null || this.missionTime < r.fullTime) && (r.fullTime = this.missionTime),
      e.scientist && (this.save.data.stats.scientists = 1));
    let a = this.save.save();
    (this.audio.stopAllLoops(),
      this.audio.playMusic(`results`, 0.8),
      this.ui.showHUD(!1),
      this.ui.showResults({
        mode: `mission`,
        time: this.missionTime,
        completion: e,
        medals: { carrier: `gold`, demolition: t },
        newMedal: n,
        newBest: i,
        saved: a,
        totals: this.totals,
      }));
  }
  _finishTrial() {
    ((this.trialTime = this.missionTime),
      (this.state = `trialdone`),
      (this.trialDoneT = 0),
      this.audio.playJingle(`mission_complete`, 0.1),
      this.ui.banner(`PATH CLEAR — ` + formatTime(this.trialTime), `gold`, 2.5));
  }
  _showTrialResults() {
    this.state = `results`;
    let e = this.trialTime,
      t = TRIAL_TARGETS,
      n =
        e <= t.platinum
          ? `platinum`
          : e <= t.gold
            ? `gold`
            : e <= t.silver
              ? `silver`
              : e <= t.bronze
                ? `bronze`
                : null,
      r = this.save.awardMedal(`trial`, n),
      i = this.save.data.best,
      a = i.trialTime == null || e < i.trialTime;
    a && (i.trialTime = e);
    let o = this.save.save();
    (this.audio.stopAllLoops(),
      this.audio.playMusic(`results`, 0.8),
      this.ui.showHUD(!1),
      this.ui.showResults({
        mode: `trial`,
        time: e,
        medals: { trial: n },
        newMedal: r,
        newBest: a,
        saved: o,
        targets: t,
      }));
  }
  quitToTitle() {
    ((this.state = `title`),
      this._applyArea(`surface`, !0),
      this.audio.stopAllLoops(),
      this.audio.playMusic(`title`, 0.8),
      this.ui.showHUD(!1),
      this.ui.showTitle());
  }
  respawnPlayer() {
    let e = HQ.spawn;
    this.player.setActive(!0, e.x, 0, e.z + 6, 0);
  }
  _nearestEnterable() {
    let e = this.player.pos,
      t = null,
      n = 4.8;
    for (let r of this.vehicleList) {
      if (r.driver) continue;
      let i = r.pos;
      if (Math.abs(i.y - e.y) > 4) continue;
      let a = r.spec,
        o = e.x - i.x,
        s = e.z - i.z,
        c = Math.cos(r.yaw),
        l = Math.sin(r.yaw),
        u = o * c - s * l,
        d = o * l + s * c,
        f = Math.max(Math.abs(u) - a.hx, 0),
        p = Math.max(Math.abs(d) - a.hz, 0),
        m = Math.hypot(f, p);
      m < n && ((n = m), (t = r));
    }
    let r = this.train.pos;
    if (e.y < -6 && this.train.speed < 0.5 && e.x > -111 && e.x < -91) {
      let i = Math.max(Math.abs(e.x - r.x) - 1.5, 0) * 0.45,
        a = Math.max(Math.abs(e.z - r.z) - 7, 0);
      Math.hypot(i, a) < Math.min(n, 4.8) + 0.01 && (t = this.train);
    }
    return t;
  }
  _nearTruck() {
    let e = HQ.truck,
      t = this.controlled.pos;
    return Math.hypot(t.x - (e.x - 12), t.z - e.z) < (this.controlled === this.player ? 5 : 8);
  }
  _tryEnterExit() {
    if (this.carrierSafe && this.mode === `mission` && this.controlled !== this.train && this._nearTruck())
      return this.endMission();
    if (this.controlled === this.player) {
      let e = this._nearestEnterable();
      if (e) return this._enter(e);
      let t = HQ.truck,
        n = this.player.pos;
      return Math.hypot(n.x - (t.x - 12), n.z - t.z) < 6 ? this.endMission() : void 0;
    }
    let e = this.controlled;
    if (e === this.train) {
      if (this.train.speed > 0.8 || !this.train.station()) {
        this.ui.toast(`Wait until the shuttle stops at a platform`, `warn`);
        return;
      }
      let e = this.train.exitSpot();
      this._exitTo(e.x, e.y, e.z, e.yaw);
      return;
    }
    if (e instanceof Stomper && !e.grounded) {
      this.ui.toast(`Land first!`, `warn`);
      return;
    }
    if (e.speed > 9) {
      this.ui.toast(`Slow down to jump out`, `warn`);
      return;
    }
    let t = this._findExitSpot(e);
    this._exitTo(t.x, t.y, t.z, e.yaw);
  }
  _findExitSpot(e) {
    let t = e.pos,
      n = e.spec,
      r = Math.cos(e.yaw),
      i = Math.sin(e.yaw),
      a = t.y - n.hy - n.clearance,
      o = [
        [-(n.hx + 1.3), 0],
        [n.hx + 1.3, 0],
        [0, -(n.hz + 1.5)],
        [0, n.hz + 1.5],
        [-(n.hx + 2.6), 0],
        [n.hx + 2.6, 0],
      ],
      s = new RAPIER.Capsule(0.45, 0.42);
    for (let [n, c] of o) {
      let o = t.x + n * r + c * i,
        l = t.z - n * i + c * r,
        u = !1;
      if (
        (this.physics.world.intersectionsWithShape(
          { x: o, y: a + 1.08, z: l },
          { x: 0, y: 0, z: 0, w: 1 },
          s,
          () => ((u = !0), !1),
          void 0,
          groups(GROUP.PLAYER, GROUP.STATIC | GROUP.BUILDING | GROUP.VEHICLE | GROUP.PROP),
          void 0,
          e.body,
        ),
        !u)
      )
        return { x: o, y: a, z: l };
    }
    return { x: t.x, y: t.y + n.hy + 0.5, z: t.z };
  }
  _enter(e) {
    (this.player.setActive(!1),
      (e.driver = this.player),
      (this.controlled = e),
      this.audio.play(`door_clunk`, { pos: e.pos }),
      this.ui.toast(
        e.name + (e.spec ? ` — ` + e.spec.blurb : ` — W/↑ to ride to the other platform, E to step off`),
        `info`,
        4.5,
      ),
      e.spec && e.spec.missiles && e.ammo === void 0 && (e.ammo = 6),
      (this.cam.idle = 2));
  }
  _exitTo(e, t, n, r) {
    let i = this.controlled;
    ((i.driver = null),
      (i.engineLoop &&= (i.engineLoop.stop(), null)),
      (i.skidLoop &&= (i.skidLoop.stop(), null)),
      this.player.setActive(!0, e, t, n, r),
      (this.controlled = this.player),
      this.audio.play(`door_clunk`, { pos: { x: e, y: t, z: n } }));
  }
  _applyArea(e, t = !1) {
    (t || e !== this.activeArea) &&
      ((this.activeArea = e), this.renderSys.setArea(e), this.level.setArea(e), this.fx.setArea(e));
  }
  _buildCtrl() {
    let e = this.input,
      t = e.drive(),
      n = e.moveStick(),
      r = this.cam.viewYaw ?? this.cam.yaw,
      i = Math.sin(r),
      a = Math.cos(r),
      o = -Math.cos(r),
      s = Math.sin(r),
      c = i * n.y + o * n.x,
      l = a * n.y + s * n.x,
      u = Math.hypot(c, l);
    return {
      throttle: t.throttle,
      steer: t.steer,
      pointGo: e.usePointToGo(),
      stick: n,
      camYaw: r,
      move: { x: u > 0 ? c / u : 0, z: u > 0 ? l / u : 0, mag: n.mag },
      action: e.isHeld(`action`),
      alt: e.isHeld(`alt`),
      actionPressed: !1,
      altPressed: !1,
    };
  }
  update(e) {
    let t = Math.min(0.1, e);
    this.time += t;
    let n = this.input;
    (n.poll(t),
      n.consume(`diag`) &&
        ((this.save.options.diagnostics = !this.save.options.diagnostics), this.save.save(), this.ui.applyOptions()),
      n.consume(`mute`) &&
        (this.audio.setMuted(!this.audio.muted),
        (this.save.options.muted = this.audio.muted),
        this.save.save(),
        this.ui.toast(this.audio.muted ? `Muted` : `Sound on`)));
    let r = this.state;
    if (r === `play` || r === `countdown` || r === `crash` || r === `trialdone`) {
      if (r === `play` && n.consume(`pause`)) return (this.pause(!0), this._render(t, 0));
      let e = null;
      if (
        (r === `play`
          ? ((e = this._buildCtrl()),
            (this.pendingPressed.action = this.pendingPressed.action || n.consume(`action`)),
            (this.pendingPressed.alt = this.pendingPressed.alt || n.consume(`alt`)),
            n.consume(`enter`) && this._tryEnterExit(),
            (this._carrierView = n.isHeld(`carrier`)))
          : (n.clearPresses(), (this._carrierView = !1)),
        r === `countdown`)
      ) {
        let e = Math.ceil(this.countT);
        this.countT -= t;
        let n = Math.ceil(this.countT);
        (n !== e && n > 0 && (this.ui.banner(String(n), `count`, 0.8), this.audio.play(`countdown`)),
          this.countT <= 0 && this._go());
      }
      let i = t;
      (this.hitStopT > 0 && ((this.hitStopT -= t), (i = t * 0.2)), (this.acc += i));
      let a = 0;
      for (; this.acc >= 0.016666666666666666 && a < 5; ) {
        let t = e;
        (e &&
          a === 0 &&
          ((t = { ...e, actionPressed: this.pendingPressed.action, altPressed: this.pendingPressed.alt }),
          (this.pendingPressed.action = !1),
          (this.pendingPressed.alt = !1)),
          this._fixed(FIXED_DT, t),
          (this.acc -= FIXED_DT),
          a++);
      }
      return (
        a === 5 && (this.acc = 0),
        r === `crash` &&
          ((this.crashT += t),
          this.crashT > 3.4 &&
            this.state === `crash` &&
            ((this.state = `failed`),
            this.audio.stopAllLoops(),
            this.audio.playMusic(`fail`, 0.5),
            this.ui.showHUD(!1),
            this.ui.showFail(this.crashB))),
        r === `trialdone` && ((this.trialDoneT += t), this.trialDoneT > 2.6 && this._showTrialResults()),
        this._render(t, this.acc / FIXED_DT)
      );
    }
    return r === `briefing`
      ? ((this.briefT += t),
        (n.consume(`action`) || n.consume(`enter`) || n.consume(`pause`)) && this.skipBriefing(),
        this.briefT > 14 && this.skipBriefing(),
        this._render(t, 1))
      : r === `paused`
        ? (n.consume(`pause`) && this.ui.current === `pause` && this.pause(!1), this._render(t, 1, !0))
        : (n.clearPresses(), this._render(t, 1));
  }
  _fixed(e, t) {
    let n = this.state === `play`;
    n && (this.missionTime += e);
    for (let r of this.vehicleList) {
      let i = r === this.controlled && n ? t : null;
      r.fixedUpdate(e, i);
    }
    (this.controlled === this.player && this.player.fixedUpdate(e, n ? t : null),
      this.train.fixedUpdate(e, this.controlled === this.train && n ? t : null),
      this.carrier.fixedUpdate(e),
      this.tnt.fixedUpdate(e),
      this.weapons.step(e),
      this.physics.step(),
      this.physics.drainCollisions(() => {}));
    for (let t of this.vehicleList) t.postStep(e);
    (this.bricks.step(e), this.bricksUnder.step(e));
    let r = this.controlled,
      i = r.pos;
    if (n) {
      let t = r === this.player ? 2.4 : (r.radius || 2) + 1.4;
      (this.rdus.check(i.x, i.y, i.z, t, e),
        this.cps.check(i.x, i.y, i.z),
        this.people.checkScientist(i.x, i.y, i.z),
        r !== this.player &&
          r !== this.train &&
          i.y > -2 &&
          i.y < 5 &&
          this.breakables.check(i.x, i.z, r.radius * 0.8, r.speed),
        this.controlled,
        this.player);
    }
    if ((this.rollerDoor.update(e, i), this.state === `play` || this.state === `countdown`)) {
      let e = i.y < -3.5 ? `underground` : i.y > -2.5 ? `surface` : this.activeArea;
      e !== this.activeArea && (this.ui.fade(), this._applyArea(e));
    }
  }
  _render(e, t, n = !1) {
    let r = this.renderSys;
    this.physics.interpolate(t);
    for (let r of this.vehicleList) r.render(t, n ? 0 : e);
    ((this.controlled === this.player || this.player.active) && this.player.render(t, n ? 0 : e),
      this.carrier.render(t, this.time),
      this.bricks.render(t),
      this.bricksUnder.render(t),
      this.weapons.render(t),
      n ||
        (this._fireworks > 0 &&
          Math.random() < e * 4 &&
          (this._fireworks--,
          this.fx.firework(222 + Math.random() * 24, 18 + Math.random() * 14, -100 + Math.random() * 22),
          this.audio.play(`explosion`, { pos: { x: 234, y: 20, z: -90 }, vol: 0.35, rate: 1.6, jitter: 0.2 })),
        this.fx.update(e),
        this.rdus.update(e),
        this.cps.update(e, this.time),
        this.people.update(e, this.time),
        this.ammo.update(e, this.time, this.controlled),
        this.level.update(e, this.time, this.state === `play` || this.state === `countdown` ? this.focusPos() : null)));
    for (let e of this.vehicleList) {
      let t = e.pos.y < -3 ? `underground` : `surface`;
      ((e.group.visible = e === this.controlled || t === this.activeArea),
        e.reticle && !e.group.visible && (e.reticle.visible = !1));
    }
    this.player.group.visible =
      this.player.active &&
      (this.controlled === this.player || (this.player.pos.y < -3 ? `underground` : `surface`) === this.activeArea);
    let i = this.activeArea === `surface`;
    this.carrier.tractor.visible = this.carrier.trailer.visible = i && !this.carrier.destroyed;
    for (let t of this.arrows) {
      if (t.b.collapsed || this.carrierSafe) {
        t.m.visible = !1;
        continue;
      }
      t.m.visible = !0;
      let n = this.mode === `trial` ? 60 : this.carrier.ttcOf(t.b),
        r = n > 45 ? 3407701 : n > 30 ? 16769082 : n > 18 ? 16751146 : n > 8 ? 16726570 : 10487816;
      t.mat.emissive.setHex(r);
      let i = n < 8 ? (Math.sin(this.time * 18) > 0 ? 1 : 0.2) : 1;
      ((t.mat.emissiveIntensity = 2.4 * i),
        (t.m.position.y = t.b.top + 3 + Math.sin(this.time * 3 + t.b.cx) * 0.6),
        (t.m.rotation.y += e * 1.5));
    }
    this._vehicleAudio(e);
    let a = this.state;
    if (a === `title` || a === `results` || a === `failed`) {
      let t = a === `title` ? { x: 70, y: 0, z: -80 } : this.focusPos();
      this.cam.update(e, null, {
        orbit: { p: t, r: a === `title` ? 150 : 45, h: a === `title` ? 95 : 32, ly: a === `title` ? 12 : 2 },
      });
    } else if (a === `briefing`) {
      let t = this.level.route,
        n = 20 + clamp(this.briefT / 13, 0, 1) * (t.length - 40),
        r = t.sample(n),
        i = t.sample(Math.min(t.length, n + 50)),
        a = new THREE.Vector3(r.x - Math.sin(r.yaw) * 30 + 30, 55, r.z - Math.cos(r.yaw) * 30 + 22);
      this.cam.update(e, null, { path: { pos: a, look: new THREE.Vector3(i.x, 0, i.z) } });
    } else if (a === `crash` || a === `failed`) {
      let t = this.carrier.position;
      this.cam.update(e, { x: t.x, y: 0, z: t.z, vel: { x: 0, z: 0 }, speed: 0 }, {});
    } else {
      let t = this.controlled,
        n = t.pos,
        r = t.body && t.body.isDynamic() ? t.body.linvel() : { x: 0, z: 0 },
        i = {
          x: t.group ? t.group.position.x : n.x,
          y: (t.group ? t.group.position.y : n.y) - (t.restDist ? t.restDist - 1 : 0),
          z: t.group ? t.group.position.z : n.z,
          vel: r,
          heading: t === this.player ? this.player.yaw : t === this.train ? Math.PI : t.yaw,
          speed: t.speed || 0,
          flying: t instanceof Stomper && !t.grounded,
          big: t === this.train,
          distK: t === this.player ? 0.62 : t.id === `arbalest` ? 0.8 : t.id === `patrol` ? 0.88 : 1,
        };
      (t === this.train && (i.y = this.train.pos.y),
        this.activeArea === `underground` && t === this.player && (i.distK = 0.8),
        this.cam.update(e, i, {
          underground: this.activeArea === `underground`,
          carrierView: this._carrierView && this.mode === `mission` && !this.carrierSafe,
          carrierPos: this.carrier.position,
        }));
    }
    let o = r.camera.position;
    (this.audio.setListener(o.x, o.y, o.z, this.cam.viewYaw ?? this.cam.yaw), this.audio.update());
    let s = this.state === `title` ? { x: 70, z: -80 } : this.cam.target;
    (r.focusShadows(s.x, s.z),
      (a === `play` || a === `countdown` || a === `paused` || a === `trialdone`) && this.ui.updateHUD(this),
      this.ui.updateLabels(this),
      this.debugNoRender || r.render());
  }
  _vehicleAudio(e) {
    let t = this.state === `play` || this.state === `countdown`;
    for (let e of this.vehicleList)
      if (t && e === this.controlled) {
        (!e.engineLoop || !e.engineLoop.alive) &&
          (e.engineLoop = this.audio.loop(e.spec.engine || `engine_heavy`, { vol: 0.9 }));
        let t = e.spec,
          n = clamp(Math.abs(e.vf) / (t.maxSpeed || 10), 0, 1.3),
          r = t.pitch || [0.7, 1.6];
        ((e.engineLoop.rate = e instanceof Stomper ? (e.thrusting ? 1.1 : 0.6) : r[0] + (r[1] - r[0]) * n),
          (e.engineLoop.vol = e instanceof Stomper ? (e.thrusting ? 1 : 0.15) : 0.55 + 0.45 * n),
          (e.engineLoop.pos = e.pos),
          (e.spec.handbrake || e.spec.id === `patrol`) &&
            ((!e.skidLoop || !e.skidLoop.alive) && (e.skidLoop = this.audio.loop(`skid_loop`, { vol: 0 })),
            (e.skidLoop.vol = e.grounded ? clamp((Math.abs(e.vs) - 2.5) / 6, 0, 1) : 0),
            (e.skidLoop.pos = e.pos)),
          e.sirenOn
            ? ((!e.sirenLoop || !e.sirenLoop.alive) && (e.sirenLoop = this.audio.loop(`siren`, { vol: 1 })),
              (e.sirenLoop.pos = e.pos))
            : (e.sirenLoop &&= (e.sirenLoop.stop(), null)));
      } else
        ((e.engineLoop &&= (e.engineLoop.stop(), null)),
          (e.skidLoop &&= (e.skidLoop.stop(), null)),
          (e.sirenLoop &&= (e.sirenLoop.stop(), null)));
  }
  prompt() {
    if (this.state !== `play`) return null;
    if (this.mode === `mission` && this.controlled !== this.train && this._nearTruck())
      return {
        key: `enter`,
        text: this.carrierSafe ? `End mission at HQ (results)` : `HQ truck — clear the carrier path first`,
      };
    if (this.controlled === this.player) {
      let e = this._nearestEnterable();
      return e ? { key: `enter`, text: `Enter ` + e.name } : null;
    }
    return this.controlled === this.train
      ? { key: `enter`, text: this.train.station() && this.train.speed < 0.8 ? `Step off` : `Riding… (W/↑ = go)` }
      : null;
  }
};
var $ = (e, t = document) => t.querySelector(e);
var el = (e, t = {}, n = ``) => {
  let r = document.createElement(e);
  for (let [e, n] of Object.entries(t)) e === `class` ? (r.className = n) : r.setAttribute(e, n);
  return (n && (r.innerHTML = n), r);
};
var _projVec = new THREE.Vector3();
var MEDAL_LABELS = { bronze: `BRONZE`, silver: `SILVER`, gold: `GOLD`, platinum: `PLATINUM` };
var UI = class {
  constructor(e, kit) {
    ((this.app = e),
      (this.kit = kit),
      (this.layer = el(`div`, { class: `ui-layer`, id: `ui` })),
      e.appendChild(this.layer),
      (this.stack = []),
      (this.popups = []),
      (this.labels = new Map()),
      this._build(),
      (this.mmT = 0));
    // Touch prompts and layout follow the device the player last used (the kit tracks it).
    const onSource = (src) => {
      ((this.isTouch = src === `touch`), document.body.classList.toggle(`touch`, this.isTouch), this._syncTouch());
    };
    (onSource(kit.input.source), kit.input.onSourceChange(onSource), kit.onResize(() => (this._mmW = 0)));
  }
  bind(e, t, n, r, i) {
    ((this.game = e),
      (this.rs = t),
      (this.audio = n),
      (this.save = r),
      (this.input = i),
      i.on((e, t) => this._onInput(e, t)),
      this._buildMinimapStatic(),
      this.applyOptions());
  }
  _build() {
    let e = this.layer;
    ((e.innerHTML = `
      <div id="labels" class="nopt"></div>
      <div id="hud" class="hidden nopt">
        <div id="hud-tl" class="panel"><div id="hud-mode">MISSION TIME</div><div id="hud-time">0:00.0</div><div id="hud-veh">SWINGBACK</div><div class="meter" id="hud-meter"><i></i></div><div id="hud-meter-l"></div></div>
        <div id="hud-tc" class="panel"><div id="hud-carrier-l"><span>CARRIER</span><span id="hud-cprog">0%</span></div><div class="cbar" id="hud-cbar"><i></i></div><div id="hud-next"></div></div>
        <div id="hud-warn"></div>
        <div id="hud-tr" class="panel"><canvas id="minimap" width="168" height="168"></canvas><div class="counts" id="hud-counts"></div></div>
        <div id="hud-prompt" class="hidden"></div>
        <div id="toasts"></div>
        <div id="banner"></div>
      </div>
      <div id="diag" class="hidden"></div>
      <div id="fade"></div><div id="flash"></div>
      <div id="loading" class="screen"><div class="logo"><div class="t1">${GAME_TITLE}</div></div><div class="bar"><i id="load-bar"></i></div><div id="load-txt" style="font-size:13px;color:#aaa">Loading…</div></div>
      <div id="title" class="screen hidden">
        <div class="logo"><div class="t1">BRICK BLAST<br>BRIGADE</div><div class="t2">VERTICAL SLICE · MISSION: ${MISSION_NAME}</div></div>
        <div>
          <div id="press" class="press" style="text-align:center">PRESS ANY KEY · CLICK · TAP</div>
          <div class="menu hidden" id="menu">
            <button class="btn" data-act="start">START MISSION</button>
            <button class="btn dark" data-act="trial" id="btn-trial">TIME TRIAL</button>
            <button class="btn dark" data-act="controls">CONTROLS</button>
            <button class="btn dark" data-act="options">OPTIONS</button>
            <button class="btn dark" data-act="about">ABOUT · DOCS · REPORT</button>
          </div>
          <div class="cabinet" id="cabinet"></div>
        </div>
        <div class="foot">An homage vertical slice inspired by <b>Blast Corps</b> (N64) · internal non-commercial test build<br>Generated <b>${BUILD_DATE}</b> · AI model <b>${AI_MODEL}</b></div>
      </div>
      <div id="options" class="screen hidden"><div class="card"><h2>OPTIONS</h2><div class="opt" id="opt-body"></div><div class="row" style="margin-top:18px"><button class="btn" data-act="back">BACK</button></div></div></div>
      <div id="controls" class="screen hidden"><div class="card"><h2>CONTROLS</h2><div id="ctl-body"></div><div class="row" style="margin-top:14px"><button class="btn" data-act="back">BACK</button></div></div></div>
      <div id="about" class="screen hidden"><div class="card" style="width:min(900px,100%)"><h2>ABOUT · DOCUMENTATION</h2><div class="tabs" id="doc-tabs"></div><div class="docs" id="doc-body"></div><div class="row" style="margin-top:14px"><button class="btn" data-act="back">BACK</button></div></div></div>
      <div id="briefing" class="screen hidden" style="background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.75));align-items:flex-end"><div class="card" style="width:min(640px,100%);margin-bottom:max(12px,env(safe-area-inset-bottom))"><h2>MISSION BRIEFING — ${MISSION_NAME}</h2><div id="brief-body"></div><div class="row" style="margin-top:12px"><button class="btn" data-act="skipbrief">START (SPACE / TAP)</button></div></div></div>
      <div id="pause" class="screen hidden"><div class="card" style="width:min(420px,100%)"><h2>PAUSED</h2><div class="menu">
        <button class="btn" data-act="resume">RESUME</button>
        <button class="btn dark" data-act="restart">RESTART MISSION</button>
        <button class="btn dark" data-act="end" id="btn-end">END MISSION (RESULTS)</button>
        <button class="btn dark" data-act="controls">CONTROLS</button>
        <button class="btn dark" data-act="options">OPTIONS</button>
        <button class="btn dark" data-act="fullscreen">FULLSCREEN</button>
        <button class="btn dark" data-act="quit">QUIT TO TITLE</button></div></div></div>
      <div id="results" class="screen hidden"><div class="card" id="res-card"></div></div>
      <div id="fail" class="screen hidden"><div class="card" id="fail-card"></div></div>
    `),
      (this.el = {
        hud: $(`#hud`, e),
        time: $(`#hud-time`, e),
        mode: $(`#hud-mode`, e),
        veh: $(`#hud-veh`, e),
        meter: $(`#hud-meter i`, e),
        meterWrap: $(`#hud-meter`, e),
        meterL: $(`#hud-meter-l`, e),
        cprog: $(`#hud-cprog`, e),
        cbar: $(`#hud-cbar`, e),
        next: $(`#hud-next`, e),
        warn: $(`#hud-warn`, e),
        counts: $(`#hud-counts`, e),
        prompt: $(`#hud-prompt`, e),
        toasts: $(`#toasts`, e),
        banner: $(`#banner`, e),
        labels: $(`#labels`, e),
        diag: $(`#diag`, e),
        fade: $(`#fade`, e),
        flash: $(`#flash`, e),
        mm: $(`#minimap`, e),
      }),
      (this.screens = {}));
    for (let t of [`loading`, `title`, `options`, `controls`, `about`, `briefing`, `pause`, `results`, `fail`])
      this.screens[t] = $(`#` + t, e);
    (e.addEventListener(`click`, (e) => {
      let t = e.target.closest(`[data-act]`);
      t && this._act(t.dataset.act, t);
    }),
      e.addEventListener(`pointerover`, (e) => {
        let t = e.target.closest(`.btn`);
        t && t !== this._hov && ((this._hov = t), this.audio && this.audio.play(`ui_click`, { vol: 0.5 }));
      }),
      (this.mmCtx = this.el.mm.getContext(`2d`)));
  }
  _show(e) {
    for (let [t, n] of Object.entries(this.screens)) n.classList.toggle(`hidden`, t !== e);
    this.current = e;
    let t = this.screens[e] && this.screens[e].querySelector(`.btn:not(.hidden):not([disabled])`);
    t && !this.isTouch && setTimeout(() => t.focus({ preventScroll: !0 }), 30);
  }
  _hideScreens() {
    for (let e of Object.values(this.screens)) e.classList.add(`hidden`);
    this.current = null;
    // A menu button that keeps focus while hidden would swallow Space and Enter during play.
    this.layer.contains(document.activeElement) && document.activeElement.blur();
  }
  setLoading(e, t) {
    (($(`#load-bar`).style.width = Math.round(e * 100) + `%`),
      ($(`#load-txt`).textContent = t),
      this.kit.loading.progress(e, t));
  }
  showTitle() {
    (this._show(`title`),
      this._renderCabinet(),
      ($(`#btn-trial`).disabled = !this.save.data.trialUnlocked),
      ($(`#btn-trial`).textContent = this.save.data.trialUnlocked ? `TIME TRIAL` : `TIME TRIAL (LOCKED)`),
      ($(`#btn-trial`).title = this.save.data.trialUnlocked ? `` : `Save the carrier once to unlock`),
      this._syncTouch());
  }
  awaitStart(e) {
    (this._show(`title`), this._renderCabinet());
    let t = (n) => {
      if (!this._waitStart) return;
      if (n && n.type === `pointerdown`) {
        // The tap that opens the menu must not also press the menu button that appears under it.
        const eat = (e) => (e.stopPropagation(), e.preventDefault());
        (addEventListener(`click`, eat, { capture: !0, once: !0 }),
          setTimeout(() => removeEventListener(`click`, eat, { capture: !0 }), 700));
      }
      ((this._waitStart = null),
        removeEventListener(`keydown`, t),
        removeEventListener(`pointerdown`, t),
        $(`#press`).classList.add(`hidden`),
        $(`#menu`).classList.remove(`hidden`),
        this.kit.input.settle(),
        this.input && (this.input.clearPresses(), this.input.holdNav()),
        e(),
        this.showTitle());
    };
    // A key, click or tap is a user gesture, which lets the audio start; a gamepad
    // button arrives through kit.input instead (see _onInput).
    ((this._waitStart = t), addEventListener(`keydown`, t), addEventListener(`pointerdown`, t));
  }
  _renderCabinet() {
    let e = this.save.data.medals,
      t = this.save.data.best,
      n = (e, t, n) =>
        `<div class="medal"><div class="disc ${t || ``}">${t ? `★` : `?`}</div>${e}<span style="font-family:var(--font2);font-weight:400">${n}</span></div>`;
    $(`#cabinet`).innerHTML =
      n(`CARRIER`, e.carrier, e.carrier ? `safe` : `—`) +
      n(`DEMOLITION`, e.demolition, t.completion ? t.completion + `%` : `—`) +
      n(`TIME TRIAL`, e.trial, t.trialTime ? formatTime(t.trialTime) : `—`);
  }
  _act(e, t) {
    let n = this.game;
    switch ((this.audio.play(e === `back` ? `ui_back` : `ui_select`, { vol: 0.8 }), e)) {
      case `start`:
        (this._hideScreens(), n.startMission(`mission`));
        break;
      case `trial`:
        this.save.data.trialUnlocked && (this._hideScreens(), n.startMission(`trial`));
        break;
      case `options`:
        (this.stack.push(this.current), this._buildOptions(), this._show(`options`));
        break;
      case `controls`:
        (this.stack.push(this.current), this._buildControls(), this._show(`controls`));
        break;
      case `about`:
        (this.stack.push(this.current), this._buildDocs(), this._show(`about`));
        break;
      case `back`:
        (this._show(this.stack.pop() || `title`), this.current === `title` && this.showTitle());
        break;
      case `skipbrief`:
        n.skipBriefing();
        break;
      case `resume`:
        n.pause(!1);
        break;
      case `restart`:
        (this._hideScreens(), n.startMission(n.mode));
        break;
      case `end`:
        (n.pause(!1), n.endMission());
        break;
      case `quit`:
        (this._hideScreens(), n.quitToTitle());
        break;
      case `fullscreen`:
        this.toggleFullscreen();
        break;
      case `graphics`:
        this.kit.menu.open();
        break;
      case `retry`:
        (this._hideScreens(), n.startMission(t.dataset.mode || n.mode));
        break;
      case `title`:
        (this._hideScreens(), n.quitToTitle());
        break;
      case `doc`:
        this._showDocTab(t.dataset.tab);
    }
  }
  _onInput(e, t) {
    if (e !== `press` && e !== `nav`) return;
    if (this._waitStart) return void (e === `press` && this._waitStart());
    let n = this.current;
    if (!n || n === `loading` || n === `briefing`) return;
    let r = [...this.screens[n].querySelectorAll(`.btn, .seg button, select, input, .tabs button`)].filter(
        (e) => !e.disabled && e.offsetParent !== null,
      ),
      i = r.indexOf(document.activeElement),
      f = document.activeElement;
    if ((t === `left` || t === `right`) && f && f.type === `range` && r.includes(f)) {
      // Left/right on a focused slider moves the slider (gamepad and touch-free menus).
      (t === `left` ? f.stepDown() : f.stepUp(), f.dispatchEvent(new Event(`input`, { bubbles: !0 })));
      return;
    }
    if (t === `up` || t === `left`) {
      let e = r[(i - 1 + r.length) % r.length];
      (e && e.focus(), this.audio.play(`ui_click`, { vol: 0.5 }));
    } else if (t === `down` || t === `right`) {
      let e = r[(i + 1) % r.length];
      (e && e.focus(), this.audio.play(`ui_click`, { vol: 0.5 }));
    } else
      t === `action` && this.input.lastDevice === `gamepad`
        ? document.activeElement && document.activeElement.click && document.activeElement.click()
        : t === `action` && document.activeElement && document.activeElement.classList.contains(`btn`)
          ? document.activeElement.click()
          : // Enter on a focused menu button the browser did not treat as keyboard focus
            // (so the kit reported it instead of letting the button click itself).
            t === `enter` && this.input.lastDevice === `keyboard` && document.activeElement && document.activeElement.tagName === `BUTTON`
            ? document.activeElement.click()
          : t === `alt` && this.input.lastDevice === `gamepad` && n === `pause`
            ? this.game.pause(!1)
            : (t === `pause` || (t === `alt` && this.input.lastDevice === `gamepad`)) &&
              (n === `options` || n === `controls` || n === `about`) &&
              (this.input.consume(`pause`), this._act(`back`));
  }
  toggleFullscreen() {
    let e = document;
    if (!e.fullscreenElement && !e.webkitFullscreenElement) {
      let t = e.documentElement;
      (t.requestFullscreen || t.webkitRequestFullscreen || (() => {})).call(t);
    } else (e.exitFullscreen || e.webkitExitFullscreen).call(e);
  }
  _buildOptions() {
    let e = this.save.options,
      t = $(`#opt-body`),
      n = (t, n, r) =>
        `<div class="seg" data-key="${t}">${n.map((n, i) => `<button data-v="${n}" class="${e[t] === n ? `sel` : ``}">${r[i]}</button>`).join(``)}</div>`,
      r = (t) => `<input type="range" min="0" max="1" step="0.05" value="${e[t]}" data-key="${t}">`;
    ((t.innerHTML = `
      <label>Graphics</label><div><button class="btn dark small" data-act="graphics">GRAPHICS SETTINGS</button> <span style="font-size:12px;color:#aaa">quality, resolution, touch controls (F9)</span></div>
      <label>Master volume</label>${r(`master`)}
      <label>Music volume</label>${r(`music`)}
      <label>SFX volume</label>${r(`sfx`)}
      <label>Mute</label><div><input type="checkbox" data-key="muted" ${e.muted ? `checked` : ``}></div>
      <label>Fullscreen</label><div><button class="btn dark small" data-act="fullscreen">TOGGLE FULLSCREEN</button></div>
      <label>Camera</label>${n(`camera`, [`chase`, `classic`], [`Chase (auto-follow)`, `Classic (fixed angle)`])}
      <label>Carrier pace</label>${n(`carrierPace`, [`normal`, `relaxed`], [`Normal`, `Relaxed (-25%)`])}
      <label>Screen shake</label><input type="range" min="0" max="1.5" step="0.1" value="${e.shake}" data-key="shake">
      <label>Diagnostics</label><div><input type="checkbox" data-key="diagnostics" ${e.diagnostics ? `checked` : ``}> <span style="font-size:12px;color:#aaa">backend · preset · frame time (F3 / ~)</span></div>
      <label>Progress</label><div><button class="btn dark small" id="reset-save">RESET SAVED MEDALS</button> <span style="font-size:12px;color:#aaa">${this.save.available ? `Saved locally in this browser` : `Local storage unavailable — progress will not persist`}</span></div>
    `),
      t.querySelectorAll(`.seg`).forEach((t) =>
        t.addEventListener(`click`, (n) => {
          let r = n.target.closest(`button`);
          r &&
            ((e[t.dataset.key] = r.dataset.v),
            t.querySelectorAll(`button`).forEach((e) => e.classList.toggle(`sel`, e === r)),
            this.save.save(),
            this.applyOptions(t.dataset.key),
            this.audio.play(`ui_select`, { vol: 0.7 }));
        }),
      ),
      t.querySelectorAll(`input`).forEach((t) =>
        t.addEventListener(`input`, () => {
          ((e[t.dataset.key] = t.type === `checkbox` ? t.checked : parseFloat(t.value)),
            this.save.save(),
            this.applyOptions(t.dataset.key));
        }),
      ),
      $(`#reset-save`).addEventListener(`click`, () => {
        (this.save.reset(), this.audio.play(`ui_back`), this.toast(`Saved medals reset`));
      }));
  }
  applyOptions(e) {
    let t = this.save.options;
    if (
      (this.audio.setVolume(`master`, t.master),
      this.audio.setVolume(`music`, t.music),
      this.audio.setVolume(`sfx`, t.sfx),
      this.audio.setMuted(!!t.muted),
      this.el.diag.classList.toggle(`hidden`, !t.diagnostics),
      this.game && this.game.fx && (this.game.fx.shakeScale = t.shake),
      this.game && this.game.bricks)
    ) {
      let e = this.rs.preset;
      (this.game.bricks.setCaps(e.maxDebris, e.maxCrumble),
        this.game.bricksUnder.setCaps(Math.round(e.maxDebris / 3), Math.round(e.maxCrumble / 3)),
        this.game.fx.setMax(e.maxParticles));
      for (let t of this.rs.flashes) t.visible = !!e.pointLights;
    }
  }
  _buildControls() {
    $(`#ctl-body`).innerHTML = `
      <table class="ctl"><tr><th>ACTION</th><th>KEYBOARD / MOUSE</th><th>GAMEPAD</th><th>TOUCH</th></tr>
      <tr><td>Drive / walk</td><td>W A S D or arrow keys</td><td>Left stick · RT gas · LT brake/reverse</td><td>Left thumb: floating stick, push toward where you want to go</td></tr>
      <tr><td>Vehicle action</td><td>Space</td><td>A</td><td>ACTION</td></tr>
      <tr><td>Alt action</td><td>Shift, F or K</td><td>B</td><td>ALT</td></tr>
      <tr><td>Enter / exit</td><td>E or Enter</td><td>X</td><td>ENTER/EXIT</td></tr>
      <tr><td>Carrier view (hold)</td><td>C</td><td>Y</td><td>CARRIER VIEW</td></tr>
      <tr><td>Camera</td><td>Mouse drag · wheel zoom · Q/R rotate · V zoom step</td><td>Right stick · LB/RB rotate · Back or R3 = zoom</td><td>Drag on the right side · pinch to zoom</td></tr>
      <tr><td>Pause</td><td>Esc or P</td><td>Start</td><td>II</td></tr>
      <tr><td>Mute / diagnostics</td><td>M / F3 or ~</td><td>—</td><td>Options</td></tr>
      <tr><td>Graphics settings</td><td>F9</td><td>Options</td><td>Options</td></tr>
      <tr><td>Menus</td><td>Arrows or WASD · Enter/Space · Esc = back</td><td>Stick or D-pad · A · B = back</td><td>Tap</td></tr></table>
      <h3>VEHICLE ACTIONS</h3>
      <table class="ctl">
      <tr><td>SWINGBACK (dump truck)</td><td>Hold ACTION to power-slide: the armoured rear swings round and smashes whatever it hits. Front hits do little. Hit bumps at speed to launch into buildings.</td></tr>
      <tr><td>BULLRAM (bulldozer)</td><td>Ram with the blade. Turns on the spot. ACTION = ram boost. Pushes TNT crates and blocks.</td></tr>
      <tr><td>ARBALEST (missile bike)</td><td>ACTION fires missiles (hold for rapid fire, light lock-on). Collect green ammo crates.</td></tr>
      <tr><td>SKYSTOMPER (jet mech)</td><td>Hold ACTION to fly (fuel meter), ALT to dive-stomp onto the ring below you. The only machine that can flatten the reinforced towers.</td></tr>
      <tr><td>PATROL CAR</td><td>Fast and grippy. ACTION horn · ALT siren.</td></tr>
      <tr><td>SUBWAY SHUTTLE</td><td>Forward/up = ride to the other platform. Exit when stopped.</td></tr>
      <tr><td>On foot</td><td>Walk to vehicles, stairs and comm points. Press ENTER/E at the HQ truck’s ramp (on foot or in a vehicle) to end the mission once the carrier is safe.</td></tr></table>`;
  }
  _buildDocs() {
    let e = document.getElementById(`bbb-docs`),
      t = $(`#doc-tabs`);
    if (((t.innerHTML = ``), (this._docSections = []), !e)) {
      $(`#doc-body`).innerHTML = `<p>Documentation not embedded in this build.</p>`;
      return;
    }
    ([...e.content.cloneNode(!0).querySelectorAll(`section[data-tab]`)].forEach((e, n) => {
      let r = el(`button`, { 'data-act': `doc`, 'data-tab': String(n) }, e.dataset.tab);
      (t.appendChild(r), this._docSections.push(e));
    }),
      this._showDocTab(`0`));
  }
  _showDocTab(e) {
    let t = $(`#doc-body`);
    t.innerHTML = ``;
    let n = this._docSections[+e];
    (n && t.appendChild(n.cloneNode(!0)),
      $(`#doc-tabs`)
        .querySelectorAll(`button`)
        .forEach((t) => t.classList.toggle(`sel`, t.dataset.tab === String(e))),
      (t.scrollTop = 0));
  }
  showBriefing(e) {
    let t = e.carrier.pathBuildings.length;
    (($(`#brief-body`).innerHTML =
      `<p>A damaged nuclear missile carrier is rolling through <b style="color:#ffe36b">Argent Towers</b> on autopilot. It can't stop and it can't steer. <b style="color:#ff9a2a">${t} buildings</b> stand in its path — flatten them before it arrives or the payload goes up.</p>
      <p>You start in the <b style="color:#ffe36b">SWINGBACK</b>: hold <span class="key">${this.isTouch ? `ACTION` : `SPACE`}</span> while turning to power-slide its armoured rear into buildings. Watch the arrows: <span style="color:#33ff55">green</span> → <span style="color:#ffe03a">yellow</span> → <span style="color:#ff9a2a">orange</span> → <span style="color:#ff3a2a">red</span> as the carrier closes in.</p>
      <p style="font-size:13px">Bonus objectives: destroy every building, light all ${e.totals.rdus} RDUs, rescue ${e.totals.survivors} survivors, find ${e.totals.cps} comm points and the hidden scientist. Rumour has it a concrete block near HQ hides a way underground…</p>`),
      this._show(`briefing`));
  }
  hideBriefing() {
    this._hideScreens();
  }
  showPause(e) {
    (e
      ? (($(`#btn-end`).disabled = !this.game.carrierSafe || this.game.mode === `trial`), this._show(`pause`))
      : this._hideScreens(),
      this._syncTouch());
  }
  showResults(e) {
    let t = $(`#res-card`),
      n = (e, t) =>
        `<div class="medal" style="width:110px"><div class="disc ${e || ``}" style="width:64px;height:64px;font-size:28px">${e ? `★` : `—`}</div>${t}<span style="font-family:var(--font2)">${e ? MEDAL_LABELS[e] : `no medal`}</span></div>`;
    if (e.mode === `trial`) {
      let r = e.targets;
      t.innerHTML = `<h2>TIME TRIAL RESULTS</h2>
        <div class="res-grid"><div><div class="big">${formatTime(e.time)}</div>${e.newBest ? `<span class="newbest">NEW BEST</span>` : ``}
        <table class="stats" style="margin-top:10px"><tr><td>Platinum</td><td>${formatTime(r.platinum)}</td></tr><tr><td>Gold</td><td>${formatTime(r.gold)}</td></tr><tr><td>Silver</td><td>${formatTime(r.silver)}</td></tr><tr><td>Bronze</td><td>${formatTime(r.bronze)}</td></tr></table></div>
        <div class="cabinet" style="align-items:center">${n(e.medals.trial, `TRIAL`)}</div></div>
        <p style="margin-top:10px;font-size:12px">${e.saved ? `Progress saved locally.` : `Local storage unavailable — results not saved.`}</p>
        <div class="row" style="margin-top:12px"><button class="btn" data-act="retry" data-mode="trial">RETRY TRIAL</button><button class="btn dark" data-act="retry" data-mode="mission">PLAY MISSION</button><button class="btn dark" data-act="title">TITLE</button></div>`;
    } else {
      let r = e.completion.cats,
        i = (e, [t, n]) =>
          `<tr class="${t >= n ? `full` : ``}"><td>${e}</td><td>${t} / ${n}${t >= n ? ` ✓` : ``}</td></tr>`;
      t.innerHTML = `<h2>MISSION RESULTS — ${MISSION_NAME}</h2>
        <div class="res-grid"><div>
        <table class="stats"><tr class="full"><td>Carrier</td><td>SAFE ✓</td></tr>
        ${i(`Buildings destroyed`, r.buildings)}${i(`RDUs lit`, r.rdus)}${i(`Survivors rescued`, r.survivors)}${i(`Comm points`, r.cps)}
        <tr class="${e.completion.scientist ? `full` : ``}"><td>Scientist (secret)</td><td>${e.completion.scientist} / 1${e.completion.scientist ? ` ✓` : ``}</td></tr>
        <tr><td>Mission time</td><td>${formatTime(e.time)}</td></tr></table>
        <div style="margin-top:10px" class="big">${e.completion.pct}%${e.newBest ? `<span class="newbest">NEW BEST</span>` : ``}</div></div>
        <div><div class="cabinet">${n(e.medals.carrier, `CARRIER`)}${n(e.medals.demolition, `DEMOLITION`)}</div>
        <p style="font-size:12px">Demolition medal: Bronze 50% · Silver 80% · Gold 100% (buildings, RDUs, survivors, comm points). Time Trial is now unlocked from the title screen.</p></div></div>
        <p style="font-size:12px">${e.saved ? `Progress saved locally.` : `Local storage unavailable — results not saved.`}</p>
        <div class="row" style="margin-top:12px"><button class="btn" data-act="retry" data-mode="mission">REPLAY MISSION</button><button class="btn dark" data-act="retry" data-mode="trial">TIME TRIAL</button><button class="btn dark" data-act="title">TITLE</button></div>`;
    }
    (this._show(`results`), this._syncTouch());
  }
  showFail(e) {
    (($(`#fail-card`).innerHTML = `<h2 style="color:#ff4a3a">MISSION FAILED</h2>
      <p style="font-size:16px;color:#f5f3ea">The carrier hit <b style="color:#ffe36b">${e ? e.name : `an obstacle`}</b> and its payload detonated.</p>
      <p>Tip: follow the arrows — clear the <b>next</b> obstacle first. Hold ACTION while steering to swing the SWINGBACK's armoured rear into walls; front-on hits barely scratch them. The carrier view (C / Y) shows how close it is.</p>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="retry" data-mode="mission">RETRY</button><button class="btn dark" data-act="title">TITLE</button></div>`),
      this._show(`fail`),
      this._syncTouch());
  }
  showHUD(e, t) {
    (this.el.hud.classList.toggle(`hidden`, !e),
      (this.hudOn = e),
      (this._mmW = 0),
      e &&
        ((this.el.mode.textContent = t === `trial` ? `TIME TRIAL` : `MISSION TIME`),
        this._buildCarrierBar(),
        (this.el.toasts.innerHTML = ``),
        (this.el.banner.innerHTML = ``),
        (this._tipStage = 0)),
      this._syncTouch());
  }
  _syncTouch() {
    // The kit's touch controls show only during play, never over the game's own menus.
    this.kit.touch && this.kit.touch.suspend(!(this.hudOn && !this.current), `game`);
  }

  _buildCarrierBar() {
    let e = this.game,
      t = this.el.cbar;
    t.innerHTML = `<i></i>`;
    let n = e.level.route.length;
    this.cmarks = e.carrier.pathBuildings.map((e) => {
      let r = el(`b`);
      return ((r.style.left = clamp((e.sHit / n) * 100, 0, 100) + `%`), t.appendChild(r), { b: e, m: r });
    });
  }
  // The HUD runs every frame: write to the DOM only when a value actually changes.
  _txt(e, t) {
    e.textContent !== t && (e.textContent = t);
  }
  _html(e, t) {
    e._html !== t && ((e._html = t), (e.innerHTML = t));
  }
  _css(e, t, n) {
    e.style[t] !== n && (e.style[t] = n);
  }
  updateHUD(e) {
    let t = this.el;
    this._txt(t.time, formatTime(e.missionTime));
    let n = e.controlled;
    this._txt(t.veh, n === e.player ? `ON FOOT` : n.name);
    let r = n.meter;
    this._css(t.meterWrap, `visibility`, r ? `visible` : `hidden`);
    let i = this.isTouch ? `ENTER` : this.input.lastDevice === `gamepad` ? `X` : `E`;
    r
      ? (this._css(t.meter, `width`, Math.round(clamp(r.v, 0, 1) * 100) + `%`), this._txt(t.meterL, r.label))
      : this._txt(t.meterL, n === e.player ? i + `: ENTER VEHICLES` : ``);
    let a = e.carrier,
      o = e.level.route.length,
      s = clamp(a.s / o, 0, 1);
    (this._css(t.cbar.firstChild, `width`, (s * 100).toFixed(1) + `%`),
      this._txt(t.cprog, e.mode === `trial` ? `TRIAL` : Math.round(s * 100) + `%`));
    let c = ``,
      l = 0;
    for (let t of this.cmarks || []) {
      if (t.b.collapsed) {
        t.m.className !== `down` && ((t.m.className = `down`), (t.m.style.background = ``), (t.bg = ``));
        continue;
      }
      let n = e.mode === `trial` ? 99 : a.ttcOf(t.b),
        r = n > 45 ? `#33ff55` : n > 30 ? `#ffe03a` : n > 18 ? `#ff9a2a` : `#ff3a2a`;
      t.bg !== r && ((t.bg = r), (t.m.style.background = r));
    }
    if (e.mode === `trial`) {
      let e = a.pathBuildings.filter((e) => !e.collapsed).length;
      this._html(t.next, `CLEAR THE PATH: <b style="color:#ffe36b">${a.pathBuildings.length - e} / ${a.pathBuildings.length}</b>`);
    } else if (e.carrierSafe) {
      let n = e.completion().pct;
      this._html(t.next, `<span style="color:#4dff7a">CARRIER SAFE ✓</span> · COMPLETION <b style="color:#ffe36b">${n}%</b>`);
    } else if (a.destroyed) this._html(t.next, `<span style="color:#ff4a3a">CARRIER DESTROYED</span>`);
    else {
      let n = a.nextObstacle();
      if (n) {
        let r = n.ttc,
          i = r > 45 ? `#33ff55` : r > 30 ? `#ffe03a` : r > 18 ? `#ff9a2a` : `#ff3a2a`;
        (this._html(t.next, `NEXT: <b>${n.b.name.toUpperCase()}</b> · <b style="color:${i}">${Math.max(0, Math.ceil(r))}s</b>`),
          e.state === `play` &&
            (r < 6 ? ((c = `COLLISION IMMINENT!`), (l = 3)) : r < 14 && ((c = `WARNING!`), (l = 2))));
      } else this._html(t.next, `<span style="color:#4dff7a">PATH CLEAR — ESCORT TO DEPOT</span>`);
    }
    if (
      (t.warn.textContent !== c && ((t.warn.textContent = c), (t.warn.className = l ? `l` + l : ``)),
      e.state === `play` && e.mode === `mission` && !e.carrierSafe)
    ) {
      let e = l >= 2 ? `level_critical` : `level`;
      (this._musicWant !== e &&
        (e === `level` && this._musicWant === `level_critical`
          ? (clearTimeout(this._musT),
            (this._musT = setTimeout(() => {
              this._musicWant === `level` && this.audio.playMusic(`level`, 1);
            }, 1500)))
          : this.audio.playMusic(e, 0.5),
        e === `level_critical` && !this._klax && this.audio.play(`klaxon`, { vol: 0.8 }),
        (this._musicWant = e)),
        (this._klax = l >= 3));
    } else this._musicWant = null;
    let u = e.completion(),
      d = u.cats,
      f = (e, [t, n]) => `<div class="${t >= n ? `done` : ``}">${t}/${n}<small>${e}</small></div>`,
      p =
        f(`BLDG`, d.buildings) +
        f(`RDU`, d.rdus) +
        f(`SURV`, d.survivors) +
        f(`COMM`, d.cps) +
        f(`SCI`, [u.scientist, 1]);
    p !== this._countsHtml && ((t.counts.innerHTML = p), (this._countsHtml = p));
    let m = e.prompt();
    if (m) {
      let e = `<span class="key">${this.isTouch ? `ENTER` : this.input.lastDevice === `gamepad` ? `X` : `E`}</span>${m.text}`;
      (t.prompt.innerHTML !== e && (t.prompt.innerHTML = e), t.prompt.classList.remove(`hidden`));
    } else t.prompt.classList.add(`hidden`);
    if ((this._touchBtn(`enter`)?.classList.toggle(`hl`, !!m), this.save.options.diagnostics)) {
      let n = this.rs,
        r = `${this.kit.tier.name}→${n.preset.label}`,
        i = `${n.backend} · ${r} · ${n.frameMs.toFixed(1)} ms (${Math.round(n.fps)} fps)\nres ${n.renderer.getPixelRatio().toFixed(2)}× · bodies ${e.physics.bodyCount} · debris ${e.bricks.debrisCount + e.bricksUnder.debrisCount} · moving ${e.bricks.moving.length}`;
      t.diag.textContent !== i && (t.diag.textContent = i);
    }
    (this._tips(e),
      this.isTouch && this.updateTouchLabels(e),
      (this.mmT -= 1 / 60),
      this.mmT <= 0 && ((this.mmT = 1 / 15), this._drawMinimap(e)));
  }
  _tips(e) {
    if (e.mode !== `mission` || e.state !== `play`) return;
    let t = e.missionTime;
    (this._tipStage === 0 &&
      t > 0.5 &&
      e.controlled === e.vehicles.swingback &&
      ((this._tipStage = 1),
      this.toast(
        this.isTouch
          ? `Drag the left thumb to drive. Hold ACTION while turning to power-slide the tailgate into buildings!`
          : `Drive with WASD. Hold SPACE while turning to power-slide — the armoured tailgate does the damage!`,
        `info`,
        7,
      )),
      this._tipStage === 1 &&
        t > 12 &&
        ((this._tipStage = 2),
        this.toast(`Arrows mark buildings in the carrier’s path. Hold C to check on the carrier.`, `info`, 6)),
      this._tipStage === 2 &&
        e.controlled === e.player &&
        t > 3 &&
        ((this._tipStage = 3),
        this.toast(`On foot: walk up to any vehicle and press ` + (this.isTouch ? `ENTER` : `E`) + `.`, `info`, 5)));
  }
  _buildMinimapStatic() {
    let e = this.game,
      t = MAP_BOUNDS,
      n = t.maxX - t.minX + 40,
      r = t.maxZ - t.minZ + 40;
    this.mmOrigin = { x: t.minX - 20, z: t.minZ - 20 };
    let i = () => {
        let e = document.createElement(`canvas`);
        return ((e.width = n), (e.height = r), e);
      },
      a = (e) => e - this.mmOrigin.x,
      o = (e) => e - this.mmOrigin.z,
      s = i(),
      c = s.getContext(`2d`);
    ((c.fillStyle = `#2f4d2a`),
      c.fillRect(0, 0, n, r),
      (c.fillStyle = `#26282d`),
      c.fillRect(a(t.minX), o(t.minZ), 0, 0));
    for (let e of LOTS) ((c.fillStyle = `#56585d`), c.fillRect(a(e.r[0]), o(e.r[1]), e.r[2] - e.r[0], e.r[3] - e.r[1]));
    ((c.lineCap = `round`), (c.lineJoin = `round`));
    let l = (e, t, n) => {
      ((c.strokeStyle = n),
        (c.lineWidth = t),
        c.beginPath(),
        e.forEach((e, t) => (t ? c.lineTo(a(e.x), o(e.z)) : c.moveTo(a(e.x), o(e.z)))),
        c.stroke());
    };
    for (let e of ROADS) l(e.pts, e.w, `#6d7079`);
    (l(e.level.route.pts, 12, `#6d7079`),
      c.setLineDash([6, 6]),
      l(e.level.route.pts, 3, `#ffcc1a`),
      c.setLineDash([]),
      (c.fillStyle = `#7d766b`));
    let u = PLATEAU;
    (c.fillRect(a(u.minX), o(u.minZ), u.maxX - u.minX, u.maxZ - u.minZ),
      (c.strokeStyle = `#b8b0a2`),
      (c.lineWidth = 2));
    let d = COMPOUND;
    c.strokeRect(a(d.minX), o(d.minZ), d.maxX - d.minX, d.maxZ - d.minZ);
    let f = PILLAR;
    ((c.fillStyle = `#8e877d`), c.fillRect(a(f.x - 8), o(f.z - 8), 16, 16));
    let p = DEPOT;
    ((c.fillStyle = `#4a6a46`),
      c.fillRect(a(p.minX), o(p.minZ), p.maxX - p.minX, p.maxZ - p.minZ),
      (c.fillStyle = `#ffcc1a`),
      c.fillRect(a(223), o(-96), 22, 12),
      (c.strokeStyle = `#3f8a3a`),
      (c.lineWidth = 1.5));
    let m = MAZE;
    (c.strokeRect(a(m.minX), o(m.minZ), m.maxX - m.minX, m.maxZ - m.minZ), (c.fillStyle = `#d0a000`));
    let h = HQ.truck;
    c.fillRect(a(h.x - 8), o(h.z - 2), 16, 4);
    for (let t of e.level.holes)
      ((c.fillStyle = `#000`), c.fillRect(a(t.minX), o(t.minZ), t.maxX - t.minX, t.maxZ - t.minZ));
    this.mmSurface = s;
    let g = i(),
      _ = g.getContext(`2d`);
    ((_.fillStyle = `#101114`), _.fillRect(0, 0, n, r), (_.fillStyle = `#5a554c`));
    for (let e of [SERVICE_CHAMBER, PLATFORM_A, SUBWAY_TUNNEL, PLATFORM_B])
      _.fillRect(a(e.minX), o(e.minZ), e.maxX - e.minX, e.maxZ - e.minZ);
    _.fillStyle = `#8a8579`;
    for (let t of e.level.holes) _.fillRect(a(t.minX), o(t.minZ), t.maxX - t.minX, t.maxZ - t.minZ);
    ((_.strokeStyle = `#999`),
      (_.lineWidth = 1),
      _.beginPath(),
      _.moveTo(a(SUBWAY.x), o(SUBWAY.zA)),
      _.lineTo(a(SUBWAY.x), o(SUBWAY.zB)),
      _.stroke(),
      (this.mmUnder = g));
  }
  _drawMinimap(e) {
    let t = this.el.mm,
      n = this.mmCtx,
      r = Math.min(2, window.devicePixelRatio || 1),
      // Measured once per resize / HUD show, not on every redraw (a forced layout 15 times a second).
      i = this._mmW || (this._mmW = t.clientWidth) || 168;
    t.width !== Math.round(i * r) && ((t.width = Math.round(i * r)), (t.height = Math.round(i * r)));
    let a = t.width,
      o = a / 230,
      s = e.focusPos(),
      c = e.activeArea === `underground`,
      l = this.mmOrigin;
    (n.setTransform(1, 0, 0, 1, 0, 0),
      (n.fillStyle = c ? `#101114` : `#2f4d2a`),
      n.fillRect(0, 0, a, a),
      n.save(),
      n.translate(a / 2, a / 2));
    let u = e.cam.viewYaw ?? 0;
    (n.rotate(Math.PI + u),
      n.scale(o, o),
      n.translate(-(s.x - l.x), -(s.z - l.z)),
      n.drawImage(c ? this.mmUnder : this.mmSurface, 0, 0));
    let d = (e) => e - l.x,
      f = (e) => e - l.z;
    if (c) {
      for (let t of e.bricksUnder.buildings)
        if (!t.collapsed) {
          let e = t.aabb;
          ((n.fillStyle = `#ffcc1a`), n.fillRect(d(e.minX), f(e.minZ), e.maxX - e.minX + 1, e.maxZ - e.minZ));
        }
    } else {
      for (let t of e.bricks.buildings) {
        let r = t.aabb;
        if (t.collapsed) n.fillStyle = `#3b3d42`;
        else if (t.inPath && !e.carrierSafe) {
          let r = e.carrier.ttcOf(t);
          n.fillStyle = r > 45 ? `#33ff55` : r > 30 ? `#ffe03a` : r > 18 ? `#ff9a2a` : `#ff3a2a`;
        } else n.fillStyle = t.kind === `door` ? `#ffcc1a` : `#d9d4c7`;
        n.fillRect(d(r.minX), f(r.minZ), r.maxX - r.minX, r.maxZ - r.minZ);
      }
      if (!e.carrier.destroyed) {
        let t = e.carrier.poses;
        this._tri(n, d(t.tr.x), f(t.tr.z), t.tr.yaw, 7, `#ffffff`, `#c8332b`);
      }
    }
    n.fillStyle = `#ffe36b`;
    for (let t of e.rdus.list)
      t.lit || (t.area === `underground`) !== c || n.fillRect(d(t.x) - 1.2, f(t.z) - 1.2, 2.4, 2.4);
    if (!c)
      for (let t of e.cps.list)
        ((n.strokeStyle = t.active ? `#4dff7a` : `#4aa8ff`),
          (n.lineWidth = 2 / o),
          n.beginPath(),
          n.arc(d(t.x), f(t.z), 4, 0, Math.PI * 2),
          n.stroke());
    for (let t of e.vehicleList) {
      if (t === e.controlled) continue;
      let r = t.pos;
      r.y < -3 === c && ((n.fillStyle = `#4aa8ff`), n.fillRect(d(r.x) - 2.5, f(r.z) - 2.5, 5, 5));
    }
    let p = e.controlled === e.player ? e.player.yaw : e.controlled === e.train ? Math.PI : e.controlled.yaw;
    (this._tri(n, d(s.x), f(s.z), p, 6, `#ffcc1a`, `#000`),
      n.restore(),
      (n.fillStyle = `rgba(0,0,0,.5)`),
      n.beginPath(),
      n.arc(a - 14 * r, 14 * r, 10 * r, 0, Math.PI * 2),
      n.fill(),
      n.save(),
      n.translate(a - 14 * r, 14 * r),
      n.rotate(u),
      (n.fillStyle = `#ff5a4a`),
      n.beginPath(),
      n.moveTo(0, 8 * r),
      n.lineTo(-4 * r, -3 * r),
      n.lineTo(4 * r, -3 * r),
      n.fill(),
      n.restore());
  }
  _tri(e, t, n, r, i, a, o) {
    (e.save(),
      e.translate(t, n),
      e.rotate(-r),
      e.beginPath(),
      e.moveTo(0, i * 1.3),
      e.lineTo(-i * 0.8, -i * 0.8),
      e.lineTo(i * 0.8, -i * 0.8),
      e.closePath(),
      (e.fillStyle = a),
      e.fill(),
      (e.lineWidth = 1.5),
      (e.strokeStyle = o),
      e.stroke(),
      e.restore());
  }
  toast(e, t = `info`, n = 3.2) {
    let r = el(`div`, { class: `toast ` + t }, e);
    for (this.el.toasts.appendChild(r); this.el.toasts.children.length > 3; ) this.el.toasts.firstChild.remove();
    setTimeout(() => {
      ((r.style.transition = `opacity .4s`), (r.style.opacity = `0`), setTimeout(() => r.remove(), 450));
    }, n * 1e3);
  }
  banner(e, t = ``, n = 2) {
    let r = this.el.banner;
    ((r.innerHTML = `<span class="pop ${t}">${e}</span>`),
      clearTimeout(this._banT),
      (this._banT = setTimeout(() => {
        r.innerHTML = ``;
      }, n * 1e3)));
  }
  fade() {
    let e = this.el.fade;
    (e.classList.add(`on`), clearTimeout(this._fadeT), (this._fadeT = setTimeout(() => e.classList.remove(`on`), 200)));
  }
  whiteFlash() {
    let e = this.el.flash;
    ((e.style.transition = `none`),
      (e.style.opacity = `1`),
      requestAnimationFrame(() => {
        ((e.style.transition = `opacity 1.6s ease-out`), (e.style.opacity = `0`));
      }));
  }
  popup(e, t, n, r, i = `good`) {
    let a = el(`div`, { class: `wl fly ` + i }, e);
    this.el.labels.appendChild(a);
    let o = { el: a, x: t, y: n, z: r, t: 0 };
    (this.popups.push(o),
      setTimeout(() => {
        a.remove();
        let e = this.popups.indexOf(o);
        e >= 0 && this.popups.splice(e, 1);
      }, 1450));
  }
  worldLabel(e, t) {
    let n = el(`div`, { class: `wl hidden` }, t);
    this.el.labels.appendChild(n);
    let r = {
      el: n,
      x: 0,
      y: 0,
      z: 0,
      on: !1,
      set: (e, t, i, a, o = ``) => {
        ((r.x = t), (r.y = i), (r.z = a), (r.on = !0), n.textContent !== e && (n.textContent = e));
        let s = `wl ` + o;
        n.className !== s && (n.className = s);
      },
      hide: () => {
        ((r.on = !1), n.classList.add(`hidden`));
      },
    };
    return (this.labels.set(e, r), r);
  }
  showBuildingHP(e) {
    (this.hpEl ||
      ((this.hpEl = el(`div`, { class: `hp` }, `<div class="n"></div><div class="b"><i></i></div>`)),
      this.el.labels.appendChild(this.hpEl)),
      (this.hpB = e),
      (this.hpT = 2.4),
      (this.hpEl.querySelector(`.n`).textContent = e.name.toUpperCase()));
  }
  _project(e, t, n) {
    let r = this.rs.camera;
    return (
      _projVec.set(e, t, n).project(r),
      _projVec.z > 1 || _projVec.z < -1
        ? null
        : { x: (_projVec.x * 0.5 + 0.5) * window.innerWidth, y: (-_projVec.y * 0.5 + 0.5) * window.innerHeight }
    );
  }
  updateLabels(e) {
    let t = e.state === `play` || e.state === `countdown` || e.state === `trialdone` || e.state === `crash`;
    if (((this.el.labels.style.display = t ? `` : `none`), t)) {
      for (let e of this.popups) {
        let t = this._project(e.x, e.y, e.z);
        if (!t) {
          e.el.style.display = `none`;
          continue;
        }
        ((e.el.style.display = ``), (e.el.style.left = t.x + `px`), (e.el.style.top = t.y + `px`));
      }
      for (let t of this.labels.values()) {
        let n = t.y < -3 == (e.activeArea === `underground`),
          r = t.on && n ? this._project(t.x, t.y, t.z) : null;
        if (!r) {
          t.el.classList.add(`hidden`);
          continue;
        }
        (t.el.classList.remove(`hidden`), (t.el.style.left = r.x + `px`), (t.el.style.top = r.y + `px`));
      }
      if (this.hpEl) {
        this.hpT -= 1 / 60;
        let t = this.hpB,
          n = t && t.baseY < -3 == (e.activeArea === `underground`),
          r = t && this.hpT > 0 && !t.collapsed && n ? this._project(t.cx, t.top + 2, t.cz) : null;
        r
          ? ((this.hpEl.style.display = ``),
            (this.hpEl.style.left = r.x + `px`),
            (this.hpEl.style.top = r.y + `px`),
            (this.hpEl.querySelector(`i`).style.width = Math.max(0, (t.hp / t.maxHp) * 100) + `%`))
          : (this.hpEl.style.display = `none`);
      }
    }
  }
  _touchBtn(e) {
    return this.kit.touch ? this.kit.touch.element.querySelector(`[data-action="${e}"]`) : null;
  }
  updateTouchLabels(e) {
    let t = e.controlled,
      i =
        t === e.player || t === e.train
          ? [`—`, ``]
          : {
              swingback: [`SLIDE`, ``],
              bullram: [`BOOST`, ``],
              arbalest: [`FIRE`, ``],
              patrol: [`HORN`, `SIREN`],
              skystomper: [`JETS`, `STOMP`],
            }[t.id] || [`ACTION`, `ALT`],
      k = i.join(`|`);
    if (k === this._touchLabels || !this.kit.touch) return;
    ((this._touchLabels = k),
      this.kit.touch.setLabel(`action`, i[0]),
      this.kit.touch.setLabel(`alt`, i[1] || `ALT`));
    let r = this._touchBtn(`alt`);
    r && (r.style.opacity = i[1] ? `1` : `0.4`);
  }
};
async function main() {
  let e = document.getElementById(`app`),
    canvas = document.createElement(`canvas`);
  ((canvas.id = `game-canvas`), e.prepend(canvas));
  const kit = await boot({
    title: `Brick Blast Brigade`,
    canvas,
    physics: !0,
    input: ACTIONS,
    // SMAA or FXAA in the game's own post chain does the anti-aliasing.
    renderer: { antialias: !1 },
    // Options → Graphics settings (and F9) open the kit's panel; the HUD uses three corners.
    gear: `none`,
    // The pause pill sits under the carrier bar, where the game always put it.
    touch: { top: `center`, topOffset: 96 },
    accent: `#ffcc1a`,
    background: `#0b0c0f`,
  });
  RAPIER = kit.RAPIER;
  let t = new UI(e, kit);
  t.setLoading(0.05, `Starting renderer…`);
  let n = new RenderSystem(e, kit);
  (await n.init(), t.setLoading(0.08, `Starting physics…`));
  let r = new Input(kit),
    i = new AudioSystem(),
    a = new SaveGame(),
    o = new Game({ renderSys: n, audio: i, input: r, save: a, ui: t });
  if (
    ((t.save = a),
    (t.rs = n),
    (t.audio = i),
    (t.input = r),
    await o.init((e, n) => t.setLoading(0.1 + e * 0.85, `Building ` + n + `…`)),
    t.bind(o, n, i, a, r),
    t.setLoading(0.97, `Compiling shaders…`),
    !new URLSearchParams(location.search).has(`noprecompile`))
  )
    try {
      (o._applyArea(`underground`, !0),
        await n.renderer.compileAsync(n.scene, n.camera),
        o._applyArea(`surface`, !0),
        await n.renderer.compileAsync(n.scene, n.camera));
    } catch (e) {
      console.warn(`precompile skipped`, e);
    }
  n.onPresetChange = () => t.applyOptions(`preset`);
  // The kit's settings panel (and a lost device) pause the loop: pause the mission and the sound with it.
  kit.onPause((e) => {
    e ? (o.state === `play` && o.pause(!0), i.pauseAll()) : i.resumeAll();
  });
  (kit.start((e) => {
    (n.sampleFrame(e * 1e3), o.update(e));
  }),
    t.setLoading(1, `Ready`),
    t.awaitStart(() => {
      (i.unlock(), i.playMusic(`title`, 1));
    }),
    document.addEventListener(`visibilitychange`, () => {
      document.hidden && o.state === `play` && o.pause(!0);
    }),
    (window.__bbb = { game: o, rs: n, audio: i, ui: t, input: r, save: a, kit }));
}
main().catch((e) => {
  console.error(e);
  let t = document.getElementById(`load-txt`);
  t && (t.textContent = `Failed to start: ` + (e && e.message ? e.message : e));
});
