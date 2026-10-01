// The broadcast camera: an orthographic view from behind the offense, high on the sideline
// corner. It frames the ball (or carrier), and project() maps world points to the CSS pixels
// of the 3D view, so HUD badges sit exactly on the players the GPU draws.
import { lerp } from './model.js';

export class CameraRig {
  target = { x: 0, y: 0, z: 0 };
  right = { x: 1, y: 0, z: 0 };
  up = { x: 0, y: 1, z: 0 };
  forward = { x: 0, y: 0, z: 1 };
  /** CSS pixels per world unit. */
  scale = 6;
  cx = 0;
  cy = 0;
  initialized = false;
  out = { x: 0, y: 0, depth: 0, visible: true };

  /** dt in seconds: smoothing is frame-rate independent (same feel at 60 and 144 Hz). */
  update(frame, w, h, dt = 1 / 60) {
    const lobby = frame.lobby;
    const dir = frame.direction;
    const tx = lobby ? 0 : frame.focus.x * 0.25;
    const tz = lobby ? 0 : frame.focus.z + dir * 7;
    // 0.08 and 0.1 per 60 Hz frame in the original, as rates.
    const follow = this.initialized ? 1 - Math.exp(-5 * dt) : 1;
    const zoom = this.initialized ? 1 - Math.exp(-6.3 * dt) : 1;
    this.initialized = true;
    this.target.x = lerp(this.target.x, tx, follow);
    this.target.z = lerp(this.target.z, tz, follow);
    this.target.y = 0;
    // Eye offset from the target (the view direction only; the camera is orthographic).
    const ex = -(lobby ? 83 : 53) * dir;
    const ey = lobby ? 78 : 65;
    const ez = -(lobby ? 103 : 69) * dir;
    const fx = -ex, fy = -ey, fz = -ez;
    const fl = Math.hypot(fx, fy, fz);
    const F = this.forward;
    F.x = fx / fl;
    F.y = fy / fl;
    F.z = fz / fl;
    const rl = Math.hypot(fz, fx);
    const R = this.right;
    R.x = -fz / rl;
    R.y = 0;
    R.z = fx / rl;
    const U = this.up;
    U.x = R.y * F.z - R.z * F.y;
    U.y = R.z * F.x - R.x * F.z;
    U.z = R.x * F.y - R.y * F.x;
    const desired = lobby ? Math.min(w / 162, h / 119) : Math.min(w / 118, h / (frame.camera === 'close' ? 62 : 82));
    this.scale = lerp(this.scale, desired, zoom);
    this.cx = w * (lobby ? 0.62 : 0.5);
    this.cy = h * 0.48;
    if (!lobby && frame.shake > 0) {
      this.cx += Math.sin(frame.time * 93) * frame.shake * 4;
      this.cy += Math.cos(frame.time * 86) * frame.shake * 3;
    }
  }

  /** World point → CSS pixels in the 3D view. Returns a reused object. */
  project(p) {
    const dx = p.x - this.target.x, dy = p.y, dz = p.z - this.target.z;
    const o = this.out;
    o.x = this.cx + (dx * this.right.x + dy * this.right.y + dz * this.right.z) * this.scale;
    o.y = this.cy - (dx * this.up.x + dy * this.up.y + dz * this.up.z) * this.scale;
    o.depth = dx * this.forward.x + dy * this.forward.y + dz * this.forward.z;
    o.visible = true;
    return o;
  }
}
