// A host-owned mixer. Sounds use local synthesis, not network files.
export class AudioBus {
  volume = 0.28;
  muted = false;
  context = null;
  gain = null;
  nodes = new Set();
  engineNodes = null;
  /** Create (or wake) the audio context. Browsers allow this only after a click, tap or key press. */
  unlock() {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        // A gentle limiter keeps shots, impacts and the engine from clipping together.
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
    } catch {
      /* no audio on this device */
    }
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
  tone(frequency = 220, duration = 0.12, type = 'sine', volume = 0.15, end = frequency, delay = 0) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    const at = c.currentTime + delay;
    const osc = c.createOscillator(),
      env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    if (delay > 0) env.gain.setValueAtTime(0.0001, c.currentTime);
    env.gain.setValueAtTime(volume, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env);
    env.connect(this.gain);
    this.nodes.add(osc);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
      this.nodes.delete(osc);
    };
    osc.start(at);
    osc.stop(at + duration);
  }
  play(name) {
    if (name === 'shot') this.tone(130, 0.1, 'sawtooth', 0.45, 30);
    else if (name === 'pistol') this.tone(190, 0.12, 'square', 0.32, 45);
    else if (name === 'hit') this.tone(580, 0.055, 'triangle', 0.3, 320);
    else if (name === 'hurt') this.tone(74, 0.2, 'sawtooth', 0.25, 36);
    else if (name === 'reload') this.tone(740, 0.09, 'square', 0.12, 390);
    else if (name === 'pickup') this.tone(520, 0.22, 'sine', 0.23, 1000);
    else if (name === 'empty') this.tone(85, 0.05, 'square', 0.12);
    else if (name === 'gate') this.tone(160, 0.35, 'triangle', 0.2, 430);
    else if (name === 'step') this.tone(72, 0.04, 'triangle', 0.1, 40);
    else if (name === 'down') {
      // A sentry powers down.
      this.tone(420, 0.28, 'square', 0.12, 60);
      this.tone(90, 0.3, 'triangle', 0.18, 40, 0.05);
    } else if (name === 'crash') {
      this.tone(58, 0.3, 'sawtooth', 0.3, 28);
      this.tone(210, 0.12, 'square', 0.1, 90);
    } else if (name === 'checkpoint') {
      this.tone(392, 0.12, 'triangle', 0.16, 392);
      this.tone(587, 0.22, 'triangle', 0.16, 587, 0.1);
    } else if (name === 'complete') {
      this.tone(392, 0.18, 'triangle', 0.16, 392);
      this.tone(523, 0.18, 'triangle', 0.16, 523, 0.14);
      this.tone(784, 0.4, 'triangle', 0.18, 784, 0.28);
    } else if (name === 'best') {
      this.tone(523, 0.16, 'triangle', 0.16, 523);
      this.tone(784, 0.3, 'triangle', 0.16, 1046, 0.14);
    }
  }
  /** A continuous engine note for the driving kit: level 0..1 (0 silences it). */
  engine(level) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    if (!this.engineNodes) {
      if (level <= 0) return;
      const osc = c.createOscillator(),
        sub = c.createOscillator(),
        filter = c.createBiquadFilter(),
        env = c.createGain();
      osc.type = 'sawtooth';
      sub.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      env.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(env);
      env.connect(this.gain);
      osc.start();
      sub.start();
      this.engineNodes = { osc, sub, filter, env };
    }
    const { osc, sub, filter, env } = this.engineNodes,
      t = c.currentTime,
      l = Math.max(0, Math.min(1, level));
    osc.frequency.setTargetAtTime(46 + l * 110, t, 0.05);
    sub.frequency.setTargetAtTime(23 + l * 55, t, 0.05);
    filter.frequency.setTargetAtTime(260 + l * 900, t, 0.08);
    env.gain.setTargetAtTime(level <= 0 ? 0 : 0.05 + l * 0.07, t, 0.06);
  }
  engineOff() {
    const n = this.engineNodes;
    if (!n) return;
    this.engineNodes = null;
    try {
      n.osc.stop();
      n.sub.stop();
    } catch {
      /* already stopped */
    }
    n.osc.disconnect();
    n.sub.disconnect();
    n.filter.disconnect();
    n.env.disconnect();
  }
  pause() {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }
  resume() {
    if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') void this.context.resume().catch(() => {});
  }
  dispose() {
    this.engineOff();
    for (const n of this.nodes)
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    this.nodes.clear();
    if (this.context) void this.context.close();
  }
}
