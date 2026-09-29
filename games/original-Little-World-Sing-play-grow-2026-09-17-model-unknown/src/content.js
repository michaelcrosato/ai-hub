/* Traditional song melodies, scored and arranged for this app.
   Each note is [pitch, beats, wordIndex]. Word indices drive the visible lyric guide. */

const phrase = (text, pitches, durations, words) => ({
  text,
  words: text.split(' '),
  notes: pitches.split(' ').map((pitch, i) => ({ pitch, beats: durations[i], word: words[i] })),
});
const common = [1, 1, 1, 1, 1, 1, 2];

const twinkle = [
  phrase('Twinkle, twinkle, little star', 'C4 C4 G4 G4 A4 A4 G4', common, [0, 0, 1, 1, 2, 2, 3]),
  phrase('How I wonder what you are', 'F4 F4 E4 E4 D4 D4 C4', common, [0, 1, 2, 2, 3, 4, 5]),
  phrase('Up above the world so high', 'G4 G4 F4 F4 E4 E4 D4', common, [0, 1, 1, 2, 3, 4, 5]),
  phrase('Like a diamond in the sky', 'G4 G4 F4 F4 E4 E4 D4', common, [0, 1, 2, 2, 3, 4, 5]),
  phrase('Twinkle, twinkle, little star', 'C4 C4 G4 G4 A4 A4 G4', common, [0, 0, 1, 1, 2, 2, 3]),
  phrase('How I wonder what you are', 'F4 F4 E4 E4 D4 D4 C4', common, [0, 1, 2, 2, 3, 4, 5]),
];
const abc = [
  phrase('A B C D E F G', 'C4 C4 G4 G4 A4 A4 G4', common, [0, 1, 2, 3, 4, 5, 6]),
  phrase('H I J K L M N O P', 'F4 F4 E4 E4 D4 D4 D4 D4 C4', [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 2], [0, 1, 2, 3, 4, 5, 6, 7, 8]),
  phrase('Q R S T U V', 'G4 G4 F4 E4 E4 D4', [1, 1, 2, 1, 1, 2], [0, 1, 2, 3, 4, 5]),
  phrase('W X Y and Z', 'G4 G4 F4 F4 E4 E4 D4', common, [0, 0, 0, 1, 2, 3, 4]),
  phrase('Now I know my A B Cs', 'C4 C4 G4 G4 A4 A4 G4', common, [0, 1, 2, 3, 4, 5, 6]),
  phrase('Next time, sing along with me', 'F4 F4 E4 E4 D4 D4 C4', common, [0, 1, 2, 3, 3, 4, 5]),
];
const row = [
  phrase('Row, row, row your boat', 'C4 C4 C4 D4 E4', [1.5, 1.5, 1, 0.5, 1.5], [0, 1, 2, 3, 4]),
  phrase('Gently down the stream', 'E4 D4 E4 F4 G4', [1, 0.5, 1, 0.5, 3], [0, 0, 1, 2, 3]),
  phrase('Merrily, merrily, merrily, merrily', 'C5 C5 C5 G4 G4 G4 E4 E4 E4 C4 C4 C4', Array(12).fill(0.5), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
  phrase('Life is but a dream', 'G4 F4 E4 D4 C4', [1, 0.5, 1, 0.5, 3], [0, 1, 2, 3, 4]),
];
const macdonald = [
  phrase('Old MacDonald had a farm', 'G4 G4 G4 D4 E4 E4 D4', common, [0, 1, 1, 1, 2, 3, 4]),
  phrase('E I E I O', 'B4 B4 A4 A4 G4', [1, 1, 1, 1, 4], [0, 1, 2, 3, 4]),
  phrase('And on that farm he had a cow', 'D4 G4 G4 G4 D4 E4 E4 D4', [1, 1, 1, 1, 1, 1, 1, 1], [0, 1, 2, 3, 4, 5, 6, 7]),
  phrase('E I E I O', 'B4 B4 A4 A4 G4', [1, 1, 1, 1, 4], [0, 1, 2, 3, 4]),
  phrase('With a moo moo here', 'D4 D4 G4 G4 G4', [1, 1, 1, 1, 2], [0, 1, 2, 3, 4]),
  phrase('And a moo moo there', 'D4 D4 G4 G4 G4', [1, 1, 1, 1, 2], [0, 1, 2, 3, 4]),
  phrase('Here a moo, there a moo', 'G4 G4 G4 G4 G4 G4', [1, 1, 1, 1, 1, 1], [0, 1, 2, 3, 4, 5]),
  phrase('Everywhere a moo moo', 'G4 G4 G4 G4 G4 G4', [1, 1, 1, 1, 1, 1], [0, 0, 0, 1, 2, 3]),
  phrase('Old MacDonald had a farm', 'G4 G4 G4 D4 E4 E4 D4', common, [0, 1, 1, 1, 2, 3, 4]),
  phrase('E I E I O', 'B4 B4 A4 A4 G4', [1, 1, 1, 1, 4], [0, 1, 2, 3, 4]),
];
// New in the upgrade pass: two more traditional songs. They have no built-in
// singing track, so the melody plays and the grown-up is the singer (or a
// saved parent recording sings along).
const lamb = [
  phrase('Mary had a little lamb', 'E4 D4 C4 D4 E4 E4 E4', common, [0, 0, 1, 2, 3, 3, 4]),
  phrase('Little lamb, little lamb', 'D4 D4 D4 E4 G4 G4', [1, 1, 2, 1, 1, 2], [0, 0, 1, 2, 2, 3]),
  phrase('Mary had a little lamb', 'E4 D4 C4 D4 E4 E4 E4', [1, 1, 1, 1, 1, 1, 1], [0, 0, 1, 2, 3, 3, 4]),
  phrase('Its fleece was white as snow', 'E4 D4 D4 E4 D4 C4', [1, 1, 1, 1, 1, 4], [0, 1, 2, 3, 4, 5]),
  phrase('Everywhere that Mary went', 'E4 D4 C4 D4 E4 E4 E4', common, [0, 0, 0, 1, 2, 2, 3]),
  phrase('Mary went, Mary went', 'D4 D4 D4 E4 G4 G4', [1, 1, 2, 1, 1, 2], [0, 0, 1, 2, 2, 3]),
  phrase('Everywhere that Mary went', 'E4 D4 C4 D4 E4 E4 E4', [1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 1, 2, 2, 3]),
  phrase('The lamb was sure to go', 'E4 D4 D4 E4 D4 C4', [1, 1, 1, 1, 1, 4], [0, 1, 2, 3, 4, 5]),
];
const sleeping = [
  phrase('Are you sleeping?', 'C4 D4 E4 C4', [1, 1, 1, 1], [0, 1, 2, 2]),
  phrase('Are you sleeping?', 'C4 D4 E4 C4', [1, 1, 1, 1], [0, 1, 2, 2]),
  phrase('Brother John?', 'E4 F4 G4', [1, 1, 2], [0, 0, 1]),
  phrase('Brother John?', 'E4 F4 G4', [1, 1, 2], [0, 0, 1]),
  phrase('Morning bells are ringing', 'G4 A4 G4 F4 E4 C4', [0.5, 0.5, 0.5, 0.5, 1, 1], [0, 0, 1, 2, 3, 3]),
  phrase('Morning bells are ringing', 'G4 A4 G4 F4 E4 C4', [0.5, 0.5, 0.5, 0.5, 1, 1], [0, 0, 1, 2, 3, 3]),
  phrase('Ding, dang, dong', 'C4 G3 C4', [1, 1, 2], [0, 1, 2]),
  phrase('Ding, dang, dong', 'C4 G3 C4', [1, 1, 2], [0, 1, 2]),
];

export const songs = [
  { id: 'twinkle', title: 'Twinkle, Twinkle', fullTitle: 'Twinkle, Twinkle, Little Star', blurb: 'A gentle favorite', icon: 'star', scene: 'star', bpm: 92, phrases: twinkle, tip: 'Open and close your hands like little stars.', cue: 'Make a little star with your hands.' },
  { id: 'abc', title: 'The ABC Song', fullTitle: 'The Alphabet Song', blurb: 'A to Z', icon: 'letters', scene: 'abc', bpm: 88, phrases: abc, tip: 'Sing together. A smile or a sound is enough.', cue: 'Sing a sound together. There is no test.' },
  { id: 'row', title: 'Row Your Boat', fullTitle: 'Row, Row, Row Your Boat', blurb: 'Sway along', icon: 'boat', scene: 'boat', bpm: 82, phrases: row, tip: 'Sit together. Move your arms as you sing.', cue: 'Move your arms like you are rowing a boat.' },
  { id: 'farm', title: 'Old MacDonald', fullTitle: 'Old MacDonald Had a Farm', blurb: 'Animal sounds', icon: 'cow', scene: 'cow', bpm: 110, phrases: macdonald, tip: 'Pause after “moo.” Let your child try the sound.', cue: 'Can you make a moo sound together?' },
  { id: 'lamb', title: 'Mary’s Lamb', fullTitle: 'Mary Had a Little Lamb', blurb: 'You sing, music plays', icon: 'lamb', scene: 'meadow', bpm: 100, phrases: lamb, tip: 'Walk your fingers like a little lamb following along.', cue: 'Where did the lamb go? Point together.' },
  { id: 'sleeping', title: 'Are You Sleeping?', fullTitle: 'Are You Sleeping? (Brother John)', blurb: 'You sing, music plays', icon: 'moon', scene: 'bedtime', bpm: 96, phrases: sleeping, tip: 'Rest your head on your hands, then wake up for the bells.', cue: 'Ding, dang, dong. Can you ring a pretend bell?' },
];

songs.forEach((song) => {
  let beat = 0;
  song.events = [];
  song.phrases.forEach((line, lineIndex) =>
    line.notes.forEach((note) => {
      song.events.push({ ...note, beat, line: lineIndex });
      beat += note.beats;
    })
  );
  song.beats = beat;
  song.duration = (beat * 60) / song.bpm;
});

const letterWords = ['apple', 'ball', 'cat', 'dog', 'egg', 'fish', 'goat', 'hat', 'ice cream', 'jam', 'kite', 'leaf', 'moon', 'nose', 'orange', 'pig', 'quilt', 'rainbow', 'star', 'tree', 'umbrella', 'van', 'water', 'xylophone', 'yogurt', 'zebra'];
export const alphabet = letterWords.map((word, i) => ({ upper: String.fromCharCode(65 + i), lower: String.fromCharCode(97 + i), word }));
export const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export const explore = {
  animals: [
    { id: 'cow', label: 'Cow', speech: 'Cow. Moo, moo.', tip: 'Make a moo sound together.' },
    { id: 'duck', label: 'Duck', speech: 'Duck. Quack, quack.', tip: 'Can you say quack?' },
    { id: 'dog', label: 'Dog', speech: 'Dog. Woof, woof.', tip: 'Make a woof sound together.' },
    { id: 'cat', label: 'Cat', speech: 'Cat. Meow, meow.', tip: 'Can you say meow like a little cat?' },
    { id: 'pig', label: 'Pig', speech: 'Pig. Oink, oink.', tip: 'Make an oink sound together.' },
    { id: 'lamb', label: 'Lamb', speech: 'Lamb. Baa, baa.', tip: 'Say baa like a little lamb.' },
  ],
  colors: [
    { id: 'red', label: 'Red', hex: '#c73832', speech: 'Red. A red ball.', tip: 'Find something red near you.' },
    { id: 'yellow', label: 'Yellow', hex: '#efb82b', speech: 'Yellow. A yellow ball.', tip: 'Find something yellow near you.' },
    { id: 'blue', label: 'Blue', hex: '#3072bb', speech: 'Blue. A blue ball.', tip: 'Find something blue near you.' },
    { id: 'green', label: 'Green', hex: '#43814b', speech: 'Green. A green ball.', tip: 'Find something green near you.' },
  ],
  body: [
    { id: 'nose', label: 'Nose', speech: 'Nose. Here is my nose.', tip: 'Point to your nose. Then point to your child’s nose.' },
    { id: 'hands', label: 'Hands', speech: 'Hands. Clap your hands.', tip: 'Clap your hands together.' },
    { id: 'eyes', label: 'Eyes', speech: 'Eyes. Here are my eyes.', tip: 'Point to your own eyes.' },
    { id: 'feet', label: 'Feet', speech: 'Feet. Here are my feet.', tip: 'Touch your feet together.' },
  ],
  shapes: [
    { id: 'sphere', label: 'Ball', speech: 'Ball. A ball is round.', tip: 'Find a real ball. Roll it back and forth.' },
    { id: 'cube', label: 'Cube', speech: 'Cube. A cube has flat sides.', tip: 'Put a toy block on the floor.' },
    { id: 'triangle', label: 'Triangle', speech: 'Triangle. One, two, three sides.', tip: 'Trace the three sides with your finger.' },
  ],
};

export const categories = [
  ['animals', 'Animals', 'cow'],
  ['colors', 'Colors', 'colors'],
  ['body', 'My body', 'body'],
  ['shapes', 'Shapes', 'shapes'],
];
