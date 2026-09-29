/**
 * content.js — everything KEYFORGE asks the player to type.
 *
 * The three adaptive levels are the original word lists, unchanged. The key
 * drills, passages and Forge Trials were added in the shared-stack upgrade.
 */

/** Word lists by lesson. '1'–'3' are the original adaptive levels. */
export const LESSONS = {
  1: [
    'ask', 'sad', 'fall', 'all', 'dad', 'lad', 'flask', 'glass', 'dash', 'flash', 'jazz', 'calm', 'lamp', 'map', 'plan', 'land',
    'snap', 'sand', 'hand', 'fast', 'last', 'task', 'mask', 'salt', 'desk', 'read', 'rest', 'tree', 'free', 'safe', 'start', 'learn',
    'type', 'home', 'row', 'flow', 'focus', 'pace', 'clean', 'light', 'quiet', 'steady', 'soft', 'press', 'key', 'word', 'line', 'clear',
    'sound', 'space', 'skill', 'train', 'daily', 'small', 'steps', 'build', 'speed', 'form', 'touch', 'reach', 'center', 'index', 'shift',
    'enter',
  ],
  2: [
    'signal', 'vector', 'system', 'motion', 'render', 'shader', 'typing', 'rhythm', 'focus', 'neural', 'matrix', 'cursor', 'binary',
    'stream', 'engine', 'memory', 'module', 'syntax', 'object', 'method', 'thread', 'buffer', 'pixel', 'kernel', 'compute', 'layout',
    'timing', 'refine', 'precision', 'control', 'reactive', 'adaptive', 'practice', 'balance', 'forward', 'momentum', 'pattern',
    'sequence', 'velocity', 'dynamic', 'cobalt', 'quantum', 'circuit', 'console', 'variable', 'texture', 'material', 'camera', 'scene',
    'output', 'display', 'latency', 'response', 'desktop', 'hardware', 'frame', 'monitor', 'direct', 'smooth', 'stable', 'accurate',
    'repeat', 'improve', 'letters', 'finger', 'motion', 'tempo', 'target', 'success',
  ],
  3: [
    'synchronize', 'architecture', 'transmission', 'intermediate', 'configuration', 'implementation', 'instrumentation',
    'asynchronous', 'optimization', 'acceleration', 'interpolation', 'composition', 'procedural', 'performance', 'characteristic',
    'microarchitecture', 'compatibility', 'visualization', 'transformation', 'environment', 'distribution', 'concurrency',
    'deterministic', 'responsiveness', 'reconstruction', 'calibration', 'throughput', 'persistent', 'resolution', 'interaction',
    'fundamental', 'trajectory', 'simulation', 'refinement', 'continuous', 'discipline', 'ergonomic', 'technique', 'deliberate',
    'repetition', 'coordination', 'proficiency', 'consistency', 'correction', 'confidence', 'attention', 'efficiently', 'precision',
    'mechanical', 'interface', 'rendering', 'workgroup', 'pipeline', 'temporal', 'reflection', 'luminance', 'emissive', 'multiple',
    'attachment', 'bandwidth', 'algorithm', 'processor',
  ],
  // Key drills: every word stays on the home row (A S D F G H J K L).
  home: [
    'as', 'ad', 'add', 'adds', 'all', 'alas', 'ask', 'asks', 'ash', 'dad', 'dads', 'fad', 'fads', 'fall', 'falls', 'flag', 'flags',
    'flask', 'flasks', 'flash', 'gag', 'gal', 'gals', 'gas', 'gash', 'glad', 'glass', 'hall', 'halls', 'has', 'hash', 'had', 'half',
    'jag', 'jags', 'lad', 'lads', 'lag', 'lags', 'lash', 'lass', 'sad', 'salad', 'salads', 'sash', 'shall', 'slag', 'dash', 'gall',
    'hag', 'skald', 'alfalfa', 'flak', 'dahl', 'shad', 'slash', 'galls',
  ],
  // Every word stays on the top row (Q W E R T Y U I O P).
  top: [
    'we', 'wet', 'wit', 'wire', 'write', 'writer', 'type', 'typo', 'tree', 'true', 'trip', 'tire', 'tier', 'tore', 'toe', 'top', 'toy',
    'two', 'tow', 'tower', 'power', 'pour', 'poet', 'poetry', 'pot', 'pit', 'pet', 'put', 'pure', 'purity', 'prior', 'proper', 'property',
    'pretty', 'pottery', 'prototype', 'typewriter', 'proprietor', 'repertoire', 'quiet', 'quite', 'quote', 'query', 'equip', 'equity',
    'require', 'report', 'retire', 'retry', 'reroute', 'route', 'router', 'riot', 'ripe', 'rope', 'row', 'rupee', 'you', 'your', 'yet',
    'wiper', 'output', 'outwit', 'territory', 'tutor', 'error', 'terror', 'piety', 'pewter', 'trout', 'trio', 'treetop', 'tiptoe', 'upper',
  ],
  // Words built around the bottom row (Z X C V B N M) with the vowels they need.
  bottom: [
    'zinc', 'box', 'mix', 'vex', 'zoom', 'buzz', 'maze', 'zone', 'cabin', 'bench', 'venom', 'vacuum', 'bomb', 'climb', 'number',
    'member', 'maximum', 'minimum', 'mechanic', 'beacon', 'cabinet', 'combine', 'convex', 'index', 'vivid', 'zebra', 'amaze', 'cozy',
    'exam', 'fix', 'mob', 'cab', 'van', 'ban', 'can', 'man', 'bin', 'numb', 'became', 'common', 'cinema', 'become', 'nimble', 'vacant',
    'zombie', 'bronze', 'maxim', 'civic', 'cubic', 'mnemonic', 'vixen', 'combo', 'bamboo', 'banner', 'cannon', 'cynic',
  ],
};

/**
 * Passages are typed in order, word by word, one after another. They are
 * lower-case and free of punctuation because the drill checks letters only.
 */
export const PASSAGES = [
  { title: 'The Smith', text: 'The smith heats the bar until it glows like a sunrise, then strikes it with an even rhythm. Each blow is small, but the shape arrives because the rhythm never breaks.' },
  { title: 'Quiet Hands', text: 'Fast typing begins with quiet hands. Keep the fingers close to the home row, let each key come to you, and return before the next one is called.' },
  { title: 'Night Shift', text: 'The city sleeps while the servers hum in a cold room far below the streets. Every light on the rack is a small promise that the work will be there in the morning.' },
  { title: 'The River', text: 'A river does not rush to reach the sea. It simply keeps moving, around every stone and over every fall, until the distance is gone.' },
  { title: 'Practice', text: 'Practice is not the same as repetition. Repetition is doing the thing again. Practice is doing it again with attention on the one part that went wrong.' },
  { title: 'Signal', text: 'Somewhere a radio waits for a signal. It listens through the static for hours, and when the faint pattern finally arrives, it knows the message by its rhythm.' },
  { title: 'Clockwork', text: 'Inside the old clock a hundred small gears turn at their own speed. None of them is in a hurry, and yet together they never lose a single second.' },
  { title: 'Letters', text: 'Every word you type is built from the same small set of letters. The difference between a slow typist and a fast one is how well the hands know where each letter lives.' },
  { title: 'Forge Light', text: 'The forge light rises when the hammer lands clean and fades when the strike is rushed, so the smith learns to listen to the light as much as to the metal.' },
  { title: 'Mountain Road', text: 'The mountain road climbs in long patient turns. A driver who fights each corner arrives tired, while one who flows with the road arrives with time to spare.' },
  { title: 'Starlight', text: 'The light from a distant star left home before the first word was ever written. It has traveled all that way at one steady speed, and it still arrives right on time.' },
  { title: 'Rhythm', text: 'Rhythm is the secret of steady speed. When the fingers keep an even beat, the mind is free to read ahead, and the words begin to flow like music.' },
].map((p) => ({ ...p, words: p.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean) }));

/** How each lesson introduces itself in the lesson card. `focus` is shown until weak letters appear. */
export const LESSON_INFO = {
  1: { name: 'Foundation patterns', kind: 'ADAPTIVE DRILL', focus: 'HOME ROW', menu: 'Foundation' },
  2: { name: 'Balanced words', kind: 'ADAPTIVE DRILL', focus: 'HOME ROW', menu: 'Flow' },
  3: { name: 'Precision vocabulary', kind: 'ADAPTIVE DRILL', focus: 'HOME ROW', menu: 'Precision' },
  home: { name: 'Home row', kind: 'KEY DRILL', focus: 'HOME ROW', menu: 'Home row' },
  top: { name: 'Top row', kind: 'KEY DRILL', focus: 'TOP ROW', menu: 'Top row' },
  bottom: { name: 'Bottom row', kind: 'KEY DRILL', focus: 'BOTTOM ROW', menu: 'Bottom row' },
  prose: { name: 'Passages', kind: 'PASSAGE', focus: 'RHYTHM', menu: 'Passages' },
};

/** The LEVEL menu, in order. */
export const LESSON_GROUPS = [
  { label: 'Adaptive drill', lessons: ['1', '2', '3'] },
  { label: 'Key drills', lessons: ['home', 'top', 'bottom'] },
  { label: 'Prose', lessons: ['prose'] },
];

/** Session lengths: seconds, or a word-count sprint ('w25'). */
export const LENGTH_LABELS = { 30: '30 SEC', 60: '60 SEC', 120: '120 SEC', w25: '25 WORDS', w50: '50 WORDS' };

/**
 * The Forge Trials: a ladder of fixed sessions with pass marks. Passing one
 * unlocks the next; progress is saved on the device.
 */
export const TRIALS = [
  { id: 't1', name: 'Spark', lesson: 'home', length: '30', wpm: 12, acc: 90 },
  { id: 't2', name: 'Ember', lesson: 'top', length: '30', wpm: 15, acc: 90 },
  { id: 't3', name: 'Kindle', lesson: 'bottom', length: '30', wpm: 15, acc: 90 },
  { id: 't4', name: 'Anvil', lesson: '1', length: '60', wpm: 22, acc: 92 },
  { id: 't5', name: 'Temper', lesson: '2', length: '60', wpm: 28, acc: 93 },
  { id: 't6', name: 'Quench', lesson: 'prose', length: '60', wpm: 32, acc: 94 },
  { id: 't7', name: 'Hone', lesson: '3', length: '60', wpm: 36, acc: 95 },
  { id: 't8', name: 'Keyforged', lesson: 'prose', length: 'w50', wpm: 45, acc: 96 },
];

export const COACH_TIPS = [
  'Use the key with the correct finger. Keep finger travel short and return to the home row.',
  'Do not chase WPM after an error. Restore rhythm with two or three clean words.',
  'Keep your shoulders relaxed and wrists neutral. Let the fingers do the movement.',
  'Read one word ahead while your fingers finish the current word.',
  'Use a light key press. Extra force does not improve accuracy.',
  'Build a steady cadence. Large speed bursts often increase correction time.',
];
export const READY_TIP = 'Keep your wrists neutral. Type for accuracy first; speed follows clean repetitions.';

/** Streak lengths that set off the forge. */
export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 300];

export const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['SPACE'],
];

/** Touch-typing finger for each key (QWERTY positions). */
export const FINGER_OF = {
  q: 'lp', a: 'lp', z: 'lp',
  w: 'lr', s: 'lr', x: 'lr',
  e: 'lm', d: 'lm', c: 'lm',
  r: 'li', f: 'li', v: 'li', t: 'li', g: 'li', b: 'li',
  y: 'ri', h: 'ri', n: 'ri', u: 'ri', j: 'ri', m: 'ri',
  i: 'rm', k: 'rm',
  o: 'rr', l: 'rr',
  p: 'rp',
  space: 'th',
};
export const FINGER_NAMES = {
  lp: 'LEFT PINKY', lr: 'LEFT RING', lm: 'LEFT MIDDLE', li: 'LEFT INDEX',
  ri: 'RIGHT INDEX', rm: 'RIGHT MIDDLE', rr: 'RIGHT RING', rp: 'RIGHT PINKY', th: 'THUMB',
};
