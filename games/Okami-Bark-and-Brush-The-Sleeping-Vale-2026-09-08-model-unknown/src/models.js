/* Bark & Brush — Mallow, Pip, the ink masks, the ink crows and the river bridge.

   The original drew these every frame from ellipsoids (three-tone faces inside
   an ink hull), outlined thick lines and flat polygons. The same shapes are
   built once here as meshes in the model's local space (x right, y up, z
   forward, exactly the original's wLocal frame, which is three.js's Y
   rotation), and only the moving parts (legs, tail, strike arc) are rewritten
   per frame. */

import * as THREE from 'three/webgpu';
import { InkBuilder, DynTube, inkMaterials, uniform } from './scene.js';

const CREAM = '#f2e8ca';
const BRIGHT = '#fff3d9';
const TEAL = '#477e72';

/** Mix two '#rrggbb' colours in sRGB, like the original's mix(). */
export function mixHex(a, b, t) {
  const A = parseInt(a.slice(1, 7), 16);
  const B = parseInt(b.slice(1, 7), 16);
  const ch = (s) => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Move points that sit inside an ellipsoid out to its skin, so painted flaps stay visible in 3D. */
function pushOut(points, c, r, k = 1.05) {
  return points.map(([x, y, z]) => {
    const dx = (x - c[0]) / r[0];
    const dy = (y - c[1]) / r[1];
    const dz = (z - c[2]) / r[2];
    const L = Math.hypot(dx, dy, dz);
    if (L >= k || L < 1e-6) return [x, y, z];
    const s = k / L;
    return [c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s, c[2] + (z - c[2]) * s];
  });
}

/** Offset a flat triangle along its normal (both ways), so a painted inner flap shows from either side. */
function bothSides(b, pts, col, d = 0.012) {
  const [a, p, q] = pts;
  const ux = p[0] - a[0];
  const uy = p[1] - a[1];
  const uz = p[2] - a[2];
  const vx = q[0] - a[0];
  const vy = q[1] - a[1];
  const vz = q[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx = (nx / l) * d;
  ny = (ny / l) * d;
  nz = (nz / l) * d;
  b.poly(pts, col, null, 0, [nx, ny, nz]);
  b.poly(pts, col, null, 0, [-nx, -ny, -nz]);
}

/* ------------------------------------------------------------------ shadows */

const SHADOW_GEO = new THREE.CircleGeometry(1, 24);
const SHADOW_MAT = new THREE.MeshBasicNodeMaterial({ color: '#334934', transparent: true, opacity: 0.21, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });

/** A soft flat ellipse under a character (r across, 0.6 r deep, world-aligned like the original). */
export function createShadow() {
  const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  m.frustumCulled = false;
  return {
    mesh: m,
    set(x, y, z, r) {
      m.position.set(x, y + 0.03, z);
      m.scale.set(r, 0.6 * r, 1);
    },
  };
}

/* ------------------------------------------------------------------ Mallow, the rain wolf */

export function createWolf() {
  const mats = inkMaterials();
  const root = new THREE.Group();

  // Body, chest, ruff, the side marks and the rain crescent: they ride the body's bounce.
  const body = new InkBuilder();
  body.ellipsoid(0, 1.02, -0.03, 0.45, 0.48, 1.02, CREAM, '#283b34', 0.016);
  body.ellipsoid(0, 1.25, 0.7, 0.5, 0.62, 0.52, BRIGHT, '#283b34', 0.016);
  const chestC = [0, 1.25, 0.7];
  const chestR = [0.5, 0.62, 0.52];
  for (const side of [-1, 1]) {
    body.poly(pushOut([[side * 0.39, 1.53, 0.7], [side * 0.65, 1.09, 0.35], [side * 0.38, 1.14, 0.95]], chestC, chestR), CREAM, '#30443a', 0.008);
    body.poly(pushOut([[side * 0.31, 1.51, 0.86], [side * 0.57, 1.12, 0.73], [side * 0.3, 1.27, 1.06]], chestC, chestR, 1.09), BRIGHT, '#30443a', 0.006);
    body.tube([[side * 0.42, 1.08, -0.55], [side * 0.459, 1.25, -0.25], [side * 0.46, 1.16, 0.07], [side * 0.45, 0.99, -0.03]], 0.0345, TEAL);
  }
  const cres = [];
  for (let i = 0; i < 23; i++) {
    const a = 0.4 + (i / 22) * 5.15;
    cres.push([Math.cos(a) * 0.43, 1.95 + Math.sin(a) * 0.38, -0.16]);
  }
  body.tube(cres, 0.0365, '#b99d50', '#56603d', 0.014);
  body.tube([[-0.34, 1.76, -0.18], [-0.5, 1.5, -0.52], [-0.35, 1.28, -0.77]], 0.0325, TEAL, '#3a5442', 0.014);
  const bodyG = body.build(mats);
  root.add(bodyG);

  // Head, snout, nose, ears and face: they ride the head bob.
  const head = new InkBuilder();
  head.ellipsoid(0, 1.64, 0.99, 0.37, 0.37, 0.47, BRIGHT, '#283b34', 0.016);
  head.ellipsoid(0, 1.45, 1.39, 0.26, 0.23, 0.43, BRIGHT, '#283b34', 0.016);
  head.ellipsoid(0, 1.48, 1.73, 0.14, 0.105, 0.115, '#344a3d', '#283b34', 0.012);
  for (const side of [-1, 1]) {
    head.poly([[side * 0.11, 1.9, 1.01], [side * 0.39, 2.25, 0.77], [side * 0.43, 1.73, 0.92]], CREAM, '#2a4037', 0.012);
    bothSides(head, [[side * 0.2, 1.9, 1.005], [side * 0.355, 2.11, 0.82], [side * 0.36, 1.83, 0.95]], TEAL, 0.01);
    head.ellipsoid(side * 0.307, 1.71, 1.27, 0.045, 0.053, 0.067, '#273d35', null);
    head.tube([[side * 0.28, 1.61, 1.4], [side * 0.36, 1.53, 1.21], [side * 0.39, 1.66, 1.08]], 0.027, TEAL);
  }
  head.tube([[0, 1.59, 1.72], [0, 1.65, 1.49]], 0.0175, '#768d73');
  const headG = head.build(mats);
  root.add(headG);

  // Paws: one shape per side, shared by front and back.
  const pawGeo = (side) => {
    const p = new InkBuilder();
    p.ellipsoid(0, 0, 0, 0.2, 0.13, 0.29, CREAM, '#283b34', 0.014);
    p.tube([[side * 0.075, 0.08, -0.185], [side * 0.075, 0.16, 0.005]], 0.0275, TEAL);
    return p.build(mats);
  };
  const pawSrc = { '-1': pawGeo(-1), 1: pawGeo(1) };
  const legs = [];
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const tube = new DynTube(3, { radial: 6, color: CREAM, outline: '#304239', outlineT: 0.014 });
      root.add(tube.group);
      const paw = side === 1 && front === 1 ? pawSrc[1] : side === -1 && front === 1 ? pawSrc['-1'] : pawSrc[String(side)].clone();
      root.add(paw);
      legs.push({ side, front, tube, paw, pts: new Float32Array(9) });
    }
  }
  const LEG_R = [0.105, 0.09, 0.0725];

  const tail = new DynTube(8, { radial: 7, color: CREAM, outline: '#2c4036', outlineT: 0.016 });
  const tip = new DynTube(3, { radial: 6, color: TEAL, outline: '#2c4036', outlineT: 0.016 });
  root.add(tail.group, tip.group);
  const tailPts = new Float32Array(24);
  const tipPts = tailPts.subarray(15, 24);

  // The strike: a pale arc with a thin green core, fading as it finishes.
  const arc = new DynTube(16, { radial: 5, color: '#fff0c6', transparent: true });
  const arcCore = new DynTube(16, { radial: 4, color: '#557e63', transparent: true });
  arc.group.renderOrder = arc.mesh.renderOrder = 12;
  arcCore.group.renderOrder = arcCore.mesh.renderOrder = 13;
  root.add(arc.group, arcCore.group);
  const arcPts = new Float32Array(48);

  const shadow = createShadow();

  return {
    root,
    shadow: shadow.mesh,
    /** s: { x, y, z, yaw, gait, speed, attack, worldT, visible, floorY } */
    update(s) {
      shadow.set(s.x, s.floorY, s.z, 1.3);
      root.visible = s.visible;
      const k = Math.min(s.speed / 6, 1);
      const bounce = Math.sin(s.gait * 2) * Math.min(s.speed / 6, 0.9) * 0.075;
      const baseY = s.y + (s.attack > 0 ? Math.sin((s.attack * Math.PI) / 0.3) * 0.06 : 0);
      root.position.set(s.x, baseY, s.z);
      root.rotation.y = s.yaw;
      bodyG.position.y = bounce;
      headG.position.y = s.speed > 0 ? Math.sin(s.gait * 2) * 0.035 : Math.sin(s.worldT * 1.8) * 0.02;

      for (const L of legs) {
        const phase = s.gait + (L.side * L.front > 0 ? 0 : Math.PI);
        const swing = Math.sin(phase) * k * 0.49;
        const up = Math.max(0, Math.cos(phase)) * k * 0.22;
        const z = L.front * 0.65;
        const P = L.pts;
        P[0] = L.side * 0.31;
        P[1] = 0.9 + bounce;
        P[2] = z;
        P[3] = L.side * 0.36;
        P[4] = 0.44 + up;
        P[5] = z + swing * 0.65;
        P[6] = L.side * 0.36;
        P[7] = 0.15 + up;
        P[8] = z + swing;
        L.tube.set(P, LEG_R);
        L.paw.position.set(L.side * 0.36, 0.14 + up, z + swing + 0.095);
      }

      const bodyY = 1.02 + bounce;
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        tailPts[i * 3] = Math.sin(s.worldT * 3 + t * 3) * 0.13 * t;
        tailPts[i * 3 + 1] = bodyY + 0.13 + t * 0.9 + Math.sin(t * Math.PI) * 0.3;
        tailPts[i * 3 + 2] = -0.9 - t * 1.35;
      }
      tail.set(tailPts, 0.12);
      tip.set(tipPts, 0.08);

      const on = s.attack > 0;
      arc.visible = on;
      arcCore.visible = on;
      if (on) {
        for (let i = 0; i < 16; i++) {
          const a = -1.4 + (i / 15) * 2.8 + (0.3 - s.attack) * 5;
          arcPts[i * 3] = Math.sin(a) * 1.8;
          arcPts[i * 3 + 1] = 0.9 + Math.sin((i / 15) * Math.PI) * 0.5;
          arcPts[i * 3 + 2] = Math.cos(a) * 1.8;
        }
        const alpha = Math.max(0, Math.min(1, s.attack / 0.12));
        arc.set(arcPts, 0.065);
        arcCore.set(arcPts, 0.02);
        arc.material.opacity = alpha;
        arcCore.material.opacity = alpha;
      }
    },
  };
}

/* ------------------------------------------------------------------ Pip, three folded sheets of paper */

export function createPip() {
  // 4 triangles: body, two wings, beak.
  const TRI = [
    { col: '#eedeae', pts: [[-0.13, 0, 0.24], [0.12, 0.08, -0.24], [0.31, 0, 0.07]] },
    { col: '#fff1c9', pts: [[0, 0, 0], [-0.66, 0.28, 0.08], [-0.17, 0.06, 0.3]], wing: 1 },
    { col: '#e7d6ab', pts: [[0.03, 0, 0.07], [0.63, 0.28, 0.12], [0.28, 0.05, 0.32]], wing: -1 },
    { col: '#af6039', pts: [[0.02, 0.01, -0.15], [0.19, 0.03, -0.32], [0.16, 0.08, -0.11]] },
  ];
  const pos = new Float32Array(12 * 3);
  const col = new Float32Array(12 * 3);
  const c = new THREE.Color();
  TRI.forEach((t, i) => {
    c.set(t.col);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i * 3 + k) * 3);
  });
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;

  const epos = new Float32Array(24 * 3);
  const egeo = new THREE.BufferGeometry();
  const eattr = new THREE.BufferAttribute(epos, 3);
  eattr.setUsage(THREE.DynamicDrawUsage);
  egeo.setAttribute('position', eattr);
  const edges = new THREE.LineSegments(egeo, new THREE.LineBasicNodeMaterial({ color: '#4b6048' }));
  edges.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh, edges);
  return {
    group,
    update(px, py, pz, wing) {
      let e = 0;
      TRI.forEach((t, i) => {
        for (let k = 0; k < 3; k++) {
          const p = t.pts[k];
          const o = (i * 3 + k) * 3;
          pos[o] = px + p[0];
          pos[o + 1] = py + p[1] + (t.wing && k === 1 ? wing * t.wing : 0);
          pos[o + 2] = pz + p[2];
        }
        for (let k = 0; k < 3; k++) {
          const a = (i * 3 + k) * 3;
          const b = (i * 3 + ((k + 1) % 3)) * 3;
          epos[e++] = pos[a];
          epos[e++] = pos[a + 1];
          epos[e++] = pos[a + 2];
          epos[e++] = pos[b];
          epos[e++] = pos[b + 1];
          epos[e++] = pos[b + 2];
        }
      });
      attr.needsUpdate = true;
      eattr.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------------ ink masks */

export function createMask(e) {
  const flash = uniform(0);
  const mats = inkMaterials({ flash });
  const b = new InkBuilder();
  b.ellipsoid(0, 0.66, 0, 0.65, 0.66, 0.52, '#404145', '#222e30', 0.03);
  for (const side of [-1, 1]) b.tube([[side * 0.3, 0.2, 0], [side * 0.4, 0.12, 0.45]], 0.065, '#303b38', '#253632', 0.014);
  b.ellipsoid(0, 0.92, 0.4, 0.47, 0.53, 0.15, '#d8cba6', '#26382f', 0.028);
  for (const side of [-1, 1]) {
    b.poly([[side * 0.08, 0.97, 0.555], [side * 0.32, 1.08, 0.55], [side * 0.25, 0.87, 0.565]], '#854c48', '#423f34', 0.007, [0, 0, 0.022]);
    b.poly([[side * 0.18, 1.35, 0.32], [side * 0.38, 1.69, 0.17], [side * 0.42, 1.22, 0.31]], '#d5bc82', '#2b3931', 0.01);
  }
  b.poly([[0, 0.94, 0.57], [-0.09, 0.76, 0.6], [0.08, 0.76, 0.6]], '#b58449', '#433e2e', 0.007, [0, 0, 0.022]);
  b.tube([[-0.2, 0.63, 0.575], [0, 0.58, 0.6], [0.2, 0.66, 0.575]], 0.0135, '#54493a');
  const root = new THREE.Group();
  root.add(b.build(mats));

  const wings = [];
  for (const side of [-1, 1]) {
    const w = new InkBuilder();
    // Pivot at the shoulder; the tip is 0.65 out, as in the original.
    w.poly([[0, 0.4, -0.1], [side * 0.65, 0, -0.03], [side * 0.4, -0.39, 0.04], [side * 0.03, -0.11, 0.17]], e.big ? '#68566b' : '#57585a', '#263435', 0.01);
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 0.6, 0.1);
    pivot.add(w.build(mats));
    root.add(pivot);
    wings.push(pivot);
  }
  const sc = e.big ? 1.42 : 1;
  const shadow = createShadow();
  return {
    root,
    shadow: shadow.mesh,
    update(e, y, worldT, floorY) {
      const dying = e.dead ? Math.max(0, e.dying || 0) / 0.4 : 1;
      root.visible = dying > 0.001;
      shadow.mesh.visible = root.visible;
      if (!root.visible) return;
      root.position.set(e.x, y, e.z);
      root.rotation.y = e.yaw;
      root.scale.setScalar(sc * (e.dead ? 0.3 + 0.7 * dying : 1));
      flash.value = e.hit > 0 || e.dead ? 1 : 0;
      const f = 1 + (Math.sin(worldT * 4) * 0.1) / 0.65;
      wings[0].scale.x = f;
      wings[1].scale.x = f;
      shadow.set(e.x, floorY, e.z, sc * dying);
    },
  };
}

/* ------------------------------------------------------------------ ink crows (the epilogue's new foe) */

export function createCrow() {
  const flash = uniform(0);
  const mats = inkMaterials({ flash });
  const b = new InkBuilder();
  b.ellipsoid(0, 0, 0, 0.3, 0.27, 0.5, '#3a3d40', '#222e30', 0.024);
  b.ellipsoid(0, 0.2, 0.46, 0.22, 0.21, 0.22, '#3a3d40', '#222e30', 0.022);
  b.ellipsoid(0, 0.22, 0.6, 0.17, 0.16, 0.07, '#d8cba6', '#26382f', 0.018);
  for (const side of [-1, 1]) {
    b.poly([[side * 0.03, 0.25, 0.675], [side * 0.13, 0.31, 0.665], [side * 0.11, 0.2, 0.67]], '#854c48', null, 0, [0, 0, 0.015]);
    b.tube([[side * 0.1, -0.2, 0.05], [side * 0.12, -0.42, 0.1]], 0.025, '#303b38');
  }
  b.poly([[0, 0.19, 0.67], [-0.055, 0.13, 0.66], [0, 0.09, 0.93]], '#d5bc82', '#433e2e', 0.006);
  b.poly([[0, 0.19, 0.67], [0, 0.09, 0.93], [0.055, 0.13, 0.66]], '#b58449', '#433e2e', 0.006);
  b.poly([[0, 0.05, -0.4], [-0.22, 0, -0.95], [0, 0.06, -0.85], [0.22, 0, -0.95]], '#2e3336', '#222e30', 0.008);
  const root = new THREE.Group();
  const bodyG = b.build(mats);
  root.add(bodyG);
  const wings = [];
  for (const side of [-1, 1]) {
    const w = new InkBuilder();
    w.poly([[0, 0, 0.24], [side * 1.05, 0.12, 0.05], [side * 0.9, 0.02, -0.34], [side * 0.12, 0, -0.3]], '#484b50', '#263435', 0.01);
    w.poly([[side * 0.6, 0.075, 0.12], [side * 1.05, 0.12, 0.05], [side * 0.9, 0.02, -0.34]], '#d8cba6', '#263435', 0.006, [0, 0.012, 0]);
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 0.08, 0.02);
    pivot.add(w.build(mats));
    bodyG.add(pivot);
    wings.push({ pivot, side });
  }
  root.scale.setScalar(1.15);
  const shadow = createShadow();
  return {
    root,
    shadow: shadow.mesh,
    update(c, worldT, floorY) {
      const dying = c.dead ? Math.max(0, c.dying || 0) / 0.4 : 1;
      root.visible = dying > 0.001;
      shadow.mesh.visible = root.visible;
      if (!root.visible) return;
      root.position.set(c.x, c.y, c.z);
      const pitch = c.state === 'dive' ? 0.55 : c.state === 'rise' ? -0.35 : 0;
      root.rotation.set(pitch, c.yaw, 0, 'YXZ');
      root.scale.setScalar(1.15 * (c.dead ? 0.3 + 0.7 * dying : 1));
      flash.value = c.hit > 0 || c.dead ? 1 : 0;
      const grounded = c.state === 'rest' || c.state === 'stun';
      const speed = c.state === 'dive' ? 20 : c.state === 'caw' ? 15 : 11;
      const flap = grounded ? -0.15 : Math.sin(worldT * speed + c.anim) * 0.55;
      for (const w of wings) {
        w.pivot.rotation.z = w.side * flap;
        w.pivot.scale.x = grounded ? 0.5 : 1;
      }
      // Height fades the shadow: a crow high overhead casts a small, faint one.
      const h = Math.max(0, c.y - floorY);
      shadow.set(c.x, floorY, c.z, Math.max(0.35, 1.05 - h * 0.14) * dying);
    },
  };
}

/* ------------------------------------------------------------------ the river bridge */

export function createBridge(floorAt) {
  const group = new THREE.Group();
  const solid = inkMaterials();
  const ghost = inkMaterials({ transparent: true });
  ghost.flat.opacity = 0.5;
  ghost.flat.depthWrite = false;

  const planks = [];
  const plankGeo = (i, cut) => {
    const b = new InkBuilder();
    const col = i % 2 ? '#b49662' : '#c4a875';
    b.poly([[-1.8, 0, 0], [1.8, 0, 0], [1.8 - (cut ? 0.4 : 0), 0, -0.34], [-1.8 + (cut ? 0.25 : 0), 0, -0.34]], col, '#4c5940', 0.009);
    b.tube([[-1.35, 0.013, -0.12], [0.9, 0.013, -0.15]], 0.0065, mixHex('#776e47', col, 0.5));
    return b.build(solid);
  };
  for (let i = 0; i < 18; i++) {
    const z = -2.6 - i * 0.39;
    const t = Math.max(0, Math.min(1, (-z - 3) / 6));
    const h = 0.15 + Math.sin(t * Math.PI) * 0.5;
    const whole = plankGeo(i, false);
    whole.position.set(0, h, z);
    group.add(whole);
    let cut = null;
    if (i === 2 || i === 15) {
      cut = plankGeo(i, true);
      cut.position.set(0, h, z);
      group.add(cut);
    }
    planks.push({ i, h, whole, cut, ghosted: false });
  }
  const setMat = (g, m) => g.traverse((o) => o.isMesh && (o.material = m));

  const posts = new InkBuilder();
  for (const side of [-1, 1]) {
    for (const z of [-2.4, -9.6]) {
      const x = side * 1.83;
      posts.tube([[x, 0, z], [x, 1.75, z]], 0.08, '#ad6745', '#424d38', 0.014);
      posts.ellipsoid(x, 1.78, z, 0.2, 0.14, 0.2, '#d1b171', '#3e4c38', 0.014);
    }
  }
  group.add(posts.build(solid));

  const railB = new InkBuilder();
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i <= 12; i++) {
      const z = -2.4 + (-9.6 + 2.4) * (i / 12);
      line.push([side * 1.83, 1.15 + Math.sin((i / 12) * Math.PI) * 0.54, z]);
    }
    railB.tube(line, 0.0525, '#a86140', '#414e39', 0.014);
    for (let j = 1; j < 6; j++) {
      const z = -2.4 - j * 1.2;
      const h = 0.15 + Math.sin((j / 6) * Math.PI) * 0.5;
      railB.tube([[side * 1.83, h, z], [side * 1.83, h + 1, z]], 0.04, '#b87950', '#46503b', 0.012);
    }
  }
  const rails = railB.build(solid);
  group.add(rails);

  // The pale "paint here" outline over the gap once the reed grove wakes.
  const hint = new THREE.Group();
  const fillMat = new THREE.MeshBasicNodeMaterial({ color: '#ecdfb7', transparent: true, opacity: 0.19, depthWrite: false, side: THREE.DoubleSide });
  const lineMat = new THREE.MeshBasicNodeMaterial({ color: '#f4e4b8', transparent: true, opacity: 0.67, depthWrite: false });
  const crossMat = new THREE.MeshBasicNodeMaterial({ color: '#e8dfbb', transparent: true, opacity: 0.5, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5), fillMat);
  quad.rotation.x = -Math.PI / 2;
  quad.position.set(0, 0.23, -6.1);
  hint.add(quad);
  const edge = (pts, r, m) => {
    const t = new DynTube(pts.length, { radial: 4 });
    t.set(pts.flat(), r);
    t.mesh.material = m;
    return t.group;
  };
  const corners = [[-1.8, 0.235, -3.6], [1.8, 0.235, -3.6], [1.8, 0.235, -8.6], [-1.8, 0.235, -8.6], [-1.8, 0.235, -3.6]];
  hint.add(edge(corners, 0.008, lineMat));
  for (let i = 0; i < 7; i++) {
    const z = -4 - i * 0.6;
    hint.add(edge([[-1.7, 0.25, z], [1.7, 0.25, z]], 0.009, crossMat));
  }
  hint.traverse((o) => {
    if (o.isMesh) o.renderOrder = 6;
  });
  group.add(hint);

  return {
    group,
    update(mended, grow, showHint, t) {
      for (const p of planks) {
        const exists = p.i < 3 || p.i > 14 || mended;
        const risen = !mended || grow >= p.i * 0.024;
        const rise = mended ? Math.max(0, p.i * 0.024 - grow) * 0.9 : 0;
        const useCut = !!p.cut && !mended;
        p.whole.visible = exists && !useCut;
        if (p.cut) p.cut.visible = exists && useCut;
        p.whole.position.y = p.h - rise;
        if (p.ghosted !== !risen) {
          p.ghosted = !risen;
          setMat(p.whole, risen ? solid.flat : ghost.flat);
        }
      }
      rails.visible = mended;
      hint.visible = showHint;
      if (showHint) fillMat.opacity = 0.19 * (0.75 + 0.35 * Math.sin(t * 2.4));
    },
    floorAt,
  };
}
