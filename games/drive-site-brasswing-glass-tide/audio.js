/*
 * BRASSWING — original score and sound effects.
 * Written for the ChipAudio system in my-3d2dge.js.
 * No samples or source-game melodies are used.
 *
 * Usage:
 *   BrasswingAudio.install(game.audio);
 *   game.audio.music(BrasswingAudio.mission);
 *   game.audio.sfx('cannon');
 *
 * Each bar below has eight eighth-note steps. The engine uses steps: 2
 * for two subdivisions per quarter note. A dash holds the previous note;
 * a full stop is a rest. Bar marks are for editing and are ignored.
 */
(function (global) {
  'use strict';

  const bars = (...phrases) => phrases.join(' | ');

  // "Last Light": D Dorian, with an A7 turn before the return to D.
  // Open space in the melody leaves room for briefing text and radio cues.
  const title = {
    name: 'Last Light',
    bpm: 84,
    steps: 2,
    tracks: [
      {
        wave: 'triangle', vol: 0.145, gate: 0.94, vib: [4.3, 0.003],
        notes: bars(
          'D5 - - - A4 - C5 -',
          'B4 - - A4 G4 - A4 -',
          'F5 - E5 - D5 - A4 -',
          'E5 - - - C5 - - .',
          'D5 - F5 - A5 - - -',
          'G5 - E5 - C5 - B4 -',
          'F5 - E5 - D5 - E5 -',
          'C#5 - E5 - D5 - - .'
        )
      },
      {
        wave: 'pulse12', vol: 0.029, gate: 0.55,
        notes: bars(
          'D4 . A4 . F4 . E4 .',
          'G3 . D4 . B3 . A3 .',
          'F3 . C4 . A3 . E4 .',
          'A3 . E4 . C4 . G4 .',
          'D4 . A4 . F4 . E4 .',
          'C4 . G4 . E4 . B4 .',
          'G3 . D4 . B3 . E4 .',
          'A3 . E4 . C#4 . E4 .'
        )
      },
      {
        wave: 'sine', vol: 0.068, gate: 0.98,
        notes: bars(
          'F3 - - - E3 - - -',
          'B3 - - - A3 - - -',
          'A3 - - - G3 - - -',
          'C4 - - - B3 - - -',
          'F3 - - - A3 - - -',
          'E3 - - - G3 - - -',
          'B3 - - - A3 - - -',
          'C#4 - - - D4 - - .'
        )
      },
      {
        wave: 'triangle', vol: 0.145, gate: 0.87,
        notes: bars(
          'D2 - - . A2 - - .',
          'G2 - - . D3 - - .',
          'F2 - - . C3 - - .',
          'A2 - - . E3 - - .',
          'D2 - - . A2 - - .',
          'C3 - - . G2 - - .',
          'G2 - - . D3 - - .',
          'A2 - - . D3 - - .'
        )
      }
    ]
  };

  // "Brasswing": an eight-bar D Dorian flight theme.
  // The rising A–D–F call is answered by a falling phrase. Natural B
  // supplies the Dorian color; C# in the last bar leads back into D.
  const mission = {
    name: 'Brasswing',
    bpm: 136,
    steps: 2,
    tracks: [
      {
        wave: 'pulse', vol: 0.088, gate: 0.87, vib: [5.2, 0.003],
        notes: bars(
          'A4 D5 - F5 E5 D5 A4 C5',
          'B4 - A4 G4 F4 G4 A4 -',
          'D5 - E5 F5 A5 - G5 F5',
          'E5 - C5 A4 D5 - - .',
          'F5 - E5 D5 B4 - D5 E5',
          'G5 - E5 C5 A4 - C5 E5',
          'F5 E5 D5 C5 B4 A4 G4 E4',
          'A4 C#5 E5 G5 F5 E5 D5 -'
        )
      },
      {
        wave: 'saw', vol: 0.026, gate: 0.72,
        notes: bars(
          '. . A4 - . . F4 -',
          'G4 - . . D4 - . .',
          'A4 - C5 - F5 - E5 -',
          'C5 - A4 - F4 - . .',
          'D5 - . . G4 - B4 -',
          'E5 - C5 - G4 - . .',
          '. . B4 - G4 - D4 -',
          'E4 - G4 - A4 - F4 -'
        )
      },
      {
        wave: 'square', vol: 0.028, gate: 0.53,
        notes: bars(
          'D4 F4 A4 E5 A4 F4 E4 F4',
          'G3 B3 D4 F4 D4 B3 A3 B3',
          'F4 A4 C5 E5 C5 A4 G4 A4',
          'A3 C4 E4 G4 E4 C4 B3 C4',
          'G3 B3 D4 E4 D4 B3 A3 B3',
          'C4 E4 G4 B4 G4 E4 D4 E4',
          'G3 B3 D4 E4 D4 B3 A3 B3',
          'A3 C#4 E4 G4 E4 C#4 A3 E4'
        )
      },
      {
        wave: 'triangle', vol: 0.215, gate: 0.74,
        notes: bars(
          'D2 D3 . D2 A2 D3 A2 C3',
          'G2 G3 . G2 D3 G3 F3 D3',
          'F2 F3 . F2 C3 F3 E3 C3',
          'A2 A3 . A2 E3 A3 G3 E3',
          'G2 G3 . G2 D3 G3 A2 B2',
          'C3 C4 . C3 G2 C4 B2 G2',
          'G2 G3 D3 G2 B2 G3 D3 G2',
          'A2 A3 E3 A2 C#3 E3 A2 C#3'
        )
      },
      {
        wave: 'drums', vol: 0.094,
        notes: bars(
          'k . s . k k s .',
          'k . s . k . s k',
          'k . s k k . s .',
          'k . s . k t s t',
          'k . s . k k s .',
          'k . s k k . s .',
          'k . s . k k s .',
          'k t s t k s s t'
        )
      },
      {
        wave: 'drums', vol: 0.061,
        notes: bars(
          'h h h h h h h o',
          'h h h h h h h h',
          'h h h o h h h h',
          'h h h h h h o .',
          'c h h h h h h o',
          'h h h h h h h h',
          'h h h o h h h h',
          'h h h h h h o .'
        )
      }
    ]
  };

  // "Iron Weather": the same tonal center with a sharper A7 pull,
  // dense bass motion, clipped brass attacks, and tom fills.
  const boss = {
    name: 'Iron Weather',
    bpm: 152,
    steps: 2,
    tracks: [
      {
        wave: 'pulse', vol: 0.085, gate: 0.76, vib: [5.7, 0.0028],
        notes: bars(
          'D5 - A4 D5 F5 E5 D5 .',
          'C#5 - E5 G5 A5 - G5 E5',
          'F5 - D5 A4 B4 D5 E5 .',
          'E5 - C#5 A4 C#5 E5 G5 -',
          'A5 G5 F5 E5 D5 - A4 .',
          'B4 D5 F5 A5 G5 F5 E5 -',
          'D5 E5 F5 A5 B5 A5 G5 E5',
          'C#5 E5 G5 A5 F5 E5 D5 .'
        )
      },
      {
        wave: 'saw', vol: 0.032, gate: 0.56,
        notes: bars(
          'D4 . A3 D4 F4 . D4 .',
          'A3 . E4 . C#4 . G4 .',
          'G3 . D4 G4 B3 . D4 .',
          'A3 . C#4 . E4 . G4 .',
          'F4 . C4 F4 A4 . F4 .',
          'G3 . D4 . B3 . F4 .',
          'B3 . F4 . D4 . A4 .',
          'A3 . C#4 E4 G4 E4 C#4 .'
        )
      },
      {
        wave: 'pulse12', vol: 0.032, gate: 0.48,
        notes: bars(
          'D4 F4 A4 D5 A4 F4 E4 F4',
          'A3 C#4 E4 G4 E4 C#4 G3 C#4',
          'G3 B3 D4 F4 D4 B3 A3 B3',
          'A3 C#4 E4 G4 A4 G4 E4 C#4',
          'F3 A3 C4 E4 F4 E4 C4 A3',
          'G3 B3 D4 F4 G4 F4 D4 B3',
          'B3 D4 F4 A4 B4 A4 F4 D4',
          'A3 C#4 E4 G4 A4 G4 E4 C#4'
        )
      },
      {
        wave: 'triangle', vol: 0.225, gate: 0.71,
        notes: bars(
          'D2 D3 D2 D3 A2 D3 C3 A2',
          'A2 A3 A2 A3 E3 A3 G3 E3',
          'G2 G3 G2 G3 D3 G3 F3 D3',
          'A2 A3 E3 A2 C#3 E3 G3 E3',
          'F2 F3 F2 F3 C3 F3 E3 C3',
          'G2 G3 G2 G3 D3 G3 F3 D3',
          'B2 B3 F3 B2 D3 F3 A3 F3',
          'A2 A3 E3 A2 C#3 E3 G3 C#3'
        )
      },
      {
        wave: 'drums', vol: 0.105,
        notes: bars(
          'k k s . k . s k',
          'k . s k k t s .',
          'k k s . k . s k',
          'k t s t k s s t',
          'k k s . k . s k',
          'k . s k k t s .',
          'k k s k k . s k',
          'k t s t s s t t'
        )
      },
      {
        wave: 'drums', vol: 0.065,
        notes: bars(
          'c h h h h h h o',
          'h h h o h h h h',
          'h h h h h h h o',
          'h h h h h h o .',
          'c h h h h h h o',
          'h h h o h h h h',
          'h h h h h h h o',
          'h h h h h h o .'
        )
      }
    ]
  };

  // "Clear Skies": a single four-bar fanfare. The move from D minor
  // to D major gives the same home note a clear, positive resolution.
  const victory = {
    name: 'Clear Skies',
    bpm: 116,
    steps: 2,
    loop: false,
    tracks: [
      {
        wave: 'pulse', vol: 0.105, gate: 0.93, vib: [4.8, 0.003],
        notes: bars(
          'A4 . D5 . F#5 - A5 -',
          'B5 - A5 F#5 E5 - D5 -',
          'G5 - F#5 E5 D5 - B4 -',
          'C#5 E5 A5 - D6 - - -'
        )
      },
      {
        wave: 'saw', vol: 0.032, gate: 0.92,
        notes: bars(
          'F#4 . A4 . D5 - F#5 -',
          'G5 - F#5 D5 C#5 - A4 -',
          'B4 - A4 G4 F#4 - G4 -',
          'A4 C#5 E5 - F#5 - - -'
        )
      },
      {
        wave: 'square', vol: 0.028, gate: 0.63,
        notes: bars(
          'D4 F#4 A4 D5 A4 F#4 A4 D5',
          'G3 B3 D4 G4 A3 C#4 E4 A4',
          'G3 B3 D4 G4 B3 D4 F#4 B4',
          'A3 C#4 E4 A4 D5 - - -'
        )
      },
      {
        wave: 'triangle', vol: 0.20, gate: 0.94,
        notes: bars(
          'D2 . D3 . A2 - D3 -',
          'G2 - D3 - A2 - D3 -',
          'G2 - A2 - B2 - G2 -',
          'A2 - A3 - D3 - - -'
        )
      },
      {
        wave: 'drums', vol: 0.10,
        notes: bars(
          'k . s . k . s .',
          'k . s . k . s t',
          'k . s . k t s t',
          'k . s . c . . .'
        )
      }
    ]
  };

  function install(audio) {
    if (!audio || typeof audio.define !== 'function') {
      throw new TypeError('BrasswingAudio.install needs a ChipAudio instance.');
    }

    const effects = {
      cannon: [
        { wave: 'pulse12', freq: 740, to: 180, dur: 0.045, vol: 0.028 },
        { wave: 'noise', freq: 3200, to: 1100, dur: 0.028, vol: 0.018, filter: 'highpass' }
      ],
      missile: [
        { wave: 'noise', freq: 1900, to: 520, dur: 0.21, vol: 0.085, filter: 'bandpass' },
        { wave: 'saw', freq: 120, to: 420, delay: 0.025, dur: 0.16, vol: 0.055 }
      ],
      pulse: [
        { wave: 'triangle', freq: 'D4', to: 'D6', dur: 0.34, vol: 0.15 },
        { wave: 'noise', freq: 1600, to: 3500, dur: 0.16, vol: 0.08, filter: 'highpass' },
        { wave: 'sine', freq: 120, to: 40, dur: 0.25, vol: 0.12 }
      ],
      lock: {
        wave: 'square', freq: 'D6', arp: [0, -5, 0], step: 0.05,
        dur: 0.15, vol: 0.075
      },
      pickupCell: [
        { wave: 'triangle', freq: 'D5', arp: [0, 7, 12, 14], step: 0.055, dur: 0.25, vol: 0.15 },
        { wave: 'sine', freq: 'D6', delay: 0.10, dur: 0.18, vol: 0.055 }
      ],
      warning: {
        wave: 'pulse', freq: 'A4', arp: [0, 0, -2, -2], step: 0.06,
        dur: 0.25, vol: 0.08
      },
      comm: [
        { wave: 'noise', freq: 1600, dur: 0.045, vol: 0.045, filter: 'bandpass' },
        { wave: 'triangle', freq: 740, delay: 0.035, dur: 0.055, vol: 0.038 }
      ],
      uiConfirm: {
        wave: 'pulse', freq: 'D5', arp: [0, 7, 12], step: 0.045,
        dur: 0.17, vol: 0.10
      }
    };

    for (const name of Object.keys(effects)) audio.define(name, effects[name]);
    return audio;
  }

  global.BrasswingAudio = { install, title, mission, boss, victory };
})(window);
