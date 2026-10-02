/**
 * Quiet synthesized interface sounds: no audio files to download, and the
 * AudioContext is only created after the player's first gesture.
 */
const KEY = "singularity-tycoon-sound";
function readPref() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export const sound = {
  enabled: readPref(),
  ctx: null,
  master: null,
  paused: false,
  /** Call from a user gesture: creates or resumes the context. */
  unlock() {
    if (!this.enabled || this.paused) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  },
  setEnabled(on) {
    this.enabled = !!on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* the choice lasts for this visit */
    }
    if (on) this.unlock();
    else this.ctx?.suspend().catch(() => {});
  },
  /** The kit loop paused (its settings panel) or the tab was hidden. */
  pause(on) {
    this.paused = !!on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else if (this.enabled) this.ctx.resume().catch(() => {});
  },
  tone(freq, dur, { type = "sine", gain = 0.03, at = 0, to = null, attack = 0.008 } = {}) {
    const ctx = this.ctx,
      t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  play(name) {
    if (!this.enabled || this.paused || !this.ctx || this.ctx.state !== "running") return;
    try {
      switch (name) {
        case "click":
          this.tone(340, 0.09, { gain: 0.02 });
          break;
        case "tap":
          this.tone(520, 0.05, { gain: 0.008 });
          break;
        case "build":
          this.tone(190, 0.16, { type: "triangle", gain: 0.06, to: 120 });
          this.tone(380, 0.08, { gain: 0.015, at: 0.05 });
          break;
        case "sell":
          this.tone(260, 0.18, { type: "triangle", gain: 0.045, to: 150 });
          break;
        case "wire":
          this.tone(620, 0.05, { type: "triangle", gain: 0.014 });
          break;
        case "error":
          this.tone(170, 0.14, { type: "square", gain: 0.012, to: 140 });
          break;
        case "save":
          this.tone(520, 0.07, { gain: 0.018 });
          this.tone(780, 0.1, { gain: 0.016, at: 0.07 });
          break;
        case "discover":
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, { gain: 0.03, at: i * 0.09 }));
          break;
        case "event":
          this.tone(392, 0.25, { gain: 0.03 });
          this.tone(523.25, 0.35, { gain: 0.028, at: 0.12 });
          break;
        case "era":
          [196, 246.94, 293.66].forEach((f) => this.tone(f, 1.4, { gain: 0.018, attack: 0.15 }));
          break;
        case "win":
          [392, 493.88, 587.33, 783.99].forEach((f, i) => this.tone(f, 0.7, { gain: 0.03, at: i * 0.13 }));
          break;
        case "lose":
          [392, 329.63, 261.63].forEach((f, i) => this.tone(f, 0.6, { gain: 0.028, at: i * 0.16 }));
          break;
      }
    } catch {
      /* audio is decoration */
    }
  },
};
