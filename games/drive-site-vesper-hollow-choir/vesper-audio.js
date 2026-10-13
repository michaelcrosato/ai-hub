/*
 * Vesper Audio — original score and sound design for a gothic action game.
 * Uses the supplied my-3D2dge v0.14.0 Audio system. No external assets.
 *
 * Load after my-3d2dge.js, then: const score = new VesperAudio(game);
 * Call score.start() after the player's first key press or click.
 * The engine owns the only music scheduler. This module starts no timers.
 */
(function (root) {
  'use strict';

  const bars = (...rows) => rows.join(' | ');
  const sustain = (note, length = 16) => [note, ...Array(length - 1).fill('-')].join(' ');
  const rest = length => Array(length).fill('.').join(' ');
  const sequence = tokens => tokens.join(' ');

  // Sixteen bars in D minor. The later bars alter the bass and cadence so the
  // low organ and bell phrases have space without a short, insistent loop.
  const harmony = [
    ['D2', 'D3', 'F3', 'A3'], ['C2', 'D3', 'F3', 'A3'],
    ['Bb1', 'D3', 'F3', 'Bb3'], ['A1', 'C#3', 'E3', 'G3'],
    ['G1', 'D3', 'G3', 'Bb3'], ['F2', 'D3', 'F3', 'A3'],
    ['Eb2', 'Eb3', 'G3', 'Bb3'], ['A1', 'C#3', 'E3', 'A3'],
    ['D2', 'D3', 'F3', 'A3'], ['C2', 'C3', 'E3', 'G3'],
    ['Bb1', 'D3', 'F3', 'Bb3'], ['G1', 'D3', 'G3', 'Bb3'],
    ['E2', 'E3', 'G3', 'Bb3'], ['A1', 'C#3', 'E3', 'G3'],
    ['D2', 'D3', 'F3', 'A3'], ['A1', 'D3', 'E3', 'A3']
  ];
  const arpeggio = harmony.map((chord, i) => {
    const a = chord[1], b = chord[2], c = chord[3];
    return sequence(i % 4 === 3
      ? [a, '.', c, '.', b, '.', a, '.', c, '.', b, '.', a, '.', '.', '.']
      : [a, '.', b, '.', c, '.', b, '.', a, '.', c, '.', b, '.', '.', '.']);
  });
  const bellPhrase = [
    'A5 - . . . . F5 - . . . . . . . .',
    '. . . . E5 - . . D5 - - - . . . .',
    'F5 - . . . . D5 - . . . . . . . .',
    '. . . . E5 - - - C#5 - . . . . . .',
    'D5 - . . . . G5 - . . F5 - . . . .',
    '. . . . E5 - . . D5 - - - . . . .',
    'Eb5 - . . . . Bb5 - . . G5 - . . . .',
    '. . . . E5 - - - . . . . C#5 - . .',
    'A5 - . . F5 - . . E5 - . . . . . .',
    '. . . . G5 - . . E5 - - - . . . .',
    'F5 - . . . . D5 - . . C5 - . . . .',
    '. . . . Bb4 - . . D5 - - - . . . .',
    'E5 - . . . . G5 - . . Bb5 - . . . .',
    '. . . . A5 - . . G5 - E5 - C#5 - . .',
    'D5 - - - . . A4 - . . D5 - . . . .',
    '. . . . E5 - . . C#5 - - - . . . .'
  ];

  const EXPLORE = {
    name: 'The Unlit Hours', bpm: 78, steps: 4, loop: true,
    tracks: [
      { wave: 'sine', vol: 0.090, gate: 0.97,
        notes: bars(...harmony.map(chord => sustain(chord[0]))) },
      { wave: 'triangle', vol: 0.036, gate: 0.93,
        notes: bars(...harmony.map(chord => sustain(chord[1]))) },
      { wave: 'sine', vol: 0.031, gate: 0.93,
        notes: bars(...harmony.map(chord => sustain(chord[2]))) },
      { wave: 'pulse12', vol: 0.006, gate: 0.87,
        notes: bars(...harmony.map(chord => sustain(chord[3]))) },
      { wave: 'triangle', vol: 0.035, gate: 0.72,
        notes: bars(...arpeggio) },
      { wave: 'sine', vol: 0.072, gate: 0.48,
        notes: bars(...bellPhrase) }
    ]
  };

  const sanctuaryHarmony = [
    ['D2', 'F3', 'A3'], ['Bb1', 'F3', 'D4'],
    ['G1', 'G3', 'Bb3'], ['A1', 'E3', 'C#4'],
    ['D2', 'F3', 'A3'], ['F2', 'A3', 'C4'],
    ['Bb1', 'F3', 'D4'], ['A1', 'E3', 'A3']
  ];
  const SANCTUARY = {
    name: 'A Flame Kept', bpm: 62, steps: 2, loop: true,
    tracks: [
      { wave: 'sine', vol: 0.073, gate: 0.96,
        notes: bars(...sanctuaryHarmony.map(chord => sustain(chord[0], 16))) },
      { wave: 'triangle', vol: 0.029, gate: 0.91,
        notes: bars(...sanctuaryHarmony.map(chord => sustain(chord[1], 16))) },
      { wave: 'sine', vol: 0.027, gate: 0.92,
        notes: bars(...sanctuaryHarmony.map(chord => sustain(chord[2], 16))) },
      { wave: 'sine', vol: 0.078, gate: 0.39, notes: bars(
        'A5 - . . . . F5 - . . . . D5 - . .',
        '. . . . F5 - . . . . D5 - . . . .',
        'G5 - . . . . D5 - . . Bb4 - . . . .',
        '. . . . E5 - . . C#5 - - - . . . .',
        'D5 - . . . . A5 - . . F5 - . . . .',
        '. . . . E5 - . . C5 - . . . . . .',
        'D5 - . . . . F5 - . . Bb5 - . . . .',
        '. . E5 - . . C#5 - . . . . . . . .'
      ) }
    ]
  };

  const bossChords = [
    ['D2', 'D3', 'F3', 'A3'], ['C2', 'C3', 'E3', 'G3'],
    ['Bb1', 'Bb2', 'D3', 'F3'], ['A1', 'A2', 'C#3', 'E3'],
    ['G1', 'G2', 'Bb2', 'D3'], ['Eb2', 'Eb3', 'G3', 'Bb3'],
    ['A1', 'A2', 'C#3', 'G3'], ['A1', 'A2', 'E3', 'C#4']
  ];
  const BOSS = {
    name: 'The Bell That Refused', bpm: 124, steps: 4, loop: true,
    tracks: [
      { wave: 'triangle', vol: 0.108, gate: 0.77,
        notes: bars(...bossChords.map(chord => sequence([
          chord[0], '.', chord[1], '.', chord[0], '.', chord[1], '.',
          chord[0], '.', chord[1], '.', chord[0], '.', chord[1], '.'
        ]))) },
      { wave: 'pulse', vol: 0.027, gate: 0.62,
        notes: bars(...bossChords.map(chord => sequence([
          chord[1], chord[2], chord[3], chord[2], '.', chord[1], chord[3], '.',
          chord[2], chord[3], chord[1], '.', chord[3], chord[2], chord[1], '.'
        ]))) },
      { wave: 'sine', vol: 0.033, gate: 0.89,
        notes: bars(...bossChords.map(chord => sustain(chord[3]))) },
      { wave: 'triangle', vol: 0.054, gate: 0.81, notes: bars(
        'A4 - D5 - F5 - E5 - D5 - - - A4 - . .',
        'G4 - C5 - E5 - D5 - C5 - - - G4 - . .',
        'F4 - Bb4 - D5 - C5 - Bb4 - - - A4 - . .',
        'E4 - A4 - C#5 - E5 - G5 - E5 - C#5 - . .',
        'D5 - G5 - F5 - D5 - Bb4 - - - D5 - . .',
        'Eb5 - G5 - Bb5 - G5 - F5 - Eb5 - D5 - . .',
        'E5 - - - G5 - E5 - C#5 - - - E5 - . .',
        'A5 - G5 - E5 - C#5 - A4 - E5 - C#5 - . .'
      ) },
      { wave: 'drums', vol: 0.043, notes: bars(
        'k . . h . . t . k . . h . . t .',
        'k . . h . . t . k . t . . . t .',
        'k . . h . . t . k . . h . . t .',
        'k . t . . . t . k . . t . t . .',
        'k . . h . . t . k . . h . . t .',
        'k . . h . . t . k . t . . . t .',
        'k . . h . . t . k . . h . . t .',
        'k . t . k . t . . t . t k . . .'
      ) }
    ]
  };

  // A ten-second release: minor subdominant, dominant, then a quiet D-major
  // close. The Picardy third belongs to the new melody, not a source tune.
  const VICTORY = {
    name: 'The First Dawn', bpm: 92, steps: 4, loop: false,
    tracks: [
      { wave: 'sine', vol: 0.090, gate: 0.96,
        notes: bars(sustain('G2'), sustain('A2'), sustain('D2'), sustain('D2')) },
      { wave: 'triangle', vol: 0.036, gate: 0.94,
        notes: bars(sustain('Bb3'), sustain('C#4'), sustain('F#3'), sustain('A3')) },
      { wave: 'sine', vol: 0.041, gate: 0.94,
        notes: bars(sustain('D4'), sustain('E4'), sustain('A3'), sustain('D4')) },
      { wave: 'sine', vol: 0.082, gate: 0.83, notes: bars(
        'D5 - G5 - Bb5 - A5 - G5 - - - . . . .',
        'E5 - A5 - C#6 - B5 - A5 - - - . . . .',
        'F#5 - A5 - D6 - - - A5 - F#5 - E5 - . .',
        'D5 - - - - - - - - - - - . . . .'
      ) }
    ]
  };

  const SONGS = Object.freeze({
    explore: EXPLORE,
    sanctuary: SANCTUARY,
    boss: BOSS,
    victory: VICTORY
  });
  const resolveMode = mode => Object.prototype.hasOwnProperty.call(SONGS, mode) ? mode : 'explore';

  const EFFECTS = {
    'vesper:blade': [
      { wave: 'noise', freq: 1900, to: 600, dur: 0.115, vol: 0.115, filter: 'bandpass' },
      { wave: 'sine', freq: 700, to: 350, dur: 0.075, vol: 0.028 }
    ],
    'vesper:cast': [
      { wave: 'sine', freq: 370, to: 1110, dur: 0.23, vol: 0.070 },
      { wave: 'triangle', freq: 740, to: 1480, dur: 0.16, vol: 0.033, delay: 0.035 }
    ],
    'vesper:dash': [
      { wave: 'noise', freq: 1550, to: 320, dur: 0.16, vol: 0.105, filter: 'bandpass' },
      { wave: 'sine', freq: 310, to: 120, dur: 0.12, vol: 0.028 }
    ],
    'vesper:bell': [
      { wave: 'sine', freq: 587.33, dur: 1.75, vol: 0.115, attack: 0.002 },
      { wave: 'sine', freq: 1174.66, dur: 1.1, vol: 0.034, attack: 0.002 },
      { wave: 'sine', freq: 1710, dur: 0.53, vol: 0.021, attack: 0.002 }
    ],
    'vesper:save': [
      { wave: 'sine', freq: 293.66, dur: 0.8, vol: 0.080 },
      { wave: 'sine', freq: 440, dur: 0.7, vol: 0.065, delay: 0.13 },
      { wave: 'sine', freq: 587.33, dur: 1.1, vol: 0.070, delay: 0.26 }
    ],
    'vesper:relic': [
      { wave: 'triangle', freq: 293.66, dur: 0.48, vol: 0.075 },
      { wave: 'sine', freq: 349.23, dur: 0.55, vol: 0.070, delay: 0.09 },
      { wave: 'sine', freq: 440, dur: 0.65, vol: 0.060, delay: 0.18 },
      { wave: 'sine', freq: 587.33, dur: 0.95, vol: 0.085, delay: 0.30 }
    ],
    'vesper:heal': [
      { wave: 'sine', freq: 440, to: 660, dur: 0.31, vol: 0.072 },
      { wave: 'sine', freq: 880, dur: 0.54, vol: 0.053, delay: 0.09 }
    ],
    'vesper:pickup': [
      { wave: 'sine', freq: 880, dur: 0.11, vol: 0.070 },
      { wave: 'sine', freq: 1174.66, dur: 0.2, vol: 0.052, delay: 0.045 }
    ],
    'vesper:hit': [
      { wave: 'noise', freq: 1050, to: 240, dur: 0.10, vol: 0.150, filter: 'lowpass' },
      { wave: 'sine', freq: 160, to: 60, dur: 0.095, vol: 0.100 }
    ],
    'vesper:hurt': [
      { wave: 'triangle', freq: 220, to: 88, dur: 0.21, vol: 0.130 },
      { wave: 'noise', freq: 480, to: 120, dur: 0.13, vol: 0.065, filter: 'lowpass' }
    ]
  };
  const ALIASES = {
    heavy: 'kick', airjump: 'jump2', enemyCast: 'vesper:cast', equip: 'confirm', gate: 'door', kill: 'vesper:hit',
    attack: 'vesper:blade', slash: 'vesper:blade', swing: 'vesper:blade',
    blade: 'vesper:blade', cast: 'vesper:cast', magic: 'vesper:cast',
    dash: 'vesper:dash', bell: 'vesper:bell', save: 'vesper:save',
    checkpoint: 'vesper:save', relic: 'vesper:relic', unlock: 'vesper:relic',
    heal: 'vesper:heal', pickup: 'vesper:pickup', coin: 'vesper:pickup',
    hit: 'vesper:hit', impact: 'vesper:hit', hurt: 'vesper:hurt',
    jump: 'jump', doublejump: 'jump2', jump2: 'jump2', land: 'land',
    step: 'step', door: 'door', secret: 'secret', death: 'die', die: 'die',
    select: 'select', confirm: 'confirm', cancel: 'cancel', pause: 'pause',
    break: 'bump', enemy: 'vesper:hit', boss: 'vesper:bell', victory: 'vesper:save'
  };

  class VesperAudio {
    constructor(game) {
      if (!game || !game.audio || typeof game.audio.music !== 'function') {
        throw new TypeError('VesperAudio needs a my-3D2dge Game with its Audio system.');
      }
      this.game = game;
      this.audio = game.audio;
      this.enabled = !this.audio.muted;
      this.mode = 'explore';
      this.volume = 0.58;
      this.running = false;
      this._activeMode = null;

      // All audio, including calls made directly by game.hitFx(), uses the
      // same engine master bus. A toggle therefore silences every effect.
      this.audio.sfxVolume = 0.72;
      this.audio.musicVolume = 0.62;
      this.audio.setVolume(this.volume);
      for (const [name, voices] of Object.entries(EFFECTS)) {
        this.audio.define(name, voices);
      }
      this.audio.mute(!this.enabled);
    }

    start(mode = 'explore') {
      const next = resolveMode(mode);
      const changed = next !== this.mode;
      this.mode = next;
      this.running = true;
      this.audio.mute(!this.enabled);
      if (this.enabled && (changed || this._activeMode !== next || !this.audio.song)) {
        this._play();
      }
      return this;
    }

    setMode(mode) {
      const next = resolveMode(mode);
      if (this.mode === next) return this;
      this.mode = next;
      if (this.running && this.enabled) this._play();
      return this;
    }

    _play() {
      if (!this.running || !this.enabled) return;
      // Engine music() closes the previous bus with a short fade and clears
      // its scheduler before starting one new scheduler. No extra timer here.
      this.audio.music(SONGS[this.mode], { loop: this.mode !== 'victory' });
      this._activeMode = this.mode;
    }

    // With no argument, invert the current state. A boolean explicitly sets
    // the state. Repeated toggle(false) calls remain off and never add timers.
    toggle(on) {
      const next = typeof on === 'boolean' ? on : !this.enabled;
      if (next === this.enabled) {
        this.audio.mute(!next);
        return next;
      }
      this.enabled = next;
      this.audio.mute(!next);
      if (!next) {
        this.audio.stopMusic();
        this._activeMode = null;
      } else if (this.running) {
        this._play();
      }
      return this.enabled;
    }

    setVolume(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return this.volume;
      this.volume = Math.max(0, Math.min(1, number));
      this.audio.setVolume(this.volume);
      return this.volume;
    }

    stop() {
      this.running = false;
      this._activeMode = null;
      this.audio.stopMusic();
      return this;
    }

    sfx(name, options) {
      if (!this.enabled) return false;
      const key = ALIASES[name] || name;
      if (typeof key !== 'string' || !this.audio.presets[key]) return false;
      // The slight engine pitch variation stays on physical impacts. Bell
      // and magic cues use a stable pitch so they fit the original score.
      const tonal = /bell|save|relic|heal|pickup|cast/.test(key);
      this.audio.sfx(key, Object.assign({
        vol: key.startsWith('vesper:') ? 1 : 0.50,
        vary: tonal ? 0 : 0.025
      }, options));
      return true;
    }
  }

  // Read-only score data is also useful for project credits and validation.
  VesperAudio.scores = SONGS;
  root.VesperAudio = VesperAudio;
})(typeof window !== 'undefined' ? window : globalThis);
