/* Crown & Clay — the world view, on three.js r186 (WebGPU with WebGL2 fallback).

   Everything on the map is an instance of one of seven small flat-shaded meshes
   (cube, plane, roof, cone, ico, cylinder, ring). Instances are batched per mesh
   and per material "mode" into InstancedMeshes: a static set rebuilt whenever the
   game changes (terrain, cities, borders, rivers), and a dynamic set refilled every
   frame (units, selection, paths, particles, birds).

   Modes (they match the original renderer):
     0 lit      Lambert, sun + sky light, moving cloud shade, shadows
     1 sea      unlit animated water with shore foam from a distance-to-land map
     2 fog      unexplored land, unlit with a slow shimmer
     3 flat     unlit overlays (borders, selection, reach dots)
     4 glow     unlit and bright (windows, fires, particles, the Sunspire's crown)
     5 river    the sea shader with a fixed shallow depth
     6 flag     lit, with a flutter in the vertex stage
   Lighting follows the original: hemisphere ambient, a warm sun at the same angle,
   its shadow at 24 % strength, and the same tone curve (applied in the post chain). */
import * as THREE from 'three/webgpu';
import { Fn, uniform, float, vec2, vec3, vec4, sin, cos, clamp, smoothstep, mix, exp, length, normalize, dot, fract, pow, uv, positionWorld, positionLocal, positionGeometry, texture, cameraPosition, screenCoordinate } from 'three/tsl';
import { W, H, RIVER, FACTIONS, hash, clamp as clampNum } from './engine.js';

const S = 2; // world units per tile
const TYPES = ['cube', 'plane', 'roof', 'cone', 'ico', 'cylinder', 'ring'];
const TYPE_INDEX = Object.fromEntries(TYPES.map((t, i) => [t, i]));
const MODES = 7;
const WHITE = [1, 1, 1];
const SUN_DIR = new THREE.Vector3(-0.6, 1, 0.45).normalize();
const NEAR = 1, FAR = 140, EYE_DISTANCE = 65;

/* ---------------------------------------------------------------- geometry
   The original's seven meshes, built the same way: every triangle's normal comes
   from its own winding, so front faces are the ones facing their normal and the
   default back-face culling matches the original's CULL_FACE. */
function geometryData(type) {
  const a = [];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const tri = (p, q, r, n = null) => { n = n || norm(cross(sub(q, p), sub(r, p))); for (const v of [p, q, r]) a.push(v[0], v[1], v[2], n[0], n[1], n[2]); };
  const quad = (p, q, r, s, n = null) => { tri(p, q, r, n); tri(p, r, s, n); };
  if (type === 'cube') {
    quad([-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]); quad([.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]);
    quad([.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]); quad([-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]);
    quad([-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]); quad([-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]);
  } else if (type === 'plane') {
    quad([-.5, 0, .5], [.5, 0, .5], [.5, 0, -.5], [-.5, 0, -.5]);
  } else if (type === 'roof') {
    tri([-.5, -.5, .5], [.5, -.5, .5], [0, .5, .5]); tri([.5, -.5, -.5], [-.5, -.5, -.5], [0, .5, -.5]);
    quad([0, .5, .5], [.5, -.5, .5], [.5, -.5, -.5], [0, .5, -.5]); quad([-.5, -.5, .5], [0, .5, .5], [0, .5, -.5], [-.5, -.5, -.5]);
    quad([-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]);
  } else if (type === 'ico') {
    const p = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]].map((q) => norm(q).map((c) => c * .5));
    const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (const t of f) tri(v[t[0]], v[t[1]], v[t[2]]);
  } else {
    const n = type === 'cone' ? 6 : type === 'ring' ? 32 : 10;
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 2, u = (i + 1) / n * Math.PI * 2;
      const p = [Math.cos(t) * .5, -.5, Math.sin(t) * .5], q = [Math.cos(u) * .5, -.5, Math.sin(u) * .5];
      if (type === 'cone') { tri(p, [0, .5, 0], q); tri(q, [0, -.5, 0], p); }
      else if (type === 'ring') {
        const p1 = [Math.cos(t) * .5, 0, Math.sin(t) * .5], p2 = [Math.cos(u) * .5, 0, Math.sin(u) * .5];
        const q1 = p1.map((c) => c * .85), q2 = p2.map((c) => c * .85);
        quad(p1, q1, q2, p2, [0, 1, 0]);
      } else {
        const pp = [p[0], .5, p[2]], qq = [q[0], .5, q[2]];
        quad(p, pp, qq, q); tri(pp, [0, .5, 0], qq); tri(q, [0, -.5, 0], p);
      }
    }
  }
  return a;
}

function buildGeometry(type) {
  const a = geometryData(type), n = a.length / 6;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = a[i * 6]; pos[i * 3 + 1] = a[i * 6 + 1]; pos[i * 3 + 2] = a[i * 6 + 2];
    nor[i * 3] = a[i * 6 + 3]; nor[i * 3 + 1] = a[i * 6 + 4]; nor[i * 3 + 2] = a[i * 6 + 5];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

/* The river's smooth ribbon: a Catmull-Rom spline through the river points (the same for every seed). */
const RIVER_PATH = (() => {
  const out = [];
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[Math.max(0, i - 1)], b0 = RIVER[i], c = RIVER[i + 1], d = RIVER[Math.min(RIVER.length - 1, i + 2)];
    for (let j = 0; j < 12; j++) {
      const u = j / 12, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map((k) => .5 * ((2 * b0[k]) + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b0[k] + 4 * c[k] - d[k]) * u2 + (-a[k] + 3 * b0[k] - 3 * c[k] + d[k]) * u3)));
    }
  }
  out.push(RIVER[RIVER.length - 1]);
  return out;
})();

/* Hex colours as linear RGB (three.js converts sRGB hex exactly, the original used a 2.2 power). */
const colorCache = new Map();
const tmpColor = new THREE.Color();
function rgb(hex) {
  if (Array.isArray(hex)) return hex;
  let c = colorCache.get(hex);
  if (!c) { tmpColor.set(hex); c = [tmpColor.r, tmpColor.g, tmpColor.b]; colorCache.set(hex, c); }
  return c;
}
function shade(hex, f) { const a = rgb(hex); return [a[0] * f, a[1] * f, a[2] * f]; }

/* ---------------------------------------------------------------- batches */
class Batch {
  constructor(view, type, mode, initial) {
    this.view = view; this.type = type; this.mode = mode;
    this.count = 0; this.cap = 0; this.mesh = null; this.m = null; this.c = null;
    this.grow(initial);
  }
  grow(min = 0) {
    const cap = Math.max(min, this.cap * 2, 16);
    const mesh = new THREE.InstancedMesh(this.view.geometries[this.type], this.view.materials[this.mode], cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // instances span the whole map and change every rebuild
    mesh.castShadow = this.type !== 'plane' && this.type !== 'ring';
    mesh.receiveShadow = this.mode === 0 || this.mode === 6;
    if (this.mesh) {
      mesh.instanceMatrix.array.set(this.m.subarray(0, this.count * 16));
      mesh.instanceColor.array.set(this.c.subarray(0, this.count * 3));
      this.view.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    mesh.count = this.count;
    mesh.visible = this.count > 0;
    this.view.scene.add(mesh);
    this.mesh = mesh; this.cap = cap;
    this.m = mesh.instanceMatrix.array; this.c = mesh.instanceColor.array;
  }
  finish() {
    const mesh = this.mesh;
    mesh.count = this.count;
    mesh.visible = this.count > 0;
    if (this.count) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }
}

export class WorldView {
  constructor(kit, game) {
    this.kit = kit;
    this.game = null;
    this.width = kit.size.width; this.height = kit.size.height;
    // Camera: an orthographic diorama view, as in the original.
    this.span = this.spanTarget = this.width < 720 ? 25 : 26;
    this.yaw = this.yawTarget = .50; this.pitch = .82;
    this.target = [-7.8, 0, 3.5]; this.current = [...this.target];
    this.eye = new THREE.Vector3(); this.ax = new THREE.Vector3(); this.ay = new THREE.Vector3(); this.az = new THREE.Vector3();
    this.hw = 1; this.hh = 1;
    // Selection state, set by the UI.
    this.selected = null; this.targetTile = null; this.hoverTile = null;
    this.grid = false;
    this.unitPos = new Map(); this.particles = [];
    this.animTime = 0; this.frame = 0; this.version = 0; this.selVersion = 0;
    this.cacheVersion = -1; this.hoverFor = undefined;
    this.reach = []; this.path = []; this.hoverPath = [];
    this.shadowDirty = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color().setRGB(.42, .65, .67);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);

    // Sky and sun, matched to the original shader (three.js divides diffuse light by π).
    this.scene.add(new THREE.HemisphereLight(new THREE.Color().setRGB(.68, .76, .75), new THREE.Color().setRGB(.36, .35, .30), Math.PI));
    const sun = (this.sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1.05, .96, .80), Math.PI));
    sun.position.copy(SUN_DIR).multiplyScalar(60);
    sun.castShadow = true;
    kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -31, right: 31, top: 29, bottom: -29, near: 1, far: 130 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.intensity = 0.76; // the original's shadowed sun kept 24 % of its light
    // Static terrain barely moves: redraw the shadow map on change and every few frames for the bobbing units.
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true;
    this.scene.add(sun, sun.target);
    const r = kit.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // The post chain applies the original's own tone curve and gamma, so the renderer outputs raw values.
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.shadowEvery = 3;
    const tierShadow = (tier) => { this.shadowEvery = tier.name === 'high' || tier.name === 'ultra' ? 2 : 4; this.shadowDirty = true; };
    tierShadow(kit.tier);
    kit.onQuality(tierShadow);

    this.uTime = uniform(0);
    this.mapData = new Uint8Array(W * 4 * H * 4 * 4);
    this.mapTex = new THREE.DataTexture(this.mapData, W * 4, H * 4, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.mapTex.magFilter = this.mapTex.minFilter = THREE.LinearFilter;
    this.mapTex.generateMipmaps = false;
    this.mapTex.needsUpdate = true;
    this.geometries = Object.fromEntries(TYPES.map((t) => [t, buildGeometry(t)]));
    this.materials = this.makeMaterials();
    this.sets = { static: { batches: [], initial: 64 }, dynamic: { batches: [], initial: 16 } };

    kit.onResize((w, h) => { this.width = w; this.height = h; this.updateCamera(); });
    this.setGame(game);
  }

  /* ---------------------------------------------------------------- materials */
  makeMaterials() {
    const t = this.uTime, wp = positionWorld;
    // Slow cloud shadows drifting over the land (the original darkened the sun by up to 13 %).
    const cloud = float(1).sub(smoothstep(.66, .96, sin(wp.x.mul(.13).add(t.mul(.024))).mul(sin(wp.z.mul(.18).add(t.mul(.016))))).mul(.1));
    const lit = new THREE.MeshLambertNodeMaterial();
    lit.colorNode = vec4(vec3(cloud), 1);
    const flag = new THREE.MeshLambertNodeMaterial();
    flag.colorNode = vec4(vec3(cloud), 1);
    // Banners flutter away from the pole (local x = -0.5 stays fixed).
    const gx = positionGeometry.x;
    flag.positionNode = positionLocal.add(vec3(0, 0, sin(gx.mul(5).add(t.mul(3)).add(positionLocal.x.mul(1.3))).mul(gx.add(.5)).mul(.05)));

    const sun = vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
    const water = (river) => Fn(() => {
      let shore;
      if (river) shore = float(.35);
      else {
        const mu = wp.xz.div(2).add(vec2(10, 8.5)).div(vec2(20, 17));
        const mp = texture(this.mapTex, clamp(mu, .001, .999)).r;
        const beyond = mu.negate().max(mu.sub(1)).max(0).mul(vec2(40, 34));
        shore = length(vec3(beyond, mp.mul(5)));
      }
      const wave = sin(wp.x.mul(2.8).add(wp.z.mul(1.3)).add(t.mul(.85))).add(sin(wp.z.mul(3.5).sub(wp.x.mul(.9)).sub(t.mul(.7))));
      const n = normalize(vec3(cos(wp.x.mul(2.8).add(t.mul(.85))).mul(.06), 1, cos(wp.z.mul(3.5).sub(t.mul(.7))).mul(.06)));
      const col = mix(vec3(.13, .40, .34), vec3(.035, .19, .235), smoothstep(0, 3.5, shore)).toVar();
      const foam = smoothstep(.9, .99, sin(shore.mul(21).sub(t.mul(1.2)).add(sin(wp.x.mul(1.8)).mul(.4)))).mul(exp(shore.mul(-2.7)));
      col.addAssign(foam.mul(.2));
      col.addAssign(pow(wave.mul(.5).max(0), 14).mul(.035));
      const h = normalize(sun.add(normalize(cameraPosition.sub(wp))));
      col.addAssign(pow(dot(n, h).max(0), 80).mul(.18));
      return vec4(col.mul(1.02), 1);
    })();
    const sea = new THREE.MeshBasicNodeMaterial();
    sea.colorNode = water(false);
    const river = new THREE.MeshBasicNodeMaterial();
    river.colorNode = water(true);
    const fog = new THREE.MeshBasicNodeMaterial();
    const shimmer = sin(wp.x.mul(.55).add(t.mul(.06))).mul(sin(wp.z.mul(.35))).mul(.024);
    fog.colorNode = vec4(vec3(float(1).add(shimmer.mul(2.5))), 1);
    const flat = new THREE.MeshBasicNodeMaterial();
    flat.color.setRGB(1.05, 1.05, 1.05);
    const glow = new THREE.MeshBasicNodeMaterial();
    glow.color.setRGB(1.5, 1.5, 1.5);
    return [lit, sea, fog, flat, glow, river, flag];
  }

  /**
   * The finishing pass for kit/post.js: the original tone curve and gamma, contact
   * shading read from the depth buffer, a soft vignette and a little grain.
   * The orthographic depth is linear on both backends, so the thresholds are the original's.
   */
  finishNode(color, scenePass) {
    const texel = (this.texel ||= uniform(new THREE.Vector2(1 / 1024, 1 / 1024)));
    return Fn(() => {
      const x = color.rgb.mul(.95);
      const toned = x.mul(x.mul(2.51).add(.03)).div(x.mul(x.mul(2.43).add(.59)).add(.14));
      const c = pow(clamp(toned, 0, 1), vec3(1 / 2.2)).toVar();
      const depth = scenePass.getTextureNode('depth');
      const base = uv();
      const d = depth.sample(base).r;
      const occ = float(0).toVar();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [-.707, .707], [.707, -.707], [-.707, -.707]]) {
        const near = depth.sample(base.add(vec2(dx, dy).mul(texel).mul(5))).r;
        const df = d.sub(near);
        occ.addAssign(smoothstep(.0003, .004, df).mul(float(1).sub(smoothstep(.008, .018, df))));
      }
      c.mulAssign(float(1).sub(occ.mul(.24 / 8)));
      const q = base.sub(.5).mul(vec2(1, .8));
      c.mulAssign(float(1).sub(dot(q, q).mul(.16)));
      const grain = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453));
      c.addAssign(grain.sub(.5).div(255));
      return vec4(c, 1);
    })();
  }

  /* ---------------------------------------------------------------- game and camera */
  setGame(game) {
    this.game = game;
    this.unitPos.clear();
    this.particles.length = 0;
    this.hoverTile = null;
    this.updateMapTexture();
    this.rebuild();
  }

  resetCamera() {
    this.span = this.spanTarget = this.width < 720 ? 25 : 26;
    this.yaw = this.yawTarget = .5;
  }

  world(x, z) { return [(x - (W - 1) / 2) * S, (z - (H - 1) / 2) * S]; }

  updateCamera() {
    const t = this.current, cp = Math.cos(this.pitch);
    this.eye.set(t[0] + Math.sin(this.yaw) * cp * EYE_DISTANCE, t[1] + Math.sin(this.pitch) * EYE_DISTANCE, t[2] + Math.cos(this.yaw) * cp * EYE_DISTANCE);
    // The camera basis, as the original's look(): az backward, ax right, ay up.
    this.az.set(this.eye.x - t[0], this.eye.y - t[1], this.eye.z - t[2]).normalize();
    this.ax.set(this.az.z, 0, -this.az.x).normalize();
    this.ay.crossVectors(this.az, this.ax);
    this.hh = this.span / 2;
    this.hw = this.hh * this.width / Math.max(1, this.height);
    const cam = this.camera;
    if (cam.left !== -this.hw || cam.top !== this.hh) {
      cam.left = -this.hw; cam.right = this.hw; cam.top = this.hh; cam.bottom = -this.hh;
      cam.updateProjectionMatrix();
    }
    cam.position.copy(this.eye);
    cam.up.set(0, 1, 0);
    cam.lookAt(t[0], t[1], t[2]);
  }

  /** World point → screen (CSS pixels). Writes into `out` so labels can reuse one object. */
  projectWorld(x, y, z, out = {}) {
    const vx = x - this.eye.x, vy = y - this.eye.y, vz = z - this.eye.z;
    const sx = (vx * this.ax.x + vy * this.ax.y + vz * this.ax.z) / this.hw;
    const sy = (vx * this.ay.x + vy * this.ay.y + vz * this.ay.z) / this.hh;
    const depth = -(vx * this.az.x + vy * this.az.y + vz * this.az.z);
    out.x = (sx * .5 + .5) * this.width;
    out.y = (-.5 * sy + .5) * this.height;
    out.visible = depth > NEAR && depth < FAR;
    return out;
  }
  project(x, z, y = .4, out = {}) { const p = this.world(x, z); return this.projectWorld(p[0], y, p[1], out); }

  /** Screen point → the ground plane (y = 0.36), as [x, z] in world units. */
  ground(sx, sy) {
    const nx = sx / this.width * 2 - 1, ny = 1 - sy / this.height * 2;
    const px = this.eye.x + this.ax.x * nx * this.hw + this.ay.x * ny * this.hh;
    const py = this.eye.y + this.ax.y * nx * this.hw + this.ay.y * ny * this.hh;
    const pz = this.eye.z + this.ax.z * nx * this.hw + this.ay.z * ny * this.hh;
    const dx = -this.az.x, dy = -this.az.y, dz = -this.az.z;
    const k = (.36 - py) / (dy || -1e-6);
    return [px + dx * k, pz + dz * k];
  }
  pick(sx, sy) {
    const p = this.ground(sx, sy);
    return this.game.tile(Math.round(p[0] / S + (W - 1) / 2), Math.round(p[1] / S + (H - 1) / 2));
  }
  focus(x, z) { const p = this.world(x, z); this.target[0] = p[0]; this.target[2] = p[1]; }
  home() {
    const g = this.game, c = g.capitalCity() || g.units().find((u) => u.type === 'settler') || g.units()[0];
    if (c) this.focus(c.x, c.z);
  }
  /** Zoom by a factor; wheel and buttons glide, a pinch follows the fingers. */
  zoom(v, immediate = false) {
    this.spanTarget = clampNum(this.spanTarget * v, 12, 49);
    if (immediate) { this.span = this.spanTarget; this.updateCamera(); }
  }
  rotate(v) { this.yawTarget += v; }
  pan(dx, dy) {
    if (!dx && !dy) return;
    const a = this.ground(this.width / 2, this.height / 2), b = this.ground(this.width / 2 + dx, this.height / 2 + dy);
    this.target[0] = clampNum(this.target[0] + a[0] - b[0], -23, 23);
    this.target[2] = clampNum(this.target[2] + a[1] - b[1], -21, 21);
    this.current[0] = this.target[0]; this.current[1] = this.target[1]; this.current[2] = this.target[2];
    this.updateCamera();
  }
  /** The UI calls this whenever the selection or the move target changes. */
  setSelection(selected, targetTile) { this.selected = selected; this.targetTile = targetTile; this.selVersion++; }
  setHover(tile) { this.hoverTile = tile || null; }

  /* ---------------------------------------------------------------- building instances */
  batch(set, type, mode) {
    const i = TYPE_INDEX[type] * MODES + mode;
    return set.batches[i] || (set.batches[i] = new Batch(this, type, mode, set.initial));
  }
  add(set, type, x, y, z, sx, sy, sz, color, ry = 0, mode = 0, rx = 0, rz = 0) {
    const b = this.batch(set, type, mode);
    if (b.count >= b.cap) b.grow();
    const m = b.m, o = b.count * 16;
    const cy = Math.cos(ry), sn = Math.sin(ry), cx = Math.cos(rx), xx = Math.sin(rx), cz = Math.cos(rz), zz = Math.sin(rz);
    m[o] = (cy * cz + sn * xx * zz) * sx; m[o + 1] = cx * zz * sx; m[o + 2] = (-sn * cz + cy * xx * zz) * sx; m[o + 3] = 0;
    m[o + 4] = (-cy * zz + sn * xx * cz) * sy; m[o + 5] = cx * cz * sy; m[o + 6] = (sn * zz + cy * xx * cz) * sy; m[o + 7] = 0;
    m[o + 8] = sn * cx * sz; m[o + 9] = -xx * sz; m[o + 10] = cy * cx * sz; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    const c = mode === 1 || mode === 5 ? WHITE : rgb(color), k = b.count * 3;
    b.c[k] = c[0]; b.c[k + 1] = c[1]; b.c[k + 2] = c[2];
    b.count++;
  }
  begin(set) { for (const b of set.batches) if (b) b.count = 0; }
  finish(set) { for (const b of set.batches) if (b) b.finish(); }
  line(b, a, c, width, color, y = .42, mode = 0) {
    const dx = c[0] - a[0], dz = c[1] - a[1];
    this.add(b, 'cube', (a[0] + c[0]) / 2, y, (a[1] + c[1]) / 2, width, .026, Math.hypot(dx, dz) + .01, color, Math.atan2(dx, dz), mode);
  }

  tree(b, x, z, s, h, n) { this.add(b, 'cylinder', x, h + s * .24, z, .12 * s, .57 * s, .12 * s, '#7f6a49'); const green = n > .65 ? '#91ad65' : n > .28 ? '#457f62' : '#326754'; if (n > .72) { this.add(b, 'ico', x, h + s * .75, z, .86 * s, .94 * s, .85 * s, green, n * 6); this.add(b, 'ico', x + .18 * s, h + s * .64, z - .12 * s, .66 * s, .7 * s, .65 * s, shade(green, 1.12), n * 2); } else { this.add(b, 'cone', x, h + s * .62, z, .88 * s, .91 * s, .88 * s, green, n * 6); this.add(b, 'cone', x, h + s * .94, z, .64 * s, .77 * s, .64 * s, shade(green, 1.12), n * 6); } }
  field(b, x, z, full = false) { const scale = full ? 1 : .62; this.add(b, 'cube', x, .405, z, 1.50 * scale, .05, 1.40 * scale, '#827446'); for (let i = 0; i < 5; i++) { this.add(b, 'cube', x + (-.6 + i * .3) * scale, .445, z, .12 * scale, .06, 1.28 * scale, i % 2 ? '#a0a85c' : '#bbad61'); for (let j = 0; j < 3; j++) { const xx = x + (-.6 + i * .3) * scale, zz = z + (-.45 + j * .45) * scale; this.add(b, 'cylinder', xx, .54, zz, .033, .25, .033, '#af9449'); this.add(b, 'ico', xx, .665, zz, .10, .19, .09, '#ddbd5a', i * .5); } } if (full) for (const a of [-.73, .73]) for (const c of [-.66, .66]) this.add(b, 'cube', x + a, .54, z + c, .06, .29, .06, '#baad82'); }
  mine(b, x, z, t) { this.add(b, 'ico', x, .56, z, 1.23, .50, .9, '#777f71', .4); this.add(b, 'cube', x, .58, z + .35, .46, .42, .12, '#363e36'); for (const a of [-.26, .26]) this.add(b, 'cube', x + a, .64, z + .39, .07, .57, .09, '#ad8f64'); this.add(b, 'cube', x, .93, z + .39, .66, .09, .12, '#b5996a'); this.add(b, 'cube', x + .38, .49, z + .60, .3, .13, .34, '#7c634c'); if (t.resource === 'gold') for (let i = 0; i < 3; i++) this.add(b, 'ico', x - .45 + i * .15, .54, z - .25, .20, .17, .19, '#d4af57', i); }
  building(b, x, z, w, d, h, color, roof, ry = 0) { this.add(b, 'cube', x, .39 + h / 2, z, w, h, d, color, ry); this.add(b, 'roof', x, .39 + h + .20, z, w + .09, .43, d + .12, roof, ry); this.add(b, 'cube', x, .39 + h * .48, z + d / 2 + .007, w * .18, h * .42, .018, '#595747', ry); if (w > .45) { this.add(b, 'cube', x - w * .30, .39 + h * .62, z + d / 2 + .011, w * .15, h * .21, .02, '#dfba70', ry, 4); this.add(b, 'cube', x + w * .30, .39 + h * .62, z + d / 2 + .011, w * .15, h * .21, .02, '#dfba70', ry, 4); } }
  /* Moonwell Gardens: three terraces, a spring-fed pool and two trees, where a small house stood. */
  gardens(b, x, z) {
    this.add(b, 'cube', x, .49, z, .56, .07, .56, '#7f9d5e');
    this.add(b, 'cube', x, .56, z, .42, .07, .42, '#94b36c');
    this.add(b, 'cube', x, .63, z, .28, .07, .28, '#a9c47d');
    this.add(b, 'cube', x, .672, z, .16, .02, .16, '#63aba0', 0, 5);
    this.tree(b, x - .19, z - .19, .34, .59, .5);
    this.tree(b, x + .19, z + .19, .3, .59, .9);
    // Flowers on the lowest terrace (the ring between .21 and .28 from the centre).
    for (const [dx, dz] of [[-.245, .1], [.1, -.245], [.245, -.05], [-.05, .245]]) this.add(b, 'ico', x + dx, .545, z + dz, .06, .05, .06, '#e7b7c8', dx);
  }
  /* The Clay Archive: a colonnaded hall with a red clay roof. */
  archive(b, x, z) {
    this.add(b, 'cube', x, .47, z, .5, .05, .4, '#d8cda9');
    this.add(b, 'cube', x, .66, z - .04, .42, .34, .24, '#e4d8b5');
    for (const dx of [-.19, -.065, .065, .19]) this.add(b, 'cylinder', x + dx, .66, z + .14, .045, .34, .045, '#efe7cb');
    this.add(b, 'cube', x, .855, z, .5, .05, .4, '#cdb98b');
    this.add(b, 'roof', x, .96, z, .5, .16, .4, '#b0875e');
    this.add(b, 'cube', x, .6, z + .085, .07, .2, .02, '#595747');
  }
  cityModel(b, c) {
    const [x, z] = this.world(c.x, c.z), roof = c.owner === 0 ? '#b97555' : c.owner === 1 ? '#ae5344' : '#6e83a3', wall = '#eadcb2';
    const gardens = c.buildings.includes('gardens'), archive = c.buildings.includes('archive');
    this.add(b, 'cube', x, .39, z, 1.74, .13, 1.7, '#b9ad80');
    this.building(b, x - .14, z - .12, .66, .57, .70, wall, roof);
    for (const [dx, dz, w, d, h] of [[-.56, .46, .38, .40, .38], [.49, .42, .42, .37, .44], [-.56, -.56, .38, .33, .33], [.55, -.52, .40, .36, .47]]) {
      if ((gardens && dx < 0 && dz > 0) || (archive && dx > 0 && dz > 0)) continue;
      this.building(b, x + dx, z + dz, w, d, h, shade(wall, .94), roof);
    }
    if (c.pop > 2) this.building(b, x + .63, z - .04, .33, .33, .58, wall, roof);
    if (c.pop > 4) this.building(b, x - .70, z - .04, .3, .32, .70, wall, roof);
    this.add(b, 'cylinder', x + .28, 1.31, z - .26, .045, 1.65, .045, '#b7a15f');
    this.add(b, 'ico', x + .28, 2.14, z - .26, .12, .15, .12, '#dbba68');
    this.add(b, 'cube', x + .49, 1.92, z - .26, .43, .27, .025, FACTIONS[c.owner]?.color || '#454f4a', 0, 6);
    if (c.buildings.includes('monument')) { this.add(b, 'cube', x + .62, .61, z + .65, .19, .54, .19, '#d5c79a'); this.add(b, 'cone', x + .62, .95, z + .65, .22, .18, .22, '#d3ad5d', Math.PI / 4); }
    if (c.buildings.includes('temple')) { this.add(b, 'cube', x - .12, 1.4, z - .12, .46, .07, .42, '#eaddb2'); this.add(b, 'cone', x - .12, 1.6, z - .12, .42, .35, .42, '#d0a858', Math.PI / 4); }
    if (gardens) this.gardens(b, x - .5, z + .5);
    if (archive) this.archive(b, x + .47, z + .36);
    if (c.buildings.includes('walls')) { for (const dz of [-.89, .89]) this.add(b, 'cube', x, .57, z + dz, 1.92, .48, .13, '#c6bd9e'); for (const dx of [-.89, .89]) this.add(b, 'cube', x + dx, .57, z, .13, .48, 1.92, '#c6bd9e'); for (const dx of [-.87, .87]) for (const dz of [-.87, .87]) this.add(b, 'cube', x + dx, .76, z + dz, .26, .85, .26, '#d1c6a6'); }
    if (c.buildings.includes('sunspire')) { for (let i = 0; i < 4; i++) this.add(b, 'cube', x, .46 + i * .25, z - .5, 1.3 - i * .21, .25, 1.05 - i * .16, i % 2 ? '#dec380' : '#eaddb7'); this.add(b, 'cube', x, 2.01, z - .5, .31, 1.55, .31, '#dbc082'); this.add(b, 'cone', x, 2.98, z - .5, .44, .44, .44, '#edc263', Math.PI / 4, 4); this.add(b, 'ring', x, 1.91, z - .5, 1.1, 1, 1.1, '#dcbc6d', 0, 4); }
  }
  ruin(b, x, z) { this.add(b, 'cube', x, .42, z, 1.05, .13, .88, '#a4a08a'); this.add(b, 'cube', x, .52, z, .77, .1, .63, '#c2bda0'); for (let i = 0; i < 3; i++) { const xx = x - .30 + i * .28, hh = .46 + (i % 2) * .24; this.add(b, 'cylinder', xx, .51 + hh / 2, z - .12, .15, hh, .15, '#d5cbaa'); this.add(b, 'cube', xx, .54 + hh, z - .12, .24, .09, .23, '#bbb191'); } this.add(b, 'cube', x - .21, .84, z + .22, .45, .19, .22, '#c4b99a', .32); }

  /** Rebuild the static set from the game: call after every change to the game state. */
  rebuild() {
    const b = this.sets.static, game = this.game;
    this.begin(b);
    this.add(b, 'plane', 0, .09, 0, 150, 1, 150, '#4d9b9b', 0, 1);
    for (const t of game.tiles) {
      const [x, z] = this.world(t.x, t.z), n = hash(t.x, t.z, game.s.seed);
      if (!t.explored) { if (t.type !== 'water') { this.add(b, 'cube', x, .14, z, 2.003, .36, 2.003, '#a7bcb4', 0, 2); if (n < .12) this.add(b, 'ico', x, .29, z, 2.8, .58, 2.6, '#b7c8bd', n * 6, 2); } continue; }
      if (t.type === 'water') continue;
      const base = t.type === 'sand' ? '#c3b477' : t.type === 'forest' ? '#5e8553' : t.type === 'hill' ? '#7f955d' : t.type === 'plains' ? '#9aa665' : '#73a561';
      const dark = t.visible ? 1 : .67;
      this.add(b, 'cube', x, -.16, z, 1.995, .84, 1.995, shade('#a59570', dark));
      this.add(b, 'cube', x, .32, z, 1.992, .16, 1.992, shade(base, (.92 + n * .14) * dark));
      if (this.grid) { for (const a of [-.994, .994]) { this.add(b, 'cube', x + a, .414, z, .012, .012, 1.99, '#bac593'); this.add(b, 'cube', x, .414, z + a, 1.99, .012, .012, '#bac593'); } }
      const city = game.cityAt(t.x, t.z);
      if (city) { this.cityModel(b, city); continue; }
      if (t.type === 'forest') { for (let j = 0; j < 4; j++) { const r = hash(t.x + j * 13, t.z + 7, game.s.seed), q = hash(t.x + 9, t.z + j * 19, game.s.seed); this.tree(b, x + (r - .5) * 1.22, z + (q - .5) * 1.20, .84 + r * .38, .4, q); } }
      if (t.type === 'hill') { this.add(b, 'ico', x - .13, .56, z - .10, 1.70, .62, 1.58, shade('#9aac75', dark), n * 4); for (let j = 0; j < 2; j++) this.add(b, 'ico', x + .4 - j * .7, .63, z + .28 + j * .11, .38, .33, .36, shade('#a0a08c', dark), j); }
      if (t.type === 'mountain') { const ht = 2.35 + n * 1.55; this.add(b, 'cone', x, .36 + ht / 2, z, 2.05, ht, 2.03, shade('#8b9991', dark), n * .5); this.add(b, 'cone', x, .36 + ht * .83, z, .75, ht * .35, .74, shade('#e7ece0', dark), n * .5); this.add(b, 'ico', x - .66, .66, z + .43, 1.24, .72, 1.3, shade('#97a392', dark), n * 3); }
      if (t.improvement === 'farm') this.field(b, x, z, true); else if (t.resource === 'wheat') this.field(b, x - .15, z + .1, false);
      if (t.improvement === 'mine') this.mine(b, x, z, t); else if (t.resource === 'gold' || t.resource === 'stone') for (let j = 0; j < 4; j++) { const dx = (hash(t.x + j, t.z, 5) - .5) * .95, dz = (hash(t.x, t.z + j, 8) - .5) * .8; this.add(b, 'ico', x + dx, .57, z + dz, .4, .29, .37, t.resource === 'gold' ? '#cfb461' : '#bdc3b1', j); }
      if (t.ruin) this.ruin(b, x, z);
      if (t.camp) { this.add(b, 'cone', x - .2, .80, z, 1.02, .87, 1.01, '#79634e', Math.PI / 4); this.add(b, 'cube', x - .2, .62, z + .39, .25, .41, .05, '#3c453a'); this.add(b, 'cylinder', x + .56, .88, z - .25, .04, 1.02, .04, '#5d5042'); this.add(b, 'cube', x + .72, 1.27, z - .25, .34, .25, .03, '#734f48', 0, 6); this.add(b, 'cone', x + .30, .54, z + .58, .24, .31, .24, '#d59a4b', 0, 4); }
      if (t.road) { this.add(b, 'cube', x, .422, z, .45, .023, .45, '#c1b394'); for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (game.tile(t.x + dx, t.z + dz)?.road) this.line(b, [x, z], [x + dx, z + dz], .22, '#c1b394', .424); }
      if (!t.resource && !t.improvement && !t.ruin && !t.camp && ['grass', 'plains'].includes(t.type)) { for (let j = 0; j < 3; j++) { const dx = (hash(t.x + j * 7, t.z, 31) - .5) * 1.6, dz = (hash(t.x, t.z + j * 3, 43) - .5) * 1.6; this.add(b, 'cone', x + dx, .44, z + dz, .08, .16, .08, shade('#728e55', dark), j); if (n > .6) this.add(b, 'ico', x + dx + .12, .43, z + dz, .05, .055, .05, '#eee2ab'); } }
    }
    // The river ribbon over the square tiles: sandy banks and moving water.
    for (let i = 0; i < RIVER_PATH.length - 1; i++) {
      const a = RIVER_PATH[i], c = RIVER_PATH[i + 1], t = game.tile(Math.round(a[0]), Math.round(a[1]));
      if (!t || !t.explored || t.type === 'water') continue;
      const p = this.world(a[0], a[1]), q = this.world(c[0], c[1]);
      this.line(b, p, q, .42, '#b9be91', .419);
      this.line(b, p, q, .28, '#63aba0', .440, 5);
    }
    // Culture borders are ribbons rather than solid tile overlays.
    for (const t of game.tiles) {
      if (t.owner < 0 || !t.explored || t.type === 'water') continue;
      const [x, z] = this.world(t.x, t.z), col = FACTIONS[t.owner]?.color || '#555c50';
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = game.tile(t.x + dx, t.z + dz);
        if (n?.owner === t.owner) continue;
        if (dx) this.line(b, [x + dx * .97, z - .98], [x + dx * .97, z + .98], .052, col, .456, 3);
        else this.line(b, [x - .98, z + dz * .97], [x + .98, z + dz * .97], .052, col, .456, 3);
      }
    }
    this.finish(b);
    this.shadowDirty = true;
    this.version++; this.selVersion++;
  }

  /** Distance from every water point to the nearest land, for the shore colour and foam. Land never changes within a game. */
  updateMapTexture() {
    const scale = 4, w = W * scale, h = H * scale, data = this.mapData, land = this.game.tiles.filter((t) => t.type !== 'water');
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const tx = (x + .5) / scale - .5, tz = (z + .5) / scale - .5;
      let dd = 5;
      for (const t of land) { const dx = Math.max(0, Math.abs(tx - t.x) - .5), dz = Math.max(0, Math.abs(tz - t.z) - .5); dd = Math.min(dd, Math.hypot(dx, dz) * 2); }
      const i = (z * w + x) * 4;
      data[i] = Math.round(dd / 5 * 255); data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255;
    }
    this.mapTex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- per frame */
  unitOffset(u) {
    const same = this.game.unitsAt(u.x, u.z).filter((v) => v.owner === u.owner), i = same.findIndex((v) => v.id === u.id), city = this.game.cityAt(u.x, u.z);
    if (city) return [.64 + (i % 2) * .25, .73 + Math.floor(i / 2) * .25, .69];
    if (same.length > 1) return [(i % 2 - .5) * .62, (Math.floor(i / 2) - .25) * .58, .78];
    return [0, 0, 1];
  }
  person(b, x, y, z, scale, type, color, id) {
    const a = (mesh, dx, dy, dz, sx, sy, sz, col, ry = 0, mode = 0, rx = 0, rz = 0) => this.add(b, mesh, x + dx * scale, y + dy * scale, z + dz * scale, sx * scale, sy * scale, sz * scale, col, ry, mode, rx, rz);
    const skin = id % 3 === 0 ? '#b88860' : id % 3 === 1 ? '#d6ad7a' : '#e1c394';
    a('cube', -.09, .14, 0, .13, .26, .17, '#574f41'); a('cube', .09, .14, 0, .13, .26, .17, '#574f41'); a('cube', 0, .38, 0, .34, .31, .25, type === 'worker' ? '#b09b74' : color); a('cylinder', 0, .68, 0, .26, .24, .26, skin); a('cube', -.23, .40, 0, .11, .28, .12, skin); a('cube', .23, .40, 0, .11, .28, .12, skin);
    if (type === 'scout') { a('cone', 0, .855, 0, .48, .17, .40, '#8c9a63'); a('cube', 0, .42, -.19, .29, .29, .14, '#ad8d58'); a('cylinder', .30, .47, .03, .04, .86, .04, '#796643'); }
    else if (type === 'worker') { a('cylinder', 0, .82, 0, .39, .06, .35, '#bcb18b'); a('cylinder', .33, .5, .08, .04, .77, .04, '#7f6545', 0, 0, 0, -.3); a('cube', .43, .83, .08, .36, .07, .10, '#808c89', 0, 0, 0, -.24); }
    else if (type === 'settler') { a('ico', 0, .82, 0, .34, .19, .33, '#c6b784'); a('cube', 0, .45, -.2, .32, .35, .2, '#b79e76'); a('cylinder', .33, .66, 0, .036, 1.3, .036, '#8e7950'); a('cube', .49, 1.19, 0, .32, .2, .024, color, 0, 6); }
    else { a('cylinder', 0, .81, 0, .32, .11, .30, '#bdad78'); a('cube', 0, .895, 0, .10, .09, .24, type === 'raider' ? '#956247' : '#bb825e'); a('cube', -.29, .38, .14, .25, .32, .085, color); a('cube', -.29, .4, .19, .045, .22, .012, '#dbc887', 0, 3); a('cylinder', .31, .61, 0, .04, type === 'spearman' ? 1.28 : .65, .04, '#9c8558'); a('cone', .31, type === 'spearman' ? 1.32 : .99, 0, .10, .18, .08, '#d4d8cb'); }
  }
  outline(b, x, z, size, color) {
    const d = size / 2, L = .37, ww = .033;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      this.add(b, 'cube', x + dx * (d - L / 2), .488, z + dz * d, L, .024, ww, color, 0, 3);
      this.add(b, 'cube', x + dx * d, .488, z + dz * (d - L / 2), ww, .024, L, color, 0, 3);
    }
  }
  burst(x, z, color = '#e4be70') { const p = this.world(x, z); this.particles.push({ x: p[0], z: p[1], color, t: this.animTime }); }

  /** Reach dots, the move path and the hover path, recomputed only when something they depend on changes. */
  refreshCaches() {
    const game = this.game, sel = this.selected, u = sel?.type === 'unit' ? game.unit(sel.id) : null;
    if (this.cacheVersion !== this.selVersion) {
      this.cacheVersion = this.selVersion;
      this.hoverFor = undefined;
      this.reach.length = 0; this.path.length = 0;
      if (u) {
        for (const k of game.reachable(u).keys()) { const t = game.tiles[k]; if (t.x !== u.x || t.z !== u.z) this.reach.push(t); }
        if (this.targetTile) { const p = game.path(u, this.targetTile.x, this.targetTile.z); if (p) for (const t of p.tiles) this.path.push(t); }
      }
    }
    if (this.hoverFor !== this.hoverTile) {
      this.hoverFor = this.hoverTile;
      this.hoverPath.length = 0;
      const h = this.hoverTile;
      if (u && h && !this.targetTile && (h.x !== u.x || h.z !== u.z)) { const p = game.path(u, h.x, h.z); if (p) for (const t of p.tiles) this.hoverPath.push(t); }
    }
  }

  pathDots(b, list, size, color) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], c = list[i + 1];
      const px = (a.x - (W - 1) / 2) * S, pz = (a.z - (H - 1) / 2) * S, qx = (c.x - (W - 1) / 2) * S, qz = (c.z - (H - 1) / 2) * S;
      for (let j = 1; j < 6; j++) this.add(b, 'cylinder', px + (qx - px) * j / 6, .48, pz + (qz - pz) * j / 6, size, .025, size, color, 0, 3);
    }
  }

  updateDynamic(time, dt) {
    const b = this.sets.dynamic, game = this.game;
    this.begin(b);
    for (const u of game.s.units) {
      const tile = game.tile(u.x, u.z);
      if (u.owner !== 0 && !tile.visible) continue;
      const off = this.unitOffset(u);
      const wx = (u.x - (W - 1) / 2) * S + off[0], wz = (u.z - (H - 1) / 2) * S + off[1];
      // [x, z, scale]: the smoothed position, shared with the unit labels.
      let old = this.unitPos.get(u.id);
      if (!old) { old = [wx, wz, off[2]]; this.unitPos.set(u.id, old); }
      old[2] = off[2];
      const k = Math.min(1, dt * 12);
      old[0] += (wx - old[0]) * k; old[1] += (wz - old[1]) * k;
      const x = old[0], z = old[1], scale = off[2], y = .45 + (u.moves > 0 && !u.fortified ? Math.sin(time * 2 + u.id) * .023 : 0), color = FACTIONS[u.owner]?.color || '#775749';
      this.add(b, 'cylinder', x, .44, z, .88 * scale, .055, .88 * scale, color);
      if (this.selected?.type === 'unit' && this.selected.id === u.id) this.add(b, 'ring', x, .479, z, 1.05 * scale, 1, 1.05 * scale, '#f0d492', time * .2, 3);
      if (u.type === 'catapult') { this.add(b, 'cube', x, y + .19, z, .54, .18, .55, '#8c7450'); this.add(b, 'cube', x, y + .53, z, .10, .70, .10, '#ba9462', 0, 0, 0, -.54); for (const dx of [-.3, .3]) for (const dz of [-.23, .23]) this.add(b, 'cylinder', x + dx, y + .1, z + dz, .19, .065, .19, '#514d3e', 0, 0, 0, Math.PI / 2); this.add(b, 'ico', x + .22, y + .93, z, .26, .24, .25, '#999e91'); }
      else if (u.type === 'settler') { this.person(b, x - .16, y, z, .9 * scale, 'settler', color, u.id); this.add(b, 'cube', x + .22, y + .20, z - .18, .39 * scale, .24 * scale, .44 * scale, '#998058'); this.add(b, 'ico', x + .22, y + .42, z - .18, .49 * scale, .46 * scale, .47 * scale, '#e1d4b0'); for (const dx of [.02, .40]) for (const dz of [-.38, .02]) this.add(b, 'cylinder', x + dx, y + .09, z + dz, .16 * scale, .06, .16 * scale, '#655d46', 0, 0, 0, Math.PI / 2); }
      else if (u.type === 'warrior' || u.type === 'spearman' || u.type === 'raider') { this.person(b, x - .20 * scale, y, z + .09 * scale, .84 * scale, u.type, color, u.id); this.person(b, x + .21 * scale, y, z - .12 * scale, .79 * scale, u.type, color, u.id + 1); }
      else this.person(b, x, y, z, scale, u.type, color, u.id);
    }
    // Units that left the map (defeated, disbanded) drop their smoothing state.
    if (this.unitPos.size > game.s.units.length + 8) for (const id of this.unitPos.keys()) if (!game.unit(id)) this.unitPos.delete(id);

    const sel = this.selected;
    const selected = sel?.type === 'unit' ? game.unit(sel.id) : sel?.type === 'city' ? game.city(sel.id) : sel?.tile;
    if (selected) { const x = (selected.x - (W - 1) / 2) * S, z = (selected.z - (H - 1) / 2) * S; this.outline(b, x, z, 1.94, this.targetTile ? '#d0d7ad' : '#efd28a'); }
    for (const t of this.reach) this.add(b, 'cylinder', (t.x - (W - 1) / 2) * S, .459, (t.z - (H - 1) / 2) * S, .09, .021, .09, t.explored ? '#e3e9bd' : '#c8d2c0', 0, 3);
    this.pathDots(b, this.path, .065, '#ffe3a0');
    if (this.targetTile) {
      const x = (this.targetTile.x - (W - 1) / 2) * S, z = (this.targetTile.z - (H - 1) / 2) * S;
      this.outline(b, x, z, 1.91, '#f5d183');
      this.add(b, 'ring', x, .479, z, .47, 1, .47, '#f5d183', time * .2, 3);
    }
    // Hover: a faint frame on the tile under the mouse or controller cursor, and the route a selected unit would take.
    const h = this.hoverTile;
    if (h && h !== this.targetTile && !(selected && selected.x === h.x && selected.z === h.z)) this.outline(b, (h.x - (W - 1) / 2) * S, (h.z - (H - 1) / 2) * S, 1.9, '#fbf3d6');
    this.pathDots(b, this.hoverPath, .05, '#f3e7c4');

    let live = 0;
    for (const p of this.particles) {
      const a = time - p.t;
      if (a >= 1.6) continue;
      this.particles[live++] = p;
      for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2, r = a * (.8 + hash(i, 3, 1)); this.add(b, 'ico', p.x + Math.cos(ang) * r, .7 + a * 1.8 - a * a * .7, p.z + Math.sin(ang) * r, .06, .06, .06, p.color, ang + a, 4); }
    }
    this.particles.length = live;
    // Small birds wheeling over the Jade Sea.
    for (let j = 0; j < 3; j++) { const x = -14 + Math.sin(time * .08 + j) * 3, z = 10 + Math.cos(time * .08 + j) * 2, y = 2.8 + j * .2; this.add(b, 'cube', x - .09, y, z, .22, .027, .065, '#e3e3ce', 0, 0, 0, Math.sin(time * 5 + j) * .3); this.add(b, 'cube', x + .09, y, z, .22, .027, .065, '#e3e3ce', 0, 0, 0, -Math.sin(time * 5 + j) * .3); }
    this.finish(b);
  }

  update(dt) {
    this.animTime += dt; this.frame++;
    const k = Math.min(1, dt * 8);
    for (let i = 0; i < 3; i++) this.current[i] += (this.target[i] - this.current[i]) * k;
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 9);
    this.span += (this.spanTarget - this.span) * Math.min(1, dt * 12);
    this.updateCamera();
    this.uTime.value = this.animTime;
    if (this.texel) {
      this.kit.renderer.getDrawingBufferSize(this.bufferSize ||= new THREE.Vector2());
      this.texel.value.set(1 / Math.max(1, this.bufferSize.x), 1 / Math.max(1, this.bufferSize.y));
    }
    this.refreshCaches();
    this.updateDynamic(this.animTime, dt);
    if (this.shadowDirty || this.frame % this.shadowEvery === 0) { this.sun.shadow.needsUpdate = true; this.shadowDirty = false; }
  }
}
