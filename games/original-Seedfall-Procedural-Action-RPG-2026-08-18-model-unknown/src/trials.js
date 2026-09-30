import * as THREE from "three/webgpu";
import { BIOMES } from "./data.js";
import { Rng, deriveSeed, distance2D } from "./util.js";

/**
 * Shrine Trials: a side activity at every roadside shrine. Once a shrine has
 * been activated, using it again calls three waves of the region's own foes
 * into a glowing circle around it. Clear every wave before the light fades,
 * without leaving the circle, and the shrine yields a cache: a seeded item
 * (one per shrine, so a seed always offers the same prizes), gold, a draught
 * and experience. Each shrine can be won once per journey; a failed trial can
 * be tried again.
 */

export const TRIAL_WAVES = 3;
const TIME_LIMIT = 150;
/** Walking this far from the shrine forfeits the trial; the ring marks it. */
const ARENA_RADIUS = 28;
const BREATHER = 2.5;
const ELITE_MODIFIERS = ["Frenzied", "Armored", "Vampiric", "Volatile", "Chilling", "Venomous"];

let attempts = 0;

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The arena ring, draped over the terrain so hills do not swallow it. */
function buildArenaRing(world, poi) {
  const geometry = new THREE.RingGeometry(ARENA_RADIUS - 0.45, ARENA_RADIUS, 72, 1);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  for (let k = 0; k < position.count; k += 1) {
    position.setY(k, world.getHeightAt(poi.x + position.getX(k), poi.z + position.getZ(k)) + 0.18);
  }
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    color: 0xb06ee0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(poi.x, 0, poi.z);
  mesh.name = `trial-ring:${poi.id}`;
  return mesh;
}

export class ShrineTrial {
  game;
  poi;
  wave = 0;
  alive = 0;
  timeLeft = TIME_LIMIT;
  breather = 1.6;
  ids = new Set();
  finished = false;
  age = 0;

  constructor(game, poi) {
    this.game = game;
    this.poi = poi;
    attempts += 1;
    this.attempt = attempts;
    this.rng = new Rng(deriveSeed(poi.seed, "trial", attempts));
    this.ring = buildArenaRing(game.world, poi);
    game.renderer.effectsRoot.add(this.ring);
  }

  /** The HUD banner under the location name. */
  get label() {
    const clock = formatClock(this.timeLeft);
    if (this.wave === 0) return `Shrine Trial · The shrine gathers its challengers · ${clock}`;
    if (this.alive === 0 && this.wave < TRIAL_WAVES) return `Shrine Trial · Wave ${this.wave} cleared · ${clock}`;
    return `Shrine Trial · Wave ${this.wave}/${TRIAL_WAVES} · ${this.alive} ${this.alive === 1 ? "foe" : "foes"} left · ${clock}`;
  }

  update(dt) {
    if (this.finished) return;
    const game = this.game;
    const player = game.player;
    if (!player) return;
    this.age += dt;
    this.timeLeft -= dt;
    this.ring.material.opacity = 0.38 + Math.sin(this.age * 3.2) * 0.14;
    if (distance2D(player.position2D, this.poi) > ARENA_RADIUS) {
      this.fail("You left the shrine's circle.");
      return;
    }
    if (this.timeLeft <= 0) {
      this.fail("The shrine's light faded before the last foe fell.");
      return;
    }
    let alive = 0;
    for (const id of this.ids) {
      const enemy = game.enemies.get(id);
      if (enemy && !enemy.dead) alive += 1;
    }
    this.alive = alive;
    if (alive > 0) return;
    if (this.wave >= TRIAL_WAVES) {
      this.succeed();
      return;
    }
    this.breather -= dt;
    if (this.breather <= 0) {
      this.spawnWave();
      this.breather = BREATHER;
    }
  }

  spawnWave() {
    const game = this.game;
    const poi = this.poi;
    this.wave += 1;
    this.ids.clear();
    const level = Math.max(1, poi.danger + this.wave - 1);
    const count = 2 + this.wave + Math.floor(poi.danger / 4);
    const kinds = BIOMES[poi.biome]?.enemyIds ?? BIOMES.plains.enemyIds;
    for (let k = 0; k < count; k += 1) {
      const angle = (k / count) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const radius = this.rng.range(8, 12);
      const elite = this.wave === TRIAL_WAVES && k === 0;
      const enemy = game.spawnEnemy(
        {
          id: `trial:${poi.id}:${this.attempt}:${this.wave}:${k}`,
          x: poi.x + Math.sin(angle) * radius,
          z: poi.z + Math.cos(angle) * radius,
          archetypeId: this.rng.pick(kinds),
          level,
          elite,
          modifiers: elite ? [this.rng.pick(ELITE_MODIFIERS)] : [],
          guardingPoiId: poi.id,
        },
        "trial",
      );
      if (enemy) {
        enemy.aggro = true;
        this.ids.add(enemy.id);
      }
    }
    this.alive = this.ids.size;
    game.events.emit("toast", {
      title: `Wave ${this.wave} of ${TRIAL_WAVES}`,
      detail: this.wave === TRIAL_WAVES ? "A champion leads the last wave." : `${count} foes answer the shrine's call.`,
      tone: this.wave === TRIAL_WAVES ? "rare" : "normal",
    });
    game.audio.play("trial");
    game.kit.input.rumble(0.35, 140);
  }

  succeed() {
    const game = this.game;
    const poi = this.poi;
    const player = game.player;
    this.dispose();
    game.trial = null;
    if (!game.persistence.completedTrials.includes(poi.id)) game.persistence.completedTrials.push(poi.id);
    game.record.trials += 1;
    const reward = game.rewardScale();
    // One prize per shrine, seeded, so every seed has its own trial treasures.
    const item = game.loot.generateItem(
      deriveSeed(poi.seed, "trial-reward"),
      Math.max(player.progress.level, poi.danger),
      0.35,
    );
    const gold = Math.round((25 + poi.danger * 14) * reward);
    if (!game.loot.addItem(player.inventory, item)) {
      game.spawnPickup({ x: poi.x, z: poi.z + 2.2, item });
    }
    game.progression.grantGold(gold);
    player.potions += 1;
    player.refreshVitals(true);
    game.progression.grantXp(Math.round((70 + poi.danger * 28) * reward), "Shrine Trial");
    game.events.emit("toast", {
      title: `${poi.name}: trial won`,
      detail: `${item.name} · ${gold} gold · a healing draught. Health and focus restored.`,
      tone: "rare",
    });
    game.events.emit("inventoryChanged", undefined);
    game.audio.play("level");
    game.kit.input.rumble(0.6, 260);
    game.saveNow(false);
  }

  fail(reason) {
    const game = this.game;
    this.dispose();
    game.trial = null;
    game.events.emit("toast", { title: "Shrine Trial failed", detail: `${reason} The shrine will test you again.`, tone: "bad" });
    game.audio.play("deny");
  }

  /** Remove the ring and any challengers still standing. */
  dispose() {
    if (this.finished) return;
    this.finished = true;
    for (const id of this.ids) {
      const enemy = this.game.enemies.get(id);
      if (enemy && !enemy.dead) this.game.removeEnemy(id);
    }
    this.ids.clear();
    this.ring.removeFromParent();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}
