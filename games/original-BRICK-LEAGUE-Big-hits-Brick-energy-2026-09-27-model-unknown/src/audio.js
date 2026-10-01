/**
 * Arcade sound: synth tones, cached noise bursts, a crowd bed that swells on big plays,
 * and the clubhouse menu groove. Nothing is downloaded or decoded.
 */
export class ArcadeAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.nextBeat = 0;
    this.beat = 0;
    this.noiseCache = new Map();
    this.crowdGain = null;
    this.crowdLevel = 0;
    this.suspended = false;
  }
  /** Create or resume the context; call from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.suspended) void this.ctx.resume().catch(() => {});
  }
  setEnabled(value) {
    this.enabled = value;
    if (value) this.unlock();
    if (this.master) this.master.gain.setTargetAtTime(value ? 0.16 : 0, this.ctx.currentTime, 0.02);
  }
  /** The kit loop paused (settings panel, hidden tab): hold every sound. */
  setPaused(paused) {
    this.suspended = paused;
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }
  get ready() {
    return this.enabled && !!this.ctx && !!this.master;
  }
  tone(freq, length = 0.1, type = 'square', volume = 0.25, delay = 0, end) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, t + length);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }
  /** A decaying white-noise buffer, built once per length. */
  noiseBuffer(length) {
    const key = Math.round(length * 1000);
    let buffer = this.noiseCache.get(key);
    if (!buffer) {
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * length));
      buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      this.noiseCache.set(key, buffer);
    }
    return buffer;
  }
  noise(length = 0.13, volume = 0.3, highpass = 650) {
    if (!this.ready) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer(length);
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    g.gain.value = volume;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }
  /** A looping crowd murmur (band-passed noise) that big plays push up for a moment. */
  startCrowd() {
    if (!this.ready || this.crowdGain) return;
    const n = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.3;
      data[i] = last;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(band);
    band.connect(this.crowdGain);
    this.crowdGain.connect(this.master);
    src.start();
  }
  /** 0 (silent) to 1 (on their feet); eased, and only touched when it changes. */
  crowd(level) {
    if (!this.ready) return;
    if (!this.crowdGain) {
      if (level <= 0) return;
      this.startCrowd();
    }
    if (Math.abs(level - this.crowdLevel) < 0.02) return;
    this.crowdLevel = level;
    this.crowdGain.gain.setTargetAtTime(level * 1.6, this.ctx.currentTime, 0.25);
  }
  play(name) {
    if (name === 'hit') {
      this.noise(0.09, 0.7);
      this.tone(190, 0.08, 'triangle', 0.65, 0, 55);
    } else if (name === 'power') {
      this.tone(140, 0.5, 'sawtooth', 0.4, 0, 880);
      this.noise(0.3, 0.3);
    } else if (name === 'homer') {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((n, i) => this.tone(n, 0.19, 'square', 0.25, i * 0.085));
      this.noise(1, 0.35, 400);
    } else if (name === 'out') {
      this.tone(220, 0.12, 'square', 0.3);
      this.tone(164.81, 0.22, 'square', 0.25, 0.13);
    } else if (name === 'foul') this.tone(350, 0.12, 'triangle', 0.25, 0, 220);
    else if (name === 'pitch') this.noise(0.14, 0.14);
    else if (name === 'win') {
      [262, 330, 392, 523, 392, 523, 659, 784, 1047].forEach((n, i) => this.tone(n, 0.3, 'square', 0.23, i * 0.15));
      this.noise(1.5, 0.3, 400);
    } else if (name === 'ui') this.tone(640, 0.06, 'triangle', 0.3);
    else if (name === 'strike') this.tone(130, 0.16, 'square', 0.25, 0, 80);
    else this.tone(420, 0.1, 'triangle', 0.25);
  }
  /** The clubhouse groove on the menu screen. */
  update(time, menu = false) {
    if (!menu || !this.ready) return;
    if (time > this.nextBeat + 1) this.nextBeat = time; // back from a pause: don't rush to catch up
    if (time > this.nextBeat) {
      this.nextBeat = time + 0.24;
      const seq = [130.81, 0, 130.81, 196, 164.81, 0, 196, 0, 146.83, 0, 146.83, 220, 196, 0, 164.81, 196];
      const note = seq[this.beat % seq.length];
      if (note) this.tone(note, 0.11, 'triangle', 0.19);
      if (this.beat % 4 === 0) this.tone(90, 0.1, 'sine', 0.2, 0, 40);
      if (this.beat % 2) this.noise(0.03, 0.04);
      this.beat++;
    }
  }
}
