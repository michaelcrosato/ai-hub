// Buttonwood Park: ride the old family coaster around a model park, lean at
// the switches, stamp all eight memory routes and punch the conductor's
// tickets, by summer afternoon or by lantern light.

import * as THREE from 'three/webgpu';
import { pass, renderOutput, mix, vec4, float, exp, uniform } from 'three/tsl';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { boot } from 'kit/boot.js';
import {
  MODES,
  MODE_KEYS,
  CAMERAS,
  CAMERA_KEYS,
  JUNCTIONS,
  ROUTES,
  MEMORIES,
  TICKETS,
  TICKET_IDS,
  HOURS,
  routeBranches,
  clamp,
  newFrame,
  trackFrame,
  comfortSpeed,
  lateralG,
  routeIndex,
  formatTime,
} from './track.js';
import { buildWorld } from './world.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- progress

const SAVE_KEY = 'buttonwood-park-save-v2';
const prefs = {
  mode: 'assisted',
  camera: 'chase',
  sound: true,
  reducedMotion: false,
  discovered: 0,
  bestLaps: {},
  hour: 'afternoon',
  bestRide: 0,
};
const punched = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (saved && saved.version === 2) {
    if (typeof saved.mode === 'string' && saved.mode in MODES) prefs.mode = saved.mode;
    if (typeof saved.camera === 'string' && saved.camera in CAMERAS) prefs.camera = saved.camera;
    if (typeof saved.sound === 'boolean') prefs.sound = saved.sound;
    if (typeof saved.reducedMotion === 'boolean') prefs.reducedMotion = saved.reducedMotion;
    if (Number.isInteger(saved.discoveredRoutesMask)) prefs.discovered = clamp(saved.discoveredRoutesMask, 0, 255);
    if (saved.bestLaps && typeof saved.bestLaps === 'object') {
      for (const [key, value] of Object.entries(saved.bestLaps)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) prefs.bestLaps[key] = value;
      }
    }
    if (typeof saved.hour === 'string' && saved.hour in HOURS) prefs.hour = saved.hour;
    if (typeof saved.bestRide === 'number' && Number.isFinite(saved.bestRide)) prefs.bestRide = Math.max(0, saved.bestRide);
    if (Array.isArray(saved.tickets)) for (const id of saved.tickets) if (TICKET_IDS.includes(id)) punched.add(id);
  }
} catch {
  /* no storage here: progress lasts for this visit */
}
// A save from before the ticket book that already holds every route gets that ticket quietly.
if (prefs.discovered === 255) punched.add('allroutes');

const save = () => {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 2,
        mode: prefs.mode,
        camera: prefs.camera,
        sound: prefs.sound,
        reducedMotion: prefs.reducedMotion,
        discoveredRoutesMask: prefs.discovered,
        bestLaps: prefs.bestLaps,
        hour: prefs.hour,
        bestRide: Math.round(prefs.bestRide),
        tickets: [...punched],
      })
    );
  } catch {
    /* storage full or blocked */
  }
};

// ---------------------------------------------------------------- boot

const kit = await boot({
  title: 'Buttonwood Park',
  mount: $('scene'),
  gear: 'none', // the park's own pause and help cards open the settings
  background: '#1f3029',
  accent: '#d5a749',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    boost: { gamepad: ['RT', 'A'], touch: 'Boost' },
    brake: { keys: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'], mouse: [2], gamepad: ['LT', 'B'], touch: 'Brake' },
    camera: { keys: ['KeyC'], gamepad: ['Y', 'RS'] },
    recover: { keys: ['KeyR'], gamepad: ['X'] },
    mode: { keys: ['KeyM'], gamepad: ['Back'] },
    hour: { keys: ['KeyN'] },
    book: { keys: ['KeyB'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
  },
});
const { input, renderer } = kit;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.canvas.setAttribute('aria-label', 'Animated miniature roller-coaster park');
kit.canvas.setAttribute('role', 'img');

const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(54, 1, 0.1, 260));
const world = buildWorld(scene);
// 2048 at high; medium (phones) gets the original 1024.
kit.shadow(world.sun, 2048);
const FIREFLIES = 140;
world.setFireflyCount(kit.detail(FIREFLIES));
kit.onQuality(() => world.setFireflyCount(kit.detail(FIREFLIES)));

// The park's haze. The original drew its exp² fog after tone mapping, in display
// colour; node materials fog before it, which washes the far park out. So the fog
// goes on here instead, from the depth buffer, over the tone-mapped picture. Its
// colour is a uniform so the lantern evening can darken it.
const FOG_DENSITY = 0.0085;
const fogColor = uniform(world.fogColor.clone());
scene.fog = null;
const post = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
const depth = scenePass.getViewZNode().mul(FOG_DENSITY);
const haze = float(1).sub(exp(depth.mul(depth).negate()));
const buildPost = (tier) => {
  const shown = vec4(mix(renderOutput(scenePass.getTextureNode('output')).rgb, fogColor, haze), 1);
  // FXAA where the tier has no MSAA (medium); none on low, like the kit's own chain.
  post.outputColorTransform = false;
  post.outputNode = !tier.msaa && tier.name !== 'low' ? fxaa(shown) : shown;
  post.needsUpdate = true;
};
buildPost(kit.tier);
kit.onQuality(buildPost);

// Afternoon (0) to lantern evening (1); eases between them when the hour changes mid-ride.
let dusk = prefs.hour === 'evening' ? 1 : 0;
const applyDusk = () => {
  world.setHour(dusk);
  fogColor.value.copy(world.fogColor);
};
applyDusk();

// The first two frames draw the whole park from above, switch glows and fireflies
// included, behind the loading card, so no pipeline compiles mid-ride.
for (const pair of world.glows) for (const g of pair) g.mesh.visible = true;
world.fireflies.visible = true;
camera.position.set(0, 58, 72);
camera.lookAt(0, 4.8, 0);

// ---------------------------------------------------------------- the ride

const ride = {
  started: false,
  paused: false,
  progress: 0.006,
  speed: 7.2,
  risk: 0,
  lap: 1,
  lapTime: 0, // riding seconds this loop (menus and pauses do not count)
  score: 0,
  choices: [0, 0, 0],
  junction: null,
  recoverAsked: false,
  recovering: 0,
  cooldown: 0,
  shake: 0,
  boost: false,
  brake: false,
  lean: 0, // -1..1, + leans left
  onChain: false,
  // This loop, for best times and tickets
  lapMode: 'assisted',
  modeMixed: false,
  lapRecoveries: 0,
  lapFrontSeat: false,
  lapAllEvening: false,
  routesThisRide: new Set(),
};

/** A fresh loop: remember how it starts so the finish can be judged fairly. */
function beginLap() {
  ride.lapMode = prefs.mode;
  ride.modeMixed = false;
  ride.lapRecoveries = 0;
  ride.lapFrontSeat = prefs.camera === 'ride';
  ride.lapAllEvening = prefs.hour === 'evening';
}

/** The switch coming up, if the train is close enough to choose. */
function junctionAhead() {
  for (let i = 0; i < JUNCTIONS.length; i += 1) {
    const d = (JUNCTIONS[i].center - JUNCTIONS[i].width / 2 - ride.progress + 1) % 1;
    if (d > 0.006 && d < 0.105) return i;
  }
  return null;
}

function chooseBranch(dir) {
  if (ride.junction === null) return;
  const pick = dir > 0 ? 1 : 0;
  if (ride.choices[ride.junction] !== pick) {
    ride.choices = [...ride.choices];
    ride.choices[ride.junction] = pick;
  }
  ride.shake = Math.max(ride.shake, 0.08);
  chime(dir > 0 ? 660 : 560);
  input.rumble(0.25, 60);
}

const simFrame = newFrame();

/** One 1/120 s physics step along the rails. */
function simStep(h) {
  const mode = MODES[prefs.mode];
  const f = trackFrame(ride.progress, ride.choices, ride.lean, simFrame);
  const comfort = comfortSpeed(f);
  const gravity = -9.81 * f.tangent.y;
  const rolling = 0.33;
  const air = mode.drag * ride.speed * ride.speed;
  const chainLift = ride.progress > 0.018 && ride.progress < 0.165 && ride.speed < 8.4 ? 4.8 : 0;
  ride.onChain = chainLift > 0;
  const toyMotor = prefs.mode === 'unhinged' ? 1.1 : 0;
  const push = ride.boost ? mode.boost : 0;
  let brake = ride.brake ? 1 : 0;
  if (prefs.mode === 'assisted') brake = Math.max(brake, clamp((ride.speed - comfort * 0.91) / 3.2, 0, 1));
  else if (prefs.mode === 'coached' && ride.speed > comfort * 1.1) brake = Math.max(brake, clamp((ride.speed - comfort * 1.08) / 3.8, 0, 0.75));
  const braking = brake * (5.6 + ride.speed * 0.16);
  ride.speed = clamp(ride.speed + (gravity + chainLift + toyMotor + push - rolling - air - braking) * h, 3.2, mode.maxSpeed);

  const bendLean = Math.atan((ride.speed * ride.speed * f.signedCurvature) / 9.81);
  const g = lateralG(f, ride.speed);
  const over = Math.max(0, ride.speed / comfort - 1);
  const leaningIn = Math.abs(ride.lean) > 0.1 && Math.sign(ride.lean) === Math.sign(bendLean) ? 0.14 : 0;
  const risk = clamp(over * 2.25 + Math.max(0, g - 1.25) * 0.38 - leaningIn, 0, 1.45);
  ride.risk += (risk - ride.risk) * (1 - Math.exp(-h * 4.5));
  ride.cooldown = Math.max(0, ride.cooldown - h);
  if (ride.recoverAsked || (ride.risk > 1.05 && ride.cooldown <= 0 && prefs.mode !== 'assisted')) {
    ride.recoverAsked = false;
    ride.recovering = 0.9;
    ride.cooldown = 2;
    ride.speed = Math.min(ride.speed, comfort * 0.76);
    ride.risk = 0;
    ride.score = Math.max(0, ride.score - 250);
    ride.shake = prefs.reducedMotion ? 0 : 0.8;
    ride.lapRecoveries += 1;
    input.rumble(0.6, 220);
  }
  if (ride.recovering > 0) ride.recovering = Math.max(0, ride.recovering - h);
  if (prefs.camera !== 'ride') ride.lapFrontSeat = false;
  if (prefs.hour !== 'evening') ride.lapAllEvening = false;

  ride.progress += (ride.speed / f.metersPerProgress) * h;
  ride.lapTime += h;
  if (ride.progress >= 1) {
    ride.progress -= 1;
    finishLap(mode);
  }
  ride.score += ride.speed * h * mode.score * (1 + Math.max(0, 0.2 - Math.abs(ride.speed - comfort) / comfort));
  if (ride.score >= 20000) punch('keeper');
  ride.junction = junctionAhead();
}

/** The train rolls past the station: stamp the route, time the loop, punch tickets. */
function finishLap(mode) {
  const route = routeIndex(ride.choices);
  const seconds = ride.lapTime;
  const earned = Math.round((1700 + Math.max(0, 42 - seconds) * 45) * mode.score);
  ride.score += earned;
  ride.lap += 1;
  ride.lapTime = 0;
  const firstTime = !(prefs.discovered & (1 << route));
  ride.routesThisRide.add(route);
  let best = '';
  // A loop that changed mode half-way is not timed against either mode.
  if (!ride.modeMixed) {
    const key = `${ride.lapMode}-${route}`;
    const previous = prefs.bestLaps[key];
    if (!(previous <= seconds)) {
      prefs.bestLaps = { ...prefs.bestLaps, [key]: seconds };
      if (previous) best = ' · new best!';
    }
  }
  prefs.bestRide = Math.max(prefs.bestRide, ride.score);
  setDiscovered(prefs.discovered | (1 << route)); // saves
  showToast(`${ROUTES[route]} stamped · ${formatTime(seconds)}${best} · +${earned.toLocaleString()} keepsakes`);
  if (firstTime) showToast(`New memory: “${MEMORIES[route]}”`, 5200);
  lapChime();
  input.rumble(0.3, 120);

  const wild = ride.lapMode !== 'assisted' && !ride.modeMixed;
  const clean = wild && ride.lapRecoveries === 0;
  punch('first');
  if (clean) punch('steady');
  if (clean && seconds < 22) punch('clockwork');
  if (ride.lapMode === 'unhinged' && !ride.modeMixed) punch('unhinged');
  if (ride.lapFrontSeat) punch('front');
  if (ride.lapAllEvening) punch('lantern');
  if (ride.lapAllEvening && route === 6) punch('moonlit');
  if (ride.routesThisRide.size >= 4) punch('tour');
  if (prefs.discovered === 255) punch('allroutes');
  beginLap();
}

// ---------------------------------------------------------------- sound

let audio = null;
let master = null;
let hum = null;
let humGain = null;
let humLevel = -1;
let humPitch = -1;
let noise = null;
let kitPaused = false;

/** One struck or sung note: a quick attack, an exponential fall and a slight droop in pitch. */
function tone(freq, { t0 = 0, type = 'sine', attack = 0.015, decay = 0.62, gain = 0.08, bend = 0.72 } = {}) {
  if (!audio || !prefs.sound) return;
  const t = audio.currentTime + t0;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + decay * 0.68);
  amp.gain.setValueAtTime(1e-4, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(1e-4, t + decay);
  osc.connect(amp).connect(master);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

const chime = (freq = 720) => tone(freq);

/** The station bell: a bright strike with an inharmonic ring above it. */
function bell(t0 = 0) {
  tone(1180, { t0, attack: 0.004, decay: 1.4, gain: 0.07, bend: 0.995 });
  tone(1180 * 2.76, { t0, attack: 0.003, decay: 0.55, gain: 0.022, bend: 1 });
  tone(590, { t0, attack: 0.006, decay: 1.1, gain: 0.03, bend: 1 });
}

const lapChime = () => {
  tone(784, { decay: 0.5, gain: 0.06 });
  tone(988, { t0: 0.11, decay: 0.5, gain: 0.06 });
  tone(1175, { t0: 0.22, decay: 0.75, gain: 0.07 });
};

/** A short filtered tick of noise: the chain dogs, a ticket punch. */
function tick(freq = 1900, gain = 0.09, length = 0.05) {
  if (!audio || !prefs.sound || !noise) return;
  const t = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 3;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(1e-4, t + length);
  src.connect(band).connect(amp).connect(master);
  src.start(t);
  src.stop(t + length + 0.02);
}

const punchSound = () => {
  tick(900, 0.14, 0.07);
  tone(1320, { t0: 0.05, decay: 0.45, gain: 0.05 });
};

/** Crickets in the lantern evening. */
function chirp() {
  const f = 4300 + Math.random() * 500;
  for (let k = 0; k < 3; k += 1) tone(f, { t0: k * 0.07, attack: 0.008, decay: 0.05, gain: 0.012, bend: 1 });
}

function startAudio() {
  if (audio) {
    if (!kitPaused) audio.resume();
    return;
  }
  try {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = prefs.sound ? 1 : 0;
    master.connect(audio.destination);
    hum = audio.createOscillator();
    humGain = audio.createGain();
    const low = audio.createBiquadFilter();
    hum.type = 'triangle';
    hum.frequency.value = 52;
    humGain.gain.value = 0;
    low.type = 'lowpass';
    low.frequency.value = 420;
    hum.connect(low).connect(humGain).connect(master);
    hum.start();
    noise = audio.createBuffer(1, Math.round(audio.sampleRate * 0.08), audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  } catch {
    audio = null;
  }
}

/** The wheel hum follows the speed, and goes quiet in menus, on mute and when paused. */
function syncHum(running) {
  if (!humGain) return;
  const level = running && prefs.sound ? 0.009 + ride.speed * 55e-5 : 0;
  const pitch = 42 + ride.speed * 3.6;
  if (Math.abs(level - humLevel) > 1e-4) {
    humGain.gain.setTargetAtTime(level, audio.currentTime, 0.08);
    humLevel = level;
  }
  if (Math.abs(pitch - humPitch) > 0.25) {
    hum.frequency.setTargetAtTime(pitch, audio.currentTime, 0.08);
    humPitch = pitch;
  }
}

const wake = () => {
  if (audio && audio.state === 'suspended' && !kitPaused && !document.hidden) audio.resume();
};
addEventListener('pointerdown', wake, true);
addEventListener('keydown', wake, true);
document.addEventListener('visibilitychange', () => {
  // Leaving the tab mid-ride pauses the ride, so nothing happens unseen.
  if (document.hidden && ride.started && !activeLayer()) setPaused(true);
  if (!audio) return;
  if (document.hidden) audio.suspend();
  else wake();
});
kit.onPause((p) => {
  kitPaused = p;
  if (!audio) return;
  if (p) audio.suspend();
  else wake();
});

// ---------------------------------------------------------------- page UI

const ui = {
  shell: $('shell'),
  intro: $('intro'),
  introModes: $('intro-modes'),
  introHour: $('intro-hour'),
  introHourLabel: $('intro-hour-label'),
  introBook: $('intro-book'),
  introBookCount: $('intro-book-count'),
  ride: $('ride'),
  rideHint: $('ride-hint'),
  hud: $('hud'),
  lap: $('lap'),
  modeButton: $('mode-button'),
  cameraButton: $('camera-button'),
  hourButton: $('hour-button'),
  soundButton: $('sound-button'),
  routeBook: $('route-book'),
  stamps: $('stamps'),
  routeCount: $('route-count'),
  coach: $('coach'),
  junction: $('junction'),
  junctionTitle: $('junction-title'),
  branchLeft: $('branch-left'),
  branchRight: $('branch-right'),
  dial: $('dial'),
  speed: $('speed'),
  comfort: $('comfort'),
  lateral: $('lateral'),
  score: $('score'),
  toast: $('toast'),
  recovery: $('recovery'),
  pause: $('pause-modal'),
  pauseHour: $('pause-hour'),
  modeModal: $('mode-modal'),
  modeList: $('mode-list'),
  help: $('help-modal'),
  book: $('book-modal'),
  bookScroll: $('book-scroll'),
  bookSummary: $('book-summary'),
  memoryList: $('memory-list'),
  ticketList: $('ticket-list'),
  toggleMotion: $('toggle-motion'),
  toggleSound: $('toggle-sound'),
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const chips = MODE_KEYS.map((key) => {
  const b = el('button', 'mode-chip');
  b.type = 'button';
  b.dataset.mode = key;
  b.append(el('strong', null, MODES[key].label), el('span', null, MODES[key].short));
  b.addEventListener('click', () => setMode(key));
  ui.introModes.append(b);
  return b;
});
const modeRows = MODE_KEYS.map((key) => {
  const b = el('button');
  b.type = 'button';
  b.dataset.mode = key;
  const text = el('span');
  text.append(el('strong', null, MODES[key].label), el('small', null, MODES[key].description));
  const mark = el('i');
  mark.setAttribute('aria-hidden', 'true');
  b.append(text, mark);
  b.addEventListener('click', () => {
    setMode(key);
    closeLayer(ui.modeModal);
  });
  ui.modeList.append(b);
  return b;
});
const stamps = ROUTES.map((name, i) => {
  const s = el('span', null, String(i + 1));
  ui.stamps.append(s);
  return s;
});

// The memory book: every route with its switches, its memory and its best loops; then the tickets.
const memoryRows = ROUTES.map((name, i) => {
  const li = el('li', 'memory-row');
  const stamp = el('span', 'memory-stamp', String(i + 1));
  stamp.setAttribute('aria-hidden', 'true');
  const body = el('div', 'memory-body');
  const text = el('p', 'memory-text');
  const best = el('small', 'memory-best');
  body.append(el('strong', null, name), el('small', 'memory-path', routeBranches(i).join(' · ')), text, best);
  li.append(stamp, body);
  ui.memoryList.append(li);
  return { li, text, best };
});
const ticketRows = TICKETS.map((t) => {
  const li = el('li', 'ticket-stub');
  const mark = el('span', 'ticket-punch');
  mark.setAttribute('aria-hidden', 'true');
  const body = el('div');
  body.append(el('strong', null, t.title), el('small', null, t.text));
  li.append(body, mark);
  ui.ticketList.append(li);
  return { id: t.id, li, mark };
});

function refreshBook() {
  let found = 0;
  memoryRows.forEach((row, i) => {
    const has = !!(prefs.discovered & (1 << i));
    if (has) found += 1;
    row.li.classList.toggle('found', has);
    row.text.textContent = has ? `“${MEMORIES[i]}”` : 'Not ridden yet. Throw these three switches to find it.';
    const times = MODE_KEYS.filter((k) => prefs.bestLaps[`${k}-${i}`]).map((k) => `${MODES[k].label} ${formatTime(prefs.bestLaps[`${k}-${i}`])}`);
    row.best.textContent = times.length ? `Best loops: ${times.join(' · ')}` : 'No timed loop yet';
  });
  for (const row of ticketRows) {
    const has = punched.has(row.id);
    row.li.classList.toggle('punched', has);
    row.mark.textContent = has ? 'Punched' : '';
  }
  const bestRide = Math.max(prefs.bestRide, ride.score);
  ui.bookSummary.textContent =
    `${found} of 8 routes stamped · ${punched.size} of ${TICKETS.length} tickets punched` +
    (bestRide > 0 ? ` · best ride ${Math.round(bestRide).toLocaleString()} keepsakes` : '');
}

const refreshBookCount = () => {
  ui.introBookCount.textContent = `${ui.routeCount.textContent} · ${punched.size}/${TICKETS.length}`;
};

function setMode(key) {
  if (ride.started && key !== ride.lapMode) ride.modeMixed = true;
  prefs.mode = key;
  chips.forEach((b) => {
    const on = b.dataset.mode === key;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  modeRows.forEach((b) => {
    const on = b.dataset.mode === key;
    b.classList.toggle('selected', on);
    b.querySelector('i').textContent = on ? '✓' : '';
  });
  ui.modeButton.textContent = MODES[key].label;
  save();
}

function setCamera(key) {
  prefs.camera = key;
  ui.cameraButton.textContent = CAMERAS[key];
  ui.cameraButton.setAttribute('aria-label', `Change camera. Current: ${CAMERAS[key]}`);
  save();
}

function setSound(on) {
  prefs.sound = on;
  ui.soundButton.textContent = on ? '♪' : '×♪';
  ui.soundButton.setAttribute('aria-label', on ? 'Mute sound' : 'Turn on sound');
  ui.toggleSound.classList.toggle('on', on);
  ui.toggleSound.setAttribute('aria-pressed', String(on));
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, audio.currentTime, 0.05);
  save();
}

function setReducedMotion(on) {
  prefs.reducedMotion = on;
  ui.toggleMotion.classList.toggle('on', on);
  ui.toggleMotion.setAttribute('aria-pressed', String(on));
  save();
}

function setHour(key) {
  prefs.hour = key;
  const evening = key === 'evening';
  ui.shell.classList.toggle('is-evening', evening);
  ui.hourButton.textContent = evening ? '☀︎' : '☾︎';
  ui.hourButton.setAttribute('aria-label', evening ? 'Ride in the summer afternoon' : 'Ride in the lantern evening');
  ui.introHourLabel.textContent = HOURS[key];
  ui.pauseHour.textContent = evening ? HOURS.afternoon : HOURS.evening;
  // Before the ride starts the park simply is that hour; mid-ride the light eases over.
  if (!ride.started) {
    dusk = evening ? 1 : 0;
    applyDusk();
  }
  save();
}

function setDiscovered(mask) {
  prefs.discovered = mask;
  let found = 0;
  stamps.forEach((s, i) => {
    const has = !!(mask & (1 << i));
    if (has) found += 1;
    s.classList.toggle('found', has);
    s.title = `${ROUTES[i]}${has ? ' — discovered' : ''}`;
  });
  ui.routeCount.textContent = `${found}/8`;
  ui.routeBook.setAttribute('aria-label', `${found} of 8 routes discovered. Open the memory book`);
  refreshBookCount();
  save();
}

/** Punch one of the conductor's tickets (once). */
function punch(id) {
  if (punched.has(id)) return;
  punched.add(id);
  const t = TICKETS.find((k) => k.id === id);
  showToast(`Ticket punched: ${t.title}`, 3000);
  punchSound();
  input.rumble(0.35, 90);
  refreshBookCount();
  save();
}

const cycle = (list, current) => list[(list.indexOf(current) + 1) % list.length];

// Notices wait their turn, so a stamped route, its memory and a ticket all get read.
const toastQueue = [];
let toastTimer = 0;
let toastBusy = false;
function nextToast() {
  const item = toastQueue.shift();
  if (!item) {
    toastBusy = false;
    ui.toast.hidden = true;
    return;
  }
  toastBusy = true;
  ui.toast.textContent = item.text;
  ui.toast.hidden = true;
  void ui.toast.offsetWidth; // replay the arrival animation
  ui.toast.hidden = false;
  toastTimer = setTimeout(nextToast, item.ms);
}
function showToast(text, ms = 3400) {
  toastQueue.push({ text, ms });
  if (!toastBusy) nextToast();
}

/** Button prompts follow the device in hand. */
const PROMPTS = {
  keyboard: {
    hint: 'W/↑ boost · S/↓ brake · A/D lean & switch',
    boost: 'Hold W or ↑ for a little extra pull.',
    left: 'A',
    right: 'D',
    help: { boost: 'W / ↑', brake: 'S / ↓ / Space', lean: 'A / D', camera: 'C', recover: 'R', menu: 'M / P', hour: 'N', book: 'B' },
  },
  gamepad: {
    hint: 'RT boost · LT brake · stick lean & switch',
    boost: 'Hold RT or A for a little extra pull.',
    left: '◀',
    right: '▶',
    help: { boost: 'RT / A', brake: 'LT / B', lean: 'Stick', camera: 'Y', recover: 'X', menu: 'Back / Start', hour: 'Start ▸', book: 'Start ▸' },
  },
  touch: {
    hint: 'Boost · Brake · stick to lean & switch',
    boost: 'Hold Boost for a little extra pull.',
    left: '←',
    right: '→',
    help: { boost: 'Boost', brake: 'Brake', lean: 'Stick', camera: 'Top bar', recover: 'Ⅱ ▸', menu: 'Ⅱ', hour: '☾︎', book: 'Stamps' },
  },
};
const helpKeys = [...document.querySelectorAll('[data-help]')];
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;
const applyPrompts = () => {
  const p = prompts();
  ui.rideHint.textContent = p.hint;
  ui.branchLeft.querySelector('kbd').textContent = p.left;
  ui.branchRight.querySelector('kbd').textContent = p.right;
  for (const k of helpKeys) k.textContent = p.help[k.dataset.help] || '';
};
input.onSourceChange(applyPrompts);
applyPrompts();

setMode(prefs.mode);
setCamera(prefs.camera);
setSound(prefs.sound);
setReducedMotion(prefs.reducedMotion);
setDiscovered(prefs.discovered);
setHour(prefs.hour);

// ---------------------------------------------------------------- menus

/** The topmost card that has the player's attention (null while riding). */
function activeLayer() {
  if (!ui.help.hidden) return ui.help;
  if (!ui.book.hidden) return ui.book;
  if (!ui.modeModal.hidden) return ui.modeModal;
  if (!ui.pause.hidden) return ui.pause;
  if (!ride.started) return ui.intro;
  return null;
}

const defaultButton = (layer) =>
  layer === ui.intro
    ? ui.ride
    : layer === ui.pause
      ? $('resume')
      : layer === ui.help
        ? $('help-done')
        : layer === ui.book
          ? $('book-done')
          : modeRows.find((b) => b.dataset.mode === prefs.mode);

const clearNavFocus = () => document.querySelectorAll('.nav-focus').forEach((b) => b.classList.remove('nav-focus'));
function focusButton(b) {
  if (!b) return;
  clearNavFocus();
  b.classList.add('nav-focus');
  b.focus({ preventScroll: false });
}
document.addEventListener('focusout', (e) => e.target.classList?.remove('nav-focus'));
addEventListener('pointerdown', clearNavFocus, true);

/** Move focus to the nearest button in a direction (dx, dy in screen space). */
function moveFocus(layer, dx, dy) {
  const list = [...layer.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) return focusButton(defaultButton(layer) || list[0]);
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const b of list) {
    if (b === cur) continue;
    const q = b.getBoundingClientRect();
    const ox = q.left + q.width / 2 - cx;
    const oy = q.top + q.height / 2 - cy;
    const along = dx ? ox * dx : oy * dy;
    if (along <= 4) continue;
    const score = along + (dx ? Math.abs(oy) : Math.abs(ox)) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) focusButton(best);
}

let shownLayer;
function layersChanged() {
  const layer = activeLayer();
  if (layer === shownLayer) return;
  const wasPlaying = shownLayer === null;
  shownLayer = layer;
  clearNavFocus();
  kit.touch?.suspend(!!layer, 'game');
  if (!layer) {
    document.activeElement?.blur?.();
    input.settle();
  } else {
    if (wasPlaying) document.activeElement?.blur?.();
    if (input.source === 'gamepad') focusButton(defaultButton(layer));
  }
}

function openLayer(layer) {
  if (layer === ui.book) {
    refreshBook();
    ui.bookScroll.scrollTop = 0;
  }
  layer.hidden = false;
  layersChanged();
}
function closeLayer(layer) {
  layer.hidden = true;
  if (layer === ui.pause) ride.paused = false;
  layersChanged();
}
function setPaused(on) {
  if (!ride.started) return;
  ride.paused = on;
  ui.pause.hidden = !on;
  layersChanged();
}
/** Esc, P, Start: close the top card, or pause and resume the ride. */
function pauseOrBack() {
  if (!ui.help.hidden) closeLayer(ui.help);
  else if (!ui.book.hidden) closeLayer(ui.book);
  else if (!ui.modeModal.hidden) closeLayer(ui.modeModal);
  else setPaused(!ride.paused);
}

function startRide() {
  ride.started = true;
  ride.paused = false;
  ui.intro.hidden = true;
  ui.help.hidden = true;
  ui.book.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = false;
  startAudio();
  bell();
  bell(0.32);
  beginLap();
  layersChanged();
}

/** Back to the station: a fresh ride, keeping everything the memory book holds. */
function restartRide() {
  prefs.bestRide = Math.max(prefs.bestRide, ride.score);
  Object.assign(ride, {
    progress: 0.006,
    speed: 7.2,
    risk: 0,
    lap: 1,
    lapTime: 0,
    score: 0,
    choices: [0, 0, 0],
    junction: null,
    recoverAsked: false,
    recovering: 0,
    cooldown: 0,
    shake: 0,
    onChain: false,
  });
  ride.routesThisRide.clear();
  beginLap();
  save();
  setPaused(false);
  bell();
  showToast('Back at the station. All aboard!', 2400);
}

ui.ride.addEventListener('click', startRide);
ui.introHour.addEventListener('click', () => setHour(prefs.hour === 'evening' ? 'afternoon' : 'evening'));
ui.introBook.addEventListener('click', () => openLayer(ui.book));
ui.modeButton.addEventListener('click', () => openLayer(ui.modeModal));
ui.cameraButton.addEventListener('click', () => setCamera(cycle(CAMERA_KEYS, prefs.camera)));
ui.hourButton.addEventListener('click', () => setHour(prefs.hour === 'evening' ? 'afternoon' : 'evening'));
ui.soundButton.addEventListener('click', () => setSound(!prefs.sound));
ui.routeBook.addEventListener('click', () => openLayer(ui.book));
$('pause-button').addEventListener('click', () => setPaused(true));
$('help-button').addEventListener('click', () => openLayer(ui.help));
ui.branchLeft.addEventListener('click', () => chooseBranch(-1));
ui.branchRight.addEventListener('click', () => chooseBranch(1));
$('resume').addEventListener('click', () => setPaused(false));
$('pause-mode').addEventListener('click', () => openLayer(ui.modeModal));
$('pause-help').addEventListener('click', () => openLayer(ui.help));
$('pause-book').addEventListener('click', () => openLayer(ui.book));
ui.pauseHour.addEventListener('click', () => setHour(prefs.hour === 'evening' ? 'afternoon' : 'evening'));
$('pause-recover').addEventListener('click', () => {
  ride.recoverAsked = true;
  setPaused(false);
});
$('pause-restart').addEventListener('click', restartRide);
$('pause-settings').addEventListener('click', () => kit.menu.open());
$('help-settings').addEventListener('click', () => kit.menu.open());
$('mode-close').addEventListener('click', () => closeLayer(ui.modeModal));
$('help-close').addEventListener('click', () => closeLayer(ui.help));
$('help-done').addEventListener('click', () => closeLayer(ui.help));
$('book-close').addEventListener('click', () => closeLayer(ui.book));
$('book-done').addEventListener('click', () => closeLayer(ui.book));
ui.toggleMotion.addEventListener('click', () => setReducedMotion(!prefs.reducedMotion));
ui.toggleSound.addEventListener('click', () => setSound(!prefs.sound));
// A mouse or touch click must not leave a HUD button focused, or Space would press it again.
ui.hud.addEventListener('click', (e) => {
  if (e.detail) e.target.closest('button')?.blur();
});
// A tap on the backdrop closes a card, like the gamepad's B.
for (const layer of [ui.modeModal, ui.help, ui.book]) {
  layer.addEventListener('click', (e) => {
    if (e.target === layer) closeLayer(layer);
  });
}
// The kit's floating stick owns the left of the screen while riding on touch. A tap
// there that lands on one of the park's own HUD buttons (a switch choice, the route
// stamps) still presses that button instead of starting the stick.
addEventListener(
  'pointerdown',
  (e) => {
    if (!e.target?.closest?.('.kit-touch__zone')) return;
    let hit = null;
    for (const n of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (ui.hud.contains(n)) {
        hit = n.closest('button');
        break;
      }
    }
    if (!hit) return;
    e.stopPropagation();
    e.preventDefault();
    hit.click();
  },
  true
);

// ---------------------------------------------------------------- per frame

let navDir = 0;
let navRepeatAt = 0;
let leanSide = 0;

function readInput(layer, now, dt) {
  const mv = input.vector('move');
  const side = mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  if (input.pressed('camera')) setCamera(cycle(CAMERA_KEYS, prefs.camera));
  if (input.pressed('mode')) setMode(cycle(MODE_KEYS, prefs.mode));
  if (input.pressed('hour')) setHour(prefs.hour === 'evening' ? 'afternoon' : 'evening');
  // Asking the conductor for help only means something on the rails.
  if (input.pressed('recover') && !layer) ride.recoverAsked = true;
  if (input.pressed('book')) {
    if (layer === ui.book) closeLayer(ui.book);
    else if (!layer || layer === ui.pause || layer === ui.intro) openLayer(ui.book);
    layer = activeLayer();
  }
  if (input.pressed('pause')) {
    pauseOrBack();
    layer = activeLayer();
  }

  if (!layer) {
    ride.boost = input.down('boost') || mv.y > 0.5;
    ride.brake = input.down('brake') || mv.y < -0.5;
    ride.lean = clamp(-mv.x * 1.5, -1, 1);
    if (side && side !== leanSide) chooseBranch(side);
    leanSide = side;
    navDir = 0;
    return;
  }

  ride.boost = ride.brake = false;
  ride.lean = 0;
  leanSide = side;
  if (layer === ui.book) {
    // The book is a long page: up and down scroll it; A closes it, like its button.
    if (Math.abs(mv.y) > 0.2) ui.bookScroll.scrollTop -= mv.y * 720 * dt;
    navDir = 0;
  } else {
    // Menus: stick, D-pad or arrows move between buttons; A or Enter presses; B goes back.
    let dx = 0;
    let dy = 0;
    if (Math.max(Math.abs(mv.x), Math.abs(mv.y)) > 0.5) {
      if (Math.abs(mv.x) > Math.abs(mv.y)) dx = Math.sign(mv.x);
      else dy = -Math.sign(mv.y);
    }
    const dir = dx * 3 + dy;
    if (dir && (dir !== navDir || now >= navRepeatAt)) {
      moveFocus(layer, dx, dy);
      navRepeatAt = now + (dir !== navDir ? 380 : 140);
    }
    navDir = dir;
  }
  if (input.pressed('confirm')) {
    const focused = layer.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
    (focused || defaultButton(layer))?.click();
  } else if (input.pressed('back')) {
    if (layer === ui.pause) setPaused(false);
    else if (layer !== ui.intro) closeLayer(layer);
  }
}

const view = newFrame();
const carFrame = newFrame();
const carBasis = new THREE.Matrix4();
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const lastTrain = new THREE.Vector3();
const trainMove = new THREE.Vector3();
const hud = {};
const put = (key, node, value, prop = 'textContent') => {
  if (hud[key] === value) return;
  hud[key] = value;
  node[prop] = value;
};
const setVar = (key, value) => {
  if (hud[key] === value) return;
  hud[key] = value;
  ui.dial.style.setProperty(key, value);
};
let acc = 0;
let hudAt = 0;
let frames = 0;
let clackIn = 0;
let cricketIn = 1.5;

function updateHud(now) {
  const mode = MODES[prefs.mode];
  const comfort = comfortSpeed(view);
  const g = lateralG(view, ride.speed);
  let coach = 'Read the rails and enjoy the little things.';
  if (ride.junction !== null) coach = `Choose ${JUNCTIONS[ride.junction].left} or ${JUNCTIONS[ride.junction].right}.`;
  else if (ride.risk > 0.58) coach = 'Easy now — brake and lean into the bend.';
  else if (ride.brake) coach = 'Lovely braking. Let the cars settle.';
  else if (ride.lap === 1 && ride.lapTime < 4) coach = prompts().boost;
  else if (ride.onChain) coach = 'Clack, clack, clack… the chain has you.';
  else if (ride.speed < comfort * 0.68) coach = 'A touch of boost will carry the next rise.';
  else if (prefs.mode === 'coached' && ride.speed > comfort * 0.9) coach = 'The amber band is close. Feather the brake.';

  put('lap', ui.lap, `Loop ${ride.lap} · ${formatTime(ride.lapTime)}`);
  put('coach', ui.coach, coach);
  put('speed', ui.speed, String(Math.round(ride.speed * 3.6)));
  put('comfort', ui.comfort, `Comfort line ${Math.round(comfort * 3.6)}`);
  put('lateral', ui.lateral, `${g.toFixed(1)}g`);
  put('score', ui.score, `${Math.round(ride.score).toLocaleString()} keepsakes`);
  // The dial: speed as the cream arc, the amber band above the comfort line, warming with risk.
  setVar('--meter', `${(clamp(ride.speed / mode.maxSpeed, 0, 1) * 270).toFixed(1)}deg`);
  setVar('--comfort', `${(clamp(comfort / mode.maxSpeed, 0, 1) * 270).toFixed(1)}deg`);
  setVar('--risk', clamp(ride.risk, 0, 1).toFixed(2));
  const current = routeIndex(ride.choices);
  if (hud.current !== current) {
    stamps[hud.current]?.classList.remove('current');
    stamps[current].classList.add('current');
    hud.current = current;
  }
  const j = ride.junction;
  put('junctionShown', ui.junction, j === null, 'hidden');
  if (j !== null) {
    put('junctionTitle', ui.junctionTitle, JUNCTIONS[j].title);
    put('leftName', ui.branchLeft.querySelector('span'), JUNCTIONS[j].left);
    put('rightName', ui.branchRight.querySelector('span'), JUNCTIONS[j].right);
    const pick = ride.choices[j];
    if (hud.pick !== `${j}${pick}`) {
      hud.pick = `${j}${pick}`;
      ui.branchLeft.classList.toggle('selected', pick === 0);
      ui.branchRight.classList.toggle('selected', pick === 1);
      ui.branchLeft.setAttribute('aria-pressed', String(pick === 0));
      ui.branchRight.setAttribute('aria-pressed', String(pick === 1));
    }
  }
  const recovering = ride.recovering > 0;
  if (hud.recovering !== recovering) {
    hud.recovering = recovering;
    ui.shell.classList.toggle('is-recovering', recovering);
    ui.recovery.hidden = !recovering;
  }
  hudAt = now;
}

layersChanged();

kit.start((frameDt) => {
  if (frames < 2) {
    frames += 1;
    post.render();
    if (frames === 2) {
      for (const pair of world.glows) for (const g of pair) g.mesh.visible = false;
      applyDusk(); // puts the fireflies back to the hour's own state
      camera.position.set(0, 12, -45);
      camera.lookAt(0, 0, 0);
    }
    return;
  }
  const dt = Math.min(frameDt, 0.05);
  const now = performance.now();
  readInput(activeLayer(), now, dt);
  const riding = ride.started && !activeLayer();

  acc = Math.min(acc + dt, 0.06);
  for (let steps = 0; acc >= 1 / 120 && steps < 7; steps += 1) {
    if (riding) simStep(1 / 120);
    acc -= 1 / 120;
  }
  syncHum(riding);
  if (riding && ride.onChain) {
    clackIn -= dt;
    if (clackIn <= 0) {
      tick();
      clackIn = 0.17;
    }
  }
  if (riding && dusk > 0.5) {
    cricketIn -= dt;
    if (cricketIn <= 0) {
      chirp();
      cricketIn = 0.8 + Math.random() * 1.6;
    }
  }

  // The hour eases over about a second and a half.
  const duskTarget = prefs.hour === 'evening' ? 1 : 0;
  if (dusk !== duskTarget) {
    dusk = clamp(dusk + Math.sign(duskTarget - dusk) * (dt / 1.6), 0, 1);
    if (Math.abs(dusk - duskTarget) < 1e-3) dusk = duskTarget;
    applyDusk();
  }

  // The train: an engine and three cars following the rails behind it.
  trackFrame(ride.progress, ride.choices, ride.lean, view);
  world.cars.forEach((car, i) => {
    const p = (((ride.progress - (i * 2.25) / view.metersPerProgress + 1) % 1) + 1) % 1;
    const f = trackFrame(p, ride.choices, ride.lean * (1 - i * 0.08), carFrame);
    const bounce = ride.recovering > 0 ? Math.sin(ride.recovering * 22 + i) * 0.12 * ride.recovering : 0;
    car.position.copy(f.position).addScaledVector(f.up, 0.62 + bounce);
    car.quaternion.setFromRotationMatrix(carBasis.makeBasis(f.right, f.up, f.tangent));
    car.rotation.x += ride.brake ? -0.025 : ride.boost ? 0.018 : 0;
  });

  // Camera
  const cam = prefs.camera;
  if (cam === 'diorama') {
    const a = now * 25e-6;
    wantPos.set(Math.cos(a) * 72, 58, Math.sin(a) * 72);
    wantLook.set(0, 4.8, 0);
  } else if (cam === 'ride') {
    // Out over the engine's nose, clear of its stack, with the rails running away ahead.
    wantPos.copy(view.position).addScaledVector(view.up, 1.75).addScaledVector(view.tangent, 1.3);
    wantLook.copy(view.position).addScaledVector(view.tangent, 8).addScaledVector(view.up, 0.45);
  } else {
    wantPos.copy(view.position).addScaledVector(view.tangent, -8.7).addScaledVector(view.up, 4.2).addScaledVector(view.right, 1.35);
    wantLook.copy(view.position).addScaledVector(view.tangent, 6).addScaledVector(view.up, 0.5);
  }
  // The front seat travels with the train before it smooths, so it never trails back into the riders.
  trainMove.copy(view.position).sub(lastTrain);
  lastTrain.copy(view.position);
  if (cam === 'ride' && trainMove.lengthSq() < 25) {
    camera.position.add(trainMove);
    lookAt.add(trainMove);
  }
  const follow = prefs.reducedMotion ? 1 - Math.exp(-dt * 11) : 1 - Math.exp(-dt * (cam === 'ride' ? 7 : 4.2));
  camera.position.lerp(wantPos, follow);
  lookAt.lerp(wantLook, 1 - Math.exp(-dt * 7));
  if (ride.shake > 0) {
    if (!prefs.reducedMotion) {
      camera.position.x += (Math.random() - 0.5) * ride.shake;
      camera.position.y += (Math.random() - 0.5) * ride.shake * 0.55;
    }
    ride.shake = Math.max(0, ride.shake - dt * 1.4);
  }
  camera.lookAt(lookAt);
  const fov = cam === 'diorama' || prefs.reducedMotion ? 50 : 52 + ride.speed * 0.32;
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 3.5));
  camera.updateProjectionMatrix();

  // Switch glows and signal lamps
  const pulse = 0.5 + Math.sin(now * 0.009) * 0.24;
  for (let j = 0; j < world.glows.length; j += 1) {
    const upcoming = ride.junction === j;
    for (let b = 0; b < 2; b += 1) {
      const picked = ride.choices[j] === b;
      const glow = world.glows[j][b];
      glow.mat.opacity = upcoming ? (picked ? pulse : 0.1) : 0;
      glow.mesh.visible = glow.mat.opacity > 0;
      const lamp = world.signals[j][b];
      lamp.color.setHex(picked ? 0xf2bd46 : 0x4d473d);
      lamp.emissive.setHex(picked ? 0xd17b28 : 0x211d19);
      lamp.emissiveIntensity = upcoming && picked ? 3 + pulse : picked ? 1.1 : 0.2;
    }
  }

  // The park's slow life
  const seconds = now * 0.001;
  world.wheel.rotation.z += dt * 0.055;
  world.carousel.rotation.y += dt * 0.16;
  world.pond.rotation.z += dt * 0.008;
  world.pollen.rotation.y += dt * 0.008;
  world.swayTrees(seconds);
  world.animateFireflies(seconds);

  if (ride.started && now - hudAt > 90) updateHud(now);

  // The title card's photograph covers the park entirely, so it only needs drawing once it is uncovered.
  if (ride.started) post.render();
});
