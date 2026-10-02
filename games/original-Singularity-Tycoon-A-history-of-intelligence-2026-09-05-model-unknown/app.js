import { boot } from "kit/boot.js";
import { MOUSE_LOOK } from "kit/input.js";
import { ERAS, TECHS, TECH, BUILDINGS, CONDUITS, PRODUCTS, CANDIDATES, PATHS, FOUNDATIONS, DIFFICULTIES, SCENARIOS } from "./content.js";
import {
  newGame,
  eraFor,
  derive,
  formatDate,
  researchRequirements,
  researchRate,
  startResearch,
  build,
  conduit,
  demolish,
  hire,
  fire,
  launchProduct,
  retireProduct,
  acquireData,
  applyGrant,
  safetyAudit,
  tick,
  chooseEvent,
  score,
  learn,
  scalingLoss,
  optimalAllocation,
  startTraining,
  saveLocal,
  loadLocal,
  validateSave,
  SAVE_KEY,
} from "./simulation.js";
import { icon, logo, buildingIcon } from "./icons.js";
import { LabWorld } from "./world.js";
import { LESSONS, lessonMarkup, LessonEngine } from "./lessons.js";
import { sound } from "./audio.js";

const $ = (q) => document.querySelector(q),
  $$ = (q) => [...document.querySelectorAll(q)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const compact = (n, d = 1) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: d }).format(n);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const delta = (n) => (n >= 0 ? "+" : "−") + "$" + compact(Math.abs(n));
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
/** One in-game month lasts this many seconds at 1× speed. */
const MONTH_SECONDS = 5;

/* ---------------------------------------------------------------- the saved laboratory */
let state,
  hadSave = false,
  saveProblem = false;
try {
  const loaded = loadLocal();
  if (loaded) {
    state = loaded;
    hadSave = loaded.elapsed > 0 || loaded.logs.length > 1 || !!loaded.gameOver || loaded.completed;
  }
} catch {
  // Keep an unreadable save instead of silently overwriting it with the next autosave.
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      localStorage.setItem(SAVE_KEY + "-unreadable", raw);
      saveProblem = true;
    }
  } catch {
    /* storage unavailable */
  }
}
state ??= newGame();

let page = "lab",
  mode = null,
  layer = null,
  conduitErase = false,
  rotation = 0,
  drawer = null,
  selected = null,
  modal = null,
  lesson = null,
  world = null,
  kit = null,
  previousFocus = null,
  modalPause = false,
  accumulator = 0,
  saveClock = 0,
  eventShown = null,
  endShown = false,
  searchTerm = "",
  codexAll = false,
  pendingDifficulty = state.difficulty || "standard",
  padCursor = null,
  press = null,
  promptSource = null,
  lastPointer = { x: -1, y: -1 };
let scaleN = 9,
  scaleD = 10.3;

function toast(message, error = false) {
  const e = document.createElement("div");
  e.className = "toast" + (error ? " error" : "");
  e.innerHTML = icon(error ? "info" : "check", 16) + `<span>${esc(message)}</span>`;
  $("#toasts").append(e);
  setTimeout(() => e.remove(), 4200);
  while ($("#toasts").children.length > 3) $("#toasts").firstChild.remove();
}
function result(r, cue = "click") {
  toast(r.message, !r.ok);
  if (r.ok) {
    sound.play(cue);
    render();
  } else sound.play("error");
  return r;
}

/* ---------------------------------------------------------------- DOM updates
   Panels are morphed in place instead of rewritten every month, so a click that
   lands while time runs, keyboard and controller focus, and slider drags survive. */
function sameNode(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return (
    a.tagName === b.tagName &&
    a.id === b.id &&
    a.getAttribute("data-action") === b.getAttribute("data-action") &&
    a.getAttribute("data-id") === b.getAttribute("data-id") &&
    a.getAttribute("type") === b.getAttribute("type")
  );
}
function syncAttrs(a, b) {
  const ring = a.classList?.contains("pad-focus");
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of b.attributes) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  if (ring) a.classList.add("pad-focus");
  if (a.tagName === "INPUT" && a !== document.activeElement) {
    if (a.type === "checkbox" || a.type === "radio") a.checked = b.hasAttribute("checked");
    else if (a.value !== (b.getAttribute("value") ?? "")) a.value = b.getAttribute("value") ?? "";
  }
}
function morphChildren(to, from) {
  let cur = to.firstChild;
  for (const n of [...from.childNodes]) {
    if (!cur) {
      to.appendChild(n);
      continue;
    }
    if (sameNode(cur, n)) {
      if (cur.nodeType === 1) {
        syncAttrs(cur, n);
        morphChildren(cur, n);
      } else if (cur.nodeValue !== n.nodeValue) cur.nodeValue = n.nodeValue;
      cur = cur.nextSibling;
    } else {
      to.replaceChild(n, cur);
      cur = n.nextSibling;
    }
  }
  while (cur) {
    const next = cur.nextSibling;
    to.removeChild(cur);
    cur = next;
  }
}
function paint(el, html) {
  if (!el || el.__html === html) return;
  el.__html = html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  morphChildren(el, tpl.content);
}
function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

/* ---------------------------------------------------------------- records of finished chapters */
const RECORDS_KEY = "singularity-tycoon-records-v1";
function readRecords() {
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY) || "{}");
    return r && typeof r === "object" ? { best: r.best || {}, chapters: Array.isArray(r.chapters) ? r.chapters : [] } : { best: {}, chapters: [] };
  } catch {
    return { best: {}, chapters: [] };
  }
}
function recordChapter(sc, d) {
  const rec = readRecords();
  const entry = {
    progress: Math.floor(sc.progress),
    won: !!sc.won,
    date: formatDate(state),
    discoveries: state.discovered,
    valuation: Math.round(d.valuation),
    difficulty: state.difficulty || "standard",
    outcome: state.gameOver ? "closed" : "completed",
  };
  const prev = rec.best[state.path];
  const improved = !prev || entry.progress > prev.progress;
  if (improved) rec.best[state.path] = entry;
  rec.chapters.unshift({ ...entry, path: state.path });
  rec.chapters = rec.chapters.slice(0, 8);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch {
    /* records are a nicety */
  }
  return { best: rec.best[state.path], improved: improved && !!prev };
}
function recordsMarkup() {
  const rec = readRecords();
  if (!rec.chapters.length) return "";
  return `<div class="records"><span class="eyebrow">PAST CHAPTERS</span>${rec.chapters
    .slice(0, 4)
    .map((c) => {
      const p = PATHS.find((p) => p.id === c.path);
      return `<div class="ledger-line"><span>${esc(c.date)} · ${esc(p?.name || c.path)}${c.outcome === "closed" ? " · lab closed" : ""}</span><strong>${Math.round(Number(c.progress) || 0)}%${c.won ? " · achieved" : ""}</strong></div>`;
    })
    .join("")}</div>`;
}

/* ---------------------------------------------------------------- the page */
const sketch = () =>
  `<svg viewBox="0 0 220 100" fill="none"><path d="M27 79H196M40 87V20" stroke="#d5ddc9" stroke-width=".8"/><path d="m76 80 75-58" stroke="#879e74" stroke-width="1.4"/><path d="m48 77 95-63" stroke="#b5c3a6" stroke-dasharray="2 4" stroke-width=".6"/>${[
    [68, 34],
    [91, 36],
    [78, 48],
    [109, 22],
    [51, 49],
    [89, 18],
    [111, 41],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.8" fill="#8ba178"/>`)
    .join("")}${[
    [119, 70],
    [149, 58],
    [162, 76],
    [151, 43],
    [135, 81],
    [176, 63],
    [121, 53],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.8" fill="#c6a077"/>`)
    .join("")}<text x="168" y="28" fill="#a5b195" font-size="7" font-family="Georgia" font-style="italic">w·x + b = 0</text></svg>`;
function shell() {
  $("#app").innerHTML =
    `<header class="topbar"><div class="brand">${logo()}<div><strong>SINGULARITY<br>TYCOON</strong><small>A HISTORY OF INTELLIGENCE</small></div></div><div class="lab-heading"><div><div class="lab-title">Dartmouth Research Lab</div><div class="lab-sub">Independent minds. An open question.</div></div><span class="badge">EST. 1956</span></div><div class="top-actions"><span class="reputation" title="Public trust, not a scientific assessment">${icon("star", 16)}<span id="top-reputation"></span></span><button class="btn small" data-action="save" title="Save laboratory (S)">${icon("save", 14)}<span class="save-label">Save lab</span></button><button class="icon-btn" data-action="settings" title="Laboratory menu (M)" aria-label="Laboratory menu">${icon("settings", 17)}</button><button class="icon-btn" data-action="help" title="How to play" aria-label="How to play">${icon("info", 17)}</button></div></header>
 <div class="workspace"><aside class="sidebar"><span class="eyebrow">YOUR LABORATORY</span><nav class="navigation" aria-label="Laboratory management">${[
   ["lab", "lab", "The laboratory"],
   ["research", "tree", "Research tree"],
   ["people", "people", "People"],
   ["products", "box", "Products"],
   ["data", "database", "Data pipeline"],
   ["codex", "book", "AI encyclopedia"],
 ]
   .map(
     ([id, i, label]) =>
       `<button class="nav-item ${id === "lab" ? "active" : ""}" data-action="navigate" data-id="${id}" title="${label}">${icon(i)}<span>${label}</span>${id === "codex" ? '<small class="nav-count" id="codex-count"></small>' : ""}</button>`,
   )
   .join("")}<div class="sidebar-divider"></div>${[
   ["strategy", "shield", "Lab strategy"],
   ["journal", "clock", "Lab journal"],
 ]
   .map(([id, i, label]) => `<button class="nav-item" data-action="navigate" data-id="${id}" title="${label}">${icon(i)}<span>${label}</span></button>`)
   .join(
     "",
   )}</nav><div class="sidebar-bottom"><button class="path-card" data-action="paths" id="path-card"></button><div class="sidebar-footer"><span><i class="live-dot"></i>HISTORICAL CAMPAIGN</span><span>v0.2</span></div></div></aside>
 <section class="metrics" id="metrics" aria-label="Laboratory resources"></section>
 <main class="stage"><div id="world-host" class="world-host"><div id="kit-mount" class="kit-mount"></div></div><div class="stage-heading"><span class="eyebrow" id="stage-era"></span><h1 id="stage-title">A room for possibility.</h1><p id="stage-subtitle">The future is a hypothesis. Start with a neuron.</p></div><button class="stage-badge" data-action="navigate" data-id="strategy" id="lab-status"></button><div class="view-tools"><button class="icon-btn" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">${icon("plus", 15)}</button><button class="icon-btn" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">${icon("minus", 15)}</button><button class="icon-btn" data-action="reset-view" aria-label="Reset camera" title="Reset view">${icon("expand", 14)}</button></div><div class="engine-status" id="engine-status"></div><div class="world-controls-caption" id="camera-caption"></div><div id="build-drawer"></div><div id="selection"></div><div class="build-dock" id="build-dock"></div></main>
 <aside class="inspector" id="inspector"></aside><footer class="timeline" id="timeline"></footer></div><section id="page-panel" class="page-panel hidden" aria-label="Management panel"></section><div id="modal-root"></div><div class="toast-container" id="toasts" aria-live="polite"></div><input type="file" id="import-file" accept="application/json,.json" hidden>`;
}
function renderHUD(d) {
  const r = state.resources;
  setText($("#top-reputation"), Math.round(r.reputation) + " reputation");
  setText($("#codex-count"), String(state.techTreeUnlocked.length));
  paint(
    $("#metrics"),
    [
      ["coin", "CAPITAL", money(r.capital), delta(d.net) + " / month", d.net < 0],
      ["chip", "COMPUTE", d.compute.toFixed(1) + "<em>CU</em>", compact(d.flops) + " FLOP/s · illustrative", false],
      ["database", "DATASET", compact(r.data) + "<em>examples</em>", Math.round(r.quality) + "% quality · " + Math.round(r.bias) + " bias", r.quality < 55],
      ["people", "RESEARCHERS", state.talent.length + "<em>/ " + d.desks + " desks</em>", Math.round(d.morale) + "% team morale", d.morale < 50],
    ]
      .map(
        ([i, label, value, sub, neg]) =>
          `<div class="metric" title="${label === "COMPUTE" ? "Research uses normalized compute units (CU); FLOP/s values are illustrative, not historical hardware benchmarks." : label === "DATASET" ? "Examples are reusable. Effective examples = count × quality. Bias is a fictional index." : ""}"><div class="metric-icon">${icon(i, 20)}</div><div><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-sub ${neg ? "negative" : ""}">${sub}</div></div></div>`,
      )
      .join(""),
  );
  const era = eraFor(state.year);
  setText($("#stage-era"), `ERA ${String(era.id).padStart(2, "0")} / ${era.name.toUpperCase()} · ${era.start}–${era.end - 1}`);
  setText(
    $("#stage-title"),
    era.id === 1
      ? "A room for possibility."
      : era.id === 2 || era.id === 4
        ? "Keep the lights on."
        : era.id === 3
          ? "Knowledge becomes useful."
          : era.id === 5
            ? "Patterns in the noise."
            : "Intelligence, at scale.",
  );
  setText(
    $("#stage-subtitle"),
    era.id === 1
      ? "The future is a hypothesis. Start with a neuron."
      : era.id === 2 || era.id === 4
        ? "Protect the runway. The ideas are still worth pursuing."
        : era.id === 3
          ? "A thousand rules. A million possibilities."
          : era.id === 5
            ? "Better data. Better questions. Better experiments."
            : "More compute is a beginning, not an answer.",
  );
  paint(
    $("#lab-status"),
    `<i class="live-dot"></i>${d.offline ? "Utility attention needed" : state.paused ? "Laboratory paused" : "Laboratory operational"}`,
  );
  const p = PATHS.find((p) => p.id === state.path),
    sc = score(state);
  paint(
    $("#path-card"),
    `<div class="path-icon">${icon(p.icon, 18)}</div><small>YOUR CHOSEN HORIZON</small><strong>${p.name}${icon("arrow", 14)}</strong><p>${state.path === "academic" ? "Build a legacy of shared discovery." : p.desc}</p><div class="progress-track" style="margin-top:13px"><i style="width:${sc.progress}%"></i></div>`,
  );
  renderTimeline();
  renderInspector(d);
}
function renderInspector(d) {
  let focus = state.research
    ? TECH[state.research.id]
    : !state.techTreeUnlocked.includes("perceptron")
      ? TECH.perceptron
      : TECHS.find((t) => !state.techTreeUnlocked.includes(t.id) && !researchRequirements(state, t.id).length) ||
        TECHS.find((t) => !state.techTreeUnlocked.includes(t.id) && t.prereqs.every((p) => state.techTreeUnlocked.includes(p))) ||
        TECH.chinchilla;
  const active = state.research?.id === focus.id,
    progress = active ? Math.min(100, (state.research.progress / focus.work) * 100) : 0,
    rate = active ? researchRate(state, d) : 0,
    months = active && rate > 0 ? Math.ceil((focus.work - state.research.progress) / rate) : null,
    errors = researchRequirements(state, focus.id),
    allDone = !active && state.techTreeUnlocked.includes(focus.id);
  const objectives = [
      { name: "Research a learning algorithm", done: state.techTreeUnlocked.includes("perceptron") },
      { name: "Launch your first product", done: state.products.length > 0 },
      { name: "Hire a third researcher", done: state.talent.length >= 3 },
    ],
    n = objectives.filter((o) => o.done).length;
  paint(
    $("#inspector"),
    `<div class="section-heading"><span class="eyebrow">ON THE BLACKBOARD</span>${icon("flask", 15)}</div><div class="research-card"><div class="research-sketch"><span class="sketch-tag">${active ? "RESEARCH IN PROGRESS" : allDone ? "THE TREE IS COMPLETE" : "THE NEXT BREAKTHROUGH"}</span>${sketch()}</div><div class="research-card-content"><div class="meta"><span>${esc(focus.branch.toUpperCase())}</span><span>${focus.year} PAPER</span></div><h2>${focus.id === "perceptron" ? "The perceptron" : esc(focus.name)}</h2><p>${focus.id === "perceptron" ? "What if a machine could learn from its mistakes? Teach a single neuron to tell two patterns apart." : esc(focus.eli5.split(". ").slice(0, 2).join(". ") + ".")}</p><div class="progress-track"><i style="width:${allDone ? 100 : progress}%"></i></div><div class="progress-label"><span>${active ? Math.floor(progress) + "% complete" : allDone ? "Discovered" : focus.compute + " CU · " + compact(focus.data) + " examples"}</span><span>${active ? (months ? months + " months" : "Awaiting capacity") : allDone ? "In your codex" : money(focus.cost)}</span></div>${active ? `<button class="btn primary wide" data-action="tech" data-id="${focus.id}">${icon("flask", 14)} View research</button>` : allDone ? `<button class="btn wide" data-action="navigate" data-id="codex">${icon("book", 14)} Open the encyclopedia</button>` : `<button class="btn primary wide" data-action="${errors.length ? "tech" : "research-start"}" data-id="${focus.id}">${icon("flask", 14)} ${errors.length ? "Plan research" : "Begin research"} ${icon("arrow", 13)}</button>`}</div><div class="research-card-footer"><button class="text-btn" data-action="learn" data-id="${focus.lesson}" data-tech="${focus.id}">${icon("book", 13)} Learn the idea</button><span>LESSON ${LESSONS[focus.lesson].number}</span></div></div>
 <div class="objective-card"><div class="objective-title">${n === 3 ? "Foundations established" : "Plant the first seed"}<small>${n} / 3</small></div><p>${n === 3 ? "Explore the tree. Prepare for the first winter." : "Every great laboratory starts with a few good questions."}</p>${objectives.map((o) => `<div class="objective-step ${o.done ? "done" : ""}"><span class="check-circle">${o.done ? icon("check", 9) : ""}</span>${o.name}</div>`).join("")}</div>
 <div class="health-card"><span class="eyebrow">THE MACHINES BEHIND THE IDEA</span><div class="health-row"><span>Power</span><div class="progress-track"><i style="width:${Math.min(100, (d.load / Math.max(1, d.supply)) * 100)}%;background:${d.powerRatio < 1 ? "#c69b75" : "#a9b68f"}"></i></div><small>${Math.round(d.load)} / ${d.supply} kW</small></div><div class="health-row"><span>Cooling</span><div class="progress-track"><i style="width:${Math.min(100, (d.heat / Math.max(1, d.cooling)) * 100)}%;background:#99b1aa"></i></div><small>${Math.round(d.heat)} / ${Math.round(d.cooling)} kW</small></div><button class="safety-strip wide" data-action="navigate" data-id="strategy" style="border:0"><span>${icon("shield", 13)} Safety culture</span><strong>${Math.round(state.resources.safety)} / 100</strong></button></div>`,
  );
}
function renderTimeline() {
  const era = eraFor(state.year);
  paint(
    $("#timeline"),
    `<div class="timeline-top"><span class="eyebrow">THE HISTORY YOU HAVEN’T WRITTEN YET</span><div class="date-controls"><span class="date">${formatDate(state)}</span><button class="btn small" data-action="pause" title="Space or P to pause or resume">${icon(state.paused ? "play" : "pause", 12)} ${state.paused ? "Resume" : "Pause"}</button><div class="speed-controls" aria-label="Simulation speed">${[1, 6, 24].map((n) => `<button class="${state.speed === n ? "active" : ""}" data-action="speed" data-id="${n}" aria-label="${n} times speed">${n}×</button>`).join("")}</div><button class="icon-btn" data-action="eras" aria-label="All historical eras" title="View all eras" style="width:28px;height:28px">${icon("clock", 13)}</button></div></div><div class="timeline-track">${ERAS.slice(
      1,
      7,
    )
      .map(
        (e) =>
          `<button class="era-block ${era.id === e.id ? "active" : ""}" data-action="era" data-id="${e.id}"><strong>${e.short}</strong><small>${e.start}–${e.end - 1}</small></button>`,
      )
      .join("")}<button class="era-block future" data-action="eras"><strong>Beyond ${icon("arrow", 10)}</strong><small>2023–2150 · ROADMAP</small></button></div>`,
  );
}
function buildHelpText() {
  const src = kit?.input.source || "keyboard";
  if (mode && BUILDINGS[mode])
    return (
      esc(BUILDINGS[mode].desc) +
      (src === "gamepad"
        ? " Move the cursor with the left stick, A builds. X rotates; B cancels."
        : src === "touch"
          ? " Tap a free tile. Rotate turns the module."
          : " Click a free tile. Q rotates; Esc cancels.")
    );
  return "Select a module, then click an empty floor tile. Keep your cash runway in view.";
}
function renderDock() {
  const entries = [
    ["compute", "vacuum", "Compute"],
    ["people", "desk", "Workspaces"],
    ["utility", "power", "Utilities"],
    ["data", "archive", "Data"],
    ["lounge", "lounge", "Wellbeing"],
  ];
  paint(
    $("#build-dock"),
    entries
      .map(
        ([id, type, label]) =>
          `<button class="dock-button ${drawer === id ? "active" : ""}" data-action="build-category" data-id="${id}" title="Build ${label.toLowerCase()}">${buildingIcon(type)}<span>${label}</span></button>`,
      )
      .join("") +
      `<span class="dock-divider"></span><button class="dock-button ${drawer === "connections" ? "active" : ""}" data-action="build-category" data-id="connections"><span class="ui-icon">${icon("link", 23)}</span><span>Connect</span></button><button class="dock-button ${mode === "demolish" ? "active" : ""}" data-action="demolish-mode"><span class="ui-icon">${icon("trash", 22)}</span><span>Sell</span></button>`,
  );
  const el = $("#build-drawer");
  if (!drawer) {
    paint(el, "");
    return;
  }
  const categories = {
    compute: Object.keys(BUILDINGS).filter((t) => BUILDINGS[t].compute),
    people: ["desk"],
    utility: ["power", "cooling", "network"],
    data: ["archive"],
    lounge: ["lounge"],
  };
  const src = kit?.input.source || "keyboard";
  if (drawer === "connections")
    paint(
      el,
      `<div class="build-drawer"><div class="drawer-header"><h3>Give the floor a nervous system.</h3><div class="drawer-actions"><div class="segmented" role="group" aria-label="Lay or remove conduits"><button data-action="conduit-mode" data-id="lay" class="${conduitErase ? "" : "active"}">Lay</button><button data-action="conduit-mode" data-id="erase" class="${conduitErase ? "active" : ""}">Remove</button></div><button class="icon-btn" data-action="cancel-build" aria-label="Close building menu">${icon("close", 14)}</button></div></div><div class="build-options">${Object.entries(
        CONDUITS,
      )
        .map(
          ([id, c]) =>
            `<button class="build-option ${layer === id ? "active" : ""}" data-action="select-conduit" data-id="${id}"><span style="color:${c.color};margin:12px">${icon(id === "power" ? "bolt" : id === "cooling" ? "snow" : "link", 28)}</span><strong>${c.name}</strong><small>${money(c.price)} / tile</small></button>`,
        )
        .join(
          "",
        )}</div><p class="build-help">Select a layer, then ${src === "touch" ? "tap" : "click"} floor tiles. Networks connect orthogonally; machines connect on or beside a conduit. ${src === "gamepad" ? "Hold A and move to lay a run; X removes." : src === "touch" ? "Switch to Remove to take a layer up." : "Shift-click removes that layer."} All three layers can share a tile.</p></div>`,
    );
  else {
    const types = categories[drawer] || [];
    const placing = mode && BUILDINGS[mode];
    paint(
      el,
      `<div class="build-drawer"><div class="drawer-header"><h3>${drawer === "compute" ? "Build the machinery of thought." : drawer === "people" ? "Make room for another mind." : drawer === "utility" ? "Intelligence needs infrastructure." : drawer === "data" ? "Build a memory for the laboratory." : "Good work needs a little breathing room."}</h3><div class="drawer-actions">${placing ? `<button class="btn small" data-action="rotate-build" title="Rotate the module (Q)">${icon("rotate", 13)} Rotate · ${rotation * 90}°</button>` : ""}<button class="icon-btn" data-action="cancel-build" aria-label="Close building menu">${icon("close", 14)}</button></div></div><div class="build-options">${types
        .map((id) => {
          const b = BUILDINGS[id];
          return `<button class="build-option ${mode === id ? "active" : ""}" data-action="select-build" data-id="${id}" ${b.year > state.year ? "disabled" : ""} title="${esc(b.desc)}">${buildingIcon(id)}<strong>${b.name}</strong><small>${b.year > state.year ? "Available " + b.year : money(b.price)}</small></button>`;
        })
        .join(
          "",
        )}</div><p class="build-help">${buildHelpText()}</p></div>`,
    );
  }
}
function renderSelection(d = null) {
  const el = $("#selection");
  const b = state.labLayout.find((b) => b.id === selected);
  world?.setSelected(b && !drawer ? b.id : null);
  if (!b || drawer) {
    paint(el, "");
    return;
  }
  d ??= derive(state);
  const def = BUILDINGS[b.type],
    status = d.statuses[b.id];
  paint(
    el,
    `<section class="selected-module"><div class="module-title"><h3>${def.name}</h3><button class="icon-btn" data-action="clear-selection" aria-label="Close module details">${icon("close", 13)}</button></div><p>${esc(def.desc)}</p>${status ? `<div class="service-tags">${["power", "cooling", "network"].map((k) => `<span class="${status[k] ? "" : "bad"}">${k}: ${status[k] ? "linked" : "missing"}</span>`).join("")}<span>${Math.round(status.temperature)}°C</span><span>${Math.round(status.efficiency * 100)}% efficiency</span></div>` : `<p>${def.power} kW · ${money(def.upkeep)} upkeep / month</p>`}<div class="button-row"><button class="btn small" data-action="sell-building" data-id="${b.id}">${icon("trash", 13)} Sell · ${money(def.price * 0.5)}</button><button class="btn small" data-action="build-category" data-id="connections">Connections</button></div></section>`,
  );
}
function tileClicked(x, z, remove = false) {
  if (state.gameOver || state.completed) return;
  const b = state.labLayout.find((b) => b.x === x && b.z === z);
  if (layer) {
    result(conduit(state, layer, x, z, remove || conduitErase), "wire");
  } else if (mode === "demolish") {
    if (b) result(demolish(state, b.id), "sell");
    else {
      toast("Choose an installed module.", true);
      sound.play("error");
    }
  } else if (mode && BUILDINGS[mode]) {
    const r = result(build(state, mode, x, z, rotation), "build");
    if (r.ok) kit?.input.rumble(0.25, 70);
  } else {
    selected = b?.id || null;
    if (b) sound.play("tap");
    renderSelection();
  }
}
function setMode(nextMode, nextLayer = null) {
  mode = nextMode;
  layer = nextLayer;
  world?.setMode(mode, layer, rotation);
}
function openDrawer(id) {
  if (page !== "lab") setPage("lab");
  drawer = drawer === id ? null : id;
  selected = null;
  conduitErase = false;
  setMode(null, drawer === "connections" ? "power" : null);
  renderDock();
  renderSelection();
}
function closeDrawer() {
  drawer = null;
  conduitErase = false;
  setMode(null);
  renderDock();
  renderSelection();
}
function setPage(id) {
  const changed = page !== id;
  page = id;
  selected = null;
  drawer = null;
  conduitErase = false;
  setMode(null);
  $$(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.id === id);
    b.setAttribute("aria-current", b.dataset.id === id ? "page" : "false");
  });
  const panel = $("#page-panel");
  panel.classList.toggle("hidden", id === "lab");
  if (changed) panel.scrollTop = 0;
  renderDock();
  renderSelection();
  renderPage();
}
function pageHeader(kicker, title, desc, action = "close-page", button = "Back to lab", ico = "arrow") {
  return `<div class="page-title"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${desc}</p></div><button class="btn" data-action="${action}">${button}${icon(ico, 15)}</button></div>`;
}
const POS = {
  neuron: [0, 1],
  logic: [0, 0],
  perceptron: [1, 1],
  eliza: [1, 0],
  adaline: [1, 2],
  expert: [2, 0],
  backprop: [2, 1],
  qlearning: [2, 2],
  svm: [3, 0],
  lenet: [3, 1],
  lstm: [3, 2],
  pagerank: [3, 3],
  alexnet: [4, 1],
  attention: [4, 2],
  preferences: [4, 3],
  diffusion: [5, 0],
  resnet: [5, 1],
  transformer: [5, 2],
  dqn: [5, 3],
  kaplan: [6, 1],
  rlhf: [6, 3],
  chinchilla: [7, 1],
};
function renderPage(d = null) {
  if (page === "lab") return;
  const el = $("#page-panel"),
    r = state.resources;
  d ??= derive(state);
  if (page === "research") {
    const nodes = TECHS.map((t) => {
      const [col, row] = POS[t.id] || [7, 3],
        errors = researchRequirements(state, t.id),
        done = state.techTreeUnlocked.includes(t.id),
        active = state.research?.id === t.id;
      return `<button class="tech-node ${done ? "discovered" : active ? "researching" : errors.length ? "locked" : ""}" style="left:${25 + col * 255}px;top:${62 + row * 166}px" data-action="tech" data-id="${t.id}"><div class="node-top"><span>${t.year} · ${esc(t.branch)}</span>${icon(done ? "check" : active ? "flask" : errors.length ? "lock" : "plus", 12)}</div><strong>${esc(t.name)}</strong><div class="node-bottom"><span>${t.compute} CU · ${compact(t.data)} examples</span><span class="node-status">${done ? "IN CODEX" : active ? Math.floor((state.research.progress / t.work) * 100) + "%" : "VIEW PAPER"}</span></div></button>`;
    }).join("");
    let lines = "";
    TECHS.forEach((t) =>
      t.prereqs.forEach((p) => {
        const [fromC, fromR] = POS[p] || [7, 3],
          [toC, toR] = POS[t.id] || [7, 3],
          x1 = 25 + fromC * 255 + 220,
          y1 = 62 + fromR * 166 + 60,
          x2 = 25 + toC * 255,
          y2 = 62 + toR * 166 + 60;
        lines += `<path d="M${x1} ${y1} C${x1 + 35} ${y1},${x2 - 35} ${y2},${x2} ${y2}" fill="none" stroke="${state.techTreeUnlocked.includes(p) ? "#a4b592" : "#d3dbc7"}" stroke-width="1.6" ${state.techTreeUnlocked.includes(p) ? "" : 'stroke-dasharray="4 4"'}/>`;
      }),
    );
    paint(
      el,
      pageHeader(
        "A LINEAGE OF IDEAS",
        "The research tree.",
        "Real papers. Alternate history. Connections are curriculum and gameplay prerequisites, not claims that history followed one inevitable chain.",
        "scaling",
        "Scaling bench",
        "chart",
      ) +
        `<div class="research-tree-wrapper"><div class="research-tree"><svg class="tree-edges">${lines}</svg>${["FOUNDATIONS", "LEARNING", "REVIVAL", "PATTERNS", "DEPTH", "ATTENTION", "SCALE", "EFFICIENCY"].map((v, i) => `<div class="tree-era-heading" style="left:${30 + i * 255}px">${v}</div>`).join("")}${nodes}</div></div><div class="tree-legend"><span><i></i>Discovered</span><span>Research can begin up to 8 years early, with a time penalty.</span><span>Scroll horizontally to explore ${icon("arrow", 12)}</span></div>`,
    );
  } else if (page === "people") {
    const cards = state.talent
      .map(
        (t) =>
          `<article class="card"><div class="avatar" style="background:${t.color}33">${t.name
            .split(" ")
            .map((w) => w[0])
            .join(
              "",
            )}</div><span class="trait">${t.trait}</span><h3 style="margin-top:9px">${t.name}</h3><p>${t.bio} Specialty: ${t.specialty}.</p><div class="team-stats"><span>Skill ×${t.skill}</span><span>Morale ${Math.round(t.morale)}%</span></div><div class="progress-track"><i style="width:${t.morale}%"></i></div><div class="card-bottom"><small>${money(t.salary * d.salaryFactor)} / month</small><button class="text-btn" data-action="fire-confirm" data-id="${t.id}">End contract</button></div></article>`,
      )
      .join("");
    paint(
      el,
      pageHeader(
        "THE MINDS BEHIND THE MACHINES",
        "People, not parameters.",
        "Fictional researchers with distinct strengths. Workstations, morale, publication time, and compute access determine output.",
      ) +
        `<div class="notice">${state.talent.length} researchers · ${d.desks} desks · ${money(d.payroll)} monthly payroll. Specialist matches provide a research bonus. Common rooms improve morale.</div><div class="card-grid">${cards || '<article class="card"><p>Your next colleague is below.</p></article>'}</div><div class="section-title"><h2>A few exceptional minds.</h2><button class="text-btn" data-action="build-shortcut" data-id="desk">Build a workstation ${icon("plus", 13)}</button></div><div class="card-grid">${CANDIDATES.filter(
          (t) => !state.talent.some((p) => p.id === t.id),
        )
          .map(
            (t) =>
              `<article class="card"><span class="trait">${t.trait}</span><h3 style="margin-top:12px">${t.name}</h3><p>${t.bio} Specialty: ${t.specialty}.</p><div class="team-stats"><span>Skill ×${t.skill}</span><span>${money(t.salary * d.salaryFactor)} / month</span></div><div class="card-bottom"><small>$1,500 recruitment</small><button class="btn small primary" data-action="hire" data-id="${t.id}">Recruit ${icon("plus", 13)}</button></div></article>`,
          )
          .join("")}</div>`,
    );
  } else if (page === "products") {
    paint(
      el,
      pageHeader(
        "IDEAS THAT KEEP THE LIGHTS ON",
        "From paper to product.",
        "Choose narrow promises you can keep. Markets are fictional abstractions; neither revenue nor deployment dates are historical records.",
      ) +
        `<div class="notice">${delta(d.revenue)} monthly product revenue · ${d.demand.toFixed(1)} CU reserved for inference · ${Math.round(d.fulfillment * 100)}% demand served. More products leave less compute for research.</div><div class="card-grid">${PRODUCTS.map(
          (p) => {
            const active = d.productDetails.find((q) => q.id === p.id),
              available = state.techTreeUnlocked.includes(p.tech) && state.year >= p.year - 3;
            return `<article class="card"><div class="card-label">${p.tag} · ${p.year}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="team-stats"><span>${p.compute} CU demand</span><span>${active ? Math.round(active.fit * 100) + "% market fit" : money(p.revenue) + " base / month"}</span></div>${active ? `<div class="badge">${active.released ? "OPEN RELEASE · LOWER MARGINS" : "PROPRIETARY · HIGHER MARGINS"}</div>` : `<p style="font-size:10px">Requires ${TECH[p.tech].name}</p>`}<div class="card-bottom"><small>${active ? delta(active.revenue) + " / month" : money(p.cost) + " launch cost"}</small><button class="btn small ${active ? "" : "primary"}" data-action="${active ? "retire-confirm" : "launch"}" data-id="${p.id}" ${!active && !available ? "disabled" : ""}>${active ? "Retire" : available ? "Launch product" : "Research required"}</button></div></article>`;
          },
        ).join("")}</div>`,
    );
  } else if (page === "data") {
    paint(
      el,
      pageHeader(
        "NOT ALL EXAMPLES ARE EQUAL",
        "A memory worth learning from.",
        "Acquire examples, audit labels, and measure coverage. Data is reusable; quality scales the effective examples available to research.",
      ) +
        `<div class="card-grid"><div class="card"><span class="eyebrow">EFFECTIVE EXAMPLES</span><div class="stat-large">${compact((r.data * r.quality) / 100)}</div><p>${Math.round(r.data).toLocaleString()} raw × ${r.quality.toFixed(1)}% quality. Archives add ${Math.round(d.rawData).toLocaleString()} curated examples each month.</p></div><div class="card"><span class="eyebrow">QUALITY / BIAS</span><div class="stat-large">${Math.round(r.quality)} <span style="font-size:16px;color:#96a487">/ ${Math.round(r.bias)}</span></div><p>Quality improves usable signal. Bias is a fictional risk index, not a universal statistical fairness metric.</p></div><div class="card"><span class="eyebrow">LICENSING EXPOSURE</span><div class="stat-large">${Math.round(state.licensing)} <span style="font-size:16px;color:#96a487">/ 100</span></div><p>A gameplay index for provenance risk. This is not legal advice or a summary of current copyright law.</p></div></div><div class="section-title"><h2>Choose your sources.</h2><button class="text-btn" data-action="build-shortcut" data-id="archive">Build an archive ${icon("plus", 13)}</button></div><div class="card-grid">${[
          ["curated", "Licensed & labeled", "$2,200", "Small, carefully documented batches. 96% source quality; reduces bias."],
          ["scraped", "Web acquisition", "$850", "Large, weakly curated batches. 45% source quality; increases provenance exposure and bias. Available from 1993."],
          [
            "synthetic",
            "Synthetic expansion",
            "$1,200",
            "Generate from your own model. Without new real data, repeated loops dilute quality and can compound blind spots. Requires Transformer.",
          ],
        ]
          .map(
            ([id, name, cost, desc]) =>
              `<article class="card"><div class="card-label">DATA ACQUISITION</div><h3>${name}</h3><p>${desc}</p><div class="card-bottom"><small>${cost} / batch</small><button class="btn small primary" data-action="acquire" data-id="${id}">Acquire batch</button></div></article>`,
          )
          .join(
            "",
          )}</div><div class="card" style="margin-top:18px"><h3>Clean before you scale.</h3><p>Remove duplicates and audit labels: −5% raw examples, +8 quality, −7 bias. Repeated cleaning has diminishing practical value once quality reaches 99.</p><div class="card-bottom"><small>$1,500 / audit</small><button class="btn small" data-action="acquire" data-id="clean">Clean & label ${icon("check", 14)}</button></div></div>`,
    );
  } else if (page === "strategy") {
    paint(
      el,
      pageHeader(
        "WHAT YOU OPTIMIZE BECOMES YOUR LAB",
        "Choose what matters.",
        "Publication, profit, and responsible deployment pull in different directions. The safety score is a fictional management indicator, never an existential-risk probability.",
      ) +
        `<div class="ledger"><div><div class="card"><h2>The balance sheet.</h2><div class="stat-row"><div><span class="eyebrow">CASH RUNWAY</span><div class="stat-large" style="font-size:28px">${Number.isFinite(d.runway) ? Math.floor(d.runway) + " months" : "Cash-positive"}</div></div><div><span class="eyebrow">LAB VALUATION</span><div class="stat-large" style="font-size:28px">$${compact(d.valuation)}</div></div></div>${[
          ["Base grant", d.grants],
          ["Product revenue", d.revenue],
          ["Payroll", -d.payroll],
          ["Hardware upkeep", -d.upkeep],
          ["Power & facilities", -d.electricity - d.rent],
          ["Product maintenance", -d.maintenance],
          ["Safety program", -d.safetyCost],
        ]
          .map(([l, n]) => `<div class="ledger-line"><span>${l}</span><span>${delta(n)}</span></div>`)
          .join(
            "",
          )}<div class="ledger-line total"><span>Monthly cash flow</span><span class="${d.net < 0 ? "warning-text" : "success-text"}">${delta(d.net)}</span></div><button class="btn wide" data-action="grant" style="margin-top:15px" ${state.grantCooldown ? "disabled" : ""}>${state.grantCooldown ? "Next grant in " + state.grantCooldown + " months" : "Apply for a project grant"} ${icon("arrow", 15)}</button><p class="source-note">All finances use simplified game dollars. Valuation = cash + 48 × monthly product revenue + $12,000 per discovery. No modeled inflation, market cap, or real investment return. Difficulty: ${DIFFICULTIES[state.difficulty]?.name || "Standard"}.</p></div></div><div><div class="card"><h3>Open science or proprietary advantage?</h3><p>New discoveries follow this policy. Open publication boosts citations and reputation, while competitors learn faster. New open products earn lower margins.</p><div class="segmented" style="margin-top:18px"><button data-action="policy-open" data-id="open" class="${state.policy.open ? "active" : ""}">Open by default</button><button data-action="policy-open" data-id="closed" class="${!state.policy.open ? "active" : ""}">Proprietary</button></div><label class="range-label">Time protected for publication <output id="publishing-value">${state.policy.publishing}%</output><input type="range" id="publishing" min="0" max="100" value="${state.policy.publishing}"></label><p>More protected time improves research, citations, and morale. Commercial workloads still reserve compute.</p></div><div class="card" style="margin-top:17px"><h3>Safety is a practice.</h3><p>Ongoing investment and independent audits improve the score. Unsafe deployments and biased data erode it. RLHF reduces some modeled incidents; it does not prove alignment.</p><label class="range-label">Safety program intensity <output id="safety-value">${state.policy.safety} / 100</output><input type="range" id="safety" min="0" max="100" value="${state.policy.safety}"></label><div class="ledger-line"><span>Current safety culture</span><strong>${Math.round(r.safety)} / 100</strong></div><button class="btn wide" data-action="audit" style="margin-top:15px" ${state.auditCooldown ? "disabled" : ""}>${state.auditCooldown ? "Next audit in " + state.auditCooldown + " months" : "Independent audit · " + money(2200 + d.compute * 25)}</button></div></div></div>`,
    );
    $("#publishing").oninput = (e) => {
      $("#publishing-value").textContent = e.target.value + "%";
    };
    $("#publishing").onchange = (e) => {
      state.policy.publishing = Number(e.target.value);
      render();
    };
    $("#safety").oninput = (e) => {
      $("#safety-value").textContent = e.target.value + " / 100";
    };
    $("#safety").onchange = (e) => {
      state.policy.safety = Number(e.target.value);
      render();
    };
  } else if (page === "codex") {
    const available = TECHS.filter(
      (t) => (codexAll || state.techTreeUnlocked.includes(t.id)) && `${t.name} ${t.eli5} ${t.authors}`.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    paint(
      el,
      pageHeader(
        "THE LIVING ENCYCLOPEDIA",
        "Understand what you build.",
        `Your archive grows with every discovery. Original explanations, primary paper links, and ${Object.keys(LESSONS).length} reusable interactive notebooks.`,
      ) +
        `<div class="codex-tools"><input type="search" id="codex-search" placeholder="Search concepts, authors, ideas…" aria-label="Search encyclopedia" value="${esc(searchTerm)}"><button class="btn small" data-action="codex-all">${codexAll ? "Show discovered only" : "Browse all papers"}</button></div><div class="card-grid">${Object.entries(
          LESSONS,
        )
          .map(
            ([id, l]) =>
              `<article class="card"><div class="card-label">INTERACTIVE NOTEBOOK · ${l.number}</div><h3>${l.title}</h3><p>${l.intro}</p><div class="card-bottom"><small>${state.learned.includes(id) ? "Notebook completed" : "Experiment, then test your intuition"}</small><button class="btn small" data-action="learn" data-id="${id}">Open lesson ${icon("arrow", 13)}</button></div></article>`,
          )
          .join(
            "",
          )}</div><div class="section-title"><h2>${codexAll ? "The paper archive." : "On your bookshelf."}</h2><p>${available.length} papers · ${state.techTreeUnlocked.length} discovered</p></div><div class="card-grid">${available.map((t) => `<article class="card codex-card"><div class="card-label">${t.year} · ${t.branch}</div><h3>${t.name}</h3><div class="authors">${t.authors}</div><p>${t.eli5}</p><div class="source-note">${t.note}</div><div class="card-bottom"><a href="${t.source}" target="_blank" rel="noopener noreferrer" class="text-btn">Original paper ${icon("arrow", 13)}</a><button class="btn small" data-action="learn" data-id="${t.lesson}" data-tech="${t.id}">Notebook ${LESSONS[t.lesson].number}</button></div></article>`).join("") || '<div class="notice">No matching concepts in this view. Try browsing all papers.</div>'}</div><div class="section-title"><h2>Before the lab.</h2></div><div class="card-grid">${FOUNDATIONS.map((f) => `<article class="card codex-card"><div class="card-label">${f.year} · PROLOGUE</div><h3>${f.name}</h3><div class="authors">${f.authors}</div><p>${f.eli5}</p><div class="card-bottom"><a class="text-btn" href="${f.source}" target="_blank" rel="noopener noreferrer">Primary source ${icon("arrow", 13)}</a></div></article>`).join("")}</div>`,
    );
    $("#codex-search").oninput = (e) => {
      const pos = e.target.selectionStart;
      searchTerm = e.target.value;
      renderPage();
      $("#codex-search").focus();
      $("#codex-search").setSelectionRange(pos, pos);
    };
  } else if (page === "journal") {
    paint(
      el,
      pageHeader(
        "A RECORD OF DECISIONS",
        "The laboratory journal.",
        "Discoveries, choices, and turning points. This is your alternate history, recorded one month at a time.",
      ) + `<div class="card"><div class="log-list">${state.logs.map((l) => `<div class="log-entry ${l.type}"><small>${esc(l.date)}</small><span>${esc(l.text)}</span></div>`).join("")}</div></div>`,
    );
  }
}
function render() {
  const d = derive(state);
  document.documentElement.dataset.era = eraFor(state.year).id;
  renderHUD(d);
  renderDock();
  renderSelection(d);
  world?.sync(state, d);
  if (page !== "lab" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) renderPage(d);
  syncEvent();
}

/* ---------------------------------------------------------------- windows */
const BACKGROUND = () => [$(".topbar"), $(".workspace"), $("#page-panel")];
function openModal(content, className = "", type = "generic") {
  if (lesson) {
    lesson.dispose();
    lesson = null;
  }
  if (!modal) {
    previousFocus = document.activeElement;
    modalPause = state.paused;
    state.paused = true;
  }
  modal = type;
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" tabindex="-1">${content}</section></div>`;
  // The rest of the page is inert while a window is open: Tab stays inside it.
  for (const el of BACKGROUND()) if (el) el.inert = true;
  if (kit?.input.source === "gamepad") focusDefault();
  else $("#modal-root .modal").focus({ preventScroll: true });
  renderHUD(derive(state));
}
function releaseModal() {
  lesson?.dispose();
  lesson = null;
  $("#modal-root").innerHTML = "";
  modal = null;
  for (const el of BACKGROUND()) if (el) el.inert = false;
  kit?.input.settle();
}
function closeModal() {
  if (modal === "event") return;
  releaseModal();
  if (!state.event && !state.gameOver && !state.completed) state.paused = modalPause;
  if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus?.({ preventScroll: true });
  render();
}
function showTech(id) {
  const t = TECH[id];
  if (!t) return;
  const done = state.techTreeUnlocked.includes(id),
    active = state.research?.id === id,
    errors = researchRequirements(state, id);
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">${t.year} · ${t.branch.toUpperCase()}</span><h1>${t.name}</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close research">${icon("close", 16)}</button></div><p style="margin-bottom:12px">${t.eli5}</p><p style="font-size:10px;color:#a0ab91">${t.authors}</p><div class="tech-summary"><div><span>COMPUTE REQUIRED</span><strong>${t.compute} free CU</strong></div><div><span>EFFECTIVE EXAMPLES</span><strong>${t.data.toLocaleString()}</strong></div><div><span>RESEARCH BUDGET</span><strong>${money(t.cost)}</strong></div></div><p>${t.prereqs.length ? "Curriculum prerequisites: " + t.prereqs.map((p) => TECH[p].name).join(" · ") : "A foundation already available to your lab."}</p>${active ? `<div class="requirements"><p>${Math.floor((state.research.progress / t.work) * 100)}% complete. Research slows if free compute or effective data falls below requirements, and stops with no usable compute.</p></div>` : done ? '<div class="notice" style="margin-top:18px">Discovered. This paper is in your encyclopedia.</div>' : `<div class="requirements">${errors.length ? errors.map((e) => `<div class="requirement missing">${icon("info", 12)} ${esc(e)}</div>`).join("") : `<div class="requirement">${icon("check", 12)} All requirements met.</div>`}</div>`}<div class="source-note">${t.note}</div><div class="modal-footer"><a href="${t.source}" target="_blank" rel="noopener noreferrer" class="text-btn">Read the original ${icon("arrow", 13)}</a><div class="button-row"><button class="btn" data-action="learn" data-id="${t.lesson}" data-tech="${t.id}">Learn ${icon("book", 14)}</button>${!done && !active ? `<button class="btn primary" data-action="research-start" data-id="${id}" ${errors.length ? "disabled" : ""}>Fund research</button>` : ""}</div></div>`,
    "",
    "tech",
  );
}
/** The notebook's 3D view borrows the kit canvas: its mount moves into the window and back. */
const lessonView = {
  get kit() {
    return kit;
  },
  attach(host) {
    host.append($("#kit-mount"));
  },
  detach() {
    $("#world-host").prepend($("#kit-mount"));
  },
};
function showLesson(id, techId = null) {
  if (!LESSONS[id]) return;
  const note = techId && TECH[techId] ? esc(TECH[techId].note) : "";
  openModal(lessonMarkup(id, note), "lesson", "lesson");
  lesson = new LessonEngine(lessonView, id, $("#lesson-view"), (id) => {
    if (learn(state, id)) {
      toast("Notebook completed. +2 reputation, +10 citations.");
      sound.play("discover");
      kit?.input.rumble(0.3, 120);
    }
    renderHUD(derive(state));
  });
}
function showEras() {
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">1956—2150 · THE COMPLETE VISION</span><h1>A long view of intelligence.</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close era timeline">${icon("close")}</button></div><p>This release plays 1956–2022. The prologue is in the codex. Later eras are an expansion roadmap; future dates and outcomes are speculative, not forecasts.</p><div class="era-list">${ERAS.map((e) => `<div class="era-row"><small>${e.start}–${e.end - 1}</small><div><h3>${e.name}</h3><p>${e.blurb}</p></div><span class="badge">${e.id === 0 ? "CODEX" : e.roadmap ? (e.speculative ? "SPECULATIVE" : "ROADMAP") : "PLAYABLE"}</span></div>`).join("")}</div><p class="source-note">Historical boundaries differ by country, institution, and source. These intervals organize game mechanics. A future AGI date is not established by a paper or by a scaling law.</p>`,
    "large",
    "eras",
  );
}
function showPaths() {
  const best = readRecords().best;
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">THERE IS MORE THAN ONE KIND OF PROGRESS</span><h1>What will your lab stand for?</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close paths">${icon("close")}</button></div><p>These are historical-campaign objectives ending in 2022, not the full game’s 2050 or AGI victories. You may change your philosophy without restarting.</p>${PATHS.map((p) => `<button class="path-choice ${state.path === p.id ? "active" : ""}" data-action="choose-path" data-id="${p.id}">${icon(p.icon, 23)}<div><strong>${p.name}</strong><p>${p.desc}</p>${best[p.id] ? `<small class="path-best">Best: ${Math.round(Number(best[p.id].progress) || 0)}%${best[p.id].won ? " · achieved" : ""} · ${esc(best[p.id].date)}</small>` : ""}</div></button>`).join("")}<p class="source-note">Academic success uses a fictional citation score, not an AI Nobel Prize. The Steward’s objective does not claim to achieve or certify safe AGI.</p>`,
    "",
    "paths",
  );
}
function controlsText() {
  const src = kit?.input.source || "keyboard";
  if (src === "gamepad")
    return "<strong>Controller:</strong> the left stick moves the tile cursor and A builds or inspects; hold A and move to lay a conduit run. The right stick orbits, LT and RT zoom, and clicking the right stick recentres. X rotates a module or removes a conduit. Y pauses or resumes time; LB and RB change speed. The D-pad moves through every button and panel, A presses, B goes back. Start opens the laboratory menu; Back shows this guide.";
  if (src === "touch")
    return "<strong>Touch:</strong> drag to orbit, pinch to zoom, tap a machine to inspect. In build mode, tap a free tile; Rotate turns the module. In Connect mode, switch between Lay and Remove. Every action is also a button on screen.";
  return "<strong>Controls:</strong> drag to orbit, right-drag to pan, scroll to zoom; click a machine to inspect. In build mode, click a free tile; Q rotates. Shift-click removes a selected conduit. Arrow keys and Enter drive a tile cursor too. Space or P pauses. Keys 1, 2, 3 set 1×, 6×, 24× speed. R opens research; B opens construction; S saves; M opens the laboratory menu; Esc closes a view; F9 opens graphics settings.";
}
function showHelp() {
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">YOUR FIRST FEW DECISIONS</span><h1>Build a lab. Change a field.</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close help">${icon("close")}</button></div><p>Begin with <strong>The perceptron</strong> on the blackboard. Fund research, resume time, and open its interactive notebook. Research <strong>Logic Theorist</strong> as well: useful products pay for the next question.</p><div class="requirements"><div class="requirement">01 · Keep cash flowing. Grants arrive every month; payroll never stops.</div><div class="requirement">02 · Build compute and desks from the toolbar below the lab.</div><div class="requirement">03 · Connect power, cooling, and data. Unpowered machines go dark; hot or isolated ones glow amber and throttle.</div><div class="requirement">04 · Recruit researchers. Fund a paper. Launch a useful product.</div><div class="requirement">05 · In 1974 and 1987, grant cuts make cash runway critical.</div></div><p>${controlsText()}</p><p style="margin-top:14px">At 1×, one month takes five seconds. Reading a window pauses time. The game never simulates time while the browser tab is hidden. Saves stay on this device; export JSON for a portable backup.</p><p class="source-note">${TECHS.length} paper-based nodes, six playable eras, one modular room, ${Object.keys(LESSONS).length} reusable notebooks. Numerical economy, hardware performance, risk scores, and fictional staff are game abstractions. No real AI models are trained; no API key is needed.</p><div class="modal-footer"><small>Historical campaign · 1956–2022</small><button class="btn primary" data-action="close-modal">Back to the blackboard ${icon("arrow", 15)}</button></div>`,
    "",
    "help",
  );
}
function difficultyPicker() {
  return `<div class="segmented difficulty-choice">${Object.entries(DIFFICULTIES)
    .map(([id, d]) => `<button data-action="difficulty" data-id="${id}" class="${pendingDifficulty === id ? "active" : ""}" title="${esc(d.desc)}">${d.name}</button>`)
    .join("")}</div><p class="difficulty-note">${esc(DIFFICULTIES[pendingDifficulty].desc)}</p>`;
}
function showSettings() {
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">LABORATORY ADMINISTRATION</span><h1>A place for the essentials.</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close the laboratory menu">${icon("close")}</button></div><div class="button-row menu-actions"><button class="btn primary" data-action="close-modal">Resume the lab ${icon("arrow", 15)}</button><button class="btn" data-action="graphics">${icon("settings", 15)} Graphics & controls</button><button class="btn" data-action="help">${icon("info", 15)} How to play</button></div><p>Saves use this browser’s local storage. Download a portable JSON backup before clearing browsing data or moving computers. Imported saves are validated.</p><div class="button-row" style="margin:23px 0"><button class="btn primary" data-action="save">${icon("save", 15)} Save lab</button><button class="btn" data-action="export">${icon("download", 15)} Export JSON</button><button class="btn" data-action="import">${icon("upload", 15)} Import JSON</button><button class="btn" data-action="load">Load saved lab</button></div><div class="ledger-line"><span>Interface sound</span><button class="btn small" data-action="sound">${sound.enabled ? "On · turn off" : "Off · turn on"}</button></div><div class="ledger-line"><span>Difficulty of this lab</span><strong>${DIFFICULTIES[state.difficulty]?.name || "Standard"}</strong></div><div class="section-title"><h2>Begin a different chapter.</h2></div><p>New scenarios replace the active lab after confirmation. Export your current lab first.</p><span class="eyebrow" style="margin-top:16px">DIFFICULTY FOR THE NEW CHAPTER</span>${difficultyPicker()}<div class="button-row" style="margin-top:14px">${SCENARIOS.map((sc) => `<button class="btn" data-action="new-confirm" data-id="${sc.year}">${sc.year} · ${sc.name}</button>`).join("")}</div>${recordsMarkup()}<div class="source-note">Engine: three.js r186 on the shared 3D kit (WebGPU, with WebGL2 where WebGPU is unavailable), ES modules, no framework. Everything the game needs is served with it; there is no telemetry or server-side account.</div>`,
    "",
    "settings",
  );
}
function showWelcome() {
  const p = PATHS.find((p) => p.id === state.path);
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">SINGULARITY TYCOON · A HISTORY OF INTELLIGENCE</span><h1>Every intelligence starts somewhere.</h1></div></div><p>Run a research laboratory from a 1956 blackboard to the deep-learning revolution. Fund real papers, wire machines to power, cooling and data, hire researchers, and keep the lights on through two AI winters.</p>${
      saveProblem ? `<div class="notice" style="margin-top:14px">Your saved lab could not be read, so a fresh one is ready. The unreadable save was kept on this device.</div>` : ""
    }${
      hadSave
        ? `<div class="welcome-save"><span class="eyebrow">YOUR LABORATORY</span><strong>${formatDate(state)} · ${esc(p.name)}</strong><small>${state.discovered} discoveries · ${money(state.resources.capital)} · ${state.talent.length} researchers · ${DIFFICULTIES[state.difficulty]?.name || "Standard"}${state.gameOver || state.completed ? " · chapter ended" : ""}</small></div><div class="button-row"><button class="btn primary" data-action="welcome-continue">Continue the lab ${icon("arrow", 15)}</button></div>`
        : ""
    }<div class="section-title"><h2>${hadSave ? "Or begin a different chapter." : "Choose where history starts."}</h2></div><span class="eyebrow">DIFFICULTY</span>${difficultyPicker()}<div class="scenario-list">${SCENARIOS.map((sc, i) => `<button class="btn scenario ${!hadSave && i === 0 ? "primary" : ""}" data-action="welcome-start" data-id="${sc.year}">Start in ${sc.year}<small>${sc.name}</small></button>`).join("")}</div><p class="source-note">${controlsText()}</p>${recordsMarkup()}`,
    "welcome",
    "welcome",
  );
}
function showScaling() {
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">THE SCALING BENCH · A PAPER, NOT A PROPHECY</span><h1>Spend compute thoughtfully.</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close scaling bench">${icon("close")}</button></div><div class="science-grid"><div><p>Change parameter count and training tokens. The plot holds the resulting compute budget fixed and varies how it is divided. Lower predicted loss is better.</p><label class="range-label">Model parameters (N)<output id="param-output">${compact(10 ** scaleN)}</output><input id="scale-n" type="range" min="7" max="11" step=".05" value="${scaleN}"></label><label class="range-label">Training tokens (D)<output id="token-output">${compact(10 ** scaleD)}</output><input id="scale-d" type="range" min="8" max="13" step=".05" value="${scaleD}"></label><div id="scaling-numbers"></div><div class="equation">L(N,D) = 1.69 + 406.4 / N⁰·³⁴<br>+ 410.7 / D⁰·²⁸<br>C ≈ 6ND</div></div><div><div id="scaling-chart"></div><h3 style="margin:18px 0 8px">Two allocation models.</h3><p>Kaplan (2020): N ∝ C⁰·⁷³ and D ∝ C⁰·²⁷. Chinchilla’s first approach (2022): both scale approximately as C⁰·⁵. The fitted-loss optimum used here is a different approach in that same paper and need not have a fixed tokens-per-parameter ratio.</p><div class="source-note">N and D are raw counts. The fit describes a particular pretraining regime; extrapolating can be misleading. It predicts neither consciousness nor specific emergent abilities, general intelligence, safety, or downstream utility.</div></div></div><div class="modal-footer"><div><a class="text-btn" href="https://arxiv.org/abs/2203.15556" target="_blank" rel="noopener noreferrer">Hoffmann et al. (2022) ${icon("arrow", 13)}</a><a class="text-btn" href="https://arxiv.org/abs/2001.08361" target="_blank" rel="noopener noreferrer" style="margin-left:12px">Kaplan et al. (2020)</a></div><button class="btn primary" data-action="train-scaling" ${!state.techTreeUnlocked.includes("kaplan") || state.training ? "disabled" : ""}>${state.training ? "Experiment running" : "Fund experiment"}</button></div><p class="source-note">The bench is always available for learning. Funding a simulated run requires the scaling-laws node; its compute throughput is compressed for gameplay and does not use the illustrative hardware FLOP/s. It trains no real model.</p>`,
    "large",
    "scaling",
  );
  updateScaling();
  $("#scale-n").oninput = (e) => {
    scaleN = Number(e.target.value);
    updateScaling();
  };
  $("#scale-d").oninput = (e) => {
    scaleD = Number(e.target.value);
    updateScaling();
  };
}
function scalingChart(N, D) {
  const C = 6 * N * D;
  let path = "",
    minLoss = Infinity,
    maxLoss = 0;
  const points = [];
  for (let i = 0; i <= 70; i++) {
    const n = 10 ** (7 + (i / 70) * 4),
      loss = scalingLoss(n, C / (6 * n));
    points.push([n, loss]);
    minLoss = Math.min(minLoss, loss);
    maxLoss = Math.max(maxLoss, loss);
  }
  const x = (n) => 45 + ((Math.log10(n) - 7) / 4) * 455,
    y = (l) => 170 - ((l - minLoss) / (maxLoss - minLoss)) * 135;
  points.forEach(([n, l], i) => (path += (i ? "L" : "M") + x(n).toFixed(1) + " " + y(l).toFixed(1) + " "));
  return `<svg class="scale-chart" viewBox="0 0 540 215"><path d="M45 22V175H510" fill="none" stroke="#c8d2bb"/><path d="${path}" fill="none" stroke="#88a275" stroke-width="2.5"/><circle cx="${x(N)}" cy="${y(scalingLoss(N, D))}" r="5" fill="#bf966e"/><text x="18" y="14">LOSS</text><text x="40" y="197">10M</text><text x="158" y="197">100M</text><text x="271" y="197">1B</text><text x="382" y="197">10B</text><text x="490" y="197">100B</text><text x="191" y="213">PARAMETERS · FIXED COMPUTE</text></svg>`;
}
function updateScaling() {
  const N = 10 ** scaleN,
    D = 10 ** scaleD,
    C = 6 * N * D,
    opt = optimalAllocation(C);
  $("#param-output").textContent = compact(N);
  $("#token-output").textContent = compact(D);
  $("#scaling-chart").innerHTML = scalingChart(N, D);
  $("#scaling-numbers").innerHTML =
    `<div class="ledger-line"><span>Predicted pretraining loss</span><strong>${scalingLoss(N, D).toFixed(3)}</strong></div><div class="ledger-line"><span>Approximate training compute</span><strong>${C.toExponential(2)} FLOPs</strong></div><div class="ledger-line"><span>Tokens per parameter</span><strong>${(D / N).toFixed(1)}</strong></div><div class="ledger-line"><span>Fitted optimum at this budget</span><strong>${compact(opt.N)} params · ${compact(opt.D)} tokens</strong></div>`;
}
function syncEvent() {
  // The welcome screen comes first; events and endings open once it is closed.
  if (modal === "welcome") return;
  if (state.gameOver || state.completed) {
    if (!endShown) {
      endShown = true;
      const sc = score(state),
        d = derive(state);
      let record = null;
      if (!state.recorded) {
        record = recordChapter(sc, d);
        state.recorded = true;
        saveLocal(state);
      }
      const best = readRecords().best[state.path];
      openModal(
        `<div class="modal-header"><div><span class="eyebrow">${state.gameOver ? "THE LABORATORY CLOSES" : "THE HISTORICAL CAMPAIGN ENDS"}</span><h1>${state.gameOver ? "Every experiment teaches." : sc.won ? "A legacy of intelligence." : "The next question is yours."}</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Review laboratory">${icon("close")}</button></div><p>${esc(state.gameOver || "You have reached the end of 2022. The historical campaign stops here; 2023–2150 remains the expansion roadmap.")}</p><div class="tech-summary"><div><span>DISCOVERIES</span><strong>${state.discovered}</strong></div><div><span>CITATIONS</span><strong>${Math.floor(state.resources.citations)}</strong></div><div><span>LAB VALUATION</span><strong>$${compact(d.valuation)}</strong></div></div><p>${PATHS.find((p) => p.id === state.path).name}: ${Math.floor(sc.progress)}% of the campaign objective${sc.won ? " · achieved." : "."}${best ? ` Your best for this horizon: ${Math.round(Number(best.progress) || 0)}% (${esc(best.date)}).` : ""}${record?.improved ? " <strong>A new personal best.</strong>" : ""}</p><div class="modal-footer"><button class="btn" data-action="export">Export final save</button><button class="btn primary" data-action="settings">Start a new chapter ${icon("arrow", 15)}</button></div>`,
        "",
        "end",
      );
    }
    return;
  }
  if (state.event && eventShown !== state.event.id + ":" + state.elapsed) {
    eventShown = state.event.id + ":" + state.elapsed;
    openModal(
      `<div class="event-icon">${icon(state.event.kind === "era" ? "snow" : "book", 24)}</div><div class="modal-header"><div><span class="eyebrow">${formatDate(state)} · ${state.event.kind === "era" ? "A CHANGING WORLD" : "A LABORATORY DECISION"}</span><h1>${esc(state.event.title)}</h1></div></div><p>${esc(state.event.body)}</p><div class="event-choices">${state.event.choices.map((c, i) => `<button class="event-choice" data-action="event-choice" data-id="${i}"><strong>${esc(c.label)} ${icon("arrow", 16)}</strong><small>${esc(c.detail)}</small></button>`).join("")}</div><p class="source-note">The simulation is paused until you make this decision.</p>`,
      "",
      "event",
    );
  }
}
function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `singularity-lab-${state.year}-${String(state.month + 1).padStart(2, "0")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Portable laboratory save exported.");
}
function confirmAction(title, body, action, id, extra = "") {
  openModal(
    `<div class="modal-header"><div><span class="eyebrow">LABORATORY DECISION</span><h1>${title}</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Cancel">${icon("close")}</button></div><p>${body}</p><div class="modal-footer"><button class="btn" data-action="close-modal">Keep things as they are</button><button class="btn primary" data-action="${action}" data-id="${id}" ${extra}>Confirm ${icon("arrow", 15)}</button></div>`,
    "",
    "confirm",
  );
}
/** Replace the active lab (a new chapter, an import or a reload) and drop any window. */
function adopt(next) {
  releaseModal();
  state = next;
  pendingDifficulty = state.difficulty || "standard";
  selected = null;
  drawer = null;
  mode = null;
  layer = null;
  conduitErase = false;
  eventShown = null;
  endShown = false;
  accumulator = 0;
  padCursor = null;
  world?.invalidate();
  setPage("lab");
  render();
}
function resetLab(year, run = false) {
  adopt(newGame(state.path, year, pendingDifficulty));
  if (run) {
    state.paused = false;
    render();
  }
  saveLocal(state);
  hadSave = true;
  toast(run ? "A new chapter begins." : "A new chapter begins. Resume when ready.");
}
async function importFile(file) {
  if (!file) return;
  if (file.size > 2e6) {
    toast("Save file is too large (maximum 2 MB).", true);
    return;
  }
  try {
    const next = validateSave(JSON.parse(await file.text()));
    adopt(next);
    saveLocal(state);
    toast("Save imported and paused.");
  } catch (e) {
    toast("Cannot import save: " + e.message, true);
  } finally {
    $("#import-file").value = "";
  }
}
function togglePause() {
  if (state.gameOver || state.completed || state.event || modal) return;
  state.paused = !state.paused;
  accumulator = 0;
  sound.play("click");
  render();
}
function setSpeed(n) {
  if (state.speed === n) return;
  state.speed = n;
  renderTimeline();
}

/* ---------------------------------------------------------------- clicks on the page */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  if (
    (state.gameOver || state.completed) &&
    ["research-start", "sell-building", "hire", "fire", "launch", "retire", "acquire", "grant", "audit", "train-scaling"].includes(a)
  ) {
    toast("This chapter has ended. Review the lab or start a new scenario in settings.", true);
    return;
  }
  try {
    switch (a) {
      case "navigate":
        setPage(id);
        break;
      case "close-page":
        setPage("lab");
        break;
      case "pause":
        togglePause();
        break;
      case "speed":
        setSpeed(Number(id));
        break;
      case "save":
        result(saveLocal(state), "save");
        break;
      case "settings":
        showSettings();
        break;
      case "help":
        showHelp();
        break;
      case "graphics":
        kit?.menu.open();
        break;
      case "eras":
        showEras();
        break;
      case "era": {
        const er = ERAS.find((e) => e.id === Number(id));
        openModal(
          `<div class="modal-header"><div><span class="eyebrow">ERA ${er.id} · ${er.start}–${er.end - 1}</span><h1>${er.name}</h1></div><button class="icon-btn" data-action="close-modal" aria-label="Close era">${icon("close")}</button></div><p>${er.blurb}</p><div class="requirements"><p>Funding multiplier: ×${er.grant}. Hardware availability changes with the year. You keep your lab, team, discoveries, and products through each transition.</p></div><p class="source-note">Era boundaries are simplified historical framing. They are not the exact timing of every country’s or institution’s funding changes.</p><div class="modal-footer"><button class="btn" data-action="eras">All eras</button><button class="btn primary" data-action="close-modal">Return to the lab</button></div>`,
          "",
          "era",
        );
        break;
      }
      case "paths":
        showPaths();
        break;
      case "choose-path":
        state.path = id;
        closeModal();
        toast("Lab philosophy changed.");
        break;
      case "close-modal":
        closeModal();
        break;
      case "tech":
        showTech(id);
        break;
      case "learn":
        showLesson(id, b.dataset.tech);
        break;
      case "research-start": {
        const r = startResearch(state, id);
        if (r.ok && modal) closeModal();
        result(r);
        break;
      }
      case "build-category":
        openDrawer(id);
        break;
      case "build-shortcut":
        setPage("lab");
        drawer = BUILDINGS[id].category === "Data" ? "data" : "people";
        setMode(id);
        renderDock();
        break;
      case "select-build":
        setMode(id);
        renderDock();
        break;
      case "rotate-build":
        rotation = (rotation + 1) % 4;
        world?.setMode(mode, layer, rotation);
        renderDock();
        break;
      case "select-conduit":
        setMode(null, id);
        renderDock();
        break;
      case "conduit-mode":
        conduitErase = id === "erase";
        renderDock();
        break;
      case "cancel-build":
        closeDrawer();
        break;
      case "demolish-mode":
        drawer = null;
        setMode(mode === "demolish" ? null : "demolish");
        renderDock();
        renderSelection();
        if (mode) toast("Choose a module to sell it for 50% of its purchase price.");
        break;
      case "clear-selection":
        selected = null;
        renderSelection();
        break;
      case "sell-building":
        result(demolish(state, Number(id)), "sell");
        selected = null;
        renderSelection();
        break;
      case "zoom-in":
        world?.zoom(0.9);
        break;
      case "zoom-out":
        world?.zoom(1.1);
        break;
      case "reset-view":
        world?.reset();
        break;
      case "hire":
        result(hire(state, id));
        break;
      case "fire-confirm": {
        const t = state.talent.find((t) => t.id === id);
        if (!t) break;
        confirmAction(
          "End this research contract?",
          `${esc(t.name)} will leave the lab. You will pay two months of severance (${money(t.salary * derive(state).salaryFactor * 2)}) and lose 2 reputation.`,
          "fire",
          id,
        );
        break;
      }
      case "fire": {
        const r = fire(state, id);
        if (r.ok) closeModal();
        result(r);
        break;
      }
      case "launch":
        result(launchProduct(state, id));
        break;
      case "retire-confirm":
        confirmAction(
          "Retire this product?",
          "Monthly revenue stops immediately. Reserved compute returns to research; launch costs are not refunded.",
          "retire",
          id,
        );
        break;
      case "retire":
        closeModal();
        result(retireProduct(state, id));
        break;
      case "acquire":
        result(acquireData(state, id));
        break;
      case "grant":
        result(applyGrant(state));
        break;
      case "audit":
        result(safetyAudit(state));
        break;
      case "policy-open":
        state.policy.open = id === "open";
        render();
        break;
      case "codex-all":
        codexAll = !codexAll;
        renderPage();
        break;
      case "event-choice": {
        const r = chooseEvent(state, Number(id));
        if (r.ok) {
          modal = "generic";
          closeModal();
          eventShown = null;
        }
        result(r);
        break;
      }
      case "export":
        exportSave();
        break;
      case "import":
        $("#import-file").click();
        break;
      case "load":
        try {
          const next = loadLocal();
          if (!next) {
            toast("No saved laboratory on this device.", true);
            break;
          }
          adopt(next);
          toast("Laboratory restored and paused.");
        } catch (err) {
          toast("Could not load save: " + err.message, true);
        }
        break;
      case "new-confirm":
        confirmAction(
          "Start a new chapter?",
          `This replaces the active lab with the ${esc(id)} scenario on ${esc(DIFFICULTIES[pendingDifficulty].name)} difficulty. Export your current JSON save first to keep a separate copy.`,
          "new",
          id,
        );
        break;
      case "new":
        resetLab(Number(id), b.dataset.run === "1");
        break;
      case "difficulty": {
        if (!DIFFICULTIES[id]) break;
        pendingDifficulty = id;
        const box = b.closest(".modal") || document;
        box.querySelectorAll('[data-action="difficulty"]').forEach((x) => x.classList.toggle("active", x === b));
        const note = box.querySelector(".difficulty-note");
        if (note) note.textContent = DIFFICULTIES[id].desc;
        sound.play("tap");
        break;
      }
      case "welcome-continue":
        closeModal();
        if (!state.gameOver && !state.completed && !state.event) {
          state.paused = false;
          render();
        }
        break;
      case "welcome-start":
        if (hadSave)
          confirmAction(
            "Start a new chapter?",
            `This replaces your saved lab (${formatDate(state)}) with the ${esc(id)} scenario on ${esc(DIFFICULTIES[pendingDifficulty].name)} difficulty. Export it first from the laboratory menu to keep a copy.`,
            "new",
            id,
            'data-run="1"',
          );
        else resetLab(Number(id), true);
        break;
      case "sound":
        sound.setEnabled(!sound.enabled);
        sound.play("click");
        b.textContent = sound.enabled ? "On · turn off" : "Off · turn on";
        break;
      case "scaling":
        showScaling();
        break;
      case "train-scaling": {
        const r = startTraining(state, 10 ** scaleN, 10 ** scaleD);
        result(r);
        if (r.ok) closeModal();
        break;
      }
    }
  } catch (err) {
    console.error(err);
    toast("That action could not be completed. " + err.message, true);
  }
});

/* ---------------------------------------------------------------- input (kit.input actions)
   Keyboard/mouse, gamepad and touch all arrive here. DOM buttons keep their own clicks;
   a controller drives them with spatial focus (D-pad) and A. */
const ACTIONS = {
  orbit: { type: "look", mouse: "drag", gamepad: "rightStick", touch: "drag" },
  panDrag: { mouse: [2, 1] },
  click: { mouse: [0] },
  cursor: { type: "vector", keys: "arrows", gamepad: "leftStick" },
  navPad: { type: "vector", gamepad: "dpad" },
  confirm: { keys: ["Enter", "NumpadEnter"], gamepad: ["A"] },
  back: { keys: ["Escape"], gamepad: ["B"] },
  menu: { keys: ["KeyM"], gamepad: ["Start"] },
  help: { keys: ["F1", "Slash"], gamepad: ["Back"] },
  pauseTime: { keys: ["Space", "KeyP"], gamepad: ["Y"] },
  rotate: { keys: ["KeyQ"], gamepad: ["X"] },
  remove: { keys: ["ShiftLeft", "ShiftRight"] },
  speed1: { keys: ["Digit1", "Numpad1"] },
  speed2: { keys: ["Digit2", "Numpad2"] },
  speed3: { keys: ["Digit3", "Numpad3"] },
  slower: { gamepad: ["LB"] },
  faster: { gamepad: ["RB"] },
  zoomIn: { keys: ["Equal", "NumpadAdd"], gamepad: ["RT"] },
  zoomOut: { keys: ["Minus", "NumpadSubtract"], gamepad: ["LT"] },
  camReset: { keys: ["Home"], gamepad: ["RS"] },
  save: { keys: ["KeyS"] },
  research: { keys: ["KeyR"] },
  buildMenu: { keys: ["KeyB"] },
};
const ORBIT_GAIN = { keyboard: [3.2, 2.2], touch: [1.6, 1.1], gamepad: [0.75, 0.5] };
const CAPTIONS = {
  keyboard: "DRAG TO ORBIT · RIGHT-DRAG TO PAN · SCROLL TO ZOOM · CLICK TO INSPECT",
  touch: "DRAG TO ORBIT · PINCH TO ZOOM · TAP TO INSPECT",
  gamepad: "LEFT STICK CURSOR · A SELECT · RIGHT STICK ORBIT · D-PAD MENUS · START MENU",
};
function updatePrompts() {
  const src = kit?.input.source || "keyboard";
  promptSource = src;
  document.documentElement.dataset.input = src;
  setText($("#camera-caption"), CAPTIONS[src] || CAPTIONS.keyboard);
  renderDock();
}
const FOCUSABLE = 'button:not([disabled]),a[href],input:not([type="hidden"]):not([type="file"]):not([disabled]),select:not([disabled])';
function navRoots() {
  if (kit?.menu.isOpen) return [];
  if (modal) return [$("#modal-root")];
  if (page !== "lab") return [$(".topbar"), $(".sidebar"), $("#page-panel"), $("#timeline")];
  return [$(".topbar"), $(".sidebar"), $(".stage"), $("#inspector"), $("#timeline")];
}
function focusables() {
  return navRoots()
    .filter(Boolean)
    .flatMap((r) => [...r.querySelectorAll(FOCUSABLE)])
    .filter((el) => el.getClientRects().length && !el.closest("[hidden],.hidden"));
}
function focusInRoots(el) {
  return !!el && el !== document.body && el.matches?.(FOCUSABLE) && navRoots().some((r) => r?.contains(el));
}
function focusEl(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
function focusDefault() {
  const list = focusables();
  if (!list.length) return;
  if (modal) {
    focusEl(
      list.find((el) => el.matches(".btn.primary")) ||
        list.find((el) => el.dataset.action !== "close-modal" && !el.matches("a")) ||
        list[0],
    );
    return;
  }
  if (page !== "lab") {
    focusEl(list.find((el) => $("#page-panel").contains(el) && !el.closest(".page-title")) || list[0]);
    return;
  }
  focusEl($("#build-drawer button.build-option:not(:disabled)") || $("#build-dock button") || list[0]);
}
function moveFocus(dir) {
  const list = focusables();
  if (!list.length) return;
  const cur = document.activeElement;
  if (!list.includes(cur)) {
    focusDefault();
    return;
  }
  const a = cur.getBoundingClientRect(),
    vertical = dir === "up" || dir === "down";
  let best = null,
    bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const along = vertical
      ? (dir === "down" ? 1 : -1) * (b.top + b.height / 2 - (a.top + a.height / 2))
      : (dir === "right" ? 1 : -1) * (b.left + b.width / 2 - (a.left + a.width / 2));
    if (along <= 4) continue;
    const gap = vertical ? Math.max(0, b.left - a.right, a.left - b.right) : Math.max(0, b.top - a.bottom, a.top - b.bottom);
    if (gap > along * 1.8 + 40) continue;
    const s = along + gap * 2.5 + (vertical ? Math.abs(b.left - a.left) : Math.abs(b.top - a.top)) * 0.05;
    if (s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  if (best) {
    focusEl(best);
    sound.play("tap");
    return;
  }
  // Nothing further that way: scroll the panel or window instead.
  if (vertical) {
    let sc = cur.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    sc?.scrollBy?.({ top: (dir === "down" ? 1 : -1) * 160, behavior: "smooth" });
  }
}
function stepField(el, d) {
  if (el?.tagName === "INPUT" && el.type === "range") {
    d > 0 ? el.stepUp() : el.stepDown();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  if (el?.tagName === "SELECT") {
    const i = clampN(el.selectedIndex + d, 0, el.options.length - 1);
    if (i !== el.selectedIndex) {
      el.selectedIndex = i;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }
  return false;
}
function activateFocused() {
  const el = document.activeElement;
  if (!focusInRoots(el)) return false;
  if (el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit"].includes(el.type)) return true;
  if (el.tagName === "SELECT") return true;
  el.click();
  return true;
}
const repeat = {};
/** A stick or arrow direction as discrete steps: one on press, then repeats while held. */
function stepDir(v, key) {
  const ax = Math.abs(v.x),
    ay = Math.abs(v.y),
    now = performance.now();
  const dir = Math.max(ax, ay) > 0.5 ? (ax > ay ? (v.x > 0 ? "right" : "left") : v.y > 0 ? "up" : "down") : null;
  const r = (repeat[key] ??= { dir: null, at: 0 });
  if (!dir) {
    r.dir = null;
    return null;
  }
  if (dir !== r.dir) {
    r.dir = dir;
    r.at = now + 360;
    return dir;
  }
  if (now >= r.at) {
    r.at = now + 120;
    return dir;
  }
  return null;
}
/** Move the tile cursor one tile in a screen direction (forward is away from the camera). */
function moveTileCursor(dir) {
  const start = padCursor || world?.hover || { x: 5, z: 4 };
  const yaw = world ? world.view.yaw : 0.66;
  const sx = dir === "right" ? 1 : dir === "left" ? -1 : 0,
    sy = dir === "up" ? 1 : dir === "down" ? -1 : 0;
  // Screen right = (cos yaw, −sin yaw); screen forward = (−sin yaw, −cos yaw) on the floor.
  const wx = Math.cos(yaw) * sx - Math.sin(yaw) * sy,
    wz = -Math.sin(yaw) * sx - Math.cos(yaw) * sy;
  const step = Math.abs(wx) >= Math.abs(wz) ? { x: Math.sign(wx), z: 0 } : { x: 0, z: Math.sign(wz) };
  padCursor = { x: clampN(start.x + step.x, 0, 9), z: clampN(start.z + step.z, 0, 7) };
  world?.setHover(padCursor);
  sound.play("tap");
  return padCursor;
}
function back() {
  if (kit?.menu.isOpen) return;
  if (modal) {
    closeModal();
    return;
  }
  if (drawer || mode || layer) closeDrawer();
  else if (selected) {
    selected = null;
    renderSelection();
  } else if (page !== "lab") setPage("lab");
  else if (focusInRoots(document.activeElement)) document.activeElement.blur();
  else if (padCursor) {
    padCursor = null;
    world?.setHover(null);
  } else if (kit?.input.source !== "gamepad") showSettings();
}
function handleInput(dt) {
  const inp = kit.input;
  if (inp.source !== promptSource) updatePrompts();
  if (inp.pressed("back")) back();
  if (inp.pressed("menu")) {
    if (modal === "settings") closeModal();
    else if (modal === "welcome") activateFocused() || focusDefault();
    else if (modal !== "event") showSettings();
  }
  if (inp.pressed("help")) {
    if (modal === "help") closeModal();
    else if (modal !== "event" && modal !== "welcome") showHelp();
  }
  if (!modal) {
    if (inp.pressed("pauseTime")) togglePause();
    if (inp.pressed("speed1")) setSpeed(1);
    if (inp.pressed("speed2")) setSpeed(6);
    if (inp.pressed("speed3")) setSpeed(24);
    if (inp.pressed("slower")) setSpeed(state.speed === 24 ? 6 : 1);
    if (inp.pressed("faster")) setSpeed(state.speed === 1 ? 6 : 24);
    if (inp.pressed("save")) result(saveLocal(state), "save");
    if (inp.pressed("research")) setPage("research");
    if (inp.pressed("buildMenu")) {
      drawer = null;
      openDrawer("compute");
    }
    if (inp.pressed("rotate")) {
      if (layer && padCursor) tileClicked(padCursor.x, padCursor.z, true);
      else if (mode && BUILDINGS[mode]) {
        rotation = (rotation + 1) % 4;
        world?.setMode(mode, layer, rotation);
        renderDock();
      }
    }
  }

  // Spatial focus for panels and windows; a tile cursor in the open lab.
  const uiContext = !!modal || page !== "lab";
  const uiFocused = focusInRoots(document.activeElement);
  const dCursor = stepDir(inp.vector("cursor"), "cursor");
  const dPad = stepDir(inp.vector("navPad"), "pad");
  const navigate = (dir) => {
    const horiz = dir === "left" || dir === "right";
    if (!(horiz && uiFocused && stepField(document.activeElement, dir === "right" ? 1 : -1))) moveFocus(dir);
  };
  if (uiContext) {
    const dir = dPad || dCursor;
    if (dir) navigate(dir);
  } else {
    // In the open lab the D-pad walks the buttons and the left stick (or the arrow keys,
    // when no button has keyboard focus) drives the tile cursor.
    if (dPad && uiFocused) navigate(dPad);
    else if (dPad) focusDefault();
    if (dCursor && uiFocused && inp.source !== "gamepad") navigate(dCursor);
    else if (dCursor) {
      if (uiFocused) document.activeElement.blur();
      const cell = moveTileCursor(dCursor);
      // Holding A (or Enter) while moving lays a conduit run.
      if (layer && !conduitErase && inp.down("confirm")) {
        const r = conduit(state, layer, cell.x, cell.z, false);
        if (r.ok) {
          sound.play("wire");
          render();
        }
      }
    }
  }
  if (inp.pressed("confirm")) {
    if (uiFocused) activateFocused();
    else if (uiContext) focusDefault();
    else if (padCursor) tileClicked(padCursor.x, padCursor.z, inp.down("remove"));
    else {
      // The first press shows the tile cursor where the pointer last was (or mid-room).
      padCursor = world?.hover || { x: 5, z: 4 };
      world?.setHover(padCursor);
    }
  }

  // Camera and pointer.
  const look = inp.look("orbit");
  const [gy, gp] = ORBIT_GAIN[inp.source] || ORBIT_GAIN.keyboard;
  const zoom = inp.zoom();
  const held = inp.value("zoomIn") - inp.value("zoomOut");
  if (lesson) {
    if (look.x || look.y) lesson.orbitBy(look.x * gy * 0.8, look.y * gp * 0.8);
    if (zoom) lesson.zoomBy(Math.pow(0.92, zoom));
    if (held) lesson.zoomBy(Math.exp(-held * 1.1 * dt));
    return;
  }
  if (modal || page !== "lab") {
    // The right stick scrolls an open window or panel.
    if (inp.source === "gamepad" && look.y) {
      const box = modal ? $("#modal-root .modal") : $("#page-panel");
      if (box) box.scrollTop += look.y * 420;
    }
    return;
  }
  if (!world) return;
  if (inp.down("panDrag")) world.panPixels(look.x / MOUSE_LOOK, look.y / MOUSE_LOOK);
  else if (look.x || look.y) world.orbit(look.x * gy, look.y * gp);
  if (zoom) world.zoom(Math.pow(0.9, zoom));
  if (held) world.zoom(Math.exp(-held * 1.2 * dt));
  if (inp.pressed("camReset")) world.reset();
  if (padCursor && inp.source === "gamepad") world.follow(padCursor, 1 - Math.exp(-1.5 * dt));

  const p = inp.pointer;
  // Moving the mouse over the room hands the cursor back from the keys or the pad.
  if (p.type === "mouse" && p.over && (p.x !== lastPointer.x || p.y !== lastPointer.y)) {
    if (lastPointer.x >= 0) padCursor = null;
    lastPointer.x = p.x;
    lastPointer.y = p.y;
  }
  if (p.justDown) {
    press = { x: p.x, y: p.y, moved: 0, left: p.type !== "mouse" || inp.down("click") };
    padCursor = null;
  }
  if (press && p.down) press.moved = Math.max(press.moved, Math.hypot(p.x - press.x, p.y - press.y));
  if (p.type === "mouse" && !padCursor) world.setHover(p.over ? world.pick(p.nx, p.ny) : null);
  if (p.justUp && press) {
    if (press.moved < 6 && press.left) {
      const cell = world.pick(p.nx, p.ny);
      if (cell) {
        if (p.type !== "mouse") world.setHover(cell);
        tileClicked(cell.x, cell.z, inp.down("remove"));
      }
    }
    press = null;
  }
}

/* ---------------------------------------------------------------- the loop */
function simulate(dt) {
  if (state.paused || state.event || state.gameOver || state.completed || modal) return;
  accumulator += dt * state.speed;
  if (accumulator < MONTH_SECONDS) return;
  const before = { discovered: state.discovered, training: !!state.training };
  let changed = false;
  while (accumulator >= MONTH_SECONDS) {
    accumulator -= MONTH_SECONDS;
    tick(state);
    changed = true;
    if (state.event || state.gameOver || state.completed) {
      accumulator = 0;
      break;
    }
  }
  if (!changed) return;
  if (state.discovered > before.discovered) {
    const t = TECH[state.techTreeUnlocked.at(-1)];
    toast(`Discovery: ${t ? t.name : "a new idea"}. It is now in your encyclopedia.`);
    sound.play("discover");
    kit.input.rumble(0.4, 160);
  }
  if (before.training && !state.training && !state.gameOver) {
    toast("Scaling experiment complete. +60 citations.");
    sound.play("discover");
  }
  if (state.event) {
    sound.play(state.event.kind === "era" ? "era" : "event");
    kit.input.rumble(0.3, 140);
  }
  if (state.gameOver || state.completed) {
    sound.play(state.gameOver ? "lose" : "win");
    kit.input.rumble(state.gameOver ? 0.8 : 0.5, 420);
  }
  render();
}
function frame(dt, t) {
  handleInput(dt);
  simulate(dt);
  if (lesson) lesson.render(t, dt);
  else world.render(t, dt);
  saveClock += dt;
  if (saveClock > 15) {
    saveClock = 0;
    if (!state.gameOver) saveLocal(state);
  }
}

/* ---------------------------------------------------------------- start */
shell();
// Browser shortcuts (Ctrl/⌘ or Alt chords) stay with the browser instead of reaching game keys.
window.addEventListener(
  "keydown",
  (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) e.stopImmediatePropagation();
  },
  true,
);
// Sound starts on the first gesture.
const unlockAudio = () => sound.unlock();
window.addEventListener("pointerdown", unlockAudio, true);
window.addEventListener("keydown", unlockAudio, true);
// Controller focus gets a visible ring even where :focus-visible would not show one.
document.addEventListener("focusin", (e) => {
  if (kit?.input.source === "gamepad") e.target.classList?.add("pad-focus");
});
document.addEventListener("focusout", (e) => e.target.classList?.remove("pad-focus"));

kit = await boot({
  title: "Singularity Tycoon",
  mount: $("#kit-mount"),
  gear: "none",
  accent: "#748b70",
  background: "#f4f3ec",
  touch: { hint: false },
  input: ACTIONS,
});
kit.canvas.setAttribute("aria-label", "Interactive three-dimensional laboratory. Drag to orbit, scroll to zoom, click a tile to build.");
kit.onPause((paused) => sound.pause(paused));
kit.loading.progress(0.75, "Furnishing the laboratory…");
world = new LabWorld(kit);
world.sync(state, derive(state));
await world.warm();
$("#import-file").addEventListener("change", (e) => importFile(e.target.files[0]));
window.addEventListener("beforeunload", () => saveLocal(state));
document.addEventListener("visibilitychange", () => {
  accumulator = 0;
  if (document.hidden) saveLocal(state);
  sound.pause(document.hidden || kit.paused);
});
updatePrompts();
showWelcome();
render();
kit.start(frame);

// Inspectable developer surface: no account, secret, API, or server-side service.
window.__tycoon = {
  get state() {
    return state;
  },
  get world() {
    return world;
  },
  get engine() {
    return `three-r186-${kit.backend}`;
  },
  tickMonths(n) {
    const paused = state.paused;
    state.paused = false;
    for (let i = 0; i < Math.min(n, 1500); i++) {
      tick(state);
      if (state.event || state.gameOver || state.completed) break;
    }
    state.paused = paused;
    render();
  },
  render,
  setPage,
  showLesson,
  showTech,
  resetLab,
  derive: () => derive(state),
};
