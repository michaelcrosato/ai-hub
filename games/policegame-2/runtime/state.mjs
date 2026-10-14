export const SAVE_VERSION = 2;
export const clone = (value) => structuredClone(value);
export const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

export function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stable(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

/** Non-cryptographic reproducibility hash; deployment provenance uses SHA-256 separately. */
export function hash(value) {
  let n = 2166136261;
  for (const c of stable(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(16).padStart(8, "0");
}

export function random(state) {
  let n = state.rng | 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  state.rng = n >>> 0;
  return state.rng / 4294967296;
}

export function initialState(definition, seed = 1) {
  const scene = definition.start.scene;
  const entities = Object.fromEntries(
    (definition.entities || []).map((e) => [
      e.id,
      {
        mode: "idle",
        health: 100,
        stress: 0,
        relationship: 0,
        active: true,
        ...clone(e),
        scene: e.scene || scene,
        origin: { x: e.x, y: e.y, scene: e.scene || scene },
      },
    ]),
  );
  return {
    version: SAVE_VERSION,
    contentVersion: definition.contentVersion,
    contentHash: hash(definition),
    caseId: definition.id,
    scene,
    seconds: 0,
    rng: Math.max(1, seed >>> 0),
    facts: clone(definition.initialFacts || {}),
    events: [],
    penalties: [],
    consumed: [],
    inventory: clone(definition.inventory || {}),
    evidence: {},
    records: {},
    jobs: {},
    encounters: {},
    entities,
    player: {
      ...clone(definition.player || {}),
      id: "player",
      x: definition.start.x,
      y: definition.start.y,
      scene,
      facing: Math.PI / 2,
      health: 100,
    },
    dialogue: null,
    dialogueNodes: {},
    activeAction: null,
    cue: null,
    outcome: null,
    checkpoints: {},
    commandLog: [],
  };
}

export function logEvent(state, title, text, details = {}) {
  const event = {
    id: state.events.length,
    title,
    text,
    time: Math.floor(state.seconds),
    ...details,
  };
  state.events.push(event);
  return event;
}
