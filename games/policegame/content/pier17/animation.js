import { Mocap } from "../../vendor/mocap/mocap.js";
import mocapSet from "./assets/lastwatch-mocap.js";

/** A content extension using the engine's documented mocap adapter. */
const library = Mocap.load(mocapSet);
const waiting = library.clip("Waiting_Loop");
const bound = new WeakSet();

/** Call before Humanoid.update. Cosmetic animation never changes case state. */
export function applyWaitingCapture(rig, time, active = true) {
  if (!bound.has(rig)) {
    Mocap.drive(rig, library);
    bound.add(rig);
  }
  rig.mocap = active ? library.sample(waiting, time) : null;
  rig.mocapMask = "upper";
  rig.mocapW = 0.45;
}

export const waitingCaptureInfo = {
  clip: waiting.name,
  duration: waiting.dur,
  keyPoses: waiting.keys.length,
  ...library.origin(waiting),
};
