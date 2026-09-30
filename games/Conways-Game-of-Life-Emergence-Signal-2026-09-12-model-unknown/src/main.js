/**
 * main.js — Emergence: Signal. The laboratory (sandbox) and the app shell:
 * boot on the shared kit, the field and its history, the DOM panels, and all
 * input through kit.input actions (mouse, touch, keyboard and gamepad).
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { MOUSE_LOOK, TOUCH_LOOK } from 'kit/input.js';
import { Life, History, GRID_SIZES, MAX_SIZE, transformPoints, PATTERNS, findPattern, parseRLE, toRLE, toSession, fromSession } from './life.js';
import { VoxelView } from './view.js';
import { Campaign } from './campaign.js';
import { createAudio } from './audio.js';
import { createMenuNav } from './menunav.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const fmt = new Intl.NumberFormat('en-US');
const TWO_PI = Math.PI * 2;
const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};

// ------------------------------------------------------------------ preferences

const PREF_KEY = 'emergence.preferences';
const SESSION_KEY = 'emergence.session';
const DEFAULTS = {
  palette: 'aurora',
  bloom: true,
  ageHeight: true,
  trails: true,
  gridLines: true,
  shadows: true,
  autoRotate: false,
  reducedMotion: matchMedia('(prefers-reduced-motion:reduce)').matches,
  pauseEmpty: true,
  pauseStable: false,
};
const prefs = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (saved) {
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) prefs[k] = saved[k];
    if (!['aurora', 'ember', 'glacier', 'mono'].includes(prefs.palette)) prefs.palette = 'aurora';
  }
} catch {
  /* defaults */
}
let savedSession = null;
try {
  savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (savedSession?.format === 'emergence/v1') $('restoreSession').hidden = false;
} catch {
  savedSession = null;
}

// ------------------------------------------------------------------ input

/**
 * Standard bindings where they apply (Esc/P/Start menu, A confirm, B back,
 * right stick and drag orbit, wheel/pinch and LB/RB zoom), plus the lab's own
 * keys from the original game.
 */
const ACTIONS = {
  // Camera. "drag" is the pointer (any mouse button, one finger); "orbit" is the right stick.
  drag: { type: 'look', mouse: 'drag', gamepad: [], touch: 'drag' },
  orbit: { type: 'look', mouse: 'locked', gamepad: 'rightStick' },
  paint: { mouse: [0] },
  pan: { mouse: [2, 1] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  fit: { keys: ['KeyF'], gamepad: ['RS'] },
  top: { keys: ['KeyT'] },
  // Board cursor for keyboard and gamepad.
  cursor: { type: 'vector', gamepad: 'leftStick' },
  nudge: { type: 'vector', keys: 'arrows', gamepad: 'dpad' },
  act: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { gamepad: ['B'] },
  escape: { keys: ['Escape'] },
  menu: { keys: ['KeyP'], gamepad: ['Start'] },
  // Simulation.
  play: { keys: ['Space'], gamepad: ['X'] },
  step: { keys: ['Period', 'KeyN'], gamepad: ['RT'] },
  stepBack: { keys: ['Comma'], gamepad: ['LT'] },
  // Tools.
  toolOrbit: { keys: ['KeyV'] },
  toolDraw: { keys: ['KeyB'] },
  toolErase: { keys: ['KeyE'] },
  toolStamp: { keys: ['KeyS'] },
  toolNext: { gamepad: ['Back'] },
  rotate: { keys: ['KeyR'], gamepad: ['Y'] },
  flip: { keys: ['KeyX'], gamepad: ['LS'] },
  // Display and help.
  cinema: { keys: ['KeyC'] },
  help: { keys: ['KeyH', 'Slash'] },
  grid: { keys: ['KeyG'] },
  trails: { keys: ['KeyL'] },
  undoKey: { keys: ['KeyZ'] },
  mod: { keys: ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'] },
  shift: { keys: ['ShiftLeft', 'ShiftRight'] },
};

const kit = await boot({
  title: 'Emergence — Signal',
  mount: $('canvasHost'),
  gear: 'none',
  accent: '#c1ee90',
  background: '#0a1014',
  touch: { hint: false },
  input: ACTIONS,
});
const input = kit.input;
const audio = createAudio();
const menuNav = createMenuNav(input);

// ------------------------------------------------------------------ state

let life = new Life(64, true);
life.randomize(0.28, 62401);
let initial = null;
const history = new History(96);
let playing = false;
let speed = 8;
let tool = 'orbit';
let brushSize = 1;
let fieldName = 'Primordial soup';
let fieldDescription = 'A two-dimensional world. A new perspective.';
let experiment = 1;
let seedEdited = false;
let stampId = 'glider';
let stampRotation = 0;
let stampFlip = false;
let stampPoints = findPattern('glider').points;
let graph = [{ generation: 0, population: life.population }];
let graphDirty = true;
let graphDrawnAt = 0;
let graphSize = null;
let libraryFilter = 'All';
let cinema = false;
let accumulator = 0;
let sessionDirty = true;
let hoverCell = null;
let menuWasPlaying = false;
let menuActionTaken = false;
/** A paint stroke in progress: the field before it (for undo) and the last painted cell. */
let stroke = null;
/** The keyboard/gamepad cursor on the board (float cell coordinates while the stick moves it). */
const cursor = { x: 32, y: 32, active: false, cell: null };
let campaign = null;
const view = new VoxelView(kit, prefs);

// ------------------------------------------------------------------ small helpers

let toastTimer = 0;
function toast(message, ms = 3400) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}

function saveSession() {
  if (campaign?.active || !sessionDirty) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(toSession(life, fieldName)));
    sessionDirty = false;
  } catch {
    /* storage full or blocked */
  }
}

function fillRange(el) {
  el.style.setProperty('--range', `${((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100}%`);
}

/** The game's own open dialog on top (the kit's settings panel pauses the loop and handles itself). */
function topDialog() {
  const open = $$('dialog[open]:not(.kit-menu)');
  return open.at(-1) || null;
}

function openDialog(id) {
  closeSidebar();
  const d = $(id);
  if (id === 'settingsDialog') updateDiagnostics();
  if (!d.open) d.showModal();
  if (input.source === 'gamepad') menuNav.enter(d);
}

function closeDialogs() {
  $$('dialog[open]:not(.kit-menu)').forEach((d) => d.close());
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  $('openSidebar').setAttribute('aria-expanded', 'false');
  $('stage').inert = false;
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
  $('openSidebar').setAttribute('aria-expanded', 'true');
  $('stage').inert = true;
  if (input.source === 'gamepad') menuNav.enter($('sidebar'));
  else $('closeSidebar').focus();
}

// ------------------------------------------------------------------ layout cache (no DOM reads per frame)

const layout = { canvas: null, stage: null, at: 0 };
function measureLayout() {
  layout.canvas = kit.canvas.getBoundingClientRect();
  layout.stage = $('stage').getBoundingClientRect();
  layout.at = performance.now();
  graphSize = null;
  if (campaign) campaign.overlayDirty = true;
}
kit.onResize(() => measureLayout());
addEventListener('resize', () => {
  measureLayout();
  graphDirty = true;
  if (innerWidth > 800) closeSidebar();
});

// ------------------------------------------------------------------ play state and the field

function setPlaying(on) {
  if (on && campaign?.active && !campaign.ensureRun()) return;
  playing = !!on;
  accumulator = 0;
  $('playIcon').innerHTML = `<use href="#i-${playing ? 'pause' : 'play'}"/>`;
  setText($('playText'), playing ? 'Pause' : 'Play');
  $('play').setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation');
  setText($('runState'), playing ? 'RUNNING' : 'PAUSED');
  $('runDot').style.background = playing ? 'var(--accent)' : '#9aabb3';
  campaign?.refresh();
}

function setFieldName(name, description) {
  fieldName = name;
  fieldDescription = description || 'A two-dimensional world. A new perspective.';
  $('sceneTitle').textContent = name === 'Primordial soup' ? 'Order from chaos.' : name;
  $('sceneDescription').textContent = fieldDescription;
  $('fieldLabel').textContent = `EXPERIMENT ${String(experiment).padStart(3, '0')}`;
}

/** A snapshot of the field and its title. `into` recycles an old snapshot's arrays. */
function snapshotField(into = null) {
  const snap = life.snapshot(into);
  snap.name = fieldName;
  snap.description = fieldDescription;
  return snap;
}

function pushHistory() {
  history.limit = life.size >= 192 ? 40 : 96;
  // A running field pushes one entry per generation: once the stack is full, reuse the
  // oldest entry's arrays instead of allocating a new copy of the field every step.
  const oldest = history.past.length >= history.limit ? history.past.shift() : null;
  history.push(snapshotField(oldest));
  // Keep the undo stack under ~16 MB on big fields.
  let bytes = 0;
  for (let i = history.past.length - 1; i >= 0; i--) {
    bytes += history.past[i].size ** 2 * 4;
    if (bytes > 16 * 1024 * 1024) {
      history.past.splice(0, i + 1);
      break;
    }
  }
}

function pushGraph() {
  graph.push({ generation: life.generation, population: life.population });
  if (graph.length > 180) graph.shift();
  graphDirty = true;
}

function drawGraph() {
  const canvas = $('populationGraph');
  if (!graphSize) {
    const r = canvas.getBoundingClientRect();
    graphSize = { w: r.width, dpr: Math.min(devicePixelRatio || 1, 2) };
  }
  const { w, dpr } = graphSize;
  if (w < 1) return;
  const h = 62;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let peak = 1;
  for (const g of graph) if (g.population > peak) peak = g.population;
  const pts = graph.map((g, i) => [(i / Math.max(graph.length - 1, 1)) * w, h - 6 - (g.population / peak) * (h - 13)]);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = '#314048';
  for (const y of [15, 35, 55]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  if (pts.length === 1) pts.push([w, pts[0][1]]);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#a5d28035');
  grad.addColorStop(1, '#a5d28000');
  ctx.beginPath();
  ctx.moveTo(0, h);
  pts.forEach((p) => ctx.lineTo(...p));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  ctx.strokeStyle = '#b6d98b';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  const last = pts.at(-1);
  ctx.fillStyle = '#c2e39b';
  ctx.beginPath();
  ctx.arc(last[0] - 1, last[1], 2, 0, TWO_PI);
  ctx.fill();
  setText($('graphCount'), String(graph.length));
  setText($('graphPeak'), `PEAK ${fmt.format(peak)}`);
}

let lastOccupancy = '';
function updateStats() {
  const occ = ((life.population / life.cells.length) * 100).toFixed(1);
  setText($('generation'), String(life.generation).padStart(5, '0'));
  setText($('population'), fmt.format(life.population));
  if (occ !== lastOccupancy) {
    lastOccupancy = occ;
    $('occupancy').innerHTML = `${occ}<span>%</span>`;
  }
  setText($('births'), `+${fmt.format(life.births)}`);
  setText($('deaths'), `−${fmt.format(life.deaths)}`);
  setText($('dimensions'), `${life.size} × ${life.size}`);
  if ($('gridSize').value !== String(life.size)) $('gridSize').value = String(life.size);
  $('wrap').checked = life.wrap;
  $('undo').disabled = $('backStep').disabled = !history.past.length;
  $('redo').disabled = !history.future.length;
  graphDirty = true;
  campaign?.refresh();
}

/** The field changed: upload it and refresh the readouts. */
function changed(immediate = false) {
  view.sync(life, immediate);
  updateStats();
  sessionDirty = true;
}

function adoptField(next, { resetHistory = false, resetGraph = true } = {}) {
  life = next;
  if (resetHistory) history.clear();
  if (resetGraph) {
    graph = [{ generation: life.generation, population: life.population }];
    graphDirty = true;
  }
  view.sync(life, true);
  view.setTool(tool);
  updateStats();
  sessionDirty = true;
}

function restoreSnapshot(snap) {
  if (!snap) return;
  setPlaying(false);
  if (snap.size !== life.size) life = new Life(snap.size, snap.wrap);
  life.restore(snap);
  if (snap.name) setFieldName(snap.name, snap.description);
  graph = graph.filter((g) => g.generation < life.generation);
  pushGraph();
  changed(true);
}

function undo() {
  if (campaign?.active) return campaign.undo();
  if (history.past.length) restoreSnapshot(history.undo(snapshotField()));
}

function redo() {
  if (campaign?.active) return campaign.redo();
  if (history.future.length) restoreSnapshot(history.redo(snapshotField()));
}

function advance(count = 1, render = true) {
  if (campaign?.active) return campaign.advance(count, render);
  for (let i = 0; i < count; i++) {
    pushHistory();
    life.step();
    pushGraph();
  }
  if (render) changed();
  if (prefs.pauseEmpty && life.population === 0) {
    setPlaying(false);
    toast('The field is empty. Plant a new pattern to begin again.');
  } else if (prefs.pauseStable && life.births === 0 && life.deaths === 0) {
    setPlaying(false);
    toast('The field has reached a stable state.');
  }
}

function stepOnce() {
  setPlaying(false);
  advance();
}

function setSpeed(value) {
  speed = Math.max(1, Math.min(60, Number(value) || 8));
  $('speed').value = String(Math.min(speed, 40));
  $('speedValue').innerHTML = `${speed} <span>gen/s</span>`;
  $('speedMore').classList.toggle('active', speed === 60);
  fillRange($('speed'));
  $('menuSpeed').value = String(speed);
  setText($('menuSpeedValue'), `${speed} gen/s`);
  fillRange($('menuSpeed'));
  accumulator = 0;
}

// ------------------------------------------------------------------ patterns and tools

function loadPattern(id) {
  if (campaign?.active) {
    toast('Open Sandbox to load unrestricted patterns.');
    return;
  }
  const p = findPattern(id);
  setPlaying(false);
  endStroke();
  pushHistory();
  let size = life.size;
  const need = Math.max(p.width, p.height) + 12;
  if (need > size) size = GRID_SIZES.find((s) => s >= need) || MAX_SIZE;
  const next = new Life(size, life.wrap);
  next.seed = life.seed;
  next.stamp(p.points, Math.floor((size - p.width) / 2), Math.floor((size - p.height) / 2));
  adoptField(next);
  experiment++;
  setFieldName(p.name, p.detail);
  initial = snapshotField();
  setStamp(id);
  setTool('orbit');
  closeDialogs();
  closeSidebar();
  view.focusPattern(p.width, p.height);
  $$('.preset-card').forEach((c) => c.classList.toggle('active', c.dataset.pattern === id));
  toast(`${p.name} loaded. Press Play to evolve.`);
}

function setStamp(id) {
  stampId = id;
  stampRotation = 0;
  stampFlip = false;
  $('stampSelect').value = id;
  updateStamp();
}

function updateStamp() {
  stampPoints = transformPoints(findPattern(stampId).points, stampRotation, stampFlip);
  $('stampOrientation').textContent = `${stampRotation * 90}°${stampFlip ? ' ⇋' : ''}`;
  if (hoverCell) showHover(hoverCell);
}

function rotateStamp() {
  stampRotation = (stampRotation + 1) % 4;
  updateStamp();
}

function flipStamp() {
  stampFlip = !stampFlip;
  updateStamp();
}

const TOOLS = ['orbit', 'draw', 'erase', 'stamp'];
function setTool(next) {
  tool = next;
  endStroke();
  view.setTool(next);
  $$('[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === next);
    b.setAttribute('aria-pressed', String(b.dataset.tool === next));
  });
  const brush = ['draw', 'erase'].includes(next);
  $('brushControl').hidden = !brush;
  $$('.brush-divider').forEach((d) => (d.hidden = !brush));
  $('stampBar').hidden = next !== 'stamp';
  document.body.classList.toggle('stamp-active', next === 'stamp');
  updateHint();
  $('inspector').hidden = true;
}

/** The cells a tool touches around a board cell. */
function brushCells(cell) {
  const out = [];
  if (tool === 'stamp') {
    const w = Math.max(...stampPoints.map((p) => p[0]));
    const h = Math.max(...stampPoints.map((p) => p[1]));
    for (const [x, y] of stampPoints) out.push([cell.x + x - Math.floor(w / 2), cell.y + y - Math.floor(h / 2)]);
  } else {
    const r = tool === 'orbit' ? 0 : (brushSize - 1) / 2;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([cell.x + dx, cell.y + dy]);
  }
  return out;
}

function showHover(cell) {
  if (campaign?.active) {
    campaign.hoverCell(cell);
    return;
  }
  hoverCell = cell;
  view.previewCells(brushCells(cell), tool === 'erase');
}

function clearHover() {
  hoverCell = null;
  $('inspector').hidden = true;
  if (campaign?.active) campaign.showPreview();
  else view.previewCells([]);
}

/** The small cell readout next to the pointer (or the gamepad cursor). */
function showInspector(cell, stageX, stageY) {
  if (!layout.stage) measureLayout();
  const el = $('inspector');
  el.hidden = false;
  el.style.left = `${Math.min(stageX + 17, layout.stage.width - 190)}px`;
  el.style.top = `${Math.max(10, Math.min(stageY - 50, layout.stage.height - 225))}px`;
  setText($('cellCoord'), `[ ${cell.x}, ${cell.y} ]`);
  const i = cell.y * life.size + cell.x;
  setText($('cellInfo'), `${life.cells[i] ? `Alive · age ${life.ages[i]}` : 'Empty'} · ${life.neighbors(cell.x, cell.y)} neighbors`);
}

function beginStroke(cell, device) {
  if (!cell) return;
  if (campaign?.active) {
    campaign.pick(cell);
    return;
  }
  if (tool === 'orbit') return;
  setPlaying(false);
  stroke = { device, before: snapshotField(), last: null };
  continueStroke(cell);
}

function continueStroke(cell) {
  if (!cell || !stroke) return;
  const cells = [];
  if (stroke.last && tool !== 'stamp') {
    // Bresenham from the last painted cell, so a fast drag leaves no gaps.
    let x = stroke.last.x;
    let y = stroke.last.y;
    const dx = Math.abs(cell.x - x);
    const dy = -Math.abs(cell.y - y);
    const sx = x < cell.x ? 1 : -1;
    const sy = y < cell.y ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < life.size * 3; guard++) {
      cells.push({ x, y });
      if (x === cell.x && y === cell.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  } else cells.push(cell);
  let any = false;
  for (const c of cells) for (const [x, y] of brushCells(c)) any = life.set(x, y, tool === 'erase' ? 0 : 1) || any;
  stroke.last = cell;
  if (any) {
    life.births = life.deaths = 0;
    changed(true);
  }
  showHover(cell);
}

function endStroke() {
  if (!stroke) return;
  const before = stroke.before;
  stroke = null;
  let differs = false;
  for (let i = 0; i < life.cells.length; i++) {
    if (before.cells[i] !== life.cells[i]) {
      differs = true;
      break;
    }
  }
  if (differs) {
    history.push(before);
    graph = [...graph.slice(0, -1), { generation: life.generation, population: life.population }];
    updateStats();
    sessionDirty = true;
  }
}

// ------------------------------------------------------------------ pattern library UI

function patternThumb(p) {
  const pad = 1.3;
  return `<svg viewBox="${-pad} ${-pad} ${p.width + pad * 2} ${p.height + pad * 2}" aria-hidden="true">${p.points
    .map(([x, y]) => `<rect x="${x + 0.07}" y="${y + 0.07}" width=".86" height=".86" rx=".04"/>`)
    .join('')}</svg>`;
}

function buildPatternUI() {
  const quick = ['glider', 'pulsar', 'gosper', 'acorn', 'pentadecathlon', 'rpentomino'];
  $('quickPatterns').innerHTML = quick
    .map((id) => {
      const p = findPattern(id);
      return `<button class="preset-card" data-pattern="${id}" title="Load ${p.name}"><div class="pattern-thumb">${patternThumb(p)}</div><span>${p.name}</span></button>`;
    })
    .join('');
  $$('.preset-card').forEach((b) => b.addEventListener('click', () => loadPattern(b.dataset.pattern)));
  $('stampSelect').innerHTML = PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  $('patternCount').textContent = String(PATTERNS.length);
  renderCatalog();
}

function renderCatalog() {
  const q = $('patternSearch').value.trim().toLowerCase();
  const list = PATTERNS.filter((p) => (libraryFilter === 'All' || p.kind === libraryFilter) && `${p.name} ${p.kind} ${p.detail}`.toLowerCase().includes(q));
  $('noPatterns').hidden = list.length > 0;
  $('patternCatalog').innerHTML = list
    .map(
      (p) =>
        `<article class="catalog-card"><div class="pattern-thumb">${patternThumb(p)}</div><h3>${p.name}</h3><span>${p.kind} · ${p.points.length} cells</span><p>${p.detail}</p><div><button data-load="${p.id}">Load field</button><button data-stamp="${p.id}">Use stamp</button></div></article>`
    )
    .join('');
  $$('[data-load]').forEach((b) => b.addEventListener('click', () => loadPattern(b.dataset.load)));
  $$('[data-stamp]').forEach((b) =>
    b.addEventListener('click', () => {
      setStamp(b.dataset.stamp);
      setTool('stamp');
      closeDialogs();
      toast(`${findPattern(stampId).name} ready. Tap the field to stamp.`);
    })
  );
}

// ------------------------------------------------------------------ files

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const fileName = (ext) => `emergence-${fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-g${life.generation}.${ext}`;

async function capture() {
  try {
    download(await view.capture(), fileName('png'));
    toast('Field image saved.');
  } catch (err) {
    toast(err.message || 'The image could not be saved.');
  }
}

function resizeGrid(size) {
  if (campaign?.active) return;
  setPlaying(false);
  endStroke();
  pushHistory();
  const old = life;
  const next = new Life(size, old.wrap);
  const offset = Math.floor((size - old.size) / 2);
  next.seed = old.seed;
  next.generation = old.generation;
  for (let y = 0; y < old.size; y++) {
    for (let x = 0; x < old.size; x++) {
      const nx = x + offset;
      const ny = y + offset;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const from = y * old.size + x;
      const to = ny * size + nx;
      next.cells[to] = old.cells[from];
      next.ages[to] = old.ages[from];
      next.trails[to] = old.trails[from];
    }
  }
  next.recount();
  adoptField(next);
  initial = snapshotField();
  view.fit();
  toast(size < old.size ? 'Field resized. Outside cells were removed. Undo can restore them.' : `Field expanded to ${size} × ${size}.`);
}

async function importFile(file) {
  if (campaign?.active || !file) return;
  try {
    if (file.size > 2e6) throw new Error('Choose a file smaller than 2 MB.');
    const text = await file.text();
    if (campaign?.active) return;
    let next;
    let name;
    if (text.trimStart().startsWith('{')) ({ life: next, name } = fromSession(JSON.parse(text)));
    else {
      const rle = parseRLE(text);
      const size = GRID_SIZES.find((s) => s >= Math.max(rle.width, rle.height)) || MAX_SIZE;
      next = new Life(size, life.wrap);
      next.stamp(rle.points, Math.floor((size - rle.width) / 2), Math.floor((size - rle.height) / 2));
      name = rle.name;
    }
    setPlaying(false);
    endStroke();
    pushHistory();
    adoptField(next);
    experiment++;
    setFieldName(name, 'An imported field, ready for its next chapter.');
    initial = snapshotField();
    view.fit();
    closeSidebar();
    toast(`${name} imported.`);
  } catch (err) {
    toast(err.message || 'The file could not be read.');
  } finally {
    $('importFile').value = '';
  }
}

function toggleCinema() {
  cinema = !cinema;
  document.body.classList.toggle('cinema-mode', cinema);
  $('exitCinema').hidden = !cinema;
  closeSidebar();
}

function toggleTop() {
  const on = view.toggleTop();
  $('topView').setAttribute('aria-pressed', String(on));
  setText($('viewMode'), on ? 'TOP VIEW' : 'PERSPECTIVE');
}

// ------------------------------------------------------------------ prompts that follow the input device

const PAD = { A: 'Ⓐ', B: 'Ⓑ', X: 'Ⓧ', Y: 'Ⓨ' };

function updateHint() {
  setText($('interactionHint'), hintText());
}

function hintText() {
  const src = input.source;
  if (campaign?.active) {
    const run = campaign.run;
    if (src === 'gamepad') {
      if (run) return `${PAD.X} pause · RT step · LT back · Right stick camera`;
      if (campaign.mode === 'place') return `Left stick move · ${PAD.A} place / confirm · ${PAD.Y} rotate · LS flip · Back switch`;
      if (campaign.mode === 'remove') return `Left stick select · ${PAD.A} remove piece · Back switch`;
      return `Right stick camera · LB/RB zoom · Back place pieces · ${PAD.X} launch`;
    }
    if (run) return src === 'touch' ? 'Launch: pause · Timeline: inspect' : 'Space: pause · N: step · Timeline: inspect';
    if (campaign.mode === 'orbit') return src === 'touch' ? 'Drag: camera · Pinch: zoom' : 'Drag: camera · Pinch or scroll: zoom';
    if (campaign.mode === 'remove') return 'Select a placed cell to remove its piece';
    return src === 'touch' ? 'Tap: preview · Confirm to place' : 'Select position · R: rotate · Enter: confirm';
  }
  if (src === 'gamepad') {
    if (tool === 'orbit') return `Right stick orbit · LB/RB zoom · ${PAD.A} draw · Back tool · ${PAD.X} play`;
    if (tool === 'stamp') return `Left stick aim · ${PAD.A} stamp · ${PAD.Y} rotate · LS flip · Back tool`;
    return `Left stick move · hold ${PAD.A} to ${tool} · Back tool · ${PAD.X} play`;
  }
  const touch = src === 'touch';
  return {
    orbit: touch ? 'One finger: orbit · Pinch: zoom' : 'Drag to orbit · Right-drag to pan · Scroll to zoom',
    draw: touch ? 'Draw with one finger · Pinch to zoom' : 'Drag to draw · Right-drag to pan',
    erase: touch ? 'Erase with one finger · Pinch to zoom' : 'Drag to erase · Right-drag to pan',
    stamp: touch ? 'Tap to stamp · Pinch to zoom' : 'Click to stamp · R: rotate · X: flip',
  }[tool];
}

const key = (k, label) => `<span><kbd>${k}</kbd> ${label}</span>`;
/** Controls for the device in use, as a row of key chips. */
function controlsHelp(mode = campaign?.active ? 'campaign' : 'sandbox') {
  const src = input.source;
  if (src === 'gamepad') {
    const common = [key('L stick', 'cursor'), key('R stick', 'orbit'), key('LB / RB', 'zoom'), key('RS', 'fit view'), key('Start', 'menu'), key('B', 'back')];
    return (
      mode === 'campaign'
        ? [key('A', 'place / confirm'), key('D-pad', 'nudge piece'), key('Y', 'rotate'), key('LS', 'flip'), key('Back', 'View / Place / Remove'), key('X', 'launch / pause'), key('RT / LT', 'step / back')]
        : [key('A', 'use tool'), key('Back', 'switch tool'), key('Y', 'rotate stamp'), key('LS', 'flip stamp'), key('X', 'play / pause'), key('RT / LT', 'step / back')]
    )
      .concat(common)
      .join('');
  }
  if (src === 'touch') {
    return (
      mode === 'campaign'
        ? [key('Tap', 'preview a piece'), key('Confirm', 'place it'), key('Arrows', 'move by one cell'), key('Drag', 'camera in View'), key('Pinch', 'zoom'), key('Launch', 'run the test')]
        : [key('Drag', 'orbit (View)'), key('Tap / drag', 'draw, erase, stamp'), key('Pinch', 'zoom'), key('Top view + drag', 'pan'), key('Play', 'evolve')]
    ).join('');
  }
  return (
    mode === 'campaign'
      ? [key('Space', 'launch / pause'), key('N', 'next generation'), key('R', 'rotate'), key('X', 'flip'), key('Enter', 'confirm'), key('Arrows', 'nudge'), key('T', 'top view'), key('V', 'camera'), key('Esc', 'cancel / menu')]
      : [key('Space', 'play / pause'), key('. / ,', 'step / back'), key('V B E S', 'tools'), key('F / T', 'fit / top view'), key('R / X', 'rotate / flip'), key('Ctrl Z', 'undo'), key('C', 'hide controls'), key('Esc / P', 'menu')]
  ).join('');
}

function refreshControlsHelp() {
  $('helpControls').innerHTML = controlsHelp('sandbox');
  $('menuControls').innerHTML = controlsHelp();
  if ($('guideKeys')) $('guideKeys').innerHTML = controlsHelp('campaign');
}

input.onSourceChange((src) => {
  document.documentElement.dataset.input = src;
  updateHint();
  refreshControlsHelp();
  if (src !== 'gamepad' && src !== 'keyboard') cursor.active = false;
});
document.documentElement.dataset.input = input.source;

// ------------------------------------------------------------------ the game menu (Esc / P / Start)

function menuButton(label, fn, opts = {}) {
  return { label, fn, ...opts };
}

function openGameMenu() {
  menuWasPlaying = playing;
  menuActionTaken = false;
  setPlaying(false);
  endStroke();
  const c = campaign?.active;
  const items = [menuButton('Resume', () => setPlaying(menuWasPlaying), { primary: true })];
  if (c) {
    items.push(menuButton('Mission map', () => campaign.openMap()));
    items.push(menuButton('How to play', () => campaign.openGuide()));
    if (campaign.hintLevel < campaign.mission.hints.length) items.push(menuButton(`Show a hint (${campaign.hintLevel + 1} of ${campaign.mission.hints.length})`, () => campaign.hint()));
    if (campaign.run) items.push(menuButton('Edit start', () => campaign.rebuild()));
    items.push(menuButton(campaign.sound ? 'Sound: on' : 'Sound: off', () => campaign.toggleSound()));
    items.push(menuButton('Open the Sandbox', () => campaign.toSandbox()));
  } else {
    items.push(menuButton('Pattern library', () => openDialog('patternsDialog')));
    items.push(menuButton('New random field', () => $('randomize').click()));
    items.push(menuButton('Reset experiment', () => $('reset').click()));
    items.push(menuButton('Clear field', () => $('clear').click()));
    items.push(menuButton('Field guide', () => openDialog('helpDialog')));
    items.push(menuButton('Open the Campaign', () => campaign.toCampaign()));
  }
  items.push(menuButton(view.top ? 'Perspective view' : 'Top view', () => toggleTop()));
  items.push(menuButton('Fit the field', () => view.fit()));
  items.push(menuButton('Display settings', () => openDialog('settingsDialog')));
  items.push(menuButton('Graphics & controls', () => kit.menu.open()));
  setText($('menuTitle'), c ? `Mission ${campaign.mission.chapter} · ${campaign.mission.name}` : fieldName);
  const list = $('menuList');
  list.innerHTML = items.map((it, i) => `<button class="menu-item${it.primary ? ' primary' : ''}" data-menu="${i}">${it.label}</button>`).join('');
  list.querySelectorAll('[data-menu]').forEach((b) => {
    b.onclick = () => {
      menuActionTaken = true;
      $('gameMenu').close();
      items[Number(b.dataset.menu)].fn();
    };
  });
  $('menuControls').innerHTML = controlsHelp();
  openDialog('gameMenu');
}

// ------------------------------------------------------------------ campaign bridge

function setCursorCell(cell) {
  if (!cell) return;
  cursor.x = cell.x + 0.5;
  cursor.y = cell.y + 0.5;
  cursor.cell = { x: cell.x, y: cell.y };
}

campaign = new Campaign({
  view: () => view,
  settings: () => prefs,
  isPlaying: () => playing,
  play: setPlaying,
  step: stepOnce,
  changed,
  pushGraph,
  download,
  toast,
  closeSidebar,
  setTool,
  speed: setSpeed,
  audio,
  rumble: (s, ms) => input.rumble(s, ms),
  openDialog,
  controlsHelp,
  hintText,
  setCursorCell,
  cursorPreview: () => (cursor.active && cursor.cell ? [[cursor.cell.x, cursor.cell.y]] : null),
  canvasRect: () => {
    if (!layout.canvas) measureLayout();
    return layout.canvas;
  },
  stageRect: () => {
    if (!layout.stage) measureLayout();
    return layout.stage;
  },
  adopt: (next) => {
    life = next;
  },
  replace: (next, name, description) => {
    adoptField(next, { resetHistory: true });
    setFieldName(name, description);
    initial = snapshotField();
  },
  captureSandbox: () => ({ snapshot: snapshotField(), initial, past: [...history.past], future: [...history.future], graph: [...graph] }),
  restoreSandbox: (saved) => {
    if (!saved) return;
    life = new Life(saved.snapshot.size, saved.snapshot.wrap);
    life.restore(saved.snapshot);
    initial = saved.initial;
    history.past = saved.past;
    history.future = saved.future;
    graph = saved.graph;
    graphDirty = true;
    setFieldName(saved.snapshot.name, saved.snapshot.description);
    document.querySelector('.scene-tag').textContent = 'VOXEL FIELD';
    $('play').disabled = $('step').disabled = false;
    $('reset').title = 'Reset this experiment';
    $('reset').setAttribute('aria-label', 'Reset this experiment');
    setPlaying(false);
    changed(true);
    view.fit();
  },
});

// ------------------------------------------------------------------ DOM wiring (menus and panels)

buildPatternUI();
setSpeed(8);
initial = snapshotField();
updateStats();
fillRange($('density'));

$('play').addEventListener('click', () => {
  endStroke();
  setPlaying(!playing);
});
$('step').addEventListener('click', stepOnce);
$('backStep').addEventListener('click', undo);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('reset').addEventListener('click', () => {
  if (campaign.active) return campaign.rebuild();
  endStroke();
  pushHistory();
  restoreSnapshot(initial);
  graph = [{ generation: life.generation, population: life.population }];
  updateStats();
  toast('Experiment reset to its starting field.');
});
$('speed').addEventListener('input', (e) => setSpeed(e.target.value));
$('menuSpeed').addEventListener('input', (e) => setSpeed(e.target.value));
$('speedMore').addEventListener('click', () => setSpeed(speed === 60 ? 8 : 60));
$('density').addEventListener('input', (e) => {
  $('densityValue').textContent = `${e.target.value}%`;
  fillRange(e.target);
});
$('seed').addEventListener('input', () => (seedEdited = true));
$('randomize').addEventListener('click', () => {
  if (campaign.active) return;
  let seed;
  if (seedEdited) {
    seed = Number($('seed').value);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) {
      toast('Enter a whole-number seed from 0 to 4294967295.');
      return;
    }
  } else seed = crypto.getRandomValues(new Uint32Array(1))[0];
  setPlaying(false);
  endStroke();
  pushHistory();
  seedEdited = false;
  $('seed').value = seed;
  life.randomize(Number($('density').value) / 100, seed);
  graph = [{ generation: 0, population: life.population }];
  experiment++;
  setFieldName('Primordial soup');
  initial = snapshotField();
  $$('.preset-card').forEach((c) => c.classList.remove('active'));
  changed(true);
  view.fit();
  closeSidebar();
  toast(`New field planted. Seed ${seed}.`);
});
$('clear').addEventListener('click', () => {
  if (campaign.active) return;
  setPlaying(false);
  endStroke();
  pushHistory();
  life.clear();
  graph = [{ generation: 0, population: 0 }];
  experiment++;
  setFieldName('A blank canvas.', 'Draw a cell, or stamp the start of something new.');
  changed(true);
  setTool('draw');
  closeSidebar();
  toast('Field cleared. Use Draw or Stamp to begin.');
});
$('gridSize').addEventListener('change', (e) => resizeGrid(Number(e.target.value)));
$('wrap').addEventListener('change', (e) => {
  if (campaign.active) {
    e.target.checked = false;
    return;
  }
  pushHistory();
  life.wrap = e.target.checked;
  updateStats();
  sessionDirty = true;
  toast(life.wrap ? 'Opposite edges are now connected.' : 'The boundary is now fixed. Outside cells are dead.');
});
$$('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('brushSize').addEventListener('change', (e) => (brushSize = Number(e.target.value)));
$('stampSelect').addEventListener('change', (e) => setStamp(e.target.value));
$('rotateStamp').addEventListener('click', rotateStamp);
$('flipStamp').addEventListener('click', flipStamp);
$('zoomIn').addEventListener('click', () => view.zoom(0.8));
$('zoomOut').addEventListener('click', () => view.zoom(1.25));
$('fit').addEventListener('click', () => view.fit());
$('topView').addEventListener('click', toggleTop);
$('cinema').addEventListener('click', toggleCinema);
$('exitCinema').addEventListener('click', toggleCinema);
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Full screen is not supported by this browser.');
  } catch {
    toast('The browser did not allow full screen.');
  }
});
$('capture').addEventListener('click', capture);
$('menuOpen').addEventListener('click', openGameMenu);
$('openSidebar').addEventListener('click', () => (document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar()));
$('closeSidebar').addEventListener('click', closeSidebar);
$('drawerShade').addEventListener('click', closeSidebar);
$('allPatterns').addEventListener('click', () => openDialog('patternsDialog'));
$('patternSearch').addEventListener('input', renderCatalog);
$$('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    libraryFilter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
    renderCatalog();
  })
);
$$('.settings-open').forEach((b) => b.addEventListener('click', () => openDialog('settingsDialog')));
$$('.help-open').forEach((b) => b.addEventListener('click', () => (campaign.active ? campaign.openGuide() : openDialog('helpDialog'))));
$('kitSettings').addEventListener('click', () => kit.menu.open());
$$('.dialog-close').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog:not(.kit-menu)').forEach((d) => {
  // A click on the backdrop closes the dialog.
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
  // The button that closed a dialog must not also act in the field.
  d.addEventListener('close', () => input.settle());
});
$('gameMenu').addEventListener('close', () => {
  if (!menuActionTaken && menuWasPlaying) setPlaying(true);
  menuWasPlaying = false;
});
for (const k of Object.keys(DEFAULTS)) {
  const el = $(k);
  if (!el) continue;
  if (el.type === 'checkbox') el.checked = prefs[k];
  else el.value = prefs[k];
  el.addEventListener('change', () => {
    prefs[k] = el.type === 'checkbox' ? el.checked : el.value;
    view.configure(prefs);
    savePrefs();
  });
}
$('importOpen').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => importFile(e.target.files[0]));
$('exportOpen').addEventListener('click', () => openDialog('exportDialog'));
$('exportJSON').addEventListener('click', () => {
  download(new Blob([JSON.stringify(toSession(life, fieldName), null, 2)], { type: 'application/json' }), fileName('json'));
  closeDialogs();
  toast('Session exported.');
});
$('exportRLE').addEventListener('click', () => {
  download(new Blob([toRLE(life, fieldName)], { type: 'text/plain' }), fileName('rle'));
  closeDialogs();
  toast('RLE pattern exported.');
});
$('exportPNG').addEventListener('click', () => {
  closeDialogs();
  capture();
});
$('restoreSession').addEventListener('click', () => {
  if (campaign.active) return;
  try {
    const restored = fromSession(savedSession);
    setPlaying(false);
    pushHistory();
    adoptField(restored.life);
    experiment++;
    setFieldName(restored.name);
    initial = snapshotField();
    view.fit();
    $('restoreSession').hidden = true;
    closeSidebar();
    toast('Last session restored.');
  } catch (err) {
    toast(err.message);
  }
});
$$('.rule-example').forEach((el) => {
  const on = el.dataset.example === 'birth' ? [1, 3, 7] : el.dataset.example === 'survival' ? [1, 4, 7] : [4, 7];
  el.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${on.includes(i) ? 'on ' : ''}${i === 4 ? 'center' : ''}"></i>`).join('');
});
document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  if (document.hidden) {
    endStroke();
    saveSession();
  }
});
addEventListener('pagehide', saveSession);
addEventListener('blur', endStroke);

// ------------------------------------------------------------------ renderer readouts

function updateDiagnostics() {
  const tier = kit.tier.name;
  setText($('qualityLabel'), tier.toUpperCase());
  setText($('renderEngine'), kit.backendLabel.toUpperCase());
  setText($('diagnostics'), `${kit.backendLabel} · ${tier} quality · pixel ratio ${kit.renderer.getPixelRatio().toFixed(2)} · three.js r${THREE.REVISION}`);
}
kit.onQuality(() => updateDiagnostics());
kit.onPause((paused) => {
  audio.suspend(paused);
  if (paused) endStroke();
});
updateDiagnostics();

// ------------------------------------------------------------------ per-frame input

const repeats = new Map();
/** true on the press, then again every `rate` ms while held (after `delay`). */
function repeating(name, now, delay = 380, rate = 85) {
  if (input.pressed(name)) {
    repeats.set(name, now + delay);
    return true;
  }
  if (input.down(name) && now >= (repeats.get(name) ?? Infinity)) {
    repeats.set(name, now + rate);
    return true;
  }
  return false;
}

let nudgeHeld = null;
let nudgeAt = 0;
/** One-cell steps from the arrows / D-pad, with key-repeat. Returns [dx, dy] in screen terms or null. */
function nudgeStep(now) {
  const v = input.vector('nudge');
  const dir = Math.abs(v.x) >= Math.abs(v.y) ? (v.x ? [Math.sign(v.x), 0] : null) : [0, Math.sign(v.y)];
  const id = dir ? dir.join(',') : null;
  if (nudgeHeld === 'held') {
    if (!id) nudgeHeld = null;
    return null;
  }
  if (id !== nudgeHeld) {
    nudgeHeld = id;
    nudgeAt = now + 380;
    return dir;
  }
  if (dir && now >= nudgeAt) {
    nudgeAt = now + 90;
    return dir;
  }
  return null;
}

const camForward = new THREE.Vector3();
/** Camera-relative screen direction (right, up) to board axes. */
function screenToBoard(sx, sy) {
  camForward.copy(view.rig.target).sub(view.camera.position);
  let fx = camForward.x;
  let fz = camForward.z;
  const len = Math.hypot(fx, fz);
  if (len < 1e-6) {
    fx = 0;
    fz = -1;
  } else {
    fx /= len;
    fz /= len;
  }
  // right = forward × up
  const rx = -fz;
  const rz = fx;
  return [rx * sx + fx * sy, rz * sx + fz * sy];
}

function snapToAxis([bx, by]) {
  return Math.abs(bx) >= Math.abs(by) ? [Math.sign(bx), 0] : [0, Math.sign(by)];
}

function cursorCellNow() {
  const n = life.size;
  return { x: Math.max(0, Math.min(n - 1, Math.floor(cursor.x))), y: Math.max(0, Math.min(n - 1, Math.floor(cursor.y))) };
}

const followVec = new THREE.Vector3();
let lastPointer = { x: -1, y: -1 };
let touchPending = null;
let gesture = false;
let hoverShown = false;

function modalRoot() {
  const d = topDialog();
  if (d) return d;
  if (document.body.classList.contains('sidebar-open')) return $('sidebar');
  return null;
}

function closeModal(root) {
  if (root.tagName === 'DIALOG') root.close();
  else closeSidebar();
}

/** Escape: back out of whatever is in front, and open the menu when nothing is. */
function escapeCascade() {
  if (stroke) return endStroke();
  if (cinema) return toggleCinema();
  if (campaign.active && campaign.resultShown) return campaign.inspectResult();
  if (campaign.active && campaign.candidate && !campaign.run) return campaign.cancelPreview();
  openGameMenu();
}

function backCascade() {
  if (stroke) return endStroke();
  if (cinema) return toggleCinema();
  if (campaign.active && campaign.resultShown) return campaign.inspectResult();
  if (campaign.active && campaign.candidate && !campaign.run) return campaign.cancelPreview();
  if (cursor.active) {
    cursor.active = false;
    clearHover();
  }
}

function frameInput(dt, now) {
  const root = modalRoot();
  if (root) {
    if (stroke) endStroke();
    // Keys and buttons held while a menu is up must not auto-repeat into the field after it closes.
    repeats.clear();
    const v = input.vector('nudge');
    nudgeHeld = v.x || v.y ? 'held' : null;
    nudgeAt = Infinity;
    if (input.pressed('escape') || input.pressed('back') || input.pressed('menu')) closeModal(root);
    else menuNav.update(root, now);
    return;
  }
  menuNav.update(null);
  const p = input.pointer;
  const mod = input.down('mod');

  if (input.pressed('menu')) return openGameMenu();
  if (input.pressed('escape')) escapeCascade();
  if (input.pressed('back')) backCascade();

  // The result card answers directly: A / Enter next (or edit on failure), Y edit start.
  if (campaign.active && campaign.resultShown) {
    if (input.pressed('act')) {
      if (campaign.run.result.status === 'success') campaign.nextMission();
      else campaign.rebuild();
      return;
    }
    if (input.source === 'gamepad' && input.pressed('rotate')) {
      campaign.rebuild();
      return;
    }
  }

  if (mod) {
    if (input.pressed('undoKey')) (input.down('shift') ? redo : undo)();
  } else {
    if (input.pressed('play')) {
      endStroke();
      setPlaying(!playing);
    }
    if (repeating('step', now)) stepOnce();
    if (repeating('stepBack', now)) undo();
    if (campaign.active) {
      if (input.pressed('toolOrbit')) campaign.setMode('orbit');
      if (input.pressed('toolDraw') || input.pressed('toolStamp')) campaign.selectPiece(campaign.selected, { sound: true });
      if (input.pressed('toolErase')) campaign.setMode('remove');
      if (input.pressed('toolNext')) campaign.nextMode();
      if (input.pressed('rotate')) campaign.rotate();
      if (input.pressed('flip')) campaign.flipPiece();
    } else {
      if (input.pressed('toolOrbit')) setTool('orbit');
      if (input.pressed('toolDraw')) setTool('draw');
      if (input.pressed('toolErase')) setTool('erase');
      if (input.pressed('toolStamp')) setTool('stamp');
      if (input.pressed('toolNext')) setTool(TOOLS[(TOOLS.indexOf(tool) + 1) % TOOLS.length]);
      if (input.pressed('rotate') && tool === 'stamp') rotateStamp();
      if (input.pressed('flip') && tool === 'stamp') flipStamp();
    }
    if (input.pressed('fit')) view.fit();
    if (input.pressed('top')) toggleTop();
    if (input.pressed('cinema')) toggleCinema();
    if (input.pressed('help')) {
      if (campaign.active) campaign.openGuide();
      else openDialog('helpDialog');
      return;
    }
    if (input.pressed('grid')) $('gridLines').click();
    if (input.pressed('trails')) $('trails').click();
  }

  // ---- camera: zoom (wheel, pinch, keys, bumpers)
  const z = input.zoom();
  if (z) {
    if (p.type === 'touch') view.zoom(Math.exp(-z / 4));
    else view.zoom(Math.exp(-z * 0.045), p.over ? p.nx : null, p.over ? p.ny : null);
  }
  if (input.pressed('zoomIn')) view.zoom(0.8);
  if (input.pressed('zoomOut')) view.zoom(1.25);
  if (input.down('zoomIn') && !input.pressed('zoomIn')) view.zoom(Math.exp(-1.3 * dt));
  if (input.down('zoomOut') && !input.pressed('zoomOut')) view.zoom(Math.exp(1.3 * dt));

  // ---- camera: right stick orbits, pointer drags orbit or pan
  const stickLook = input.look('orbit');
  if (stickLook.x || stickLook.y) {
    view.takeCamera();
    if (view.top) view.rig.pan(stickLook.x * 260, stickLook.y * 260, kit.size.height);
    else view.rig.rotate(stickLook.x * 1.4, stickLook.y * 1.4);
  }
  const drag = input.look('drag');
  if (drag.x || drag.y) {
    const s = kit.settings.get();
    const touch = p.type === 'touch';
    const k = (touch ? TOUCH_LOOK : MOUSE_LOOK) * (s.lookSensitivity || 1);
    const px = drag.x / k;
    const py = drag.y / (k * (s.invertY ? -1 : 1));
    const h = kit.size.height || 1;
    const viewing = campaign.active ? campaign.mode === 'orbit' || !!campaign.run : tool === 'orbit';
    if (!touch && input.down('pan')) {
      view.takeCamera();
      view.rig.pan(px, py, h);
    } else if (viewing && (touch ? !gesture : input.down('paint'))) {
      view.takeCamera();
      if (view.top) view.rig.pan(px, py, h);
      else view.rig.rotate((TWO_PI * 0.65 * px) / h, (TWO_PI * 0.65 * py) / h);
    }
  }

  // ---- pointer: hover, click and drag with the mouse, tap and drag on touch
  const moved = p.x !== lastPointer.x || p.y !== lastPointer.y;
  if (moved) {
    lastPointer.x = p.x;
    lastPointer.y = p.y;
  }
  if (p.type !== 'touch') {
    if (moved && p.over) {
      cursor.active = false;
      const cell = view.pick(p.nx, p.ny);
      if (cell) {
        showHover(cell);
        hoverShown = true;
        if (!stroke) {
          if (!layout.canvas) measureLayout();
          showInspector(cell, p.x + layout.canvas.left - layout.stage.left, p.y + layout.canvas.top - layout.stage.top);
        } else $('inspector').hidden = true;
      } else if (hoverShown) {
        clearHover();
        hoverShown = false;
      }
    } else if (!p.over && !p.down && hoverShown && !cursor.active) {
      clearHover();
      hoverShown = false;
    }
    if (input.pressed('paint') && tool !== 'orbit') beginStroke(view.pick(p.nx, p.ny), 'mouse');
    if (stroke?.device === 'mouse') {
      if (!input.down('paint')) endStroke();
      else if (moved && tool !== 'stamp') continueStroke(view.pick(p.nx, p.ny));
    }
  } else {
    if (p.justDown) {
      gesture = false;
      touchPending = tool !== 'orbit' ? { t: now, x: p.x, y: p.y, nx: p.nx, ny: p.ny } : null;
    }
    if (z && p.down) {
      // A second finger: this is a pinch, not a stroke.
      gesture = true;
      touchPending = null;
      endStroke();
    }
    if (touchPending && !gesture) {
      const far = Math.hypot(p.x - touchPending.x, p.y - touchPending.y) > 5;
      if (p.justUp || far || now - touchPending.t > 110) {
        const cell = view.pick(touchPending.nx, touchPending.ny);
        touchPending = null;
        beginStroke(cell, 'touch');
      }
    }
    if (p.down && moved && !gesture) {
      const cell = view.pick(p.nx, p.ny);
      if (cell) {
        showHover(cell);
        if (stroke?.device === 'touch' && tool !== 'stamp') continueStroke(cell);
      }
    }
    if (p.justUp) {
      if (stroke?.device === 'touch') endStroke();
      touchPending = null;
      gesture = false;
      // The finger left the glass: drop the brush preview (a placed piece keeps its own).
      if (!cursor.active) clearHover();
    }
  }

  // ---- keyboard / gamepad cursor on the board
  const stick = input.vector('cursor');
  const step = nudgeStep(now);
  let cursorMoved = false;
  if (stick.x || stick.y) {
    if (!cursor.active) setCursorCell(hoverCell || campaign.candidateCenter?.() || { x: Math.floor(life.size / 2), y: Math.floor(life.size / 2) });
    cursor.active = true;
    const rate = Math.max(7, life.size / 5) * dt;
    const [bx, by] = screenToBoard(stick.x, stick.y);
    cursor.x = Math.max(0, Math.min(life.size - 0.001, cursor.x + bx * rate));
    cursor.y = Math.max(0, Math.min(life.size - 0.001, cursor.y + by * rate));
    cursorMoved = true;
  }
  if (step) {
    const [bx, by] = snapToAxis(screenToBoard(step[0], step[1]));
    if (campaign.active && campaign.mode === 'place' && campaign.candidate && !campaign.run) {
      campaign.nudge(bx, by);
      cursor.active = true;
    } else {
      if (!cursor.active) setCursorCell(hoverCell || { x: Math.floor(life.size / 2), y: Math.floor(life.size / 2) });
      cursor.active = true;
      cursor.x = Math.max(0, Math.min(life.size - 0.001, Math.floor(cursor.x) + bx + 0.5));
      cursor.y = Math.max(0, Math.min(life.size - 0.001, Math.floor(cursor.y) + by + 0.5));
      cursorMoved = true;
    }
  }
  if (cursor.active) {
    const cell = cursorCellNow();
    const changedCell = !cursor.cell || cell.x !== cursor.cell.x || cell.y !== cursor.cell.y;
    cursor.cell = cell;
    if (changedCell || cursorMoved) {
      if (campaign.active && campaign.mode === 'place' && !campaign.run) campaign.moveCandidateTo(cell);
      else if (campaign.active) campaign.showPreview();
      else showHover(cell);
      if (stroke?.device === 'pad' && changedCell && tool !== 'stamp') continueStroke(cell);
    }
    // Keep the cursor in view: ease the camera toward it near the screen edge.
    const n = life.size;
    followVec.set(cell.x - n / 2 + 0.5, 0, cell.y - n / 2 + 0.5).project(view.camera);
    if (Math.abs(followVec.x) > 0.72 || Math.abs(followVec.y) > 0.72) {
      const wx = cell.x - n / 2 + 0.5 - view.rig.target.x;
      const wz = cell.y - n / 2 + 0.5 - view.rig.target.z;
      view.takeCamera();
      view.rig.panOffset.x += wx * Math.min(1, 2 * dt);
      view.rig.panOffset.z += wz * Math.min(1, 2 * dt);
    }
    if (cursorMoved || view.cameraMoved) {
      if (!layout.canvas) measureLayout();
      const sp = view.cellToScreen(cell.x, cell.y, layout.canvas);
      showInspector(cell, sp.x - layout.stage.left, sp.y - layout.stage.top);
    }
  }

  // ---- A / Enter: use the tool at the cursor
  if (input.pressed('act') && !(campaign.active && campaign.resultShown)) {
    const pad = input.source === 'gamepad';
    if (pad && !cursor.active) {
      // First press without moving: start the cursor where the player is looking.
      setCursorCell((campaign.active && campaign.candidateCenter()) || hoverCell || { x: Math.floor(life.size / 2), y: Math.floor(life.size / 2) });
      cursor.active = true;
    }
    const cell = cursor.active ? cursorCellNow() : null;
    if (campaign.active) campaign.actAt(cell, !pad && !cursor.active);
    else if (cell) {
      if (tool === 'orbit') setTool('draw');
      beginStroke(cell, 'pad');
    }
  }
  if (stroke?.device === 'pad' && !input.down('act')) endStroke();
}

// ------------------------------------------------------------------ the loop

let frames = 0;
let fpsAt = 0;
let fps = 0;
let autosaveAt = performance.now();

function frame(dt) {
  const now = performance.now();
  frameInput(dt, now);
  if (playing) {
    const interval = 1 / speed;
    accumulator = Math.min(accumulator + dt, interval * 8);
    let steps = 0;
    let stepped = false;
    const t0 = performance.now();
    while (accumulator >= interval && steps < 8 && performance.now() - t0 < 9) {
      advance(1, false);
      accumulator -= interval;
      steps++;
      stepped = true;
      if (!playing) break;
    }
    if (stepped) changed();
  }
  view.render(now, dt);
  campaign.drawOverlay(view.cameraMoved);
  if (graphDirty && now - graphDrawnAt > 110) {
    graphDirty = false;
    graphDrawnAt = now;
    drawGraph();
  }
  frames++;
  if (!fpsAt) fpsAt = now;
  if (now - fpsAt >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsAt));
    frames = 0;
    fpsAt = now;
    setText($('fps'), String(fps));
    setText($('detailLabel'), view.detail);
    setText($('viewMode'), view.top ? 'TOP VIEW' : 'PERSPECTIVE');
    $('topView').setAttribute('aria-pressed', String(view.top));
    measureLayout();
  }
  if (now - autosaveAt > 10000) {
    autosaveAt = now;
    saveSession();
  }
}

// ------------------------------------------------------------------ start

window.emergence = {
  ready: false,
  getState: () => ({ ...toSession(life, fieldName), playing, tool, speed, history: history.past.length, renderer: kit.backend }),
  pause: () => setPlaying(false),
  play: () => setPlaying(true),
  step: stepOnce,
  loadPattern,
  projectCell: (x, y) => view.cellToScreen(x, y),
  getSettings: () => ({ ...prefs }),
  getDiagnostics: () => ({ fps, renderer: kit.backend, tier: kit.tier.name, detail: view.detail, drawCalls: kit.renderer.info.render.calls, triangles: kit.renderer.info.render.triangles }),
  setCell: (x, y, alive) => {
    if (campaign.active || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    setPlaying(false);
    pushHistory();
    life.set(x, y, alive);
    changed(true);
    return true;
  },
};

view.sync(life, true);
setTool('orbit');
refreshControlsHelp();
campaign.boot();
setPlaying(false);
campaign.syncMarkers();
campaign.refresh();
measureLayout();
// Compile the voxel, floor and marker pipelines before the first frame, so the field does not hitch in.
await kit.renderer.compileAsync(view.scene, view.camera).catch(() => {});
kit.start(frame);
window.emergence.ready = true;
