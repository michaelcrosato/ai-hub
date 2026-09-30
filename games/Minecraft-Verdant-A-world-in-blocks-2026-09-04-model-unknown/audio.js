// Ambient sound, all synthesized: wind, rain, the waterfall, birds by day,
// crickets by night, footsteps, the camera shutter and a discovery chime.
// Nothing is created until the player has entered the world with a gesture.

const PREF_KEY = 'verdant-sound';

function noiseBuffer(ctx, seconds, brown) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + white * 0.03) / 1.025;
      data[i] = last;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export class Ambience {
  constructor() {
    this.enabled = true;
    try {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved === 'off') this.enabled = false;
    } catch {
      /* private mode */
    }
    this.ctx = null;
    this.wanted = false;
    this.holds = new Set();
    this.birdTimer = 2;
    this.cricketTimer = 1;
    // Browsers only start audio from a gesture: try again on the next one.
    const unlock = () => {
      if (this.wanted && this.enabled) this.start();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });
  }

  /** Build the audio graph (once). */
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(ctx.destination);

    const loop = (buffer, filterType, freq, q = 0.7) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      return gain;
    };
    const brown = noiseBuffer(ctx, 4, true);
    const white = noiseBuffer(ctx, 2, false);
    this.wind = loop(brown, 'lowpass', 550);
    this.rain = loop(white, 'bandpass', 1500, 0.45);
    this.falls = loop(brown, 'lowpass', 1100);
    this.fx = ctx.createGain();
    this.fx.gain.value = 1;
    this.fx.connect(this.master);
    this.click = noiseBuffer(ctx, 0.12, false);
    return ctx;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  start() {
    this.wanted = true;
    if (!this.enabled || this.holds.size) return;
    if (!this.ensure()) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
    if (on) this.start();
    if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
  }

  /** Pause for a reason (settings panel, hidden tab) and resume when no reason is left. */
  hold(reason, on) {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    if (!this.ctx) return;
    if (this.holds.size) this.ctx.suspend().catch(() => {});
    else if (this.enabled && this.wanted) this.ctx.resume().catch(() => {});
  }

  /**
   * env: { day (0..1 daylight), rain (0..1), cloud (0..1), altitude (m above ground),
   *        height (m), fallsDistance (m to Silverfall), paused }
   */
  update(dt, env) {
    if (!this.running) return;
    const t = this.ctx.currentTime;
    const windLevel = 0.3 * (1 + env.cloud * 0.35 + (env.height > 180 ? 0.4 : 0));
    this.wind.gain.setTargetAtTime(windLevel, t, 0.6);
    this.rain.gain.setTargetAtTime(0.22 * env.rain, t, 0.5);
    this.falls.gain.setTargetAtTime(0.5 * Math.max(0, 1 - env.fallsDistance / 240), t, 0.4);
    const nearGround = env.altitude < 70 && env.height < 190;
    if (env.day > 0.25 && env.rain < 0.3 && nearGround) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 1.6 + Math.random() * 5;
        this.chirp();
      }
    }
    if (env.day <= 0.02 && env.rain < 0.5 && nearGround) {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 0.5 + Math.random() * 1.1;
        this.cricket();
      }
    }
  }

  voice(pan = 0) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(this.fx);
      return { gain, nodes: [gain, panner] };
    }
    gain.connect(this.fx);
    return { gain, nodes: [gain] };
  }

  tone(type, freq, start, length, peak, pan = 0, endFreq = 0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length * 0.8);
    const { gain, nodes } = this.voice(pan);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, length * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + length + 0.02);
    osc.onended = () => {
      osc.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  burst(start, length, peak, filterType, freq) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.click;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const { gain, nodes } = this.voice(0);
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter).connect(gain);
    src.start(start);
    src.stop(start + length + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  chirp() {
    const t = this.ctx.currentTime + 0.02;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2300 + Math.random() * 1500;
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < notes; i++) {
      const f = base * (1 + Math.random() * 0.12);
      this.tone('sine', f, t + i * 0.12, 0.09, 0.035, pan, f * (1.2 + Math.random() * 0.25));
    }
  }

  cricket() {
    const t = this.ctx.currentTime + 0.02;
    const pan = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < 3; i++) this.tone('sine', 4300, t + i * 0.05, 0.03, 0.012, pan);
  }

  step() {
    if (!this.running) return;
    this.burst(this.ctx.currentTime + 0.01, 0.07, 0.16, 'lowpass', 420);
  }

  land(strength = 0.5) {
    if (!this.running) return;
    this.burst(this.ctx.currentTime + 0.01, 0.16, 0.2 + strength * 0.25, 'lowpass', 260);
  }

  shutter() {
    if (!this.running) return;
    const t = this.ctx.currentTime + 0.01;
    this.burst(t, 0.04, 0.3, 'highpass', 2400);
    this.burst(t + 0.08, 0.05, 0.22, 'highpass', 1800);
  }

  chime() {
    if (!this.running) return;
    const t = this.ctx.currentTime + 0.02;
    this.tone('sine', 659.25, t, 0.9, 0.06);
    this.tone('sine', 987.77, t + 0.12, 1.1, 0.05);
    this.tone('triangle', 1318.5, t + 0.24, 0.8, 0.02);
  }

  close() {
    this.ctx?.close().catch(() => {});
  }
}
