import { angleOf, distance2D, normalize2D } from "./util.js";

export class EnemyAI {
  constructor(e) {
    this.context = e;
  }
  context;
  time = 0;
  update(e) {
    this.time += e;
    let t = this.context.player;
    for (let n of this.context.enemies.values()) {
      if (n.dead) {
        continue;
      }
      n.attackCooldown = Math.max(0, n.attackCooldown - e);
      n.stagger = Math.max(0, n.stagger - e);
      n.rootTime = Math.max(0, n.rootTime - e);
      let i = n.statusEffects.find((c) => c.id === "root");
      if (i) {
        n.rootTime = Math.max(n.rootTime, Math.min(i.duration, 0.25));
      }
      if (n.stagger > 0) {
        continue;
      }
      let r = {
        x: t.x - n.x,
        z: t.z - n.z,
      };
      let a = Math.hypot(r.x, r.z);
      let o = n.archetype.id.startsWith("boss-") ? 24 : n.guardingPoiId ? 15 : 12;
      if (t.alive && t.stealthTime <= 0 && a <= o) {
        n.aggro = true;
      }
      if (t.stealthTime > 0 && a > 2.2) {
        n.aggro = false;
      }
      if (n.aggro && a > 30 && !n.archetype.id.startsWith("boss-")) {
        n.aggro = false;
      }
      if (n.phase === 1 && n.health / n.maxHealth < 0.52 && n.archetype.id.startsWith("boss-")) {
        n.phase = 2;
        this.context.onBossPhase?.(n);
      }
      if (n.aiState === "telegraph") {
        n.telegraphTime -= e;
        if (n.telegraphTime <= 0) {
          this.executeTelegraphedAttack(n);
        }
        continue;
      }
      if (n.aiState === "recover") {
        n.telegraphTime -= e;
        if (n.telegraphTime <= 0) {
          n.aiState = n.aggro ? "chase" : "idle";
        }
        continue;
      }
      if (!n.aggro || !t.alive) {
        this.patrol(n, e);
        continue;
      }
      n.aiState = "chase";
      let l = normalize2D(r.x, r.z);
      n.group.rotation.y = angleOf(l.x, l.z);
      switch (n.archetype.behavior) {
        case "ranged":
          this.rangedBehavior(n, l, a, e, 6.2, 9);
          break;
        case "flee":
          this.rangedBehavior(n, l, a, e, 7.2, 10.5);
          break;
        case "summoner":
          this.summonerBehavior(n, l, a, e);
          break;
        case "charger":
          this.chargerBehavior(n, l, a, e);
          break;
        case "area":
          this.areaBehavior(n, l, a, e);
          break;
        case "shield":
          this.meleeBehavior(n, l, a, e, 0.88);
          break;
        case "patrol":
          this.meleeBehavior(n, l, a, e, 1.05);
          break;
        default:
          this.meleeBehavior(n, l, a, e, 1);
          break;
      }
    }
  }
  meleeBehavior(e, t, n, i, r) {
    if (n > e.archetype.attackRange + 0.25) {
      this.move(e, t, e.speed * r * i);
      return;
    }
    if (e.attackCooldown <= 0) {
      this.beginTelegraph(e, "attack", e.archetype.telegraph, e.archetype.attackRange + 0.65);
    }
  }
  rangedBehavior(e, t, n, i, r, a) {
    if (n < r) {
      this.move(
        e,
        {
          x: -t.x,
          z: -t.z,
        },
        e.speed * i,
      );
    } else if (n > a) {
      this.move(e, t, e.speed * 0.72 * i);
    } else {
      let o = {
        x: t.z,
        z: -t.x,
      };
      let l = ((e.id.length + Math.floor(this.time * 0.7)) % 2) * 2 - 1;
      this.move(
        e,
        {
          x: o.x * l,
          z: o.z * l,
        },
        e.speed * 0.32 * i,
      );
    }
    if (n <= e.archetype.attackRange + 1 && e.attackCooldown <= 0) {
      this.beginTelegraph(e, "attack", e.archetype.telegraph, 1.25);
    }
  }
  summonerBehavior(e, t, n, i) {
    if (n < 5.5) {
      this.move(
        e,
        {
          x: -t.x,
          z: -t.z,
        },
        e.speed * i,
      );
    } else if (n > 9) {
      this.move(e, t, e.speed * 0.6 * i);
    }
    if (e.attackCooldown <= 0) {
      this.beginTelegraph(e, "summon", e.phase === 2 ? 0.65 : e.archetype.telegraph, 3.4);
    }
  }
  chargerBehavior(e, t, n, i) {
    if (n >= 3 && n <= e.archetype.attackRange + (e.phase === 2 ? 3 : 0) && e.attackCooldown <= 0) {
      e.target = {
        ...t,
      };
      this.beginTelegraph(e, "charge", e.archetype.telegraph, 1.6);
      return;
    }
    if (n > 1.9) {
      this.move(e, t, e.speed * i);
    } else if (e.attackCooldown <= 0) {
      this.beginTelegraph(e, "attack", 0.35, 2);
    }
  }
  areaBehavior(e, t, n, i) {
    let r = e.archetype.id.startsWith("boss-") ? 5.2 : 3.8;
    if (n > r) {
      this.move(e, t, e.speed * i);
    }
    if (n <= r + 1 && e.attackCooldown <= 0) {
      this.beginTelegraph(e, "area", e.phase === 2 ? 0.7 : e.archetype.telegraph, r + 0.5);
    }
  }
  beginTelegraph(e, t, n, i) {
    e.aiState = "telegraph";
    e.telegraphKind = t;
    e.telegraphTime = n;
    if (t === "attack" && ["ranged", "flee"].includes(e.archetype.behavior)) {
      this.context.combat.showTelegraph(this.context.player.position2D, 0.8, n, e.archetype.accent);
    } else {
      this.context.combat.showTelegraph(e.position2D, i, n, e.archetype.accent);
    }
  }
  executeTelegraphedAttack(e) {
    let t = this.context.player;
    let n = normalize2D(t.x - e.x, t.z - e.z);
    switch (e.telegraphKind) {
      case "attack":
        if (["ranged", "flee"].includes(e.archetype.behavior)) {
          this.context.combat.enemyProjectile(
            e,
            n,
            e.phase === 2 ? 1.18 : 1,
            e.phase === 2 ? 3 : 1,
            e.phase === 2 ? 0.38 : 0,
          );
        } else if (distance2D(e.position2D, t.position2D) <= e.archetype.attackRange + 0.9) {
          this.context.combat.damagePlayer(
            e.damage * (e.archetype.behavior === "shield" ? 1.15 : 1),
            e.id,
            t.position2D,
          );
        }
        break;
      case "charge":
        this.context.combat.enemyLineCharge(e, e.target);
        if (e.phase === 2) {
          this.context.combat.enemyArea(e, 2.5, 0.65, 0.05);
        }
        break;
      case "area":
        this.context.combat.enemyArea(
          e,
          e.archetype.id.startsWith("boss-") ? 5 : 3.8,
          e.phase === 2 ? 1.45 : 1.15,
          0.05,
          e.phase === 2
            ? {
                id: "burn",
                duration: 3,
                magnitude: e.damage * 0.08,
              }
            : undefined,
        );
        break;
      case "summon": {
        let i = e.archetype.id.startsWith("boss-") ? 6 : 3;
        if (e.summonedCount < i) {
          let r = e.phase === 2 ? 2 : 1;
          for (let a = 0; a < r; a += 1) {
            let o = (a / r) * Math.PI * 2 + this.time;
            let l = {
              x: e.x + Math.sin(o) * 2.4,
              z: e.z + Math.cos(o) * 2.4,
            };
            this.context.spawnSummon(e, e.archetype.id.startsWith("boss-") ? "boneguard" : "briar-wolf", l);
            e.summonedCount += 1;
          }
        } else {
          this.context.combat.enemyProjectile(e, n, 1.1, e.phase === 2 ? 5 : 3, e.phase === 2 ? 0.7 : 0.45);
        }
        break;
      }
    }
    e.attackCooldown = Math.max(0.65, e.archetype.attackCooldown * (e.phase === 2 ? 0.72 : 1));
    e.aiState = "recover";
    e.telegraphTime = e.phase === 2 ? 0.22 : 0.38;
    e.telegraphKind = null;
  }
  patrol(e, t) {
    e.aiState = "idle";
    if (distance2D(e.position2D, e.wanderTarget) < 0.7 || distance2D(e.home, e.wanderTarget) > 7) {
      let i = this.time * 0.22 + (e.id.length % 11);
      e.wanderTarget = {
        x: e.home.x + Math.sin(i * 1.7) * 4.5,
        z: e.home.z + Math.cos(i * 1.3) * 4.5,
      };
    }
    let n = normalize2D(e.wanderTarget.x - e.x, e.wanderTarget.z - e.z);
    if (e.rootTime <= 0) {
      this.move(e, n, e.speed * 0.24 * t);
    }
  }
  move(e, t, n) {
    if (e.rootTime > 0) {
      return;
    }
    let i = e.x + t.x * n;
    let r = e.z + t.z * n;
    if (this.context.canMoveEnemy(i, r)) {
      e.setPosition(i, r, this.context.getHeight(i, r));
      e.group.rotation.y = angleOf(t.x, t.z);
    }
  }
}
