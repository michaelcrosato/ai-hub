// One memory: three kinds of intel, then the target, then the escape.
// An early kill spoils the memory (not a win). Death is a loss.
// Restart returns the opening phase.

export const OPENING_PHASE = 'locked';
export const INTEL_KINDS = ['eavesdrop', 'pickpocket', 'interrogation'];

export function createMemory() {
  return {
    phase: OPENING_PHASE,
    intel: { eavesdrop: false, pickpocket: false, interrogation: false },
    targetDead: false,
    escaped: false,
    spoiled: false,
    dead: false,
    won: false,
    lost: false,
  };
}

export function intelComplete(memory) {
  return INTEL_KINDS.every((kind) => memory.intel[kind]);
}

export function revealIntel(memory, kind) {
  if (!INTEL_KINDS.includes(kind) || memory.dead || memory.intel[kind]) return memory;
  return settle({ ...memory, intel: { ...memory.intel, [kind]: true } });
}

/** Killing the target before the three intel flags spoils the win. */
export function markTargetDead(memory) {
  if (memory.dead || memory.targetDead) return memory;
  const spoiled = memory.spoiled || !intelComplete(memory);
  return settle({ ...memory, targetDead: true, spoiled });
}

/** Escape counts only after intel and a clean kill, and only by reaching it then. */
export function reachEscape(memory) {
  if (memory.dead || memory.spoiled || memory.won) return memory;
  if (!(intelComplete(memory) && memory.targetDead)) return memory;
  if (memory.escaped) return memory;
  return settle({ ...memory, escaped: true });
}

export function markDead(memory) {
  if (memory.dead) return memory;
  return settle({ ...memory, dead: true });
}

export function restartMemory() {
  return createMemory();
}

export function statusLine(memory, awareness, sync) {
  const result = memory.won ? 'won' : memory.lost ? 'lost' : 'play';
  const heard = awareness | 0;
  return `phase ${memory.phase} awareness ${heard} sync ${sync} result ${result}`;
}

function settle(memory) {
  if (memory.dead) {
    return { ...memory, phase: 'lost', won: false, lost: true };
  }
  const ready = intelComplete(memory);
  if (ready && memory.targetDead && memory.escaped && !memory.spoiled) {
    return { ...memory, phase: 'won', won: true, lost: false };
  }
  if (ready && memory.targetDead && !memory.spoiled) {
    return { ...memory, phase: 'escape', won: false, lost: false };
  }
  if (ready && !memory.targetDead) {
    return { ...memory, phase: 'hunt', won: false, lost: false };
  }
  return { ...memory, phase: OPENING_PHASE, won: false, lost: false };
}
