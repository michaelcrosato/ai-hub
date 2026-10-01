/**
 * Block Court — procedural Web Audio. No recordings and no downloads: every
 * sound is an oscillator or filtered noise, and the beat is scheduled ahead
 * on the audio clock.
 *
 * The context is created on the first key press, click or tap (browsers keep
 * audio locked until then; a gamepad button does not count), and suspended
 * while the kit's settings panel pauses the game.
 */

export class ArcadeAudio {
  /** @param {{sound: boolean, music: boolean}} settings  read live */
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.nextBeat = 0;
    this.step = 0;
    this.held = false;
  }

  /** Create or resume the context. Safe to call from any user gesture. */
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.settings.sound ? 0.48 : 0;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.settings.music ? 0.17 : 0;
        this.musicGain.connect(this.master);
        this.nextBeat = this.ctx.currentTime + 0.12;
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const b = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
  }

  /** Hold the context while the game is paused by the kit (settings panel). */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  tone(freq, duration = 0.12, volume = 0.2, type = 'sine', endFreq = null, delay = 0, music = false) {
    if (!this.ctx || !this.settings.sound) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(15, endFreq), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(music ? this.musicGain : this.master);
    o.start(t);
    o.stop(t + duration + 0.01);
  }

  noise(duration = 0.15, volume = 0.15, frequency = 1200, delay = 0, music = false, q = 0.5) {
    if (!this.ctx || !this.settings.sound) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    s.buffer = this.noiseBuffer;
    f.type = 'bandpass';
    f.frequency.value = frequency;
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(music ? this.musicGain : this.master);
    s.start(t, Math.random() * 0.2);
    s.stop(t + duration + 0.01);
  }

  dribble(v = 0.8) {
    this.tone(125, 0.1, 0.18 * v, 'sine', 47);
    this.noise(0.05, 0.04 * v, 310);
  }

  swish(dunk = false) {
    this.noise(0.27, 0.23, 2500);
    if (dunk) {
      this.tone(85, 0.35, 0.45, 'sine', 28);
      this.noise(0.21, 0.35, 240);
    }
    this.tone(523, 0.12, 0.1, 'triangle', null, 0.06);
    this.tone(659, 0.16, 0.1, 'triangle', null, 0.16);
    this.tone(784, 0.26, 0.1, 'triangle', null, 0.26);
    this.noise(0.95, 0.12, 950, 0.15);
  }

  /** The crowd: a swelling roar of band-passed noise. */
  crowd(power = 1) {
    if (!this.ctx || !this.settings.sound) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    s.buffer = this.noiseBuffer;
    s.loop = true;
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.35;
    const peak = 0.05 + 0.09 * power;
    const len = 1.1 + power * 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  }

  rim() {
    this.tone(450, 0.11, 0.13, 'triangle', 210);
    this.tone(680, 0.1, 0.07, 'sine');
  }

  /** The end-of-game horn. */
  buzzer() {
    this.tone(196, 0.9, 0.16, 'sawtooth');
    this.tone(247, 0.9, 0.12, 'sawtooth');
    this.tone(294, 0.9, 0.08, 'square');
  }

  /** A money ball comes off the rack. */
  money() {
    this.tone(988, 0.12, 0.08, 'triangle');
    this.tone(1319, 0.2, 0.08, 'triangle', null, 0.08);
  }

  /** Short UI blip for menu moves. */
  blip(up = true) {
    this.tone(up ? 660 : 520, 0.05, 0.05, 'triangle');
  }

  /**
   * Keep the beat scheduled a little ahead. `active` is false on menus, pauses
   * and countdowns: the beat then waits instead of piling up.
   */
  tick(active) {
    if (!this.ctx) return;
    if (!active || !this.settings.sound || !this.settings.music || this.ctx.state !== 'running') {
      this.nextBeat = this.ctx.currentTime + 0.08;
      return;
    }
    const now = this.ctx.currentTime;
    if (this.nextBeat < now - 0.1) this.nextBeat = now;
    while (this.nextBeat < now + 0.12) {
      const d = this.nextBeat - now;
      const s = this.step++ % 16;
      if (s % 4 === 0) this.tone(135, 0.22, 0.72, 'sine', 35, d, true);
      if (s % 8 === 4) {
        this.noise(0.13, 0.4, 1800, d, true);
        this.tone(180, 0.09, 0.16, 'triangle', null, d, true);
      }
      if (s % 2 === 0) this.noise(0.027, 0.2, 7500, d, true);
      const bass = [65.41, 65.41, 77.78, 58.27][Math.floor(s / 4)];
      if (s % 4 === 0 || s === 7 || s === 14) this.tone(bass, 0.19, 0.23, 'triangle', null, d, true);
      if (s === 3 || s === 11) this.tone(bass * 8, 0.16, 0.06, 'sine', null, d, true);
      this.nextBeat += 60 / 108 / 4;
    }
  }

  apply() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.settings.sound ? 0.48 : 0, this.ctx.currentTime, 0.04);
    this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.17 : 0, this.ctx.currentTime, 0.04);
  }
}
