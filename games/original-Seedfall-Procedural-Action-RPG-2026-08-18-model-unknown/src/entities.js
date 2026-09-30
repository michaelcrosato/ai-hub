import * as THREE from "three/webgpu";
import { ARCHETYPES, ENEMY_TYPES, SKILLS } from "./data.js";
import { clamp } from "./util.js";
import { addStats } from "./loot.js";
import { shared, sharedBasic } from "./world.js";

// Enemies and NPCs stream in and out all the time, so their meshes share
// geometry and materials; only an enemy's body material (hit flash) is its own.
const geometries = new Map();
function geometry(key, make) {
  let g = geometries.get(key);
  if (!g) {
    g = shared(make());
    geometries.set(key, g);
  }
  return g;
}
const lamberts = new Map();
function sharedLambert(color) {
  let m = lamberts.get(color);
  if (!m) {
    m = shared(new THREE.MeshLambertMaterial({ color, flatShading: true }));
    lamberts.set(color, m);
  }
  return m;
}
const SHADOW_MATERIAL = shared(
  new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.23, depthWrite: false }),
);
const BAR_BACK = shared(
  new THREE.MeshBasicMaterial({ color: 0x201b1b, transparent: true, opacity: 0.85, depthTest: false }),
);
const BAR_FILL = shared(new THREE.MeshBasicMaterial({ color: 0xd65353, depthTest: false }));
const _q = new THREE.Quaternion();

function makeShadowDisc(radius) {
  let e = new THREE.Mesh(
    geometry(`disc:${radius}`, () => new THREE.CircleGeometry(radius, 18)),
    SHADOW_MATERIAL,
  );
  e.rotation.x = -Math.PI / 2;
  e.position.y = 0.03;
  return e;
}

function makeHealthBar(s = 1.8) {
  let e = new THREE.Group();
  e.position.y = 2.7;
  let t = new THREE.Mesh(geometry(`bar:${s}`, () => new THREE.PlaneGeometry(s, 0.16)), BAR_BACK);
  let n = new THREE.Mesh(geometry(`fill:${s}`, () => new THREE.PlaneGeometry(s - 0.06, 0.1)), BAR_FILL);
  n.position.z = 0.01;
  // Drawn after the scene so terrain and props never cover a bar.
  t.renderOrder = 20;
  n.renderOrder = 21;
  e.add(t, n);
  return {
    group: e,
    fill: n,
  };
}

export class Player {
  id = "player";
  group = new THREE.Group();
  archetype;
  attributes;
  inventory = [];
  equipment = {};
  learnedSkills = [];
  hotbar = [null, null, null, null, null, null];
  progress = {
    level: 1,
    xp: 0,
    xpToNext: 100,
    skillPoints: 1,
    attributePoints: 0,
    gold: 45,
    reputation: {},
  };
  health = 100;
  resource = 100;
  potions = 3;
  velocity = {
    x: 0,
    z: 0,
  };
  facing = 0;
  attackCooldown = 0;
  secondaryCooldown = 0;
  dodgeCooldown = 0;
  dodgeTime = 0;
  invulnerable = 0;
  hitFlash = 0;
  blockTime = 0;
  attackBuffTime = 0;
  poisonWeaponTime = 0;
  stealthTime = 0;
  skillCooldowns = new Map();
  statusEffects = [];
  alive = true;
  bodyMaterial;
  aimIndicator;
  constructor(e) {
    this.archetype = ARCHETYPES.find((r) => r.id === e) ?? ARCHETYPES[0];
    this.attributes = {
      might: 5,
      finesse: 5,
      intellect: 5,
      vitality: 5,
    };
    if (e === "vanguard") {
      this.attributes.might += 3;
      this.attributes.vitality += 2;
    }
    if (e === "ranger") {
      this.attributes.finesse += 4;
      this.attributes.vitality += 1;
    }
    if (e === "shadow") {
      this.attributes.finesse += 5;
    }
    if (e === "arcanist") {
      this.attributes.intellect += 5;
    }
    if (e === "warden") {
      this.attributes.vitality += 3;
      this.attributes.intellect += 2;
    }
    this.bodyMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(this.archetype.color),
      flatShading: true,
    });
    let t = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.66, 1.3, 8), this.bodyMaterial);
    t.position.y = 0.85;
    let n = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.43, 0),
      new THREE.MeshLambertMaterial({
        color: 0xd8b18a,
        flatShading: true,
      }),
    );
    n.position.y = 1.72;
    let i = new THREE.Mesh(
      new THREE.ConeGeometry(0.63, 1.4, 5, 1, true),
      new THREE.MeshLambertMaterial({
        color: 0x27303a,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    );
    i.position.set(0, 0.9, 0.26);
    i.rotation.x = -0.08;
    this.aimIndicator = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.7, 5),
      new THREE.MeshBasicMaterial({
        color: 0xf6e6b6,
      }),
    );
    this.aimIndicator.rotation.x = Math.PI / 2;
    this.aimIndicator.position.set(0, 0.7, 0.85);
    this.group.add(makeShadowDisc(0.7), t, n, i, this.aimIndicator);
    this.group.name = this.id;
    for (let r of this.archetype.startingSkills) {
      this.learnSkill(r, true);
    }
    this.refreshVitals(true);
  }
  get x() {
    return this.group.position.x;
  }
  get z() {
    return this.group.position.z;
  }
  get position2D() {
    return {
      x: this.x,
      z: this.z,
    };
  }
  setPosition(e, t, n = 0) {
    this.group.position.set(e, n, t);
  }
  getStats() {
    let e = {
      ...this.archetype.baseStats,
    };
    e = addStats(e, {
      power: this.attributes.might * 1.35 + this.attributes.intellect * 0.45,
      armor: this.attributes.vitality * 0.55,
      maxHealth: this.attributes.vitality * 7,
      maxResource: this.attributes.intellect * 4,
      critChance: this.attributes.finesse * 0.006,
      moveSpeed: this.attributes.finesse * 0.003,
      healthRegen: this.attributes.vitality * 0.08,
      resourceRegen: this.attributes.intellect * 0.25,
    });
    for (let t of Object.values(this.equipment)) {
      if (t) {
        e = addStats(e, t.stats);
      }
    }
    for (let t of this.learnedSkills) {
      let n = SKILLS.find((i) => i.id === t.id);
      if (n?.passiveStats) {
        e = addStats(e, n.passiveStats, t.rank);
      }
    }
    if (this.attackBuffTime > 0) {
      e = addStats(e, {
        power: 8 + this.progress.level * 1.5,
      });
    }
    return e;
  }
  refreshVitals(e = false) {
    let t = this.getStats();
    if (e) {
      this.health = t.maxHealth;
      this.resource = t.maxResource;
    } else {
      this.health = clamp(this.health, 0, t.maxHealth);
      this.resource = clamp(this.resource, 0, t.maxResource);
    }
  }
  learnSkill(e, t = false) {
    let n = SKILLS.find((i) => i.id === e);
    if (
      !n ||
      this.learnedSkills.some((i) => i.id === e) ||
      (n.prerequisite && !this.learnedSkills.some((i) => i.id === n.prerequisite)) ||
      (!t && this.progress.skillPoints <= 0)
    ) {
      return false;
    }
    if (!t) {
      this.progress.skillPoints -= 1;
    }
    this.learnedSkills.push({
      id: e,
      rank: 1,
    });
    if (n.active) {
      let i = this.hotbar.findIndex((r) => r === null);
      if (i >= 0) {
        this.hotbar[i] = e;
      }
    }
    this.refreshVitals(false);
    return true;
  }
  allocateAttribute(e) {
    if (this.progress.attributePoints <= 0) {
      return false;
    } else {
      this.attributes[e] += 1;
      this.progress.attributePoints -= 1;
      this.refreshVitals(false);
      return true;
    }
  }
  respec() {
    let e = {
      might: 5,
      finesse: 5,
      intellect: 5,
      vitality: 5,
    };
    if (this.archetype.id === "vanguard") {
      e.might += 3;
      e.vitality += 2;
    }
    if (this.archetype.id === "ranger") {
      e.finesse += 4;
      e.vitality += 1;
    }
    if (this.archetype.id === "shadow") {
      e.finesse += 5;
    }
    if (this.archetype.id === "arcanist") {
      e.intellect += 5;
    }
    if (this.archetype.id === "warden") {
      e.vitality += 3;
      e.intellect += 2;
    }
    Object.assign(this.attributes, e);
    this.learnedSkills.splice(0, this.learnedSkills.length);
    this.hotbar.fill(null);
    for (let t of this.archetype.startingSkills) {
      this.learnSkill(t, true);
    }
    this.progress.skillPoints = this.progress.level;
    this.progress.attributePoints = Math.max(0, (this.progress.level - 1) * 2);
    this.skillCooldowns.clear();
    this.refreshVitals(true);
  }
  snapshot() {
    return {
      x: this.x,
      z: this.z,
      health: this.health,
      resource: this.resource,
      archetype: this.archetype.id,
      attributes: {
        ...this.attributes,
      },
      progress: JSON.parse(JSON.stringify(this.progress)),
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      equipment: JSON.parse(JSON.stringify(this.equipment)),
      learnedSkills: this.learnedSkills.map((e) => ({
        ...e,
      })),
      hotbar: [...this.hotbar],
      potions: this.potions,
    };
  }
  restore(e) {
    this.attributes.might = e.attributes.might;
    this.attributes.finesse = e.attributes.finesse;
    this.attributes.intellect = e.attributes.intellect;
    this.attributes.vitality = e.attributes.vitality;
    this.progress = JSON.parse(JSON.stringify(e.progress));
    this.inventory.splice(0, this.inventory.length, ...JSON.parse(JSON.stringify(e.inventory)));
    for (let t of ["weapon", "armor", "accessory"]) {
      delete this.equipment[t];
    }
    Object.assign(this.equipment, JSON.parse(JSON.stringify(e.equipment)));
    this.learnedSkills.splice(
      0,
      this.learnedSkills.length,
      ...e.learnedSkills.map((t) => ({
        ...t,
      })),
    );
    this.hotbar.splice(0, this.hotbar.length, ...e.hotbar);
    this.potions = e.potions;
    this.setPosition(e.x, e.z);
    this.refreshVitals(false);
    this.health = clamp(e.health, 1, this.getStats().maxHealth);
    this.resource = clamp(e.resource, 0, this.getStats().maxResource);
  }
  updateVisual(e) {
    this.group.rotation.y = this.facing;
    this.aimIndicator.position.z = 0.82 + Math.sin(performance.now() * 0.006) * 0.04;
    this.hitFlash = Math.max(0, this.hitFlash - e);
    this.bodyMaterial.emissive.setHex(this.hitFlash > 0 ? 0x7b2323 : 0);
    this.bodyMaterial.emissiveIntensity = this.hitFlash > 0 ? 1.1 : 0;
    this.group.visible = !(this.stealthTime > 0) || Math.floor(this.stealthTime * 12) % 2 !== 0;
  }
}

export class Enemy {
  group = new THREE.Group();
  id;
  archetypeId;
  level;
  elite;
  modifiers;
  guardingPoiId;
  health;
  maxHealth;
  damage;
  speed;
  attackCooldown = 0;
  telegraphTime = 0;
  telegraphKind = null;
  aiState = "idle";
  target;
  home;
  wanderTarget;
  aggro = false;
  hitFlash = 0;
  stagger = 0;
  rootTime = 0;
  phase = 1;
  statusEffects = [];
  summonedCount = 0;
  bodyMaterial;
  healthBar;
  healthFill;
  constructor(e) {
    let t = ENEMY_TYPES[e.archetypeId] ?? ENEMY_TYPES["briar-wolf"];
    this.id = e.id;
    this.archetypeId = t.id;
    this.level = e.level;
    this.elite = e.elite;
    this.modifiers = [...e.modifiers];
    this.guardingPoiId = e.guardingPoiId;
    let n = 1 + Math.max(0, this.level - 1) * 0.22;
    let i = this.elite ? 1.75 + this.modifiers.length * 0.15 : 1;
    this.maxHealth = Math.round(t.baseHealth * n * i);
    this.health = this.maxHealth;
    this.damage = t.baseDamage * (1 + (this.level - 1) * 0.12) * (this.elite ? 1.25 : 1);
    this.speed = t.speed * (this.modifiers.includes("Frenzied") ? 1.22 : 1);
    this.home = {
      x: e.x,
      z: e.z,
    };
    this.target = {
      ...this.home,
    };
    this.wanderTarget = {
      ...this.home,
    };
    this.bodyMaterial = new THREE.MeshLambertMaterial({
      color: t.color,
      emissive: this.elite ? t.accent : 0,
      emissiveIntensity: this.elite ? 0.16 : 0,
      flatShading: true,
    });
    let r = t.id.startsWith("boss-") ? 1.7 : this.elite ? 1.22 : 1;
    let a = geometry(`body:${t.behavior}:${r}`, () =>
      t.behavior === "flee"
        ? new THREE.OctahedronGeometry(r * 0.62, 0)
        : t.behavior === "charger"
          ? new THREE.ConeGeometry(r * 0.76, r * 1.7, 6)
          : t.behavior === "shield"
            ? new THREE.BoxGeometry(r * 1.05, r * 1.55, r * 0.85)
            : new THREE.DodecahedronGeometry(r * 0.72, 0),
    );
    let o = new THREE.Mesh(a, this.bodyMaterial);
    o.position.y = t.behavior === "flee" ? 1.3 : r * 0.9;
    let l = new THREE.Mesh(
      geometry(`eye:${r}`, () => new THREE.SphereGeometry(r * 0.16, 6, 4)),
      sharedBasic(t.accent),
    );
    l.position.set(0, r * 1.05, r * 0.58);
    if (t.behavior === "shield") {
      let h = new THREE.Mesh(
        geometry(`shield:${r}`, () => new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.18, 8)),
        sharedLambert(t.accent),
      );
      h.rotation.x = Math.PI / 2;
      h.position.set(r * 0.55, r * 0.95, r * 0.32);
      this.group.add(h);
    }
    let c = makeHealthBar(t.id.startsWith("boss-") ? 2.8 : 1.8);
    this.healthBar = c.group;
    this.healthFill = c.fill;
    this.group.add(makeShadowDisc(r * 0.75), o, l, this.healthBar);
    this.group.position.set(e.x, 0, e.z);
    this.group.name = this.id;
  }
  get archetype() {
    return ENEMY_TYPES[this.archetypeId] ?? ENEMY_TYPES["briar-wolf"];
  }
  get x() {
    return this.group.position.x;
  }
  get z() {
    return this.group.position.z;
  }
  get position2D() {
    return {
      x: this.x,
      z: this.z,
    };
  }
  get dead() {
    return this.aiState === "dead";
  }
  setPosition(e, t, n = 0) {
    this.group.position.set(e, n, t);
  }
  updateVisual(e, t) {
    this.hitFlash = Math.max(0, this.hitFlash - e);
    this.bodyMaterial.emissive.setHex(this.hitFlash > 0 ? 0xffffff : this.elite ? this.archetype.accent : 0);
    this.bodyMaterial.emissiveIntensity = this.hitFlash > 0 ? 0.75 : this.elite ? 0.16 : 0;
    // Face the camera in world space: undo the body's own turn first.
    this.healthBar.quaternion.copy(_q.copy(this.group.quaternion).invert().multiply(t.quaternion));
    let n = clamp(this.health / this.maxHealth, 0, 1);
    this.healthFill.scale.x = n;
    this.healthFill.position.x = -(1 - n) * (this.archetype.id.startsWith("boss-") ? 1.37 : 0.87);
    this.healthBar.visible = n < 0.999 || this.aggro || this.elite;
  }
}

export class Npc {
  group = new THREE.Group();
  id;
  name;
  role;
  faction;
  poiId;
  description;
  dialogue;
  shopSeed;
  idlePhase;
  marker;
  constructor(e) {
    this.id = e.id;
    this.name = e.name;
    this.role = e.role;
    this.faction = e.faction;
    this.poiId = e.poiId;
    this.description = e.description;
    this.dialogue = e.dialogue;
    this.shopSeed = e.shopSeed;
    this.idlePhase = ((e.shopSeed % 1000) / 1000) * Math.PI * 2;
    let t = new THREE.Mesh(
      geometry("npc:body", () => new THREE.CylinderGeometry(0.38, 0.5, 1.15, 7)),
      sharedLambert(e.color),
    );
    t.position.y = 0.65;
    let n = new THREE.Mesh(
      geometry("npc:head", () => new THREE.SphereGeometry(0.34, 7, 5)),
      sharedLambert(0xd3a77f),
    );
    n.position.y = 1.45;
    let i =
      e.role === "quest"
        ? 0xf2d168
        : e.role === "merchant" || e.role === "smith"
          ? 0x72d6c6
          : e.role === "healer" || e.role === "trainer"
            ? 0x91b7ff
            : 0xb8bdc0;
    let r = new THREE.Mesh(geometry("npc:marker", () => new THREE.OctahedronGeometry(0.18, 0)), sharedBasic(i));
    r.position.y = 2.15;
    r.name = "marker";
    this.marker = r;
    this.group.add(makeShadowDisc(0.5), t, n, r);
    this.group.position.set(e.x, 0, e.z);
    this.group.name = e.id;
  }
  get x() {
    return this.group.position.x;
  }
  get z() {
    return this.group.position.z;
  }
  get position2D() {
    return {
      x: this.x,
      z: this.z,
    };
  }
  update(e, t) {
    let n = this.marker;
    if (n) {
      n.rotation.y += e * 1.4;
      n.position.y = 2.1 + Math.sin(t * 2 + this.idlePhase) * 0.09;
    }
    this.group.rotation.y = Math.sin(t * 0.45 + this.idlePhase) * 0.18;
  }
}
