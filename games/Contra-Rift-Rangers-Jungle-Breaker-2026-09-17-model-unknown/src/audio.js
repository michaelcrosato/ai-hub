// Small synthesized sound set. The AudioContext is created lazily on the first
// key, click or tap (browsers only start audio after a gesture), so keyboard
// players get sound too, not just mouse and touch players.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let ambience = null;
  let enabled = true;
  let paused = false;
  let wantAmbience = false;

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return null;
    }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.0), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wantAmbience) startAmbience();
    return ctx;
  };

  const unlock = () => {
    if (!ensure()) return;
    if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {});
  };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  addEventListener('touchend', unlock, true);

  const live = () => enabled && !paused && ctx && ctx.state === 'running';

  function tone(freq, duration, type = 'square', gain = 0.03, slideTo = 0) {
    if (!live()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  function explosion(scale = 0.7) {
    if (!live()) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    s.buffer = noise;
    f.type = 'lowpass';
    f.frequency.value = 850;
    g.gain.setValueAtTime(0.055 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + scale * 0.12);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + 0.26 + scale * 0.12);
  }

  // Soft jungle bed: band-passed noise, looping quietly under play and the title.
  function startAmbience() {
    if (!ctx || ambience) return;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    s.connect(f).connect(g).connect(master);
    s.start();
    ambience = s;
  }

  function chirp() {
    const base = 2200 + Math.random() * 1400;
    tone(base, 0.07, 'sine', 0.007, base * 1.35);
    setTimeout(() => tone(base * 1.1, 0.06, 'sine', 0.006, base * 1.5), 90);
  }

  return {
    tone,
    explosion,
    chirp,
    ambience(on) {
      wantAmbience = on;
      if (on) {
        if (ctx) startAmbience();
      } else if (ambience) {
        try {
          ambience.stop();
        } catch {
          /* already stopped */
        }
        ambience = null;
      }
    },
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = !!on;
      if (master) master.gain.value = enabled ? 0.9 : 0;
      if (enabled) unlock();
    },
    setPaused(p) {
      paused = !!p;
      if (!ctx) return;
      if (paused) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    }
  };
}
