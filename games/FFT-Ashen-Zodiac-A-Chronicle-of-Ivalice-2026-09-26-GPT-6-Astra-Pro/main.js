import { boot as bootKit } from 'kit/boot.js';
import { META, CAMPAIGN, OPTIONAL, CHAPTERS, SIGN_NAMES, DISPATCHES, ENDING } from './content.js';
import {
  makeDB,
  createState,
  copy,
  key,
  distance,
  stats,
  availableJP,
  levelOf,
  jobUnlocked,
  jobMembers,
  learn,
  changeJob,
  equipAllowed,
  equipItem,
  saveLocal,
  loadLocal,
  checkpoint,
  exportSave,
  importSave,
} from './model.js';
import { createBattle, BattleEngine } from './battle.js';
import { actionSpec, actionBlocked, inRange, affected, predict, alive, teamOf } from './abilities.js';
import { choosePlan, executePlan } from './ai.js';
import { tileAt, unitAt } from './maps.js';
import {
  finishBattle,
  advanceDays,
  optionalAvailable,
  rumorActions,
  takeRumor,
  dispatchUnit,
  shopStock,
  buyItem,
  sellItem,
  trainJob,
  hire,
} from './campaign.js';
import { AudioManager } from './audio.js';
import { Stage } from './scene.js';
import { focusables, focusKey, findByKey, focus, neighbour, adjust, activate, createRepeater } from './nav.js';
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const btn = (action, label, extra = '', cls = '') => `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
/** Game data lives next to the game: data/catalog.json now, data/atlas.json when the atlas opens. */
const data = (path) =>
  fetch(new URL(path, import.meta.url)).then((r) => {
    if (!r.ok) throw Error('Could not load ' + path);
    return r.json();
  });
let kit,
  db,
  state,
  view,
  audio,
  engine,
  screen = 'title',
  mode = 'idle',
  preview = null,
  selectedAction = null,
  inspected = null,
  auto = false,
  modal = '',
  timer,
  recovery = null,
  seq = 0,
  boardOpen = false,
  atlas = [],
  unitId = null,
  atlasPage = 0,
  endingPage = 0,
  busy = false,
  warned = false,
  shopMode = 'shop';
const app = $('#app'),
  root = $('#modal-root');
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function persist() {
  if (!saveLocal(state) && !warned) {
    warned = true;
    toast('Browser storage is blocked. Export your save before you leave.');
  }
}
function error(e) {
  console.error(e);
  toast(e.message || String(e));
  busy = false;
}
function header(sub = 'A CHRONICLE OF IVALICE') {
  return `<header><button class="brand" data-action="home">✧ <span>ASHEN ZODIAC<small>${esc(sub)}</small></span></button><nav>${screen !== 'title' ? btn('save', 'Save') : ''}${btn('help', 'Controls')}${btn('options', 'Options')}${btn('mute', state.options.mute ? 'Sound off' : 'Sound on')}${btn('fullscreen', '⛶', 'aria-label="Full screen"')}</nav></header>`;
}
function showModal(name, html, wide = false) {
  clearTimeout(timer);
  // The same menu re-rendering after a change (a job picked, an item bought) keeps its focused control;
  // a different menu starts fresh instead of reusing the last menu's remembered control.
  const again = modal === name,
    last = again ? focusKey(document.activeElement) || focusKeys.modal : '';
  modal = name;
  focusKeys.modal = last;
  root.innerHTML = `<div class="scrim"><section role="dialog" aria-modal="true" class="modal ${wide ? 'wide' : ''}"><button class="close" data-action="close" aria-label="Close">×</button>${html}</section></div>`;
  const scope = root.querySelector('.modal');
  // Controller and keyboard players land on the main choice; pointer players on the close button as before.
  if (padNav) focus(findByKey(scope, last) || preferred(scope));
  else root.querySelector('button')?.focus();
}
function close() {
  modal = '';
  root.innerHTML = '';
  if (screen === 'battle') advance();
  else audio.playMusic(screen === 'title' ? 'title' : 'world');
}
function setScreen(s) {
  if (s !== screen) focusKeys.app = ''; // a new screen starts on its main choice
  screen = s;
  document.body.dataset.screen = s;
}
function reset() {
  mode = 'idle';
  preview = null;
  selectedAction = null;
  view?.highlight([]);
}
function title() {
  clearTimeout(timer);
  engine = null;
  setScreen('title');
  auto = false;
  app.innerHTML =
    header() +
    `<section class="title-panel"><div class="eyebrow">THE WAR OF THE LIONS · RETOLD IN BRICK</div><span class="title-mark">✧</span><h1>Ashen<br><em>Zodiac</em></h1><div class="gold-rule"></div><p class="tagline">History remembers a king.<br>Command the company it forgot.</p><div class="title-actions">${btn('new', 'Begin a chronicle <span>→</span>', '', 'primary')}${btn('continue', state.battle ? 'Resume the battle' : 'Continue the chronicle', state.lastSaved ? '' : 'disabled')}${btn('about', 'About this edition')}</div><small class="edition">A FINAL FANTASY TACTICS PS1 ADAPTATION<br>26 SEPTEMBER 2026 · GPT-6 ASTRA PRO<br>INTERNAL TEST BUILD · NOT AN OFFICIAL RELEASE</small></section><div class="title-note">MOVE WITH PURPOSE.<br>CHOOSE WHOM TO SAVE.</div>`;
  view?.showTitle();
  audio.playMusic('title');
}
function newMenu() {
  showModal(
    'new',
    `<div class="eyebrow">A NEW RECORD</div><h2>The name history forgot</h2><p>Lead Ramza Beoulve through the Lion War. Your sign changes Zodiac compatibility. Jobs and learned abilities shape each battle.</p><label>Zodiac sign<select id="new-sign">${SIGN_NAMES.slice(
      0,
      12,
    )
      .map((s, i) => `<option value="${i}" ${i === 9 ? 'selected' : ''}>${s}</option>`)
      .join(
        '',
      )}</select></label><label>Challenge<select id="new-difficulty"><option>Tactician</option><option>Story</option></select></label><p class="note">Tactician keeps the pressure on. Story increases allied HP and attack stats. You can change this between battles. Starting a new chronicle replaces the local autosave.</p>${btn('start', 'Open the chronicle →', '', 'primary')}`,
  );
}
function world() {
  clearTimeout(timer);
  engine = null;
  state.battle = null;
  setScreen('world');
  reset();
  auto = false;
  persist();
  view?.showWorld(state);
  audio.playMusic('world');
  renderWorld();
}
function renderWorld() {
  const e = CAMPAIGN[state.progress];
  app.innerHTML =
    header(state.flags.campaignWon ? 'THE WAR HAS ENDED' : `CHAPTER ${state.chapter || 'PROLOGUE'} · DAY ${state.day}`) +
    `<section class="map-panel"><div class="eyebrow">THE COMPANY'S ROAD</div><h1>${e ? esc(e.name) : 'Beyond the written page'}</h1><p>${e ? esc(e.brief) : 'The final battle is won. Return to any cleared field, follow an unfinished rumor, or enter the Deep Dungeon.'}</p><div class="meter"><i style="width:${(state.progress / CAMPAIGN.length) * 100}%"></i></div><small>${state.progress} / ${CAMPAIGN.length} main encounters · ${state.gil.toLocaleString()} gil · ${state.relics} relic tokens</small><div class="map-actions">${e ? btn('brief', 'Continue the story →', `data-id="${e.id}"`, 'primary') : btn('ending', 'Read the ending', '', 'primary')}${btn('formation', 'Company & jobs')}${btn('shop', 'Outfitter')}${btn('tavern', 'Tavern & side routes')}${btn('atlas', 'Brave Story & source atlas')}</div></section><aside class="road-panel"><div class="eyebrow">CAMPAIGN RECORD</div>${CAMPAIGN.filter(
      (e, i) => i <= state.progress,
    )
      .map((e) =>
        btn(
          'brief',
          `<span>${state.completed.includes(e.id) ? '✓' : '◇'}</span> ${esc(e.name)}`,
          `data-id="${e.id}"`,
          'road-row',
        ),
      )
      .join(
        '',
      )}<p class="small">Cleared battles can be replayed for training. A recovery save is kept before each deployment.</p></aside>`;
}
const objective = (e) =>
  e.objective === 'switches'
    ? 'Use Ramza to open both sluice switches'
    : e.rescue
      ? 'Protect ' + e.rescue
      : e.boss
        ? 'Defeat ' + e.boss
        : e.dungeon !== undefined
          ? 'Find the exit and defeat the enemy'
          : 'Defeat all enemies';
function brief(id) {
  const e = db.encounter.get(id);
  if (!e) return;
  showModal(
    'brief',
    `<div class="eyebrow">${e.chapter ? 'CHAPTER ' + e.chapter : 'PROLOGUE'} · DEPLOYMENT</div><h2>${esc(e.name)}</h2><p>${esc(e.brief)}</p><div class="note"><b>Objective:</b> ${esc(objective(e))}<br><b>Enemy:</b> ${esc(e.enemies.replaceAll('|', ', ').replaceAll('*', ' × '))}</div><h3>Field company</h3><div class="chips">${state.party
      .filter((u) => state.selected.includes(u.id) && !u.away)
      .map((u) => `<span>${esc(u.name)} · ${esc(u.job)}</span>`)
      .join(
        '',
      )}</div>${e.duel ? '<p class="warning">Ramza begins alone against Wiegraf. Prepare recovery and useful secondary skills. The company joins after the duel.</p>' : ''}${e.choice ? '<label><input id="rescue-choice" type="checkbox" checked> Make the rescue the battle objective.</label>' : ''}${e.routeChoice ? '<label><input id="north-choice" type="checkbox"> Approach from the north wall.</label>' : ''}<p class="small">Movement uses tile height and Jump. Check the turn list before charging magic. Red previews can include allies.</p><div class="row">${btn('formation', 'Review company')}${btn('deploy', 'Deploy →', `data-id="${e.id}"`, 'primary')}</div>`,
    true,
  );
}
function deploy(id, choices = { rescue: true }) {
  const e = typeof id === 'string' ? db.encounter.get(id) : id;
  clearTimeout(timer);
  modal = '';
  root.innerHTML = '';
  recovery = copy(state);
  recovery.battle = null;
  checkpoint(state);
  createBattle(db, state, e, choices);
  engine = new BattleEngine(db, state);
  seq = 0;
  setScreen('battle');
  reset();
  inspected = null;
  auto = false;
  view?.setBattle(engine.b);
  audio.playMusic(e.ending ? 'final' : e.boss ? 'boss' : e.dungeon !== undefined ? 'dungeon' : 'battle');
  persist();
  advance();
}
function resume() {
  root.innerHTML = '';
  modal = '';
  if (state.battle) {
    engine = new BattleEngine(db, state);
    setScreen('battle');
    reset();
    view?.setBattle(engine.b);
    seq = engine.b.eventCounter || 0;
    advance();
  } else world();
}
function flush() {
  if (!engine) return;
  view?.sync(engine.b);
  for (const e of engine.b.events || [])
    if (e.seq > seq) {
      seq = e.seq;
      const sounds = {
        move: 'move',
        damage: 'hit',
        hit: 'hit',
        heal: 'heal',
        charge: 'spell',
        reward: 'reward',
        level: 'level',
        victory: 'victory',
      };
      if (sounds[e.type]) audio.play(sounds[e.type]);
      if (e.text) toast(e.text);
    }
}
function advance() {
  clearTimeout(timer);
  if (screen !== 'battle' || modal || !engine) return;
  engine.advance();
  flush();
  if (engine.b.result) {
    results();
    return;
  }
  renderBattle();
  const u = engine.active;
  if (!u) return;
  const controlled = u.team === 0 && !u.guest && teamOf(u) === 0 && !u.status.Berserk && !u.status.Confusion && !u.status.Chicken;
  if (!controlled || auto) {
    busy = true;
    timer = setTimeout(
      () => {
        // A pending enemy turn waits while a menu or the settings panel is open.
        if (modal || screen !== 'battle' || kit.paused) return;
        try {
          executePlan(engine, choosePlan(engine));
          busy = false;
          flush();
          persist();
          reset();
          advance();
        } catch (e) {
          error(e);
        }
      },
      Math.max(120, 600 / state.options.speed),
    );
  } else busy = false;
}
function renderBattle() {
  if (!engine) return;
  const b = engine.b,
    u = engine.active,
    shown = b.units.find((v) => v.id === inspected) || u,
    e = engine.def;
  const player = u?.team === 0 && !u.guest && teamOf(u) === 0 && !auto;
  let commands = '';
  if (!u) commands = '<p>Resolving the field…</p>';
  else if (!player)
    commands = `<h3>${esc(u.name)}</h3><p>${auto ? 'Company auto-battle' : 'Enemy / guest turn'}</p>${auto ? btn('auto', 'Take command', '', 'primary') : ''}`;
  else if (mode === 'actions')
    commands = `<h3>Choose an action</h3><div class="action-list">${engine
      .actions()
      .map((a) => {
        const why = actionBlocked(db, state, u, a);
        return btn(
          'ability',
          `<b>${esc(a.name)}</b><small>${esc(a.family)} · ${a.mp ? a.mp + ' MP' : a.ctr ? a.ctr + ' ticks' : 'Instant'}</small>`,
          `data-id="${a.id}" ${why ? 'disabled' : ''} title="${esc(why || 'Range ' + a.range)}"`,
        );
      })
      .join(
        '',
      )}${u.job === 'Calculator' || u.secondary === 'Calculator' ? btn('math', 'Math Skill…') : ''}</div>${btn('cancel', 'Back')}`;
  else if (mode === 'facing')
    commands = `<h3>Choose facing</h3><p>Defend your front. A turn costs ${u.moved && u.acted ? 100 : u.moved || u.acted ? 80 : 60} CT.</p><div class="facing">${['North ↑', 'East →', 'South ↓', 'West ←'].map((n, i) => btn('face', n, `data-face="${i}"`)).join('')}</div>`;
  else if (preview) {
    const t = preview,
      targets = selectedAction ? affected(selectedAction, u, t, b.units) : [];
    commands = `<div class="eyebrow">CONFIRM ${mode === 'move' ? 'MOVEMENT' : 'ACTION'}</div><h3>${esc(selectedAction?.name || 'Move')} · ${t.x}, ${t.z}</h3><p>Height ${t.h}${selectedAction ? ' · Resolves in ' + selectedAction.ctr + ' ticks' : ''}</p>${targets
      .map((v) => {
        const p = predict(db, u, v, selectedAction);
        return `<div class="forecast ${v.team === 0 && !p.heal ? 'risk' : ''}"><b>${esc(v.name)}</b><span>${p.hit}% · ${p.heal ? '+' : '−'}${p.amount || 0} ${p.mp ? 'MP' : 'HP'}</span></div>`;
      })
      .join(
        '',
      )}${selectedAction?.ctr ? '<label><input id="lock-target" type="checkbox"> Follow the unit instead of its tile.</label>' : ''}<div class="row">${btn('confirm', 'Confirm', '', 'primary')}${btn('cancel', 'Cancel')}</div>`;
  } else if (mode === 'move' || mode === 'target')
    commands = `<h3>${mode === 'move' ? 'Choose a blue tile' : 'Choose a target'}</h3><p>${mode === 'move' ? 'Select a tile. Review the move, then confirm.' : esc(selectedAction?.name) + ' · Range ' + selectedAction?.range + '. Tap a tile to inspect the result.'}</p>${btn('board', 'Open tile board')}${btn('cancel', 'Back')}`;
  else
    commands = `<div class="eyebrow">${esc(u.name)} · YOUR TURN</div><div class="commands">${btn('move', '<kbd>1</kbd> Move', u.moved ? 'disabled' : '')}${btn('act', '<kbd>2</kbd> Act', u.acted ? 'disabled' : '')}${btn('wait', '<kbd>3</kbd> Wait')}${btn('undo', 'Undo move', u.undo && !u.acted ? '' : 'disabled')}${btn('inspect', 'Unit details')}${btn('auto', 'Auto-battle')}</div>`;
  app.innerHTML =
    header(e.name) +
    `<div class="timeline"><b>TURN<br>ORDER</b>${engine
      .timeline(8)
      .map(
        (t, i) =>
          `<div class="turn ${t.team ? 'enemy' : ''}"><small>${t.spell ? 'CAST' : String(i + 1).padStart(2, '0')} · ${t.ticks} CT</small><strong>${esc(t.name)}</strong></div>`,
      )
      .join(
        '',
      )}</div><div class="objective"><small>OBJECTIVE</small><b>${esc(objective(e))}</b><span>Turn ${b.turnCount} · Tick ${b.tick}</span></div>${
      shown
        ? `<aside class="unit-card panel"><div class="unit-head"><span class="portrait ${shown.team ? 'red' : ''}">${esc(shown.name[0])}</span><div><small>${shown.id === u?.id ? 'ACTIVE TURN' : 'FIELD UNIT'}</small><h2>${esc(shown.name)}</h2><p>${esc(shown.job)} · Lv ${shown.level}</p></div></div><div class="vital">HP <b>${shown.hp} / ${shown.maxHp}</b><i style="--value:${Math.max(0, shown.hp / shown.maxHp) * 100}%"></i></div><div class="vital mp">MP <b>${shown.mp} / ${shown.maxMp}</b><i style="--value:${(shown.mp / Math.max(1, shown.maxMp)) * 100}%"></i></div><div class="stats-line">CT ${Math.floor(shown.ct)} · Move ${shown.move} · Jump ${shown.jump}</div><div class="chips">${Object.keys(
            shown.status,
          )
            .map((s) => `<span>${esc(s)}</span>`)
            .join('')}${shown.hp <= 0 ? `<span>KO · ${shown.countdown ?? 3}</span>` : ''}</div></aside>`
        : ''
    }<aside class="command-card panel">${commands}</aside><div class="camera-controls">${btn('rotate', '↶', 'data-step="-1" aria-label="Rotate left"')}${btn('rotate', '↷', 'data-step="1" aria-label="Rotate right"')}${btn('zoom', '−', 'data-step="-1" aria-label="Zoom out"')}${btn('zoom', '+', 'data-step="1" aria-label="Zoom in"')}${btn('board', boardOpen ? 'Close board' : 'Tile board')}${btn('log', 'Battle log')}</div>${boardOpen ? boardHTML() : ''}`;
}
function boardHTML() {
  const b = engine.b,
    u = engine.active,
    legal = mode === 'move' && u ? engine.reachable() : new Map();
  return `<section class="board-panel panel"><div class="row"><h3>Tile board · ${esc(engine.def.name)}</h3>${btn('board', '×')}</div><p class="small">Same battlefield and rules. Tap a tile, then confirm in the command panel.</p><div class="board" style="--cols:${b.grid.width}">${b.grid.tiles
    .map((t) => {
      const v = unitAt(b, t.x, t.z),
        ok = legal.has(key(t.x, t.z));
      return btn(
        'tile',
        `${v ? esc(v.name.slice(0, 2)) : t.h}<small>${t.x},${t.z}</small>`,
        `data-x="${t.x}" data-z="${t.z}" title="${esc(v ? v.name + ' · HP ' + v.hp + '/' + v.maxHp : 'Height ' + t.h)}"`,
        `${ok ? 'legal ' : ''}${v ? (v.team ? 'enemy-cell' : 'ally-cell') : ''}`,
      );
    })
    .join('')}</div></section>`;
}
function tileInput(t) {
  if (screen === 'world' && t.encounterId) {
    brief(t.encounterId);
    return;
  }
  if (!engine || modal || auto || busy) return;
  const u = engine.active;
  if (!u || u.team || u.guest) return;
  const target = unitAt(engine.b, t.x, t.z);
  if (mode === 'move') {
    if (!engine.reachable().has(key(t.x, t.z))) {
      toast('That tile is not reachable.');
      return;
    }
    preview = t;
    cursorTile = { x: t.x, z: t.z };
    view?.highlight([t], 'select');
  } else if (mode === 'target') {
    if (!inRange(db, u, selectedAction, t)) {
      toast('Target is outside range or height tolerance.');
      return;
    }
    preview = t;
    cursorTile = { x: t.x, z: t.z };
    view?.highlight(
      engine.b.grid.tiles.filter((v) => distance(v, t) <= selectedAction.area),
      'area',
    );
  } else if (target) inspected = target.id;
  renderBattle();
}
function chooseAbility(id) {
  selectedAction = actionSpec(db, engine.active, id);
  if (!selectedAction) return;
  modal = '';
  root.innerHTML = '';
  mode = 'target';
  preview = selectedAction.self ? engine.tile(engine.active.x, engine.active.z) : null;
  cursorTile = { x: engine.active.x, z: engine.active.z };
  view?.highlight(
    engine.b.grid.tiles.filter((t) => inRange(db, engine.active, selectedAction, t)),
    'area',
  );
  renderBattle();
}
function confirmSelection() {
  if (!preview || !engine) return;
  const answer =
    mode === 'move'
      ? engine.move(preview.x, preview.z)
      : engine.act(selectedAction.id, preview.x, preview.z, $('#lock-target')?.checked || false);
  if (!answer.ok) {
    toast(answer.reason);
    return;
  }
  flush();
  reset();
  persist();
  if (engine.b.result) results();
  else if (!engine.active) advance();
  else renderBattle();
}
function results() {
  clearTimeout(timer);
  busy = false;
  auto = false;
  const b = engine.b,
    r = finishBattle(db, state);
  setScreen('results');
  persist();
  const reward = b.reward || r;
  audio.playMusic(b.result.win ? 'victory' : 'defeat');
  app.innerHTML =
    header() +
    `<section class="result-panel panel"><div class="eyebrow">${b.result.win ? 'OBJECTIVE COMPLETE' : 'COMPANY DEFEATED'}</div><h1>${b.result.win ? 'A page is written.' : 'The record need not end here.'}</h1><p>${esc(engine.def.name)} · ${b.turnCount} turns</p>${b.result.win ? `<div class="reward-row"><span><b>${reward?.gil || 0}</b> GIL</span><span><b>${reward?.jp || 0}</b> JP / UNIT</span></div><p>${reward?.recruits?.length ? 'Joined: ' + esc(reward.recruits.join(', ')) : ''}</p><p>${reward?.items?.map((id) => esc(db.item.get(id)?.name)).join(' · ') || ''}</p>${btn(engine.def.ending ? 'ending' : 'aftermath', 'Continue →', '', 'primary')}` : `<p>${esc(b.result.reason)}</p>${btn('retry', 'Restore pre-battle company', '', 'primary')}`}<p class="small">Rewards are paid once per battle. Replays start a new battle.</p></section>`;
}
function aftermath() {
  const e = engine?.def;
  let text = e?.brief || '';
  const records = (db.scenes || []).filter((s) => +s.id.split('-')[1] >= e?.scenes?.[0] && +s.id.split('-')[1] <= e?.scenes?.[1]);
  showModal(
    'aftermath',
    `<div class="eyebrow">AFTER THE BATTLE</div><h2>${esc(e?.name)}</h2><p>${esc(text)}</p><p>The next page is open. Review jobs, equipment, and tavern rumors before you march.</p>${records.length ? `<p>${records.length} source scenes are available below.</p>` : ''}${records.map((r) => `<details><summary>${esc(r.name)}</summary><pre class="source-text">${esc(r.body)}</pre></details>`).join('')}${btn('world', 'Return to the road →', '', 'primary')}`,
  );
}
function ending() {
  clearTimeout(timer);
  modal = '';
  root.innerHTML = '';
  setScreen('ending');
  audio.playMusic('ending');
  const e = ENDING[endingPage];
  app.innerHTML =
    header('THE FINAL RECORD') +
    `<section class="ending-panel"><div class="eyebrow">${endingPage + 1} / ${ENDING.length} · EPILOGUE</div><h1>${esc(Array.isArray(e) ? e[0] : 'The unwritten history')}</h1><p>${esc(Array.isArray(e) ? e[1] : e)}</p>${btn('ending-next', endingPage === ENDING.length - 1 ? 'Return to the world' : 'Turn the page →', '', 'primary')}<small>Ashen Zodiac · 26 September 2026 · GPT-6 Astra Pro</small></section>`;
}
function controls() {
  showModal(
    'help',
    `<div class="eyebrow">FIELD MANUAL</div><h2>Every turn is a decision</h2><h3>Move, Act, Wait</h3><p>Select Move and a blue tile. Confirm the preview. Select Act, choose an ability and a target, then confirm. Select Wait and choose facing to end the turn. You can Act before Move.</p><p>Move + Act costs 100 CT. One costs 80. Waiting costs 60. Speed fills CT. Spells finish after their listed charge ticks.</p><h3>Desktop and touch</h3><p>Click or tap a tile. Drag horizontally to rotate. Use the wheel or pinch to zoom. Q / E rotate. + / − zoom. Keys 1 / 2 / 3 select Move / Act / Wait. Escape cancels or closes a menu. Enter confirms a preview.</p><p>Arrow keys or WASD move through menus and steer the gold tile cursor when you choose a tile. Space or Enter selects the tile, then confirms. K or Shift goes back. F9 opens graphics and control settings.</p><h3>Controller</h3><p>Left stick or D-pad moves through menus and the tile cursor. A selects and confirms. B or LT goes back. Right stick turns the camera. LB / RB zoom. Start pauses or closes a menu. Left and right change a focused list or slider.</p><p>The Tile board gives large labelled controls for the same battlefield. Blue marks reachable tiles. Team colors and HP remain available.</p><h3>Survival and growth</h3><p>Attack from the side or back. Watch height and friendly fire. Revive a KO unit before its counter expires. Spend JP in Company, then equip learned secondary, reaction, support, and movement skills. Stock medicine in the Outfitter.</p><p>Local saves include the current battle. Export a save for a portable backup. A pre-battle recovery save protects against trapped progression.</p>${btn('close', 'Return', '', 'primary')}`,
    true,
  );
}
function options() {
  showModal(
    'options',
    `<div class="eyebrow">OPTIONS</div><h2>Set the field to suit you</h2><div class="two-col"><label>Battle speed<select data-option="speed">${[1, 2, 3].map((x) => `<option value="${x}" ${state.options.speed === x ? 'selected' : ''}>${x}×</option>`).join('')}</select></label><label>Challenge<select data-option="difficulty" ${engine ? 'disabled' : ''}>${['Tactician', 'Story'].map((x) => `<option ${state.options.difficulty === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label><input data-option="permadeath" type="checkbox" ${state.options.permadeath ? 'checked' : ''}> Permanent generic-unit loss</label></div>${['volume', 'music', 'sfx'].map((k) => `<label>${k === 'volume' ? 'Master volume' : k === 'music' ? 'Music' : 'Effects'}<input data-option="${k}" type="range" min="0" max="1" step=".05" value="${state.options[k]}"></label>`).join('')}<p class="note">Graphics & controls opens the shared settings panel (also F9): quality, resolution, frame rate, touch controls, vibration and camera sensitivity. Auto picks the quality for this device. Higher quality raises resolution, shadow detail and debris limits. Every level uses the same models and node materials.</p><div class="row">${btn('graphics', 'Graphics & controls')}${btn('export', 'Export save')}${btn('import', 'Import save')}${btn('recovery', 'Load recovery')}${btn('fullscreen', 'Full screen')}${btn('close', 'Return', '', 'primary')}</div>`,
    true,
  );
}
function formation() {
  if (engine) {
    toast('Change the company between battles.');
    return;
  }
  unitId ??= state.party[0].id;
  const u = state.party.find((v) => v.id === unitId) || state.party[0],
    s = stats(db, u);
  unitId = u.id;
  showModal(
    'formation',
    `<div class="eyebrow">COMPANY · ${state.gil.toLocaleString()} GIL</div><h2>Build the company</h2><div class="formation"><aside class="roster">${state.party.map((v) => btn('unit', `<b>${esc(v.name)}</b><small>${esc(v.job)} · Lv ${v.level}${v.away ? ' · Away' : ''}</small>`, `data-id="${v.id}"`, v.id === u.id ? 'chosen' : '')).join('')}</aside><section><div class="row"><h3>${esc(u.name)}</h3>${btn('select-unit', state.selected.includes(u.id) ? 'Deployed ✓' : 'Deploy', `data-id="${u.id}" ${u.away ? 'disabled' : ''}`)}</div><p>HP ${s.maxHp} · MP ${s.maxMp} · PA ${s.pa} · MA ${s.ma} · Speed ${s.speed}<br>Brave ${u.brave} · Faith ${u.faith} · ${esc(SIGN_NAMES[u.sign])}</p><div class="two-col"><label>Job<select id="job-select" ${u.monster ? 'disabled' : ''}>${[
      ...db.job.values(),
    ]
      .filter((j) => jobUnlocked(db, u, j.name))
      .map((j) => `<option ${u.job === j.name ? 'selected' : ''}>${esc(j.name)}</option>`)
      .join('')}</select></label><label>Secondary command<select data-slot="secondary"><option value="">None</option>${[
      ...db.job.values(),
    ]
      .filter((j) => !j.special || u.baseJob === j.name)
      .map(
        (j) =>
          `<option value="${esc(j.name)}" ${u.secondary === j.name || (u.secondary === 'Item' && j.name === 'Chemist') ? 'selected' : ''}>${esc(j.name)}</option>`,
      )
      .join('')}</select></label></div><div class="two-col">${['reaction', 'support', 'movement']
      .map(
        (slot) =>
          `<label>${slot}<select data-slot="${slot}"><option value="">None</option>${u.learned
            .map((id) => db.action.get(id))
            .filter((a) => a?.kind === slot)
            .map((a) => `<option ${u[slot] === a.name ? 'selected' : ''}>${esc(a.name)}</option>`)
            .join('')}</select></label>`,
      )
      .join('')}</div><h3>Equipment</h3><div class="two-col">${['weapon', 'shield', 'head', 'body', 'accessory']
      .map(
        (slot) =>
          `<label>${slot}<select data-equip="${slot}"><option value="">None</option>${db.items
            .filter(
              (i) =>
                (i.slot === slot ||
                  (slot === 'shield' && i.slot === 'weapon' && (u.job === 'Ninja' || u.support === 'Two Swords'))) &&
                (state.inventory[i.id] > 0 || u.equipment[slot] === i.id) &&
                equipAllowed(db, u, i),
            )
            .map(
              (i) =>
                `<option value="${i.id}" ${u.equipment[slot] === i.id ? 'selected' : ''}>${esc(i.name)}${i.wp ? ' · WP ' + i.wp : ''}${i.hp ? ' · HP +' + i.hp : ''}</option>`,
            )
            .join('')}</select></label>`,
      )
      .join('')}</div><h3>Learn · ${availableJP(u)} ${esc(u.job)} JP</h3><div class="learn-list">${jobMembers(db, u)
      .map((m) => {
        const a = db.action.get(m.id),
          known = u.learned.includes(m.id);
        return btn(
          'learn',
          `<b>${esc(a.name)}</b><small>${known ? 'Learned' : m.jp + ' JP'} · ${esc(a.kind)}</small>`,
          `data-id="${m.id}" ${known || availableJP(u) < m.jp ? 'disabled' : ''}`,
        );
      })
      .join(
        '',
      )}</div><div class="note">${btn('drill', 'Training drill · 250 gil', state.gil < 250 ? 'disabled' : '')} Adds 120 JP in the current job. This is an authored training aid.</div><details><summary>Job requirements</summary>${db.jobs
      .map(
        (j) =>
          `<p><b>${j.name}:</b> ${
            Object.entries(j.requirements)
              .map(([k, n]) => k + ' Lv ' + n)
              .join(', ') || 'Starting job'
          }</p>`,
      )
      .join(
        '',
      )}</details></section></div><footer>${btn('hire', 'Hire a recruit · 500 gil')}${btn('close', 'Return', '', 'primary')}</footer>`,
    true,
  );
  audio.playMusic('formation');
}
function shop() {
  if (engine) {
    toast('Visit the outfitter between battles.');
    return;
  }
  const items =
    shopMode === 'sell'
      ? db.items.filter((i) => state.inventory[i.id] > 0)
      : shopMode === 'fur'
        ? db.items.filter((i) => state.fur.includes(i.id))
        : shopStock(db, state, shopMode === 'relic');
  showModal(
    'shop',
    `<div class="eyebrow">OUTFITTER · ${state.gil.toLocaleString()} GIL · ${state.relics} RELICS</div><h2>Prepare for the next field</h2><div class="tabs">${['shop', 'sell', ...(state.chapter >= 3 ? ['fur'] : []), ...(state.chapter >= 4 ? ['relic'] : [])].map((k) => btn('shop-tab', k, `data-tab="${k}"`, k === shopMode ? 'chosen' : '')).join('')}</div><label>Find equipment<input id="shop-search" type="search" placeholder="Name, family, or effect"></label><div class="shop-list">${items.map((i) => `<article data-filter="${esc((i.name + ' ' + i.family + ' ' + i.effects).toLowerCase())}"><small>${esc(i.family)} · ${state.inventory[i.id] || 0} in stock</small><h3>${esc(i.name)}</h3><p>${esc(i.effects || '')}${i.wp ? ' · WP ' + i.wp : ''}${i.hp ? ' · HP +' + i.hp : ''}${i.mp ? ' · MP +' + i.mp : ''}</p>${btn('buy', shopMode === 'sell' ? 'Sell · ' + Math.floor((i.price || 100) / 2) + ' gil' : shopMode === 'relic' ? 'Buy · 2 relics' : 'Buy · ' + Math.floor((i.price || 100) * (shopMode === 'fur' ? 0.5 : 1)) + ' gil', `data-id="${i.id}"`)}</article>`).join('')}</div>`,
    true,
  );
  audio.playMusic('shop');
}
function tavern() {
  if (engine) return;
  showModal(
    'tavern',
    `<div class="eyebrow">TAVERN · DAY ${state.day}</div><h2>Listen before you march</h2><div class="two-col"><section><h3>Rumors & recruitment</h3>${
      rumorActions(state)
        .map(
          (r) =>
            `<article><h3>${esc(r.name)}</h3><p>${esc(r.text)}</p>${btn('rumor', 'Follow the lead', `data-id="${r.id}"`)}</article>`,
        )
        .join('') || '<p>No new leads. Return after major story events.</p>'
    }<h3>Side routes</h3>${
      OPTIONAL.filter((e) => optionalAvailable(state, e))
        .map((e) => btn('brief', `${state.completed.includes(e.id) ? '✓ ' : ''}${esc(e.name)}`, `data-id="${e.id}"`, 'route-row'))
        .join('') || '<p>Side routes open later in the chronicle.</p>'
    }</section><section><h3>Propositions</h3>${
      state.chapter < 2
        ? '<p>Dispatches open in Chapter II.</p>'
        : DISPATCHES.map((d) => {
            const active = state.dispatches.find((x) => x.id === d.id && !x.finished);
            return `<article><h3>${esc(d.name)}</h3><p>${d.days} days · ${d.fee} gil · ${esc(d.job)} favored</p>${
              active
                ? `<p>Returns in ${Math.max(0, active.due - state.day)} days.</p>`
                : `<select id="dispatch-${d.id}">${state.party
                    .filter((u) => u.generic && !u.away && !u.monster)
                    .map((u) => `<option value="${u.id}">${esc(u.name)}</option>`)
                    .join('')}</select>${btn('dispatch', 'Send', `data-id="${d.id}"`)}`
            }</article>`;
          }).join('')
    }<p class="small">Dispatch duration and rewards are adapted. Waiting advances dispatches and monster breeding.</p>${btn('day', 'Pass a day')}</section></div><h3>Company journal</h3>${state.journal
      .slice(0, 12)
      .map((s) => `<p>${esc(s)}</p>`)
      .join('')}`,
    true,
  );
  audio.playMusic('tavern');
}
async function openAtlas() {
  if (!atlas.length) {
    const a = await data('data/atlas.json');
    atlas = Array.isArray(a) ? a : a.records;
  }
  showModal(
    'atlas',
    `<div class="eyebrow">BRAVE STORY · SOURCE ATLAS</div><h2>The record behind the war</h2><p class="small">The full guide is searchable here. A reference entry does not mean that its rules or scenes are fully simulated.</p><div class="two-col"><input id="atlas-search" type="search" placeholder="Name, dialogue, formula, or source ID"><select id="atlas-category"><option value="">All categories</option>${[...new Set(atlas.map((r) => r.section.split(' / ')[0]))].map((s) => `<option>${esc(s)}</option>`).join('')}</select></div><div id="atlas-results"></div>`,
    true,
  );
  atlasPage = 0;
  atlasResults();
  audio.playMusic('chronicle');
}
function atlasResults() {
  const q = ($('#atlas-search')?.value || '').toLowerCase(),
    c = $('#atlas-category')?.value || '',
    records = atlas.filter((r) => (!c || r.section.startsWith(c)) && JSON.stringify(r).toLowerCase().includes(q));
  const start = atlasPage * 40;
  $('#atlas-results').innerHTML =
    `<p>${records.length} records · Page ${atlasPage + 1} ${btn('atlas-prev', '←')}${btn('atlas-next', '→', start + 40 >= records.length ? 'disabled' : '')}</p><div class="atlas-list">${records
      .slice(start, start + 40)
      .map((r) => btn('record', `<small>${esc(r.section)}</small><b>${esc(r.name)}</b>`, `data-id="${r.id}"`))
      .join('')}</div>`;
}
function record(id) {
  const r = atlas.find((r) => r.id === id);
  if (!r) return;
  showModal(
    'record',
    `<div class="eyebrow">${esc(r.section)}</div><h2>${esc(r.name)}</h2><p class="small">Source ID: ${esc(r.id)} · Guide line ${r.line || r.sourceLine}</p><pre class="source-text">${esc(r.text || r.body || r.content || JSON.stringify(r, null, 2))}</pre>${btn('atlas', 'Back to atlas')}`,
    true,
  );
}
function inspect() {
  const u = engine?.b.units.find((v) => v.id === inspected) || engine?.active;
  if (!u) return;
  showModal(
    'inspect',
    `<div class="eyebrow">FIELD RECORD</div><h2>${esc(u.name)} · ${esc(u.job)}</h2><p>PA ${u.pa} · MA ${u.ma} · Speed ${u.speed}<br>Brave ${u.brave} · Faith ${u.faith} · ${esc(SIGN_NAMES[u.sign])}</p><h3>Equipment</h3>${Object.entries(
      u.equipment,
    )
      .map(([k, id]) => `<p>${k}: ${esc(db.item.get(id)?.name || 'None')}</p>`)
      .join(
        '',
      )}<p>Secondary: ${esc(u.secondary)}<br>Reaction: ${esc(u.reaction)}<br>Support: ${esc(u.support)}<br>Movement: ${esc(u.movement)}</p><h3>Known actions</h3>${engine
      .actions(u)
      .map((a) => `<p><b>${esc(a.name)}</b> · Range ${a.range} · ${a.mp} MP · ${a.ctr} ticks</p>`)
      .join('')}`,
    true,
  );
}
function math() {
  const u = engine.active,
    spells = u.learned.map((id) => db.action.get(id)).filter((a) => a?.calc);
  showModal(
    'math',
    `<h2>Math Skill</h2><p>Calculation affects all matching units, including allies. Learn the spell, attribute, and divisor first.</p><label>Spell<select id="math-spell">${spells.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label><label>Attribute<select id="math-attr">${['CT', 'Level', 'Exp', 'Height'].map((s) => `<option>${s}</option>`).join('')}</select></label><label>Divisor<select id="math-div">${['3', '4', '5', 'Prime'].map((s) => `<option>${s}</option>`).join('')}</select></label>${btn('math-choose', 'Preview', spells.length ? '' : 'disabled', 'primary')}`,
  );
}
function about() {
  showModal(
    'about',
    `<div class="eyebrow">ABOUT THIS EDITION</div><h2>Ashen Zodiac</h2><p>A browser adaptation of the original English PlayStation Final Fantasy Tactics. The supplied unified guide is the source record.</p><p>Generated: 26 September 2026<br>Model: GPT-6 Astra Pro<br>Recovery build: 1.0.1</p><p>${CAMPAIGN.length} main encounters · ${OPTIONAL.length} optional encounters · ${db.jobs.length} generic jobs · ${db.items.length} item records.</p><p class="warning">This is not a source-complete remake. Geometry, story presentation, several formulas, and passive effects are adapted. The atlas preserves reference material that is not fully simulated. Read COMPLETION_REPORT.md for the limits.</p><p>All 3D objects are generated geometry. Music and sounds are authored procedural audio; the external PS1 placeholder tracks of the first build were removed, so the game loads nothing from other sites. No original game executable, ROM or recording is included.</p>${btn('atlas', 'Open source atlas')}${btn('close', 'Return', '', 'primary')}`,
    true,
  );
}
function exportFile() {
  const blob = new Blob([exportSave(state)], { type: 'application/json' }),
    a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'ashen-zodiac-save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function dispatch(action, el) {
  audio?.unlock();
  if (action !== 'mute') audio?.play('select');
  const u = state?.party.find((u) => u.id === unitId);
  switch (action) {
    case 'new':
      newMenu();
      break;
    case 'start': {
      const sign = +$('#new-sign').value,
        difficulty = $('#new-difficulty').value;
      state = createState(db);
      state.party[0].sign = sign;
      state.options.difficulty = difficulty;
      audio.configure(state.options);
      deploy(CAMPAIGN[0]);
      break;
    }
    case 'continue':
      resume();
      break;
    case 'home':
      if (engine)
        showModal(
          'pause',
          `<h2>Pause the chronicle</h2><p>Your current battle will be saved.</p>${btn('save', 'Save now')}${btn('close', 'Resume', '', 'primary')}${btn('title', 'Title screen')}${btn('graphics', 'Graphics & controls')}`,
        );
      else title();
      break;
    case 'title':
      persist();
      modal = '';
      root.innerHTML = '';
      title();
      break;
    case 'world':
      modal = '';
      root.innerHTML = '';
      world();
      break;
    case 'brief':
      brief(el.dataset.id);
      break;
    case 'deploy':
      deploy(el.dataset.id, { rescue: $('#rescue-choice')?.checked ?? true, north: $('#north-choice')?.checked || false });
      break;
    case 'move':
      if (engine.active?.moved) return;
      mode = 'move';
      preview = null;
      cursorTile = { x: engine.active.x, z: engine.active.z };
      view?.highlight([...engine.reachable().values()]);
      renderBattle();
      break;
    case 'act':
      mode = 'actions';
      preview = null;
      renderBattle();
      break;
    case 'ability':
      chooseAbility(el.dataset.id);
      break;
    case 'wait':
      mode = 'facing';
      preview = null;
      renderBattle();
      break;
    case 'face':
      engine.wait(+el.dataset.face);
      reset();
      persist();
      advance();
      break;
    case 'confirm':
      confirmSelection();
      break;
    case 'cancel':
      reset();
      renderBattle();
      break;
    case 'undo':
      if (engine.undoMove()) {
        reset();
        flush();
        persist();
        renderBattle();
      }
      break;
    case 'auto':
      auto = !auto;
      reset();
      advance();
      break;
    case 'tile':
      tileInput(engine.tile(+el.dataset.x, +el.dataset.z));
      break;
    case 'board':
      boardOpen = !boardOpen;
      renderBattle();
      break;
    case 'inspect':
      inspect();
      break;
    case 'log':
      showModal(
        'log',
        `<h2>Battle log</h2>${engine.b.log
          .slice(0, 50)
          .map((t) => `<p>${esc(t)}</p>`)
          .join('')}`,
        true,
      );
      break;
    case 'rotate':
      view.rotate(+el.dataset.step);
      break;
    case 'zoom':
      view.zoomStep(+el.dataset.step * 0.12);
      break;
    case 'graphics':
      kit.menu.open();
      break;
    case 'retry':
    case 'recovery': {
      let saved = recovery;
      if (!saved)
        try {
          saved = importSave(localStorage.getItem('ashen-zodiac-checkpoint'), db);
        } catch {}
      if (!saved) {
        toast('No recovery save is available.');
        return;
      }
      state = copy(saved);
      modal = '';
      root.innerHTML = '';
      world();
      break;
    }
    case 'aftermath':
      aftermath();
      break;
    case 'ending':
      endingPage = 0;
      ending();
      break;
    case 'ending-next':
      if (++endingPage >= ENDING.length) {
        state.endingSeen = true;
        world();
      } else ending();
      break;
    case 'help':
      controls();
      break;
    case 'about':
      about();
      break;
    case 'options':
      options();
      break;
    case 'close':
      close();
      break;
    case 'save':
      persist();
      toast(warned ? 'Export a backup; local storage is blocked.' : 'Chronicle saved.');
      break;
    case 'export':
      exportFile();
      break;
    case 'import':
      $('#save-file').click();
      break;
    case 'mute':
      state.options.mute = !state.options.mute;
      audio.configure(state.options);
      persist();
      toast(state.options.mute ? 'Sound off.' : 'Sound on.');
      break;
    case 'fullscreen':
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available in this browser.'));
      break;
    case 'formation':
      formation();
      break;
    case 'unit':
      unitId = el.dataset.id;
      formation();
      break;
    case 'select-unit': {
      const id = el.dataset.id;
      if (state.selected.includes(id)) {
        if (state.party.find((u) => u.id === id)?.name === 'Ramza') {
          toast('Ramza must remain in the field company.');
          return;
        }
        state.selected = state.selected.filter((x) => x !== id);
      } else if (state.selected.length < 5) state.selected.push(id);
      else toast('Select no more than five units.');
      persist();
      formation();
      break;
    }
    case 'learn': {
      const r = learn(db, u, el.dataset.id, state.chapter);
      if (!r.ok) toast(r.reason);
      else {
        audio.play('learn');
        persist();
        formation();
      }
      break;
    }
    case 'drill':
      if (trainJob(db, state, u)) {
        persist();
        formation();
      }
      break;
    case 'hire':
      showModal(
        'hire',
        `<h2>Hire a soldier</h2><label>Name<input id="hire-name" maxlength="20" value="Recruit"></label><label>Type<select id="hire-sex"><option value="M">Male</option><option value="F">Female</option></select></label>${btn('hire-confirm', 'Hire · 500 gil', '', 'primary')}`,
      );
      break;
    case 'hire-confirm':
      if (hire(db, state, $('#hire-name').value, $('#hire-sex').value)) {
        persist();
        formation();
      } else toast('Not enough gil or roster space.');
      break;
    case 'shop':
      shopMode = 'shop';
      shop();
      break;
    case 'shop-tab':
      shopMode = el.dataset.tab;
      shop();
      break;
    case 'buy':
      if (shopMode === 'sell' ? sellItem(db, state, el.dataset.id) : buyItem(db, state, el.dataset.id, 1, shopMode)) {
        persist();
        shop();
      } else toast('Not enough currency.');
      break;
    case 'tavern':
      tavern();
      break;
    case 'rumor':
      takeRumor(db, state, el.dataset.id);
      persist();
      tavern();
      break;
    case 'day':
      advanceDays(db, state);
      persist();
      tavern();
      break;
    case 'dispatch':
      if (!dispatchUnit(state, el.dataset.id, $('#dispatch-' + el.dataset.id)?.value)) toast('The dispatch cannot start.');
      persist();
      tavern();
      break;
    case 'atlas':
      await openAtlas();
      break;
    case 'record':
      record(el.dataset.id);
      break;
    case 'atlas-prev':
      atlasPage = Math.max(0, atlasPage - 1);
      atlasResults();
      break;
    case 'atlas-next':
      atlasPage++;
      atlasResults();
      break;
    case 'math':
      math();
      break;
    case 'math-choose': {
      const id = `math:${$('#math-spell').value}:${$('#math-attr').value}:${$('#math-div').value}`;
      chooseAbility(id);
      preview = engine.tile(engine.active.x, engine.active.z);
      renderBattle();
      break;
    }
  }
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  dispatch(el.dataset.action, el).catch(error);
});
document.addEventListener('change', (e) => {
  try {
    const el = e.target;
    if (el.dataset.option) {
      const k = el.dataset.option;
      state.options[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' || k === 'speed' ? +el.value : el.value;
      audio.configure(state.options);
      persist();
    } else if (el.id === 'job-select') {
      changeJob(
        db,
        state,
        state.party.find((u) => u.id === unitId),
        el.value,
      );
      persist();
      formation();
    } else if (el.dataset.slot) {
      state.party.find((u) => u.id === unitId)[el.dataset.slot] = el.value;
      persist();
      formation();
    } else if (el.dataset.equip) {
      const u = state.party.find((u) => u.id === unitId),
        slot = el.dataset.equip;
      if (!el.value) {
        if (u.equipment[slot]) state.inventory[u.equipment[slot]] = (state.inventory[u.equipment[slot]] || 0) + 1;
        u.equipment[slot] = null;
      } else {
        const r = equipItem(db, state, u, el.value, slot);
        if (!r.ok) toast(r.reason);
      }
      persist();
      formation();
    } else if (el.id === 'atlas-category') {
      atlasPage = 0;
      atlasResults();
    }
  } catch (err) {
    error(err);
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'atlas-search') {
    atlasPage = 0;
    atlasResults();
  }
  if (e.target.id === 'shop-search') {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('[data-filter]').forEach((el) => (el.hidden = !el.dataset.filter.includes(q)));
  }
});
$('#save-file').addEventListener('change', async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8e6) throw Error('Save file is too large.');
    const next = importSave(await file.text(), db);
    state = next;
    audio.configure(state.options);
    persist();
    resume();
  } catch (err) {
    error(err);
  }
  e.target.value = '';
});
// ---- Keyboard, mouse, controller and touch all arrive as kit.input actions.
const INPUT = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' }, // menu focus and the tile cursor
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' }, // turn the camera
  confirm: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['KeyK', 'Backspace', 'ShiftLeft', 'ShiftRight'], gamepad: ['B', 'LT'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  rotateLeft: { keys: ['KeyQ'] },
  rotateRight: { keys: ['KeyE'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  commandMove: { keys: ['Digit1', 'Numpad1'] },
  commandAct: { keys: ['Digit2', 'Numpad2'] },
  commandWait: { keys: ['Digit3', 'Numpad3'] },
};
let padNav = false,
  cursorTile = null,
  wasTileMode = false,
  diagnosticsText = '';
const focusKeys = { app: '', modal: '' };
const repeat = createRepeater();
/** Focus rings show while the player steers by keys or controller, and hide on the next click or tap. */
function setPadNav(on) {
  if (padNav === on) return;
  padNav = on;
  document.body.classList.toggle('pad-nav', on);
}
document.addEventListener('pointerdown', () => setPadNav(false), true);
const navScope = () => (modal ? root.querySelector('.modal') : app);
function playerTurn() {
  const u = engine?.active;
  return !!u && u.team === 0 && !u.guest && teamOf(u) === 0 && !auto && !busy;
}
/** Choosing a tile for a move or an action: the D-pad steers the tile cursor. */
const tileMode = () => screen === 'battle' && !modal && !boardOpen && playerTurn() && (mode === 'move' || mode === 'target');
function preferred(scope) {
  const list = focusables(scope),
    find = (test) => list.find(test);
  // Menus land on their main choice; Options, whose main button is Return, lands on its first setting.
  if (modal)
    return (modal !== 'options' && find((el) => el.matches('.primary'))) || find((el) => !el.matches('.close')) || list[0];
  if (screen === 'battle')
    return (
      (boardOpen && (find((el) => el.matches('.board .legal')) || find((el) => el.matches('.board button')))) ||
      find((el) => el.matches('.command-card button')) ||
      find((el) => el.matches('.camera-controls button')) ||
      list[0]
    );
  return find((el) => el.matches('.primary')) || find((el) => !el.closest('header')) || list[0];
}
/** Keep keyboard/controller focus inside the current menu when it re-renders. */
function keepFocus(scope) {
  if (!scope) return;
  const el = document.activeElement,
    name = modal ? 'modal' : 'app';
  if (el && el !== document.body && scope.contains(el)) {
    focusKeys[name] = focusKey(el);
    return;
  }
  if (!padNav || tileMode() || (screen === 'battle' && !modal && !playerTurn())) return;
  focus(findByKey(scope, focusKeys[name]) || preferred(scope));
}
function showRange() {
  if (mode === 'move') view.highlight([...engine.reachable().values()]);
  else if (mode === 'target' && selectedAction)
    view.highlight(
      engine.b.grid.tiles.filter((t) => inRange(db, engine.active, selectedAction, t)),
      'area',
    );
}
function moveCursor([sx, sy]) {
  if (!cursorTile) cursorTile = { x: engine.active.x, z: engine.active.z };
  const [gx, gz] = view.gridStep(sx, -sy);
  for (let n = 1; n <= Math.max(engine.b.grid.width, engine.b.grid.height); n++) {
    const t = engine.tile(cursorTile.x + gx * n, cursorTile.z + gz * n);
    if (!t) return;
    if (t.blocked) continue;
    cursorTile = { x: t.x, z: t.z };
    audio.play('move');
    const v = unitAt(engine.b, t.x, t.z);
    if ((v?.id ?? null) !== inspected) {
      inspected = v?.id ?? null;
      renderBattle();
    }
    return;
  }
}
/** Back (B, K): close a menu, step back from a chosen tile, or cancel the command. */
function goBack() {
  if (modal) return close();
  if (screen !== 'battle' || !engine) return;
  if (boardOpen) {
    boardOpen = false;
    return renderBattle();
  }
  if (preview && (mode === 'move' || mode === 'target') && !selectedAction?.self) {
    preview = null;
    showRange();
    return renderBattle();
  }
  if (mode !== 'idle') {
    reset();
    renderBattle();
  }
}
/** Pause (Esc, P, Start): close a menu, cancel a command, or open the pause menu. */
function pauseMenu() {
  if (modal) return close();
  if (screen === 'battle' && engine) {
    if (mode !== 'idle') {
      reset();
      return renderBattle();
    }
    return dispatch('home', { dataset: {} }).catch(error);
  }
  options();
}
function steer(dt) {
  const input = kit.input,
    dir = repeat(input.vector('move'), dt),
    confirm = input.pressed('confirm'),
    back = input.pressed('back'),
    pause = input.pressed('pause');
  if (dir || confirm || back) setPadNav(true);
  if (pause) return pauseMenu();
  if (back) return goBack();
  if (!modal) {
    if (input.pressed('rotateLeft')) view.rotate(-1);
    if (input.pressed('rotateRight')) view.rotate(1);
    if (input.pressed('zoomIn')) view.zoomStep(0.1);
    if (input.pressed('zoomOut')) view.zoomStep(-0.1);
    if (screen === 'battle' && playerTurn()) {
      const command = input.pressed('commandMove') ? 'move' : input.pressed('commandAct') ? 'act' : input.pressed('commandWait') ? 'wait' : '';
      if (command) return dispatch(command, { dataset: {} }).catch(error);
    }
  }
  const scope = navScope(),
    choosing = tileMode() && !preview;
  if (choosing && !wasTileMode && app.contains(document.activeElement)) document.activeElement.blur();
  wasTileMode = choosing;
  if (choosing) {
    if (dir) moveCursor(dir);
    if (confirm) {
      cursorTile ??= { x: engine.active.x, z: engine.active.z };
      tileInput(engine.tile(cursorTile.x, cursorTile.z));
    }
    return;
  }
  const el = document.activeElement,
    focused = el && el !== document.body && scope?.contains(el) ? el : null;
  if (dir) {
    if (!focused) focus(findByKey(scope, focusKeys[modal ? 'modal' : 'app']) || preferred(scope));
    else if (!(dir[0] && adjust(focused, dir[0]))) focus(neighbour(scope, focused, dir[0], dir[1]));
  }
  if (confirm) {
    if (focused) activate(focused);
    else if (tileMode() && preview) confirmSelection();
    else focus(preferred(scope));
  }
  // An activated control may have opened or closed a menu: look the scope up again.
  keepFocus(navScope());
}
function frame(dt, t) {
  steer(dt);
  view.setCursor(padNav && tileMode() ? cursorTile : null);
  view.handleInput(kit.input, !modal);
  view.update(dt, t);
}
function diagnostics(d) {
  const text = `${d.backend} · ${d.preset} · ${d.ms > 0 ? d.ms.toFixed(1) + ' ms' : 'measuring'} · ${d.bodies} bodies`;
  if (text !== diagnosticsText) $('#diagnostics').textContent = diagnosticsText = text;
}
async function boot() {
  const catalog = data('data/catalog.json'); // download while the renderer starts
  kit = await bootKit({
    title: 'Ashen Zodiac',
    physics: true, // Rapier 0.20 for the hit debris
    mount: $('#stage'),
    gear: 'none', // Options and the pause menu open the kit's settings panel (also F9)
    input: INPUT,
    accent: '#d8bd82',
    background: '#182838',
  });
  kit.loading.progress(0.7, 'Opening the chronicle…');
  db = makeDB(await catalog);
  state = loadLocal(db) || createState(db);
  audio = new AudioManager(state.options);
  kit.onPause((paused) => {
    audio.setPaused(paused);
    if (!paused && screen === 'battle' && !modal) advance();
  });
  view = new Stage(kit, db, tileInput, diagnostics);
  title();
  kit.start(frame);
  globalThis.__AZ_TEST__ = {
    get db() {
      return db;
    },
    get state() {
      return state;
    },
    get engine() {
      return engine;
    },
    get view() {
      return view;
    },
    deploy,
    world,
    advance,
    setState(s) {
      state = s;
    },
    resume,
  };
}
boot().catch((e) => {
  app.innerHTML = `<section class="loading"><h1>The chronicle could not open</h1><p>${esc(e.message)}</p><p>Reload the page to try again.</p></section>`;
  error(e);
});
