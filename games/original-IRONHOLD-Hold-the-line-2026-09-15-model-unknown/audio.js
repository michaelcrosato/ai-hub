/* IRONHOLD — synthesized sound. Nothing is decoded or downloaded: the context
   starts on the first tap, click or key, and holds while the game is paused. */

const KEY = 'ironhold-sound';

export function createAudio() {
  let ctx = null, master = null, noise = null, lastAudio = 0, held = false;
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === 'off';
  } catch {
    /* private mode: sound stays on */
  }

  function unlock() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        const length = Math.floor(ctx.sampleRate * 0.35);
        noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      } catch {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {});
  }

  const ready = () => !muted && ctx && ctx.state === 'running';

  function tone(type, f0, f1, dur, peak, at = 0) {
    const now = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + dur * 0.8);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + dur + 0.02);
  }
  function burst(rate, cutoff, peak, dur = 0.23, at = 0) {
    const now = ctx.currentTime + at;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    src.playbackRate.value = rate;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + dur + 0.01);
  }

  /** type: the original set (shot, blast, death, destroy, wave, build, ui) plus boss, alarm, win, lose, error. vol: 0..1 (distance falloff). */
  function play(type, vol = 1) {
    if (!ready() || vol <= 0) return;
    const now = ctx.currentTime;
    if ((type === 'shot' || type === 'enemyShot') && now - lastAudio < 0.06) return;
    lastAudio = now;
    switch (type) {
      case 'shot':
        return burst(3.5, 2200, 0.018 * vol);
      case 'death':
        return burst(2, 700, 0.012 * vol);
      case 'unitDeath':
        return burst(1.6, 900, 0.014 * vol);
      case 'blast':
      case 'destroy':
        return burst(0.55, 700, 0.065 * vol);
      case 'wave':
        return tone('sawtooth', 160, 85, 0.22, 0.025 * vol);
      case 'build':
        return tone('sine', 540, 420, 0.22, 0.018 * vol);
      case 'boss':
        tone('sawtooth', 96, 52, 1.1, 0.05 * vol);
        tone('sawtooth', 144, 78, 1.1, 0.025 * vol, 0.05);
        return burst(0.35, 400, 0.06 * vol, 0.9);
      case 'alarm':
        tone('square', 660, 640, 0.14, 0.012 * vol);
        return tone('square', 520, 500, 0.14, 0.012 * vol, 0.17);
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f * 0.99, 0.5, 0.03 * vol, i * 0.13));
        return;
      case 'lose':
        tone('sawtooth', 300, 70, 1.4, 0.035 * vol);
        return burst(0.4, 500, 0.05 * vol, 1);
      case 'error':
        return tone('sine', 230, 170, 0.12, 0.016 * vol);
      default:
        return tone('sine', 800, 420, 0.22, 0.018 * vol);
    }
  }

  return {
    unlock,
    play,
    get muted() {
      return muted;
    },
    setMuted(on) {
      muted = !!on;
      try {
        localStorage.setItem(KEY, muted ? 'off' : 'on');
      } catch {
        /* nothing to remember with */
      }
    },
    /** Pause (true) or resume (false) everything, e.g. while the game is paused or hidden. */
    hold(on) {
      held = !!on;
      if (!ctx) return;
      if (held) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    },
  };
}
