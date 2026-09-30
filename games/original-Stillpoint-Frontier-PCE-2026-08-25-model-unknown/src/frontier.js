/**
 * frontier.js — the authored layer and the field record: the Field Unit
 * compound (Mara Venn, the workbench, the survey cot, the service cache, the
 * Kestrel weather mast), the Meridian survey tower, relay spur roads, the 24
 * atlas settlements, gatherable resources, residents and wildlife, deployable
 * camp gear, survival conditions, crafting, the territory atlas (settlements
 * and Whisperglass bearings), transit and the save.
 */
import * as THREE from 'three/webgpu';
import {
  SETTLEMENTS,
  LOCAL_SITES,
  FIELD_UNIT,
  ECHOES,
  ITEMS,
  DEPLOYABLES,
  RECIPES,
  GUIDE,
  CONTRACTS,
  CORE_CONTRACT_IDS,
  RESOURCES,
  echoRevealed,
  nearestLocalSite,
  revealedSettlementCount,
  bearingTo,
  formatDistance,
} from './data.js';
import { reduceField, contractStatus, craft, inventoryWeight, sanitizeFieldState, FieldSaveStore } from './state.js';
import { biomeAt, ATLAS_HALF_EXTENT } from './terrain.js';
import { StaticBatch, prim, disposeObject, setEulerDeg } from './primitives.js';

const RESOURCE_KIND = {
  stone: 'stone',
  wood: 'wood',
  fiber: 'lichen',
  ore: 'ore',
  relic: 'relic',
  first_aid_kit: 'relic',
  bedroll: 'wood',
  campfire_kit: 'stone',
  survey_marker: 'wood',
  weather_shelter: 'wood',
  field_torch: 'relic',
};

export class FrontierContent {
  constructor({ scene, terrain, player, collision, interactions, materials, hud, soundscape, input, render, environment, relayStatus, advanceTime }) {
    this.terrain = terrain;
    this.player = player;
    this.collision = collision;
    this.interactions = interactions;
    this.materials = materials;
    this.hud = hud;
    this.soundscape = soundscape;
    this.input = input;
    this.render = render;
    this.environment = environment;
    this.relayStatus = relayStatus;
    this.advanceTime = advanceTime;
    this.root = new THREE.Group();
    this.root.name = 'Frontier authored layer';
    scene.add(this.root);
    this.saveStore = new FieldSaveStore();
    this.disposers = [];
    this.resourceEntities = new Map();
    this.deploymentObjects = new Map();
    this.citizens = [];
    this.wildlife = [];
    this.elapsed = 0;
    this.autosaveClock = 0;
    this.hudClock = Infinity;
    this.conditionClock = 0;
    this.pendingSeconds = 0;
    this.locationId = 'field-unit';
    this.selectedRecipeIndex = 0;
    this.selectedGearIndex = 0;
    this.gridLab = false;
    this.suppressFinalSave = false;
    this.devSettlementIndex = -1;
    this.invincible = false;
    this.aiFrozen = false;
    this.exposureScale = 1;
    /** Extra shelter test (the vault below the Stillpoint), set by the game. */
    this.isSheltered = null;

    this.state = this.saveStore.load();
    this.player.teleport(this.state.playerPosition.x, this.state.playerPosition.z, this.state.playerPosition.y ?? undefined);

    this.buildRoutes();
    this.buildCompound();
    this.buildFieldObjects();
    this.buildMeridianTower();
    this.buildTerritory();
    this.buildResidents();
    this.syncPresentation();
    this.refreshHud(true);
  }

  /* ----------------------------------------------------------- read-outs */

  get worldMinutes() {
    return this.state.worldMinutes;
  }
  get allContractsFiled() {
    return this.state.turnedInContracts && CORE_CONTRACT_IDS.every((id) => this.state.turnedInContracts.includes(id));
  }
  get gridLabActive() {
    return this.gridLab;
  }
  get knownGuideCount() {
    return this.state.scanned.filter((id) => GUIDE.some((g) => g.id === id)).length;
  }
  get guideTotal() {
    return GUIDE.length;
  }
  get inventoryTotal() {
    return Object.values(this.state.inventory).reduce((sum, n) => sum + n, 0);
  }
  get health() {
    return this.state.health;
  }
  get wetness() {
    return this.state.wetness;
  }
  get cold() {
    return this.state.cold;
  }
  get completedContractCount() {
    return contractStatus(this.state).filter((c) => c.complete).length;
  }
  get contractCount() {
    return CONTRACTS.length;
  }
  get invincibilityEnabled() {
    return this.invincible;
  }
  get aiMotionFrozen() {
    return this.aiFrozen;
  }
  get echoCount() {
    return ECHOES.filter((e) => this.state.scanned.includes(e.entryId)).length;
  }
  get stats() {
    return this.state.stats;
  }

  setWorldMinutes(minutes) {
    this.state = reduceField(this.state, { type: 'set-time', worldMinutes: minutes });
  }

  setExposure(scale) {
    this.exposureScale = Math.max(0, Math.min(1, scale));
  }

  /* ---------------------------------------------------------------- tick */

  update(dt) {
    this.elapsed += dt;
    this.autosaveClock += dt;
    this.hudClock += dt;
    this.conditionClock += dt;
    this.pendingSeconds += dt;
    if (!this.aiFrozen) this.updateResidents();
    this.discoverLocation();
    if (this.conditionClock >= 1) {
      this.conditionClock = 0;
      this.updateCondition();
    }
    if (this.pendingSeconds >= 5) this.flushStats();
    if (this.autosaveClock >= 30) {
      this.autosaveClock = 0;
      this.saveNow(false);
    }
    if (this.hudClock >= 0.2) this.refreshHud();
  }

  flushStats() {
    const distance = this.player.consumeDistance();
    const seconds = this.pendingSeconds;
    this.pendingSeconds = 0;
    if (distance > 0 || seconds > 0) this.state = reduceField(this.state, { type: 'track', distance: Math.min(distance, 5000), seconds });
  }

  saveNow(announce = true) {
    this.flushStats();
    const p = this.player.worldPosition;
    this.state = reduceField(this.state, { type: 'set-player', x: p.x, y: p.y, z: p.z });
    const ok = this.gridLab ? this.saveStore.saveSandbox(this.state) : this.saveStore.save(this.state);
    if (announce) {
      this.hud.showToast(
        ok ? (this.gridLab ? 'Sandbox record updated' : 'Field record committed') : 'Local record unavailable',
        ok
          ? this.gridLab
            ? 'Campaign and relay records remain isolated until explicit commit.'
            : 'Inventory, discoveries and environmental state are secure.'
          : 'Play can continue, but this browser refused local storage.',
        ok ? (this.gridLab ? 'GRID LAB SAVE' : 'SAVE COMPLETE') : 'SAVE DEGRADED',
      );
    }
    return ok;
  }

  /* ------------------------------------------------------------ GRID LAB */

  beginGridLab() {
    if (this.gridLab) return;
    const p = this.player.worldPosition;
    this.state = reduceField(this.state, { type: 'set-player', x: p.x, y: p.y, z: p.z });
    this.state = this.saveStore.loadSandbox(sanitizeFieldState(this.state));
    this.gridLab = true;
    this.player.teleport(this.state.playerPosition.x, this.state.playerPosition.z, this.state.playerPosition.y ?? undefined);
    this.syncPresentation();
    this.refreshHud(true);
    this.saveNow(false);
  }

  commitGridLab() {
    if (!this.gridLab) return false;
    const p = this.player.worldPosition;
    this.state = reduceField(this.state, { type: 'set-player', x: p.x, y: p.y, z: p.z });
    if (!this.saveStore.save(sanitizeFieldState(this.state))) return false;
    this.saveStore.clearSandbox();
    this.gridLab = false;
    this.suppressFinalSave = true;
    return true;
  }

  discardGridLab() {
    if (!this.gridLab) return false;
    const ok = this.saveStore.clearSandbox();
    this.gridLab = false;
    this.suppressFinalSave = true;
    return ok;
  }

  grantGridLabKit() {
    this.state = reduceField(this.state, {
      type: 'grant',
      items: { stone: 14, wood: 14, fiber: 18, ore: 8, relic: 6, first_aid_kit: 4, bedroll: 2, campfire_kit: 2, survey_marker: 4, weather_shelter: 1, field_torch: 4 },
    });
    this.saveNow(false);
    this.refreshHud(true);
  }

  resetGridLabVitals() {
    this.state = reduceField(this.state, { type: 'set-condition', health: 100, wetness: 0, cold: 0 });
    this.saveNow(false);
    this.refreshHud(true);
  }

  toggleGridLabInvincibility() {
    this.invincible = !this.invincible;
    if (this.invincible) this.state = reduceField(this.state, { type: 'set-condition', health: 100 });
    this.refreshHud(true);
    return this.invincible;
  }

  toggleGridLabAiFreeze() {
    this.aiFrozen = !this.aiFrozen;
    return this.aiFrozen;
  }

  setGridLabCondition(name) {
    const [health, wetness, cold] = { healthy: [100, 0, 0], injured: [38, 18, 22], soaked: [78, 100, 36], hypothermic: [52, 64, 94], critical: [8, 96, 100] }[name];
    this.state = reduceField(this.state, { type: 'set-condition', health, wetness, cold });
    this.saveNow(false);
    this.refreshHud(true);
    return `${name.toUpperCase()} // ${health} H / ${wetness} W / ${cold} C`;
  }

  maxGridLabInventory() {
    const items = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, ITEMS[id].stackLimit]));
    this.state = reduceField(this.state, { type: 'clear-inventory' });
    this.state = reduceField(this.state, { type: 'grant', items });
    this.saveNow(false);
    this.refreshHud(true);
  }

  clearGridLabInventory() {
    this.state = reduceField(this.state, { type: 'clear-inventory' });
    this.saveNow(false);
    this.refreshHud(true);
  }

  completeGridLabContracts() {
    this.state = {
      ...this.state,
      acceptedContracts: CONTRACTS.map((c) => c.id),
      turnedInContracts: CONTRACTS.map((c) => c.id),
      reputation: Math.max(this.state.reputation, CONTRACTS.length * 100),
    };
    this.saveNow(false);
    this.refreshHud(true);
  }

  resetGridLabContracts() {
    this.state = { ...this.state, acceptedContracts: [CONTRACTS[0].id], turnedInContracts: [], reputation: 0 };
    this.saveNow(false);
    this.refreshHud(true);
  }

  respawnGridLabResources() {
    this.state = { ...this.state, collected: [] };
    this.syncResources();
    this.saveNow(false);
    this.refreshHud(true);
  }

  revealGridLabIntel() {
    this.state = reduceField(this.state, { type: 'discover', locationId: 'grid-lab:atlas-unlocked' });
    for (const entry of GUIDE) this.state = reduceField(this.state, { type: 'scan', entryId: entry.id });
    for (const site of LOCAL_SITES) this.state = reduceField(this.state, { type: 'discover', locationId: site.id });
    for (const s of SETTLEMENTS) this.state = reduceField(this.state, { type: 'discover', locationId: s.id });
    this.saveNow(false);
    this.refreshHud(true);
  }

  cycleGridLabSettlement() {
    this.devSettlementIndex = (this.devSettlementIndex + 1) % SETTLEMENTS.length;
    const s = SETTLEMENTS[this.devSettlementIndex];
    this.player.teleport(s.x, s.z + 22);
    this.state = reduceField(this.state, { type: 'discover', locationId: s.id });
    this.state = reduceField(this.state, { type: 'set-waypoint', waypointId: s.id });
    this.saveNow(false);
    this.refreshHud(true);
    return s;
  }

  jumpGridLab(x, z, y, heading) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const height = Number.isFinite(y) ? Math.max(-256, Math.min(4096, y)) : undefined;
    this.player.teleport(Math.max(-ATLAS_HALF_EXTENT, Math.min(ATLAS_HALF_EXTENT, x)), Math.max(-ATLAS_HALF_EXTENT, Math.min(ATLAS_HALF_EXTENT, z)), height);
    if (Number.isFinite(heading)) this.player.setHeading(heading);
    this.saveNow(false);
    return true;
  }

  hasGuideEntry(id) {
    return this.state.scanned.includes(id);
  }

  recordGuideEntry(id) {
    if (!GUIDE.some((g) => g.id === id) || this.state.scanned.includes(id)) return false;
    this.state = reduceField(this.state, { type: 'scan', entryId: id });
    this.saveNow(false);
    this.refreshHud(true);
    return true;
  }

  /** Campaign milestones (the Stillpoint finale…) live in the durable record's discovery list. */
  hasMilestone(id) {
    return this.state.discovered.includes(`milestone:${id}`);
  }

  markMilestone(id) {
    if (this.hasMilestone(id)) return false;
    this.state = reduceField(this.state, { type: 'discover', locationId: `milestone:${id}` });
    this.saveNow(false);
    return true;
  }

  get coreContractsFiled() {
    return CORE_CONTRACT_IDS.filter((id) => this.state.turnedInContracts.includes(id)).length;
  }

  applyReward(items, reputation = 0) {
    if (items) this.state = reduceField(this.state, { type: 'grant', items });
    if (reputation) this.state = reduceField(this.state, { type: 'reputation', amount: reputation });
    this.saveNow(false);
    this.refreshHud(true);
  }

  testSnapshot() {
    return {
      resources: this.resourceEntities.size,
      collected: this.state.collected.length,
      scanned: this.state.scanned.length,
      colliders: this.collision.size,
      citizens: this.citizens.length,
      wildlife: this.wildlife.length,
      contractsComplete: this.completedContractCount,
      inventoryWeight: inventoryWeight(this.state.inventory),
      inventory: { ...this.state.inventory },
      worldMinutes: this.state.worldMinutes,
      deployments: this.state.deployments.length,
      settlements: SETTLEMENTS.length,
      reputation: this.state.reputation,
      waypointId: this.state.waypointId,
      health: this.state.health,
      wetness: this.state.wetness,
      cold: this.state.cold,
      invincible: this.invincible,
      aiFrozen: this.aiFrozen,
      echoes: this.echoCount,
      stats: { ...this.state.stats },
    };
  }

  /* --------------------------------------------------- atlas and transit */

  revealedSettlements() {
    if (this.atlasUnlocked()) return SETTLEMENTS;
    return SETTLEMENTS.slice(0, revealedSettlementCount(this.relayStatus().size));
  }

  atlasUnlocked() {
    return this.gridLab && this.state.discovered.includes('grid-lab:atlas-unlocked');
  }

  echoIsRevealed(index) {
    return this.atlasUnlocked() || echoRevealed(this.state.scanned, index);
  }

  /** Every transit destination on the atlas: revealed settlements, then resolved Whisperglass bearings. */
  atlasDestinations() {
    const list = this.revealedSettlements().map((s) => ({ id: s.id, name: s.name, x: s.x, z: s.z, economy: s.economy, kind: 'settlement', arrivalZ: s.z + 22 }));
    ECHOES.forEach((e, index) => {
      if (!this.echoIsRevealed(index)) return;
      const recorded = this.state.scanned.includes(e.entryId);
      list.push({ id: e.id, name: e.name, x: e.x, z: e.z, economy: recorded ? 'whisperglass echo // recorded' : 'whisperglass bearing // unrecorded', kind: 'echo', arrivalZ: e.z + 6 });
    });
    return list;
  }

  /** The waypoint's place, even if it is not (yet) reachable by transit. */
  waypointTarget() {
    const id = this.state.waypointId;
    if (!id) return null;
    if (id === FIELD_UNIT.id) return { ...FIELD_UNIT, kind: 'base', arrivalZ: 26 };
    const s = SETTLEMENTS.find((x) => x.id === id);
    if (s) return { id: s.id, name: s.name, x: s.x, z: s.z, economy: s.economy, kind: 'settlement', arrivalZ: s.z + 22 };
    const e = ECHOES.find((x) => x.id === id);
    if (e) return { id: e.id, name: e.name, x: e.x, z: e.z, economy: 'whisperglass bearing', kind: 'echo', arrivalZ: e.z + 6 };
    return null;
  }

  setWaypoint(id) {
    this.state = reduceField(this.state, { type: 'set-waypoint', waypointId: id });
  }

  cycleAtlasWaypoint() {
    const list = this.atlasDestinations();
    if (list.length === 0) return;
    if (this.state.waypointId === FIELD_UNIT.id) {
      this.setWaypoint(null);
      this.hud.showToast('Local relay network', 'Long-range waypoint cleared. Compass returned to the nearest relay.', 'ATLAS WAYPOINT');
      this.saveNow(false);
      this.refreshHud(true);
      return;
    }
    const index = list.findIndex((d) => d.id === this.state.waypointId);
    if (index === list.length - 1) {
      this.setWaypoint(FIELD_UNIT.id);
      this.hud.showToast(FIELD_UNIT.name, 'Return link selected // relay service / field operations', 'ATLAS WAYPOINT');
      this.saveNow(false);
      this.refreshHud(true);
      return;
    }
    const next = list[index + 1] ?? list[0];
    this.setWaypoint(next.id);
    const p = this.player.worldPosition;
    const detail =
      next.kind === 'echo'
        ? `${next.economy.toUpperCase()} // ${formatDistance(Math.hypot(next.x - p.x, next.z - p.z))} // T to transit`
        : `${biomeAt(next.x, next.z, this.terrain.seed).biome.name} // ${next.economy}`;
    this.hud.showToast(next.name, detail, next.kind === 'echo' ? 'WHISPERGLASS BEARING' : 'ATLAS WAYPOINT');
    this.saveNow(false);
    this.refreshHud(true);
  }

  travelToWaypoint() {
    const id = this.state.waypointId;
    const dest = id === FIELD_UNIT.id ? { ...FIELD_UNIT, kind: 'base', arrivalZ: 26 } : this.atlasDestinations().find((d) => d.id === id);
    if (!dest) {
      this.hud.showToast('No linked destination', 'Cycle a revealed atlas waypoint first. Restored relays expose six more links; recorded echoes resolve new bearings.', 'TRANSIT BLOCKED');
      this.soundscape.reject();
      return false;
    }
    const p = this.player.worldPosition;
    const distance = Math.hypot(dest.x - p.x, dest.z - p.z);
    const minutes = Math.max(18, Math.min(240, Math.round(distance / 220)));
    this.player.teleport(dest.x, dest.arrivalZ);
    this.state = reduceField(this.state, { type: 'discover', locationId: dest.id });
    this.state = reduceField(this.state, { type: 'set-player', x: dest.x, y: this.player.worldPosition.y, z: dest.arrivalZ });
    this.advanceTime(minutes);
    this.soundscape.complete();
    this.hud.showToast(dest.name, `${minutes} field minutes elapsed. ${dest.kind === 'echo' ? 'The Whisperglass is close; look for its signal shard.' : 'Regional terrain and stores are now active.'}`, 'LONG-RANGE TRANSIT', 4500);
    this.saveNow(false);
    this.refreshHud(true);
    return true;
  }

  /* ------------------------------------------------------- field actions */

  cycleRecipe() {
    this.selectedRecipeIndex = (this.selectedRecipeIndex + 1) % RECIPES.length;
    const recipe = RECIPES[this.selectedRecipeIndex];
    this.hud.showToast(recipe.label, this.recipeRequirements(recipe), `RECIPE // ${recipe.station.toUpperCase()}`);
    this.refreshHud(true);
  }

  cycleDeployable() {
    this.selectedGearIndex = (this.selectedGearIndex + 1) % DEPLOYABLES.length;
    const id = DEPLOYABLES[this.selectedGearIndex];
    this.hud.showToast(ITEMS[id].name, `${this.state.inventory[id]} prepared // deploy to place it ahead`, 'FIELD GEAR SELECTED');
    this.refreshHud(true);
  }

  deploySelected() {
    let item = DEPLOYABLES[this.selectedGearIndex];
    if (this.state.inventory[item] < 1) {
      const available = DEPLOYABLES.findIndex((id) => this.state.inventory[id] > 0);
      if (available < 0) {
        this.hud.showToast('No deployable gear', 'Fabricate a bedroll, campfire, marker, shelter or torch at the field workbench.', 'DEPLOYMENT BLOCKED');
        this.soundscape.reject();
        return false;
      }
      this.selectedGearIndex = available;
      item = DEPLOYABLES[available];
    }
    const yaw = (this.player.yawDegrees * Math.PI) / 180;
    const p = this.player.worldPosition;
    const x = p.x - Math.sin(yaw) * 3.2;
    const z = p.z - Math.cos(yaw) * 3.2;
    if (this.collision.floorAt(p.x, p.z, p.y) !== null) {
      this.hud.showToast('No open ground', 'Field gear needs open sky above it.', 'DEPLOYMENT BLOCKED');
      this.soundscape.reject();
      return false;
    }
    if (this.terrain.slopeAt(x, z, 1.6) > 1.1) {
      this.hud.showToast('Ground rejected', 'Choose a flatter surface for field equipment.', 'DEPLOYMENT BLOCKED');
      this.soundscape.reject();
      return false;
    }
    const deployment = { id: `deployment:${Math.floor(this.state.worldMinutes)}:${Date.now().toString(36)}`, item, x, z };
    this.state = reduceField(this.state, { type: 'deploy', deployment });
    if (!this.state.deployments.some((d) => d.id === deployment.id)) return false;
    this.syncDeployments();
    this.soundscape.complete();
    this.input?.rumble(0.3, 90);
    this.hud.showToast(ITEMS[item].name, 'Placement committed to the durable field record.', 'GEAR DEPLOYED');
    this.saveNow(false);
    this.refreshHud(true);
    return true;
  }

  useMedkit() {
    const before = this.state.inventory.first_aid_kit;
    this.state = reduceField(this.state, { type: 'use-medkit' });
    if (this.state.inventory.first_aid_kit === before) {
      this.hud.showToast(before < 1 ? 'No medkit carried' : 'Treatment not required', before < 1 ? 'Recover a service cache or fabricate first aid.' : 'Health is already stable.', 'FIELD MEDICAL');
      return false;
    }
    this.soundscape.complete();
    this.hud.showToast('First-aid kit used', 'Trauma stabilized and cold stress reduced.', 'FIELD MEDICAL');
    this.saveNow(false);
    this.refreshHud(true);
    return true;
  }

  destroy() {
    if (!this.suppressFinalSave) this.saveNow(false);
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    for (const entry of this.deploymentObjects.values()) for (const dispose of entry.disposers) dispose();
    this.deploymentObjects.clear();
    this.root.removeFromParent();
  }

  /* --------------------------------------------------------- the compound */

  buildRoutes() {
    const batch = new StaticBatch();
    const compound = { x: 0, z: 31 };
    this.createRoute(batch, compound, { x: 0, z: 0 }, 3.5);
    this.createRoute(batch, compound, { x: -72, z: 46 }, 3.1);
    this.createRoute(batch, compound, { x: 77, z: 42 }, 3.1);
    this.createRoute(batch, { x: 0, z: 0 }, { x: 18, z: -94 }, 2.8);
    batch.build(this.root);
  }

  createRoute(batch, from, to, width) {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const segments = Math.max(1, Math.ceil(length / 11));
    const dx = (to.x - from.x) / segments;
    const dz = (to.z - from.z) / segments;
    const segmentLength = Math.hypot(dx, dz) + 0.35;
    const angle = (Math.atan2(dx, dz) * 180) / Math.PI;
    for (let i = 0; i < segments; i += 1) {
      const x = from.x + dx * (i + 0.5);
      const z = from.z + dz * (i + 0.5);
      const y = this.terrain.heightAt(x, z) + 0.055;
      batch.add('box', this.materials.road, [x, y, z], [width, 0.1, segmentLength], [0, angle, 0], false);
      if (i % 3 === 1) {
        const ox = Math.cos((angle * Math.PI) / 180) * (width * 0.58);
        const oz = -Math.sin((angle * Math.PI) / 180) * (width * 0.58);
        batch.add('box', this.materials.roadEdge, [x + ox, y + 0.07, z + oz], [0.16, 0.12, 1.4], [0, angle, 0], false);
      }
    }
  }

  buildCompound() {
    const batch = new StaticBatch();
    for (const building of [
      { id: 'operations', x: -13, z: 32, width: 11, depth: 9, height: 4.2 },
      { id: 'workshop', x: 13, z: 32, width: 11, depth: 9, height: 4.2 },
      { id: 'survey-house', x: 0, z: 49, width: 13, depth: 10, height: 5.2 },
    ])
      this.createBuilding(batch, building);

    // Kestrel weather mast. The scan anchor sits on the pole where the player looks
    // (the original anchored it at the world origin, under the ground, so it almost never showed).
    const mastGround = this.terrain.heightAt(-5, 20);
    batch.add('cylinder', this.materials.structureAccent, [-5, mastGround + 6, 20], [0.32, 12, 0.32]);
    batch.add('box', this.materials.fieldOrange, [-5, mastGround + 12.2, 20], [3.6, 0.18, 0.35], null, false);
    batch.add('sphere', this.materials.lichenGlow, [-5, mastGround + 11.5, 20], [0.55, 0.55, 0.55], null, false);
    const mastAnchor = new THREE.Object3D();
    mastAnchor.name = 'Kestrel weather mast';
    mastAnchor.position.set(-5, mastGround + 3.2, 20);
    this.root.add(mastAnchor);
    this.disposers.push(
      this.collision.add({ id: 'mast:pole', minX: -5.25, maxX: -4.75, minZ: 19.75, maxZ: 20.25, minY: mastGround - 1, maxY: mastGround + 12 }),
      this.interactions.register({
        id: 'scan:weather-mast',
        entity: mastAnchor,
        range: 10,
        holdSeconds: 1.2,
        label: () => (this.state.scanned.includes('guide:landmark:weather-mast') ? 'Weather mast cataloged' : 'Scan weather mast'),
        enabled: () => !this.state.scanned.includes('guide:landmark:weather-mast'),
        interact: () => this.dispatch({ type: 'scan', entryId: 'guide:landmark:weather-mast' }, 'Kestrel weather mast', 'Instrument record added to the field guide.', 'SUBJECT CATALOGED'),
      }),
    );
    this.createStandingOrders(batch);
    this.createWorkbench(batch);
    this.createRestSite();
    this.createMara();
    this.createServiceCache(batch);
    batch.build(this.root);
  }

  createBuilding(batch, b) {
    const floor = this.terrain.heightAt(b.x, b.z) + 0.08;
    batch.add('box', this.materials.structureAccent, [b.x, floor + 0.12, b.z], [b.width, 0.24, b.depth]);
    this.disposers.push(this.collision.addSurface({ id: `floor:${b.id}`, minX: b.x - b.width / 2 + 0.2, maxX: b.x + b.width / 2 - 0.2, minZ: b.z - b.depth / 2 + 0.2, maxZ: b.z + b.depth / 2 - 0.2, height: floor + 0.24 }));
    const thickness = 0.28;
    const halfW = b.width / 2;
    const halfD = b.depth / 2;
    const door = 2.1;
    const side = (b.width - door) / 2;
    this.createWall(batch, `${b.id}:back`, b.x, floor, b.z + halfD, b.width, thickness, b.height);
    this.createWall(batch, `${b.id}:left`, b.x - halfW, floor, b.z, thickness, b.depth, b.height);
    this.createWall(batch, `${b.id}:right`, b.x + halfW, floor, b.z, thickness, b.depth, b.height);
    this.createWall(batch, `${b.id}:front-left`, b.x - (door + side) / 2, floor, b.z - halfD, side, thickness, b.height);
    this.createWall(batch, `${b.id}:front-right`, b.x + (door + side) / 2, floor, b.z - halfD, side, thickness, b.height);
    this.createWall(batch, `${b.id}:lintel`, b.x, floor + b.height - 0.62, b.z - halfD, door, thickness, 1.24);
    batch.add('box', this.materials.roof, [b.x, floor + b.height + 0.2, b.z], [b.width + 0.8, 0.38, b.depth + 0.8], [0, 0, b.id === 'survey-house' ? 3 : -2]);
    for (const offset of [-0.26, 0.26]) batch.add('box', this.materials.window, [b.x + b.width * offset, floor + 2.25, b.z - halfD - 0.16], [1.45, 1.15, 0.08], null, false);
  }

  createWall(batch, id, x, y, z, width, depth, height) {
    batch.add('box', this.materials.structure, [x, y + height / 2, z], [width, height, depth]);
    this.disposers.push(this.collision.add({ id: `wall:${id}`, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, minY: y, maxY: y + height }));
  }

  createStandingOrders(batch) {
    const z = 29.2;
    const ground = this.terrain.heightAt(-13, 32);
    const board = prim(this.root, 'box', this.materials.timber, [-13, ground + 1.65, z], [2.7, 1.7, 0.16], { name: 'Standing orders board' });
    batch.add('box', this.materials.fieldOrange, [-13, ground + 2.7, z - 0.06], [1.1, 0.08, 0.08], null, false);
    this.disposers.push(
      this.interactions.register({
        id: 'inspect:standing-orders',
        entity: board,
        holdSeconds: 0.2,
        label: 'Read standing orders',
        interact: () => this.dispatch({ type: 'inspect', targetId: 'standing-orders' }, 'Standing Order 11-C', 'Restore the quiet grid. Log what changed, not what you expected to find.', 'FIELD ARCHIVE'),
      }),
    );
  }

  createWorkbench(batch) {
    const ground = this.terrain.heightAt(13, 32);
    const bench = prim(this.root, 'box', this.materials.timber, [13, ground + 0.78, 32], [4.2, 0.3, 1.25], { name: 'Field workbench' });
    batch.add('box', this.materials.fieldOrange, [13.9, ground + 1.15, 32], [0.8, 0.45, 0.7], null, false);
    this.disposers.push(
      this.collision.add({ id: 'workbench', minX: 10.9, maxX: 15.1, minZ: 31.4, maxZ: 32.6, minY: ground - 0.5, maxY: ground + 1.1 }),
      this.interactions.register({
        id: 'craft:workbench',
        entity: bench,
        range: 6,
        holdSeconds: 0.4,
        label: () => `Fabricate ${RECIPES[this.selectedRecipeIndex].label}`,
        interact: () => this.craftAtWorkbench(),
      }),
    );
  }

  createRestSite() {
    const ground = this.terrain.heightAt(0, 49);
    const cot = prim(this.root, 'box', this.materials.fieldOrange, [0, ground + 0.34, 49], [2.1, 0.28, 4], { name: 'Survey cot' });
    this.disposers.push(
      this.interactions.register({
        id: 'rest:survey-cot',
        entity: cot,
        range: 5.5,
        holdSeconds: 1,
        label: 'Rest for two field hours',
        interact: () => {
          this.state = reduceField(this.state, { type: 'rest', minutes: 120 });
          this.advanceTime(120);
          this.soundscape.complete();
          this.saveNow(false);
          this.hud.showToast('Field rest complete', 'Exposure cleared. Two hours have passed in the basin.', 'RESTED', 4000);
          this.refreshHud(true);
        },
      }),
    );
  }

  createMara() {
    const x = -3.5;
    const z = 27;
    const ground = this.terrain.heightAt(x, z);
    const mara = this.createHumanoid('Coordinator Mara Venn', x, ground, z, this.materials.citizen, this.materials.fieldOrange);
    setEulerDeg(mara, 0, 200, 0);
    this.disposers.push(
      this.collision.add({ id: 'npc:mara', minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.35, maxZ: z + 0.35, minY: ground - 0.5, maxY: ground + 2.6 }),
      this.interactions.register({
        id: 'npc:mara-venn',
        entity: mara.userData.head,
        range: 6,
        holdSeconds: 0.2,
        label: 'Speak with Mara Venn',
        interact: () => this.talkToMara(),
      }),
    );
  }

  talkToMara() {
    this.state = reduceField(this.state, { type: 'talk', npcId: 'mara-venn' });
    const ready = contractStatus(this.state).find((c) => c.status === 'ready');
    if (ready) {
      this.state = reduceField(this.state, { type: 'turn-in-contract', contractId: ready.id, reward: { relic: 1, survey_marker: 1 } });
      const next = contractStatus(this.state).find((c) => c.status === 'available');
      if (next) this.state = reduceField(this.state, { type: 'accept-contract', contractId: next.id });
      this.soundscape.complete();
      this.input?.rumble(0.35, 120);
      this.hud.showToast(
        `${ready.code} filed`,
        next ? `${next.code} accepted. One salvage unit and a survey marker issued.` : 'All Meridian field contracts are reconciled.',
        'MARA VENN // SIGN-OFF',
        4500,
      );
    } else {
      const available = contractStatus(this.state).find((c) => c.status === 'available');
      if (available) {
        this.state = reduceField(this.state, { type: 'accept-contract', contractId: available.id });
        this.hud.showToast(available.title, `${available.code} accepted. Complete the listed evidence in any order.`, 'MARA VENN // ASSIGNMENT', 4000);
      } else {
        const active = contractStatus(this.state).find((c) => c.status === 'active');
        this.hud.showToast(
          'Mara Venn // Field Coordinator',
          active ? `${active.code}: ${active.next}` : 'The field files are clean. The relay network is still the real assignment.',
          'FIELD CHANNEL',
        );
      }
    }
    this.saveNow(false);
    this.refreshHud(true);
  }

  createServiceCache(batch) {
    const x = 2.8;
    const z = 47.5;
    const ground = this.terrain.heightAt(0, 49);
    const cache = prim(this.root, 'box', this.materials.structureAccent, [x, ground + 0.65, z], [1.6, 1.3, 1.2], { name: 'Meridian service cache' });
    batch.add('box', this.materials.lichenGlow, [x, ground + 1.05, z - 0.62], [0.35, 0.18, 0.05], null, false);
    this.disposers.push(
      this.collision.add({ id: 'service-cache', minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.6, maxZ: z + 0.6, minY: ground - 0.5, maxY: ground + 1.3 }),
      this.interactions.register({
        id: 'container:service-cache',
        entity: cache,
        holdSeconds: 0.65,
        label: 'Recover service cache',
        enabled: () => !this.state.opened.includes('service-cache'),
        interact: () =>
          this.dispatch(
            { type: 'open', containerId: 'service-cache', loot: { relic: 2, fiber: 2, first_aid_kit: 1 } },
            'Service cache recovered',
            'Old-world salvage, lichen braid and one sealed medkit added.',
            'CONTAINER LOG',
          ),
      }),
    );
  }

  buildFieldObjects() {
    for (const resource of RESOURCES) this.createResource(resource);
    const ground = this.terrain.heightAt(4.5, 1.5);
    const plaque = prim(this.root, 'box', this.materials.fieldOrange, [4.5, ground + 0.8, 1.5], [0.8, 1.6, 0.18], { cast: false, name: 'Stillpoint survey plaque' });
    this.disposers.push(
      this.interactions.register({
        id: 'scan:stillpoint',
        entity: plaque,
        holdSeconds: 1.2,
        label: 'Scan Stillpoint foundation',
        enabled: () => !this.state.scanned.includes('guide:landmark:stillpoint'),
        interact: () => this.dispatch({ type: 'scan', entryId: 'guide:landmark:stillpoint' }, 'The Stillpoint', 'Foundation geometry added to the field guide.', 'SUBJECT CATALOGED'),
      }),
    );
  }

  buildMeridianTower() {
    const x = -118;
    const z = -38;
    const ground = this.terrain.heightAt(x, z);
    const tower = new THREE.Group();
    tower.name = 'Meridian survey tower / three decks';
    this.root.add(tower);
    const decks = [ground + 0.35, ground + 6.4, ground + 12.45];
    const batch = new StaticBatch();
    batch.add('cylinder', this.materials.structure, [x, ground + 7, z], [1.6, 14, 1.6]);
    this.disposers.push(this.collision.add({ id: 'tower:spine', minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8, minY: ground - 1, maxY: ground + 14 }));
    for (let i = 0; i < decks.length; i += 1) {
      const h = decks[i];
      batch.add('box', i === 2 ? this.materials.structureAccent : this.materials.structure, [x, h - 0.16, z], [10, 0.32, 10]);
      this.disposers.push(this.collision.addSurface({ id: `tower:deck:${i}`, minX: x - 4.8, maxX: x + 4.8, minZ: z - 4.8, maxZ: z + 4.8, height: h }));
      for (const [rx, rz, sx, sz] of [
        [x - 4.8, z, 0.18, 9.5],
        [x + 4.8, z, 0.18, 9.5],
        [x, z - 4.8, 9.5, 0.18],
        [x, z + 4.8, 9.5, 0.18],
      ]) {
        batch.add('box', this.materials.roadEdge, [rx, h + 0.72, rz], [sx, 1.4, sz], null, false);
        if (i > 0) this.disposers.push(this.collision.add({ id: `tower:rail:${i}:${rx}:${rz}`, minX: rx - sx / 2, maxX: rx + sx / 2, minZ: rz - sz / 2, maxZ: rz + sz / 2, minY: h, maxY: h + 1.5 }));
      }
    }
    batch.add('cylinder', this.materials.fieldOrange, [x, decks[2] + 4.6, z], [0.55, 9.2, 0.55], null, false);
    batch.add('sphere', this.materials.lichenGlow, [x, decks[2] + 9.5, z], [1.25, 0.35, 1.25], null, false);
    batch.build(tower);

    const ascend = prim(tower, 'box', this.materials.fieldOrange, [x - 2.8, decks[0] + 0.9, z - 3.6], [0.7, 1.8, 0.35], { cast: false, name: 'Meridian lift / ascend' });
    this.disposers.push(
      this.interactions.register({
        id: 'tower:ascend',
        entity: ascend,
        range: 5.5,
        holdSeconds: 0.65,
        label: 'Ascend Meridian tower',
        interact: () => {
          this.player.teleport(x - 2.4, z + 2.4, decks[2]);
          this.hud.showToast('Meridian tower // upper deck', 'Vertical field link stable. The entire Greywater basin is exposed.', 'LIFT TRANSIT');
        },
      }),
    );
    const descend = prim(tower, 'box', this.materials.fieldOrange, [x + 2.8, decks[2] + 0.9, z + 3.6], [0.7, 1.8, 0.35], { cast: false, name: 'Meridian lift / descend' });
    this.disposers.push(
      this.interactions.register({
        id: 'tower:descend',
        entity: descend,
        range: 5.5,
        holdSeconds: 0.4,
        label: 'Descend Meridian tower',
        interact: () => this.player.teleport(x - 2.4, z - 2.2, decks[0]),
      }),
    );
    const archive = prim(tower, 'box', this.materials.window, [x, decks[2] + 1.05, z - 2.5], [2.4, 1.6, 0.5], { cast: false, name: 'Meridian upper archive' });
    this.disposers.push(
      this.interactions.register({
        id: 'scan:meridian-tower',
        entity: archive,
        range: 6,
        holdSeconds: 1.1,
        label: 'Scan Meridian upper archive',
        enabled: () => !this.state.scanned.includes('guide:landmark:meridian-tower'),
        interact: () => this.dispatch({ type: 'scan', entryId: 'guide:landmark:meridian-tower' }, 'Meridian survey tower', 'Upper-deck archive and impossible horizon coordinate cataloged.', 'LANDMARK CATALOGED'),
      }),
    );
  }

  buildTerritory() {
    const counts = { megacity: 8, city: 6, town: 4, village: 3 };
    SETTLEMENTS.forEach((s, index) => {
      const ground = this.terrain.heightAt(s.x, s.z);
      const group = new THREE.Group();
      group.name = `Atlas settlement / ${s.name}`;
      group.position.set(s.x, ground, s.z);
      this.root.add(group);
      const batch = new StaticBatch();
      const n = counts[s.tier];
      for (let i = 0; i < n; i += 1) {
        const angle = (i / n) * Math.PI * 2 + index * 0.47;
        const radius = 7 + (i % 3) * 5;
        const height = 2.8 + ((index + i * 3) % 5) * 0.85;
        const width = 3.2 + (i % 2) * 1.8;
        const lx = Math.cos(angle) * radius;
        const lz = Math.sin(angle) * radius;
        batch.add('box', i % 3 === 0 ? this.materials.structureAccent : this.materials.structure, [lx, height / 2, lz], [width, height, width * 0.8], [0, (-angle * 180) / Math.PI + 90, 0]);
        batch.add('box', this.materials.window, [lx, height * 0.58, lz - width * 0.41], [width * 0.38, 0.35, 0.08], null, false);
        const half = width * 0.8 * 0.45;
        this.disposers.push(this.collision.add({ id: `settlement:${s.id}:${i}`, minX: s.x + lx - half, maxX: s.x + lx + half, minZ: s.z + lz - half, maxZ: s.z + lz + half, minY: ground - 2, maxY: ground + height }));
      }
      batch.add('cylinder', this.materials.fieldOrange, [0, 6.2, 0], [0.22, 12.4, 0.22], null, false);
      for (let r = -2; r <= 2; r += 1) batch.add('box', this.materials.road, [r * 8, 0.08, 22], [7.5, 0.12, 5], null, false);
      batch.build(group);
      group.updateMatrix();
      group.matrixAutoUpdate = false;
      const primary = biomeAt(s.x, s.z, this.terrain.seed).biome.primaryResource;
      this.createResource({ id: `regional:${s.id}`, item: primary, quantity: s.tier === 'village' ? 2 : 3, x: s.x + 17, z: s.z + 11, kind: RESOURCE_KIND[primary] });
    });
  }

  /* ------------------------------------------------------------- deploy */

  syncPresentation() {
    this.syncResources();
    this.syncDeployments();
  }

  syncResources() {
    for (const [id, object] of this.resourceEntities) object.visible = !this.state.collected.includes(id);
  }

  /** Make the scene match state.deployments (new ones built, trimmed or sandbox-only ones removed). */
  syncDeployments() {
    const ids = new Set(this.state.deployments.map((d) => d.id));
    for (const [id, entry] of this.deploymentObjects) {
      if (ids.has(id)) continue;
      for (const dispose of entry.disposers) dispose();
      disposeObject(entry.group);
      this.deploymentObjects.delete(id);
    }
    for (const d of this.state.deployments) if (!this.deploymentObjects.has(d.id)) this.createDeployment(d);
  }

  createDeployment(d) {
    const ground = this.terrain.heightAt(d.x, d.z);
    const group = new THREE.Group();
    group.name = `Persistent deployment / ${d.id}`;
    group.position.set(d.x, ground, d.z);
    this.root.add(group);
    const disposers = [];
    this.deploymentObjects.set(d.id, { group, disposers });
    const batch = new StaticBatch();
    const light = (color, intensity, range, height) => disposers.push(this.render.addLight({ position: new THREE.Vector3(d.x, ground + height, d.z), color, intensity, range }));
    const rest = (minutes, title) => {
      this.state = reduceField(this.state, { type: 'rest', minutes });
      this.advanceTime(minutes);
      this.soundscape.complete();
      this.hud.showToast(title, `Exposure cleared. ${minutes} field minutes elapsed.`, 'FIELD CAMP');
      this.saveNow(false);
      this.refreshHud(true);
    };
    switch (d.item) {
      case 'bedroll': {
        const roll = prim(group, 'box', this.materials.fieldOrange, [0, 0.18, 0], [1.25, 0.2, 2.4], { cast: false, name: 'Deployed survey bedroll' });
        disposers.push(this.interactions.register({ id: `${d.id}:rest`, entity: roll, label: 'Rest in survey bedroll', holdSeconds: 0.8, interact: () => rest(90, 'Bedroll rest complete') }));
        break;
      }
      case 'campfire_kit': {
        const fire = prim(group, 'cone', this.materials.fieldOrange, [0, 0.45, 0], [0.55, 0.9, 0.55], { cast: false, name: 'Deployed campfire' });
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 7) * Math.PI * 2;
          batch.add('sphere', this.materials.rock, [Math.cos(a) * 0.7, 0.22, Math.sin(a) * 0.7], [0.3, 0.22, 0.3], null, false);
        }
        light([1, 0.35, 0.08], 5.5, 15, 1.2);
        disposers.push(
          this.interactions.register({
            id: `${d.id}:warm`,
            entity: fire,
            label: 'Warm and dry at campfire',
            holdSeconds: 0.7,
            interact: () => {
              this.state = reduceField(this.state, { type: 'set-condition', wetness: Math.max(0, this.state.wetness - 65), cold: Math.max(0, this.state.cold - 75) });
              this.advanceTime(20);
              this.hud.showToast('Campfire protocol complete', 'Clothing dried and cold stress cleared.', 'FIELD CAMP');
              this.saveNow(false);
              this.refreshHud(true);
            },
          }),
        );
        break;
      }
      case 'survey_marker':
        batch.add('cylinder', this.materials.lichenGlow, [0, 1.4, 0], [0.16, 2.8, 0.16], null, false);
        batch.add('sphere', this.materials.fieldOrange, [0, 2.95, 0], [0.32, 0.32, 0.32], null, false);
        break;
      case 'weather_shelter': {
        batch.add('box', this.materials.roof, [0, 2.45, 0], [4.8, 0.24, 3.8], [0, 0, -5], true);
        for (const sx of [-2, 2]) batch.add('box', this.materials.timber, [sx, 1.2, 0], [0.18, 2.4, 0.18], null, true);
        const sheet = prim(group, 'box', this.materials.fieldOrange, [0, 0.12, 0], [3.6, 0.12, 2.7], { cast: false, name: 'Shelter groundsheet' });
        disposers.push(this.interactions.register({ id: `${d.id}:shelter-rest`, entity: sheet, label: 'Rest in weather shelter', holdSeconds: 0.9, interact: () => rest(120, 'Sheltered rest complete') }));
        break;
      }
      case 'field_torch':
        batch.add('cylinder', this.materials.structureAccent, [0, 1.25, 0], [0.12, 2.5, 0.12], null, false);
        batch.add('sphere', this.materials.lichenGlow, [0, 2.65, 0], [0.28, 0.28, 0.28], null, false);
        light([0.45, 0.88, 0.76], 3.2, 12, 2.6);
        break;
      default:
        break;
    }
    if (batch.size) batch.build(group);
  }

  createResource(r) {
    const ground = this.terrain.heightAt(r.x, r.z);
    const group = new THREE.Group();
    group.name = `Resource / ${r.id}`;
    group.position.set(r.x, ground, r.z);
    this.root.add(group);
    this.resourceEntities.set(r.id, group);
    const batch = new StaticBatch();
    if (r.kind === 'lichen') {
      for (let i = 0; i < 5; i += 1) {
        const a = i * 2.17;
        batch.add('cone', this.materials.lichenGlow, [Math.cos(a) * 0.65, 0.45, Math.sin(a) * 0.65], [0.34, 0.9 + i * 0.08, 0.34], null, false);
      }
    } else if (r.kind === 'wood') {
      batch.add('cylinder', this.materials.timber, [0, 0.45, 0], [0.75, 3.4, 0.75], [0, 0, 84], true);
    } else if (r.kind === 'relic') {
      batch.add('box', this.materials.fieldOrange, [0, 0.55, 0], [1.1, 1.1, 0.55], [11, 23, 7], false);
    } else {
      batch.add('cone', r.kind === 'ore' ? this.materials.hazard : this.materials.rock, [0, 0.85, 0], [1.2, 1.7, 1.2], [9, 25, -8], false);
    }
    batch.build(group);
    this.disposers.push(
      this.interactions.register({
        id: `resource:${r.id}`,
        entity: group,
        holdSeconds: 0.45,
        label: `Gather ${ITEMS[r.item].name}`,
        enabled: () => !this.state.collected.includes(r.id),
        interact: () => {
          this.dispatch(
            { type: 'collect', persistentId: r.id, item: r.item, quantity: r.quantity },
            ITEMS[r.item].name,
            `${r.quantity} unit${r.quantity === 1 ? '' : 's'} added to field inventory.`,
            'RESOURCE GATHERED',
          );
          group.visible = false;
        },
      }),
    );
  }

  /* ---------------------------------------------------- residents & fauna */

  buildResidents() {
    for (let i = 0; i < 6; i += 1) {
      const root = this.createHumanoid(`Ambient surveyor ${i + 1}`, 0, 0, 0, this.materials.citizen, i % 3 === 0 ? this.materials.fieldOrange : this.materials.structureAccent);
      this.citizens.push({ root, centerX: 0, centerZ: 34, radiusX: 19 + (i % 2) * 5, radiusZ: 13 + (i % 3) * 3, phase: (i / 6) * Math.PI * 2, speed: 0.07 + i * 0.006, altitude: 0 });
    }
    const pebbleback = this.createPebbleback('Pebbleback grazer');
    this.wildlife.push({ root: pebbleback, centerX: 42, centerZ: 65, radiusX: 14, radiusZ: 9, phase: 0.4, speed: 0.12, altitude: 0, entryId: 'guide:fauna:pebbleback', alertRadius: 13 });
    this.registerScan('scan:pebbleback', pebbleback, 10, 1.4, 'Scan pebbleback', 'guide:fauna:pebbleback', 'Pebbleback', 'Rigid-route behavior and shell profile cataloged.');
    const sailwing = this.createSailwing('Sailwing thermal glider');
    this.wildlife.push({ root: sailwing, centerX: -44, centerZ: -20, radiusX: 24, radiusZ: 18, phase: 2.1, speed: 0.09, altitude: 13, entryId: 'guide:fauna:sailwing', alertRadius: 18 });
    this.registerScan('scan:sailwing', sailwing, 16, 1.5, 'Scan sailwing', 'guide:fauna:sailwing', 'Sailwing', 'Thermal route and wing geometry cataloged.');
    const stilt = this.createRidgeStilt('Warden ridge stilt');
    this.wildlife.push({ root: stilt, centerX: -35065, centerZ: 10185, radiusX: 18, radiusZ: 13, phase: 1.2, speed: 0.105, altitude: 0, entryId: 'guide:fauna:ridge-stilt', alertRadius: 16 });
    this.registerScan('scan:ridge-stilt', stilt, 12, 1.3, 'Scan ridge stilt', 'guide:fauna:ridge-stilt', 'Ridge stilt', 'Alert posture and return route cataloged without a skeletal clip.');
    this.updateResidents();
  }

  registerScan(id, entity, range, holdSeconds, label, entryId, title, detail) {
    this.disposers.push(
      this.interactions.register({
        id,
        entity,
        range,
        holdSeconds,
        label,
        enabled: () => !this.state.scanned.includes(entryId),
        interact: () => this.dispatch({ type: 'scan', entryId }, title, detail, 'FAUNA CATALOGED'),
      }),
    );
  }

  createHumanoid(name, x, y, z, body, accent) {
    const root = new THREE.Group();
    root.name = name;
    root.position.set(x, y, z);
    this.root.add(root);
    const batch = new StaticBatch();
    batch.add('box', body, [0, 1.45, 0], [0.72, 1.25, 0.42], null, false);
    batch.add('box', this.materials.structure, [-0.2, 0.58, 0], [0.22, 1.15, 0.25], null, false);
    batch.add('box', this.materials.structure, [0.2, 0.58, 0], [0.22, 1.15, 0.25], null, false);
    batch.build(root);
    root.userData.head = prim(root, 'sphere', accent, [0, 2.35, 0], [0.38, 0.42, 0.38], { cast: false, name: 'Head' });
    return root;
  }

  createPebbleback(name) {
    const root = new THREE.Group();
    root.name = name;
    this.root.add(root);
    const batch = new StaticBatch();
    batch.add('sphere', this.materials.wildlife, [0, 1.05, 0], [1.8, 1, 1.25], null, false);
    batch.add('box', this.materials.structureAccent, [1.55, 0.95, 0], [0.75, 0.65, 0.68], null, false);
    for (const lx of [-0.8, 0.8]) for (const lz of [-0.6, 0.6]) batch.add('box', this.materials.wildlife, [lx, 0.38, lz], [0.24, 0.75, 0.24], null, false);
    batch.build(root);
    return root;
  }

  createSailwing(name) {
    const root = new THREE.Group();
    root.name = name;
    this.root.add(root);
    const batch = new StaticBatch();
    batch.add('cone', this.materials.wildlife, [0, 0, 0], [0.6, 2.4, 0.6], [0, 0, 90], false);
    batch.add('box', this.materials.structureAccent, [-1.7, 0, 0], [3.4, 0.08, 1.25], [0, 8, 8], false);
    batch.add('box', this.materials.structureAccent, [1.7, 0, 0], [3.4, 0.08, 1.25], [0, -8, -8], false);
    batch.build(root);
    return root;
  }

  createRidgeStilt(name) {
    const root = new THREE.Group();
    root.name = name;
    this.root.add(root);
    const batch = new StaticBatch();
    batch.add('box', this.materials.wildlife, [0, 2.5, 0], [1.4, 0.8, 0.75], null, false);
    batch.add('box', this.materials.structureAccent, [0.55, 3.35, 0], [0.24, 1.5, 0.26], [0, 0, -17], false);
    batch.add('cone', this.materials.fieldOrange, [0.9, 4.18, 0], [0.42, 0.8, 0.42], [0, 0, 90], false);
    for (const lx of [-0.48, 0.48]) batch.add('box', this.materials.structure, [lx, 1.15, 0], [0.16, 2.3, 0.18], null, false);
    batch.build(root);
    return root;
  }

  updateResidents() {
    const p = this.player.worldPosition;
    const move = (walker, index) => {
      const t = walker.phase + this.elapsed * walker.speed;
      let x = walker.centerX + Math.cos(t) * walker.radiusX;
      let z = walker.centerZ + Math.sin(t) * walker.radiusZ;
      if (walker.alertRadius) {
        const dx = x - p.x;
        const dz = z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < walker.alertRadius) {
          const push = (walker.alertRadius - Math.max(0.01, d)) * 1.7;
          x += (dx / Math.max(0.01, d)) * push;
          z += (dz / Math.max(0.01, d)) * push;
        }
      }
      const y = this.terrain.heightAt(x, z) + walker.altitude + (walker.altitude > 0 ? Math.sin(t * 2.3) * 1.8 : 0);
      walker.root.position.set(x, y, z);
      setEulerDeg(walker.root, 0, (-t * 180) / Math.PI + 90, walker.altitude > 0 ? Math.sin(t * 1.7) * 7 : Math.sin(t * 3 + index) * 1.5);
    };
    this.citizens.forEach(move);
    this.wildlife.forEach(move);
  }

  /* --------------------------------------------------------- conditions */

  discoverLocation() {
    const p = this.player.worldPosition;
    const local = nearestLocalSite(p.x, p.z);
    let nearest = null;
    for (const s of SETTLEMENTS) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (!nearest || d < nearest.distance) nearest = { settlement: s, distance: d };
    }
    const site = local ? { id: local.id, name: local.name, regional: false } : nearest && nearest.distance <= 70 ? { id: nearest.settlement.id, name: nearest.settlement.name, regional: true } : null;
    if (!site || site.id === this.locationId) return;
    this.locationId = site.id;
    if (this.state.discovered.includes(site.id)) return;
    this.state = reduceField(this.state, { type: 'discover', locationId: site.id });
    this.hud.showToast(site.name, site.regional ? 'Settlement approach logged on the territory atlas.' : 'Location added to the local field atlas.', 'LOCATION DISCOVERED', 3800);
    this.soundscape.ping(2);
    this.saveNow(false);
  }

  updateCondition() {
    if (this.invincible) {
      if (this.state.health < 100) this.state = reduceField(this.state, { type: 'set-condition', health: 100 });
      return;
    }
    if (this.gridLab) return;
    const env = this.environment();
    const p = this.player.worldPosition;
    const k = this.exposureScale;
    const sheltered =
      Math.hypot(p.x, p.z - 36) < 24 ||
      this.state.deployments.some((d) => d.item === 'weather_shelter' && Math.hypot(p.x - d.x, p.z - d.z) < 5.5) ||
      !!this.isSheltered?.(p);
    const wetness = sheltered ? Math.max(0, this.state.wetness - 1.4) : Math.min(100, this.state.wetness + env.precipitation * 1.45 * k - 0.18);
    const coldDelta = env.temperatureC < 11 ? (11 - env.temperatureC) * 0.018 * k : -0.34;
    const cold = Math.max(0, Math.min(100, this.state.cold + coldDelta + Math.max(0, wetness) * 0.0035 * k));
    const health = cold > 88 ? Math.max(1, this.state.health - (cold - 88) * 0.025 * k) : this.state.health;
    this.state = reduceField(this.state, { type: 'set-condition', wetness, cold, health });
  }

  /* ---------------------------------------------------------------- HUD */

  refreshHud(force = false) {
    if (!force && this.hudClock < 0.2) return;
    this.hudClock = 0;
    const p = this.player.worldPosition;
    const restored = this.relayStatus();
    let nearestRelay = null;
    for (const site of LOCAL_SITES) {
      if (site.kind !== 'relay' || restored.has(site.id)) continue;
      if (!nearestRelay || Math.hypot(site.x - p.x, site.z - p.z) < Math.hypot(nearestRelay.x - p.x, nearestRelay.z - p.z)) nearestRelay = site;
    }
    const fallback = nearestRelay ?? LOCAL_SITES.find((s) => s.id === 'stillpoint') ?? null;
    const waypoint = this.waypointTarget();
    const target = waypoint ?? fallback;
    const biome = biomeAt(p.x, p.z, this.terrain.seed);
    const local = nearestLocalSite(p.x, p.z);
    const settlement = SETTLEMENTS.find((s) => Math.hypot(s.x - p.x, s.z - p.z) < 70) ?? null;
    const guide = GUIDE.map((g) => ({ ...g, known: this.state.scanned.includes(g.id) }));
    const revealed = new Set(this.revealedSettlements().map((s) => s.id));
    const recipe = RECIPES[this.selectedRecipeIndex];
    const gear = DEPLOYABLES[this.selectedGearIndex];
    const atlasMarkers = SETTLEMENTS.map((s) => ({ id: s.id, name: s.name, tier: s.tier, x: s.x, z: s.z, revealed: revealed.has(s.id), selected: s.id === this.state.waypointId, recorded: false }));
    let echoesRevealed = 0;
    ECHOES.forEach((e, index) => {
      if (!this.echoIsRevealed(index)) return;
      echoesRevealed += 1;
      atlasMarkers.push({ id: e.id, name: e.name, tier: 'echo', x: e.x, z: e.z, revealed: true, selected: e.id === this.state.waypointId, recorded: this.state.scanned.includes(e.entryId) });
    });
    this.hud.setFrontierState({
      health: this.state.health,
      stamina: this.player.stamina,
      wetness: this.state.wetness,
      cold: this.state.cold,
      inventory: Object.keys(ITEMS)
        .map((id) => ({ id, name: ITEMS[id].name, quantity: this.state.inventory[id], category: ITEMS[id].category }))
        .filter((item) => item.quantity > 0),
      weight: inventoryWeight(this.state.inventory),
      contracts: contractStatus(this.state),
      guide,
      location: this.locationLabel(p) ?? local?.name ?? settlement?.name ?? biome.biome.name,
      biome: biome.biome.name,
      target: target ? { name: target.name, bearing: bearingTo(p, target), distance: formatDistance(Math.hypot(target.x - p.x, target.z - p.z)) } : null,
      player: { x: p.x, z: p.z },
      markers: [
        ...LOCAL_SITES.map((s) => ({ id: s.id, name: s.name, kind: s.kind, x: s.x, z: s.z, discovered: this.state.discovered.includes(s.id), complete: restored.has(s.id) })),
        // The first Whisperglass echo stands inside the local field, so it is on the local map too.
        { id: ECHOES[0].id, name: ECHOES[0].name, kind: 'echo', x: ECHOES[0].x, z: ECHOES[0].z, discovered: true, complete: this.state.scanned.includes(ECHOES[0].entryId) },
      ],
      mapHalfExtent: 170,
      atlasMarkers,
      atlasHalfExtent: ATLAS_HALF_EXTENT,
      atlasRevealed: revealed.size + echoesRevealed,
      atlasTotal: SETTLEMENTS.length + ECHOES.length,
      waypoint: waypoint ? { name: waypoint.name, economy: waypoint.economy, distance: formatDistance(Math.hypot(waypoint.x - p.x, waypoint.z - p.z)) } : null,
      selectedRecipe: {
        label: recipe.label,
        station: recipe.station,
        ready: Object.entries(recipe.ingredients).every(([id, n]) => this.state.inventory[id] >= (n ?? 0)),
        ingredients: this.recipeRequirements(recipe),
      },
      selectedGear: { name: ITEMS[gear].name, quantity: this.state.inventory[gear] },
      deployments: this.state.deployments.length,
      echoes: this.echoCount,
      reputation: this.state.reputation,
      flashlight: this.player.flashlightEnabled,
    });
  }

  /** A place name that overrides the biome (the vault sets this). */
  locationLabel() {
    return null;
  }

  dispatch(action, title, detail, kicker) {
    this.state = reduceField(this.state, action);
    this.soundscape.ping(this.state.scanned.length + this.state.collected.length);
    this.hud.showToast(title, detail, kicker, 3600);
    this.saveNow(false);
    this.refreshHud(true);
  }

  recipeRequirements(recipe) {
    return Object.entries(recipe.ingredients)
      .map(([id, n]) => `${n ?? 0} ${ITEMS[id].shortName}`)
      .join(' + ');
  }

  craftAtWorkbench() {
    const recipe = RECIPES[this.selectedRecipeIndex];
    const result = craft(this.state, recipe.id, 'workbench');
    this.state = result.state;
    this.hud.showToast(
      recipe.label,
      result.crafted ? `${result.reason} ${this.state.inventory[recipe.output.item]} now prepared.` : `${result.reason} Requires ${this.recipeRequirements(recipe)}. Cycle the recipe to choose another.`,
      result.crafted ? 'FABRICATION COMPLETE' : 'FABRICATION BLOCKED',
    );
    if (result.crafted) {
      this.soundscape.complete();
      this.saveNow(false);
    } else {
      this.soundscape.reject();
    }
    this.refreshHud(true);
  }
}
