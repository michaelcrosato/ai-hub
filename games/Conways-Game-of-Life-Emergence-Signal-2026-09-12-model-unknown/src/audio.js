/**
 * audio.js — the campaign's small synthesized cues. The context is created
 * and resumed on the first user gesture (browsers keep audio locked until
 * then), and suspended while the game is paused.
 */

const CUES = {
  success: [440, 554, 660, 880],
  failure: [180, 120],
  receiver: [659, 880],
  launch: [220, 440],
  remove: [220],
  place: [520],
  select: [620],
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = false;
  let suspended = false;

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };

  // Unlock on the first real gesture, so a cue fired later from the game loop
  // (a receiver lighting up during a run) is not swallowed by a locked context.
  const unlock = () => {
    if (!enabled) return;
    const c = ensure();
    if (c && c.state === 'suspended' && !suspended) c.resume().catch(() => {});
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = !!on;
      if (enabled) unlock();
    },
    /** Pause audio with the game (the kit's settings panel, a hidden tab). */
    suspend(on) {
      suspended = !!on;
      if (!ctx) return;
      if (on) ctx.suspend().catch(() => {});
      else if (enabled) ctx.resume().catch(() => {});
    },
    play(type) {
      if (!enabled || suspended) return;
      const c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
      const notes = CUES[type] || CUES.place;
      const t = c.currentTime + 0.01;
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const at = t + i * 0.08;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.045, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
        osc.connect(gain);
        gain.connect(master);
        osc.start(at);
        osc.stop(at + 0.2);
      });
    },
  };
}
