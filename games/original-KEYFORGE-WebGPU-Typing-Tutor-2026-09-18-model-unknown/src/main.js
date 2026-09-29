/**
 * main.js — KEYFORGE, an adaptive typing tutor over a WebGPU forge.
 *
 * Typed characters come from keydown `e.key`, handled in order as they
 * arrive: a typing tutor must follow the player's keyboard layout (AZERTY,
 * Dvorak…) and must not lose or reorder two keys pressed within one frame,
 * which per-frame actions keyed by physical key codes would do. Everything
 * else runs through kit.input actions: start, pause and restart on the
 * keyboard, controller typing (D-pad cursor over the on-screen keyboard, A to
 * type, X for space), controller and arrow-key navigation of the menus, and
 * tapping the on-screen keys on touch screens.
 */

import { boot } from 'kit/boot.js';
import { createBackdrop, createFx } from './scene.js';
import {
  LESSONS, PASSAGES, LESSON_INFO, LESSON_GROUPS, LENGTH_LABELS, TRIALS, COACH_TIPS, READY_TIP, MILESTONES,
  KEY_ROWS, FINGER_OF, FINGER_NAMES,
} from './content.js';
import { loadProfile, saveProfile, modeKey, modeRecord, recordRun, recordKeys, errorRate, lifetimeWeakLetters } from './profile.js';

const $ = (id) => document.getElementById(id);
const ui = {
  wpm: $('wpm'),
  accuracy: $('accuracy'),
  streak: $('streak'),
  score: $('score'),
  timer: $('timer'),
  lessonCard: $('lessonCard'),
  lessonKind: $('lessonKind'),
  lessonName: $('lessonName'),
  focusDisplay: $('focusDisplay'),
  prevWord: $('prevWord'),
  activeWord: $('activeWord'),
  nextWord: $('nextWord'),
  nextNextWord: $('nextNextWord'),
  progressFill: $('progressFill'),
  statusText: $('statusText'),
  fingerHint: $('fingerHint'),
  bestText: $('bestText'),
  streakCallout: $('streakCallout'),
  keyboard: $('keyboard'),
  duration: $('durationSelect'),
  difficulty: $('difficultySelect'),
  start: $('startButton'),
  pause: $('pauseButton'),
  sound: $('soundButton'),
  settings: $('settingsButton'),
  coachBadge: $('coachBadge'),
  coachText: $('coachText'),
  weakLabel: $('weakLabel'),
  weakLetterChips: $('weakLetterChips'),
  trialCount: $('trialCount'),
  trialPips: $('trialPips'),
  finish: $('finishModal'),
  finishEyebrow: $('finishEyebrow'),
  finishTitle: $('finishTitle'),
  again: $('againButton'),
  close: $('closeButton'),
  finalWpm: $('finalWpm'),
  finalAccuracy: $('finalAccuracy'),
  finalThirdLabel: $('finalThirdLabel'),
  finalWords: $('finalWords'),
  finalStreak: $('finalStreak'),
  finalBadge: $('finalBadge'),
  historyLabel: $('historyLabel'),
  historyBars: $('historyBars'),
  finalCoach: $('finalCoach'),
  gpuPill: $('gpuPill'),
  gpuLabel: $('gpuLabel'),
  footerHints: $('footerHints'),
};

// ---- saved progress

const profile = loadProfile();
const prefs = profile.prefs;
const persist = () => saveProfile(profile);

// ---- text writes: only when the value changes (the HUD refreshes every frame)

const shown = new Map();
const show = (el, text) => {
  if (!el || shown.get(el) === text) return;
  shown.set(el, text);
  el.textContent = text;
};

// ---- on-screen keyboard (tap to type on touch screens, controller cursor)

const keyEls = new Map();
const keyGrid = [];
for (const row of KEY_ROWS) {
  const rowEl = document.createElement('div');
  rowEl.className = 'key-row';
  const gridRow = [];
  for (const label of row) {
    const el = document.createElement('div');
    const key = label.toLowerCase();
    el.className = `key${label === 'SPACE' ? ' space' : ''}`;
    el.textContent = label;
    el.dataset.key = key;
    if (FINGER_OF[key]) el.dataset.finger = FINGER_OF[key];
    rowEl.appendChild(el);
    keyEls.set(key, el);
    gridRow.push(el);
  }
  ui.keyboard.appendChild(rowEl);
  keyGrid.push(gridRow);
}
const charOf = (el) => (el.dataset.key === 'space' ? ' ' : el.dataset.key);
let targetEl = null;

// ---- state

const state = {
  mode: 'ready', // ready | running | paused | finished
  words: [],
  /** Per word: the passage it came from (Passages), else -1. */
  tags: [],
  wordIndex: 0,
  charIndex: 0,
  awaitingSpace: false,
  correctChars: 0,
  typedChars: 0,
  completedWords: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  /** Timed sessions: length in seconds. Sprints: 0. */
  sessionSeconds: 60,
  /** Sprints: words to type. Timed sessions: 0. */
  targetWords: 0,
  /** 0 until the first key of the session: the clock starts on the first keystroke. */
  startedAt: 0,
  pauseStartedAt: 0,
  pausedTotal: 0,
  endedAt: 0,
  mistakes: new Map(),
  hits: new Map(),
  weakLetters: [],
  weakFromProfile: false,
  sound: prefs.sound !== false,
  errorFlash: false,
  wordsSinceCoach: 0,
  /** The trial the results screen offers next, if the one just run was passed. */
  nextTrial: null,
};

const fx = createFx();
/** Set once boot() resolves; event handlers that can fire during loading check it first. */
let kit = null;
/** The control the controller or arrow keys focused (outlined), if any. */
let padFocus = null;
/** The controller's key cursor over the on-screen keyboard; starts on F, the left index finger's home key. */
const cursor = { row: 1, col: 3 };
let cursorEl = null;
ui.sound.textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';

// ---- prompts that follow the device in use

let device = 'keyboard'; // keyboard | gamepad | touch
let statusKey = 'ready';
const STATUS = {
  ready: { keyboard: 'Press Enter to start', gamepad: 'Press A to start', touch: 'Tap START SESSION to begin' },
  armed: {
    keyboard: 'Start typing · the clock starts on your first key',
    gamepad: 'D-pad picks a key, A types · the clock starts on your first key',
    touch: 'Tap the keys below · the clock starts on your first key',
  },
  live: { keyboard: 'Type the highlighted character', gamepad: 'D-pad picks a key · A types · X is space', touch: 'Tap the highlighted key' },
  space: { keyboard: 'Finish the word with Space', gamepad: 'Finish the word with X (space)', touch: 'Finish the word with SPACE' },
  resumed: { keyboard: 'Session resumed', gamepad: 'Session resumed', touch: 'Session resumed' },
  paused: { keyboard: 'Paused · press Escape to resume', gamepad: 'Paused · press Start to resume', touch: 'Paused · tap RESUME to continue' },
  done: { keyboard: 'Session complete · Enter to go again', gamepad: 'Session complete · A to go again', touch: 'Session complete' },
};
const HINTS = {
  keyboard: [['ENTER', 'start'], ['ESC', 'pause'], ['TAB', 'restart'], ['F9', 'settings']],
  gamepad: [['A', 'start / type'], ['D-PAD', 'pick key'], ['X', 'space'], ['B', 'back'], ['START', 'pause'], ['VIEW', 'restart']],
  touch: [['TAP', 'keys to type'], ['START', 'session'], ['PAUSE', 'break']],
};

function setStatus(key) {
  statusKey = key;
  show(ui.statusText, STATUS[key]?.[device] ?? '');
}

function renderHints() {
  ui.footerHints.replaceChildren(
    ...HINTS[device].map(([k, label]) => {
      const span = document.createElement('span');
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      span.append(kbd, ` ${label}`);
      return span;
    })
  );
}

function setDevice(next) {
  if (next === device) return;
  device = next;
  renderHints();
  setStatus(statusKey);
  updatePadCursor();
}

// ---- what is selected: lesson and length, or a Forge Trial that fixes both

const trialUnlocked = (i) => i === 0 || !!profile.trials[TRIALS[i - 1].id];

function selection() {
  const v = ui.difficulty.value || '2';
  if (v.startsWith('trial:')) {
    const index = TRIALS.findIndex((t) => `trial:${t.id}` === v);
    if (index >= 0) {
      const trial = TRIALS[index];
      return { lesson: trial.lesson, length: trial.length, trial, index };
    }
  }
  return {
    lesson: LESSON_INFO[v] ? v : '2',
    length: LENGTH_LABELS[ui.duration.value] ? ui.duration.value : '60',
    trial: null,
    index: -1,
  };
}

function lengthSpec(length) {
  const s = String(length);
  return s.startsWith('w') ? { seconds: 0, words: Number(s.slice(1)) || 25 } : { seconds: Number(s) || 60, words: 0 };
}

/** The LEVEL menu: adaptive levels, key drills, passages, then the trials (locked ones greyed out). */
function buildLevelMenu() {
  const keep = ui.difficulty.value;
  ui.difficulty.replaceChildren();
  for (const group of LESSON_GROUPS) {
    const og = document.createElement('optgroup');
    og.label = group.label;
    for (const id of group.lessons) og.append(new Option(LESSON_INFO[id].menu, id));
    ui.difficulty.append(og);
  }
  const og = document.createElement('optgroup');
  og.label = 'Forge Trials';
  TRIALS.forEach((t, i) => {
    const unlocked = trialUnlocked(i);
    const tag = profile.trials[t.id] ? ' · passed' : unlocked ? '' : ' · locked';
    const opt = new Option(`T${i + 1} ${t.name}${tag}`, `trial:${t.id}`);
    opt.disabled = !unlocked;
    og.append(opt);
  });
  ui.difficulty.append(og);
  ui.difficulty.value = keep;
  if (ui.difficulty.selectedIndex < 0 || ui.difficulty.selectedOptions[0]?.disabled) ui.difficulty.value = '2';
}

function renderTrials() {
  const passed = TRIALS.filter((t) => profile.trials[t.id]).length;
  show(ui.trialCount, `${passed}/${TRIALS.length}`);
  ui.trialPips.replaceChildren(
    ...TRIALS.map((t, i) => {
      const pip = document.createElement('i');
      pip.className = profile.trials[t.id] ? 'is-passed' : trialUnlocked(i) ? 'is-open' : '';
      pip.title = `T${i + 1} ${t.name} · ${t.wpm} WPM at ${t.acc}%`;
      return pip;
    })
  );
}

const trialBrief = (trial, index) =>
  `Forge Trial ${index + 1} · ${trial.name}: reach ${trial.wpm} WPM at ${trial.acc}% accuracy over ${LENGTH_LABELS[trial.length].toLowerCase()} of ${LESSON_INFO[trial.lesson].name.toLowerCase()}.`;

/** Selects, lesson header and personal best follow the selection; selects lock while a session runs. */
function applySelection() {
  const sel = selection();
  if (sel.trial) ui.duration.value = sel.trial.length;
  else if (LENGTH_LABELS[prefs.length] && ui.duration.value !== prefs.length) ui.duration.value = prefs.length;
  const idle = state.mode === 'ready' || state.mode === 'finished';
  ui.difficulty.disabled = !idle;
  ui.duration.disabled = !idle || !!sel.trial;
  renderLessonHeader();
  renderBest();
}

function renderLessonHeader() {
  const sel = selection();
  const info = LESSON_INFO[sel.lesson];
  show(ui.lessonKind, sel.trial ? `FORGE TRIAL ${sel.index + 1}/${TRIALS.length}` : info.kind);
  let name = sel.trial ? `${sel.trial.name} · ${info.name}` : info.name;
  const tag = state.tags[state.wordIndex];
  if (sel.lesson === 'prose' && tag >= 0 && PASSAGES[tag]) name += ` · ${PASSAGES[tag].title}`;
  show(ui.lessonName, name);
  renderFocus();
}

function renderFocus() {
  const sel = selection();
  if (sel.trial) {
    show(ui.focusDisplay, `TARGET · ${sel.trial.wpm} WPM · ${sel.trial.acc}%`);
    return;
  }
  const focus = state.weakLetters.length ? state.weakLetters.map((ch) => ch.toUpperCase()).join(' · ') : LESSON_INFO[sel.lesson].focus;
  show(ui.focusDisplay, `FOCUS · ${focus}`);
}

function renderBest() {
  const sel = selection();
  const m = modeRecord(profile, modeKey(sel.lesson, sel.length));
  let text = 'BEST · —';
  if (m && lengthSpec(sel.length).words && m.time) text = `BEST · ${m.time.toFixed(1)}S · ${m.wpm} WPM`;
  else if (m && m.wpm) text = `BEST · ${m.wpm} WPM`;
  show(ui.bestText, text);
}

// ---- the drill

const prose = { passage: 0, word: 0 };

function pickWord(lesson) {
  const list = LESSONS[lesson] || LESSONS[2];
  if (state.weakLetters.length === 0 || Math.random() > 0.62) return list[Math.floor(Math.random() * list.length)];
  const letter = state.weakLetters[Math.floor(Math.random() * state.weakLetters.length)];
  const matches = list.filter((w) => w.includes(letter));
  const from = matches.length ? matches : list;
  return from[Math.floor(Math.random() * from.length)];
}

/** Passages run in order; when one ends a different one follows. */
function nextProseWord() {
  if (prose.word >= PASSAGES[prose.passage].words.length) {
    let next = Math.floor(Math.random() * (PASSAGES.length - 1));
    if (next >= prose.passage) next += 1;
    prose.passage = next;
    prose.word = 0;
  }
  return PASSAGES[prose.passage].words[prose.word++];
}

function extendWords(count = 12) {
  const { lesson } = selection();
  let last = state.words[state.words.length - 1] || '';
  for (let i = 0; i < count; i++) {
    if (lesson === 'prose') {
      // nextProseWord moves on to the next passage first when needed, so the word is always from prose.passage.
      state.words.push(nextProseWord());
      state.tags.push(prose.passage);
      continue;
    }
    let w = pickWord(lesson);
    if (w === last) w = pickWord(lesson);
    state.words.push(w);
    state.tags.push(-1);
    last = w;
  }
}

const currentWord = () => state.words[state.wordIndex] || '';

function renderWord() {
  if (state.wordIndex > state.words.length - 7) extendWords(12);
  const word = currentWord();
  show(ui.prevWord, state.words[state.wordIndex - 1] || 'ready');
  show(ui.nextWord, state.words[state.wordIndex + 1] || '');
  show(ui.nextNextWord, state.words[state.wordIndex + 2] || '');
  ui.activeWord.replaceChildren(
    ...[...word].map((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.className = i < state.charIndex ? 'done' : i === state.charIndex ? (state.errorFlash ? 'wrong' : 'current') : 'pending';
      return span;
    })
  );
  const target = state.awaitingSpace ? 'space' : word[state.charIndex]?.toLowerCase();
  const el = keyEls.get(target) || null;
  if (el !== targetEl) {
    targetEl?.classList.remove('target');
    el?.classList.add('target');
    targetEl = el;
  }
  show(ui.fingerHint, target && FINGER_OF[target] ? FINGER_NAMES[FINGER_OF[target]] : '');
  if (selection().lesson === 'prose') renderLessonHeader();
}

function flashKey(ch, cls) {
  const el = keyEls.get(ch === ' ' ? 'space' : ch.toLowerCase());
  if (!el) return;
  el.classList.remove('pressed', 'missed');
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 120);
}

let shownChips = null;
/** This session's weakest letters once it has mistakes; until then, the lifetime profile's. */
function updateWeakLetters() {
  const session = [...state.mistakes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ch]) => ch);
  state.weakFromProfile = session.length === 0;
  state.weakLetters = session.length ? session : lifetimeWeakLetters(profile);
  const chips = state.weakLetters.join('');
  if (chips !== shownChips) {
    shownChips = chips;
    if (state.weakLetters.length) {
      ui.weakLetterChips.replaceChildren(
        ...state.weakLetters.map((ch) => {
          const chip = document.createElement('span');
          chip.className = 'letter-chip';
          chip.textContent = ch.toUpperCase();
          return chip;
        })
      );
    } else {
      const none = document.createElement('i');
      none.textContent = '—';
      ui.weakLetterChips.replaceChildren(none);
    }
  }
  show(ui.weakLabel, state.weakFromProfile && state.weakLetters.length ? 'WEAK LETTERS · ALL TIME' : 'WEAK LETTERS');
  renderFocus();
}

/** Lifetime accuracy per key, shown as a heat tint on the keyboard between sessions. */
function renderHeat() {
  for (const [key, el] of keyEls) {
    if (key === 'space') continue;
    const r = errorRate(profile, key);
    const k = profile.keys[key];
    el.style.setProperty('--heat', r === null ? '0' : Math.min(1, r / 0.15).toFixed(2));
    el.title = r === null ? `${key.toUpperCase()} · not enough practice yet` : `${key.toUpperCase()} · ${Math.round((1 - r) * 100)}% accurate over ${k[0] + k[1]} presses`;
  }
}

/** Seconds of typing so far: from the first key, not counting pauses. */
function activeSeconds() {
  if (!state.startedAt) return 0;
  const end = state.mode === 'paused' ? state.pauseStartedAt : state.mode === 'finished' ? state.endedAt : performance.now();
  const s = Math.max(0, (end - state.startedAt - state.pausedTotal) / 1000);
  return state.sessionSeconds ? Math.min(state.sessionSeconds, s) : s;
}

function measure(secs = activeSeconds()) {
  // At least one second, so the first keystrokes do not read as thousands of WPM.
  const wpm = Math.round(state.correctChars / 5 / (Math.max(1, secs) / 60));
  // Rounded down: one miss in 200 keys reads 99%, never 100%.
  const accuracy = state.typedChars === 0 || state.correctChars === state.typedChars ? 100 : Math.floor((state.correctChars / state.typedChars) * 100);
  return { wpm: Number.isFinite(wpm) ? wpm : 0, accuracy };
}

let shownProgress = -1;

function renderStats() {
  const secs = activeSeconds();
  const { wpm, accuracy } = measure(secs);
  show(ui.wpm, String(wpm));
  show(ui.accuracy, `${accuracy}%`);
  show(ui.streak, String(state.streak));
  show(ui.score, state.score.toLocaleString());
  let progress;
  if (state.targetWords) {
    // Sprints count up; the bar fills with words.
    show(ui.timer, secs.toFixed(1));
    progress = state.completedWords / state.targetWords;
  } else {
    show(ui.timer, Math.max(0, state.sessionSeconds - secs).toFixed(1));
    progress = secs / state.sessionSeconds;
  }
  const rounded = Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 1000;
  if (rounded !== shownProgress) {
    shownProgress = rounded;
    ui.progressFill.style.transform = `scaleX(${rounded})`;
  }
}

/** Classes that follow the session state: heatmap between sessions, blurred words while paused. */
function syncModeUi() {
  const idle = state.mode === 'ready' || state.mode === 'finished';
  ui.keyboard.classList.toggle('show-heat', idle);
  ui.lessonCard.classList.toggle('is-paused', state.mode === 'paused');
  ui.lessonCard.classList.toggle('is-armed', state.mode === 'running' && !state.startedAt);
  updatePadCursor();
}

function hideFinish() {
  ui.finish.classList.add('hidden');
  state.nextTrial = null;
}

function resetSession() {
  const sel = selection();
  const spec = lengthSpec(sel.length);
  state.mode = 'ready';
  state.words = [];
  state.tags = [];
  state.wordIndex = 0;
  state.charIndex = 0;
  state.awaitingSpace = false;
  state.correctChars = 0;
  state.typedChars = 0;
  state.completedWords = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.sessionSeconds = spec.seconds;
  state.targetWords = spec.words;
  state.startedAt = 0;
  state.pauseStartedAt = 0;
  state.pausedTotal = 0;
  state.endedAt = 0;
  state.mistakes.clear();
  state.hits.clear();
  state.errorFlash = false;
  state.wordsSinceCoach = 0;
  if (sel.lesson === 'prose') {
    prose.passage = Math.floor(Math.random() * PASSAGES.length);
    prose.word = 0;
  }
  // Weak letters first: the adaptive drill draws its opening words from them.
  updateWeakLetters();
  extendWords(12);
  ui.pause.disabled = true;
  ui.pause.textContent = 'PAUSE';
  ui.start.textContent = 'START SESSION';
  setStatus('ready');
  ui.coachBadge.textContent = 'READY';
  ui.coachText.textContent = sel.trial ? trialBrief(sel.trial, sel.index) : READY_TIP;
  ui.lessonCard.classList.remove('error', 'success');
  hideFinish();
  applySelection();
  renderWord();
  renderStats();
  syncModeUi();
  fx.setIntensity(0.2);
}

function startSession() {
  if (state.mode === 'running') return;
  if (state.mode === 'paused') {
    resumeSession();
    return;
  }
  resetSession();
  state.mode = 'running';
  ui.pause.disabled = false;
  ui.start.textContent = 'RUNNING';
  setStatus('armed');
  ui.coachBadge.textContent = 'LIVE';
  applySelection();
  fx.setIntensity(0.5);
  beep(330, 0.05, 0.03);
  enterTyping();
  syncModeUi();
}

function resumeSession() {
  if (state.mode !== 'paused') return;
  if (state.startedAt) state.pausedTotal += performance.now() - state.pauseStartedAt;
  state.mode = 'running';
  ui.pause.textContent = 'PAUSE';
  setStatus(state.startedAt ? 'resumed' : 'armed');
  ui.coachBadge.textContent = 'LIVE';
  fx.setIntensity(state.startedAt ? 0.75 : 0.5);
  enterTyping();
  syncModeUi();
}

/** Typing starts: nothing keeps focus, so Space and letters cannot activate a button or a select. */
function enterTyping() {
  clearPadFocus();
  document.activeElement?.blur?.();
}

function pauseSession() {
  if (state.mode !== 'running') return;
  state.mode = 'paused';
  state.pauseStartedAt = performance.now();
  ui.pause.textContent = 'RESUME';
  setStatus('paused');
  ui.coachBadge.textContent = 'PAUSED';
  fx.setIntensity(0.18);
  syncModeUi();
}

function togglePause() {
  if (state.mode === 'running') pauseSession();
  else if (state.mode === 'paused') resumeSession();
}

function finishSession() {
  if (state.mode === 'finished') return;
  state.endedAt = performance.now();
  state.mode = 'finished';
  const secs = activeSeconds();
  const { wpm, accuracy } = measure(secs);
  const sel = selection();
  const sprint = state.targetWords > 0;
  const time = sprint ? Math.round(secs * 10) / 10 : 0;
  const key = modeKey(sel.lesson, sel.length);
  const rec = recordRun(profile, key, { wpm, acc: accuracy, time });
  recordKeys(profile, state.hits, state.mistakes);

  let trial = null;
  if (sel.trial) {
    const passed = wpm >= sel.trial.wpm && accuracy >= sel.trial.acc;
    const before = profile.trials[sel.trial.id];
    if (passed && (!before || wpm > before.wpm)) profile.trials[sel.trial.id] = { wpm, acc: accuracy };
    trial = { passed, firstPass: passed && !before, next: passed ? TRIALS[sel.index + 1] || null : null };
  }
  persist();

  // ---- results screen
  ui.finishEyebrow.textContent = sel.trial ? `FORGE TRIAL ${sel.index + 1} · ${trial.passed ? 'PASSED' : 'NOT YET'}` : 'SESSION COMPLETE';
  ui.finishTitle.textContent = sel.trial ? sel.trial.name : 'Run summary';
  ui.finalWpm.textContent = wpm;
  ui.finalAccuracy.textContent = `${accuracy}%`;
  ui.finalThirdLabel.textContent = sprint ? 'Time' : 'Words';
  ui.finalWords.textContent = sprint ? `${time.toFixed(1)}s` : String(state.completedWords);
  ui.finalStreak.textContent = state.bestStreak;

  const m = modeRecord(profile, key);
  let badge;
  let tone = '';
  if (trial) {
    if (trial.passed) {
      tone = 'good';
      badge = trial.firstPass && trial.next ? `PASSED · TRIAL ${sel.index + 2} ${trial.next.name.toUpperCase()} UNLOCKED` : trial.next ? 'PASSED' : 'PASSED · EVERY TRIAL FORGED';
    } else {
      tone = 'miss';
      badge = `NEED ${sel.trial.wpm} WPM AT ${sel.trial.acc}% · THIS RUN ${wpm} AT ${accuracy}%`;
    }
  } else if (rec.first) {
    badge = 'FIRST RUN IN THIS MODE · RECORD SET';
  } else if (rec.bestWpm || rec.bestTime) {
    tone = 'good';
    badge = sprint && rec.bestTime ? `NEW PERSONAL BEST · ${time.toFixed(1)}S` : `NEW PERSONAL BEST · ${wpm} WPM`;
  } else {
    badge = sprint && m.time ? `PERSONAL BEST · ${m.time.toFixed(1)}S · ${m.wpm} WPM` : `PERSONAL BEST · ${m.wpm} WPM`;
  }
  ui.finalBadge.textContent = badge;
  ui.finalBadge.className = `final-badge${tone ? ` is-${tone}` : ''}`;

  ui.historyLabel.textContent = `RECENT · ${LESSON_INFO[sel.lesson].menu.toUpperCase()} · ${LENGTH_LABELS[sel.length]}`;
  const runs = m.runs;
  const top = Math.max(10, ...runs.map((r) => r.wpm));
  ui.historyBars.replaceChildren(
    ...runs.map((r, i) => {
      const bar = document.createElement('i');
      bar.style.height = `${Math.max(6, Math.round((r.wpm / top) * 100))}%`;
      bar.title = `${r.wpm} WPM · ${r.acc}%${r.time ? ` · ${r.time.toFixed(1)}s` : ''}`;
      if (i === runs.length - 1) bar.className = 'is-latest';
      return bar;
    })
  );

  ui.finalCoach.textContent =
    accuracy >= 97
      ? `${rec.overall ? 'New WPM best. ' : ''}Accuracy is strong. Keep the same form and add speed gradually.`
      : accuracy >= 92
        ? 'Good pace. Reduce early key presses and keep your eyes one word ahead.'
        : 'Slow the cadence slightly. A cleaner next run will train stronger key patterns.';

  state.nextTrial = trial?.next || null;
  ui.again.textContent = state.nextTrial ? 'NEXT TRIAL' : 'RUN AGAIN';
  ui.finish.classList.remove('hidden');
  ui.pause.disabled = true;
  ui.start.textContent = 'START SESSION';
  ui.coachBadge.textContent = 'DONE';
  setStatus('done');
  if (trial?.firstPass) {
    buildLevelMenu();
    renderTrials();
  }
  applySelection();
  renderStats();
  renderHeat();
  updateWeakLetters();
  syncModeUi();

  fx.celebrate();
  if (trial?.passed) fx.milestone(1.7, 0xffd479);
  kit?.input.rumble(trial?.passed ? 0.6 : 0.35, trial?.passed ? 260 : 160);
  beep(660, 0.11, 0.06);
  setTimeout(() => beep(880, 0.12, 0.05), 90);
  if (trial?.passed) setTimeout(() => beep(1320, 0.18, 0.05), 190);
}

let calloutTimer = 0;
function showCallout(text, variant) {
  const el = ui.streakCallout;
  el.textContent = text;
  el.className = `streak-callout${variant ? ` is-${variant}` : ''}`;
  void el.offsetWidth; // restart the animation
  el.classList.add('is-on');
  clearTimeout(calloutTimer);
  calloutTimer = setTimeout(() => el.classList.remove('is-on'), 1400);
}

function streakMilestone(streak) {
  const power = streak >= 100 ? 1.6 : streak >= 50 ? 1.3 : 1;
  const variant = streak >= 100 ? 'gold' : streak >= 50 ? 'violet' : '';
  fx.milestone(power, streak >= 100 ? 0xffd479 : streak >= 50 ? 0xb479ff : 0x6ef2ff);
  showCallout(`STREAK ${streak}`, variant);
  kit?.input.rumble(0.25 + power * 0.15, 140);
  beep(660, 0.06, 0.03);
  setTimeout(() => beep(880, 0.06, 0.03), 70);
  setTimeout(() => beep(1175, 0.09, 0.03), 140);
}

function completeWord() {
  state.completedWords += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  const wordScore = currentWord().length * 12;
  const streakBonus = Math.min(350, state.streak * 8);
  state.score += wordScore + streakBonus;
  state.wordIndex += 1;
  state.charIndex = 0;
  state.awaitingSpace = false;
  state.wordsSinceCoach += 1;
  ui.lessonCard.classList.add('success');
  setTimeout(() => ui.lessonCard.classList.remove('success'), 110);
  fx.wordHit(state.streak);
  beep(520 + Math.min(260, state.streak * 8), 0.035, 0.022);
  if (MILESTONES.includes(state.streak)) streakMilestone(state.streak);
  if (state.wordsSinceCoach >= 7) {
    state.wordsSinceCoach = 0;
    const { accuracy } = measure();
    ui.coachText.textContent =
      accuracy < 94 ? 'Accuracy is dropping. Reduce speed until the next five words are clean.' : COACH_TIPS[Math.floor(Math.random() * COACH_TIPS.length)];
  }
  setStatus('live');
  renderWord();
  if (state.targetWords && state.completedWords >= state.targetWords) finishSession();
}

function missKey(expected, typed) {
  state.streak = 0;
  state.errorFlash = true;
  if (expected !== ' ') {
    state.mistakes.set(expected, (state.mistakes.get(expected) || 0) + 1);
    updateWeakLetters();
  }
  ui.lessonCard.classList.remove('error');
  void ui.lessonCard.offsetWidth; // restart the shake animation
  ui.lessonCard.classList.add('error');
  setTimeout(() => {
    state.errorFlash = false;
    ui.lessonCard.classList.remove('error');
    if (state.mode === 'running' || state.mode === 'paused') renderWord();
  }, 160);
  flashKey(typed, 'missed');
  fx.miss();
  kit?.input.rumble(0.25, 70);
  beep(118, 0.045, 0.035, 'square');
}

/** One typed character, from the keyboard, a tapped on-screen key or the controller. */
function typeChar(ch) {
  if (state.mode !== 'running') return;
  const typed = ch.toLowerCase();
  const expected = state.awaitingSpace ? ' ' : currentWord()[state.charIndex]?.toLowerCase();
  if (!expected) return;
  if (!state.startedAt) {
    // The clock starts with the first key, so reading the first word is free.
    state.startedAt = performance.now();
    setStatus('live');
    fx.setIntensity(0.75);
    syncModeUi();
  }
  state.typedChars += 1;
  if (typed === expected) {
    state.correctChars += 1;
    if (typed !== ' ') state.hits.set(typed, (state.hits.get(typed) || 0) + 1);
    state.score += 2 + Math.min(12, Math.floor(state.streak / 3));
    flashKey(typed, 'pressed');
    fx.keyHit();
    beep(265 + (typed.charCodeAt(0) % 10) * 12, 0.018, 0.01);
    if (state.awaitingSpace) {
      completeWord();
    } else {
      state.charIndex += 1;
      if (state.charIndex >= currentWord().length) {
        if (state.targetWords && state.completedWords + 1 >= state.targetWords) {
          // A sprint's last word needs no trailing space.
          completeWord();
        } else {
          state.awaitingSpace = true;
          setStatus('space');
          renderWord();
        }
      } else {
        renderWord();
      }
    }
  } else {
    missKey(expected, typed);
  }
  if (state.mode === 'running') renderStats();
}

// ---- sound: short synth blips, the context unlocked by the first gesture

let audio = null;
function unlockAudio() {
  if (!state.sound) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended' && !kit?.paused) audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

function beep(freq, duration, gain, type = 'sine') {
  if (!state.sound) return;
  unlockAudio();
  if (!audio || audio.state !== 'running') return;
  try {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(1e-4, audio.currentTime + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    /* audio is decoration */
  }
}

// ---- restore the last drill, then boot the shared 3D stack

buildLevelMenu();
if (typeof prefs.level === 'string') {
  ui.difficulty.value = prefs.level;
  if (ui.difficulty.selectedIndex < 0 || ui.difficulty.selectedOptions[0]?.disabled) ui.difficulty.value = '2';
}
if (!LENGTH_LABELS[prefs.length]) prefs.length = ui.duration.value;
if (!selection().trial) ui.duration.value = prefs.length;
renderTrials();
renderHeat();
resetSession();
renderHints();

kit = await boot({
  title: 'KEYFORGE',
  canvas: $('stage'),
  gear: 'none', // the topbar has its own SETTINGS button (F9 works too)
  accent: '#6ef2ff',
  background: '#05070d',
  input: {
    // Menus: Enter / A starts a session or presses the focused control.
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
    // P is a letter to type here, so pause is Escape (and Start) only.
    pause: { keys: ['Escape'], gamepad: ['Start'] },
    restart: { keys: ['Tab'], gamepad: ['Back'] },
    // Arrows and the D-pad move between controls; while typing, the D-pad moves the key cursor.
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    // Controller typing.
    padType: { gamepad: ['A'] },
    padSpace: { gamepad: ['X'] },
  },
});

const backdrop = createBackdrop(kit, fx);
const input = kit.input;

ui.gpuLabel.textContent = kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2';
ui.gpuPill.classList.toggle('is-webgl2', kit.backend !== 'webgpu');
const adapterVendor = window.__kit?.adapter?.vendor;
ui.gpuPill.title = `${kit.backendLabel}${adapterVendor ? ` · ${adapterVendor}` : ''}`;

device = input.source === 'touch' ? 'touch' : input.source === 'gamepad' ? 'gamepad' : 'keyboard';
renderHints();
setStatus(statusKey);
input.onSourceChange((src) => setDevice(src === 'gamepad' ? 'gamepad' : src === 'touch' ? 'touch' : 'keyboard'));
// Taps on the interface are not on the canvas, so the kit does not see them: follow them here.
addEventListener('pointerdown', (e) => setDevice(e.pointerType === 'touch' ? 'touch' : 'keyboard'), true);
addEventListener('keydown', () => setDevice('keyboard'), true);

// A session never runs down while the game cannot be played.
kit.onPause((paused) => {
  if (paused) {
    pauseSession();
    audio?.suspend?.().catch(() => {});
  } else if (state.sound) {
    audio?.resume?.().catch(() => {});
  }
});
document.addEventListener('visibilitychange', () => document.hidden && pauseSession());
addEventListener('blur', () => pauseSession());

// ---- keyboard typing (ordered, layout-aware: see the note at the top)

document.addEventListener('keydown', (e) => {
  // The kit treats a focused <select> like a text field and ignores keys there: hand the
  // game's own keys back so Enter / Esc / Tab still work after picking a session length.
  if (e.target instanceof HTMLSelectElement && /^(Enter|NumpadEnter|Escape|Tab)$/.test(e.code)) {
    e.preventDefault();
    e.target.blur();
    if (e.code === 'Escape') handleBack();
    else if (e.code === 'Tab') restartSession();
    else handleConfirm();
    return;
  }
  if (state.mode !== 'running' || kit.menu.isOpen) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  e.preventDefault(); // no page scroll on Space, no button activation, no select type-ahead
  // Non-Latin layouts (Cyrillic, Greek…) type by key position instead of reporting a miss.
  const ch = /^[a-z ]$/i.test(e.key) || !/^Key[A-Z]$/.test(e.code) ? e.key : e.code.slice(3);
  typeChar(ch);
});

// ---- touch and mouse: tap the on-screen keys

ui.keyboard.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.key');
  if (!el || state.mode !== 'running') return;
  e.preventDefault();
  typeChar(charOf(el));
});

// ---- buttons and selects

/** RUN AGAIN, or NEXT TRIAL after a trial was passed. */
function primaryAction() {
  if (state.mode === 'finished' && state.nextTrial) {
    ui.difficulty.value = `trial:${state.nextTrial.id}`;
    prefs.level = ui.difficulty.value;
    persist();
  }
  startSession();
}

ui.start.addEventListener('click', startSession);
ui.pause.addEventListener('click', togglePause);
ui.again.addEventListener('click', primaryAction);
ui.close.addEventListener('click', () => resetSession());
ui.settings.addEventListener('click', () => kit.menu.open());
ui.sound.addEventListener('click', () => {
  state.sound = !state.sound;
  ui.sound.textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
  prefs.sound = state.sound;
  persist();
  if (state.sound) unlockAudio();
});
ui.duration.addEventListener('change', () => {
  if (!selection().trial) {
    prefs.length = ui.duration.value;
    persist();
  }
  if (state.mode !== 'running' && state.mode !== 'paused') resetSession();
  if (!padFocus) ui.duration.blur();
});
ui.difficulty.addEventListener('change', () => {
  prefs.level = ui.difficulty.value;
  persist();
  if (state.mode !== 'running' && state.mode !== 'paused') resetSession();
  if (!padFocus) ui.difficulty.blur();
});

function restartSession() {
  resetSession();
  startSession();
}

/** Enter / A in a menu: press the focused control, the results screen's main button, or start (or resume) a session. */
function handleConfirm() {
  if (padFocus?.isConnected && !padFocus.disabled && menuControls().includes(padFocus)) {
    if (padFocus instanceof HTMLSelectElement) cycleSelect(padFocus);
    else padFocus.click();
    input.rumble(0.15, 40);
    return;
  }
  if (state.mode === 'finished') primaryAction();
  else startSession();
}

/** Esc / B: pause or resume a session, or put the run summary away. */
function handleBack() {
  if (state.mode === 'running' || state.mode === 'paused') togglePause();
  else if (state.mode === 'finished') resetSession();
}

// ---- controller / arrow-key navigation of the interface

const navRepeat = { dir: null, at: 0 };

function navDirection() {
  const v = input.vector('nav');
  const ax = Math.abs(v.x) > 0.5 ? Math.sign(v.x) : 0;
  const ay = Math.abs(v.y) > 0.5 ? Math.sign(v.y) : 0;
  const dir = ay ? (ay > 0 ? 'up' : 'down') : ax ? (ax > 0 ? 'right' : 'left') : null;
  const now = performance.now();
  let fire = false;
  if (dir && dir !== navRepeat.dir) {
    fire = true;
    navRepeat.at = now + 320;
  } else if (dir && now >= navRepeat.at) {
    fire = true;
    navRepeat.at = now + 110;
  }
  navRepeat.dir = dir;
  return fire ? dir : null;
}

function menuControls() {
  if (!ui.finish.classList.contains('hidden')) return [ui.again, ui.close];
  return [ui.start, ui.pause, ui.duration, ui.difficulty, ui.sound, ui.settings].filter((el) => !el.disabled && el.getClientRects().length);
}

function setPadFocus(el) {
  padFocus?.classList.remove('pad-focus');
  padFocus = el;
  if (!el) return;
  el.classList.add('pad-focus');
  // A focused <select> would take the arrow keys for itself (and the kit ignores keys there),
  // trapping keyboard navigation: selects are only outlined, and Enter / A cycles them.
  if (el instanceof HTMLSelectElement) document.activeElement?.blur?.();
  else el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function clearPadFocus() {
  if (!padFocus) return;
  padFocus.classList.remove('pad-focus');
  if (document.activeElement === padFocus) padFocus.blur();
  padFocus = null;
}
// A click or tap hands focus back to the pointer.
addEventListener('pointerdown', () => clearPadFocus(), true);

/** A on a focused select moves to its next available option (wrapping, skipping locked trials). */
function cycleSelect(select) {
  const options = [...select.options];
  for (let step = 1; step <= options.length; step++) {
    const i = (select.selectedIndex + step) % options.length;
    if (!options[i].disabled) {
      select.selectedIndex = i;
      break;
    }
  }
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Nearest control in a direction: distance along it plus a penalty for sideways offset. */
function stepFocus(from, dir) {
  const r = from.getBoundingClientRect();
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of menuControls()) {
    if (el === from) continue;
    const c = el.getBoundingClientRect();
    const dx = (c.left + c.right) / 2 - cx;
    const dy = (c.top + c.bottom) / 2 - cy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (along <= 1) continue;
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function navigateMenu(dir) {
  const controls = menuControls();
  if (!controls.length) return;
  if (!padFocus || !padFocus.isConnected || !controls.includes(padFocus)) {
    setPadFocus(controls[0]);
    return;
  }
  const next = stepFocus(padFocus, dir);
  if (next) setPadFocus(next);
}

// ---- controller typing: a cursor over the on-screen keyboard

function updatePadCursor() {
  const el = device === 'gamepad' && state.mode === 'running' ? keyGrid[cursor.row][cursor.col] : null;
  if (el === cursorEl) return;
  cursorEl?.classList.remove('pad-cursor');
  el?.classList.add('pad-cursor');
  cursorEl = el;
}

function moveCursor(dir) {
  if (dir === 'left' || dir === 'right') {
    const row = keyGrid[cursor.row];
    cursor.col = (cursor.col + (dir === 'right' ? 1 : -1) + row.length) % row.length;
  } else {
    const from = keyGrid[cursor.row][cursor.col].getBoundingClientRect();
    const x = (from.left + from.right) / 2;
    cursor.row = (cursor.row + (dir === 'down' ? 1 : -1) + keyGrid.length) % keyGrid.length;
    // Land on the key nearest to the same horizontal position.
    let best = 0;
    let bestD = Infinity;
    keyGrid[cursor.row].forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    cursor.col = best;
  }
  updatePadCursor();
}

// ---- per frame

function handleInput() {
  if (input.pressed('restart')) {
    restartSession();
    return;
  }
  if (input.pressed('pause') || input.pressed('back')) {
    handleBack();
    input.settle();
    return;
  }
  const dir = navDirection();
  if (state.mode === 'running') {
    if (device === 'gamepad') {
      if (dir) moveCursor(dir);
      if (input.pressed('padType')) typeChar(charOf(keyGrid[cursor.row][cursor.col]));
      if (input.pressed('padSpace')) typeChar(' ');
    }
    return;
  }
  if (dir) navigateMenu(dir);
  if (input.pressed('confirm')) {
    handleConfirm();
    // The press that started a session must not also type the key under the cursor.
    input.settle();
  }
}

kit.start((dt) => {
  handleInput();
  if (state.mode === 'running' && state.startedAt) {
    if (!state.targetWords && activeSeconds() >= state.sessionSeconds) finishSession();
    else renderStats();
  }
  backdrop.frame(dt);
});
