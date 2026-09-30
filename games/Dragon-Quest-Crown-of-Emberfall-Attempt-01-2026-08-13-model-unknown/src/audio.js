// A tiny generative chiptune orchestra: square-wave cues and a looping theme
// per area, scheduled ahead on the AudioContext clock (steady even when frames
// hitch). The context is created on the first gesture and suspended whenever
// the game pauses or the tab is hidden.

const N = (semitone) => 261.63 * 2 ** (semitone / 12); // semitones from middle C

// Each theme: step length in seconds, lead line (0 = rest) and an optional bass line.
const THEMES = {
  // The original's town motif, note for note.
  town: { step: 0.52, wave: 'triangle', lead: [262, 330, 392, 523, 392, 330, 294, 392], dur: 0.34 },
  world: {
    step: 0.36,
    wave: 'triangle',
    lead: [N(7), N(9), N(11), N(14), N(11), N(9), N(7), N(4), N(5), N(7), N(9), N(12), N(9), N(7), N(5), N(4)],
    bass: [N(-17), 0, N(-12), 0, N(-15), 0, N(-12), 0, N(-19), 0, N(-14), 0, N(-17), 0, N(-12), 0],
    dur: 0.28,
  },
  dungeon: {
    step: 0.6,
    wave: 'triangle',
    lead: [N(-3), N(0), N(-1), N(-5), N(-3), N(2), N(0), N(-1)],
    bass: [N(-15), 0, N(-15), 0, N(-17), 0, N(-20), 0],
    dur: 0.46,
    gain: 0.8,
  },
  belfry: {
    step: 0.7,
    wave: 'triangle',
    lead: [N(-1), 0, N(2), N(1), N(-1), 0, N(-4), N(-2)],
    bass: [N(-13), 0, 0, 0, N(-18), 0, 0, 0],
    dur: 0.6,
    gain: 0.75,
  },
  battle: {
    step: 0.18,
    wave: 'square',
    lead: [N(4), N(7), N(11), N(7), N(4), N(7), N(14), N(11), N(2), N(5), N(9), N(5), N(2), N(5), N(12), N(9)],
    bass: [N(-8), N(-8), 0, N(-8), N(-10), N(-10), 0, N(-10), N(-10), N(-10), 0, N(-10), N(-12), N(-12), 0, N(-12)],
    dur: 0.12,
    gain: 0.55,
  },
  boss: {
    step: 0.2,
    wave: 'square',
    lead: [N(-3), N(-2), N(2), N(4), N(2), N(-2), N(-3), N(-5), N(-3), N(0), N(3), N(7), N(3), N(0), N(-1), N(-5)],
    bass: [N(-15), 0, N(-15), N(-15), N(-14), 0, N(-14), N(-14), N(-15), 0, N(-15), N(-15), N(-17), 0, N(-17), N(-20)],
    dur: 0.14,
    gain: 0.55,
  },
  ending: { step: 0.6, wave: 'triangle', lead: [523, 659, 784, 1046, 784, 659, 587, 784], bass: [N(-12), 0, N(-8), 0, N(-10), 0, N(-5), 0], dur: 0.5 },
};

export function createAudio(getSettings) {
  let ctx = null;
  let out = null;
  let theme = null;
  let themeName = 'none';
  let index = 0;
  let nextTime = 0;
  let paused = false;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch {
        return null;
      }
      out = ctx.createGain();
      out.gain.value = 1;
      out.connect(ctx.destination);
    }
    return ctx;
  };

  const tone = (freq, dur, { wave = 'square', vol = 0.055, at = 0, slide = 0 } = {}) => {
    if (!ctx || !freq) return;
    const t = at || ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const api = {
    /** Call from a user gesture (any key, tap or click). */
    unlock() {
      if (!ensure()) return;
      if (!paused && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get ready() {
      return !!ctx && ctx.state === 'running';
    },
    /** One square-wave cue, like the original's Q(freq, duration). */
    sfx(freq = 440, dur = 0.07, opts) {
      if (!getSettings().sfx || !ctx || paused) return;
      tone(freq, dur, opts);
    },
    /** A short rising arpeggio. */
    jingle(notes, step = 0.09, dur = 0.16, wave = 'square') {
      if (!getSettings().sfx || !ctx || paused) return;
      const t = ctx.currentTime;
      notes.forEach((f, i) => tone(f, dur, { wave, vol: 0.05, at: t + i * step }));
    },
    setTheme(name) {
      if (name === themeName) return;
      themeName = name;
      theme = THEMES[name] || null;
      index = 0;
      if (ctx) nextTime = ctx.currentTime + 0.08;
    },
    /** Schedule the next few notes; called every frame. */
    update() {
      if (!ctx || paused || !theme || !getSettings().music || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (nextTime < now - 0.05) nextTime = now + 0.02; // back from a stall: no burst of catch-up notes
      const gain = theme.gain ?? 1;
      while (nextTime < now + 0.18) {
        const i = index % theme.lead.length;
        tone(theme.lead[i], theme.dur, { wave: theme.wave, vol: 0.025 * gain, at: nextTime });
        const b = theme.bass?.[i % theme.bass.length];
        if (b) tone(b, theme.dur * 1.4, { wave: 'triangle', vol: 0.03 * gain, at: nextTime });
        index += 1;
        nextTime += theme.step;
      }
    },
    pause(on) {
      paused = !!on;
      if (!ctx) return;
      if (paused) ctx.suspend().catch(() => {});
      else {
        ctx.resume().catch(() => {});
        nextTime = ctx.currentTime + 0.05;
      }
    },
  };
  return api;
}
