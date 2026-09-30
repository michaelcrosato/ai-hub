/**
 * audio.js — The Fall Protocol's procedural sound: a low hotel drone, a
 * heartbeat pulse during the mission, and short synthesized cues.
 *
 * The context starts on the first key, click or tap (browsers need a user
 * gesture). One shared noise buffer serves every noise burst, chimes are
 * scheduled on the audio clock (they stop with the context when the game
 * pauses), and the drone only plays while the mission is running.
 */

export function createAudio({ volume = 0.45 } = {}) {
  let ctx = null;
  let master = null;
  let droneGain = null;
  let noiseBuffer = null;
  let level = volume;
  let muted = false;
  let droneOn = false;
  let suspended = false;
  let nextPulse = 0;

  const gainValue = () => (muted ? 0 : level * 0.45);

  const init = () => {
    if (ctx) {
      if (ctx.state === 'suspended' && !suspended) ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      ctx = new Ctx();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = gainValue();
    master.connect(ctx.destination);

    // One second of white noise, reused by every burst.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // The hotel's low drone: three detuned sines under one gain.
    droneGain = ctx.createGain();
    droneGain.gain.value = droneOn ? 1 : 0;
    droneGain.connect(master);
    [48, 72.08, 121].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = [0.045, 0.014, 0.008][i];
      o.connect(g).connect(droneGain);
      o.start();
    });
    if (!suspended) ctx.resume().catch(() => {});
  };

  const ready = () => !!ctx && ctx.state !== 'closed';

  /** A pitched blip; `end` glides the pitch, `delay` schedules it later on the audio clock. */
  const tone = (freq = 440, dur = 0.1, vol = 0.1, type = 'sine', end = 0, delay = 0) => {
    if (!ready()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + dur);
    g.gain.setValueAtTime(Math.max(0.001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  /** A filtered noise burst that fades out linearly over `dur`. */
  const noise = (dur = 0.12, vol = 0.15, cut = 600, delay = 0) => {
    if (!ready()) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noiseBuffer;
    s.loop = dur > 1;
    // A random start point so repeated bursts do not sound identical.
    const offset = Math.random() * Math.max(0, 1 - Math.min(dur, 1));
    f.type = 'lowpass';
    f.frequency.value = cut;
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, offset);
    s.stop(t + dur + 0.02);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  };

  return {
    init,
    get muted() {
      return muted;
    },
    setMuted(on) {
      muted = !!on;
      if (master) master.gain.setTargetAtTime(gainValue(), ctx.currentTime, 0.06);
    },
    setVolume(v) {
      level = Math.max(0, Math.min(1, v));
      if (master) master.gain.setTargetAtTime(gainValue(), ctx.currentTime, 0.06);
    },
    /** The drone plays only while the mission runs (not on menus or the pause screen). */
    setDrone(on) {
      droneOn = !!on;
      if (droneGain) droneGain.gain.setTargetAtTime(droneOn ? 1 : 0, ctx.currentTime, 0.25);
    },
    /** The kit's settings panel and hidden tabs stop the whole context. */
    suspend(on) {
      suspended = !!on;
      if (!ctx) return;
      if (suspended) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    },
    tone,
    noise,
    hit() {
      noise(0.12, 0.38, 850);
      tone(105, 0.17, 0.25, 'triangle', 38);
    },
    step() {
      noise(0.05, 0.08, 240);
      tone(70, 0.08, 0.09, 'sine', 40);
    },
    click() {
      tone(640, 0.06, 0.08, 'sine', 350);
    },
    success() {
      tone(523, 0.2, 0.12);
      tone(659, 0.2, 0.1, 'sine', 0, 0.1);
      tone(784, 0.4, 0.1, 'sine', 0, 0.2);
    },
    tick() {
      tone(920, 0.06, 0.07, 'sine');
    },
    alarm() {
      tone(620, 0.34, 0.09, 'square', 310);
      tone(620, 0.34, 0.09, 'square', 310, 0.42);
    },
    /** The heartbeat pulse under the mission: faster while there is a fight. */
    pulse(dt, fighting) {
      if (!ready()) return;
      nextPulse -= dt;
      if (nextPulse <= 0) {
        nextPulse = fighting ? 1.7 : 3.5;
        tone(fighting ? 58 : 48, 0.4, 0.09, 'sine', 35);
      }
    },
  };
}
