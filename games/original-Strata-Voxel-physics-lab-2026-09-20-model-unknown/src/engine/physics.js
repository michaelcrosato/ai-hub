import { Mesh, Vector3 } from 'three/webgpu';
import { createWorld } from 'kit/physics.js';
import { makeGeometry } from './geometry.js';
import { PALETTE } from '../voxel/palette.js';
import { VOXEL_SIZE, FIXED_DT, LIMITS } from './config.js';

const _force = new Vector3(), _point = new Vector3(), _centre = new Vector3(), _delta = new Vector3();

/** Rapier 0.20 (loaded by the kit) for loose voxel fragments; static terrain is exact box colliders. */
export class PhysicsEngine {
  constructor(RAPIER, scene, material, maxBodies) {
    Object.assign(this, { RAPIER, scene, material, maxBodies });
    this.world = createWorld(RAPIER, { hz: 1 / FIXED_DT });
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 2;
    this.events = new RAPIER.EventQueue(true);
    this.staticChunks = new Map(); this.byCollider = new Map(); this.bodies = [];
    this.debrisSeconds = LIMITS.debrisSeconds; this.time = 0; this.impactEvents = []; this.soundEvents = []; this.culled = 0;
    this.awake = 0;
    // Safety floor matches the distant presentation plane.
    this.floorCollider = null; this.setFloorExtent(100);
  }
  setFloorExtent(halfSize) {
    if (!Number.isFinite(halfSize) || halfSize <= 0) throw new RangeError('Invalid floor size.');
    if (this.floorCollider) this.world.removeCollider(this.floorCollider, true);
    this.floorCollider = this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(halfSize, 0.2, halfSize)
      .setTranslation(0, -3.05, 0).setFriction(0.8));
  }
  replaceStatic(key, boxes, origin, size) {
    for (const c of this.staticChunks.get(key) || []) this.world.removeCollider(c, true);
    const list = [];
    for (const b of boxes) {
      list.push(this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(b.w * size / 2, b.h * size / 2, b.d * size / 2)
        .setTranslation(origin[0] + (b.x + b.w / 2) * size, origin[1] + (b.y + b.h / 2) * size, origin[2] + (b.z + b.d / 2) * size)
        .setFriction(0.78).setRestitution(0.04)));
    }
    this.staticChunks.set(key, list);
  }
  clearStatic() {
    for (const list of this.staticChunks.values()) for (const c of list) this.world.removeCollider(c, true);
    this.staticChunks.clear();
  }
  /**
   * options.damageRadius overrides the impact break radius (launched slugs hit harder);
   * options.life overrides the debris lifetime in seconds.
   */
  addFragment(fragment, velocity = [0, 0, 0], rotation = null, options = {}) {
    if (!fragment.boxes.length || !fragment.geometry.indices.length) return null;
    const { RAPIER } = this;
    while (this.bodies.length >= this.maxBodies) {
      const sleeper = this.bodies.find(entry => entry.body.isSleeping());
      this.remove(sleeper || this.bodies[0]); this.culled++;
    }
    const centre = fragment.dims.map(v => v * VOXEL_SIZE / 2);
    const position = fragment.origin.map((v, d) => v * VOXEL_SIZE + centre[d]);
    let desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position).setLinvel(...velocity)
      .setLinearDamping(0.12).setAngularDamping(0.3).setCanSleep(true).setCcdEnabled(true);
    if (rotation) desc = desc.setRotation(rotation);
    const body = this.world.createRigidBody(desc), geometry = makeGeometry(fragment.geometry);
    geometry.translate(-centre[0], -centre[1], -centre[2]);
    const mesh = new Mesh(geometry, this.material); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.fromArray(position); if (rotation) mesh.quaternion.copy(rotation); this.scene.add(mesh);
    let material = 0, most = 0; const tally = new Map();
    for (const b of fragment.boxes) {
      const n = (tally.get(b.material) || 0) + b.w * b.h * b.d; tally.set(b.material, n);
      if (n > most) { most = n; material = b.material; }
    }
    const entry = { body, mesh, colliders: [], born: this.time, lastImpact: -1, lastSound: -1,
      voxelData: fragment.data.slice(), dims: fragment.dims.slice(), centre: new Vector3().fromArray(centre),
      radius: Math.hypot(...centre), prev: mesh.position.clone(), current: mesh.position.clone(),
      prevQ: mesh.quaternion.clone(), currentQ: mesh.quaternion.clone(), previousVelocity: new Vector3(), cells: fragment.count,
      material, damageRadius: options.damageRadius ?? null, life: options.life ?? null, projectile: !!options.projectile };
    for (const b of fragment.boxes) {
      const density = PALETTE[b.material]?.density || 2200;
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w * VOXEL_SIZE / 2, b.h * VOXEL_SIZE / 2, b.d * VOXEL_SIZE / 2)
        .setTranslation((b.x + b.w / 2) * VOXEL_SIZE - centre[0], (b.y + b.h / 2) * VOXEL_SIZE - centre[1], (b.z + b.d / 2) * VOXEL_SIZE - centre[2])
        .setDensity(density).setFriction(0.72).setRestitution(0.08)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(100), body);
      entry.colliders.push(collider); this.byCollider.set(collider.handle, entry);
    }
    mesh.userData.physics = entry; this.bodies.push(entry); this.awake++; return entry;
  }
  step(dt) {
    this.time += dt; this.world.timestep = dt;
    for (const entry of this.bodies) {
      entry.prev.copy(entry.current); entry.prevQ.copy(entry.currentQ); entry.previousVelocity.copy(entry.body.linvel());
    }
    this.world.step(this.events);
    this.events.drainContactForceEvents(event => {
      const a = this.byCollider.get(event.collider1()), b = this.byCollider.get(event.collider2());
      const any = a || b;
      if (!any) return;
      const impulse = event.totalForceMagnitude() * dt;
      // Audible knocks: any loose piece, rate-limited per body, scaled by the change in speed.
      const speed = any.previousVelocity.length(), dv = impulse / Math.max(1, any.body.mass());
      if (speed > 1.2 && dv > 0.6 && this.time - any.lastSound > 0.14 && this.soundEvents.length < 8) {
        any.lastSound = this.time;
        this.soundEvents.push({ strength: Math.min(1, dv / 6), position: any.current.toArray(), material: any.material });
      }
      // Only dynamic-to-static impacts can request voxel damage.
      const entry = a && !b ? a : b && !a ? b : null;
      if (!entry || this.time - entry.lastImpact < 0.7 || entry.previousVelocity.lengthSq() < 16) return;
      if (impulse < entry.body.mass() * 1.1) return;
      entry.lastImpact = this.time;
      this.impactEvents.push({ origin: entry.prev.toArray(), velocity: entry.previousVelocity.toArray(),
        reach: entry.radius + entry.previousVelocity.length() * dt + 0.25,
        radius: entry.damageRadius ?? Math.min(0.7, Math.max(0.3, entry.radius * 0.7)), projectile: entry.projectile });
    });
    let awake = 0;
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const entry = this.bodies[i];
      entry.current.copy(entry.body.translation()); entry.currentQ.copy(entry.body.rotation());
      const life = entry.life ?? this.debrisSeconds;
      if (entry.current.y < -18 || (life > 0 && this.time - entry.born > life)) { this.remove(entry); continue; }
      if (!entry.body.isSleeping()) awake++;
    }
    this.awake = awake;
  }
  sync(alpha) {
    for (const entry of this.bodies) {
      entry.mesh.position.lerpVectors(entry.prev, entry.current, alpha);
      entry.mesh.quaternion.slerpQuaternions(entry.prevQ, entry.currentQ, alpha);
    }
  }
  impulse(entry, direction, speed = 6, point = null) {
    _force.fromArray(direction).normalize().multiplyScalar(entry.body.mass() * speed);
    if (point) entry.body.applyImpulseAtPoint(_force, _point.fromArray(point), true);
    else entry.body.applyImpulse(_force, true);
  }
  radialImpulse(point, radius, strength = 4) {
    _centre.fromArray(point);
    for (const entry of this.bodies) {
      _delta.copy(entry.current).sub(_centre); const distance = _delta.length();
      if (distance > radius) continue;
      _delta.y += 0.35;
      this.impulse(entry, _delta.toArray(), strength * (1 - distance / radius));
    }
  }
  remove(entry) {
    if (!entry) return;
    const index = this.bodies.indexOf(entry); if (index < 0) return;
    for (const c of entry.colliders) this.byCollider.delete(c.handle);
    this.world.removeRigidBody(entry.body); this.scene.remove(entry.mesh); entry.mesh.geometry.dispose();
    this.bodies.splice(index, 1);
  }
  clearDynamic() {
    for (const entry of [...this.bodies]) this.remove(entry);
    this.impactEvents.length = 0; this.soundEvents.length = 0; this.awake = 0;
  }
  get staticCount() { let n = 1; for (const list of this.staticChunks.values()) n += list.length; return n; }
  dispose() { this.clearDynamic(); this.clearStatic(); this.events.free(); this.world.free(); }
}
