/**
 * sim.js — the household simulation: pure functions over a plain state
 * object, and one reducer. No DOM, no three.js.
 *
 * Ported from the original bundle's reducer with the same numbers. Added:
 * household projects (a "project" plan slot builds the current project),
 * the pace setting (Balanced is the original), the appliance credit from the
 * salesman event, save sanitising, and the completion record.
 */

import {
  ACTIONS,
  ITEMS,
  CHAPTERS,
  EVENTS,
  PROJECTS,
  PROJECT_ACTION,
  PACES,
  LEGACIES,
  SAVE_VERSION,
  WELLBEING_KEYS,
} from './data.js';

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
export const PACE_BY_ID = Object.fromEntries(PACES.map((p) => [p.id, p]));
const LEGACY_BY_ID = Object.fromEntries(LEGACIES.map((l) => [l.id, l]));

export const MAX_SLOTS = 4;
export const MAX_REPEAT = 2;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const unique = (list) => [...new Set(list)];
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const add = (obj, key, v) => {
  obj[key] = (obj[key] ?? 0) + v;
};

/** Replace the default partner name in a text with the player's choice. */
export function withPartner(text, state) {
  if (text == null) return '';
  const name = String(state?.partnerName || 'Sam');
  return String(text).replace(/\bSam\b/g, name);
}

export function chapterOf(state) {
  return CHAPTERS[state.chapterIndex] ?? CHAPTERS[0];
}

export function yearOf(state) {
  return chapterOf(state).year;
}

export function childrenAtHome(state) {
  const year = yearOf(state);
  return state.household.children.filter((c) => year < c.moveOutYear);
}

export function peopleAtHome(state) {
  return 2 + childrenAtHome(state).length + (state.household.dependents ?? 0);
}

export function paceOf(state) {
  return PACE_BY_ID[state.difficulty] ?? PACE_BY_ID.balanced;
}

// ---------------------------------------------------------------- projects

export function projectProgress(state, id) {
  const p = PROJECT_BY_ID[id];
  if (!p) return 0;
  return clamp(Math.floor(Number(state.projects?.[id]) || 0), 0, p.steps);
}

export function projectDone(state, id) {
  const p = PROJECT_BY_ID[id];
  return !!p && projectProgress(state, id) >= p.steps;
}

/** The earliest unfinished project whose era has arrived, or null. */
export function currentProject(state) {
  return PROJECTS.find((p) => p.chapter <= state.chapterIndex && projectProgress(state, p.id) < p.steps) ?? null;
}

/** The next project that has not arrived yet. */
export function upcomingProject(state) {
  return PROJECTS.find((p) => p.chapter > state.chapterIndex && !projectDone(state, p.id)) ?? null;
}

export function finishedProjects(state) {
  return PROJECTS.filter((p) => projectDone(state, p.id));
}

/** How many more project blocks this week's plan can take. */
export function projectRoom(state) {
  const p = currentProject(state);
  if (!p) return 0;
  const planned = state.plan.filter((id) => id === 'project').length;
  const left = p.steps - projectProgress(state, p.id);
  return Math.max(0, Math.min(MAX_REPEAT, left) - planned);
}

/** Effect chips for a plain effects object (as the original cards show them). */
export function previewOf(effects, labels) {
  return Object.entries(effects)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2)
    .map(([k, v]) => ({ label: labels[k] ?? k, value: v }));
}

/**
 * What a plan id means for display: the action from the ledger, or the
 * current project dressed as an action.
 */
export function actionInfo(id, state) {
  if (id !== 'project') return ACTION_BY_ID[id] ?? null;
  const p = currentProject(state);
  if (!p) return { ...PROJECT_ACTION, preview: [] };
  return {
    ...PROJECT_ACTION,
    name: p.name,
    shortName: p.shortName,
    icon: p.icon,
    description: p.description,
    effects: p.stepEffects,
    project: p.id,
  };
}

// ---------------------------------------------------------------- availability

export function isActionAvailable(action, state) {
  if (!action) return false;
  if (action.id === 'project') return !!(state.started && !state.completed && currentProject(state));
  return !(
    !state.started ||
    state.completed ||
    (action.minChapter ?? 0) > state.chapterIndex ||
    (action.maxChapter ?? Number.POSITIVE_INFINITY) < state.chapterIndex ||
    (action.requires === 'childrenHome' && childrenAtHome(state).length === 0) ||
    (action.requires === 'dependent' && (state.household.dependents ?? 0) < 1) ||
    (action.requires === 'studyUnlocked' && !state.flags.studyUnlocked) ||
    (action.requires === 'organizeUnlocked' && !state.flags.organizeUnlocked)
  );
}

export function isAvailableId(id, state) {
  return isActionAvailable(id === 'project' ? PROJECT_ACTION : ACTION_BY_ID[id], state);
}

export function availableActions(state) {
  return ACTIONS.filter((a) => isActionAvailable(a, state));
}

export function catalogOnSale(state) {
  const year = yearOf(state);
  return ITEMS.filter((i) => i.year <= year && !state.household.owned.includes(i.id));
}

export function catalogLater(state) {
  const year = yearOf(state);
  return ITEMS.filter((i) => i.year > year && !state.household.owned.includes(i.id));
}

export function applianceCredit(state) {
  return Math.max(0, Math.floor(Number(state.flags?.applianceCredit) || 0));
}

export function itemPrice(item, state) {
  return Math.max(0, item.cost - applianceCredit(state));
}

// ---------------------------------------------------------------- effects

export function normalizeMetrics(metrics) {
  const m = { ...metrics };
  for (const key of WELLBEING_KEYS) m[key] = clamp(Number(m[key] ?? 0) || 0, 0, 100);
  m.mentalLoad = clamp(Number(m.mentalLoad ?? 0) || 0, 0, 100);
  m.wear = clamp(Number(m.wear ?? 0) || 0, 0, 100);
  m.money = clamp(Number(m.money ?? 0) || 0, -250, 999);
  return m;
}

export function applyMetricDelta(metrics, delta) {
  const m = { ...metrics };
  for (const [key, v] of Object.entries(delta ?? {})) {
    if (key in m && typeof v === 'number') m[key] = (m[key] ?? 0) + v;
  }
  return normalizeMetrics(m);
}

function addChildOnce(children, child) {
  return !child || children.some((c) => c.id === child.id) ? children : [...children, child];
}

/** Remove the first room of the list that the house has (downsizing releases one extension). */
function removeFirstRoom(rooms, list) {
  for (const r of asList(list)) if (rooms.includes(r)) return rooms.filter((x) => x !== r);
  return rooms;
}

/** Apply a choice's effects: metrics, rooms, objects, family, flags and support. */
export function applyEffects(state, effects = {}) {
  const metrics = applyMetricDelta(state.metrics, effects);
  let rooms = [...state.household.rooms];
  let owned = [...state.household.owned];
  let children = [...state.household.children];
  let flags = { ...state.flags };
  for (const r of asList(effects.addRoom)) rooms.push(r);
  rooms = unique(rooms);
  if (effects.removeRoom) rooms = removeFirstRoom(rooms, effects.removeRoom);
  for (const o of asList(effects.addOwned)) owned.push(o);
  owned = unique(owned);
  if (effects.addChild) children = addChildOnce(children, effects.addChild);
  if (effects.setFlag) flags = { ...flags, ...effects.setFlag };
  if (effects.applianceCredit) flags.applianceCredit = applianceCredit({ flags }) + effects.applianceCredit;
  const h = state.household;
  return {
    ...state,
    metrics,
    flags,
    household: {
      ...h,
      rooms,
      owned,
      children,
      friends: Math.max(0, (h.friends ?? 0) + (effects.friends ?? 0)),
      dependents: Math.max(0, (h.dependents ?? 0) + (effects.dependents ?? 0)),
      grandchildren: Math.max(0, (h.grandchildren ?? 0) + (effects.grandchildren ?? 0)),
      partnerShare: clamp((h.partnerShare ?? 0.18) + (effects.partnerShare ?? 0), 0.08, 0.72),
    },
  };
}

/** One planned block: the action's effects, improved by owned objects and finished projects. */
export function actionEffects(id, state) {
  if (id === 'project') {
    const p = currentProject(state);
    return p ? { ...p.stepEffects } : {};
  }
  const action = ACTION_BY_ID[id];
  if (!action) return {};
  const n = { ...action.effects };
  const owns = new Set(state.household.owned);
  const done = (pid) => projectDone(state, pid);
  // Appliances (original rules).
  if (id === 'cook' && owns.has('pressureCooker')) {
    add(n, 'energy', 2);
    add(n, 'meals', 3);
  }
  if (id === 'cook' && owns.has('refrigerator')) add(n, 'meals', 3);
  if (id === 'cook' && owns.has('microwave')) add(n, 'energy', 4);
  if (id === 'laundry' && owns.has('washer')) add(n, 'energy', 6);
  if (id === 'laundry' && owns.has('sewingMachine')) {
    add(n, 'order', 4);
    add(n, 'money', 2);
  }
  if (id === 'tidy' && owns.has('dishwasher')) add(n, 'energy', 4);
  if (id === 'repair' && owns.has('toolKit')) add(n, 'wear', -8);
  if (id === 'shop' && owns.has('stationWagon')) add(n, 'energy', 5);
  if (id === 'host' && owns.has('stationWagon')) add(n, 'energy', 2);
  if (id === 'connect' && owns.has('television')) add(n, 'family', 3);
  if (id === 'host' && owns.has('television')) add(n, 'community', 3);
  if (id === 'budget' && owns.has('homeComputer')) {
    add(n, 'money', 5);
    add(n, 'mentalLoad', -3);
  }
  if (id === 'reminisce' && owns.has('camcorder')) add(n, 'family', 5);
  if (id === 'rest' && owns.has('gardenBench')) add(n, 'wellbeing', 4);
  if (id === 'host' && owns.has('gardenBench')) add(n, 'community', 2);
  if (id === 'reminisce' && owns.has('photoScanner')) add(n, 'partnership', 4);
  // Finished projects.
  if (id === 'host' && done('picnicTable')) add(n, 'community', 4);
  if (id === 'connect' && done('picnicTable')) add(n, 'family', 2);
  if (id === 'childcare' && done('swingSet')) {
    add(n, 'energy', 3);
    add(n, 'family', 2);
  }
  if ((id === 'homework' || id === 'childcare') && done('treehouse')) add(n, 'family', 3);
  if (id === 'cook' && done('cookbook')) {
    add(n, 'meals', 3);
    add(n, 'mentalLoad', -2);
  }
  if (id === 'shop' && done('cookbook')) add(n, 'money', 2);
  if (id === 'askHelp' && done('messageBoard')) add(n, 'partnership', 3);
  if (id === 'garden' && done('orchard')) add(n, 'wellbeing', 4);
  if (id === 'reminisce' && done('memoryQuilt')) add(n, 'family', 4);
  if (id === 'rest' && done('memoryQuilt')) add(n, 'wellbeing', 3);
  return n;
}

/** What the house itself costs and gives every week. */
export function weeklyUpkeep(state) {
  const chapter = chapterOf(state);
  const pace = paceOf(state);
  const people = peopleAtHome(state);
  const extraRooms = Math.max(0, state.household.rooms.length - 3);
  const share = (state.household.partnerShare ?? 0.18) * 20;
  const owns = new Set(state.household.owned);
  const d = {
    money: chapter.income + pace.income - chapter.fixedCosts - Math.max(0, people - 2) * 2 - (state.household.dependents ?? 0) * 3,
    energy: chapter.restGain + pace.rest + share * 0.12 - Math.max(0, people - 2) * 0.8,
    order: -chapter.orderDemand * pace.demand - extraRooms * 1.25 + share * 0.35,
    meals: -chapter.mealDemand * pace.demand - Math.max(0, people - 2) * 0.6 + share * 0.22,
    family: -2,
    partnership: -1,
    wellbeing: 0,
    community: -1,
    mentalLoad: chapter.loadDemand * pace.demand + extraRooms * 0.7 - share * 0.52,
    wear: chapter.wearDemand * pace.demand + extraRooms * 0.45,
  };
  if (owns.has('refrigerator')) d.meals += 4;
  if (owns.has('freezer')) d.meals += 4;
  if (owns.has('dishwasher')) d.order += 2;
  if (owns.has('homeComputer')) d.mentalLoad -= 2;
  if (owns.has('stationWagon')) d.community += 1;
  if (projectDone(state, 'treehouse')) d.order += 1;
  if (projectDone(state, 'messageBoard')) d.mentalLoad -= 2;
  if (projectDone(state, 'orchard')) d.meals += 3;
  return d;
}

/** Knock-on effects of how the week ended. */
export function thresholdEffects(m) {
  const t = {};
  if (m.meals < 35) {
    add(t, 'family', -6);
    add(t, 'wellbeing', -3);
  }
  if (m.order < 30) {
    add(t, 'mentalLoad', 6);
    add(t, 'family', -2);
  }
  if (m.energy < 30) {
    add(t, 'wellbeing', -6);
    add(t, 'partnership', -2);
  }
  if (m.mentalLoad > 70) {
    add(t, 'wellbeing', -7);
    add(t, 'energy', -4);
  }
  if (m.partnership > 72) {
    add(t, 'energy', 3);
    add(t, 'mentalLoad', -3);
  }
  if (m.family > 78) add(t, 'wellbeing', 3);
  if (m.money < 0) {
    add(t, 'mentalLoad', 8);
    add(t, 'partnership', -4);
  }
  if (m.wear > 70) {
    add(t, 'order', -6);
    add(t, 'money', -8);
  }
  return t;
}

export function metricDelta(before, after) {
  const d = {};
  for (const k of Object.keys(before)) d[k] = Math.round((after[k] - before[k]) * 10) / 10;
  return d;
}

/** The week's interruption: unseen events of this era first, chosen by a fixed rule. */
export function pickEvent(state) {
  const pool = EVENTS.filter((e) => e.minChapter <= state.chapterIndex && e.maxChapter >= state.chapterIndex);
  const fresh = pool.filter((e) => !state.eventHistory.includes(e.id));
  const list = fresh.length ? fresh : pool;
  const seed = state.chapterIndex * 41 + state.week * 17 + state.history.length * 7 + state.household.owned.length * 3;
  return list[Math.abs(seed) % list.length];
}

/** Live the planned week: priorities, upkeep, knock-on effects, project work, then an interruption. */
export function runWeek(state) {
  if (state.plan.length !== MAX_SLOTS || state.pendingEvent || state.pendingMilestone || state.completed) return state;
  const before = { ...state.metrics };
  let metrics = { ...state.metrics };
  const names = [];
  for (const id of state.plan) {
    metrics = applyMetricDelta(metrics, actionEffects(id, state));
    const info = actionInfo(id, state);
    if (info) names.push(info.shortName);
  }
  metrics = applyMetricDelta(metrics, weeklyUpkeep({ ...state, metrics }));
  metrics = applyMetricDelta(metrics, thresholdEffects(metrics));

  let projects = state.projects;
  let finished = null;
  const blocks = state.plan.filter((id) => id === 'project').length;
  const project = currentProject(state);
  if (blocks && project) {
    const was = projectProgress(state, project.id);
    const now = Math.min(project.steps, was + blocks);
    projects = { ...state.projects, [project.id]: now };
    if (now >= project.steps && was < project.steps) {
      metrics = applyMetricDelta(metrics, project.reward);
      finished = project;
    }
  }

  const event = pickEvent(state);
  const chapter = chapterOf(state);
  const history = [
    {
      id: `week-${state.chapterIndex}-${state.week}-${state.history.length}`,
      year: chapter.year,
      title: `Week ${state.week}`,
      body: `In ${chapter.title}, you focused on ${names.join(', ')}.`,
    },
    ...state.history,
  ];
  let memories = state.memories;
  if (finished) {
    const memory = withPartner(finished.memory, state);
    history.unshift({ id: `project-${finished.id}`, year: chapter.year, title: `Finished: ${finished.shortName}`, body: memory });
    memories = [memory, ...memories].slice(0, 30);
  }
  return {
    ...state,
    metrics,
    plan: [],
    projects,
    pendingEvent: event.id,
    lastWeekDelta: metricDelta(before, metrics),
    lastProject: finished ? finished.id : null,
    eventHistory: [...state.eventHistory, event.id],
    history: history.slice(0, 60),
    memories,
    notice: finished ? `${finished.name}: finished!` : null,
  };
}

/** Move into a new era: the family and house change on their own, then a fresh start bonus. */
export function enterChapter(state, index) {
  let s = { ...state, chapterIndex: index, week: 1, pendingMilestone: false, pendingEvent: null };
  if (index === 2 && !s.household.rooms.includes('kidsRoom')) s = applyEffects(s, { addRoom: 'kidsRoom', family: 4 });
  if (index === 4 && (s.household.dependents ?? 0) === 0) s = applyEffects(s, { dependents: 1, family: 3, mentalLoad: 7 });
  if (index === 5) {
    s = applyEffects(s, { dependents: -(s.household.dependents ?? 0), grandchildren: 1, family: 6, mentalLoad: -8 });
  }
  if (index === 6 && (s.household.grandchildren ?? 0) < 2) s = applyEffects(s, { grandchildren: 1, family: 5 });
  return applyEffects(s, { energy: 10, wellbeing: 6, family: 4, mentalLoad: -5 });
}

export function eraScore(m) {
  const t =
    m.family * 0.22 + m.partnership * 0.2 + m.wellbeing * 0.18 + m.energy * 0.1 + m.order * 0.1 + m.meals * 0.1 + m.community * 0.1;
  return Math.round(clamp(t - m.mentalLoad * 0.1 - m.wear * 0.04, 0, 100));
}

function eraSummary(state) {
  const c = chapterOf(state);
  return { id: c.id, year: c.year, title: c.title, score: eraScore(state.metrics), metrics: { ...state.metrics } };
}

/** The final life-balance score. */
export function finalScore(state) {
  const scores = state.eraSummaries.length ? state.eraSummaries.map((e) => e.score) : [eraScore(state.metrics)];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const now = eraScore(state.metrics);
  const savings = clamp(Math.max(0, state.metrics.money) / 60, 0, 7);
  return Math.round(clamp(avg * 0.58 + now * 0.42 + savings, 0, 100));
}

/** The strongest of the five legacies. */
export function legacyOf(state) {
  const m = state.metrics;
  const ranked = [
    { id: 'partnership', value: m.partnership },
    { id: 'community', value: m.community },
    { id: 'family', value: m.family },
    { id: 'wellbeing', value: m.wellbeing },
    { id: 'steady', value: m.order + m.meals > 140 ? 88 : 0 },
  ].sort((a, b) => b.value - a.value);
  return LEGACY_BY_ID[ranked[0].id];
}

export function hardestEra(state) {
  return state.eraSummaries.length ? [...state.eraSummaries].sort((a, b) => a.score - b.score)[0] : null;
}

// ---------------------------------------------------------------- state

export function createGame(opts = {}) {
  const name = (v, fallback) => String(v || fallback).trim().slice(0, 24) || fallback;
  return {
    version: SAVE_VERSION,
    started: !!opts.started,
    completed: false,
    playerName: name(opts.playerName, 'Evelyn'),
    partnerName: name(opts.partnerName, 'Sam'),
    familyName: name(opts.familyName, 'Hart'),
    difficulty: PACE_BY_ID[opts.difficulty] ? opts.difficulty : 'balanced',
    chapterIndex: 0,
    week: 1,
    plan: [],
    metrics: {
      money: 128,
      energy: 76,
      order: 64,
      meals: 68,
      family: 72,
      partnership: 66,
      wellbeing: 63,
      community: 43,
      mentalLoad: 34,
      wear: 12,
    },
    household: {
      rooms: ['kitchen', 'living', 'bedroom'],
      owned: ['radio', 'stove', 'sofa', 'bed', 'table'],
      children: [],
      dependents: 0,
      grandchildren: 0,
      friends: 2,
      partnerShare: 0.18,
    },
    flags: {},
    projects: {},
    pendingEvent: null,
    pendingMilestone: false,
    lastWeekDelta: {},
    lastProject: null,
    eventHistory: [],
    eraSummaries: [],
    memories: [],
    history: [],
    recorded: null,
    notice: null,
  };
}

const isRecord = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Turn anything read from storage into a valid game, or null. Saves from the original build load too. */
export function normalizeSave(raw) {
  if (!isRecord(raw) || raw.version !== SAVE_VERSION) return null;
  const base = createGame({
    started: true,
    playerName: raw.playerName,
    partnerName: raw.partnerName,
    familyName: raw.familyName,
    difficulty: raw.difficulty,
  });
  const chapterIndex = clamp(Math.floor(num(raw.chapterIndex, 0)), 0, CHAPTERS.length - 1);
  const weeks = CHAPTERS[chapterIndex].weeks;
  const h = isRecord(raw.household) ? raw.household : {};
  const children = Array.isArray(h.children)
    ? h.children.filter((c) => isRecord(c) && c.id && Number.isFinite(Number(c.moveOutYear)))
    : [];
  const projects = {};
  if (isRecord(raw.projects)) {
    for (const p of PROJECTS) {
      const v = Math.floor(num(raw.projects[p.id], 0));
      if (v > 0) projects[p.id] = clamp(v, 0, p.steps);
    }
  }
  const state = {
    ...base,
    ...raw,
    started: raw.started !== false,
    completed: !!raw.completed,
    playerName: base.playerName,
    partnerName: base.partnerName,
    familyName: base.familyName,
    difficulty: base.difficulty,
    chapterIndex,
    week: clamp(Math.floor(num(raw.week, 1)), 1, weeks),
    metrics: normalizeMetrics({ ...base.metrics, ...(isRecord(raw.metrics) ? raw.metrics : {}) }),
    household: {
      ...base.household,
      ...h,
      rooms: unique(Array.isArray(h.rooms) ? h.rooms : base.household.rooms),
      owned: unique(Array.isArray(h.owned) ? h.owned : base.household.owned),
      children,
      friends: Math.max(0, num(h.friends, base.household.friends)),
      dependents: Math.max(0, num(h.dependents, 0)),
      grandchildren: Math.max(0, num(h.grandchildren, 0)),
      partnerShare: clamp(num(h.partnerShare, 0.18), 0.08, 0.72),
    },
    flags: isRecord(raw.flags) ? { ...raw.flags } : {},
    projects,
    plan: Array.isArray(raw.plan) ? raw.plan.filter((id) => ACTION_BY_ID[id] || id === 'project').slice(0, MAX_SLOTS) : [],
    eventHistory: Array.isArray(raw.eventHistory) ? raw.eventHistory : [],
    memories: Array.isArray(raw.memories) ? raw.memories.filter((m) => typeof m === 'string') : [],
    history: Array.isArray(raw.history) ? raw.history.filter(isRecord) : [],
    eraSummaries: Array.isArray(raw.eraSummaries) ? raw.eraSummaries.filter(isRecord) : [],
    lastWeekDelta: isRecord(raw.lastWeekDelta) ? raw.lastWeekDelta : {},
    // A save that points at an event this build does not know would open an empty dialog.
    pendingEvent: EVENT_BY_ID[raw.pendingEvent] ? raw.pendingEvent : null,
    pendingMilestone: !!raw.pendingMilestone && !raw.completed,
    recorded: isRecord(raw.recorded) ? raw.recorded : null,
    lastProject: null,
    notice: null,
  };
  // A queued project block from an older save with no project left is dropped.
  if (!currentProject(state)) state.plan = state.plan.filter((id) => id !== 'project');
  return state;
}

/** The single state transition. Returns the same object when nothing changes. */
export function reduce(state, action) {
  switch (action.type) {
    case 'START':
      return createGame({ ...action.payload, started: true });
    case 'LOAD':
      return normalizeSave(action.payload) ?? state;
    case 'ADD_ACTION': {
      const id = action.actionId;
      if (id === 'project') {
        const p = currentProject(state);
        if (!p || !state.started || state.completed) return { ...state, notice: 'There is no household project to work on right now.' };
        if (state.pendingEvent || state.pendingMilestone) return state;
        if (state.plan.length >= MAX_SLOTS) return { ...state, notice: 'The week already has four priorities.' };
        if (projectRoom(state) <= 0) {
          const planned = state.plan.filter((x) => x === 'project').length;
          const left = p.steps - projectProgress(state, p.id);
          return {
            ...state,
            notice:
              planned >= left
                ? `The ${p.shortName.toLowerCase()} needs only ${left} more block${left === 1 ? '' : 's'}.`
                : 'Use no more than two slots for the same priority.',
          };
        }
        return { ...state, plan: [...state.plan, 'project'], notice: `${p.shortName} added to the week.` };
      }
      const a = ACTION_BY_ID[id];
      if (!a || !isActionAvailable(a, state)) {
        return state.completed ? state : { ...state, notice: 'That task is not available in this era.' };
      }
      if (state.pendingEvent || state.pendingMilestone || state.completed) return state;
      if (state.plan.length >= MAX_SLOTS) return { ...state, notice: 'The week already has four priorities.' };
      if (state.plan.filter((x) => x === id).length >= MAX_REPEAT) {
        return { ...state, notice: 'Use no more than two slots for the same priority.' };
      }
      return { ...state, plan: [...state.plan, id], notice: `${a.shortName} added to the week.` };
    }
    case 'REMOVE_ACTION':
      if (action.index < 0 || action.index >= state.plan.length) return state;
      return { ...state, plan: state.plan.filter((_, i) => i !== action.index), notice: null };
    case 'CLEAR_PLAN':
      return state.plan.length ? { ...state, plan: [], notice: null } : state;
    case 'RUN_WEEK':
      if (state.pendingEvent || state.pendingMilestone || state.completed) return state;
      return state.plan.length !== MAX_SLOTS ? { ...state, notice: 'Fill all four weekly focus slots first.' } : runWeek(state);
    case 'CHOOSE_EVENT': {
      const event = EVENT_BY_ID[state.pendingEvent];
      const choice = event?.choices?.[action.choiceIndex];
      if (!event || !choice) return state;
      let s = applyEffects(state, choice.effects);
      const memory = choice.memory ? withPartner(choice.memory, state) : '';
      s = {
        ...s,
        pendingEvent: null,
        memories: memory ? [memory, ...s.memories].slice(0, 30) : s.memories,
        history: [
          {
            id: `event-${event.id}-${s.history.length}`,
            year: yearOf(s),
            title: withPartner(event.title, state),
            body: memory || withPartner(choice.detail, state),
          },
          ...s.history,
        ].slice(0, 60),
      };
      return state.week >= chapterOf(state).weeks
        ? { ...s, pendingMilestone: true, notice: null }
        : { ...s, week: state.week + 1, notice: null };
    }
    case 'CHOOSE_MILESTONE': {
      const chapter = chapterOf(state);
      const choice = chapter.milestone.choices[action.choiceIndex];
      if (!state.pendingMilestone || !choice) return state;
      let s = applyEffects(state, choice.effects);
      const memory = choice.memory ? withPartner(choice.memory, state) : '';
      s = {
        ...s,
        pendingMilestone: false,
        memories: memory ? [memory, ...s.memories].slice(0, 30) : s.memories,
        eraSummaries: [...s.eraSummaries, eraSummary(s)],
        history: [
          { id: `milestone-${chapter.id}`, year: chapter.year, title: withPartner(chapter.milestone.title, state), body: memory },
          ...s.history,
        ].slice(0, 60),
      };
      return state.chapterIndex >= CHAPTERS.length - 1
        ? { ...s, completed: true, plan: [], notice: null }
        : enterChapter(s, state.chapterIndex + 1);
    }
    case 'BUY_ITEM': {
      const item = ITEM_BY_ID[action.itemId];
      if (!item || state.household.owned.includes(item.id) || !state.started) return state;
      if (item.year > yearOf(state)) return { ...state, notice: `The ${item.name} is not on the market yet.` };
      const price = itemPrice(item, state);
      if (state.metrics.money < price) {
        return { ...state, notice: `You need ${price - Math.floor(state.metrics.money)} more funds.` };
      }
      const credit = applianceCredit(state);
      let s = applyEffects(state, { money: -price, addOwned: item.id, wellbeing: 2 });
      if (credit) s = { ...s, flags: { ...s.flags, applianceCredit: 0 } };
      return {
        ...s,
        memories: [
          `The ${item.name.toLowerCase()} arrived and immediately changed the shape of one household task.`,
          ...s.memories,
        ].slice(0, 30),
        notice: credit ? `${item.name} added to the house (your $${Math.min(credit, item.cost)} credit helped).` : `${item.name} added to the house.`,
      };
    }
    case 'MARK_RECORDED':
      return { ...state, recorded: action.record ?? { at: Date.now() } };
    case 'DISMISS_NOTICE':
      return state.notice ? { ...state, notice: null } : state;
    case 'RESET':
      return createGame();
    default:
      return state;
  }
}
