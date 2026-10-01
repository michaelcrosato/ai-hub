/**
 * Block Court — startup, game flow, menus, HUD and input.
 *
 * The simulation (sim.js) is deterministic and knows nothing about the page;
 * the arena (scene.js) draws it; this module turns kit.input actions into
 * simulation calls and keeps the DOM HUD and menus in step.
 */

import { boot } from 'kit/boot.js';
import { Engine, RACKS, DERBY_TIME, clamp, dist, hoop } from './sim.js';
import { createCourtView, COLOR } from './scene.js';
import { ArcadeAudio } from './audio.js';
import { CREWS, DIFFICULTY_LABEL, KEYS, load, save, loadLeague } from './league.js';

const $ = (id) => document.getElementById(id);
const MODES = ['arcade', 'league', 'practice', 'contest'];
const DIFFS = ['rookie', 'pro', 'allstar'];
const MODE_COPY = {
  arcade: 'Three minutes. First to 21. Beat the house crew.',
  league: 'Five rival crews, one ladder. Win to climb. Your progress is saved.',
  practice: 'No defense, no clock. A feeder sends back every make.',
  contest: 'Five racks around the arc against the clock. Gold money balls count two.',
};

const kit = await boot({
  title: 'Block Court',
  canvas: $('court'),
  gear: 'none',
  accent: '#41ebcb',
  background: '#0b1318',
  touch: { top: 'right', topOffset: 64 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    shoot: { keys: ['Space'], gamepad: ['A'], touch: 'Shoot' },
    pass: { keys: ['KeyE'], gamepad: ['X'], touch: 'Pass' },
    defend: { keys: ['KeyF', 'KeyK'], gamepad: ['B'], touch: 'Steal' },
    switch: { keys: ['KeyQ'], gamepad: ['Y', 'LB'], touch: 'Switch' },
    turbo: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RT', 'RB'], touch: 'Turbo' },
    reset: { keys: ['KeyR'], gamepad: ['Back'], touch: { label: 'Reset', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    confirm: { keys: ['Enter', 'NumpadEnter'] },
    mute: { keys: ['KeyM'] },
    fullscreen: { keys: ['KeyV'] },
  },
});
const input = kit.input;

// ---- remembered choices
const settings = load(KEYS.settings, { shake: !matchMedia('(prefers-reduced-motion: reduce)').matches, music: true, sound: true });
const saveSettings = () => save(KEYS.settings, { shake: !!settings.shake, music: !!settings.music, sound: !!settings.sound });
const prefs = load(KEYS.menu, { mode: 'arcade', difficulty: 'rookie' });
let mode = MODES.includes(prefs.mode) ? prefs.mode : 'arcade';
let difficulty = DIFFS.includes(prefs.difficulty) ? prefs.difficulty : 'rookie';
let league = loadLeague();
let crew = CREWS[0];

// ---- simulation, arena, audio
kit.loading.progress(0.65, 'Building the court…');
const sim = new Engine(0xb10c21);
sim.difficulty = 'pro';
const view = createCourtView(kit, sim, { shake: () => settings.shake });
const audio = new ArcadeAudio(settings);
// Browsers keep audio locked until a key, click or tap (a gamepad button does not count).
for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, () => audio.start(), true);
kit.onPause((paused) => {
  audio.hold(paused);
  // The kit's settings panel opened mid-play: hold the match on our own pause screen too.
  if (paused && !menu && sim.state === 'playing') togglePause();
});

// ---- flow state
let menu = true;
let countdown = 0;
let countdownLast = -1;
let goTime = 0;
let accumulator = 0;
let announceTime = 0;
let slowTime = 0;
let nextDribble = 0;
let lastHud = -1;
let lastMinimap = 0;
let total = 0;
let shootBuffered = false;
let contestBest = 0;
let resultsAt = -10;
const floats = [];
const screenPos = { x: 0, y: 0, visible: false };

// ---- small DOM helpers: write only when something changed
function setText(el, value) {
  const v = String(value);
  if (el._text !== v) {
    el._text = v;
    el.textContent = v;
  }
}
function setHTML(el, value) {
  if (el._html !== value) {
    el._html = value;
    el.innerHTML = value;
  }
}
function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}
function place(el, x, y, anchor) {
  el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${anchor}`;
}

const el = {
  hint: $('hint'),
  scoreHome: $('score-home'),
  scoreAway: $('score-away'),
  clock: $('clock'),
  clockCaption: $('clock-caption'),
  shotClock: $('shot-clock'),
  shotBox: $('shot-clock-box'),
  rackBox: $('rack-box'),
  rackName: $('rack-name'),
  rackDots: [...$('rack-dots').children],
  possHome: $('poss-home'),
  possAway: $('poss-away'),
  awayName: $('away-name'),
  awayTag: $('away-tag'),
  playerName: $('player-name'),
  playerNumber: $('player-number'),
  playerSub: $('player-sub'),
  staminaTitle: $('stamina-title'),
  staminaBar: $('stamina-bar'),
  turboLabel: $('turbo-label'),
  heatCells: [...document.querySelectorAll('.heat-cell')],
  heatLabel: $('heat-label'),
  attackTag: $('attack-tag'),
  minimap: $('minimap').getContext('2d'),
  labelYou: $('label-you'),
  labelMates: [$('label-mate-1'), $('label-mate-2')],
  charge: $('charge-meter'),
  chargeTitle: $('charge-title'),
  chargePointer: $('charge-pointer'),
  countdown: $('countdown'),
  padNote: $('pad-note'),
  controls: $('controls-strip'),
  guide: $('control-guide'),
  pause: $('pause-overlay'),
  result: $('result-overlay'),
  hero: $('hero'),
  headerRight: $('header-right'),
};

// ---- prompts for whichever device was used last
const PROMPTS = {
  keyboard: { move: 'WASD', shoot: 'SPACE', pass: 'E', defend: 'F', switch: 'Q', turbo: 'SHIFT', reset: 'R', pause: 'ESC' },
  gamepad: { move: 'L', shoot: 'A', pass: 'X', defend: 'B', switch: 'Y', turbo: 'RT', reset: 'BACK', pause: 'START' },
  touch: { move: 'STICK', shoot: 'SHOOT', pass: 'PASS', defend: 'STEAL', switch: 'SWITCH', turbo: 'TURBO', reset: 'RESET', pause: 'II' },
};
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;
const kbd = (key) => `<kbd${input.source === 'gamepad' && key.length === 1 ? ' class="pad"' : ''}>${key}</kbd>`;
let guideKey = '';
function refreshGuides() {
  const k = `${input.source}|${mode}|${menu}`;
  if (k === guideKey) return;
  guideKey = k;
  const P = prompts();
  const items = mode === 'contest'
    ? [[P.shoot, 'Hold, then shoot', true]]
    : [
        [P.move, 'Move', false],
        [P.shoot, 'Shoot', true],
        [P.pass, 'Pass', false],
        [P.defend, 'Steal / block', false],
        [P.switch, 'Switch', false],
        [P.turbo, 'Turbo', false],
      ];
  if (mode === 'practice') items.push([P.reset, 'Reset', false]);
  el.controls.innerHTML = items
    .map(([key, label, primary], i) => `${i === 1 && items.length > 3 ? '<div class="divider"></div>' : ''}<div class="control-item${primary ? ' primary-control' : ''}">${kbd(key)}<strong>${label}</strong></div>`)
    .join('');
  const guide = [
    [P.move, 'Move'],
    [P.shoot, 'Hold, then shoot'],
    [P.pass, 'Pass / call for a pass'],
    [P.defend, 'Steal / block / jump'],
    [P.switch, 'Switch player'],
    [P.turbo, 'Hold for turbo'],
    [P.pause, 'Pause'],
    [P.reset, 'Reset (shootaround)'],
  ];
  el.guide.innerHTML = guide.map(([key, label]) => `<div class="guide-item">${kbd(key)}${label}</div>`).join('');
  lastHud = -1;
}
input.onSourceChange(() => refreshGuides());

// ---- announcements and floating scores
function announce(title, sub = '', color = '#41ebcb', duration = 1.5) {
  if (menu) return;
  setText($('announce-title'), title);
  $('announce-title').style.color = color;
  setText($('announce-sub'), sub);
  $('announce-sub').hidden = !sub;
  $('announce').classList.add('show');
  announceTime = duration;
}
function floatScore(text, x, y, z, color) {
  const f = document.createElement('div');
  f.className = 'float-score';
  f.textContent = text;
  f.style.color = color;
  $('float-layer').append(f);
  floats.push({ el: f, x, y, z, life: 1.1 });
}
function formatTime(t) {
  if (sim.suddenDeath) return 'OT';
  t = Math.max(0, Math.ceil(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
const teamCss = (team) => (team === 0 ? '#41ebcb' : crew.css);
const teamName = (team) => (team === 0 ? 'TURBO' : crew.name);

// ---- world labels, charge meter and floats follow the players on screen
function updateLabels(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    f.y += dt * 0.9;
    view.project(f.x, f.y, f.z, screenPos);
    place(f.el, screenPos.x, screenPos.y, 'translate(-50%,-50%)');
    f.el.style.opacity = clamp(f.life * 2, 0, 1);
    if (f.life <= 0) {
      f.el.remove();
      floats.splice(i, 1);
    }
  }
  if (menu) return;
  const p = sim.players[sim.controlled];
  if (!p) return;
  view.project(p.x, 2.9 + p.jump, p.z, screenPos);
  place(el.labelYou, screenPos.x, screenPos.y, 'translate(-50%,-50%)');
  setHidden(el.labelYou, !screenPos.visible || sim.charging);
  let n = 0;
  for (const q of sim.players) {
    if (q.team !== 0 || q.id === p.id || !q.active || n > 1) continue;
    const label = el.labelMates[n++];
    setText(label, `${q.name} · ${q.number}`);
    view.project(q.x, 2.8 + q.jump, q.z, screenPos);
    place(label, screenPos.x, screenPos.y, 'translate(-50%,-50%)');
    setHidden(label, sim.charging || !screenPos.visible);
  }
  for (; n < 2; n++) setHidden(el.labelMates[n], true);
  setHidden(el.charge, !sim.charging);
  if (sim.charging) {
    view.project(p.x, 3.25 + p.jump, p.z, screenPos);
    place(el.charge, screenPos.x, screenPos.y, 'translate(-50%,-100%)');
    el.chargePointer.style.left = `${sim.charge * 100}%`;
    const green = Math.abs(sim.charge - 0.765) <= 0.085;
    el.charge.classList.toggle('green', green);
    setText(el.chargeTitle, green ? 'RELEASE!' : 'RELEASE IN GREEN');
  }
}

// ---- HUD
function boardState() {
  if (sim.mode === 'contest') return { home: 'TURBO', away: 'BEST', s0: sim.scores[0], s1: contestBest, clock: formatTime(sim.time), caption: '3 - P O I N T   C O N T E S T' };
  if (sim.mode === 'practice') return { home: 'TURBO', away: crew.name, s0: sim.scores[0], s1: sim.scores[1], clock: 'FREE', caption: 'S H O O T A R O U N D' };
  return { home: 'TURBO', away: crew.name, s0: sim.scores[0], s1: sim.scores[1], clock: formatTime(sim.time), caption: sim.suddenDeath ? 'NEXT BASKET WINS' : '3 V 3   /   FIRST TO 21' };
}
function hintText(p) {
  const P = prompts();
  if (sim.mode === 'contest') {
    if (sim.ball.mode === 'rack') return 'On to the next rack…';
    return sim.derby && sim.derby.shot === 4 ? `<b>MONEY BALL.</b> Hold <b>${P.shoot}</b>, release in the green. Worth 2.` : `Hold <b>${P.shoot}</b>. Release in the green zone.`;
  }
  if (sim.mode === 'practice') return `Hold <b>${P.shoot}</b> to shoot. Press <b>${P.reset}</b> to reset.`;
  if (sim.ball.mode === 'loose') return 'Chase the ball. <b>Grab the rebound.</b>';
  if (sim.possession !== 0) return `Get close. Press <b>${P.defend}</b> to steal or block.`;
  if (p && dist(p, hoop(0)) < 2.25 && sim.ball.owner === p.id) return `You are in range. Press <b>${P.shoot}</b> to dunk.`;
  if (sim.fire[0] > 0) return '<b>ON FIRE.</b> You have stronger shots and unlimited turbo.';
  return `Hold <b>${P.shoot}</b>. Release in the green zone.`;
}
function updateHUD() {
  view.setBoard(boardState());
  if (menu) return;
  refreshGuides();
  const contest = sim.mode === 'contest';
  const practice = sim.mode === 'practice';
  setText(el.scoreHome, sim.scores[0]);
  setText(el.scoreAway, contest ? contestBest : sim.scores[1]);
  setText(el.clock, practice ? 'FREE' : formatTime(sim.time));
  el.clock.classList.toggle('low', !practice && sim.time < (contest ? 10 : 30) && !sim.suddenDeath);
  setText(el.clockCaption, practice ? 'SHOOTAROUND' : contest ? '3PT CONTEST' : sim.suddenDeath ? 'NEXT BASKET WINS' : 'FIRST TO 21');
  setText(el.awayName, contest ? 'BEST' : crew.name);
  setText(el.awayTag, contest ? DIFFICULTY_LABEL[sim.difficulty] : sim.mode === 'league' ? crew.tag : 'CPU');
  setHidden(el.shotBox, practice || contest);
  setHidden(el.rackBox, !contest);
  if (!practice && !contest) {
    setText(el.shotClock, Math.ceil(sim.shotClock));
    el.shotBox.classList.toggle('low', sim.shotClock < 6);
  }
  el.possHome.classList.toggle('on', sim.possession === 0 && !contest);
  el.possAway.classList.toggle('on', sim.possession === 1 && !contest);
  const p = sim.players[sim.controlled];
  if (contest && sim.derby) {
    const d = sim.derby;
    const r = Math.min(4, d.rack);
    setText(el.rackName, `RACK ${r + 1} · ${RACKS[r].name}`);
    const shots = d.racks[r] || [];
    el.rackDots.forEach((dot, i) => {
      dot.classList.toggle('made', shots[i] > 0);
      dot.classList.toggle('miss', shots[i] === 0);
      dot.classList.toggle('now', d.rack < 5 && i === d.shot);
    });
  }
  if (p) {
    setText(el.playerName, p.name);
    setText(el.playerNumber, p.number);
    if (contest) {
      setText(el.playerSub, '3PT CONTEST / SHOOTER');
      setText(el.staminaTitle, 'CLOCK');
      setText(el.turboLabel, `${Math.ceil(sim.time)}s`);
      el.staminaBar.style.transform = `scaleX(${clamp(sim.time / (DERBY_TIME[sim.difficulty] || 60), 0, 1).toFixed(3)})`;
      el.heatCells.forEach((c) => c.classList.remove('on'));
      setText(el.heatLabel, `RACK ${Math.min(5, (sim.derby?.rack ?? 0) + 1)} / 5`);
    } else {
      setText(el.playerSub, sim.ball.owner === p.id ? 'TURBO / BALL HANDLER' : sim.possession === 0 ? 'TURBO / GET OPEN' : 'TURBO / ON DEFENSE');
      setText(el.staminaTitle, 'TURBO');
      el.staminaBar.style.transform = `scaleX(${(sim.fire[0] > 0 ? 1 : p.stamina).toFixed(3)})`;
      setText(el.turboLabel, sim.fire[0] > 0 ? 'UNLIMITED' : `HOLD ${prompts().turbo}`);
      el.heatCells.forEach((c, i) => c.classList.toggle('on', sim.fire[0] > 0 || i < sim.hot[0]));
      setText(el.heatLabel, sim.fire[0] > 0 ? `ON FIRE / ${Math.ceil(sim.fire[0])}s` : 'BUILD YOUR STREAK');
    }
  }
  setText(el.attackTag, contest ? 'SHOOT →' : sim.possession === 0 ? 'ATTACK →' : '← DEFEND YOUR HOOP');
  el.attackTag.style.color = sim.possession === 0 || contest ? '#41ebcb' : crew.css;
  setHidden(el.padNote, !input.pad || input.source !== 'gamepad');
  if (total - lastMinimap > 0.1) {
    lastMinimap = total;
    drawMinimap();
  }
  setHTML(el.hint, hintText(p));
}
function drawMinimap() {
  const c = el.minimap;
  const w = 296;
  const h = 156;
  const X = (x) => w / 2 + (x / 30) * w;
  const Z = (z) => h / 2 + (z / 16) * h;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#102831';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#4a7277';
  c.lineWidth = 1.6;
  c.strokeRect(X(-14), Z(-7.5), (28 / 30) * w, (15 / 16) * h);
  c.beginPath();
  c.moveTo(w / 2, Z(-7.5));
  c.lineTo(w / 2, Z(7.5));
  c.stroke();
  c.beginPath();
  c.arc(w / 2, h / 2, 17, 0, Math.PI * 2);
  c.stroke();
  for (const s of [-1, 1]) {
    c.strokeRect(X(s < 0 ? -14 : 8.4), Z(-2.35), (5.6 / 30) * w, (4.7 / 16) * h);
    c.fillStyle = '#b7d2c7';
    c.fillRect(X(s * 12.35) - 2, h / 2 - 3, 4, 6);
  }
  for (const p of sim.players)
    if (p.active) {
      c.fillStyle = p.team === 0 ? '#41ebcb' : crew.css;
      c.beginPath();
      c.arc(X(p.x), Z(p.z), p.id === sim.controlled ? 5 : 3.7, 0, Math.PI * 2);
      c.fill();
      if (p.id === sim.controlled) {
        c.strokeStyle = '#e4f7eb';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(X(p.x), Z(p.z), 7, 0, Math.PI * 2);
        c.stroke();
      }
    }
  c.fillStyle = '#ffd185';
  c.beginPath();
  c.arc(X(sim.ball.x), Z(sim.ball.z), 2.6, 0, Math.PI * 2);
  c.fill();
}

// ---- simulation events → sound, effects, announcements, rumble
sim.on((e) => {
  const teamHex = view.teamHex(e.team);
  const css = teamCss(e.team);
  switch (e.type) {
    case 'shot':
      if (menu) break;
      audio.noise(0.13, 0.07, 1800);
      if (e.player === sim.controlled && !e.dunk && sim.mode !== 'contest')
        announce(e.perfect ? 'PERFECT RELEASE' : e.charge < 0.68 ? 'EARLY RELEASE' : 'LATE RELEASE', e.contest > 0.55 ? 'CONTESTED SHOT' : e.points === 3 ? 'FROM DOWNTOWN' : 'TAKE THE SHOT', e.perfect ? '#41ebcb' : '#ffcf79', 0.8);
      if (e.player === sim.controlled && e.perfect) input.rumble(0.25, 60);
      if (e.dunk) {
        announce('TO THE RIM!', `${teamName(e.team)} TAKES FLIGHT`, css, 0.7);
        slowTime = settings.shake ? 0.18 : 0;
      }
      break;
    case 'score': {
      const hx = hoop(e.team).x;
      view.burst(hx, 3.5, 0, teamHex, e.dunk ? 65 : 38, e.dunk ? 1.2 : 0.8);
      view.wave(hx, 0, teamHex);
      view.bounceHoop(e.team, 1);
      view.cheer(1);
      view.shake(e.dunk ? 0.35 : 0.15, e.dunk ? 0.16 : 0.055);
      if (menu) break;
      audio.swish(e.dunk);
      audio.crowd(e.dunk || e.points === 3 ? 1 : 0.6);
      floatScore(`+${e.points}`, hx, 4.4, 0, css);
      const freshFire = sim.fire[e.team] > 14.5;
      announce(
        freshFire ? 'ON FIRE!' : e.dunk ? 'BOOMSHAKALAKA!' : e.points === 3 ? 'FROM DOWNTOWN!' : e.perfect ? 'NOTHING BUT NET.' : 'BUCKET!',
        freshFire ? `${teamName(e.team)} / 15 SECONDS OF HEAT` : `${teamName(e.team)}  +${e.points}`,
        freshFire ? '#ffd17a' : css,
        freshFire ? 2 : 1.2
      );
      if (e.team === 0) input.rumble(e.dunk ? 0.8 : 0.35, e.dunk ? 260 : 110);
      break;
    }
    case 'miss':
      if (!menu) audio.rim();
      view.bounceHoop(e.team, 0.2);
      break;
    case 'pass':
    case 'feed':
      if (!menu) audio.noise(0.1, 0.06, 1500);
      break;
    case 'catch':
      if (!menu) audio.dribble(0.5);
      break;
    case 'bounce':
      if (!menu) audio.dribble(e.volume * 0.5);
      break;
    case 'steal':
      view.burst(sim.ball.x, 1.1, sim.ball.z, teamHex, 15, 0.55);
      if (menu) break;
      announce('STOLEN!', e.team === 0 ? 'PUSH THE BREAK' : 'GET BACK ON DEFENSE', css, 1.0);
      audio.tone(420, 0.1, 0.14, 'square', 190);
      input.rumble(e.team === 0 ? 0.3 : 0.55, 120);
      break;
    case 'block':
      view.burst(sim.ball.x, sim.ball.y, sim.ball.z, teamHex, 27, 0.9);
      if (menu) break;
      announce('NOT IN HERE!', 'SHOT BLOCKED', css, 1.0);
      audio.noise(0.18, 0.23, 800);
      input.rumble(0.5, 140);
      break;
    case 'fire':
      if (menu) break;
      announce('ON FIRE!', `${teamName(e.team)} / 15 SECONDS OF HEAT`, '#ffd17a', 2.1);
      audio.tone(330, 0.16, 0.1, 'sawtooth');
      audio.tone(440, 0.16, 0.1, 'sawtooth', null, 0.16);
      audio.tone(660, 0.3, 0.1, 'sawtooth', null, 0.32);
      break;
    case 'violation':
      if (menu) break;
      announce('SHOT CLOCK!', `${teamName(e.team)} BALL`, '#ffbf7f', 1.6);
      audio.tone(150, 0.32, 0.2, 'sawtooth', 130);
      break;
    case 'overtime':
      if (menu) break;
      announce('SUDDEN DEATH', 'THE NEXT BASKET WINS', '#ffce80', 2.4);
      audio.tone(220, 0.5, 0.15, 'sawtooth');
      break;
    case 'derbyShot': {
      const hx = hoop(0).x;
      view.bounceHoop(0, e.made ? 1 : 0.2);
      if (!e.made) {
        audio.rim();
        break;
      }
      const color = e.money ? COLOR.gold : COLOR.teal;
      view.burst(hx, 3.5, 0, color, e.money ? 40 : 18, e.money ? 0.9 : 0.6);
      view.wave(hx, 0, color);
      view.cheer(e.money ? 1 : 0.45);
      audio.swish(false);
      if (e.money) audio.crowd(0.8);
      floatScore(`+${e.points}`, hx, 4.4, 0, e.money ? '#ffd17a' : '#41ebcb');
      input.rumble(e.money ? 0.45 : 0.2, e.money ? 140 : 60);
      break;
    }
    case 'rackBall':
      if (e.money && !menu) {
        audio.money();
        announce('MONEY BALL', 'WORTH TWO POINTS', '#ffd17a', 0.9);
      }
      break;
    case 'rackDone':
      if (!menu) announce(`RACK ${e.rack + 1}: ${e.points} PTS`, `NEXT: ${RACKS[e.rack + 1].name}`, '#41ebcb', 1.1);
      break;
    case 'end':
      if (!menu) showResults(e);
      break;
  }
});

// ---- menus
function previewCrew() {
  crew = mode === 'league' ? CREWS[league.rung] : CREWS[0];
  view.setCrew(crew);
  document.documentElement.style.setProperty('--away', crew.css);
}
function refreshMenu() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    const on = b.dataset.mode === mode;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  }
  for (const b of document.querySelectorAll('[data-diff]')) {
    const on = b.dataset.diff === difficulty;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  }
  setText($('mode-copy'), MODE_COPY[mode]);
  $('difficulty-row').hidden = mode === 'league';
  $('difficulty-row').style.visibility = mode === 'practice' ? 'hidden' : 'visible';
  $('league-card').hidden = mode !== 'league';
  if (mode === 'league') {
    const c = CREWS[league.rung];
    setText($('league-step'), `GAME ${league.rung + 1} OF ${CREWS.length}${league.titles ? ` · TITLES ${league.titles}` : ''}`);
    setText($('league-crew'), c.name);
    setText($('league-tag'), `${c.tag} · ${DIFFICULTY_LABEL[c.difficulty]}`);
    $('ladder').innerHTML = CREWS.map((_, i) => `<i class="${i < league.rung ? 'done' : i === league.rung ? 'now' : ''}"></i>`).join('');
    $('league-reset').hidden = league.rung === 0;
  }
  const record = load(KEYS.record, { wins: 0, games: 0, best: 0 });
  const bests = load(KEYS.contest, { rookie: 0, pro: 0, allstar: 0 });
  let note = '1 PLAYER <span class="sep">/</span> KEYBOARD · TOUCH · GAMEPAD';
  if (mode === 'arcade' && record.games) note = `RECORD ${record.wins}–${record.games - record.wins} <span class="sep">/</span> BEST ${record.best} POINTS`;
  if (mode === 'league') note = `NEXT UP: ${CREWS[league.rung].name} <span class="sep">/</span> ${league.wins || 0} LEAGUE WINS`;
  if (mode === 'contest') note = `BEST (${DIFFICULTY_LABEL[difficulty]}) ${bests[difficulty] || 0} OF 30 <span class="sep">/</span> ${DERBY_TIME[difficulty]} SECONDS`;
  setHTML($('start-note'), note);
  setText($('start-label'), mode === 'league' ? `PLAY · GAME ${league.rung + 1} VS ${CREWS[league.rung].name}` : mode === 'contest' ? 'PLAY · TAKE THE RACKS' : mode === 'practice' ? 'PLAY · WARM UP' : 'PLAY · HIT THE COURT');
  if (menu) previewCrew();
}
function selectMode(next) {
  if (!MODES.includes(next)) return;
  mode = next;
  save(KEYS.menu, { mode, difficulty });
  refreshMenu();
  guideKey = '';
}
function selectDifficulty(next) {
  if (!DIFFS.includes(next)) return;
  difficulty = next;
  save(KEYS.menu, { mode, difficulty });
  refreshMenu();
}

/** Show the kit's touch controls only while a match is actually on screen. */
function syncTouch() {
  const hide = menu || !el.pause.hidden || !el.result.hidden;
  kit.touch?.suspend(hide, 'game');
  if (!kit.touch) return;
  kit.touch.setShown('reset', mode === 'practice');
  for (const a of ['pass', 'defend', 'switch', 'turbo']) kit.touch.setShown(a, mode !== 'contest');
}

function resetInput() {
  sim.setInput(0, 0, false);
  sim.cancelCharge();
  shootBuffered = false;
  input.settle();
}

function startGame() {
  audio.start();
  crew = mode === 'league' ? CREWS[league.rung] : CREWS[0];
  view.setCrew(crew);
  document.documentElement.style.setProperty('--away', crew.css);
  const diff = mode === 'league' ? crew.difficulty : difficulty;
  contestBest = load(KEYS.contest, { rookie: 0, pro: 0, allstar: 0 })[diff] || 0;
  menu = false;
  document.body.classList.add('playing');
  $('menu').hidden = true;
  $('play-hud').hidden = false;
  $('labels').hidden = false;
  el.pause.hidden = true;
  el.result.hidden = true;
  $('announce').classList.remove('show');
  el.charge.hidden = true;
  for (const f of floats) f.el.remove();
  floats.length = 0;
  sim.start({ mode, difficulty: diff, style: mode === 'league' ? crew.style : 'balanced' });
  view.setMode(mode);
  view.setMenu(false);
  countdown = mode === 'practice' ? 0 : 2.8;
  countdownLast = -1;
  goTime = 0;
  el.countdown.hidden = true;
  accumulator = 0;
  slowTime = 0;
  resetInput();
  guideKey = '';
  lastHud = -1;
  syncTouch();
  kit.canvas.focus({ preventScroll: true });
  if (mode === 'practice') announce('SHOOTAROUND', 'NO DEFENSE. NO CLOCK. FIND YOUR SHOT.', '#41ebcb', 2.0);
}

function returnToMenu() {
  resetInput();
  menu = true;
  sim.start({ demo: true, difficulty: 'pro' });
  view.setMode('arcade');
  view.setMenu(true);
  document.body.classList.remove('playing');
  $('menu').hidden = false;
  $('play-hud').hidden = true;
  $('labels').hidden = true;
  el.pause.hidden = true;
  el.result.hidden = true;
  el.charge.hidden = true;
  el.countdown.hidden = true;
  $('announce').classList.remove('show');
  countdown = 0;
  refreshMenu();
  syncTouch();
  focusButton($('start-btn'));
}

function showPause(open) {
  refreshGuides();
  el.pause.hidden = !open;
  setText($('resume-label'), menu ? 'BACK TO THE COURT' : 'BACK TO THE GAME');
  $('restart-btn').hidden = menu;
  $('quit-btn').hidden = menu;
  setText($('pause-title'), menu ? 'HOW TO PLAY.' : 'TIME OUT.');
  syncTouch();
  if (open) focusButton($('resume-btn'));
}
function togglePause() {
  if (menu) {
    const open = el.pause.hidden;
    if (open) sim.pause();
    else sim.resume();
    showPause(open);
    if (!open) focusButton($('start-btn'));
    return;
  }
  if (sim.state === 'over') return;
  if (sim.state === 'playing') {
    sim.pause();
    resetInput();
    showPause(true);
  } else {
    sim.resume();
    showPause(false);
    resetInput();
    kit.canvas.focus({ preventScroll: true });
  }
}

function statsRow(a, label, c, cls = '') {
  const row = document.createElement('div');
  row.className = 'stats-row';
  const x = document.createElement('b');
  const y = document.createElement('span');
  const z = document.createElement('b');
  x.textContent = a;
  y.textContent = label;
  z.textContent = c;
  if (cls) z.className = cls;
  row.append(x, y, z);
  return row;
}

function showResults(e) {
  resultsAt = total;
  el.result.hidden = false;
  $('labels').hidden = true;
  el.charge.hidden = true;
  syncTouch();
  audio.buzzer();
  const stats = $('result-stats');
  stats.replaceChildren();
  if (e.mode === 'contest') {
    const diff = sim.difficulty;
    const bests = load(KEYS.contest, { rookie: 0, pro: 0, allstar: 0 });
    const prev = bests[diff] || 0;
    const score = e.scores[0];
    const record = score > prev;
    if (record) {
      bests[diff] = score;
      save(KEYS.contest, bests);
    }
    setText($('result-eyebrow'), `3-POINT CONTEST · ${DIFFICULTY_LABEL[diff]}`);
    setText($('result-title'), record ? 'NEW RECORD.' : score >= 20 ? 'MONEY.' : 'NICE SHOOTING.');
    $('result-title').style.color = record || score >= 20 ? '#41ebcb' : '#ffd17a';
    setText($('final-home'), score);
    setText($('final-away'), Math.max(prev, score));
    setText($('result-home-label'), 'YOUR SCORE');
    setText($('result-away-label'), 'BEST');
    const racks = e.derby?.racks || [];
    RACKS.forEach((r, i) => {
      const shots = racks[i] || [];
      const pts = shots.reduce((a, v) => a + v, 0);
      const dots = [0, 1, 2, 3, 4].map((k) => (k >= shots.length ? '·' : shots[k] > 0 ? (k === 4 ? '◆' : '●') : '○')).join(' ');
      stats.append(statsRow(`${pts} / 6`, r.name, dots, 'dots'));
    });
    const made = e.stats[0].made;
    stats.append(statsRow(`${made} / 25`, 'BALLS MADE', `${e.stats[0].money} / 5 MONEY`));
    setText($('record-line'), `BEST ${DIFFICULTY_LABEL[diff]} / ${Math.max(prev, score)} OF 30`);
    setText($('again-label'), 'RUN IT BACK');
    if (record || score >= 20) {
      for (let i = 0; i < 3; i++) view.burst((i - 1) * 5, 6, -2, COLOR.gold, 35, 1.3);
      view.cheer(1);
    }
    input.rumble(0.4, 200);
    focusButton($('again-btn'));
    return;
  }
  const win = e.winner === 0;
  let eyebrow = win ? 'THE COURT IS YOURS' : 'FINAL WHISTLE';
  let title = win ? 'YOU WIN.' : 'RUN IT BACK.';
  let again = 'RUN IT BACK';
  let recordLine = '';
  if (e.mode === 'league') {
    league.games = (league.games || 0) + 1;
    let champion = false;
    if (win) {
      league.wins = (league.wins || 0) + 1;
      league.rung += 1;
      if (league.rung >= CREWS.length) {
        champion = true;
        league.titles = (league.titles || 0) + 1;
        league.rung = 0;
      }
    }
    save(KEYS.league, league);
    if (champion) {
      eyebrow = 'NIGHT LEAGUE CHAMPIONS';
      title = 'CHAMPIONS.';
      again = 'PLAY A NEW SEASON';
      recordLine = `NIGHT LEAGUE TITLES / ${league.titles}`;
    } else if (win) {
      eyebrow = `${crew.name} DOWN · ${league.rung} OF ${CREWS.length}`;
      again = `PLAY NEXT: ${CREWS[league.rung].name}`;
      recordLine = `NEXT UP / ${CREWS[league.rung].name} · ${CREWS[league.rung].tag}`;
    } else {
      eyebrow = `${crew.name} HOLD THE LINE`;
      recordLine = `NIGHT LEAGUE / GAME ${league.rung + 1} OF ${CREWS.length}`;
    }
  } else {
    const record = load(KEYS.record, { wins: 0, games: 0, best: 0 });
    record.games += 1;
    if (win) record.wins += 1;
    record.best = Math.max(record.best, e.scores[0]);
    save(KEYS.record, record);
    recordLine = `LOCAL RECORD / ${record.wins} WINS · ${record.games} GAMES · BEST ${record.best}`;
  }
  setText($('result-eyebrow'), eyebrow);
  setText($('result-title'), title);
  $('result-title').style.color = win ? '#41ebcb' : crew.css;
  setText($('final-home'), e.scores[0]);
  setText($('final-away'), e.scores[1]);
  setText($('result-home-label'), 'TURBO / YOU');
  setText($('result-away-label'), `${crew.name} / CPU`);
  const s = e.stats;
  const rows = [
    ['FIELD GOALS', s.map((v) => `${v.made} / ${v.attempts}`)],
    ['THREE-POINTERS', s.map((v) => v.threes)],
    ['DUNKS', s.map((v) => v.dunks)],
    ['REBOUNDS', s.map((v) => v.rebounds)],
    ['ASSISTS', s.map((v) => v.assists)],
    ['STEALS / BLOCKS', s.map((v) => `${v.steals} / ${v.blocks}`)],
  ];
  for (const [label, vals] of rows) stats.append(statsRow(vals[0], label, vals[1]));
  setText($('record-line'), recordLine);
  setText($('again-label'), again);
  audio.tone(win ? 523 : 220, 0.4, 0.13, 'triangle', null, 0.5);
  audio.tone(win ? 659 : 196, 0.4, 0.12, 'triangle', null, 0.72);
  audio.tone(win ? 784 : 164, 0.65, 0.13, 'triangle', null, 0.94);
  if (win) {
    for (let i = 0; i < 4; i++) view.burst((i - 1.5) * 5, 6, -2, COLOR.teal, 45, 1.4);
    view.cheer(1);
    audio.crowd(1);
  }
  input.rumble(win ? 0.6 : 0.3, 220);
  focusButton($('again-btn'));
}

function toggleSound() {
  settings.sound = !settings.sound;
  audio.start();
  audio.apply();
  $('sound-btn').classList.toggle('off', !settings.sound);
  $('sound-btn').setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Enable sound');
  $('sound-waves').style.opacity = settings.sound ? '1' : '.15';
  saveSettings();
}
function fullscreen() {
  try {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    p?.catch?.(() => announce('FULL SCREEN UNAVAILABLE', 'USE YOUR BROWSER FULL-SCREEN CONTROL', '#ffd17a', 2));
  } catch {
    /* not allowed here */
  }
}
function syncToggles() {
  for (const [id, on] of [['shake-toggle', settings.shake], ['music-toggle', settings.music]]) {
    $(id).setAttribute('aria-pressed', String(!!on));
    $(id).textContent = on ? 'ON' : 'OFF';
  }
  $('sound-btn').classList.toggle('off', !settings.sound);
  $('sound-waves').style.opacity = settings.sound ? '1' : '.15';
}

// ---- menu navigation with a gamepad or the keyboard (D-pad / stick / arrows, A / Enter, B / Esc)
const nav = { dir: '', wait: 0 };
function panelRoots() {
  if (!el.result.hidden) return [el.result];
  if (!el.pause.hidden) return [el.pause];
  if (menu) return [el.hero, el.headerRight];
  return null;
}
function focusables(roots) {
  const out = [];
  for (const root of roots)
    for (const b of root.querySelectorAll('button')) {
      if (b.disabled || b.closest('[hidden]') || b.offsetParent === null) continue;
      if (getComputedStyle(b).visibility === 'hidden') continue;
      out.push(b);
    }
  return out;
}
let navFocused = null;
function focusButton(b, visible = input.source !== 'touch') {
  if (!b) return;
  navFocused?.classList.remove('nav-focus');
  navFocused = null;
  // Focusing scrolls a long dialog (pause, results) to the button on short screens.
  b.focus();
  if (visible) {
    b.classList.add('nav-focus');
    navFocused = b;
  }
}
addEventListener('pointerdown', () => {
  navFocused?.classList.remove('nav-focus');
  navFocused = null;
}, true);
function defaultButton() {
  if (!el.result.hidden) return $('again-btn');
  if (!el.pause.hidden) return $('resume-btn');
  return $('start-btn');
}
function moveFocus(roots, dir) {
  const list = focusables(roots);
  if (!list.length) return;
  const current = list.includes(document.activeElement) ? document.activeElement : null;
  if (!current) {
    focusButton(defaultButton());
    return;
  }
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const b of list) {
    if (b === current) continue;
    const q = b.getBoundingClientRect();
    const dx = q.left + q.width / 2 - cx;
    const dy = q.top + q.height / 2 - cy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 4) continue;
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) {
    focusButton(best, true);
    audio.blip(dir === 'up' || dir === 'left');
  }
}
function navigate(roots, dt) {
  const v = input.vector('move');
  let dir = '';
  if (Math.abs(v.x) > 0.55 || Math.abs(v.y) > 0.55) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (dir !== nav.dir) {
    nav.dir = dir;
    nav.wait = 0.38;
    if (dir) moveFocus(roots, dir);
  } else if (dir) {
    nav.wait -= dt;
    if (nav.wait <= 0) {
      nav.wait = 0.14;
      moveFocus(roots, dir);
    }
  }
  // A button still being mashed when the final whistle goes must not skip the results.
  const settling = !el.result.hidden && total - resultsAt < 0.7;
  if (!settling && (input.pressed('shoot') || input.pressed('confirm'))) {
    const list = focusables(roots);
    const target = list.includes(document.activeElement) ? document.activeElement : defaultButton();
    target?.click();
  } else if (input.pressed('defend') && !el.pause.hidden) {
    togglePause();
  }
}

// ---- per-frame input
function activePlay() {
  return !menu && sim.state === 'playing' && countdown <= 0;
}
function handleInput(dt) {
  if (input.pressed('mute')) toggleSound();
  if (input.pressed('fullscreen')) fullscreen();
  if (input.pressed('pause')) {
    if (menu && el.pause.hidden && input.source === 'gamepad') startGame();
    else if (el.result.hidden) togglePause();
    sim.setInput(0, 0, false);
    return;
  }
  const roots = panelRoots();
  if (roots) {
    navigate(roots, dt);
    sim.setInput(0, 0, false);
    return;
  }
  nav.dir = '';
  if (!activePlay()) {
    sim.setInput(0, 0, false);
    return;
  }
  // Movement follows the screen axes even while the camera eases out of the title view.
  const mv = input.vector('move');
  const x = mv.x;
  const z = -mv.y;
  const a = view.camAngle;
  sim.setInput(x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a), input.down('turbo'));
  if (input.pressed('shoot')) {
    sim.startCharge();
    // Contest: a press while the shooter is still reaching the rack starts the shot on pickup.
    if (!sim.charging && sim.mode === 'contest' && sim.ball.mode === 'rack') shootBuffered = true;
  }
  if (input.released('shoot')) {
    shootBuffered = false;
    sim.releaseCharge();
  }
  if (shootBuffered && input.down('shoot') && sim.ball.mode === 'held' && sim.ball.owner === sim.controlled && !sim.charging) {
    shootBuffered = false;
    sim.startCharge();
  }
  if (input.pressed('pass')) sim.pass();
  if (input.pressed('defend')) sim.defend();
  if (input.pressed('switch')) sim.switchPlayer();
  if (input.pressed('reset')) sim.resetPractice();
}

// ---- wiring
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => selectMode(b.dataset.mode));
for (const b of document.querySelectorAll('[data-diff]')) b.addEventListener('click', () => selectDifficulty(b.dataset.diff));
$('league-reset').addEventListener('click', () => {
  league.rung = 0;
  save(KEYS.league, league);
  refreshMenu();
  focusButton($('start-btn'));
});
$('start-btn').addEventListener('click', startGame);
$('again-btn').addEventListener('click', startGame);
$('result-menu-btn').addEventListener('click', returnToMenu);
$('pause-btn').addEventListener('click', togglePause);
$('resume-btn').addEventListener('click', togglePause);
$('restart-btn').addEventListener('click', startGame);
$('quit-btn').addEventListener('click', returnToMenu);
$('sound-btn').addEventListener('click', toggleSound);
$('fullscreen-btn').addEventListener('click', fullscreen);
$('settings-btn').addEventListener('click', () => kit.menu.open());
$('kit-settings-btn').addEventListener('click', () => kit.menu.open());
$('shake-toggle').addEventListener('click', () => {
  settings.shake = !settings.shake;
  syncToggles();
  saveSettings();
});
$('music-toggle').addEventListener('click', () => {
  settings.music = !settings.music;
  audio.apply();
  syncToggles();
  saveSettings();
});
// A focus trap keeps keyboard users inside each visible dialog.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const overlay = !el.pause.hidden ? el.pause : !el.result.hidden ? el.result : null;
  if (!overlay) return;
  const els = focusables([overlay]);
  if (!els.length) return;
  const first = els[0];
  const end = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    end.focus();
  } else if (!e.shiftKey && document.activeElement === end) {
    e.preventDefault();
    first.focus();
  }
});
addEventListener('blur', () => {
  if (!menu && sim.state === 'playing') togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !menu && sim.state === 'playing') togglePause();
});

// Read-only snapshot for smoke tests and local debugging.
window.BlockCourt = {
  version: '2.0.0',
  getState: () => ({
    state: sim.state,
    mode: sim.mode,
    menu,
    score: [...sim.scores],
    time: sim.time,
    shotClock: sim.shotClock,
    controlled: sim.controlled,
    ball: { ...sim.ball },
    players: sim.players.map((p) => ({ ...p })),
    derby: sim.derby ? JSON.parse(JSON.stringify(sim.derby)) : null,
    league: { ...league },
    renderer: { ...kit.renderer.info.render },
    backend: kit.backend,
  }),
  start: () => startGame(),
  pause: () => togglePause(),
};

// ---- start
setText($('tech-line'), `THREE.JS r186 / ${kit.backendLabel.toUpperCase()}`);
syncToggles();
refreshMenu();
refreshGuides();
view.setMenu(true);
syncTouch();
updateHUD();
kit.loading.progress(0.85, 'Warming up the lights…');
await view.prewarm();
$('start-btn').disabled = false;

kit.start((rawDt) => {
  const dt = Math.min(rawDt, 0.05);
  total += dt;
  handleInput(dt);
  if (goTime > 0) {
    goTime -= dt;
    if (goTime <= 0 || menu) setHidden(el.countdown, true);
  }
  if (countdown > 0 && sim.state === 'playing' && !menu) {
    countdown -= dt;
    const n = Math.ceil(countdown);
    setHidden(el.countdown, false);
    if (n !== countdownLast) {
      countdownLast = n;
      setText(el.countdown, n > 0 ? n : 'GO!');
      audio.tone(n > 0 ? 440 : 880, 0.13, 0.12, 'triangle');
    }
    if (countdown <= 0) {
      goTime = 0.45;
      if (sim.mode === 'contest') announce('SHOOT!', 'FIVE RACKS. MONEY BALLS COUNT TWO.', '#41ebcb', 1.6);
      else if (sim.mode === 'league') announce(`GAME ${league.rung + 1}: ${crew.name}`, `${crew.tag} · TURBO ATTACKS THE RIGHT HOOP →`, crew.css, 1.8);
      else announce('LET’S PLAY.', 'TURBO ATTACKS THE RIGHT HOOP →', '#41ebcb', 1.6);
      input.settle();
    }
  }
  if (countdown <= 0) {
    const factor = slowTime > 0 ? 0.6 : 1;
    slowTime = Math.max(0, slowTime - dt);
    accumulator = Math.min(accumulator + dt * factor, 5 / 60);
    while (accumulator >= 1 / 60) {
      sim.update(1 / 60);
      accumulator -= 1 / 60;
    }
  }
  const playing = sim.state === 'playing';
  view.update(sim.state === 'paused' ? 0 : dt, { menu, playing });
  updateLabels(dt);
  if (total - lastHud > 0.07 || lastHud < 0) {
    lastHud = total;
    updateHUD();
  }
  if (announceTime > 0) {
    announceTime -= dt;
    if (announceTime <= 0) $('announce').classList.remove('show');
  }
  if (!menu && playing && countdown <= 0 && sim.ball.mode === 'held' && !sim.charging && total > nextDribble) {
    nextDribble = total + 0.3;
    audio.dribble(0.6);
  }
  audio.tick(!menu && playing && countdown <= 0);
  view.render();
});
