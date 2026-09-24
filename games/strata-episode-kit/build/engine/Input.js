export const defaultBindings = {
    forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['ControlLeft', 'KeyC'], interact: ['KeyE'], respawn: ['KeyR'], throw: ['Mouse0'], fire: ['Mouse0'], reload: ['KeyR'],
};
export class Input {
    canvas;
    bindings = structuredClone(defaultBindings);
    keys = new Set();
    pressed = new Set();
    dx = 0;
    dy = 0;
    enabled = false;
    invertY = false;
    abort = new AbortController();
    constructor(canvas) {
        this.canvas = canvas;
        const signal = this.abort.signal;
        window.addEventListener('keydown', e => {
            if (!this.enabled || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName) || e.target?.isContentEditable)
                return;
            if (Object.values(this.bindings).some(keys => keys.includes(e.code)))
                e.preventDefault();
            if (!this.keys.has(e.code))
                this.pressed.add(e.code);
            this.keys.add(e.code);
        }, { signal });
        window.addEventListener('keyup', e => this.keys.delete(e.code), { signal });
        window.addEventListener('mousedown', e => {
            if (this.enabled && document.pointerLockElement === canvas) {
                this.pressed.add(`Mouse${e.button}`);
                this.keys.add(`Mouse${e.button}`);
            }
        }, { signal });
        window.addEventListener('mouseup', e => this.keys.delete(`Mouse${e.button}`), { signal });
        document.addEventListener('mousemove', e => {
            if (this.enabled && document.pointerLockElement === canvas) {
                this.dx += e.movementX;
                this.dy += e.movementY;
            }
        }, { signal });
        canvas.addEventListener('contextmenu', e => { if (this.enabled)
            e.preventDefault(); }, { signal });
        window.addEventListener('blur', () => this.clear(), { signal });
        document.addEventListener('pointerlockchange', () => this.clear(), { signal });
    }
    bind(action, codes) {
        if (!Object.hasOwn(this.bindings, action) || !Array.isArray(codes) || codes.length < 1 || codes.length > 4 || codes.some(c => !/^(?:Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|Backspace|Mouse[0-4])$/.test(c)))
            throw new Error('Invalid input binding.');
        this.bindings[action] = [...new Set(codes)];
        this.clear();
    }
    down(action) { return this.enabled && this.bindings[action].some(k => this.keys.has(k)); }
    consume(action) {
        let value = false;
        for (const key of this.bindings[action])
            if (this.pressed.delete(key))
                value = true;
        return this.enabled && value;
    }
    movement() { return { x: Number(this.down('right')) - Number(this.down('left')), z: Number(this.down('back')) - Number(this.down('forward')), sprint: this.down('sprint'), crouch: this.down('crouch'), jump: this.consume('jump') }; }
    look() {
        const value = [this.dx, this.invertY ? -this.dy : this.dy];
        this.dx = this.dy = 0;
        return value;
    }
    clear() { this.keys.clear(); this.pressed.clear(); this.dx = this.dy = 0; }
    dispose() { this.abort.abort(); this.clear(); }
}
