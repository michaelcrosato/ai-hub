/** Declarative predicates. World coordinates are ground-plane pixels; time is simulation seconds. */
export function test(condition, state, context = {}) {
  if (condition === undefined || condition === true) return true;
  if (condition === false || condition === null) return false;
  if (typeof condition === "string") return state.facts[condition] === true;
  if (condition.all) return condition.all.every((c) => test(c, state, context));
  if (condition.any) return condition.any.some((c) => test(c, state, context));
  if ("not" in condition) return !test(condition.not, state, context);
  if (condition.fact)
    return compare(state.facts[condition.fact] ?? false, condition);
  if (condition.inventory) {
    const { item, holder = "player", count = 1 } = condition.inventory;
    return (
      state.inventory[item]?.holder === holder &&
      (state.inventory[item]?.count ?? 0) >= count
    );
  }
  if (condition.actor) {
    const { id, state: mode, field } = condition.actor,
      actor = id === "player" ? state.player : state.entities[id];
    return (
      !!actor &&
      (field
        ? compare(
            field
              .split(".")
              .reduce(
                (value, key) =>
                  value !== null &&
                  typeof value === "object" &&
                  Object.hasOwn(value, key)
                    ? value[key]
                    : undefined,
                actor,
              ),
            condition.actor,
          )
        : actor.mode === mode)
    );
  }
  if (condition.record)
    return (
      state.records[condition.record]?.status === (condition.status || "ready")
    );
  if (condition.evidence) {
    const entry = state.evidence[condition.evidence];
    return (
      !!entry &&
      (condition.field
        ? compare(entry[condition.field], condition)
        : !!entry.observed)
    );
  }
  if (condition.proximity) {
    const { a = "player", b, range = 48, sight = false } = condition.proximity;
    const from = a === "player" ? state.player : state.entities[a];
    const to = b === "player" ? state.player : state.entities[b];
    return (
      !!from &&
      !!to &&
      from.scene === to.scene &&
      Math.hypot(from.x - to.x, from.y - to.y) <= range &&
      (!sight || !!context.canSee?.(from, to))
    );
  }
  if (condition.scene) return state.scene === condition.scene;
  if (condition.encounter)
    return state.encounters[condition.encounter]?.phase === condition.phase;
  if ("time" in condition) return compare(state.seconds, condition.time);
  if (condition.outcome) return state.outcome === condition.outcome;
  if (condition.cue) return (state.completedCues?.[condition.cue] || 0) > 0;
  if (condition.preview)
    return state.previewedClips?.[condition.preview] === true;
  throw new Error(`Unknown condition: ${JSON.stringify(condition)}`);
}

function compare(value, condition) {
  if ("equals" in condition) return value === condition.equals;
  if ("gte" in condition)
    return typeof value === "number" && value >= condition.gte;
  if ("lte" in condition)
    return typeof value === "number" && value <= condition.lte;
  if ("in" in condition) return condition.in.includes(value);
  return value === true;
}

/** Diagnostic text is intentionally usable by both the inspector and accessible player controls. */
export function explain(condition, state, context = {}) {
  if (test(condition, state, context)) return [];
  if (typeof condition === "string") return [`Required fact: ${condition}`];
  if (condition?.all)
    return condition.all.flatMap((c) => explain(c, state, context));
  if (condition?.any)
    return [
      `Need one of: ${condition.any.map((c) => explain(c, state, context).join(", ")).join(" / ")}`,
    ];
  if (condition?.not)
    return [`Must no longer be true: ${JSON.stringify(condition.not)}`];
  if (condition?.inventory)
    return [
      `Requires ${condition.inventory.item} held by ${condition.inventory.holder || "player"}`,
    ];
  if (condition?.proximity)
    return [
      `Move within ${condition.proximity.range || 48} units of ${condition.proximity.b}${condition.proximity.sight ? " with a clear view" : ""}`,
    ];
  return [`Not yet satisfied: ${JSON.stringify(condition)}`];
}

export function visitConditions(condition, visit, path = "") {
  if (condition === undefined || typeof condition === "boolean") return;
  visit(condition, path);
  if (condition?.all || condition?.any)
    (condition.all || condition.any).forEach((c, i) =>
      visitConditions(
        c,
        visit,
        `${path}/${condition.all ? "all" : "any"}/${i}`,
      ),
    );
  if (condition?.not !== undefined)
    visitConditions(condition.not, visit, `${path}/not`);
}
