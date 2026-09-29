/* Accessible DOM interface and orchestration. All currency is fictional.
   Input arrives through kit.input actions (keyboard and mouse, controller, touch); the clock,
   walking, dialogs and the town all run from the kit's frame loop. */

import { Game, GOALS, REGIONS, MODELS, VENUES, ACTIVITIES, PEOPLE, PERSON, DATE_VENUES, clamp, money, clock } from './sim.js';
import { Town } from './town.js';
import { createPadNav, identityOf } from './padnav.js';
import { STICK_LOOK } from 'kit/input.js';

const SAVE_KEY = 'good-company-save-v1';
const TABS = ['today', 'calendar', 'clients', 'business', 'life'];
const QUICK = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ZERO = { x: 0, y: 0 };

const paths = {
  home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9', town: 'M3 21V9l6-4 6 4v12M15 21V3l6 4v14M1 21h22M7 11h2m-2 4h2m8-6h2m-2 4h2m-2 4h2', calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18M7 15h2m3 0h2m3 0h1m-11 3h2', people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7a4 4 0 0 1 0 7.75', briefcase: 'M3 7h18v13H3ZM8 7V4h8v3M3 12a25 25 0 0 0 18 0M10 12v3h4v-3', leaf: 'M20 3C8 1 2 8 5 15s16 6 15-12ZM4 21 15 10', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', star: 'm12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.6l6.2-.9Z', wallet: 'M20 8V5H5a2 2 0 0 0 0 4h16v11H5a3 3 0 0 1-3-3V7m19 6h-6v4h6m-4-2h.01', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z', coffee: 'M3 7h13v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7Zm13 1h2a3 3 0 0 1 0 6h-2M6 2v2m4-2v2m4-2v2M2 23h17', sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4', camera: 'M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v11H2V9a2 2 0 0 1 2-2Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', art: 'M3 3h18v18H3ZM7 16l3-4 3 3 3-6 3 7M7 7h.01', tree: 'm12 2-6 7h3l-5 6h5l-4 4h14l-4-4h5l-5-6h3Zm0 17v4', pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-8-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6', chevron: 'm9 5 7 7-7 7', down: 'm6 9 6 6 6-6', arrow: 'M4 12h16m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6', shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2', pause: 'M8 5v14M16 5v14', play: 'm8 4 12 8-12 8Z', save: 'M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8', help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-3 6a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m-9 4 2-1 1-3-1-2 2-2 2 1 3-1 1-2 3 1 1 2 3 1 2-1 1 3-2 2 1 3 2 1-1 3-3 1-2-1-3 1-1 2-3-1-1-2-3-1-2 1-1-3 2-2Z', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'm6 6 12 12M6 18 18 6', compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m4 5-2 6-6 2 2-6Z', 'rotate-left': 'M3 10a9 9 0 1 1 3 9M3 4v6h6', 'rotate-right': 'M21 10a9 9 0 1 0-3 9m3-15v6h-6', energy: 'm13 2-9 12h7l-1 8 10-12h-7Z', chat: 'M21 12a8 8 0 0 1-8 8H3l2-4a8 8 0 1 1 16-4ZM8 10h8m-8 4h5', megaphone: 'm3 10 16-6v16L3 14Zm0 0v4m3 1 2 6h3l-2-5M22 9v6', book: 'M3 4h7a2 2 0 0 1 2 2 2 2 0 0 1 2-2h7v16h-7a2 2 0 0 0-2 2 2 2 0 0 0-2-2H3Zm9 2v16', download: 'M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5', upload: 'M12 16V4m-5 5 5-5 5 5M3 16v5h18v-5', lock: 'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v11H4Zm8 5v2', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6', checkcircle: 'M21 11v1a9 9 0 1 1-5.3-8.2M21 3l-9 9-3-3', flag: 'M4 22V3s4-2 8 0 8 0 8 0v10s-4 2-8 0-8 0-8 0', trend: 'm3 17 6-6 4 4 8-11M15 4h6v6', bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8m-12 8v2h6v-2', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 8v6m0-10h.01', gift: 'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13s-7 1-7-3a2 2 0 0 1 3-2c2 1 4 5 4 5Zm0 0s7 1 7-3a2 2 0 0 0-3-2c-2 1-4 5-4 5Z', bag: 'M5 7h14l2 14H3ZM9 8V5a3 3 0 0 1 6 0v3',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0m12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  gamepad: 'M6 11h4M8 9v4m7-1h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.2l-1 5.3A3 3 0 0 0 7 16l1.5-2h7l1.5 2a3 3 0 0 0 5.2-2.5l-1-5.3A4 4 0 0 0 17.3 5Z',
};
function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.sparkles}"/></svg>`;
}
function portrait(p) {
  const skin = esc(p.skin || '#d4a27c');
  const hair = esc(p.hair || '#4a382b');
  const outfit = esc(p.outfit || '#a5b69c');
  const bg = esc(p.bg || '#e7ecdb');
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><rect width="80" height="80" fill="${bg}"/><ellipse cx="40" cy="86" rx="30" ry="29" fill="${outfit}"/><path d="M33 48h14v15q-7 9-14 0Z" fill="${skin}"/><ellipse cx="40" cy="33" rx="19" ry="22" fill="${hair}"/><ellipse cx="40" cy="36" rx="16" ry="20" fill="${skin}"/><path d="M23 34Q18 10 39 10q23 0 20 26l-6-8q-18 1-23-7l-4 16Z" fill="${hair}"/><ellipse cx="34" cy="36" rx="1.1" ry="1.5" fill="#46392e"/><ellipse cx="46" cy="36" rx="1.1" ry="1.5" fill="#46392e"/><path d="M35 46q5 4 10 0" stroke="#946246" fill="none" stroke-width="1.2" stroke-linecap="round"/><path d="m28 63 12 10 12-10" fill="none" stroke="#ffffff44" stroke-width="2"/></svg>`;
}

/* DOM writes only when something changed (keeps focus, hover and scroll where they are). */
const htmlCache = new WeakMap();
function setHTML(el, html) {
  if (!el || htmlCache.get(el) === html) return false;
  htmlCache.set(el, html);
  el.innerHTML = html;
  return true;
}
function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

export function createApp({ kit, sound }) {
  const input = kit.input;
  let game;
  let loadWarning = '';
  let firstRun = false;
  try {
    const stored = localStorage.getItem(SAVE_KEY);
    firstRun = !stored;
    game = new Game(stored ? JSON.parse(stored) : null);
  } catch (error) {
    game = new Game();
    loadWarning = error.name === 'SecurityError' ? 'Browser storage is unavailable. Use Settings → Export save to keep your progress.' : 'The saved game could not be read. A fresh session is open; import a backup to restore it.';
  }
  sound.enabled = game.s.settings.sound;
  const ui = { tab: 'today', sub: 'requests', businessSub: 'studio', calendarDay: game.s.day, clientFilter: 'all', modalType: null, closable: true, lastFocus: null, lastFocusKey: null, status: 'Taking it all in', saveOK: true, lastSaved: 0, dayNotice: 0, lastSpeed: game.s.settings.speed || 1, panelKey: '', pendingEnding: false, lastLevel: game.s.level, hover: null };
  let town = null;
  let tickAccumulator = 0;
  let saveAccumulator = 0;
  let sidebarFingerprint = '';
  const state = () => game.s;
  const padnav = createPadNav({ input });
  const weekday = (day) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(day - 1) % 7];
  const ageLine = (p) => `${p.age} · ${esc(p.pronouns)}`;

  function toast(message, warning = false) {
    const stack = $('toasts');
    while (stack.children.length >= 4) stack.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (warning ? ' warning' : '');
    el.innerHTML = icon(warning ? 'info' : 'checkcircle', 16) + `<span>${esc(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 5500);
    if (warning) sound.play('warn');
  }
  function save(silent = true) {
    try {
      localStorage.setItem(SAVE_KEY, game.serialize());
      ui.saveOK = true;
      ui.lastSaved = Date.now();
      if (!silent) toast('Saved in this browser. Export a backup for another device.');
    } catch {
      ui.saveOK = false;
      if (!silent) toast('Browser storage is unavailable. Export a save file instead.', true);
    }
    updateFooter();
  }
  /** Check chapters and level-ups after any change, then save and redraw. */
  function afterChange() {
    const goals = game.checkGoals();
    save();
    render();
    for (const g of goals) {
      toast(`Chapter complete · ${g.name}${g.reward ? ' — ' + g.rewardText : ''}`);
      if (g.final) ui.pendingEnding = true;
    }
    if (goals.length) {
      sound.play('goal');
      input.rumble(0.5, 220);
    }
    if (state().level > ui.lastLevel) {
      toast(`Level ${state().level}. A skill point is waiting in My life.`);
      if (!goals.length) sound.play('success');
    }
    ui.lastLevel = state().level;
  }
  function act(fn, message) {
    try {
      const result = fn();
      afterChange();
      if (message) toast(typeof message === 'function' ? message(result) : message);
      return { ok: true, value: result };
    } catch (error) {
      if (error?.name !== 'RuleError') console.error(error);
      toast(error?.message || 'That action could not be completed.', true);
      return { ok: false };
    }
  }
  function setGame(next) {
    game = next;
    town.game = game;
    ui.calendarDay = game.s.day;
    ui.lastLevel = game.s.level;
    ui.lastSpeed = game.s.settings.speed || 1;
    sound.enabled = game.s.settings.sound;
    town.rebuild();
    ui.status = 'A fresh start';
    render();
    save();
  }

  /* ------------------------------------------------------------ persistent chrome */

  function buildChrome() {
    $('top-stats').innerHTML = `<div class="top-stat"><span class="stat-icon">${icon('wallet', 17)}</span><div><small>YOUR BALANCE</small><b id="stat-money"></b></div></div><div class="top-stat"><span class="stat-icon">${icon('star', 17)}</span><div><small>REPUTATION</small><b><span id="stat-rep"></span><span class="minor">/ 5</span></b></div></div><div class="top-stat"><span class="stat-icon">${icon('people', 17)}</span><div><small>YOUR REACH</small><b><span id="stat-reach"></span><span class="minor">people</span></b></div></div>`;
    const needSlot = (label, key, i) => `<div class="need"><div class="need-head"><span>${icon(i, 12)}${label}</span><b id="need-${key}-v"></b></div><div class="meter ${key}" id="need-${key}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`;
    $('character-hud').innerHTML = `<div class="player-block"><button class="avatar-large" data-action="profile" title="Edit character" id="hud-avatar"></button><div class="player-meta"><b id="hud-name"></b><small id="hud-level"></small><div class="status-text" id="hud-status"></div></div></div><div class="hud-divider"></div><div class="needs-row">${needSlot('Energy', 'energy', 'energy')}${needSlot('Calm', 'calm', 'leaf')}${needSlot('Style', 'style', 'sparkles')}</div><button class="hud-rest" data-action="visit" data-venue="home" title="Go home to rest (H)">${icon('moon', 14)} Recharge</button>`;
    $('time-box').innerHTML = `<span style="color:#a9a573" id="time-icon"></span><div class="clock-label"><b id="time-day"></b><small id="time-sub"></small></div><div class="time-controls"><button data-action="speed" data-value="0" aria-label="Pause clock (Space)">${icon('pause', 12)}</button><button data-action="speed" data-value="1" aria-label="Normal clock speed">1×</button><button data-action="speed" data-value="3" aria-label="Fast clock speed">3×</button></div>`;
  }
  function topStats() {
    const s = state();
    setText($('stat-money'), money(s.money));
    setText($('stat-rep'), s.reputation.toFixed(1));
    setText($('stat-reach'), String(s.followers));
    setHTML($('profile-mini'), portrait(s.avatar));
  }
  function rail() {
    const items = [['today', 'town', 'Neighborhood'], ['calendar', 'calendar', 'Planner'], ['clients', 'people', 'Clients'], ['business', 'briefcase', 'Business'], ['life', 'leaf', 'My life']];
    setHTML($('rail'), items.map(([id, i, label]) => `<button class="nav-btn ${ui.tab === id ? 'active' : ''}" data-action="nav" data-tab="${id}" aria-label="${label}" ${ui.tab === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span></button>`).join('') + `<button class="nav-btn nav-bottom" data-action="profile" aria-label="Character and settings">${icon('settings')}<span>Settings</span></button>`);
  }
  function need(label, key, i) {
    const v = Math.round(state()[key]);
    return `<div class="need"><div class="need-head"><span>${icon(i, 12)}${label}</span><b>${v}%</b></div><div class="meter ${key} ${v < 30 ? 'low' : ''}" role="meter" aria-label="${label}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></div></div>`;
  }
  function hud() {
    const s = state();
    setHTML($('hud-avatar'), portrait(s.avatar));
    setText($('hud-name'), s.avatar.name);
    setText($('hud-level'), `Level ${s.level} · ${s.model === 'independent' ? 'Independent' : s.model === 'supported' ? 'Supported' : 'Collective'}`);
    setText($('hud-status'), s.activeDate ? 'Making a connection' : town?.isWalking ? 'On the way…' : ui.status);
    for (const key of ['energy', 'calm', 'style']) {
      const v = Math.round(s[key]);
      const meter = $('need-' + key);
      setText($('need-' + key + '-v'), v + '%');
      meter.classList.toggle('low', v < 30);
      meter.setAttribute('aria-valuenow', String(v));
      const bar = meter.firstElementChild;
      if (bar.style.width !== v + '%') bar.style.width = v + '%';
    }
  }
  function timeUI() {
    const s = state();
    const night = s.minute >= 1140;
    setHTML($('time-icon'), icon(night ? 'moon' : 'sun', 21));
    setText($('time-day'), `${weekday(s.day).slice(0, 3)}, day ${s.day}`);
    setText($('time-sub'), `${clock(s.minute)} · ${s.settings.speed === 0 ? 'clock paused' : night ? 'evening' : 'a lovely day'}`);
    for (const b of $('time-box').querySelectorAll('[data-action="speed"]')) b.classList.toggle('active', Number(b.dataset.value) === s.settings.speed);
  }
  function worldUI() {
    const r = game.region();
    const e = game.event();
    setHTML($('region-link'), `${icon('pin', 12)} ${r.name} <span>·</span> Summer ${icon('down', 11)}`);
    setHTML($('world-event'), `<span class="event-icon">${icon(e.icon, 17)}</span><div><b>${e.name}</b><small>${e.description}</small></div>`);
  }
  function walkHint() {
    const src = input.source;
    const near = town && !town.walkingSomewhere && !state().activeDate ? town.nearbyVenue() : null;
    const hint = $('walk-hint');
    if (near) {
      const place = esc(VENUES[near].short.toUpperCase());
      hint.classList.add('prompt');
      setHTML(hint, src === 'touch' ? `TAP ${place} TO VISIT` : `${src === 'gamepad' ? 'X' : 'F'} <span>·</span> VISIT ${place}`);
      return;
    }
    hint.classList.remove('prompt');
    setHTML(hint, src === 'gamepad' ? 'LEFT STICK TO WALK <span>·</span> X TO INTERACT <span>·</span> D-PAD FOR MENUS' : src === 'touch' ? 'TAP TO WANDER <span>·</span> TAP A PLACE TO VISIT <span>·</span> PINCH TO ZOOM' : 'CLICK TO WANDER <span>·</span> WASD TO WALK <span>·</span> F TO INTERACT');
  }

  /* ------------------------------------------------------------ side panel */

  function panelHeader(kicker, title, subtitle, tabs = '') {
    return `<div class="panel-top"><div class="panel-kicker"><span>${kicker}</span><span class="pill">DAY ${state().day}</span></div><h2>${title}</h2><p class="panel-sub">${subtitle}</p>${tabs}</div>`;
  }
  const saveLabel = () => (ui.saveOK ? 'Your progress is saved' : 'Session only · export to save');
  function footer() {
    return `<div class="panel-footer" id="panel-footer"><span>${icon('checkcircle', 11)} <span id="save-status">${saveLabel()}</span></span><span>A LITTLE LIFE, WELL LIVED</span></div>`;
  }
  function updateFooter() {
    setText($('save-status'), saveLabel());
  }
  /** The first milestone, then whichever chapter comes next. */
  function goalCard() {
    const s = state();
    if (!s.flags.goal) {
      const pct = Math.min(1, s.completed / 6, Math.max(0, s.money) / 1600, s.calm / 50) * 100;
      return `<div class="goal-card"><div class="eyebrow">${icon('flag', 11)} YOUR FIRST CHAPTER</div><h3>Build something that feels like you</h3><p>Complete 6 dates, save $1,600, and keep calm above 50. There’s no deadline.</p><div class="goal-progress"><div class="meter"><i style="width:${pct}%"></i></div><span>${Math.min(6, s.completed)} / 6 dates</span></div></div>`;
    }
    const next = GOALS.find((g) => !g.final && !Object.hasOwn(s.goals, g.id)) || GOALS.find((g) => !Object.hasOwn(s.goals, g.id));
    if (!next) return `<div class="goal-card"><div class="eyebrow">${icon('flag', 11)} EVERY CHAPTER WRITTEN</div><h3>A little life, well lived</h3><p>Keep growing, open doors for others, or simply enjoy the life you have made.</p><button class="text-btn" data-action="chapters">Look back on your chapters</button></div>`;
    const p = game.goalProgress(next);
    return `<div class="goal-card"><div class="eyebrow">${icon('flag', 11)} YOUR NEXT CHAPTER</div><h3>${next.name}</h3><p>${next.text}</p><div class="goal-progress"><div class="meter"><i style="width:${Math.round((p.value / p.target) * 100)}%"></i></div><span>${p.value} / ${p.target}</span></div><button class="text-btn" data-action="chapters">All chapters · ${Object.keys(s.goals).length} / ${GOALS.length}</button></div>`;
  }
  function chapterLine(g) {
    const s = state();
    const p = game.goalProgress(g);
    let count = `${p.value} / ${p.target}`;
    if (g.final && !p.done) count = `${Math.min(20, s.completed)} / 20 dates · ${s.reputation.toFixed(1)}★ · ${Math.min(4, Object.keys(s.goals).filter((k) => k !== 'wellLived').length)} / 4 chapters`;
    return `<div class="chapter ${p.done ? 'done' : ''}"><div class="chapter-head"><b>${icon(p.done ? 'checkcircle' : g.final ? 'star' : 'flag', 12)} ${g.name}</b><small>${p.done ? 'DAY ' + s.goals[g.id] : count}</small></div><p>${g.text}</p><div class="meter"><i style="width:${p.done ? 100 : Math.round((p.value / p.target) * 100)}%"></i></div><small class="chapter-reward">${icon('gift', 10)} ${g.rewardText}</small></div>`;
  }
  function tutorialCard() {
    const t = state().flags.tutorial;
    if (t >= 3) return '';
    const steps = ['Screen a request to check references, or open it with View request.', 'Propose a date: choose a time, a public venue, and a fair total fee.', 'When it is almost time, choose Head to date to walk there and meet your client.'];
    return `<div class="notice tutorial">${icon('info', 16)}<div><b>First steps · ${t + 1} of 3</b><br>${steps[t]}</div></div>`;
  }
  const venueTag = (v) => (v === 'lounge' ? 'Dinner' : v === 'gallery' ? 'Art date' : v === 'park' ? 'A little outdoors' : v === 'barge' ? 'Music on the water' : 'Coffee date');
  function requestCard(r) {
    const p = PERSON(r.person);
    const c = game.contact(p.id);
    const fee = Math.round((state().baseRate * p.duration) / 60);
    const risk = p.risk;
    return `<article class="request-card"><div class="client-top"><button class="portrait" data-action="contact" data-id="${p.id}" title="Open ${esc(p.name)}’s profile">${portrait(p)}</button><div><div class="client-name">${esc(p.name)}${c.visits ? ' <span class="accent-text">✦</span>' : ''}</div><div class="client-role">${esc(p.job)} · ${p.age}</div></div><div class="right"><div class="price">${money(fee)}<small>your ${p.duration === 90 ? '90 min' : '1 hr'} rate</small></div></div></div><p class="client-tagline">${esc(p.note)}</p><div class="tags"><span class="tag">${icon(VENUES[p.venue].icon, 10)} ${venueTag(p.venue)}</span>${VENUES[p.venue].opens ? `<span class="tag outline">${icon('moon', 10)} Evenings</span>` : ''}<span class="tag ${r.screened ? (risk ? 'warn' : 'outline') : 'peach'}">${icon(r.screened ? 'shield' : 'eye', 10)} ${r.screened ? (risk ? 'Discuss boundaries' : 'References checked') : 'Not screened'}</span>${c.visits ? '<span class="tag purple">Regular</span>' : ''}</div><div class="card-actions"><button class="btn secondary" data-action="screen" data-id="${r.id}" ${r.screened ? 'disabled' : ''}>${icon(r.screened ? 'check' : 'shield', 12)} ${r.screened ? 'Checked' : 'Screen · ' + money(game.screeningCost())}</button><button class="btn primary flex" data-action="negotiate" data-id="${r.id}">View request ${icon('arrow', 12)}</button></div></article>`;
  }
  function bookingCard(b) {
    const p = PERSON(b.person);
    const done = !['scheduled', 'active'].includes(b.status);
    return `<div class="booking ${done ? 'done' : ''}"><div class="booking-time">${clock(b.start)}</div><div class="booking-content"><b>${esc(p.name)}</b><p>${VENUES[b.venue].name} · ${b.duration} min · ${money(b.price)}</p><div class="tags"><span class="tag ${done ? 'outline' : ''}">${b.status === 'completed' ? `${b.rating.toFixed(1)} stars` : b.status === 'scheduled' ? 'Booked' : esc(b.status)}</span>${b.screened ? `<span class="tag outline">${icon('shield', 9)} Screened</span>` : ''}</div>${b.status === 'scheduled' ? `<div class="card-actions"><button class="btn primary" data-action="meet" data-id="${b.id}">${icon('pin', 11)} ${b.day === state().day ? 'Head to date' : 'View booking'}</button><button class="btn secondary" data-action="cancel-booking" data-id="${b.id}">Cancel</button></div>` : b.status === 'active' ? '<button class="btn primary mt" data-action="resume-date">Continue date</button>' : ''}</div></div>`;
  }
  function renderToday() {
    const s = state();
    const today = s.bookings.filter((b) => b.day === s.day).sort((a, b) => a.start - b.start);
    const tabs = `<div class="panel-tabs"><button data-action="sub" data-tab="requests" class="${ui.sub === 'requests' ? 'active' : ''}">Requests <span class="tiny-count">${s.requests.length}</span></button><button data-action="sub" data-tab="day" class="${ui.sub === 'day' ? 'active' : ''}">My day <span class="tiny-count">${today.filter((b) => b.status === 'scheduled').length}</span></button><button data-action="sub" data-tab="journal" class="${ui.sub === 'journal' ? 'active' : ''}">Journal</button></div>`;
    let body = '';
    if (ui.sub === 'requests') {
      body += tutorialCard();
      const next = today.find((b) => b.status === 'scheduled');
      if (next) body += `<div class="notice">${icon('calendar', 16)}<div>Next up: <b>${esc(PERSON(next.person).name.split(' ')[0])} at ${clock(next.start)}</b>.<br><button class="text-btn" data-action="meet" data-id="${next.id}">Make your way to ${VENUES[next.venue].short}</button></div></div>`;
      body += `<div class="section-label"><span>${s.requests.length ? 'A LITTLE POSSIBILITY IN YOUR INBOX' : 'A LITTLE ROOM TO BREATHE'}</span>${icon('sparkles', 12)}</div>`;
      body += s.requests.length ? s.requests.map(requestCard).join('') : `<div class="empty">${icon('coffee', 27)}<h3>Your inbox is all caught up.</h3><p>Run a campaign, make a connection at The Marigold, or enjoy the rest of your day.</p><button class="btn mt" data-action="nav" data-tab="business">Visit your business studio</button></div>`;
      body += goalCard();
    } else if (ui.sub === 'day') {
      body += `<div class="section-label"><span>${weekday(s.day).toUpperCase()} · YOUR TIME, YOUR CHOICE</span></div>`;
      body += today.length ? today.map(bookingCard).join('') : `<div class="empty">${icon('calendar', 27)}<h3>A little space for something good.</h3><p>Screen a request and agree to a date to start filling your day.</p></div>`;
      body += `<button class="btn secondary full mt" data-action="sleep">${icon('moon', 13)} Close the day</button>`;
    } else {
      body = s.journal.map((j) => `<div class="log-item"><small>DAY ${j.day} · ${clock(j.time)}</small>${esc(j.message)}</div>`).join('');
    }
    return panelHeader('THE DAY IS YOURS', 'Hello, possibilities.', 'A few new faces. A little room to grow.', tabs) + `<div class="panel-body">${body}</div>` + footer();
  }
  function renderCalendar() {
    const d = ui.calendarDay;
    const s = state();
    const bookings = s.bookings.filter((b) => b.day === d).sort((a, b) => a.start - b.start);
    return (
      panelHeader('MAKE ROOM FOR WHAT MATTERS', 'Your day, by design.', 'Every booking includes a little breathing room.') +
      `<div class="panel-body"><div class="day-nav"><button class="icon-btn" data-action="calendar-day" data-value="-1" aria-label="Previous day" ${d <= 1 ? 'disabled' : ''}>${icon('chevron', 14).replace('<svg ', '<svg style="transform:rotate(180deg)" ')}</button><b>${weekday(d)} · day ${d}</b><button class="icon-btn" data-action="calendar-day" data-value="1" aria-label="Next day" ${d >= s.day + 1 ? 'disabled' : ''}>${icon('chevron', 14)}</button></div>${bookings.length ? bookings.map(bookingCard).join('') : `<div class="empty mb">${icon('calendar', 27)}<h3>Nothing on the calendar. Yet.</h3><p>Agree on a time and fee from an incoming request.</p></div>`}<div class="notice mt">${icon('clock', 15)}<div>Travel buffer: <b>20 minutes</b> between bookings.<br>Check in no later than 30 minutes after the agreed start.</div></div><button class="btn secondary full" data-action="wait">${icon('clock', 13)} Take a little time · 30 min</button><button class="btn full mt" data-action="sleep">${icon('moon', 13)} Turn in for the night</button>${goalCard()}</div>` +
      footer()
    );
  }
  function renderClients() {
    const s = state();
    const known = PEOPLE.filter((p) => s.requests.some((r) => r.person === p.id) || s.bookings.some((b) => b.person === p.id) || s.contacts[p.id]?.notes || s.contacts[p.id]?.favorite || s.contacts[p.id]?.blocked);
    const filtered = known.filter((p) => ui.clientFilter === 'all' || (ui.clientFilter === 'regulars' ? game.contact(p.id).visits > 0 : game.contact(p.id).blocked));
    const tabs = `<div class="panel-tabs">${[['all', 'All contacts'], ['regulars', 'Regulars'], ['blocked', 'Blocked']].map(([id, name]) => `<button data-action="client-filter" data-tab="${id}" class="${ui.clientFilter === id ? 'active' : ''}">${name}</button>`).join('')}</div>`;
    const cards = filtered
      .map((p) => {
        const c = game.contact(p.id);
        return `<article class="request-card"><div class="client-top"><span class="portrait">${portrait(p)}</span><div><div class="client-name">${esc(p.name)} ${c.favorite ? '✦' : ''}</div><div class="client-role">${c.visits ? c.visits + ' completed date' + (c.visits > 1 ? 's' : '') : 'A new connection'}</div></div><span style="margin-left:auto;color:#b09a65">${c.lastRating ? c.lastRating.toFixed(1) : ''}</span></div><div class="tags mt">${p.interests.map((i) => `<span class="tag outline">${i}</span>`).join('')}${c.blocked ? '<span class="tag warn">Blocked</span>' : ''}</div>${c.notes ? `<p class="client-tagline">${esc(c.notes.slice(0, 100))}</p>` : ''}<button class="btn secondary full mt" data-action="contact" data-id="${p.id}">View notes & preferences ${icon('arrow', 11)}</button></article>`;
      })
      .join('');
    return panelHeader('CONNECTIONS, NOT JUST CONTACTS', 'Your kind of people.', 'Keep the details that make a date feel thoughtful.', tabs) + `<div class="panel-body">${filtered.length ? cards : `<div class="empty">${icon('people', 25)}<h3>${ui.clientFilter === 'blocked' ? 'A clear list.' : 'Good connections take time.'}</h3><p>Client history will grow as you complete dates.</p></div>`}</div>` + footer();
  }
  function renderBusiness() {
    const s = state();
    const model = game.model();
    const tabs = `<div class="panel-tabs"><button data-action="business-sub" data-tab="studio" class="${ui.businessSub === 'studio' ? 'active' : ''}">Your studio</button><button data-action="business-sub" data-tab="numbers" class="${ui.businessSub === 'numbers' ? 'active' : ''}">The numbers</button><button data-action="business-sub" data-tab="support" class="${ui.businessSub === 'support' ? 'active' : ''}">Support</button></div>`;
    let body = '';
    if (ui.businessSub === 'studio') {
      body = `<div class="settings-group"><h3>Your time has value.</h3><p>Your base rate sets the starting quote. Client budgets respond to region, demand, and your reputation.</p><label class="range-label" for="base-rate">Hourly companionship rate <b id="rate-value">${money(s.baseRate)}</b></label><input type="range" id="base-rate" min="60" max="400" step="10" value="${s.baseRate}" aria-label="Hourly rate"><div class="range-ticks"><span>$60 · approachable</span><span>$400 · premium</span></div></div><div class="section-label mt"><span>A LITTLE MORE VISIBILITY</span>${icon('megaphone', 12)}</div>${['photos', 'campaign', 'network', 'openmic'].map((id) => activityCard(id)).join('')}<button class="choice-card" data-action="regions"><div class="choice-head">${game.region().name}${icon('arrow', 13)}</div><p>${game.region().market}<br>${money(game.region().rent)} daily living costs.</p></button>${permitCard()}<div class="settings-group"><h3>What comes after independent?</h3><p>A peer-run shared studio earns $65 daily in workspace income. Unlock at 8 completed dates, 4.5 reputation, and $3,000 savings.</p><button class="btn full mt" data-action="agency" ${s.flags.agency ? 'disabled' : ''}>${s.flags.agency ? 'Your shared studio is open' : 'Launch studio · $1,800'}</button></div>`;
    } else if (ui.businessSub === 'support') {
      body = `<div class="notice">${icon('shield', 16)}<div>Support can lower pressure without limiting your boundaries. You can always end a date safely.</div></div>` + Object.values(MODELS).map((m) => `<button class="choice-card ${s.model === m.id ? 'selected' : ''}" data-action="model" data-id="${m.id}"><div class="choice-head">${m.name}${s.model === m.id ? icon('check', 14) : ''}</div><p>${m.description}</p><div class="tags mt"><span class="tag">${m.fee ? '22% revenue share' : m.daily ? money(m.daily) + ' / day' : 'Keep 100%'}</span><span class="tag outline">${m.safety ? '-' + m.safety + ' pressure points' : 'Full autonomy'}</span></div></button>`).join('');
    } else {
      const net = s.ledger.filter((t) => t.day >= s.day - 6).reduce((v, t) => v + t.amount, 0);
      const owed = s.bookings.filter((b) => b.status === 'scheduled').reduce((v, b) => v + b.price - b.deposit, 0);
      body = `<div class="stat-grid"><div class="stat-tile"><small>Net cash flow · 7 days</small><b>${money(net)}</b></div><div class="stat-tile"><small>Date earnings · lifetime</small><b>${money(s.totalEarned)}</b></div></div><div class="settings-group"><h3>The little details add up.</h3><p>Daily living: ${money(game.region().rent)}<br>Daily support: ${money(model.daily)}<br>Agency share: ${Math.round(model.fee * 100)}% of date revenue<br>Unpaid booking balances: ${money(owed)}</p></div><div class="section-label"><span>RECENT CASH MOVEMENTS</span>${icon('wallet', 12)}</div>${s.ledger.length ? s.ledger.slice(0, 35).map((t) => `<div class="ledger-row"><div>${esc(t.label)}<small>Day ${t.day} · ${clock(t.time)}</small></div><strong class="${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${money(t.amount)}</strong></div>`).join('') : '<div class="empty">Your first chapter starts with $680. Your ledger begins with your first transaction.</div>'}<p class="panel-sub mt">Deposits appear when received and are deducted from final payments. Net cash flow includes expenses and refunds.</p>`;
    }
    return panelHeader('A BUSINESS THAT FITS YOUR LIFE', 'Make it your own.', 'Set your pace, your price, and your support.', tabs) + `<div class="panel-body">${body}</div>` + footer();
  }
  function permitCard() {
    const s = state();
    const r = game.region();
    return r.permit ? `<div class="notice ${s.permitUntil < s.day ? 'warning' : ''}">${icon('briefcase', 16)}<div><b>Fictional city business permit</b><br>${s.permitUntil >= s.day ? 'Current through day ' + s.permitUntil : 'Renew before accepting a booking.'}<br><button class="text-btn" data-action="permit">7-day permit · ${money(r.permit)}</button></div></div>` : '';
  }
  const effectTags = (a) => Object.entries(a.effect).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`);
  function activityCard(id) {
    const a = ACTIVITIES[id];
    return `<button class="choice-card" data-action="activity-visit" data-id="${id}"><div class="choice-head"><span>${icon(a.icon, 14)} &nbsp;${a.name}</span><small>${a.cost ? money(a.cost) : 'Free'}</small></div><p>${a.text}</p><div class="tags mt"><span class="tag outline">${icon('clock', 10)} ${a.time} min</span>${a.after ? `<span class="tag outline">${icon('moon', 10)} from ${clock(a.after)}</span>` : ''}<span class="tag outline">${a.skill ? '+1 ' + a.skill : a.followers ? '+' + a.followers + ' reach' : effectTags(a).join(' · ')}</span></div></button>`;
  }
  function renderLife() {
    const s = state();
    const chaptersDone = Object.keys(s.goals).length;
    return (
      panelHeader('YOU ARE MORE THAN YOUR WORK', 'A little care goes far.', 'Build a life you have the energy to enjoy.') +
      `<div class="panel-body"><div class="settings-group"><div class="needs-row mb">${need('Health', 'health', 'leaf')}${need('Nourished', 'hunger', 'coffee')}</div><div class="needs-row">${need('Privacy', 'privacy', 'lock')}${need('Connection', 'connection', 'heart')}</div></div><div class="settings-group"><div class="bond-row"><span class="portrait">${portrait({ skin: '#b78564', hair: '#40372c', outfit: '#b2b6a0', bg: '#e8e7d9' })}</span><div><b>Jamie · your friend</b><p>${s.connection > 65 ? '“Let’s make time for something ordinary.”' : s.connection > 30 ? '“I miss our little catch-ups.”' : '“It feels like it’s been a while.”'}</p><div class="meter"><i style="width:${s.connection}%"></i></div></div></div><button class="btn secondary full" data-action="activity-visit" data-id="friend">${icon('heart', 12)} Make some time · 30 min</button><button class="btn secondary full mt" data-action="activity-visit" data-id="sunset">${icon('music', 12)} A sunset cruise on the barge · from ${clock(ACTIVITIES.sunset.after)}</button></div><div class="section-label mt"><span>GROW AT YOUR OWN PACE</span><span>${s.skillPoints} POINT${s.skillPoints === 1 ? '' : 'S'}</span></div><div class="settings-group">${Object.entries(s.skills).map(([k, v]) => `<div class="skill-row"><div><b>${k.charAt(0).toUpperCase() + k.slice(1)}</b><div class="skill-dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div></div><button class="btn secondary" data-action="upgrade" data-id="${k}" ${s.skillPoints < 1 || v >= 5 ? 'disabled' : ''}>${icon('plus', 11)} Learn</button></div>`).join('')}<div class="xp-row"><span>Level ${s.level}</span><span>${s.xp} / 100 XP</span></div><div class="meter"><i style="width:${s.xp}%"></i></div></div><div class="section-label mt"><span>YOUR CHAPTERS</span><span>${chaptersDone} / ${GOALS.length}</span></div>${GOALS.map(chapterLine).join('')}<div class="section-label mt"><span>SMALL THINGS THAT HELP</span>${icon('leaf', 12)}</div>${['rest', 'meal', 'unwind', 'freshen', 'wellness'].map(activityCard).join('')}</div>` +
      footer()
    );
  }
  function render() {
    const active = document.activeElement;
    const keep = active && active !== document.body && !$('modal-shade').contains(active) ? identityOf(active) : null;
    topStats();
    rail();
    hud();
    timeUI();
    worldUI();
    const body = ui.tab === 'calendar' ? renderCalendar() : ui.tab === 'clients' ? renderClients() : ui.tab === 'business' ? renderBusiness() : ui.tab === 'life' ? renderLife() : renderToday();
    const sidebar = $('sidebar');
    const panelKey = [ui.tab, ui.sub, ui.businessSub, ui.clientFilter, ui.calendarDay].join('|');
    const scroll = panelKey === ui.panelKey ? sidebar.querySelector('.panel-body')?.scrollTop || 0 : 0;
    ui.panelKey = panelKey;
    if (setHTML(sidebar, body)) {
      const panel = sidebar.querySelector('.panel-body');
      if (panel) panel.scrollTop = scroll;
    }
    renderLabels();
    // Keep keyboard and controller focus on "the same" button after a redraw.
    if (keep && !active.isConnected && $('modal-shade').hidden) document.querySelector(keep)?.focus({ preventScroll: true });
  }
  function renderLabels() {
    const s = state();
    const html = Object.entries(VENUES)
      .map(([id, v]) => {
        const booked = s.bookings.some((b) => b.venue === id && b.day === s.day && ['scheduled', 'active'].includes(b.status));
        return `<button class="map-label ${booked ? 'booked' : ''}" id="label-${id}" data-action="visit" data-venue="${id}" aria-label="Walk to ${v.name}">${icon(v.icon, 12)}${v.short}${booked ? ' · date' : ''}</button>`;
      })
      .join('');
    if (setHTML($('world-labels'), html)) {
      ui.hover = null;
      if (town) positionLabels();
    }
  }
  function positionLabels() {
    for (const [id, v] of Object.entries(VENUES)) {
      const el = $('label-' + id);
      if (!el) continue;
      const p = town.project(v.label);
      el.style.left = p[0] + 'px';
      el.style.top = p[1] + 'px';
      el.style.visibility = p[0] < 20 || p[0] > town.width - 20 || p[1] < 20 || p[1] > town.height - 22 ? 'hidden' : 'visible';
    }
  }
  function setHover(venue) {
    if (ui.hover === venue) return;
    if (ui.hover) $('label-' + ui.hover)?.classList.remove('hover');
    ui.hover = venue;
    if (venue) $('label-' + venue)?.classList.add('hover');
    kit.canvas.style.cursor = venue ? 'pointer' : '';
  }

  /* ------------------------------------------------------------ dialogs */

  function modal(title, body, kicker = 'A LITTLE POSSIBILITY', type = 'generic', wide = false, closable = true) {
    const shade = $('modal-shade');
    const el = $('modal');
    if (shade.hidden) {
      ui.lastFocus = document.activeElement;
      ui.lastFocusKey = identityOf(document.activeElement);
      sound.play('open');
    }
    ui.modalType = type;
    ui.closable = closable;
    el.className = 'modal' + (wide ? ' wide' : '');
    el.innerHTML = `<div class="modal-head"><div><div class="eyebrow">${kicker}</div><h2 id="modal-title">${title}</h2></div>${closable ? `<button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close', 18)}</button>` : ''}</div>${body}`;
    shade.hidden = false;
    el.scrollTop = 0;
    setHover(null);
    if (input.source === 'gamepad') padnav.focusDefault(el, true);
    else el.focus({ preventScroll: true });
  }
  function closeModal() {
    if (state().activeDate && ui.modalType === 'date') return;
    // Any other dialog opened during a date leads back to the date.
    if (state().activeDate) {
      openDate();
      return;
    }
    $('modal-shade').hidden = true;
    ui.modalType = null;
    if (ui.lastFocus?.isConnected) ui.lastFocus.focus?.({ preventScroll: true });
    else if (ui.lastFocusKey) document.querySelector(ui.lastFocusKey)?.focus({ preventScroll: true });
    input.settle();
  }
  /** B, Esc: close what can be closed; during a date only the "are you sure" step steps back. */
  function back() {
    if (ui.modalType === 'date') return;
    if (ui.modalType === 'exit') {
      openDate();
      return;
    }
    if (!ui.closable) return;
    closeModal();
  }
  function openNegotiation(id) {
    const r = game.request(id);
    const p = PERSON(r.person);
    const s = state();
    const opens = VENUES[p.venue].opens || 0;
    let day = s.day;
    let start = Math.max(660, opens, Math.ceil((s.minute + 25) / 30) * 30);
    if (start + p.duration > 1290) {
      day++;
      start = Math.max(660, opens);
    }
    const value = Math.round((s.baseRate * p.duration) / 60);
    modal(
      'A good date starts here.',
      `<div class="modal-client"><span class="portrait">${portrait(p)}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.job)} · ${ageLine(p)}</p><div class="tags">${p.interests.map((i) => `<span class="tag">${i}</span>`).join('')}</div></div></div><p class="modal-sub">${esc(p.note)}<br><b>${p.kind}</b> · ${p.duration} minutes. Your quote covers companionship and conversation only. Meeting at ${VENUES[p.venue].name}, where they asked, starts things off a little warmer.</p><div id="screening-message" class="notice ${!r.screened || p.risk ? 'warning' : ''}">${icon('shield', 16)}<div>${r.screened ? (p.risk ? 'References checked. A personal-contact or venue-change request needs a clear boundary.' : 'References checked. Payment history looks reliable; a public venue is agreed.') : 'References have not been checked. Screening takes 20 minutes and helps avoid unreliable bookings.'}${!r.screened ? `<br><button class="text-btn" data-action="screen-modal" data-id="${id}">Screen this request · ${money(game.screeningCost())}</button>` : ''}</div></div><div class="round-meta"><span>Estimated pressure · ${game.risk({ screened: r.screened, person: r.person })} / 100</span><span>${MODELS[s.model].name}</span></div><p class="panel-sub mb">Pressure affects calm after the date. Screening and support reduce it; boundaries always remain yours.</p><form id="booking-form" data-request="${id}"><div class="field-grid"><label class="field">Day<select name="day"><option value="${s.day}" ${day === s.day ? 'selected' : ''}>Today · day ${s.day}</option><option value="${s.day + 1}" ${day > s.day ? 'selected' : ''}>Tomorrow · day ${s.day + 1}</option></select></label><label class="field">Start time<input name="start" type="time" min="10:00" max="${clock(1290 - p.duration)}" step="1800" value="${clock(start)}" required></label><label class="field">Public venue<select name="venue">${DATE_VENUES.map((v) => `<option value="${v}" ${p.venue === v ? 'selected' : ''}>${VENUES[v].name}${VENUES[v].opens ? ' · from ' + clock(VENUES[v].opens) : ''}</option>`).join('')}</select></label><label class="field">Total date fee ($)<input name="price" type="number" min="40" max="1500" step="1" value="${value}" required></label></div><label class="check-row"><input name="deposit" type="checkbox" checked> Take a 25% booking deposit</label><label class="check-row"><input name="boundaries" type="checkbox" checked> Confirm public venue, professional contact & mutual consent</label><div id="offer-response"></div><div class="quote-summary"><span>Clear terms. No pressure.<br>You can decline or leave at any time.</span><span>Client’s indicated budget <b>${r.screened ? money(r.budget) : 'Unverified'}</b></span></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="decline" data-id="${id}">Not a fit</button><button type="submit" class="btn primary">Propose this date ${icon('arrow', 13)}</button></div></form>`,
      'NEW REQUEST',
      'negotiate'
    );
  }
  function offerSubmit(form) {
    const fd = new FormData(form);
    const parts = String(fd.get('start')).split(':');
    const start = Number(parts[0]) * 60 + Number(parts[1]);
    const opts = { day: Number(fd.get('day')), start, price: Number(fd.get('price')), venue: String(fd.get('venue')), deposit: fd.get('deposit') === 'on', boundaries: fd.get('boundaries') === 'on' };
    const result = act(() => game.offer(form.dataset.request, opts));
    if (!result.ok) return;
    if (!result.value.accepted) {
      $('offer-response').innerHTML = `<div class="notice warning mt">${icon('chat', 16)}<div>“That’s a little above my budget. Could we do <b>${money(result.value.counter)}</b>?”<br><button type="button" class="text-btn" data-action="accept-counter" data-value="${result.value.counter}">Use their counteroffer</button></div></div>`;
      sound.play('choice');
      input.rumble(0.15, 60);
      return;
    }
    const b = result.value.booking;
    closeModal();
    ui.sub = 'day';
    ui.tab = 'today';
    render();
    sound.play('book');
    input.rumble(0.25, 90);
    toast(`Booked ${PERSON(b.person).name.split(' ')[0]} for ${clock(b.start)}. ${b.deposit ? money(b.deposit) + ' deposit received.' : 'No deposit taken.'}`);
  }
  function goVenue(id, intent = null) {
    if (state().activeDate) {
      toast('Finish or safely end your current date first.', true);
      return;
    }
    if (!$('modal-shade').hidden) closeModal();
    ui.status = 'On the way to ' + VENUES[id].short;
    town.visit(id, intent || { venue: id });
    hud();
  }
  function openVenue(id) {
    const v = VENUES[id];
    const s = state();
    const upcoming = s.bookings.filter((b) => b.day === s.day && b.venue === id && b.status === 'scheduled').sort((a, b) => a.start - b.start);
    ui.status = 'At ' + v.short;
    const intro = id === 'home' ? 'Your own little place to recharge.' : id === 'park' ? 'A little green space. A little room to breathe.' : id === 'barge' ? 'A canal boat with a music deck, strung with lanterns. The quartet plays from 17:00.' : 'Stay a while. Make something of your time here.';
    const closed = v.opens && s.minute < v.opens ? `<div class="notice">${icon('moon', 16)}<div>The barge welcomes guests from <b>${clock(v.opens)}</b>. Come back this evening, or book a date for later.</div></div>` : '';
    const cards = v.activities
      .map((a, i) => {
        const activity = ACTIVITIES[a];
        const locked = activity.after && s.minute < activity.after;
        return `<button class="choice-card" data-action="${a === 'sleep' ? 'sleep' : 'do-activity'}" data-id="${a}" ${locked ? 'disabled' : ''}><div class="choice-head"><span>${icon(activity.icon, 15)} &nbsp;${activity.name}</span><small>${activity.cost ? money(activity.cost) : 'Free'} · ${i + 1}</small></div><p>${activity.text}</p>${a !== 'sleep' ? `<div class="tags mt"><span class="tag outline">${activity.time} minutes</span>${activity.after ? `<span class="tag outline">from ${clock(activity.after)}</span>` : ''}${effectTags(activity).map((t) => `<span class="tag outline">${t}</span>`).join('')}</div>` : ''}</button>`;
      })
      .join('');
    modal(v.name, `<p class="modal-sub">${intro}</p>${closed}${upcoming.length ? `<div class="section-label"><span>YOUR UPCOMING DATE</span></div>${upcoming.map(bookingCard).join('')}<hr>` : ''}${cards}`, 'A LITTLE TIME FOR YOU', 'venue');
  }
  function activityVenue(id) {
    return Object.keys(VENUES).find((v) => VENUES[v].activities.includes(id));
  }
  function arrive(intent) {
    if (intent.booking) {
      let b;
      try {
        b = game.booking(intent.booking);
      } catch {
        return;
      }
      if (b.status !== 'scheduled') {
        toast('That appointment is no longer available.', true);
        return;
      }
      if (state().minute < b.start) {
        modal('A little ahead of time.', `<p class="modal-sub">You’ve arrived at <b>${VENUES[b.venue].name}</b>. Your date with <b>${esc(PERSON(b.person).name.split(' ')[0])}</b> starts at <b>${clock(b.start)}</b>.</p><div class="notice">${icon('clock', 17)}<div>You are ${Math.ceil(b.start - state().minute)} minutes early. Waiting advances the clock and your needs.</div></div><div class="modal-actions"><button class="btn secondary" data-action="close">Enjoy the neighborhood</button><button class="btn primary" data-action="begin-date" data-id="${b.id}">Wait & meet ${icon('arrow', 13)}</button></div>`, 'YOUR NEXT CONNECTION', 'waiting');
      } else beginDate(b.id);
    } else if (intent.activity) {
      const result = act(() => game.activity(intent.activity));
      if (result.ok) {
        ui.status = result.value.name;
        sound.play('arrive');
        toast(result.value.name + ' — a little time well spent.');
      }
    } else openVenue(intent.venue);
  }
  function meet(id) {
    const b = game.booking(id);
    if (b.day > state().day) {
      toast(`This date is booked for tomorrow at ${clock(b.start)}.`);
      return;
    }
    goVenue(b.venue, { venue: b.venue, booking: id });
  }
  function beginDate(id) {
    const r = act(() => game.startDate(id));
    if (!r.ok) return;
    if (r.value.noShow) {
      closeModal();
      toast('Your client did not arrive. Screening and deposits help avoid no-shows.', true);
      return;
    }
    openDate();
  }
  function openDate() {
    const d = state().activeDate;
    if (!d) return;
    const b = game.booking(d.bookingId);
    const p = PERSON(b.person);
    const prompt = game.datePrompt();
    modal(
      'Make a little connection.',
      `<div class="date-scene"><span class="portrait">${portrait(p)}</span><h3>${esc(p.name.split(' ')[0])} & you</h3><p>${VENUES[b.venue].name} · ${p.kind}</p></div><div class="round-meta"><span>${prompt.title.toUpperCase()}</span><span>MOMENT ${d.round + 1} OF 3</span></div><div class="meter"><i style="width:${d.rapport}%"></i></div><div class="round-meta" style="margin-top:6px"><span>Connection</span><span>${Math.round(d.rapport)} / 100</span></div>${d.feedback ? `<div class="feedback">${esc(d.feedback)}</div>` : ''}<p class="dialogue">${esc(prompt.text)}</p>${prompt.choices.map((c, i) => `<button class="date-choice" data-action="date-choice" data-value="${i}"><span class="choice-index">${i + 1}</span><span>${esc(c.text)}</span>${c.exit ? icon('shield', 14) : ''}</button>`).join('')}<div class="quote-summary"><span>${icon('lock', 12)} Your boundaries stay yours.</span><button class="text-btn" data-action="exit-date">End date safely</button></div>`,
      'COMPANIONSHIP & CONVERSATION',
      'date',
      false,
      false
    );
  }
  function dateResult(r) {
    const p = PERSON(r.person);
    ui.status = r.early ? 'Taking care of myself' : 'A lovely connection';
    modal(
      r.early ? 'Your boundaries come first.' : r.rating >= 4.5 ? 'A little date. A lovely connection.' : 'Every date teaches you something.',
      `<div class="date-scene"><span class="portrait">${portrait(p)}</span><h3>${r.early ? 'A thoughtful exit' : esc(p.name.split(' ')[0]) + ' enjoyed your company'}</h3><div class="result-money">+${money(r.net)}</div><p>Total earned${r.commission ? ' · after agency share' : ''}</p></div>${r.early ? '<div class="notice">No reputation penalty. Your time was paid proportionately, with any deposit reconciled.</div>' : `<div style="text-align:center"><div class="rating-stars">${'★'.repeat(Math.round(r.rating))}${'☆'.repeat(5 - Math.round(r.rating))}</div><p class="modal-sub">${r.rating.toFixed(1)} / 5 · ${esc(r.feedback || 'Clear terms and genuine attention made a difference.')}</p></div>`}<div class="result-metrics"><div><b>${money(r.tip)}</b><small>A little extra · tip</small></div><div><b>${state().reputation.toFixed(1)}</b><small>Your reputation</small></div><div><b>${state().completed}</b><small>Dates completed</small></div></div><p class="panel-sub">${money(r.deposit)} was received as a deposit. ${money(r.received)} was settled now.${r.commission ? ' Agency fee: ' + money(r.commission) + '.' : ''}</p>${r.goal ? '<div class="notice mt">Your first chapter is complete: six dates, $1,600 saved, and room to breathe. There is more life to make.</div>' : ''}<div class="modal-actions"><button class="btn secondary" data-action="contact" data-id="${p.id}">Make a little note</button><button class="btn primary" data-action="close">Back to my day ${icon('arrow', 13)}</button></div>`,
      'A MOMENT WORTH KEEPING',
      'result'
    );
    sound.play(r.early ? 'arrive' : r.rating >= 4.5 ? 'success' : 'coin');
    input.rumble(r.early ? 0.2 : 0.45, 160);
    render();
  }
  function askExit() {
    modal('It’s okay to call it a day.', '<p class="modal-sub">End the date on your own terms. You’ll receive proportionate payment for time spent, with <b>no reputation penalty</b>.</p><div class="modal-actions"><button class="btn secondary" data-action="resume-date">Continue the date</button><button class="btn primary" data-action="confirm-exit">End safely</button></div>', 'YOUR CHOICE, ALWAYS', 'exit', false, false);
  }
  function openContact(id) {
    const p = PERSON(id);
    const c = game.contact(id);
    const s = state();
    const known = s.requests.find((r) => r.person === id);
    modal('The little things matter.', `<div class="modal-client"><span class="portrait">${portrait(p)}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.job)} · ${ageLine(p)}</p><div class="tags">${p.interests.map((i) => `<span class="tag">${i}</span>`).join('')}</div></div></div><div class="stat-grid"><div class="stat-tile"><small>Dates together</small><b>${c.visits}</b></div><div class="stat-tile"><small>Last review</small><b>${c.lastRating ? c.lastRating.toFixed(1) + ' / 5' : 'A new face'}</b></div></div><p class="modal-sub">${esc(p.note)}<br><b>Favorite place:</b> ${VENUES[p.venue].name}${known?.screened ? '<br><b>Screening:</b> ' + (p.risk ? 'Discuss personal-contact and venue boundaries.' : 'References checked; reliable public-meeting preferences.') : ''}</p><form id="contact-form" data-person="${id}"><label class="field">Your private notes<textarea name="notes" maxlength="600" placeholder="Favorite topics, little preferences, things to remember…">${esc(c.notes)}</textarea></label><label class="check-row"><input type="checkbox" name="favorite" ${c.favorite ? 'checked' : ''}> Prioritize this contact for referrals</label><div class="modal-actions"><button type="button" class="btn danger" data-action="block-contact" data-id="${id}">${c.blocked ? 'Unblock contact' : 'Block contact'}</button><button type="submit" class="btn primary">Save little details ${icon('check', 12)}</button></div></form>`, 'YOUR CLIENT JOURNAL', 'contact');
  }
  function openRegions() {
    const s = state();
    modal(
      'Where will your next chapter be?',
      `<p class="modal-sub">Three fictional regions, three different rhythms. Moving costs $100 plus any initial permit. Finish or cancel upcoming bookings first. Region rules are invented game mechanics, not real-world legal guidance.</p><div class="region-options">${Object.values(REGIONS)
        .map((r) => {
          const here = s.region === r.id;
          const cost = here ? 0 : game.moveCost(r.id);
          return `<div class="choice-card ${here ? 'selected' : ''}"><div class="region-swatch" style="background:${r.color}">${icon(r.id === 'coast' ? 'sun' : r.id === 'arts' ? 'art' : 'tree', 28)}</div><div class="choice-head">${r.name}</div><p>${r.description}</p><div class="region-facts">Client budgets · ×${r.demand.toFixed(2)}<br>Living costs · ${money(r.rent)} / day<br>Permit · ${r.permit ? money(r.permit) + ' / 7 days' : 'not required'}<br>Base pressure · ${r.risk} / 100</div><button class="btn ${here ? 'secondary' : 'primary'} full" data-action="move-region" data-id="${r.id}" ${here ? 'disabled' : ''}>${here ? 'You are here' : cost ? 'Move · ' + money(cost) : 'Move home · Jamie helps'}</button></div>`;
        })
        .join('')}</div>`,
      'A CHANGE OF SCENERY',
      'regions',
      true
    );
  }
  function openSleep() {
    const s = state();
    const pending = s.bookings.filter((b) => b.day === s.day && b.status === 'scheduled');
    const rested = s.energy >= 60 && s.calm >= 60 && s.connection >= 60;
    modal('Close the books. Open tomorrow.', `<p class="modal-sub">A little sleep will restore energy and calm. Tomorrow brings a fresh inbox, a new market mood, and another chance to build the life you want.</p><div class="stat-grid"><div class="stat-tile"><small>Daily living costs</small><b>${money(game.region().rent)}</b></div><div class="stat-tile"><small>Support costs</small><b>${money(game.model().daily)}</b></div></div>${rested ? `<div class="notice">${icon('heart', 16)}<div>Energy, calm, and connection are all in a good place tonight. That counts toward <b>A life, not just a job</b>.</div></div>` : ''}${pending.length ? `<div class="notice warning">${icon('calendar', 16)}<div>You have <b>${pending.length} unfinished booking${pending.length > 1 ? 's' : ''}</b> today. Turning in cancels them and refunds their deposits.</div></div>` : ''}<div class="modal-actions"><button class="btn secondary" data-action="close">A little longer</button><button class="btn primary" data-action="confirm-sleep">Goodnight, ${game.region().name} ${icon('moon', 13)}</button></div>`, 'THE END OF A LITTLE DAY', 'sleep');
  }
  function sleep() {
    const result = act(() => game.nextDay());
    if (!result.ok) return;
    town.teleport(state().avatar.x, state().avatar.z);
    ui.calendarDay = state().day;
    ui.status = 'A fresh start';
    ui.tab = 'today';
    ui.sub = 'requests';
    const r = result.value;
    modal('Another day, another possibility.', `<p class="modal-sub">Day ${r.day} is behind you. Here is how it came together.</p><div class="stat-grid"><div class="stat-tile"><small>Completed dates</small><b>${r.completed}</b></div><div class="stat-tile"><small>Net cash flow</small><b>${money(r.income)}</b></div></div><div class="notice">${icon(game.event().icon, 18)}<div><b>Today: ${game.event().name}</b><br>${game.event().description}</div></div>${r.grant ? '<div class="notice">A one-time $200 community restart grant is in your balance. There is always room for a fresh start.</div>' : ''}<p class="modal-sub">Needs have recovered with sleep. Make time for breakfast and a fresh outfit before your first date.</p><div class="modal-actions"><button class="btn primary" data-action="close">Let’s see what today brings ${icon('arrow', 13)}</button></div>`, 'GOOD MORNING', 'summary');
    sound.play('night');
    render();
  }
  function openProfile() {
    const s = state();
    const a = s.avatar;
    modal('A life that feels like yours.', `<form id="profile-form"><div class="modal-client"><span class="portrait">${portrait(a)}</span><div><h3>${esc(a.name)}</h3><p>Level ${s.level} · ${a.age} · ${esc(a.pronouns)}</p><div class="tags"><span class="tag">All characters are adults</span></div></div></div><div class="field-grid"><label class="field full">Name<input name="name" maxlength="30" value="${esc(a.name)}" required></label><label class="field">Age (21–75)<input name="age" type="number" min="21" max="75" step="1" value="${a.age}" required></label><label class="field">Pronouns<select name="pronouns">${['they / them', 'she / her', 'he / him'].map((p) => `<option ${p === a.pronouns ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label class="field">Outfit color<input name="outfit" type="color" value="${a.outfit}"></label><label class="field">Skin tone<input name="skin" type="color" value="${a.skin}"></label><label class="field">Hair color<input name="hair" type="color" value="${a.hair}"></label><label class="field">Starting background<select name="background" ${a.customized || s.bookings.length ? 'disabled' : ''}><option value="fresh" ${a.background === 'fresh' ? 'selected' : ''}>Fresh start · +1 screening</option><option value="people" ${a.background === 'people' ? 'selected' : ''}>People person · +1 conversation · −$80</option><option value="business" ${a.background === 'business' ? 'selected' : ''}>Business savvy · +1 negotiation · −$80</option></select></label></div><p class="panel-sub">Appearance and pronouns are cosmetic, not risk or income modifiers. A starting background can be chosen once, before your first booking.</p><label class="check-row"><input name="reducedMotion" type="checkbox" ${s.settings.reducedMotion ? 'checked' : ''}> Reduce decorative animation</label><label class="check-row"><input name="sound" type="checkbox" ${s.settings.sound ? 'checked' : ''}> Sound effects</label><div class="modal-actions"><button class="btn primary" type="submit">Make it mine ${icon('check', 13)}</button></div></form><hr><h3>Your progress, kept safe.</h3><p class="panel-sub">Autosaves stay in this browser. Export a save to keep a portable backup. Imported saves replace this session.</p><div class="export-row"><button class="btn secondary" data-action="export">${icon('download', 13)} Export save</button><button class="btn secondary" data-action="import">${icon('upload', 13)} Import save</button></div><div class="export-row"><button class="btn secondary" data-action="graphics">${icon('settings', 13)} Graphics & controls</button><button class="btn secondary" data-action="help">How to play</button></div><div class="export-row"><button class="btn danger" data-action="reset">Start a new life</button></div>`, 'CHARACTER & SETTINGS', 'profile');
  }
  function controlsHTML() {
    const src = input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' ? 'touch' : 'keyboard';
    const cols = {
      keyboard: ['Keyboard & mouse', [['Click', 'walk, or visit a building'], ['W A S D', 'walk'], ['Q  E', 'turn the camera'], ['Wheel · + −', 'zoom'], ['F', 'interact where you stand'], ['Space', 'pause the clock'], ['1–5', 'switch panels, or pick an answer'], ['H', 'head home'], ['Esc · P', 'close a dialog · pause menu'], ['F9', 'graphics & controls']]],
      gamepad: ['Controller', [['Left stick', 'walk'], ['D-pad', 'move through menus'], ['A', 'choose'], ['B', 'back'], ['X', 'interact'], ['Y', 'pause the clock'], ['LB  RB', 'turn the camera'], ['Right stick', 'zoom · flick to turn · scroll'], ['LT  RT', 'switch panels'], ['View', 'head home'], ['Start', 'pause menu']]],
      touch: ['Touch', [['Tap', 'walk, or visit a building'], ['Tap a label', 'walk there'], ['Pinch', 'zoom'], ['⟲ ⟳ − +', 'turn and zoom the camera'], ['II  1×  3×', 'pause or speed up time']]],
    };
    const order = [src, ...['keyboard', 'gamepad', 'touch'].filter((k) => k !== src)];
    return `<div class="controls-grid">${order.map((k) => `<div class="controls-col ${k === src ? 'current' : ''}"><h3>${icon(k === 'gamepad' ? 'gamepad' : k === 'touch' ? 'sparkles' : 'book', 13)} ${cols[k][0]}${k === src ? ' <span class="pill">IN USE</span>' : ''}</h3>${cols[k][1].map(([key, what]) => `<p><kbd>${key}</kbd> ${what}</p>`).join('')}</div>`).join('')}</div>`;
  }
  function help() {
    modal('A little ambition. A lot of possibility.', `<p class="modal-sub">You’re building an adult, non-explicit companionship business in a bright little town. Your time, your boundaries, and your definition of success come first.</p><div class="help-grid"><div><h3>01 · Start with a good fit</h3><p>Screen a request, discuss boundaries, and propose a public venue, time, and total fee. Clients may counteroffer. Deposits protect against unreliable bookings.</p></div><div><h3>02 · Make the connection</h3><p>Use <b>Head to date</b> to walk to your booking. Listen, notice preferences, and keep the date within agreed terms. Reviews, tips, and regulars follow good care.</p></div><div><h3>03 · Build at your own pace</h3><p>Set rates in Business, run campaigns, and choose independence, trusted support, or a collective. Regions change demand and costs. Skills improve with experience.</p></div><div><h3>04 · Have a life, too</h3><p>Rest, eat, reconnect, and invest in wellbeing. Dates use energy. Daily costs are deducted when you turn in. Chapters in My life give you longer goals, with no deadlines.</p></div></div><hr><h3>A few little controls</h3>${controlsHTML()}<p class="panel-sub">The clock pauses while a dialog is open. Walking still works when the clock is paused. On a date, you can always leave safely. The Lantern Barge on the canal opens in the evening.</p><div class="notice">${icon('info', 17)}<div>All clients are 21+. No explicit sexual content. Business permits and regional rules are fictional. There are no real payments, external accounts, or gameplay uploads.</div></div><div class="modal-actions"><button class="btn primary" data-action="close">Let’s make a little life ${icon('arrow', 13)}</button></div>`, 'WELCOME TO GOOD COMPANY', 'help', true);
  }
  function openPause() {
    modal('Take a breath.', `<p class="modal-sub">The clock waits while this is open. It is ${clock(state().minute)} on day ${state().day} in ${game.region().name}.</p><div class="pause-grid"><button class="btn primary large" data-action="close">${icon('play', 13)} Back to my day</button><button class="btn secondary" data-action="save">${icon('save', 13)} Save now</button><button class="btn secondary" data-action="chapters">${icon('flag', 13)} Your chapters</button><button class="btn secondary" data-action="profile">${icon('settings', 13)} Character & settings</button><button class="btn secondary" data-action="graphics">${icon('sparkles', 13)} Graphics & controls</button><button class="btn secondary" data-action="help">${icon('help', 13)} How to play</button><button class="btn secondary" data-action="export">${icon('download', 13)} Export save</button></div>`, 'PAUSED', 'pause');
  }
  function openChapters() {
    const s = state();
    modal('A life in chapters.', `<p class="modal-sub">Longer goals for a life with room in it. Each one comes with a little reward. ${Object.keys(s.goals).length} of ${GOALS.length} written so far.</p>${GOALS.map(chapterLine).join('')}<div class="modal-actions"><button class="btn primary" data-action="close">Back to my day ${icon('arrow', 13)}</button></div>`, 'YOUR CHAPTERS', 'chapters');
  }
  function openEnding() {
    const s = state();
    s.flags.ending = true;
    save();
    const regulars = Object.values(s.contacts).filter((c) => c.visits >= 2).length;
    modal('A little life, well lived.', `<div class="date-scene"><span class="portrait">${portrait(s.avatar)}</span><h3>${esc(s.avatar.name)} · good company</h3><p>Day ${s.day} · ${game.region().name}</p></div><p class="modal-sub">Twenty good dates, a reputation people trust, and a life with room in it. The final chapter is written, and there is still tomorrow.</p><div class="result-metrics"><div><b>${s.completed}</b><small>Dates completed</small></div><div><b>${s.reputation.toFixed(1)}</b><small>Reputation</small></div><div><b>${money(s.totalEarned)}</b><small>Earned in total</small></div></div><div class="result-metrics"><div><b>${regulars}</b><small>Regulars</small></div><div><b>${s.stats.bestRating.toFixed(1)}</b><small>Best review</small></div><div><b>${Object.keys(s.goals).length} / ${GOALS.length}</b><small>Chapters</small></div></div><div class="modal-actions"><button class="btn secondary" data-action="export">${icon('download', 13)} Keep this life</button><button class="btn primary" data-action="close">Keep living ${icon('arrow', 13)}</button></div>`, 'THE FINAL CHAPTER', 'ending', true);
    sound.play('goal');
    input.rumble(0.7, 320);
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(state(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `good-company-day-${state().day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('A portable save has been exported.');
  }
  function toggleClock() {
    const s = state();
    if (s.settings.speed) {
      ui.lastSpeed = s.settings.speed;
      s.settings.speed = 0;
    } else s.settings.speed = ui.lastSpeed || 1;
    save();
    timeUI();
    sound.play('tap');
  }
  function setTab(id) {
    if (ui.tab === id) return;
    ui.tab = id;
    ui.calendarDay = state().day;
    render();
    sound.play('tap');
  }

  /* ------------------------------------------------------------ the clock */

  function tick(dt) {
    tickAccumulator += dt;
    saveAccumulator += dt;
    const s = state();
    if (!s.activeDate && $('modal-shade').hidden && s.settings.speed > 0) {
      game.advance(dt * 0.65 * s.settings.speed);
      if (s.minute >= 1320 && ui.dayNotice !== s.day) {
        ui.dayNotice = s.day;
        toast('The day is winding down. Turn in at home when you’re ready.');
      }
    }
    if (tickAccumulator >= 0.25) {
      tickAccumulator = 0;
      timeUI();
      hud();
      topStats();
      walkHint();
      const fingerprint = s.bookings
        .filter((b) => b.day >= s.day)
        .map((b) => b.id + b.status)
        .join('|');
      if (fingerprint !== sidebarFingerprint) {
        sidebarFingerprint = fingerprint;
        render();
      }
    }
    if (saveAccumulator > 20) {
      saveAccumulator = 0;
      save();
    }
  }

  /* ------------------------------------------------------------ clicks and forms */

  function routeAction(el) {
    const a = el.dataset.action;
    const id = el.dataset.id;
    const v = el.dataset.value;
    if (a === 'nav') return setTab(el.dataset.tab);
    if (a === 'sub') {
      ui.sub = el.dataset.tab;
      sound.play('tap');
      return render();
    }
    if (a === 'business-sub') {
      ui.businessSub = el.dataset.tab;
      sound.play('tap');
      return render();
    }
    if (a === 'client-filter') {
      ui.clientFilter = el.dataset.tab;
      sound.play('tap');
      return render();
    }
    if (a === 'close') return closeModal();
    if (a === 'help') return help();
    if (a === 'profile') return openProfile();
    if (a === 'pause') return openPause();
    if (a === 'chapters') return openChapters();
    if (a === 'graphics') return kit.menu.open();
    if (a === 'save') return save(false);
    if (a === 'speed') {
      state().settings.speed = Number(v);
      if (Number(v) > 0) ui.lastSpeed = Number(v);
      save();
      timeUI();
      sound.play('tap');
      return;
    }
    if (a === 'rotate') return town.rotate(Number(v));
    if (a === 'zoom') return town.adjustZoom(Number(v));
    if (a === 'homecamera') return town.resetCamera();
    if (a === 'calendar-day') {
      ui.calendarDay = clamp(ui.calendarDay + Number(v), 1, state().day + 1);
      return render();
    }
    if (a === 'visit') return goVenue(el.dataset.venue);
    if (a === 'screen' || a === 'screen-modal') {
      const result = act(() => game.screen(id));
      if (result.ok) {
        toast(result.value);
        if (a === 'screen-modal') openNegotiation(id);
      }
      return;
    }
    if (a === 'negotiate') {
      try {
        openNegotiation(id);
      } catch (error) {
        toast(error.message, true);
      }
      return;
    }
    if (a === 'decline') {
      const result = act(() => game.decline(id));
      if (result.ok) {
        closeModal();
        toast('Not every request needs to be a yes.');
      }
      return;
    }
    if (a === 'accept-counter') {
      $('booking-form').elements.price.value = v;
      $('offer-response').innerHTML = '<div class="feedback">Counteroffer entered. Check the time and terms, then propose the date again.</div>';
      return;
    }
    if (a === 'meet') return meet(id);
    if (a === 'begin-date') return beginDate(id);
    if (a === 'resume-date') return openDate();
    if (a === 'date-choice') {
      const result = act(() => game.dateChoice(Number(v)));
      if (result.ok) {
        if (result.value.done) dateResult(result.value.result);
        else {
          sound.play('choice');
          openDate();
        }
      }
      return;
    }
    if (a === 'exit-date') return askExit();
    if (a === 'confirm-exit') {
      const result = act(() => game.finishDate(true));
      if (result.ok) dateResult(result.value);
      return;
    }
    if (a === 'cancel-booking') {
      const b = game.booking(id);
      modal('Leave a little room.', `<p class="modal-sub">Cancel your date with <b>${esc(PERSON(b.person).name)}</b> on day ${b.day} at ${clock(b.start)}? The ${money(b.deposit)} deposit will be refunded. There is no reputation penalty.</p><div class="modal-actions"><button class="btn secondary" data-action="close">Keep the date</button><button class="btn danger" data-action="confirm-cancel" data-id="${id}">Cancel & refund</button></div>`, 'BOOKING CHANGE', 'cancel');
      return;
    }
    if (a === 'confirm-cancel') {
      const result = act(() => game.cancel(id));
      if (result.ok) {
        closeModal();
        toast('Booking cancelled. Deposit refunded.');
      }
      return;
    }
    if (a === 'activity-visit') {
      const venue = activityVenue(id);
      return goVenue(venue, { venue, activity: id });
    }
    if (a === 'do-activity') {
      const result = act(() => game.activity(id));
      if (result.ok) {
        closeModal();
        ui.status = ACTIVITIES[id].name;
        sound.play('arrive');
        toast('A little time well spent.');
      }
      return;
    }
    if (a === 'wait') {
      act(() => {
        game.advance(30);
        game.log('Took a little time to enjoy the neighborhood.');
      }, 'Half an hour, just for you.');
      return;
    }
    if (a === 'contact') return openContact(id);
    if (a === 'block-contact') {
      const c = game.contact(id);
      if (c.blocked) {
        act(() => game.setContact(id, { blocked: false }), 'Contact unblocked.');
        openContact(id);
      } else modal('Keep your circle comfortable.', `<p class="modal-sub">Block ${esc(PERSON(id).name)}? Their requests will stop. Any upcoming dates with them will be cancelled and deposits refunded.</p><div class="modal-actions"><button class="btn secondary" data-action="contact" data-id="${id}">Go back</button><button class="btn danger" data-action="confirm-block" data-id="${id}">Block & cancel bookings</button></div>`, 'CLIENT BOUNDARIES', 'block');
      return;
    }
    if (a === 'confirm-block') {
      act(() => game.setContact(id, { blocked: true }), 'Contact blocked. Your boundaries are yours.');
      closeModal();
      return;
    }
    if (a === 'upgrade') {
      act(() => game.upgrade(id), 'A little more confidence, a little more skill.');
      return;
    }
    if (a === 'model') {
      act(() => game.setModel(id), 'Business structure updated.');
      return;
    }
    if (a === 'regions') return openRegions();
    if (a === 'move-region') {
      const result = act(() => game.moveRegion(id));
      if (result.ok) {
        town.rebuild();
        closeModal();
        ui.status = 'A new chapter';
        render();
        toast('Welcome to ' + game.region().name + '.');
      }
      return;
    }
    if (a === 'permit') {
      act(() => game.permit(), 'Your fictional city permit is up to date.');
      return;
    }
    if (a === 'agency') {
      act(() => game.startAgency(), 'Your community studio is open. A new chapter begins.');
      return;
    }
    if (a === 'sleep') {
      if (state().activeDate) {
        toast('Finish the current date before turning in.', true);
        return;
      }
      return openSleep();
    }
    if (a === 'confirm-sleep') return sleep();
    if (a === 'export') return exportSave();
    if (a === 'import') return $('import-file').click();
    if (a === 'reset') {
      modal('Begin a different little life?', '<p class="modal-sub">This replaces your current browser save. Export a backup first to keep this chapter.</p><div class="modal-actions"><button class="btn secondary" data-action="export">Export current save</button><button class="btn danger" data-action="confirm-reset">Start fresh</button></div>', 'A NEW BEGINNING', 'reset');
      return;
    }
    if (a === 'confirm-reset') {
      setGame(new Game());
      closeModal();
      toast('A new beginning in Meadow Bay.');
      return;
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.disabled && !el.closest('.kit-menu, .kit-touch')) {
      e.preventDefault();
      try {
        routeAction(el);
      } catch (error) {
        if (error?.name !== 'RuleError') console.error(error);
        toast(error?.message || 'That action is unavailable.', true);
      }
    }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'booking-form') offerSubmit(form);
    if (form.id === 'contact-form') {
      const fd = new FormData(form);
      const r = act(() => game.setContact(form.dataset.person, { notes: String(fd.get('notes')), favorite: fd.get('favorite') === 'on' }));
      if (r.ok) {
        closeModal();
        toast('Little details saved.');
      }
    }
    if (form.id === 'profile-form') {
      const fd = new FormData(form);
      const values = Object.fromEntries(fd.entries());
      values.background = fd.get('background') || state().avatar.background;
      const r = act(() => {
        game.customize(values);
        state().settings.reducedMotion = fd.get('reducedMotion') === 'on';
        state().settings.sound = fd.get('sound') === 'on';
      });
      if (r.ok) {
        sound.enabled = state().settings.sound;
        const a = state().avatar;
        town.setCharacterColors(town.player, { outfit: a.outfit, skin: a.skin, hair: a.hair });
        closeModal();
        render();
        toast('A little more you.');
      }
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'base-rate') {
      state().baseRate = Number(e.target.value);
      setText($('rate-value'), money(state().baseRate));
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'base-rate') {
      save();
      toast('Base rate updated. Existing bookings keep their agreed price.');
    }
  });
  $('import-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 2e6) throw new Error('This save file is too large.');
      const candidate = new Game(JSON.parse(await f.text()));
      modal('Continue a saved chapter?', `<p class="modal-sub">Restore <b>${esc(candidate.s.avatar.name)}</b> on day <b>${candidate.s.day}</b>, with <b>${money(candidate.s.money)}</b>? This will replace the current browser save.</p><div class="modal-actions"><button class="btn secondary" data-action="close">Keep this session</button><button class="btn primary" id="confirm-import">Restore this save</button></div>`, 'PORTABLE SAVE', 'import');
      $('confirm-import').onclick = () => {
        // A date in progress in the current session must not block the restore.
        ui.modalType = null;
        setGame(candidate);
        $('modal-shade').hidden = true;
        if (state().activeDate) openDate();
        else closeModal();
        toast('Your saved chapter is restored.');
      };
    } catch (error) {
      toast('Save not imported: ' + error.message, true);
    } finally {
      e.target.value = '';
    }
  });
  // Tab stays inside an open dialog; Esc also closes it from a text field (the kit leaves those alone).
  document.addEventListener('keydown', (e) => {
    if ($('modal-shade').hidden) return;
    if (e.key === 'Escape' && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      e.preventDefault();
      back();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...$('modal').querySelectorAll('button:not(:disabled),a,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      if (focusables.length) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === $('modal'))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === $('modal'))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
  // Space on a clicked checkbox still toggles it (the kit would cancel that keyup, as Space is the clock key).
  addEventListener(
    'keyup',
    (e) => {
      const t = e.target;
      if (e.code !== 'Space' || !(t instanceof HTMLInputElement) || (t.type !== 'checkbox' && t.type !== 'radio')) return;
      e.stopImmediatePropagation();
      input.keys.delete(e.code);
    },
    true
  );
  addEventListener('beforeunload', () => save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  input.onSourceChange(() => {
    walkHint();
    if (ui.modalType === 'help') help();
  });

  /* ------------------------------------------------------------ start */

  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  buildChrome();
  town = new Town(kit, game, {
    venue: (id) => goVenue(id),
    arrive,
    moving: (intent) => {
      ui.status = intent ? 'On the way to ' + VENUES[intent.venue].short : 'A little wander';
    },
    notice: (message) => toast(message),
  });
  render();
  walkHint();
  $('renderer-note').textContent = `three.js r${kit.THREE.REVISION} · ${kit.backendLabel} · 3D town`;
  save();

  const clientColors = (personId) => {
    const p = PERSON(personId);
    return { outfit: p.outfit, skin: p.skin, hair: p.hair };
  };
  let press = null;
  let hoverAt = 0;
  const hoverPos = { x: -1, y: -1 };
  let flickReady = true;
  const townInput = { move: ZERO, blocked: false, client: clientColors };

  /** One frame: interface navigation, camera, walking, the clock, then the town. */
  function frame(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    const modalEl = $('modal');
    const modalOpen = !$('modal-shade').hidden;

    // Menus: the controller's D-pad, plus the stick and arrow keys inside dialogs.
    const nav = input.vector('nav');
    const mv = input.vector('move');
    const dir = modalOpen ? { x: nav.x + mv.x, y: nav.y + mv.y } : nav;
    padnav.update({ root: modalOpen ? modalEl : document.body, modal: modalOpen, dir, confirm: input.pressed('confirm') });

    if (input.pressed('back')) {
      if (modalOpen) back();
      else padnav.clear();
    }
    if (input.pressed('cancel')) {
      if (modalOpen) back();
      else if (town.walkingSomewhere) {
        town.cancelWalk();
        ui.status = 'Taking it all in';
      } else openPause();
    }
    if (input.pressed('pause')) {
      if (!modalOpen) openPause();
      else if (ui.modalType === 'pause') closeModal();
      else back();
    }
    let quick = -1;
    for (let i = 0; i < QUICK.length && quick < 0; i++) if (input.pressed(QUICK[i])) quick = i;
    if (!modalOpen) {
      if (input.pressed('clock')) toggleClock();
      if (input.pressed('interact')) town.interact();
      if (input.pressed('rotL')) town.rotate(-1);
      if (input.pressed('rotR')) town.rotate(1);
      if (input.pressed('zoomIn')) town.adjustZoom(1);
      if (input.pressed('zoomOut')) town.adjustZoom(-1);
      if (input.pressed('recenter')) town.resetCamera();
      if (input.pressed('home')) goVenue('home');
      if (input.pressed('tabPrev')) setTab(TABS[(TABS.indexOf(ui.tab) + TABS.length - 1) % TABS.length]);
      if (input.pressed('tabNext')) setTab(TABS[(TABS.indexOf(ui.tab) + 1) % TABS.length]);
      if (quick >= 0) setTab(TABS[quick]);
    } else if (quick >= 0) {
      // Number keys answer a date or pick an activity in the open dialog.
      const choice = modalEl.querySelectorAll('.date-choice, [data-action="do-activity"], .choice-card[data-action="sleep"]')[quick];
      if (choice && !choice.disabled) choice.click();
    }

    // Right stick: scroll the panel the controller is in; otherwise zoom, and flick to turn.
    const cam = input.look('cam');
    const per = STICK_LOOK * Math.max(dt, 1e-3) * (kit.settings.get().lookSensitivity || 1);
    const rx = cam.x / per;
    if (Math.abs(rx) < 0.15) flickReady = true;
    if (cam.y) {
      const scroller = padnav.scroller(modalEl, modalOpen);
      if (scroller) scroller.scrollTop += (cam.y / STICK_LOOK) * 900;
      else if (!modalOpen) town.zoomBy((-cam.y / STICK_LOOK) * 8);
    }
    if (!modalOpen && flickReady && Math.abs(rx) > 0.5) {
      flickReady = false;
      town.rotate(Math.sign(rx));
    }
    const zoom = input.zoom();
    if (zoom && !modalOpen) town.zoomBy(zoom);

    // Mouse and touch on the town: a click or tap walks or visits; drags and pinches do not.
    const p = input.pointer;
    if (p.justDown) press = { x: p.x, y: p.y, moved: false, gesture: false, aux: input.mouseButtons.has(1) || input.mouseButtons.has(2) };
    if (press && (p.down || p.justUp)) {
      if (Math.hypot(p.x - press.x, p.y - press.y) > 8) press.moved = true;
      if (zoom) press.gesture = true;
    }
    if (p.justUp && press) {
      if (!press.moved && !press.gesture && !press.aux && !modalOpen) {
        town.click(p.x, p.y);
        kit.canvas.focus({ preventScroll: true });
      }
      press = null;
    }
    if (p.type === 'mouse' && p.over && !p.down && !modalOpen) {
      const now = performance.now();
      if (now - hoverAt > 90 && (p.x !== hoverPos.x || p.y !== hoverPos.y)) {
        hoverAt = now;
        hoverPos.x = p.x;
        hoverPos.y = p.y;
        setHover(town.pick(p.x, p.y).venue);
      }
    } else if (ui.hover && !p.over) setHover(null);

    townInput.move = modalOpen ? ZERO : mv;
    townInput.blocked = modalOpen;
    town.update(dt, townInput);
    tick(dt);
    if (town.labelsDirty) {
      town.labelsDirty = false;
      positionLabels();
    }
    town.render();
    if (ui.pendingEnding && $('modal-shade').hidden) {
      ui.pendingEnding = false;
      openEnding();
    }
  }

  window.GCApp = {
    get game() {
      return game;
    },
    town,
    ui,
    render,
    act,
    openNegotiation,
    beginDate,
    openDate,
    help,
    setGame,
  };

  return {
    town,
    frame,
    /** After the first frame is up: welcome new players, resume a date in progress. */
    ready() {
      if (loadWarning) toast(loadWarning, true);
      if (state().activeDate) openDate();
      else if (firstRun) help();
    },
  };
}
