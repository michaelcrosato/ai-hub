/**
 * Gamepad and arrow-key navigation for the game's own DOM menus (the kit's settings panel
 * has its own). Up/down (and left/right outside sliders) move focus through the visible
 * controls of the active panel, A clicks, B / Esc calls the panel's back action. Mouse and
 * touch keep working on the same buttons; Tab and Enter stay native.
 */
const FOCUSABLE = 'button, a[href], summary, input:not([type=hidden]), select';

export class MenuNav {
    input;
    root = null;
    onBack = null;
    dir = 0;
    repeatAt = 0;
    constructor(input) {
        this.input = input;
    }
    /** Make `root` the active menu (null for none). `focus` gets focus now, if given. */
    set(root, { onBack = null, focus = null } = {}) {
        this.root = root;
        this.onBack = onBack;
        this.dir = 0;
        if (root && focus && typeof focus.focus === 'function')
            focus.focus({ preventScroll: true });
    }
    items() {
        if (!this.root)
            return [];
        return [...this.root.querySelectorAll(FOCUSABLE)].filter(e => !e.disabled && !e.closest('[hidden]') && e.getClientRects().length > 0 && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY'));
    }
    move(step) {
        const list = this.items();
        if (!list.length)
            return;
        const i = list.indexOf(document.activeElement);
        const next = i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
        list[next].focus({ preventScroll: false });
        list[next].scrollIntoView?.({ block: 'nearest' });
    }
    update(now = performance.now()) {
        const root = this.root;
        if (!root || root.hidden || !root.isConnected)
            return;
        const inp = this.input;
        const v = inp.vector('move');
        const dy = v.y > .55 ? -1 : v.y < -.55 ? 1 : 0;
        const dx = v.x > .55 ? 1 : v.x < -.55 ? -1 : 0;
        const dir = dy ? dy * 2 : dx;
        if (dir === 0)
            this.dir = 0;
        else if (dir !== this.dir || now >= this.repeatAt) {
            this.repeatAt = now + (dir !== this.dir ? 380 : 130);
            this.dir = dir;
            const a = document.activeElement;
            const inside = a && root.contains(a);
            if (dy)
                this.move(dy);
            else if (inside && a.type === 'range') {
                if (dx > 0)
                    a.stepUp();
                else
                    a.stepDown();
                a.dispatchEvent(new Event('input', { bubbles: true }));
            }
            else
                this.move(dx);
        }
        if (inp.pressed('confirm')) {
            const a = document.activeElement;
            if (a && root.contains(a) && a !== root)
                a.click();
            else
                this.move(1);
        }
        if (inp.pressed('back'))
            this.onBack?.();
    }
}
