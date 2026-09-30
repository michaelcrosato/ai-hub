/*
 * The render layer: the game's Strata scene API (mesh records with array
 * positions, degree rotations and hex colours) drawn with three.js r186.
 *
 * Every record is drawn through an InstancedMesh per (shape, material) batch,
 * the same batching the old hand-written WebGL renderer did, but without
 * rebuilding buffers each frame: the static street set is written once, and
 * dynamic records reuse cached matrices when they did not move.
 *
 * The shading is the original shader rewritten in TSL: gamma-space base
 * colour, a night ambient + moonlight term, up to ten coloured point lights
 * with the old falloff, exponential fog clamped at 90% and the red T-800
 * vision filter. Colour management is off and the output is linear, so the
 * numbers reach the screen exactly as the old shader wrote them.
 */
import * as THREE from 'three/webgpu';
import { attribute, uniform, vec3, vec4, float, texture as textureNode, uv, normalWorldGeometry, positionWorld, cameraPosition, max, dot, normalize, pow, mix, clamp, exp, length } from 'three/tsl';
import { composeInto, multiplyInto, hex } from './math.js';

// The old shader worked on raw sRGB numbers; keep them raw (README trap: colour from before r152).
THREE.ColorManagement.enabled = false;

export const LIGHT_COUNT = 10;
const CAPACITY = 2048; // above 1024 instances three.js keeps instance matrices in a vertex buffer: one shader per material
const SHAPES = ['box', 'plane', 'sphere', 'cylinder', 'cone', 'ring', 'shard', 'rock'];
const SHAPE_INDEX = Object.fromEntries(SHAPES.map((s, i) => [s, i]));

/* ---------------------------------------------------------------- primitives (unchanged from Strata) */

function triangle(out, a, b, c, normal = null, uvs = [[0, 0], [1, 0], [1, 1]]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = normal || [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const pts = [a, b, c];
  for (let i = 0; i < 3; i++) out.push(pts[i][0], pts[i][1], pts[i][2], n[0] / len, n[1] / len, n[2] / len, uvs[i][0], uvs[i][1]);
}

/** Interleaved position(3) normal(3) uv(2) triangles, flat-shaded, exactly as the Strata engine built them. */
export function geometryData(type) {
  const a = [];
  if (type === 'shard') triangle(a, [-0.5, -0.5, 0], [0.5, -0.28, 0], [0.14, 0.5, 0]);
  else if (type === 'box' || type === 'plane') {
    const faces = [
      [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]],
      [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]],
      [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]],
      [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]],
      [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
      [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
    ];
    for (const q of type === 'plane' ? [faces[4]] : faces) {
      triangle(a, q[0], q[1], q[2]);
      triangle(a, q[0], q[2], q[3], null, [[0, 0], [1, 1], [0, 1]]);
    }
  } else if (type === 'cylinder' || type === 'cone' || type === 'ring') {
    const n = type === 'ring' ? 32 : 10, top = type === 'cone' ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, u = ((i + 1) / n) * Math.PI * 2;
      const p = [Math.cos(t), -0.5, Math.sin(t)], q = [Math.cos(u), -0.5, Math.sin(u)];
      const r = [top * Math.cos(u), 0.5, top * Math.sin(u)], s = [top * Math.cos(t), 0.5, top * Math.sin(t)];
      if (type === 'ring') {
        const inner = 0.9;
        triangle(a, [p[0], p[2], 0], [q[0], q[2], 0], [q[0] * inner, q[2] * inner, 0], [0, 0, 1]);
        triangle(a, [p[0], p[2], 0], [q[0] * inner, q[2] * inner, 0], [p[0] * inner, p[2] * inner, 0], [0, 0, 1]);
      } else {
        triangle(a, p, r, q);
        triangle(a, p, s, r);
        triangle(a, [0, -0.5, 0], p, q, [0, -1, 0]);
        if (top) triangle(a, [0, 0.5, 0], r, s, [0, 1, 0]);
      }
    }
  } else {
    const rings = type === 'rock' ? 3 : 7, segments = type === 'rock' ? 7 : 12;
    const p = (ii, jj) => {
      const t = (ii / segments) * 2 * Math.PI, f = (jj / rings) * Math.PI;
      return [Math.sin(f) * Math.cos(t), Math.cos(f), Math.sin(f) * Math.sin(t)];
    };
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        triangle(a, p(i, j), p(i, j + 1), p(i + 1, j + 1));
        triangle(a, p(i, j), p(i + 1, j + 1), p(i + 1, j));
      }
  }
  return new Float32Array(a);
}

function buildGeometry(shape) {
  const data = geometryData(shape), n = data.length / 8;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = data[i * 8]; pos[i * 3 + 1] = data[i * 8 + 1]; pos[i * 3 + 2] = data[i * 8 + 2];
    nor[i * 3] = data[i * 8 + 3]; nor[i * 3 + 1] = data[i * 8 + 4]; nor[i * 3 + 2] = data[i * 8 + 5];
    uvs[i * 2] = data[i * 8 + 6]; uvs[i * 2 + 1] = data[i * 8 + 7];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return g;
}

/* ---------------------------------------------------------------- shading */

export const U = {
  vision: uniform(0),
  fog: uniform(new THREE.Vector3(11 / 255, 26 / 255, 44 / 255)),
  fogDensity: uniform(0.009),
  sun: uniform(0.5),
  lightPos: Array.from({ length: LIGHT_COUNT }, () => uniform(new THREE.Vector4(0, 0, 0, 1))),
  lightColor: Array.from({ length: LIGHT_COUNT }, () => uniform(new THREE.Vector3(0, 0, 0))),
};
const SUN_DIR = vec3(-0.5, 1, 0.4).normalize();

function makeMaterial({ view, unlit, transparent, map }) {
  const m = new THREE.MeshBasicNodeMaterial();
  m.side = THREE.DoubleSide; // the old renderer never culled faces, and some meshes rely on it
  // One pass per batch like the old renderer; three.js would otherwise draw transparent
  // double-sided batches twice (back faces, then front faces).
  m.forceSinglePass = true;
  m.transparent = transparent;
  m.depthWrite = !transparent;
  m.fog = false;
  m.toneMapped = false;
  m.alphaTest = 0.02;
  let base = attribute('icolor', 'vec4');
  if (map) base = base.mul(textureNode(map, uv()));
  let rgb;
  if (unlit) rgb = base.rgb;
  else {
    // The flat face normal, never flipped on back faces (the old shader lit both sides alike).
    const n = normalize(normalWorldGeometry);
    const diffuse = max(dot(n, SUN_DIR), 0);
    let light;
    if (view) {
      // The first-person weapon uses the day lighting of the original viewmodel pass.
      light = vec3(0.45, 0.5, 0.45).add(vec3(0.7, 0.63, 0.48).mul(diffuse).mul(U.sun)).mul(max(n.y, 0).mul(0.13).add(0.87));
    } else {
      light = vec3(0.21, 0.3, 0.43).add(vec3(0.32, 0.43, 0.61).mul(diffuse));
      for (let i = 0; i < LIGHT_COUNT; i++) {
        const lp = U.lightPos[i];
        const l = lp.xyz.sub(positionWorld);
        const d = length(l);
        const fall = pow(max(float(1).sub(d.div(max(lp.w, 0.1))), 0), 2);
        const nd = max(dot(n, l.div(max(d, 0.0001))), 0);
        light = light.add(U.lightColor[i].mul(fall.mul(nd.mul(0.82).add(0.18))));
      }
    }
    rgb = pow(max(pow(base.rgb, vec3(2.2)).mul(light), vec3(0)), vec3(1 / 2.2));
  }
  let lit = rgb;
  if (!view) {
    const f = float(1).sub(exp(length(positionWorld.sub(cameraPosition)).mul(U.fogDensity).negate()));
    lit = mix(rgb, U.fog, clamp(f, 0, 0.9));
  }
  const lum = clamp(pow(max(dot(lit, vec3(0.299, 0.587, 0.114)), 0), 0.78).mul(1.8), 0, 1);
  const machine = vec3(lum, lum.mul(0.17), lum.mul(0.1));
  m.colorNode = vec4(mix(lit, machine, U.vision), base.a);
  return m;
}

/* ---------------------------------------------------------------- the three.js side */

export class Gfx {
  constructor(kit) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.world = new THREE.Scene();
    this.world.background = new THREE.Color(11 / 255, 26 / 255, 44 / 255);
    this.view = new THREE.Scene();
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(70, 1, 0.05, 1200));
    this.viewCamera = kit.fitCamera(new THREE.PerspectiveCamera(60, 1, 0.01, 10));
    this.geometries = new Map();
    this.materials = new Map();
    this.textures = new Map();
    this.textureSlots = 0;
    this.order = 0;
    this.frame = 0;
    this.stats = { draws: 0, instances: 0 };
  }

  baseGeometry(shape) {
    let g = this.geometries.get(shape);
    if (!g) this.geometries.set(shape, (g = buildGeometry(shape)));
    return g;
  }

  material(proto) {
    const key = `${proto.view ? 'v' : 'w'}${proto.unlit ? 'u' : 'l'}${proto.transparent ? 't' : 'o'}${proto.map ? proto.map.userData.slot : ''}`;
    let m = this.materials.get(key);
    if (!m) this.materials.set(key, (m = makeMaterial(proto)));
    return m;
  }

  /** A canvas texture, made once per key and kept across restarts. */
  texture(key, draw) {
    let t = this.textures.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(draw());
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 4;
      t.userData.slot = ++this.textureSlots;
      this.textures.set(key, t);
    }
    return t;
  }

  createScene() {
    return new StrataScene(this);
  }

  createBatch(ss, proto, capacity, dynamic) {
    const geo = this.baseGeometry(proto.shape).clone();
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    if (dynamic) colors.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('icolor', colors);
    const mesh = new THREE.InstancedMesh(geo, this.material(proto), capacity);
    if (dynamic) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.renderOrder = this.order++;
    (proto.view ? ss.viewRoot : ss.worldRoot).add(mesh);
    return { proto, mesh, geo, colors, capacity, count: 0, matrices: mesh.instanceMatrix.array, colorArr: colors.array };
  }

  grow(ss, b) {
    const next = this.createBatch(ss, b.proto, b.capacity * 2, true);
    next.matrices.set(b.matrices.subarray(0, b.count * 16));
    next.colorArr.set(b.colorArr.subarray(0, b.count * 4));
    next.count = b.count;
    next.mesh.renderOrder = b.mesh.renderOrder;
    b.mesh.removeFromParent();
    b.geo.dispose();
    b.mesh.dispose();
    Object.assign(b, next);
  }

  flush(b) {
    const n = b.count;
    b.mesh.count = n;
    b.mesh.visible = n > 0;
    if (!n) return;
    const im = b.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, n * 16);
    im.needsUpdate = true;
    b.colors.clearUpdateRanges();
    b.colors.addUpdateRange(0, n * 4);
    b.colors.needsUpdate = true;
  }

  write(m, b, frame) {
    const i = b.count++;
    // Local matrix, recomputed only when position, rotation or scale changed.
    let k = m._k;
    if (!k) {
      m._k = k = new Float64Array(9).fill(NaN);
      m._m = new Float32Array(16);
    }
    const P = m.position, R = m.rotation, S = m.scale;
    if (k[0] !== P[0] || k[1] !== P[1] || k[2] !== P[2] || k[3] !== R[0] || k[4] !== R[1] || k[5] !== R[2] || k[6] !== S[0] || k[7] !== S[1] || k[8] !== S[2]) {
      k[0] = P[0]; k[1] = P[1]; k[2] = P[2]; k[3] = R[0]; k[4] = R[1]; k[5] = R[2]; k[6] = S[0]; k[7] = S[1]; k[8] = S[2];
      composeInto(m._m, P, R, S);
    }
    const g = m.parent;
    if (g) {
      if (g._f !== frame) {
        g._m ||= new Float32Array(16);
        composeInto(g._m, g.position, g.rotation, g.scale);
        g._f = frame;
      }
      multiplyInto(b.matrices, i * 16, g._m, m._m);
    } else b.matrices.set(m._m, i * 16);
    const c = hex(m.color), o = i * 4, ca = b.colorArr;
    ca[o] = c[0]; ca[o + 1] = c[1]; ca[o + 2] = c[2]; ca[o + 3] = m.alpha;
  }

  keyOf(m) {
    const shape = SHAPE_INDEX[m.shape] ?? 2;
    const tex = m.texture ? m.texture.userData.slot : 0;
    const transparent = m.texture || m.alpha < 1 ? 1 : 0;
    return ((((tex * 2 + (m.viewmodel ? 1 : 0)) * 2 + (m.unlit ? 1 : 0)) * 2 + transparent) * 8) + shape;
  }

  protoOf(m) {
    return { shape: SHAPE_INDEX[m.shape] === undefined ? 'sphere' : m.shape, view: !!m.viewmodel, unlit: !!m.unlit, transparent: !!(m.texture || m.alpha < 1), map: m.texture || null };
  }

  buildStatic(ss) {
    for (const b of ss.staticBatches) {
      b.mesh.removeFromParent();
      b.geo.dispose();
      b.mesh.dispose();
    }
    ss.staticBatches = [];
    const groups = new Map();
    for (const m of ss.frozen) {
      if (!m.visible || m.parent?.visible === false) continue;
      const key = this.keyOf(m);
      let list = groups.get(key);
      if (!list) groups.set(key, (list = []));
      list.push(m);
    }
    const frame = ++this.frame;
    for (const list of groups.values()) {
      const b = this.createBatch(ss, this.protoOf(list[0]), Math.max(CAPACITY, list.length), false);
      for (const m of list) this.write(m, b, frame);
      this.flush(b);
      ss.staticBatches.push(b);
    }
    ss.staticDirty = false;
  }

  batchFor(ss, m) {
    const key = this.keyOf(m);
    let b = ss.dynamic.get(key);
    if (!b) ss.dynamic.set(key, (b = this.createBatch(ss, this.protoOf(m), CAPACITY, true)));
    return b;
  }

  /** Copy the scene records into the instance buffers. */
  sync(ss) {
    if (ss.staticDirty) this.buildStatic(ss);
    const frame = ++this.frame;
    for (const b of ss.dynamic.values()) b.count = 0;
    for (const m of ss.meshes) {
      if (!m.visible) continue;
      const g = m.parent;
      if (g && g.visible === false) continue;
      const b = this.batchFor(ss, m);
      if (b.count === b.capacity) this.grow(ss, b);
      this.write(m, b, frame);
    }
    let draws = 0, instances = 0, view = 0;
    for (const b of ss.dynamic.values()) {
      this.flush(b);
      if (b.count) {
        draws++;
        instances += b.count;
        if (b.proto.view) view += b.count;
      }
    }
    for (const b of ss.staticBatches) {
      draws++;
      instances += b.count;
    }
    this.stats.draws = draws;
    this.stats.instances = instances;
    ss.viewCount = view;
  }

  /** Compile the pipelines the scene will need, including ones for effects that have not appeared yet. */
  async warm(ss, extras = []) {
    if (ss.staticDirty) this.buildStatic(ss);
    for (const m of ss.meshes) this.batchFor(ss, m);
    for (const e of extras) {
      const key = this.keyOf(e);
      if (!ss.dynamic.has(key)) ss.dynamic.set(key, this.createBatch(ss, this.protoOf(e), CAPACITY, true));
    }
    const temp = [];
    for (const b of ss.dynamic.values()) {
      if (b.count) continue;
      b.matrices.fill(0, 0, 16);
      b.mesh.count = 1;
      b.mesh.visible = true;
      temp.push(b);
    }
    this.applyCamera(ss);
    try {
      await this.renderer.compileAsync(this.world, this.camera);
      await this.renderer.compileAsync(this.view, this.viewCamera);
    } catch (err) {
      console.warn('Pipeline warm-up failed; shaders will compile on first use.', err);
    }
    for (const b of temp) {
      b.mesh.count = 0;
      b.mesh.visible = false;
    }
  }

  applyCamera(ss) {
    const c = ss.camera, cam = this.camera;
    cam.position.set(c.position[0], c.position[1], c.position[2]);
    cam.lookAt(c.target[0], c.target[1], c.target[2]);
    if (Math.abs(cam.fov - c.fov) > 1e-4) {
      cam.fov = c.fov;
      cam.updateProjectionMatrix();
    }
  }

  render(ss) {
    if (!ss || ss.disposed) return;
    this.sync(ss);
    const env = ss.environment;
    const sky = hex(env.sky);
    U.fog.value.set(sky[0], sky[1], sky[2]);
    U.fogDensity.value = env.fog;
    U.sun.value = env.sun;
    U.vision.value = env.vision ? 1 : 0;
    if (env.vision) this.world.background.setRGB(0.12, 0.013, 0.009);
    else this.world.background.setRGB(sky[0], sky[1], sky[2]);
    const lights = ss.pointLights;
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const l = lights[i];
      if (l) {
        U.lightPos[i].value.set(l.position[0], l.position[1], l.position[2], l.radius);
        U.lightColor[i].value.set(l.color[0], l.color[1], l.color[2]);
      } else {
        U.lightPos[i].value.set(0, 0, 0, 1);
        U.lightColor[i].value.set(0, 0, 0);
      }
    }
    this.applyCamera(ss);
    const r = this.renderer;
    r.autoClear = true;
    r.autoClearColor = true;
    r.render(this.world, this.camera);
    if (ss.viewCount) {
      // The weapon draws last with its own projection and a cleared depth buffer, as before.
      r.autoClearColor = false;
      r.render(this.view, this.viewCamera);
      r.autoClearColor = true;
    }
  }
}

/* ---------------------------------------------------------------- the scene API the game code uses */

export class StrataScene {
  constructor(gfx) {
    this.gfx = gfx;
    this.meshes = new Set();
    this.frozen = [];
    this.staticDirty = false;
    this.staticBatches = [];
    this.dynamic = new Map();
    this.viewCount = 0;
    this.disposed = false;
    this.camera = { position: [30, 25, 35], target: [0, 0, 0], fov: 48 };
    this.environment = { sky: '#bec9bc', fog: 0.008, sun: 1.25 };
    this.pointLights = [];
    this.worldRoot = new THREE.Group();
    this.viewRoot = new THREE.Group();
    gfx.world.add(this.worldRoot);
    gfx.view.add(this.viewRoot);
  }
  mesh(shape = 'box', position = [0, 0, 0], scale = [1, 1, 1], color = '#b5b8a5', rotation = [0, 0, 0], extra = {}) {
    const m = { shape, position: [...position], scale: [...scale], color, rotation: [...rotation], visible: true, alpha: 1, castShadow: true, ...extra };
    this.meshes.add(m);
    return m;
  }
  group() {
    return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, children: [] };
  }
  part(group, shape, p, s, color, r = [0, 0, 0], extra = {}) {
    const m = this.mesh(shape, p, s, color, r, { ...extra, parent: group });
    group.children.push(m);
    return m;
  }
  remove(mesh) {
    this.meshes.delete(mesh);
  }
  texture(key, draw) {
    return this.gfx.texture(key, draw);
  }
  label(text, p, width = 4, height = 0.65, color = '#c6e8a8', background = '#21342c', rotation = [0, 0, 0]) {
    const texture = this.texture(`label|${text}|${width}|${height}|${color}|${background}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = Math.max(64, Math.round((768 * height) / width));
      const c = canvas.getContext('2d');
      c.fillStyle = background;
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = color;
      c.font = `600 ${canvas.height * 0.58}px monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, canvas.width / 2, canvas.height * 0.53, canvas.width * 0.94);
      return canvas;
    });
    return this.mesh('plane', p, [width, height, 1], '#ffffff', rotation, { texture, unlit: true, castShadow: false });
  }
  /** Records that never change again (the street set) move into instance buffers written once. */
  freeze(list) {
    for (const m of list) if (this.meshes.delete(m)) this.frozen.push(m);
    this.staticDirty = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const b of [...this.dynamic.values(), ...this.staticBatches]) {
      b.mesh.removeFromParent();
      b.geo.dispose();
      b.mesh.dispose();
    }
    this.dynamic.clear();
    this.staticBatches = [];
    this.worldRoot.removeFromParent();
    this.viewRoot.removeFromParent();
    this.meshes.clear();
    this.frozen = [];
  }
}
