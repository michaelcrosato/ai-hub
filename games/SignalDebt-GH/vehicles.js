import {
  Vehicle,
  THREE,
  RAPIER,
  toonMaterial,
  PALETTE,
  setLookLayer,
} from "./pixel-engine.js";
import { createVehicleVisual } from "./models.js";
import {
  clamp,
  distance,
  angleDelta,
  roadRoute,
  segmentHitsRect,
} from "./navigation.js";

const { Mesh, CylinderGeometry, Vector3, Quaternion } = THREE;
export class Ride {
  constructor(
    ctx,
    {
      id,
      at,
      yaw = 0,
      kind = "car",
      color = "orange",
      label = "Serrin Cormorant",
      traffic = false,
    },
  ) {
    Object.assign(this, { ctx, id, kind, label, traffic });
    this.integrity = 100;
    this.occupied = false;
    this.previousSpeed = 0;
    this.cooldown = 0;
    this.upgraded = false;
    this.mesh = createVehicleVisual(kind, color);
    setLookLayer(this.mesh, "actors");
    ctx.scene.add(this.mesh);
    this.vehicle = new Vehicle(ctx.physics, {
      at,
      yaw,
      size: kind === "van" ? [1.05, 0.52, 2.4] : [0.94, 0.36, 2.05],
      mass: kind === "van" ? 14 : 8,
      power: kind === "van" ? 44 : 38,
      topSpeed: kind === "van" ? 20 : 27,
      grip: 2.9,
      steer: 0.58,
      driftYaw: 2.2,
    });
    this.body = this.vehicle.body;
    ctx.physics.bind(this.body, this.mesh);
    this.wheels = [];
    for (let i = 0; i < 4; i++) {
      const wheel = new Mesh(
        new CylinderGeometry(0.36, 0.36, 0.24, 10).rotateZ(Math.PI / 2),
        toonMaterial(PALETTE.ink),
      );
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    }
    this.wp = new Vector3();
    this.wq = new Quaternion();
    this.dustPoint = new Vector3();
    this.dustTimer = 0;
    this.spawn = [...at];
    this.spawnYaw = yaw;
  }
  get speed() {
    return this.vehicle.speed;
  }
  get yaw() {
    return this.vehicle.yaw;
  }
  get position() {
    return this.body.translation();
  }
  drive(
    dt,
    { throttle = 0, steer = 0, brake = false, handbrake = false } = {},
  ) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressure = typeof brake === "number" ? clamp(brake, 0, 1) : 0;
    this.vehicle.drive(
      {
        throttle: this.integrity > 0 ? throttle : 0,
        steer,
        brake: brake === true,
        handbrake,
      },
      dt,
    );
    if (pressure > 0) {
      const v = this.speed,
        impulse =
          -Math.sign(v) *
          Math.min(Math.abs(v), pressure * 18 * dt) *
          this.vehicle.o.mass;
      this.body.applyImpulse(
        {
          x: Math.sin(this.yaw) * impulse,
          y: 0,
          z: Math.cos(this.yaw) * impulse,
        },
        true,
      );
    }
    const speed = Math.abs(this.speed),
      loss = this.previousSpeed - speed;
    this.dustTimer = Math.max(0, this.dustTimer - dt);
    if (handbrake && speed > 4 && this.dustTimer === 0) {
      const p = this.position;
      if (p.y < 1.5) {
        this.dustPoint.set(
          p.x - Math.sin(this.yaw) * 1.6,
          0.15,
          p.z - Math.cos(this.yaw) * 1.6,
        );
        this.ctx.particles.burst("dust", this.dustPoint, { count: 3 });
        this.dustTimer = 0.12;
      }
    }
    if (loss > 6 && this.cooldown <= 0) {
      this.integrity = clamp(this.integrity - loss * 1.2, 0, 100);
      this.cooldown = 0.7;
      this.ctx.particles.burst("impact", this.position);
      this.onCrash?.(loss);
    }
    this.previousSpeed = speed;
  }
  update() {
    for (let i = 0; i < 4; i++) {
      this.vehicle.wheelPose(i, this.wp, this.wq, true);
      this.wheels[i].position.copy(this.wp);
      this.wheels[i].quaternion.copy(this.wq);
    }
  }
  reset(at, yaw = 0) {
    this.vehicle.reset(at, yaw);
    this.previousSpeed = 0;
  }
  repair() {
    this.integrity = 100;
    const p = this.position;
    this.reset([p.x, 1.1, p.z], this.yaw);
  }
  setUpgraded(value) {
    this.upgraded = value;
    this.vehicle.o.power = value ? 49 : this.kind === "van" ? 44 : 38;
    this.vehicle.o.topSpeed = value ? 32 : this.kind === "van" ? 20 : 27;
    this.vehicle.setSuspension(value ? 35 : 28);
  }
  upgrade() {
    this.setUpgraded(true);
  }
  dispose() {
    this.vehicle.dispose();
    this.mesh.removeFromParent();
  }
}

// Traffic uses solid kinematic cars, following the same road network as the player.
export class TrafficCar {
  constructor(
    ctx,
    { at, route, color = "teal", kind = "car", speed = 9, police = false },
  ) {
    Object.assign(this, { ctx, route, speed, police });
    this.index = 0;
    this.heading = 0;
    this.stopped = 0;
    this.mesh = createVehicleVisual(kind, color);
    ctx.scene.add(this.mesh);
    setLookLayer(this.mesh, "actors");
    const wheels = new THREE.Group();
    for (const x of [-1, 1])
      for (const z of [-1.35, 1.35]) {
        const w = new Mesh(
          new CylinderGeometry(0.36, 0.36, 0.22, 8).rotateZ(Math.PI / 2),
          toonMaterial(PALETTE.ink),
        );
        w.position.set(x, -0.35, z);
        wheels.add(w);
      }
    this.mesh.add(wheels);
    this.body = ctx.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        at[0],
        0.85,
        at[2],
      ),
    );
    ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.95, 0.5, 2.1).setFriction(0.2),
      this.body,
    );
    ctx.physics.bind(this.body, this.mesh);
    if (police) {
      const bar = new Mesh(
        new THREE.BoxGeometry(1.3, 0.18, 0.3),
        toonMaterial(PALETTE.red),
      );
      bar.position.y = 0.85;
      this.mesh.add(bar);
      this.bar = bar;
    }
  }
  get position() {
    return this.body.translation();
  }
  tick(dt, target = null, roads = null, blocker = null) {
    if (this.stopped > 0) {
      this.stopped -= dt;
      return;
    }
    const p = this.position;
    if (target && roads) {
      this.repath = (this.repath ?? 0) - dt;
      if (this.repath <= 0) {
        this.route = roadRoute(p, target, roads);
        this.index = 0;
        this.repath = 2.5;
      }
    }
    if (!this.route.length) return;
    let goal = this.route[this.index];
    if (distance(p, goal) < 3) {
      this.index = (this.index + 1) % this.route.length;
      goal = this.route[this.index];
    }
    const desired = Math.atan2(goal.x - p.x, goal.z - p.z);
    this.heading += clamp(
      angleDelta(desired, this.heading),
      -dt * 2.8,
      dt * 2.8,
    );
    let speed = this.speed;
    if (blocker && distance(p, blocker) < 7 && !this.police) speed = 0;
    if (Math.abs(angleDelta(desired, this.heading)) > 1) speed *= 0.3;
    const step = Math.min(speed * dt, distance(p, goal));
    const next = {
      x: p.x + Math.sin(this.heading) * step,
      y: 0.85,
      z: p.z + Math.cos(this.heading) * step,
    };
    const world = this.ctx.engine.game?.world;
    // Rapier kinematic bodies obey authored poses even through fixed walls.
    // Sweep a conservative circle enclosing the 0.95 × 2.1m half-extents,
    // including turning clearance, before submitting the next street-car pose.
    // Pursuers can still reach open alleys, but cannot shortcut through a block.
    const clearance = 2.45,
      limit = (world?.bounds ?? 252) - 4.5;
    const minX = Math.min(p.x, next.x) - clearance,
      maxX = Math.max(p.x, next.x) + clearance,
      minZ = Math.min(p.z, next.z) - clearance,
      maxZ = Math.max(p.z, next.z) + clearance;
    this.blockedByBuilding = !!world?.buildings.some(
      (b) =>
        b.h > 0.5 &&
        b.x + b.w / 2 >= minX &&
        b.x - b.w / 2 <= maxX &&
        b.z + b.d / 2 >= minZ &&
        b.z - b.d / 2 <= maxZ &&
        segmentHitsRect(p, next, b, clearance),
    );
    const blocked =
      this.blockedByBuilding ||
      Math.abs(next.x) > limit ||
      Math.abs(next.z) > limit;
    this.body.setNextKinematicTranslation(
      blocked ? { x: p.x, y: 0.85, z: p.z } : next,
    );
    this.body.setNextKinematicRotation({
      x: 0,
      y: Math.sin(this.heading / 2),
      z: 0,
      w: Math.cos(this.heading / 2),
    });
  }
  update(t) {
    if (this.bar)
      this.bar.material = toonMaterial(
        Math.sin(t * 12) > 0 ? PALETTE.red : PALETTE.cyan,
      );
  }
  dispose() {
    this.ctx.physics.remove(this.body);
    this.mesh.removeFromParent();
  }
}
