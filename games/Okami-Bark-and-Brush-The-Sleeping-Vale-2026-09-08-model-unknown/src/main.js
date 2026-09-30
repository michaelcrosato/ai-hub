/* Bark & Brush — The Sleeping Vale.

   An original, self-contained game: all art, geometry, music and effects are
   generated here. It used to paint its 3D with a software projection onto
   Canvas2D; it now runs on the wall's shared stack (three.js r186
   WebGPURenderer with WebGL2 fallback, booted through kit/boot.js), with the
   same painted look: ink-hulled low-poly characters, painted billboards,
   flat colour ground and a paper overlay. The brush, the HUD and the map stay
   on 2D overlays, as they were. */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { TAU, PI, clamp, lerp, rng, path2, ellipse, paperTex, treeAsset, grassAsset, flowerAsset, rockAsset, lanternAsset, bambooAsset, gateAsset, mountainAsset, cloudStrip, particleShapes, glowTex, veilTex, packAtlas } from './art.js';
import { canvasTexture, BillboardBatch, Decal, DynTube } from './scene.js';
import { buildWorld, terrainH, makeMask, makeCrow, GATE, PATH_NODES } from './data.js';
import { buildGround, buildPatches, buildPath, buildStreaks, buildBackdrop, buildGate, makeTints, COLORS } from './world.js';
import { createWolf, createPip, createMask, createCrow, createBridge } from './models.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* ================================================================== boot */

const kit = await boot({
  title: 'Bark & Brush — The Sleeping Vale',
  accent: '#b99653',
  background: '#26342e',
  gear: 'tr',
  touch: { top: 'left', topOffset: 70, theme: 'light' },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
    turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
    strike: { keys: ['KeyJ'], mouse: [0], gamepad: ['X', 'RT'], touch: 'Strike' },
    dash: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], gamepad: ['B'], touch: 'Dash' },
    brush: { keys: ['KeyF'], gamepad: ['Y', 'LT'], touch: 'Brush' },
    brushHold: { mouse: [2] },
    paint: { mouse: [0] },
    draw: { keys: ['Space'], gamepad: ['A', 'RT'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP', 'KeyH'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RB', neg: 'LB' } },
    mute: { keys: ['KeyM'] },
    restart: { keys: ['KeyR'] },
  },
});
const input = kit.input;
const touch = kit.touch;

/* ================================================================== challenge, save, records */

const CHALLENGES = {
  gentle: { label: 'Gentle', speed: 0.85, windup: 1.3, cooldown: 1.35, inkRate: 1.5, maskHp: 0, crowHp: 2, inv: 1.8, slam: 1 },
  standard: { label: 'Standard', speed: 1, windup: 1, cooldown: 1, inkRate: 1, maskHp: 0, crowHp: 2, inv: 1.45, slam: 1 },
  fierce: { label: 'Fierce', speed: 1.2, windup: 0.8, cooldown: 0.8, inkRate: 0.75, maskHp: 1, crowHp: 3, inv: 1.2, slam: 2 },
};
const CHALLENGE_ORDER = ['gentle', 'standard', 'fierce'];
const SAVE_KEY = 'barkbrush.save.v1';
const REC_KEY = 'barkbrush.records.v1';
const CHAL_KEY = 'barkbrush.challenge';
const ZOOM_KEY = 'barkbrush.zoom';
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
let challenge = CHALLENGES[store.get(CHAL_KEY)] ? store.get(CHAL_KEY) : 'standard';
const C = () => CHALLENGES[challenge];
/** The easiest challenge used at any point of this tale: its times are filed under that one. */
let runChallenge = challenge;
const easier = (a, b) => (CHALLENGE_ORDER.indexOf(a) <= CHALLENGE_ORDER.indexOf(b) ? a : b);

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function readRecords() {
  try {
    const r = JSON.parse(store.get(REC_KEY) || '{}');
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}
/** Store a finishing time; returns { best, isNew } for that ending and the run's challenge. */
function recordFinish(kind, time, strokes) {
  const recs = readRecords();
  recs[kind] ||= {};
  const prev = recs[kind][runChallenge];
  const isNew = !prev || time < prev.time;
  if (isNew) recs[kind][runChallenge] = { time, strokes };
  store.set(REC_KEY, JSON.stringify(recs));
  return { best: recs[kind][runChallenge], isNew };
}

/* ================================================================== the world */

kit.loading.progress(0.62, 'Grinding the ink…');
await nextFrame();

const WORLD = buildWorld();
const { groves, patches, pathPieces, decor, grass, coldLanterns } = WORLD;
const masks = WORLD.maskDefs.map((d) => makeMask(d.id, d.x, d.z, d.big, d.anim));
const crows = WORLD.crowDefs.map(([id, x, z]) => makeCrow(id, x, z));
const foes = [...masks, ...crows];

const player = { x: 0, z: 14, y: 0, vy: 0, yaw: PI, speed: 0, vx: 0, vz: 0, gait: 0, hp: 5, ink: 3, dash: 0, dashCD: 0, attack: 0, attackCD: 0, inv: 0 };
let mode = 'title';
let brush = false;
let brushSource = '';
let pending = null;
let stroke = [];
let drawing = false;
let drawSrc = '';
let worldT = 0;
let realT = 0;
let frameCount = 0;
let yaw = 0;
const camFollow = { x: 0, y: 0, z: 14 };
// Camera distance: wheel, pinch, LB / RB or - / =. A per-player preference, kept between tales.
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.4;
let zoomWant = clamp(+store.get(ZOOM_KEY) || 1, ZOOM_MIN, ZOOM_MAX);
let zoom = zoomWant;
const camPos = new THREE.Vector3(12, 8, 24);
const camTarget = new THREE.Vector3(-3, 2, 2);
let bloomTime = 0;
let bloomTree = null;
let toastUntil = 0;
let flash = 0;
let hitStop = 0;
let shake = 0;
let strokeCount = 0;
let taleTime = 0;
let fullTime = 0;
let kills = 0;
let won = false;
let epilogue = false;
let moonAwake = false;
let endAt = 0;
let endKind = 'tale';
let bridgeMended = false;
let bridgeGrow = 0;
let gateOpen = false;
let veilT = 0;
let movementTrail = 0;
let stepCount = 0;
let waterCD = 0;
let threatNear = false;
let taleRecorded = false;
let fullRecorded = false;
let checkpoint = { x: 0, z: 14 };
let lastSaveAt = 0;
const KINDLE_COST = 0.5;
const INK = '#4b4b4b';

for (const e of masks) e.hp = e.maxhp = (e.big ? 6 : 3) + C().maskHp;
for (const c of crows) c.hp = c.maxhp = C().crowHp;

function floorH(x, z) {
  if (bridgeMended && z < -2.7 && z > -9.3 && Math.abs(x) < 2.1) return 0.15 + Math.sin(clamp((-z - 3) / 6, 0, 1) * PI) * 0.5;
  return terrainH(x, z);
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ================================================================== art → textures */

const artScale = { low: 0.42, medium: 0.55, high: 0.75, ultra: 0.9 }[kit.tier.name] ?? 0.75;
const small = Math.max(0.8, artScale);
const entries = [];
const addArt = (key, canvas) => entries.push({ key, canvas });
addArt('tree0', treeAsset(9, true, 0, artScale));
addArt('tree1', treeAsset(43, true, 0, artScale));
addArt('tree2', treeAsset(72, true, 1, artScale));
kit.loading.progress(0.68, 'Painting the groves…');
await nextFrame();
for (const g of groves) {
  addArt(`g${g.id}d`, treeAsset(g.seed, false, 0, artScale));
  addArt(`g${g.id}l`, treeAsset(g.seed, true, g.kind, artScale));
}
kit.loading.progress(0.8, 'Painting the vale…');
await nextFrame();
[4, 17, 68].forEach((s, i) => addArt(`rock${i}`, rockAsset(s, small)));
addArt('lantern', lanternAsset(true, small));
addArt('lanternCold', lanternAsset(false, small));
addArt('bamboo', bambooAsset(68, artScale));
[[1, '#70954c'], [51, '#92985e'], [6, '#688c50']].forEach(([s, c], i) => addArt(`grass${i}`, grassAsset(s, c, small)));
[1, 21, 78].forEach((s, i) => addArt(`flower${i}`, flowerAsset(s, small)));
const atlas = packAtlas(entries, 4096, 8);
entries.length = 0; // the atlas holds the paint now; let the loose canvases go
const atlasTex = canvasTexture(atlas.canvas);
const R = atlas.rects;
const AR = atlas.aspect;

$('paper').style.backgroundImage = `url(${paperTex().toDataURL()})`;

kit.loading.progress(0.88, 'Building the world…');
await nextFrame();

/* ================================================================== the scene */

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.mist);
scene.fog = new THREE.Fog(COLORS.mist, 38, 125);
const FOV = 54;
const camera = kit.fitCamera(new THREE.PerspectiveCamera(FOV, 1, 0.2, 700));
camera.position.copy(camPos);
camera.lookAt(camTarget);

const tints = makeTints();
const TINT = {
  ground: [new THREE.Color(COLORS.ground), new THREE.Color(COLORS.groundWon)],
  path: [new THREE.Color(COLORS.path), new THREE.Color(COLORS.pathWon)],
  water: [new THREE.Color(COLORS.water), new THREE.Color(COLORS.waterWon)],
  skyTop: [new THREE.Color(COLORS.skyTop), new THREE.Color(COLORS.skyTopWon)],
};
let springMix = 0;
const applyTints = () => {
  for (const k of Object.keys(TINT)) tints[k].value.lerpColors(TINT[k][0], TINT[k][1], springMix);
};

scene.add(buildGround(tints));
scene.add(buildPatches(patches));
scene.add(buildPath(pathPieces, tints));
const streaks = buildStreaks();
scene.add(streaks.group);
const backdrop = buildBackdrop(mountainAsset(68, artScale >= 0.7 ? 1 : 0.6), cloudStrip(artScale >= 0.7 ? 1 : 0.7), tints);
scene.add(backdrop.group);
const gateVis = buildGate(gateAsset(artScale), veilTex());
scene.add(gateVis.group);
const gateMesh = gateVis.group.children[0];
gateMesh.material.transparent = true;
gateMesh.renderOrder = 9;
const bridge = createBridge();
scene.add(bridge.group);

const wolf = createWolf();
scene.add(wolf.root, wolf.shadow);
const pip = createPip();
scene.add(pip.group);
const maskVis = masks.map((e) => {
  const v = createMask(e);
  scene.add(v.root, v.shadow);
  return v;
});
const crowVis = crows.map(() => {
  const v = createCrow();
  scene.add(v.root, v.shadow);
  return v;
});

// Painted sprites: every tree, rock, lantern, tuft and flower in one sorted, instanced draw.
const sprites = new BillboardBatch(atlasTex, 1100, { alphaTest: 0.12, renderOrder: 10, anchor: 0 });
scene.add(sprites.object);
const shapes = particleShapes();
const partTex = canvasTexture(shapes);
const parts3d = new BillboardBatch(partTex, 440, { alphaTest: 0.02, depthWrite: false, renderOrder: 11, tint: true, anchor: 0.5 });
scene.add(parts3d.object);
const RECT_PETAL = [0, 0, 0.5, 1];
const RECT_INK = [0.5, 0, 0.5, 1];

// Lantern glows for the lamps Mallow kindles.
const glowMat = new THREE.SpriteNodeMaterial({ map: canvasTexture(glowTex()), transparent: true, depthWrite: false, opacity: 0.8 });
for (const l of coldLanterns) {
  l.sprite = new THREE.Sprite(glowMat);
  l.sprite.position.set(l.x, l.y + l.h * 0.52, l.z);
  l.sprite.renderOrder = 12;
  l.sprite.visible = false;
  scene.add(l.sprite);
}

// Ground decals: grove circles, enemy telegraphs, ripples.
const groveDecals = groves.map((g) => {
  const big = g.id === 2;
  const d = {
    dead: new Decal({ color: '#7f787b', opacity: 0.3, rings: 3 }),
    fill: new Decal({ color: '#83ac67', opacity: 0.75, rings: big ? 14 : 5 }),
    inner: new Decal({ color: '#95b274', opacity: 0.19, rings: big ? 12 : 4 }),
    edge: new Decal({ ring: true, color: '#fff0bc', segs: big ? 96 : 56 }),
  };
  for (const k of ['dead', 'fill', 'inner', 'edge']) scene.add(d[k].mesh);
  d.inner.mesh.renderOrder = 3.1;
  d.edge.mesh.renderOrder = 3.2;
  return d;
});
const foeDecals = foes.map(() => {
  const d = {
    wind: new Decal({ color: '#a75340', opacity: 0.16, rings: 2, renderOrder: 4 }),
    windRing: new Decal({ ring: true, color: '#e1a360', opacity: 0.65, renderOrder: 4.1 }),
    slam: new Decal({ ring: true, color: '#e5c57f', opacity: 0.8, segs: 72, renderOrder: 4.1 }),
    slam2: new Decal({ ring: true, color: '#895344', opacity: 0.5, segs: 72, renderOrder: 4.2 }),
  };
  for (const k of ['wind', 'windRing', 'slam', 'slam2']) scene.add(d[k].mesh);
  return d;
});
const RIPPLE_MAX = 14;
const ripples = [];
for (let i = 0; i < RIPPLE_MAX; i++) {
  const decal = new Decal({ ring: true, color: '#ffffff', segs: 48, renderOrder: 4.3, river: false });
  scene.add(decal.mesh);
  ripples.push({ decal, x: 0, z: 0, r: 0, life: 0, max: 1, speed: 1, on: false });
}
let rippleNext = 0;
function ring(x, z, color, r = 0, max = 1.3, speed = 4) {
  const rp = ripples[rippleNext];
  rippleNext = (rippleNext + 1) % RIPPLE_MAX;
  rp.decal.material.color.set(color);
  Object.assign(rp, { x, z, r, life: max, max, speed, on: true });
}

// Cut slices: a pale stroke with a thin dark core.
const slices = [];
for (let i = 0; i < 4; i++) {
  const outer = new DynTube(2, { radial: 5, color: '#fff2be', transparent: true });
  const inner = new DynTube(2, { radial: 4, color: '#395d48', transparent: true });
  outer.mesh.renderOrder = 12;
  inner.mesh.renderOrder = 13;
  outer.visible = inner.visible = false;
  scene.add(outer.group, inner.group);
  slices.push({ outer, inner, pts: new Float32Array(6), life: 0 });
}
let sliceNext = 0;

/* ================================================================== particles and footprints (pooled) */

const MAXP = 420;
const parts = Array.from({ length: MAXP }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, col: null, life: 0, max: 1, angle: 0, spin: 0, ink: false }));
let partCount = 0;
let partOverwrite = 0;
const colorCache = new Map();
const tintOf = (hex) => {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
};
const rand = rng(99);
const rnd = (a, b) => lerp(a, b, rand());
const pick = (a) => a[Math.floor(rand() * a.length)];
const PETALS = ['#eab2a0', '#f8dfb4', '#c87a73', '#d6b76e'];
const MOON_PETALS = ['#d5d6ec', '#f4f3ff', '#aeb0cf', '#eeeaf9'];

function spawnPetals(x, y, z, n, color = null, force = 1, palette = PETALS) {
  for (let i = 0; i < n; i++) {
    let p;
    if (partCount < MAXP) p = parts[partCount++];
    else {
      p = parts[partOverwrite];
      partOverwrite = (partOverwrite + 1) % MAXP;
    }
    const a = rnd(0, TAU);
    const speed = rnd(0.6, 3.2) * force;
    p.x = x;
    p.y = y + rnd(0, 1.4);
    p.z = z;
    p.vx = Math.sin(a) * speed;
    p.vy = rnd(0.9, 3.4) * force;
    p.vz = Math.cos(a) * speed;
    p.size = rnd(0.035, 0.12);
    p.col = tintOf(color || pick(palette));
    p.life = rnd(1.5, 3.4);
    p.max = 3.4;
    p.angle = rnd(0, TAU);
    p.spin = rnd(-3, 3);
    p.ink = color === INK;
  }
}

const MAXMARKS = 80;
const marks = Array.from({ length: MAXMARKS }, () => ({ x: 0, z: 0, life: 0, index: 0 }));
let markNext = 0;
function addMark(x, z) {
  const m = marks[markNext];
  markNext = (markNext + 1) % MAXMARKS;
  m.x = x;
  m.z = z;
  m.life = 5;
  m.index = Math.floor(rand() * 3);
}

/* ================================================================== sound */

let soundText = 'Sound on';
let soundWasSuspended = false;
const sound = new Sound({
  mode: () => mode,
  brush: () => brush,
  awake: () => groves.reduce((n, g) => n + (g.awake ? 1 : 0), 0),
  threat: () => threatNear,
  onLabel: (text) => {
    soundText = text;
    paintSoundLabels();
  },
});
function paintSoundLabels() {
  const waiting = sound.suspended && !sound.muted;
  const t = waiting ? 'Sound: tap or press a key' : soundText;
  $('sound').textContent = t + (input.source === 'keyboard' && !waiting ? ' · M' : '');
  $('soundOpt').textContent = waiting ? t : `Sound: ${sound.failed ? 'unavailable' : sound.muted ? 'off' : 'on'}`;
}
// Browsers only start audio from a gesture: any key or tap retries.
addEventListener('pointerdown', () => sound.unlock(), true);
addEventListener('keydown', () => sound.unlock(), true);
kit.onPause((p) => sound.hold(p || document.hidden));

/* ================================================================== HUD */

const hud = {
  life: [],
  ink: [],
  dots: [...document.querySelectorAll('#progress i')],
  cache: new Map(),
};
for (let i = 0; i < 5; i++) {
  const el = document.createElement('i');
  el.className = 'leaf';
  $('life').appendChild(el);
  hud.life.push(el);
}
for (let i = 0; i < 3; i++) {
  const el = document.createElement('i');
  el.className = 'inkwell';
  el.innerHTML = '<span></span>';
  $('ink').appendChild(el);
  hud.ink.push(el.firstChild);
}
function setText(el, text) {
  if (hud.cache.get(el) !== text) {
    hud.cache.set(el, text);
    el.textContent = text;
  }
}
function setHTML(el, html) {
  const key = `html:${el.id}`;
  if (hud.cache.get(key) !== html) {
    hud.cache.set(key, html);
    el.innerHTML = html;
  }
}
let toastOn = false;
function toast(title, sub = '', duration = 3) {
  $('toastTitle').textContent = title;
  $('toastSub').textContent = sub;
  $('toast').classList.add('show');
  toastOn = true;
  toastUntil = realT + duration;
}
function hideToast() {
  if (!toastOn) return;
  toastOn = false;
  $('toast').classList.remove('show');
}

/** Button prompts for the device in use. */
function labels() {
  const s = input.source;
  if (s === 'gamepad') return { press: 'Press', brush: 'Y', strike: 'X', dash: 'B', jump: 'A' };
  if (s === 'touch') return { press: 'Tap', brush: 'the Brush button', strike: 'the Strike button', dash: 'the Dash button', jump: 'the Jump button' };
  return { press: 'Press', brush: 'F', strike: 'Click or J', dash: 'Shift', jump: 'Space' };
}
const fill = (t) => {
  const L = labels();
  return t.replace(/\{(\w+)\}/g, (_, k) => L[k] ?? k);
};

const STAGES = [
  ['VERSE I · THE REED GROVE', 'Wake the first tree', 'Draw a circle around its crown.', 'That bare tree needs a little ink. Walk near it. {press} <strong>{brush}</strong>, then draw a circle around its crown.'],
  ['THE RIVER CROSSING', 'Paint a path across', 'Zigzag over the broken bridge.', 'A few boards are missing. Walk to the river. {press} <strong>{brush}</strong> and draw a <strong>zigzag</strong> over the gap.'],
  ['VERSE II · THE BELL GROVE', 'Clear the ink masks', 'Cross the bridge. Strike and cut.', 'Those masks have swallowed the next verse. Strike with <strong>{strike}</strong>. Draw a <strong>line</strong> through them to cut. Evade with <strong>{dash}</strong>.'],
  ['VERSE II · THE BELL GROVE', 'Wake the bell tree', 'Circle its crown to bring back color.', 'The masks are gone. Circle the bare tree’s crown. Listen: each grove adds a new part to the song.'],
  ['VERSE III · THE GREAT WILLOW', 'Free the last grove', 'Follow the path to the large mask.', 'One large mask guards the willow. <strong>Jump</strong> over its ring of ink, or <strong>dash</strong> away. Cut and strike when it rests.'],
  ['VERSE III · THE GREAT WILLOW', 'Wake the great willow', 'Circle the crown. Let spring return.', 'The last verse is yours. Stand back until you can see the willow’s crown. Draw a circle around it.'],
  ['THE VALE IN BLOOM', 'The river sings again', 'Walk, jump, and leave flowers behind.', 'You did it, Mallow. Three groves. One song. We should take the long way home.'],
  ['EPILOGUE · THE MOON GATE', 'Kindle the cold lanterns', 'Dot each dark lamp. {lit} / 4 lit.', 'Ink has pooled over the old gate, and its four lanterns have gone cold. {press} <strong>{brush}</strong> and tap a quick <strong>dot</strong> on each lamp. You can light several before you lift the brush.'],
  ['EPILOGUE · THE MOON TERRACE', 'Drive off the ink crows', 'Strike them when they land. Cut them in the air.', 'The gate is open, but ink crows guard the terrace. They <strong>dive</strong> where you stand: evade with <strong>{dash}</strong>, then strike with <strong>{strike}</strong> while they rest. A <strong>line</strong> cuts them anywhere.'],
  ['EPILOGUE · THE MOON PLUM', 'Wake the moon plum', 'Circle its crown. Sing the last verse.', 'The terrace is quiet. One more tree sleeps under the moon. Circle its crown.'],
  ['THE FULL SONG', 'Every verse is sung', 'Walk, jump, and leave flowers behind.', 'Four groves. One whole song. Thank you, Mallow. Let’s sit here a while.'],
];
const SEASONS = ['BEFORE THE FIRST BLOOM', 'THE FIRST NOTES RETURN', 'THE RIVER FINDS ITS VOICE', 'SPRING HAS COME HOME', 'THE MOON REMEMBERS'];
let stage = 0;
let guideKey = '';
let guideOverride = '';

function computeStage() {
  if (!groves[0].awake) return 0;
  if (!bridgeMended) return 1;
  if (!groves[1].awake) return masks[0].dead && masks[1].dead ? 3 : 2;
  if (!masks[2].dead) return 4;
  if (!groves[2].awake) return 5;
  if (!epilogue) return 6;
  if (!gateOpen) return 7;
  if (crows.some((c) => !c.dead)) return 8;
  if (!groves[3].awake) return 9;
  return 10;
}
const litCount = () => coldLanterns.reduce((n, l) => n + (l.lit ? 1 : 0), 0);

/** A passing remark from Pip; it stays until the next verse begins. */
function guide(html) {
  guideOverride = html;
  setHTML($('guideText'), html);
}

function updateUI() {
  for (let i = 0; i < 5; i++) {
    const empty = i >= player.hp;
    if (hud.life[i].classList.contains('empty') !== empty) hud.life[i].classList.toggle('empty', empty);
  }
  for (let i = 0; i < 3; i++) {
    const h = `${Math.round(clamp(player.ink - i, 0, 1) * 50) * 2}%`;
    if (hud.cache.get(hud.ink[i]) !== h) {
      hud.cache.set(hud.ink[i], h);
      hud.ink[i].style.height = h;
    }
  }
  const n = groves.reduce((a, g) => a + (g.awake ? 1 : 0), 0);
  const total = epilogue ? 4 : 3;
  setText($('groveCount'), `${n} / ${total} GROVES`);
  hud.dots.forEach((d, i) => {
    if (i < 4 && groves[i] && d.classList.contains('done') !== groves[i].awake) d.classList.toggle('done', groves[i].awake);
  });
  const dot4 = $('dot4');
  if (dot4.classList.contains('hidden') === epilogue) dot4.classList.toggle('hidden', !epilogue);
  setText($('season'), SEASONS[Math.min(n, 4)]);
  setText($('zoneName'), player.z < -41.5 ? 'THE MOON TERRACE' : 'THE SLEEPING VALE');
  stage = computeStage();
  const copy = STAGES[stage];
  const lit = litCount();
  const key = `${stage}|${lit}|${input.source}`;
  if (key !== guideKey) {
    const stageChanged = !guideKey.startsWith(`${stage}|`);
    guideKey = key;
    setText($('chapter'), copy[0]);
    setText($('objective'), copy[1]);
    setText($('objectiveSub'), copy[2].replace('{lit}', String(lit)));
    if (stageChanged) guideOverride = '';
    if (!guideOverride) setHTML($('guideText'), fill(copy[3]));
  }
  const kin = epilogue && !gateOpen;
  $('gestureKindle').classList.toggle('hidden', !kin);
  $('helpKindle').classList.toggle('hidden', !epilogue);
}

/* ================================================================== controls help, per device */

function paintControls() {
  const s = input.source;
  const kb = (k) => `<kbd>${k}</kbd>`;
  if (s === 'gamepad') {
    $('controlStrip').innerHTML = `<span>${kb('L-stick')} Move</span><span class="optional">${kb('R-stick')} Camera</span><span>${kb('A')} Jump</span><span>${kb('B')} Dash</span><span>${kb('X')} Strike</span><span class="brush-key"><b>Y</b> Brush</span>`;
    $('startControls').innerHTML = `<div>${kb('L-stick')}<span>Move</span></div><div>${kb('Y')}<span>Brush</span></div><div>${kb('A')}<span>Paint</span></div>`;
    $('helpGrid').innerHTML = [['Move', 'Left stick'], ['Turn the camera', 'Right stick'], ['Camera distance', 'LB / RB'], ['Jump', 'A'], ['Dash and evade', 'B'], ['Strike', 'X / RT'], ['Brush mode', 'Y / LT'], ['Paint (in brush mode)', 'Hold A'], ['Lift the brush', 'B'], ['Pause / guide', 'Start']].map(([a, b]) => `<div>${a} ${kb(b)}</div>`).join('');
    $('helpNote').innerHTML = 'Press <b>Y</b>. Move the brush with the left stick and hold <b>A</b> to paint. A valid mark casts when you let go; <b>B</b> lifts the brush. Ink refills while you move. A grove restores your life.';
  } else if (s === 'touch') {
    $('controlStrip').innerHTML = '';
    $('startControls').innerHTML = `<div>${kb('Stick')}<span>Move</span></div><div>${kb('Brush')}<span>Paint mode</span></div><div>${kb('Finger')}<span>Draw</span></div>`;
    $('helpGrid').innerHTML = [['Move', 'Left thumb'], ['Turn the camera', 'Drag right side'], ['Camera distance', 'Pinch'], ['Jump · Dash · Strike', 'Buttons'], ['Brush mode', 'Brush'], ['Paint', 'One finger'], ['Pause / guide', 'II']].map(([a, b]) => `<div>${a} ${kb(b)}</div>`).join('');
    $('helpNote').innerHTML = 'Tap <b>Brush</b>, then draw on the world with one finger. A valid mark casts when you lift it. “Lift the brush” leaves without casting. Ink refills while you move. A grove restores your life.';
  } else {
    $('controlStrip').innerHTML = `<span>${kb('WASD')} Move</span><span class="optional">${kb('Q E')} Camera</span><span>${kb('Space')} Jump</span><span>${kb('Shift')} Dash</span><span>${kb('Click')} Strike</span><span class="brush-key"><b>F</b> Brush</span>`;
    $('startControls').innerHTML = `<div>${kb('W A S D')}<span>Move</span></div><div>${kb('F')}<span>Brush</span></div><div>${kb('Mouse')}<span>Draw</span></div>`;
    $('helpGrid').innerHTML = [['Move', 'W A S D / Arrows'], ['Turn the camera', 'Q / E'], ['Camera distance', 'Wheel / − ='], ['Jump', 'Space'], ['Dash and evade', 'Shift'], ['Strike', 'Left click / J'], ['Brush mode', 'F'], ['Quick brush', 'Right-drag'], ['Pause / guide', 'Esc / H'], ['Mute', 'M'], ['Restart', 'R']].map(([a, b]) => `<div>${a} ${kb(b)}</div>`).join('');
    $('helpNote').innerHTML = 'Press <b>F</b>, then drag with the left mouse button. A valid mark casts when you release it. For a quick mark, drag with the <b>right mouse button</b> and let go. No mouse? Move the brush with the arrows and hold <b>Space</b>. Ink refills while you move. A grove restores your life.';
  }
  $('startFoot').textContent = 'ONE SHORT TALE · KEYBOARD, CONTROLLER OR TOUCH · SOUND ON ENTRY';
  paintSoundLabels();
  if (brush) paintBrushHint();
  guideKey = '';
  if (mode !== 'title') updateUI();
}
input.onSourceChange(() => paintControls());

function paintChallenge() {
  const l = C().label;
  $('challenge').textContent = `Challenge · ${l}`;
  const filed = runChallenge !== challenge ? ` (times count as ${CHALLENGES[runChallenge].label})` : '';
  $('challengeOpt').textContent = `Challenge: ${l}${filed}`;
}
/** Foe life follows the challenge; damage already dealt stays dealt. */
function applyChallengeToFoes() {
  const ch = C();
  for (const e of foes) {
    const max = e.kind === 'crow' ? ch.crowHp : (e.big ? 6 : 3) + ch.maskHp;
    if (!e.dead) e.hp = Math.max(1, max - (e.maxhp - e.hp));
    e.maxhp = max;
  }
}
function cycleChallenge() {
  challenge = CHALLENGE_ORDER[(CHALLENGE_ORDER.indexOf(challenge) + 1) % CHALLENGE_ORDER.length];
  store.set(CHAL_KEY, challenge);
  // Mid-tale the change applies at once (a stuck player can ease off); records then count the easiest setting used.
  if (mode !== 'title') {
    runChallenge = easier(runChallenge, challenge);
    applyChallengeToFoes();
  }
  paintChallenge();
  paintRecord();
}

function paintRecord() {
  const recs = readRecords();
  const t = recs.tale?.[challenge];
  const f = recs.full?.[challenge];
  const bits = [];
  if (t) bits.push(`BEST TALE ${fmtTime(t.time)}`);
  if (f) bits.push(`FULL SONG ${fmtTime(f.time)}`);
  $('startRecord').textContent = bits.length ? `${bits.join(' · ')} · ${C().label.toUpperCase()}` : '';
  $('startRecord').classList.toggle('hidden', !bits.length);
}

/* ================================================================== save / continue */

function save() {
  if (mode === 'title') return;
  const s = {
    v: 1,
    challenge,
    run: runChallenge,
    groves: groves.map((g) => g.awake),
    bridge: bridgeMended,
    masks: masks.map((e) => e.dead),
    crows: crows.map((c) => c.dead),
    lit: coldLanterns.map((l) => l.lit),
    gate: gateOpen,
    won,
    epilogue,
    moon: moonAwake,
    taleTime,
    fullTime,
    strokes: strokeCount,
    kills,
    hp: player.hp,
    ink: player.ink,
    x: player.x,
    z: player.z,
    yaw,
    cp: checkpoint,
    taleRecorded,
    fullRecorded,
  };
  store.set(SAVE_KEY, JSON.stringify(s));
  store.set(ZOOM_KEY, zoomWant.toFixed(3));
  lastSaveAt = realT;
}
function readSave() {
  try {
    const s = JSON.parse(store.get(SAVE_KEY) || 'null');
    if (!s || s.v !== 1 || !Array.isArray(s.groves)) return null;
    return s;
  } catch {
    return null;
  }
}

/* ================================================================== targets and the brush */

const P0 = { x: 0, y: 0, d: 0, s: 0, visible: false };
const _v = new THREE.Vector3();
let W = kit.size.width;
let H = kit.size.height;
let DPR = Math.min(devicePixelRatio || 1, 2);
let focal = H / 2 / Math.tan((FOV * PI) / 360);
const fx = $('fx');
const fxc = fx.getContext('2d');
const mapc = $('map').getContext('2d');

/** World → CSS pixels on the canvas, with view depth d and pixels-per-unit s (the original's project()). */
function project(x, y, z, out = P0) {
  _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const d = -_v.z;
  out.d = d;
  out.visible = d > 0.18;
  const s = focal / Math.max(d, 1e-4);
  out.s = s;
  out.x = W * 0.5 + _v.x * s;
  out.y = H * 0.5 - _v.y * s;
  return out;
}

function getTargets() {
  const targets = [];
  const p = { x: 0, y: 0, d: 0, s: 0, visible: false };
  for (const g of groves) {
    if (g.awake || dist(player, g) > 20) continue;
    if (g.id === 3 && !gateOpen) continue;
    project(g.x, g.y + g.h * 0.64, g.z, p);
    if (p.visible && p.x > -100 && p.x < W + 100 && p.y > -100 && p.y < H + 100) {
      const locked = g.id === 1 ? !(masks[0].dead && masks[1].dead) : g.id === 2 ? !masks[2].dead || !groves[1].awake : g.id === 3 ? crows.some((c) => !c.dead) : false;
      targets.push({ kind: 'bloom', id: g.id, x: p.x, y: p.y, r: clamp(g.h * 0.19 * p.s, 26, 170), d: p.d, locked });
    }
  }
  if (groves[0].awake && !bridgeMended && Math.hypot(player.x, player.z + 6) < 17) {
    project(0, 0.4, -6, p);
    if (p.visible) {
      const c = { x: p.x, y: p.y, d: p.d };
      const pts = [[-1.8, -4], [1.8, -4], [1.8, -8.5], [-1.8, -8.5]].map(([x, z]) => {
        const q = project(x, 0.3, z, { x: 0, y: 0, d: 0, s: 0, visible: false });
        return { x: q.x, y: q.y };
      });
      targets.push({ kind: 'mend', id: 0, x: c.x, y: c.y, r: Math.max(...pts.map((a) => Math.hypot(a.x - c.x, a.y - c.y))), pts, d: c.d });
    }
  }
  for (const e of foes) {
    if (e.dead || !e.active || dist(player, e) > 21) continue;
    if (e.kind === 'crow') project(e.x, e.y + 0.1, e.z, p);
    else project(e.x, terrainH(e.x, e.z) + (e.big ? 1.45 : 1), e.z, p);
    if (p.visible) targets.push({ kind: 'cut', ref: e, x: p.x, y: p.y, r: Math.max(20, p.s * (e.big ? 1.25 : 0.95)), d: p.d });
  }
  if (epilogue && !gateOpen) {
    for (const l of coldLanterns) {
      if (l.lit || dist(player, l) > 22) continue;
      project(l.x, l.y + l.h * 0.52, l.z, p);
      if (p.visible) targets.push({ kind: 'kindle', id: l.id, x: p.x, y: p.y, r: Math.max(22, p.s * 0.5), d: p.d });
    }
  }
  return targets;
}

function circleContains(points, p) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function segmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const DRY = 'The ink is dry. Leave brush mode to refill it.';
function holdHint() {
  const s = input.source;
  if (s === 'gamepad') return 'Hold A and move the stick to draw one clear mark.';
  if (s === 'touch') return 'Draw one clear mark with your finger.';
  return 'Hold the left mouse button and draw one clear mark.';
}

function recognize(points) {
  if (!points.length) return { error: holdHint() };
  const targets = getTargets();
  let l = Infinity;
  let r = -Infinity;
  let t = Infinity;
  let b = -Infinity;
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const q = points[i];
    l = Math.min(l, q.x);
    r = Math.max(r, q.x);
    t = Math.min(t, q.y);
    b = Math.max(b, q.y);
    if (i) len += Math.hypot(q.x - points[i - 1].x, q.y - points[i - 1].y);
  }
  const bw = r - l;
  const bh = b - t;
  const span = Math.max(bw, bh);
  const a = points[0];
  const z = points[points.length - 1];
  const end = Math.hypot(z.x - a.x, z.y - a.y);

  // Kindle: a quick dot on a cold lamp.
  const kin = targets.filter((k) => k.kind === 'kindle');
  if (kin.length && span < 24 && len < 45) {
    const cx = (l + r) / 2;
    const cy = (t + b) / 2;
    const hit = kin.filter((k) => Math.hypot(k.x - cx, k.y - cy) < k.r).sort((p, q) => p.d - q.d)[0];
    if (hit) {
      if (player.ink < KINDLE_COST) return { error: DRY };
      return { kind: 'kindle', id: hit.id };
    }
    return { error: 'Tap the dot right on a cold lamp.' };
  }
  if (points.length < 4) return { error: holdHint() };
  if (len < 55) return { error: 'Use a longer stroke. Your ink has not been spent.' };

  const isCircle = end < Math.max(25, span * 0.42) && len > span * 2.3 && bw > 28 && bh > 28 && bw / bh > 0.3 && bw / bh < 3;
  if (isCircle) {
    const match = targets.filter((k) => k.kind === 'bloom' && circleContains(points, k) && span > k.r * 0.82).sort((p, q) => p.d - q.d)[0];
    if (match) {
      if (match.locked) {
        if (match.id === 3) return { error: 'Drive off the ink crows before you wake the moon plum.' };
        return { error: match.id === 2 && !groves[1].awake ? 'Wake the bell grove before the great willow.' : 'Clear the ink masks before you wake this tree.' };
      }
      if (player.ink < 1) return { error: DRY };
      return { kind: 'bloom', id: match.id };
    }
    return { error: 'Circle the bare tree’s crown. Close the loop around the pale bud.' };
  }
  const mend = targets.find((k) => k.kind === 'mend');
  if (mend && len > 90 && len / Math.max(end, 20) > 1.48 && span > 38) {
    const mx = mend.pts.map((q) => q.x);
    const my = mend.pts.map((q) => q.y);
    const L = Math.min(...mx) - 35;
    const Rr = Math.max(...mx) + 35;
    const T = Math.min(...my) - 35;
    const B = Math.max(...my) + 35;
    const overlap = points.filter((q) => q.x >= L && q.x <= Rr && q.y >= T && q.y <= B).length / points.length;
    if (overlap > 0.3) {
      if (player.ink < 1) return { error: DRY };
      return { kind: 'mend' };
    }
  }
  let deviation = 0;
  for (const q of points) deviation = Math.max(deviation, segmentDistance(q, a, z));
  const isLine = end > 50 && len / end < 1.36 && deviation < Math.max(24, end * 0.16);
  if (isLine) {
    const hits = targets.filter((k) => k.kind === 'cut' && segmentDistance(k, a, z) < k.r * 1.08);
    if (hits.length) {
      if (player.ink < 1) return { error: DRY };
      return { kind: 'cut', refs: hits.map((k) => k.ref) };
    }
    return { error: 'Draw a straight line through an ink mask.' };
  }
  if (mend) return { error: 'Paint a wide zigzag across the missing bridge boards.' };
  if (kin.length) return { error: 'Tap a quick dot on a cold lamp, or circle a tree’s crown.' };
  return { error: 'Try a closed circle for a tree, or a straight line through a mask.' };
}

const cursor = { x: 0, y: 0 };
let lastPX = NaN;
let lastPY = NaN;

function paintBrushHint(text = null) {
  if (text) {
    $('brushHint').textContent = text;
    return;
  }
  const s = input.source;
  let h;
  if (brushSource === 'hold') h = 'Drag with the right mouse button. Let go to cast.';
  else if (s === 'gamepad') h = 'Move the brush with the left stick. Hold A to paint. B lifts the brush.';
  else if (s === 'touch') h = 'Draw with one finger. Lift it to cast.';
  else h = 'Draw with the left mouse button. Release to cast. Press F to leave.';
  $('brushHint').textContent = h;
}

function setPlayChrome(on) {
  const o = on ? '1' : '0';
  $('guide').style.opacity = o;
  $('controlStrip').style.opacity = o;
  document.querySelector('.zone').style.opacity = o;
}

function enterBrush(source) {
  if (mode !== 'play' || bloomTime > 0 || brush) return;
  brush = true;
  brushSource = source;
  stroke = [];
  pending = null;
  drawing = false;
  $('brushUI').classList.remove('hidden');
  kit.canvas.style.filter = 'grayscale(.92) sepia(.27) contrast(.85) brightness(1.08)';
  kit.canvas.style.cursor = 'none';
  setPlayChrome(false);
  paintBrushHint();
  hideToast();
  // Time stands still on the page: a hit's camera shake would otherwise jitter the targets for as long as the brush is up.
  shake = 0;
  touch?.suspend(true, 'brush');
  const p = input.pointer;
  if (input.source === 'keyboard' && p.over) {
    cursor.x = p.x;
    cursor.y = p.y;
  } else {
    cursor.x = W / 2;
    cursor.y = H * 0.45;
  }
  lastPX = p.x;
  lastPY = p.y;
  sound.effect('brush');
  sound.level();
}

function startStroke(src, x, y) {
  drawing = true;
  drawSrc = src;
  pending = null;
  stroke = [{ x, y }];
  sound.noiseHit(0.12, 0.15, 1600);
}

function addPoint(x, y) {
  if (stroke.length >= 1600) return;
  const p = stroke[stroke.length - 1];
  if (!p || Math.hypot(x - p.x, y - p.y) > 2) stroke.push({ x, y });
}

function finishStroke() {
  if (!drawing) return;
  drawing = false;
  strokeCount++;
  const result = recognize(stroke);
  if (result.error) {
    pending = null;
    sound.effect('fail');
    if (brushSource === 'hold') {
      exitBrush(false);
      toast(result.error, 'THE BRUSH LIFTS', 2.4);
    } else paintBrushHint(result.error);
    return;
  }
  if (result.kind === 'kindle') {
    stroke = [];
    castSpell(result);
    if (gateOpen || brushSource === 'hold') exitBrush(false);
    else paintBrushHint(`The lamp takes the flame. ${litCount()} / 4 lit.`);
    return;
  }
  pending = result;
  paintBrushHint(brushSource === 'hold' ? 'Let go of the right mouse button to cast.' : 'A good mark.');
  exitBrush(true);
}

function exitBrush(cast = true) {
  if (!brush) return;
  if (drawing) {
    drawing = false;
    strokeCount++;
    const result = recognize(stroke);
    if (!result.error && result.kind !== 'kindle') pending = result;
  }
  const spell = cast ? pending : null;
  brush = false;
  pending = null;
  stroke = [];
  drawing = false;
  $('brushUI').classList.add('hidden');
  kit.canvas.style.filter = '';
  kit.canvas.style.cursor = '';
  setPlayChrome(true);
  touch?.suspend(false, 'brush');
  input.settle();
  sound.level();
  if (spell) castSpell(spell);
}

function updateBrush(dt) {
  const p = input.pointer;
  const mv = input.vector('move');
  if (mv.x || mv.y) {
    const sp = Math.min(W, H) * 0.95;
    cursor.x = clamp(cursor.x + mv.x * sp * dt, 8, W - 8);
    cursor.y = clamp(cursor.y - mv.y * sp * dt, 8, H - 8);
  }
  if (p.type === 'mouse' && (p.x !== lastPX || p.y !== lastPY)) {
    cursor.x = p.x;
    cursor.y = p.y;
  }
  lastPX = p.x;
  lastPY = p.y;
  if (!drawing) {
    if (brushSource === 'hold') {
      if (input.down('brushHold')) startStroke('hold', p.x, p.y);
      else {
        exitBrush(false);
        return;
      }
    } else if (input.pressed('paint')) startStroke('mouse', p.x, p.y);
    else if (p.justDown && p.type === 'touch') startStroke('touch', p.x, p.y);
    else if (input.pressed('draw')) startStroke('cursor', cursor.x, cursor.y);
  }
  if (drawing) {
    const src = drawSrc;
    const held = src === 'hold' ? input.down('brushHold') : src === 'mouse' ? input.down('paint') : src === 'touch' ? p.down : input.down('draw');
    const x = src === 'cursor' ? cursor.x : p.x;
    const y = src === 'cursor' ? cursor.y : p.y;
    addPoint(x, y);
    if (src !== 'cursor') {
      cursor.x = x;
      cursor.y = y;
    }
    if (!held) finishStroke();
  }
}

/* ================================================================== spells, combat */

function castSpell(spell) {
  const cost = spell.kind === 'kindle' ? KINDLE_COST : 1;
  if (player.ink < cost) return;
  player.ink -= cost;
  if (spell.kind === 'bloom') {
    const g = groves[spell.id];
    if (g.awake) return;
    g.awake = true;
    g.bloom = 0;
    bloomTree = g;
    bloomTime = g.id >= 2 ? 5 : 2.65;
    player.hp = 5;
    player.ink = 3;
    player.vx = player.vz = player.speed = 0;
    player.vy = 0;
    player.y = floorH(player.x, player.z);
    checkpoint = { x: g.x + 1.8, z: g.z + 3 };
    flash = 0.6;
    const moon = g.id === 3;
    sound.effect(moon ? 'moon' : 'bloom');
    input.rumble(0.4, 380);
    spawnPetals(g.x, g.y + g.h * 0.55, g.z, 125, null, 1.6, moon ? MOON_PETALS : PETALS);
    ring(g.x, g.z, moon ? '#eeeaf9' : '#f7df9d', 0.3, 2.7, 6);
    toast(['The first note.', 'The river finds its voice.', 'Spring, at last.', 'The last verse.'][g.id], ['REED GROVE RESTORED', 'BELL GROVE RESTORED', 'THE GREAT WILLOW AWAKENS', 'THE MOON PLUM AWAKENS'][g.id], 4);
    if (g.id === 2) {
      won = true;
      endAt = worldT + 6.2;
      endKind = 'tale';
    }
    if (moon) {
      moonAwake = true;
      endAt = worldT + 6.2;
      endKind = 'full';
    }
  } else if (spell.kind === 'mend') {
    bridgeMended = true;
    bridgeGrow = 0;
    flash = 0.2;
    sound.effect('mend');
    input.rumble(0.25, 160);
    toast('A path, painted back.', 'THE RIVER CROSSING', 3);
    for (let i = 0; i < 12; i++) spawnPetals(rnd(-1.5, 1.5), 0.5, -3 - i * 0.5, 4, '#debb72', 0.55);
  } else if (spell.kind === 'cut') {
    const e = camera.matrixWorld.elements;
    const rx = e[0];
    const ry = e[1];
    const rz = e[2];
    for (const foe of spell.refs) {
      damageEnemy(foe, 2, 'cut');
      const cy = foe.kind === 'crow' ? foe.y + 0.1 : terrainH(foe.x, foe.z) + 1.2;
      const s = slices[sliceNext];
      sliceNext = (sliceNext + 1) % slices.length;
      s.pts.set([foe.x - rx * 1.9, cy - ry * 1.9, foe.z - rz * 1.9, foe.x + rx * 1.9, cy + ry * 1.9, foe.z + rz * 1.9]);
      s.life = 0.4;
    }
    flash = 0.16;
  } else if (spell.kind === 'kindle') {
    const l = coldLanterns[spell.id];
    if (!l || l.lit) return;
    l.lit = true;
    l.glow = 0;
    sound.effect('kindle');
    input.rumble(0.2, 60);
    spawnPetals(l.x, l.y + l.h * 0.5, l.z, 14, '#f3d38a', 0.45);
    ring(l.x, l.z, '#f7df9d', 0.2, 1.1, 3);
    if (litCount() === coldLanterns.length) openGate();
  }
  updateUI();
  save();
}

function openGate() {
  gateOpen = true;
  checkpoint = { x: GATE.veilX, z: -43.5 };
  sound.effect('gate');
  flash = 0.3;
  input.rumble(0.5, 500);
  toast('The moon gate opens.', 'THE TERRACE BEYOND', 3.6);
  for (let i = 0; i < 10; i++) spawnPetals(GATE.veilX + rnd(-2.6, 2.6), terrainH(GATE.x, GATE.z) + rnd(0.5, 5), GATE.z, 5, INK, 0.5);
}

function damageEnemy(e, amount, kind = 'hit') {
  if (e.dead || (e.hit > 0 && kind !== 'cut')) return;
  e.hp = Math.max(0, e.hp - amount);
  e.hit = 0.28;
  e.state = 'stun';
  e.timer = 0.65;
  e.cd = 1.1 * C().cooldown;
  const dx = e.x - player.x;
  const dz = e.z - player.z;
  const l = Math.hypot(dx, dz) || 1;
  e.x += (dx / l) * 0.38;
  e.z += (dz / l) * 0.38;
  shake = kind === 'cut' ? 0.6 : 0.35;
  hitStop = 0.035;
  const ey = e.kind === 'crow' ? e.y : terrainH(e.x, e.z) + 1;
  spawnPetals(e.x, ey, e.z, amount * 10, INK, 1);
  sound.effect(kind);
  input.rumble(kind === 'cut' ? 0.5 : 0.35, 90);
  if (e.hp <= 0) {
    e.dead = true;
    e.dying = 0.4;
    kills++;
    sound.effect('kill');
    ring(e.x, e.z, '#efdfb0', 0.4, 1.1, 3.3);
    spawnPetals(e.x, ey, e.z, 32);
    player.ink = Math.min(3, player.ink + 0.55);
    if (e.kind === 'mask') {
      if (e.big) toast('The last knot comes undone.', 'THE GREAT WILLOW IS FREE', 3.3);
      else if (masks[0].dead && masks[1].dead) toast('A clear page.', 'THE BELL GROVE IS FREE', 3);
    } else if (crows.every((c) => c.dead)) toast('The sky is clear.', 'THE MOON PLUM IS FREE', 3.2);
    save();
  }
  updateUI();
}

function hurtPlayer(dmg = 1) {
  if (player.inv > 0 || player.hp <= 0 || moonAwake || (won && !gateOpen)) return;
  player.hp = Math.max(0, player.hp - dmg);
  player.inv = C().inv;
  shake = 0.8;
  flash = 0.13;
  sound.effect('hurt');
  input.rumble(0.7, 220);
  spawnPetals(player.x, player.y + 0.8, player.z, 12, '#dcc38d');
  updateUI();
  if (player.hp <= 0) {
    exitBrush(false);
    mode = 'defeat';
    showModal('defeat');
    sound.level();
  }
}

function melee() {
  if (mode !== 'play' || brush || bloomTime > 0 || player.attackCD > 0) return;
  player.attack = 0.3;
  player.attackCD = 0.37;
  const fl = floorH(player.x, player.z);
  const nearby = foes.filter((e) => e.active && !e.dead && dist(e, player) < 3.25 && (e.kind !== 'crow' || e.y < fl + 1.9)).sort((a, b) => dist(a, player) - dist(b, player));
  if (nearby.length) {
    const e = nearby[0];
    player.yaw = Math.atan2(e.x - player.x, e.z - player.z);
    for (const n of nearby) damageEnemy(n, 1);
  } else sound.effect('cut');
}

const dir = { x: 0, z: 0 };
function inputDirection() {
  const mv = input.vector('move');
  const x = mv.x;
  const z = -mv.y;
  if (!x && !z) {
    dir.x = dir.z = 0;
    return dir;
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  dir.x = x * c + z * s;
  dir.z = -x * s + z * c;
  return dir;
}

function dash() {
  if (mode !== 'play' || brush || bloomTime > 0 || player.dashCD > 0) return;
  player.dash = 0.22;
  player.dashCD = 0.92;
  player.inv = Math.max(player.inv, 0.33);
  const d = inputDirection();
  if (d.x || d.z) player.yaw = Math.atan2(d.x, d.z);
  player.vx = Math.sin(player.yaw) * 14;
  player.vz = Math.cos(player.yaw) * 14;
  sound.effect('dash');
  input.rumble(0.15, 60);
  ring(player.x, player.z, '#eee2b6', 0.15, 0.55, 2);
}

function jump() {
  if (mode !== 'play' || brush || bloomTime > 0) return;
  if (player.y <= floorH(player.x, player.z) + 0.07) {
    player.vy = 8.6;
    sound.effect('jump');
    spawnPetals(player.x, player.y + 0.1, player.z, 7, '#e0cf9d', 0.5);
  }
}

/* ================================================================== simulation */

// Things Mallow bumps into: rocks (can be hopped), trunks, lanterns, the gate posts, the grove trees.
const colliders = [];
for (const d of decor) {
  if (d.type === 'rock') colliders.push({ x: d.x, z: d.z, r: d.h * 0.36 + 0.22, top: d.y + d.h * 0.65 });
  else if (d.type === 'tree') colliders.push({ x: d.x, z: d.z, r: 0.5, top: Infinity });
  else if (d.type === 'bamboo') colliders.push({ x: d.x, z: d.z, r: 0.55, top: Infinity });
  else if (d.type === 'lantern') colliders.push({ x: d.x, z: d.z, r: 0.42, top: Infinity });
}
for (const l of coldLanterns) colliders.push({ x: l.x, z: l.z, r: 0.42, top: Infinity });
for (const px of GATE.posts) colliders.push({ x: px, z: GATE.z, r: 0.42, top: Infinity });
for (const g of groves) colliders.push({ x: g.x, z: g.z, r: g.id === 2 ? 0.95 : g.id === 3 ? 0.75 : 0.65, top: Infinity });

function updatePlayer(dt) {
  player.inv = Math.max(0, player.inv - dt);
  player.dashCD = Math.max(0, player.dashCD - dt);
  player.attackCD = Math.max(0, player.attackCD - dt);
  player.attack = Math.max(0, player.attack - dt);
  player.dash = Math.max(0, player.dash - dt);
  waterCD = Math.max(0, waterCD - dt);
  yaw += input.value('turn') * dt * 1.45;
  const d = inputDirection();
  if (player.dash <= 0) {
    const speed = 6.25;
    player.vx = lerp(player.vx, d.x * speed, 1 - Math.exp(-dt * 10));
    player.vz = lerp(player.vz, d.z * speed, 1 - Math.exp(-dt * 10));
    if (Math.hypot(d.x, d.z) > 0.1 && player.attack < 0.08) {
      const target = Math.atan2(d.x, d.z);
      const diff = Math.atan2(Math.sin(target - player.yaw), Math.cos(target - player.yaw));
      player.yaw += diff * (1 - Math.exp(-dt * 16));
    }
  }
  let nx = clamp(player.x + player.vx * dt, -20, 20);
  let nz = clamp(player.z + player.vz * dt, gateOpen ? -61 : -41, 21);
  for (const c of colliders) {
    if (player.y >= c.top) continue;
    const dd = Math.hypot(nx - c.x, nz - c.z);
    if (dd < c.r) {
      const a = Math.atan2(nx - c.x, nz - c.z);
      nx = c.x + Math.sin(a) * c.r;
      nz = c.z + Math.cos(a) * c.r;
    }
  }
  // The bridge rails keep Mallow on the planks once she is on them.
  const onBridge = bridgeMended && player.z < -2.7 && player.z > -9.3 && Math.abs(player.x) < 1.65 && player.y > 0.1;
  if (onBridge && nz < -2.7 && nz > -9.3) nx = clamp(nx, -1.6, 1.6);
  player.x = clamp(nx, -20, 20);
  player.z = clamp(nz, gateOpen ? -61 : -41, 21);
  player.vy -= 23 * dt;
  player.y += player.vy * dt;
  const water = player.z < -3 && player.z > -9 && !(bridgeMended && Math.abs(player.x) < 1.65);
  if (water && player.y < 0.08) {
    player.z = player.z > -6 ? -2.6 : -9.4;
    player.y = 0;
    player.vy = 0;
    player.vz = 0;
    if (waterCD <= 0) {
      sound.effect('splash');
      input.rumble(0.25, 120);
      spawnPetals(player.x, 0.2, player.z, 20, '#c2dac0', 0.75);
      guide(bridgeMended ? 'Stay between the bridge rails to cross the river.' : 'The current is strong. Wake the reed grove, then paint the bridge.');
      waterCD = 1.8;
    }
  }
  const floor = floorH(player.x, player.z);
  if (player.y < floor) {
    player.y = floor;
    player.vy = 0;
  }
  player.speed = Math.hypot(player.vx, player.vz);
  player.gait += player.speed * dt * 2.45;
  player.ink = Math.min(3, player.ink + dt * 0.38 * C().inkRate);
  movementTrail -= dt;
  if (player.speed > 1.2 && player.y <= floor + 0.12 && movementTrail <= 0) {
    movementTrail = player.dash > 0 ? 0.07 : 0.16;
    let near = won;
    if (!near) for (const g of groves) if (g.awake && dist(g, player) < 10) near = true;
    if (near) addMark(player.x, player.z);
    if (stepCount++ % 2 === 0) sound.effect('step');
    if (player.dash > 0) spawnPetals(player.x, player.y + 0.3, player.z, 3, '#e4d7ac', 0.4);
  }
}

function updateMasks(dt) {
  const ch = C();
  for (const e of masks) {
    if (e.dead) continue;
    e.hit = Math.max(0, e.hit - dt);
    if (e.id < 2 && bridgeMended && player.z < -9.1) e.active = true;
    if (e.big && groves[1].awake && player.z < -22) e.active = true;
    if (!e.active) continue;
    const d = dist(e, player);
    e.cd -= dt;
    if (e.state === 'stun') {
      e.timer -= dt;
      if (e.timer <= 0) e.state = 'idle';
      continue;
    }
    if (e.state === 'idle') {
      if (d > 2.5 && d < 18) {
        const speed = (e.big ? 1.7 : 2.1) * ch.speed;
        const dx = (player.x - e.x) / d;
        const dz = (player.z - e.z) / d;
        e.x += dx * speed * dt;
        e.z += dz * speed * dt;
        e.yaw = Math.atan2(dx, dz);
      }
      if (e.cd <= 0 && d < (e.big ? 5 : 5.2) && player.hp > 0) {
        e.state = 'wind';
        e.timer = e.windMax = (e.big ? 0.95 : 0.7) * ch.windup;
        const l = d || 1;
        e.dirX = (player.x - e.x) / l;
        e.dirZ = (player.z - e.z) / l;
        e.yaw = Math.atan2(e.dirX, e.dirZ);
        sound.tone(e.big ? 100 : 210, sound.now(), 0.16, 0.065, 'sine');
      }
    } else if (e.state === 'wind') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = e.big ? 'slam' : 'charge';
        e.timer = e.big ? 0.7 : 0.5;
        e.wave = 0;
        e.struck = false;
        sound.effect('hit');
      }
    } else if (e.state === 'charge') {
      e.x += e.dirX * 8 * ch.speed * dt;
      e.z += e.dirZ * 8 * ch.speed * dt;
      e.timer -= dt;
      if (dist(e, player) < 1.25 && player.y < terrainH(player.x, player.z) + 1.3) hurtPlayer(1);
      if (e.timer <= 0) {
        e.state = 'rest';
        e.timer = 1.2;
      }
    } else if (e.state === 'slam') {
      e.wave += dt * 7;
      e.timer -= dt;
      const dd = dist(e, player);
      if (!e.struck && Math.abs(dd - e.wave) < 0.75 && player.y < floorH(player.x, player.z) + 0.65) {
        hurtPlayer(ch.slam);
        e.struck = true;
      }
      if (e.timer <= 0) {
        e.state = 'rest';
        e.timer = 1.5;
      }
    } else if (e.state === 'rest') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'idle';
        e.cd = 0.5 * ch.cooldown;
      }
    }
    e.x = clamp(e.x, -17, 17);
    e.z = clamp(e.z, -37, -10.2);
  }
}

function crowHome(c) {
  return terrainH(c.x, c.z) + 3.2 + Math.sin(worldT * 2 + c.id) * 0.25;
}
function updateCrows(dt) {
  const ch = C();
  for (const c of crows) {
    if (c.dead) continue;
    c.hit = Math.max(0, c.hit - dt);
    if (!c.active && player.z < -43.5) c.active = true;
    const ground = terrainH(c.x, c.z);
    if (c.state === 'circle' || !c.active) {
      c.ang += dt * 0.9;
      const tx = c.homeX + Math.cos(c.ang) * 2.4;
      const tz = c.homeZ + Math.sin(c.ang) * 2.4;
      const k = 1 - Math.exp(-dt * 2.5);
      const ox = c.x;
      const oz = c.z;
      c.x += (tx - c.x) * k;
      c.z += (tz - c.z) * k;
      c.y += (crowHome(c) - c.y) * k;
      if (Math.hypot(c.x - ox, c.z - oz) > 1e-4) c.yaw = Math.atan2(c.x - ox, c.z - oz);
      if (!c.active) continue;
      c.cd -= dt;
      const d = dist(c, player);
      if (c.cd <= 0 && d < 13 && player.hp > 0) {
        c.state = 'caw';
        c.timer = c.windMax = 0.85 * ch.windup;
        c.tx = player.x;
        c.tz = player.z;
        c.yaw = Math.atan2(c.tx - c.x, c.tz - c.z);
        sound.effect('caw');
      }
      continue;
    }
    c.cd -= dt;
    if (c.state === 'caw') {
      c.timer -= dt;
      c.y += (ground + 3.8 - c.y) * (1 - Math.exp(-dt * 3));
      c.yaw = Math.atan2(c.tx - c.x, c.tz - c.z);
      if (c.timer <= 0) {
        c.state = 'dive';
        c.timer = 0.6 / ch.speed;
        c.windMax = c.timer;
        c.sx = c.x;
        c.sy = c.y;
        c.sz = c.z;
        c.struck = false;
      }
    } else if (c.state === 'dive') {
      c.timer -= dt;
      const u = clamp(1 - c.timer / c.windMax, 0, 1);
      const e = u * u;
      c.x = lerp(c.sx, c.tx, u);
      c.z = lerp(c.sz, c.tz, u);
      c.y = lerp(c.sy, terrainH(c.tx, c.tz) + 0.45, e);
      if (!c.struck && c.y < floorH(player.x, player.z) + 1.5 && dist(c, player) < 1.2 && player.y < floorH(player.x, player.z) + 1.2) {
        hurtPlayer(1);
        c.struck = true;
      }
      if (c.timer <= 0) {
        c.state = 'rest';
        c.timer = 1.4;
        ring(c.x, c.z, '#d8cba6', 0.2, 0.6, 3);
      }
    } else if (c.state === 'rest' || c.state === 'stun') {
      c.timer -= dt;
      c.y += (ground + 0.45 - c.y) * (1 - Math.exp(-dt * 10));
      if (c.timer <= 0) {
        c.state = 'rise';
        c.timer = 0.8;
      }
    } else if (c.state === 'rise') {
      c.timer -= dt;
      const k = 1 - Math.exp(-dt * 3);
      c.x += (c.homeX - c.x) * k * 0.6;
      c.z += (c.homeZ - c.z) * k * 0.6;
      c.y += (crowHome(c) - c.y) * k;
      c.yaw = Math.atan2(c.homeX - c.x, c.homeZ - c.z);
      if (c.timer <= 0) {
        c.state = 'circle';
        c.ang = Math.atan2(c.z - c.homeZ, c.x - c.homeX);
        c.cd = (2 + rand() * 1.4) * ch.cooldown;
      }
    }
    c.x = clamp(c.x, -18, 16);
    c.z = clamp(c.z, -60, -43);
  }
}

function updateEffects(dt) {
  for (let i = partCount - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.y += p.vy * dt;
    p.vy -= dt * 1.7;
    p.vx *= 1 - dt * 0.2;
    p.vz *= 1 - dt * 0.2;
    p.angle += p.spin * dt;
    if (p.y < terrainH(p.x, p.z) + 0.05) p.vy = Math.abs(p.vy) * 0.13;
    if (p.life <= 0) {
      parts[i] = parts[partCount - 1];
      parts[partCount - 1] = p;
      partCount--;
    }
  }
  if (partOverwrite >= partCount) partOverwrite = 0;
  for (const r of ripples) {
    if (!r.on) continue;
    r.life -= dt;
    r.r += r.speed * dt;
    if (r.life <= 0) r.on = false;
  }
  for (const m of marks) if (m.life > 0) m.life -= dt;
  for (const s of slices) if (s.life > 0) s.life -= dt;
  for (const g of groves) if (g.awake) g.bloom += dt;
  for (const e of foes) if (e.dead && e.dying > 0) e.dying -= dt;
  for (const l of coldLanterns) if (l.lit && l.glow < 1) l.glow = Math.min(1, l.glow + dt * 2);
  bridgeGrow += dt;
  if (gateOpen && veilT < 1) {
    veilT = Math.min(1, veilT + dt / 2.2);
    if (frameCount % 3 === 0) spawnPetals(GATE.veilX + rnd(-2.8, 2.8), terrainH(GATE.x, GATE.z) + rnd(0.3, 6), GATE.z, 1, INK, 0.3);
  }
  if (frameCount % 18 === 0) {
    let pickD = null;
    let seen = 0;
    for (const d of decor) {
      if (d.type !== 'tree' || d.index >= 2 || dist(d, player) >= 22) continue;
      seen++;
      if (rand() * seen < 1) pickD = d;
    }
    if (pickD) spawnPetals(pickD.x + rnd(-2, 2), pickD.y + pickD.h * 0.65, pickD.z + rnd(-1, 1), 1);
  }
}

function moveCamera(dt) {
  if (mode === 'title') {
    const angle = 0.52 + Math.sin(worldT * 0.07) * 0.08;
    camPos.set(2 + Math.sin(angle) * 20, 7.2, 9 + Math.cos(angle) * 20);
    camTarget.set(-2, 2.5, 1);
    return;
  }
  const blend = 1 - Math.exp(-dt * 4);
  camFollow.x = lerp(camFollow.x, player.x, blend);
  camFollow.z = lerp(camFollow.z, player.z, blend);
  camFollow.y = lerp(camFollow.y, floorH(player.x, player.z), blend);
  zoom += (zoomWant - zoom) * (1 - Math.exp(-dt * 6));
  const tall = groves[1].awake ? clamp((-player.z - 18) / 8, 0, 1) : 0;
  const back = (11.5 + tall * 3.5) * zoom;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  let px = camFollow.x + s * back;
  let py = camFollow.y + (6.2 + tall) * zoom;
  let pz = camFollow.z + c * back;
  let tx = camFollow.x - s * 3;
  let ty = camFollow.y + 1.7 + tall * 2.5;
  let tz = camFollow.z - c * 3;
  if (bloomTime > 0 && bloomTree) {
    const g = bloomTree;
    tx = lerp(tx, g.x, 0.5);
    ty = g.y + g.h * 0.35;
    tz = lerp(tz, g.z, 0.5);
    py += g.h > 12 ? 2.3 : g.h > 10 ? 1.4 : 0.7;
  }
  const kp = 1 - Math.exp(-dt * 3.8);
  const kt = 1 - Math.exp(-dt * 4.5);
  camPos.x += (px - camPos.x) * kp;
  camPos.y += (py - camPos.y) * kp;
  camPos.z += (pz - camPos.z) * kp;
  camTarget.x += (tx - camTarget.x) * kt;
  camTarget.y += (ty - camTarget.y) * kt;
  camTarget.z += (tz - camTarget.z) * kt;
}

function step(h) {
  let st = h;
  if (hitStop > 0) {
    hitStop -= h;
    st = 0;
  }
  worldT += st;
  flash = Math.max(0, flash - h * 1.3);
  shake = Math.max(0, shake - h * 3);
  if (mode === 'play') {
    if (!won) taleTime += st;
    if (!moonAwake) fullTime += st;
    if (bloomTime > 0) bloomTime = Math.max(0, bloomTime - st);
    else {
      updatePlayer(st);
      if (!won) updateMasks(st);
      if (gateOpen && !moonAwake) updateCrows(st);
    }
    if (endAt && worldT > endAt) {
      endAt = 0;
      showEnd(endKind);
    }
  }
  updateEffects(st);
}

/* ================================================================== menus, modes, flow */

const MODALS = ['help', 'restart', 'defeat', 'ending'];
function showModal(id) {
  for (const m of MODALS) $(m).classList.toggle('hidden', m !== id);
  touch?.suspend(true, 'modal');
  menuOpened();
}
function hideModals() {
  for (const m of MODALS) $(m).classList.add('hidden');
}

function startPlay() {
  mode = 'play';
  hideModals();
  $('start').classList.add('hidden');
  $('hud').classList.remove('hidden');
  touch?.suspend(false, 'modal');
  kit.menu.setGear('none');
  document.activeElement?.blur?.();
  sound.start();
  sound.level();
  guideKey = '';
  updateUI();
  input.settle();
}

function resetWorld() {
  if (brush) exitBrush(false);
  Object.assign(player, { x: 0, z: 14, y: 0, vy: 0, yaw: PI, speed: 0, vx: 0, vz: 0, gait: 0, hp: 5, ink: 3, dash: 0, dashCD: 0, attack: 0, attackCD: 0, inv: 0 });
  for (const g of groves) {
    g.awake = false;
    g.bloom = 0;
  }
  for (const e of masks) {
    const d = WORLD.maskDefs[e.id];
    Object.assign(e, makeMask(d.id, d.x, d.z, d.big, d.anim), { dying: 0 });
    e.hp = e.maxhp = (e.big ? 6 : 3) + C().maskHp;
  }
  for (const c of crows) {
    const [id, x, z] = WORLD.crowDefs[c.id];
    Object.assign(c, makeCrow(id, x, z), { dying: 0 });
    c.hp = c.maxhp = C().crowHp;
  }
  for (const l of coldLanterns) {
    l.lit = false;
    l.glow = 0;
  }
  partCount = 0;
  partOverwrite = 0;
  for (const m of marks) m.life = 0;
  for (const r of ripples) r.on = false;
  for (const s of slices) s.life = 0;
  stroke = [];
  strokeCount = taleTime = fullTime = kills = 0;
  bridgeMended = won = epilogue = moonAwake = gateOpen = false;
  bridgeGrow = bloomTime = endAt = flash = shake = hitStop = waterCD = veilT = 0;
  taleRecorded = fullRecorded = false;
  guideKey = '';
  guideOverride = '';
  checkpoint = { x: 0, z: 14 };
  bloomTree = null;
  yaw = 0;
  camFollow.x = 0;
  camFollow.y = 0;
  camFollow.z = 14;
  camPos.set(0, 6.2, 25.5);
  camTarget.set(0, 1.7, 11);
  springMix = 0;
  applyTints();
  runChallenge = challenge;
  paintChallenge();
}

function resetGame() {
  resetWorld();
  startPlay();
  sound.reset();
  toast('The Sleeping Vale', 'A TALE IN THREE VERSES', 3.3);
  save();
}

function applySave(s) {
  resetWorld();
  if (CHALLENGES[s.challenge]) {
    challenge = s.challenge;
    store.set(CHAL_KEY, challenge);
    for (const e of masks) e.hp = e.maxhp = (e.big ? 6 : 3) + C().maskHp;
    for (const c of crows) c.hp = c.maxhp = C().crowHp;
  }
  runChallenge = CHALLENGES[s.run] ? easier(s.run, challenge) : challenge;
  paintChallenge();
  groves.forEach((g, i) => {
    g.awake = !!s.groves[i];
    g.bloom = g.awake ? 60 : 0;
  });
  bridgeMended = !!s.bridge;
  bridgeGrow = 60;
  masks.forEach((e, i) => {
    if (s.masks?.[i]) e.dead = true;
  });
  crows.forEach((c, i) => {
    if (s.crows?.[i]) c.dead = true;
  });
  coldLanterns.forEach((l, i) => {
    l.lit = !!s.lit?.[i];
    l.glow = l.lit ? 1 : 0;
  });
  gateOpen = !!s.gate;
  veilT = gateOpen ? 1 : 0;
  won = !!s.won;
  epilogue = !!s.epilogue;
  moonAwake = !!s.moon;
  taleTime = +s.taleTime || 0;
  fullTime = +s.fullTime || 0;
  strokeCount = +s.strokes || 0;
  kills = +s.kills || 0;
  taleRecorded = !!s.taleRecorded;
  fullRecorded = !!s.fullRecorded;
  // A tale left during its closing bloom still counts, and the epilogue is open from here.
  if (won && !taleRecorded) {
    recordFinish('tale', taleTime, strokeCount);
    taleRecorded = true;
  }
  if (moonAwake && !fullRecorded) {
    recordFinish('full', fullTime, strokeCount);
    fullRecorded = true;
  }
  if (won) epilogue = true;
  if (s.cp && Number.isFinite(s.cp.x) && Number.isFinite(s.cp.z)) checkpoint = { x: s.cp.x, z: s.cp.z };
  player.hp = s.hp > 0 ? Math.min(5, s.hp) : 5;
  player.ink = clamp(+s.ink || 0, 0, 3);
  let x = +s.x;
  let z = +s.z;
  // Never wake up in the river, past the veil or on a bridge that is not there.
  if (!Number.isFinite(x) || !Number.isFinite(z) || (z < -2.5 && z > -9.5) || (!gateOpen && z < -40.5) || s.hp <= 0) {
    x = checkpoint.x;
    z = checkpoint.z;
  }
  player.x = clamp(x, -20, 20);
  player.z = clamp(z, gateOpen ? -61 : -41, 21);
  player.y = floorH(player.x, player.z);
  yaw = Number.isFinite(s.yaw) ? s.yaw : 0;
  camFollow.x = player.x;
  camFollow.y = player.y;
  camFollow.z = player.z;
  camPos.set(player.x + Math.sin(yaw) * 11.5, player.y + 6.2, player.z + Math.cos(yaw) * 11.5);
  camTarget.set(player.x - Math.sin(yaw) * 3, player.y + 1.7, player.z - Math.cos(yaw) * 3);
  springMix = won ? 1 : 0;
  applyTints();
}

function continueGame() {
  const s = readSave();
  if (!s) {
    resetGame();
    return;
  }
  applySave(s);
  startPlay();
  sound.reset();
  toast('The tale continues.', STAGES[computeStage()][0], 3);
}

function showTitle() {
  if (brush) exitBrush(false);
  mode = 'title';
  hideModals();
  $('hud').classList.add('hidden');
  $('start').classList.remove('hidden');
  const s = readSave();
  $('continue').classList.toggle('hidden', !s);
  $('begin').innerHTML = s ? 'Begin a new tale <b>→</b>' : 'Enter the vale <b>→</b>';
  paintChallenge();
  paintRecord();
  touch?.suspend(true, 'modal');
  kit.menu.setGear('tr');
  sound.level();
  menuOpened();
}

function pause() {
  if (mode !== 'play') return;
  exitBrush(false);
  mode = 'pause';
  showModal('help');
  sound.level();
  save();
}
function resume() {
  if (mode !== 'pause') return;
  mode = 'play';
  hideModals();
  touch?.suspend(false, 'modal');
  document.activeElement?.blur?.();
  sound.start();
  sound.level();
  input.settle();
}
let beforeRestart = 'play';
function askRestart() {
  if (mode === 'title' || mode === 'defeat' || mode === 'restart') return;
  exitBrush(false);
  beforeRestart = mode;
  mode = 'restart';
  showModal('restart');
  sound.level();
}
function cancelRestart() {
  if (mode !== 'restart') return;
  mode = beforeRestart;
  if (mode === 'pause') showModal('help');
  else if (mode === 'ending') showModal('ending');
  else {
    hideModals();
    touch?.suspend(false, 'modal');
    input.settle();
  }
  sound.level();
}

function showEnd(kind) {
  mode = 'ending';
  const full = kind === 'full';
  const time = full ? fullTime : taleTime;
  $('endKicker').textContent = full ? 'FOUR GROVES · THE FULL SONG' : 'THREE GROVES · ONE SONG';
  $('endTitle').innerHTML = full ? 'Every verse, sung.<br>The vale is awake.' : 'A little ink.<br>A world in bloom.';
  $('endText').innerHTML = full ? 'The moon plum hums the last line of the river’s song.<br>Pip folds you a small paper star.' : 'The river remembers its song.<br>And someone remembers to sing along.';
  $('endGroves').textContent = full ? '4 / 4' : '3 / 3';
  $('endStrokes').textContent = String(strokeCount);
  $('endTime').textContent = fmtTime(time);
  $('endKills').textContent = String(kills);
  $('explore').textContent = full ? 'Walk under the moon' : 'Walk in spring';
  let bestLine = '';
  const already = full ? fullRecorded : taleRecorded;
  const filed = CHALLENGES[runChallenge].label.toUpperCase();
  if (!already) {
    const { best, isNew } = recordFinish(full ? 'full' : 'tale', time, strokeCount);
    bestLine = isNew ? `A NEW BEST · ${filed}` : `BEST ${fmtTime(best.time)} · ${filed}`;
    if (full) fullRecorded = true;
    else taleRecorded = true;
  } else {
    const best = readRecords()[full ? 'full' : 'tale']?.[runChallenge];
    if (best) bestLine = `BEST ${fmtTime(best.time)} · ${filed}`;
  }
  $('endBest').textContent = full || bestLine === '' ? bestLine : `${bestLine} · AN EPILOGUE WAITS AT THE OLD GATE`;
  showModal('ending');
  sound.level();
  save();
}

function explore() {
  if (mode !== 'ending') return;
  mode = 'play';
  hideModals();
  touch?.suspend(false, 'modal');
  document.activeElement?.blur?.();
  bloomTime = 0;
  endAt = 0;
  if (won && !epilogue) {
    epilogue = true;
    setTimeout(() => {
      if (mode === 'play' && !gateOpen) toast('The old gate has gone quiet.', 'AN EPILOGUE · THE MOON GATE', 3.6);
    }, 900);
  }
  guideKey = '';
  updateUI();
  sound.level();
  input.settle();
  save();
}

function revive() {
  if (mode !== 'defeat') return;
  player.hp = 5;
  player.ink = 3;
  player.x = checkpoint.x;
  player.z = checkpoint.z;
  player.y = floorH(player.x, player.z);
  player.vy = player.vx = player.vz = 0;
  player.inv = 2;
  player.dash = player.attack = 0;
  for (const e of masks) {
    if (e.dead) continue;
    e.x = e.homeX;
    e.z = e.homeZ;
    e.state = 'idle';
    e.cd = 2;
  }
  for (const c of crows) {
    if (c.dead) continue;
    c.x = c.homeX;
    c.z = c.homeZ;
    c.y = terrainH(c.x, c.z) + 3.2;
    c.state = 'circle';
    c.cd = 2.5;
    c.active = false;
  }
  mode = 'play';
  hideModals();
  touch?.suspend(false, 'modal');
  document.activeElement?.blur?.();
  camFollow.x = player.x;
  camFollow.y = player.y;
  camFollow.z = player.z;
  yaw = 0;
  camPos.set(player.x, player.y + 6.2, player.z + 11.5);
  camTarget.set(player.x, player.y + 1.7, player.z - 3);
  sound.start();
  sound.level();
  updateUI();
  input.settle();
  toast('A fresh drop of courage.', 'LIFE AND INK RESTORED', 2.5);
  save();
}

// Menu navigation for a gamepad or the keyboard: up/down (or left/right) moves, A / Enter / Space confirms, B / Backspace goes back.
const nav = { index: -1, held: 0, repeatAt: 0 };
function menuRoot() {
  if (mode === 'title') return $('start');
  if (mode === 'pause') return $('help');
  if (mode === 'restart') return $('restart');
  if (mode === 'defeat') return $('defeat');
  if (mode === 'ending') return $('ending');
  return null;
}
const navButtons = (root) => [...root.querySelectorAll('button')].filter((b) => !b.disabled && !b.classList.contains('close') && b.getClientRects().length > 0);
function navFocus(list, i) {
  nav.index = ((i % list.length) + list.length) % list.length;
  for (const b of list) b.classList.remove('is-focus');
  const b = list[nav.index];
  b.focus({ preventScroll: true });
  b.classList.add('is-focus');
  b.scrollIntoView?.({ block: 'nearest' });
}
function menuOpened() {
  nav.index = -1;
  for (const b of document.querySelectorAll('button.is-focus')) b.classList.remove('is-focus');
  if (input.source === 'gamepad') {
    const root = menuRoot();
    const list = root ? navButtons(root) : [];
    if (list.length) navFocus(list, 0);
  }
}
function navUpdate() {
  const root = menuRoot();
  if (!root) return;
  const mv = input.vector('move');
  let d = 0;
  if (mv.y > 0.5 || mv.x < -0.5) d = -1;
  else if (mv.y < -0.5 || mv.x > 0.5) d = 1;
  const now = performance.now();
  if (d && (d !== nav.held || now >= nav.repeatAt)) {
    const list = navButtons(root);
    if (list.length) navFocus(list, nav.index < 0 ? (d > 0 ? 0 : list.length - 1) : nav.index + d);
    nav.repeatAt = now + (d !== nav.held ? 380 : 150);
  }
  nav.held = d;
  const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON' && root.contains(document.activeElement);
  if (input.pressed('confirm') || (input.pressed('jump') && !onButton)) {
    const list = navButtons(root);
    const b = nav.index >= 0 ? list[nav.index] : list[0];
    b?.click();
    return;
  }
  if (input.pressed('back')) {
    if (mode === 'pause') resume();
    else if (mode === 'restart') cancelRestart();
  }
}
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && nav.index >= 0 && Math.abs(e.movementX) + Math.abs(e.movementY) > 3) {
    for (const b of document.querySelectorAll('button.is-focus')) b.classList.remove('is-focus');
  }
});

$('begin').addEventListener('click', resetGame);
$('continue').addEventListener('click', continueGame);
$('challenge').addEventListener('click', cycleChallenge);
$('challengeOpt').addEventListener('click', () => {
  cycleChallenge();
  save();
});
$('sound').addEventListener('click', () => sound.toggle());
$('soundOpt').addEventListener('click', () => sound.toggle());
$('helpBtn').addEventListener('click', pause);
$('closeHelp').addEventListener('click', resume);
$('resume').addEventListener('click', resume);
$('restartBtn').addEventListener('click', askRestart);
$('cancelRestart').addEventListener('click', cancelRestart);
$('confirmRestart').addEventListener('click', resetGame);
$('revive').addEventListener('click', revive);
$('again').addEventListener('click', resetGame);
$('explore').addEventListener('click', explore);
$('settingsBtn').addEventListener('click', () => kit.menu.open());
$('titleBtn').addEventListener('click', () => {
  save();
  showTitle();
});
$('brushCancel').addEventListener('click', () => exitBrush(false));

addEventListener('blur', () => {
  if (mode === 'play') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'play') pause();
    else if (mode !== 'title') save();
    sound.hold(true);
  } else sound.hold(kit.paused);
});
addEventListener('pagehide', () => {
  if (mode !== 'title') save();
});

/* ================================================================== input per frame */

function handleInput(dt) {
  if (input.pressed('mute')) sound.toggle();
  if (brush) {
    if (input.pressed('pause') || input.pressed('back')) exitBrush(false);
    else if (input.pressed('brush')) exitBrush(true);
    else if (brushSource === 'hold' && input.released('brushHold') && !drawing) exitBrush(true);
    return;
  }
  if (mode === 'play') {
    if (input.pressed('pause')) {
      pause();
      return;
    }
    if (input.pressed('restart')) {
      askRestart();
      return;
    }
    if (input.pressed('brush')) enterBrush('toggle');
    else if (input.pressed('brushHold')) enterBrush('hold');
    if (brush) return;
    if (input.pressed('dash')) dash();
    if (input.pressed('jump')) jump();
    if (input.pressed('strike')) melee();
    if (bloomTime <= 0) {
      const lk = input.look('look');
      yaw -= lk.x;
      // + is "zoom in": the camera comes closer.
      const zin = input.zoom() * 0.08 + input.value('zoom') * dt * 0.9;
      if (zin) zoomWant = clamp(zoomWant - zin, ZOOM_MIN, ZOOM_MAX);
    }
    return;
  }
  if (mode === 'pause' && input.pressed('pause')) {
    resume();
    return;
  }
  if (mode === 'pause' && input.pressed('restart')) {
    askRestart();
    return;
  }
  if (mode === 'restart' && input.pressed('pause')) {
    cancelRestart();
    return;
  }
  navUpdate();
}

/* ================================================================== drawing the frame */

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const VP = { x: 0, y: 0, d: 0, s: 0, visible: false };
const BP = { x: 0, y: 0, d: 0, s: 0, visible: false };
let tanH = 1;

/** Queue one painted sprite with the original's distance fade and see-through-when-in-front rule. */
function billboard(key, x, y, z, h, alpha, occlude, sway, obj, dt) {
  const cp = camera.position;
  const dx = x - cp.x;
  const dy = y - cp.y;
  const dz = z - cp.z;
  const d = dx * _fwd.x + dy * _fwd.y + dz * _fwd.z;
  if (d < 0.2 || d > 94) return;
  const w = h * AR[key];
  const side = Math.abs(dx * _right.x + dy * _right.y + dz * _right.z);
  if (side - w > d * tanH + 2) return;
  let a = alpha * clamp((100 - d) / 55, 0, 1);
  if (occlude && obj) {
    let target = 1;
    if (VP.visible) {
      project(x, y, z, BP);
      const ww = w * BP.s;
      const hh = h * BP.s;
      if (BP.d < VP.d - 1 && Math.abs(BP.x - VP.x) < ww * 0.37 && VP.y < BP.y && VP.y > BP.y - hh) target = 0.31;
    }
    obj.fade += (target - obj.fade) * (1 - Math.exp(-dt * 10));
    a *= obj.fade;
  }
  sprites.add(x, y, z, w, h, sway, a, R[key]);
}

const DECOR_KEY = (d) => (d.type === 'tree' ? `tree${d.index}` : d.type === 'rock' ? `rock${d.index}` : d.type);

function syncVisuals(dt) {
  // Camera, with the original's little paper shake.
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  if (shake > 0) {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const ox = Math.sin(realT * 85) * shake * 0.055;
    const oy = Math.cos(realT * 71) * shake * 0.04;
    camera.position.x += e[0] * ox + e[4] * oy;
    camera.position.y += e[1] * ox + e[5] * oy;
    camera.position.z += e[2] * ox + e[6] * oy;
  }
  camera.updateMatrixWorld();
  camera.getWorldDirection(_fwd);
  _right.setFromMatrixColumn(camera.matrixWorld, 0);
  tanH = Math.tan((FOV * PI) / 360) * (W / Math.max(1, H));
  backdrop.follow(camera, worldT);

  // Spring colours ease in when the tale is won.
  const want = won ? 1 : 0;
  if (Math.abs(springMix - want) > 0.001) {
    springMix += clamp(want - springMix, -dt / 2.5, dt / 2.5);
    applyTints();
  }

  // Mallow and Pip.
  const blink = player.inv > 0 && Math.floor(realT * 14) % 2 === 0 && player.dash <= 0;
  wolf.update({ x: player.x, y: player.y, z: player.z, yaw: player.yaw, gait: player.gait, speed: player.speed, attack: player.attack, worldT, visible: !blink, floorY: floorH(player.x, player.z) });
  pip.update(player.x + 1.35 + Math.sin(worldT * 1.3) * 0.27, player.y + 2.25 + Math.sin(worldT * 2.4) * 0.16, player.z + 0.3, Math.sin(worldT * 7) * 0.3);

  // Masks and crows, with their ground telegraphs.
  masks.forEach((e, i) => {
    const y = terrainH(e.x, e.z) + Math.sin(worldT * 3 + e.anim) * 0.08 + 0.1;
    maskVis[i].update(e, y, worldT, terrainH(e.x, e.z));
  });
  crows.forEach((c, i) => {
    // The crows only take wing once the veil lifts.
    if (!gateOpen) {
      crowVis[i].root.visible = false;
      crowVis[i].shadow.visible = false;
    } else crowVis[i].update(c, worldT, terrainH(c.x, c.z));
  });
  foes.forEach((e, i) => {
    const D = foeDecals[i];
    const live = !e.dead && e.active;
    if (live && e.state === 'wind') {
      const r = e.big ? 3.4 : 1.45;
      D.wind.set(e.x, e.z, r, terrainH, 0.1, 0.03);
      D.windRing.set(e.x, e.z, r * (1 - e.timer / e.windMax), terrainH, 0.05, 0.035);
    } else if (live && e.kind === 'crow' && (e.state === 'caw' || e.state === 'dive')) {
      const k = e.state === 'caw' ? 1 - e.timer / e.windMax : 1;
      D.wind.set(e.tx, e.tz, 1.3, floorH, 0.1, 0.03);
      D.windRing.set(e.tx, e.tz, 1.3 * k, floorH, 0.05, 0.035);
    } else {
      D.wind.hide();
      D.windRing.hide();
    }
    if (live && e.state === 'slam') {
      D.slam.set(e.x, e.z, e.wave, terrainH, 0.09, 0.04);
      D.slam2.set(e.x, e.z, e.wave * 0.98, terrainH, 0.045, 0.045);
    } else {
      D.slam.hide();
      D.slam2.hide();
    }
  });

  // Groves: the grey sleeping ring, then the growing green bloom with a pale leading edge.
  groves.forEach((g, i) => {
    const D = groveDecals[i];
    if (!g.awake) {
      D.dead.set(g.x, g.z, g.id === 2 ? 6 : 4.4, terrainH, 0.1, 0.028);
      D.fill.hide();
      D.inner.hide();
      D.edge.hide();
    } else {
      D.dead.hide();
      const r = (g.id === 2 ? 35 : 9.3) * Math.min(g.bloom / 2.8, 1);
      D.fill.set(g.x, g.z, r, terrainH, 0.1, 0.028);
      D.inner.set(g.x, g.z, r * 0.8, terrainH, 0.1, 0.03);
      if (g.bloom < 3.5) D.edge.set(g.x, g.z, r + 0.1, terrainH, 0.07, 0.034, 1 - g.bloom / 3.5);
      else D.edge.hide();
    }
  });
  for (const rp of ripples) {
    if (rp.on) rp.decal.set(rp.x, rp.z, rp.r, floorH, 0.07, 0.036, clamp(rp.life / rp.max, 0, 1), bridgeMended ? 1 : 0);
    else rp.decal.hide();
  }

  // The bridge, the gate and its veil.
  bridge.update(bridgeMended, bridgeGrow, groves[0].awake && !bridgeMended, realT);
  gateVis.setOpen(veilT);
  const gx = Math.abs(camera.position.x - GATE.x);
  const gz = Math.abs(camera.position.z - GATE.z);
  gateMesh.material.opacity = gx < GATE.w * 0.6 && gz < 3 ? 0.25 + 0.75 * (gz / 3) : 1;
  streaks.update(worldT);

  // Lantern glows.
  for (const l of coldLanterns) {
    l.sprite.visible = l.lit;
    if (l.lit) l.sprite.scale.setScalar(1.5 * l.glow * (0.94 + Math.sin(realT * 7 + l.id * 2) * 0.06));
  }

  // Slices.
  for (const s of slices) {
    const on = s.life > 0;
    s.outer.visible = s.inner.visible = on;
    if (!on) continue;
    s.outer.set(s.pts, s.life * 0.2 + 0.012);
    s.inner.set(s.pts, 0.01);
    s.outer.material.opacity = s.inner.material.opacity = clamp(s.life / 0.4, 0, 1);
  }

  // Painted sprites.
  project(player.x, player.y + 1, player.z, VP);
  sprites.begin();
  for (const d of decor) {
    if (d.type === 'gate') continue;
    const occ = d.type === 'tree' || d.type === 'bamboo';
    billboard(DECOR_KEY(d), d.x, d.y, d.z, d.h, 1, occ, d.type === 'bamboo' ? Math.sin(worldT + d.phase) * 0.008 : 0, d, dt);
  }
  for (const l of coldLanterns) billboard(l.lit ? 'lantern' : 'lanternCold', l.x, l.y, l.z, l.h, 1, false, 0, null, dt);
  for (const g of groves) {
    g.fade ??= 1;
    if (!g.awake) billboard(`g${g.id}d`, g.x, g.y, g.z, g.h, 1, true, 0, g, dt);
    else {
      billboard(`g${g.id}l`, g.x, g.y, g.z, g.h, Math.min(g.bloom * 1.7, 1), true, 0, g, dt);
      if (g.bloom < 0.6) billboard(`g${g.id}d`, g.x, g.y, g.z, g.h, 1 - g.bloom / 0.6, false, 0, null, dt);
    }
  }
  const detail = Math.min(1, kit.tier.detail);
  for (const b of grass) {
    if (b.phase / TAU > detail) continue;
    billboard(`grass${b.index}`, b.x, b.y, b.z, b.h, 0.9, false, Math.sin(worldT * 1.7 + b.phase) * 0.025, null, dt);
  }
  for (const g of groves) {
    if (!g.awake) continue;
    const reach = (g.id === 2 ? 35 : 9.3) * Math.min(g.bloom / 2.8, 1);
    const spread = g.id === 2 && won ? 23 : g.id === 3 ? 11 : 8.2;
    for (let i = 0; i < 42; i++) {
      const ang = i * 2.39996;
      const r = Math.sqrt(i / 42) * spread;
      if (r > reach) continue;
      const x = g.x + Math.cos(ang) * r;
      const z = g.z + Math.sin(ang) * r;
      if (z > -9.3 && z < -2.7) continue;
      billboard(`flower${i % 3}`, x, terrainH(x, z) + 0.02, z, 0.55 + (i % 4) * 0.1, Math.min(g.bloom, 1), false, 0, null, dt);
    }
  }
  for (const m of marks) if (m.life > 0) billboard(`flower${m.index}`, m.x, floorH(m.x, m.z) + 0.03, m.z, 0.47, Math.min(m.life, 1), false, 0, null, dt);
  sprites.commit(camera);

  // Particles.
  parts3d.begin();
  for (let i = 0; i < partCount; i++) {
    const p = parts[i];
    const a = clamp(p.life / p.max, 0, 1);
    if (p.ink) parts3d.add(p.x, p.y, p.z, p.size * 2, p.size * 2, p.angle, a, RECT_INK, p.col.r, p.col.g, p.col.b);
    else parts3d.add(p.x, p.y, p.z, p.size * 2, p.size * 0.86, p.angle, a, RECT_PETAL, p.col.r, p.col.g, p.col.b);
  }
  parts3d.commit(camera);
}

/* ================================================================== overlays: brush, markers, map */

function inkStroke(c, points, alpha = 1) {
  if (points.length < 1) return;
  c.save();
  c.globalAlpha = alpha;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (points.length === 1) ellipse(c, points[0].x, points[0].y, 4.5, 4.5, '#283530');
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const speed = Math.hypot(b.x - a.x, b.y - a.y);
    const width = clamp(10 - speed * 0.12, 3.5, 9);
    c.strokeStyle = '#283530';
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.strokeStyle = '#58604a88';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(a.x - 2, a.y + 1);
    c.lineTo(b.x - 2, b.y + 1);
    c.stroke();
  }
  for (let i = 0; i < points.length; i += 8) {
    const p = points[i];
    ellipse(c, p.x + 6 * Math.sin(i * 1.7), p.y + 6 * Math.cos(i * 1.7), 1.1, 1.4, '#2a392c88');
  }
  c.restore();
}

const GOAL = { x: 0, y: 0, z: 0, label: '' };
function activeGoal() {
  const g = groves;
  const crown = (t) => {
    GOAL.x = t.x;
    GOAL.y = t.y + t.h * 0.64;
    GOAL.z = t.z;
  };
  switch (stage) {
    case 0:
      crown(g[0]);
      GOAL.label = 'REED GROVE';
      return GOAL;
    case 1:
      GOAL.x = 0;
      GOAL.y = 0.4;
      GOAL.z = -6;
      GOAL.label = 'BROKEN BRIDGE';
      return GOAL;
    case 2:
    case 3:
      crown(g[1]);
      GOAL.label = 'BELL GROVE';
      return GOAL;
    case 4:
    case 5:
      crown(g[2]);
      GOAL.label = 'GREAT WILLOW';
      return GOAL;
    case 7: {
      let best = null;
      for (const l of coldLanterns) if (!l.lit && (!best || dist(l, player) < dist(best, player))) best = l;
      if (!best) return null;
      GOAL.x = best.x;
      GOAL.y = best.y + best.h * 0.52;
      GOAL.z = best.z;
      GOAL.label = 'COLD LANTERN';
      return GOAL;
    }
    case 8:
      GOAL.x = -2;
      GOAL.y = terrainH(-2, -52) + 3;
      GOAL.z = -52;
      GOAL.label = 'INK CROWS';
      return GOAL;
    case 9:
      crown(g[3]);
      GOAL.label = 'MOON PLUM';
      return GOAL;
    default:
      return null;
  }
}

const PIP_P = { x: 0, y: 0, d: 0, s: 0, visible: false };
function drawOverlay() {
  fxc.setTransform(DPR, 0, 0, DPR, 0, 0);
  fxc.clearRect(0, 0, W, H);
  if (flash > 0) {
    fxc.fillStyle = `rgba(255,240,190,${flash * 0.5})`;
    fxc.fillRect(0, 0, W, H);
  }
  if (mode === 'title') return;
  if (mode === 'play' && !brush && bloomTime <= 0) {
    const goal = activeGoal();
    if (goal) {
      const p = project(goal.x, goal.y, goal.z, PIP_P);
      const mx = Math.min(100, W * 0.14);
      const top = Math.min(145, H * 0.22);
      const bottom = Math.min(140, H * 0.22);
      if (p.visible && p.x > mx && p.x < W - mx && p.y > top && p.y < H - bottom) {
        const radius = 10 + Math.sin(worldT * 2) * 2;
        fxc.strokeStyle = '#f9edc5';
        fxc.lineWidth = 3;
        fxc.beginPath();
        fxc.arc(p.x, p.y, radius, 0, TAU);
        fxc.stroke();
        fxc.strokeStyle = '#a55a3b';
        fxc.lineWidth = 1.3;
        fxc.beginPath();
        fxc.arc(p.x, p.y, radius + 3, 0, TAU);
        fxc.stroke();
        fxc.fillStyle = '#6b6341';
        fxc.font = '10px Arial';
        fxc.textAlign = 'center';
        fxc.fillText(goal.label, p.x, p.y - radius - 12);
      }
    }
  }
  // Life pips over the masks and crows.
  if (mode === 'play' || mode === 'ending' || brush) {
    for (const e of foes) {
      if (e.dead || !e.active) continue;
      const top = e.kind === 'crow' ? e.y + 0.95 : terrainH(e.x, e.z) + Math.sin(worldT * 3 + e.anim) * 0.08 + 0.1 + 2.02 * (e.big ? 1.42 : 1);
      const p = project(e.x, top, e.z, PIP_P);
      if (!p.visible || p.x < 0 || p.x > W || p.d > 30) continue;
      const width = e.maxhp * 11 + 5;
      fxc.fillStyle = '#f0e3bcbb';
      fxc.fillRect(p.x - width / 2 - 5, p.y - 5, width + 10, 13);
      for (let i = 0; i < e.maxhp; i++) {
        fxc.fillStyle = i < e.hp ? '#855248' : '#918d7670';
        fxc.beginPath();
        fxc.arc(p.x - width / 2 + i * 11 + 6, p.y + 1, 3.4, 0, TAU);
        fxc.fill();
      }
    }
  }
  if (brush) {
    for (const t of getTargets()) {
      if (t.kind === 'bloom') {
        fxc.strokeStyle = t.locked ? '#93615c99' : '#958055bb';
        fxc.lineWidth = 1.4;
        fxc.setLineDash([3, 7]);
        fxc.beginPath();
        fxc.arc(t.x, t.y, t.r, 0, TAU);
        fxc.stroke();
        fxc.setLineDash([]);
        fxc.font = '11px Arial';
        fxc.textAlign = 'center';
        fxc.fillStyle = '#534f3c';
        const label = t.locked ? (t.id === 3 ? 'DRIVE OFF THE CROWS' : 'CLEAR THE INK MASKS') : 'CIRCLE THE CROWN';
        fxc.fillText(label, t.x, t.y - t.r - 12 < 140 ? t.y + t.r + 20 : t.y - t.r - 12);
      } else if (t.kind === 'mend') {
        fxc.strokeStyle = '#8f754ac0';
        fxc.lineWidth = 2;
        fxc.setLineDash([7, 5]);
        fxc.beginPath();
        t.pts.forEach((p, i) => (i ? fxc.lineTo(p.x, p.y) : fxc.moveTo(p.x, p.y)));
        fxc.closePath();
        fxc.stroke();
        fxc.setLineDash([]);
        fxc.textAlign = 'center';
        fxc.font = '11px Arial';
        fxc.fillStyle = '#67583a';
        fxc.fillText('ZIGZAG OVER THE GAP', t.x, t.y - t.r * 0.55 - 18);
      } else if (t.kind === 'kindle') {
        const pulse = 1 + Math.sin(realT * 4 + t.id) * 0.12;
        fxc.strokeStyle = '#a67c3cbb';
        fxc.lineWidth = 1.4;
        fxc.setLineDash([2, 5]);
        fxc.beginPath();
        fxc.arc(t.x, t.y, t.r * pulse, 0, TAU);
        fxc.stroke();
        fxc.setLineDash([]);
        ellipse(fxc, t.x, t.y, 2.2, 2.2, '#8e4b37');
        fxc.font = '10px Arial';
        fxc.textAlign = 'center';
        fxc.fillStyle = '#6b5a36';
        fxc.fillText('DOT', t.x, t.y - t.r - 8);
      } else {
        fxc.strokeStyle = '#92615799';
        fxc.lineWidth = 1;
        fxc.beginPath();
        fxc.arc(t.x, t.y, t.r, 0, TAU);
        fxc.stroke();
      }
    }
    inkStroke(fxc, stroke);
    if (pending) {
      fxc.textAlign = 'center';
      fxc.font = 'italic 24px Georgia';
      fxc.fillStyle = '#506747';
      fxc.fillText(`${pending.kind.toUpperCase()} · Ready`, W / 2, H * 0.24);
    }
    // The brush cursor is drawn, not the system cursor (touch shows it only while painting).
    if (input.source !== 'touch' || drawing) {
      fxc.save();
      fxc.translate(cursor.x, cursor.y);
      fxc.rotate(-0.67);
      path2(fxc, [[-3, -8], [-5, -64], [4, -69], [3, -8]], '#b99655', '#434632', 1.3);
      path2(fxc, [[-4, -12], [-7, -1], [0, 8], [5, -3], [3, -12]], '#2c342d');
      fxc.strokeStyle = '#e9d29c';
      fxc.lineWidth = 1;
      fxc.beginPath();
      fxc.moveTo(0, -18);
      fxc.lineTo(0, -56);
      fxc.stroke();
      fxc.restore();
    }
  }
}

const mp = (x, z) => ({ x: 150 + x * 4.6, y: 22 + (z + 62) * 2.8 });
const MAP_OUTLINE = [[39, 268], [28, 222], [41, 170], [34, 118], [64, 46], [116, 14], [193, 16], [245, 58], [261, 124], [247, 206], [257, 250], [225, 272], [76, 272]];
function drawMap() {
  const c = mapc;
  const w = 300;
  const h = 280;
  c.clearRect(0, 0, w, h);
  c.save();
  c.globalAlpha = 0.85;
  path2(c, MAP_OUTLINE, '#e5dfbdcc', '#697956', 2);
  c.globalAlpha = 0.6;
  const r1 = mp(-26, -3);
  const r2 = mp(26, -3);
  const r3 = mp(26, -9);
  const r4 = mp(-26, -9);
  path2(c, [[r1.x, r1.y + 1], [r2.x, r2.y - 2], [r3.x, r3.y - 1], [r4.x, r4.y + 2]], '#78a398');
  c.globalAlpha = 1;
  c.strokeStyle = '#a1936277';
  c.lineWidth = 5;
  c.beginPath();
  PATH_NODES.forEach((p, i) => {
    const a = mp(p[0], p[1]);
    if (i) c.lineTo(a.x, a.y);
    else c.moveTo(a.x, a.y);
  });
  c.stroke();
  // The old gate: a small red lintel.
  const gp = mp(GATE.x, GATE.z);
  c.strokeStyle = gateOpen ? '#b3593d' : '#4d5c4c';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(gp.x - 11, gp.y);
  c.lineTo(gp.x + 11, gp.y);
  c.stroke();
  for (const g of groves) {
    if (g.id === 3 && !epilogue) continue;
    const p = mp(g.x, g.z);
    ellipse(c, p.x, p.y, 8, 8, g.awake ? (g.id === 3 ? '#8f8fb8' : '#af6154') : '#74856a', '#485c41', 1.5);
    if (!g.awake) {
      c.strokeStyle = '#eee4bd';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(p.x - 3, p.y);
      c.lineTo(p.x + 3, p.y);
      c.moveTo(p.x, p.y - 3);
      c.lineTo(p.x, p.y + 3);
      c.stroke();
    }
  }
  if (epilogue) {
    for (const l of coldLanterns) {
      const p = mp(l.x, l.z);
      ellipse(c, p.x, p.y, 3, 3, l.lit ? '#d9a84e' : '#3d3a2e', '#485c41', 1);
    }
  }
  for (const e of foes) {
    if (e.dead || !e.active) continue;
    const p = mp(e.x, e.z);
    ellipse(c, p.x, p.y, 3, 3, '#845a53');
  }
  const goalOn = !(won && !epilogue) && !moonAwake;
  if (goalOn) {
    const g = activeGoal();
    if (g) {
      const p = mp(g.x, g.z);
      c.strokeStyle = '#a7644299';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(p.x, p.y, 12 + Math.sin(worldT * 3) * 2, 0, TAU);
      c.stroke();
    }
  }
  const p = mp(player.x, player.z);
  c.save();
  c.translate(p.x, p.y);
  c.rotate(-player.yaw);
  path2(c, [[0, 9], [-5, -5], [0, -2], [5, -5]], '#f7ebc6', '#344b36', 2);
  c.restore();
  c.restore();
}

/* ================================================================== sizing */

function placePills() {
  const smallLayout = W <= 760 || H <= 520;
  touch?.placeTop('left', smallLayout ? 70 : 150);
}
kit.onResize((w, h) => {
  W = w;
  H = h;
  DPR = Math.min(devicePixelRatio || 1, 2);
  fx.width = Math.round(W * DPR);
  fx.height = Math.round(H * DPR);
  focal = H / 2 / Math.tan((FOV * PI) / 360);
  // A stroke's screen points mean nothing after a resize: drop the one in progress.
  if (drawing) {
    drawing = false;
    stroke = [];
  }
  placePills();
});

/* ================================================================== start */

paintControls();
paintChallenge();
paintRecord();
updateUI();
showTitle();
syncVisuals(0);
kit.loading.progress(0.95, 'Warming the brush…');
// Compile everything once, including what starts hidden (crows, cut slices, ripples, the strike arc),
// so the first fight does not stall on pipeline builds. syncVisuals sets the real visibility every frame.
{
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  try {
    await kit.renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('[bark] shader warm-up skipped:', err);
  }
  for (const o of hidden) o.visible = false;
  syncVisuals(0);
}

kit.start((rawDt) => {
  frameCount++;
  realT += rawDt;
  handleInput(rawDt);
  if (mode === 'title') {
    worldT += rawDt;
    player.gait += rawDt * 0.15;
    moveCamera(rawDt);
    updateEffects(rawDt);
  } else if (brush) {
    updateBrush(rawDt);
  } else if (mode === 'play' || mode === 'ending') {
    const n = Math.max(1, Math.min(4, Math.ceil(rawDt / 0.034)));
    for (let i = 0; i < n; i++) step(rawDt / n);
    moveCamera(rawDt);
  }
  // The simulation's clock stops for the brush and the menus; the paper flash still fades.
  if (brush || (mode !== 'play' && mode !== 'ending')) flash = Math.max(0, flash - rawDt * 1.3);
  if (realT > toastUntil) hideToast();
  if (mode === 'play') {
    let t = false;
    for (const e of foes) if (e.active && !e.dead && dist(e, player) < (e.kind === 'crow' ? 12 : 10)) t = true;
    threatNear = t;
    if (realT - lastSaveAt > 12) save();
  }
  sound.update();
  const sus = sound.suspended;
  if (sus !== soundWasSuspended) {
    soundWasSuspended = sus;
    paintSoundLabels();
  }
  if (frameCount % 4 === 0 && mode !== 'title') updateUI();
  syncVisuals(rawDt);
  kit.renderer.render(scene, camera);
  drawOverlay();
  if (frameCount % 5 === 0 && mode !== 'title') drawMap();
});

// Read-only diagnostics for automated checks.
window.__bark = {
  snapshot: () => ({ mode, brush, source: brushSource, stage, challenge, player: { ...player }, groves: groves.map((g) => ({ id: g.id, awake: g.awake, bloom: g.bloom })), foes: foes.map((e) => ({ kind: e.kind, id: e.id, hp: e.hp, dead: e.dead, active: e.active, state: e.state })), lanterns: coldLanterns.map((l) => l.lit), bridgeMended, won, epilogue, gateOpen, moonAwake, taleTime, fullTime, strokeCount, kills, particles: partCount }),
  targets: getTargets,
  project: (x, y, z) => ({ ...project(x, y, z, { x: 0, y: 0, d: 0, s: 0, visible: false }) }),
  recognize: (points) => recognize(points),
};
