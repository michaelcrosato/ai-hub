// A host-owned mixer. Sounds use local synthesis, not network files.
export class AudioBus {
  volume = 0.28;
  muted = false;
  context = null;
  gain = null;
  nodes = new Set();
  /** Create (or wake) the audio context. Browsers allow this only after a click, tap or key press. */
  unlock() {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        // A gentle limiter keeps the minigun, sirens and impacts from clipping together.
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -10;
        this.limiter.knee.value = 8;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.2;
        this.limiter.connect(this.context.destination);
        this.gain = this.context.createGain();
        this.gain.connect(this.limiter);
      }
      this.gain.gain.value = this.level;
      if (this.context.state !== 'running') void this.context.resume().catch(() => {});
    } catch {}
  }
  get level() {
    return this.muted ? 0 : this.volume;
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.level;
  }
  setMuted(on) {
    this.muted = !!on;
    if (this.gain) this.gain.gain.value = this.level;
  }
  tone(frequency = 220, duration = 0.12, type = 'sine', volume = 0.15, end = frequency) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    const osc = c.createOscillator(),
      env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), c.currentTime + duration);
    env.gain.setValueAtTime(volume, c.currentTime);
    env.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(env);
    env.connect(this.gain);
    this.nodes.add(osc);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
      this.nodes.delete(osc);
    };
    osc.start();
    osc.stop(c.currentTime + duration);
  }
  play(name) {
    if (name === 'shot') this.tone(130, 0.1, 'sawtooth', 0.45, 30);
    else if (name === 'hit') this.tone(580, 0.055, 'triangle', 0.3, 320);
    else if (name === 'hurt') this.tone(74, 0.2, 'sawtooth', 0.25, 36);
    else if (name === 'reload') this.tone(740, 0.09, 'square', 0.12, 390);
    else if (name === 'pickup') this.tone(520, 0.22, 'sine', 0.23, 1000);
    else if (name === 'empty') this.tone(85, 0.05, 'square', 0.12);
    else if (name === 'gate') this.tone(160, 0.35, 'triangle', 0.2, 430);
    else if (name === 'step') this.tone(72, 0.04, 'triangle', 0.1, 40);
    else if (name === 'crash') {
      this.tone(58, 0.3, 'sawtooth', 0.3, 28);
      this.tone(210, 0.12, 'square', 0.1, 90);
    } else if (name === 'best') {
      this.tone(523, 0.16, 'triangle', 0.16, 523);
      setTimeout(() => this.tone(784, 0.3, 'triangle', 0.16, 1046), 140);
    }
  }
  pause() {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }
  resume() {
    if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') void this.context.resume().catch(() => {});
  }
  dispose() {
    for (const n of this.nodes)
      try {
        n.stop();
      } catch {}
    this.nodes.clear();
    if (this.context) void this.context.close();
  }
}
