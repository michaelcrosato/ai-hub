// The HUD and every menu, as plain DOM over the 3D canvas. Panels rebuild only
// when what they show changes; meters and the battle log update in place so
// their transitions still play. Menus are driven by mouse, touch, keyboard
// and gamepad alike (see navMove / navConfirm).

import { MAPS, ITEMS, SPELLS, ENEMIES, SHOPS, STORY, QUESTS, CREDITS, CHALLENGE, xpForLevel } from './data.js';
import { stats, formatTime, latestSave, SAVE_SLOTS } from './game.js';

// ---- tiny DOM helper ----------------------------------------------------------

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'nav') el.dataset.nav = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'disabled' || k === 'autofocus') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// ---- prompts per input device ---------------------------------------------------

const PROMPTS = {
  keyboard: { confirm: 'Z', back: 'X', menu: 'Esc', tabs: 'Q / R' },
  gamepad: { confirm: 'A', back: 'B', menu: 'Start', tabs: 'LB / RB' },
  touch: { confirm: 'Tap', back: 'Tap', menu: 'Menu', tabs: 'Tap' },
};
const CONTROL_HELP = [
  ['Move', 'WASD / arrows', 'Left stick / D-pad', 'Stick (left side)'],
  ['Walk to a spot', 'Click a tile', '—', 'Tap the ground'],
  ['Talk / open / confirm', 'Z, E, Space, Enter', 'A', 'A button / tap'],
  ['Back', 'X, K, Backspace, right click', 'B', 'Back / Resume buttons'],
  ['Menu', 'Esc, M, P', 'Start', 'Menu pill'],
  ['Menu tabs', 'Q / R', 'LB / RB', 'Tap a tab'],
  ['Zoom (field)', 'Wheel, - / =', 'LB / RB', 'Pinch'],
  ['Graphics settings', 'F9', 'Menu › Settings', 'Menu › Settings'],
];

const TABS = ['party', 'items', 'gear', 'magic', 'quests', 'bestiary', 'atlas', 'save', 'settings'];
const SPEED_LABEL = { slow: 'Leisurely', normal: 'Normal', fast: 'Instant' };
const ZOOMS = [0.75, 1, 1.25, 1.5];

export function createUI({ root, game, kit, world, actions }) {
  const shell = h('main', { class: 'game-shell', 'data-renderer': kit.backendLabel });
  root.append(shell);

  const slots = {};
  const keys = {};
  /** Put a panel in its slot, rebuilding only when its key changes. */
  function panel(name, key, build) {
    if (key === null) {
      if (slots[name]) {
        slots[name].remove();
        slots[name] = null;
        keys[name] = null;
      }
      return null;
    }
    if (keys[name] === key && slots[name]) return slots[name];
    const old = slots[name];
    const active = document.activeElement;
    const focusKey = old && old.contains(active) ? active.dataset.nav : null;
    const navClass = !!active?.classList?.contains('nav-focus');
    const scrolls = {};
    if (old) for (const el of old.querySelectorAll('[data-scroll]')) scrolls[el.dataset.scroll] = el.scrollTop;
    const el = build();
    if (old) old.replaceWith(el);
    else shell.append(el);
    slots[name] = el;
    keys[name] = key;
    for (const s of el.querySelectorAll('[data-scroll]')) if (scrolls[s.dataset.scroll]) s.scrollTop = scrolls[s.dataset.scroll];
    if (focusKey) {
      const next = el.querySelector(`[data-nav="${CSS.escape(focusKey)}"]`);
      if (next && !next.disabled) {
        next.focus({ preventScroll: true });
        if (navClass) next.classList.add('nav-focus');
      } else ui.focusDefault(true);
    }
    return el;
  }

  const P = () => PROMPTS[kit.input.source] || PROMPTS.keyboard;
  const kbd = (text) => h('kbd', null, text);

  // ---- persistent HUD

  const hud = {
    el: null,
    build() {
      const lv = h('strong', null, '1');
      const hpBar = h('i');
      const mpBar = h('i');
      const hpVal = h('b', null, '0');
      const mpVal = h('b', null, '0');
      const gold = h('span', { class: 'gold-chip' }, '◆ 0');
      const mapName = h('strong');
      const mapSub = h('small');
      this.el = h(
        'header',
        { class: 'hud-top' },
        h('div', { class: 'location-plate' }, h('span', { class: 'map-glyph' }, '✦'), h('div', null, mapName, mapSub)),
        h(
          'div',
          { class: 'vitals-card' },
          h('div', { class: 'hero-level' }, h('span', null, 'LV'), lv),
          h(
            'div',
            { class: 'meter-stack' },
            h('div', { class: 'meter-row' }, h('span', null, 'HP'), h('div', { class: 'meter hp' }, hpBar), hpVal),
            h('div', { class: 'meter-row' }, h('span', null, 'MP'), h('div', { class: 'meter mp' }, mpBar), mpVal),
          ),
          gold,
        ),
      );
      this.parts = { lv, hpBar, mpBar, hpVal, mpVal, gold, mapName, mapSub };
      this.last = {};
      shell.append(this.el);
    },
    update(s) {
      if (!s) {
        if (this.el) this.el.hidden = true;
        return;
      }
      if (!this.el) this.build();
      this.el.hidden = s.mode === 'credits';
      const st = stats(s.player);
      const m = MAPS[s.mapId];
      const set = (k, v, fn) => {
        if (this.last[k] !== v) {
          this.last[k] = v;
          fn(v);
        }
      };
      const p = this.parts;
      set('lv', s.player.level, (v) => (p.lv.textContent = v));
      set('hp', `${s.player.hp}/${st.maxHp}`, () => {
        p.hpVal.textContent = s.player.hp;
        p.hpBar.style.width = `${Math.max(0, (s.player.hp / st.maxHp) * 100)}%`;
      });
      set('mp', `${s.player.mp}/${st.maxMp}`, () => {
        p.mpVal.textContent = s.player.mp;
        p.mpBar.style.width = `${Math.max(0, (s.player.mp / st.maxMp) * 100)}%`;
      });
      set('lowhp', s.player.hp > 0 && s.player.hp <= st.maxHp * 0.25, (v) => this.el.classList.toggle('low-hp', v));
      set('gold', s.player.gold, (v) => (p.gold.textContent = `◆ ${v}`));
      set('map', m.id, () => {
        p.mapName.textContent = m.name;
        p.mapSub.textContent = m.subtitle;
      });
    },
  };

  // ---- objective card
  const objective = {
    el: null,
    update(s) {
      const show = !!s && s.mode === 'field';
      if (!show) {
        if (this.el) this.el.hidden = true;
        return;
      }
      if (!this.el) {
        this.pct = h('b');
        this.text = h('p');
        this.bar = h('i');
        this.el = h('div', { class: 'objective-card' }, h('div', { class: 'objective-label' }, h('span', null, 'Main quest'), this.pct), this.text, h('div', { class: 'story-progress' }, this.bar));
        shell.append(this.el);
      }
      this.el.hidden = false;
      const pct = Math.min(100, Math.round((s.storyStage / 8) * 100));
      if (this.stage !== s.storyStage) {
        this.stage = s.storyStage;
        this.pct.textContent = `${pct}%`;
        this.text.textContent = STORY[s.storyStage];
        this.bar.style.width = `${pct}%`;
      }
    },
  };

  // ---- nametag: who you are facing, and what A does
  const tag = {
    el: null,
    key: '',
    pos: { x: 0, y: 0 },
    update(s) {
      const t = s && s.mode === 'field' ? game.facingTarget() : null;
      if (!t) {
        if (this.el) this.el.hidden = true;
        this.key = '';
        actions.setConfirmLabel('A');
        return;
      }
      if (!this.el) {
        this.el = h('div', { class: 'nametag', 'aria-hidden': 'true' });
        shell.append(this.el);
      }
      let name;
      let verb;
      if (t.kind === 'npc') {
        name = t.npc.name;
        verb = t.npc.role === 'shop' ? 'Shop' : t.npc.role === 'inn' ? 'Rest' : 'Talk';
      } else if (t.kind === 'chest') {
        name = t.opened ? 'Empty chest' : 'Chest';
        verb = t.opened ? 'Look' : 'Open';
      } else if (t.kind === 'boss') {
        name = ENEMIES[t.boss.enemyId].name;
        verb = 'Face';
      } else {
        name = t.prop.kind === 'well' ? 'Old well' : t.prop.kind === 'crystal' ? 'Skyglass' : 'Bell frame';
        verb = 'Look';
      }
      const key = `${name}|${verb}|${kit.input.source}`;
      if (key !== this.key) {
        this.key = key;
        this.el.replaceChildren(h('strong', null, name), h('span', null, kbd(P().confirm === 'Tap' ? 'A' : P().confirm), ` ${verb}`));
        actions.setConfirmLabel(verb);
      }
      const at = world.project(t.x, t.y, 2.05, this.pos);
      this.el.hidden = !at;
      if (at) {
        const x = Math.round(at.x);
        const y = Math.round(at.y);
        if (x !== this.x || y !== this.y) {
          this.x = x;
          this.y = y;
          this.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        }
      }
    },
  };

  // ---- panels

  function titlePanel() {
    const saves = game.ui.saves;
    const latest = latestSave(saves);
    const view = ui.titleView;
    const any = Object.values(saves).some(Boolean);
    const card =
      view === 'name'
        ? h(
            'form',
            {
              class: 'name-card',
              onsubmit: (e) => {
                e.preventDefault();
                actions.begin(ui.heroName);
              },
            },
            h('label', { for: 'hero-name' }, 'What is the courier called?'),
            h('input', {
              id: 'hero-name',
              nav: 'title:name',
              value: ui.heroName,
              maxlength: 12,
              autocomplete: 'off',
              spellcheck: 'false',
              oninput: (e) => (ui.heroName = e.target.value),
              onkeydown: (e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  ui.setTitleView('main');
                }
              },
            }),
            h(
              'div',
              { class: 'inline-actions' },
              h('button', { type: 'button', class: 'ghost-button', nav: 'title:back', onclick: () => ui.setTitleView('main') }, 'Back'),
              h('button', { type: 'submit', class: 'primary-button', nav: 'title:begin' }, 'Begin'),
            ),
          )
        : view === 'load'
          ? h(
              'div',
              { class: 'name-card load-card' },
              h('label', null, 'Choose a journey'),
              h(
                'div',
                { class: 'load-list' },
                ['auto', ...SAVE_SLOTS].map((slot) => {
                  const s = saves[slot];
                  return h(
                    'button',
                    { class: 'load-slot', nav: `title:slot:${slot}`, disabled: !s, onclick: () => actions.load(slot) },
                    h('span', { class: 'slot-number' }, slot === 'auto' ? 'A' : slot),
                    h(
                      'span',
                      null,
                      h('strong', null, s ? `${s.state.player.name} · Lv ${s.state.player.level}` : 'Empty slot'),
                      h('small', null, s ? `${MAPS[s.state.mapId].name} · ${formatTime(s.state.playSeconds)}${slot === 'auto' ? ' · autosave' : ''}` : 'A blank page in the roadbook'),
                    ),
                  );
                }),
              ),
              h('div', { class: 'inline-actions' }, h('button', { type: 'button', class: 'ghost-button', nav: 'title:back', onclick: () => ui.setTitleView('main') }, 'Back')),
            )
          : h(
              'div',
              { class: 'title-actions' },
              h(
                'button',
                {
                  class: 'primary-button',
                  nav: 'title:new',
                  onclick: () => {
                    actions.unlockAudio();
                    actions.sfx(520, 0.06);
                    ui.setTitleView('name');
                  },
                },
                'New journey',
              ),
              h(
                'button',
                { class: 'secondary-button', nav: 'title:continue', disabled: !latest, onclick: () => latest && actions.load(latest[0]) },
                'Continue ',
                latest ? `· Lv ${latest[1].state.player.level} · ${MAPS[latest[1].state.mapId].name}` : '',
              ),
              any && h('button', { class: 'ghost-button', nav: 'title:load', onclick: () => ui.setTitleView('load') }, 'Load journey'),
              h('button', { class: 'ghost-button', nav: 'title:settings', onclick: () => actions.openKitSettings() }, 'Graphics & controls'),
            );
    const src = kit.input.source;
    const footer =
      src === 'gamepad'
        ? ['Move stick / D-pad', 'Act A', 'Back B', 'Menu Start']
        : src === 'touch'
          ? ['Move with the stick', 'A to act', 'Tap the ground to walk']
          : ['Move WASD / arrows', 'Act Z / E', 'Menu X / M', 'Click a tile to walk'];
    return h(
      'section',
      { class: 'title-screen', 'aria-label': 'Crown of Emberfall title screen' },
      h('div', { class: 'title-sun', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      h('p', { class: 'eyebrow' }, 'A complete pocket role-playing adventure'),
      h('h1', null, h('span', null, 'Crown of'), ' Emberfall'),
      h('p', { class: 'title-deck' }, 'Three living flames. One endless dusk. A road that still remembers morning.'),
      card,
      h(
        'div',
        { class: 'content-contract', 'aria-label': 'Game content' },
        ['9 regions', '22 foes', '8 spells', '5 side quests', 'complete ending'].map((t) => h('span', null, t)),
      ),
      h('div', { class: 'title-footer' }, footer.map((t) => h('span', null, t)), h('span', null, kit.backendLabel)),
    );
  }

  function dialoguePanel(s) {
    const d = s.dialogue;
    ui.dialogueText = h('span');
    return h(
      'button',
      { class: 'dialogue-wrap', 'aria-label': 'Advance dialogue', onclick: () => game.advanceDialogue() },
      h('div', { class: 'speaker-tag' }, d.speaker),
      h('p', null, ui.dialogueText, h('span', { class: 'cursor-block' })),
      h('div', { class: 'dialogue-meta' }, h('span', null, `${d.index + 1} / ${d.pages.length}`), h('span', null, 'Continue ', kbd(P().confirm))),
    );
  }

  // Combat: a persistent frame; actions and the log rebuild when they change.
  const combat = { el: null, key: '' };
  function combatUpdate(s) {
    if (!s || s.mode !== 'combat' || !s.combat) {
      if (combat.el) {
        combat.el.remove();
        combat.el = null;
        combat.key = '';
        combat.actionsKey = '';
        combat.logKey = '';
      }
      return;
    }
    const c = s.combat;
    const e = ENEMIES[c.enemyId];
    const key = `${c.enemyId}|${c.maxHp}`;
    if (!combat.el || combat.key !== key) {
      combat.el?.remove();
      combat.key = key;
      combat.label = h('span');
      combat.hp = h('i');
      combat.log = h('div', { class: 'battle-log', 'aria-live': 'polite' });
      combat.actions = h('div', { class: 'battle-actions' });
      combat.el = h(
        'section',
        { class: 'combat-ui', 'aria-label': `Battle with ${e.name}` },
        h('div', { class: 'enemy-card' }, h('div', null, combat.label, h('strong', null, e.name)), h('div', { class: 'enemy-hp' }, combat.hp)),
        h('div', { class: 'battle-console' }, combat.log, combat.actions),
      );
      shell.append(combat.el);
      combat.actionsKey = '';
      combat.logKey = '';
    }
    combat.label.textContent = e.boss ? `BOSS · PHASE ${c.phase}` : `LEVEL ${e.level}`;
    combat.hp.style.width = `${(c.hp / c.maxHp) * 100}%`;
    const logKey = c.log.join('\n');
    if (logKey !== combat.logKey) {
      combat.logKey = logKey;
      combat.log.replaceChildren(...c.log.slice(-3).map((line) => h('p', null, line)));
    }
    combat.actions.classList.toggle('is-busy', !!c.busy);
    const p = s.player;
    const known = Object.values(SPELLS).filter((sp) => p.level >= sp.level);
    const usable = Object.entries(p.inventory).filter(([id, n]) => n > 0 && ITEMS[id].kind === 'consumable');
    const view = game.ui.combatView;
    const aKey = `${view}|${p.mp}|${p.level}|${usable.map(([id, n]) => id + n).join(',')}|${e.boss}`;
    if (aKey === combat.actionsKey) return;
    combat.actionsKey = aKey;
    const active = document.activeElement;
    const focusKey = combat.actions.contains(active) ? active.dataset.nav : null;
    const navClass = !!active?.classList?.contains('nav-focus');
    const kids = [];
    if (view === 'root') {
      kids.push(
        h('button', { nav: 'b:attack', onclick: () => game.combatAction('attack') }, h('span', null, '⚔'), 'Attack'),
        h('button', { nav: 'b:magic', disabled: !known.length, onclick: () => ui.combatView('spells') }, h('span', null, '✦'), 'Magic'),
        h('button', { nav: 'b:item', onclick: () => ui.combatView('items') }, h('span', null, '◇'), 'Item'),
        h('button', { nav: 'b:guard', onclick: () => game.combatAction('defend') }, h('span', null, '⬡'), 'Guard'),
        h('button', { nav: 'b:run', disabled: !!e.boss, onclick: () => game.combatAction('run') }, h('span', null, '➜'), 'Run'),
      );
    } else if (view === 'spells') {
      kids.push(
        h(
          'div',
          { class: 'action-list', 'data-scroll': 'spells' },
          known.map((sp) =>
            h(
              'button',
              { nav: `b:spell:${sp.id}`, disabled: p.mp < sp.mp || (sp.kind === 'escape' && e.boss), onclick: () => game.combatAction('spell', sp.id) },
              h('span', null, sp.name),
              h('b', null, `${sp.mp} MP`),
              h('small', null, sp.description),
            ),
          ),
          h('button', { class: 'back-action', nav: 'b:back', onclick: () => ui.combatView('root') }, '← Back'),
        ),
      );
    } else {
      kids.push(
        h(
          'div',
          { class: 'action-list', 'data-scroll': 'items' },
          usable.map(([id, n]) =>
            h(
              'button',
              { nav: `b:item:${id}`, disabled: id === 'smoke_pod' && e.boss, onclick: () => game.combatAction('item', id) },
              h('span', null, ITEMS[id].name),
              h('b', null, `×${n}`),
              h('small', null, ITEMS[id].description),
            ),
          ),
          !usable.length && h('p', { class: 'empty-state' }, 'Your pack holds no battle items.'),
          h('button', { class: 'back-action', nav: 'b:back', onclick: () => ui.combatView('root') }, '← Back'),
        ),
      );
    }
    combat.actions.replaceChildren(...kids);
    if (focusKey) {
      const next = combat.actions.querySelector(`[data-nav="${CSS.escape(focusKey)}"]`);
      if (next && !next.disabled) {
        next.focus({ preventScroll: true });
        if (navClass) next.classList.add('nav-focus');
      } else ui.focusDefault(true);
    } else if (ui.navActive()) ui.focusDefault(true);
  }

  function statCell(label, value) {
    return h('div', null, h('span', null, label), h('b', null, value));
  }

  function menuPage(s) {
    const p = s.player;
    const st = stats(p);
    const inv = Object.entries(p.inventory).filter(([, n]) => n > 0);
    const tab = game.ui.menuTab;
    const pct = Math.min(100, Math.round((s.storyStage / 8) * 100));
    if (tab === 'party')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Sole traveler'),
        h('h2', null, p.name),
        h('p', { class: 'page-intro' }, 'A royal courier carrying the free spark of a broken crown.'),
        h(
          'div',
          { class: 'stat-grid' },
          statCell('Level', p.level),
          statCell('Experience', p.xp),
          statCell('Next level', p.level >= 20 ? 'MAX' : `${Math.max(0, xpForLevel(p.level + 1) - p.xp)} XP`),
          statCell('Steps', s.steps),
          statCell('Attack', st.attack),
          statCell('Defense', st.defense),
          statCell('Agility', st.agility),
          statCell('Journey', formatTime(s.playSeconds)),
        ),
        h(
          'div',
          { class: 'equipment-strip' },
          ['weapon', 'armor', 'charm'].map((slot) => h('div', null, h('span', null, slot), h('strong', null, p.equipment[slot] ? ITEMS[p.equipment[slot]].name : '—'))),
        ),
      );
    if (tab === 'items')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Travel pack'),
        h('h2', null, 'Items'),
        h(
          'div',
          { class: 'item-grid' },
          inv.map(([id, n]) => {
            const it = ITEMS[id];
            return h(
              'article',
              { class: `item-card ${it.kind}` },
              h('div', null, h('span', { class: 'item-type' }, it.kind), h('strong', null, it.name), h('p', null, it.description)),
              h(
                'div',
                { class: 'item-footer' },
                h('b', null, `×${n}`),
                it.kind === 'consumable' && !it.battleOnly && h('button', { nav: `use:${id}`, onclick: () => game.useItem(id) }, 'Use'),
              ),
            );
          }),
          !inv.length && h('p', { class: 'page-intro' }, 'Your pack is empty.'),
        ),
      );
    if (tab === 'gear')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Ready for the road'),
        h('h2', null, 'Equipment'),
        h(
          'div',
          { class: 'gear-list' },
          inv
            .filter(([id]) => ['weapon', 'armor', 'charm'].includes(ITEMS[id].kind))
            .map(([id]) => {
              const it = ITEMS[id];
              const on = Object.values(p.equipment).includes(id);
              return h(
                'button',
                { class: on ? 'equipped' : '', nav: `equip:${id}`, onclick: () => game.equip(id) },
                h('div', null, h('span', null, it.kind), h('strong', null, it.name), h('small', null, it.description)),
                h('b', null, on ? 'Equipped' : 'Equip'),
              );
            }),
        ),
      );
    if (tab === 'magic')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Sparkcraft'),
        h('h2', null, 'Magic'),
        h(
          'div',
          { class: 'spellbook' },
          Object.values(SPELLS).map((sp) => {
            const known = p.level >= sp.level;
            return h(
              'article',
              { class: known ? '' : 'locked' },
              h('div', { class: 'spell-rune' }, '✦'),
              h('div', null, h('strong', null, known ? sp.name : `Unlock at level ${sp.level}`), h('p', null, known ? sp.description : "A dormant line in the courier's spark.")),
              h('b', null, `${sp.mp} MP`),
            );
          }),
        ),
      );
    if (tab === 'quests')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'What calls you onward'),
        h('h2', null, 'Quest log'),
        h(
          'article',
          { class: 'main-quest-card' },
          h('span', null, `Main story · ${pct}%`),
          h('strong', null, STORY[s.storyStage]),
          h('div', { class: 'story-progress' }, h('i', { style: `width:${pct}%` })),
        ),
        h(
          'div',
          { class: 'quest-list' },
          Object.entries(QUESTS).map(([id, q]) => {
            const status = s.quests[id] ?? 'locked';
            return h(
              'article',
              { class: status },
              h('span', null, status),
              h('strong', null, status === 'locked' ? 'Unfound rumor' : q.name),
              h('p', null, status === 'locked' ? q.unlockHint ?? `Speak with ${q.giver}.` : q.description),
              status !== 'locked' && h('small', null, `Reward · ${q.reward}`),
            );
          }),
        ),
      );
    if (tab === 'bestiary') {
      const all = Object.values(ENEMIES);
      const seen = all.filter((e) => s.defeated[e.id]);
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Field notes'),
        h('h2', null, 'Bestiary'),
        h('p', { class: 'page-intro' }, `${seen.length} of ${all.length} foes recorded. Defeat a foe to add its page.`),
        h(
          'div',
          { class: 'item-grid bestiary' },
          all.map((e) => {
            const n = s.defeated[e.id] ?? 0;
            if (!n) return h('article', { class: 'item-card locked' }, h('div', null, h('span', { class: 'item-type' }, e.boss ? 'boss' : '???'), h('strong', null, '???'), h('p', null, 'Not yet recorded.')));
            return h(
              'article',
              { class: `item-card ${e.boss ? 'key' : ''}` },
              h(
                'div',
                null,
                h('span', { class: 'item-type' }, `${e.boss ? 'boss · ' : ''}${e.family}`),
                h('strong', null, e.name),
                h('p', null, `Lv ${e.level} · HP ${e.maxHp} · ATK ${e.attack} · DEF ${e.defense} · AGI ${e.agility}`),
                h('p', null, `${e.xp} XP · ${e.gold}G${e.resistFire ? ` · resists fire ${Math.round(e.resistFire * 100)}%` : ''}${e.charge ? ` · ${e.charge.name}` : ''}`),
              ),
              h('div', { class: 'item-footer' }, h('b', null, `×${n}`)),
            );
          }),
        ),
      );
    }
    if (tab === 'atlas')
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'A kingdom in motion'),
        h('h2', null, 'Atlas'),
        h(
          'div',
          { class: 'atlas-map' },
          h('div', { class: 'atlas-route' }),
          Object.values(MAPS).map((m, i) => {
            const known = (m.recommendedLevel ?? 1) <= p.level + 5 || m.type === 'town' || m.id === 'emberfall';
            return h(
              'article',
              { class: `${known ? '' : 'unknown'}${m.id === s.mapId ? ' here' : ''}`, style: `--i:${i}` },
              h('span', null, m.id === s.mapId ? `${m.type} · you are here` : m.type),
              h('strong', null, known ? m.name : 'Unknown'),
              h('small', null, known ? m.subtitle : 'Beyond the next Ember'),
              m.recommendedLevel && h('b', null, `Lv ${m.recommendedLevel}+`),
            );
          }),
        ),
      );
    if (tab === 'save') {
      const saves = game.ui.saves;
      const auto = saves.auto;
      return h(
        'div',
        { class: 'menu-page' },
        h('p', { class: 'eyebrow' }, 'Rest your story here'),
        h('h2', null, 'Save journey'),
        h('p', { class: 'page-intro' }, auto ? `Autosave: ${MAPS[auto.state.mapId].name} · ${formatTime(auto.state.playSeconds)}. The road also saves itself at every town, boss and inn.` : 'The road saves itself at every town, boss and inn.'),
        h(
          'div',
          { class: 'save-list' },
          SAVE_SLOTS.map((slot) => {
            const sv = saves[slot];
            return h(
              'article',
              null,
              h('span', { class: 'slot-number' }, slot),
              h(
                'div',
                null,
                sv
                  ? [h('strong', null, `${sv.state.player.name} · Lv ${sv.state.player.level}`), h('small', null, `${MAPS[sv.state.mapId].name} · ${formatTime(sv.state.playSeconds)}`)]
                  : [h('strong', null, 'Empty slot'), h('small', null, 'A blank page in the roadbook')],
              ),
              h('button', { nav: `save:${slot}`, onclick: () => game.save(slot) }, 'Save'),
              sv && h('button', { class: 'load-small', nav: `load:${slot}`, onclick: () => actions.load(slot) }, 'Load'),
            );
          }),
        ),
      );
    }
    // settings
    const set = actions.settings();
    const row = (id, label, hint, value, onclick) =>
      h('label', null, h('span', null, h('strong', null, label), h('small', null, hint)), h('button', { type: 'button', class: 'toggle', nav: `set:${id}`, onclick }, value));
    const onOff = (v) => (v ? 'On' : 'Off');
    const ch = CHALLENGE[set.challenge] || CHALLENGE.standard;
    return h(
      'div',
      { class: 'menu-page' },
      h('p', { class: 'eyebrow' }, 'Make the road yours'),
      h('h2', null, 'Settings & controls'),
      h(
        'div',
        { class: 'settings-list' },
        row('music', 'Music', 'Generative pocket chiptune', onOff(set.music), () => actions.setSetting('music', !set.music)),
        row('sfx', 'Sound effects', 'Movement and battle cues', onOff(set.sfx), () => actions.setSetting('sfx', !set.sfx)),
        row('motion', 'Reduced motion', 'Removes bobbing, shakes and speeds transitions', onOff(set.reducedMotion), () => actions.setSetting('reducedMotion', !set.reducedMotion)),
        row('speed', 'Text speed', 'Dialogue reveal rate', SPEED_LABEL[set.textSpeed] ?? 'Normal', () => {
          const order = ['slow', 'normal', 'fast'];
          actions.setSetting('textSpeed', order[(order.indexOf(set.textSpeed) + 1) % order.length]);
        }),
        row('challenge', 'Challenge', ch.hint, ch.label, () => {
          const order = Object.keys(CHALLENGE);
          actions.setSetting('challenge', order[(order.indexOf(set.challenge) + 1) % order.length]);
        }),
        row('zoom', 'Camera zoom', 'Also wheel, pinch or LB / RB on the road', `${Math.round((set.zoom ?? 1) * 100)}%`, () => {
          const i = ZOOMS.findIndex((z) => Math.abs(z - (set.zoom ?? 1)) < 0.01);
          actions.setSetting('zoom', ZOOMS[(i + 1) % ZOOMS.length]);
        }),
        h('button', { class: 'fullscreen-button', nav: 'set:gfx', onclick: () => actions.openKitSettings() }, 'Graphics, touch & vibration…'),
        h('button', { class: 'fullscreen-button', nav: 'set:fullscreen', onclick: () => actions.fullscreen() }, 'Toggle fullscreen'),
        h('button', { class: 'fullscreen-button quit-button', nav: 'set:quit', onclick: () => actions.quit() }, ui.quitArmed ? 'Press again to return to the title' : 'Return to title'),
      ),
      h(
        'table',
        { class: 'control-legend' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: kit.input.source === 'keyboard' ? 'current' : '' }, 'Keyboard & mouse'), h('th', { class: kit.input.source === 'gamepad' ? 'current' : '' }, 'Gamepad'), h('th', { class: kit.input.source === 'touch' ? 'current' : '' }, 'Touch'))),
        h('tbody', null, CONTROL_HELP.map(([what, ...how]) => h('tr', null, h('th', null, what), how.map((x) => h('td', null, x))))),
      ),
    );
  }

  function menuPanel(s) {
    const p = s.player;
    return h(
      'section',
      { class: 'menu-overlay', 'aria-label': 'Adventure menu' },
      h(
        'div',
        { class: 'menu-shell' },
        h(
          'aside',
          { class: 'menu-tabs' },
          h('div', { class: 'menu-hero' }, h('div', { class: 'mini-avatar' }, p.name.slice(0, 1)), h('div', null, h('strong', null, p.name), h('small', null, `Dawn-bearer · Lv ${p.level}`))),
          TABS.map((t) => h('button', { class: game.ui.menuTab === t ? 'active' : '', nav: `tab:${t}`, onclick: () => ui.setTab(t) }, t)),
          h('button', { class: 'resume-button', nav: 'tab:resume', onclick: () => game.cancel() }, 'Resume ', kbd(P().back === 'Tap' ? '✕' : P().back)),
        ),
        h('div', { class: 'menu-content', 'data-scroll': `menu:${game.ui.menuTab}` }, menuPage(s)),
      ),
    );
  }

  function shopPanel(s) {
    const shopId = s.activeShop;
    if (shopId.startsWith('inn:')) {
      const price = Number(shopId.split(':')[1]);
      return h(
        'section',
        { class: 'shop-overlay', 'aria-label': 'Inn' },
        h(
          'div',
          { class: 'shop-card inn-card' },
          h('p', { class: 'eyebrow' }, 'Safe hearth'),
          h('h2', null, 'Rest at the inn?'),
          h('p', null, 'A warm bed, breakfast, and a full recovery for ', h('strong', null, `${price} gold`), '.'),
          h(
            'div',
            { class: 'inline-actions' },
            h('button', { class: 'ghost-button', nav: 'inn:no', onclick: () => game.cancel() }, 'Not now'),
            h('button', { class: 'primary-button', nav: 'inn:rest', disabled: s.player.gold < price, onclick: () => game.rest(price) }, 'Rest'),
          ),
        ),
      );
    }
    const shop = SHOPS[shopId];
    const p = s.player;
    const tab = game.ui.shopTab;
    const rows =
      tab === 'buy'
        ? shop.stock.map((id) => [id, p.inventory[id] ?? 0])
        : Object.entries(p.inventory).filter(([id, n]) => n > 0 && ITEMS[id].kind !== 'key' && ITEMS[id].price > 0);
    return h(
      'section',
      { class: 'shop-overlay', 'aria-label': 'Shop' },
      h(
        'div',
        { class: 'shop-card', 'data-scroll': 'shop' },
        h('div', { class: 'shop-heading' }, h('div', null, h('p', { class: 'eyebrow' }, 'Local wares'), h('h2', null, shop.name)), h('span', { class: 'gold-big' }, `◆ ${p.gold}G`)),
        h(
          'div',
          { class: 'shop-tabs' },
          h('button', { class: tab === 'buy' ? 'active' : '', nav: 'shop:buy', onclick: () => ui.setShopTab('buy') }, 'Buy'),
          h('button', { class: tab === 'sell' ? 'active' : '', nav: 'shop:sell', onclick: () => ui.setShopTab('sell') }, 'Sell'),
          h('span', { class: 'shop-hint' }, P().tabs === 'Tap' ? '' : `${P().tabs} to switch`),
        ),
        h(
          'div',
          { class: 'wares-list' },
          rows.map(([id, n]) => {
            const it = ITEMS[id];
            const price = tab === 'buy' ? it.price : Math.max(1, Math.floor(it.price / 2));
            const equipped = Object.values(p.equipment).includes(id);
            const disabled = tab === 'buy' ? p.gold < price : equipped && n <= 1;
            const st = stats(p);
            let compare = '';
            if (tab === 'buy' && ['weapon', 'armor'].includes(it.kind)) {
              const cur = ITEMS[p.equipment[it.kind]];
              const key = it.kind === 'weapon' ? 'power' : 'defense';
              const diff = (it[key] ?? 0) - (cur?.[key] ?? 0);
              compare = `${it.kind === 'weapon' ? 'ATK' : 'DEF'} ${diff >= 0 ? '+' : ''}${diff} vs equipped`;
            } else if (tab === 'buy' && it.kind === 'consumable' && it.healHp) compare = `HP ${p.hp}/${st.maxHp}`;
            return h(
              'button',
              { nav: `ware:${tab}:${id}`, disabled, onclick: () => (tab === 'buy' ? game.buy(id) : game.sell(id)) },
              h('div', null, h('span', null, it.kind), h('strong', null, it.name), h('small', null, it.description), compare && h('small', { class: 'compare' }, compare)),
              h('div', null, h('b', null, `${price}G`), h('small', null, tab === 'buy' ? `Owned ${n}` : `×${n}${equipped ? ' · equipped' : ''}`)),
            );
          }),
          !rows.length && h('p', { class: 'page-intro' }, 'Nothing to sell.'),
        ),
        h('button', { class: 'leave-shop', nav: 'shop:leave', onclick: () => game.cancel() }, 'Leave shop ', kbd(P().back === 'Tap' ? '✕' : P().back)),
      ),
    );
  }

  function gameoverPanel() {
    return h(
      'section',
      { class: 'gameover-screen' },
      h('div', { class: 'broken-sun' }, '✦'),
      h('p', { class: 'eyebrow' }, 'The road grows dark'),
      h('h2', null, 'But dawn is stubborn.'),
      h('p', null, 'You will return to your last safe hearth. Half your gold will be left to the road.'),
      h('button', { class: 'primary-button', nav: 'go:rise', onclick: () => game.rise() }, 'Rise again'),
    );
  }

  function creditsPanel(s) {
    const foes = Object.values(s.defeated).reduce((a, b) => a + b, 0);
    const kinds = Object.keys(s.defeated).length;
    return h(
      'section',
      { class: 'credits-screen', 'data-scroll': 'credits' },
      h('div', { class: 'ending-sun' }, '✦'),
      h('p', { class: 'eyebrow' }, 'The first true morning'),
      h('h2', null, 'Emberfall moves again.'),
      h(
        'p',
        { class: 'ending-copy' },
        'The old Crown is melted into three beacon bells. No single ruler will hold the kingdom’s dawn again. In every town, names are remembered, sails turn, gardens open—and a courier chooses the next road.',
      ),
      h(
        'div',
        { class: 'journey-results' },
        statCell('Journey', formatTime(s.playSeconds)),
        statCell('Level', s.player.level),
        statCell('Steps', s.steps.toLocaleString()),
        statCell('Foes bested', foes.toLocaleString()),
        statCell('Bestiary', `${kinds} / ${Object.keys(ENEMIES).length}`),
        statCell('Side quests', `${Object.values(s.quests).filter((q) => q === 'complete').length} / ${Object.keys(QUESTS).length}`),
      ),
      !s.flags.includes('boss_bell') && h('p', { class: 'ending-hook' }, 'Yet north of the river, a hush still hangs over the old belfry…'),
      h('div', { class: 'credits-roll' }, CREDITS.map(([a, b]) => h('div', null, h('span', null, a), h('strong', null, b)))),
      h(
        'div',
        { class: 'inline-actions' },
        h('button', { class: 'secondary-button', nav: 'cr:explore', onclick: () => game.exploreAfterEnding() }, 'Explore the restored world'),
        h('button', { class: 'primary-button', nav: 'cr:title', onclick: () => actions.toTitle() }, 'Title screen'),
      ),
    );
  }

  // ---- popups (damage numbers, level up)

  const popLayer = h('div', { class: 'popups', 'aria-hidden': 'true' });
  shell.append(popLayer);
  function popup(text, x, y, kind = '') {
    const el = h('div', { class: `popup ${kind}`, style: `left:${Math.round(x)}px;top:${Math.round(y)}px` }, text);
    popLayer.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  // ---- the ui object

  let flashTimer = 0;
  const ui = {
    titleView: 'main',
    heroName: 'Aster',
    quitArmed: false,
    dialogueText: null,
    lastInput: 'pointer',

    setTitleView(v) {
      ui.titleView = v;
      if (v === 'name')
        requestAnimationFrame(() => {
          const input = shell.querySelector('#hero-name');
          if (!input) return;
          if (kit.input.source === 'gamepad') shell.querySelector('[data-nav="title:begin"]')?.focus();
          else {
            input.focus();
            input.select();
          }
        });
    },
    setTab(t) {
      game.ui.menuTab = t;
      ui.quitArmed = false;
      game.ui.version += 1;
      actions.sfx(480, 0.03);
    },
    cycleTab(dir) {
      const i = TABS.indexOf(game.ui.menuTab);
      ui.setTab(TABS[(i + dir + TABS.length) % TABS.length]);
      ui.update(); // rebuild now so focus can land on the new tab
      if (ui.navActive()) ui.focusNav(`tab:${game.ui.menuTab}`);
    },
    setShopTab(t) {
      game.ui.shopTab = t;
      game.ui.version += 1;
      actions.sfx(480, 0.03);
    },
    combatView(v) {
      game.ui.combatView = v;
      game.ui.version += 1;
      actions.sfx(480, 0.03);
    },

    flash(kind) {
      shell.classList.remove('flash-enemy', 'flash-player');
      void shell.offsetWidth; // restart the animation
      shell.classList.add(`flash-${kind}`);
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => shell.classList.remove(`flash-${kind}`), 200);
    },
    popup,

    /** Rebuild whatever changed; called once per frame. */
    update() {
      const s = game.state;
      const src = kit.input.source;
      shell.classList.toggle('reduced-motion', !!actions.settings().reducedMotion);
      const savesSig = s ? '' : Object.values(game.ui.saves).map((v) => v?.savedAt ?? 0).join(',');
      panel('title', s ? null : `title|${ui.titleView}|${savesSig}|${src}`, titlePanel);
      hud.update(s);
      objective.update(s);
      panel('toast', game.ui.toast ? `toast|${game.ui.toastId}` : null, () => h('div', { class: 'toast', role: 'status' }, game.ui.toast));
      panel(
        'dialogue',
        s?.mode === 'dialogue' && s.dialogue ? `dlg|${s.dialogue.speaker}|${s.dialogue.index}|${s.dialogue.pages[0]}|${src}` : null,
        () => dialoguePanel(s),
      );
      if (s?.mode === 'dialogue' && s.dialogue && ui.dialogueText) {
        const page = s.dialogue.pages[s.dialogue.index] ?? '';
        const n = Math.floor(game.ui.typed);
        if (ui.dialogueText.dataset.n !== String(n)) {
          ui.dialogueText.dataset.n = String(n);
          ui.dialogueText.textContent = page.slice(0, n);
        }
      }
      combatUpdate(s);
      panel('menu', s?.mode === 'menu' ? `menu|${game.ui.menuTab}|${game.ui.version}|${src}|${ui.quitArmed}` : null, () => menuPanel(s));
      panel('shop', s?.mode === 'shop' && s.activeShop ? `shop|${s.activeShop}|${game.ui.shopTab}|${game.ui.version}|${src}` : null, () => shopPanel(s));
      panel('gameover', s?.mode === 'gameover' ? 'gameover' : null, gameoverPanel);
      panel('credits', s?.mode === 'credits' ? `credits|${game.ui.version}` : null, () => creditsPanel(s));
      tag.update(s);
      // Opening a new menu with a gamepad or keys puts focus on its first choice.
      const r = ui.navRoot();
      if (r !== ui._lastRoot) {
        ui._lastRoot = r;
        if (r && ui.navActive()) ui.focusDefault(true);
        else if (!r) {
          const a = document.activeElement;
          if (a && a !== document.body && shell.contains(a)) a.blur();
        }
      }
    },

    // ---- focus navigation (gamepad and keys)

    /** The interactive panel that owns focus right now, or null in the field. */
    navRoot() {
      const s = game.state;
      if (!s) return slots.title;
      if (s.mode === 'menu') return slots.menu;
      if (s.mode === 'shop') return slots.shop;
      if (s.mode === 'gameover') return slots.gameover;
      if (s.mode === 'credits') return slots.credits;
      if (s.mode === 'combat') return combat.el?.querySelector('.battle-actions') ?? null;
      return null;
    },
    navActive() {
      return kit.input.source === 'gamepad' || ui.lastInput === 'key';
    },
    candidates(root) {
      return [...root.querySelectorAll('button, input')].filter((el) => !el.disabled && el.offsetParent !== null);
    },
    focusNav(key) {
      const el = shell.querySelector(`[data-nav="${CSS.escape(key)}"]`);
      if (el && !el.disabled) {
        el.focus({ preventScroll: false });
        if (ui.navActive()) el.classList.add('nav-focus');
        return true;
      }
      return false;
    },
    /** Focus the natural first choice of the current panel. */
    focusDefault(visibleRing) {
      const root = ui.navRoot();
      if (!root) return;
      const s = game.state;
      const prefer = !s
        ? ui.titleView === 'name'
          ? kit.input.source === 'gamepad'
            ? 'title:begin'
            : 'title:name'
          : ui.titleView === 'load'
            ? null
            : latestSave(game.ui.saves)
              ? 'title:continue'
              : 'title:new'
        : s.mode === 'menu'
          ? `tab:${game.ui.menuTab}`
          : s.mode === 'shop'
            ? s.activeShop.startsWith('inn:')
              ? 'inn:rest'
              : null
            : s.mode === 'combat'
              ? game.ui.combatView === 'root'
                ? 'b:attack'
                : null
              : s.mode === 'credits'
                ? 'cr:explore'
                : null;
      let el = prefer ? root.querySelector(`[data-nav="${CSS.escape(prefer)}"]`) : null;
      if (!el && s?.mode === 'shop') el = root.querySelector('.wares-list > button:not([disabled])') ?? root.querySelector('[data-nav="shop:leave"]');
      if (!el || el.disabled) el = ui.candidates(root).find((c) => c.tagName === 'BUTTON' && !c.classList.contains('back-action')) ?? ui.candidates(root)[0];
      if (!el) return;
      el.focus({ preventScroll: true });
      if (visibleRing && ui.navActive()) el.classList.add('nav-focus');
    },
    /** Move focus to the nearest control in a screen direction. */
    navMove(dx, dy) {
      const root = ui.navRoot();
      if (!root) return false;
      const items = ui.candidates(root);
      if (!items.length) return false;
      const cur = document.activeElement;
      if (!items.includes(cur)) {
        ui.focusDefault(true);
        return true;
      }
      if (cur.tagName === 'INPUT' && dx !== 0) return false;
      const r = cur.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let best = null;
      let bestScore = Infinity;
      for (const el of items) {
        if (el === cur) continue;
        const q = el.getBoundingClientRect();
        // Distance from the current centre to the nearest point of the candidate.
        const px = Math.max(q.left, Math.min(cx, q.right));
        const py = Math.max(q.top, Math.min(cy, q.bottom));
        const ddx = (dx ? q.left + q.width / 2 : px) - cx;
        const ddy = (dy ? q.top + q.height / 2 : py) - cy;
        const along = ddx * dx + ddy * dy;
        if (along <= 2) continue;
        const across = Math.abs(dx ? ddy : ddx);
        const score = along + across * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (!best) return false;
      cur.classList.remove('nav-focus');
      best.focus({ preventScroll: false });
      best.classList.add('nav-focus');
      actions.sfx(700, 0.02, { vol: 0.03 });
      return true;
    },
    /** Press the focused control. Returns false when nothing in the panel has focus. */
    navConfirm() {
      const root = ui.navRoot();
      const el = document.activeElement;
      if (!root || !el || !root.contains(el)) return false;
      if (el.tagName === 'INPUT') {
        el.form?.requestSubmit?.();
        return true;
      }
      if (el.tagName === 'BUTTON' && !el.disabled) {
        el.click();
        return true;
      }
      return false;
    },
  };

  // Focus rings from our navigation disappear as soon as the mouse or a finger takes over.
  shell.addEventListener('focusout', (e) => e.target.classList?.remove('nav-focus'));
  addEventListener(
    'pointerdown',
    () => {
      ui.lastInput = 'pointer';
      shell.querySelector('.nav-focus')?.classList.remove('nav-focus');
    },
    true,
  );
  addEventListener(
    'keydown',
    (e) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) ui.lastInput = 'key';
    },
    true,
  );

  return ui;
}
