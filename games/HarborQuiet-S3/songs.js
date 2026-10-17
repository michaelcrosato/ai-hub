// Original stations. No licensed cues.

export const QUAY_FM = {
  bpm: 92,
  tracks: {
    lead: { wave: 'triangle', decay: 0.28, volume: 0.11 },
    bass: { wave: 'square', duty: 0.125, decay: 0.22, volume: 0.06 },
    hat: { wave: 'noise', decay: 0.05, volume: 0.04 },
  },
  patterns: {
    a: {
      lead: 'E4 . G4 . A4 . . . B4 . A4 . G4 . . .',
      bass: 'E2 . . . . . . . D2 . . . . . . .',
      hat: 'C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 .',
    },
    b: {
      lead: 'D4 . F4 . A4 . . . G4 . E4 . D4 . . .',
      bass: 'D2 . . . . . . . A2 . . . . . . .',
      hat: 'C6 . C6 . C6 . C8 . C6 . C6 . C6 . C8 .',
    },
  },
  order: ['a', 'a', 'b', 'a'],
};

export const SALT_STATIC = {
  bpm: 118,
  tracks: {
    lead: { wave: 'square', duty: 0.25, decay: 0.16, volume: 0.08 },
    bass: { wave: 'saw', decay: 0.18, volume: 0.05 },
    hat: { wave: 'noise', decay: 0.04, volume: 0.045 },
  },
  patterns: {
    a: {
      lead: 'A4 A4 . C5 . E5 . D5 . C5 . A4 . . .',
      bass: 'A2 . A2 . E2 . . . F2 . F2 . E2 . . .',
      hat: 'C6 C6 C8 C6 C6 C8 C6 C6 C6 C6 C8 C6 C6 C8 C6 C6',
    },
  },
  order: ['a'],
};
