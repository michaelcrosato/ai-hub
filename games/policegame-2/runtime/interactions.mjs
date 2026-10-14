import { test, explain } from "./conditions.mjs";

export class InteractionService {
  constructor(runtime, world, dialogue) {
    this.runtime = runtime;
    this.world = world;
    this.dialogue = dialogue;
    this.targetIndex = 0;
  }
  all() {
    const state = this.runtime.state;
    return (this.runtime.definition.interactions || [])
      .filter((i) => test(i.visible, state, this.runtime.context))
      .map((i) => {
        const entity = state.entities[i.entity];
        if (
          !entity ||
          !this.world.isPresent(entity) ||
          entity.scene !== state.scene
        )
          return null;
        const distance = Math.hypot(
          entity.x - state.player.x,
          entity.y - state.player.y,
        );
        return { ...i, entity, distance };
      })
      .filter(Boolean);
  }
  nearby() {
    return this.all()
      .filter(
        (i) =>
          i.distance <= (i.range || 48) &&
          this.world.canSee(this.runtime.state.player, i.entity),
      )
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  }
  selected() {
    const list = this.nearby();
    return list.length ? list[this.targetIndex % list.length] : null;
  }
  cycle() {
    this.targetIndex++;
    return this.selected();
  }
  reasons(id) {
    const item = this.all().find((i) => i.id === id);
    if (!item) return ["That target is unavailable in this scene."];
    const reasons = explain(
      item.requires,
      this.runtime.state,
      this.runtime.context,
    );
    if (item.distance > (item.range || 48))
      reasons.push("Move closer to the target.");
    if (!this.world.canSee(this.runtime.state.player, item.entity))
      reasons.push("The view is obstructed.");
    if (item.action) reasons.push(...this.runtime.blocked(item.action));
    return reasons;
  }
  begin(id, payload = {}) {
    if (this.runtime.state.activeAction)
      throw new Error("Finish or cancel the current action first.");
    const reasons = this.reasons(id);
    if (reasons.length) throw new Error(reasons.join(". "));
    const interaction = this.all().find((i) => i.id === id);
    const duration =
      interaction.duration ||
      this.runtime.actions[interaction.action]?.duration;
    if (duration) {
      this.runtime.state.activeAction = {
        id,
        remaining: duration,
        duration,
        clip:
          interaction.clip ||
          this.runtime.actions[interaction.action]?.clip ||
          "Interact",
        payload,
        origin: { ...this.runtime.state.player },
      };
      return { working: true };
    }
    return this.complete(interaction, payload);
  }
  complete(interaction, payload = {}) {
    if (interaction.panel) return { panel: interaction.panel };
    if (interaction.dialogue)
      return { dialogue: this.dialogue.start(interaction.dialogue) };
    if (interaction.evidence) {
      const result = this.runtime.evidence(interaction.evidence, "inspect");
      if (!result.ok) throw new Error(result.text);
      return { evidence: interaction.evidence };
    }
    if (interaction.action) {
      const result = this.runtime.act(interaction.action, payload);
      if (!result.ok) throw new Error(result.text);
      return result;
    }
    return { ok: true, text: interaction.hint || interaction.label };
  }
  cancel() {
    this.runtime.state.activeAction = null;
  }
  schedule(action, payload = {}, after = {}) {
    if (this.runtime.state.activeAction)
      throw new Error("Finish or cancel the current action first.");
    const reasons = this.runtime.blocked(action);
    if (reasons.length) throw new Error(reasons.join(". "));
    const definition = this.runtime.actions[action];
    const duration = definition.duration || 0.01;
    this.runtime.state.activeAction = {
      kind: "action",
      action,
      remaining: duration,
      duration,
      clip: definition.clip || "Interact",
      payload,
      after,
    };
    if (this.runtime.state.dialogue) this.runtime.state.dialogue.open = false;
    return { working: true };
  }
  tick(dt, held = true) {
    const active = this.runtime.state.activeAction;
    if (!active) return null;
    if (active.kind === "action") {
      const reasons = this.runtime.blocked(active.action);
      if (reasons.length) {
        this.cancel();
        return { cancelled: true, text: reasons.join(". ") };
      }
      active.remaining -= dt;
      if (active.remaining > 0) return null;
      this.runtime.state.activeAction = null;
      const result = this.runtime.act(active.action, active.payload);
      if (!result.ok) return result;
      if (active.after?.dialogue) {
        const current = this.runtime.state.dialogue;
        if (current?.id === active.after.dialogue) {
          if (active.after.node) current.node = active.after.node;
          current.open = !active.after.close;
          this.dialogue.remember();
          return { dialogue: this.dialogue.view() };
        }
      }
      return { ...result, ...active.after };
    }
    const interaction = this.all().find((i) => i.id === active.id);
    if (
      !interaction ||
      this.reasons(active.id).length ||
      (interaction.hold && !held)
    ) {
      this.cancel();
      return { cancelled: true };
    }
    active.remaining -= dt;
    if (active.remaining > 0) return null;
    this.runtime.state.activeAction = null;
    return this.complete(interaction, active.payload);
  }
}
