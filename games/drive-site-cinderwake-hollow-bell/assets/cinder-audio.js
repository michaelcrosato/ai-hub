/*
 * CINDERWAKE: The Hollow Bell — original sound definitions.
 * Uses the supplied my-3D2dge Agent Edition v0.8.1 ChipAudio API.
 * No samples, network requests, extra audio context, or update loop.
 * install(game) only registers sounds. music(game, kind) starts a score.
 * The game's master volume and mute controls remain on game.audio.
 */
(function (root) {
  'use strict';

  const line = (...bars) => bars.join(' | ');

  // Noise gives each action a physical edge. Quiet sine partials carry its tail.
  // Frequencies on bell sounds are deliberately inharmonic.
  const sounds = {
    blade: [
      { wave: 'noise', freq: 3200, to: 700, dur: .15, vol: .17, filter: 'bandpass', q: .8 },
      { wave: 'triangle', freq: 340, to: 110, dur: .11, vol: .045, delay: .025 },
    ],
    impact: [
      { wave: 'noise', freq: 1250, to: 170, dur: .16, vol: .19, filter: 'lowpass' },
      { wave: 'sine', freq: 138, to: 48, dur: .18, vol: .22 },
      { wave: 'triangle', freq: 715, to: 590, dur: .07, vol: .035 },
    ],
    ember: [
      { wave: 'noise', freq: 430, to: 3200, dur: .29, vol: .10, filter: 'bandpass', q: .65, attack: .025 },
      { wave: 'sine', freq: 185, to: 540, dur: .22, vol: .11, attack: .016 },
      { wave: 'noise', freq: 5100, to: 1300, dur: .10, vol: .035, delay: .12, filter: 'highpass' },
    ],
    heal: [
      { wave: 'sine', freq: 'D4', dur: .78, vol: .085, attack: .06 },
      { wave: 'sine', freq: 'A4', dur: .62, vol: .055, delay: .12, attack: .04 },
      { wave: 'triangle', freq: 'D5', dur: .72, vol: .026, delay: .28, attack: .035 },
      { wave: 'noise', freq: 1700, to: 3300, dur: .38, vol: .025, filter: 'bandpass', q: .5, attack: .07 },
    ],
    loot: [
      { wave: 'sine', freq: 1047, dur: .31, vol: .075 },
      { wave: 'triangle', freq: 1568, dur: .23, vol: .024, delay: .055 },
      { wave: 'noise', freq: 4200, dur: .025, vol: .024, filter: 'highpass' },
    ],
    seal: [
      { wave: 'noise', freq: 320, to: 80, dur: .66, vol: .12, filter: 'lowpass', attack: .022 },
      { wave: 'sine', freq: 'D3', dur: 1.8, vol: .15, delay: .08 },
      { wave: 'sine', freq: 347, dur: 1.25, vol: .05, delay: .085 },
      { wave: 'triangle', freq: 701, dur: .70, vol: .025, delay: .09 },
    ],
    bell: [
      { wave: 'sine', freq: 110, dur: 2.8, vol: .16, attack: .007 },
      { wave: 'sine', freq: 263, dur: 2.05, vol: .064, attack: .004 },
      { wave: 'sine', freq: 557, dur: 1.35, vol: .035, attack: .003 },
      { wave: 'triangle', freq: 887, dur: .64, vol: .014 },
    ],
    bossSlam: [
      { wave: 'sine', freq: 92, to: 30, dur: .64, vol: .27 },
      { wave: 'noise', freq: 680, to: 85, dur: .58, vol: .20, filter: 'lowpass', q: .6 },
      { wave: 'triangle', freq: 238, to: 93, dur: .27, vol: .047 },
      { wave: 'noise', freq: 2400, to: 410, dur: .34, vol: .045, delay: .13, filter: 'bandpass', q: .7 },
    ],
    portal: [
      { wave: 'sine', freq: 72, to: 147, dur: 1.20, vol: .11, attack: .15, vib: [2.2, .009] },
      { wave: 'sine', freq: 221, to: 294, dur: .95, vol: .048, delay: .14, attack: .14 },
      { wave: 'noise', freq: 280, to: 1600, dur: 1.08, vol: .054, filter: 'bandpass', q: 1.4, attack: .17 },
    ],
    death: [
      { wave: 'sine', freq: 'D3', to: 41, dur: 1.35, vol: .16, attack: .015 },
      { wave: 'noise', freq: 830, to: 85, dur: .88, vol: .095, filter: 'lowpass' },
      { wave: 'sine', freq: 311, to: 146, dur: 1.10, vol: .037, delay: .11, attack: .05 },
    ],
    level: [
      { wave: 'sine', freq: 'D4', dur: .94, vol: .11, attack: .012 },
      { wave: 'triangle', freq: 'F4', dur: .82, vol: .043, delay: .14, attack: .02 },
      { wave: 'sine', freq: 'A4', dur: 1.10, vol: .066, delay: .30, attack: .014 },
      { wave: 'sine', freq: 'D5', dur: 1.30, vol: .037, delay: .48, attack: .02 },
    ],
    ui: [
      { wave: 'triangle', freq: 349, to: 294, dur: .065, vol: .043 },
      { wave: 'noise', freq: 1800, dur: .018, vol: .016, filter: 'bandpass' },
    ],
  };

  // Eight steps per bar. The long rests are part of the score.
  // Scores use D-centered modal phrases, open fifths, and restrained dissonance.
  // They share a small motif but have different pacing and instrumentation.
  const scores = {
    title: {
      bpm: 44, steps: 2,
      tracks: [
        { wave: 'sine', vol: .078, gate: .97, notes: line(
          'D2 - - - - - - .', 'D2 - - - - - - .',
          'C2 - - - - - - .', 'A1 - - - - - - .',
          'D2 - - - - - - .', 'F2 - - - - - - .',
          'C2 - - - A1 - - .', 'D2 - - - - - - .') },
        { wave: 'triangle', vol: .027, gate: .76, notes: line(
          '. . D4 - - . . .', '. A3 - . . C4 - .',
          '. . Eb4 - D4 - . .', '. . A3 - - . . .',
          '. . D4 - - . . .', '. F4 - . . E4 - .',
          '. . C4 - A3 - . .', '. D4 - - - . . .') },
        { wave: 'sine', vol: .019, gate: .94, vib: [.65, .002], notes: line(
          'A3 - - - - - . .', '. . . . . . . .',
          'G3 - - - - - . .', 'E3 - - - - - . .',
          'A3 - - - - - . .', '. . . . . . . .',
          'G3 - - . E3 - - .', 'A3 - - - - - . .') },
      ],
    },
    town: {
      bpm: 54, steps: 2,
      tracks: [
        {wave:'triangle',vol:.027,gate:.48,notes:line(
          'D4 . A4 . D5 - A4 .', 'F4 . G4 . A4 - . .',
          'G4 . A4 . C5 - A4 .', 'F4 . E4 . D4 - . .',
          'D4 . F4 . A4 - D5 .', 'C5 - A4 . G4 . F4 .',
          'G4 . E4 . A4 - . .', 'F4 . E4 . D4 - - .')},
        {wave:'sine',vol:.053,gate:.92,notes:line(
          'D2 - - . A2 - - .', 'F2 - - . C3 - - .',
          'C2 - - . G2 - - .', 'D2 - - . A2 - - .',
          'D2 - - . A2 - - .', 'F2 - - . C3 - - .',
          'G2 - - . A2 - - .', 'D2 - - - - - . .')},
        {wave:'sine',vol:.018,gate:.86,notes:line(
          '. . A3 - . . F4 -', '. . C4 - . . A3 -',
          '. . G3 - . . E4 -', '. . A3 - - - . .',
          '. . F4 - . . A3 -', '. . A3 - . . C4 -',
          '. . B3 - . . E4 -', '. . A3 - - - . .')},
      ],
    },
    dungeon: {
      bpm: 40, steps: 2,
      tracks: [
        { wave: 'sine', vol: .070, gate: .98, notes: line(
          'D2 - - - - - - .', '. . . . A1 - - .',
          'D2 - - - - - - .', 'C2 - - - - - - .',
          'Bb1 - - - - - - .', '. . . . A1 - - .',
          'D2 - - - - - - .', '. . . . . . . .',
          'Eb2 - - - - - - .', 'D2 - - - - - - .',
          'A1 - - - - - - .', 'D2 - - - - - - .') },
        { wave: 'triangle', vol: .020, gate: .64, notes: line(
          '. . . . D4 - . .', '. . . . . . . .',
          '. A3 - . . . C4 .', '. . . . . . . .',
          '. . F4 - Eb4 - . .', '. . . A3 - . . .',
          '. . . . D4 - . .', '. . . . . . . .',
          '. Bb3 - . . Eb4 . .', '. . D4 - - . . .',
          '. . . . A3 - . .', '. . . . . . . .') },
        { wave: 'sine', vol: .022, gate: .92, vib: [.8, .0025], notes: line(
          'A3 - - - . . . .', '. . . . . . . .',
          'F3 - - - . . . .', '. . G3 - - - . .',
          'F3 - - - . . . .', '. . . . E3 - - .',
          'A3 - - - . . . .', '. . . . . . . .',
          'Bb3 - - - . . . .', '. . A3 - - - . .',
          'E3 - - - . . . .', 'A3 - - - - - . .') },
      ],
    },
    boss: {
      bpm: 68, steps: 2,
      tracks: [
        { wave: 'triangle', vol: .068, gate: .57, notes: line(
          'D2 . . D2 . . A1 .', 'D2 . . D2 . . Eb2 .',
          'D2 . . D2 . . A1 .', 'C2 . . C2 . . A1 .',
          'Bb1 . . Bb1 . . F2 .', 'A1 . . A1 . . C2 .',
          'Eb2 . . Eb2 . . A1 .', 'D2 . . D2 . . D2 .') },
        { wave: 'sine', vol: .040, gate: .94, notes: line(
          'D3 - - - A2 - - .', 'Eb3 - - - A2 - - .',
          'D3 - - - F3 - - .', 'C3 - - - E3 - - .',
          'Bb2 - - - F3 - - .', 'A2 - - - E3 - - .',
          'Eb3 - - - Bb2 - - .', 'D3 - - - A2 - - .') },
        { wave: 'pulse12', vol: .009, gate: .68, notes: line(
          '. . D4 - . . A3 .', '. . Eb4 - D4 - . .',
          '. . D4 - . F4 - .', '. . E4 - C4 - . .',
          '. . F4 - . . Eb4 .', '. . E4 - C4 - . .',
          '. . Eb4 - . Bb3 - .', '. . D4 - - - . .') },
        { wave: 'drums', vol: .025, notes: line(
          't . . . . . t .', 't . . . t . . .',
          't . . . . . t .', 't . . . t . . .',
          't . . . . . t .', 't . . . t . . .',
          't . . t . . t .', 't . . . . . . .') },
      ],
    },
    victory: {
      bpm: 46, steps: 2, loop: false,
      tracks: [
        { wave: 'sine', vol: .075, gate: .98, notes: line(
          'D2 - - - - - - .', 'F2 - - - - - - .',
          'C2 - - - - - - .', 'D2 - - - - - - .',
          'A1 - - - - - - .', 'D2 - - - - - - .') },
        { wave: 'triangle', vol: .028, gate: .83, notes: line(
          '. D4 - - A3 - . .', '. F4 - - E4 - . .',
          '. C4 - - G4 - . .', '. F4 - E4 D4 - . .',
          '. A3 - - C4 - . .', '. D4 - - - - . .') },
        { wave: 'sine', vol: .023, gate: .96, notes: line(
          'A3 - - - - - . .', 'C4 - - - - - . .',
          'G3 - - - - - . .', 'A3 - - - - - . .',
          'E3 - - - - - . .', 'A3 - - - - - . .') },
      ],
    },
  };

  const installed = new WeakSet();
  const api = {
    install(game) {
      if (!game || !game.audio || typeof game.audio.define !== 'function') {
        throw new TypeError('CinderAudio.install requires a my-3D2dge Game.');
      }
      if (!installed.has(game.audio)) {
        for (const [name, voices] of Object.entries(sounds)) {
          game.audio.define(name, voices.map(voice => ({ ...voice })));
        }
        installed.add(game.audio);
      }
      return api;
    },
    music(game, kind) {
      api.install(game);
      if (kind === null || kind === false || kind === 'off') {
        game.audio.music(null);
        return null;
      }
      if (!Object.prototype.hasOwnProperty.call(scores, kind)) {
        throw new RangeError('Unknown Cinderwake score: ' + String(kind));
      }
      // Stable score identity lets the engine ignore repeated requests.
      game.audio.music(scores[kind]);
      return kind;
    },
    soundNames: Object.freeze(Object.keys(sounds)),
    musicNames: Object.freeze(Object.keys(scores)),
  };

  root.CinderAudio = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
