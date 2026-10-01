/**
 * Block Court — the arena: court, crowd, hoops, players, ball, effects and the
 * post chain. Everything is generated at run time (no textures, fonts or
 * models are downloaded). The view reads the simulation every frame and never
 * changes it.
 */

import * as THREE from 'three/webgpu';
import { uniform, uv, pow, vec2, vec4, float, screenCoordinate, length, hash, time } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from 'kit/post.js';
import { COURT, RACKS, clamp } from './sim.js';
import { CREWS } from './league.js';

export const COLOR = Object.freeze({ teal: 0x41ebcb, orange: 0xff784c, white: 0xf6f2df, ink: 0x101c27, gold: 0xffd477 });
const TAU = Math.PI * 2;
const SKINS = [0xe5b184, 0xa56a43, 0xc98f62, 0x774936, 0xf0c5a2, 0x986548];
const HAIR = [0x251e1c, 0x151e25, 0x39302a, 0x171b21, 0x4b2d1e, 0x302722];
const CROWD_COLORS = [0x51837d, 0xad624d, 0x8797a3, 0xc5b899, 0x374959, 0x71989c, 0x765f7d, 0xbb926b];
const BALL_ORANGE = 0xdf7529;
const MONEY_GOLD = 0xffc94a;
const TRAIL = 11;
const WAVES = 4;

/**
 * Merge a group's plain child meshes into one mesh per material. Nested groups
 * (arms, legs, nets) and meshes marked userData.keep stay as they are.
 */
function mergeByMaterial(group) {
  const buckets = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || child.isInstancedMesh || child.children.length || child.userData.keep) continue;
    child.updateMatrix();
    const g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    g.applyMatrix4(child.matrix);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    let b = buckets.get(child.material);
    if (!b) buckets.set(child.material, (b = { geos: [], cast: false, receive: false, order: child.renderOrder }));
    b.geos.push(g);
    b.cast ||= child.castShadow;
    b.receive ||= child.receiveShadow;
    group.remove(child);
  }
  for (const [material, b] of buckets) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.renderOrder = b.order;
    group.add(mesh);
  }
}

/** The painted hardwood. The plank pattern is seeded, so a repaint for a new crew matches. */
function drawCourt(c, w, h, crew) {
  const X = (x) => ((x + 14) / 28) * w;
  const Z = (z) => ((z + 7.5) / 15) * h;
  c.fillStyle = '#b98a57';
  c.fillRect(0, 0, w, h);
  let rng = 410;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  for (let row = 0; row < 38; row++) {
    const rh = h / 38;
    const y = row * rh;
    let x = -((row % 3) * 80);
    while (x < w) {
      const len = 160 + rand() * 160;
      const light = 52 + rand() * 10;
      c.fillStyle = `hsl(${30 + rand() * 6},45%,${light}%)`;
      c.fillRect(x, y, len - 1, rh - 0.7);
      c.strokeStyle = 'rgba(74,45,22,.07)';
      c.lineWidth = 0.7;
      for (let k = 0; k < 4; k++) {
        const gy = y + rand() * rh;
        c.beginPath();
        c.moveTo(x, gy);
        c.bezierCurveTo(x + len * 0.3, gy - 2, x + len * 0.6, gy + 3, x + len, gy);
        c.stroke();
      }
      x += len;
    }
  }
  c.fillStyle = 'rgba(254,215,151,.10)';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#326f69';
  c.fillRect(X(-14), Z(-2.35), X(-8.4) - X(-14), Z(2.35) - Z(-2.35));
  c.fillStyle = crew.paint;
  c.fillRect(X(8.4), Z(-2.35), X(14) - X(8.4), Z(2.35) - Z(-2.35));
  c.strokeStyle = '#f9eed5';
  c.lineWidth = 5;
  c.lineJoin = 'round';
  const path = (pts, close = false) => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))));
    if (close) c.closePath();
    c.stroke();
  };
  const circle = (x, z, r) => {
    c.beginPath();
    c.ellipse(X(x), Z(z), (r / 28) * w, (r / 15) * h, 0, 0, TAU);
    c.stroke();
  };
  path([[-13.85, -7.35], [13.85, -7.35], [13.85, 7.35], [-13.85, 7.35]], true);
  path([[0, -7.35], [0, 7.35]]);
  circle(0, 0, 2.12);
  for (const side of [-1, 1]) {
    path([[side * 13.85, -2.35], [side * 8.4, -2.35], [side * 8.4, 2.35], [side * 13.85, 2.35]]);
    circle(side * 8.4, 0, 1.8);
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const a = -Math.PI / 2 + (i / 100) * Math.PI;
      pts.push([side * (12.35 - 6.3 * Math.cos(a)), 6.3 * Math.sin(a)]);
    }
    path(pts);
    path([[side * 12.35, -6.3], [side * 13.85, -6.3]]);
    path([[side * 12.35, 6.3], [side * 13.85, 6.3]]);
    const small = [];
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI / 2 + (i / 40) * Math.PI;
      small.push([side * (12.35 - 1.3 * Math.cos(a)), 1.3 * Math.sin(a)]);
    }
    path(small);
    for (const z of [-2.35, 2.35]) for (const x of [9.5, 10.8, 12]) path([[side * x, z], [side * x, z + Math.sign(z) * 0.23]]);
  }
  c.save();
  c.translate(X(0), Z(0));
  c.rotate(-Math.PI / 14);
  c.fillStyle = '#173d41';
  c.font = '900 133px Impact, Arial Black, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('BC', 0, 0);
  c.fillStyle = '#e8b875';
  c.fillRect(-64, -5, 132, 10);
  c.restore();
  c.fillStyle = 'rgba(24,63,61,.65)';
  c.font = 'bold 24px Arial';
  c.textAlign = 'center';
  c.fillText('B L O C K   C O U R T', X(0), Z(6.66));
  c.save();
  c.translate(X(-12.9), Z(0));
  c.rotate(-Math.PI / 2);
  c.fillStyle = '#e0ebe0';
  c.font = 'bold 32px Arial';
  c.fillText('T U R B O', 0, 0);
  c.restore();
  c.save();
  c.translate(X(12.9), Z(0));
  c.rotate(Math.PI / 2);
  c.fillStyle = crew.ink;
  c.font = 'bold 28px Arial';
  c.fillText(crew.name.split('').join(' '), 0, 0);
  c.restore();
}

/**
 * Build the arena. `sim` is read every frame; `opts.shake()` says whether
 * camera shake is on.
 * @returns the view: scene, camera, update(), render() and effect triggers
 */
export function createCourtView(kit, sim, opts = {}) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const anisotropy = Math.min(8, renderer.getMaxAnisotropy?.() || 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1722);
  scene.fog = new THREE.FogExp2(0x0b1722, 0.0125);
  const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 140);
  camera.position.set(0, 27, 32);
  camera.lookAt(0, 0, 0);

  const tempV = new THREE.Vector3();
  const tempO = new THREE.Object3D();
  const tempC = new THREE.Color();

  // ---- shared materials and geometry
  const materialCache = new Map();
  const geometries = new Map();
  function mat(color, roughness = 0.68, metalness = 0, emissive = null, intensity = 0) {
    const k = `${color}|${roughness}|${metalness}|${emissive}|${intensity}`;
    if (!materialCache.has(k)) materialCache.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, emissive: emissive || 0, emissiveIntensity: intensity }));
    return materialCache.get(k);
  }
  function boxGeo(w, h, d, bevel = 0) {
    const k = `${w}/${h}/${d}/${bevel}`;
    if (geometries.has(k)) return geometries.get(k);
    let g;
    if (bevel > 0) {
      const x = w / 2 - bevel;
      const y = h / 2 - bevel;
      const s = new THREE.Shape();
      s.moveTo(-x, -y);
      s.lineTo(x, -y);
      s.lineTo(x, y);
      s.lineTo(-x, y);
      s.closePath();
      g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
      g.translate(0, 0, -d / 2 + bevel);
    } else g = new THREE.BoxGeometry(w, h, d);
    geometries.set(k, g);
    return g;
  }
  function box(w, h, d, x, y, z, m, parent, bevel = 0, shadow = true) {
    const mesh = new THREE.Mesh(boxGeo(w, h, d, bevel), typeof m === 'number' ? mat(m) : m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(r1, r2, h, x, y, z, m, parent, segments = 12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segments), typeof m === 'number' ? mat(m) : m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  }
  function plate(text, w = 5, h = 1, color = '#c8e6e5', bg = '#122832', font = 72) {
    const tex = canvasTexture(1024, Math.round((1024 * h) / w), (ctx, cw, ch) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.font = `900 ${Math.min(ch * 0.55, font)}px Arial`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cw / 2, ch / 2);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  }

  // ---- lighting: a small generated environment gives the toy plastic broad studio reflections
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), new THREE.MeshBasicMaterial({ color: 0x374650, side: THREE.BackSide })));
  for (const p of [[-12, 16, 0, 12, 9], [12, 16, 0, 12, 9], [0, 16, -15, 22, 5]]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4df).multiplyScalar(3) }));
    mesh.position.set(p[0], p[1], p[2]);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.05, 0.1, 80).texture;
  pmrem.dispose();
  envScene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

  scene.add(new THREE.HemisphereLight(0xc5e9ff, 0x263b3d, 1.35));
  scene.add(new THREE.AmbientLight(0xadc4d1, 0.4));
  const key = new THREE.DirectionalLight(0xffe4be, 3.1);
  key.position.set(-8, 20, 9);
  key.castShadow = true;
  kit.shadow(key, 2048);
  Object.assign(key.shadow.camera, { left: -23, right: 23, top: 19, bottom: -19, near: 0.5, far: 60 });
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.045;
  key.shadow.radius = 3;
  scene.add(key);
  const backLight = new THREE.DirectionalLight(0xaccfff, 1.55);
  backLight.position.set(2, 12, -15);
  scene.add(backLight);
  for (const side of [-1, 1]) {
    const accent = new THREE.PointLight(side < 0 ? COLOR.teal : COLOR.orange, 52, 21, 2);
    accent.position.set(side * 13.5, 4.8, -2);
    scene.add(accent);
    const spot = new THREE.SpotLight(0xe4efff, 470, 45, 0.65, 0.72, 1.8);
    spot.position.set(side * 11, 15, -2);
    spot.target.position.set(side * 7, 0, 0);
    scene.add(spot, spot.target);
  }

  // ---- the court: everything static goes in `arena` and is merged by material at the end
  const arena = new THREE.Group();
  scene.add(arena);
  let courtCrew = CREWS[0];
  const courtTex = canvasTexture(2048, 1098, (c, w, h) => drawCourt(c, w, h, courtCrew));
  box(32.1, 0.66, 19.2, 0, -0.47, 0, mat(0x243641, 0.63), arena, 0.12);
  box(32.25, 0.16, 19.35, 0, -0.78, 0, mat(0x101c28), arena, 0.04);
  box(31.95, 0.075, 19.08, 0, -0.11, 0, mat(0x25444e, 0.48), arena);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 15), new THREE.MeshPhysicalMaterial({ map: courtTex, roughness: 0.37, metalness: 0.03, clearcoat: 0.42, clearcoatRoughness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.006;
  floor.receiveShadow = true;
  floor.userData.keep = true;
  arena.add(floor);
  const studGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.09, 8);
  const studMat = mat(0x3b5862);
  for (const side of [-1, 1]) {
    box(31.65, 0.05, 0.052, 0, -0.18, side * 9.55, mat(side < 0 ? 0x50ffe0 : 0xff925c, 0.2, 0, side < 0 ? COLOR.teal : COLOR.orange, 3), arena);
    box(0.052, 0.05, 19.1, side * 15.98, -0.18, 0, mat(side < 0 ? COLOR.teal : COLOR.orange, 0.2, 0, side < 0 ? COLOR.teal : COLOR.orange, 3), arena);
    // Chunky exposed studs on the toy base.
    for (let i = 0; i < 48; i++) {
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(-15.35 + i * 0.65, -0.014, side * 8.95);
      stud.receiveShadow = true;
      arena.add(stud);
    }
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x111d28, 0.98));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.86;
  ground.receiveShadow = true;
  ground.userData.keep = true;
  arena.add(ground);

  // ---- stadium steps and crowd (three moving instanced batches sharing one shader)
  const crowdSlots = [];
  for (let row = 0; row < 4; row++) {
    const z = -11 - row * 1.35;
    const y = row * 0.68 - 0.3;
    box(35, 0.68, 1.5, 0, y, z, mat(row % 2 ? 0x2c3c47 : 0x293944), arena, 0.05);
    for (let i = 0; i < 37; i++) {
      const x = (i - 18) * 0.86;
      if (Math.abs(x) < 1.3 && row < 2) continue;
      crowdSlots.push({ x: x + (Math.random() - 0.5) * 0.15, y: y + 0.6, z, seed: Math.random() * TAU, color: Math.random() });
    }
  }
  for (const side of [-1, 1])
    for (let row = 0; row < 2; row++) {
      const x = side * (17.3 + row * 1.15);
      const y = row * 0.62 - 0.3;
      box(1.3, 0.66, 16, x, y, -1, mat(0x293944), arena, 0.05);
      for (let j = 0; j < 15; j++) crowdSlots.push({ x, y: y + 0.62, z: -7.2 + j * 0.85, seed: Math.random() * TAU, color: Math.random() });
    }
  const crowdCount = crowdSlots.length;
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const crowdBodies = kit.instanced(boxGeo(0.48, 0.61, 0.39, 0.045), crowdMat, crowdCount);
  const crowdHeads = kit.instanced(boxGeo(0.36, 0.36, 0.36, 0.03), crowdMat, crowdCount);
  const crowdArms = kit.instanced(boxGeo(0.13, 0.45, 0.15, 0.015), crowdMat, crowdCount * 2);
  for (let i = 0; i < crowdCount; i++) {
    const s = crowdSlots[i];
    const shirt = CROWD_COLORS[Math.floor(s.color * CROWD_COLORS.length)];
    tempO.rotation.set(0, 0, 0);
    tempO.scale.set(1, 1, 1);
    tempO.position.set(s.x, s.y + 0.31, s.z);
    tempO.updateMatrix();
    crowdBodies.setMatrixAt(i, tempO.matrix);
    crowdBodies.setColorAt(i, tempC.setHex(shirt));
    tempO.position.y = s.y + 0.84;
    tempO.updateMatrix();
    crowdHeads.setMatrixAt(i, tempO.matrix);
    crowdHeads.setColorAt(i, tempC.setHex(SKINS[i % SKINS.length]));
    for (let a = 0; a < 2; a++) {
      tempO.position.set(s.x + (a ? 1 : -1) * 0.31, s.y + 0.36, s.z);
      tempO.rotation.z = (a ? 1 : -1) * 0.1;
      tempO.updateMatrix();
      crowdArms.setMatrixAt(i * 2 + a, tempO.matrix);
      crowdArms.setColorAt(i * 2 + a, tempC.setHex(shirt));
    }
  }
  crowdBodies.receiveShadow = crowdHeads.receiveShadow = true;
  for (const m of [crowdBodies, crowdHeads, crowdArms]) {
    m.frustumCulled = false;
    scene.add(m);
  }
  let crowdEnergy = 0;
  let frameCount = 0;
  let total = 0;
  function animateCrowd(dt) {
    crowdEnergy = Math.max(0, crowdEnergy - dt * 0.32);
    if (frameCount % 3 !== 0) return;
    const cheering = crowdEnergy > 0.1;
    tempO.scale.set(1, 1, 1);
    for (let i = 0; i < crowdCount; i++) {
      const s = crowdSlots[i];
      const bob = Math.sin(total * 2.2 + s.seed) * 0.02 + (cheering ? Math.max(0, Math.sin(total * 9 + s.seed)) * 0.17 * crowdEnergy : 0);
      tempO.rotation.set(0, 0, 0);
      tempO.position.set(s.x, s.y + 0.31 + bob, s.z);
      tempO.updateMatrix();
      crowdBodies.setMatrixAt(i, tempO.matrix);
      tempO.position.y = s.y + 0.84 + bob;
      tempO.updateMatrix();
      crowdHeads.setMatrixAt(i, tempO.matrix);
      const raised = cheering ? crowdEnergy * (1.7 + Math.sin(total * 5 + s.seed) * 0.35) : Math.sin(total + s.seed) * 0.04;
      for (let a = 0; a < 2; a++) {
        tempO.position.set(s.x + (a ? 1 : -1) * 0.32, s.y + 0.35 + bob + raised * 0.12, s.z);
        tempO.rotation.z = (a ? 1 : -1) * (0.15 + raised);
        tempO.updateMatrix();
        crowdArms.setMatrixAt(i * 2 + a, tempO.matrix);
      }
    }
    crowdBodies.instanceMatrix.needsUpdate = true;
    crowdHeads.instanceMatrix.needsUpdate = true;
    crowdArms.instanceMatrix.needsUpdate = true;
  }

  // ---- walls, architecture, signage and low-poly light banks
  box(45, 14, 0.7, 0, 5.1, -18, mat(0x152632), arena);
  for (const x of [-21, -14, -7, 0, 7, 14, 21]) {
    box(0.32, 13, 0.5, x, 4.6, -17.45, mat(0x2d4552), arena);
    box(0.055, 7.5, 0.1, x, 5.5, -17.13, mat(0x456a76, 0.4, 0, 0x63adbc, 0.45), arena);
  }
  // A subtle cone makes the spotlights visible in the arena haze (additive, brighter toward the base).
  const beamMats = [0x83c9c5, 0xffc18e].map((tint) => {
    const m = new THREE.MeshBasicNodeMaterial({ color: tint, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    m.opacityNode = pow(uv().y, 1.3).mul(0.023);
    return m;
  });
  const beamGeo = new THREE.ConeGeometry(3.2, 10, 20, 1, true);
  for (const side of [-1, 1]) {
    const sign = plate(side < 0 ? 'MAKE SOME NOISE.' : 'BUILT FOR THE BUCKET.', 10.8, 1.27, side < 0 ? '#8ae4d4' : '#fda478', '#112431', 72);
    sign.position.set(side * 10.5, 5.6, -17.02);
    arena.add(sign);
    const small = plate(side < 0 ? 'T U R B O  /  H O M E' : 'I N F E R N O  /  A W A Y', 7.5, 0.65, '#7b9da9', '#112431', 40);
    small.position.set(side * 10.5, 4.55, -17);
    arena.add(small);
    for (let i = 0; i < 3; i++) {
      const sign2 = plate(i === 1 ? 'BLOCK COURT' : side < 0 ? 'PLAY LOUD.' : 'STAY IN THE GAME.', 6.8, 0.55, side < 0 ? '#7dded0' : '#f8a379', '#0a1c27', 54);
      sign2.position.set((i - 1) * 9.1, 0.63, side < 0 ? -9.8 : 9.35);
      sign2.rotation.x = side < 0 ? -0.12 : -0.55;
      if (side > 0) sign2.rotation.y = Math.PI;
      box(7, 0.7, 0.24, (i - 1) * 9.1, 0.35, side < 0 ? -9.85 : 9.4, mat(0x0d202b), arena);
      arena.add(sign2);
    }
    for (const z of [-9.5, 8.2]) {
      const x = side * 16.4;
      box(0.24, 11, 0.24, x, 4.6, z, mat(0x314554), arena);
      box(2.4, 0.24, 0.7, x - side * 0.9, 10.05, z, mat(0x374854), arena, 0.07);
      box(2.1, 0.04, 0.5, x - side * 0.9, 9.88, z, mat(0xffffff, 0.3, 0, 0xffefca, 4.5), arena);
      box(0.15, 0.15, 2.6, x, 8.7, z, mat(0x273945), arena);
      const beam = new THREE.Mesh(beamGeo, beamMats[side < 0 ? 0 : 1]);
      beam.position.set(x - side * 1.2, 4.9, z);
      beam.renderOrder = 2;
      arena.add(beam);
    }
  }

  // ---- back-wall scoreboard, redrawn only when its text changes
  const scoreCanvas = document.createElement('canvas');
  scoreCanvas.width = 1024;
  scoreCanvas.height = 384;
  const scoreContext = scoreCanvas.getContext('2d');
  const scoreTex = new THREE.CanvasTexture(scoreCanvas);
  scoreTex.colorSpace = THREE.SRGBColorSpace;
  scoreTex.anisotropy = anisotropy;
  box(8.6, 3.36, 0.35, 0, 6.12, -17.03, mat(0x07141d), arena, 0.08);
  const worldScore = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 3.08), new THREE.MeshBasicMaterial({ map: scoreTex, toneMapped: false }));
  worldScore.position.set(0, 6.12, -16.81);
  worldScore.userData.keep = true;
  arena.add(worldScore);
  // About 180 static boxes, studs, signs and beams become one mesh per material.
  mergeByMaterial(arena);
  let boardKey = '';
  let awayCss = CREWS[0].css;
  /** b: { home, away, s0, s1, clock, caption } */
  function setBoard(b) {
    const k = `${b.home}|${b.away}|${b.s0}|${b.s1}|${b.clock}|${b.caption}|${awayCss}`;
    if (k === boardKey) return;
    boardKey = k;
    const c = scoreContext;
    c.fillStyle = '#091923';
    c.fillRect(0, 0, 1024, 384);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#83a2ae';
    c.font = 'bold 26px Arial';
    c.fillText('B L O C K   C O U R T', 512, 43);
    c.fillStyle = '#52e3c7';
    c.font = 'bold 28px Arial';
    c.fillText(b.home, 231, 111);
    c.fillStyle = awayCss;
    c.fillText(b.away, 793, 111);
    c.font = 'bold 128px Arial';
    c.fillStyle = '#e5f3e9';
    c.fillText(String(b.s0).padStart(2, '0'), 231, 210);
    c.fillText(String(b.s1).padStart(2, '0'), 793, 210);
    c.fillStyle = '#ffd187';
    c.font = 'bold 49px monospace';
    c.fillText(b.clock, 512, 203);
    c.font = 'bold 20px Arial';
    c.fillStyle = '#7895a1';
    c.fillText(b.caption, 512, 326);
    scoreTex.needsUpdate = true;
  }

  // ---- LED shot clocks above both backboards share one small texture
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 256;
  ledCanvas.height = 164;
  const ledContext = ledCanvas.getContext('2d');
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false });
  let ledKey = NaN;
  /** n: whole seconds to show, or -1 for "--". */
  function setLed(n, warn) {
    const k = n * 2 + (warn ? 1 : 0);
    if (k === ledKey) return;
    ledKey = k;
    const text = n < 0 ? '--' : String(n);
    const c = ledContext;
    c.fillStyle = '#06161f';
    c.fillRect(0, 0, 256, 164);
    c.font = '900 110px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = warn ? '#ff8a5c' : '#ffd37c';
    c.fillText(text, 128, 88);
    ledTex.needsUpdate = true;
  }
  setLed(24, false);

  // ---- hoops
  const hoopViews = [];
  const netMat = new THREE.LineBasicMaterial({ color: 0xf7f5dc, transparent: true, opacity: 0.78 });
  const netPoints = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    for (let row = 0; row < 3; row++) {
      const r1 = 0.46 - row * 0.065;
      const r2 = 0.46 - (row + 1) * 0.065;
      const y1 = -row * 0.2;
      const y2 = -(row + 1) * 0.2;
      netPoints.push(new THREE.Vector3(Math.cos(a) * r1, y1, Math.sin(a) * r1), new THREE.Vector3(Math.cos(a + 0.26) * r2, y2, Math.sin(a + 0.26) * r2));
      netPoints.push(new THREE.Vector3(Math.cos(a) * r1, y1, Math.sin(a) * r1), new THREE.Vector3(Math.cos(a - 0.26) * r2, y2, Math.sin(a - 0.26) * r2));
    }
  }
  const netGeo = new THREE.BufferGeometry().setFromPoints(netPoints);
  const boardMat = new THREE.MeshPhysicalMaterial({ color: 0xcee3e4, transparent: true, opacity: 0.26, roughness: 0.2, metalness: 0.05, depthWrite: false });
  const rimMat = mat(0xff7c37, 0.3, 0.3, 0xe84615, 0.15);
  const rimGeo = new THREE.TorusGeometry(0.49, 0.055, 8, 28);
  const ledGeo = new THREE.PlaneGeometry(0.7, 0.45);
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    scene.add(g);
    const teamColor = side < 0 ? COLOR.teal : COLOR.orange;
    box(0.85, 0.4, 2.1, side * 14.65, 0.2, 0, mat(0x142c39), g, 0.07);
    box(0.32, 4.65, 0.4, side * 14.65, 2.35, 0, mat(0x38545e, 0.36, 0.35), g, 0.035);
    box(0.43, 1.8, 0.57, side * 14.55, 1.24, 0, mat(teamColor, 0.48), g, 0.05);
    box(1.77, 0.2, 0.25, side * 13.84, 4.33, 0, mat(0xa6bec2, 0.32, 0.4), g, 0.035);
    box(0.12, 1.55, 2.63, side * 13.16, 4.16, 0, boardMat, g, 0.012, false).userData.keep = true;
    for (const z of [-1.37, 1.37]) box(0.18, 1.66, 0.07, side * 13.16, 4.16, z, mat(0xe1efec, 0.32, 0.3), g);
    for (const y of [3.35, 4.98]) box(0.18, 0.07, 2.81, side * 13.16, y, 0, mat(0xe1efec, 0.32, 0.3), g);
    for (const z of [-0.46, 0.46]) box(0.026, 0.67, 0.045, side * 13.06, 3.93, z, mat(0xf5efdc), g, 0, false);
    for (const y of [3.6, 4.26]) box(0.026, 0.045, 0.96, side * 13.055, y, 0, mat(0xf5efdc), g, 0, false);
    box(0.4, 0.075, 0.15, side * 12.9, COURT.rimY, 0, mat(COLOR.orange, 0.35, 0.25), g);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(side * COURT.hoopX, COURT.rimY, 0);
    rim.castShadow = true;
    rim.userData.keep = true;
    g.add(rim);
    const net = new THREE.Group();
    net.position.set(side * COURT.hoopX, COURT.rimY - 0.03, 0);
    g.add(net);
    net.add(new THREE.LineSegments(netGeo, netMat));
    // LED shot clock above each backboard (the original always read 24; it now counts).
    const sc = new THREE.Mesh(ledGeo, ledMat);
    sc.position.set(side * 13.15, 5.35, 0);
    sc.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    sc.userData.keep = true;
    g.add(sc);
    mergeByMaterial(g);
    hoopViews.push({ side, net, rim, bounce: 0 });
  }

  // ---- 3-Point Contest racks (shown only in that mode)
  const racks = new THREE.Group();
  racks.visible = false;
  scene.add(racks);
  const rackSpots = RACKS.map((r) => {
    const ox = r.x - COURT.hoopX;
    const oz = r.z;
    const l = Math.hypot(ox, oz) || 1;
    const out = { x: ox / l, z: oz / l };
    return { x: r.x + out.x * 0.85, z: r.z + out.z * 0.85, tx: out.z, tz: -out.x, angle: Math.atan2(out.x, out.z) };
  });
  {
    const frame = mat(0x2b3f4a, 0.5, 0.3);
    const glow = mat(COLOR.teal, 0.3, 0, COLOR.teal, 1.6);
    const parts = new THREE.Group();
    for (const s of rackSpots) {
      const stand = new THREE.Group();
      stand.position.set(s.x, 0, s.z);
      stand.rotation.y = s.angle;
      box(3.0, 0.1, 0.62, 0, 0.05, 0, frame, stand, 0.03);
      for (const x of [-1.38, 1.38]) box(0.1, 0.36, 0.5, x, 0.25, 0, frame, stand, 0.02);
      box(2.9, 0.06, 0.08, 0, 0.36, -0.2, frame, stand);
      box(2.9, 0.06, 0.08, 0, 0.36, 0.2, frame, stand);
      box(2.9, 0.03, 0.05, 0, 0.11, 0.3, glow, stand, 0, false);
      stand.updateMatrix();
      for (const m of [...stand.children]) {
        m.applyMatrix4(stand.matrix);
        parts.add(m);
      }
    }
    mergeByMaterial(parts);
    racks.add(parts);
  }
  const rackBallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, flatShading: true });
  const rackBalls = kit.instanced(new THREE.IcosahedronGeometry(0.25, 1), rackBallMat, 25);
  rackBalls.castShadow = true;
  rackBalls.frustumCulled = false;
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 5; k++) rackBalls.setColorAt(r * 5 + k, tempC.setHex(k === 4 ? MONEY_GOLD : BALL_ORANGE));
  racks.add(rackBalls);
  let rackKey = '';
  function updateRacks() {
    const d = sim.derby;
    if (!d) return;
    const out = sim.ball.mode !== 'rack' && d.rack < 5 ? 1 : 0;
    const k = `${d.rack}|${d.shot}|${out}`;
    if (k === rackKey) return;
    rackKey = k;
    for (let r = 0; r < 5; r++) {
      const s = rackSpots[r];
      const used = r < d.rack ? 5 : r === d.rack ? d.shot + out : 0;
      for (let b = 0; b < 5; b++) {
        const along = (b - 2) * 0.56;
        tempO.position.set(s.x + s.tx * along, 0.64, s.z + s.tz * along);
        tempO.rotation.set(b, b * 0.7, 0);
        tempO.scale.setScalar(b < used ? 0 : 1);
        tempO.updateMatrix();
        rackBalls.setMatrixAt(r * 5 + b, tempO.matrix);
      }
    }
    rackBalls.instanceMatrix.needsUpdate = true;
  }

  // ---- players
  const shadowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.60)');
    g.addColorStop(0.5, 'rgba(0,0,0,.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  function shadow(size) {
    const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.64 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.userData.size = size;
    m.scale.setScalar(size);
    scene.add(m);
    return m;
  }
  // Team 1's kit is recoloured for each Night League crew.
  const crewMats = {
    jersey: new THREE.MeshStandardMaterial({ color: CREWS[0].jersey, roughness: 0.41, metalness: 0.03, flatShading: true }),
    shorts: new THREE.MeshStandardMaterial({ color: CREWS[0].shorts, roughness: 0.59, flatShading: true }),
    cuff: new THREE.MeshStandardMaterial({ color: CREWS[0].cuff, roughness: 0.68, flatShading: true }),
  };
  function drawNumber(c, w, h, number) {
    c.clearRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '900 88px Arial';
    c.fillStyle = '#fff3db';
    c.fillText(number, w / 2, h / 2 + 5);
  }
  const ringGeo = new THREE.RingGeometry(0.62, 0.69, 40);
  const numberGeo = new THREE.PlaneGeometry(0.34, 0.36);
  const playerViews = [];
  for (const p of sim.players) {
    const root = new THREE.Group();
    scene.add(root);
    const rig = new THREE.Group();
    root.add(rig);
    const home = p.team === 0;
    const jersey = home ? mat(0x40c7b1, 0.41, 0.03) : crewMats.jersey;
    const shorts = home ? mat(0x145254, 0.59) : crewMats.shorts;
    const cuff = home ? mat(0x206c6b) : crewMats.cuff;
    const skin = mat(SKINS[p.id % SKINS.length], 0.65);
    const hair = mat(HAIR[p.id], 0.9);
    box(0.76, 0.79, 0.49, 0, 1.2, 0, jersey, rig, 0.055);
    box(0.72, 0.08, 0.5, 0, 0.85, 0, mat(0xf4eed9, 0.7), rig, 0.015);
    box(0.74, 0.24, 0.46, 0, 0.73, 0, shorts, rig, 0.03);
    cylinder(0.14, 0.14, 0.15, 0, 1.66, 0, skin, rig, 10);
    box(0.61, 0.57, 0.57, 0, 1.98, 0, skin, rig, 0.055);
    if (p.id % 3 === 0) {
      box(0.64, 0.12, 0.59, 0, 2.26, -0.01, hair, rig, 0.028);
      box(0.61, 0.16, 0.16, 0, 2.22, -0.23, hair, rig, 0.025);
    } else if (p.id % 3 === 1) {
      box(0.65, 0.18, 0.61, 0, 2.26, -0.015, hair, rig, 0.035);
      for (let i = 0; i < 3; i++) box(0.16, 0.12, 0.16, (i - 1) * 0.19, 2.39, -0.07, hair, rig, 0.025);
    } else {
      box(0.62, 0.1, 0.59, 0, 2.25, 0, hair, rig, 0.02);
      box(0.08, 0.2, 0.47, -0.29, 2.13, -0.05, hair, rig, 0.01);
    }
    cylinder(0.1, 0.1, 0.08, 0, 2.36, 0, hair, rig, 10);
    box(0.065, 0.058, 0.026, -0.13, 2.015, 0.288, mat(0x17252a), rig, 0.009, false);
    box(0.065, 0.058, 0.026, 0.13, 2.015, 0.288, mat(0x17252a), rig, 0.009, false);
    box(0.13, 0.025, 0.024, 0, 1.86, 0.29, mat(0x573c30), rig, 0, false);
    if (p.id === 0 || p.id === 4) box(0.65, 0.075, 0.61, 0, 2.18, 0, mat(home ? 0xf3efd9 : 0x292930), rig, 0.012);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.5, 1.52, 0);
      rig.add(arm);
      box(0.24, 0.54, 0.26, 0, -0.24, 0, skin, arm, 0.035);
      box(0.255, 0.08, 0.27, 0, -0.47, 0, cuff, arm, 0.01);
      box(0.25, 0.2, 0.27, 0, -0.59, 0, skin, arm, 0.04);
      mergeByMaterial(arm);
      arms.push(arm);
    }
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.215, 0.76, 0);
      rig.add(leg);
      box(0.27, 0.45, 0.29, 0, -0.19, 0, skin, leg, 0.025);
      box(0.285, 0.18, 0.3, 0, -0.43, 0, mat(0xe6e7dd), leg, 0.018);
      box(0.33, 0.2, 0.49, 0, -0.62, 0.095, mat(0xe3eae4, 0.38), leg, 0.04);
      box(0.35, 0.064, 0.5, 0, -0.69, 0.095, mat(0x244250, 0.55), leg, 0.012);
      box(0.34, 0.06, 0.21, 0, -0.59, 0.2, jersey, leg, 0.009);
      mergeByMaterial(leg);
      legs.push(leg);
    }
    const numberTex = canvasTexture(128, 128, (c, w, h) => drawNumber(c, w, h, p.number));
    const numberMat = new THREE.MeshBasicMaterial({ map: numberTex, transparent: true, depthWrite: false });
    for (const front of [1, -1]) {
      const no = new THREE.Mesh(numberGeo, numberMat);
      no.position.set(0, 1.18, front * 0.252);
      if (front < 0) no.rotation.y = Math.PI;
      no.renderOrder = 1;
      rig.add(no);
    }
    box(0.59, 0.034, 0.016, 0, 1.47, 0.252, mat(0xf8edce), rig, 0, false);
    mergeByMaterial(rig);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: home ? COLOR.teal : CREWS[0].accent, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.024;
    scene.add(ring);
    const sh = shadow(1.65);
    playerViews.push({ root, rig, arms, legs, ring, shadow: sh, numberTex });
  }
  const selectedRing = new THREE.Mesh(new THREE.RingGeometry(0.79, 0.86, 48), new THREE.MeshBasicMaterial({ color: COLOR.teal, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
  selectedRing.rotation.x = -Math.PI / 2;
  selectedRing.position.y = 0.031;
  scene.add(selectedRing);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.18);
  arrowShape.lineTo(-0.13, -0.11);
  arrowShape.lineTo(0.13, -0.11);
  arrowShape.closePath();
  const floorArrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: COLOR.teal, side: THREE.DoubleSide }));
  floorArrow.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  floorArrow.position.y = 0.035;
  scene.add(floorArrow);

  // ---- the ball: a faceted core with four dark seams (merged into one mesh)
  const ballView = new THREE.Group();
  const ballMat = new THREE.MeshStandardMaterial({ color: BALL_ORANGE, roughness: 0.66, flatShading: true });
  const ballCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.278, 2), ballMat);
  ballCore.castShadow = true;
  ballView.add(ballCore);
  const seamParts = [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0], [Math.PI / 2, Math.PI / 4, 0]].map((r) => {
    const g = new THREE.TorusGeometry(0.278, 0.008, 4, 40).toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2])));
    return g;
  });
  ballView.add(new THREE.Mesh(mergeGeometries(seamParts, false), mat(0x512d22, 0.82)));
  scene.add(ballView);
  const ballShadow = shadow(0.82);

  // ---- ball trail: one instanced batch, newest first, additive so it glows like the original
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const trail = kit.instanced(new THREE.IcosahedronGeometry(0.13, 0), trailMat, TRAIL);
  trail.frustumCulled = false;
  trail.count = 0;
  trail.visible = false;
  for (let i = 0; i < TRAIL; i++) trail.setColorAt(i, tempC.setHex(COLOR.gold));
  scene.add(trail);
  const trailBuf = Array.from({ length: TRAIL }, () => new THREE.Vector3());
  let trailHead = 0;
  let trailLen = 0;
  let trailColor = -1;

  // ---- particles: a fixed pool; only live particles are written each frame
  const particleCount = kit.detail(220, 90);
  const particleMesh = kit.instanced(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }), particleCount);
  particleMesh.frustumCulled = false;
  scene.add(particleMesh);
  const particles = Array.from({ length: particleCount }, () => ({ life: 0, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, size: 1, spin: 0, parked: false }));
  let particleCursor = 0;
  tempO.position.set(0, -30, 0);
  tempO.rotation.set(0, 0, 0);
  tempO.scale.setScalar(0);
  tempO.updateMatrix();
  for (let i = 0; i < particleCount; i++) {
    particleMesh.setMatrixAt(i, tempO.matrix);
    particleMesh.setColorAt(i, tempC.setHex(COLOR.teal));
    particles[i].parked = true;
  }
  function burst(x, y, z, color, count = 35, power = 1) {
    count = Math.max(1, Math.round(count * Math.min(1, kit.tier.detail + 0.25)));
    for (let i = 0; i < count; i++) {
      const n = particleCursor++ % particleCount;
      const p = particles[n];
      const a = Math.random() * TAU;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * (1 + Math.random() * 4) * power;
      p.vy = (1.5 + Math.random() * 5) * power;
      p.vz = Math.sin(a) * (1 + Math.random() * 4) * power;
      p.life = 0.5 + Math.random() * 0.65;
      p.size = 0.6 + Math.random() * 1.3;
      p.spin = Math.random() * 6;
      p.parked = false;
      particleMesh.setColorAt(n, tempC.setHex(i % 4 === 0 ? COLOR.white : color));
    }
    particleMesh.instanceColor.needsUpdate = true;
  }
  // Ring waves on the floor after a basket: a small reusable pool (no materials made mid-game).
  const waveGeo = new THREE.RingGeometry(0.8, 0.86, 48);
  const waves = Array.from({ length: WAVES }, () => {
    const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: COLOR.teal, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    return { m, life: 0 };
  });
  let waveCursor = 0;
  function wave(x, z, color) {
    const w = waves[waveCursor++ % WAVES];
    w.m.position.set(x, 0.04, z);
    w.m.material.color.setHex(color);
    w.m.visible = true;
    w.life = 0.65;
  }
  function updateParticles(dt) {
    let dirty = false;
    for (let i = 0; i < particleCount; i++) {
      const p = particles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 8 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.06) {
          p.y = 0.06;
          p.vy = Math.abs(p.vy) * 0.3;
          p.vx *= 0.85;
          p.vz *= 0.85;
        }
        tempO.position.set(p.x, p.y, p.z);
        tempO.rotation.set(p.spin + total * 3, total * 4, p.spin);
        tempO.scale.setScalar(p.size * clamp(p.life * 3, 0, 1));
      } else if (!p.parked) {
        p.parked = true;
        tempO.position.set(0, -30, 0);
        tempO.scale.setScalar(0);
      } else continue;
      tempO.updateMatrix();
      particleMesh.setMatrixAt(i, tempO.matrix);
      dirty = true;
    }
    if (dirty) particleMesh.instanceMatrix.needsUpdate = true;
    for (const w of waves) {
      if (w.life <= 0) continue;
      w.life -= dt;
      w.m.scale.setScalar(1 + (1 - w.life / 0.65) * 4.5);
      w.m.material.opacity = Math.max(0, w.life / 0.65) * 0.65;
      if (w.life <= 0) w.m.visible = false;
    }
  }

  // ---- post: bloom on the light banks, a faint chromatic shift at turbo, vignette and grain
  const boost = uniform(0);
  const post = createPost(kit, scene, camera, {
    bloom: { strength: 0.32, radius: 0.3, threshold: 1.0 },
    output: (node, ctx) => {
      // Sample on the same uv as the scene colour itself (as RGBShiftNode does), so the
      // shift is exactly zero when not sprinting on either backend.
      const at = ctx.color.uvNode || uv();
      const off = at.sub(0.5).mul(boost.mul(0.0016));
      const r = ctx.color.sample(at.add(off)).r;
      const b = ctx.color.sample(at.sub(off)).b;
      const shifted = node.add(vec4(r.sub(ctx.color.r), 0, b.sub(ctx.color.b), 0));
      const v = float(1).sub(pow(length(at.sub(0.5).mul(vec2(1, 1.1))), 1.4).mul(0.24));
      const grain = hash(screenCoordinate.x.add(screenCoordinate.y.mul(1931.7)).add(time.mul(613.3))).sub(0.5).mul(0.004);
      return vec4(shifted.rgb.mul(v.mul(v)).add(grain), 1);
    },
  });

  // ---- camera framing
  let menuView = true;
  let camX = -4;
  let camZ = -1.6;
  let camAngle = 0.12;
  let shakeTime = 0;
  let shakePower = 0;
  function fit() {
    const { width: W, height: H } = kit.size;
    const aspect = W / H;
    const half = aspect < 0.85 ? (menuView ? 20 : 14.5) : Math.max(9.4, 18.3 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  }
  kit.onResize(fit);

  // ---- per-frame view update
  const teamHex = (team) => (team === 0 ? COLOR.teal : awayHex);
  let awayHex = CREWS[0].accent;
  let boostLevel = 0;
  function update(dt, { menu, playing }) {
    frameCount++;
    total += dt;
    for (const p of sim.players) {
      const v = playerViews[p.id];
      v.root.visible = p.active;
      v.ring.visible = p.active;
      v.shadow.visible = p.active;
      if (!p.active) continue;
      const speed = Math.hypot(p.vx, p.vz);
      const moving = speed > 0.15;
      const swing = Math.sin(p.run) * clamp(speed / 5, 0, 1) * 0.64;
      v.root.position.set(p.x, p.jump + (moving ? Math.abs(Math.sin(p.run)) * 0.045 : Math.sin(total * 2 + p.id) * 0.017), p.z);
      v.root.rotation.y = p.angle;
      v.rig.rotation.z = p.sprinting ? Math.sin(p.run) * 0.035 : 0;
      v.rig.rotation.x = p.sprinting ? 0.1 : 0;
      v.legs[0].rotation.x = swing;
      v.legs[1].rotation.x = -swing;
      v.arms[0].rotation.x = -swing * 0.8;
      v.arms[1].rotation.x = swing * 0.8;
      v.arms[0].rotation.z = 0.1;
      v.arms[1].rotation.z = -0.1;
      if (p.action === 'charge' || p.action === 'shoot') {
        v.arms[0].rotation.x = -2.2;
        v.arms[1].rotation.x = -2.33;
        v.arms[0].rotation.z = -0.12;
        v.arms[1].rotation.z = 0.12;
      }
      if (p.action === 'dunk') {
        v.arms[0].rotation.x = -2.95;
        v.arms[1].rotation.x = -2.95;
        v.legs[0].rotation.x = 0.38;
        v.legs[1].rotation.x = -0.65;
      }
      if (p.action === 'steal' || p.action === 'pass') {
        v.arms[0].rotation.x = -1.2;
        v.arms[1].rotation.x = -1.35;
      }
      if (sim.ball.mode === 'held' && sim.ball.owner === p.id && p.action === 'idle') v.arms[1].rotation.x = -0.32 - Math.abs(Math.sin(sim.elapsed * 10.5)) * 0.4;
      if (sim.freeze > 0 && sim.ball.shotTeam === p.team) {
        v.arms[0].rotation.x = -2.3;
        v.arms[1].rotation.x = -2.7;
      }
      v.ring.position.set(p.x, 0.024, p.z);
      v.ring.material.opacity = sim.ball.owner === p.id ? 0.65 : 0.21;
      v.shadow.position.set(p.x, 0.018, p.z);
      v.shadow.scale.setScalar(v.shadow.userData.size * (1 + p.jump * 0.2));
      v.shadow.material.opacity = 0.72 - p.jump * 0.15;
      if (p.sprinting && playing && frameCount % 5 === 0) burst(p.x, 0.1, p.z, teamHex(p.team), 1, 0.14);
    }
    const p = sim.players[sim.controlled];
    selectedRing.visible = !menu && !!p;
    floorArrow.visible = !menu && !!p && sim.mode !== 'contest';
    if (p) {
      selectedRing.position.set(p.x, 0.032, p.z);
      selectedRing.scale.setScalar(1 + Math.sin(total * 4) * 0.025);
      floorArrow.position.set(p.x + 1.08, 0.035, p.z);
    }

    const b = sim.ball;
    const onRack = b.mode === 'rack';
    ballView.visible = !onRack;
    ballShadow.visible = !onRack;
    ballView.position.set(b.x, b.y, b.z);
    if (playing) {
      ballView.rotation.x += dt * (b.mode === 'held' ? 2 : 7);
      ballView.rotation.z -= dt * 3;
    }
    const money = sim.mode === 'contest' && sim.derby && sim.derby.shot === 4;
    ballMat.color.setHex(money ? MONEY_GOLD : BALL_ORANGE);
    ballShadow.position.set(b.x, 0.024, b.z);
    ballShadow.scale.setScalar(ballShadow.userData.size * (0.8 + b.y * 0.12));
    ballShadow.material.opacity = clamp(0.8 - b.y * 0.075, 0.13, 0.7);

    // Trail: newest point first; it shrinks away when the ball is held again.
    const onFire = sim.fire[sim.possession] > 0;
    const hasTrail = b.mode === 'shot' || b.mode === 'pass' || onFire;
    if (playing) {
      if (hasTrail && !onRack) {
        trailHead = (trailHead + 1) % TRAIL;
        trailBuf[trailHead].copy(ballView.position);
        trailLen = Math.min(TRAIL, trailLen + 1);
      } else if (trailLen > 0) trailLen--;
    }
    const tc = onFire ? COLOR.orange : COLOR.gold;
    if (tc !== trailColor) {
      trailColor = tc;
      for (let i = 0; i < TRAIL; i++) trail.setColorAt(i, tempC.setHex(tc).multiplyScalar(0.26 * (1 - i / TRAIL)));
      trail.instanceColor.needsUpdate = true;
    }
    const shown = hasTrail ? trailLen : 0;
    trail.count = shown;
    trail.visible = shown > 0;
    for (let i = 0; i < shown; i++) {
      tempO.position.copy(trailBuf[(trailHead - i + TRAIL) % TRAIL]);
      tempO.rotation.set(0, 0, 0);
      tempO.scale.setScalar(1 - (i / TRAIL) * 0.7);
      tempO.updateMatrix();
      trail.setMatrixAt(i, tempO.matrix);
    }
    if (shown) trail.instanceMatrix.needsUpdate = true;

    for (const h of hoopViews) {
      h.bounce = Math.max(0, h.bounce - dt * 2);
      h.net.scale.y = 1 + Math.sin(total * 24) * h.bounce * 0.2;
      h.net.rotation.x = Math.sin(total * 20) * h.bounce * 0.06;
      h.rim.rotation.z = Math.sin(total * 29) * h.bounce * 0.018;
    }
    if (onFire && frameCount % 4 === 0 && b.mode === 'held') burst(b.x, b.y, b.z, COLOR.orange, 2, 0.32);
    if (racks.visible) updateRacks();

    // LED shot clocks
    if (sim.mode === 'practice') setLed(-1, false);
    else if (sim.mode === 'contest') setLed(Math.ceil(sim.time), sim.time < 10);
    else setLed(Math.ceil(sim.shotClock), sim.shotClock < 6);

    // Camera: ease toward the play, a slow drift on the title, shake on big plays.
    const { width: W, height: H } = kit.size;
    const tx = menu ? -4 : W / H < 0.85 ? clamp(b.x * 0.67, -8, 8) : clamp(b.x * 0.09, -1.2, 1.2);
    const tz = -1.6;
    const targetAngle = menu ? 0.12 + Math.sin(total * 0.065) * 0.045 : 0;
    const k = 1 - Math.exp(-dt * 2);
    camX += (tx - camX) * k;
    camZ += (tz - camZ) * k;
    camAngle += (targetAngle - camAngle) * k;
    let sx = 0;
    let sy = 0;
    if (shakeTime > 0) {
      shakeTime -= dt;
      if (opts.shake?.()) {
        sx = (Math.random() - 0.5) * shakePower;
        sy = (Math.random() - 0.5) * shakePower;
      }
    }
    camera.position.set(camX + Math.sin(camAngle) * 32 + sx, 27 + sy, camZ + Math.cos(camAngle) * 32);
    camera.lookAt(camX, 0, camZ);
    camera.updateMatrixWorld();

    const sprinting = playing && !!sim.players[sim.controlled]?.sprinting;
    boostLevel += ((sprinting ? 1 : 0) - boostLevel) * (1 - Math.exp(-dt * 10));
    boost.value = boostLevel;

    animateCrowd(dt);
    updateParticles(dt);
  }

  return {
    scene,
    camera,
    update,
    burst,
    wave,
    setBoard,
    render() {
      post.render();
    },
    get camAngle() {
      return camAngle;
    },
    /** Screen position (CSS px) of a world point, for DOM labels. */
    project(x, y, z, out) {
      tempV.set(x, y, z).project(camera);
      out.x = (tempV.x * 0.5 + 0.5) * kit.size.width;
      out.y = (-0.5 * tempV.y + 0.5) * kit.size.height;
      out.visible = tempV.z > -1 && tempV.z < 1;
      return out;
    },
    setMenu(on) {
      menuView = !!on;
      fit();
    },
    setMode(mode) {
      racks.visible = mode === 'contest';
      rackKey = '';
    },
    bounceHoop(team, amount) {
      const hv = hoopViews.find((h) => h.side === (team === 0 ? 1 : -1));
      if (hv) hv.bounce = Math.max(hv.bounce, amount);
    },
    cheer(power = 1) {
      crowdEnergy = Math.max(crowdEnergy, power);
    },
    shake(time, power) {
      shakeTime = time;
      shakePower = power;
    },
    teamHex,
    /** Recolour team 1 (kits, rings, numbers, the away paint) for a crew. */
    setCrew(crew) {
      awayHex = crew.accent;
      awayCss = crew.css;
      crewMats.jersey.color.setHex(crew.jersey);
      crewMats.shorts.color.setHex(crew.shorts);
      crewMats.cuff.color.setHex(crew.cuff);
      for (let i = 0; i < 3; i++) {
        const v = playerViews[3 + i];
        v.ring.material.color.setHex(crew.accent);
        const t = v.numberTex;
        drawNumber(t.image.getContext('2d'), t.image.width, t.image.height, crew.players[i][1]);
        t.needsUpdate = true;
      }
      if (courtCrew !== crew) {
        courtCrew = crew;
        drawCourt(courtTex.image.getContext('2d'), courtTex.image.width, courtTex.image.height, crew);
        courtTex.needsUpdate = true;
      }
      boardKey = '';
    },
    /** Compile every pipeline before play, hidden pieces included, so the first basket does not stutter. */
    async prewarm() {
      const hidden = [racks, trail, ...waves.map((w) => w.m)];
      for (const o of hidden) o.visible = true;
      trail.count = 1;
      try {
        await renderer.compileAsync(scene, camera);
        // The post chain renders the scene into its own target: one frame builds those pipelines too.
        post.render();
      } catch {
        /* compiling ahead is only an optimisation */
      }
      for (const o of hidden) o.visible = false;
      trail.count = 0;
    },
  };
}
