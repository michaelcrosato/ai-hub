/* Sham-mue — the three.js layer.
   The WebGL edition drew everything with one hand-written shader that switched on a per-vertex
   surface flag. Here each flag is a node material that reproduces that branch:
     0 lit (Lambert, with the quay's ground variation and wall-foot occlusion)
     1 lamp / sign glow (unlit, dimming slightly with the evening ambient)
     2 animated sea reflecting the sky texture
     3 unlit
     4 glossy (Phong: leather, glass, the forklift's paint)
     5 soft decals (contact shade, grime), transparent, no shadows
     6 alpha-cut leaves
   Lighting, fog and sky use the old maths: the same sun direction, time-of-day colours,
   fog curve and sky projection. Shadows are three.js shadow maps that follow the view. */

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, texture, vec2, vec3, float, sin, cos, mix, smoothstep, clamp, pow, exp, abs, max, dot,
  normalize, reflect, atan, asin, select, positionWorld, positionView, cameraPosition, materialColor, fog
} from 'three/tsl';
import { MeshBuilder } from './mesh.js';
import { TILES } from './art.js';

/** Scene-wide values the materials read. Colours hold the old shader's raw numbers. */
export const U = {
  time: uniform(0), evening: uniform(0), rain: uniform(0),
  fog: uniform(new THREE.Color(.62, .70, .76)),       // sRGB, as the old sky shader used it
  sun: uniform(new THREE.Color(.98, .90, .74)),
  ambient: uniform(new THREE.Color(.43, .49, .57))
};
export const LIGHT_DIR = new THREE.Vector3(-.531, .792, .301).normalize();

/* ------------------------------------------------------------------ colour helpers */

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);
/** The old shader linearised colours with a 2.2 power; vertex colours do the same here. */
export const linear = c => LIN[Math.max(0, Math.min(255, Math.round(c * 255)))];

/* ------------------------------------------------------------------ textures */

const textures = [];
let skyTexture = null;
function tileCanvas(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'); ctx.scale(2, 2); draw(ctx); return c;
}
function prepare(tex, aniso) {
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = aniso; tex.needsUpdate = true;
  return tex;
}
/** Loads the JPEG maps (in parallel) and paints the procedural tiles. */
export async function loadTextures(onProgress, aniso = 4) {
  const base = new URL('./textures/', import.meta.url);
  const loader = new THREE.TextureLoader();
  const files = TILES.filter(t => t.file).length + 1;
  let done = 0;
  const tick = () => onProgress?.(++done / files);
  const jobs = [];
  TILES.forEach((t, i) => {
    if (t.file) jobs.push(loader.loadAsync(new URL(t.name + '.jpg', base).href).then(tex => { textures[i] = prepare(tex, aniso); tick(); }));
    else if (t.draw) textures[i] = prepare(new THREE.CanvasTexture(tileCanvas(t.draw)), aniso);
    else textures[i] = null;
  });
  jobs.push(loader.loadAsync(new URL('sky.jpg', base).href).then(tex => {
    // The sky is sampled with its own projection and left in sRGB like the original.
    tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    skyTexture = tex; tick();
  }));
  await Promise.all(jobs);
}

/* ------------------------------------------------------------------ shared shading nodes */

const onGround = positionWorld.y.lessThan(.15);
// Low-frequency colour variation across the quay surface (old shader: albedo *= 1 + macro * .085).
const groundMacro = select(onGround, sin(positionWorld.x.mul(.23).add(positionWorld.z.mul(.37))).mul(sin(positionWorld.x.mul(.68).sub(positionWorld.z.mul(.19)))).mul(.085).add(1), float(1));
// Darkening where the quay meets the warehouse wall line at x = 16.
const groundAO = select(onGround, float(1).sub(exp(abs(positionWorld.x.sub(16)).mul(-1.8)).mul(.32)), float(1));
const glowLevel = U.ambient.mul(.15).add(.83);

let skyColour = null, waterMat = null;

/** Sky dome, sea material and fog; call after loadTextures(). Returns the dome (keep it on the camera). */
export function createAtmosphere(scene) {
  skyColour = Fn(([ray]) => {
    const u = atan(ray.z, ray.x).div(Math.PI * 2).add(.5);
    const v = float(1).sub(asin(clamp(ray.y, 0, 1)).div(Math.PI / 2));
    const s = texture(skyTexture, vec2(u, v)).rgb;
    return mix(s, s.mul(vec3(1.13, .81, .71)), U.evening.mul(.62).mul(float(1).sub(ray.y)));
  });

  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  skyMat.colorNode = Fn(() => {
    const ray = normalize(positionWorld.sub(cameraPosition));
    const c = vec3(skyColour(ray)).toVar();
    c.assign(mix(c, U.fog, float(1).sub(smoothstep(-.04, .15, ray.y))));
    c.assign(mix(c, vec3(dot(c, vec3(.3, .5, .2)).mul(.82)), U.rain.mul(.5)));
    return pow(c, vec3(2.2));
  })();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; sky.matrixWorldAutoUpdate = true;
  scene.add(sky);

  const L = vec3(LIGHT_DIR.x, LIGHT_DIR.y, LIGHT_DIR.z);
  waterMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  waterMat.colorNode = Fn(() => {
    const p = positionWorld, t = U.time;
    const wx = sin(p.x.mul(.72).add(p.z.mul(2.5)).add(t.mul(.95))).add(sin(p.x.mul(2.9).sub(p.z.mul(.6)).sub(t.mul(1.1))).mul(.45));
    const wy = cos(p.z.mul(1.3).add(p.x.mul(.85)).add(t.mul(.83))).add(sin(p.x.mul(6).add(p.z.mul(2)).sub(t.mul(1.5))).mul(.2));
    const wn = normalize(vec3(wx.mul(.075), 1, wy.mul(.11)));
    const V = normalize(cameraPosition.sub(p));
    const ref = reflect(V.negate(), wn);
    const fres = pow(float(1).sub(max(dot(V, wn), 0)), 4).mul(.8).add(.12);
    const reflected = pow(vec3(skyColour(ref)), vec3(2.2));
    const spec = pow(max(dot(reflect(L.negate(), wn), V), 0), 110);
    const ripple = sin(p.z.mul(8.7).add(t.mul(1.4))).mul(sin(p.x.mul(3.4).sub(t.mul(.7))));
    return mix(vec3(.027, .079, .10), reflected, fres).add(U.sun.mul(spec).mul(.8)).add(vec3(.008, .014, .017).mul(ripple));
  })();

  // The old fog: 1 - exp(-(d * density) ^ 1.65), thicker in rain, never fully opaque.
  const fogFactor = Fn(() => float(1).sub(exp(pow(positionView.length().mul(U.rain.mul(.002).add(.0028)), 1.65).negate())).min(.97))();
  scene.fogNode = fog(pow(vec3(U.fog), vec3(2.2)), fogFactor);
  return sky;
}

/* ------------------------------------------------------------------ materials */

const matCache = new Map();
/** One shared material per (texture, surface flag). */
export function materialFor(tx, fx) {
  const key = tx * 8 + fx;
  let m = matCache.get(key);
  if (m) return m;
  const base = { vertexColors: true, side: THREE.DoubleSide };
  const map = textures[tx] || null;
  if (map) base.map = map;
  switch (fx) {
    case 1: m = new THREE.MeshBasicNodeMaterial(base); m.colorNode = materialColor.rgb.mul(glowLevel).mul(groundMacro); break;
    case 2: m = waterMat; break;
    case 3: m = new THREE.MeshBasicNodeMaterial(base); break;
    case 4: m = new THREE.MeshPhongNodeMaterial({ ...base, shininess: 30, specular: new THREE.Color(.05, .05, .05) }); break;
    case 5: m = new THREE.MeshBasicNodeMaterial({ ...base, transparent: true, depthWrite: false, alphaTest: .025, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); break;
    case 6: m = new THREE.MeshLambertNodeMaterial({ ...base, alphaTest: .45 }); break;
    default: m = new THREE.MeshLambertNodeMaterial(base); m.colorNode = materialColor.rgb.mul(groundMacro); m.aoNode = groundAO;
  }
  matCache.set(key, m);
  return m;
}
const casts = fx => fx === 0 || fx === 1 || fx === 3 || fx === 4;
const receives = fx => fx === 0 || fx === 4;

/* ------------------------------------------------------------------ builder arrays → geometry */

const ORDER = [0, 1, 2], ORDER_FLIP = [0, 2, 1];
/** Sorts triangles by material. The old renderer drew both faces of everything and its smooth
    parts were wound inward; each triangle is turned to face along its own normals here, so
    three.js lights and culls it correctly. */
function bucketize(a) {
  const buckets = new Map();
  for (let i = 0; i + 38 < a.length; i += 39) {
    const key = a[i + 11] * 8 + a[i + 12];
    let list = buckets.get(key);
    if (!list) { list = []; buckets.set(key, list); }
    const e1x = a[i + 13] - a[i], e1y = a[i + 14] - a[i + 1], e1z = a[i + 15] - a[i + 2];
    const e2x = a[i + 26] - a[i], e2y = a[i + 27] - a[i + 1], e2z = a[i + 28] - a[i + 2];
    const gx = e1y * e2z - e1z * e2y, gy = e1z * e2x - e1x * e2z, gz = e1x * e2y - e1y * e2x;
    const flip = gx * (a[i + 3] + a[i + 16] + a[i + 29]) + gy * (a[i + 4] + a[i + 17] + a[i + 30]) + gz * (a[i + 5] + a[i + 18] + a[i + 31]) < 0;
    list.push(i, flip ? 1 : 0);
  }
  return buckets;
}
function fill(a, tris, out, v) {
  const { pos, nor, uvs, col } = out;
  for (let k = 0; k < tris.length; k += 2) {
    const i = tris[k], order = tris[k + 1] ? ORDER_FLIP : ORDER;
    for (let o = 0; o < 3; o++) {
      const j = i + order[o] * 13;
      pos[v * 3] = a[j]; pos[v * 3 + 1] = a[j + 1]; pos[v * 3 + 2] = a[j + 2];
      nor[v * 3] = a[j + 3]; nor[v * 3 + 1] = a[j + 4]; nor[v * 3 + 2] = a[j + 5];
      uvs[v * 2] = a[j + 6]; uvs[v * 2 + 1] = a[j + 7];
      col[v * 3] = linear(a[j + 8]); col[v * 3 + 1] = linear(a[j + 9]); col[v * 3 + 2] = linear(a[j + 10]);
      v++;
    }
  }
  return v;
}
function arrays(n) { return { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), uvs: new Float32Array(n * 2), col: new Float32Array(n * 3) }; }
function geometry(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(out.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(out.col, 3));
  return g;
}
/** One geometry with a group per material. */
export function geometryFrom(a) {
  const buckets = bucketize(a);
  const keys = [...buckets.keys()].sort((x, y) => x - y);
  let total = 0;
  for (const k of keys) total += buckets.get(k).length / 2 * 3;
  const out = arrays(total), materials = [];
  const groups = [];
  let v = 0;
  keys.forEach((k, mi) => { const start = v; v = fill(a, buckets.get(k), out, v); groups.push([start, v - start, mi]); materials.push(materialFor(Math.floor(k / 8), k % 8)); });
  const g = geometry(out);
  for (const [s, c, mi] of groups) g.addGroup(s, c, mi);
  g.computeBoundingSphere();
  return { geometry: g, materials };
}
/** The static harbour: one merged mesh per material, shadows set per surface type. */
export function staticMeshes(a) {
  const group = new THREE.Group();
  for (const [k, tris] of bucketize(a)) {
    const out = arrays(tris.length / 2 * 3);
    fill(a, tris, out, 0);
    const fx = k % 8, mesh = new THREE.Mesh(geometry(out), materialFor(Math.floor(k / 8), fx));
    mesh.castShadow = casts(fx); mesh.receiveShadow = receives(fx);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  group.matrixAutoUpdate = false;
  group.updateMatrixWorld(true);
  return group;
}

const partCache = new Map();
/** A model built once with the builder and shared by every mesh that uses it. */
export function part(key, build) {
  let d = partCache.get(key);
  if (!d) { const b = new MeshBuilder(); build(b); d = geometryFrom(b.a); partCache.set(key, d); }
  return d;
}
export function partMesh(key, build, cast = true) {
  const d = part(key, build);
  const m = new THREE.Mesh(d.geometry, d.materials);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ lights and time of day */

const LX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), LIGHT_DIR).normalize();
const LY = new THREE.Vector3().crossVectors(LIGHT_DIR, LX);
const SHADOW_HALF = 30;
const _c = new THREE.Vector3();

export function createLights(scene, kit) {
  // Legacy-light values ×π: the old shader lit with albedo × colour, three.js divides Lambert by π.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 190 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  scene.add(hemi, sun, sun.target);
  return { hemi, sun };
}

const mixf = (a, b, t) => a + (b - a) * t, sat = v => Math.max(0, Math.min(1, v));
/** The old shader's time-of-day colours, plus a shadow map centred on (cx, cz) and snapped to its texels. */
export function updateAtmosphere(L, day, rain, time, cx, cz) {
  const evening = sat((day - 15.6) / 2.3), night = sat((day - 17.25) / 1.8);
  U.fog.value.setRGB(mixf(.62, .27, night), mixf(.70, .34, night), mixf(.76, .44, night));
  const k = 1 - rain * .4, sr = mixf(.98, .43, evening) * k, sg = mixf(.90, .30, evening) * k, sb = mixf(.74, .25, evening) * k;
  U.sun.value.setRGB(sr, sg, sb); L.sun.color.setRGB(sr, sg, sb);
  const ar = mixf(.43, .21, night), ag = mixf(.49, .28, night), ab = mixf(.57, .39, night);
  U.ambient.value.setRGB(ar, ag, ab); L.hemi.color.setRGB(ar, ag, ab);
  // The old ambient was amb × (.69 + .31 · max(n.y, 0)); this ground colour matches it for n.y ≥ 0.
  L.hemi.groundColor.setRGB(ar * .38, ag * .38, ab * .38);
  U.evening.value = evening; U.rain.value = rain; U.time.value = time;
  const texel = SHADOW_HALF * 2 / L.sun.shadow.mapSize.x;
  _c.set(cx, 0, cz);
  const a = Math.round(_c.dot(LX) / texel) * texel, b = Math.round(_c.dot(LY) / texel) * texel, c = _c.dot(LIGHT_DIR);
  _c.set(0, 0, 0).addScaledVector(LX, a).addScaledVector(LY, b).addScaledVector(LIGHT_DIR, c);
  L.sun.target.position.copy(_c);
  L.sun.position.copy(_c).addScaledVector(LIGHT_DIR, 90);
}
