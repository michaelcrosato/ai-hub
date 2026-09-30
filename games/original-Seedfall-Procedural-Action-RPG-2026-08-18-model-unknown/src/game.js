import * as THREE from "three/webgpu";
import { ARCHETYPES, BIOMES, ENEMY_TYPES, RARITY_COLORS, SKILLS } from "./data.js";
import { EventBus, Rng, angleOf, clamp, deriveSeed, directionFromAngle, distance2D, hashString, normalize2D } from "./util.js";
import { InputRouter } from "./input.js";
import { SceneRenderer } from "./renderer.js";
import { ChunkManager, WorldGenerator, disposeTree, shared, sharedBasic } from "./world.js";
import { Dungeon, DungeonGenerator } from "./dungeon.js";
import { LootSystem, MAX_TEMPER, scrapCount, spendScrap, temperCost, temperItem } from "./loot.js";
import { Enemy, Player } from "./entities.js";
import { CombatSystem } from "./combat.js";
import { EnemyAI } from "./ai.js";
import { Progression } from "./progression.js";
import { QuestSystem } from "./quests.js";
import { SettlementSystem } from "./settlements.js";
import { SaveSystem } from "./save.js";
import { AudioSystem } from "./audio.js";
import { GameUI } from "./ui.js";
import { ShrineTrial } from "./trials.js";

const FIXED_DT = 1 / 60;

/** Enemy health and damage per difficulty; Hard also pays more experience and gold. */
const DIFFICULTY = {
  story: { health: 0.75, damage: 0.6, reward: 1 },
  normal: { health: 1, damage: 1, reward: 1 },
  hard: { health: 1.3, damage: 1.35, reward: 1.2 },
};

const SKILL_ACTIONS = ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6"];
const PANEL_ACTIONS = [
  ["inventory", "inventory"],
  ["character", "character"],
  ["quests", "quests"],
  ["map", "map"],
];
const DUNGEON_KINDS = ["dungeon", "mine", "ruin", "portal"];
const USABLE_KINDS = ["dungeon", "mine", "ruin", "portal", "shrine", "tower"];

const RARITY_HEX = Object.fromEntries(Object.entries(RARITY_COLORS).map(([k, v]) => [k, new THREE.Color(v).getHex()]));
// Every pickup shares these four shapes; colours come from the shared basic-material cache.
const PICKUP_GEOMETRY = {
  gem: shared(new THREE.OctahedronGeometry(0.3, 0)),
  gemLarge: shared(new THREE.OctahedronGeometry(0.38, 0)),
  ring: shared(new THREE.TorusGeometry(0.46, 0.06, 5, 16)),
  ringLarge: shared(new THREE.TorusGeometry(0.58, 0.06, 5, 16)),
};

function createWorldState() {
  return {
    discoveredPoiIds: [],
    clearedPoiIds: [],
    openedChestIds: [],
    completedQuestIds: [],
    defeatedImportantEntityIds: [],
    generatedQuestSeeds: {},
    timeOfDay: 0.31,
    completedTrials: [],
  };
}

function defaultSettings() {
  return {
    masterVolume: 0.45,
    cameraShake: true,
    damageNumbers: true,
    reduceMotion: false,
    difficulty: "normal",
  };
}

function sanitizeSettings(s) {
  const out = { ...defaultSettings(), ...(s ?? {}) };
  if (!DIFFICULTY[out.difficulty]) out.difficulty = "normal";
  return out;
}

/** The journey record shown in the pause menu and on the death screen. */
function createRecord() {
  return { kills: 0, elites: 0, bosses: 0, dungeons: 0, quests: 0, trials: 0, deaths: 0, playSeconds: 0 };
}

export class Game {
  container;
  kit;
  renderer;
  router;
  ui;
  events = new EventBus();
  saveSystem = new SaveSystem();
  loot = new LootSystem();
  settlements = new SettlementSystem();
  dungeonGenerator = new DungeonGenerator();
  audio = new AudioSystem();
  overworldRoot = new THREE.Group();
  dungeonRoot = new THREE.Group();
  mode = "menu";
  seedText = "";
  seed = 0;
  world;
  chunkManager;
  dungeon;
  currentDungeonPoi;
  dungeonReturn;
  dungeonBossDefeated = false;
  player;
  combat;
  ai;
  progression;
  questSystem;
  quests = [];
  persistence = createWorldState();
  settings = defaultSettings();
  record = createRecord();
  trial = null;
  enemies = new Map();
  enemySources = new Map();
  npcs = new Map();
  projectiles = [];
  areas = [];
  pickups = [];
  defeatedSession = new Set();
  spawnedObjectives = new Set();
  deadTimers = new Map();
  interactionCandidate;
  currentNpc;
  currentPoi;
  currentShop = [];
  summonSequence = 0;
  pickupSequence = 0;
  syncTimer = 0;
  saveTimer = 0;
  accumulator = 0;
  clock = 0;
  destroyed = false;
  panelDirty = false;
  denyCooldown = 0;
  touchHidden = null;
  touchUse = null;
  touchPotion = null;

  constructor(container, kit) {
    this.container = container;
    this.kit = kit;
    this.renderer = new SceneRenderer(kit);
    this.renderer.worldRoot.add(this.overworldRoot, this.dungeonRoot);
    this.dungeonRoot.visible = false;
    this.router = new InputRouter(kit.input);
    this.ui = new GameUI(container, (action) => this.handleUIAction(action));
    this.ui.viewProvider = () => this.buildUIView();
    this.ui.project = (position) => this.projectToScreen(position);
    this.ui.setSource(kit.input.source, true);
    this.cleanups = [
      kit.input.onSourceChange((source) => this.ui.setSource(source)),
      // The kit's settings panel and a hidden tab pause the loop: silence the audio with it.
      kit.onPause((paused) => this.audio.setPaused(paused)),
      kit.onQuality((tier) => {
        if (this.chunkManager) this.chunkManager.detail = tier.detail;
      }),
      kit.onResize((width) => this.placeTouchPills(width)),
    ];
    this.bindEvents();
    window.addEventListener("pointerdown", this.unlockAudio, true);
    window.addEventListener("keydown", this.unlockAudio, true);
    window.addEventListener("pagehide", this.persistOnPageHide);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.showTitle();
  }

  // ---------------------------------------------------------------- lifecycle

  /** Browsers only start audio from a gesture; keep trying until it runs. */
  unlockAudio = () => {
    if (this.audio.unlock()) {
      window.removeEventListener("pointerdown", this.unlockAudio, true);
      window.removeEventListener("keydown", this.unlockAudio, true);
    }
  };

  persistOnPageHide = () => {
    if (this.mode !== "menu") {
      this.saveNow(false);
    }
  };

  /** Phones rarely fire pagehide when a tab is switched away or killed; save when it hides. */
  onVisibilityChange = () => {
    if (document.visibilityState === "hidden") this.persistOnPageHide();
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("pointerdown", this.unlockAudio, true);
    window.removeEventListener("keydown", this.unlockAudio, true);
    window.removeEventListener("pagehide", this.persistOnPageHide);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    for (const off of this.cleanups) off();
    if (this.mode !== "menu") this.saveNow(false);
    this.teardownRun();
    this.ui.destroy();
    this.audio.destroy();
    this.events.clear();
    document.documentElement.classList.remove("reduce-motion");
  }

  /** Touch: the top pills go beside the vitals on narrow screens, top-centre otherwise. */
  placeTouchPills(width) {
    if (!this.kit.touch) return;
    if (width < 700) this.kit.touch.placeTop("left", 84);
    else this.kit.touch.placeTop("center", 8);
  }

  showTitle() {
    this.mode = "menu";
    const save = this.saveSystem.load();
    this.settings = save ? sanitizeSettings(save.settings) : defaultSettings();
    this.applyMotionPreference();
    this.audio.setVolume(this.settings.masterVolume);
    const summary = save
      ? `Level ${save.player.progress.level} ${ARCHETYPES.find((n) => n.id === save.player.archetype)?.name ?? "Adventurer"} · ${save.seedText}`
      : undefined;
    this.ui.showMainMenu(!!save, summary);
    this.router.reset();
    this.kit.input.settle();
  }

  initializeRun(seedText, seed, archetypeId, save, difficulty) {
    this.teardownRun();
    this.mode = "overworld";
    this.seedText = seedText;
    this.seed = seed >>> 0;
    this.world = new WorldGenerator(this.seed, seedText);
    this.persistence = save ? JSON.parse(JSON.stringify(save.world)) : createWorldState();
    this.persistence.completedTrials ??= [];
    // A new journey keeps the player's sound and motion choices; only the difficulty is picked anew.
    this.settings = save
      ? sanitizeSettings(save.settings)
      : sanitizeSettings({ ...this.settings, difficulty: difficulty ?? "normal" });
    this.record = save?.stats ? { ...createRecord(), ...save.stats } : createRecord();
    this.quests = save ? JSON.parse(JSON.stringify(save.quests)) : [];
    this.player = new Player(archetypeId);
    this.chunkManager = new ChunkManager(this.world, this.overworldRoot);
    this.chunkManager.detail = this.kit.tier.detail;
    this.questSystem = new QuestSystem(this.world, this.quests, this.persistence, this.events);
    this.progression = new Progression(this.player, this.events);
    if (save) {
      this.player.restore(save.player);
      this.player.setPosition(save.player.x, save.player.z, this.world.getHeightAt(save.player.x, save.player.z));
    } else {
      let start = this.world.getStartingSettlement();
      this.player.setPosition(start.x, start.z + 6, this.world.getHeightAt(start.x, start.z + 6));
      let gear = this.loot.generateStartingGear(this.seed, archetypeId);
      this.player.inventory.push(...gear);
      let weapon = gear.find((c) => c.slot === "weapon");
      let armor = gear.find((c) => c.slot === "armor");
      if (weapon) {
        this.loot.equip(this.player.inventory, this.player.equipment, weapon.id);
      }
      if (armor) {
        this.loot.equip(this.player.inventory, this.player.equipment, armor.id);
      }
      this.player.refreshVitals(true);
      this.discoverPoi(start, false);
      this.questSystem.ensureForSettlement(start, 1);
    }
    this.combat = new CombatSystem({
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      areas: this.areas,
      pickups: this.pickups,
      effectsRoot: this.renderer.effectsRoot,
      events: this.events,
      getHeight: (x, z) => this.getHeight(x, z),
      canMovePlayer: (x, z) => this.canMove(x, z, true),
      canMoveEnemy: (x, z) => this.canMove(x, z, false),
      onEnemyKilled: (enemy) => this.onEnemyKilled(enemy),
      onPlayerDeath: () => this.onPlayerDeath(),
    });
    this.ai = new EnemyAI({
      player: this.player,
      enemies: this.enemies,
      combat: this.combat,
      getHeight: (x, z) => this.getHeight(x, z),
      canMoveEnemy: (x, z) => this.canMove(x, z, false),
      spawnSummon: (source, archetypeId, at) => this.spawnSummon(source, archetypeId, at),
      onBossPhase: (enemy) => this.onBossPhase(enemy),
    });
    this.renderer.dynamicRoot.add(this.player.group);
    this.overworldRoot.visible = true;
    this.dungeonRoot.visible = false;
    this.chunkManager.update(this.player.x, this.player.z, true);
    this.syncWorldContent(true);
    for (let quest of this.quests) {
      if (quest.state === "active") {
        this.reconcileQuestState(quest);
        if (quest.state === "active") {
          this.ensureQuestTargets(quest);
        }
      }
    }
    this.audio.setVolume(this.settings.masterVolume);
    this.applyMotionPreference();
    this.renderer.setTimeOfDay(this.persistence.timeOfDay);
    this.renderer.snapCamera(this.player.position2D);
    this.renderer.prewarm();
    this.ui.hideMainMenu();
    this.ui.showToast(save ? "Journey continued" : "Journey begun", `World seed: ${seedText}`, "good");
    this.accumulator = 0;
    this.saveTimer = 0;
    this.router.reset();
    this.kit.input.settle();
    if (!save) {
      this.saveNow(false);
    }
  }

  teardownRun() {
    if (this.trial) {
      this.trial.dispose();
      this.trial = null;
    }
    this.chunkManager?.clear();
    this.chunkManager = undefined;
    this.dungeon?.dispose();
    this.dungeon = undefined;
    this.currentDungeonPoi = undefined;
    this.dungeonReturn = undefined;
    this.renderer.dungeonLight.intensity = 0;
    this.clearRuntimeEntities(false);
    this.combat?.clearEffects();
    for (let child of [...this.overworldRoot.children]) {
      this.overworldRoot.remove(child);
      disposeTree(child);
    }
    for (let child of [...this.dungeonRoot.children]) {
      this.dungeonRoot.remove(child);
      disposeTree(child);
    }
    this.player = undefined;
    this.world = undefined;
    this.combat = undefined;
    this.ai = undefined;
    this.progression = undefined;
    this.questSystem = undefined;
    this.interactionCandidate = undefined;
    this.currentNpc = undefined;
    this.currentPoi = undefined;
    this.currentShop = [];
    this.enemies.clear();
    this.npcs.clear();
    this.enemySources.clear();
    this.defeatedSession.clear();
    this.spawnedObjectives.clear();
    this.deadTimers.clear();
    this.projectiles.length = 0;
    this.areas.length = 0;
    this.pickups.length = 0;
    this.renderer.clearDynamic();
    this.renderer.worldRoot.add(this.overworldRoot, this.dungeonRoot);
  }

  // ---------------------------------------------------------------- frame

  /** Called by the kit every frame (dt in seconds, already clamped to 0.1). */
  frame(dt) {
    if (this.destroyed) return;
    this.clock += dt;
    this.denyCooldown = Math.max(0, this.denyCooldown - dt);
    const menuAtStart = this.mode === "menu" || this.ui.isBlockingInput();
    this.handleMenusAndShortcuts(dt);
    if (this.player && this.mode !== "menu") {
      if (!menuAtStart && !this.ui.isBlockingInput() && this.player.alive) {
        this.router.sample(dt);
        if (this.router.pressed("zoom")) this.renderer.cycleZoom();
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= FIXED_DT && steps < 6) {
          this.fixedUpdate(FIXED_DT);
          this.accumulator -= FIXED_DT;
          steps += 1;
          if (!this.player?.alive || this.mode === "menu") break;
        }
        // After a long hitch, drop the backlog instead of fast-forwarding through it.
        if (this.accumulator >= FIXED_DT) this.accumulator = 0;
      } else {
        this.router.reset();
      }
      if (this.player) this.visualUpdate(dt);
    }
    if (this.panelDirty) {
      this.panelDirty = false;
      this.ui.refreshOpenPanel();
      if (this.currentNpc && this.ui.interaction) this.refreshInteraction();
    }
    this.syncTouch();
    this.renderer.render(dt);
  }

  fixedUpdate(dt) {
    if (!this.player || !this.combat || !this.ai || !this.world) {
      return;
    }
    this.record.playSeconds += dt;
    this.handlePlayerInput(dt);
    this.combat.update(dt);
    this.combat.updateEffects(dt);
    this.ai.update(dt);
    this.updatePickups(dt);
    this.updateDeadEnemies(dt);
    this.trial?.update(dt);
    this.persistence.timeOfDay = (this.persistence.timeOfDay + dt / 780) % 1;
    this.renderer.setTimeOfDay(this.persistence.timeOfDay);
    if (this.mode === "overworld") {
      this.chunkManager?.update(this.player.x, this.player.z);
      this.syncTimer -= dt;
      if (this.syncTimer <= 0) {
        this.syncTimer = 0.28;
        this.syncWorldContent(false);
      }
      this.checkDiscoveries();
    }
    this.updateInteractionCandidate();
    this.saveTimer += dt;
    if (this.saveTimer >= 45 && this.mode === "overworld" && !this.trial) {
      this.saveTimer = 0;
      this.saveNow(false);
    }
  }

  visualUpdate(dt) {
    if (!this.player || !this.world) {
      return;
    }
    this.player.updateVisual(dt);
    for (let enemy of this.enemies.values()) {
      enemy.updateVisual(dt, this.renderer.camera);
    }
    for (let npc of this.npcs.values()) {
      npc.update(dt, this.clock);
    }
    for (let pickup of this.pickups) {
      pickup.age += dt;
      pickup.mesh.rotation.y += dt * 1.4;
      pickup.mesh.position.y = pickup.baseY + Math.sin(this.clock * 2.8 + pickup.phase) * 0.13;
    }
    this.dungeon?.update(dt, this.clock);
    this.renderer.setCameraTarget(this.player.position2D, dt);
    if (!this.ui.isBlockingInput()) {
      const zoom = this.kit.input.zoom();
      if (zoom !== 0) this.renderer.adjustZoom(-zoom);
    }
    this.renderer.setBiome(this.currentBiome());
    let boss = null;
    for (const enemy of this.enemies.values()) {
      if (!enemy.dead && enemy.archetype.id.startsWith("boss-")) {
        boss = enemy;
        break;
      }
    }
    this.ui.setBoss(boss?.archetype.name, boss?.health, boss?.maxHealth, boss?.phase);
    this.ui.setTrial(this.trial ? this.trial.label : "");
    this.ui.refresh(dt);
  }

  currentBiome() {
    if (this.mode === "dungeon" && this.currentDungeonPoi) return this.currentDungeonPoi.biome;
    return this.world.getBiomeAt(this.player.x, this.player.z);
  }

  // ---------------------------------------------------------------- menus and input

  handleMenusAndShortcuts(dt) {
    const input = this.kit.input;
    const ui = this.ui;
    // Controller players never click: try to start the audio on their button presses too.
    if (
      input.source === "gamepad" &&
      this.audio.context?.state !== "running" &&
      (input.pressed("confirm") || input.pressed("pause") || input.pressed("attack"))
    ) {
      this.audio.unlock();
    }
    if (this.mode === "menu" || !this.player || !this.player.alive) {
      // Title screen or death screen: only menu navigation.
      this.menuNavigation(dt);
      return;
    }
    if (input.pressed("pause")) {
      if (ui.isBlockingInput()) this.closeMenus();
      else ui.openPanel("pause");
      return;
    }
    if (ui.isBlockingInput()) {
      if (input.pressed("back")) {
        ui.back();
        return;
      }
      if (input.pressed("tabPrev")) ui.cyclePanel(-1);
      if (input.pressed("tabNext")) ui.cyclePanel(1);
      for (const [action, panel] of PANEL_ACTIONS) {
        if (input.pressed(action)) {
          this.togglePanel(panel);
          return;
        }
      }
      this.menuNavigation(dt);
      return;
    }
    for (const [action, panel] of PANEL_ACTIONS) {
      if (input.pressed(action)) {
        this.togglePanel(panel);
        return;
      }
    }
  }

  menuNavigation(dt) {
    const dir = this.router.menuDirection(dt);
    if (dir) this.ui.navigate(dir);
    if (this.kit.input.pressed("confirm")) this.ui.activate();
  }

  togglePanel(panel) {
    if (this.ui.interaction) {
      this.ui.closeInteraction();
      this.clearNpc();
    }
    const wasOpen = this.ui.activePanel === panel;
    this.ui.togglePanel(panel);
    if (wasOpen) this.onMenusClosed();
  }

  closeMenus() {
    if (this.ui.interaction) {
      this.ui.closeInteraction();
      this.clearNpc();
    }
    if (this.ui.activePanel) this.ui.closePanels();
    this.onMenusClosed();
  }

  /** A menu closed: whatever button closed it must not also act in the game. */
  onMenusClosed() {
    this.kit.input.settle();
    this.router.reset();
  }

  clearNpc() {
    this.currentNpc = undefined;
    this.currentPoi = undefined;
    this.currentShop = [];
  }

  /** Hide the touch controls behind menus, show Use only when something is in reach. */
  syncTouch() {
    const touch = this.kit.touch;
    if (!touch) return;
    const hidden = this.mode === "menu" || !this.player || !this.player.alive || this.ui.isBlockingInput();
    if (hidden !== this.touchHidden) {
      this.touchHidden = hidden;
      touch.suspend(hidden, "menu");
    }
    const canUse = !hidden && !!this.interactionCandidate;
    if (canUse !== this.touchUse) {
      this.touchUse = canUse;
      touch.setShown("interact", canUse);
    }
    const potions = this.player?.potions ?? 0;
    if (potions !== this.touchPotion) {
      this.touchPotion = potions;
      const label = document.createElement("span");
      label.className = "touch-count";
      label.innerHTML = potions > 0 ? `Potion<b>×${potions}</b>` : "Potion";
      touch.setLabel("potion", label);
    }
  }

  handlePlayerInput(dt) {
    const player = this.player;
    if (this.ui.isBlockingInput() || !player.alive) {
      return;
    }
    const router = this.router;
    const source = this.kit.input.source;
    // Facing: the mouse points it; a controller's right stick or the direction of travel otherwise.
    if (source === "keyboard") {
      const aim = this.getAimPoint();
      const toward = normalize2D(aim.x - player.x, aim.z - player.z);
      if (Math.hypot(toward.x, toward.z) > 0.01) player.facing = angleOf(toward.x, toward.z);
    } else if (source === "gamepad" && router.aimStickActive) {
      player.facing = angleOf(router.aimStick.x, router.aimStick.z);
    } else if (router.moving && player.dodgeTime <= 0) {
      player.facing = angleOf(router.move.x, router.move.z);
    }
    const move = router.moving ? { x: router.move.x, z: router.move.z } : { x: 0, z: 0 };
    if (router.has("dodge") && player.dodgeTime <= 0) {
      if (player.dodgeCooldown <= 0 && player.resource >= 12) {
        router.take("dodge");
        const along = router.moving ? normalize2D(move.x, move.z) : directionFromAngle(player.facing);
        player.resource -= 12;
        player.dodgeTime = 0.25;
        player.dodgeCooldown = 0.78;
        player.invulnerable = 0.34;
        player.velocity = {
          x: along.x * 17,
          z: along.z * 17,
        };
        this.events.emit("combat", {
          sourceId: player.id,
          kind: "dodge",
          position: player.position2D,
          label: "DODGE",
        });
        this.audio.play("dodge");
      } else if (player.dodgeCooldown <= 0) {
        router.take("dodge");
        this.deny("NO FOCUS");
      }
    }
    if (player.dodgeTime > 0) {
      this.tryMovePlayer(player.x + player.velocity.x * dt, player.z + player.velocity.z * dt);
    } else {
      const stats = player.getStats();
      const terrain = this.mode === "overworld" ? this.world.getMovementMultiplierAt(player.x, player.z) : 1;
      const chill = player.statusEffects.find((s) => s.id === "chill");
      const speed = stats.moveSpeed * 6.2 * terrain * (chill ? 1 - chill.magnitude : 1);
      // Analog sticks walk as well as run: the move vector keeps its length (≤ 1).
      const k = 1 - Math.exp(-dt * 16);
      player.velocity.x += (move.x * speed - player.velocity.x) * k;
      player.velocity.z += (move.z * speed - player.velocity.z) * k;
      this.tryMovePlayer(player.x + player.velocity.x * dt, player.z + player.velocity.z * dt);
    }
    if (router.attackHeld && player.attackCooldown <= 0) {
      if (this.combat.primaryAttack(this.getAimPoint())) this.audio.play("swing");
    }
    if (router.has("power")) {
      if (this.combat.secondaryAttack(this.getAimPoint())) {
        router.take("power");
        this.audio.play("swing");
      } else if (player.secondaryCooldown <= 0) {
        router.take("power");
        this.deny("NO FOCUS");
      }
    }
    for (let k = 0; k < SKILL_ACTIONS.length; k += 1) {
      const name = SKILL_ACTIONS[k];
      if (router.has(name) && this.tryHotbar(k) !== "wait") router.take(name);
    }
    if (router.has("potion")) {
      router.take("potion");
      this.tryPotion();
    }
    if (router.has("interact")) {
      router.take("interact");
      this.interact();
    }
  }

  /** A short "no" for an action that cannot happen right now (sound, and a word by the player). */
  deny(label) {
    this.audio.play("deny");
    if (label && this.denyCooldown <= 0 && this.player) {
      this.denyCooldown = 0.8;
      this.ui.showCombatNumber(this.player.position2D, 0, "status", label);
    }
  }

  tryMovePlayer(x, z) {
    if (!!this.player && !!this.canMove(x, z, true)) {
      this.player.setPosition(x, z, this.getHeight(x, z));
    }
  }

  canMove(x, z, isPlayer) {
    if (this.mode === "dungeon" && this.dungeon) {
      return this.dungeon.isWalkable({ x, z }, isPlayer ? 0.55 : 0.45);
    }
    return Number.isFinite(x) && Number.isFinite(z);
  }

  getHeight(x, z) {
    if (this.mode === "dungeon") {
      return 0.08;
    }
    return this.world?.getHeightAt(x, z) ?? 0;
  }

  /**
   * Where attacks and abilities aim. Mouse players aim at the cursor; a
   * controller's right stick picks a direction; otherwise (touch, or an idle
   * stick) the nearest foe ahead is the target, then straight ahead.
   */
  getAimPoint() {
    const player = this.player;
    if (!player) return { x: 0, z: 0 };
    const source = this.kit.input.source;
    if (source === "keyboard") {
      const pointer = this.kit.input.pointer;
      return this.renderer.screenToGround(pointer.nx, pointer.ny, this.mode === "dungeon" ? 0 : this.getHeight(player.x, player.z));
    }
    if (source === "gamepad" && this.router.aimStickActive) {
      return { x: player.x + this.router.aimStick.x * 7, z: player.z + this.router.aimStick.z * 7 };
    }
    const target = this.findAutoTarget(11);
    if (target) return { x: target.x, z: target.z };
    const ahead = directionFromAngle(player.facing);
    return { x: player.x + ahead.x * 6, z: player.z + ahead.z * 6 };
  }

  findAutoTarget(range) {
    const player = this.player;
    const fx = Math.sin(player.facing);
    const fz = Math.cos(player.facing);
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies.values()) {
      if (enemy.dead) continue;
      const dx = enemy.x - player.x;
      const dz = enemy.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      // Prefer what the player is facing, then what is closest.
      const ahead = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = d - ahead * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  projectToScreen(position) {
    return this.renderer.worldToScreen(position.x, this.getHeight(position.x, position.z) + 1.9, position.z);
  }

  /** 'ok', 'wait' (cooling down: keep the press buffered) or 'fail'. */
  tryHotbar(slot) {
    const player = this.player;
    if (!player || !this.combat || !player.alive || this.ui.isBlockingInput()) return "fail";
    const skill = SKILLS.find((s) => s.id === player.hotbar[slot]);
    if (!skill) {
      this.deny("EMPTY SLOT");
      return "fail";
    }
    if ((player.skillCooldowns.get(skill.id) ?? 0) > 0) return "wait";
    if (player.resource < skill.cost) {
      this.deny("NO FOCUS");
      return "fail";
    }
    if (this.combat.useSkill(skill.id, this.getAimPoint())) {
      this.audio.play("attack");
      return "ok";
    }
    return "fail";
  }

  useHotbar(slot) {
    this.tryHotbar(slot);
  }

  tryPotion() {
    const player = this.player;
    if (!player || !this.combat) return;
    if (this.combat.usePotion()) {
      this.kit.input.rumble(0.2, 80);
      return;
    }
    this.deny(player.potions <= 0 ? "NO DRAUGHTS" : "FULL HEALTH");
  }

  // ---------------------------------------------------------------- world content

  syncWorldContent(force) {
    if (this.mode !== "overworld" || !this.chunkManager || !this.world || !this.player) {
      return;
    }
    let chunks = this.chunkManager.getActiveChunkData();
    let present = new Set();
    for (let chunk of chunks) {
      for (let spawn of chunk.enemySpawns) {
        present.add(spawn.id);
        if (
          !this.persistence.clearedPoiIds.includes(spawn.guardingPoiId ?? "") &&
          !this.enemies.has(spawn.id) &&
          !this.defeatedSession.has(spawn.id) &&
          !this.persistence.defeatedImportantEntityIds.includes(spawn.id)
        ) {
          this.spawnEnemy(spawn, "chunk");
        }
      }
    }
    for (let [id, source] of this.enemySources) {
      if (source === "chunk" && !present.has(id)) {
        this.removeEnemy(id);
      }
    }
    const pois = this.chunkManager.getActivePois();
    let settlements = new Set();
    for (const poi of pois) if (poi.kind === "settlement") settlements.add(poi.id);
    let populated = new Set();
    for (const npc of this.npcs.values()) populated.add(npc.poiId);
    for (let poi of pois) {
      if (poi.kind === "settlement" && !populated.has(poi.id)) {
        for (let npc of this.settlements.generateNpcs(poi)) {
          npc.group.position.y = this.world.getHeightAt(npc.x, npc.z);
          this.npcs.set(npc.id, npc);
          this.renderer.dynamicRoot.add(npc.group);
        }
      }
    }
    for (let [id, npc] of this.npcs) {
      if (!settlements.has(npc.poiId)) {
        npc.group.removeFromParent();
        disposeTree(npc.group);
        this.npcs.delete(id);
      }
    }
    this.spawnGatherObjectives();
    if (force) {
      this.checkDiscoveries();
    }
  }

  rewardScale() {
    return (DIFFICULTY[this.settings.difficulty] ?? DIFFICULTY.normal).reward;
  }

  /** Scale an enemy's health and damage for the difficulty (again when it changes mid-journey). */
  applyDifficulty(enemy) {
    const k = DIFFICULTY[this.settings.difficulty] ?? DIFFICULTY.normal;
    enemy.baseMaxHealth ??= enemy.maxHealth;
    enemy.baseDamage ??= enemy.damage;
    const fraction = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    enemy.maxHealth = Math.max(1, Math.round(enemy.baseMaxHealth * k.health));
    enemy.health = enemy.dead ? 0 : Math.max(1, fraction * enemy.maxHealth);
    enemy.damage = enemy.baseDamage * k.damage;
  }

  spawnEnemy(spawn, source) {
    if (this.enemies.has(spawn.id) || this.defeatedSession.has(spawn.id)) {
      return;
    }
    let enemy = new Enemy(spawn);
    this.applyDifficulty(enemy);
    enemy.setPosition(spawn.x, spawn.z, this.getHeight(spawn.x, spawn.z));
    this.enemies.set(enemy.id, enemy);
    this.enemySources.set(enemy.id, source);
    this.renderer.dynamicRoot.add(enemy.group);
    return enemy;
  }

  spawnSummon(source, archetypeId, preferred) {
    let sequence = this.summonSequence++;
    let id = `summon:${source.id}:${sequence}`;
    let start = (sequence % 8) * (Math.PI / 4);
    let candidates = [preferred];
    for (let radius of [2.4, 1.5, 3.2]) {
      for (let h = 0; h < 8; h += 1) {
        let angle = start + h * (Math.PI / 4);
        candidates.push({
          x: source.x + Math.sin(angle) * radius,
          z: source.z + Math.cos(angle) * radius,
        });
      }
    }
    let at = candidates.find((c) => this.canMove(c.x, c.z, false));
    if (at) {
      const summoned = this.spawnEnemy(
        {
          id,
          x: at.x,
          z: at.z,
          archetypeId,
          level: Math.max(1, source.level - 1),
          elite: false,
          modifiers: [],
          guardingPoiId: source.guardingPoiId,
        },
        "summon",
      );
      if (summoned) summoned.aggro = source.aggro;
    }
  }

  onBossPhase(enemy) {
    this.events.emit("toast", { title: `${enemy.archetype.name} is enraged`, detail: "Its attacks come faster and harder.", tone: "bad" });
    this.audio.play("boss");
    if (this.settings.cameraShake && !this.settings.reduceMotion) this.renderer.shake(0.8);
    this.kit.input.rumble(0.75, 320);
  }

  onEnemyKilled(enemy) {
    if (!this.player || !this.progression || !this.questSystem || !this.world) {
      return;
    }
    const boss = enemy.archetypeId.startsWith("boss-");
    this.defeatedSession.add(enemy.id);
    this.record.kills += 1;
    if (boss) this.record.bosses += 1;
    else if (enemy.elite) this.record.elites += 1;
    this.questSystem.onEnemyKilled(enemy);
    const type = ENEMY_TYPES[enemy.archetypeId];
    const reward = this.rewardScale();
    this.progression.grantXp(Math.round(type.xp * (1 + enemy.level * 0.07) * (enemy.elite ? 1.5 : 1) * reward));
    let lootSeed = deriveSeed(this.seed, "enemy-loot", enemy.id);
    let drops = this.loot.rollDrops(lootSeed, enemy.level, enemy.elite, boss);
    let rng = new Rng(deriveSeed(lootSeed, "positions"));
    if (drops.gold > 0) {
      this.spawnPickup({
        x: enemy.x,
        z: enemy.z,
        gold: Math.round(drops.gold * reward),
      });
    }
    for (let item of drops.items) {
      this.spawnPickup({
        x: enemy.x + rng.range(-0.85, 0.85),
        z: enemy.z + rng.range(-0.85, 0.85),
        item,
      });
    }
    if (drops.potions > 0) {
      this.spawnPickup({
        x: enemy.x + 0.7,
        z: enemy.z - 0.5,
        potion: drops.potions,
      });
    }
    const transient = enemy.id.startsWith("trial:") || enemy.id.startsWith("summon:");
    if (enemy.elite && !transient && !this.persistence.defeatedImportantEntityIds.includes(enemy.id)) {
      this.persistence.defeatedImportantEntityIds.push(enemy.id);
    }
    if (boss && this.mode === "dungeon" && this.currentDungeonPoi) {
      this.dungeonBossDefeated = true;
      if (!this.persistence.clearedPoiIds.includes(this.currentDungeonPoi.id)) {
        this.persistence.clearedPoiIds.push(this.currentDungeonPoi.id);
        this.record.dungeons += 1;
      }
      this.questSystem.onPoiCleared(this.currentDungeonPoi.id);
      this.spawnDungeonQuestItems(this.currentDungeonPoi.id, enemy.position2D);
      this.events.emit("toast", {
        title: `${type.name} defeated`,
        detail: "The dungeon objective is complete. Return through the entry gate.",
        tone: "rare",
      });
      if (this.settings.cameraShake && !this.settings.reduceMotion) {
        this.renderer.shake(1.1);
      }
      this.kit.input.rumble(0.9, 420);
    }
    this.deadTimers.set(enemy.id, boss ? 1.2 : 0.5);
  }

  updateDeadEnemies(dt) {
    for (let [id, left] of [...this.deadTimers]) {
      let enemy = this.enemies.get(id);
      if (enemy) {
        enemy.group.rotation.z += dt * 2.8;
        enemy.group.scale.multiplyScalar(Math.max(0.84, 1 - dt * 1.2));
      }
      let next = left - dt;
      if (next <= 0) {
        this.removeEnemy(id);
        this.deadTimers.delete(id);
      } else {
        this.deadTimers.set(id, next);
      }
    }
  }

  removeEnemy(id) {
    let enemy = this.enemies.get(id);
    if (enemy) {
      enemy.group.removeFromParent();
      disposeTree(enemy.group);
      this.enemies.delete(id);
      this.enemySources.delete(id);
      this.deadTimers.delete(id);
    }
  }

  spawnPickup(spec) {
    let group = new THREE.Group();
    let color = 0xd8c06e;
    if (spec.item) {
      color = RARITY_HEX[spec.item.rarity] ?? color;
    }
    if (spec.potion) {
      color = 0xd35358;
    }
    if (spec.questItemId) {
      color = 0x76d7cb;
    }
    const large = !!spec.item;
    let gem = new THREE.Mesh(large ? PICKUP_GEOMETRY.gemLarge : PICKUP_GEOMETRY.gem, sharedBasic(color));
    let ring = new THREE.Mesh(large ? PICKUP_GEOMETRY.ringLarge : PICKUP_GEOMETRY.ring, sharedBasic(color, 0.7));
    ring.rotation.x = Math.PI / 2;
    group.add(gem, ring);
    let id = spec.id ?? `pickup:${this.pickupSequence++}:${deriveSeed(this.seed, spec.x * 100, spec.z * 100)}`;
    group.name = id;
    const baseY = this.getHeight(spec.x, spec.z) + 0.55;
    group.position.set(spec.x, baseY, spec.z);
    this.renderer.dynamicRoot.add(group);
    let pickup = {
      id,
      mesh: group,
      x: spec.x,
      z: spec.z,
      baseY,
      phase: (this.pickupSequence % 7) * 0.9,
      item: spec.item,
      gold: spec.gold,
      potion: spec.potion,
      questItemId: spec.questItemId,
      age: 0,
    };
    this.pickups.push(pickup);
    return pickup;
  }

  updatePickups() {
    if (!this.player || !this.progression || !this.questSystem) return;
    const px = this.player.x;
    const pz = this.player.z;
    for (let k = this.pickups.length - 1; k >= 0; k -= 1) {
      let pickup = this.pickups[k];
      if (Math.hypot(pickup.x - px, pickup.z - pz) > 1.45) {
        continue;
      }
      let taken = true;
      if (pickup.gold) {
        this.progression.grantGold(pickup.gold);
        this.events.emit("toast", {
          title: `+${pickup.gold} gold`,
          tone: "good",
        });
      } else if (pickup.potion) {
        this.player.potions += pickup.potion;
        this.events.emit("toast", {
          title: `+${pickup.potion} healing draught`,
          tone: "good",
        });
      } else if (pickup.questItemId) {
        this.questSystem.onQuestItem(pickup.questItemId, 1);
        if (!this.persistence.openedChestIds.includes(pickup.id)) {
          this.persistence.openedChestIds.push(pickup.id);
        }
      } else if (pickup.item) {
        taken = this.loot.addItem(this.player.inventory, pickup.item);
        if (taken) {
          this.events.emit("toast", {
            title: pickup.item.name,
            detail: `${pickup.item.rarity} ${pickup.item.category}`,
            tone: pickup.item.rarity === "epic" || pickup.item.rarity === "legendary" ? "rare" : "good",
          });
        } else if (!pickup.fullWarned) {
          // Warn once per pickup, not every step the player stands on it.
          pickup.fullWarned = true;
          this.events.emit("toast", {
            title: "Inventory full",
            detail: "Make room before collecting this item.",
            tone: "bad",
          });
        }
      }
      if (taken) {
        if (pickup.id.startsWith("chest:") && !this.persistence.openedChestIds.includes(pickup.id)) {
          this.persistence.openedChestIds.push(pickup.id);
        }
        pickup.mesh.removeFromParent();
        disposeTree(pickup.mesh);
        this.pickups.splice(k, 1);
        this.audio.play("loot");
        this.events.emit("inventoryChanged", undefined);
        this.events.emit("playerChanged", undefined);
      }
    }
  }

  spawnGatherObjectives() {
    if (!this.questSystem || !this.player) return;
    for (let quest of this.questSystem.quests) {
      if (
        quest.state !== "active" ||
        quest.type !== "gather" ||
        !quest.targetItemId ||
        distance2D(this.player.position2D, quest.location) > 130
      ) {
        continue;
      }
      let rng = new Rng(deriveSeed(quest.seed, "gather-nodes"));
      for (let n = 0; n < quest.required; n += 1) {
        let id = `questnode:${quest.id}:${n}`;
        // The rolls happen for every node so each keeps its seeded spot.
        let angle = rng.range(0, Math.PI * 2);
        let radius = rng.range(7, 24);
        if (this.spawnedObjectives.has(id) || this.persistence.openedChestIds.includes(id)) {
          continue;
        }
        this.spawnPickup({
          id,
          x: quest.location.x + Math.sin(angle) * radius,
          z: quest.location.z + Math.cos(angle) * radius,
          questItemId: quest.targetItemId,
        });
        this.spawnedObjectives.add(id);
      }
    }
  }

  ensureQuestTargets(quest) {
    if (!this.world) return;
    if (quest.type === "hunt" || quest.type === "defend") {
      let rng = new Rng(deriveSeed(quest.seed, "targets"));
      for (let n = 0; n < quest.required + 1; n += 1) {
        let id = `questenemy:${quest.id}:${n}`;
        // Roll first so every target keeps its seeded place whether or not it is spawned now.
        let angle = (n / (quest.required + 1)) * Math.PI * 2 + rng.range(-0.2, 0.2);
        let radius = rng.range(17, 31);
        let x = quest.location.x + Math.sin(angle) * radius;
        let z = quest.location.z + Math.cos(angle) * radius;
        let biome = this.world.getBiomeAt(x, z);
        let archetypeId = quest.type === "hunt" && quest.targetArchetypeId ? quest.targetArchetypeId : rng.pick(BIOMES[biome].enemyIds);
        let level = Math.max(1, quest.difficulty + rng.int(-1, 1));
        if (this.enemies.has(id) || this.defeatedSession.has(id)) {
          continue;
        }
        const champion = n === quest.required && quest.difficulty >= 3;
        this.spawnEnemy(
          {
            id,
            x,
            z,
            archetypeId,
            level,
            elite: champion,
            modifiers: champion ? ["Frenzied"] : [],
            guardingPoiId: quest.targetPoiId,
          },
          "quest",
        );
      }
    }
    this.spawnGatherObjectives();
  }

  reconcileQuestState(quest) {
    if (!this.world || !this.questSystem || quest.state !== "active") {
      return;
    }
    let poi = quest.targetPoiId ? this.world.getPoiById(quest.targetPoiId) : undefined;
    if (poi) {
      if (this.persistence.discoveredPoiIds.includes(poi.id)) {
        this.questSystem.onPoiDiscovered(poi);
      }
      if (quest.state === "active") {
        if (this.persistence.clearedPoiIds.includes(poi.id)) {
          this.questSystem.onPoiCleared(poi.id);
        }
        if (quest.state === "active" && this.persistence.openedChestIds.includes(`activated:${poi.id}`)) {
          this.questSystem.onActivatedPoi(poi.id);
        }
      }
    }
  }

  checkDiscoveries() {
    if (!this.chunkManager || !this.player) return;
    const px = this.player.x;
    const pz = this.player.z;
    for (let poi of this.chunkManager.getActivePois()) {
      let reach = poi.kind === "settlement" ? 28 + (poi.tier ?? 1) * 4 : 14;
      if (Math.hypot(poi.x - px, poi.z - pz) <= reach) {
        this.discoverPoi(poi, true);
      }
    }
  }

  discoverPoi(poi, announce) {
    if (!this.persistence.discoveredPoiIds.includes(poi.id)) {
      this.persistence.discoveredPoiIds.push(poi.id);
      this.questSystem?.onPoiDiscovered(poi);
      if (announce) {
        this.events.emit("discovery", poi);
        this.progression?.grantXp(18 + poi.danger * 4, "Location discovered");
      }
    }
  }

  // ---------------------------------------------------------------- interaction

  updateInteractionCandidate() {
    if (!this.player) return;
    this.interactionCandidate = undefined;
    const px = this.player.x;
    const pz = this.player.z;
    if (this.mode === "dungeon" && this.dungeon) {
      if (Math.hypot(this.dungeon.data.exit.x - px, this.dungeon.data.exit.z - pz) <= 2.6) {
        this.interactionCandidate = { kind: "exit" };
        this.ui.showInteractionPrompt(this.dungeonBossDefeated ? "Leave cleared dungeon" : "Leave dungeon");
      } else {
        this.ui.showInteractionPrompt();
      }
      return;
    }
    let nearestNpc;
    let npcDistance = Number.POSITIVE_INFINITY;
    for (let npc of this.npcs.values()) {
      let d = Math.hypot(npc.x - px, npc.z - pz);
      if (d < npcDistance) {
        npcDistance = d;
        nearestNpc = npc;
      }
    }
    if (nearestNpc && npcDistance <= 2.6) {
      this.interactionCandidate = { kind: "npc", npc: nearestNpc };
      this.ui.showInteractionPrompt(`Talk to ${nearestNpc.name}`);
      return;
    }
    // A shrine trial in progress takes the whole circle: nothing else to use until it ends.
    if (this.trial) {
      this.ui.showInteractionPrompt();
      return;
    }
    let poi;
    let poiDistance = Number.POSITIVE_INFINITY;
    for (const candidate of this.chunkManager?.getActivePois() ?? []) {
      const d = Math.hypot(candidate.x - px, candidate.z - pz);
      if (d <= (candidate.kind === "settlement" ? 8 : 6) && d < poiDistance) {
        poiDistance = d;
        poi = candidate;
      }
    }
    if (poi && USABLE_KINDS.includes(poi.kind)) {
      this.interactionCandidate = { kind: "poi", poi };
      const cleared = this.persistence.clearedPoiIds.includes(poi.id);
      const activated = this.persistence.openedChestIds.includes(`activated:${poi.id}`);
      let prompt;
      if (DUNGEON_KINDS.includes(poi.kind)) {
        prompt = cleared ? `Re-enter ${poi.name} · Cleared` : `Enter ${poi.name} · Danger ${poi.danger}`;
      } else if (poi.kind === "shrine" && activated) {
        prompt = this.persistence.completedTrials.includes(poi.id)
          ? `Pray at ${poi.name} · Trial won`
          : `Begin the Shrine Trial · Danger ${poi.danger}`;
      } else {
        prompt = `Examine ${poi.name}`;
      }
      this.ui.showInteractionPrompt(prompt);
      return;
    }
    this.ui.showInteractionPrompt();
  }

  interact() {
    let candidate = this.interactionCandidate;
    if (!candidate) return;
    if (candidate.kind === "exit") {
      this.exitDungeon();
    } else if (candidate.kind === "npc") {
      this.openNpc(candidate.npc);
    } else if (candidate.kind === "poi") {
      let poi = candidate.poi;
      if (DUNGEON_KINDS.includes(poi.kind)) {
        this.enterDungeon(poi);
        return;
      }
      const key = `activated:${poi.id}`;
      const questCredit = !!this.questSystem?.activeQuests().some((q) => q.type === "activate" && q.targetPoiId === poi.id);
      this.questSystem?.onActivatedPoi(poi.id);
      if (!this.persistence.openedChestIds.includes(key)) {
        this.persistence.openedChestIds.push(key);
        this.player.resource = this.player.getStats().maxResource;
        this.audio.play("heal");
        this.events.emit("toast", {
          title: `${poi.name} activated`,
          detail: poi.kind === "shrine" ? "Focus restored. The shrine offers a trial: use it again to begin." : "Focus restored.",
          tone: "good",
        });
      } else if (poi.kind === "shrine" && !questCredit) {
        if (this.persistence.completedTrials.includes(poi.id)) {
          this.player.resource = this.player.getStats().maxResource;
          this.audio.play("heal");
          this.events.emit("toast", { title: `${poi.name}`, detail: "The shrine is quiet. Focus restored.", tone: "good" });
        } else {
          this.startTrial(poi);
        }
      }
    }
  }

  startTrial(poi) {
    if (this.trial || this.mode !== "overworld" || !this.world) return;
    this.trial = new ShrineTrial(this, poi);
    this.events.emit("toast", {
      title: "Shrine Trial",
      detail: "Defeat three waves inside the circle before the light fades.",
      tone: "rare",
    });
    this.audio.play("trial");
    this.kit.input.rumble(0.3, 120);
  }

  openNpc(npc) {
    if (!this.world || !this.player || !this.questSystem) return;
    let poi = this.world.getPoiById(npc.poiId);
    if (!poi) return;
    this.currentNpc = npc;
    this.currentPoi = poi;
    let quests = this.questSystem.ensureForSettlement(poi, this.player.progress.level);
    this.currentShop =
      npc.role === "merchant" || npc.role === "smith"
        ? this.settlements.generateShopInventory(poi, this.player.progress.level, npc.role)
        : [];
    this.router.reset();
    this.refreshInteraction(quests);
  }

  refreshInteraction(quests) {
    if (!this.currentNpc || !this.currentPoi || !this.player || !this.questSystem) return;
    let reputation = this.player.progress.reputation[this.currentNpc.faction] ?? 0;
    this.ui.openInteraction({
      npc: this.currentNpc,
      poi: this.currentPoi,
      quests: quests ?? this.questSystem.quests,
      shopItems: this.currentShop,
      reputation,
      buyPrice: (item) => this.settlements.getBuyPrice(item, reputation),
      sellPrice: (item) => this.settlements.getSellPrice(item, reputation),
      player: this.player,
    });
  }

  // ---------------------------------------------------------------- dungeons

  enterDungeon(poi) {
    if (!this.player || !this.world || !this.chunkManager) return;
    if (this.trial) this.trial.fail("You left the shrine's circle.");
    this.clearRuntimeEntities(true);
    this.mode = "dungeon";
    this.currentDungeonPoi = poi;
    this.dungeonReturn = { x: poi.x, z: poi.z + 6 };
    this.dungeonBossDefeated = this.persistence.clearedPoiIds.includes(poi.id);
    this.chunkManager.setEnabled(false);
    this.overworldRoot.visible = false;
    this.dungeonRoot.visible = true;
    let data = this.dungeonGenerator.generate(poi);
    this.dungeon = new Dungeon(data);
    this.dungeonRoot.add(this.dungeon.group);
    this.dungeon.placeLight(this.renderer.dungeonLight);
    this.player.setPosition(data.entry.x, data.entry.z - 1.5, 0.08);
    this.player.velocity = { x: 0, z: 0 };
    this.discoverPoi(poi, false);
    this.questSystem?.onPoiDiscovered(poi);
    for (let spawn of this.dungeonGenerator.generateEnemySpawns(data, BIOMES[poi.biome].enemyIds)) {
      if (!this.dungeonBossDefeated || !spawn.archetypeId.startsWith("boss-")) {
        this.spawnEnemy(spawn, "dungeon");
      }
    }
    if (this.dungeonBossDefeated) {
      let bossRoom = data.rooms.find((room) => room.id === data.bossRoomId);
      if (bossRoom) {
        this.spawnDungeonQuestItems(poi.id, { x: bossRoom.x, z: bossRoom.z });
      }
    }
    for (let room of data.rooms.filter((r) => r.kind === "treasure")) {
      let id = `chest:${poi.id}:${room.id}`;
      if (!this.persistence.openedChestIds.includes(id)) {
        let item = this.loot.generateItem(deriveSeed(data.seed, room.id, "cache"), Math.max(1, data.level), 0.18);
        this.spawnPickup({ id, x: room.x, z: room.z, item });
      }
    }
    this.renderer.snapCamera(this.player.position2D);
    this.events.emit("toast", {
      title: data.name,
      detail: `${data.modifier} ${data.theme} · Level ${data.level}`,
      tone: "rare",
    });
    this.audio.play("quest");
  }

  exitDungeon(save = true) {
    if (!this.player || !this.chunkManager || !this.world) return;
    this.clearRuntimeEntities(true);
    this.dungeon?.dispose();
    this.dungeon = undefined;
    this.renderer.dungeonLight.intensity = 0;
    this.dungeonRoot.visible = false;
    this.overworldRoot.visible = true;
    this.mode = "overworld";
    this.chunkManager.setEnabled(true);
    let back = this.dungeonReturn ?? this.world.getStartingSettlement();
    this.player.setPosition(back.x, back.z, this.world.getHeightAt(back.x, back.z));
    this.player.velocity = { x: 0, z: 0 };
    this.currentDungeonPoi = undefined;
    this.dungeonReturn = undefined;
    this.chunkManager.update(this.player.x, this.player.z, true);
    this.syncWorldContent(true);
    for (let quest of this.quests) {
      if (quest.state === "active") {
        this.ensureQuestTargets(quest);
      }
    }
    this.renderer.snapCamera(this.player.position2D);
    if (save) this.saveNow(false);
  }

  spawnDungeonQuestItems(poiId, at) {
    let wanted = this.questSystem?.getQuestItemsForPoi(poiId) ?? [];
    for (let entry of wanted) {
      let placed = 0;
      for (let a = 0; a < entry.count && placed < entry.remaining; a += 1) {
        let id = `questloot:${entry.questId}:${a}`;
        if (!this.persistence.openedChestIds.includes(id) && !this.pickups.some((p) => p.id === id)) {
          this.spawnPickup({
            id,
            x: at.x + (a - entry.count / 2) * 0.9,
            z: at.z + 0.9,
            questItemId: entry.itemId,
          });
          placed += 1;
        }
      }
    }
  }

  clearRuntimeEntities(keepPlayer) {
    for (let enemy of this.enemies.values()) {
      enemy.group.removeFromParent();
      disposeTree(enemy.group);
    }
    for (let npc of this.npcs.values()) {
      npc.group.removeFromParent();
      disposeTree(npc.group);
    }
    for (let pickup of this.pickups) {
      pickup.mesh.removeFromParent();
      disposeTree(pickup.mesh);
    }
    for (let list of [this.projectiles, this.areas]) {
      for (let entry of list) {
        entry.mesh.removeFromParent();
        disposeTree(entry.mesh);
      }
    }
    this.enemies.clear();
    this.enemySources.clear();
    this.npcs.clear();
    this.pickups.length = 0;
    this.projectiles.length = 0;
    this.areas.length = 0;
    this.spawnedObjectives.clear();
    this.deadTimers.clear();
    this.combat?.clearEffects();
    for (let child of [...this.renderer.effectsRoot.children]) {
      child.removeFromParent();
      disposeTree(child);
    }
    this.interactionCandidate = undefined;
    this.ui.showInteractionPrompt();
    if (!keepPlayer && this.player) {
      this.player.group.removeFromParent();
      disposeTree(this.player.group);
    } else if (keepPlayer && this.player && !this.player.group.parent) {
      this.renderer.dynamicRoot.add(this.player.group);
    }
  }

  // ---------------------------------------------------------------- death

  onPlayerDeath() {
    let lost = this.progression?.applyDeathPenalty() ?? 0;
    this.record.deaths += 1;
    if (this.trial) this.trial.fail("The trial ends with your fall.");
    this.router.reset();
    if (this.ui.interaction) {
      this.ui.closeInteraction();
      this.clearNpc();
    }
    this.ui.showDeath(lost, this.record);
    this.audio.play("death");
    this.kit.input.rumble(0.9, 380);
  }

  respawn() {
    if (!this.player || !this.world) return;
    if (this.mode === "dungeon") {
      this.exitDungeon(false);
    }
    let home =
      this.world
        .getPoisAround(this.player.x, this.player.z, 650)
        .filter((poi) => poi.kind === "settlement")
        .sort((a, b) => distance2D(this.player.position2D, a) - distance2D(this.player.position2D, b))[0] ??
      this.world.getStartingSettlement();
    this.player.alive = true;
    this.player.statusEffects.length = 0;
    this.player.dodgeTime = 0;
    this.player.velocity = { x: 0, z: 0 };
    // A moment of grace so nothing lands a hit during the first step back.
    this.player.invulnerable = 1.5;
    this.player.setPosition(home.x, home.z + 6, this.world.getHeightAt(home.x, home.z + 6));
    this.player.refreshVitals(true);
    this.ui.hideDeath();
    this.events.emit("toast", {
      title: `Returned to ${home.name}`,
      detail: "Health and focus restored.",
      tone: "good",
    });
    this.chunkManager?.update(this.player.x, this.player.z, true);
    this.syncWorldContent(true);
    this.renderer.snapCamera(this.player.position2D);
    this.accumulator = 0;
    this.onMenusClosed();
    this.saveNow(false);
  }

  // ---------------------------------------------------------------- saving

  saveNow(announce = true) {
    if (!this.player || !this.world || this.mode === "menu") return;
    let snapshot = this.player.snapshot();
    if (this.mode === "dungeon" && this.dungeonReturn) {
      snapshot.x = this.dungeonReturn.x;
      snapshot.z = this.dungeonReturn.z;
    }
    let data = {
      version: 1,
      timestamp: Date.now(),
      seedText: this.seedText,
      seed: this.seed,
      player: snapshot,
      quests: JSON.parse(JSON.stringify(this.quests)),
      world: JSON.parse(JSON.stringify(this.persistence)),
      settings: { ...this.settings },
      stats: { ...this.record, playSeconds: Math.round(this.record.playSeconds) },
    };
    try {
      this.saveSystem.save(data);
      this.events.emit("save", { timestamp: data.timestamp });
      this.ui.updateContinueAvailability(true, `Level ${this.player.progress.level} ${this.player.archetype.name} · ${this.seedText}`);
      if (announce) {
        this.events.emit("toast", {
          title: "Journey saved",
          detail: "Stored locally in this browser.",
          tone: "good",
        });
      }
    } catch (error) {
      console.error(error);
      this.events.emit("toast", {
        title: "Save failed",
        detail: "Local storage was unavailable.",
        tone: "bad",
      });
    }
  }

  // ---------------------------------------------------------------- UI

  buildUIView() {
    const player = this.player;
    if (!player || !this.world) return undefined;
    const game = this;
    const biome = this.currentBiome();
    const pois =
      this.mode === "overworld"
        ? (this.chunkManager?.getActivePois() ?? [])
        : this.currentDungeonPoi
          ? [this.currentDungeonPoi]
          : [];
    let nearest;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const poi of pois) {
      if (!this.persistence.discoveredPoiIds.includes(poi.id)) continue;
      const d = Math.hypot(poi.x - player.x, poi.z - player.z);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = poi;
      }
    }
    return {
      seedText: this.seedText,
      biome,
      biomeName: BIOMES[biome].name,
      danger: this.mode === "dungeon" ? (this.dungeon?.data.level ?? 1) : this.world.getDangerAt(player.x, player.z),
      locationName: nearest && nearestDistance < 45 ? nearest.name : BIOMES[biome].name,
      worldTime: this.persistence.timeOfDay,
      inDungeon: this.mode === "dungeon",
      dungeonName: this.dungeon?.data.name,
      player,
      quests: this.quests,
      activePois: pois,
      // Only the map and pause panels read this, so it is built on demand.
      get discoveredPois() {
        return game.persistence.discoveredPoiIds.map((id) => game.world?.getPoiById(id)).filter(Boolean);
      },
      enemies: [...this.enemies.values()],
      npcs: [...this.npcs.values()],
      settings: this.settings,
      stats: this.record,
      completedTrials: new Set(this.persistence.completedTrials),
    };
  }

  handleUIAction(action) {
    switch (action.type) {
      case "new-game": {
        let archetype = action.data?.archetype ?? "vanguard";
        let seedText = action.value?.trim() || "Seedfall-001";
        this.initializeRun(seedText, hashString(seedText), archetype, undefined, action.data?.difficulty);
        return;
      }
      case "continue": {
        let save = this.saveSystem.load();
        if (save) {
          this.initializeRun(save.seedText, save.seed, save.player.archetype, save);
        } else {
          this.ui.showToast("No valid save found", undefined, "bad");
        }
        return;
      }
      case "open-settings":
        this.kit.menu.open();
        return;
      case "panels-closed":
        this.onMenusClosed();
        return;
      case "close-interaction":
        this.clearNpc();
        this.onMenusClosed();
        return;
      case "setting":
        // No re-render: the slider or box the player is touching already shows the value.
        this.changeSetting(action.value, action.data?.value);
        return;
      case "equip":
        if (this.player && action.value && this.loot.equip(this.player.inventory, this.player.equipment, action.value)) {
          this.player.refreshVitals(false);
          this.audio.play("click");
          this.events.emit("equipmentChanged", undefined);
        }
        break;
      case "unequip":
        if (this.player && action.value) {
          if (this.loot.unequip(this.player.inventory, this.player.equipment, action.value)) {
            this.player.refreshVitals(false);
            this.audio.play("click");
            this.events.emit("equipmentChanged", undefined);
          } else {
            this.events.emit("toast", { title: "Inventory full", detail: "Free a slot to unequip this.", tone: "bad" });
          }
        }
        break;
      case "salvage":
        this.salvageItem(action.value);
        break;
      case "temper":
        this.temperGear(action.value);
        break;
      case "learn-skill":
        if (this.player && action.value && this.player.learnSkill(action.value)) {
          const skill = SKILLS.find((s) => s.id === action.value);
          const slotted = !skill?.active || this.player.hotbar.includes(action.value);
          this.events.emit("toast", {
            title: "Skill learned",
            detail: slotted ? skill?.name : `${skill?.name} · pick a slot for it below its card`,
            tone: "rare",
          });
          this.audio.play("level");
          this.events.emit("playerChanged", undefined);
        }
        break;
      case "assign-hotbar":
        this.assignHotbar(action.value);
        break;
      case "attribute":
        if (this.player && action.value && this.player.allocateAttribute(action.value)) {
          this.audio.play("click");
          this.events.emit("playerChanged", undefined);
        }
        break;
      case "respec":
        this.respecPlayer();
        break;
      case "set-difficulty":
        this.setDifficulty(action.value);
        break;
      case "accept-quest":
        if (action.value && this.questSystem?.accept(action.value)) {
          let quest = this.questSystem.quests.find((q) => q.id === action.value);
          if (quest) {
            this.reconcileQuestState(quest);
            if (quest.state === "active") {
              this.ensureQuestTargets(quest);
            }
          }
          this.audio.play("quest");
        }
        break;
      case "abandon-quest":
        if (action.value && this.questSystem) {
          let quest = this.questSystem.quests.find((q) => q.id === action.value);
          if (quest && this.questSystem.abandon(action.value)) {
            this.resetQuestRuntime(quest);
          }
        }
        break;
      case "turnin-quest":
        this.turnInQuest(action.value);
        break;
      case "buy":
        this.buyItem(action.value);
        break;
      case "sell":
        this.sellItem(action.value);
        break;
      case "heal-service":
        this.useHealingService();
        break;
      case "rest-service":
        this.restAtInn();
        break;
      case "use-potion":
        this.tryPotion();
        break;
      case "use-hotbar":
        if (action.value !== undefined) {
          this.useHotbar(Number(action.value));
        }
        return;
      case "save":
        this.saveNow(true);
        break;
      case "return-menu":
        this.saveNow(false);
        this.teardownRun();
        this.showTitle();
        return;
      case "respawn":
        this.respawn();
        return;
      default:
        return;
    }
    this.ui.refreshOpenPanel();
    if (this.currentNpc && this.ui.interaction) this.refreshInteraction();
  }

  assignHotbar(value) {
    const player = this.player;
    if (!player || !value) return;
    const cut = value.lastIndexOf(":");
    const id = value.slice(0, cut);
    const slot = Number(value.slice(cut + 1));
    const skill = SKILLS.find((s) => s.id === id);
    if (!skill?.active || !player.learnedSkills.some((s) => s.id === id) || !(slot >= 0 && slot < 6)) return;
    const current = player.hotbar.indexOf(id);
    if (current === slot) {
      // Picking the slot it already sits in takes it off the bar.
      player.hotbar[slot] = null;
    } else {
      const previous = player.hotbar[slot];
      player.hotbar[slot] = id;
      if (current >= 0) player.hotbar[current] = previous ?? null;
    }
    this.audio.play("click");
    this.events.emit("playerChanged", undefined);
  }

  setDifficulty(value) {
    if (!DIFFICULTY[value] || value === this.settings.difficulty) return;
    this.settings.difficulty = value;
    for (const enemy of this.enemies.values()) this.applyDifficulty(enemy);
    this.audio.play("click");
    this.events.emit("toast", { title: "Difficulty changed", detail: `Now playing on ${value[0].toUpperCase()}${value.slice(1)}.`, tone: "good" });
  }

  resetQuestRuntime(quest) {
    let prefix = `questenemy:${quest.id}:`;
    for (let id of [...this.enemies.keys()]) {
      if (id.startsWith(prefix)) {
        this.removeEnemy(id);
      }
    }
    for (let id of [...this.defeatedSession]) {
      if (id.startsWith(prefix)) this.defeatedSession.delete(id);
    }
    let prefixes = [`questnode:${quest.id}:`, `questloot:${quest.id}:`];
    for (let k = this.pickups.length - 1; k >= 0; k -= 1) {
      let pickup = this.pickups[k];
      if (prefixes.some((p) => pickup.id.startsWith(p))) {
        pickup.mesh.removeFromParent();
        disposeTree(pickup.mesh);
        this.pickups.splice(k, 1);
      }
    }
    for (let id of [...this.spawnedObjectives]) {
      if (id.startsWith(`questnode:${quest.id}:`)) {
        this.spawnedObjectives.delete(id);
      }
    }
    this.persistence.openedChestIds = this.persistence.openedChestIds.filter((id) => !prefixes.some((p) => id.startsWith(p)));
  }

  salvageItem(itemId) {
    if (!this.player || !itemId) return;
    let item = this.player.inventory.find((a) => a.id === itemId);
    if (!item || !item.slot) {
      this.events.emit("toast", {
        title: "Cannot salvage item",
        detail: "Only weapons, armor, and accessories can be salvaged.",
        tone: "bad",
      });
      return;
    }
    let removed = this.loot.removeItem(this.player.inventory, itemId);
    if (!removed) return;
    let gold = Math.max(1, Math.floor(removed.value * 0.22));
    this.progression?.grantGold(gold);
    let scrap = this.loot.generateItem(deriveSeed(removed.seed, "scrap"), 1, -1, "material");
    scrap.baseId = "salvage";
    scrap.name = "Crafting Scrap";
    // Tempered gear gives back part of the scrap that went into it.
    scrap.quantity = Math.max(1, Math.ceil(removed.level / 3)) + (removed.temper ?? 0);
    scrap.value = 4;
    this.loot.addItem(this.player.inventory, scrap);
    this.audio.play("forge");
    this.events.emit("toast", {
      title: "Item salvaged",
      detail: `Recovered ${scrap.quantity} scrap and ${gold} gold.`,
    });
    this.events.emit("inventoryChanged", undefined);
  }

  /** The smith's forge: scrap and gold raise a piece of gear by one temper level. */
  temperGear(itemId) {
    const player = this.player;
    if (!player || !itemId || this.currentNpc?.role !== "smith") return;
    const item = player.inventory.find((i) => i.id === itemId) ?? Object.values(player.equipment).find((i) => i?.id === itemId);
    if (!item || !item.slot) return;
    if ((item.temper ?? 0) >= MAX_TEMPER) return;
    const cost = temperCost(item);
    if (scrapCount(player.inventory) < cost.scrap) {
      this.events.emit("toast", { title: "Not enough scrap", detail: `Tempering needs ${cost.scrap} Crafting Scrap. Salvage spare gear for more.`, tone: "bad" });
      this.audio.play("deny");
      return;
    }
    if (player.progress.gold < cost.gold) {
      this.events.emit("toast", { title: "Not enough gold", detail: `Tempering costs ${cost.gold} gold.`, tone: "bad" });
      this.audio.play("deny");
      return;
    }
    spendScrap(player.inventory, cost.scrap);
    player.progress.gold -= cost.gold;
    temperItem(item);
    player.refreshVitals(false);
    this.audio.play("forge");
    this.kit.input.rumble(0.25, 90);
    this.events.emit("toast", {
      title: item.name,
      detail: item.temper >= MAX_TEMPER ? "Fully tempered: the smith has nothing left to add." : "Tempered: every stat +7%.",
      tone: item.temper >= MAX_TEMPER ? "rare" : "good",
    });
    this.events.emit("inventoryChanged", undefined);
  }

  respecPlayer() {
    if (!this.player) return;
    let cost = 60 + this.player.progress.level * 35;
    if (this.player.progress.gold < cost) {
      this.events.emit("toast", {
        title: "Not enough gold",
        detail: `Respec costs ${cost} gold.`,
        tone: "bad",
      });
      return;
    }
    this.player.progress.gold -= cost;
    this.player.respec();
    this.events.emit("toast", {
      title: "Build reset",
      detail: "Skill and attribute points have been returned.",
      tone: "rare",
    });
    this.events.emit("playerChanged", undefined);
  }

  turnInQuest(questId) {
    if (!questId || !this.currentPoi || !this.player || !this.questSystem || !this.progression) return;
    let quest = this.questSystem.quests.find((q) => q.id === questId);
    let rewards = this.questSystem.turnIn(questId, this.currentPoi.id);
    if (!!rewards && !!quest) {
      const scale = this.rewardScale();
      this.record.quests += 1;
      this.progression.grantXp(Math.round(rewards.xp * scale), quest.title);
      this.progression.grantGold(Math.round(rewards.gold * scale));
      this.progression.addReputation(quest.faction, rewards.reputation);
      if (rewards.itemSeed !== undefined) {
        let item = this.loot.generateItem(rewards.itemSeed, rewards.itemLevel ?? this.player.progress.level, rewards.itemRarityBonus ?? 0);
        if (this.loot.addItem(this.player.inventory, item)) {
          this.events.emit("toast", {
            title: item.name,
            detail: "Quest reward",
            tone: item.rarity === "epic" || item.rarity === "legendary" ? "rare" : "good",
          });
        } else {
          this.spawnPickup({
            x: this.player.x + 1,
            z: this.player.z,
            item,
          });
          this.events.emit("toast", { title: item.name, detail: "Your pack is full: the reward waits at your feet.", tone: "good" });
        }
      }
      this.questSystem.ensureForSettlement(this.currentPoi, this.player.progress.level);
      this.audio.play("quest");
      this.saveNow(false);
    }
  }

  buyItem(itemId) {
    if (!itemId || !this.player || !this.currentNpc) return;
    let index = this.currentShop.findIndex((a) => a.id === itemId);
    if (index < 0) return;
    let item = this.currentShop[index];
    let reputation = this.player.progress.reputation[this.currentNpc.faction] ?? 0;
    let price = this.settlements.getBuyPrice(item, reputation) * Math.max(1, item.quantity);
    if (this.player.progress.gold < price) {
      this.events.emit("toast", {
        title: "Not enough gold",
        detail: `This purchase costs ${price}.`,
        tone: "bad",
      });
      this.audio.play("deny");
      return;
    }
    if (item.category !== "consumable") {
      let copy = JSON.parse(JSON.stringify(item));
      if (!this.loot.addItem(this.player.inventory, copy)) {
        this.events.emit("toast", {
          title: "Inventory full",
          detail: "Free a slot before buying this item.",
          tone: "bad",
        });
        this.audio.play("deny");
        return;
      }
    }
    this.player.progress.gold -= price;
    this.currentShop.splice(index, 1);
    if (item.category === "consumable") {
      this.player.potions += item.quantity;
    }
    this.audio.play("loot");
    this.events.emit("inventoryChanged", undefined);
  }

  sellItem(itemId) {
    if (!itemId || !this.player || !this.currentNpc) return;
    let item = this.player.inventory.find((r) => r.id === itemId);
    if (!item) return;
    let reputation = this.player.progress.reputation[this.currentNpc.faction] ?? 0;
    let price = this.settlements.getSellPrice(item, reputation) * Math.max(1, item.quantity);
    this.loot.removeItem(this.player.inventory, item.id, item.quantity);
    this.player.progress.gold += price;
    this.currentShop.push(item);
    this.audio.play("loot");
    this.events.emit("toast", {
      title: `Sold ${item.name}`,
      detail: `+${price} gold`,
      tone: "good",
    });
    this.events.emit("inventoryChanged", undefined);
  }

  useHealingService() {
    if (!this.player) return;
    let cost = Math.max(5, this.player.progress.level * 4);
    if (this.player.progress.gold < cost) {
      this.events.emit("toast", {
        title: "Not enough gold",
        detail: `Treatment costs ${cost}.`,
        tone: "bad",
      });
      this.audio.play("deny");
      return;
    }
    this.player.progress.gold -= cost;
    this.player.statusEffects.length = 0;
    this.player.refreshVitals(true);
    this.audio.play("heal");
    this.events.emit("toast", {
      title: "Wounds treated",
      detail: "Health and focus restored.",
      tone: "good",
    });
  }

  restAtInn() {
    if (!this.player) return;
    if (this.player.progress.gold < 12) {
      this.events.emit("toast", {
        title: "Not enough gold",
        detail: "A room costs 12 gold.",
        tone: "bad",
      });
      this.audio.play("deny");
      return;
    }
    this.player.progress.gold -= 12;
    this.player.statusEffects.length = 0;
    this.player.refreshVitals(true);
    this.persistence.timeOfDay = 0.29;
    this.renderer.setTimeOfDay(this.persistence.timeOfDay);
    this.saveNow(false);
    this.audio.play("heal");
    this.events.emit("toast", {
      title: "Rested until morning",
      detail: "Journey saved.",
      tone: "good",
    });
  }

  changeSetting(key, value) {
    if (!key || value === undefined) return;
    if (key === "masterVolume") {
      this.settings.masterVolume = clamp(Number(value), 0, 1);
      this.audio.setVolume(this.settings.masterVolume);
    }
    if (key === "cameraShake") {
      this.settings.cameraShake = value === "true";
    }
    if (key === "damageNumbers") {
      this.settings.damageNumbers = value === "true";
    }
    if (key === "reduceMotion") {
      this.settings.reduceMotion = value === "true";
      this.applyMotionPreference();
    }
  }

  applyMotionPreference() {
    document.documentElement.classList.toggle("reduce-motion", this.settings.reduceMotion);
  }

  bindEvents() {
    this.events.on("toast", (e) => this.ui.showToast(e.title, e.detail, e.tone));
    this.events.on("combat", (e) => {
      this.ui.showCombatNumber(e.position, e.amount, e.kind, e.label);
      if (e.kind === "damage" || e.kind === "critical") {
        const onPlayer = e.targetId === "player";
        this.audio.play(onPlayer ? "hurt" : "hit");
        if (onPlayer) {
          if (this.settings.cameraShake && !this.settings.reduceMotion) {
            this.renderer.shake(0.22);
          }
          this.kit.input.rumble(0.45, 110);
        } else if (e.kind === "critical") {
          this.kit.input.rumble(0.18, 50);
        }
      }
      if (e.kind === "heal") {
        this.audio.play("heal");
      }
    });
    this.events.on("discovery", (poi) => {
      this.ui.showDiscovery(poi);
      this.audio.play("quest");
    });
    this.events.on("levelUp", () => {
      this.audio.play("level");
      this.kit.input.rumble(0.3, 160);
    });
    this.events.on("equipmentChanged", () => this.player?.refreshVitals(false));
    // Open panels and dialogues redraw once, at the end of the frame, after anything changes.
    const dirty = () => {
      this.panelDirty = true;
    };
    for (const name of ["inventoryChanged", "playerChanged", "equipmentChanged", "questChanged"]) this.events.on(name, dirty);
  }
}
