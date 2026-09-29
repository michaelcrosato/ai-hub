import { createWorld } from 'kit/physics.js';

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/**
 * Rapier 0.20 (loaded by the kit) is the only movement integrator. All bodies
 * are constrained to the XZ flight plane. Ships are sensors (ships fly over
 * each other, as in Endless Sky); asteroids are solid and knock each other about.
 */
export class Physics {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.world = createWorld(RAPIER, { gravity: 0 });
    this.bodies = new Map();
    this.limit = 64;
    this.dropped = 0;
  }
  add(id, { x = 0, z = 0, radius = 1, mass = 10, vx = 0, vz = 0, sensor = false, damping = 0, angle = 0 } = {}) {
    if (this.bodies.size >= this.limit) {
      this.dropped++;
      return null;
    }
    const R = this.R;
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(x, 0, z)
      .setLinvel(vx, 0, vz)
      .setLinearDamping(damping)
      .setAngularDamping(0.4)
      .enabledTranslations(true, false, true)
      .enabledRotations(false, true, false)
      .setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);
    const collider = R.ColliderDesc.ball(radius).setMass(mass).setFriction(0.35).setRestitution(0.2).setSensor(sensor);
    this.world.createCollider(collider, body);
    const entry = { body, prev: { x, z }, current: { x, z }, angle, previousAngle: angle, radius };
    this.bodies.set(id, entry);
    return entry;
  }
  remove(id) {
    const e = this.bodies.get(id);
    if (!e) return;
    this.world.removeRigidBody(e.body);
    this.bodies.delete(id);
  }
  clear() {
    for (const id of [...this.bodies.keys()]) this.remove(id);
  }
  setLimit(n) {
    this.limit = n;
  }
  setPosition(id, x, z) {
    const e = this.bodies.get(id);
    if (!e) return;
    e.body.setTranslation({ x, y: 0, z }, true);
    e.prev.x = e.current.x = x;
    e.prev.z = e.current.z = z;
  }
  velocity(id) {
    const e = this.bodies.get(id);
    return e ? e.body.linvel() : { x: 0, y: 0, z: 0 };
  }
  setVelocity(id, x, z) {
    this.bodies.get(id)?.body.setLinvel({ x, y: 0, z }, true);
  }
  impulse(id, x, z) {
    this.bodies.get(id)?.body.applyImpulse({ x, y: 0, z }, true);
  }
  setAngle(id, a) {
    const e = this.bodies.get(id);
    if (!e) return;
    e.angle = a;
    e.body.setRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  begin() {
    for (const e of this.bodies.values()) {
      e.prev.x = e.current.x;
      e.prev.z = e.current.z;
      e.previousAngle = e.angle;
    }
  }
  step(dt = 1 / 60) {
    this.world.timestep = dt;
    this.world.step();
    for (const e of this.bodies.values()) {
      const p = e.body.translation();
      e.current.x = p.x;
      e.current.z = p.z;
    }
  }
  /** Interpolated position; pass `out` to avoid allocating. Angles take the short way round. */
  position(id, alpha = 1, out = { x: 0, z: 0, angle: 0 }) {
    const e = this.bodies.get(id);
    if (!e) {
      out.x = 0;
      out.z = 0;
      out.angle = 0;
      return out;
    }
    out.x = e.prev.x + (e.current.x - e.prev.x) * alpha;
    out.z = e.prev.z + (e.current.z - e.prev.z) * alpha;
    out.angle = e.previousAngle + wrap(e.angle - e.previousAngle) * alpha;
    return out;
  }
  dispose() {
    this.clear();
    this.world.free();
  }
}
