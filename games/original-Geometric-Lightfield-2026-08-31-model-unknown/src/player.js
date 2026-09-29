// The player: a small low-poly figure with hand-written capsule-vs-box collision,
// ramps, jumping, and a camera that zooms from third person into first person.
// Input arrives as plain numbers from the game loop (kit.input actions).
import * as THREE from 'three/webgpu';

const RADIUS = 0.53;
const HEIGHT = 1.96;
const STEP_UP = 0.42;
const BOUND = 32.5;
const CAMERA_PAD = 0.18;
const ZOOM_STEP = 0.7;
const MIN_THIRD = 2.25;
const MAX_THIRD = 9.2;
const WALK_SPEED = 5.4;
const RUN_SPEED = 8.2;
const JUMP_SPEED = 7.2;
const GRAVITY = 19.5;
const JUMP_BUFFER = 0.14;
const COYOTE_TIME = 0.1;
// Mouse-derived ratios from the original handlers (the kit's look is 0.0024 rad/px).
const PITCH_RATIO = 0.0019 / 0.0024;
const ORBIT_YAW_RATIO = 0.0028 / 0.0024;
const ORBIT_PITCH_RATIO = 0.0022 / 0.0024;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Player {
  constructor(scene, colliders, mats, callbacks = {}) {
    this.colliders = colliders;
    this.callbacks = callbacks;
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 110);
    this.root = new THREE.Group();
    this.visual = new THREE.Group();
    this.velocity = new THREE.Vector2();
    this.moveInput = new THREE.Vector2();
    this.movement = new THREE.Vector3();
    this.desiredCamera = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraAnchor = new THREE.Vector3();
    this.cameraAim = new THREE.Vector3();
    this.spawn = new THREE.Vector3(-13, 0, -4.4);
    this.yaw = 0;
    this.pitch = -0.08;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.orbiting = false;
    this.cameraDistance = 6.7;
    this.lastThirdDistance = 6.7;
    this.cameraMode = 'third-person';
    this.verticalVelocity = 0;
    this.floorY = 0;
    this.grounded = true;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.walkTime = 0;
    this.lastStep = 0;
    this.zoomAccumulator = 0;
    this.cameraInitialized = false;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 1.15, 8), mats.player);
    body.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 8, 6), mats.playerHead);
    head.position.y = 1.58;
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.46, 8), mats.charcoal);
    torch.position.set(0.56, 1.05, -0.13);
    torch.rotation.x = Math.PI / 2;
    for (const m of [body, head, torch]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.visual.add(body, head, torch);
    this.root.add(this.visual);
    this.root.position.copy(this.spawn);
    scene.add(this.root);
    this.updateCamera(1);
  }

  /** Mouse, right stick or touch drag, in radians. While orbiting it swings the camera around the figure. */
  look(dx, dy) {
    if (!dx && !dy) return;
    if (this.orbiting) {
      const yaw = this.orbitYaw - dx * ORBIT_YAW_RATIO;
      this.orbitYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      const total = clamp(this.pitch + this.orbitPitch - dy * ORBIT_PITCH_RATIO, -0.72, 0.72);
      this.orbitPitch = total - this.pitch;
      return;
    }
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy * PITCH_RATIO, -0.55, 0.55);
  }

  setOrbiting(on) {
    this.orbiting = on;
  }

  /** Wheel / pinch: + zooms in. Whole notches step the distance; small trackpad deltas accumulate. */
  zoom(amount) {
    if (!amount) return;
    this.zoomAccumulator = clamp(this.zoomAccumulator + amount, -3, 3);
    while (this.zoomAccumulator >= 1) {
      this.zoomAccumulator -= 1;
      this.zoomStep(1);
    }
    while (this.zoomAccumulator <= -1) {
      this.zoomAccumulator += 1;
      this.zoomStep(-1);
    }
  }

  zoomStep(dir) {
    const d = this.cameraDistance;
    const next = dir > 0 ? (d <= MIN_THIRD ? 0 : Math.max(MIN_THIRD, d - ZOOM_STEP)) : d <= 0 ? MIN_THIRD : Math.min(MAX_THIRD, d + ZOOM_STEP);
    this.setCameraDistance(next);
  }

  toggleView() {
    this.setCameraDistance(this.cameraMode === 'first-person' ? Math.max(MIN_THIRD, this.lastThirdDistance) : 0);
  }

  setCameraDistance(d) {
    this.cameraDistance = d;
    if (d > 0) this.lastThirdDistance = d;
    const mode = d <= 0 ? 'first-person' : 'third-person';
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.camera.fov = mode === 'first-person' ? 62 : 54;
    this.camera.updateProjectionMatrix();
    this.callbacks.onCameraMode?.(mode);
  }

  queueJump() {
    this.jumpBuffer = JUMP_BUFFER;
  }

  /** One fixed physics step. Returns true when the figure moved (shadows near it are stale). */
  fixedUpdate(dt, moveX, moveY, run) {
    const x0 = this.root.position.x;
    const y0 = this.root.position.y;
    const z0 = this.root.position.z;
    const r0 = this.root.rotation.y;
    const bob0 = this.visual.position.y;
    const lean0 = this.visual.rotation.z;
    this.moveInput.set(moveX, moveY);
    if (this.moveInput.lengthSq() > 1) this.moveInput.normalize();
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const wantX = (Math.cos(this.yaw) * this.moveInput.x - Math.sin(this.yaw) * this.moveInput.y) * speed;
    const wantZ = (-Math.sin(this.yaw) * this.moveInput.x - Math.cos(this.yaw) * this.moveInput.y) * speed;
    const k = 1 - Math.exp(-12 * dt);
    this.velocity.x += (wantX - this.velocity.x) * k;
    this.velocity.y += (wantZ - this.velocity.y) * k;
    if (this.moveInput.lengthSq() === 0) this.velocity.multiplyScalar(Math.exp(-9 * dt));

    const wasGrounded = this.grounded;
    this.moveHorizontal(this.velocity.x * dt, this.velocity.y * dt);
    let floor = this.sampleFloorHeight(this.root.position.x, this.root.position.z);
    const blockedStep = wasGrounded && floor > this.root.position.y && !this.hasStandingClearance(this.root.position.x, this.root.position.z, floor);
    if (floor - this.root.position.y > STEP_UP || blockedStep) {
      this.root.position.x = x0;
      this.root.position.z = z0;
      this.velocity.set(0, 0);
      floor = this.sampleFloorHeight(x0, z0);
    }
    if (wasGrounded && this.root.position.y <= floor + STEP_UP) {
      this.root.position.y = floor;
      this.floorY = floor;
      this.verticalVelocity = 0;
      this.grounded = true;
    } else {
      this.floorY = floor;
      if (wasGrounded && this.root.position.y > floor + STEP_UP) this.grounded = false;
    }
    this.coyote = this.grounded ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.verticalVelocity = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.callbacks.onJump?.();
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (!this.grounded) {
      this.verticalVelocity -= GRAVITY * dt;
      const y = this.root.position.y;
      let next = y + this.verticalVelocity * dt;
      if (this.verticalVelocity > 0) {
        for (const c of this.colliders) {
          if (c.kind !== 'box' || !this.overlapsFootprint(this.root.position.x, this.root.position.z, c)) continue;
          if (y + HEIGHT <= c.minY + 1e-4 && next + HEIGHT > c.minY) {
            next = Math.min(next, c.minY - HEIGHT);
            this.verticalVelocity = 0;
          }
        }
      }
      this.root.position.y = next;
      if (this.root.position.y <= this.floorY) {
        const impact = -this.verticalVelocity;
        this.root.position.y = this.floorY;
        this.verticalVelocity = 0;
        this.grounded = true;
        this.callbacks.onLand?.(impact);
      }
    }

    const moving = this.velocity.length();
    if (moving > 0.12) {
      this.walkTime += dt * moving;
      const heading = Math.atan2(this.velocity.x, this.velocity.y);
      const turn = Math.atan2(Math.sin(heading - this.root.rotation.y), Math.cos(heading - this.root.rotation.y));
      this.root.rotation.y += turn * Math.min(1, dt * 10);
      this.visual.position.y = Math.sin(this.walkTime * 2.1) * 0.045;
      this.visual.rotation.z = -this.moveInput.x * 0.055;
      const step = Math.floor((this.walkTime * 2.1) / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        if (this.grounded) this.callbacks.onStep?.(moving);
      }
    } else {
      this.visual.position.y *= Math.exp(-12 * dt);
      this.visual.rotation.z *= Math.exp(-12 * dt);
    }
    return (
      Math.abs(this.root.position.x - x0) > 1e-4 ||
      Math.abs(this.root.position.y - y0) > 1e-4 ||
      Math.abs(this.root.position.z - z0) > 1e-4 ||
      Math.abs(this.root.rotation.y - r0) > 1e-4 ||
      Math.abs(this.visual.position.y - bob0) > 1e-4 ||
      Math.abs(this.visual.rotation.z - lean0) > 1e-4
    );
  }

  moveHorizontal(dx, dz) {
    const x = this.root.position.x;
    const z = this.root.position.z;
    this.root.position.x = clamp(x + dx, -BOUND, BOUND);
    if (this.intersectsWorld(this.root.position.x, this.root.position.z)) {
      this.root.position.x = x;
      this.velocity.x = 0;
    }
    this.root.position.z = clamp(z + dz, -BOUND, BOUND);
    if (this.intersectsWorld(this.root.position.x, this.root.position.z)) {
      this.root.position.z = z;
      this.velocity.y = 0;
    }
  }

  intersectsWorld(x, z) {
    const y = this.root.position.y;
    for (const c of this.colliders) {
      if (c.kind !== 'box') continue;
      if (y + HEIGHT <= c.minY || y + (this.grounded ? STEP_UP : 0) >= c.maxY) continue;
      if (this.overlapsFootprint(x, z, c)) return true;
    }
    return false;
  }

  overlapsFootprint(x, z, c) {
    const dx = x - clamp(x, c.minX, c.maxX);
    const dz = z - clamp(z, c.minZ, c.maxZ);
    return dx * dx + dz * dz < RADIUS * RADIUS;
  }

  hasStandingClearance(x, z, floor) {
    for (const c of this.colliders) {
      if (c.kind === 'box' && c.maxY > floor + 1e-4 && c.minY < floor + HEIGHT && this.overlapsFootprint(x, z, c)) return false;
    }
    return true;
  }

  sampleFloorHeight(x, z) {
    let h = 0;
    const reach = this.root.position.y + (this.grounded ? STEP_UP : 0) + 1e-4;
    for (const c of this.colliders) {
      if (c.kind === 'box') {
        if (c.maxY <= reach && this.overlapsFootprint(x, z, c)) h = Math.max(h, c.maxY);
        continue;
      }
      if (x < c.minX - RADIUS * 0.35 || x > c.maxX + RADIUS * 0.35 || z < c.minZ || z > c.maxZ) continue;
      h = Math.max(h, c.height * clamp((z - c.minZ) / (c.maxZ - c.minZ), 0, 1));
    }
    return h;
  }

  /** Smoothly follow the figure; returns true when the camera moved (sun cascades are stale). */
  updateCamera(dt) {
    const px = this.camera.position.x;
    const py = this.camera.position.y;
    const pz = this.camera.position.z;
    const qx = this.camera.quaternion.x;
    const qy = this.camera.quaternion.y;
    const qz = this.camera.quaternion.z;
    const qw = this.camera.quaternion.w;
    if (!this.orbiting) {
      const k = 1 - Math.exp(-7 * dt);
      this.orbitYaw += (0 - this.orbitYaw) * k;
      this.orbitPitch += (0 - this.orbitPitch) * k;
      if (Math.abs(this.orbitYaw) < 1e-4) this.orbitYaw = 0;
      if (Math.abs(this.orbitPitch) < 1e-4) this.orbitPitch = 0;
    }
    const yaw = this.yaw + this.orbitYaw;
    const pitch = clamp(this.pitch + this.orbitPitch, -0.72, 0.72);
    this.computeInputAim(this.cameraAnchor, this.cameraAim, yaw, pitch);
    if (this.cameraMode === 'first-person') {
      this.desiredCamera.copy(this.cameraAnchor).addScaledVector(this.cameraAim, 0.18);
      this.desiredCamera.y += 0.22;
      this.cameraTarget.copy(this.cameraAim).multiplyScalar(24).add(this.desiredCamera);
    } else {
      this.desiredCamera.set(
        this.cameraAnchor.x + Math.sin(yaw) * this.cameraDistance,
        this.cameraAnchor.y + 1.05 - Math.sin(pitch) * this.cameraDistance * 0.16,
        this.cameraAnchor.z + Math.cos(yaw) * this.cameraDistance
      );
      this.cameraTarget.copy(this.cameraAim).multiplyScalar(24).add(this.cameraAnchor);
    }
    if (this.cameraInitialized) this.camera.position.lerp(this.desiredCamera, 1 - Math.exp(-8 * dt));
    else {
      this.camera.position.copy(this.desiredCamera);
      this.cameraInitialized = true;
    }
    this.desiredCamera.copy(this.camera.position);
    this.clipCameraToWorld();
    this.camera.position.copy(this.desiredCamera);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
    const dot = Math.abs(qx * this.camera.quaternion.x + qy * this.camera.quaternion.y + qz * this.camera.quaternion.z + qw * this.camera.quaternion.w);
    return (
      Math.abs(this.camera.position.x - px) > 1e-4 ||
      Math.abs(this.camera.position.y - py) > 1e-4 ||
      Math.abs(this.camera.position.z - pz) > 1e-4 ||
      1 - Math.min(1, dot) > 1e-6
    );
  }

  /** Keep the camera out of walls: pull it in along the anchor→camera segment. */
  clipCameraToWorld() {
    this.movement.subVectors(this.desiredCamera, this.cameraAnchor);
    const length = this.movement.length();
    if (length <= 0.001) return;
    let t = 1;
    for (const c of this.colliders) {
      if (c.kind !== 'box') continue;
      const hit = this.segmentBoxEntry(this.cameraAnchor, this.movement, c.minX - CAMERA_PAD, c.maxX + CAMERA_PAD, c.minY - CAMERA_PAD, c.maxY + CAMERA_PAD, c.minZ - CAMERA_PAD, c.maxZ + CAMERA_PAD);
      if (hit !== null) t = Math.min(t, hit);
    }
    if (t < 1) {
      const d = Math.max(0.02, t * length - CAMERA_PAD);
      this.desiredCamera.copy(this.movement).setLength(d).add(this.cameraAnchor);
    }
  }

  segmentBoxEntry(o, d, minX, maxX, minY, maxY, minZ, maxZ) {
    let tMin = 0;
    let tMax = 1;
    for (let axis = 0; axis < 3; axis += 1) {
      const dir = axis === 0 ? d.x : axis === 1 ? d.y : d.z;
      const start = axis === 0 ? o.x : axis === 1 ? o.y : o.z;
      const lo = axis === 0 ? minX : axis === 1 ? minY : minZ;
      const hi = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;
      if (Math.abs(dir) < 1e-6) {
        if (start < lo || start > hi) return null;
        continue;
      }
      const inv = 1 / dir;
      const a = (lo - start) * inv;
      const b = (hi - start) * inv;
      tMin = Math.max(tMin, Math.min(a, b));
      tMax = Math.min(tMax, Math.max(a, b));
      if (tMin > tMax) return null;
    }
    return tMin > 0 && tMin <= 1 ? tMin : null;
  }

  reset() {
    this.root.position.copy(this.spawn);
    this.root.rotation.set(0, 0, 0);
    this.velocity.set(0, 0);
    this.verticalVelocity = 0;
    this.floorY = 0;
    this.grounded = true;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.walkTime = 0;
    this.lastStep = 0;
    this.visual.position.y = 0;
    this.visual.rotation.z = 0;
    this.yaw = 0;
    this.pitch = -0.08;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.orbiting = false;
    this.cameraInitialized = false;
  }

  getPosition() {
    return this.root.position;
  }

  getFloorY() {
    return this.floorY;
  }

  getAirHeight() {
    return Math.max(0, this.root.position.y - this.floorY);
  }

  getSpeed() {
    return this.velocity.length();
  }

  getAimRay(origin, direction) {
    origin.set(this.root.position.x, this.root.position.y + 1.38, this.root.position.z);
    this.camera.getWorldDirection(direction).normalize();
  }

  computeInputAim(anchor, aim, yaw = this.yaw, pitch = this.pitch) {
    const c = Math.cos(pitch);
    anchor.set(this.root.position.x, this.root.position.y + 1.38, this.root.position.z);
    aim.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c).normalize();
  }
}
