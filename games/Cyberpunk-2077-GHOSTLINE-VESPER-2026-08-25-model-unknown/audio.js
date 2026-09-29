/**
 * audio.js — synthesized sound effects (Web Audio oscillators and noise).
 * The context starts on the first gesture and suspends while the game pauses.
 */

export class Sfx {
  context = null;
  master = null;
  timers = new Set();
  destroyed = false;
  paused = false;
  noiseBuffer = null;

  constructor() {
    const unlock = () => this.resume();
    addEventListener('pointerdown', unlock, { once: true, capture: true });
    addEventListener('keydown', unlock, { once: true, capture: true });
  }

  resume() {
    if (this.destroyed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended' && !this.paused) this.context.resume();
    } catch {
      /* no audio on this device */
    }
  }

  /** Called from kit.onPause: silence while the settings menu is open. */
  setPaused(paused) {
    this.paused = paused;
    if (!this.context) return;
    if (paused) this.context.suspend().catch(() => {});
    else this.context.resume().catch(() => {});
  }

  shot(type) {
    const f = type === 'ion' ? 310 : type === 'thermal' ? 120 : 78;
    this.tone(f, 0.055, type === 'ion' ? 'sawtooth' : 'square', 0.2, f * 0.42);
    if (type === 'kinetic') this.noise(0.045, 0.12);
  }

  hit(critical) {
    this.tone(critical ? 860 : 610, critical ? 0.09 : 0.045, 'triangle', critical ? 0.17 : 0.1, critical ? 1200 : 780);
  }

  hurt() {
    this.tone(52, 0.16, 'sawtooth', 0.14, 32);
  }

  reload() {
    this.tone(220, 0.045, 'square', 0.08, 160);
    const id = setTimeout(() => {
      this.timers.delete(id);
      this.tone(430, 0.04, 'square', 0.07, 520);
    }, 180);
    this.timers.add(id);
  }

  ability(f = 420) {
    this.tone(f, 0.26, 'sine', 0.14, f * 2.2);
  }

  hack(success) {
    this.tone(success ? 520 : 95, success ? 0.3 : 0.4, success ? 'sine' : 'sawtooth', 0.13, success ? 980 : 48);
  }

  destroy() {
    this.destroyed = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.context?.close();
    this.context = null;
    this.master = null;
  }

  tone(freq, duration, type, gain, endFreq) {
    this.resume();
    const ctx = this.context;
    if (!ctx || !this.master || this.paused) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  noise(duration, gain) {
    const ctx = this.context;
    if (!ctx || !this.master || this.paused) return;
    // One shared second of white noise instead of a new buffer per shot.
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    src.buffer = this.noiseBuffer;
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(amp);
    amp.connect(this.master);
    src.start(ctx.currentTime, Math.random() * 0.9, duration);
  }
}
