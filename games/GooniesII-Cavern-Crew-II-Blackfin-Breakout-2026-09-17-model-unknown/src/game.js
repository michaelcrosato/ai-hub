import {
  GAME_TITLE,
  LEVEL,
  BALANCE,
  floorHeightAt,
  circleHitsAabb,
  isWetAt
} from './level.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

class SoundBoard {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicClock = 0;
    this.beat = 0;
    this.notes = [130.81, 164.81, 196.0, 220.0, 196.0, 164.81, 146.83, 174.61];
  }

  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  tone(freq, duration = 0.09, gain = 0.035, type = 'square', slide = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shot() { this.tone(460, 0.07, 0.025, 'square', -240); }
  hit() { this.tone(95, 0.08, 0.04, 'sawtooth', -35); }
  pickup() { this.tone(650, 0.06, 0.028, 'square', 300); setTimeout(() => this.tone(940, 0.07, 0.024, 'square'), 55); }
  level() { [523, 659, 784].forEach((n, i) => setTimeout(() => this.tone(n, 0.12, 0.03, 'triangle'), i * 85)); }
  fail() { this.tone(150, 0.22, 0.03, 'sawtooth', -70); }
  win() { [392, 523, 659, 784].forEach((n, i) => setTimeout(() => this.tone(n, 0.2, 0.035, 'triangle'), i * 110)); }

  update(dt) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    this.musicClock -= dt;
    if (this.musicClock <= 0) {
      this.musicClock += 0.42;
      const note = this.notes[this.beat++ % this.notes.length];
      this.tone(note, 0.18, 0.008, 'triangle');
      if (this.beat % 4 === 1) this.tone(note / 2, 0.11, 0.008, 'sine');
    }
  }
}

class InputManager {
  constructor(canvas, state, onShoot, onUse, onDash) {
    this.canvas = canvas;
    this.state = state;
    this.keys = new Set();
    this.moveX = 0;
    this.moveY = 0;
    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.canvasPointers = new Map();
    this.lastSingle = null;
    this.lastPinch = 0;
    this.cameraYawDelta = 0;
    this.zoomDelta = 0;
    this.onShoot = onShoot;
    this.onUse = onUse;
    this.onDash = onDash;

    this.joy = document.getElementById('joystick');
    this.stick = document.getElementById('joystick-stick');
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyF') this.onShoot();
      if (e.code === 'KeyE' || e.code === 'Enter') this.onUse();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.onDash();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    const startJoy = (e) => {
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      this.joy.setPointerCapture?.(e.pointerId);
      const r = this.joy.getBoundingClientRect();
      this.joyCenter.x = r.left + r.width / 2;
      this.joyCenter.y = r.top + r.height / 2;
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    };
    this.joy.addEventListener('pointerdown', startJoy);
    this.joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    });
    const endJoy = (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.moveX = 0;
      this.moveY = 0;
      this.stick.style.transform = 'translate(0px, 0px)';
      e.preventDefault();
    };
    this.joy.addEventListener('pointerup', endJoy);
    this.joy.addEventListener('pointercancel', endJoy);

    const bindButton = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 90);
      });
    };
    bindButton('btn-shot', this.onShoot);
    bindButton('btn-use', this.onUse);
    bindButton('btn-dash', this.onDash);

    this.canvas.addEventListener('wheel', (e) => {
      this.zoomDelta += Math.sign(e.deltaY) * 0.85;
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0 && !e.shiftKey) {
        // Mouse shooting is intentionally immediate; right-drag rotates the camera.
        this.onShoot();
      }
      this.canvas.setPointerCapture?.(e.pointerId);
      this.canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button });
      if (this.canvasPointers.size === 1) this.lastSingle = { x: e.clientX, y: e.clientY };
      if (this.canvasPointers.size === 2) this.lastPinch = this.pointerDistance();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.canvasPointers.has(e.pointerId)) return;
      const old = this.canvasPointers.get(e.pointerId);
      this.canvasPointers.set(e.pointerId, { ...old, x: e.clientX, y: e.clientY });
      if (this.canvasPointers.size >= 2) {
        const d = this.pointerDistance();
        if (this.lastPinch > 0) this.zoomDelta += (this.lastPinch - d) * 0.025;
        this.lastPinch = d;
      } else if (this.canvasPointers.size === 1) {
        const p = [...this.canvasPointers.values()][0];
        const canRotate = p.type !== 'mouse' || p.button === 2;
        if (canRotate && this.lastSingle) this.cameraYawDelta += (p.x - this.lastSingle.x) * 0.006;
        this.lastSingle = { x: p.x, y: p.y };
      }
      e.preventDefault();
    });
    const endCanvas = (e) => {
      this.canvasPointers.delete(e.pointerId);
      this.lastPinch = this.canvasPointers.size === 2 ? this.pointerDistance() : 0;
      this.lastSingle = this.canvasPointers.size === 1 ? { ...[...this.canvasPointers.values()][0] } : null;
    };
    this.canvas.addEventListener('pointerup', endCanvas);
    this.canvas.addEventListener('pointercancel', endCanvas);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pointerDistance() {
    const p = [...this.canvasPointers.values()];
    if (p.length < 2) return 0;
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  updateJoy(x, y) {
    const dx = x - this.joyCenter.x;
    const dy = y - this.joyCenter.y;
    const max = 42;
    const len = Math.hypot(dx, dy) || 1;
    const scale = len > max ? max / len : 1;
    const sx = dx * scale;
    const sy = dy * scale;
    this.moveX = clamp(sx / max, -1, 1);
    this.moveY = clamp(-sy / max, -1, 1);
    this.stick.style.transform = `translate(${sx}px, ${sy}px)`;
  }

  readMove() {
    let x = this.moveX;
    let y = this.moveY;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  consumeCamera() {
    const out = { yaw: this.cameraYawDelta, zoom: this.zoomDelta };
    this.cameraYawDelta = 0;
    this.zoomDelta = 0;
    return out;
  }
}

export async function bootGame({ THREE, TSL = null, renderer, backend = 'WebGPU', legacy = false }) {
  const root = document.getElementById('game-root');
  root.appendChild(renderer.domElement);
  renderer.domElement.id = 'game-canvas';
  renderer.domElement.setAttribute('aria-label', `${GAME_TITLE} game view`);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071117);
  scene.fog = new THREE.FogExp2(0x071117, legacy ? 0.026 : 0.022);

  const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 120);
  const clock = new THREE.Clock();
  const sound = new SoundBoard();
  const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 800;

  const state = {
    started: false,
    complete: false,
    paused: false,
    elapsed: 0,
    level: 1,
    xp: 0,
    hp: BALANCE.player.maxHp,
    scrap: 0,
    seals: new Set(),
    gear: { sling: false, boots: false, lamp: false, jacket: false },
    upgrades: { sling: 0 },
    kills: 0,
    crates: 0,
    gateOpen: false,
    checkpoint: { x: LEVEL.spawn.x, z: LEVEL.spawn.z },
    backend,
    quality: isMobile ? 'mobile' : 'desktop',
    shotCooldown: 0,
    invuln: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashDir: { x: 0, z: 1 }
  };

  // UI
  const ui = {
    title: document.getElementById('title-screen'),
    start: document.getElementById('start-button'),
    hearts: document.getElementById('hearts'),
    xpFill: document.getElementById('xp-fill'),
    level: document.getElementById('level-number'),
    scrap: document.getElementById('scrap-count'),
    seals: document.getElementById('seal-count'),
    objective: document.getElementById('objective-text'),
    prompt: document.getElementById('prompt'),
    toast: document.getElementById('toast'),
    backend: document.getElementById('backend-badge'),
    upgrade: document.getElementById('upgrade-panel'),
    upgradeScrap: document.getElementById('upgrade-scrap'),
    complete: document.getElementById('complete-screen'),
    completeStats: document.getElementById('complete-stats'),
    mute: document.getElementById('mute-button'),
    minimap: document.getElementById('minimap')
  };
  ui.backend.textContent = backend;

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.78,
    metalness: extra.metalness ?? 0.04,
    flatShading: extra.flatShading ?? true,
    transparent: extra.transparent ?? false,
    opacity: extra.opacity ?? 1,
    emissive: extra.emissive ?? 0x000000,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    side: extra.side ?? THREE.FrontSide
  });

  const materials = {
    floor: mat(0x4b4438),
    floorAlt: mat(0x5b4b39),
    wetFloor: mat(0x344b52, { roughness: 0.55 }),
    wall: mat(0x3e3a35),
    wallAlt: mat(0x50473f),
    rail: mat(0x6a5140, { roughness: 0.65 }),
    wood: mat(0x775033),
    darkWood: mat(0x4a2d20),
    metal: mat(0x7b8587, { metalness: 0.5, roughness: 0.38 }),
    rust: mat(0x8d4c2e, { metalness: 0.25 }),
    orange: mat(0xe1742f),
    gold: mat(0xf2bf49, { metalness: 0.35, roughness: 0.35, emissive: 0x4f2800, emissiveIntensity: 0.35 }),
    cyan: mat(0x49cad6, { emissive: 0x0d4a55, emissiveIntensity: 0.55 }),
    red: mat(0xc64f47),
    green: mat(0x6da45d),
    blue: mat(0x4d79a8),
    cream: mat(0xe3d6b6),
    black: mat(0x15191c),
    skin: mat(0xc98e67),
    cloth: mat(0x365367),
    white: mat(0xe9eadf),
    water: mat(0x2b7485, { transparent: true, opacity: 0.47, roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide })
  };

  // Native TSL node shader on the modern renderer. It runs on both WebGPU and
  // WebGPURenderer's WebGL2 backend; the r162 WebGL1 path keeps the static material.
  if (!legacy && TSL && THREE.MeshStandardNodeMaterial) {
    const waterNode = new THREE.MeshStandardNodeMaterial({
      color: 0x2b7485,
      roughness: 0.24,
      metalness: 0.04,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const rippleA = TSL.sin(TSL.positionLocal.x.mul(1.65).add(TSL.time.mul(1.7)));
    const rippleB = TSL.sin(TSL.positionLocal.y.mul(1.25).sub(TSL.time.mul(1.25)));
    const ripple = rippleA.add(rippleB).mul(0.035);
    waterNode.positionNode = TSL.positionLocal.add(TSL.vec3(0, 0, ripple));
    waterNode.colorNode = TSL.mix(TSL.color(0x235f70), TSL.color(0x54a9ad), ripple.mul(2.4).add(0.5));
    waterNode.roughnessNode = TSL.float(0.23).add(TSL.abs(ripple).mul(1.6));
    materials.water = waterNode;
  }

  // Lighting: one shadow-casting key plus inexpensive local lights.
  const hemi = new THREE.HemisphereLight(0x7091a6, 0x25180f, legacy ? 1.25 : 1.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd8a3, legacy ? 2.0 : 2.7);
  key.position.set(-12, 24, 14);
  key.castShadow = !legacy;
  if (key.shadow) {
    const s = isMobile ? 1024 : 2048;
    key.shadow.mapSize.set(s, s);
    key.shadow.camera.left = -42;
    key.shadow.camera.right = 42;
    key.shadow.camera.top = 42;
    key.shadow.camera.bottom = -42;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 72;
    key.shadow.bias = -0.00035;
  }
  scene.add(key);

  const torchPositions = [
    [-4, 5, 2.0], [19, -4, 2.0], [31, 6, 2.1], [20, 25, 1.2],
    [32, 31, 1.2], [18, -34, 5.0], [35, -34, 5.0], [48, 1.8, 2.0], [65, -6, 2.0], [72, 5, 2.0]
  ];
  for (let i = 0; i < torchPositions.length; i++) {
    const [x, z, y] = torchPositions[i];
    const light = new THREE.PointLight(i % 3 === 0 ? 0xffb04f : 0xff7848, legacy ? 18 : 30, 10, 2);
    light.position.set(x, y, z);
    scene.add(light);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffb13b }));
    flame.position.copy(light.position);
    flame.scale.y = 1.5;
    scene.add(flame);
  }

  const world = new THREE.Group();
  scene.add(world);
  const cameraObstacles = [];
  const wallMeshes = new Map();
  const breakables = new Map();
  const interactableObjects = new Map();
  const pickupObjects = new Map();
  const hazardObjects = new Map();

  function addMesh(geo, material, x, y, z, { cast = true, receive = true, parent = world } = {}) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast && !legacy;
    mesh.receiveShadow = receive && !legacy;
    parent.add(mesh);
    return mesh;
  }

  // Floors and stairs.
  for (const f of LEVEL.floors) {
    if (f.ramp) {
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const h = lerp(f.ramp.y0, f.ramp.y1, t);
        const stepD = f.d / steps + 0.04;
        addMesh(new THREE.BoxGeometry(f.w, 0.36, stepD), materials.floorAlt, f.x, h - 0.18, f.z - f.d / 2 + stepD * (i + 0.5), { cast: false });
      }
      continue;
    }
    const material = f.water ? materials.wetFloor : (hash01(f.id) > 0.45 ? materials.floorAlt : materials.floor);
    addMesh(new THREE.BoxGeometry(f.w, 0.45, f.d), material, f.x, f.y - 0.23, f.z, { cast: false });
    if (f.water) {
      const water = addMesh(new THREE.PlaneGeometry(f.w - 0.6, f.d - 0.6), materials.water, f.x, f.y + 0.34, f.z, { cast: false, receive: false });
      water.rotation.x = -Math.PI / 2;
      water.userData.water = true;
    }
  }

  // Walls with chunky rock caps.
  for (const w of LEVEL.walls) {
    const h = w.h || 3.4;
    const mesh = addMesh(new THREE.BoxGeometry(w.w, h, w.d), hash01(w.id) > 0.5 ? materials.wall : materials.wallAlt, w.x, w.y + h / 2, w.z);
    mesh.userData.wall = w;
    wallMeshes.set(w.id, mesh);
    if (w.id !== LEVEL.gateId) cameraObstacles.push(mesh);
    if (!w.low && w.id !== LEVEL.gateId) {
      const rockCount = Math.max(1, Math.floor(Math.max(w.w, w.d) / 3.2));
      for (let i = 0; i < rockCount; i++) {
        const r = hash01(`${w.id}-rock-${i}`);
        const alongX = w.w > w.d;
        const px = alongX ? w.x - w.w / 2 + (i + 0.5) * w.w / rockCount : w.x + (r - 0.5) * 0.4;
        const pz = alongX ? w.z + (r - 0.5) * 0.4 : w.z - w.d / 2 + (i + 0.5) * w.d / rockCount;
        const rock = addMesh(new THREE.DodecahedronGeometry(0.55 + r * 0.45, 0), materials.wallAlt, px, w.y + h + 0.15 + r * 0.3, pz);
        rock.rotation.set(r * 2, r * 4, r * 3);
      }
    }
  }

  for (const r of LEVEL.rails) {
    const base = addMesh(new THREE.BoxGeometry(r.w, 0.16, r.d), materials.rail, r.x, r.y + 0.28, r.z);
    cameraObstacles.push(base);
    const alongX = r.w > r.d;
    const len = alongX ? r.w : r.d;
    const posts = Math.ceil(len / 2.5);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts - 0.5;
      const px = alongX ? r.x + t * r.w : r.x;
      const pz = alongX ? r.z : r.z + t * r.d;
      addMesh(new THREE.BoxGeometry(0.16, r.h, 0.16), materials.rail, px, r.y + r.h / 2, pz);
    }
    const top = addMesh(new THREE.BoxGeometry(alongX ? r.w : 0.18, 0.16, alongX ? 0.18 : r.d), materials.rail, r.x, r.y + r.h, r.z);
    cameraObstacles.push(top);
  }

  // Rope-bridge planks provide extra visual motion and source-inspired adventure texture.
  for (let i = 0; i < 15; i++) {
    const x = 44.4 + i * 1.02;
    const plank = addMesh(new THREE.BoxGeometry(0.88, 0.16, 4.15), i % 2 ? materials.wood : materials.darkWood, x, 0.18 + Math.sin(i * 1.7) * 0.06, 0);
    plank.rotation.z = Math.sin(i * 2.1) * 0.018;
  }

  // Cave rock clutter. Shared material and low-poly geometry; no textures required.
  const rockGeo = new THREE.ConeGeometry(0.42, 1.5, 5);
  const rockMat = materials.wallAlt;
  const rockSpots = [];
  for (const w of LEVEL.walls) {
    if (w.low || w.dynamic) continue;
    const n = Math.min(4, Math.max(1, Math.floor(Math.max(w.w, w.d) / 5)));
    for (let i = 0; i < n; i++) {
      const r = hash01(`spike-${w.id}-${i}`);
      if (w.w > w.d) rockSpots.push([w.x - w.w / 2 + (i + 0.5) * w.w / n, w.y, w.z + (r - 0.5) * 1.2, r]);
      else rockSpots.push([w.x + (r - 0.5) * 1.2, w.y, w.z - w.d / 2 + (i + 0.5) * w.d / n, r]);
    }
  }
  if (rockSpots.length) {
    const inst = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
    const dummy = new THREE.Object3D();
    rockSpots.forEach(([x, y, z, r], i) => {
      dummy.position.set(x, y + 0.65, z);
      dummy.scale.set(0.6 + r * 0.9, 0.6 + r * 1.5, 0.6 + r * 0.9);
      dummy.rotation.y = r * Math.PI * 2;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.castShadow = !legacy;
    inst.receiveShadow = !legacy;
    world.add(inst);
  }

  function createCrate(p) {
    const g = new THREE.Group();
    const box = addMesh(new THREE.BoxGeometry(1.15, 1.05, 1.15), materials.wood, 0, 0.53, 0, { parent: g });
    const band1 = addMesh(new THREE.BoxGeometry(1.19, 0.12, 1.19), materials.darkWood, 0, 0.27, 0, { parent: g });
    const band2 = addMesh(new THREE.BoxGeometry(1.19, 0.12, 1.19), materials.darkWood, 0, 0.78, 0, { parent: g });
    g.position.set(p.x, p.y, p.z);
    g.userData.prop = p;
    breakables.set(p.id, g);
    world.add(g);
    return g;
  }

  for (const p of LEVEL.props) {
    if (p.type === 'crate') createCrate(p);
    if (p.type === 'barrel') {
      const b = addMesh(new THREE.CylinderGeometry(0.46, 0.5, 1.0, 8), materials.rust, p.x, p.y + 0.5, p.z);
      b.rotation.y = hash01(p.id) * 3;
    }
    if (p.type === 'wreck') {
      const g = new THREE.Group();
      const hull = addMesh(new THREE.BoxGeometry(4.4, 0.65, 1.5), materials.darkWood, 0, 0.15, 0, { parent: g });
      hull.rotation.y = -0.45;
      const mast = addMesh(new THREE.CylinderGeometry(0.08, 0.12, 3.1, 6), materials.wood, 0.7, 1.4, 0, { parent: g });
      mast.rotation.z = 0.35;
      g.position.set(p.x, p.y, p.z);
      world.add(g);
    }
    if (p.type === 'island') {
      const island = addMesh(new THREE.CylinderGeometry(2.4, 2.7, 0.42, 7), materials.floorAlt, p.x, p.y + 0.14, p.z);
      island.scale.z = 0.82;
      island.rotation.y = 0.22;
    }
    if (p.type === 'treasure') {
      const chest = new THREE.Group();
      addMesh(new THREE.BoxGeometry(2.2, 0.75, 1.25), materials.darkWood, 0, 0.38, 0, { parent: chest });
      addMesh(new THREE.BoxGeometry(2.25, 0.18, 1.3), materials.gold, 0, 0.84, 0, { parent: chest });
      chest.position.set(p.x, p.y, p.z);
      chest.rotation.y = 0.3;
      world.add(chest);
    }
  }

  function makeCanvasLabel(text, bg = '#56351f', fg = '#f5d58a') {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#1d1713';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, c.width - 14, c.height - 14);
    ctx.fillStyle = fg;
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    return { texture: tex, material: m };
  }

  for (const s of LEVEL.signs) {
    const g = new THREE.Group();
    const label = makeCanvasLabel(s.text);
    const plane = addMesh(new THREE.PlaneGeometry(2.9, 0.72), label.material, 0, 1.62, 0, { cast: false, receive: false, parent: g });
    plane.rotation.y = Math.PI / 2;
    addMesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), materials.wood, 0, 0.8, 0, { parent: g });
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = Math.PI / 2;
    world.add(g);
  }

  // Interactables.
  let gateVisual = null;
  let rescueNpc = null;
  for (const it of LEVEL.interactables) {
    const g = new THREE.Group();
    if (it.type === 'locker') {
      addMesh(new THREE.BoxGeometry(1.25, 2.0, 0.75), materials.orange, 0, 1, 0, { parent: g });
      addMesh(new THREE.BoxGeometry(0.16, 0.65, 0.82), materials.metal, 0.48, 1.05, 0, { parent: g });
    } else if (it.type === 'seal') {
      const ring = addMesh(new THREE.TorusGeometry(0.43, 0.14, 6, 12), materials.gold, 0, 1.0, 0, { parent: g });
      ring.rotation.x = Math.PI / 2;
      const core = addMesh(new THREE.OctahedronGeometry(0.26, 0), it.seal === 'Tide' ? materials.cyan : (it.seal === 'Echo' ? materials.red : materials.gold), 0, 1.0, 0, { parent: g });
      g.userData.spin = true;
    } else if (it.type === 'workbench') {
      addMesh(new THREE.BoxGeometry(2.6, 0.3, 1.2), materials.wood, 0, 0.9, 0, { parent: g });
      addMesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), materials.metal, -1.0, 0.45, -0.38, { parent: g });
      addMesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), materials.metal, 1.0, 0.45, -0.38, { parent: g });
      addMesh(new THREE.BoxGeometry(0.8, 0.12, 0.4), materials.orange, 0.4, 1.13, 0, { parent: g });
    } else if (it.type === 'gate') {
      addMesh(new THREE.BoxGeometry(0.65, 1.25, 0.65), materials.rust, 0, 0.62, 0, { parent: g });
      addMesh(new THREE.OctahedronGeometry(0.22, 0), materials.gold, 0, 1.35, 0, { parent: g });
    } else if (it.type === 'rescue') {
      const cage = addMesh(new THREE.BoxGeometry(3.0, 0.18, 3.0), materials.metal, 0, 2.6, 0, { parent: g });
      for (let i = -1; i <= 1; i++) {
        addMesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), materials.metal, i * 1.0, 1.3, 1.35, { parent: g });
        addMesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), materials.metal, i * 1.0, 1.3, -1.35, { parent: g });
      }
      rescueNpc = createKid(THREE, materials, { shirt: 0xb34c68, cap: 0xd6b85d, backpack: 0x4c5d45, scale: 0.9 });
      rescueNpc.position.set(0, 0, 0);
      g.add(rescueNpc);
      cage.userData.cage = true;
    }
    g.position.set(it.x, it.y, it.z);
    g.userData.interactable = it;
    interactableObjects.set(it.id, g);
    world.add(g);
  }

  // Gate bars separate from the console interactable.
  {
    const w = LEVEL.walls.find((x) => x.id === LEVEL.gateId);
    gateVisual = new THREE.Group();
    for (let i = -2; i <= 2; i++) addMesh(new THREE.BoxGeometry(0.22, 3.0, 0.22), materials.metal, 0, 1.5, i * 1.0, { parent: gateVisual });
    addMesh(new THREE.BoxGeometry(0.3, 0.25, 5.0), materials.rust, 0, 2.8, 0, { parent: gateVisual });
    gateVisual.position.set(w.x, w.y, w.z);
    world.add(gateVisual);
    const wallMesh = wallMeshes.get(LEVEL.gateId);
    if (wallMesh) wallMesh.visible = false;
  }

  for (const p of LEVEL.pickups) {
    const g = new THREE.Group();
    let material = materials.cyan;
    if (p.type === 'heal') material = materials.red;
    if (p.type === 'scrap') material = materials.metal;
    if (p.type === 'gear') material = p.gear === 'boots' ? materials.orange : materials.gold;
    const mesh = addMesh(p.type === 'heal' ? new THREE.BoxGeometry(0.45, 0.25, 0.45) : new THREE.OctahedronGeometry(0.32, 0), material, 0, 0.45, 0, { parent: g });
    if (p.type === 'heal') {
      addMesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), materials.white, 0, 0.45, 0.23, { parent: g });
      addMesh(new THREE.BoxGeometry(0.36, 0.12, 0.12), materials.white, 0, 0.45, 0.23, { parent: g });
    }
    g.position.set(p.x, p.y, p.z);
    g.userData.pickup = p;
    g.userData.baseY = p.y;
    pickupObjects.set(p.id, g);
    world.add(g);
  }

  // Hazards.
  for (const h of LEVEL.hazards) {
    const g = new THREE.Group();
    if (h.type === 'spikes') {
      for (let ix = -1; ix <= 1; ix++) {
        for (let iz = -1; iz <= 1; iz++) {
          addMesh(new THREE.ConeGeometry(0.16, 0.65, 4), materials.metal, ix * 0.42, 0.25, iz * 0.32, { parent: g });
        }
      }
      g.position.set(h.x, h.y, h.z);
    } else if (h.type === 'pendulum') {
      addMesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), materials.metal, 0, 2.5, 0, { parent: g });
      const ball = addMesh(new THREE.DodecahedronGeometry(h.radius, 1), materials.rust, 0, 0.75, 0, { parent: g });
      ball.userData.hitball = true;
      g.position.set(h.x, h.y, h.z);
    }
    g.userData.hazard = h;
    hazardObjects.set(h.id, g);
    world.add(g);
  }

  // Player.
  const player = createKid(THREE, materials, { shirt: 0x3e7898, cap: 0xd36b38, backpack: 0x8a5e31, scale: 1.0 });
  player.position.set(LEVEL.spawn.x, LEVEL.spawn.y, LEVEL.spawn.z);
  player.rotation.y = Math.PI / 2;
  scene.add(player);
  const playerParts = player.userData.parts;

  const lamp = new THREE.SpotLight(0xffdf9d, 0, 18, Math.PI / 5, 0.55, 1.6);
  lamp.position.set(0, 1.55, 0);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, 1.0, 4);
  player.add(lamp);
  player.add(lampTarget);
  lamp.target = lampTarget;

  // Enemies.
  const enemyStates = [];
  for (const e of LEVEL.enemies) {
    const g = createEnemy(THREE, materials, e);
    g.position.set(e.x, e.y, e.z);
    world.add(g);
    enemyStates.push({
      ...e,
      group: g,
      hpNow: e.hp,
      alive: true,
      attackCd: 0,
      stun: 0,
      homeX: e.x,
      homeZ: e.z,
      phase: hash01(e.id) * Math.PI * 2,
      speed: e.type === 'bat' ? 2.8 : e.type === 'brute' ? 1.45 : e.type === 'crab' ? 1.85 : 2.15
    });
  }

  const projectiles = [];
  const debris = [];

  // Camera and camera collision.
  let cameraYaw = Math.PI * 0.35;
  let cameraDistance = isMobile ? 10.4 : 11.8;
  const cameraTarget = new THREE.Vector3(player.position.x, player.position.y + 1.0, player.position.z);
  const raycaster = new THREE.Raycaster();

  function updateCamera(dt, inputCamera) {
    cameraYaw += inputCamera.yaw;
    cameraDistance = clamp(cameraDistance + inputCamera.zoom, 7.2, 16.0);
    const targetY = player.position.y + 1.0;
    cameraTarget.x = damp(cameraTarget.x, player.position.x, 7.5, dt);
    cameraTarget.y = damp(cameraTarget.y, targetY, 7.5, dt);
    cameraTarget.z = damp(cameraTarget.z, player.position.z, 7.5, dt);

    const h = cameraDistance * 0.72;
    const horizontal = cameraDistance;
    const desired = new THREE.Vector3(
      cameraTarget.x + Math.sin(cameraYaw) * horizontal,
      cameraTarget.y + h,
      cameraTarget.z + Math.cos(cameraYaw) * horizontal
    );

    const dir = desired.clone().sub(cameraTarget);
    const maxDist = dir.length();
    dir.normalize();
    raycaster.set(cameraTarget, dir);
    raycaster.far = maxDist;
    const hits = raycaster.intersectObjects(cameraObstacles, false);
    if (hits.length && hits[0].distance < maxDist - 0.4) {
      desired.copy(cameraTarget).addScaledVector(dir, Math.max(3.8, hits[0].distance - 0.45));
    }
    camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
    camera.lookAt(cameraTarget);
  }

  function activeCollisionBoxes() {
    const arr = [];
    for (const w of LEVEL.walls) {
      if (w.dynamic === 'gate' && state.gateOpen) continue;
      arr.push(w);
    }
    for (const r of LEVEL.rails) arr.push(r);
    return arr;
  }

  function isBlockedAt(x, z, radius, currentY) {
    const f = floorHeightAt(x, z);
    if (!f) return true;
    if (Math.abs(f.y - currentY) > 0.75 && f.floor.kind !== 'ramp') return true;
    for (const b of activeCollisionBoxes()) {
      if (Math.abs((b.y || 0) - f.y) > 1.6 && !b.low) continue;
      if (circleHitsAabb(x, z, radius, b)) return true;
    }
    return false;
  }

  function moveXZ(obj, dx, dz, radius) {
    const currentFloor = floorHeightAt(obj.position.x, obj.position.z);
    const cy = currentFloor?.y ?? obj.position.y;
    let nx = obj.position.x + dx;
    if (!isBlockedAt(nx, obj.position.z, radius, cy)) obj.position.x = nx;
    let nz = obj.position.z + dz;
    if (!isBlockedAt(obj.position.x, nz, radius, cy)) obj.position.z = nz;
    const floor = floorHeightAt(obj.position.x, obj.position.z);
    if (floor) obj.position.y = floor.y;
  }

  function maxHp() {
    return BALANCE.player.maxHp + (state.level - 1) * BALANCE.levelHpBonus + (state.gear.jacket ? 2 : 0);
  }

  function damageAmount() {
    return BALANCE.player.baseDamage + (state.level - 1) * BALANCE.levelDamageBonus + state.upgrades.sling * BALANCE.slingUpgradeDamage;
  }

  function grantXp(amount) {
    state.xp += amount;
    while (state.level < BALANCE.maxLevel && state.xp >= BALANCE.xpThresholds[state.level]) {
      state.level += 1;
      state.hp = Math.min(maxHp(), state.hp + 1);
      toast(`LEVEL ${state.level} — tougher and stronger`);
      sound.level();
    }
    updateHud();
  }

  function toast(text, seconds = 2.1) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => ui.toast.classList.remove('show'), seconds * 1000);
  }

  function objectiveText() {
    if (!state.gear.sling) return 'Find the orange locker and take the sling-kit.';
    if (state.seals.size < 3) return `Find the three Blackfin seals. ${state.seals.size}/3 recovered.`;
    if (!state.gateOpen) return 'Return to the east gate and unlock it.';
    if (!state.complete) return 'Cross the rope bridge, clear the vault, and free Mara.';
    return 'Mara is safe. Mission complete.';
  }

  function updateHud() {
    const mh = maxHp();
    const full = Math.max(0, Math.round(state.hp));
    ui.hearts.textContent = `${'◆'.repeat(full)}${'◇'.repeat(Math.max(0, mh - full))}`;
    ui.level.textContent = state.level;
    ui.scrap.textContent = state.scrap;
    ui.seals.textContent = `${state.seals.size}/3`;
    ui.objective.textContent = objectiveText();
    const prev = BALANCE.xpThresholds[state.level - 1] ?? 0;
    const next = BALANCE.xpThresholds[state.level] ?? (prev + 100);
    ui.xpFill.style.width = `${clamp((state.xp - prev) / Math.max(1, next - prev), 0, 1) * 100}%`;
    document.body.classList.toggle('has-sling', state.gear.sling);
  }

  function damagePlayer(amount, sourceX, sourceZ) {
    if (state.invuln > 0 || state.complete) return;
    state.hp -= amount;
    state.invuln = BALANCE.player.invulnSeconds;
    sound.hit();
    const dx = player.position.x - sourceX;
    const dz = player.position.z - sourceZ;
    const len = Math.hypot(dx, dz) || 1;
    moveXZ(player, dx / len * 0.65, dz / len * 0.65, BALANCE.player.radius);
    document.body.classList.add('hurt');
    setTimeout(() => document.body.classList.remove('hurt'), 120);
    if (state.hp <= 0) respawn();
    updateHud();
  }

  function respawn() {
    state.hp = maxHp();
    state.scrap = Math.max(0, state.scrap - 2);
    player.position.set(state.checkpoint.x, floorHeightAt(state.checkpoint.x, state.checkpoint.z)?.y ?? 0, state.checkpoint.z);
    state.invuln = 2.0;
    toast('Back at the last safe spot. Lost up to 2 scrap.', 2.7);
    sound.fail();
  }

  function destroyCrate(id) {
    const g = breakables.get(id);
    if (!g || !g.visible) return;
    g.visible = false;
    const p = g.userData.prop;
    state.scrap += p.scrap || 1;
    state.crates += 1;
    sound.pickup();
    toast(`Crate cracked: +${p.scrap || 1} scrap`);
    updateHud();
    for (let i = 0; i < 5; i++) {
      const chip = addMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), materials.wood, g.position.x, g.position.y + 0.6, g.position.z, { parent: world });
      chip.userData.velocity = new THREE.Vector3((hash01(`${id}-${i}-x`) - 0.5) * 4, 2 + hash01(`${id}-${i}`) * 2, (hash01(`${id}-${i}-z`) - 0.5) * 4);
      chip.userData.life = 0.8;
      debris.push(chip);
    }
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.group.visible = false;
    state.kills += 1;
    grantXp(e.xp);
    if (hash01(e.id + '-scrap') > 0.38) {
      const bonus = e.type === 'brute' ? 4 : 1;
      state.scrap += bonus;
      toast(`${e.type === 'brute' ? 'Vault brute down' : 'Enemy down'}: +${e.xp} XP, +${bonus} scrap`);
    } else {
      toast(`Enemy down: +${e.xp} XP`);
    }
    sound.pickup();
    updateHud();
  }

  function shoot() {
    if (!state.started || state.paused || state.complete || ui.upgrade.classList.contains('show')) return;
    if (!state.gear.sling) { toast('The sling-kit is in the orange locker.'); return; }
    if (state.shotCooldown > 0) return;
    state.shotCooldown = BALANCE.player.shotCooldown;
    const forward = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
    let best = null;
    let bestScore = Infinity;
    const maxAngle = BALANCE.player.autoAimAngleDeg * Math.PI / 180;
    for (const e of enemyStates) {
      if (!e.alive) continue;
      const dx = e.group.position.x - player.position.x;
      const dz = e.group.position.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > BALANCE.player.autoAimRange) continue;
      const dot = clamp((forward.x * dx + forward.z * dz) / Math.max(0.01, d), -1, 1);
      const a = Math.acos(dot);
      if (a < maxAngle && d + a * 3 < bestScore) { best = e; bestScore = d + a * 3; }
    }
    const dir = best
      ? new THREE.Vector3(best.group.position.x - player.position.x, 0, best.group.position.z - player.position.z).normalize()
      : forward;
    player.rotation.y = Math.atan2(dir.x, dir.z);
    const ball = addMesh(new THREE.IcosahedronGeometry(0.13, 1), materials.gold, player.position.x + dir.x * 0.7, player.position.y + 1.12, player.position.z + dir.z * 0.7, { parent: world });
    ball.castShadow = false;
    projectiles.push({ mesh: ball, dir, life: 1.2, damage: damageAmount() });
    sound.shot();
  }

  function dash() {
    if (!state.started || state.paused || state.complete || state.dashCooldown > 0) return;
    const move = input?.readMove?.() || { x: 0, y: 0 };
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    let dx = move.x * cos + move.y * -sin;
    let dz = move.x * -sin + move.y * -cos;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) { dx = Math.sin(player.rotation.y); dz = Math.cos(player.rotation.y); }
    else { dx /= len; dz /= len; }
    state.dashDir = { x: dx, z: dz };
    state.dashTimer = BALANCE.player.dashSeconds;
    state.dashCooldown = BALANCE.player.dashCooldown;
    state.invuln = Math.max(state.invuln, BALANCE.player.dashSeconds + 0.08);
    sound.tone(240, 0.08, 0.025, 'sawtooth', 140);
  }

  function nearestInteractable() {
    let best = null;
    let bestD = 2.25;
    for (const it of LEVEL.interactables) {
      const g = interactableObjects.get(it.id);
      if (!g || !g.visible) continue;
      if (it.type === 'seal' && state.seals.has(it.seal)) continue;
      if (it.type === 'locker' && state.gear.sling) continue;
      const d = dist2(player.position.x, player.position.z, it.x, it.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  function use() {
    if (!state.started || state.paused || state.complete) return;
    if (ui.upgrade.classList.contains('show')) { closeUpgrade(); return; }
    const it = nearestInteractable();
    if (!it) { toast('Nothing to use here.', 1.0); return; }
    if (it.type === 'locker') {
      state.gear.sling = true;
      interactableObjects.get(it.id).visible = false;
      toast('Sling-kit equipped. Tap SHOT or press Space.');
      sound.pickup();
    } else if (it.type === 'seal') {
      state.seals.add(it.seal);
      interactableObjects.get(it.id).visible = false;
      state.checkpoint = { x: player.position.x, z: player.position.z };
      grantXp(16);
      toast(`${it.seal} Seal recovered — ${state.seals.size}/3`);
      sound.pickup();
    } else if (it.type === 'workbench') {
      openUpgrade();
    } else if (it.type === 'gate') {
      if (state.seals.size < 3) {
        toast(`The gate needs all three seals. ${state.seals.size}/3 found.`);
        sound.fail();
      } else if (!state.gateOpen) {
        state.gateOpen = true;
        state.checkpoint = { x: 39.5, z: 0 };
        toast('Smuggler Gate unlocked. Bridge route open.');
        sound.level();
      }
    } else if (it.type === 'rescue') {
      const threats = enemyStates.filter((e) => e.alive && dist2(e.group.position.x, e.group.position.z, 68, 0) < 12);
      if (threats.length) {
        toast('Clear the vault before opening the cage.');
        sound.fail();
      } else {
        completeMission();
      }
    }
    updateHud();
  }

  function openUpgrade() {
    state.paused = true;
    ui.upgrade.classList.add('show');
    refreshUpgradePanel();
  }

  function closeUpgrade() {
    ui.upgrade.classList.remove('show');
    state.paused = false;
  }

  function refreshUpgradePanel() {
    ui.upgradeScrap.textContent = state.scrap;
    const slingBtn = ui.upgrade.querySelector('[data-upgrade="sling"]');
    const jacketBtn = ui.upgrade.querySelector('[data-upgrade="jacket"]');
    const slingCost = BALANCE.upgradeCosts.sling[state.upgrades.sling] ?? null;
    slingBtn.textContent = slingCost === null ? 'Sling Power — MAX' : `Sling Power +1 — ${slingCost} scrap`;
    slingBtn.disabled = slingCost === null || state.scrap < slingCost;
    jacketBtn.textContent = state.gear.jacket ? 'Padded Jacket — OWNED' : `Padded Jacket — ${BALANCE.upgradeCosts.jacket} scrap`;
    jacketBtn.disabled = state.gear.jacket || state.scrap < BALANCE.upgradeCosts.jacket;
  }

  ui.upgrade.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upgrade]');
    if (!btn || btn.disabled) return;
    const kind = btn.dataset.upgrade;
    if (kind === 'sling') {
      const cost = BALANCE.upgradeCosts.sling[state.upgrades.sling];
      if (cost == null || state.scrap < cost) return;
      state.scrap -= cost;
      state.upgrades.sling += 1;
      toast(`Sling upgraded to +${state.upgrades.sling}.`);
      sound.level();
    }
    if (kind === 'jacket') {
      const cost = BALANCE.upgradeCosts.jacket;
      if (state.gear.jacket || state.scrap < cost) return;
      state.scrap -= cost;
      state.gear.jacket = true;
      state.hp += 2;
      toast('Padded Jacket equipped: +2 max health.');
      sound.level();
    }
    refreshUpgradePanel();
    updateHud();
  });
  document.getElementById('upgrade-close').addEventListener('click', closeUpgrade);

  function pickupItem(p, g) {
    if (!g.visible) return;
    if (p.type === 'gear') {
      state.gear[p.gear] = true;
      if (p.gear === 'boots') toast('Grip Sneakers equipped: shallow water slows you less.');
      if (p.gear === 'lamp') toast('Quartz Headlamp equipped: brighter beam and wider pickup glow.');
    } else if (p.type === 'heal') {
      if (state.hp >= maxHp()) return;
      state.hp = Math.min(maxHp(), state.hp + p.amount);
      toast(`Snack: +${p.amount} health`);
    } else if (p.type === 'scrap') {
      state.scrap += p.amount;
      toast(`+${p.amount} scrap`);
    }
    g.visible = false;
    sound.pickup();
    updateHud();
  }

  function completeMission() {
    state.complete = true;
    if (rescueNpc) {
      rescueNpc.position.z = 2.0;
      rescueNpc.rotation.y = Math.PI;
    }
    const rescueObj = interactableObjects.get('rescue');
    if (rescueObj) {
      rescueObj.children.forEach((child) => { if (child !== rescueNpc) child.visible = false; });
    }
    sound.win();
    updateHud();
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60).toString().padStart(2, '0');
    ui.completeStats.innerHTML = `
      <div><b>${mins}:${secs}</b><span>time</span></div>
      <div><b>${state.level}</b><span>level</span></div>
      <div><b>${state.kills}</b><span>enemies</span></div>
      <div><b>${state.upgrades.sling + (state.gear.jacket ? 1 : 0)}</b><span>upgrades</span></div>`;
    setTimeout(() => ui.complete.classList.add('show'), 650);
  }

  const input = new InputManager(renderer.domElement, state, shoot, use, dash);

  // Start / utility UI.
  ui.start.addEventListener('click', async () => {
    await sound.unlock();
    state.started = true;
    ui.title.classList.add('hidden');
    toast('Mission: recover 3 seals and rescue Mara.', 3);
  });
  ui.mute.addEventListener('click', async () => {
    await sound.unlock();
    sound.enabled = !sound.enabled;
    ui.mute.textContent = sound.enabled ? 'SOUND ON' : 'SOUND OFF';
  });
  document.getElementById('replay-button').addEventListener('click', () => location.reload());

  // Resize and adaptive pixel ratio.
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.45 : 1.9);
  let fpsTimer = 0, fpsFrames = 0;
  function resize() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) state.paused = true;
    else if (!ui.upgrade.classList.contains('show')) state.paused = false;
  });

  updateHud();
  updateCamera(0.016, { yaw: 0, zoom: 0 });

  const mapCtx = ui.minimap.getContext('2d');
  let mapClock = 0;
  function drawMinimap() {
    const c = ui.minimap;
    const ctx = mapCtx;
    const b = LEVEL.bounds;
    const pad = 8;
    const sx = (c.width - pad * 2) / (b.maxX - b.minX);
    const sz = (c.height - pad * 2) / (b.maxZ - b.minZ);
    const tx = (x) => pad + (x - b.minX) * sx;
    const tz = (z) => pad + (z - b.minZ) * sz;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(4,9,12,.76)'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#5c5143';
    for (const f of LEVEL.floors) ctx.fillRect(tx(f.x - f.w / 2), tz(f.z - f.d / 2), f.w * sx, f.d * sz);
    for (const it of LEVEL.interactables) {
      if (it.type === 'seal' && !state.seals.has(it.seal)) {
        ctx.fillStyle = '#f1bc43'; ctx.beginPath(); ctx.arc(tx(it.x), tz(it.z), 3.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = state.gateOpen ? '#65b675' : '#c6584e';
    ctx.fillRect(tx(43.25) - 2, tz(0) - 5, 4, 10);
    ctx.fillStyle = '#65c7d1'; ctx.beginPath(); ctx.arc(tx(72.1), tz(0), 3, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(tx(player.position.x), tz(player.position.z));
    ctx.rotate(-player.rotation.y);
    ctx.fillStyle = '#f1e2bd';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function updatePlayer(dt) {
    state.shotCooldown = Math.max(0, state.shotCooldown - dt);
    state.invuln = Math.max(0, state.invuln - dt);
    state.dashCooldown = Math.max(0, state.dashCooldown - dt);

    let moveX = 0, moveZ = 0, magnitude = 0;
    if (state.dashTimer > 0) {
      state.dashTimer -= dt;
      moveX = state.dashDir.x;
      moveZ = state.dashDir.z;
      magnitude = 1;
      moveXZ(player, moveX * BALANCE.player.dashSpeed * dt, moveZ * BALANCE.player.dashSpeed * dt, BALANCE.player.radius);
    } else {
      const move = input.readMove();
      magnitude = Math.hypot(move.x, move.y);
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      moveX = move.x * cos + move.y * -sin;
      moveZ = move.x * -sin + move.y * -cos;
      const len = Math.hypot(moveX, moveZ);
      if (len > 0.001) { moveX /= len; moveZ /= len; }
      let speed = BALANCE.player.baseSpeed;
      if (isWetAt(player.position.x, player.position.z)) speed *= state.gear.boots ? BALANCE.player.bootsWaterSlow : BALANCE.player.waterSlow;
      if (state.paused || !state.started) speed = 0;
      moveXZ(player, moveX * speed * dt * magnitude, moveZ * speed * dt * magnitude, BALANCE.player.radius);
    }

    if (magnitude > 0.08) {
      const targetRot = Math.atan2(moveX, moveZ);
      let diff = ((targetRot - player.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      player.rotation.y += diff * (1 - Math.exp(-14 * dt));
    }
    const walkT = performance.now() * 0.012;
    const swing = magnitude * Math.sin(walkT) * 0.65;
    playerParts.legL.rotation.x = swing;
    playerParts.legR.rotation.x = -swing;
    playerParts.armL.rotation.x = -swing * 0.7;
    playerParts.armR.rotation.x = swing * 0.7;
    playerParts.body.position.y = 1.15 + Math.abs(Math.sin(walkT)) * magnitude * 0.035;
    lamp.intensity = state.gear.lamp ? 120 : 48;
    lamp.distance = state.gear.lamp ? 23 : 13;
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.dir, BALANCE.player.projectileSpeed * dt);
      let hit = false;
      const floor = floorHeightAt(p.mesh.position.x, p.mesh.position.z);
      if (!floor) hit = true;
      if (!hit) {
        for (const w of activeCollisionBoxes()) {
          if (circleHitsAabb(p.mesh.position.x, p.mesh.position.z, 0.12, w)) { hit = true; break; }
        }
      }
      if (!hit) {
        for (const [id, g] of breakables) {
          if (g.visible && dist2(p.mesh.position.x, p.mesh.position.z, g.position.x, g.position.z) < 0.75) {
            destroyCrate(id); hit = true; break;
          }
        }
      }
      if (!hit) {
        for (const e of enemyStates) {
          if (!e.alive) continue;
          const er = e.type === 'brute' ? 0.85 : e.type === 'bat' ? 0.55 : 0.65;
          if (dist2(p.mesh.position.x, p.mesh.position.z, e.group.position.x, e.group.position.z) < er) {
            e.hpNow -= p.damage;
            e.stun = 0.18;
            sound.hit();
            if (e.hpNow <= 0) killEnemy(e);
            hit = true;
            break;
          }
        }
      }
      if (hit || p.life <= 0) {
        p.mesh.removeFromParent();
        projectiles.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of enemyStates) {
      if (!e.alive) continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.stun = Math.max(0, e.stun - dt);
      const dx = player.position.x - e.group.position.x;
      const dz = player.position.z - e.group.position.z;
      const d = Math.hypot(dx, dz);
      const sameLevel = Math.abs(player.position.y - e.group.position.y) < 1.8 || e.type === 'bat';
      if (state.started && !state.paused && sameLevel && d < (e.type === 'brute' ? 11 : 8.5) && e.stun <= 0) {
        if (d > (e.type === 'brute' ? 1.2 : 0.9)) {
          const vx = dx / Math.max(0.01, d) * e.speed * dt;
          const vz = dz / Math.max(0.01, d) * e.speed * dt;
          moveXZ(e.group, vx, vz, e.type === 'brute' ? 0.75 : 0.47);
        } else if (e.attackCd <= 0) {
          damagePlayer(e.damage, e.group.position.x, e.group.position.z);
          e.attackCd = e.type === 'brute' ? 1.35 : 1.0;
        }
      }
      if (e.type === 'bat') {
        const ground = floorHeightAt(e.group.position.x, e.group.position.z)?.y ?? e.y;
        e.group.position.y = ground + 1.3 + Math.sin(state.elapsed * 4 + e.phase) * 0.28;
        e.group.rotation.y += dt * 1.7;
        const wings = e.group.userData.parts;
        if (wings) {
          const flap = Math.sin(state.elapsed * 16 + e.phase) * 0.65;
          wings.left.rotation.z = 0.35 + flap;
          wings.right.rotation.z = -0.35 - flap;
        }
      } else {
        const parts = e.group.userData.parts;
        if (parts?.legL) {
          const swing = Math.sin(state.elapsed * 8 + e.phase) * 0.35 * (d < 8 ? 1 : 0.25);
          parts.legL.rotation.x = swing;
          parts.legR.rotation.x = -swing;
        }
        if (d < 8) e.group.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  function updatePickupsAndInteractables(dt) {
    for (const [id, g] of pickupObjects) {
      if (!g.visible) continue;
      const p = g.userData.pickup;
      g.rotation.y += dt * 1.8;
      g.position.y = g.userData.baseY + Math.sin(state.elapsed * 2.8 + hash01(id) * 6) * 0.12;
      const radius = state.gear.lamp ? 1.15 : 0.9;
      if (dist2(player.position.x, player.position.z, p.x, p.z) < radius) pickupItem(p, g);
    }
    for (const [id, g] of interactableObjects) {
      if (!g.visible) continue;
      if (g.userData.spin) {
        g.rotation.y += dt * 1.3;
        g.position.y = (g.userData.interactable.y || 0) + Math.sin(state.elapsed * 2 + hash01(id) * 4) * 0.08;
      }
    }
    const nearest = nearestInteractable();
    if (nearest && state.started && !state.complete && !state.paused) {
      let label = nearest.label;
      if (nearest.type === 'gate' && state.gateOpen) label = 'Gate is open';
      ui.prompt.textContent = `${label}  •  USE / E`;
      ui.prompt.classList.add('show');
    } else ui.prompt.classList.remove('show');
  }

  function updateHazards(dt) {
    for (const h of LEVEL.hazards) {
      const g = hazardObjects.get(h.id);
      if (!g) continue;
      if (h.type === 'pendulum') {
        const offset = Math.sin(state.elapsed * h.speed) * h.amplitude;
        g.position.x = h.x + offset;
        g.rotation.z = Math.sin(state.elapsed * h.speed) * 0.24;
        if (dist2(player.position.x, player.position.z, g.position.x, g.position.z) < h.radius + BALANCE.player.radius) {
          damagePlayer(h.damage, g.position.x, g.position.z);
        }
      }
      if (h.type === 'spikes') {
        const wave = (Math.sin(state.elapsed * 2.15 + h.phase) + 1) * 0.5;
        const active = wave > 0.58;
        g.position.y = h.y + (active ? 0 : -0.48);
        if (active && circleHitsAabb(player.position.x, player.position.z, BALANCE.player.radius * 0.7, h)) {
          damagePlayer(h.damage, h.x, h.z);
        }
      }
    }
  }

  function updateGate(dt) {
    if (!gateVisual) return;
    const target = state.gateOpen ? 4.2 : 0;
    gateVisual.position.y = damp(gateVisual.position.y, target, 5.5, dt);
  }

  function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.userData.life -= dt;
      d.userData.velocity.y -= 8 * dt;
      d.position.addScaledVector(d.userData.velocity, dt);
      d.rotation.x += dt * 7;
      d.rotation.z += dt * 5;
      if (d.userData.life <= 0) { d.removeFromParent(); debris.splice(i, 1); }
    }
  }

  function updateQuality(dt) {
    fpsTimer += dt;
    fpsFrames++;
    if (fpsTimer < 2.5) return;
    const fps = fpsFrames / fpsTimer;
    fpsTimer = 0; fpsFrames = 0;
    const maxPr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.45 : 1.9);
    let next = pixelRatio;
    if (fps < 43) next = Math.max(0.85, pixelRatio - 0.15);
    else if (fps > 57) next = Math.min(maxPr, pixelRatio + 0.08);
    if (Math.abs(next - pixelRatio) > 0.02) { pixelRatio = next; resize(); }
  }

  function frame() {
    const dt = Math.min(0.04, clock.getDelta());
    const camInput = input.consumeCamera();
    if (state.started && !state.paused && !state.complete) {
      state.elapsed += dt;
      sound.update(dt);
      updatePlayer(dt);
      updateProjectiles(dt);
      updateEnemies(dt);
      updatePickupsAndInteractables(dt);
      updateHazards(dt);
      updateGate(dt);
      updateDebris(dt);
    } else {
      updatePickupsAndInteractables(dt);
      updateGate(dt);
      updateDebris(dt);
    }
    updateCamera(dt, camInput);
    mapClock -= dt;
    if (mapClock <= 0) { mapClock = 0.12; drawMinimap(); }
    updateQuality(dt);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(frame);

  // Expose a tiny read-only debug surface for smoke tests and QA.
  window.__CAVERN_CREW__ = {
    getState: () => ({
      started: state.started,
      complete: state.complete,
      level: state.level,
      xp: state.xp,
      hp: state.hp,
      scrap: state.scrap,
      seals: [...state.seals],
      gear: { ...state.gear },
      gateOpen: state.gateOpen,
      backend: state.backend,
      position: { x: player.position.x, y: player.position.y, z: player.position.z }
    }),
    shoot,
    use,
    dash
  };
}

function createKid(THREE, m, colors) {
  const g = new THREE.Group();
  const scale = colors.scale || 1;
  const shirt = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.78, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: colors.cap, roughness: 0.78, flatShading: true });
  const packMat = new THREE.MeshStandardMaterial({ color: colors.backpack, roughness: 0.82, flatShading: true });
  const skin = m.skin;
  const dark = m.black;

  function mesh(geo, mat, x, y, z, parent = g) {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const body = mesh(new THREE.BoxGeometry(0.74, 0.78, 0.38), shirt, 0, 1.15, 0);
  const head = mesh(new THREE.BoxGeometry(0.58, 0.56, 0.54), skin, 0, 1.82, 0.02);
  const cap = mesh(new THREE.BoxGeometry(0.64, 0.18, 0.59), capMat, 0, 2.12, 0);
  const brim = mesh(new THREE.BoxGeometry(0.52, 0.08, 0.26), capMat, 0, 2.06, 0.35);
  const pack = mesh(new THREE.BoxGeometry(0.54, 0.66, 0.22), packMat, 0, 1.18, -0.29);
  const armL = new THREE.Group(); armL.position.set(-0.48, 1.48, 0); g.add(armL); mesh(new THREE.BoxGeometry(0.18, 0.68, 0.2), shirt, 0, -0.28, 0, armL);
  const armR = new THREE.Group(); armR.position.set(0.48, 1.48, 0); g.add(armR); mesh(new THREE.BoxGeometry(0.18, 0.68, 0.2), shirt, 0, -0.28, 0, armR);
  const legL = new THREE.Group(); legL.position.set(-0.2, 0.78, 0); g.add(legL); mesh(new THREE.BoxGeometry(0.22, 0.72, 0.25), dark, 0, -0.31, 0, legL);
  const legR = new THREE.Group(); legR.position.set(0.2, 0.78, 0); g.add(legR); mesh(new THREE.BoxGeometry(0.22, 0.72, 0.25), dark, 0, -0.31, 0, legR);
  mesh(new THREE.BoxGeometry(0.28, 0.16, 0.46), m.orange, -0.2, 0.11, 0.11);
  mesh(new THREE.BoxGeometry(0.28, 0.16, 0.46), m.orange, 0.2, 0.11, 0.11);
  g.scale.setScalar(scale);
  g.userData.parts = { body, head, cap, brim, pack, armL, armR, legL, legR };
  return g;
}

function createEnemy(THREE, m, e) {
  const g = new THREE.Group();
  function mesh(geo, mat, x, y, z, parent = g) {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  if (e.type === 'bat') {
    const body = mesh(new THREE.OctahedronGeometry(0.35, 0), m.black, 0, 0, 0);
    const left = mesh(new THREE.BoxGeometry(0.8, 0.08, 0.4), m.red, -0.48, 0.05, 0);
    const right = mesh(new THREE.BoxGeometry(0.8, 0.08, 0.4), m.red, 0.48, 0.05, 0);
    left.rotation.z = 0.35; right.rotation.z = -0.35;
    mesh(new THREE.ConeGeometry(0.08, 0.26, 4), m.cream, -0.15, 0.28, 0);
    mesh(new THREE.ConeGeometry(0.08, 0.26, 4), m.cream, 0.15, 0.28, 0);
    g.userData.parts = { left, right, body };
    return g;
  }
  if (e.type === 'crab') {
    mesh(new THREE.SphereGeometry(0.48, 8, 5), m.rust, 0, 0.35, 0);
    for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) {
      const leg = mesh(new THREE.BoxGeometry(0.55, 0.1, 0.12), m.metal, i * 0.47, 0.2, j * 0.28);
      leg.rotation.y = j * 0.4;
    }
    mesh(new THREE.OctahedronGeometry(0.09, 0), m.gold, -0.19, 0.56, 0.39);
    mesh(new THREE.OctahedronGeometry(0.09, 0), m.gold, 0.19, 0.56, 0.39);
    return g;
  }
  const brute = e.type === 'brute';
  const jacket = new THREE.MeshStandardMaterial({ color: brute ? 0x6d2b2a : 0x443f4e, roughness: 0.8, flatShading: true });
  const shirt = new THREE.MeshStandardMaterial({ color: brute ? 0xc08b4c : 0x8a3d45, roughness: 0.8, flatShading: true });
  const s = brute ? 1.28 : 1;
  const body = mesh(new THREE.BoxGeometry(0.82 * s, 0.84 * s, 0.42 * s), jacket, 0, 1.1 * s, 0);
  mesh(new THREE.BoxGeometry(0.61 * s, 0.58 * s, 0.56 * s), m.skin, 0, 1.8 * s, 0.02);
  mesh(new THREE.BoxGeometry(0.66 * s, 0.14 * s, 0.6 * s), shirt, 0, 2.09 * s, 0);
  const legL = new THREE.Group(); legL.position.set(-0.22 * s, 0.72 * s, 0); g.add(legL); mesh(new THREE.BoxGeometry(0.24 * s, 0.68 * s, 0.27 * s), m.black, 0, -0.3 * s, 0, legL);
  const legR = new THREE.Group(); legR.position.set(0.22 * s, 0.72 * s, 0); g.add(legR); mesh(new THREE.BoxGeometry(0.24 * s, 0.68 * s, 0.27 * s), m.black, 0, -0.3 * s, 0, legR);
  g.userData.parts = { body, legL, legR };
  return g;
}
