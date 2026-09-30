/*
 * audio.js — the original score and effects, generated live with Web Audio.
 * There are no audio samples. The context starts on the first click, tap or key,
 * and suspends while the game is paused by the settings panel or hidden.
 */
import { clamp } from './engine.js';

export class SagaAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.58;
    this.nextBeat = 0;
    this.step = 0;
    this.combat = false;
    this.lastSfx = {};
    this.nodes = 0;
    this.hold = false;
    this.hidden = false;
  }

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = (this.ctx = new AC());
        this.master = c.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -17;
        comp.knee.value = 16;
        comp.ratio.value = 4;
        this.master.connect(comp);
        comp.connect(c.destination);
        this.music = c.createGain();
        this.music.gain.value = 0.43;
        this.music.connect(this.master);
        this.fx = c.createGain();
        this.fx.gain.value = 0.66;
        this.fx.connect(this.master);
        const rv = c.createConvolver();
        const buf = c.createBuffer(2, c.sampleRate * 2.3, c.sampleRate);
        for (let k = 0; k < 2; k++) {
          const a = buf.getChannelData(k);
          for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3.2) * 0.45;
        }
        rv.buffer = buf;
        this.reverb = c.createGain();
        this.reverb.gain.value = 0.24;
        this.reverb.connect(rv);
        rv.connect(this.master);
        const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
        const a = nb.getChannelData(0);
        let last = 0;
        for (let i = 0; i < a.length; i++) {
          last = (last + 0.028 * (Math.random() * 2 - 1)) / 1.028;
          a[i] = last * 3.7;
        }
        this.noiseBuffer = nb;
        const wind = c.createBufferSource();
        wind.buffer = nb;
        wind.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        this.wind = c.createGain();
        this.wind.gain.value = 0.09;
        wind.connect(filter);
        filter.connect(this.wind);
        this.wind.connect(this.master);
        wind.start();
        this.nextBeat = c.currentTime + 0.07;
      }
      this.apply();
    } catch (e) {
      console.warn('Audio is unavailable:', e.message);
    }
  }

  /** Suspend while the game is paused (settings panel) or the tab is hidden. */
  setHold(on) {
    this.hold = !!on;
    this.apply();
  }
  setHidden(on) {
    this.hidden = !!on;
    this.apply();
  }
  apply() {
    const c = this.ctx;
    if (!c) return;
    const want = !this.hold && !this.hidden;
    if (want && c.state === 'suspended') c.resume().catch(() => {});
    else if (!want && c.state === 'running') c.suspend().catch(() => {});
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.ctx) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.04);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.setVolume(this.volume);
    if (this.enabled) this.init();
    return this.enabled;
  }

  tone(freq, dur, vol = 0.1, type = 'sine', when = null, end = null, bus = null) {
    const c = this.ctx;
    if (!c) return;
    const t = when ?? c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur * 0.9);
    f.type = 'lowpass';
    f.frequency.value = type === 'sine' ? 3400 : 1900;
    g.gain.setValueAtTime(0.00001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00002, vol), t + Math.min(0.025, dur * 0.1));
    g.gain.exponentialRampToValueAtTime(0.00001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(bus || this.fx);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.nodes++;
    o.onended = () => {
      o.disconnect();
      f.disconnect();
      g.disconnect();
      this.nodes--;
    };
  }

  noise(dur, vol, freq = 1500, when = null) {
    const c = this.ctx;
    if (!c) return;
    const t = when ?? c.currentTime;
    const s = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = this.noiseBuffer;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 0.3), t + dur);
    f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.fx);
    g.connect(this.reverb);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  flute(note, when, dur = 1.4, vol = 0.105) {
    if (!this.ctx) return;
    const f = 440 * Math.pow(2, (note - 69) / 12);
    this.tone(f, dur, vol, 'sine', when, null, this.music);
    this.tone(f * 2, dur * 0.8, vol * 0.18, 'triangle', when + 0.012, null, this.music);
    this.tone(f * 0.997, dur, vol * 0.15, 'sine', when, null, this.music);
  }

  pad(notes, when, dur = 6) {
    for (const n of notes) {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      this.tone(f, dur, 0.055, 'sine', when, null, this.music);
      this.tone(f * 1.006, dur, 0.024, 'triangle', when + 0.08, null, this.music);
    }
  }

  /** Schedule the score a little ahead of time. Nothing is scheduled while sound is off. */
  update(combat, speed = 0, paused = false) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
    const c = this.ctx;
    if (combat !== this.combat) {
      this.combat = combat;
      this.nextBeat = c.currentTime + 0.08;
      this.step = 0;
    }
    this.wind.gain.setTargetAtTime(paused ? 0.035 : 0.055 + speed * 0.0012, c.currentTime, 0.6);
    this.music.gain.setTargetAtTime(paused ? 0.22 : 0.43, c.currentTime, 0.4);
    const interval = combat ? 0.34 : 0.57;
    if (this.nextBeat < c.currentTime - 0.5) this.nextBeat = c.currentTime + 0.03;
    let loops = 0;
    while (this.nextBeat < c.currentTime + 0.14 && loops++ < 4) {
      const st = this.step++;
      const t = this.nextBeat;
      this.nextBeat += interval;
      if (st % 16 === 0) {
        const chords = [[38, 50, 57, 65], [41, 53, 60, 67], [36, 48, 55, 62], [43, 50, 58, 65]];
        this.pad(chords[Math.floor(st / 16) % 4], t, interval * 17);
      }
      const melody = [62, null, 69, 65, null, 64, 57, null, 60, null, 65, 67, 64, null, 62, null, 53, null, 62, 60, null, 57, 65, null, 69, 67, null, 64, 60, null, 57, null];
      const n = melody[st % melody.length];
      if (n !== null && (!paused || st % 2 === 0)) this.flute(n, t, interval * (combat ? 2.2 : 3.7), combat ? 0.075 : 0.12);
      if (st % 4 === 0) {
        this.tone(combat ? 125 : 145, 0.36, 0.17, 'sine', t, 48, this.music);
        this.noise(0.14, 0.13, 420, t);
      }
      if (st % 4 === 2) {
        this.tone(210, 0.16, 0.07, 'sine', t, 96, this.music);
        this.noise(0.085, 0.08, 1900, t);
      }
      if (combat) {
        if (st % 2 === 1) this.noise(0.055, 0.06, 4200, t);
        if (st % 2 === 0) this.tone([73.42, 73.42, 87.31, 65.41][Math.floor(st / 8) % 4], 0.23, 0.12, 'triangle', t, null, this.music);
      }
    }
  }

  sfx(name) {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const now = c.currentTime;
    if (now - (this.lastSfx[name] || -10) < (name === 'deny' ? 0.25 : 0.055)) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'ui':
        this.tone(730, 0.095, 0.055, 'sine');
        break;
      case 'deny':
        this.tone(120, 0.15, 0.12, 'triangle');
        break;
      case 'lock':
        this.tone(1450, 0.075, 0.09, 'sine');
        this.tone(2100, 0.09, 0.05, 'sine', now + 0.045);
        break;
      case 'gauge':
        this.tone(587, 0.22, 0.075);
        this.tone(880, 0.3, 0.05, 'sine', now + 0.08);
        break;
      case 'gun':
        this.noise(0.14, 0.7, 3300);
        this.tone(320, 0.12, 0.24, 'triangle', null, 65);
        break;
      case 'laser':
        this.tone(660, 0.48, 0.15, 'sawtooth', null, 1550);
        this.tone(1850, 0.42, 0.08, 'sine', now + 0.045, 440);
        this.noise(0.3, 0.22, 2600);
        break;
      case 'move':
      case 'evade':
        this.noise(0.5, 0.35, 1800);
        this.tone(170, 0.32, 0.06, 'sine', null, 290);
        break;
      case 'hurt':
        this.noise(0.4, 0.7, 1300);
        this.tone(130, 0.4, 0.25, 'sawtooth', null, 45);
        break;
      case 'break':
        this.noise(0.48, 0.6, 2500);
        this.tone(250, 0.28, 0.17, 'triangle', null, 65);
        break;
      case 'heal':
      case 'seal':
        for (let i = 0; i < 5; i++) this.tone([293.66, 440, 587.33, 659.26, 880][i], 1.0, 0.105, 'sine', now + i * 0.13);
        break;
      case 'storm':
        this.noise(1.5, 0.75, 1200);
        for (let i = 0; i < 5; i++) this.tone(110 + i * 55, 1.5, 0.13, 'sawtooth', now + i * 0.07, 55);
        break;
      case 'warn':
        this.tone(196, 0.35, 0.15, 'triangle');
        this.tone(207.65, 0.5, 0.075, 'sine', now + 0.04);
        break;
      case 'roar':
        this.noise(1.9, 0.85, 320);
        this.tone(100, 1.5, 0.25, 'sawtooth', null, 42);
        this.tone(104, 1.5, 0.16, 'triangle', null, 44);
        break;
      case 'win':
        [62, 65, 69, 74].forEach((n, i) => this.flute(n, now + i * 0.2, 2.6, 0.16));
        break;
      case 'ring':
        this.tone(1174.66, 0.16, 0.08, 'sine');
        this.tone(1567.98, 0.3, 0.06, 'sine', now + 0.06);
        this.noise(0.25, 0.12, 3200);
        break;
      case 'dive':
        this.noise(1.3, 0.7, 520);
        this.tone(88, 1.1, 0.22, 'sawtooth', null, 38);
        break;
      case 'glass':
        for (let i = 0; i < 4; i++) this.tone(1760 + i * 310, 0.5, 0.05, 'triangle', now + i * 0.05, 900);
        this.noise(0.6, 0.3, 4600);
        break;
      default:
        break;
    }
  }
}
