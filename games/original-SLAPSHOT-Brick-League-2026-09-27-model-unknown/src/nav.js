/**
 * Gamepad (and arrow-key) navigation for the game's own DOM menus: the d-pad or
 * stick moves focus to the nearest control in that direction, A presses it,
 * left/right steps through a focused <select>, B goes back.
 */
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, a[href]';

function visible(el) {
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
        // Focus moved by the pad shows a ring; any pointer use clears it.
        addEventListener('pointerdown', () => this.clearMark(), true);
        addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'), true);
    }
    clearMark() { document.querySelector('.pad-focus')?.classList.remove('pad-focus'); }
    controls(roots) {
        const out = [];
        for (const root of roots)
            if (root)
                for (const el of root.querySelectorAll(FOCUSABLE))
                    if (visible(el))
                        out.push(el);
        return out;
    }
    focus(el) {
        this.clearMark();
        el.classList.add('pad-focus');
        el.focus({ preventScroll: true, focusVisible: true });
        el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    current(roots) {
        const a = document.activeElement;
        return a && a !== document.body && roots.some(r => r?.contains(a)) && a.matches(FOCUSABLE) ? a : null;
    }
    move(roots, dir, preferred) {
        const list = this.controls(roots);
        if (!list.length)
            return;
        const cur = this.current(roots);
        if (!cur) {
            this.focus(list.find(el => el.matches(preferred || '.primary-button, .play-button')) || list[0]);
            return;
        }
        if (cur.tagName === 'SELECT' && (dir === 'left' || dir === 'right')) {
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
        const options = [...select.options];
        let i = select.selectedIndex;
        for (let n = 0; n < options.length; n++) {
            i = (i + step + options.length) % options.length;
            if (!options[i].disabled)
                break;
        }
        if (i !== select.selectedIndex) {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    /** Press the focused control. Returns false when nothing in the menu has focus. */
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
     * Run once per frame while a menu is showing. roots: the elements that hold it.
     * Returns { ok, back } for presses the menu did not use itself.
     */
    update(roots, now, preferred) {
        const v = this.input.vector('nav');
        let dir = null;
        if (Math.max(Math.abs(v.x), Math.abs(v.y)) > .55)
            dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'up' : 'down');
        if (dir && (dir !== this.lastDir || now >= this.repeatAt)) {
            this.repeatAt = now + (dir !== this.lastDir ? .42 : .15);
            this.move(roots, dir, preferred);
        }
        this.lastDir = dir;
        let ok = false;
        if (this.input.pressed('ok'))
            ok = !this.activate(roots);
        return { ok, back: this.input.pressed('back') };
    }
}
