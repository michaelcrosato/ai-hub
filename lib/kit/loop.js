/**
 * loop.js — frame pacing pieces the kit's loop uses. Pure logic, no DOM.
 */

/**
 * Dynamic resolution: watches frame intervals and trades pixels for frame
 * rate. Drops 10% when a one-second window averages 20% over budget, and
 * creeps back 5% after four comfortable windows in a row. Only used when the
 * Resolution setting is 'auto'.
 */
export class DynamicResolution {
  constructor({ min = 0.6, max = 1, targetMs = 1000 / 60 } = {}) {
    this.min = min;
    this.max = max;
    this.targetMs = targetMs;
    this.scale = max;
    this.#reset(0);
    this.good = 0;
  }

  #reset(now) {
    this.windowStart = now;
    this.sum = 0;
    this.count = 0;
  }

  /** Feed one frame interval; returns true when the scale changed. */
  sample(ms, now) {
    if (!(ms > 0) || ms > 250) {
      // A stall, a hidden tab or a paused game says nothing about GPU load.
      this.#reset(now);
      return false;
    }
    if (this.count === 0) this.windowStart = now;
    this.sum += ms;
    this.count += 1;
    if (now - this.windowStart < 1000 || this.count < 20) return false;
    const avg = this.sum / this.count;
    this.#reset(now);
    if (avg > this.targetMs * 1.2 && this.scale > this.min) {
      this.scale = Math.max(this.min, +(this.scale - 0.1).toFixed(3));
      this.good = 0;
      return true;
    }
    if (avg < this.targetMs * 1.08) {
      this.good += 1;
      if (this.good >= 4 && this.scale < this.max) {
        this.scale = Math.min(this.max, +(this.scale + 0.05).toFixed(3));
        this.good = 0;
        return true;
      }
    } else {
      this.good = 0;
    }
    return false;
  }
}

/** Rolling frames-per-second over roughly the last half second. */
export class FpsCounter {
  constructor() {
    this.fps = 0;
    this.frames = 0;
    this.since = 0;
  }

  tick(now) {
    if (!this.since) {
      this.since = now;
      return false;
    }
    this.frames += 1;
    const span = now - this.since;
    if (span >= 500) {
      this.fps = Math.round((this.frames * 1000) / span);
      this.frames = 0;
      this.since = now;
      return true;
    }
    return false;
  }
}

/** Should this display frame be skipped to honour a frame-rate cap? */
export function skipForCap(now, lastRendered, cap) {
  if (!cap) return false;
  // 1.5 ms of slack so a 60 Hz display does not drop to 30 under a 60 cap.
  return now - lastRendered < 1000 / cap - 1.5;
}
