import { initialState, clone, finite, SAVE_VERSION } from "./state.mjs";
import { test } from "./conditions.mjs";
import { PHOTO_LIMIT, validPhoto } from "./evidence.mjs";
import { assertWorldState } from "./invariants.mjs";
import { releaseCueAttachments } from "./presentation.mjs";

function knownFacts(definition) {
  const facts = new Set(Object.keys(definition.initialFacts || {}));
  for (const action of Object.values(definition.actions || {}))
    for (const effect of action.effects || [])
      if (["fact", "increment"].includes(effect.op)) facts.add(effect.key);
  for (const record of Object.values(definition.records || {}))
    for (const effect of record.effects || [])
      if (["fact", "increment"].includes(effect.op)) facts.add(effect.key);
  for (const [id, e] of Object.entries(definition.evidence || {}))
    for (const key of Object.values(
      e.facts || { seen: `${id}:seen`, photo: `${id}:photo`, bag: `${id}:bag` },
    ))
      facts.add(key);
  for (const fact of definition.hookFacts || []) facts.add(fact);
  return facts;
}

function cleanFacts(definition, input, warnings) {
  const facts = {},
    known = knownFacts(definition);
  for (const [key, value] of Object.entries(input || {})) {
    if (
      !known.has(key) ||
      !["boolean", "number", "string"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value))
    ) {
      warnings.push(`Ignored unknown or invalid fact: ${key}`);
      continue;
    }
    facts[key] = value;
  }
  return facts;
}

export function restoreState(definition, saved, options = {}) {
  const fresh = () => initialState(definition, options.seed);
  const warnings = [];
  const legacy =
    saved?.casefile?.version === 1
      ? saved.casefile
      : saved?.version === 1
        ? saved
        : null;
  let state = fresh();
  let compatible = true;
  if (legacy && !definition.legacy)
    return {
      state,
      compatible: false,
      warnings: [
        "This case has no migration for version-1 saves. Start a new case.",
      ],
    };
  if (legacy) {
    state.facts = cleanFacts(definition, legacy.flags, warnings);
    state.seconds = Math.max(0, finite(legacy.seconds));
    for (const count of definition.legacy?.counts || [])
      if (test(count.when, state))
        state.facts[count.fact] = Math.min(
          count.max,
          Math.max(count.min, finite(legacy[count.source], count.min)),
        );
    state.events = Array.isArray(legacy.log)
      ? legacy.log
          .filter(
            (e) =>
              e && typeof e.title === "string" && typeof e.text === "string",
          )
          .slice(-500)
          .map((e) => ({ ...e, time: Math.max(0, finite(e.time)) }))
      : [];
    state.penalties = Array.isArray(legacy.penalties)
      ? legacy.penalties
          .filter(
            (p) =>
              p &&
              p.category in definition.scoring.categories &&
              Number.isFinite(p.points) &&
              p.points > 0 &&
              p.points <= 5,
          )
          .slice(0, 20)
      : [];
    for (const grant of definition.legacy?.inventory || [])
      if (test(grant.when, state))
        for (const item of grant.items)
          state.inventory[item] = { holder: "player", count: 1 };
    for (const [id, spec] of Object.entries(definition.evidence || {})) {
      if (!state.facts[spec.facts?.seen]) continue;
      const holder = state.facts[spec.facts.bag] ? "player" : "scene";
      state.evidence[id] = {
        observed: true,
        holder,
        photos: [],
        legacyPhoto: !!state.facts[spec.facts.photo],
        history: [
          {
            operation: "migrated",
            handler: "unknown",
            scene: state.scene,
            time: state.seconds,
          },
        ],
      };
      if (holder === "player") state.inventory[id] = { holder, count: 1 };
    }
    if (Object.values(state.evidence).some((e) => e.legacyPhoto))
      warnings.push(
        "Legacy photograph flags have no image artifact. The notebook identifies these as unavailable legacy photographs.",
      );
    for (const [source, id] of Object.entries(
      definition.legacy?.positions || {},
    )) {
      const entity = id === "player" ? state.player : state.entities[id],
        value = saved[source];
      if (entity && Number.isFinite(value?.x) && Number.isFinite(value?.y))
        Object.assign(entity, clone(value));
    }
  } else if (
    saved?.version === SAVE_VERSION &&
    saved.caseId === definition.id &&
    saved.contentVersion === definition.contentVersion
  ) {
    try {
      state = {
        ...state,
        ...clone(saved),
        facts: cleanFacts(definition, saved.facts, warnings),
      };
      for (const key of [
        "inventory",
        "evidence",
        "records",
        "jobs",
        "encounters",
        "entities",
        "checkpoints",
      ])
        if (
          !state[key] ||
          Array.isArray(state[key]) ||
          typeof state[key] !== "object"
        )
          throw new Error(`Invalid ${key}`);
      for (const key of ["events", "penalties", "consumed", "commandLog"])
        if (!Array.isArray(state[key])) throw new Error(`Invalid ${key}`);
      if (
        !state.player ||
        !Number.isFinite(state.player.x) ||
        !Number.isFinite(state.player.y)
      )
        throw new Error("Invalid player position");
      if (state.contentHash !== fresh().contentHash)
        warnings.push(
          "Content changed: the checkpoint was revalidated against the current definition.",
        );
      if (state.activeAction || state.cue)
        warnings.push(
          "Interrupted presentation cancelled safely. Repeat the action to complete it; completed effects are retained once.",
        );
      state.activeAction = null;
      releaseCueAttachments(state);
      state.cue = null;
      delete state.pendingControl;
      state.seconds = Math.max(0, finite(state.seconds));
      if (
        state.dialogue &&
        !definition.dialogues?.[state.dialogue.id]?.nodes?.[state.dialogue.node]
      ) {
        state.dialogue = null;
        warnings.push(
          "The saved dialogue node is unavailable; the next conversation starts at its entry node.",
        );
      }
      let photoCount = 0;
      for (const [id, item] of Object.entries(state.evidence)) {
        if (
          !definition.evidence?.[id] ||
          !Array.isArray(item.history) ||
          !Array.isArray(item.photos)
        )
          throw new Error(`Invalid exhibit: ${id}`);
        item.photos = item.photos.filter((photo) => {
          const valid = ++photoCount <= PHOTO_LIMIT && validPhoto(photo);
          if (!valid) warnings.push(`Discarded unavailable photo for ${id}`);
          return valid;
        });
      }
    } catch (e) {
      state = fresh();
      compatible = false;
      warnings.push(
        `The save could not be restored (${e.message}). A fresh case is ready.`,
      );
    }
  } else {
    compatible = false;
    warnings.push(
      "The save version or case is incompatible. A fresh case is ready; the original storage entry is not overwritten until you save.",
    );
  }
  // Remove contradictions to a fixed point. Never manufacture prerequisites or a successful outcome.
  for (let pass = 0; pass <= (definition.invariants || []).length; pass++) {
    let changed = false;
    for (const rule of definition.invariants || []) {
      if (state.facts[rule.when] && !test(rule.requires, state)) {
        delete state.facts[rule.when];
        warnings.push(
          `Removed inconsistent progress ${rule.when}: ${rule.reason}`,
        );
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const [id, spec] of Object.entries(definition.evidence || {})) {
    const facts = spec.facts || {
      seen: `${id}:seen`,
      photo: `${id}:photo`,
      bag: `${id}:bag`,
    };
    if (state.evidence[id] && !state.facts[facts.seen]) {
      delete state.evidence[id];
      delete state.inventory[id];
    }
    if (
      state.facts[facts.photo] &&
      state.evidence[id] &&
      !state.evidence[id].legacyPhoto &&
      !state.evidence[id].photos.length
    ) {
      delete state.facts[facts.photo];
      warnings.push(
        `The photograph for ${id} is unavailable; its photo credit was removed.`,
      );
    }
  }
  if (legacy) migrateLegacyWorld(definition, state, saved, warnings);
  try {
    assertWorldState(definition, state);
  } catch (e) {
    state = fresh();
    compatible = false;
    warnings.push(
      `The saved world is inconsistent (${e.message}). A fresh case is ready.`,
    );
  }
  const outcome = definition.outcomes.find((o) => o.id === state.outcome);
  if (state.outcome && (!outcome || !test(outcome.when, state))) {
    state.outcome = null;
    warnings.push("Removed an unsupported case outcome.");
  }
  if (!state.outcome)
    state.outcome =
      definition.outcomes.find((o) => o.terminal && test(o.when, state))?.id ||
      null;
  return { state, warnings, compatible };
}

export function checkpoint(runtime, id) {
  if (typeof id !== "string" || !id.length || id.length > 96)
    throw new Error("Checkpoint IDs must be between 1 and 96 characters.");
  if (
    !runtime.state.checkpoints[id] &&
    Object.keys(runtime.state.checkpoints).length >= 16
  )
    throw new Error(
      "The case supports 16 named checkpoints. Reuse an existing checkpoint ID.",
    );
  const snapshot = runtime.serialize();
  snapshot.checkpoints = {};
  runtime.state.checkpoints[id] = snapshot;
  return { ok: true, id };
}

/** Only explicit migration rules may derive world state from an older case's validated facts. */
function migrateLegacyWorld(definition, state, saved, warnings) {
  const mapping = definition.legacy || {};
  for (const rule of mapping.entities || [])
    if (test(rule.when, state)) {
      const actor = state.entities[rule.id];
      if (!actor) continue;
      const custody = { ...(actor.custody || {}), ...(rule.set.custody || {}) };
      Object.assign(actor, clone(rule.set));
      if (Object.keys(custody).length) actor.custody = custody;
      Object.assign(state.facts, rule.facts || {});
    }
  for (const rule of mapping.records || [])
    if (test(rule.when, state) && definition.records?.[rule.id])
      state.records[rule.id] = {
        status: "ready",
        result: clone(definition.records[rule.id].result),
        time: state.seconds,
        migrated: true,
      };
  for (const rule of mapping.records || [])
    if (test(rule.when, state)) Object.assign(state.facts, rule.facts || {});
  for (const rule of mapping.transfers || [])
    if (test(rule.when, state))
      for (const id of rule.items) {
        if (!state.inventory[id]) continue;
        state.inventory[id].holder = rule.holder;
        if (state.evidence[id]) {
          state.evidence[id].holder = rule.holder;
          state.evidence[id].history.push({
            operation: "migrated-transfer",
            handler: "unknown",
            holder: rule.holder,
            scene: state.scene,
            time: state.seconds,
          });
        }
      }
  for (const rule of mapping.boarding || [])
    if (rule.sourceFlag ? saved[rule.sourceFlag] : test(rule.when, state)) {
      const vehicle = state.entities[rule.vehicle],
        actor =
          rule.actor === "player" ? state.player : state.entities[rule.actor];
      if (!vehicle || !actor) continue;
      vehicle.occupants ||= {};
      vehicle.occupants[rule.seat] = rule.actor;
      Object.assign(actor, {
        vehicle: vehicle.id,
        seat: rule.seat,
        x: vehicle.x,
        y: vehicle.y,
        scene: vehicle.scene,
      });
    }
  for (const rule of mapping.encounters || [])
    if (test(rule.when, state)) {
      const spec = definition.encounters?.[rule.id];
      if (!spec) continue;
      const snapshot = clone(state);
      snapshot.checkpoints = {};
      state.checkpoints[spec.checkpoint || `encounter:${rule.id}`] = snapshot;
      state.encounters[rule.id] = {
        ...clone(spec),
        id: rule.id,
        phase: rule.phase,
        elapsed: 0,
        routeIndex: 0,
        stuck: 0,
      };
      const vehicle = spec.vehicle && state.entities[spec.vehicle];
      if (vehicle) {
        vehicle.active = true;
        if (rule.phase === "arrived") Object.assign(vehicle, spec.route.at(-1));
      }
      for (const [i, id] of (spec.actors || []).entries()) {
        const actor = state.entities[id];
        actor.active = true;
        if (spec.kind === "pursuit") actor.mode = "flee";
        if (vehicle && rule.phase === "active") {
          const seat = i === 0 ? "driver" : `seat-${i}`;
          vehicle.occupants ||= {};
          vehicle.occupants[seat] = id;
          Object.assign(actor, {
            vehicle: vehicle.id,
            seat,
            x: vehicle.x,
            y: vehicle.y,
            scene: vehicle.scene,
          });
        } else if (vehicle) {
          const offset = spec.params?.arrivalOffsets?.[i] || [
            (i + 1) * 28,
            -32,
          ];
          Object.assign(actor, {
            x: vehicle.x + offset[0],
            y: vehicle.y + offset[1],
          });
        }
      }
      if (rule.phase === "active")
        warnings.push(
          `Migrated v1 encounter ${rule.id}: timing was unavailable, so its authored route restarts with a recovery checkpoint.`,
        );
    }
}

export function restoreCheckpoint(runtime, id) {
  const saved =
    runtime.state.checkpoints[id] || runtime.definition.checkpoints?.[id];
  if (!saved) return runtime.deny(`Checkpoint ${id} is unavailable.`);
  const retained = clone(runtime.state.checkpoints);
  const restored = restoreState(runtime.definition, saved);
  if (!restored.compatible)
    return {
      ...runtime.deny(
        "The checkpoint is incompatible with the current content. Your current state was retained.",
      ),
      warnings: restored.warnings,
    };
  runtime.state = restored.state;
  runtime.state.checkpoints = retained;
  runtime.warnings.push(...restored.warnings);
  return { ok: true, id, warnings: restored.warnings };
}

export function writeSave(storage, key, snapshot) {
  try {
    const persisted = clone(snapshot);
    for (const e of Object.values(persisted.evidence || {}))
      for (const photo of e.photos) photo.storage = "saved";
    // Checkpoints and the input log can reference the same thumbnail. Store its bytes only once.
    const artifacts = {},
      seen = new Map();
    const packed = JSON.parse(
      JSON.stringify(persisted, (name, value) => {
        if (typeof value === "string" && value.startsWith("data:image/")) {
          if (!seen.has(value)) {
            const id = `image-${seen.size}`;
            seen.set(value, id);
            artifacts[id] = value;
          }
          return { $photo: seen.get(value) };
        }
        return value;
      }),
    );
    storage.setItem(
      key,
      JSON.stringify({ storageVersion: 1, state: packed, artifacts }),
    );
    return { ok: true, text: "Case saved" };
  } catch (e) {
    return {
      ok: false,
      text: "Save unavailable · progress and photographs remain in this session only",
      reason: e.message,
    };
  }
}

export function readSave(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key) || "null");
    if (saved?.storageVersion === 1) {
      const snapshot = JSON.parse(JSON.stringify(saved.state), (name, value) =>
        value && typeof value === "object" && "$photo" in value
          ? saved.artifacts?.[value.$photo] || null
          : value,
      );
      return { ok: true, snapshot };
    }
    return { ok: true, snapshot: saved };
  } catch (e) {
    return { ok: false, snapshot: null, reason: e.message };
  }
}
