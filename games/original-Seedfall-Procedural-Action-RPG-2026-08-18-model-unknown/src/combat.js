import * as THREE from "three/webgpu";
import { SKILLS } from "./data.js";
import { angleDelta, angleOf, clamp, directionFromAngle, distance2D, normalize2D } from "./util.js";
import { Enemy } from "./entities.js";
import { shared, sharedBasic } from "./world.js";

const geometries = new Map();
function geometry(key, make) {
  let g = geometries.get(key);
  if (!g) {
    g = shared(make());
    geometries.set(key, g);
  }
  return g;
}

/** Remove a mesh and free what only it used (shared geometry and materials stay). */
function disposeMesh(mesh) {
  mesh.removeFromParent();
  if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
  if (!mesh.material.userData.shared) mesh.material.dispose();
}

function computeDamage(s) {
  let e = Math.max(0, s.power * (s.multiplier ?? 1) + (s.flat ?? 0));
  let t = s.randomRoll < clamp(s.critChance, 0, 0.85);
  let n = e * (t ? Math.max(1, s.critDamage) : 1);
  let i = 100 / (100 + Math.max(-50, s.armor));
  let r = Math.max(1, n * i);
  return {
    raw: e,
    mitigated: n - r,
    final: r,
    critical: t,
  };
}

export class CombatSystem {
  constructor(e) {
    this.context = e;
  }
  context;
  sequence = 0;
  effects = [];
  update(e) {
    this.updateTimers(e);
    this.updateStatuses(e);
    this.updateProjectiles(e);
    this.updateAreas(e);
  }
  primaryAttack(e) {
    let t = this.context.player;
    if (t.attackCooldown > 0 || !t.alive) {
      return false;
    }
    let n = t.getStats();
    let i = t.equipment.weapon?.weaponStyle ?? t.archetype.startingWeapon;
    let r = normalize2D(e.x - t.x, e.z - t.z);
    t.facing = angleOf(r.x, r.z);
    let a = {
      blade: 0.58,
      bow: 0.62,
      dagger: 0.38,
      staff: 0.58,
      mace: 0.72,
    };
    t.attackCooldown = (a[i] ?? 0.58) / Math.max(0.45, n.attackSpeed);
    if (i === "bow") {
      this.spawnPlayerProjectile(r, n.power * 1.02, 16, 0.24, 0, 0xf1d18a);
      this.flashLine(t.position2D, r, 2.1, 0xe6d5a9);
    } else if (i === "staff") {
      this.spawnPlayerProjectile(r, n.power * 1.08 + (n.fireDamage ?? 0), 12.5, 0.34, 0, 0x7ec7ff, {
        id: "burn",
        duration: 3.5,
        magnitude: 0.12,
      });
      this.flashLine(t.position2D, r, 1.8, 0x78baff);
    } else {
      let o = i === "mace" ? 2.15 : i === "dagger" ? 1.75 : 2.35;
      let l = i === "dagger" ? 0.7 : i === "mace" ? 1.2 : 1.05;
      let c = i === "mace" ? 1.18 : i === "dagger" ? 0.82 : 1;
      this.meleeAttack(r, o, l, c, i === "mace" ? 0.18 : 0);
      this.spawnSlash(r, o, i === "dagger" ? 0xb787d9 : 0xf0e0b0);
    }
    return true;
  }
  secondaryAttack(e) {
    let t = this.context.player;
    if (t.secondaryCooldown > 0 || !t.alive) {
      return false;
    }
    let n = t.getStats();
    let i = t.equipment.weapon?.weaponStyle ?? t.archetype.startingWeapon;
    let r = normalize2D(e.x - t.x, e.z - t.z);
    t.facing = angleOf(r.x, r.z);
    if (t.resource < 8) {
      return false;
    } else {
      t.resource -= 8;
      t.secondaryCooldown = 1.2 / Math.max(0.5, n.attackSpeed);
      if (i === "bow" || i === "staff") {
        this.spawnPlayerProjectile(r, n.power * 1.65, i === "bow" ? 18 : 11, 0.4, 2, i === "bow" ? 0xffd36b : 0xc489ff);
        this.flashLine(t.position2D, r, 3, i === "bow" ? 0xffd36b : 0xc489ff);
      } else {
        t.blockTime = 0.55;
        this.meleeAttack(r, 2.65, 0.82, 1.55, 0.35);
        this.spawnSlash(r, 2.7, 0xffbe68);
      }
      return true;
    }
  }
  useSkill(e, t) {
    let n = this.context.player;
    let i = SKILLS.find((l) => l.id === e);
    if (
      !i ||
      !i.active ||
      !n.learnedSkills.some((l) => l.id === i.id) ||
      !n.alive ||
      (n.skillCooldowns.get(i.id) ?? 0) > 0 ||
      n.resource < i.cost
    ) {
      return false;
    }
    let a = n.getStats();
    n.resource -= i.cost;
    n.skillCooldowns.set(i.id, i.cooldown / Math.max(0.35, a.cooldownRate));
    let o = normalize2D(t.x - n.x, t.z - n.z);
    n.facing = angleOf(o.x, o.z);
    this.executeSkill(i, o, t);
    this.context.events.emit("playerChanged", undefined);
    return true;
  }
  usePotion() {
    let e = this.context.player;
    if (e.potions <= 0 || e.health >= e.getStats().maxHealth || !e.alive) {
      return false;
    }
    e.potions -= 1;
    let t = e.getStats().maxHealth * 0.45;
    this.healPlayer(t, "Draught");
    return true;
  }
  damageEnemy(e, t = 1, n = 0, i = 0, r) {
    if (e.dead) {
      return;
    }
    let a = this.context.player;
    let o = a.getStats();
    let l = (e.modifiers.includes("Armored") ? 32 : 8) + e.level * 2.2;
    let c = a.poisonWeaponTime > 0 ? (o.poisonDamage ?? 0) + 2 + a.progress.level * 0.35 : 0;
    let h = computeDamage({
      power: o.power,
      multiplier: t,
      flat: n + (o.fireDamage ?? 0) + (o.frostDamage ?? 0) + c,
      armor: l,
      critChance: r ?? o.critChance,
      critDamage: o.critDamage,
      randomRoll: Math.random(),
    });
    e.health = Math.max(0, e.health - h.final);
    e.aggro = true;
    e.hitFlash = 0.12;
    e.stagger = Math.max(e.stagger, i);
    if (a.poisonWeaponTime > 0) {
      this.addStatus(e.statusEffects, "poison", 4.5, Math.max(1, o.power * 0.08), a.id);
    }
    this.context.events.emit("combat", {
      sourceId: a.id,
      targetId: e.id,
      amount: h.final,
      kind: h.critical ? "critical" : "damage",
      position: e.position2D,
      label: h.critical ? "CRIT" : undefined,
    });
    if (e.health <= 0) {
      this.killEnemy(e);
    }
    return h;
  }
  damagePlayer(e, t, n, i, fromStatus = false) {
    let r = this.context.player;
    if (!r.alive || r.invulnerable > 0 || r.stealthTime > 0) {
      return 0;
    }
    // Elite modifiers (they were rolled but never did anything): a direct hit
    // from a Chilling elite slows, a Venomous one poisons, a Vampiric one heals itself.
    const source = fromStatus ? null : this.context.enemies.get(t);
    if (source && !i) {
      if (source.modifiers.includes("Chilling")) i = { id: "chill", duration: 2.2, magnitude: 0.25 };
      else if (source.modifiers.includes("Venomous")) i = { id: "poison", duration: 4, magnitude: Math.max(1, source.damage * 0.12) };
    }
    let a = r.getStats();
    let o = 100 / (100 + Math.max(0, a.armor));
    let l = r.blockTime > 0 ? 0.38 : 1;
    let c = Math.max(1, e * o * l);
    r.health = Math.max(0, r.health - c);
    r.hitFlash = 0.18;
    r.invulnerable = 0.16;
    if (i) {
      this.addStatus(r.statusEffects, i.id, i.duration, i.magnitude, t);
    }
    this.context.events.emit("combat", {
      sourceId: t,
      targetId: r.id,
      amount: c,
      kind: "damage",
      position: n,
      label: r.blockTime > 0 ? "BLOCK" : undefined,
    });
    if (source && !source.dead && source.modifiers.includes("Vampiric")) {
      source.health = Math.min(source.maxHealth, source.health + c * 0.35);
    }
    if (r.health <= 0) {
      r.alive = false;
      this.context.onPlayerDeath();
    }
    return c;
  }
  enemyProjectile(e, t, n = 1, i = 1, r = 0) {
    let a = angleOf(t.x, t.z);
    for (let o = 0; o < i; o += 1) {
      let l = i === 1 ? 0 : (o / (i - 1) - 0.5) * r;
      let c = directionFromAngle(a + l);
      let h = new THREE.Mesh(
        geometry("bolt:0.22", () => new THREE.IcosahedronGeometry(0.22, 0)),
        sharedBasic(e.archetype.accent),
      );
      h.position.set(e.x, this.context.getHeight(e.x, e.z) + 0.9, e.z);
      this.context.effectsRoot.add(h);
      this.context.projectiles.push({
        id: `projectile:${this.sequence++}`,
        owner: "enemy",
        sourceId: e.id,
        mesh: h,
        velocity: c,
        speed: e.archetype.behavior === "flee" ? 11 : 8.5,
        damage: e.damage * n,
        life: 3.2,
        radius: 0.35,
        pierce: 0,
        hitIds: new Set(),
        status:
          e.archetype.behavior === "flee"
            ? {
                id: "chill",
                duration: 2.5,
                magnitude: 0.2,
              }
            : undefined,
      });
    }
  }
  enemyArea(e, t, n, i = 0.35, r) {
    this.createArea({
      owner: "enemy",
      sourceId: e.id,
      x: e.x,
      z: e.z,
      radius: t,
      damage: e.damage * n,
      delay: i,
      duration: 0.18,
      kind: "damage",
      color: 0xd5524d,
      status: r,
    });
  }
  enemyLineCharge(e, t) {
    let n = e.position2D;
    let i = n;
    let r = 6.5;
    let a = 14;
    for (let o = 1; o <= a; o += 1) {
      let l = {
        x: n.x + t.x * r * (o / a),
        z: n.z + t.z * r * (o / a),
      };
      if (!this.context.canMoveEnemy(l.x, l.z)) {
        break;
      }
      i = l;
    }
    e.setPosition(i.x, i.z, this.context.getHeight(i.x, i.z));
    if (distance2D(i, this.context.player.position2D) < 2.2) {
      this.damagePlayer(e.damage * 1.7, e.id, i);
    }
    this.flashLine(n, t, distance2D(n, i), e.archetype.accent);
  }
  showTelegraph(e, t, n, i = 0xe4685e) {
    this.createArea({
      owner: "enemy",
      sourceId: "telegraph",
      x: e.x,
      z: e.z,
      radius: t,
      damage: 0,
      delay: n,
      duration: 0.01,
      kind: "telegraph",
      color: i,
    });
  }
  executeSkill(e, t, n) {
    let i = this.context.player;
    let r = i.getStats();
    switch (e.effect) {
      case "shieldBash": {
        this.movePlayerAlong(t, 3.2, 8);
        this.meleeAttack(t, 2.4, 1.2, 1.4, 1.1);
        i.invulnerable = 0.3;
        this.spawnSlash(t, 2.5, 0xf0b04f);
        break;
      }
      case "whirlwind":
        this.areaDamage(i.position2D, 3.2, 1.7, 0.35);
        this.spawnRing(i.position2D, 3.2, 0xe7c875, 0.4);
        break;
      case "warCry":
        i.attackBuffTime = 8;
        for (let a of this.context.enemies.values()) {
          if (!a.dead && distance2D(a.position2D, i.position2D) < 5.5) {
            a.stagger = Math.max(a.stagger, 1.2);
          }
        }
        this.spawnRing(i.position2D, 5.5, 0xffb454, 0.7);
        break;
      case "piercingShot":
        this.spawnPlayerProjectile(t, r.power * 1.75, 19, 0.3, 5, 0xf4de7c);
        break;
      case "snareTrap":
        this.createArea({
          owner: "player",
          sourceId: i.id,
          x: i.x + t.x * 2,
          z: i.z + t.z * 2,
          radius: 2.2,
          damage: r.power * 0.85,
          delay: 0,
          duration: 16,
          tickInterval: 0.1,
          kind: "trap",
          color: 0x80c96f,
          status: {
            id: "root",
            duration: 2.8,
            magnitude: 1,
          },
        });
        break;
      case "multishot": {
        let a = angleOf(t.x, t.z);
        for (let o = 0; o < 5; o += 1) {
          this.spawnPlayerProjectile(directionFromAngle(a + (o - 2) * 0.16), r.power * 0.9, 16.5, 0.24, 0, 0xd4ed91);
        }
        break;
      }
      case "shadowstep": {
        let a = this.movePlayerAlong(t, 4.8, 12);
        i.invulnerable = 0.65;
        i.attackBuffTime = Math.max(i.attackBuffTime, 3);
        this.spawnRing(a, 1.8, 0xae68cf, 0.3);
        break;
      }
      case "poisonBlade":
        i.poisonWeaponTime = 7;
        this.spawnRing(i.position2D, 1.8, 0x75c864, 0.4);
        break;
      case "smokeBomb":
        i.stealthTime = 3.2;
        i.invulnerable = 0.4;
        this.createArea({
          owner: "player",
          sourceId: i.id,
          x: i.x,
          z: i.z,
          radius: 3.6,
          damage: 0,
          delay: 0,
          duration: 3.2,
          kind: "smoke",
          color: 0x675b72,
        });
        for (let a of this.context.enemies.values()) {
          if (distance2D(a.position2D, i.position2D) < 4) {
            a.aggro = false;
          }
        }
        break;
      case "firebolt":
        this.spawnPlayerProjectile(t, r.power * 1.45 + 8 + (r.fireDamage ?? 0), 13.5, 0.4, 0, 0xff794b, {
          id: "burn",
          duration: 4,
          magnitude: r.power * 0.09,
        });
        break;
      case "frostNova":
        this.areaDamage(i.position2D, 4.2, 1.05, 0.2, {
          id: "root",
          duration: 2.2,
          magnitude: 1,
        });
        this.spawnRing(i.position2D, 4.2, 0x81d8f0, 0.65);
        break;
      case "meteor":
        this.createArea({
          owner: "player",
          sourceId: i.id,
          x: n.x,
          z: n.z,
          radius: 4,
          damage: r.power * 3.1 + 18,
          delay: 1.25,
          duration: 0.25,
          kind: "meteor",
          color: 0xff6c3f,
          status: {
            id: "burn",
            duration: 5,
            magnitude: r.power * 0.12,
          },
        });
        break;
      case "heal":
        this.healPlayer(r.maxHealth * (0.28 + (r.healingPower ?? 0)), e.name);
        break;
      case "sanctuary":
        this.createArea({
          owner: "player",
          sourceId: i.id,
          x: i.x,
          z: i.z,
          radius: 3.8,
          damage: r.power * 0.4,
          delay: 0,
          duration: 7,
          tickInterval: 1,
          kind: "heal",
          color: 0xe7d982,
        });
        break;
      case "spiritOrb":
        this.spawnPlayerProjectile(t, r.power * 1.6, 10, 0.48, 3, 0xf0ecb0, undefined, true);
        break;
      default:
        break;
    }
  }
  movePlayerAlong(e, t, n) {
    let i = this.context.player;
    let r = i.position2D;
    let a = r;
    for (let o = 1; o <= n; o += 1) {
      let l = {
        x: r.x + e.x * t * (o / n),
        z: r.z + e.z * t * (o / n),
      };
      if (!this.context.canMovePlayer(l.x, l.z)) {
        break;
      }
      a = l;
    }
    i.setPosition(a.x, a.z, this.context.getHeight(a.x, a.z));
    return a;
  }
  meleeAttack(e, t, n, i, r) {
    let a = this.context.player;
    let o = angleOf(e.x, e.z);
    for (let l of this.context.enemies.values()) {
      if (l.dead || distance2D(a.position2D, l.position2D) > t + (l.archetype.id.startsWith("boss-") ? 0.7 : 0)) {
        continue;
      }
      let c = angleOf(l.x - a.x, l.z - a.z);
      if (Math.abs(angleDelta(o, c)) <= n / 2) {
        this.damageEnemy(l, i, 0, r);
      }
    }
  }
  areaDamage(e, t, n, i = 0, r) {
    for (let a of this.context.enemies.values()) {
      if (!a.dead && !(distance2D(e, a.position2D) > t)) {
        this.damageEnemy(a, n, 0, i);
        if (r) {
          this.addStatus(a.statusEffects, r.id, r.duration, r.magnitude, this.context.player.id);
        }
      }
    }
  }
  spawnPlayerProjectile(e, t, n, i, r, a, o, l = false) {
    let c = this.context.player;
    let h = new THREE.Mesh(
      geometry(`bolt:${i}`, () => new THREE.IcosahedronGeometry(i, 0)),
      sharedBasic(a),
    );
    h.position.set(c.x + e.x * 0.8, this.context.getHeight(c.x, c.z) + 0.9, c.z + e.z * 0.8);
    this.context.effectsRoot.add(h);
    this.context.projectiles.push({
      id: `projectile:${this.sequence++}`,
      owner: "player",
      sourceId: c.id,
      mesh: h,
      velocity: e,
      speed: n,
      damage: t,
      life: l ? 2.2 : 3.5,
      radius: i,
      pierce: r,
      hitIds: new Set(),
      status: o,
      returning: l,
      returnTime: l ? 0.8 : undefined,
    });
  }
  updateProjectiles(e) {
    let t = this.context.projectiles;
    for (let n = t.length - 1; n >= 0; n -= 1) {
      let i = t[n];
      i.life -= e;
      if (i.returning && i.returnTime !== undefined && ((i.returnTime -= e), i.returnTime <= 0)) {
        let l = normalize2D(this.context.player.x - i.mesh.position.x, this.context.player.z - i.mesh.position.z);
        i.velocity = l;
        i.speed = 12;
        if (
          distance2D(
            {
              x: i.mesh.position.x,
              z: i.mesh.position.z,
            },
            this.context.player.position2D,
          ) < 0.8
        ) {
          this.healPlayer(this.context.player.getStats().maxHealth * 0.15, "Spirit Orb");
          i.life = 0;
        }
      }
      let r = i.mesh.position.x + i.velocity.x * i.speed * e;
      let a = i.mesh.position.z + i.velocity.z * i.speed * e;
      if (!(i.owner === "player" ? this.context.canMoveEnemy(r, a) : this.context.canMovePlayer(r, a))) {
        this.removeProjectile(n);
        continue;
      }
      i.mesh.position.x = r;
      i.mesh.position.z = a;
      i.mesh.rotation.x += e * 6;
      i.mesh.rotation.y += e * 8;
      if (i.owner === "player") {
        for (let l of this.context.enemies.values()) {
          if (l.dead || i.hitIds.has(l.id)) {
            continue;
          }
          let c = i.radius + (l.archetype.id.startsWith("boss-") ? 1.1 : 0.65);
          if (
            distance2D(
              {
                x: i.mesh.position.x,
                z: i.mesh.position.z,
              },
              l.position2D,
            ) <= c
          ) {
            i.hitIds.add(l.id);
            let h = Math.max(1, this.context.player.getStats().power);
            let u = i.damage / h;
            this.damageEnemy(l, u, 0, 0.12);
            if (i.status) {
              this.addStatus(l.statusEffects, i.status.id, i.status.duration, i.status.magnitude, i.sourceId);
            }
            if (i.pierce > 0) {
              i.pierce -= 1;
            } else {
              i.life = 0;
            }
            break;
          }
        }
      } else {
        let l = this.context.player;
        if (
          !i.hitIds.has(l.id) &&
          distance2D(
            {
              x: i.mesh.position.x,
              z: i.mesh.position.z,
            },
            l.position2D,
          ) <=
            i.radius + 0.65
        ) {
          i.hitIds.add(l.id);
          this.damagePlayer(i.damage, i.sourceId, l.position2D, i.status);
          i.life = 0;
        }
      }
      if (i.life <= 0) {
        this.removeProjectile(n);
      }
    }
  }
  updateAreas(e) {
    let t = this.context.areas;
    for (let n = t.length - 1; n >= 0; n -= 1) {
      let i = t[n];
      i.delay -= e;
      i.mesh.rotation.z += e * 0.28;
      let r = i.mesh.material;
      if (i.delay > 0) {
        let a = 0.72 + Math.sin(performance.now() * 0.012) * 0.16;
        i.mesh.scale.setScalar(a);
        r.opacity = 0.28 + (1 - clamp(i.delay, 0, 1)) * 0.28;
        continue;
      }
      i.mesh.scale.setScalar(1);
      i.duration -= e;
      i.tickTimer -= e;
      if (i.kind === "telegraph") {
        i.duration = 0;
      } else if (i.kind === "trap") {
        let a = null;
        for (const o of this.context.enemies.values()) {
          if (!o.dead && distance2D(o.position2D, i) <= i.radius) {
            a = o;
            break;
          }
        }
        if (a) {
          this.damageEnemy(a, Math.max(0.2, i.damage / Math.max(1, this.context.player.getStats().power)), 0, 0.4);
          if (i.status) {
            this.addStatus(a.statusEffects, i.status.id, i.status.duration, i.status.magnitude, i.sourceId);
          }
          i.duration = 0;
        }
      } else if (!i.triggered || i.tickTimer <= 0) {
        i.triggered = true;
        i.tickTimer = i.tickInterval;
        if (i.owner === "player") {
          for (let a of this.context.enemies.values()) {
            if (a.dead || distance2D(a.position2D, i) > i.radius) {
              continue;
            }
            let o = i.damage / Math.max(1, this.context.player.getStats().power);
            this.damageEnemy(a, o, 0, i.kind === "meteor" ? 0.8 : 0.15);
            if (i.status) {
              this.addStatus(a.statusEffects, i.status.id, i.status.duration, i.status.magnitude, i.sourceId);
            }
          }
          if (i.kind === "heal") {
            this.healPlayer(this.context.player.getStats().maxHealth * 0.06, "Sanctuary", false);
          }
        } else if (distance2D(this.context.player.position2D, i) <= i.radius) {
          this.damagePlayer(i.damage, i.sourceId, this.context.player.position2D, i.status);
        }
      }
      if (i.duration <= 0) {
        this.removeArea(n);
      }
    }
  }
  updateTimers(e) {
    let t = this.context.player;
    t.attackCooldown = Math.max(0, t.attackCooldown - e);
    t.secondaryCooldown = Math.max(0, t.secondaryCooldown - e);
    t.dodgeCooldown = Math.max(0, t.dodgeCooldown - e);
    t.dodgeTime = Math.max(0, t.dodgeTime - e);
    t.invulnerable = Math.max(0, t.invulnerable - e);
    t.blockTime = Math.max(0, t.blockTime - e);
    t.attackBuffTime = Math.max(0, t.attackBuffTime - e);
    t.poisonWeaponTime = Math.max(0, t.poisonWeaponTime - e);
    t.stealthTime = Math.max(0, t.stealthTime - e);
    for (let [i, r] of t.skillCooldowns) {
      let a = r - e;
      if (a <= 0) {
        t.skillCooldowns.delete(i);
      } else {
        t.skillCooldowns.set(i, a);
      }
    }
    let n = t.getStats();
    t.health = Math.min(n.maxHealth, t.health + n.healthRegen * e);
    t.resource = Math.min(n.maxResource, t.resource + n.resourceRegen * e);
  }
  updateStatuses(e) {
    let t = (n, i) => {
      for (let r = n.length - 1; r >= 0; r -= 1) {
        let a = n[r];
        a.duration -= e;
        a.tick -= e;
        if (a.tick <= 0) {
          a.tick = 1;
          if (a.id === "poison" || a.id === "burn") {
            if (i instanceof Enemy) {
              i.health = Math.max(0, i.health - a.magnitude);
              this.context.events.emit("combat", {
                sourceId: a.sourceId ?? "status",
                targetId: i.id,
                amount: a.magnitude,
                kind: "status",
                position: i.position2D,
                label: a.id.toUpperCase(),
              });
              if (i.health <= 0) {
                this.killEnemy(i);
              }
            } else {
              this.damagePlayer(a.magnitude, a.sourceId ?? "status", i.position2D, undefined, true);
            }
          }
        }
        if (a.duration <= 0) {
          n.splice(r, 1);
        }
      }
    };
    t(this.context.player.statusEffects, this.context.player);
    for (let n of this.context.enemies.values()) {
      t(n.statusEffects, n);
    }
  }
  addStatus(e, t, n, i, r) {
    let a = e.find((o) => o.id === t);
    if (a) {
      a.duration = Math.max(a.duration, n);
      a.magnitude = Math.max(a.magnitude, i);
      a.sourceId = r;
    } else {
      e.push({
        id: t,
        duration: n,
        magnitude: i,
        tick: 1,
        sourceId: r,
      });
    }
  }
  killEnemy(e) {
    if (!e.dead) {
      e.aiState = "dead";
      e.health = 0;
      if (e.modifiers.includes("Volatile")) {
        // Volatile elites burst a moment after they fall.
        this.createArea({
          owner: "enemy",
          sourceId: `${e.id}:burst`,
          x: e.x,
          z: e.z,
          radius: 2.8,
          damage: e.damage * 1.2,
          delay: 0.75,
          duration: 0.18,
          kind: "damage",
          color: 0xff8a3c,
        });
      }
      this.context.events.emit("combat", {
        sourceId: this.context.player.id,
        targetId: e.id,
        kind: "kill",
        position: e.position2D,
        label: "DEFEATED",
      });
      this.context.onEnemyKilled(e);
    }
  }
  healPlayer(e, t, n = true) {
    let i = this.context.player;
    let r = i.health;
    i.health = Math.min(i.getStats().maxHealth, i.health + e);
    let a = i.health - r;
    if (!(a <= 0)) {
      this.context.events.emit("combat", {
        sourceId: i.id,
        targetId: i.id,
        amount: a,
        kind: "heal",
        position: i.position2D,
        label: t,
      });
      if (n) {
        this.context.events.emit("toast", {
          title: t,
          detail: `Restored ${Math.round(a)} health`,
          tone: "good",
        });
      }
    }
  }
  createArea(e) {
    let t = new THREE.MeshBasicMaterial({
      color: e.color,
      transparent: true,
      opacity: e.kind === "smoke" ? 0.24 : 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const inner = Math.max(0.05, e.radius * 0.72);
    let n = new THREE.Mesh(
      geometry(`area:${e.radius}`, () => new THREE.RingGeometry(inner, e.radius, 32)),
      t,
    );
    n.rotation.x = -Math.PI / 2;
    n.position.set(e.x, this.context.getHeight(e.x, e.z) + 0.12, e.z);
    this.context.effectsRoot.add(n);
    let i = {
      id: `area:${this.sequence++}`,
      owner: e.owner,
      sourceId: e.sourceId,
      mesh: n,
      x: e.x,
      z: e.z,
      radius: e.radius,
      damage: e.damage,
      delay: e.delay,
      duration: e.duration,
      tickInterval: e.tickInterval ?? 99,
      tickTimer: 0,
      triggered: false,
      kind: e.kind,
      status: e.status,
    };
    this.context.areas.push(i);
    return i;
  }
  spawnSlash(e, t, n) {
    let i = this.context.player;
    let o = new THREE.Mesh(
      geometry(`slash:${t}`, () => new THREE.RingGeometry(t * 0.65, t, 24, 1, -0.75, 1.5)),
      new THREE.MeshBasicMaterial({
        color: n,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    o.rotation.x = -Math.PI / 2;
    o.rotation.z = -angleOf(e.x, e.z);
    o.position.set(i.x, this.context.getHeight(i.x, i.z) + 0.14, i.z);
    this.context.effectsRoot.add(o);
    this.fadeEffect(o, 0.18, 1.2);
  }
  spawnRing(e, t, n, i) {
    let r = new THREE.Mesh(
      geometry(`ring:${t}`, () => new THREE.RingGeometry(t * 0.84, t, 32)),
      new THREE.MeshBasicMaterial({
        color: n,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(e.x, this.context.getHeight(e.x, e.z) + 0.15, e.z);
    this.context.effectsRoot.add(r);
    this.fadeEffect(r, i, 1.3);
  }
  flashLine(e, t, n, i) {
    if (n <= 0.01) return;
    let r = new THREE.Mesh(
      geometry("line", () => new THREE.BoxGeometry(0.1, 0.04, 1)),
      new THREE.MeshBasicMaterial({
        color: i,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    r.scale.z = n;
    r.position.set(e.x + (t.x * n) / 2, this.context.getHeight(e.x, e.z) + 0.55, e.z + (t.z * n) / 2);
    r.rotation.y = Math.atan2(t.x, t.z);
    this.context.effectsRoot.add(r);
    this.fadeEffect(r, 0.12, 1);
  }
  /** Grow and fade a mesh over `life` seconds (driven by updateEffects, so it pauses with the game). */
  fadeEffect(mesh, life, grow) {
    this.effects.push({ mesh, life, grow, age: 0, base: mesh.scale.clone() });
  }
  updateEffects(dt) {
    for (let k = this.effects.length - 1; k >= 0; k -= 1) {
      const fx = this.effects[k];
      if (!fx.mesh.parent) {
        this.effects.splice(k, 1);
        continue;
      }
      fx.age += dt;
      const a = fx.age / fx.life;
      if (a >= 1) {
        disposeMesh(fx.mesh);
        this.effects.splice(k, 1);
        continue;
      }
      fx.mesh.scale.copy(fx.base).multiplyScalar(1 + a * (fx.grow - 1));
      fx.mesh.material.opacity = 1 - a;
    }
  }
  clearEffects() {
    for (const fx of this.effects) if (fx.mesh.parent) disposeMesh(fx.mesh);
    this.effects.length = 0;
  }
  removeProjectile(e) {
    let t = this.context.projectiles[e];
    disposeMesh(t.mesh);
    this.context.projectiles.splice(e, 1);
  }
  removeArea(e) {
    let t = this.context.areas[e];
    disposeMesh(t.mesh);
    this.context.areas.splice(e, 1);
  }
}
