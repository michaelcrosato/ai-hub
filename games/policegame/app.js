import { questNotebook, questDestination } from "./ui/quest-notebook.js";
import { cases, getCase } from "./content/index.js";
import { createAdventure } from "./runtime/adventure.js";
import { createScene } from "./runtime/scenes.js";
import { createSaveManager, createBrowserSaveStore } from "./runtime/saves.js";
import {
  createInputFocus,
  createDOMFocusAdapter,
} from "./runtime/input-focus.js";

const E = window.My3D2dge;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const query = new URLSearchParams(location.search);
const definition = getCase(query.get("case")) || cases[0];
const development = query.get("dev") === "1";
const adventure = createAdventure(definition);
const {
  actionsFor,
  act,
  objective,
  score,
  evidenceCards,
  journalEntries,
  caseSummary,
} = adventure;
const saves = createSaveManager({
  store: createBrowserSaveStore(),
  definition,
  adventure,
  development,
});
const loaded = saves.load();
let { state, begun, area } = loaded;
let selected = null,
  selectedItem = null,
  lastResult = null,
  highlighted = false;
let notebookTab = "evidence",
  toastTimer,
  endShown = false,
  scene;
let sequenceCueKey = "",
  sequenceRemaining = 0,
  sequenceLastTime = 0,
  sequenceMoving = false;
const ui = definition.ui || {};
const HOTSPOTS = definition.hotspots;
const areas = definition.areas;
const modal = $("#modal");
const focus = createInputFocus({
  initial: begun ? "world" : "actions",
  onChange: () => scene?.setUIFocus(!focus.worldEnabled()),
});
let focusAdapter;
let modalKind = "", ownsPause = false, inputDevice = "gamepad";
let lastActionFocus = "", lastUIKey = "";
const glyph = (symbol) => `<span class="pad-glyph${symbol.length > 1 ? ' shoulder' : ''}" aria-hidden="true">${symbol}</span>`;
const session = () => ({ state, area, begun });
function syncFocus() {
  const owner = modal.open
    ? "modal"
    : state.activeSequence
      ? "conversation"
      : state.activeConversation
        ? "conversation"
        : state.activePuzzle
          ? "puzzle"
          : selected || !begun
            ? "actions"
            : "world";
  focus.set(owner);
  focusAdapter?.refresh();
  scene?.setUIFocus(!focus.worldEnabled());
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3600);
}
function save() {
  const ok = saves.save(session());
  $("#save-status").textContent =
    ok === false
      ? "SAVE HELD · OPEN SAVE MANAGEMENT"
      : development
        ? "DEVELOPMENT SAVE · PLAYER CASE UNCHANGED"
        : "PROGRESS SAVED ON THIS DEVICE";
}
function sound(id = "select") {
  try {
    scene?.game.audio.sfx(id);
  } catch {}
}
function configureShell() {
  document.body.dataset.device = inputDevice;
  $("#app").insertAdjacentHTML("beforeend", `<nav id="quick-menu" aria-label="Quick controls"><button id="map-button" aria-label="Locations">${glyph("▭")}<span>Locations</span></button><button id="quick-inventory">${glyph("□")}<span>Kit</span></button><button id="quick-notebook">${glyph("△")}<span>Notebook</span></button><button id="quick-options">${glyph("☰")}<span>Options</span></button></nav><button id="world-prompt" aria-label="Investigate focused point of interest"></button><div id="controller-legend" aria-label="Current controls"></div>`);
  $("#map-button").onclick = showMap;
  $("#quick-inventory").onclick = showInventory;
  $("#quick-notebook").onclick = () => showNotebook();
  $("#quick-options").onclick = showPause;
  $("#world-prompt").onclick = () => scene?.interactTarget();
  document.title = `Last Watch — ${definition.title}`;
  $(".case-name h2").textContent = ui.title || definition.title;
  $(".case-name p").textContent = ui.subtitle || definition.description || "";
  $(".case-name > .micro").textContent =
    ui.caseNumber || (definition.example ? "AUTHORING EXAMPLE" : "CASE FILE");
  $(".case-header > .micro").textContent =
    ui.incident || definition.id.toUpperCase();
  $(".brand small").textContent = ui.brandSubtitle || "A BELLWETHER CASE FILE";
  $(".scene-title > .micro").textContent = ui.region || "BELLWETHER";
  $("#scene-label").textContent = ui.sceneLabel || "INVESTIGATION IN PROGRESS";
  $(".unit-id").textContent = ui.officerLabel || "FIELD OFFICER";
  $(".top-meta").textContent = ui.shift || "NIGHT SHIFT";
  $(".weather").textContent = ui.weather || "AFTER HOURS";
  $("#mobile-begin").innerHTML =
    `${esc(ui.startLabel || "Begin case")} <span>→</span>`;
  $(".travel").innerHTML = areas
    .map(
      (a, i) =>
        `<button data-area="${esc(a.id)}"><span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(a.shortName || a.name || a.title || a.id)}</strong><small>${esc(a.subtitle || "")}</small></button>`,
    )
    .join("");
  $(".travel").setAttribute("aria-label", "Travel between locations");
  $$("[data-area]").forEach(
    (b) =>
      (b.onclick = () => {
        sound();
        travel(b.dataset.area);
      }),
  );
  const stages = definition.stageCount || definition.objectives?.length || 1;
  $(".progress-track").innerHTML = "<i></i>".repeat(stages);
  $(".field-kit").insertAdjacentHTML(
    "beforeend",
    '<button id="inventory"><span class="tool-icon">▱</span>Inventory</button>',
  );
  $("#inventory").onclick = showInventory;
}
function updateObjective() {
  const o = objective(state),
    count = $(".progress-track").children.length;
  $("#chapter-label").textContent = begun
    ? o.chapter || "INVESTIGATION"
    : "YOUR ASSIGNMENT";
  $("#chapter-number").textContent =
    `${String(state.phase || 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
  $("#objective-title").textContent = begun
    ? o.title
    : ui.assignmentTitle || "Open the case.";
  $("#objective-detail").textContent = begun
    ? o.detail
    : ui.assignmentDetail ||
      definition.description ||
      "Begin to receive your assignment.";
  $$(".progress-track i").forEach((el, i) => {
    el.classList.toggle(
      "done",
      begun && (state.completed || i < (state.phase || 1) - 1),
    );
    el.classList.toggle(
      "current",
      begun && !state.completed && i === (state.phase || 1) - 1,
    );
  });
  $("#evidence-count").textContent =
    `${evidenceCards(state).length} items of evidence`;
  $("#case-status").textContent = state.completed ? "CASE CLOSED" : "OPEN CASE";
}
function targets() {
  return HOTSPOTS.filter((h) => h.area === area)
    .map(
      (h) =>
        `<button data-target="${esc(h.id)}"><span>＋</span>${esc(h.name)}</button>`,
    )
    .join("");
}
function resultHTML() {
  return lastResult
    ? `<div class="result-message"><span class="speaker">${esc(lastResult.speaker || lastResult.title)}</span><p>${esc(lastResult.text)}</p></div>`
    : "";
}
function actionChoices(actions) {
  const button = a => `<button data-action="${esc(a.id)}" ${a.disabled ? 'disabled' : ''}>${esc(a.label)}${a.disabled && a.reason ? `<small>${esc(a.reason)}</small>` : ''}</button>`;
  const ready = actions.filter(a => !a.disabled), locked = actions.filter(a => a.disabled);
  return `<div class="action-list">${ready.map(button).join('') || '<p class="small-note">Everything here is up to date. Follow your next lead.</p>'}</div>${locked.length ? `<details class="locked-actions"><summary>${locked.length} ${locked.length === 1 ? 'action needs' : 'actions need'} more evidence</summary><div class="action-list">${locked.map(button).join('')}</div></details>` : ''}`;
}
function renderInteraction() {
  const box = $("#interaction");
  box.dataset.inputOwner = "actions";
  if (!begun) {
    box.innerHTML = `<p class="eyebrow">${definition.example ? "A SECOND CASE FILE" : "LAST WATCH / A PROCEDURAL ADVENTURE"}</p><h3>${esc(ui.introTitle || "Your watch starts here.")}</h3><p>${esc(ui.introText || definition.description)}</p><button class="primary" id="begin">${glyph("✕")}<span>${esc(ui.startLabel || "Begin case")}</span></button><p class="small-note">LEFT STICK TO WALK · CROSS TO INVESTIGATE<br>TAKE YOUR TIME. YOUR PROGRESS SAVES AUTOMATICALLY.</p>`;
    $("#begin").onclick = () => {
      begun = true;
      save();
      render();
      if (definition.startHotspot) selectTarget(definition.startHotspot, true);
      sound("confirm");
      if (!scene?.game.audio.ready && scene?.game.settings.sound)
        toast("For sound, click once or press a keyboard key.");
    };
    return;
  }
  if (state.activeSequence) {
    renderSequence(box);
    return;
  }
  const cv = adventure.conversationView(state),
    pv = adventure.puzzleView(state);
  if (cv || pv) {
    const view = cv || pv;
    box.dataset.inputOwner = cv ? "conversation" : "puzzle";
    box.innerHTML = `<div class="interaction-top"><p class="eyebrow">${cv ? "CONVERSATION" : "INVESTIGATION PUZZLE"}</p><button id="close-activity" class="back-scene">← SCENE</button></div><div class="person-heading">${view.actorId ? '<canvas id="portrait" width="64" height="64" aria-hidden="true"></canvas>' : ""}<h3>${esc(view.speaker || view.title || view.id)}</h3></div><p>${esc(view.text)}</p>${pv?.solved ? '<p class="gold">Reconstruction complete. Return to the scene to continue.</p>' : ''}${resultHTML()}<div class="action-list">${(view.choices || []).map((c) => `<button data-choice="${esc(c.id)}" ${c.disabled || pv?.solved ? "disabled" : ""}>${esc(c.label)}${c.disabled && c.reason ? `<small>${esc(c.reason)}</small>` : ""}</button>`).join("")}</div>${pv?.hint ? '<button id="puzzle-hint" class="secondary">Show a hint</button>' : ""}`;
    if ($("#portrait")) scene?.drawPortrait(view.actorId, $("#portrait"));
    $$("[data-choice]").forEach(
      (b) =>
        (b.onclick = () =>
          finishAction(() =>
            cv
              ? adventure.chooseConversation(state, b.dataset.choice)
              : adventure.choosePuzzle(state, b.dataset.choice),
          )),
    );
    $("#close-activity").onclick = () => {
      cv ? adventure.closeConversation(state) : adventure.closePuzzle(state);
      lastResult = null;
      save();
      render();
    };
    $("#puzzle-hint")?.addEventListener("click", () => toast(pv.hint));
    return;
  }
  if (!selected) {
    box.innerHTML = `<p class="eyebrow">${state.completed ? "SHIFT COMPLETE" : "WORK THE SCENE"}</p><h3>${state.completed ? "A case that holds." : "Every detail matters."}</h3><p>${state.completed ? "The report is filed. Revisit the scene, read your notebook, or review the debrief." : "Approach a scene marker, choose a person or object below, or walk with the arrow keys and press E."}</p>${state.completed ? '<button id="review-ending" class="primary"><span>Review debrief</span><span>→</span></button>' : ""}<div class="target-list">${targets()}</div>`;
    $("#review-ending")?.addEventListener("click", showEnding);
  } else {
    const h = HOTSPOTS.find((h) => h.id === selected);
    if (!h) {
      selected = null;
      return renderInteraction();
    }
    const actions = actionsFor(state, selected);
    const portraitId = h.actor || h.actorId || h.portrait;
    const canUse = definition.items?.some(item => state.inventory.includes(item.id) && item.uses?.some(use => use.target === selected && !use.action));
    const canPresent = definition.evidence?.some(e => state.evidence.includes(e.id) && e.presentations?.some(p => p.target === selected));
    box.innerHTML = `<div class="interaction-top"><p class="eyebrow">${esc(h.type || "INVESTIGATE")}</p><button class="back-scene" id="back-scene">○ Return to scene</button></div><div class="person-heading">${portraitId ? '<canvas id="portrait" width="64" height="64" aria-hidden="true"></canvas>' : ""}<h3>${esc(h.name)}</h3></div>${lastResult ? resultHTML() : `<p>${esc(h.description)}</p>`}${selectedItem ? `<p class="selected-item">Using ${esc(itemName(selectedItem))} <button id="cancel-item" class="secondary">Cancel</button></p>` : ""}${actionChoices(actions)}<div class="interaction-extras">${canUse ? '<button id="target-inventory" class="secondary">□ Use an item</button>' : ''}${canPresent ? '<button id="target-evidence" class="secondary">△ Present evidence</button>' : ''}</div>`;
    if ($("#portrait")) scene?.drawPortrait(portraitId, $("#portrait"));
    $("#back-scene").onclick = backToScene;
    $("#cancel-item")?.addEventListener("click", () => {
      selectedItem = null;
      render();
    });
    $("#target-inventory")?.addEventListener("click", showInventory);
    $("#target-evidence")?.addEventListener("click", () => showNotebook("evidence"));
    $$("[data-action]").forEach(
      (b) => (b.onclick = () => perform(b.dataset.action)),
    );
  }
  $$("#interaction [data-target]").forEach(
    (b) => (b.onclick = () => selectTarget(b.dataset.target, true)),
  );
}
function renderSequence(box) {
  const id = state.activeSequence;
  let progress = state.presentation[id];
  if (!progress.current && !progress.completed) {
    adventure.advanceSequence(state, id);
    progress = state.presentation[id];
    syncProgress({redraw:false});
  }
  if (!progress.current) {
    adventure.closeSequence(state, id);
    return renderInteraction();
  }
  const cue = progress.current;
  box.dataset.inputOwner = "conversation";
  box.innerHTML = `<div class="interaction-top"><p class="eyebrow">${esc(cue.speaker || cue.kind || "FIELD SEQUENCE")}</p><button id="sequence-cancel" class="back-scene">Pause & return</button></div><h3>${esc(cue.title || definition.sequences.find((q) => q.id === id)?.title || "At the scene.")}</h3><p>${esc(cue.text || "Watch the scene unfold.")}</p><div class="action-list"><button id="sequence-next">${progress.completed ? "Return to the investigation" : "Continue"}</button><button id="sequence-pause">${progress.paused ? "Resume" : "Pause"}</button><button id="sequence-skip">Skip sequence</button></div>`;
  const key = `${id}/${progress.index}`;
  if (sequenceCueKey !== key) {
    sequenceCueKey = key;
    sequenceRemaining = Math.max(
      0,
      Number(cue.durationMs ?? cue.duration) / 1000 || 0,
    );
    sequenceLastTime = 0;
    const response = scene?.cue?.(cue);
    sequenceMoving = !!response?.then;
    if (sequenceMoving)
      response.finally(() => {
        if (sequenceCueKey === key) {
          sequenceMoving = false;
          $("#sequence-next")?.removeAttribute("disabled");
        }
      });
  }
  if ((cue.kind === "wait" && sequenceRemaining > 0) || sequenceMoving)
    $("#sequence-next").disabled = true;
  $("#sequence-next").onclick = () => advancePresentation();
  $("#sequence-pause").onclick = () => {
    adventure.pauseSequence(state, id, !progress.paused);
    save();
    render();
  };
  $("#sequence-skip").onclick = () => {
    scene?.cancelWalk?.("sequence-skipped");
    adventure.advanceSequence(state, id, { skip: true });
    sequenceCueKey = "";
    syncProgress();
  };
  $("#sequence-cancel").onclick = () => {
    scene?.cancelWalk?.("sequence-canceled");
    adventure.cancelSequence(state, id);
    sequenceCueKey = "";
    save();
    render();
    toast("Sequence paused. Open Locations to resume it.");
  };
}
function advancePresentation() {
  if (!state.activeSequence) return;
  const p = state.presentation[state.activeSequence];
  if (p.paused) return;
  adventure.advanceSequence(state, state.activeSequence);
  sequenceCueKey = "";
  syncProgress();
}
function updatePresentation(now) {
  const elapsed = sequenceLastTime
    ? Math.min(0.1, (now - sequenceLastTime) / 1000)
    : 0;
  sequenceLastTime = now;
  const p = state.activeSequence && state.presentation[state.activeSequence];
  if (!p || p.paused || scene?.game.paused || modal.open) return;
  if (p.current?.kind === "wait" && sequenceRemaining > 0) {
    sequenceRemaining = Math.max(0, sequenceRemaining - elapsed);
    if (!sequenceRemaining) advancePresentation();
  }
}
function backToScene() {
  selected = null;
  lastResult = null;
  scene?.setSelected(null);
  render();
  $("#scene").focus({ preventScroll: true });
}
function renderInventoryBar() {
  $$(".field-kit [data-tool]").forEach((b) => b.remove());
  for (const item of definition.items || []) {
    if (!item.tool || !state.inventory.includes(item.id)) continue;
    const b = document.createElement("button");
    b.dataset.tool = item.id;
    b.innerHTML = `<span class="tool-icon">${esc(item.icon || "▣")}</span>${esc(item.name || item.label || item.id)}`;
    b.onclick = () => useItem(item.id);
    $(".field-kit").insertBefore(b, $("#inventory"));
  }
  $(".field-kit").append($(".unit-id"));
}
function render() {
  document.body.dataset.mode = !begun ? "intro" : state.activeSequence || state.activeConversation || state.activePuzzle ? "activity" : selected ? "interaction" : "world";
  $("#mobile-begin").classList.toggle("hidden", begun);
  updateObjective();
  renderInteraction();
  if (begun && !state.activeSequence) addPausedSequences($("#interaction"));
  renderInventoryBar();
  scene?.setState(state);
  syncFocus();
  focusPrimary();
  updateHUD();
}
function addPausedSequences(root) {
  for (const [id, progress] of Object.entries(state.presentation || {})) {
    if (!progress.paused || (progress.completed && !progress.current)) continue;
    const button = document.createElement('button');
    button.className = 'secondary';
    button.dataset.resumeSequence = id;
    button.textContent = `Resume ${definition.sequences.find(s => s.id === id)?.title || 'paused scene'}`;
    button.onclick = () => {
      if (modal.open) closeModal();
      if (progress.area && progress.area !== area) setAreaDisplay(progress.area);
      adventure.startSequence(state, id);
      adventure.pauseSequence(state, id, false);
      sequenceCueKey = '';
      syncProgress();
    };
    root.append(button);
  }
}
function finishAction(operation) {
  const oldCount = evidenceCards(state).length;
  try {
    lastResult = operation();
  } catch (error) {
    lastResult = {
      kind: "warning",
      title: "Action unavailable",
      text: error.message,
    };
    console.error(error);
  }
  sound(lastResult?.kind === "warning" ? "hurt" : "select");
  syncProgress();
  scene?.applyPresentation?.(state);
  if (evidenceCards(state).length > oldCount)
    toast("Evidence added to your case notebook.");
}
function syncProgress({ redraw = true } = {}) {
  if (state.area && state.area !== area && areas.some(a => a.id === state.area)) setAreaDisplay(state.area);
  save();
  if (redraw) render();
  if (state.completed && !endShown) { endShown = true; setTimeout(showEnding, 450); }
}
function perform(id) {
  lastActionFocus = id;
  finishAction(() => act(state, selected, id));
}
function selectTarget(id, walk = false) {
  if (!begun) {
    toast("Press Cross to begin your watch.");
    return;
  }
  const h = HOTSPOTS.find((h) => h.id === id);
  if (!h) return;
  if (h.area !== area) travel(h.area);
  if (walk) {
    scene?.selectHotspot(id);
    return;
  }
  selected = id;
  lastActionFocus = "";
  lastResult = null;
  scene?.setSelected(id);
  if (selectedItem) {
    const item = selectedItem;
    selectedItem = null;
    finishAction(() => adventure.useItem(state, item, id));
  } else render();
}
function travel(next) {
  const a = areas.find((a) => a.id === next);
  if (!a) {
    toast(`Unknown location: ${next}`);
    return false;
  }
  if (a.when && adventure.condition && !adventure.condition(state, a.when)) {
    toast(a.reason || "This location is not yet available.");
    return false;
  }
  area = next;
  state.area = next;
  if (state.activeSequence) {
    adventure.cancelSequence(state);
    sequenceCueKey = "";
    scene?.cancelWalk?.("area-change");
  }
  selected = null;
  lastResult = null;
  adventure.closeConversation(state);
  adventure.closePuzzle(state);
  scene?.setArea(next);
  $("#location-name").textContent = a.name || a.title || a.id;
  $("#area-title").textContent = a.title || a.name || a.id;
  $("#area-sub").textContent = a.description || a.subtitle || "";
  $("#viewport").setAttribute(
    "aria-label",
    `${a.name || a.id} investigation scene`,
  );
  $$("[data-area]").forEach((b) => {
    b.classList.toggle("active", b.dataset.area === next);
    b.setAttribute(
      "aria-current",
      b.dataset.area === next ? "location" : "false",
    );
  });
  render();
  if (begun) save();
  if (innerWidth <= 760)
    $(".workspace").scrollTo({ top: 0, behavior: "smooth" });
  return true;
}
function openModal(html, kicker = ui.department || "LAST WATCH / CASE FILE") {
  const wasOpen = modal.open;
  $("#modal-kicker").textContent = kicker;
  $("#modal-content").innerHTML = html;
  if (!wasOpen) modal.showModal();
  modalKind = "general";
  document.body.classList.add("overlay-open");
  syncFocus();
  modal.scrollTop = 0;
  focusPrimary(true);
  updateHUD();
}
function closeModal() {
  modal.close();
  modalKind = "";
  document.body.classList.remove("overlay-open");
  if (ownsPause) { scene?.game.resume(); ownsPause = false; }
  syncFocus();
  focusPrimary();
  if (focus.worldEnabled()) $("#scene").focus({ preventScroll: true });
  updateHUD();
}
$("#close-modal").onclick = closeModal;
modal.addEventListener("cancel", event => { event.preventDefault(); closeModal(); });
modal.addEventListener("close", () => { document.body.classList.remove("overlay-open"); syncFocus(); });
modal.addEventListener("click", (ev) => {
  if (ev.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      ev.clientX < r.left ||
      ev.clientX > r.right ||
      ev.clientY < r.top ||
      ev.clientY > r.bottom
    )
      closeModal();
  }
});
function itemName(id) {
  const i = definition.items?.find((i) => i.id === id);
  return i?.name || i?.label || id;
}
function useItem(id) {
  if (!begun) {
    toast("Begin your case first.");
    return;
  }
  const item = definition.items?.find((i) => i.id === id);
  if (item?.defaultTarget && selected !== item.defaultTarget) {
    selectedItem = id;
    closeModal();
    backToScene();
    selectTarget(item.defaultTarget, true);
    return;
  }
  if (selected) {
    closeModal();
    finishAction(() => adventure.useItem(state, id, selected));
  } else {
    selectedItem = id;
    closeModal();
    toast(`${itemName(id)} selected. Choose a person or object.`);
    render();
  }
}
function showInventory() {
  const carried = state.inventory.map(id => {
    const item = definition.items?.find(i => i.id === id);
    const usable = !selected || item?.defaultTarget || item?.uses?.some(use => use.target === selected && (!use.when || adventure.condition(state, use.when)));
    return { id, item, usable };
  }).sort((a, b) => Number(b.usable) - Number(a.usable));
  openModal(
    `<h2 id="modal-title" class="modal-title">Your field kit.</h2><p class="modal-intro">${selected ? "Available tools for this point of interest appear first." : "Choose an item, then select a person or object. Scene actions also use the right tools automatically."}</p><div class="action-list">${carried.map(({id,item,usable}) => `<button data-use-item="${esc(id)}" ${usable ? '' : 'disabled'}>${esc(itemName(id))}<small>${esc(usable ? item?.description || 'Carried item' : 'No available use at this point of interest.')}</small></button>`).join("") || "<p>No items carried.</p>"}</div>`,
    "FIELD KIT / ITEMS & TOOLS",
  );
  $$("[data-use-item]").forEach(
    (b) => (b.onclick = () => useItem(b.dataset.useItem)),
  );
  modalKind = "inventory";
}
function notebookTabs() {
  return ["evidence", "log", "procedure", ...(definition.quests?.length ? ["patrol"] : [])];
}
function showNotebook(tab = notebookTab) {
  if (!notebookTabs().includes(tab)) tab = "evidence";
  notebookTab = tab;
  const cards = evidenceCards(state).map((c) => ({
      ...c,
      media:
        c.media ||
        c.image ||
        definition.assets?.find((a) => a.id === c.mediaAsset),
    })),
    logs = journalEntries(state);
  const content =
    tab === "patrol" ? questNotebook(definition, state, begun) :
    tab === "evidence"
      ? cards.length
        ? `<div class="evidence-grid">${cards.map((c, i) => `<article class="evidence-card"><span class="micro">EXHIBIT ${String(i + 1).padStart(2, "0")} / ${esc(c.type || "EVIDENCE")}${c.stage ? ` / ${esc(c.stage)}` : ""}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>${c.media ? `<img class="inspection-image" src="${esc(typeof c.media === "string" ? c.media : c.media.src)}" alt="${esc(c.media.alt || c.title)}">` : ""}${c.history?.length ? `<details><summary>Provenance & history</summary>${c.history.map((h) => `<p>${esc(h.note || h.text || h.stage || JSON.stringify(h))}</p>`).join("")}</details>` : ""}${c.relationships?.length ? `<p class="small-note">LINKS: ${esc(c.relationships.map((r) => (typeof r === "string" ? r : `${r.kind || "Related"}: ${definition.evidence.find((e) => e.id === r.evidence)?.title || r.evidence}`)).join(", "))}</p>` : ""}${selected && definition.evidence.find(e => e.id === c.id)?.presentations?.some(p => p.target === selected) ? `<button class="secondary" data-present="${esc(c.id)}">Present this evidence</button>` : ""}</article>`).join("")}</div>`
        : '<p class="empty-note">No evidence logged yet. Investigate the scene to begin.</p>'
      : tab === "log"
        ? logs
            .map(
              (l, i) =>
                `<article class="log-item"><span class="micro gold">ENTRY ${String(i + 1).padStart(2, "0")}</span><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></article>`,
            )
            .join("") ||
          '<p class="empty-note">Your notes will appear here.</p>'
        : (ui.procedure || [])
            .map(
              (p) =>
                `<div class="log-item"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`,
            )
            .join("");
  openModal(
    `<h2 class="modal-title" id="modal-title">The case notebook.</h2><p class="modal-intro">${esc(ui.notebookIntro || definition.title)}</p><nav class="tabs" aria-label="Notebook sections"><button data-tab="evidence" class="${tab === "evidence" ? "active" : ""}">EVIDENCE / ${cards.length}</button><button data-tab="log" class="${tab === "log" ? "active" : ""}">FIELD NOTES</button><button data-tab="procedure" class="${tab === "procedure" ? "active" : ""}">PROCEDURE</button>${definition.quests?.length ? `<button data-tab="patrol" class="${tab === "patrol" ? "active" : ""}">OPTIONAL WORK</button>` : ""}<button id="notebook-inventory">INVENTORY</button></nav>${content}`,
    ui.officerLabel || "PERSONAL CASE NOTEBOOK",
  );
  $$("[data-tab]").forEach(
    (b) => (b.onclick = () => showNotebook(b.dataset.tab)),
  );
  $("#notebook-inventory").onclick = showInventory;
  $$("[data-present]").forEach(
    (b) =>
      (b.onclick = () => {
        closeModal();
        finishAction(() =>
          adventure.presentEvidence(state, b.dataset.present, selected),
        );
      }),
  );
  $$("[data-quest-lead]").forEach(button => {
    button.onclick = () => {
      const target = questDestination(definition, state, button.dataset.questLead);
      if (!target || !begun) { showNotebook("patrol"); return; }
      closeModal();
      selectedItem = null;
      backToScene();
      selectTarget(target, true);
    };
  });
  $$("[data-tab]").forEach(button => button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false"));
  modalKind = "notebook";
}
function showMap() {
  const available = areas.filter(a => !a.when || adventure.condition(state, a.when));
  openModal(`<h2 id="modal-title" class="modal-title">Follow the case.</h2><p class="modal-intro">Choose a location. Your investigation picks up where you left it.</p><div class="action-list location-choices">${available.map(a => `<button data-travel="${esc(a.id)}" ${a.id === area ? 'aria-current="location"' : ''}><span>${esc(a.shortName || a.name || a.title)}</span><small>${a.id === area ? 'YOU ARE HERE · ' : ''}${esc(a.description || a.subtitle || '')}</small></button>`).join('')}</div>${begun ? `<h3>At this location</h3><div class="target-list">${targets()}</div>` : ''}`, "BELLWETHER / LOCATIONS");
  modalKind = "map";
  $$('[data-travel]').forEach(b => b.onclick = () => { closeModal(); travel(b.dataset.travel); });
  $$('#modal [data-target]').forEach(b => b.onclick = () => { closeModal(); backToScene(); selectTarget(b.dataset.target, true); });
  addPausedSequences($('#modal-content'));
}
function showPause() {
  if (!scene) return;
  scene.game.pauseOverlay = false;
  scene.game.pause("player");
  ownsPause = true;
  openModal(`<h2 id="modal-title" class="modal-title">Take a breath.</h2><p class="modal-intro">${esc(objective(state).title)}<br><span class="small-note">${esc($('#save-status').textContent)}</span></p><div class="action-list pause-choices"><button id="pause-resume">Resume investigation</button><button id="pause-map">Locations</button><button id="pause-lead">Review your next lead</button><button id="pause-controls">Controller & controls</button><button id="pause-sound">Sound <strong>${scene.game.settings.sound ? 'on' : 'off'}</strong></button><button id="pause-motion">Reduced motion <strong>${scene.game.settings.motion ? 'on' : 'off'}</strong></button><button id="pause-fullscreen">${document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen'}</button><button id="pause-about">Case library, saves & credits</button><button id="pause-bindings">Keyboard bindings</button></div>`, "LAST WATCH / PAUSED");
  modalKind = "pause";
  $('#pause-resume').onclick = closeModal;
  $('#pause-map').onclick = showMap;
  $('#pause-lead').onclick = showHint;
  $('#pause-controls').onclick = showHelp;
  $('#pause-sound').onclick = () => { $('#audio').click(); showPause(); $('#pause-sound').focus(); };
  $('#pause-motion').onclick = () => { scene.game.settings.set('motion', !scene.game.settings.motion); showPause(); $('#pause-motion').focus(); };
  $('#pause-fullscreen').onclick = () => { scene.game.fullscreen.toggle(); };
  $('#pause-about').onclick = showAbout;
  $('#pause-bindings').onclick = () => { closeModal(); advancedControls = true; scene.game.menu('controls'); focusAdapter?.refresh(); };
  if (!scene.game.audio.ready && scene.game.settings.sound) {
    $('#pause-sound').insertAdjacentHTML('beforeend', '<small>Click or press a keyboard key once to enable browser audio.</small>');
  }
  if (state.completed) {
    const review = document.createElement('button');
    review.id = 'pause-debrief'; review.textContent = 'Review case debrief'; review.onclick = showEnding;
    $('.pause-choices').insertBefore(review, $('#pause-map'));
  }
  if (definition.quests?.length) {
    const patrol = document.createElement('button');
    patrol.id = 'pause-patrol'; patrol.textContent = 'Optional work and follow-ups';
    patrol.onclick = () => showNotebook('patrol');
    $('.pause-choices').insertBefore(patrol, $('#pause-controls'));
  }
  addPausedSequences($('.pause-choices'));
}
function showHelp() {
  openModal(
    `<h2 id="modal-title" class="modal-title">Your watch. Your pace.</h2><p class="modal-intro">Play from the couch. Select a point of interest and press Cross to approach it automatically. Every action uses the tools you need; you can also open your kit.</p><dl class="control-grid"><dt>DUALSENSE / PS5</dt><dd>Left stick walks. L1 / R1 selects a point of interest. ✕ Cross approaches / confirms. ○ Circle returns or cancels an approach. □ Square opens your kit. △ Triangle opens your notebook. Touchpad opens locations. Options pauses.</dd><dt>IN MENUS</dt><dd>D-pad or left stick selects. Cross confirms. Circle returns. Right stick scrolls long text. L1 / R1 switches notebook sections. Hold R2 in the scene to reveal every marker.</dd><dt>KEYBOARD</dt><dd>WASD or arrows walk. ${esc(scene?.game.input.label("interact", "keyboard") || "E")} investigates. Q / R selects a point of interest. Enter confirms, arrows select. J notebook · I kit · M locations · H markers · Escape back / pause.</dd><dt>MOUSE / TOUCH</dt><dd>Tap a scene marker to approach, or the ground to walk. Use the large interaction prompt and overlay buttons. Swipe menus to scroll. Portrait and landscape adapt automatically.</dd><dt>DISPLAY & SAVING</dt><dd>Options includes fullscreen, sound and reduced motion. Some browsers require a click or tap to enter fullscreen. Progress saves locally; export and import are under Case library, saves & credits.</dd></dl><button id="help-done" class="primary"><span>Return to the scene</span><span>→</span></button>`,
    "FIELD GUIDE / CONTROLS",
  );
  $("#help-done").onclick = closeModal;
}
function showHint() {
  const o = objective(state);
  openModal(
    `<h2 class="modal-title" id="modal-title">A fresh set of eyes.</h2><p class="modal-intro">${esc(o.title)}</p><div class="result-message"><span class="speaker">YOUR NEXT LEAD</span><p>${esc(o.detail)}</p></div><p class="modal-intro">Disabled actions explain what is missing. Revisit the notebook before making a conclusion.</p><button id="hint-done" class="primary"><span>Back to work</span><span>→</span></button>`,
    "OPTIONAL ASSIST / NO SCORE PENALTY",
  );
  $("#hint-done").onclick = closeModal;
}
function showAbout() {
  openModal(
    `<h2 class="modal-title" id="modal-title">Last Watch: ${esc(definition.title)}</h2><p class="modal-intro">An original procedural adventure about patience, observation and the weight of a good report. ${definition.example ? "This short case demonstrates the authoring toolkit; it is not a second polished production chapter." : "All characters, locations, writing and scene artwork are original."}</p><div class="modal-actions"><button id="choose-case" class="secondary">Case library</button><button id="manage-saves" class="secondary">Manage saves</button><a class="secondary" href="docs/DESIGNER_GUIDE.md" target="_blank">Designer guide ↗</a></div><p class="small-note">Waiting gesture: CMU Graphics Lab Motion Capture Database · NSF EIA-0196217. Selected take 141_20, free for use, modification and redistribution.</p><h3>Research & inspiration</h3><ul class="reference-list"><li><a href="https://gamerwalkthroughs.com/police-quest-pursuit-of-the-death-angel/" target="_blank" rel="noopener">Police Quest I — complete guide</a></li><li><a href="https://www.walkthroughking.com/text/policequest2.aspx" target="_blank" rel="noopener">Police Quest II — complete guide</a></li><li><a href="https://www.walkthroughking.com/text/policequest3.aspx" target="_blank" rel="noopener">Police Quest III — complete guide</a></li></ul><table class="reference-table"><tr><td>Initial Date</td><td>2026-10-13</td></tr><tr><td>SOURCE</td><td>Police Quest Series 1–3 for PC</td></tr><tr><td>GAME ENGINE</td><td><a href="https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff" target="_blank" rel="noopener">my-3D2dge v0.34.0</a> · Michael Crosato · MIT</td></tr><tr><td>Environment</td><td>Codex desktop; managed Linux; Bash, Node.js 24; Chromium testing.</td></tr><tr><td>Model and Effort Level</td><td>Exact model variant and configured effort not independently exposed; not claimed.</td></tr></table><p class="small-note">FICTIONAL CASES. NOT AFFILIATED WITH SIERRA. NOT REAL-WORLD TRAINING.<br><a href="ENGINE-LICENSE.txt" target="_blank">ENGINE MIT LICENSE</a></p><div class="modal-actions"><button id="restart" class="secondary danger">Start a fresh case</button><button id="about-done" class="secondary">Return to game</button></div>`,
    "CASE NOTES / LAST WATCH 2.1",
  );
  $("#about-done").onclick = closeModal;
  $("#restart").onclick = confirmRestart;
  $("#choose-case").onclick = showCases;
  $("#manage-saves").onclick = showSaves;
}
function showCases() {
  openModal(
    `<h2 id="modal-title" class="modal-title">Case library.</h2><div class="action-list">${cases.map((c) => `<button data-case="${esc(c.id)}">${esc(c.title)}<small>${c.example ? "SHORT AUTHORING EXAMPLE" : "COMPLETE INVESTIGATION"}${c.id === definition.id ? " · CURRENT" : ""}</small></button>`).join("")}</div><p class="small-note">Each case keeps its own progress.</p>`,
  );
  $$("[data-case]").forEach(
    (b) =>
      (b.onclick = () => {
        save();
        const u = new URL(location);
        u.searchParams.set("case", b.dataset.case);
        location.href = u;
      }),
  );
}
function download(text, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function showSaves() {
  openModal(
    `<h2 id="modal-title" class="modal-title">Manage this case save.</h2><p class="modal-intro">Export a copy before changing content or moving browsers. Imports are validated before replacing this case.</p><div class="modal-actions"><button id="export-save" class="secondary">Export save</button><button id="show-recovery" class="secondary">Recovery status</button></div><label for="save-json">Paste an exported save</label><textarea id="save-json" rows="7" spellcheck="false"></textarea><button id="import-save" class="primary"><span>Validate & import</span><span>→</span></button><p id="import-feedback" role="status"></p>`,
  );
  $("#export-save").onclick = () =>
    download(saves.exportSave(session()), `${definition.id}-save.json`);
  $("#show-recovery").onclick = () => showRecovery(saves.getRecovery());
  $("#import-save").onclick = () => {
    const r = saves.importSave($("#save-json").value);
    if (!r.ok) {
      $("#import-feedback").textContent = r.error;
      return;
    }
    applySession(r.session);
    closeModal();
    toast("Validated save imported.");
  };
}
function applySession(next) {
  sequenceCueKey = ""; sequenceRemaining = 0; sequenceMoving = false; sequenceLastTime = 0;
  state = next.state;
  begun = next.begun;
  area = next.area;
  selected = null;
  lastResult = null;
  endShown = !!state.completed;
  scene?.setState(state);
  setAreaDisplay(area);
  render();
}
function setAreaDisplay(next) {
  const a = areas.find((a) => a.id === next) || areas[0];
  area = a.id;
  state.area = area;
  if (selected && HOTSPOTS.find(h => h.id === selected)?.area !== area) selected = null;
  scene?.setArea(area);
  $("#location-name").textContent = a.name || a.title || a.id;
  $("#area-title").textContent = a.title || a.name || a.id;
  $("#area-sub").textContent = a.description || a.subtitle || "";
  $$("[data-area]").forEach((b) => {
    b.classList.toggle("active", b.dataset.area === area);
    b.setAttribute(
      "aria-current",
      b.dataset.area === area ? "location" : "false",
    );
  });
}
function showRecovery(recovery) {
  if (!recovery) {
    toast("No incompatible save is waiting for recovery.");
    return;
  }
  $("#save-status").textContent = "SAVE HELD · ORIGINAL PRESERVED";
  openModal(
    `<h2 id="modal-title" class="modal-title">Your saved case needs attention.</h2><p class="modal-intro">${esc(recovery.message || recovery.reason || "This save uses unsupported or invalid content.")}</p><p class="modal-intro">The original is preserved and automatic saving is paused. Export it to inspect or recover it, keep it untouched, retry with this version, or start fresh while preserving a backup.</p><div class="modal-actions"><button id="export-recovery" class="secondary">Export preserved original</button><button id="keep-recovery" class="secondary">Keep original</button><button id="retry-recovery" class="secondary">Retry restore</button><button id="reset-recovery" class="secondary">Back up & start fresh</button></div><p id="recovery-feedback" role="status"></p>`,
    "SAVE RECOVERY",
  );
  $("#export-recovery").onclick = () =>
    download(
      typeof recovery.original === "string"
        ? recovery.original
        : JSON.stringify(recovery.original, null, 2),
      `${definition.id}-preserved-original.${typeof recovery.original === "string" ? "txt" : "json"}`,
    );
  $("#keep-recovery").onclick = () => {
    saves.resolveRecovery("keep");
    closeModal();
  };
  const resolve = (choice) => {
    const r = saves.resolveRecovery(choice);
    if (!r.ok) {
      $("#recovery-feedback").textContent =
        r.error || "The original is still preserved.";
      return;
    }
    applySession(r.session);
    save();
    closeModal();
    toast(
      choice === "reset"
        ? "Original backed up. A fresh case is ready."
        : "Saved case restored.",
    );
  };
  $("#retry-recovery").onclick = () => resolve("retry");
  $("#reset-recovery").onclick = () => resolve("reset");
}
function confirmRestart() {
  openModal(
    `<h2 id="modal-title" class="modal-title">Start a fresh watch?</h2><p class="modal-intro">This replaces the current case in this browser. Export it first if you want to keep your progress.</p><div class="modal-actions"><button class="secondary" id="keep-case">Keep this case</button><button class="primary" id="new-case"><span>Start fresh</span><span>→</span></button></div>`,
  );
  $("#keep-case").onclick = closeModal;
  $("#new-case").onclick = () => {
    state = adventure.freshCase();
    begun = false;
    endShown = false;
    selected = null;
    lastResult = null;
    setAreaDisplay(definition.startArea);
    save();
    render();
    closeModal();
    toast("A new case is ready.");
  };
}
function showEnding() {
  const s = caseSummary(state),
    count = $(".progress-track").children.length;
  openModal(
    `<span class="badge-large">SHIFT COMPLETE / CASE CLOSED</span><h2 class="modal-title" id="modal-title" style="margin-top:18px">${esc(s.title || ui.endingTitle || "The morning has a chance.")}</h2><p class="modal-intro">${esc(s.ending)}</p><div class="score-total">${s.score}<small> / ${definition.maxScore || 100}</small></div><span class="micro gold">${esc(s.rating)}</span><div class="score-grid"><div><strong>${s.evidenceCount}</strong><span>Exhibits logged</span></div><div><strong>${s.mistakes?.length || 0}</strong><span>Procedure notes</span></div><div><strong>${String(count).padStart(2, "0")} / ${String(count).padStart(2, "0")}</strong><span>Case stages</span></div></div>${(s.findings || []).map((f) => `<div class="log-item"><p>${esc(f)}</p></div>`).join("")}${s.mistakes?.length ? `<h3>For your next watch</h3>${s.mistakes.map((m) => `<p class="modal-intro">${esc(m.text)} <span class="gold">−${m.penalty}</span></p>`).join("")}` : '<p class="modal-intro">Every step documented. Every person heard.</p>'}<div class="modal-actions"><button class="secondary" id="ending-notes">Read case notebook</button><button class="primary" id="ending-return"><span>Return to the scene</span><span>→</span></button></div>`,
    ui.debriefKicker || "SUPERVISOR DEBRIEF",
  );
  $("#ending-notes").onclick = () => showNotebook();
  $("#ending-return").onclick = closeModal;
}
$("#highlight").onclick = () => {
  highlighted = !highlighted;
  scene?.setHighlight(highlighted);
  $("#highlight").setAttribute("aria-pressed", String(highlighted));
};
$("#mobile-begin").onclick = () => $("#begin")?.click();
$("#notebook").onclick = () => showNotebook();
$("#help").onclick = showHelp;
$("#hint").onclick = showHint;
$("#about").onclick = showAbout;
$("#brand").onclick = (ev) => {
  ev.preventDefault();
  showAbout();
};
$("#fullscreen").onclick = () => scene?.game.fullscreen.toggle();
$("#settings").onclick = showPause;
$("#audio").onclick = () => {
  const g = scene?.game;
  if (!g) return;
  const muted = g.settings.sound;
  g.settings.set("sound", !muted);
  $("#audio").textContent = muted ? "♩" : "♪";
  $("#audio").setAttribute(
    "aria-label",
    muted ? "Turn sound on" : "Mute sound",
  );
  toast(muted ? "Sound muted." : "Sound on.");
};
function activeControls() {
  const root = modal.open ? modal : $('#interaction');
  const all = [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea,select,summary')]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  // The primary action is always first; Back stays available at the end.
  return [...all.filter(el => !el.matches('#close-modal,.back-scene')), ...all.filter(el => el.matches('#close-modal,.back-scene'))];
}
function focusPrimary(force = false) {
  if (!modal.open && focus.worldEnabled()) return;
  const all = activeControls();
  if (!force && all.includes(document.activeElement)) return;
  const preferred = !modal.open && lastActionFocus ? all.find(el => el.dataset.action === lastActionFocus) : null;
  const first = preferred || all.find(el => el.matches('[data-action],[data-choice],#begin,#sequence-next')) || all[0];
  first?.focus({ preventScroll: true });
}
function moveFocus(dir) {
  const all = activeControls(), index = all.indexOf(document.activeElement);
  const next = index < 0 ? (dir < 0 ? all.length - 1 : 0) : (index + dir + all.length) % all.length;
  all[next]?.focus({ preventScroll: true });
  all[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function returnControl() {
  if (modal.open) closeModal();
  else if ($('#sequence-cancel')) $('#sequence-cancel').click();
  else if ($('#close-activity')) $('#close-activity').click();
  else if (selected) backToScene();
  else if (scene?.getWalkState()) { scene.cancelWalk('player-canceled'); toast('Approach canceled.'); }
  else if (selectedItem) { selectedItem = null; render(); }
}
function deviceChanged(device) {
  if (inputDevice === device) return;
  inputDevice = device;
  document.body.dataset.device = device;
  lastUIKey = '';
}
function updateHUD() {
  if (!$('#world-prompt')) return;
  const target = scene?.getTarget(), walking = scene?.getWalkState();
  const world = begun && !selected && !state.activeSequence && !state.activeConversation && !state.activePuzzle && !modal.open;
  const prompt = $('#world-prompt');
  const keyboard = inputDevice === 'keyboard';
  const interact = keyboard ? scene?.game.input.label('interact', 'keyboard') || 'E' : '✕';
  const name = walking ? `Approaching ${target?.name || 'point of interest'}` : target?.name || 'Explore the scene';
  const verb = target?.type === 'person' ? 'Talk' : 'Investigate';
  const key = JSON.stringify([world, name, !!walking, inputDevice, interact, modalKind, document.body.dataset.mode, selectedItem]);
  if (key === lastUIKey) return;
  lastUIKey = key;
  prompt.hidden = !world;
  prompt.disabled = !target || !!walking;
  prompt.innerHTML = `${glyph(walking ? '…' : interact)}<span><small>${walking ? (keyboard ? 'ESC TO CANCEL' : '○ CANCEL APPROACH') : selectedItem ? 'USE ' + esc(itemName(selectedItem)).toUpperCase() : verb.toUpperCase()}</small><strong>${esc(name)}</strong></span>`;
  const legend = modal.open || !world
    ? `${glyph(keyboard ? '↑↓' : 'D-pad')} Select ${glyph(keyboard ? 'Enter' : '✕')} Confirm ${glyph(keyboard ? 'Esc' : '○')} Back <span>${glyph(keyboard ? 'PgDn' : 'R stick')} Scroll</span>`
    : `${glyph(keyboard ? 'WASD' : 'L stick')} Walk ${glyph(keyboard ? 'Q / R' : 'L1 / R1')} Select ${glyph(keyboard ? 'H' : 'R2')} Reveal`;
  $('#controller-legend').innerHTML = legend;
  $('#control-hint').textContent = keyboard ? `WASD WALK · ${interact} INVESTIGATE · M LOCATIONS` : 'LEFT STICK WALK · ✕ INVESTIGATE · L1 / R1 SELECT';
  $('#map-button .pad-glyph').textContent = keyboard ? 'M' : '▭';
  $('#quick-inventory .pad-glyph').textContent = keyboard ? 'I' : '□';
  $('#quick-notebook .pad-glyph').textContent = keyboard ? 'J' : '△';
  $('#quick-options .pad-glyph').textContent = keyboard ? 'Esc' : '☰';
}
let advancedControls = false;
window.addEventListener('pointerdown', ev => deviceChanged(ev.pointerType === 'touch' ? 'touch' : 'mouse'), { passive: true });
window.addEventListener('keydown', ev => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  deviceChanged('keyboard');
  if (advancedControls) return;
  const editing = document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  if (editing && ev.key !== 'Escape') return;
  const key = ev.key.toLowerCase();
  // A saved keyboard binding takes priority over optional shell shortcuts.
  if (!modal.open && focus.worldEnabled() && scene?.game.input.map.interact?.includes(ev.code)) return;
  let handled = true;
  if (key === 'escape') {
    if (modal.open || !focus.worldEnabled() || scene?.getWalkState() || selectedItem) returnControl();
    else showPause();
  } else if ((modal.open || !focus.worldEnabled()) && ['arrowdown','arrowup','arrowleft','arrowright'].includes(key)) {
    moveFocus(['arrowup','arrowleft'].includes(key) ? -1 : 1);
  } else if ((modal.open || !focus.worldEnabled()) && ['enter',' '].includes(key)) {
    if (!ev.repeat) { focusPrimary(); document.activeElement?.click(); }
  } else if (ev.repeat || modal.open) handled = false;
  else if (key === 'j') showNotebook();
  else if (key === 'i') showInventory();
  else if (key === 'm') showMap();
  else if (key === 'h') $('#highlight').click();
  else if (focus.worldEnabled() && ['q','r'].includes(key)) scene?.cycleTarget(key === 'q' ? -1 : 1);
  else if (/^[1-9]$/.test(key) && areas[Number(key)-1]) travel(areas[Number(key)-1].id);
  else handled = false;
  if (handled) { ev.preventDefault(); ev.stopImmediatePropagation(); updateHUD(); }
}, true);
let padPrev = [], navHeld = 0, navTime = 0, revealHeld = false, wasPaused = false;
function controllerUI(now) {
  updatePresentation(now);
  if (wasPaused && !scene?.game.paused) { advancedControls = false; syncFocus(); }
  wasPaused = !!scene?.game.paused;
  if (scene?.game.paused && !ownsPause && !advancedControls) showPause();
  const pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected !== false && p);
  if (pad) {
    const pressed = i => pad.buttons[i]?.pressed && !padPrev[i];
    if (pad.buttons.some(b => b.pressed) || pad.axes.some(a => Math.abs(a) > .25)) deviceChanged('gamepad');
    if (advancedControls) {
      if (pressed(9)) { scene.game.resume(); advancedControls = false; syncFocus(); }
    } else if (pressed(9)) {
      if (ownsPause) closeModal(); else showPause();
    } else if (pressed(1)) returnControl();
    else if (pressed(17) || pressed(8)) modal.open && modalKind === 'map' ? closeModal() : showMap();
    else if (pressed(3)) modal.open && modalKind === 'notebook' ? closeModal() : showNotebook();
    else if (pressed(2)) modal.open && modalKind === 'inventory' ? closeModal() : showInventory();
    else if (modal.open || !focus.worldEnabled()) {
      const dir = pad.buttons[13]?.pressed || pad.buttons[15]?.pressed || pad.axes[1] > .5 || pad.axes[0] > .5 ? 1
        : pad.buttons[12]?.pressed || pad.buttons[14]?.pressed || pad.axes[1] < -.5 || pad.axes[0] < -.5 ? -1 : 0;
      if (dir && (dir !== navHeld || now - navTime > 260)) { moveFocus(dir); navTime = now; }
      navHeld = dir;
      if (pressed(0)) { focusPrimary(); document.activeElement?.click(); }
      if (modalKind === 'notebook' && (pressed(4) || pressed(5))) {
        const tabs = notebookTabs();
        showNotebook(tabs[(tabs.indexOf(notebookTab) + (pressed(4) ? tabs.length - 1 : 1)) % tabs.length]);
      }
      if (Math.abs(pad.axes[3] || 0) > .2) {
        const root = modal.open ? modal : $('#interaction');
        root.scrollTop += pad.axes[3] * 14;
      }
    } else {
      navHeld = 0;
      if (pressed(4) || pressed(5)) scene?.cycleTarget(pressed(4) ? -1 : 1);
      if (pressed(0)) scene?.interactTarget();
    }
    const reveal = !!pad.buttons[7]?.pressed;
    if (reveal !== revealHeld) { revealHeld = reveal; scene?.setHighlight(highlighted || reveal); }
  } else if (revealHeld) { revealHeld = false; scene?.setHighlight(highlighted); }
  padPrev = pad ? pad.buttons.map(b => b.pressed) : [];
  updateHUD();
  requestAnimationFrame(controllerUI);
}
configureShell();
setAreaDisplay(area);
render();
try {
  scene = createScene({
    definition,
    onSelect: (id) => selectTarget(id),
    onNotice: (notice) => {
      if (typeof notice === "string") toast(notice);
      else if (/cancel|replaced|area.change|stale/.test(notice.code || "")) return;
      else if (
        notice.code === "unreachable" ||
        notice.type === "error" ||
        notice.message
      )
        toast(
          notice.message ||
            "That point cannot be reached. Choose another approach.",
        );
    },
    onReady: () => $("#scene-loading").classList.add("hidden"),
  });
  scene.game.pauseOverlay = false;
  scene.setArea(area);
  scene.setState(state);
  scene.setHighlight(highlighted);
  focusAdapter = createDOMFocusAdapter({
    focus,
    modal,
    worldRoot: $("#viewport"),
    actionRoot: $("#interaction"),
    getEnginePaused: () => !!scene?.game.paused && !ownsPause,
    onEscape: () => {
      if (modal.open) closeModal();
      else if ($("#sequence-cancel")) $("#sequence-cancel").click();
      else if ($("#close-activity")) $("#close-activity").click();
      else backToScene();
      return true;
    },
  });
  sequenceCueKey = "";
  render();
  $("#audio").textContent = scene.game.settings.sound ? "♪" : "♩";
  $("#scene-loading").classList.add("hidden");
  window.lastWatch = {
    scene,
    definition,
    adventure,
    saves,
    focus,
    get state() {
      return state;
    },
    snapshot: () => ({
      area,
      selected,
      begun,
      focusedTarget: scene?.getTarget()?.id || null,
      mode: document.body.dataset.mode,
      state: JSON.parse(JSON.stringify(state)),
      errors: scene.game.errors,
    }),
    selectTarget,
    travel,
  };
  if (development) {
    const { installInspector } = await import("./dev/inspector.js");
    installInspector({
      definition,
      adventure,
      scene,
      saves,
      getSession: session,
      setSession: applySession,
      onChange: () => {
        save();
        render();
      },
    });
  }
  requestAnimationFrame(controllerUI);
  if (loaded.recovery) showRecovery(loaded.recovery);
  else if (loaded.migrated)
    toast("Your existing case has been safely upgraded.");
} catch (error) {
  $("#scene-loading").innerHTML =
    `<span class="loading-mark">LW</span><p>The scene could not start.</p><p>${esc(error.message)}</p><button class="secondary" onclick="location.reload()">Try again</button>`;
  console.error(error);
}
