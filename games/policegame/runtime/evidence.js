/** Evidence lifecycle is content-owned; history is an immutable sequence of facts. */
export function recordEvidence(state, definition, id, { stage, note = "" } = {}) {
  const exhibit = (definition.evidence || []).find((item) => item.id === id);
  if (!exhibit) throw new Error(`Unknown evidence '${id}'`);
  // Existing cases can use plain exhibits; lifecycle data is opt-in per exhibit.
  if (!stage && !exhibit.stages && !exhibit.initialStage) {
    if (!state.evidence.includes(id)) state.evidence.push(id);
    return null;
  }
  state.evidenceState ||= {};
  const entry = state.evidenceState[id] ||= { stage: null, history: [] };
  const next = stage || entry.stage || exhibit.initialStage || "recorded";
  if (exhibit.stages && !exhibit.stages.includes(next))
    throw new Error(`Evidence '${id}' has no stage '${next}'`);
  if (entry.stage && entry.stage !== next && exhibit.transitions &&
      !(exhibit.transitions[entry.stage] || []).includes(next))
    throw new Error(`Evidence '${id}' cannot move from '${entry.stage}' to '${next}'`);
  if (!state.evidence.includes(id)) state.evidence.push(id);
  if (entry.stage !== next || note) entry.history.push({ stage: next, note });
  entry.stage = next;
  return entry;
}
export function projectEvidence(state, definition) {
  return state.evidence.map((id) => {
    const { presentations, uses, ...card } = (definition.evidence || []).find((item) => item.id === id) || {};
    return { ...structuredClone(card), id,
      ...(state.evidenceState?.[id] ? structuredClone(state.evidenceState[id]) : {}) };
  });
}
