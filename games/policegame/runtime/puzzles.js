/** Small puzzle primitives: choice, clock correction, ordered timeline, registered custom. */
export function checkPuzzle(definition, puzzle, answer, state) {
  if (puzzle.type === "custom") {
    const handler = definition.extensions?.puzzles?.[puzzle.handler];
    if (!handler) throw new Error(`Unknown puzzle handler '${puzzle.handler}'`);
    return !!handler(answer, state, puzzle);
  }
  if (puzzle.type === "clock") {
    const minutes = (value) => {
      if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value < 1440 ? value : NaN;
      if (!/^\d{1,2}:\d{2}$/.test(String(value))) return NaN;
      const [hour, minute] = value.split(":").map(Number);
      return hour < 24 && minute < 60 ? hour * 60 + minute : NaN;
    };
    const expected = ((minutes(puzzle.displayed) + puzzle.offsetMinutes) % 1440 + 1440) % 1440;
    return minutes(answer) === expected;
  }
  if (puzzle.type === "timeline" || puzzle.type === "order")
    return Array.isArray(answer) && JSON.stringify(answer) === JSON.stringify(puzzle.answer);
  return Object.is(answer, puzzle.answer);
}
export function submitPuzzle(state, definition, id, answer, apply) {
  const puzzle = (definition.puzzles || []).find((entry) => entry.id === id);
  if (!puzzle) throw new Error(`Unknown puzzle '${id}'`);
  state.puzzles ||= {};
  const previous = state.puzzles[id];
  if (previous?.solved) return { ok: true, repeated: true, ...previous };
  const solved = checkPuzzle(definition, puzzle, answer, state);
  state.puzzles[id] = { solved, attempts: (previous?.attempts || 0) + 1, answer: structuredClone(answer) };
  apply(solved ? puzzle.onSuccess : puzzle.onFailure);
  return { ok: solved, ...state.puzzles[id] };
}
