/** Bounded catch-up prevents a slow frame from producing an unbounded physics loop. */
export class FixedClock {
  maxSteps;
  accumulator = 0;
  step;
  droppedTime = 0;
  constructor(hz = 60, maxSteps = 5) {
    this.maxSteps = maxSteps;
    if (!Number.isFinite(hz) || hz <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('Invalid clock settings.');
    this.step = 1 / hz;
  }
  advance(delta, update) {
    if (!Number.isFinite(delta) || delta < 0) return this.accumulator / this.step;
    const allowed = Math.min(delta, this.step * this.maxSteps);
    this.droppedTime += delta - allowed;
    this.accumulator += allowed;
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.step && steps < this.maxSteps) {
      update(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    this.accumulator = Math.max(0, this.accumulator);
    return this.accumulator / this.step;
  }
  reset() {
    this.accumulator = 0;
  }
}
