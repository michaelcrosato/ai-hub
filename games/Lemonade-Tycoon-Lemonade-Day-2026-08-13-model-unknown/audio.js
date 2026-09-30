/**
 * audio.js — small synthesized cues (no files to download). The context is
 * created on the first real gesture (pointer, key or touch), so it is allowed
 * to start, and is suspended while the game is paused or hidden.
 */

const CUES = {
  click: { wave: 'sine', notes: [440], gain: 0.08 },
  open: { wave: 'triangle', notes: [330, 440], gain: 0.08 },
  sale: { wave: 'triangle', notes: [660, 880], gain: 0.08 },
  goal: { wave: 'triangle', notes: [523, 659, 784], gain: 0.08 },
  upgrade: { wave: 'triangle', notes: [392, 523], gain: 0.08 },
  // New cues: a coin tick while cups sell, the noon-rush alert and a finale fanfare.
  coin: { wave: 'square', notes: [1320, 1760], gain: 0.025, step: 0.045 },
  rush: { wave: 'sawtooth', notes: [523, 392, 523, 392], gain: 0.035, step: 0.09 },
  fanfare: { wave: 'triangle', notes: [523, 659, 784, 1047], gain: 0.09, step: 0.11 },
  nav: { wave: 'sine', notes: [620], gain: 0.03, step: 0.03 },
};

export function createAudio(getSettings) {
  let ctx = null;
  let master = null;
  let paused = false;

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const unlock = () => {
    const s = getSettings();
    if (!s.sound) return;
    const c = ensure();
    if (c && c.state === 'suspended' && !paused) c.resume().catch(() => {});
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });

  function play(name) {
    const s = getSettings();
    if (!s.sound || s.volume <= 0 || paused) return;
    const cue = CUES[name] || CUES.click;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume().catch(() => {});
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime;
      const step = cue.step ?? 0.08;
      osc.type = cue.wave;
      osc.frequency.setValueAtTime(cue.notes[0], t);
      cue.notes.slice(1).forEach((f, i) => osc.frequency.setValueAtTime(f, t + (i + 1) * step));
      gain.gain.setValueAtTime(Math.max(0.001, s.volume * cue.gain), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1 + cue.notes.length * step);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.12 + cue.notes.length * step);
    } catch {
      /* audio is optional */
    }
  }

  return {
    play,
    /** Suspend while the game is paused or the tab is hidden. */
    setPaused(on) {
      paused = on;
      if (!ctx) return;
      if (on) ctx.suspend().catch(() => {});
      else if (getSettings().sound) ctx.resume().catch(() => {});
    },
  };
}
