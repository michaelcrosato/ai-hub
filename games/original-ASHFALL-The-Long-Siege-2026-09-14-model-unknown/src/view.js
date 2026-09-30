/* ASHFALL — the three.js side (r186 WebGPURenderer through the shared kit).
   Reproduces the original hand-written WebGL2 look: flat-shaded vertex colours lit by a
   hemisphere term plus a warm sun, soft sun shadows (22 % light left in shadow), an
   emissive blend for the glowing parts, distance fog around the camera focus, instanced
   walking units and an additive effects layer rebuilt every frame. */

import * as THREE from 'three/webgpu';
import { attribute, float, vec3, vec4, uniform, sin, cos, sign, select, smoothstep, length, positionLocal, positionGeometry, positionWorld, fog } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { height, clamp, ENEMY_TYPES } from './sim.js';
import { heroModel, enemyModel, particleModel, color as parseColor } from './art.js';

// The original drew raw vertex colours with no colour management and no tone mapping.
THREE.ColorManagement.enabled = false;

const FX_CAPACITY = 1 << 17;
const LIGHT_OFFSET = new THREE.Vector3(-650, 1000, 380);

/** A finished art Geometry → a static BufferGeometry with position, normal, colour and emissive weight. */
function toBuffer(g) {
  const geo = new THREE.BufferGeometry();
  const n = g.n;
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos.slice(0, n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(g.nor.slice(0, n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(g.col.slice(0, n * 3), 3));
  geo.setAttribute('em', new THREE.BufferAttribute(g.em.slice(0, n), 1));
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------ additive effects layer */

const DOME_N = 24, DOME_M = 8;
const DOME_CU = new Float32Array(DOME_N + 1), DOME_SU = new Float32Array(DOME_N + 1), DOME_CV = new Float32Array(DOME_M + 1), DOME_SV = new Float32Array(DOME_M + 1);
for (let u = 0; u <= DOME_N; u++) {
  DOME_CU[u] = Math.cos((u / DOME_N) * Math.PI * 2);
  DOME_SU[u] = Math.sin((u / DOME_N) * Math.PI * 2);
}
for (let v = 0; v <= DOME_M; v++) {
  DOME_CV[v] = Math.cos((v / DOME_M) * Math.PI * 0.5);
  DOME_SV[v] = Math.sin((v / DOME_M) * Math.PI * 0.5);
}

/** Triangles with a colour and alpha per vertex, drawn additively (SRC_ALPHA, ONE) without depth writes. */
class Fx {
  constructor(capacity) {
    this.cap = capacity;
    this.n = 0;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('fxColor', this.colAttr);
    this.geometry.setDrawRange(0, 0);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  }
  reset() {
    this.n = 0;
  }
  vert(x, y, z, c, a) {
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.col[i * 4] = c[0];
    this.col[i * 4 + 1] = c[1];
    this.col[i * 4 + 2] = c[2];
    this.col[i * 4 + 3] = a;
  }
  /** Four corners a, b, c, d as two triangles (a b c, a c d). */
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c, alpha) {
    if (this.n + 6 > this.cap) return;
    // The original drew into an 8-bit framebuffer, which clamps alpha; the HDR scene target does not.
    const a = alpha > 1 ? 1 : alpha < 0 ? 0 : alpha;
    if (a <= 0) return;
    this.vert(ax, ay, az, c, a);
    this.vert(bx, by, bz, c, a);
    this.vert(cx, cy, cz, c, a);
    this.vert(ax, ay, az, c, a);
    this.vert(cx, cy, cz, c, a);
    this.vert(dx, dy, dz, c, a);
  }
  ring(x, y, z, r, width, col, alpha = 1, start = 0, fraction = 1, segments = 48) {
    const c = parseColor(col);
    const steps = Math.max(1, Math.round(segments * fraction));
    const r0 = r - width / 2, r1 = r + width / 2;
    let ca = Math.cos(start), sa = Math.sin(start);
    for (let i = 0; i < steps; i++) {
      const b = start + ((i + 1) / steps) * Math.PI * 2 * fraction, cb = Math.cos(b), sb = Math.sin(b);
      this.quad(x + ca * r0, y, z + sa * r0, x + ca * r1, y, z + sa * r1, x + cb * r1, y, z + sb * r1, x + cb * r0, y, z + sb * r0, c, alpha);
      ca = cb;
      sa = sb;
    }
  }
  beam(ax, ay, az, bx, by, bz, width, col, alpha = 1) {
    const c = parseColor(col);
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    // side = normalize(d × (0.2, 1, 0.4)) · width / 2, as the original
    let sx = dy * 0.4 - dz, sy = dz * 0.2 - dx * 0.4, sz = dx - dy * 0.2;
    const l = Math.hypot(sx, sy, sz) || 1, k = width / 2 / l;
    sx *= k;
    sy *= k;
    sz *= k;
    this.quad(ax - sx, ay - sy, az - sz, ax + sx, ay + sy, az + sz, bx + sx, by + sy, bz + sz, bx - sx, by - sy, bz - sz, c, alpha);
  }
  dome(x, y, z, r, col, alpha, time = 0) {
    const c = parseColor(col);
    const px = (u, v) => x + DOME_CU[u] * DOME_CV[v] * r, py = (v) => y + DOME_SV[v] * r * 0.72, pz = (u, v) => z + DOME_SU[u] * DOME_CV[v] * r;
    for (let j = 0; j < DOME_M; j++) {
      for (let i = 0; i < DOME_N; i++) {
        const ax = px(i, j), ay = py(j), az = pz(i, j);
        const bx = px(i + 1, j), bz = pz(i + 1, j);
        const cx = px(i + 1, j + 1), cy = py(j + 1), cz = pz(i + 1, j + 1);
        const dx = px(i, j + 1), dz = pz(i, j + 1);
        this.quad(ax, ay, az, bx, ay, bz, cx, cy, cz, dx, cy, dz, c, alpha * (0.4 + Math.sin(j * 2 + i * 0.7 + time) * 0.15));
        if (i % 3 === 0) this.beam(ax, ay, az, dx, cy, dz, 0.16, col, alpha * 2.7);
        if (j === 2 || j === 5) this.beam(ax, ay, az, bx, ay, bz, 0.25, col, alpha * 2.7);
      }
    }
  }
  commit() {
    const n = this.n;
    this.geometry.setDrawRange(0, n);
    if (!n) return;
    for (const a of [this.posAttr, this.colAttr]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------------ the view */

export function createView(kit) {
  const renderer = kit.renderer;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.32, 0.4, 0.42);

  // Uniforms shared by every material.
  const uTime = uniform(0);
  const uFocus = uniform(new THREE.Vector3());
  const uFogColor = uniform(new THREE.Color(0.42, 0.49, 0.49));
  const uFogNear = uniform(240), uFogFar = uniform(940), uFogAmount = uniform(0.55);
  // The original fog: by ground distance from the camera focus, not from the eye.
  scene.fogNode = fog(uFogColor, smoothstep(uFogNear, uFogFar, length(positionWorld.xz.sub(uFocus.xz))).mul(uFogAmount));

  // Light in the original's units. three.js divides diffuse light by π, so intensities carry π.
  const hemi = new THREE.HemisphereLight();
  hemi.color.setRGB(0.61, 0.67, 0.68);
  hemi.groundColor.setRGB(0.27, 0.29, 0.29);
  hemi.intensity = Math.PI;
  hemi.position.set(0, 1, 0);
  const sun = new THREE.DirectionalLight();
  sun.color.setRGB(0.68, 0.59, 0.43);
  sun.intensity = Math.PI;
  sun.castShadow = true;
  sun.shadow.intensity = 0.78; // shadowed ground keeps 22 % of the sun, like the original
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.2;
  sun.shadow.radius = 1.5;
  kit.shadow(sun, 2048);
  scene.add(hemi, sun, sun.target);

  /* ---- materials */

  const em = attribute('em', 'float');
  const vcol = attribute('color', 'vec3');

  // Static world: vertex colour, lit, blending to colour × 1.35 by the emissive weight.
  const worldMat = new THREE.MeshLambertNodeMaterial();
  worldMat.colorNode = vec4(vcol.mul(float(1).sub(em)), 1);
  worldMat.emissiveNode = vcol.mul(em.mul(1.35));

  // Units: the same shading with a tint and hit flash per instance, and the original walk
  // cycle (legs below 2.8 m swing along the facing, the body above them bobs).
  const iAnim = attribute('iAnim', 'vec4'); // walk, phase, flash, yaw
  const iTint = attribute('iTint', 'vec4'); // r, g, b, scale
  const actorMat = new THREE.MeshLambertNodeMaterial();
  const raw = positionGeometry;
  const leg = raw.y.lessThan(2.8);
  const swing = sin(uTime.mul(13).add(iAnim.y).add(sign(raw.x).mul(1.57))).mul(0.5).mul(iAnim.x);
  const bob = sin(uTime.mul(26).add(iAnim.y)).mul(0.1).mul(iAnim.x);
  const along = select(leg, swing, float(0));
  const lift = select(leg, float(0), bob);
  actorMat.positionNode = positionLocal.add(vec3(sin(iAnim.w).mul(along), lift, cos(iAnim.w).mul(along)).mul(iTint.w));
  const tinted = vcol.mul(iTint.xyz);
  actorMat.colorNode = vec4(tinted.mul(float(1).sub(em)), 1);
  actorMat.emissiveNode = tinted.mul(em.mul(1.35)).add(vec3(iAnim.z.mul(0.32)));

  // Effects: unlit, additive, both sides, no fog (as the original).
  const fxMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  fxMat.colorNode = attribute('fxColor', 'vec4');

  /* ---- instanced units */

  class Actors {
    constructor(geo, cap, castShadow = true) {
      this.cap = cap;
      this.n = 0;
      this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iAnim', this.anim);
      geo.setAttribute('iTint', this.tint);
      this.mesh = new THREE.InstancedMesh(geo, actorMat, cap);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = castShadow;
      this.mesh.receiveShadow = true;
      this.mesh.count = 0;
      this.mesh.visible = false;
      scene.add(this.mesh);
    }
    begin() {
      this.n = 0;
    }
    push(x, y, z, yaw, r, g, b, scale, walk, phase, flash) {
      if (this.n >= this.cap) return;
      const i = this.n++, m = this.mesh.instanceMatrix.array, o = i * 16;
      const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
      m[o] = c; m[o + 1] = 0; m[o + 2] = -s; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = scale; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = s; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
      m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
      const a = this.anim.array, t = this.tint.array, k = i * 4;
      a[k] = walk; a[k + 1] = phase; a[k + 2] = flash; a[k + 3] = yaw;
      t[k] = r; t[k + 1] = g; t[k + 2] = b; t[k + 3] = scale;
    }
    end() {
      const n = this.n;
      this.mesh.count = n;
      this.mesh.visible = n > 0;
      if (!n) return;
      for (const attr of [this.mesh.instanceMatrix, this.anim, this.tint]) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, n * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
  }

  const heroes = [0, 1, 2].map((i) => new Actors(toBuffer(heroModel(i)), 1));
  const enemies = {};
  for (const type of ENEMY_TYPES) enemies[type] = new Actors(toBuffer(enemyModel(type)), type === 'turret' ? 8 : type === 'boss' ? 24 : 300);
  const particles = new Actors(toBuffer(particleModel()), 240, false);

  const fx = new Fx(FX_CAPACITY);
  const fxMesh = new THREE.Mesh(fx.geometry, fxMat);
  fxMesh.frustumCulled = false;
  fxMesh.renderOrder = 10;
  scene.add(fxMesh);

  /* ---- the static world */

  let worldMeshes = [];
  const coreGroup = new THREE.Group();
  scene.add(coreGroup);
  const staticMesh = (g, cast) => {
    const m = new THREE.Mesh(toBuffer(g), worldMat);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  };

  const api = {
    scene,
    heroes,
    enemies,
    particles,
    fx,
    worldId: null,
    /** Swap in another operation's battlefield (built by art.buildWorld) and its light. */
    setWorld(id, world, style) {
      for (const m of worldMeshes) {
        m.parent?.remove(m);
        m.geometry.dispose();
      }
      worldMeshes = [];
      const b = world.batches;
      // Terrain faces only cast from their back sides, which never face the sun: skip the pass.
      const add = (mesh, parent = scene) => {
        parent.add(mesh);
        worldMeshes.push(mesh);
      };
      add(staticMesh(b.terrain, false));
      add(staticMesh(b.stone, true));
      add(staticMesh(b.detail, true));
      add(staticMesh(b.metal, true));
      add(staticMesh(b.glow, false));
      add(staticMesh(world.core.metal, true), coreGroup);
      add(staticMesh(world.core.glow, false), coreGroup);
      api.setCoreCollapse(0);
      api.setStyle(style.light);
      api.worldId = id;
    },
    setStyle(L) {
      scene.background.setRGB(L.clear[0], L.clear[1], L.clear[2]);
      hemi.color.setRGB(L.sky[0], L.sky[1], L.sky[2]);
      hemi.groundColor.setRGB(L.groundLight[0], L.groundLight[1], L.groundLight[2]);
      sun.color.setRGB(L.sun[0], L.sun[1], L.sun[2]);
      uFogColor.value.setRGB(L.fog[0], L.fog[1], L.fog[2]);
      uFogNear.value = L.fogNear;
      uFogFar.value = L.fogFar;
      uFogAmount.value = L.fogAmount;
    },
    /** 0 = standing reactor, 1 = sunk into the fortress floor. */
    setCoreCollapse(t) {
      const k = t * t * (3 - 2 * t);
      coreGroup.position.y = -52 * k;
      coreGroup.rotation.z = 0.12 * k;
      coreGroup.rotation.x = -0.07 * k;
    },
  };

  /* ---- camera: the original orthographic view from 1100 m out, with its picking maths */

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2600);
  const cam = { focus: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1), zoom: 100, w: 1, h: 1 };
  const UP = new THREE.Vector3(0, 1, 0);
  // Sun basis for snapping the shadow focus to whole shadow-map texels (no shimmer while the camera glides).
  const lightZ = LIGHT_OFFSET.clone().normalize();
  const lightX = new THREE.Vector3().crossVectors(UP, lightZ).normalize();
  const lightY = new THREE.Vector3().crossVectors(lightZ, lightX);
  const snapped = new THREE.Vector3();
  let shadowExtent = 0;

  api.camera = camera;
  api.setCamera = (x, z, zoom, yaw, elevation) => {
    const w = kit.size.width, h = kit.size.height, aspect = w / h;
    cam.w = w;
    cam.h = h;
    cam.zoom = zoom;
    cam.focus.set(x, height(x, z), z);
    const ce = Math.cos(elevation);
    cam.dir.set(Math.sin(yaw) * ce, Math.sin(elevation), Math.cos(yaw) * ce);
    cam.right.crossVectors(UP, cam.dir).normalize();
    cam.up.crossVectors(cam.dir, cam.right);
    camera.left = -zoom * aspect;
    camera.right = zoom * aspect;
    camera.top = zoom;
    camera.bottom = -zoom;
    camera.updateProjectionMatrix();
    camera.position.copy(cam.focus).addScaledVector(cam.dir, 1100);
    camera.up.copy(UP);
    camera.lookAt(cam.focus);
    camera.updateMatrixWorld();
    uFocus.value.copy(cam.focus);

    // Sun shadow box: as the original, max(190, zoom × 1.8) around the focus (quantised so it
    // does not resize every frame of a zoom), centred on a texel-snapped focus.
    const extent = Math.max(190, Math.ceil((zoom * 1.8) / 24) * 24);
    if (extent !== shadowExtent) {
      shadowExtent = extent;
      const sc = sun.shadow.camera;
      sc.left = -extent;
      sc.right = extent;
      sc.top = extent;
      sc.bottom = -extent;
      sc.near = 1;
      sc.far = 2400;
      sc.updateProjectionMatrix();
    }
    const texel = (2 * extent) / (sun.shadow.mapSize.x || 2048);
    const fx0 = cam.focus.dot(lightX), fy0 = cam.focus.dot(lightY);
    snapped.copy(cam.focus).addScaledVector(lightX, Math.round(fx0 / texel) * texel - fx0).addScaledVector(lightY, Math.round(fy0 / texel) * texel - fy0);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).add(LIGHT_OFFSET);
    sun.target.updateMatrixWorld();
  };

  /** World point → CSS pixels on the canvas; out.visible as the original's test. */
  api.project = (x, y, z, out) => {
    const dx = x - cam.focus.x, dy = y - cam.focus.y, dz = z - cam.focus.z;
    const aspect = cam.w / cam.h;
    const nx = (dx * cam.right.x + dy * cam.right.y + dz * cam.right.z) / (cam.zoom * aspect);
    const ny = (dx * cam.up.x + dy * cam.up.y + dz * cam.up.z) / cam.zoom;
    const depth = 1100 - (dx * cam.dir.x + dy * cam.dir.y + dz * cam.dir.z);
    out.x = (nx * 0.5 + 0.5) * cam.w;
    out.y = (-0.5 * ny + 0.5) * cam.h;
    out.visible = depth >= 1 && depth <= 2600 && Math.abs(nx) < 1.15 && Math.abs(ny) < 1.15;
    return out;
  };

  /** CSS pixels → the ground point under them (the original's three-step refinement over the terrain). */
  api.ground = (sx, sy, out = { x: 0, z: 0 }) => {
    const aspect = cam.w / cam.h;
    const nx = (sx / cam.w * 2 - 1) * cam.zoom * aspect, ny = (1 - (sy / cam.h) * 2) * cam.zoom;
    const px = cam.focus.x + cam.right.x * nx + cam.up.x * ny;
    const py = cam.focus.y + cam.right.y * nx + cam.up.y * ny;
    const pz = cam.focus.z + cam.right.z * nx + cam.up.z * ny;
    const d = cam.dir;
    let t = (py - 2) / d.y, x = px - d.x * t, z = pz - d.z * t;
    for (let i = 0; i < 3; i++) {
      t = (py - height(x, z)) / d.y;
      x = px - d.x * t;
      z = pz - d.z * t;
    }
    out.x = clamp(x, -475, 475);
    out.z = clamp(z, -475, 475);
    return out;
  };

  /* ---- drawing */

  const post = createPost(kit, scene, camera);
  api.render = (t) => {
    uTime.value = t;
    fx.commit();
    fxMesh.visible = fx.n > 0;
    post.render();
  };
  // The animation loop resets these at the start of each frame, so they cover every pass of it.
  api.stats = () => renderer.info.render;

  /** Compile every pipeline up front (units, sparks and effects included) so the first fights do not stutter. */
  api.warm = async () => {
    const hidden = [];
    for (const a of [...heroes, ...Object.values(enemies), particles]) {
      if (!a.mesh.visible) {
        a.mesh.count = 1;
        a.mesh.visible = true;
        hidden.push(a.mesh);
      }
    }
    fx.reset();
    fx.ring(0, -500, 0, 1, 0.1, '#000000', 0.01, 0, 1, 3);
    fx.commit();
    fxMesh.visible = true;
    try {
      await renderer.compileAsync(scene, camera);
    } catch (err) {
      console.warn('[ashfall] precompile failed', err);
    }
    for (const m of hidden) {
      m.count = 0;
      m.visible = false;
    }
    fx.reset();
    fx.commit();
  };

  return api;
}
