import { compileActions } from "./cases.mjs";
import { visitConditions } from "./conditions.mjs";
import { SERVICE_IDS } from "./contracts.mjs";

const EFFECTS = new Set([
  "fact",
  "increment",
  "event",
  "penalty",
  "grant",
  "transfer",
  "evidence",
  "entity",
  "job",
  "cancelJob",
  "encounter",
  "cue",
  "transition",
  "resolve",
  "hook",
  "service",
]);
const OPERATORS = new Set([
  "cue",
  "preview",
  "all",
  "any",
  "not",
  "fact",
  "inventory",
  "actor",
  "record",
  "evidence",
  "proximity",
  "scene",
  "encounter",
  "time",
  "outcome",
]);
const ID = /^[a-z][a-z0-9]*(?:[-:][a-z0-9]+)*$/i;

export function parseContentJSON(text, file = "<content>") {
  const result = JSON.parse(text),
    stack = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let end = i + 1;
      while (end < text.length) {
        if (text[end] === "\\") {
          end += 2;
          continue;
        }
        if (text[end] === '"') break;
        end++;
      }
      const scope = stack.at(-1);
      if (scope?.object && scope.key) {
        const key = JSON.parse(text.slice(i, end + 1));
        if (scope.keys.has(key))
          throw new Error(
            `${file}:${text.slice(0, i).split("\n").length}: duplicate JSON key '${key}'`,
          );
        scope.keys.add(key);
        scope.key = false;
      }
      i = end;
    } else if (c === "{")
      stack.push({ object: true, key: true, keys: new Set() });
    else if (c === "[") stack.push({ object: false });
    else if (c === "}" || c === "]") stack.pop();
    else if (c === "," && stack.at(-1)?.object) stack.at(-1).key = true;
    else if (c === ":" && stack.at(-1)?.object) stack.at(-1).key = false;
  }
  return result;
}

function merge(base, overrides) {
  const value = structuredClone(base);
  for (const [key, next] of Object.entries(overrides)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error(`Reserved content key '${key}'`);
    value[key] =
      next &&
      typeof next === "object" &&
      !Array.isArray(next) &&
      value[key] &&
      typeof value[key] === "object" &&
      !Array.isArray(value[key])
        ? merge(value[key], next)
        : structuredClone(next);
  }
  return value;
}

export function resolveDefinition(
  definition,
  { prefabs = {}, equipment = {} } = {},
) {
  const expand = (entry, path, chain = []) => {
    if (!entry.prefab) return structuredClone(entry);
    if (!Object.hasOwn(prefabs, entry.prefab))
      throw new Error(`${path}: unknown prefab '${entry.prefab}'`);
    if (chain.includes(entry.prefab))
      throw new Error(
        `${path}: prefab inheritance cycle ${[...chain, entry.prefab].join(" -> ")}`,
      );
    const base = expand(prefabs[entry.prefab], path, [...chain, entry.prefab]);
    delete base.id;
    return merge(base, entry);
  };
  const out = structuredClone(definition);
  out.entities = out.entities.map((e) =>
    expand(e, `${out.id}/entities/${e.id}`),
  );
  if (out.player) out.player = expand(out.player, `${out.id}/player`);
  out.equipment = {
    ...structuredClone(equipment),
    ...structuredClone(out.items || {}),
  };
  return out;
}

/** JSON Schema subset used by the checked-in schemas. Unsupported keywords are never silently enforced. */
export function schemaErrors(value, schema, path = "$", root = schema) {
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/"))
      return [`${path}: only local schema references are supported`];
    const target = schema.$ref
      .slice(2)
      .split("/")
      .reduce((o, k) => o?.[k], root);
    return target
      ? schemaErrors(value, target, path, root)
      : [`${path}: unknown schema ${schema.$ref}`];
  }
  if (schema.anyOf)
    return schema.anyOf.some((s) => !schemaErrors(value, s, path, root).length)
      ? []
      : [`${path}: does not match any supported shape`];
  const errors = [];
  const type = Array.isArray(value)
    ? "array"
    : value === null
      ? "null"
      : typeof value;
  if (
    schema.type &&
    !(Array.isArray(schema.type) ? schema.type : [schema.type]).some(
      (t) => t === type || (t === "integer" && Number.isInteger(value)),
    )
  )
    return [`${path}: expected ${schema.type}, received ${type}`];
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${path}: expected one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${path}: invalid format (${schema.pattern})`);
    if (value.length < (schema.minLength || 0))
      errors.push(`${path}: must not be empty`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path}: must be finite`);
    if (
      value < (schema.minimum ?? -Infinity) ||
      value > (schema.maximum ?? Infinity)
    )
      errors.push(`${path}: outside supported range`);
  }
  if (type === "array") {
    if (value.length < (schema.minItems || 0))
      errors.push(`${path}: expected at least ${schema.minItems} items`);
    if (schema.items)
      value.forEach((item, i) =>
        errors.push(...schemaErrors(item, schema.items, `${path}/${i}`, root)),
      );
  }
  if (type === "object") {
    for (const key of schema.required || [])
      if (!(key in value))
        errors.push(`${path}/${key}: required field is missing`);
    for (const [key, item] of Object.entries(value)) {
      const sub =
        schema.properties?.[key] ||
        (typeof schema.additionalProperties === "object"
          ? schema.additionalProperties
          : null);
      if (sub) errors.push(...schemaErrors(item, sub, `${path}/${key}`, root));
      else if (schema.additionalProperties === false)
        errors.push(`${path}/${key}: unknown field`);
    }
  }
  return errors;
}

export function validateContent(
  definition,
  {
    schema,
    hooks = [],
    animations = [],
    sounds = [],
    file = definition.id || "<case>",
  } = {},
) {
  const errors = schema ? schemaErrors(definition, schema, file) : [];
  const warnings = [];
  const fail = (path, message) => errors.push(`${file}/${path}: ${message}`);
  if (
    !definition.actions ||
    !definition.start ||
    !definition.scoring ||
    !definition.outcomes
  )
    return {
      errors: [...errors, `${file}: incomplete case definition`],
      warnings,
    };
  const ids = new Set();
  for (const e of definition.entities || []) {
    if (!ID.test(e.id || "")) fail("entities", `invalid entity ID ${e.id}`);
    if (ids.has(e.id)) fail("entities", `duplicate entity ID ${e.id}`);
    ids.add(e.id);
  }
  const locations = new Map((definition.locations || []).map((l) => [l.id, l]));
  if (locations.size !== (definition.locations || []).length)
    fail("locations", "duplicate scene IDs");
  const actions = compileActions(definition);
  const facts = new Set(Object.keys(definition.initialFacts || {}));
  const inventory = new Set(Object.keys(definition.inventory || {}));
  const effects = [
    ...Object.values(actions).flatMap((a) => a.effects || []),
    ...Object.values(definition.records || {}).flatMap((r) => r.effects || []),
  ];
  for (const e of effects) {
    if (["fact", "increment"].includes(e.op)) facts.add(e.key);
    if (e.op === "grant") inventory.add(e.item);
  }
  for (const id of Object.keys(definition.evidence || {})) inventory.add(id);
  for (const fact of definition.hookFacts || []) facts.add(fact);
  const ref = (path, value, collection, kind) => {
    if (!collection.has(value)) fail(path, `unknown ${kind} '${value}'`);
  };
  const checkCondition = (condition, path) =>
    visitConditions(
      condition,
      (c, sub) => {
        const at = path + sub;
        if (typeof c === "string") return ref(at, c, facts, "fact");
        if (
          !c ||
          typeof c !== "object" ||
          !Object.keys(c).some((k) => OPERATORS.has(k))
        )
          return fail(at, "unknown condition operation");
        if (c.fact) ref(at, c.fact, facts, "fact");
        if (c.inventory) ref(at, c.inventory.item, inventory, "inventory item");
        if (c.actor && c.actor.id !== "player")
          ref(at, c.actor.id, ids, "actor");
        if (c.record && !definition.records?.[c.record])
          fail(at, `unknown record '${c.record}'`);
        if (c.evidence && !definition.evidence?.[c.evidence])
          fail(at, `unknown exhibit '${c.evidence}'`);
        if (c.scene) ref(at, c.scene, new Set(locations.keys()), "scene");
        if (c.proximity)
          for (const name of [c.proximity.a || "player", c.proximity.b])
            if (name !== "player") ref(at, name, ids, "proximity entity");
        if (c.encounter && !definition.encounters?.[c.encounter])
          fail(at, `unknown encounter '${c.encounter}'`);
        if (c.cue && !definition.cues?.[c.cue])
          fail(at, `unknown cue '${c.cue}'`);
        if (c.preview) ref(at, c.preview, new Set(animations), "preview asset");
      },
      "",
    );
  const checkEffects = (list, path) =>
    list.forEach((e, i) => {
      const at = `${path}/${i}`;
      if (!EFFECTS.has(e.op)) fail(at, `unknown effect '${e.op}'`);
      if (e.op === "entity" && e.id !== "player") ref(at, e.id, ids, "entity");
      if (e.op === "evidence" && !definition.evidence?.[e.id])
        fail(at, `unknown exhibit '${e.id}'`);
      if (e.op === "hook") ref(at, e.id, new Set(hooks), "registered hook");
      if (e.op === "service") ref(at, e.id, new Set(SERVICE_IDS), "service");
      if (["job", "cancelJob"].includes(e.op) && !definition.records?.[e.id])
        fail(at, `unknown record '${e.id}'`);
      if (e.op === "encounter" && !definition.encounters?.[e.id])
        fail(at, `unknown encounter '${e.id}'`);
      if (e.op === "cue" && !definition.cues?.[e.id])
        fail(at, `unknown cue '${e.id}'`);
      if (e.op === "resolve" && !definition.outcomes.some((o) => o.id === e.id))
        fail(at, `unknown outcome '${e.id}'`);
      if (e.op === "transition" && !locations.get(e.scene)?.anchors?.[e.anchor])
        fail(at, `unknown scene anchor '${e.scene}/${e.anchor}'`);
      if (e.op === "penalty" && !(e.category in definition.scoring.categories))
        fail(at, `unknown score category '${e.category}'`);
    });
  for (const [id, a] of Object.entries(actions)) {
    if (!ID.test(id)) fail(`actions/${id}`, "invalid action ID");
    checkCondition(a.requires, `actions/${id}/requires`);
    checkEffects(a.effects || [], `actions/${id}/effects`);
    if (a.at) ref(`actions/${id}/at`, a.at.entity, ids, "interaction anchor");
    if (a.clip)
      ref(`actions/${id}/clip`, a.clip, new Set(animations), "animation asset");
  }
  const triggerIds = new Set();
  for (const trigger of definition.triggers || []) {
    if (triggerIds.has(trigger.id))
      fail(`triggers/${trigger.id}`, "duplicate trigger ID");
    triggerIds.add(trigger.id);
    checkCondition(trigger.when, `triggers/${trigger.id}/when`);
    if (!actions[trigger.action])
      fail(`triggers/${trigger.id}`, `unknown action '${trigger.action}'`);
  }
  for (const [id, guard] of Object.entries(definition.serviceGuards || {})) {
    ref(`serviceGuards/${id}`, id, new Set(SERVICE_IDS), "service");
    checkCondition(guard.requires, `serviceGuards/${id}`);
  }
  for (const [incident, id] of Object.entries(definition.reactions || {}))
    if (!actions[id]) fail(`reactions/${incident}`, `unknown action '${id}'`);
  for (const [id, e] of Object.entries(definition.encounters || {})) {
    for (const actor of e.actors || [])
      ref(`encounters/${id}`, actor, ids, "participant");
    if (e.vehicle) ref(`encounters/${id}`, e.vehicle, ids, "vehicle");
    if (["support", "pursuit"].includes(e.kind) && !e.route?.length)
      fail(`encounters/${id}`, "a traversable route is required");
    for (const [key, value] of Object.entries(e))
      if (key.endsWith("Action") && !actions[value])
        fail(`encounters/${id}/${key}`, `unknown action '${value}'`);
  }
  for (const [id, r] of Object.entries(definition.records || {})) {
    checkCondition(r.requires, `records/${id}/requires`);
    checkEffects(r.effects || [], `records/${id}/effects`);
    if (!Number.isFinite(r.delay) || r.delay < 0)
      fail(`records/${id}`, "delay must be nonnegative simulation seconds");
  }
  for (const e of [definition.start, ...(definition.entities || [])]) {
    const loc = locations.get(e.scene || definition.start.scene);
    if (!loc) {
      fail(`entities/${e.id || "player"}`, `unknown scene '${e.scene}'`);
      continue;
    }
    const { x, y } = e,
      b = loc.bounds || { x: 0, y: 0, w: loc.size.w, h: loc.size.h };
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < b.x ||
      x > b.x + b.w ||
      y < b.y ||
      y > b.y + b.h
    )
      fail(`entities/${e.id || "player"}`, "spawn is outside scene bounds");
    if (
      e.kind !== "anchor" &&
      (loc.buildings || []).some(
        (p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.d,
      )
    )
      fail(`entities/${e.id || "player"}`, "spawn overlaps a solid building");
    const floor = [...(loc.floors || [])]
      .reverse()
      .find((f) => x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.d);
    if (floor?.blocked && e.kind !== "anchor")
      fail(`entities/${e.id || "player"}`, "spawn is on a blocked floor");
    if (e.animation)
      ref(
        `entities/${e.id}/animation`,
        e.animation,
        new Set(animations),
        "animation asset",
      );
    checkCondition(e.visible, `entities/${e.id}/visible`);
    if (e.attachedTo)
      ref(`entities/${e.id}/attachedTo`, e.attachedTo, ids, "parent entity");
    if (e.vehicle)
      ref(`entities/${e.id}/vehicle`, e.vehicle, ids, "occupied vehicle");
    if (
      e.solid &&
      ["prop", "container", "surface"].includes(e.kind) &&
      (!e.w ||
        !e.d ||
        !e.h ||
        (e.x - e.w / 2) % 16 ||
        (e.y - e.d / 2) % 16 ||
        e.w % 16 ||
        e.d % 16)
    )
      fail(
        `entities/${e.id}`,
        "solid footprints need positive dimensions aligned to the 16-unit grid",
      );
  }
  for (const objective of definition.objectives || []) {
    checkCondition(objective.requires, `objectives/${objective.id}/requires`);
    checkCondition(objective.complete, `objectives/${objective.id}/complete`);
    if (objective.target && !["player", "radio"].includes(objective.target))
      ref(`objectives/${objective.id}`, objective.target, ids, "target entity");
    if (objective.onTimeout && !actions[objective.onTimeout])
      fail(
        `objectives/${objective.id}/onTimeout`,
        `unknown action '${objective.onTimeout}'`,
      );
    if (
      objective.deadline !== undefined &&
      !objective.onTimeout &&
      !objective.optional
    )
      fail(
        `objectives/${objective.id}`,
        "required timed objective needs onTimeout recovery",
      );
  }
  for (const outcome of definition.outcomes)
    checkCondition(outcome.when, `outcomes/${outcome.id}`);
  if (!definition.outcomes.some((o) => o.terminal))
    fail("outcomes", "at least one terminal outcome is required");
  const awardIds = new Set();
  for (const award of definition.scoring.awards) {
    if (awardIds.has(award.id))
      fail(`scoring/${award.id}`, "duplicate award ID");
    awardIds.add(award.id);
    if (
      !(award.category in definition.scoring.categories) ||
      !Number.isFinite(award.points) ||
      award.points < 0
    )
      fail(`scoring/${award.id}`, "invalid category or points");
    checkCondition(award.when, `scoring/${award.id}`);
  }
  for (const [category, max] of Object.entries(definition.scoring.categories)) {
    const total = definition.scoring.awards
      .filter((a) => a.category === category)
      .reduce((sum, a) => sum + a.points, 0);
    if (!Number.isFinite(max) || max <= 0 || total !== max)
      fail(
        `scoring/${category}`,
        `awards total ${total}; declared category total is ${max}`,
      );
  }
  for (const [id, dialogue] of Object.entries(definition.dialogues || {})) {
    const nodes = new Set(Object.keys(dialogue.nodes || {}));
    ref(`dialogues/${id}`, dialogue.entry, nodes, "entry node");
    for (const [nodeId, node] of Object.entries(dialogue.nodes || {})) {
      if (node.speaker && node.speaker !== "player")
        ref(`dialogues/${id}/${nodeId}`, node.speaker, ids, "speaker");
      for (const choice of node.choices || []) {
        if (choice.next)
          ref(`dialogues/${id}/${nodeId}`, choice.next, nodes, "dialogue node");
        if (choice.action && !actions[choice.action])
          fail(
            `dialogues/${id}/${nodeId}`,
            `unknown action '${choice.action}'`,
          );
        checkCondition(choice.requires, `dialogues/${id}/${nodeId}/choice`);
      }
    }
    const visit = (node, path = []) => {
      if (path.includes(node)) {
        if (!dialogue.intentionalLoop)
          fail(
            `dialogues/${id}`,
            `unmarked dialogue loop: ${[...path, node].join(" → ")}`,
          );
        return;
      }
      for (const choice of dialogue.nodes?.[node]?.choices || [])
        if (choice.next && nodes.has(choice.next))
          visit(choice.next, [...path, node]);
    };
    visit(dialogue.entry);
  }
  for (const interaction of definition.interactions || []) {
    if (interaction.entity)
      ref(`interactions/${interaction.id}`, interaction.entity, ids, "entity");
    if (interaction.action && !actions[interaction.action])
      fail(
        `interactions/${interaction.id}`,
        `unknown action '${interaction.action}'`,
      );
    if (interaction.dialogue && !definition.dialogues?.[interaction.dialogue])
      fail(
        `interactions/${interaction.id}`,
        `unknown dialogue '${interaction.dialogue}'`,
      );
    checkCondition(interaction.requires, `interactions/${interaction.id}`);
  }
  for (const [id, cue] of Object.entries(definition.cues || {}))
    for (const step of cue.steps || []) {
      if (step.clip)
        ref(`cues/${id}`, step.clip, new Set(animations), "animation asset");
      if (step.sound)
        ref(`cues/${id}`, step.sound, new Set(sounds), "sound asset");
      if (step.entity && step.entity !== "player")
        ref(`cues/${id}`, step.entity, ids, "cue entity");
    }
  // Optimistic fixed-point analysis proves only obvious deadlocks, not every combination of custom predicates.
  const possible = new Set(Object.keys(definition.initialFacts || {})),
    items = new Set(Object.keys(definition.inventory || {})),
    records = new Set();
  const may = (c) => {
    if (c === undefined || c === true) return true;
    if (c === false) return false;
    if (typeof c === "string") return possible.has(c);
    if (c.all) return c.all.every(may);
    if (c.any) return c.any.some(may);
    if (c.not) return true;
    if (c.fact) return possible.has(c.fact);
    if (c.inventory) return items.has(c.inventory.item);
    if (c.record) return records.has(c.record);
    return true;
  };
  const reachable = new Set();
  for (
    let pass = 0;
    pass <= Object.keys(actions).length + effects.length;
    pass++
  ) {
    const size = possible.size + items.size + records.size + reachable.size;
    const add = (list) => {
      for (const e of list || []) {
        if (["fact", "increment"].includes(e.op)) possible.add(e.key);
        if (e.op === "grant") items.add(e.item);
        if (e.op === "job") {
          records.add(e.id);
          add(definition.records[e.id]?.effects);
        }
        if (e.op === "evidence" && e.operation === "bag") items.add(e.id);
        if (e.op === "hook")
          for (const f of definition.hookFacts || []) possible.add(f);
      }
    };
    for (const [id, a] of Object.entries(actions))
      if (may(a.requires)) {
        reachable.add(id);
        add(a.effects);
      }
    if (size === possible.size + items.size + records.size + reachable.size)
      break;
  }
  for (const [id, a] of Object.entries(actions))
    if (!reachable.has(id) && !a.developmentOnly)
      fail(
        `actions/${id}`,
        "unreachable prerequisites (or custom reachability needs an explicit hook contract)",
      );
  for (const outcome of definition.outcomes)
    if (!may(outcome.when))
      fail(
        `outcomes/${outcome.id}`,
        "terminal outcome has no reachable producer",
      );
  if (effects.some((e) => e.op === "hook"))
    warnings.push(
      `${file}: custom hook effects require behavioral tests; static validation cannot prove their semantics.`,
    );
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
