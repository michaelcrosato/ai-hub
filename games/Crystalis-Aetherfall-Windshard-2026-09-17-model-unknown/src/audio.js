// audio.js — small procedural sound for Aetherfall: one-shot synth effects and a wind bed.
// Nothing is decoded or downloaded; the context starts on the first gesture (unlockAudio).

let ctx = null;
let master = null;
let fx = null;
let windGain = null;
let windFilter = null;
let windStarted = false;
let noise = null;
let windTarget = 0;

function noiseBuffer() {
  if (noise) return noise;
  const len = Math.floor(ctx.sampleRate * 2);
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  // Brown-ish noise: softer than white, reads as air rather than hiss.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.2;
  }
  return noise;
}

/** Create or resume the context. Call from any user gesture; safe to call often. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      fx = ctx.createGain();
      fx.gain.value = 1;
      fx.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    /* audio is optional */
  }
}

const running = () => !!ctx && ctx.state === 'running';

function startWind() {
  if (windStarted || !ctx) return;
  windStarted = true;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 520;
  windFilter.Q.value = 0.8;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  // A slow LFO on the filter makes the wind rise and fall.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 260;
  lfo.connect(lfoDepth).connect(windFilter.frequency);
  src.connect(windFilter).connect(windGain).connect(master);
  src.start();
  lfo.start();
}

/** Wind bed level 0..1 (0 = silent). Ramped, so it can be called every frame cheaply. */
export function setAmbience(level) {
  if (!ctx) return;
  if (level > 0) startWind();
  if (!windGain || Math.abs(level - windTarget) < 0.01) return;
  windTarget = level;
  const t = ctx.currentTime;
  windGain.gain.cancelScheduledValues(t);
  windGain.gain.setTargetAtTime(0.05 * level, t, 0.6);
}

/** Suspend everything (settings menu open, tab hidden) and bring it back. */
export function suspendAudio(on) {
  if (!ctx) return;
  if (on && ctx.state === 'running') ctx.suspend().catch(() => {});
  else if (!on && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(type, f0, f1, dur, vol = 0.055, delay = 0, rise = false) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (rise) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  else o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(fx);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function thump(freq, dur, vol = 0.12) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.3), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(fx);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.02);
}

function bell(freq, dur = 1.8, vol = 0.05) {
  // Inharmonic partials give a struck-metal ring.
  for (const [ratio, v] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [0.5, 0.35]]) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(vol * v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur / Math.sqrt(ratio));
    o.connect(g).connect(fx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** One-shot effects. Silent until the context runs. */
export function sfx(kind, arg = 0) {
  if (!running()) return;
  switch (kind) {
    case 'slash': tone('sawtooth', 360 + Math.random() * 40, 230, 0.06); break;
    case 'hit': tone('square', 120, 78, 0.05); thump(900, 0.06, 0.05); break;
    case 'charge': tone('triangle', 680, 440, 0.16); tone('sine', 1360, 900, 0.12, 0.03); break;
    case 'ready': tone('sine', 880, 1320, 0.09, 0.04, 0, true); break;
    case 'hurt': tone('sawtooth', 90, 58, 0.16, 0.07); break;
    case 'pickup': tone('triangle', 720, 1100, 0.09, 0.05, 0, true); break;
    case 'heal': tone('sine', 520, 780, 0.14, 0.05, 0, true); tone('sine', 780, 1040, 0.14, 0.04, 0.08, true); break;
    case 'upgrade':
    case 'level': tone('triangle', 520, 936, 0.28, 0.055, 0, true); tone('sine', 780, 1400, 0.3, 0.03, 0.06, true); break;
    case 'break': tone('square', 70, 45, 0.24, 0.06); thump(1400, 0.5, 0.16); break;
    case 'gust': tone('triangle', 180, 117, 0.12); break;
    case 'spit': tone('triangle', 250, 162, 0.06); break;
    case 'dash': tone('triangle', 440, 286, 0.045); thump(2200, 0.12, 0.05); break;
    case 'chime': tone('triangle', 600, 1080, 0.34, 0.055, 0, true); bell(660, 1.4, 0.03); break;
    case 'bell': bell(arg || 523, 2.2, 0.06); break;
    case 'dull': tone('square', 150, 90, 0.08, 0.05); break;
    case 'burrow': thump(420, 0.3, 0.1); break;
    case 'surface': thump(800, 0.18, 0.1); tone('square', 110, 70, 0.08, 0.035); break;
    case 'vault': bell(392, 2.6, 0.05); bell(523, 2.6, 0.04); thump(600, 0.6, 0.12); break;
    case 'boss': tone('sawtooth', 70, 40, 0.8, 0.07); thump(500, 0.9, 0.16); break;
    case 'lunge': tone('sawtooth', 140, 60, 0.3, 0.05); break;
    case 'menu': tone('sine', 660, 700, 0.03, 0.025); break;
    default: tone('triangle', 220, 143, 0.09);
  }
}
