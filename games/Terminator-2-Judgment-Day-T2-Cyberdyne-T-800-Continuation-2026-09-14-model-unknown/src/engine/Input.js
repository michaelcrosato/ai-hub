/**
 * The Strata input surface (down, consume, movement, look) on top of kit.input actions.
 * Keyboard, mouse, gamepad, and touch all arrive through the kit; nothing here listens to devices.
 *
 * The kit reports a press for one rendered frame, while the game consumes presses inside
 * fixed 60 Hz steps. A frame can run zero, one, or several steps, so presses are latched at
 * the start of each frame and consumed at most once. Presses that no step used are dropped
 * after the first frame that did run steps.
 */
const ALIAS = { throw: 'fire', respawn: 'lab' };
const LATCHED = ['fire', 'jump', 'reload', 'interact', 'vision', 'lab'];

export class Input {
    enabled = false;
    pending = new Set();
    constructor(kitInput) {
        this.kit = kitInput;
    }
    /** Once per rendered frame, before the fixed steps. */
    collect() {
        if (!this.enabled)
            return;
        for (const name of LATCHED)
            if (this.kit.pressed(name))
                this.pending.add(name);
    }
    /** After a frame that ran at least one fixed step. */
    flush() { this.pending.clear(); }
    clear() { this.pending.clear(); }
    down(action) { return this.enabled && this.kit.down(ALIAS[action] ?? action); }
    consume(action) { return this.enabled && this.pending.delete(ALIAS[action] ?? action); }
    movement() {
        if (!this.enabled)
            return { x: 0, z: 0, sprint: false, crouch: false, jump: false };
        const mv = this.kit.vector('move');
        // Touch has no sprint button: pushing the stick to its rim sprints.
        const sprint = this.kit.down('sprint') || (this.kit.source === 'touch' && Math.hypot(mv.x, mv.y) > .92);
        return { x: mv.x, z: -mv.y, sprint, crouch: this.kit.down('crouch'), jump: this.consume('jump') };
    }
    look() {
        return this.enabled ? this.kit.look('look') : { x: 0, y: 0 };
    }
}
