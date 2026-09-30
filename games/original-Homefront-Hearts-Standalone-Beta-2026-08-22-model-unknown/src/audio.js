/**
 * audio.js — small synthesised sounds for the household (no files to load):
 * a soft marimba tap when a priority goes into the week, a chime when the
 * week is lived, a bell for life's interruptions, a warm chord for a new era.
 *
 * The AudioContext is created on the first key press, click or tap (browsers
 * only allow sound after a gesture), suspends while the game is paused or
 * hidden, and the player can switch sound off in the menu.
 */

import { soundPreference, setSoundPreference } from './storage.js';

const NOTE = { C4: 261.63, E4: 329.63, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1567.98 };

export class Sfx {
  constructor() {
    this.enabled = soundPreference();
    this.ctx = null;
    this.master = null;
    this.paused = false;
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { capture: true, passive: true });
    addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => this.#apply());
  }

  /** Create or resume the context from inside a user gesture. */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.2;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return;
      }
    }
    this.#apply();
  }

  #apply() {
    const ctx = this.ctx;
    if (!ctx) return;
    const run = this.enabled && !this.paused && document.visibilityState !== 'hidden';
    if (run && ctx.state === 'suspended') ctx.resume().catch(() => {});
    else if (!run && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = !!on;
    setSoundPreference(this.enabled);
    if (this.enabled) this.unlock();
    this.#apply();
  }

  /** The kit loop paused (settings panel) or resumed. */
  setPaused(paused) {
    this.paused = !!paused;
    this.#apply();
  }

  #tone(freq, at, dur, { type = 'sine', gain = 0.2, attack = 0.006, slide = 0 } = {}) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** A soft two-partial "wooden" note. */
  #mallet(freq, at, dur = 0.32, gain = 0.2) {
    this.#tone(freq, at, dur, { type: 'triangle', gain });
    this.#tone(freq * 4, at, dur * 0.35, { type: 'sine', gain: gain * 0.18 });
  }

  #bell(freq, at, dur = 0.9, gain = 0.16) {
    this.#tone(freq, at, dur, { type: 'sine', gain });
    this.#tone(freq * 2.01, at, dur * 0.6, { type: 'sine', gain: gain * 0.35 });
    this.#tone(freq * 3.02, at, dur * 0.3, { type: 'sine', gain: gain * 0.12 });
  }

  play(name) {
    if (!this.enabled || this.paused) return;
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    switch (name) {
      case 'add':
        this.#mallet(NOTE.E5, 0, 0.26, 0.2);
        this.#mallet(NOTE.A5, 0.06, 0.3, 0.14);
        break;
      case 'remove':
        this.#tone(NOTE.C5, 0, 0.2, { type: 'triangle', gain: 0.14, slide: NOTE.G4 });
        break;
      case 'deny':
        this.#tone(NOTE.A4 / 2, 0, 0.12, { type: 'square', gain: 0.035 });
        this.#tone((NOTE.A4 / 2) * 0.94, 0.09, 0.16, { type: 'square', gain: 0.035 });
        break;
      case 'week':
        [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => this.#mallet(f, i * 0.09, 0.42, 0.17));
        break;
      case 'choice':
        this.#bell(NOTE.G5, 0, 0.8, 0.12);
        this.#bell(NOTE.C6, 0.07, 0.7, 0.07);
        break;
      case 'event':
        this.#bell(NOTE.E5, 0, 0.9, 0.1);
        break;
      case 'milestone':
        [NOTE.C4, NOTE.E4, NOTE.G4].forEach((f) => this.#tone(f, 0, 1.5, { type: 'sine', gain: 0.07, attack: 0.08 }));
        [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.B5].forEach((f, i) => this.#mallet(f, 0.18 + i * 0.16, 0.5, 0.13));
        break;
      case 'buy':
        this.#bell(NOTE.E6, 0, 0.35, 0.09);
        this.#bell(NOTE.G6, 0.08, 0.45, 0.08);
        break;
      case 'project':
        [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => this.#mallet(f, i * 0.1, 0.45, 0.16));
        [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => this.#tone(f, 0.42, 1.1, { type: 'sine', gain: 0.05, attack: 0.05 }));
        break;
      case 'finale': {
        const tune = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6, NOTE.E6];
        tune.forEach((f, i) => this.#mallet(f, i * 0.17, i === tune.length - 1 ? 1.2 : 0.4, 0.15));
        [NOTE.C4, NOTE.G4, NOTE.E5].forEach((f) => this.#tone(f, 1.02, 1.8, { type: 'sine', gain: 0.05, attack: 0.1 }));
        break;
      }
      case 'start':
        [NOTE.G4, NOTE.C5, NOTE.E5].forEach((f, i) => this.#mallet(f, i * 0.12, 0.5, 0.15));
        break;
      case 'open':
        this.#tone(NOTE.C6, 0, 0.07, { type: 'sine', gain: 0.05 });
        break;
      case 'close':
        this.#tone(NOTE.G5, 0, 0.07, { type: 'sine', gain: 0.04 });
        break;
      default:
        break;
    }
  }
}
