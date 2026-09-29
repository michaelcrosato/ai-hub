/**
 * input.js — Brick Bowl's two controllers, built on kit.input actions.
 *
 * The game logic talks to a "controller" with the same small API the original
 * build used: consume(name) takes a press edge, isHeld(name) is held, axis is
 * the stick/keys direction (y up = away from the camera), pressed(name) peeks.
 * Edges stay queued until they are consumed or the simulation ran a step
 * (endStep), exactly like the original input layer, so menus that only look at
 * some names never lose a tap and gameplay never sees stale menu presses.
 *
 *   1 player : P1 = everything on the keyboard (WASD and the arrows), the first
 *              gamepad and the on-screen touch controls.
 *   2 players: P1 = WASD side of the keyboard + first gamepad + touch;
 *              P2 = arrows/Enter side of the keyboard + a second gamepad.
 *
 * kit.input reads one gamepad, so the second player's pad is polled here
 * (buttons in the standard mapping) and only in 2-player matches.
 */

export const ACTIONS = {
  // P1 (and solo)
  move: { type: "vector", keys: "wasd", gamepad: "leftStick+dpad", touch: "stick" },
  action: { keys: ["Space", "KeyJ"], mouse: [0], gamepad: ["A"], touch: "A" }, // click on the field works too
  special: { keys: ["KeyE", "KeyL"], mouse: [2], gamepad: ["B"], touch: "B" },
  turbo: { keys: ["ShiftLeft", "KeyK"], gamepad: ["X", "RT", "RB"], touch: "Turbo" },
  timeout: { keys: ["KeyT"], gamepad: ["Back"], touch: { label: "T/O", slot: "top" } },
  pause: { keys: ["Escape", "KeyP"], gamepad: ["Start"], touch: { label: "❚❚", slot: "top" } },
  flip: { keys: ["KeyQ", "KeyF"], gamepad: ["Y"] },
  back: { keys: ["Backspace"], gamepad: ["B"] },
  confirm: { keys: ["Enter", "NumpadEnter"] },
  r1: { keys: ["Digit1"] },
  r2: { keys: ["Digit2"] },
  r3: { keys: ["Digit3"] },
  r4: { keys: ["Digit4"] },
  r5: { keys: ["Digit5"] },
  // The right-hand side of the keyboard: P2 in a 2-player match, extra keys for P1 otherwise.
  move2: { type: "vector", keys: "arrows", gamepad: [] },
  action2: { keys: ["Enter", "NumpadEnter", "Period"] },
  special2: { keys: ["Comma", "Numpad0"] },
  turbo2: { keys: ["ShiftRight", "Slash"] },
  timeout2: { keys: ["KeyY"] },
  flip2: { keys: ["KeyM"] },
  r1b: { keys: ["Numpad1"] },
  r2b: { keys: ["Numpad2"] },
  r3b: { keys: ["Numpad3"] },
  r4b: { keys: ["Numpad4"] },
  r5b: { keys: ["Numpad5"] },
};

/** Logical controller button -> kit actions, per layout. */
const LAYOUT = {
  solo: {
    move: ["move", "move2"],
    action: ["action", "action2"],
    confirm: ["action", "action2", "confirm"],
    special: ["special", "special2"],
    turbo: ["turbo", "turbo2"],
    timeout: ["timeout", "timeout2"],
    pause: ["pause"],
    flip: ["flip", "flip2"],
    back: ["back"],
    r1: ["r1", "r1b"],
    r2: ["r2", "r2b"],
    r3: ["r3", "r3b"],
    r4: ["r4", "r4b"],
    r5: ["r5", "r5b"],
  },
  p1: {
    move: ["move"],
    action: ["action"],
    confirm: ["action"],
    special: ["special"],
    turbo: ["turbo"],
    timeout: ["timeout"],
    pause: ["pause"],
    flip: ["flip"],
    back: ["back"],
    r1: ["r1"],
    r2: ["r2"],
    r3: ["r3"],
    r4: ["r4"],
    r5: ["r5"],
  },
  p2: {
    move: ["move2"],
    action: ["action2"],
    confirm: ["action2"],
    special: ["special2"],
    turbo: ["turbo2"],
    timeout: ["timeout2"],
    pause: [], // Esc/P belong to P1; P2 pauses with Start on its pad
    flip: ["flip2"],
    back: [],
    r1: ["r1b"],
    r2: ["r2b"],
    r3: ["r3b"],
    r4: ["r4b"],
    r5: ["r5b"],
  },
};

/** Standard-mapping buttons for the second player's gamepad. */
const PAD2 = {
  action: [0],
  confirm: [0],
  special: [1],
  back: [1],
  turbo: [2, 5, 7],
  flip: [3],
  timeout: [8],
  pause: [9],
};
const BUTTONS = [
  "action",
  "confirm",
  "special",
  "turbo",
  "timeout",
  "pause",
  "flip",
  "back",
  "r1",
  "r2",
  "r3",
  "r4",
  "r5",
];

class Controller {
  held = new Set();
  edges = new Set();
  axis = { x: 0, y: 0 };
  prevDir = { x: 0, y: 0 };
  source = "keyboard";
  constructor(name, controls) {
    this.name = name;
    this.controls = controls;
  }
  pressed(name) {
    return this.edges.has(name);
  }
  consume(name) {
    return this.edges.delete(name);
  }
  isHeld(name) {
    return this.held.has(name);
  }
  anyPressed() {
    return this.edges.size > 0;
  }
  clearEdges() {
    this.edges.clear();
  }
  rumble(strength, ms) {
    this.controls.rumble(this, strength, ms);
  }
  /** Direction presses (menus) from the combined stick/keys/d-pad, like the original. */
  _dirEdges() {
    const { x, y } = this.axis;
    const dx = x > 0.6 ? 1 : x < -0.6 ? -1 : 0;
    const dy = y > 0.6 ? 1 : y < -0.6 ? -1 : 0;
    if (dx !== this.prevDir.x && dx) this.edges.add(dx > 0 ? "right" : "left");
    if (dy !== this.prevDir.y && dy) this.edges.add(dy > 0 ? "up" : "down");
    this.prevDir.x = dx;
    this.prevDir.y = dy;
  }
}

export class Controls {
  twoPlayer = false;
  pad2 = null;
  pad2Prev = new Set();
  pad2Used = 0;
  onAnyInput = null;
  constructor(kit) {
    this.kit = kit;
    this.p1 = new Controller("P1", this);
    this.p2 = new Controller("P2", this);
  }
  setTwoPlayer(on) {
    this.twoPlayer = !!on;
    this.flush();
  }
  whenAnyInput(fn) {
    this.onAnyInput = fn;
  }
  /** Read kit.input (and the second pad) into both controllers. Call once per frame. */
  poll() {
    const input = this.kit.input;
    this._fill(this.p1, this.twoPlayer ? LAYOUT.p1 : LAYOUT.solo, input);
    this.p1._dirEdges();
    this.p1.source = input.source;
    if (this.twoPlayer) {
      this._fill(this.p2, LAYOUT.p2, input);
      this._pad2(this.p2);
      this.p2._dirEdges(); // once, on the combined keys + pad direction
      this.p2.source = performance.now() - this.pad2Used < 4000 ? "gamepad" : "keyboard";
    } else {
      this.p2.held.clear();
      this.p2.axis.x = this.p2.axis.y = 0;
    }
    if ((this.p1.edges.size || this.p2.edges.size) && this.onAnyInput) this.onAnyInput();
  }
  _fill(c, layout, input) {
    c.held.clear();
    for (const name of BUTTONS) {
      for (const a of layout[name]) {
        if (input.down(a)) c.held.add(name);
        if (input.pressed(a)) c.edges.add(name);
      }
    }
    let x = 0;
    let y = 0;
    for (const a of layout.move) {
      const v = input.vector(a);
      x += v.x;
      y += v.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    c.axis.x = x;
    c.axis.y = y;
  }
  /** Second player's gamepad: the first connected pad that kit.input is not already reading. */
  _pad2(c) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const first = this.kit.input.pad;
    const pad =
      pads.find((p) => p && p.connected && p !== first && (!first || p.index !== first.index)) || null;
    this.pad2 = pad;
    if (!pad) {
      this.pad2Prev.clear();
      return;
    }
    const down = new Set();
    const btn = (i) => {
      const b = pad.buttons[i];
      return !!b && (b.pressed || b.value > 0.5);
    };
    for (const [name, list] of Object.entries(PAD2)) if (list.some(btn)) down.add(name);
    for (const name of down) {
      c.held.add(name);
      if (!this.pad2Prev.has(name)) c.edges.add(name);
    }
    this.pad2Prev = down;
    let x = pad.axes[0] || 0;
    let y = -(pad.axes[1] || 0);
    if (Math.hypot(x, y) < 0.22) x = y = 0;
    x += (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
    y += (btn(12) ? 1 : 0) - (btn(13) ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    if (down.size || len > 0.3) this.pad2Used = performance.now();
    c.axis.x = Math.max(-1, Math.min(1, c.axis.x + x));
    c.axis.y = Math.max(-1, Math.min(1, c.axis.y + y));
  }
  /** Called after the simulation ran at least one step: unconsumed presses expire. */
  endStep() {
    this.p1.clearEdges();
    this.p2.clearEdges();
  }
  /** Drop every queued press and treat held buttons as old (after a modal menu closes). */
  flush() {
    this.p1.clearEdges();
    this.p2.clearEdges();
    this.kit.input.settle(); // held kit buttons count as old; pad2Prev already holds P2's held buttons
  }
  rumble(c, strength = 0.5, ms = 120) {
    if (c === this.p1 || !this.twoPlayer) {
      this.kit.input.rumble(strength, ms);
      return;
    }
    if (this.kit.settings.get().vibration === false) return;
    this.pad2?.vibrationActuator
      ?.playEffect?.("dual-rumble", {
        duration: ms,
        strongMagnitude: strength,
        weakMagnitude: Math.min(1, strength * 1.2),
      })
      ?.catch?.(() => {});
  }
}

/**
 * Button prompts for the device a controller last used.
 * key(name) -> short label; the UI wraps it in a key cap.
 */
const PROMPTS = {
  keyboard: {
    action: "SPACE",
    special: "E",
    turbo: "SHIFT",
    timeout: "T",
    pause: "ESC",
    flip: "Q",
    back: "BKSP",
    confirm: "SPACE",
    aim: "← →",
    move: "WASD",
    receivers: "1-5",
  },
  keyboard2: {
    action: "ENTER",
    special: ",",
    turbo: "R-SHIFT",
    timeout: "Y",
    pause: "ESC",
    flip: "M",
    back: "BKSP",
    confirm: "ENTER",
    aim: "← →",
    move: "ARROWS",
    receivers: "NUM 1-5",
  },
  gamepad: {
    action: "A",
    special: "B",
    turbo: "X/RT",
    timeout: "BACK",
    pause: "START",
    flip: "Y",
    back: "B",
    confirm: "A",
    aim: "STICK",
    move: "STICK",
    receivers: "",
  },
  touch: {
    action: "A",
    special: "B",
    turbo: "TURBO",
    timeout: "T/O",
    pause: "❚❚",
    flip: "FLIP",
    back: "BACK",
    confirm: "TAP",
    aim: "STICK",
    move: "STICK",
    receivers: "",
  },
};

export function promptSet(controller, twoPlayer) {
  const src = controller?.source || "keyboard";
  if (src === "keyboard" && twoPlayer && controller?.name === "P2") return PROMPTS.keyboard2;
  return PROMPTS[src] || PROMPTS.keyboard;
}
