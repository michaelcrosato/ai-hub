/* RobotWarrior draw layer on three.js r186 (WebGPURenderer, WebGL2 fallback).

   The game still describes each frame as a list of draw(geometry, matrix,
   colour, alpha, glow) calls, as its hand-written WebGL renderer did. Here
   those calls become instanced batches: one draw per geometry and blend mode,
   however many copies are on screen. The original flat lighting, distance
   fog, night vision, sky and the Enhanced Imaging edge view are TSL node
   materials, so WebGPU and WebGL2 draw the same picture. The old renderer
   never enabled face culling, so every material here is double-sided. */
import * as THREE from 'three/webgpu';
import {
  Fn, If, attribute, uniform, varying, vec3, vec4, float, mix, clamp, max, min, dot, normalize,
  exp, length, pow, smoothstep, sin, sqrt, select, abs, cameraPosition, positionGeometry, positionWorld,
} from 'three/tsl';

/** Draw state the game sets before its draw calls (Enhanced Imaging pass and edge tint). */
export const R = { imaging: false, wire: [0.18, 0.7, 0.43] };
/** Night vision (0 or 1), shared by the world and the sky. */
export const uNight = uniform(0);
const uSkyImaging = uniform(0);
const uCamF = uniform(new THREE.Vector3(0, 0, -1));
const uCamU = uniform(new THREE.Vector3(0, 1, 0));
const uTanF = uniform(0.6);
const uShift = uniform(0);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6200);

const STRIDE = 24; // per instance: 16 matrix floats, rgb tint + alpha, glow, 3 spare
const WHITE = [1, 1, 1];
const HUGE = new THREE.Sphere(new THREE.Vector3(), 1e6);
const n3 = (x, y, z) => { const l = Math.hypot(x, y, z); return vec3(x / l, y / l, z / l); };

/* ------------------------------------------------------------------ geometry */

/** Wrap interleaved [x,y,z, nx,ny,nz, r,g,b] triangle data (non-indexed, as the old buffers). */
export function upload(data) {
  const arr = data instanceof Float32Array ? data : new Float32Array(data);
  const ib = new THREE.InterleavedBuffer(arr, 9);
  return {
    count: arr.length / 9,
    data: arr,
    grid: false,
    edges: null,
    edgeBuilder: null,
    batches: new Map(),
    attrs: {
      position: new THREE.InterleavedBufferAttribute(ib, 3, 0),
      normal: new THREE.InterleavedBufferAttribute(ib, 3, 3),
      color: new THREE.InterleavedBufferAttribute(ib, 3, 6),
    },
  };
}

/* Enhanced Imaging draws mesh edges: outlines and creases (every edge on a grid).
   Building them walks every triangle, so it runs in small steps while the game idles. */
const edgeJobs = new Map();
function* edgeSteps(g) {
  const d = g.data;
  const edges = new Map();
  const key = (i) => Math.round(d[i] * 1000) + ',' + Math.round(d[i + 1] * 1000) + ',' + Math.round(d[i + 2] * 1000);
  for (let i = 0, n = 0; i < d.length; i += 27, n++) {
    const nx = d[i + 3], ny = d[i + 4], nz = d[i + 5];
    for (let j = 0; j < 3; j++) {
      const a = i + j * 9, b = i + ((j + 1) % 3) * 9, ka = key(a), kb = key(b);
      if (ka === kb) continue;
      const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const e = edges.get(k);
      if (e) {
        e.shared = true;
        if (e.nx * nx + e.ny * ny + e.nz * nz < 0.995) e.crease = true;
      } else edges.set(k, { a, b, nx, ny, nz, shared: false, crease: false });
    }
    if (n % 1500 === 1499) yield;
  }
  const out = [];
  for (const e of edges.values()) {
    if (!g.grid && e.shared && !e.crease) continue;
    out.push(d[e.a], d[e.a + 1], d[e.a + 2], d[e.b], d[e.b + 1], d[e.b + 2]);
  }
  g.edges = new Float32Array(out);
}
function edgeData(g) {
  if (g.edges) return g.edges;
  if (g.edgeBuilder) return (g.edges = g.edgeBuilder());
  const job = edgeJobs.get(g) || edgeSteps(g);
  edgeJobs.delete(g);
  for (const _ of job); // finish now (the first Enhanced Imaging frame before the idle build is done)
  return g.edges;
}
/** Build the edge lists of these geometries a little at a time, so switching on Enhanced Imaging never stalls. */
export function prebuildEdges(list) {
  const queue = list.filter((g) => g && !g.edges);
  const slice = () => {
    const until = performance.now() + 5;
    while (queue.length && performance.now() < until) {
      const g = queue[0];
      if (g.edges) { queue.shift(); continue; }
      if (g.edgeBuilder) { g.edges = g.edgeBuilder(); queue.shift(); continue; }
      let job = edgeJobs.get(g);
      if (!job) edgeJobs.set(g, (job = edgeSteps(g)));
      if (job.next().done) { edgeJobs.delete(g); queue.shift(); }
    }
    if (queue.length) setTimeout(slice, 24);
  };
  setTimeout(slice, 600);
}

/* ------------------------------------------------------------------ materials */

// Per-instance data from the batch's instance buffer; the batch objects sit at the origin.
const iM0 = attribute('iM0', 'vec4');
const iM1 = attribute('iM1', 'vec4');
const iM2 = attribute('iM2', 'vec4');
const iM3 = attribute('iM3', 'vec4');
const iTint = attribute('iTint', 'vec4');
const iGlow = attribute('iGlow', 'float');
const P = positionGeometry;
const instPos = iM0.xyz.mul(P.x).add(iM1.xyz.mul(P.y)).add(iM2.xyz.mul(P.z)).add(iM3.xyz);
// The old shader turned normals with mat3(model), not its inverse transpose: kept, so the shading matches.
const aN = attribute('normal', 'vec3');
const vNormal = varying(iM0.xyz.mul(aN.x).add(iM1.xyz.mul(aN.y)).add(iM2.xyz.mul(aN.z)), 'vRwNormal');
const vWorld = varying(instPos, 'vRwWorld');
const FOG = vec3(0.56, 0.43, 0.35);
const LIGHT_A = n3(-0.55, 0.8, 0.3);
const LIGHT_B = n3(0.65, 0.3, -0.5);

const LIT = Fn(() => {
  const n = normalize(vNormal);
  const light = float(0.4).add(max(dot(n, LIGHT_A), 0).mul(0.57)).add(max(dot(n, LIGHT_B), 0).mul(0.12));
  const col = attribute('color', 'vec3').mul(iTint.rgb).mul(mix(light, float(1.5), iGlow)).toVar();
  const d = length(vWorld.sub(cameraPosition));
  const fog = float(1).sub(exp(d.mul(d).mul(-0.00000021)));
  col.assign(mix(col, FOG, min(fog.mul(float(1).sub(iGlow.mul(0.7))), 0.98)));
  const lum = dot(col, vec3(0.3, 0.59, 0.11));
  const vision = vec3(0.21, 0.85, 0.37).mul(lum.mul(1.6)).add(vec3(0.012, 0.035, 0.014));
  return vec4(select(uNight.greaterThan(0.5), vision, col), iTint.a);
})();
const FILL = vec4(0.003, 0.009, 0.007, iTint.a);
const WIRE = vec4(iTint.rgb.mul(clamp(exp(length(vWorld.sub(cameraPosition)).mul(-0.00052)), 0.08, 1)), iTint.a);

const materials = new Map();
function materialFor(kind, mode) {
  const key = kind + '/' + mode;
  let m = materials.get(key);
  if (m) return m;
  const params = {
    side: THREE.DoubleSide,
    fog: false,
    transparent: mode !== 'opaque',
    depthWrite: mode === 'opaque',
    blending: mode === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
  };
  if (kind === 'line') {
    m = new THREE.LineBasicNodeMaterial(params);
    m.colorNode = WIRE;
  } else {
    m = new THREE.MeshBasicNodeMaterial(params);
    if (kind === 'fill') {
      // Enhanced Imaging: near-black solids pushed back, so their own edges draw on top.
      m.colorNode = FILL;
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
    } else m.colorNode = LIT;
  }
  m.positionNode = instPos;
  materials.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ batches */

const batches = [];
let drawSeq = 0;
class Batch {
  constructor(g, kind, mode) {
    this.kind = kind;
    this.mode = mode;
    this.n = 0;
    this.cap = 0;
    this.array = null;
    const geo = (this.geometry = new THREE.InstancedBufferGeometry());
    if (kind === 'line') geo.setAttribute('position', new THREE.BufferAttribute(edgeData(g), 3));
    else for (const [k, a] of Object.entries(g.attrs)) geo.setAttribute(k, a);
    geo.boundingSphere = HUGE;
    geo.instanceCount = 0;
    const mat = materialFor(kind, mode);
    this.object = kind === 'line' ? new THREE.LineSegments(geo, mat) : new THREE.Mesh(geo, mat);
    this.object.frustumCulled = false;
    this.object.matrixAutoUpdate = false;
    this.object.visible = false;
    this.grow(kind === 'line' ? 8 : 16);
    scene.add(this.object);
    batches.push(this);
  }
  grow(cap) {
    const arr = new Float32Array(cap * STRIDE);
    if (this.array) arr.set(this.array.subarray(0, this.n * STRIDE));
    this.array = arr;
    this.cap = cap;
    const ib = (this.buffer = new THREE.InstancedInterleavedBuffer(arr, STRIDE, 1));
    ib.setUsage(THREE.DynamicDrawUsage);
    const geo = this.geometry;
    geo.setAttribute('iM0', new THREE.InterleavedBufferAttribute(ib, 4, 0));
    geo.setAttribute('iM1', new THREE.InterleavedBufferAttribute(ib, 4, 4));
    geo.setAttribute('iM2', new THREE.InterleavedBufferAttribute(ib, 4, 8));
    geo.setAttribute('iM3', new THREE.InterleavedBufferAttribute(ib, 4, 12));
    geo.setAttribute('iTint', new THREE.InterleavedBufferAttribute(ib, 4, 16));
    geo.setAttribute('iGlow', new THREE.InterleavedBufferAttribute(ib, 1, 20));
  }
  add(m, c, alpha, glow) {
    if (this.n === 0 && this.mode !== 'opaque') this.object.renderOrder = ++drawSeq; // keep the old draw order
    if (this.n >= this.cap) this.grow(this.cap * 2);
    const o = this.n++ * STRIDE, a = this.array;
    for (let i = 0; i < 16; i++) a[o + i] = m[i];
    a[o + 16] = c[0];
    a[o + 17] = c[1];
    a[o + 18] = c[2];
    a[o + 19] = alpha;
    a[o + 20] = glow;
  }
  commit() {
    const on = this.n > 0;
    this.object.visible = on;
    this.geometry.instanceCount = this.n;
    if (on) this.buffer.needsUpdate = true;
  }
}

let mode = 'opaque';
/** Blend state for the draw calls that follow: 'opaque', 'alpha' (normal blending) or 'add' (additive). */
export function blend(m = 'opaque') {
  mode = m;
}

function batchFor(g, kind) {
  const key = kind + '/' + mode;
  let b = g.batches.get(key);
  if (!b) {
    b = new Batch(g, kind, mode);
    g.batches.set(key, b);
  }
  return b;
}

/** Queue one copy of g with a column-major 4×4 matrix. The matrix is copied at once, so scratch matrices can be reused. */
export function draw(g, m, color = WHITE, alpha = 1, glow = 0) {
  if (!g || !g.count) return;
  if (R.imaging) {
    if (alpha > 0.5) batchFor(g, 'fill').add(m, color, alpha, glow);
    batchFor(g, 'line').add(m, R.wire, alpha, 0);
  } else batchFor(g, 'lit').add(m, color, alpha, glow);
}

/* ------------------------------------------------------------------ sky */

const SUN = n3(-0.55, 0.24, -0.85);
const MOON = n3(0.49, 0.4, -1);
const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
skyMaterial.colorNode = Fn(() => {
  // The camera sits at the sphere's centre, so this is the view ray of the pixel, as the old full-screen pass computed it.
  const dir = normalize(positionWorld.sub(cameraPosition)).toVar();
  const h = clamp(dir.y, 0, 1);
  const col = mix(vec3(0.65, 0.46, 0.39), vec3(0.13, 0.21, 0.26), pow(h, 0.48)).toVar();
  col.assign(mix(col, vec3(0.7, 0.51, 0.41), pow(float(1).sub(clamp(abs(dir.y).mul(4), 0, 1)), 4).mul(0.3)));
  const sd = dot(dir, SUN);
  col.addAssign(vec3(1, 0.67, 0.37).mul(pow(max(sd, 0), 180)).mul(0.42));
  col.assign(select(sd.greaterThan(0.99972), vec3(1, 0.88, 0.63), col));
  const md = dot(dir, MOON);
  If(md.greaterThan(1 - 0.0068), () => {
    const r = sqrt(max(float(1).sub(md).div(0.0068), 0));
    const cr = sin(dir.x.mul(340)).mul(sin(dir.y.mul(240))).mul(0.03);
    const mc = mix(vec3(0.48, 0.48, 0.4), vec3(0.7, 0.63, 0.5), sqrt(max(float(1).sub(r.mul(r)), 0))).add(cr);
    col.assign(mix(col, mc, 0.76));
    const shade = dot(normalize(dir.sub(MOON.mul(md)).add(vec3(0.000001, 0, 0))), n3(0.6, 0.3, 0));
    col.mulAssign(float(1).sub(smoothstep(-0.1, 0.8, shade).mul(0.29)));
  });
  const band = sin(dir.y.mul(84).add(dir.x.mul(5))).mul(0.5).add(0.5);
  col.addAssign(vec3(0.05, 0.035, 0.028).mul(pow(band, 15)).mul(float(1).sub(smoothstep(0.02, 0.3, abs(dir.y.sub(0.11))))));
  const l = dot(col, vec3(0.3, 0.59, 0.11));
  col.assign(select(uNight.greaterThan(0.5), vec3(0.11, 0.43, 0.2).mul(l), col));
  // Enhanced Imaging: a dark screen with a faint band fixed on screen, as before (screen y from the view ray).
  const screenY = dot(dir, uCamU).div(max(dot(dir, uCamF), 0.0001)).div(uTanF).sub(uShift);
  const horizon = exp(abs(screenY.add(0.18)).mul(-9));
  const img = vec3(0.002, 0.007, 0.006).add(vec3(0.002, 0.014, 0.008).mul(horizon));
  return vec4(select(uSkyImaging.greaterThan(0.5), img, col), 1);
})();
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), skyMaterial);
sky.frustumCulled = false;
sky.renderOrder = -1000;
scene.add(sky);

/* ------------------------------------------------------------------ camera and frame */

const view = { fov: 0, aspect: 0, shift: NaN };
const right = new THREE.Vector3();
const fwdV = new THREE.Vector3();
/**
 * Place the camera: eye, forward (unit), vertical fov in radians, aspect, and the vertical
 * shift the old projection used (-0.14 in the cockpit puts the horizon above the dashboard).
 */
export function setCamera(eye, forward, fovRad, aspect, shift, imagingSky) {
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(eye[0] + forward[0], eye[1] + forward[1], eye[2] + forward[2]);
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);
  sky.updateMatrixWorld();
  const fov = (fovRad * 180) / Math.PI;
  if (fov !== view.fov || aspect !== view.aspect || shift !== view.shift) {
    view.fov = fov;
    view.aspect = aspect;
    view.shift = shift;
    camera.fov = fov;
    camera.aspect = aspect;
    // A shifted principal point, through the camera API so both backends keep it.
    if (shift) camera.setViewOffset(1000 * aspect, 1000, 0, -shift * 500, 1000 * aspect, 1000);
    else camera.clearViewOffset();
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  fwdV.set(forward[0], forward[1], forward[2]).normalize();
  right.crossVectors(fwdV, camera.up).normalize();
  uCamF.value.copy(fwdV);
  uCamU.value.crossVectors(right, fwdV);
  uTanF.value = Math.tan(fovRad / 2);
  uShift.value = shift || 0;
  uSkyImaging.value = imagingSky ? 1 : 0;
}

export function beginFrame() {
  for (const b of batches) b.n = 0;
  mode = 'opaque';
  drawSeq = 0;
  R.imaging = false;
}

export function renderFrame(renderer) {
  for (const b of batches) b.commit();
  renderer.render(scene, camera);
}

/** Compile every material the batches use, so the first explosion or imaging switch does not stutter. */
export async function warmUp(renderer, g) {
  const hidden = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -9999, 0, 1]);
  for (const imaging of [false, true]) {
    R.imaging = imaging;
    for (const m of ['opaque', 'alpha', 'add']) {
      blend(m);
      draw(g, hidden, WHITE, 1, 0);
      draw(g, hidden, WHITE, 0.2, 1);
    }
  }
  R.imaging = false;
  blend('opaque');
  for (const b of batches) b.commit();
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.warn('Pipeline warm-up skipped:', e?.message || e);
  }
  beginFrame();
  for (const b of batches) b.commit();
}
