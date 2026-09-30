// Pocket Parade: Lantern Tide. A new little tune: plucked chords, a soft bass, and a
// toy-box melody. All sound is synthesized after a user gesture; nothing is recorded or
// downloaded. The game tells the synth when music should play (Sound.shouldPlay).

export const Sound = {
  ctx: null, master: null, muted: false, step: 0, next: 0, noiseBuffer: null, interval: 0, held: false,
  /** Set by the game: true while the music should keep playing. */
  shouldPlay: () => true,

  /** Create (or wake) the audio context. Call from a user gesture. */
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.67;
        this.master.connect(this.ctx.destination);
        const delay = this.ctx.createDelay(0.6), echo = this.ctx.createGain();
        delay.delayTime.value = 0.254;
        echo.gain.value = 0.13;
        this.master.connect(delay);
        delay.connect(echo);
        echo.connect(this.ctx.destination);
        const length = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const a = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) a[i] = Math.random() * 2 - 1;
        this.next = this.ctx.currentTime + 0.08;
        this.interval = setInterval(() => this.schedule(), 30);
      }
      if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
    } catch (_) {
      /* Audio is optional. The market remains playable. */
    }
  },

  /** Hold everything while the kit settings panel is open (the game loop is stopped then). */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  },

  setMuted(m) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.67, this.ctx.currentTime, 0.04);
  },

  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  note(m, t, d = 0.22, g = 0.055, type = 'triangle') {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), e = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(this.freq(m), t);
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(g, t + 0.009);
    e.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(e);
    e.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.02);
    o.onended = () => { o.disconnect(); e.disconnect(); };
  },

  noise(t, d, g, f = 4000) {
    if (!this.ctx || this.muted) return;
    const s = this.ctx.createBufferSource(), e = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    s.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = f;
    e.gain.setValueAtTime(g, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(filter);
    filter.connect(e);
    e.connect(this.master);
    s.start(t, Math.random() * 0.3, d);
    s.stop(t + d + 0.01);
    s.onended = () => { s.disconnect(); filter.disconnect(); e.disconnect(); };
  },

  kick(t) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), e = this.ctx.createGain();
    o.frequency.setValueAtTime(85, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.15);
    e.gain.setValueAtTime(0.08, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(e);
    e.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
    o.onended = () => { o.disconnect(); e.disconnect(); };
  },

  schedule() {
    if (!this.ctx) return;
    if (!this.shouldPlay() || this.muted || document.hidden || this.ctx.state !== 'running') {
      this.next = this.ctx.currentTime + 0.06;
      return;
    }
    const stepDur = 60 / 118 / 2;
    const prog = [[50, 54, 57, 61], [47, 50, 54, 57], [52, 55, 59, 62], [45, 49, 52, 55]];
    const melody = [74, 0, 78, 81, 83, 81, 78, 0, 76, 78, 81, 78, 74, 0, 71, 0, 74, 78, 81, 86, 83, 81, 78, 0, 76, 0, 74, 71, 69, 71, 74, 0, 79, 0, 83, 86, 83, 81, 79, 0, 78, 79, 83, 81, 78, 0, 76, 0, 73, 76, 81, 85, 81, 78, 76, 0, 74, 78, 81, 0, 78, 76, 74, 0];
    let guard = 0;
    while (this.next < this.ctx.currentTime + 0.12 && guard++ < 8) {
      const s = this.step % 64, beat = s % 8, bar = Math.floor(s / 8), chord = prog[Math.floor(bar / 2) % 4];
      const t = this.next + (beat % 2 ? 0.017 : 0);
      if (beat === 0 || beat === 4) this.kick(t);
      this.noise(t, 0.055, beat % 2 ? 0.009 : 0.005, 5000);
      if (beat === 0 || beat === 3 || beat === 4 || beat === 6) this.note(chord[beat === 3 || beat === 6 ? 2 : 0] - 12, t, 0.24, 0.06, 'triangle');
      if (beat === 1 || beat === 4 || beat === 7) for (let k = 0; k < chord.length; k++) this.note(chord[k] + 12, t + k * 0.004, 0.18, 0.011, 'sine');
      if (melody[s]) {
        this.note(melody[s], t, 0.205, 0.034, 'triangle');
        this.note(melody[s] + 12, t, 0.11, 0.006, 'sine');
      }
      this.next += stepDur;
      this.step++;
    }
  },

  pickup(chain) {
    if (!this.ctx || this.muted) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16], m = 72 + scale[Math.min(Math.max(chain, 1) - 1, 7)];
    this.note(m, this.ctx.currentTime, 0.115, 0.052, 'sine');
    this.note(m - 12, this.ctx.currentTime + 0.035, 0.12, 0.026, 'triangle');
  },

  effect(type) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.006;
    if (type === 'bump') { this.note(43, t, 0.11, 0.055, 'triangle'); this.noise(t, 0.06, 0.018, 500); }
    else if (type === 'wish') [76, 79, 84, 88].forEach((n, i) => this.note(n, t + i * 0.09, 0.26, 0.06, 'sine'));
    else if (type === 'grow') [60, 64, 67, 72].forEach((n, i) => this.note(n, t + i * 0.055, 0.16, 0.036, 'triangle'));
    else if (type === 'goal' || type === 'win') {
      [72, 76, 79, 84, 83, 84, 88, 91].forEach((n, i) => this.note(n, t + i * 0.13, 0.31, 0.055, 'triangle'));
      [48, 52, 55, 60].forEach((n) => this.note(n, t, 0.9, 0.025, 'sine'));
    }
    else if (type === 'dragon') {
      [67, 71, 74, 79, 83, 86, 91].forEach((n, i) => this.note(n, t + i * 0.1, 0.34, 0.05, 'triangle'));
      [43, 50, 55].forEach((n, i) => this.note(n, t + i * 0.2, 0.8, 0.04, 'sine'));
      this.noise(t, 0.4, 0.02, 1200);
    }
    else if (type === 'start') [67, 72, 76].forEach((n, i) => this.note(n, t + i * 0.065, 0.2, 0.04, 'triangle'));
    else if (type === 'end') [72, 69, 67, 64].forEach((n, i) => this.note(n, t + i * 0.18, 0.35, 0.043, 'sine'));
    else if (type === 'boost') { this.noise(t, 0.15, 0.023, 1700); [55, 62, 67].forEach((n, i) => this.note(n, t + i * 0.035, 0.1, 0.025, 'sine')); }
    else if (type === 'tick') this.note(84, t, 0.055, 0.027, 'sine');
    else if (type === 'select') this.note(79, t, 0.07, 0.022, 'sine');
    else if (type === 'shutter') { this.noise(t, 0.05, 0.03, 2500); this.noise(t + 0.07, 0.04, 0.02, 3500); }
  },
};
