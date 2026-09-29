// Image-based fill light, automatic exposure and the slow day cycle.
import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (v) => v * v * (3 - 2 * v);

/** A small pre-filtered room environment; its strength follows the time of day. */
export class EnvironmentLight {
  constructor(renderer, scene) {
    this.scene = scene;
    this.intensity = 0.04;
    this.targetIntensity = 0.04;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.target = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 });
    scene.environment = this.target.texture;
    scene.environmentIntensity = this.intensity;
    room.dispose();
    pmrem.dispose();
  }

  update(dt, timeOfDay, indoors) {
    this.targetIntensity = this.getTargetIntensity(timeOfDay, indoors);
    this.intensity += (this.targetIntensity - this.intensity) * (1 - Math.exp(-dt * 1.8));
    this.scene.environmentIntensity = this.intensity;
  }

  snap(timeOfDay, indoors) {
    this.intensity = this.targetIntensity = this.getTargetIntensity(timeOfDay, indoors);
    this.scene.environmentIntensity = this.intensity;
  }

  getTargetIntensity(timeOfDay, indoors) {
    const day = 1 - smooth(clamp((timeOfDay - 0.58) / 0.37, 0, 1));
    const floor = indoors ? 0.04 : 0.028;
    return floor + ((indoors ? 0.15 : 0.32) - floor) * day;
  }
}

/** Eye adaptation: fast towards bright, slow towards dark. */
export class AutoExposure {
  constructor() {
    this.filteredMeter = 0.45;
    this.current = 1.05;
  }

  update(dt, timeOfDay, indoors, localMeter, bias, enabled) {
    if (!enabled) {
      this.current = bias;
      this.filteredMeter = 0.45;
      return this.current;
    }
    const day = 1 - clamp((timeOfDay - 0.58) / 0.37, 0, 1);
    const ambient = indoors ? day * 0.14 : day * 0.98;
    const local = clamp(localMeter * 0.075, 0, 0.72);
    const meter = 0.02 + ambient + local;
    this.filteredMeter += (meter - this.filteredMeter) * (1 - Math.exp(-dt * 2));
    const stops = clamp(0.35 * Math.log2(0.45 / Math.max(0.015, this.filteredMeter)), -0.45, 0.45);
    const target = clamp(bias * 2 ** stops, 0.72, 1.48);
    const rate = target < this.current ? 4 : 0.8;
    this.current += (target - this.current) * (1 - Math.exp(-dt * rate));
    return this.current;
  }
}

/** The "Moving sun" toggle: nudges the time of day and bounces between day and night. */
export class DayCycle {
  constructor() {
    this.elapsed = 0;
    this.direction = 1;
  }

  /** Returns a new time of day every 0.15 s while running, otherwise null. */
  update(dt, timeOfDay, running) {
    if (!running) {
      this.elapsed = 0;
      return null;
    }
    this.elapsed += Math.min(0.1, Math.max(0, dt));
    if (this.elapsed < 0.15) return null;
    const next = clamp(timeOfDay + this.elapsed * 0.012 * this.direction, 0, 1);
    this.elapsed = 0;
    if (next >= 1) this.direction = -1;
    else if (next <= 0) this.direction = 1;
    return next;
  }
}
