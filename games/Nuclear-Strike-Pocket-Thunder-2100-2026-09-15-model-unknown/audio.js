/* Pocket Thunder 2100 — synthesized sound. Nothing is loaded: rotor wash is
   filtered noise with a chopping LFO, weapons are short noise and tone bursts,
   and a sparse bass line plays while flying. The context starts on the first
   user action and follows the kit's pause. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Bass lines: Breakwater's steady pulse, and a darker one for Nightwatch.
const LINES = {
  mission: [55, 55, 82.4, 55, 65.4, 55, 73.4, 82.4],
  night: [49, 49, 58.3, 49, 65.4, 49, 58.3, 43.7],
};

export class Sound {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.a = null;
    this.held = false;
  }

  /** Create the context (first call) or resume it. Call from a user gesture when possible. */
  init() {
    if (this.a) {
      if (!this.held && this.a.ctx.state === 'suspended') this.a.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = this.enabled ? 0.55 : 0;
      master.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const rotorGain = ctx.createGain();
      rotorGain.gain.value = 0.015;
      rotorGain.connect(master);
      const engine = ctx.createOscillator();
      engine.type = 'triangle';
      engine.frequency.value = 57;
      engine.connect(rotorGain);
      engine.start();
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noise;
      noiseSrc.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 230;
      const ng = ctx.createGain();
      ng.gain.value = 0.16;
      noiseSrc.connect(filter);
      filter.connect(ng);
      ng.connect(rotorGain);
      noiseSrc.start();
      const chop = ctx.createOscillator();
      const chopGain = ctx.createGain();
      chop.type = 'sine';
      chop.frequency.value = 23;
      chopGain.gain.value = 0.02;
      chop.connect(chopGain);
      chopGain.connect(rotorGain.gain);
      chop.start();
      this.a = { ctx, master, noise, rotorGain, engine, chopGain, nextNote: 0, note: 0 };
      if (this.held) ctx.suspend().catch(() => {});
    } catch (e) {
      console.warn('Audio is not available.', e);
    }
  }

  /** The kit paused (settings panel) or resumed the game. */
  hold(on) {
    this.held = on;
    if (!this.a) return;
    if (on) this.a.ctx.suspend().catch(() => {});
    else this.a.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.a) this.a.master.gain.setTargetAtTime(on ? 0.55 : 0, this.a.ctx.currentTime, 0.03);
  }

  tone(f, duration, volume = 0.08, type = 'sine', to = 0, pan = 0, delay = 0) {
    if (!this.a || !this.enabled) return;
    const { ctx, master } = this.a;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const s = ctx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(10, to), t0 + duration);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    s.pan.value = clamp(pan, -1, 1);
    osc.connect(gain);
    gain.connect(s);
    s.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      s.disconnect();
    };
  }

  noise(duration, volume, cutoff = 600, pan = 0) {
    if (!this.a || !this.enabled) return;
    const { ctx, master, noise } = this.a;
    const n = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const s = ctx.createStereoPanner();
    n.buffer = noise;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    s.pan.value = clamp(pan, -1, 1);
    n.connect(f);
    f.connect(g);
    g.connect(s);
    s.connect(master);
    n.start(0, Math.random());
    n.stop(ctx.currentTime + duration);
    n.onended = () => {
      n.disconnect();
      f.disconnect();
      g.disconnect();
      s.disconnect();
    };
  }

  sfx(type, pan = 0) {
    if (!this.a || !this.enabled) return;
    if (type === 'gun') {
      this.noise(0.045, 0.11, 2300, pan);
      this.tone(135, 0.045, 0.04, 'triangle', 60, pan);
    } else if (type === 'rocket') {
      this.noise(0.28, 0.2, 1400, pan);
      this.tone(170, 0.22, 0.08, 'sawtooth', 40, pan);
    } else if (type === 'boom') {
      this.noise(0.8, 0.34, 480, pan);
      this.tone(90, 0.6, 0.2, 'triangle', 26, pan);
    } else if (type === 'hit') {
      this.noise(0.1, 0.16, 650, pan);
    } else if (type === 'emp') {
      this.tone(110, 0.7, 0.16, 'sine', 820);
      this.noise(0.5, 0.12, 1400);
    } else if (type === 'rescue') {
      this.tone(660, 0.13, 0.09);
      this.tone(990, 0.22, 0.09, 'sine', 0, 0, 0.12);
    } else if (type === 'warn') {
      this.tone(340, 0.12, 0.08, 'square');
    } else if (type === 'basehit') {
      this.noise(0.35, 0.18, 380, pan);
      this.tone(70, 0.3, 0.09, 'triangle', 40, pan);
    } else if (type === 'siren') {
      this.tone(420, 0.45, 0.07, 'sawtooth', 620);
      this.tone(620, 0.45, 0.07, 'sawtooth', 420, 0, 0.47);
    } else if (type === 'wave') {
      this.tone(440, 0.16, 0.08);
      this.tone(554, 0.16, 0.08, 'sine', 0, 0, 0.14);
      this.tone(659, 0.34, 0.09, 'sine', 0, 0, 0.28);
    } else this.tone(600, 0.08, 0.07);
  }

  /** Rotor and engine follow the flight; the bass line plays while flying. */
  update(active, speed, line = 'mission') {
    if (!this.a) return;
    const { ctx, rotorGain, engine, chopGain } = this.a;
    rotorGain.gain.setTargetAtTime(active ? 0.055 : 0.012, ctx.currentTime, 0.12);
    chopGain.gain.setTargetAtTime(active ? 0.027 : 0.004, ctx.currentTime, 0.12);
    engine.frequency.setTargetAtTime(54 + speed * 1.2, ctx.currentTime, 0.2);
    if (active && this.enabled && ctx.currentTime > this.a.nextNote) {
      this.a.nextNote = ctx.currentTime + 0.42;
      const notes = LINES[line] || LINES.mission;
      this.tone(notes[this.a.note % 8], 0.28, 0.025, 'sine');
      if (this.a.note % 8 === 0) this.tone(notes[0] * 4, 0.8, 0.016, 'sine');
      this.a.note++;
    }
  }
}
