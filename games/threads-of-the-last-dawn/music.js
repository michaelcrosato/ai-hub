/* Original score for Threads of the Last Dawn. My3D2dge v0.24.0 step notation. */
(function () {
  'use strict';
  const D = globalThis.Dawn = globalThis.Dawn || {};
  const part = (wave, vol, bars, extra) => Object.assign({ wave, vol, notes: bars.join(' | ') }, extra);
  const song = (name, bpm, melody, bass, color, drums, harmony) => ({
    name, bpm, steps: 4, tracks: [
      part(color, .105, melody, { gate: .84, vib: [4.3, .002] }),
      part('triangle', .22, bass, { gate: .85 }),
      part('sine', .052, harmony || melody, { octave: -1, gate: .9 }),
      part('drums', .055, drums)
    ]
  });
  const soft = ['k . . . . . h . . . . . t . h .', '. . h . . . . . k . . . . . h .'];
  const walk = ['k . h . . . h . s . h . . . h .', 'k . h . . k h . s . h . . . o .'];
  const pulse = ['k . h . s . h . k . h k s . h .', 'k . h h s . h . k k h . s . h o'];
  const M = D.Music = {};

  M.title = song('A Branch Above the Hours', 82, [
    'E5 - - - B4 - D5 - F#5 - - - E5 - - -',
    'D5 - - - A4 - B4 - E5 - - - - - . .',
    'G5 - - - F#5 - E5 - D5 - - - B4 - - -',
    'A4 - B4 - D5 - E5 - F#5 - - - - - . .',
    'E5 - - - A5 - G5 - F#5 - E5 - D5 - - -',
    'B4 - - - D5 - F#5 - E5 - - - - - . .',
    'G5 - F#5 - E5 - D5 - B4 - - - A4 - B4 -',
    'D5 - - - E5 - - - B4 - - - - - . .'
  ], [
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'G2 - - - D3 - - - G2 - - - B2 - - -',
    'A2 - - - E3 - - - B2 - - - F#3 - - -',
    'C3 - - - G3 - - - C3 - - - E3 - - -',
    'D3 - - - A3 - - - D3 - - - A2 - - -',
    'G2 - - - D3 - - - A2 - - - E3 - - -',
    'B2 - - - F#3 - - - E2 - - - - - . .'
  ], 'sine', soft, [
    '. . B4 - . . F#5 - . . B4 - . . F#5 -',
    '. . A4 - . . E5 - . . A4 - . . E5 -',
    '. . B4 - . . D5 - . . B4 - . . D5 -',
    '. . C5 - . . E5 - . . D#5 - . . F#5 -'
  ]);

  M.bell642 = song('Brass, Bread, and Blue Sky', 108, [
    'G4 - B4 D5 E5 - D5 - B4 - A4 - G4 - . .',
    'A4 - D5 - F#5 - E5 D5 B4 - - - A4 - . .',
    'B4 - G4 - E5 - - D5 C5 - A4 - B4 - D5 -',
    'G5 - - F#5 E5 D5 B4 - A4 - G4 - - - . .',
    'D5 - E5 - G5 - F#5 E5 D5 - B4 - A4 - . .',
    'C5 - E5 G5 A5 - G5 - E5 - D5 - C5 - . .',
    'B4 - D5 - E5 - G5 - F#5 - D5 - A4 - C5 -',
    'B4 - A4 - G4 - D5 - G5 - - - - - . .'
  ], [
    'G2 - . G2 D3 - . D3 G2 - . G2 B2 - . D3',
    'D2 - . D2 A2 - . A2 D3 - . A2 D2 - . .',
    'E2 - . E2 B2 - . B2 C3 - . C3 G2 - . G2',
    'A2 - . A2 D3 - . D3 G2 - . G2 D3 - . .'
  ], 'pulse', walk, [
    '. . D4 . G4 . B4 . . . D4 . G4 . B4 .',
    '. . A3 . D4 . F#4 . . . A3 . D4 . F#4 .',
    '. . B3 . E4 . G4 . . . G3 . C4 . E4 .',
    '. . C4 . E4 . A4 . . . D4 . G4 . B4 .'
  ]);

  M.seed112 = song('Roots Remember Rain', 94, [
    'D5 - . F5 A5 - G5 - F5 - D5 - C5 - . .',
    'A4 - C5 - D5 - - - F5 - E5 - D5 - . .',
    'G5 - A5 - C6 - A5 - G5 - F5 - D5 - . .',
    'E5 - G5 - A5 - G5 F5 E5 - D5 - - - . .',
    'F5 - D5 - A5 - - - G5 - C6 - A5 - . .',
    'G5 - F5 - E5 - C5 - D5 - - - A4 - . .',
    'D5 - F5 - G5 - A5 - C6 - A5 - F5 - E5 -',
    'G5 - E5 - D5 - C5 - D5 - - - - - . .'
  ], [
    'D2 - . . A2 . D3 . D2 - . . A2 . . .',
    'C2 - . . G2 . C3 . C2 - . . G2 . . .',
    'G2 - . . D3 . G3 . G2 - . . D3 . . .',
    'A2 - . . E3 . A3 . D3 - . . A2 . . .'
  ], 'triangle', ['k . . h . . t . k . . h t . . .', 'k . . . t . h . . . t . k . h .'], [
    'F4 - - - . . A4 . D5 - - - . . A4 .',
    'E4 - - - . . G4 . C5 - - - . . G4 .',
    'B4 - - - . . D5 . G4 - - - . . D5 .',
    'E4 - - - . . C#5 . F4 - - - . . A4 .'
  ]);

  M.glass1186 = song('The City Holds Its Breath', 100, [
    'F#5 - - C#5 E5 - F#5 - A5 - G#5 - F#5 - . .',
    'E5 - C#5 - B4 - - - C#5 - E5 - G#5 - . .',
    'A5 - - G#5 E5 - C#5 - D5 - F#5 - A5 - . .',
    'G#5 - E5 - C#5 - B4 - C#5 - - - - - . .',
    'C#6 - A5 - G#5 - F#5 - E5 - F#5 - A5 - . .',
    'B5 - G#5 - E5 - - - C#5 - B4 - E5 - . .',
    'A5 - F#5 - D5 - E5 - G#5 - B5 - A5 - G#5 -',
    'F#5 - E5 - C#5 - B4 - F#5 - - - - - . .'
  ], [
    'F#2 . C#3 . F#3 . C#3 . F#2 . C#3 . F#3 . C#3 .',
    'E2 . B2 . E3 . B2 . E2 . B2 . E3 . B2 .',
    'D2 . A2 . D3 . A2 . D2 . A2 . D3 . A2 .',
    'C#2 . G#2 . C#3 . G#2 . C#2 . G#2 . C#3 . G#2 .'
  ], 'sine', ['k . . . h . . . . . s . h . h .'], [
    'C#5 . F#5 . A5 . F#5 . C#5 . F#5 . A5 . F#5 .',
    'B4 . E5 . G#5 . E5 . B4 . E5 . G#5 . E5 .',
    'A4 . D5 . F#5 . D5 . A4 . D5 . F#5 . D5 .',
    'G#4 . C#5 . E#5 . C#5 . G#4 . C#5 . E#5 . C#5 .'
  ]);

  M.ash2310 = song('Ash Beneath the Quiet Sea', 68, [
    'C5 - - - . . G4 - Ab4 - - - G4 - . .',
    'Eb5 - - - D5 - C5 - Bb4 - - - - - . .',
    'G4 - - - C5 - D5 - Eb5 - - - F5 - . .',
    'D5 - - - Bb4 - G4 - C5 - - - - - . .',
    'Ab5 - - - G5 - Eb5 - D5 - - - C5 - . .',
    'Bb4 - - - Eb5 - D5 - G4 - - - - - . .',
    'C5 - Eb5 - F5 - - - Eb5 - D5 - Bb4 - . .',
    'G4 - - - B4 - - - C5 - - - - - . .'
  ], [
    'C2 - - - - - . . G2 - - - - - . .',
    'Ab2 - - - - - . . Eb3 - - - - - . .',
    'F2 - - - - - . . C3 - - - - - . .',
    'G2 - - - - - . . G1 - - - - - . .'
  ], 'sine', ['k . . . . . . . . . . . . . h .', '. . . . . . . . t . . . . . . .'], [
    'Eb4 - - - - - . . G4 - - - - - . .',
    'C4 - - - - - . . Eb4 - - - - - . .',
    'Ab3 - - - - - . . C4 - - - - - . .',
    'B3 - - - - - . . D4 - - - - - . .'
  ]);

  M.fold = song('Between the Turning Pages', 76, [
    'B4 - - - F#5 - - - C#5 - E5 - D#5 - . .',
    'A4 - - - E5 - - - B4 - D5 - C#5 - . .',
    'G4 - B4 - D5 - F#5 - E5 - - - B4 - . .',
    'C#5 - - - D#5 - - - F#5 - - - - - . .',
    'B5 - - - A5 - F#5 - E5 - D#5 - C#5 - . .',
    'A5 - - - G5 - E5 - D5 - - - A4 - . .',
    'G5 - F#5 - E5 - B4 - D5 - - - C#5 - . .',
    'D#5 - F#5 - B4 - - - - - - - . . . .'
  ], [
    'B1 - - - F#2 - - - B2 - - - F#2 - - -',
    'A1 - - - E2 - - - A2 - - - E2 - - -',
    'G1 - - - D2 - - - G2 - - - D2 - - -',
    'F#1 - - - C#2 - - - F#2 - - - C#2 - - -'
  ], 'sine', ['. . . . h . . . . . . . t . . .'], [
    'D#4 . F#4 . B4 . F#4 . D#4 . F#4 . B4 . F#4 .',
    'C#4 . E4 . A4 . E4 . C#4 . E4 . A4 . E4 .',
    'B3 . D4 . G4 . D4 . B3 . D4 . G4 . D4 .',
    'A#3 . C#4 . F#4 . C#4 . A#3 . C#4 . F#4 . C#4 .'
  ]);

  M.battle = song('Three Hearts, One Second', 142, [
    'E5 . B4 E5 G5 - F#5 E5 D5 . B4 D5 F#5 - E5 D5',
    'C5 . E5 G5 A5 - G5 E5 F#5 . D#5 F#5 B5 - . .',
    'E5 E5 . B4 G5 - E5 . A5 G5 F#5 E5 D5 - B4 .',
    'C5 D5 E5 G5 F#5 D#5 B4 . E5 - - - . . . .',
    'B5 . G5 B5 A5 - G5 F#5 E5 . F#5 G5 D5 - B4 .',
    'C6 B5 A5 G5 E5 - G5 . A5 F#5 D#5 B4 F#5 - . .',
    'G5 . E5 G5 A5 . G5 A5 B5 A5 G5 F#5 E5 D5 C5 B4',
    'C5 - E5 G5 F#5 - D#5 . E5 - B4 - E5 - . .'
  ], [
    'E2 . E2 B2 E3 . E2 . D2 . D2 A2 D3 . D2 .',
    'C2 . C2 G2 C3 . C2 . B1 . B1 F#2 B2 . B1 .',
    'E2 . E2 B2 E3 . E2 . A1 . A1 E2 A2 . A1 .',
    'C2 . C2 G2 B1 . F#2 . E2 . E2 . B2 . E3 .'
  ], 'pulse', pulse, [
    '. . E4 . . . G4 . . . D4 . . . F#4 .',
    '. . C4 . . . E4 . . . B3 . . . D#4 .',
    '. . E4 . . . G4 . . . A3 . . . C4 .',
    '. . C4 . . . D#4 . . . E4 . . . G4 .'
  ]);

  M.boss = song('The Hour That Will Not Pass', 154, [
    'D5 . A4 D5 F5 - E5 D5 Bb4 . D5 F5 A5 - G5 F5',
    'E5 . C#5 E5 G5 - F5 E5 C#5 . A4 C#5 E5 - . .',
    'D5 F5 A5 D6 C6 A5 G5 F5 Bb5 - A5 G5 F5 E5 D5 .',
    'E5 . G5 Bb5 A5 . G5 E5 F5 E5 D5 C#5 D5 - . .',
    'A5 . D6 . F6 - E6 D6 C6 A5 G5 F5 E5 - C#5 .',
    'Bb5 . A5 G5 F5 . D5 F5 G5 . E5 C#5 A4 - . .',
    'D6 C6 A5 G5 F5 E5 D5 . Bb5 A5 G5 F5 E5 C#5 A4 .',
    'D5 D5 . F5 A5 A5 . C#6 D6 - A5 - D5 - . .'
  ], [
    'D2 . D2 D3 A2 . D2 . Bb1 . Bb1 Bb2 F2 . Bb1 .',
    'G1 . G1 G2 D2 . G1 . A1 . A1 A2 E2 . A1 .',
    'D2 . A2 . D3 . A2 . Bb1 . F2 . Bb2 . F2 .',
    'G1 . D2 . A1 . E2 . D2 . D2 D3 A2 . D2 .'
  ], 'pulse12', ['k . h k s . h . k k h . s . h o', 'k h h . s . h k k . h k s t t o'], [
    'F4 - . . A4 - . . F4 - . . Bb4 - . .',
    'Bb4 - . . D5 - . . E4 - . . G4 - . .',
    'F4 - . . A4 - . . D5 - . . F5 - . .',
    'E5 - . . C#5 - . . A4 - . . F4 - . .'
  ]);

  M.ending = song('What the Morning Keeps', 88, [
    'G5 - - - D5 - E5 - B5 - - - A5 - G5 -',
    'E5 - - - D5 - B4 - C5 - E5 - G5 - - -',
    'A5 - - - G5 - E5 - F#5 - A5 - D6 - C6 -',
    'B5 - G5 - E5 - D5 - G5 - - - - - . .',
    'D6 - - - B5 - A5 - G5 - E5 - D5 - - -',
    'E5 - G5 - C6 - B5 - A5 - - - G5 - E5 -',
    'F#5 - A5 - D6 - C6 - B5 - G5 - A5 - F#5 -',
    'G5 - - - D5 - - - G5 - - - - - - -'
  ], [
    'G2 - - - D3 - - - G3 - - - D3 - - -',
    'C3 - - - G3 - - - C3 - - - G2 - - -',
    'A2 - - - E3 - - - D3 - - - A2 - - -',
    'E3 - - - B2 - - - G2 - - - D3 - - -'
  ], 'sine', soft, [
    'B4 - D5 - G5 - D5 - B4 - D5 - G5 - D5 -',
    'C5 - E5 - G5 - E5 - C5 - E5 - G5 - E5 -',
    'C5 - E5 - A5 - E5 - D5 - F#5 - A5 - F#5 -',
    'B4 - E5 - G5 - E5 - B4 - D5 - G5 - D5 -'
  ]);
})();
