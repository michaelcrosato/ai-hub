/**
 * audio.js — BITCRASH's synthesised sound: square-wave effects and a 16-step
 * chiptune loop per mission (faster and higher while a boss is up). Nothing
 * is loaded; the AudioContext starts on the first key, click, tap or button.
 */

export function createAudio() {
  const a = { ctx: null, master: null, muted: false, held: false, nextBeat: 0, step: 0 };
  const LEVEL = 0.16;

  function init() {
    if (a.ctx) return;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    try {
      a.ctx = new A();
    } catch {
      return;
    }
    a.master = a.ctx.createGain();
    a.master.gain.value = a.muted ? 0 : LEVEL;
    a.master.connect(a.ctx.destination);
    a.nextBeat = a.ctx.currentTime + 0.05;
  }

  function tone(freq, dur, type, gain, at, slide = 0) {
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(a.master);
    o.start(at);
    o.stop(at + dur + 0.01);
  }

  return {
    /** Create or resume the context; call from any user gesture. */
    unlock() {
      init();
      if (a.ctx && a.ctx.state === 'suspended' && !a.held) a.ctx.resume().catch(() => {});
    },
    get muted() {
      return a.muted;
    },
    setMuted(on) {
      a.muted = !!on;
      if (a.master) a.master.gain.setTargetAtTime(a.muted ? 0 : LEVEL, a.ctx.currentTime, 0.02);
    },
    /** Silence everything while the kit's settings panel (or a hidden tab) holds the game. */
    hold(on) {
      a.held = !!on;
      if (!a.ctx) return;
      if (on) a.ctx.suspend().catch(() => {});
      else a.ctx.resume().catch(() => {});
    },
    beep(freq = 440, dur = 0.06, type = 'square', gain = 0.12, slide = 0) {
      if (!a.ctx || a.muted || a.ctx.state !== 'running') return;
      tone(freq, dur, type, gain, a.ctx.currentTime, slide);
    },
    /** A short rising arpeggio for mission complete. */
    jingle(notes = [523, 659, 784, 1047]) {
      if (!a.ctx || a.muted) return;
      const t = a.ctx.currentTime + 0.02;
      notes.forEach((f, i) => tone(f, 0.16, 'square', 0.07, t + i * 0.11));
    },
    /** Schedule the music a little ahead; call every frame while a run is playing. */
    music(notes, boss) {
      if (!a.ctx || a.muted || a.ctx.state !== 'running') return;
      const now = a.ctx.currentTime;
      // After a pause, pick the beat back up instead of firing every missed note at once.
      if (a.nextBeat < now - 0.1) a.nextBeat = now + 0.05;
      while (a.nextBeat < now + 0.08) {
        const f = notes[a.step % notes.length];
        tone(boss ? f * 1.12 : f, 0.095, 'square', 0.025, a.nextBeat);
        if (a.step % 4 === 0) tone(f / 2, 0.05, 'triangle', 0.035, a.nextBeat);
        a.nextBeat += boss ? 0.105 : 0.13;
        a.step++;
      }
    },
    restartMusic() {
      a.step = 0;
      if (a.ctx) a.nextBeat = a.ctx.currentTime + 0.05;
    },
  };
}
