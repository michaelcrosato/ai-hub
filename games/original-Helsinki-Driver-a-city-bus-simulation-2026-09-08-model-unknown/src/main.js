import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { World } from './world.js';
import { Simulation, DIFFICULTIES } from './simulation.js';
import { Graphics } from './graphics.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { clamp, damp } from './math.js';

const $ = (id) => document.getElementById(id);
const PACKS = [
  { id: 'training', file: '../data/t1-bulevardi.json', title: 'T1 · Bulevardi familiarisation' },
  { id: 'harbour', file: '../data/t2-harbour.json', title: 'T2 · South Harbour evening loop' },
];
const WEATHERS = [['dry', 'Dry · partly cloudy'], ['damp', 'After rain'], ['rain', 'Rain · reduced grip'], ['evening', 'Evening · low sun']];

/** Every gameplay input is an action: keyboard and mouse, controller and touch. */
const ACTIONS = {
  steer: { type: 'axis', keys: { pos: ['KeyD', 'ArrowRight'], neg: ['KeyA', 'ArrowLeft'] }, gamepad: 'leftStickX' },
  throttle: { type: 'axis', keys: { pos: ['KeyW', 'ArrowUp'] }, gamepad: { pos: 'RT' } },
  brake: { type: 'axis', keys: { pos: ['KeyS', 'ArrowDown'] }, gamepad: { pos: 'LT' } },
  emergency: { keys: ['Space'] },
  // Touch: one thumb stick drives (left/right steers, up is throttle, down is brake).
  drive: { type: 'vector', clamp: false, gamepad: [], touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  engine: { keys: ['KeyE'], gamepad: ['Up'] },
  belt: { keys: ['KeyB'], gamepad: ['Down'] },
  gear: { keys: ['KeyN'] },
  gearPad: { gamepad: ['X'] }, // tap: drive/neutral, hold: reverse
  reverse: { keys: ['KeyX'] },
  parking: { keys: ['KeyP'], gamepad: ['Y'] },
  front: { keys: ['KeyF'], gamepad: ['A'] },
  rear: { keys: ['KeyG'], gamepad: ['B'] },
  kneel: { keys: ['KeyK'], gamepad: ['Left'] },
  ramp: { keys: ['KeyR'], gamepad: ['Right'] },
  indicatorLeft: { keys: ['KeyZ'], gamepad: ['LB'] },
  indicatorRight: { keys: ['KeyC'], gamepad: ['RB'] },
  horn: { keys: ['KeyH'], gamepad: ['LS'] },
  lights: { keys: ['KeyL'] },
  wipers: { keys: ['KeyU'] },
  mirror: { keys: ['KeyQ'], gamepad: ['RS'] },
  announce: { keys: ['KeyT'] },
  camera: { keys: ['KeyV'], gamepad: ['Back'] },
  map: { keys: ['KeyM'] },
  pause: { keys: ['Escape'], gamepad: ['Start'] },
  help: { keys: ['F2'] },
  reply1: { keys: ['Digit1', 'Numpad1'] },
  reply2: { keys: ['Digit2', 'Numpad2'] },
  reply3: { keys: ['Digit3', 'Numpad3'] },
  // Menus: arrows or D-pad / left stick move focus, A confirms, B goes back.
  navKeys: { type: 'vector', keys: 'arrows', gamepad: [] },
  navPad: { type: 'vector', gamepad: 'leftStick+dpad' },
  confirm: { gamepad: ['A'] },
  back: { gamepad: ['B'] },
};
const GAME_ACTIONS = [['engine', 'engine'], ['belt', 'belt'], ['gear', 'gear'], ['reverse', 'reverse'], ['parking', 'parking'], ['front', 'front'], ['rear', 'rear'], ['kneel', 'kneel'], ['ramp', 'ramp'], ['indicatorLeft', 'indicator-left'], ['indicatorRight', 'indicator-right'], ['horn', 'horn'], ['lights', 'lights'], ['wipers', 'wipers'], ['mirror', 'mirror'], ['announce', 'announce'], ['camera', 'camera'], ['map', 'map'], ['reply1', 'reply-0'], ['reply2', 'reply-1'], ['reply3', 'reply-2']];

function stored(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function forget(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } }
function exportJSON(data) { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'helsinki-driver-shift.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const kit = await boot({ title: 'Helsinki Driver', canvas: $('scene'), gear: 'none', holdLoading: true, touch: { hint: false }, accent: '#8ad5d6', background: '#13232c', input: ACTIONS });
const input = kit.input;

const params = new URLSearchParams(location.search), prefs = stored('helsinki-preferences', {});
let pack = PACKS.find((p) => p.id === (params.get('pack') || prefs.pack)) || PACKS[0];
const worlds = new Map();
async function loadWorld(p) {
  if (worlds.has(p.id)) return worlds.get(p.id);
  const r = await fetch(new URL(p.file, import.meta.url)); if (!r.ok) throw new Error(`${p.file}: HTTP ${r.status}`);
  const w = new World(await r.json()); worlds.set(p.id, w); return w;
}

// ---- menu choices
for (const item of PACKS) { const o = document.createElement('option'); o.value = item.id; o.textContent = item.title; $('scenario').append(o); }
for (const [id, label] of WEATHERS) { const o = document.createElement('option'); o.value = id; o.textContent = label; $('weather').append(o); }
for (const d of Object.values(DIFFICULTIES)) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.label; $('difficulty').append(o); }
$('scenario').value = pack.id;
$('weather').value = WEATHERS.some(([id]) => id === (params.get('weather') || prefs.weather)) ? params.get('weather') || prefs.weather : 'dry';
$('difficulty').value = DIFFICULTIES[params.get('difficulty') || prefs.difficulty] ? params.get('difficulty') || prefs.difficulty : 'standard';
$('engine-label').textContent = `${kit.backendLabel} · three.js r${THREE.REVISION}`;

kit.loading.progress(0.65, 'Laying out the streets…');
let world;
try { world = await loadWorld(pack); }
catch (e) {
  // A saved preference for a pack that cannot load falls back to T1; if T1 fails too, say so instead of a frozen card.
  console.error(e);
  if (pack === PACKS[0]) { failBoot(e); throw e; }
  pack = PACKS[0]; $('scenario').value = pack.id;
  try { world = await loadWorld(pack); } catch (e2) { failBoot(e2); throw e2; }
}
function failBoot(e) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#13232c;color:#eef4f4;font:14px/1.6 system-ui,sans-serif;padding:24px;text-align:center';
  box.textContent = `Helsinki Driver could not load its route data (${e?.message || e}). Reload the page to try again.`;
  document.body.append(box);
}
kit.loading.progress(0.75, 'Painting façades and the bus…'); await pause(30);
const graphics = new Graphics(kit, world, { weather: $('weather').value, mirrors: prefs.mirrors });
const audio = new AudioSystem(); audio.enabled = prefs.sound ?? true; audio.voice = !!prefs.voice;
let sim = menuSimulation(), inMenu = true, wasRunning = false, accumulator = 0, autosave = 0;
function menuSimulation() { return new Simulation(world, { weather: $('weather').value, difficulty: $('difficulty').value, memory: stored('helsinki-regulars', {}) }); }

const saveKey = () => `helsinki-save-${pack.id}`, bestKey = () => `${pack.id}:${sim.difficulty.id}`;
function savePrefs() { store('helsinki-preferences', { pack: pack.id, weather: $('weather').value, difficulty: $('difficulty').value, mirrors: graphics.mirrors, sound: audio.enabled, voice: audio.voice }); }
function save(manual = false) {
  if (!sim.started || sim.completed) { if (manual) ui.toast('Nothing to save: the shift has ended.'); return; }
  const ok = store(saveKey(), sim.snapshot()); store('helsinki-regulars', sim.memory);
  if (manual) ui.toast(ok ? 'Position saved on this device.' : 'Storage is unavailable. Export a report instead.');
}
function refreshMenuCard() {
  const snap = stored(saveKey());
  $('resume').classList.toggle('hidden', !snap);
  if (snap) $('resume').textContent = `Continue saved shift · stop ${Math.min((snap.stopIndex ?? 0) + 1, world.stops.length)} of ${world.stops.length}`;
  const bests = stored('helsinki-best', {}), lines = Object.values(DIFFICULTIES).map((d) => [d, bests[`${pack.id}:${d.id}`]]).filter(([, b]) => b);
  $('menu-best').textContent = lines.length ? `Best: ${lines.map(([d, b]) => `${d.label} ${b.overall}`).join(' · ')}` : 'No completed shifts on this route yet.';
}
/** Best score per route and shift type, recorded once per finished (non-practice) shift. */
function recordBest() {
  const bests = stored('helsinki-best', {}), key = bestKey(), prev = bests[key];
  if (sim.bestRecorded) return sim.bestRecorded;
  const finished = sim.completed && sim.endReason !== 'pedestrian' && !sim.practice;
  let result = prev ? { ...prev, isNew: false } : null;
  if (finished && (!prev || sim.overall > prev.overall || (sim.overall === prev.overall && sim.time < prev.time))) {
    bests[key] = { overall: sim.overall, time: Math.round(sim.time), date: new Date().toISOString().slice(0, 10) }; store('helsinki-best', bests); result = { ...bests[key], isNew: true };
  }
  if (sim.completed) { sim.bestRecorded = result; forget(saveKey()); }
  return result;
}
function showResults() { const best = recordBest(); ui.results(sim, best); }

const callbacks = {
  action,
  hold: () => { wasRunning = !sim.paused; sim.pause(true); },
  unhold: () => { if (wasRunning && !inMenu && !sim.completed) sim.pause(false); wasRunning = false; input.settle(); },
  modal: (open) => kit.touch?.suspend(open, 'modal'),
  save: () => save(true),
  export: () => exportJSON(sim.report()),
  results: () => showResults(),
  mirrors: () => graphics.mirrors,
  setMirrors: (v) => { graphics.mirrors = v; savePrefs(); },
  setSound: (v) => { audio.enabled = v; savePrefs(); },
  setVoice: (v) => { audio.voice = v; savePrefs(); },
  settings: () => kit.menu.open(),
  quit: () => quitToMenu(),
  again: () => begin(false),
  nextRoute: async () => { const i = PACKS.indexOf(pack); await switchPack(PACKS[(i + 1) % PACKS.length].id); begin(false); },
  cab: (name) => { sim.act(name); return name === 'lights' ? sim.bus.lights : name === 'wipers' ? sim.bus.wipers : name === 'reverse' ? sim.bus.gear === 'R' : name === 'hazards' ? sim.bus.hazards : true; },
};
const ui = new UI(world, callbacks);
ui.setSource(input.source); input.onSourceChange((s) => ui.setSource(s));
window.__HELSINKI__ = { get world() { return world; }, get sim() { return sim; }, graphics, ui, audio, kit };

function action(a) {
  if (a === 'help') { ui.help(input.source); return; }
  if (a === 'data') { ui.data(); return; }
  if (a === 'settings') { kit.menu.open(); return; }
  if (a === 'pause') {
    if (ui.modalOpen) ui.closeModal();
    else if (!inMenu) { if (sim.completed) showResults(); else ui.pause(sim, audio, { best: stored('helsinki-best', {})[bestKey()] }); }
    return;
  }
  if (inMenu || sim.completed) return;
  if (a === 'map') { if (ui.mapExpanded) ui.closeModal(); else ui.map(sim); return; }
  if (ui.modalOpen) return;
  if (a === 'camera') { graphics.cycleCamera(); return; }
  if (a.startsWith('reply-')) sim.act('reply', Number(a.slice(-1))); else sim.act(a);
}

async function switchPack(id) {
  const next = PACKS.find((p) => p.id === id) || PACKS[0]; if (next === pack && worlds.has(id)) return;
  $('scenario').disabled = true;
  try {
    const w = await loadWorld(next); pack = next; world = w;
    graphics.setWorld(world); ui.setWorld(world);
    if (world.meta.suggestedWeather && WEATHERS.some(([wid]) => wid === world.meta.suggestedWeather)) { $('weather').value = world.meta.suggestedWeather; graphics.setWeather($('weather').value); }
    sim = menuSimulation(); $('scenario').value = pack.id; refreshMenuCard(); savePrefs();
  } catch (e) { console.error(e); ui.toast(`Could not load that route: ${e.message}`); $('scenario').value = pack.id; }
  finally { $('scenario').disabled = false; }
}
function startHint() {
  const s = input.source;
  return s === 'gamepad' ? 'power D↑, belt D↓, then front door A' : s === 'touch' ? 'tap Power, Belt, then Front door' : 'power E, belt B, then front door F';
}
function begin(resume = false) {
  audio.start().catch(() => {}); // inside the click or key press: browsers only allow audio after a gesture
  let snap = null;
  if (resume) { snap = stored(saveKey()); if (!snap) { ui.toast('No saved shift for this route.'); refreshMenuCard(); return; } }
  const weather = snap?.weather && WEATHERS.some(([id]) => id === snap.weather) ? snap.weather : $('weather').value;
  const difficulty = DIFFICULTIES[snap?.difficulty] ? snap.difficulty : $('difficulty').value;
  const next = new Simulation(world, { weather, difficulty, memory: stored('helsinki-regulars', {}) });
  if (snap) { try { next.restore(snap); next.pause(false); } catch (e) { ui.toast(e.message); forget(saveKey()); refreshMenuCard(); return; } }
  else next.start();
  sim = next; accumulator = 0; wasRunning = false; autosave = sim.time;
  $('weather').value = weather; $('difficulty').value = difficulty; graphics.setWeather(weather); savePrefs();
  graphics.resetActors(); graphics.setMode('cockpit');
  ui.closeModal(false); inMenu = false; ui.begin(); kit.touch?.suspend(false, 'menu'); input.settle();
  if (!resume) ui.toast(`Begin at ${world.stops[0].name}: ${startHint()}. Keep the parking brake applied while boarding.`);
}
function quitToMenu() {
  if (!sim.completed) save(false);
  store('helsinki-regulars', sim.memory);
  ui.closeModal(false); inMenu = true; sim = menuSimulation(); graphics.resetActors(); graphics.setMode('cockpit');
  ui.showMenu(); kit.touch?.suspend(true, 'menu'); refreshMenuCard(); input.settle();
}

$('begin').onclick = () => begin(false); $('resume').onclick = () => begin(true);
$('scenario').onchange = (e) => switchPack(e.target.value);
$('weather').onchange = (e) => { graphics.setWeather(e.target.value); sim.options.weather = e.target.value; savePrefs(); };
$('difficulty').onchange = () => { sim = menuSimulation(); graphics.resetActors(); savePrefs(); };
$('fullscreen').onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => ui.toast('Fullscreen is unavailable in this browser.')); };
const autoPause = () => { if (!inMenu && sim.started && !sim.paused && !sim.completed && !ui.modalOpen) ui.pause(sim, audio, { best: stored('helsinki-best', {})[bestKey()] }); };
addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) { autoPause(); if (!inMenu) save(false); } });
addEventListener('beforeunload', () => { if (sim.started) { store('helsinki-regulars', sim.memory); if (!inMenu) save(false); } });
kit.onPause((paused) => audio.setSuspended(paused));
// A shift begun from a controller is not a user gesture, so the browser keeps audio locked; the next key, click or tap unlocks it.
const unlockAudio = () => { const c = audio.context; if (c && c.state === 'suspended' && !audio.suspended) c.resume().catch(() => {}); };
addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);
// Left-handed touch layout (stick on the right): the controls bar moves to the left.
const applyHand = () => document.documentElement.classList.toggle('hd-lefty', kit.settings.get().touchHand === 'left');
applyHand(); kit.settings.subscribe(applyHand);

// ---- per-frame input
const navState = { dir: '', held: 0, next: 0 };
let gearHold = 0, gearFired = false, lastTap = -1, stickShown = true;
function navStep(dt) {
  const k = input.vector('navKeys'), p = input.vector('navPad'), v = Math.hypot(k.x, k.y) > Math.hypot(p.x, p.y) ? k : p;
  let dx = 0, dy = 0; if (Math.max(Math.abs(v.x), Math.abs(v.y)) > 0.55) { if (Math.abs(v.x) > Math.abs(v.y)) dx = Math.sign(v.x); else dy = -Math.sign(v.y); }
  const dir = dx || dy ? `${dx},${dy}` : '';
  if (!dir) { navState.dir = ''; return null; }
  if (dir !== navState.dir) { navState.dir = dir; navState.held = 0; navState.next = 0.42; return [dx, dy]; }
  navState.held += dt; if (navState.held >= navState.next) { navState.next += 0.14; return [dx, dy]; }
  return null;
}
function handleInput(dt) {
  if (input.pressed('pause')) { action('pause'); return; }
  if (input.pressed('help')) { action('help'); return; }
  const step = navStep(dt);
  if (inMenu || ui.modalOpen) {
    if (step) ui.navMove(step[0], step[1]);
    if (input.pressed('confirm')) ui.navConfirm();
    if (input.pressed('back') && ui.modalOpen) ui.closeModal();
    return;
  }
  // Looking around: mouse drag (left or right button), right stick, or a drag on the right of a touch screen.
  const lk = input.look('look'), look = graphics.look;
  look.x = clamp(look.x + lk.x * 1.25, -1.25, 1.25); look.y = clamp(look.y - lk.y * 1.6, -0.6, 0.65);
  if (input.source === 'gamepad' && Math.abs(lk.x) + Math.abs(lk.y) < 1e-5) { look.x = damp(look.x, 0, 3, dt); look.y = damp(look.y, 0, 3, dt); }
  const ptr = input.pointer; if (ptr.justDown) { const now = performance.now(); if (now - lastTap < 320) { look.x = look.y = 0; lastTap = -1; } else lastTap = now; }
  // With a controller, the rider dialogue takes the D-pad and A while it is open.
  const dialoguePad = input.source === 'gamepad' && ui.dialogueOpen;
  if (dialoguePad) { if (step && step[1]) ui.navMove(0, step[1]); if (input.pressed('confirm')) ui.navConfirm(); }
  for (const [name, a] of GAME_ACTIONS) {
    if (!input.pressed(name)) continue;
    if (dialoguePad && (name === 'front' || name === 'engine' || name === 'belt')) continue;
    action(a);
  }
  if (input.pressed('gearPad')) { gearHold = 0; gearFired = false; }
  if (input.down('gearPad')) { gearHold += dt; if (!gearFired && gearHold > 0.55) { gearFired = true; action('reverse'); } }
  if (input.released('gearPad') && !gearFired) action('gear');
  // The touch stick steps aside while a rider is talking, so the replies under it can be tapped.
  const showStick = !ui.dialogueOpen; if (showStick !== stickShown) { stickShown = showStick; kit.touch?.setShown('drive', showStick); }
}
function readControls() {
  const d = input.vector('drive');
  return {
    steer: clamp(input.value('steer') + d.x, -1, 1), throttle: clamp(input.value('throttle') + Math.max(0, d.y), 0, 1), brake: clamp(input.value('brake') + Math.max(0, -d.y), 0, 1),
    emergency: input.down('emergency'), analog: input.source !== 'keyboard',
  };
}
function feedback(e) {
  if (e.type === 'impact') input.rumble(0.35 + 0.6 * (e.strength ?? 0.5), 260);
  else if (e.type === 'door' || e.type === 'air') input.rumble(0.08, 70);
  else if (e.type === 'violation' && /^(red-|yield-|stop-)/.test(e.code || '')) input.rumble(0.25, 140);
  else if (e.type === 'departed' && !sim.completed) save(false);
}

// ---- first frames: compile what appears later behind the loading card
graphics.update(sim, 1 / 60, true, 0);
kit.loading.progress(0.9, 'Warming up the engine…');
await graphics.prewarm(sim);
refreshMenuCard(); kit.touch?.suspend(true, 'menu'); ui.showMenu();

let first = true;
kit.start((dt, t) => {
  handleInput(dt);
  const controls = readControls();
  if (!inMenu && !sim.paused) { accumulator += dt; while (accumulator >= 1 / 60) { sim.update(1 / 60, controls); accumulator -= 1 / 60; } } else accumulator = 0;
  graphics.update(sim, dt, inMenu, t); graphics.render();
  if (!inMenu) ui.update(sim, graphics, kit.backendLabel);
  const events = sim.drainEvents(); for (const e of events) { audio.event(e); feedback(e); } ui.events(events); audio.update(sim, graphics.weather);
  if (!sim.paused && sim.time - autosave > 45) { store('helsinki-regulars', sim.memory); autosave = sim.time; }
  if (first) { first = false; kit.loading.done(); }
});
