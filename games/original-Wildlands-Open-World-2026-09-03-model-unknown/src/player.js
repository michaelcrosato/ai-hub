// player.js — free flight and walking (with swimming), in world coordinates.
// The camera sits at the player's eye in a floating-origin frame that moves in
// 768 m steps, so positions stay precise far from the valley.
import * as THREE from 'three/webgpu';
import { CONFIG, LOCATIONS, clamp } from './terrain.js';

export class Player {
  constructor(game) {
    this.game = game;
    const start = LOCATIONS[0];
    this.position = new THREE.Vector3(start.x, game.field.ground(start.x, start.z) + 90, start.z);
    this.yaw = start.yaw;
    this.pitch = -0.12;
    this.mode = 'fly';
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.swimming = false;
    this.speedMultiplier = 1;
    this.wasJump = false;
    this.impact = 0;
    this.moving = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  setMode(mode) {
    this.mode = mode === 'walk' ? 'walk' : 'fly';
    this.velocity.set(0, 0, 0);
    if (this.mode === 'walk') {
      const world = this.game.world;
      this.position.y = Math.max(world.ground(this.position.x, this.position.z) + CONFIG.eyeHeight, CONFIG.waterLevel + 0.9);
      world.resolveCollision(this.position);
      this.grounded = false;
    }
    this.game.events.emit('player:mode', this.mode);
  }

  /** Jump to a place. `y` places the eye at an exact height; otherwise `altitude` is above the ground or water. */
  teleport(x, z, { altitude = 85, yaw = this.yaw, pitch = -0.14, y = null } = {}) {
    if (![x, z, altitude, yaw, pitch].every(Number.isFinite) || (y !== null && !Number.isFinite(y))) {
      throw new TypeError('Teleport values must be finite.');
    }
    this.position.set(clamp(x, -CONFIG.maxCoordinate, CONFIG.maxCoordinate), 0, clamp(z, -CONFIG.maxCoordinate, CONFIG.maxCoordinate));
    const floor = Math.max(this.game.field.ground(this.position.x, this.position.z), CONFIG.waterLevel);
    if (this.mode === 'fly') this.position.y = y !== null ? Math.max(y, floor + 2.2) : floor + clamp(altitude, 2, 9000);
    else this.position.y = floor + CONFIG.eyeHeight;
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.game.world.plan(this.position, true);
    this.game.events.emit('player:teleport', this.position.clone());
  }

  /**
   * One fixed step. `ctl` is this frame's input: x/y move (y forward), rise -1..1,
   * fast (boost/run), jump (held).
   */
  update(dt, ctl) {
    const game = this.game;
    const world = game.world;
    game.streamingPaused = false;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const ground = world.ground(this.position.x, this.position.z);
    this.swimming = this.mode === 'walk' && ground < CONFIG.waterLevel - 1.4 && this.position.y < CONFIG.waterLevel + 2.1;
    const trial = game.quests?.trialActive;
    const speed =
      this.mode === 'fly'
        ? CONFIG.flySpeed * (ctl.fast ? (trial ? 1.6 : 4.5) : 1) * (trial ? 1 : this.speedMultiplier)
        : this.swimming
          ? 5.5
          : ctl.fast
            ? CONFIG.runSpeed
            : CONFIG.walkSpeed;
    const vx = (ctl.x * cos - ctl.y * sin) * speed;
    const vz = (-ctl.x * sin - ctl.y * cos) * speed;
    const k = 1 - Math.exp(-dt * (this.mode === 'fly' ? 5 : 14));
    this.velocity.x += (vx - this.velocity.x) * k;
    this.velocity.z += (vz - this.velocity.z) * k;
    const px = this.position.x;
    const pz = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    // Never step onto terrain that has not streamed in yet: wait at the edge instead.
    if (!world.hasGround(this.position.x, this.position.z)) {
      this.position.x = px;
      this.position.z = pz;
      this.velocity.set(0, 0, 0);
      game.streamingPaused = true;
      return;
    }

    if (this.mode === 'fly') {
      const climb = clamp(ctl.rise, -1, 1) * speed * 0.65 + ctl.y * Math.sin(this.pitch) * speed;
      this.velocity.y += (climb - this.velocity.y) * k;
      this.position.y += this.velocity.y * dt;
      this.position.y = Math.max(this.position.y, world.ground(this.position.x, this.position.z) + 2.2);
    } else {
      world.resolveCollision(this.position);
      let floor = world.ground(this.position.x, this.position.z);
      const rise = floor - ground;
      const moved = Math.hypot(this.position.x - px, this.position.z - pz);
      // Too steep to walk up: stay put.
      if (this.grounded && rise > Math.max(0.45, moved * 1.25)) {
        this.position.x = px;
        this.position.z = pz;
        floor = ground;
      }
      if (ctl.jump && !this.wasJump && this.grounded && !this.swimming) {
        this.velocity.y = CONFIG.jumpSpeed;
        this.grounded = false;
      }
      if (this.swimming) this.velocity.y += ((CONFIG.waterLevel + 1 - this.position.y) * 12 - this.velocity.y * 5) * dt;
      else this.velocity.y -= CONFIG.gravity * dt;
      this.position.y += this.velocity.y * dt;
      if (this.position.y <= floor + CONFIG.eyeHeight) {
        if (!this.grounded && this.velocity.y < -8) this.impact = Math.max(this.impact, -this.velocity.y);
        this.position.y = floor + CONFIG.eyeHeight;
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }
    this.wasJump = ctl.jump;
    this.moving = Math.hypot(this.velocity.x, this.velocity.z);
    this.position.x = clamp(this.position.x, -CONFIG.maxCoordinate, CONFIG.maxCoordinate);
    this.position.z = clamp(this.position.z, -CONFIG.maxCoordinate, CONFIG.maxCoordinate);
    this.position.y = clamp(this.position.y, -100, 14000);
    if (![this.position.x, this.position.y, this.position.z].every(Number.isFinite)) {
      this.teleport(LOCATIONS[0].x, LOCATIONS[0].z);
    }
  }

  syncCamera() {
    const game = this.game;
    game.origin.x = Math.floor(this.position.x / CONFIG.originStep) * CONFIG.originStep;
    game.origin.z = Math.floor(this.position.z / CONFIG.originStep) * CONFIG.originStep;
    game.camera.position.set(this.position.x - game.origin.x, this.position.y, this.position.z - game.origin.z);
    this.euler.set(this.pitch, this.yaw, 0);
    game.camera.quaternion.setFromEuler(this.euler);
    game.camera.updateMatrixWorld();
  }
}
