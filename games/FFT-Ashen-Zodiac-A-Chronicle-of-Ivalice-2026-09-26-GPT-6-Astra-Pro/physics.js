import { createWorld, fixedStep } from 'kit/physics.js';

/**
 * Visual debris only. Tactical positions are governed by the grid rules.
 * Rapier 0.20 comes from the kit (boot({ physics: true }) → kit.RAPIER).
 */
export class PhysicsWorld {
  constructor(RAPIER) {
    this.RAPIER = RAPIER;
    this.world = createWorld(RAPIER);
    this.elapsed = 0;
    this.dynamic = [];
    this.ground = null;
    this.configure({ bodies: 28, steps: 2, solver: 2 });
  }
  configure(q) {
    this.maxBodies = q.bodies;
    this.clock = fixedStep(60, q.steps);
    this.world.integrationParameters.numSolverIterations = q.solver;
    while (this.dynamic.length > this.maxBodies) this.remove(this.dynamic[0]);
  }
  setGround(grid) {
    const { RAPIER, world } = this;
    this.clear();
    if (this.ground) world.removeRigidBody(this.ground);
    // One fixed body carries a collider per walkable column.
    this.ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const t of grid.tiles) {
      if (t.blocked) continue;
      const h = t.h * 0.34 + 0.7;
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, h / 2, 0.5).setTranslation(t.x, h / 2 - 0.7, t.z).setFriction(0.8), this.ground);
    }
    this.clock.reset();
  }
  add(mesh, pos, velocity = { x: 0, y: 3, z: 0 }, life = 1.4) {
    const { RAPIER, world } = this;
    while (this.dynamic.length >= this.maxBodies) this.remove(this.dynamic[0]);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(0.45).setAngularDamping(0.6),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.09, 0.09, 0.09).setDensity(1.25).setFriction(0.78).setRestitution(0.22), body);
    body.setLinvel(velocity, true);
    body.setAngvel({ x: velocity.z, y: 3, z: velocity.x }, true);
    const p = body.translation(),
      q = body.rotation();
    this.dynamic.push({
      mesh,
      body,
      previous: { x: p.x, y: p.y, z: p.z },
      current: { x: p.x, y: p.y, z: p.z },
      previousQ: { x: q.x, y: q.y, z: q.z, w: q.w },
      currentQ: { x: q.x, y: q.y, z: q.z, w: q.w },
      end: this.elapsed + life,
    });
  }
  remove(d) {
    this.world.removeRigidBody(d.body);
    d.mesh.removeFromParent();
    if (d.mesh.userData.ownGeometry) d.mesh.geometry.dispose();
    if (d.mesh.userData.ownedMaterial) d.mesh.material.dispose();
    this.dynamic.splice(this.dynamic.indexOf(d), 1);
  }
  #step = () => {
    for (const d of this.dynamic) {
      Object.assign(d.previous, d.current);
      Object.assign(d.previousQ, d.currentQ);
    }
    this.world.step();
    for (const d of this.dynamic) {
      const p = d.body.translation(),
        q = d.body.rotation();
      d.current.x = p.x;
      d.current.y = p.y;
      d.current.z = p.z;
      d.currentQ.x = q.x;
      d.currentQ.y = q.y;
      d.currentQ.z = q.z;
      d.currentQ.w = q.w;
    }
  };
  update(dt) {
    this.elapsed += dt;
    if (!this.dynamic.length) {
      this.clock.reset();
      return;
    }
    const alpha = this.clock.advance(dt, this.#step);
    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const d = this.dynamic[i];
      if (this.elapsed > d.end || d.current.y < -8) {
        this.remove(d);
        continue;
      }
      const a = d.previous,
        b = d.current;
      d.mesh.position.set(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha);
      const qa = d.previousQ,
        qb = d.currentQ,
        sign = qa.x * qb.x + qa.y * qb.y + qa.z * qb.z + qa.w * qb.w < 0 ? -1 : 1;
      d.mesh.quaternion
        .set(
          qa.x + (qb.x * sign - qa.x) * alpha,
          qa.y + (qb.y * sign - qa.y) * alpha,
          qa.z + (qb.z * sign - qa.z) * alpha,
          qa.w + (qb.w * sign - qa.w) * alpha,
        )
        .normalize();
    }
  }
  clear() {
    for (let i = this.dynamic.length - 1; i >= 0; i--) this.remove(this.dynamic[i]);
  }
  dispose() {
    this.clear();
    this.world.free();
  }
}
