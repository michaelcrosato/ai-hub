import { ARCHETYPES, BIOMES, RARITY_COLORS, SKILLS } from "./data.js";
import { clamp, formatCompact, randomSeedText } from "./util.js";
import { itemScore, MAX_TEMPER, scrapCount, temperCost } from "./loot.js";

export const STAT_LABELS = {
  power: "Power",
  armor: "Armor",
  maxHealth: "Maximum Health",
  maxResource: "Maximum Focus",
  critChance: "Critical Chance",
  critDamage: "Critical Damage",
  attackSpeed: "Attack Speed",
  moveSpeed: "Movement Speed",
  cooldownRate: "Cooldown Rate",
  healthRegen: "Health Regeneration",
  resourceRegen: "Focus Regeneration",
  fireDamage: "Fire Damage",
  frostDamage: "Frost Damage",
  poisonDamage: "Poison Damage",
  healingPower: "Healing Power",
};

const POI_GLYPHS = {
  settlement: "◆",
  dungeon: "▣",
  camp: "△",
  shrine: "✦",
  tower: "▥",
  ruin: "⌁",
  mine: "⬙",
  graveyard: "†",
  portal: "◉",
  farm: "▤",
  bridge: "═",
};

export const DIFFICULTIES = [
  { id: "story", name: "Story", detail: "Gentler foes: less health, much less damage." },
  { id: "normal", name: "Normal", detail: "The journey as it was designed." },
  { id: "hard", name: "Hard", detail: "Tougher foes that hit harder, for 20% more experience and gold." },
];

/** Button names for the device the player is using right now (kit.input.source). */
const PROMPTS = {
  keyboard: {
    interact: "E",
    potion: "Q",
    log: "L",
    skills: ["1", "2", "3", "4", "5", "6"],
    foot: "WASD move · Mouse aim · Left/right click attack · 1–6 abilities · Space dodge · Q draught · E interact · Esc pause",
  },
  gamepad: {
    interact: "Y",
    potion: "LS",
    log: "☰",
    skills: ["RB", "LB", "↑", "→", "↓", "←"],
    foot: "Left stick move · Right stick aim · RT attack · LT / B power · A dodge · RB, LB, D-pad abilities · Y interact · Start pause",
  },
  touch: {
    interact: "Use",
    potion: "",
    log: "Log",
    skills: ["", "", "", "", "", ""],
    foot: "Left thumb moves · Attack, Power and Dodge on the right · tap an ability to cast (it aims itself)",
  },
};

const CONTROL_ROWS = [
  ["Move", "WASD / arrows", "Left stick", "Left thumb stick"],
  ["Aim", "Mouse", "Right stick (auto-aim when idle)", "Automatic"],
  ["Attack", "Left click / J", "RT or X", "Attack"],
  ["Power strike", "Right click / K / Shift", "LT or B", "Power"],
  ["Dodge roll", "Space", "A", "Dodge"],
  ["Abilities 1–6", "1–6", "RB, LB, D-pad ↑ → ↓ ←", "Tap the ability bar"],
  ["Healing draught", "Q", "Left stick click", "Potion"],
  ["Interact", "E", "Y", "Use"],
  ["Inventory", "I", "View (Back)", "Bag"],
  ["Character · Quests · Map", "C · L · M", "LB / RB switch tabs", "Tabs at the top"],
  ["Zoom", "Mouse wheel", "Right stick click", "Pinch"],
  ["Pause", "Esc / P", "Start", "II"],
];

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>'"]/g,
    (e) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[e],
  );
}

function formatPercent(s) {
  return `${Math.round(s * 100)}%`;
}

export function formatStat(s, e) {
  if (["critChance", "critDamage", "attackSpeed", "moveSpeed", "cooldownRate", "healingPower"].includes(s)) {
    return formatPercent(e);
  } else if (["healthRegen", "resourceRegen"].includes(s)) {
    return `${e.toFixed(1)}/s`;
  } else if (Number.isInteger(e)) {
    return e.toString();
  } else {
    return e.toFixed(1);
  }
}

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

function objectiveText(s) {
  if (s.state === "ready") {
    return "Return for reward";
  }
  if (s.stages > 1 && s.currentStage === 1) {
    return `Discover ${s.locationName}`;
  }
  switch (s.type) {
    case "hunt":
      return `Defeat targets: ${s.progress}/${s.required}`;
    case "clear":
      return `Clear location: ${s.progress}/${s.required}`;
    case "retrieve":
      return `Recover item: ${s.progress}/${s.required}`;
    case "gather":
      return `Gather samples: ${s.progress}/${s.required}`;
    case "investigate":
      return `Investigate: ${s.progress}/${s.required}`;
    case "activate":
      return `Activate objective: ${s.progress}/${s.required}`;
    case "defend":
      return `Defeat attackers: ${s.progress}/${s.required}`;
    case "boss":
      return `Defeat boss: ${s.progress}/${s.required}`;
  }
  return "";
}

const PANEL_TABS = ["inventory", "character", "quests", "map"];
const PANEL_NAMES = { inventory: "Inventory", character: "Character", quests: "Quests", map: "Map" };
const FOCUSABLE = 'button:not(:disabled), input:not([type="hidden"]):not(:disabled), [data-nav]';

/** A stable identity for a control, so focus survives a re-render of its panel. */
function focusKey(el) {
  const d = el.dataset ?? {};
  return `${el.tagName}|${d.action ?? ""}|${d.value ?? ""}|${d.setting ?? ""}|${el.id ?? ""}`;
}

function isShown(el) {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

/**
 * All of Seedfall's DOM: HUD, panels, dialogue, title and death screens.
 * It reads the game through a view object and reports clicks as actions.
 */
export class GameUI {
  source = "keyboard";
  selectedArchetype = "vanguard";
  selectedDifficulty = "normal";
  currentView;
  viewProvider = null;
  /** (position2D) => {x, y} in CSS pixels or null; set by the game for floating combat text. */
  project = null;
  activePanel;
  interaction;
  hudAccumulator = 0;
  tooltipItem;
  controlsOpen = false;
  lastPrompt = "";
  lastBoss = "";
  lastTrial = "";
  textCache = new Map();

  constructor(container, onAction) {
    this.onAction = onAction;
    this.root = document.createElement("div");
    this.root.id = "ui-root";
    this.root.innerHTML = this.shellMarkup();
    container.appendChild(this.root);
    this.overlay = this.require("#overlay-layer");
    this.hud = this.require("#hud");
    this.panels = this.require("#panels");
    this.startMenu = this.require("#start-menu");
    this.tooltip = this.require("#item-tooltip");
    this.toasts = this.require("#toast-stack");
    this.buildHotbar();
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("mousemove", this.handleMouseMove);
    this.root.addEventListener("mouseleave", () => this.hideTooltip());
    this.root.addEventListener("input", this.handleSetting);
    this.root.addEventListener("change", this.handleSetting);
    this.root.addEventListener("focusin", this.handleFocus);
    this.root.addEventListener("focusout", () => this.hideTooltip());
    // A mouse or finger takes over from controller navigation: drop the forced focus ring.
    window.addEventListener("pointerdown", this.handlePointerDown, true);
    this.renderArchetypes();
    this.renderDifficultyPicker();
    this.setSource(this.source, true);
  }

  // ---------- view

  view() {
    if (this.viewProvider) this.currentView = this.viewProvider();
    return this.currentView;
  }

  // ---------- device prompts

  setSource(source, force = false) {
    const next = PROMPTS[source] ? source : "keyboard";
    if (next === this.source && !force) return;
    this.source = next;
    document.documentElement.dataset.input = next;
    const p = PROMPTS[next];
    this.require("#menu-controls").textContent = p.foot;
    this.require("#log-key").textContent = p.log;
    this.require("#potion-key").textContent = p.potion;
    this.require("#potion-key").hidden = !p.potion;
    this.hotbarSlots.forEach((slot, k) => {
      slot.key.textContent = p.skills[k];
      slot.key.hidden = !p.skills[k];
    });
    this.lastPrompt = "";
    if (this.activePanel === "pause" && this.controlsOpen) this.refreshOpenPanel();
  }

  // ---------- title screen

  showMainMenu(hasSave, summary) {
    this.closeAll();
    this.startMenu.classList.remove("hidden");
    this.hud.classList.add("hidden");
    let n = this.require("#continue-button");
    n.disabled = !hasSave;
    n.textContent = hasSave ? "Continue Journey" : "No Saved Journey";
    let i = this.require("#save-summary");
    i.textContent = summary ?? (hasSave ? "A local save is available." : "No local save found.");
    let r = this.require("#seed-input");
    if (!r.value) {
      r.value = randomSeedText();
    }
    this.setBoss();
    this.setTrial();
  }

  hideMainMenu() {
    this.startMenu.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.hideTooltip();
  }

  // ---------- per-frame

  /** Called every frame; the HUD itself only redraws about twelve times a second. */
  refresh(dt) {
    this.hudAccumulator += dt;
    if (this.hudAccumulator < 0.08) return;
    this.hudAccumulator = 0;
    const view = this.view();
    if (!view) return;
    this.renderHud(view);
    this.renderMinimap(view);
  }

  // ---------- panels

  togglePanel(e) {
    if (!this.startMenu.classList.contains("hidden")) return;
    if (this.activePanel === e) {
      this.closePanels();
      return;
    }
    this.openPanel(e);
  }

  openPanel(e) {
    this.closeInteraction();
    this.activePanel = e;
    this.panels.classList.remove("hidden");
    this.panels.dataset.mode = e === "pause" ? "pause" : "tabs";
    for (let t of this.panels.querySelectorAll(".game-panel")) {
      t.classList.toggle("active", t.dataset.panel === e);
    }
    for (let t of this.panels.querySelectorAll(".panel-tab")) {
      t.classList.toggle("active", t.dataset.value === e);
      t.setAttribute("aria-selected", t.dataset.value === e ? "true" : "false");
    }
    this.refreshOpenPanel();
    const content = this.panels.querySelector(".game-panel.active .panel-content");
    if (content) content.scrollTop = 0;
    this.focusFirst();
  }

  /** LB / RB: step through Inventory, Character, Quests and Map. */
  cyclePanel(step) {
    if (!this.activePanel || this.activePanel === "pause") return;
    const k = PANEL_TABS.indexOf(this.activePanel);
    this.openPanel(PANEL_TABS[(k + step + PANEL_TABS.length) % PANEL_TABS.length]);
  }

  closePanels() {
    this.activePanel = undefined;
    this.controlsOpen = false;
    this.panels.classList.add("hidden");
    for (let e of this.panels.querySelectorAll(".game-panel")) {
      e.classList.remove("active");
    }
    this.hideTooltip();
  }

  isBlockingInput() {
    return (
      !this.startMenu.classList.contains("hidden") ||
      !!this.activePanel ||
      !!this.interaction ||
      !this.require("#death-screen").classList.contains("hidden")
    );
  }

  // ---------- prompts, toasts, banners

  showInteractionPrompt(e) {
    const key = e ? `${this.source}|${e}` : "";
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    let t = this.require("#interaction-prompt");
    if (!e) {
      t.classList.remove("visible");
      return;
    }
    const cap = PROMPTS[this.source].interact;
    t.innerHTML = `<span class="keycap">${escapeHtml(cap)}</span><span>${escapeHtml(e)}</span>`;
    t.classList.add("visible");
  }

  openInteraction(e) {
    this.closePanels();
    let t = this.interaction?.npc.id !== e.npc.id;
    this.interaction = e;
    let n = this.require("#interaction-modal");
    if (t) {
      this.require("#interaction-modal .modal-card").dataset.section = "dialogue";
    }
    const wasHidden = n.classList.contains("hidden");
    n.classList.remove("hidden");
    this.renderInteraction(e);
    if (wasHidden || t) this.focusFirst();
  }

  closeInteraction() {
    this.interaction = undefined;
    this.require("#interaction-modal").classList.add("hidden");
    this.require("#interaction-modal .modal-card").dataset.section = "dialogue";
    this.hideTooltip();
  }

  showToast(e, t, n = "normal") {
    const el = document.createElement("div");
    el.className = `toast tone-${n}`;
    el.innerHTML = `<strong>${escapeHtml(e)}</strong>${t ? `<span>${escapeHtml(t)}</span>` : ""}`;
    this.toasts.appendChild(el);
    // Several toasts can arrive together (XP, level up, loot): stack a few instead of overwriting.
    while (this.toasts.children.length > 3) this.toasts.firstElementChild.remove();
    requestAnimationFrame(() => el.classList.add("visible"));
    setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 260);
    }, 3100);
  }

  showCombatNumber(position, amount, kind, label) {
    if (!this.currentView?.settings.damageNumbers && kind !== "kill") return;
    const layer = this.require("#combat-text-layer");
    const el = document.createElement("div");
    el.className = `combat-number ${kind}`;
    el.textContent = label ? `${label}${amount ? ` ${Math.round(amount)}` : ""}` : amount ? `${Math.round(amount)}` : kind.toUpperCase();
    const screen = this.project?.(position);
    if (screen) {
      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y}px`;
    } else {
      const o = this.currentView?.player.position2D ?? { x: 0, z: 0 };
      el.style.left = `${50 + clamp((position.x - o.x) / 28, -0.42, 0.42) * 100}%`;
      el.style.top = `${50 + clamp((position.z - o.z) / 28, -0.35, 0.35) * 70}%`;
    }
    layer.appendChild(el);
    while (layer.children.length > 28) layer.firstElementChild.remove();
    setTimeout(() => el.remove(), 950);
  }

  showDiscovery(e) {
    let t = this.require("#discovery-banner");
    t.innerHTML = `<small>LOCATION DISCOVERED</small><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(BIOMES[e.biome].name)} · Danger ${e.danger}</span>`;
    t.classList.add("visible");
    clearTimeout(this.discoveryTimer);
    this.discoveryTimer = setTimeout(() => t.classList.remove("visible"), 3600);
  }

  showDeath(goldLost, stats) {
    this.closePanels();
    this.closeInteraction();
    let t = this.require("#death-screen");
    t.classList.remove("hidden");
    t.querySelector("[data-death-loss]").textContent = `You lost ${goldLost} gold. Progress since the last save remains.`;
    t.querySelector("[data-death-stats]").textContent = stats
      ? `Falls on this journey: ${stats.deaths} · Foes defeated: ${stats.kills}`
      : "";
    this.focusFirst();
  }

  hideDeath() {
    this.require("#death-screen").classList.add("hidden");
  }

  setBoss(name, health = 0, max = 1, phase = 1) {
    const key = name ? `${name}|${Math.round((health / max) * 400)}|${phase}` : "";
    if (key === this.lastBoss) return;
    this.lastBoss = key;
    let r = this.require("#boss-bar");
    if (!name) {
      r.classList.remove("visible");
      return;
    }
    r.classList.add("visible");
    r.querySelector("[data-boss-name]").textContent = name;
    r.querySelector("[data-boss-phase]").textContent = `PHASE ${phase}`;
    r.classList.toggle("enraged", phase > 1);
    r.querySelector("[data-boss-fill]").style.width = `${clamp(health / max, 0, 1) * 100}%`;
  }

  /** The Shrine Trial banner under the location name; empty text hides it. */
  setTrial(text = "") {
    if (text === this.lastTrial) return;
    this.lastTrial = text;
    const el = this.require("#trial-banner");
    el.textContent = text;
    el.classList.toggle("visible", !!text);
  }

  updateContinueAvailability(e, t) {
    let n = this.require("#continue-button");
    n.disabled = !e;
    n.textContent = e ? "Continue Journey" : "No Saved Journey";
    if (t) this.require("#save-summary").textContent = t;
  }

  // ---------- HUD

  setText(selector, text) {
    if (this.textCache.get(selector) === text) return;
    this.textCache.set(selector, text);
    this.require(selector).textContent = text;
  }

  setHtml(selector, html) {
    if (this.textCache.get(selector) === html) return;
    this.textCache.set(selector, html);
    this.require(selector).innerHTML = html;
  }

  setBar(fill, fraction, label, text) {
    const width = `${(clamp(fraction, 0, 1) * 100).toFixed(1)}%`;
    if (this.textCache.get(fill) !== width) {
      this.textCache.set(fill, width);
      this.require(fill).style.width = width;
    }
    this.setText(label, text);
  }

  renderHud(e) {
    let t = e.player;
    let n = t.getStats();
    this.setBar("#health-fill", t.health / n.maxHealth, "#health-text", `${Math.ceil(t.health)} / ${Math.round(n.maxHealth)}`);
    this.setBar(
      "#resource-fill",
      t.resource / n.maxResource,
      "#resource-text",
      `${Math.floor(t.resource)} / ${Math.round(n.maxResource)}`,
    );
    this.setBar("#xp-fill", t.progress.xp / t.progress.xpToNext, "#xp-text", `${t.progress.xp} / ${t.progress.xpToNext} XP`);
    this.setText("#level-badge", t.progress.level.toString());
    this.setText("#player-archetype", t.archetype.name);
    this.setText("#gold-value", formatCompact(t.progress.gold));
    this.setText("#potion-value", t.potions.toString());
    this.setText("#seed-display", `Seed: ${e.seedText}`);
    this.setHtml(
      "#location-display",
      `<strong>${escapeHtml(e.inDungeon ? (e.dungeonName ?? "Unknown Depths") : e.locationName)}</strong><span>${escapeHtml(e.biomeName)} · Danger ${e.danger}</span>`,
    );
    let i = Math.floor((e.worldTime % 1) * 24);
    let r = Math.floor((((e.worldTime % 1) * 24) % 1) * 60);
    this.setText("#clock-display", `${i.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`);
    let o = e.quests.filter((c) => c.state === "active" || c.state === "ready").slice(0, 3);
    this.setHtml(
      "#quest-tracker-list",
      o.length
        ? o
            .map(
              (c) =>
                `<button class="tracked-quest ${c.state}" data-action="open-quest" data-value="${escapeHtml(c.id)}"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(objectiveText(c))}</span></button>`,
            )
            .join("")
        : '<div class="empty-compact">No active quests. Visit a settlement board.</div>',
    );
    this.renderHotbar(t);
  }

  buildHotbar() {
    const bar = this.require("#hotbar");
    this.hotbarSlots = [];
    for (let k = 0; k < 6; k += 1) {
      const button = document.createElement("button");
      button.className = "hotbar-slot empty";
      button.dataset.action = "use-hotbar";
      button.dataset.value = String(k);
      button.innerHTML = `<span class="hotbar-key"></span><span class="hotbar-icon">—</span><span class="hotbar-name">Empty</span><span class="hotbar-cost"></span><span class="cooldown-mask" style="--cooldown:0"></span><span class="cooldown-text"></span>`;
      bar.appendChild(button);
      this.hotbarSlots.push({
        button,
        key: button.querySelector(".hotbar-key"),
        icon: button.querySelector(".hotbar-icon"),
        name: button.querySelector(".hotbar-name"),
        cost: button.querySelector(".hotbar-cost"),
        mask: button.querySelector(".cooldown-mask"),
        timer: button.querySelector(".cooldown-text"),
        state: "",
      });
    }
  }

  /** Update the six slots in place: rebuilding them every tick swallowed clicks and taps. */
  renderHotbar(player) {
    const stats = player.getStats();
    player.hotbar.forEach((id, k) => {
      const slot = this.hotbarSlots[k];
      const skill = SKILLS.find((s) => s.id === id);
      const left = skill ? (player.skillCooldowns.get(skill.id) ?? 0) : 0;
      const total = skill ? skill.cooldown / Math.max(0.35, stats.cooldownRate) : 1;
      const fraction = skill && left > 0 ? clamp(left / total, 0, 1) : 0;
      const poor = !!skill && player.resource < skill.cost;
      const state = `${id}|${fraction.toFixed(2)}|${left > 0 ? left.toFixed(left < 2 ? 1 : 0) : ""}|${poor}`;
      if (state === slot.state) return;
      slot.state = state;
      slot.button.classList.toggle("empty", !skill);
      slot.button.classList.toggle("no-focus", poor);
      slot.icon.textContent = skill ? skill.name.slice(0, 2).toUpperCase() : "—";
      slot.name.textContent = skill ? skill.name : "Empty";
      slot.cost.textContent = skill ? String(skill.cost) : "";
      slot.button.title = skill ? `${skill.name} · ${skill.cost} focus · ${skill.cooldown}s` : "Empty slot";
      slot.mask.style.setProperty("--cooldown", String(fraction));
      slot.timer.textContent = left > 0 ? left.toFixed(left < 2 ? 1 : 0) : "";
    });
  }

  renderMinimap(e) {
    let t = this.require("#minimap");
    let n = t.getContext("2d");
    if (!n) {
      return;
    }
    let i = t.width;
    let r = i / 2;
    let o = r / 54;
    n.clearRect(0, 0, i, i);
    n.save();
    n.beginPath();
    n.arc(r, r, r - 3, 0, Math.PI * 2);
    n.clip();
    // The ground colour of the biome underfoot (it used to follow whichever location loaded first).
    n.fillStyle = e.inDungeon
      ? "#2b2c31"
      : `#${(BIOMES[e.biome] ?? BIOMES.plains).ground.toString(16).padStart(6, "0")}`;
    n.fillRect(0, 0, i, i);
    n.strokeStyle = "rgba(255,255,255,0.06)";
    n.lineWidth = 1;
    for (let h = -2; h <= 2; h += 1) {
      n.beginPath();
      n.moveTo(0, r + h * 32);
      n.lineTo(i, r + h * 32);
      n.stroke();
      n.beginPath();
      n.moveTo(r + h * 32, 0);
      n.lineTo(r + h * 32, i);
      n.stroke();
    }
    let c = (h, u, d, p) => {
      let x = (h.x - e.player.x) * o;
      let y = (h.z - e.player.z) * o;
      if (!(Math.hypot(x, y) > r - 8)) {
        n.fillStyle = u;
        n.beginPath();
        n.arc(r + x, r + y, d, 0, Math.PI * 2);
        n.fill();
        if (p) {
          n.fillStyle = "#101418";
          n.font = `bold ${Math.round(d * 1.8)}px sans-serif`;
          n.textAlign = "center";
          n.textBaseline = "middle";
          n.fillText(p, r + x, r + y + 0.5);
        }
      }
    };
    for (let h of e.activePois) {
      c(h, h.kind === "settlement" ? "#f1d37b" : "#dedde4", h.kind === "settlement" ? 5 : 4, POI_GLYPHS[h.kind]);
    }
    for (let h of e.npcs) {
      c(h.position2D, h.role === "quest" ? "#f0d16a" : "#8fd2d8", 2.2);
    }
    for (let h of e.enemies) {
      if (!h.dead) {
        c(h.position2D, h.elite ? "#f1a34f" : "#d65b5b", h.elite ? 3.2 : 2.2);
      }
    }
    n.restore();
    n.strokeStyle = "rgba(230,235,238,0.42)";
    n.lineWidth = 3;
    n.beginPath();
    n.arc(r, r, r - 4, 0, Math.PI * 2);
    n.stroke();
    n.save();
    n.translate(r, r);
    // facing is atan2(x, z) and the map draws +z downwards, so the arrow turns by π − facing.
    n.rotate(Math.PI - e.player.facing);
    n.fillStyle = "#ffffff";
    n.beginPath();
    n.moveTo(0, -8);
    n.lineTo(6, 6);
    n.lineTo(0, 3);
    n.lineTo(-6, 6);
    n.closePath();
    n.fill();
    n.restore();
  }

  // ---------- panel rendering

  /**
   * Re-render the open panel from the current game state. Panels change only
   * through actions (the game is paused behind them), so this runs on demand,
   * and unchanged markup is left alone so focus, hover and scrolling survive.
   */
  refreshOpenPanel() {
    if (!this.activePanel) return;
    const view = this.view();
    if (!view) return;
    const content = this.require(`[data-panel="${this.activePanel}"] .panel-content`);
    switch (this.activePanel) {
      case "inventory":
        this.patch(content, this.inventoryMarkup(view.player));
        break;
      case "character":
        this.patch(content, this.characterMarkup(view.player));
        break;
      case "quests":
        this.patch(content, this.questLogMarkup(view.quests));
        break;
      case "map":
        this.patch(content, this.worldMapMarkup(view));
        this.drawWorldMap(view);
        break;
      case "pause":
        this.patch(content, this.pauseMarkup(view));
        break;
    }
  }

  patch(el, html) {
    if (el._html === html) return false;
    const active = document.activeElement;
    const key = active && el.contains(active) ? focusKey(active) : null;
    const index = key ? this.focusables(el).indexOf(active) : -1;
    const scrolls = [...el.querySelectorAll("[data-scroll]")].map((n) => [n.dataset.scroll, n.scrollTop]);
    el.innerHTML = html;
    el._html = html;
    for (const [name, top] of scrolls) {
      const n = el.querySelector(`[data-scroll="${name}"]`);
      if (n) n.scrollTop = top;
    }
    if (key) {
      // Keep focus on the same control, or on whatever took its place (a bought item's neighbour).
      const list = this.focusables(el);
      const again = list.find((n) => focusKey(n) === key) ?? list[Math.min(Math.max(0, index), list.length - 1)];
      again?.focus({ preventScroll: true });
    }
    return true;
  }

  inventoryMarkup(e) {
    let n = ["weapon", "armor", "accessory"]
      .map((r) => {
        let a = e.equipment[r];
        return `<div class="equipment-slot"><span>${r.toUpperCase()}</span>${a ? this.itemCard(a, true, `<button data-action="unequip" data-value="${r}">Unequip</button>`) : '<div class="empty-slot">Empty</div>'}</div>`;
      })
      .join("");
    let i = e.inventory.length
      ? e.inventory
          .map((r) =>
            this.itemCard(
              r,
              false,
              `${r.slot ? `<button data-action="equip" data-value="${escapeHtml(r.id)}">Equip</button><button data-action="salvage" data-value="${escapeHtml(r.id)}">Salvage</button>` : ""}`,
            ),
          )
          .join("")
      : '<div class="empty-state"><strong>Your pack is empty.</strong><span>Enemies, quests, shops, and dungeon caches provide equipment.</span></div>';
    return `<div class="panel-heading"><div><small>LOADOUT & LOOT</small><h2>Inventory</h2></div><div class="point-pills"><span>${scrapCount(e.inventory)} scrap</span><span>${e.inventory.length}/30 slots</span></div></div>
      <div class="inventory-layout"><aside class="equipment-column">${n}<div class="equipment-summary"><span>Equipment score</span><strong>${Object.values(
        e.equipment,
      )
        .reduce((r, a) => r + (a ? itemScore(a) : 0), 0)
        .toFixed(0)}</strong></div></aside><section class="inventory-grid">${i}</section></div>`;
  }

  characterMarkup(e) {
    let n = e.getStats();
    let i = Object.entries(n)
      .filter(([, o]) => Math.abs(o) > 0.001)
      .map(([o, l]) => `<div><span>${STAT_LABELS[o]}</span><strong>${formatStat(o, l)}</strong></div>`)
      .join("");
    let r = Object.entries(e.attributes)
      .map(
        ([o, l]) =>
          `<div class="attribute-row"><span><strong>${o[0].toUpperCase() + o.slice(1)}</strong><small>${this.attributeDescription(o)}</small></span><b>${l}</b><button data-action="attribute" data-value="${o}" aria-label="Raise ${o}" ${e.progress.attributePoints <= 0 ? "disabled" : ""}>+</button></div>`,
      )
      .join("");
    let a = ARCHETYPES.map((o) => {
      let l = SKILLS.filter((c) => c.school === o.id)
        .map((c) => {
          let h = e.learnedSkills.some((d) => d.id === c.id);
          let u = !!c.prerequisite && !e.learnedSkills.some((d) => d.id === c.prerequisite);
          // Learned active skills can be placed on any of the six ability slots.
          const slots =
            h && c.active
              ? `<div class="slot-picker">${e.hotbar
                  .map(
                    (id, k) =>
                      `<button class="${id === c.id ? "on" : ""}" data-action="assign-hotbar" data-value="${c.id}:${k}" aria-label="Place ${escapeHtml(c.name)} in slot ${k + 1}">${k + 1}</button>`,
                  )
                  .join("")}</div>`
              : "";
          return `<div class="skill-node ${h ? "learned" : ""} ${u ? "locked" : ""}" style="--school:${o.color}">
          <button class="skill-learn" data-action="learn-skill" data-value="${c.id}" ${h || u || e.progress.skillPoints <= 0 ? "disabled" : ""}>
          <span class="skill-tier">T${c.tier}</span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.description)}</small><em>${c.active ? `${c.cost} focus · ${c.cooldown}s` : "Passive"}${h ? " · Learned" : ""}</em>
          </button>${slots}
        </div>`;
        })
        .join("");
      return `<section class="skill-school"><header style="--school:${o.color}"><div class="school-glyph">${o.name.slice(0, 1)}</div><div><strong>${o.name}</strong><span>${o.tagline}</span></div></header><div class="skill-lane">${l}</div></section>`;
    }).join("");
    return `<div class="panel-heading"><div><small>BUILD FORGE</small><h2>${escapeHtml(e.archetype.name)} · Level ${e.progress.level}</h2></div><div class="point-pills"><span>${e.progress.skillPoints} skill</span><span>${e.progress.attributePoints} attribute</span></div></div>
      <div class="character-layout"><aside data-scroll="attributes"><h3>Attributes</h3>${r}<h3>Derived Stats</h3><div class="stat-list">${i}</div><button class="wide-button" data-action="respec">Respec Build</button></aside><section class="skill-scroll" data-scroll="skills">${a}</section></div>`;
  }

  questLogMarkup(e) {
    let n = e.filter((a) => a.state === "active" || a.state === "ready");
    let i = e
      .filter((a) => a.state === "completed")
      .slice(-12)
      .reverse();
    let r = n.length
      ? n.map((a) => this.questCard(a, true)).join("")
      : '<div class="empty-state"><strong>No active contracts.</strong><span>Quest boards and guild agents are found in settlements.</span></div>';
    return `<div class="panel-heading"><div><small>CONTRACT LEDGER</small><h2>Quest Log</h2></div><div class="resource-chip">${n.length} active</div></div>
      <div class="quest-log-layout"><section><h3>Active</h3>${r}</section><aside><h3>Completed</h3>${i.length ? i.map((a) => `<div class="completed-quest"><strong>${escapeHtml(a.title)}</strong><span>${a.rewards.xp} XP · ${a.rewards.gold} gold</span></div>`).join("") : '<div class="empty-compact">None yet.</div>'}</aside></div>`;
  }

  worldMapMarkup(e) {
    return `<div class="panel-heading"><div><small>WAYFARER'S CHART</small><h2>World Map</h2></div><div class="resource-chip">${e.discoveredPois.length} locations found</div></div><div class="map-layout"><canvas id="world-map" width="760" height="560"></canvas><aside id="map-legend"><h3>Map Key</h3><div><b class="legend-dot settlement"></b>Settlement</div><div><b class="legend-dot location"></b>Location</div><div><b class="legend-dot quest"></b>Active objective</div><div><b class="legend-dot trial"></b>Trial completed</div><hr><small>Seed</small><code>${escapeHtml(e.seedText)}</code><p>Only discovered locations are shown. Roads and landmarks persist for this seed.</p></aside></div>`;
  }

  drawWorldMap(e) {
    let n = this.root.querySelector("#world-map");
    let i = n?.getContext("2d");
    if (!i) return;
    let r = [...e.discoveredPois, { x: e.player.x, z: e.player.z }];
    let a = Math.min(...r.map((y) => y.x)) - 70;
    let o = Math.max(...r.map((y) => y.x)) + 70;
    let l = Math.min(...r.map((y) => y.z)) - 70;
    let c = Math.max(...r.map((y) => y.z)) + 70;
    let h = Math.max(180, o - a);
    let u = Math.max(180, c - l);
    let d = (y) => ({
      x: 42 + ((y.x - a) / h) * (n.width - 84),
      z: 42 + ((y.z - l) / u) * (n.height - 84),
    });
    i.fillStyle = "#172026";
    i.fillRect(0, 0, n.width, n.height);
    i.strokeStyle = "rgba(210,220,224,0.06)";
    i.lineWidth = 1;
    for (let y = 40; y < n.width; y += 60) {
      i.beginPath();
      i.moveTo(y, 0);
      i.lineTo(y, n.height);
      i.stroke();
    }
    for (let y = 40; y < n.height; y += 60) {
      i.beginPath();
      i.moveTo(0, y);
      i.lineTo(n.width, y);
      i.stroke();
    }
    let p = new Set(e.quests.filter((y) => y.state === "active").map((y) => y.targetPoiId));
    for (let y of e.discoveredPois) {
      let m = d(y);
      const trialDone = y.kind === "shrine" && e.completedTrials?.has(y.id);
      i.fillStyle = y.kind === "settlement" ? "#efd17b" : p.has(y.id) ? "#f19368" : trialDone ? "#b98ce8" : "#b6c4c8";
      i.beginPath();
      i.arc(m.x, m.z, y.kind === "settlement" ? 7 : 5, 0, Math.PI * 2);
      i.fill();
      i.font = "12px sans-serif";
      i.textAlign = "center";
      i.fillStyle = "#d9e0e2";
      i.fillText(y.name, m.x, m.z + 18);
    }
    let x = d(e.player.position2D);
    i.fillStyle = "#ffffff";
    i.beginPath();
    i.moveTo(x.x, x.z - 9);
    i.lineTo(x.x + 7, x.z + 7);
    i.lineTo(x.x - 7, x.z + 7);
    i.closePath();
    i.fill();
  }

  pauseMarkup(e) {
    const s = e.settings;
    const difficulty = DIFFICULTIES.map(
      (d) =>
        `<button class="choice ${s.difficulty === d.id ? "on" : ""}" data-action="set-difficulty" data-value="${d.id}" aria-pressed="${s.difficulty === d.id}">${d.name}</button>`,
    ).join("");
    const st = e.stats;
    const record = st
      ? `<section class="settings-card record-card"><h3>Journey Record</h3><div class="record-grid">
        <div><span>Time on the road</span><strong>${formatDuration(st.playSeconds)}</strong></div>
        <div><span>Foes defeated</span><strong>${st.kills}</strong></div>
        <div><span>Elites · Bosses</span><strong>${st.elites} · ${st.bosses}</strong></div>
        <div><span>Dungeons cleared</span><strong>${st.dungeons}</strong></div>
        <div><span>Contracts completed</span><strong>${st.quests}</strong></div>
        <div><span>Shrine trials won</span><strong>${st.trials}</strong></div>
        <div><span>Locations found</span><strong>${e.discoveredPois.length}</strong></div>
        <div><span>Falls</span><strong>${st.deaths}</strong></div>
      </div></section>`
      : "";
    const controls = this.controlsOpen ? this.controlsMarkup() : "";
    return `<div class="pause-layout"><small>JOURNEY PAUSED</small><h2>Seedfall</h2><p>${escapeHtml(e.locationName)} · Level ${e.player.progress.level} ${escapeHtml(e.player.archetype.name)}</p>
      <div class="pause-buttons"><button class="primary-button" data-action="resume">Resume</button><button data-action="save">Save Journey</button>
      <div class="pause-row"><button data-action="open-panel" data-value="inventory">Inventory</button><button data-action="open-panel" data-value="character">Character</button><button data-action="open-panel" data-value="quests">Quests</button><button data-action="open-panel" data-value="map">Map</button></div>
      <button data-action="controls" aria-expanded="${this.controlsOpen}">${this.controlsOpen ? "Hide Controls" : "Controls"}</button><button data-action="open-settings">Graphics &amp; Input Settings</button><button data-action="return-menu">Return to Title</button></div>
      ${controls}
      <section class="settings-card"><h3>Settings</h3><label>Master Volume <input type="range" min="0" max="1" step="0.05" value="${s.masterVolume}" data-setting="masterVolume"></label><div class="difficulty-row"><span>Difficulty</span><div class="choice-group">${difficulty}</div></div><label><input type="checkbox" ${s.cameraShake ? "checked" : ""} data-setting="cameraShake"> Camera shake</label><label><input type="checkbox" ${s.damageNumbers ? "checked" : ""} data-setting="damageNumbers"> Damage numbers</label><label><input type="checkbox" ${s.reduceMotion ? "checked" : ""} data-setting="reduceMotion"> Reduce motion</label></section>${record}</div>`;
  }

  controlsMarkup() {
    const col = this.source === "gamepad" ? 2 : this.source === "touch" ? 3 : 1;
    const label = this.source === "gamepad" ? "Controller" : this.source === "touch" ? "Touch" : "Keyboard & mouse";
    const rows = CONTROL_ROWS.map((r) => `<div><span>${r[0]}</span><strong>${escapeHtml(r[col])}</strong></div>`).join("");
    return `<section class="settings-card controls-card"><h3>Controls · ${label}</h3><div class="controls-list">${rows}</div><p>Prompts follow the device you last used. Menus work with the D-pad or stick, A to choose and B to go back.</p></section>`;
  }

  handleSetting = (event) => {
    const el = event.target.closest?.("[data-setting]");
    if (!el) return;
    if (event.type === "input" && el.type !== "range") return;
    this.onAction({
      type: "setting",
      value: el.dataset.setting,
      data: { value: el.type === "checkbox" ? String(el.checked) : el.value },
    });
  };

  // ---------- dialogue and services

  renderInteraction(e) {
    let t = this.require("#interaction-modal .modal-card");
    let n = {
      quest: "quest-board",
      merchant: "shop",
      smith: "shop",
      healer: "heal-service",
      trainer: "training",
      innkeeper: "rest-service",
      citizen: "talk",
      guard: "talk",
    };
    let i = t.dataset.section ?? "dialogue";
    let r = `<div class="npc-portrait" style="--portrait:#7e8c91">${escapeHtml(e.npc.name.slice(0, 1))}</div><div class="dialogue-copy"><small>${escapeHtml(e.npc.role.toUpperCase())} · ${escapeHtml(e.npc.faction)}</small><h2>${escapeHtml(e.npc.name)}</h2><p>${escapeHtml(e.npc.description)}</p><blockquote>“${escapeHtml(e.npc.dialogue[0] ?? "Safe roads.")}”</blockquote></div>`;
    if (i === "quests") {
      r = this.renderQuestBoard(e);
    }
    if (i === "shop") {
      r = this.renderShop(e);
    }
    if (i === "forge") {
      r = this.renderForge(e);
    }
    if (i === "training") {
      r = `<div class="service-view"><small>WAYMASTER SERVICE</small><h2>Training & Respec</h2><p>Spend skill points in the Character panel. A full respec costs ${this.respecCost(e.player)} gold and returns all non-starting skill and attribute points.</p><button class="primary-button" data-action="respec">Respec for ${this.respecCost(e.player)} gold</button></div>`;
    }
    if (i === "service") {
      r = `<div class="service-view"><small>SETTLEMENT SERVICE</small><h2>${e.npc.role === "healer" ? "Healer" : "The Inn"}</h2><p>${e.npc.role === "healer" ? "Restore all health and focus for a modest fee." : "Rest until morning, restore all health and focus, and save the journey."}</p><button class="primary-button" data-action="${e.npc.role === "healer" ? "heal-service" : "rest-service"}">${e.npc.role === "healer" ? `Treat wounds · ${Math.max(5, e.player.progress.level * 4)} gold` : "Rest · 12 gold"}</button></div>`;
    }
    let a = n[e.npc.role];
    let o =
      e.npc.role === "quest"
        ? "View Contracts"
        : e.npc.role === "merchant" || e.npc.role === "smith"
          ? "Trade"
          : e.npc.role === "healer"
            ? "Treatment"
            : e.npc.role === "trainer"
              ? "Train"
              : e.npc.role === "innkeeper"
                ? "Rest"
                : "Continue";
    const forge = e.npc.role === "smith" ? '<button data-action="interaction-section" data-value="forge">Forge</button>' : "";
    const actions =
      i === "dialogue"
        ? `<button class="primary-button" data-action="interaction-section" data-value="${a}">${o}</button>${forge}`
        : `<button data-action="interaction-section" data-value="dialogue">Back</button>${i === "shop" ? forge : ""}${i === "forge" ? '<button data-action="interaction-section" data-value="shop">Trade</button>' : ""}`;
    this.patch(
      t,
      `<button class="modal-close" data-action="close-interaction" aria-label="Leave">×</button><div class="interaction-body">${r}</div><footer class="dialogue-actions">${actions}<button data-action="close-interaction">Leave</button></footer>`,
    );
  }

  renderQuestBoard(e) {
    let t = e.quests.filter((n) => n.giverPoiId === e.poi.id && n.state !== "completed");
    return `<div class="board-view"><small>${escapeHtml(e.poi.name.toUpperCase())}</small><h2>Contract Board</h2><div class="board-list" data-scroll="board">${t.length ? t.map((n) => this.questCard(n, false)).join("") : '<div class="empty-state"><strong>No current contracts.</strong><span>The board will refresh as the region changes.</span></div>'}</div></div>`;
  }

  renderShop(e) {
    let t = e.shopItems ?? [];
    let n = e.player.inventory;
    return `<div class="shop-view"><div class="shop-header"><div><small>${escapeHtml(e.npc.role.toUpperCase())}</small><h2>${escapeHtml(e.npc.name)}'s Stock</h2></div><span>${e.player.progress.gold} gold · Reputation ${e.reputation}</span></div><div class="shop-columns"><section><h3>Buy</h3><div class="shop-grid" data-scroll="buy">${t.map((i) => this.itemCard(i, false, `<button data-action="buy" data-value="${escapeHtml(i.id)}">Buy ${(e.buyPrice?.(i) ?? i.value) * Math.max(1, i.quantity)}</button>`)).join("")}</div></section><section><h3>Sell</h3><div class="shop-grid" data-scroll="sell">${n.length ? n.map((i) => this.itemCard(i, false, `<button data-action="sell" data-value="${escapeHtml(i.id)}">Sell ${(e.sellPrice?.(i) ?? Math.floor(i.value / 2)) * Math.max(1, i.quantity)}</button>`)).join("") : '<div class="empty-compact">Nothing to sell.</div>'}</div></section></div>`;
  }

  /** The smith's forge: spend Crafting Scrap (from salvage) and gold to temper gear up to +5. */
  renderForge(e) {
    const player = e.player;
    const scrap = scrapCount(player.inventory);
    const gear = [
      ...["weapon", "armor", "accessory"].map((slot) => player.equipment[slot]).filter(Boolean),
      ...player.inventory.filter((item) => item.slot),
    ];
    const cards = gear
      .map((item) => {
        const temper = item.temper ?? 0;
        if (temper >= MAX_TEMPER) {
          return this.itemCard(item, !!Object.values(player.equipment).includes(item), '<span class="ready-tag">Fully tempered</span>');
        }
        const cost = temperCost(item);
        const afford = scrap >= cost.scrap && player.progress.gold >= cost.gold;
        return this.itemCard(
          item,
          !!Object.values(player.equipment).includes(item),
          `<button data-action="temper" data-value="${escapeHtml(item.id)}" ${afford ? "" : "disabled"}>Temper +${temper + 1} · ${cost.scrap} scrap · ${cost.gold}g</button>`,
        );
      })
      .join("");
    return `<div class="shop-view forge-view"><div class="shop-header"><div><small>SMITH SERVICE</small><h2>The Forge</h2></div><span>${scrap} scrap · ${player.progress.gold} gold</span></div><p class="forge-note">Each temper raises every stat on a piece by 7% and its value by 12%, up to +${MAX_TEMPER}. Salvage spare gear in your Inventory for Crafting Scrap.</p><div class="shop-grid forge-grid" data-scroll="forge">${cards || '<div class="empty-compact">No gear to temper.</div>'}</div></div>`;
  }

  itemCard(e, t, n) {
    let i = RARITY_COLORS[e.rarity];
    let r = Object.entries(e.stats)
      .filter(([, a]) => a !== 0)
      .slice(0, 4)
      .map(([a, o]) => `<span>${STAT_LABELS[a]} <b>+${formatStat(a, o)}</b></span>`)
      .join("");
    return `<article class="item-card item-slot rarity-${e.rarity}" data-item-id="${escapeHtml(e.id)}" style="--rarity:${i}"><header><span class="item-icon">${e.category === "weapon" ? "⚔" : e.category === "armor" ? "⬟" : e.category === "accessory" ? "◇" : e.category === "consumable" ? "✚" : "▧"}</span><div><small>${e.rarity.toUpperCase()} · LV ${e.level}${e.temper ? ` · +${e.temper}` : ""}</small><strong>${escapeHtml(e.name)}</strong></div>${e.quantity > 1 ? `<b class="quantity">×${e.quantity}</b>` : ""}</header><div class="item-stats">${r || "<span>Utility item</span>"}</div><footer><span>${t ? "Equipped" : `${e.value} value`}</span><div>${n}</div></footer></article>`;
  }

  questCard(e, t) {
    let n = `${e.rewards.xp} XP · ${e.rewards.gold} gold${e.rewards.itemSeed ? " · Item" : ""}`;
    let i =
      e.state === "available"
        ? `<button class="primary-button" data-action="accept-quest" data-value="${escapeHtml(e.id)}">Accept</button>`
        : e.state === "ready"
          ? t
            ? `<span class="ready-tag">Return to ${escapeHtml(e.giverName)}</span>`
            : `<button class="primary-button" data-action="turnin-quest" data-value="${escapeHtml(e.id)}">Turn In</button>`
          : t
            ? `<button data-action="abandon-quest" data-value="${escapeHtml(e.id)}">Abandon</button>`
            : "";
    return `<article class="quest-card state-${e.state}"><header><div><small>DIFFICULTY ${e.difficulty} · ${e.type.toUpperCase()}</small><h3>${escapeHtml(e.title)}</h3></div><span class="danger-pips">${"◆".repeat(Math.min(5, Math.ceil(e.difficulty / 2)))}</span></header><p>${escapeHtml(e.description)}</p><div class="objective-row"><strong>${escapeHtml(objectiveText(e))}</strong><span>${escapeHtml(e.locationName)}</span></div>${e.optionalGoal ? `<div class="optional-goal">Optional: ${escapeHtml(e.optionalGoal)}</div>` : ""}<footer><span>${n}</span>${i}</footer></article>`;
  }

  // ---------- input from the DOM

  handleClick = (e) => {
    let t = e.target.closest("[data-action]");
    if (!t) {
      // A tap on an item card (touch has no hover) shows its tooltip.
      const card = e.target.closest("[data-item-id]");
      if (card) this.showTooltipFor(card, e.clientX, e.clientY, true);
      return;
    }
    if (t.disabled) return;
    let n = t.dataset.action;
    let i = t.dataset.value;
    if (n === "select-archetype" && i) {
      this.selectedArchetype = i;
      this.renderArchetypes();
      return;
    }
    if (n === "select-difficulty" && i) {
      this.selectedDifficulty = i;
      this.renderDifficultyPicker();
      return;
    }
    if (n === "random-seed") {
      this.require("#seed-input").value = randomSeedText();
      return;
    }
    if (n === "new-game") {
      let r = this.require("#seed-input").value.trim() || randomSeedText();
      this.onAction({
        type: "new-game",
        value: r,
        data: { archetype: this.selectedArchetype, difficulty: this.selectedDifficulty },
      });
      return;
    }
    if (n === "continue") {
      this.onAction({ type: "continue" });
      return;
    }
    if (n === "close-panel" || n === "resume") {
      this.closePanels();
      this.onAction({ type: "panels-closed" });
      return;
    }
    if (n === "open-panel" && i) {
      this.openPanel(i);
      return;
    }
    if (n === "close-interaction") {
      this.closeInteraction();
      this.onAction({ type: "close-interaction" });
      return;
    }
    if (n === "interaction-section" && this.interaction) {
      this.showSection(i);
      return;
    }
    if (n === "open-quest") {
      this.openPanel("quests");
      return;
    }
    if (n === "controls") {
      this.controlsOpen = !this.controlsOpen;
      this.refreshOpenPanel();
      return;
    }
    this.onAction({
      type: n,
      value: i,
      data: { npcId: this.interaction?.npc.id ?? "", poiId: this.interaction?.poi.id ?? "" },
    });
  };

  showSection(value) {
    if (!this.interaction) return;
    let r = this.require("#interaction-modal .modal-card");
    r.dataset.section =
      value === "quest-board"
        ? "quests"
        : value === "shop"
          ? "shop"
          : value === "forge"
            ? "forge"
            : value === "training"
              ? "training"
              : value === "heal-service" || value === "rest-service"
                ? "service"
                : "dialogue";
    this.renderInteraction(this.interaction);
    this.focusFirst();
  }

  /** B on a controller: step back out of a section, then out of the dialogue. Returns false if nothing was open. */
  back() {
    if (!this.require("#death-screen").classList.contains("hidden")) return false;
    if (this.interaction) {
      const card = this.require("#interaction-modal .modal-card");
      if ((card.dataset.section ?? "dialogue") !== "dialogue") {
        this.showSection("dialogue");
      } else {
        this.closeInteraction();
        this.onAction({ type: "close-interaction" });
      }
      return true;
    }
    if (this.activePanel) {
      this.closePanels();
      this.onAction({ type: "panels-closed" });
      return true;
    }
    return false;
  }

  handleMouseMove = (e) => {
    let t = e.target.closest("[data-item-id]");
    if (!t || !this.currentView) {
      if (!this.tooltipPinned) this.hideTooltip();
      return;
    }
    this.showTooltipFor(t, e.clientX, e.clientY, false);
  };

  handleFocus = (e) => {
    const card = e.target.closest?.("[data-item-id]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    this.showTooltipFor(card, rect.right, rect.top, false);
  };

  showTooltipFor(card, x, y, pin) {
    if (!this.currentView) this.view();
    let i = this.findItem(card.dataset.itemId);
    if (!i) return;
    if (pin && this.tooltipPinned && this.tooltipItem?.id === i.id) {
      this.hideTooltip();
      return;
    }
    this.tooltipPinned = pin;
    if (this.tooltipItem?.id !== i.id) {
      this.tooltipItem = i;
      this.tooltip.innerHTML = this.tooltipMarkup(i, this.currentView.player);
    }
    this.tooltip.classList.add("visible");
    let r = Math.min(window.innerWidth - this.tooltip.offsetWidth - 12, x + 18);
    let a = Math.min(window.innerHeight - this.tooltip.offsetHeight - 12, y + 18);
    this.tooltip.style.transform = `translate(${Math.max(8, r)}px, ${Math.max(8, a)}px)`;
  }

  tooltipMarkup(e, t) {
    let n = e.slot ? t.equipment[e.slot] : undefined;
    let i = n && n.id !== e.id ? itemScore(e) - itemScore(n) : 0;
    let r = Object.entries(e.stats)
      .map(([o, l]) => `<div><span>${STAT_LABELS[o]}</span><strong>+${formatStat(o, l)}</strong></div>`)
      .join("");
    let a = e.affixes.map((o) => `<li>${escapeHtml(o.name)} · ${STAT_LABELS[o.stat]} +${formatStat(o.stat, o.value)}</li>`).join("");
    return `<small style="color:${RARITY_COLORS[e.rarity]}">${e.rarity.toUpperCase()} ${e.category.toUpperCase()} · LEVEL ${e.level}${e.temper ? ` · TEMPERED +${e.temper}` : ""}</small><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.description)}</p><div class="tooltip-stats">${r || "<div><span>Value</span><strong>Utility</strong></div>"}</div>${a ? `<ul>${a}</ul>` : ""}${n && n.id !== e.id ? `<div class="comparison ${i >= 0 ? "upgrade" : "downgrade"}">${i >= 0 ? "+" : ""}${i.toFixed(1)} score vs ${escapeHtml(n.name)}</div>` : ""}<footer>Value ${e.value}${e.quantity > 1 ? ` · Quantity ${e.quantity}` : ""}</footer>`;
  }

  findItem(e) {
    if (!this.currentView) {
      return;
    }
    let t = this.currentView.player;
    return (
      t.inventory.find((n) => n.id === e) ??
      Object.values(t.equipment).find((n) => n?.id === e) ??
      this.interaction?.shopItems?.find((n) => n.id === e)
    );
  }

  hideTooltip() {
    this.tooltipItem = undefined;
    this.tooltipPinned = false;
    this.tooltip.classList.remove("visible");
  }

  // ---------- controller and arrow-key menu navigation

  /** The menu layer on top, if any: death screen, dialogue, panels, then the title screen. */
  activeLayer() {
    const death = this.require("#death-screen");
    if (!death.classList.contains("hidden")) return death;
    const modal = this.require("#interaction-modal");
    if (!modal.classList.contains("hidden")) return modal;
    if (!this.panels.classList.contains("hidden")) return this.panels;
    if (!this.startMenu.classList.contains("hidden")) return this.startMenu;
    return null;
  }

  focusables(layer) {
    return [...layer.querySelectorAll(FOCUSABLE)].filter(isShown);
  }

  /** Put focus on the layer's main button (only for controller/keyboard players). */
  focusFirst() {
    if (this.source === "touch") return;
    requestAnimationFrame(() => {
      const layer = this.activeLayer();
      if (!layer) return;
      if (layer.contains(document.activeElement) && document.activeElement !== layer) return;
      const list = this.focusables(layer);
      const pick =
        list.find((el) => el.matches(".primary-button:not(.modal-close), .new-game-button, #continue-button:not(:disabled)")) ??
        list.find((el) => !el.matches(".panel-close, .modal-close, .panel-tab")) ??
        list[0];
      pick?.focus({ preventScroll: true });
    });
  }

  setNavMode(on) {
    document.documentElement.classList.toggle("nav-active", on);
  }

  handlePointerDown = () => this.setNavMode(false);

  destroy() {
    window.removeEventListener("pointerdown", this.handlePointerDown, true);
    this.root.remove();
  }

  /** Move focus to the nearest control in a direction; left/right also nudge sliders. */
  navigate(dir) {
    const layer = this.activeLayer();
    if (!layer) return;
    this.setNavMode(true);
    const list = this.focusables(layer);
    if (!list.length) return;
    const current = layer.contains(document.activeElement) ? document.activeElement : null;
    if (!current || !list.includes(current)) {
      this.focusFirst();
      return;
    }
    if (current.type === "range" && (dir === "left" || dir === "right")) {
      const step = Number(current.step) || 0.05;
      const next = clamp(Number(current.value) + (dir === "right" ? step : -step), Number(current.min), Number(current.max));
      current.value = String(Math.round(next * 100) / 100);
      current.dispatchEvent(new Event("input", { bubbles: true }));
      current.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const from = current.getBoundingClientRect();
    const fx = from.left + from.width / 2;
    const fy = from.top + from.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === current) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - fx;
      const dy = r.top + r.height / 2 - fy;
      let main;
      let side;
      if (dir === "up") [main, side] = [-dy, dx];
      else if (dir === "down") [main, side] = [dy, dx];
      else if (dir === "left") [main, side] = [-dx, dy];
      else [main, side] = [dx, dy];
      if (main <= 4) continue;
      const score = main + Math.abs(side) * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  /** A on a controller: press the focused control. */
  activate() {
    const layer = this.activeLayer();
    if (!layer) return;
    const el = layer.contains(document.activeElement) ? document.activeElement : null;
    if (!el) {
      this.focusFirst();
      return;
    }
    if (el.tagName === "INPUT" && el.type === "text") return;
    el.click();
  }

  // ---------- misc

  closeAll() {
    this.closePanels();
    this.closeInteraction();
    this.hideDeath();
  }

  attributeDescription(e) {
    if (e === "might") {
      return "Power";
    } else if (e === "finesse") {
      return "Crit & speed";
    } else if (e === "intellect") {
      return "Focus & magic";
    } else {
      return "Health & armor";
    }
  }

  respecCost(e) {
    return 60 + e.progress.level * 35;
  }

  renderArchetypes() {
    let e = this.require("#archetype-grid");
    e.innerHTML = ARCHETYPES.map(
      (t) =>
        `<button class="archetype-card ${this.selectedArchetype === t.id ? "selected" : ""}" data-action="select-archetype" data-value="${t.id}" aria-pressed="${this.selectedArchetype === t.id}" style="--class-color:${t.color}"><span class="class-glyph">${t.name.slice(0, 1)}</span><strong>${t.name}</strong><em>${t.tagline}</em><small>${t.description}</small></button>`,
    ).join("");
  }

  renderDifficultyPicker() {
    this.require("#difficulty-grid").innerHTML = DIFFICULTIES.map(
      (d) =>
        `<button class="choice ${this.selectedDifficulty === d.id ? "on" : ""}" data-action="select-difficulty" data-value="${d.id}" aria-pressed="${this.selectedDifficulty === d.id}" title="${escapeHtml(d.detail)}">${d.name}</button>`,
    ).join("");
    this.require("#difficulty-detail").textContent =
      DIFFICULTIES.find((d) => d.id === this.selectedDifficulty)?.detail ?? "";
  }

  shellMarkup() {
    return `<div id="hud" class="hidden">
      <div class="hud-top-left"><div class="portrait"><span id="level-badge">1</span></div><div class="vitals"><div class="name-row"><strong id="player-archetype">Vanguard</strong><span id="clock-display">08:00</span></div><div class="bar health"><span id="health-fill"></span><b id="health-text"></b></div><div class="bar resource"><span id="resource-fill"></span><b id="resource-text"></b></div><div class="bar xp"><span id="xp-fill"></span><b id="xp-text"></b></div></div></div>
      <div class="hud-top-center"><div id="location-display"><strong>Roadside</strong><span>Plains · Danger 1</span></div><div id="boss-bar"><div><strong data-boss-name>Boss</strong><span data-boss-phase>PHASE 1</span></div><div class="boss-track"><span data-boss-fill></span></div></div><div id="trial-banner"></div></div>
      <div class="hud-top-right"><div class="minimap-wrap"><canvas id="minimap" width="190" height="190"></canvas><span class="north">N</span></div><div id="seed-display">Seed</div></div>
      <div class="quest-tracker"><header><span>Tracked Quests</span><button data-action="open-quest" id="log-key" aria-label="Open the quest log">L</button></header><div id="quest-tracker-list"></div></div>
      <div class="currency-strip"><span class="gold-dot"></span><b id="gold-value">0</b><span class="potion-dot">+</span><b id="potion-value">0</b><button data-action="use-potion">Use Potion <span class="mini-key" id="potion-key">Q</span></button></div>
      <div id="hotbar"></div><div id="interaction-prompt"></div>
    </div>
    <div id="overlay-layer"><div id="combat-text-layer"></div><div id="discovery-banner"></div><div id="toast-stack"></div></div>
    <div id="panels" class="hidden">
      <nav class="panel-tabs" aria-label="Journal"><span class="tab-hint">LB</span>${PANEL_TABS.map((p) => `<button class="panel-tab" data-action="open-panel" data-value="${p}" role="tab">${PANEL_NAMES[p]}</button>`).join("")}<span class="tab-hint">RB</span></nav>
      <section class="game-panel" data-panel="inventory"><button class="panel-close" data-action="close-panel" aria-label="Close">×</button><div class="panel-content"></div></section>
      <section class="game-panel" data-panel="character"><button class="panel-close" data-action="close-panel" aria-label="Close">×</button><div class="panel-content"></div></section>
      <section class="game-panel" data-panel="quests"><button class="panel-close" data-action="close-panel" aria-label="Close">×</button><div class="panel-content"></div></section>
      <section class="game-panel" data-panel="map"><button class="panel-close" data-action="close-panel" aria-label="Close">×</button><div class="panel-content"></div></section>
      <section class="game-panel pause-panel" data-panel="pause"><button class="panel-close" data-action="close-panel" aria-label="Close">×</button><div class="panel-content"></div></section>
    </div>
    <div id="interaction-modal" class="modal-layer hidden"><section class="modal-card" data-section="dialogue"></section></div>
    <div id="death-screen" class="modal-layer hidden"><section class="death-card"><small>THE ROAD CLAIMS ITS DUE</small><h2>You Have Fallen</h2><p data-death-loss></p><p class="death-stats" data-death-stats></p><button class="primary-button" data-action="respawn">Return to the Nearest Settlement</button></section></div>
    <div id="start-menu" class="start-menu"><div class="title-mark"><div class="rune">S</div><div><small>PROCEDURAL ACTION RPG</small><h1>SEEDFALL</h1><p>Every road remembers its seed.</p></div></div><div class="menu-card"><div class="menu-actions"><button id="continue-button" data-action="continue">Continue Journey</button><span id="save-summary"></span></div><hr><label class="seed-control"><span>World Seed</span><div><input id="seed-input" maxlength="48" autocomplete="off" spellcheck="false"><button data-action="random-seed">Randomize</button></div></label><div class="class-select"><span>Starting Archetype</span><div id="archetype-grid"></div></div><div class="class-select difficulty-select"><span>Difficulty</span><div class="choice-group" id="difficulty-grid"></div><small id="difficulty-detail"></small></div><button class="new-game-button" data-action="new-game">Begin New Journey</button><div class="menu-foot"><span id="menu-controls"></span><button class="link-button" data-action="open-settings">Graphics &amp; input settings</button></div></div></div>
    <div id="item-tooltip"></div>`;
  }

  require(e) {
    let t = this.root.querySelector(e);
    if (!t) {
      throw new Error(`Missing UI element: ${e}`);
    }
    return t;
  }
}
