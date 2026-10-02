/*
 * Strata's retained scene API, drawn with three.js r186 (WebGPU, WebGL2 fallback) through the shared kit.
 *
 * Experiences still describe the world as plain mesh records ({ shape, position, rotation, scale,
 * color, alpha, unlit, texture, parent, viewmodel, castShadow }). Every frame the records are batched
 * by shape and material into instanced meshes (one draw per batch, as the old hand-written WebGL
 * renderer did) and drawn with node materials that reproduce its shading:
 *   - gamma-space colours lit in linear space: pow(pow(c, 2.2) * light, 1 / 2.2)
 *   - a warm key light from normalize(-0.5, 1, 0.4) with a 38 % shadow floor, a flat ambient and a
 *     soft sky term on upward faces
 *   - exponential distance fog mixed in gamma space, capped at 90 %
 * Shadows are three.js shadow maps from the same light (sized by the kit's quality tier). The
 * first-person view model is drawn in a second pass over a cleared depth buffer with its own 60°
 * camera, as before.
 *
 * The page runs with ColorManagement disabled and linear output (see setup.js), so the values the
 * materials write are exactly the gamma-space colours the old shader produced.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  cameraPosition,
  clamp,
  exp,
  float,
  length,
  max,
  mix,
  normalWorld,
  output,
  positionWorld,
  pow,
  texture as textureNode,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import { createPost } from 'kit/post.js';
import { createInstanced } from 'kit/instancing.js';
import { splitGeometry } from './Geometry.js';

const DEG = Math.PI / 180;
const SHAPES = ['box', 'plane', 'cylinder', 'cone', 'ring', 'sphere', 'rock'];
/** Single-sided shapes. The old renderer never culled, so they show (and cast) from both faces. */
const OPEN = new Set(['plane', 'ring']);
/** The old depth pass looked at the light target from this offset. */
const SUN_OFFSET = [-70, 140, 56];
const MAT = Symbol('strata.matrix');
const STAMP = Symbol('strata.frame');

export class Scene {
  meshes = [];
  textures = new Set();
  disposed = false;
  camera = { position: [30, 25, 35], target: [0, 0, 0], fov: 48 };
  environment = { sky: '#bec9bc', fog: 0.008, sun: 1.25 };
  lightTarget = [0, 0, 0];
  shadowRadius = 32;
  constructor(renderer) {
    this.renderer = renderer;
    renderer.scenes.add(this);
  }
  mesh(shape = 'box', position = [0, 0, 0], scale = [1, 1, 1], color = '#b5b8a5', rotation = [0, 0, 0], extra = {}) {
    const m = { shape, position: [...position], scale: [...scale], color, rotation: [...rotation], visible: true, alpha: 1, castShadow: true, ...extra };
    this.meshes.push(m);
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
    const i = this.meshes.indexOf(mesh);
    if (i >= 0) this.meshes.splice(i, 1);
  }
  label(text, p, width = 4, height = 0.65, color = '#c6e8a8', background = '#21342c', rotation = [0, 0, 0]) {
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
    const texture = this.renderer.texture(canvas);
    this.textures.add(texture);
    return this.mesh('plane', p, [width, height, 1], '#ffffff', rotation, { texture, unlit: true, castShadow: false });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.textures) this.renderer.releaseTexture(t);
    this.textures.clear();
    this.meshes = [];
    this.renderer.scenes.delete(this);
  }
}

/** Column-major TRS with the engine's XYZ Euler order in degrees (math3d.compose), written at out[o]. */
function composeInto(out, o, p, r, s) {
  const x = r[0] * DEG,
    y = r[1] * DEG,
    z = r[2] * DEG;
  const a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  out[o] = c * e * s[0];
  out[o + 1] = (a * f + b * e * d) * s[0];
  out[o + 2] = (b * f - a * e * d) * s[0];
  out[o + 3] = 0;
  out[o + 4] = -c * f * s[1];
  out[o + 5] = (a * e - b * f * d) * s[1];
  out[o + 6] = (b * e + a * f * d) * s[1];
  out[o + 7] = 0;
  out[o + 8] = d * s[2];
  out[o + 9] = -b * c * s[2];
  out[o + 10] = a * c * s[2];
  out[o + 11] = 0;
  out[o + 12] = p[0];
  out[o + 13] = p[1];
  out[o + 14] = p[2];
  out[o + 15] = 1;
}

/** out[o..o+15] = a × b, both column-major 4×4. */
function multiplyInto(out, o, a, b) {
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4],
      b1 = b[col * 4 + 1],
      b2 = b[col * 4 + 2],
      b3 = b[col * 4 + 3];
    out[o + col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[o + col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[o + col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[o + col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
}

/**
 * One instanced draw: every record that shares a shape and a material. The meshes come from
 * kit/instancing.js, so every batch (of any shape or size) shares one set of shader programs.
 */
class Batch {
  constructor(renderer, pool, shape, { transparent, unlit, cast, texture }) {
    this.renderer = renderer;
    this.pool = pool;
    this.shape = shape;
    this.transparent = transparent;
    this.unlit = unlit;
    this.cast = cast;
    this.texture = texture;
    this.open = OPEN.has(shape);
    this.n = 0;
    this.capacity = 0;
    this.mesh = null;
    this.material = renderer.material(pool, this);
    this.triangles = renderer.template(shape).count / 3;
    this.build(64);
  }
  build(capacity) {
    const old = this.mesh;
    const template = this.renderer.template(this.shape);
    const geometry = new THREE.BufferGeometry();
    // Each batch owns its (tiny) geometry, so disposing one never frees another's buffers.
    geometry.setAttribute('position', template.position.clone());
    geometry.setAttribute('normal', template.normal.clone());
    geometry.setAttribute('uv', template.uv.clone());
    geometry.boundingSphere = template.sphere.clone();
    const mesh = createInstanced(geometry, this.material, capacity);
    const allocated = mesh.instanceMatrix.count;
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(allocated * 4), 4);
    colors.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instColor', colors);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = this.cast;
    mesh.receiveShadow = !this.unlit && this.pool.shadows;
    mesh.count = 0;
    mesh.visible = false;
    if (old) {
      // Keep what this frame already wrote.
      mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.n * 16));
      colors.array.set(this.colors.subarray(0, this.n * 4));
      this.pool.scene.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    this.pool.scene.add(mesh);
    this.mesh = mesh;
    this.matrices = mesh.instanceMatrix.array;
    this.colorAttr = colors;
    this.colors = colors.array;
    this.capacity = allocated;
  }
  /** Reserve the next instance slot and return its index. */
  next() {
    if (this.n >= this.capacity) this.build(this.capacity * 2);
    return this.n++;
  }
  commit() {
    const n = this.n,
      mesh = this.mesh;
    mesh.count = n;
    mesh.visible = n > 0;
    if (n > 0) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, n * 16);
      mesh.instanceMatrix.needsUpdate = true;
      this.colorAttr.clearUpdateRanges();
      this.colorAttr.addUpdateRange(0, n * 4);
      this.colorAttr.needsUpdate = true;
    }
  }
  dispose() {
    this.pool.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

/** A pass: its three.js scene, its batches and the fog its materials read. */
function makePool(name, shadows) {
  return {
    name,
    shadows,
    scene: new THREE.Scene(),
    flat: [], // untextured batches by numeric key
    textured: new Map(), // texture -> [batch by shape/unlit key]
    list: [], // every batch, in creation order
    fogDensity: uniform(0),
    fogColor: uniform(new THREE.Color(0, 0, 0)),
  };
}

export class Renderer {
  scenes = new Set();
  geometries = new Map();
  stats = { draws: 0, triangles: 0, meshes: 0 };
  frame = 0;
  constructor(kit) {
    this.kit = kit;
    this.gl = kit.renderer;
    this.canvas = kit.canvas;
    this.backend = kit.backendLabel;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.shapeIndex = new Map(SHAPES.map((s, i) => [s, i]));
    this.colors = new Map();
    this.materials = new Map();
    this.world = makePool('world', true);
    this.viewmodel = makePool('viewmodel', false);
    this.pools = [this.world, this.viewmodel];
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 1200);
    this.vmCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.world.scene.add(this.camera);
    this.sky = new THREE.Color(0.75, 0.79, 0.74);
    this.world.scene.background = this.sky;

    // World lights. Intensities carry the π the physically based BRDF divides by.
    this.ambient = new THREE.AmbientLight(0xffffff, Math.PI);
    this.ambient.color.setRGB(0.45, 0.5, 0.45);
    this.sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.sun.color.setRGB(0.7, 0.63, 0.48);
    this.sun.castShadow = true; // decided once, never toggled (r186)
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2;
    this.sun.shadow.intensity = 0.62; // the old 38 % shadow floor
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    kit.shadow(this.sun, 2048);
    this.world.scene.add(this.ambient, this.sun, this.sun.target);
    this.shadowRadius = 0;
    // The light's axes, for snapping the shadow camera to whole texels (no shimmer when it follows the car).
    const dir = new THREE.Vector3(-SUN_OFFSET[0], -SUN_OFFSET[1], -SUN_OFFSET[2]).normalize();
    this.lightRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    this.lightUp = new THREE.Vector3().crossVectors(dir, this.lightRight).normalize();
    this.snapped = new THREE.Vector3();

    // View-model lights: the old gun pass used the day formula with camera-space normals.
    this.vmAmbient = new THREE.AmbientLight(0xffffff, Math.PI);
    this.vmAmbient.color.setRGB(0.45, 0.5, 0.45);
    this.vmSun = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.vmSun.color.setRGB(0.7, 0.63, 0.48);
    this.vmSun.position.set(-0.5, 1, 0.4);
    this.viewmodel.scene.add(this.vmAmbient, this.vmSun, this.vmSun.target);

    kit.onResize((w, h) => {
      const aspect = w / Math.max(1, h);
      this.camera.aspect = this.vmCamera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.vmCamera.updateProjectionMatrix();
    });
    this.post = null;
    this.scratch = new Float32Array(16);
  }

  // ---- resources

  template(shape) {
    let t = this.geometries.get(shape);
    if (!t) {
      const data = splitGeometry(shape);
      t = {
        position: new THREE.BufferAttribute(data.position, 3),
        normal: new THREE.BufferAttribute(data.normal, 3),
        uv: new THREE.BufferAttribute(data.uv, 2),
        count: data.count,
        sphere: new THREE.Sphere(new THREE.Vector3(), 2),
      };
      this.geometries.set(shape, t);
    }
    return t;
  }
  texture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
  }
  releaseTexture(texture) {
    for (const pool of this.pools) {
      const list = pool.textured.get(texture);
      if (!list) continue;
      for (const b of list) {
        if (!b) continue;
        b.dispose();
        pool.list.splice(pool.list.indexOf(b), 1);
      }
      pool.textured.delete(texture);
    }
    for (const [key, m] of this.materials)
      if (m.userData.texture === texture) {
        m.dispose();
        this.materials.delete(key);
      }
    texture.dispose();
  }
  createScene() {
    return new Scene(this);
  }

  /**
   * The materials, shared by every batch with the same look. Lit ones run three.js lighting
   * (ambient + the shadowed key light) on pow(colour, 2.2); every material then finishes in
   * gamma space in outputNode: back to gamma, then fog.
   */
  material(pool, { transparent, unlit, texture, open }) {
    const lit = !unlit;
    // Closed opaque shapes are wound outward, so they cull their back faces; open shapes and
    // see-through ones draw both faces in one blended pass, as the old renderer did.
    const both = open || transparent;
    const key = `${pool.name}/${lit ? 'lit' : 'unlit'}/${transparent ? 't' : 'o'}/${texture ? texture.id : '-'}/${both ? 'both' : 'front'}`;
    let m = this.materials.get(key);
    if (m) return m;
    m = lit ? new THREE.MeshLambertNodeMaterial() : new THREE.MeshBasicNodeMaterial();
    m.name = key;
    m.side = both ? THREE.DoubleSide : THREE.FrontSide;
    // Closed shapes cast from their back faces (no acne on lit faces); open ones from both.
    m.shadowSide = open ? THREE.DoubleSide : THREE.BackSide;
    m.forceSinglePass = true;
    m.fog = false;
    m.transparent = transparent;
    m.depthWrite = !transparent;
    m.userData.texture = texture || null;
    const inst = attribute('instColor', 'vec4');
    let base = inst.rgb,
      alpha = inst.a;
    if (texture) {
      const t = textureNode(texture, uv());
      base = base.mul(t.rgb);
      alpha = alpha.mul(t.a);
    }
    if (lit) {
      // light *= 0.87 + 0.13 · max(n.y, 0): folded into the albedo, which multiplies all light.
      const linear = pow(max(base, vec3(0)), vec3(2.2));
      m.colorNode = vec4(linear.mul(max(normalWorld.y, 0).mul(0.13).add(0.87)), alpha);
    } else {
      m.colorNode = vec4(base, alpha);
    }
    const fogDensity = pool.fogDensity,
      fogColor = pool.fogColor;
    m.outputNode = Fn(() => {
      const rgb = vec3(output.rgb).toVar();
      if (lit) rgb.assign(pow(max(rgb, vec3(0)), vec3(1 / 2.2)));
      const fog = clamp(float(1).sub(exp(length(positionWorld.sub(cameraPosition)).mul(fogDensity).negate())), 0, 0.9);
      rgb.assign(mix(rgb, fogColor, fog));
      return vec4(rgb, output.a);
    })();
    this.materials.set(key, m);
    return m;
  }

  hex(s) {
    let c = this.colors.get(s);
    if (!c) {
      c = new Float32Array(3);
      if (typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)) {
        c[0] = parseInt(s.slice(1, 3), 16) / 255;
        c[1] = parseInt(s.slice(3, 5), 16) / 255;
        c[2] = parseInt(s.slice(5, 7), 16) / 255;
      } else c.fill(0.7);
      this.colors.set(s, c);
    }
    return c;
  }

  batchFor(m, pool) {
    let s = this.shapeIndex.get(m.shape);
    if (s === undefined) {
      s = this.shapeIndex.size;
      this.shapeIndex.set(m.shape, s);
    }
    const unlit = !!m.unlit;
    if (m.texture) {
      let list = pool.textured.get(m.texture);
      if (!list) pool.textured.set(m.texture, (list = []));
      const k = s * 2 + (unlit ? 1 : 0);
      let b = list[k];
      if (!b) {
        b = list[k] = new Batch(this, pool, m.shape, { transparent: true, unlit, cast: false, texture: m.texture });
        pool.list.push(b);
      }
      return b;
    }
    const transparent = m.alpha < 1;
    const cast = pool.shadows && !transparent && m.castShadow !== false;
    const k = s * 8 + (transparent ? 4 : 0) + (unlit ? 2 : 0) + (cast ? 1 : 0);
    let b = pool.flat[k];
    if (!b) {
      b = pool.flat[k] = new Batch(this, pool, m.shape, { transparent, unlit, cast, texture: null });
      pool.list.push(b);
    }
    return b;
  }

  parentMatrix(g) {
    let m = g[MAT];
    if (!m) m = g[MAT] = new Float32Array(16);
    if (g[STAMP] !== this.frame) {
      composeInto(m, 0, g.position, g.rotation, g.scale);
      g[STAMP] = this.frame;
    }
    return m;
  }

  /** Write every visible record into its batch. Returns how many view-model instances there are. */
  sync(scene) {
    this.frame++;
    for (const pool of this.pools) for (const b of pool.list) b.n = 0;
    let meshes = 0;
    const scratch = this.scratch;
    for (const m of scene.meshes) {
      if (!m.visible) continue;
      const parent = m.parent;
      if (parent && parent.visible === false) continue;
      const pool = m.viewmodel ? this.viewmodel : this.world;
      const b = this.batchFor(m, pool);
      const i = b.next();
      if (parent) {
        composeInto(scratch, 0, m.position, m.rotation, m.scale);
        multiplyInto(b.matrices, i * 16, this.parentMatrix(parent), scratch);
      } else composeInto(b.matrices, i * 16, m.position, m.rotation, m.scale);
      const c = this.hex(m.color),
        o = i * 4;
      b.colors[o] = c[0];
      b.colors[o + 1] = c[1];
      b.colors[o + 2] = c[2];
      b.colors[o + 3] = m.texture || m.alpha < 1 ? m.alpha : 1;
      if (!m.viewmodel) meshes++;
    }
    let draws = 0,
      triangles = 0,
      vmCount = 0;
    for (const pool of this.pools)
      for (const b of pool.list) {
        b.commit();
        if (!b.n) continue;
        draws++;
        triangles += b.triangles * b.n;
        if (pool === this.viewmodel) vmCount += b.n;
      }
    this.stats.draws = draws;
    this.stats.triangles = triangles;
    this.stats.meshes = meshes;
    this.environment(scene);
    return vmCount;
  }

  render(scene) {
    if (!scene || scene.disposed) return;
    const vm = this.sync(scene);
    this.drawFrame(vm > 0);
  }

  /** Build this scene's batches and compile their shaders before the first frame shows them. */
  async warm(scene) {
    if (!scene || scene.disposed) return;
    this.sync(scene);
    const compile = async () => {
      for (const [s, c] of [
        [this.world.scene, this.camera],
        [this.viewmodel.scene, this.vmCamera],
      ])
        await this.gl.compileAsync(s, c);
    };
    try {
      await Promise.race([compile(), new Promise((r) => setTimeout(r, 2500))]);
    } catch {
      /* compiling ahead is only an optimisation; the first frame compiles anything missed */
    }
  }

  environment(scene) {
    const env = scene.environment,
      sky = this.hex(env.sky);
    this.sky.setRGB(sky[0], sky[1], sky[2]);
    this.world.fogDensity.value = env.fog ?? 0;
    this.world.fogColor.value.setRGB(sky[0], sky[1], sky[2]);
    this.viewmodel.fogDensity.value = 0;

    // Key light: same direction and 140 m throw as the old depth pass, the target snapped to
    // whole shadow texels across the light's view so a moving target does not shimmer.
    const t = scene.lightTarget,
      r = scene.shadowRadius;
    if (r !== this.shadowRadius) {
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -r;
      cam.right = cam.top = r;
      cam.updateProjectionMatrix();
      this.shadowRadius = r;
    }
    const texel = (2 * r) / Math.max(256, this.sun.shadow.mapSize.x);
    const p = this.snapped.set(t[0], t[1], t[2]);
    const a = p.dot(this.lightRight),
      b = p.dot(this.lightUp);
    p.addScaledVector(this.lightRight, Math.round(a / texel) * texel - a).addScaledVector(this.lightUp, Math.round(b / texel) * texel - b);
    this.sun.target.position.copy(p);
    this.sun.position.set(p.x + SUN_OFFSET[0], p.y + SUN_OFFSET[1], p.z + SUN_OFFSET[2]);
    this.sun.target.updateMatrixWorld();
    const sun = env.sun ?? 1.25;
    this.sun.intensity = Math.PI * sun;
    this.vmSun.intensity = Math.PI * sun;

    const cam = scene.camera;
    this.camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    this.camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    if (this.camera.fov !== cam.fov) {
      this.camera.fov = cam.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  drawFrame(viewmodel) {
    const gl = this.gl,
      tier = this.kit.tier;
    // Medium tier has no MSAA: the kit's post chain adds FXAA. Low draws straight to the canvas.
    if (!tier.msaa && tier.name !== 'low') {
      this.post ??= createPost(this.kit, this.world.scene, this.camera, { bloom: false });
      this.post.render();
    } else gl.render(this.world.scene, this.camera);
    if (viewmodel) {
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(this.viewmodel.scene, this.vmCamera);
      gl.autoClear = true;
    }
  }

  dispose() {
    for (const s of [...this.scenes]) s.dispose();
    for (const pool of this.pools) for (const b of pool.list) b.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    this.post?.dispose();
  }
}
