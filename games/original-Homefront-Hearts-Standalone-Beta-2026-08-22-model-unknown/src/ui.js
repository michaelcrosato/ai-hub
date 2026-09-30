/**
 * ui.js — the household ledger, the HUD over the house, and every dialog,
 * in plain DOM. The original was React; this keeps its markup, class names
 * and words, and renders from the game state after each change.
 *
 * The HUD (top bar, meters, timeline) updates in place so its bars animate;
 * the ledger and dialog bodies are rebuilt and keep keyboard/controller
 * focus by each control's data-k key. New here: a pause menu, an in-game
 * confirm dialog, the household-project card, the pace picker and records
 * on the start card, a controls reference that follows the input device,
 * key and button hints, floating results over the house, and meter pops.
 */

import { METRIC_LABELS, CHAPTERS, ITEMS, SLOT_NAMES, CATEGORIES, DOCK_METRICS, ROOM_NAMES, PACES, LEGACIES, PROJECTS } from './data.js';
import {
  EVENT_BY_ID,
  PACE_BY_ID,
  MAX_SLOTS,
  MAX_REPEAT,
  clamp,
  chapterOf,
  yearOf,
  peopleAtHome,
  availableActions,
  catalogOnSale,
  catalogLater,
  withPartner,
  actionInfo,
  currentProject,
  upcomingProject,
  finishedProjects,
  projectProgress,
  projectRoom,
  applianceCredit,
  itemPrice,
  finalScore,
  legacyOf,
  hardestEra,
  paceOf,
} from './sim.js';
import { loadRecords } from './storage.js';

// ------------------------------------------------------------------ DOM helpers

function appendKids(el, kids) {
  for (const c of kids) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const PROPS = new Set(['disabled', 'hidden', 'value', 'maxLength', 'required', 'tabIndex']);

/** document.createElement with props, listeners (onClick…) and children (nested arrays, null skipped). */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  appendKids(el, children);
  return el;
}

function setKids(el, kids) {
  el.replaceChildren();
  appendKids(el, kids);
}

const cx = (...c) => c.filter(Boolean).join(' ');

function signed(v) {
  const r = Math.round(v);
  return r > 0 ? `+${r}` : String(r);
}

/** Meter colouring, exactly as the original. */
function statusOf(key, v) {
  if (key === 'money') return v < 0 ? 'danger' : v < 45 ? 'warning' : 'good';
  if (key === 'mentalLoad' || key === 'wear') return v > 72 ? 'danger' : v > 48 ? 'warning' : 'good';
  return v < 30 ? 'danger' : v < 52 ? 'warning' : 'good';
}

const REVERSED = new Set(['mentalLoad', 'wear', 'Load', 'Mental load', 'Repairs']);
const isGood = (key, v) => (REVERSED.has(key) ? v < 0 : v > 0);

/** Whether an element's focus came from the keyboard or a controller (not a click or tap). */
function keyboardFocused(el) {
  if (el.classList.contains('pad-focus')) return true;
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * Re-render a container while keeping keyboard/controller focus on "the same" control.
 * Focus left behind by a click is not carried over: re-focusing it later would make the
 * button count as keyboard-focused, and Space or Enter would press it again instead of
 * living the week.
 */
function keepFocus(container, fn) {
  const active = document.activeElement;
  const key = active && active !== document.body && container.contains(active) && keyboardFocused(active) ? active.dataset?.k : null;
  fn();
  if (!key) return;
  const esc = window.CSS?.escape ? CSS.escape(key) : key;
  const again = container.querySelector(`[data-k="${esc}"]`);
  if (again && !again.disabled) again.focus({ preventScroll: true });
}

/** Choice and milestone effects, as chips (only real meters; tags for everything else). */
function effectSummary(e = {}) {
  const chips = Object.entries(e)
    .filter(([k, v]) => typeof v === 'number' && METRIC_LABELS[k])
    .slice(0, 5);
  const tags = [];
  if (e.partnerShare) tags.push(`+${Math.round(e.partnerShare * 100)} shared-work points`);
  if (e.addRoom) tags.push(`Add ${ROOM_NAMES[e.addRoom] || e.addRoom}`);
  if (e.addChild) tags.push(`Welcome ${e.addChild.name}`);
  if (e.friends) tags.push(`${e.friends > 0 ? '+' : ''}${e.friends} friends`);
  if (e.grandchildren) tags.push(`${e.grandchildren > 0 ? '+' : ''}${e.grandchildren} grandchild`);
  if (e.removeRoom) tags.push('Downsize one extension');
  if (e.applianceCredit) tags.push(`$${e.applianceCredit} toward an appliance`);
  return h(
    'div',
    { class: 'effect-summary' },
    chips.map(([k, v]) => h('span', { class: isGood(k, v) ? null : 'is-negative' }, `${METRIC_LABELS[k]} ${signed(v)}`)),
    tags.map((t) => h('span', { class: 'is-tag' }, t))
  );
}

function effectChips(list) {
  return list.map((p) => h('span', { class: isGood(p.label, p.value) ? null : 'is-negative' }, `${signed(p.value)} ${p.label}`));
}

/** Top-two effect chips from a plain effects object (project blocks). */
function previewList(effects) {
  return Object.entries(effects)
    .filter(([k, v]) => METRIC_LABELS[k] && v)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([k, v]) => ({ label: k === 'mentalLoad' ? 'Load' : METRIC_LABELS[k], value: v, key: k }));
}

const HINTS = {
  keyboard: { catalog: 'C', journal: 'J', help: 'H', menu: 'Esc', run: 'Enter', project: '' },
  gamepad: { catalog: 'Y', journal: 'View', help: '', menu: 'Start', run: 'X', project: '' },
  touch: {},
};

const NOTICE_ACTIONS = new Set(['ADD_ACTION', 'RUN_WEEK', 'BUY_ITEM']);
const CLOSABLE = new Set(['catalog', 'journal', 'help', 'pause', 'confirm']);

// ------------------------------------------------------------------ the interface

export class GameUI {
  /**
   * @param {object} o
   * @param {object} o.kit
   * @param {object} o.sfx
   * @param {(action: object) => void} o.dispatch
   * @param {object} o.hooks  start(payload), newGame(), openGraphics(), resetView(), preview(id), hasHotspot(id), toggleSound()
   */
  constructor({ kit, sfx, dispatch, hooks }) {
    this.kit = kit;
    this.sfx = sfx;
    this.dispatch = dispatch;
    this.hooks = hooks;
    this.state = null;
    this.app = document.getElementById('app');
    this.topEl = document.getElementById('top-bar');
    this.dockEl = document.getElementById('metric-dock');
    this.hintEl = document.getElementById('world-hint');
    this.timelineEl = document.getElementById('timeline');
    this.floaterEl = document.getElementById('floaters');
    this.sidebarEl = document.getElementById('sidebar');
    this.startEl = document.getElementById('start');
    this.toastRegion = document.getElementById('toast-region');
    this.modalLayer = document.getElementById('modal-layer');

    this.category = 'All';
    this.stack = [];
    this.confirmOpts = null;
    this.finalDismissed = false;
    this.holdUntil = 0;
    this.hoverAction = null;
    this.previewAction = null;
    this.hintKey = '';
    this.noticeTimer = 0;
    this.modalEls = new Map();
    this.startShown = false;
    this.startForm = { playerName: 'Evelyn', partnerName: 'Sam', familyName: 'Hart', difficulty: 'balanced' };
    this.source = kit.input.source;

    this.buildTop();
    this.buildDock();
    this.buildTimeline();
    kit.input.onSourceChange((src) => {
      this.source = src;
      this.refreshPrompts();
    });
  }

  get hints() {
    return HINTS[this.source] || HINTS.touch;
  }

  // ---------------------------------------------------------------- whole update

  update(state, prev = null, action = null) {
    this.state = state;
    const started = !!state.started;
    this.app.classList.toggle('is-intro', !started);
    for (const el of [this.topEl, this.dockEl, this.hintEl, this.timelineEl, this.sidebarEl]) el.hidden = !started;
    this.startEl.hidden = started;
    if (!started) {
      if (!this.startShown) this.renderStart();
      this.startShown = true;
    } else {
      this.startShown = false;
      this.updateTop(state);
      this.updateDock(state, prev && prev.started && action?.type !== 'START' && action?.type !== 'LOAD' ? prev : null);
      this.updateTimeline(state);
      this.renderSidebar(state);
      this.renderHint(true);
    }
    this.renderToast(state, prev, action);
    this.renderModals();
  }

  /** The device changed: key hints, prompts and the controls reference follow it. */
  refreshPrompts() {
    const s = this.state;
    if (!s) return;
    this.updateTopHints();
    if (s.started) {
      this.renderSidebar(s);
      this.renderHint(true);
    }
    this.renderModals();
  }

  // ---------------------------------------------------------------- state helpers

  isHolding() {
    return this.holdUntil > 0 && performance.now() < this.holdUntil;
  }

  /** The ledger is frozen while the week plays out, an answer is pending, or the story is over. */
  locked(s = this.state) {
    return !!(s.pendingEvent || s.pendingMilestone || s.completed || this.isHolding());
  }

  /** The week is being lived: keep the interruption back a moment while the house reacts. */
  holdWeek(ms) {
    this.holdUntil = performance.now() + ms;
  }

  /** Called every frame: releases the held interruption. */
  tick() {
    if (this.holdUntil && !this.isHolding()) {
      this.holdUntil = 0;
      if (this.state?.started) {
        this.renderSidebar(this.state);
        this.renderHint(true);
      }
      this.renderModals();
      if (this.state?.pendingEvent) this.sfx.play('event');
    }
  }

  reset() {
    this.stack = [];
    this.confirmOpts = null;
    this.finalDismissed = false;
    this.holdUntil = 0;
    this.category = 'All';
    this.startShown = false;
    this.hoverAction = null;
    this.previewAction = null;
  }

  shownActions(s = this.state) {
    const all = availableActions(s);
    return this.category === 'All' ? all : all.filter((a) => a.category === this.category);
  }

  // ---------------------------------------------------------------- top bar

  buildTop() {
    const t = (this.top = { hints: {} });
    t.names = h('span');
    t.year = h('span');
    t.title = h('strong');
    t.week = h('small');
    const btn = (label, key, onClick, cls) => {
      const hint = h('kbd', { class: 'key-hint' });
      t.hints[key] = hint;
      return h('button', { type: 'button', class: cls, 'data-k': `top-${key}`, onClick }, label, hint);
    };
    setKids(this.topEl, [
      h('div', { class: 'brand-chip' }, h('div', { class: 'mini-mark', 'aria-hidden': 'true' }, 'HH'), h('div', null, h('strong', null, 'Homefront Hearts'), t.names)),
      h('div', { class: 'era-chip' }, t.year, t.title, t.week),
      h(
        'nav',
        { class: 'top-actions', 'aria-label': 'Game tools' },
        btn('Catalog', 'catalog', () => this.openCatalog()),
        btn('Journal', 'journal', () => this.open('journal')),
        btn('How to play', 'help', () => this.open('help')),
        btn('Menu', 'menu', () => this.open('pause'), 'menu-button'),
        h('button', { type: 'button', class: 'quiet-button', 'data-k': 'top-new', title: 'Start a new game', onClick: () => this.confirmNewGame() }, 'New')
      ),
    ]);
    this.updateTopHints();
  }

  updateTopHints() {
    const hints = this.hints;
    for (const [key, el] of Object.entries(this.top.hints)) el.textContent = hints[key] || '';
  }

  updateTop(s) {
    const c = chapterOf(s);
    this.top.names.textContent = `${s.playerName} & ${s.partnerName} ${s.familyName}`;
    this.top.year.textContent = String(c.year);
    this.top.title.textContent = c.title;
    this.top.week.textContent = s.completed ? 'The story is complete' : `Week ${s.week} of ${c.weeks}`;
  }

  // ---------------------------------------------------------------- meters

  buildDock() {
    const d = (this.dock = { metrics: {} });
    d.fundsValue = h('strong');
    d.funds = h('div', { class: 'funds-pill' }, h('span', null, 'Household funds'), d.fundsValue);
    d.peopleValue = h('strong');
    const grid = h('div', { class: 'metric-grid' });
    for (const key of DOCK_METRICS) {
      const value = h('strong');
      const fill = h('div', { class: 'metric-fill' });
      const item = h(
        'div',
        { class: 'metric-item' },
        h('div', { class: 'metric-label' }, h('span', null, METRIC_LABELS[key]), value),
        h('div', { class: 'metric-track' }, fill)
      );
      d.metrics[key] = { item, value, fill };
      grid.append(item);
    }
    const meter = (label, icon) => {
      const value = h('strong');
      const el = h('div', { class: 'pressure-meter' }, h('span', { class: 'pressure-icon', 'aria-hidden': 'true' }, icon), h('div', null, h('span', null, label), value));
      return { el, value };
    };
    d.load = meter('Mental load', '◌');
    d.wear = meter('House wear', '⌂');
    setKids(this.dockEl, [
      h('div', { class: 'funds-row' }, d.funds, h('div', { class: 'people-pill' }, h('span', null, 'At home'), d.peopleValue)),
      grid,
      h('div', { class: 'pressure-row' }, d.load.el, d.wear.el),
    ]);
  }

  updateDock(s, prev) {
    const m = s.metrics;
    const d = this.dock;
    d.funds.className = cx('funds-pill', `status-${statusOf('money', m.money)}`);
    d.fundsValue.textContent = `$${Math.round(m.money)}`;
    d.peopleValue.textContent = String(peopleAtHome(s));
    for (const key of DOCK_METRICS) {
      const r = d.metrics[key];
      const v = m[key];
      r.item.className = cx('metric-item', `status-${statusOf(key, v)}`);
      r.item.title = `${METRIC_LABELS[key]}: ${Math.round(v)}%`;
      r.value.textContent = String(Math.round(v));
      r.fill.style.width = `${clamp(v, 0, 100)}%`;
    }
    d.load.el.className = cx('pressure-meter', `status-${statusOf('mentalLoad', m.mentalLoad)}`);
    d.load.value.textContent = `${Math.round(m.mentalLoad)}%`;
    d.wear.el.className = cx('pressure-meter', `status-${statusOf('wear', m.wear)}`);
    d.wear.value.textContent = `${Math.round(m.wear)}%`;
    if (!prev || prev.metrics === m) return;
    // Small "+12" pops on every meter that moved.
    const anchor = (key) => (key === 'money' ? d.funds : key === 'mentalLoad' ? d.load.el : key === 'wear' ? d.wear.el : d.metrics[key]?.item);
    for (const key of ['money', ...DOCK_METRICS, 'mentalLoad', 'wear']) {
      const diff = Math.round(m[key]) - Math.round(prev.metrics[key]);
      const el = anchor(key);
      if (!diff || !el) continue;
      const pop = h('span', { class: cx('metric-pop', isGood(key, diff) ? 'is-good' : 'is-bad'), 'aria-hidden': 'true' }, key === 'money' ? `${diff > 0 ? '+' : '-'}$${Math.abs(diff)}` : signed(diff));
      el.append(pop);
      setTimeout(() => pop.remove(), 1600);
    }
  }

  // ---------------------------------------------------------------- hint, timeline

  setHover(actionId) {
    if (this.hoverAction === actionId) return;
    this.hoverAction = actionId;
    this.renderHint();
  }

  setPreview(actionId) {
    if (this.previewAction === actionId) return;
    this.previewAction = actionId;
    this.hooks.preview(actionId);
    this.renderHint();
  }

  renderHint(force = false) {
    const s = this.state;
    if (!s?.started) return;
    const id = this.hoverAction || this.previewAction;
    const info = id ? actionInfo(id, s) : null;
    const holding = this.isHolding();
    const key = `${id}|${info?.shortName}|${s.plan.length}|${s.completed}|${holding}|${this.source}|${!!this.hoverAction}`;
    if (!force && key === this.hintKey) return;
    this.hintKey = key;
    const touch = this.source === 'touch';
    const pad = this.source === 'gamepad';
    let kids;
    if (info) {
      const detail = this.hoverAction
        ? touch
          ? 'Tap the object to add this priority'
          : 'Click the object to add this priority'
        : this.hooks.hasHotspot(id)
          ? 'It happens here in the house'
          : 'It happens all around the household';
      kids = [h('span', { class: 'world-hint-icon' }, info.icon), h('div', null, h('strong', null, info.shortName), h('small', null, detail))];
    } else {
      const [title, detail] = s.completed
        ? ['The story is complete', 'Look around the house your family built']
        : holding
          ? ['The week is in motion', 'Life rarely lets a plan run untouched']
          : s.plan.length < MAX_SLOTS
            ? [
                'The rooms are playable',
                touch ? 'Tap furniture and family members for shortcuts' : pad ? 'Choose priorities in the ledger with the D-pad' : 'Hover furniture and family members for shortcuts',
              ]
            : ['The week is planned', pad ? 'Press X to live the week' : 'Run the week from the household ledger'];
      kids = [h('span', { class: 'world-hint-dot', 'aria-hidden': 'true' }), h('div', null, h('strong', null, title), h('small', null, detail))];
    }
    this.hintEl.className = cx('world-hint', info && 'is-active');
    setKids(this.hintEl, kids);
  }

  buildTimeline() {
    this.timelineEras = CHAPTERS.map((c) => {
      const el = h('div', { class: 'timeline-era', title: `${c.year} · ${c.title}` }, h('span', { class: 'timeline-dot' }), h('small', null, String(c.year)), h('strong', null, c.title));
      return el;
    });
    setKids(this.timelineEl, this.timelineEras);
  }

  updateTimeline(s) {
    this.timelineEras.forEach((el, i) => {
      const done = i < s.chapterIndex || (s.completed && i === s.chapterIndex);
      el.className = cx('timeline-era', done && 'is-complete', i === s.chapterIndex && !s.completed && 'is-current');
    });
  }

  // ---------------------------------------------------------------- sidebar

  renderSidebar(s) {
    keepFocus(this.sidebarEl, () =>
      setKids(this.sidebarEl, [this.eraBrief(s), s.completed ? this.storyCard(s) : null, this.planner(s), this.projectCard(s), this.tasks(s), this.footer(s)])
    );
  }

  eraBrief(s) {
    const c = chapterOf(s);
    return h(
      'section',
      { class: 'era-brief' },
      h('div', { class: 'eyebrow' }, `Era ${s.chapterIndex + 1} of ${CHAPTERS.length}`),
      h('h2', null, c.subtitle),
      h('p', null, c.context)
    );
  }

  storyCard(s) {
    const last = CHAPTERS[CHAPTERS.length - 1];
    const legacy = legacyOf(s);
    return h(
      'section',
      { class: 'story-card' },
      h('span', { class: 'eyebrow' }, `${last.year} · ${last.year - CHAPTERS[0].year} years of marriage`),
      h('h3', null, legacy.title),
      h('p', null, `Life balance ${finalScore(s)} out of 100. The house keeps every room, object and project you built.`),
      h(
        'div',
        { class: 'story-actions' },
        h('button', { type: 'button', class: 'secondary-button', 'data-k': 'story-final', onClick: () => this.showFinal() }, 'See the final chapter'),
        h('button', { type: 'button', class: 'primary-button', 'data-k': 'story-new', onClick: () => this.confirmNewGame() }, 'Begin another marriage')
      )
    );
  }

  planner(s) {
    const ready = s.plan.length === MAX_SLOTS;
    const locked = this.locked(s);
    const holding = this.isHolding();
    const runHint = this.hints.run;
    return h(
      'section',
      { class: 'planner-card' },
      h(
        'div',
        { class: 'section-heading planner-heading' },
        h('div', null, h('span', { class: 'eyebrow' }, 'Four focus slots'), h('h3', null, 'Plan this week')),
        s.plan.length > 0 && !locked
          ? h('button', { type: 'button', class: 'text-button', 'data-k': 'plan-clear', onClick: () => this.dispatch({ type: 'CLEAR_PLAN' }) }, 'Clear')
          : null
      ),
      h(
        'div',
        { class: 'plan-slots' },
        SLOT_NAMES.map((name, i) => {
          const id = s.plan[i];
          const info = id ? actionInfo(id, s) : null;
          return h(
            'button',
            {
              type: 'button',
              class: cx('plan-slot', info && 'is-filled'),
              'data-k': `slot-${i}`,
              disabled: !info || locked,
              title: info ? `Remove ${info.name}` : `${name} is empty`,
              onClick: info ? () => this.dispatch({ type: 'REMOVE_ACTION', index: i }) : null,
            },
            h('span', { class: 'slot-time' }, name),
            info
              ? [h('span', { class: 'slot-icon' }, info.icon), h('strong', null, info.shortName), h('span', { class: 'slot-remove', 'aria-hidden': 'true' }, '×')]
              : h('span', { class: 'slot-empty' }, 'Choose a priority')
          );
        })
      ),
      h(
        'div',
        { class: 'run-row' },
        h('div', { class: 'week-cost' }, h('span', null, 'The aim is balance, not completion.'), h('small', null, `${s.plan.length}/4 priorities chosen`)),
        h(
          'button',
          {
            type: 'button',
            class: cx('run-button', ready && !locked && 'is-ready'),
            'data-k': 'run',
            disabled: !ready || locked,
            onClick: () => this.dispatch({ type: 'RUN_WEEK' }),
          },
          h('span', null, holding ? 'Living the week…' : ready ? 'Live the week' : 'Fill the week'),
          runHint && ready && !locked ? h('kbd', { class: 'key-hint' }, runHint) : null,
          h('b', { 'aria-hidden': 'true' }, '→')
        )
      )
    );
  }

  projectCard(s) {
    const p = currentProject(s);
    const done = finishedProjects(s);
    if (!p) {
      const next = upcomingProject(s);
      if (!done.length && !next) return null;
      return h(
        'section',
        { class: 'project-card is-idle' },
        h(
          'div',
          { class: 'section-heading' },
          h('div', null, h('span', { class: 'eyebrow' }, 'Household projects'), h('h3', null, done.length ? `${done.length} of ${PROJECTS.length} finished` : 'Nothing under way')),
        ),
        h(
          'p',
          { class: 'project-copy' },
          next ? `The next project arrives in ${CHAPTERS[next.chapter].year}: ${next.name.toLowerCase()}.` : 'Every household project is finished. They stay part of the house.'
        ),
        done.length ? h('div', { class: 'owned-row' }, done.map((d) => h('span', { title: withPartner(d.perk, s) }, `${d.icon} ${d.shortName}`))) : null
      );
    }
    const step = projectProgress(s, p.id);
    const planned = s.plan.filter((id) => id === 'project').length;
    const canAdd = projectRoom(s) > 0 && s.plan.length < MAX_SLOTS && !this.locked(s);
    const left = p.steps - step;
    const dots = [];
    for (let i = 0; i < p.steps; i++) dots.push(h('span', { class: cx('project-dot', i < step && 'is-built', i >= step && i < step + planned && 'is-planned') }));
    const preview = () => this.setPreview('project');
    const unpreview = () => this.setPreview(null);
    return h(
      'section',
      { class: 'project-card' },
      h(
        'div',
        { class: 'section-heading' },
        h('div', null, h('span', { class: 'eyebrow' }, `Household project · ${CHAPTERS[p.chapter].year}`), h('h3', null, `${p.icon} ${p.name}`)),
        h('span', { class: 'project-steps', role: 'img', 'aria-label': `${step} of ${p.steps} steps built` }, dots)
      ),
      h('p', { class: 'project-copy' }, withPartner(p.description, s)),
      h('div', { class: 'effect-chips project-chips' }, effectChips(previewList(p.stepEffects)), h('span', { class: 'is-tag' }, 'each block')),
      h('p', { class: 'project-perk' }, h('strong', null, 'When finished: '), withPartner(p.perk, s)),
      h(
        'div',
        { class: 'project-row' },
        h('small', null, `${left} block${left === 1 ? '' : 's'} to go${planned ? ` · ${planned} planned this week` : ''}`),
        h(
          'button',
          {
            type: 'button',
            class: 'project-add',
            'data-k': 'project-add',
            disabled: !canAdd,
            onClick: () => this.dispatch({ type: 'ADD_ACTION', actionId: 'project' }),
            onPointerenter: preview,
            onPointerleave: unpreview,
            onFocus: preview,
            onBlur: unpreview,
          },
          'Add a block'
        )
      )
    );
  }

  tasks(s) {
    const shown = this.shownActions(s);
    const locked = this.locked(s);
    const keys = this.source === 'keyboard';
    return h(
      'section',
      { class: 'tasks-section' },
      h(
        'div',
        { class: 'section-heading' },
        h('div', null, h('span', { class: 'eyebrow' }, 'Choose priorities'), h('h3', null, 'Household ledger')),
        h('span', { class: 'available-count' }, `${shown.length} shown`)
      ),
      h(
        'div',
        { class: 'category-tabs', role: 'tablist', 'aria-label': 'Task categories' },
        CATEGORIES.map((g) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': String(this.category === g),
              class: this.category === g ? 'is-selected' : null,
              'data-k': `tab-${g}`,
              onClick: () => this.setCategory(g),
            },
            g
          )
        )
      ),
      h(
        'div',
        { class: 'task-grid' },
        shown.map((a, i) => {
          const count = s.plan.filter((id) => id === a.id).length;
          const disabled = locked || s.plan.length >= MAX_SLOTS || count >= MAX_REPEAT;
          const preview = () => this.setPreview(a.id);
          const unpreview = () => this.setPreview(null);
          return h(
            'button',
            {
              type: 'button',
              class: cx('action-card', disabled && 'is-disabled'),
              disabled,
              title: a.description,
              'data-k': `task-${a.id}`,
              onClick: () => this.dispatch({ type: 'ADD_ACTION', actionId: a.id }),
              onPointerenter: preview,
              onPointerleave: unpreview,
              onFocus: preview,
              onBlur: unpreview,
            },
            h('span', { class: 'action-icon', 'aria-hidden': 'true' }, a.icon),
            h('span', { class: 'action-copy' }, h('strong', null, a.shortName), h('small', null, a.description)),
            h('span', { class: 'effect-chips' }, effectChips(a.preview)),
            count > 0 ? h('span', { class: 'repeat-badge' }, `${count}×`) : null,
            keys && i < 10 && !disabled ? h('kbd', { class: 'card-key', 'aria-hidden': 'true' }, String((i + 1) % 10)) : null
          );
        })
      )
    );
  }

  footer(s) {
    return h(
      'footer',
      { class: 'sidebar-footer' },
      h('span', { class: 'save-dot', 'aria-hidden': 'true' }),
      h('span', null, 'Auto-saved in this browser'),
      h('span', { class: 'pace-tag' }, `${paceOf(s).label} pace`),
      h('span', null, `Rooms ${s.household.rooms.length} · Objects ${s.household.owned.length}`)
    );
  }

  setCategory(g) {
    if (this.category === g) return;
    this.category = g;
    if (this.state?.started) this.renderSidebar(this.state);
  }

  cycleCategory(dir) {
    const i = CATEGORIES.indexOf(this.category);
    this.setCategory(CATEGORIES[(i + dir + CATEGORIES.length) % CATEGORIES.length]);
    this.sfx.play('open');
  }

  // ---------------------------------------------------------------- start card

  renderStart() {
    const f = this.startForm;
    const records = loadRecords();
    const field = (label, key) =>
      h(
        'label',
        null,
        h('span', null, label),
        h('input', {
          value: f[key],
          maxLength: 24,
          required: true,
          autocomplete: 'off',
          'data-k': `name-${key}`,
          onInput: (e) => {
            f[key] = e.target.value;
          },
        })
      );
    const paceButtons = PACES.map((p) =>
      h(
        'button',
        {
          type: 'button',
          class: cx('pace-option', f.difficulty === p.id && 'is-selected'),
          role: 'radio',
          'aria-checked': String(f.difficulty === p.id),
          'data-k': `pace-${p.id}`,
          'data-pace': p.id,
          onClick: (e) => {
            f.difficulty = p.id;
            for (const b of e.currentTarget.parentElement.querySelectorAll('.pace-option')) {
              const on = b.dataset.pace === p.id;
              b.classList.toggle('is-selected', on);
              b.setAttribute('aria-checked', String(on));
            }
          },
        },
        h('strong', null, p.label),
        h('small', null, p.detail)
      )
    );
    const bests = PACES.filter((p) => records.best[p.id]).map((p) => `${p.label} ${records.best[p.id]}`);
    const recordStrip = records.completed
      ? h(
          'div',
          { class: 'records-strip' },
          h('span', null, h('b', null, String(records.completed)), records.completed === 1 ? ' marriage lived' : ' marriages lived'),
          bests.length ? h('span', null, 'Best life balance: ', h('b', null, bests.join(' · '))) : null,
          h('span', null, 'Legacies found: ', h('b', null, `${records.legacies.length} of ${LEGACIES.length}`))
        )
      : null;
    const submit = (e) => {
      e.preventDefault();
      this.hooks.start({ ...f });
    };
    setKids(this.startEl, [
      h(
        'div',
        { class: 'start-card' },
        h('div', { class: 'eyebrow' }, 'A household-management story · 1954–2014'),
        h(
          'div',
          { class: 'title-lockup' },
          h('div', { class: 'title-mark', 'aria-hidden': 'true' }, h('span', null, 'H'), h('span', null, 'H')),
          h(
            'div',
            null,
            h('h1', null, 'Homefront Hearts'),
            h('p', { class: 'start-subtitle' }, 'Build a home. Share a life. Decide what “taking care of everything” should really mean.')
          )
        ),
        h('div', { class: 'feature-strip' }, h('span', null, 'Seven eras'), h('span', null, 'A growing 3D house'), h('span', null, 'No perfect weeks')),
        h(
          'p',
          { class: 'start-copy' },
          'You begin as a newlywed homemaker in a bright little cottage. Across sixty years, the family, house, possessions, friendships, and invisible workload all grow. Plan four weekly priorities, respond to life’s interruptions, and keep care from consuming the person doing it.'
        ),
        h(
          'form',
          { class: 'name-form', onSubmit: submit },
          field('Your name', 'playerName'),
          field('Partner’s name', 'partnerName'),
          field('Family name', 'familyName'),
          h('div', { class: 'pace-picker', role: 'radiogroup', 'aria-label': 'Pace' }, h('span', { class: 'pace-label' }, 'Pace'), paceButtons),
          h('button', { type: 'submit', class: 'start-button', 'data-k': 'start' }, h('span', null, 'Begin the marriage'), h('small', null, 'Spring 1954'))
        ),
        recordStrip,
        h(
          'p',
          { class: 'historical-note' },
          'This is a stylized story rather than a universal history. The era’s unequal expectations appear as game pressure, not as an endorsement of them.'
        )
      ),
    ]);
  }

  /** Begin the marriage from the start card (the form's own checks still apply). */
  submitStart() {
    const form = this.startEl.querySelector('.name-form');
    if (!form || this.startEl.hidden) return;
    if (form.requestSubmit) form.requestSubmit();
    else form.querySelector('.start-button')?.click();
  }

  // ---------------------------------------------------------------- toast and floaters

  /** Only the notice changed (it timed out): nothing else needs to be redrawn. */
  noticeChanged(state, prev, action) {
    this.state = state;
    this.renderToast(state, prev, action);
  }

  renderToast(s, prev, action) {
    const fresh = !!s.notice && s !== prev && (prev?.notice !== s.notice || NOTICE_ACTIONS.has(action?.type));
    if (!s.notice) {
      clearTimeout(this.noticeTimer);
      this.toastRegion.replaceChildren();
      return;
    }
    if (!fresh) return;
    clearTimeout(this.noticeTimer);
    this.toastRegion.replaceChildren(h('div', { class: 'toast', role: 'status' }, s.notice));
    this.noticeTimer = setTimeout(() => this.dispatch({ type: 'DISMISS_NOTICE' }), 2300);
  }

  /** Rising icons and results over the house when the week is lived. */
  spawnFloaters(items) {
    items.forEach((it, i) => {
      const el = h(
        'div',
        {
          class: cx('floater', it.good === false && 'is-bad'),
          style: { left: `${Math.round(it.x)}px`, top: `${Math.round(it.y)}px`, animationDelay: `${i * 140}ms` },
        },
        h('span', { class: 'floater-icon' }, it.icon),
        it.text ? h('b', null, it.text) : null
      );
      this.floaterEl.append(el);
      setTimeout(() => el.remove(), 2600 + i * 140);
    });
  }

  // ---------------------------------------------------------------- dialogs

  desiredStack() {
    const s = this.state;
    const list = [];
    if (s?.started && !this.isHolding()) {
      if (s.pendingEvent && EVENT_BY_ID[s.pendingEvent]) list.push('event');
      else if (s.pendingMilestone) list.push('milestone');
      else if (s.completed && !this.finalDismissed) list.push('final');
    }
    for (const t of this.stack) list.push(t);
    return list;
  }

  hasModal() {
    return this.desiredStack().length > 0;
  }

  topModal() {
    const list = this.desiredStack();
    return list[list.length - 1] || null;
  }

  open(type) {
    if (type === 'confirm') this.stack = this.stack.filter((t) => t !== 'confirm');
    else if (this.stack.includes(type)) return;
    // Menu entries replace the pause menu rather than piling on top of it.
    if (type !== 'confirm' && type !== 'pause') this.stack = this.stack.filter((t) => t !== 'pause');
    this.stack.push(type);
    this.sfx.play('open');
    this.renderModals();
  }

  close(type) {
    const i = this.stack.lastIndexOf(type);
    if (i < 0) return false;
    this.stack.splice(i, 1);
    if (type === 'confirm') this.confirmOpts = null;
    this.sfx.play('close');
    this.renderModals();
    this.kit.input.settle();
    return true;
  }

  /** Escape, P or Start: close the topmost closable dialog, otherwise open or close the menu. */
  onPauseKey() {
    const top = this.stack[this.stack.length - 1];
    if (top && CLOSABLE.has(top)) this.close(top);
    else this.open('pause');
  }

  /** B on a controller: close the topmost closable dialog. */
  onBack() {
    const top = this.stack[this.stack.length - 1];
    return top ? this.close(top) : false;
  }

  openCatalog() {
    const s = this.state;
    if (!s?.started || s.pendingEvent || s.pendingMilestone) return;
    this.open('catalog');
  }

  showFinal() {
    this.finalDismissed = false;
    this.renderModals();
  }

  confirm(opts) {
    this.confirmOpts = opts;
    this.open('confirm');
  }

  confirmNewGame() {
    this.confirm({
      title: 'Begin a new marriage?',
      body: 'The current auto-save will be replaced. Your records and discovered legacies stay.',
      confirmLabel: 'Begin again',
      onConfirm: () => this.hooks.newGame(),
    });
  }

  /** Number keys answer the open dilemma (1 or 2). */
  chooseByNumber(n) {
    const top = this.topModal();
    const s = this.state;
    if (top === 'event') {
      const ev = EVENT_BY_ID[s.pendingEvent];
      if (ev?.choices[n - 1]) this.dispatch({ type: 'CHOOSE_EVENT', choiceIndex: n - 1 });
      return true;
    }
    if (top === 'milestone') {
      if (chapterOf(s).milestone.choices[n - 1]) this.dispatch({ type: 'CHOOSE_MILESTONE', choiceIndex: n - 1 });
      return true;
    }
    return false;
  }

  renderModals() {
    const want = this.desiredStack();
    for (const [type, rec] of this.modalEls) {
      if (!want.includes(type)) {
        rec.backdrop.remove();
        this.modalEls.delete(type);
      }
    }
    want.forEach((type, i) => {
      let rec = this.modalEls.get(type);
      const isNew = !rec;
      if (isNew) {
        rec = this.createModal(type);
        this.modalEls.set(type, rec);
      }
      if (this.modalLayer.children[i] !== rec.backdrop) this.modalLayer.insertBefore(rec.backdrop, this.modalLayer.children[i] || null);
      rec.backdrop.style.zIndex = String(70 + i * 2);
      const top = i === want.length - 1;
      rec.backdrop.inert = !top;
      this.fillModal(type, rec);
      if (isNew && top && this.source !== 'touch') {
        const first = rec.card.querySelector('.choice-card, .menu-list button, .confirm-actions .secondary-button, .final-actions .primary-button, .modal-close');
        (first || rec.card).focus({ preventScroll: true });
      }
    });
    // Everything behind a dialog is out of reach for Tab and screen readers. The canvas is
    // left alone (the backdrop already covers it): making it inert in the middle of a drag
    // would swallow the release and leave the kit thinking a button or finger is still down.
    const blocked = want.length > 0;
    for (const el of [this.topEl, this.dockEl, this.hintEl, this.timelineEl, this.sidebarEl, this.startEl]) el.inert = blocked;
  }

  createModal(type) {
    const card = h('section', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', tabIndex: -1 });
    const backdrop = h('div', { class: 'modal-backdrop', role: 'presentation' }, card);
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop && CLOSABLE.has(type)) this.close(type);
    });
    return { backdrop, card };
  }

  fillModal(type, rec) {
    const spec = this.modalSpec(type);
    if (!spec) return;
    rec.card.className = cx('modal-card', spec.wide && 'is-wide', `modal-${type}`);
    rec.card.setAttribute('aria-label', spec.title);
    const oldBody = rec.card.querySelector('.modal-body');
    const scroll = oldBody ? oldBody.scrollTop : 0;
    keepFocus(rec.card, () =>
      setKids(rec.card, [
        h(
          'header',
          { class: 'modal-header' },
          h('div', null, spec.kicker ? h('span', { class: 'eyebrow' }, spec.kicker) : null, h('h2', null, spec.title), spec.subtitle ? h('p', null, spec.subtitle) : null),
          spec.locked
            ? null
            : h('button', { type: 'button', class: 'modal-close', 'aria-label': spec.closeLabel || 'Close', 'data-k': `${type}-close`, onClick: () => this.close(type) }, '×')
        ),
        h('div', { class: 'modal-body' }, spec.body),
      ])
    );
    const body = rec.card.querySelector('.modal-body');
    if (body && scroll) body.scrollTop = scroll;
  }

  modalSpec(type) {
    const s = this.state;
    switch (type) {
      case 'event':
        return this.eventSpec(s);
      case 'milestone':
        return this.milestoneSpec(s);
      case 'final':
        return this.finalSpec(s);
      case 'catalog':
        return this.catalogSpec(s);
      case 'journal':
        return this.journalSpec(s);
      case 'help':
        return this.helpSpec();
      case 'pause':
        return this.pauseSpec(s);
      case 'confirm':
        return this.confirmSpec();
      default:
        return null;
    }
  }

  choiceCard(choice, i, onClick, extra) {
    const s = this.state;
    const key = this.source === 'keyboard' ? String(i + 1) : '';
    return h(
      'button',
      { type: 'button', class: cx('choice-card', extra), 'data-k': `choice-${i}`, onClick },
      h('span', { class: 'choice-number' }, String(i + 1).padStart(2, '0'), key ? h('kbd', { class: 'key-hint' }, key) : null),
      h('strong', null, withPartner(choice.label, s)),
      h('p', null, withPartner(choice.detail, s)),
      effectSummary(choice.effects)
    );
  }

  eventSpec(s) {
    const ev = EVENT_BY_ID[s.pendingEvent];
    if (!ev) return null;
    const deltas = Object.entries(s.lastWeekDelta || {})
      .filter(([k, v]) => METRIC_LABELS[k] && Math.abs(v) >= 2)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5);
    const finished = s.lastProject ? PROJECTS.find((p) => p.id === s.lastProject) : null;
    return {
      kicker: `${yearOf(s)} · The week in motion`,
      title: withPartner(ev.title, s),
      subtitle: withPartner(ev.body, s),
      locked: true,
      wide: true,
      body: [
        h(
          'div',
          { class: 'week-result' },
          h('strong', null, 'Before the interruption'),
          h(
            'div',
            { class: 'delta-row' },
            deltas.map(([k, v]) => h('span', { class: cx('delta-chip', !isGood(k, v) && 'is-negative') }, `${METRIC_LABELS[k]} ${signed(v)}`))
          ),
          finished ? h('p', { class: 'project-done' }, `${finished.icon} ${finished.name}: finished! ${withPartner(finished.perk, s)}`) : null
        ),
        h(
          'div',
          { class: 'choice-grid' },
          ev.choices.map((c, i) => this.choiceCard(c, i, () => this.dispatch({ type: 'CHOOSE_EVENT', choiceIndex: i })))
        ),
        h('p', { class: 'modal-footnote' }, 'Both choices involve a trade-off. The game rewards sustainable care, not silent perfection.'),
      ],
    };
  }

  milestoneSpec(s) {
    const c = chapterOf(s);
    const m = c.milestone;
    const hh = s.household;
    return {
      kicker: `${c.year} · Era milestone`,
      title: withPartner(m.title, s),
      subtitle: withPartner(m.body, s),
      locked: true,
      wide: true,
      body: [
        h(
          'div',
          { class: 'household-snapshot' },
          h('div', null, h('span', null, 'Family'), h('strong', null, `${2 + hh.children.length + hh.grandchildren + (hh.dependents ?? 0)} people across the generations`)),
          h('div', null, h('span', null, 'Home'), h('strong', null, `${hh.rooms.length} rooms · ${hh.owned.length} accumulated objects`)),
          h('div', null, h('span', null, 'Support'), h('strong', null, `${hh.friends} close friends · ${Math.round(hh.partnerShare * 100)}% partner share`))
        ),
        h(
          'div',
          { class: 'choice-grid milestone-choices' },
          m.choices.map((choice, i) => this.choiceCard(choice, i, () => this.dispatch({ type: 'CHOOSE_MILESTONE', choiceIndex: i }), 'milestone-choice'))
        ),
      ],
    };
  }

  finalSpec(s) {
    const first = CHAPTERS[0];
    const last = CHAPTERS[CHAPTERS.length - 1];
    const score = finalScore(s);
    const legacy = legacyOf(s);
    const hard = hardestEra(s);
    const rec = s.recorded;
    const pace = PACE_BY_ID[s.difficulty] ?? PACE_BY_ID.balanced;
    const stat = (label, value, suffix = '%') => h('div', { class: 'legacy-stat' }, h('span', null, label), h('strong', null, `${Math.round(value)}${suffix}`));
    const records = rec
      ? h(
          'p',
          { class: cx('record-line', rec.isBest && 'is-best') },
          rec.isBest
            ? rec.previousBest == null
              ? `Your first finished marriage on the ${pace.label} pace sets the record to beat.`
              : `A new personal best on the ${pace.label} pace (previously ${rec.previousBest}).`
            : `Your best on the ${pace.label} pace is ${rec.previousBest}.`,
          ` Legacies discovered: ${rec.legaciesFound} of ${LEGACIES.length}.`
        )
      : null;
    return {
      kicker: `${last.year} · ${last.year - first.year} years of marriage`,
      title: legacy.title,
      subtitle: legacy.text,
      locked: true,
      wide: true,
      body: [
        h(
          'div',
          { class: 'final-score-row' },
          h('div', { class: 'final-score' }, h('span', null, 'Life balance'), h('strong', null, String(score)), h('small', null, 'out of 100')),
          h(
            'div',
            { class: 'final-copy' },
            h(
              'p',
              null,
              `The ${s.familyName} household reached its diamond anniversary with ${s.household.children.length} children, ${s.household.grandchildren} grandchildren, ${s.household.friends} close friends, and ${s.household.owned.length} accumulated household objects.`
            ),
            hard ? h('p', null, `The hardest era was ${hard.title} (${hard.year}). Its strain remains part of the story rather than cancelling everything that came after.`) : null,
            finishedProjects(s).length ? h('p', null, `Household projects finished: ${finishedProjects(s).map((p) => p.shortName.toLowerCase()).join(', ')}.`) : null,
            records
          )
        ),
        h(
          'div',
          { class: 'legacy-grid' },
          stat('Family warmth', s.metrics.family),
          stat('Partnership', s.metrics.partnership),
          stat('Personal wellbeing', s.metrics.wellbeing),
          stat('Community', s.metrics.community),
          stat('Mental load', 100 - s.metrics.mentalLoad, ' managed'),
          stat('House condition', 100 - s.metrics.wear, ' sound')
        ),
        s.memories[0] ? h('blockquote', { class: 'final-memory' }, s.memories[0]) : null,
        h(
          'div',
          { class: 'final-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'secondary-button',
              'data-k': 'final-look',
              onClick: () => {
                this.finalDismissed = true;
                this.renderModals();
              },
            },
            'Keep looking around the house'
          ),
          h('button', { type: 'button', class: 'primary-button', 'data-k': 'final-new', onClick: () => this.confirmNewGame() }, 'Begin another marriage')
        ),
      ],
    };
  }

  catalogSpec(s) {
    if (!s?.started) return null;
    const onSale = catalogOnSale(s);
    const later = catalogLater(s).slice(0, 4);
    const owned = ITEMS.filter((i) => s.household.owned.includes(i.id));
    const credit = applianceCredit(s);
    return {
      kicker: `${yearOf(s)} household catalog`,
      title: 'Buy time, space, and convenience',
      subtitle: 'Objects can reduce effort, but every new object also becomes part of the home you maintain.',
      wide: true,
      body: [
        h('div', { class: 'catalog-balance' }, h('span', null, 'Available funds'), h('strong', null, `$${Math.round(s.metrics.money)}`)),
        credit ? h('p', { class: 'catalog-credit' }, `Instalment credit: $${credit} off your next purchase.`) : null,
        onSale.length
          ? h(
              'div',
              { class: 'catalog-grid' },
              onSale.map((item) => {
                const price = itemPrice(item, s);
                const afford = s.metrics.money >= price;
                return h(
                  'article',
                  { class: 'catalog-item' },
                  h('span', { class: 'catalog-icon' }, item.icon),
                  h('div', { class: 'catalog-copy' }, h('span', { class: 'catalog-year' }, String(item.year)), h('h3', null, item.name), h('p', null, item.description)),
                  h(
                    'button',
                    { type: 'button', 'data-k': `buy-${item.id}`, disabled: !afford, onClick: () => this.dispatch({ type: 'BUY_ITEM', itemId: item.id }) },
                    afford ? `Buy · $${price}` : `Need $${price}`,
                    price !== item.cost ? h('s', null, ` $${item.cost}`) : null
                  )
                );
              })
            )
          : h('p', { class: 'empty-state' }, 'You own every item currently available.'),
        owned.length
          ? h('section', { class: 'owned-section' }, h('h3', null, 'Already in the house'), h('div', { class: 'owned-row' }, owned.map((i) => h('span', null, `${i.icon} ${i.name}`))))
          : null,
        later.length
          ? h('section', { class: 'locked-section' }, h('h3', null, 'Later in the marriage'), h('div', { class: 'locked-row' }, later.map((i) => h('span', null, `${i.year} · ${i.name}`))))
          : null,
      ],
    };
  }

  journalSpec(s) {
    if (!s?.started) return null;
    const records = loadRecords();
    const done = finishedProjects(s);
    const cell = (label, value) => h('div', null, h('span', null, label), h('strong', null, String(value)));
    return {
      kicker: `The ${s.familyName} household ledger`,
      title: 'Journal and memory box',
      subtitle: 'The record keeps the interruptions and negotiations—not only the polished milestones.',
      wide: true,
      body: [
        h(
          'div',
          { class: 'journal-stats' },
          cell('Children', s.household.children.length),
          cell('Grandchildren', s.household.grandchildren),
          cell('Close friends', s.household.friends),
          cell('Shared workload', `${Math.round(s.household.partnerShare * 100)}%`)
        ),
        h(
          'div',
          { class: 'journal-stats is-secondary' },
          cell('Pace', paceOf(s).label),
          cell('Projects finished', `${done.length}/${PROJECTS.length}`),
          cell('Marriages lived', records.completed),
          cell('Legacies found', `${records.legacies.length}/${LEGACIES.length}`)
        ),
        h(
          'div',
          { class: 'journal-columns' },
          h(
            'section',
            null,
            h('h3', null, 'Memory box'),
            s.memories.length
              ? h('div', { class: 'memory-list' }, s.memories.slice(0, 10).map((m) => h('blockquote', null, m)))
              : h('p', { class: 'empty-state' }, 'The first memories will appear after the first lived week.')
          ),
          h(
            'section',
            null,
            h('h3', null, 'Era report cards'),
            s.eraSummaries.length
              ? h(
                  'div',
                  { class: 'era-summary-list' },
                  s.eraSummaries.map((r) => h('div', null, h('span', null, String(r.year)), h('strong', null, r.title), h('b', null, `${r.score}/100`)))
                )
              : h('p', { class: 'empty-state' }, 'Complete the first era to create a report card.'),
            h('h3', { class: 'history-title' }, 'Recent ledger entries'),
            h(
              'div',
              { class: 'history-list' },
              s.history.slice(0, 8).map((r) => h('article', null, h('span', null, String(r.year ?? '')), h('div', null, h('strong', null, r.title), h('p', null, r.body))))
            )
          )
        ),
      ],
    };
  }

  helpSpec() {
    const step = (number, title, text) => h('article', { class: 'help-step' }, h('span', null, number), h('h3', null, title), h('p', null, text));
    const note = (title, text) => h('div', null, h('strong', null, title), h('p', null, text));
    const src = this.source;
    const col = (id, title, rows) =>
      h(
        'div',
        { class: cx('controls-col', src === id && 'is-current') },
        h('strong', null, title, src === id ? h('small', null, ' · in use') : null),
        h('dl', null, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))
      );
    return {
      kicker: 'A three-minute household briefing',
      title: 'How to play',
      subtitle: 'There is no game over. Difficult weeks become part of the marriage, and every metric can recover.',
      wide: true,
      body: [
        h(
          'div',
          { class: 'help-grid' },
          step('01', 'Choose four priorities', 'Each slot represents a block of attention, not a literal single chore. You may repeat a priority twice.'),
          step(
            '02',
            'Watch the invisible work',
            'Mental load rises with people, rooms, and care obligations. Budgeting, rest, and clearly sharing responsibility keep it manageable.'
          ),
          step('03', 'Live with interruption', 'Every representative week ends with a dilemma. Both answers cost something; choose the trade-off this household can sustain.'),
          step(
            '04',
            'Grow through eras',
            'At milestones, the family and house change. Your possessions stay, your decisions accumulate, and old strategies may stop working.'
          )
        ),
        h(
          'div',
          { class: 'help-notes' },
          note('World shortcuts', 'Click the stove, laundry, desk, sofa, broom, garden, family members, and other objects to add related tasks.'),
          note(
            'Reading the meters',
            'Most meters are better when high. Mental load and house wear are better when low. Funds may briefly go below zero, but debt creates pressure.'
          ),
          note('A realistic standard', 'The system expects some disorder, fatigue, and compromise. Sustainable care scores better than relentless self-sacrifice.'),
          note(
            'Household projects',
            'Each era brings a longer project: a picnic table, a treehouse, a family cookbook. Give it blocks of the week; when it is built it pays off every week after.'
          )
        ),
        h(
          'section',
          { class: 'controls-panel' },
          h('h3', null, 'Controls'),
          h(
            'div',
            { class: 'controls-grid' },
            col('keyboard', 'Keyboard and mouse', [
              ['Click', 'a task card or an object in the house to add it'],
              ['1–9, 0', 'add the numbered task · Backspace removes the last'],
              ['Enter / Space', 'live the week when all four slots are full'],
              ['1 / 2', 'answer a dilemma or milestone'],
              ['[ and ]', 'switch task category'],
              ['C · J · H', 'catalog · journal · this help'],
              ['Esc or P', 'menu (sound, graphics, new marriage)'],
              ['Drag · Q / E', 'turn the house · wheel or + / − to zoom · R resets'],
            ]),
            col('gamepad', 'Controller', [
              ['D-pad / left stick', 'move between buttons'],
              ['A', 'select · B goes back'],
              ['X', 'live the week'],
              ['Y · View', 'catalog · journal'],
              ['LT / RT', 'switch task category'],
              ['Right stick', 'turn the house and scroll'],
              ['LB / RB', 'zoom · right-stick click resets the view'],
              ['Start', 'menu'],
            ]),
            col('touch', 'Touch', [
              ['Tap', 'a task card or an object in the house to add it'],
              ['Tap a slot', 'remove that priority'],
              ['Drag the house', 'turn it · pinch to zoom'],
              ['Menu', 'top right: sound, graphics and a new marriage'],
            ])
          )
        ),
      ],
    };
  }

  pauseSpec(s) {
    const started = !!s?.started;
    const c = started ? chapterOf(s) : null;
    const item = (label, key, onClick, detail, disabled = false) =>
      h('button', { type: 'button', 'data-k': `menu-${key}`, disabled, onClick }, h('strong', null, label), detail ? h('small', null, detail) : null);
    const canCatalog = started && !s.pendingEvent && !s.pendingMilestone;
    return {
      kicker: 'Paused',
      title: 'Household menu',
      subtitle: started ? `${c.year} · ${c.title} · ${s.completed ? 'story complete' : `week ${s.week} of ${c.weeks}`}` : 'Homefront Hearts',
      closeLabel: 'Resume',
      body: [
        h(
          'div',
          { class: 'menu-list' },
          item('Resume', 'resume', () => this.close('pause'), this.hints.menu ? `${this.hints.menu} also closes this menu` : null),
          item('How to play and controls', 'help', () => this.open('help')),
          started ? item('Journal and memory box', 'journal', () => this.open('journal')) : null,
          started ? item('Household catalog', 'catalog', () => this.open('catalog'), canCatalog ? null : 'After the current decision', !canCatalog) : null,
          item(`Sound: ${this.sfx.enabled ? 'on' : 'off'}`, 'sound', () => {
            this.hooks.toggleSound();
            this.renderModals();
          }),
          item('Graphics and controls', 'graphics', () => this.hooks.openGraphics(), 'Quality, resolution, touch layout, vibration'),
          started ? item('Reset the view', 'view', () => {
            this.hooks.resetView();
            this.close('pause');
          }) : null,
          started ? item('Begin a new marriage', 'new', () => this.confirmNewGame(), 'Replaces the auto-save') : null
        ),
        h('p', { class: 'modal-footnote' }, 'Your household saves itself after every change.'),
      ],
    };
  }

  confirmSpec() {
    const o = this.confirmOpts;
    if (!o) return null;
    return {
      kicker: 'Please confirm',
      title: o.title,
      subtitle: o.body,
      body: [
        h(
          'div',
          { class: 'final-actions confirm-actions' },
          h('button', { type: 'button', class: 'secondary-button', 'data-k': 'confirm-cancel', onClick: () => this.close('confirm') }, 'Keep playing'),
          h(
            'button',
            {
              type: 'button',
              class: 'primary-button',
              'data-k': 'confirm-ok',
              onClick: () => {
                const run = o.onConfirm;
                this.close('confirm');
                run?.();
              },
            },
            o.confirmLabel || 'Confirm'
          )
        ),
      ],
    };
  }

  // ---------------------------------------------------------------- controller navigation

  /** Where controller and arrow-key navigation happens: the top dialog, the start card, or the game. */
  navRoot() {
    const top = this.topModal();
    if (top) return this.modalEls.get(top)?.card ?? null;
    if (!this.state?.started) return this.startEl.querySelector('.start-card');
    return this.app;
  }

  navDefault(root) {
    if (!root) return null;
    if (root === this.app) {
      return (
        this.sidebarEl.querySelector('.run-button:not([disabled])') ||
        this.sidebarEl.querySelector('.action-card:not([disabled])') ||
        this.sidebarEl.querySelector('.project-add:not([disabled])') ||
        this.sidebarEl.querySelector('.story-card button')
      );
    }
    if (root.classList.contains('start-card')) return root.querySelector('.start-button');
    return root.querySelector('.choice-card, .menu-list button, .confirm-actions .secondary-button, .final-actions .primary-button, .catalog-item button:not([disabled]), .modal-close');
  }
}
