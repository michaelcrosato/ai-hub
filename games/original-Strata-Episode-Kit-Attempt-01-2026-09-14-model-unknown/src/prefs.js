/**
 * Player preferences for the first-person episodes, kept in this browser. Look sensitivity,
 * invert-Y and graphics quality moved to the wall's shared settings panel (one choice for
 * every game); what stays here is this game's own: field of view, head movement, sound,
 * sentry difficulty and keyboard bindings.
 */
const KEY = 'strata.fps.preferences.v1';

// Ctrl is no longer a default crouch key: Ctrl+W (crouch while walking) closes the browser tab.
export const DEFAULT_BINDINGS = Object.freeze({
    forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC'], interact: ['KeyE'], reload: ['KeyR'], respawn: ['KeyT'],
});
export const REBINDABLE = Object.keys(DEFAULT_BINDINGS);
// Esc and P pause, F9 opens the settings panel, J and the mouse fire: those stay fixed.
const RESERVED = new Set(['Escape', 'KeyP', 'KeyJ', 'F9']);
const CODE = /^(?:Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|Backspace|Quote|Semicolon|Comma|Period|Slash|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash)$/;
export const validCode = code => typeof code === 'string' && CODE.test(code) && !RESERVED.has(code);

export const DIFFICULTIES = Object.freeze({
    relaxed: { label: 'Relaxed', damage: .6, reload: 1.35 },
    standard: { label: 'Standard', damage: 1, reload: 1 },
    hard: { label: 'Hard', damage: 1.45, reload: .78 },
});

export function loadPrefs() {
    const p = { fov: 78, headBob: .2, volume: .15, difficulty: 'standard', bindings: structuredClone(DEFAULT_BINDINGS) };
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if (raw && typeof raw === 'object') {
            if (typeof raw.fov === 'number' && raw.fov >= 60 && raw.fov <= 110)
                p.fov = raw.fov;
            if (typeof raw.headBob === 'number' && raw.headBob >= 0 && raw.headBob <= 1)
                p.headBob = raw.headBob;
            if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= .4)
                p.volume = raw.volume;
            if (Object.hasOwn(DIFFICULTIES, raw.difficulty))
                p.difficulty = raw.difficulty;
            if (raw.bindings && typeof raw.bindings === 'object')
                for (const action of REBINDABLE) {
                    const codes = raw.bindings[action];
                    // Saved by the old build: mouse buttons, the Ctrl crouch and duplicates are dropped.
                    if (Array.isArray(codes)) {
                        const valid = [...new Set(codes.filter(validCode))].slice(0, 4);
                        if (valid.length)
                            p.bindings[action] = valid;
                    }
                }
        }
    }
    catch {
        /* defaults */
    }
    return p;
}

export function savePrefs(p) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ fov: p.fov, headBob: p.headBob, volume: p.volume, difficulty: p.difficulty, bindings: p.bindings }));
        return true;
    }
    catch {
        return false;
    }
}

/** A short label for a KeyboardEvent.code: KeyW → W, ArrowUp → ↑, ShiftLeft → Shift. */
export function keyLabel(code) {
    if (code.startsWith('Key'))
        return code.slice(3);
    if (code.startsWith('Digit'))
        return code.slice(5);
    const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    if (arrows[code])
        return arrows[code];
    return code.replace(/(Left|Right)$/, '') || code;
}
export const keysLabel = codes => [...new Set(codes.map(keyLabel))].join(' / ');
