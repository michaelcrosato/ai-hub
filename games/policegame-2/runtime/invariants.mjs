import { test } from "./conditions.mjs";

export function assertCaseInvariants(definition, state) {
  for (const rule of definition.invariants || [])
    if (state.facts[rule.when] && !test(rule.requires, state))
      throw new Error(`Progress ${rule.when} is inconsistent: ${rule.reason}`);
}

/** Validate relationships as well as shapes. A save must not create a second occupant or lose evidence ownership. */
export function assertWorldState(definition, state) {
  const locations = new Map((definition.locations || []).map((l) => [l.id, l]));
  if (!locations.size) return; // Pure rule definitions may deliberately omit geometry.
  if (!locations.has(state.scene) || state.player.scene !== state.scene)
    throw new Error("The active scene and player scene disagree.");
  const expected = new Map(definition.entities.map((e) => [e.id, e]));
  for (const [id, entity] of Object.entries(state.entities)) {
    if (
      !expected.has(id) ||
      entity.id !== id ||
      entity.kind !== expected.get(id).kind
    )
      throw new Error(`Unknown or incompatible entity ${id}`);
  }
  for (const id of expected.keys())
    if (!state.entities[id]) throw new Error(`Saved entity ${id} is missing.`);
  const subjects = [state.player, ...Object.values(state.entities)];
  for (const entity of subjects) {
    const loc = locations.get(entity.scene);
    if (
      !loc ||
      !Number.isFinite(entity.x) ||
      !Number.isFinite(entity.y) ||
      entity.x < 0 ||
      entity.y < 0 ||
      entity.x > loc.size.w ||
      entity.y > loc.size.h
    )
      throw new Error(`Invalid position or scene for ${entity.id}`);
    if (["person", "vehicle"].includes(entity.kind) || entity.id === "player") {
      if (
        !Number.isFinite(entity.health) ||
        entity.health < 0 ||
        entity.health > 100
      )
        throw new Error(`Invalid health for ${entity.id}`);
      if (
        !entity.vehicle &&
        (loc.buildings || []).some(
          (b) =>
            entity.x > b.x &&
            entity.x < b.x + b.w &&
            entity.y > b.y &&
            entity.y < b.y + b.d,
        )
      )
        throw new Error(`Saved ${entity.id} overlaps a solid building.`);
    }
  }
  const occupants = new Set();
  for (const vehicle of Object.values(state.entities).filter(
    (e) => e.kind === "vehicle",
  )) {
    for (const [seat, id] of Object.entries(vehicle.occupants || {})) {
      const index = seat === "driver" ? 0 : Number(seat.replace("seat-", ""));
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (vehicle.seats || 4) ||
        (seat !== "driver" && (index === 0 || seat !== `seat-${index}`))
      )
        throw new Error(`Invalid seat ${seat} in ${vehicle.id}`);
      const actor = id === "player" ? state.player : state.entities[id];
      if (
        !actor ||
        (id !== "player" && actor.kind !== "person") ||
        actor.handedOver ||
        occupants.has(id)
      )
        throw new Error(`Invalid or duplicate occupant ${id}`);
      if (
        actor.vehicle !== vehicle.id ||
        actor.seat !== seat ||
        actor.scene !== vehicle.scene
      )
        throw new Error(`Occupancy links disagree for ${id}`);
      occupants.add(id);
    }
  }
  for (const actor of subjects) {
    if (actor.vehicle && !occupants.has(actor.id))
      throw new Error(`Missing vehicle seat for ${actor.id}`);
    if (actor.custody?.searched && !actor.custody?.restrained)
      throw new Error(`Search without restraints for ${actor.id}`);
    if (actor.custody?.cautioned && !actor.custody?.restrained)
      throw new Error(`Caution without custody for ${actor.id}`);
    if (
      actor.handedOver &&
      (!actor.custody?.searched || !actor.custody?.cautioned || actor.vehicle)
    )
      throw new Error(`Incomplete handoff for ${actor.id}`);
  }
  const holderExists = (holder) =>
    ["player", "scene", "notebook"].includes(holder) ||
    expected.has(holder) ||
    (definition.holders || []).includes(holder) ||
    (holder.startsWith("safekeeping:") && expected.has(holder.slice(12))) ||
    (holder.startsWith("facility:") && expected.has(holder.slice(9)));
  for (const [id, item] of Object.entries(state.inventory))
    if (
      !item ||
      typeof item.holder !== "string" ||
      !holderExists(item.holder) ||
      !Number.isInteger(item.count) ||
      item.count < 0
    )
      throw new Error(`Invalid holder or count for item ${id}`);
  for (const [id, entry] of Object.entries(state.evidence)) {
    if (
      !definition.evidence[id] ||
      typeof entry.holder !== "string" ||
      !holderExists(entry.holder)
    )
      throw new Error(`Unknown exhibit or holder ${id}`);
    if (
      !["scene", "notebook"].includes(entry.holder) &&
      state.inventory[id]?.holder !== entry.holder
    )
      throw new Error(`Evidence and inventory ownership disagree for ${id}`);
  }
  for (const [id, spec] of Object.entries(definition.evidence)) {
    const facts = spec.facts || { seen: `${id}:seen`, bag: `${id}:bag` };
    if (state.facts[facts.seen] && !state.evidence[id]?.observed)
      throw new Error(`Observation has no evidence record for ${id}`);
    if (
      state.facts[facts.bag] &&
      (!state.evidence[id] || state.evidence[id].holder === "scene")
    )
      throw new Error(`Collected exhibit ${id} is still at the scene.`);
  }
  for (const [id, job] of Object.entries(state.jobs))
    if (
      !definition.records?.[id] ||
      !["pending", "failed"].includes(job.status) ||
      (job.status === "pending" &&
        (!Number.isFinite(job.remaining) || job.remaining < 0))
    )
      throw new Error(`Invalid pending record ${id}`);
  for (const id of Object.keys(state.records))
    if (!definition.records?.[id])
      throw new Error(`Unknown saved record ${id}`);
  for (const [id, encounter] of Object.entries(state.encounters)) {
    const spec = definition.encounters?.[id];
    if (
      !spec ||
      encounter.id !== id ||
      spec.kind !== encounter.kind ||
      ![
        "active",
        "arrived",
        "cornered",
        "escaped",
        "caught",
        "surrendered",
        "stuck",
        "recalled",
        "cancelled",
      ].includes(encounter.phase)
    )
      throw new Error(`Unknown or invalid encounter ${id}`);
    if (
      !Number.isFinite(encounter.elapsed) ||
      encounter.elapsed < 0 ||
      !Number.isInteger(encounter.routeIndex) ||
      encounter.routeIndex < 0
    )
      throw new Error(`Invalid encounter timing ${id}`);
    if (
      encounter.phase === "active" &&
      encounter.route?.length &&
      encounter.routeIndex >= encounter.route.length
    )
      throw new Error(`Invalid active route index ${id}`);
    for (const actor of encounter.actors || [])
      if (!expected.has(actor))
        throw new Error(`Missing encounter participant ${actor}`);
  }
}
