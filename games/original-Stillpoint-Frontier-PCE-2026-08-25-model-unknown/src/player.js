/**
 * player.js — the first-person field rig and its hand-written collision:
 * axis-aligned walls with a height band, walkable decks (surfaces), and
 * enclosed floors (override surfaces) for spaces below the terrain. Input
 * comes from kit.input actions only.
 */
import * as THREE from 'three/webgpu';
import { PLAYER } from './data.js';
import { srgb } from './primitives.js';
import { PC_POINT } from './render.js';

const DEG = Math.PI / 180;
const LOOK_SCALE = 0.7; // the original turned a little slower than the kit's default
const LIMIT = 48000;

export class Collision {
  constructor() {
    this.colliders = new Map();
    this.surfaces = new Map();
    this.floors = new Map();
  }

  get size() {
    return this.colliders.size + this.surfaces.size + this.floors.size;
  }

  add(box) {
    if (this.colliders.has(box.id)) throw new Error(`Collider "${box.id}" already exists.`);
    if (![box.minX, box.maxX, box.minZ, box.maxZ].every(Number.isFinite)) throw new TypeError('Collider bounds must be finite.');
    if (box.minX >= box.maxX || box.minZ >= box.maxZ) throw new RangeError('Collider bounds must have positive area.');
    this.colliders.set(box.id, { ...box });
    return () => this.colliders.delete(box.id);
  }

  /** A walkable deck: counts when it is no more than a step above the feet. */
  addSurface(surface) {
    if (this.surfaces.has(surface.id)) throw new Error(`Surface "${surface.id}" already exists.`);
    if (![surface.minX, surface.maxX, surface.minZ, surface.maxZ, surface.height].every(Number.isFinite)) throw new TypeError('Surface bounds and height must be finite.');
    if (surface.minX >= surface.maxX || surface.minZ >= surface.maxZ) throw new RangeError('Surface bounds must have positive area.');
    this.surfaces.set(surface.id, { ...surface });
    return () => this.surfaces.delete(surface.id);
  }

  /** An enclosed floor that replaces the terrain while the feet are inside its height band. */
  addFloor(floor) {
    this.floors.set(floor.id, { ...floor });
    return () => this.floors.delete(floor.id);
  }

  surfaceHeightAt(x, z, maxY = Infinity) {
    let best = null;
    for (const s of this.surfaces.values()) {
      if (s.height > maxY || x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      if (best === null || s.height > best) best = s.height;
    }
    return best;
  }

  floorAt(x, z, y) {
    for (const f of this.floors.values()) {
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
      if (y >= f.height - 1.5 && y <= f.height + f.headroom) return f.height;
    }
    return null;
  }

  clear() {
    this.colliders.clear();
    this.surfaces.clear();
    this.floors.clear();
  }

  resolveMove(x, z, nextX, nextZ, radius, feetY = 0, height = 1.8) {
    const r = Math.max(0.05, Math.min(5, Number.isFinite(radius) ? radius : 0.42));
    let tx = Number.isFinite(nextX) ? nextX : x;
    let tz = Number.isFinite(nextZ) ? nextZ : z;
    let blockedX = false;
    let blockedZ = false;
    for (const c of this.colliders.values()) {
      if (!this.overlapsVertically(c, feetY, height)) continue;
      if (z <= c.minZ - r || z >= c.maxZ + r) continue;
      if (x <= c.minX - r && tx > c.minX - r) {
        tx = c.minX - r;
        blockedX = true;
      } else if (x >= c.maxX + r && tx < c.maxX + r) {
        tx = c.maxX + r;
        blockedX = true;
      } else if (x > c.minX - r && x < c.maxX + r) {
        tx = Math.abs(tx - (c.minX - r)) < Math.abs(tx - (c.maxX + r)) ? c.minX - r : c.maxX + r;
        blockedX = true;
      }
    }
    for (const c of this.colliders.values()) {
      if (!this.overlapsVertically(c, feetY, height)) continue;
      if (tx <= c.minX - r || tx >= c.maxX + r) continue;
      if (z <= c.minZ - r && tz > c.minZ - r) {
        tz = c.minZ - r;
        blockedZ = true;
      } else if (z >= c.maxZ + r && tz < c.maxZ + r) {
        tz = c.maxZ + r;
        blockedZ = true;
      } else if (z > c.minZ - r && z < c.maxZ + r) {
        tz = Math.abs(tz - (c.minZ - r)) < Math.abs(tz - (c.maxZ + r)) ? c.minZ - r : c.maxZ + r;
        blockedZ = true;
      }
    }
    return { x: tx, z: tz, blockedX, blockedZ };
  }

  overlapsVertically(c, feetY, height) {
    return feetY < (c.maxY ?? Infinity) && feetY + height > (c.minY ?? -Infinity);
  }
}

const GROUND_SPEEDS = [
  { label: 'NORMAL', multiplier: 1 },
  { label: 'FAST', multiplier: 3 },
  { label: 'VERY FAST', multiplier: 8 },
];
const FLIGHT_SPEEDS = [8, 24, 72];

export class Player {
  constructor(scene, camera, input, terrain, collision, { flashlightShadows = true } = {}) {
    this.input = input;
    this.terrain = terrain;
    this.collision = collision;
    this.camera = camera;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 8;
    this.grounded = true;
    this.staminaValue = 100;
    this.crouched = false;
    this.crouchLatch = false;
    this.sprintLatch = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.flashlightOn = false;
    this.fieldDrift = false;
    this.driftSpeedIndex = 0;
    this.groundSpeedIndex = 0;
    this.infiniteStamina = false;
    this.eyeY = PLAYER.eyeHeight;
    this.stridePhase = 0;
    this.bob = 0;
    this.distanceWalked = 0;
    this.onStep = null;
    this.onLand = null;

    this.rig = new THREE.Group();
    this.rig.name = 'Player';
    scene.add(this.rig);
    camera.position.set(0, PLAYER.eyeHeight, 0);
    camera.rotation.order = 'YXZ';
    this.rig.add(camera);

    this.flashlightCore = this.createFlashlight([1, 0.78, 0.54], 3.8, 48, 13, 27, flashlightShadows);
    this.flashlightSpill = this.createFlashlight([0.52, 0.78, 1], 1.2, 13, 28, 52, false);
    this.setFlashlight(false);
    this.teleport(0, 26);
    this.applyLook();
  }

  get worldPosition() {
    return this.position;
  }
  /** Compass heading in degrees, clockwise from north (-Z). */
  get heading() {
    return (((-this.yaw) % 360) + 360) % 360;
  }
  /** The rig's own yaw in degrees (counter-clockwise, 0 = facing -Z). */
  get yawDegrees() {
    return this.yaw;
  }
  get stamina() {
    return this.staminaValue;
  }
  get isCrouched() {
    return this.crouched;
  }
  get flashlightEnabled() {
    return this.flashlightOn;
  }
  get fieldDriftEnabled() {
    return this.fieldDrift;
  }
  get fieldDriftSpeed() {
    return FLIGHT_SPEEDS[this.driftSpeedIndex];
  }
  get groundSpeedLabel() {
    return GROUND_SPEEDS[this.groundSpeedIndex].label;
  }
  get groundSpeedMultiplier() {
    return GROUND_SPEEDS[this.groundSpeedIndex].multiplier;
  }
  get infiniteStaminaEnabled() {
    return this.infiniteStamina;
  }
  get cameraFov() {
    return this.camera.fov;
  }

  toggleFieldDrift() {
    this.fieldDrift = !this.fieldDrift;
    this.velocity.set(0, 0, 0);
    return this.fieldDrift;
  }

  cycleFieldDriftSpeed() {
    this.driftSpeedIndex = (this.driftSpeedIndex + 1) % FLIGHT_SPEEDS.length;
    return this.fieldDriftSpeed;
  }

  cycleGroundSpeed() {
    this.groundSpeedIndex = (this.groundSpeedIndex + 1) % GROUND_SPEEDS.length;
    return `${this.groundSpeedLabel} // ${this.groundSpeedMultiplier}X`;
  }

  toggleInfiniteStamina() {
    this.infiniteStamina = !this.infiniteStamina;
    if (this.infiniteStamina) this.staminaValue = 100;
    return this.infiniteStamina;
  }

  adjustFov(delta) {
    if (!Number.isFinite(delta)) return this.cameraFov;
    this.camera.fov = Math.max(45, Math.min(110, this.camera.fov + delta));
    this.camera.updateProjectionMatrix();
    return this.camera.fov;
  }

  resetFov() {
    this.camera.fov = PLAYER.fov;
    this.camera.updateProjectionMatrix();
    return this.camera.fov;
  }

  /** Face a compass heading (degrees clockwise from north). */
  setHeading(degrees) {
    if (!Number.isFinite(degrees)) return false;
    this.yaw = -degrees;
    this.applyLook();
    return true;
  }

  snapToGround() {
    this.teleport(this.position.x, this.position.z);
  }

  toggleFlashlight() {
    this.setFlashlight(!this.flashlightOn);
    return this.flashlightOn;
  }

  /** Horizontal distance walked since the last call (for the field record). */
  consumeDistance() {
    const d = this.distanceWalked;
    this.distanceWalked = 0;
    return d;
  }

  update(dt) {
    this.updateLook();
    const steps = Math.max(1, Math.ceil(dt / 0.05));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) this.updateMovement(h, i === 0);
    this.rig.position.copy(this.position);
  }

  /** Slow camera drift for the title backdrop. */
  idle(dt) {
    this.yaw += dt * 1.6;
    this.applyLook();
  }

  teleport(x, z, y) {
    const cx = Math.max(-LIMIT, Math.min(LIMIT, x));
    const cz = Math.max(-LIMIT, Math.min(LIMIT, z));
    const height = Number.isFinite(y) ? y : this.walkableHeight(cx, cz, Infinity, Infinity);
    this.position.set(cx, height, cz);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.rig.position.copy(this.position);
  }

  destroy() {
    this.rig.removeFromParent();
  }

  updateLook() {
    const look = this.input.look('look');
    this.yaw -= (look.x * LOOK_SCALE) / DEG;
    this.pitch = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, this.pitch - (look.y * LOOK_SCALE) / DEG));
    this.applyLook();
  }

  applyLook() {
    this.rig.rotation.set(0, this.yaw * DEG, 0);
    this.camera.rotation.set(this.pitch * DEG, 0, 0);
  }

  updateMovement(dt, firstStep) {
    const input = this.input;
    const move = input.vector('move');
    const forward = move.y;
    const strafe = move.x;
    const amount = Math.hypot(forward, strafe);
    const yaw = this.yaw * DEG;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const keyboard = input.source === 'keyboard';

    if (this.fieldDrift) {
      const vertical = (input.down('jump') ? 1 : 0) - (input.down('crouch') ? 1 : 0);
      const speed = this.fieldDriftSpeed * (input.down('sprint') ? 1.8 : 1);
      this.position.x = Math.max(-LIMIT, Math.min(LIMIT, this.position.x + (fx * forward + rx * strafe) * speed * dt));
      this.position.z = Math.max(-LIMIT, Math.min(LIMIT, this.position.z + (fz * forward + rz * strafe) * speed * dt));
      this.position.y = Math.max(this.terrain.seaLevel - 64, Math.min(4096, this.position.y + vertical * speed * dt));
      this.velocity.set(0, 0, 0);
      this.grounded = false;
      this.crouched = false;
      this.staminaValue = Math.min(100, this.staminaValue + dt * 12);
      this.eyeY += (PLAYER.eyeHeight - this.eyeY) * (1 - Math.exp(-dt * 14));
      this.camera.position.y = this.eyeY;
      return;
    }

    // Keyboard crouch/sprint are held; controller and touch buttons toggle.
    if (firstStep && !keyboard && input.pressed('crouch')) this.crouchLatch = !this.crouchLatch;
    if (keyboard) this.crouchLatch = false;
    this.crouched = (keyboard && input.down('crouch')) || this.crouchLatch;
    if (firstStep && !keyboard && input.pressed('sprint')) this.sprintLatch = !this.sprintLatch;
    if (keyboard || amount < 0.2 || this.crouched) this.sprintLatch = false;
    const moving = amount > 0.05;
    const sprinting = (keyboard ? input.down('sprint') : this.sprintLatch) && !this.crouched && moving && this.staminaValue > 1;
    this.staminaValue = this.infiniteStamina ? 100 : sprinting ? Math.max(0, this.staminaValue - dt * 18) : Math.min(100, this.staminaValue + dt * (this.grounded ? 11 : 4));

    const speed = (this.crouched ? PLAYER.walkSpeed * 0.52 : sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * this.groundSpeedMultiplier;
    const targetX = (fx * forward + rx * strafe) * speed;
    const targetZ = (fz * forward + rz * strafe) * speed;
    const accel = this.grounded ? PLAYER.groundAcceleration : PLAYER.airAcceleration;
    const k = 1 - Math.exp(-accel * dt);
    this.velocity.x += (targetX - this.velocity.x) * k;
    this.velocity.z += (targetZ - this.velocity.z) * k;

    const startX = this.position.x;
    const startZ = this.position.z;
    const currentGround = this.walkableHeight(this.position.x, this.position.z, this.position.y + 1.05, this.position.y);
    let nextX = this.position.x + this.velocity.x * dt;
    let nextZ = this.position.z + this.velocity.z * dt;
    const resolved = this.collision.resolveMove(this.position.x, this.position.z, nextX, nextZ, 0.42, this.position.y, this.crouched ? 1.22 : 1.8);
    nextX = resolved.x;
    nextZ = resolved.z;
    if (resolved.blockedX) this.velocity.x = 0;
    if (resolved.blockedZ) this.velocity.z = 0;
    if (this.walkableHeight(nextX, nextZ, this.position.y + 1.05, this.position.y) - currentGround <= 1.05 || !this.grounded) {
      this.position.x = nextX;
      this.position.z = nextZ;
    } else {
      this.velocity.x *= 0.2;
      this.velocity.z *= 0.2;
    }

    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = firstStep && input.pressed('jump') ? 0.12 : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }
    this.velocity.y -= PLAYER.gravity * dt;
    this.position.y += this.velocity.y * dt;
    const wasGrounded = this.grounded;
    const impact = this.velocity.y;
    const ground = this.walkableHeight(this.position.x, this.position.z, this.position.y + 1.05, this.position.y);
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
      if (!wasGrounded && impact < -6.5) this.onLand?.(Math.min(1, (-impact - 6.5) / 10));
    } else {
      this.grounded = false;
    }
    if (this.position.y < this.terrain.seaLevel - 60 && this.collision.floorAt(this.position.x, this.position.z, this.position.y) === null) this.teleport(0, 13);

    // Footsteps and a light head bob while walking on the ground.
    const travelled = Math.hypot(this.position.x - startX, this.position.z - startZ);
    this.distanceWalked += travelled;
    if (this.grounded && travelled > 0.0005) {
      const stride = sprinting ? 2.6 : this.crouched ? 1.5 : 2.1;
      this.stridePhase += travelled / stride;
      if (this.stridePhase >= 1) {
        this.stridePhase -= Math.floor(this.stridePhase);
        this.onStep?.(sprinting ? 1 : this.crouched ? 0.45 : 0.75);
      }
    }
    const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
    const bobTarget = this.grounded && horizontal > 0.6 ? Math.sin(this.stridePhase * Math.PI * 2) * Math.min(1, horizontal / PLAYER.sprintSpeed) * 0.045 : 0;
    this.bob += (bobTarget - this.bob) * (1 - Math.exp(-dt * 12));

    const eyeTarget = this.crouched ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
    this.eyeY += (eyeTarget - this.eyeY) * (1 - Math.exp(-dt * 14));
    this.camera.position.y = this.eyeY + this.bob;
  }

  /** Ground under the feet: terrain (never below the sea), decks, or an enclosed floor. */
  walkableHeight(x, z, maxY = Infinity, feetY = Infinity) {
    if (Number.isFinite(feetY)) {
      const floor = this.collision.floorAt(x, z, feetY);
      if (floor !== null) return floor;
    }
    const ground = Math.max(this.terrain.heightAt(x, z), this.terrain.seaLevel + 0.12);
    const deck = this.collision.surfaceHeightAt(x, z, maxY);
    return deck === null ? ground : Math.max(ground, deck);
  }

  createFlashlight(color, intensity, range, inner, outer, shadows) {
    const light = new THREE.SpotLight(0xffffff, 0, range, outer * DEG, 1 - inner / outer, 0);
    srgb(light.color, color[0], color[1], color[2]);
    light.userData.intensity = intensity * PC_POINT;
    light.castShadow = shadows;
    if (shadows) {
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.0006;
      light.shadow.normalBias = 0.05;
      light.shadow.camera.near = 0.3;
      light.shadow.autoUpdate = false;
    }
    light.position.set(0, 0, 0);
    light.target.position.set(0, -0.07, -1);
    this.camera.add(light, light.target);
    return light;
  }

  setFlashlight(on) {
    this.flashlightOn = on;
    for (const light of [this.flashlightCore, this.flashlightSpill]) {
      light.intensity = on ? light.userData.intensity : 0;
      if (light.castShadow) light.shadow.autoUpdate = on;
    }
  }
}

