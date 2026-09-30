/**
 * ui.js — the HUD and the game's own screens (briefing, pause, fabricator,
 * survey log, controls, results, confirm). Plain DOM: every write goes
 * through a small cache so the HUD only touches the page when a value changes.
 */

const $ = (id) => document.getElementById(id);

/** Button prompts for each input source: [keyboard, gamepad, touch]. */
export const PROMPTS = {
  use: ['E', 'X', 'USE'],
  beam: ['LMB', 'RT', 'BEAM'],
  scan: ['Q', 'Y', 'SCAN'],
  fab: ['F', 'VIEW', 'MENU'],
};
const SOURCE_INDEX = { keyboard: 0, gamepad: 1, touch: 2 };
export const promptFor = (name, source) => PROMPTS[name][SOURCE_INDEX[source] ?? 0];

const CONTROLS = [
  ['MOVE', 'WASD / ARROWS', 'LEFT STICK / D-PAD', 'LEFT STICK'],
  ['LOOK', 'MOUSE · CLICK TO CAPTURE', 'RIGHT STICK', 'DRAG'],
  ['JUMP', 'SPACE', 'A', 'JUMP'],
  ['SPRINT', 'SHIFT (HOLD)', 'L3 (TOGGLE)', 'SPRINT (TOGGLE)'],
  ['CROUCH', 'CTRL / C (HOLD)', 'B (HOLD)', 'CROUCH (TOGGLE)'],
  ['EXTRACTION BEAM', 'LEFT CLICK / J (HOLD)', 'RT (HOLD)', 'BEAM (HOLD)'],
  ['COLLECT / USE', 'E', 'X', 'USE'],
  ['SPECTRAL SCAN', 'Q', 'Y', 'SCAN'],
  ['FABRICATOR', 'F', 'VIEW', 'II → FABRICATOR'],
  ['MENU', 'ESC / P', 'START', 'II'],
  ['SETTINGS', 'F9 · MENU', 'MENU → SETTINGS', 'MENU → SETTINGS'],
];

const STRIPS = {
  keyboard: [
    ['WASD', 'MOVE'],
    ['SHIFT', 'SPRINT'],
    ['CTRL/C', 'CROUCH'],
    ['SPACE', 'JUMP'],
    ['Q', 'SCAN'],
    ['E', 'COLLECT'],
    ['LMB', 'HARVEST'],
    ['F', 'FABRICATE'],
    ['ESC', 'MENU'],
  ],
  gamepad: [
    ['LS', 'MOVE'],
    ['L3', 'SPRINT'],
    ['B', 'CROUCH'],
    ['A', 'JUMP'],
    ['Y', 'SCAN'],
    ['X', 'COLLECT'],
    ['RT', 'HARVEST'],
    ['VIEW', 'FABRICATE'],
    ['START', 'MENU'],
  ],
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
export { clock };

export function createUI({ action, fabricate }) {
  const shell = $('shell');
  const hud = $('hud');
  const screens = {
    briefing: $('screen-briefing'),
    pause: $('screen-pause'),
    fab: $('screen-fab'),
    help: $('screen-help'),
    log: $('screen-log'),
    results: $('screen-results'),
    confirm: $('screen-confirm'),
    error: $('screen-error'),
  };
  let current = 'briefing';
  let focusIndex = 0;
  let itemCache = null;

  const items = () => {
    if (!current) return [];
    if (!itemCache) itemCache = [...screens[current].querySelectorAll('button')].filter((b) => !b.hidden && !b.disabled);
    return itemCache;
  };
  const paintFocus = () => {
    const list = items();
    list.forEach((b, i) => b.classList.toggle('is-focus', i === focusIndex));
  };

  for (const [name, root] of Object.entries(screens)) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.recipe) fabricate(b.dataset.recipe);
      else if (b.dataset.action) action(b.dataset.action, name);
    });
    const sync = (e) => {
      if (name !== current) return;
      const b = e.target.closest?.('button');
      const i = items().indexOf(b);
      if (i >= 0 && i !== focusIndex) {
        focusIndex = i;
        paintFocus();
      }
    };
    root.addEventListener('focusin', sync);
    root.addEventListener('pointerover', sync);
  }
  $('error-reload').addEventListener('click', () => location.reload());

  // ------------------------------------------------------------ text cache
  const cache = new WeakMap();
  const text = (node, value) => {
    const v = String(value);
    if (cache.get(node) === v) return;
    cache.set(node, v);
    node.textContent = v;
  };
  const styleCache = new WeakMap();
  const style = (node, prop, value) => {
    let map = styleCache.get(node);
    if (!map) {
      map = {};
      styleCache.set(node, map);
    }
    if (map[prop] === value) return;
    map[prop] = value;
    node.style.setProperty(prop, value);
  };
  const cls = (node, name, on) => {
    if (node.classList.contains(name) !== !!on) node.classList.toggle(name, !!on);
  };
  const show = (node, on) => {
    if (node.hidden === !on) node.hidden = !on;
  };

  const refs = {
    protocol: $('hud-protocol'),
    compassTicks: $('compass-ticks'),
    compassTarget: $('compass-target'),
    compassLabel: $('compass-label'),
    compassDeg: $('compass-deg'),
    backend: $('chip-backend'),
    fps: $('chip-fps'),
    tier: $('chip-tier'),
    objIndex: $('obj-index'),
    objKicker: $('obj-kicker'),
    objTitle: $('obj-title'),
    objText: $('obj-text'),
    objList: $('obj-list'),
    objKits: $('obj-kits'),
    region: $('tel-region'),
    settlement: $('tel-settlement'),
    pos: $('tel-pos'),
    cells: $('tel-cells'),
    stance: $('tel-stance'),
    time: $('tel-time'),
    reticle: $('reticle'),
    prompt: $('prompt'),
    promptKey: $('prompt-key'),
    promptLabel: $('prompt-label'),
    promptAction: $('prompt-action'),
    scanState: $('scan-state'),
    scanBar: $('scan-bar'),
    energy: $('energy-system'),
    energyValue: $('energy-value'),
    energyRing: $('energy-ring'),
    strip: $('controls-strip'),
    pauseTips: $('pause-tips'),
    toast: $('toast'),
    toastText: $('toast-text'),
    flash: $('flash'),
  };
  const invSlots = {};
  for (const span of hud.querySelectorAll('.inventory-panel span')) invSlots[span.dataset.item] = { span, value: span.querySelector('strong') };

  // Objective rows are built once per mode and updated in place.
  let rows = [];
  let rowMode = '';
  const setRows = (mode, count) => {
    if (mode === rowMode && rows.length === count) return;
    rowMode = mode;
    refs.objList.textContent = '';
    rows = [];
    for (let i = 0; i < count; i += 1) {
      const row = el('div', 'beacon-row');
      const index = el('span', 'beacon-index', `0${i + 1}`);
      const state = el('span', 'beacon-state');
      const box = el('div');
      const name = el('strong');
      const small = el('small');
      box.append(name, small);
      row.append(index, state, box);
      refs.objList.append(row);
      rows.push({ row, name, small });
    }
  };
  const setRow = (i, name, small, active, target) => {
    const r = rows[i];
    if (!r) return;
    text(r.name, name);
    text(r.small, small);
    cls(r.row, 'is-active', active);
    cls(r.row, 'is-target', target);
  };

  let stripSource = '';
  const setSource = (source) => {
    if (source === stripSource) return;
    stripSource = source;
    const list = STRIPS[source] || STRIPS.keyboard;
    refs.strip.textContent = '';
    for (const [k, label] of list) {
      const s = el('span');
      s.append(el('kbd', null, k), ` ${label}`);
      refs.strip.append(s);
    }
    refs.pauseTips.textContent = '';
    const tips = source === 'gamepad' ? ['L3 · sprint', 'B · crouch', 'A · jump', 'RT · extract', 'VIEW · fabricate'] : source === 'touch' ? ['Sprint · toggle', 'Crouch · toggle', 'Beam · hold to extract', 'Drag · look'] : ['Shift · sprint', 'Ctrl / C · crouch', 'Space · jump', 'LMB · extract resources', 'F · fabricate', 'F9 · settings'];
    for (const t of tips) refs.pauseTips.append(el('span', null, t));
    const note = $('brief-note');
    note.textContent = source === 'touch' ? 'Headphones recommended · Left thumb moves, drag to look' : source === 'gamepad' ? 'Headphones recommended · Controller ready' : 'Headphones recommended · Click to capture cursor';
  };

  let toastTimer = 0;

  const ui = {
    get screen() {
      return current;
    },
    showScreen(name) {
      for (const [n, root] of Object.entries(screens)) show(root, n === name);
      current = name;
      focusIndex = 0;
      itemCache = null;
      if (name) {
        const first = items()[0];
        if (first) first.focus({ preventScroll: true });
        paintFocus();
      } else if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur?.();
      }
    },
    /** Move the menu focus by dir (-1 up, +1 down). */
    moveFocus(dir) {
      const list = items();
      if (!list.length) return;
      focusIndex = (focusIndex + dir + list.length) % list.length;
      list[focusIndex].focus({ preventScroll: false });
      paintFocus();
    },
    activateFocus() {
      items()[focusIndex]?.click();
    },
    refreshItems() {
      itemCache = null;
      const list = items();
      focusIndex = Math.min(focusIndex, Math.max(0, list.length - 1));
      paintFocus();
    },
    scrollLog(dy) {
      $('log-body').scrollTop += dy;
    },
    setPhase(phase) {
      if (shell.dataset.phase !== phase) shell.dataset.phase = phase;
    },
    showHud(on) {
      show(hud, on);
    },
    setSource,
    text,
    style,
    cls,
    show,
    refs,
    setRows,
    setRow,
    setInventory(inv, kits, showKits) {
      for (const key of ['crystal-shard', 'stone', 'timber', 'fiber']) text(invSlots[key].value, String(inv[key]).padStart(2, '0'));
      show(invSlots.kits.span, showKits);
      text(invSlots.kits.value, String(kits));
    },
    bump(item) {
      const slot = invSlots[item];
      if (!slot) return;
      slot.span.classList.remove('is-bump');
      void slot.span.offsetWidth;
      slot.span.classList.add('is-bump');
    },
    toast(message, tone = 'cyan') {
      refs.toast.className = `game-toast tone-${tone}`;
      refs.toastText.textContent = message;
      refs.toast.hidden = false;
      // Restart the entry animation for back-to-back notices.
      refs.toast.style.animation = 'none';
      void refs.toast.offsetWidth;
      refs.toast.style.animation = '';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (refs.toast.hidden = true), 2800);
    },
    flash(tone = 'violet') {
      refs.flash.classList.remove('is-on', 'is-cyan');
      void refs.flash.offsetWidth;
      refs.flash.classList.add('is-on');
      if (tone === 'cyan') refs.flash.classList.add('is-cyan');
    },
    setBriefing({ hasSave, render, best }) {
      screens.briefing.querySelector('[data-action="continue"]').hidden = !hasSave;
      $('brief-start-label').textContent = hasSave ? 'NEW SURVEY' : 'ENTER THE EXPANSE';
      $('brief-render').textContent = render;
      $('brief-best').textContent = best;
      if (current === 'briefing') ui.showScreen('briefing');
    },
    showError(message) {
      $('error-text').textContent = message;
      ui.showScreen('error');
    },

    renderHelp(source) {
      const t = $('help-table');
      t.textContent = '';
      const cur = SOURCE_INDEX[source] ?? 0;
      ['ACTION', 'KEYBOARD / MOUSE', 'GAMEPAD', 'TOUCH'].forEach((h, i) => t.append(el('div', `th${i - 1 === cur ? ' is-current' : ''}`, h)));
      for (const row of CONTROLS) {
        t.append(el('div', 'act', row[0]));
        for (let i = 1; i < 4; i += 1) t.append(el('div', `key${i - 1 === cur ? ' is-current' : ''}`, row[i]));
      }
    },

    renderFab({ inventory, recipes, levels, kits, note }) {
      $('fab-note').textContent = note;
      const inv = $('fab-inv');
      inv.textContent = '';
      for (const [key, label] of [
        ['crystal-shard', 'SHARD'],
        ['stone', 'STONE'],
        ['timber', 'TIMBER'],
        ['fiber', 'FIBER'],
      ]) {
        const s = el('span');
        s.append(el('small', null, label), el('strong', null, String(inventory[key]).padStart(2, '0')));
        inv.append(s);
      }
      const k = el('span');
      k.append(el('small', null, 'RELAY KITS'), el('strong', null, String(kits)));
      inv.append(k);
      const list = $('fab-list');
      const keep = focusIndex;
      list.textContent = '';
      for (const r of recipes) {
        const level = levels[r.id] ?? 0;
        const maxed = level >= r.max;
        const b = el('button', `recipe${maxed || r.locked ? ' is-locked' : ''}`);
        b.type = 'button';
        b.dataset.recipe = r.id;
        const head = el('span', 'recipe-head');
        head.append(el('strong', null, r.name), el('em', null, r.id === 'kit' ? `HELD ${kits}` : maxed ? 'INSTALLED' : r.max > 1 ? `LEVEL ${level} / ${r.max}` : 'NOT INSTALLED'));
        const cost = el('span', 'recipe-cost');
        for (const [item, qty] of Object.entries(r.cost)) {
          const have = inventory[item] ?? 0;
          cost.append(el('i', have >= qty ? '' : 'is-short', `${qty} ${item === 'crystal-shard' ? 'SHARD' : item.toUpperCase()}`));
        }
        b.append(head, el('small', null, r.locked || r.desc), cost);
        list.append(b);
      }
      itemCache = null;
      if (current === 'fab') {
        focusIndex = Math.min(keep, items().length - 1);
        items()[focusIndex]?.focus({ preventScroll: true });
        paintFocus();
      }
    },

    renderLog(sections) {
      const body = $('log-body');
      body.textContent = '';
      for (const sec of sections) {
        const s = el('section', 'log-section');
        s.append(el('h3', null, sec.title));
        const grid = el('div', 'log-grid');
        for (const it of sec.items) {
          const item = el('div', `log-item${it.done ? ' is-done' : ''}${it.unknown ? ' is-unknown' : ''}`);
          item.append(el('strong', null, it.name));
          if (it.text) item.append(el('small', null, it.text));
          grid.append(item);
        }
        s.append(grid);
        body.append(s);
      }
      body.scrollTop = 0;
    },

    renderResults({ kicker, title, textLine, stats }) {
      $('res-kicker').textContent = kicker;
      $('res-title').textContent = title;
      $('res-text').textContent = textLine;
      const grid = $('res-grid');
      grid.textContent = '';
      for (const s of stats) {
        const d = el('div', s.best ? 'is-best' : '');
        d.append(el('small', null, s.label), el('strong', null, s.value));
        grid.append(d);
      }
    },
  };
  return ui;
}
