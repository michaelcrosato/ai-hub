/** This episode owns its arcade vehicle model. It does not use the FPS motor or Rapier. */
import { clamp, moveToward } from '../../core/math.js';
export class CarModel {
    x = 0;
    z = 4;
    yaw = 0;
    speed = 0;
    distance = 0;
    collisions = 0;
    impactCooldown = 0;
    radius = 1.1;
    step(dt, input, barriers) {
        if (!Number.isFinite(dt) || dt <= 0 || dt > .1)
            throw new Error('Car step must be 0–0.1 seconds.');
        if (!Number.isFinite(input.throttle) || !Number.isFinite(input.steer))
            throw new Error('Invalid driving input.');
        const throttle = clamp(input.throttle, -1, 1), steer = clamp(input.steer, -1, 1);
        const beforeX = this.x, beforeZ = this.z;
        this.impactCooldown = Math.max(0, this.impactCooldown - dt);
        if (input.brake)
            this.speed = moveToward(this.speed, 0, 28 * dt);
        else if (throttle !== 0)
            this.speed = clamp(this.speed + throttle * 12 * dt, -8, 28);
        else
            this.speed = moveToward(this.speed, 0, 3.5 * dt);
        // Reduced steering at speed. Fixed small steps bound travel through thin barriers.
        this.yaw -= steer * this.speed / 2.8 * .45 / (1 + Math.abs(this.speed) * .045) * dt;
        const dx = -Math.sin(this.yaw) * this.speed * dt, dz = -Math.cos(this.yaw) * this.speed * dt;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
        for (let i = 0; i < steps; i++) {
            const x = this.x + dx / steps, z = this.z + dz / steps;
            const blocked = barriers.some(b => {
                const nearestX = clamp(x, b.x - b.halfX, b.x + b.halfX), nearestZ = clamp(z, b.z - b.halfZ, b.z + b.halfZ);
                return Math.hypot(x - nearestX, z - nearestZ) < this.radius;
            });
            if (blocked) {
                this.speed *= -.18;
                if (this.impactCooldown === 0) {
                    this.collisions++;
                    this.impactCooldown = .4;
                }
                break;
            }
            this.x = x;
            this.z = z;
        }
        this.distance += Math.hypot(this.x - beforeX, this.z - beforeZ);
    }
    reset() { this.x = 0; this.z = 4; this.yaw = this.speed = this.distance = this.collisions = this.impactCooldown = 0; }
}
