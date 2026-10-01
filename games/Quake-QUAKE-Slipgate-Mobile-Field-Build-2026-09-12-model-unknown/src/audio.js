// Synthesized effects and a low ambient bed. No audio files, no network requests.
// The context is created on the first real gesture (unlock), suspended while the game is paused
// by the shared settings panel or a hidden tab, and every sound goes through one master gain.

const BASE = 0.35;

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.noise = null;
    this.enabled = true;
    this.volume = 0.8;
    this.held = false; // suspended on purpose (settings panel, hidden tab)
    this.amb = null;
    this.ambOn = false;
  }

  /** Create or wake the context. Call from a pointer, key or touch gesture. */
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = (this.context = new AC());
        this.master = c.createGain();
        this.master.gain.value = BASE * this.volume;
        this.master.connect(c.destination);
        this.noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.7), c.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state !== 'running' && !this.held) this.context.resume().catch(() => {});
      if (this.ambOn && !this.amb) this.ambience(true);
    } catch {
      this.context = null;
    }
  }

  start() {
    this.unlock();
  }

  get ready() {
    return !!this.context && this.enabled && this.context.state === 'running';
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? BASE * this.volume : 0, this.context.currentTime, 0.02);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.enabled) this.unlock();
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? BASE * this.volume : 0, this.context.currentTime, 0.02);
  }

  /** Hold the whole context (settings panel open, tab hidden) and let it go again. */
  hold(on) {
    this.held = !!on;
    if (!this.context) return;
    try {
      if (on) this.context.suspend().catch(() => {});
      else if (this.enabled) this.context.resume().catch(() => {});
    } catch {
      /* closed context */
    }
  }

  /** The vault's hum: filtered noise and a slow sub tone, faded in while playing. */
  ambience(on) {
    this.ambOn = !!on;
    if (!this.context) return;
    const c = this.context;
    if (!this.amb) {
      if (!on) return;
      const len = Math.floor(c.sampleRate * 4);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // Brown noise: integrated white noise, so the loop has no audible hiss.
        last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
        d[i] = last * 3.5;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const sub = c.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 43;
      const subGain = c.createGain();
      subGain.gain.value = 0.35;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(lp).connect(gain);
      sub.connect(subGain).connect(gain);
      gain.connect(this.master);
      src.start();
      sub.start();
      this.amb = { gain };
    }
    this.amb.gain.gain.setTargetAtTime(on ? 0.3 : 0, c.currentTime, on ? 0.6 : 0.25);
  }

  tone(frequency, duration = 0.15, type = 'sine', volume = 0.3, end = frequency, delay = 0) {
    if (!this.ready) return;
    const c = this.context;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  burst(duration = 0.18, frequency = 1000, volume = 0.5, delay = 0, end = 90) {
    if (!this.ready || !this.noise) return;
    const c = this.context;
    const t = c.currentTime + delay;
    const source = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    source.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(frequency, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(f).connect(g).connect(this.master);
    // A random start inside the buffer keeps repeated shots from sounding identical.
    source.start(t, Math.random() * Math.max(0, this.noise.duration - duration - 0.03));
    source.stop(t + duration + 0.02);
  }

  play(name) {
    if (!this.ready) return;
    switch (name) {
      case 'shotgun':
        this.burst(0.26, 3500, 0.9);
        this.tone(105, 0.19, 'sawtooth', 0.35, 28);
        break;
      case 'nailgun':
        this.burst(0.08, 6500, 0.38);
        this.tone(220, 0.06, 'square', 0.14, 60);
        break;
      case 'launcher':
        this.burst(0.32, 1000, 0.8);
        this.tone(75, 0.28, 'sawtooth', 0.3, 20);
        break;
      case 'explode':
        this.burst(0.6, 1700, 1);
        this.tone(65, 0.45, 'sine', 0.6, 22);
        break;
      case 'pickup':
        this.tone(520, 0.1, 'sine', 0.25, 840);
        this.tone(1040, 0.18, 'sine', 0.16, 1400, 0.075);
        break;
      case 'secret':
        this.tone(660, 0.12, 'triangle', 0.22, 660);
        this.tone(880, 0.12, 'triangle', 0.2, 880, 0.11);
        this.tone(1320, 0.3, 'triangle', 0.18, 1320, 0.22);
        break;
      case 'hurt':
        this.burst(0.11, 350, 0.4);
        this.tone(80, 0.16, 'triangle', 0.2, 40);
        break;
      case 'hit':
        this.tone(220, 0.06, 'triangle', 0.12, 90);
        break;
      case 'kill':
        this.tone(160, 0.22, 'sawtooth', 0.16, 48);
        this.burst(0.18, 900, 0.32);
        break;
      case 'dieBig':
        this.burst(0.45, 700, 0.7);
        this.tone(70, 0.55, 'sawtooth', 0.3, 22);
        break;
      case 'dieWraith':
        this.tone(900, 0.5, 'sine', 0.16, 110);
        this.tone(1300, 0.4, 'triangle', 0.09, 180, 0.06);
        break;
      case 'die':
        this.burst(0.5, 600, 0.6);
        this.tone(110, 0.9, 'sawtooth', 0.28, 30);
        break;
      case 'jump':
        this.tone(95, 0.12, 'triangle', 0.08, 170);
        break;
      case 'land':
        this.burst(0.07, 320, 0.28);
        break;
      case 'dash':
        this.burst(0.24, 4200, 0.32, 0, 300);
        break;
      case 'step':
        this.burst(0.035, 350, 0.08);
        break;
      case 'swap':
        this.burst(0.04, 2600, 0.2);
        this.tone(180, 0.07, 'triangle', 0.1, 120, 0.03);
        break;
      case 'empty':
        this.tone(900, 0.03, 'square', 0.07, 700);
        break;
      case 'gate':
        this.tone(120, 0.6, 'sine', 0.28, 320);
        this.tone(240, 0.5, 'sine', 0.2, 640, 0.17);
        break;
      case 'open':
        this.tone(220, 1.1, 'sine', 0.24, 440);
        this.tone(330, 1.0, 'sine', 0.18, 660, 0.14);
        this.tone(440, 0.9, 'triangle', 0.12, 880, 0.28);
        break;
      case 'win':
        this.tone(392, 0.18, 'triangle', 0.2, 392);
        this.tone(523, 0.18, 'triangle', 0.2, 523, 0.15);
        this.tone(659, 0.18, 'triangle', 0.2, 659, 0.3);
        this.tone(784, 0.6, 'triangle', 0.22, 784, 0.45);
        break;
      case 'cast':
        this.burst(0.25, 1400, 0.22);
        this.tone(220, 0.25, 'sawtooth', 0.08, 520);
        break;
      case 'shriek':
        this.tone(1400, 0.28, 'sawtooth', 0.05, 700);
        this.tone(1750, 0.22, 'sine', 0.07, 900, 0.03);
        break;
      case 'zap':
        this.burst(0.12, 5000, 0.28);
        this.tone(1200, 0.12, 'square', 0.06, 300);
        break;
      case 'claw':
        this.burst(0.09, 2200, 0.32);
        break;
      case 'smash':
        this.burst(0.2, 500, 0.6);
        this.tone(60, 0.25, 'sine', 0.4, 30);
        break;
      case 'sizzle':
        this.burst(0.25, 8000, 0.12, 0, 2000);
        break;
      case 'ui':
        this.tone(740, 0.04, 'triangle', 0.05, 760);
        break;
      default:
        break;
    }
  }
}
