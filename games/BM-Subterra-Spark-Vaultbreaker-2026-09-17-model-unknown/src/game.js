import * as THREE from 'three';
import { color, time, sin, uv } from 'three/tsl';

const $ = (s) => document.querySelector(s);
const host = $('#game-host');
const ui = {
  badge: $('#renderer-badge'), healthBar: $('#health-bar'), healthText: $('#health-text'),
  boostBar: $('#boost-bar'), xpBar: $('#xp-bar'), levelText: $('#level-text'), objective: $('#objective'),
  modeText: $('#mode-text'), scrapText: $('#scrap-text'), weaponText: $('#weapon-text'),
  prompt: $('#prompt'), toast: $('#toast'), startCard: $('#start-card'), completeCard: $('#complete-card'),
  completeSummary: $('#complete-summary'), startButton: $('#start-button'), restartButton: $('#restart-button'),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07161c);
scene.fog = new THREE.FogExp2(0x07161c, 0.021);

const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
await renderer.init();
renderer.shadowMap.enabled = true;
ui.badge.textContent = renderer.backend?.isWebGPUBackend ? 'WEBGPU · R186' : 'WEBGL2 · R186';

const clock = new THREE.Timer();
clock.connect(document);

const hemi = new THREE.HemisphereLight(0xb9f4ff, 0x17210f, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b7, 3.5);
sun.position.set(-16, 24, -10);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0005;
scene.add(sun);

const fillLight = new THREE.PointLight(0x25d9ff, 40, 28, 2);
fillLight.position.set(-8, 7, 0);
scene.add(fillLight);
const bunkerLight = new THREE.PointLight(0xffa644, 32, 24, 2);
bunkerLight.position.set(0, 5, 80);
scene.add(bunkerLight);
const bossLight = new THREE.PointLight(0xff5252, 35, 25, 2);
bossLight.position.set(26, 5, 0);
scene.add(bossLight);

const mat = {
  soil: new THREE.MeshStandardMaterial({ color: 0x314a31, roughness: .92, metalness: .02 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x547d36, roughness: .86 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x334348, roughness: .94 }),
  darkRock: new THREE.MeshStandardMaterial({ color: 0x1c2a2f, roughness: .96 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x455d64, roughness: .45, metalness: .72 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x1c2d34, roughness: .38, metalness: .8 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf17a33, roughness: .48, metalness: .35 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x28cbe0, emissive: 0x083f46, emissiveIntensity: 1.7, roughness: .35, metalness: .35 }),
  lime: new THREE.MeshStandardMaterial({ color: 0xa8e85c, emissive: 0x1e3e08, emissiveIntensity: 1.1, roughness: .5 }),
  magenta: new THREE.MeshStandardMaterial({ color: 0xe65bc5, emissive: 0x58154c, emissiveIntensity: 1.5, roughness: .35 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0xd5543e, roughness: .48, metalness: .55 }),
  enemyDark: new THREE.MeshStandardMaterial({ color: 0x4b2527, roughness: .5, metalness: .62 }),
  white: new THREE.MeshStandardMaterial({ color: 0xd9f5f2, roughness: .45, metalness: .15 }),
  water: new THREE.MeshPhysicalMaterial({ color: 0x0b6d78, emissive: 0x062d34, emissiveIntensity: 1.1, transparent: true, opacity: .72, roughness: .18, metalness: .05, clearcoat: .7 }),
};

const gateMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
const gateWave = sin(time.mul(4.0).add(uv().y.mul(28.0))).mul(0.14).add(0.74);
gateMaterial.colorNode = color(0x47eaff).mul(gateWave);
gateMaterial.opacityNode = gateWave.mul(0.48);

const staticWorld = new THREE.Group();
staticWorld.name = 'StaticWorld';
scene.add(staticWorld);
const staticBundle = THREE.BundleGroup ? new THREE.BundleGroup() : new THREE.Group();
staticBundle.name = 'RockRenderBundle';
scene.add(staticBundle);

function mesh(geometry, material, parent = staticWorld) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function block(x, y, z, sx, sy, sz, material, parent = staticWorld) {
  const m = mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent);
  m.position.set(x, y, z);
  return m;
}
function cyl(x, y, z, r, h, material, parent = staticWorld, sides = 10) {
  const m = mesh(new THREE.CylinderGeometry(r, r, h, sides), material, parent);
  m.position.set(x, y, z);
  return m;
}
function rock(x, z, scale = 1, material = mat.rock) {
  const m = mesh(new THREE.IcosahedronGeometry(1.15 * scale, 0), material, staticBundle);
  m.position.set(x, 0.4 * scale, z);
  m.rotation.set(Math.random() * .3, Math.random() * Math.PI, Math.random() * .25);
  m.scale.set(1, .8 + Math.random() * .45, 1.05 + Math.random() * .3);
  return m;
}
function canvasLabel(text, fg = '#d9fbff', bg = '#0a1f26') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#48dcec'; ctx.lineWidth = 8; ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
  ctx.font = '900 50px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg;
  ctx.fillText(text, c.width / 2, c.height / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: t, transparent: true });
  return material;
}
function sign(text, x, z, rotY = 0) {
  const g = new THREE.Group();
  const board = mesh(new THREE.PlaneGeometry(3.1, .78), canvasLabel(text), g);
  board.position.y = 1.7;
  const post = block(0, .8, 0, .15, 1.6, .15, mat.darkMetal, g);
  post.castShadow = true;
  g.position.set(x, 0, z); g.rotation.y = rotY;
  staticWorld.add(g);
  return g;
}

const colliders = [];
function addCollider(x, z, w, d, area = 'external', id = '') {
  const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, area, id, enabled: true };
  colliders.push(c); return c;
}
function hitCollider(x, z, r, area) {
  for (const c of colliders) {
    if (!c.enabled || c.area !== area) continue;
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

// Exterior floor and water channels.
block(0, -0.65, 0, 70, 1, 38, mat.soil);
block(-5, -0.06, -14.5, 60, .18, 3.5, mat.water);
block(7, -0.08, 14.2, 52, .16, 3.2, mat.water);
for (let x = -30; x <= 32; x += 3.2) {
  rock(x + (Math.random() - .5), -18 + Math.random() * .9, .9 + Math.random() * .65, mat.darkRock);
  rock(x + (Math.random() - .5), 18 - Math.random() * .9, .9 + Math.random() * .65, mat.darkRock);
}
for (let z = -15; z <= 15; z += 3.4) {
  rock(-34 + Math.random() * .8, z, .95 + Math.random() * .65, mat.darkRock);
  rock(34 - Math.random() * .8, z, .95 + Math.random() * .65, mat.darkRock);
}
// World-edge collision.
addCollider(0, -19, 72, 2); addCollider(0, 19, 72, 2); addCollider(-35, 0, 2, 40); addCollider(35, 0, 2, 40);

// Start platform.
cyl(-27, -.25, 0, 4.2, .55, mat.metal, staticWorld, 14);
for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
  const lamp = new THREE.PointLight(0x44e9ff, 2.4, 5, 2);
  lamp.position.set(-27 + Math.cos(a) * 3, .8, Math.sin(a) * 3); scene.add(lamp);
  const p = cyl(-27 + Math.cos(a) * 3, .25, Math.sin(a) * 3, .08, 1, mat.cyan);
  p.castShadow = false;
}
sign('VAULT →', -23, -4.8, -.25);

// First choke point: rocky wall and destructible crystals.
for (let z = -16; z <= -3.6; z += 2.2) { rock(-11 + Math.random() * .7, z, 1.2); addCollider(-11, z, 2.6, 2.4); }
for (let z = 3.6; z <= 16; z += 2.2) { rock(-11 + Math.random() * .7, z, 1.2); addCollider(-11, z, 2.6, 2.4); }
const crystalGroup = new THREE.Group(); scene.add(crystalGroup);
for (let i = 0; i < 8; i++) {
  const c = mesh(new THREE.OctahedronGeometry(.65 + Math.random() * .28, 0), mat.magenta, crystalGroup);
  c.position.set(-11 + (Math.random() - .5) * 1.4, .55 + Math.random() * .5, (Math.random() - .5) * 4.2);
  c.rotation.set(Math.random(), Math.random(), Math.random());
}
const crystalCollider = addCollider(-11, 0, 2.8, 5.4, 'external', 'crystalGate');
const crystals = { hp: 58, maxHp: 58, group: crystalGroup, radius: 2.8, alive: true };

// Bridge and bunker route.
for (let i = 0; i < 7; i++) block(-5.6 + i * 1.6, .02, 7.4, 1.4, .3, 5.8, i % 2 ? mat.metal : mat.darkMetal);
block(-5.3, .75, 4.65, 12, .16, .16, mat.metal); block(-5.3, .75, 10.15, 12, .16, .16, mat.metal);
addCollider(-5.3, 4.65, 12, .22); addCollider(-5.3, 10.15, 12, .22);
for (let x = -10.5; x < .5; x += 1.6) { block(x, .38, 4.65, .12, .75, .12, mat.metal); block(x, .38, 10.15, .12, .75, .12, mat.metal); }
sign('VAULT 03', -1.2, 11.4, -.55);

// Bunker exterior with stairs and rails.
block(3.5, .65, 12.8, 8.2, 1.3, 5.8, mat.darkMetal);
block(3.5, 1.55, 13.3, 6.8, .8, 4.2, mat.metal);
for (let i = 0; i < 4; i++) block(3.5, .1 + i * .16, 9.4 + i * .65, 3.4, .18, .7, mat.metal);
block(1.65, .72, 10.5, .12, 1.15, 3.5, mat.orange); block(5.35, .72, 10.5, .12, 1.15, 3.5, mat.orange);
const hatch = block(3.5, 1.1, 10.92, 2.1, 2.1, .22, mat.cyan, scene);
hatch.castShadow = false;
addCollider(3.5, 13, 8.4, 5.4);

// East gate wall, force field and terminal.
for (let z = -16; z <= -3.2; z += 2.5) { rock(14, z, 1.15); addCollider(14, z, 2.6, 2.8); }
for (let z = 3.2; z <= 16; z += 2.5) { rock(14, z, 1.15); addCollider(14, z, 2.6, 2.8); }
const forceField = mesh(new THREE.PlaneGeometry(5.4, 3.6), gateMaterial, scene);
forceField.position.set(14, 1.7, 0); forceField.rotation.y = Math.PI / 2; forceField.castShadow = false;
const gateCollider = addCollider(14, 0, 1.1, 5.5, 'external', 'energyGate');
const terminal = block(11.4, .65, -3.2, 1.1, 1.3, 1.1, mat.darkMetal, scene);
const termGlow = block(11.4, 1.02, -2.62, .65, .42, .08, mat.cyan, scene); termGlow.castShadow = false;
sign('CORE LIFT →', 16.8, 5.6, .45);

// Upgrade station and optional side cache area.
const upgradeStation = new THREE.Group(); scene.add(upgradeStation); upgradeStation.position.set(8.5, 0, -11);
block(0, .35, 0, 2.8, .7, 2.8, mat.metal, upgradeStation); cyl(0, .95, 0, .55, 1.2, mat.orange, upgradeStation, 8);
const upgradeGlow = cyl(0, 1.65, 0, .28, .18, mat.cyan, upgradeStation, 12); upgradeGlow.rotation.x = Math.PI / 2;
sign('TINKER PAD', 5.4, -12.6, .25);

// Boss arena.
cyl(26, -.34, 0, 9.4, .62, mat.darkMetal, staticWorld, 18);
for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
  const rr = 9.2; const x = 26 + Math.cos(a) * rr; const z = Math.sin(a) * rr;
  const p = cyl(x, .55, z, .18, 1.3, a % (Math.PI / 3) < .1 ? mat.orange : mat.metal);
  p.rotation.z = (Math.random() - .5) * .15;
}

// Interior room at z = 80.
block(0, -.55, 80, 21, 1, 19, mat.darkMetal);
block(0, 2, 70.6, 21, 4.3, .8, mat.rock); block(0, 2, 89.4, 21, 4.3, .8, mat.rock);
block(-10.1, 2, 80, .8, 4.3, 19, mat.rock); block(10.1, 2, 80, .8, 4.3, 19, mat.rock);
addCollider(0, 70.5, 22, 1, 'interior'); addCollider(0, 89.5, 22, 1, 'interior');
addCollider(-10.2, 80, 1, 20, 'interior'); addCollider(10.2, 80, 1, 20, 'interior');
for (const p of [[-5,76],[5,76],[-5,84],[5,84]]) {
  cyl(p[0], .8, p[1], .8, 1.6, mat.metal); addCollider(p[0], p[1], 1.7, 1.7, 'interior');
}
block(0, .08, 80, 5.2, .18, 5.2, mat.metal);
const interiorExit = block(0, 1.15, 88.8, 2.3, 2.3, .25, mat.cyan, scene); interiorExit.castShadow = false;
sign('CAPACITOR', -6.8, 86.8, 0);

function createRover() {
  const g = new THREE.Group();
  const chassis = mesh(new THREE.BoxGeometry(2.25, .62, 3.0), mat.cyan, g); chassis.position.y = .62;
  const belly = mesh(new THREE.BoxGeometry(1.75, .45, 2.2), mat.darkMetal, g); belly.position.y = .35;
  const canopy = mesh(new THREE.BoxGeometry(1.35, .58, 1.28), new THREE.MeshStandardMaterial({ color: 0x74e4e5, emissive: 0x092f36, emissiveIntensity: 1.2, roughness: .15, metalness: .25 }), g); canopy.position.set(0, 1.08, -.15);
  for (const x of [-1.15, 1.15]) for (const z of [-1.02, 1.02]) {
    const w = mesh(new THREE.CylinderGeometry(.48, .48, .42, 10), mat.darkMetal, g); w.rotation.z = Math.PI / 2; w.position.set(x, .43, z);
    const hub = mesh(new THREE.CylinderGeometry(.19, .19, .46, 10), mat.orange, g); hub.rotation.z = Math.PI / 2; hub.position.set(x, .43, z);
  }
  const turret = new THREE.Group(); turret.position.y = 1.34; g.add(turret);
  const cap = cyl(0, 0, 0, .48, .25, mat.darkMetal, turret, 10); cap.position.y = 0;
  const barrel = mesh(new THREE.BoxGeometry(.24, .22, 1.7), mat.orange, turret); barrel.position.z = .85;
  const muzzle = mesh(new THREE.BoxGeometry(.36, .35, .34), mat.cyan, turret); muzzle.position.z = 1.72;
  g.userData.turret = turret; g.userData.muzzle = muzzle;
  return g;
}
function createPilot() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(.72, .85, .45), mat.white, g); body.position.y = .92;
  const chest = mesh(new THREE.BoxGeometry(.76, .35, .5), mat.orange, g); chest.position.y = 1.05;
  const head = mesh(new THREE.BoxGeometry(.55, .5, .52), mat.cyan, g); head.position.y = 1.62;
  const gun = mesh(new THREE.BoxGeometry(.2, .2, .9), mat.darkMetal, g); gun.position.set(.42, 1.05, .3);
  const pack = mesh(new THREE.BoxGeometry(.62, .65, .28), mat.darkMetal, g); pack.position.set(0, .98, -.36);
  g.userData.gun = gun;
  return g;
}
const rover = createRover(); scene.add(rover); rover.position.set(-27, 0, 0);
const pilot = createPilot(); scene.add(pilot); pilot.visible = false;

const player = {
  mode: 'rover', area: 'external', health: 100, maxHealth: 100, boost: 100,
  level: 1, xp: 0, nextXp: 40, scrap: 0, damageMul: 1, weaponUpgraded: false,
  invuln: 0, fireCooldown: 0, checkpoint: new THREE.Vector3(-27, 0, 0), deaths: 0,
};
const mission = { stage: 0, capacitor: false, gateOpen: false, interiorSpawned: false, capacitorSpawned: false, complete: false, startTime: 0 };

const input = {
  keys: new Set(), move: new THREE.Vector2(), aimStick: new THREE.Vector2(), mouseNdc: new THREE.Vector2(),
  fire: false, boost: false, actionPressed: false, pointerAim: false,
};
let aimDir = new THREE.Vector3(0, 0, 1);
let cameraDistance = 12.5;
let gameStarted = false;
let audio = null;
let toastTimer = 0;

function setupAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq = 300, duration = .06, type = 'square', gain = .025, slide = 0) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audio.currentTime + duration);
  g.gain.setValueAtTime(gain, audio.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
}
function toast(text, seconds = 1.55) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastTimer = seconds; }
function objective(text) { ui.objective.textContent = text; }

const projectiles = [];
const enemyShots = [];
const particles = [];
const enemies = [];
const pickups = [];
let boss = null;

function spawnBurst(position, hex, count = 7, scale = .12) {
  const material = new THREE.MeshBasicMaterial({ color: hex, transparent: true });
  for (let i = 0; i < count; i++) {
    const m = mesh(new THREE.TetrahedronGeometry(scale * (.7 + Math.random() * .8), 0), material.clone(), scene);
    m.castShadow = false; m.position.copy(position).add(new THREE.Vector3((Math.random()-.5)*.5, .3 + Math.random()*.7, (Math.random()-.5)*.5));
    particles.push({ mesh: m, vel: new THREE.Vector3((Math.random()-.5)*4, 1.5+Math.random()*3, (Math.random()-.5)*4), life: .55 + Math.random()*.55, max: 1.1 });
  }
}

function makeDrone(type = 'skitter') {
  const g = new THREE.Group();
  if (type === 'turret') {
    const base = cyl(0, .35, 0, .65, .7, mat.enemyDark, g, 8);
    const dome = mesh(new THREE.OctahedronGeometry(.54, 0), mat.enemy, g); dome.position.y = .85;
    const gun = mesh(new THREE.BoxGeometry(.2,.2,1.1), mat.orange,g); gun.position.set(0,.85,.45); g.userData.gun = gun;
  } else {
    const body = mesh(new THREE.BoxGeometry(1.05,.48,1.3), mat.enemy,g); body.position.y=.55;
    const eye = mesh(new THREE.BoxGeometry(.38,.2,.18), mat.magenta,g); eye.position.set(0,.67,.72);
    for (const x of [-.65,.65]) for (const z of [-.42,.42]) {
      const leg = mesh(new THREE.BoxGeometry(.5,.16,.18),mat.enemyDark,g); leg.position.set(x,.25,z); leg.rotation.z = x < 0 ? -.25 : .25;
    }
  }
  return g;
}
function spawnEnemy(x, z, type='skitter', area='external') {
  const group = makeDrone(type); group.position.set(x,0,z); scene.add(group);
  const e = { group, type, area, hp: type==='turret'?48:34, maxHp: type==='turret'?48:34, speed: type==='turret'?0:2.15, radius:.72, fireTimer: .4 + Math.random()*1.3, dead:false, touchTimer:0 };
  enemies.push(e); return e;
}
spawnEnemy(-5, -3.8, 'skitter');
spawnEnemy(-2, 11.8, 'turret');
spawnEnemy(5.4, -6.2, 'skitter');
spawnEnemy(8, 5.6, 'skitter');
spawnEnemy(10.4, -12.2, 'turret');

function spawnInteriorWave() {
  if (mission.interiorSpawned) return;
  mission.interiorSpawned = true;
  for (const p of [[-6,75.2],[0,74.7],[6,76],[-6,83.8],[0,85.2],[6,83.4]]) spawnEnemy(p[0],p[1],Math.random()<.28?'turret':'skitter','interior');
}

function createBoss() {
  const g = new THREE.Group();
  const body = mesh(new THREE.DodecahedronGeometry(2.3, 0), mat.enemyDark, g); body.position.y = 1.8; body.scale.set(1.25,.8,1.25);
  const ring = mesh(new THREE.TorusGeometry(2.35,.26,8,16),mat.orange,g); ring.rotation.x = Math.PI/2; ring.position.y=1.8;
  const core = mesh(new THREE.OctahedronGeometry(.88,0),mat.magenta,g); core.position.set(0,1.8,2.05);
  const drill = mesh(new THREE.ConeGeometry(.8,2.8,9),mat.metal,g); drill.rotation.x=Math.PI/2; drill.position.set(0,1.5,3.05);
  for (let a=0;a<Math.PI*2;a+=Math.PI/3) {
    const leg = mesh(new THREE.BoxGeometry(.42,.5,2.8),mat.enemy,g); leg.position.set(Math.sin(a)*2.2,.65,Math.cos(a)*2.2); leg.rotation.y=a;
  }
  g.position.set(26,0,0); scene.add(g);
  boss = { group:g, core, ring, hp:360, maxHp:360, radius:2.6, fireTimer:1.4, chargeTimer:2.8, coreOpen:0, phase:1, dead:false, area:'external', type:'boss' };
  enemies.push(boss);
  toast('WARNING · M.O.L.E. EXCAVATION ENGINE', 2.2); beep(90,.55,'sawtooth',.05,90);
  showBossBar(true);
}

function showBossBar(show) {
  let el = $('#boss-bar');
  if (!el) {
    el = document.createElement('div'); el.id='boss-bar';
    el.style.cssText='position:fixed;z-index:6;left:50%;top:18px;transform:translateX(-50%);width:min(420px,62vw);height:10px;border-radius:8px;background:rgba(0,0,0,.45);border:1px solid rgba(255,160,120,.45);overflow:hidden;display:none;';
    el.innerHTML='<i style="display:block;width:100%;height:100%;background:linear-gradient(90deg,#ff754d,#ff4e9c)"></i>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'block' : 'none';
}
function updateBossBar() { if (boss) { const el=$('#boss-bar i'); if(el) el.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`; } }

function spawnPickup(x,z,type='scrap',area='external',amount=3) {
  const g = new THREE.Group();
  const material = type==='health'?mat.lime:type==='capacitor'?mat.cyan:mat.orange;
  const shape = type==='capacitor' ? new THREE.OctahedronGeometry(.65,0) : new THREE.DodecahedronGeometry(.35,0);
  const m = mesh(shape,material,g); m.position.y=.7;
  if(type==='capacitor') { const r=mesh(new THREE.TorusGeometry(.85,.08,6,16),mat.white,g); r.rotation.x=Math.PI/2; r.position.y=.7; }
  g.position.set(x,0,z); scene.add(g);
  pickups.push({group:g,type,area,amount,t:Math.random()*6,dead:false});
}
spawnPickup(-20,-10,'scrap','external',4);
spawnPickup(-4,-11,'health','external',24);
spawnPickup(7,13,'scrap','external',5);
spawnPickup(10,-14,'scrap','external',5);

function firePlayer() {
  if (player.fireCooldown > 0 || !gameStarted || mission.complete) return;
  player.fireCooldown = player.mode==='rover' ? .19 : .16;
  const source = player.mode==='rover' ? rover : pilot;
  const origin = new THREE.Vector3();
  if (player.mode==='rover') rover.userData.muzzle.getWorldPosition(origin);
  else { origin.copy(pilot.position); origin.y=1.05; origin.addScaledVector(aimDir,.65); }
  const size = player.mode==='rover' ? .18 : .12;
  const pmesh = mesh(new THREE.OctahedronGeometry(size,0), player.mode==='rover'?mat.cyan:mat.orange, scene); pmesh.castShadow=false; pmesh.position.copy(origin);
  const damage = (player.mode==='rover'?18:11) * player.damageMul * (player.weaponUpgraded?1.24:1);
  projectiles.push({mesh:pmesh,vel:aimDir.clone().multiplyScalar(player.mode==='rover'?25:21),life:1.35,damage,radius:size+.15,area:player.area});
  beep(player.mode==='rover'?190:310,.045,'square',.017,80);
}
function fireEnemy(e, direction, speed=10, damage=11) {
  const m=mesh(new THREE.OctahedronGeometry(.16,0),mat.magenta,scene); m.castShadow=false; m.position.copy(e.group.position); m.position.y=1;
  enemyShots.push({mesh:m,vel:direction.clone().multiplyScalar(speed),life:2.8,damage,area:e.area,radius:.25});
  beep(120,.04,'sawtooth',.007,35);
}

function activeObject() { return player.mode==='rover' ? rover : pilot; }
function activeRadius() { return player.mode==='rover' ? 1.15 : .44; }
function currentBounds() { return player.area==='interior' ? {minX:-9.4,maxX:9.4,minZ:71.3,maxZ:88.7} : {minX:-33.2,maxX:33.2,minZ:-17.2,maxZ:17.2}; }
function moveEntity(obj, delta, radius=activeRadius()) {
  const b=currentBounds();
  let nx=Math.max(b.minX+radius,Math.min(b.maxX-radius,obj.position.x+delta.x));
  let nz=Math.max(b.minZ+radius,Math.min(b.maxZ-radius,obj.position.z+delta.z));
  if(!hitCollider(nx,obj.position.z,radius,player.area)) obj.position.x=nx;
  if(!hitCollider(obj.position.x,nz,radius,player.area)) obj.position.z=nz;
}
function distanceXZ(a,b) { const dx=a.x-b.x,dz=a.z-b.z; return Math.hypot(dx,dz); }

function gainXP(amount) {
  player.xp += amount;
  while (player.xp >= player.nextXp && player.level < 4) {
    player.xp -= player.nextXp; player.level++; player.nextXp = Math.round(player.nextXp * 1.55);
    player.maxHealth += 15; player.health = Math.min(player.maxHealth, player.health + 28); player.damageMul *= 1.1;
    toast(`LEVEL ${player.level} · HULL +15 · DAMAGE +10%`,1.8); beep(520,.22,'triangle',.04,250);
  }
}
function killEnemy(e) {
  if (e.dead) return; e.dead=true; scene.remove(e.group); spawnBurst(e.group.position,e.type==='boss'?0xff5a66:0xff8e54,e.type==='boss'?24:8,e.type==='boss'?.22:.11);
  if(e.type==='boss') { completeMission(); return; }
  gainXP(e.area==='interior'?12:10); player.scrap += e.type==='turret'?3:2;
  if (Math.random()<.18) spawnPickup(e.group.position.x,e.group.position.z,'health',e.area,18);
  if(e.area==='interior') maybeExposeCapacitor();
}
function maybeExposeCapacitor() {
  const alive = enemies.some(e=>!e.dead && e.area==='interior' && e.type!=='boss');
  if(!alive && mission.interiorSpawned && !mission.capacitorSpawned) {
    mission.capacitorSpawned=true; spawnPickup(0,80,'capacitor','interior',1); objective('Vault clear. Grab the exposed capacitor, then return to the surface.'); toast('VAULT SECURITY OFFLINE');
  }
}
function damagePlayer(amount) {
  if(player.invuln>0 || mission.complete) return;
  player.invuln=.34; player.health-=amount; beep(80,.11,'square',.04,-30);
  spawnBurst(activeObject().position,0xff4f55,5,.08);
  if(player.health<=0) respawnPlayer();
}
function respawnPlayer() {
  player.deaths++; player.health=player.maxHealth; player.boost=100; player.scrap=Math.max(0,player.scrap-2);
  for(const p of enemyShots) scene.remove(p.mesh); enemyShots.length=0;
  if(player.area==='interior') {
    player.mode='pilot'; rover.visible=true; pilot.visible=true; pilot.position.set(0,0,86.5);
  } else {
    player.mode='rover'; rover.visible=true; pilot.visible=false; rover.position.copy(player.checkpoint);
  }
  if(boss && !boss.dead) boss.hp=Math.min(boss.maxHp,boss.hp+50);
  toast('RECONSTRUCTED · 2 SCRAP LOST',1.8); updateModeUI();
}

function dismount() {
  if(player.mode!=='rover') return;
  player.mode='pilot'; pilot.visible=true; pilot.position.copy(rover.position).add(new THREE.Vector3(1.55,0,.2)); pilot.rotation.copy(rover.rotation); updateModeUI(); toast('PILOT MODE');
}
function mount() {
  if(player.mode!=='pilot' || player.area!=='external') return;
  if(distanceXZ(pilot.position,rover.position)>2.3) return;
  player.mode='rover'; pilot.visible=false; updateModeUI(); toast('CRAWLER LINKED');
}
function enterBunker() {
  player.area='interior'; player.mode='pilot'; pilot.visible=true; pilot.position.set(0,0,86.4); pilot.rotation.set(0,Math.PI,0); spawnInteriorWave();
  mission.stage=Math.max(mission.stage,2); objective('Clear Vault 03. Recover its phase capacitor.'); toast('VAULT 03 · TOP-DOWN COMBAT');
}
function exitBunker() {
  player.area='external'; pilot.position.set(3.5,0,9.2); pilot.rotation.set(0,0,0); toast('SURFACE LINK RESTORED');
  if(mission.capacitor) objective('Bring the phase capacitor to the east gate terminal.');
}
function openGate() {
  if(mission.gateOpen) return;
  mission.gateOpen=true; gateCollider.enabled=false; forceField.visible=false; mission.stage=4; player.checkpoint.set(16.6,0,0);
  objective('Gate open. Cross into the core-lift arena and destroy the M.O.L.E. engine.'); toast('PHASE GATE DISCHARGED',1.8); beep(210,.4,'sawtooth',.04,300);
}
function buyUpgrade() {
  if(player.weaponUpgraded) { toast('COIL BARREL ALREADY FITTED'); return; }
  if(player.scrap<12) { toast(`COIL BARREL NEEDS 12 SCRAP · YOU HAVE ${player.scrap}`); return; }
  player.scrap-=12; player.weaponUpgraded=true; toast('COIL BARREL MK II · DAMAGE +24%',1.8); beep(410,.18,'square',.035,190);
}
function completeMission() {
  mission.complete=true; gameStarted=false; showBossBar(false); objective('Mission complete. Core-lift route secured.');
  const seconds=Math.max(1,Math.floor((performance.now()-mission.startTime)/1000));
  ui.completeSummary.textContent=`Route cleared in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} · Level ${player.level} · ${player.deaths} reconstruction${player.deaths===1?'':'s'} · ${player.weaponUpgraded?'Coil Barrel Mk II fitted':'stock weapon clear'}.`;
  setTimeout(()=>ui.completeCard.classList.add('show'),500); beep(460,.5,'triangle',.045,420);
}

function interact() {
  const obj=activeObject();
  if(player.area==='interior') {
    if(player.mode==='pilot' && distanceXZ(pilot.position,new THREE.Vector3(0,0,88.4))<2.1) exitBunker();
    return;
  }
  if(player.mode==='rover') { dismount(); return; }
  if(distanceXZ(pilot.position,rover.position)<2.25) { mount(); return; }
  if(distanceXZ(pilot.position,new THREE.Vector3(3.5,0,10.2))<2.15) { enterBunker(); return; }
  if(distanceXZ(pilot.position,new THREE.Vector3(11.4,0,-3.2))<2.1 && mission.capacitor) { openGate(); return; }
  if(distanceXZ(pilot.position,upgradeStation.position)<2.15) { buyUpgrade(); return; }
}

function updatePrompt() {
  let text='';
  if(player.area==='interior' && player.mode==='pilot' && distanceXZ(pilot.position,new THREE.Vector3(0,0,88.4))<2.25) text='ACTION · RETURN TO SURFACE';
  else if(player.area==='external' && player.mode==='rover') {
    if(distanceXZ(rover.position,new THREE.Vector3(3.5,0,10.2))<4.4) text='ACTION · DISMOUNT FOR VAULT ACCESS';
    else text='ACTION · DISMOUNT';
  } else if(player.area==='external' && player.mode==='pilot') {
    if(distanceXZ(pilot.position,rover.position)<2.35) text='ACTION · BOARD CRAWLER';
    else if(distanceXZ(pilot.position,new THREE.Vector3(3.5,0,10.2))<2.3) text='ACTION · ENTER VAULT 03';
    else if(distanceXZ(pilot.position,new THREE.Vector3(11.4,0,-3.2))<2.3) text=mission.capacitor?'ACTION · INSTALL PHASE CAPACITOR':'GATE TERMINAL · CAPACITOR MISSING';
    else if(distanceXZ(pilot.position,upgradeStation.position)<2.35) text=player.weaponUpgraded?'TINKER PAD · COIL BARREL FITTED':`ACTION · COIL BARREL MK II · 12 SCRAP`;
  }
  ui.prompt.textContent=text; ui.prompt.classList.toggle('show',!!text);
}

function updateObjectiveProgress() {
  if(mission.stage===0 && !crystals.alive) { mission.stage=1; objective('Crystal nest shattered. Find Vault 03 on the upper route and go inside on foot.'); toast('ROUTE OPEN · VAULT SIGNAL FOUND'); }
  if(mission.stage<4 && mission.gateOpen) mission.stage=4;
  if(mission.gateOpen && !boss && activeObject().position.x>18 && player.area==='external') createBoss();
}

function damageEnemy(e, amount, hitPos) {
  if(e.dead) return;
  if(e.type==='boss') {
    const armored = e.coreOpen<=0;
    e.hp -= amount * (armored ? .46 : 1.0);
    e.coreOpen=Math.max(e.coreOpen,.08);
    spawnBurst(hitPos,armored?0xffa35b:0xff4bc4,armored?3:6,.07);
    if(armored && Math.random()<.25) toast('ARMORED · HIT AFTER ITS CHARGE TO EXPOSE CORE',.7);
    if(e.hp<=0) killEnemy(e); updateBossBar(); return;
  }
  e.hp-=amount; spawnBurst(hitPos,0xff875f,3,.06); if(e.hp<=0) killEnemy(e);
}

function updateProjectiles(dt) {
  for(let i=projectiles.length-1;i>=0;i--) {
    const p=projectiles[i]; p.life-=dt; p.mesh.position.addScaledVector(p.vel,dt);
    let remove=p.life<=0;
    if(!remove && p.area===player.area) {
      if(crystals.alive && p.area==='external' && distanceXZ(p.mesh.position,crystals.group.position)<0) {} // group origin is not useful; handled below.
      if(crystals.alive && p.area==='external' && Math.abs(p.mesh.position.x+11)<2.1 && Math.abs(p.mesh.position.z)<3.1) {
        crystals.hp-=p.damage; spawnBurst(p.mesh.position,0xf16bd4,4,.07); remove=true;
        if(crystals.hp<=0) { crystals.alive=false; crystalCollider.enabled=false; scene.remove(crystals.group); spawnBurst(new THREE.Vector3(-11,1,0),0xff64df,20,.16); beep(150,.32,'sawtooth',.05,260); }
      }
      if(!remove) for(const e of enemies) {
        if(e.dead || e.area!==p.area) continue;
        const yOk=Math.abs(p.mesh.position.y-(e.type==='boss'?1.4:.6))<2.5;
        if(yOk && distanceXZ(p.mesh.position,e.group.position)<e.radius+p.radius) { damageEnemy(e,p.damage,p.mesh.position); remove=true; break; }
      }
    }
    if(remove) { scene.remove(p.mesh); projectiles.splice(i,1); }
  }
  for(let i=enemyShots.length-1;i>=0;i--) {
    const p=enemyShots[i]; p.life-=dt; p.mesh.position.addScaledVector(p.vel,dt);
    let remove=p.life<=0;
    if(!remove && p.area===player.area && distanceXZ(p.mesh.position,activeObject().position)<activeRadius()+p.radius) { damagePlayer(p.damage); remove=true; }
    if(remove){scene.remove(p.mesh);enemyShots.splice(i,1);}
  }
}

function updateEnemies(dt) {
  const target=activeObject();
  for(const e of enemies) {
    if(e.dead || e.area!==player.area) continue;
    if(e.type==='boss') { updateBoss(e,dt,target); continue; }
    e.fireTimer-=dt; e.touchTimer=Math.max(0,e.touchTimer-dt);
    const to=new THREE.Vector3(target.position.x-e.group.position.x,0,target.position.z-e.group.position.z); const dist=to.length();
    if(dist<11.5) {
      to.normalize();
      if(e.speed>0 && dist>2.3) {
        const old=e.group.position.clone(); e.group.position.addScaledVector(to,e.speed*dt);
        if(hitCollider(e.group.position.x,e.group.position.z,e.radius,e.area)) e.group.position.copy(old);
      }
      e.group.rotation.y=Math.atan2(to.x,to.z);
      if(e.fireTimer<=0 && dist<9.2) { e.fireTimer=e.type==='turret'?1.35:1.8+Math.random()*.45; fireEnemy(e,to,9.5,e.type==='turret'?13:10); }
      if(dist<1.15+activeRadius() && e.touchTimer<=0) { damagePlayer(9); e.touchTimer=.8; }
    }
  }
}
function updateBoss(e,dt,target) {
  e.fireTimer-=dt; e.chargeTimer-=dt; e.coreOpen=Math.max(0,e.coreOpen-dt); e.phase=e.hp<e.maxHp*.48?2:1;
  e.ring.rotation.z+=dt*(e.phase===2?3.2:1.8); e.core.scale.setScalar(1+Math.sin(performance.now()*.008)*.12);
  const to=new THREE.Vector3(target.position.x-e.group.position.x,0,target.position.z-e.group.position.z); const dist=to.length(); if(dist>0.01)to.normalize();
  e.group.rotation.y=Math.atan2(to.x,to.z);
  if(e.chargeTimer<=0) {
    e.chargeTimer=e.phase===2?2.1:3.0; e.coreOpen=e.phase===2?1.6:1.25; e.group.position.addScaledVector(to,Math.min(3.0,dist*.28));
    toast('CORE EXPOSED',.8); beep(170,.18,'sawtooth',.025,170);
  }
  if(e.fireTimer<=0) {
    e.fireTimer=e.phase===2?1.05:1.55;
    const count=e.phase===2?7:5;
    const base=Math.atan2(to.x,to.z);
    for(let i=0;i<count;i++) { const a=base+(i-(count-1)/2)*.22; fireEnemy(e,new THREE.Vector3(Math.sin(a),0,Math.cos(a)),e.phase===2?11.5:9.5,e.phase===2?12:10); }
  }
  if(dist<3.1+activeRadius()) damagePlayer(e.phase===2?16:13);
}

function updatePickups(dt) {
  for(const p of pickups) {
    if(p.dead || p.area!==player.area) continue;
    p.t+=dt; p.group.rotation.y+=dt*1.5; p.group.position.y=Math.sin(p.t*2.1)*.16;
    if(distanceXZ(p.group.position,activeObject().position)<1.25+activeRadius()) {
      p.dead=true; scene.remove(p.group); beep(600,.09,'triangle',.025,140);
      if(p.type==='scrap') { player.scrap+=p.amount; toast(`SALVAGE +${p.amount}`,.8); }
      else if(p.type==='health') { player.health=Math.min(player.maxHealth,player.health+p.amount); toast(`HULL REPAIR +${p.amount}`,.8); }
      else if(p.type==='capacitor') { mission.capacitor=true; mission.stage=3; objective('Phase capacitor secured. Return to the surface and power the east gate.'); toast('PHASE CAPACITOR ACQUIRED',1.6); player.checkpoint.set(4,0,8); }
    }
  }
}
function updateParticles(dt) {
  for(let i=particles.length-1;i>=0;i--) {
    const p=particles[i]; p.life-=dt; p.vel.y-=5.5*dt; p.mesh.position.addScaledVector(p.vel,dt); p.mesh.rotation.x+=dt*5; p.mesh.rotation.y+=dt*7; p.mesh.material.opacity=Math.max(0,p.life/p.max);
    if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}
  }
}

function getControlVector() {
  const kb=new THREE.Vector2((input.keys.has('KeyD')?1:0)-(input.keys.has('KeyA')?1:0),(input.keys.has('KeyW')?1:0)-(input.keys.has('KeyS')?1:0));
  if(kb.lengthSq()>0) kb.normalize();
  if(input.move.lengthSq()>.02) return input.move.clone();
  return kb;
}
function cameraBasis() {
  const forward=new THREE.Vector3(); camera.getWorldDirection(forward); forward.y=0;
  if(forward.lengthSq()<.01) forward.set(0,0,-1); else forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  return {forward,right};
}
function updateAim() {
  if(input.aimStick.lengthSq()>.05) {
    const {forward,right}=cameraBasis(); aimDir.copy(forward).multiplyScalar(input.aimStick.y).addScaledVector(right,input.aimStick.x).normalize();
  } else if(input.pointerAim) {
    const ray=new THREE.Raycaster(); ray.setFromCamera(input.mouseNdc,camera); const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0); const hit=new THREE.Vector3();
    if(ray.ray.intersectPlane(plane,hit)) { aimDir.set(hit.x-activeObject().position.x,0,hit.z-activeObject().position.z); if(aimDir.lengthSq()>.01) aimDir.normalize(); }
  }
  if(player.mode==='rover') rover.userData.turret.rotation.y=Math.atan2(aimDir.x,aimDir.z)-rover.rotation.y;
  else pilot.rotation.y=Math.atan2(aimDir.x,aimDir.z);
}
function updatePlayer(dt) {
  player.invuln=Math.max(0,player.invuln-dt); player.fireCooldown=Math.max(0,player.fireCooldown-dt);
  const v=getControlVector(); const obj=activeObject(); const {forward,right}=cameraBasis();
  const world=new THREE.Vector3().addScaledVector(right,v.x).addScaledVector(forward,v.y); if(world.lengthSq()>.01) world.normalize();
  const boosting=(input.boost || input.keys.has('Space')) && player.boost>2 && world.lengthSq()>.01;
  if(boosting) player.boost=Math.max(0,player.boost-dt*(player.mode==='rover'?34:44)); else player.boost=Math.min(100,player.boost+dt*23);
  const speed=(player.mode==='rover'?6.5:4.2)*(boosting?(player.mode==='rover'?1.62:1.55):1);
  if(world.lengthSq()>.01) {
    moveEntity(obj,new THREE.Vector3(world.x*speed*dt,0,world.z*speed*dt));
    const targetRot=Math.atan2(world.x,world.z); let d=((targetRot-obj.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI; obj.rotation.y+=d*Math.min(1,dt*(player.mode==='rover'?7:10));
  }
  updateAim();
  if(input.fire || input.keys.has('KeyF')) firePlayer();
  if(input.actionPressed){input.actionPressed=false;interact();}
}

const camTarget=new THREE.Vector3();
function updateCamera(dt) {
  const target=activeObject().position; camTarget.lerp(new THREE.Vector3(target.x,player.mode==='rover'?.7:1.0,target.z),1-Math.exp(-dt*9));
  let desired;
  if(player.area==='interior') desired=new THREE.Vector3(camTarget.x,camTarget.y+cameraDistance*1.15,camTarget.z+cameraDistance*.38);
  else desired=new THREE.Vector3(camTarget.x-cameraDistance*.72,camTarget.y+cameraDistance*.78,camTarget.z+cameraDistance*.84);
  camera.position.lerp(desired,1-Math.exp(-dt*7)); camera.lookAt(camTarget); camera.updateMatrixWorld();
}
function updateModeUI() { ui.modeText.textContent=player.mode.toUpperCase(); ui.weaponText.textContent=player.weaponUpgraded?'COIL BARREL MK II':(player.mode==='rover'?'SPARK CANNON':'PULSE TOOL'); }
function updateHUD() {
  ui.healthBar.style.width=`${Math.max(0,player.health/player.maxHealth*100)}%`; ui.healthText.textContent=`${Math.ceil(player.health)}`;
  ui.boostBar.style.width=`${player.boost}%`; ui.xpBar.style.width=`${Math.min(100,player.xp/player.nextXp*100)}%`; ui.levelText.textContent=`L${player.level}`; ui.scrapText.textContent=player.scrap; updateModeUI();
}

function animate() {
  clock.update(); const dt=Math.min(.033,clock.getDelta());
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}
  if(gameStarted) {
    updatePlayer(dt); updateEnemies(dt); updateProjectiles(dt); updatePickups(dt); updateParticles(dt); updateObjectiveProgress(); updatePrompt(); updateHUD();
  } else updateParticles(dt);
  updateCamera(dt);
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

// Input: desktop.
addEventListener('keydown',(e)=>{input.keys.add(e.code); if(e.code==='KeyE'&&!e.repeat)input.actionPressed=true; if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
addEventListener('keyup',(e)=>input.keys.delete(e.code));
renderer.domElement.addEventListener('pointermove',(e)=>{if(e.pointerType==='mouse'){input.mouseNdc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);input.pointerAim=true;}});
renderer.domElement.addEventListener('pointerdown',(e)=>{if(e.pointerType==='mouse'&&e.button===0){input.fire=true;input.pointerAim=true;}});
addEventListener('pointerup',(e)=>{if(e.pointerType==='mouse'&&e.button===0)input.fire=false;});
renderer.domElement.addEventListener('wheel',(e)=>{cameraDistance=Math.max(8,Math.min(16,cameraDistance+Math.sign(e.deltaY)*.7));e.preventDefault();},{passive:false});

// Input: mobile multitouch sticks/buttons.
function setupStick(el,target,retain=false) {
  const knob=el.querySelector('.pad-knob'); let id=null;
  function move(e){if(e.pointerId!==id)return;const r=el.getBoundingClientRect();let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const max=r.width*.34;const len=Math.hypot(x,y);if(len>max){x=x/len*max;y=y/len*max;}knob.style.transform=`translate(${x}px,${y}px)`;target.set(x/max,-y/max);if(target.length()>1)target.normalize();e.preventDefault();}
  el.addEventListener('pointerdown',e=>{if(id!==null)return;id=e.pointerId;el.setPointerCapture(id);move(e);});
  el.addEventListener('pointermove',move);
  const end=e=>{if(e.pointerId!==id)return;id=null;knob.style.transform='translate(0,0)';if(!retain)target.set(0,0);}; el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
setupStick($('#move-pad'),input.move,false); setupStick($('#aim-pad'),input.aimStick,true);
function holdButton(el,setter){el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);el.classList.add('active');setter(true);e.preventDefault();});const end=e=>{el.classList.remove('active');setter(false);};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);}
holdButton($('#fire-button'),v=>input.fire=v); holdButton($('#boost-button'),v=>input.boost=v);
$('#action-button').addEventListener('pointerdown',e=>{e.currentTarget.classList.add('active');input.actionPressed=true;e.preventDefault();}); $('#action-button').addEventListener('pointerup',e=>e.currentTarget.classList.remove('active'));

const freeTouches=new Map(); let pinchDistance=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){freeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);if(freeTouches.size===2){const a=[...freeTouches.values()];pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}}});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!freeTouches.has(e.pointerId))return;freeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(freeTouches.size===2){const a=[...freeTouches.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDistance>0){cameraDistance=Math.max(8,Math.min(16,cameraDistance-(d-pinchDistance)*.018));}pinchDistance=d;}e.preventDefault();},{passive:false});
const freeEnd=e=>{freeTouches.delete(e.pointerId);if(freeTouches.size<2)pinchDistance=0;};renderer.domElement.addEventListener('pointerup',freeEnd);renderer.domElement.addEventListener('pointercancel',freeEnd);

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));});
document.addEventListener('visibilitychange',()=>{if(document.hidden){input.fire=false;input.boost=false;input.keys.clear();}});

ui.startButton.addEventListener('click',()=>{setupAudio();audio?.resume();ui.startCard.classList.remove('show');gameStarted=true;mission.startTime=performance.now();objective('Blast the magenta crystal nest blocking the east passage.');toast('AREA 01 · CINDER AQUIFER',1.6);});
ui.restartButton.addEventListener('click',()=>location.reload());

camera.position.set(-36,13,14); camTarget.copy(rover.position); camera.lookAt(rover.position);
updateHUD(); updateModeUI(); objective('Press DROP IN to start the mission.');
