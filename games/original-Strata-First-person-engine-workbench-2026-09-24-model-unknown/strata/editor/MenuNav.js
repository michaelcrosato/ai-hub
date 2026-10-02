/**
 * Keyboard and gamepad navigation for the workbench's own cards (pause, results, levels):
 * arrows / D-pad / left stick move between buttons (held: repeats), Enter or A presses the
 * focused one, B (and Esc where the card allows it) goes back. Taps and clicks work as usual.
 */
export class MenuNav {
    input;
    #dir = 0;
    #hold = 0;
    constructor(kitInput) {
        this.input = kitInput;
    }
    /**
     * Run once per frame while a card is open.
     * @param {HTMLElement|null} root   the open card
     * @param {{ back?: () => void, escBack?: boolean }} [options]
     */
    update(dt, root, { back, escBack = true } = {}) {
        if (!root) {
            this.#dir = 0;
            return;
        }
        const k = this.input, v = k.vector('nav');
        const dir = v.y > .5 || v.x < -.5 ? -1 : v.y < -.5 || v.x > .5 ? 1 : 0;
        if (dir !== this.#dir) {
            this.#dir = dir;
            this.#hold = 0;
            if (dir)
                this.move(root, dir);
        }
        else if (dir) {
            this.#hold += dt;
            if (this.#hold > .4) {
                this.#hold -= .13;
                this.move(root, dir);
            }
        }
        if (k.pressed('confirm')) {
            const el = document.activeElement;
            if (el instanceof HTMLButtonElement && root.contains(el) && !el.disabled)
                el.click();
            else
                this.focusFirst(root);
        }
        else if (k.pressed('back') || (escBack && k.pressed('pause')))
            back?.();
    }
    items(root) {
        return [...root.querySelectorAll('button:not([disabled])')].filter(b => b.getClientRects().length > 0);
    }
    move(root, dir) {
        const items = this.items(root);
        if (!items.length)
            return;
        const i = items.indexOf(document.activeElement);
        const next = i < 0 ? (dir > 0 ? 0 : items.length - 1) : (i + dir + items.length) % items.length;
        items[next].focus();
        items[next].scrollIntoView?.({ block: 'nearest' });
    }
    focusFirst(root) {
        const preferred = root.querySelector('[data-autofocus]:not([disabled])');
        const target = preferred && preferred.getClientRects().length ? preferred : this.items(root)[0];
        target?.focus();
    }
}
