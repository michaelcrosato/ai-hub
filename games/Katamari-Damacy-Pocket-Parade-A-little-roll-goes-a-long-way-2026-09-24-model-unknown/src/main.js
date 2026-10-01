// Pocket Parade — A little roll goes a long way. One room, hundreds of little things, one new star.
// Original art, music and game logic; drawn by three.js through the shared kit (WebGPU first,
// WebGL2 as the fallback). The particles, floating names and hints stay on a 2D overlay.
import { boot } from 'kit/boot.js';
import { TAU, PI, clamp, lerp, V, Q, compose, initGeometry, between } from './geometry.js';
import { P, MODELS, initModels, thumbFor } from './models.js';
import { initRoom, envMeshes, staticModels, obstacles, shadowTex, markerMesh, rugHeight, inTable, terrain } from './room.js';
import { buildItems, landingOK } from './level.js';
import { createRenderLayer } from './render.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- save
const SAVE_KEY = 'pocket-parade-v1';
const save = {
  best: 0, items: 0, won: false, sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  fastest: 0, encoreBest: 0, encoreWon: false, found: {},
};
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch { /* a fresh little start */ }
if (!save.found || typeof save.found !== 'object') save.found = {};
for (const k of ['best', 'items', 'fastest', 'encoreBest']) save[k] = Number.isFinite(+save[k]) ? +save[k] : 0;
let reduced = !!save.reduced;
function store() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode: keep playing */ }
}

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'Pocket Parade',
  canvas: $('world'),
  gear: 'none', // the title and pause screens carry a Graphics button that opens the kit settings
  accent: '#f78273',
  background: '#244d43',
  touch: { theme: 'light' }, // dark controls read better over the cream room
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['A', 'RT'], touch: 'Boost' },
    turnBack: { keys: ['Space'], gamepad: ['Y'], touch: '↻' },
    send: { keys: ['Enter', 'NumpadEnter'], gamepad: ['X'], touch: 'Sky' },
    turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    zoomPad: { type: 'axis', gamepad: { pos: 'RB', neg: 'LB' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    mute: { keys: ['KeyM'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const input = kit.input;
const canvas = kit.canvas;
kit.loading.progress(0.7, 'Putting the little things in place…');

// ---------------------------------------------------------------- the room, drawn
initGeometry();
initModels();
initRoom();
const R = createRenderLayer(kit);

// See-through layers draw in the old order: room shadows, the sun patch, blob shadows, wish rings.
let layer = 0;
for (const def of envMeshes) R.mesh(def, null, def.transparent ? ++layer : 0);
for (const s of staticModels) R.mesh(s.p.mesh, s.mat);
const shadows = R.shadowLayer(shadowTex);
const markers = R.batch(markerMesh, 8);
markers.mesh.renderOrder = 4;
// One batch per little thing: the copies in the room and the ones riding on the ball.
const ITEM_IDS = Object.keys(P);
const batchList = ITEM_IDS.map((id) => R.batch(P[id].mesh, 1024));
const batchOf = {};
ITEM_IDS.forEach((id, i) => { batchOf[id] = batchList[i]; });
const ballPuppet = R.puppet(MODELS.ball), bodyPuppet = R.puppet(MODELS.body), headPuppet = R.puppet(MODELS.head);
const armPuppets = [R.puppet(MODELS.arm), R.puppet(MODELS.arm)], legPuppets = [R.puppet(MODELS.leg), R.puppet(MODELS.leg)];

// ---------------------------------------------------------------- rules and state
const START_RADIUS = 0.6, GOAL_CM = 50, MISSION_SECONDS = 180;
const ENCORE_RADIUS = 1.5, ENCORE_GOAL_CM = 80, ENCORE_SECONDS = 210;
const STAGES = {
  mission: [
    { at: 20, main: 'A little bigger!', sub: 'Oranges and wooden blocks now stick.' },
    { at: 30, main: 'Look at that little world.', sub: 'Toy cars, cups, and robots now stick.' },
    { at: 38, main: 'Big things are little now.', sub: 'Bears, clocks, and plants now stick.' },
  ],
  encore: [
    { at: 42, main: 'The furniture is getting nervous.', sub: 'Lamps, globes, and the ukulele now stick.' },
    { at: 54, main: 'Nothing is too big now.', sub: 'Stools, baskets, and even the cat now stick.' },
    { at: 66, main: 'A whole little house!', sub: 'The doll house sticks. The bean bag is next.' },
  ],
};
const ONE = [1, 1, 1];

let state = 'title', lastState = 'title', realTime = 0, mode = 'mission';
let freeMode = false, remaining = MISSION_SECONDS, gameTime = 0, goalMet = false, goalTime = 0, fastRecord = false;
let peakCm = 12, wishes = new Set(), largest = null, categoryCounts = {}, combo = 0, comboTimer = 0, pickupTimer = 0, toastTimer = 0;
let bumpCooldown = 0, blockedItem = null, blockedTimer = 0, camYaw = 0, camYawTarget = 0, camZoom = 1, camLift = 1, walkPhase = 0;
let celebrateTime = 0, ascend = 0, resultSuccess = false, record = false, nextStage = 0, trailTimer = 0, shake = 0;
let items = [], attachments = [], previewAttachments = [];
let player = { x: -7, z: 9, r: START_RADIUS, vr: START_RADIUS, volume: START_RADIUS ** 3, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.identity(), face: [0, -1], boost: 1, boostLock: false, stun: 0 };
let boosting = false, lastBoost = false, lastSecond = -1, lastFxTone = -1;
let particles = [], floats = [];
const eye = [10, 9, 14], look = [0, 1, 0];

const audio = createAudio({ musicOn: () => state === 'playing' || state === 'title' });
audio.setMuted(!save.sound);

const goalCm = () => (mode === 'encore' ? ENCORE_GOAL_CM : GOAL_CM);
const startCm = () => (mode === 'encore' ? ENCORE_RADIUS : START_RADIUS) * 20;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 2D overlay (sparkles, names, hints)
const fx = $('fx'), fxctx = fx.getContext('2d');
let cw = 1, ch = 1, dpr = 1;
kit.onResize((w, h) => {
  cw = w;
  ch = h;
  dpr = Math.min(devicePixelRatio || 1, 1.65);
  fx.width = Math.round(w * dpr);
  fx.height = Math.round(h * dpr);
});

// ---------------------------------------------------------------- HUD writes only when a value changes
const hudCache = new Map(), els = {};
const el = (id) => els[id] || (els[id] = $(id));
function setText(id, v) { if (hudCache.get(id) !== v) { hudCache.set(id, v); el(id).textContent = v; } }
function setHTML(id, v) { const k = id + '#html'; if (hudCache.get(k) !== v) { hudCache.set(k, v); el(id).innerHTML = v; } }
function setStyle(id, prop, v) { const k = id + ':' + prop; if (hudCache.get(k) !== v) { hudCache.set(k, v); el(id).style[prop] = v; } }
function setClass(id, cls, on) { const k = id + '.' + cls; if (hudCache.get(k) !== on) { hudCache.set(k, on); el(id).classList.toggle(cls, on); } }
const WISH_IDS = ['wish0', 'wish1', 'wish2'];

function setupFlower() {
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, x = 72 + Math.cos(a) * 51, y = 72 + Math.sin(a) * 51;
    parts.push(`<circle cx="${x}" cy="${y}" r="17.5" fill="#eeb191"/>`);
  }
  parts.push('<circle cx="72" cy="72" r="57" fill="#e1eaa8"/><circle cx="72" cy="72" r="48.7" fill="#fff6db" stroke="#416b54" stroke-width="1.4"/><circle cx="72" cy="72" r="53" fill="none" stroke="#7ca484" stroke-width="2" stroke-dasharray="2 8"/>');
  $('sizeFlower').innerHTML = parts.join('');
}

function updateTitle() {
  const label = $('bestLabel');
  label.textContent = save.best > 0 ? `YOUR LITTLE BEST  ${save.best.toFixed(1)} CM` : 'A NEW LITTLE ADVENTURE';
  if (save.fastest > 0) {
    // Hidden by CSS where the footer is crowded (mid-width windows).
    const fast = document.createElement('span');
    fast.className = 'best-fast';
    fast.textContent = `  ·  FASTEST STAR ${fmtTime(save.fastest)}`;
    label.append(fast);
  }
  const eb = $('encoreBtn');
  eb.disabled = !save.won;
  eb.textContent = !save.won ? '✦ The Big Tidy · make one star to unlock'
    : save.encoreBest > 0 ? `✦ The Big Tidy · best ${save.encoreBest.toFixed(1)} cm` : '✦ The Big Tidy · encore';
  const found = ITEM_IDS.filter((id) => save.found[id]).length;
  $('foundNote').textContent = found ? `${found} / ${ITEM_IDS.length} LITTLE THINGS FOUND` : '';
}

function applyPrefs() {
  document.body.classList.toggle('reduced', reduced);
  $('motionBtn').classList.toggle('on', reduced);
  for (const b of document.querySelectorAll('.sound-toggle')) {
    b.classList.toggle('on', save.sound);
    const use = b.querySelector('use');
    if (use) use.setAttribute('href', save.sound ? '#sound' : '#mute');
    const word = b.querySelector('.sound-word');
    if (word) word.textContent = save.sound ? 'SOUND ON' : 'SOUND OFF';
    b.setAttribute('aria-label', save.sound ? 'Turn sound off' : 'Turn sound on');
  }
  updateTitle();
  audio.setMuted(!save.sound);
}

function setRoomLabel() {
  const encore = mode === 'encore';
  $('roomLabel').classList.toggle('encore', encore);
  $('roomSmall').textContent = encore ? '01 / ENCORE' : '01 / EARTH';
  $('roomName').innerHTML = encore ? 'The Big<br>Tidy' : 'The sunny-<br>side room';
}

// ---------------------------------------------------------------- prompts that follow the device
const PROMPTS = {
  keyboard: {
    hint: [['WASD', 'Roll'], ['SHIFT', 'Boost'], ['Q E', 'Look', 'look-hint'], ['SPACE', 'Turn', 'turn-hint'], ['ESC', 'Pause']],
    foot: [['W A S D', 'ROLL'], ['SHIFT', 'BOOST'], ['Q / E', 'LOOK']],
    table: [['WASD / ↑↓←→', 'Roll'], ['SHIFT', 'Hold to boost'], ['Q / E', 'Turn the camera'], ['SPACE', 'Look behind you'], ['DRAG', 'Look around'], ['ESC / P', 'Pause']],
    device: 'Mouse wheel: zoom. <b>M</b>: sound. <b>Enter</b>: send your star to the sky.',
    send: ' · ENTER',
    sendHow: 'Press Enter.',
  },
  gamepad: {
    hint: [['L', 'Roll'], ['A', 'Boost'], ['R', 'Look', 'look-hint'], ['Y', 'Turn', 'turn-hint'], ['START', 'Pause']],
    foot: [['L STICK', 'ROLL'], ['A', 'BOOST'], ['R STICK', 'LOOK']],
    table: [['LEFT STICK', 'Roll'], ['A / RT', 'Hold to boost'], ['RIGHT STICK', 'Look around'], ['Y', 'Look behind you'], ['LB / RB', 'Zoom'], ['START', 'Pause']],
    device: '<b>X</b>: send your star to the sky. The D-pad and <b>A</b> work every menu, <b>B</b> goes back.',
    send: ' · X',
    sendHow: 'Press X.',
  },
  touch: {
    hint: [['STICK', 'Roll'], ['BOOST', 'Boost'], ['DRAG', 'Look', 'look-hint'], ['↻', 'Turn', 'turn-hint'], ['II', 'Pause']],
    foot: [['STICK', 'ROLL'], ['BOOST', 'HOLD'], ['DRAG', 'LOOK']],
    table: [['LEFT THUMB', 'Roll with the stick'], ['BOOST', 'Hold to boost'], ['DRAG', 'Look around'], ['↻', 'Look behind you'], ['PINCH', 'Zoom'], ['II', 'Pause (top right)']],
    device: 'Tap <b>SKY</b> to send your star up when it is ready.',
    send: '',
    sendHow: 'Tap SKY.',
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prompt = () => PROMPTS[input.source] || PROMPTS.keyboard;
function updatePrompts() {
  const pr = prompt();
  document.body.classList.toggle('pad-nav', input.source === 'gamepad');
  setHTML('controlHint', pr.hint.map(([k, t, cls]) => `<span${cls ? ` class="${cls}"` : ''}><b class="key">${esc(k)}</b> ${esc(t)}</span>`).join(''));
  setHTML('footKeys', pr.foot.map(([k, t]) => `<span class="foot-key"><b class="key">${esc(k)}</b> ${esc(t)}</span>`).join(''));
  setHTML('keyTable', pr.table.map(([k, t]) => `<div><b class="key">${esc(k)}</b> ${esc(t)}</div>`).join(''));
  setHTML('helpDevice', pr.device);
  setText('sendKey', pr.send);
}

// ---------------------------------------------------------------- flow
function setState(s) { state = s; }

function preview() {
  setState('title');
  mode = 'mission';
  freeMode = false;
  audio.transpose = 0;
  $('hud').classList.remove('on');
  $('menu').classList.remove('gone');
  for (const s of document.querySelectorAll('.shade')) s.classList.remove('show');
  items = buildItems('title');
  attachments = [];
  previewAttachments = [];
  particles = [];
  floats = [];
  ascend = 0;
  goalMet = false;
  player = { ...player, x: 7.5, z: 7.2, r: 1.55, vr: 1.55, volume: 1.55 ** 3, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.euler(0.3, 0.4, 0.25), face: [-0.86, -0.51], boost: 1, stun: 0 };
  const types = ['orange', 'block0', 'pencil', 'cookie', 'mug', 'book', 'die', 'berry', 'duck', 'can', 'spool', 'block2', 'candy', 'sushi', 'button', 'eraser', 'car', 'cookie', 'block1'];
  for (let i = 0; i < types.length; i++) {
    const y = 1 - (i + 0.5) / types.length * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    previewAttachments.push({ p: P[types[i]], dir: [Math.cos(a) * r, y, Math.sin(a) * r], rot: Q.euler(between(-2, 2), between(-2, 2), between(-2, 2)), age: 2, scale: 0.93 });
  }
  eye[0] = 4.7; eye[1] = 10.6; eye[2] = 22.3;
  look[0] = 1.3; look[1] = 1.2; look[2] = -1.5;
  updateCamera(1);
  updateHUD();
  applyPrefs();
}

/** kind: 'mission' (3 minutes), 'free' (no timer) or 'encore' (The Big Tidy). */
function start(kind = 'mission') {
  if (typeof kind === 'boolean') kind = kind ? 'free' : 'mission'; // the original start(free) signature
  audio.init();
  mode = kind === 'encore' ? 'encore' : 'mission';
  freeMode = kind === 'free';
  setState('playing');
  const startR = mode === 'encore' ? ENCORE_RADIUS : START_RADIUS;
  remaining = mode === 'encore' ? ENCORE_SECONDS : MISSION_SECONDS;
  gameTime = 0; lastFxTone = -1; lastSecond = -1; goalMet = false; goalTime = 0; fastRecord = false;
  peakCm = startR * 20; wishes = new Set(); largest = null; categoryCounts = {};
  combo = 0; comboTimer = 0; pickupTimer = 0; toastTimer = 0; bumpCooldown = 0; blockedItem = null; blockedTimer = 0;
  nextStage = 0; trailTimer = 0; ascend = 0; shake = 0; boosting = false; lastBoost = false;
  particles = []; floats = []; attachments = []; previewAttachments = [];
  items = buildItems(mode);
  player = { x: -7, z: 9, r: startR, vr: startR, volume: startR ** 3, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.identity(), face: [0, -1], boost: 1, boostLock: false, stun: 0 };
  camYaw = camYawTarget = 0.025;
  camLift = camZoom = 1;
  // Start the camera where it settles behind a ball of this size (the original framing at 12 cm).
  const d0 = 5.25 + startR * 3.05, ah = 1.05 + startR * 0.35, s0 = Math.sin(camYaw), c0 = Math.cos(camYaw);
  eye[0] = player.x + s0 * d0; eye[1] = 3.5 + startR * 2; eye[2] = player.z + c0 * d0;
  look[0] = player.x - s0 * ah; look[1] = startR * 0.85; look[2] = player.z - c0 * ah;
  audio.transpose = mode === 'encore' ? 2 : 0;
  $('menu').classList.add('gone');
  $('hud').classList.add('on');
  for (const s of document.querySelectorAll('.shade')) s.classList.remove('show');
  setClass('pickup', 'show', false);
  $('sendStar').classList.remove('show');
  $('goalTitle').textContent = mode === 'encore' ? 'TIDY UP THE WHOLE ROOM' : 'MAKE A LITTLE STAR';
  $('goalText').textContent = `${goalCm()} cm`;
  $('goalFrom').textContent = mode === 'encore' ? 'Big things →' : 'Little things →';
  setStyle('obstacleHint', 'display', 'none');
  setRoomLabel();
  if (mode === 'encore') notify('The Big Tidy.', `Start at 30 cm. Roll up the furniture. Reach ${ENCORE_GOAL_CM} cm in ${fmtTime(ENCORE_SECONDS)}.`, 4.7);
  else notify(freeMode ? 'All the time in the world.' : 'Let’s make a little star.', freeMode ? 'No timer. Start with the candy trail.' : 'Reach 50 cm. Start with the candy trail.', 4.7);
  updateHUD();
  canvas.focus({ preventScroll: true });
  if (!reduced) canvas.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 550 });
  audio.effect('start');
  input.settle();
}

function notify(title, sub = '', duration = 3.2) {
  const t = el('toast');
  t.textContent = title;
  if (sub) {
    const small = document.createElement('small');
    small.textContent = sub;
    t.append(small);
  }
  setClass('toast', 'show', true);
  toastTimer = duration;
}

function collect(it) {
  if (it.collected || it.cooldown > 0) return;
  const inv = Q.inv(player.q), worldCenter = [player.x, player.floor + player.r, player.z];
  const local = Q.rot(inv, V.sub([it.x, it.y, it.z], worldCenter));
  let dir = V.norm(local);
  if (V.len(local) < 0.02) dir = [0, 0, 1];
  combo = comboTimer > 0 ? combo + 1 : 1;
  comboTimer = 2.8;
  const gain = it.volume * (1 + Math.min(combo, 12) * 0.01);
  it.collected = true;
  attachments.push({ item: it, p: it.p, dir, rot: Q.mul(inv, Q.euler(0, it.yaw, 0)), start: local, age: 0, gain, scale: 1 });
  player.volume += gain;
  player.r = Math.cbrt(player.volume);
  peakCm = Math.max(peakCm, player.r * 20);
  categoryCounts[it.p.group] = (categoryCounts[it.p.group] || 0) + 1;
  if (!largest || it.need > largest.need) largest = it;
  const special = it.wish !== undefined;
  const isNew = !save.found[it.p.id];
  if (isNew) { save.found[it.p.id] = 1; store(); }
  if (special) {
    wishes.add(it.wish);
    audio.effect('wish');
    input.rumble(0.35, 120);
    notify('A golden wish!', `${wishes.size} of 3 found. Little things are worth looking for.`, 3.2);
  } else {
    if (gameTime - lastFxTone > 0.06) { audio.pickup(combo); lastFxTone = gameTime; }
    if (it.big || it.need >= 34) { audio.effect('big'); input.rumble(0.3, 90); }
  }
  const col = it.p.group === 'snacks' ? '#efd16b' : it.p.group === 'toys' ? '#e8a5ba' : '#b8d59e';
  burst([it.x, it.y, it.z], col, special ? 24 : it.big ? 16 : 7, it.big ? 1.6 : 1);
  if (combo < 3 || combo % 4 === 0 || isNew) floatText(it.p.name, [it.x, it.y + 0.3, it.z], special ? '#e3ab54' : '#fff6dc');
  $('pickupImg').src = thumbFor(it.p);
  $('pickupName').textContent = it.p.name;
  $('pickupNote').textContent = it.p.note;
  $('pickupTag').textContent = isNew ? 'NEW LITTLE THING!' : 'ROLLED UP!';
  $('pickupTag').classList.toggle('new', isNew);
  setClass('pickup', 'show', true);
  pickupTimer = 4.2;
  if (!reduced) $('sizeBadge').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.055)' }, { transform: 'scale(1)' }], { duration: 250 });
  if (player.r * 20 >= goalCm() && !goalMet) meetGoal();
  else {
    const stages = STAGES[mode];
    if (nextStage < stages.length && player.r * 20 >= stages[nextStage].at) {
      const st = stages[nextStage++];
      if (!special) notify(st.main, st.sub, 3);
      audio.effect('grow');
    }
  }
}

function meetGoal() {
  goalMet = true;
  goalTime = gameTime;
  fastRecord = mode === 'mission' && (!save.fastest || gameTime < save.fastest);
  if (fastRecord) { save.fastest = gameTime; store(); }
  const encore = mode === 'encore';
  $('goalTitle').textContent = encore ? 'THE ROOM IS ROLLED UP' : 'YOUR LITTLE STAR IS READY';
  $('goalText').textContent = `${goalCm()} cm ✓`;
  $('goalFrom').textContent = 'Keep growing, or…';
  $('sendStar').classList.add('show');
  notify(encore ? 'That’s a big star!' : 'That’s a star!', `Keep rolling, or send it to the sky. ${prompt().sendHow}`, 5.2);
  burst(playerCenter(), '#f3d776', 45, 2);
  audio.effect('goal');
  input.rumble(0.6, 260);
}

function knockOff(amount = 1) {
  let lost = 0;
  const startR = mode === 'encore' ? ENCORE_RADIUS : START_RADIUS, onTable = player.floor > 3.3;
  for (let i = attachments.length - 1; i >= 0 && lost < amount; i--) {
    const a = attachments[i], it = a.item;
    if (it.wish !== undefined) continue;
    attachments.splice(i, 1);
    player.volume = Math.max(startR ** 3, player.volume - a.gain);
    it.collected = false;
    // Land somewhere it can be rolled up again: not inside the furniture, not out of reach.
    const mover = it.hazard || it.moving, rad = it.p.radius + (mover ? 1.3 : 0);
    const behind = Math.atan2(player.face[0], player.face[1]) + PI;
    let x = player.x, z = player.z;
    for (let t = 0; t < 12; t++) {
      const angle = behind + between(-0.9, 0.9) + (t > 5 ? between(-PI, PI) : 0), d = player.r + it.p.radius + 1.1 + t * 0.3;
      x = clamp(player.x + Math.sin(angle) * d, -16.3, 16.3);
      z = clamp(player.z + Math.cos(angle) * d, -14.3, 14.3);
      if (landingOK(x, z, rad, onTable, player.r)) break;
    }
    it.x = x;
    it.z = z;
    it.base = terrain(it.x, it.z, player.floor);
    it.y = it.base + it.p.height / 2 + 0.025;
    it.cooldown = 1.5;
    it.yaw = between(-PI, PI);
    if (mover) it.home = [it.x, it.z]; // the cat and the toy car carry on from where they land
    it.matrix = compose([it.x, it.y, it.z], Q.euler(0, it.yaw, 0), ONE, it.matrix);
    categoryCounts[it.p.group] = Math.max(0, (categoryCounts[it.p.group] || 0) - 1);
    lost++;
  }
  player.r = Math.cbrt(player.volume);
  combo = 0;
  comboTimer = 0;
  if (lost) {
    notify('A little bump.', `${lost === 1 ? 'One thing fell' : lost + ' things fell'} off. Roll back to get ${lost === 1 ? 'it' : 'them'}.`, 2.8);
    audio.effect('knock');
    input.rumble(0.7, 220);
  }
}

function impact(it, speed) {
  if (bumpCooldown > 0) return;
  bumpCooldown = 0.9;
  player.stun = 0.12;
  if (!reduced) shake = Math.min(0.13, speed * 0.012);
  audio.effect('bump');
  input.rumble(clamp(speed * 0.07, 0.15, 0.6), 90);
  if (it) {
    blockedItem = it;
    blockedTimer = 1.7;
    if (it.hazard && speed > 1.6) knockOff(3);
    else if (boosting && speed > 5.0) knockOff(1);
  } else if (boosting && speed > 5.7 && attachments.length > 3) knockOff(1);
}

function pushFromBox(o) {
  const r = player.r * 0.88;
  if (o.lo > 3 && player.floor > 2.85) return false;
  if (player.floor + player.r * 2 < o.lo + 0.03 || player.floor + 0.10 > o.hi) return false;
  const px = clamp(player.x, o.x - o.w / 2, o.x + o.w / 2), pz = clamp(player.z, o.z - o.d / 2, o.z + o.d / 2);
  const dx = player.x - px, dz = player.z - pz, dist = Math.hypot(dx, dz);
  let nx, nz;
  if (dist >= r) return false;
  if (dist < 0.0001) {
    const sides = [
      { v: player.x - (o.x - o.w / 2), nx: -1, nz: 0 }, { v: o.x + o.w / 2 - player.x, nx: 1, nz: 0 },
      { v: player.z - (o.z - o.d / 2), nx: 0, nz: -1 }, { v: o.z + o.d / 2 - player.z, nx: 0, nz: 1 },
    ].sort((a, b) => a.v - b.v);
    nx = sides[0].nx;
    nz = sides[0].nz;
    player.x += nx * (r + sides[0].v + 0.003);
    player.z += nz * (r + sides[0].v + 0.003);
  } else {
    nx = dx / dist;
    nz = dz / dist;
    player.x += nx * (r - dist + 0.003);
    player.z += nz * (r - dist + 0.003);
  }
  const dot = player.vx * nx + player.vz * nz;
  if (dot < 0) {
    player.vx -= nx * dot * 1.08;
    player.vz -= nz * dot * 1.08;
    if (-dot > 1.5) impact(null, -dot);
  }
  return true;
}

function updateGame(dt, mv, wantBoost) {
  gameTime += dt;
  if (!freeMode) remaining -= dt;
  bumpCooldown = Math.max(0, bumpCooldown - dt);
  blockedTimer -= dt;
  player.stun = Math.max(0, player.stun - dt);
  comboTimer -= dt; pickupTimer -= dt; toastTimer -= dt; trailTimer -= dt;
  if (toastTimer <= 0) setClass('toast', 'show', false);
  if (pickupTimer <= 0) setClass('pickup', 'show', false);

  const ix = mv.x, iz = mv.y, len = Math.hypot(ix, iz);
  if (!wantBoost || player.boost > 0.65) player.boostLock = false;
  boosting = wantBoost && !player.boostLock && len > 0.1 && player.boost > 0.025 && player.stun <= 0;
  if (boosting) {
    player.boost = Math.max(0, player.boost - dt * 0.40);
    if (player.boost === 0) player.boostLock = true;
  } else player.boost = Math.min(1, player.boost + dt * 0.18);

  const maxSpeed = (3.35 + player.r * 0.85) * (boosting ? 1.83 : 1), sn = Math.sin(camYaw), cs = Math.cos(camYaw);
  let vx = (ix * cs - iz * sn) * maxSpeed, vz = (-ix * sn - iz * cs) * maxSpeed;
  if (player.stun > 0) { vx = 0; vz = 0; }
  const k = 1 - Math.exp(-dt * (len > 0.1 ? 5.8 : 7.8));
  player.vx = lerp(player.vx, vx, k);
  player.vz = lerp(player.vz, vz, k);
  const oldX = player.x, oldZ = player.z, speed = Math.hypot(player.vx, player.vz);
  let nx = oldX + player.vx * dt, nz = oldZ + player.vz * dt, ground = terrain(nx, nz, player.floor);
  const step = 0.16 + player.r * 0.31;
  if (ground > player.floor + step && player.vy <= 0) {
    const gx = terrain(nx, oldZ, player.floor), gz = terrain(oldX, nz, player.floor);
    if (gx <= player.floor + step) nz = oldZ;
    else if (gz <= player.floor + step) nx = oldX;
    else { nx = oldX; nz = oldZ; }
    ground = terrain(nx, nz, player.floor);
  }
  player.x = clamp(nx, -17.55 + player.r * 0.82, 17.55 - player.r * 0.82);
  player.z = clamp(nz, -15.55 + player.r * 0.82, 15.55 - player.r * 0.82);
  if ((player.x !== nx || player.z !== nz) && speed > 3) impact(null, speed);
  if (ground >= player.floor - 0.12 && ground <= player.floor + step + 0.05) { player.floor = ground; player.vy = 0; }
  else {
    player.vy -= 12 * dt;
    player.floor += player.vy * dt;
    if (player.floor < ground) { player.floor = ground; player.vy = 0; }
  }
  for (const o of obstacles) pushFromBox(o);

  for (const it of items) {
    if (it.collected) continue;
    it.cooldown = Math.max(0, it.cooldown - dt);
    if (it.hazard) {
      const a = gameTime * 0.27 + it.phase, px = it.x, pz = it.z;
      it.x = it.home[0] + Math.sin(a) * 1.25;
      it.z = it.home[1] + Math.cos(a * 0.72) * 0.74;
      it.yaw = Math.atan2(it.x - px, it.z - pz);
      it.y = it.base + it.p.height / 2 + 0.045 + Math.abs(Math.sin(gameTime * 1.2)) * 0.035;
    } else if (it.moving) {
      const a = gameTime * 0.52 + it.phase, px = it.x, pz = it.z;
      it.x = it.home[0] + Math.sin(a) * 1.12;
      it.z = it.home[1] + Math.cos(a) * 0.62;
      it.yaw = Math.atan2(it.x - px, it.z - pz) + PI / 2;
    }
    if (it.wish !== undefined) {
      it.y = it.base + it.p.height / 2 + 0.20 + Math.sin(realTime * 2.5 + it.phase) * 0.06;
      it.yaw += dt * 0.35;
    }
    const dy = Math.abs(player.floor + player.r - it.y);
    if (dy > player.r + it.p.height * 0.49 + 0.10) continue;
    const dx = player.x - it.x, dz = player.z - it.z, d = Math.hypot(dx, dz), pick = player.r * 1.03 + it.p.radius * 0.66;
    if (d > pick + 0.15) continue;
    if (player.r * 20 + 0.015 >= it.need) {
      if (d < pick && it.cooldown <= 0) collect(it);
    } else {
      const contact = player.r * 0.89 + it.p.radius * 0.64;
      if (d < contact) {
        const ax = d > 0.001 ? dx / d : 1, az = d > 0.001 ? dz / d : 0;
        player.x += ax * (contact - d + 0.004);
        player.z += az * (contact - d + 0.004);
        const dot = player.vx * ax + player.vz * az;
        if (dot < 0) {
          player.vx -= ax * dot * 1.12;
          player.vz -= az * dot * 1.12;
          if (-dot > 0.85) impact(it, -dot);
        }
        blockedItem = it;
        blockedTimer = 1.0;
      }
    }
  }

  const dx = player.x - oldX, dz = player.z - oldZ, travel = Math.hypot(dx, dz);
  if (travel > 0.00001) {
    const axis = [dz / travel, 0, -dx / travel];
    player.q = Q.norm(Q.mul(Q.axis(axis, travel / Math.max(player.r, 0.4)), player.q));
    const flen = Math.hypot(player.vx, player.vz);
    if (flen > 0.15) {
      const t = 1 - Math.exp(-dt * 12), fx2 = lerp(player.face[0], player.vx / flen, t), fz2 = lerp(player.face[1], player.vz / flen, t), l = Math.hypot(fx2, fz2) || 1;
      player.face[0] = fx2 / l;
      player.face[1] = fz2 / l;
    }
    walkPhase += Math.min(travel, dt * 10) * 7.5;
  }
  player.vr = lerp(player.vr, player.r, 1 - Math.exp(-dt * 9));
  for (const a of attachments) a.age += dt;
  if (boosting && trailTimer <= 0) {
    trailTimer = 0.065;
    burst([player.x - player.face[0] * player.r, player.floor + 0.2, player.z - player.face[1] * player.r], '#efdbc1', reduced ? 1 : 3, 0.35);
  }
  peakCm = Math.max(peakCm, player.r * 20);
  if (!freeMode && remaining <= 0) { remaining = 0; finish(goalMet); }
}

function playerCenter(out = [0, 0, 0]) {
  out[0] = player.x; out[1] = player.floor + player.vr + ascend; out[2] = player.z;
  return out;
}
function rotateBall(angle) { player.q = Q.norm(Q.mul(Q.axis([0, 1, 0], angle), player.q)); }

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  if (state === 'title') {
    const a = Math.sin(realTime * 0.075);
    eye[0] = 4.7 + a * 0.55; eye[1] = 10.6 + Math.sin(realTime * 0.09) * 0.15; eye[2] = 22.3;
    look[0] = 1.3; look[1] = 1.2; look[2] = -1.5;
  } else {
    camYaw = lerp(camYaw, camYawTarget, reduced ? 1 : 1 - Math.exp(-dt * 8));
    const r = player.vr, d = (5.25 + r * 3.05) * camZoom, h = (3.5 + r * 2.0) * camLift, s = Math.sin(camYaw), c = Math.cos(camYaw), ahead = 1.05 + r * 0.35;
    const tx = player.x - s * ahead, ty = player.floor + r * 0.85 + ascend, tz = player.z - c * ahead;
    let wx = player.x + s * d, wy = player.floor + h + ascend * 0.8, wz = player.z + c * d;
    const clx = clamp(wx, -17.3, 17.3), clz = clamp(wz, -15.3, 22.5);
    wy += (Math.abs(clx - wx) + Math.abs(clz - wz)) * 0.43;
    wx = clx;
    wz = clz;
    // Shorten the camera line below the tea table, rather than looking through it.
    if (player.floor < 1.8 && inTable(player.x, player.z)) {
      const dy = wy - ty;
      if (dy > 0) {
        const t = (3.38 - ty) / dy;
        if (t > 0.12 && t < 1) {
          const kk = Math.max(0.22, t);
          wx = tx + (wx - tx) * kk; wy = ty + dy * kk; wz = tz + (wz - tz) * kk;
        }
      }
    }
    const f = reduced ? 1 : 1 - Math.exp(-dt * 8);
    eye[0] = lerp(eye[0], wx, f); eye[1] = lerp(eye[1], wy, f); eye[2] = lerp(eye[2], wz, f);
    look[0] = lerp(look[0], tx, f); look[1] = lerp(look[1], ty, f); look[2] = lerp(look[2], tz, f);
    if (shake > 0 && !reduced) {
      eye[0] += Math.sin(realTime * 63) * shake;
      eye[1] += Math.cos(realTime * 57) * shake * 0.5;
      shake = Math.max(0, shake - dt * 0.7);
    }
  }
  R.view(eye, look);
}
function turnAround() { camYawTarget += PI; audio.effect('start'); }
// Camera turn per unit the kit reports, so mouse drag, touch drag and the stick keep the original speeds.
const LOOK_GAIN = { keyboard: [2.5, 1.04], touch: [1.09, 0.45], gamepad: [0.65, 0.35] };
function applyLook(dt) {
  const lk = input.look('look'), g = LOOK_GAIN[input.source] || LOOK_GAIN.keyboard;
  camYawTarget -= lk.x * g[0];
  camLift = clamp(camLift + lk.y * g[1], 0.62, 1.75);
  const turn = input.value('turn');
  if (turn) camYawTarget += turn * dt * 1.7;
  const z = input.zoom();
  if (z) camZoom = clamp(camZoom - z * 0.1, 0.72, 1.47);
  const zp = input.value('zoomPad');
  if (zp) camZoom = clamp(camZoom - zp * dt * 0.9, 0.72, 1.47);
}

// ---------------------------------------------------------------- drawing the world (no allocations per thing)
const _ballM = new Float32Array(16), _avM = new Float32Array(16), _loc = new Float32Array(16), _out = new Float32Array(16);
const _pos = [0, 0, 0], _scl = [1, 1, 1], _ctr = [0, 0, 0], _quat = [0, 0, 0, 1];
function yawQuat(yaw, out) { out[0] = 0; out[1] = Math.sin(yaw / 2); out[2] = 0; out[3] = Math.cos(yaw / 2); return out; }
/** Column-major a × b into o (o must not be a or b). */
function mul4(a, b, o) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return o;
}
function avatarPart(puppet, x, y, z, rx, ry, rz) {
  _pos[0] = x; _pos[1] = y; _pos[2] = z;
  compose(_pos, Q.euler(rx, ry, rz), ONE, _loc);
  puppet.set(mul4(_avM, _loc, _out));
}

function drawWorld() {
  for (const b of batchList) b.begin();
  markers.begin();
  shadows.begin();
  for (const it of items) {
    if (it.collected) continue;
    if (it.hazard || it.moving || it.wish !== undefined) {
      _pos[0] = it.x; _pos[1] = it.y; _pos[2] = it.z;
      compose(_pos, yawQuat(it.yaw, _quat), ONE, it.matrix);
    }
    batchOf[it.p.id].push(it.matrix);
    if (it.wish !== undefined) {
      const pulse = 1 + Math.sin(realTime * 2 + it.phase) * 0.12;
      markers.pushFlat(it.x, it.base + 0.105, it.z, 0.7 * pulse, 0.7 * pulse);
    }
    const r = it.p.radius, ground = it.base ? it.base + 0.04 : rugHeight(it.x, it.z) + 0.02;
    (it.hazard ? shadows.firm : shadows.soft).pushFlat(it.x, ground, it.z, r * 1.1, r * 0.86);
  }

  // The ball, and everything stuck to it.
  playerCenter(_ctr);
  const vr = player.vr;
  _scl[0] = _scl[1] = _scl[2] = vr;
  ballPuppet.set(compose(_ctr, player.q, _scl, _out));
  compose(_ctr, player.q, ONE, _ballM);
  const list = state === 'title' ? previewAttachments : attachments, reach = vr * 0.94;
  for (const a of list) {
    let age = clamp(a.age / 0.18, 0, 1);
    age = 1 - (1 - age) ** 3;
    for (let i = 0; i < 3; i++) { const end = a.dir[i] * reach; _pos[i] = a.start ? lerp(a.start[i], end, age) : end; }
    const s = a.scale || 1;
    _scl[0] = _scl[1] = _scl[2] = s;
    compose(_pos, a.rot, _scl, _loc);
    batchOf[a.p.id].push(mul4(_ballM, _loc, _out));
  }
  const br = player.r;
  shadows.ball.pushFlat(player.x, player.floor + 0.09, player.z, br * 1.4, br * 1.19);
  const ss = 0.62 + player.r * 0.025;
  shadows.soft.pushFlat(player.x - player.face[0] * (br + 0.38), player.floor + 0.11, player.z - player.face[1] * (br + 0.38), ss * 0.62, ss * 0.48);

  // The little roller behind the ball.
  const distance = vr + 0.37, fx0 = player.face[0], fz0 = player.face[1], avScale = (state === 'title' ? 0.91 : 0.63) + vr * 0.027;
  _pos[0] = player.x - fx0 * distance; _pos[1] = player.floor + 0.03; _pos[2] = player.z - fz0 * distance;
  _scl[0] = _scl[1] = _scl[2] = avScale;
  compose(_pos, yawQuat(Math.atan2(fx0, fz0), _quat), _scl, _avM);
  const walking = state === 'playing' ? Math.min(1, Math.hypot(player.vx, player.vz)) : 0;
  const bob = walking ? Math.abs(Math.sin(walkPhase)) * 0.045 : Math.sin(realTime * 2.2) * 0.015;
  avatarPart(bodyPuppet, 0, bob, 0, walking * 0.07, 0, 0);
  avatarPart(headPuppet, 0, 0.94 + bob, 0, 0, Math.sin(realTime) * 0.025, 0);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1;
    avatarPart(armPuppets[i], sign * 0.275, 0.58 + bob, 0.045, -1.17 + Math.sin(walkPhase + sign) * 0.08 * walking, 0, -sign * 0.2);
    avatarPart(legPuppets[i], sign * 0.125, 0.295, 0.025, Math.sin(walkPhase + (sign < 0 ? 0 : PI)) * 0.62 * walking, 0, 0);
  }
  for (const b of batchList) b.end();
  markers.end();
  shadows.end();
}

// ---------------------------------------------------------------- sparkles and floating names
const _proj = { x: 0, y: 0, w: 0, visible: false };
function burst(pos, color, n = 8, power = 1) {
  if (reduced) n = Math.ceil(n / 3);
  n = Math.min(kit.detail(n), 240 - particles.length);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * TAU;
    particles.push({ p: pos.slice(), v: [Math.cos(angle) * (1 + Math.random() * 2) * power, (1.4 + Math.random() * 3) * power, Math.sin(angle) * (1 + Math.random() * 2) * power], life: 0.45 + Math.random() * 0.45, color, size: 2 + Math.random() * 3, star: i % 3 === 0 });
  }
}
function floatText(text, pos, color) {
  if (reduced || floats.length > 10) return;
  floats.push({ text, p: pos.slice(), life: 1.1, color });
}
function drawFX(dt) {
  fxctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxctx.clearRect(0, 0, cw, ch);
  const frozen = state === 'paused' || state === 'help';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (!frozen) {
      p.life -= dt;
      for (let j = 0; j < 3; j++) p.p[j] += p.v[j] * dt;
      p.v[1] -= 4 * dt;
    }
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const s = R.project(p.p[0], p.p[1], p.p[2], _proj);
    if (!s || !s.visible) continue;
    const r = clamp(50 / s.w, 1.2, 3) * p.size;
    fxctx.globalAlpha = Math.min(1, p.life * 2);
    fxctx.fillStyle = p.color;
    fxctx.save();
    fxctx.translate(s.x, s.y);
    fxctx.rotate(p.life * 2);
    fxctx.beginPath();
    if (p.star) {
      fxctx.moveTo(0, -r * 1.5); fxctx.lineTo(r * 0.36, -r * 0.3); fxctx.lineTo(r * 1.3, 0); fxctx.lineTo(r * 0.3, r * 0.3);
      fxctx.lineTo(0, r * 1.5); fxctx.lineTo(-r * 0.3, r * 0.3); fxctx.lineTo(-r * 1.3, 0); fxctx.lineTo(-r * 0.3, -r * 0.3);
    } else fxctx.rect(-r / 2, -r / 2, r, r);
    fxctx.fill();
    fxctx.restore();
  }
  if (floats.length) {
    fxctx.font = `900 ${cw < 750 ? 12 : 14}px Trebuchet MS,Arial`;
    fxctx.textAlign = 'center';
    fxctx.lineWidth = 3;
    fxctx.lineJoin = 'round';
    fxctx.strokeStyle = '#385a48';
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if (!frozen) { f.life -= dt; f.p[1] += dt * 0.7; }
    if (f.life <= 0) { floats.splice(i, 1); continue; }
    const p = R.project(f.p[0], f.p[1], f.p[2], _proj);
    if (!p || !p.visible) continue;
    fxctx.globalAlpha = clamp(f.life * 2, 0, 1);
    fxctx.strokeText(f.text, p.x, p.y);
    fxctx.fillStyle = f.color;
    fxctx.fillText(f.text, p.x, p.y);
  }
  if (state === 'playing' || state === 'title') {
    fxctx.strokeStyle = '#fff4c4';
    fxctx.lineWidth = 2;
    for (const it of items) {
      if (it.collected || it.wish === undefined) continue;
      const p = R.project(it.x, it.y + it.p.height * 0.55, it.z, _proj);
      if (!p || !p.visible) continue;
      const a = realTime * 2 + it.phase, s = 4 + Math.sin(a) * 2;
      fxctx.globalAlpha = 0.65 + Math.sin(a) * 0.25;
      fxctx.beginPath();
      fxctx.moveTo(p.x - s, p.y); fxctx.lineTo(p.x + s, p.y);
      fxctx.moveTo(p.x, p.y - s); fxctx.lineTo(p.x, p.y + s);
      fxctx.stroke();
    }
  }
  fxctx.globalAlpha = 1;
  let hint = false;
  if (state === 'playing' && blockedItem && blockedTimer > 0 && !blockedItem.collected) {
    const it = blockedItem, p = R.project(it.x, it.y + it.p.height * 0.6, it.z, _proj);
    if (p && p.visible) {
      hint = true;
      setStyle('obstacleHint', 'left', Math.round(p.x) + 'px');
      setStyle('obstacleHint', 'top', Math.round(p.y - 10) + 'px');
      setText('obstacleHint', `${it.need} cm to pick up`);
    }
  }
  setStyle('obstacleHint', 'display', hint ? 'block' : 'none');
}

// ---------------------------------------------------------------- HUD and the room map
function updateHUD() {
  const cm = player.r * 20;
  setText('sizeWhole', String(Math.floor(cm)));
  setText('sizeMM', Math.floor((cm - Math.floor(cm)) * 10 + 0.00001) + ' mm');
  const from = startCm(), to = goalCm();
  setStyle('progressFill', 'width', clamp((cm - from) / (to - from) * 100, 0, 100).toFixed(1) + '%');
  setStyle('boostFill', 'width', (player.boost * 100).toFixed(1) + '%');
  const t = Math.max(0, Math.ceil(remaining));
  setText('timeLeft', freeMode ? '∞' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  setClass('timerBox', 'urgent', !freeMode && remaining < 30);
  setText('itemCount', String(attachments.length));
  setText('wishCount', `${wishes.size} / 3`);
  for (let i = 0; i < 3; i++) setClass(WISH_IDS[i], 'found', wishes.has(i));
  setStyle('chain', 'opacity', combo >= 4 && comboTimer > 0 ? '1' : '0');
  setText('chain', (combo >= 12 ? 'A WHOLE LITTLE PARADE' : 'NICE LITTLE CHAIN') + ' ×' + combo);
}
const mapCtx = $('map').getContext('2d');
function drawMap() {
  const c = mapCtx, w = 250, h = 206;
  const mx = (x) => (x + 18) / 36 * w, mz = (z) => (z + 16) / 32 * h;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#dae0b9';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#becba6';
  c.lineWidth = 1;
  for (let x = -15; x < 16; x += 6) { c.beginPath(); c.moveTo(mx(x), 0); c.lineTo(mx(x), h); c.stroke(); }
  for (let z = -14; z < 15; z += 7) { c.beginPath(); c.moveTo(0, mz(z)); c.lineTo(w, mz(z)); c.stroke(); }
  const rect = (x, z, sw, sd, color) => { c.fillStyle = color; c.fillRect(mx(x - sw / 2), mz(z - sd / 2), sw / 36 * w, sd / 32 * h); };
  rect(-2.1, -3.4, 9, 8.6, '#dbb4a0'); rect(7, -6.9, 9.5, 6.8, '#bdad7d'); rect(7, 0.6, 3.4, 8.2, '#d3c189'); rect(12.6, -14, 8.2, 2.8, '#8ca891'); rect(-14.6, -12.7, 4.5, 2.05, '#a49c7b');
  const size = player.r * 20;
  for (const it of items) {
    if (it.collected || it.wish !== undefined) continue;
    c.fillStyle = it.need <= size ? '#6e9270' : '#b1b58f';
    c.beginPath();
    c.arc(mx(it.x), mz(it.z), it.big ? 3.4 : it.need > 35 ? 2.5 : 1.65, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#f4c268';
  c.strokeStyle = '#a28450';
  for (const it of items) {
    if (it.collected || it.wish === undefined) continue;
    const px = mx(it.x), pz = mz(it.z);
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 2.8 : 6; c[i ? 'lineTo' : 'moveTo'](px + Math.cos(a) * r, pz + Math.sin(a) * r); }
    c.closePath();
    c.fill();
    c.stroke();
  }
  const px = mx(player.x), pz = mz(player.z), a = camYaw;
  c.fillStyle = 'rgba(67,112,85,.15)';
  c.beginPath();
  c.moveTo(px, pz);
  c.lineTo(px - Math.sin(a - 0.5) * 29, pz - Math.cos(a - 0.5) * 29);
  c.lineTo(px - Math.sin(a + 0.5) * 29, pz - Math.cos(a + 0.5) * 29);
  c.closePath();
  c.fill();
  c.fillStyle = '#eb8a7c';
  c.strokeStyle = '#fff3cd';
  c.lineWidth = 2.4;
  c.beginPath();
  c.arc(px, pz, 5.4, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = '#3e664e';
  c.beginPath();
  c.arc(px - Math.sin(a) * 2, pz - Math.cos(a) * 2, 1.8, 0, TAU);
  c.fill();
}

// ---------------------------------------------------------------- endings
function commitRecord() {
  const encore = mode === 'encore';
  record = peakCm > (encore ? save.encoreBest : save.best) + 0.04;
  if (record) { if (encore) save.encoreBest = peakCm; else save.best = peakCm; }
  save.items = Math.max(save.items || 0, attachments.length);
  if (goalMet) { if (encore) save.encoreWon = true; else save.won = true; }
  store();
  applyPrefs();
}
function finish(success) {
  if (state !== 'playing') return;
  resultSuccess = !!success;
  setState('celebrate');
  celebrateTime = 0;
  ascend = 0;
  player.vx = player.vz = 0;
  boosting = false;
  $('hud').classList.remove('on');
  setClass('toast', 'show', false);
  setStyle('obstacleHint', 'display', 'none');
  commitRecord();
  if (resultSuccess) { burst(playerCenter(), '#f5d47a', 85, 2.2); audio.effect('win'); input.rumble(0.5, 420); }
  else audio.effect('end');
}
function showResults() {
  setState('result');
  const encore = mode === 'encore';
  const categories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]), cat = categories[0];
  const names = { snacks: 'The Snack Nebula', toys: 'The Toybox Star', home: 'The Cozy Constellation', bits: 'The Button Moon', wishes: 'The Little Wish' };
  $('resultTitle').textContent = resultSuccess ? (encore ? 'A big star is born.' : 'A star is born.') : 'Almost a star.';
  $('resultTag').textContent = resultSuccess ? 'SPECIAL DELIVERY TO THE SKY' : 'EVERY BIG THING STARTS SMALL';
  $('starName').textContent = resultSuccess
    ? (wishes.size === 3 ? 'The Three-Wish Wonder' : encore ? 'The Whole-Room Star' : names[cat] || 'The Little Everything')
    : 'The sky can wait for one more roll.';
  const best = encore ? save.encoreBest : save.best;
  let rec = record ? 'A BRAND-NEW LITTLE BEST' : `YOUR LITTLE BEST  ${best.toFixed(1)} CM`;
  if (fastRecord) rec += `  ·  FASTEST STAR ${fmtTime(save.fastest)}`;
  $('newRecord').textContent = rec;
  $('resultSize').textContent = peakCm.toFixed(1);
  $('resultItems').textContent = attachments.length;
  $('resultWishes').textContent = wishes.size + ' / 3';
  let copy = resultSuccess
    ? (wishes.size === 3 ? 'All three wishes found. This star has a little extra magic.'
      : `Biggest catch: ${largest ? largest.p.name.toLowerCase() : 'a little dream'}. ${encore ? 'The whole room, rolled into one.' : 'A whole world of little things. All yours.'}`)
    : `You reached ${peakCm.toFixed(1)} cm. Try again, or keep rolling with no timer.`;
  if (goalMet && goalTime > 0) copy += ` Star made in ${fmtTime(goalTime)}.`;
  $('resultCopy').textContent = copy;
  $('encoreResultBtn').hidden = !(save.won && !encore);
  $('results').classList.add('show');
  focusEl($('againBtn'));
}
function continueRoll() {
  if (state !== 'result') return;
  setState('playing');
  freeMode = true;
  ascend = 0;
  $('results').classList.remove('show');
  $('hud').classList.add('on');
  notify('There’s always a little more.', 'No timer. Keep growing. Find all 3 golden wishes.', 4);
  updateHUD();
  audio.init();
  canvas.focus({ preventScroll: true });
  input.settle();
}
function pause() {
  if (state !== 'playing') return;
  setState('paused');
  boosting = false;
  $('pauseScreen').classList.add('show');
  focusEl($('resumeBtn'));
}
function resume() {
  if (state !== 'paused') return;
  setState('playing');
  $('pauseScreen').classList.remove('show');
  audio.init();
  canvas.focus({ preventScroll: true });
  input.settle();
}
function openHelp() {
  if (state === 'celebrate' || state === 'help' || state === 'result') return;
  lastState = state;
  setState('help');
  $('pauseScreen').classList.remove('show');
  $('helpScreen').classList.add('show');
  focusEl($('helpDone'));
}
function closeHelp() {
  if (state !== 'help') return;
  $('helpScreen').classList.remove('show');
  setState(lastState);
  if (state === 'paused') { $('pauseScreen').classList.add('show'); focusEl($('resumeBtn')); }
  else if (state === 'title') focusEl($('startBtn'));
  else canvas.focus({ preventScroll: true });
  input.settle();
}
function home() {
  if ((state === 'playing' || state === 'paused') && attachments.length) commitRecord();
  preview();
  focusEl($('startBtn'));
  input.settle();
}
function toggleSound() {
  save.sound = !save.sound;
  audio.init();
  store();
  applyPrefs();
}

// ---------------------------------------------------------------- menus: keyboard, gamepad and touch
const MENU_ROOTS = { title: 'menu', paused: 'pauseScreen', help: 'helpScreen', result: 'results' };
let navPrev = 0;
function clearPadFocus(except) { for (const b of document.querySelectorAll('.pad-focus')) if (b !== except) b.classList.remove('pad-focus'); }
function focusEl(b) {
  if (!b) return;
  clearPadFocus(b);
  try { b.focus({ preventScroll: true, focusVisible: true }); } catch { b.focus(); }
  // Chrome hides the ring after a programmatic focus once the mouse was used; a pad always needs it.
  b.classList.toggle('pad-focus', input.source === 'gamepad');
}
function menuButtons(root) { return [...root.querySelectorAll('button')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
function menuNavigate(root) {
  const v = input.vector('move'), horizontal = Math.abs(v.x) > Math.abs(v.y);
  const dir = horizontal ? (v.x > 0.5 ? 1 : v.x < -0.5 ? -1 : 0) : (v.y < -0.5 ? 1 : v.y > 0.5 ? -1 : 0);
  if (dir && dir !== navPrev) {
    const list = menuButtons(root);
    if (list.length) {
      let i = list.indexOf(document.activeElement);
      if (i < 0) {
        // Nothing focused yet: land on the screen's main button first.
        const main = list.findIndex((b) => b.classList.contains('primary'));
        i = main >= 0 ? main : dir > 0 ? 0 : list.length - 1;
      } else i = (i + dir + list.length) % list.length;
      focusEl(list[i]);
    }
  }
  navPrev = dir;
}
function menuConfirm(root, fallback) {
  const a = document.activeElement;
  if (a && a.tagName === 'BUTTON' && root.contains(a) && !a.disabled && a.offsetParent !== null) a.click();
  else fallback();
}
function handleInput(dt) {
  if (input.pressed('mute')) toggleSound();
  if (state === 'playing') {
    if (input.pressed('pause')) { pause(); return; }
    if (input.pressed('send') && goalMet) { finish(true); return; }
    applyLook(dt);
    if (input.pressed('turnBack')) turnAround();
    return;
  }
  const rootId = MENU_ROOTS[state];
  if (!rootId) return;
  const root = $(rootId);
  menuNavigate(root);
  const ok = input.pressed('confirm'), back = input.pressed('back') || input.pressed('pause');
  if (state === 'title') {
    if (ok || (input.pressed('pause') && input.source === 'gamepad')) menuConfirm(root, () => start('mission'));
  } else if (state === 'paused') {
    if (ok) menuConfirm(root, resume);
    else if (back) resume();
  } else if (state === 'help') {
    if (ok) menuConfirm(root, closeHelp);
    else if (back) closeHelp();
  } else if (state === 'result') {
    if (ok) menuConfirm(root, () => start(mode === 'encore' ? 'encore' : 'mission'));
    else if (input.pressed('back')) home();
  }
}
let touchSeen = '', sendShown = false;
function syncTouch() {
  if (!kit.touch) return;
  if (touchSeen !== state) { touchSeen = state; kit.touch.suspend(state !== 'playing', 'game'); }
  // The HUD's send button sits under the stick zone on phones: a SKY button by the thumb instead.
  const want = state === 'playing' && goalMet;
  if (want !== sendShown) { sendShown = want; kit.touch.setShown('send', want); }
}

// ---------------------------------------------------------------- buttons and window events
for (const b of document.querySelectorAll('.sound-toggle')) b.addEventListener('click', toggleSound);
for (const b of document.querySelectorAll('.quality-toggle')) b.addEventListener('click', () => kit.menu.open());
$('startBtn').onclick = () => start('mission');
$('freeBtn').onclick = () => start('free');
$('encoreBtn').onclick = () => { if (save.won) start('encore'); };
$('encoreResultBtn').onclick = () => start('encore');
$('helpMenu').onclick = openHelp;
$('helpGame').onclick = openHelp;
$('pauseHelp').onclick = openHelp;
$('closeHelp').onclick = closeHelp;
$('helpDone').onclick = closeHelp;
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = () => start(mode === 'encore' ? 'encore' : freeMode ? 'free' : 'mission');
$('quitBtn').onclick = home;
$('againBtn').onclick = () => start(mode === 'encore' ? 'encore' : 'mission');
$('continueBtn').onclick = continueRoll;
$('resultHome').onclick = home;
$('sendStar').onclick = () => { if (state === 'playing' && goalMet) finish(true); };
$('motionBtn').onclick = () => { reduced = !reduced; save.reduced = reduced; store(); applyPrefs(); };

// Keep Tab inside an open dialog.
addEventListener('keydown', (e) => {
  if (e.code !== 'Tab') return;
  const dialog = document.querySelector('.shade.show');
  if (!dialog) return;
  const buttons = menuButtons(dialog), first = buttons[0], last = buttons[buttons.length - 1];
  if (!first) return;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
addEventListener('pointerdown', () => clearPadFocus(null), true);
addEventListener('focusin', (e) => clearPadFocus(e.target));
// Sound starts on the first tap or key (browsers keep audio locked until then).
const unlockAudio = () => { if (save.sound) audio.init(); };
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
addEventListener('blur', () => { if (state === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
kit.onPause((p) => audio.hold(p));
input.onSourceChange(() => { updatePrompts(); if (input.source !== 'gamepad') clearPadFocus(null); });

// ---------------------------------------------------------------- the loop
let mapClock = 0;
function frame(dt) {
  realTime += dt;
  handleInput(dt);
  if (state === 'playing') {
    const mv = input.vector('move'), wantBoost = input.down('boost');
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < steps && state === 'playing'; i++) updateGame(dt / steps, mv, wantBoost);
    if (boosting && !lastBoost) audio.effect('boost');
    lastBoost = boosting;
  } else if (state === 'title') rotateBall(dt * 0.14);
  else if (state === 'celebrate') {
    celebrateTime += dt;
    ascend = resultSuccess ? Math.min(2.5, celebrateTime * 1.25) : 0;
    rotateBall(dt * 0.65);
    if (celebrateTime > 1.7) showResults();
  } else if (state === 'result') rotateBall(dt * 0.18);
  updateCamera(dt);
  drawWorld();
  R.render();
  drawFX(dt);
  if (state === 'playing') {
    updateHUD();
    mapClock -= dt;
    if (mapClock <= 0 && !document.documentElement.classList.contains('kit-touch-on')) { mapClock = 0.2; drawMap(); }
  }
  const sec = Math.ceil(remaining);
  if (state === 'playing' && !freeMode && sec <= 10 && sec > 0 && sec !== lastSecond) audio.effect('tick');
  lastSecond = sec;
  syncTouch();
}

// Test hooks are off in the normal game. They are available only with #test.
if (location.hash === '#test') {
  window.ParadeTest = {
    snapshot: () => ({
      state, mode, cm: player.r * 20, peak: peakCm, x: player.x, z: player.z, floor: player.floor, remaining, free: freeMode, goal: goalMet,
      held: attachments.length, total: items.length, wishes: [...wishes], boost: player.boost, audioState: audio.ctx?.state, eye: eye.slice(), look: look.slice(),
      items: items.filter((it) => !it.collected).map((it) => ({ id: it.p.id, x: it.x, z: it.z, y: it.y, base: it.base, need: it.need, wish: it.wish })),
    }),
    start,
    teleport: (x, z, y = 0) => { player.x = x; player.z = z; player.floor = y; player.vx = player.vz = player.vy = 0; },
    size: (cm) => { player.r = player.vr = cm / 20; player.volume = player.r ** 3; peakCm = Math.max(peakCm, cm); if (cm >= goalCm() && !goalMet) meetGoal(); },
    time: (t) => { remaining = t; },
    finish: () => finish(goalMet),
    collectAvailable: () => { const it = items.find((x) => !x.collected && x.need <= player.r * 20); if (it) { collect(it); return it.p.id; } return null; },
    camera: (yaw, lift = 1, zoom = 1) => { camYaw = camYawTarget = yaw; camLift = lift; camZoom = zoom; },
    unlockEncore: () => { save.won = true; store(); applyPrefs(); },
    knock: (n = 1) => knockOff(n),
    pause, resume, home,
  };
}

setupFlower();
updatePrompts();
kit.touch?.setShown('send', false);
preview();
kit.start(frame);
