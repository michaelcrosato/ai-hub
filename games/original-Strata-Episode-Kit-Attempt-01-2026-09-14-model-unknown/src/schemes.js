/**
 * Input schemes. Each episode owns its controls, so each scheme defines every action name
 * the page uses (unused ones inert), and switching schemes rebuilds the touch controls.
 * Bindings follow the wall's standard table: WASD/arrows + mouse, gamepad, touch.
 */
const INERT = {
    move: { type: 'vector', keys: null, gamepad: [] },
    look: { type: 'look', mouse: 'locked', gamepad: [] },
    gas: {}, rev: {}, brake: {}, camera: {}, reset: {},
    fire: {}, jump: {}, interact: {}, reload: {}, crouch: {}, sprint: {}, respawn: {},
    pause: {}, confirm: {}, back: {},
};

/** Menus: arrows / D-pad / stick move focus, A confirms, B or Esc goes back, Start resumes. */
export function menuScheme() {
    return {
        ...INERT,
        move: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
        confirm: { gamepad: ['A'] },
        back: { keys: ['Escape'], gamepad: ['B'] },
        pause: { gamepad: ['Start'] },
    };
}

/** First person: the FPS starter's actions, keyboard keys from the player's own bindings. */
export function fpsScheme(b) {
    return {
        ...INERT,
        move: { type: 'vector', keys: { up: b.forward, down: b.back, left: b.left, right: b.right }, gamepad: 'leftStick+dpad', touch: 'stick' },
        look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
        fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'Fire' },
        jump: { keys: b.jump, gamepad: ['A'], touch: 'Jump' },
        interact: { keys: b.interact, gamepad: ['Y'], touch: 'Use' },
        reload: { keys: b.reload, gamepad: ['X'], touch: 'Reload' },
        crouch: { keys: b.crouch, gamepad: ['B', 'RS'], touch: 'Crouch' },
        sprint: { keys: b.sprint, gamepad: ['LS'] },
        respawn: { keys: b.respawn, gamepad: ['Back'], touch: { label: 'Restart', slot: 'top' } },
        pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    };
}

/** Driving: steer on the stick, Gas/Rev on the triggers, brake, camera, reset. */
export function driveScheme() {
    return {
        ...INERT,
        move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
        gas: { keys: ['KeyW', 'ArrowUp'], gamepad: ['RT', 'A'], touch: 'Gas' },
        rev: { keys: ['KeyS', 'ArrowDown'], gamepad: ['LT'], touch: 'Rev' },
        brake: { keys: ['Space'], gamepad: ['B', 'X'], touch: 'Brake' },
        camera: { keys: ['KeyV'], gamepad: ['Y', 'RB'], touch: { label: 'View', slot: 'top' } },
        reset: { keys: ['KeyR'], gamepad: ['Back'], touch: { label: 'Reset', slot: 'top' } },
        pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    };
}

export function applyScheme(kit, actions) {
    kit.input.define(actions);
    kit.touch?.rebuild();
    // Whatever is held while the scheme changes (the button that opened a menu) is not a press.
    kit.input.settle();
}

/** The label for one action on the device the player is using right now. */
const GLYPHS = {
    keyboard: { fire: 'Click', throw: 'Click', pause: 'Esc', gas: 'W', rev: 'S', brake: 'Space', camera: 'V', reset: 'R' },
    gamepad: { fire: 'RT', throw: 'RT', jump: 'A', interact: 'Y', reload: 'X', crouch: 'B', sprint: 'LS', respawn: 'Back', pause: 'Start', gas: 'RT', rev: 'LT', brake: 'B', camera: 'Y', reset: 'Back', confirm: 'A', back: 'B' },
    touch: { fire: 'Fire', throw: 'Fire', jump: 'Jump', interact: 'Use', reload: 'Reload', crouch: 'Crouch', sprint: 'Push stick', respawn: 'Restart', pause: 'II', gas: 'Gas', rev: 'Rev', brake: 'Brake', camera: 'View', reset: 'Reset' },
};
export function glyph(source, action, keyboardFallback = '') {
    const set = GLYPHS[source] ?? GLYPHS.keyboard;
    return set[action] ?? (source === 'keyboard' || !GLYPHS[source] ? keyboardFallback || action : action);
}
