/** Serializable cue sequencer. The host renders returned cues; effects run once. */
export function startSequence(state, definition, id) {
  if (!(definition.sequences || []).some((entry) => entry.id === id))
    throw new Error(`Unknown sequence '${id}'`);
  state.presentation ||= {};
  state.presentation[id] ||= { index: 0, applied: [], paused: false, completed: false, current: null,
    area: state.area || definition.startArea || null };
  return state.presentation[id];
}
export function advanceSequence(state, definition, id, apply, { skip = false } = {}) {
  const saved = startSequence(state, definition, id);
  const sequence = definition.sequences.find((entry) => entry.id === id);
  if (saved.completed) { saved.current = null; return null; }
  if (saved.paused && !skip) return null;
  let cue = null;
  do {
    const step = sequence.steps[saved.index];
    if (!step) { saved.completed = true; break; }
    const key = step.id || String(saved.index);
    if (!saved.applied.includes(key)) { apply(step.effects); saved.applied.push(key); }
    cue = { ...step, effects: undefined, sequence: id, index: saved.index };
    delete cue.effects;
    saved.current = structuredClone(cue);
    saved.index++;
    if (saved.index >= sequence.steps.length) saved.completed = true;
  } while (skip && !saved.completed);
  if (skip) saved.current = null;
  return skip ? null : cue;
}
export function pauseSequence(state, definition, id, paused = true) {
  startSequence(state, definition, id).paused = !!paused;
}
