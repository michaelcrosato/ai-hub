import * as THREE from 'three/webgpu';
import { WORLD } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
// The kit's look rate is a little quicker than this game's original mouse rate; keep the old feel.
const LOOK_SCALE = 0.72;

export class PlayerSystem {
  constructor(camera, input, terrain, nature, settings, bus, saved) {
    this.camera = camera; this.input = input; this.terrain = terrain; this.nature = nature; this.settings = settings; this.bus = bus;
    this.position = new THREE.Vector3(); this.velocity = new THREE.Vector3(); this.direction = new THREE.Vector3(); this.yaw = 0; this.pitch = -0.07; this.grounded = true; this.swimming = false; this.sliding = false; this.crouched = false; this.fly = false; this.speed = 0; this.distance = 0;
    this.coyote = 0; this.jumpBuffer = 0; this.slideTime = 0; this.slideCooldown = 0; this.eyeHeight = 1.8; this.bob = 0; this.roll = 0; this.landKick = 0; this.status = 'Walking'; this.devSpeed = 40;
    this.perks = new Set(); this.sprintLatch = false; this.focusLatch = false;
    // Per-frame intent, read from kit.input once per frame and used by every fixed step.
    this.intent = { forward: 0, side: 0, sprint: false, crouch: false, jumpHeld: false, aim: false };
    this.teleport(saved?.x ?? WORLD.spawn.x, saved?.z ?? WORLD.spawn.z); if (saved) { this.yaw = saved.yaw; this.pitch = saved.pitch; } this.applyCamera(0.016);
  }
  teleport(x, z) { this.position.set(THREE.MathUtils.clamp(x, -WORLD.halfSize + 2, WORLD.halfSize - 2), 0, THREE.MathUtils.clamp(z, -WORLD.halfSize + 2, WORLD.halfSize - 2)); this.position.y = Math.max(this.terrain.height(this.position.x, this.position.z), WORLD.water - 1.2); this.velocity.set(0, 0, 0); this.grounded = true; this.sliding = false; this.applyCamera(0.1); }
  /** Read look and buttons once per frame (the physics runs on a fixed 120 Hz step). */
  readInput() {
    const input = this.input, look = input.look('look'), move = input.vector('move');
    this.yaw -= look.x * LOOK_SCALE; this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * LOOK_SCALE, -1.52, 1.52);
    if (input.pressed('jump')) this.jumpBuffer = 0.14;
    // Keyboard sprint is held; on a gamepad (L3) or touch (Run) it toggles and ends when you stop.
    if (input.pressed('sprint') && input.source !== 'keyboard') this.sprintLatch = !this.sprintLatch;
    if (Math.hypot(move.x, move.y) < 0.2) this.sprintLatch = false;
    // Mouse wheel or pinch toggles the focus view as well as holding right mouse / LT.
    const zoom = input.zoom(); if (zoom > 0.05) this.focusLatch = true; else if (zoom < -0.05) this.focusLatch = false;
    const i = this.intent;
    i.forward = move.y; i.side = move.x; i.sprint = input.down('sprint') || this.sprintLatch; i.crouch = input.down('crouch'); i.jumpHeld = input.down('jump'); i.aim = input.down('aim') || this.focusLatch;
  }
  clearIntent() { const i = this.intent; i.forward = i.side = 0; i.sprint = i.crouch = i.jumpHeld = i.aim = false; this.jumpBuffer = 0; this.sprintLatch = false; }
  update(dt) {
    const i = this.intent; this.slideCooldown = Math.max(0, this.slideCooldown - dt); this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    const forward = i.forward, side = i.side;
    const direction = this.direction.set(side, 0, -forward); if (direction.lengthSq() > 1) direction.normalize(); direction.applyAxisAngle(UP, this.yaw);
    const sprint = i.sprint, crouch = i.crouch;
    const oldX = this.position.x, oldZ = this.position.z; const floor = this.terrain.height(this.position.x, this.position.z); this.swimming = floor < WORLD.water - 1.2 && this.position.y < WORLD.water - 0.7;
    if (this.fly) {
      const speed = this.devSpeed * (sprint ? 3 : 1); this.velocity.lerp(direction.multiplyScalar(speed), 1 - Math.exp(-8 * dt)); this.velocity.y = ((i.jumpHeld ? 1 : 0) - (crouch ? 1 : 0)) * speed;
      this.position.addScaledVector(this.velocity, dt); this.position.y = THREE.MathUtils.clamp(this.position.y, -30, 3800); this.status = 'Flying'; this.grounded = false; this.sliding = false;
    } else {
      this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
      if (crouch && this.grounded && this.speed > 8 && !this.sliding && this.slideCooldown <= 0 && !this.swimming) { this.sliding = true; this.slideTime = 1.0; this.slideCooldown = 1.3; this.velocity.x *= 1.17; this.velocity.z *= 1.17; this.bus.emit('slide'); }
      if (this.sliding) { this.slideTime -= dt; if (this.slideTime <= 0 || !crouch || this.speed < 3 || !this.grounded) this.sliding = false; }
      this.crouched = crouch && !this.sliding && !this.swimming;
      const sprinting = sprint && forward > 0.3;
      const maxSpeed = this.swimming ? 4.2 * (this.perks.has('swim') ? 1.4 : 1) : this.crouched ? 3.2 : sprinting ? 12.8 * (this.perks.has('boots') ? 1.12 : 1) : 6.5;
      const acceleration = this.swimming ? 5 : this.grounded ? 15 : 3.2;
      if (this.sliding) { const drag = Math.exp(-0.95 * dt); this.velocity.x *= drag; this.velocity.z *= drag; this.velocity.addScaledVector(direction, dt * 2); }
      else { const blend = 1 - Math.exp(-acceleration * dt); this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, direction.x * maxSpeed, blend); this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, direction.z * maxSpeed, blend); }
      if (this.jumpBuffer > 0 && (this.coyote > 0 || this.swimming)) {
        this.velocity.y = this.swimming ? 4.5 : 8.4; this.grounded = false; this.coyote = 0; this.jumpBuffer = 0; this.sliding = false; this.bus.emit('jump');
      }
      if (this.swimming) { this.velocity.y += (WORLD.water - 1.2 - this.position.y) * 13 * dt; this.velocity.y *= Math.exp(-3 * dt); if (i.jumpHeld) this.velocity.y += 12 * dt; if (crouch) this.velocity.y -= 9 * dt; }
      else this.velocity.y -= 25 * dt;
      // Small substeps prevent tunnelling through trunks and steep terrain.
      const steps = Math.max(1, Math.ceil(Math.hypot(this.velocity.x, this.velocity.z) * dt / 0.28)), stepDt = dt / steps;
      for (let s = 0; s < steps; s++) {
        let nx = this.position.x + this.velocity.x * stepDt, nz = this.position.z + this.velocity.z * stepDt;
        const currentFloor = this.terrain.height(this.position.x, this.position.z), nextFloor = this.terrain.height(nx, nz), rise = nextFloor - currentFloor, travel = Math.hypot(nx - this.position.x, nz - this.position.z);
        const probe = 0.6, ux = travel > 0.00001 ? (nx - this.position.x) / travel : 0, uz = travel > 0.00001 ? (nz - this.position.z) / travel : 0;
        const ahead = this.terrain.height(this.position.x + ux * probe, this.position.z + uz * probe) - currentFloor;
        if (rise > 0.001 && ahead > probe * 1.2 && this.position.y < nextFloor + 0.1 && !this.swimming) {
          // Use a fixed probe distance: per-step rise shrinks at high frame rates.
          // Remove the uphill velocity and keep motion along the cliff face.
          const gx = this.terrain.height(nx + 0.5, nz) - this.terrain.height(nx - 0.5, nz), gz = this.terrain.height(nx, nz + 0.5) - this.terrain.height(nx, nz - 0.5);
          const dot = this.velocity.x * gx + this.velocity.z * gz, den = gx * gx + gz * gz;
          if (dot > 0 && den > 0.001) { this.velocity.x -= gx * dot / den; this.velocity.z -= gz * dot / den; }
          nx = this.position.x + this.velocity.x * stepDt; nz = this.position.z + this.velocity.z * stepDt;
        }
        const resolved = this.nature.resolveCollision(nx, nz, this.position.y, 0.36); this.position.x = resolved.x; this.position.z = resolved.z;
      }
      this.position.y += this.velocity.y * dt;
      const ground = this.terrain.height(this.position.x, this.position.z);
      if (this.position.y <= ground) { if (!this.grounded && this.velocity.y < -4) { this.landKick = Math.min(0.24, -this.velocity.y * 0.013); this.bus.emit('land', -this.velocity.y); } this.position.y = ground; this.velocity.y = 0; this.grounded = true; }
      else if (this.position.y - ground < 0.6 && this.grounded && this.velocity.y <= 0 && !this.swimming) { this.position.y = ground; this.velocity.y = 0; } else this.grounded = false;
      this.status = this.swimming ? 'Swimming' : this.sliding ? 'Sliding' : !this.grounded ? 'Airborne' : this.crouched ? 'Crouching' : sprinting && this.speed > 8 ? 'Sprinting' : 'Walking';
    }
    this.position.x = THREE.MathUtils.clamp(this.position.x, -WORLD.halfSize + 2, WORLD.halfSize - 2); this.position.z = THREE.MathUtils.clamp(this.position.z, -WORLD.halfSize + 2, WORLD.halfSize - 2);
    if (!Number.isFinite(this.position.y) || this.position.y < -60) this.teleport(WORLD.spawn.x, WORLD.spawn.z);
    this.distance += Math.hypot(this.position.x - oldX, this.position.z - oldZ); this.speed = Math.hypot(this.velocity.x, this.velocity.z); this.applyCamera(dt);
  }
  applyCamera(dt) {
    const targetHeight = this.sliding ? 0.85 : this.crouched ? 1.08 : 1.8; this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetHeight, 14, dt); this.bob += dt * this.speed * 1.65; this.landKick = THREE.MathUtils.damp(this.landKick, 0, 12, dt);
    const bob = this.settings.headBob && this.grounded && !this.sliding ? Math.sin(this.bob) * Math.min(this.speed, 10) * 0.003 : 0;
    this.camera.position.copy(this.position); this.camera.position.y += this.eyeHeight + bob - this.landKick;
    const lateral = this.velocity.x * Math.cos(this.yaw) + this.velocity.z * -Math.sin(this.yaw), roll = this.settings.headBob ? THREE.MathUtils.clamp(-lateral * 0.0015, -0.018, 0.018) : 0;
    this.roll = THREE.MathUtils.damp(this.roll, roll, 7, dt); this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    const fov = this.intent.aim ? this.settings.fov * 0.72 : this.settings.fov + (this.status === 'Sprinting' ? 6 : this.sliding ? 8 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.02) { this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 8, dt); this.camera.updateProjectionMatrix(); }
  }
  serialize() { return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, pitch: this.pitch }; }
}
