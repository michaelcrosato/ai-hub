/* Pocket Front — tiny synthesized sound: shots, booms, jingles and a sleepy marching tune.
   Nothing is decoded or downloaded; the context starts on the first tap, click or key. */

export class AudioEngine {
  /** @param {() => boolean} enabled  whether sound is on (the game's setting) */
  constructor(enabled) {
    this.enabled = enabled;
    this.ac = null;
    this.master = null;
    this.noise = null;
    this.lastShot = 0;
    this.beat = 0;
    this.nextBeat = 0;
    this.held = false; // suspended while the game loop is paused
  }

  /** Create or wake the audio context. Safe to call from any user gesture. */
  start() {
    try {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.enabled() ? 0.2 : 0;
        this.master.connect(this.ac.destination);
        this.noise = this.ac.createBuffer(1, Math.floor(this.ac.sampleRate * 0.7), this.ac.sampleRate);
        const a = this.noise.getChannelData(0);
        for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      }
      if (!this.held && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    } catch {
      /* no audio on this device */
    }
  }

  /** Pause or resume all sound (the kit calls this when its loop pauses). */
  hold(on) {
    this.held = on;
    if (!this.ac) return;
    try {
      if (on) this.ac.suspend().catch(() => {});
      else this.ac.resume().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /** Follow the sound setting (call after it changes). */
  applyVolume() {
    if (this.ac && this.master) this.master.gain.setTargetAtTime(this.enabled() ? 0.2 : 0, this.ac.currentTime, 0.08);
  }

  ready() {
    return !!this.ac && this.enabled() && this.ac.state === 'running';
  }

  tone(f, d = 0.13, type = 'sine', vol = 0.25, delay = 0, to = 0) {
    if (!this.ready()) return;
    const a = this.ac, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  burst(d = 0.12, vol = 0.3, freq = 1500) {
    if (!this.ready()) return;
    const a = this.ac, s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    s.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.value = freq;
    const t = a.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + d);
  }

  play(type) {
    if (!this.ready()) return;
    const now = this.ac.currentTime;
    switch (type) {
      case 'shot':
        if (now - this.lastShot < 0.045) return;
        this.lastShot = now;
        this.burst(0.055, 0.11, 2100);
        this.tone(180, 0.05, 'triangle', 0.1, 0, 70);
        break;
      case 'boom':
        this.burst(0.48, 0.55, 570);
        this.tone(100, 0.38, 'sine', 0.55, 0, 31);
        break;
      case 'select':
        this.tone(520, 0.09, 'sine', 0.18);
        break;
      case 'order':
        this.tone(460, 0.1, 'triangle', 0.15);
        this.tone(660, 0.1, 'sine', 0.12, 0.075);
        break;
      case 'capture':
        [523, 659, 784, 1047].forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.22, i * 0.09));
        break;
      case 'down':
        this.tone(270, 0.25, 'triangle', 0.22, 0, 120);
        break;
      case 'heal':
        this.tone(740, 0.25, 'sine', 0.12);
        this.tone(988, 0.24, 'sine', 0.13, 0.1);
        break;
      case 'alert':
        this.tone(340, 0.17, 'square', 0.08);
        this.tone(340, 0.17, 'square', 0.08, 0.26);
        break;
      case 'deny':
        this.tone(220, 0.12, 'triangle', 0.12, 0, 150);
        break;
      case 'win':
        [392, 523, 659, 784, 1047].forEach((n, i) => this.tone(n, 0.45, 'triangle', 0.28, i * 0.14));
        break;
      case 'lose':
        [392, 349, 294, 262].forEach((n, i) => this.tone(n, 0.4, 'triangle', 0.18, i * 0.2));
        break;
    }
  }

  /** A quiet marching loop, stepped by the match clock so it stops when the battle pauses. */
  music(t) {
    if (!this.ready()) return;
    // After a restart the clock jumps back: re-sync instead of waiting for the old beat time.
    if (this.nextBeat - t > 1) this.nextBeat = t;
    if (t < this.nextBeat) return;
    this.nextBeat = t + 0.52;
    const notes = [196, 0, 294, 0, 247, 0, 294, 330, 220, 0, 330, 0, 262, 0, 330, 294];
    const n = notes[this.beat++ % notes.length];
    if (n) this.tone(n, 0.25, 'sine', 0.023);
    if (this.beat % 4 === 0) this.tone(65, 0.09, 'sine', 0.042, 0, 35);
  }
}
