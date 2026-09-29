import { createPoints } from 'kit/points.js';
import { PALETTE } from '../voxel/palette.js';

/**
 * Square dust chips thrown out of a break. Sized sprites from kit/points.js, so they
 * look the same on WebGPU and WebGL2 (plain Points would draw at one pixel on WebGPU).
 * Particles fade by shrinking, which keeps them opaque and cheap.
 */
export class DustBursts {
  constructor(scene, capacity) {
    this.capacity = capacity;
    this.points = createPoints({ positions: new Float32Array(capacity * 3), colors: new Float32Array(capacity * 3),
      sizes: new Float32Array(capacity), size: 0.2, sizeAttenuation: true, material: { color: 0xffffff, transparent: false } });
    this.points.object.renderOrder = 2;
    scene.add(this.points.object);
    this.velocity = new Float32Array(capacity * 3); this.age = new Float32Array(capacity); this.life = new Float32Array(capacity);
    this.start = new Float32Array(capacity); this.next = 0; this.alive = 0;
    // Hidden (not zero-count) while idle, so the sprite batch never draws with no instances.
    this.points.object.visible = false;
  }
  /** material: palette index for the colour; amount: 0..1 scales the number of chips. */
  emit(point, material, amount = 1) {
    const count = Math.max(4, Math.round(this.capacity * 0.35 * Math.min(1, amount)));
    const color = PALETTE[material]?.color || PALETTE[2].color;
    const pos = this.points.positions.array, col = this.points.colors.array;
    for (let n = 0; n < count; n++) {
      const i = this.next; this.next = (this.next + 1) % this.capacity;
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random() * 0.9, speed = 1.2 + Math.random() * 2.6;
      pos[i * 3] = point[0] + (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 1] = point[1] + (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 2] = point[2] + (Math.random() - 0.5) * 0.2;
      this.velocity[i * 3] = Math.cos(a) * speed; this.velocity[i * 3 + 1] = up * speed; this.velocity[i * 3 + 2] = Math.sin(a) * speed;
      const shade = 0.75 + Math.random() * 0.3;
      col[i * 3] = color[0] * shade; col[i * 3 + 1] = color[1] * shade; col[i * 3 + 2] = color[2] * shade;
      this.age[i] = 0; this.life[i] = 0.5 + Math.random() * 0.7; this.start[i] = 0.1 + Math.random() * 0.14;
    }
    this.alive = this.capacity;
    this.points.object.visible = true;
    this.points.colors.needsUpdate = true;
  }
  update(dt) {
    if (!this.alive) return;
    const pos = this.points.positions.array, size = this.points.sizes.array; let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] >= this.life[i]) { size[i] = 0; continue; }
      this.age[i] += dt; alive++;
      this.velocity[i * 3 + 1] -= 9.81 * dt;
      const drag = Math.exp(-dt * 1.8);
      this.velocity[i * 3] *= drag; this.velocity[i * 3 + 2] *= drag;
      pos[i * 3] += this.velocity[i * 3] * dt; pos[i * 3 + 1] += this.velocity[i * 3 + 1] * dt; pos[i * 3 + 2] += this.velocity[i * 3 + 2] * dt;
      const t = Math.min(1, this.age[i] / this.life[i]);
      size[i] = this.start[i] * (1 - t * t);
    }
    this.alive = alive;
    this.points.positions.needsUpdate = true; this.points.sizes.needsUpdate = true;
    if (!alive) this.points.object.visible = false;
  }
  clear() { this.age.fill(0); this.life.fill(0); this.points.sizes.array.fill(0); this.points.sizes.needsUpdate = true; this.alive = 0; this.points.object.visible = false; }
}
