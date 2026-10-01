/**
 * Soft synthesised sounds for First Light. Nothing is downloaded or decoded:
 * every sound is built from oscillators and one shared noise buffer, made the
 * first time it is needed. The context starts on the first click, tap or key
 * press after the player turns sound on (browsers refuse audio before that).
 */
export function createSound() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = false;
  let lastClash = 0;

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };
  const running = () => enabled && ctx && ctx.state === 'running';
  const noise = () => {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    // Gently filtered noise: closer to earth and water than to hiss.
    for (let i = 0; i < len; i++) {
      last = last * 0.55 + (Math.random() * 2 - 1) * 0.45;
      data[i] = last * 1.6;
    }
    return noiseBuffer;
  };

  /** One oscillator note with an attack/decay envelope. */
  const tone = (freq, { to = freq, type = 'sine', dur = 0.3, vol = 0.035, delay = 0, attack = 0.02 } = {}) => {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + dur * 0.7);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  };

  /** A burst of filtered noise; the filter can sweep from f0 to f1. */
  const rush = ({ dur = 0.4, vol = 0.05, type = 'lowpass', f0 = 300, f1 = f0, q = 0.8, delay = 0, attack = 0.03 } = {}) => {
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur * 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(now, Math.random());
    src.stop(now + dur + 0.05);
  };

  const sounds = {
    select: () => tone(392, { to: 588, dur: 0.22 }),
    town: () => {
      tone(523, { to: 784, dur: 0.35 });
      tone(1046, { dur: 0.3, vol: 0.012, delay: 0.04 });
    },
    upgrade: () => [523, 659, 784].forEach((f, i) => tone(f, { dur: 0.32, vol: 0.026, delay: i * 0.07 })),
    warn: () => tone(110, { to: 150, dur: 0.3, vol: 0.05, type: 'triangle' }),
    collapse: () => {
      rush({ dur: 0.35, vol: 0.05, f0: 420, f1: 160 });
      tone(92, { to: 60, dur: 0.35, vol: 0.04 });
    },
    clash: () => {
      const now = ctx.currentTime;
      if (now - lastClash < 0.14) return;
      lastClash = now;
      rush({ dur: 0.07, vol: 0.022, type: 'bandpass', f0: 2600 + Math.random() * 900, q: 6, attack: 0.003 });
    },
    rival: () => {
      tone(98, { dur: 0.32, vol: 0.05, type: 'triangle' });
      tone(98, { dur: 0.32, vol: 0.045, type: 'triangle', delay: 0.34 });
    },
    victory: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.7, vol: 0.035, delay: i * 0.16 })),
    defeat: () => [440, 349, 294, 220].forEach((f, i) => tone(f, { dur: 0.8, vol: 0.035, delay: i * 0.22, type: 'triangle' })),
    // Powers, one voice each.
    raise: () => {
      tone(196, { to: 300, dur: 0.26 });
      rush({ dur: 0.14, vol: 0.03, f0: 260 });
    },
    lower: () => {
      tone(196, { to: 121, dur: 0.26 });
      rush({ dur: 0.14, vol: 0.03, f0: 220 });
    },
    level: () => {
      tone(220, { to: 165, dur: 0.3 });
      rush({ dur: 0.22, vol: 0.035, f0: 320, f1: 180 });
    },
    rally: () => {
      tone(880, { dur: 0.6, vol: 0.025 });
      tone(1320, { dur: 0.45, vol: 0.012, delay: 0.02 });
    },
    swamp: () => {
      for (let i = 0; i < 6; i++) tone(170 + Math.random() * 170, { to: 260 + Math.random() * 200, dur: 0.12, vol: 0.03, delay: i * 0.08 });
    },
    quake: () => {
      rush({ dur: 1.4, vol: 0.12, f0: 150, f1: 70, attack: 0.08 });
      tone(46, { to: 38, dur: 1.2, vol: 0.06, type: 'triangle' });
    },
    knight: () => {
      tone(196, { dur: 0.42, vol: 0.022, type: 'sawtooth' });
      tone(294, { dur: 0.42, vol: 0.018, type: 'sawtooth' });
      tone(392, { dur: 0.5, vol: 0.02, type: 'triangle', delay: 0.18 });
    },
    volcano: () => {
      rush({ dur: 1.6, vol: 0.12, f0: 190, f1: 80, attack: 0.05 });
      rush({ dur: 1.0, vol: 0.04, type: 'bandpass', f0: 1800, f1: 900, q: 1.4, delay: 0.12 });
      tone(55, { to: 41, dur: 1.4, vol: 0.05, type: 'triangle' });
    },
    flood: () => rush({ dur: 1.9, vol: 0.09, f0: 260, f1: 1300, attack: 0.6 }),
    armageddon: () => {
      tone(55, { dur: 3.2, vol: 0.05, type: 'sawtooth', attack: 0.9 });
      tone(82.5, { dur: 3.2, vol: 0.035, type: 'sawtooth', attack: 1.1 });
      rush({ dur: 3, vol: 0.06, f0: 120, f1: 400, attack: 1.2 });
    },
  };

  return {
    get enabled() {
      return enabled;
    },
    /** Turn sound on or off. From a click the context starts at once; at load (start = false) it waits for unlock(). */
    setEnabled(on, start = true) {
      enabled = !!on;
      if (enabled && start && ensure()) ctx.resume?.().catch(() => {});
    },
    /** Called on every click, tap and key press: starts the context the browser held back. */
    unlock() {
      if (!enabled || !ensure()) return;
      if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
    },
    /** Hold sound while the game is paused by the kit's settings panel or a hidden tab. */
    hold(on) {
      if (!ctx) return;
      if (on) ctx.suspend?.().catch(() => {});
      else if (enabled) ctx.resume?.().catch(() => {});
    },
    play(kind) {
      if (!running()) return;
      try {
        sounds[kind]?.();
      } catch {
        /* a sound must never stop the game */
      }
    },
  };
}
