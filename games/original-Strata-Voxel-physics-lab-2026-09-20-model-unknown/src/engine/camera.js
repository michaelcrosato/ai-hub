import { Vector3, MathUtils } from 'three/webgpu';

const MIN_POLAR = Math.PI * 0.07, MAX_POLAR = Math.PI * 0.48;
const _offset = new Vector3(), _right = new Vector3(), _up = new Vector3(), _forward = new Vector3();

/**
 * A damped orbit camera driven by kit.input actions (it replaces OrbitControls, which
 * listened to the canvas itself). Goals move instantly; the view eases towards them.
 */
export class OrbitCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new Vector3(-0.5, 1.65, -0.4); this.goal = this.target.clone();
    this.theta = 0.66; this.phi = 1.12; this.radius = 25;
    this.goalTheta = this.theta; this.goalPhi = this.phi; this.goalRadius = this.radius;
    this.minDistance = 3; this.maxDistance = 75;
    this.bounds = null; this.flying = false; this.shakeAmount = 0; this.shakeTime = 0;
  }
  /** Keep the target inside the area (x/z half-extent in metres). */
  setBounds(half) { this.bounds = half; this.clampGoal(); }
  clampGoal() {
    if (this.bounds) {
      this.goal.x = MathUtils.clamp(this.goal.x, -this.bounds, this.bounds);
      this.goal.z = MathUtils.clamp(this.goal.z, -this.bounds, this.bounds);
    }
    this.goal.y = MathUtils.clamp(this.goal.y, -2, 24);
    this.goalRadius = MathUtils.clamp(this.goalRadius, this.minDistance, this.maxDistance);
  }
  orbit(dTheta, dPhi) {
    this.goalTheta += dTheta;
    this.goalPhi = MathUtils.clamp(this.goalPhi + dPhi, MIN_POLAR, MAX_POLAR);
    this.flying = false;
  }
  /** factor < 1 moves in. */
  zoom(factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.goalRadius = MathUtils.clamp(this.goalRadius * factor, this.minDistance, this.maxDistance);
  }
  /** Move across the ground, relative to where the camera faces. x right, y forward, in metres. */
  panGround(x, y) {
    _right.set(Math.cos(this.goalTheta), 0, -Math.sin(this.goalTheta));
    _forward.set(-Math.sin(this.goalTheta), 0, -Math.cos(this.goalTheta));
    this.goal.addScaledVector(_right, x).addScaledVector(_forward, y);
    this.flying = false; this.clampGoal();
  }
  /** Drag the view like OrbitControls' screen-space pan; dx/dy in CSS pixels. */
  panScreen(dx, dy, viewportHeight) {
    const perPixel = 2 * this.radius * Math.tan(MathUtils.degToRad(this.camera.fov) / 2) / Math.max(1, viewportHeight);
    const st = Math.sin(this.theta), ct = Math.cos(this.theta), sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    _right.set(ct, 0, -st); _up.set(-cp * st, sp, -cp * ct);
    this.goal.addScaledVector(_right, -dx * perPixel).addScaledVector(_up, dy * perPixel);
    this.flying = false; this.clampGoal();
  }
  /** Ease to a new view. Omitted values keep the current goal. */
  flyTo(target, { radius, theta, phi } = {}) {
    if (target) this.goal.fromArray(Array.isArray(target) ? target : target.toArray());
    if (radius !== undefined) this.goalRadius = radius;
    if (phi !== undefined) this.goalPhi = MathUtils.clamp(phi, MIN_POLAR, MAX_POLAR);
    if (theta !== undefined) {
      // Take the short way round.
      const turn = ((theta - this.goalTheta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      this.goalTheta += turn;
    }
    this.clampGoal(); this.flying = true;
  }
  /** Jump straight to the goal (after an area load). */
  snap() {
    this.target.copy(this.goal); this.theta = this.goalTheta; this.phi = this.goalPhi; this.radius = this.goalRadius;
    this.flying = false; this.apply(0);
  }
  shake(amount) { this.shakeAmount = Math.min(0.35, Math.max(this.shakeAmount, amount)); }
  update(dt) {
    const rate = this.flying ? 5.5 : 14, k = 1 - Math.exp(-rate * dt);
    this.target.lerp(this.goal, k);
    this.theta += (this.goalTheta - this.theta) * k;
    this.phi += (this.goalPhi - this.phi) * k;
    this.radius += (this.goalRadius - this.radius) * k;
    if (this.flying && this.target.distanceToSquared(this.goal) < 1e-4 && Math.abs(this.goalRadius - this.radius) < 0.01) this.flying = false;
    this.apply(dt);
  }
  apply(dt) {
    const sp = Math.sin(this.phi);
    _offset.set(sp * Math.sin(this.theta), Math.cos(this.phi), sp * Math.cos(this.theta)).multiplyScalar(this.radius);
    this.camera.position.copy(this.target).add(_offset);
    this.camera.lookAt(this.target);
    if (this.shakeAmount > 0.001) {
      this.shakeTime += dt;
      const s = this.shakeAmount * Math.min(1, this.radius / 20);
      this.camera.position.x += Math.sin(this.shakeTime * 71) * s * 0.5;
      this.camera.position.y += Math.sin(this.shakeTime * 83 + 1.3) * s * 0.4;
      this.camera.position.z += Math.sin(this.shakeTime * 59 + 2.1) * s * 0.5;
      this.shakeAmount *= Math.exp(-dt * 7);
    } else this.shakeAmount = 0;
    this.camera.updateMatrixWorld();
  }
}
