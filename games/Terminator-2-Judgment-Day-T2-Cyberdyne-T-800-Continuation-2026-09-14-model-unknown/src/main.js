/**
 * T2 — Cyberdyne / T-800 Continuation on the shared 3D kit.
 *
 * This page boots the kit (WebGPU with a WebGL2 fallback, Rapier 0.20, quality tiers, and
 * keyboard/mouse, gamepad, and touch input), then mounts the Strata episode. It owns the
 * title/pause menu, the results screen, settings, records, and restarts. The episode owns
 * the scene and the rules (src/episode/).
 */
import { boot } from 'kit/boot.js';
import { CONFIG } from './config.js';
import { setRapier } from './engine/PhysicsWorld.js';
import { createHud } from './hud.js';
import { SceneAudio } from './episode/audio.js';
import { mount } from './episode/episode.js';
import * as save from './episode/save.js';
import { DIFFICULTY, DIFFICULTY_ORDER, formatTime } from './episode/rules.js';

const $ = id => document.getElementById(id);
// Tab switches optics only while playing; in the menus it keeps moving keyboard focus.
const visionAction = playing => ({ keys: playing ? ['KeyV', 'Tab'] : ['KeyV'], gamepad: ['RB'], touch: { label: 'T-800', slot: 'top' } });

const kit = await boot({
  title: 'T2 — Cyberdyne / T-800 Continuation',
  physics: true,
  mount: $('viewport'),
  gear: 'none', // the menu has a GRAPHICS & CONTROLS button (F9 also opens the kit settings)
  accent: '#c4a58a',
  background: '#07111a',
  touch: { top: 'center', topOffset: 8 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    // Pointer lock is requested on play; 'drag' also lets a held button look while the lock is missing.
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'Fire' },
    zoom: { keys: ['KeyK'], mouse: [2], gamepad: ['LT'], touch: 'Zoom' },
    reload: { keys: ['KeyR'], gamepad: ['X'], touch: 'Reload' },
    interact: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Use' },
    crouch: { keys: ['KeyC', 'ControlLeft'], gamepad: ['B'], touch: 'Crouch' },
    jump: { keys: ['Space'], gamepad: ['A'] },
    sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
    vision: visionAction(false),
    lab: { keys: ['KeyT'], gamepad: ['Back'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  },
});
setRapier(kit.RAPIER);
kit.loading.progress(0.7, 'Building the Cyberdyne scene…');

const hud = createHud();
const sound = new SceneAudio();

// ---------------------------------------------------------------- preferences (the game's own; the kit keeps quality and look settings)
const DEFAULT_PREFS = Object.freeze({ fov: 76, headBob: 0.15, volume: 0.28, difficulty: 'standard' });
function loadPrefs() {
  const p = save.readJson(save.KEYS.prefs) ?? {}, out = { ...DEFAULT_PREFS };
  if (typeof p.fov === 'number' && p.fov >= 60 && p.fov <= 110) out.fov = p.fov;
  if (typeof p.headBob === 'number' && p.headBob >= 0 && p.headBob <= 1) out.headBob = p.headBob;
  if (typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 0.4) out.volume = p.volume;
  if (DIFFICULTY_ORDER.includes(p.difficulty)) out.difficulty = p.difficulty;
  return out;
}
let prefs = loadPrefs();
sound.volume = prefs.volume;
const savePrefs = () => save.writeJson(save.KEYS.prefs, prefs);

// ---------------------------------------------------------------- button prompts that follow the device in use
const LABELS = {
  keyboard: { fire: 'CLICK', zoom: 'RIGHT MOUSE', reload: 'R', interact: 'E', vision: 'TAB', lab: 'T', pause: 'ESC', crouch: 'C', sprint: 'SHIFT' },
  gamepad: { fire: 'RT', zoom: 'LT', reload: 'X', interact: 'Y', vision: 'RB', lab: 'BACK', pause: 'START', crouch: 'B', sprint: 'L3' },
  touch: { fire: 'FIRE', zoom: 'ZOOM', reload: 'RELOAD', interact: 'USE', vision: 'T-800', lab: 'MENU', pause: 'II', crouch: 'CROUCH', sprint: 'STICK RIM' },
};
const source = () => (kit.input.source in LABELS ? kit.input.source : 'keyboard');
const label = action => LABELS[source()][action] ?? action.toUpperCase();
const HELP = {
  keyboard: [['W A S D', 'Move'], ['MOUSE', 'Look'], ['CLICK / J', 'Fire (hold)'], ['R-MOUSE / K', 'Zoom'], ['R', 'Reload'], ['TAB / V', 'T-800 vision'], ['E', 'Resupply'], ['SHIFT', 'Sprint'], ['C / CTRL', 'Crouch'], ['T', 'Return to lab'], ['ESC / P', 'Pause']],
  gamepad: [['L STICK', 'Move'], ['R STICK', 'Look'], ['RT', 'Fire (hold)'], ['LT', 'Zoom'], ['X', 'Reload'], ['RB', 'T-800 vision'], ['Y', 'Resupply'], ['L3', 'Sprint'], ['B', 'Crouch'], ['BACK', 'Return to lab'], ['START', 'Pause']],
  touch: [['LEFT THUMB', 'Move'], ['DRAG', 'Look'], ['FIRE', 'Hold; drag to aim'], ['ZOOM', 'Hold; drag to aim'], ['RELOAD', 'Reload'], ['T-800', 'Optics'], ['USE', 'Resupply'], ['STICK RIM', 'Sprint'], ['II', 'Pause']],
};
const FOOTER = {
  keyboard: 'WASD MOVE / CLICK FIRE / TAB VISION / RIGHT MOUSE ZOOM / R RELOAD / T LAB / ESC PAUSE',
  gamepad: 'L STICK MOVE / RT FIRE / RB VISION / LT ZOOM / X RELOAD / BACK LAB / START PAUSE',
  touch: '',
};
function renderHelp() {
  const src = source();
  $('controls-help').replaceChildren(...HELP[src].map(([key, text]) => {
    const row = document.createElement('span'), b = document.createElement('b');
    b.textContent = key; row.append(b, ` ${text}`);
    return row;
  }));
  hud.text('controls-footer', FOOTER[src]);
  hud.text('vision-key', label('vision'));
  if (navFocus && src !== 'gamepad') navFocus.classList.remove('nav-focus');
}

// ---------------------------------------------------------------- touch: drag the Fire and Zoom buttons to aim while holding them
for (const name of ['fire', 'zoom']) {
  const button = kit.touch?.button(name);
  if (!button) continue;
  let drag = null;
  button.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  button.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    kit.input.touch.look.x += e.clientX - drag.x;
    kit.input.touch.look.y += e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, end);
}

// ---------------------------------------------------------------- audio: starts on the first gesture, pauses with the kit settings panel
const unlockAudio = () => { void sound.resume().catch(() => {}); };
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

// ---------------------------------------------------------------- mission lifecycle
// Records as they stood when this mission was built, per difficulty, so the results screen can flag new ones.
const allRecords = () => Object.fromEntries(DIFFICULTY_ORDER.map(d => [d, save.loadRecords(d)]));
let active = null, restarting = false, pausedAt = 0, runStartRecords = allRecords(), lastResult = null;
const shell = {
  hud, sound, kit,
  prefs: () => prefs,
  label,
  checkpoint: null,
  status: text => { $('status').textContent = text; },
  saveCheckpoint: data => save.saveCheckpoint(data),
  onProgress: (difficulty, update) => save.recordProgress(difficulty, update, false),
  onMode: (running) => {
    $('menu').hidden = running || !$('completion').hidden;
    kit.input.define({ vision: visionAction(running) });
    kit.touch?.suspend(!running, 'game');
    if (running) clearNavFocus();
    else { pausedAt = performance.now(); refreshMenu(); focusFirst($('menu')); }
  },
};

function recordsText(r, difficulty) {
  if (!r.runs && !r.bestWave && !r.bestVehicles && !r.fastestOpening) return '';
  const bits = [];
  if (r.fastestOpening) bits.push(`OPENING LINE ${formatTime(r.fastestOpening)}`);
  bits.push(`BEST WAVE ${r.bestWave}`, `${r.bestVehicles} VEHICLES`, `${r.runs} RUN${r.runs === 1 ? '' : 'S'} ENDED`);
  return `RECORDS / ${DIFFICULTY[difficulty].label} PRESSURE\n${bits.join('  ·  ')}`;
}
function syncSettingsUI() {
  $('fov').value = String(prefs.fov);
  $('bob').value = String(prefs.headBob);
  $('volume').value = String(prefs.volume);
  const d = DIFFICULTY[prefs.difficulty];
  $('difficulty').textContent = d.label;
  $('difficulty-note').textContent = d.note;
}
function refreshMenu() {
  const a = active, started = !!a?.started;
  $('play').disabled = !a;
  $('play').textContent = !a ? 'LOADING THE SCENE…' : started ? 'RESUME MISSION' : a.restored ? 'CONTINUE MISSION' : 'ENTER THE SCENE';
  $('menu-eyebrow').textContent = started ? 'SYSTEM STANDBY / FIRST PERSON' : 'TERMINATOR 2 / CONTINUED';
  $('new-mission').hidden = !a || !(started || a.restored);
  $('save').disabled = !started;
  $('return-lab').disabled = !started;
  $('finish-run').disabled = !a?.openingComplete;
  $('records').textContent = recordsText(save.loadRecords(prefs.difficulty), prefs.difficulty);
  syncSettingsUI();
}

async function start(checkpoint = save.loadCheckpoint()) {
  if (restarting) return;
  restarting = true;
  try {
    try { active?.dispose(); } catch (error) { console.error(error); }
    active = null;
    lastResult = null;
    $('completion').hidden = true;
    $('menu').hidden = false;
    hud.toggle('scene-hud', 'is-menu', true);
    kit.touch?.suspend(true, 'game');
    kit.input.define({ vision: visionAction(false) });
    refreshMenu();
    shell.status('Building the Cyberdyne scene.');
    shell.checkpoint = checkpoint;
    let message = '';
    try {
      active = await mount(kit, CONFIG, shell);
    } catch (error) {
      if (!checkpoint) throw error;
      // A checkpoint that cannot be restored must not lock the player out: drop it and start fresh.
      console.error(error);
      save.clearCheckpoint();
      shell.checkpoint = null;
      active = await mount(kit, CONFIG, shell);
      message = 'The saved checkpoint could not be restored, so it was cleared. ';
    }
    active.applyPrefs(prefs);
    runStartRecords = allRecords();
    refreshMenu();
    shell.status(message + (active.restored ? `Checkpoint loaded: ${active.summary()}. You return to the lab.` : 'Ready. Use headphones for the scene audio.'));
    focusFirst($('menu'));
  } catch (error) {
    console.error(error);
    $('play').disabled = true;
    $('play').textContent = 'SCENE UNAVAILABLE';
    shell.status(`The scene could not start. ${String(error?.message ?? error)}`);
  } finally {
    restarting = false;
  }
}

function play() {
  if (!active || restarting) return;
  unlockAudio();
  clearNavFocus();
  active.play();
}

function finishRun() {
  if (!active) return;
  const result = active.endRun();
  if (!result) return;
  const before = runStartRecords[result.difficulty];
  const { record } = save.recordProgress(result.difficulty, { wavesCleared: result.wavesCleared, vehicles: result.vehicles, parts: result.parts, openingTime: result.openingTime }, true);
  save.clearCheckpoint();
  lastResult = { ...result, records: record };
  $('result-wave').textContent = String(result.wavesCleared);
  $('result-cars').textContent = String(result.vehicles);
  $('result-time').textContent = formatTime(result.elapsed);
  $('result-rounds').textContent = String(result.rounds);
  $('result-accuracy').textContent = `${Math.round(result.accuracy * 100)}%`;
  $('result-parts').textContent = String(result.parts);
  const firsts = [];
  if (result.wavesCleared > before.bestWave) firsts.push('MOST WAVES');
  if (result.vehicles > before.bestVehicles) firsts.push('MOST VEHICLES');
  if (result.openingTime && (!before.fastestOpening || result.openingTime < before.fastestOpening)) firsts.push('FASTEST OPENING LINE');
  $('result-best').textContent = `${DIFFICULTY[result.difficulty].label} PRESSURE${firsts.length ? `  /  NEW RECORD: ${firsts.join(', ')}` : ''}\n${recordsText(record, result.difficulty).split('\n')[1] ?? ''}`;
  $('result-copy').replaceChildren(
    document.createTextNode(result.wavesCleared ? `The opening scene and ${result.wavesCleared} response wave${result.wavesCleared === 1 ? '' : 's'} are complete.` : 'The opening scene is complete.'),
    document.createElement('br'),
    document.createTextNode(`Opening line ${result.openingTime ? formatTime(result.openingTime) : '—'} · reboots ${result.reboots} · fire inhibits ${result.violations} · searchlights ${result.searchlights}.`),
  );
  $('completion-data').textContent = JSON.stringify(lastResult, null, 2);
  $('menu').hidden = true;
  $('completion').hidden = false;
  focusFirst($('completion'));
}

// Two-step confirm for destructive buttons (no native confirm(): it blocks and a gamepad cannot answer it).
function confirmThen(id, prompt, action) {
  const button = $(id), original = button.textContent;
  let timer = 0;
  return () => {
    if (button.dataset.armed) {
      clearTimeout(timer); delete button.dataset.armed; button.textContent = original;
      action();
      return;
    }
    button.dataset.armed = '1'; button.textContent = prompt;
    timer = setTimeout(() => { delete button.dataset.armed; button.textContent = original; }, 4000);
  };
}

$('play').addEventListener('click', play);
$('open-settings').addEventListener('click', () => kit.menu.open());
$('new-mission').addEventListener('click', confirmThen('new-mission', 'CONFIRM: ERASE AND RESTART', () => { save.clearCheckpoint(); void start(null); }));
$('restart').addEventListener('click', confirmThen('restart', 'Confirm: erase and restart', () => { save.clearCheckpoint(); void start(null); }));
$('save').addEventListener('click', () => active?.checkpoint(false));
$('return-lab').addEventListener('click', () => active?.returnToLab());
$('finish-run').addEventListener('click', confirmThen('finish-run', 'Confirm: end the run', finishRun));
$('export-save').addEventListener('click', () => {
  if (!active) return;
  if (active.started) active.checkpoint(true);
  save.downloadText('t2-cyberdyne-v2-checkpoint.json', JSON.stringify(active.snapshot()));
});
$('completion-export').addEventListener('click', () => { if (lastResult) save.downloadText('t2-cyberdyne-v2-result.json', JSON.stringify(lastResult, null, 2)); });
$('completion-restart').addEventListener('click', () => { save.clearCheckpoint(); void start(null); });
$('import-save').addEventListener('change', async event => {
  const input = event.target, file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 65536) throw new Error('Save exceeds 64 KiB.');
    const checkpoint = save.parseImport(await file.text());
    save.saveCheckpoint(checkpoint);
    await start(checkpoint);
  } catch (error) {
    shell.status(`Import failed: ${String(error?.message ?? error)}`);
  } finally {
    input.value = '';
  }
});
for (const [id, key] of [['fov', 'fov'], ['bob', 'headBob'], ['volume', 'volume']]) {
  $(id).addEventListener('input', () => {
    prefs = { ...prefs, [key]: Number($(id).value) };
    savePrefs();
    active?.applyPrefs(prefs);
  });
}
$('difficulty').addEventListener('click', () => {
  const i = DIFFICULTY_ORDER.indexOf(prefs.difficulty);
  prefs = { ...prefs, difficulty: DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length] };
  savePrefs();
  refreshMenu();
});
$('restore-settings').addEventListener('click', () => {
  prefs = { ...DEFAULT_PREFS };
  savePrefs();
  active?.applyPrefs(prefs);
  refreshMenu();
});

// ---------------------------------------------------------------- menus with a gamepad (and arrow keys): move focus, A confirms, B / Start go back
let navFocus = null, repeatTimer = 0;
const openOverlay = () => (!$('completion').hidden ? $('completion') : !$('menu').hidden ? $('menu') : null);
const focusables = root => [...root.querySelectorAll('button, summary, input, a[href]')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length > 0);
function setNavFocus(el) {
  navFocus?.classList.remove('nav-focus');
  navFocus = el;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
  if (source() === 'gamepad') el.classList.add('nav-focus');
}
function clearNavFocus() {
  navFocus?.classList.remove('nav-focus');
  navFocus = null;
}
function focusFirst(root) {
  const list = focusables(root);
  setNavFocus(list.find(el => el.classList.contains('primary')) ?? list[0] ?? null);
}
function moveFocus(root, step) {
  const list = focusables(root);
  if (!list.length) return;
  const current = list.indexOf(document.activeElement);
  setNavFocus(list[current < 0 ? 0 : (current + step + list.length) % list.length]);
}
function adjust(el, dir) {
  if (el?.type !== 'range') return false;
  const step = Number(el.step) || 1, value = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + step * dir));
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}
function menuInput(dt) {
  const root = openOverlay(), input = kit.input;
  if (!root) return;
  const mv = input.vector('move');
  let step = false;
  if (input.pressed('move')) { step = true; repeatTimer = 0.38; }
  else if (input.down('move')) { repeatTimer -= dt; if (repeatTimer <= 0) { step = true; repeatTimer = 0.12; } }
  if (step) {
    if (Math.abs(mv.y) >= Math.abs(mv.x)) moveFocus(root, mv.y > 0 ? -1 : 1);
    else if (!adjust(document.activeElement, mv.x > 0 ? 1 : -1)) moveFocus(root, mv.x > 0 ? 1 : -1);
  }
  const pad = input.source === 'gamepad';
  // Keyboard Enter/Space on a focused button is a native click; the pad's A is ours.
  if (pad && input.pressed('jump')) {
    const target = root.contains(document.activeElement) && document.activeElement !== document.body ? document.activeElement : focusables(root).find(el => el.classList.contains('primary'));
    target?.click();
  }
  if (pad && input.pressed('crouch')) {
    const open = [...root.querySelectorAll('details[open]')].find(d => d.contains(document.activeElement));
    if (open) { open.open = false; setNavFocus(open.querySelector('summary')); return; }
  }
  // Start / Esc / P (or B) resume a paused mission. The short delay stops the key that paused from resuming.
  if ((input.pressed('pause') || (pad && input.pressed('crouch'))) && root === $('menu') && active?.started && performance.now() - pausedAt > 350) play();
}

// ---------------------------------------------------------------- the loop
kit.onPause(paused => {
  sound.setPaused(paused);
  if (paused) active?.pause();
});
kit.input.onSourceChange(renderHelp);
addEventListener('pagehide', () => { if (active?.started) active.checkpoint(true); });

renderHelp();
syncSettingsUI();
await start();
kit.start(dt => {
  if (!active || restarting) return;
  if (active.running) { if (kit.input.pressed('pause')) active.pause(); }
  else menuInput(dt);
  active.frame(dt);
});
