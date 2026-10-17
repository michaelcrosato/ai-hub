import { LOWLIGHT, createMap } from "./level.js";
import { WEAPONS, HACKS, UPGRADES, OBJECTIVES, ENDINGS } from "./data.js";
import { EventBus } from "./persistence.js";
import { makeRig } from "./assets.js";
import { DistrictMap, DistrictNavigation } from "./spatial.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1;
  return [x / d, y / d];
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class World {
  constructor(
    game,
    {
      level = LOWLIGHT,
      demo = false,
      saved = null,
      difficulty = "Runner",
      seed = 2089,
    } = {},
  ) {
    this.E = globalThis.My3D2dge;
    this.game = game;
    this.level = level;
    this.demo = demo;
    this.difficulty = difficulty;
    this.bus = new EventBus();
    this.map = createMap(this.E, level, DistrictMap);
    this.rng = this.E.rng(seed);
    for (const [id, x, y] of level.props)
      if (!["streetlamp", "bench"].includes(id))
        this.map.solid(id === "barrel" ? "barrel" : "cg:" + id, x, y, 0, {
          facing: id === "car" ? Math.PI / 2 : 0,
        });
    this.stage = 0;
    this.elapsed = 0;
    this.flags = {};
    this.ending = null;
    this.finished = false;
    this.failed = false;
    this.dialogue = null;
    this.channel = null;
    this.alert = 0;
    this.combatQuiet = 99;
    this.message = null;
    this.stats = {
      kills: 0,
      nonlethal: 0,
      shots: 0,
      hits: 0,
      hacks: 0,
      detections: 0,
      damage: 0,
      loot: 0,
      dashes: 0,
    };
    const [x, y] = level.spawn;
    this.player = Object.assign(new this.E.Body({ x, y, r: 5.5 }), {
      id: "runner",
      facing: -Math.PI / 2,
      hp: 100,
      maxHp: 100,
      ram: 6,
      maxRam: 6,
      credits: 65,
      meds: 3,
      weapon: "needle",
      ammo: { needle: 12, scatter: 6 },
      reserve: 108,
      upgrades: [],
      crouched: false,
      cloak: 0,
      invuln: 0,
      hurt: 0,
      dashTime: 0,
      dashCooldown: 0,
      fireCooldown: 0,
      reloadTime: 0,
      healCooldown: 0,
      rig: makeRig(this.E, "player"),
      dashVector: [0, 0],
    });
    this.enemies = level.enemies.map((e) =>
      Object.assign(
        new this.E.Body({ x: e.x, y: e.y, r: e.kind === "boss" ? 10 : 6 }),
        {
          ...e,
          hp: e.kind === "boss" ? 300 : 68,
          maxHp: e.kind === "boss" ? 300 : 68,
          rig: makeRig(this.E, e.kind),
          mind: new this.E.Suspicion({ rise: 0.95, decay: 0.35, forget: 5 }),
          path: new DistrictNavigation(this.map),
          waypoint: 0,
          fireCooldown: 1.3,
          stunned: 0,
          blind: 0,
          hurt: 0,
          windup: 0,
          dead: false,
          down: 0,
          armor: e.kind === "boss",
          attackPoint: null,
          asleep: !!e.asleep,
          seen: false,
        },
      ),
    );
    this.npcs = level.interactables
      .filter((i) => i.kind === "npc")
      .map((i) => ({ ...i, rig: makeRig(this.E, i.id) }));
    this.civilians = level.civilians.map(([x, y], i) =>
      Object.assign(new this.E.Body({ x, y, r: 4 }), {
        home: [x, y],
        rig: makeRig(this.E, "civilian", i),
        phase: i * 1.4,
        facing: 0,
      }),
    );
    this.interactables = level.interactables.map((i) => ({ ...i }));
    this.shots = new this.E.Bullets(game, { max: 96 });
    this.drops = [];
    this.effects = [];
    this.target = null;
    if (saved) this.restore(saved);
    this.game.particles.ground = () => 0;
  }
  emit(type, detail = {}) {
    this.bus.emit(type, detail);
  }
  toast(title, text = "") {
    this.message = { title, text, time: 4 };
    this.emit("toast", { title, text });
  }
  sound(name, vol = 0.5) {
    this.game.audio.sfx(name, { vol });
  }
  objective() {
    return this.level.objectives[this.stage];
  }
  objectivePoint() {
    return this.interactables.find((i) => i.id === this.objective().target);
  }
  zone() {
    const p = this.player;
    return (
      this.level.zones.find(
        (z) =>
          p.x >= z.bounds[0] &&
          p.y >= z.bounds[1] &&
          p.x < z.bounds[2] &&
          p.y < z.bounds[3],
      )?.name || this.level.name
    );
  }
  gate(open, service = false) {
    const gate = this.level.gates[service ? "service" : "main"];
    if (!gate) return;
    for (let n = 0; n < gate.length; n++)
      this.map.set(
        gate.x + (gate.axis === "x" ? n : 0),
        gate.y + (gate.axis === "y" ? n : 0),
        open ? 0 : 4,
      );
  }
  checkpoint(label) {
    this.emit("checkpoint", { label, data: this.serialize() });
  }
  completeStage(stage) {
    this.stage = stage;
    this.sound("secret", 0.3);
    this.emit("objective", { stage });
    this.checkpoint(this.objective().title);
  }
  nearest() {
    const take = this.takedownTarget();
    if (take)
      return {
        id: "takedown:" + take.id,
        kind: "takedown",
        x: take.x,
        y: take.y,
        name: "Neural takedown",
        role: take.stunned > 0 ? "Stunned · nonlethal" : "Unaware · nonlethal",
      };
    return (
      this.interactables
        .filter(
          (i) =>
            dist(i, this.player) < 35 &&
            this.map.sight(this.player, i) &&
            !(i.id === "cache" && this.flags.cache) &&
            !(i.id === "captive" && this.flags.captive) &&
            !(i.id === "relay" && this.flags.relay),
        )
        .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0] || null
    );
  }
  takedownTarget() {
    const p = this.player;
    return (
      this.enemies.find(
        (e) =>
          e.kind !== "boss" &&
          !e.dead &&
          dist(e, p) < 22 &&
          this.map.sight(p, e) &&
          (e.stunned > 0 ||
            (p.crouched &&
              e.mind.state !== "alert" &&
              Math.abs(
                this.E.angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.facing),
              ) > 1.5)),
      ) || null
    );
  }
  selectTarget(aim = null) {
    const p = this.player;
    return (
      this.enemies
        .filter(
          (e) =>
            !e.dead && !e.asleep && dist(p, e) < 220 && this.map.sight(p, e),
        )
        .map((e) => ({
          e,
          score:
            dist(p, e) +
            (aim
              ? Math.abs(
                  this.E.angDiff(Math.atan2(e.y - p.y, e.x - p.x), aim),
                ) * 75
              : 0),
        }))
        .sort((a, b) => a.score - b.score)[0]?.e || null
    );
  }
  update(dt, a = {}) {
    if (this.failed || this.finished) return;
    this.elapsed += dt;
    if (this.message) {
      this.message.time -= dt;
      if (this.message.time <= 0) this.message = null;
    }
    if (this.dialogue) return;
    const p = this.player;
    for (const key of [
      "invuln",
      "hurt",
      "dashCooldown",
      "fireCooldown",
      "healCooldown",
      "cloak",
    ])
      p[key] = Math.max(0, p[key] - dt);
    this.combatQuiet += dt;
    p.ram = Math.min(
      p.maxRam,
      p.ram + dt * (p.upgrades.includes("ram") ? 0.52 : 0.4),
    );
    if (p.reloadTime > 0) {
      p.reloadTime -= dt;
      if (p.reloadTime <= 0) {
        p.reloadTime = 0;
        const w = WEAPONS[p.weapon],
          amount = Math.min(w.magazine - p.ammo[p.weapon], p.reserve);
        p.ammo[p.weapon] += amount;
        p.reserve -= amount;
        this.sound("blip", 0.3);
        this.emit("reloaded");
      }
    }
    if (a.crouch) {
      p.crouched = !p.crouched;
      this.emit("crouch", { enabled: p.crouched });
    }
    if (a.weapon && !p.reloadTime) {
      p.weapon = p.weapon === "needle" ? "scatter" : "needle";
      this.sound("select", 0.3);
      this.emit("weapon", { weapon: p.weapon });
    }
    if (a.reload) this.reload();
    if (a.heal) this.heal();
    if (a.hack) this.hack(a.hack === true ? "overload" : a.hack);
    let [mx, my] = a.move || [0, 0];
    if (a.dash && p.dashCooldown <= 0) {
      if (!mx && !my) [mx, my] = [Math.cos(p.facing), Math.sin(p.facing)];
      p.dashVector = unit(mx, my);
      p.dashTime = 0.19;
      p.dashCooldown = p.upgrades.includes("reflex") ? 0.75 : 1.5;
      p.invuln = 0.24;
      p.crouched = false;
      this.stats.dashes++;
      this.sound("whoosh");
      this.emit("dash");
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.vx = p.dashVector[0] * 230;
      p.vy = p.dashVector[1] * 230;
    } else {
      const speed = p.crouched ? 47 : a.aimHeld ? 60 : 88;
      p.vx = mx * speed;
      p.vy = my * speed;
    }
    if (mx || my) p.facing = Math.atan2(my, mx);
    if (a.aim != null) p.facing = a.aim;
    p.eye = p.crouched ? 12 : 30;
    p.chest = p.crouched ? 10 : 22;
    p.update(dt, this.map);
    p.x = clamp(p.x, 22, this.level.width * 16 - 22);
    p.y = clamp(p.y, 22, this.level.height * 16 - 22);
    this.target = this.selectTarget(a.aim);
    if (a.fire) this.fire(a.aim);
    const near = this.nearest();
    if (a.interact && near && !["relay", "core"].includes(near.id))
      this.interact(near.id);
    if (a.interactHeld && near && ["relay", "core"].includes(near.id)) {
      if (!this.channel || this.channel.id !== near.id)
        this.channel = { id: near.id, progress: 0 };
      this.channel.progress += dt / (near.id === "core" ? 2.2 : 1.7);
      if (this.channel.progress >= 1) {
        this.channel = null;
        this.interact(near.id);
      }
    } else this.channel = null;
    this.updateEnemies(dt);
    this.shots.update(dt, this.map);
    this.shots.hit(
      this.enemies,
      (b, e) => this.hurtEnemy(e, b.dmg, false),
      "player",
    );
    this.shots.hit([p], (b) => this.damage(b.dmg), "enemy");
    for (const d of this.drops)
      if (!d.taken && dist(p, d) < 21) {
        d.taken = true;
        p.credits += d.credits;
        p.reserve = Math.min(240, p.reserve + d.ammo);
        this.stats.loot++;
        this.sound("pickup", 0.35);
        this.game.particles.glints(d.x, d.y, 5, 7, "#dafa60");
        this.emit("loot", { credits: d.credits, ammo: d.ammo });
      }
    this.effects = this.effects.filter((e) => (e.life -= dt) > 0);
    for (const n of this.npcs)
      n.rig.update(dt, {
        x: n.x,
        y: n.y,
        z: 0,
        facing: Math.atan2(p.y - n.y, p.x - n.x),
        pose: n.id === "captive" && !this.flags.captive ? "kneel" : undefined,
      });
    for (const c of this.civilians) {
      const afraid = this.alert > 0 && dist(c, p) < 160;
      c.facing = afraid
        ? Math.atan2(c.y - p.y, c.x - p.x)
        : Math.sin(this.elapsed * 0.1 + c.phase);
      c.vx = afraid
        ? Math.cos(c.facing) * 55
        : Math.sin(this.elapsed * 0.2 + c.phase) * 7;
      c.vy = afraid ? Math.sin(c.facing) * 55 : 0;
      if (dist(c, { x: c.home[0], y: c.home[1] }) > 42 && !afraid) {
        c.vx = (c.home[0] - c.x) * 0.4;
        c.vy = (c.home[1] - c.y) * 0.4;
      }
      c.update(dt, this.map);
      c.rig.update(dt, {
        x: c.x,
        y: c.y,
        z: 0,
        vx: c.vx,
        vy: c.vy,
        facing: c.facing,
      });
    }
    p.rig.update(dt, {
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      facing: p.facing,
      point: !!a.fire || !!a.aimHeld,
      dash: p.dashTime > 0,
      hurt: p.hurt,
      pose: p.crouched ? "crouch" : undefined,
    });
  }
  reload() {
    const p = this.player,
      w = WEAPONS[p.weapon];
    if (p.reloadTime > 0 || p.ammo[p.weapon] >= w.magazine || p.reserve <= 0)
      return false;
    p.reloadTime = w.reload;
    this.sound("select", 0.3);
    return true;
  }
  heal() {
    const p = this.player;
    if (p.meds <= 0 || p.hp >= p.maxHp || p.healCooldown > 0) return false;
    p.meds--;
    p.hp = Math.min(p.maxHp, p.hp + 55);
    p.healCooldown = 2;
    this.sound("heal", 0.5);
    this.game.particles.glints(p.x, p.y, 16, 10, "#7ef7cc");
    this.emit("heal");
    return true;
  }
  fire(aim = null) {
    const p = this.player,
      w = WEAPONS[p.weapon];
    if (p.fireCooldown > 0 || p.reloadTime > 0) return false;
    if (p.ammo[p.weapon] <= 0) {
      this.reload();
      return false;
    }
    let angle = aim ?? p.facing;
    const t = this.selectTarget(aim);
    // Aim assist snaps to a visible target; right stick/mouse selects by angular proximity.
    if (
      t &&
      (aim == null ||
        Math.abs(this.E.angDiff(Math.atan2(t.y - p.y, t.x - p.x), aim)) < 0.48)
    )
      angle = Math.atan2(t.y - p.y, t.x - p.x);
    p.facing = angle;
    p.cloak = 0;
    p.fireCooldown = w.interval;
    p.ammo[p.weapon]--;
    this.stats.shots++;
    this.combatQuiet = 0;
    for (let n = 0; n < w.pellets; n++) {
      const ang = angle + (n - (w.pellets - 1) / 2) * w.spread;
      this.shots.fire({
        x: p.x + Math.cos(ang) * 7,
        y: p.y + Math.sin(ang) * 7,
        z: p.crouched ? 12 : 22,
        vx: Math.cos(ang) * w.speed,
        vy: Math.sin(ang) * w.speed,
        r: 2,
        dmg: w.damage * (p.upgrades.includes("reflex") ? 1.15 : 1),
        life: w.range / w.speed,
        team: "player",
        color: w.color,
      });
    }
    this.sound(p.weapon === "needle" ? "shoot" : "boom", 0.35);
    this.game.input.rumble(p.weapon === "needle" ? 0.2 : 0.5, 0.07);
    this.game.shake(p.weapon === "needle" ? 0.35 : 1.4);
    this.effects.push({
      type: "muzzle",
      x: p.x + Math.cos(angle) * 11,
      y: p.y + Math.sin(angle) * 11,
      z: 23,
      life: 0.08,
    });
    for (const e of this.enemies)
      if (!e.dead && dist(p, e) < 200) e.mind.hear(0.9, p);
    this.emit("shot", { weapon: p.weapon });
    return true;
  }
  damage(amount) {
    const p = this.player;
    if (p.invuln > 0 || this.failed) return;
    const n =
      amount *
      (this.difficulty === "Story"
        ? 0.55
        : this.difficulty === "Edgerunner"
          ? 1.35
          : 1);
    p.hp = Math.max(0, p.hp - n);
    p.hurt = 0.2;
    p.invuln = 0.3;
    this.stats.damage += n;
    this.combatQuiet = 0;
    this.channel = null;
    this.game.shake(1.5);
    this.game.input.rumble(0.7, 0.18);
    this.sound("hurt", 0.5);
    this.emit("damage", { amount: n });
    if (p.hp <= 0) {
      this.failed = true;
      this.shots.clear();
      this.sound("die");
      this.emit("failed");
    }
  }
  hurtEnemy(e, amount, nonlethal = false) {
    if (e.dead) return;
    const dmg = amount * (e.armor && !nonlethal ? 0.52 : 1);
    e.hp = Math.max(0, e.hp - dmg);
    e.hurt = 0.18;
    e.asleep = false;
    this.stats.hits++;
    e.mind.level = 1.2;
    e.mind.last = { x: this.player.x, y: this.player.y, z: 0 };
    this.game.particles.sparks(e.x, e.y, 18, 5, 0);
    this.game.particles.text(
      e.x,
      e.y,
      34,
      String(Math.round(dmg)),
      nonlethal ? "#6ff2e0" : "#f3e9c9",
    );
    this.sound("hit", 0.25);
    if (e.hp <= 0) {
      e.dead = true;
      e.nonlethal = nonlethal;
      e.armor = false;
      this.stats[nonlethal ? "nonlethal" : "kills"]++;
      this.drops.push({
        id: e.id,
        x: e.x,
        y: e.y,
        credits: e.kind === "boss" ? 65 : 18,
        ammo: e.kind === "boss" ? 36 : 24,
        taken: false,
      });
      this.game.particles.bits(e.x, e.y, 16, 7, ["#668598", "#e39e82"]);
      this.sound("powerup", 0.35);
      this.emit("enemyDown", { id: e.id, nonlethal });
      if (e.kind === "boss")
        this.toast("WARDEN OFFLINE", "The archive is unlocked.");
    }
  }
  updateEnemies(dt) {
    const p = this.player;
    let alert = 0;
    for (const e of this.enemies) {
      e.hurt = Math.max(0, e.hurt - dt);
      e.stunned = Math.max(0, e.stunned - dt);
      e.blind = Math.max(0, e.blind - dt);
      e.fireCooldown -= dt;
      if (e.dead) {
        e.down = Math.min(1, e.down + dt * 2.5);
        e.rig.update(dt, {
          x: e.x,
          y: e.y,
          z: 0,
          facing: e.facing,
          down: e.down,
        });
        continue;
      }
      const enc = this.level.encounter;
      if (
        e.kind === "boss" &&
        e.asleep &&
        enc &&
        p.x >= enc.bounds[0] &&
        p.y >= enc.bounds[1] &&
        p.x < enc.bounds[2] &&
        p.y < enc.bounds[3] &&
        this.stage >= enc.stage
      ) {
        e.asleep = false;
        this.emit("bossWake");
        this.toast(
          "WARDEN / PROTOCOL 09",
          "Its orange targeting ring marks an incoming pulse. Dash clear.",
        );
      }
      if (e.asleep) {
        e.rig.update(dt, {
          x: e.x,
          y: e.y,
          z: 0,
          facing: e.facing,
          pose: "guard",
        });
        continue;
      }
      if (e.stunned > 0) {
        e.vx = e.vy = 0;
        e.windup = 0;
        e.rig.update(dt, {
          x: e.x,
          y: e.y,
          z: 0,
          facing: e.facing,
          pose: "kneel",
          hurt: 0.2,
        });
        continue;
      }
      // Once committed, the ground pulse resolves on time even if the runner breaks sight.
      if (e.kind === "boss" && e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const at = e.attackPoint;
          this.effects.push({ type: "pulse", ...at, life: 0.5 });
          this.game.particles.ring(at.x, at.y, 6, 42, "#ff966e", 0.45);
          if (dist(p, at) < 36) this.damage(28);
          this.game.shake(2);
          this.sound("explode", 0.5);
          e.fireCooldown = 2.7;
        }
      }
      const seen =
        p.cloak <= 0 && e.blind <= 0
          ? this.E.sees(e, p, {
              map: this.map,
              range: e.kind === "boss" ? 220 : 155,
              fov: e.kind === "boss" ? Math.PI * 2 : 1.5,
            })
          : { seen: false, exposure: 0 };
      e.seen = !!seen.seen;
      const was = e.mind.state,
        state = e.mind.update(dt, seen, p);
      if (was !== "alert" && state === "alert") {
        this.stats.detections++;
        this.emit("detected", { id: e.id });
      }
      if (state === "alert" || state === "search")
        alert = Math.max(alert, e.mind.level);
      let target;
      if (state === "alert" || state === "search" || state === "notice")
        target = e.mind.last;
      else {
        const q = e.route[e.waypoint];
        target = { x: q[0], y: q[1] };
        if (dist(e, target) < 9) e.waypoint = (e.waypoint + 1) % e.route.length;
      }
      if (target && dist(e, target) > 8) {
        e.path.update(target.x, target.y);
        const [dx, dy] = e.path.dir(e.x, e.y, target.x, target.y),
          speed = state === "alert" ? (e.kind === "boss" ? 26 : 36) : 21;
        e.vx = dx * speed;
        e.vy = dy * speed;
        if (e.vx || e.vy) e.facing = Math.atan2(e.vy, e.vx);
      } else e.vx = e.vy = 0;
      if (state === "alert" && e.seen) {
        e.facing = Math.atan2(p.y - e.y, p.x - e.x);
        if (dist(e, p) < 105) e.vx = e.vy = 0;
        if (e.kind === "boss") {
          if (e.windup > 0) {
            e.vx = e.vy = 0;
          } else if (e.fireCooldown <= 0) {
            e.windup = 1.1;
            e.attackPoint = { x: p.x, y: p.y };
            this.emit("bossTelegraph");
            this.sound("charge", 0.35);
          }
        } else if (e.fireCooldown <= 0) {
          const a = e.facing;
          this.shots.fire({
            x: e.x + Math.cos(a) * 8,
            y: e.y + Math.sin(a) * 8,
            z: 18,
            vx: Math.cos(a) * 125,
            vy: Math.sin(a) * 125,
            r: 2,
            dmg: 10,
            life: 1.8,
            team: "enemy",
            color: "#ff7a90",
          });
          e.fireCooldown = 1.5;
          this.sound("laser", 0.13);
        }
      }
      e.update(dt, this.map);
      e.rig.update(dt, {
        x: e.x,
        y: e.y,
        z: e.z,
        vx: e.vx,
        vy: e.vy,
        facing: e.facing,
        point: state === "alert",
        hurt: e.hurt,
        pose: e.windup > 0 ? "cast" : undefined,
      });
    }
    this.alert = alert;
  }
  hack(id = "overload") {
    const p = this.player,
      h = HACKS.find((h) => h.id === id);
    if (!h || p.ram + 1e-6 < h.cost) {
      this.toast("NOT ENOUGH RAM", "Your neural deck recharges over time.");
      return false;
    }
    const target = this.selectTarget();
    if (id !== "cloak" && !target) {
      this.toast("NO NETWORK TARGET", "Move closer to a visible hostile.");
      return false;
    }
    p.ram -= h.cost;
    this.stats.hacks++;
    this.sound("warp", 0.3);
    if (id === "cloak") {
      p.cloak = 8;
      this.toast("OPTIC CLOAK", "8 seconds. Attacking breaks concealment.");
    } else {
      this.effects.push({
        type: "link",
        x: p.x,
        y: p.y,
        tx: target.x,
        ty: target.y,
        life: 0.55,
      });
      if (id === "overload") {
        this.hurtEnemy(target, 45, true);
        target.stunned = 3;
        target.armor = false;
        this.toast(
          "SHORT CIRCUIT",
          target.kind === "boss"
            ? "Warden armor stripped."
            : "Hostile stunned.",
        );
      } else {
        for (const e of this.enemies) if (dist(p, e) < 220) e.mind.reset();
        target.blind = 10;
        this.toast("MEMORY WIPED", "Hostility erased. Break line of sight.");
      }
    }
    this.emit("hack", { id, target: target?.id });
    return true;
  }
  interact(id) {
    if (id.startsWith("takedown:")) {
      const e = this.takedownTarget();
      if (!e || id !== "takedown:" + e.id) return false;
      this.hurtEnemy(e, e.maxHp, true);
      this.player.cloak = 0;
      this.player.invuln = 0.4;
      this.game.particles.ring(e.x, e.y, 4, 20, "#70edd6", 0.35);
      this.toast("NEURAL TAKEDOWN", "Target neutralized. No lethal force.");
      this.emit("takedown", { id: e.id });
      return true;
    }
    const obj = this.interactables.find((i) => i.id === id);
    if (
      !obj ||
      dist(obj, this.player) > 38 ||
      !this.map.sight(this.player, obj)
    )
      return false;
    if (id === "rook") {
      if (this.stage > 0) {
        this.toast(
          "ROOK / ON COMMS",
          this.stage < 4
            ? "Still here. Keep moving."
            : "Your ride is waiting by transit.",
        );
        return true;
      }
      this.dialogue = "rook";
    } else if (id === "iris") {
      this.dialogue = "iris";
    } else if (id === "captive") {
      if (this.flags.captive) return false;
      this.dialogue = "captive";
    } else if (id === "relay") {
      if (this.stage === 0) {
        this.toast("NO CONTRACT", "Speak with Rook at the market first.");
        return false;
      }
      if (this.flags.relay) return false;
      this.flags.relay = true;
      this.gate(true);
      this.player.reserve += 36;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.completeStage(2);
      for (const e of this.enemies) e.mind.reset();
      this.toast("SECURITY LOOPED", "Helix gate open. Checkpoint saved.");
      this.emit("relay");
      return true;
    } else if (id === "core") {
      if (this.stage < 2) {
        this.toast("ARCHIVE ISOLATED", "The security relay must be cut first.");
        return false;
      }
      if (this.stage >= 4) {
        this.toast("ARCHIVE RESOLVED", "Get to extraction.");
        return false;
      }
      const boss = this.enemies.find((e) => e.kind === "boss");
      if (!boss.dead && !this.flags.captive) {
        this.toast(
          "WARDEN LOCKDOWN",
          "Disable the Warden, or free Sable for a service override.",
        );
        return false;
      }
      this.stage = 3;
      this.dialogue = "core";
      this.emit("core");
    } else if (id === "exit") {
      if (this.stage < 4) {
        this.toast(
          "ONE LOOSE END",
          "Recover the memory archive before leaving.",
        );
        return false;
      }
      this.finished = true;
      this.shots.clear();
      this.player.rig.update(0.1, {
        x: this.player.x,
        y: this.player.y,
        facing: 0,
        pose: "cheer",
      });
      this.sound("oneup");
      this.emit("complete", { result: this.result() });
      return true;
    } else if (id === "cache") {
      if (this.flags.cache) return false;
      this.flags.cache = true;
      this.player.credits += 45;
      this.player.meds++;
      this.player.reserve += 36;
      this.stats.loot++;
      this.sound("pickup");
      this.toast("RUNNER’S STASH", "45 credits · 36 rounds · 1 trauma patch");
      this.emit("cache");
      return true;
    } else if (id === "shard") {
      this.flags.shard = true;
      this.dialogue = "shard";
    }
    this.emit("dialogue", { id: this.dialogue });
    return true;
  }
  choose(choice) {
    const id = this.dialogue;
    if (!id) return false;
    if (
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > (id === "core" ? 2 : 1)
    )
      return false;
    this.dialogue = null;
    if (id === "rook") {
      if (choice === 1) {
        this.player.maxRam++;
        this.player.ram++;
        this.flags.conscience = true;
      }
      this.completeStage(1);
      this.toast(
        "CONTRACT / GHOST DIVIDEND",
        "Cut the relay. Get the core. Choose your future.",
      );
    } else if (id === "iris") {
      if (choice === 1) {
        this.player.hp = this.player.maxHp;
        this.player.meds = Math.max(this.player.meds, 2);
        this.player.reserve = Math.max(this.player.reserve, 72);
        this.toast("PATCHED UP", "Health restored. Supplies topped up.");
        this.checkpoint("Street clinic");
      } else this.emit("shop");
    } else if (id === "captive" && choice === 0) {
      if (this.player.ram < 2) {
        this.toast(
          "TETHER STILL ACTIVE",
          "You need 2 RAM. Wait for it to recharge.",
        );
        return false;
      }
      this.player.ram -= 2;
      this.flags.captive = true;
      this.gate(true, true);
      this.enemies.find((e) => e.kind === "boss").armor = false;
      this.player.credits += 30;
      this.toast(
        "SABLE IS FREE",
        "Service passage unlocked. Warden override obtained.",
      );
      this.emit("rescue");
      this.checkpoint("Sable rescued");
    } else if (id === "core") {
      this.ending = ["broadcast", "sell", "erase"][choice];
      this.flags[this.ending] = true;
      this.player.credits += ENDINGS[this.ending].reward;
      if (this.ending === "broadcast")
        for (const e of this.enemies)
          if (!e.dead) {
            e.mind.level = 1.2;
            e.mind.last = { x: this.player.x, y: this.player.y, z: 0 };
            e.asleep = false;
          }
      if (this.ending === "erase")
        for (const e of this.enemies)
          if (!e.dead) {
            e.stunned = 8;
            e.mind.reset();
          }
      if (this.ending === "sell")
        this.player.reserve = Math.min(240, this.player.reserve + 48);
      this.completeStage(4);
      this.toast(
        ENDINGS[this.ending].title,
        this.ending === "broadcast"
          ? "Your signal is public. Hostiles are tracking you."
          : this.ending === "erase"
            ? "The purge stunned every connected hostile for 8 seconds."
            : "Buyer’s supplies received. Extraction is waiting.",
      );
    }
    this.emit("choice", { dialogue: id, choice });
    return true;
  }
  purchase(id) {
    const u = UPGRADES.find((u) => u.id === id),
      p = this.player;
    if (!u || p.upgrades.includes(id) || p.credits < u.cost) return false;
    p.credits -= u.cost;
    p.upgrades.push(id);
    if (id === "dermal") {
      p.maxHp += 35;
      p.hp = p.maxHp;
    }
    if (id === "ram") {
      p.maxRam += 2;
      p.ram = p.maxRam;
    }
    this.sound("powerup");
    this.toast("IMPLANT INSTALLED", u.name);
    this.emit("upgrade", { id });
    this.checkpoint("Implant installed");
    return true;
  }
  result() {
    const cleared = this.stats.kills + this.stats.nonlethal;
    return {
      ending: this.ending,
      seconds: Math.round(this.elapsed),
      score: Math.max(
        0,
        1000 +
          cleared * 75 +
          this.stats.hacks * 20 +
          (this.flags.captive ? 300 : 0) +
          (this.stats.kills === 0 ? 250 : 0) -
          this.stats.detections * 25,
      ),
      ...this.stats,
      savedSable: !!this.flags.captive,
      credits: this.player.credits,
    };
  }
  serialize() {
    const p = this.player;
    return {
      level: this.level.id,
      stage: this.stage,
      flags: { ...this.flags },
      ending: this.ending,
      elapsed: this.elapsed,
      stats: { ...this.stats },
      player: {
        x: p.x,
        y: p.y,
        hp: p.hp,
        maxHp: p.maxHp,
        ram: p.ram,
        maxRam: p.maxRam,
        credits: p.credits,
        meds: p.meds,
        weapon: p.weapon,
        ammo: { ...p.ammo },
        reserve: p.reserve,
        upgrades: [...p.upgrades],
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        hp: e.hp,
        dead: e.dead,
        nonlethal: !!e.nonlethal,
        armor: e.armor,
      })),
      drops: this.drops.map((d) => ({ ...d })),
    };
  }
  restore(s) {
    this.stage = s.stage;
    this.flags = { ...s.flags };
    this.ending = s.ending;
    this.elapsed = s.elapsed || 0;
    this.stats = { ...this.stats, ...s.stats };
    Object.assign(this.player, s.player);
    this.player.ammo = { ...s.player.ammo };
    this.player.upgrades = [...(s.player.upgrades || [])];
    this.player.cloak = 0;
    this.player.invuln = 1;
    for (const q of s.enemies) {
      const e = this.enemies.find((e) => e.id === q.id);
      if (e) Object.assign(e, q);
    }
    this.drops = (s.drops || []).map((d) => ({ ...d }));
    if (this.flags.relay) this.gate(true);
    if (this.flags.captive) this.gate(true, true);
  }
  snapshot() {
    const p = this.player;
    return {
      stage: this.stage,
      objective: this.objective().title,
      demo: this.demo,
      elapsed: +this.elapsed.toFixed(2),
      player: {
        x: +p.x.toFixed(2),
        y: +p.y.toFixed(2),
        hp: p.hp,
        ram: +p.ram.toFixed(2),
        credits: p.credits,
        ammo: p.ammo[p.weapon],
        reserve: p.reserve,
        weapon: p.weapon,
        crouched: p.crouched,
        cloak: p.cloak,
        upgrades: [...p.upgrades],
      },
      flags: { ...this.flags },
      dialogue: this.dialogue,
      ending: this.ending,
      finished: this.finished,
      failed: this.failed,
      alert: this.alert,
      enemies: this.enemies.map((e) => ({
        id: e.id,
        hp: e.hp,
        x: e.x,
        y: e.y,
        state: e.mind.state,
        dead: e.dead,
        stunned: e.stunned,
      })),
      stats: { ...this.stats },
      events: this.bus.history.map((e) => e.type),
    };
  }
}

export class DemoDirector {
  constructor(world, cycle = 0) {
    this.world = world;
    this.path = new DistrictNavigation(world.map);
    this.cycle = cycle;
    this.visited = new Set();
    this.hackAt = 0;
    this.dashAt = 0;
    this.elapsed = 0;
  }
  update(dt) {
    const w = this.world,
      p = w.player;
    this.elapsed += dt;
    if (w.dialogue) {
      w.choose(
        w.dialogue === "core" ? this.cycle % 3 : w.dialogue === "rook" ? 1 : 0,
      );
      return {};
    }
    let target;
    if (w.stage === 0) target = w.interactables.find((i) => i.id === "rook");
    else if (!w.flags.cache)
      target = w.interactables.find((i) => i.id === "cache");
    else if (!this.visited.has("clinic")) {
      target = w.interactables.find((i) => i.id === "iris");
      if (dist(p, target) < 32) {
        w.interact("iris");
        w.choose(1);
        w.purchase("dermal");
        this.visited.add("clinic");
      }
    } else if (!w.flags.captive)
      target = w.interactables.find((i) => i.id === "captive");
    else target = w.objectivePoint();
    if (!target) return {};
    this.path.update(target.x, target.y);
    let move =
      dist(p, target) > 24
        ? this.path.dir(p.x, p.y, target.x, target.y)
        : [0, 0];
    const hostile = w.selectTarget(),
      stealth = this.cycle % 3 === 1,
      combat =
        hostile &&
        dist(p, hostile) < 155 &&
        !(stealth && hostile.kind === "boss" && w.flags.captive);
    let fire = !!combat,
      hack = false,
      aim = combat ? Math.atan2(hostile.y - p.y, hostile.x - p.x) : null;
    let takedown = false;
    if (combat) {
      if (p.ram >= 2 && this.elapsed > this.hackAt) {
        hack = "overload";
        this.hackAt = this.elapsed + (stealth ? 3 : 4);
      }
      if (stealth) {
        fire = false;
        if (hostile.stunned > 0) {
          this.path.update(hostile.x, hostile.y);
          move = this.path.dir(p.x, p.y, hostile.x, hostile.y);
          takedown = dist(p, hostile) < 22;
        } else if (dist(p, hostile) < 80)
          move = unit(p.x - hostile.x, p.y - hostile.y);
        else move = [0, 0];
      } else if (hostile.kind === "boss" && hostile.windup > 0) {
        const [dx, dy] = unit(
          p.x - hostile.attackPoint.x + 0.5,
          p.y - hostile.attackPoint.y + 0.3,
        );
        move = [dx, dy];
      } else if (dist(p, hostile) < 65) {
        move = unit(p.x - hostile.x, p.y - hostile.y);
      } else if (dist(p, hostile) < (p.weapon === "scatter" ? 100 : 135))
        move = [0, 0];
    }
    let weapon = false;
    if (this.cycle % 3 === 2 && w.stage >= 2 && p.weapon === "needle")
      weapon = true;
    if (
      stealth &&
      w.stage === 2 &&
      hostile?.kind === "boss" &&
      p.cloak < 1 &&
      p.ram >= 4
    )
      hack = "cloak";
    if (
      this.cycle % 3 === 2 &&
      w.stage === 2 &&
      !this.visited.has("wipe") &&
      hostile &&
      p.ram >= 3
    ) {
      hack = "wipe";
      this.visited.add("wipe");
    }
    let dash = false;
    if (
      Math.hypot(...move) > 0.1 &&
      this.elapsed > this.dashAt &&
      p.dashCooldown <= 0
    ) {
      dash = true;
      this.dashAt = this.elapsed + 5;
    }
    return {
      move,
      aim,
      fire,
      hack,
      dash,
      weapon,
      crouch: stealth && !p.crouched && p.dashCooldown <= 0,
      heal: p.hp < p.maxHp * 0.6,
      reload: p.ammo[p.weapon] === 0,
      interact: takedown || dist(p, target) < 31,
      interactHeld: dist(p, target) < 31,
    };
  }
}
