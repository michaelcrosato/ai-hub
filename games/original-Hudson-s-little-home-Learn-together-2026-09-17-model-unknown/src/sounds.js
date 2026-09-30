/**
 * sounds.js — three soft, quiet chimes, made on the fly (no files to load):
 * a pop when a thing opens, a little two-note chime the first time a word is
 * found, and a gentle rising tune when every word in a room has been found.
 *
 * The audio context starts on the first tap or key press (browsers only allow
 * sound after a gesture) and is suspended while play is paused.
 */

export function createSounds({ enabled }) {
  let ctx = null;
  let master = null;

  const ensure = () => {
    if (ctx) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const unlock = () => {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock);

  function tone(freq, start, duration, gain, slideTo = 0) {
    const c = ctx;
    if (!c || c.state !== 'running') return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  return {
    unlock,
    /** A thing opens. */
    pop() {
      if (enabled()) tone(520, 0, 0.16, 0.08, 760);
    },
    /** A word found for the first time. */
    found() {
      if (!enabled()) return;
      tone(784, 0, 0.26, 0.06);
      tone(1046, 0.1, 0.34, 0.05);
    },
    /** Every word in a room found. */
    celebrate() {
      if (!enabled()) return;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.45, 0.055));
    },
    pause(on) {
      if (!ctx) return;
      (on ? ctx.suspend() : ctx.resume()).catch(() => {});
    },
  };
}
