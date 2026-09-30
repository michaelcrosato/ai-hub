// audio.js — a quiet synthesized soundscape: wind that follows speed and height,
// and small chimes for discoveries, cairns and the sky trials. Nothing is
// downloaded; the audio context starts on the first tap, click or key.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.holds = new Set();
    this.paused = false;
    this.windAt = 0;
    const unlock = () => {
      this.start();
      if (this.ctx) {
        removeEventListener('pointerdown', unlock, true);
        removeEventListener('keydown', unlock, true);
      }
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);

      // Wind: two seconds of noise, looped, through a moving band-pass.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
        data[i] = last * 6;
      }
      this.noise = ctx.createBufferSource();
      this.noise.buffer = buffer;
      this.noise.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 420;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
      this.noise.start();
      this.applyMaster();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    this.applyMaster();
  }

  /** Silence for a reason (the kit's menu, a hidden tab, the pause screen) until every reason is gone. */
  hold(reason, on) {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    this.applyMaster();
  }

  applyMaster() {
    if (!this.ctx) return;
    const target = this.enabled && !this.holds.has('kit') && !this.holds.has('hidden') ? 0.8 : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    // The pause screen keeps chimes but lets the wind settle.
    this.paused = this.holds.has('pause');
  }

  /** level 0..1 (loudness), tone 0..1 (pitch of the wind), called every frame. */
  wind(level, tone) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - (this.windAt || 0) < 0.1) return;
    this.windAt = t;
    const l = this.paused ? level * 0.35 : level;
    this.windGain.gain.setTargetAtTime(0.02 + l * 0.2, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(260 + tone * 900, t, 0.3);
  }

  tone(freq, when, dur, gain = 0.15, type = 'sine') {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    osc.connect(g).connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  play(kind, amount = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + 0.01;
    switch (kind) {
      case 'cairn':
        [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.09, 1.3, 0.11));
        break;
      case 'discover':
        this.tone(392, t, 1.6, 0.1, 'triangle');
        this.tone(587.3, t + 0.18, 1.8, 0.09, 'triangle');
        break;
      case 'start':
        this.tone(523.3, t, 0.25, 0.12, 'triangle');
        this.tone(784, t + 0.12, 0.5, 0.12, 'triangle');
        break;
      case 'ring':
        this.tone(700 + amount * 500, t, 0.35, 0.12);
        this.tone((700 + amount * 500) * 1.5, t + 0.04, 0.3, 0.05);
        break;
      case 'miss':
        this.tone(160, t, 0.45, 0.18, 'sawtooth');
        break;
      case 'finish':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.11, 1.4, 0.11, 'triangle'));
        break;
      case 'toggle':
        this.tone(880, t, 0.12, 0.05);
        break;
      case 'land':
        // A soft footfall thump, heavier after a longer drop.
        this.tone(95, t, 0.16, 0.05 + amount * 0.1);
        this.tone(62, t + 0.01, 0.22, 0.04 + amount * 0.08, 'triangle');
        break;
      default:
        break;
    }
  }
}
