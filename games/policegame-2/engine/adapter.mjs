/** The only engine-facing simulation primitives. Pinned v0.34.0; public APIs only. */
export function engineAdapter(E) {
  if (!E?.TileMap || !E?.Body || !E?.FlowField)
    throw new Error("my-3D2dge v0.34.0 must load before the game.");
  return {
    E,
    body: (opts) => new E.Body({ friction: 0, ...opts }),
    flow: (map) => new E.FlowField(map),
    sees: (observer, target, map, options = {}) =>
      E.sees(observer, target, { map, ...options }),
    attack: (spec) => new E.Attack(spec || "jab"),
    projectiles: (game) =>
      new E.Bullets(game, { plane: "ground", max: 64, sparks: false }),
  };
}

/** Trigger pressure isn't exposed by v0.34.0 Input; standard Gamepad is its supported browser fallback. */
/** Pointer Events report mouse-button chords as moves. Synchronize their button mask through public Input methods. */
export function pointerButtons(input, canvas) {
  const sync = (event) => {
    if (event.pointerType !== "mouse") return;
    for (const [button, mask] of [
      [0, 1],
      [1, 4],
      [2, 2],
    ]) {
      const code = "Mouse" + button,
        down = !!(event.buttons & mask);
      if (down && !input.held.has(code)) input.press(code);
      else if (!down && input.held.has(code)) input.release(code);
    }
  };
  canvas.addEventListener("pointermove", sync);
  canvas.addEventListener("pointerdown", sync);
  window.addEventListener("pointerup", sync);
  return () => {
    canvas.removeEventListener("pointermove", sync);
    canvas.removeEventListener("pointerdown", sync);
    window.removeEventListener("pointerup", sync);
  };
}

export function drivingInput(
  input,
  pads = globalThis.navigator?.getGamepads?.() || [],
) {
  const pad =
    input.padIndex === null || input.padIndex === undefined
      ? null
      : pads[input.padIndex];
  return {
    steer: input.move()[0],
    throttle: Math.max(
      input.lastDevice === "gamepad" ? pad?.buttons[7]?.value || 0 : 0,
      input.down("accelerate") && input.lastDevice !== "gamepad" ? 1 : 0,
    ),
    brake: Math.max(
      input.lastDevice === "gamepad" ? pad?.buttons[6]?.value || 0 : 0,
      input.down("brake") && input.lastDevice !== "gamepad" ? 1 : 0,
    ),
  };
}
