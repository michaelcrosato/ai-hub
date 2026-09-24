import { FIXED_DT, MAX_SUBSTEPS } from './config.js';
export class FixedStepClock {
  constructor(dt = FIXED_DT, maxSteps = MAX_SUBSTEPS) {
    this.dt = dt; this.maxSteps = maxSteps; this.accumulator = 0; this.droppedSeconds = 0; this.simulationSeconds = 0;
  }
  advance(delta, step, paused = false) {
    if (paused) { this.accumulator = 0; return { alpha: 1, steps: 0 }; }
    delta = Math.max(0, Number.isFinite(delta) ? delta : 0);
    this.droppedSeconds += Math.max(0, delta - 0.25); this.accumulator += Math.min(delta, 0.25);
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.dt && steps < this.maxSteps) {
      step(this.dt); this.accumulator -= this.dt; this.simulationSeconds += this.dt; steps++;
    }
    if (this.accumulator >= this.dt) {
      const dropped = Math.floor(this.accumulator / this.dt) * this.dt;
      this.accumulator -= dropped; this.droppedSeconds += dropped;
    }
    return { alpha: Math.max(0, this.accumulator / this.dt), steps };
  }
  reset() { this.accumulator = 0; this.droppedSeconds = 0; this.simulationSeconds = 0; }
}
