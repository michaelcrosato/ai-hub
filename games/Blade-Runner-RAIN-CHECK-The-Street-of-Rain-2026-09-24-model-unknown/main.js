/**
 * RAIN CHECK — The Street of Rain.
 *
 * main.js: startup on the shared kit, the isometric city view (three.js r186
 * through kit.renderer, WebGPU with the WebGL2 fallback), ambience, the HUD,
 * dialogs and every investigation screen. Story, residents, cases and world
 * generation live in content.js; menu navigation for keys and controllers in
 * nav.js.
 */
import * as THREE from 'three/webgpu';
import { float, fract, instanceIndex, mix, positionLocal, positionWorld, texture, time, uv, vec3 } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { bakeInstances } from 'kit/instancing.js';
import { activate, adjust, createRepeater, focusEl, focusKey, focusables, neighbour } from './nav.js';
import {
  CASES,
  CASE_SETTINGS,
  CITY_LORE,
  DISTRICT_NAME,
  ITEMS,
  LIFE_PLACES,
  LOCAL_GOODS,
  LOCAL_QUESTS,
  QUEST_BY_ID,
  RESIDENTS,
  RESIDENT_BY_ID,
  SAVE_KEY,
  SHOPS,
  SKILLS,
  STEALTH_COVER,
  STEALTH_WALLS,
  STREET_VOICES,
  THREADS,
  WITNESSES,
  actorPose,
  animatePart,
  buildRoom,
  buyLocal,
  canAfford,
  circuitLayout,
  circuitPower,
  closeCase,
  completeTask,
  countArrival,
  districtDoors,
  districtTotals,
  echoesFor,
  endingFor,
  findPath,
  hasPerk,
  hearResidentTopic,
  hearWitness,
  inspectObservation,
  interviewAnswer,
  isDone,
  isReady,
  lifeParticles,
  localPrice,
  markChanged,
  markHeard,
  markSeen,
  meetResident,
  newGame,
  patrolPositions,
  portrait,
  questNextStep,
  questStatusLabel,
  rankName,
  readLore,
  recordMistake,
  residentsInRoom,
  resolveQuest,
  roomResolved,
  rotateTile,
  startQuest,
  stealthMove,
  taskProgress,
  testQuestDevice,
  timelineSolved,
  trainSkill,
  validateSave,
  walkable,
} from './content.js';

/* ------------------------------------------------------------------------ */
/* Startup and input                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Every control is an action. Keyboard and mouse, gamepad and touch follow the
 * wall's standard bindings; the game's own HUD buttons stay clickable too.
 */
const INPUT = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  interact: { keys: ['KeyE', 'Space', 'Enter', 'NumpadEnter'], gamepad: ['A'], touch: 'Inspect' },
  scan: { keys: ['KeyQ'], gamepad: ['X'], touch: 'Scan' },
  dash: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], mouse: [2], gamepad: ['B', 'RT'], touch: 'Dash' },
  back: { keys: ['Escape', 'Backspace'], gamepad: ['B'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  survey: { keys: ['KeyL'], gamepad: ['Y'] },
  casebook: { keys: ['KeyJ'], gamepad: ['Back'] },
  board: { keys: ['KeyB'] },
  inventory: { keys: ['KeyI'] },
  localMap: { keys: ['KeyM'], gamepad: ['LB'] },
  district: { keys: ['KeyN'], gamepad: ['RB'] },
  quiet: { keys: ['KeyV'], gamepad: ['RS'] },
  zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: 'rightStickY' },
  click: { mouse: [0] },
};

const kit = await boot({
  title: 'RAIN CHECK',
  mount: document.getElementById('stage'),
  gear: 'none', // the game's settings and pause menus open the kit panel (F9 too)
  input: INPUT,
  accent: '#e7b575',
  background: '#0b171e',
});
const input = kit.input;

/* ------------------------------------------------------------------------ */
/* The city view                                                             */
/* ------------------------------------------------------------------------ */

const clampRange = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** A hex colour scaled by k, as a CSS rgb() string (for the 2D close-up studies). */
const shade = (hex, k) => {
  let t = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255, ((t >> 16) & 255) * k) | 0},${Math.min(255, ((t >> 8) & 255) * k) | 0},${Math.min(255, (t & 255) * k) | 0})`;
};

/** Flat-shaded faces of one box for the 2D object-study drawings (the camera looks down the +x/+z diagonal). */
function boxFaces(e) {
  let t = e.x,
    s = e.z,
    i = e.y,
    n = e.w / 2,
    o = e.h / 2,
    a = e.d / 2,
    l = [
      [t - n, i - o, s - a],
      [t + n, i - o, s - a],
      [t + n, i - o, s + a],
      [t - n, i - o, s + a],
      [t - n, i + o, s - a],
      [t + n, i + o, s - a],
      [t + n, i + o, s + a],
      [t - n, i + o, s + a],
    ];
  if (e.rotateY) {
    let c = Math.cos(e.rotateY),
      h = Math.sin(e.rotateY);
    for (let u of l) {
      let d = u[0] - t,
        p = u[2] - s;
      ((u[0] = t + d * c + p * h), (u[2] = s - d * h + p * c));
    }
  }
  const depth = e.y + e.h / 2 <= 0.351 ? -1e4 + (e.y + e.h / 2) * 100 : t + s + i * 0.005;
  return [
    { verts: [l[3], l[2], l[6], l[7]], color: shade(e.color, e.emissive ? 1 : 0.79) },
    { verts: [l[2], l[1], l[5], l[6]], color: shade(e.color, e.emissive ? 1 : 0.58) },
    { verts: [l[4], l[7], l[6], l[5]], color: shade(e.color, e.emissive ? 1 : 1.12) },
  ].map((c) => ({ ...c, depth, alpha: e.alpha ?? 1 }));
}

function cylinderFaces(e) {
  let t = [];
  for (let i = 0; i < 8; i++) {
    let n = (i / 8) * Math.PI * 2;
    t.push([e.x + (Math.cos(n) * e.w) / 2, e.y + e.h / 2, e.z + (Math.sin(n) * e.d) / 2]);
  }
  let s = [{ verts: t, color: shade(e.color, 1.12), depth: e.x + e.z + 0.01 }];
  for (let i = 0; i < 8; i++) {
    let n = t[i],
      o = t[(i + 1) % 8];
    n[0] + o[0] - 2 * e.x + (n[2] + o[2] - 2 * e.z) < 0 ||
      s.push({
        verts: [[n[0], n[1] - e.h, n[2]], [o[0], o[1] - e.h, o[2]], o, n],
        color: shade(e.color, 0.65 + i * 0.035),
        depth: e.x + e.z + 0.02,
      });
  }
  return s.map((i) => ({ ...i, alpha: e.alpha ?? 1 }));
}

function primitiveFaces(e) {
  if (e.type === 'cylinder') return cylinderFaces(e);
  if (e.type === 'cone') {
    let t = [],
      s = [e.x, e.y + e.h / 2, e.z];
    for (let i = 0; i < 6; i++) {
      let n = (i * Math.PI) / 3,
        o = ((i + 1) * Math.PI) / 3,
        a = [e.x + (Math.cos(n) * e.w) / 2, e.y - e.h / 2, e.z + (Math.sin(n) * e.d) / 2],
        l = [e.x + (Math.cos(o) * e.w) / 2, e.y - e.h / 2, e.z + (Math.sin(o) * e.d) / 2];
      t.push({ verts: [a, l, s], color: shade(e.color, 0.7 + i * 0.06), depth: e.x + e.z + 0.07, alpha: e.alpha ?? 1 });
    }
    return t;
  }
  return boxFaces(e);
}

/** Write a Y-rotated, scaled transform straight into a matrix array (no Object3D per instance). */
function writeMatrix(m, o, x, y, z, ry, sx, sy, sz) {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  m[o] = c * sx;
  m[o + 1] = 0;
  m[o + 2] = -s * sx;
  m[o + 3] = 0;
  m[o + 4] = 0;
  m[o + 5] = sy;
  m[o + 6] = 0;
  m[o + 7] = 0;
  m[o + 8] = s * sz;
  m[o + 9] = 0;
  m[o + 10] = c * sz;
  m[o + 11] = 0;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}

/**
 * The isometric city: a fixed orthographic camera that follows Vale, rooms
 * batched into instanced meshes by shape and colour, animated residents and
 * props in a few dynamic batches, instanced TSL rain and a bloom/vignette
 * chain from kit/post.js. A light 2D rain layer draws over it.
 */
class WorldView {
  constructor(kit, weather, onStatus) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.weather = weather;
    this.weatherCtx = weather.getContext('2d');
    this.onStatus = onStatus;
    this.backend = kit.backend;
    this.w = 1;
    this.h = 1;
    this.scale = 30;
    this.cx = 0;
    this.cz = 0;
    this.landing = true;
    this.quality = kit.tier.name === 'low' ? 'low' : 'balanced';
    this.reduced = false;
    this.time = 0;
    this.lifeChanged = new Set();
    this.zoom = 1;
    this.resolved = false;
    this.hero = { x: 0, z: 4, angle: 0, moving: false };
    this.tasks = [];
    this.taskMeshes = [];
    this.hazardMeshes = [];
    this.rain = [];
    let seed = 623;
    for (let n = 0; n < 280; n++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const o = seed / 4294967296;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      this.rain.push({ x: o, y: seed / 4294967296, l: 0.006 + o * 0.016 });
    }

    const renderer = this.renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Interactive low-poly city. Move with the stick or keys, or tap a destination.');

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-20, 20, 16, -16, 0.1, 180);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.materials = new Map();
    this.colors = new Map();
    this.tmpColor = new THREE.Color();
    this.textures = [];
    // Unit shapes shared by every batch in every room; scaled per instance.
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      cone5: new THREE.ConeGeometry(0.5, 1, 5),
      cone6: new THREE.ConeGeometry(0.5, 1, 6),
      plane: new THREE.PlaneGeometry(1, 1),
    };
    for (const g of Object.values(this.geo)) g.userData.shared = true;

    this.scene.add(new THREE.HemisphereLight('#94c4d0', '#56423b', 2));
    const moon = new THREE.DirectionalLight('#b7d3e1', 2.4);
    moon.position.set(-8, 22, 7);
    moon.castShadow = true;
    kit.shadow(moon, 2048); // 2048 at high, scaled for the tier and kept in step with quality changes
    Object.assign(moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 65 });
    moon.shadow.bias = -4e-4;
    moon.shadow.normalBias = 0.035;
    this.scene.add(moon);
    this.moon = moon;
    this.pointLights = [];
    for (const [x, z, color, intensity] of [
      [-6, -3, '#ffac52', 95],
      [7, -3, '#ef6fac', 70],
      [3, 4, '#52dae0', 48],
    ]) {
      const light = new THREE.PointLight(color, intensity, 22, 2);
      light.position.set(x, 4, z);
      this.scene.add(light);
      this.pointLights.push(light);
    }
    this.heroGroup = this.makePerson('#b68d63', true);
    this.scene.add(this.heroGroup);

    // Instanced TSL rain around the camera: one draw call, animated on the GPU.
    this.rainMaterial = new THREE.MeshBasicNodeMaterial({ color: '#8faab8', transparent: true, opacity: 0.25, depthWrite: false });
    this.rainMaterial.positionNode = positionLocal.add(vec3(0, fract(time.mul(-0.52).add(float(instanceIndex).mul(0.618))).mul(20), 0));
    this.rainGeometry = new THREE.BoxGeometry(0.014, 0.34, 0.014);
    this.rainMesh = null; // built by resize(), which knows the screen width
    this.rainOn = false;

    this.post = createPost(kit, this.scene, this.camera, {
      bloom: { strength: 0.36, radius: 0.28, threshold: 0.9 },
      // The original vignette: darken toward the corners after bloom.
      output: (color) => color.mul(uv().sub(0.5).length().mul(0.36).oneMinus()),
    });

    kit.onQuality((tier) => {
      this.quality = tier.name === 'low' ? 'low' : 'balanced';
      this.buildRain();
    });
    this.onStatus(`${kit.backendLabel.toUpperCase()} \xB7 THREE r${THREE.REVISION}`);
  }

  /** The rain field scales its drop count with the quality tier. */
  buildRain() {
    const count = this.kit.detail(this.w < 700 ? 320 : 650);
    if (this.rainMesh?.count === count) return;
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.dispose();
    }
    const mesh = new THREE.InstancedMesh(this.rainGeometry, this.rainMaterial, count);
    const m = mesh.instanceMatrix.array;
    for (let h = 0; h < count; h++)
      writeMatrix(m, h * 16, ((Math.sin(h * 78.13) * 437.9) % 1) * 24, 0, ((Math.sin(h * 27.17) * 813.6) % 1) * 24, 0, 1, 1, 1);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.visible = this.rainOn && !this.reduced;
    this.scene.add(mesh);
    this.rainMesh = mesh;
  }

  /** Compile every pipeline the first room needs before the first frame, so the opening does not stutter. */
  async warm() {
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch (err) {
      console.warn('Shader pre-compile skipped:', err?.message || err);
    }
  }

  resize() {
    this.w = this.kit.size.width;
    this.h = this.kit.size.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const t = this.weather;
    t.width = Math.round(this.w * dpr);
    t.height = Math.round(this.h * dpr);
    t.style.width = this.w + 'px';
    t.style.height = this.h + 'px';
    this.weatherCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.applyScale();
    this.buildRain();
  }

  /** World units to CSS pixels, from the screen size, the title-screen framing and the player's zoom. */
  applyScale() {
    this.scale = Math.max(this.h / 33, this.w / (this.landing ? 63 : 56));
    if (this.w < 700) this.scale = Math.max(this.w / 27, this.h / 35);
    this.scale *= this.zoom;
    this.updateCamera();
  }

  setWorld(world, tasks) {
    this.world = world;
    this.tasks = tasks;
    this.cx = 0;
    this.cz = 0;
    this.buildThreeWorld();
  }

  screen(e, t, s) {
    return {
      x: this.w * (this.landing && this.w > 700 ? 0.68 : 0.5) + (e - this.cx - (s - this.cz)) * 0.707106 * this.scale,
      y: this.h * (this.landing ? 0.55 : 0.49) + (e - this.cx + (s - this.cz)) * 0.455 * this.scale - t * 0.765 * this.scale,
    };
  }

  ground(e, t) {
    let s = (e - this.w * (this.landing && this.w > 700 ? 0.68 : 0.5)) / (0.707106 * this.scale),
      i = (t - this.h * (this.landing ? 0.55 : 0.49)) / (0.455 * this.scale);
    return { x: (s + i) / 2 + this.cx, z: (i - s) / 2 + this.cz };
  }

  updateCamera() {
    if (!this.camera) return;
    let e = this.cx,
      t = this.cz,
      s = (this.w * (this.landing && this.w > 700 ? 0.68 : 0.5) - this.w * 0.5) / this.scale;
    ((e -= s / 1.414212), (t += s / 1.414212));
    let i = (this.h * (this.landing ? 0.55 : 0.49) - this.h * 0.5) / this.scale;
    ((e -= i / 0.91), (t -= i / 0.91));
    let n = this.h / this.scale / 2,
      o = this.w / this.scale / 2;
    Object.assign(this.camera, { left: -o, right: o, top: n, bottom: -n });
    this.camera.position.set(e + 26, 31, t + 26);
    this.camera.lookAt(e, 0, t);
    this.camera.updateProjectionMatrix();
  }

  personBoxes(e, t, s, i = false, n = 0, o = false) {
    let a = (c, h, u, d, p, f, g) => ({ type: 'box', x: e + c, y: h, z: t + u, w: d, h: p, d: f, color: g }),
      l = o ? Math.sin(n) * 0.16 : 0;
    return [
      a(-0.17, 0.3, l, 0.22, 0.56, 0.3, '#243540'),
      a(0.17, 0.3, -l, 0.22, 0.56, 0.3, '#243540'),
      a(0, 0.95, 0, 0.72, 0.86, 0.47, s),
      a(0, 1.21, 0.26, 0.11, 0.48, 0.05, '#403c39'),
      a(-0.47, 0.95, -l, 0.19, 0.66, 0.25, s),
      a(0.47, 0.95, l, 0.19, 0.66, 0.25, s),
      a(-0.47, 0.59, -l, 0.17, 0.18, 0.23, '#c9a57f'),
      a(0.47, 0.59, l, 0.17, 0.18, 0.23, '#c9a57f'),
      a(0, 1.62, 0, 0.5, 0.5, 0.47, '#c7a27e'),
      a(0, 1.91, -0.02, 0.53, 0.14, 0.49, i ? '#3b302c' : '#4f4d49'),
      a(-0.11, 1.64, 0.241, 0.055, 0.055, 0.022, '#27343b'),
      a(0.11, 1.64, 0.241, 0.055, 0.055, 0.022, '#27343b'),
      ...(i ? [a(0.2, 1.15, 0.248, 0.09, 0.12, 0.025, '#d8af59')] : []),
    ];
  }

  carBoxes(e) {
    return [
      { ...e, type: 'box', h: 0.58, y: e.y },
      { ...e, type: 'box', w: e.w * 0.8, h: 0.55, d: e.d * 0.44, y: e.y + 0.45, z: e.z - 0.15, color: '#588c99' },
      { ...e, type: 'box', w: e.w * 0.72, h: 0.08, d: e.d * 0.3, y: e.y + 0.77, z: e.z - 0.2, color: '#30464f' },
      ...[-1, 1].map((t) => ({ ...e, type: 'box', x: e.x + t * 0.68, z: e.z + e.d / 2 + 0.02, w: 0.5, h: 0.14, d: 0.06, y: e.y, color: '#edc989', emissive: 1 })),
      ...[-1, 1].map((t) => ({ ...e, type: 'box', x: e.x + t * 0.9, z: e.z - 0.5, w: 0.23, h: 0.33, d: 0.9, y: e.y - 0.4, color: '#162730' })),
    ];
  }

  drawWeather(e) {
    let t = this.weatherCtx;
    t.clearRect(0, 0, this.w, this.h);
    if (this.world?.mood === 'dawn' || this.world?.indoor || this.reduced) return;
    const s = Math.min(this.rain.length, this.kit.detail(this.w < 700 ? 100 : 200));
    t.strokeStyle = '#c5dee52a';
    t.lineWidth = 0.7;
    t.beginPath();
    for (let i = 0; i < s; i++) {
      let n = this.rain[i],
        o = ((n.y + e * 0.45) % 1) * this.h,
        a = ((((n.x - e * 0.03) % 1) + 1) % 1) * this.w;
      (t.moveTo(a, o), t.lineTo(a - 3 - n.l * 100, o + n.l * this.h));
    }
    t.stroke();
    if (this.world?.hazards.length && Math.sin(e * 0.34) > 0.997) {
      t.fillStyle = '#b3cde318';
      t.fillRect(0, 0, this.w, this.h);
    }
  }

  setLifeState(e, t = false) {
    this.lifeChanged = new Set(e || []);
    this.resolved = t;
  }

  setZoom(e) {
    this.zoom = clampRange(e, 0.85, 1.7);
    this.applyScale();
  }

  orientParts(e, t, s, i) {
    let n = Math.cos(i),
      o = Math.sin(i);
    return e.map((a) => {
      let l = a.x - t,
        c = a.z - s;
      return { ...a, x: t + l * n + c * o, z: s - l * o + c * n, rotateY: i };
    });
  }

  actorGeometry(e, t, s) {
    let i = actorPose(e, t, s, this.reduced);
    if (e.crowd) return this.crowdGeometry(e, i, t);
    let n = this.personBoxes(i.x, i.z, i.color || '#7f9797', false, i.phase, i.moving);
    if (e.skin) for (let a of [6, 7, 8]) n[a].color = e.skin;
    let o = this.reduced ? 0 : Math.sin(t * 1.6 + (e.phase || 0)) * 0.018;
    if (
      (n.forEach((a, l) => {
        l > 1 && (a.y += o);
      }),
      i.moving ||
        (i.routine === 'work' && ((n[4].y += 0.16 + Math.sin(this.reduced ? 0 : t * 2) * 0.08), (n[4].z += 0.13), (n[6].y += 0.2), (n[6].z += 0.13)),
        i.routine === 'sip' && ((n[5].y += 0.27), (n[7].y += 0.45))),
      i.routine === 'sip' && n.push({ type: 'cylinder', x: i.x + 0.43, y: i.moving ? 0.85 : 1.18, z: i.z + 0.1, w: 0.18, h: 0.23, d: 0.18, color: '#d7c5a7' }),
      i.routine === 'read' && n.push({ type: 'box', x: i.x, y: 1.15, z: i.z + 0.37, w: 0.51, h: 0.08, d: 0.33, color: '#d2c6aa' }),
      i.umbrella &&
        (n.push({ type: 'box', x: i.x + 0.38, y: 1.8, z: i.z, w: 0.035, h: 1.6, d: 0.035, color: '#6a838c' }),
        n.push({ type: 'cone', x: i.x + 0.18, y: 2.66, z: i.z, w: 1.63, h: 0.42, d: 1.63, color: e.color || '#826e69' })),
      i.style === 'toy')
    )
      for (let a of n) ((a.x = i.x + (a.x - i.x) * 0.55), (a.z = i.z + (a.z - i.z) * 0.55), (a.y *= 0.55), (a.w *= 0.55), (a.h *= 0.55), (a.d *= 0.55));
    return this.orientParts(n, i.x, i.z, i.angle);
  }

  crowdGeometry(e, t, s) {
    let i = (c, h, u, d, p, f, g) => ({ type: 'box', x: t.x + c, y: h, z: t.z + u, w: d, h: p, d: f, color: g }),
      n = t.moving ? Math.sin(t.phase) * 0.14 : 0,
      o = e.skin || '#b89576',
      a = [
        i(-0.16, 0.28, n, 0.23, 0.52, 0.3, '#253d49'),
        i(0.16, 0.28, -n, 0.23, 0.52, 0.3, '#253d49'),
        i(0, 0.9, 0, 0.66, 0.79, 0.43, e.color),
        i(-0.42, 0.91, -n, 0.18, 0.58, 0.22, e.color),
        i(0.42, 0.91, n, 0.18, 0.58, 0.22, e.color),
        i(0, 1.5, 0, 0.46, 0.46, 0.43, o),
        i(0, 1.76, -0.025, 0.49, 0.1, 0.46, e.accessory % 2 ? '#354452' : '#51463d'),
      ];
    (e.accessory === 0
      ? a.push(i(0, 1.77, 0.2, 0.54, 0.075, 0.4, '#8e9178'))
      : e.accessory === 1
        ? a.push(i(0, 0.96, -0.34, 0.56, 0.61, 0.25, '#4d696d'))
        : e.accessory === 2
          ? a.push(i(0.4, 0.53, 0.08, 0.36, 0.4, 0.18, '#b79c76'))
          : e.accessory === 3
            ? a.push(i(0, 1.28, 0.24, 0.6, 0.16, 0.055, '#b2a78a'))
            : e.accessory === 4
              ? a.push(i(0, 1.08, 0.38, 0.61, 0.46, 0.37, '#8b7057'))
              : a.push(i(0, 1.55, 0.23, 0.45, 0.1, 0.03, '#719fab')),
      t.umbrella &&
        (a.push(i(0.29, 1.78, 0, 0.03, 1.6, 0.03, '#73959b')), a.push({ type: 'cone', x: t.x + 0.15, y: 2.48, z: t.z, w: 1.35, h: 0.34, d: 1.35, color: e.color })));
    let l = e.bodyScale || 1;
    for (let c of a) ((c.x = t.x + (c.x - t.x) * l), (c.z = t.z + (c.z - t.z) * l), (c.y *= l), (c.w *= l), (c.h *= l), (c.d *= l));
    return this.orientParts(a, t.x, t.z, t.angle);
  }

  /** Every animated part in the room this frame: props that react, residents, the crowd, particles, flying cars. */
  livingGeometry(e, t) {
    if (!this.world) return [];
    let i = (this.world.living || []).map((n) => animatePart(n, e, this.lifeChanged, this.reduced));
    for (let n of this.world.lifeActors || []) i.push(...this.actorGeometry(n, e, t));
    for (let n of this.world.districtDevices || []) {
      let o = this.districtFinished?.has(n.quest),
        a = this.reduced ? 0 : Math.sin(e * 3);
      (i.push({ type: 'box', x: n.x, y: 1.59, z: n.z - 0.9, w: 0.43, h: 0.08, d: 0.04, color: o ? '#9ddcc1' : '#b99a73', emissive: 1 }),
        i.push({
          type: 'box',
          x: n.x + 0.48,
          y: 1.12 + (n.quest === 'bird' && o ? Math.abs(a) * 0.08 : 0),
          z: n.z - 0.77,
          w: n.quest === 'bird' ? 0.3 : 0.22,
          h: 0.24,
          d: 0.35,
          color: o ? '#c9c8a5' : '#69777b',
          hidden: !o,
        }));
    }
    (this.world.district &&
      i.push({
        type: 'box',
        x: t.x + 0.21 * Math.cos(t.angle || 0) + 0.25 * Math.sin(t.angle || 0),
        y: 1.22,
        z: t.z - 0.21 * Math.sin(t.angle || 0) + 0.25 * Math.cos(t.angle || 0),
        w: 0.11,
        h: 0.07,
        d: 0.035,
        color: '#99c8b4',
        hidden: !this.hasPin,
        rotateY: t.angle || 0,
      }),
      this.world.districtPlace?.id === 'shrine' &&
        i.push({ type: 'box', x: 0, y: 1.2, z: -7, w: 0.14, h: 0.3, d: 0.14, color: '#ffd897', emissive: 1, hidden: !this.hasCandle }),
      i.push(...lifeParticles(this.world, e, this.lifeChanged, this.reduced, this.quality)));
    for (let n of this.world.objects) {
      if (n.type !== 'car' || !n.fly) continue;
      let o = this.reduced ? 0 : e * 0.6,
        a = ((n.x + o + 32) % 64) - 32;
      i.push(...this.carBoxes({ ...n, x: a, y: n.y + (this.reduced ? 0 : Math.sin(e * 0.35) * 0.12) }));
    }
    return i;
  }

  /** A THREE.Color for a CSS colour string, parsed once. */
  colorOf(css) {
    let c = this.colors.get(css);
    if (!c) this.colors.set(css, (c = new THREE.Color(css)));
    return c;
  }

  unitGeometry(type, coneSides = 5) {
    return type === 'cylinder' ? this.geo.cylinder : type === 'cone' ? (coneSides === 6 ? this.geo.cone6 : this.geo.cone5) : this.geo.box;
  }

  buildLivingBatches() {
    this.livingBatches = [];
    let t = this.livingGeometry(this.time, this.hero),
      s = new Map();
    t.forEach((i, n) => {
      let o = [i.type, !!i.particle, !!i.emissive].join(':');
      (s.has(o) || s.set(o, []), s.get(o).push(n));
    });
    for (let ids of s.values()) {
      let n = t[ids[0]],
        a =
          n.particle || n.emissive
            ? new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: !!n.particle, opacity: n.particle ? 0.18 : 1, depthWrite: !n.particle })
            : new THREE.MeshStandardNodeMaterial({ color: '#ffffff', roughness: 0.63, metalness: 0.12 }),
        l = new THREE.InstancedMesh(this.unitGeometry(n.type, 6), a, ids.length);
      l.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      l.frustumCulled = false;
      l.castShadow = !n.particle && !n.emissive;
      l.receiveShadow = !n.particle;
      this.group.add(l);
      this.livingBatches.push({ mesh: l, ids, colorKeys: new Array(ids.length).fill(null) });
    }
    this.updateLivingBatches(this.time, this.hero);
  }

  /** Move every animated part; colours are only re-uploaded when one actually changes. */
  updateLivingBatches(e, t) {
    if (!this.livingBatches) return;
    const parts = this.livingGeometry(e, t),
      color = this.tmpColor;
    for (const { mesh, ids, colorKeys } of this.livingBatches) {
      const m = mesh.instanceMatrix.array;
      let colorsDirty = false;
      for (let l = 0; l < ids.length; l++) {
        const c = parts[ids[l]];
        if (!c) continue;
        const h = c.hidden ? 0 : 1;
        writeMatrix(m, l * 16, c.x, c.y, c.z, c.rotateY || 0, c.w * h, c.h * h, c.d * h);
        const light = c.motion === 'light' ? (c.alpha ?? 1) : 1;
        const key = light === 1 ? c.color : c.color + '*' + light;
        if (colorKeys[l] !== key) {
          colorKeys[l] = key;
          color.copy(this.colorOf(c.color));
          if (light !== 1) color.multiplyScalar(light);
          mesh.setColorAt(l, color);
          colorsDirty = true;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (this.pointLights[0]) this.pointLights[0].intensity = this.resolved ? 78 : 65;
  }

  mat(e, t = 0, s = false) {
    let i = e + ':' + t + ':' + s;
    if (this.materials.has(i)) return this.materials.get(i);
    let a = new THREE.MeshStandardNodeMaterial({ color: e, roughness: s ? 0.22 : 0.64, metalness: s ? 0.55 : 0.16 });
    if ((t && ((a.emissive = new THREE.Color(e)), (a.emissiveIntensity = t)), s)) {
      // Wet asphalt: roughness ripples across the ground so the neon breaks up in puddles.
      let l = positionWorld.x.mul(1.8).sin().mul(positionWorld.z.mul(2.7).sin()).mul(0.5).add(0.5);
      a.roughnessNode = mix(float(0.13), float(0.39), l);
    }
    return ((a.userData.shared = true), this.materials.set(i, a), a);
  }

  makeMesh(e) {
    let s;
    e.type === 'cylinder'
      ? (s = new THREE.CylinderGeometry(e.w / 2, e.w / 2, e.h, 8))
      : e.type === 'cone'
        ? (s = new THREE.ConeGeometry(e.w / 2, e.h, 5))
        : (s = new THREE.BoxGeometry(e.w, e.h, e.d));
    let i = new THREE.Mesh(s, this.mat(e.color, e.emissive || 0, e.wet));
    return (i.position.set(e.x, e.y, e.z), (i.castShadow = e.h > 0.25 && !e.emissive), (i.receiveShadow = true), i);
  }

  makePerson(e, t = false) {
    let i = new THREE.Group(),
      n = this.personBoxes(0, 0, e, t);
    for (let o of n) i.add(this.makeMesh(o));
    return ((i.userData.legs = [i.children[0], i.children[1]]), (i.userData.arms = [i.children[4], i.children[5]]), i);
  }

  /** A sign's text drawn once into a canvas texture; smaller canvases on the lighter tiers. */
  signTexture(o) {
    const big = this.kit.tier.name === 'high' || this.kit.tier.name === 'ultra';
    const W = big ? 1024 : 512,
      H = W / 4;
    const a = document.createElement('canvas');
    a.width = W;
    a.height = H;
    const l = a.getContext('2d');
    l.fillStyle = o.color;
    l.textAlign = 'center';
    l.textBaseline = 'middle';
    l.font = `bold ${Math.round(W * 0.1025)}px monospace`;
    l.fillText(o.text, W / 2, H * 0.527, W * 0.967);
    const c = new THREE.CanvasTexture(a);
    c.colorSpace = THREE.SRGBColorSpace;
    c.anisotropy = 4;
    this.textures.push(c);
    return c;
  }

  buildThreeWorld() {
    if (!this.world) return;
    for (; this.group.children.length; ) {
      let o = this.group.children[0];
      (o.traverse((a) => {
        (a.geometry && !a.geometry.userData.shared && a.geometry.dispose(),
          a.isInstancedMesh && a.dispose(),
          a.material && !a.material.userData.shared && a.material.dispose());
      }),
        this.group.remove(o));
    }
    for (let o of this.textures) o.dispose();
    ((this.textures = []),
      (this.scene.background = new THREE.Color(this.world.mood === 'dawn' ? '#5c777c' : '#0c1b27')),
      (this.scene.fog = new THREE.FogExp2(this.scene.background, this.world.indoor ? 0.011 : 0.017)),
      this.pointLights.forEach((o, a) => {
        let l = this.world.lifeLights?.[a];
        l && (o.position.set(l.x, 3.5, l.z), o.color.set(l.color), (o.intensity = a === 0 ? 65 : 48));
      }));
    let s = new Map(),
      i = new Map(),
      n = (o) => {
        let a = [o.type, o.color, o.emissive || 0, !!o.wet, o.h > 0.25 && !o.emissive].join('|');
        (s.has(a) || s.set(a, []), s.get(a).push(o));
      };
    for (let o of this.world.objects)
      if (!(o.type === 'car' && o.fly)) {
        if (o.type === 'glow') {
          let a = Math.max(0.035, Math.round(o.alpha * 20) / 20),
            l = o.color + ':' + a;
          (i.has(l) || i.set(l, { color: o.color, opacity: a, objects: [] }), i.get(l).objects.push(o));
          continue;
        }
        if (o.type === 'sign') {
          const c = this.signTexture(o);
          let h = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
          const tex = texture(c);
          ((h.colorNode = tex.rgb.mul(2.1)), (h.opacityNode = tex.a));
          let u = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.w * 0.25), h);
          (u.position.set(o.x, o.y, o.z + 0.08), this.group.add(u));
          continue;
        }
        if (o.type === 'car') {
          if (!o.fly) for (let a of this.carBoxes(o)) n(a);
          continue;
        }
        n(o);
      }
    for (let o of this.world.npcs)
      for (let a of this.personBoxes(o.x, o.z, o.color))
        (o.style === 'toy' && ((a.x = o.x + (a.x - o.x) * 0.6), (a.z = o.z + (a.z - o.z) * 0.6), (a.y *= 0.6), (a.w *= 0.6), (a.h *= 0.6), (a.d *= 0.6)), n(a));
    for (let o of this.tasks.filter((a) => a.kind === 'talk'))
      for (let a of this.personBoxes(o.x, o.z - 0.55, o.id === 'ori' ? '#7f9395' : o.id === 'lark' ? '#ad7f8e' : '#788b82')) n(a);
    for (let o of s.values()) {
      let a = o[0],
        c = new THREE.InstancedMesh(this.unitGeometry(a.type, 5), this.mat(a.color, a.emissive || 0, a.wet), o.length),
        m = c.instanceMatrix.array;
      o.forEach((u, d) => writeMatrix(m, d * 16, u.x, u.y, u.z, 0, u.w, u.h, u.d));
      c.instanceMatrix.needsUpdate = true;
      c.castShadow = a.h > 0.25 && !a.emissive;
      c.receiveShadow = true;
      // Static: one merged mesh per colour, so the street shares shaders instead of compiling per batch.
      this.group.add(bakeInstances(c));
    }
    for (let o of i.values()) {
      let a = new THREE.MeshBasicNodeMaterial({ color: o.color, transparent: true, depthWrite: false });
      a.opacityNode = uv().sub(0.5).length().mul(2).oneMinus().max(0).pow(2).mul(o.opacity);
      let l = new THREE.InstancedMesh(this.geo.plane, a, o.objects.length),
        c = new THREE.Object3D();
      (o.objects.forEach((h, u) => {
        (c.position.set(h.x, 0.056, h.z), (c.rotation.x = -Math.PI / 2), c.scale.set(h.w * 2, h.d * 2, 1), c.updateMatrix(), l.setMatrixAt(u, c.matrix));
      }),
        this.group.add(bakeInstances(l)));
    }
    (this.buildLivingBatches(), (this.taskMeshes = []));
    for (let o of this.tasks) {
      let a = new THREE.MeshBasicNodeMaterial({ color: '#d5b377', transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
        l = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.39, 24), a);
      ((l.rotation.x = -Math.PI / 2), l.position.set(o.x, 0.1, o.z), this.group.add(l), this.taskMeshes.push(l));
    }
    this.hazardMeshes = [];
    for (let o of this.world.hazards) {
      let a = new THREE.MeshBasicNodeMaterial({ color: '#ef905d', transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
        l = new THREE.Mesh(new THREE.RingGeometry(o.r - 0.08, o.r, 32), a);
      ((l.rotation.x = -Math.PI / 2), l.position.set(o.x, 0.12, o.z), this.group.add(l), this.hazardMeshes.push(l));
    }
    this.rainOn = !this.world.indoor && this.world.mood !== 'dawn';
  }

  render(e, t, dt = 1 / 60) {
    if (!this.world) return;
    this.time = e;
    this.hero = t;
    // Frame-rate independent follow (the original eased 5.5% per 60 Hz frame).
    const s = !this.landing && (this.w < 700 || this.world?.isStreetHub) ? 1 : this.landing ? 0 : 0.15,
      k = 1 - Math.exp(-3.4 * Math.min(dt, 0.1));
    this.cx += (t.x * s - this.cx) * k;
    this.cz += ((t.z - 1.5) * s - this.cz) * k;
    if (this.rainMesh) {
      this.rainMesh.visible = this.rainOn && !this.reduced;
      this.rainMesh.position.set(this.cx, 0, this.cz);
    }
    this.updateLivingBatches(e, t);
    this.updateCamera();
    if (this.world.isStreetHub) {
      this.moon.position.set(this.cx - 8, 22, this.cz + 7);
      this.moon.target.position.set(this.cx, 0, this.cz);
      this.moon.target.updateMatrixWorld();
    }
    this.heroGroup.position.set(t.x, 0, t.z);
    this.heroGroup.rotation.y = t.angle || 0;
    const swing = t.moving ? Math.sin(e * 10) * 0.28 : 0;
    this.heroGroup.userData.legs.forEach((n, o) => (n.rotation.x = (o ? 1 : -1) * swing));
    this.heroGroup.userData.arms.forEach((n, o) => (n.rotation.x = (o ? -1 : 1) * swing * 0.8));
    this.taskMeshes.forEach((n, o) => {
      const a = this.tasks[o];
      n.visible = !a.done;
      n.material.opacity = a.ready ? 0.55 : 0.15;
    });
    this.hazardMeshes.forEach((n, o) => (n.material.opacity = (e + this.world.hazards[o].phase) % 3.2 > 2.05 ? 0.9 : 0.15));
    this.post.render();
    this.drawWeather(e);
  }
}

/* ------------------------------------------------------------------------ */
/* The night: state, ambience, HUD, dialogs and investigations              */
/* ------------------------------------------------------------------------ */

var byId = (r) => document.getElementById(r),
  esc = (r) => String(r).replace(/[&<>"']/g, (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e]),
  clamp = (r, e, t) => Math.max(e, Math.min(t, r));
function readJSON(r, e) {
  try {
    return JSON.parse(localStorage.getItem(r)) ?? e;
  } catch {
    return e;
  }
}
var prefs = {
    audio: !0,
    assisted: !1,
    captions: !0,
    detailHints: !0,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    zoom: 1,
    ...readJSON("rain-check-settings-v1", {}),
  },
  savedGame = validateSave(readJSON(SAVE_KEY, null)) || validateSave(readJSON("rain-check-save-v1", null)),
  state = savedGame || newGame(),
  world,
  targets = [],
  hero = { x: 0, z: 5, angle: 0, moving: !1, target: null },
  playing = !1,
  modalOpen = !1,
  modalCloseable = !0,
  modalReturnFocus = null,
  heroPath = [],
  walkTarget = null,
  worldTime = 0,
  lastAutosaveAt = 0,
  hurtUntil = 0,
  scanRevealUntil = 0,
  scanReadyAt = 0,
  toastTimer,
  modalSerial = 0,
  storageWarned = !1,
  roomEnteredAt = 0,
  captionUntil = 0,
  nextActorLineAt = 0,
  lastActorLine = -1,
  queuedCaption = null,
  arrivalLine = null,
  quietView = !1,
  nearTarget = null,
  caseTasks = [],
  afterDoor = null,
  modalCleanup = null,
  // A dialog can take over directional input (the patrol grid, the lane crossing, the photo view) and run per-frame work.
  modalDirection = null,
  modalTick = null,
  modalConfirm = null,
  modalFocus = null,
  keepFocus = "",
  markerEls = [],
  meterCache = { hp: NaN, focus: NaN },
  interactLabel = "",
  minimapBase = null,
  minimapFrame = 0,
  tapStart = null,
  zoomSaveTimer = 0,
  nextStreetVoiceAt = 18,
  streetVoiceCount = 0,
  view = new WorldView(kit, byId("weather"), (r) => (byId("renderer-status").textContent = r));
view.reduced = prefs.reduced;
view.zoom = clamp(Number(prefs.zoom) || 1, 0.85, 1.7);
kit.onResize(() => view.resize());
var ROOM_SOUNDS = {
    kitchen: [73, 1450, 0.08, "metal"],
    drains: [48, 520, 0.075, "drip"],
    garage: [55, 780, 0.05, "metal"],
    office: [110, 620, 0.022, "bell"],
    tape: [82, 1800, 0.038, "click"],
    archive: [65, 390, 0.021, "paper"],
    hotel: [73, 540, 0.023, "drip"],
    home: [82, 670, 0.017, "piano"],
    laundry: [58, 930, 0.065, "metal"],
    darkroom: [69, 730, 0.025, "drip"],
    market: [98, 1350, 0.05, "bell"],
    workshop: [73, 860, 0.033, "click"],
    freight: [49, 480, 0.055, "metal"],
    cold: [46, 760, 0.04, "click"],
    clinical: [110, 1500, 0.021, "click"],
    club: [55, 780, 0.032, "bass"],
    backstage: [55, 460, 0.019, "bass"],
    studio: [82, 1200, 0.025, "click"],
    wind: [42, 950, 0.07, "wind"],
    electrical: [60, 600, 0.04, "click"],
    shelter: [65, 480, 0.048, "drip"],
    toys: [110, 650, 0.018, "toy"],
    garden: [98, 1300, 0.018, "bird"],
    tower: [73, 360, 0.017, "bell"],
    vault: [55, 480, 0.02, "click"],
    security: [82, 900, 0.025, "radio"],
    storm: [37, 650, 0.095, "wind"],
    harbour: [65, 760, 0.048, "bird"],
    terminal: [98, 1100, 0.026, "bell"],
    ferry: [49, 410, 0.046, "water"],
  },
  Ambience = class {
    constructor() {
      ((this.ctx = null),
        (this.master = null),
        (this.nextNote = 0),
        (this.sequence = 0),
        (this.tones = []),
        (this.nextAccent = 0),
        (this.lastStep = 0),
        (this.room = null),
        (this.created = 0));
    }
    start() {
      if (prefs.audio)
        try {
          if (this.ctx) {
            (this.ctx.resume().catch(() => {}), this.mute());
            return;
          }
          ((this.ctx = new (window.AudioContext || window.webkitAudioContext)()),
            (this.master = this.ctx.createGain()),
            (this.master.gain.value = 0.2),
            this.master.connect(this.ctx.destination));
          for (let i = 0; i < 3; i++) {
            let n = this.ctx.createOscillator(),
              o = this.ctx.createGain();
            ((n.type = "sine"),
              (n.frequency.value = 55 * (i + 1)),
              (o.gain.value = 0.08 / (i + 1)),
              n.connect(o).connect(this.master),
              n.start(),
              this.tones.push({ osc: n, gain: o }));
          }
          this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
          let e = this.noiseBuffer.getChannelData(0),
            t = 731;
          for (let i = 0; i < e.length; i++) ((t = (t * 1664525 + 1013904223) >>> 0), (e[i] = t / 2147483648 - 1));
          let s = this.ctx.createBufferSource();
          ((this.noiseFilter = this.ctx.createBiquadFilter()),
            (this.noiseGain = this.ctx.createGain()),
            (s.buffer = this.noiseBuffer),
            (s.loop = !0),
            (this.noiseFilter.type = "lowpass"),
            (this.noiseFilter.frequency.value = 1e3),
            (this.noiseGain.gain.value = 0.04),
            s.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master),
            s.start(),
            (this.noise = s),
            this.setRoom(world));
        } catch (e) {
          console.info("Audio unavailable:", e.message);
        }
    }
    mute() {
      (this.master && this.master.gain.setTargetAtTime(prefs.audio ? 0.2 : 0, this.ctx.currentTime, 0.15),
        prefs.audio && !this.ctx && this.start());
    }
    /** Browsers start audio suspended until a gesture; call on every tap, click and key. */
    unlock() {
      if (this.ctx && this.ctx.state === "suspended" && prefs.audio && !this.paused && !document.hidden) this.ctx.resume().catch(() => {});
    }
    /** The kit's settings panel and the game's pause stop the ambience; resuming picks it back up. */
    setPaused(p) {
      this.paused = p;
      if (!this.ctx) return;
      p ? this.ctx.suspend().catch(() => {}) : prefs.audio && !document.hidden && this.ctx.resume().catch(() => {});
    }
    /** Play one recorded take for the Closing Song field work: semitones above middle C, null is a silent beat. */
    playTake(take) {
      if (!prefs.audio) return !1;
      this.ctx || this.start();
      if (!this.ctx) return !1;
      this.unlock();
      take.notes.forEach((n, i) => n === null || this.tone(261.63 * 2 ** (n / 12), 0.32, 0.075, 0, "triangle", i * 0.36));
      take.mark && this.tone(2637, 0.06, 0.05, 0.3, "square", take.notes.length * 0.36 + 0.08);
      return !0;
    }
    setRoom(e) {
      if (((this.room = e), !this.ctx || !e)) return;
      let t = ROOM_SOUNDS[e.lifeSpec.sound] || ROOM_SOUNDS.home,
        s = this.ctx.currentTime;
      ((this.profile = t),
        this.tones.forEach(({ osc: i, gain: n }, o) => {
          (i.frequency.setTargetAtTime(t[0] * [1, 1.5, 2][o], s, 0.9),
            n.gain.setTargetAtTime((e.indoor ? 0.08 : 0.11) / ((o + 1) * 1.4), s, 0.9));
        }),
        this.noiseFilter.frequency.setTargetAtTime(t[1], s, 0.9),
        this.noiseGain.gain.setTargetAtTime(t[2], s, 0.9),
        (this.nextAccent = worldTime + 2),
        (this.nextNote = worldTime + 5));
    }
    tone(e = 220, t = 0.2, s = 0.1, i = 0, n = "sine", at = 0) {
      if (!this.ctx || !prefs.audio || this.ctx.state === "closed") return;
      let o = this.ctx,
        a = o.currentTime + at,
        l = o.createOscillator(),
        c = o.createGain();
      ((l.type = n),
        (l.frequency.value = e),
        c.gain.setValueAtTime(1e-4, a),
        c.gain.linearRampToValueAtTime(s, a + 0.015),
        c.gain.exponentialRampToValueAtTime(1e-4, a + Math.max(0.025, t)));
      let h = o.createStereoPanner ? o.createStereoPanner() : null;
      (h ? ((h.pan.value = clamp(i, -1, 1)), l.connect(c).connect(h).connect(this.master)) : l.connect(c).connect(this.master),
        (l.onended = () => {
          (l.disconnect(), c.disconnect(), h?.disconnect());
        }),
        l.start(a),
        l.stop(a + t + 0.03),
        this.created++);
    }
    noiseHit(e = 0.08, t = 0.05, s = 1600, i = 0) {
      if (!this.ctx || !prefs.audio || !this.noiseBuffer) return;
      let n = this.ctx,
        o = n.currentTime,
        a = n.createBufferSource(),
        l = n.createBiquadFilter(),
        c = n.createGain(),
        h = n.createStereoPanner ? n.createStereoPanner() : null;
      ((a.buffer = this.noiseBuffer),
        (l.type = "bandpass"),
        (l.frequency.value = s),
        c.gain.setValueAtTime(t, o),
        c.gain.exponentialRampToValueAtTime(1e-4, o + e),
        h
          ? ((h.pan.value = clamp(i, -1, 1)), a.connect(l).connect(c).connect(h).connect(this.master))
          : a.connect(l).connect(c).connect(this.master),
        (a.onended = () => {
          (a.disconnect(), l.disconnect(), c.disconnect(), h?.disconnect());
        }),
        a.start(o, (this.sequence % 20) * 0.1, e + 0.02),
        this.created++);
    }
    note(e = 220, t = 0.2, s = 0.13) {
      this.tone(e, t, s);
    }
    step(e, t, s) {
      if (!t || quietView || e - this.lastStep < 0.43 || !prefs.audio) return;
      this.lastStep = e;
      let i = {
        wet: [0.11, 0.055, 1300],
        metal: [0.045, 0.043, 2300],
        wood: [0.075, 0.048, 620],
        tile: [0.035, 0.04, 1700],
        stone: [0.045, 0.038, 1900],
        carpet: [0.04, 0.025, 600],
        concrete: [0.05, 0.04, 900],
      }[s] || [0.06, 0.04, 900];
      (this.noiseHit(...i), s === "metal" && this.tone(160, 0.15, 0.025), s === "wet" && this.tone(320, 0.1, 0.02));
    }
    tick(e) {
      if (!(!playing || modalOpen || !prefs.audio || !this.ctx || !this.room)) {
        if (e > this.nextNote) {
          this.nextNote = e + 7;
          let t = this.profile?.[0] || 55,
            s = [4, 3, 4.5, 3.5, 2.5, 4, 5, 3][this.sequence++ % 8];
          this.tone(t * s, 3, 0.024);
        }
        if (e > this.nextAccent) {
          this.nextAccent = e + 4.2 + (this.sequence % 3);
          let t = this.profile || ROOM_SOUNDS.home,
            s = this.room.details[0],
            i = s.x - hero.x,
            n = s.z - hero.z,
            o = clamp((i - n) / 12, -0.8, 0.8),
            a = 0.045 / (1 + Math.hypot(i, n) * 0.16),
            l = state.life.changed.includes(s.id);
          t[3] === "drip"
            ? l || this.tone(720, 0.09, a, o)
            : t[3] === "metal"
              ? (this.noiseHit(0.08, a, 900, o), l || this.tone(230, 0.16, a * 0.7, o))
              : t[3] === "bell"
                ? (this.tone(660, 0.85, a, o), this.tone(990, 0.55, a * 0.3, o))
                : t[3] === "click" || t[3] === "paper"
                  ? this.noiseHit(0.03, a, 2e3, o)
                  : t[3] === "piano"
                    ? (this.tone(261.6, 2, a, o), this.tone(392, 1.5, a * 0.35, o))
                    : t[3] === "bass"
                      ? this.tone(110, 0.8, a, o, "triangle")
                      : t[3] === "toy"
                        ? (this.tone(523, 0.2, a, o), this.tone(784, 0.35, a * 0.5, o))
                        : t[3] === "bird"
                          ? (this.tone(1260, 0.13, a * 0.45, o), this.tone(1570, 0.18, a * 0.2, o))
                          : t[3] === "radio"
                            ? this.tone(440, 0.08, a * 0.5, o)
                            : this.noiseHit(0.65, a * 0.65, 420, o);
        }
      }
    }
    smallChange(e) {
      (this.tone(["lamp", "tablelamp", "beacon"].includes(e) ? 392 : 294, 0.18, 0.06), this.noiseHit(0.035, 0.025, 1300));
    }
    success() {
      (this.note(329.63, 0.45, 0.14), setTimeout(() => this.note(493.88, 0.65, 0.08), 140));
    }
    info() {
      return {
        state: this.ctx?.state || "not-started",
        room: this.room?.lifeSpec.sound,
        profile: this.profile,
        created: this.created,
        baseNodes: this.tones.length,
        muted: !prefs.audio,
      };
    }
  },
  audio = new Ambience();
function saveSettings() {
  try {
    localStorage.setItem("rain-check-settings-v1", JSON.stringify(prefs));
  } catch {}
  renderSoundButton();
}
function renderSoundButton() {
  ((byId("sound").innerHTML = `${prefs.audio ? "\u266A" : "\u2669"} <span>SOUND ${prefs.audio ? "ON" : "OFF"}</span>`),
    byId("sound").setAttribute("aria-pressed", String(prefs.audio)));
}
function toast(r) {
  ((byId("toast").textContent = r),
    byId("toast").classList.add("show"),
    clearTimeout(toastTimer),
    (toastTimer = setTimeout(() => byId("toast").classList.remove("show"), 3100)));
}
function save() {
  if (playing) {
    state.position = { x: hero.x, z: hero.z };
    try {
      (localStorage.setItem(SAVE_KEY, JSON.stringify(state)),
        (savedGame = JSON.parse(JSON.stringify(state))),
        (byId("save-status").textContent = "NIGHT SAVED"),
        setTimeout(() => (byId("save-status").textContent = ""), 1800));
    } catch {
      storageWarned || (toast("Browser storage unavailable. Export your save from Settings."), (storageWarned = !0));
    }
  }
}
function exportSave() {
  let r = JSON.stringify({ ...state, position: { x: hero.x, z: hero.z } }, null, 2),
    e = document.createElement("a"),
    t = URL.createObjectURL(new Blob([r], { type: "application/json" }));
  ((e.href = t), (e.download = "rain-check-save.json"), e.click(), setTimeout(() => URL.revokeObjectURL(t), 1e3), toast("Save exported."));
}
function refreshTasks() {
  (caseTasks.forEach((r) => {
    ((r.done = isDone(state, r.id)), (r.ready = isReady(state, r)));
  }),
    targets.forEach((r) => {
      r.kind === "door" && ((r.done = !1), (r.ready = !0));
    }),
    renderHud(),
    placeMarkers(),
    world?.lifeSpec && syncLife());
}
function loadCase(r, e = !1) {
  ((caseTasks = CASES[r].tasks.map((t) => ({ ...t }))), enterRoom((e && state.room) || 0, e));
}
function enterRoom(r, e = !1) {
  ((state.room = r),
    (world = buildRoom(state.chapter, r)),
    (heroPath = []),
    (walkTarget = null),
    (nearTarget = null),
    (minimapBase = null),
    (targets = caseTasks.filter((a) => (a.room || 0) === r)));
  let t = [0, 1, 2].filter((a) => a !== r);
  targets = targets.concat(world.details.map((a) => ({ ...a })));
  let s = state.chapter === 0 ? districtDoors(r, hasPerk(state, "stairs")) : t.map((a, l) => ({ destination: a, x: l ? 8 : -8, z: 7 }));
  ((targets = targets.concat(
    s.map((a) => ({
      id: "door-" + a.destination,
      label: a.destination === 0 && r >= 3 ? "Return to the street" : CASES[state.chapter].rooms[a.destination].name,
      kind: "door",
      room: r,
      ...a,
      ready: !0,
      done: !1,
    })),
  )),
    world.district && (targets = targets.concat(world.residents, world.districtDevices, world.districtLore)));
  let i = e && state.position ? state.position : { x: 0, z: 6 },
    n = walkable(world, i.x, i.z);
  hero = { x: n ? i.x : 0, z: n ? i.z : 6, angle: Math.PI * 0.14, moving: !1, target: null };
  let o = state.chapter + ":" + r;
  (state.visited.includes(o) || state.visited.push(o),
    view.setWorld(world, targets),
    refreshTasks(),
    buildMarkers(),
    arriveInRoom(),
    (byId("coordinates").textContent = `${CASES[state.chapter].district} / ${CASES[state.chapter].time}`),
    (byId("map-district").textContent = CASES[state.chapter].rooms[r].name),
    byId("room-name") && (byId("room-name").textContent = CASES[state.chapter].rooms[r].name));
}
function openModal(r, e, t = [], s = {}) {
  return (
    byId("toast").classList.remove("show"),
    byId("life-caption")?.classList.remove("show"),
    quietView && toggleQuietView(),
    modalCleanup && (modalCleanup(), (modalCleanup = null)),
    modalOpen || (modalReturnFocus = document.activeElement),
    (keepFocus = modalOpen && byId("dialog").contains(document.activeElement) ? focusKey(document.activeElement) : ""),
    (modalOpen = !0),
    (modalCloseable = s.closeable !== !1),
    (modalDirection = null),
    (modalTick = null),
    (modalConfirm = null),
    (modalFocus = s.focus || null),
    modalSerial++,
    (hero.moving = !1),
    kit.touch?.suspend(!0, "modal"),
    byId("modal").classList.remove("hidden"),
    (byId("dialog").className = "dialog" + (s.wide ? " wide" : "") + (s.className ? " " + s.className : "")),
    (byId("dialog").innerHTML =
      `${modalCloseable ? '<button class="dialog-close" aria-label="Close dialog">\xD7</button>' : ""}<div class="eyebrow"><span></span>${esc(s.eyebrow || "RAIN CHECK / FIELD NOTES")}</div><h2 id="dialog-title">${esc(r)}</h2>${e}<div class="dialog-actions">${t.map((i, n) => (i.primary ? `<button class="button-primary" data-modal-action="${n}">${esc(i.label)} <span>\u2197</span></button>` : `<button class="choice" data-modal-action="${n}"><span class="choice-number">${String(n + 1).padStart(2, "0")}</span><span>${esc(i.label)}</span><span class="choice-arrow">\u2192</span></button>`)).join("")}</div>${s.footer ? `<p class="fine-print">${s.footer}</p>` : ""}`),
    byId("dialog").querySelector(".dialog-close")?.addEventListener("click", closeModal),
    byId("dialog")
      .querySelectorAll("[data-modal-action]")
      .forEach((i) => i.addEventListener("click", () => t[Number(i.dataset.modalAction)]?.run())),
    (byId("dialog").scrollTop = 0),
    focusDialog(keepFocus),
    byId("dialog")
  );
}
function closeModal() {
  if (!modalCloseable) return;
  modalCleanup && (modalCleanup(), (modalCleanup = null));
  modalOpen = !1;
  modalDirection = modalTick = modalConfirm = modalFocus = null;
  byId("modal").classList.add("hidden");
  kit.touch?.suspend(!1, "modal");
  input.settle();
  // On the title screen focus goes back to where it was (menus stay navigable); in the street it goes to the
  // city itself, so Space and Enter reach the game instead of re-clicking a HUD button.
  if (!playing && modalReturnFocus?.isConnected && modalReturnFocus !== document.body) modalReturnFocus.focus({ preventScroll: !0 });
  else document.activeElement?.closest?.("#app") && document.activeElement.blur?.();
}
/** Focus the control a keyboard or controller player wants first: the same control after a re-render, else the main choice. */
function focusDialog(key = "") {
  const dialog = byId("dialog"),
    serial = modalSerial;
  requestAnimationFrame(() => {
    if (!modalOpen || serial !== modalSerial) return;
    const list = focusables(dialog),
      again = key && list.find((el) => focusKey(el) === key),
      wanted = modalFocus && dialog.querySelector(modalFocus),
      primary = dialog.querySelector(".dialog-actions .button-primary"),
      first = dialog.querySelector("[data-modal-action]") || list.find((el) => !el.classList.contains("dialog-close"));
    const el = again || wanted || primary || first || list[0];
    el?.focus({ preventScroll: !0 });
    // Keep the start of a long record in view unless we returned to a control further down.
    again && el.scrollIntoView?.({ block: "nearest" });
  });
}
function dismissModal() {
  ((modalCloseable = !0), closeModal());
}
function beginNight(r = !1) {
  ((state = (r && savedGame && validateSave(savedGame)) || newGame()),
    (playing = !0),
    kit.touch?.suspend(!1, "title"),
    (view.landing = !1),
    view.resize(),
    byId("landing").classList.add("hidden"),
    byId("hud").classList.remove("hidden"),
    loadCase(state.chapter, r),
    audio.start(),
    save(),
    state.ended ? openEnding() : caseIntro());
}
function startNewGame() {
  savedGame && !savedGame.ended
    ? openModal(
        "A new night?",
        `<p>Your current night is on case ${savedGame.chapter + 1}: ${esc(CASES[savedGame.chapter].title)}. Starting over replaces the browser save. An exported save will not be changed.</p>`,
        [
          {
            label: "Keep my current night",
            run: () => {
              (dismissModal(), beginNight(!0));
            },
          },
          {
            label: "Start a new case",
            run: () => {
              (dismissModal(), beginNight(!1));
            },
            primary: !0,
          },
        ],
        { eyebrow: "NEW GAME" },
      )
    : (dismissModal(), beginNight(!1));
}
function caseIntro(r = 0) {
  let e = CASES[state.chapter],
    t = openModal(
      e.title,
      `<div class="scene-frame" data-scene="${state.chapter}"><div class="frame-haze"></div>${sceneArt(state.chapter)}<div class="scene-frame-caption"><span>${esc(e.district)}</span><b>${e.time}</b></div></div><div class="scene-steps">${e.frames.map((s, i) => `<i class="${i === r ? "active" : ""}"></i>`).join("")}</div><div class="narrative">${esc(e.frames[r])}</div>${r === 2 ? `<p>${esc(e.intro)}</p><div class="hint-strip">${esc(e.objective)}</div>${state.chapter === 0 ? `<div class="arrival-world"><b>THE CITY DOES NOT WAIT FOR YOUR CASE.</b><p>Walk past the kitchen. Find the shops, follow the service stairs, and speak to the people beneath the adverts. The case is one story here. You can stay for the others.</p><span>${CASES[0].rooms.length} opening areas \xB7 ${RESIDENTS.length} named residents \xB7 ${LOCAL_QUESTS.length} optional local quests</span></div>` : cityEcho()}` : ""}`,
      [
        { label: r < 2 ? "CONTINUE" : "ENTER THE SCENE", primary: !0, run: () => (r < 2 ? caseIntro(r + 1) : dismissModal()) },
        ...(r < 2 ? [{ label: "Skip introduction", run: dismissModal }] : []),
      ],
      {
        closeable: !1,
        eyebrow: `CASE ${String(state.chapter + 1).padStart(2, "0")} / THE STREET OF RAIN`,
        footer:
          r === 2
            ? "Gold leads follow the case. STREET opens places, people, quests, and lore. N opens the neighborhood. All local quests are optional."
            : "Original scene. Fixed entrance and exit. The investigation between them is yours.",
      },
    );
}
function renderHud() {
  let r = CASES[state.chapter];
  ((byId("case-number").textContent = `CASE ${String(state.chapter + 1).padStart(2, "0")} / ${CASES.length}`),
    (byId("clock").textContent = r.time),
    (byId("chapter-title").textContent = r.title),
    (byId("chapter-progress").innerHTML = CASES.map(
      (s, i) => `<i class="${i < state.chapter || (i === state.chapter && state.ended) ? "done" : ""}"></i>`,
    ).join("")));
  let e = currentLead();
  byId("objective-text").textContent = e ? e.label : "Case complete";
  let t = caseTasks.filter((s) => !s.optional && s.kind !== "exit" && s.done).length;
  ((byId("objective-sub").textContent = e
    ? `${t}/6 leads \xB7 ${r.rooms[e.room || 0].name}${e.room !== state.room ? " \xB7 through the marked door" : ""}`
    : "All main leads are filed."),
    (byId("rank").textContent = rankName(state).toUpperCase()),
    (byId("credits").textContent = state.credits + " \xA2"),
    renderMeters(),
    byId("board-count") && (byId("board-count").textContent = state.deductions.length + "/" + CASES.length),
    renderTracker());
}
/** Integrity and focus bars; the DOM is only touched when a value visibly changes. */
function renderMeters() {
  for (const [bar, label, key] of [
    ["health-meter", "health-value", "hp"],
    ["focus-meter", "focus-value", "focus"],
  ]) {
    const v = Math.round(state[key] * 4) / 4;
    if (meterCache[key] === v) continue;
    meterCache[key] = v;
    byId(bar).style.width = v + "%";
    byId(label).textContent = Math.round(v);
  }
}
function buildMarkers() {
  const layer = byId("marker-layer");
  ((layer.innerHTML = targets
    .filter((r) => !r.done)
    .map(
      (r) =>
        `<button class="world-marker ${r.kind === "resident" ? "resident" : r.kind === "districtDevice" ? "district-device" : r.kind === "districtLore" || r.kind === "detail" ? "detail" : r.optional ? "side" : r.kind === "door" ? "door" : ""} ${r.ready ? "" : "locked"}" data-task="${r.id}" aria-label="${esc(r.label)}"><span>${esc(r.label)}</span><b>${r.kind === "resident" ? "\u25CB" : r.kind === "districtDevice" ? "\u2318" : r.kind === "districtLore" ? "\u2261" : r.kind === "detail" ? "\xB7" : r.kind === "exit" ? "\u2197" : r.kind === "door" ? "\u25B1" : r.optional ? "+" : "\u25C7"}</b></button>`,
    )
    .join("")),
    (markerEls = [...layer.querySelectorAll("button")].map((el) => {
      const target = targets.find((t) => t.id === el.dataset.task);
      el.addEventListener("click", (e) => {
        (e.stopPropagation(), modalOpen || goTo(target));
      });
      return { el, target, shown: null, x: NaN, y: NaN, locked: null, active: null };
    })));
}
/** Float each lead marker over the city. Runs every frame, so it only writes what changed. */
function placeMarkers() {
  if (!playing) return;
  for (const m of markerEls) {
    const e = m.target,
      r = m.el;
    let i = !1,
      t = null;
    if (e && !e.done) {
      t = view.screen(e.x, e.kind === "talk" ? 2.45 : 1.1, e.z);
      let s = Math.hypot(hero.x - e.x, hero.z - e.z);
      i = e.ready && (view.w > 700 || s < 8 || worldTime < scanRevealUntil || e === walkTarget);
      (e.kind === "detail" && (i = !!((prefs.detailHints && s < 4) || worldTime < scanRevealUntil || e === walkTarget)),
        ["resident", "districtDevice", "districtLore"].includes(e.kind) && (i = s < (view.w < 700 ? 4.2 : 7) || e === walkTarget),
        e.kind === "door" && state.chapter === 0 && state.room === 0 && (i = s < (view.w < 700 ? 10 : 19) || e === walkTarget),
        (t.x < 20 || t.x > view.w - 20 || t.y > view.h - 100) && (i = !1),
        quietView && (i = !1),
        t.y < 242 && view.w < 700 && (i = !1),
        t.y < 380 && t.x < 320 && view.w > 700 && (i = !1));
    }
    if (i !== m.shown) {
      m.shown = i;
      r.style.display = i ? "flex" : "none";
    }
    if (!i) continue;
    const x = Math.round(t.x),
      y = Math.round(t.y);
    if (x !== m.x || y !== m.y) {
      m.x = x;
      m.y = y;
      r.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    const locked = !e.ready,
      active = nearTarget === e || walkTarget === e;
    locked !== m.locked && r.classList.toggle("locked", (m.locked = locked));
    active !== m.active && r.classList.toggle("active", (m.active = active));
  }
}
function currentLead() {
  return caseTasks.find((r) => r.ready && !r.optional);
}
function goTo(r) {
  if (!r || !r.ready || modalOpen) return;
  if (r.kind !== "door" && (r.room || 0) !== state.room) {
    afterDoor = { id: r.id, room: r.room || 0 };
    let t = targets.find((s) => s.kind === "door" && s.destination === r.room) || targets.find((s) => s.kind === "door" && s.destination === 0);
    t ? goTo(t) : toast("Open the local map to find a connecting door.");
    return;
  }
  if (r.id === "district-arrive" && r.room === state.room) return;
  if ((r.kind !== "door" && (r = targets.find((t) => t.id === r.id) || r), Math.hypot(hero.x - r.x, hero.z - r.z) < 1.85)) {
    openTarget(r);
    return;
  }
  ((heroPath = findPath(world, hero, { x: r.x, z: r.z })),
    (walkTarget = r),
    (hero.target = { x: r.x, z: r.z }),
    heroPath.length || (toast("That lead is behind cover. Approach it from the open side."), (walkTarget = null)));
}
function interact() {
  if (!(!playing || modalOpen))
    if (nearTarget) openTarget(nearTarget);
    else {
      let r = currentLead();
      r && goTo(r);
    }
}
function recordTask(r, e = {}, t) {
  let s = rankName(state),
    i = state.xp;
  if (!completeTask(state, r, { ...e, result: t })) {
    toast("That choice needs more credits, or this lead is already filed.");
    return;
  }
  (audio.success(), input.rumble(0.3, 120), refreshTasks(), buildMarkers(), save());
  let n = [];
  (r.reward && n.push(ITEMS[r.reward][0]),
    (e.trust || r.trust) > 0 && n.push("CONNECTION +" + ((e.trust || 0) + (r.trust || 0))),
    n.push("+" + (state.xp - i) + " XP"),
    rankName(state) !== s && n.push("RANK UP: " + rankName(state)),
    openModal(
      r.optional ? "A connection recorded" : r.kind === "deduction" ? "Theory supported" : "Lead recorded",
      `<div class="narrative">${esc(t || r.text)}</div><div class="reward-row">${n.map((o) => `<span class="reward-chip">${esc(o)}</span>`).join("")}</div>`,
      [{ label: "BACK TO THE NIGHT", primary: !0, run: dismissModal }],
      {
        eyebrow: r.side ? "SIDE STORY / " + r.side : "CASEBOOK UPDATED",
        footer:
          rankName(state) !== s
            ? "Your scanner and dash now use less focus."
            : r.reward
              ? "Your evidence and equipment are available in the casebook."
              : "",
      },
    ));
}
function openTarget(r) {
  if (modalOpen || !r.ready) return;
  if (((heroPath = []), (walkTarget = null), (hero.target = null), (hero.moving = !1), r.kind === "detail")) {
    openDetail(r);
    return;
  }
  if (r.kind === "door") {
    let t = afterDoor,
      s = state.room;
    if (((afterDoor = null), enterRoom(r.destination), state.chapter === 0 && r.destination === 0 && s >= 3)) {
      let i = SHOPS.find((n) => n.room === s);
      i && ((hero.x = i.door[0]), (hero.z = i.door[1] + 1.5), (view.cx = hero.x), (view.cz = hero.z - 1.5));
    }
    if ((save(), toast(CASES[state.chapter].rooms[r.destination].name), t)) {
      let i = targets.find((n) => n.id === t.id) || caseTasks.find((n) => n.id === t.id) || { ...t, ready: !0 };
      goTo(i);
    }
    return;
  }
  if (r.kind === "resident") {
    openResident(r.person);
    return;
  }
  if (r.kind === "districtDevice") {
    openDevice(r.quest);
    return;
  }
  if (r.kind === "districtLore") {
    openLore(r.lore);
    return;
  }
  if (["forensic", "deduction", "challenge", "document", "thread"].includes(r.kind)) {
    openFieldWork(r);
    return;
  }
  if (r.kind === "talk" && r.person) {
    openInterview(r);
    return;
  }
  if (r.kind === "exit") {
    let t = CASES[state.chapter],
      s = caseTasks.filter((n) => n.optional && !n.done).length,
      i = state.chapter === 0 ? LOCAL_QUESTS.length - districtTotals(state).quests : 0;
    openModal(
      "End of the line",
      `<div class="narrative">${esc(t.end)}</div>${s ? `<p class="fine-print">${s} optional records remain in this district. Leaving closes them for this playthrough.</p>` : ""}${i ? `<div class="hint-strip">${i} neighborhood quests remain. Leaving closes the opening district for this night. Your notes and completed results stay in the casebook.</div>` : ""}`,
      [
        { label: "Stay a little longer", run: dismissModal },
        {
          label: state.chapter === CASES.length - 1 ? "SEE THE MORNING" : "NEXT CASE: " + CASES[state.chapter + 1].title.toUpperCase(),
          primary: !0,
          run: () => {
            closeCase(state) && (dismissModal(), loadCase(state.chapter), save(), state.ended ? openEnding() : caseIntro());
          },
        },
      ],
      { eyebrow: `CASE ${String(state.chapter + 1).padStart(2, "0")} / COMPLETE` },
    );
    return;
  }
  if (r.kind === "tune") {
    openTuning(r);
    return;
  }
  if (r.kind === "photo") {
    openPhoto(r);
    return;
  }
  if (r.kind === "talk" && r.choices) {
    openModal(
      r.label,
      `<div class="narrative">${esc(r.text)}</div>`,
      r.choices.map(([t, s, i]) => ({ label: t, run: () => recordTask(r, i, s) })),
      {
        eyebrow: "CONVERSATION / CHOOSE YOUR APPROACH",
        footer: "There is no single correct way to be human. Your approach is remembered.",
      },
    );
    return;
  }
  let e = r.kind === "side";
  openModal(
    r.label,
    `<div class="narrative">${esc(r.text)}</div>`,
    [
      ...(e ? [{ label: "Not tonight", run: dismissModal }] : []),
      {
        label: e ? "MAKE A LITTLE DIFFERENCE" : "RECORD THE LEAD",
        primary: !0,
        run: () => recordTask(r, {}, e ? "You take the time. The city gets a little less lonely. " + r.text : r.text),
      },
    ],
    { eyebrow: e ? "OPTIONAL / AN ACT OF KINDNESS" : "INVESTIGATE / " + CASES[state.chapter].district },
  );
}
function openTuning(r, e = 0) {
  let t = r.targets,
    s = [50, 50, 50],
    i = openModal(
      r.label,
      `<p>${esc(r.text)}</p><div class="signal-display"><div class="signal-line">\u2301_\u2301\u2301__\u2301_\u2301\u2301__\u2301_\u2301\u2301__\u2301_\u2301\u2301__\u2301_\u2301\u2301__\u2301_\u2301\u2301__\u2301</div></div><div class="micro"><span>RESONANCE RECOVERY</span><span>3 CHANNELS / \xB1 3 TOLERANCE</span></div>${t.map((n, o) => `<label class="tune-row"><span>CH ${o + 1}</span><input type="range" min="0" max="100" value="50" data-channel="${o}" aria-label="Channel ${o + 1}, target ${n}"><output id="tune-output-${o}">50</output></label>`).join("")}<div id="tune-feedback" class="hint-strip">SERVICE REFERENCE: ${t.join(" / ")}${prefs.assisted ? " \xB7 ASSISTED RECOVERY AVAILABLE" : ""}</div>`,
      [
        {
          label: "LOCK THE SIGNAL",
          primary: !0,
          run: () => {
            let n = s.map((o, a) => Math.abs(o - t[a]) <= 3);
            if (n.every(Boolean))
              recordTask(
                r,
                {},
                "The three tracks settle into a clear signal. " +
                  (r.reward ? ITEMS[r.reward][1] : "The recovered information is added to your casebook."),
              );
            else if (
              ((state.focus = Math.max(0, state.focus - 5)),
              renderMeters(),
              audio.note(92, 0.2, 0.14),
              e++,
              (byId("tune-feedback").textContent =
                `${n.filter(Boolean).length}/3 CHANNELS ALIGNED. Reference: ${t.join(" / ")}. \u22125 focus. Try again.`),
              e >= 2 && !byId("assist-recovery"))
            ) {
              let o = document.createElement("button");
              ((o.id = "assist-recovery"),
                (o.className = "small-button"),
                (o.textContent = "Recover with scanner assistance"),
                (o.onclick = () =>
                  recordTask(r, { xp: -10 }, "Your scanner reconstructs the damaged signal. The lead is recovered; you gain 10 fewer XP.")),
                byId("tune-feedback").after(o));
            }
          },
        },
      ],
      {
        eyebrow: "FIELD TOOL / SIGNAL TUNING",
        focus: '[data-channel="0"]',
        footer:
          "Drag each slider to its reference number, then lock. Keyboard: Tab to a slider, use arrow keys. Misses cost focus, never the entire case.",
      },
    );
  if (
    (i.querySelectorAll("[data-channel]").forEach((n) =>
      n.addEventListener("input", () => {
        let o = Number(n.dataset.channel);
        ((s[o] = Number(n.value)), (byId("tune-output-" + o).value = n.value));
      }),
    ),
    prefs.assisted)
  ) {
    let n = document.createElement("button");
    ((n.className = "small-button"),
      (n.textContent = "Auto-align channels"),
      (n.onclick = () => {
        (i.querySelectorAll("[data-channel]").forEach((o, a) => {
          ((o.value = t[a]), o.dispatchEvent(new Event("input")));
        }),
          audio.note(440, 0.15));
      }),
      i.querySelector(".dialog-actions").before(n));
  }
}
function scan() {
  if (!playing || modalOpen) return;
  if (worldTime < scanReadyAt) {
    toast("Scanner cooling down.");
    return;
  }
  let r = Math.min(4, Math.floor(state.xp / 320)),
    e = Math.max(2, 12 - r * 2 - state.skills.analysis * 3);
  if (state.focus < e) {
    toast("Not enough focus. Walk to recover, or use a coolant cell.");
    return;
  }
  ((state.focus -= e),
    (scanRevealUntil = worldTime + 10),
    (scanReadyAt = worldTime + 4),
    byId("scan-ring").classList.remove("play"),
    byId("scan-ring").offsetWidth,
    byId("scan-ring").classList.add("play"),
    input.rumble(0.25, 90),
    audio.note(523.25, 0.65, 0.08));
  let t = currentLead();
  (toast(
    t ? `SIGNAL: ${t.label} \xB7 ${Math.round(Math.hypot(hero.x - t.x, hero.z - t.z))} m. Tap CURRENT LEAD to follow.` : "No unresolved leads.",
  ),
    renderMeters());
}
function useItem(r) {
  (r === "broth" &&
    state.inventory.includes(r) &&
    ((state.hp = Math.min(100, state.hp + 35)), (state.inventory = state.inventory.filter((e) => e !== r)), toast("Warm broth. +35 integrity.")),
    r === "coolant" &&
      state.inventory.includes(r) &&
      ((state.focus = Math.min(100, state.focus + 45)), (state.inventory = state.inventory.filter((e) => e !== r)), toast("Fresh coolant. +45 focus.")),
    renderHud(),
    save(),
    openCasebook("inventory"));
}
function buySupply(r = !1) {
  let e = r ? 6 : 8;
  if (state.credits < e) {
    toast("Not enough credits. Cases pay 8 credits on completion.");
    return;
  }
  ((state.credits -= e),
    r ? (state.focus = Math.min(100, state.focus + 40)) : (state.hp = Math.min(100, state.hp + 35)),
    renderHud(),
    save(),
    openCasebook("inventory"),
    audio.note(392, 0.2));
}
function openCasebook(r = "board") {
  if (r === "district") {
    openDistrict();
    return;
  }
  if (r === "street") {
    openStreetNotes();
    return;
  }
  if (["board", "people", "threads", "skills"].includes(r)) return openCasebookPage(r);
  let e = casebookTabs(r),
    t = "";
  (r === "inventory" &&
    (t = `<div class="micro"><span>${esc(rankName(state).toUpperCase())} / ${state.xp} XP</span><span>${state.credits} CREDITS</span></div><p class="fine-print">Ranks arrive every 320 XP. Each rank reduces scanner cost by 2 focus and dash drain by 2 focus per second. All evidence tools are reusable.</p><div class="inventory-grid">${state.inventory
      .filter((i) => ITEMS[i])
      .map((i) => {
        let n = ITEMS[i];
        return `<article class="inventory-item"><span class="inventory-symbol">${n[2]}</span><h3>${esc(n[0])}</h3><p>${esc(n[1])}</p>${["broth", "coolant"].includes(i) ? `<button class="small-button" data-use="${i}">USE ITEM</button>` : ""}</article>`;
      })
      .join(
        "",
      )}</div><div class="setting-row"><div>Field supplies<small>Supplies restore you immediately. Credits carry between scenes. Skills are on the TRAINING tab.</small></div><div><button class="small-button" id="buy-patch">PATCH +35 / 8 \xA2</button> <button class="small-button" id="buy-focus">FOCUS +40 / 6 \xA2</button></div></div>`),
    r === "notes" &&
      (t = state.journal.length
        ? state.journal
            .slice()
            .reverse()
            .map(
              (i) =>
                `<article class="note"><h3>${String(i.chapter + 1).padStart(2, "0")} / ${esc(i.title)}</h3><p>${esc(i.text)}</p></article>`,
            )
            .join("")
        : '<p class="book-empty">The first page is always the hardest. Follow a lead to begin.</p>'),
    r === "cases" &&
      (t =
        CASES.map(
          (i, n) =>
            `<button class="case-row" data-replay="${n}" ${state.ended ? "" : "disabled"}><span>${String(n + 1).padStart(2, "0")}</span><span><strong>${esc(i.title)}</strong><small>${esc(i.district)}</small></span><span>${state.ended ? "REPLAY \u2197" : n < state.chapter ? "FILED" : n === state.chapter ? "ACTIVE" : "LOCKED"}</span></button>`,
        ).join("") +
        '<p class="fine-print">All twelve expanded cases form one original campaign across 48 areas. Complete the night to unlock standalone chapter replay. Replay starts a fresh save from that chapter.</p>'));
  let s = openModal(
    "The casebook",
    e + '<button class="street-note-link small-button" onclick="window.RainCheck.openStreetNotes()">STREET NOTES \u2197</button>' + t,
    [],
    { wide: !0, eyebrow: "VALE / PERSONAL EFFECTS" },
  );
  (s.querySelectorAll("[data-tab]").forEach((i) => (i.onclick = () => openCasebook(i.dataset.tab))),
    s.querySelectorAll("[data-use]").forEach((i) => (i.onclick = () => useItem(i.dataset.use))),
    byId("buy-patch")?.addEventListener("click", () => buySupply(!1)),
    byId("buy-focus")?.addEventListener("click", () => buySupply(!0)),
    s.querySelectorAll("[data-replay]").forEach((i) => {
      state.ended && (i.onclick = () => confirmReplay(Number(i.dataset.replay)));
    }));
}
function confirmReplay(r) {
  openModal(
    "Replay " + CASES[r].title + "?",
    `<p>This starts a new save at case ${r + 1}. Earlier evidence tools are supplied, but your prior relationships and side-story choices are not carried into the replay. Export the completed night first to preserve it.</p>`,
    [
      { label: "Export the completed night", run: exportSave },
      {
        label: "START CHAPTER REPLAY",
        primary: !0,
        run: () => {
          ((state = newGame()), (state.chapter = r));
          for (let e = 0; e < r; e++) for (let t of CASES[e].tasks) t.reward && !state.inventory.includes(t.reward) && state.inventory.push(t.reward);
          ((state.xp = r * 100),
            (playing = !0),
            (view.landing = !1),
            view.resize(),
            byId("landing").classList.add("hidden"),
            byId("hud").classList.remove("hidden"),
            dismissModal(),
            loadCase(r),
            save(),
            caseIntro());
        },
      },
    ],
    { eyebrow: "CHAPTER REPLAY" },
  );
}
function openSettings() {
  let r = `<div class="setting-row"><div>Local captions<small>Local voices and arrival text. All exchanges remain available through LOOK.</small></div><button id="captions-toggle" class="small-button">${prefs.captions ? "ON" : "OFF"}</button></div><div class="setting-row"><div>Detail hints<small>Show nearby observation markers. LOOK and scanning still find them when hints are off.</small></div><button id="details-toggle" class="small-button">${prefs.detailHints ? "ON" : "OFF"}</button></div><div class="setting-row"><div>Graphics and controls<small>Quality, resolution, frame cap, touch layout and vibration. Shared by every game on this device. F9 opens it anywhere.</small></div><button id="graphics-button" class="small-button">OPEN</button></div><div class="setting-row"><div>Reduced motion<small>Stops resident travel, moving props, local particles, and the rain overlay.</small></div><button id="reduce-toggle" class="small-button">${prefs.reduced ? "ON" : "OFF"}</button></div><div class="setting-row"><div>Assisted investigation<small>Optional auto-alignment for signal puzzles. Hazards deal less damage.</small></div><button id="assist-toggle" class="small-button">${prefs.assisted ? "ON" : "OFF"}</button></div><div class="setting-row"><div>Sound<small>Original procedural ambience. No movie music or voice samples.</small></div><button id="audio-toggle" class="small-button">${prefs.audio ? "ON" : "OFF"}</button></div><p class="fine-print">${controlsHelp()}<br>Dialogues pause the world. Progress saves automatically. Mobile portrait and landscape are supported.</p><div class="setting-row"><div>Save management<small>Keep a portable JSON backup. Browser storage can be cleared by your browser.</small></div><div><button id="export-button" class="small-button">EXPORT</button> <button id="import-button" class="small-button">IMPORT</button></div></div><p class="fine-print">Renderer: ${esc(kit.backendLabel.toUpperCase())} \xB7 ${esc(kit.tier.name.toUpperCase())} QUALITY. Three.js r${THREE.REVISION} WebGPURenderer; WebGL 2 takes over automatically where WebGPU is unavailable.</p>`;
  (openModal(
    "A little adjustment",
    r,
    [...(playing ? [{ label: "RESUME THE NIGHT", primary: !0, run: dismissModal }] : []), { label: "About this game", run: openAbout }],
    { eyebrow: "SETTINGS / CONTROLS" },
  ),
    (byId("graphics-button").onclick = () => kit.menu.open()),
    (byId("captions-toggle").onclick = () => {
      ((prefs.captions = !prefs.captions), saveSettings(), openSettings());
    }),
    (byId("details-toggle").onclick = () => {
      ((prefs.detailHints = !prefs.detailHints), saveSettings(), openSettings());
    }),
    (byId("reduce-toggle").onclick = () => {
      ((prefs.reduced = !prefs.reduced), (view.reduced = prefs.reduced), saveSettings(), openSettings());
    }),
    (byId("assist-toggle").onclick = () => {
      ((prefs.assisted = !prefs.assisted), saveSettings(), openSettings());
    }),
    (byId("audio-toggle").onclick = () => {
      ((prefs.audio = !prefs.audio), audio.mute(), saveSettings(), openSettings());
    }),
    (byId("export-button").onclick = exportSave),
    (byId("import-button").onclick = () => byId("import-save").click()));
}
function openPause() {
  if (!playing) {
    openAbout();
    return;
  }
  openModal(
    "The night can wait.",
    `<p>Case ${String(state.chapter + 1).padStart(2, "0")} \xB7 ${esc(CASES[state.chapter].title)}<br>${esc(rankName(state))} \xB7 ${state.sides.length} small kindnesses remembered.</p>`,
    [
      { label: "RESUME", primary: !0, run: dismissModal },
      { label: "Open the casebook", run: () => openCasebook() },
      { label: "Settings and controls", run: openSettings },
      { label: "Graphics", run: () => kit.menu.open() },
      {
        label: "Save and return to title",
        run: () => {
          (save(),
            dismissModal(),
            (playing = !1),
            kit.touch?.suspend(!0, "title"),
            (view.landing = !0),
            view.resize(),
            byId("landing").classList.remove("hidden"),
            byId("hud").classList.add("hidden"),
            byId("continue").classList.remove("hidden"),
            focusLanding());
        },
      },
    ],
    { eyebrow: "PAUSED / RAINWARD CITY" },
  );
}
function openAbout() {
  openModal(
    "Small bricks. Big questions.",
    `<p><strong>Rain Check</strong> is an original, expanded twelve-case, synthetic-noir adventure about memory, ownership, and the kindness that survives between them.</p><p>The Street of Rain adds twelve shops and side areas to the opening case. Its fifteen connected areas hold fifty named residents, 150 conversation topics, ${LOCAL_QUESTS.length} optional local stories, and 128 background residents in the central street. RPG dialogue uses original vector portraits. Across the full game, all twelve cases remain, with 48 areas, 144 environmental observations, 36 small changes, and 48 local exchanges. The rain-soaked city draws on the atmosphere of <em>Blade Runner</em>. This game uses original characters, dialogue, story, geometry, and synthesized audio. It is not affiliated with the film or its rights holders.</p><p>It is a self-contained homage, not a scene-by-scene adaptation or a claim to include every screenplay item and location.</p><div class="hint-strip">A FIXED BEGINNING AND END TO EACH CASE.<br>ROOM FOR YOU IN THE MIDDLE.</div><p class="fine-print">Three.js r${THREE.REVISION} WebGPURenderer with an automatic WebGL 2 fallback, node-based materials, TSL wet surfaces and instanced rain, ACES tone mapping, dynamic shadows, and a bloom pipeline. Everything, including the audio, is generated in the browser.</p>`,
    [{ label: playing ? "BACK TO THE NIGHT" : "BACK TO THE CITY", primary: !0, run: dismissModal }],
    { eyebrow: "RAIN CHECK / AN ORIGINAL HOMAGE" },
  );
}
function takeDamage(r) {
  worldTime < hurtUntil ||
    modalOpen ||
    ((state.hp = Math.max(0, state.hp - r)),
    (hurtUntil = worldTime + 1.35),
    audio.note(65, 0.3, 0.16),
    input.rumble(0.6, 220),
    (byId("damage-vignette").style.opacity = ".7"),
    setTimeout(() => (byId("damage-vignette").style.opacity = "0"), 450),
    renderMeters(),
    state.hp === 0 &&
      (state.failures++,
      (heroPath = []),
      (walkTarget = null),
      openModal(
        "The city knocks you down.",
        '<div class="narrative">Ori finds you before the water reaches the reader. Your recorded evidence is safe. Your pride is less waterproof.</div><p>You can retry from this case\u2019s entry. Completed leads remain recorded; the recovery costs 4 credits.</p>',
        [
          {
            label: "GET BACK UP",
            primary: !0,
            run: () => {
              ((state.hp = 100),
                (state.focus = 80),
                (state.credits = Math.max(0, state.credits - 4)),
                (state.position = null),
                dismissModal(),
                loadCase(state.chapter),
                (hurtUntil = worldTime + 4),
                save());
            },
          },
        ],
        { eyebrow: "CHECKPOINT / RECOVERY", closeable: !1 },
      )));
}
function updateHero(r) {
  // Screen-relative movement: up on the stick walks up the screen (toward -x/-z in the city).
  const mv = input.vector("move");
  let e = mv.x,
    t = -mv.y;
  let s = (e + t) * 0.707106,
    i = (t - e) * 0.707106,
    n = Math.hypot(s, i) > 0.1;
  if ((n && ((heroPath = []), (walkTarget = null), (hero.target = null)), !n && heroPath.length)) {
    let u = heroPath[0],
      d = u.x - hero.x,
      p = u.z - hero.z,
      f = Math.hypot(d, p);
    (f < 0.17 && (heroPath.shift(), (u = heroPath[0]), u && ((d = u.x - hero.x), (p = u.z - hero.z), (f = Math.hypot(d, p)))),
      heroPath.length && ((s = d / Math.max(0.001, f)), (i = p / Math.max(0.001, f))));
  }
  let o = Math.hypot(s, i);
  (o > 1 && ((s /= o), (i /= o)), (hero.moving = o > 0.08));
  let a = Math.min(4, Math.floor(state.xp / 320)),
    l = hero.moving && input.down("dash") && state.focus > 3,
    c = l ? 5.8 : 3.1;
  if (hero.moving) {
    let u = hero.x + s * c * r,
      d = hero.z + i * c * r;
    (walkable(world, u, hero.z) && (hero.x = u), walkable(world, hero.x, d) && (hero.z = d), (hero.angle = Math.atan2(s, i)));
  }
  if (
    (l ? (state.focus = Math.max(0, state.focus - (20 - a * 2) * r)) : (state.focus = Math.min(100, state.focus + (hero.moving ? 3 : 5) * r)),
    walkTarget && Math.hypot(hero.x - walkTarget.x, hero.z - walkTarget.z) < 1.8)
  ) {
    let u = walkTarget;
    ((walkTarget = null), (heroPath = []), (hero.target = null), openTarget(u));
  }
  (!heroPath.length && !walkTarget && (hero.target = null), (nearTarget = null));
  let h = 1.9;
  for (let u of targets) {
    if (!u.ready || u.done) continue;
    let d = Math.hypot(hero.x - u.x, hero.z - u.z) + (u.kind === "detail" ? 0.35 : 0);
    d < h && ((nearTarget = u), (h = d));
  }
  setInteractLabel(
    nearTarget
      ? nearTarget.kind === "exit"
        ? "DEPART"
        : ["talk", "resident"].includes(nearTarget.kind)
          ? "TALK"
          : nearTarget.kind === "door"
            ? "ENTER"
            : "INSPECT"
      : "FOLLOW LEAD",
  );
  for (let u of world.hazards)
    (worldTime + u.phase) % 3.2 > 2.05 && Math.hypot(hero.x - u.x, hero.z - u.z) < u.r && takeDamage((prefs.assisted ? 8 : 18) * (1 - state.skills.fieldcraft * 0.1));
  renderMeters();
}
/** The local signal map. The grid, walls and hazards are drawn once per room; leads and Vale on top. */
function drawMinimap() {
  let r = byId("minimap").getContext("2d");
  let e = world.bounds,
    t = 162 / (e.maxX - e.minX),
    s = 132 / (e.maxZ - e.minZ),
    i = (o, a) => ({ x: (o - e.minX) * t + 4, y: (a - e.minZ) * s + 4 });
  if (!minimapBase) {
    minimapBase = document.createElement("canvas");
    minimapBase.width = 170;
    minimapBase.height = 140;
    const b = minimapBase.getContext("2d");
    ((b.strokeStyle = "#6d8f8d25"), (b.lineWidth = 0.6));
    for (let o = 0; o <= 160; o += 20) (b.beginPath(), b.moveTo(o, 0), b.lineTo(o, 140), b.stroke());
    for (let o = 0; o < 140; o += 20) (b.beginPath(), b.moveTo(0, o), b.lineTo(170, o), b.stroke());
    b.fillStyle = "#637c7945";
    for (let o of world.colliders) {
      let a = i(o.x - o.w / 2, o.z - o.d / 2);
      b.fillRect(a.x, a.y, o.w * t, o.d * s);
    }
    for (let o of world.hazards) {
      let a = i(o.x, o.z);
      ((b.strokeStyle = "#e5956477"), b.beginPath(), b.arc(a.x, a.y, o.r * 5, 0, Math.PI * 2), b.stroke());
    }
  }
  r.clearRect(0, 0, 170, 140);
  r.drawImage(minimapBase, 0, 0);
  for (let o of targets) {
    if (o.done || !o.ready) continue;
    let a = i(o.x, o.z);
    ((r.fillStyle = o.kind === "detail" ? "#b7bca0" : o.kind === "door" ? "#97afc2" : o.optional ? "#7bd1cc" : "#e7b575"),
      r.fillRect(a.x - 2, a.y - 2, 4, 4));
  }
  let n = i(hero.x, hero.z);
  ((r.fillStyle = "#f2ead6"), r.save(), r.translate(n.x, n.y), r.rotate(Math.PI / 4), r.fillRect(-3, -3, 6, 6), r.restore());
}
/* ------------------------------------------------------------------------ */
/* The loop and input                                                        */
/* ------------------------------------------------------------------------ */

const PROMPTS = {
  keyboard: { move: "W A S D", interact: "E", scan: "Q", dash: "SHIFT", survey: "L", district: "N", quiet: "V" },
  gamepad: { move: "L-STICK", interact: "A", scan: "X", dash: "B", survey: "Y", district: "RB", quiet: "R3" },
};
const promptSource = () => (input.source === "gamepad" ? "gamepad" : input.source === "touch" ? "touch" : "keyboard");
/** Button prompts follow the last device used: keys, controller or touch. */
function renderPrompts() {
  const src = promptSource(),
    p = PROMPTS[src === "gamepad" ? "gamepad" : "keyboard"];
  document.documentElement.dataset.input = src;
  byId("keyboard-hints").innerHTML =
    `<span><kbd>${p.move}</kbd> MOVE</span><span><kbd>${p.interact}</kbd> INVESTIGATE</span><span><kbd>${p.scan}</kbd> SCAN</span><span><kbd>${p.dash}</kbd> DASH</span>`;
  byId("scan").querySelector("small").textContent = p.scan;
  byId("interact").querySelector("small").textContent = p.interact;
  byId("look-around").querySelector("kbd").textContent = p.survey;
  byId("neighborhood").querySelector("kbd").textContent = p.district;
  byId("quiet-exit").querySelector("kbd").textContent = src === "gamepad" ? "B" : p.quiet;
}
function controlsHelp() {
  const src = promptSource();
  if (src === "gamepad")
    return "MOVE: left stick or D-pad.<br>INVESTIGATE: A (walks to the current lead when nothing is close). SCAN: X. DASH: hold B or RT.<br>LOOK AROUND: Y. LOCAL MAP: LB. THE STREET: RB. CASEBOOK: View. QUIET VIEW: right-stick click. ZOOM: right stick up and down.<br>MENUS: D-pad or stick to move, A to choose, B to go back, right stick to scroll. PAUSE: Start.";
  if (src === "touch")
    return "MOVE: drag anywhere in the lower left, or tap the ground. Tapping a lead walks to it.<br>INSPECT, SCAN and DASH: the round buttons. ZOOM: pinch.<br>LOOK and STREET: the buttons on screen. PAUSE: tap RAIN CHECK at the top.";
  return "MOVE: WASD or arrows, or click the ground. Clicking a lead walks to it.<br>INVESTIGATE: E, Space or Enter. SCAN: Q. DASH: hold Shift or the right mouse button.<br>LOOK: L. STREET: N. MAP: M. CASEBOOK: J. EVIDENCE: B. EQUIPMENT: I. QUIET VIEW: V.<br>ZOOM: mouse wheel or + and -. PAUSE: Escape or P. GRAPHICS: F9.";
}
/** The investigate button's verb, on the HUD button and the touch button; written only when it changes. */
function setInteractLabel(label) {
  if (label === interactLabel) return;
  interactLabel = label;
  byId("interact").querySelector("b").textContent = label;
  kit.touch?.setLabel("interact", label === "FOLLOW LEAD" ? "Lead" : label[0] + label.slice(1).toLowerCase());
}

/** Directional presses become single focus steps with a gentle repeat (menus, grids, sliders). */
const navRepeat = createRepeater();
function preferredIn(scope) {
  if (scope === byId("dialog")) {
    const list = focusables(scope);
    return (
      (modalFocus && scope.querySelector(modalFocus)) ||
      scope.querySelector(".dialog-actions .button-primary") ||
      scope.querySelector("[data-modal-action]") ||
      list.find((el) => !el.classList.contains("dialog-close")) ||
      list[0]
    );
  }
  const cont = byId("continue");
  return cont.classList.contains("hidden") ? byId("start") : cont;
}
function navigate(scope, dir) {
  const cur = document.activeElement;
  if (!cur || cur === document.body || !scope.contains(cur) || !focusables(scope).includes(cur)) return focusEl(preferredIn(scope));
  if (dir[0] && adjust(cur, dir[0])) return;
  const next = neighbour(scope, cur, dir[0], dir[1]);
  next && focusEl(next);
}
/** A (or Space/Enter when nothing has focus): press the focused control, or land on the main one first. */
function confirmIn(scope) {
  const cur = document.activeElement;
  if (cur && cur !== document.body && scope.contains(cur)) activate(cur);
  else focusEl(preferredIn(scope));
}
function focusLanding() {
  input.source === "gamepad" && requestAnimationFrame(() => !modalOpen && !playing && focusEl(preferredIn(byId("app"))));
}
/** Wheel, pinch, + and -, or the right stick: zoom the city view (also in the quiet view). */
function applyZoom(dt) {
  const z = input.zoom() * 0.08 + input.value("zoom") * dt * 1.1;
  if (Math.abs(z) < 1e-4) return;
  view.setZoom(view.zoom + z);
  byId("quiet-zoom").value = String(view.zoom);
  prefs.zoom = Math.round(view.zoom * 100) / 100;
  clearTimeout(zoomSaveTimer);
  zoomSaveTimer = setTimeout(saveSettings, 700);
}
/** A tap or click on open street walks there (a drag or a pinch does not). */
function tapToWalk() {
  const p = input.pointer;
  if (p.justDown) tapStart = { x: p.x, y: p.y, t: performance.now(), primary: p.type !== "mouse" || input.down("click") };
  if (!p.justUp || !tapStart) return;
  const tap = tapStart;
  tapStart = null;
  if (!tap.primary || Math.hypot(p.x - tap.x, p.y - tap.y) > 14 || performance.now() - tap.t > 650 || state.ended) return;
  const rect = kit.canvas.getBoundingClientRect(),
    e = view.ground(p.x + rect.left, p.y + rect.top);
  if (!walkable(world, e.x, e.z)) {
    toast("Tap an open part of the street, or a lead marker.");
    return;
  }
  ((heroPath = findPath(world, hero, e)), (walkTarget = null), (hero.target = e), audio.start());
}
function handleInput(dt) {
  const dir = navRepeat(input.vector("move"), dt);
  if (modalOpen) {
    const dialog = byId("dialog");
    if ((input.pressed("back") || input.pressed("pause")) && modalCloseable) return closeModal();
    if (dir && !(modalDirection && modalDirection(dir[0], dir[1]))) navigate(dialog, dir);
    if (input.pressed("interact") && !(modalConfirm && modalConfirm())) confirmIn(dialog);
    // The right stick (and + / -) scrolls long records.
    const scroll = input.value("zoom");
    Math.abs(scroll) > 0.2 && (dialog.scrollTop -= scroll * dt * 900);
    return;
  }
  if (!playing) {
    dir && navigate(byId("app"), dir);
    input.pressed("interact") && confirmIn(byId("app"));
    return;
  }
  if (quietView) {
    (input.pressed("back") || input.pressed("pause") || input.pressed("quiet")) && toggleQuietView();
    applyZoom(dt);
    return;
  }
  if (input.pressed("pause")) openPause();
  else if (input.pressed("quiet")) toggleQuietView();
  else if (input.pressed("interact")) interact();
  else if (input.pressed("scan")) scan();
  else if (input.pressed("survey")) openLook();
  else if (input.pressed("casebook")) openCasebook();
  else if (input.pressed("board")) openCasebook("board");
  else if (input.pressed("inventory")) openCasebook("inventory");
  else if (input.pressed("localMap")) openLocalMap();
  else if (input.pressed("district")) openDistrict();
  if (modalOpen) return;
  applyZoom(dt);
  tapToWalk();
}
function frame(rawDt) {
  const e = Math.min(rawDt, 0.05);
  handleInput(e);
  if (modalOpen) modalTick?.(e);
  else {
    worldTime += e;
    playing && !state.ended && !quietView && updateHero(e);
    updateLife(e);
    updateStreetVoices(e);
    audio.tick(worldTime);
  }
  view.render(worldTime, hero, e);
  if (playing) {
    placeMarkers();
    ++minimapFrame % 3 === 0 && drawMinimap();
    !modalOpen && worldTime - lastAutosaveAt > 9 && (save(), (lastAutosaveAt = worldTime));
  }
}
// Keep Tab inside an open dialog (keyboard accessibility).
window.addEventListener("keydown", (r) => {
  if (!modalOpen || r.code !== "Tab") return;
  let e = focusables(byId("dialog"));
  if (!e.length) return;
  let t = e[0],
    s = e.at(-1);
  r.shiftKey && document.activeElement === t
    ? (s.focus(), r.preventDefault())
    : !r.shiftKey && document.activeElement === s && (t.focus(), r.preventDefault());
});
// Audio can only start after a gesture; every tap, click and key gets another chance.
for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, () => audio.unlock(), { capture: !0, passive: !0 });
document.addEventListener("visibilitychange", () => {
  document.hidden ? (save(), audio.ctx?.suspend().catch(() => {})) : audio.unlock();
});
kit.onPause((p) => {
  audio.setPaused(p);
  p && save();
});
input.onSourceChange(renderPrompts);
byId("start").onclick = startNewGame;
byId("continue").onclick = () => beginNight(!0);
byId("about").onclick = openAbout;
byId("settings").onclick = openSettings;
byId("brand").onclick = openPause;
byId("casebook").onclick = () => openCasebook();
byId("evidence-board").onclick = () => openCasebook("board");
byId("local-map").onclick = openLocalMap;
byId("track-objective").onclick = () => goTo(currentLead());
byId("interact").onclick = interact;
byId("scan").onclick = scan;
byId("look-around").onclick = openLook;
byId("neighborhood").onclick = () => openDistrict();
byId("district-track").onclick = () => followQuest(state.district.tracked);
byId("quiet-exit").onclick = toggleQuietView;
byId("quiet-zoom").oninput = (r) => {
  view.setZoom(Number(r.target.value));
  prefs.zoom = Math.round(view.zoom * 100) / 100;
  saveSettings();
};
byId("sound").onclick = () => {
  ((prefs.audio = !prefs.audio), audio.mute(), saveSettings());
};
byId("import-save").addEventListener("change", async (r) => {
  let e = r.target.files?.[0];
  if (e)
    try {
      if (e.size > 15e5) throw new Error("Save too large");
      let t = validateSave(JSON.parse(await e.text()));
      if (!t) throw new Error("Invalid save format");
      ((savedGame = t), dismissModal(), beginNight(!0), toast("Your night has been restored."));
    } catch {
      toast("That file is not a valid Rain Check save. Your current save was not changed.");
    } finally {
      r.target.value = "";
    }
});
window.RainCheck = {
  openDistrict: openDistrict,
  openStreetNotes: openStreetNotes,
  getState: () => structuredClone(state),
  getWorld: () => structuredClone(world),
  getTasks: () => structuredClone(targets),
  getHero: () => ({ ...hero }),
  getBackend: () => view.backend,
  getAllTasks: () => structuredClone(caseTasks),
};
new URLSearchParams(location.search).has("test") &&
  Object.assign(window.RainCheck, {
    resident: (r) => {
      (dismissModal(), enterRoom(RESIDENT_BY_ID[r].room));
      let e = targets.find((t) => t.person === r && t.kind === "resident");
      ((hero.x = e.x), (hero.z = e.z), openResident(r));
    },
    districtDevice: (r) => {
      (dismissModal(), enterRoom(QUEST_BY_ID[r].room), openDevice(r));
    },
    districtTab: openDistrict,
    followQuest: followQuest,
    begin: () => beginNight(!1),
    dismiss: dismissModal,
    load: (r) => {
      ((state = newGame()),
        (state.chapter = r),
        (playing = !0),
        kit.touch?.suspend(!1, "title"),
        (view.landing = !1),
        byId("landing").classList.add("hidden"),
        byId("hud").classList.remove("hidden"),
        view.resize(),
        dismissModal(),
        loadCase(r));
    },
    go: (r) => goTo(targets.find((e) => e.id === r)),
    interact: (r) => {
      let e = caseTasks.find((t) => t.id === r) || targets.find((t) => t.id === r);
      (e && e.kind !== "door" && e.room !== state.room && enterRoom(e.room), e && ((hero.x = e.x), (hero.z = e.z), openTarget(e)));
    },
    damage: () => {
      ((hurtUntil = 0), takeDamage(100));
    },
    setFocus: (r) => (state.focus = r),
    room: (r) => enterRoom(r),
    visit: (r, e) => {
      (dismissModal(), (state.chapter = r), loadCase(r), e && enterRoom(e));
    },
    setAssisted: (r) => (prefs.assisted = r),
    book: openCasebook,
    setCredits: (r) => (state.credits = r),
    scene: openLook,
    detail: (r) => {
      let e = targets.find((t) => t.id === r);
      e && ((hero.x = e.x), (hero.z = e.z), openDetail(e));
    },
    moment: openMoment,
    quiet: toggleQuietView,
    setCaptions: (r) => (prefs.captions = r),
    advanceAmbient: (r) => {
      ((worldTime += r), updateLife(0));
    },
    audioOn: () => {
      ((prefs.audio = !0), audio.start(), audio.setRoom(world));
    },
    audioInfo: () => audio.info(),
  });
renderSoundButton();
savedGame && byId("continue").classList.remove("hidden");
// The title screen shows the opening street behind it, whatever the saved night holds.
var bootState = state;
state = newGame();
loadCase(0);
state = bootState;
view.landing = !0;
view.resize();
hero = { x: 0, z: 3.6, angle: 0.1, moving: !1 };
kit.touch?.suspend(!0, "title");
renderPrompts();
kit.loading.progress(0.85, "Lighting the street…");
await view.warm();
kit.start(frame);
focusLanding();
function sceneArt(r) {
  let e = [
    "#d4a16d",
    "#76bec2",
    "#c99589",
    "#9bbeb6",
    "#d894b5",
    "#7ccec8",
    "#bf82aa",
    "#84a6bc",
    "#c0b989",
    "#d0b777",
    "#84c3d0",
    "#e4caaa",
  ][r];
  return `<svg viewBox="0 0 720 180" aria-hidden="true"><defs><linearGradient id="scene-sky" x2="0" y2="1"><stop stop-color="#14252e"/><stop offset="1" stop-color="#496168"/></linearGradient></defs><path fill="url(#scene-sky)" d="M0 0h720v180H0z"/>${Array.from(
    { length: 24 },
    (t, s) => {
      let i = 35 + ((s * 31 + r * 7) % 120);
      return `<path fill="${s % 2 ? "#1e343e" : "#263f48"}" d="M${s * 32 - 12} ${180 - i}h27v${i}h-27z"/>${Array.from({ length: Math.floor(i / 19) }, (n, o) => `<path fill="${e}" opacity=".4" d="M${s * 32 - 6} ${189 - i + o * 19}h3v5h-3z m10 0h3v5h-3z"/>`).join("")}`;
    },
  ).join(
    "",
  )}<path fill="#102832" d="M0 150l180-18 126 17 169-15 245 31v15H0z"/><path stroke="${e}" opacity=".45" d="M0 169h720M320 172h290"/>${Array.from({ length: 30 }, (t, s) => `<path d="M${s * 29} 0l-27 180" stroke="#c6e2e5" opacity=".07"/>`).join("")}<path fill="${e}" d="M334 125h12v31h-12z"/><path fill="#cebfa4" d="M336 115h9v10h-9z"/><path stroke="#101d28" stroke-width="5" d="M337 156v12m7-12v12"/></svg>`;
}
function portraitFrame(r, e = !1) {
  let t = RESIDENT_BY_ID[r] || WITNESSES[r] || { name: "Inspector Vale" };
  return `<div class="portrait ${e ? "large" : ""}" aria-label="Portrait of ${esc(t.name)}">${portrait(r, "neutral", r === "vale")}<span>${esc(t.name.toUpperCase())}</span></div>`;
}
function casebookTabs(r) {
  return `<div class="dialog-tabs">${[
    ["district", "THE STREET"],
    ["board", "EVIDENCE"],
    ["inventory", "EQUIPMENT"],
    ["people", "PEOPLE"],
    ["threads", "SIDE STORIES"],
    ["skills", "TRAINING"],
    ["notes", "NOTES"],
    ["cases", "THE NIGHT"],
  ]
    .map(([e, t]) => `<button data-tab="${e}" class="${r === e ? "active" : ""}">${t}</button>`)
    .join("")}</div>`;
}
function bindCasebookTabs(r) {
  r.querySelectorAll("[data-tab]").forEach((e) => (e.onclick = () => openCasebook(e.dataset.tab)));
}
function openCasebookPage(r) {
  let e = "";
  if (r === "board") {
    let s = caseTasks.find((a) => a.kind === "deduction"),
      i = CASES[state.chapter],
      n = CASE_SETTINGS[state.chapter],
      o = [
        { id: "trace-" + state.chapter, label: "PHYSICAL TRACE" },
        { id: "operation-" + state.chapter, label: "FIELD RECORD" },
      ];
    e = `<div class="board-overview"><span class="micro">CASE ${String(state.chapter + 1).padStart(2, "0")} / ${esc(i.title.toUpperCase())}</span><h3>${esc(n.deduction.question)}</h3><div class="evidence-link-board">${o.map((a) => `<article class="evidence-card ${state.inventory.includes(a.id) ? "filed" : "missing"}"><small>${a.label}</small><b>${state.inventory.includes(a.id) ? esc(ITEMS[a.id][0]) : "NOT YET RECOVERED"}</b><p>${state.inventory.includes(a.id) ? esc(ITEMS[a.id][1]) : "Follow the current lead. This part of the theory needs evidence."}</p></article>`).join('<div class="evidence-connector">+</div>')}</div><div class="theory-box"><span>${isDone(state, "case-theory") ? "THEORY SUPPORTED" : "THEORY NOT YET FILED"}</span><p>${isDone(state, "case-theory") ? esc(n.deduction.conclusions[n.deduction.correct]) : "Select the two relevant records and test a conclusion at the case board."}</p>${isDone(state, "case-theory") ? "" : `<button class="small-button" id="visit-board" ${s?.ready ? "" : "disabled"}>GO TO CASE BOARD</button>`}</div></div><div class="micro"><span>${state.clues.length}/24 FIELD RECORDS</span><span>${state.deductions.length}/12 SUPPORTED THEORIES</span></div><p class="fine-print">Evidence supports a claim. A missing memory does not prove an identity. Notes retain the source of each finding.</p>`;
  }
  (r === "people" &&
    (e = `<p class="fine-print">Conversations build connections. These records describe what people told you, not what a machine says they are.</p><div class="people-grid">${Object.entries(
      WITNESSES,
    )
      .map(([s, i]) => {
        let n = state.relationships[s] || state.journal.some((o) => o.title.includes(i.name));
        return `<article class="person-card ${n ? "" : "unknown"}">${portraitFrame(s)}<div><h3>${esc(i.name)}</h3><p>${esc(i.role)}</p><small>${n ? `CONNECTION ${state.relationships[s] || 0}` : "NOT YET INTERVIEWED"}</small><div class="connection-meter"><i style="width:${Math.min(100, (state.relationships[s] || 0) * 10)}%"></i></div>${n ? `<p>${esc(i.topics[0].text)}</p>` : ""}</div></article>`;
      })
      .join("")}</div>`),
    r === "threads" &&
      (e = `<p class="fine-print">Four original side stories cross the night. Each has three parts. Missed parts remain missed; later meetings still make sense.</p>${Object.entries(
        THREADS,
      )
        .map(([s, i]) => {
          let n = state.threads[s] || [];
          return `<article class="thread-card"><div class="micro"><span>SIDE STORY</span><span>${n.length}/3 PARTS FILED</span></div><h3>${esc(i.name)}</h3><div class="thread-route">${i.chapters.map((o) => `<span class="${n.some((a) => a.chapter === o) ? "done" : o < state.chapter ? "missed" : ""}">${String(o + 1).padStart(2, "0")}<small>${n.some((a) => a.chapter === o) ? "FILED" : o < state.chapter ? "MISSED" : o === state.chapter ? "HERE" : "AHEAD"}</small></span>`).join("<i></i>")}</div><p>${n.length === 3 ? esc(i.ending) : n.length ? "The next part follows the case route. Check the third area in its district." : "Look for a cyan marker in the third area of the listed case."}</p></article>`;
        })
        .join("")}`),
    r === "skills" &&
      (e = `<div class="training-balance"><strong>${state.skillPoints}</strong><div>TRAINING POINTS<small>Earn one for each supported theory and one for each closed case.</small></div></div>${Object.entries(
        SKILLS,
      )
        .map(([s, i]) => {
          let n = state.skills[s],
            o = n + 1;
          return `<article class="skill-card"><div><h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p><div class="skill-pips">${[0, 1, 2].map((a) => `<i class="${a < n ? "active" : ""}"></i>`).join("")}</div></div><button class="small-button" data-skill="${s}" ${n >= 3 || state.skillPoints < o ? "disabled" : ""}>${n >= 3 ? "MAXIMUM" : `TRAIN / ${o} PT`}</button></article>`;
        })
        .join(
          "",
        )}<p class="fine-print">Training changes mechanics immediately. No skill is required to finish a case. Points and upgrades are saved with your night.</p>`));
  let t = openModal("The casebook", casebookTabs(r) + e, [], { wide: !0, eyebrow: "VALE / THE LIVING CITY" });
  (bindCasebookTabs(t),
    byId("visit-board")?.addEventListener("click", () => {
      (dismissModal(), goTo(caseTasks.find((s) => s.id === "case-theory")));
    }),
    t.querySelectorAll("[data-skill]").forEach(
      (s) =>
        (s.onclick = () => {
          trainSkill(state, s.dataset.skill) && (save(), audio.success(), openCasebookPage("skills"));
        }),
    ));
}
function openLocalMap() {
  if (!playing) return;
  if (state.chapter === 0) {
    openDistrict("places");
    return;
  }
  let r = CASES[state.chapter];
  openModal(
    r.district,
    `<p>Each area is connected by marked doors. Select a destination to walk to its door. Main leads are gold. Optional records are cyan.</p><div class="location-list">${r.rooms
      .map((t, s) => {
        let i = caseTasks.filter((n) => n.room === s && n.kind !== "exit");
        return `<button class="location-card ${s === state.room ? "current" : ""}" data-room="${s}"><span class="location-number">0${s + 1}</span><div><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><small>${i.filter((n) => n.done).length}/${i.length} RECORDS FILED \xB7 ${s === state.room ? "YOU ARE HERE" : state.visited.includes(state.chapter + ":" + s) ? "VISITED" : "NOT YET VISITED"}</small></div><b>\u2197</b></button>`;
      })
      .join("")}</div>`,
    [],
    { eyebrow: "LOCAL MAP / THREE CONNECTED AREAS" },
  )
    .querySelectorAll("[data-room]")
    .forEach(
      (t) =>
        (t.onclick = () => {
          let s = Number(t.dataset.room);
          (dismissModal(), s !== state.room && goTo(targets.find((i) => i.kind === "door" && i.destination === s)));
        }),
    );
}
function openInterview(r, e = -1) {
  let t = WITNESSES[r.person],
    s = taskProgress(state, r),
    i = s.topics,
    n = t.topics,
    o = e >= 0 ? n[e].text : r.text,
    a = r.choices || [["Record the account.", "You record the account without adding a conclusion.", { xp: 10 }]];
  openModal(
    r.label,
    `<div class="conversation-header">${portraitFrame(r.person)}<div><small>${esc(t.role.toUpperCase())}</small><p>${esc(o)}</p><div class="vale-listening">${portrait("vale", "neutral", !0, state.district.keepsakes.includes("bird-pin"))}<span>VALE / LISTENING</span></div><span class="witness-status">${i.length}/${n.length} TOPICS HEARD \xB7 CONNECTION ${state.relationships[r.person] || 0}</span></div></div><div class="topic-grid">${n.map((c, h) => `<button class="topic-button ${i.includes(h) ? "heard" : ""} ${e === h ? "active" : ""}" data-topic="${h}"><span>${i.includes(h) ? "\u2713" : "?"}</span>${esc(c.label)}</button>`).join("")}</div>${i.length < 2 ? '<div class="hint-strip">Hear at least two topics before you close the interview.</div>' : '<div class="micro">CHOOSE HOW TO CLOSE THE INTERVIEW</div>'}`,
    i.length >= 2
      ? a.map(([c, h, u]) => ({
          label: canAfford(state, u) ? c : c + " [not enough credits]",
          run: () => {
            if (!canAfford(state, u)) {
              toast("This choice needs more credits.");
              return;
            }
            recordTask(r, u, h);
          },
        }))
      : [],
    {
      eyebrow: "WITNESS INTERVIEW / " + t.name.toUpperCase(),
      footer: "Topics are saved as you hear them. Close this panel to take a break. The account will still be here.",
    },
  )
    .querySelectorAll("[data-topic]")
    .forEach(
      (c) =>
        (c.onclick = () => {
          let h = Number(c.dataset.topic);
          (i.includes(h) ||
            (i.push(h),
            state.stats.topics++,
            state.journal.push({ chapter: state.chapter, title: t.name + " / " + n[h].label, text: n[h].text }),
            save()),
            openInterview(r, h));
        }),
    );
}
function openFieldWork(r) {
  if (r.kind === "forensic") return openForensics(r);
  if (r.kind === "deduction") return openDeduction(r);
  if (r.kind === "challenge") return openChallenge(r);
  if (r.kind === "document")
    return openModal(
      r.label,
      `<div class="document-sheet"><div class="document-stamp">LOCAL RECORD / ${String(state.chapter + 1).padStart(2, "0")}</div><p>${esc(r.text)}</p><span class="document-signature">RETAIN THE ORIGINAL. RECORD WHAT IT SAYS.</span></div>`,
      [{ label: "ADD TO FIELD NOTES", primary: !0, run: () => recordTask(r, { xp: 8 }, r.text) }],
      { eyebrow: "OPTIONAL / ENVIRONMENTAL RECORD" },
    );
  if (r.kind === "thread") {
    let e = state.threads[r.thread] || [],
      t = THREADS[r.thread],
      s = t.chapters.indexOf(state.chapter) + 1,
      i =
        s === 1
          ? "This is the first part of a three-part story."
          : e.length
            ? `You recorded ${e.length} earlier part${e.length === 1 ? "" : "s"}. Your earlier approach was ${e.at(-1).approach === "care" ? "to give the person control" : "to preserve a protected record"}.`
            : "You missed the earlier meeting. A saved note provides enough context to continue.";
    return openModal(
      r.label,
      `<div class="micro"><span>${esc(t.name.toUpperCase())}</span><span>PART ${s}/3</span></div><div class="narrative">${esc(r.text)}</div><p class="history-callout">${esc(i)}</p>`,
      r.choices.map(([n, o, a]) => ({ label: n, run: () => recordTask(r, a, o) })),
      {
        eyebrow: "CROSSING PATHS / ORIGINAL SIDE STORY",
        footer: "Both choices preserve the case route. Your choice is retained in the side-story record.",
      },
    );
  }
}
function evidenceArt(r, e = [], t = "lens") {
  let s = t === "uv" ? "#b193dc" : t === "audio" ? "#70d6c0" : "#dbb688",
    i = "#b5b19b",
    n = "#3d535c",
    o = "#718589",
    a = (u, d, p, f = 5) =>
      Array.from({ length: f }, (g, m) => `<path d="M${u} ${d + m * 12}h${p - (m % 3) * 17}" stroke="${n}" stroke-width="3"/>`).join(""),
    l = (u = 140) =>
      `<path d="M125 ${u}h48l10-18 9 41 12-59 13 80 9-44h49l8-13 11 25 9-43 11 62 9-31h40l8-22 11 47 11-58 11 45 9-13h53" fill="none" stroke="${s}" stroke-width="3"/>`,
    c = (u, d = !1) =>
      `<path d="M148 33h331v180H148z" fill="${i}"/><path d="M171 61h188v10H171z" fill="${n}"/>${a(171, 94, 219, 7)}<text x="171" y="198" font-size="12" font-family="monospace" fill="${n}">${u}</text>${d ? '<path d="M309 33v180M148 128h331" stroke="#788586" stroke-width="2"/>' : ""}`,
    h = [
      `<path d="M153 47l163-14 174 35-22 132-169 20-157-47z" fill="${i}"/><path d="M153 47l146 62 191-41M299 109v111M153 47l-11 126 157-64" fill="none" stroke="#79847d" stroke-width="3"/><path d="M190 139l101-13 20 47-112 14z" fill="#d9c8a9"/>${a(203, 145, 62, 3)}<path d="M349 110l69-14 9 28-75 15z" fill="${s}" opacity=".65"/>`,
      `<rect x="101" y="48" width="438" height="157" rx="8" fill="#38525d"/><rect x="118" y="69" width="400" height="113" fill="#142a35"/>${l()}<path d="M299 69v113M307 69v113" stroke="#d7b38d" stroke-width="2"/><text x="126" y="91" fill="${s}" font-size="12" font-family="monospace">RAW TRACK / DELETION WINDOW</text>`,
      `<path d="M163 25h306v202H163z" fill="#6d7671"/><path d="M186 40h258v172H186z" fill="#475759"/><path d="M294 74h93v79h-93z" fill="${o}"/><path d="M323 88h45v47h-45z" fill="#203a47"/><path d="M344 104h105v13H344z" fill="${i}"/><path d="M207 158l31-27m-34 42l30-27m161 49l30-36" stroke="${s}" stroke-width="3"/><path d="M179 213h286v13H179z" fill="#ac9e81"/>`,
      `<ellipse cx="299" cy="197" rx="145" ry="27" fill="#809690"/><path d="M212 89h168l-13 90q-72 37-143 0z" fill="#c1c0a5"/><ellipse cx="296" cy="89" rx="84" ry="25" fill="#e0d6bc"/><ellipse cx="296" cy="89" rx="68" ry="16" fill="#493f38"/><path d="M378 106q74-19 64 34t-69 28" fill="none" stroke="#b7baa4" stroke-width="18"/><path d="M235 138l25 17M267 164l4 25" stroke="${s}" stroke-width="4"/><path d="M279 44q-15-14 5-28m32 32q14-18-4-31" fill="none" stroke="#90a8a9" stroke-width="2"/>`,
      `<path d="M144 82l310-35 60 58-16 89-309 21-48-55z" fill="#809087"/><path d="M144 82l65 42 305-19M209 124v91" fill="none" stroke="#405a5e" stroke-width="3"/><path d="M272 130l102-4 5 53-102 6z" fill="${i}"/>${a(287, 140, 60, 3)}<path d="M353 77q30-34 34-8 38-27 28 11-20 29-32 11-11 19-30-14" fill="${s}" opacity=".7"/><path d="M200 69l19 28m15-30l15 28m15-29l15 27" stroke="#b5b99e" stroke-width="3"/>`,
      `${c("REFERENCE SAMPLE: UNVERIFIED")}<path d="M160 167h305" stroke="#5d7478"/><path d="M177 150q58-102 91-18t81 14 83-37" fill="none" stroke="#7074a0" stroke-width="3"/><path d="M177 142q46-39 101-5t149-9" fill="none" stroke="#827359" stroke-width="3"/><circle cx="411" cy="71" r="22" fill="none" stroke="${s}" stroke-width="4"/>`,
      `<rect x="153" y="33" width="245" height="174" fill="#344b56"/><rect x="166" y="46" width="220" height="148" fill="#789493"/><path d="M178 154l118-61 67 89" stroke="#c1ba9c" fill="none" stroke-width="4"/><path d="M415 74l87 10-16 121-95-14z" fill="${i}"/>${a(419, 109, 51, 5)}<path d="M227 204h186v19H227z" fill="#ac7e68"/><circle cx="255" cy="63" r="17" fill="${s}" opacity=".6"/>`,
      `<path d="M154 39h330v177H154z" fill="#70858a"/><path d="M171 57h296v140H171z" fill="#213944"/><path d="M205 88h196v17H205zm0 60h210v17H205z" fill="#a49c79"/><path d="M246 68v36l33 35v46M333 71v29l-28 42v38M397 70v38l-34 29v48" fill="none" stroke="${s}" stroke-width="9"/><path d="M313 113l-24 33m37-26l-23 28" stroke="#122733" stroke-width="12"/><circle cx="199" cy="76" r="8" fill="#cad0b6"/>`,
      `<path d="M245 161h91l-17 60h-57z" fill="#9c7862"/><path d="M288 164V57m0 59l-52-37m54 13l54-41m-56 78l58-17" stroke="#9f9b71" stroke-width="8"/><path d="M229 73q-36-35 6-29 28 8 20 40m86-40q7-42 27-16 18 28-27 37m8 44q31-40 44-10 0 31-47 27" fill="#809787"/><rect x="385" y="134" width="112" height="72" fill="#788b8a"/><rect x="398" y="144" width="86" height="22" fill="#213a46"/>${a(400, 182, 57, 2)}<path d="M196 166h40v29h-40z" fill="${i}"/>`,
      `${c("CONSENT / DATE BEFORE SIGNATURE", !0)}<path d="M339 155q12-39 26-3t26-7 20 10" fill="none" stroke="#44545b" stroke-width="2"/><path d="M183 84h72v22H183z" fill="none" stroke="${s}" stroke-width="3"/><path d="M413 167l93-101 8 8-93 102-12 6z" fill="#a99570"/>`,
      `<rect x="130" y="45" width="373" height="164" fill="#5e797e"/><rect x="149" y="63" width="335" height="124" fill="#122d39"/>${l(133)}<path d="M186 78v94m73-94v94m73-94v94m73-94v94" stroke="#35545e"/><path d="M293 66v118" stroke="#d6a36e" stroke-width="2"/><path d="M503 86h32v88h-32" fill="none" stroke="#a4ac99" stroke-width="5"/><text x="156" y="80" fill="${s}" font-size="10" font-family="monospace">STORM BAND / SECOND CARRIER</text>`,
      `<path d="M128 53q91-26 189-1 103-26 207 2v157q-110-24-207-1-104-26-189-1z" fill="${i}"/><path d="M317 52v158" stroke="#657978" stroke-width="4"/>${a(148, 82, 141, 9)}${a(340, 81, 147, 9)}<path d="M346 129l86 5m-81 4l75-18m-11 34l52-17" fill="none" stroke="${s}" stroke-width="3"/><path d="M181 224l217-17 1 7-217 17-16-3z" fill="#b58e69"/>`,
    ][r];
  return `<svg viewBox="0 0 640 260" aria-hidden="true"><path fill="#112631" d="M0 0h640v260H0z"/>${Array.from({ length: 20 }, (u, d) => `<path d="M${d * 36} 0v260M0 ${d * 26}h640" stroke="#2d4752" stroke-width=".5"/>`).join("")}${h}${[155, 321, 486].map((u, d) => `<circle cx="${u}" cy="${[89, 155, 114][d]}" r="26" fill="${s}" opacity=".13"/><circle cx="${u}" cy="${[89, 155, 114][d]}" r="23" fill="none" stroke="${e.includes(d) ? "#8ee0b6" : s}" stroke-width="2"/><text x="${u}" y="${[95, 161, 120][d]}" text-anchor="middle" fill="${s}" font-family="monospace" font-size="16">${e.includes(d) ? "\u2713" : "0" + (d + 1)}</text>`).join("")}<text x="20" y="246" fill="${s}" font-family="monospace" font-size="11">EVIDENCE VIEW ${String(r + 1).padStart(2, "0")} / ${t.toUpperCase()}</text></svg>`;
}
function openForensics(r, e = "lens", t = "Select an instrument. Then inspect one of the three marked details.") {
  let s = taskProgress(state, r),
    i = s.found.length === r.observations.length,
    n = openModal(
      r.label,
      `<p>${esc(r.text)}</p><div class="instrument-bar">${[
        ["lens", "LENS"],
        ["uv", "UV LIGHT"],
        ["audio", "AUDIO PROBE"],
      ]
        .map(([o, a]) => `<button class="${e === o ? "active" : ""}" data-instrument="${o}">${a}</button>`)
        .join(
          "",
        )}</div><div class="evidence-view">${evidenceArt(state.chapter, s.found, e)}</div><div class="observation-list">${r.observations.map((o, a) => `<button class="observation-button ${s.found.includes(a) ? "found" : ""}" data-observation="${a}"><b>${s.found.includes(a) ? "\u2713" : "0" + (a + 1)}</b><span><strong>${esc(o.label)}</strong><small>${esc(o.visible)}</small></span></button>`).join("")}</div><div class="hint-strip" id="forensic-feedback">${esc(t)}</div><div class="micro"><span>${s.found.length}/3 DETAILS RECORDED</span><span>FOCUS ${Math.round(state.focus)}</span></div>`,
      i ? [{ label: "SEAL THE EVIDENCE RECORD", primary: !0, run: () => recordTask(r, {}, r.observations.map((o) => o.finding).join(" ")) }] : [],
      {
        eyebrow: "FIELD FORENSICS / KEEP OBSERVATION SEPARATE FROM THEORY",
        focus: "[data-instrument]",
        footer:
          "Lens resolves surfaces. UV light resolves dye and heat traces. The audio probe isolates a signal. Wrong tools cost focus, not evidence.",
      },
    );
  (n.querySelectorAll("[data-instrument]").forEach((o) => (o.onclick = () => openForensics(r, o.dataset.instrument))),
    n.querySelectorAll("[data-observation]").forEach(
      (o) =>
        (o.onclick = () => {
          let a = inspectObservation(state, r, Number(o.dataset.observation), e);
          (a.ok ? audio.note(440, 0.15) : audio.note(110, 0.12), save(), renderMeters(), openForensics(r, e, a.text));
        }),
    ));
}
function openDeduction(r, e = [], t = -1, s = "Select two records, then choose the conclusion they support.") {
  let i = r.evidenceIds,
    n = ["badge", "scanner"],
    o = [i[0], n[0], i[1], n[1]],
    a = openModal(
      r.question,
      `<div class="deduction-grid">${o.map((l) => `<button data-clue="${l}" class="deduction-card ${e.includes(l) ? "selected" : ""}"><small>${e.includes(l) ? "SELECTED" : "EVIDENCE"}</small><b>${esc(ITEMS[l][0])}</b><p>${esc(ITEMS[l][1])}</p></button>`).join("")}</div><div class="conclusion-list">${r.conclusions.map((l, c) => `<button data-conclusion="${c}" class="conclusion ${t === c ? "selected" : ""}"><span>${String(c + 1).padStart(2, "0")}</span>${esc(l)}</button>`).join("")}</div><div class="hint-strip" id="theory-feedback">${esc(s)}</div>`,
      [
        {
          label: "TEST THE THEORY",
          primary: !0,
          run: () => {
            if (e.length !== 2 || t < 0) {
              byId("theory-feedback").textContent = "Select exactly two records and one conclusion.";
              return;
            }
            i.every((l) => e.includes(l)) && t === r.correct
              ? recordTask(r, { xp: 25 }, r.conclusions[r.correct] + " The physical trace and the field record support this conclusion.")
              : (recordMistake(state, 4),
                save(),
                renderMeters(),
                openDeduction(
                  r,
                  e,
                  t,
                  "The selected evidence does not support that claim. Review the two recovered records. No part of the theory has been filed.",
                ));
          },
        },
      ],
      {
        wide: !0,
        eyebrow: "CASE BOARD / OBSERVE \u2192 COMPARE \u2192 CONCLUDE",
        focus: "[data-clue]",
        footer: "A supported theory awards one training point. A wrong theory can be retried.",
      },
    );
  (a.querySelectorAll("[data-clue]").forEach(
    (l) =>
      (l.onclick = () => {
        let c = l.dataset.clue,
          h = e.includes(c) ? e.filter((u) => u !== c) : e.length < 2 ? [...e, c] : [e[1], c];
        openDeduction(r, h, t);
      }),
  ),
    a.querySelectorAll("[data-conclusion]").forEach((l) => (l.onclick = () => openDeduction(r, e, Number(l.dataset.conclusion)))));
}
function openChallenge(r) {
  if (r.mechanic === "circuit") return openCircuit(r);
  if (r.mechanic === "timeline") return openTimeline(r);
  if (r.mechanic === "stealth") return openStealth(r);
  if (r.mechanic === "empathy") return openEmpathy(r);
  if (r.mechanic === "chase") return openChase(r);
}
function wireTile(r, e) {
  let t = e ? "#85ddd1" : "#80959f";
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M0 0h80v80H0z" fill="#203640"/>${[
    [1, "M40 40V0"],
    [2, "M40 40H80"],
    [4, "M40 40V80"],
    [8, "M40 40H0"],
  ]
    .filter(([s]) => r & s)
    .map(([, s]) => `<path d="${s}" stroke="#0f222c" stroke-width="16"/><path d="${s}" stroke="${t}" stroke-width="7"/>`)
    .join("")}<circle cx="40" cy="40" r="9" fill="${t}"/><circle cx="40" cy="40" r="3" fill="#203640"/></svg>`;
}
function openCircuit(r, e = "Rotate a tile to connect its open ends. Send power from IN to OUT.") {
  let t = taskProgress(state, r),
    s = state.chapter;
  t.tiles || (t.tiles = circuitLayout(s).tiles);
  let i = circuitPower(t.tiles);
  openModal(
    r.label,
    `<p>${esc(r.text)}</p><div class="micro"><span class="source-label">IN \u2198</span><span>ROTATE EACH TILE / 4 \xD7 4</span></div><div class="circuit-grid">${t.tiles
      .map(
        (o, a) =>
          `<button data-wire="${a}" class="wire ${i.powered.includes(a) ? "powered" : ""}" aria-label="Rotate wire ${a + 1}. Connections: ${[
            [1, "north"],
            [2, "east"],
            [4, "south"],
            [8, "west"],
          ]
            .filter(([l]) => o & l)
            .map(([, l]) => l)
            .join(", ")}">${wireTile(o, i.powered.includes(a))}<small>${a + 1}</small></button>`,
      )
      .join(
        "",
      )}</div><div class="micro"><span>${i.powered.length}/16 TILES POWERED</span><span class="source-label">OUT \u2197</span></div><div class="hint-strip" id="circuit-feedback">${esc(e)}</div>`,
    [
      {
        label: "CHECK THE OUTPUT",
        primary: !0,
        run: () => {
          circuitPower(t.tiles).solved
            ? recordTask(r, { xp: 15 }, r.result)
            : (t.failures++,
              recordMistake(state, 4),
              save(),
              openCircuit(r, "The output has no complete path. Check the inlet on the left of tile 1 and the outlet on the right of tile 16."));
        },
      },
      ...(state.skills.fieldcraft > 0
        ? [
            {
              label: "Use fieldcraft to align one path tile",
              run: () => {
                let o = circuitLayout(s),
                  a = o.path.find((l) => t.tiles[l] !== o.solution[l]);
                (a !== void 0 && (t.tiles[a] = o.solution[a]),
                  save(),
                  openCircuit(r, "One useful tile is aligned. Other connections still need to form a complete path."));
              },
            },
          ]
        : []),
      ...(prefs.assisted || t.failures >= 3
        ? [
            {
              label: "Scanner-assisted repair",
              run: () => {
                ((t.tiles = circuitLayout(s).solution),
                  save(),
                  openCircuit(r, "Scanner assistance has restored a valid path. Check the output to file the operation."));
              },
            },
          ]
        : []),
    ],
    {
      eyebrow: "FIELD OPERATION / CIRCUIT ROUTING",
      focus: '[data-wire="0"]',
      footer: "Power travels only through matching ends. Not every tile needs power. Tile positions and failed checks are saved.",
    },
  )
    .querySelectorAll("[data-wire]")
    .forEach(
      (o) =>
        (o.onclick = () => {
          let a = Number(o.dataset.wire);
          ((t.tiles[a] = rotateTile(t.tiles[a])), audio.note(190 + a * 7, 0.07, 0.06), save(), openCircuit(r));
        }),
    );
}
function openTimeline(r, e = "Move each card up or down. Read the event notes before checking the order.") {
  let t = taskProgress(state, r);
  (t.order || (t.order = [2, 0, 3, 1]),
    openModal(
      r.label,
      `<p>${esc(r.text)}</p><div class="timeline-list">${t.order.map((i, n) => `<article class="timeline-card"><span class="timeline-number">0${n + 1}</span><div><h3>${esc(r.events[i][0])}</h3><p>${esc(r.events[i][1])}</p></div><div class="timeline-controls"><button data-order="${n}" data-shift="-1" aria-label="Move ${esc(r.events[i][0])} earlier" ${n === 0 ? "disabled" : ""}>\u2191</button><button data-order="${n}" data-shift="1" aria-label="Move ${esc(r.events[i][0])} later" ${n === 3 ? "disabled" : ""}>\u2193</button></div></article>`).join("")}</div><div class="hint-strip" id="timeline-feedback">${esc(e)}</div>`,
      [
        {
          label: "VERIFY THE SEQUENCE",
          primary: !0,
          run: () => {
            timelineSolved(t.order)
              ? recordTask(r, { xp: 15 }, r.result + " " + r.events.map((i) => i[0]).join(" \u2192 ") + ".")
              : (t.failures++,
                recordMistake(state, 4),
                save(),
                openTimeline(r, "That sequence conflicts with at least one event note. Check what happened before the command or the handover."));
          },
        },
        ...(prefs.assisted || t.failures >= 3
          ? [
              {
                label: "Arrange with recorder assistance",
                run: () => {
                  ((t.order = [0, 1, 2, 3]), save(), openTimeline(r, "The recorder has restored the order. Verify the sequence to record it."));
                },
              },
            ]
          : []),
      ],
      {
        eyebrow: "RECONSTRUCTION / CHRONOLOGY",
        focus: "[data-order]:not(:disabled)",
        footer: "The event notes contain the ordering clues. Arrow buttons work with touch and keyboard.",
      },
    )
      .querySelectorAll("[data-order]")
      .forEach(
        (i) =>
          (i.onclick = () => {
            let n = Number(i.dataset.order),
              o = n + Number(i.dataset.shift);
            (([t.order[n], t.order[o]] = [t.order[o], t.order[n]]), save(), openTimeline(r));
          }),
      ));
}
function openStealth(r, e = "Collect the key at K. Then reach OUT. Each move or wait advances both patrols.") {
  let t = taskProgress(state, r),
    s = patrolPositions(t.turn),
    i = openModal(
      r.label,
      `<p>${esc(r.text)}</p><div class="operation-meter"><span>ALARM ${t.alarm}%</span><div><i style="width:${t.alarm}%"></i></div><b>${t.key ? "KEY SECURED" : "KEY REQUIRED"}</b></div><div class="stealth-grid">${Array.from(
        { length: 35 },
        (a, l) => {
          let c = l % 7,
            h = Math.floor(l / 7),
            u = STEALTH_WALLS.some((y) => y[0] === c && y[1] === h),
            d = STEALTH_COVER.some((y) => y[0] === c && y[1] === h),
            p = s.some((y) => y.x === c && y.z === h),
            f = t.x === c && t.z === h,
            g = c === 3 && h === 2 && !t.key,
            m = c === 6 && h === 0;
          return `<button data-cell="${c},${h}" class="stealth-cell ${u ? "wall" : ""} ${d ? "cover" : ""} ${p ? "patrol" : ""} ${f ? "player" : ""} ${m ? "exit-cell" : ""}" aria-label="${f ? "Your position" : p ? "Patrol" : u ? "Wall" : d ? "Cover" : g ? "Key" : m ? "Exit" : "Floor"} at ${c + 1},${h + 1}">${f ? "V" : p ? "\u25C6" : u ? "\u25A4" : g ? "K" : m ? "OUT" : d ? "\u25A5" : "\xB7"}</button>`;
        },
      ).join(
        "",
      )}</div><div class="stealth-controls"><button data-step="0,-1" aria-label="Move up">\u2191</button><button data-step="-1,0" aria-label="Move left">\u2190</button><button data-step="0,0">WAIT</button><button data-step="1,0" aria-label="Move right">\u2192</button><button data-step="0,1" aria-label="Move down">\u2193</button></div><div class="hint-strip" id="stealth-feedback">${esc(e)}</div><p class="fine-print">Striped tiles give cover. Patrols see two cells along their row and one along their column. Cover blocks detection. Quiet moves reduce the alarm.</p>`,
      prefs.assisted
        ? [{ label: "Use the documented service route", run: () => recordTask(r, { xp: -10 }, r.result + " You used the assisted service route.") }]
        : [],
      {
        eyebrow: "FIELD OPERATION / PATROL TIMING",
        footer: "An alarm resets this operation, not the chapter. Move with the arrow keys, the stick or the direction buttons. WAIT is a full turn.",
        focus: '[data-step="0,0"]',
      },
    ),
    n = (a, l) => {
      let c = stealthMove(state, r, a, l);
      if (c.ok) {
        if ((save(), renderMeters(), c.won)) {
          recordTask(r, { xp: t.failures ? 5 : 20 }, r.result);
          return;
        }
        openStealth(
          r,
          c.failed
            ? "The alarm reached its limit. You withdrew to the entry. The case is intact. Try a different patrol phase."
            : c.seen
              ? "A patrol saw movement. Use cover or break its sight line."
              : t.key
                ? "Key secured. Reach OUT without filling the alarm meter."
                : "The patrols advance. Check their next position before you move.",
        );
      }
    };
  (i.querySelectorAll("[data-step]").forEach((a) => (a.onclick = () => n(...a.dataset.step.split(",").map(Number)))),
    i.querySelectorAll("[data-cell]").forEach(
      (a) =>
        (a.onclick = () => {
          let [l, c] = a.dataset.cell.split(",").map(Number);
          n(l - t.x, c - t.z);
        }),
    ));
  // Arrows, WASD, the D-pad or the stick step Vale through the grid while the grid or its controls have focus.
  modalDirection = (dx, dy) => {
    const f = document.activeElement;
    if (f && f !== document.body && !f.closest(".stealth-grid, .stealth-controls")) return !1;
    n(dx, dy);
    return !0;
  };
}
function empathyScript(r) {
  return r === 3
    ? [
        [
          "The old recording begins with someone asking permission. Ori looks at the second cup.",
          "Ori says the voice sounds familiar, but asks you not to turn familiarity into proof.",
        ],
        [
          "The recorder repeats a frame. Ori stops speaking until the sound settles.",
          "Ori remembers a journey from the east reservoir. He does not know why the reader contains it.",
        ],
        [
          "Your name appears on an undated repair note. Ori places the note face-up.",
          "Ori confirms that he repaired the reader. The work was requested, not hidden.",
        ],
        [
          "The recording ends before either person leaves the room.",
          "Ori agrees to preserve the recording as an incomplete account. The missing ending remains missing.",
        ],
      ]
    : [
        [
          "The volunteer checks the door before sitting down. The chart marks that delay as an anomaly.",
          "The volunteer says the last interview ended with a locked door. A delay now means caution, not guilt.",
        ],
        [
          "A question brings a fast pulse and a long silence.",
          "The question names a lost family member. The chart contains no field for grief.",
        ],
        [
          "The volunteer notices that the machine\u2019s expected response is already printed.",
          "The reference curve was selected before the interview. You record the timing of that selection.",
        ],
        [
          "Nemi places the consent form within the volunteer\u2019s reach.",
          "The volunteer permits the defect to be reported. Private recollections remain outside the case record.",
        ],
      ];
}
function openEmpathy(r, e = "The pressure meter shows this interview\u2019s conditions. It does not identify origin or honesty.") {
  let t = taskProgress(state, r),
    s = empathyScript(state.chapter);
  t.round >= 4 && (t.round = 0);
  let i = state.chapter === 3 ? "ori" : "nemi",
    n = openModal(
      r.label,
      `<div class="conversation-header">${portraitFrame(i)}<div><span class="micro">RESPONSE ${t.round + 1}/4</span><p>${esc(s[t.round][0])}</p></div></div><div class="response-monitor"><svg viewBox="0 0 600 85" aria-hidden="true"><path d="M0 43h600M0 15h600M0 71h600" stroke="#315159"/><path d="M0 43h65l9-5 8 11 7-6h66l7-12 7 25 9-54 9 70 7-29h81l10-9 12 18 8-9h65l8-15 7 29 10-63 10 77 8-28h101" fill="none" stroke="#80c9c3" stroke-width="2"/></svg><span>CONTEXT, NOT CLASSIFICATION</span></div><div class="operation-meter"><span>PRESSURE ${t.pressure}%</span><div><i style="width:${t.pressure}%"></i></div></div><p class="history-callout">${esc(e)}</p>`,
      [
        { label: "Listen. Give them time to answer.", run: () => o("listen") },
        { label: "Ask for one concrete detail.", run: () => o("clarify") },
        { label: "Press the contradiction now.", run: () => o("press") },
      ],
      {
        eyebrow: "RESPONSE INTERVIEW / CONSENT BEFORE CONCLUSION",
        footer: "Your interview skill reduces pressure. At high pressure the session stops and offers a break.",
      },
    );
  function o(a) {
    let l = s[t.round][1],
      c = interviewAnswer(state, r, a);
    if ((state.journal.push({ chapter: state.chapter, title: r.label + " / Response " + t.round, text: l }), save(), c.pressure >= 80)) {
      ((t.round = 0),
        (t.pressure = 24),
        t.failures++,
        recordMistake(state, 5),
        save(),
        openModal(
          "Give the witness a break.",
          `<p>The pressure is too high for a useful account. ${state.chapter === 3 ? "Ori" : "Nemi"} stops the recorder. Your earlier evidence remains safe.</p><p>A calmer approach will let the witness finish on their own terms.</p>`,
          [{ label: "RESUME WITH CONSENT", primary: !0, run: () => openEmpathy(r) }],
          { eyebrow: "INTERVIEW / RETRY", closeable: !0 },
        ));
      return;
    }
    c.finished ? recordTask(r, { trust: c.trust, xp: 10 }, r.result + " " + l) : openEmpathy(r, l);
  }
}
function openChase(r, e = prefs.assisted) {
  let t = taskProgress(state, r);
  t.distance >= 100 && (t.distance = 0);
  let s = openModal(
      r.label,
      `<p>${esc(r.text)}</p><canvas id="chase-canvas" width="640" height="330" aria-label="Three-lane crossing. Use left and right to avoid amber barriers."></canvas><div class="chase-controls"><button id="chase-left">\u2190 LEFT</button><button id="chase-pause">PAUSE</button><button id="chase-right">RIGHT \u2192</button></div><div class="operation-meter"><span id="chase-distance">0% CROSSED</span><div><i id="chase-progress"></i></div><b id="chase-hits">0/3 HITS</b></div><div id="chase-feedback" class="hint-strip">${e ? "Guided crossing is active. The service beacon chooses an open lane." : "Change lanes before a barrier reaches the white line. Three hits return you to a local checkpoint."}</div>`,
      e ? [] : [{ label: "Use guided crossing", run: () => openChase(r, !0) }],
      {
        eyebrow: "LIVE FIELD OPERATION / " + (state.chapter === 6 ? "CROWD ROUTE" : "SERVICE WALK"),
        focus: "#chase-pause",
        footer:
          "Left and right (arrows, stick or D-pad) also change lane. Closing the panel pauses and saves the crossing. Guided mode keeps the story available without a reaction test.",
      },
    ),
    i = byId("chase-canvas"),
    n = i.getContext("2d"),
    a = !1,
    c = Math.floor(t.distance / 8) + 1,
    h = 0,
    u = (m) => [(m * 7 + state.chapter) % 3, ...(m % 3 === 0 ? [(m * 7 + state.chapter + 1) % 3] : [])],
    d = (m) => 153 + m * 168,
    p = (m) => {
      ((t.lane = clamp(t.lane + m, 0, 2)), audio.note(200 + t.lane * 80, 0.05, 0.04));
    };
  ((byId("chase-left").onclick = () => p(-1)),
    (byId("chase-right").onclick = () => p(1)),
    (byId("chase-pause").onclick = () => {
      ((a = !a), (byId("chase-pause").textContent = a ? "RESUME" : "PAUSE"));
    }));
  // Runs from the game loop, so the kit's pause (and its settings panel) stops the crossing too.
  function g(y) {
    if (((y = Math.min(0.06, y)), !modalOpen || !i.isConnected)) return;
    if (
      !a &&
      ((t.distance = Math.min(100, t.distance + y * 6.5)),
      (h += y),
      h > 2 && (save(), (h = 0)),
      e && t.distance > c * 8 - 4 && (t.lane = [0, 1, 2].find((w) => !u(c).includes(w))),
      t.distance >= c * 8 &&
        (u(c).includes(t.lane) &&
          (t.hits++,
          audio.note(70, 0.13, 0.1),
          input.rumble(0.55, 160),
          (byId("chase-feedback").textContent = "You struck a barrier. Change lanes earlier.")),
        c++,
        t.hits >= 3 &&
          (t.failures++,
          recordMistake(state, 8),
          (t.distance = Math.max(0, t.distance - 24)),
          (t.hits = 0),
          (c = Math.floor(t.distance / 8) + 1),
          (byId("chase-feedback").textContent = "Local checkpoint restored. The parcel and earlier case evidence are safe."),
          save())),
      t.distance >= 100)
    ) {
      // Stop ticking first: the loop must not re-run the finish if the record is refused.
      (save(), (modalTick = null), recordTask(r, { xp: e ? 0 : 20 }, r.result + (e ? " You followed the guided service route." : "")));
      return;
    }
    ((n.fillStyle = "#112632"), n.fillRect(0, 0, 640, 330), (n.fillStyle = "#263e49"), n.fillRect(73, 0, 504, 330));
    for (let w = 0; w < 4; w++)
      ((n.strokeStyle = "#597581"),
        n.setLineDash(w === 0 || w === 3 ? [] : [16, 24]),
        (n.lineDashOffset = t.distance * 8),
        n.beginPath(),
        n.moveTo(69 + w * 168, 0),
        n.lineTo(69 + w * 168, 330),
        n.stroke());
    n.setLineDash([]);
    for (let w = Math.max(1, c); w <= Math.min(12, c + 4); w++) {
      let v = 263 - (w * 8 - t.distance) * 16;
      if (!(v < -24 || v > 330))
        for (let S of u(w)) {
          let M = d(S);
          ((n.fillStyle = "#d69d62"), n.fillRect(M - 58, v - 13, 116, 26), (n.fillStyle = "#614a40"));
          for (let N = -47; N < 50; N += 24)
            (n.beginPath(),
              n.moveTo(M + N, v - 13),
              n.lineTo(M + N + 10, v - 13),
              n.lineTo(M + N - 4, v + 13),
              n.lineTo(M + N - 14, v + 13),
              n.fill());
        }
    }
    ((n.strokeStyle = "#bbd9cc"), n.beginPath(), n.moveTo(74, 266), n.lineTo(574, 266), n.stroke());
    let x = d(t.lane);
    ((n.fillStyle = "#90d5cf"),
      n.fillRect(x - 12, 243, 24, 25),
      (n.fillStyle = "#d2b18a"),
      n.fillRect(x - 9, 228, 18, 17),
      (n.fillStyle = "#081b26"),
      n.fillRect(x - 10, 268, 7, 14),
      n.fillRect(x + 4, 268, 7, 14),
      (n.fillStyle = "#d9e3d5"),
      (n.font = "12px monospace"),
      (n.textAlign = "left"),
      n.fillText(e ? "BEACON / GUIDED" : "BEACON / MANUAL", 18, 23),
      n.fillText(a ? "PAUSED" : "KEEP AN OPEN LANE", 18, 313),
      (byId("chase-distance").textContent = Math.floor(t.distance) + "% CROSSED"),
      (byId("chase-progress").style.width = t.distance + "%"),
      (byId("chase-hits").textContent = t.hits + "/3 HITS"));
  }
  // Left and right (keys, stick, D-pad) change lane; up and down still move between the buttons.
  modalDirection = (dx) => (dx ? (p(dx), input.rumble(0.15, 40), !0) : !1);
  modalTick = g;
  modalCleanup = () => save();
  g(0);
}
function photoTarget(r) {
  return { x: 180 + (r.target % 3) * 200, y: 120 + Math.floor(r.target / 3) * 110 };
}
function drawPhoto(r, e, t) {
  let { zoom: s, panX: i, panY: n, filter: o } = t;
  (r.save(), (r.fillStyle = "#0c2431"), r.fillRect(0, 0, 720, 400), r.translate(360 + i, 200 + n), r.scale(s, s), r.translate(-360, -200));
  let a = o === "uv",
    l = a ? ["#1a2841", "#465680", "#7081af", "#b7a0d5"] : ["#233c48", "#57747d", "#95aaa6", "#c3b897"];
  ((r.fillStyle = l[0]), r.fillRect(0, 0, 720, 400));
  for (let h = 0; h < 7; h++) {
    let u = h * 107 - 20,
      d = 100 + ((h * 59 + state.chapter * 23) % 240);
    ((r.fillStyle = h % 2 ? l[1] : l[0]), r.fillRect(u, 390 - d, 90, d));
    for (let p = 420 - d; p < 385; p += 33)
      ((r.fillStyle = l[2]), (r.globalAlpha = 0.35), r.fillRect(u + 15, p, 14, 18), r.fillRect(u + 55, p, 14, 18));
  }
  ((r.globalAlpha = 1),
    (r.fillStyle = l[2]),
    r.fillRect(72, 64, 574, 310),
    (r.fillStyle = l[0]),
    r.fillRect(86, 78, 546, 278),
    (r.fillStyle = l[1]),
    r.fillRect(99, 92, 244, 247),
    r.fillRect(359, 92, 260, 247),
    (r.strokeStyle = l[2]));
  for (let h = 114; h < 340; h += 26) (r.beginPath(), r.moveTo(99, h), r.lineTo(619, h), r.stroke());
  ((r.fillStyle = l[3]),
    (r.globalAlpha = 0.3),
    r.beginPath(),
    r.moveTo(100, 334),
    r.lineTo(296, 92),
    r.lineTo(341, 92),
    r.lineTo(145, 334),
    r.fill(),
    (r.globalAlpha = 1));
  let c = photoTarget(e);
  (r.save(),
    r.translate(c.x, c.y),
    (r.strokeStyle = a ? "#d4c0ff" : "#e9ccb1"),
    (r.fillStyle = a ? "#b99cff" : "#d3bf9e"),
    (r.lineWidth = 1.5),
    e.clue === "circle"
      ? ((r.globalAlpha = a ? 0.95 : 0.11), r.beginPath(), r.arc(0, 0, 10, 0, Math.PI * 2), r.stroke(), r.fillRect(-15, 17, 30, 2))
      : ((r.globalAlpha = a ? 1 : 0.52),
        r.beginPath(),
        r.moveTo(0, 0),
        r.lineTo(-15, -9),
        r.lineTo(-12, 9),
        r.closePath(),
        r.fill(),
        r.beginPath(),
        r.moveTo(0, 0),
        r.lineTo(15, -9),
        r.lineTo(12, 9),
        r.closePath(),
        r.fill(),
        r.fillRect(-1, -11, 2, 24)),
    r.restore(),
    r.restore(),
    (r.strokeStyle = "#84adba"),
    r.strokeRect(1, 1, 718, 398),
    (r.fillStyle = "#d8d9bd"),
    (r.font = "11px monospace"),
    r.fillText(`FRAME ${state.chapter + 1} / ${o.toUpperCase()} / ${s.toFixed(1)}\xD7`, 14, 22));
}
function openPhoto(r) {
  let e = taskProgress(state, r),
    t = { zoom: 1, panX: 0, panY: 0, filter: "visible" },
    s = openModal(
      r.label,
      `<p>${esc(r.text.replace(/Select the tile with the moth\./g, "Inspect the reflected object."))}</p><div class="photo-workbench"><canvas id="photo-canvas" width="720" height="400" tabindex="0" aria-label="Evidence photograph. Zoom in and inspect the moth or open circle in the window."></canvas><div class="photo-crosshair" aria-hidden="true">+</div></div><div class="photo-tool-row"><label>ZOOM <input id="photo-zoom" type="range" min="1" max="3" value="1" step="0.1"><output id="photo-scale">1.0\xD7</output></label><button id="photo-filter" class="small-button">UV LIGHT: OFF</button><button id="photo-reset" class="small-button">RESET VIEW</button></div><div id="photo-feedback" class="hint-strip">Zoom to at least 1.6\xD7. Drag to inspect the frame. Tap the ${r.clue === "circle" ? "open circle under UV light" : "moth in the reflected window"}.</div>`,
      prefs.assisted || e.failures >= 3
        ? [
            {
              label: "Recover with image assistance",
              run: () =>
                recordTask(
                  r,
                  { xp: -8 },
                  "Image assistance recovered the detail. " + (r.reward ? ITEMS[r.reward][1] : "The hidden mark is recorded."),
                ),
            },
          ]
        : [],
      {
        eyebrow: "IMAGE RECONSTRUCTION / OPTICAL VIEW",
        footer:
          "The image is an original procedural evidence illustration. It is not a frame from the film. With the photograph selected, arrows or the stick pan the view and E, Enter or A records the detail under the crosshair.",
        focus: "#photo-canvas",
      },
    ),
    i = byId("photo-canvas"),
    n = i.getContext("2d"),
    o = () => drawPhoto(n, r, t);
  (o(),
    (byId("photo-zoom").oninput = (l) => {
      ((t.zoom = Number(l.target.value)), (byId("photo-scale").textContent = t.zoom.toFixed(1) + "\xD7"), o());
    }),
    (byId("photo-filter").onclick = () => {
      ((t.filter = t.filter === "uv" ? "visible" : "uv"),
        (byId("photo-filter").textContent = "UV LIGHT: " + (t.filter === "uv" ? "ON" : "OFF")),
        o());
    }),
    (byId("photo-reset").onclick = () => {
      ((t.zoom = 1), (t.panX = 0), (t.panY = 0), (byId("photo-zoom").value = 1), (byId("photo-scale").textContent = "1.0\xD7"), o());
    }));
  let a = null;
  // Keyboard and controller: pan with the directions, record what sits under the centre crosshair.
  ((modalDirection = (dx, dy) => {
    if (document.activeElement !== i) return !1;
    ((t.panX = clamp(t.panX - dx * 45, -600, 600)), (t.panY = clamp(t.panY - dy * 45, -350, 350)), o());
    return !0;
  }),
    (modalConfirm = () => (document.activeElement === i ? (inspectAt(360 - t.panX / t.zoom, 200 - t.panY / t.zoom), !0) : !1)));
  function inspectAt(u, d) {
    let p = photoTarget(r);
    if (t.zoom < 1.6) {
      byId("photo-feedback").textContent = "Increase the zoom to at least 1.6\xD7 before recording a detail.";
      return;
    }
    if (r.clue === "circle" && t.filter !== "uv") {
      byId("photo-feedback").textContent = "The missing mark needs UV light.";
      return;
    }
    if (Math.hypot(u - p.x, d - p.y) < 27 + state.skills.analysis * 7)
      recordTask(
        r,
        { xp: 10 },
        "The image detail is recovered without filling any missing area. " + (r.reward ? ITEMS[r.reward][1] : "You record the hidden mark and its location."),
      );
    else if (
      (e.failures++,
      recordMistake(state, 3),
      save(),
      renderMeters(),
      (byId("photo-feedback").textContent = "That is background detail. Look inside the window frame. Pan the view to inspect its edges."),
      e.failures >= 3 && !byId("photo-help"))
    ) {
      let f = document.createElement("button");
      ((f.id = "photo-help"),
        (f.className = "small-button"),
        (f.textContent = "Use image assistance"),
        (f.onclick = () => recordTask(r, { xp: -8 }, "The image aid recovers the hidden detail. " + (r.reward ? ITEMS[r.reward][1] : ""))),
        byId("photo-feedback").after(f));
    }
  }
  ((i.onpointerdown = (l) => {
    (i.setPointerCapture(l.pointerId), (a = { x: l.clientX, y: l.clientY, px: t.panX, py: t.panY, moved: !1 }));
  }),
    (i.onpointermove = (l) => {
      if (!a) return;
      let c = i.getBoundingClientRect();
      (Math.hypot(l.clientX - a.x, l.clientY - a.y) > 7 && (a.moved = !0),
        a.moved &&
          ((t.panX = clamp(a.px + ((l.clientX - a.x) * 720) / c.width, -600, 600)),
          (t.panY = clamp(a.py + ((l.clientY - a.y) * 400) / c.height, -350, 350)),
          o()));
    }),
    (i.onpointerup = (l) => {
      if (!a) return;
      let c = a;
      if (((a = null), c.moved)) return;
      let h = i.getBoundingClientRect();
      inspectAt((((l.clientX - h.left) * 720) / h.width - 360 - t.panX) / t.zoom + 360, (((l.clientY - h.top) * 400) / h.height - 200 - t.panY) / t.zoom + 200);
    }),
    (i.onpointercancel = () => (a = null)));
}
function openEnding() {
  let r = endingFor(state);
  save();
  let e = Object.entries(THREADS).filter(([i]) => (state.threads[i] || []).length === 3),
    t = e.length
      ? e.map(([, i]) => `<article class="ending-thread"><h3>${esc(i.name)}</h3><p>${esc(i.ending)}</p></article>`).join("")
      : '<p class="fine-print">The unresolved side stories remain in your notes. The city has more lives than one case can hold.</p>',
    s = openModal(
      r.title,
      `${sceneArt(11)}<div class="narrative">${r.lines.map(esc).join("<br><br>")}</div><div class="end-stats"><div><strong>${CASES.length} / ${CASES.length}</strong><small>CASES RESOLVED</small></div><div><strong>${state.visited.length} / ${CASES.reduce((n, c) => n + c.rooms.length, 0)}</strong><small>AREAS VISITED</small></div><div><strong>${e.length} / 4</strong><small>SIDE STORIES COMPLETE</small></div></div><p class="scene-return">${state.life.seen.length} ordinary things noticed. ${state.life.changed.length} small changes left behind. The city will keep them after the case closes.</p><h3>The opening district after your visit</h3>${districtEnding()}<h3>The people after the case</h3>${t}<div class="micro"><span>${state.stats.observations} FORENSIC OBSERVATIONS</span><span>${state.stats.topics} INTERVIEW TOPICS</span></div><p class="fine-print">${state.deductions.length}/12 supported theories. ${state.sides.length}/36 optional records. ${state.xp} XP. ${state.failures} world recoveries.<br>The case route is fixed. The record of your decisions is not.</p>`,
      [
        { label: "REPLAY AN EXPANDED CASE", primary: !0, run: () => openCasebook("cases") },
        { label: "Export this night", run: exportSave },
        {
          label: "Start a new night",
          run: () => {
            ((savedGame = null), dismissModal(), beginNight(!1));
          },
        },
      ],
      { wide: !0, closeable: !1, eyebrow: "RAIN CHECK / LIVING CITY / NIGHT COMPLETE" },
    );
}
function showCaption(r, e, t = 8) {
  !prefs.captions ||
    modalOpen ||
    !playing ||
    ((byId("life-caption-name").textContent = r),
    (byId("life-caption-text").textContent = e),
    byId("life-caption").classList.add("show"),
    (captionUntil = worldTime + t));
}
function syncLife() {
  (view.setLifeState(state.life.changed, roomResolved(state, state.room, CASES)),
    (view.districtFinished = new Set(
      Object.entries(state.district.quests)
        .filter(([, r]) => r.stage === 4)
        .map(([r]) => r),
    )),
    (view.hasPin = state.district.keepsakes.includes("bird-pin")),
    (view.hasCandle = state.district.keepsakes.includes("candle")),
    byId("look-count") && (byId("look-count").textContent = world.details.filter((r) => state.life.seen.includes(r.id)).length + "/3"));
}
function arriveInRoom() {
  let r = world.lifeSpec,
    e = countArrival(state, r.id);
  if (((roomEnteredAt = worldTime), (nextActorLineAt = worldTime + 23), (lastActorLine = -1), (queuedCaption = null), byId("life-caption")?.classList.remove("show"), syncLife(), audio?.setRoom(world), playing)) {
    let t = echoesFor(state, r.id);
    arrivalLine = t.length
      ? t[0]
      : e > 1 && roomResolved(state, state.room, CASES)
        ? r.resolved
        : e > 1 && state.life.changed.includes(r.details[0].id)
          ? r.details[0].after
          : r.arrival;
  }
}
function updateLife(r) {
  if (!playing || state.ended || modalOpen) return;
  (arrivalLine && worldTime - roomEnteredAt > 0.8 && (showCaption(world.title, arrivalLine, 10), (arrivalLine = null)),
    worldTime > captionUntil && byId("life-caption").classList.remove("show"),
    queuedCaption && worldTime >= queuedCaption.at && (showCaption(queuedCaption.who, queuedCaption.text, 8), (queuedCaption = null)));
  let e = world.lifeSpec;
  if (
    (prefs.captions &&
      !quietView &&
      !state.life.heard.includes(e.id) &&
      !hero.moving &&
      worldTime - roomEnteredAt > 15 &&
      worldTime > captionUntil + 2 &&
      (markHeard(state, e.id), showCaption(e.event[0], e.event[1], 7.5), (queuedCaption = { at: worldTime + 8, who: e.event[2], text: e.event[3] }), save(), (nextActorLineAt = worldTime + 40)),
    prefs.captions && !quietView && worldTime > nextActorLineAt && worldTime > captionUntil + 5 && !queuedCaption)
  ) {
    let t = world.lifeActors.slice(0, 2),
      s = -1,
      i = 5;
    if (
      (t.forEach((n, o) => {
        let a = actorPose(n, worldTime, hero, prefs.reduced),
          l = Math.hypot(hero.x - a.x, hero.z - a.z);
        l < i && o !== lastActorLine && ((i = l), (s = o));
      }),
      s >= 0)
    ) {
      let n = t[s];
      (showCaption(n.name, n.line, 8), (lastActorLine = s), (nextActorLineAt = worldTime + 38));
    } else nextActorLineAt = worldTime + 8;
  }
  audio.step(worldTime, hero.moving, world.lifeSpec.floor);
}
function openLook() {
  if (!playing) {
    openAbout();
    return;
  }
  let r = world.lifeSpec,
    e = echoesFor(state, r.id),
    t = state.life.changed.includes(r.details[0].id),
    s = `<div class="scene-senses">${esc(r.senses)}</div><p class="scene-arrival">${esc(r.arrival)}</p>${roomResolved(state, state.room, CASES) ? `<p class="scene-return">${esc(r.resolved)}</p>` : ""}${t ? `<p class="scene-return">${esc(r.details[0].after || r.details[0].result)}</p>` : ""}${e.map((n) => `<p class="city-echo">${esc(n)}</p>`).join("")}<div class="micro scene-section"><span>LOOK CLOSER</span><span>NO EVIDENCE REQUIRED</span></div><div class="detail-list">${world.details.map((n, o) => `<button class="detail-row" data-walk-detail="${n.id}"><span class="detail-index">${String(o + 1).padStart(2, "0")}</span><span><strong>${esc(n.title)}</strong><small>${state.life.changed.includes(n.id) ? "CHANGED \xB7 REMEMBERED" : state.life.seen.includes(n.id) ? "OBSERVED" : n.action ? "SMALL ACTION AVAILABLE" : "SOMETHING TO NOTICE"}</small></span><span>\u2197</span></button>`).join("")}</div><div class="scene-residents">${r.residents.map((n) => `<div><b>${esc(n.name)}</b><span>${esc(n.role)}</span></div>`).join("")}</div><p class="fine-print">Select a detail to walk to it. These observations do not spend focus, grant experience, or block the case.</p>`;
  openModal(
    r.name,
    s,
    [
      { label: "LISTEN TO THIS PLACE", primary: !0, run: openMoment },
      ...(state.chapter === 0 ? [{ label: "Meet the neighborhood", run: () => openDistrict("people") }] : []),
      { label: "Read your street notes", run: openStreetNotes },
      {
        label: "VIEW WITHOUT THE INTERFACE",
        run: () => {
          (dismissModal(), toggleQuietView());
        },
      },
    ],
    { eyebrow: `THE LIVING CITY / ${String(state.chapter + 1).padStart(2, "0")}.${state.room + 1}`, wide: !0 },
  )
    .querySelectorAll("[data-walk-detail]")
    .forEach(
      (n) =>
        (n.onclick = () => {
          let o = targets.find((a) => a.id === n.dataset.walkDetail);
          (dismissModal(), goTo(o));
        }),
    );
}
function openMoment() {
  let r = world.lifeSpec;
  (markHeard(state, r.id),
    save(),
    openModal(
      "A moment here",
      `<div class="scene-senses">${esc(r.senses)}</div><div class="overheard"><article><small>${esc(r.event[0])}</small><p>${esc(r.event[1])}</p></article><article><small>${esc(r.event[2])}</small><p>${esc(r.event[3])}</p></article></div><p class="fine-print">The exchange is kept in Street notes. There is no timer or reward to collect.</p>`,
      [
        { label: "BACK TO THE PLACE", primary: !0, run: openLook },
        { label: "Return to the world", run: dismissModal },
      ],
      { eyebrow: "OVERHEARD / " + r.name },
    ));
}
function drawDetail(r, e) {
  let t = r.getContext("2d"),
    s = world.details.find((x) => x.id === e);
  if (!s) return;
  let i = view.livingGeometry(worldTime, hero).filter((x) => x.detailId === e && !x.hidden),
    n = r.width,
    o = r.height;
  ((t.fillStyle = "#0b202a"), t.fillRect(0, 0, n, o), (t.strokeStyle = "#537c791c"), (t.lineWidth = 1));
  for (let x = 0; x < n; x += 40) (t.beginPath(), t.moveTo(x, 0), t.lineTo(x, o), t.stroke());
  for (let x = 0; x < o; x += 40) (t.beginPath(), t.moveTo(0, x), t.lineTo(n, x), t.stroke());
  let a = i.flatMap((x) => primitiveFaces(x)).sort((x, w) => x.depth - w.depth),
    l = (x) => [(x[0] - x[2]) * 0.707, (x[0] + x[2]) * 0.455 - x[1] * 0.765],
    c = a.flatMap((x) => x.verts.map(l)),
    h = c.map((x) => x[0]),
    u = c.map((x) => x[1]),
    d = Math.min(...h),
    p = Math.max(...h),
    f = Math.min(...u),
    g = Math.max(...u),
    m = Math.min((n - 140) / Math.max(0.2, p - d), (o - 90) / Math.max(0.2, g - f)),
    y = (x) => {
      let w = l(x);
      return [n * 0.5 + (w[0] - (d + p) / 2) * m, o * 0.51 + (w[1] - (f + g) / 2) * m];
    };
  ((t.fillStyle = "#010e1770"), t.beginPath(), t.ellipse(n * 0.5, o - 55, Math.min(180, m * 0.65), 14, 0, 0, Math.PI * 2), t.fill());
  for (let x of a)
    ((t.globalAlpha = x.alpha ?? 1),
      (t.fillStyle = x.color),
      t.beginPath(),
      x.verts.forEach((w, v) => {
        let S = y(w);
        v ? t.lineTo(...S) : t.moveTo(...S);
      }),
      t.closePath(),
      t.fill());
  ((t.globalAlpha = 1),
    (t.font = "13px monospace"),
    (t.fillStyle = "#a3b8b3"),
    t.fillText("OBJECT STUDY / " + s.prop.toUpperCase(), 20, 27),
    t.fillText(state.life.changed.includes(e) ? "STATE / CHANGED" : "STATE / AS FOUND", 20, o - 18));
}
function openDetail(r, e = !1) {
  (markSeen(state, r.id), syncLife(), save());
  let t = state.life.changed.includes(r.id),
    s = openModal(
      r.title,
      `<canvas id="detail-view" width="820" height="340" aria-label="Close view of ${esc(r.title)}"></canvas><div class="detail-status">${t ? "A CHANGE THAT STAYS" : "AN ORDINARY THING / NOT CASE EVIDENCE"}</div><div class="narrative">${esc(t ? r.after || r.result : r.text)}</div>${e ? `<p class="city-echo">${esc(r.result)}</p>` : ""}<p class="fine-print">This observation is kept in Street notes. The object stays here.</p>`,
      [
        ...(r.action && !t
          ? [
              {
                label: r.action.toUpperCase(),
                primary: !0,
                run: () => {
                  markChanged(state, r.id) && (syncLife(), audio.smallChange(r.prop), save(), openDetail(r, !0));
                },
              },
            ]
          : []),
        { label: "BACK TO THE WORLD", primary: !r.action || t, run: dismissModal },
        { label: "Look around this area", run: openLook },
      ],
      { eyebrow: "A CLOSER LOOK / " + world.title },
    );
  drawDetail(byId("detail-view"), r.id);
}
function openStreetNotes() {
  let r = LIFE_PLACES.flat().filter((t) => t.details.some((s) => state.life.seen.includes(s.id)) || state.life.heard.includes(t.id)),
    e = openModal(
      "Street notes",
      `<div class="street-totals"><span>${state.life.seen.length} observations</span><span>${state.life.changed.length} small changes</span><span>${state.life.heard.length} local exchanges</span></div><p class="fine-print">These notes are separate from the case evidence. Nothing here is required for the ending.</p>${
        r.length
          ? r
              .map(
                (t) =>
                  `<section class="street-place"><h3>${String(t.chapter + 1).padStart(2, "0")} / ${esc(t.name)}</h3>${t.details
                    .filter((s) => state.life.seen.includes(s.id))
                    .map(
                      (s) =>
                        `<article><h4>${esc(s.title)}${state.life.changed.includes(s.id) ? " <span>CHANGED</span>" : ""}</h4><p>${esc(s.text)}</p>${state.life.changed.includes(s.id) ? `<p class="scene-return">${esc(s.result)}</p>` : ""}</article>`,
                    )
                    .join(
                      "",
                    )}${state.life.heard.includes(t.id) ? `<div class="overheard"><small>${esc(t.event[0])}</small><p>${esc(t.event[1])}</p><small>${esc(t.event[2])}</small><p>${esc(t.event[3])}</p></div>` : ""}</section>`,
              )
              .join("")
          : "<p>The city has not asked you to notice it. Use LOOK to start.</p>"
      }`,
      [{ label: "BACK TO THIS AREA", primary: !0, run: openLook }],
      { wide: !0, eyebrow: "VALE / THINGS THAT ARE NOT EVIDENCE" },
    );
}
function toggleQuietView() {
  !playing ||
    modalOpen ||
    ((quietView = !quietView),
    document.body.classList.toggle("quiet-view", quietView),
    byId("quiet-controls").classList.toggle("hidden", !quietView),
    (byId("quiet-location").textContent = world.title + " / " + CASES[state.chapter].time),
    (byId("quiet-zoom").value = String(view.zoom)),
    kit.touch?.suspend(quietView, "quiet"),
    quietView && ((heroPath = []), (walkTarget = null), (hero.target = null), (hero.moving = !1)));
}
function districtTabs(r) {
  return `<div class="district-tabs">${[
    ["places", "PLACES"],
    ["people", "PEOPLE"],
    ["quests", "LOCAL QUESTS"],
    ["lore", "CITY NOTES"],
  ]
    .map(([e, t]) => `<button class="${r === e ? "active" : ""}" data-district-tab="${e}">${t}</button>`)
    .join("")}</div>`;
}
function placeName(r) {
  return r === 0 ? "Night kitchen / central street" : CASES[0].rooms[r].name;
}
function walkToPlace(r, e = null) {
  if (state.chapter !== 0) {
    toast("The opening district is closed for this night. Your records remain.");
    return;
  }
  if ((dismissModal(), r === state.room)) {
    e && goTo(targets.find((s) => s.id === e));
    return;
  }
  if (e) {
    goTo({ id: e, room: r, ready: !0 });
    return;
  }
  afterDoor = { id: "district-arrive", room: r };
  let t = targets.find((s) => s.kind === "door" && s.destination === r) || targets.find((s) => s.kind === "door" && s.destination === 0);
  t && goTo(t);
}
function openDistrict(r = "places", e = "local") {
  if (!playing) return;
  let t = districtTotals(state),
    s = state.chapter === 0,
    i = "";
  if (
    (r === "places" &&
      (i = `<div class="district-atlas"><svg viewBox="0 0 680 420" role="img" aria-label="Opening district map. The central street connects all twelve shops."><defs><pattern id="district-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#375153" stroke-width=".5"/></pattern></defs><rect width="680" height="420" fill="#122b35"/><rect width="680" height="420" fill="url(#district-grid)"/><path d="M102 86H578V340H102ZM205 170H475V276H205" stroke="#547771" stroke-width="16" fill="none"/><text x="340" y="46" text-anchor="middle" fill="#ccbea1" font-family="monospace" font-size="13" letter-spacing="3">LOWER RAINWARD / AFTER HOURS</text>${SHOPS
        .map((o) => {
          let a = 340 + o.door[0] * 8.1,
            l = 225 + o.door[1] * 4.9;
          return `<g class="atlas-stop" data-atlas-room="${o.room}" tabindex="0" role="button" aria-label="Walk to ${esc(o.name)}"><rect x="${a - 55}" y="${l - 19}" width="110" height="38" rx="3" fill="${state.room === o.room ? "#537c70" : "#28424b"}" stroke="${o.color}"/><text x="${a}" y="${l - 2}" fill="${o.color}" text-anchor="middle" font-family="monospace" font-size="9">${o.short}</text><text x="${a}" y="${l + 12}" fill="#b7c8c0" text-anchor="middle" font-family="monospace" font-size="8">${state.visited.includes("0:" + o.room) ? "VISITED" : "OPEN"}</text></g>`;
        })
        .join(
          "",
        )}<g data-atlas-room="0" class="atlas-stop" role="button" tabindex="0" aria-label="Walk to the Night kitchen"><rect x="264" y="187" width="152" height="68" rx="3" fill="#564d3d" stroke="#d2aa70"/><text x="340" y="212" text-anchor="middle" fill="#e4c187" font-family="monospace" font-size="13">NIGHT KITCHEN</text><text x="340" y="235" text-anchor="middle" fill="#c8d0bd" font-family="monospace" font-size="10">CENTRAL STREET</text></g></svg></div><p class="fine-print">Select a place to walk to its door. Shop interiors connect through the central street. The main case stays on its gold route.</p><div class="district-place-grid">${CASES[0].rooms.map((o, a) => `<button data-district-room="${a}" data-room="${a}" class="district-place ${state.room === a && s ? "current" : ""}"><small>${String(a + 1).padStart(2, "0")} / ${state.visited.includes("0:" + a) ? "VISITED" : "DISCOVER"}</small><h3>${esc(o.name)}</h3><p>${esc(o.description)}</p><span>${residentsInRoom(a).length} named residents ${state.room === a && s ? "\xB7 YOU ARE HERE" : "\u2197"}</span></button>`).join("")}</div>`),
    r === "people")
  ) {
    let o = e === "all" || !s ? RESIDENTS : RESIDENTS.filter((a) => a.room === state.room);
    i = `<div class="district-filter"><button data-people-filter="local" class="${e === "local" ? "active" : ""}">IN THIS AREA</button><button data-people-filter="all" class="${e === "all" ? "active" : ""}">ALL ${RESIDENTS.length} RESIDENTS</button><span>${t.met} met / ${RESIDENTS.length}</span></div><div class="resident-grid">${o
      .map((a) => {
        let l = state.district.met.includes(a.id);
        return `<button class="resident-card ${l ? "known" : ""}" data-person-record="${a.id}"><div class="resident-thumb">${portrait(a.id, l ? "warm" : "neutral")}</div><div><small>${esc(a.group.toUpperCase())}</small><h3>${esc(a.name)}</h3><p>${esc(a.role)}</p><span>${esc(placeName(a.room))}</span><em>${l ? (state.district.topics[a.id]?.length || 0) + "/3 topics heard" : "MEET THIS RESIDENT"} \u2197</em></div></button>`;
      })
      .join("")}</div>`;
  }
  if (
    (r === "quests" &&
      (i = `<p class="fine-print">These local stories do not unlock or replace a case lead. Witness accounts, field work, and final choices remain saved. Leaving the opening district closes unfinished local work.</p><div class="reputation-strip">${Object.entries(
        state.district.reputation,
      )
        .map(([o, a]) => `<span>${o.toUpperCase()} <b>${a}</b></span>`)
        .join("")}</div><div class="district-quests">${LOCAL_QUESTS
        .map((o, a) => {
          let l = state.district.quests[o.id];
          return `<button class="quest-card ${l?.stage === 4 ? "complete" : ""}" data-quest-record="${o.id}"><div class="micro"><span>LOCAL ${String(a + 1).padStart(2, "0")}</span><span>${esc(questStatusLabel(o, l))}</span></div><h3>${esc(o.title)}</h3><p>${esc(o.intro)}</p><div class="quest-pips">${[1, 2, 3, 4].map((c) => `<i class="${l?.stage >= c ? "on" : ""}"></i>`).join("")}<span>${l?.stage === 4 ? "RESOLVED" : l ? "IN PROGRESS" : "OPTIONAL"}</span></div></button>`;
        })
        .join("")}</div>`),
    r === "lore")
  ) {
    let o = CITY_LORE.filter((a) => state.district.lore.includes(a.id));
    i = `<p class="fine-print">These records describe Rainward\u2019s fictional institutions and daily life. Read notices and speak with residents to build your own account.</p><div class="city-note-grid">${o.length ? o.map((a) => `<article class="city-note"><small>${esc(placeName(a.room))}</small><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></article>`).join("") : "<p>Look for paper-notice markers. The people at the counter also have stories to tell.</p>"}</div>${
      state.district.keepsakes.length
        ? `<h3>Things you chose to keep</h3><div class="keepsake-row">${state.district.keepsakes
            .map((a) => {
              let l = Object.values(LOCAL_GOODS).find((c) => c.keepsake === a);
              return `<article><b>${esc(l?.name || a)}</b><p>${esc(l?.lore || l?.description || "")}</p></article>`;
            })
            .join(
              "",
            )}</div>${state.district.keepsakes.includes("vale-print") ? `<div class="personal-print">${portrait("vale", "neutral", !0, state.district.keepsakes.includes("bird-pin"))}<p>Unretouched. One copy belongs to Vale.</p></div>` : ""}`
        : ""
    }<h3>Conversations you heard</h3>${RESIDENTS
      .filter((a) => (state.district.topics[a.id] || []).length)
      .map(
        (a) =>
          `<details class="conversation-record"><summary>${esc(a.name)} / ${esc(a.role)}</summary>${state.district.topics[a.id].map((l) => `<h4>${esc(a.topics[l].label)}</h4><p>${esc(a.topics[l].text)}</p>`).join("")}</details>`,
      )
      .join("")}`;
  }
  let n = openModal(
    DISTRICT_NAME,
    `<div class="district-summary"><span>${CASES[0].rooms.length} OPENING AREAS</span><span>${t.met}/${RESIDENTS.length} PEOPLE MET</span><span>${t.quests}/${LOCAL_QUESTS.length} LOCAL STORIES</span></div>${s ? "" : '<div class="hint-strip">The opening district is closed. Its people and outcomes remain in your record.</div>'}${districtTabs(r)}${i}`,
    [],
    { wide: !0, className: "district-dialog", eyebrow: "LOWER RAINWARD / THE NEIGHBORHOOD" },
  );
  (n.querySelectorAll("[data-district-tab]").forEach((o) => (o.onclick = () => openDistrict(o.dataset.districtTab))),
    n.querySelectorAll("[data-district-room]").forEach((o) => (o.onclick = () => walkToPlace(Number(o.dataset.districtRoom)))),
    n.querySelectorAll("[data-atlas-room]").forEach((o) => {
      let a = () => walkToPlace(Number(o.dataset.atlasRoom));
      ((o.onclick = a),
        (o.onkeydown = (l) => {
          (l.key === "Enter" || l.key === " ") && (l.preventDefault(), a());
        }));
    }),
    n.querySelectorAll("[data-people-filter]").forEach((o) => (o.onclick = () => openDistrict("people", o.dataset.peopleFilter))),
    n.querySelectorAll("[data-person-record]").forEach((o) => (o.onclick = () => openResidentRecord(o.dataset.personRecord))),
    n.querySelectorAll("[data-quest-record]").forEach((o) => (o.onclick = () => openQuest(o.dataset.questRecord))));
}
function openResidentRecord(r) {
  let e = RESIDENT_BY_ID[r],
    t = state.district.met.includes(r);
  openModal(
    e.name,
    `<div class="resident-record">${portrait(r, t ? "warm" : "neutral")}<div><small>${esc(e.role.toUpperCase())}</small><p>${esc(t ? e.bio : "You have not spoken with this resident yet.")}</p><h3>${t ? "What matters to them" : "Where to find them"}</h3><p>${esc(t ? e.want : placeName(e.room))}</p>${t ? `<p class="connection-note">${esc(e.tie)}</p>` : ""}</div></div>`,
    [
      ...(state.chapter === 0 ? [{ label: "WALK TO " + e.name.toUpperCase(), primary: !0, run: () => walkToPlace(e.room, "resident-" + r) }] : []),
      { label: "Back to the people", run: () => openDistrict("people", "all") },
    ],
    { wide: !0, className: "district-dialog", eyebrow: "A RESIDENT / NOT A CASE NUMBER" },
  );
}
function openResident(r, e = -1, t = "", s = "neutral") {
  let i = RESIDENT_BY_ID[r];
  if (!i) return;
  (meetResident(state, r), e >= 0 && hearResidentTopic(state, r, e));
  let n = LOCAL_QUESTS.filter((d) => d.giver === r || d.witnesses.includes(r)),
    o = n.find((d) => state.district.quests[d.id]?.stage === 4),
    a = t || (e >= 0 ? i.topics[e].text : o ? o.outcomes[state.district.quests[o.id].choice][2] : i.bio);
  o && e < 0 && !t && (s = "warm");
  let l = [];
  for (let d of n) {
    let p = state.district.quests[d.id];
    (d.giver === r && !p && l.push({ label: "LOCAL STORY / " + d.title, run: () => offerQuest(d.id) }),
      p?.stage === 1 &&
        d.witnesses.includes(r) &&
        !p.witnesses.includes(r) &&
        l.push({
          label: "Ask about " + d.title,
          primary: !0,
          run: () => {
            (hearWitness(state, d.id, r), (state.district.tracked = d.id), save(), renderTracker(), openResident(r, -1, d.testimony[r], "concerned"));
          },
        }),
      p?.stage === 3 && d.giver === r && l.push({ label: "RESOLVE / " + d.title, primary: !0, run: () => openQuestResolution(d.id) }),
      p && p.stage < 3 && d.giver === r && l.push({ label: "Review " + d.title, run: () => openQuest(d.id) }));
  }
  let c = SHOPS.find((d) => d.room === i.room),
    h = residentsInRoom(i.room)[0]?.id === r;
  if (
    (((c && h) || r === "mara") && l.push({ label: "Browse the counter", run: () => openCounter(r) }),
    r === "tess" && hasPerk(state, "transit") && l.push({ label: "USE THE LOCAL SERVICE", run: openTransit }),
    r === "mara")
  ) {
    let d = caseTasks.find((p) => p.id === "mara");
    d &&
      !d.done &&
      l.push({
        label: "MAIN CASE / Ask about the missing courier",
        run: () => {
          (dismissModal(), openTarget(d));
        },
      });
  }
  (l.push({ label: "Return to the street", run: dismissModal }),
    openModal(
      i.name,
      `<div class="rpg-conversation"><figure class="rpg-portrait" data-portrait-person="${r}" data-expression="${s}">${portrait(r, s)}<figcaption>${esc(i.role)}<small>${esc(i.group.toUpperCase())} / CONNECTION ${state.district.relationships[r] || 0}</small></figcaption></figure><div class="rpg-speech"><div class="rpg-scene-line">${esc(world.lifeSpec.senses)}</div><p class="rpg-text">${esc(a)}</p><div class="rpg-topics">${i.topics.map((d, p) => `<button data-resident-topic="${p}" class="${state.district.topics[r].includes(p) ? "heard" : ""} ${p === e ? "active" : ""}"><span>${state.district.topics[r].includes(p) ? "\u2713" : "+"}</span>${esc(d.label)}</button>`).join("")}</div><p class="connection-note">${esc(i.tie)}</p><div class="rpg-listener">${portrait("vale", "neutral", !0, state.district.keepsakes.includes("bird-pin"))}<div><small>INSPECTOR VALE</small><span>${e >= 0 ? "Keep the person\u2019s words. Do not fill the gaps." : "There is time to listen before there is a conclusion."}</span></div></div></div></div>`,
      l,
      { wide: !0, className: "district-dialog conversation-dialog", eyebrow: "IN PERSON / " + placeName(i.room) },
    )
      .querySelectorAll("[data-resident-topic]")
      .forEach(
        (d) => (d.onclick = () => openResident(r, Number(d.dataset.residentTopic), "", Number(d.dataset.residentTopic) === 1 ? "concerned" : "warm")),
      ),
    save(),
    renderTracker());
}
function offerQuest(r) {
  let e = QUEST_BY_ID[r],
    t = RESIDENT_BY_ID[e.giver];
  openModal(
    e.title,
    `<div class="quest-offer">${portrait(e.giver, "concerned")}<div><small>${esc(t.name)} / ${esc(t.role)}</small><p class="narrative">${esc(e.intro)}</p><p>Speak with ${e.witnesses
      .map((s) => RESIDENT_BY_ID[s].name)
      .map(esc)
      .join(
        " and ",
      )}. Then inspect ${esc(e.object.toLowerCase())}.</p><div class="hint-strip">Optional. No time limit. Your main case remains available.</div></div></div>`,
    [
      {
        label: "TAKE THE LOCAL STORY",
        primary: !0,
        run: () => {
          startQuest(state, r) && (save(), renderTracker(), openQuest(r));
        },
      },
      { label: "Not now", run: () => openResident(e.giver) },
    ],
    { wide: !0, className: "district-dialog", eyebrow: "A SMALL STORY / " + e.group.toUpperCase() },
  );
}
function openQuest(r) {
  let e = QUEST_BY_ID[r],
    t = state.district.quests[r],
    s = questNextStep(state, r),
    i = t?.stage === 4;
  openModal(
    e.title,
    `<p class="narrative">${esc(e.intro)}</p><div class="quest-status-line">${esc(questStatusLabel(e, t))}</div><div class="quest-witnesses">${e.witnesses.map((n) => `<article><b>${esc(RESIDENT_BY_ID[n].name)}</b><small>${esc(placeName(RESIDENT_BY_ID[n].room))}</small><p>${t?.witnesses.includes(n) ? esc(e.testimony[n]) : "Account not yet heard."}</p></article>`).join("")}</div>${t?.stage >= 2 ? `<div class="case-clue"><b>FIELD NOTES</b><p>${esc(e.clue)}</p></div>` : ""}${t?.stage >= 3 ? `<div class="reward-chip">${esc(e.item)}</div>` : ""}${i ? `<h3>${esc(e.outcomes[t.choice][0])}</h3><p>${esc(e.outcomes[t.choice][1])}</p><p class="scene-return">${esc(e.outcomes[t.choice][2])}</p><div class="reward-row"><span class="reward-chip">${e.reward} credits</span><span class="reward-chip">10 XP</span><span class="reward-chip">${e.group} connection</span>${e.perk ? `<span class="reward-chip">${e.perk === "stairs" ? "Service stair open" : "Local transit open"}</span>` : ""}</div>` : ""}`,
    [
      ...(s && state.chapter === 0
        ? [
            {
              label: "WALK TO " + s.label.toUpperCase(),
              primary: !0,
              run: () => {
                ((state.district.tracked = r), renderTracker(), save(), walkToPlace(s.room, s.id));
              },
            },
          ]
        : []),
      { label: "All local stories", run: () => openDistrict("quests") },
      { label: "Back to the world", run: dismissModal },
    ],
    { wide: !0, className: "district-dialog", eyebrow: "LOCAL STORY / SAVED PROGRESS" },
  );
}
function openDevice(r, e = "", t = -1) {
  let s = QUEST_BY_ID[r],
    i = state.district.quests[r];
  if (!i || i.stage < 2) {
    openModal(
      s.object,
      `<p>${esc(s.intro)}</p><div class="hint-strip">${i ? "Hear the local witnesses before using the equipment." : "First speak with " + esc(RESIDENT_BY_ID[s.giver].name) + "."}</div>`,
      [
        { label: "Review this local story", primary: !0, run: () => openQuest(r) },
        { label: "Back", run: dismissModal },
      ],
      { eyebrow: "LOCAL FIELD WORK" },
    );
    return;
  }
  if (i.stage >= 3) {
    openQuest(r);
    return;
  }
  let n = "";
  if (
    (s.kind === "match" &&
      (n = `<div class="district-match">${s.choices.map((l, c) => `<button data-match-choice="${c}" class="${t === c ? "selected" : ""}"><span>${String(c + 1).padStart(2, "0")}</span>${esc(l)}</button>`).join("")}</div>`),
    s.kind === "tones" &&
      (n = `<div class="district-tones">${s.takes.map((take, c) => `<div class="tone-take ${t === c ? "selected" : ""}"><button class="tone-choose" data-match-choice="${c}"><span>${String(c + 1).padStart(2, "0")}</span><b>${esc(take.label)}</b>${toneBars(take)}</button><button class="small-button" data-play-take="${c}" aria-label="Play ${esc(take.label)}">\u25B6 PLAY</button></div>`).join("")}</div><p class="fine-print">Each take is drawn too: a bar for every note, a dashed gap for a silent beat, a pink spike for a licensing chirp.</p>`),
    s.kind === "dials" &&
      (n = `<div class="district-dials">${s.labels.map((l, c) => `<label><span>${esc(l)}</span><input type="range" min="0" max="10" step="1" value="${i.dials[c]}" data-district-dial="${c}" aria-label="${esc(l)}"><output id="district-output-${c}">${i.dials[c]}</output></label>`).join("")}</div>`),
    s.kind === "sequence" &&
      (n = `<div class="district-sequence">${i.order.map((l, c) => `<article><b>${c + 1}</b><span>${esc(s.order[l])}</span><button data-order-up="${c}" aria-label="Move step ${c + 1} up" ${c === 0 ? "disabled" : ""}>\u2191</button><button data-order-down="${c}" aria-label="Move step ${c + 1} down" ${c === 3 ? "disabled" : ""}>\u2193</button></article>`).join("")}</div>`),
    s.kind === "circuit")
  ) {
    let l = circuitPower(i.tiles);
    n = `<div class="district-circuit"><span class="circuit-in">IN \u2192</span><div class="district-wire-grid">${i.tiles.map((c, h) => `<button data-district-wire="${h}" aria-label="Rotate contact ${h + 1}" class="${l.powered.includes(h) ? "powered" : ""}">${wireTile(c, l.powered.includes(h))}</button>`).join("")}</div><span class="circuit-out">\u2192 OUT</span></div><p class="fine-print">Select a contact to rotate it clockwise. Extra dead ends do not need power.</p>`;
  }
  let o = openModal(
    s.object,
    `<div class="micro"><span>${esc(s.title.toUpperCase())}</span><span>FIELD WORK / ${esc((s.kind === "tones" ? "listening" : s.kind).toUpperCase())}</span></div><p class="narrative">${esc(s.prompt)}</p><div class="case-clue"><b>YOUR WITNESSES\u2019 NOTES</b><p>${esc(s.clue)}</p></div>${n}<div id="district-feedback" class="hint-strip" role="status">${esc(e || "There is no timer. Check the notes and test your result.")}</div>`,
    [
      {
        label: "TEST THE RESULT",
        primary: !0,
        run: () => {
          testQuestDevice(state, r, t)
            ? (save(),
              audio.success(),
              renderTracker(),
              openModal(
                "Field work complete",
                `<p class="narrative">${esc(s.item)}</p><p>Return to ${esc(RESIDENT_BY_ID[s.giver].name)}. They decide with you what happens next.</p>`,
                [
                  {
                    label: "RETURN TO " + RESIDENT_BY_ID[s.giver].name.toUpperCase(),
                    primary: !0,
                    run: () => {
                      ((state.district.tracked = r), followQuest(r));
                    },
                  },
                  { label: "Stay here for now", run: dismissModal },
                ],
                { eyebrow: s.title.toUpperCase() },
              ))
            : (save(), openDevice(r, "That result does not match the witness notes. Nothing was destroyed. Check the notes and try again.", t));
        },
      },
      {
        label: "Close and keep this progress",
        run: () => {
          (save(), dismissModal());
        },
      },
    ],
    {
      wide: !0,
      className: "district-dialog device-dialog",
      eyebrow: "NEIGHBORHOOD / USE THE EVIDENCE",
      focus: "[data-match-choice], [data-district-dial], [data-order-down], [data-district-wire]",
    },
  );
  o.querySelectorAll("[data-play-take]").forEach(
    (l) =>
      (l.onclick = () => {
        audio.playTake(s.takes[Number(l.dataset.playTake)]) || toast("Sound is off. Each take is also drawn beside its button.");
      }),
  );
  (o
    .querySelectorAll("[data-match-choice]")
    .forEach((l) => (l.onclick = () => openDevice(r, "Selected. Test the result when ready.", Number(l.dataset.matchChoice)))),
    o.querySelectorAll("[data-district-dial]").forEach(
      (l) =>
        (l.oninput = () => {
          let c = Number(l.dataset.districtDial);
          ((i.dials[c] = Number(l.value)), (byId("district-output-" + c).textContent = l.value), save());
        }),
    ));
  let a = (l, c) => {
    c < 0 || c > 3 || (([i.order[l], i.order[c]] = [i.order[c], i.order[l]]), save(), openDevice(r));
  };
  (o.querySelectorAll("[data-order-up]").forEach((l) => (l.onclick = () => a(Number(l.dataset.orderUp), Number(l.dataset.orderUp) - 1))),
    o
      .querySelectorAll("[data-order-down]")
      .forEach((l) => (l.onclick = () => a(Number(l.dataset.orderDown), Number(l.dataset.orderDown) + 1))),
    o.querySelectorAll("[data-district-wire]").forEach(
      (l) =>
        (l.onclick = () => {
          let c = Number(l.dataset.districtWire);
          ((i.tiles[c] = rotateTile(i.tiles[c])), save(), openDevice(r));
        }),
    ));
}
/** A recorded take as bars: one per note, a dashed gap for a silent beat, a spike for a resale watermark. */
function toneBars(take) {
  const w = 22,
    width = take.notes.length * w + 30;
  return `<svg class="tone-bars" viewBox="0 0 ${width} 44" aria-hidden="true">${take.notes
    .map((n, i) =>
      n === null
        ? `<rect x="${i * w + 3}" y="6" width="${w - 8}" height="34" fill="none" stroke="#7bd1cc88" stroke-dasharray="3 3"/>`
        : `<rect x="${i * w + 3}" y="${(32 - n * 2.2).toFixed(1)}" width="${w - 8}" height="${(8 + n * 2.2).toFixed(1)}" fill="#e7b575"/>`,
    )
    .join("")}${take.mark ? `<path d="M${take.notes.length * w + 8} 40V3l7 37" fill="none" stroke="#d889a6" stroke-width="2.5"/>` : ""}</svg>`;
}
function openQuestResolution(r) {
  let e = QUEST_BY_ID[r],
    t = state.district.quests[r];
  !t ||
    t.stage !== 3 ||
    openModal(
      e.title,
      `<div class="quest-offer">${portrait(e.giver, "warm")}<div><p class="narrative">${esc(e.item)}</p><p>${esc(e.prompt)}</p><p>The field work is complete. Choose how to leave the result with the people involved.</p></div></div>`,
      e.outcomes.map((s, i) => ({
        label: s[0],
        primary: i === 0,
        run: () => {
          resolveQuest(state, r, i) && (syncLife(), save(), audio.success(), renderHud(), e.perk === "stairs" && refreshDoors(), openQuest(r));
        },
      })),
      { wide: !0, className: "district-dialog", eyebrow: "RESOLUTION / YOUR CHOICE STAYS" },
    );
}
function refreshDoors() {
  state.chapter === 0 &&
    ((targets = targets
      .filter((r) => r.kind !== "door")
      .concat(
        districtDoors(state.room, hasPerk(state, "stairs")).map((r) => ({
          id: "door-" + r.destination,
          label: CASES[0].rooms[r.destination].name,
          kind: "door",
          room: state.room,
          ...r,
          ready: !0,
          done: !1,
        })),
      )),
    view.setWorld(world, targets),
    buildMarkers());
}
function openLore(r) {
  let e = CITY_LORE.find((t) => t.id === r);
  e &&
    (readLore(state, r),
    save(),
    openModal(
      e.title,
      `<div class="document-sheet"><div class="document-stamp">LOCAL RECORD / ${esc(placeName(e.room))}</div><p>${esc(e.text)}</p><span class="document-signature">A PLACE IS MORE THAN ITS OFFICIAL DESCRIPTION.</span></div>`,
      [
        { label: "KEEP THE NOTE", primary: !0, run: dismissModal },
        { label: "Read other city notes", run: () => openDistrict("lore") },
      ],
      { eyebrow: "STREET LORE / NOT CASE EVIDENCE" },
    ),
    renderTracker());
}
function openCounter(r, e = "") {
  let t = RESIDENT_BY_ID[r],
    s = SHOPS.find((o) => o.room === t.room),
    i = r === "mara" ? ["broth"] : s?.goods || [];
  openModal(
    r === "mara" ? "Mara\u2019s counter" : s.name,
    `<div class="shop-heading"><div class="shop-face">${portrait(r, "warm")}</div><div><small>${esc(t.name)}</small><h3>${state.credits} credits</h3><p>${state.district.reputation.neighbors >= 8 ? "Neighbors\u2019 price: one credit off each purchase." : "Prices are written down. You do not need to bargain for basic facts."}</p></div></div><div class="shop-stock">${i
      .map((o) => {
        let a = LOCAL_GOODS[o],
          l = (a.item && state.inventory.includes(a.item)) || (a.keepsake && state.district.keepsakes.includes(a.keepsake));
        return `<article><div><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></div><button data-buy-local="${o}" ${l ? "disabled" : ""}>${l ? "OWNED" : localPrice(state, o) + " \xA2 / BUY"}</button></article>`;
      })
      .join("")}</div><div class="hint-strip" role="status">${esc(e || "Buying something is never required for a local quest.")}</div>`,
    [
      { label: "Back to the conversation", run: () => openResident(r) },
      { label: "Back to the world", run: dismissModal },
    ],
    { wide: !0, className: "district-dialog", eyebrow: "A LOCAL COUNTER / REAL SUPPLIES" },
  )
    .querySelectorAll("[data-buy-local]")
    .forEach(
      (o) =>
        (o.onclick = () => {
          let a = buyLocal(state, o.dataset.buyLocal);
          (a.ok && (save(), syncLife(), renderHud(), audio.tone(392, 0.18, 0.05)), openCounter(r, a.ok ? "Purchase kept. " + LOCAL_GOODS[o.dataset.buyLocal].name : a.reason));
        }),
    );
}
function openTransit() {
  if (!hasPerk(state, "transit")) return;
  openModal(
    "The local service",
    `<p>Tess has reopened the neighborhood service route. It connects the district stops without changing your case progress.</p><div class="district-place-grid">${CASES[0].rooms.map((e, t) => `<button data-service-stop="${t}" class="district-place"><small>LOCAL STOP ${String(t + 1).padStart(2, "0")}</small><h3>${esc(e.name)}</h3><span>BOARD HERE \u2192</span></button>`).join("")}</div>`,
    [],
    { wide: !0, className: "district-dialog", eyebrow: "LOW LINE / FARE WAIVED" },
  )
    .querySelectorAll("[data-service-stop]")
    .forEach(
      (e) =>
        (e.onclick = () => {
          (dismissModal(), (afterDoor = null), enterRoom(Number(e.dataset.serviceStop)), save(), toast("Local service arrival. Tess leaves the fare at zero."));
        }),
    );
}
function followQuest(r) {
  let e = questNextStep(state, r);
  e && ((state.district.tracked = r), renderTracker(), save(), walkToPlace(e.room, e.id));
}
function renderTracker() {
  if (
    !byId("neighborhood") ||
    (byId("neighborhood").classList.toggle("hidden", !playing),
    byId("district-tracker").classList.toggle("hidden", !playing || state.chapter !== 0 || !state.district.tracked),
    !state.district)
  )
    return;
  let r = districtTotals(state);
  byId("district-count").textContent = r.quests + "/" + LOCAL_QUESTS.length;
  let e = QUEST_BY_ID[state.district.tracked],
    t = e ? questNextStep(state, e.id) : null;
  e && t
    ? ((byId("district-track-title").textContent = e.title), (byId("district-track-step").textContent = t.label + " \xB7 " + placeName(t.room)))
    : byId("district-tracker").classList.add("hidden");
}
function updateStreetVoices(r) {
  if (!playing || state.chapter !== 0 || modalOpen || quietView || worldTime < nextStreetVoiceAt || worldTime < captionUntil + 3 || !prefs.captions) return;
  nextStreetVoiceAt = worldTime + 26;
  let e = LOCAL_QUESTS.filter((t) => t.room === state.room && state.district.quests[t.id]?.stage === 4);
  if (e.length && streetVoiceCount % 3 === 0) {
    let t = e[streetVoiceCount % e.length],
      s = state.district.quests[t.id];
    showCaption("A change in the neighborhood", t.outcomes[s.choice][2], 9);
  } else if (state.room === 0) {
    let [t, s] = STREET_VOICES[streetVoiceCount % STREET_VOICES.length];
    (showCaption(t, s, 8), streetVoiceCount % 6 === 2 && (audio.tone(240, 0.4, 0.025, -0.5), audio.tone(300, 0.5, 0.02, 0.5)));
  } else {
    let t = residentsInRoom(state.room),
      s = t[streetVoiceCount % t.length];
    s && showCaption(s.name, s.topics[(streetVoiceCount + 1) % 3].text, 9);
  }
  streetVoiceCount++;
}
function cityEcho() {
  let r = LOCAL_QUESTS.filter((s) => state.district.quests[s.id]?.stage === 4);
  if (!r.length) return "";
  let e = r[(state.chapter - 1) % r.length],
    t = state.district.quests[e.id];
  return `<div class="city-echo"><small>A MESSAGE FROM LOWER RAINWARD</small><p>${esc(e.outcomes[t.choice][2])}</p></div>`;
}
function districtEnding() {
  let r = LOCAL_QUESTS.filter((t) => state.district.quests[t.id]?.stage === 4),
    e = districtTotals(state);
  return `<p>${e.met} named residents met. ${e.topics} conversation topics heard. ${e.quests} local stories resolved.</p>${r.map((t) => `<article class="ending-neighbor"><b>${esc(t.title)}</b><p>${esc(t.outcomes[state.district.quests[t.id].choice][2])}</p></article>`).join("") || "<p>The district continues its night. Its unfinished stories are not recorded as completed.</p>"}`;
}
