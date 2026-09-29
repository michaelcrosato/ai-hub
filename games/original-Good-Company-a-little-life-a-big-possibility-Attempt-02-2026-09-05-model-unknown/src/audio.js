/* Soft, synthesized interface sounds. Nothing to download: the audio context starts on the
   player's first gesture and every cue is a few short sine/triangle notes. */

const NOTES = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E4: 329.63, G4: 392, A4: 440, C4: 261.63 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.paused = false;
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { capture: true, passive: true });
    addEventListener('keydown', unlock, { capture: true });
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
  }

  /** The kit's settings panel (or a hidden tab) pauses the game: hush. */
  suspend(on) {
    this.paused = on;
    if (!this.ctx) return;
    (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  }

  tone(freq, when, dur, { type = 'sine', gain = 0.18, slide = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.enabled || this.paused || !this.ctx || this.ctx.state !== 'running') return;
    const n = NOTES;
    switch (name) {
      case 'tap':
        this.tone(n.E5, 0, 0.06, { type: 'triangle', gain: 0.06 });
        break;
      case 'open':
        this.tone(n.G4, 0, 0.12, { gain: 0.07 });
        this.tone(n.C5, 0.05, 0.16, { gain: 0.07 });
        break;
      case 'book':
        this.tone(n.C5, 0, 0.14, { type: 'triangle', gain: 0.12 });
        this.tone(n.G5, 0.09, 0.22, { type: 'triangle', gain: 0.12 });
        break;
      case 'coin':
        this.tone(n.A5, 0, 0.1, { gain: 0.12 });
        this.tone(n.E5 * 2, 0.08, 0.3, { gain: 0.1 });
        break;
      case 'success':
        [n.C5, n.E5, n.G5, n.C6].forEach((f, i) => this.tone(f, i * 0.09, 0.3, { type: 'triangle', gain: 0.11 }));
        break;
      case 'goal':
        [n.G4, n.C5, n.E5, n.G5, n.C6].forEach((f, i) => this.tone(f, i * 0.08, 0.42, { type: 'triangle', gain: 0.12 }));
        this.tone(n.C6 * 1.5, 0.45, 0.6, { gain: 0.05 });
        break;
      case 'warn':
        this.tone(n.E4, 0, 0.18, { type: 'triangle', gain: 0.09, slide: 0.85 });
        break;
      case 'night':
        [n.G5, n.E5, n.C5, n.G4].forEach((f, i) => this.tone(f, i * 0.14, 0.45, { gain: 0.08 }));
        break;
      case 'choice':
        this.tone(n.D5, 0, 0.1, { type: 'triangle', gain: 0.08 });
        break;
      case 'arrive':
        this.tone(n.C5, 0, 0.1, { gain: 0.07 });
        this.tone(n.E5, 0.07, 0.14, { gain: 0.07 });
        break;
      default:
        break;
    }
  }
}
