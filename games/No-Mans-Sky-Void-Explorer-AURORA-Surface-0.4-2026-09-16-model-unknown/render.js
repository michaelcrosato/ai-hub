/* BOUNDLESS render layer on three.js r186 (WebGPURenderer, WebGL2 fallback).
   The game keeps its immediate-mode drawing API (begin / draw / points / lines / end):
   every draw call borrows a pooled THREE.Mesh for that geometry and material variant,
   so the scene graph only ever holds what this frame drew. World positions stay in
   JS doubles; everything reaches the GPU camera-relative (the camera sits at the origin).
   The shading is the original cel/terrain/atmosphere model, written in TSL. */
import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, Discard, uniform, attribute, varying, vec2, vec3, vec4, float, mix, smoothstep, pow, exp, sqrt, max, min,
  clamp, abs, dot, normalize, length, reflect, fract, floor, sin, select, positionWorld, positionGeometry, normalGeometry,
  modelNormalMatrix, positionWorldDirection, uv, instancedBufferAttribute, screenUV, renderGroup,
} from 'three/tsl';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { V, Q, smooth, heightAt, sphereGeometry, ringGeometry, terrainRenderGeometry } from './world.js';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1], WHITE = [1, 1, 1], DEFAULT_TINT = [0.06, 0.55, 0.85];
const TERRAIN_BUDGET = 160e6; // bytes of cached whole-planet terrain kept on the GPU

/* ---- Frame uniforms: set once per frame, shared by every object in the render. */
const F = {
  sun: uniform(new THREE.Vector4()).setGroup(renderGroup), // sun position (camera-relative), radius
  sunColor: uniform(new THREE.Vector4()).setGroup(renderGroup), // colour, w = 0 in the studio
  planet: uniform(new THREE.Vector4()).setGroup(renderGroup), // nearest planet (camera-relative), radius
  air: uniform(new THREE.Vector4()).setGroup(renderGroup), // air colour, air height
  patch: uniform(new THREE.Vector4()).setGroup(renderGroup), // local ground patch centre, radius
  time: uniform(0).setGroup(renderGroup),
};
/* ---- Object uniforms: read from each pooled mesh's userData when it renders. */
const objectUniform = (name) => uniform(new THREE.Vector4()).onObjectUpdate(({ object }) => object.userData.u[name]);
const O = {
  tint: objectUniform('tint'), // tint colour, emission
  albedo: objectUniform('albedo'), // colour multiplier, alpha
  mat: objectUniform('mat'), // patch cut-out flag, radius, seed, morph
  opt: objectUniform('opt'), // air (fog) flag, hatch opening, roughness, metallic
  sun: objectUniform('sun'), // this object's sun (camera-relative), radius
  sunColor: objectUniform('sunColor'),
};

/* ---- Shared shader math (same equations as the original GLSL/WGSL). */
const hashV = Fn(([p]) => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453))).setLayout({ name: 'hashV', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
const noiseV = Fn(([p]) => {
  const i = floor(p).toVar();
  const a = fract(p);
  const u = a.mul(a).mul(vec3(3).sub(a.mul(2))).toVar();
  const x0 = mix(hashV(i), hashV(i.add(vec3(1, 0, 0))), u.x);
  const x1 = mix(hashV(i.add(vec3(0, 1, 0))), hashV(i.add(vec3(1, 1, 0))), u.x);
  const x2 = mix(hashV(i.add(vec3(0, 0, 1))), hashV(i.add(vec3(1, 0, 1))), u.x);
  const x3 = mix(hashV(i.add(vec3(0, 1, 1))), hashV(i.add(vec3(1, 1, 1))), u.x);
  return mix(mix(x0, x1, u.y), mix(x2, x3, u.y), u.z);
}).setLayout({ name: 'noiseV', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
const cloudField = Fn(([n, seed, t]) => {
  const q = n.mul(7).add(vec3(seed.mul(0.031), t.mul(0.003), seed.mul(0.007))).toVar();
  const a = noiseV(q).mul(0.62).add(noiseV(q.mul(2.13)).mul(0.27)).add(noiseV(q.mul(4.1)).mul(0.11));
  return smoothstep(0.49, 0.67, a.add(sin(n.y.mul(15).add(n.x.mul(5))).mul(0.045)));
}).setLayout({ name: 'cloudField', type: 'float', inputs: [{ name: 'n', type: 'vec3' }, { name: 'seed', type: 'float' }, { name: 't', type: 'float' }] });
const sphereRay = Fn(([origin, dir, radius]) => {
  const b = dot(origin, dir);
  const h = b.mul(b).sub(dot(origin, origin)).add(radius.mul(radius));
  const s = sqrt(max(0, h));
  return select(h.lessThan(0), vec2(1e20, -1e20), vec2(b.negate().sub(s), b.negate().add(s)));
}).setLayout({ name: 'sphereRay', type: 'vec2', inputs: [{ name: 'origin', type: 'vec3' }, { name: 'dir', type: 'vec3' }, { name: 'radius', type: 'float' }] });
/** Single-scattering air along a view ray from the camera: rgb in-scatter, a transmittance. */
const airPath = Fn(([dir, limit]) => {
  const result = vec4(0, 0, 0, 1).toVar();
  const radius = F.planet.w;
  If(radius.greaterThanEqual(1), () => {
    const origin = F.planet.xyz.negate();
    const roots = sphereRay(origin, dir, radius.add(F.air.w));
    const begin = max(0, roots.x);
    const end = min(limit, roots.y);
    If(end.greaterThan(begin), () => {
      const stepSize = end.sub(begin).div(6);
      const scaleH = radius.mul(0.038);
      const sunDir = normalize(F.sun.xyz.sub(F.planet.xyz));
      const mu = dot(dir, sunDir);
      const phase = mu.mul(mu).mul(0.28).add(0.72);
      const mie = min(2.8, float(0.02).div(pow(max(0.018, float(1.028).sub(mu)), 1.5)));
      const optical = float(0).toVar();
      const radiance = vec3(0).toVar();
      Loop(6, ({ i }) => {
        const pos = origin.add(dir.mul(begin.add(float(i).add(0.5).mul(stepSize))));
        const height = max(0, length(pos).sub(radius));
        const density = exp(height.negate().div(scaleH));
        const day = dot(normalize(pos), sunDir);
        const lit = smoothstep(-0.16, 0.09, day);
        const sunset = exp(day.mul(day).mul(-65));
        const scatter = F.air.xyz.mul(0.65).add(vec3(0.015, 0.04, 0.11)).mul(phase).toVar();
        scatter.assign(mix(scatter, vec3(0.7, 0.18, 0.1).mul(F.sunColor.xyz), sunset.mul(0.35)));
        scatter.addAssign(F.sunColor.xyz.mul(mie).mul(0.5));
        scatter.mulAssign(lit.mul(0.95).add(0.008));
        const od = density.mul(stepSize).div(scaleH).mul(0.17);
        radiance.addAssign(scatter.mul(exp(optical.negate())).mul(float(1).sub(exp(od.negate()))));
        optical.addAssign(od);
      });
      result.assign(vec4(radiance, exp(optical.negate())));
    });
  });
  return result;
});
const applyAir = (color, pos) => { const air = airPath(normalize(pos), length(pos)); return color.mul(air.w).add(air.xyz); };
const skyColor = Fn(([dir]) => {
  const out = vec3(0).toVar();
  If(F.sunColor.w.lessThan(0.5), () => {
    out.assign(vec3(0.006, 0.01, 0.02).mul(dir.y.mul(0.12).add(1)));
  }).Else(() => {
    const bandArg = dir.y.mul(0.83).add(dir.x.mul(0.36)).add(0.02).mul(5);
    const band = exp(bandArg.mul(bandArg).negate());
    const wisps = noiseV(dir.mul(5.2).add(vec3(3, 8, 1))).mul(0.7).add(noiseV(dir.mul(13)).mul(0.3));
    const vein = pow(max(0, wisps.sub(0.23)), 2.6).mul(band).mul(2.8);
    const nebula = mix(vec3(0.23, 0.016, 0.4), vec3(0.01, 0.16, 0.28), smoothstep(-0.4, 0.8, dir.x));
    const color = vec3(0.0008, 0.001, 0.0035).add(nebula.mul(vein)).toVar();
    const sunDir = normalize(F.sun.xyz);
    const mu = dot(dir, sunDir);
    const angular = F.sun.w.div(max(1, length(F.sun.xyz)));
    const corona = exp(max(0, float(1).sub(mu)).negate().div(max(0.000015, angular.mul(angular).mul(9))));
    color.addAssign(F.sunColor.xyz.mul(corona).mul(0.1));
    const hit = sphereRay(F.planet.xyz.negate(), dir, F.planet.w);
    const limit = float(16000000).toVar();
    If(hit.x.greaterThan(0), () => { limit.assign(min(limit, hit.x)); });
    const air = airPath(dir, limit);
    out.assign(color.mul(air.w).add(air.xyz));
  });
  return vec4(out, 1);
});

/** Discard nearly invisible fragments, as the original did for every surface. */
const finish = (value) => { const r = vec4(value).toVar(); If(r.w.lessThan(0.005), () => { Discard(); }); return r; };

/**
 * Node graph for one surface kind. Kinds follow the original renderer:
 * 0 default, 1 planet terrain, 2 emissive glow, 3 rings, 4 atmosphere rim, 5 clouds,
 * 6 ship / modules, 7 canopy, 9 silhouette, 10 local ground patch.
 */
function surfaceNodes(kind, morph) {
  const aColor = attribute('color', 'vec3');
  const m = O.mat.w;
  let local = positionGeometry, normal = normalGeometry, color = aColor, elevation = float(0);
  if (morph) {
    const elev = attribute('elevation', 'vec2');
    local = mix(attribute('parentPosition', 'vec3'), positionGeometry, m);
    normal = normalize(mix(attribute('parentNormal', 'vec3'), normalGeometry, m));
    color = mix(attribute('parentColor', 'vec3'), aColor, m);
    elevation = mix(elev.y, elev.x, m);
  }
  const vLocal = varying(local, 'bxLocal');
  const vNormal = varying(modelNormalMatrix.mul(normal), 'bxNormal');
  const vColor = varying(color, 'bxColor');
  const vElevation = varying(elevation, 'bxElevation');

  const fragment = Fn(() => {
    if (kind === 9) return vec4(0.65, 0.78, 0.88, 1);
    const pos = positionWorld;
    const n = normalize(vNormal).toVar();
    const viewDir = normalize(pos.negate());
    const lightDir = normalize(O.sun.xyz.sub(pos));
    const tint = O.tint.xyz, emission = O.tint.w, alpha = O.albedo.w;
    const terrain = kind === 1 || kind === 10;
    if (terrain) {
      // The whole-planet mesh leaves a hole for the local physical ground patch; the patch fills it.
      const patchAxis = normalize(F.patch.xyz.sub(F.planet.xyz));
      const patchDelta = pos.sub(F.patch.xyz);
      const patchDistance = length(patchDelta.sub(patchAxis.mul(dot(patchDelta, patchAxis))));
      if (kind === 1) If(O.mat.x.greaterThan(0.5).and(F.patch.w.greaterThan(0)).and(patchDistance.lessThan(F.patch.w)), () => { Discard(); });
      else If(F.patch.w.lessThanEqual(0).or(patchDistance.greaterThanEqual(F.patch.w)), () => { Discard(); });
    }
    if (kind >= 6 && kind <= 8) {
      // The aft belly aperture opens with the two hatch leaves; the mechanism supplies the inner deck.
      If(O.opt.y.greaterThan(0.005).and(abs(vLocal.x).lessThan(0.625)).and(vLocal.z.greaterThan(0.18)).and(vLocal.z.lessThan(5.6)).and(vLocal.y.lessThan(-0.18)), () => { Discard(); });
    }
    const terrainLocal = kind === 10 ? pos.sub(F.planet.xyz) : vLocal;
    const base = vColor.mul(O.albedo.xyz).toVar();
    const localN = normalize(terrainLocal);
    const radius = max(1, O.mat.y);
    if (kind === 4) {
      const rim = pow(float(1).sub(abs(dot(localN, viewDir))), 4);
      const day = smoothstep(-0.3, 0.3, dot(localN, lightDir));
      return finish(vec4(tint.mul(day.mul(0.75).add(0.2)), rim.mul(alpha)));
    }
    if (kind === 5) {
      const coverage = cloudField(localN, O.mat.z, F.time);
      const day = smoothstep(-0.16, 0.65, dot(localN, lightDir));
      const horizon = float(1).sub(abs(dot(localN, viewDir)));
      const cloud = mix(vec3(0.017, 0.022, 0.047), vec3(0.82, 0.89, 1).mul(O.sunColor.xyz), day).add(tint.mul(horizon).mul(0.07));
      return finish(vec4(applyAir(cloud, pos), coverage.mul(alpha)));
    }
    if (kind === 2) return finish(vec4(base.mul(emission.mul(1.55).add(2.2)), alpha));

    let water = float(0), rough, metal;
    if (terrain) {
      const w = float(1).sub(smoothstep(0.00025, 0.0014, vElevation));
      const variation = noiseV(localN.mul(65).add(vec3(O.mat.z.mul(0.07))));
      base.mulAssign(variation.mul(0.24).add(0.88));
      if (kind === 10) {
        const grains = noiseV(terrainLocal.mul(380).add(vec3(O.mat.z.mul(0.17))));
        const fineGrain = noiseV(terrainLocal.mul(2100));
        base.mulAssign(grains.mul(0.24).add(0.84).add(fineGrain.mul(0.08)));
      }
      const shore = float(1).sub(w).mul(float(1).sub(smoothstep(0.001, 0.005, vElevation)));
      base.assign(mix(base, base.mul(0.62).add(vec3(0.32, 0.32, 0.24)), shore.mul(0.45)));
      base.assign(mix(base, vec3(0.71, 0.76, 0.82), smoothstep(0.045, 0.076, vElevation).mul(0.3)));
      const strata = sin(vElevation.mul(2100).add(variation.mul(0.65)));
      base.mulAssign(float(1).sub(float(1).sub(w).mul(smoothstep(0.6, 0.92, strata)).mul(0.12)));
      const closeWave = float(1).sub(smoothstep(radius.mul(0.06), radius.mul(0.7), length(pos)));
      const t = F.time;
      const waves = vec3(sin(vLocal.z.mul(0.07).add(t.mul(0.2))), sin(vLocal.x.mul(0.06).sub(t.mul(0.17))), sin(vLocal.y.mul(0.08).add(t.mul(0.13)))).mul(0.012).mul(closeWave);
      n.assign(normalize(mix(n, normalize(localN.add(waves)), w)));
      rough = mix(float(0.78), float(0.16), w);
      metal = float(0);
      water = w;
    } else if (kind >= 6) {
      metal = O.opt.w;
      rough = O.opt.z;
    } else {
      metal = float(0.25);
      rough = float(0.32);
    }
    if (kind === 7) {
      const edge = pow(float(1).sub(max(0, dot(n, viewDir))), 3);
      base.assign(mix(base, vec3(0.035, 0.28, 0.14), edge.mul(0.18)));
    }
    const diffuse = dot(n, lightDir);
    const cel = float(0.065).add(smoothstep(-0.08, 0.015, diffuse).mul(0.22)).add(smoothstep(0.19, 0.24, diffuse).mul(0.3)).add(smoothstep(0.57, 0.63, diffuse).mul(0.43));
    const linearBase = pow(max(base, vec3(0)), vec3(1.8));
    const c = linearBase.mul(vec3(0.085, 0.13, 0.24).add(O.sunColor.xyz.mul(cel).mul(1.85))).toVar();
    const halfDir = normalize(viewDir.add(lightDir));
    const nv = max(0, dot(n, viewDir));
    const nh = max(0, dot(n, halfDir));
    const spec = pow(nh, mix(float(12), float(200), float(1).sub(rough))).mul(max(0, diffuse));
    const fresnel = float(0.025).add(pow(float(1).sub(nv), 5).mul(0.975));
    c.addAssign(O.sunColor.xyz.mul(spec).mul(water.mul(3.2).add(metal.mul(0.6)).add(0.07)));
    if (terrain) {
      const reflected = reflect(viewDir.negate(), n);
      const skyAmount = float(0.018).add(max(0, dot(reflected, localN)).mul(0.028));
      c.addAssign(tint.mul(skyAmount).add(tint.mul(fresnel).mul(0.25)).mul(water).mul(smoothstep(-0.1, 0.18, diffuse).add(0.15)));
      const shadow = cloudField(normalize(localN.add(lightDir.mul(0.08))), O.mat.z, F.time);
      c.mulAssign(float(1).sub(shadow.mul(0.14).mul(smoothstep(-0.05, 0.2, diffuse))));
      c.addAssign(linearBase.mul(tint).mul(pow(float(1).sub(nv), 3)).mul(0.11));
    }
    if (kind === 0) {
      c.addAssign(linearBase.mul(emission).mul(0.28));
      c.addAssign(vec3(0.006, 0.14, 0.24).mul(smoothstep(1, 4.4, vLocal.z)).mul(0.4));
    }
    if (kind === 3) {
      const ringShadow = sphereRay(vLocal, lightDir, radius);
      If(ringShadow.x.greaterThan(0).and(ringShadow.x.lessThan(radius.mul(4))), () => { c.mulAssign(0.16); });
    }
    if (kind >= 6 && kind <= 8) c.assign(c.mul(0.59).add(linearBase.mul(0.038)));
    If(O.opt.x.greaterThan(0.5), () => { c.assign(applyAir(c, pos)); });
    return finish(vec4(c, alpha));
  })();
  return { positionNode: local, fragmentNode: fragment };
}

/** The original display transform: ACES fit with exposure, gamma 2.2, soft vignette. */
function display(color, exposure) {
  const x = color.xyz.mul(exposure).max(0);
  const film = clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1);
  const d = screenUV.mul(2).sub(1).mul(0.7);
  const vignette = float(1).sub(dot(d, d).mul(0.16));
  return vec4(pow(film, vec3(1 / 2.2)).mul(vignette), 1);
}

export class ThreeRenderer {
  constructor(kit, aurora) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.aurora = aurora;
    this.backend = kit.backendLabel;
    this.identity = IDENTITY;
    this.quality = 1;
    this.frameNumber = 0;
    this.drawCalls = 0;
    this.triangles = 0;
    this.lods = [];
    this.cache = new Map();
    this.cacheBytes = 0;
    this.rings = new Map();
    this.resources = new Set();
    this.materials = new Map();
    this.shown = [];
    this.drawn = [];
    this.pointPool = [];
    this.pointUsed = 0;
    this.linePool = [];
    this.lineUsed = 0;
    this.order = 0;
    this.env = null;
    this.cam = null;
    this.right = [1, 0, 0]; this.up = [0, 1, 0]; this.forward = [0, 0, -1];
    this.tan = Math.tan((65 * Math.PI) / 360);
    this.aspect = 1;

    // The display transform and gamma are applied in the post chain below.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.backgroundNode = skyColor(positionWorldDirection);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(65, 1, 1.5, 2e7));
    this.exposure = uniform(1.05);
    this.post = createPost(kit, this.scene, this.camera, {
      // The original bloomed only HDR light (stars, glow, the sun's corona), not lit terrain.
      bloom: { strength: 0.5, radius: 0.25, threshold: 1 },
      output: (c) => display(c, this.exposure),
    });
    this.shell = this.mesh(sphereGeometry({ radius: 1 }, 24, true));
  }

  /* ---- geometry */
  mesh(data, expanded = false) {
    const stride = expanded ? 20 : 9;
    const array = data instanceof Float32Array ? data : new Float32Array(data);
    const buf = new THREE.InterleavedBuffer(array, stride);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0));
    g.setAttribute('normal', new THREE.InterleavedBufferAttribute(buf, 3, 3));
    g.setAttribute('color', new THREE.InterleavedBufferAttribute(buf, 3, 6));
    if (expanded) {
      g.setAttribute('parentPosition', new THREE.InterleavedBufferAttribute(buf, 3, 9));
      g.setAttribute('parentNormal', new THREE.InterleavedBufferAttribute(buf, 3, 12));
      g.setAttribute('parentColor', new THREE.InterleavedBufferAttribute(buf, 3, 15));
      g.setAttribute('elevation', new THREE.InterleavedBufferAttribute(buf, 2, 18));
    }
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius *= 1.02;
    const handle = { geometry: g, morph: expanded, count: array.length / stride, bytes: array.byteLength, pools: new Map() };
    this.resources.add(handle);
    return handle;
  }
  freeMesh(handle) {
    if (!handle || !this.resources.has(handle)) return;
    for (const pool of handle.pools.values()) for (const obj of pool.items) { obj.visible = false; this.scene.remove(obj); }
    handle.pools.clear();
    handle.geometry.dispose();
    this.resources.delete(handle);
  }
  rotation(q) { return [...Q.rot([1, 0, 0], q), ...Q.rot([0, 1, 0], q), ...Q.rot([0, 0, 1], q)]; }
  resize(quality = 1) { this.quality = quality; }

  material(kind, blend, morph) {
    const key = `${kind}:${blend}:${morph ? 1 : 0}`;
    let m = this.materials.get(key);
    if (m) return m;
    m = new THREE.MeshBasicNodeMaterial();
    const nodes = surfaceNodes(kind, morph);
    m.positionNode = nodes.positionNode;
    m.fragmentNode = nodes.fragmentNode;
    // Hand-written renderers drew both faces of every triangle; the meshes rely on it.
    m.side = THREE.DoubleSide;
    m.forceSinglePass = true;
    m.fog = false;
    m.transparent = blend > 0;
    m.depthWrite = blend === 0;
    m.blending = blend === 2 ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.name = `boundless-${key}`;
    this.materials.set(key, m);
    return m;
  }

  show(obj) {
    obj.visible = true;
    if (obj.userData.frame !== this.frameNumber) { obj.userData.frame = this.frameNumber; this.drawn.push(obj); }
  }
  acquire(handle, kind, blend) {
    const key = kind * 4 + blend;
    let pool = handle.pools.get(key);
    if (!pool) { pool = { items: [], used: 0, frame: -1 }; handle.pools.set(key, pool); }
    if (pool.frame !== this.frameNumber) { pool.frame = this.frameNumber; pool.used = 0; }
    let obj = pool.items[pool.used];
    if (!obj) {
      obj = new THREE.Mesh(handle.geometry, this.material(kind, blend, handle.morph));
      obj.matrixAutoUpdate = false;
      obj.userData.u = { tint: new THREE.Vector4(), albedo: new THREE.Vector4(), mat: new THREE.Vector4(), opt: new THREE.Vector4(), sun: new THREE.Vector4(), sunColor: new THREE.Vector4() };
      obj.visible = false;
      this.scene.add(obj);
      pool.items.push(obj);
    }
    pool.used++;
    this.show(obj);
    return obj;
  }

  /* ---- frame */
  begin(camera, fov, air, radial, env) {
    this.frameNumber++;
    this.drawCalls = 0; this.triangles = 0; this.lods = []; this.order = 0;
    this.pointUsed = 0; this.lineUsed = 0;
    this.cam = camera; this.env = env; this.airAmount = air;
    const q = camera.q;
    this.right = Q.rot([1, 0, 0], q); this.up = Q.rot([0, 1, 0], q); this.forward = Q.rot([0, 0, -1], q);
    this.tan = Math.tan((fov * Math.PI) / 360);
    this.aspect = this.kit.size.width / Math.max(1, this.kit.size.height);
    const cam = this.camera, near = env.near || 1.5, far = env.far || 2e7;
    if (cam.fov !== fov || cam.near !== near || cam.far !== far) { cam.fov = fov; cam.near = near; cam.far = far; cam.updateProjectionMatrix(); }
    cam.position.set(0, 0, 0);
    cam.quaternion.set(q[0], q[1], q[2], q[3]);
    cam.updateMatrixWorld(true);
    const cp = camera.pos, p = env.planet, sun = env.sun;
    F.sun.value.set(sun.pos[0] - cp[0], sun.pos[1] - cp[1], sun.pos[2] - cp[2], sun.radius);
    F.sunColor.value.set(sun.color[0], sun.color[1], sun.color[2], env.studio ? 0 : 1);
    if (p) F.planet.value.set(p.pos[0] - cp[0], p.pos[1] - cp[1], p.pos[2] - cp[2], p.radius);
    else F.planet.value.set(0, 0, 0, 0);
    const airColor = p?.palette.air || [0.08, 0.5, 0.9];
    F.air.value.set(airColor[0], airColor[1], airColor[2], (p?.radius || 1) * 0.2);
    const patch = env.patch;
    if (patch) F.patch.value.set(patch.center[0] - cp[0], patch.center[1] - cp[1], patch.center[2] - cp[2], patch.radius);
    else F.patch.value.set(0, 0, 0, 0);
    F.time.value = env.time;
    this.exposure.value = env.exposure * (1 - air * 0.1);
  }

  draw(handle, world, opts = {}) {
    const kind = opts.kind ?? (opts.atmosphere ? 4 : opts.emission >= 0.8 ? 2 : 0);
    const alpha = opts.alpha ?? 1;
    const blend = opts.additive ? 2 : alpha < 1 ? 1 : 0;
    const obj = this.acquire(handle, kind, blend);
    const rot = opts.rotation || IDENTITY, s = opts.scale ?? 1, cp = this.cam.pos, e = obj.matrix.elements;
    e[0] = rot[0] * s; e[1] = rot[1] * s; e[2] = rot[2] * s; e[3] = 0;
    e[4] = rot[3] * s; e[5] = rot[4] * s; e[6] = rot[5] * s; e[7] = 0;
    e[8] = rot[6] * s; e[9] = rot[7] * s; e[10] = rot[8] * s; e[11] = 0;
    e[12] = world[0] - cp[0]; e[13] = world[1] - cp[1]; e[14] = world[2] - cp[2]; e[15] = 1;
    obj.matrixWorldNeedsUpdate = true;
    const u = obj.userData.u, p = opts.planet, sun = opts.sun || this.env.sun;
    const tint = opts.tint || p?.palette.air || DEFAULT_TINT, col = opts.color || WHITE;
    u.tint.set(tint[0], tint[1], tint[2], opts.emission || 0);
    u.albedo.set(col[0], col[1], col[2], alpha);
    const cut = kind === 1 && p && this.env.patch && this.env.planet?.id === p.id ? 1 : 0;
    u.mat.set(cut, p?.radius || s, (p?.seed || 0) % 8192, opts.morph ?? 1);
    u.opt.set(opts.fog === false ? 0 : 1, opts.hatch || 0, opts.roughness ?? 0.4, opts.metallic ?? 0.25);
    u.sun.set(sun.pos[0] - cp[0], sun.pos[1] - cp[1], sun.pos[2] - cp[2], sun.radius);
    u.sunColor.set(sun.color[0], sun.color[1], sun.color[2], 1);
    // Transparent passes keep the original call order; opaque ones sort by depth.
    obj.renderOrder = blend ? ++this.order : 0;
    this.drawCalls++;
    this.triangles += handle.count / 3;
  }

  makePointBatch(capacity) {
    const pts = createPoints({
      positions: new Float32Array(capacity * 3), colors: new Float32Array(capacity * 3), sizes: new Float32Array(capacity),
      size: 1, sizeAttenuation: false,
      material: { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false },
    });
    const opacity = uniform(1);
    const center = pts.material.positionNode; // the kit's per-point centre (camera-relative)
    const d = uv().mul(2).sub(1).length();
    const falloff = exp(d.mul(d).mul(-4)).mul(float(1).sub(smoothstep(0.72, 1, d)));
    const trans = airPath(normalize(center), length(center)).w;
    pts.material.colorNode = vec4(instancedBufferAttribute(pts.colors).mul(exp(d.mul(d).mul(-20)).mul(3).add(1.1)), 1);
    pts.material.opacityNode = falloff.mul(opacity).mul(trans);
    pts.object.visible = false;
    this.scene.add(pts.object);
    return { pts, opacity, capacity };
  }
  /** Soft glowing sprites: data is x,y,z (camera-relative), r,g,b, size in CSS pixels, per point. */
  points(data, opacity = 1) {
    const n = (data.length / 7) | 0;
    if (!n) return;
    let b = this.pointPool[this.pointUsed];
    if (!b || b.capacity < n) {
      if (b) { this.scene.remove(b.pts.object); b.pts.material.dispose(); }
      b = this.pointPool[this.pointUsed] = this.makePointBatch(Math.max(64, 2 ** Math.ceil(Math.log2(n))));
    }
    this.pointUsed++;
    const P = b.pts.positions.array, C = b.pts.colors.array, S = b.pts.sizes.array;
    for (let i = 0, j = 0; i < n; i++, j += 7) {
      P[i * 3] = data[j]; P[i * 3 + 1] = data[j + 1]; P[i * 3 + 2] = data[j + 2];
      C[i * 3] = data[j + 3]; C[i * 3 + 1] = data[j + 4]; C[i * 3 + 2] = data[j + 5];
      S[i] = data[j + 6];
    }
    for (const attr of [b.pts.positions, b.pts.colors, b.pts.sizes]) attr.needsUpdate = true;
    b.pts.setCount(n);
    b.opacity.value = opacity;
    b.pts.object.renderOrder = ++this.order;
    this.show(b.pts.object);
    this.drawCalls++;
  }

  makeLineBatch(capacity) {
    const pos = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3), col = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3);
    pos.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    g.setAttribute('color', col);
    const opacity = uniform(1);
    const m = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.colorNode = vec4(attribute('color', 'vec3').mul(1.1), 1);
    m.opacityNode = opacity;
    const obj = new THREE.LineSegments(g, m);
    obj.frustumCulled = false;
    obj.visible = false;
    this.scene.add(obj);
    return { obj, pos, col, opacity, capacity };
  }
  /** One-pixel additive segments: data is two vertices of x,y,z (camera-relative), r,g,b per segment. */
  lines(data, opacity = 1) {
    const n = (data.length / 12) | 0;
    if (!n) return;
    let b = this.linePool[this.lineUsed];
    if (!b || b.capacity < n) {
      if (b) { this.scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
      b = this.linePool[this.lineUsed] = this.makeLineBatch(Math.max(256, 2 ** Math.ceil(Math.log2(n))));
    }
    this.lineUsed++;
    const P = b.pos.array, C = b.col.array;
    for (let v = 0, j = 0; v < n * 2; v++, j += 6) {
      P[v * 3] = data[j]; P[v * 3 + 1] = data[j + 1]; P[v * 3 + 2] = data[j + 2];
      C[v * 3] = data[j + 3]; C[v * 3 + 1] = data[j + 4]; C[v * 3 + 2] = data[j + 5];
    }
    b.pos.needsUpdate = true; b.col.needsUpdate = true;
    b.obj.geometry.setDrawRange(0, n * 2);
    b.opacity.value = opacity;
    b.obj.renderOrder = ++this.order;
    this.show(b.obj);
    this.drawCalls++;
  }

  getTerrain(p, detail) {
    const key = p.id + ':' + detail;
    let m = this.cache.get(key);
    if (!m) {
      m = this.mesh(terrainRenderGeometry(p, detail), true);
      this.cache.set(key, m);
      this.cacheBytes += m.bytes;
      // Evict the least recently used terrain until the count and memory budget fit.
      while (this.cache.size > 18 || (this.cacheBytes > TERRAIN_BUDGET && this.cache.size > 1)) {
        const k = this.cache.keys().next().value;
        const old = this.cache.get(k);
        this.cache.delete(k);
        this.cacheBytes -= old.bytes;
        this.freeMesh(old);
      }
    } else {
      this.cache.delete(key);
      this.cache.set(key, m);
    }
    return m;
  }
  planet(p, ignored, sun) {
    const n = V.norm(V.sub(this.cam.pos, p.pos)), h = (V.dist(this.cam.pos, p.pos) - p.radius - heightAt(n, p)) / p.radius;
    let detail = 16, morph = 1;
    if (h < 3.2) { detail = 32; morph = 1 - smooth(1.6, 3.2, h); }
    if (h < 0.6) { detail = 64; morph = 1 - smooth(0.18, 0.6, h); }
    if (this.quality >= 1 && h < 0.16) { detail = 128; morph = 1 - smooth(0.04, 0.16, h); }
    this.lods.push({ id: p.id, detail, morph, altitude: h * p.radius });
    const m = this.getTerrain(p, detail);
    this.draw(m, p.pos, { kind: 1, planet: p, morph, sun });
    if (p.rings) {
      let rm = this.rings.get(p.id);
      if (!rm) {
        rm = this.mesh(ringGeometry(p.radius, p.seed));
        this.rings.set(p.id, rm);
        while (this.rings.size > 8) { const k = this.rings.keys().next().value; this.freeMesh(this.rings.get(k)); this.rings.delete(k); }
      }
      this.draw(rm, p.pos, { kind: 3, planet: p, alpha: 0.88, sun });
    }
    // The nearest planet uses the same integrated air path in sky and terrain shaders.
    if (this.env.planet?.id !== p.id) this.draw(this.shell, p.pos, { scale: p.radius * 1.1, kind: 4, planet: p, alpha: 0.6, additive: true, sun });
    this.draw(this.shell, p.pos, { scale: p.radius * 1.086, kind: 5, planet: p, alpha: 0.74, sun });
  }

  end() {
    for (const obj of this.shown) if (obj.userData.frame !== this.frameNumber) obj.visible = false;
    const done = this.shown;
    this.shown = this.drawn;
    this.drawn = done;
    this.drawn.length = 0;
    const bloom = this.post.bloom;
    if (bloom) bloom.strength.value = (this.env.bloom || 0) * 0.75;
    this.post.render();
  }

  /** Compile every material variant once, behind the loading card, so the first landing does not stutter. */
  prewarm(aurora) {
    const morphMesh = this.mesh(new Float32Array([0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0]), true);
    const sun = { pos: [0, 1000, -1000], radius: 10, color: [1, 1, 1] };
    const planet = { id: 'prewarm', pos: [0, 0, -12], radius: 2, seed: 1, palette: { air: [0.1, 0.5, 0.9] } };
    this.begin({ pos: [0, 0, 0], q: [0, 0, 0, 1] }, 60, 0, [0, 1, 0], { planet, sun, time: 0, exposure: 1, bloom: 0.5, patch: { center: [0, 0, -12], radius: 1 } });
    const at = [0, 0, -12];
    this.draw(morphMesh, at, { kind: 1, planet, sun });
    this.draw(morphMesh, at, { kind: 10, planet, sun });
    this.draw(this.shell, at, { kind: 3, planet, alpha: 0.88 });
    this.draw(this.shell, at, { kind: 4, planet, alpha: 0.6, additive: true });
    this.draw(this.shell, at, { kind: 5, planet, alpha: 0.74 });
    this.draw(this.shell, at, { kind: 2, emission: 1.7, fog: false });
    this.draw(this.shell, at, { kind: 2, emission: 0, alpha: 0.14, fog: false });
    this.draw(this.shell, at, { kind: 2, emission: 1.5, alpha: 0.65, additive: true, fog: false });
    this.draw(this.shell, at, { kind: 6, fog: false });
    this.draw(this.shell, at, { kind: 6, fog: true });
    this.draw(this.shell, at, { kind: 7, fog: false });
    this.draw(this.shell, at, { kind: 9, fog: false });
    this.points([0, 0, -12, 1, 1, 1, 4], 1);
    this.lines([0, 0, -12, 1, 1, 1, 1, 0, -12, 1, 1, 1], 1);
    this.end();
    this.freeMesh(morphMesh);
  }

  project(world) {
    const d = V.sub(world, this.cam.pos), z = V.dot(d, this.forward);
    return { x: (0.5 + (V.dot(d, this.right) / (Math.abs(z) * this.tan * this.aspect)) * 0.5) * innerWidth, y: (0.5 - (V.dot(d, this.up) / (Math.abs(z) * this.tan)) * 0.5) * innerHeight, front: z > 0, z };
  }
  /** A PNG of the frame just rendered (call in the same task as the render). */
  capture() { return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, 'image/png')); }
  diagnostics() {
    const info = this.renderer.info?.render || {};
    return { asset: this.aurora.report, backend: this.backend, three: THREE.REVISION, drawCalls: info.calls ?? this.drawCalls, triangles: info.triangles ?? this.triangles, submitted: this.drawCalls, terrainMeshes: this.cache.size, terrainMegabytes: +(this.cacheBytes / 1e6).toFixed(1), frames: this.frameNumber, bloom: this.env?.bloom || 0, exposure: this.exposure.value, resolution: [this.renderer.domElement.width, this.renderer.domElement.height], lod: this.lods, tier: this.kit.tier.name };
  }
}
