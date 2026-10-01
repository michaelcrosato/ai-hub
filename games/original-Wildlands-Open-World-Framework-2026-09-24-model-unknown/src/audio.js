// audio.js — a quiet synthesized soundscape: wind that follows speed and height, water
// while swimming, the campfire's crackle, footsteps, and small chimes for the survey.
// Nothing is downloaded; the audio context starts on the first tap, click or key.

export class Sound {
  constructor() {
    this.ctx = null; this.enabled = true; this.volume = 0.8; this.holds = new Set(); this.crackleAt = 0;
    const unlock = () => {
      this.start();
      if (this.ctx && this.ctx.state === 'running') for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) removeEventListener(type, unlock, true);
    };
    for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) addEventListener(type, unlock, true);
  }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC(); this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
      // Two seconds of soft brown noise, looped: the source for wind and water.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; data[i] = last * 6; }
      this.noiseBuffer = buffer;
      const white = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate), w = white.getChannelData(0);
      for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
      this.whiteBuffer = white;
      const loop = (filterType, freq, q) => {
        const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
        const filter = ctx.createBiquadFilter(); filter.type = filterType; filter.frequency.value = freq; filter.Q.value = q;
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(this.master); src.start();
        return { filter, gain };
      };
      this.wind = loop('bandpass', 420, 0.6);
      this.water = loop('lowpass', 520, 0.4);
      this.applyMaster();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { this.ctx = null; }
  }
  setEnabled(on) { this.enabled = !!on; this.applyMaster(); }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.applyMaster(); }
  /** Silence for a reason (the kit's menu, a hidden tab) until every reason is gone. */
  hold(reason, on) { if (on) this.holds.add(reason); else this.holds.delete(reason); this.applyMaster(); }
  applyMaster() {
    if (!this.ctx) return;
    const target = this.enabled && !this.holds.size ? this.volume : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }
  get live() { return !!this.ctx && this.enabled && !this.holds.size && this.ctx.state === 'running'; }
  /** Every frame: { speed m/s, height above ground, flying, swimming, campDistance, paused }. */
  update(dt, s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const calm = s.paused ? 0.25 : 1;
    const wind = Math.min(1, 0.18 + s.speed / 140 + Math.min(1, s.height / 900) * 0.35) * calm * (s.swimming ? 0.3 : 1);
    this.wind.gain.gain.setTargetAtTime(wind * 0.22, t, 0.25);
    this.wind.filter.frequency.setTargetAtTime(300 + Math.min(1400, s.speed * 6 + s.height * 0.4), t, 0.3);
    this.water.gain.gain.setTargetAtTime(s.swimming ? 0.32 * calm : 0, t, 0.2);
    // The campfire crackles when you are close to it.
    if (!s.paused && s.campDistance < 45 && this.live && t > this.crackleAt) {
      this.crackleAt = t + 0.05 + Math.random() * 0.3;
      this.burst({ type: 'highpass', freq: 1800 + Math.random() * 2400, gain: 0.12 * (1 - s.campDistance / 45), length: 0.02 + Math.random() * 0.03 });
    }
  }
  /** A short filtered noise burst (footsteps, crackles, splashes, thumps). */
  burst({ type = 'lowpass', freq = 400, q = 0.7, gain = 0.2, length = 0.08, rate = 1 }) {
    if (!this.live) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.whiteBuffer; src.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + length);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.3); src.stop(t + length + 0.02);
  }
  step(surface) {
    if (surface === 'water') this.burst({ type: 'bandpass', freq: 900, q: 0.6, gain: 0.16, length: 0.16 });
    else if (surface === 'snow') this.burst({ type: 'bandpass', freq: 2100, q: 0.9, gain: 0.1, length: 0.07 });
    else this.burst({ type: 'lowpass', freq: 380 + Math.random() * 120, gain: 0.22, length: 0.07 });
  }
  thump(strength = 0.5) { this.burst({ type: 'lowpass', freq: 160, gain: 0.25 + strength * 0.35, length: 0.18 }); }
  click() { this.tone(1250, 0.04, 0.05, 'square', 0.02); }
  /** Notes as frequencies, played one after another. */
  chime(notes, gap = 0.11, gain = 0.09) { notes.forEach((f, i) => this.tone(f, 0.9, gain, 'sine', i * gap)); }
  tone(freq, length, gain, type = 'sine', delay = 0) {
    if (!this.live) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(this.master); osc.start(t); osc.stop(t + length + 0.05);
  }
}
