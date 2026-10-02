import { clamp, moveToward } from './math.js';
export const defaultMotor = {
    walkSpeed: 5.5, sprintSpeed: 9, crouchSpeed: 2.6, acceleration: 38,
    airAcceleration: 12, friction: 30, jumpSpeed: 8, gravity: 24,
    coyoteTime: .11, jumpBuffer: .14, stepHeight: .32, maxSlope: 46,
    fov: 78, sensitivity: .002, headBob: .35,
};
/** Pure movement policy. Collision response is supplied by the physics adapter. */
export class Motor {
    settings;
    vx = 0;
    vy = 0;
    vz = 0;
    grounded = false;
    crouched = false;
    coyote = 0;
    buffer = 0;
    jumped = false;
    /** True for the one step in which a jump started (sound and feel). */
    jumpedNow = false;
    /** The displacement for this step. Reused every step: copy it if you keep it. */
    out = { x: 0, y: 0, z: 0 };
    constructor(settings) {
        this.settings = settings;
    }
    update(dt, input, yaw) {
        this.jumpedNow = false;
        this.coyote = this.grounded && !this.jumped ? this.settings.coyoteTime : Math.max(0, this.coyote - dt);
        if (this.grounded && this.vy <= 0)
            this.jumped = false;
        this.buffer = input.jump ? this.settings.jumpBuffer : Math.max(0, this.buffer - dt);
        const length = Math.hypot(input.x, input.z);
        const nx = input.x / Math.max(1, length), nz = input.z / Math.max(1, length);
        const speed = this.crouched ? this.settings.crouchSpeed : input.sprint ? this.settings.sprintSpeed : this.settings.walkSpeed;
        const tx = (nx * Math.cos(yaw) + nz * Math.sin(yaw)) * speed;
        const tz = (-nx * Math.sin(yaw) + nz * Math.cos(yaw)) * speed;
        const rate = this.grounded ? (length > 0 ? this.settings.acceleration : this.settings.friction) : this.settings.airAcceleration;
        // Limit vector acceleration, not each axis, to avoid diagonal acceleration gains.
        const dx = tx - this.vx, dz = tz - this.vz, distance = Math.hypot(dx, dz);
        const factor = distance > 0 ? Math.min(1, rate * dt / distance) : 0;
        this.vx += dx * factor;
        this.vz += dz * factor;
        if (this.buffer > 0 && this.coyote > 0 && !this.jumped) {
            this.vy = this.settings.jumpSpeed;
            this.buffer = 0;
            this.coyote = 0;
            this.grounded = false;
            this.jumped = true;
            this.jumpedNow = true;
        }
        else if (this.grounded && this.vy <= 0)
            this.vy = -2;
        else
            this.vy = clamp(this.vy - this.settings.gravity * dt, -50, 30);
        this.out.x = this.vx * dt;
        this.out.y = this.vy * dt;
        this.out.z = this.vz * dt;
        return this.out;
    }
    launch(speed) { this.vy = speed; this.grounded = false; this.coyote = 0; this.jumped = true; }
    reset() { this.vx = this.vy = this.vz = this.coyote = this.buffer = 0; this.grounded = this.jumped = this.crouched = this.jumpedNow = false; }
    brake(dt) { this.vx = moveToward(this.vx, 0, 40 * dt); this.vz = moveToward(this.vz, 0, 40 * dt); }
}
