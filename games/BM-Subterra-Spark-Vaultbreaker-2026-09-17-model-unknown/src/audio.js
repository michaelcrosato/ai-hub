/**
 * audio.js — Subterra Spark's synthesised sound. No files: oscillators and one
 * shared noise buffer. The context starts on the first key, click or tap
 * (browsers refuse earlier) and suspends while the game is paused.
 */

export function createAudio() {
  let ctx = null;
  let out = null;
  let noise = null;
  let engine = null;
  let ambient = null;
  let paused = false;
  let area = 1;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch {
        return;
      }
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      buildEngine();
      buildAmbient();
      setAmbient(area);
    }
    if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {});
  }

  function buildEngine() {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 48;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 24;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;
    osc.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(gain).connect(out);
    osc.start();
    sub.start();
    engine = { osc, sub, filter, gain };
  }

  function buildAmbient() {
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = b.type = 'sine';
    // Start on the drone's pitch, not the 440 Hz default (setAmbient only glides from here).
    a.frequency.value = 55;
    b.frequency.value = 55 * 1.503;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(filter.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain).connect(out);
    a.start();
    b.start();
    lfo.start();
    ambient = { a, b, gain };
  }

  /** The original blip: an oscillator with an optional pitch slide. */
  function beep(freq = 300, duration = 0.06, type = 'square', gain = 0.025, slide = 0) {
    if (!ctx || paused) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  /** A filtered noise burst: explosions (low), sizzles and impacts (high). */
  function burst(duration = 0.3, gain = 0.06, freq = 600, type = 'lowpass') {
    if (!ctx || paused) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (type === 'lowpass') f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.02);
  }

  const boom = (size = 1) => {
    burst(0.25 + size * 0.35, 0.05 + size * 0.05, 500 + size * 300);
    beep(70 + 30 / size, 0.2 + size * 0.2, 'sine', 0.05 * size, -40);
  };
  const sizzle = () => burst(0.18, 0.03, 2400, 'highpass');

  /** Crawler engine: level 0..1+ (speed), off when on foot or in menus. */
  function setEngine(level, boosting) {
    if (!engine) return;
    const t = ctx.currentTime;
    const on = level > 0.001;
    engine.gain.gain.setTargetAtTime(on ? 0.018 + Math.min(1.6, level) * 0.02 : 0, t, 0.08);
    engine.osc.frequency.setTargetAtTime(44 + Math.min(1.6, level) * 36 + (boosting ? 22 : 0), t, 0.12);
    engine.sub.frequency.setTargetAtTime(22 + Math.min(1.6, level) * 18, t, 0.12);
    engine.filter.frequency.setTargetAtTime(boosting ? 520 : 260, t, 0.1);
  }

  /** A low drone per area: the aquifer hums, the foundry growls. */
  function setAmbient(id) {
    area = id;
    if (!ambient) return;
    const t = ctx.currentTime;
    const base = id === 2 ? 41 : 55;
    ambient.a.frequency.setTargetAtTime(base, t, 0.5);
    ambient.b.frequency.setTargetAtTime(base * 1.503, t, 0.5);
    ambient.gain.gain.setTargetAtTime(id === 2 ? 0.026 : 0.02, t, 0.5);
  }

  function pause(on) {
    paused = !!on;
    if (!ctx) return;
    if (paused) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  }

  return { unlock, beep, burst, boom, sizzle, setEngine, setAmbient, pause };
}
