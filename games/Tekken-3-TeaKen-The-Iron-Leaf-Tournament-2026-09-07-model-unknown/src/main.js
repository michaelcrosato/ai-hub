// TeaKen: an original arcade fighting game on the shared 3D stack.
// Fixed 60 Hz combat simulation, procedural faceted fighters rebuilt from
// their poses every frame, three.js r186 (WebGPU, WebGL2 fallback) through the
// kit, and Web Audio sound.

import * as THREE from 'three/webgpu';
import { attribute, varying, vec3, vec4, float, uniform, positionWorld, cameraPosition, smoothstep, step, mix, max, min, dot, floor, mod, screenCoordinate, screenUV, clamp as tclamp } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { vertexSnap } from 'kit/retro.js';
import { Geo, TAU, clamp, lerp, rnd, rand } from './geo.js';
import { buildTemple, buildTerrace, STAGES, TEMPLE_LAMPS } from './arenas.js';
import { roster, moves, fighter, drawFighter, drawShadow, MAX_HP } from './fighters.js';
import { AudioEngine } from './audio.js';

// The original renderer wrote its colours straight to the screen: keep that.
THREE.ColorManagement.enabled = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ------------------------------------------------------------ saved data */

const settings = { sound: true, music: true, pixels: true, crt: true, shake: true, difficulty: 1, best: 0, wins: 0, fastest: 0 };
let canSave = true;
try {
  const saved = JSON.parse(localStorage.getItem('teaken.v1') || 'null');
  if (saved && typeof saved === 'object') for (const k in settings) if (typeof saved[k] === typeof settings[k]) settings[k] = saved[k];
  settings.difficulty = clamp(settings.difficulty | 0, 0, 2);
} catch {
  canSave = false;
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateRecord() {
  const n = $('#record-note');
  if (n) n.textContent = `BEST ${String(settings.best).padStart(6, '0')} · CLEARS ${String(settings.wins).padStart(2, '0')}${settings.fastest ? ` · FASTEST ${fmtTime(settings.fastest)}` : ''}`;
}
function save() {
  updateRecord();
  try {
    localStorage.setItem('teaken.v1', JSON.stringify(settings));
  } catch {
    canSave = false;
  }
}
function loadRun() {
  try {
    const r = JSON.parse(localStorage.getItem('teaken.run') || 'null');
    if (r && typeof r === 'object' && roster[r.char] && Number.isFinite(r.stage) && r.stage > 0) return r;
  } catch {
    /* no run */
  }
  return null;
}
function saveRun(r) {
  try {
    localStorage.setItem('teaken.run', JSON.stringify(r));
  } catch {
    canSave = false;
  }
}
function clearRun() {
  try {
    localStorage.removeItem('teaken.run');
  } catch {
    /* nothing saved */
  }
}

/* ------------------------------------------------------------ boot */

const kit = await boot({
  title: 'TeaKen — The Iron Leaf Tournament',
  canvas: $('#world'),
  mount: $('#cabinet'),
  gear: 'none', // the game's own Options and pause menus open the kit panel (and F9 does)
  pixelHeight: settings.pixels ? 432 : 0,
  ...(settings.pixels ? { renderer: { antialias: false } } : {}),
  background: '#090e10',
  accent: '#e9b960',
  touch: { top: 'center', topOffset: 90 },
  input: {
    // Player one: keyboard and the on-screen controls.
    move: { type: 'vector', keys: 'wasd', gamepad: [], touch: 'stick' },
    lp: { keys: ['KeyU'], touch: 'LP' },
    rp: { keys: ['KeyI'], touch: 'RP' },
    lk: { keys: ['KeyJ'], touch: 'LK' },
    rk: { keys: ['KeyK'], touch: 'RK' },
    grab: { keys: ['KeyH'], touch: 'Throw' },
    stepIn: { keys: ['KeyQ'], touch: { label: 'Step ↑', slot: 'top' } },
    stepOut: { keys: ['KeyE'], touch: { label: 'Step ↓', slot: 'top' } },
    lift: { keys: ['KeyL'], touch: { label: 'Lift', slot: 'top' } },
    // The gamepad: player one, or player two in local versus.
    padMove: { type: 'vector', gamepad: 'leftStick+dpad' },
    padLp: { gamepad: ['X'] },
    padRp: { gamepad: ['Y'] },
    padLk: { gamepad: ['A'] },
    padRk: { gamepad: ['B'] },
    padGrab: { gamepad: ['LT'] },
    padLift: { gamepad: ['RT'] },
    padIn: { gamepad: ['LB'] },
    padOut: { gamepad: ['RB'] },
    // Player two on the same keyboard.
    move2: { type: 'vector', keys: 'arrows', gamepad: [] },
    lp2: { keys: ['Digit7', 'Numpad4'] },
    rp2: { keys: ['Digit8', 'Numpad5'] },
    lk2: { keys: ['Digit9', 'Numpad1'] },
    rk2: { keys: ['Digit0', 'Numpad2'] },
    grab2: { keys: ['ControlRight', 'Numpad0'] },
    lift2: { keys: ['Numpad8'] },
    in2: { keys: ['Comma'] },
    out2: { keys: ['Period'] },
    // Menus and system.
    nav: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A', 'Start'] },
    back: { keys: ['Escape', 'Backspace'], gamepad: ['B'] },
    reset: { keys: ['KeyR'], gamepad: ['Back'], touch: { label: 'Reset', slot: 'top' } },
    dummy: { keys: ['KeyT'], gamepad: ['RS'], touch: { label: 'Dummy', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'Ⅱ', slot: 'top' } },
    mute: { keys: ['KeyM'] },
  },
});
const { input } = kit;
kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.loading.progress(0.7, 'Raising the temple…');

/* ------------------------------------------------------------ rendering */

const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 140));

// Uniforms shared by every material: the stage's fog and light, and the retro switch.
const U = {
  fog: uniform(new THREE.Color(0.4, 0.34, 0.28)),
  fogNear: uniform(14),
  fogFar: uniform(62),
  fogMax: uniform(0.83),
  light: uniform(new THREE.Color(1, 1, 1)),
  glowFog: uniform(1), // how much fog reaches fully glowing surfaces (the sun disc): 1 = as much as anything else
  retro: uniform(settings.pixels ? 1 : 0),
};
const sky = [0, 1, 2, 3].map(() => uniform(new THREE.Color(0, 0, 0)));
// The sky is a four-stop vertical gradient behind everything, as the CSS one was.
{
  const t = screenUV.y;
  const a = mix(sky[0], sky[1], tclamp(t.div(0.31), 0, 1));
  const b = mix(a, sky[2], tclamp(t.sub(0.31).div(0.31), 0, 1));
  scene.backgroundNode = mix(b, sky[3], tclamp(t.sub(0.62).div(0.38), 0, 1));
}

const L1 = new THREE.Vector3(-0.45, 1, 0.7).normalize();
const L2 = new THREE.Vector3(0.6, 0.25, -1).normalize();
/**
 * The original shading: a fixed key and fill light per vertex, a glow amount that
 * bypasses it, distance fog, and in retro mode a 2×2 dither and 31-level colour.
 * A glow of 1 takes the stage's glowFog share of the fog, a glow above 1 none at all
 * (the moons). Hand-written WebGL never culled faces, so neither does this.
 */
function makeMaterial(transparent) {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent, depthWrite: !transparent, fog: false });
  const N = attribute('normal', 'vec3');
  const C = attribute('color', 'vec4');
  const E = attribute('aE', 'float');
  const l = float(0.41).add(max(0, dot(N, vec3(L1.x, L1.y, L1.z))).mul(0.61)).add(max(0, dot(N, vec3(L2.x, L2.y, L2.z))).mul(0.14));
  const lit = varying(vec4(mix(C.rgb.mul(l).mul(U.light), C.rgb, min(E, 1)), C.a));
  const dist = varying(positionWorld.distance(cameraPosition));
  const fogScale = varying(mix(float(1), U.glowFog, step(0.999, E)).mul(float(1).sub(tclamp(E.sub(1), 0, 1))));
  const fog = smoothstep(U.fogNear, U.fogFar, dist).mul(U.fogMax).mul(fogScale);
  const base = mix(lit.rgb, U.fog, fog);
  const d = mod(screenCoordinate.x, 2).add(mod(screenCoordinate.y, 2).mul(2));
  const dithered = base.add(d.div(3).sub(0.5).mul(0.023).mul(U.retro));
  const col = mix(dithered, floor(dithered.mul(31).add(0.5)).div(31), U.retro.mul(0.7));
  m.colorNode = vec4(col, lit.a);
  if (transparent) m.forceSinglePass = true;
  return m;
}
const solidMat = makeMaterial(false);
const shadowMat = makeMaterial(true);
// PlayStation-style vertex snapping on a virtual screen grid, shared by both materials.
const snapGrid = vertexSnap(solidMat, { width: 768, height: 432 });
vertexSnap(shadowMat, { grid: snapGrid });

function staticMesh(build) {
  const g = new Geo(120000);
  const info = build(g);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos.slice(0, g.n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(g.nor.slice(0, g.n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(g.col.slice(0, g.n * 4), 4));
  geo.setAttribute('aE', new THREE.BufferAttribute(g.em.slice(0, g.n), 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, solidMat);
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, info };
}

function dynamicMesh(maxVerts, material, order = 0) {
  const g = new Geo(maxVerts);
  const geo = new THREE.BufferGeometry();
  const attrs = [['position', g.pos, 3], ['normal', g.nor, 3], ['color', g.col, 4], ['aE', g.em, 1]].map(([name, array, size]) => {
    const a = new THREE.BufferAttribute(array, size);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    return a;
  });
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = order;
  scene.add(mesh);
  return {
    g,
    mesh,
    /** Upload only the vertices written this frame. */
    commit() {
      const n = g.n;
      geo.setDrawRange(0, n);
      if (!n) return;
      for (const a of attrs) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
    },
  };
}

const temple = staticMesh(buildTemple);
kit.loading.progress(0.8, 'Planting the tea terraces…');
const terrace = staticMesh(buildTerrace);
const TERRACE_LAMPS = terrace.info.lamps;
const dyn = dynamicMesh(16384, solidMat);
const shade = dynamicMesh(256, shadowMat, 1);

/* ------------------------------------------------------------ effects overlay */

const fx = $('#fx');
const ctx = fx.getContext('2d');
let FW = fx.width, FH = fx.height;
const PV = new THREE.Matrix4();
const _s = [0, 0, 0], _e = [0, 0, 0];
function project(x, y, z, out) {
  const e = PV.elements;
  const w = e[3] * x + e[7] * y + e[11] * z + e[15];
  if (w <= 0) return null;
  out[0] = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w) * FW * 0.5 + FW * 0.5;
  out[1] = (-(e[1] * x + e[5] * y + e[9] * z + e[13]) / w) * FH * 0.5 + FH * 0.5;
  out[2] = w;
  return out;
}
// Soft glows are drawn once into small sprites instead of a gradient per lamp per frame.
function glowSprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}
const LAMP_GLOW = glowSprite('#ffc773ff', '#ffad4b00');
const FIREFLY_GLOW = glowSprite('#e6f7a0ff', '#b6e25a00');

/* ------------------------------------------------------------ game state */

const audio = new AudioEngine(settings, () => ({ screen, phase }));
const ARCADE_STAGES = [0, 1, 2]; // dusk temple, temple at night, the Jade Terrace
let screen = 'title', mode = 'arcade', modalBack = 'title', optionBack = 'title', selectPhase = 0, selection = 0, chosen = 0, chosen2 = 1, route = [], stage = 0, round = 1, wins = [0, 0], timer = 40, phase = 'idle', phaseTime = 0, simTime = 0, realTime = 0, freeze = 0, shake = 0, flash = 0, announcementUntil = 0, announcing = false, roundWinner = -1, matchWinner = -1, acc = 0, score = 0, matchStartScore = 0, bestCombo = 0, frameNo = 0, toastTime = 0, toastOn = false, dummyMode = 0, menuFocus = 0, runTime = 0, selStage = 0, hudTick = 0;
let stageLook = STAGES[0], glows = TEMPLE_LAMPS, flames = TEMPLE_LAMPS;
const keyHistory = [], particles = [], floatTexts = [];
let cameraAngle = Math.PI / 2, camDist = 9.0;
const camTarget = [0.45, 1.75, -0.4], camEye = [4.35, 2.72, 7.1];
let fighters = [fighter(0, 0, -1.25), fighter(1, 1, 1.25)];

const human = (f) => f.id === 0 || mode === 'versus';
const padOwner = () => (mode === 'versus' ? 1 : 0);
/** Rumble the controller (or phone) of the player who owns fighter `id`. */
function rumbleFor(id, strength, ms) {
  // The pad belongs to player one, or to player two in local versus; a phone is always player one.
  const owner = input.source === 'touch' ? 0 : padOwner();
  if (id === owner) input.rumble(strength, ms);
}

function buildRoute(c) {
  const r = [0, 1, 2].filter((i) => i !== c);
  if (c !== 3) r.push(3);
  return r;
}

function applyStage(look) {
  stageLook = look;
  temple.mesh.visible = look.arena === 'temple';
  terrace.mesh.visible = look.arena === 'terrace';
  U.fog.value.setRGB(look.fog[0], look.fog[1], look.fog[2]);
  U.fogNear.value = look.fogNear;
  U.fogFar.value = look.fogFar;
  U.fogMax.value = look.fogMax;
  U.light.value.setRGB(look.light[0], look.light[1], look.light[2]);
  U.glowFog.value = look.glowFog;
  for (let i = 0; i < 4; i++) sky[i].value.set(look.sky[i]);
  glows = look.arena === 'temple' ? TEMPLE_LAMPS : TERRACE_LAMPS;
  flames = look.arena === 'temple' ? TEMPLE_LAMPS : [];
  $('#hud-stage').textContent = look.name;
  $('#vs-stage').textContent = look.name;
}

/* ------------------------------------------------------------ UI */

const screens = $$('.screen');
const announceEl = $('#announcement'), announceMain = $('#announcement .announce-main'), announceSub = $('#announcement .announce-sub');
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.style.opacity = 1;
  toastTime = realTime + 2.1;
  toastOn = true;
}
function updateOptions() {
  updateRecord();
  audio.set();
  $('#sound-button').textContent = settings.sound ? '♪ SOUND ON' : '♪ SOUND OFF';
  $('#sound-button').setAttribute('aria-pressed', String(settings.sound));
  $('#opt-sound').textContent = settings.sound ? 'ON' : 'OFF';
  $('#opt-music').textContent = settings.music ? 'ON' : 'OFF';
  $('#opt-pixels').textContent = settings.pixels ? 'RETRO' : 'CRISP';
  $('#opt-crt').textContent = settings.crt ? 'ON' : 'OFF';
  $('#opt-shake').textContent = settings.shake ? 'ON' : 'OFF';
  $('#crt').classList.toggle('off', !settings.crt);
  if (!canSave) $('#save-note').innerHTML = 'Local saving is not available in this browser.<br>The game still works. Settings will reset when you close it.';
  $$('[data-diff]').forEach((b) => b.classList.toggle('selected', +b.dataset.diff === settings.difficulty));
  applyDisplay();
}
let pixelsApplied = null;
function applyDisplay() {
  U.retro.value = settings.pixels ? 1 : 0;
  if (pixelsApplied !== settings.pixels) {
    pixelsApplied = settings.pixels;
    kit.setPixelHeight(settings.pixels ? 432 : 0);
  }
  updateSnap();
}
function updateSnap() {
  const w = settings.pixels ? 768 : Math.min(1600, kit.size.width);
  snapGrid.value.set(w / 2, (w * 9) / 32);
}

function menuList() {
  let list = [];
  if (screen === 'title') list = [...$$('#title .menu-button'), ...$$('#title .minor-links button')];
  else if (screen === 'pause') list = $$('#pause .menu-button');
  else if (screen === 'result') list = $$('#result .menu-button');
  else if (screen === 'options') list = [...$$('#options .option-value'), $('#options-close')];
  else if (screen === 'help') list = [$('#help-close')];
  return list.filter((e) => e && !e.hidden);
}
function defaultFocus() {
  const list = menuList(), i = list.findIndex((e) => e.classList.contains('primary'));
  return i < 0 ? 0 : i;
}
function updateFocus() {
  const list = menuList();
  for (const el of $$('.menu-button.focused')) el.classList.remove('focused');
  list.forEach((e, i) => e.classList.toggle('focused', i === menuFocus && !e.classList.contains('primary')));
}
function moveFocus(delta) {
  const list = menuList();
  if (!list.length) return;
  menuFocus = (menuFocus + delta + list.length) % list.length;
  updateFocus();
  list[menuFocus].focus({ preventScroll: true });
  audio.menu();
}
function activateFocus() {
  const list = menuList(), a = document.activeElement;
  if (a && list.includes(a)) a.click();
  else list[menuFocus]?.click();
}

function setScreen(name) {
  screen = name;
  $('.global-tools').style.display = name === 'title' || name === 'fight' ? 'flex' : 'none';
  for (const el of screens) el.classList.toggle('active', el.id === name);
  $('#hud').style.display = name === 'fight' || name === 'pause' || (name === 'help' && modalBack === 'pause') || (name === 'options' && optionBack === 'pause') ? 'block' : 'none';
  if (name !== 'fight') {
    announceEl.classList.remove('show');
    announcing = false;
  }
  kit.touch?.suspend(name !== 'fight', 'game');
  // A button left focused on the screen we just left must not swallow Enter or Space.
  const a = document.activeElement;
  if (a && a !== document.body && (name === 'fight' || !a.closest(`#${name}`))) a.blur?.();
  menuFocus = defaultFocus();
  updateFocus();
  settleFight();
  input.settle();
}
function showAnnouncement(main, sub = '', dur = 1) {
  announceMain.textContent = main;
  announceSub.textContent = sub;
  announceEl.classList.remove('show');
  void announceEl.offsetWidth;
  announceEl.classList.add('show');
  announcementUntil = realTime + dur;
  announcing = true;
}

function statBars(c) {
  return [['POWER', c.power], ['SPEED', c.speed], ['REACH', c.reach]].map(([s, v]) => `<div class="stat">${s}<div class="stat-bars">${Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div></div>`).join('');
}
function selectFighter(n) {
  selection = (n + roster.length) % roster.length;
  const c = roster[selection];
  $('#select-name').textContent = c.name;
  $('#select-style').textContent = `${c.style} / ${c.art}`;
  $('#select-desc').textContent = c.desc;
  $('#preview-title').textContent = c.title;
  $('#preview-label').textContent = c.tag;
  $('#select-stats').innerHTML = statBars(c);
  $$('.fighter-card').forEach((el, i) => {
    el.classList.toggle('selected', i === selection);
    el.setAttribute('aria-pressed', i === selection ? 'true' : 'false');
  });
  fighters = [fighter(0, selection, 1.6), fighter(1, (selection + 1) % roster.length, 3.5)];
  audio.menu();
}
$('#fighter-cards').innerHTML = roster.map((c, i) => `<button class="fighter-card ${i === 0 ? 'selected' : ''}" data-fighter="${i}" aria-label="Choose ${c.name}"><span class="num">0${i + 1}</span><div><b>${c.name}</b><small>${c.art}</small></div></button>`).join('');
$$('[data-fighter]').forEach((b) => (b.onclick = () => selectFighter(+b.dataset.fighter)));

function setStagePick(i) {
  selStage = (i + STAGES.length) % STAGES.length;
  const chip = $('#stage-chip');
  chip.textContent = `◂ ${STAGES[selStage].name} ▸`;
  chip.classList.toggle('boss', STAGES[selStage].arena === 'terrace');
  if (screen === 'select' && mode !== 'arcade') applyStage(STAGES[selStage]);
}
function setDifficulty(d) {
  settings.difficulty = clamp(d, 0, 2);
  save();
  updateOptions();
  audio.menu();
}

function startSelect(m) {
  audio.init();
  mode = m;
  selectPhase = 0;
  $('#select-mode').textContent = m === 'versus' ? 'LOCAL VERSUS' : m.toUpperCase();
  $('#select-player').textContent = 'PLAYER ONE';
  $('#select-confirm').textContent = m === 'versus' ? 'CHOOSE PLAYER TWO ↗' : 'ENTER THE ARENA ↗';
  $('#difficulty-label').style.display = m === 'arcade' ? '' : 'none';
  $$('[data-diff]').forEach((e) => (e.style.display = m === 'versus' ? 'none' : ''));
  $('#stage-pick').hidden = m === 'arcade';
  setScreen('select');
  updatePrompts(true);
  selectFighter(chosen);
  setStagePick(selStage);
  applyStage(m === 'arcade' ? STAGES[ARCADE_STAGES[0]] : STAGES[selStage]);
  audio.init().then(() => {
    if (screen === 'select') audio.say('select');
  });
}
function selectBack() {
  if (selectPhase === 1) {
    selectPhase = 0;
    $('#select-player').textContent = 'PLAYER ONE';
    $('#select-confirm').textContent = 'CHOOSE PLAYER TWO ↗';
    selectFighter(chosen);
  } else mainMenu();
}
function confirmSelect() {
  audio.init();
  audio.menu(true);
  if (selectPhase === 0) {
    chosen = selection;
    if (mode === 'versus') {
      selectPhase = 1;
      $('#select-player').textContent = 'PLAYER TWO';
      $('#select-confirm').textContent = 'ENTER THE ARENA ↗';
      selectFighter((chosen + 1) % roster.length);
      return;
    }
  } else chosen2 = selection;
  stage = 0;
  route = buildRoute(chosen);
  score = 0;
  bestCombo = 0;
  runTime = 0;
  if (mode === 'arcade') clearRun();
  beginMatch();
}
function continueRun() {
  const r = loadRun();
  if (!r) return;
  audio.init();
  audio.menu(true);
  mode = 'arcade';
  chosen = r.char;
  route = buildRoute(chosen);
  stage = clamp(r.stage | 0, 0, route.length - 1);
  score = Math.max(0, r.score | 0);
  runTime = Math.max(0, +r.time || 0);
  bestCombo = 0;
  beginMatch();
}
function refreshContinue() {
  const r = loadRun(), b = $('#continue-run');
  b.hidden = !r;
  if (r) $('#continue-label').textContent = `STAGE 0${(r.stage | 0) + 1} · ${roster[r.char].name} · ${String(r.score | 0).padStart(6, '0')}`;
}

function beginMatch() {
  wins = [0, 0];
  round = 1;
  roundWinner = -1;
  matchWinner = -1;
  matchStartScore = score;
  const opponent = mode === 'versus' ? chosen2 : route[stage] ?? (chosen + 1) % roster.length;
  fighters = [fighter(0, chosen, -1.2), fighter(1, opponent, 1.2)];
  applyStage(mode === 'arcade' ? STAGES[ARCADE_STAGES[Math.min(stage, ARCADE_STAGES.length - 1)]] : STAGES[selStage]);
  const boss = mode === 'arcade' && fighters[1].char.boss;
  $('#name1').textContent = fighters[0].char.name;
  $('#name2').textContent = fighters[1].char.name;
  $('#slot2').textContent = mode === 'versus' ? '2P' : mode === 'practice' ? 'DUMMY' : 'CPU';
  $('#vs-p1').textContent = fighters[0].char.name;
  $('#vs-p2').textContent = fighters[1].char.name;
  $('#vs-style1').textContent = fighters[0].char.style;
  $('#vs-style2').textContent = fighters[1].char.style;
  $('#vs-cpu').textContent = mode === 'versus' ? 'PLAYER TWO' : boss ? 'FINAL CHALLENGER' : 'CHALLENGER';
  $('#vs-boss').hidden = !boss;
  $('#battle-label').textContent = mode === 'arcade' ? `STAGE 0${stage + 1} / 0${route.length}${stage === route.length - 1 ? ' · FINAL' : ''}` : mode === 'versus' ? 'LOCAL VERSUS' : 'PRACTICE';
  $('#practice-data').style.display = mode === 'practice' ? 'block' : 'none';
  kit.touch?.setShown('reset', mode === 'practice');
  kit.touch?.setShown('dummy', mode === 'practice');
  keyHistory.length = 0;
  particles.length = 0;
  floatTexts.length = 0;
  updateHistory();
  setScreen('versus');
  phase = 'versus';
  phaseTime = 0;
  audio.say('next');
  if (boss) audio.gong();
  cameraAngle = Math.PI / 2;
  camDist = 9.0;
  updateHUD(true);
}
function resetRound() {
  const c = fighters.map((f) => f.char.id);
  fighters = [fighter(0, c[0], -1.19), fighter(1, c[1], 1.19)];
  timer = 40;
  phase = 'intro';
  phaseTime = 0;
  freeze = 0;
  shake = 0;
  flash = 0;
  roundWinner = -1;
  particles.length = 0;
  floatTexts.length = 0;
  keyHistory.length = 0;
  updateHistory();
  setScreen('fight');
  $('#round-label').textContent = mode === 'practice' ? 'FREE TRAINING · DUMMY · RESET' : `ROUND 0${round} · FIRST TO TWO`;
  if (mode === 'practice') {
    phase = 'fight';
    showAnnouncement('PRACTICE', 'MAKE EVERY HIT COUNT', 1.1);
  } else {
    const final = wins[0] === 1 && wins[1] === 1;
    showAnnouncement(final ? 'FINAL ROUND' : `ROUND ${round}`, stageLook.name, 1.3);
    audio.say(final ? 'final' : round === 1 ? 'round1' : 'round2');
  }
  updatePrompts(true);
  updateHUD(true);
}
function mainMenu() {
  phase = 'idle';
  refreshContinue(); // before the focus is placed, so the default stays on PLAY ARCADE
  setScreen('title');
  fighters = [fighter(0, chosen, 1.6), fighter(1, (chosen + 1) % roster.length, 3.4)];
  audio.menu();
  cameraAngle = Math.PI / 2;
  applyStage(STAGES[0]);
}
function pause() {
  if (screen !== 'fight') return;
  setScreen('pause');
  audio.menu();
}
function resume() {
  if (screen !== 'pause') return;
  setScreen('fight');
  audio.menu();
  if (phase === 'intro') showAnnouncement('GET READY', '', 0.7);
}
function openHelp() {
  modalBack = screen;
  if (screen === 'fight') {
    pause();
    modalBack = 'pause';
  }
  setScreen('help');
  $('#help .modal-inner').scrollTop = 0;
  audio.menu();
}
function openOptions() {
  optionBack = screen;
  setScreen('options');
  audio.menu();
  updateOptions();
}
function restartMatch() {
  if (mode === 'arcade') score = matchStartScore; // damage from the abandoned attempt does not count
  beginMatch();
}

function showResult() {
  matchWinner = wins[0] >= 2 ? 0 : 1;
  phase = 'result';
  phaseTime = 0;
  const won = matchWinner === 0, champ = won && mode === 'arcade' && stage === route.length - 1;
  fighters[matchWinner].state = 'victory';
  fighters[1 - matchWinner].state = 'ko';
  fighters[matchWinner].attack = null;
  setScreen('result');
  let note = '';
  if (mode === 'arcade') {
    if (won) score += 1000 + Math.round(fighters[0].hp * 5) + Math.round(timer * 15);
    settings.best = Math.max(settings.best, score);
    if (champ) {
      settings.wins++;
      const clearTime = Math.max(1, Math.round(runTime));
      const record = !settings.fastest || clearTime < settings.fastest;
      if (record) settings.fastest = clearTime;
      note = ` Clear time ${fmtTime(clearTime)}${record ? ' — a new record.' : `. Fastest ${fmtTime(settings.fastest)}.`}`;
      clearRun();
      audio.say('champion');
      audio.gong();
    } else if (won) {
      saveRun({ char: chosen, stage: stage + 1, score, time: runTime });
      audio.say('win');
    } else audio.say('lose');
    save();
  } else audio.say(won || mode === 'versus' ? 'win' : 'lose');
  const remaining = route.length - 1 - stage;
  const nextIsBoss = roster[route[stage + 1]]?.boss;
  $('#result-title').textContent = mode === 'versus' ? `${fighters[matchWinner].char.name} WINS` : champ ? 'CHAMPION' : won ? 'VICTORY' : 'DEFEAT';
  $('#result-stage').textContent = champ ? 'TOURNAMENT CLEAR' : mode === 'versus' ? 'LOCAL VERSUS' : won ? 'STAGE CLEAR' : 'CONTINUE?';
  $('#result-desc').textContent = champ
    ? `The Iron Leaf is yours. A perfect finish to a strong brew.${note}`
    : mode === 'versus'
      ? 'One more round? The temple is still open.'
      : won
        ? nextIsBoss
          ? 'Only the Iron Leaf Master remains. He waits on the Jade Terrace.'
          : remaining === 1
            ? 'One fighter remains. The temple keeps its strongest for last.'
            : `${remaining} fighters remain. Night falls on the Ember Temple.`
        : 'A lost round is a lesson. Stand up and try again.';
  $('#result-rounds').textContent = `${wins[0]}–${wins[1]}`;
  $('#result-combo').textContent = bestCombo;
  $('#result-score').textContent = mode === 'arcade' ? score.toLocaleString() : '—';
  $('#result-eyebrow').textContent = champ ? 'THE NEW IRON LEAF CHAMPION' : 'THE IRON LEAF TOURNAMENT';
  $('#result-next-label').textContent = mode === 'versus' ? 'REMATCH' : champ ? 'PLAY AGAIN' : won ? 'NEXT CHALLENGER' : 'CONTINUE';
  updatePrompts(true);
}
function nextResult() {
  audio.menu(true);
  if (mode === 'versus') {
    beginMatch();
    return;
  }
  if (matchWinner === 0 && stage < route.length - 1) {
    stage++;
    beginMatch();
  } else if (matchWinner === 0) startSelect('arcade');
  else restartMatch();
}

$$('[data-start]').forEach((e) => (e.onclick = () => startSelect(e.dataset.start)));
$('#continue-run').onclick = continueRun;
$('#select-confirm').onclick = confirmSelect;
$('#select-back').onclick = selectBack;
$('#stage-chip').onclick = () => {
  setStagePick(selStage + 1);
  audio.menu();
};
$('#title-help').onclick = openHelp;
$('#title-options').onclick = openOptions;
$('#help-close').onclick = () => setScreen(modalBack);
$('#options-close').onclick = () => setScreen(optionBack);
$('#hud-pause').onclick = pause;
$('#resume').onclick = resume;
$('#pause-help').onclick = openHelp;
$('#pause-options').onclick = openOptions;
$('#pause-restart').onclick = restartMatch;
$('#pause-quit').onclick = mainMenu;
$('#result-next').onclick = nextResult;
$('#result-menu').onclick = mainMenu;
$('#opt-graphics').onclick = () => kit.menu.open();
$$('[data-diff]').forEach((e) => (e.onclick = () => setDifficulty(+e.dataset.diff)));
for (const [id, key] of [['opt-sound', 'sound'], ['opt-music', 'music'], ['opt-pixels', 'pixels'], ['opt-crt', 'crt'], ['opt-shake', 'shake'], ['sound-button', 'sound']]) {
  $(`#${id}`).onclick = () => {
    audio.init();
    settings[key] = !settings[key];
    save();
    updateOptions();
    audio.menu();
  };
}
$('#fullscreen').onclick = () => {
  audio.init();
  // The whole page, so the touch controls and the settings panel come along.
  const root = document.documentElement;
  let p;
  if (document.fullscreenElement) p = document.exitFullscreen();
  else if (root.requestFullscreen) p = root.requestFullscreen();
  else {
    toast('Use the browser full-screen control.');
    return;
  }
  p?.catch?.(() => toast('Full screen is not available in this browser.'));
};

/* Button prompts follow the last device used. */
const PROMPTS = {
  keyboard: { confirm: 'ENTER', back: 'ESC', pause: 'ESC' },
  gamepad: { confirm: 'A', back: 'B', pause: 'START' },
  touch: { confirm: 'TAP', back: 'TAP', pause: 'Ⅱ' },
};
const GUIDES = {
  keyboard: '<kbd>A</kbd><kbd>D</kbd><span>MOVE</span><kbd>U</kbd><kbd>I</kbd><span>PUNCH</span><kbd>J</kbd><kbd>K</kbd><span>KICK</span><kbd>H</kbd><span>THROW</span>',
  gamepad: '<kbd>✥</kbd><span>MOVE</span><kbd>X</kbd><kbd>Y</kbd><span>PUNCH</span><kbd>A</kbd><kbd>B</kbd><span>KICK</span><kbd>LT</kbd><span>THROW</span><kbd>LB</kbd><kbd>RB</kbd><span>STEP</span>',
  touch: '',
};
let promptSource = '';
function updatePrompts(force = false) {
  const src = input.source in PROMPTS ? input.source : 'keyboard';
  if (src === promptSource && !force) return;
  promptSource = src;
  const p = PROMPTS[src];
  for (const el of $$('[data-prompt]')) el.textContent = p[el.dataset.prompt] || '';
  $('#key-guide').innerHTML = GUIDES[src];
  const dummyName = ['IDLE', 'GUARD', 'FIGHT'][dummyMode];
  $('#dummy-label').textContent = src === 'gamepad' ? `R3: DUMMY ${dummyName} · BACK: RESET` : src === 'touch' ? `DUMMY: ${dummyName} · RESET ON TOP` : `T: DUMMY ${dummyName} · R: RESET`;
  const lvl = mode === 'arcade' ? 'LEVEL' : 'STAGE';
  $('#select-hint').textContent = src === 'gamepad' ? `✥ ◂ ▸ FIGHTER · ▴ ▾ ${lvl} · A CONFIRM · B BACK` : src === 'touch' ? 'TAP A FIGHTER, THEN ENTER THE ARENA' : `← → FIGHTER · ↑ ↓ ${lvl} · ENTER CONFIRM · ESC BACK`;
}
input.onSourceChange(() => updatePrompts());

/* ------------------------------------------------------------ input */

const ATTACKS = ['lp', 'rp', 'lk', 'rk', 'throw', 'launch'];
const BUTTONS = ['lp', 'rp', 'lk', 'rk', 'throw', 'launch', 'in', 'out'];
const BIND = [
  { move: 'move', lp: 'lp', rp: 'rp', lk: 'lk', rk: 'rk', throw: 'grab', launch: 'lift', in: 'stepIn', out: 'stepOut' },
  { move: 'move2', lp: 'lp2', rp: 'rp2', lk: 'lk2', rk: 'rk2', throw: 'grab2', launch: 'lift2', in: 'in2', out: 'out2' },
];
const PAD = { move: 'padMove', lp: 'padLp', rp: 'padRp', lk: 'padLk', rk: 'padRk', throw: 'padGrab', launch: 'padLift', in: 'padIn', out: 'padOut' };
const KEYS = ['left', 'right', 'up', 'down', ...BUTTONS];
const mkPlayer = () => ({ held: Object.fromEntries(KEYS.map((k) => [k, false])), prev: Object.fromEntries(KEYS.map((k) => [k, false])), taps: new Set() });
const PL = [mkPlayer(), mkPlayer()];
let settleNext = false;
/** Ignore whatever is held right now (after a menu closes, so its button does not attack). */
function settleFight() {
  settleNext = true;
  PL[0].taps.clear();
  PL[1].taps.clear();
}
function clearTaps() {
  PL[0].taps.clear();
  PL[1].taps.clear();
}
/**
 * Sample each player's controls once per rendered frame. Presses are kept until a
 * 60 Hz combat tick consumes them, so a tap is never lost or counted twice.
 */
function gatherFightInput() {
  const owner = padOwner();
  for (let id = 0; id < 2; id++) {
    const pl = PL[id], A = BIND[id], H = pl.held, pad = owner === id;
    const v = input.vector(A.move);
    let x = v.x, y = v.y;
    if (pad) {
      const p = input.vector(PAD.move);
      x += p.x;
      y += p.y;
    }
    H.left = x < -0.32;
    H.right = x > 0.32;
    H.up = y > 0.52;
    H.down = y < -0.45;
    for (const b of BUTTONS) H[b] = input.down(A[b]) || (pad && input.down(PAD[b]));
    for (const k of KEYS) {
      if (H[k] && !pl.prev[k] && !settleNext) pl.taps.add(k);
      pl.prev[k] = H[k];
    }
  }
  settleNext = false;
  if (screen !== 'fight') clearTaps();
}

let navPrevX = 0, navPrevY = 0, navHoldX = 0, navHoldY = 0;
/** Menu steps from the nav stick / keys / D-pad: one per press, repeating while held. */
function navStep(dt) {
  const v = input.vector('nav');
  const dx = v.x > 0.5 ? 1 : v.x < -0.5 ? -1 : 0, dy = v.y > 0.5 ? 1 : v.y < -0.5 ? -1 : 0;
  let sx = 0, sy = 0;
  if (dx !== navPrevX) {
    sx = dx;
    navHoldX = 0;
  } else if (dx) {
    navHoldX += dt;
    if (navHoldX > 0.42) {
      navHoldX -= 0.12;
      sx = dx;
    }
  }
  if (dy !== navPrevY) {
    sy = dy;
    navHoldY = 0;
  } else if (dy) {
    navHoldY += dt;
    if (navHoldY > 0.42) {
      navHoldY -= 0.12;
      sy = dy;
    }
  }
  navPrevX = dx;
  navPrevY = dy;
  return { x: sx, y: sy };
}

/** Everything that is not combat: menus, pause, practice tools. Runs once per frame. */
function handleUI(dt) {
  const nav = navStep(dt);
  if (input.pressed('mute')) {
    settings.sound = !settings.sound;
    save();
    updateOptions();
  }
  const ok = input.pressed('confirm'), back = input.pressed('back'), pauseKey = input.pressed('pause');
  if ((ok || back || pauseKey) && input.source === 'gamepad') audio.init();
  switch (screen) {
    case 'title':
      if (nav.y) moveFocus(-nav.y);
      else if (ok) activateFocus();
      break;
    case 'select':
      if (nav.x) selectFighter(selection + nav.x);
      else if (nav.y) {
        if (mode === 'arcade') setDifficulty(settings.difficulty + nav.y);
        else {
          setStagePick(selStage - nav.y);
          audio.menu();
        }
      } else if (ok) confirmSelect();
      else if (back) selectBack();
      break;
    case 'versus':
      if (ok && phaseTime > 0.5) resetRound();
      else if (back) mainMenu();
      break;
    case 'fight':
      if (pauseKey) pause();
      else if (mode === 'practice') {
        if (input.pressed('reset')) {
          resetRound();
          toast('Health and position reset.');
        }
        if (input.pressed('dummy')) {
          dummyMode = (dummyMode + 1) % 3;
          toast(`Dummy: ${['IDLE', 'GUARD', 'FIGHT'][dummyMode]}`);
          updatePrompts(true);
        }
      }
      break;
    case 'pause':
      if (pauseKey || back) resume();
      else if (nav.y) moveFocus(-nav.y);
      else if (ok) activateFocus();
      break;
    case 'help':
      if (back || pauseKey || ok) setScreen(modalBack);
      else if (nav.y) $('#help .modal-inner').scrollBy({ top: -nav.y * 90, behavior: 'smooth' });
      break;
    case 'options':
      if (back || pauseKey) setScreen(optionBack);
      else if (nav.y) moveFocus(-nav.y);
      else if (ok) activateFocus();
      break;
    case 'result':
      if (phaseTime < 0.4) break; // let the last hit's button go first
      if (back) mainMenu();
      else if (nav.y) moveFocus(-nav.y);
      else if (ok) activateFocus();
      break;
  }
}

function inputFor(f) {
  const pl = PL[f.id], H = pl.held, T = pl.taps;
  const left = H.left, right = H.right, down = H.down, forward = f.id === 0 ? right : left, back = f.id === 0 ? left : right;
  let a = null;
  for (const action of ATTACKS) if (T.has(action)) a = action;
  if ((H.lp && T.has('lk')) || (H.lk && T.has('lp'))) a = 'throw';
  const side = T.has('in') ? -1 : T.has('out') ? 1 : 0, hop = T.has('up');
  for (const direction of ['left', 'right']) {
    if (T.has(direction)) {
      if (simTime - f.lastTap[direction] < 0.25) {
        f.dash = 13;
        f.dashDir = direction === 'right' ? (f.id === 0 ? 1 : -1) : f.id === 0 ? -1 : 1;
      }
      f.lastTap[direction] = simTime;
    }
  }
  return { move: forward ? 1 : back ? -1 : 0, forward, back, down, side, hop, attack: a, guard: back || (!left && !right && !side && !hop), lowGuard: down && (back || !forward) };
}

function cpuInput(f, o) {
  const dif = clamp(settings.difficulty + (mode === 'arcade' ? stage * 0.2 : 0), 0, 2), dist = Math.hypot(f.x - o.x, f.z - o.z), master = f.char.boss;
  f.aiClock--;
  if (f.aiGuard > 0) f.aiGuard--;
  let action = null, side = 0;
  if (f.aiClock <= 0) {
    f.aiClock = Math.round(rand(13, 25) - dif * 3);
    const r = rnd();
    f.aiMove = dist > 1.75 ? 1 : dist < 0.98 ? -1 : 0;
    f.aiCrouch = false;
    if (o.attack && !o.attack.hit && o.attack.frame > 3 && rnd() < 0.26 + dif * 0.21 + (master ? 0.12 : 0)) {
      f.aiGuard = rand(15, 32) | 0;
      f.aiCrouch = o.attack.move.level === 'LOW' && rnd() < 0.55 + dif * 0.13;
      f.aiMove = -1;
    } else if (dist < (master ? 2.35 : 2.2) && r < 0.73 + dif * 0.075) {
      const opts = ['lp', 'rp', 'lk', 'rk', 'lowkick', 'thrust', 'launch', 'sweep'];
      if (o.crouch) opts.push('lk', 'axe', 'thrust');
      if (o.guard) opts.push('lowkick', 'sweep');
      if (dist < 1.26) opts.push('throw', 'throw');
      if (master) opts.push('thrust', 'rp', 'launch'); // long palms, then the lift
      action = opts[(rnd() * opts.length) | 0];
      f.aiMove = 0;
      f.aiGuard = 0;
    } else if (dist < 2.6 && r > 0.86 && dif > 0.1) {
      side = rnd() < 0.5 ? -1 : 1;
      f.aiMove = 0;
    } else if (r > 0.76) {
      f.aiMove = -1;
      f.aiGuard = 15;
    }
  }
  if (f.attack && f.attack.connected && f.attack.frame === f.attack.move.start + f.attack.move.active + 2 && rnd() < 0.43 + dif * 0.2) {
    const p = f.attack.move.button;
    action = p === 'lp' ? 'rp' : p === 'rp' ? 'rk' : p === 'lk' ? 'rk' : 'lp';
  }
  return { move: f.aiMove, forward: f.aiMove > 0, back: f.aiGuard > 0, down: f.aiCrouch && f.aiGuard > 0, side, hop: false, attack: action, guard: f.aiGuard > 0, lowGuard: f.aiCrouch && f.aiGuard > 0, cpu: true };
}

/* ------------------------------------------------------------ combat */

function chooseMove(f, inp) {
  const a = inp.attack;
  if (!a) return null;
  if (moves[a] && !['lp', 'rp', 'lk', 'rk'].includes(a)) return a;
  if (f.y > 0.12 && f.state !== 'air') return 'jumpkick';
  if (inp.down) return { lp: 'lowjab', rp: 'launch', lk: 'lowkick', rk: 'sweep' }[a] || a;
  if (inp.forward) {
    if (a === 'rp') return 'thrust';
    if (a === 'rk') return 'axe';
  }
  return a;
}
const historyEl = $('#input-history');
function updateHistory() {
  historyEl.innerHTML = keyHistory.slice(-9).map((e) => `<kbd>${e}</kbd>`).join('');
}
const HISTORY_LABEL = { lp: 'U', rp: 'I', lk: 'J', rk: 'K', lowjab: '↓U', lowkick: '↓J', sweep: '↓K', launch: '↓I', thrust: '→I', axe: '→K', throw: 'H', jumpkick: '↑K' };
function startAttack(f, key) {
  const src = moves[key];
  if (!src) {
    f.buffer = null;
    return;
  }
  const m = { ...src }, c = f.char;
  m.start = Math.max(8, Math.round(m.start * c.speedMod));
  m.recovery = Math.round(m.recovery * c.speedMod);
  if (c.id === 1 && ['lk', 'rk', 'axe'].includes(key)) {
    m.start -= 2;
    m.range += 0.13;
  }
  if (c.id === 2 && key === 'throw') m.dmg += 4;
  if (c.id === 3 && ['lp', 'rp', 'thrust', 'launch'].includes(key)) {
    m.range += 0.12; // the crane's long palms
    m.stun += 2;
  }
  if (f.chainStart) {
    m.start = Math.max(8, m.start - 6);
    f.chainStart = false;
  }
  f.history = f.history.filter((e) => simTime - e.t < 1.9);
  f.history.push({ key: m.button, t: simTime });
  const chain = f.history.slice(-3).map((e) => e.key).join(',');
  m.finisher = ['lp,rp,rk', 'lk,rk,lk', 'rp,lp,rp'].includes(chain);
  if (m.finisher) {
    m.dmg += 4;
    m.knock = true;
    m.name = c.finisher;
    m.range += 0.12;
  }
  f.attack = { move: m, key, frame: 0, hit: false, connected: false, dir: f.dir.slice() };
  f.state = 'attack';
  f.crouch = false;
  f.guard = false;
  f.buffer = null;
  f.lastMove = m.name;
  f.attackSerial++;
  if (f.id === 0) {
    keyHistory.push(HISTORY_LABEL[key] || key);
    if (keyHistory.length > 9) keyHistory.shift();
    updateHistory();
    $('#frame-readout').textContent = `${m.name.toUpperCase()} · ${m.level} · ${m.start}/${m.active}/${m.recovery}F`;
  }
}
function spawnSparks(x, y, z, type = 'hit', big = false) {
  const count = type === 'block' ? 12 : big ? 30 : 19;
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU), speed = rand(1, 4.8) * (big ? 1.25 : 1);
    particles.push({ x, y, z, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed + 1.0, vz: rand(-1, 1), life: rand(0.15, 0.36), max: 0.36, type, size: rand(1.5, 4.5) });
  }
  floatTexts.push({ x, y: y + 0.22, z, text: type === 'block' ? 'GUARD' : type === 'throwbreak' ? 'BREAK' : '', life: 0.55, color: type === 'block' ? '#b8e5da' : '#f4c774' });
}
function applyHit(f, o, a) {
  const m = a.move, dx = o.x - f.x, dz = o.z - f.z, along = dx * a.dir[0] + dz * a.dir[1], across = Math.abs(-dx * a.dir[1] + dz * a.dir[0]);
  if (o.invuln > 0 || o.state === 'ko' || o.ground > 0 || o.state === 'down') return false;
  if (along < -0.15 || along > m.range * f.char.height || across > (m.track ? 0.85 : 0.49)) return false;
  if (o.sidestep > 4 && o.sidestep < 15 && !m.track) return false;
  const airborne = o.y > 0.12 || o.state === 'air';
  if (m.level === 'HIGH' && o.crouch && !airborne) {
    a.hit = true;
    return false;
  }
  if (m.level === 'LOW' && airborne) {
    a.hit = true;
    return false;
  }
  if (airborne && o.y > 1.65) {
    a.hit = true;
    return false;
  }
  if (m.level === 'THROW') {
    if (airborne || o.crouch) {
      a.hit = true;
      return false;
    }
    // Only a fighting CPU breaks throws on its own; the practice dummy holds still.
    const cpuBreaks = o.id === 1 && (mode === 'arcade' || (mode === 'practice' && dummyMode === 2)) && rnd() < settings.difficulty * 0.12;
    if (o.throwBreak > 0 || cpuBreaks) {
      a.hit = true;
      a.connected = true;
      spawnSparks(o.x, 1.3, o.z, 'throwbreak', false);
      floatTexts.push({ x: o.x, y: 1.9, z: o.z, text: 'THROW BREAK', life: 0.8, color: '#b8e5da' });
      o.invuln = 13;
      f.stun = 10;
      f.attack = null;
      o.attack = null;
      o.buffer = null;
      o.stun = 7;
      audio.block();
      rumbleFor(o.id, 0.3, 90);
      return true;
    }
  }
  const block = !airborne && o.stun === 0 && !o.attack && m.level !== 'THROW' && (m.level === 'LOW' ? o.guardLow : !o.crouch && o.guard);
  a.hit = true;
  a.connected = true;
  let hitY = m.level === 'LOW' ? 0.4 : m.level === 'HIGH' ? 1.67 : 1.27;
  if (airborne) hitY = 1 + o.y;
  if (block) {
    o.state = 'block';
    o.stun = 0;
    o.blockTime = 10 + Math.floor(m.dmg / 4);
    o.x += a.dir[0] * 0.08;
    o.z += a.dir[1] * 0.08;
    f.x -= a.dir[0] * 0.04;
    f.z -= a.dir[1] * 0.04;
    spawnSparks(o.x, hitY, o.z, 'block');
    audio.block();
    rumbleFor(o.id, 0.18, 60);
    freeze = 3;
    return true;
  }
  const counter = !!o.attack && o.attack.frame < o.attack.move.start;
  const scale = airborne ? Math.max(0.36, 0.74 - o.juggle * 0.13) : o.taken > 0 ? Math.max(0.55, 1 - o.taken * 0.14) : 1;
  const damage = Math.round(m.dmg * f.char.damage * scale * (counter ? 1.2 : 1));
  if (o.attack) o.attack = null;
  o.buffer = null;
  o.hp = Math.max(0, o.hp - damage);
  o.hitAge = 0;
  o.stun = m.stun + (counter ? 5 : 0);
  o.crouch = false;
  o.guard = false;
  o.blockTime = 0;
  o.taken++;
  o.state = 'hit';
  const continued = (airborne || o.taken > 1) && f.comboTime > 0;
  f.combo = continued ? f.combo + 1 : 1;
  f.comboDamage = continued ? f.comboDamage + damage : damage;
  f.comboTime = 1.5;
  f.comboCounter = counter;
  f.lastDamage = damage;
  f.totalDamage += damage;
  if (f.id === 0) {
    if (mode === 'arcade') score += damage * 8;
    bestCombo = Math.max(bestCombo, f.combo);
  }
  const push = m.push * (airborne ? 0.8 : 1);
  o.x += a.dir[0] * push;
  o.z += a.dir[1] * push;
  if (m.launch || airborne) {
    if (o.juggle < 4) {
      o.state = 'air';
      o.vy = m.launch && !airborne ? 6.8 : 4.25 - o.juggle * 0.4;
      o.y = Math.max(o.y, 0.04);
      o.vx = a.dir[0] * (airborne ? 1.4 : 1.1);
      o.vz = a.dir[1] * (airborne ? 1.4 : 1.1);
      o.stun = 0;
      o.juggle++;
    } else {
      o.state = 'air';
      o.vy = -2;
    }
  } else if (m.knock) {
    o.state = 'air';
    o.vy = m.level === 'THROW' ? 3.2 : 2.9;
    o.y = 0.03;
    o.vx = a.dir[0] * 2.1;
    o.vz = a.dir[1] * 2.1;
    o.stun = 0;
    o.juggle = 4;
  }
  const big = m.dmg >= 20 || m.launch || m.finisher;
  spawnSparks(o.x, hitY, o.z, 'hit', big);
  if (counter) floatTexts.push({ x: o.x, y: hitY + 0.35, z: o.z, text: 'COUNTER', life: 0.72, color: '#ffbc66' });
  if (m.launch) floatTexts.push({ x: f.x, y: 2.15, z: f.z, text: 'LAUNCH', life: 0.7, color: '#f5de9c' });
  if (m.finisher) floatTexts.push({ x: f.x, y: 2.2, z: f.z, text: m.name.toUpperCase(), life: 0.9, color: '#ffe2a4' });
  audio.hit(big, counter);
  rumbleFor(f.id, big ? 0.4 : 0.22, big ? 120 : 70);
  rumbleFor(o.id, big ? 0.85 : 0.45, big ? 220 : 120);
  freeze = big ? 6 : 4;
  shake = big ? 0.075 : 0.035;
  flash = big ? 0.14 : 0.06;
  if (o.hp <= 0 && mode !== 'practice') {
    endRound(f.id);
    o.state = 'air';
    o.vy = Math.max(o.vy, 3.0);
    o.y = Math.max(o.y, 0.03);
    o.vx = a.dir[0] * 2.2;
    o.vz = a.dir[1] * 2.2;
    freeze = 12;
    shake = 0.16;
    flash = 0.25;
  }
  return true;
}
function endRound(winner, reason = 'ko') {
  if (phase !== 'fight') return;
  roundWinner = winner;
  if (winner >= 0) wins[winner]++;
  phase = 'ko';
  phaseTime = 0;
  const perfect = winner >= 0 && fighters[winner].hp === MAX_HP;
  showAnnouncement(winner < 0 ? 'DRAW' : reason === 'time' ? 'TIME UP' : perfect ? 'PERFECT' : 'K.O.', winner < 0 ? 'ONE MORE ROUND' : `${fighters[winner].char.name} WINS`, 2.5);
  // In local versus nobody "loses" to the announcer: the winner gets the call.
  audio.say(winner < 0 ? 'draw' : reason === 'time' ? (winner === 0 || mode === 'versus' ? 'win' : 'lose') : perfect ? 'perfect' : 'ko');
  updateHUD(true);
}
function updateFighter(f, o, inp, dt) {
  f.hitAge += dt;
  if (f.comboTime > 0) {
    f.comboTime -= dt;
    if (f.comboTime <= 0) {
      f.combo = 0;
      f.comboDamage = 0;
      f.comboCounter = false;
    }
  }
  if (f.invuln > 0) f.invuln--;
  if (f.throwBreak > 0) f.throwBreak--;
  if (inp.attack === 'throw') f.throwBreak = 12;
  const dx = o.x - f.x, dz = o.z - f.z, len = Math.hypot(dx, dz) || 1;
  if (!f.attack && f.sidestep <= 0) f.dir = [dx / len, dz / len];
  if (f.state === 'air') {
    f.y += f.vy * dt;
    f.vy -= 18 * dt;
    f.x += f.vx * dt;
    f.z += f.vz * dt;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      f.state = f.hp <= 0 && mode !== 'practice' ? 'ko' : 'down';
      f.ground = 42;
      f.stun = 0;
      audio.tone(70, 0.14, 0.14, 'sine', 35);
      if (settings.shake) shake = Math.max(shake, 0.04);
      spawnSparks(f.x, 0.08, f.z, 'dust', false);
      rumbleFor(f.id, 0.3, 90);
      if (inp.attack) {
        f.ground = 22;
        f.invuln = 8;
      }
    }
    if (inp.attack && mode === 'practice' && f.hp === 0) f.hp = MAX_HP;
    return;
  }
  if (f.state === 'down' || f.state === 'ko') {
    if (f.state === 'ko') return;
    if (inp.attack || inp.side) {
      f.ground = Math.min(f.ground, 16);
      f.invuln = 12;
    }
    f.ground--;
    if (f.ground <= 0) {
      f.state = 'idle';
      f.invuln = 12;
      f.juggle = 0;
      f.taken = 0;
      if (mode === 'practice' && f.hp <= 0) f.hp = MAX_HP;
    }
    return;
  }
  if (f.stun > 0) {
    f.stun--;
    if (f.stun <= 0) {
      f.state = 'idle';
      f.taken = 0;
    }
    return;
  }
  if (f.blockTime > 0) {
    f.blockTime--;
    f.state = 'block';
    if (f.blockTime === 0) f.state = 'idle';
    return;
  }
  if (f.y > 0) {
    f.y += f.vy * dt;
    f.vy -= 17 * dt;
    if (f.y < 0) {
      f.y = 0;
      f.vy = 0;
    }
  }
  const key = chooseMove(f, inp);
  if (key) f.buffer = { key, age: 0 };
  if (f.buffer) {
    f.buffer.age++;
    if (f.buffer.age > 18) f.buffer = null;
  }
  if (f.attack) {
    const a = f.attack, m = a.move;
    a.frame++;
    if (a.frame === m.start - 3) audio.swing(m.dmg >= 20);
    if (a.frame > 3 && a.frame < m.start) {
      const s = m.step / (m.start - 3);
      f.x += a.dir[0] * s;
      f.z += a.dir[1] * s;
    }
    if (a.frame >= m.start && a.frame < m.start + m.active && !a.hit && phase === 'fight') applyHit(f, o, a);
    if (f.attack) {
      const end = m.start + m.active + m.recovery;
      const canChain = f.buffer && !m.finisher && ['lp,rp', 'rp,rk', 'lk,rk', 'rk,lk', 'rp,lp'].includes(`${m.button},${moves[f.buffer.key]?.button || ''}`) && !m.launch;
      if (a.frame >= end || (a.connected && a.frame >= m.start + m.active && canChain)) {
        f.attack = null;
        f.state = 'idle';
        f.chainStart = !!(a.connected && canChain);
        if (f.buffer && phase === 'fight') startAttack(f, f.buffer.key);
      }
    }
    f.walk = 0;
    return;
  }
  if (f.buffer && f.sidestep < 3 && phase === 'fight') {
    startAttack(f, f.buffer.key);
    return;
  }
  if (f.sidestep > 0) {
    const v = 0.062 * f.sideSign;
    f.x -= f.dir[1] * v;
    f.z += f.dir[0] * v;
    f.sidestep--;
    f.guard = false;
    f.walk = 0.4;
    return;
  }
  f.crouch = inp.down && f.y === 0;
  f.guard = inp.guard;
  f.guardLow = inp.lowGuard;
  f.walk = Math.abs(inp.move);
  if (inp.side && phase === 'fight' && f.y === 0) {
    f.sidestep = 18;
    f.sideSign = inp.side;
    audio.noiseHit(0.1, 0.045, 2600);
    return;
  }
  if (inp.hop && f.y === 0 && !f.crouch && phase === 'fight') {
    f.y = 0.01;
    f.vy = 4.6;
    f.guard = false;
    audio.swing();
  }
  if (f.dash > 0) {
    const amount = 0.083 * f.dashDir;
    f.x += f.dir[0] * amount;
    f.z += f.dir[1] * amount;
    f.dash--;
    f.walk = 1;
  } else if (inp.move && phase === 'fight') {
    const speed = (inp.move > 0 ? 1.75 : 1.35) * (f.crouch ? 0.48 : 1) * (f.char.id === 1 ? 1.1 : 1);
    f.x += f.dir[0] * inp.move * speed * dt;
    f.z += f.dir[1] * inp.move * speed * dt;
  }
  f.state = f.crouch ? 'crouch' : f.y > 0 ? 'jump' : f.walk ? 'walk' : 'idle';
  if (mode === 'practice' && f.hitAge > 2.5 && f.hp < MAX_HP) {
    f.hp = Math.min(MAX_HP, f.hp + 4);
    f.taken = 0;
  }
}

/* ------------------------------------------------------------ HUD (writes only on change) */

const hud = [1, 2].map((j) => ({
  health: $(`#health${j}`),
  delay: $(`#delay${j}`),
  hp: $(`#hp${j}`),
  dots: [...$(`#rounds${j}`).children],
  combo: $(`#combo${j}`),
  comboEm: $(`#combo${j} em`),
  comboStrong: $(`#combo${j} strong`),
  comboSmall: $(`#combo${j} small`),
}));
const timerEl = $('#timer'), timerValue = $('#timer-value'), dangerEl = $('#danger-glow'), hitsEl = $('#practice-hits');
const setText = (el, v) => {
  if (el._v !== v) {
    el._v = v;
    el.textContent = v;
  }
};
const setStyle = (el, prop, v) => {
  const k = `_${prop}`;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
};
const setClass = (el, cls, on) => {
  const k = `_c${cls}`;
  if (el[k] !== on) {
    el[k] = on;
    el.classList.toggle(cls, on);
  }
};
function updateHUD(force = false) {
  if (force) for (const h of hud) for (const el of Object.values(h)) if (el && !Array.isArray(el)) el._v = undefined;
  fighters.forEach((f, i) => {
    const h = hud[i];
    setStyle(h.health, 'width', `${(f.hp / MAX_HP) * 100}%`);
    setClass(h.health, 'danger', f.hp < 43);
    setStyle(h.delay, 'width', `${((f.delay / MAX_HP) * 100).toFixed(1)}%`);
    setText(h.hp, `${f.hp} / ${MAX_HP}`);
    h.dots.forEach((e, k) => setClass(e, 'won', wins[i] > k));
    setClass(h.combo, 'show', f.comboTime > 0 && (f.combo > 1 || f.comboCounter));
    setText(h.comboStrong, `${f.combo} HIT${f.combo === 1 ? '' : 'S'}`);
    setText(h.comboSmall, `${f.comboDamage} DAMAGE`);
    setText(h.comboEm, f.comboCounter ? 'COUNTER HIT' : f.combo >= 3 ? 'COMBO' : '');
  });
  setText(timerValue, mode === 'practice' ? '∞' : Math.ceil(timer).toString().padStart(2, '0'));
  setClass(timerEl, 'low', timer < 10 && mode !== 'practice');
  setStyle(dangerEl, 'opacity', fighters[0].hp < 43 ? '1' : '0');
  setText(hitsEl, `LAST DAMAGE ${fighters[0].lastDamage} · TOTAL ${fighters[0].totalDamage}`);
}

/* ------------------------------------------------------------ simulation tick (60 Hz) */

function tick(dt) {
  frameNo++;
  if (screen !== 'pause' && screen !== 'help' && screen !== 'options') simTime += dt;
  if (screen === 'versus') {
    phaseTime += dt;
    if (phaseTime > 2.65) resetRound();
    clearTaps();
    return;
  }
  if (screen === 'result') phaseTime += dt;
  if (screen !== 'fight') {
    clearTaps();
    return;
  }
  phaseTime += dt;
  if (phase === 'intro') {
    if (phaseTime > 1.4 && phaseTime - dt <= 1.4) {
      showAnnouncement('FIGHT', '', 0.68);
      audio.say('fight');
    }
    if (phaseTime > 2.08) {
      phase = 'fight';
      phaseTime = 0;
    }
    updateHUD();
    clearTaps();
    return;
  }
  if (phase === 'ko') {
    if (freeze > 0) {
      freeze--;
      clearTaps();
      return;
    }
    const sd = phaseTime < 1.05 ? dt * 0.24 : dt;
    for (const f of fighters) {
      if (f.state === 'air') {
        f.y += f.vy * sd;
        f.vy -= 18 * sd;
        f.x += f.vx * sd;
        f.z += f.vz * sd;
        if (f.y <= 0) {
          f.y = 0;
          f.state = 'ko';
        }
      } else if (f.id === roundWinner && phaseTime > 1.45) {
        f.state = 'victory';
        f.attack = null;
      }
    }
    if (phaseTime > 3.45) {
      if (wins[0] >= 2 || wins[1] >= 2) showResult();
      else {
        round++;
        resetRound();
      }
    }
    updateHUD();
    clearTaps();
    return;
  }
  if (phase !== 'fight') {
    clearTaps();
    return;
  }
  if (mode === 'arcade') runTime += dt;
  if (freeze > 0) {
    freeze--;
    // Attacks pressed during hit-stop are buffered (for the players, not the CPU).
    for (const f of fighters) {
      if (!human(f)) continue;
      const T = PL[f.id].taps;
      if (ATTACKS.some((a) => T.has(a))) {
        const key = chooseMove(f, inputFor(f));
        if (key) f.buffer = { key, age: 0 };
      }
    }
    clearTaps();
    return;
  }
  const inputs = [inputFor(fighters[0]), null];
  if (mode === 'versus') inputs[1] = inputFor(fighters[1]);
  else if (mode === 'practice' && dummyMode < 2) inputs[1] = { move: 0, down: false, guard: dummyMode === 1, lowGuard: false, side: 0, hop: false, attack: null };
  else inputs[1] = cpuInput(fighters[1], fighters[0]);
  for (let i = 0; i < 2; i++) updateFighter(fighters[i], fighters[1 - i], inputs[i], dt);
  // Resolve overlap symmetrically, but do not let a standing fighter pin a body.
  const a = fighters[0], b = fighters[1], dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), min = 0.64;
  if (dist < min && dist > 0.001 && a.state !== 'air' && b.state !== 'air' && a.ground === 0 && b.ground === 0) {
    const d = (min - dist) / 2;
    a.x -= (dx / dist) * d;
    a.z -= (dz / dist) * d;
    b.x += (dx / dist) * d;
    b.z += (dz / dist) * d;
  }
  for (const f of fighters) {
    const r = Math.hypot(f.x, f.z);
    if (r > 6.6) {
      f.x *= 6.6 / r;
      f.z *= 6.6 / r;
    }
    f.delay = lerp(f.delay, f.hp, f.hitAge > 0.36 ? 0.08 : 0.005);
    if (Math.abs(f.delay - f.hp) < 0.25) f.delay = f.hp;
  }
  if (mode !== 'practice') {
    const previous = Math.ceil(timer);
    timer = Math.max(0, timer - dt);
    if (timer < 10 && Math.ceil(timer) !== previous) audio.tone(740, 0.04, 0.05, 'square');
    if (timer === 0) endRound(a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1, 'time');
  }
  if (++hudTick % 2 === 0) updateHUD();
  clearTaps();
}

/* ------------------------------------------------------------ camera and drawing */

const TITLE_TARGET = [0.45, 1.75, -0.4], SELECT_TARGET = [0.45, 1.32, 0.2], SELECT_EYE = [3.55, 2.1, 5.85];
const target = [0, 0, 0], desired = [0, 0, 0];
let lastFov = 0;
function updateCamera(dt) {
  const t = realTime, isMenu = screen === 'title' || screen === 'select' || screen === 'result';
  const f0 = fighters[0], f1 = fighters[1];
  if (screen === 'title' || (screen === 'help' && modalBack === 'title') || (screen === 'options' && optionBack === 'title')) {
    target[0] = TITLE_TARGET[0]; target[1] = TITLE_TARGET[1]; target[2] = TITLE_TARGET[2];
    desired[0] = 4.35 + Math.sin(t * 0.13) * 0.25; desired[1] = 2.72; desired[2] = 7.1;
    f0.x = 1.5; f0.z = 0.88; f0.dir = [0.82, 0.57]; f0.state = 'idle'; f0.char = roster[chosen];
    f1.x = 3.8; f1.z = -0.6; f1.dir = [-0.87, -0.5]; f1.state = 'idle';
  } else if (screen === 'select') {
    target[0] = SELECT_TARGET[0]; target[1] = SELECT_TARGET[1]; target[2] = SELECT_TARGET[2];
    desired[0] = SELECT_EYE[0]; desired[1] = SELECT_EYE[1]; desired[2] = SELECT_EYE[2];
    f0.x = 1.52; f0.z = 0.65; f0.dir = [0.66, 0.75]; f0.state = 'idle';
  } else if (screen === 'result') {
    const win = fighters[matchWinner < 0 ? 0 : matchWinner];
    target[0] = win.x - 1.0; target[1] = 1.2; target[2] = win.z;
    desired[0] = win.x + 2.7; desired[1] = 2.37; desired[2] = win.z + 5.7;
  } else {
    const mx = (f0.x + f1.x) / 2, mz = (f0.z + f1.z) / 2, d = Math.hypot(f1.x - f0.x, f1.z - f0.z);
    const angle = Math.atan2(f1.z - f0.z, f1.x - f0.x) + Math.PI / 2;
    const diff = ((angle - cameraAngle + Math.PI * 3) % TAU) - Math.PI;
    cameraAngle += diff * Math.min(1, dt * 3.2);
    camDist = lerp(camDist, clamp(5.45 + d * 0.42, 6.35, 11.4), Math.min(1, dt * 2.8));
    target[0] = mx; target[1] = 1.24; target[2] = mz;
    desired[0] = mx + Math.cos(cameraAngle) * camDist; desired[1] = 2.33 + d * 0.035; desired[2] = mz + Math.sin(cameraAngle) * camDist;
  }
  const speed = Math.min(1, isMenu ? dt * 3 : dt * 6);
  for (let i = 0; i < 3; i++) {
    camTarget[i] = lerp(camTarget[i], target[i], speed);
    camEye[i] = lerp(camEye[i], desired[i], speed);
  }
  let ex = camEye[0], ey = camEye[1];
  if (settings.shake && shake > 0) {
    ex += (Math.random() - 0.5) * shake;
    ey += (Math.random() - 0.5) * shake * 0.55;
  }
  const fov = ((screen === 'title' ? 0.65 : 0.61) * 180) / Math.PI;
  if (fov !== lastFov) {
    lastFov = fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.position.set(ex, ey, camEye[2]);
  camera.lookAt(camTarget[0], camTarget[1], camTarget[2]);
  camera.updateMatrixWorld();
  PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

const _f1 = [0, 0, 0], _f2 = [0, 0, 0], FLAME_A = [0.075, 0.18, 0.075], FLAME_B = [0.038, 0.15, 0.043], _ra = [0, 0, 0], _rb = [0, 0, 0];
function render(dt) {
  updateCamera(dt);
  const g = dyn.g, sg = shade.g;
  g.reset();
  sg.reset();
  if (screen === 'result') {
    const w = fighters[matchWinner];
    drawShadow(sg, w);
    drawFighter(g, w, simTime);
  } else {
    drawShadow(sg, fighters[0]);
    drawFighter(g, fighters[0], simTime);
    if (screen !== 'select') {
      drawShadow(sg, fighters[1]);
      drawFighter(g, fighters[1], simTime);
    }
  }
  for (const L of flames) {
    const s = Math.sin(realTime * 17 + L[0]) * 0.05;
    _f1[0] = L[0]; _f1[1] = L[1] + s; _f1[2] = L[2];
    _f2[0] = L[0] + 0.05; _f2[1] = L[1] + 0.1 + s; _f2[2] = L[2];
    FLAME_A[1] = 0.18 + s;
    g.sphere(_f1, FLAME_A, '#ffe09c', 3, 5, 1);
    g.sphere(_f2, FLAME_B, '#f5b45f', 3, 4, 1);
  }
  if (screen === 'fight') {
    for (const f of fighters) {
      if (f.attack && f.attack.move.launch && f.attack.frame > f.attack.move.start - 3 && f.attack.frame < f.attack.move.start + 8 && f.pose) {
        const h = f.char.height, px = f.pose.rh[0] * h, py = f.pose.rh[1] * h, pz = f.pose.rh[2] * h, dir = f.dir;
        _ra[0] = f.x + dir[0] * px - dir[1] * pz; _ra[1] = f.y + py - 0.35; _ra[2] = f.z + dir[1] * px + dir[0] * pz;
        _rb[0] = _ra[0]; _rb[1] = f.y + py + 0.12; _rb[2] = _ra[2];
        g.bone(_ra, _rb, 0.047, 0.01, '#f6d284', 5, 1);
      }
    }
  }
  dyn.commit();
  shade.commit();
  drawFX(dt);
  shake *= Math.pow(0.005, dt);
  flash *= Math.pow(0.001, dt);
}

function drawFX(dt) {
  ctx.clearRect(0, 0, FW, FH);
  const scale = FW / 1280;
  // Warm lamp bloom, kept subtle enough to preserve the pixel edges; it flickers with the flame.
  for (const L of glows) {
    const p = project(L[0], L[1] - 0.02, L[2], _s);
    if (!p) continue;
    const r = clamp(320 / p[2], 14, 80) * scale;
    ctx.globalAlpha = stageLook.glow * (1 + Math.sin(realTime * 17 + L[0]) * 0.08);
    ctx.drawImage(LAMP_GLOW, p[0] - r, p[1] - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  if (stageLook.drift === 'fireflies') {
    // Fireflies drift over the tea rows on the terrace.
    for (let i = 0, n = kit.detail(40); i < n; i++) {
      const t = realTime * (0.1 + (i % 7) * 0.013) + i * 2.17;
      const x = ((i * 5.31 + Math.sin(t * 0.7) * 3) % 26) - 13, y = 0.4 + ((i * 0.37) % 3.2) + Math.sin(t * 1.3) * 0.35, z = ((i * 4.13 + Math.cos(t * 0.5) * 3) % 24) - 12;
      const p = project(x, y, z, _s);
      if (!p) continue;
      const pulse = 0.5 + 0.5 * Math.sin(realTime * (1.7 + (i % 5) * 0.4) + i);
      const r = clamp(60 / p[2], 3, 14) * scale;
      ctx.globalAlpha = 0.25 + pulse * 0.55;
      ctx.drawImage(FIREFLY_GLOW, p[0] - r, p[1] - r, 2 * r, 2 * r);
      ctx.fillStyle = '#f4ffc8';
      ctx.fillRect(p[0] - scale, p[1] - scale, 2 * scale, 2 * scale);
    }
    ctx.globalAlpha = 1;
  } else {
    // Slow drifting leaves remain visible in the attract scene and menus.
    for (let i = 0, n = kit.detail(32); i < n; i++) {
      const t = realTime * (0.12 + (i % 5) * 0.018) + i * 3.41, x = ((i * 7.91 + t * 1.5) % 24) - 12, y = 5.5 - ((t * 0.43) % 5.3), z = ((i * 3.7) % 14) - 7;
      const p = project(x + Math.sin(t) * 0.4, y, z, _s);
      if (!p) continue;
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(t * 2);
      ctx.fillStyle = i % 3 === 0 ? '#dba26988' : '#d9794677';
      ctx.fillRect(-2 * scale, -1 * scale, 4 * scale, 2 * scale);
      ctx.restore();
    }
  }
  const live = screen === 'fight' && freeze <= 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (live) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 8 * dt;
      p.vx *= 0.97;
    }
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const s = project(p.x, p.y, p.z, _s), e = project(p.x - p.vx * 0.026, p.y - p.vy * 0.026, p.z, _e);
    if (!s || !e) continue;
    ctx.globalAlpha = clamp(p.life / 0.15, 0, 1);
    ctx.strokeStyle = p.type === 'block' ? '#b9e8e2' : p.type === 'dust' ? '#c2b191' : '#ffd58a';
    ctx.lineWidth = p.size * scale;
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.stroke();
    ctx.fillStyle = p.type === 'block' ? '#e8fff7' : '#fff6d3';
    ctx.fillRect(s[0] - scale, s[1] - scale, 2 * scale, 2 * scale);
  }
  ctx.globalAlpha = 1;
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const p = floatTexts[i];
    if (live) {
      p.life -= dt;
      p.y += dt * 0.3;
    }
    if (p.life <= 0) {
      floatTexts.splice(i, 1);
      continue;
    }
    if (!p.text) continue;
    const s = project(p.x, p.y, p.z, _s);
    if (!s) continue;
    ctx.font = `italic 800 ${Math.round(16 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = '#122020';
    ctx.fillText(p.text, s[0] + 2 * scale, s[1] + 2 * scale);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, s[0], s[1]);
  }
  ctx.globalAlpha = 1;
  if (flash > 0.01 && screen === 'fight') {
    ctx.fillStyle = `rgba(255,216,158,${flash * 0.23})`;
    ctx.fillRect(0, 0, FW, FH);
  }
}

/* ------------------------------------------------------------ sizing, pause, audio unlock */

function resizeFx(w) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const fw = Math.min(2560, Math.max(640, Math.round(w * dpr))), fh = Math.round((fw * 9) / 16);
  if (fx.width !== fw || fx.height !== fh) {
    fx.width = fw;
    fx.height = fh;
  }
  FW = fw;
  FH = fh;
}
function placeTouch() {
  if (!kit.touch) return;
  const r = $('#cabinet').getBoundingClientRect();
  // Portrait: the pills go just under the arena. Landscape: under the round timer.
  const portrait = innerHeight > innerWidth;
  kit.touch.placeTop('center', Math.round(portrait ? r.bottom + 10 : r.top + r.height * 0.23));
}
kit.onResize((w) => {
  resizeFx(w);
  updateSnap();
  placeTouch();
});

kit.onPause((p) => {
  if (p && screen === 'fight') pause();
  audio.hold(p || document.hidden);
});
addEventListener('blur', () => {
  if (screen === 'fight') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'fight') pause();
  audio.hold(document.hidden || kit.paused);
});
// Audio may only start from a gesture: the first click, tap or key press unlocks it.
const unlock = () => audio.init();
addEventListener('pointerdown', unlock, { capture: true, passive: true });
addEventListener('keydown', unlock, { capture: true });
addEventListener('gamepadconnected', () => toast('Gamepad connected. Press START to play.'));

/* ------------------------------------------------------------ start */

updateOptions();
setStagePick(0);
selectFighter(0);
mainMenu();
updatePrompts(true);
kit.loading.progress(0.9, 'Warming up…');
// Both arenas share one material; show the second while compiling so its first use never stalls.
terrace.mesh.visible = true;
try {
  await kit.renderer.compileAsync(scene, camera);
} catch {
  /* compiled on first draw instead */
}
applyStage(STAGES[0]);

kit.start((dt) => {
  realTime += dt;
  audio.tick();
  gatherFightInput();
  handleUI(dt);
  acc = Math.min(acc + dt, 0.1);
  let ticks = 0;
  while (acc >= 1 / 60 && ticks < 6) {
    tick(1 / 60);
    acc -= 1 / 60;
    ticks++;
  }
  if (announcing && announcementUntil < realTime) {
    announceEl.classList.remove('show');
    announcing = false;
  }
  if (toastOn && toastTime < realTime) {
    $('#toast').style.opacity = 0;
    toastOn = false;
  }
  render(Math.min(dt, 0.04));
  kit.renderer.render(scene, camera);
});

// Read-only state for diagnostics, browser tests, and accessibility tools.
window.TeaKen = {
  version: '2.0.0',
  getState: () => ({
    screen, mode, phase, round, wins: [...wins], timer, stage, stageName: stageLook.name, score, bestCombo, dummyMode, frame: frameNo, runTime,
    settings: { ...settings },
    fighters: fighters.map((f) => ({ name: f.char.name, x: f.x, z: f.z, y: f.y, hp: f.hp, state: f.state, attack: f.attack ? { name: f.attack.move.name, frame: f.attack.frame, level: f.attack.move.level } : null, combo: f.combo, totalDamage: f.totalDamage })),
  }),
};
