/**
 * Strata input on top of the shared kit (kit.input): keyboard and mouse,
 * gamepad and touch all arrive as named actions. The game never reads a
 * device directly.
 *
 * Keyboard keys stay rebindable (the menu's rebind buttons); gamepad and touch
 * follow the hub's standard layout.
 */

/** Rebindable keyboard actions. Mouse buttons are fixed: left click fires or throws. */
export const defaultBindings = {
    forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['ControlLeft', 'KeyC'], interact: ['KeyE'],
    reload: ['KeyR'], respawn: ['KeyT'], fire: ['KeyJ'],
};
export const rebindable = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'crouch', 'interact', 'reload', 'respawn'];
const validCode = /^(?:Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|Backspace|Tab|Semicolon|Comma|Period|Slash|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/;
/** Keys the page itself owns: pause and the shared settings panel. */
const reserved = new Set(['Escape', 'KeyP', 'F9']);

export function isBindableCode(code) {
    return validCode.test(code) && !reserved.has(code);
}

/** Copy saved bindings over the defaults, rejecting anything invalid. */
export function sanitizeBindings(raw) {
    const out = structuredClone(defaultBindings);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return out;
    for (const action of rebindable) {
        const codes = raw[action];
        if (Array.isArray(codes) && codes.length >= 1 && codes.length <= 4 && codes.every(c => typeof c === 'string' && isBindableCode(c)))
            out[action] = [...new Set(codes)];
    }
    return out;
}

/** kit.input action definitions for these bindings (standard hub gamepad and touch layout). */
export function actionDefs(bindings = defaultBindings) {
    const b = sanitizeBindings(bindings);
    return {
        // Touch buttons build in this order; the first one (Fire) is the big one.
        fire: { keys: b.fire, gamepad: ['RT'], touch: 'Fire' },
        move: { type: 'vector', keys: { up: b.forward, down: b.back, left: b.left, right: b.right }, gamepad: 'leftStick+dpad', touch: 'stick' },
        look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
        jump: { keys: b.jump, gamepad: ['A'], touch: 'Jump' },
        crouch: { keys: b.crouch, gamepad: ['B'], touch: 'Crouch' },
        interact: { keys: b.interact, gamepad: ['X'], touch: 'Use' },
        reload: { keys: b.reload, gamepad: ['Y'], touch: 'Reload' },
        sprint: { keys: b.sprint, gamepad: ['LS'] },
        respawn: { keys: b.respawn, gamepad: ['Back'] },
        // Left click only counts while the mouse is captured; an uncaptured click captures it instead.
        fireMouse: { mouse: [0] },
        pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
        // Menus: arrows / D-pad / stick move between buttons, A or Enter confirms, B goes back.
        nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
        confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
        back: { keys: ['Backspace'], gamepad: ['B'] },
    };
}

const KEY_NAMES = {
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace', Tab: 'Tab',
};
export function keyName(code) {
    if (KEY_NAMES[code])
        return KEY_NAMES[code];
    if (/^Key[A-Z]$/.test(code))
        return code.slice(3);
    if (/^Digit[0-9]$/.test(code))
        return code.slice(5);
    return code;
}
const PAD_LABELS = { fire: 'RT', interact: 'X', reload: 'Y', jump: 'A', crouch: 'B', sprint: 'L3', respawn: 'View', pause: 'Start', move: 'Left stick', look: 'Right stick' };
const TOUCH_LABELS = { fire: 'Fire', interact: 'Use', reload: 'Reload', jump: 'Jump', crouch: 'Crouch', sprint: 'Stick to the edge', respawn: 'Menu', pause: 'II', move: 'Left thumb', look: 'Drag right side' };

/** A short button prompt for an action on the device the player is using. */
export function promptLabel(action, source, bindings = defaultBindings) {
    if (source === 'gamepad')
        return PAD_LABELS[action] ?? action;
    if (source === 'touch')
        return TOUCH_LABELS[action] ?? action;
    if (action === 'fire')
        return 'Click';
    if (action === 'pause')
        return 'Esc';
    if (action === 'move')
        return [bindings.forward, bindings.left, bindings.back, bindings.right].map(c => keyName(c[0])).join('');
    if (action === 'look')
        return 'Mouse';
    const codes = bindings[action];
    return codes?.length ? codes.map(keyName).join(' / ') : action;
}

/** Control help for the menu, as [label, binding] rows for the given device. */
export function controlRows(source, bindings = defaultBindings) {
    const p = action => promptLabel(action, source, bindings);
    if (source === 'touch')
        return [['Move', 'Left thumb (push to the edge to sprint)'], ['Look', 'Drag on the right'], ['Fire / throw', 'Fire'], ['Jump', 'Jump'], ['Crouch', 'Crouch (toggles)'], ['Use / carry', 'Use'], ['Reload', 'Reload'], ['Pause', 'II']];
    if (source === 'gamepad')
        return [['Move / look', 'Left / right stick'], ['Fire / throw', 'RT'], ['Jump', 'A'], ['Crouch', 'B (toggles)'], ['Sprint', 'L3 (click the stick)'], ['Use / carry', 'X'], ['Reload', 'Y'], ['Return to start', 'View'], ['Pause', 'Start']];
    return [['Move', p('move')], ['Sprint', p('sprint')], ['Jump', p('jump')], ['Crouch', p('crouch')], ['Use / carry', p('interact')], ['Fire / throw', `Click / ${keyName(bindings.fire?.[0] ?? 'KeyJ')}`], ['Reload', p('reload')], ['Return to start', p('respawn')], ['Pause', 'Esc / P']];
}

/**
 * The game-side view of kit.input. Presses are latched until a fixed
 * simulation step consumes them, so a tap is never lost on a fast display
 * (no step that frame) or counted twice on a slow one (two steps).
 */
export class Input {
    kit;
    enabled = false;
    latched = new Set();
    crouchToggle = false;
    sprintLatch = false;
    fireGate = false;
    constructor(kitInput) {
        this.kit = kitInput;
    }
    get source() { return this.kit.source; }
    get mouseCaptured() { return !!this.kit.pointerLocked; }
    #firePressed() { return this.kit.pressed('fire') || (this.kit.pointerLocked && this.kit.pressed('fireMouse')); }
    #fireHeld() { return this.kit.down('fire') || (this.kit.pointerLocked && this.kit.down('fireMouse')); }
    /** Once per rendered frame, before the fixed steps. */
    poll() {
        if (!this.enabled)
            return;
        const k = this.kit;
        for (const name of ['jump', 'interact', 'reload', 'respawn'])
            if (k.pressed(name))
                this.latched.add(name);
        if (this.fireGate && !this.#fireHeld())
            this.fireGate = false;
        if (!this.fireGate && this.#firePressed())
            this.latched.add('fire');
        // Gamepad and touch crouch toggles (holding B while aiming is awkward); keys hold.
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
    /** True once per press. 'throw' shares the fire button. */
    consume(action) {
        if (!this.enabled)
            return false;
        return this.latched.delete(action === 'throw' ? 'fire' : action);
    }
    down(action) {
        if (!this.enabled)
            return false;
        if (action === 'fire' || action === 'throw')
            return !this.fireGate && this.#fireHeld();
        if (action === 'sprint')
            return this.sprinting();
        if (action === 'crouch')
            return this.crouching();
        return this.kit.down(action);
    }
    /** Ignore the fire button until it is released (after a throw, or a menu). */
    gateFire() { this.fireGate = true; this.latched.delete('fire'); }
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
    movement() {
        if (!this.enabled)
            return { x: 0, z: 0, sprint: false, crouch: false, jump: false };
        const mv = this.kit.vector('move');
        return { x: mv.x, z: -mv.y, sprint: this.sprinting(), crouch: this.crouching(), jump: this.consume('jump') };
    }
    /** Radians of turn this frame, sensitivity and invert-Y already applied by the kit settings. */
    look() {
        return this.enabled ? this.kit.look('look') : { x: 0, y: 0 };
    }
    resetToggles() { this.crouchToggle = false; this.sprintLatch = false; }
    clear() { this.latched.clear(); this.resetToggles(); }
    dispose() { this.clear(); this.enabled = false; }
}
