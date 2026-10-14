import { test, explain } from "./conditions.mjs";
import { initialState, clone, logEvent, finite } from "./state.mjs";
import { handleEvidence } from "./evidence.mjs";
import { restoreState } from "./saves.mjs";
import { assertCaseInvariants } from "./invariants.mjs";
import { releaseCueAttachments } from "./presentation.mjs";

export function compileActions(definition) {
  const actions = clone(definition.actions || {});
  for (const [id, e] of Object.entries(definition.evidence || {})) {
    const recordOnly = ["statement", "observation", "comparison"].includes(
      e.kind,
    );
    const facts = e.facts || {
      seen: `${id}:seen`,
      photo: `${id}:photo`,
      bag: `${id}:bag`,
    };
    for (const op of recordOnly ? ["inspect"] : ["inspect", "photo", "bag"]) {
      const fact = facts[{ inspect: "seen", photo: "photo", bag: "bag" }[op]];
      const requires = [e.requires ?? true];
      if (op !== "inspect") requires.push(facts.seen);
      if (op === "photo") requires.push({ not: facts.bag });
      if (op === "photo" || op === "bag")
        requires.push({
          inventory: { item: op === "photo" ? "camera" : "evidence-kit" },
        });
      actions[`evidence:${id}:${op}`] = {
        id: `evidence:${id}:${op}`,
        evidenceId: id,
        evidenceOperation: op,
        once: fact,
        requires: { all: requires },
        at: e.entity
          ? {
              entity: e.entity,
              range: e.range || 48,
              sight: true,
              onFoot: true,
            }
          : undefined,
        duration: op === "inspect" ? 0 : op === "photo" ? 0.65 : 1.25,
        clip: op === "bag" ? "PickUp_Table" : "Interact",
        effects: [
          { op: "evidence", id, operation: recordOnly ? "record" : op },
          { op: "fact", key: fact, value: true },
          ...(recordOnly ? [{ op: "fact", key: facts.bag, value: true }] : []),
        ],
        message: [
          op === "inspect"
            ? e.title
            : `${op === "photo" ? "Scene photograph" : "Exhibit secured"} · ${e.number || id}`,
          op === "inspect"
            ? e.detail
            : op === "photo"
              ? `${e.title} documented in place.`
              : `${e.title} sealed, labeled, and entered into your field record.`,
        ],
      };
    }
  }
  return actions;
}

/** DOM-free authoritative rules. A rejected command never partially applies its effects. */
export class CaseRuntime {
  constructor(definition, saved, options = {}) {
    this.definition = definition;
    this.actions = compileActions(definition);
    this.context = options.context || {};
    this.hooks = options.hooks || {};
    this.listeners = new Set();
    const loaded = saved
      ? restoreState(definition, saved, options)
      : { state: initialState(definition, options.seed), warnings: [] };
    this.state = loaded.state;
    this.warnings = loaded.warnings;
  }
  get flags() {
    return this.state.facts;
  }
  get log() {
    return this.state.events;
  }
  get penalties() {
    return this.state.penalties;
  }
  get seconds() {
    return this.state.seconds;
  }
  set seconds(n) {
    this.state.seconds = Math.max(0, finite(n));
  }
  get chaseCount() {
    return this.state.facts.chaseCount || 0;
  }
  serialize() {
    return clone(this.state);
  }
  deny(text) {
    return { ok: false, title: "A detail to resolve", text };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  satisfies(condition) {
    return test(condition, this.state, this.context);
  }
  blocked(id) {
    const action = Object.hasOwn(this.actions, id) && this.actions[id];
    if (!action) return ["That action is unavailable."];
    const reasons = explain(action.requires, this.state, this.context);
    if (
      action.channel === "radio" &&
      this.state.inventory.radio?.holder !== "player"
    )
      reasons.push("You need the radio in your field kit.");
    if (action.at) {
      const { entity, range = 48, sight = true, onFoot = true } = action.at;
      const target = this.state.entities[entity];
      if (
        target &&
        (target.active === false ||
          target.handedOver ||
          target.vehicle ||
          !test(target.visible, this.state, this.context))
      )
        reasons.push("The target is not available here.");
      reasons.push(
        ...explain(
          { proximity: { b: entity, range, sight } },
          this.state,
          this.context,
        ),
      );
      if (onFoot && this.state.player.vehicle)
        reasons.push("Step out of the vehicle first.");
    }
    return reasons;
  }
  act(id, payload = {}) {
    const action = Object.hasOwn(this.actions, id) && this.actions[id];
    if (!action) return this.deny(`That action is unavailable: ${id}`);
    // Idempotence is independent of score and event count; retries cannot duplicate transfers/jobs.
    if (
      action.once &&
      !(
        action.evidenceOperation === "photo" &&
        this.state.evidence[action.evidenceId]?.legacyPhoto &&
        !this.state.evidence[action.evidenceId]?.photos.length
      ) &&
      (typeof action.once === "string"
        ? this.flags[action.once]
        : this.state.consumed.includes(id))
    )
      return {
        ok: true,
        already: true,
        title: "Already recorded",
        text: "This is in your case notebook.",
      };
    const reasons = this.blocked(id);
    if (reasons.length) return this.deny(action.blocked || reasons.join(". "));
    const before = this.state;
    let next = clone(before);
    try {
      this.state = next;
      for (const effect of action.effects || []) {
        this.apply(this.state, effect, payload);
        next = this.state;
      }
      assertCaseInvariants(this.definition, next);
      if (action.once) next.consumed.push(id);
      let [title, text] = action.message || [
        action.label || id,
        "Recorded in your notebook.",
      ];
      if (action.evidenceOperation === "bag") {
        const exhibit = action.evidenceId,
          entry = next.evidence[exhibit];
        text += entry?.photos?.length
          ? " Scene photograph attached."
          : " No scene photograph: the record notes that omission.";
      }
      logEvent(next, title, text, {
        action: id,
        channel: action.channel || "case",
      });
      next.commandLog.push({ at: before.seconds, id, payload: clone(payload) });
      this.state = next;
      const result = { ok: true, title, text, action: id, cue: action.cue };
      for (const listener of this.listeners) {
        try {
          listener(result);
        } catch (e) {
          this.warnings.push(`Observer failed after ${id}: ${e.message}`);
        }
      }
      return result;
    } catch (e) {
      this.state = before;
      return this.deny(e.message);
    }
  }
  evidence(id, operation, payload) {
    return this.act(`evidence:${id}:${operation}`, payload);
  }
  apply(s, effect, payload) {
    switch (effect.op) {
      case "fact":
        s.facts[effect.key] = clone(effect.value ?? true);
        break;
      case "increment":
        s.facts[effect.key] = (Number(s.facts[effect.key]) || 0) + effect.by;
        break;
      case "event":
        logEvent(s, effect.title, effect.text, {
          channel: effect.channel || "case",
        });
        break;
      case "penalty": {
        const count = s.penalties.filter((p) => p.id === effect.id).length;
        if (count < (effect.max || 1))
          s.penalties.push({
            id: effect.id,
            category: effect.category,
            points: effect.points,
            reason: effect.reason,
          });
        break;
      }
      case "grant":
        s.inventory[effect.item] = {
          holder: effect.holder || "player",
          count: effect.count || 1,
        };
        break;
      case "transfer": {
        const item = s.inventory[effect.item];
        if (!item || (effect.from && item.holder !== effect.from))
          throw new Error(
            `Cannot transfer ${effect.item}: expected holder ${effect.from || "any"}.`,
          );
        item.holder = effect.to;
        if (s.evidence[effect.item])
          handleEvidence(s, this.definition, effect.item, "transfer", {
            holder: effect.to,
          });
        break;
      }
      case "evidence":
        handleEvidence(
          s,
          this.definition,
          effect.id,
          effect.operation,
          payload,
          this.context,
        );
        break;
      case "entity": {
        const entity =
          effect.id === "player" ? s.player : s.entities[effect.id];
        if (!entity) throw new Error(`Unknown entity: ${effect.id}`);
        Object.assign(entity, clone(effect.set));
        break;
      }
      case "job": {
        if (!this.definition.records?.[effect.id])
          throw new Error(`Unknown record: ${effect.id}`);
        if (s.jobs[effect.id] || s.records[effect.id]?.status === "ready")
          break;
        s.jobs[effect.id] = {
          id: effect.id,
          remaining: this.definition.records[effect.id].delay ?? 0,
          status: "pending",
        };
        s.records[effect.id] = { status: "pending" };
        break;
      }
      case "cancelJob": {
        if (s.jobs[effect.id]) {
          delete s.jobs[effect.id];
          s.records[effect.id] = { status: "cancelled" };
        }
        break;
      }
      case "encounter": {
        const spec = this.definition.encounters?.[effect.id];
        if (!spec) throw new Error(`Unknown encounter: ${effect.id}`);
        if (s.encounters[effect.id] && !effect.restart) break;
        s.encounters[effect.id] = {
          ...clone(spec),
          id: effect.id,
          phase: "active",
          elapsed: 0,
          routeIndex: 0,
        };
        break;
      }
      case "cue":
        releaseCueAttachments(s);
        s.cue = { id: effect.id, step: 0, elapsed: 0 };
        break;
      case "transition": {
        const scene = this.definition.locations?.find(
          (l) => l.id === effect.scene,
        );
        const anchor = scene?.anchors?.[effect.anchor];
        if (!anchor)
          throw new Error(
            `Unknown scene anchor: ${effect.scene}/${effect.anchor}`,
          );
        if (s.player.vehicle)
          throw new Error(
            "Step out of the vehicle before entering this location.",
          );
        for (const [id, job] of Object.entries(s.jobs)) {
          if (
            this.definition.records[id]?.cancelOnSceneExit &&
            job.status === "pending"
          ) {
            delete s.jobs[id];
            s.records[id] = { status: "cancelled" };
          }
        }
        s.scene = effect.scene;
        Object.assign(s.player, anchor, { scene: effect.scene });
        s.activeAction = null;
        releaseCueAttachments(s);
        s.cue = null;
        if (s.dialogue) {
          s.dialogueNodes ||= {};
          s.dialogueNodes[s.dialogue.id] = {
            id: s.dialogue.id,
            node: s.dialogue.node,
          };
        }
        s.dialogue = null;
        break;
      }
      case "resolve":
        s.outcome = effect.id;
        s.resolvedAt = s.seconds;
        break;
      case "hook": {
        const hook = this.hooks[effect.id];
        if (!hook) throw new Error(`Unknown behavior hook: ${effect.id}`);
        hook({
          state: s,
          definition: this.definition,
          payload,
          params: clone(effect.params || {}),
          test: (c) => test(c, s, this.context),
        });
        break;
      }
      case "service": {
        if (!this.context.service)
          throw new Error(
            `The ${effect.id} service requires a live simulation.`,
          );
        this.context.service(effect.id, {
          ...payload,
          ...clone(effect.params || {}),
        });
        break;
      }
      default:
        throw new Error(`Unknown effect operation: ${effect.op}`);
    }
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1)
      throw new Error("Simulation step must be between 0 and 1 seconds.");
    this.state.seconds += dt;
    for (const id of Object.keys(this.state.jobs)) {
      const job = this.state.jobs[id];
      if (!job) continue;
      if (job.status === "failed") continue;
      job.remaining -= dt;
      if (job.remaining > 0) continue;
      const spec = this.definition.records[id];
      if (!test(spec.requires, this.state, this.context)) {
        job.remaining = 0;
        continue;
      }
      const before = this.state;
      let next = clone(before);
      try {
        this.state = next;
        next.records[id] = {
          status: "ready",
          result: clone(spec.result),
          time: next.seconds,
        };
        delete next.jobs[id];
        for (const effect of spec.effects || []) {
          this.apply(this.state, effect, {});
          next = this.state;
        }
        assertCaseInvariants(this.definition, next);
        logEvent(
          next,
          spec.title || "Dispatch result",
          spec.text || "The requested record is available.",
          { record: id, channel: "radio" },
        );
        this.state = next;
      } catch (e) {
        this.state = before;
        job.status = "failed";
        job.error = e.message;
        job.remaining = null;
        this.warnings.push(e.message);
      }
    }
  }
  get objectives() {
    return (this.definition.objectives || []).map((o) => ({
      ...o,
      complete: this.satisfies(o.complete),
      available: this.satisfies(o.requires),
      failed:
        o.deadline !== undefined &&
        this.seconds > o.deadline &&
        !this.satisfies(o.complete),
    }));
  }
  get objective() {
    const item = this.objectives.find(
      (o) => o.available && !o.complete && !o.optional && !o.failed,
    );
    return (
      item ||
      this.definition.closedObjective || {
        step: 1,
        title: this.state.outcome ? "Case closed" : "Explore the scene",
        text: "Review your notebook for available leads.",
        target: this.definition.start.target,
      }
    );
  }
  get score() {
    const categories = Object.fromEntries(
      Object.keys(this.definition.scoring.categories).map((k) => [k, 0]),
    );
    for (const award of this.definition.scoring.awards || [])
      if (this.satisfies(award.when))
        categories[award.category] += award.points;
    for (const p of this.penalties)
      if (p.category in categories) categories[p.category] -= p.points;
    for (const [k, max] of Object.entries(this.definition.scoring.categories))
      categories[k] = Math.max(0, Math.min(max, categories[k]));
    return {
      ...categories,
      total: Object.values(categories).reduce((a, b) => a + b, 0),
    };
  }
}
