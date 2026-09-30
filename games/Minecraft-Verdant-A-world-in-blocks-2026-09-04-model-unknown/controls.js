// First-person camera: free flight or on foot, driven by kit.input actions only.

import * as THREE from 'three/webgpu';
import { CONFIG, clamp } from './config.js';

const EYE = CONFIG.eyeHeight;
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dir = new THREE.Vector3();

export class Controls {
  constructor(camera, world, input) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.mode = 'fly';
    this.yaw = 0.45;
    this.pitch = -0.23;
    this.active = true;
    this.velocityY = 0;
    this.grounded = false;
    this.stride = 0;
    /** Hooks for sound and rumble. */
    this.onStep = null;
    this.onLand = null;
    this.onJump = null;
  }

  rotate() {
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
  }

  lookAt(target) {
    this.camera.lookAt(target);
    _euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.pitch = _euler.x;
    this.yaw = _euler.y;
  }

  /** The nearest dry, open ground to (x, z), searching outwards. */
  safePosition(x, z) {
    for (let r = 0; r < 120; r += 4) {
      for (let i = 0; i < 16; i++) {
        const px = x + Math.cos((i / 16) * Math.PI * 2) * r;
        const pz = z + Math.sin((i / 16) * Math.PI * 2) * r;
        if (this.world.isWalkable(px, pz)) return { x: px, z: pz, y: this.world.groundAt(px, pz) };
      }
    }
    return { x, z, y: Math.max(this.world.groundAt(x, z), 12) };
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.velocityY = 0;
    if (mode === 'walk') {
      const p = this.safePosition(this.camera.position.x, this.camera.position.z);
      this.camera.position.set(p.x, p.y + EYE, p.z);
      this.pitch = clamp(this.pitch, -0.55, 0.55);
      this.grounded = true;
      this.rotate();
    } else {
      this.camera.position.y += 16;
    }
  }

  keepAboveGround() {
    const p = this.camera.position;
    const s = this.world.sample(p.x, p.z);
    p.y = clamp(p.y, Math.max(s.groundY, s.waterY) + EYE, 700);
  }

  update(dt) {
    if (!this.active) return;
    const input = this.input;
    const look = input.look('look');
    if (look.x || look.y) {
      this.yaw -= look.x;
      this.pitch = clamp(this.pitch - look.y, -1.45, 1.45);
      this.rotate();
    }
    const move = input.vector('move');
    const speed = (this.mode === 'fly' ? CONFIG.flySpeed : CONFIG.walkSpeed) * (input.down('fast') ? 2.5 : 1);
    const step = dt * speed;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (-sin * move.y + cos * move.x) * step;
    const dz = (-cos * move.y - sin * move.x) * step;
    const p = this.camera.position;

    if (this.mode === 'fly') {
      p.x += dx;
      p.z += dz;
      p.y += clamp(input.value('rise') - input.value('descend'), -1, 1) * step;
      // Wheel and pinch glide along the view.
      const zoom = input.zoom();
      if (zoom) {
        this.camera.getWorldDirection(_dir);
        p.addScaledVector(_dir, clamp(zoom, -4, 4) * 12);
      }
      this.keepAboveGround();
      return;
    }

    // On foot: slide along whatever blocks the way, in sub-steps so fast moves cannot tunnel.
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 1.5));
    const x0 = p.x;
    const z0 = p.z;
    for (let i = 0; i < n; i++) {
      const gy = this.world.groundAt(p.x, p.z);
      if (this.world.isWalkable(p.x + dx / n, p.z, gy)) p.x += dx / n;
      if (this.world.isWalkable(p.x, p.z + dz / n, gy)) p.z += dz / n;
    }
    const eye = this.world.groundAt(p.x, p.z) + EYE;
    if (input.down('rise') && this.grounded) {
      this.velocityY = 11;
      this.grounded = false;
      this.onJump?.();
    }
    this.velocityY -= 28 * dt;
    p.y += this.velocityY * dt;
    if (p.y <= eye) {
      if (this.velocityY < -16) this.onLand?.(Math.min(1, -this.velocityY / 40));
      this.velocityY = 0;
      this.grounded = true;
      // Climb onto a higher block over a few frames instead of popping up two metres.
      const gap = eye - p.y;
      p.y = gap > 0.02 ? p.y + gap * Math.min(1, dt * 14) : eye;
    } else if (p.y > eye + 0.6) {
      // Walked off a ledge: no jumping from mid-air.
      this.grounded = false;
    }
    if (this.grounded && p.y <= eye + 0.3) {
      this.stride += Math.hypot(p.x - x0, p.z - z0);
      if (this.stride > 2.8) {
        this.stride = 0;
        this.onStep?.();
      }
    }
  }
}
