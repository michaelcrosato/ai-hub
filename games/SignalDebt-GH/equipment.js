// Library-first review found no modern radio equipment or sidearm in LIBRARY.md.
// Original models as data; no external assets or engine modifications.
import { model, buildModel, setLookLayer } from "./pixel-engine.js";
export const SIGNAL_CASE = model({
  id: "signal-evidence-case",
  about:
    "Sealed paper evidence case with a hard shell, clasp and carrying handle",
  tags: ["evidence", "case", "signal"],
  palette: { shell: "teal", edge: "night", metal: "sand" },
  parts: [
    { box: [0.72, 0.32, 0.42], at: [0, 0.2, 0], c: "shell" },
    { box: [0.76, 0.08, 0.46], at: [0, 0.05, 0], c: "edge" },
    { box: [0.76, 0.08, 0.46], at: [0, 0.36, 0], c: "edge" },
    { box: [0.18, 0.12, 0.06], at: [0, 0.28, 0.24], c: "metal" },
    { box: [0.36, 0.07, 0.12], at: [0, 0.49, 0], c: "metal" },
    { box: [0.07, 0.13, 0.12], at: [-0.145, 0.43, 0], c: "metal" },
    { box: [0.07, 0.13, 0.12], at: [0.145, 0.43, 0], c: "metal" },
  ],
});
export const RELAY = model({
  id: "district-relay-cabinet",
  about:
    "Street communications cabinet with display, vents and a rooftop aerial",
  tags: ["signal", "terminal", "cabinet"],
  palette: {
    body: "teal",
    foot: "sand",
    screen: "night",
    lamp: "cyan",
    mark: "sand",
  },
  parts: [
    { box: [1.5, 0.22, 1], at: [0, 0.11, 0], c: "foot" },
    { box: [1.25, 1.9, 0.8], at: [0, 1.13, 0], c: "body" },
    { box: [1.38, 0.16, 0.9], at: [0, 2.13, 0], c: "foot" },
    { box: [0.84, 0.55, 0.07], at: [0, 1.48, 0.44], c: "screen" },
    { box: [0.6, 0.09, 0.08], at: [0, 1.59, 0.49], c: "lamp", glow: true },
    { box: [0.4, 0.07, 0.08], at: [-0.1, 1.39, 0.49], c: "mark" },
    ...[0.56, 0.74, 0.92].map((y) => ({
      box: [0.7, 0.07, 0.07],
      at: [0, y, 0.44],
      c: "screen",
    })),
    { box: [0.1, 0.66, 0.1], at: [0.44, 2.47, 0], c: "mark" },
    { box: [0.5, 0.09, 0.09], at: [0.44, 2.75, 0], c: "mark" },
  ],
});
export const PULSE_EMITTER = model({
  id: "pulse-emitter",
  about:
    "Compact nonlethal security pulse emitter with a broad barrel and insulated grip",
  tags: ["weapon", "pulse", "tool"],
  palette: { metal: "slate", grip: "night", coil: "cyan" },
  parts: [
    { box: [0.14, 0.25, 0.14], at: [0, 0.125, -0.08], c: "grip" },
    { box: [0.19, 0.15, 0.45], at: [0, 0.31, 0.05], c: "metal" },
    { box: [0.13, 0.08, 0.12], at: [0, 0.31, 0.31], c: "coil" },
  ],
});
export function equipment(def) {
  const object = buildModel(def).object;
  setLookLayer(object, "actors");
  return object;
}
