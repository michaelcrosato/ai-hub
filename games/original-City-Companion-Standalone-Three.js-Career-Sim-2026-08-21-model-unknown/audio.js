// Soft synthesized UI sounds. Nothing is downloaded; the AudioContext is
// created on the first user gesture (browsers keep audio locked until then)
// and suspended while the game is paused.

import { SOUND_KEY } from './data.js';
import { storageGet, storageSet } from './util.js';

const CUES = {
  // [frequency Hz, start s, length s, wave, gain]
  click: [[660, 0, 0.05, 'triangle', 0.05]],
  open: [[520, 0, 0.07, 'sine', 0.06], [780, 0.05, 0.08, 'sine', 0.05]],
  close: [[600, 0, 0.06, 'sine', 0.05], [420, 0.05, 0.07, 'sine', 0.04]],
  success: [[587, 0, 0.1, 'triangle', 0.07], [880, 0.09, 0.16, 'triangle', 0.07]],
  cash: [[988, 0, 0.07, 'square', 0.035], [1319, 0.06, 0.12, 'square', 0.035], [1760, 0.13, 0.16, 'triangle', 0.04]],
  warning: [[440, 0, 0.12, 'triangle', 0.07], [370, 0.12, 0.16, 'triangle', 0.06]],
  danger: [[330, 0, 0.16, 'sawtooth', 0.045], [247, 0.14, 0.24, 'sawtooth', 0.04]],
  level: [[523, 0, 0.09, 'triangle', 0.06], [659, 0.08, 0.09, 'triangle', 0.06], [784, 0.16, 0.18, 'triangle', 0.07]],
  achievement: [[523, 0, 0.1, 'sine', 0.07], [784, 0.1, 0.1, 'sine', 0.07], [1047, 0.2, 0.3, 'sine', 0.08]],
  day: [[392, 0, 0.18, 'sine', 0.05], [523, 0.16, 0.26, 'sine', 0.05]],
  step: [[180, 0, 0.03, 'sine', 0.02]],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = storageGet(SOUND_KEY) !== 'off';
    this.paused = false;
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
    };
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
  }

  ensure() {
    if (this.ctx || !this.enabled) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = !!on;
    storageSet(SOUND_KEY, this.enabled ? 'on' : 'off');
    if (this.enabled) this.ensure();
    if (this.master) this.master.gain.value = this.enabled ? 0.8 : 0;
  }

  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  play(name) {
    if (!this.enabled || this.paused) return;
    const ctx = this.ensure();
    const cue = CUES[name];
    if (!ctx || !cue || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const [freq, start, length, wave, gain] of cue) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const t0 = now + start;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
      osc.connect(env).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + length + 0.02);
    }
  }
}
