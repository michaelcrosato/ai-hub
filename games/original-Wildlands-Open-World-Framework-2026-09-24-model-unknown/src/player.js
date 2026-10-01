// player.js — fixed-step kinematic walking, swimming and flight over the terrain.
// World coordinates stay in double precision; the camera is placed relative to the
// render origin. Controls arrive as a plain object built from kit.input actions.

/** Small double-precision vector for renderer-independent movement. */
export class MotionVector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize() { return this.multiplyScalar(1 / (Math.sqrt(this.lengthSq()) || 1)); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
}
export const clampNumber = (x, a, b) => Math.max(a, Math.min(b, x));
const lerpNumber = (a, b, t) => a + (b - a) * t;

export class PlayerSystem {
  constructor(camera, terrain, generator, events, config) {
    this.camera = camera; this.terrain = terrain; this.generator = generator; this.events = events; this.config = config;
    const C = config;
    this.position = new MotionVector(C.start.x, generator.groundHeight(C.start.x, C.start.z) + C.eyeHeight, C.start.z);
    this.yaw = C.start.yaw; this.pitch = C.start.pitch; this.velocity = new MotionVector(); this.mode = 'walk'; this.grounded = true; this.swimming = false;
    this.speedScale = 1; this.lookScale = 0.0019 / 0.0024; this.jumpHeld = false; this.active = false;
    this.origin = { x: 0, z: 0 }; this.travelled = 0; this.bob = 0; this.bobAmount = 0; this.fov = C.fov;
    this.forward = new MotionVector(); this.right = new MotionVector(); this.targetV = new MotionVector();
  }
  toggleFlight() { this.mode = this.mode === 'fly' ? 'walk' : 'fly'; this.velocity.set(0, 0, 0); this.events.emit('player:mode', this.mode); }
  /** Turn by a kit look delta (radians, sensitivity applied by the kit and by the game's own slider). */
  look(dx, dy) { this.yaw -= dx * this.lookScale; this.pitch = clampNumber(this.pitch - dy * this.lookScale, -1.52, 1.52); }
  /**
   * One fixed step. `ctl` = { x, y } move (-1..1, y forward), rise and sink held, run held.
   * The move vector is analog: a half-pushed stick walks at half speed.
   */
  step(dt, ctl) {
    if (!this.active) return;
    const C = this.config, p = this.position, oldX = p.x, oldZ = p.z;
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (this.mode === 'fly') this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.targetV.copy(this.forward).multiplyScalar(ctl.y).addScaledVector(this.right, ctl.x);
    if (this.mode === 'fly') {
      this.targetV.y += (ctl.rise ? 1 : 0) - (ctl.sink ? 1 : 0);
      if (this.targetV.lengthSq() > 1) this.targetV.normalize();
      this.targetV.multiplyScalar(C.flySpeed * this.speedScale * (ctl.run ? C.flyBoost : 1));
      this.velocity.lerp(this.targetV, 1 - Math.exp(-7 * dt)); p.addScaledVector(this.velocity, dt);
      const ground = this.terrain.groundHeight(p.x, p.z);
      p.y = Math.min(Math.max(p.y, ground + 1.3, C.seaLevel + 0.4), C.flyCeiling);
      if (p.y >= C.flyCeiling && this.velocity.y > 0) this.velocity.y = 0;
      this.swimming = false; this.grounded = false; this.jumpHeld = ctl.rise;
    } else {
      const floor = this.terrain.groundHeight(p.x, p.z);
      this.swimming = floor < C.seaLevel - 1.25 && p.y < C.seaLevel + C.eyeHeight + 1;
      const speed = (this.swimming ? 6.5 : ctl.run ? C.runSpeed : C.walkSpeed) * this.speedScale;
      if (this.targetV.lengthSq() > 1) this.targetV.normalize();
      this.targetV.multiplyScalar(speed);
      const ease = 1 - Math.exp(-12 * dt); this.velocity.x = lerpNumber(this.velocity.x, this.targetV.x, ease); this.velocity.z = lerpNumber(this.velocity.z, this.targetV.z, ease);
      let nx = p.x + this.velocity.x * dt, nz = p.z + this.velocity.z * dt;
      const newFloor = this.terrain.groundHeight(nx, nz);
      // Stop uphill motion into a cliff. This is not a rigid-body climbing model.
      if (this.grounded && !this.swimming && newFloor - floor > Math.max(0.6, Math.hypot(nx - p.x, nz - p.z) * 1.65)) { nx = p.x; nz = p.z; this.velocity.x = this.velocity.z = 0; }
      const contact = this.terrain.resolveCollision(nx, nz, p.y - C.eyeHeight); p.x = contact.x; p.z = contact.z;
      const jump = ctl.rise, wasGrounded = this.grounded;
      let jumped = false;
      if (jump && !this.jumpHeld && (this.grounded || this.swimming)) { this.velocity.y = C.jumpSpeed; this.grounded = false; jumped = true; this.events.emit('player:jump', this.swimming); }
      this.jumpHeld = jump;
      if (this.swimming) { const surface = C.seaLevel + 1.25; this.velocity.y += (surface - p.y) * 12 * dt; this.velocity.y *= Math.exp(-4 * dt); }
      else this.velocity.y -= C.gravity * dt;
      p.y += this.velocity.y * dt;
      const minY = this.terrain.groundHeight(p.x, p.z) + C.eyeHeight;
      // Stay on the ground walking down a slope instead of hopping off every step.
      const stepLength = Math.hypot(p.x - oldX, p.z - oldZ);
      if (wasGrounded && !jumped && !this.swimming && p.y > minY && p.y - minY < Math.max(0.35, stepLength * 1.2)) p.y = minY;
      if (p.y <= minY) {
        if (!this.grounded && this.velocity.y < -12) this.events.emit('player:land', Math.min(1, (-this.velocity.y - 12) / 20));
        p.y = minY; this.velocity.y = 0; this.grounded = true;
      } else this.grounded = false;
    }
    const distance = Math.hypot(p.x - oldX, p.z - oldZ); this.travelled += distance;
    const stepBefore = Math.floor(this.bob / Math.PI);
    this.bob += distance * 0.85;
    if (this.mode === 'walk' && (this.grounded || this.swimming) && Math.floor(this.bob / Math.PI) !== stepBefore) this.events.emit('player:step', this.swimming);
    // Head bob follows walking speed on the ground; none in flight or water.
    const target = this.mode === 'walk' && this.grounded && !this.swimming ? Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / C.runSpeed * 1.6) : 0;
    this.bobAmount += (target - this.bobAmount) * (1 - Math.exp(-8 * dt));
    if (!Number.isFinite(p.x + p.y + p.z) || p.y < -1000) this.teleport(C.start);
  }
  renderCamera(origin) {
    this.origin = origin;
    const bobY = this.bobAmount * (0.035 - Math.abs(Math.sin(this.bob)) * 0.07);
    this.camera.position.set(this.position.x - origin.x, this.position.y + bobY, this.position.z - origin.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ'); this.camera.updateMatrixWorld();
  }
  teleport(destination) {
    const C = this.config;
    const x = Number(destination.x), z = Number(destination.z); if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('Travel coordinates must be finite numbers.');
    const floor = Math.max(this.generator.groundHeight(x, z), C.seaLevel);
    this.position.set(x, Number.isFinite(destination.y) ? Math.max(destination.y, floor + C.eyeHeight) : floor + C.eyeHeight + (destination.lift || 0), z);
    this.yaw = Number.isFinite(destination.yaw) ? ((destination.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI : 0; this.pitch = Number.isFinite(destination.pitch) ? destination.pitch : -0.12;
    this.velocity.set(0, 0, 0); this.bobAmount = 0;
    if (destination.lift > 0) this.mode = 'fly';
    this.events.emit('player:teleport', { ...destination }); this.events.emit('player:mode', this.mode);
  }
  snapshot() { return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, pitch: this.pitch, mode: this.mode, travelled: this.travelled }; }
}
