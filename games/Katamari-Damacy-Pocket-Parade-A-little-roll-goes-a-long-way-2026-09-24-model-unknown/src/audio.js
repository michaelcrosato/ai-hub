// Pocket Parade. A little tune: plucked chords, a soft bass and a toy-box melody, plus
// every sound effect. All sound is synthesized after a user gesture; nothing is recorded.

/**
 * @param {object} o
 * @param {() => boolean} o.musicOn  whether the tune should be playing right now
 */
export function createAudio({ musicOn }) {
  const A = {
    ctx: null, master: null, muted: false, held: false, step: 0, next: 0, noiseBuffer: null, interval: 0,
    /** Semitones added to the whole tune (the encore plays a little brighter). */
    transpose: 0,

    init() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.67;
          this.master.connect(this.ctx.destination);
          const length = this.ctx.sampleRate;
          this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
          const a = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < length; i++) a[i] = Math.random() * 2 - 1;
          this.next = this.ctx.currentTime + 0.08;
          this.interval = setInterval(() => this.schedule(), 30);
        }
        if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
      } catch {
        /* Audio is optional. The room remains playable. */
      }
    },

    /** Hold everything while the kit's settings panel is open, then carry on. */
    hold(on) {
      this.held = on;
      if (!this.ctx) return;
      if (on) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
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
      if (!musicOn() || this.muted || this.held || document.hidden) {
        this.next = this.ctx.currentTime + 0.06;
        return;
      }
      const stepDur = 60 / 112 / 2, k = this.transpose;
      const prog = [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]];
      const melody = [72, 0, 76, 79, 76, 74, 72, 0, 67, 72, 74, 76, 0, 74, 72, 0, 72, 76, 79, 81, 79, 76, 74, 0, 72, 0, 69, 72, 74, 76, 72, 0, 77, 0, 76, 74, 77, 81, 79, 0, 77, 76, 74, 72, 69, 72, 74, 0, 71, 74, 77, 79, 77, 74, 71, 0, 74, 76, 79, 0, 77, 74, 72, 0];
      let guard = 0;
      while (this.next < this.ctx.currentTime + 0.12 && guard++ < 8) {
        const s = this.step % 64, beat = s % 8, bar = Math.floor(s / 8), chord = prog[Math.floor(bar / 2) % 4], t = this.next + (beat % 2 ? 0.017 : 0);
        if (beat === 0 || beat === 4) this.kick(t);
        this.noise(t, 0.055, beat % 2 ? 0.009 : 0.005, 5000);
        if (beat === 0 || beat === 3 || beat === 4 || beat === 6) this.note(chord[beat === 3 || beat === 6 ? 2 : 0] - 12 + k, t, 0.24, 0.060, 'triangle');
        if (beat === 1 || beat === 4 || beat === 7) for (let i = 0; i < chord.length; i++) this.note(chord[i] + 12 + k, t + i * 0.004, 0.18, 0.011, 'sine');
        if (melody[s]) {
          this.note(melody[s] + k, t, 0.205, 0.034, 'triangle');
          this.note(melody[s] + 12 + k, t, 0.11, 0.006, 'sine');
        }
        this.next += stepDur;
        this.step++;
      }
    },

    pickup(chain) {
      if (!this.ctx || this.muted) return;
      const scale = [0, 2, 4, 7, 9, 12, 14, 16], m = 72 + scale[Math.min(chain - 1, 7)];
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
      else if (type === 'start') [67, 72, 76].forEach((n, i) => this.note(n, t + i * 0.065, 0.2, 0.04, 'triangle'));
      else if (type === 'end') [72, 69, 67, 64].forEach((n, i) => this.note(n, t + i * 0.18, 0.35, 0.043, 'sine'));
      else if (type === 'boost') { this.noise(t, 0.15, 0.023, 1700); [55, 62, 67].forEach((n, i) => this.note(n, t + i * 0.035, 0.1, 0.025, 'sine')); }
      else if (type === 'tick') this.note(84, t, 0.055, 0.027, 'sine');
      else if (type === 'knock') { this.note(50, t, 0.14, 0.05, 'triangle'); this.note(45, t + 0.07, 0.18, 0.045, 'triangle'); this.noise(t, 0.09, 0.02, 700); }
      else if (type === 'big') [64, 69, 76].forEach((n, i) => this.note(n, t + i * 0.05, 0.18, 0.04, 'sine'));
    },
  };
  return A;
}
