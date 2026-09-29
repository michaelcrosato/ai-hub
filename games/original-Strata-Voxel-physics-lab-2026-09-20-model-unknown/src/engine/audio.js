import { MAT } from '../voxel/palette.js';

const MUTE_KEY = 'strata:mute';
// Rough "pitch" of each material: stone cracks high, timber and canopy knock low and soft.
const TONE = { [MAT.LIMESTONE]: 1, [MAT.SANDSTONE]: 0.85, [MAT.BASALT]: 0.7, [MAT.ANCHOR]: 0.6, [MAT.MOSS]: 0.55,
  [MAT.LEAF]: 0.45, [MAT.PALE_LEAF]: 0.45, [MAT.FLOWER]: 0.5, [MAT.WOOD]: 0.6, [MAT.COPPER]: 1.35, [MAT.GLOW]: 1.2 };

/**
 * Small synthesised sound set: no files to download, nothing decoded until the first
 * gesture. Every call is a no-op until the context runs, and when muted.
 */
export class LabAudio {
  constructor(storage) {
    this.storage = storage; this.ctx = null; this.master = null; this.noise = null; this.paused = false;
    try { this.muted = storage?.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    this.recent = new Map();
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
    addEventListener('touchend', unlock, true);
  }
  unlock() {
    if (!this.ctx) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return;
      try { this.ctx = new Context(); } catch { return; }
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.75;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16; compressor.ratio.value = 6;
      this.master.connect(compressor).connect(ctx.destination);
      const length = ctx.sampleRate, buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
  }
  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    (paused ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  }
  setMuted(muted) {
    this.muted = muted;
    try { this.storage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.03);
  }
  get live() { return !!this.ctx && this.ctx.state === 'running' && !this.muted; }
  /** Skip a sound that already played within ms (keeps busy moments from turning into noise). */
  throttle(key, ms) {
    const now = performance.now(), last = this.recent.get(key) || 0;
    if (now - last < ms) return false;
    this.recent.set(key, now); return true;
  }
  out(pan = 0) {
    if (!this.ctx.createStereoPanner || !pan) return this.master;
    const panner = this.ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master); return panner;
  }
  burst({ duration = 0.2, freq = 1200, q = 1, gain = 0.4, type = 'bandpass', to = null, delay = 0, pan = 0, attack = 0.004 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(env).connect(this.out(pan));
    src.start(t, Math.random() * 0.3); src.stop(t + duration + 0.05);
  }
  tone({ freq = 220, to = null, duration = 0.2, type = 'sine', gain = 0.3, delay = 0, pan = 0, attack = 0.005 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.out(pan));
    osc.start(t); osc.stop(t + duration + 0.05);
  }
  /** Stone breaking: a sharp crack, gravel, and a low thump sized by the break. */
  crack(size = 1, material = MAT.LIMESTONE, { pan = 0, gain = 1 } = {}) {
    if (!this.live || !this.throttle('crack', 45)) return;
    const pitch = TONE[material] ?? 1, g = Math.min(1, gain);
    this.burst({ duration: 0.09, freq: 2600 * pitch, q: 0.8, gain: 0.55 * g, type: 'highpass', pan });
    this.burst({ duration: 0.35 + size * 0.25, freq: 900 * pitch, to: 260, q: 0.9, gain: 0.35 * g, delay: 0.015, pan });
    this.tone({ freq: 95 * pitch + 20, to: 38, duration: 0.3 + size * 0.2, gain: 0.45 * g * Math.min(1, 0.5 + size), pan });
  }
  /** A loose piece knocking into something. */
  impact(strength = 0.5, material = MAT.LIMESTONE, { pan = 0, gain = 1 } = {}) {
    if (!this.live || !this.throttle('impact', 55)) return;
    const pitch = TONE[material] ?? 1, g = Math.min(1, gain) * (0.25 + strength * 0.75);
    if (material === MAT.COPPER) this.tone({ freq: 420 + strength * 160, to: 380, duration: 0.5, type: 'triangle', gain: 0.12 * g, pan });
    this.burst({ duration: 0.12, freq: 700 * pitch, to: 180, q: 1.2, gain: 0.3 * g, pan });
    this.tone({ freq: 70 + 60 * pitch, to: 40, duration: 0.18, gain: 0.35 * g, pan });
  }
  place() {
    if (!this.live || !this.throttle('place', 60)) return;
    this.burst({ duration: 0.06, freq: 1800, q: 3, gain: 0.3 });
    this.tone({ freq: 180, to: 120, duration: 0.12, type: 'triangle', gain: 0.25 });
  }
  /** Something heavy set in motion (drop, launch). */
  whoosh(strength = 1) {
    if (!this.live || !this.throttle('whoosh', 80)) return;
    this.burst({ duration: 0.32, freq: 500, to: 2400, q: 0.7, gain: 0.22 * strength, attack: 0.05 });
    this.tone({ freq: 140, to: 60, duration: 0.2, gain: 0.3 * strength });
  }
  lampOut() {
    if (!this.live || !this.throttle('lamp', 150)) return;
    this.tone({ freq: 880, to: 440, duration: 0.45, type: 'triangle', gain: 0.14 });
    this.tone({ freq: 660, to: 330, duration: 0.5, type: 'sine', gain: 0.1, delay: 0.06 });
  }
  click() {
    if (!this.live || !this.throttle('click', 40)) return;
    this.tone({ freq: 1400, duration: 0.04, type: 'triangle', gain: 0.06 });
  }
  deny() {
    if (!this.live || !this.throttle('deny', 120)) return;
    this.tone({ freq: 190, to: 150, duration: 0.14, type: 'square', gain: 0.05 });
  }
  chime() {
    if (!this.live) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone({ freq, duration: 0.9, type: 'triangle', gain: 0.12, delay: i * 0.11 }));
  }
}
