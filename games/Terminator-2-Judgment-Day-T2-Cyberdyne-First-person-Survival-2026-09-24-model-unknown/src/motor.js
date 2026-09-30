import { clamp, moveToward } from './math.js';

export const defaultMotor = {
  walkSpeed: 5.5, sprintSpeed: 9, crouchSpeed: 2.6, acceleration: 38,
  airAcceleration: 12, friction: 30, jumpSpeed: 8, gravity: 24,
  coyoteTime: 0.11, jumpBuffer: 0.14, stepHeight: 0.32, maxSlope: 46,
  fov: 78, sensitivity: 0.002, headBob: 0.35,
};

/** Pure first-person movement policy; the game clamps the result to the balcony. */
export class Motor {
  vx = 0;
  vy = 0;
  vz = 0;
  grounded = false;
  crouched = false;
  coyote = 0;
  buffer = 0;
  jumped = false;
  out = { x: 0, y: 0, z: 0 };
  constructor(settings) {
    this.settings = settings;
  }
  update(dt, input, yaw) {
    this.coyote = this.grounded && !this.jumped ? this.settings.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.grounded && this.vy <= 0) this.jumped = false;
    this.buffer = input.jump ? this.settings.jumpBuffer : Math.max(0, this.buffer - dt);
    const length = Math.hypot(input.x, input.z);
    const nx = input.x / Math.max(1, length), nz = input.z / Math.max(1, length);
    const speed = this.crouched ? this.settings.crouchSpeed : input.sprint ? this.settings.sprintSpeed : this.settings.walkSpeed;
    const tx = (nx * Math.cos(yaw) + nz * Math.sin(yaw)) * speed;
    const tz = (-nx * Math.sin(yaw) + nz * Math.cos(yaw)) * speed;
    const rate = this.grounded ? (length > 0 ? this.settings.acceleration : this.settings.friction) : this.settings.airAcceleration;
    // Limit vector acceleration, not each axis, to avoid diagonal acceleration gains.
    const dx = tx - this.vx, dz = tz - this.vz, distance = Math.hypot(dx, dz);
    const factor = distance > 0 ? Math.min(1, (rate * dt) / distance) : 0;
    this.vx += dx * factor;
    this.vz += dz * factor;
    if (this.buffer > 0 && this.coyote > 0 && !this.jumped) {
      this.vy = this.settings.jumpSpeed;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumped = true;
    } else if (this.grounded && this.vy <= 0) this.vy = -2;
    else this.vy = clamp(this.vy - this.settings.gravity * dt, -50, 30);
    const o = this.out;
    o.x = this.vx * dt;
    o.y = this.vy * dt;
    o.z = this.vz * dt;
    return o;
  }
  reset() {
    this.vx = this.vy = this.vz = this.coyote = this.buffer = 0;
    this.grounded = this.jumped = this.crouched = false;
  }
  brake(dt) {
    this.vx = moveToward(this.vx, 0, 40 * dt);
    this.vz = moveToward(this.vz, 0, 40 * dt);
  }
}
