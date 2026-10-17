import { Engine, PALETTE, withUrlOptions } from "./pixel-engine.js";
import { SignalDebt } from "./city-game.js";
try {
  const phone =
    new URLSearchParams(location.search).get("touch") === "1" ||
    matchMedia("(pointer: coarse)").matches;
  await Engine.start(
    new SignalDebt(),
    withUrlOptions({
      container: document.getElementById("app"),
      aspect: "fill",
      resolution: { width: 640, height: 360 },
      camera: { preset: "third", distance: 23, fov: 55, stiffness: 7 },
      background: PALETTE.sky,
      settings: { button: false, key: "signal-debt-picture-v1" },
      touch: false,
      debugKeys: false,
      quality: phone ? "low" : "medium",
      maxFps: phone ? 30 : 60,
      seed: 17,
    }),
  );
} catch (error) {
  console.error(error);
  const boot = document.getElementById("boot");
  if (boot) {
    document.getElementById("boot-status").textContent =
      /WebGPU|GPUAdapter|adapter/i.test(String(error))
        ? "This city needs WebGPU. Open in a current Chrome or Edge with hardware acceleration enabled."
        : "Port Sable could not start. Refresh the page; details are below.";
    const p = document.createElement("p");
    p.style.cssText =
      "max-width:35em;font-size:13px;opacity:.65;line-height:1.6";
    p.textContent = String(error.message ?? error);
    boot.append(p);
  }
}
