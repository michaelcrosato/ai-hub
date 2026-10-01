// Procedural chiptune sound: every effect and the music are oscillators, nothing is downloaded.

const BANK = {
  jump: [220, 0.08, 'square', 0.07, 330],
  slash: [150, 0.07, 'sawtooth', 0.055, 85],
  hit: [420, 0.055, 'square', 0.06, 180],
  bossHit: [180, 0.09, 'sawtooth', 0.07, 90],
  block: [720, 0.045, 'square', 0.045, 520],
  hurt: [120, 0.12, 'sawtooth', 0.075, 70],
  magic: [430, 0.14, 'triangle', 0.065, 920],
  empty: [160, 0.06, 'square', 0.03, 140],
  enemyMagic: [240, 0.16, 'sawtooth', 0.05, 120],
  pickup: [660, 0.09, 'square', 0.05, 880],
  key: [520, 0.18, 'triangle', 0.07, 1040],
  door: [90, 0.22, 'sawtooth', 0.06, 60],
  enemyDown: [200, 0.14, 'square', 0.06, 80],
  bossDown: [140, 0.45, 'sawtooth', 0.08, 45],
  bossStart: [75, 0.28, 'sawtooth', 0.07, 115],
  respawn: [180, 0.24, 'triangle', 0.06, 320],
  text: [460, 0.045, 'square', 0.035, 480],
  start: [260, 0.16, 'triangle', 0.055, 520],
  level: [440, 0.25, 'square', 0.07, 880],
  upgrade: [560, 0.20, 'triangle', 0.065, 1120],
  complete: [330, 0.55, 'triangle', 0.08, 990],
  checkpoint: [392, 0.16, 'triangle', 0.05, 587],
  menu: [520, 0.035, 'square', 0.025, 560],
  burn: [300, 0.22, 'sawtooth', 0.07, 70],
  brazier: [196, 0.3, 'triangle', 0.07, 784],
  wisp: [880, 0.18, 'triangle', 0.04, 330],
  cast: [330, 0.2, 'triangle', 0.035, 180],
  windup: [70, 0.3, 'sawtooth', 0.05, 140],
  leap: [110, 0.2, 'square', 0.05, 220],
  slam: [95, 0.3, 'sawtooth', 0.09, 38]
};

// Original sparse minor-mode loops; intentionally not based on any source melodies.
const THEMES = {
  hollow: { roots: [110.0, 130.81, 146.83, 98.0], seq: [1, 1.5, 2, 1.5, 1, 1.334, 1.5, 2], step: 0.22, lead: 0.012, bass: 0.006 },
  undercroft: { roots: [98.0, 87.31, 116.54, 103.83], seq: [1, 1.189, 1.5, 1.189, 1, 1.335, 1.189, 0.89], step: 0.24, lead: 0.012, bass: 0.007 },
  boss: { roots: [82.41, 87.31, 82.41, 73.42], seq: [1, 1, 1.5, 1, 1.189, 1, 1.5, 2], step: 0.16, lead: 0.013, bass: 0.01 }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.paused = false;
    this.nextMusicTime = 0;
    this.patternIndex = 0;
    this.theme = THEMES.hollow;
    this.themeName = 'hollow';
  }

  /** Create or wake the audio context. Call from a user gesture (click, key, tap). */
  async resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.28 : 0.0001;
      this.master.connect(this.ctx.destination);
      this.nextMusicTime = this.ctx.currentTime + 0.15;
    }
    if (this.ctx.state === 'suspended' && !this.paused) {
      try {
        await this.ctx.resume();
      } catch {
        /* resumes on the next gesture */
      }
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.28 : 0.0001, this.ctx.currentTime, 0.02);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** Pause menu, settings panel, hidden tab: stop the clock so music and effects freeze. */
  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!paused && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setTheme(name) {
    if (name === this.themeName || !THEMES[name]) return;
    this.themeName = name;
    this.theme = THEMES[name];
    this.patternIndex = 0; // the new loop follows the bar already queued
  }

  tone(freq, duration = 0.09, type = 'square', gain = 0.08, when = null, endFreq = null) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  play(name) {
    const v = BANK[name];
    if (!v || this.paused) return;
    this.tone(v[0], v[1], v[2], v[3], null, v[4]);
    if (name === 'level' || name === 'complete' || name === 'brazier') {
      const now = this.ctx?.currentTime ?? 0;
      this.tone(v[0] * 1.25, v[1] * 0.7, 'triangle', v[3] * 0.75, now + 0.12, v[4] * 1.25);
    }
  }

  update() {
    if (!this.enabled || this.paused || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextMusicTime < now - 1) this.nextMusicTime = now + 0.1;
    if (this.nextMusicTime > now + 0.4) return;

    const th = this.theme;
    const root = th.roots[this.patternIndex % th.roots.length];
    for (let i = 0; i < th.seq.length; i++) {
      const t = this.nextMusicTime + i * th.step;
      this.tone(root * th.seq[i], th.step * 0.45, 'triangle', th.lead, t, root * th.seq[i] * 0.995);
      if (i % 2 === 0) this.tone(root / 2, th.step * 0.7, 'square', th.bass, t, root / 2);
    }
    this.nextMusicTime += th.seq.length * th.step;
    this.patternIndex += 1;
  }
}
