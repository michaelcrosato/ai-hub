/**
 * audio.js — the probe's sound, all synthesised with Web Audio (no files).
 * The context starts on the first key press, click or tap; until then every
 * call is a no-op. The original basin hum and scan pulses are kept; the beam,
 * footsteps, harvest hits, pickups, wind and the big moments are new.
 */

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.noise = null;
    this.beamGain = null;
    this.held = false;
  }

  /** Create or resume the context. Safe to call from any user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.2;
    this.master.connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);

    // The basin hum (the original's sawtooth drone).
    const humGain = ctx.createGain();
    humGain.gain.value = 0.035;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 180;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 43;
    hum.connect(humFilter).connect(humGain).connect(this.bus);
    hum.start();

    // Wind: looped noise through a slowly breathing band-pass.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(windGain.gain);
    wind.connect(windFilter).connect(windGain).connect(this.bus);
    wind.start();
    lfo.start();

    // The extraction beam: a buzzing tone that fades in while the beam is on.
    const beam = ctx.createOscillator();
    beam.type = 'sawtooth';
    beam.frequency.value = 96;
    const beam2 = ctx.createOscillator();
    beam2.type = 'triangle';
    beam2.frequency.value = 193;
    const beamFilter = ctx.createBiquadFilter();
    beamFilter.type = 'lowpass';
    beamFilter.frequency.value = 900;
    this.beamGain = ctx.createGain();
    this.beamGain.gain.value = 0;
    beam.connect(beamFilter);
    beam2.connect(beamFilter);
    beamFilter.connect(this.beamGain).connect(this.bus);
    beam.start();
    beam2.start();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Suspend everything while the kit's settings panel pauses the game. */
  setSuspended(on) {
    this.held = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  /** Softer mix under the game's own menus. */
  setDucked(on) {
    if (!this.ctx) return;
    this.bus.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.12);
    if (on) this.beam(false);
  }

  beam(on) {
    if (!this.ctx) return;
    this.beamGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, on ? 0.04 : 0.08);
  }

  /** The original falling sine pulse (scan, spire sync). */
  pulse(freq = 560, dur = 0.55, gain = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.42, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur);
  }

  /** A short filtered noise burst: harvest hits, footsteps, landings. */
  burst(freq, dur, gain, type = 'bandpass') {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
  }

  tone(freq, dur, gain = 0.08, type = 'sine', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hit(kind) {
    const f = kind === 'rock' ? 1300 : kind === 'tree' ? 700 : 2400;
    this.burst(f, 0.09, 0.22);
    this.tone(kind === 'rock' ? 220 : kind === 'tree' ? 160 : 330, 0.08, 0.04, 'square');
  }

  collect() {
    this.tone(880, 0.18, 0.08);
    this.tone(1320, 0.26, 0.07, 'sine', 0.07);
  }

  depleted(kind) {
    this.burst(kind === 'rock' ? 500 : 380, 0.35, 0.3, 'lowpass');
    this.tone(660, 0.22, 0.06, 'triangle', 0.05);
    this.tone(990, 0.3, 0.05, 'triangle', 0.12);
  }

  step(sprint) {
    this.burst(sprint ? 260 : 200, 0.07, sprint ? 0.07 : 0.05, 'lowpass');
  }

  land(strength) {
    this.burst(150, 0.18, Math.min(0.3, 0.08 + strength * 0.03), 'lowpass');
  }

  jump() {
    this.burst(600, 0.08, 0.05);
  }

  deny() {
    this.tone(180, 0.16, 0.06, 'square');
    this.tone(140, 0.2, 0.05, 'square', 0.1);
  }

  ui() {
    this.tone(1600, 0.04, 0.025, 'triangle');
  }

  fabricate() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 0.06, 'triangle', i * 0.07));
  }

  /** A slow chord for the vault and the finished relay network. */
  chord(root = 110, dur = 3.2) {
    [1, 1.5, 2, 2.52, 3].forEach((m, i) => this.tone(root * m, dur, 0.05, i % 2 ? 'triangle' : 'sine', i * 0.12));
  }

  relay() {
    [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.5, 0.06, 'sine', i * 0.1));
  }
}
