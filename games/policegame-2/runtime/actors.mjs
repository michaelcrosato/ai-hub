import { logEvent } from "./state.mjs";

export class ActorService {
  constructor(runtime, world, vehicles) {
    this.runtime = runtime;
    this.world = world;
    this.vehicles = vehicles;
  }
  get state() {
    return this.runtime.state;
  }
  get(id) {
    const actor = this.state.entities[id];
    if (!actor || actor.kind !== "person")
      throw new Error(`Unknown person: ${id}`);
    return actor;
  }
  close(id, range = 48) {
    const actor = this.get(id),
      p = this.state.player;
    if (
      actor.scene !== p.scene ||
      !this.world.isPresent(actor) ||
      Math.hypot(actor.x - p.x, actor.y - p.y) > range ||
      !this.world.canSee(p, actor)
    )
      throw new Error("Move close with a clear view of the person.");
    return actor;
  }
  tool(id) {
    if (
      this.state.inventory[id]?.holder !== "player" ||
      this.state.inventory[id].count < 1
    )
      throw new Error(`You need ${id} in your field kit.`);
  }
  contact(id) {
    const actor = this.close(id);
    if (actor.mode === "flee")
      throw new Error("Regain contact after the pursuit ends.");
    actor.custody ||= {};
    actor.custody.contact = true;
    actor.facing = Math.atan2(
      this.state.player.y - actor.y,
      this.state.player.x - actor.x,
    );
    this.state.player.facing = actor.facing + Math.PI;
    if (
      !["comply", "restrained", "escort", "incapacitated"].includes(actor.mode)
    )
      actor.mode = "talk";
  }
  restrain(id) {
    const actor = this.close(id);
    this.tool("restraints");
    if (actor.custody?.restrained) return { already: true };
    if (!actor.custody?.contact || actor.mode !== "comply")
      throw new Error(
        "Establish contact and cooperation or control before applying restraints.",
      );
    actor.custody.restrained = true;
    actor.mode = "restrained";
    logEvent(
      this.state,
      "Restraints checked",
      `${actor.label} is secured. Complete the search and caution.`,
      { entity: id },
    );
  }
  search(id) {
    const actor = this.close(id);
    if (!actor.custody?.restrained)
      throw new Error("Secure custody before searching.");
    if (actor.custody.searched) return;
    const found = [];
    for (const [item, record] of Object.entries(this.state.inventory))
      if (record.holder === id) {
        record.holder = `safekeeping:${id}`;
        found.push(item);
        if (this.state.evidence[item]) {
          this.state.evidence[item].holder = record.holder;
          this.state.evidence[item].history.push({
            operation: "custody-search",
            handler: "player",
            scene: actor.scene,
            time: this.state.seconds,
            holder: record.holder,
          });
        }
      }
    actor.custody.searched = true;
    actor.custody.property = found;
    logEvent(
      this.state,
      "Custody search complete",
      found.length
        ? `Property recorded: ${found.join(", ")}.`
        : "No personal items requiring safekeeping were found.",
      { entity: id },
    );
  }
  caution(id) {
    const actor = this.close(id);
    if (!actor.custody?.restrained) throw new Error("Secure custody first.");
    if (actor.custody.cautioned) return;
    actor.custody.cautioned = true;
    logEvent(
      this.state,
      "Caution acknowledged",
      `${actor.label} understands the reason for custody and the right to counsel.`,
      { entity: id },
    );
  }
  escort(id) {
    const actor = this.close(id);
    if (!actor.custody?.searched || !actor.custody?.cautioned)
      throw new Error("Complete the search and caution before escorting.");
    actor.mode = "escort";
    actor.follow = "player";
  }
  seat(id, vehicle, seat = "seat-1") {
    const actor = this.get(id),
      car = this.vehicles.get(vehicle),
      p = this.state.player;
    if (
      actor.mode !== "escort" ||
      !actor.custody?.searched ||
      !actor.custody?.cautioned
    )
      throw new Error("Complete the custody and escort steps first.");
    if (p.scene !== car.scene || Math.hypot(p.x - car.x, p.y - car.y) > 65)
      throw new Error("Approach the vehicle to secure the passenger.");
    if (seat === "driver")
      throw new Error("A detainee must occupy a passenger seat.");
    this.vehicles.enter(vehicle, id, seat);
    actor.custody.transportStart = { x: car.x, y: car.y, scene: car.scene };
    actor.mode = "restrained";
  }
  handoff(id, facility) {
    const actor = this.get(id),
      destination = this.state.entities[facility],
      car = actor.vehicle && this.vehicles.get(actor.vehicle);
    if (actor.handedOver) return { already: true };
    if (!actor.custody?.searched || !actor.custody?.cautioned || !car)
      throw new Error(
        "Complete custody and transport the subject before handoff.",
      );
    if (
      !destination ||
      destination.scene !== car.scene ||
      Math.hypot(destination.x - car.x, destination.y - car.y) > 125
    )
      throw new Error("Bring the transport vehicle to the handoff facility.");
    if (this.state.player.vehicle)
      throw new Error("Park and step out before submitting custody.");
    if (Math.abs(car.speed || 0) > 8)
      throw new Error("Stop the transport vehicle first.");
    delete car.occupants[actor.seat];
    delete actor.vehicle;
    delete actor.seat;
    actor.handedOver = true;
    actor.mode = "idle";
    actor.active = false;
    for (const item of Object.values(this.state.inventory))
      if (item.holder === `safekeeping:${id}`)
        item.holder = `facility:${facility}`;
    for (const exhibit of Object.values(this.state.evidence))
      if (exhibit.holder === `safekeeping:${id}`) {
        exhibit.holder = `facility:${facility}`;
        exhibit.history.push({
          operation: "handoff",
          handler: facility,
          scene: destination.scene,
          time: this.state.seconds,
        });
      }
    logEvent(
      this.state,
      "Custody accepted",
      `${actor.label} and recorded property have been handed over.`,
      { entity: id, facility },
    );
  }
  aid(id) {
    const actor = this.close(id);
    this.tool("first-aid");
    actor.health = Math.max(35, actor.health);
    actor.medical = "assistance-requested";
    if (actor.mode === "incapacitated")
      actor.mode = actor.properties?.recoveryMode || "comply";
    logEvent(
      this.state,
      "Medical assistance requested",
      `${actor.label} has been assessed and stabilized.`,
      { entity: id },
    );
  }
  tick(dt) {
    for (const actor of Object.values(this.state.entities).filter(
      (e) => e.kind === "person" && e.active !== false && !e.vehicle,
    )) {
      actor.vx = actor.vy = 0;
      const props = actor.properties || {};
      if (props.perception && actor.scene === this.state.scene) {
        const sight = this.world.adapter.sees(
          actor,
          this.state.player,
          this.world.map(actor.scene),
          props.perception,
        );
        actor.perception = {
          seen: sight.seen,
          exposure: sight.exposure,
          distance: sight.d,
        };
        if (sight.seen) {
          actor.lastSeen = {
            x: this.state.player.x,
            y: this.state.player.y,
            scene: actor.scene,
          };
          actor.awareness = Math.min(
            1,
            (actor.awareness || 0) + dt * (props.noticeRate || 0.7),
          );
        } else actor.awareness = Math.max(0, (actor.awareness || 0) - dt * 0.2);
        if (
          actor.awareness >= 1 &&
          actor.mode === "patrol" &&
          props.investigate
        )
          actor.mode = "investigate";
      }
      if (actor.mode === "escort" && actor.scene === this.state.player.scene) {
        if (!this.state.player.vehicle)
          this.world.toward(actor, this.state.player, dt, actor.speed || 68, {
            stop: 24,
            ignore: ["player"],
          });
      } else if (actor.mode === "patrol" && actor.route?.length) {
        const dest = actor.route[actor.routeIndex || 0];
        const result = this.world.toward(actor, dest, dt, actor.speed || 42);
        if (result.arrived)
          actor.routeIndex = ((actor.routeIndex || 0) + 1) % actor.route.length;
        actor.pathBlocked = !!result.stuck;
      } else if (actor.mode === "investigate" && actor.lastSeen) {
        if (
          this.world.toward(actor, actor.lastSeen, dt, actor.speed || 48)
            .arrived
        )
          actor.mode = "idle";
      }
    }
  }
}
