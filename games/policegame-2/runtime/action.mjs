import { logEvent } from "./state.mjs";

/** Optional, non-graphic action starter. Uses engine Attack, Bullets and sight tests. */
export class ActionService {
  constructor(runtime, world, game = {}) {
    this.runtime = runtime;
    this.world = world;
    this.shots = world.adapter.projectiles(game);
    this.attack = world.adapter.attack("jab");
    this.controlTarget = null;
  }
  get state() {
    return this.runtime.state;
  }
  get rules() {
    return this.runtime.definition.action || {};
  }
  requireEnabled() {
    if (!this.runtime.definition.capabilities?.includes("action"))
      throw new Error("Action equipment is unavailable in this case.");
  }
  equip(on = true) {
    this.requireEnabled();
    const p = this.state.player;
    p.weapon ||= {
      magazine: this.rules.magazine || 6,
      ammo: this.rules.magazine || 6,
      reserve: this.rules.reserve ?? 18,
      reload: 0,
    };
    p.weapon.equipped = on;
    if (!on) p.aiming = false;
  }
  aim(angle, on = true) {
    this.requireEnabled();
    if (!this.state.player.weapon?.equipped)
      throw new Error("Equip the sidearm first.");
    this.state.player.aiming = on;
    if (Number.isFinite(angle)) this.state.player.facing = angle;
  }
  fire() {
    this.requireEnabled();
    const p = this.state.player,
      w = p.weapon;
    if (!w?.equipped || !p.aiming)
      throw new Error("Equip and aim before firing.");
    if (w.reload > 0) throw new Error("Reloading.");
    if (w.ammo < 1) throw new Error("Magazine empty. Reload or holster.");
    if (this.state.seconds < (w.nextShot || 0))
      throw new Error("Allow the action to recover before firing again.");
    w.ammo--;
    w.nextShot = this.state.seconds + (this.rules.cooldown || 0.25);
    this.shots.list = this.state.projectiles || [];
    this.shots.fire({
      x: p.x + Math.cos(p.facing) * 9,
      y: p.y + Math.sin(p.facing) * 9,
      z: (p.z || 0) + 22,
      vx: Math.cos(p.facing) * (this.rules.projectileSpeed || 260),
      vy: Math.sin(p.facing) * (this.rules.projectileSpeed || 260),
      r: 2,
      dmg: this.rules.damage || 35,
      life: 1.5,
      team: "player",
      data: { scene: p.scene },
    });
    this.state.projectiles = this.shots.list;
    logEvent(
      this.state,
      "Shot fired",
      "A round was discharged. The incident is recorded.",
      { incident: "discharge" },
    );
  }
  reload() {
    this.requireEnabled();
    const w = this.state.player.weapon;
    if (!w?.equipped || w.reload > 0 || w.ammo >= w.magazine || w.reserve <= 0)
      throw new Error("Reload is unavailable.");
    w.reload = this.rules.reloadSeconds || 1.3;
  }
  control(id) {
    this.requireEnabled();
    const target = this.state.entities[id],
      p = this.state.player;
    if (
      !target ||
      target.kind !== "person" ||
      target.scene !== p.scene ||
      Math.hypot(target.x - p.x, target.y - p.y) >
        (this.rules.controlRange || 32) ||
      !this.world.canSee(p, target)
    )
      throw new Error("Move close with a clear view to use a control action.");
    if (["restrained", "incapacitated"].includes(target.mode))
      throw new Error("The subject is already controlled.");
    p.facing = Math.atan2(target.y - p.y, target.x - p.x);
    if (this.attack.busy || this.state.pendingControl)
      throw new Error("The current control action must finish first.");
    this.state.pendingControl = id;
  }
  damage(target, amount, kind) {
    target.health = Math.max(0, (target.health ?? 100) - amount);
    target.stress = Math.min(100, (target.stress || 0) + 25);
    if (target.team !== "hostile" && !target.properties?.trainingTarget) {
      this.state.penalties.push({
        id: `unjustified:${this.state.seconds}`,
        category: this.rules.consequenceCategory || "care",
        points: this.rules.consequencePoints || 5,
        reason: "Force against a non-hostile person.",
      });
      logEvent(
        this.state,
        "Use-of-force review",
        "A non-hostile person was affected. Medical assistance and a report are required.",
        { entity: target.id, incident: "unjustified-force" },
      );
    }
    if (target.health === 0) {
      target.mode = "incapacitated";
      target.medical = "needed";
    } else if (kind === "control") {
      target.mode = "comply";
      target.custody ||= {};
      target.custody.contact = true;
    }
    logEvent(
      this.state,
      kind === "control" ? "Subject controlled" : "Impact recorded",
      `${target.label || target.id}: ${target.health === 0 ? "incapacitated; request medical assistance" : "control and condition updated"}.`,
      { entity: target.id, incident: kind },
    );
  }
  tick(dt) {
    const p = this.state.player,
      w = p.weapon;
    if (this.state.pendingControl) {
      if (this.attack.start()) {
        this.controlTarget = this.state.pendingControl;
        this.controlHit = false;
      }
      delete this.state.pendingControl;
    }
    if (w?.reload > 0) {
      w.reload = Math.max(0, w.reload - dt);
      if (w.reload === 0) {
        const n = Math.min(w.magazine - w.ammo, w.reserve);
        w.ammo += n;
        w.reserve -= n;
        logEvent(
          this.state,
          "Reload complete",
          `${w.ammo} rounds in the magazine.`,
          { incident: "reload" },
        );
      }
    }
    this.attack.update(dt);
    if (this.controlTarget) {
      const t = this.state.entities[this.controlTarget];
      if (t)
        this.attack.hits(
          [t],
          (e) =>
            !this.controlHit &&
            this.world.adapter.E.inArc(
              p,
              p.facing,
              e,
              (this.rules.controlRange || 32) + 2,
              0.8,
              8,
            ) &&
            this.world.canSee(p, e),
          (e) => {
            this.controlHit = true;
            this.damage(e, this.rules.controlDamage || 10, "control");
          },
        );
      if (!this.attack.busy) this.controlTarget = null;
    }
    const live = this.state.projectiles || [];
    const remaining = [];
    // Public Bullets has point collision. Substeps plus a swept wall ray prevent crossing thin cover.
    for (const bullet of live) {
      this.shots.list = [bullet];
      const map = this.world.map(bullet.data.scene),
        steps = Math.max(
          1,
          Math.ceil((Math.hypot(bullet.vx, bullet.vy) * dt) / 2),
        );
      for (let i = 0; i < steps && this.shots.list.length; i++) {
        const delta = dt / steps,
          from = { x: bullet.x, y: bullet.y, z: bullet.z },
          to = {
            x: bullet.x + bullet.vx * delta,
            y: bullet.y + bullet.vy * delta,
            z: bullet.z,
          };
        if (!map.ray(from, to, { eye: 0, target: 0 }).clear) {
          bullet.dead = true;
          this.shots.list = [];
          break;
        }
        this.shots.update(delta, map);
        const targets = this.world
          .entities(bullet.data.scene)
          .filter(
            (e) =>
              e.kind === "person" &&
              e.mode !== "incapacitated" &&
              bullet.z >= (e.z || 0) &&
              bullet.z <= (e.z || 0) + 38,
          );
        this.shots.hit(
          targets,
          (b, t) => this.damage(t, b.dmg, "projectile"),
          "player",
        );
      }
      remaining.push(...this.shots.list);
    }
    this.shots.list = remaining;
    this.state.projectiles = remaining;
  }
  resetPresentation() {
    this.attack.cancel();
    this.controlTarget = null;
    this.shots.list = this.state.projectiles || [];
  }
}
