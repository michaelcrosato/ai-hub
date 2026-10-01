import { emptyInput } from './game.js';
import { clamp, other, portraitView, viewYaw } from './math.js';

/**
 * Every control goes through kit.input actions. Player 1 owns the standard set
 * (keyboard, the first gamepad and the touch controls); player 2 in couch versus
 * owns the right-hand keyboard set and a second gamepad. In a one-player match
 * both keyboard sets drive player 1, so the arrow keys work too.
 */
export const ACTIONS = {
    move: { type: 'vector', keys: 'wasd', gamepad: 'leftStick+dpad', touch: 'stick' },
    // The first main-cluster touch button is the big one: Shoot.
    shoot: { keys: ['Space', 'KeyJ'], gamepad: ['X'], touch: 'Shoot' },
    pass: { keys: ['KeyX'], gamepad: ['A'], touch: 'Pass' },
    check: { keys: ['KeyC', 'KeyK'], gamepad: ['B'], touch: 'Hit' },
    turbo: { keys: ['ShiftLeft'], gamepad: ['RT'], touch: 'Turbo' },
    swap: { keys: ['Tab'], gamepad: ['LT'], touch: { label: 'Swap', slot: 'top' } },
    deke: { keys: ['KeyZ'], gamepad: ['Y'], touch: { label: 'Deke', slot: 'top' } },
    heat: { keys: ['KeyF'], gamepad: ['RB'], touch: { label: 'Heat', slot: 'top' } },
    line: { keys: ['KeyL'], gamepad: ['LB'], touch: { label: 'Lines', slot: 'top' } },
    goalie: { keys: ['KeyG'], gamepad: ['RS'] },
    // Player 2's keyboard set (and player 1's second set in a one-player match).
    move2: { type: 'vector', keys: 'arrows', gamepad: [] },
    shoot2: { keys: ['Enter', 'NumpadEnter'] },
    pass2: { keys: ['Slash'] },
    check2: { keys: ['Period'] },
    turbo2: { keys: ['ShiftRight'] },
    swap2: { keys: ['Backslash'] },
    deke2: { keys: ['Comma'] },
    heat2: { keys: ['Semicolon'] },
    line2: { keys: ['BracketRight'] },
    goalie2: { keys: ['BracketLeft'] },
    // Menus and match flow.
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    help: { keys: ['KeyH'] },
    camera: { keys: ['KeyV'], gamepad: ['Back'] },
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    ok: { gamepad: ['A'] },
    back: { gamepad: ['B'] },
};

/** game-input field → [player-1 action, player-2 keyboard action, standard gamepad button index]. */
const EDGES = [
    ['pass', 'pass', 'pass2', 0], ['check', 'check', 'check2', 1], ['deke', 'deke', 'deke2', 3],
    ['line', 'line', 'line2', 4], ['power', 'heat', 'heat2', 5], ['switch', 'swap', 'swap2', 6], ['goalie', 'goalie', 'goalie2', 11],
];
const PAD_DEADZONE = .18;

/** Button prompts for the active device. */
const PROMPTS = {
    keyboard: { shoot: 'SPACE', pass: 'X', check: 'C', deke: 'Z', turbo: 'SHIFT', swap: 'TAB', heat: 'F', line: 'L', goalie: 'G', pause: 'ESC', skip: 'SPACE', start: 'ENTER', move: 'W A S D', camera: 'V', help: 'H' },
    gamepad: { shoot: 'X', pass: 'A', check: 'B', deke: 'Y', turbo: 'RT', swap: 'LT', heat: 'RB', line: 'LB', goalie: 'R3', pause: 'START', skip: 'A', start: 'A', move: 'L-STICK', camera: 'VIEW', help: 'START' },
    touch: { shoot: 'SHOOT', pass: 'PASS', check: 'HIT', deke: 'DEKE', turbo: 'TURBO', swap: 'SWAP', heat: 'HEAT', line: 'LINES', goalie: 'MENU', pause: 'II', skip: 'TAP', start: 'TAP', move: 'STICK', camera: 'MENU', help: 'MENU' },
};
export const prompt = (source, action) => (PROMPTS[source] ?? PROMPTS.keyboard)[action] ?? '';

export class Controls {
    constructor(kit) {
        this.kit = kit;
        this.input = kit.input;
        // Presses are latched here until a 60 Hz simulation step consumes them, so a tap on a
        // high-refresh display (frames without a step) is never lost.
        this.pending = [emptyInput(), emptyInput()];
        this.padPrev = [];
        this.pad2 = null;
        this.pad2Pause = false;
    }
    /** The second connected gamepad (the kit reads the first one). */
    readPad2() {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        const first = this.input.pad;
        let pad = null;
        for (const p of list)
            if (p && p.connected && (!first || p.index !== first.index)) {
                pad = p;
                break;
            }
        const now = [];
        if (pad)
            for (let i = 0; i < 16; i++) {
                const b = pad.buttons[i];
                now[i] = !!b && (b.pressed || b.value > .5);
            }
        const prev = this.padPrev;
        this.padPrev = now;
        this.pad2 = pad ? { pad, now, edge: (i) => !!now[i] && !prev[i], up: (i) => !now[i] && !!prev[i] } : null;
        this.pad2Pause = !!this.pad2?.edge(9);
    }
    /**
     * Read this frame's actions into the pending frames (call readPad2() first). With
     * edges false the presses of this frame are dropped (a menu or skip already used them).
     */
    gather(game, edges = true) {
        const inp = this.input, versus = game.settings.players === 2, p1 = this.pending[0], p2 = this.pending[1];
        const write = (frame, x, y, shootDown, turboDown) => {
            frame.x = clamp(x, -1, 1);
            frame.z = clamp(-y, -1, 1);
            frame.shoot = shootDown;
            frame.turbo = turboDown;
        };
        // Player 1: standard actions, plus the right-hand set when nobody else is playing.
        const a = inp.vector('move'), b = versus ? null : inp.vector('move2');
        let x = a.x + (b ? b.x : 0), y = a.y + (b ? b.y : 0);
        const len = Math.hypot(x, y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        write(p1, x, y, inp.down('shoot') || (!versus && inp.down('shoot2')), inp.down('turbo') || (!versus && inp.down('turbo2')));
        if (edges) {
            p1.shootPressed ||= inp.pressed('shoot') || (!versus && inp.pressed('shoot2'));
            p1.shootReleased ||= inp.released('shoot') || (!versus && inp.released('shoot2'));
            for (const [field, one, two] of EDGES)
                p1[field] ||= inp.pressed(one) || (!versus && inp.pressed(two));
        }
        // Player 2: right-hand keyboard set and the second gamepad.
        if (versus) {
            const k = inp.vector('move2'), pad = this.pad2;
            let px = k.x, py = k.y;
            if (pad) {
                const ax = pad.pad.axes[0] || 0, ay = pad.pad.axes[1] || 0;
                if (Math.abs(ax) > PAD_DEADZONE)
                    px += ax;
                if (Math.abs(ay) > PAD_DEADZONE)
                    py -= ay;
                px += (pad.now[15] ? 1 : 0) - (pad.now[14] ? 1 : 0);
                py += (pad.now[12] ? 1 : 0) - (pad.now[13] ? 1 : 0);
            }
            const l2 = Math.hypot(px, py);
            if (l2 > 1) {
                px /= l2;
                py /= l2;
            }
            write(p2, px, py, inp.down('shoot2') || !!pad?.now[2], inp.down('turbo2') || !!pad?.now[7]);
            if (edges) {
                p2.shootPressed ||= inp.pressed('shoot2') || !!pad?.edge(2);
                p2.shootReleased ||= inp.released('shoot2') || !!pad?.up(2);
                for (const [field, , two, button] of EDGES)
                    p2[field] ||= inp.pressed(two) || !!pad?.edge(button);
            }
        }
        else
            Object.assign(p2, emptyInput());
    }
    /** Drop every latched press (menus, pauses, skips). */
    discard() {
        for (const f of this.pending) {
            f.shootPressed = f.shootReleased = false;
            for (const [field] of EDGES)
                f[field] = false;
        }
    }
    /**
     * The input frames for one simulation step, indexed by team. The first call after
     * gather() carries the latched presses; later calls in the same frame carry only
     * what is held (like the original's heldOnly frames).
     */
    consume(game, width, height) {
        const out = [emptyInput(), emptyInput()], team = game.settings.team;
        const rotate = portraitView(width, height), yaw = viewYaw(width, height);
        const take = (src, dst) => {
            Object.assign(dst, src);
            if (rotate) {
                const x = src.x, z = src.z;
                dst.x = x * Math.cos(yaw) + z * Math.sin(yaw);
                dst.z = -x * Math.sin(yaw) + z * Math.cos(yaw);
            }
        };
        take(this.pending[0], out[team]);
        if (game.settings.players === 2)
            take(this.pending[1], out[other(team)]);
        else
            Object.assign(out[other(team)], emptyInput());
        this.discard();
        return out;
    }
}
