/* IRONHOLD — the three.js side. It reproduces the original hand-written WebGL2
   renderer: flat-shaded vertex colours, a hemisphere ambient plus a warm sun with
   soft shadows (shadowed ground keeps 42 % of the sun), colours above 1.0 glowing
   through, a distance haze and the final 0.92 gamma. The fixed orthographic
   strategy camera and its screen <-> ground maths live here too. */

import * as THREE from 'three/webgpu';
import { attribute, instanceColor, vec3, vec4, float, step, max, pow, uniform, fog, smoothstep, distance, positionWorld, cameraPosition } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { Geo, models, ringModel, landscape, MODELS, color } from './gfx.js';
import { TYPES, TEAM, bounds } from './sim.js';

// The original wrote its shader colours straight to the screen (no sRGB encoding).
THREE.ColorManagement.enabled = false;

const FX_CAP = 90000; // vertices of per-frame effects
const RING_CAP = 24000; // vertices of per-frame selection and range rings
const CAP = { core: 4, wall: 264, gate: 8, soldier: 128, raider: 512, runner: 512, brute: 256, siege: 256, sapper: 256, juggernaut: 16 };
const BUILDABLE = ['gun', 'wall', 'mortar', 'arc', 'mine', 'generator', 'barracks', 'relay'];
const BOBBING = new Set(['raider', 'runner', 'sapper']);

const TEAM_RGB = TEAM.map((c) => color(c));
const TEAM_TINT = TEAM_RGB.map((c) => c.map((v) => 0.55 + v * 0.55));
const TEAM_SEL = TEAM_RGB.map((c) => c.map((v) => v * 1.2));
const TINT_BUILDING = [0.68, 0.92, 0.92];
const TINT_DAMAGED = [0.9, 0.68, 0.55];
const RING_SELECT = [0.4, 1.25, 1.13];
const RING_RANGE = [0.38, 0.78, 0.72];
const RING_CORE = [0.5, 1.05, 0.87];
const RING_REACH = [0.3, 0.62, 0.6];
const GHOST_OK = [0.6, 1.3, 1.15], GHOST_BAD = [1.6, 0.45, 0.35];
const FOOT_OK = [0.31, 0.76, 0.58], FOOT_BAD = [0.8, 0.3, 0.25];
const RANGE_OK = [0.34, 0.95, 0.72], RANGE_BAD = [1.1, 0.35, 0.25];
const FX_MORTAR = [1.5, 1.12, 0.45], FX_ARC1 = [0.48, 1.5, 1.5], FX_ARC2 = [0.55, 1.6, 1.5], FX_TRACER = [1.45, 1.24, 0.64];
const FX_SIEGE = [1.35, 0.47, 0.24], FX_DEATH = [1.2, 0.62, 0.24], FX_UNIT_DEATH = [0.55, 1.05, 0.9], FX_ORDER = [0.54, 1.1, 0.95], FX_ATTACK = [1.25, 0.62, 0.4];
const FX_STRIKE = [1.45, 0.45, 0.25], FX_STRIKE_IN = [1.35, 0.81, 0.43], FX_BOSS = [1.5, 0.35, 0.2];
const scratchA = [0, 0, 0], scratchB = [0, 0, 0];

function toGeometry(g, withNormals = true) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos.slice(0, g.n * 3), 3));
  if (withNormals) geo.setAttribute('normal', new THREE.BufferAttribute(g.nor.slice(0, g.n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(g.col.slice(0, g.n * 3), 3));
  geo.computeBoundingSphere();
  return geo;
}

export async function createView(kit) {
  const renderer = kit.renderer;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // The original cleared to (.43, .54, .51) without its .92 gamma; the post pass applies that
  // gamma to everything, so the clear colour is pre-inverted to land on the same value.
  const bg = [0.43, 0.54, 0.51].map((v) => Math.pow(v, 1 / 0.92));
  scene.background = new THREE.Color(bg[0], bg[1], bg[2]);
  // The original haze: up to 45 % toward a grey-green, from 285 to 600 m from the eye.
  scene.fogNode = fog(vec3(0.47, 0.58, 0.56), smoothstep(285, 600, distance(positionWorld, cameraPosition)).mul(0.45));

  // Lights in the original's units. three.js divides diffuse light by π, so intensities carry π.
  const hemi = new THREE.HemisphereLight();
  hemi.color.setRGB(0.72, 0.76, 0.7);
  hemi.groundColor.setRGB(0.39, 0.46, 0.44);
  hemi.intensity = Math.PI;
  const sun = new THREE.DirectionalLight();
  sun.color.setRGB(0.62, 0.53, 0.37);
  sun.intensity = Math.PI;
  sun.position.set(-170, 310, 118);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -215;
  sc.right = 215;
  sc.top = 215;
  sc.bottom = -215;
  sc.near = 1;
  sc.far = 650;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.25;
  sun.shadow.intensity = 0.58; // shadowed surfaces keep 42 % of the sun, like the original
  kit.shadow(sun, 2048);
  scene.add(hemi, sun, sun.target);

  /* ---- materials: one lit material per vertex layout, one unlit for rings and effects */

  const col = attribute('color', 'vec3');
  const glow = (c) => step(1.05, max(c.x, max(c.y, c.z))).mul(0.85);
  const ghostTint = uniform(new THREE.Color(...GHOST_OK));
  /** Lambert shading of vertex colours; colours above 1.05 mix 85 % toward their own value (the original glow). */
  function lit(kind) {
    const m = new THREE.MeshLambertNodeMaterial({ side: THREE.DoubleSide });
    const base = kind === 'instanced' ? col.mul(instanceColor) : kind === 'ghost' ? col.mul(ghostTint) : col;
    const k = glow(base);
    // Instanced meshes get their tint multiplied in by three.js, so only the vertex colour goes in here.
    m.colorNode = vec4((kind === 'instanced' ? col : base).mul(float(1).sub(k)), 1);
    m.emissiveNode = base.mul(k);
    return m;
  }
  const litStatic = lit('static');
  const litInst = lit('instanced');
  const ghostMat = lit('ghost');
  const unlit = new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });

  /* ---- instanced batches for every structure, head, soldier and enemy */

  function instanced(geo, mat, cap, cast) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.visible = false;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.cap = cap;
    m.userData.n = 0;
    scene.add(m);
    return m;
  }
  /** Write one instance: position, turn around y, scale, tint (null = white). Allocation-free. */
  function put(mesh, x, y, z, rot, sx, sy, sz, tint) {
    const i = mesh.userData.n;
    if (i >= mesh.userData.cap) return;
    mesh.userData.n = i + 1;
    const e = mesh.instanceMatrix.array, o = i * 16, c = Math.cos(rot), s = Math.sin(rot);
    e[o] = c * sx; e[o + 1] = 0; e[o + 2] = -s * sx; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = sy; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = s * sz; e[o + 9] = 0; e[o + 10] = c * sz; e[o + 11] = 0;
    e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
    const ca = mesh.instanceColor.array, p = i * 3;
    if (tint) {
      ca[p] = tint[0];
      ca[p + 1] = tint[1];
      ca[p + 2] = tint[2];
    } else ca[p] = ca[p + 1] = ca[p + 2] = 1;
  }
  function commit(mesh) {
    const n = mesh.userData.n;
    mesh.count = n;
    mesh.visible = n > 0;
    if (!n) return;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, n * 16);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, n * 3);
    mesh.instanceColor.needsUpdate = true;
  }

  const geos = {};
  const batch = {};
  for (const [key, g] of Object.entries(models())) {
    geos[key] = toGeometry(g);
    batch[key] = instanced(geos[key], litInst, CAP[key] || 104, true);
  }
  const batches = Object.values(batch);
  const unitRing = instanced(toGeometry(ringModel(1.35, 1.1, 16), false), unlit, 128, false);
  const selRing = instanced(toGeometry(ringModel(1.8, 1.47, 20), false), unlit, 128, false);
  unitRing.receiveShadow = selRing.receiveShadow = false;

  // Placement ghosts share the batch geometry, tinted green or red by one uniform.
  const ghosts = {};
  for (const type of BUILDABLE) {
    const g = new THREE.Mesh(geos[type], ghostMat);
    g.visible = false;
    g.castShadow = false;
    g.receiveShadow = true;
    scene.add(g);
    ghosts[type] = g;
  }
  let ghostShown = null;

  /* ---- per-frame rings and effects: fixed buffers, only the used part is uploaded */

  function dynamicMesh(cap) {
    const g = new Geo(cap, true);
    const geo = new THREE.BufferGeometry();
    const attrs = [['position', g.pos], ['color', g.col]].map(([name, arr]) => {
      const a = new THREE.BufferAttribute(arr, 3);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    });
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, unlit);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    return {
      g,
      mesh,
      commit() {
        const n = g.n;
        geo.setDrawRange(0, n);
        mesh.visible = n > 0;
        if (!n) return;
        for (const a of attrs) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * 3);
          a.needsUpdate = true;
        }
      },
    };
  }
  const rings = dynamicMesh(RING_CAP);
  const fxBuf = dynamicMesh(FX_CAP);

  /* ---- the battlefield: terrain, forest, rocks, seams, props; rebuilt when the operation changes */

  const shared = { tree: toGeometry(MODELS.tree()), rock: toGeometry(MODELS.rock()), rubble: toGeometry(MODELS.rubble()) };
  let land = [];
  let map = null;
  let miniBg = null;
  let treePoints = [];

  function staticMesh(g, cast) {
    const m = new THREE.Mesh(toGeometry(g), litStatic);
    m.castShadow = cast;
    m.receiveShadow = true;
    scene.add(m);
    land.push(m);
    return m;
  }
  function staticInstances(geo, list, cast) {
    const m = new THREE.InstancedMesh(geo, litInst, Math.max(1, list.length));
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 3).fill(1), 3);
    m.userData.cap = list.length;
    m.userData.n = 0;
    for (const q of list) put(m, q.x, q.y, q.z, q.rot || 0, q.sx ?? q.s ?? 1, q.sy ?? q.s ?? 1, q.sz ?? q.s ?? 1, q.tint || null);
    m.count = list.length;
    m.visible = list.length > 0;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    scene.add(m);
    land.push(m);
    return m;
  }

  function setMap(next) {
    if (map === next) return;
    map = next;
    for (const o of land) {
      scene.remove(o);
      if (!Object.values(shared).includes(o.geometry)) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    }
    land = [];
    const L = landscape(map);
    staticMesh(L.terrain, false);
    staticMesh(L.deposits, true);
    staticMesh(L.props, true);
    staticMesh(L.grass, false);
    staticInstances(shared.tree, L.trees, true);
    staticInstances(shared.rock, L.rocks, true);
    staticInstances(shared.rubble, L.rubble, true);
    treePoints = L.treePoints;
    miniBg = drawMiniBackground(map, L);
    positions.clear();
  }

  function drawMiniBackground(m, L) {
    const c = document.createElement('canvas');
    c.width = c.height = 384;
    const ctx = c.getContext('2d');
    const [r0, g0, b0] = L.groundColour;
    for (let z = 0; z < 384; z += 4) {
      for (let x = 0; x < 384; x += 4) {
        const b = Math.round(m.height(x - 192, z - 192) * 3);
        ctx.fillStyle = `rgb(${r0 + b},${g0 + b},${b0 + b})`;
        ctx.fillRect(x, z, 4, 4);
      }
    }
    ctx.strokeStyle = L.roadColour;
    ctx.lineWidth = m.id === 'blackpine' ? 16 : 10;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const line of m.roads) {
      ctx.beginPath();
      line.forEach(([x, z], i) => (i ? ctx.lineTo(x + 192, z + 192) : ctx.moveTo(x + 192, z + 192)));
      ctx.stroke();
    }
    ctx.fillStyle = L.baseColour;
    ctx.fillRect(144, 144, 96, 96);
    ctx.fillStyle = L.forest;
    for (const p of L.treePoints) {
      ctx.beginPath();
      ctx.arc(p.x + 192, p.z + 192, p.s * 2, 0, 6.28);
      ctx.fill();
    }
    ctx.fillStyle = L.rockColour;
    for (const p of m.rocks) {
      ctx.beginPath();
      ctx.arc(p.x + 192, p.z + 192, p.r, 0, 6.28);
      ctx.fill();
    }
    ctx.strokeStyle = '#c1baa3';
    ctx.lineWidth = 2;
    ctx.strokeRect(144, 144, 96, 96);
    return c;
  }

  /* ---- smoothing: the sim steps at 20 Hz, the view eases every unit toward it */

  const positions = new Map();
  let frame = 0;
  function smooth(id, x, z, a, time) {
    let p = positions.get(id);
    if (!p) {
      p = { x, z, a, t: time, f: frame };
      positions.set(id, p);
    }
    const dt = Math.min(0.1, Math.max(0.001, time - p.t)), v = 1 - Math.exp(-dt * 22);
    p.x += (x - p.x) * v;
    p.z += (z - p.z) * v;
    const da = ((a - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    p.a += da * v;
    p.t = time;
    p.f = frame;
    return p;
  }

  /* ---- the per-frame update */

  /**
   * s: the sim state; selected: Set of ids; build: placement preview or null;
   * fx: effect list ({type, start, life, ...event}).
   */
  function update(s, time, selected, build, fx) {
    frame++;
    const H = map.height;
    for (const m of batches) m.userData.n = 0;
    unitRing.userData.n = selRing.userData.n = 0;
    const rg = rings.g.reset();

    for (const b of s.buildings) {
      const y = H(b.x, b.z);
      const tint = b.progress < 1 ? TINT_BUILDING : b.hp / b.maxHp < 0.35 ? TINT_DAMAGED : null;
      const sy = 0.1 + 0.9 * b.progress;
      put(batch[b.type], b.x, y, b.z, (b.rot * Math.PI) / 2, 1, sy, 1, tint);
      const head = batch[b.type + 'Head'];
      if (head) put(head, b.x, y, b.z, b.angle || 0, 1, sy, 1, tint);
      if (selected.has(b.id)) {
        const q = TYPES[b.type];
        rg.ring(b.x, y + 0.2, b.z, q.r + 2, q.r + 1.65, 40, RING_SELECT);
        if (q.range) {
          const r = q.range + (b.level - 1) * 4;
          rg.ring(b.x, y + 0.12, b.z, r, r - 0.2, 96, RING_RANGE);
        }
        if (b.type === 'relay') rg.ring(b.x, y + 0.12, b.z, 18, 17.8, 64, RING_RANGE);
      }
      if (b.type === 'core') rg.ring(b.x, y + 0.97, b.z, 10.9, 10.7, 8, RING_CORE);
    }

    for (const u of s.units) {
      const moving = !!u.path?.length, p = smooth(u.id, u.x, u.z, u.angle, time), y = H(p.x, p.z);
      const team = u.owner & 3;
      put(batch.soldier, p.x, y + (moving ? Math.abs(Math.sin(time * 10 + u.id)) * 0.16 : 0), p.z, p.a, 1, 1, 1, TEAM_TINT[team]);
      if (selected.has(u.id)) put(selRing, p.x, y + 0.2, p.z, 0, 1, 1, 1, TEAM_SEL[team]);
      else put(unitRing, p.x, y + 0.15, p.z, 0, 1, 1, 1, TEAM_RGB[team]);
    }

    for (const e of s.enemies) {
      const p = smooth(e.id, e.x, e.z, e.angle, time), bob = BOBBING.has(e.type) ? 0.12 * Math.sin(time * 12 + e.id) : 0;
      const mesh = batch[e.type];
      if (mesh) put(mesh, p.x, H(p.x, p.z) + bob, p.z, p.a, 1, 1, 1, null);
      if (selected.has(e.id)) rg.ring(p.x, H(p.x, p.z) + 0.2, p.z, 2.4, 2.05, 20, FX_ATTACK);
    }
    if (positions.size > 1500) for (const [id, p] of positions) if (p.f !== frame) positions.delete(id);

    for (const m of batches) commit(m);
    commit(unitRing);
    commit(selRing);

    // Placement preview: ghost, footprint and range.
    const want = build ? ghosts[build.type] : null;
    if (ghostShown && ghostShown !== want) ghostShown.visible = false;
    ghostShown = want;
    if (build && want) {
      const y = H(build.x, build.z), q = TYPES[build.type];
      want.visible = true;
      want.position.set(build.x, y + 0.2, build.z);
      want.rotation.y = (build.rot * Math.PI) / 2;
      const t = build.valid ? GHOST_OK : GHOST_BAD;
      ghostTint.value.setRGB(t[0], t[1], t[2]);
      const range = q.range || (q.heal ? 18 : 0);
      if (range) rg.ring(build.x, y + 0.2, build.z, range, range - 0.28, 96, build.valid ? RANGE_OK : RANGE_BAD);
      if (build.type === 'relay') rg.ring(build.x, y + 0.2, build.z, 46, 45.75, 96, RING_REACH);
      const fb = bounds({ type: build.type, rot: build.rot });
      rg.box(build.x, y + 0.1, build.z, fb.w * 2 + 0.7, 0.12, fb.d * 2 + 0.7, build.valid ? FOOT_OK : FOOT_BAD);
    }
    rings.commit();

    const f = fxBuf.g.reset();
    for (const e of fx) {
      const age = time - e.start, life = e.life || 1, pct = age / life;
      if (pct < 0 || pct > 1) continue;
      const y = H(e.x, e.z);
      if (e.type === 'shot') {
        const ty = H(e.tx, e.tz);
        if (e.kind === 'mortar') {
          const x = e.x + (e.tx - e.x) * pct, z = e.z + (e.tz - e.z) * pct, h = y + 5 + (ty - y) * pct + Math.sin(pct * Math.PI) * 23;
          f.octa(x, h, z, 0.55, 1.1, FX_MORTAR);
        } else if (e.kind === 'arc') {
          const ax = e.x, ay = y + 6, az = e.z, bx = e.tx, by = ty + 1.5, bz = e.tz;
          const mx = (ax + bx) * 0.5 + Math.sin(age * 90) * 1.8, my = (ay + by) * 0.5 + 2, mz = (az + bz) * 0.5;
          f.beam6(ax, ay, az, mx, my, mz, 0.14, FX_ARC1);
          f.beam6(mx, my, mz, bx, by, bz, 0.12, FX_ARC2);
        } else {
          const p0 = Math.max(0, pct - 0.3), p1 = Math.min(1, pct + 0.25);
          f.beam6(
            e.x + (e.tx - e.x) * p0, y + 2.9 + (ty - y - 1) * p0, e.z + (e.tz - e.z) * p0,
            e.x + (e.tx - e.x) * p1, y + 2.9 + (ty - y - 1) * p1, e.z + (e.tz - e.z) * p1,
            e.kind === 'rifle' ? 0.07 : 0.13, FX_TRACER
          );
        }
      } else if (e.type === 'enemyShot' && (e.kind === 'siege' || e.kind === 'juggernaut')) {
        f.beam6(e.x, y + 5, e.z, e.tx, H(e.tx, e.tz) + 2, e.tz, e.kind === 'juggernaut' ? 0.2 : 0.12, FX_SIEGE);
      } else if (e.type === 'blast' || e.type === 'destroy') {
        const r = (e.r || 5) * (0.1 + pct);
        scratchA[0] = 1.25 * (1 - pct) + 0.2;
        scratchA[1] = 0.72 * (1 - pct) + 0.15;
        scratchA[2] = 0.26;
        f.ring(e.x, y + 0.2, e.z, r, Math.max(0.1, r - 0.6 * (1 - pct)), 40, scratchA);
        scratchB[0] = 1.4;
        scratchB[1] = 0.7 + 0.3 * (1 - pct);
        scratchB[2] = 0.2;
        for (let i = 0; i < 6; i++) {
          const a = i * 2.399, r2 = r * 0.6, sz = (1 - pct) * 1.4;
          f.octa(e.x + Math.sin(a) * r2, y + Math.sin(pct * Math.PI) * 5 + sz, e.z + Math.cos(a) * r2, sz, sz * 2, scratchB);
        }
      } else if (e.type === 'death') {
        const sz = (1 - pct) * (e.kind === 'juggernaut' ? 3 : 0.8);
        f.octa(e.x, y + 0.6 + (e.kind === 'juggernaut' ? 2 : 0), e.z, sz, 1.5 * sz, FX_DEATH);
      } else if (e.type === 'unitDeath') {
        const sz = (1 - pct) * 0.7;
        f.octa(e.x, y + 0.6, e.z, sz, 1.5 * sz, FX_UNIT_DEATH);
      } else if (e.type === 'strikeMark') {
        f.ring(e.x, y + 0.24, e.z, 13, 12.65, 64, FX_STRIKE);
        f.ring(e.x, y + 0.28, e.z, 13 * (1 - pct), Math.max(0.1, 13 * (1 - pct) - 0.35), 64, FX_STRIKE_IN);
      } else if (e.type === 'boss') {
        const r = 4 + pct * 16;
        f.ring(e.x, y + 0.3, e.z, r, r - 0.5, 48, FX_BOSS);
        f.beam6(e.x, y, e.z, e.x, y + 30 * (1 - pct), e.z, 0.35, FX_BOSS);
      } else if (e.type === 'move' || e.type === 'ping' || e.type === 'build' || e.type === 'repair' || e.type === 'upgrade') {
        const co = e.type === 'ping' ? TEAM_RGB[(e.pid || 0) & 3] : e.attack ? FX_ATTACK : FX_ORDER;
        const r = (e.type === 'ping' ? 4 : 2) + pct * 5;
        f.ring(e.x, y + 0.18, e.z, r, r - 0.25, 32, co);
        if (e.type === 'ping') f.beam6(e.x, y, e.z, e.x, y + 15 * (1 - pct), e.z, 0.15, co);
      }
    }
    fxBuf.commit();
  }

  /* ---- camera: the original fixed-pitch orthographic view, panned, turned and zoomed */

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 850);
  const eye = new THREE.Vector3(), target = new THREE.Vector3();
  const AX = new THREE.Vector3(), AY = new THREE.Vector3(), AZ = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let W = 1, Hs = 1, halfW = 1, halfH = 1, shake = 0;
  kit.onResize((w, h) => {
    W = w;
    Hs = h;
  });

  function setCamera(cam, dt = 0) {
    shake = Math.max(0, shake - dt * 2.2);
    const sx = shake > 0 ? Math.sin(performance.now() * 0.061) * shake * 1.6 : 0;
    const sz = shake > 0 ? Math.cos(performance.now() * 0.047) * shake * 1.2 : 0;
    eye.set(cam.x + sx + Math.sin(cam.yaw) * 240, 275, cam.z + sz + Math.cos(cam.yaw) * 240);
    target.set(cam.x + sx, 0, cam.z + sz);
    AZ.subVectors(eye, target).normalize();
    AX.crossVectors(UP, AZ).normalize();
    AY.crossVectors(AZ, AX);
    halfH = cam.zoom / 2;
    halfW = (halfH * W) / Hs;
    if (camera.top !== halfH || camera.right !== halfW) {
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(eye);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  /** World point → CSS pixels, written into out {x, y}. */
  function project(x, y, z, out) {
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z;
    const vx = dx * AX.x + dy * AX.y + dz * AX.z, vy = dx * AY.x + dy * AY.y + dz * AY.z;
    out.x = ((vx / halfW) * 0.5 + 0.5) * W;
    out.y = (-(vy / halfH) * 0.5 + 0.5) * Hs;
    return out;
  }
  /** CSS pixels → the view ray from the near plane (a) to the far plane (b). */
  function ray(sx, sy, out) {
    const nx = (sx / W) * 2 - 1, ny = 1 - (sy / Hs) * 2;
    const ox = eye.x + AX.x * nx * halfW + AY.x * ny * halfH;
    const oy = eye.y + AX.y * nx * halfW + AY.y * ny * halfH;
    const oz = eye.z + AX.z * nx * halfW + AY.z * ny * halfH;
    out.a[0] = ox - AZ.x;
    out.a[1] = oy - AZ.y;
    out.a[2] = oz - AZ.z;
    out.b[0] = ox - AZ.x * 850;
    out.b[1] = oy - AZ.y * 850;
    out.b[2] = oz - AZ.z * 850;
    return out;
  }
  const groundRay = { a: [0, 0, 0], b: [0, 0, 0] };
  /** CSS pixels → the terrain point under them, written into out {x, z}. */
  function ground(sx, sy, out) {
    const { a, b } = ray(sx, sy, groundRay);
    let t = -a[1] / (b[1] - a[1]);
    let x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
    for (let i = 0; i < 3; i++) {
      t = (map.height(x, z) - a[1]) / (b[1] - a[1]);
      x = a[0] + (b[0] - a[0]) * t;
      z = a[2] + (b[2] - a[2]) * t;
    }
    out.x = x;
    out.z = z;
    return out;
  }

  /* ---- output: the original's final 0.92 gamma, after FXAA/MSAA from the kit */

  const post = createPost(kit, scene, camera, {
    output: (c) => vec4(pow(max(vec3(c.rgb), vec3(0)), vec3(0.92)), 1),
  });

  /** Compile every pipeline up front so the first mortar or ghost does not stutter. */
  async function warm() {
    const toggled = [...batches, unitRing, selRing, ...Object.values(ghosts), rings.mesh, fxBuf.mesh];
    const was = toggled.map((m) => [m.visible, m.count]);
    for (const m of toggled) {
      m.visible = true;
      if (m.isInstancedMesh) m.count = Math.max(1, m.count);
    }
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      /* compiling ahead is only an optimisation */
    }
    toggled.forEach((m, i) => {
      m.visible = was[i][0];
      if (m.isInstancedMesh) m.count = was[i][1];
    });
  }

  return {
    scene,
    camera,
    setMap,
    update,
    setCamera,
    project,
    ray,
    ground,
    warm,
    render() {
      post.render();
    },
    shake(v) {
      shake = Math.min(1.4, Math.max(shake, v));
    },
    /** Forget eased positions: a new or loaded mission reuses ids from 1. */
    clearSmoothing() {
      positions.clear();
      shake = 0;
    },
    get miniBg() {
      return miniBg;
    },
    get treePoints() {
      return treePoints;
    },
    get map() {
      return map;
    },
    get width() {
      return W;
    },
    get height() {
      return Hs;
    },
  };
}
