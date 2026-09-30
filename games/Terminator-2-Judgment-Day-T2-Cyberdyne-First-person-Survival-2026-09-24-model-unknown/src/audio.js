// A small mixer. Every sound is synthesised in the browser; nothing is downloaded.
export class AudioBus {
  volume = 0.25;
  muted = false;
  context = null;
  gain = null;
  nodes = new Set();
  noiseBuffer = null;

  /** Create or resume the context. Call from a user gesture (the first one unlocks audio). */
  unlock() {
    try {
      if (!this.context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.context = new Ctx();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
      }
      this.gain.gain.value = this.muted ? 0 : this.volume;
      if (this.context.state !== 'running') void this.context.resume().catch(() => {});
    } catch {
      /* no audio on this device */
    }
  }
  get running() {
    return !!this.context && this.context.state === 'running';
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }
  setMuted(on) {
    this.muted = !!on;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }
  tone(frequency = 220, duration = 0.12, type = 'sine', volume = 0.15, end = frequency) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    const osc = c.createOscillator(), env = c.createGain();
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
  /** Filtered white noise: gunfire, impacts, hiss. */
  noise(duration = 0.09, volume = 0.2, freq = 650) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const b = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.gain);
    this.nodes.add(src);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      this.nodes.delete(src);
    };
    src.start(0, Math.random());
    src.stop(c.currentTime + duration);
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
    else if (name === 'launch') {
      this.tone(210, 0.12, 'square', 0.14, 90);
      this.noise(0.18, 0.35, 900);
    } else if (name === 'burst') {
      this.tone(95, 0.25, 'triangle', 0.2, 48);
      this.noise(1.4, 0.22, 520);
    }
  }
  suspend() {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }
  dispose() {
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
