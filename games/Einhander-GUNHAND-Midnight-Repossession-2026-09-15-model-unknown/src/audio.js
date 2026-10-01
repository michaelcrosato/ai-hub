/* GUNHAND — an original, live-synthesized 126 BPM score and arcade effects.
   Nothing is decoded or downloaded: the AudioContext is created on the first gesture. */

const KICK = new Set([0, 4, 8, 12]);
const BASS = new Set([0, 3, 6, 8, 10, 14]);
const LEAD = new Set([2, 7, 10, 15]);
const SONGS = {
  1: { bpm: 126, kick: 145, bass: [55, 55, 65.406, 55, 49, 49, 73.416, 65.406], lead: [220, 261.63, 329.63, 293.66, 220, 196, 261.63, 164.81] },
  2: { bpm: 132, kick: 132, bass: [49, 49, 58.27, 49, 43.65, 43.65, 65.41, 58.27], lead: [196, 233.08, 293.66, 261.63, 196, 174.61, 233.08, 146.83] },
};

export class Synth {
  constructor() {
    this.ac = null;
    this.master = null;
    this.step = 0;
    this.next = 0;
    this.volume = 0.45;
    this.enabled = true;
    this.lastShot = 0;
    this.noise = null;
    this.held = false;
    this.onFail = null;
    /** Written by the game each frame: is a raid running, its clock, boss on screen, which operation. */
    this.info = { playing: false, t: 0, boss: false, op: 1 };
  }

  /** Create or wake the context. Safe to call from every gesture. */
  init() {
    if (this.ac) {
      if (this.ac.state === 'suspended' && !this.held) this.ac.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('no Web Audio');
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.enabled ? this.volume * 0.62 : 0;
      this.master.connect(this.ac.destination);
      const b = this.ac.createBuffer(1, Math.floor(this.ac.sampleRate * 0.55), this.ac.sampleRate);
      const data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.next = this.ac.currentTime + 0.07;
    } catch {
      this.ac = null;
      this.enabled = false;
      this.onFail?.();
    }
  }

  /** Hold everything while the game is paused by the settings panel (or hidden). */
  hold(on) {
    this.held = !!on;
    if (!this.ac) return;
    if (on) this.ac.suspend().catch(() => {});
    else this.ac.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = !!on;
    this.setVolume(this.volume);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? v * 0.62 : 0, this.ac.currentTime, 0.03);
  }

  now() {
    return this.ac ? this.ac.currentTime : 0;
  }

  tone(f, d, type = 'sine', gain = 0.08, when = 0, endF = 0) {
    if (!this.ac || !this.enabled) return;
    const t = when || this.ac.currentTime;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (endF) o.frequency.exponentialRampToValueAtTime(Math.max(20, endF), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.01);
  }

  hiss(d = 0.1, gain = 0.05, freq = 1300, when = 0) {
    if (!this.ac || !this.enabled) return;
    const t = when || this.ac.currentTime;
    const n = this.ac.createBufferSource();
    const f = this.ac.createBiquadFilter();
    const g = this.ac.createGain();
    n.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + d + 0.01);
  }

  shot() {
    if (!this.ac || this.ac.currentTime - this.lastShot < 0.095) return;
    this.lastShot = this.ac.currentTime;
    this.tone(750, 0.045, 'triangle', 0.022, 0, 260);
  }

  pod(type) {
    if (type === 'LANCE') {
      this.tone(740, 0.15, 'sawtooth', 0.035, 0, 130);
      this.tone(1480, 0.14, 'sine', 0.04, 0, 360);
    } else if (type === 'SWARM') {
      this.hiss(0.16, 0.07, 1000);
      this.tone(170, 0.1, 'square', 0.025, 0, 40);
    } else this.hiss(0.055, 0.06, 1700);
  }

  explosion(big = false) {
    this.hiss(big ? 0.6 : 0.27, big ? 0.32 : 0.17, big ? 700 : 1700);
    this.tone(big ? 76 : 140, big ? 0.55 : 0.23, 'sine', big ? 0.28 : 0.15, 0, 26);
  }

  pickup() {
    const t = this.now();
    this.tone(390, 0.12, 'triangle', 0.1);
    this.tone(586, 0.18, 'triangle', 0.085, t ? t + 0.075 : 0);
    this.tone(780, 0.22, 'sine', 0.09, t ? t + 0.14 : 0);
  }

  damage() {
    this.hiss(0.3, 0.23, 1500);
    this.tone(85, 0.3, 'sawtooth', 0.11, 0, 40);
  }

  emp() {
    this.hiss(0.7, 0.27, 4200);
    this.tone(60, 0.8, 'sine', 0.3, 0, 460);
  }

  /** An auditor drone has you in its sights. */
  lock() {
    const t = this.now();
    this.tone(1240, 0.06, 'square', 0.025);
    this.tone(1240, 0.06, 'square', 0.025, t ? t + 0.12 : 0);
  }

  /** A shot rang off a bailiff's shield. */
  clank() {
    if (!this.ac || this.ac.currentTime - this.lastShot < 0.05) return;
    this.lastShot = this.ac.currentTime;
    this.tone(1900, 0.05, 'square', 0.018, 0, 900);
  }

  shieldBreak() {
    this.hiss(0.35, 0.16, 3000);
    this.tone(320, 0.32, 'sawtooth', 0.06, 0, 70);
  }

  menu() {
    this.tone(520, 0.05, 'triangle', 0.03, 0, 640);
  }

  /** Schedule the score a little ahead of the clock while a raid is running. */
  tick() {
    if (!this.ac || !this.enabled || !this.info.playing || this.held) return;
    const song = SONGS[this.info.op] || SONGS[1];
    const now = this.ac.currentTime;
    if (this.next < now - 0.25) this.next = now + 0.035;
    while (this.next < now + 0.1) {
      this.note(this.step, this.next, song);
      this.next += 60 / song.bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  /** Restart the bar from the top (a new raid). */
  rewind() {
    this.step = 0;
    this.next = this.ac ? this.ac.currentTime + 0.04 : 0;
  }

  note(s, t, song) {
    const k = s % 16;
    if (KICK.has(k)) this.tone(song.kick, 0.17, 'sine', 0.31, t, 39);
    if (k === 4 || k === 12) {
      this.hiss(0.12, 0.075, 4500, t);
      this.tone(160, 0.1, 'triangle', 0.055, t, 90);
    }
    if (k % 2 === 0) this.hiss(k === 14 ? 0.1 : 0.045, 0.027, 9000, t);
    else if (k === 3 || k === 11) this.hiss(0.025, 0.013, 9000, t);
    if (BASS.has(k)) {
      const f = song.bass[Math.floor(s / 8)];
      this.tone(f, 0.15, 'sawtooth', 0.027, t);
      this.tone(f / 2, 0.19, 'sine', 0.08, t);
    }
    if (this.info.t > 9 && LEAD.has(k)) {
      const n = song.lead[Math.floor(s / 2) % 8];
      this.tone(n * (this.info.boss ? 2 : 1), 0.24, 'triangle', 0.022, t);
      this.tone(n * 2, 0.25, 'sine', 0.012, t + 0.13);
    }
  }
}
