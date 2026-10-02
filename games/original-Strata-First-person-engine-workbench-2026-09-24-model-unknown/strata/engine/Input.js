/**
 * Strata input on top of the shared kit (kit.input): keyboard and mouse, gamepad and touch
 * all arrive as named actions, following the hub's standard layout. The play test, the
 * menus and the editor's camera never read a device directly.
 */

/** kit.input action definitions. Touch buttons build in this order; the first (Jump) is the big one. */
export function actionDefs() {
    return {
        // Play test
        move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
        look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
        jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
        interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
        throwKey: { keys: ['KeyJ'], gamepad: ['RT'], touch: 'Throw' },
        crouch: { keys: ['KeyC', 'ControlLeft'], gamepad: ['B'], touch: 'Crouch' },
        sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
        // Left click throws only while the mouse is captured; an uncaptured click captures it.
        throwMouse: { mouse: [0] },
        respawn: { keys: ['KeyR'], gamepad: ['Back'], touch: { label: 'Reset', slot: 'top' } },
        pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
        // Menus: arrows / D-pad / stick move between buttons, Enter or A confirms, B (or Esc) goes back.
        nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
        confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
        back: { gamepad: ['B'] },
        // Editor: tool keys, plus a gamepad camera (right stick orbit, left stick pan, triggers zoom).
        edPlay: { gamepad: ['A'] },
        edFocus: { keys: ['KeyF'], gamepad: ['X'] },
        edLevels: { gamepad: ['Y'] },
        edPrev: { gamepad: ['LB'] },
        edNext: { gamepad: ['RB'] },
        edZoom: { type: 'axis', gamepad: { pos: 'RT', neg: 'LT' } },
        edGrid: { keys: ['KeyG'] },
        edMove: { keys: ['KeyW'] },
        edRotate: { keys: ['KeyE'] },
        edScale: { keys: ['KeyR'] },
        edDelete: { keys: ['Delete', 'Backspace'] },
        edSearch: { keys: ['Slash'] },
    };
}

/** Short button names per device, for prompts and help. */
const PROMPTS = {
    keyboard: { interact: 'E', throw: 'Click', jump: 'Space', crouch: 'C', sprint: 'Shift', respawn: 'R', pause: 'Esc', move: 'WASD', look: 'Mouse' },
    gamepad: { interact: 'X', throw: 'RT', jump: 'A', crouch: 'B', sprint: 'L3', respawn: 'View', pause: 'Start', move: 'L stick', look: 'R stick' },
    touch: { interact: 'Use', throw: 'Throw', jump: 'Jump', crouch: 'Crouch', sprint: 'Stick edge', respawn: 'Reset', pause: 'II', move: 'Left thumb', look: 'Drag' },
};
export function promptLabel(action, source) {
    return (PROMPTS[source] ?? PROMPTS.keyboard)[action] ?? action;
}
/** Control help as [binding, what it does] rows for the device in use. */
export function controlRows(source) {
    if (source === 'gamepad')
        return [['L stick', 'Move'], ['R stick', 'Look'], ['A', 'Jump'], ['L3', 'Sprint (toggle)'], ['B', 'Crouch (toggle)'], ['X', 'Use · pick up · drop'], ['RT', 'Throw'], ['View', 'Back to checkpoint'], ['Start', 'Pause']];
    if (source === 'touch')
        return [['Left thumb', 'Move (push to the rim to sprint)'], ['Drag right', 'Look'], ['Jump', 'Jump'], ['Crouch', 'Crouch (toggle)'], ['Use', 'Use · pick up · drop'], ['Throw', 'Throw what you hold'], ['Reset', 'Back to checkpoint'], ['II', 'Pause']];
    return [['W A S D', 'Move'], ['Mouse', 'Look (click to capture)'], ['Space', 'Jump'], ['Shift', 'Sprint'], ['C', 'Crouch'], ['E', 'Use · pick up · drop'], ['Click / J', 'Throw'], ['R', 'Back to checkpoint'], ['Esc / P', 'Pause']];
}

/**
 * The play test's view of kit.input. Presses are latched until a fixed simulation step
 * consumes them, so a tap is never lost on a fast display (no step that frame) or
 * counted twice on a slow one (two steps).
 */
export class Input {
    kit;
    enabled = false;
    latched = new Set();
    crouchToggle = false;
    sprintLatch = false;
    throwGate = false;
    #move = { x: 0, z: 0, sprint: false, crouch: false, jump: false };
    #zero = { x: 0, y: 0 };
    constructor(kitInput) {
        this.kit = kitInput;
    }
    get source() { return this.kit.source; }
    get mouseCaptured() { return !!this.kit.pointerLocked; }
    #throwPressed() { return this.kit.pressed('throwKey') || (this.kit.pointerLocked && this.kit.pressed('throwMouse')); }
    #throwHeld() { return this.kit.down('throwKey') || (this.kit.pointerLocked && this.kit.down('throwMouse')); }
    /** Once per rendered frame, before the fixed steps. */
    poll() {
        if (!this.enabled)
            return;
        const k = this.kit;
        for (const name of ['jump', 'interact', 'respawn'])
            if (k.pressed(name))
                this.latched.add(name);
        if (this.throwGate && !this.#throwHeld())
            this.throwGate = false;
        if (!this.throwGate && this.#throwPressed())
            this.latched.add('throw');
        // Gamepad and touch crouch toggles (holding B while looking is awkward); keys hold.
        if (k.source === 'keyboard')
            this.crouchToggle = false;
        else if (k.pressed('crouch'))
            this.crouchToggle = !this.crouchToggle;
        const mv = k.vector('move');
        if (k.source === 'gamepad' && k.pressed('sprint'))
            this.sprintLatch = !this.sprintLatch;
        if (Math.hypot(mv.x, mv.y) < .3)
            this.sprintLatch = false;
    }
    /** True once per press. */
    consume(action) {
        if (!this.enabled)
            return false;
        return this.latched.delete(action);
    }
    down(action) {
        if (!this.enabled)
            return false;
        if (action === 'sprint')
            return this.sprinting();
        if (action === 'crouch')
            return this.crouching();
        if (action === 'throw')
            return !this.throwGate && this.#throwHeld();
        return this.kit.down(action);
    }
    /** Ignore the throw button until it is released (after a throw or a menu). */
    gateThrow() { this.throwGate = true; this.latched.delete('throw'); }
    sprinting() {
        if (!this.enabled)
            return false;
        const mv = this.kit.vector('move');
        return this.kit.down('sprint') || this.sprintLatch || (this.kit.source === 'touch' && Math.hypot(mv.x, mv.y) > .92);
    }
    crouching() {
        if (!this.enabled)
            return false;
        return this.kit.source === 'keyboard' ? this.kit.down('crouch') : this.crouchToggle;
    }
    /** This step's movement intent. The object is reused. */
    movement() {
        const m = this.#move;
        if (!this.enabled) {
            m.x = m.z = 0;
            m.sprint = m.crouch = m.jump = false;
            return m;
        }
        const mv = this.kit.vector('move');
        m.x = mv.x;
        m.z = -mv.y;
        m.sprint = this.sprinting();
        m.crouch = this.crouching();
        m.jump = this.consume('jump');
        return m;
    }
    /** Radians of turn this frame (the kit applies the player's sensitivity and invert-Y). */
    look() {
        return this.enabled ? this.kit.look('look') : this.#zero;
    }
    resetToggles() { this.crouchToggle = false; this.sprintLatch = false; }
    clear() { this.latched.clear(); this.resetToggles(); }
}
