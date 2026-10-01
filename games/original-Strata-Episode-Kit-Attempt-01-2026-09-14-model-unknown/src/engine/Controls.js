/**
 * The FPS starter's control surface on top of the wall's kit.input actions. Keyboard and
 * mouse, gamepad and touch all arrive as the same actions; this adapter only adds what a
 * fixed-step simulation needs:
 *
 * - presses are held until a physics step consumes them, so a tap on a frame that runs no
 *   step (high refresh rates) or several steps (slow frames) counts exactly once;
 * - crouch toggles on a gamepad or touch screen (holding a button while steering a stick
 *   and aiming is not possible on glass) and is held on a keyboard;
 * - a touch stick pushed to the rim sprints.
 */
const LATCHED = ['jump', 'interact', 'reload', 'respawn', 'fire'];

export class Controls {
    input;
    enabled = false;
    pending = new Set();
    /** Ignore fire until the button is released (the click that captured the mouse). */
    suppressFire = false;
    crouchToggle = false;
    constructor(input) {
        this.input = input;
    }
    /** Once per rendered frame, before the fixed steps. */
    poll() {
        if (!this.enabled) {
            this.pending.clear();
            return;
        }
        for (const a of LATCHED)
            if (this.input.pressed(a))
                this.pending.add(a);
        if (this.suppressFire && !this.input.down('fire'))
            this.suppressFire = false;
        if (this.input.pressed('crouch') && this.input.source !== 'keyboard')
            this.crouchToggle = !this.crouchToggle;
        if (this.input.source === 'keyboard')
            this.crouchToggle = false;
    }
    /** After the frame's fixed steps: presses that no step looked at are dropped. */
    stepsDone(count) {
        if (count > 0)
            this.pending.clear();
    }
    #name(action) { return action === 'throw' ? 'fire' : action; }
    consume(action) {
        const a = this.#name(action);
        if (!this.enabled || (a === 'fire' && this.suppressFire))
            return false;
        return this.pending.delete(a);
    }
    down(action) {
        const a = this.#name(action);
        if (!this.enabled || (a === 'fire' && this.suppressFire))
            return false;
        if (a === 'crouch')
            return this.crouchToggle || this.input.down('crouch') && this.input.source === 'keyboard';
        return this.input.down(a);
    }
    get sprinting() {
        if (!this.enabled)
            return false;
        if (this.input.down('sprint'))
            return true;
        const v = this.input.vector('move');
        return this.input.source === 'touch' && Math.hypot(v.x, v.y) > .92;
    }
    movement() {
        const v = this.enabled ? this.input.vector('move') : { x: 0, y: 0 };
        const sprint = this.sprinting;
        // Sprinting stands a toggled crouch back up, as most shooters do.
        if (sprint && this.crouchToggle && Math.hypot(v.x, v.y) > .3)
            this.crouchToggle = false;
        return { x: v.x, z: -v.y, sprint, crouch: this.down('crouch'), jump: this.consume('jump') };
    }
    /** Radians of turn this frame (kit sensitivity and invert-Y applied). */
    look() { return this.enabled ? this.input.look('look') : { x: 0, y: 0 }; }
    clear() { this.pending.clear(); this.crouchToggle = false; }
}
