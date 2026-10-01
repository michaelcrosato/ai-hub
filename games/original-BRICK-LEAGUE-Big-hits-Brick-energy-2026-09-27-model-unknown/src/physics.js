import { v3, GRAVITY, WALL, FAIR } from './math.js';

/**
 * The batted ball: ballistic flight at a fixed 120 Hz, damped bounces on the turf and
 * a bounce off the outfield wall. Small and deterministic, so no physics engine is needed.
 */
export class BallPhysics {
  constructor() {
    this.name = 'Ball physics 120 Hz';
    this.state = { position: v3(), velocity: v3(), grounded: false, active: false };
    this.accumulator = 0;
  }
  launch(p, v) {
    this.state = { position: { ...p }, velocity: { ...v }, grounded: false, active: true };
    this.accumulator = 0;
  }
  step(dt) {
    if (!this.state.active) return this.state;
    this.accumulator += Math.min(dt, 0.1);
    const h = 1 / 120;
    while (this.accumulator >= h) {
      this.accumulator -= h;
      const s = this.state;
      s.velocity.y -= GRAVITY * h;
      s.position.x += s.velocity.x * h;
      s.position.y += s.velocity.y * h;
      s.position.z += s.velocity.z * h;
      if (s.position.y < 0.3) {
        s.position.y = 0.3;
        s.grounded = true;
        if (Math.abs(s.velocity.y) > 1.5) s.velocity.y = Math.abs(s.velocity.y) * 0.32;
        else s.velocity.y = 0;
        s.velocity.x *= 0.982;
        s.velocity.z *= 0.982;
      }
      const r = Math.hypot(s.position.x, s.position.z);
      if (r > WALL && s.position.y < 4 && FAIR(s.position)) {
        const nx = s.position.x / r;
        const nz = s.position.z / r;
        const dot = s.velocity.x * nx + s.velocity.z * nz;
        s.position.x = nx * (WALL - 0.1);
        s.position.z = nz * (WALL - 0.1);
        if (dot > 0) {
          s.velocity.x -= 1.58 * dot * nx;
          s.velocity.z -= 1.58 * dot * nz;
        }
      }
    }
    return this.state;
  }
  stop() {
    this.state.active = false;
  }
  dispose() {
    this.stop();
  }
}
