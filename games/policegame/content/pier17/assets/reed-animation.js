import { applyWaitingCapture } from "../animation.js";

/** Registered actor-animation factory; runtime calls update before rig.update. */
export function createReedWaitingAnimation({ rig }) {
  return {
    update({ state, time }) {
      applyWaitingCapture(rig, time, !state.flags.suspectCalm && !state.flags.suspectDetained);
    },
    dispose() {
      applyWaitingCapture(rig, 0, false);
    },
  };
}

export default createReedWaitingAnimation;
