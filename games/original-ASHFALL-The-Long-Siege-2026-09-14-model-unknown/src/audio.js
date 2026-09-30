/* ASHFALL — synthesized sound. Nothing is downloaded: every effect is a short oscillator
   sweep, as in the original. The context starts on the first tap, click or key (browsers
   only allow audio after a gesture) and is suspended while the game is paused by the kit. */

export function createAudio(startEnabled = true) {
  let ctx = null, master = null, enabled = startEnabled, held = false;

  function unlock() {
    if (!enabled) return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.12;
        master.connect(ctx.destination);
      } catch {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {});
  }

  function tone(f = 180, len = 0.09, vol = 0.4, type = 'sawtooth', end = 55, delay = 0) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + len);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  return {
    unlock,
    tone,
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = !!on;
      if (enabled) unlock();
      else if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    /** The kit's settings panel or a hidden tab: hold the sound, then pick it up again. */
    hold(on) {
      held = !!on;
      if (!ctx) return;
      if (held && ctx.state === 'running') ctx.suspend().catch(() => {});
      if (!held && enabled && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    // The original's sounds.
    shot: (hero) => tone(hero === 1 ? 160 : 220, 0.055, 0.11, 'sawtooth', 60),
    blast: () => tone(90, 0.4, 0.7, 'sawtooth', 18),
    capture: () => tone(520, 0.24, 0.5, 'sine', 860),
    wave: () => tone(130, 0.4, 0.5, 'triangle', 90),
    breach: () => tone(400, 0.6, 0.7, 'sine', 130),
    // Added feedback.
    tick: () => tone(660, 0.03, 0.08, 'square', 600),
    order: () => tone(340, 0.06, 0.12, 'triangle', 420),
    deny: () => tone(150, 0.12, 0.2, 'square', 110),
    skill(slot) {
      if (slot === 3) tone(260, 0.16, 0.2, 'triangle', 520);
      else if (slot === 1) tone(420, 0.3, 0.25, 'sine', 700);
      else if (slot === 2) tone(900, 0.5, 0.25, 'sine', 240);
      else tone(300, 0.12, 0.25, 'square', 180);
    },
    fuse() {
      tone(1200, 0.05, 0.12, 'square', 1150);
      tone(1200, 0.05, 0.12, 'square', 1150, 0.18);
    },
    lob: () => tone(1500, 0.9, 0.06, 'sine', 380),
    down: () => tone(240, 0.7, 0.45, 'sawtooth', 40),
    back: () => tone(360, 0.25, 0.3, 'sine', 620),
    pickup: () => tone(700, 0.12, 0.25, 'sine', 1100),
    level: () => {
      tone(520, 0.14, 0.3, 'triangle', 700);
      tone(700, 0.2, 0.3, 'triangle', 980, 0.12);
    },
    victory: () => {
      tone(330, 0.5, 0.45, 'triangle', 330);
      tone(440, 0.5, 0.4, 'triangle', 440, 0.2);
      tone(660, 0.9, 0.4, 'triangle', 660, 0.4);
    },
    defeat: () => {
      tone(300, 0.7, 0.45, 'triangle', 200);
      tone(200, 1.1, 0.45, 'triangle', 90, 0.35);
    },
  };
}
