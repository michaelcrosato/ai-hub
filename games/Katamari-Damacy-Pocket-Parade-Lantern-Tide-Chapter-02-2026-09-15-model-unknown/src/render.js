// Pocket Parade: Lantern Tide. The three.js layer, drawn by the kit's WebGPU / WebGL2
// renderer. It reproduces the old hand-written renderer: vertex-coloured toy meshes with a
// moonlit PBR model (moon key light with shadows, sky/ground ambient, a warm fill and the
// twelve lanterns nearest the camera target), emission, a height-based ambient occlusion,
// the night fog, the star-and-moon sky, the canal with its reflection and ripples, bloom,
// the old ACES curve and vignette, and a tilt-shift blur for photo mode.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, vec2, vec3, vec4, float, texture, vertexColor, positionWorld, cameraPosition, screenUV, screenSize,
  sin, cos, exp, pow, max, min, clamp, mix, smoothstep, step, fract, floor, dot, length, normalize, distance, abs, atan, asin,
  fog, reflector, lights, transformNormalToView,
} from 'three/tsl';
import { createPost } from 'kit/post.js';
import { writeTRS } from './geometry.js';

/** Objects on this layer are drawn by the main camera but left out of the canal reflection. */
export const LAYER_NO_REFLECT = 1;
export const POINT_LIGHTS = 12;

const REFLECTION_SCALE = { low: 0.25, medium: 0.33, high: 0.5, ultra: 0.6 };

export function createRenderLayer(kit, { waterY, moonDir }) {
  const renderer = kit.renderer;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, 1, 0.08, 220);
  camera.layers.enable(LAYER_NO_REFLECT);
  const uTime = uniform(0);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // ---- lights: the same energies the old shader used (colours are linear values)
  const rgb = (r, g, b) => new THREE.Color().setRGB(r, g, b);
  const hemi = new THREE.HemisphereLight(rgb(0.26, 0.33, 0.51), rgb(0.095, 0.12, 0.2), Math.PI);
  hemi.position.set(0, 1, 0);
  const fill = new THREE.DirectionalLight(rgb(0.13, 0.075, 0.11), Math.PI);
  fill.position.set(0.5, 0.25, 0.65);
  const moon = new THREE.DirectionalLight(rgb(1.35, 1.746, 2.97), 1);
  moon.castShadow = true;
  kit.shadow(moon, 2048);
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.035;
  moon.shadow.radius = 1.5;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 180;
  // One shadow render per frame, shared by the main view and the canal reflection.
  moon.shadow.autoUpdate = false;
  scene.add(hemi, fill, fill.target, moon, moon.target);
  const points = [];
  for (let i = 0; i < POINT_LIGHTS; i++) {
    // decay 1 with a cut-off radius is the closest match to the old 1 / (1 + 0.12 d²) falloff.
    const l = new THREE.PointLight(0xffffff, 0, 10, 1);
    points.push(l);
    scene.add(l);
  }

  // ---- the night fog: exponential after 15 m plus a low mist, as before
  const fogFactor = Fn(() => {
    const d = distance(cameraPosition, positionWorld);
    const far = float(1).sub(exp(max(d.sub(15), 0).mul(-0.0045)));
    const mist = exp(max(positionWorld.y, 0).mul(-0.4)).mul(0.045).mul(float(1).sub(exp(d.mul(-0.028))));
    return clamp(far.add(mist), 0, 0.64);
  })();
  scene.fogNode = fog(vec3(0.016, 0.033, 0.075), fogFactor);

  // ---- sky: gradient, twinkling stars, the moon and slow clouds
  const hash2 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const noise2 = Fn(([p]) => {
    const i = floor(p), f = fract(p);
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(mix(hash2(i), hash2(i.add(vec2(1, 0))), u.x), mix(hash2(i.add(vec2(0, 1))), hash2(i.add(vec2(1, 1))), u.x), u.y);
  });
  const MOON_DISC = new THREE.Vector3(-0.36, 0.58, -0.73).normalize();
  const skyColor = Fn(() => {
    const ray = normalize(positionWorld.sub(cameraPosition));
    const h = max(ray.y, 0);
    const col = mix(vec3(0.021, 0.034, 0.079), vec3(0.003, 0.008, 0.032), pow(clamp(h.mul(1.4), 0.0001, 1), 0.55)).toVar();
    const a = atan(ray.z, ray.x), e = asin(clamp(ray.y, -1, 1));
    const st = vec2(a, e).mul(180);
    const r = hash2(floor(st));
    const sparkle = pow(max(float(1).sub(length(fract(st).sub(0.5)).mul(2)), 0.0001), 13).mul(step(0.983, r)).mul(smoothstep(0.05, 0.3, h));
    col.addAssign(vec3(0.7, 0.8, 1).mul(sparkle).mul(sin(uTime.mul(0.8).add(r.mul(50))).mul(0.2).add(0.8)));
    const d = length(ray.sub(vec3(MOON_DISC.x, MOON_DISC.y, MOON_DISC.z)));
    col.addAssign(vec3(0.22, 0.29, 0.46).mul(exp(d.mul(-16))));
    const disc = float(1).sub(smoothstep(0.042, 0.044, d));
    const crater = noise2(ray.xz.mul(350)).mul(0.13);
    col.assign(mix(col, vec3(2.4, 2.4, 1.94).mul(float(1).sub(crater)), disc));
    const cloud = noise2(vec2(a.mul(3.7), e.mul(11)).add(vec2(uTime.mul(0.003), 0))).mul(0.6)
      .add(noise2(vec2(a.mul(8), e.mul(23)).sub(uTime.mul(0.002))).mul(0.4));
    col.assign(mix(col, vec3(0.04, 0.057, 0.11), smoothstep(0.55, 0.84, cloud).mul(0.22).mul(smoothstep(0.02, 0.14, h))));
    return col;
  });
  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMat.colorNode = skyColor();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---- geometry and materials from the Builder's vertex arrays
  const heightAO = float(0.84).add(smoothstep(0, 0.5, positionWorld.y).mul(0.16));
  function geometryFor(def) {
    if (def.geometry) return def.geometry;
    const a = def.raw, n = (a.length / 12) | 0;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 4), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      pos[i * 3] = a[o]; pos[i * 3 + 1] = a[o + 1]; pos[i * 3 + 2] = a[o + 2];
      nor[i * 3] = a[o + 3]; nor[i * 3 + 1] = a[o + 4]; nor[i * 3 + 2] = a[o + 5];
      // The old shader raised vertex colours to 2.2 before lighting: do it once here.
      col[i * 4] = Math.pow(Math.max(0, a[o + 6]), 2.2);
      col[i * 4 + 1] = Math.pow(Math.max(0, a[o + 7]), 2.2);
      col[i * 4 + 2] = Math.pow(Math.max(0, a[o + 8]), 2.2);
      col[i * 4 + 3] = a[o + 9];
      uv[i * 2] = a[o + 10]; uv[i * 2 + 1] = a[o + 11];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    def.geometry = g;
    return g;
  }

  const matCache = new Map();
  let waterMat = null, reflection = null;
  function materialFor(def) {
    if (def.water) return waterMaterial();
    const key = [def.tex ? def.tex.id : '-', def.emission || 0, def.roughness ?? 0.62, def.metalness || 0, !!def.unlit, !!def.transparent, !!def.doubleSided].join('|');
    let m = matCache.get(key);
    if (m) return m;
    const vc = vertexColor();
    let col = vc.rgb, alpha = vc.a;
    if (def.tex) {
      const t = texture(def.tex);
      col = col.mul(t.rgb);
      alpha = alpha.mul(t.a);
    }
    const transparent = !!def.transparent;
    const side = def.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
    if (def.unlit) {
      m = new THREE.MeshBasicNodeMaterial({ side, transparent, depthWrite: !transparent });
      m.colorNode = vec4(col.mul(1 + (def.emission || 0)), alpha);
    } else {
      m = new THREE.MeshStandardNodeMaterial({ side, transparent, depthWrite: !transparent, roughness: def.roughness ?? 0.62, metalness: def.metalness || 0 });
      m.colorNode = vec4(col, alpha);
      if (def.emission) m.emissiveNode = col.mul(def.emission);
      m.aoNode = heightAO;
    }
    if (transparent) m.alphaTest = 0.018;
    matCache.set(key, m);
    return m;
  }

  // ---- the canal: moving waves, the player's wake rings, a planar reflection and lantern glints
  const ripples = [];
  for (let i = 0; i < 6; i++) ripples.push(uniform(new THREE.Vector4(0, 0, -100, 0)));
  function waterMaterial() {
    if (waterMat) return waterMat;
    reflection = reflector({ resolutionScale: REFLECTION_SCALE[kit.tier.name] ?? 0.5 });
    reflection.target.rotateX(-Math.PI / 2);
    reflection.target.position.y = waterY;
    scene.add(reflection.target);
    // Petals, fireflies and contact shadows are not worth a second draw in the reflection.
    reflection.reflector.getVirtualCamera(camera).layers.set(0);

    const p = positionWorld.xz, t = uTime;
    let w = vec2(
      sin(p.x.mul(1.4).add(p.y.mul(0.73)).add(t.mul(1.25))).add(sin(p.y.mul(2.1).sub(t.mul(0.85))).mul(0.42)),
      cos(p.y.mul(1.25).sub(p.x.mul(0.54)).add(t.mul(0.93))).add(sin(p.x.mul(2.6).add(t)).mul(0.38)),
    ).mul(0.065);
    let rings = float(0);
    for (const R of ripples) {
      const d = distance(p, R.xy), age = t.sub(R.z);
      const live = step(0.0001, age).mul(step(age, 3.5));
      const k = d.sub(age.mul(2.4));
      const r = sin(d.mul(8).sub(age.mul(6))).mul(exp(k.mul(k).mul(-2.3))).mul(max(float(1).sub(age.div(3.5)), 0)).mul(R.w).mul(live);
      w = w.add(normalize(p.sub(R.xy).add(0.001)).mul(r).mul(0.065));
      rings = rings.add(abs(r));
    }
    const n = normalize(vec3(w.x, 1, w.y));
    const v = normalize(cameraPosition.sub(positionWorld));
    const fresnel = float(0.1).add(pow(float(1).sub(max(dot(v, n), 0)), 3).mul(0.75));
    reflection.uvNode = clamp(reflection.uvNode.add(w.mul(0.025)), 0.002, 0.998);
    let col = mix(vec3(0.014, 0.12, 0.16), reflection.rgb, fresnel);
    const edge = min(abs(p.x.sub(7)), abs(p.x.sub(17)));
    const foam = pow(max(sin(edge.mul(16).sub(t.mul(1.5)).add(p.y.mul(0.6))), 0), 10).mul(exp(edge.mul(-1.4))).add(rings.mul(0.4));
    col = col.add(vec3(0.02, 0.11, 0.12).mul(foam));

    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.18, metalness: 0.35 });
    m.colorNode = vec4(vertexColor().rgb, 1);
    m.normalNode = transformNormalToView(n);
    m.emissiveNode = col;
    // Only the lanterns light the water; the moon and sky reach it through the reflection.
    m.lightsNode = lights(points);
    waterMat = m;
    return m;
  }

  kit.onQuality((tier) => {
    if (reflection) reflection.reflector.resolutionScale = REFLECTION_SCALE[tier.name] ?? 0.5;
  });

  function shadowFlags(obj, def) {
    const lit = !(def.unlit || def.transparent || def.water);
    obj.castShadow = lit && !def.noShadow;
    obj.receiveShadow = lit;
  }

  /** A single static mesh. */
  function mesh(def, parent = scene) {
    const m = new THREE.Mesh(geometryFor(def), materialFor(def));
    shadowFlags(m, def);
    // The canal never draws into its own reflection (it would sample the texture it renders to).
    if (def.water) m.layers.set(LAYER_NO_REFLECT);
    parent.add(m);
    return m;
  }

  /**
   * Instanced copies of one model, rewritten when they change. begin(), push…(), end().
   * Frustum culling is off: instances move and the old renderer drew them all too.
   */
  function batch(def, capacity, parent = scene, { layer = 0 } = {}) {
    const m = new THREE.InstancedMesh(geometryFor(def), materialFor(def), Math.max(1, capacity));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.visible = false;
    m.frustumCulled = false;
    shadowFlags(m, def);
    if (layer) m.layers.set(layer);
    parent.add(m);
    const arr = m.instanceMatrix.array;
    return {
      mesh: m,
      array: arr,
      capacity: Math.max(1, capacity),
      n: 0,
      begin() { this.n = 0; },
      /** Translation, quaternion [x,y,z,w], uniform or per-axis scale. */
      push(x, y, z, q, sx = 1, sy = sx, sz = sx) {
        if (this.n >= this.capacity) return -1;
        writeTRS(arr, this.n * 16, x, y, z, q[0], q[1], q[2], q[3], sx, sy, sz);
        return this.n++;
      },
      pushMatrix(src) {
        if (this.n >= this.capacity) return -1;
        arr.set(src, this.n * 16);
        return this.n++;
      },
      end() {
        m.count = this.n;
        m.visible = this.n > 0;
        m.instanceMatrix.needsUpdate = true;
      },
      touch() { m.instanceMatrix.needsUpdate = true; },
    };
  }

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  // ---- post: bloom from the kit, then the old ACES curve, vignette and photo tilt-shift
  const uBoost = uniform(0), uPhoto = uniform(0);
  const post = createPost(kit, scene, camera, {
    bloom: { strength: 0.72, radius: 0.45, threshold: 0.78 },
    output: (node, ctx) => {
      let c = node.rgb;
      if (ctx.tier.post === 'full') {
        // Photo mode: a miniature tilt-shift, sharp across the middle of the frame.
        const blur = smoothstep(0.1, 0.48, abs(screenUV.y.sub(0.5))).mul(5).mul(uPhoto);
        const texel = vec2(1).div(screenSize);
        let sum = ctx.color.rgb;
        for (let i = 0; i < 8; i++) {
          const a = i * 2.399963, rr = 0.45 + i * 0.075;
          sum = sum.add(ctx.color.sample(screenUV.add(vec2(Math.cos(a) * rr, Math.sin(a) * rr).mul(texel).mul(blur))).rgb);
        }
        c = c.add(sum.div(9).sub(ctx.color.rgb).mul(uPhoto.mul(0.55)));
      }
      const x = c.mul(1.02);
      const mapped = clamp(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)), 0, 1);
      const d = screenUV.sub(0.5);
      const vig = float(1).sub(dot(d, d).mul(float(0.38).add(uBoost.mul(0.22))));
      return vec4(mapped.mul(pow(vig, 2.2)), 1);
    },
  });

  // ---- per frame
  const vp = new THREE.Matrix4();
  let shadowRadius = 0;
  /** Move the moon's shadow box to follow the player, snapped to the map's texels. */
  function placeMoon(cx, cz, radius) {
    const cam = moon.shadow.camera;
    if (radius !== shadowRadius) {
      shadowRadius = radius;
      cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
      cam.updateProjectionMatrix();
    }
    const snap = (radius * 2) / (moon.shadow.mapSize.x || 2048);
    const x = Math.floor(cx / snap) * snap, z = Math.floor(cz / snap) * snap;
    moon.target.position.set(x, 0, z);
    moon.position.set(x + moonDir[0] * 90, moonDir[1] * 90, z + moonDir[2] * 90);
    moon.target.updateMatrixWorld();
    moon.shadow.needsUpdate = true;
  }
  /** Point the twelve lanterns: list of { p:[x,y,z], c:[r,g,b], r } (fewer is fine). */
  function setPointLight(i, p, c, r) {
    const l = points[i];
    l.position.set(p[0], p[1], p[2]);
    l.color.setRGB(c[0], c[1], c[2]);
    l.distance = r;
    l.intensity = 1.2;
  }
  function clearPointLight(i) { points[i].intensity = 0; }

  function setRipple(i, x, z, t, s) { ripples[i].value.set(x, z, t, s); }

  function view(eye, look, time) {
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    uTime.value = time;
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }

  /** World point to CSS pixels, like the old project(): null when behind the camera. */
  function project(x, y, z, out) {
    const m = vp.elements;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.05) return null;
    const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    const py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out.x = (px * 0.5 + 0.5) * kit.size.width;
    out.y = (0.5 - py * 0.5) * kit.size.height;
    out.w = w;
    out.visible = px > -1.2 && px < 1.2 && py > -1.2 && py < 1.2;
    return out;
  }

  return {
    scene, camera, moon, points, uBoost, uPhoto, post,
    geometryFor, materialFor, mesh, batch, canvasTexture,
    placeMoon, setPointLight, clearPointLight, setRipple, view, project,
    render() { post.render(); },
  };
}
