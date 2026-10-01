/**
 * audio.js — Mossbell's sound: the original synth effects plus a small
 * procedural score (meadow, shrine and boss themes). Everything is scheduled
 * on the AudioContext clock, so pausing (ctx.suspend) freezes it cleanly.
 */

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chords are MIDI notes; `arp` indexes into the chord per eighth note (null = rest).
const TRACKS = {
  meadow: {
    bpm: 96,
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    lift: 12, voice: 'triangle', gain: 0.016, len: 1.7,
    bass: [0, 4], bassVoice: 'sine', bassGain: 0.03, bassLen: 3.4,
  },
  shrine: {
    bpm: 70,
    chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
    arp: [0, null, 2, null, 1, null, 2, 1],
    lift: 0, voice: 'triangle', gain: 0.02, len: 2.4,
    bass: [0], bassVoice: 'sine', bassGain: 0.03, bassLen: 7,
  },
  boss: {
    bpm: 128,
    chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52]],
    arp: [0, 0, 2, 0, 1, 0, 2, 1],
    lift: 12, voice: 'square', gain: 0.008, len: 0.9,
    bass: [0, 2, 4, 6], bassVoice: 'triangle', bassGain: 0.03, bassLen: 1.5,
  },
};

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.held = false;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
  }

  /** Create or resume the context. Call from user gestures (and freely elsewhere). */
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      try {
        this.ctx = new C();
      } catch {
        this.ctx = null;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      this.applyLevels();
    }
    if (!this.held && this.ctx.state !== 'running') this.ctx.resume?.().catch(() => {});
  }

  /** Freeze all sound (pause menus, the kit settings panel, hidden tab). */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    if (this.held) this.ctx.suspend?.().catch(() => {});
    else this.ctx.resume?.().catch(() => {});
  }

  applyLevels() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.music.gain.value = this.musicOn ? 1 : 0;
  }

  get live() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  tone(freq = 440, dur = 0.09, type = 'triangle', gain = 0.045, slide = 1, delay = 0) {
    if (!this.live || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  chord(notes = [392, 494, 587], gap = 0.055, delay = 0) {
    notes.forEach((n, i) => this.tone(n, 0.15, 'triangle', 0.035, 1.02, delay + i * gap));
  }

  /** A struck bell: a fundamental and a bright inharmonic partial with a long tail. */
  bell(freq) {
    if (!this.live || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [mul, gain, dur] of [[1, 0.06, 1.4], [2.76, 0.018, 0.7], [5.4, 0.008, 0.35]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mul, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
  }

  /** A metallic clang for blades turned aside by a shell. */
  clang() {
    this.tone(1180, 0.06, 'square', 0.018, 0.92);
    this.tone(1760, 0.12, 'triangle', 0.02, 0.97, 0.01);
  }

  setTrack(name) {
    const next = name && TRACKS[name] ? name : null;
    if (next === this.track) return;
    this.track = next;
    this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.12;
  }

  /** Schedule the score a little ahead of the clock. Call once per frame. */
  update() {
    if (!this.live || !this.track) return;
    const ctx = this.ctx;
    // Fell behind (tab in the background, a long pause): pick the beat up again from now.
    if (this.nextTime < ctx.currentTime - 0.05) this.nextTime = ctx.currentTime + 0.05;
    if (!this.musicOn) {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    const T = TRACKS[this.track];
    const stepDur = 60 / T.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.22) {
      this.#playStep(T, this.step, this.nextTime, stepDur);
      this.step += 1;
      this.nextTime += stepDur;
    }
  }

  #playStep(T, step, when, stepDur) {
    const chord = T.chords[Math.floor(step / 8) % T.chords.length];
    const i = step % 8;
    const idx = T.arp[i];
    if (idx != null) this.#note(midi(chord[idx] + T.lift), when, stepDur * T.len, T.voice, T.gain);
    if (T.bass.includes(i)) this.#note(midi(chord[0] - 12), when, stepDur * T.bassLen, T.bassVoice, T.bassGain);
  }

  #note(freq, when, dur, type, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.03);
  }
}
