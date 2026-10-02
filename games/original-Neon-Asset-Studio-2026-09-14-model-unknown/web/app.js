/**
 * Neon Asset Studio: the editor interface. The 3D view runs on the shared kit
 * (three.js r186, WebGPU with WebGL2 fallback); keyboard shortcuts, gamepad and
 * touch gestures come through kit.input.
 */
import { boot } from 'kit/boot.js';
import { initialState, clone, getAsset, runCommand, reportAsset, packState, unpackState, MUTATING_COMMANDS } from '../core/document.js';
import { hexColor, rgbaHex, round, boundsOf, rotatePoint, vadd, vsub } from '../core/math.js';
import { nativeData, nativeTypeScript, exportGLB, exportOBJ, zipFiles, handoffFiles, safeFilename } from '../core/export.js';
import { NEON_SOURCE, NEON_PALETTE } from '../adapters/neon-fare.js';
import { TOOLS, checkToolArgs } from '../core/tools.js';
import { Viewport, setupRenderer } from './renderer.js';

const $ = (selector) => document.querySelector(selector), $$ = (selector) => [...document.querySelectorAll(selector)];
const E = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
 plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',cube:'m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5m-9 5v9',branch:'M6 8v8m0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15c0-5 12-1 12-7',terminal:'m5 7 5 5-5 5m8 0h6M3 2h18v20H3z',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',save:'M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8',export:'M13 3h8v8m0-8L10 14M10 3H3v18h18v-7',chevron:'m7 10 5 5 5-5',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 9 3 3 7-7',move:'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',rotate:'M3 10a9 9 0 1 1 2 9M3 3v7h7',scale:'M4 14v6h6M14 4h6v6M20 4 4 20M4 4h5M4 4v5M20 20h-5M20 20v-5',undo:'M3 10h11a7 7 0 0 1 0 14M3 10l6-6M3 10l6 6',redo:'M21 10H10a7 7 0 0 0 0 14M21 10l-6-6M21 10l-6 6',compare:'M3 4h18v16H3zM12 2v20M6 8h3M15 16h3',frame:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',camera:'M3 7h4l2-3h6l2 3h4v14H3Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',mouse:'M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6Zm0 0v7',copy:'M8 8h13v13H8zM16 8V3H3v13h5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',play:'m6 3 14 9-14 9Z',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',eyeoff:'M3 3 21 21M8 5c7-3 14 7 14 7l-3 4M16 19C9 22 2 12 2 12l3-4',lock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4',unlock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0',check:'m5 12 4 4L20 5',mirror:'M12 2v20M3 18l6-6-6-6ZM21 18l-6-6 6-6Z',
 gear:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
 pad:'M6 9h4M8 7v4M15 10h.01M18 8h.01M7.5 4h9A5.5 5.5 0 0 1 22 9.5v4a4.5 4.5 0 0 1-8 2.8l-.6-.8h-2.8l-.6.8a4.5 4.5 0 0 1-8-2.8v-4A5.5 5.5 0 0 1 7.5 4Z',
 touch:'M9 11V5a2 2 0 1 1 4 0v5l4.4 1.1a2 2 0 0 1 1.5 2.3L18 19a3 3 0 0 1-3 2h-3.5a3 3 0 0 1-2.4-1.2L5.5 15a1.8 1.8 0 0 1 2.6-2.4L9 13.5'};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.cube}"/></svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach((n) => (n.innerHTML = icon(n.dataset.icon))); }
icons();

/** Action names for kit.input. Ctrl/⌘ shortcuts are handled separately so browser shortcuts keep working. */
const ACTIONS = {
  orbit: { type: 'look', mouse: 'locked', gamepad: 'rightStick' },
  pan: { type: 'vector', gamepad: 'leftStick' },
  nav: { type: 'vector', gamepad: 'dpad' },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  nudgeX: { type: 'axis', keys: { pos: ['ArrowRight'], neg: ['ArrowLeft'] } },
  nudgeY: { type: 'axis', keys: { pos: ['ArrowUp'], neg: ['ArrowDown'] } },
  nudgeZ: { type: 'axis', keys: { pos: ['PageUp'], neg: ['PageDown'] } },
  coarse: { keys: ['ShiftLeft', 'ShiftRight'] },
  frame: { keys: ['KeyF'], gamepad: ['A'] },
  confirm: { gamepad: ['A'] },
  back: { keys: ['Escape'], gamepad: ['B'] },
  toolMove: { keys: ['KeyW'] },
  toolRotate: { keys: ['KeyE'] },
  toolScale: { keys: ['KeyR'] },
  toolNext: { gamepad: ['X'] },
  compare: { keys: ['KeyC'], gamepad: ['Y'] },
  undo: { gamepad: ['LT'] },
  redo: { gamepad: ['RT'] },
  isolate: { keys: ['KeyI'], gamepad: ['Back'] },
  help: { keys: ['F1'], gamepad: ['Start'] },
  remove: { keys: ['Delete', 'Backspace'] },
  search: { keys: ['Slash'] },
  home: { keys: ['Home'], gamepad: ['LS'] },
  nextView: { gamepad: ['RS'] },
  view1: { keys: ['Digit1', 'Numpad1'] },
  view2: { keys: ['Digit2', 'Numpad2'] },
  view3: { keys: ['Digit3', 'Numpad3'] },
  view4: { keys: ['Digit4', 'Numpad4'] },
  view5: { keys: ['Digit5', 'Numpad5'] },
  view6: { keys: ['Digit6', 'Numpad6'] },
};
const VIEWS = ['perspective', 'front', 'rear', 'side', 'top', 'rear-quarter'];
const VIEW_LABELS = { perspective: 'PERSPECTIVE', front: 'FRONT', rear: 'REAR', side: 'SIDE', top: 'TOP', 'rear-quarter': 'REAR 3/4' };
const TEMPLATE_NAMES = { van: 'Delivery van', 'food-truck': 'Food truck', 'bus-shelter': 'Bus shelter', scooter: 'Delivery scooter', building: 'Small building', tree: 'Simple tree', box: 'Single box', blank: 'Untitled asset' };

const kit = await boot({
  title: 'Neon Asset Studio',
  mount: $('#viewport-wrap'),
  canvas: $('#viewport'),
  renderer: { alpha: true },
  gear: 'none',
  touch: false,
  accent: '#c7ef91',
  background: '#151b19',
  input: ACTIONS,
});
const input = kit.input;

let state, view, thumbView, selected = [], category = 'All', tab = 'properties', mode = 'translate', compareActive = false, drag = null, nudge = null, gesture = null, busy = 0, localPersistent = true, toastTimer, vertexIndex = 0, ready = false, currentView = 'perspective';
const thumbs = new Map(), thumbQueue = new Map(), touches = new Map(), STORAGE = 'neon-asset-studio-v1', PREFS = 'neon-asset-studio-view';
const prefs = { grid: true, wireframe: false, clay: false, collisions: false, snap: false, isolate: false };
let commandQueue = Promise.resolve(), thumbRunning = false;

function toast(text, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').className = 'show' + (error ? ' error' : '');
  toastTimer = setTimeout(() => ($('#toast').className = ''), error ? 6500 : 3200);
}
function asset() { return getAsset(state); }
// A phone or tablet without a mouse starts with touch prompts, before the first tap.
const coarseOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const sourceNow = () => (input.source === 'keyboard' && coarseOnly ? 'touch' : input.source);
const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function loadState() {
  let migrated = false;
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      const s = JSON.parse(saved);
      migrated = s?.version === 1;
      state = unpackState(s);
    } else state = initialState();
  } catch (e) {
    state = initialState();
    localPersistent = false;
    toast('Saved browser work could not be opened. This session is in memory. Export your work. ' + e.message, true);
  }
  // A version 1 save held every asset and its undo copies; rewrite it compactly at once.
  if (migrated) persist();
}
function persist() {
  if (!localPersistent) return;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(packState(state)));
  } catch {
    localPersistent = false;
    toast('Browser storage is full. Your work continues in memory. Use Save project or Export to keep it.', true);
  }
}
function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS) || '{}')); } catch { /* defaults */ }
}
function savePrefs() {
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* a convenience only */ }
}

function send(c) {
  const task = commandQueue.then(async () => {
    busy++;
    $('#save-status').textContent = 'Applying command…';
    try {
      const { op, ...args } = c;
      checkToolArgs(op, args);
      let result;
      if (c.op === 'verify_repo') throw new Error('Source verification needs the local server. Start npm start.');
      else if (c.op === 'render_views' || c.op === 'export_asset') throw new Error('This command needs the local server. Use the camera and Export controls in browser mode.');
      else if (c.op === 'get_reference') {
        const r = getAsset(state, c.assetId).references[c.index];
        if (!r) throw new Error('Reference not found.');
        result = r;
      } else {
        const out = runCommand(state, c);
        result = out.result;
        if (MUTATING_COMMANDS.includes(c.op)) {
          state = out.state;
          persist();
        }
      }
      if (MUTATING_COMMANDS.includes(c.op)) {
        compareActive = false;
        const switched = ['create_asset', 'duplicate_asset', 'import_asset', 'set_active_asset'].includes(c.op);
        if (switched) { selected = []; vertexIndex = 0; }
        refresh(switched);
      }
      return result;
    } catch (e) {
      toast(e.message, true);
      throw e;
    } finally {
      busy--;
      saveLabel();
    }
  });
  commandQueue = task.catch(() => {});
  return task;
}
/** Send from a button or key: failures are already shown as a toast. */
const run = (c) => send(c).catch(() => null);
function edits(list) { const a = asset(); return send({ op: 'apply_edits', assetId: a.id, expectedRevision: a.revision, edits: list }); }
function saveLabel() {
  if (!state) return;
  $('#save-status').textContent = localPersistent ? 'Saved in this browser' : 'Memory only · export to save';
  $('#session-label').textContent = 'Browser workspace · ' + kit.backendLabel;
  $('#agent-status').textContent = 'JSON CONSOLE';
}
function setMode(next) {
  mode = next;
  view.mode = next;
  ['translate', 'rotate', 'scale'].forEach((v) => $('#tool-' + v).classList.toggle('active', v === next));
  view.dirty = true;
}
function setSelection(ids) {
  if (nudge) commitNudge();
  selected = [...new Set(ids)].filter((id) => asset().parts.some((p) => p.id === id));
  vertexIndex = 0;
  compareActive = false;
  renderInspector();
  renderParts();
  updateViewport();
  $('#selection-status').textContent = selected.length ? `${selected.length} part${selected.length > 1 ? 's' : ''} selected` : 'No part selected';
}
function updateViewport(fit = false) {
  const a = asset();
  view.isolated = prefs.isolate && !compareActive;
  view.setAsset(compareActive ? state.originals[a.id] || a : a, { fit, selected: compareActive ? [] : selected });
  view.mode = mode;
  $('#compare').classList.toggle('active', compareActive);
  $('#original-label').hidden = !compareActive;
}
function refresh(fit = false) {
  const a = asset(), r = reportAsset(a);
  selected = selected.filter((id) => a.parts.some((p) => p.id === id));
  $('#asset-title').textContent = a.name;
  $('#breadcrumb').innerHTML = `Workspace <span>/</span> ${E(a.category)}`;
  $('#asset-tag').textContent = a.source ? 'SOURCE SAMPLE' : 'NEW ASSET';
  $('#revision-tag').textContent = 'REV ' + String(a.revision).padStart(2, '0');
  $('#stat-parts').textContent = r.visibleParts;
  $('#stat-triangles').textContent = r.triangles.toLocaleString();
  $('#stat-dimensions').textContent = r.bounds.size.map((n) => n.toFixed(2)).join(' × ');
  $('#asset-count').textContent = state.assets.length;
  $('#undo').disabled = !state.undo[a.id]?.length;
  $('#redo').disabled = !state.redo[a.id]?.length;
  $('#selection-status').textContent = selected.length ? selected.length + ' part' + (selected.length > 1 ? 's' : '') + ' selected' : 'No part selected';
  renderCategories();
  renderLibrary();
  renderInspector();
  renderParts();
  updateViewport(fit);
  saveLabel();
}

// ---- Library thumbnails: drawn one at a time off-screen, after the editor is up.
function thumbFor(a) {
  const t = thumbs.get(a.id);
  if (t && t.revision === a.revision) return t.url;
  const key = a.id + ':' + a.revision;
  if (!thumbQueue.has(key)) thumbQueue.set(key, a);
  if (!thumbRunning) pumpThumbs();
  return '';
}
async function pumpThumbs() {
  thumbRunning = true;
  try {
    while (thumbQueue.size) {
      const [key, a] = thumbQueue.entries().next().value;
      thumbQueue.delete(key);
      if (state.assets.find((x) => x.id === a.id)?.revision !== a.revision) continue;
      let url = '';
      try {
        thumbView.setAsset(a, { fit: true, selected: [] });
        url = await thumbView.snapshot();
      } catch (e) {
        console.warn('Thumbnail failed', a.id, e);
      }
      thumbs.set(a.id, { revision: a.revision, url });
      if (url) for (const img of $$('#asset-grid img[data-thumb]')) if (img.dataset.thumb === key) img.src = url;
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    thumbRunning = false;
  }
}

function renderCategories() {
  const values = ['All', 'Vehicles', 'People', 'Buildings', 'Furniture', 'Props', 'Custom'];
  $('#categories').innerHTML = values.map((c) => `<button data-category="${c}" class="${c === category ? 'active' : ''}">${c}</button>`).join('');
}
function libraryList() {
  const query = $('#asset-search').value.toLowerCase().trim();
  return state.assets.filter((a) => (category === 'All' || a.category === category) && (!query || [a.name, a.category, a.source?.function, a.source?.path].join(' ').toLowerCase().includes(query)));
}
function renderLibrary() {
  const list = libraryList();
  $('#filter-label').textContent = category === 'All' ? 'ALL ASSETS' : category.toUpperCase();
  $('#visible-count').textContent = list.length + ' assets';
  const grid = $('#asset-grid'), scroll = grid.scrollTop;
  grid.innerHTML = list.length
    ? list.map((a) => {
      const url = thumbFor(a);
      return `<button class="asset-card ${a.id === state.activeAssetId ? 'active' : ''}" data-asset="${E(a.id)}" aria-label="Open ${E(a.name)}"><img ${url ? `src="${url}"` : ''} data-thumb="${E(a.id + ':' + a.revision)}" alt=""><span class="card-name">${E(a.name)}</span><span class="card-meta">${a.parts.length} PARTS · ${E(a.category.toUpperCase())}</span></button>`;
    }).join('')
    : '<div class="blank-library">No assets match this search.</div>';
  grid.scrollTop = scroll;
}
function vectorFields(label, field, values, { rotation = false } = {}) {
  return `<label class="field-label">${label}</label><div class="vector">${values.map((v, i) => `<label><span>${['X', 'Y', 'Z'][i]}</span><input class="number-input" type="number" step="${rotation ? '1' : '.05'}" data-field="${field}" data-axis="${i}" aria-label="${label} ${['X', 'Y', 'Z'][i]}" value="${round(rotation ? v * 180 / Math.PI : v, 4)}"></label>`).join('')}</div>`;
}
function renderInspector() {
  const a = asset(), chosen = a.parts.filter((p) => selected.includes(p.id)), p = chosen[0], root = $('#inspector-content');
  let html = '';
  $$('.inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'source') {
    html = `<div class="section-label">SOURCE RECORD</div><div class="summary-title">${a.source ? 'Neon Fare source sample' : 'Standalone asset'}</div>${a.source ? `<div class="source-path">${E(a.source.repository)}<br><br>${E(a.source.path)}<br>${E(a.source.function)}()</div><div class="key-value"><span>Commit</span><span>${E(a.source.commit.slice(0, 12))}</span></div><div class="key-value"><span>Import mode</span><span>Reviewed source adapter</span></div><div class="section-label" style="margin-top:16px">GENERATION INPUTS</div><div class="source-path">${E(JSON.stringify(a.source.parameters, null, 2))}</div>` : '<p class="mini-help">This asset was created in the editor. It does not depend on a game repo.</p>'}<div class="notice">${E(a.source ? 'This is a fixed source-based sample, not a live repo link. Changes remain in the editor.' : 'Export the handoff package for a coding agent to add this asset to a game.')}</div>${(a.notes || []).map((n) => `<p class="mini-help">${E(n)}</p>`).join('')}<button class="wide" id="inspector-repo">${icon('branch')}Source and coverage</button><div class="property-section"><div class="section-label">REFERENCE IMAGES</div><div class="references">${(a.references || []).map((r, i) => `<div class="reference-card"><img src="${E(r.data)}" alt="${E(r.name)}" title="${E(r.name)}"><button data-remove-reference="${i}" aria-label="Remove reference ${E(r.name)}">×</button></div>`).join('')}</div><button class="wide" id="add-reference">${icon('plus')}Add reference image</button><p class="mini-help">PNG, JPEG, or WebP. Up to 2 MB each. An external AI agent can read these with get_reference.</p></div>`;
  } else if (tab === 'collision') {
    html = '<div class="section-label">COLLISION SHAPES</div><p class="mini-help">These boxes are separate from visible geometry. Turn on Collision in the view to inspect them.</p>';
    if (!a.colliders.length) html += '<div class="notice">No collision shapes are included for this asset. The game agent must check or add them during integration.</div>';
    for (const [i, c] of a.colliders.entries()) html += `<div class="property-section"><div class="summary-title">${E(c.id)}</div>${['x', 'y', 'baseZ', 'halfX', 'halfY', 'height'].map((k) => `<div class="key-value"><span>${k}</span><input class="number-input" type="number" step=".1" style="max-width:105px;padding-left:7px" data-collider="${i}" data-key="${k}" aria-label="Collider ${E(c.id)} ${k}" value="${round(c[k] || 0)}"></div>`).join('')}</div>`;
    html += '<div class="notice">Visual edits do not change collision shapes automatically. Check the game before you replace an asset.</div>';
  } else if (chosen.length === 1) {
    const locked = p.locked;
    if (p.kind === 'mesh') vertexIndex = Math.min(vertexIndex, p.vertices.length - 1);
    html = `<div class="section-label">SELECTED PART</div><div class="inspector-summary"><div class="summary-icon">${icon('cube')}</div><div><div class="summary-title">${E(p.kind === 'box' ? 'Box primitive' : 'Polygon mesh')}</div><div class="summary-meta">${E(p.id)}${p.role ? ' · ' + E(p.role) : ''}</div></div></div><fieldset ${locked || compareActive ? 'disabled' : ''}><label class="field-label" for="part-name">Part name</label><input class="text-input" id="part-name" value="${E(p.name)}"><div class="property-section"><div class="section-label">TRANSFORM</div>${vectorFields('Position', 'position', p.position)}${vectorFields('Rotation · degrees', 'rotation', p.rotation, { rotation: true })}${p.kind === 'box' ? vectorFields('Box size', 'size', p.size) : ''}${vectorFields('Scale', 'scale', p.scale)}</div><div class="property-section"><div class="section-label">APPEARANCE</div><div class="color-row"><input type="color" id="part-color" value="${hexColor(p.color)}" aria-label="Part color"><input class="text-input" id="part-hex" value="${hexColor(p.color)}" aria-label="Color hex value"><span class="mini-help">Flat color</span></div><div class="palette">${Object.entries(NEON_PALETTE).map(([name, c]) => `<button class="swatch" style="--swatch:${hexColor(c)}" data-color="${hexColor(c)}" title="${name}" aria-label="Set color ${name}"></button>`).join('')}</div><label class="field-label" style="margin-top:13px">Game material</label><select id="part-material" style="width:100%">${[...new Set([p.material, 'MAT_BUILDING', 'MAT_VEHICLE', 'MAT_PLAYER', 'MAT_PERSON', 'MAT_WINDOW', 'MAT_TIMBER', 'MAT_STONE', 'MAT_FOLIAGE', 'MAT_SIGN', 'MAT_LAMP', 'MAT_ROAD'])].map((m) => `<option ${m === p.material ? 'selected' : ''}>${E(m)}</option>`).join('')}</select><p class="mini-help">Material IDs are kept for export. The editor does not run the game shaders.</p></div><div class="property-section"><div class="section-label">SHAPE TOOLS</div><div class="action-row"><button id="mirror-part">${icon('mirror')}Mirror Y</button><button id="select-group">Select group</button></div>${p.kind === 'box' ? '<button class="wide" id="convert-mesh">Convert to editable mesh</button>' : `<label class="field-label" style="margin-top:12px">Local vertex</label><select id="vertex-index" style="width:100%">${p.vertices.map((_, i) => `<option value="${i}" ${i === vertexIndex ? 'selected' : ''}>Vertex ${i}</option>`).join('')}</select>${vectorFields('Vertex position', 'vertex', p.vertices[vertexIndex])}`}<p class="mini-help">Mirror makes a copy across Y = 0. A box becomes a mesh when mirrored. Mesh conversion is reversible with Undo.</p></div></fieldset>${locked ? '<button class="wide" id="unlock-part">Unlock this part</button>' : ''}`;
  } else if (chosen.length > 1) {
    html = `<div class="section-label">MULTIPLE PARTS</div><div class="summary-title">${chosen.length} parts selected</div><p class="mini-help">Drag an axis handle to move, rotate, or scale. Arrow keys nudge the selection. Scale changes each part on its local axis. Select a single part for numeric controls.</p><div class="action-row"><button id="mirror-part">${icon('mirror')}Mirror Y</button><button id="select-none">Clear selection</button></div><div class="property-section">${chosen.slice(0, 15).map((p) => `<div class="key-value"><span>${E(p.name)}</span><span>${E(p.id)}</span></div>`).join('')}</div>`;
  } else {
    const r = reportAsset(a);
    html = `<div class="section-label">ASSET OVERVIEW</div><div class="inspector-summary"><div class="summary-icon">${icon('cube')}</div><div><div class="summary-title">${E(a.category)}</div><div class="summary-meta">${a.source ? 'SOURCE-BASED SAMPLE' : 'STANDALONE ASSET'}</div></div></div><label class="field-label">Asset name</label><input class="text-input" id="asset-name-input" value="${E(a.name)}"><div class="small-stat-grid"><div class="small-stat"><strong>${r.visibleParts}</strong><span>Visible parts</span></div><div class="small-stat"><strong>${r.triangles}</strong><span>Triangles</span></div></div><div class="property-section"><div class="section-label">ASSET PALETTE</div><div class="palette">${[...new Map(a.parts.map((p) => [hexColor(p.color), p.color])).keys()].map((h) => `<button class="swatch" style="--swatch:${h}" data-select-color="${h}" title="Select parts with color ${h}" aria-label="Select color ${h}"></button>`).join('')}</div><p class="mini-help">Select a color to select its parts.</p></div><div class="property-section"><div class="section-label">DIMENSIONS</div>${r.bounds.size.map((n, i) => `<div class="key-value"><span>${['X · length', 'Y · width', 'Z · height'][i]}</span><span>${n.toFixed(3)}</span></div>`).join('')}<div class="key-value"><span>Coordinates</span><span>Z-up · world units</span></div></div><button class="wide" id="make-variant">${icon('copy')}Save as a new variant</button><p class="mini-help">Click a part in the 3D view or the list below to change its shape and color.</p>${r.warnings.length ? `<div class="notice">${E(r.warnings[0])}</div>` : ''}<button class="wide" id="validate-asset">Check export readiness</button>`;
  }
  const scroll = root.scrollTop;
  root.innerHTML = html;
  root.scrollTop = scroll;
}
function renderParts() {
  const a = asset(), list = $('#parts-list'), scroll = list.scrollTop;
  list.innerHTML = a.parts.map((p) => `<div class="part-row ${selected.includes(p.id) ? 'active' : ''} ${p.visible ? '' : 'hidden-part'}" data-part="${E(p.id)}" role="button" tabindex="0" aria-label="Select ${E(p.name)}" aria-pressed="${selected.includes(p.id)}"><span class="part-dot" style="background:${hexColor(p.color)}"></span><span class="part-name">${E(p.name)}</span><span class="kind-icon">${p.kind === 'box' ? 'BOX' : 'MESH'}</span><button data-lock="${E(p.id)}" title="${p.locked ? 'Unlock' : 'Lock'} ${E(p.name)}" aria-label="${p.locked ? 'Unlock' : 'Lock'} ${E(p.name)}">${icon(p.locked ? 'lock' : 'unlock')}</button><button data-visible="${E(p.id)}" title="${p.visible ? 'Hide' : 'Show'} ${E(p.name)}" aria-label="${p.visible ? 'Hide' : 'Show'} ${E(p.name)}">${icon(p.visible ? 'eye' : 'eyeoff')}</button></div>`).join('');
  list.scrollTop = scroll;
  $('#duplicate-part').disabled = !selected.length;
  $('#delete-part').disabled = !selected.length;
}

// ---- Dialogs
function modal(title, content, kicker = 'NEON ASSET STUDIO') {
  $('#modal-title').textContent = title;
  $('#modal-kicker').textContent = kicker;
  $('#modal-content').innerHTML = content;
  if (!$('#modal').open) $('#modal').showModal();
  icons($('#modal'));
}
function closeModal() {
  if ($('#modal').open) $('#modal').close();
}
function newDialog() {
  modal('Create a new asset', `<p>Start without a repo. Use a simple template, or add your own parts.</p><label class="field-label">Asset name</label><input id="new-name" class="text-input" value="Delivery van"><label class="field-label">Starting shape</label><select id="new-template"><option value="van">Delivery van · 11 parts</option><option value="food-truck">Food truck · 22 parts</option><option value="scooter">Delivery scooter · 11 parts</option><option value="bus-shelter">Bus shelter · 17 parts</option><option value="building">Small building</option><option value="tree">Simple tree</option><option value="box">Single box</option><option value="blank">Empty asset</option></select><label><input type="checkbox" id="use-style">Use the current asset's palette</label><div class="notice">These are editor templates, not generated game assets. An AI agent can also create a model from a custom part specification.</div><div class="modal-footer"><button id="new-cancel">Cancel</button><button class="primary" id="new-confirm">Create asset</button></div>`);
  let defaultName = 'Delivery van';
  $('#new-template').onchange = () => {
    // Follow the template with the name until the player types their own.
    const next = TEMPLATE_NAMES[$('#new-template').value] || 'Untitled asset';
    if ($('#new-name').value.trim() === defaultName) $('#new-name').value = next;
    defaultName = next;
  };
  $('#new-cancel').onclick = closeModal;
  $('#new-confirm').onclick = async () => {
    const name = $('#new-name').value.trim();
    if (!name) return toast('Enter an asset name.', true);
    const c = { op: 'create_asset', name, template: $('#new-template').value };
    if ($('#use-style').checked) c.styleFrom = asset().id;
    try {
      await send(c);
    } catch {
      return;
    }
    category = 'All';
    refresh();
    closeModal();
    toast('New asset created.');
  };
}
function sourceDialog() {
  modal('Source and import coverage', `<p>The catalog has 37 source-based samples and 4 new Accord studies. It is not a scan of every asset in the repo.</p><label class="field-label">Repository</label><input class="text-input" id="repo-name" value="${NEON_SOURCE.repository}"><label class="field-label">Commit or branch to check</label><input class="text-input" id="repo-ref" value="${NEON_SOURCE.commit}"><div class="source-path">6 source vehicles + 4 Accord studies · 1 player rest pose · 9 city lots<br>5 city props · 16 furnishings<br><br>Source snapshot: ${NEON_SOURCE.commit.slice(0, 12)}</div><div class="notice">The adapter does not execute downloaded code. Verification checks the source file hashes. A changed source revision needs an adapter update. Other repos and GLB import are not supported in this release.</div><p class="mini-help">Buildings use fixed inputs, not a selected location in the running game. Classic and detailed models of both player cars are included. The Crown has separate classic arcade and simulation shapes. Other regions and animation rigs are not included.</p><pre id="verify-result">Open the local server to verify a repo. The browser edition uses the bundled snapshot.</pre><div class="modal-footer"><button id="source-close">Close</button><button class="primary" id="verify-source" disabled>${icon('branch')}Verify source</button></div>`, 'NEON FARE ADAPTER');
  $('#source-close').onclick = closeModal;
}
function agentDialog() {
  const config = { mcpServers: { 'neon-asset-studio': { command: 'node', args: ['/ABSOLUTE/PATH/neon-asset-studio/server/mcp.mjs'] } } };
  modal('Connect an AI agent', `<p>The agent uses the same asset documents and edit commands as this interface. Start the local server before you connect.</p><pre>cd neon-asset-studio\nnpm start</pre><label class="field-label">MCP client configuration · replace the absolute path</label><pre id="mcp-config">${E(JSON.stringify(config, null, 2))}</pre><p>Ask the agent to list assets, inspect a model, make edits, render views, and export a handoff package. Use a client that supports local MCP servers.</p><div class="notice">This app has no built-in language model. The JSON console is not a chat box. Your external agent interprets text or reference images and calls the tools.</div><div class="source-path">${TOOLS.map((t) => t.name).join(' · ')}</div><div class="modal-footer"><button id="copy-config">${icon('copy')}Copy configuration</button><button class="primary" id="agent-close">Done</button></div>`, 'AI COMMAND INTERFACE');
  $('#agent-close').onclick = closeModal;
  $('#copy-config').onclick = () => copyText(JSON.stringify(config, null, 2));
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied.');
  } catch {
    toast('Clipboard access is unavailable. Select and copy the text.', true);
  }
}
const HELP = {
  keyboard: ['Keyboard and mouse', 'mouse', [['Orbit', 'Drag'], ['Pan', 'Shift + drag · right-drag'], ['Zoom', 'Scroll · + / −'], ['Move tool', 'W'], ['Rotate tool', 'E'], ['Scale tool', 'R'], ['Frame selection / asset', 'F'], ['Select more parts', 'Shift + click'], ['Nudge selected parts', 'Arrow keys'], ['Raise / lower selected parts', 'Page Up / Down'], ['Bigger nudge steps', 'Hold Shift'], ['Orbit with nothing selected', 'Arrow keys'], ['Camera views', '1 – 6'], ['Reset the view', 'Home'], ['Isolate selection', 'I'], ['Compare with original', 'C'], ['Undo', 'Ctrl / ⌘ + Z'], ['Redo', 'Ctrl / ⌘ + Shift + Z'], ['Duplicate', 'Ctrl / ⌘ + D'], ['Save project', 'Ctrl / ⌘ + S'], ['Delete selected', 'Delete'], ['Clear selection', 'Esc'], ['Find an asset', '/'], ['Controls help', '? · F1'], ['Display settings', 'F9']]],
  gamepad: ['Gamepad', 'pad', [['Orbit', 'Right stick'], ['Pan', 'Left stick'], ['Zoom out / in', 'LB / RB'], ['Previous / next part', 'D-pad ← / →'], ['Previous / next asset', 'D-pad ↑ / ↓'], ['Frame selection / asset', 'A'], ['Clear selection · close a dialog', 'B'], ['Next tool', 'X'], ['Compare with original', 'Y'], ['Undo / redo', 'LT / RT'], ['Isolate selection', 'View / Back'], ['Reset the view', 'Left stick click'], ['Next camera view', 'Right stick click'], ['Controls help', 'Menu / Start'], ['In dialogs', 'D-pad moves · A selects']]],
  touch: ['Touch', 'touch', [['Orbit', 'Drag one finger'], ['Pan', 'Drag two fingers'], ['Zoom', 'Pinch'], ['Select a part', 'Tap it'], ['Move, rotate or scale', 'Drag a colored handle'], ['Clear selection', 'Tap empty space']]],
};
function helpDialog() {
  const first = HELP[sourceNow()] ? sourceNow() : 'keyboard';
  const order = [first, ...['keyboard', 'gamepad', 'touch'].filter((k) => k !== first)];
  const sections = order.map((k) => { const [title, ic, rows] = HELP[k]; return `<div class="help-section${k === first ? ' current' : ''}"><div class="section-label">${icon(ic)}${title}${k === first ? ' <span class="help-now">IN USE</span>' : ''}</div><div class="help-grid">${rows.map(([a, b]) => `<div class="help-row"><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div></div>`; }).join('');
  modal('Controls and limits', `${sections}<div class="notice">Drag a colored axis handle to change selected parts. Numeric position values use world units. Rotation inputs show degrees; JSON commands use radians. Scale changes each part on its local axis. Use Undo to reverse a complete action. Undo history lasts for this session.</div><p class="mini-help">Save project exports an editable JSON file. Export → Agent handoff includes native data and integration notes. GLB and OBJ are export-only in this release. The preview does not reproduce game shaders, animation, or physics.</p><p class="mini-help">Browser mode keeps the latest version of every changed asset in local browser storage. The local server saves in .studio/state.json and supports MCP. Back up work with Save project. The view runs on WebGPU, or WebGL2 where WebGPU is missing.</p><div class="modal-footer"><button id="help-settings">${icon('gear')}Display settings</button><button class="primary" id="help-close">Done</button></div>`);
  $('#help-close').onclick = closeModal;
  $('#help-settings').onclick = openSettings;
}
function openSettings() {
  closeModal();
  kit.menu.open();
}
function addPartDialog() {
  modal('Add a part', `<p>Add a low-poly shape. It will appear next to the current asset.</p><label class="field-label">Shape</label><select id="primitive-choice"><option value="box">Box</option><option value="wedge">Roof wedge</option><option value="cylinder">Eight-sided cylinder</option><option value="pyramid">Pyramid</option><option value="ramp">Ramp</option><option value="sphere">Ten-sided sphere</option></select><label class="field-label">Part name</label><input id="primitive-name" class="text-input" value="New part"><div class="modal-footer"><button id="part-cancel">Cancel</button><button class="primary" id="part-confirm">Add part</button></div>`);
  $('#part-cancel').onclick = closeModal;
  $('#part-confirm').onclick = async () => {
    const b = boundsOf(asset().parts), oldIds = new Set(asset().parts.map((p) => p.id));
    try {
      await edits([{ type: 'add', primitive: $('#primitive-choice').value, part: { name: $('#primitive-name').value || 'New part', position: [b.max[0] + .8, b.center[1], .5] } }]);
    } catch {
      return;
    }
    closeModal();
    setSelection(asset().parts.filter((p) => !oldIds.has(p.id)).map((p) => p.id));
    view.fit();
    toast('Part added.');
  };
}
function bytesFromDataURL(data) {
  const text = atob(data.slice(data.indexOf(',') + 1));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}
async function previewBytes() { return bytesFromDataURL(await view.capture()); }
function downloadBytes(data, name, type = 'application/octet-stream') {
  const blob = new Blob([data], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function saveProject() {
  downloadBytes(JSON.stringify(asset(), null, 2), safeFilename(asset().name) + '.project.json', 'application/json');
  toast('Editable project exported.');
}
function exportDialog() {
  let format = 'handoff';
  const options = [['handoff', 'Agent handoff', '.ZIP · Project, native data, GLB, PNG, and notes'], ['glb', '3D model', '.GLB · Named parts and flat materials'], ['project', 'Editable project', '.JSON · Reopen in this editor'], ['typescript', 'Neon Fare source', '.TS · Static geometry and material keys'], ['native', 'Neon Fare data', '.JSON · Boxes, surfaces, and collision'], ['obj', 'Wavefront model', '.OBJ · Geometry with vertex colors']];
  modal('Export asset', `<p>Export <strong>${E(asset().name)}</strong>. This does not change the game repo.</p><div class="export-options">${options.map(([f, n, d]) => `<button class="export-option ${f === format ? 'active' : ''}" data-format="${f}"><strong>${n}</strong><small>${d}</small></button>`).join('')}</div><div class="notice">The handoff package is for game-agent review. It is not a drop-in animation or physics replacement. GLB uses a root transform to convert Z-up to Y-up.</div><div class="modal-footer"><button id="export-cancel">Cancel</button><button class="primary" id="export-confirm">${icon('export')}Export handoff</button></div>`);
  $$('[data-format]').forEach((b) => (b.onclick = () => {
    format = b.dataset.format;
    $$('[data-format]').forEach((x) => x.classList.toggle('active', x === b));
    $('#export-confirm').innerHTML = icon('export') + 'Export ' + (format === 'handoff' ? 'handoff' : format.toUpperCase());
  }));
  $('#export-cancel').onclick = closeModal;
  $('#export-confirm').onclick = async () => {
    const button = $('#export-confirm');
    button.disabled = true;
    try {
      const a = asset(), n = safeFilename(a.name);
      let data, extension, type;
      if (format === 'handoff') {
        compareActive = false;
        updateViewport();
        data = zipFiles(handoffFiles(a, state.originals[a.id], await previewBytes()));
        extension = 'handoff.zip';
        type = 'application/zip';
      } else if (format === 'glb') { data = exportGLB(a); extension = 'glb'; type = 'model/gltf-binary'; }
      else if (format === 'project') { data = JSON.stringify(a, null, 2); extension = 'project.json'; type = 'application/json'; }
      else if (format === 'native') { data = JSON.stringify(nativeData(a), null, 2); extension = 'neon.json'; type = 'application/json'; }
      else if (format === 'typescript') { data = nativeTypeScript(a); extension = 'neon.ts'; type = 'text/plain'; }
      else { data = exportOBJ(a); extension = 'obj'; type = 'text/plain'; }
      downloadBytes(data, n + '.' + extension, type);
      closeModal();
      toast('Export complete.');
    } catch (e) {
      toast(e.message, true);
    } finally {
      button.disabled = false;
    }
  };
}
function commandPreset(which) {
  const a = asset();
  let c;
  if (which === 'inspect') c = { op: 'inspect_asset', assetId: a.id };
  else if (which === 'create') c = { op: 'create_asset', name: 'Delivery van', template: 'van', styleFrom: a.id };
  else {
    if (!selected.length) return toast('Select a part first.', true);
    c = { op: 'apply_edits', assetId: a.id, expectedRevision: a.revision, edits: [{ type: 'set', partId: selected[0], values: { color: [.05, .9, .95, 1] } }] };
  }
  $('#command-input').value = JSON.stringify(c, null, 2);
  $('#command-dock').classList.add('open');
}
function jsonSummary(value) {
  return JSON.stringify(value, (key, v) => (key === 'data' && typeof v === 'string' && v.length > 400 ? `[${v.length} bytes of image or file data]` : v), 2).slice(0, 18000);
}
function selectedPart() { return asset().parts.find((p) => p.id === selected[0]); }
async function setPartValues(values) {
  if (!selectedPart()) return;
  await edits([{ type: 'set', partId: selected[0], values }]);
}
function selectPart(id, more) {
  if (more) setSelection(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);
  else setSelection([id]);
}
async function duplicateSelected() {
  if (!selected.length) return;
  const old = new Set(asset().parts.map((p) => p.id));
  await edits([{ type: 'duplicate', partIds: selected, offset: [.25, .25, 0] }]);
  setSelection(asset().parts.filter((p) => !old.has(p.id)).map((p) => p.id));
}
async function deleteSelected() {
  if (!selected.length) return;
  await edits([{ type: 'remove', partIds: selected }]);
  setSelection([]);
}
function undo() { if (!$('#undo').disabled) run({ op: 'undo', assetId: asset().id, expectedRevision: asset().revision }); }
function redo() { if (!$('#redo').disabled) run({ op: 'redo', assetId: asset().id, expectedRevision: asset().revision }); }
function frame() { view.fit(selected.length ? asset().parts.filter((p) => selected.includes(p.id)) : undefined); }
function toggleCompare() {
  if (nudge) commitNudge();
  compareActive = !compareActive;
  updateViewport();
  renderInspector();
}
function applyView(name) {
  currentView = name;
  view.setView(name);
  $('#view-label').textContent = VIEW_LABELS[name] || name.toUpperCase();
  $$('[data-view]').forEach((v) => v.classList.toggle('active', v.dataset.view === name));
}
function setPref(key, value) {
  prefs[key] = value;
  savePrefs();
  const box = { grid: '#toggle-grid', wireframe: '#toggle-wire', clay: '#toggle-clay', collisions: '#toggle-collisions', snap: '#toggle-snap', isolate: '#toggle-isolate' }[key];
  if (box) $(box).checked = value;
  if (key === 'isolate') updateViewport();
  else if (key !== 'snap') {
    view[key] = value;
    view.rebuild();
  }
}
/** Step through the visible library (D-pad up/down) or the asset's parts (left/right). */
function stepAsset(dir) {
  const list = libraryList();
  if (!list.length) return;
  const i = list.findIndex((a) => a.id === state.activeAssetId);
  const next = list[(i + dir + list.length) % list.length];
  if (next.id !== state.activeAssetId) {
    run({ op: 'set_active_asset', assetId: next.id }).then(() => $(`#asset-grid [data-asset="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    input.rumble(.15, 30);
  }
}
function stepPart(dir) {
  const parts = asset().parts.filter((p) => p.visible);
  if (!parts.length) return;
  const i = parts.findIndex((p) => p.id === selected[selected.length - 1]);
  const next = parts[i < 0 ? (dir > 0 ? 0 : parts.length - 1) : (i + dir + parts.length) % parts.length];
  setSelection([next.id]);
  $(`#parts-list [data-part="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
  input.rumble(.1, 25);
}

// ---- Keyboard nudging: one undo step per held arrow, previewed like a handle drag.
function commitNudge() {
  const n = nudge;
  nudge = null;
  if (!n) return;
  if (!n.moved || !n.preview) { updateViewport(); return; }
  const changes = n.preview.parts.filter((p) => n.selected.includes(p.id)).map((p) => ({ type: 'set', partId: p.id, values: { position: p.position.map((v) => round(v, 7)) } }));
  send({ op: 'apply_edits', assetId: n.asset.id, expectedRevision: n.expectedRevision, edits: changes }).catch(() => updateViewport());
}
/** The world axis closest to a camera direction, with its sign. */
function worldAxis(v) {
  const i = Math.abs(v[0]) >= Math.abs(v[1]) ? 0 : 1;
  return [i, Math.sign(v[i]) || 1];
}
const repeat = new Map();
/** Fire on press, then repeat while held (keyboard and D-pad alike). */
function repeating(key, active, dt, first = .35, every = .07) {
  if (!active) { repeat.delete(key); return false; }
  if (!repeat.has(key)) { repeat.set(key, first); return true; }
  const t = repeat.get(key) - dt;
  if (t <= 0) { repeat.set(key, every); return true; }
  repeat.set(key, t);
  return false;
}
function handleArrows(dt) {
  const x = input.value('nudgeX'), y = input.value('nudgeY'), z = input.value('nudgeZ');
  const a = asset(), editable = selected.length && !compareActive && !drag;
  if (!editable) {
    if (nudge) commitNudge();
    // Nothing selected: the arrows turn the camera and Page Up/Down zoom.
    if (x || y) view.orbitBy(x * 1.8 * dt, y * 1.2 * dt);
    if (z) view.zoomBy(z * 1.6 * dt);
    return;
  }
  if (!x && !y && !z) {
    repeat.delete('nudge');
    repeat.delete('locked');
    if (nudge) commitNudge();
    return;
  }
  if (!nudge) {
    if (selected.some((id) => a.parts.find((p) => p.id === id)?.locked)) {
      if (!repeat.has('locked')) toast('Unlock the selected parts before you edit them.', true);
      repeat.set('locked', 1);
      return;
    }
    nudge = { asset: clone(a), selected: [...selected], expectedRevision: a.revision, offset: [0, 0, 0], moved: false, preview: null };
  }
  if (!repeating('nudge', true, dt)) return;
  view.camera();
  const step = (prefs.snap ? .25 : .05) * (input.down('coarse') ? 5 : 1), off = nudge.offset;
  if (x) { const [i, s] = worldAxis(view.right); off[i] += Math.sign(x) * s * step; }
  if (y) {
    // "Up" moves away from the camera; looking straight down it follows the screen.
    const fwd = Math.hypot(view.forward[0], view.forward[1]) > .3 ? view.forward : view.up;
    const [i, s] = worldAxis(fwd);
    off[i] += Math.sign(y) * s * step;
  }
  if (z) off[2] += Math.sign(z) * step;
  const doc = clone(nudge.asset);
  for (const p of doc.parts.filter((p) => nudge.selected.includes(p.id))) {
    p.position = p.position.map((v, i) => {
      const moved = v + off[i];
      return prefs.snap && off[i] ? Math.round(moved * 4) / 4 : moved;
    });
  }
  nudge.preview = doc;
  nudge.moved = off.some((v) => v !== 0);
  view.setAsset(doc, { selected: nudge.selected });
}

// ---- Dialog navigation for gamepads: D-pad or stick moves focus, A activates, B closes.
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
function moveModalFocus(dx, dy) {
  const box = $('#modal'), items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length && !el.closest('fieldset:disabled'));
  if (!items.length) return;
  const current = document.activeElement;
  if (current?.tagName === 'SELECT' && dx && box.contains(current)) {
    const next = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + dx));
    if (next !== current.selectedIndex) {
      current.selectedIndex = next;
      current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }
  const i = items.indexOf(current), dir = dy < 0 || dx > 0 ? 1 : -1;
  const target = items[i < 0 ? 0 : (i + dir + items.length) % items.length];
  $$('.pad-focus').forEach((el) => el.classList.remove('pad-focus'));
  target.classList.add('pad-focus');
  target.focus();
  target.scrollIntoView({ block: 'nearest' });
}
function modalInput(dt) {
  if (input.pressed('back')) { closeModal(); return; }
  const n = input.vector('nav'), p = input.vector('pan'), x = n.x + p.x, y = n.y + p.y;
  const dir = Math.abs(x) > .5 || Math.abs(y) > .5 ? (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'R' : 'L') : (y > 0 ? 'U' : 'D')) : '';
  for (const d of ['L', 'R', 'U', 'D']) {
    if (repeating('modal' + d, d === dir, dt, .38, .12)) moveModalFocus(d === 'R' ? 1 : d === 'L' ? -1 : 0, d === 'U' ? 1 : d === 'D' ? -1 : 0);
  }
  if (input.pressed('confirm')) {
    const el = document.activeElement;
    if (!el || !$('#modal').contains(el) || el === $('#modal')) moveModalFocus(0, -1);
    else if (el.tagName === 'SELECT') moveModalFocus(1, 0);
    else if (!isTyping(el) || el.type === 'checkbox') el.click();
  }
}

// ---- Per-frame input: camera, shortcuts, gamepad.
function handleInput(dt) {
  if ($('#modal').open) { modalInput(dt); return; }
  if (input.pressed('help') || (input.pressed('search') && input.down('coarse'))) { helpDialog(); return; }
  const look = input.look('orbit');
  if (look.x || look.y) view.orbitBy(look.x, look.y);
  const pan = input.vector('pan');
  if (pan.x || pan.y) view.pan(-pan.x * 650 * dt, pan.y * 650 * dt);
  // Wheel notches as before; a pinch maps finger spread to distance.
  const zoom = input.zoom() * (sourceNow() === 'touch' ? .25 : .1) + (input.value('zoomIn') - input.value('zoomOut')) * 1.6 * dt;
  if (zoom) view.zoomBy(zoom);
  handleArrows(dt);
  const nav = input.vector('nav');
  const dir = Math.abs(nav.x) > .5 || Math.abs(nav.y) > .5 ? (Math.abs(nav.x) > Math.abs(nav.y) ? (nav.x > 0 ? 'R' : 'L') : (nav.y > 0 ? 'U' : 'D')) : '';
  for (const d of ['L', 'R', 'U', 'D']) {
    if (!repeating('nav' + d, d === dir, dt, .38, .12)) continue;
    if (d === 'L' || d === 'R') stepPart(d === 'R' ? 1 : -1);
    else stepAsset(d === 'D' ? 1 : -1);
  }
  if (input.pressed('frame')) frame();
  if (input.pressed('back')) {
    if (drag) cancelDrag();
    else setSelection([]);
  }
  if (input.pressed('toolMove')) setMode('translate');
  if (input.pressed('toolRotate')) setMode('rotate');
  if (input.pressed('toolScale')) setMode('scale');
  if (input.pressed('toolNext')) setMode({ translate: 'rotate', rotate: 'scale', scale: 'translate' }[mode]);
  if (input.pressed('compare')) toggleCompare();
  if (input.pressed('isolate')) setPref('isolate', !prefs.isolate);
  if (input.pressed('undo')) undo();
  if (input.pressed('redo')) redo();
  if (input.pressed('remove')) deleteSelected().catch(() => {});
  if (input.pressed('search') && !input.down('coarse')) $('#asset-search').focus();
  if (input.pressed('home')) { applyView('perspective'); frame(); }
  if (input.pressed('nextView')) applyView(VIEWS[(VIEWS.indexOf(currentView) + 1) % VIEWS.length]);
  VIEWS.forEach((v, i) => { if (input.pressed('view' + (i + 1))) applyView(v); });
}

// ---- Pointer: click to pick, drag to orbit, Shift/right-drag to pan, drag a handle to edit.
// Two fingers pan; the kit turns pinches into zoom.
function pointerPosition(e) {
  const r = kit.canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function midpoint() {
  let x = 0, y = 0;
  for (const t of touches.values()) { x += t.x; y += t.y; }
  return { x: x / touches.size, y: y / touches.size };
}
function cancelDrag() {
  const d = drag;
  drag = null;
  if (d?.preview) updateViewport();
}
function composeWorldRotation(original, delta) {
  const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => rotatePoint(rotatePoint(v, original), delta)), sy = Math.max(-1, Math.min(1, -basis[0][2])), y = Math.asin(sy);
  if (Math.abs(Math.cos(y)) > 1e-7) return [Math.atan2(basis[1][2], basis[2][2]), y, Math.atan2(basis[0][1], basis[0][0])];
  return [0, y, Math.atan2(-basis[1][0], basis[1][1])];
}
function bindViewport() {
  const canvas = kit.canvas;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 2 || !ready) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size > 1) {
        cancelDrag();
        gesture = { mid: midpoint() };
        return;
      }
    }
    if (busy || gesture || nudge) return;
    const [x, y] = pointerPosition(e), touch = e.pointerType === 'touch';
    const axis = !compareActive ? view.hitGizmo(x, y, touch ? 22 : 12) : null, a = asset();
    if (axis !== null && selected.some((id) => a.parts.find((p) => p.id === id)?.locked)) {
      toast('Unlock the selected parts before you edit them.', true);
      return;
    }
    drag = { pointerId: e.pointerId, x, y, lastX: x, lastY: y, moved: false, slop: touch ? 8 : 3, axis, pan: e.shiftKey || e.button === 1 || e.button === 2, asset: clone(a), selected: [...selected], gizmo: axis !== null ? view.gizmo() : null, mode, more: e.shiftKey, expectedRevision: a.revision };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const t = touches.get(e.pointerId);
      t.x = e.clientX;
      t.y = e.clientY;
      if (gesture) {
        if (touches.size >= 2) {
          const m = midpoint();
          view.pan(m.x - gesture.mid.x, m.y - gesture.mid.y);
          gesture.mid = m;
        }
        return;
      }
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const [x, y] = pointerPosition(e), dx = x - drag.x, dy = y - drag.y;
    if (Math.hypot(dx, dy) > drag.slop) drag.moved = true;
    if (drag.axis === null) {
      if (drag.moved) {
        if (drag.pan) view.pan(x - drag.lastX, y - drag.lastY);
        else view.orbit(x - drag.lastX, y - drag.lastY);
      }
    } else {
      const axis = drag.axis, g = drag.gizmo, end = g.axes[axis], sx = end[0] - g.start[0], sy = end[1] - g.start[1], screen = Math.hypot(sx, sy), amount = screen > 5 ? (dx * sx + dy * sy) / screen : dx - dy, doc = clone(drag.asset), snap = prefs.snap;
      const radians = amount * .012, delta = amount / (screen || 1) * view.distance * .12, factor = Math.max(.02, 1 + amount * .012);
      for (const p of doc.parts.filter((p) => drag.selected.includes(p.id))) {
        if (drag.mode === 'translate') p.position[axis] = snap ? Math.round((p.position[axis] + delta) * 4) / 4 : p.position[axis] + delta;
        else if (drag.mode === 'scale') {
          p.scale[axis] *= factor;
          p.position[axis] = g.center[axis] + (p.position[axis] - g.center[axis]) * factor;
        } else {
          const rot = [0, 0, 0];
          rot[axis] = snap ? Math.round(radians / (Math.PI / 12)) * Math.PI / 12 : radians;
          p.position = vadd(g.center, rotatePoint(vsub(p.position, g.center), rot));
          p.rotation = composeWorldRotation(p.rotation, rot);
        }
      }
      drag.preview = doc;
      view.setAsset(doc, { selected: drag.selected });
    }
    drag.lastX = x;
    drag.lastY = y;
  });
  const release = (e, cancel) => {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (gesture) {
        if (!touches.size) gesture = null;
        else gesture.mid = midpoint();
        return;
      }
    }
    if (drag && e.pointerId === drag.pointerId) endDrag(e, cancel);
  };
  canvas.addEventListener('pointerup', (e) => release(e, false));
  canvas.addEventListener('pointercancel', (e) => release(e, true));
}
async function endDrag(e, cancel = false) {
  const d = drag;
  drag = null;
  try { kit.canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  if (cancel) { if (d.preview) updateViewport(); return; }
  if (d.axis !== null && d.moved && d.preview) {
    const fields = d.mode === 'translate' ? ['position'] : d.mode === 'scale' ? ['position', 'scale'] : ['position', 'rotation'];
    const changes = d.preview.parts.filter((p) => d.selected.includes(p.id)).map((p) => ({ type: 'set', partId: p.id, values: Object.fromEntries(fields.map((f) => [f, p[f].map((n) => round(n, 7))])) }));
    try {
      await send({ op: 'apply_edits', assetId: d.asset.id, expectedRevision: d.expectedRevision, edits: changes });
    } catch {
      updateViewport();
    }
  } else if (!d.moved) {
    const [x, y] = pointerPosition(e), id = view.pick(x, y);
    if (id) selectPart(id, d.more);
    else if (!d.more) setSelection([]);
  }
}

const HINTS = {
  keyboard: ['mouse', 'Drag to orbit', 'Scroll to zoom', 'Shift + drag to pan', 'Arrows nudge'],
  touch: ['touch', 'Drag to orbit', 'Pinch to zoom', 'Two fingers to pan'],
  gamepad: ['pad', 'Right stick orbits', 'Left stick pans', 'LB / RB zoom', 'D-pad picks parts and assets'],
};
function updateHint() {
  const [ic, ...parts] = HINTS[sourceNow()] || HINTS.keyboard;
  $('.orbit-hint').innerHTML = `${icon(ic)}${parts.map((t, i) => (i ? '<span>·</span> ' : '') + E(t)).join(' ')}`;
}

// ---- Interface events.
function bindUI() {
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) {
      const r = $('#modal').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal();
    }
  });
  // However a dialog closes, the button that closed it must not also act in the editor.
  $('#modal').addEventListener('close', () => { input.settle(); $$('.pad-focus').forEach((el) => el.classList.remove('pad-focus')); });
  $('#new-asset').onclick = newDialog;
  $('#repo-open').onclick = sourceDialog;
  $('#source-open').onclick = sourceDialog;
  $('#agent-open').onclick = agentDialog;
  $('#connect-from-console').onclick = agentDialog;
  $('#help-open').onclick = helpDialog;
  $('#help-toolbar').onclick = helpDialog;
  $('#settings-open').onclick = openSettings;
  $('#export-open').onclick = exportDialog;
  $('#save-project').onclick = saveProject;
  $('#import-project').onclick = () => $('#project-file').click();
  $('#add-part').onclick = addPartDialog;
  $('#library-toggle').onclick = () => { category = 'All'; $('#asset-search').value = ''; renderCategories(); renderLibrary(); };
  $('#project-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 24e6) return toast('Project file must be under 24 MB.', true);
    try {
      const doc = JSON.parse(await f.text());
      await send({ op: 'import_asset', asset: doc });
      category = 'All';
      refresh();
      toast('Project imported as a new asset.');
    } catch (err) {
      toast(err.message, true);
    }
  };
  $('#reference-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 2 * 1024 * 1024) return toast('Use a PNG, JPEG, or WebP under 2 MB.', true);
    const a = asset(), reader = new FileReader();
    reader.onload = async () => {
      try {
        await send({ op: 'apply_edits', assetId: a.id, expectedRevision: a.revision, edits: [{ type: 'reference', name: f.name, data: reader.result }] });
        toast('Reference image saved.');
      } catch { /* shown */ }
    };
    reader.readAsDataURL(f);
  };
  $('#categories').onclick = (e) => {
    const b = e.target.closest('[data-category]');
    if (b) { category = b.dataset.category; renderCategories(); renderLibrary(); }
  };
  $('#asset-search').oninput = renderLibrary;
  $('#asset-grid').onclick = (e) => {
    const b = e.target.closest('[data-asset]');
    if (b && b.dataset.asset !== state.activeAssetId) run({ op: 'set_active_asset', assetId: b.dataset.asset });
  };
  $$('.inspector-tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderInspector(); }));
  $('#parts-list').onclick = async (e) => {
    const lock = e.target.closest('[data-lock]'), vis = e.target.closest('[data-visible]'), row = e.target.closest('[data-part]');
    try {
      if (lock) { const p = asset().parts.find((p) => p.id === lock.dataset.lock); await edits([{ type: 'set', partId: p.id, values: { locked: !p.locked } }]); }
      else if (vis) { const p = asset().parts.find((p) => p.id === vis.dataset.visible); await edits([{ type: 'set', partId: p.id, values: { visible: !p.visible } }]); }
      else if (row) selectPart(row.dataset.part, e.shiftKey);
    } catch { /* shown */ }
  };
  $('#parts-list').onkeydown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-part]')) { e.preventDefault(); selectPart(e.target.dataset.part, e.shiftKey); }
  };
  $('#inspector-content').onchange = async (e) => {
    const t = e.target, p = selectedPart();
    try {
      if (t.matches('[data-field]') && p) {
        const field = t.dataset.field, axis = Number(t.dataset.axis), value = Number(t.value);
        if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
        if (field === 'vertex') {
          const index = Math.min(vertexIndex, p.vertices.length - 1), pos = [...p.vertices[index]];
          pos[axis] = value;
          await edits([{ type: 'vertex', partId: p.id, index, position: pos }]);
        } else {
          const values = [...p[field]];
          values[axis] = field === 'rotation' ? value * Math.PI / 180 : value;
          await setPartValues({ [field]: values });
        }
      } else if (t.id === 'part-name') await setPartValues({ name: t.value });
      else if (t.id === 'asset-name-input') await edits([{ type: 'rename_asset', name: t.value }]);
      else if (t.id === 'part-color' || t.id === 'part-hex') {
        if (!/^#[a-f\d]{6}$/i.test(t.value)) throw new Error('Use a six-digit hex color, such as #ffb800.');
        await setPartValues({ color: rgbaHex(t.value, p.color[3]) });
      } else if (t.id === 'part-material') await setPartValues({ material: t.value });
      else if (t.id === 'vertex-index') { vertexIndex = Number(t.value); renderInspector(); }
      else if (t.matches('[data-collider]')) await edits([{ type: 'collider', id: asset().colliders[Number(t.dataset.collider)].id, values: { [t.dataset.key]: Number(t.value) } }]);
    } catch (err) {
      toast(err.message, true);
      renderInspector();
    }
  };
  $('#inspector-content').onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.color) await setPartValues({ color: rgbaHex(b.dataset.color, selectedPart().color[3]) });
      else if (b.dataset.selectColor) setSelection(asset().parts.filter((p) => hexColor(p.color) === b.dataset.selectColor).map((p) => p.id));
      else if (b.dataset.removeReference !== undefined) await edits([{ type: 'reference', remove: Number(b.dataset.removeReference) }]);
      else if (b.id === 'add-reference') $('#reference-file').click();
      else if (b.id === 'inspector-repo') sourceDialog();
      else if (b.id === 'make-variant') { const n = asset().name + ' variant'; await send({ op: 'duplicate_asset', assetId: asset().id, name: n }); toast('Variant created.'); }
      else if (b.id === 'validate-asset') {
        const r = reportAsset(asset());
        modal('Export readiness', `<p>${r.visibleParts} visible parts · ${r.triangles} triangles. Geometry is valid.</p>${r.warnings.length ? r.warnings.map((w) => `<div class="notice">${E(w)}</div>`).join('') : '<p>No geometry warnings were found.</p>'}<div class="modal-footer"><button id="validation-close" class="primary">Done</button></div>`);
        $('#validation-close').onclick = closeModal;
      } else if (b.id === 'unlock-part') await setPartValues({ locked: false });
      else if (b.id === 'select-group') { const g = selectedPart()?.group; setSelection(asset().parts.filter((p) => p.group === g).map((p) => p.id)); }
      else if (b.id === 'select-none') setSelection([]);
      else if (b.id === 'mirror-part') { await edits([{ type: 'mirror', partIds: selected, axis: 1, plane: 0, copy: true }]); toast('Mirrored copy added across Y = 0.'); }
      else if (b.id === 'convert-mesh') { await edits([{ type: 'convert_mesh', partId: selected[0] }]); toast('Mesh vertices are now editable.'); }
    } catch { /* shown */ }
  };
  $('#duplicate-part').onclick = () => duplicateSelected().catch(() => {});
  $('#delete-part').onclick = () => deleteSelected().catch(() => {});
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  ['translate', 'rotate', 'scale'].forEach((m) => ($('#tool-' + m).onclick = () => setMode(m)));
  $('#frame').onclick = frame;
  $('#compare').onclick = toggleCompare;
  $('#capture').onclick = async () => {
    try {
      downloadBytes(await previewBytes(), safeFilename(asset().name) + '.png', 'image/png');
      toast('PNG view exported.');
    } catch (e) {
      toast('The view could not be captured. ' + (e?.message || ''), true);
    }
  };
  for (const [id, key] of [['toggle-grid', 'grid'], ['toggle-wire', 'wireframe'], ['toggle-clay', 'clay'], ['toggle-collisions', 'collisions'], ['toggle-snap', 'snap'], ['toggle-isolate', 'isolate']]) $('#' + id).onchange = (e) => setPref(key, e.target.checked);
  $$('[data-view]').forEach((b) => (b.onclick = () => applyView(b.dataset.view)));
  $('#command-toggle').onclick = () => $('#command-dock').classList.toggle('open');
  $$('[data-command]').forEach((b) => (b.onclick = () => commandPreset(b.dataset.command)));
  $('#command-run').onclick = async () => {
    const b = $('#command-run');
    b.disabled = true;
    try {
      const c = JSON.parse($('#command-input').value), result = await send(c);
      $('#command-output').textContent = jsonSummary(result);
    } catch (e) {
      $('#command-output').textContent = e.message;
      toast(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
  // Ctrl/⌘ shortcuts. They never reach the kit, so browser shortcuts (reload, find,
  // zoom, tab switching) are not mistaken for editor keys.
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey || e.altKey)) return;
    e.stopPropagation();
    if (!ready || e.altKey || $('#modal').open || kit.menu.isOpen || isTyping(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'd') { e.preventDefault(); duplicateSelected().catch(() => {}); }
    else if (k === 's') { e.preventDefault(); saveProject(); }
  }, true);
  window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); toast(e.reason?.message || 'The action failed.', true); });
  input.onSourceChange(updateHint);
}

function applyPrefs() {
  for (const [id, key] of [['toggle-grid', 'grid'], ['toggle-wire', 'wireframe'], ['toggle-clay', 'clay'], ['toggle-collisions', 'collisions'], ['toggle-snap', 'snap'], ['toggle-isolate', 'isolate']]) {
    $('#' + id).checked = !!prefs[key];
    if (key in view && key !== 'isolate') view[key] = !!prefs[key];
  }
}

let lastW = 0, lastH = 0;
function frameLoop(dt) {
  handleInput(dt);
  // The kit resizes the drawing buffer for quality and dynamic resolution; a resized
  // buffer is blank until drawn again.
  const c = kit.canvas;
  if (c.width !== lastW || c.height !== lastH) { lastW = c.width; lastH = c.height; view.dirty = true; }
  if (view.dirty) view.render();
}

try {
  setupRenderer(kit.renderer);
  loadPrefs();
  loadState();
  view = new Viewport(kit.renderer, { overlay: $('#overlay') });
  thumbView = new Viewport(kit.renderer, { grid: false });
  thumbView.resize(320, 224, 1);
  applyPrefs();
  kit.onResize((w, h) => view.resize(w, h, globalThis.devicePixelRatio || 1));
  kit.onQuality(() => { view.dirty = true; });
  bindViewport();
  bindUI();
  updateHint();
  refresh(true);
  ready = true;
  window.NeonStudio = { command: send, inspect: () => clone(asset()), list: () => state.assets.map((a) => ({ id: a.id, name: a.name })), select: setSelection, render: () => view.capture(), version: '0.3.0', renderer: kit.backend };
  kit.start(frameLoop);
} catch (e) {
  console.error(e);
  $('#viewport-error').hidden = false;
  $('#viewport-error').textContent = e.message;
  toast(e.message, true);
  kit.loading.done();
}
