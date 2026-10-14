import { logEvent } from "../runtime/state.mjs";

/** Example extension: a two-switch circuit. All state is serializable; errors roll back the action. */
export function toggleCircuit({ state, params }) {
  const {
    bit,
    targetMask = 3,
    maskFact = "circuit-mask",
    readyFact = "power-restored",
    light,
  } = params;
  if (![1, 2, 4, 8].includes(bit) || !Number.isInteger(targetMask))
    throw new Error("Invalid circuit configuration.");
  if (!state.entities[light] || state.entities[light].kind !== "light")
    throw new Error("The circuit light is missing.");
  const mask = (Number(state.facts[maskFact]) || 0) ^ bit;
  state.facts[maskFact] = mask;
  state.facts[readyFact] = mask === targetMask;
  state.entities[light].active = mask === targetMask;
  logEvent(
    state,
    mask === targetMask ? "Stage power restored" : "Circuit changed",
    `Switch bank: ${mask.toString(2).padStart(2, "0")}. ${mask === targetMask ? "The stage light is on." : "Both feeds are needed."}`,
    { hook: "circuit-toggle" },
  );
}
