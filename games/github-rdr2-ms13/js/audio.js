// RED HARROW — western voices and songs for ChipAudio.
export function defineWestern(audio) {
  audio.define('gunshot', { wave: 'noise', dur: 0.25, vol: 0.5, to: 60 });
  audio.define('rifle', { wave: 'noise', dur: 0.4, vol: 0.55, to: 40 });
  audio.define('reload', { wave: 'square', freq: 220, to: 440, dur: 0.08, vol: 0.25 });
  audio.define('gallop', { wave: 'triangle', freq: 140, to: 90, dur: 0.09, vol: 0.3 });
  audio.define('spurs', { wave: 'sine', freq: 1200, to: 1800, dur: 0.12, vol: 0.15 });
  audio.define('cash', { wave: 'square', freq: 880, arp: [0, 4, 7, 12], step: 0.07, dur: 0.3, vol: 0.3 });
  audio.define('honor_up', { wave: 'triangle', freq: 523, arp: [0, 4, 7], step: 0.1, dur: 0.4, vol: 0.3 });
  audio.define('honor_down', { wave: 'saw', freq: 220, to: 110, dur: 0.4, vol: 0.3 });
  audio.define('wanted', { wave: 'saw', freq: 330, to: 165, dur: 0.6, vol: 0.35 });
  audio.define('focus', { wave: 'sine', freq: 200, to: 800, dur: 0.35, vol: 0.3 });
  audio.define('whistle', { wave: 'sine', freq: 1567, to: 1174, dur: 0.5, vol: 0.25 });
}

// Original western themes in tracker notation ('-' holds, '.' rests).
export const SONGS = {
  title: { bpm: 84, steps: 4, tracks: [
    { wave: 'triangle', vol: 0.2, notes: 'A3 - - - | C4 - - - | D4 - - - | E4 - D4 C4 | A3 - - - | C4 - - - | B3 - A3 - | G3 - - -' },
    { wave: 'drums', notes: 'k . . . | . . . . | k . . . | . . . . | k . . . | . . . . | k . s . | . . . .' },
  ] },
  ride: { bpm: 132, steps: 4, tracks: [
    { wave: 'square', vol: 0.1, notes: 'E4 . E4 . | G4 . A4 . | B4 . A4 . | G4 . E4 . | D4 . E4 . | G4 . G4 . | A4 . . . | . . . .' },
    { wave: 'drums', notes: 'k . h . | k . h . | k . h . | k . h s | k . h . | k . h . | k . h . | k s k .' },
  ] },
  town: { bpm: 100, steps: 4, tracks: [
    { wave: 'triangle', vol: 0.16, notes: 'C4 . E4 . | G4 . E4 . | A4 . G4 . | E4 . . . | D4 . F4 . | A4 . F4 . | G4 . . . | . . . .' },
    { wave: 'drums', notes: 'k . . . | h . . . | k . . . | h . . . | k . . . | h . . . | k . . s | . . . .' },
  ] },
  battle: { bpm: 150, steps: 4, tracks: [
    { wave: 'saw', vol: 0.1, notes: 'E4 E4 . E4 | . D4 . C4 | D4 . E4 . | . . G4 . | E4 E4 . E4 | . D4 . C4 | B3 . C4 . | D4 . . .' },
    { wave: 'drums', notes: 'k . s . | k . s k | k . s . | k . s k | k . s . | k . s k | k k s . | k . s .' },
  ] },
  victory: { bpm: 112, steps: 4, tracks: [
    { wave: 'triangle', vol: 0.18, notes: 'E4 - G4 - | A4 - B4 - | C5 - B4 - | A4 - G4 - | A4 - B4 - | C5 - - - | . . . .' },
    { wave: 'drums', notes: 'k . . . | . . . . | k . . . | . . . . | k . . . | k . s . | . . . .' },
  ] },
  somber: { bpm: 72, steps: 4, tracks: [
    { wave: 'sine', vol: 0.2, notes: 'E3 - - - | G3 - - - | A3 - - - | B3 - A3 - | G3 - - - | E3 - - - | D3 - - - | E3 - - -' },
  ] },
};

export function playSong(audio, name) {
  const song = SONGS[name];
  if (song && audio.music) audio.music(song);
}
