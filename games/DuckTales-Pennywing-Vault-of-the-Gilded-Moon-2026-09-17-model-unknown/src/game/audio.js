// Original procedural Web Audio: chiptune-style effects and a short looping
// arpeggio per vault. Nothing is decoded or downloaded. The context is created
// on the first gesture (unlock), suspended while the game is paused, and the
// music is scheduled ahead on the audio clock so a slow frame never stutters it.

// Original note patterns. They evoke cartridge-era adventure without copying a source melody.
const PATTERNS = [
  // Vault I: the Gilded Moon.
  [196, 247, 294, 392, 294, 247, 220, 277, 330, 440, 330, 277, 174, 220, 262, 349, 262, 220, 196, 247, 330, 392, 330, 247],
  // Vault II: the Sunken Orrery, a cooler minor-key drift.
  [220, 262, 330, 440, 330, 262, 196, 247, 294, 392, 294, 247, 175, 220, 262, 349, 262, 220, 165, 208, 247, 330, 294, 247],
];
const MASTER = 0.42;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.paused = false;
    this.musicTimer = null;
    this.step = 0;
    this.pattern = 0;
    this.stepDur = 0.168;
    this.nextNote = 0;
  }

  /** Create or resume the context. Call from a user gesture; safe to call often. */
  async start() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.12;
        this.musicGain.connect(this.master);
      }
      if (!this.paused && this.ctx.state !== 'running') await this.ctx.resume();
      if (!this.musicTimer) this.startMusic();
    } catch {
      /* audio is optional */
    }
  }

  setMuted(value) {
    this.muted = !!value;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.02);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Suspend everything while the game is paused (the music clock stops with it). */
  setPaused(p) {
    this.paused = !!p;
    if (!this.ctx) return;
    if (this.paused) this.ctx.suspend?.().catch?.(() => {});
    else this.ctx.resume?.().catch?.(() => {});
  }

  /** Pick the vault's music; `urgent` speeds it up for the escape. */
  setMusic(pattern = 0, urgent = false) {
    const p = Math.max(0, Math.min(PATTERNS.length - 1, pattern | 0));
    if (p !== this.pattern) this.step = 0;
    this.pattern = p;
    this.stepDur = urgent ? 0.128 : 0.168;
  }

  tone(freq, duration = 0.09, { type = 'square', volume = 0.12, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  sfx(name) {
    const t = (f, d, o) => this.tone(f, d, o);
    switch (name) {
      case 'jump': t(310, 0.09, { type: 'square', volume: 0.07, slide: 130 }); break;
      case 'pogo': t(190, 0.075, { type: 'triangle', volume: 0.09, slide: 210 }); break;
      case 'coin': t(760, 0.06, { type: 'square', volume: 0.055, slide: 180 }); break;
      case 'gem': t(540, 0.12, { type: 'triangle', volume: 0.08, slide: 420 }); t(980, 0.08, { type: 'square', volume: 0.04, delay: 0.05 }); break;
      case 'relic': [392, 523, 659, 784].forEach((f, i) => t(f, 0.16, { type: 'triangle', volume: 0.07, delay: i * 0.07 })); break;
      case 'enemy': t(260, 0.07, { type: 'sawtooth', volume: 0.07, slide: -120 }); break;
      case 'hurt': t(170, 0.14, { type: 'sawtooth', volume: 0.11, slide: -90 }); break;
      case 'break': t(125, 0.09, { type: 'square', volume: 0.1, slide: -55 }); t(82, 0.12, { type: 'sawtooth', volume: 0.06, delay: 0.04 }); break;
      case 'bossTell': t(120, 0.18, { type: 'square', volume: 0.06, slide: 70 }); break;
      case 'bossStart': t(92, 0.35, { type: 'sawtooth', volume: 0.09, slide: 38 }); break;
      case 'bossHit': t(115, 0.12, { type: 'square', volume: 0.12, slide: -25 }); t(310, 0.07, { type: 'triangle', volume: 0.05, delay: 0.03 }); break;
      case 'bossSlam': t(70, 0.22, { type: 'sawtooth', volume: 0.1, slide: -30 }); t(540, 0.1, { type: 'square', volume: 0.035, slide: 300, delay: 0.04 }); break;
      case 'bossDown': [220, 174, 146, 110].forEach((f, i) => t(f, 0.22, { type: 'sawtooth', volume: 0.08, delay: i * 0.07, slide: -20 })); break;
      case 'upgrade': [440, 554, 659].forEach((f, i) => t(f, 0.15, { type: 'triangle', volume: 0.065, delay: i * 0.08 })); break;
      case 'tonic': [523, 659, 523, 784].forEach((f, i) => t(f, 0.12, { type: 'triangle', volume: 0.06, delay: i * 0.06 })); break;
      case 'checkpoint': t(587, 0.1, { type: 'triangle', volume: 0.06 }); t(880, 0.14, { type: 'triangle', volume: 0.06, delay: 0.08 }); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => t(f, 0.15, { type: 'square', volume: 0.05, delay: i * 0.055 })); break;
      case 'crown': [330, 494, 659, 988].forEach((f, i) => t(f, 0.18, { type: 'triangle', volume: 0.07, delay: i * 0.08 })); break;
      case 'tick': t(1200, 0.04, { type: 'square', volume: 0.035 }); break;
      case 'menu': t(660, 0.035, { type: 'square', volume: 0.03 }); break;
      case 'fail': t(220, 0.22, { type: 'sawtooth', volume: 0.08, slide: -120 }); break;
      case 'win': [392, 494, 587, 784, 988].forEach((f, i) => t(f, 0.2, { type: 'triangle', volume: 0.07, delay: i * 0.09 })); break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.05;
    // Schedule a little ahead on the audio clock; a suspended context stops the clock, so
    // pausing never piles up a backlog of notes.
    this.musicTimer = setInterval(() => {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (this.nextNote < now - 0.25) this.nextNote = now + 0.02; // after a long stall, skip ahead
      while (this.nextNote < now + 0.12) {
        const notes = PATTERNS[this.pattern];
        const f = notes[this.step++ % notes.length];
        const at = this.nextNote;
        this.nextNote += this.stepDur;
        if (this.muted) continue;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.055, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(at);
        osc.stop(at + 0.15);
      }
    }, 50);
  }

  destroy() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.ctx?.close();
    this.ctx = null;
  }
}
