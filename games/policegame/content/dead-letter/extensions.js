/** Pure registered mechanic: a postal seal uses a weighted units-digit checksum. */
export function sealChecksum(answer, state, puzzle) {
  if (!state.flags.labelCopied || !Array.isArray(puzzle.digits)) return false;
  const checksum = puzzle.digits.reduce((sum, digit, index) => sum + digit * (index + 1), 0) % 10;
  return Number(answer) === checksum;
}

/** A registered, state-driven gesture uses public Humanoid poses only. */
export function clerkGreeting() {
  return { update({ state, time }) {
    return { pose: state.flags.accountHeard && Math.sin(time * 0.7) > 0.8 ? 'wave' : 'idle',
      expr: state.flags.courteous ? 'smile' : 'neutral' };
  } };
}
