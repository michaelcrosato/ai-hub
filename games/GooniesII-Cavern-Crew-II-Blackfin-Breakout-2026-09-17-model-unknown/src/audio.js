// Tiny synthesized sound board: no files to load. The AudioContext is created on the first
// gesture (Start / Continue / the sound button) and suspended whenever the game pauses.

const PREF_KEY = 'cavern-crew-2:sound';

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export class SoundBoard {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.enabled = readPref();
    this.musicClock = 0;
    this.beat = 0;
    this.notes = [130.81, 164.81, 196.0, 220.0, 196.0, 164.81, 146.83, 174.61];
    this.held = false;
  }

  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.held) {
      try {
        await this.ctx.resume();
      } catch {
        /* resumes on the next gesture */
      }
    }
  }

  /** Pause or resume all sound (game pause, settings panel, hidden tab). */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = !!on;
    try {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
  }

  get live() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  tone(freq, duration = 0.09, gain = 0.035, type = 'square', slide = 0, delay = 0) {
    if (!this.live) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Filtered white noise: steam, crumbling rock. */
  hiss(duration = 0.4, gain = 0.02, filter = 'highpass', freq = 1800) {
    if (!this.live) return;
    if (!this.noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.8);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.05);
  }

  shot() { this.tone(460, 0.07, 0.025, 'square', -240); }
  hit() { this.tone(95, 0.08, 0.04, 'sawtooth', -35); }
  hurt() { this.tone(180, 0.14, 0.04, 'square', -110); }
  pickup() { this.tone(650, 0.06, 0.028, 'square', 300); this.tone(940, 0.07, 0.024, 'square', 0, 0.055); }
  level() { [523, 659, 784].forEach((n, i) => this.tone(n, 0.12, 0.03, 'triangle', 0, i * 0.085)); }
  fail() { this.tone(150, 0.22, 0.03, 'sawtooth', -70); }
  win() { [392, 523, 659, 784].forEach((n, i) => this.tone(n, 0.2, 0.035, 'triangle', 0, i * 0.11)); }
  dash() { this.tone(240, 0.08, 0.025, 'sawtooth', 140); }
  knock() { this.tone(118, 0.16, 0.05, 'triangle', -40); this.tone(82, 0.2, 0.03, 'sine', -20, 0.03); }
  crumble() { this.hiss(0.7, 0.05, 'lowpass', 700); this.tone(70, 0.5, 0.05, 'sawtooth', -30); }
  valve() { this.tone(190, 0.32, 0.03, 'sawtooth', -70); this.tone(880, 0.05, 0.02, 'square', 0, 0.34); }
  steam() { this.hiss(0.9, 0.014); }
  spit() { this.tone(320, 0.12, 0.025, 'sine', -190); }
  splat() { this.tone(140, 0.07, 0.02, 'sine', -60); }
  click() { this.tone(720, 0.03, 0.015, 'square'); }

  update(dt) {
    if (!this.live) return;
    this.musicClock -= dt;
    if (this.musicClock <= 0) {
      this.musicClock += 0.42;
      const note = this.notes[this.beat++ % this.notes.length];
      this.tone(note, 0.18, 0.008, 'triangle');
      if (this.beat % 4 === 1) this.tone(note / 2, 0.11, 0.008, 'sine');
    }
  }
}
