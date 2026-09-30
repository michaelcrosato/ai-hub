/**
 * audio.js — the arena's synthesized sound effects (WebAudio oscillators, no
 * files). The context is created lazily and resumed on the first real user
 * gesture, so sound also works when a run is started from a gamepad.
 */

/** [start frequency, seconds, waveform, gain] — the original's sound table, plus the new cues. */
const VOICES = {
  shot: [180, 0.035, "square", 0.022],
  hit: [95, 0.045, "sawtooth", 0.032],
  kill: [150, 0.11, "triangle", 0.055],
  hurt: [62, 0.16, "sawtooth", 0.075],
  dash: [430, 0.08, "triangle", 0.035],
  bomb: [44, 0.38, "sawtooth", 0.12],
  pickup: [620, 0.1, "sine", 0.04],
  wave: [220, 0.28, "square", 0.05],
  prize: [880, 0.14, "sine", 0.05],
  tick: [1320, 0.04, "square", 0.018],
};

export class Sfx {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
    this.suspended = false;
    this.ducked = false;
    this.lastShot = 0;
    const gesture = () => this.unlock();
    // Browsers only start audio from a gesture; any key, click or tap will do.
    addEventListener("pointerdown", gesture, { capture: true, passive: true });
    addEventListener("keydown", gesture, { capture: true });
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.unlock();
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.context = new Ctx();
        this.master = this.context.createGain();
        this.master.gain.value = this.ducked ? 0.3 : 1;
        this.master.connect(this.context.destination);
      }
      if (!this.suspended && this.context.state !== "running") this.context.resume().catch(() => {});
    } catch {
      /* audio unavailable: the game plays silently */
    }
  }

  /** Hold all sound while the tab is hidden or the settings panel is open. */
  setSuspended(on) {
    this.suspended = on;
    if (!this.context) return;
    if (on) this.context.suspend().catch(() => {});
    else if (this.enabled) this.context.resume().catch(() => {});
  }

  /** Lower the effects while Iona speaks. */
  setDucked(on) {
    this.ducked = on;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(on ? 0.3 : 1, now + (on ? 0.05 : 0.09));
  }

  play(name) {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const now = this.context.currentTime;
    if (name === "shot") {
      if (now - this.lastShot < 0.045) return;
      this.lastShot = now;
    }
    const voice = VOICES[name];
    if (!voice) return;
    const [freq, length, type, level] = voice;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      name === "pickup" || name === "prize" ? freq * 1.8 : Math.max(24, freq * 0.42),
      now + length,
    );
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(this.master ?? this.context.destination);
    osc.start(now);
    osc.stop(now + length + 0.01);
    if (name === "prize") {
      // A second bright note: the studio "ding".
      const osc2 = this.context.createOscillator();
      const gain2 = this.context.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 1.5, now + 0.07);
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.setValueAtTime(level * 0.8, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.07 + length);
      osc2.connect(gain2).connect(this.master ?? this.context.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.08 + length);
    }
  }
}
