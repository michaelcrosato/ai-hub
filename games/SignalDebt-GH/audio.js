// Original Signal Debt compositions and sound design, synthesized by Pixel Engine.
// No audio recordings or borrowed melodies. Options use ctx.engine.audio volumes.
import { parseSong } from './pixel-engine.js';

const tracks = {
  bass: { wave: 'triangle', attack: 0.025, decay: 0.24, volume: 0.11 },
  glass: { wave: 'sine', attack: 0.018, decay: 0.42, volume: 0.065, vibrato: { depth: 0.08, rate: 4 } },
  pad: { wave: 'triangle', attack: 0.16, decay: 0.8, volume: 0.045 },
  tick: { wave: 'noise', attack: 0.003, decay: 0.035, volume: 0.026 },
};

const harbor = {
  a: { bass: 'D2 - . . . . A2 . D2 - . . . . C3 .', glass: '. . A4 - . . . . F4 - E4 . . . D4 -', pad: 'F3 - - - - - - - A3 - - - - - - -', tick: '. . . . C8 . . . . . . . C8 . . .' },
  b: { bass: 'Bb1 - . . . . F2 . Bb1 - . . . . A2 .', glass: '. . D4 - . . F4 . . . C5 - . . A4 .', pad: 'F3 - - - - - - - D3 - - - - - - -', tick: '. . . . C8 . . . . . . . C8 . . .' },
  c: { bass: 'G2 - . . . . D3 . G2 - . . . . F2 .', glass: 'Bb4 - A4 . . . G4 - . . D4 . . . F4 .', pad: 'Bb3 - - - - - - - D4 - - - - - - -', tick: '. . . . C8 . . . . . . . C8 . . .' },
  d: { bass: 'A1 - . . . . E2 . A1 - . . G2 . E2 .', glass: '. . E4 - . . G4 . A4 - . . . . E4 .', pad: 'C4 - - - - - - - E4 - - - - - - -', tick: '. . . . C8 . . . . . . . C8 . . .' },
};
const avenue = {
  a: { bass: 'D2 . D3 . . A2 . D3 D2 . . A2 C3 . A2 .', glass: 'A4 . . F4 . E4 . . D4 . F4 . . A4 . .', pad: 'F3 - - - - - - - A3 - - - - - - -', tick: 'C8 . C8 . C6 . C8 . C8 . C8 . C6 . C8 .' },
  b: { bass: 'Bb1 . Bb2 . . F2 . Bb2 Bb1 . . F2 A2 . F2 .', glass: 'D4 . . F4 . A4 . . C5 . A4 . . F4 . .', pad: 'F3 - - - - - - - D4 - - - - - - -', tick: 'C8 . C8 . C6 . C8 . C8 . C8 . C6 . C8 .' },
  c: { bass: 'G2 . G3 . . D3 . G3 G2 . . D3 F3 . D3 .', glass: 'Bb4 . A4 . . G4 . . D4 . . F4 . G4 . .', pad: 'Bb3 - - - - - - - D4 - - - - - - -', tick: 'C8 . C8 . C6 . C8 . C8 . C8 . C6 . C8 .' },
  d: { bass: 'A1 . A2 . . E2 . A2 A1 . . E2 G2 . E2 .', glass: '. E4 . G4 A4 . . C5 . A4 . . G4 . E4 .', pad: 'C4 - - - - - - - E4 - - - - - - -', tick: 'C8 . C8 . C6 . C8 . C8 . C8 . C6 . C8 C8' },
};
const pursuit = {
  a: { bass: 'D2 D2 . D2 A2 . D3 . D2 D2 . C3 A2 . F2 .', glass: 'D5 . A4 . D5 . F5 . E5 . D5 . C5 . A4 .', pad: 'F3 - - - - - - - A3 - - - - - - -', tick: 'C8 . C8 C8 C6 . C8 . C8 C8 . C8 C6 . C8 .' },
  b: { bass: 'Bb1 Bb1 . Bb1 F2 . Bb2 . Bb1 Bb1 . A2 F2 . D2 .', glass: 'D5 . F5 . C5 . D5 . A4 . C5 . D5 . F5 .', pad: 'D4 - - - - - - - F4 - - - - - - -', tick: 'C8 . C8 C8 C6 . C8 . C8 C8 . C8 C6 . C8 .' },
  c: { bass: 'G2 G2 . G2 D3 . G3 . G2 G2 . F3 D3 . Bb2 .', glass: 'G5 . D5 . Bb4 . D5 . F5 . D5 . Bb4 . A4 .', pad: 'Bb3 - - - - - - - D4 - - - - - - -', tick: 'C8 . C8 C8 C6 . C8 . C8 C8 . C8 C6 . C8 .' },
  d: { bass: 'A1 A1 . A1 E2 . A2 . A1 A1 . G2 E2 . A2 .', glass: 'E5 . C5 . A4 . E5 . G5 . E5 . C5 . A4 .', pad: 'C4 - - - - - - - E4 - - - - - - -', tick: 'C8 . C8 C8 C6 . C8 . C8 C8 . C8 C6 C8 C8 C8' },
};

export const CITY_SONGS = {
  idle: { bpm: 82, tracks, patterns: harbor, order: ['a', 'b', 'a', 'c', 'b', 'd', 'c', 'd'] },
  driving: { bpm: 106, tracks, patterns: avenue, order: ['a', 'b', 'c', 'd', 'a', 'c', 'b', 'd'] },
  pursuit: { bpm: 132, tracks, patterns: pursuit, order: ['a', 'a', 'b', 'c', 'a', 'b', 'c', 'd'] },
};

export const CITY_SOUNDS = {
  shoot: { wave: 'noise', freq: 7200, freqEnd: 380, attack: 0.002, decay: 0.12, volume: 0.22, layers: [{ wave: 'triangle', freq: 160, freqEnd: 45, decay: 0.08, volume: 0.23 }] },
  punch: { wave: 'noise', freq: 700, freqEnd: 120, decay: 0.09, volume: 0.2, layers: [{ wave: 'sine', freq: 140, freqEnd: 38, decay: 0.1, volume: 0.25 }] },
  hit: { wave: 'noise', freq: 1200, freqEnd: 170, decay: 0.16, volume: 0.2 },
  mission: { wave: 'triangle', freq: 293.66, arp: [0, 7, 10, 14, 19], arpRate: 0.09, attack: 0.005, sustain: 0.28, decay: 0.6, volume: 0.22 },
  interact: { wave: 'sine', freq: 587.33, freqEnd: 880, attack: 0.005, decay: 0.12, volume: 0.12 },
  reload: { wave: 'noise', freq: 4000, attack: 0.002, decay: 0.07, volume: 0.14, layers: [{ wave: 'noise', freq: 1800, delay: 0.17, decay: 0.045, volume: 0.12 }] },
  empty: { wave: 'noise', freq: 2100, decay: 0.026, volume: 0.13 },
  dodge: { wave: 'noise', freq: 500, freqEnd: 1800, attack: 0.01, decay: 0.19, volume: 0.07 },
  crash: { wave: 'noise', freq: 1900, freqEnd: 120, attack: 0.002, decay: 0.28, volume: 0.2, layers: [{ wave: 'sine', freq: 85, freqEnd: 28, decay: 0.27, volume: 0.26 }] },
  repair: { wave: 'triangle', freq: 220, arp: [0, 4, 7, 12], arpRate: 0.055, decay: 0.4, volume: 0.14 },
  fail: { wave: 'triangle', freq: 220, freqEnd: 73.4, attack: 0.04, decay: 0.65, volume: 0.17 },
  scan: { wave: 'sine', freq: 180, freqEnd: 1200, sweepTime: 0.34, attack: 0.03, decay: 0.5, volume: 0.1 },
  engine: { wave: 'saw', freq: 41, attack: 0.03, sustain: 0.37, decay: 0.03, volume: 0.11, layers: [{ wave: 'noise', freq: 240, sustain: 0.4, decay: 0.03, volume: 0.035 }] },
  siren: { wave: 'sine', freq: 490, attack: 0.03, sustain: 0.42, decay: 0.03, volume: 0.08 },
};

export class CityAudio {
  constructor(ctx) {
    this.ctx = ctx;
    this.audio = ctx.audio;
    this.time = 0;
    this.mood = '';
    this.override = null;
    this.disposed = false;
    for (const [name, sound] of Object.entries(CITY_SOUNDS)) this.audio.register(`sd-${name}`, sound);
    // Fail early on malformed note data, before a later music change can throw.
    for (const song of Object.values(CITY_SONGS)) parseSong(song);
    this.engine = this.audio.loop('sd-engine', { volume: 0, muffle: 0.3 });
    this.siren = this.audio.loop('sd-siren', { volume: 0 });
    this.changeSong('idle');
  }
  changeSong(name) {
    if (name === this.mood || this.disposed) return;
    this.mood = name;
    this.audio.playMusic(CITY_SONGS[name], `signal-debt-${name}`);
  }
  setMood(name = 'auto') {
    this.override = Object.hasOwn(CITY_SONGS, name) ? name : null;
    if (this.override) this.changeSong(this.override);
  }
  update(dt, { speed = 0, heat = 0, inVehicle = false } = {}) {
    if (this.disposed) return;
    this.time += dt;
    this.changeSong(this.override ?? (heat > 0 ? 'pursuit' : inVehicle ? 'driving' : 'idle'));
    const throttle = Math.min(1, Math.abs(speed) / 24);
    this.engine.set({ volume: inVehicle ? 0.15 + throttle * 0.32 : 0, pitch: throttle * 23, muffle: 0.35 - throttle * 0.15 });
    this.siren.set({ volume: heat > 0 ? Math.min(0.24, 0.07 + heat * 0.04) : 0, pitch: Math.sin(this.time * 4.5) * 3, pan: Math.sin(this.time * 0.8) * 0.22 });
  }
  event(name, options = {}) {
    if (this.disposed) return false;
    const aliases = { shot: 'shoot', damage: 'hit', success: 'mission', complete: 'mission', failure: 'fail', collision: 'crash', enter: 'interact', exit: 'interact', collect: 'interact' };
    const sound = aliases[name] ?? name;
    return CITY_SOUNDS[sound] ? this.audio.play(`sd-${sound}`, options) : false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.engine.stop();
    this.siren.stop();
    this.audio.stopMusic();
  }
}
