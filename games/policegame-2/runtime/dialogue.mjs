import { test, explain } from "./conditions.mjs";

export function selectText(value, runtime) {
  if (!Array.isArray(value)) return value || "";
  return value.find((v) => runtime.satisfies(v.when))?.text || "";
}

export class DialogueService {
  constructor(runtime, world, actors) {
    this.runtime = runtime;
    this.world = world;
    this.actors = actors;
  }
  start(id) {
    const spec = this.runtime.definition.dialogues[id];
    if (!spec) throw new Error(`Unknown dialogue: ${id}`);
    const previous =
      this.runtime.state.dialogue?.id === id
        ? this.runtime.state.dialogue
        : this.runtime.state.dialogueNodes?.[id];
    const entry =
      spec.entries?.find((e) => this.runtime.satisfies(e.when))?.node ||
      spec.entry;
    const node = spec.entries?.length
      ? entry
      : previous?.node
        ? previous.node
        : entry;
    const speaker = spec.nodes[node]?.speaker;
    if (speaker && speaker !== "player" && !spec.remote)
      this.actors.contact(speaker);
    this.runtime.state.dialogue = { id, node, open: true };
    return this.view();
  }
  view() {
    const active = this.runtime.state.dialogue;
    if (!active?.open) return null;
    const spec = this.runtime.definition.dialogues[active.id],
      node = spec.nodes[active.node];
    return {
      ...node,
      title: selectText(node.title, this.runtime),
      text: selectText(node.text, this.runtime),
      id: active.id,
      node: active.node,
      speaker: node.speaker && this.runtime.state.entities[node.speaker],
      choices: node.choices
        .filter((c) => test(c.visible, this.runtime.state))
        .map((c) => ({
          ...c,
          label: selectText(c.label, this.runtime),
          hint: selectText(c.hint, this.runtime),
          reasons: [
            ...explain(c.requires, this.runtime.state, this.runtime.context),
            ...(c.action ? this.runtime.blocked(c.action) : []),
          ],
        })),
    };
  }
  choose(id) {
    const active = this.runtime.state.dialogue,
      view = this.view(),
      choice = view?.choices.find((c) => c.id === id);
    if (!choice) throw new Error("That conversation choice is unavailable.");
    if (choice.reasons.length) throw new Error(choice.reasons.join(". "));
    if (choice.action) {
      const action = this.runtime.actions[choice.action];
      if (action?.duration && this.runtime.context.schedule) {
        this.runtime.context.schedule(
          choice.action,
          {},
          { dialogue: active.id, node: choice.next, close: choice.close },
        );
        return null;
      }
      const result = this.runtime.act(choice.action);
      if (!result.ok) throw new Error(result.text);
    }
    const current = this.runtime.state.dialogue;
    if (!current) return null;
    if (choice.next) current.node = choice.next;
    if (choice.close) current.open = false;
    this.remember();
    return this.view();
  }
  remember() {
    const current = this.runtime.state.dialogue;
    if (!current) return;
    this.runtime.state.dialogueNodes ||= {};
    this.runtime.state.dialogueNodes[current.id] = {
      id: current.id,
      node: current.node,
    };
  }
  close() {
    this.remember();
    if (this.runtime.state.dialogue) this.runtime.state.dialogue.open = false;
  }
}
