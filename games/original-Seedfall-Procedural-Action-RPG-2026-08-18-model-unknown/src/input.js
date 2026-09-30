/**
 * Seedfall's actions for kit.input, and a small router that turns them into
 * what the simulation needs: a movement vector, a right-stick aim and
 * buffered presses. The simulation runs on a fixed 60 Hz step, so a press is
 * kept until a step uses it (a tap on a 144 Hz frame with no step used to vanish).
 *
 * Bindings follow the wall's standard table: Space / A is the primary action
 * (dodge roll), J / left click / RT / X attack, K / Shift / right click / B / LT
 * the secondary power strike, E / Y interact, Esc / P / Start pause. The D-pad,
 * RB and LB hold the six ability slots, so movement is on the left stick only.
 */

export const ACTIONS = {
  move: { type: "vector", keys: "wasd+arrows", gamepad: "leftStick", touch: "stick" },
  aim: { type: "vector", gamepad: "rightStick" },
  // Touch buttons appear in this order; the first is the big one.
  attack: { keys: ["KeyJ"], mouse: [0], gamepad: ["RT", "X"], touch: "Attack" },
  dodge: { keys: ["Space"], gamepad: ["A"], touch: "Dodge" },
  power: { keys: ["KeyK", "ShiftLeft", "ShiftRight"], mouse: [2], gamepad: ["LT", "B"], touch: "Power" },
  potion: { keys: ["KeyQ"], gamepad: ["LS"], touch: "Potion" },
  interact: { keys: ["KeyE"], gamepad: ["Y"], touch: "Use" },
  skill1: { keys: ["Digit1", "Numpad1"], gamepad: ["RB"] },
  skill2: { keys: ["Digit2", "Numpad2"], gamepad: ["LB"] },
  skill3: { keys: ["Digit3", "Numpad3"], gamepad: ["Up"] },
  skill4: { keys: ["Digit4", "Numpad4"], gamepad: ["Right"] },
  skill5: { keys: ["Digit5", "Numpad5"], gamepad: ["Down"] },
  skill6: { keys: ["Digit6", "Numpad6"], gamepad: ["Left"] },
  pause: { keys: ["Escape", "KeyP"], gamepad: ["Start"], touch: { label: "II", slot: "top" } },
  inventory: { keys: ["KeyI"], gamepad: ["Back"], touch: { label: "Bag", slot: "top" } },
  character: { keys: ["KeyC"] },
  quests: { keys: ["KeyL"] },
  map: { keys: ["KeyM"], touch: { label: "Map", slot: "top" } },
  zoom: { gamepad: ["RS"] },
  // Menus (the game's own DOM panels): D-pad, arrows or the stick move focus, A / Enter picks, B backs out.
  confirm: { keys: ["Enter", "NumpadEnter"], gamepad: ["A"] },
  back: { keys: ["Backspace"], gamepad: ["B"] },
  navUp: { keys: ["ArrowUp"], gamepad: ["Up"] },
  navDown: { keys: ["ArrowDown"], gamepad: ["Down"] },
  navLeft: { keys: ["ArrowLeft"], gamepad: ["Left"] },
  navRight: { keys: ["ArrowRight"], gamepad: ["Right"] },
  tabPrev: { gamepad: ["LB"] },
  tabNext: { gamepad: ["RB"] },
};

const BUFFERED = ["dodge", "power", "potion", "interact", "skill1", "skill2", "skill3", "skill4", "skill5", "skill6"];
/** How long a press waits for its action to become possible (a dodge pressed just before the cooldown ends). */
const BUFFER_TIME = { dodge: 0.18, power: 0.18, potion: 0.05, interact: 0.05 };
const SKILL_BUFFER = 0.2;

export class InputRouter {
  input;
  move = { x: 0, z: 0 };
  moving = false;
  aimStick = { x: 0, z: 0 };
  aimStickActive = false;
  attackHeld = false;
  buffer = new Map();
  navHeld = { dir: null, repeat: 0 };

  constructor(input) {
    this.input = input;
  }

  get source() {
    return this.input.source;
  }

  /** Read this frame's gameplay input (call once per frame, before the fixed steps). */
  sample(dt) {
    const mv = this.input.vector("move");
    // Screen up is world −z (the camera looks north).
    this.move.x = mv.x;
    this.move.z = -mv.y;
    this.moving = Math.hypot(mv.x, mv.y) > 0.12;
    const aim = this.input.vector("aim");
    this.aimStick.x = aim.x;
    this.aimStick.z = -aim.y;
    this.aimStickActive = Math.hypot(aim.x, aim.y) > 0.3;
    this.attackHeld = this.input.down("attack");
    for (const name of BUFFERED) {
      if (this.input.pressed(name)) this.buffer.set(name, BUFFER_TIME[name] ?? SKILL_BUFFER);
    }
    for (const [name, left] of this.buffer) {
      const next = left - dt;
      if (next <= 0) this.buffer.delete(name);
      else this.buffer.set(name, next);
    }
  }

  /** Forget held movement and waiting presses (a menu opened, the player fell). */
  reset() {
    this.buffer.clear();
    this.move.x = this.move.z = 0;
    this.moving = false;
    this.aimStickActive = false;
    this.attackHeld = false;
  }

  /** True while a press of `name` is waiting; `take` it once it was used. */
  has(name) {
    return this.buffer.has(name);
  }

  take(name) {
    return this.buffer.delete(name);
  }

  pressed(name) {
    return this.input.pressed(name);
  }

  /**
   * Menu direction from arrows, D-pad or the left stick, with key-repeat when held.
   * Returns 'up' | 'down' | 'left' | 'right' | null.
   */
  menuDirection(dt) {
    const i = this.input;
    let dir = null;
    if (i.down("navUp")) dir = "up";
    else if (i.down("navDown")) dir = "down";
    else if (i.down("navLeft")) dir = "left";
    else if (i.down("navRight")) dir = "right";
    else if (i.source === "gamepad") {
      // The stick navigates menus too (WASD stays free for typing a seed).
      const v = i.vector("move");
      if (Math.abs(v.y) > 0.6 && Math.abs(v.y) >= Math.abs(v.x)) dir = v.y > 0 ? "up" : "down";
      else if (Math.abs(v.x) > 0.6) dir = v.x > 0 ? "right" : "left";
    }
    if (!dir) {
      this.navHeld.dir = null;
      return null;
    }
    if (dir !== this.navHeld.dir) {
      this.navHeld.dir = dir;
      this.navHeld.repeat = 0.38;
      return dir;
    }
    this.navHeld.repeat -= dt;
    if (this.navHeld.repeat <= 0) {
      this.navHeld.repeat = 0.11;
      return dir;
    }
    return null;
  }
}
