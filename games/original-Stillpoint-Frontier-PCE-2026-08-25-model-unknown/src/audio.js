/**
 * audio.js — the synthesized soundscape: a low two-tone drone, weather noise
 * that follows rain and wind, signal pings, chords for completions, and soft
 * footsteps. Nothing is loaded; the AudioContext starts on the first gesture.
 */
export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.weatherGain = null;
    this.weatherFilter = null;
    this.noise = null;
    this.ambientNodes = [];
    this.timers = new Set();
    this.dimmed = false;
    this.lastStep = 0;
  }

  /** Create the context (or resume it). Safe to call on every gesture. */
  start() {
    if (this.context) {
      if (this.context.state === 'suspended' && !this.suspended) this.context.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.dimmed ? 0.05 : 0.16;
      master.connect(ctx.destination);
      const drone = ctx.createGain();
      drone.gain.value = 0.035;
      drone.connect(master);
      for (const [frequency, detune] of [
        [43, -7],
        [64.5, 5],
      ]) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        filter.type = 'lowpass';
        filter.frequency.value = 180;
        osc.connect(filter).connect(drone);
        osc.start();
        this.ambientNodes.push(osc, filter);
      }
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 5312912;
      for (let i = 0; i < data.length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 2147483648 - 1;
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = 1250;
      filter.Q.value = 0.32;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      this.ambientNodes.push(source, filter, gain, drone);
      this.weatherGain = gain;
      this.weatherFilter = filter;
      this.noise = buffer;
      this.context = ctx;
      this.master = master;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  /** Quieter while a menu is open. */
  setDimmed(on) {
    this.dimmed = on;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 0.05 : 0.16, this.context.currentTime, 0.12);
  }

  /** Hard stop while the kit's settings panel is open or the tab is hidden. */
  setSuspended(on) {
    this.suspended = on;
    if (!this.context) return;
    if (on) this.context.suspend().catch(() => {});
    else this.context.resume().catch(() => {});
  }

  ping(index = 0) {
    const notes = [220, 277.18, 329.63, 440];
    this.note(notes[index % notes.length] ?? 220, 0.16, 0.05);
  }

  reject() {
    this.note(92, 0.2, 0.045, 'sawtooth');
  }

  complete() {
    [261.63, 329.63, 392, 523.25].forEach((f, i) => this.schedule(() => this.note(f, 0.55, 0.055), i * 95));
  }

  finale() {
    [130.81, 196, 261.63, 329.63, 523.25].forEach((f, i) => this.schedule(() => this.note(f, 1.4, 0.045), i * 130));
  }

  /** A low, wide chord for the vault below the Stillpoint. */
  below() {
    [65.41, 98, 130.81, 155.56, 196, 261.63].forEach((f, i) => this.schedule(() => this.note(f, 2.6, 0.04, i % 2 ? 'triangle' : 'sine'), i * 180));
  }

  setWeather(precipitation, windKph) {
    if (!this.context || !this.weatherGain || !this.weatherFilter) return;
    const rain = Math.max(0, Math.min(1, Number.isFinite(precipitation) ? precipitation : 0));
    const wind = Math.max(0, Math.min(1, Number.isFinite(windKph) ? windKph / 70 : 0));
    const t = this.context.currentTime;
    this.weatherGain.gain.setTargetAtTime(rain * 0.11 + wind * 0.022, t, 0.8);
    this.weatherFilter.frequency.setTargetAtTime(620 + rain * 1450 + wind * 320, t, 0.9);
  }

  /** A soft filtered-noise footstep; strength 0..1. */
  step(strength = 0.7) {
    if (!this.context || !this.master || !this.noise || this.context.state !== 'running') return;
    const ctx = this.context;
    const now = ctx.currentTime;
    if (now - this.lastStep < 0.12) return;
    this.lastStep = now;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = 340 + Math.random() * 180;
    filter.Q.value = 1.1;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06 * strength + 0.01, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now, Math.random() * 1.8, 0.14);
  }

  land(strength = 0.5) {
    if (!this.context || !this.master || !this.noise || this.context.state !== 'running') return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08 + strength * 0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now, Math.random() * 1.5, 0.25);
  }

  destroy() {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    for (const node of this.ambientNodes) node.disconnect();
    this.ambientNodes = [];
    this.context?.close().catch?.(() => {});
    this.context = null;
    this.master = null;
    this.weatherGain = null;
    this.weatherFilter = null;
  }

  schedule(fn, ms) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  note(frequency, duration, peak, type = 'sine') {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.015, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}
