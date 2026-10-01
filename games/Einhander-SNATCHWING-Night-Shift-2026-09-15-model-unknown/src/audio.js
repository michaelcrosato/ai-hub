// Procedural night-flight score and synthesized effects (Web Audio, no files).
// The context starts on the first key, click or tap, so the browser never blocks it.

import { readSave, save } from './util.js';

/** One song per route: tempo, bass roots per two bars, and the arpeggio in semitones. */
const SONGS = [
  { bpm: 132, bass: [55, 55, 65.4, 49], notes: [0, 7, 12, 10, 0, 7, 15, 12] }, // the lower city
  { bpm: 126, bass: [49, 49, 58.27, 43.65], notes: [0, 3, 7, 10, 12, 10, 7, 5] }, // the harbor line
];

export const audio = {
  ctx: null,
  enabled: readSave('sound', true),
  step: 0,
  next: 0,
  song: 0,
  onToggle: null,
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.52 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.34;
      this.music.connect(this.master);
      this.effects = this.ctx.createGain();
      this.effects.gain.value = 0.6;
      this.effects.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.next = this.ctx.currentTime + 0.06;
    } catch {
      this.ctx = null;
    }
  },
  /** Hold the clock while the game (or the settings panel) is paused. */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  },
  tone(freq, end, dur, type, vol, when, bus) {
    if (!this.ctx) return;
    const a = this.ctx;
    const o = a.createOscillator();
    const g = a.createGain();
    const t = when ?? a.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.effects);
    o.start(t);
    o.stop(t + dur + 0.025);
  },
  hiss(dur, vol, freq = 1500, when, bus) {
    if (!this.ctx) return;
    const a = this.ctx;
    const s = a.createBufferSource();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    const t = when ?? a.currentTime;
    s.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus || this.effects);
    s.start(t);
    s.stop(t + dur + 0.01);
  },
  sfx(name) {
    if (!this.ctx || !this.enabled || this.held) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'fire': this.tone(1000, 220, 0.055, 'sawtooth', 0.035); break;
      case 'rail': this.tone(1600, 90, 0.2, 'sawtooth', 0.11); break;
      case 'missile': this.hiss(0.17, 0.075, 600); break;
      case 'scatter': this.hiss(0.09, 0.12, 1800); this.tone(620, 180, 0.07, 'square', 0.05); break;
      case 'explode': this.hiss(0.25, 0.2, 260); this.tone(95, 25, 0.28, 'triangle', 0.24); break;
      case 'pop': this.hiss(0.12, 0.1, 700); this.tone(220, 60, 0.12, 'triangle', 0.09); break;
      case 'hit': this.hiss(0.17, 0.17, 350); this.tone(150, 38, 0.25, 'sawtooth', 0.17); break;
      case 'grab': for (let i = 0; i < 4; i++) this.tone(280 * 2 ** (i / 4), 500 * 2 ** (i / 4), 0.13, 'triangle', 0.18, t + i * 0.075); break;
      case 'flip': this.tone(160, 380, 0.09, 'square', 0.07); break;
      case 'pulse': this.tone(50, 500, 0.45, 'sawtooth', 0.19); this.hiss(0.8, 0.25, 900); break;
      case 'warning': this.tone(330, 310, 0.3, 'square', 0.13); this.tone(230, 210, 0.3, 'square', 0.13, t + 0.4); break;
      case 'lance': this.tone(880, 120, 0.32, 'sawtooth', 0.12); this.hiss(0.3, 0.08, 2400); break;
      case 'lock': this.tone(1320, 1320, 0.05, 'square', 0.05); this.tone(1320, 1320, 0.05, 'square', 0.05, t + 0.12); break;
      case 'beep': this.tone(1760, 1700, 0.06, 'square', 0.06); break;
      case 'burst': this.hiss(0.22, 0.16, 500); this.tone(300, 70, 0.2, 'square', 0.1); break;
      case 'tick': this.tone(1400, 1250, 0.03, 'square', 0.025); break;
      case 'select': this.tone(700, 1100, 0.08, 'triangle', 0.08); break;
      case 'win': for (let i = 0; i < 5; i++) { const f = [262, 330, 392, 523, 659][i]; this.tone(f, f, 0.6, 'triangle', 0.18, t + i * 0.15); } break;
      case 'lose': for (let i = 0; i < 3; i++) { const f = [392, 330, 247][i]; this.tone(f, f * 0.98, 0.5, 'triangle', 0.14, t + i * 0.2); } break;
    }
  },
  /** Schedule the music a little ahead of the clock; `active` false keeps it silent. */
  update(active) {
    if (!this.ctx) return;
    if (!active || this.held) {
      this.next = this.ctx.currentTime + 0.08;
      return;
    }
    const a = this.ctx;
    const song = SONGS[this.song] || SONGS[0];
    let guard = 0;
    while (this.next < a.currentTime + 0.14 && guard++ < 8) {
      const t = Math.max(this.next, a.currentTime);
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const bass = song.bass[Math.floor(bar / 2) % 4];
      if (s % 4 === 0) this.tone(125, 35, 0.2, 'sine', 0.65, t, this.music);
      if (s === 4 || s === 12) {
        this.hiss(0.12, 0.2, 950, t, this.music);
        this.tone(160, 80, 0.11, 'triangle', 0.22, t, this.music);
      }
      if (s % 2 === 0) this.hiss(0.043, s % 4 === 2 ? 0.13 : 0.06, 6700, t, this.music);
      if (s % 2 === 0) this.tone(bass * (s === 10 ? 2 : 1), bass, 0.14, 'sawtooth', 0.13, t, this.music);
      if (s % 2 === 1) {
        const hz = bass * 4 * 2 ** (song.notes[(s >> 1) % 8] / 12);
        this.tone(hz, hz * 0.999, 0.23, 'triangle', 0.095, t, this.music);
        this.tone(hz, hz, 0.23, 'sine', 0.035, t + 0.18, this.music);
      }
      this.step++;
      this.next += 60 / song.bpm / 4;
    }
  },
  toggle() {
    this.enabled = !this.enabled;
    save('sound', this.enabled);
    if (this.ctx) this.master.gain.setTargetAtTime(this.enabled ? 0.52 : 0, this.ctx.currentTime, 0.08);
    this.onToggle?.();
  },
};
