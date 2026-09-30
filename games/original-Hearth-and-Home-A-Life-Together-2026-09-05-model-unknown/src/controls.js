/**
 * controls.js — the game's actions for kit.input, and gamepad / arrow-key
 * navigation of its DOM menus.
 *
 * Hearth & Home is a pointer game: rooms are clicked or tapped on the canvas
 * (kit.input.pointer), the house turns with a drag, the wheel or pinch zooms,
 * and every activity is also a real button. A gamepad (or the arrow keys)
 * moves focus between those buttons, A presses the focused one and B backs
 * out, so the whole game plays without a mouse.
 */

export const INPUT = {
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Escape'], gamepad: ['B'] },
    menu: { keys: ['KeyP'], gamepad: ['Start'] },
    play: { keys: ['Space'], gamepad: ['X'] },
    endDay: { keys: ['KeyN'], gamepad: ['Y'] },
    help: { keys: ['KeyH'], gamepad: ['Back'] },
    music: { keys: ['KeyM'] },
    walls: { keys: ['KeyC'], gamepad: ['LS'] },
    resetView: { keys: ['KeyR'], gamepad: ['RS'] },
    prevCat: { keys: ['BracketLeft'], gamepad: ['LT'] },
    nextCat: { keys: ['BracketRight'], gamepad: ['RT'] },
    cat1: { keys: ['Digit1', 'Numpad1'] },
    cat2: { keys: ['Digit2', 'Numpad2'] },
    cat3: { keys: ['Digit3', 'Numpad3'] },
    cat4: { keys: ['Digit4', 'Numpad4'] },
    cat5: { keys: ['Digit5', 'Numpad5'] },
    cat6: { keys: ['Digit6', 'Numpad6'] },
};

/** Browser shortcuts (Ctrl/Cmd/Alt + key) are not game hotkeys. */
let modifier = false;
const trackModifiers = (e) => { modifier = e.ctrlKey || e.metaKey || e.altKey; };
addEventListener('keydown', trackModifiers, true);
addEventListener('keyup', trackModifiers, true);
addEventListener('blur', () => { modifier = false; });
export const modifierHeld = () => modifier;

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), a[href], [tabindex="0"]:not(canvas)';
const root = document.documentElement;
// The focus ring shows while navigating with a pad or the arrows, and hides again for the mouse.
addEventListener('pointerdown', () => root.classList.remove('nav-focus'), true);

/** Where navigation happens: the dialog on top, else an open activity drawer, else the whole home screen. */
function scope() {
    const modals = document.querySelectorAll('.modal-shade > .modal');
    if (modals.length)
        return modals[modals.length - 1];
    return document.querySelector('.activity-drawer') || document.querySelector('.app');
}
const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
function candidates(area) {
    return area ? [...area.querySelectorAll(FOCUSABLE)].filter(shown) : [];
}
/**
 * Bring a control into view inside its own scrolling panel (a sidebar, a dialog, the
 * activity grid). scrollIntoView would also shift the overflow-hidden page layout.
 */
function reveal(el) {
    let doneX = false, doneY = false;
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body && !(doneX && doneY); p = p.parentElement) {
        const cs = getComputedStyle(p), pr = p.getBoundingClientRect();
        if (!doneY && /auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) {
            doneY = true;
            if (r.top < pr.top)
                p.scrollTop -= pr.top - r.top + 10;
            else if (r.bottom > pr.bottom)
                p.scrollTop += r.bottom - pr.bottom + 10;
        }
        if (!doneX && /auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth) {
            doneX = true;
            if (r.left < pr.left)
                p.scrollLeft -= pr.left - r.left + 10;
            else if (r.right > pr.right)
                p.scrollLeft += r.right - pr.right + 10;
        }
    }
}
function focus(el) {
    root.classList.add('nav-focus');
    el.focus({ preventScroll: true });
    reveal(el);
}

/** Spatial focus movement for gamepad and arrow keys, with auto-repeat while held. */
export function createMenuNav(input) {
    let held = null, repeatAt = 0;

    function move(dx, dy) {
        const area = scope(), list = candidates(area), current = document.activeElement;
        if (!list.length)
            return;
        if (!current || !list.includes(current)) {
            focus(list[0]);
            return;
        }
        const a = current.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of list) {
            if (el === current)
                continue;
            const b = el.getBoundingClientRect();
            // Distance from the edge facing the move, so wide and narrow neighbours compare fairly.
            const bx = Math.max(b.left, Math.min(ax, b.right)), by = Math.max(b.top, Math.min(ay, b.bottom));
            const vx = (dx ? b.left + b.width / 2 : bx) - ax, vy = (dy ? b.top + b.height / 2 : by) - ay;
            const along = vx * dx + vy * dy;
            if (along <= 2)
                continue;
            const across = Math.abs(vx * dy - vy * dx);
            const score = along + across * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = el;
            }
        }
        if (best)
            focus(best);
    }

    return {
        /** Call every frame with the kit's time in seconds. */
        update(t) {
            const v = input.vector('nav');
            let dir = null;
            if (Math.hypot(v.x, v.y) > 0.5)
                dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
            if (!dir) {
                held = null;
                return;
            }
            if (dir === held && t < repeatAt)
                return;
            repeatAt = t + (dir === held ? 0.14 : 0.4);
            held = dir;
            move(dir === 'right' ? 1 : dir === 'left' ? -1 : 0, dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
        },
        /** A / Enter: press the focused control, or put focus somewhere to start from. */
        confirm() {
            const area = scope(), el = document.activeElement;
            if (el && el !== area && area?.contains(el) && el.matches(FOCUSABLE)) {
                el.click();
                return;
            }
            const first = candidates(area)[0];
            if (first)
                focus(first);
        },
        /** Focus the first control matching a selector (or the first control) in the current area. */
        focusFirst(selector) {
            const list = candidates(scope());
            const el = (selector && list.find((n) => n.matches(selector))) || list[0];
            if (el)
                focus(el);
        },
    };
}
