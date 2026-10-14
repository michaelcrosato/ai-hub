import { Simulation } from "../runtime/simulation.mjs";
import {
  engineAdapter,
  drivingInput,
  pointerButtons,
} from "../engine/adapter.mjs";
import { captureWorldPhoto } from "../runtime/evidence.mjs";
import { readSave, writeSave } from "../runtime/saves.mjs";
import { SceneRenderer } from "../presentation/scene.mjs";
import { hash } from "../runtime/state.mjs";

const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const INPUT = {
  up: ["KeyW", "ArrowUp", "Pad12"],
  down: ["KeyS", "ArrowDown", "Pad13"],
  left: ["KeyA", "ArrowLeft", "Pad14"],
  right: ["KeyD", "ArrowRight", "Pad15"],
  interact: ["KeyE", "Pad0"],
  vehicle: ["KeyF", "Pad3"],
  sprint: ["ShiftLeft", "Pad10"],
  tools: ["KeyQ", "Pad4"],
  radio: ["KeyR", "Pad5"],
  notebook: ["Tab", "Pad8", "Pad17"],
  siren: ["KeyH", "Pad2"],
  accelerate: ["KeyW", "ArrowUp", "Pad7"],
  brake: ["KeyS", "ArrowDown", "Space", "Pad6"],
  start: ["Enter", "Pad9"],
  confirm: ["Enter", "Space", "Pad0"],
  cancel: ["Backspace", "Pad1"],
  pause: ["Escape", "KeyP", "Pad9"],
  cycle: ["KeyC", "Pad11"],
  aim: ["Mouse2", "Pad6"],
  fire: ["Mouse0", "Pad7"],
  reload: ["KeyX", "Pad2"],
  equip: ["KeyG"],
  control: ["KeyZ", "Pad1"],
};

export class GameApp {
  constructor(definition, { registry, cases, assets = {}, hooks = {} } = {}) {
    this.definition = definition;
    this.registry = registry;
    this.cases = cases;
    this.assets = assets;
    this.hooks = hooks;
    this.storage = {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    };
    this.key = `last-light:case:${definition.id}:v2`;
    this.panel = null;
    this.activePointers = new Map();
    this.started = false;
    this.saveT = 0;
    this.hudT = 0;
    this.clickTarget = null;
    this.lastEvent = 0;
    this.radioT = 0;
    this.ambientTimes = {};
    this.cameraBeforeCue = null;
    const params = new URLSearchParams(location.search);
    this.developer = params.get("dev") === "1";
    this.seed = Number(params.get("seed")) || 1;
    this.game = new My3D2dge.Game({
      canvas: "screen",
      id: "last-light",
      res: [640, 380],
      expand: true,
      view: "iso",
      views: ["iso"],
      input: INPUT,
      corner: false,
      menu: {
        quit: "title",
        items: [
          ["Restart case", () => this.restart()],
          [
            "Case notebook",
            () => {
              this.game.resume();
              this.shell.hide();
              this.notebook();
            },
          ],
        ],
        controls: {
          interact: "Interact / select",
          vehicle: "Enter / leave vehicle",
          sprint: "Run",
          tools: "Field tools",
          radio: "Radio dispatch",
          notebook: "Case notebook",
          siren: "Warning lights",
          accelerate: "Accelerate",
          brake: "Brake / reverse",
          cycle: "Cycle nearby targets",
          equip: "Equip / holster",
          aim: "Aim",
          fire: "Fire",
          reload: "Reload",
        },
        settings: [
          { key: "hints", label: "Objective markers", value: true },
          { key: "ambience", label: "Ambient sound", value: true },
          {
            key: "captionTime",
            label: "Radio caption duration",
            type: "select",
            options: [
              [7, "Standard"],
              [12, "Extended"],
            ],
            value: 7,
          },
        ],
      },
    });
    this.releasePointerButtons = pointerButtons(this.game.input, $("screen"));
    this.shell = new My3D2dge.Shell(this.game, {
      theme: {
        ink: "#eee6cf",
        paper: "#17343b",
        accent: "#e2bc7d",
        muted: "#acbdad",
        danger: "#d58b72",
        line: "#b6c2a93b",
        font: "'Trebuchet MS',Arial,sans-serif",
        titleFont: "Georgia,serif",
      },
      meters: 0.15,
    });
    this.presentedOutcome = null;
    this.init();
    this.bind();
    const fade = document.createElement("div");
    fade.id = "scene-fade";
    fade.setAttribute("aria-hidden", "true");
    document.body.append(fade);
    this.game.debug = { snapshot: () => this.snapshot() };
    window.HarborGame = this.game;
    window.ToolkitApp = this;
    this.game.stateHash = () => [
      hash(
        JSON.parse(
          JSON.stringify(
            { ...this.sim.state, checkpoints: {}, commandLog: [] },
            (key, value) =>
              typeof value === "string" && value.startsWith("data:image/")
                ? "[captured image]"
                : value,
          ),
        ),
      ),
    ];
    this.game.start({
      scene: "title",
      scenes: {
        title: {
          pausable: false,
          camera: { zoom: [0.8, 2], start: 1.2, tall: 1.4 },
          touch: [],
          enter: () => this.title(),
          update: (dt) => {
            this.renderer.update(dt);
            if (this.panel) this.panelInput();
            else if (
              this.game.input.pressed("start") ||
              this.game.input.pressed("confirm")
            )
              this.start(false);
          },
          draw: (r) => this.renderer.draw(r, { title: true }),
        },
        play: {
          pausable: true,
          camera: { zoom: [0.75, 2], start: 1.05, tall: 1.6 },
          touch: [
            "interact",
            "vehicle",
            "sprint",
            "tools",
            "notebook",
            "cycle",
            "cancel",
            "aim",
            "fire",
            "control",
          ],
          enter: () => {
            this.game.input.clear();
            this.hud();
          },
          back: () => {
            if (this.panel) {
              this.cancelPanel();
              return true;
            }
            if (this.sim.state.activeAction || this.sim.state.cue) {
              this.sim.command("interaction.cancel");
              this.sim.command("cue.cancel");
              return true;
            }
            return false;
          },
          update: (dt) => this.update(dt),
          draw: (r) => this.renderer.draw(r),
        },
      },
    });
    $("loading").hidden = true;
    if (this.developer) this.installDeveloperPanel();
  }
  init(saved) {
    this.cameraBeforeCue = null;
    this.cueZoomApplied = null;
    this.radioT = 0;
    this.ambientTimes = {};
    this.sim = new Simulation(this.definition, engineAdapter(My3D2dge), saved, {
      seed: this.seed,
      game: this.game,
      assets: this.assets,
      hooks: this.hooks,
    });
    this.renderer = new SceneRenderer(this.game, this.sim);
    this.lastEvent = this.sim.state.events.length;
    this.presentedOutcome = null;
    this.initialState = this.sim.runtime.serialize();
    this.game.lights.enabled = true;
    this.game.lights.ambient = 0.86;
    this.game.lights.tint = "#1c4259";
    this.game.focus(this.sim.state.player.x, this.sim.state.player.y, 12);
  }
  bind() {
    document.addEventListener(
      "pointerdown",
      (event) => {
        this.activePointers.set(event.pointerId, event.pointerType);
        this.lastPointerId = event.pointerId;
        this.lastPointerType = event.pointerType;
        if (this.panel) {
          this.panel.blockedPointers?.delete(event.pointerId);
          this.panel.blockCompatibilityClick = false;
        }
      },
      true,
    );
    for (const type of ["pointerup", "pointercancel"])
      document.addEventListener(
        type,
        (event) => this.activePointers.delete(event.pointerId),
        true,
      );
    $("begin").onclick = () => this.start(false);
    $("continue").onclick = () => this.start(true);
    $("notebook-button").onclick = () => this.notebook();
    $("pause-button").onclick = () => {
      this.save();
      this.game.pause("Paused");
    };
    $("fullscreen-button").onclick = () => this.game.fullscreen.toggle();
    $("dialog-close").onclick = () => this.cancelPanel();
    $("title-settings").onclick = () => this.game.menu("settings");
    $("how-to").onclick = () => this.help();
    $("about").onclick = () => this.about();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.started) this.save();
    });
    window.addEventListener("pagehide", () => {
      if (this.started) this.save();
    });
    $("title-screen").querySelector(".case-strip strong").textContent =
      this.definition.title;
    $("title-screen").querySelector(".case-strip > span").textContent =
      this.definition.number || "—";
    if (this.definition.presentation?.timeLabel) {
      const label = $("title-screen").querySelector(".eyebrow");
      label.textContent = this.definition.presentation.timeLabel;
    }
    if (this.definition.presentation?.tagline)
      $("title-screen").querySelector(".tagline").textContent =
        this.definition.presentation.tagline;
    $("title-screen").querySelector(".title-footer > span").textContent =
      "SINGLE PLAYER / ORIGINAL CASES";
    if (this.registry?.cases.length > 1) {
      const selector = document.createElement("select");
      selector.id = "case-select";
      selector.setAttribute("aria-label", "Select assignment");
      selector.className = "case-select";
      for (const entry of this.registry.cases) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = this.cases[entry.id].title;
        option.selected = entry.id === this.definition.id;
        selector.append(option);
      }
      selector.onchange = () => {
        const url = new URL(location.href);
        url.searchParams.set("case", selector.value);
        location.href = url;
      };
      $("title-screen").querySelector(".title-actions").before(selector);
    }
  }
  title() {
    this.started = false;
    this.close();
    this.shell.hide();
    this.shell.hud({});
    $("title-screen").hidden = false;
    $("shift-bar").hidden = true;
    $("drive-hud").hidden = true;
    document.body.classList.add("at-title");
    $("continue").hidden = !this.saved();
    const stage = this.definition.presentation?.titleStage;
    if (stage) {
      Object.assign(this.sim.state.player, stage.player || {});
      for (const [id, values] of Object.entries(stage.entities || {}))
        Object.assign(this.sim.state.entities[id], values);
    }
    const focus =
      this.definition.presentation?.titleFocus || this.sim.state.player;
    this.game.focus(focus.x, focus.y, focus.z || 12);
  }
  start(resume) {
    this.close();
    this.shell.hide();
    this.game.resume();
    const saved = resume ? this.saved() : null;
    this.init(saved);
    this.started = true;
    $("title-screen").hidden = true;
    $("shift-bar").hidden = false;
    document.body.classList.remove("at-title");
    this.game.go("play");
    const music = this.assets.music?.[this.definition.presentation?.music];
    if (music) this.game.audio.music(music);
    const requested = new URLSearchParams(location.search).get("checkpoint");
    if (requested) this.command("checkpoint.restore", { id: requested });
    if (resume && this.sim.runtime.warnings.length)
      this.notice({
        ok: false,
        title: "Save restored with notes",
        text: this.sim.runtime.warnings.join(" "),
      });
    else if (!resume)
      this.open({
        title: this.definition.presentation?.title || this.definition.title,
        kicker: "NORTH HAVEN · ON DUTY",
        text: this.definition.description,
        choices: [{ label: "Step onto the beat", fn: () => this.close() }],
      });
    this.save();
    if (resume && this.sim.state.dialogue?.open) this.conversation();
  }
  restart() {
    this.open({
      kicker: "NEW SHIFT",
      title: "Start this case again?",
      text: "Your current progress for this case will be replaced.",
      choices: [
        { label: "Keep this shift", fn: () => this.close() },
        { label: "Begin a new shift", fn: () => this.start(false) },
      ],
    });
  }
  save() {
    if (!this.started) return;
    const result = writeSave(
      this.storage,
      this.key,
      this.sim.runtime.serialize(),
    );
    $("save-status").textContent = result.text;
    if (result.ok) this.lastSavedEvent = this.sim.state.events.length;
    this.saveT = 3;
  }
  saved() {
    return (
      readSave(this.storage, this.key).snapshot ||
      (this.definition.legacy?.storageKey
        ? readSave(this.storage, this.definition.legacy.storageKey).snapshot
        : null)
    );
  }
  notice(result) {
    if (!result) return;
    this.shell.toast(
      result.title || (result.ok ? "Recorded" : "A detail to resolve"),
      result.text || "",
      4,
    );
    this.game.audio.sfx(result.ok ? "confirm" : "cancel", { vol: 0.1 });
  }
  command(id, payload = {}) {
    const result = this.sim.command(id, payload);
    if (!result.ok) this.notice(result);
    else this.save();
    return result;
  }
  close() {
    this.panel = null;
    $("dialogue").hidden = true;
    document.body.classList.remove("modal-open");
    this.sim?.dialogue.close();
    this.game.input.consumeAll();
    this.game.audio.duck(false);
    this.sim.presentation.uiPanel = null;
    this.save();
  }
  cancelPanel() {
    this.sim.command("interaction.cancel");
    this.sim.command("cue.cancel");
    this.close();
  }
  open(spec) {
    this.panel = {
      ...spec,
      index: 0,
      blockedPointers: new Set(
        [...this.activePointers.keys(), this.lastPointerId].filter(
          (id) => id !== undefined,
        ),
      ),
      blockCompatibilityClick: this.lastPointerType === "touch",
    };
    this.sim.presentation.uiPanel = spec.kind;
    this.clickTarget = null;
    this.game.input.clear();
    this.game.audio.duck(true);
    $("dialog-kicker").textContent = spec.kicker || "FIELD RECORD";
    $("dialog-title").textContent = spec.title;
    $("dialog-content").innerHTML = spec.html || `<p>${escape(spec.text)}</p>`;
    $("dialog-choices").replaceChildren();
    for (const [index, choice] of spec.choices.entries()) {
      const button = document.createElement("button");
      button.className = "choice" + (index === 0 ? " selected" : "");
      button.disabled = !!choice.disabled;
      button.innerHTML = `<span class="num">${index + 1}</span><div><strong>${escape(choice.label)}</strong>${choice.hint ? `<small>${escape(choice.hint)}</small>` : ""}</div><span class="arrow">↗</span>`;
      button.onclick = (event) => {
        event.stopPropagation();
        if (
          this.panel?.blockedPointers?.has(event.pointerId) ||
          (!("pointerId" in event) && this.panel?.blockCompatibilityClick)
        )
          return;
        this.pick(index);
      };
      button.onpointerenter = () => {
        if (this.panel) {
          this.panel.index = index;
          this.selectChoice();
        }
      };
      $("dialog-choices").append(button);
    }
    $("dialogue").hidden = false;
    $("dialog-close").hidden = !!spec.locked;
    document.body.classList.add("modal-open");
  }
  selectChoice() {
    [...$("dialog-choices").children].forEach((el, i) =>
      el.classList.toggle("selected", i === this.panel?.index),
    );
  }
  pick(index) {
    const choice = this.panel?.choices[index];
    if (!choice || choice.disabled) return;
    this.game.input.consumeAll();
    choice.fn();
  }
  panelInput() {
    if (
      ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
    )
      return;
    const I = this.game.input;
    if (I.pressed("cancel") && !this.panel.locked) {
      this.cancelPanel();
      return;
    }
    const delta = I.repeat("down", 0.3, 0.15)
      ? 1
      : I.repeat("up", 0.3, 0.15)
        ? -1
        : 0;
    if (delta) {
      this.panel.index =
        (this.panel.index + delta + this.panel.choices.length) %
        this.panel.choices.length;
      this.selectChoice();
      $("dialog-choices").children[this.panel.index]?.scrollIntoView({
        block: "nearest",
      });
    }
    if (I.pressed("confirm") || I.pressed("interact"))
      this.pick(this.panel.index);
  }
  conversation() {
    const view = this.sim.dialogue.view();
    if (!view) {
      this.close();
      return;
    }
    this.open({
      kind: "dialogue",
      kicker: view.speaker?.label || "RADIO",
      title: view.title || view.speaker?.label || "Conversation",
      text: view.text,
      choices: view.choices.map((c) => ({
        label: c.label,
        hint: c.reasons.length ? c.reasons.join(". ") : c.hint,
        disabled: c.reasons.length > 0,
        fn: () => {
          const result = this.command("dialogue.choose", { id: c.id });
          if (result.ok) this.conversation();
        },
      })),
    });
  }
  evidence(id) {
    const spec = this.definition.evidence[id],
      entry = this.sim.state.evidence[id] || {},
      photos = entry.photos || [];
    if (["statement", "observation", "comparison"].includes(spec.kind)) {
      this.open({
        kind: "evidence",
        kicker: spec.kind.toUpperCase(),
        title: spec.title,
        text: spec.detail,
        choices: [{ label: "Return to the scene", fn: () => this.close() }],
      });
      return;
    }
    this.open({
      kind: "evidence",
      kicker: `FIELD EVIDENCE · ${spec.number || id}`,
      title: spec.title,
      html: `${photos.map((p) => `<figure class="evidence-photo"><img src="${escape(p.data)}" alt="Scene photograph of ${escape(spec.title)}"><figcaption>${escape(p.scene)} · ${Math.floor(p.time)}s · ${p.storage === "saved" ? "saved" : "current session"}</figcaption></figure>`).join("")}<p>${escape(spec.detail)}</p><div class="tags"><span class="tag done">OBSERVED</span><span class="tag ${photos.length ? "done" : ""}">${photos.length ? "IMAGE CAPTURED" : entry.legacyPhoto ? "LEGACY PHOTO UNAVAILABLE" : "NO PHOTOGRAPH"}</span><span class="tag ${entry.holder === "player" ? "done" : ""}">${entry.holder && entry.holder !== "scene" ? escape(entry.holder).toUpperCase() : "IN PLACE"}</span></div>`,
      choices: [
        {
          label: photos.length
            ? "Scene photograph attached"
            : "Photograph in place",
          disabled:
            photos.length > 0 || (entry.holder && entry.holder !== "scene"),
          hint: "Preserve the scene before collection.",
          fn: () => {
            const result = this.command("action.schedule", {
              action: `evidence:${id}:photo`,
              payload: {
                photo: captureWorldPhoto($("screen")),
                camera: {
                  x: this.sim.state.player.x,
                  y: this.sim.state.player.y,
                  zoom: this.game.view.zoom,
                },
              },
              after: { evidence: id },
            });
            if (result.ok) {
              this.game.audio.sfx({
                wave: "noise",
                freq: 1800,
                to: 300,
                dur: 0.07,
                vol: 0.12,
              });
              this.close();
            }
          },
        },
        {
          label:
            entry.holder === "player"
              ? "Exhibit secured"
              : "Bag, label, and log exhibit",
          disabled: !!entry.holder && entry.holder !== "scene",
          hint: photos.length
            ? "Photo attached."
            : "Collection remains possible with an omission recorded.",
          fn: () => {
            if (
              this.command("action.schedule", {
                action: `evidence:${id}:bag`,
                after: { evidence: id },
              }).ok
            )
              this.close();
          },
        },
        { label: "Return to the scene", fn: () => this.close() },
      ],
    });
  }
  interact() {
    const target = this.sim.interactions.selected();
    if (!target) return;
    const result = this.command("interaction.begin", { id: target.id });
    if (!result.ok) return;
    if (result.result?.dialogue) this.conversation();
    else if (result.result?.evidence) this.evidence(result.result.evidence);
    else if (result.result?.panel === "animations") this.animationCatalog();
  }
  notebook(tab = "case") {
    const r = this.sim.runtime,
      s = this.sim.state;
    let html;
    if (tab === "evidence")
      html = Object.entries(this.definition.evidence)
        .map(([id, e]) => {
          const item = s.evidence[id];
          return `<article class="ledger-item"><strong>${escape(e.number || id)} · ${escape(e.title)}</strong><p>${escape(item?.observed ? e.detail : "Not yet examined.")}</p>${(item?.photos || []).map((p) => `<img class="ledger-photo" src="${escape(p.data)}" alt="Photograph of ${escape(e.title)}">`).join("")}<small>${item?.legacyPhoto && !item?.photos.length ? "Legacy photograph unavailable. " : ""}${escape(item?.holder || "At scene")} · ${(item?.history || []).map((h) => `${h.operation} by ${h.handler} at ${Math.floor(h.time)}s`).join(" → ")}</small></article>`;
        })
        .join("");
    else if (tab === "log")
      html =
        s.events
          .slice()
          .reverse()
          .map(
            (e) =>
              `<article class="ledger-item"><time>${Math.floor(e.time / 60)}:${String(e.time % 60).padStart(2, "0")}</time><strong>${escape(e.title)}</strong><p>${escape(e.text)}</p></article>`,
          )
          .join("") || "<p>The field record is empty.</p>";
    else if (tab === "records")
      html =
        Object.entries(s.records)
          .map(
            ([id, record]) =>
              `<article class="ledger-item"><strong>${escape(this.definition.records[id]?.title || id)}</strong><p>${escape(record.status)}</p><pre>${escape(JSON.stringify(record.result || {}, null, 2))}</pre></article>`,
          )
          .join("") || "<p>No records have been requested.</p>";
    else
      html = `<p>${escape(r.objective.text)}</p><div class="notes">${r.objectives.map((o) => `${o.complete ? "✓" : o.failed ? "!" : "○"} ${escape(o.title)}${o.optional ? " (optional)" : ""}`).join("<br>")}</div>${this.scoreHtml()}<p>${Object.entries(
        s.inventory,
      )
        .filter(([, i]) => i.holder === "player")
        .map(([id]) => escape(id))
        .join(" · ")}</p>`;
    this.open({
      kicker: "FIELD NOTEBOOK",
      title:
        tab === "case"
          ? this.definition.title
          : tab === "evidence"
            ? "Chain of custody"
            : tab === "records"
              ? "Dispatch records"
              : "The record so far",
      html,
      choices: [
        { label: "Review evidence", fn: () => this.notebook("evidence") },
        { label: "Read the field log", fn: () => this.notebook("log") },
        {
          label: "Review dispatch records",
          fn: () => this.notebook("records"),
        },
        { label: "Open district map", fn: () => this.map() },
        { label: "Return to patrol", fn: () => this.close() },
      ],
    });
  }
  scoreHtml() {
    return `<div class="stat-grid">${Object.entries(this.sim.runtime.score)
      .filter(([k]) => k !== "total")
      .map(
        ([k, v]) =>
          `<div><strong>${v}<small>/${this.definition.scoring.categories[k]}</small></strong><span>${escape(k)}</span></div>`,
      )
      .join("")}</div>`;
  }
  radio() {
    const actions =
      this.definition.presentation?.radioActions ||
      Object.keys(this.definition.actions)
        .filter((id) => this.definition.actions[id].channel === "radio")
        .map((id) => ({ id, label: this.definition.actions[id].label || id }));
    this.open({
      kind: "radio",
      kicker: "DISPATCH · FICTIONAL RECORDS",
      title: "Unit, go ahead.",
      text: "Request a record or update dispatch with your observations.",
      choices: [
        ...actions
          .filter((a) => this.sim.runtime.satisfies(a.visible))
          .map((a) => ({
            label: a.label,
            hint: this.sim.runtime.blocked(a.id).join(". ") || a.hint,
            disabled: this.sim.runtime.blocked(a.id).length > 0,
            fn: () => {
              if (this.command(a.id).ok) this.close();
            },
          })),
        {
          label: "Repeat current assignment",
          fn: () => {
            this.notice({
              ok: true,
              title: "Current assignment",
              text: this.sim.runtime.objective.text,
            });
            this.close();
          },
        },
        { label: "Close radio", fn: () => this.close() },
      ],
    });
  }
  tools() {
    const p = this.sim.state.player,
      cars = this.sim.world
        .entities()
        .filter((e) => e.kind === "vehicle" && e.role === "patrol");
    this.open({
      kicker: "FIELD TOOLS",
      title: "The right tool for the moment",
      text: "Tools are available when carried. Move close to an exhibit or person before using equipment.",
      choices: [
        { label: "Radio dispatch", fn: () => this.radio() },
        {
          label: "Field camera",
          fn: () => {
            const near = this.sim.interactions.selected();
            if (near?.evidence) {
              this.close();
              this.interact();
            } else
              this.notice({
                ok: false,
                text: "Approach a physical exhibit and inspect it first.",
              });
          },
        },
        {
          label: p.flashlight
            ? "Switch flashlight off"
            : "Switch flashlight on",
          fn: () => {
            this.command("equipment.flashlight");
            this.close();
          },
        },
        ...cars.flatMap((v) => [
          {
            label: `${v.siren ? "Deactivate" : "Activate"} ${v.label} warning lights`,
            fn: () => {
              this.command("vehicle.siren", { id: v.id });
              this.close();
            },
          },
          {
            label: `Recover ${v.label} to the road`,
            fn: () => {
              this.command("vehicle.recover", { id: v.id });
              this.close();
            },
          },
        ]),
        ...(this.definition.capabilities?.includes("action")
          ? [
              {
                label: p.weapon?.equipped ? "Holster sidearm" : "Equip sidearm",
                fn: () => {
                  this.command("action.equip", { on: !p.weapon?.equipped });
                  this.close();
                },
              },
              {
                label: "Reload sidearm",
                fn: () => {
                  this.command("action.reload");
                  this.close();
                },
              },
            ]
          : []),
        ...(this.definition.presentation?.toolsActions || [])
          .filter((a) => this.sim.runtime.satisfies(a.visible))
          .map((a) => ({
            label: a.label,
            hint: a.hint,
            fn: () => {
              if (this.command(a.id).ok) this.close();
            },
          })),
        ...Object.values(this.sim.state.encounters)
          .filter((e) => ["escaped", "stuck"].includes(e.phase))
          .map((e) => ({
            label: "Retry " + (e.label || e.id),
            hint: "Restore the encounter checkpoint and start again.",
            fn: () => {
              if (this.command("encounter.retry", { id: e.id }).ok)
                this.command("encounter.start", { id: e.id });
              this.close();
            },
          })),
        { label: "Case notebook", fn: () => this.notebook() },
        { label: "Back to patrol", fn: () => this.close() },
      ],
    });
  }
  vehicle() {
    const p = this.sim.state.player;
    if (p.vehicle) return this.command("vehicle.exit");
    const car = this.sim.world
      .entities()
      .filter((e) => e.kind === "vehicle")
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y),
      )[0];
    if (car) this.command("vehicle.enter", { id: car.id });
  }
  markers() {
    const target = this.sim.world.objectiveTarget();
    return [
      ...(target && target.scene === this.sim.state.scene
        ? [{ x: target.x, y: target.y, kind: "diamond", color: "#e5b86b" }]
        : []),
      ...this.sim.world
        .entities()
        .filter((e) => e.kind === "vehicle")
        .map((e) => ({ x: e.x, y: e.y, kind: "dot", color: "#85c5cc" })),
    ];
  }
  map() {
    this.close();
    this.game.pause("District map");
    this.shell.show("map", {
      kicker: "NORTH HAVEN",
      title: this.sim.world.location().title,
      text: "Gold: objective · blue: vehicles · white: you",
      map: this.sim.world.map(),
      at: this.sim.state.player,
      markers: this.markers(),
      labels:
        this.sim.world.location().mapLabels ||
        this.sim.world
          .entities()
          .filter((e) => e.kind === "anchor" && e.label)
          .map((e) => [e.label, e.x, e.y]),
      actions: [
        [
          "Back to patrol",
          () => {
            this.shell.hide();
            this.game.resume();
          },
        ],
      ],
    });
  }
  finish() {
    const outcome = this.definition.outcomes.find(
      (o) => o.id === this.sim.state.outcome,
    );
    const total = this.sim.runtime.score.total;
    const grade = this.definition.presentation?.grades?.find(
      (g) => total >= g.min,
    )?.title;
    let best = total,
      stored = false;
    try {
      const key = `last-light:best:${this.definition.id}`;
      best = Math.max(
        total,
        Number(this.storage.getItem(key)) || 0,
        this.definition.legacy?.bestStorageKey
          ? Number(
              this.storage.getItem(this.definition.legacy.bestStorageKey),
            ) || 0
          : 0,
      );
      this.storage.setItem(key, String(best));
      stored = true;
    } catch {}
    this.open({
      kicker: "END OF WATCH",
      title: grade || outcome?.title || "Case closed",
      locked: true,
      html: `<div class="scoreline"><strong>${total}</strong><span>/ ${Object.values(this.definition.scoring.categories).reduce((a, b) => a + b, 0)} · ${Math.floor((this.sim.state.resolvedAt ?? this.sim.state.seconds) / 60)}m ${Math.floor(this.sim.state.resolvedAt ?? this.sim.state.seconds) % 60}s on duty</span></div><p>${escape(outcome?.text || "Your supported report has been accepted.")}</p>${this.scoreHtml()}<div class="notes">${stored ? "Personal best" : "Best this session"}: ${best}.<br>${this.sim.state.penalties.map((p) => escape(p.reason)).join("<br>") || "No procedural deductions."}</div>`,
      choices: [
        { label: "Walk the beat", fn: () => this.close() },
        { label: "Review the case file", fn: () => this.notebook() },
        { label: "Play the shift again", fn: () => this.start(false) },
        {
          label: "Return to title",
          fn: () => {
            this.close();
            this.game.go("title");
          },
        },
      ],
    });
  }
  help() {
    this.open({
      kicker: "FIELD GUIDE",
      title: "Know your beat",
      html: '<p>Walk close to a person or exhibit, then interact. The gold marker follows your current objective. The notebook records independent leads, evidence and dispatch results.</p><div class="key-grid"><kbd>WASD / left stick</kbd><span>Move · Shift / L3 to run</span><kbd>E / Cross</kbd><span>Interact</span><kbd>C / R3</kbd><span>Cycle nearby targets</span><kbd>F / Triangle</kbd><span>Enter / exit vehicle</span><kbd>W / R2 · S / L2</kbd><span>Drive · brake / reverse</span><kbd>Q / L1</kbd><span>Tools</span><kbd>R / R1</kbd><span>Radio</span><kbd>Tab / touchpad</kbd><span>Notebook / map</span><kbd>Escape / Options</kbd><span>Pause / settings / remap</span></div><p>Touch: drag the left side to walk or steer. Tap contextual buttons on the right. Mouse: click clear ground to walk there. Actions with progress can be cancelled with Backspace / Circle.</p>',
      choices: [{ label: "Understood", fn: () => this.close() }],
    });
  }
  about() {
    this.open({
      kicker: "ABOUT & CREDITS",
      title: "Last Light — Harbor Patrol",
      text: "An original police-procedural adventure inspired by Police Quest 1–3. Initial date: 13 October 2026. my-3D2dge v0.34.0, upstream 5f858b3, Michael Crosato (MIT). Quaternius Universal Animation Library (CC0). Original case content and procedural artwork. Built with Codex on WSL2 Ubuntu 26.04.1; exact model variant and effort not exposed. Fictional procedures serve the game. Saves stay in this browser. Full sources and provenance are in the repository README.",
      choices: [{ label: "Return", fn: () => this.close() }],
    });
  }
  update(dt) {
    if (
      !this.started ||
      this.game.paused ||
      this.shell.screen ||
      this.authorPaused
    )
      return;
    const I = this.game.input,
      p = this.sim.state.player;
    this.saveT -= dt;
    this.radioT = Math.max(0, this.radioT - dt);
    if (this.saveT <= 0) $("save-status").textContent = "";
    if (this.panel) {
      this.panelInput();
      this.sim.tick(dt, { blocked: true });
      this.afterTick(dt);
      return;
    }
    if (
      this.sim.state.activeAction ||
      (this.sim.state.cue &&
        (this.sim.state.cue.lockInput ??
          this.definition.cues[this.sim.state.cue.id]?.lockInput) !== false)
    ) {
      if (I.pressed("cancel")) {
        this.command("interaction.cancel");
        this.command("cue.cancel");
      }
      this.sim.tick(dt, { blocked: true, hold: I.down("interact") });
      this.afterTick(dt);
      return;
    }
    if (I.pressed("notebook")) {
      this.notebook();
      return;
    }
    if (I.pressed("radio")) {
      this.radio();
      return;
    }
    if (I.pressed("tools")) {
      this.tools();
      return;
    }
    if (I.pressed("cancel")) {
      this.command("interaction.cancel");
      this.command("cue.cancel");
      this.clickTarget = null;
    }
    if (I.pressed("cycle")) this.sim.interactions.cycle();
    if (I.pressed("vehicle")) this.vehicle();
    if (I.pressed("siren") && p.vehicle)
      this.command("vehicle.siren", { id: p.vehicle });
    let m = I.move(),
      move = this.game.view.screenDirToGround(...m);
    if (Math.hypot(...m) > 0.05) this.clickTarget = null;
    const click = I.clicked();
    if (click && !p.weapon?.equipped) {
      const ground = this.game.mouseGround();
      if (ground) {
        const target = this.sim.interactions.selected(),
          pt = target && this.game.r.w(target.entity.x, target.entity.y, 16);
        if (pt && Math.hypot(click[0] - pt[0], click[1] - pt[1]) < 35)
          this.interact();
        else
          this.clickTarget = {
            x: ground[0] ?? ground.x,
            y: ground[1] ?? ground.y,
          };
      }
    }
    if (this.clickTarget && !p.vehicle) {
      const result = this.sim.world.toward(
        p,
        this.clickTarget,
        dt,
        I.down("sprint") ? 117 : 73,
      );
      move = [0, 0];
      if (result.arrived) this.clickTarget = null;
    }
    const drive = drivingInput(I);
    if (I.lastDevice === "touch" && Math.hypot(...m) > 0.08) {
      drive.direction = move;
      drive.throttle = 1;
    }
    if (I.down("sprint")) drive.brake = 1;
    if (I.pressed("interact")) {
      if (p.vehicle) this.vehicle();
      else this.interact();
    }
    if (this.definition.capabilities?.includes("action")) {
      if (I.pressed("control")) {
        const target = this.sim.world
          .entities()
          .filter((e) => e.kind === "person")
          .sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.y - p.y) -
              Math.hypot(b.x - p.x, b.y - p.y),
          )[0];
        if (target) this.command("action.control", { id: target.id });
      }
      if (I.pressed("equip"))
        this.command("action.equip", { on: !p.weapon?.equipped });
      if (p.weapon?.equipped && !p.vehicle) {
        const ground = this.game.mouseGround(),
          aim = I.padAim;
        const angle = aim
          ? Math.atan2(
              ...this.game.view
                .screenDirToGround(...aim)
                .slice()
                .reverse(),
            )
          : ground
            ? Math.atan2(
                (ground[1] ?? ground.y) - p.y,
                (ground[0] ?? ground.x) - p.x,
              )
            : p.facing;
        const touch = I.lastDevice === "touch";
        const aimTarget =
          touch &&
          this.sim.world
            .entities()
            .filter(
              (e) =>
                e.kind === "person" &&
                (e.team === "hostile" || e.properties?.trainingTarget) &&
                e.mode !== "incapacitated",
            )
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.y - p.y) -
                Math.hypot(b.x - p.x, b.y - p.y),
            )[0];
        this.sim.action.aim(
          aimTarget ? Math.atan2(aimTarget.y - p.y, aimTarget.x - p.x) : angle,
          I.down("aim"),
        );
        if (I.pressed("fire")) this.command("action.fire");
        if (I.pressed("reload")) this.command("action.reload");
      }
    }
    this.sim.tick(dt, {
      move,
      drive,
      sprint: I.down("sprint"),
      hold: I.down("interact"),
    });
    this.afterTick(dt);
  }
  afterTick(dt) {
    this.completedInteraction();
    this.renderer.update(dt);
    this.presentCues();
    const frame = this.sim.presentation.frame || this.sim.state.player;
    this.game.focus(frame.x, frame.y, frame.z || 12);
    this.game.cam.offset = frame.offset || [0, this.game.upright ? -24 : 14];

    if (
      this.sim.state.outcome &&
      this.presentedOutcome !== this.sim.state.outcome
    ) {
      this.presentedOutcome = this.sim.state.outcome;
      this.save();
      this.finish();
    }

    this.hudT += dt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      this.hud();
      if (this.developer && $("developer-panel")?.querySelector("details").open)
        this.updateInspector();
    }
    if (
      Math.floor(this.sim.state.seconds / 8) !==
      Math.floor((this.sim.state.seconds - dt) / 8)
    )
      this.save();
  }
  presentCues() {
    const presentation = this.sim.presentation,
      frame = presentation.frame;
    if (frame) {
      if (this.cameraBeforeCue === null)
        this.cameraBeforeCue = this.game.zoom / (this.game.settings.zoom || 1);
      this.game.focus(frame.x, frame.y, frame.z);
      if (this.cueZoomApplied !== frame.zoom) {
        this.game.setZoom(frame.zoom);
        this.cueZoomApplied = frame.zoom;
      }
      if (frame.offset) this.game.cam.offset = frame.offset;
    } else if (this.cameraBeforeCue !== null) {
      this.game.setZoom(this.cameraBeforeCue);
      this.cameraBeforeCue = null;
      this.cueZoomApplied = null;
    }
    $("scene-fade").style.opacity = String(presentation.fade);
    if (presentation.sound && this.assets.sounds[presentation.sound])
      this.game.audio.sfx(this.assets.sounds[presentation.sound]);
    const events = this.sim.state.events.slice(this.lastEvent);
    this.lastEvent = this.sim.state.events.length;
    if (events.length) {
      const event = events.at(-1);
      this.shell.toast(event.title, event.text, 4);
      if (this.lastSavedEvent !== this.sim.state.events.length) this.save();
    }
    for (const event of events)
      if (event.channel === "radio") {
        $("radio-name").textContent = event.title;
        $("radio-text").textContent = event.text;
        this.radioT = this.game.settings.captionTime || 7;
        this.game.audio.sfx(
          this.assets.sounds.radio || {
            wave: "sine",
            freq: 1040,
            dur: 0.12,
            vol: 0.04,
          },
        );
      }
    if (presentation.subtitle) {
      $("radio-name").textContent = "FIELD NOTE";
      $("radio-text").textContent = presentation.subtitle;
    }
    $("radio-caption").hidden = !presentation.subtitle && this.radioT <= 0;
    this.game.audio.duck(!!this.panel || presentation.duck || this.radioT > 0);
    if (this.game.settings.ambience)
      for (const zone of this.sim.world.location().ambient || []) {
        const p = this.sim.state.player,
          key = this.sim.state.scene + ":" + zone.id;
        if (
          p.x >= zone.x &&
          p.y >= zone.y &&
          p.x <= zone.x + zone.w &&
          p.y <= zone.y + zone.d &&
          this.sim.state.seconds - (this.ambientTimes[key] || 0) > zone.interval
        ) {
          this.ambientTimes[key] = this.sim.state.seconds;
          if (this.assets.sounds[zone.sound])
            this.game.audio.sfx(this.assets.sounds[zone.sound]);
        }
      }
  }
  hud() {
    const sim = this.sim,
      s = sim.state,
      p = s.player,
      o = sim.runtime.objective,
      near = sim.interactions.selected(),
      target = sim.world.objectiveTarget(),
      nearVehicle = !p.vehicle && sim.world.entities().find(
        (e) => e.kind === "vehicle" &&
          Math.hypot(e.x - p.x, e.y - p.y) <= 62 && sim.world.canSee(p, e),
      ),
      I = this.game.input;
    this.shell.hud({
      objective: {
        step: `CASE ${this.definition.number || this.definition.id}${this.definition.presentation?.stepCount ? ` / ${String(o.step).padStart(2, "0")} OF ${String(this.definition.presentation.stepCount).padStart(2, "0")}` : ""}`,
        title: o.title,
        text: o.text,
        at: target?.scene === s.scene ? target : null,
        from: p,
      },
      status: {
        text: s.outcome ? "OFF DUTY" : p.vehicle ? "IN VEHICLE" : "ON DUTY",
        color: "#ded1af",
      },
      place:
        this.definition.presentation?.placeZones?.find((z) => p.x > z.x)
          ?.title || sim.world.location().title,
      prompt: s.activeAction
        ? {
            label: "Working…",
            progress: 1 - s.activeAction.remaining / s.activeAction.duration,
          }
        : p.vehicle
          ? {
              act: "vehicle",
              label: "Leave vehicle",
              hint: "Stop before stepping out",
            }
          : near
            ? {
                act: "interact",
                label: near.label,
                hint: sim.interactions.reasons(near.id).join(". ") || near.hint,
              }
            : nearVehicle
              ? { act: "vehicle", label: `Enter ${nearVehicle.label || "vehicle"}` }
              : null,
      minimap:
        p.weapon?.equipped && !p.vehicle
          ? null
          : {
              map: sim.world.map(),
              at: p,
              markers: this.markers(),
              onClick: () => this.map(),
            },
      keys: [
        [I.label("tools"), "Tools"],
        [I.label("radio"), "Radio"],
        [I.label("notebook"), "Case"],
      ],
    });
    I.touchSet(
      "interact",
      p.vehicle
        ? "EXIT"
        : near?.evidence
          ? "INSPECT"
          : near?.dialogue
            ? "TALK"
            : "USE",
      !this.panel && (!!p.vehicle || !!near),
    );
    I.touchSet("sprint", p.vehicle ? "BRAKE" : "RUN", !this.panel);
    I.touchSet("vehicle", "ENTER", !this.panel && !!nearVehicle);
    I.touchSet("tools", "TOOLS", !this.panel);
    I.touchSet("notebook", "CASE", !this.panel);
    I.touchSet(
      "cycle",
      "NEXT",
      !this.panel && !p.vehicle && sim.interactions.nearby().length > 1,
    );
    I.touchSet("cancel", "CANCEL", !this.panel && !!(s.activeAction || s.cue));
    const armed =
      this.definition.capabilities?.includes("action") &&
      p.weapon?.equipped &&
      !p.vehicle;
    I.touchSet("aim", "AIM", !this.panel && !!armed);
    I.touchSet("fire", "FIRE", !this.panel && !!armed);
    I.touchSet(
      "control",
      "CONTROL",
      !this.panel &&
        !p.vehicle &&
        !!this.definition.capabilities?.includes("action"),
    );
    let weaponHud = $("action-hud");
    if (!weaponHud) {
      weaponHud = document.createElement("div");
      weaponHud.id = "action-hud";
      weaponHud.setAttribute("role", "status");
      document.body.append(weaponHud);
    }
    weaponHud.hidden = !armed;
    weaponHud.textContent = armed
      ? `${p.weapon.ammo} / ${p.weapon.reserve} · ${p.weapon.reload > 0 ? "RELOADING" : p.aiming ? "AIMING" : "SIDEARM"} · ${I.lastDevice === "touch" ? "Tools → Reload" : I.label("reload") + " to reload"}`
      : "";
    $("drive-hud").hidden = !p.vehicle;
    const car = p.vehicle && s.entities[p.vehicle];
    $("speed").textContent = String(
      Math.round(Math.abs(car?.speed || 0) * 0.32),
    );
    $("vehicle-label").textContent = car?.label || "VEHICLE";
    $("siren-status").classList.toggle("on", !!car?.siren);
    $("interaction-progress").hidden = !s.activeAction;
    $("interaction-progress").firstElementChild.style.width = s.activeAction
      ? 100 * (1 - s.activeAction.remaining / s.activeAction.duration) + "%"
      : "0";
  }
  snapshot() {
    const s = this.sim.state;
    const car =
      s.entities[this.definition.presentation?.primaryVehicle] ||
      Object.values(s.entities).find((e) => e.role === "patrol");
    const subject = s.entities[this.definition.presentation?.subject];
    const chase = Object.values(s.encounters).find((e) => e.kind === "pursuit");
    return {
      scene: this.game.sceneName,
      caseId: s.caseId,
      location: s.scene,
      objective: this.sim.runtime.objective,
      flags: { ...s.facts },
      score: this.sim.runtime.score,
      hero: { ...s.player },
      car: car && {
        x: car.x,
        y: car.y,
        angle: car.angle,
        speed: car.speed || 0,
      },
      suspect: subject && { x: subject.x, y: subject.y },
      chase: chase
        ? {
            active: chase.phase === "active",
            index: chase.routeIndex,
            phase: chase.phase,
          }
        : null,
      entities: structuredClone(s.entities),
      evidence: structuredClone(s.evidence),
      encounters: structuredClone(s.encounters),
      nearest: this.sim.interactions.selected()?.id,
      modal: this.panel?.title,
      choices: this.panel?.choices.map((c) => c.label),
      inCar: !!s.player.vehicle,
      busy: s.activeAction,
      errors: this.game.errors,
    };
  }
  completedInteraction() {
    const completed = this.sim.lastInteraction;
    if (completed?.dialogue) this.conversation();
    else if (completed?.evidence) this.evidence(completed.evidence);
    else if (completed?.panel === "animations") this.animationCatalog();
    else if (completed?.ok === false || completed?.cancelled)
      this.notice({
        ok: false,
        title: "Action interrupted",
        text: completed.text || "No effects were committed.",
      });
  }
  animationCatalog() {
    const all = [
      ...(this.assets.animations || []),
      ...(this.assets.poses || []),
    ];
    this.open({
      kind: "animations",
      kicker: "MOTION LIBRARY",
      title: "Choose a performance",
      html: '<label class="catalog-label">Search animations<input id="clip-query" autocomplete="off" placeholder="talk, interact, surrender…"></label><label class="catalog-label">Selected clip<select id="clip-select"></select></label><p>Imported CC0 clips and original poses. Upper-body blending leaves the legs free to walk.</p>',
      choices: [
        {
          label: "Play selected with upper-body blend",
          fn: () => {
            const clip = $("clip-select").value;
            if (this.command("cue.preview", { clip, mask: "upper" }).ok)
              this.close();
          },
        },
        {
          label: "Play selected as full-body motion",
          fn: () => {
            const clip = $("clip-select").value;
            if (this.command("cue.preview", { clip, mask: "full" }).ok)
              this.close();
          },
        },
        { label: "Return to the scene", fn: () => this.close() },
      ],
    });
    const filter = () => {
      const query = $("clip-query").value.toLowerCase();
      $("clip-select").replaceChildren();
      for (const clip of all.filter((c) => c.toLowerCase().includes(query))) {
        const option = document.createElement("option");
        option.value = clip;
        option.textContent = clip;
        $("clip-select").append(option);
      }
    };
    $("clip-query").oninput = filter;
    filter();
  }
  installDeveloperPanel() {
    const panel = document.createElement("aside");
    panel.id = "developer-panel";
    panel.innerHTML =
      '<details><summary>Author tools</summary><label>Case or scenario <select id="dev-case"></select></label><label>Seed <input id="dev-seed" type="number" min="1"></label><button id="dev-load">Load</button><label>Entity <select id="dev-entity"></select></label><button id="dev-overlay">Collision / navigation / sight</button><label>Checkpoint <input id="dev-checkpoint-id" value="author"></label><button id="dev-checkpoint">Save checkpoint</button><button id="dev-restore">Restore checkpoint</button><button id="dev-pause">Pause simulation</button><button id="dev-step">Step 1/120 s</button><button id="dev-export">Export diagnostic</button><pre id="dev-state"></pre></details>';
    document.body.append(panel);
    for (const [id, c] of Object.entries(this.cases)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = c.title;
      option.selected = id === this.definition.id;
      $("dev-case").append(option);
    }
    $("dev-seed").value = this.seed;
    for (const entity of [
      this.sim.state.player,
      ...Object.values(this.sim.state.entities),
    ]) {
      const option = document.createElement("option");
      option.value = entity.id;
      option.textContent = (entity.label || entity.id) + " · " + entity.id;
      $("dev-entity").append(option);
    }
    $("dev-entity").onchange = () => {
      this.sim.debugEntity = $("dev-entity").value;
      this.updateInspector();
    };
    $("dev-pause").onclick = () => {
      this.authorPaused = !this.authorPaused;
      $("dev-pause").textContent = this.authorPaused
        ? "Resume simulation"
        : "Pause simulation";
      this.updateInspector();
    };
    $("dev-load").onclick = () => {
      const url = new URL(location.href);
      url.searchParams.set("case", $("dev-case").value);
      url.searchParams.set("seed", $("dev-seed").value || "1");
      url.searchParams.set("dev", "1");
      location.href = url;
    };
    $("dev-overlay").onclick = () => {
      this.sim.debugOverlay = !this.sim.debugOverlay;
    };
    $("dev-checkpoint").onclick = () =>
      this.command("checkpoint.save", { id: $("dev-checkpoint-id").value });
    $("dev-restore").onclick = () =>
      this.command("checkpoint.restore", { id: $("dev-checkpoint-id").value });
    $("dev-step").onclick = () => {
      this.authorPaused = true;
      $("dev-pause").textContent = "Resume simulation";
      this.sim.tick(1 / 120);
      this.afterTick(1 / 120);
      this.updateInspector();
    };
    this.updateInspector();
    const record = document.createElement("button");
    record.id = "dev-record";
    record.textContent = "Record inputs (reload)";
    record.onclick = () => {
      this.save();
      const url = new URL(location.href);
      url.searchParams.set("record", "1");
      location.href = url;
    };
    panel.querySelector("details").append(record);
    $("dev-export").onclick = () =>
      this.download("last-light-diagnostic.json", this.diagnostic());
  }
  updateInspector() {
    if (!$("dev-state")) return;
    const id = $("dev-entity").value,
      entity =
        id === "player" ? this.sim.state.player : this.sim.state.entities[id];
    $("dev-state").textContent = JSON.stringify(
      {
        time: this.sim.state.seconds,
        scene: this.sim.state.scene,
        seed: this.seed,
        entity,
        objective: this.sim.runtime.objective,
        interactions: this.definition.interactions
          ?.filter((i) => i.entity === id)
          .map((i) => ({
            id: i.id,
            blocked: this.sim.interactions.reasons(i.id),
          })),
        blocked: Object.fromEntries(
          Object.keys(this.definition.actions).map((id) => [
            id,
            this.sim.runtime.blocked(id),
          ]),
        ),
        jobs: this.sim.state.jobs,
      },
      null,
      2,
    );
  }
  diagnostic() {
    const raw = My3D2dge.session.save?.();
    const session = raw ? JSON.parse(raw) : null;
    if (session)
      session.lastLight = {
        ...this.assets.build,
        caseId: this.definition.id,
        seed: this.seed,
      };
    return {
      version: 1,
      caseId: this.definition.id,
      seed: this.seed,
      state: this.sim.runtime.serialize(),
      initialState: this.initialState,
      build: this.assets.build,
      contentHash: hash(this.definition),
      blocked: Object.fromEntries(
        Object.keys(this.definition.actions).map((id) => [
          id,
          this.sim.runtime.blocked(id),
        ]),
      ),
      session,
    };
  }
  download(name, data) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
    );
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
