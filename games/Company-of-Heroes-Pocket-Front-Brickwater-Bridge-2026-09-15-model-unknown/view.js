/* Pocket Front — the three.js side.
   Materials that reproduce the original toy shading (hemisphere + warm sun, soft 32 % shadows,
   height AO, a small plastic highlight, glow, animated water, a light fog), the diorama meshes,
   posed soldiers and tanks, per-frame effects, the tilt-shift post pass and the fixed
   isometric orthographic camera with its screen <-> ground maths. */

import * as THREE from 'three/webgpu';
import { attribute, positionWorld, smoothstep, mix, vec2, vec3, vec4, float, uniform, sin, pow, max, min, abs, length, normalize, cameraPosition, normalWorld, dot, clamp, Fn, uv, screenSize, fog, distance } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { Geo, lerp, INFANTRY, legModel, upperModel, gunModel, downModel, tankModel, sailModel, coverModel, flagDynamic } from './models.js';

const LIGHT = new THREE.Vector3(-0.55, 1, -0.45).normalize();
const EYE = new THREE.Vector3(27, 43, 38);
const FX_CAPACITY = 48000;

/* ------------------------------------------------------------------ colour helpers */

// The original tone curve: Narkowicz ACES on colour × 1.18. The post pass applies it.
function acesJs(x) {
  x *= 1.18;
  return Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
}
/** A display colour (0..1 sRGB) → the linear scene value that the tone curve turns back into it. */
function sceneColor(r, g, b) {
  const solve = (d) => {
    const target = d <= 0.04045 ? d / 12.92 : Math.pow((d + 0.055) / 1.055, 2.4);
    let lo = 0, hi = 4;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (acesJs(m) < target) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  return new THREE.Color().setRGB(solve(r), solve(g), solve(b), THREE.LinearSRGBColorSpace);
}

/* ------------------------------------------------------------------ geometry helpers */

function makeGeometry(pos, nor, col, emi) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('emit', new THREE.BufferAttribute(emi, 1));
  geo.computeBoundingSphere();
  return geo;
}
/** A finished Geo → a static BufferGeometry (copies only the used part). */
function toGeometry(g) {
  const n = g.n;
  return makeGeometry(g.pos.slice(0, n * 3), g.nor.slice(0, n * 3), g.col.slice(0, n * 3), g.emi.slice(0, n));
}
/** Split a map build into solid triangles and water triangles (emit 2 marks water). */
function splitWater(g) {
  const n = g.n;
  let water = 0;
  for (let i = 0; i < n; i += 3) if (g.emi[i] > 1.5) water += 3;
  const make = (count, wantWater) => {
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), emi = new Float32Array(count);
    let o = 0;
    for (let i = 0; i < n; i += 3) {
      if (g.emi[i] > 1.5 !== wantWater) continue;
      pos.set(g.pos.subarray(i * 3, i * 3 + 9), o * 3);
      nor.set(g.nor.subarray(i * 3, i * 3 + 9), o * 3);
      col.set(g.col.subarray(i * 3, i * 3 + 9), o * 3);
      emi.set(g.emi.subarray(i, i + 3), o);
      o += 3;
    }
    return makeGeometry(pos, nor, col, emi);
  };
  return { solid: make(n - water, false), water: water ? make(water, true) : null };
}

/* ------------------------------------------------------------------ the view */

export async function createView(kit) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.NoToneMapping; // the post pass applies the original tone curve
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = sceneColor(0.72, 0.81, 0.74);
  // The original fog: at most 10 %, by distance from the eye, toward a pale sage.
  const fogColor = sceneColor(0.78, 0.86, 0.81);
  scene.fogNode = fog(vec3(fogColor.r, fogColor.g, fogColor.b), smoothstep(45, 120, distance(positionWorld, cameraPosition)).mul(0.1));

  // Lights in the original's units: hemisphere sky/ground × 0.72, a warm sun × (1.2, 1.07, 0.85).
  // three.js divides diffuse light by π, so intensities carry π to land on the same numbers.
  const hemi = new THREE.HemisphereLight();
  hemi.color.setRGB(0.52 * 0.72, 0.61 * 0.72, 0.69 * 0.72, THREE.LinearSRGBColorSpace);
  hemi.groundColor.setRGB(0.25 * 0.72, 0.31 * 0.72, 0.26 * 0.72, THREE.LinearSRGBColorSpace);
  hemi.intensity = Math.PI;
  const sun = new THREE.DirectionalLight();
  sun.color.setRGB(1, 1.07 / 1.2, 0.85 / 1.2, THREE.LinearSRGBColorSpace);
  sun.intensity = 1.2 * Math.PI;
  sun.position.copy(LIGHT).multiplyScalar(65);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -37;
  sc.right = 37;
  sc.top = 32;
  sc.bottom = -32;
  sc.near = 0.1;
  sc.far = 135;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.intensity = 0.68; // shadowed ground keeps 32 % of the sun, like the original
  kit.shadow(sun, 2048);
  scene.add(hemi, sun, sun.target);

  /* ---- materials */

  // Toy plastic: vertex colours, height AO (darker near the board), glow blend, a small highlight.
  const emit = min(attribute('emit', 'float'), 1);
  const ao = mix(float(0.8), float(1), smoothstep(0, 2.6, positionWorld.y));
  const toy = new THREE.MeshPhongNodeMaterial({ vertexColors: true, shininess: 42 });
  toy.specular.setRGB(0.027, 0.027, 0.027, THREE.LinearSRGBColorSpace);
  toy.colorNode = vec4(vec3(ao.mul(float(1).sub(emit))), 1);
  toy.emissiveNode = attribute('color', 'vec3').mul(emit.mul(1.55));

  // Water: the original's slow double-sine ripple with bright glints, unlit.
  const uTime = uniform(0);
  const wp = positionWorld;
  const waves = sin(wp.x.mul(3.4).add(uTime.mul(1.6)).add(sin(wp.z.mul(0.9)))).mul(sin(wp.z.mul(2.1).sub(uTime.mul(0.9))));
  const half = normalize(vec3(LIGHT.x, LIGHT.y, LIGHT.z).add(normalize(cameraPosition.sub(wp))));
  const glint = pow(max(dot(normalWorld, half), 0), 42).mul(0.14 * 0.85);
  const waterMat = new THREE.MeshBasicNodeMaterial();
  waterMat.colorNode = vec4(
    attribute('color', 'vec3').mul(waves.mul(0.1).add(0.8)).add(vec3(0.4, 0.68, 0.68).mul(pow(max(waves, 0), 9).mul(0.18))).add(vec3(1, 0.9, 0.72).mul(glint)),
    1
  );

  const mk = (geo) => {
    const m = new THREE.Mesh(geo, toy);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /* ---- templates built once: every soldier and tank shares these geometries */

  const T = {};
  const build = (key, fn) => {
    const g = new Geo(2048);
    fn(g);
    T[key] = toGeometry(g);
  };
  for (const team of [0, 1]) {
    build(`leg${team}`, (g) => legModel(g, team));
    build(`down${team}`, (g) => downModel(g, team));
    build(`tank${team}`, (g) => tankModel(g, team));
    for (const type of INFANTRY) build(`up-${type}-${team}`, (g) => upperModel(g, type, team));
  }
  for (const type of INFANTRY) {
    const g = new Geo(512);
    if (gunModel(g, type)) T[`gun-${type}`] = toGeometry(g);
  }
  build('flash', (g) => g.sphere(0, 0, 0, 1, '#ffda77', 5, 3, 1, 0.9));
  build('tankFlash', (g) => g.sphere(0, 0, 0, 1, '#ffdc83', 7, 3, 1, 0.95));
  build('selRing', (g) => g.ring(0, 0, 0, 0.76, 0.085, '#ffde7a', 0.8, 28));
  build('tankRing', (g) => g.ring(0, 0, 0, 1.53, 0.1, '#ffe18b', 0.8, 32));
  build('coverArc', (g) => g.ring(0, 0, 0, 0.89, 0.045, '#a8e1ab', 0.65, 20, 0, Math.PI));
  build('sail', sailModel);

  /* ---- posed units */

  class UnitView {
    constructor(u) {
      this.root = new THREE.Group();
      this.body = new THREE.Group();
      this.root.add(this.body);
      this.tank = u.type === 'tank';
      if (this.tank) {
        this.hull = mk(T[`tank${u.team}`]);
        this.hull.position.y = 0.13;
        this.flash = mk(T.tankFlash);
        this.flash.position.set(0, 1.55, 2.05);
        this.flash.scale.setScalar(0.4);
        this.body.add(this.hull, this.flash);
        this.sel = mk(T.tankRing);
        this.sel.position.y = 0.18;
        this.root.add(this.sel);
      } else {
        this.stand = new THREE.Group();
        this.stand.scale.setScalar(1.2);
        this.legL = mk(T[`leg${u.team}`]);
        this.legR = mk(T[`leg${u.team}`]);
        this.upper = mk(T[`up-${u.type}-${u.team}`]);
        this.gun = T[`gun-${u.type}`] ? mk(T[`gun-${u.type}`]) : null;
        this.flash = mk(T.flash);
        this.flash.castShadow = false;
        this.stand.add(this.legL, this.legR, this.upper, this.flash);
        if (this.gun) this.stand.add(this.gun);
        this.down = mk(T[`down${u.team}`]);
        this.down.position.y = 0.14;
        this.body.add(this.stand, this.down);
        this.sel = mk(T.selRing);
        this.sel.position.y = 0.16;
        this.coverArc = mk(T.coverArc);
        this.coverArc.position.y = 0.17;
        this.root.add(this.sel, this.coverArc);
      }
      this.flash.visible = false;
      scene.add(this.root);
    }
    update(u, t, selected) {
      const shown = u.state === 'alive' || u.state === 'down';
      this.root.visible = shown;
      if (!shown) return;
      this.root.position.set(u.x, 0, u.z);
      this.body.rotation.y = u.angle || 0;
      if (this.tank) {
        this.sel.visible = selected;
        this.flash.visible = u.flash > 0;
        return;
      }
      const down = u.state === 'down';
      const walk = u.moving && !down ? Math.sin(t * 11 + u.id) : 0;
      this.stand.visible = !down;
      this.down.visible = down;
      this.sel.visible = selected && !down;
      this.coverArc.visible = !down && u.cover;
      if (down) return;
      this.stand.position.y = 0.18 + Math.abs(walk) * 0.06;
      const bodyY = u.suppression > 0.75 ? 0.14 : 0;
      this.legL.position.set(-0.19, Math.max(0, -walk) * 0.08, -walk * 0.14);
      this.legR.position.set(0.19, Math.max(0, walk) * 0.08, walk * 0.14);
      this.upper.position.y = -bodyY;
      if (this.gun) this.gun.position.set(0, -bodyY, -(u.flash || 0) * 0.8);
      this.flash.visible = u.flash > 0;
      if (u.flash > 0) {
        this.flash.position.set(0.32, 0.87 - bodyY, 1.16);
        this.flash.scale.setScalar(0.16 + u.flash * 0.7);
      }
    }
    dispose() {
      scene.remove(this.root);
    }
  }
  const units = new Map();

  /* ---- level: static diorama, water, sandbags, windmill sails */

  let levelObjects = [];
  let coverViews = [];
  let sails = null;

  function clearLevel() {
    for (const o of levelObjects) {
      scene.remove(o);
      o.traverse((m) => {
        if (m.isMesh && m.geometry && !Object.values(T).includes(m.geometry)) m.geometry.dispose();
      });
    }
    levelObjects = [];
    coverViews = [];
    sails = null;
  }

  function loadLevel(level, covers) {
    clearLevel();
    const g = new Geo(1 << 17);
    level.build(g, level);
    const { solid, water } = splitWater(g);
    const ground = mk(solid);
    scene.add(ground);
    levelObjects.push(ground);
    if (water) {
      const w = new THREE.Mesh(water, waterMat);
      w.receiveShadow = false;
      scene.add(w);
      levelObjects.push(w);
    }
    for (const c of covers) {
      const a = new Geo(1024), b = new Geo(128);
      coverModel(a, c, false);
      coverModel(b, c, true);
      const intact = mk(toGeometry(a)), rubble = mk(toGeometry(b));
      rubble.visible = false;
      scene.add(intact, rubble);
      levelObjects.push(intact, rubble);
      coverViews.push({ intact, rubble });
    }
    if (level.sails) {
      sails = new THREE.Group();
      sails.position.set(level.sails.x, level.sails.y, level.sails.z);
      for (let k = 0; k < 4; k++) {
        const m = mk(T.sail);
        m.rotation.z = (k * Math.PI) / 2;
        sails.add(m);
      }
      scene.add(sails);
      levelObjects.push(sails);
    }
  }

  function syncCovers(covers) {
    for (let i = 0; i < coverViews.length && i < covers.length; i++) {
      const broken = covers[i].hp <= 0;
      coverViews[i].intact.visible = !broken;
      coverViews[i].rubble.visible = broken;
    }
  }

  function clearUnits() {
    for (const v of units.values()) v.dispose();
    units.clear();
  }

  /* ---- per-frame effects: flags, orders, shots, smoke, aid drops, rings, leaves */

  const fxGeo = new Geo(FX_CAPACITY, false);
  const fxGeometry = new THREE.BufferGeometry();
  const fxAttrs = [
    ['position', fxGeo.pos, 3],
    ['normal', fxGeo.nor, 3],
    ['color', fxGeo.col, 3],
    ['emit', fxGeo.emi, 1],
  ].map(([name, arr, k]) => {
    const a = new THREE.BufferAttribute(arr, k);
    a.setUsage(THREE.DynamicDrawUsage);
    fxGeometry.setAttribute(name, a);
    return a;
  });
  fxGeometry.setDrawRange(0, 0);
  const fxMesh = mk(fxGeometry);
  fxMesh.frustumCulled = false;
  scene.add(fxMesh);

  function commitFx() {
    const n = fxGeo.n;
    fxGeometry.setDrawRange(0, n);
    fxMesh.visible = n > 0;
    if (!n) return;
    for (const a of fxAttrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  function buildFx(s) {
    const g = fxGeo.reset();
    const { game, time: t, selected, preview } = s;
    for (const p of game.points) flagDynamic(g, p, t);
    if (s.showSelection) {
      for (const u of game.units) {
        if (!selected.has(u.id) || u.team !== 0 || !u.path.length || u.state !== 'alive') continue;
        let ax = u.x, az = u.z;
        for (const p of u.path) {
          const d = Math.hypot(p.x - ax, p.z - az), n = Math.ceil(d / 0.5);
          for (let i = 0; i < n; i += 2) {
            const k = i / n, k2 = Math.min(1, (i + 0.65) / n);
            g.line(lerp(ax, p.x, k), 0.19, lerp(az, p.z, k), lerp(ax, p.x, k2), 0.19, lerp(az, p.z, k2), 0.025, '#fce3a1', 0.7);
          }
          ax = p.x;
          az = p.z;
        }
        const end = u.path[u.path.length - 1];
        g.ring(end.x, 0.18, end.z, 0.27, 0.065, '#ffe0a0', 0.8, 14);
      }
    }
    for (const p of game.projectiles) {
      g.sphere(p.x, p.y, p.z, p.type === 'rocket' ? 0.12 : 0.19, p.type === 'smoke' ? '#dce5c4' : '#e3b353', 7, 4, 1, 0.1);
      if (p.type === 'rocket') g.sphere(p.x, p.y, p.z, 0.095, '#ffe28b', 6, 3, 1, 0.95);
    }
    for (const p of game.tracers) g.line(p.x, p.y, p.z, p.tx, 0.9, p.tz, 0.025, '#fff0a7', 1);
    for (const p of game.particles) g.box(p.x, p.y, p.z, p.s, p.s, p.s, p.col, p.a, 0.05);
    for (const p of game.bursts) {
      const k = 1 - p.t / p.life;
      g.sphere(p.x, 0.3 + k * 0.6, p.z, 0.18 + Math.sin(k * Math.PI) * p.r * 0.48, '#fbd18a', 9, 4, 0.75, 0.9);
      g.ring(p.x, 0.16, p.z, 0.3 + k * p.r, 0.14 * (1 - k), '#ffe3a3', 0.7, 30);
    }
    for (const sm of game.smokes) {
      const age = sm.life - sm.t, scale = Math.min(1, age / 0.8, sm.t / 1.4);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + sm.phase;
        g.sphere(sm.x + Math.cos(a) * sm.r * 0.42, 0.6 + (i % 3) * 0.56, sm.z + Math.sin(a) * sm.r * 0.42, scale * (1.3 + Math.sin(t + i) * 0.07), i % 2 ? '#e5e6d8' : '#d5ddd0', 8, 5, 0.8);
      }
    }
    for (const a of game.aids) {
      g.ring(a.x, 0.2, a.z, 3.8, 0.08, '#afec9d', 0.7, 40);
      const y = Math.max(0.35, (a.t - (a.life - 1)) * 10);
      g.box(a.x, y, a.z, 0.7, 0.6, 0.65, '#e8e8c8');
      g.box(a.x, y + 0.31, a.z, 0.13, 0.03, 0.42, '#c77250');
      g.box(a.x, y + 0.31, a.z, 0.42, 0.03, 0.13, '#c77250');
      if (y > 1) {
        g.sphere(a.x, y + 2, a.z, 1.3, '#e4e4c8', 8, 4, 0.42);
        g.box(a.x - 0.6, y + 1, a.z, 0.03, 1.8, 0.03, '#adb49a');
        g.box(a.x + 0.6, y + 1, a.z, 0.03, 1.8, 0.03, '#adb49a');
      }
    }
    for (const r of game.rings) {
      const k = 1 - r.t / r.life, rad = r.r || 0.3 + k * 1.1;
      g.ring(r.x, 0.2, r.z, rad, Math.max(0.015, 0.08 * (1 - k)), r.col, 0.6, 32);
    }
    if (preview) {
      g.ring(preview.x, 0.23, preview.z, preview.radius, 0.1, preview.valid ? '#ffe59d' : '#ef8a73', 0.8, 40);
      if (preview.caster && preview.range < 50) {
        for (let k = 0; k < 32; k++) {
          const ang = (k * Math.PI) / 16;
          g.ring(preview.caster.x, 0.15, preview.caster.z, preview.range, 0.025, '#f8e3aa', 0.5, 2, ang, ang + 0.1);
        }
      }
    }
    // A few tiny wind-blown leaves give the diorama quiet motion.
    for (let i = 0; i < 9; i++) {
      const x = Math.sin(t * 0.1 + i * 4.3) * 19, z = Math.cos(t * 0.085 + i * 3.7) * 13, y = 3.5 + Math.sin(t * 0.3 + i) * 1.5;
      g.box(x, y, z, 0.06, 0.015, 0.18, '#d1d69c', t * 0.6 + i);
    }
    commitFx();
  }

  /* ---- camera: the original fixed isometric view, orthographic, panned and zoomed */

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 170);
  const cam = { x: 0, z: 0, zoom: 1, half: 23 };
  const ZA = EYE.clone().normalize();
  const XA = new THREE.Vector3(0, 1, 0).cross(ZA).normalize();
  const YA = ZA.clone().cross(XA);
  const eye = new THREE.Vector3();
  const target = new THREE.Vector3();
  let W = 1, H = 1, hh = 23, hw = 23, shake = 0;

  function updateCamera() {
    const x = cam.x + Math.sin(performance.now() * 0.047) * shake, z = cam.z;
    eye.set(x + EYE.x, EYE.y, z + EYE.z);
    hh = cam.half / cam.zoom;
    hw = (hh * W) / H;
    if (camera.top !== hh || camera.right !== hw) {
      camera.left = -hw;
      camera.right = hw;
      camera.top = hh;
      camera.bottom = -hh;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(eye);
    target.set(x, 0, z);
    camera.lookAt(target);
  }

  const projected = [0, 0, 0];
  /** World point → CSS pixels [x, y, depth]. Reuses one array unless `out` is given. */
  function project(x, y, z, out = projected) {
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z;
    const vx = dx * XA.x + dy * XA.y + dz * XA.z;
    const vy = dx * YA.x + dy * YA.y + dz * YA.z;
    const vz = dx * ZA.x + dy * ZA.y + dz * ZA.z;
    out[0] = ((vx / hw) * 0.5 + 0.5) * W;
    out[1] = (-(vy / hh) * 0.5 + 0.5) * H;
    out[2] = -vz;
    return out;
  }
  /** CSS pixels → the point on the board (y = 0.06) under them. */
  function unproject(sx, sy, out = { x: 0, z: 0 }) {
    const nx = (sx / W) * 2 - 1, ny = 1 - (sy / H) * 2;
    const px = eye.x + XA.x * nx * hw + YA.x * ny * hh;
    const py = eye.y + XA.y * nx * hw + YA.y * ny * hh;
    const pz = eye.z + XA.z * nx * hw + YA.z * ny * hh;
    const t = (py - 0.06) / ZA.y;
    out.x = px - ZA.x * t;
    out.z = pz - ZA.z * t;
    return out;
  }

  kit.onResize((w, h) => {
    W = w;
    H = h;
    updateCamera();
  });

  /* ---- post: the original's tilt-shift edges, faint glow and vignette, after its tone curve */

  const uFx = uniform(1);
  const acesFit = Fn(([x]) => {
    const a = x.mul(x.mul(2.51).add(0.03));
    const b = x.mul(x.mul(2.43).add(0.59)).add(0.14);
    return clamp(a.div(b), 0, 1);
  });
  const post = createPost(kit, scene, camera, {
    output: (node, { color: tex }) => {
      const tone = (c) => acesFit(vec3(c.rgb).mul(1.18));
      const u0 = tex.uvNode || uv();
      const px = vec2(1).div(screenSize);
      const ox = px.mul(vec2(1.2, 0)), oy = px.mul(vec2(0, 1.2));
      const base = tone(node);
      const soft = tone(tex.sample(u0.add(ox))).add(tone(tex.sample(u0.sub(ox)))).add(tone(tex.sample(u0.add(oy)))).add(tone(tex.sample(u0.sub(oy)))).mul(0.25);
      const band = pow(abs(u0.y.sub(0.5)).mul(2), 4).mul(uFx);
      const glow = max(soft.sub(0.646), 0).mul(0.1).mul(uFx);
      const vignette = pow(float(1).sub(pow(length(u0.sub(0.5).mul(vec2(1, 0.8))), 1.8).mul(0.12)), 2.2);
      return vec4(mix(base, soft, min(band, 0.75)).add(glow).mul(vignette), 1);
    },
  });

  /* ---- api */

  return {
    scene,
    camera,
    cam,
    get width() {
      return W;
    },
    get height() {
      return H;
    },
    project,
    unproject,
    updateCamera,
    loadLevel,
    syncCovers,
    clearUnits,
    setShake(v) {
      shake = v;
    },
    setEffects(on) {
      uFx.value = on ? 1 : 0;
    },
    /** Pose everything for this frame. */
    update(s) {
      uTime.value = s.time;
      for (const u of s.game.units) {
        let v = units.get(u.id);
        if (!v) {
          v = new UnitView(u);
          units.set(u.id, v);
        }
        v.update(u, s.time, s.showSelection && s.selected.has(u.id));
      }
      if (sails) sails.rotation.z = -s.time * 0.55;
      buildFx(s);
    },
    render() {
      updateCamera();
      post.render();
    },
    async warm() {
      try {
        updateCamera();
        await renderer.compileAsync(scene, camera);
      } catch {
        /* warming is optional */
      }
    },
  };
}
