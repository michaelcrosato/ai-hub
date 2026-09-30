/* Bark & Brush — the vale's song, made on the fly with Web Audio.
   The score gains a part with every grove that wakes (and one more for the moon plum). */

import { rng } from './art.js';

export class Sound {
  /**
   * @param {object} env  getters into the game: mode(), brush(), awake(), threat(), onLabel(text)
   */
  constructor(env) {
    this.env = env;
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this.failed = false;
    this.next = 0;
    this.step = 0;
    this.scheduled = 0;
    this.lastChirp = 0;
    this.held = false; // suspended by pause / hidden tab
    try {
      this.muted = localStorage.getItem('barkbrush.muted') === '1';
    } catch {
      /* storage blocked */
    }
  }

  /** Create or wake the context. Call from a user gesture when possible. */
  start() {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) throw Error('No Web Audio');
        const ctx = new A();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.0001;
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 7500;
        this.filter.connect(this.master);
        this.master.connect(ctx.destination);
        // Brown noise for wind, splashes and brush hiss.
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        const r = rng(526);
        let brown = 0;
        for (let i = 0; i < len; i++) {
          brown = (brown + (r() * 2 - 1) * 0.02) / 1.018;
          data[i] = brown * 3;
        }
        this.noise = buf;
        const wind = ctx.createBufferSource();
        wind.buffer = buf;
        wind.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 650;
        const g = ctx.createGain();
        g.gain.value = 0.052;
        wind.connect(f);
        f.connect(g);
        g.connect(this.filter);
        wind.start();
        this.next = ctx.currentTime + 0.1;
        this.started = true;
      }
      if (!this.held && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      this.level();
    } catch {
      this.failed = true;
      this.started = false;
      this.env.onLabel('Sound unavailable');
    }
  }

  /** Pause or resume all audio (kit pause, hidden tab). */
  hold(on) {
    this.held = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else if (this.started) this.ctx.resume().catch(() => {});
  }

  /** Browsers only unlock audio from a gesture; retry on any key or tap. */
  unlock() {
    if (this.ctx && !this.held && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get suspended() {
    return !!this.ctx && this.ctx.state === 'suspended' && !this.held;
  }

  level() {
    this.env.onLabel(this.failed ? 'Sound unavailable' : this.muted ? 'Sound off' : 'Sound on');
    if (!this.ctx) return;
    const mode = this.env.mode();
    const value = this.muted ? 0.0001 : mode === 'title' ? 0.0001 : mode === 'pause' || mode === 'restart' ? 0.13 : 0.44;
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    this.filter.frequency.setTargetAtTime(this.env.brush() ? 850 : 7500, this.ctx.currentTime, 0.1);
  }

  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('barkbrush.muted', this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!this.ctx && this.env.mode() !== 'title') this.start();
    this.level();
  }

  tone(freq, time, duration, vol = 0.1, type = 'sine', bend = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), time + duration);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    o.connect(g);
    g.connect(this.filter);
    o.start(time);
    o.stop(time + duration + 0.05);
    this.scheduled++;
  }

  pluck(freq, time, vol = 0.09) {
    this.tone(freq, time, 1.3, vol, 'triangle');
    this.tone(freq * 2.003, time, 0.5, vol * 0.2, 'sine');
    this.tone(freq * 3.01, time, 0.23, vol * 0.08, 'sine');
  }

  flute(freq, time, dur = 0.7, vol = 0.05) {
    this.tone(freq, time, dur, vol);
    this.tone(freq * 2, time, dur * 0.8, vol * 0.1);
  }

  noiseHit(duration = 0.16, vol = 0.13, cut = 1700) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    s.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = cut;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(this.filter);
    s.start(t);
    s.stop(t + duration);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  effect(type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (type) {
      case 'bloom':
        for (let i = 0; i < 7; i++) this.pluck([261.63, 293.66, 329.63, 392, 440, 523.25, 659.25][i], t + i * 0.105, 0.13);
        this.flute(523.25, t + 0.3, 1.7, 0.08);
        break;
      case 'moon':
        for (let i = 0; i < 9; i++) this.pluck([392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5][i], t + i * 0.12, 0.11);
        this.flute(659.25, t + 0.4, 2.2, 0.07);
        this.flute(987.77, t + 1.1, 1.8, 0.04);
        break;
      case 'cut':
        this.noiseHit(0.22, 0.45, 900);
        this.tone(420, t, 0.18, 0.14, 'triangle', -300);
        break;
      case 'hit':
        this.noiseHit(0.14, 0.37, 280);
        this.tone(150, t, 0.2, 0.14, 'sine', -90);
        break;
      case 'hurt':
        this.tone(150, t, 0.3, 0.16, 'triangle', -85);
        this.tone(195, t, 0.25, 0.08, 'sine', -110);
        break;
      case 'mend':
        for (let i = 0; i < 9; i++) this.pluck([196, 261.63, 293.66, 392][i % 4], t + i * 0.065, 0.095);
        break;
      case 'dash':
        this.noiseHit(0.28, 0.26, 800);
        this.tone(370, t, 0.14, 0.025, 'sine', 160);
        break;
      case 'brush':
        this.pluck(880, t, 0.08);
        this.noiseHit(0.2, 0.16, 1100);
        break;
      case 'fail':
        this.pluck(196, t, 0.08);
        this.pluck(220, t + 0.08, 0.04);
        break;
      case 'step':
        this.noiseHit(0.055, 0.08, 1500);
        break;
      case 'jump':
        this.tone(260, t, 0.13, 0.05, 'sine', 270);
        break;
      case 'kill':
        for (let i = 0; i < 3; i++) this.pluck([392, 523.25, 659.25][i], t + i * 0.08, 0.09);
        break;
      case 'splash':
        this.noiseHit(0.4, 0.33, 400);
        break;
      case 'kindle':
        this.pluck(783.99, t, 0.1);
        this.pluck(1174.66, t + 0.07, 0.06);
        this.noiseHit(0.12, 0.08, 3000);
        break;
      case 'caw':
        this.tone(640, t, 0.12, 0.05, 'triangle', -280);
        this.tone(560, t + 0.14, 0.15, 0.045, 'triangle', -240);
        break;
      case 'gate':
        this.tone(98, t, 2.4, 0.09, 'sine', 30);
        for (let i = 0; i < 5; i++) this.pluck([196, 293.66, 392, 587.33, 783.99][i], t + 0.3 + i * 0.16, 0.07);
        break;
      default:
        break;
    }
  }

  /** Schedule the score a little ahead of the audio clock. */
  update() {
    if (!this.ctx || !this.started || this.held || document.hidden) return;
    if (this.env.mode() === 'title') return;
    const t = this.ctx.currentTime;
    if (this.next < t - 0.5) this.next = t + 0.05;
    const n = this.env.awake();
    const threat = this.env.threat();
    const scale = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    while (this.next < t + 0.16) {
      const s = this.step % 16;
      if (s % 4 === 0) this.pluck(scale[[0, 2, 3, 1][Math.floor(s / 4)]], this.next, 0.065);
      if (n >= 1 && s % 2 === 0) this.flute(scale[[4, 5, 4, 2, 3, 2, 1, 2][Math.floor(s / 2)]], this.next, 0.75, 0.045);
      if (n >= 2 && s % 4 === 2) this.pluck(scale[[5, 6, 7, 5][Math.floor(s / 4)]] * 2, this.next, 0.025);
      if (n >= 3 && s % 2 === 1) this.pluck(scale[(s + 3) % 8], this.next, 0.047);
      if (n >= 4 && s % 4 === 3) this.pluck(scale[[7, 5, 6, 4][Math.floor(s / 4)]] * 2, this.next, 0.02);
      if (threat && s % 4 === 0) this.tone(90, this.next, 0.26, 0.09, 'sine', -52);
      this.next += 0.37;
      this.step++;
    }
    if (t - this.lastChirp > 9 && n > 0) {
      this.lastChirp = t;
      this.tone(1250, t, 0.13, 0.028, 'sine', 420);
      this.tone(1420, t + 0.2, 0.15, 0.023, 'sine', 270);
    }
  }

  reset() {
    this.step = 0;
    if (this.ctx) this.next = this.ctx.currentTime + 0.1;
  }
}
