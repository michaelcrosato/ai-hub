import { createWorld } from 'kit/physics.js';
import { TYPES, domain, PHYSICS_BUDGET } from './catalog.js';

/**
 * Presentation-only physics on Rapier 0.20 (kit/physics.js): quality changes never
 * alter combat or pathfinding. Units are kinematic proxies, structures fixed boxes,
 * and destroyed bricks are short-lived dynamic bodies that tumble off them.
 *
 * Gravity is -18 (not the kit's -9.81): the battlefield is built at brick scale, and
 * debris at real-world gravity floats like confetti at this size.
 */
export class Debris {
  constructor(RAPIER, detail = 1) {
    this.RAPIER = RAPIER;
    this.proxies = new Map();
    this.debris = [];
    this.serial = 0;
    this.stamp = 0;
    this.world = null;
    this.budget = { bodies: 0, debris: 0 };
    this.setDetail(detail);
    this.reset();
  }
  /** Body and debris caps follow the kit's detail factor (1 on high, 0.5 on low). */
  setDetail(detail) {
    this.budget.bodies = Math.max(48, Math.round(PHYSICS_BUDGET.bodies * detail));
    this.budget.debris = Math.max(12, Math.round(PHYSICS_BUDGET.debris * detail));
    if (this.world) this.trim();
  }
  get bodies() {
    return this.world ? this.world.bodies.len() : 0;
  }
  reset(map) {
    const R = this.RAPIER;
    this.world?.free();
    this.world = createWorld(R, { gravity: -18 });
    this.proxies.clear();
    this.debris.length = 0;
    const floor = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(50, -1, 42));
    this.world.createCollider(R.ColliderDesc.cuboid(52, 1, 44).setFriction(0.85), floor);
    for (const r of map?.obstacles || []) {
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(r.x, 1, r.z));
      this.world.createCollider(R.ColliderDesc.cuboid(r.w / 2, 1, r.h / 2).setFriction(0.8), body);
    }
  }
  /** Keep the total budget exact: drop cosmetic unit proxies first, then structures, then old debris. */
  trim() {
    while (this.debris.length > this.budget.debris) this.removeDebris(0);
    const candidates = [...this.proxies].sort((a, b) => Number(a[1].fixed) - Number(b[1].fixed));
    for (const [id, proxy] of candidates) {
      if (this.bodies <= this.budget.bodies) break;
      this.world.removeRigidBody(proxy.body);
      this.proxies.delete(id);
    }
    while (this.bodies > this.budget.bodies && this.debris.length) this.removeDebris(0);
  }
  removeDebris(i) {
    const d = this.debris[i];
    if (!d) return;
    this.world.removeRigidBody(d.body);
    this.debris.splice(i, 1);
  }
  burst(x, z, large = false, rng = Math.random) {
    const R = this.RAPIER;
    const n = large ? 10 : 5;
    for (let i = 0; i < n; i++) {
      if (this.debris.length >= this.budget.debris) this.removeDebris(0);
      if (this.bodies >= this.budget.bodies) break;
      const size = 0.15 + rng() * 0.25;
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(x + (rng() - 0.5) * 2, 0.8 + rng() * 1.8, z + (rng() - 0.5) * 2)
        .setLinearDamping(0.3)
        .setAngularDamping(0.5)
        .setCcdEnabled(true);
      const body = this.world.createRigidBody(desc);
      this.world.createCollider(R.ColliderDesc.cuboid(size, size * 0.65, size).setDensity(4).setFriction(0.75).setRestitution(0.15), body);
      const mass = body.mass();
      body.applyImpulse({ x: (rng() - 0.5) * mass * 9, y: mass * (3 + rng() * 7), z: (rng() - 0.5) * mass * 9 }, true);
      body.applyTorqueImpulse({ x: (rng() - 0.5) * mass * 2, y: (rng() - 0.5) * mass * 2, z: (rng() - 0.5) * mass * 2 }, true);
      const p = body.translation();
      const q = body.rotation();
      this.debris.push({
        id: ++this.serial,
        body,
        size,
        life: 4 + rng() * 2,
        prev: { x: p.x, y: p.y, z: p.z },
        curr: { x: p.x, y: p.y, z: p.z },
        prevRot: { x: q.x, y: q.y, z: q.z, w: q.w },
        rot: { x: q.x, y: q.y, z: q.z, w: q.w },
      });
    }
  }
  /** One fixed 1/60 s step, run alongside each simulation step. */
  step(sim, dt) {
    const stamp = ++this.stamp;
    for (const e of sim.entities) {
      if (e.hp <= 0 || domain(e) === 'air') continue;
      let p = this.proxies.get(e.id);
      if (!p && this.bodies < this.budget.bodies) {
        const d = TYPES[e.type];
        const fixed = d.kind === 'building';
        const h = fixed ? 1.6 : 0.5;
        const body = this.world.createRigidBody((fixed ? this.RAPIER.RigidBodyDesc.fixed() : this.RAPIER.RigidBodyDesc.kinematicPositionBased()).setTranslation(e.x, h, e.z));
        const size = fixed && e.rot % 2 ? [d.size[1], d.size[0]] : d.size;
        const sx = fixed ? size[0] / 2 : d.radius;
        const sz = fixed ? size[1] / 2 : d.radius;
        this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(sx, h, sz).setDensity(fixed ? 20 : 8).setFriction(0.8), body);
        p = { body, fixed, stamp };
        this.proxies.set(e.id, p);
      }
      if (!p) continue;
      p.stamp = stamp;
      if (!p.fixed) p.body.setNextKinematicTranslation({ x: e.x, y: 0.5, z: e.z });
    }
    // Entities that are gone (destroyed, sold, captured into rubble) lose their proxy.
    for (const [id, p] of this.proxies) {
      if (p.stamp !== stamp) {
        this.world.removeRigidBody(p.body);
        this.proxies.delete(id);
      }
    }
    for (const d of this.debris) {
      d.prev.x = d.curr.x;
      d.prev.y = d.curr.y;
      d.prev.z = d.curr.z;
      d.prevRot.x = d.rot.x;
      d.prevRot.y = d.rot.y;
      d.prevRot.z = d.rot.z;
      d.prevRot.w = d.rot.w;
      d.life -= dt;
    }
    this.world.step();
    for (const d of this.debris) {
      const p = d.body.translation();
      const q = d.body.rotation();
      d.curr.x = p.x;
      d.curr.y = p.y;
      d.curr.z = p.z;
      d.rot.x = q.x;
      d.rot.y = q.y;
      d.rot.z = q.z;
      d.rot.w = q.w;
    }
    for (let i = this.debris.length - 1; i >= 0; i--) if (this.debris[i].life <= 0) this.removeDebris(i);
  }
}
