// Gamepad (and arrow-key) navigation for the game's own DOM menus: the d-pad or stick
// moves focus to the nearest control in that direction, A presses it, left/right steps
// a focused <select> or checkbox, B goes back. Keyboard Tab / Enter and mouse or touch
// keep working natively.
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled])';

function shown(el) {
    if (!el.getClientRects().length)
        return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
}

export class MenuNav {
    lastDir = null;
    repeatAt = 0;
    constructor(input) {
        this.input = input;
    }

    controls(roots) {
        const out = [];
        for (const root of roots)
            if (root && !root.hidden)
                for (const el of root.querySelectorAll(FOCUSABLE))
                    if (shown(el))
                        out.push(el);
        return out;
    }

    current(roots) {
        const a = document.activeElement;
        return a && a !== document.body && a.matches?.(FOCUSABLE) && roots.some(r => r?.contains(a)) ? a : null;
    }

    focus(el) {
        el.focus({ preventScroll: true, focusVisible: true });
        el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }

    move(roots, dir, preferred) {
        const list = this.controls(roots);
        if (!list.length)
            return;
        const cur = this.current(roots);
        if (!cur) {
            this.focus(list.find(el => preferred && el.matches(preferred)) || list[0]);
            return;
        }
        if ((dir === 'left' || dir === 'right') && cur.tagName === 'SELECT') {
            this.stepSelect(cur, dir === 'right' ? 1 : -1);
            return;
        }
        const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of list) {
            if (el === cur)
                continue;
            const q = el.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
            const along = dir === 'right' ? x : dir === 'left' ? -x : dir === 'down' ? y : -y;
            const across = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
            if (along <= 4)
                continue;
            const score = along + across * 2.2;
            if (score < bestScore) {
                bestScore = score;
                best = el;
            }
        }
        if (best)
            this.focus(best);
    }

    stepSelect(select, step) {
        const n = select.options.length;
        let i = select.selectedIndex;
        for (let k = 0; k < n; k++) {
            i = (i + step + n) % n;
            if (!select.options[i].disabled)
                break;
        }
        if (i !== select.selectedIndex) {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /** Press the focused control; false when nothing in the menu has focus. */
    activate(roots) {
        const cur = this.current(roots);
        if (!cur)
            return false;
        if (cur.tagName === 'SELECT')
            this.stepSelect(cur, 1);
        else
            cur.click();
        return true;
    }

    /**
     * Once per frame while a menu shows. Returns { ok, back }: ok when A was pressed with
     * nothing focused (the caller may press its main button), back for B.
     */
    update(roots, now, preferred) {
        const v = this.input.vector('move');
        let dir = null;
        if (Math.max(Math.abs(v.x), Math.abs(v.y)) > 0.55)
            dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'up' : 'down');
        if (dir && (dir !== this.lastDir || now >= this.repeatAt)) {
            this.repeatAt = now + (dir !== this.lastDir ? 0.42 : 0.15);
            this.move(roots, dir, preferred);
        }
        this.lastDir = dir;
        let ok = false;
        if (this.input.pressed('ok'))
            ok = !this.activate(roots);
        return { ok, back: this.input.pressed('back'), dir };
    }

    /** Edge-triggered direction with key-repeat, for non-focus menus (the playbook). */
    direction(now) {
        const v = this.input.vector('move');
        let dir = null;
        if (Math.max(Math.abs(v.x), Math.abs(v.y)) > 0.55)
            dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'up' : 'down');
        let out = null;
        if (dir && (dir !== this.lastDir || now >= this.repeatAt)) {
            this.repeatAt = now + (dir !== this.lastDir ? 0.42 : 0.18);
            out = dir;
        }
        this.lastDir = dir;
        return out;
    }
}
