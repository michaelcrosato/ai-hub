import { createWorld } from 'kit/physics.js';
import { lerp, slerpQuaternion } from './util.js';
/** Rapier 0.20 from the kit (boot({ physics: true }) → kit.RAPIER). */
let RAPIER = null;
/** Rapier owns collisions. Rendering never supplies authoritative AI positions. */
export class Physics {
  constructor(rapier) {
    RAPIER = rapier;
    this.dt = 1 / 60;
    this.limit = 16;
    this.actors = new Map();
    this.debris = [];
    this.grounded = false;
    this.velocityY = 0;
    this.fallStart = 0;
    this.stepOpen = false;
  }
  unload() {
    for (const d of [...this.debris]) this.removeDebris(d);
    this.world?.free();
    this.world = null;
    this.actors.clear();
    this.controller = null;
    this.player = null;
    this.playerCollider = null;
    this.stepOpen = false;
  }
  load(colliders, position) {
    this.unload();
    // The game's own gravity: a brisk, toy-like jump arc tuned for its 1-unit bricks.
    this.world = createWorld(RAPIER, { gravity: -18, hz: 1 / this.dt });
    for (const c of colliders) this.addBox(c);
    this.player = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z),
    );
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.32).setFriction(0.8), this.player);
    this.controller = this.world.createCharacterController(0.025);
    this.controller.enableAutostep(0.49, 0.25, true);
    this.controller.enableSnapToGround(0.25);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(70);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.28);
    this.controller.setMinSlopeSlideAngle(Math.PI * 0.35);
    this.previous = { ...position };
    this.current = { ...position };
    this.velocityY = 0;
    this.grounded = false;
    this.fallStart = position.y;
    this.stepOpen = false;
    this.world.step();
  }
  addBox(c) {
    const d = RAPIER.ColliderDesc.cuboid(c.w / 2, c.h / 2, c.d / 2)
      .setTranslation(c.x, c.y, c.z)
      .setFriction(0.82);
    if (c.angle) d.setRotation({ x: 0, y: Math.sin(c.angle / 2), z: 0, w: Math.cos(c.angle / 2) });
    return this.world.createCollider(d);
  }
  setQuality(p) {
    this.limit = p === 'High' ? 36 : 16;
    if (this.world) this.world.integrationParameters.numSolverIterations = p === 'High' ? 8 : 4;
    while (this.debris.length > Math.max(0, this.limit - this.actors.size - 1)) this.removeDebris(this.debris[0]);
  }
  addActor(actor) {
    while (this.debris.length && this.actors.size + this.debris.length + 1 >= this.limit) this.removeDebris(this.debris[0]);
    if (this.actors.size + 1 >= this.limit) return null;
    const p = actor.mesh.position,
      body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + 0.85, p.z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, actor.big ? 0.48 : 0.29).setFriction(0.65), body);
    const a = { body, collider, previous: { x: p.x, y: p.y, z: p.z }, current: { x: p.x, y: p.y, z: p.z } };
    this.actors.set(actor, a);
    return a;
  }
  removeActor(actor) {
    const a = this.actors.get(actor);
    if (a) {
      if (a.controller) this.world.removeCharacterController(a.controller);
      this.world.removeRigidBody(a.body);
      this.actors.delete(actor);
    }
  }
  teleport(p) {
    this.player.setTranslation(p, true);
    this.player.setNextKinematicTranslation(p);
    this.previous = { ...p };
    this.current = { ...p };
    this.velocityY = 0;
    this.grounded = false;
    this.fallStart = p.y;
    this.world.step();
  }
  teleportActor(actor, p) {
    const a = this.actors.get(actor);
    if (!a) return;
    const center = { x: p.x, y: p.y + 0.85, z: p.z };
    a.body.setTranslation(center, true);
    a.body.setNextKinematicTranslation(center);
    a.previous = { ...p };
    a.current = { ...p };
    actor.mesh.position.set(p.x, p.y, p.z);
  }
  beginStep() {
    if (this.stepOpen) return;
    this.stepOpen = true;
    // Undo visual interpolation before AI computes any distances or movement.
    for (const [actor, a] of this.actors) {
      const p = a.body.translation();
      a.current = { x: p.x, y: p.y - 0.85, z: p.z };
      a.previous = { ...a.current };
      actor.mesh.position.set(a.current.x, a.current.y, a.current.z);
    }
  }
  moveActor(actor, x, z) {
    const a = this.actors.get(actor);
    if (!a) return;
    this.beginStep();
    const p = a.body.translation();
    if (!a.controller) {
      a.controller = this.world.createCharacterController(0.02);
      a.controller.enableAutostep(0.5, 0.3, false);
      a.controller.enableSnapToGround(0.3);
    }
    a.controller.computeColliderMovement(
      a.collider,
      { x: x - p.x, y: -0.03, z: z - p.z },
      undefined,
      undefined,
      (c) => c.handle !== this.playerCollider.handle,
    );
    const m = a.controller.computedMovement(),
      n = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    a.body.setNextKinematicTranslation(n);
    a.current = { x: n.x, y: n.y - 0.85, z: n.z };
  }
  step(move) {
    this.beginStep();
    this.previous = { ...this.current };
    const p = this.player.translation(),
      flying = move.fly || move.swim;
    if (flying) {
      this.controller.disableSnapToGround();
      this.velocityY = move.y || 0;
    } else {
      this.controller.enableSnapToGround(0.25);
      if (move.jump && this.grounded) this.velocityY = move.jumpSpeed || 6;
      else this.velocityY = Math.max(move.slowfall ? -2 : -25, this.velocityY - 18 * this.dt);
    }
    this.controller.computeColliderMovement(this.playerCollider, {
      x: move.x * this.dt,
      y: this.velocityY * this.dt,
      z: move.z * this.dt,
    });
    const delta = this.controller.computedMovement(),
      grounded = this.controller.computedGrounded();
    let landed = 0;
    if (grounded && this.velocityY < 0) {
      if (!this.grounded) landed = Math.max(0, this.fallStart - p.y);
      this.velocityY = 0;
    } else if (this.grounded || p.y > this.fallStart) this.fallStart = p.y;
    this.grounded = grounded;
    this.player.setNextKinematicTranslation({ x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z });
    for (const d of this.debris) {
      d.previous = { ...d.body.translation() };
      d.prevRotation = { ...d.body.rotation() };
      d.life -= this.dt;
    }
    this.world.step();
    this.current = { ...this.player.translation() };
    for (const a of this.actors.values()) {
      const p = a.body.translation();
      a.current = { x: p.x, y: p.y - 0.85, z: p.z };
    }
    for (const d of [...this.debris]) {
      d.current = { ...d.body.translation() };
      d.rotation = { ...d.body.rotation() };
      if (d.life <= 0 || d.current.y < -10) this.removeDebris(d);
    }
    this.stepOpen = false;
    return landed;
  }
  interpolate(alpha) {
    return {
      x: lerp(this.previous.x, this.current.x, alpha),
      y: lerp(this.previous.y, this.current.y, alpha),
      z: lerp(this.previous.z, this.current.z, alpha),
    };
  }
  render(alpha) {
    for (const [actor, a] of this.actors) {
      if (['enemy', 'ally'].includes(actor.type))
        actor.mesh.position.set(
          lerp(a.previous.x, a.current.x, alpha),
          lerp(a.previous.y, a.current.y, alpha),
          lerp(a.previous.z, a.current.z, alpha),
        );
      actor.shadow?.position.set(actor.mesh.position.x, actor.mesh.position.y + 0.025, actor.mesh.position.z);
    }
    for (const d of this.debris) {
      d.mesh.position.set(
        lerp(d.previous.x, d.current.x, alpha),
        lerp(d.previous.y, d.current.y, alpha),
        lerp(d.previous.z, d.current.z, alpha),
      );
      const q = slerpQuaternion(d.prevRotation, d.rotation, alpha);
      d.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }
  /** Debris meshes share the view's geometry and materials, so nothing is disposed here. */
  throwDebris(mesh, position) {
    if (this.debris.length + this.actors.size + 1 >= this.limit) {
      mesh.removeFromParent();
      return;
    }
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinvel((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3)
        .setAngvel({ x: 1, y: 2, z: 1 }),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.13, 0.13, 0.13).setMass(0.25).setFriction(0.7).setRestitution(0.12),
      body,
    );
    const rotation = { ...body.rotation() };
    this.debris.push({
      body,
      mesh,
      previous: { ...position },
      current: { ...position },
      prevRotation: { ...rotation },
      rotation,
      life: 3,
    });
  }
  removeDebris(d) {
    if (this.world) this.world.removeRigidBody(d.body);
    d.mesh.removeFromParent();
    const i = this.debris.indexOf(d);
    if (i >= 0) this.debris.splice(i, 1);
  }
  count() {
    return (this.player ? 1 : 0) + this.actors.size + this.debris.length;
  }
}
