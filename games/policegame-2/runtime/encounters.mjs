import { clone, logEvent } from "./state.mjs";
import { checkpoint, restoreCheckpoint } from "./saves.mjs";

export class EncounterService {
  constructor(runtime, world, vehicles) {
    this.runtime = runtime;
    this.world = world;
    this.vehicles = vehicles;
  }
  get state() {
    return this.runtime.state;
  }
  start(id) {
    const spec = this.runtime.definition.encounters[id];
    if (!spec) throw new Error(`Unknown encounter: ${id}`);
    if (this.state.encounters[id]?.phase === "active")
      throw new Error("This encounter is already active.");
    const participants = [...(spec.actors || []), spec.vehicle].filter(Boolean);
    for (const active of Object.values(this.state.encounters).filter(
      (e) => e.phase === "active",
    ))
      if (
        [...(active.actors || []), active.vehicle].some((x) =>
          participants.includes(x),
        )
      )
        throw new Error(
          `An encounter participant is already assigned to ${active.id}.`,
        );
    checkpoint(this.runtime, spec.checkpoint || `encounter:${id}`);
    this.state.encounters[id] = {
      ...clone(spec),
      id,
      phase: "active",
      routeIndex: 0,
      elapsed: 0,
      stuck: 0,
    };
    for (const actorId of spec.actors || []) {
      const actor = this.state.entities[actorId];
      if (!actor) throw new Error(`Missing participant: ${actorId}`);
      actor.active = true;
      actor.mode = spec.kind === "pursuit" ? "flee" : "idle";
    }
    if (spec.vehicle) {
      const v = this.vehicles.get(spec.vehicle);
      v.active = true;
      v.occupants ||= {};
      for (const [index, actorId] of (spec.actors || []).entries()) {
        const seat = index === 0 ? "driver" : `seat-${index}`;
        if (
          index >= (v.seats || 4) ||
          (v.occupants[seat] && v.occupants[seat] !== actorId)
        )
          throw new Error("The support vehicle has no free crew seat.");
        v.occupants[seat] = actorId;
        Object.assign(this.state.entities[actorId], {
          vehicle: v.id,
          seat,
          x: v.x,
          y: v.y,
          scene: v.scene,
        });
      }
    }
    logEvent(
      this.state,
      spec.kind === "support" ? "Support requested" : "Encounter started",
      spec.params?.startText || `${id} is active.`,
      { encounter: id },
    );
  }
  finish(id, phase, text) {
    const e = this.state.encounters[id];
    if (!e || e.phase !== "active") return;
    e.phase = phase;
    for (const actorId of e.actors || []) {
      const a = this.state.entities[actorId];
      if (!a) continue;
      a.vx = a.vy = 0;
      if (e.kind === "pursuit")
        a.mode =
          phase === "surrendered" || phase === "caught" ? "comply" : "idle";
      if (phase === "escaped") a.active = false;
    }
    logEvent(
      this.state,
      phase === "arrived" ? "Support on scene" : `Encounter ${phase}`,
      text || e.params?.[phase + "Text"] || `${id}: ${phase}.`,
      { encounter: id, phase },
    );
    const action = e[phase + "Action"];
    if (action) this.runtime.act(action);
  }
  cancel(id) {
    const e = this.state.encounters[id];
    if (!e || !["active", "arrived"].includes(e.phase))
      throw new Error("That support request is not active.");
    if (e.kind !== "support")
      throw new Error(
        "Use the encounter recovery checkpoint for this encounter.",
      );
    e.phase = "recalled";
    const mover = this.state.entities[e.vehicle || e.actors[0]];
    e.returnRoute = [
      ...clone((e.route || []).slice(0, e.routeIndex)).reverse(),
      { x: mover.origin.x, y: mover.origin.y },
    ];
    e.routeIndex = 0;
    const vehicle = e.vehicle && this.state.entities[e.vehicle];
    if (vehicle)
      for (const [index, id] of (e.actors || []).entries()) {
        const actor = this.state.entities[id],
          seat = index === 0 ? "driver" : `seat-${index}`;
        vehicle.occupants ||= {};
        vehicle.occupants[seat] = id;
        Object.assign(actor, { vehicle: vehicle.id, seat });
      }
    logEvent(
      this.state,
      "Support recalled",
      `${id} is returning to its origin.`,
      { encounter: id },
    );
  }
  resolve(id, mode = "surrendered") {
    const e = this.state.encounters[id];
    if (!e || e.kind !== "pursuit" || e.phase !== "active")
      throw new Error("No active pursuit to resolve.");
    const actor = this.state.entities[e.actors[0]],
      p = this.state.player;
    const range =
      mode === "caught"
        ? e.params?.catchRange || 26
        : e.params?.surrenderRange || 65;
    if (
      actor.scene !== p.scene ||
      Math.hypot(actor.x - p.x, actor.y - p.y) > range ||
      !this.world.canSee(p, actor)
    )
      throw new Error("Regain a clear, close view before attempting control.");
    this.finish(id, mode);
  }
  retry(id) {
    const spec = this.runtime.definition.encounters[id];
    if (!spec) throw new Error("Unknown encounter.");
    const result = restoreCheckpoint(
      this.runtime,
      spec.checkpoint || `encounter:${id}`,
    );
    if (!result.ok) throw new Error(result.text);
    return result;
  }
  tick(dt) {
    for (const encounter of Object.values(this.state.encounters)) {
      if (!["active", "recalled"].includes(encounter.phase)) continue;
      encounter.elapsed += dt;
      if (!["support", "pursuit"].includes(encounter.kind)) continue;
      const mover =
          this.state.entities[encounter.vehicle || encounter.actors[0]],
        route =
          encounter.phase === "recalled"
            ? encounter.returnRoute
            : encounter.route;
      if (!mover || !route?.length) {
        this.finish(
          encounter.id,
          "stuck",
          "The encounter has no valid route. Restore its checkpoint.",
        );
        continue;
      }
      const to = route[encounter.routeIndex];
      const result = this.world.toward(mover, to, dt, encounter.speed || 59, {
        stop: 8,
        ignore: encounter.actors || [],
      });
      if (mover.kind === "vehicle") {
        mover.angle = mover.facing;
        this.vehicles.syncOccupants(mover);
      }
      encounter.stuck = result.stuck ? encounter.stuck + dt : 0;
      if (result.arrived) {
        encounter.routeIndex++;
        if (encounter.routeIndex >= route.length) {
          if (encounter.phase === "recalled") {
            encounter.phase = "cancelled";
            mover.active = false;
            for (const id of encounter.actors || [])
              this.state.entities[id].active = false;
          } else if (encounter.kind === "support") {
            for (const [i, id] of (encounter.actors || []).entries()) {
              const a = this.state.entities[id];
              if (a.vehicle) {
                delete mover.occupants?.[a.seat];
                delete a.vehicle;
                delete a.seat;
              }
              const offset = encounter.params?.arrivalOffsets?.[i] || [
                (i + 1) * 28,
                -32,
              ];
              Object.assign(a, {
                x: mover.x + offset[0],
                y: mover.y + offset[1],
                scene: mover.scene,
                mode: "idle",
              });
            }
            this.finish(encounter.id, "arrived");
          } else
            this.finish(encounter.id, encounter.params?.routeEnd || "escaped");
        }
      }
      if (
        encounter.stuck > (encounter.params?.stuckAfter || 5) &&
        encounter.phase === "active"
      )
        this.finish(
          encounter.id,
          "stuck",
          "The route is obstructed. Restore the encounter checkpoint or choose a different approach.",
        );
      if (encounter.kind === "pursuit" && encounter.escapeVolume) {
        const v = encounter.escapeVolume;
        if (
          mover.x >= v.x &&
          mover.y >= v.y &&
          mover.x <= v.x + v.w &&
          mover.y <= v.y + v.d
        )
          this.finish(encounter.id, "escaped");
      }
    }
  }
}
