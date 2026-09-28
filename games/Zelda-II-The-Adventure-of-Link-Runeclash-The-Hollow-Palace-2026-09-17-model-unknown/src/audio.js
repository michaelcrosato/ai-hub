export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.nextMusicTime = 0;
    this.patternIndex = 0;
  }

  async resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
      this.nextMusicTime = this.ctx.currentTime + 0.15;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.28 : 0.0001, this.ctx.currentTime, 0.02);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
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
    const bank = {
      jump: [220, 0.08, 'square', 0.07, 330],
      slash: [150, 0.07, 'sawtooth', 0.055, 85],
      hit: [420, 0.055, 'square', 0.06, 180],
      bossHit: [180, 0.09, 'sawtooth', 0.07, 90],
      block: [720, 0.045, 'square', 0.045, 520],
      hurt: [120, 0.12, 'sawtooth', 0.075, 70],
      magic: [430, 0.14, 'triangle', 0.065, 920],
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
      complete: [330, 0.55, 'triangle', 0.08, 990]
    };
    const v = bank[name];
    if (!v) return;
    this.tone(v[0], v[1], v[2], v[3], null, v[4]);
    if (name === 'level' || name === 'complete') {
      const now = this.ctx?.currentTime ?? 0;
      this.tone(v[0] * 1.25, v[1] * 0.7, 'triangle', v[3] * 0.75, now + 0.12, v[4] * 1.25);
    }
  }

  update() {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextMusicTime < now - 1) this.nextMusicTime = now + 0.1;
    if (this.nextMusicTime > now + 0.4) return;

    // Original sparse minor-mode palace pulse; intentionally not based on source melodies.
    const roots = [110.0, 130.81, 146.83, 98.0];
    const root = roots[this.patternIndex % roots.length];
    const seq = [1, 1.5, 2, 1.5, 1, 1.334, 1.5, 2];
    for (let i = 0; i < seq.length; i++) {
      const t = this.nextMusicTime + i * 0.22;
      this.tone(root * seq[i], 0.10, 'triangle', 0.012, t, root * seq[i] * 0.995);
      if (i % 2 === 0) this.tone(root / 2, 0.15, 'square', 0.006, t, root / 2);
    }
    this.nextMusicTime += seq.length * 0.22;
    this.patternIndex += 1;
  }
}
