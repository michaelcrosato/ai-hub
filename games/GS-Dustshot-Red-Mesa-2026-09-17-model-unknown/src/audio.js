/**
 * audio.js — Dustshot's procedural sound: Web Audio oscillators and one shared
 * noise buffer, no files. The context is created on the first Start/Continue
 * press (a user gesture), music is scheduled ahead on the audio clock so it
 * keeps time, and everything freezes with ctx.suspend() while the game pauses.
 */

const THEMES = {
  // The original Cinder Creek loop.
  town: { step: 0.31, lead: [146.83, 174.61, 196.0, 174.61, 130.81, 164.81, 196.0, 164.81], bass: [73.42, 73.42, 65.41, 65.41, 82.41, 82.41, 65.41, 65.41], wave: 'square', drum: 4 },
  // Red Mesa Pass: a brighter, galloping minor figure.
  canyon: { step: 0.27, lead: [164.81, 196.0, 220.0, 246.94, 220.0, 196.0, 174.61, 196.0, 164.81, 220.0, 261.63, 246.94, 220.0, 196.0, 174.61, 164.81], bass: [82.41, 82.41, 73.42, 73.42, 87.31, 87.31, 98.0, 98.0], wave: 'square', drum: 2 },
  // Boss fights: faster, with a chromatic push.
  boss: { step: 0.2, lead: [146.83, 155.56, 146.83, 220.0, 207.65, 146.83, 155.56, 174.61], bass: [73.42, 73.42, 73.42, 77.78, 73.42, 73.42, 69.3, 69.3], wave: 'sawtooth', drum: 2 },
};

const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export function createAudioSystem() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = safeGet('dustshot-sound') !== 'off';
  let suspended = false;
  let theme = null;
  let step = 0;
  let nextAt = 0;
  let timer = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.28 : 0;
    master.connect(ctx.destination);
    // One second of white noise, played from random offsets (no buffer per shot).
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /** Call from a click or key handler: creates or resumes the context. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended' && !suspended) c.resume().catch(() => {});
  }

  const live = () => enabled && ctx && ctx.state === 'running';

  function tone(freq, dur = 0.08, type = 'square', gain = 0.05, glide = 0, delay = 0) {
    if (!live()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur = 0.05, gain = 0.05, low = 250, high = 5000, delay = 0) {
    if (!live()) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) * 0.5;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t, Math.random() * Math.max(0, 1 - dur - 0.01), dur + 0.01);
  }

  const arpeggio = (notes, gap, dur, type, gain) => notes.forEach((n, i) => tone(n, dur, type, gain, 0, i * gap));

  /** Schedule music a little ahead on the audio clock (steady even when frames hitch). */
  function schedule() {
    if (!ctx || !theme) return;
    if (ctx.state !== 'running') return;
    const th = THEMES[theme];
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.03;
    while (nextAt < ctx.currentTime + 0.25) {
      if (enabled) {
        const delay = nextAt - ctx.currentTime;
        tone(th.lead[step % th.lead.length], 0.07, th.wave, theme === 'boss' ? 0.016 : 0.022, 0, delay);
        if (step % 2 === 0) tone(th.bass[step % th.bass.length], 0.12, 'triangle', 0.028, 0, delay);
        if (step % th.drum === th.drum - 2) noise(0.025, 0.018, 500, 2200, delay);
      }
      nextAt += th.step;
      step++;
    }
  }

  function music(name) {
    if (theme === name) return;
    theme = name;
    step = 0;
    if (ctx) nextAt = ctx.currentTime + 0.05;
    if (name && !timer) timer = setInterval(schedule, 80);
    if (!name && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function handle(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'playerShot': noise(0.026, 0.035, 900, 4200); tone(360, 0.04, 'square', 0.022, -120); break;
        case 'enemyShot': tone(170, 0.055, 'square', 0.03, -60); break;
        case 'bossShot':
          if (ev.gatling) {
            noise(0.03, 0.04, 600, 2600);
            tone(130, 0.05, 'square', 0.03, -40);
          } else tone(105, 0.09, 'sawtooth', 0.05, -45);
          break;
        case 'bossWindup': tone(60, 0.32, 'sawtooth', 0.04, 90); break;
        case 'hit':
        case 'woodHit': noise(0.035, 0.028, 450, 3100); break;
        case 'playerHit': noise(0.09, 0.06, 100, 1500); tone(82, 0.13, 'sawtooth', 0.055, -30); break;
        case 'enemyDown': tone(104, 0.12, 'triangle', 0.04, -45); break;
        case 'crateBreak': noise(0.08, 0.04, 200, 1400); break;
        case 'pickup': tone(440, 0.07, 'square', 0.035); tone(660, 0.08, 'square', 0.03, 0, 0.055); break;
        case 'equipment': tone(392, 0.08, 'triangle', 0.04); tone(523.25, 0.1, 'triangle', 0.04, 0, 0.07); break;
        case 'posterFound': arpeggio([293.66, 369.99, 440], 0.09, 0.18, 'triangle', 0.05); break;
        case 'levelUp': arpeggio([330, 440, 554.37], 0.06, 0.12, 'square', 0.035); break;
        case 'upgrade': arpeggio([220, 330, 440], 0.065, 0.11, 'triangle', 0.04); break;
        case 'bossIntro':
        case 'bossEnrage': tone(73.42, 0.35, 'sawtooth', 0.06, -20); tone(98, 0.3, 'square', 0.035, 0, 0.16); break;
        case 'bossDown': arpeggio([196, 246.94, 293.66, 392], 0.11, 0.3, 'triangle', 0.055); break;
        case 'defeat': tone(98, 0.55, 'sawtooth', 0.05, -55); break;
        case 'dynamiteThrow': tone(900, 0.12, 'triangle', 0.012, 500); break;
        case 'explosion': noise(0.42, 0.11, 60, 900); tone(58, 0.4, 'sine', 0.09, -28); break;
        case 'riderCharge': noise(0.18, 0.03, 120, 700); break;
        case 'gateDenied': tone(140, 0.16, 'square', 0.03, -30); break;
        default: break;
      }
    }
  }

  function setEnabled(v) {
    enabled = !!v;
    safeSet('dustshot-sound', enabled ? 'on' : 'off');
    if (master) master.gain.value = enabled ? 0.28 : 0;
  }

  /** Freeze everything (pause menu, settings panel, hidden tab) and pick up where it left off. */
  function setSuspended(v) {
    suspended = !!v;
    if (!ctx) return;
    if (suspended && ctx.state === 'running') ctx.suspend().catch(() => {});
    else if (!suspended && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  return {
    unlock,
    handle,
    music,
    setEnabled,
    setSuspended,
    get enabled() {
      return enabled;
    },
  };
}
