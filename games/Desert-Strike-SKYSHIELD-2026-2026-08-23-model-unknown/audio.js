/**
 * audio.js — everything SKYSHIELD plays, synthesised with Web Audio (no files):
 * the original's weapon and alert tones, plus explosions, flares, a rotor loop
 * that follows airspeed, and a small generative score per theater.
 *
 * The context starts on the first key or tap (browsers require a gesture) and
 * is suspended whenever the game pauses, so nothing plays behind a menu.
 */

let ctx = null;
let out = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let held = false; // suspended by the game (pause), not by the browser
const vols = { master: 0.8, music: 0.55, sfx: 0.8 };

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    out = ctx.createGain();
    out.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(out);
    musicBus = ctx.createGain();
    musicBus.connect(out);
    applyVolumes();
  }
  if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {});
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  out.gain.setTargetAtTime(vols.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(vols.sfx, t, 0.05);
  musicBus.gain.setTargetAtTime(vols.music * 0.55, t, 0.05);
}

export function setVolumes({ masterVolume, musicVolume, sfxVolume }) {
  vols.master = masterVolume;
  vols.music = musicVolume;
  vols.sfx = sfxVolume;
  applyVolumes();
}

/** Freeze all sound (pause menus, hidden tab) and bring it back. */
export function holdAudio(on) {
  held = !!on;
  if (!ctx) return;
  if (held) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
}

const live = () => ctx && ctx.state === 'running';

function noise() {
  if (!noiseBuf) {
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const TONES = {
  cannon: [82, 0.028, 'square'],
  rocket: [54, 0.18, 'sawtooth'],
  hit: [130, 0.07, 'triangle'],
  alert: [620, 0.12, 'square'],
  checkpoint: [340, 0.32, 'sine'],
};

function tone(freq, dur, type, gain, t = ctx.currentTime, bend = 0) {
  const g = ctx.createGain();
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
  g.gain.setValueAtTime(Math.max(1e-4, gain), t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function burst({ dur, from, to, gain, type = 'lowpass', q = 0.8, t = ctx.currentTime }) {
  const src = ctx.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/** One-shot sound effects. `level` scales the loudness (the original passed volume multipliers). */
export function sfx(name, level = 1) {
  if (!live() || level <= 0) return;
  const t = ctx.currentTime;
  const base = 0.12 * level;
  switch (name) {
    case 'cannon':
    case 'rocket':
    case 'hit':
    case 'alert':
    case 'checkpoint': {
      const [f, d, type] = TONES[name];
      tone(f, d, type, base, t, name === 'rocket' ? 30 : name === 'checkpoint' ? 680 : 0);
      if (name === 'rocket') burst({ dur: 0.35, from: 2400, to: 300, gain: base * 0.9, type: 'bandpass', q: 0.6, t });
      break;
    }
    case 'boom':
      burst({ dur: 0.75, from: 900, to: 90, gain: base * 2.4, t });
      tone(70, 0.45, 'sine', base * 1.6, t, 34);
      break;
    case 'bigboom':
      burst({ dur: 1.6, from: 700, to: 50, gain: base * 3.2, t });
      tone(52, 1.2, 'sine', base * 2.2, t, 24);
      break;
    case 'flare':
      burst({ dur: 0.55, from: 5200, to: 1800, gain: base * 1.1, type: 'highpass', q: 0.4, t });
      tone(900, 0.08, 'square', base * 0.4, t);
      break;
    case 'lock':
      tone(1180, 0.06, 'square', base * 0.55, t);
      tone(1180, 0.06, 'square', base * 0.55, t + 0.1);
      break;
    case 'service':
      [0, 0.09, 0.18].forEach((d, i) => tone(440 * [1, 1.26, 1.5][i], 0.16, 'triangle', base * 0.8, t + d));
      break;
    case 'warn':
      tone(310, 0.18, 'square', base * 0.5, t, 250);
      break;
    case 'ui':
      tone(1400, 0.03, 'triangle', base * 0.35, t);
      break;
    case 'confirm':
      tone(660, 0.07, 'triangle', base * 0.6, t);
      tone(990, 0.1, 'triangle', base * 0.5, t + 0.06);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------ rotor loop */

let rotor = null;

export function rotorStart() {
  if (!ctx || rotor) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.7;
  const chop = ctx.createGain();
  chop.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 12;
  const depth = ctx.createGain();
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(chop.gain);
  const vol = ctx.createGain();
  vol.gain.value = 0;
  src.connect(lp).connect(chop).connect(vol).connect(sfxBus);
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 46;
  const humLp = ctx.createBiquadFilter();
  humLp.type = 'lowpass';
  humLp.frequency.value = 150;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.35;
  hum.connect(humLp).connect(humGain).connect(vol);
  src.start(t);
  lfo.start(t);
  hum.start(t);
  vol.gain.setTargetAtTime(0.1, t, 0.5);
  rotor = { src, lfo, hum, vol, lp };
}

/** speed01: 0 hover … 1 cruise. */
export function rotorSet(speed01, boost) {
  if (!rotor || !live()) return;
  const t = ctx.currentTime;
  rotor.lfo.frequency.setTargetAtTime(11 + speed01 * 5 + (boost ? 2.5 : 0), t, 0.3);
  rotor.lp.frequency.setTargetAtTime(460 + speed01 * 420 + (boost ? 200 : 0), t, 0.3);
  rotor.hum.frequency.setTargetAtTime(44 + speed01 * 10, t, 0.4);
}

export function rotorStop() {
  if (!rotor || !ctx) return;
  const r = rotor;
  rotor = null;
  const t = ctx.currentTime;
  r.vol.gain.setTargetAtTime(0, t, 0.15);
  for (const n of [r.src, r.lfo, r.hum]) {
    try {
      n.stop(t + 0.8);
    } catch {
      /* already stopped */
    }
  }
}

/* ------------------------------------------------------------ music */

const MOODS = {
  menu: { root: 45, scale: [0, 3, 5, 7, 10], chords: [0, 5, 3, 7], arp: 0.22, bass: 0 },
  desert: { root: 45, scale: [0, 1, 4, 5, 7, 8, 10], chords: [0, 1, 5, 0], arp: 0.45, bass: 1 },
  steppe: { root: 43, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 7], arp: 0.4, bass: 1 },
  megacity: { root: 41, scale: [0, 2, 3, 7, 8], chords: [0, 8, 3, 7], arp: 0.55, bass: 1 },
  arctic: { root: 47, scale: [0, 2, 5, 7, 9], chords: [0, 5, 9, 7], arp: 0.3, bass: 1 },
  archipelago: { root: 50, scale: [0, 2, 4, 7, 9], chords: [0, 9, 5, 7], arp: 0.4, bass: 1 },
};
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

const music = { mood: null, timer: 0, next: 0, step: 0, intensity: 0, seed: 1 };

function rand() {
  music.seed = (Math.imul(music.seed, 1664525) + 1013904223) >>> 0;
  return music.seed / 4294967296;
}

function voice(freq, t, dur, gain, type, cutoff) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  const atk = Math.min(1.2, dur * 0.35);
  g.gain.setValueAtTime(1e-4, t);
  g.gain.exponentialRampToValueAtTime(gain, t + atk);
  g.gain.setTargetAtTime(1e-4, t + dur - atk * 0.5, dur * 0.18);
  o.connect(f).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 1.2);
}

const STEP = 60 / 96 / 2; // eighth notes at 96 BPM

function schedule() {
  if (!music.mood || !live()) return;
  const m = MOODS[music.mood];
  const horizon = ctx.currentTime + 0.35;
  if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
  while (music.next < horizon) {
    const t = music.next;
    const s = music.step;
    const bar = Math.floor(s / 8);
    const chordRoot = m.root + m.chords[Math.floor(bar / 2) % m.chords.length];
    if (s % 16 === 0) {
      // A new pad chord every two bars.
      const dur = STEP * 16;
      for (const iv of [0, 7, 12 + (m.scale[2] || 3)]) {
        voice(midi(chordRoot + iv), t, dur, 0.035, 'sawtooth', 620);
        voice(midi(chordRoot + iv) * 1.004, t, dur, 0.02, 'sawtooth', 520);
      }
    }
    const heat = music.mood === 'menu' ? 0 : music.intensity;
    if (m.bass && s % 2 === 0 && (heat > 0.15 || s % 8 === 0)) {
      voice(midi(chordRoot - 12), t, STEP * 1.6, 0.05 + heat * 0.05, 'triangle', 400);
    }
    if (rand() < m.arp + heat * 0.35) {
      const deg = m.scale[Math.floor(rand() * m.scale.length)];
      voice(midi(chordRoot + 12 + deg + (rand() < 0.3 ? 12 : 0)), t, STEP * 1.8, 0.022 + heat * 0.012, 'triangle', 2400);
    }
    if (heat > 0.45 && s % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.02 * heat, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.05);
      src.connect(f).connect(g).connect(musicBus);
      src.start(t, rand() * 0.5);
      src.stop(t + 0.08);
    }
    music.step += 1;
    music.next += STEP;
  }
}

/** Start (or switch) the score: 'menu' or a biome name. */
export function playMusic(mood) {
  if (!MOODS[mood]) mood = 'menu';
  if (music.mood === mood) return;
  music.mood = mood;
  music.step = 0;
  music.seed = mood.length * 7919 + 17;
  music.next = 0;
  if (!music.timer) music.timer = setInterval(schedule, 110);
}

export function stopMusic() {
  music.mood = null;
  if (music.timer) clearInterval(music.timer);
  music.timer = 0;
}

/** 0 calm … 1 heavy combat: thickens bass, arpeggio and hats. */
export function setMusicIntensity(v) {
  music.intensity += (Math.max(0, Math.min(1, v)) - music.intensity) * 0.08;
}
