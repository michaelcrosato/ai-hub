/**
 * main.js — Hudson's little home: three quiet rooms to tap, listen and learn words in.
 *
 * A room is the interface. Tap a thing (or pick it with the arrow keys or a
 * controller) and it comes close on a little stage for one minute: its name
 * is spoken word by word, three pictures show more about it ("Mom's cup",
 * "Dad's cup", "Hudson's cup"), and after 30 seconds a second page opens by
 * itself. Grown-ups get a PIN-gated corner for voice, rooms, full screen and
 * graphics settings.
 *
 * Runs on the shared 3D stack: kit/boot.js starts WebGPURenderer (WebGL2 as
 * the fallback), sizes the canvas to #viewport and routes keyboard, mouse,
 * touch and gamepad through kit.input actions.
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { MOUSE_LOOK, TOUCH_LOOK } from 'kit/input.js';
import { ROOMS, ROOM_ORDER, LESSONS, SAFETY_NOTES, validateLessons } from './data.js';
import { buildKitchen } from './kitchen.js';
import { buildFamilyRoom } from './family.js';
import { buildBathroom } from './bathroom.js';
import { mergeStatic } from './shapes.js';
import { createLessonModels, lessonParts, animateLesson } from './lessonModels.js';
import { LessonTimer, PinGate, PIN_CHOICES } from './lesson.js';
import { Speaker, tokenize } from './speech.js';
import { createSounds } from './sounds.js';

const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = $('app');
const topbar = document.querySelector('.topbar');
const cards = $('word-cards');

// ---------------------------------------------------------------- settings and progress

const SETTINGS_KEY = 'hudson-kitchen-settings-v1';
const PROGRESS_KEY = 'hudson-home-progress-v1';

const settings = {
  speechStyle: 'words',
  sound: true,
  motion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  pin: '1234',
  voice: '',
  chimes: true,
};
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (['words', 'natural'].includes(saved.speechStyle)) settings.speechStyle = saved.speechStyle;
  if (typeof saved.sound === 'boolean') settings.sound = saved.sound;
  if (typeof saved.motion === 'boolean') settings.motion = saved.motion;
  if (PIN_CHOICES.includes(saved.pin)) settings.pin = saved.pin;
  if (typeof saved.voice === 'string') settings.voice = saved.voice;
  if (typeof saved.chimes === 'boolean') settings.chimes = saved.chimes;
} catch {
  /* private mode or unreadable storage: keep the defaults */
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked: settings last for this visit */
  }
}

/** Every word in every room, as "room:id". */
const ALL_WORDS = new Set(ROOM_ORDER.flatMap((room) => ROOMS[room].words.map((w) => `${room}:${w.id}`)));

/** Found words and the last room, kept on this device so play continues where it stopped. */
const progress = { seen: new Set(), room: 'kitchen' };
try {
  const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  if (Array.isArray(saved.seen)) for (const key of saved.seen) if (ALL_WORDS.has(key)) progress.seen.add(key);
  if (ROOMS[saved.room]) progress.room = saved.room;
} catch {
  /* start fresh */
}
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ seen: [...progress.seen], room: progress.room }));
  } catch {
    /* progress lasts for this visit */
  }
}

const pinGate = new PinGate(settings.pin);

const state = {
  page: 0,
  choice: 0,
  activeOption: null,
  actionElapsed: 0,
  idleElapsed: 0,
  surfaceElapsed: 0,
  pendingMore: false,
  autoMoreDone: false,
  lastTapAt: -1e4,
  ready: false,
  started: false,
  mode: 'room', // 'room' | 'zoom' (flying in) | 'focus' (one thing on the stage)
  room: progress.room,
  current: null,
  lesson: null,
  modal: null, // null | 'pin' | 'parent'
  pin: '',
  childLocked: false,
  guard: false,
  visitSeen: new Set(),
  angle: 0.54,
  elevation: 0.59,
  turn: 0,
  turnTarget: 0,
  bumpAt: -1e4,
  transition: null,
  voiceErrorShown: false,
  speechAt: -1e4,
  parentActivity: 0,
};

let words = ROOMS[state.room].words;
let wordIndex = new Map(words.map((w) => [w.id, w]));

// ---------------------------------------------------------------- boot

const digitActions = {};
for (let d = 0; d <= 9; d++) digitActions[`digit${d}`] = { keys: [`Digit${d}`, `Numpad${d}`] };

const kit = await boot({
  title: "Hudson's little home",
  mount: $('viewport'),
  gear: 'none', // the grown-up corner has the graphics settings button
  renderer: { alpha: true }, // the paper background shows through the room
  background: '#34473d',
  accent: '#c97754',
  input: {
    // Taps pick things directly on touch, so move has no on-screen stick: it drives the
    // keyboard/controller cursor, the lesson pictures and the menus.
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    select: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['KeyK'], gamepad: ['B'] },
    page: { keys: ['KeyQ', 'KeyE', 'PageUp', 'PageDown'], gamepad: ['LB', 'RB'] },
    room: { keys: ['KeyR'], gamepad: ['Y'] },
    menu: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    pinDelete: { keys: ['Backspace', 'Delete'] },
    ...digitActions,
  },
});
const renderer = kit.renderer;
const input = kit.input;

renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

let kitPaused = false;
let dirty = true; // the room only redraws when something changed

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 90);
const lookTarget = new THREE.Vector3();

scene.add(new THREE.HemisphereLight('#fff6de', '#b0b9a3', 2.25));
const sun = new THREE.DirectionalLight('#fff0d6', 3.2);
sun.position.set(-3, 10, 7);
sun.castShadow = true;
kit.shadow(sun, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, far: 40 });
sun.shadow.normalBias = 0.026;
sun.shadow.bias = -0.00015;
sun.shadow.radius = 2;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
const fill = new THREE.DirectionalLight('#e5eef0', 1.1);
fill.position.set(6, 6, -4);
scene.add(fill);

/** A soft, round contact shadow, drawn once into a small canvas and shared. */
const softShadowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(52,63,43,.48)');
  gradient.addColorStop(0.48, 'rgba(52,63,43,.20)');
  gradient.addColorStop(1, 'rgba(52,63,43,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
})();
function softShadow(width, depth, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: softShadowTexture, transparent: true, opacity, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Under the room: a soft shadow and a shadow catcher on the paper.
const ground = new THREE.Group();
scene.add(ground);
const roomShadow = softShadow(16, 12, 0.43);
roomShadow.position.set(0, -0.305, 0);
ground.add(roomShadow);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.1 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = -0.302;
shadowCatcher.receiveShadow = true;
ground.add(shadowCatcher);

// The little round stage a lesson's pictures stand on.
const stage = new THREE.Group();
stage.visible = false;
scene.add(stage);
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(2.3, 2.37, 0.08, 80),
  new THREE.MeshStandardMaterial({ color: '#e4ebdd', roughness: 1 }),
);
pedestal.position.y = -0.055;
pedestal.receiveShadow = true;
stage.add(pedestal);
const stageShadow = softShadow(5.8, 4.8, 0.48);
stageShadow.position.y = -0.096;
stage.add(stageShadow);
const stageChoices = new THREE.Group();
stage.add(stageChoices);

// ---------------------------------------------------------------- rooms

const BUILDERS = { kitchen: buildKitchen, family: buildFamilyRoom, bathroom: buildBathroom };
const rooms = {};

/** Build a room the first time it is visited: models, merged static parts, lesson pictures. */
function getRoom(key) {
  if (rooms[key]) return rooms[key];
  const roomWords = ROOMS[key].words;
  validateLessons(roomWords);
  const built = BUILDERS[key](roomWords);
  mergeStatic(built.root);
  built.key = key;
  built.lessons = createLessonModels(built);
  // World-space centres, for the keyboard/controller cursor and the zoom-in target.
  built.centers = new Map();
  const bounds = new THREE.Box3();
  for (const [id, group] of built.models) built.centers.set(id, bounds.setFromObject(group).getCenter(new THREE.Vector3()));
  built.root.visible = false;
  scene.add(built.root);
  rooms[key] = built;
  return built;
}

let currentRoom = null;
/** The lesson pictures standing on the stage: { holder, view, option, parts, targetX, targetZ, targetScale }. */
let views = [];

// ---------------------------------------------------------------- captions and speech

let toastTimer = 0;
function toast(text, ms = 3600) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => ($('toast').hidden = true), ms);
}

const captionTarget = () => (state.mode === 'focus' ? $('focus-line') : $('surface-label').querySelector('span'));
const currentLabel = () => state.activeOption?.label || state.current?.word || '';
function setFocusWord(text) {
  $('focus-word').textContent = text;
  $('focus-word').classList.toggle('long-word', text.length > 13);
}

let wordTimer = 0;
let labelTimer = 0;
function onPhrase(text) {
  clearTimeout(wordTimer);
  clearTimeout(labelTimer);
  const target = captionTarget();
  target.replaceChildren();
  target.classList.remove('phrase-active');
  tokenize(text).forEach((token, i) => {
    if (i) target.append(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'spoken-token';
    span.textContent = token.text;
    target.append(span);
  });
  target.setAttribute('aria-label', text);
  if (state.mode !== 'focus') {
    $('surface-label').hidden = false;
    labelTimer = setTimeout(() => {
      if (!speaker.busy) $('surface-label').hidden = true;
    }, 5000);
  } else setFocusWord(currentLabel());
}
function onWord(index, word) {
  clearTimeout(wordTimer);
  const target = captionTarget();
  target.classList.toggle('phrase-active', index < 0);
  [...target.querySelectorAll('.spoken-token')].forEach((el, i) => el.classList.toggle('active-word', i === index));
  if (state.mode === 'focus') {
    setFocusWord(index < 0 ? currentLabel() : word.replace(/[.,!?;:]+$/, ''));
    $('focus-word').classList.toggle('word-live', index >= 0);
  }
}

let voices = [];
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const speaker = new Speaker({
  synth,
  Utterance: window.SpeechSynthesisUtterance,
  enabled: () => settings.sound && !isHeld(),
  voice: () =>
    voices.find((v) => v.voiceURI === settings.voice) ||
    voices.find((v) => v.localService && /^en[-_]CA/i.test(v.lang)) ||
    voices.find((v) => v.localService) ||
    voices[0],
  style: () => settings.speechStyle,
  onPhrase,
  onWord,
  onSpeaking: (speaking) => {
    app.classList.toggle('speaking', speaking);
    if (!speaking && !speaker.busy) {
      clearTimeout(wordTimer);
      wordTimer = setTimeout(() => {
        if (state.mode === 'focus') {
          setFocusWord(currentLabel());
          $('focus-word').classList.remove('word-live');
        }
      }, 700);
      clearTimeout(labelTimer);
      labelTimer = setTimeout(() => {
        if (state.mode !== 'focus') $('surface-label').hidden = true;
      }, 2200);
    }
  },
  onError: () => {
    if (state.voiceErrorShown) return;
    state.voiceErrorShown = true;
    toast('No voice played. Check the volume and the English voice on this device.', 6000);
  },
});
const stopSpeech = () => speaker.stop();
function say(lines, force = false) {
  if (isHeld()) return;
  const now = performance.now();
  if (!force && now - state.speechAt < 700) return;
  state.speechAt = now;
  speaker.say(lines);
}

function refreshVoices() {
  voices = synth ? synth.getVoices().filter((v) => /^en/i.test(v.lang)) : [];
  voices.sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
  const select = $('voice-select');
  select.replaceChildren(new Option('Device default', ''));
  for (const v of voices) select.add(new Option(`${v.name}${v.localService ? ' · local' : ''}`, v.voiceURI));
  if (voices.some((v) => v.voiceURI === settings.voice)) select.value = settings.voice;
}
if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
}

const sounds = createSounds({ enabled: () => settings.chimes && !isHeld() });

function updateSoundStatus() {
  const text = synth ? (settings.sound ? (state.started ? 'Sound is on' : 'Tap to hear words') : 'Sound is off') : 'Voice is not available';
  $('sound-status').innerHTML = `<span class="status-dot"></span>${text}`;
}

// ---------------------------------------------------------------- pause, modals, full screen

/** Play is held while a grown-up screen is open, the page is hidden or the kit settings are open. */
function isHeld() {
  return document.hidden || !!state.modal || state.guard || kitPaused;
}

kit.onPause((paused) => {
  kitPaused = paused;
  sounds.pause(paused);
  if (paused) stopSpeech();
  else {
    state.parentActivity = performance.now();
    dirty = true;
  }
});

let wakeLock = null;
async function requestWakeLock() {
  if (!state.started || document.hidden || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
  } catch {
    wakeLock = null;
  }
}

let returnFocus = null;
function setModal(name) {
  state.modal = name;
  $('pin-overlay').hidden = name !== 'pin';
  $('parent-overlay').hidden = name !== 'parent';
  $('play-area').inert = !!name || state.guard;
  topbar.inert = !!name || state.guard;
  if (name) stopSpeech();
  dirty = true;
}

let pinClearTimer = 0;
function openPin() {
  returnFocus = document.activeElement;
  clearTimeout(pinClearTimer);
  state.pin = '';
  renderPinDots();
  $('pin-error').textContent = Date.now() < pinGate.blockedUntil ? 'Please wait a moment, then try again.' : '';
  setModal('pin');
  $('pin-dialog').focus();
}
function closeModal() {
  setModal(null);
  if (returnFocus && document.contains(returnFocus) && !state.guard) returnFocus.focus({ preventScroll: true });
  input.settle();
}
function renderPinDots() {
  [...$('pin-dots').children].forEach((dot, i) => dot.classList.toggle('filled', i < state.pin.length));
  $('pin-dots').setAttribute('aria-label', `${state.pin.length} of 4 digits entered`);
}
function pinKey(key) {
  if (key === 'clear' || key === 'delete') clearTimeout(pinClearTimer);
  if (state.modal !== 'pin') return;
  if (Date.now() < pinGate.blockedUntil) {
    $('pin-error').textContent = `Try again in ${Math.ceil((pinGate.blockedUntil - Date.now()) / 1000)} seconds.`;
    return;
  }
  if (key === 'clear') state.pin = '';
  else if (key === 'delete') state.pin = state.pin.slice(0, -1);
  else if (/^\d$/.test(key) && state.pin.length < 4) state.pin += key;
  else return;
  renderPinDots();
  if (state.pin.length !== 4) return;
  const result = pinGate.check(state.pin);
  if (result.ok) {
    state.pin = '';
    renderPinDots();
    openParent();
  } else {
    $('pin-error').textContent = result.wait ? 'Please wait 15 seconds, then try again.' : 'That PIN did not match. Try again.';
    pinClearTimer = setTimeout(() => {
      state.pin = '';
      renderPinDots();
    }, 350);
  }
}

function foundIn(roomKey) {
  let n = 0;
  for (const w of ROOMS[roomKey].words) if (progress.seen.has(`${roomKey}:${w.id}`)) n++;
  return n;
}
function updateParentStats() {
  const perRoom = ROOM_ORDER.map((k) => `${ROOMS[k].label} ${foundIn(k)}/${ROOMS[k].words.length}`).join(' · ');
  $('parent-stats').textContent =
    `${progress.seen.size} of ${ALL_WORDS.size} words found (${perRoom}). ${state.visitSeen.size} explored on this visit. ` +
    'Settings and progress stay on this device. No accounts or ads.';
}

function openParent() {
  setModal('parent');
  state.parentActivity = performance.now();
  $('sound-toggle').setAttribute('aria-checked', String(settings.sound));
  $('chime-toggle').setAttribute('aria-checked', String(settings.chimes));
  $('motion-toggle').setAttribute('aria-checked', String(settings.motion));
  $('pin-choice').value = settings.pin;
  $('speech-style').value = settings.speechStyle;
  refreshVoices();
  $('parent-lesson').textContent = state.lesson
    ? `${state.current.word}: ${state.lesson.remaining} seconds remain. Time is paused.`
    : 'No object is open.';
  updateParentStats();
  resetClearConfirm();
  $('parent-resume').innerHTML = state.guard ? `Resume full screen ${icon('expand')}` : `Back to play ${icon('arrow')}`;
  $('parent-dialog').focus();
}

function setGuard(on) {
  state.guard = on;
  $('resume-guard').hidden = !on;
  $('play-area').inert = on || !!state.modal;
  topbar.inert = on || !!state.modal;
  if (on) {
    stopSpeech();
    if (!state.modal) $('resume-parent').focus();
  }
  dirty = true;
}

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
async function enterFullscreen() {
  startPlay(false);
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) {
    toast('This browser does not offer full-screen mode. Use a device lock for safer play.', 6500);
    return false;
  }
  try {
    await request.call(root);
    state.childLocked = true;
    setGuard(false);
    $('fullscreen').setAttribute('aria-label', 'Full-screen mode is on. Open the grown-up PIN screen.');
    requestWakeLock();
    return true;
  } catch {
    toast('Full screen did not start. Try the full-screen button in your main browser.', 6000);
    return false;
  }
}
async function exitFullscreen() {
  state.childLocked = false;
  setGuard(false);
  closeModal();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {
    toast('Use the browser control to leave full-screen mode.');
  }
  $('fullscreen').setAttribute('aria-label', 'Enter full-screen mode');
}
function onFullscreenChange() {
  if (!fullscreenElement() && state.childLocked) setGuard(true);
  if (fullscreenElement()) setGuard(false);
  layoutCamera();
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// ---------------------------------------------------------------- DOM buttons

/** A tap that ignores drags (fingers sliding over a button) and still works from the keyboard. */
function onTap(el, fn) {
  const downs = new Map();
  let clickBlockedUntil = 0;
  el.addEventListener(
    'pointerdown',
    (e) => downs.set(e.pointerId, { x: e.clientX, y: e.clientY, at: performance.now(), moved: false }),
    { passive: true },
  );
  el.addEventListener(
    'pointermove',
    (e) => {
      const d = downs.get(e.pointerId);
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) d.moved = true;
    },
    { passive: true },
  );
  el.addEventListener('pointerup', (e) => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (!d) return;
    clickBlockedUntil = performance.now() + 500;
    if (!d.moved && performance.now() - d.at < 760 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 13) fn(e);
  });
  el.addEventListener('pointercancel', (e) => downs.delete(e.pointerId), { passive: true });
  el.addEventListener('click', (e) => {
    if (performance.now() < clickBlockedUntil) {
      e.preventDefault();
      return;
    }
    fn(e);
  });
}

$('fullscreen').addEventListener('click', () => (state.childLocked || fullscreenElement() ? openPin() : enterFullscreen()));
$('grownups').addEventListener('click', openPin);
$('resume-parent').addEventListener('click', openPin);
$('pin-close').addEventListener('click', closeModal);
$('parent-close').addEventListener('click', closeModal);
$('parent-resume').addEventListener('click', async () => {
  if (state.guard && !(await enterFullscreen())) {
    state.childLocked = false;
    setGuard(false);
    toast('Play resumed in this window. Use the device lock for safer play.', 6000);
  }
  closeModal();
  requestWakeLock();
});
$('parent-room').addEventListener('click', () => {
  backToRoom(true);
  if (state.guard) {
    state.childLocked = false;
    setGuard(false);
  }
  closeModal();
});
for (const button of $('room-picker').querySelectorAll('[data-room]')) {
  button.addEventListener('click', () => {
    const key = button.dataset.room;
    if (key === state.room) return;
    if (state.mode !== 'room') backToRoom(true);
    // A room picked from the grown-up corner also ends the "full screen ended" pause.
    if (state.guard) {
      state.childLocked = false;
      setGuard(false);
    }
    closeModal();
    switchRoom(key, true);
  });
}
$('parent-exit').addEventListener('click', exitFullscreen);
$('parent-graphics').addEventListener('click', () => kit.menu.open());

let clearConfirmTimer = 0;
function resetClearConfirm() {
  clearTimeout(clearConfirmTimer);
  $('parent-reset').classList.remove('confirm');
  $('parent-reset').textContent = 'Clear found words';
}
$('parent-reset').addEventListener('click', () => {
  const button = $('parent-reset');
  if (!button.classList.contains('confirm')) {
    button.classList.add('confirm');
    button.textContent = 'Tap again to clear';
    clearTimeout(clearConfirmTimer);
    clearConfirmTimer = setTimeout(resetClearConfirm, 4000);
    return;
  }
  resetClearConfirm();
  progress.seen.clear();
  saveProgress();
  for (const card of cards.children) card.classList.remove('seen');
  updateFound();
  updateParentStats();
  toast('Found words are cleared. Every room is new again.');
});
$('sound-toggle').addEventListener('click', () => {
  settings.sound = !settings.sound;
  $('sound-toggle').setAttribute('aria-checked', String(settings.sound));
  saveSettings();
  updateSoundStatus();
  if (!settings.sound) stopSpeech();
});
$('chime-toggle').addEventListener('click', () => {
  settings.chimes = !settings.chimes;
  $('chime-toggle').setAttribute('aria-checked', String(settings.chimes));
  saveSettings();
});
$('motion-toggle').addEventListener('click', () => {
  settings.motion = !settings.motion;
  $('motion-toggle').setAttribute('aria-checked', String(settings.motion));
  saveSettings();
});
$('speech-style').addEventListener('change', (e) => {
  settings.speechStyle = e.target.value;
  saveSettings();
  stopSpeech();
});
$('voice-select').addEventListener('change', (e) => {
  settings.voice = e.target.value;
  saveSettings();
});
$('pin-choice').addEventListener('change', (e) => {
  settings.pin = e.target.value;
  pinGate.setPin(settings.pin);
  saveSettings();
  toast('The grown-up PIN is saved on this device.');
});
$('parent-overlay').addEventListener('pointerdown', () => (state.parentActivity = performance.now()));
$('parent-overlay').addEventListener('keydown', () => (state.parentActivity = performance.now()));
onTap($('start-play'), () => startPlay(true));
onTap($('repeat-word'), repeatWord);
onTap($('back-kitchen'), () => backToRoom(false));
onTap($('room-switch'), () => switchRoom(nextRoomKey()));
for (const tab of $('lesson-tabs').querySelectorAll('[data-page]')) onTap(tab, () => showPage(Number(tab.dataset.page)));

for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = key === 'clear' ? 'key-clear' : key === 'delete' ? 'key-delete' : '';
  button.setAttribute('aria-label', key === 'delete' ? 'Delete last digit' : key === 'clear' ? 'Clear PIN' : key);
  button.innerHTML = key === 'delete' ? icon('backspace') : key === 'clear' ? 'Clear' : key;
  button.addEventListener('click', () => pinKey(key));
  $('keypad').append(button);
}

// Keep Tab inside an open grown-up dialog (digits, Backspace and Escape arrive as kit actions).
document.addEventListener('keydown', (e) => {
  if (!state.modal || e.key !== 'Tab') return;
  const dialog = $(state.modal === 'pin' ? 'pin-dialog' : 'parent-dialog');
  const items = [...dialog.querySelectorAll('button:not([disabled]),select,[tabindex="0"]')].filter((el) => !el.hidden);
  const first = items[0];
  const last = items.at(-1);
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
    e.preventDefault();
    first?.focus();
  }
});
document.addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
  else {
    dirty = true;
    requestWakeLock();
  }
});
addEventListener('pagehide', () => {
  stopSpeech();
  wakeLock?.release().catch(() => {});
});
app.addEventListener('contextmenu', (e) => e.preventDefault());
app.addEventListener('dragstart', (e) => e.preventDefault());
app.addEventListener('selectstart', (e) => e.preventDefault());
for (const type of ['gesturestart', 'gesturechange'])
  app.addEventListener(
    type,
    (e) => {
      if (e.cancelable && !state.modal) e.preventDefault();
    },
    { passive: false },
  );

// ---------------------------------------------------------------- the word shelf

const shelfDrags = new Map();
let shelfTapBlockedUntil = 0;
cards.addEventListener(
  'pointerdown',
  (e) => shelfDrags.set(e.pointerId, { x: e.clientX, y: e.clientY, scroll: cards.scrollLeft, dragged: false }),
  { passive: true },
);
cards.addEventListener(
  'pointermove',
  (e) => {
    const d = shelfDrags.get(e.pointerId);
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.hypot(dx, e.clientY - d.y) > 9) d.dragged = true;
    if (d.dragged) {
      cards.scrollLeft = d.scroll - dx;
      if (e.cancelable) e.preventDefault();
    }
  },
  { passive: false },
);
cards.addEventListener(
  'pointerup',
  (e) => {
    if (shelfDrags.get(e.pointerId)?.dragged) shelfTapBlockedUntil = performance.now() + 320;
    shelfDrags.delete(e.pointerId);
  },
  { passive: true },
);
cards.addEventListener('pointercancel', (e) => shelfDrags.delete(e.pointerId), { passive: true });
cards.addEventListener(
  'scroll',
  () => {
    for (const d of shelfDrags.values()) if (Math.abs(cards.scrollLeft - d.scroll) > 5) d.dragged = true;
  },
  { passive: true },
);
cards.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      cards.scrollLeft += e.deltaY;
      if (e.cancelable) e.preventDefault();
    }
  },
  { passive: false },
);
onTap($('scroll-left'), () => cards.scrollBy({ left: -350, behavior: settings.motion ? 'smooth' : 'instant' }));
onTap($('scroll-right'), () => cards.scrollBy({ left: 350, behavior: settings.motion ? 'smooth' : 'instant' }));

const seenKey = (id) => `${state.room}:${id}`;

function buildShelf() {
  cards.replaceChildren();
  cards.scrollLeft = 0;
  for (const word of words) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'word-card';
    card.dataset.word = word.id;
    card.setAttribute('aria-label', `Explore ${word.word.toLowerCase()}`);
    card.disabled = !state.ready;
    card.style.setProperty('--card-color', word.color);
    if (progress.seen.has(seenKey(word.id))) card.classList.add('seen');
    const picture = document.createElement('span');
    picture.className = 'picture';
    const placeholder = document.createElement('span');
    placeholder.className = 'placeholder';
    placeholder.textContent = word.word[0];
    placeholder.setAttribute('aria-hidden', 'true');
    picture.append(placeholder);
    const label = document.createElement('span');
    label.className = 'card-word';
    label.textContent = word.word;
    card.append(picture, label);
    card.insertAdjacentHTML('beforeend', '<svg class="card-seen" aria-hidden="true"><use href="#i-check"/></svg>');
    onTap(card, () => {
      if (performance.now() >= shelfTapBlockedUntil) openWord(word.id);
    });
    cards.append(card);
  }
  updateFound();
}

function updateFound() {
  const total = words.length;
  const found = foundIn(state.room);
  $('found-pill-text').textContent = `${found} of ${total}`;
  $('found-pill').classList.toggle('complete', found === total);
  $('found-pill').setAttribute('aria-label', `${found} of ${total} ${ROOMS[state.room].short} words found`);
  $('word-count').textContent = found ? `${total} things to discover · ${found} found` : `${total} things to discover`;
}

const nextRoomKey = () => ROOM_ORDER[(ROOM_ORDER.indexOf(state.room) + 1) % ROOM_ORDER.length];

function updateRoomText() {
  const room = ROOMS[state.room];
  const next = ROOMS[nextRoomKey()];
  $('room-title-word').textContent = room.title;
  $('room-intro').innerHTML = room.intro.replace('. ', '.<br>');
  $('room-tag-name').textContent = `THE ${room.label.toUpperCase()}`;
  $('room-number').textContent = room.number;
  $('room-switch').textContent = `${next.label} →`;
  $('room-switch').setAttribute('aria-label', `Go to ${next.label.toLowerCase()}`);
  $('room-ui').setAttribute('aria-label', `Explore the ${room.short}`);
  $('viewport').setAttribute('aria-label', `3D ${room.short}. Tap an object to hear its name.`);
  $('word-shelf').setAttribute('aria-label', `${room.label} words`);
  $('parent-room').textContent = `Return to ${room.short}`;
  $('back-room-label').textContent = `More ${room.short}`;
  for (const button of $('room-picker').querySelectorAll('[data-room]')) {
    const here = button.dataset.room === state.room;
    button.setAttribute('aria-pressed', String(here));
    button.disabled = here;
  }
  kit.canvas.setAttribute('role', 'img');
  kit.canvas.setAttribute('aria-label', `3D ${room.short}. Use the picture buttons or the arrow keys to pick a word.`);
}

// ---------------------------------------------------------------- control prompts

let hintWanted = false; // the keyboard or a controller has been used to pick things
const sourceKind = () => (input.source === 'touch' ? 'touch' : input.source === 'gamepad' ? 'pad' : 'keys');
const HINTS = {
  drag: {
    touch: 'Swipe to look around',
    keys: 'Drag to look around · arrow keys pick a thing',
    pad: 'Right stick looks around · D-pad picks a thing',
  },
  tip: {
    touch: 'Tap a thing.<br>Listen to its name.',
    keys: 'Click a thing.<br>Listen to its name.',
    pad: 'Pick a thing, press A.<br>Listen to its name.',
  },
  play: {
    touch: '',
    keys: 'Arrow keys pick a thing · Enter opens it · Esc for grown-ups',
    pad: 'D-pad picks a thing · A opens it · Start for grown-ups',
  },
};
function turnHint() {
  const kind = sourceKind();
  const short = ROOMS[state.room].short;
  if (state.current?.surface) {
    if (kind === 'pad') return `D-pad ← → picks a picture · A says it again · look in the ${short}`;
    if (kind === 'keys') return `Click or ← → picks a picture · Enter says it again · look in the ${short}`;
    return `Tap a picture. Look in the ${short}.`;
  }
  if (kind === 'pad') return 'D-pad ← → picks a picture · ↑ ↓ more · A says it again · right stick turns it';
  if (kind === 'keys') return 'Click or ← → picks a picture · ↑ ↓ more · Enter says it again · drag to turn it';
  return 'Tap a picture or a 3D object. Swipe to turn it.';
}
function updateHints() {
  const kind = sourceKind();
  $('drag-hint-text').textContent = HINTS.drag[kind];
  $('play-tip-text').innerHTML = HINTS.tip[kind];
  $('play-hint').textContent = HINTS.play[kind];
  $('play-hint').classList.toggle('on', !!HINTS.play[kind] && hintWanted);
  $('turn-hint').textContent = turnHint();
}
input.onSourceChange(updateHints);

// ---------------------------------------------------------------- camera

function layoutCamera() {
  dirty = true;
  const width = kit.size.width;
  const height = kit.size.height;
  if (!width || !height) return;
  const aspect = width / height;
  const wide = innerWidth > 800;
  const lessonView = state.mode === 'focus' && !state.current?.surface;
  const roomSpan = state.started ? Math.max(8.3, 11.9 / aspect) : Math.max(10.6, 13.3 / aspect);
  const span = lessonView ? Math.max(5.8, 8.1 / aspect) : roomSpan;
  // On wide screens the view slides right, clear of the caption on the left.
  const shift = wide ? (lessonView ? 1.9 : state.started ? 0 : 2.3) : 0;
  camera.left = (-span * aspect) / 2 - shift;
  camera.right = (span * aspect) / 2 - shift;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  if (lessonView) {
    lookTarget.set(0, 1.48, 0);
    camera.position.set(2.6, 5.15, 10.2);
  } else {
    lookTarget.set(0, 1.82, -0.2);
    camera.position.set(Math.sin(state.angle) * 16, 16 * Math.sin(state.elevation), Math.cos(state.angle) * 16);
  }
  camera.lookAt(lookTarget);
}
function orbitCamera() {
  dirty = true;
  camera.position.set(Math.sin(state.angle) * 16, 16 * Math.sin(state.elevation), Math.cos(state.angle) * 16);
  camera.lookAt(lookTarget);
}

// ---------------------------------------------------------------- pictures (word cards and lesson choices)

/**
 * Small still pictures of models for the DOM: rendered into a render target
 * (no tone mapping, sRGB, like the room's own colours), read back, and
 * turned into image URLs. One picture at a time, in order.
 */
const pictures = (() => {
  const shotScene = new THREE.Scene();
  const sky = new THREE.HemisphereLight('#fff8e7', '#c0cabb', 2.5);
  const key = new THREE.DirectionalLight('#fff7e7', 3);
  key.position.set(-3, 6, 5);
  shotScene.add(sky, key);
  const shotCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const clearColor = new THREE.Color();
  const targets = new Map();
  // WebGL reads rows bottom-up; WebGPU top-down.
  const flipRows = kit.backend !== 'webgpu';
  let queue = Promise.resolve();

  function targetFor(width, height) {
    const k = `${width}x${height}`;
    if (!targets.has(k)) targets.set(k, new THREE.RenderTarget(width, height, { depthBuffer: true }));
    return targets.get(k);
  }

  function encode(pixels, width, height) {
    // WebGPU pads each row to 256 bytes; WebGL packs them. The stride covers both.
    const stride = height > 1 ? (pixels.length - width * 4) / (height - 1) : width * 4;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    const out = image.data;
    for (let y = 0; y < height; y++) {
      const src = (flipRows ? height - 1 - y : y) * stride;
      const dst = y * width * 4;
      for (let x = 0; x < width * 4; x += 4) {
        let r = pixels[src + x];
        let g = pixels[src + x + 1];
        let b = pixels[src + x + 2];
        const a = pixels[src + x + 3];
        // Anti-aliased edges come out premultiplied; undo that so they do not darken.
        if (a > 0 && a < 255 && r <= a && g <= a && b <= a) {
          const k = 255 / a;
          r = Math.min(255, Math.round(r * k));
          g = Math.min(255, Math.round(g * k));
          b = Math.min(255, Math.round(b * k));
        }
        out[dst + x] = r;
        out[dst + x + 1] = g;
        out[dst + x + 2] = b;
        out[dst + x + 3] = a;
      }
    }
    ctx.putImageData(image, 0, 0);
    return new Promise((resolve) => {
      if (!canvas.toBlob) {
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
    });
  }

  async function shoot(object, shot) {
    const target = targetFor(shot.width, shot.height);
    sky.color.set(shot.sky);
    sky.groundColor.set(shot.ground);
    sky.intensity = shot.skyIntensity;
    key.color.set(shot.sun);
    key.intensity = shot.sunIntensity;
    shotScene.add(object);
    object.updateMatrixWorld(true);
    bounds.setFromObject(object).getCenter(center);
    shotCamera.left = -shot.halfWidth;
    shotCamera.right = shot.halfWidth;
    shotCamera.top = shot.halfHeight;
    shotCamera.bottom = -shot.halfHeight;
    shotCamera.position.set(shot.from[0], shot.from[1], shot.from[2]).add(center);
    shotCamera.lookAt(center);
    shotCamera.updateProjectionMatrix();
    shotCamera.updateMatrixWorld();
    const previousTarget = renderer.getRenderTarget();
    const previousOutput = renderer.getOutputRenderTarget();
    const previousToneMapping = renderer.toneMapping;
    renderer.getClearColor(clearColor);
    const previousAlpha = renderer.getClearAlpha();
    try {
      // As the output target, the picture gets the sRGB output transform, like the screen.
      renderer.setOutputRenderTarget(target);
      renderer.setRenderTarget(target);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0x000000, 0);
      renderer.render(shotScene, shotCamera);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setOutputRenderTarget(previousOutput);
      renderer.toneMapping = previousToneMapping;
      renderer.setClearColor(clearColor, previousAlpha);
      shotScene.remove(object);
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, shot.width, shot.height);
    return encode(pixels, shot.width, shot.height);
  }

  return {
    /** Resolves to an image URL (or rejects). Jobs run one after another. */
    shoot(object, shot) {
      const job = queue.then(() => shoot(object, shot));
      queue = job.then(
        () => wait(12),
        () => wait(12),
      );
      return job;
    },
  };
})();

// Twice the size they are shown at, so they stay crisp on sharp screens.
const CARD_SHOT = {
  width: 300,
  height: 280,
  halfWidth: 2.7 * (300 / 280),
  halfHeight: 2.7,
  from: [5, 4.5, 7],
  sky: '#fff8e7',
  ground: '#c0cabb',
  skyIntensity: 2.5,
  sun: '#fff7e7',
  sunIntensity: 3,
};
const CHOICE_SHOT = {
  width: 360,
  height: 300,
  halfWidth: 2.4,
  halfHeight: 2.0,
  from: [4.1, 4.6, 7.8],
  sky: '#fff7e6',
  ground: '#b6c2b3',
  skyIntensity: 2.8,
  sun: '#fff3de',
  sunIntensity: 3.2,
};

/** A copy of a room's model standing on y = 0, centred, its largest side `size`. */
function fittedRoomModel(room, id, size) {
  const copy = room.models.get(id).clone(true);
  copy.position.set(0, 0, 0);
  copy.rotation.set(0, 0, 0);
  copy.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(copy);
  const center = bounds.getCenter(new THREE.Vector3());
  const dims = bounds.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  copy.position.set(-center.x, -bounds.min.y, -center.z);
  holder.add(copy);
  holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 0.001));
  return holder;
}

const pictureCache = new Map();
function cardPicture(room, id) {
  const cacheKey = `card|${room.key}|${id}`;
  if (!pictureCache.has(cacheKey)) pictureCache.set(cacheKey, pictures.shoot(fittedRoomModel(room, id, 3.55), CARD_SHOT).catch(() => null));
  return pictureCache.get(cacheKey);
}
function lessonPicture(room, option) {
  const cacheKey = `choice|${room.key}|${room.lessons.key(option)}`;
  if (!pictureCache.has(cacheKey)) {
    let job;
    try {
      const view = room.lessons.get(option, 3.15);
      animateLesson(lessonParts(view), option, 3, true, true); // the action's end pose
      job = pictures.shoot(view, CHOICE_SHOT);
    } catch (err) {
      job = Promise.reject(err);
    }
    pictureCache.set(
      cacheKey,
      job.catch((err) => {
        console.warn('A lesson picture could not be made.', err);
        return null;
      }),
    );
  }
  return pictureCache.get(cacheKey);
}

let cardRun = 0;
async function makeCardPictures() {
  const run = ++cardRun;
  const room = currentRoom;
  for (const word of ROOMS[room.key].words) {
    if (run !== cardRun) return;
    const url = await cardPicture(room, word.id);
    if (run !== cardRun) return;
    const slot = cards.querySelector(`[data-word="${word.id}"] .picture`);
    if (!url || !slot) continue;
    const img = new Image();
    img.alt = '';
    img.width = 150;
    img.height = 140;
    img.draggable = false;
    img.src = url;
    slot.replaceChildren(img);
  }
}

// ---------------------------------------------------------------- play flow

function startPlay(greet = true) {
  if (state.started) return;
  state.started = true;
  $('start-play').hidden = true;
  $('play-tip').hidden = true;
  $('room-ui').hidden = true;
  $('word-shelf').hidden = true;
  app.classList.add('playing');
  updateSoundStatus();
  layoutCamera();
  if (greet) say(`Hello, Hudson. Tap something in the ${ROOMS[state.room].short}.`, true);
  requestWakeLock();
}

function switchRoom(key, speak = true) {
  if (!ROOMS[key] || key === state.room || state.mode !== 'room' || isHeld() || !state.ready) return;
  stopSpeech();
  cardRun++;
  hideCursor();
  let next;
  try {
    next = getRoom(key);
  } catch (err) {
    console.error('The room could not be built.', err);
    toast('That room could not be made on this device.', 5000);
    return;
  }
  currentRoom.root.visible = false;
  state.room = key;
  progress.room = key;
  saveProgress();
  currentRoom = next;
  currentRoom.root.visible = true;
  words = ROOMS[key].words;
  wordIndex = new Map(words.map((w) => [w.id, w]));
  state.angle = 0.54;
  state.elevation = 0.59;
  state.turn = 0;
  state.turnTarget = 0;
  buildShelf();
  updateRoomText();
  updateHints();
  layoutCamera();
  makeCardPictures();
  if (speak) say(`${ROOMS[key].label}.`, true);
}

function repeatWord() {
  if (!state.current || state.mode !== 'focus' || isHeld() || performance.now() - state.lastTapAt < 300) return;
  state.lastTapAt = performance.now();
  state.actionElapsed = 0;
  state.idleElapsed = 0;
  state.bumpAt = performance.now();
  say(state.activeOption?.lines || [state.current.word], true);
}

let celebrateTimer = 0;
function markSeen(id) {
  state.visitSeen.add(seenKey(id));
  cards.querySelector(`[data-word="${id}"]`)?.classList.add('seen');
  if (progress.seen.has(seenKey(id))) return;
  progress.seen.add(seenKey(id));
  saveProgress();
  sounds.found();
  updateFound();
  const total = words.length;
  if (foundIn(state.room) === total) {
    const short = ROOMS[state.room].short;
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
      sounds.celebrate();
      toast(`Hudson found every ${short} word. Well done!`, 6500);
      input.rumble(0.35, 220);
    }, 900);
  }
}

function openWord(id) {
  if (!state.ready || state.mode !== 'room' || isHeld()) return;
  const word = wordIndex.get(id);
  if (!word) return;
  startPlay(false);
  markSeen(id);
  stopSpeech();
  hideCursor();
  $('surface-label').hidden = true;
  state.current = word;
  state.lesson = word.surface ? null : new LessonTimer(60);
  state.surfaceElapsed = 0;
  state.page = 0;
  state.choice = 0;
  state.activeOption = null;
  state.pendingMore = false;
  state.autoMoreDone = false;
  state.mode = 'zoom';
  state.turn = 0;
  state.turnTarget = 0;
  state.bumpAt = -1e4;
  state.transition = {
    at: performance.now(),
    duration: settings.motion ? 620 : 0,
    target: currentRoom.centers.get(id).clone(),
    fromTarget: lookTarget.clone(),
  };
  cards.inert = true;
  input.rumble(0.2, 50);
  if (word.surface || !settings.motion) enterFocus();
}

function enterFocus() {
  state.mode = 'focus';
  state.transition = null;
  const surface = !!state.current.surface;
  const short = ROOMS[state.room].short;
  currentRoom.root.visible = surface;
  ground.visible = surface;
  stage.visible = !surface;
  stageChoices.clear();
  views = [];
  pedestal.material.color.set(state.current.color);
  $('room-ui').hidden = true;
  $('word-shelf').hidden = true;
  $('focus-ui').hidden = false;
  $('surface-label').hidden = true;
  app.classList.add('focus-mode');
  app.classList.toggle('surface-mode', surface);
  document.querySelector('.focus-eyebrow').textContent = state.current.word.toUpperCase();
  $('focus-stage').textContent = surface ? `LOOK IN THE ${short.toUpperCase()}` : 'ONE LITTLE MINUTE';
  $('time-note-text').innerHTML = surface
    ? 'Look around.<small>Go back at any time.</small>'
    : 'Take your time.<small>This lesson stays for one minute.</small>';
  document.querySelector('.progress-ring').hidden = surface;
  lastRing = '';
  $('time-ring').style.strokeDashoffset = '125.664';
  $('repeat-word').hidden = false;
  $('back-kitchen').hidden = !surface;
  $('safety-note').hidden = !SAFETY_NOTES[state.current.id];
  $('safety-note').textContent = SAFETY_NOTES[state.current.id] || '';
  $('turn-hint').textContent = turnHint();
  kit.canvas.style.opacity = '1';
  layoutCamera();
  showPage(0);
}

function showPage(index) {
  if (state.mode !== 'focus' || isHeld()) return;
  const pages = LESSONS[state.current.id];
  if (!pages?.[index]) return;
  stopSpeech();
  state.page = index;
  if (index === 1) {
    state.autoMoreDone = true;
    state.pendingMore = false;
  }
  const page = pages[index];
  $('lesson-page-title').textContent = page.title;
  [...$('lesson-tabs').children].forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
  stageChoices.clear();
  views = [];
  const list = $('lesson-choices');
  list.replaceChildren();
  const room = currentRoom;
  page.choices.forEach((option, i) => {
    if (!state.current.surface) {
      const holder = new THREE.Group();
      holder.userData.lessonChoice = i;
      const view = room.lessons.get(option, 3.2);
      holder.add(view);
      stageChoices.add(holder);
      views.push({ holder, view, option, parts: lessonParts(view), targetX: 0, targetZ: 0, targetScale: 1 });
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lesson-choice';
    button.dataset.choice = String(i);
    button.setAttribute('aria-label', option.label);
    button.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    lessonPicture(room, option).then((url) => {
      if (url) img.src = url;
    });
    const label = document.createElement('span');
    label.textContent = option.label;
    button.append(img, label);
    onTap(button, () => pickChoice(i));
    list.append(button);
  });
  pickChoice(0, true);
  dirty = true;
}

/**
 * Bring one picture to the middle and say it.
 * @param {boolean} initial  a new page: place the pictures at once
 * @param {boolean} force    skip the double-tap guard (keyboard and controller steps)
 */
function pickChoice(index, initial = false, force = initial) {
  if (state.mode !== 'focus' || isHeld()) return;
  const option = LESSONS[state.current.id]?.[state.page]?.choices[index];
  if (!option || (!force && performance.now() - state.lastTapAt < 250)) return;
  state.lastTapAt = performance.now();
  state.choice = index;
  state.activeOption = option;
  state.actionElapsed = 0;
  state.idleElapsed = 0;
  state.turn = 0;
  state.turnTarget = 0;
  [...$('lesson-choices').children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  let side = 0;
  views.forEach((v, i) => {
    const active = i === index;
    v.targetX = active ? 0 : side++ === 0 ? -2.65 : 2.65;
    v.targetScale = active ? 1 : 0.46;
    v.targetZ = active ? 0 : -0.55;
    if (initial || !settings.motion) {
      v.holder.position.set(v.targetX, 0, v.targetZ);
      v.holder.scale.setScalar(v.targetScale);
    }
    v.holder.rotation.set(0, 0, 0);
  });
  if (state.current.surface) flashModel(currentRoom.models.get(option.model) || currentRoom.models.get(state.current.id));
  setFocusWord(option.label);
  say(option.lines, true);
  dirty = true;
}

function backToRoom(force = false) {
  if (!force && (state.mode !== 'focus' || (!state.current?.surface && !state.lesson?.ready))) return;
  if (!state.ready) return;
  stopSpeech();
  state.mode = 'room';
  state.current = null;
  state.activeOption = null;
  state.lesson = null;
  state.transition = null;
  currentRoom.root.visible = true;
  ground.visible = true;
  stage.visible = false;
  stageChoices.clear();
  views = [];
  $('room-ui').hidden = state.started;
  $('word-shelf').hidden = state.started;
  $('focus-ui').hidden = true;
  app.classList.remove('focus-mode', 'surface-mode');
  if (state.started) app.classList.add('playing');
  cards.inert = false;
  kit.canvas.style.opacity = '1';
  camera.zoom = 1;
  layoutCamera();
  updateHints();
  if (!force) say(`What can you find in the ${ROOMS[state.room].short}?`, true);
}

/** Light up a room model for a moment (the surface lessons point at things in the room). */
const glowMaterials = new WeakMap();
let glowing = [];
let glowTimer = 0;
function clearGlow() {
  for (const [mesh, original] of glowing) mesh.material = original;
  glowing = [];
  dirty = true;
}
function flashModel(model) {
  clearTimeout(glowTimer);
  clearGlow();
  if (!model) return;
  model.traverse((o) => {
    if (!o.isMesh || !o.material?.emissive) return;
    let glow = glowMaterials.get(o.material);
    if (!glow) {
      glow = o.material.clone();
      glow.emissive.set('#82926d');
      glow.emissiveIntensity = 0.2;
      glowMaterials.set(o.material, glow); // made once per material, so no new pipelines on later taps
    }
    glowing.push([o, o.material]);
    o.material = glow;
  });
  dirty = true;
  glowTimer = setTimeout(clearGlow, 650);
}

// ---------------------------------------------------------------- lesson clock

let lastRing = '';
function tickLesson(dt) {
  if (state.mode !== 'focus' || isHeld()) return;
  state.actionElapsed += dt;
  state.idleElapsed += dt;
  const events = state.lesson ? state.lesson.advance(dt) : [];
  const before = state.surfaceElapsed;
  state.surfaceElapsed += dt;
  if (events.includes('sentence') || (!state.lesson && before < 30 && state.surfaceElapsed >= 30))
    state.pendingMore = !state.autoMoreDone;
  // "More" opens by itself after 30 seconds, once the voice has finished and the child is not busy.
  if (state.pendingMore && !speaker.busy && state.idleElapsed > 2) {
    state.pendingMore = false;
    state.autoMoreDone = true;
    showPage(1);
  }
  if (state.lesson) {
    const offset = String(Math.round(125.664 * (1 - state.lesson.progress)));
    if (offset !== lastRing) {
      lastRing = offset;
      $('time-ring').style.strokeDashoffset = offset;
    }
  }
  if (events.includes('ready')) {
    $('time-note-text').innerHTML = `More to find.<small>Stay here, or choose more ${ROOMS[state.room].short}.</small>`;
    $('back-kitchen').hidden = false;
    $('focus-stage').textContent = 'KEEP LOOKING OR GO BACK';
  }
}

// ---------------------------------------------------------------- pointer, keyboard and controller

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hitsAt(x, y, objects) {
  ndc.set((x / kit.size.width) * 2 - 1, -(y / kit.size.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(objects, true);
}
function wordAt(x, y) {
  for (const hit of hitsAt(x, y, currentRoom.root.children)) {
    let o = hit.object;
    while (o && !o.userData.wordId) o = o.parent;
    if (o && wordIndex.has(o.userData.wordId)) return { id: o.userData.wordId, distance: hit.distance };
  }
  return null;
}
/** The thing under a finger; a small thing close by wins over the wall or floor behind it. */
function pickWord(x, y) {
  const hit = wordAt(x, y);
  if (hit && !wordIndex.get(hit.id).surface) return hit.id;
  for (const [dx, dy] of [
    [0, -13],
    [-13, 0],
    [13, 0],
    [0, 13],
    [-20, -12],
    [20, -12],
  ]) {
    const near = wordAt(x + dx, y + dy);
    if (near && !wordIndex.get(near.id).surface && (!hit || near.distance <= hit.distance + 0.6)) return near.id;
  }
  return hit?.id;
}

function tapAt(x, y) {
  hideCursor();
  if (state.mode === 'room') {
    const id = pickWord(x, y);
    if (id) openWord(id);
  } else if (state.mode === 'focus') {
    if (state.current?.surface) {
      repeatWord();
      return;
    }
    let choice = null;
    for (const hit of hitsAt(x, y, stageChoices.children)) {
      let o = hit.object;
      while (o && o.userData.lessonChoice === undefined) o = o.parent;
      if (o) {
        choice = o.userData.lessonChoice;
        break;
      }
    }
    if (choice !== null) pickChoice(choice);
    else repeatWord();
  }
}

// A palm resting on a tablet should not open things: remember how big the last touch was.
let palmDown = false;
kit.canvas.addEventListener(
  'pointerdown',
  (e) => (palmDown = e.pointerType === 'touch' && Math.max(e.width || 0, e.height || 0) > 58),
  { passive: true },
);

let gesture = null;
function handlePointer(now) {
  const p = input.pointer;
  if (p.justDown) {
    gesture =
      !isHeld() && state.ready && (state.mode === 'room' || state.mode === 'focus')
        ? { x: p.x, y: p.y, at: now, dragged: false, ignore: palmDown }
        : null;
  }
  if (gesture && p.down && !gesture.dragged && Math.hypot(p.x - gesture.x, p.y - gesture.y) > 13) gesture.dragged = true;
  if (p.justUp && gesture) {
    const g = gesture;
    gesture = null;
    if (!g.ignore && !isHeld() && !g.dragged && now - g.at < 720 && Math.hypot(p.x - g.x, p.y - g.y) < 13) tapAt(p.x, p.y);
  }
}

function handleLook() {
  const look = input.look('look');
  const zoom = input.zoom();
  if (isHeld() || !state.ready) return;
  // Everything below is in "pixels of drag", the unit the original swipes were tuned in.
  let sx = 0;
  let sy = 0;
  if (input.source === 'gamepad') {
    sx = look.x * 100;
    sy = look.y * 100;
  } else if (gesture?.dragged && !gesture.ignore) {
    const perPixel = input.pointer.type === 'touch' ? TOUCH_LOOK : MOUSE_LOOK;
    sx = look.x / perPixel;
    sy = look.y / perPixel;
  }
  if (state.mode === 'room') {
    if (sx || sy || zoom) {
      state.angle = clamp(state.angle - sx * 0.003 - zoom * 0.1, 0.16, 0.98);
      state.elevation = clamp(state.elevation + sy * 0.0015, 0.4, 0.74);
      orbitCamera();
    }
  } else if (state.mode === 'focus') {
    state.turnTarget += sx * 0.012 + sy * 0.002 - zoom * 0.6;
  }
}

/** A direction from the move action, with key-repeat: first press, then again while held. */
let navDir = null;
let navNext = 0;
function navDirection(now) {
  const v = input.vector('move');
  let dir = null;
  if (Math.hypot(v.x, v.y) > 0.5) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (!dir) {
    navDir = null;
    return null;
  }
  if (dir !== navDir) {
    navDir = dir;
    navNext = now + 420;
    return dir;
  }
  if (now >= navNext) {
    navNext = now + 170;
    return dir;
  }
  return null;
}
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

// ---- the room cursor (keyboard and controller)

const cursorEl = $('pick-cursor');
const cursorWord = $('pick-cursor-word');
const projected = new THREE.Vector3();
const cursorPos = { x: 0, y: 0 };
const candidatePos = { x: 0, y: 0 };
let cursorId = null;
let cursorX = NaN;
let cursorY = NaN;
function screenOf(id, out) {
  projected.copy(currentRoom.centers.get(id)).project(camera);
  out.x = ((projected.x + 1) / 2) * kit.size.width;
  out.y = ((1 - projected.y) / 2) * kit.size.height;
  return out;
}
function hideCursor() {
  cursorId = null;
  cursorEl.hidden = true;
}
/** Move the cursor to the nearest thing in a screen direction (or the middle thing when none is picked). */
function moveCursor(dir) {
  if (state.mode !== 'room' || !currentRoom) return;
  const w = kit.size.width;
  const h = kit.size.height;
  const from = cursorId ? screenOf(cursorId, cursorPos) : { x: w / 2, y: h / 2 };
  const d = cursorId ? DIRS[dir] : null;
  let best = null;
  let bestScore = Infinity;
  for (const word of words) {
    if (word.id === cursorId) continue;
    const p = screenOf(word.id, candidatePos);
    if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    let score;
    if (d) {
      const along = dx * d[0] + dy * d[1];
      if (along < 6) continue;
      score = along + Math.abs(dx * d[1] - dy * d[0]) * 2.2;
    } else score = Math.hypot(dx, dy);
    if (word.surface) score += 90; // things first; walls and floors are still reachable
    if (score < bestScore) {
      bestScore = score;
      best = word.id;
    }
  }
  if (!best) return;
  cursorId = best;
  cursorX = cursorY = NaN;
  cursorWord.textContent = wordIndex.get(best).word;
  cursorEl.hidden = false;
}
function updateCursor() {
  if (!cursorId) return;
  if (state.mode !== 'room' || isHeld()) {
    if (!cursorEl.hidden) cursorEl.hidden = true;
    return;
  }
  if (cursorEl.hidden) cursorEl.hidden = false;
  screenOf(cursorId, cursorPos);
  if (Math.abs(cursorPos.x - cursorX) > 0.5 || Math.abs(cursorPos.y - cursorY) > 0.5) {
    cursorX = cursorPos.x;
    cursorY = cursorPos.y;
    cursorEl.style.transform = `translate(${cursorX.toFixed(1)}px, ${cursorY.toFixed(1)}px) translate(-50%, -39px)`;
  }
}

// ---- menus with a controller or the arrow keys

function menuRoot() {
  if (state.modal === 'pin') return $('pin-dialog');
  if (state.modal === 'parent') return $('parent-dialog');
  if (state.guard) return $('resume-guard');
  return null;
}
function menuItems(root) {
  return [...root.querySelectorAll('button, select')].filter((el) => !el.disabled && !el.hidden && el.offsetParent !== null);
}
function padFocus(el) {
  document.querySelector('.pad-focus')?.classList.remove('pad-focus');
  el.focus();
  el.classList.add('pad-focus');
  el.scrollIntoView?.({ block: 'nearest' });
}
function moveMenuFocus(dir) {
  const root = menuRoot();
  if (!root) return;
  const items = menuItems(root);
  if (!items.length) return;
  const current = items.includes(document.activeElement) ? document.activeElement : null;
  if (!current) {
    padFocus(items.find((el) => el.classList.contains('primary-button')) || items[0]);
    return;
  }
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const d = DIRS[dir];
  let next = null;
  let best = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const along = dx * d[0] + dy * d[1];
    if (along < 4) continue;
    const score = along + Math.abs(dx * d[1] - dy * d[0]) * 2;
    if (score < best) {
      best = score;
      next = el;
    }
  }
  if (!next) {
    const i = items.indexOf(current);
    next = dir === 'down' || dir === 'right' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
  }
  padFocus(next);
}
function activateFocused() {
  const root = menuRoot();
  const el = document.activeElement;
  if (!root || !root.contains(el) || el === root) {
    moveMenuFocus('down');
    return;
  }
  if (el.tagName === 'SELECT') {
    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else el.click();
}

function handleMenuInput(now) {
  if (state.modal === 'parent') {
    const mv = input.vector('move');
    if (mv.x || mv.y || input.down('select')) state.parentActivity = now; // a controller keeps the corner open too
  }
  if (state.modal === 'pin') {
    for (let d = 0; d <= 9; d++) if (input.pressed(`digit${d}`)) pinKey(String(d));
    if (input.pressed('pinDelete')) pinKey('delete');
  }
  if (input.pressed('menu') || input.pressed('back')) {
    if (state.modal) closeModal();
    else if (state.guard) openPin();
    return;
  }
  const dir = navDirection(now);
  if (dir) moveMenuFocus(dir);
  // Enter and Space on a focused button are the button's own click; a controller's A needs help.
  if (input.pressed('select') && input.source === 'gamepad') activateFocused();
}

function handleRoomInput(now) {
  const dir = navDirection(now);
  if (dir) {
    hintWanted = true;
    moveCursor(dir);
    updateHints();
  }
  if (input.pressed('select')) {
    hintWanted = true;
    if (cursorId) openWord(cursorId);
    else if (!state.started) startPlay(true);
    else moveCursor(null);
    updateHints();
  }
  if (input.pressed('back')) hideCursor();
  if (input.pressed('room') && !state.started) switchRoom(nextRoomKey());
}

function handleFocusInput(now) {
  const dir = navDirection(now);
  if (dir === 'left' || dir === 'right') {
    const count = LESSONS[state.current.id]?.[state.page]?.choices.length || 3;
    pickChoice((state.choice + (dir === 'right' ? 1 : count - 1)) % count, false, true);
  } else if (dir === 'up' || dir === 'down' || input.pressed('page')) showPage(state.page ? 0 : 1);
  if (input.pressed('select')) repeatWord();
  if (input.pressed('back')) backToRoom(false);
}

function handleInput(now) {
  if (state.modal || state.guard) {
    gesture = null;
    handleMenuInput(now);
    return;
  }
  if (input.pressed('menu')) {
    openPin();
    return;
  }
  if (!state.ready || document.hidden) return;
  handlePointer(now);
  handleLook();
  if (state.mode === 'room') handleRoomInput(now);
  else if (state.mode === 'focus') handleFocusInput(now);
}

// ---------------------------------------------------------------- the frame

let lastPixelRatio = 0;
function frame(dt) {
  const now = performance.now();
  // A new pixel ratio (quality or dynamic resolution) clears the canvas: draw again.
  if (renderer.getPixelRatio() !== lastPixelRatio) {
    lastPixelRatio = renderer.getPixelRatio();
    dirty = true;
  }
  handleInput(now);
  tickLesson(dt);
  if (state.modal === 'parent' && now - state.parentActivity > 90000) closeModal();
  if (document.hidden) return;

  if (state.mode === 'zoom' && state.transition && !isHeld()) {
    const t = clamp((now - state.transition.at) / Math.max(state.transition.duration, 1), 0, 1);
    const eased = t * t * (3 - 2 * t);
    lookTarget.lerpVectors(state.transition.fromTarget, state.transition.target, eased * 0.64);
    camera.zoom = 1 + eased * 0.6;
    camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);
    kit.canvas.style.opacity = String(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    dirty = true;
    if (t >= 1) enterFocus();
  }

  if (state.mode === 'focus' && !isHeld()) {
    state.turn += (state.turnTarget - state.turn) * Math.min(1, dt * 8);
    const k = settings.motion ? Math.min(1, dt * 9) : 1;
    // Saying it again gives the picture a little hop.
    const since = now - state.bumpAt;
    const hop = settings.motion && since < 420 ? Math.sin((since / 420) * Math.PI) * 0.16 : 0;
    views.forEach((v, i) => {
      const active = i === state.choice;
      v.holder.position.x += (v.targetX - v.holder.position.x) * k;
      v.holder.position.z += (v.targetZ - v.holder.position.z) * k;
      v.holder.position.y = active ? hop : 0;
      v.holder.scale.setScalar(v.holder.scale.x + (v.targetScale - v.holder.scale.x) * k);
      v.holder.rotation.y = active ? state.turn : 0;
      animateLesson(v.parts, v.option, state.actionElapsed, settings.motion, !active);
    });
    dirty = true;
  }

  updateCursor();
  if (dirty) {
    renderer.render(scene, camera);
    dirty = false;
  }
}

// ---------------------------------------------------------------- start

function showFatal(err) {
  console.error('Room startup failed:', err);
  kit.loading.done(); // the loop never started, so lift the loading card by hand
  $('fatal').hidden = false;
  $('fatal-detail').textContent = 'The 3D picture could not start. Open this page again, or try another browser.';
}

try {
  kit.loading.progress(0.75, `Making a little ${ROOMS[state.room].short}…`);
  currentRoom = getRoom(state.room);
  currentRoom.root.visible = true;
  state.ready = true;
  kit.onResize(layoutCamera);
  updateRoomText();
  buildShelf();
  updateSoundStatus();
  updateHints();
  layoutCamera();
  try {
    await renderer.compileAsync(scene, camera); // no shader hitch on the first frames
  } catch {
    /* compiling on the first frame instead is fine */
  }
  kit.start(frame);
  makeCardPictures();
} catch (err) {
  showFatal(err);
}
