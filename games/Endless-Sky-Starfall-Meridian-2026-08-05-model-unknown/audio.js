// Starfall Meridian — synthesized sound: the original oscillator blips, plus an engine
// hum and a jump whine. The AudioContext is only created from a real gesture (browsers
// refuse to start one earlier), and it is suspended whenever the game pauses.

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let paused = false;
  let hum = null;

  const running = () => ctx && enabled && !paused && ctx.state === 'running';

  const buildHum = () => {
    if (hum || !ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.7;
    const a = ctx.createOscillator();
    a.type = 'sawtooth';
    a.frequency.value = 46;
    const b = ctx.createOscillator();
    b.type = 'triangle';
    b.frequency.value = 69;
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain).connect(master);
    a.start();
    b.start();
    hum = { gain, filter, a, b };
  };

  return {
    /** Call from a pointer or key gesture: creates or resumes the context. */
    unlock() {
      if (!enabled) return;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
          ctx = new AC();
        } catch {
          ctx = null;
          return;
        }
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        buildHum();
      }
      if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {});
    },

    setEnabled(on) {
      enabled = !!on;
      if (!ctx) return;
      if (!enabled) ctx.suspend().catch(() => {});
      else if (!paused) ctx.resume().catch(() => {});
    },

    /** Pause with the game (kit menu, own pause menu, hidden tab). */
    pause(on) {
      paused = !!on;
      if (!ctx) return;
      if (paused) ctx.suspend().catch(() => {});
      else if (enabled) ctx.resume().catch(() => {});
    },

    /** The original one-shot: a pitch drop from freq to half over dur seconds. */
    blip(freq, dur = 0.08, gain = 0.035, type = 'sawtooth') {
      if (!running()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.52), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    /** A rising tone (jump charge, pickups). */
    rise(from, to, dur = 0.3, gain = 0.03, type = 'sine') {
      if (!running()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    /** Engine hum: level 0..1 from thrust, boost adds grit. */
    engine(level, boost = false) {
      if (!hum || !ctx) return;
      const t = ctx.currentTime;
      const target = running() ? Math.min(1, Math.max(0, level)) * (boost ? 0.05 : 0.032) : 0;
      hum.gain.gain.setTargetAtTime(target, t, 0.12);
      hum.a.frequency.setTargetAtTime(42 + level * (boost ? 44 : 28), t, 0.2);
      hum.b.frequency.setTargetAtTime(63 + level * (boost ? 60 : 36), t, 0.2);
      hum.filter.frequency.setTargetAtTime(220 + level * (boost ? 520 : 260), t, 0.2);
    },
  };
}
