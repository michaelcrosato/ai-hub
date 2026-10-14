import { logEvent } from "./state.mjs";

export class VehicleService {
  constructor(runtime, world) {
    this.runtime = runtime;
    this.world = world;
  }
  get state() {
    return this.runtime.state;
  }
  get(id) {
    const v = this.state.entities[id];
    if (!v || v.kind !== "vehicle") throw new Error(`Unknown vehicle: ${id}`);
    return v;
  }
  enter(id, actorId = "player", seat = "driver") {
    const v = this.get(id),
      actor =
        actorId === "player" ? this.state.player : this.state.entities[actorId];
    if (
      !actor ||
      actor.scene !== v.scene ||
      !this.world.isPresent(v) ||
      !this.world.canSee(actor, v) ||
      Math.hypot(actor.x - v.x, actor.y - v.y) > 62
    )
      throw new Error("Approach the vehicle first.");
    if (actor.vehicle)
      throw new Error("This occupant is already in a vehicle.");
    if (seat === "driver" && !this.runtime.satisfies(v.requires))
      throw new Error(
        v.blocked || "Complete the vehicle's preparation requirements first.",
      );
    if (v.locked) throw new Error("The vehicle is locked.");
    if (
      seat === "driver" &&
      v.allowedDrivers &&
      !v.allowedDrivers.includes(actorId)
    )
      throw new Error("You do not have possession of this vehicle.");
    if (Math.abs(v.speed || 0) > 8)
      throw new Error("Stop the vehicle before boarding.");
    const seatIndex = seat === "driver" ? 0 : Number(seat.replace("seat-", ""));
    if (
      !Number.isInteger(seatIndex) ||
      seatIndex < 0 ||
      seatIndex >= (v.seats || 4) ||
      (seat !== "driver" && (seatIndex === 0 || seat !== `seat-${seatIndex}`))
    )
      throw new Error("That seat does not exist.");
    v.occupants ||= {};
    if (v.occupants[seat]) throw new Error("That seat is occupied.");
    v.occupants[seat] = actorId;
    Object.assign(actor, { vehicle: id, seat, x: v.x, y: v.y });
    logEvent(
      this.state,
      "Vehicle occupied",
      `${actor.label || "Officer"} is seated in ${v.label || id}.`,
      { entity: id },
    );
  }
  exit(actorId = "player") {
    const actor =
      actorId === "player" ? this.state.player : this.state.entities[actorId];
    if (!actor?.vehicle) throw new Error("This person is already outside.");
    const v = this.get(actor.vehicle);
    if (Math.abs(v.speed || 0) > 8)
      throw new Error("Slow to a stop before stepping out.");
    const p = [-Math.PI / 2, Math.PI / 2, Math.PI, 0]
      .map((offset) => ({
        x: v.x + Math.cos((v.angle || 0) + offset) * 39,
        y: v.y + Math.sin((v.angle || 0) + offset) * 39,
      }))
      .find((p) => this.world.clearAt(p.x, p.y, 7, v.scene, [actor.id]));
    if (!p)
      throw new Error("Door obstructed. Move the vehicle into a clear area.");
    delete v.occupants[actor.seat];
    delete actor.vehicle;
    delete actor.seat;
    Object.assign(actor, p);
  }
  recover(id) {
    const v = this.get(id),
      p = this.world.nearestAnchor(v);
    if (!p) throw new Error("No recovery anchor is currently clear.");
    Object.assign(v, p, { speed: 0, vx: 0, vy: 0 });
    this.syncOccupants(v);
    logEvent(
      this.state,
      "Vehicle recovered",
      `${v.label || id} is parked at the nearest clear recovery point.`,
    );
  }
  drive(id, controls, dt) {
    const v = this.get(id),
      E = this.world.adapter.E;
    const throttle = E.clamp(controls.throttle || 0, 0, 1),
      brake = E.clamp(controls.brake || 0, 0, 1);
    v.angle ||= 0;
    v.speed ||= 0;
    const target = throttle
      ? throttle * (v.maxSpeed || 155)
      : brake
        ? -brake * (v.reverseSpeed || 55)
        : 0;
    const acceleration =
      brake && v.speed > 0
        ? 170
        : throttle || brake
          ? v.acceleration || 70
          : 45;
    v.speed = E.approach(v.speed, target, dt * acceleration);
    if (controls.direction)
      v.angle = E.approachAng(
        v.angle,
        Math.atan2(controls.direction[1], controls.direction[0]),
        dt * (v.turnRate || 2.5),
      );
    else
      v.angle +=
        E.clamp(controls.steer || 0, -1, 1) *
        dt *
        (v.turnRate || 1.9) *
        E.clamp(Math.abs(v.speed) / 40, 0.15, 1.4) *
        (v.speed < -3 ? -1 : 1);
    const result = this.world.move(
      v,
      Math.cos(v.angle) * v.speed,
      Math.sin(v.angle) * v.speed,
      dt,
      { ignore: Object.values(v.occupants || {}) },
    );
    if (result.hit) {
      if (
        Math.abs(v.speed) > 60 &&
        this.state.seconds > (v.nextCollisionReport || 0)
      ) {
        v.nextCollisionReport = this.state.seconds + 2;
        logEvent(
          this.state,
          "Vehicle collision",
          "Stop and check the surroundings. Vehicle recovery is available.",
          { entity: id, incident: "collision" },
        );
      }
      v.speed *= 0.35;
    }
    this.syncOccupants(v);
    return result;
  }
  syncOccupants(v) {
    for (const id of Object.values(v.occupants || {})) {
      const actor =
        id === "player" ? this.state.player : this.state.entities[id];
      if (actor)
        Object.assign(actor, {
          x: v.x,
          y: v.y,
          scene: v.scene,
          facing: v.angle,
        });
    }
  }
  tick(dt) {
    for (const v of Object.values(this.state.entities).filter(
      (e) =>
        e.kind === "vehicle" &&
        e.active !== false &&
        e.route?.length &&
        e.occupants?.driver !== "player",
    )) {
      if (v.trafficState === "stopped") {
        v.speed = 0;
        continue;
      }
      const dest =
        v.trafficState === "pulling-over"
          ? v.pullOver
          : v.route[v.routeIndex || 0];
      if (!dest) continue;
      if (Math.hypot(dest.x - v.x, dest.y - v.y) < 8) {
        if (v.trafficState === "pulling-over") {
          v.trafficState = "stopped";
          v.speed = 0;
          logEvent(
            this.state,
            "Vehicle stopped",
            `${v.label || v.id} has pulled over safely.`,
            { entity: v.id },
          );
        } else v.routeIndex = ((v.routeIndex || 0) + 1) % v.route.length;
        continue;
      }
      const result = this.world.toward(v, dest, dt, v.routeSpeed || 40);
      v.speed = result.moved / dt;
      v.angle = v.facing;
      this.syncOccupants(v);
    }
  }
  pullOver(id) {
    const v = this.get(id),
      p = this.state.player,
      patrol = p.vehicle && this.get(p.vehicle);
    if (v.scene !== p.scene || Math.hypot(v.x - p.x, v.y - p.y) > 180)
      throw new Error("Move within signaling distance of the vehicle.");
    if (!patrol?.siren)
      throw new Error("Activate the patrol vehicle warning lights first.");
    if (!v.pullOver)
      throw new Error("This vehicle has no authored safe stopping point.");
    v.trafficState = "pulling-over";
    logEvent(
      this.state,
      "Pull-over requested",
      `${v.label || id} is finding its designated safe stopping point.`,
      { entity: id },
    );
  }
}
