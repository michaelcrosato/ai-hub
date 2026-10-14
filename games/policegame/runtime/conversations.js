/** Conversations persist independently of the UI. Nodes and choices are stable IDs. */
export function conversationView(state, definition, id, condition) {
  const conversation = (definition.conversations || []).find((entry) => entry.id === id);
  if (!conversation) throw new Error(`Unknown conversation '${id}'`);
  const saved = state.conversation?.[id];
  const node = conversation.nodes.find((entry) => entry.id === (saved?.node || conversation.start));
  return {
    id, node: node.id, speaker: node.speaker || conversation.speaker,
    text: node.text, ended: !!saved?.ended || !!node.end,
    choices: (node.choices || []).filter((choice) => condition(choice.visibleWhen))
      .map((choice) => ({ id: choice.id, label: choice.label,
        disabled: !condition(choice.when), reason: choice.reason || "A step comes first." })),
  };
}
export function startConversation(state, definition, id, apply) {
  const conversation = (definition.conversations || []).find((entry) => entry.id === id);
  if (!conversation) throw new Error(`Unknown conversation '${id}'`);
  state.conversation ||= {};
  if (!state.conversation[id]) {
    state.conversation[id] = { node: conversation.start, visited: [], ended: false };
    enterNode(state, conversation, id, apply);
  }
}
function enterNode(state, definition, id, apply) {
  const saved = state.conversation[id];
  const node = definition.nodes.find((entry) => entry.id === saved.node);
  if (!node) throw new Error(`Conversation '${id}' has no node '${saved.node}'`);
  if (!saved.visited.includes(node.id)) {
    apply(node.effects);
    saved.visited.push(node.id);
  }
  saved.ended = !!node.end;
}
export function chooseConversation(state, definition, id, choiceId, condition, apply) {
  startConversation(state, definition, id, apply);
  const saved = state.conversation[id];
  const conversation = definition.conversations.find((entry) => entry.id === id);
  const node = conversation.nodes.find((entry) => entry.id === saved.node);
  const choice = (node.choices || []).find((entry) => entry.id === choiceId);
  if (saved.ended || !choice || !condition(choice.visibleWhen) || !condition(choice.when))
    return { ok: false, reason: choice?.reason || "That conversation choice is unavailable." };
  apply(choice.effects);
  if (choice.to) {
    saved.node = choice.to;
    enterNode(state, conversation, id, apply);
  }
  if (choice.end) saved.ended = true;
  return { ok: true, ...conversationView(state, definition, id, condition) };
}
