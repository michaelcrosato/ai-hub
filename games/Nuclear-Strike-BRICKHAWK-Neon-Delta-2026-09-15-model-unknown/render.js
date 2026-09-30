/* BRICKHAWK — the three.js side.
 *
 * The game draws its whole world out of a handful of brick primitives (box, bevelled box,
 * cylinder, cone, hexagon, ring, plane, wedge, icosahedron). `put()` adds one instance of a
 * primitive with a transform, colour, glow and flag, exactly like the original hand-written
 * WebGL2 renderer. Here every primitive becomes a THREE.InstancedMesh per pool:
 *   static       the island, built once and uploaded once
 *   dynamic      helicopter, enemies, crew, shots, particles: rebuilt every frame
 *   transparent  rings, glows and the shield dome: unlit, blended, rebuilt every frame
 *
 * The original shading is reproduced with three.js lights: a hemisphere light (sky/ground
 * colours × 0.73), a warm sun (1.9, 1.64, 1.2) with a three.js shadow map that keeps 32 % of
 * the sun in shadow, drifting cloud shade folded into the received shadow, a faint Blinn
 * highlight, per-instance glow, the animated TSL ocean with shoreline shallows, sparkle, crests
 * and foam, the distance haze as a fog node, and kit/post.js with the original bloom, ACES
 * curve, 2.2 gamma, vignette, film grain and red damage edge.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  uniform,
  texture,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  cos,
  fract,
  floor,
  dot,
  mix,
  smoothstep,
  pow,
  max,
  normalize,
  reflect,
  length,
  clamp,
  select,
  positionWorld,
  cameraPosition,
  screenUV,
  screenCoordinate,
  time,
  fog,
  sRGBTransferEOTF,
} from 'three/tsl';
import { createPost } from 'kit/post.js';

/* ------------------------------------------------------------------ matrix helpers (column-major, like three.js) */

export const Math3 = (() => {
  function mul(a, b, out = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) {
      const k = c * 4;
      for (let r = 0; r < 4; r++) out[k + r] = a[r] * b[k] + a[4 + r] * b[k + 1] + a[8 + r] * b[k + 2] + a[12 + r] * b[k + 3];
    }
    return out;
  }
  /** Translation · rotation (Y, then X, then Z) · scale, written into `out`. */
  function trs(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, out = new Float32Array(16)) {
    const a = Math.cos(rx),
      b = Math.sin(rx),
      c = Math.cos(ry),
      d = Math.sin(ry),
      e = Math.cos(rz),
      f = Math.sin(rz);
    out[0] = (c * e + d * b * f) * sx;
    out[1] = a * f * sx;
    out[2] = (-d * e + c * b * f) * sx;
    out[3] = 0;
    out[4] = (-c * f + d * b * e) * sy;
    out[5] = a * e * sy;
    out[6] = (d * f + c * b * e) * sy;
    out[7] = 0;
    out[8] = d * a * sz;
    out[9] = -b * sz;
    out[10] = c * a * sz;
    out[11] = 0;
    out[12] = x;
    out[13] = y;
    out[14] = z;
    out[15] = 1;
    return out;
  }
  return { mul, trs };
})();

/* ------------------------------------------------------------------ the brick primitives */

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (v) => {
  const d = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / d, v[1] / d, v[2] / d];
};

/** The original primitive builders. Returns { name: { pos, nor } } of flat-shaded triangles. */
function buildShapes() {
  const shapes = {};
  const make = (name, tri) => {
    const n = tri.length / 6;
    const pos = new Float32Array(n * 3),
      nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = tri[i * 6];
      pos[i * 3 + 1] = tri[i * 6 + 1];
      pos[i * 3 + 2] = tri[i * 6 + 2];
      nor[i * 3] = tri[i * 6 + 3];
      nor[i * 3 + 1] = tri[i * 6 + 4];
      nor[i * 3 + 2] = tri[i * 6 + 5];
    }
    shapes[name] = { pos, nor };
  };
  function face(out, pts, normal) {
    let n = normal || norm3(cross3(sub3(pts[1], pts[0]), sub3(pts[2], pts[0])));
    if (!normal) {
      const c = [0, 0, 0];
      for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / pts.length;
      if (dot3(n, c) < 0) {
        pts = pts.slice().reverse();
        n = [-n[0], -n[1], -n[2]];
      }
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[0];
      let b = pts[i],
        c = pts[i + 1];
      // The original drew without face culling. three.js culls back faces, so every
      // triangle is wound counter-clockwise around its (outward) normal.
      if (dot3(cross3(sub3(b, a), sub3(c, a)), n) < 0) [b, c] = [c, b];
      out.push(...a, ...n, ...b, ...n, ...c, ...n);
    }
  }
  const box = [];
  for (let a = 0; a < 3; a++)
    for (const s of [-1, 1]) {
      const b = (a + 1) % 3,
        c = (a + 2) % 3;
      face(
        box,
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, y]) => {
          const p = [0, 0, 0];
          p[a] = s * 0.5;
          p[b] = x * 0.5;
          p[c] = y * 0.5;
          return p;
        }),
      );
    }
  make('box', box);

  const bevel = [],
    k = 0.4;
  for (let a = 0; a < 3; a++)
    for (const s of [-1, 1]) {
      const b = (a + 1) % 3,
        c = (a + 2) % 3;
      face(
        bevel,
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, y]) => {
          const p = [0, 0, 0];
          p[a] = s * 0.5;
          p[b] = x * k;
          p[c] = y * k;
          return p;
        }),
      );
    }
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const s of [-1, 1])
        for (const t of [-1, 1]) {
          const pts = [];
          for (const [u, v, w] of [
            [0.5, k, -k],
            [k, 0.5, -k],
            [k, 0.5, k],
            [0.5, k, k],
          ]) {
            const p = [0, 0, 0];
            p[a] = s * u;
            p[b] = t * v;
            p[c] = w;
            pts.push(p);
          }
          face(bevel, pts);
        }
    }
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        face(bevel, [
          [sx * 0.5, sy * k, sz * k],
          [sx * k, sy * 0.5, sz * k],
          [sx * k, sy * k, sz * 0.5],
        ]);
  make('bevel', bevel);

  for (const shape of ['cyl', 'cone', 'hex']) {
    const t = [],
      n = shape === 'hex' ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        r = shape === 'cone' ? 0 : 0.5;
      const p = [Math.cos(a) * 0.5, -0.5, Math.sin(a) * 0.5],
        q = [Math.cos(b) * 0.5, -0.5, Math.sin(b) * 0.5],
        u = [Math.cos(a) * r, 0.5, Math.sin(a) * r],
        v = [Math.cos(b) * r, 0.5, Math.sin(b) * r];
      if (r) face(t, [p, q, v, u]);
      else face(t, [p, q, v]); // a cone side is one triangle (the original's second one had no area)
      if (r) face(t, [[0, 0.5, 0], u, v], [0, 1, 0]);
      face(t, [[0, -0.5, 0], q, p], [0, -1, 0]);
    }
    make(shape, t);
  }

  const ring = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2,
      b = ((i + 1) / 48) * Math.PI * 2;
    face(
      ring,
      [
        [Math.cos(a), 0, Math.sin(a)],
        [Math.cos(a) * 0.925, 0, Math.sin(a) * 0.925],
        [Math.cos(b) * 0.925, 0, Math.sin(b) * 0.925],
        [Math.cos(b), 0, Math.sin(b)],
      ],
      [0, 1, 0],
    );
  }
  make('ring', ring);

  const plane = [];
  face(
    plane,
    [
      [-0.5, 0, -0.5],
      [-0.5, 0, 0.5],
      [0.5, 0, 0.5],
      [0.5, 0, -0.5],
    ],
    [0, 1, 0],
  );
  make('plane', plane);

  const wedge = [];
  const wp = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, -0.5, 0.5],
    [-0.5, -0.5, 0.5],
    [-0.5, -0.13, -0.5],
    [0.5, -0.13, -0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ];
  for (const ids of [
    [0, 3, 2, 1],
    [0, 1, 5, 4],
    [4, 5, 6, 7],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ])
    face(
      wedge,
      ids.map((i) => wp[i]),
    );
  make('wedge', wedge);

  const ico = [],
    iv = [],
    g = (1 + Math.sqrt(5)) / 2;
  for (const p of [
    [-1, g, 0],
    [1, g, 0],
    [-1, -g, 0],
    [1, -g, 0],
    [0, -1, g],
    [0, 1, g],
    [0, -1, -g],
    [0, 1, -g],
    [g, 0, -1],
    [g, 0, 1],
    [-g, 0, -1],
    [-g, 0, 1],
  ])
    iv.push(norm3(p).map((x) => x * 0.5));
  for (const f of [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ])
    face(
      ico,
      f.map((i) => iv[i]),
    );
  make('ico', ico);
  return shapes;
}

/* ------------------------------------------------------------------ instanced pools */

// Above the uniform-buffer limit, so three.js always feeds instance matrices as vertex
// attributes (both backends), and a pool never switches path when it grows.
const MIN_CAPACITY = 2048;

class Batch {
  constructor(r, shape, kind) {
    this.r = r;
    this.shape = shape;
    this.kind = kind; // 'static' | 'dynamic' | 'transparent'
    this.count = 0;
    this.drawn = -1;
    this.dirty = true;
    this.mesh = null;
    this.cap = 0;
    this.alloc(MIN_CAPACITY);
  }
  alloc(cap) {
    const r = this.r,
      old = this.mesh,
      base = r.shapes[this.shape];
    const geo = new THREE.BufferGeometry();
    // Own attribute objects per pool, so disposing a grown-out pool never frees another's buffers.
    geo.setAttribute('position', new THREE.BufferAttribute(base.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(base.nor, 3));
    const usage = this.kind === 'static' ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage;
    const colors = new Float32Array(cap * 4),
      extras = new Float32Array(cap * 2);
    if (old) {
      colors.set(this.colors);
      extras.set(this.extras);
    }
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 4).setUsage(usage);
    this.extraAttr = new THREE.InstancedBufferAttribute(extras, 2).setUsage(usage);
    geo.setAttribute('iColor', this.colorAttr);
    geo.setAttribute('iExtra', this.extraAttr);
    const mesh = new THREE.InstancedMesh(geo, this.kind === 'transparent' ? r.glowMaterial : r.brickMaterial, cap);
    mesh.instanceMatrix.setUsage(usage);
    if (old) mesh.instanceMatrix.array.set(this.matrices);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false; // instances span the island; bounds would be stale every frame
    mesh.castShadow = this.kind !== 'transparent';
    mesh.receiveShadow = this.kind !== 'transparent';
    mesh.name = `${this.kind}:${this.shape}`;
    this.mesh = mesh;
    this.matrices = mesh.instanceMatrix.array;
    this.colors = colors;
    this.extras = extras;
    this.cap = cap;
    this.drawn = -1;
    this.dirty = true;
    r.scene.add(mesh);
    if (old) {
      r.scene.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
  }
  commit() {
    const n = this.count;
    if (!this.dirty && n === this.drawn) return;
    const m = this.mesh;
    m.count = n;
    m.visible = n > 0;
    this.drawn = n;
    this.dirty = false;
    if (!n) return;
    const im = m.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, n * 16);
    im.needsUpdate = true;
    this.colorAttr.clearUpdateRanges();
    this.colorAttr.addUpdateRange(0, n * 4);
    this.colorAttr.needsUpdate = true;
    this.extraAttr.clearUpdateRanges();
    this.extraAttr.addUpdateRange(0, n * 2);
    this.extraAttr.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ shared TSL helpers (the original GLSL, ported) */

const hash21 = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)));
const valueNoise = Fn(([p]) => {
  const i = floor(p),
    f = fract(p);
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash21(i),
    b = hash21(i.add(vec2(1, 0))),
    c = hash21(i.add(vec2(0, 1))),
    d = hash21(i.add(vec2(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});
const acesFit = Fn(([x]) => clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1));

// Sun direction (toward the light) and its offset from the camera focus, as in the original.
const SUN_OFFSET = new THREE.Vector3(-97.5, 150, 67.5);
const LIGHT = SUN_OFFSET.clone().normalize();
const LIGHT_X = new THREE.Vector3(0, 1, 0).cross(LIGHT).normalize();
const LIGHT_Y = LIGHT.clone().cross(LIGHT_X);
const SHADOW_HALF = 104;

/* ------------------------------------------------------------------ the renderer */

export class BrickRenderer {
  constructor(kit) {
    this.kit = kit;
    const renderer = kit.renderer;
    // The post chain applies the original ACES curve and gamma itself.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.shapes = buildShapes();
    this.static = {};
    this.dynamic = {};
    this.transparent = {};
    this.batches = [];
    this.mode = 'static';
    this.parent = null;
    this.colors = new Map();
    this._m = new Float32Array(16);
    this._m2 = new Float32Array(16);
    this.projected = { x: 0, y: 0, depth: 0 };
    this.focus = new THREE.Vector3();
    this.hw = 1;
    this.hh = 1;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color().setRGB(0.035, 0.24, 0.26, THREE.LinearSRGBColorSpace);

    this.uTime = uniform(0);
    this.uFocus = uniform(new THREE.Vector3());
    this.uDamage = uniform(0);
    const uTime = this.uTime;

    // Distance haze toward sea-mist green, measured from the camera focus like the original.
    const haze = smoothstep(66, 190, length(positionWorld.xz.sub(this.uFocus.xz))).mul(0.21);
    scene.fogNode = fog(vec3(0.38, 0.6, 0.52), haze);

    /* ---- lights in the original's units (three.js divides diffuse light by π) */
    const hemi = new THREE.HemisphereLight();
    hemi.color.setRGB(0.54 * 0.73, 0.7 * 0.73, 0.72 * 0.73, THREE.LinearSRGBColorSpace);
    hemi.groundColor.setRGB(0.21 * 0.73, 0.235 * 0.73, 0.17 * 0.73, THREE.LinearSRGBColorSpace);
    hemi.intensity = Math.PI;
    const sun = (this.sun = new THREE.DirectionalLight());
    sun.color.setRGB(1, 1.64 / 1.9, 1.2 / 1.9, THREE.LinearSRGBColorSpace);
    sun.intensity = 1.9 * Math.PI;
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -SHADOW_HALF;
    sc.right = SHADOW_HALF;
    sc.top = SHADOW_HALF;
    sc.bottom = -SHADOW_HALF;
    sc.near = 1;
    sc.far = 340;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 1.2;
    sun.shadow.intensity = 0.68; // shadowed ground keeps 32 % of the sun
    kit.shadow(sun, 2048);
    scene.add(hemi, sun, sun.target);

    /* ---- materials */
    const iColor = attribute('iColor', 'vec4');
    const iExtra = attribute('iExtra', 'vec2');
    const unlit = iExtra.y.greaterThan(1.5);
    // Slow cloud shade drifting over the island (only on direct sun, as in the original).
    const cloud = mix(float(0.91), float(1), smoothstep(0.27, 0.7, valueNoise(positionWorld.xz.mul(0.019).add(vec2(uTime.mul(0.012), 0)))));

    const brick = (this.brickMaterial = new THREE.MeshPhongNodeMaterial({ shininess: 38 }));
    brick.colorNode = vec4(select(unlit, vec3(0), iColor.rgb), 1);
    brick.emissiveNode = iColor.rgb.mul(select(unlit, iExtra.x.add(0.9), iExtra.x));
    brick.specularNode = select(unlit, vec3(0), vec3(0.0295, 0.0321, 0.0373));
    brick.receivedShadowNode = Fn(([shadow]) => shadow.mul(cloud));

    const glow = (this.glowMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    glow.colorNode = vec4(iColor.rgb.mul(iExtra.x.add(0.9)), 1);
    glow.opacityNode = iColor.a;
    glow.forceSinglePass = true; // one pass, both faces, like the original's unculled blend pass

    /* ---- the ocean: one plane with the original's animated shading */
    // A placeholder until the game hands over the real shoreline map (landTexture).
    const placeholder = new THREE.DataTexture(new Uint8Array(16), 4, 4, THREE.RedFormat, THREE.UnsignedByteType);
    placeholder.needsUpdate = true;
    const landNode = (this.landNode = texture(placeholder, positionWorld.xz.add(135).div(270)));
    const water = new THREE.MeshBasicNodeMaterial();
    water.colorNode = Fn(() => {
      const p = positionWorld.xz;
      const v = normalize(cameraPosition.sub(positionWorld));
      const l = vec3(LIGHT.x, LIGHT.y, LIGHT.z);
      const nearLand = landNode.r;
      const phase = p.x
        .mul(0.39)
        .add(p.y.mul(0.16))
        .add(uTime.mul(1.1))
        .add(valueNoise(p.mul(0.065)).mul(4));
      const cross = p.y.mul(0.53).sub(p.x.mul(0.17)).add(uTime.mul(0.7));
      const w = sin(phase).add(sin(cross).mul(0.34));
      const sw = sin(p.x.mul(0.082).add(p.y.mul(0.115)).add(uTime.mul(0.21)));
      const wn = normalize(vec3(cos(phase).mul(0.057), 1, cos(cross).mul(0.042)));
      const fres = pow(float(1).sub(max(dot(wn, v), 0)), 3);
      const col = mix(vec3(0.022, 0.24, 0.27), vec3(0.09, 0.57, 0.48), nearLand.mul(0.84))
        .mul(w.mul(0.04).add(sw.mul(0.025)).add(0.88))
        .toVar();
      col.addAssign(vec3(0.2, 0.35, 0.29).mul(fres));
      col.addAssign(vec3(1.4, 1.2, 0.76).mul(pow(max(dot(reflect(l.negate(), wn), v), 0), 140)));
      const crest = smoothstep(1.1, 1.29, w)
        .mul(smoothstep(0.36, 0.65, valueNoise(p.mul(0.13).add(uTime.mul(0.03)))))
        .mul(0.032);
      col.addAssign(vec3(0.7, 1, 0.86).mul(crest));
      const foam = smoothstep(0.85, 0.98, nearLand).mul(float(0.035).add(smoothstep(0.5, 0.9, valueNoise(p.mul(0.9).add(uTime.mul(0.1)))).mul(0.11)));
      col.addAssign(vec3(0.38, 0.65, 0.48).mul(foam));
      return vec4(col, 1);
    })();
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), water);
    ocean.position.y = -0.12;
    ocean.name = 'ocean';
    scene.add(ocean);
    // Shadows on the water: the original darkened it to 58 % + 42 % × the lit amount.
    // A shadow-catcher plane at 42 % opacity over it gives exactly that.
    const catcher = (this.shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(SHADOW_HALF * 3, SHADOW_HALF * 3).rotateX(-Math.PI / 2),
      new THREE.ShadowNodeMaterial({ opacity: 0.42, depthWrite: false, fog: false }),
    ));
    catcher.position.y = -0.1;
    catcher.receiveShadow = true;
    catcher.renderOrder = -1;
    catcher.name = 'ocean shadows';
    scene.add(catcher);

    /* ---- camera: the original fixed isometric orthographic view */
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 430);
    this.camera.position.set(90, 120, 90);
    this.camera.lookAt(0, 0, 0);

    /* ---- post: bloom, then the original grade (ACES, 2.2 gamma, saturation, vignette, grain, damage edge) */
    const uDamage = this.uDamage;
    this.post = createPost(kit, scene, this.camera, {
      bloom: { strength: 0.16, radius: 0.3, threshold: 0.72 },
      output: (node) => {
        const q = screenUV.mul(2).sub(1);
        const toned = pow(acesFit(node.rgb.mul(1.05)), vec3(1 / 2.2));
        const lum = dot(toned, vec3(0.299, 0.587, 0.114));
        const vignette = float(1).sub(dot(q, q).mul(0.085));
        const grain = fract(sin(dot(screenCoordinate.xy.add(fract(time).mul(73)), vec2(12.9898, 78.233))).mul(43758.5453));
        const graded = mix(vec3(lum), toned, 1.035)
          .mul(vignette)
          .add(grain.sub(0.5).mul(0.009))
          .add(
            vec3(0.1, -0.025, -0.03)
              .mul(uDamage)
              .mul(pow(length(q).mul(0.72), 3)),
          );
        // The grade above is display-referred; hand three.js the linear value that encodes back to it.
        return vec4(sRGBTransferEOTF(clamp(graded, 0, 1)), 1);
      },
    });
  }

  /** The original's colour: sRGB hex → linear with a 2.2 power. */
  color(hex) {
    let found = this.colors.get(hex);
    if (found) return found;
    const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
    found = [Math.pow(((n >> 16) & 255) / 255, 2.2), Math.pow(((n >> 8) & 255) / 255, 2.2), Math.pow((n & 255) / 255, 2.2)];
    this.colors.set(hex, found);
    return found;
  }

  /** One brick: primitive name, position, scale, colour, yaw, pitch, roll, glow, alpha, flag (2 = unlit). */
  put(name, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, emission = 0, alpha = 1, flag = 0) {
    if (sx === 0 || sy === 0 || sz === 0 || flag === 1) return; // flag 1 was the ocean, now its own mesh
    const kind = alpha < 0.999 ? 'transparent' : this.mode;
    const pool = this[kind];
    let b = pool[name];
    if (!b) {
      b = pool[name] = new Batch(this, name, kind);
      this.batches.push(b);
    }
    if (b.count >= b.cap) b.alloc(b.cap * 2);
    let m = Math3.trs(x, y, z, sx, sy, sz, rx, ry, rz, this._m);
    if (this.parent) m = Math3.mul(this.parent, m, this._m2);
    const i = b.count++;
    b.matrices.set(m, i * 16);
    const c = this.color(color);
    const o = i * 4;
    b.colors[o] = c[0];
    b.colors[o + 1] = c[1];
    b.colors[o + 2] = c[2];
    b.colors[o + 3] = alpha;
    b.extras[i * 2] = emission;
    b.extras[i * 2 + 1] = flag;
    b.dirty = true;
  }

  /** Start a frame: dynamic and transparent pools refill from zero. */
  begin() {
    this.mode = 'dynamic';
    this.parent = null;
    for (const b of this.batches)
      if (b.kind !== 'static') {
        b.count = 0;
        b.dirty = true;
      }
  }

  /** The island's shoreline map (0..255 = distance to land), used by the shallow water. */
  landTexture(size, data) {
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.landNode.value = tex;
  }

  /** Aim the orthographic camera at a focus point. `height` is the visible world height. */
  aim(x, y, z, height = 78, shake = 0) {
    const cam = this.camera,
      W = this.kit.size.width,
      H = this.kit.size.height;
    this.focus.set(x, y, z);
    this.uFocus.value.set(x, y, z);
    let ex = x + 90,
      ey = y + 120,
      ez = z + 90;
    if (shake) {
      ex += (Math.random() - 0.5) * shake;
      ey += (Math.random() - 0.5) * shake;
      ez += (Math.random() - 0.5) * shake;
    }
    const hh = height / 2,
      hw = (hh * W) / H;
    if (cam.top !== hh || cam.right !== hw) {
      cam.left = -hw;
      cam.right = hw;
      cam.top = hh;
      cam.bottom = -hh;
      cam.updateProjectionMatrix();
    }
    this.hw = hw;
    this.hh = hh;
    cam.position.set(ex, ey, ez);
    cam.lookAt(x, y, z);
    cam.updateMatrixWorld();

    // The sun follows the focus. Snap it to whole shadow texels so shadows do not shimmer.
    const texel = (SHADOW_HALF * 2) / this.sun.shadow.mapSize.x;
    const fx = x * LIGHT_X.x + y * LIGHT_X.y + z * LIGHT_X.z,
      fy = x * LIGHT_Y.x + y * LIGHT_Y.y + z * LIGHT_Y.z;
    const dx = Math.round(fx / texel) * texel - fx,
      dy = Math.round(fy / texel) * texel - fy;
    const t = this.sun.target.position;
    t.set(x + LIGHT_X.x * dx + LIGHT_Y.x * dy, y + LIGHT_X.y * dx + LIGHT_Y.y * dy, z + LIGHT_X.z * dx + LIGHT_Y.z * dy);
    this.sun.position.copy(t).add(SUN_OFFSET);
    this.shadowCatcher.position.x = x;
    this.shadowCatcher.position.z = z;
  }

  /** World point → CSS pixels. Returns one reused object: read it before the next call. */
  project(x, y, z) {
    const e = this.camera.matrixWorldInverse.elements;
    const vx = e[0] * x + e[4] * y + e[8] * z + e[12],
      vy = e[1] * x + e[5] * y + e[9] * z + e[13],
      vz = e[2] * x + e[6] * y + e[10] * z + e[14];
    const out = this.projected;
    out.x = ((vx / this.hw) * 0.5 + 0.5) * this.kit.size.width;
    out.y = (0.5 - (vy / this.hh) * 0.5) * this.kit.size.height;
    out.depth = -vz;
    return out;
  }

  /** CSS pixels → the point at height `y` under them. */
  ground(sx, sy, y = 2) {
    const W = this.kit.size.width,
      H = this.kit.size.height;
    const nx = (sx / W) * 2 - 1,
      ny = 1 - (sy / H) * 2;
    const m = this.camera.matrixWorld.elements;
    const ox = m[12] + m[0] * nx * this.hw + m[4] * ny * this.hh,
      oy = m[13] + m[1] * nx * this.hw + m[5] * ny * this.hh,
      oz = m[14] + m[2] * nx * this.hw + m[6] * ny * this.hh;
    const dx = -m[8],
      dy = -m[9],
      dz = -m[10];
    const t = Math.abs(dy) > 1e-6 ? (y - oy) / dy : 0;
    return { x: ox + dx * t, z: oz + dz * t };
  }

  render(t, damage = 0) {
    this.uTime.value = t;
    this.uDamage.value = damage;
    for (const b of this.batches) b.commit();
    this.post.render();
  }

  /** Compile every pipeline before the first frame so the first explosion does not stutter. */
  async warm() {
    for (const b of this.batches) b.commit();
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* warming is optional */
    }
  }

  get stats() {
    const info = this.kit.renderer.info.render;
    return { calls: info.calls, triangles: info.triangles };
  }
}
