/* Little World: a touch-first shared-play space for a grown-up and a little one.
   The page is ordinary DOM. The 3D stage is one kit canvas that moves into
   whichever page is showing. Keyboard, gamepad and touch all go through the
   kit's input actions; the app's own buttons are the touch controls. */

import { boot } from 'kit/boot.js';
import { songs, alphabet, numbers, explore, categories } from './content.js';
import { SoundEngine, RecordingStore } from './audio.js';
import { Singer, MUSIC_ONLY } from './singer.js';
import { World } from './world.js';

const $ = (selector) => document.querySelector(selector);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  letters: '<path d="m3 19 6-14 6 14M5 14h8M18 10v9m0-6c5-4 5 9 0 5"/>',
  numbers: '<path d="m4 7 3-2v14M4 19h6M14 8c0-5 8-5 7 0-1 3-7 6-7 10h7"/>',
  explore: '<path d="M5 20c0-8 5-13 14-15 0 9-3 15-10 14M5 20l9-9M4 12C0 5 5 3 9 4"/>',
  sound: '<path d="M11 4 5 9H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 4 5 9H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6"/>',
  settings: '<path d="m10 3-1 3-3 1-2-1-2 4 2 2v3l-1 2 3 3 2-1 3 1 2 2 4-2v-3l2-2 3-1-1-4-3-1-1-3-3-1Z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5v14M17 5v14" stroke-width="5"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  previous: '<path d="m15 6-6 6 6 6"/>',
  refresh: '<path d="M20 7V2l-3 3a9 9 0 1 0 3 10M20 7h-6"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 3 12 8 15 5-3 13-10 8-15Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  star: '<path d="m12 2 3.1 6.2 6.9 1-5 4.9 1.2 6.9-6.2-3.3L5.8 21 7 14.1 2 9.2l6.9-1Z"/>',
  boat: '<path d="M3 16h18l-3 5H7ZM12 2v14M10 4l-7 9h7Zm4 2 7 7h-7"/>',
  cow: '<path d="M7 8 3 5v6l4 2M17 8l4-3v6l-4 2M8 7V3m8 4V3"/><rect x="6" y="6" width="12" height="15" rx="6"/><rect x="7" y="15" width="10" height="6" rx="3"/><path d="M9 11v1m6-1v1m-5 6h.1m4 0h.1"/>',
  lamb: '<path d="M6 16a3 3 0 0 1-1-5.8A3 3 0 0 1 9.5 7a3 3 0 0 1 5 0 3 3 0 0 1 4.5 3.2A3 3 0 0 1 18 16Z"/><path d="M8 16v4m8-4v4"/><circle cx="19.5" cy="8" r="2"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/><path d="M17 3v3m-1.5-1.5h3"/>',
  hand: '<path d="M8 12V5a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v4c0 7-9 8-12 4l-5-6a2 2 0 0 1 3-2l2 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  body: '<circle cx="12" cy="4" r="2"/><path d="M4 8h16M12 7v7m0 0-5 8m5-8 5 8"/>',
  colors: '<circle cx="8" cy="9" r="5"/><circle cx="16" cy="9" r="5"/><circle cx="12" cy="16" r="5"/>',
  shapes: '<path d="m7 2 5 8H2Z"/><rect x="13" y="13" width="9" height="9" rx="1"/><circle cx="6" cy="17" r="4"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  fullscreen: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
  gamepad: '<path d="M6 8h12a4 4 0 0 1 4 4.5l-.6 4a2.5 2.5 0 0 1-4.4 1.2L15 15H9l-2 2.7a2.5 2.5 0 0 1-4.4-1.2l-.6-4A4 4 0 0 1 6 8Z"/><path d="M7 11v3m-1.5-1.5h3M16 12h.1m2 1.5h.1"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
const logo = () => `<svg class="brand-mark" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M24 4c6-7 16 1 12 8 9-1 13 11 5 15 6 7-2 17-10 13-2 9-15 9-17 0-9 3-15-8-9-14-7-6-1-17 7-15C9 3 20-2 24 4Z"/><circle cx="24" cy="24" r="8" fill="#f6f4d8"/><circle cx="21" cy="23" r="1" fill="#6d854e"/><circle cx="27" cy="23" r="1" fill="#6d854e"/><path d="M21 27q3 3 6 0" stroke="#6d854e" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`;

/* ------------------------------------------------------------------ settings and progress */

const defaults = { volume: 0.38, muted: false, voice: true, calm: matchMedia('(prefers-reduced-motion: reduce)').matches, goal: 3, pace: 0.85, session: 5, z: 'zed', singing: true, singerSource: 'auto' };
let settings = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem('little-world-settings') || '{}');
  if (saved && typeof saved === 'object') settings = { ...settings, ...saved };
} catch (_) {}
// Only accept known values from browser storage.
delete settings.quality; // picture quality now lives in the shared kit settings
if (![3, 5, 10, 20].includes(settings.goal)) settings.goal = 3;
if (![0.85, 1].includes(settings.pace)) settings.pace = 0.85;
if (![3, 5, 10].includes(settings.session)) settings.session = 5;
if (!['zed', 'zee'].includes(settings.z)) settings.z = 'zed';
settings.volume = Math.max(0, Math.min(0.7, Number(settings.volume) || 0));
if (!['auto', 'builtin', 'parent'].includes(settings.singerSource)) settings.singerSource = 'auto';
['muted', 'voice', 'calm', 'singing'].forEach((k) => (settings[k] = Boolean(settings[k])));
function saveSettings() {
  try {
    localStorage.setItem('little-world-settings', JSON.stringify(settings));
  } catch (_) {}
}

const state = { page: 'home', song: 'twinkle', letter: 0, count: 0, category: 'animals', item: 0, playing: false, offset: 0, elapsed: 0, started: false, breakShown: false, lastActivity: null };
let renderedPage = null;
const PROGRESS_KEY = 'little-world-progress';
try {
  const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {};
  if (songs.some((s) => s.id === p.song)) state.song = p.song;
  if (Number.isInteger(p.letter) && p.letter >= 0 && p.letter < alphabet.length) state.letter = p.letter;
  if (typeof p.category === 'string' && Object.hasOwn(explore, p.category)) {
    state.category = p.category;
    if (Number.isInteger(p.item) && p.item >= 0 && p.item < explore[p.category].length) state.item = p.item;
  }
  if (['songs', 'letters', 'numbers', 'explore'].includes(p.last)) state.lastActivity = p.last;
} catch (_) {}
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ song: state.song, letter: state.letter, category: state.category, item: state.item, last: state.lastActivity }));
  } catch (_) {}
}

const sound = new SoundEngine();
const store = new RecordingStore();
const recordings = {};
const singer = new Singer({
  onChange: () => {
    updateSingerUI();
    updateTransport();
  },
});
sound.setVolume(settings.volume, settings.muted);

let kit = null;
let world = null;
let countTimer = null;
let sparkleTimer = null;
let toastTimer = null;
let playToken = 0;
let lastTap = 0;
let recordJob = 0;
let lastDialogClose = 0;
let recorder = null;
let micStream = null;
let recordBusy = false;
let recordSong = null;
let recordTimer = null;
let recordStarted = 0;
let preview = null;
let previewURL = null;

/** The kit's canvas lives here; each page render moves it into the page's stage. */
const stageMount = document.createElement('div');
stageMount.id = 'stage-mount';

const navs = [['home', 'Home', 'home'], ['songs', 'Sing along', 'music'], ['letters', 'Letters', 'letters'], ['numbers', 'Numbers', 'numbers'], ['explore', 'Explore', 'explore']];
const selectedSong = () => songs.find((s) => s.id === state.song) || songs[0];
const activeItem = () => explore[state.category][state.item] || explore[state.category][0];
const timeLabel = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const openDialog = () => ($('#parent-dialog').open ? $('#parent-dialog') : $('#break-dialog').open ? $('#break-dialog') : null);

function toast(text) {
  clearTimeout(toastTimer);
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('visible');
  toastTimer = setTimeout(() => t.classList.remove('visible'), 3400);
}
function activate() {
  state.started = true;
}
function say(text) {
  activate();
  if (settings.muted) return;
  if (settings.voice && !sound.speak(text)) toast('No local English voice is ready. Words and music still work.');
}

/* ------------------------------------------------------------------ pages */

function navMarkup(mobile = false) {
  return navs
    .map(
      ([page, label, i]) =>
        `<button class="${mobile ? '' : 'nav-item '}${state.page === page ? 'active' : ''}" data-action="navigate" data-page="${page}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(i)}<span>${mobile && page === 'songs' ? 'Songs' : label}</span></button>`
    )
    .join('');
}
function shell(content) {
  return `
    <aside class="sidebar"><div class="brand">${logo()}<span class="brand-name">little world</span></div><div class="brand-sub">Sing. Play. Grow.</div>
      <nav aria-label="Main navigation">${navMarkup()}</nav>
      <div class="side-bottom"><div class="side-note">${icon('heart')}<strong>Better together.</strong><p>A little song. A little play.<br>A moment with you.</p></div><button class="parent-side" data-action="parents">${icon('lock')}<span>Grown-up space</span></button></div>
    </aside>
    <div class="shell"><header class="topbar"><div class="hello"><strong>Hello, little explorer.</strong>Let’s find something wonderful.</div><div class="mobile-brand">${logo()}<span>little world</span></div>
      <div class="header-controls"><span class="session-pill"><span class="dot"></span><span id="session-time">${state.started && state.elapsed >= 1 ? `${timeLabel(state.elapsed)} together` : 'A little time together'}</span></span><button class="round-btn" data-action="mute" aria-label="${settings.muted ? 'Turn sound on' : 'Mute sound'}" aria-pressed="${settings.muted}">${icon(settings.muted ? 'muted' : 'sound')}</button><button class="round-btn" data-action="parents" aria-label="Open grown-up settings">${icon('settings')}</button><div class="avatar" aria-hidden="true">m</div></div>
    </header><main class="main view-enter" id="main">${content}</main></div>
    <nav class="bottom-nav" aria-label="Main navigation">${navMarkup(true)}</nav>`;
}
function continueLabel() {
  const last = state.lastActivity;
  if (last === 'songs') return `Keep singing: ${selectedSong().title}`;
  if (last === 'letters') return `Keep going: letter ${alphabet[state.letter].upper}`;
  if (last === 'numbers') return `Keep counting: 1 to ${settings.goal}`;
  if (last === 'explore') return `Keep exploring: ${activeItem().label}`;
  return null;
}
function homePage() {
  const resume = continueLabel();
  return `
    <section class="welcome"><div class="page-eyebrow">Little moments. Big discoveries.</div><h1>Let’s grow a little,<br>together.</h1><p>A world of songs, sounds, and small wonders.<br>Made for you and your little one.</p><button class="fullscreen-cta" data-action="fullscreen" aria-label="Go full screen">${icon('fullscreen')}<span>Full screen</span></button>${resume ? `<button class="continue-cta" data-action="continue">${icon('play')}<span>${resume}</span></button>` : ''}<div class="control-hints" id="control-hints" aria-hidden="true" hidden></div></section>
    <section class="hero" aria-label="Featured song"><div class="hero-copy"><span class="tiny-pill">${icon('music')} TODAY, LET’S SING</span><h2>A little song.<br><span>A big smile.</span></h2><p>Twinkle, twinkle, little star.<br>Let’s find out how bright you are.</p><button class="primary-btn" data-action="start-song">${icon('play')} Let’s sing together</button></div>
      <div class="hero-scene"><div id="world" data-label="The little star. Touch it to sing Twinkle, Twinkle."></div><div class="scene-hint">${icon('hand')} Tap the little star</div></div><span class="floating-note">A world to touch</span>
    </section>
    <div class="section-heading"><h2>What shall we discover?</h2><small>Little steps, at your pace</small></div>
    <section class="activity-grid" aria-label="Choose an activity">
      <button class="activity-card" data-action="navigate" data-page="songs"><span class="card-icon songs">${icon('music')}</span><span class="card-arrow">${icon('next')}</span><h3>Sing along</h3><p>Familiar songs, happy sounds</p></button>
      <button class="activity-card" data-action="navigate" data-page="letters"><span class="card-icon letters"><span class="abc-icon" aria-hidden="true">Aa</span></span><span class="card-arrow">${icon('next')}</span><h3>Hello, ABCs</h3><p>Meet a letter, make a sound</p></button>
      <button class="activity-card" data-action="navigate" data-page="numbers"><span class="card-icon numbers"><span class="num-icon" aria-hidden="true">123</span></span><span class="card-arrow">${icon('next')}</span><h3>Count with me</h3><p>One little apple at a time</p></button>
      <button class="activity-card" data-action="navigate" data-page="explore"><span class="card-icon explore">${icon('explore')}</span><span class="card-arrow">${icon('next')}</span><h3>Little discoveries</h3><p>Animals, colors, and more</p></button>
    </section>
    <div class="together-banner">${icon('heart')}<div><strong>The best part of learning is you.</strong><p>Sit close. Sing along. Let your little one lead.</p></div><span class="banner-tag">MADE FOR SHARED PLAY</span></div>
    <footer class="footer"><span>${icon('lock')} No ads. No scores. Just time together.</span><span>Small wonders, every day.</span></footer>`;
}
function head(title, sub) {
  return `<div class="activity-head"><button class="round-btn back-btn" data-action="navigate" data-page="home" aria-label="Back to home">${icon('previous')}</button><div><h1>${title}</h1><p>${sub}</p></div><span class="eyebrow-right">You + your little one</span></div>`;
}
function worldCard({ badge, line, sub, label = 'SING WITH ME', readout = '', hint, progress = false, extra = '' }) {
  return `<div class="stage-card"><div class="stage-top"><span class="stage-badge">${icon('star')} ${badge}</span><button class="round-btn" data-action="scene-speak" aria-label="${hint || 'Hear this again'}">${icon(state.page === 'songs' ? 'music' : 'sound')}</button></div><div class="scene-wrap"><div class="stage-readout" id="stage-readout">${readout}</div><div id="world" data-label="${hint || 'Touch the toy'}"></div></div><div class="lyrics-area"><div class="line-label" id="line-label">${label}</div><div class="lyrics" id="lyrics" aria-live="off">${line}</div><div class="lyric-next" id="lyric-next">${sub}</div>${extra}</div>${progress ? '<div class="progress" role="progressbar" aria-label="Song progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="song-progress"></div></div>' : ''}</div>`;
}
function transport(mainLabel, leftAction, rightAction, leftIcon = 'previous', rightIcon = 'refresh') {
  return `<div class="transport"><button class="round-btn" data-action="${leftAction}" aria-label="${leftAction === 'prev' ? 'Previous item' : 'Start again'}">${icon(leftIcon)}</button><button class="primary-btn" id="main-control" data-action="main-control">${icon('play')}<span>${mainLabel}</span></button><button class="round-btn" data-action="${rightAction}" aria-label="${rightAction === 'next' ? 'Next item' : rightAction === 'add' ? 'Add one apple' : 'Start again'}">${icon(rightIcon)}</button></div><div class="transport-label" id="transport-label"></div><div class="control-hints" id="control-hints" aria-hidden="true" hidden></div>`;
}
function songPanel() {
  const s = selectedSong();
  return `<aside class="panel"><h2 class="panel-title">A song for every little moment</h2><p class="panel-sub">Pick a song. Sing it your way.</p><div class="song-list">${songs
    .map(
      (song) =>
        `<button class="song-choice ${song.id === s.id ? 'active' : ''}" data-action="song" data-id="${song.id}" aria-pressed="${song.id === s.id}"><span class="song-thumb">${icon(song.icon)}</span><span class="song-info"><strong>${song.title}</strong><small>${timeLabel(song.duration / settings.pace)} · ${song.blurb}</small></span>${icon(song.id === s.id ? 'check' : 'play')}</button>`
    )
    .join('')}</div><div class="pace-row"><span>A little slower?</span><div class="pace-buttons"><button data-action="pace" data-value="0.85" class="${settings.pace === 0.85 ? 'active' : ''}" aria-pressed="${settings.pace === 0.85}">Gentle</button><button data-action="pace" data-value="1" class="${settings.pace === 1 ? 'active' : ''}" aria-pressed="${settings.pace === 1}">Steady</button></div></div><div class="panel-divider"></div><div class="tip"><strong>${icon('heart')} Try it together</strong>${s.tip}</div></aside>`;
}
function songPage() {
  const s = selectedSong();
  return `${head('Sing with Hudson', 'Hear the voice. Follow the words. Sing together.')}<div class="activity-layout"><section>${worldCard({ badge: s.title, line: s.phrases[0].text, sub: s.phrases[1]?.text || '', hint: 'Tap the toy to play the song', progress: true })}${transport('Play song', 'prev', 'restart')}<div class="singing-controls"><button class="singing-toggle" data-action="singing" aria-pressed="${settings.singing}">${icon(settings.singing ? 'mic' : 'music')}<span>${settings.singing ? 'Singing on' : 'Music only'}</span></button><button class="singing-settings" data-action="parents">${icon('settings')} Voice settings</button></div></section>${songPanel()}</div>`;
}
function letterPage() {
  const l = alphabet[state.letter];
  return `${head('Hello, little letter', 'Touch a block. Hear a letter. Say it together.')}<div class="activity-layout"><section>${worldCard({ badge: 'A to Z', label: 'LET’S SAY IT TOGETHER', line: `${l.upper} is for ${l.word}`, sub: 'A sound, a point, or a smile is enough.', hint: `Hear the letter ${l.upper}` })}${transport('Hear the letter', 'prev', 'next', 'previous', 'next')}</section><aside class="panel"><h2 class="panel-title">Meet the letters</h2><p class="panel-sub">There is no test. Just explore.</p><div class="letter-grid">${alphabet
    .map((a, i) => `<button class="letter-choice ${i === state.letter ? 'active' : ''}" data-action="letter" data-index="${i}" aria-label="Letter ${a.upper}" aria-pressed="${i === state.letter}">${a.upper}</button>`)
    .join('')}</div><div class="panel-divider"></div><div class="tip"><strong>${icon('heart')} Make it real</strong>Point to an object near you. Say its name together.</div></aside></div>`;
}
function numberPage() {
  return `${head('One little apple at a time', 'Touch to add. Count together. Take your time.')}<div class="activity-layout"><section>${worldCard({
    badge: `Count to ${settings.goal}`,
    readout: state.count || '',
    label: 'LET’S COUNT TOGETHER',
    line: state.count ? `${cap(numbers[state.count])} ${state.count === 1 ? 'apple' : 'apples'}` : 'Add a little apple',
    sub: state.count === settings.goal ? 'All here. Count them once more.' : 'Tap the tray to add one apple.',
    hint: 'Add one apple to the counting tray',
  })}${transport('Count with me', 'restart', 'add', 'refresh', 'plus')}</section><aside class="panel"><h2 class="panel-title">Little numbers, big discoveries</h2><p class="panel-sub">Start small. More numbers are here when you are ready.</p><div class="count-options">${[3, 5, 10, 20]
    .map((n) => `<button class="count-option ${n === settings.goal ? 'active' : ''}" data-action="goal" data-value="${n}" aria-pressed="${n === settings.goal}">1–${n}</button>`)
    .join('')}</div><p class="count-note">Each touch adds one apple. No speed test. No right or wrong sounds.</p><div class="panel-divider"></div><div class="tip"><strong>${icon('heart')} Take it off the screen</strong>Count two or three real toy blocks together. Touch each block as you say its number.</div></aside></div>`;
}
function explorePage() {
  const item = activeItem();
  return `${head('Small, wonderful discoveries', 'Touch, listen, and find something new together.')}<div class="activity-layout"><section>${worldCard({
    badge: categories.find((c) => c[0] === state.category)[1],
    label: 'WHAT CAN WE FIND?',
    line: item.label,
    sub: item.tip,
    hint: `Hear ${item.label}`,
    extra: `<div class="explore-options">${explore[state.category]
      .map(
        (o, i) =>
          `<button class="explore-pick ${i === state.item ? 'active' : ''}" data-action="item" data-index="${i}" ${o.hex ? `data-color="${o.id}" style="--swatch:${o.hex}"` : ''} aria-label="${o.label}" aria-pressed="${i === state.item}">${o.hex ? '' : o.label}</button>`
      )
      .join('')}</div>`,
  })}${transport('Hear it again', 'prev', 'next', 'previous', 'next')}</section><aside class="panel"><h2 class="panel-title">A world of little things</h2><p class="panel-sub">Follow your child’s interest.</p><div class="explore-categories">${categories
    .map(([id, label, i]) => `<button class="explore-category ${id === state.category ? 'active' : ''}" data-action="category" data-id="${id}" aria-pressed="${id === state.category}">${icon(i)}${label}</button>`)
    .join('')}</div><div class="panel-divider"></div><div class="tip"><strong>${icon('heart')} Your voice matters</strong>Copy the sound. Point together. Give your child time to respond.</div></aside></div>`;
}

function render() {
  // Keep a controller or keyboard user's place when the page redraws.
  const pageChanged = renderedPage !== null && renderedPage !== state.page;
  renderedPage = state.page;
  const hadPad = Boolean(padFocusEl);
  const padOnCanvas = Boolean(kit) && padFocusEl === kit.canvas;
  const canvasFocused = Boolean(kit) && document.activeElement === kit.canvas;
  const focusSelector = hadPad && !padOnCanvas && !pageChanged ? focusKey(padFocusEl) : null;
  document.body.classList.toggle('calm', settings.calm);
  $('#app').innerHTML = shell(({ home: homePage, songs: songPage, letters: letterPage, numbers: numberPage, explore: explorePage }[state.page] || homePage)());
  const host = $('#world');
  host.appendChild(stageMount);
  if (kit) {
    kit.canvas.setAttribute('aria-label', host.dataset.label || 'Touch the toy');
    // Moving the canvas drops its focus: give it back.
    if (canvasFocused && !(padOnCanvas && pageChanged)) kit.canvas.focus({ preventScroll: true });
    // Size the canvas for its new stage now, not after the next frame (which would flash empty).
    window.dispatchEvent(new Event('resize'));
  }
  try {
    setScene();
  } catch (error) {
    // A broken toy must not take the buttons, songs and words down with it.
    console.error('Little World: this scene could not be built.', error);
  }
  updateTransport();
  updateFullscreenButtons();
  updateHints();
  saveProgress();
  if (state.page === 'songs' && settings.singing) singer.prefetch(selectedSong(), settings.pace, settings.z);
  if (hadPad) {
    let el = null;
    if (padOnCanvas && !pageChanged) el = kit.canvas;
    else if (focusSelector) el = [...$('#app').querySelectorAll(focusSelector)].find(isVisible) || null;
    if (!el) el = $('#main-control') || $('#app [data-action="start-song"]');
    if (el) focusEl(el, false);
    else clearPadFocus();
  }
}
function setScene() {
  if (!world) return;
  world.calm = settings.calm;
  if (state.page === 'home') world.set('garden');
  else if (state.page === 'songs') world.set(selectedSong().scene);
  else if (state.page === 'letters') {
    const l = alphabet[state.letter];
    world.set('letter', { letter: l.upper, index: state.letter, word: l.word });
  } else if (state.page === 'numbers') world.set('count', { count: state.count, goal: settings.goal });
  else if (state.category === 'animals') world.set(activeItem().id);
  else if (state.category === 'colors') world.set('color', { hex: activeItem().hex });
  else if (state.category === 'body') world.set('body', { part: activeItem().id });
  else world.set('shape', { shape: activeItem().id });
}
function stop(reset = true) {
  playToken++;
  sound.stop();
  clearTimeout(countTimer);
  clearTimeout(sparkleTimer);
  state.playing = false;
  state.loadingVoice = false;
  if (reset) state.offset = 0;
  updateTransport();
}
function navigate(page) {
  if (!navs.some((n) => n[0] === page)) return;
  stop();
  state.page = page;
  if (page !== 'home') state.lastActivity = page;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function updateTransport() {
  const b = $('#main-control');
  if (!b) return;
  const label =
    state.page === 'songs' ? (state.playing ? 'Pause song' : state.offset ? 'Keep singing' : 'Play song') : state.page === 'numbers' ? (state.playing ? 'Pause counting' : 'Count with me') : state.page === 'letters' ? 'Hear the letter' : 'Hear it again';
  b.innerHTML = `${icon(state.playing ? 'pause' : state.page === 'letters' || state.page === 'explore' ? 'sound' : 'play')}<span>${label}</span>`;
  const caption = $('#transport-label');
  if (!caption) return;
  if (state.page === 'songs') {
    const voice = state.loadingVoice
      ? 'Loading the singing voice'
      : !settings.singing
        ? 'Music only'
        : state.playing && state.vocalLabel
          ? state.vocalLabel
          : settings.singerSource === 'parent' && recordings[state.song]
            ? 'Your recorded singing'
            : singer.name(selectedSong(), settings.pace, settings.z, settings.singerSource);
    caption.textContent = `${voice} · Sing together`;
  } else
    caption.textContent =
      state.page === 'numbers'
        ? `A little pause after each number · 1 to ${settings.goal}`
        : state.page === 'letters'
          ? 'Touch a block to hear the letter. Touch the little toy to hear its name.'
          : 'Touch the toy or press the sound button.';
}
function setLyric(note) {
  const song = selectedSong();
  const phrase = song.phrases[note.line];
  const el = $('#lyrics');
  if (!el || state.page !== 'songs') return;
  if (el.dataset.line !== String(note.line)) {
    el.innerHTML = phrase.words.map((word, i) => `<span data-word="${i}">${word}</span>`).join(' ');
    el.dataset.line = String(note.line);
    $('#lyric-next').textContent = song.phrases[note.line + 1]?.text || 'One little song, together.';
  }
  el.querySelectorAll('span').forEach((s, i) => {
    s.classList.toggle('current', i === note.word);
    s.classList.toggle('past', i < note.word);
    if (i === note.word) s.setAttribute('aria-current', 'true');
    else s.removeAttribute('aria-current');
  });
  if (state.song === 'abc') {
    const word = phrase.words[note.word];
    $('#stage-readout').textContent = /^[A-Z]$/.test(word) ? word : '';
  }
  world?.pulse();
}
async function playSong() {
  activate();
  if (state.playing) {
    if (sound.playing) state.offset = sound.pause();
    else sound.stop();
    state.playing = false;
    state.loadingVoice = false;
    playToken++;
    updateTransport();
    return;
  }
  const token = ++playToken;
  const song = selectedSong();
  state.playing = true;
  state.loadingVoice = settings.singing;
  updateTransport();
  try {
    // Unlock audio inside the touch handler. No song starts before the voice is ready.
    await sound.unlock();
    let vocalBuffer = null;
    let recording = null;
    let voiceLabel = 'Music only';
    if (settings.singing) {
      if (settings.singerSource === 'parent' && recordings[song.id]) {
        recording = recordings[song.id];
        voiceLabel = 'Your recorded singing';
      } else {
        const result = await singer.getBuffer(song, settings.pace, settings.z, sound.ctx, settings.singerSource);
        if (result) {
          vocalBuffer = result.buffer;
          voiceLabel = result.label;
        } else voiceLabel = MUSIC_ONLY;
      }
    }
    if (token !== playToken || !state.playing || state.page !== 'songs') return;
    state.loadingVoice = false;
    state.vocalLabel = voiceLabel;
    updateTransport();
    await sound.play(song, {
      rate: settings.pace,
      offset: state.offset,
      recording,
      vocalBuffer,
      voiceLabel,
      onNote: (note) => {
        if (token === playToken) setLyric(note);
      },
      onProgress: (p) => {
        if (token !== playToken) return;
        const el = $('#song-progress');
        if (el) {
          el.style.width = `${p * 100}%`;
          el.parentElement.setAttribute('aria-valuenow', String(Math.round(p * 100)));
        }
      },
      onEnd: () => {
        if (token !== playToken) return;
        state.playing = false;
        state.offset = 0;
        updateTransport();
        const label = $('#line-label');
        if (label) label.textContent = 'ONE SONG TOGETHER';
        const next = $('#lyric-next');
        if (next) next.textContent = selectedSong().cue;
        world?.celebrate();
        sound.sparkle();
        if (!settings.calm) kit?.input.rumble(0.3, 110);
      },
    });
  } catch (error) {
    if (token !== playToken) return;
    sound.stop();
    state.playing = false;
    state.loadingVoice = false;
    updateTransport();
    toast(error.message || 'Touch Play again to start the sound.');
  }
}

function hearLetter() {
  const l = alphabet[state.letter];
  say(l.upper === 'Z' ? `${settings.z}. Z is for ${l.word}.` : `The letter ${l.upper}. ${l.upper} is for ${l.word}.`);
  world?.pulse();
}
function sayWord() {
  const l = alphabet[state.letter];
  say(`${cap(l.word)}. ${l.upper} is for ${l.word}.`);
}
function updateCountText() {
  const n = state.count;
  const readout = $('#stage-readout');
  if (readout) readout.textContent = n || '';
  const lyrics = $('#lyrics');
  if (lyrics) lyrics.textContent = n ? `${cap(numbers[n])} ${n === 1 ? 'apple' : 'apples'}` : 'Add a little apple';
  const next = $('#lyric-next');
  if (next) next.textContent = n === settings.goal ? 'All here. Count them once more.' : 'Tap the tray to add one apple.';
}
function addApple(manual = true) {
  activate();
  if (manual && state.playing) stop();
  if (state.count >= settings.goal) {
    say(`${numbers[state.count]} apples.`);
    return false;
  }
  state.count++;
  world?.set('count', { count: state.count, goal: settings.goal, grow: true });
  updateCountText();
  const n = state.count;
  if (!settings.voice || !sound.speak(numbers[n])) sound.chime(n - 1);
  if (n === settings.goal) {
    // Every apple is here: a small burst of stars and a soft arpeggio after the number.
    world?.celebrate();
    clearTimeout(sparkleTimer);
    sparkleTimer = setTimeout(() => sound.sparkle(), 550);
    if (!settings.calm) kit?.input.rumble(0.35, 120);
  }
  return true;
}
function takeApple() {
  activate();
  if (state.playing) stop(false);
  if (state.count <= 0) {
    sound.chime(0);
    return;
  }
  state.count--;
  world?.set('count', { count: state.count, goal: settings.goal });
  updateCountText();
  if (!settings.voice || !sound.speak(state.count ? numbers[state.count] : 'Zero')) sound.chime(Math.max(0, state.count - 1));
}
function countAlong() {
  activate();
  if (state.playing) {
    stop(false);
    return;
  }
  if (state.count >= settings.goal) {
    state.count = 0;
    world?.set('count', { count: 0, goal: settings.goal });
    updateCountText();
  }
  state.playing = true;
  updateTransport();
  const next = () => {
    if (!state.playing || state.page !== 'numbers') return;
    addApple(false);
    if (state.count >= settings.goal) {
      state.playing = false;
      updateTransport();
    } else countTimer = setTimeout(next, 1750 / settings.pace);
  };
  next();
}
function sceneTap(action) {
  if (performance.now() - lastTap < 450) return;
  lastTap = performance.now();
  activate();
  if (!settings.calm) kit?.input.rumble(0.2, 50);
  if (state.page === 'home') {
    state.song = 'twinkle';
    navigate('songs');
    playSong();
  } else if (state.page === 'songs') {
    if (!state.playing) playSong();
    else world?.pulse();
  } else if (state.page === 'numbers') addApple();
  else if (state.page === 'letters') {
    if (action === 'word') sayWord();
    else hearLetter();
  } else {
    if (state.category === 'body') {
      const i = explore.body.findIndex((x) => x.id === action);
      if (i >= 0 && i !== state.item) {
        state.item = i;
        render();
      }
    }
    say(activeItem().speech);
    world?.pulse();
  }
}
function mainControl() {
  if (state.page === 'songs') playSong();
  else if (state.page === 'numbers') countAlong();
  else if (state.page === 'letters') hearLetter();
  else if (state.page === 'explore') say(activeItem().speech);
  else {
    state.song = 'twinkle';
    navigate('songs');
    playSong();
  }
}
function advance(direction) {
  stop();
  if (state.page === 'songs') {
    state.song = songs[(songs.findIndex((s) => s.id === state.song) + direction + songs.length) % songs.length].id;
    render();
  } else if (state.page === 'letters') {
    state.letter = (state.letter + direction + alphabet.length) % alphabet.length;
    render();
    hearLetter();
  } else if (state.page === 'explore') {
    state.item = (state.item + direction + explore[state.category].length) % explore[state.category].length;
    render();
    say(activeItem().speech);
  }
}
function toggleMute() {
  settings.muted = !settings.muted;
  sound.setVolume(settings.volume, settings.muted);
  saveSettings();
  document.querySelectorAll('[data-action="mute"]').forEach((el) => {
    el.innerHTML = icon(settings.muted ? 'muted' : 'sound');
    el.setAttribute('aria-label', settings.muted ? 'Turn sound on' : 'Mute sound');
    el.setAttribute('aria-pressed', String(settings.muted));
  });
  if (preview) preview.volume = settings.muted ? 0 : settings.volume;
}
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function updateFullscreenButtons() {
  const active = Boolean(fullscreenElement());
  document.querySelectorAll('[data-action="fullscreen"]').forEach((button) => {
    button.setAttribute('aria-label', active ? 'Exit full screen' : 'Go full screen');
    const label = button.querySelector('span');
    if (label) label.textContent = active ? 'Exit full screen' : 'Full screen';
  });
}
async function toggleFullscreen() {
  activate();
  try {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) throw new Error('Full screen exit is not supported.');
      await exit.call(document);
    } else {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request) throw new Error('Full screen is not supported.');
      await request.call(root);
    }
  } catch (_) {
    toast('Full screen is not available in this browser.');
  }
  updateFullscreenButtons();
}
document.addEventListener('fullscreenchange', updateFullscreenButtons);
document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);

$('#app').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (!b) return;
  const action = b.dataset.action;
  if (action === 'navigate') navigate(b.dataset.page);
  else if (action === 'start-song') {
    state.song = 'twinkle';
    navigate('songs');
    playSong();
  } else if (action === 'continue') navigate(state.lastActivity || 'home');
  else if (action === 'main-control') mainControl();
  else if (action === 'scene-speak') {
    if (state.page === 'numbers') addApple();
    else mainControl();
  } else if (action === 'singing') {
    stop();
    settings.singing = !settings.singing;
    saveSettings();
    render();
  } else if (action === 'fullscreen') toggleFullscreen();
  else if (action === 'mute') toggleMute();
  else if (action === 'song') {
    stop();
    state.song = b.dataset.id;
    render();
  } else if (action === 'pace') {
    stop();
    settings.pace = Number(b.dataset.value);
    saveSettings();
    render();
  } else if (action === 'letter') {
    stop();
    state.letter = Number(b.dataset.index);
    render();
    hearLetter();
  } else if (action === 'prev' || action === 'next') advance(action === 'prev' ? -1 : 1);
  else if (action === 'restart') {
    stop();
    if (state.page === 'numbers') state.count = 0;
    render();
  } else if (action === 'add') addApple();
  else if (action === 'goal') {
    stop();
    settings.goal = Number(b.dataset.value);
    state.count = 0;
    saveSettings();
    render();
  } else if (action === 'category') {
    stop();
    state.category = b.dataset.id;
    state.item = 0;
    render();
  } else if (action === 'item') {
    stop();
    state.item = Number(b.dataset.index);
    render();
    say(activeItem().speech);
  } else if (action === 'parents') openParents();
});

/* ------------------------------------------------------------------ grown-up space */

function holdButton(button, onComplete) {
  let started = 0;
  let frame = 0;
  let done = false;
  const reset = () => {
    started = 0;
    cancelAnimationFrame(frame);
    button.style.setProperty('--hold', '0');
  };
  const tick = () => {
    if (!started) return;
    const p = Math.min(1, (performance.now() - started) / 1800);
    button.style.setProperty('--hold', String(p));
    if (p >= 1) {
      done = true;
      reset();
      onComplete();
    } else frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (done || started) return;
    started = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const begin = (e) => {
    if (e.type === 'keydown' && ![' ', 'Enter'].includes(e.key)) return;
    e.preventDefault();
    if (done || started) return;
    if (e.pointerId !== undefined) {
      try {
        button.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    start();
  };
  button.addEventListener('pointerdown', begin);
  button.addEventListener('pointerup', reset);
  button.addEventListener('pointercancel', reset);
  button.addEventListener('lostpointercapture', reset);
  button.addEventListener('keydown', begin);
  button.addEventListener('keyup', reset);
  button.addEventListener('blur', reset);
  // A controller holds A on the focused button (see the frame loop).
  button._hold = { begin: start, end: reset };
}
function openParents() {
  stop();
  const d = $('#parent-dialog');
  d.innerHTML = `<button class="dialog-close" data-parent="close" aria-label="Close settings">${icon('close')}</button><div class="parent-gate">${icon('lock')}<h2 id="parent-title">For grown-ups</h2><p>A small space for sound, play time,<br>and your own singing voice.</p><button class="hold-btn" id="parent-hold"><span>Hold to open</span></button><p class="hold-note">Hold for two seconds.</p></div>`;
  d.showModal();
  holdButton($('#parent-hold'), parentSettings);
  kit?.input.settle();
}
const selected = (a, b) => (a === b ? 'selected' : '');
const QUALITY = [['auto', 'Auto'], ['low', 'Save power'], ['medium', 'Balanced'], ['high', 'High detail'], ['ultra', 'Extra detail']];
function parentSettings() {
  const d = $('#parent-dialog');
  const quality = kit?.settings.get().quality || 'auto';
  d.innerHTML = `<button class="dialog-close" data-parent="close" aria-label="Close settings">${icon('close')}</button><div class="page-eyebrow">A little care, built in</div><h2 id="parent-title">Grown-up space</h2><p>Stay close. Sing together. Stop when your child loses interest.</p>
      <section class="neural-section" aria-labelledby="singing-title">
        <h3 id="singing-title">A voice to sing with</h3>
        <p>The built-in singer works now, without a download. The voice is computer-made. Mary’s Lamb and Are You Sleeping play music only: you are the singer, or record your voice for them below.</p>
        <label for="singer-source">Song voice</label>
        <select id="singer-source"><option value="auto" ${selected('auto', settings.singerSource)}>Best voice on this device</option><option value="builtin" ${selected('builtin', settings.singerSource)}>Built-in singer</option><option value="parent" ${selected('parent', settings.singerSource)}>My saved voice</option></select>
        <div id="neural-saved"></div>
      </section>
      <div class="setting-row"><div class="setting-label"><strong>Sound level</strong><small>Start low. Use the phone speaker.</small></div><input id="volume-setting" type="range" min="0" max="0.7" step="0.01" value="${settings.volume}" aria-label="Sound level"></div>
      <div class="setting-row"><div class="setting-label"><strong>Spoken words</strong><small>Uses an installed, local English voice.</small></div><button class="toggle" role="switch" aria-checked="${settings.voice}" aria-label="Spoken words" data-parent="voice"></button></div>
      <div class="setting-row"><div class="setting-label"><strong>Calm motion</strong><small>Keep the toys still.</small></div><button class="toggle" role="switch" aria-checked="${settings.calm}" aria-label="Calm motion" data-parent="calm"></button></div>
      <div class="setting-row"><div class="setting-label"><strong>A pause for real play</strong><small>The app stops and shows a break screen.</small></div><select id="session-setting" aria-label="Play time before a break">${[3, 5, 10].map((n) => `<option value="${n}" ${selected(n, settings.session)}>${n} minutes</option>`).join('')}</select></div>
      <div class="setting-row"><div class="setting-label"><strong>Picture quality</strong><small>Auto picks for this device. Save power is gentlest on the battery.</small></div><select id="quality-setting" aria-label="Picture quality">${QUALITY.map(([v, l]) => `<option value="${v}" ${selected(v, quality)}>${l}</option>`).join('')}</select></div>
      <div class="setting-row"><div class="setting-label"><strong>The letter Z</strong><small>Choose the spoken letter name.</small></div><select id="z-setting" aria-label="Letter Z pronunciation"><option value="zed" ${selected('zed', settings.z)}>Zed</option><option value="zee" ${selected('zee', settings.z)}>Zee</option></select></div>
      <section class="record-section"><h3>${icon('mic')} Add your singing voice</h3><p>The songs already have a singer. You can also record your own voice. Record at the steady pace. The guide plays music only while you record. Follow the words.</p><select id="record-song" aria-label="Song to record">${songs.map((s) => `<option value="${s.id}" ${selected(s.id, state.song)}>${s.fullTitle}</option>`).join('')}</select><div class="record-actions"><button class="small-btn record" data-parent="record" id="record-start">${icon('mic')} Record</button><button class="small-btn" data-parent="stop-record" id="record-stop" disabled>${icon('stop')} Stop & save</button><button class="small-btn" data-parent="preview" id="record-preview">${icon('play')} Listen</button><button class="small-btn" data-parent="delete" id="record-delete" aria-label="Delete this song recording">${icon('trash')}</button></div><div id="record-lyrics" class="record-lyrics"></div><p class="record-status" id="record-status"></p></section>
      <section class="controls-help" aria-labelledby="controls-title"><h3 id="controls-title">${icon('gamepad')} Keyboard and game controller</h3>
        <ul><li><span><kbd>Space</kbd> or <kbd>A</kbd></span> Play, hear, or count</li><li><span><kbd>Q</kbd> <kbd>E</kbd> or <kbd>LB</kbd> <kbd>RB</kbd></span> Previous and next (on Numbers: take one away, add one)</li><li><span><kbd>T</kbd> or <kbd>X</kbd></span> Touch the toy</li><li><span><kbd>P</kbd> or <kbd>Start</kbd></span> Pause the song or the counting</li><li><span><kbd>M</kbd> or <kbd>Back</kbd></span> Sound on or off</li><li><span><kbd>Arrows</kbd> or <kbd>D-pad</kbd></span> Move between buttons, then <kbd>Enter</kbd> or <kbd>A</kbd></li><li><span><kbd>Esc</kbd> or <kbd>B</kbd></span> Close, or back to Home</li></ul>
        <button class="small-btn" data-parent="graphics">${icon('settings')} Graphics and controller settings</button>
      </section>
      <p class="privacy-note"><strong>Shared play, not a lesson plan.</strong> The CDC advises no screen time before age 2, except video calls. Use real play and your own voice first. Letters and counting to 20 are here for exposure, not as milestones. The timer is an app setting, not a health limit.</p><p class="privacy-note">No ads, analytics, accounts, or child profiles. Recordings stay in this browser. Clearing site data removes them. The microphone runs only after you press Record and allow access.</p>`;
  refreshRecordingStatus();
  $('#volume-setting').addEventListener('input', (e) => {
    settings.volume = Number(e.target.value);
    sound.setVolume(settings.volume, settings.muted);
    if (preview) preview.volume = settings.muted ? 0 : settings.volume;
    saveSettings();
  });
  $('#session-setting').addEventListener('change', (e) => {
    settings.session = Number(e.target.value);
    saveSettings();
  });
  $('#quality-setting').addEventListener('change', (e) => kit?.settings.set({ quality: e.target.value }));
  $('#z-setting').addEventListener('change', (e) => {
    settings.z = e.target.value;
    saveSettings();
    updateTransport();
  });
  $('#singer-source').addEventListener('change', (e) => {
    settings.singerSource = e.target.value;
    saveSettings();
    updateTransport();
  });
  updateSingerUI();
  $('#record-song').addEventListener('change', () => {
    stopPreview();
    refreshRecordingStatus();
  });
  // The dialog just changed under a controller user: start them at the top.
  if (padFocusEl) focusEl(d.querySelector('.dialog-close'), false);
}
function updateSingerUI() {
  const el = $('#neural-saved');
  if (!el) return;
  const n = singer.saved;
  el.innerHTML = n
    ? `<p class="neural-note">${n} neural song ${n === 1 ? 'version' : 'versions'} from an earlier version of this app ${n === 1 ? 'is' : 'are'} saved on this device. ${n === 1 ? 'It plays' : 'They play'} when “Best voice on this device” is chosen.</p><div class="neural-actions"><button class="small-btn" data-parent="remove-singer">Remove saved neural songs</button></div>`
    : '';
}
function refreshRecordingStatus() {
  const key = $('#record-song')?.value;
  if (!key) return;
  const saved = recordings[key];
  $('#record-preview').disabled = !saved || recordBusy;
  $('#record-delete').disabled = !saved || recordBusy;
  const song = songs.find((s) => s.id === key);
  $('#record-status').textContent = saved
    ? 'Your voice is saved on this device. It will play with this song.'
    : song && !singer.has(song, 1, settings.z)
      ? 'No parent recording yet. This song plays music only until you record it.'
      : 'No parent recording yet. The built-in singer is ready.';
}
function stopPreview() {
  if (preview) {
    preview.pause();
    preview = null;
  }
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
}
function recordUI(busy) {
  recordBusy = busy;
  ['record-start', 'record-song', 'record-preview', 'record-delete'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  });
  const stopButton = $('#record-stop');
  if (stopButton) stopButton.disabled = !busy;
  document.querySelector('.recording-banner')?.remove();
  if (busy) {
    const b = document.createElement('div');
    b.className = 'recording-banner';
    b.textContent = 'Microphone is on · Grown-up voice recording';
    document.body.appendChild(b);
  }
}
async function startRecording() {
  if (recordBusy) return;
  stop();
  stopPreview();
  const job = ++recordJob;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Recording needs a supported browser on HTTPS or localhost.');
    return;
  }
  const songId = $('#record-song').value;
  recordSong = songs.find((s) => s.id === songId);
  if (!recordSong) return;
  recordBusy = true;
  $('#record-start').disabled = true;
  $('#record-status').textContent = 'Allow microphone access to record your voice.';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    if (job !== recordJob || !$('#parent-dialog').open) {
      stream.getTracks().forEach((t) => t.stop());
      recordBusy = false;
      return;
    }
    micStream = stream;
    recordUI(true);
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const ownRecorder = recorder;
    const ownSong = recordSong;
    const ownChunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) ownChunks.push(e.data);
    };
    recorder.onerror = () => {
      finishRecording(false);
      toast('The recording stopped. Please try again.');
    };
    recorder.onstop = async () => {
      const chunks = ownChunks.slice();
      const shouldSave = ownRecorder.lwSave === true;
      const seconds = (performance.now() - (ownRecorder.lwStarted || performance.now())) / 1000;
      stream.getTracks().forEach((t) => t.stop());
      if (shouldSave && chunks.length && seconds > 1) {
        const value = { blob: new Blob(chunks, { type: ownRecorder.mimeType }), rate: 1, created: Date.now() };
        recordings[ownSong.id] = value;
        settings.singerSource = 'parent';
        saveSettings();
        const source = $('#singer-source');
        if (source) source.value = 'parent';
        try {
          await store.put(ownSong.id, value);
          if ($('#record-status')) $('#record-status').textContent = 'Saved on this device. Your voice will play with this song.';
        } catch (_) {
          toast('Voice is ready for this session. Device storage was not available.');
        }
      } else if (shouldSave) toast('The recording was too short. Record at least a few words.');
      refreshRecordingStatus();
      updateTransport();
    };
    let count = 3;
    $('#record-status').textContent = `Ready? Start in ${count}.`;
    recordTimer = setInterval(() => {
      if (job !== recordJob) {
        clearInterval(recordTimer);
        return;
      }
      count--;
      if (count > 0) {
        $('#record-status').textContent = `Ready? Start in ${count}.`;
        return;
      }
      clearInterval(recordTimer);
      recorder.start(250);
      recordStarted = performance.now();
      recorder.lwStarted = recordStarted;
      $('#record-status').textContent = 'Recording. Sing with the words below.';
      sound
        .play(ownSong, {
          rate: 1,
          onNote: (note) => {
            const el = $('#record-lyrics');
            if (el) el.textContent = ownSong.phrases[note.line].text;
          },
          onEnd: () => finishRecording(true),
        })
        .catch(() => finishRecording(false));
    }, 1000);
  } catch (error) {
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    recordUI(false);
    refreshRecordingStatus();
    toast(error.name === 'NotAllowedError' ? 'Microphone access was not allowed. Nothing was recorded.' : 'The microphone could not start. Nothing was recorded.');
  }
}
function finishRecording(save) {
  recordJob++;
  clearInterval(recordTimer);
  sound.stop();
  if (recorder && recorder.state !== 'inactive') {
    recorder.lwSave = save;
    recorder.stop();
  } else if (save && recordBusy) toast('Recording had not started yet.');
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  recordUI(false);
  if ($('#record-lyrics')) $('#record-lyrics').textContent = '';
  refreshRecordingStatus();
}
function closeParents() {
  finishRecording(false);
  stopPreview();
  $('#parent-dialog').close();
  document.body.classList.toggle('calm', settings.calm);
  if (world) world.calm = settings.calm;
  updateTransport();
  lastDialogClose = performance.now();
  kit?.input.settle();
}
$('#parent-dialog').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-parent]');
  if (!b) return;
  const action = b.dataset.parent;
  if (action === 'close') closeParents();
  else if (action === 'calm' || action === 'voice') {
    settings[action] = !settings[action];
    b.setAttribute('aria-checked', String(settings[action]));
    saveSettings();
    if (action === 'calm') {
      document.body.classList.toggle('calm', settings.calm);
      if (world) world.calm = settings.calm;
    }
    if (action === 'voice' && !settings.voice && 'speechSynthesis' in window) speechSynthesis.cancel();
  } else if (action === 'remove-singer') {
    try {
      await singer.remove();
      toast('Saved neural songs removed. Built-in singing is ready.');
    } catch (error) {
      toast(error.message);
    }
  } else if (action === 'graphics') kit?.menu.open();
  else if (action === 'record') startRecording();
  else if (action === 'stop-record') finishRecording(true);
  else if (action === 'preview') {
    stopPreview();
    const saved = recordings[$('#record-song').value];
    if (!saved) return;
    previewURL = URL.createObjectURL(saved.blob);
    preview = new Audio(previewURL);
    preview.volume = settings.muted ? 0 : settings.volume;
    preview.onended = stopPreview;
    preview.play().catch(() => toast('This browser could not play the saved recording.'));
  } else if (action === 'delete') {
    const key = $('#record-song').value;
    stopPreview();
    try {
      await store.remove(key);
      delete recordings[key];
      refreshRecordingStatus();
      updateTransport();
      toast('The voice recording was deleted.');
    } catch (_) {
      toast('The recording could not be deleted. Try again.');
    }
  }
});
$('#parent-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  closeParents();
});

function endSession(d) {
  state.started = false;
  state.elapsed = 0;
  state.breakShown = false;
  d.close();
  lastDialogClose = performance.now();
  navigate('home');
}
function showBreak() {
  stop();
  state.breakShown = true;
  const d = $('#break-dialog');
  d.innerHTML = `<div class="break-content">${icon('heart')}<h2 id="break-title">Time for a cuddle.</h2><p>Put the phone down.<br>Sing your favorite bit together.<br>Find a real toy to explore.</p><button class="primary-btn" id="end-session">All done for now ${icon('check')}</button><button class="small-btn" id="break-more">Grown-up controls</button></div>`;
  d.showModal();
  kit?.input.settle();
  $('#end-session').onclick = () => endSession(d);
  $('#break-more').onclick = () => {
    d.innerHTML = `<div class="parent-gate">${icon('lock')}<h2 id="break-title">Start a new moment?</h2><p>A grown-up can hold the button below.<br>Real play can be a good next step.</p><button class="hold-btn" id="break-hold"><span>Hold to start a new session</span></button><button class="small-btn" id="break-done" style="margin-top:15px">All done</button></div>`;
    holdButton($('#break-hold'), () => {
      state.elapsed = 0;
      state.breakShown = false;
      d.close();
      lastDialogClose = performance.now();
      kit?.input.settle();
    });
    $('#break-done').onclick = () => endSession(d);
    if (padFocusEl) focusEl($('#break-hold'), false);
  };
  if (padFocusEl) focusEl($('#end-session'), false);
}
$('#break-dialog').addEventListener('cancel', (e) => e.preventDefault());

let timerPrevious = performance.now();
setInterval(() => {
  const now = performance.now();
  const delta = Math.min(2, (now - timerPrevious) / 1000);
  timerPrevious = now;
  if (document.hidden || !state.started || $('#parent-dialog').open || $('#break-dialog').open || kit?.menu.isOpen) return;
  state.elapsed += delta;
  const el = $('#session-time');
  if (el) el.textContent = `${timeLabel(state.elapsed)} together`;
  if (state.elapsed >= settings.session * 60 && !state.breakShown) showBreak();
}, 1000);
function pauseSound() {
  if (state.playing && state.page === 'songs') {
    state.offset = sound.pause();
    state.playing = false;
    playToken++;
  } else stop(false);
  if (recordBusy) finishRecording(false);
  stopPreview();
  updateTransport();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseSound();
  timerPrevious = performance.now();
});
window.addEventListener('pagehide', () => {
  stop(false);
  finishRecording(false);
  stopPreview();
});
Promise.all(
  songs.map(async (song) => {
    try {
      const r = await store.get(song.id);
      if (r) recordings[song.id] = r;
    } catch (_) {}
  })
).then(updateTransport);

/* ------------------------------------------------------------------ keyboard and controller */

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const HINTS = {
  keyboard: {
    home: [['Space', 'Sing'], ['Arrows', 'Move'], ['Enter', 'Choose'], ['M', 'Sound']],
    songs: [['Space', 'Play or pause'], ['Q', 'E', 'Song'], ['T', 'Touch the toy'], ['Esc', 'Home']],
    letters: [['Space', 'Hear it'], ['Q', 'E', 'Letter'], ['T', 'Touch the toy'], ['Esc', 'Home']],
    numbers: [['Space', 'Count along'], ['E', 'Add one'], ['Q', 'Take one away'], ['Esc', 'Home']],
    explore: [['Space', 'Hear it'], ['Q', 'E', 'Next thing'], ['T', 'Touch the toy'], ['Esc', 'Home']],
  },
  gamepad: {
    home: [['A', 'Sing or choose'], ['D-pad', 'Move'], ['Back', 'Sound']],
    songs: [['A', 'Play or pause'], ['LB', 'RB', 'Song'], ['X', 'Touch the toy'], ['B', 'Home']],
    letters: [['A', 'Hear it'], ['LB', 'RB', 'Letter'], ['X', 'Touch the toy'], ['B', 'Home']],
    numbers: [['A', 'Count along'], ['RB', 'Add one'], ['LB', 'Take one away'], ['B', 'Home']],
    explore: [['A', 'Hear it'], ['LB', 'RB', 'Next thing'], ['X', 'Touch the toy'], ['B', 'Home']],
  },
};
/** Button prompts under the controls, for the device in use. Hidden on touch screens. */
function updateHints() {
  const el = $('#control-hints');
  if (!el) return;
  const source = kit?.input.source;
  const show = source === 'gamepad' || (source === 'keyboard' && !touchOnly);
  el.hidden = !show;
  if (!show) return;
  const list = HINTS[source][state.page] || HINTS[source].home;
  el.innerHTML = list.map((h) => `<span>${h.slice(0, -1).map((k) => `<kbd>${k}</kbd>`).join(' ')} ${h[h.length - 1]}</span>`).join('');
}

const NAV_SELECTOR = 'button, select, input, [tabindex="0"]';
let padFocusEl = null;
let navHeld = null;
let navRepeatAt = 0;
let holding = null;
const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
function navCandidates(scope) {
  return [...scope.querySelectorAll(NAV_SELECTOR)].filter((el) => !el.disabled && !el.closest('[hidden]') && isVisible(el));
}
function focusKey(el) {
  if (!el?.dataset) return null;
  const d = el.dataset;
  if (d.action) return `[data-action="${d.action}"]` + ['page', 'id', 'index', 'value'].filter((k) => d[k] != null).map((k) => `[data-${k}="${CSS.escape(d[k])}"]`).join('');
  return el.id ? `#${CSS.escape(el.id)}` : null;
}
function focusEl(el, scroll = true) {
  if (!el) return;
  if (padFocusEl && padFocusEl !== el) padFocusEl.classList.remove('pad-focus');
  padFocusEl = el;
  el.classList.add('pad-focus');
  try {
    el.focus({ preventScroll: true });
  } catch (_) {}
  if (scroll) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: settings.calm ? 'auto' : 'smooth' });
}
function clearPadFocus() {
  padFocusEl?.classList.remove('pad-focus');
  padFocusEl = null;
}
// Pointing and tapping take over from the controller highlight.
window.addEventListener('pointerdown', clearPadFocus, true);

function stepSelect(el, dir) {
  const n = el.options.length;
  if (!n) return;
  el.selectedIndex = (el.selectedIndex + dir + n) % n;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function stepRange(el, dir) {
  const step = Number(el.step) || 0.01;
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 1;
  el.value = String(Math.max(min, Math.min(max, Number(el.value) + dir * step * 5)));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
/** Spatial navigation: move to the nearest control in that direction. */
function moveFocus(dir) {
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const scope = openDialog() || $('#app');
  const current = document.activeElement;
  if (dx && current === padFocusEl && kit.input.source === 'gamepad') {
    if (current.tagName === 'SELECT') return stepSelect(current, dx);
    if (current.tagName === 'INPUT' && current.type === 'range') return stepRange(current, dx);
  }
  const list = navCandidates(scope);
  if (!list.length) return;
  if (!list.includes(current)) {
    const main = scope.querySelector('#main-control, [data-action="start-song"], .dialog-close, #end-session');
    focusEl(main && list.includes(main) ? main : list[0]);
    return;
  }
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === current || el.contains(current) || current.contains(el)) continue;
    const b = el.getBoundingClientRect();
    const x = b.left + b.width / 2 - cx;
    const y = b.top + b.height / 2 - cy;
    const along = dx ? x * dx : y * dy;
    if (along <= 4) continue;
    const score = along + (dx ? Math.abs(y) : Math.abs(x)) * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}
function handleNav(v) {
  let dir = null;
  if (Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (!dir) {
    navHeld = null;
    return;
  }
  const now = performance.now();
  if (dir === navHeld && now < navRepeatAt) return;
  navRepeatAt = now + (dir === navHeld ? 150 : 420);
  navHeld = dir;
  moveFocus(dir);
}
function activateFocused(el) {
  if (el === kit.canvas) return sceneTap('stage');
  if (el._hold) {
    el._hold.begin();
    holding = el;
    return;
  }
  if (el.tagName === 'SELECT') return stepSelect(el, 1);
  if (el.tagName === 'INPUT' && el.type === 'range') return;
  el.click();
}
function confirmAction() {
  const dialog = openDialog();
  const scope = dialog || $('#app');
  const el = document.activeElement;
  const focused = el && el !== document.body && scope.contains(el) && (el === padFocusEl || Boolean(dialog));
  if (kit.input.source === 'gamepad' && focused) return activateFocused(el);
  if (dialog) return; // the keyboard's Enter and Space go to the dialog's own buttons
  if (el === kit.canvas) return sceneTap('stage');
  mainControl();
}
function back() {
  if (performance.now() - lastDialogClose < 300) return;
  if ($('#parent-dialog').open) return closeParents();
  if ($('#break-dialog').open) return;
  if (state.page !== 'home') navigate('home');
}
function pauseAction() {
  if (state.page === 'songs') playSong();
  else if (state.page === 'numbers') {
    if (state.playing) stop(false);
    else countAlong();
  }
}
function stepAction(dir) {
  if (state.page === 'numbers') {
    if (dir > 0) addApple();
    else takeApple();
  } else if (state.page !== 'home') advance(dir);
}
function handleInput() {
  const input = kit.input;
  if (holding && (!input.down('confirm') || !holding.isConnected)) {
    holding._hold?.end();
    holding = null;
  }
  handleNav(input.vector('nav'));
  if (input.pressed('back')) back();
  if (input.pressed('confirm')) confirmAction();
  if (input.pressed('mute')) toggleMute();
  if (openDialog()) return;
  if (input.pressed('pause')) pauseAction();
  if (input.pressed('prev')) stepAction(-1);
  if (input.pressed('next')) stepAction(1);
  if (input.pressed('toy')) sceneTap('stage');
}

/* ------------------------------------------------------------------ start */

async function start() {
  render();
  kit = await boot({
    title: 'Little World',
    mount: stageMount,
    gear: 'none', // the grown-up space opens the kit settings (and F9 still does)
    touch: false, // the app's own large buttons and the toys are the touch controls
    holdLoading: true,
    renderer: { alpha: true }, // the stage floats on the page's own soft cards
    background: '#2f4a3b',
    accent: '#e9bf58',
    input: {
      nav: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
      confirm: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'] },
      back: { keys: ['Escape'], gamepad: ['B'] },
      prev: { keys: ['KeyQ'], gamepad: ['LB'] },
      next: { keys: ['KeyE'], gamepad: ['RB'] },
      toy: { keys: ['KeyT'], gamepad: ['X'] },
      pause: { keys: ['KeyP'], gamepad: ['Start'] },
      mute: { keys: ['KeyM'], gamepad: ['Back'] },
    },
  });
  const canvas = kit.canvas;
  canvas.style.touchAction = 'pan-y'; // the page still scrolls with a finger on the stage
  canvas.setAttribute('aria-label', $('#world')?.dataset.label || 'Touch the toy');
  stageMount.dataset.renderer = kit.backend;
  // The stage has no zoom: let the mouse wheel scroll the page instead of stopping on the canvas.
  stageMount.addEventListener('wheel', (e) => e.stopPropagation(), { capture: true, passive: true });

  kit.loading.progress(0.65, 'Setting out the toys…');
  world = new World(kit, { onTap: sceneTap });
  try {
    await world.warmUp((f) => kit.loading.progress(0.65 + f * 0.33));
  } catch (error) {
    console.error('Little World: warm-up failed; scenes will compile as they appear.', error);
  }
  setScene();
  kit.input.onSourceChange(updateHints);
  updateHints();
  // The kit's settings panel pauses the loop: pause the song with it.
  kit.onPause((paused) => {
    if (paused) pauseSound();
  });
  kit.start((dt, t) => {
    handleInput();
    world.update(dt, t);
  });
  kit.loading.done();
}

// Read-only status supports smoke tests without collecting usage data.
window.LWDebug = {
  get audio() {
    return { playing: sound.playing, position: sound.position, voiceLabel: sound.voiceLabel, vocalActive: Boolean(sound.vocalSource), nodeCount: sound.nodes.size, contextState: sound.ctx?.state, muted: sound.muted, masterGain: sound.master?.gain.value, vocalDuration: sound.vocalSource?.buffer?.duration };
  },
  get singer() {
    return singer.debug;
  },
  get state() {
    return { ...state };
  },
  get settings() {
    return { ...settings };
  },
  get renderInfo() {
    return kit ? { backend: kit.backend, drawCalls: kit.renderer.info.render.calls, triangles: kit.renderer.info.render.triangles, geometries: kit.renderer.info.memory.geometries, textures: kit.renderer.info.memory.textures } : null;
  },
};

start().catch((error) => console.error('Little World could not start the 3D stage:', error));
