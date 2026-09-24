import RAPIER from '@dimforge/rapier3d-compat';
import { Mesh, Vector3, Quaternion } from 'three/webgpu';
import { makeGeometry } from './geometry.js';
import { PALETTE } from '../voxel/palette.js';
import { VOXEL_SIZE, FIXED_DT, LIMITS } from './config.js';

export class PhysicsEngine {
  static async create(scene, material, maxBodies) {
    await RAPIER.init(); return new PhysicsEngine(scene, material, maxBodies);
  }
  constructor(scene, material, maxBodies) {
    Object.assign(this, { scene, material, maxBodies });
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 2;
    this.events = new RAPIER.EventQueue(true);
    this.staticChunks = new Map(); this.byCollider = new Map(); this.bodies = [];
    this.debrisSeconds = LIMITS.debrisSeconds; this.time = 0; this.impactEvents = []; this.culled = 0;
    // Safety floor matches the distant presentation plane.
    this.floorCollider = null; this.setFloorExtent(100);
  }
  setFloorExtent(halfSize) {
    if (!Number.isFinite(halfSize) || halfSize <= 0) throw new RangeError('Invalid floor size.');
    if (this.floorCollider) this.world.removeCollider(this.floorCollider, true);
    this.floorCollider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(halfSize, 0.2, halfSize)
      .setTranslation(0, -3.05, 0).setFriction(0.8));
  }
  replaceStatic(key, boxes, origin, size) {
    for (const c of this.staticChunks.get(key) || []) this.world.removeCollider(c, true);
    const list = [];
    for (const b of boxes) {
      list.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w * size / 2, b.h * size / 2, b.d * size / 2)
        .setTranslation(origin[0] + (b.x + b.w / 2) * size, origin[1] + (b.y + b.h / 2) * size, origin[2] + (b.z + b.d / 2) * size)
        .setFriction(0.78).setRestitution(0.04)));
    }
    this.staticChunks.set(key, list);
  }
  clearStatic() {
    for (const list of this.staticChunks.values()) for (const c of list) this.world.removeCollider(c, true);
    this.staticChunks.clear();
  }
  addFragment(fragment, velocity = [0, 0, 0], rotation = null) {
    if (!fragment.boxes.length || !fragment.geometry.indices.length) return null;
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
    const entry = { body, mesh, colliders: [], born: this.time, lastImpact: -1,
      voxelData: fragment.data.slice(), dims: fragment.dims.slice(), centre: new Vector3().fromArray(centre),
      radius: Math.hypot(...centre), prev: mesh.position.clone(), current: mesh.position.clone(),
      prevQ: mesh.quaternion.clone(), currentQ: mesh.quaternion.clone(), previousVelocity: new Vector3(), cells: fragment.count };
    for (const b of fragment.boxes) {
      const density = PALETTE[b.material]?.density || 2200;
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w * VOXEL_SIZE / 2, b.h * VOXEL_SIZE / 2, b.d * VOXEL_SIZE / 2)
        .setTranslation((b.x + b.w / 2) * VOXEL_SIZE - centre[0], (b.y + b.h / 2) * VOXEL_SIZE - centre[1], (b.z + b.d / 2) * VOXEL_SIZE - centre[2])
        .setDensity(density).setFriction(0.72).setRestitution(0.08)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(100), body);
      entry.colliders.push(collider); this.byCollider.set(collider.handle, entry);
    }
    mesh.userData.physics = entry; this.bodies.push(entry); return entry;
  }
  step(dt) {
    this.time += dt; this.world.timestep = dt;
    for (const entry of this.bodies) {
      entry.prev.copy(entry.current); entry.prevQ.copy(entry.currentQ); entry.previousVelocity.copy(entry.body.linvel());
    }
    this.world.step(this.events);
    this.events.drainContactForceEvents(event => {
      const a = this.byCollider.get(event.collider1()), b = this.byCollider.get(event.collider2());
      // Only dynamic-to-static impacts can request voxel damage.
      const entry = a && !b ? a : b && !a ? b : null;
      if (!entry || this.time - entry.lastImpact < 0.7 || entry.previousVelocity.lengthSq() < 16) return;
      if (event.totalForceMagnitude() * dt < entry.body.mass() * 1.1) return;
      entry.lastImpact = this.time;
      this.impactEvents.push({ origin: entry.prev.toArray(), velocity: entry.previousVelocity.toArray(),
        reach: entry.radius + entry.previousVelocity.length() * dt + 0.25, radius: Math.min(0.7, Math.max(0.3, entry.radius * 0.7)) });
    });
    for (const entry of [...this.bodies]) {
      entry.current.copy(entry.body.translation()); entry.currentQ.copy(entry.body.rotation());
      if (entry.current.y < -18 || (this.debrisSeconds > 0 && this.time - entry.born > this.debrisSeconds)) this.remove(entry);
    }
  }
  sync(alpha) {
    for (const entry of this.bodies) {
      entry.mesh.position.lerpVectors(entry.prev, entry.current, alpha);
      entry.mesh.quaternion.slerpQuaternions(entry.prevQ, entry.currentQ, alpha);
    }
  }
  impulse(entry, direction, speed = 6, point = null) {
    const force = new Vector3().fromArray(direction).normalize().multiplyScalar(entry.body.mass() * speed);
    if (point) entry.body.applyImpulseAtPoint(force, new Vector3().fromArray(point), true);
    else entry.body.applyImpulse(force, true);
  }
  radialImpulse(point, radius, strength = 4) {
    const centre = new Vector3().fromArray(point);
    for (const entry of this.bodies) {
      const delta = entry.current.clone().sub(centre), distance = delta.length();
      if (distance > radius) continue;
      delta.y += 0.35;
      this.impulse(entry, delta.toArray(), strength * (1 - distance / radius));
    }
  }
  remove(entry) {
    if (!entry) return;
    for (const c of entry.colliders) this.byCollider.delete(c.handle);
    this.world.removeRigidBody(entry.body); this.scene.remove(entry.mesh); entry.mesh.geometry.dispose();
    const index = this.bodies.indexOf(entry); if (index >= 0) this.bodies.splice(index, 1);
  }
  clearDynamic() { for (const entry of [...this.bodies]) this.remove(entry); this.impactEvents.length = 0; }
  get awake() { return this.bodies.reduce((n, entry) => n + Number(!entry.body.isSleeping()), 0); }
  get staticCount() { return [...this.staticChunks.values()].reduce((n, list) => n + list.length, 0) + 1; }
  dispose() { this.clearDynamic(); this.clearStatic(); this.events.free(); this.world.free(); }
}
