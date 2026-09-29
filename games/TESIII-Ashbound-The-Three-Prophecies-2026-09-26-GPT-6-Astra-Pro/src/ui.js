import { CAMPAIGN, SIDES, ACTS, activeStep, gateForArea, ESSENTIAL } from './campaign.js';
import {
  SIGN_INFO,
  START_SPELLS,
  itemInfo,
  maxHealth,
  maxMagicka,
  maxFatigue,
  capacity,
  weight,
  armorRating,
  weapon,
  spellById,
  spellChance,
  attackChance,
  multiplier,
} from './model.js';
import { escapeHTML as H, clamp } from './util.js';
const B = (text, action, arg = '', cls = '', disabled = false) =>
  `<button class="${cls}" data-action="${action}" data-arg="${H(arg)}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const option = (value, selected, label = value) =>
  `<option value="${H(value)}" ${value === selected ? 'selected' : ''}>${H(label)}</option>`;
const sigil = `<svg class="sigil" viewBox="0 0 80 88" fill="none" aria-hidden="true"><path d="M40 3 73 66 40 83 7 66Z" stroke="currentColor"/><path d="m40 17 22 43-22 11-22-11Zm0 14v27m-10-3 10 9 10-9M40 3v10M7 66l13-3m53 3-13-3" stroke="currentColor" stroke-width="1.3"/><circle cx="40" cy="46" r="4" fill="currentColor"/></svg>`;
const KIT_SETTINGS = ['quality', 'lookSensitivity', 'invertY'];
const glyph = {
  weapon: '†',
  armor: '◇',
  jewelry: '◌',
  potion: '♜',
  ingredient: '✧',
  book: '▱',
  quest: '⬡',
  tool: '⚒',
  soul: '◈',
};
const CONTROL_ROWS = [
  ['Move / look', 'W A S D · mouse'],
  ['Look without mouse capture', 'Hold right mouse · arrows'],
  ['Jump / swim up', 'Space'],
  ['Run / sneak or dive', 'Shift · Ctrl'],
  ['Interact / take / talk', 'E'],
  ['Attack / charged attack', 'Click / hold & release · V'],
  ['Cast readied spell', 'F'],
  ['Cycle weapons / spells', 'Q · B'],
  ['Ready weapon / fire / heal / levitate', '1 · 2 · 3 · 4'],
  ['Inventory / journal / map', 'I · J · M'],
  ['Rest / birthsign power', 'R · P'],
  ['Pause / save / options', 'Esc'],
  ['Quick health potion', 'H'],
  ['Quick Magicka potion', 'G'],
  ['Graphics &amp; controls', 'F9'],
];
export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('ui');
    this.screen = 'title';
    this.context = null;
    this.tab = 'all';
    this.levelSelected = [];
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (b && !b.disabled) {
        this.g.audio?.play('menu', 0.25);
        this.action(b.dataset.action, b.dataset.arg || '');
        // A HUD button keeps no focus during play, so Space still jumps instead of pressing it again.
        if (!this.g.modal && this.root.contains(document.activeElement)) document.activeElement.blur();
      }
    });
    this.root.addEventListener('change', (e) => this.change(e));
    this.root.addEventListener('input', (e) => this.input(e));
    this.root.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !this.g.modal) return;
      const items = [...this.root.querySelectorAll('button:not(:disabled),input:not([hidden]),select,a[href]')].filter(
        (n) => n.getClientRects().length,
      );
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  title() {
    this.g.modal = true;
    this.g.controls?.clear();
    document.exitPointerLock?.();
    this.screen = 'title';
    this.g.view.mode = 'title';
    this.root.innerHTML = `<section class="title-screen"><div class="title-content">${sigil}<div class="eyebrow">An outlander. Three prophecies. One life.</div><h1>Ashbound</h1><div class="subtitle">The Three Prophecies</div><div class="title-rule"></div><p class="lead">The ash remembers.<br>The gods would rather you forget.</p><div class="title-buttons">${B('Continue your journey <span>↗</span>', 'continue', '', 'primary', !this.g.hasSave())}${B('Begin as an outlander <span>＋</span>', 'create')}${B('How to play <span>⌘</span>', 'controls')}${B('Options & about <span>⚙</span>', 'options')}</div></div><div class="scene-caption"><div>The Bitter Coast</div><small>VVARDENFELL · THIRD ERA</small></div><div class="corner">A world built one brick at a time</div><footer class="title-footer"><div>GENERATED SEPTEMBER 26, 2026<br>GPT-6 ASTRA PRO · SECOND PASS 1.1 · INTERNAL BUILD</div><div class="right">A compact adaptation of The Elder Scrolls III: Morrowind<br>Original procedural art · Guide by tarvis79</div></footer></section>`;
  }
  mount(title, body, { compact = false, tabs = false, wide = false, eyebrow = 'ASHBOUND · THE THREE PROPHECIES' } = {}) {
    if (this.g.state?.hp <= 0 && !['death', 'options', 'controls'].includes(this.screen)) return this.death();
    this.g.modal = true;
    this.g.controls?.clear();
    document.exitPointerLock?.();
    this.root.innerHTML = `<div class="modal-shade"><section class="window ${compact ? 'compact' : ''} ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${H(title)}"><header class="window-header"><div><div class="eyebrow">${H(eyebrow)}</div><h2>${H(title)}</h2></div>${B('×', 'close', '', 'close')}</header>${tabs ? this.nav() : ''}<div class="window-body">${body}</div></section></div>`;
    this.root.querySelectorAll('.settings-row').forEach((row) => {
      const label = row.querySelector('label'),
        control = row.querySelector('input,select');
      if (label && control?.id) label.htmlFor = control.id;
    });
    // Start on the window's main action (Take all, Return to the world…), so A / Space does the expected thing.
    const first =
      this.root.querySelector('.window-body button.primary:not(:disabled)') ||
      this.root.querySelector('button:not(:disabled),input,select');
    first?.focus({ preventScroll: true });
  }
  nav() {
    return `<nav class="tabs" aria-label="Character menus">${[
      ['inventory', 'Inventory'],
      ['magic', 'Magic'],
      ['journal', 'Journal'],
      ['map', 'Map'],
      ['character', 'Character'],
      ['atlas', 'Source atlas'],
    ]
      .map(([id, label]) => B(label, id, '', id === this.screen ? 'active' : ''))
      .join('')}</nav>`;
  }
  resume() {
    if (this.g.state?.hp <= 0) {
      this.death();
      return;
    }
    if (!this.g.state) return this.title();
    this.g.modal = false;
    this.g.view.mode = 'play';
    this.screen = 'hud';
    this.context = null;
    this.root.innerHTML = `<section class="hud" aria-label="Game heads-up display"><div class="hud-top"><div><div class="location-sub" id="hud-region"></div><div class="location-name" id="hud-area"></div></div><div class="top-tools">${B('Pack', 'inventory')}${B('Journal', 'journal')}${B('Map', 'map')}${B('☰', 'pause')}</div></div><div class="compass"><span>W</span><span>·</span><span class="bearing" id="hud-bearing">N</span><span>·</span><span>E</span></div><div class="quest-hud"><div class="eyebrow" id="hud-act"></div><h4 id="hud-quest"></h4><p id="hud-destination"></p></div><div class="crosshair" id="crosshair"></div><div class="target" id="hud-target"></div><div class="hints" id="hud-hint">Click to capture the mouse · E to interact</div><div class="vitals"><div class="level-badge"><span id="hud-level">1</span></div><div>${[
      ['health', 'Health'],
      ['magicka', 'Magicka'],
      ['fatigue', 'Fatigue'],
    ]
      .map(
        ([k, v]) =>
          `<div class="meter-row"><div class="meter-label"><span>${v}</span><span id="${k}-value"></span></div><div class="meter ${k}"><i id="${k}-fill"></i></div></div>`,
      )
      .join(
        '',
      )}</div></div><div class="status-hud"><div id="hud-status"></div><div class="charge-meter" id="charge-meter" hidden><i id="charge-fill"></i></div></div><div class="quickbar">${[
      ['1', '†', 'slot', '1'],
      ['2', '✧', 'slot', '2'],
      ['3', '✚', 'slot', '3'],
      ['4', '↟', 'slot', '4'],
    ]
      .map(([k, g, a, arg]) => B(`<kbd>${k}</kbd>${g}`, a, arg))
      .join(
        '',
      )}</div><div class="weapon-hud"><div class="weapon-name" id="hud-weapon"></div><div class="spell-name" id="hud-spell"></div><small id="hud-equipment"></small></div></section>`;
    this.hud = new Map();
    this.g.controls.clear();
    this.updateHUD();
  }
  updateHUD() {
    if (this.screen !== 'hud' || !this.g.state) return;
    const s = this.g.state,
      c = this.g.catalogue,
      q = activeStep(s),
      a = c.areas.find((x) => x.id === s.area),
      r = c.regions.find((x) => x.id === a.region);
    // Only touch the DOM when a value changed (this runs several times a second).
    const changed = (key, v) => {
      if (this.hud.get(key) === v) return false;
      this.hud.set(key, v);
      return true;
    };
    const set = (id, v) => {
      v = String(v ?? '');
      if (!changed(id, v)) return;
      const e = document.getElementById(id);
      if (e) e.textContent = v;
    };
    const width = (id, pct) => {
      const v = `${pct.toFixed(1)}%`;
      if (changed(id + ':w', v)) document.getElementById(id).style.width = v;
    };
    const source = this.g.kit.input.source;
    const key = { interact: source === 'gamepad' ? 'X' : source === 'touch' ? 'Use' : 'E', cast: source === 'gamepad' ? 'LT' : source === 'touch' ? '✧' : 'F' };
    set('hud-region', r?.name);
    set('hud-area', a.name.replace(/^.*?-/, ''));
    set('hud-level', s.level);
    set('hud-act', q ? `CHAPTER ${Math.max(1, q.act)} · ${ACTS[q.act]}` : 'THE PROPHECIES ARE FULFILLED');
    set('hud-quest', q?.title || 'A road of your own');
    set(
      'hud-destination',
      q
        ? q.area === s.area
          ? `${q.type === 'kill' ? 'Confront' : q.type === 'talk' ? 'Speak to' : 'Find'} ${q.target}`
          : `Travel to ${c.areas.find((a) => a.id === q.area)?.name || q.area}`
        : 'Explore, study, and finish the promises you made.',
    );
    for (const [key, value, max] of [
      ['health', s.hp, maxHealth(s)],
      ['magicka', s.mp, maxMagicka(s)],
      ['fatigue', s.fp, maxFatigue(s)],
    ]) {
      set(key + '-value', `${Math.ceil(value)} / ${Math.floor(max)}`);
      width(key + '-fill', clamp((value / Math.max(1, max)) * 100, 0, 100));
    }
    const w = weapon(s, c),
      sp = spellById(s, c, s.selectedSpell);
    set('hud-weapon', w.name);
    set('hud-spell', `✧ ${sp.name} · ${key.cast} to cast`);
    set('hud-equipment', `${Math.round(s.condition[w.name] ?? 100)}% condition · ${s.gold} drakes`);
    const deg = ((((s.yaw * 180) / Math.PI) % 360) + 360) % 360;
    set('hud-bearing', deg < 45 || deg >= 315 ? 'N' : deg < 135 ? 'W' : deg < 225 ? 'S' : 'E');
    const statuses = Object.entries(s.buffs)
      .filter(([, v]) => v.remaining > 0)
      .map(([k, v]) => `${k} ${Math.ceil(v.remaining)}s`);
    if (s.flags.corprus) statuses.push('Corprus');
    if (s.pendingLevels.length) statuses.push('Rest to advance a level');
    if (this.g.sneaking) statuses.push(this.g.inCombat() ? 'Detected' : 'Sneaking');
    if (this.g.oxygen < 25) statuses.push(`Breath ${Math.ceil(this.g.oxygen)}s`);
    if (weight(s, c) > capacity(s)) statuses.push('Overencumbered');
    set('hud-status', statuses.slice(0, 3).join('  ·  '));
    const t = this.g.target;
    if (changed('crosshair', !!t)) document.getElementById('crosshair').classList.toggle('active', !!t);
    const html = t
      ? `<h4>${H(t.name)}</h4>${t.type === 'enemy' ? `<div class="enemy-bar"><i style="width:${(t.hp / t.maxHp) * 100}%"></i></div><small>${t.docile ? `${key.interact} · Choose the Hunter’s aspect` : `${Math.round(attackChance(s, w.skill, t) * 100)}% hit chance · ${t.winding ? 'INCOMING ATTACK' : 'Hold to charge'}`}</small>` : `<small><span class="key">${key.interact}</span> ${t.type === 'npc' ? 'Talk' : t.type === 'exit' ? 'Travel' : t.type === 'travel' ? 'Routes' : t.type === 'shrine' ? 'Rest and restore' : t.type === 'heart' ? 'Use Kagrenac’s tools' : t.type === 'puzzle' ? 'Examine' : t.locked ? 'Locked · ' + t.locked : 'Take / examine'}</small>`}`
      : '';
    if (changed('hud-target', html)) document.getElementById('hud-target').innerHTML = html;
    const chargeStart = this.g.controls.chargeStart;
    const charging = chargeStart !== null;
    if (changed('charging', charging)) document.getElementById('charge-meter').hidden = !charging;
    if (charging) width('charge-fill', clamp((performance.now() - chargeStart) / 750, 0, 1) * 100);
    set(
      'hud-hint',
      this.g.canTravel()
        ? 'M · Travel services nearby'
        : source === 'gamepad'
          ? 'X interact · LT cast · Back rest'
          : document.pointerLockElement
            ? 'E interact · F cast · R rest'
            : 'Click to capture mouse · right-drag or arrows to look',
    );
  }
  create() {
    this.screen = 'create';
    const c = this.g.catalogue;
    this.mount(
      'Who comes to these shores?',
      `<div class="character-layout"><div class="stack"><p>Your past is uncertain. Your choices are not. Attributes, skills, and your birthsign change how the journey plays.</p><label>Name<input id="char-name" value="Outlander" maxlength="28" autocomplete="off"></label><div class="grid two"><label>Race<select id="char-race">${c.races.map((r) => option(r.name, 'Dark Elf')).join('')}</select></label><label>Attribute profile<select id="char-sex">${['Male', 'Female'].map((x) => option(x, 'Male')).join('')}</select></label></div><div class="grid two"><label>Class<select id="char-class">${c.classes.map((x) => option(x.name, 'Spellsword')).join('')}${option('Custom', 'Spellsword', 'Custom · guide build')}</select></label><label>Birthsign<select id="char-sign">${c.birthsigns.map((x) => option(typeof x === 'string' ? x : x.name, 'The Lady')).join('')}</select></label></div><div id="sign-description" class="notice">${SIGN_INFO['The Lady']}</div><small>The Spellsword / Lady combination is forgiving. The High Elf / Atronach combination offers much greater Magicka, but requires potions or absorption.</small>${B('Step into the world →', 'start', '', 'primary')}<small>${this.g.hasSave() ? 'Starting a new journey replaces the autosave. Export an existing save from Options first.' : 'Progress is stored only in this browser. No accounts or tracking.'}</small></div><aside class="char-preview" id="char-preview"></aside></div>`,
    );
    this.characterPreview();
  }
  choice() {
    return {
      name: document.getElementById('char-name')?.value || 'Outlander',
      race: document.getElementById('char-race')?.value || 'Dark Elf',
      sex: document.getElementById('char-sex')?.value || 'Male',
      class: document.getElementById('char-class')?.value || 'Spellsword',
      sign: document.getElementById('char-sign')?.value || 'The Lady',
    };
  }
  characterPreview() {
    const ch = this.choice(),
      c = this.g.catalogue;
    const cl =
      ch.class === 'Custom'
        ? {
            name: 'Custom',
            favored: ['Endurance', 'Luck'],
            major: ['Spear', 'Blunt Weapon', 'Long Blade', 'Block', 'Mercantile'],
            minor: ['Axe', 'Medium Armor', 'Mysticism', 'Restoration', 'Heavy Armor'],
          }
        : c.classes.find((x) => x.name === ch.class);
    const attrs = { ...c.races.find((x) => x.name === ch.race).attributes[ch.sex] };
    for (const x of cl.favored) attrs[x] += 10;
    if (ch.sign === 'The Lady') {
      attrs.Endurance += 25;
      attrs.Personality += 25;
    }
    if (ch.sign === 'The Lover') attrs.Agility += 25;
    if (ch.sign === 'The Steed') attrs.Speed += 25;
    document.getElementById('sign-description').textContent = SIGN_INFO[ch.sign];
    document.getElementById('char-preview').innerHTML =
      `<div class="eyebrow">${H(ch.race)} · ${H(cl.name)}</div><h3 style="margin-top:12px">The shape of a beginning</h3>${Object.entries(
        attrs,
      )
        .map(([n, v]) => `<div class="stat"><span>${n}</span><b>${v}</b></div>`)
        .join(
          '',
        )}<hr><div class="eyebrow">Major skills</div><p style="font-size:12px;margin:10px 0">${H(cl.major.join(' · '))}</p><div class="eyebrow">Minor skills</div><p style="font-size:12px;margin:10px 0">${H(cl.minor.join(' · '))}</p>`;
  }
  pause() {
    if (!this.g.state) return this.title();
    this.screen = 'pause';
    this.mount(
      'A moment of stillness',
      `<p class="lead">Even the longest road allows a rest.</p><div class="stack">${B('Return to the world', 'resume', '', 'primary')}${B('Save journey', 'save')}${B('Load last save', 'load', '', '', !this.g.hasSave())}<div class="grid two">${B('Controls', 'controls')}${B('Options', 'options')}</div>${B('Return to title', 'title', '', 'ghost')}</div>`,
      { compact: true },
    );
  }
  controls() {
    this.screen = 'controls';
    this.mount(
      'The outlander’s handbook',
      `<p>Explore in first person. Read directions, choose your equipment, and arrive at a fight with Fatigue to spare.</p><div class="controls-grid">${CONTROL_ROWS.map(([l, k]) => `<div class="control"><span>${l}</span><span class="key">${k}</span></div>`).join('')}</div><div class="notice"><strong>Touch:</strong> Put a thumb anywhere on the left half to move and drag the right side of the scene to look. Hold †, then release for a charged attack. ↑ jumps / ascends and ↓ sneaks / descends. Use appears when you look at someone or something. Tap a quick slot, then ✧ to cast. Every menu uses ordinary touch controls.</div><div class="notice"><strong>Controller:</strong> Left stick or D-pad moves, right stick looks. A jumps, B sneaks, X interacts, Y opens your pack (its tabs hold the journal and map). Hold and release RT for a charged attack; LT casts. LB / RB cycle spells and weapons, click the left stick to run and the right stick for a health potion. Back rests, Start pauses. In menus the stick or D-pad moves between buttons, left / right change a setting, A chooses and B goes back.</div><div class="grid two"><div class="panel"><h3>Prepare, don’t mash</h3><p>Green is Fatigue. It affects hit chance and other skill checks. Walking restores it; running and attacks spend it. The displayed hit chance explains a miss. Charge attacks against dangerous enemies; use lighter strikes to conserve stamina.</p></div><div class="panel"><h3>Travel with purpose</h3><p>Use a route sign or a cell’s gates, then open the map. Travel services cost drakes. Rest at a shrine or away from enemies. Magicka normally returns during rest—not while walking. Levitation, Mark, and Recall are tools, not just combat spells.</p></div></div>${B(this.g.state ? 'Return to journey' : 'Back to title', 'close', '', 'primary')}`,
    );
  }
  options() {
    this.screen = 'options';
    const o = this.g.options;
    const k = this.g.kit.settings.get();
    this.mount(
      'Options & about',
      `<div class="grid two options-grid"><div><h3>Presentation</h3><div class="settings-row"><label>Quality<small>Auto picks a tier for this device and holds the frame rate.</small></label><select id="option-quality">${[
        ['auto', 'Auto'],
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
        ['ultra', 'Ultra'],
      ]
        .map(([v, n]) => option(v, k.quality, n))
        .join('')}</select></div><div class="settings-row"><label>Master volume</label><input id="option-volume" type="range" min="0" max="1" step=".01" value="${o.volume}"></div><div class="settings-row"><label>Music volume</label><input id="option-musicVolume" type="range" min="0" max="1" step=".01" value="${o.musicVolume}"></div><div class="settings-row"><label>Sound effects</label><input id="option-sfxVolume" type="range" min="0" max="1" step=".01" value="${o.sfxVolume}"></div><div class="settings-row"><label>Mute all audio</label><input id="option-mute" type="checkbox" ${o.mute ? 'checked' : ''}></div><div class="settings-row"><label>Diagnostics overlay</label><input id="option-diagnostics" type="checkbox" ${o.diagnostics ? 'checked' : ''}></div><div class="row" style="margin-top:20px">${B('Graphics &amp; controls', 'kit-settings')}${B('Toggle fullscreen', 'fullscreen')}${B('Controls', 'controls')}</div></div><div><h3>Playing your way</h3><div class="settings-row"><label>Challenge<small>Enemy health stays fixed; incoming damage changes.</small></label><select id="option-difficulty">${[
        ['0.65', 'Wayfarer'],
        ['1', 'Classic'],
        ['1.5', 'Veteran'],
      ]
        .map(([v, n]) => option(v, String(o.difficulty), n))
        .join(
          '',
        )}</select></div><div class="settings-row"><label>Look sensitivity</label><input id="option-lookSensitivity" type="range" min=".25" max="3" step=".05" value="${k.lookSensitivity}"></div><div class="settings-row"><label>Invert vertical look</label><input id="option-invertY" type="checkbox" ${k.invertY ? 'checked' : ''}></div><div class="settings-row"><label>View bob and hit shake</label><input id="option-motion" type="checkbox" ${o.motion ? 'checked' : ''}></div><div class="notice">Higher tiers use larger shadow maps, sharper resolution and anti-aliasing. Every tier draws the same scene, HDR lighting, node materials and bloom. Quality, sensitivity and invert are shared with the other 3D games here; Graphics &amp; controls (F9) has the rest.</div><div class="notice">Code, physics, catalogue and audio load from this game’s own folder; nothing comes from the internet. When browser storage is blocked, checkpoints last only for this tab. Export important saves.</div><div class="row">${B('Export save', 'export', '', 'small', !this.g.state && !this.g.hasSave())}${B('Import save', 'import', '', 'small')}<input hidden id="save-import" type="file" accept="application/json,.json"></div></div></div><hr><section class="credits"><div class="eyebrow">Generated September 26, 2026 · GPT-6 Astra Pro</div><p><strong>Ashbound: The Three Prophecies</strong> is an unofficial, compact adaptation for internal non-commercial testing. The Elder Scrolls III: Morrowind and its characters belong to their respective rights holders. Source guide: tarvis79, <em>Beating Morrowind in _____ Steps</em>. Procedural art and rewritten dialogue are original to this build.</p><p>Campaign encounters are scripted adaptations. Additional named locations and objects are generated from the guide’s catalogue; catalogue entries are not a claim that every original quest is recreated. Consult <strong>COMPLETION_REPORT.md</strong> for exact coverage. Current audio is explicitly labelled original synthesized fallback audio; requested source recordings were not obtained.</p><p>Rendering: Three.js r186 · WebGPURenderer / automatic WebGL2 fallback · TSL, on the shared 3D kit. Physics: Rapier 0.20.0, 60 Hz fixed step. Saves remain local to this browser. Version 1.1: second pass, September 26, 2026.</p></section>`,
    );
  }
  inventory(filter = 'all') {
    this.screen = 'inventory';
    this.tab = filter;
    const s = this.g.state,
      c = this.g.catalogue;
    if (!s) return;
    const entries = Object.entries(s.inventory)
      .filter(([n]) => filter === 'all' || itemInfo(n, c).type === filter)
      .sort((a, b) => a[0].localeCompare(b[0]));
    this.mount(
      'Your possessions',
      `<div class="row spread" style="margin-bottom:18px"><div><span class="gold">${s.gold}</span> <small>drakes</small> &nbsp; <span class="gold">${weight(s, c).toFixed(1)} / ${capacity(s)}</span> <small>carry weight</small></div><div class="row">${[
        ['all', 'All'],
        ['weapon', 'Arms'],
        ['armor', 'Armor'],
        ['potion', 'Potions'],
        ['ingredient', 'Ingredients'],
      ]
        .map(([k, t]) => B(t, 'filter-inventory', k, `small ${filter === k ? 'primary' : ''}`))
        .join('')}</div></div><div class="inventory-layout"><div class="inventory-list">${
        entries
          .map(([n, qty]) => {
            const i = itemInfo(n, c),
              equipped = Object.values(s.equipment).includes(n);
            return `<div class="inventory-item"><span class="icon">${glyph[i.type] || '◇'}</span><div><div class="item-name">${H(n)} ${qty > 1 ? `<small>×${qty}</small>` : ''} ${equipped ? '<span class="tag current">Equipped</span>' : ''}</div><div class="item-meta">${H(i.type)} · ${i.weight} wt · ${i.value} dr${i.damage ? ' · ' + i.damage + ' damage' : ''}${i.armor ? ' · ' + i.armor + ' armor' : ''}${i.condition ? ' · ' + Math.round(s.condition[n] ?? 100) + '% condition' : ''}</div></div><div class="item-actions">${['weapon', 'armor', 'jewelry'].includes(i.type) ? B('Equip', 'equip', n, '', equipped) : ''}${i.type === 'potion' ? B('Drink', 'drink', n) : ''}${i.type === 'book' ? B('Read', 'read', n) : ''}${i.type === 'jewelry' && i.heal ? B('Use', 'use-ring', n) : ''}${i.type === 'tool' && i.tool === 'repair' ? B('Repair', 'repair-menu') : ''}${!ESSENTIAL.has(n) ? B('Drop', 'drop', n) : ''}</div></div>`;
          })
          .join('') || '<p>Your pack is empty in this category.</p>'
      }</div><aside class="panel"><div class="eyebrow">Worn equipment</div><h3 style="margin-top:10px">${Math.round(armorRating(s, c))} armor rating</h3>${Object.entries(
        s.equipment,
      )
        .map(([slot, n]) => `<div class="stat"><span><small>${H(slot)}</small><br>${H(n)}</span></div>`)
        .join(
          '',
        )}<hr><div class="stack">${B('Alchemy', 'alchemy', '', 'small')}${B('Enchant equipment', 'enchant-menu', '', 'small')}${B('Repair equipment', 'repair-menu', '', 'small')}</div><div class="notice">Quest-critical artifacts are protected from dropping or selling. Clothing and jewelry can be layered with armor.</div></aside></div>`,
      { tabs: true },
    );
  }
  magic(mode = 'known') {
    this.screen = 'magic';
    this.context = mode;
    const s = this.g.state,
      c = this.g.catalogue;
    const all = [...START_SPELLS, ...s.customSpells, ...c.spells];
    const unique = [...new Map(all.map((x) => [x.id, x])).values()];
    const list =
      mode === 'learn' ? unique.filter((x) => !s.knownSpells.includes(x.id)) : unique.filter((x) => s.knownSpells.includes(x.id));
    this.mount(
      'The six schools',
      `<div class="row spread" style="margin-bottom:18px"><small>${Math.ceil(s.mp)} / ${maxMagicka(s)} Magicka · ${s.knownSpells.length} spells learned</small><div class="row">${B('Known spells', 'magic', 'known', `small ${mode === 'known' ? 'primary' : ''}`)}${B('Learn spells', 'magic', 'learn', `small ${mode === 'learn' ? 'primary' : ''}`)}${B('Spellmaking', 'spellmaking', '', 'small')}</div></div>${mode === 'learn' ? '<div class="notice">Learning is available near a service sign or a friendly spellcaster. Catalogue spell costs and names come from the guide; implementation uses the effect-family rules described in the completion report.</div>' : ''}<div class="search-row"><input id="spell-search" placeholder="Search spells or schools…" aria-label="Search spells"></div><div class="buy-list" id="spell-list">${list.map((sp) => this.spellRow(sp, mode)).join('')}</div>`,
      { tabs: true },
    );
    this.spellList = list;
  }
  spellRow(sp, mode) {
    const s = this.g.state;
    const fee = 20 + sp.cost;
    return `<div class="inventory-item spell-row" data-search="${H((sp.name + ' ' + sp.school + ' ' + sp.effect).toLowerCase())}"><span class="icon">✧</span><div><div class="item-name">${H(sp.name)} ${s.selectedSpell === sp.id ? '<span class="tag current">Readied</span>' : ''}</div><div class="item-meta">${H(sp.school)} · ${sp.cost} MP · ${Math.round(spellChance(s, sp) * 100)}% cast chance</div><small style="font-size:10px">${H(sp.effect)} · ${sp.magnitude || 1} points · ${sp.duration || 1}s · ${H(sp.target || 'Self')}</small></div>${mode === 'learn' ? B(`${fee} dr · Learn`, 'learn', sp.id, 'small', s.gold < fee || !this.g.nearServices()) : B('Ready', 'ready-spell', sp.id, 'small')}</div>`;
  }
  spellmaking() {
    this.screen = 'spellmaking';
    const c = this.g.catalogue,
      s = this.g.state;
    const knownEffects = [
      ...new Map(
        [...START_SPELLS, ...s.customSpells, ...c.spells]
          .filter((x) => s.knownSpells.includes(x.id))
          .map((x) => [x.effect, x.school]),
      ).entries(),
    ];
    this.mount(
      'Name your own magic',
      `<p>A spellmaker can reshape effects you already understand. Magnitude, duration, and range affect the price and Magicka cost.</p><div class="grid two"><label>Name<input id="make-name" maxlength="40" value="Outlander’s Art"></label><label>Known effect<select id="make-effect">${knownEffects.map(([e, sch]) => `<option value="${H(e)}" data-school="${H(sch)}">${H(e)} · ${H(sch)}</option>`).join('')}</select></label><label>Magnitude<input id="make-magnitude" type="number" min="1" max="80" value="20"></label><label>Duration in seconds<input id="make-duration" type="number" min="1" max="60" value="5"></label><label>Range<select id="make-target"><option>Self</option><option>Touch</option><option>Target</option></select></label></div><div id="make-cost" class="notice"></div>${B('Create spell', 'make-spell', '', 'primary', !this.g.nearServices())}<small style="display:block;margin-top:15px">Spellmaking requires nearby services. This compact workshop creates one effect per spell; original multi-effect combinations are not recreated.</small>`,
    );
    this.spellCost();
  }
  spellCost() {
    const mag = +document.getElementById('make-magnitude').value,
      dur = +document.getElementById('make-duration').value,
      effect = document.getElementById('make-effect').value,
      target = document.getElementById('make-target').value;
    const base = this.g.catalogue.effects.find((x) => x.name === effect)?.baseCost || 2;
    const cost = Math.max(
      1,
      Math.ceil(base * clamp(mag, 1, 80) * Math.max(1, clamp(dur, 1, 60) * 0.1) * 0.12 * (target === 'Target' ? 1.5 : 1)),
    );
    document.getElementById('make-cost').textContent = `${cost} Magicka to cast · ${30 + cost * 2} drakes to create`;
  }
  journal() {
    this.screen = 'journal';
    const s = this.g.state,
      q = activeStep(s);
    this.mount(
      'The pages of your journey',
      `${q ? `<article class="quest-card current"><div class="eyebrow">${H(ACTS[q.act])} · Current undertaking</div><h3>${H(q.title)}</h3><p>${H(q.text)}</p><div class="row spread"><span class="quest-meta">${H(this.g.areaName(q.area))} · ${H(q.source)}</span>${B('Show destination', 'map', q.area, 'small')}</div></article>` : '<h3>Three prophecies fulfilled.</h3><p>The island still holds roads you have not travelled.</p>'}<h3 style="margin-top:25px">Other promises</h3>${
        SIDES.filter((side) => s.sides[side.id] || s.visited.includes(side.area))
          .map(
            (side) =>
              `<article class="quest-card"><span class="tag ${s.sides[side.id] === 2 ? 'done' : ''}">${s.sides[side.id] === 2 ? 'Completed' : s.sides[side.id] === 1 ? 'In progress' : 'Rumor'}</span><h3>${H(side.title)}</h3><p>${H(side.description)}</p><div class="quest-meta">${H(side.giver)} · ${H(this.g.areaName(side.area))}</div></article>`,
          )
          .join('') || '<p>Speak to people in the places you visit. Not every worthy task is part of a prophecy.</p>'
      }<h3 style="margin-top:25px">Completed chapters</h3>${
        s.journal
          .slice()
          .reverse()
          .map((j) => `<div class="stat"><span>${H(j.title)}</span><small>Day ${j.day}</small></div>`)
          .join('') || '<p>The first page is still blank.</p>'
      }`,
      { tabs: true },
    );
  }
  map(destination = '') {
    this.screen = 'map';
    const s = this.g.state,
      c = this.g.catalogue;
    const target = destination || activeStep(s)?.area || s.area;
    this.context = target;
    const region = c.areas.find((a) => a.id === target)?.region || 'wlk002';
    this.mapRegion = region;
    this.mount(
      'Roads, striders & sea passages',
      `<div class="map-layout"><div class="map-art"><svg viewBox="0 0 420 430" role="img" aria-label="Decorative schematic of Vvardenfell"><defs><pattern id="mapgrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#95a980" stroke-opacity=".12"/></pattern></defs><rect width="420" height="430" fill="url(#mapgrid)"/><path d="m178 41 46 19 21 33 31 8 19 36-8 21 35 40-13 27 27 40-15 35-32 6-3 43-42 28-41 6-21-15-48 5-28-27-34-15 8-50-19-35 23-20-8-39 25-28 10-48 29-16Z" fill="#70826a" fill-opacity=".28" stroke="#c0b480" stroke-width="1.2"/><path d="m131 282 13-70 47-66 62 57-23 87-50 52Z" fill="none" stroke="#b5a977" stroke-dasharray="3 6" stroke-opacity=".6"/><path d="m179 207 24-51 30 52-17-12-12 13-9-14Z" fill="#b99d6d" fill-opacity=".5"/><path d="M120 317 141 270 118 244 149 193 165 121M140 270 212 343 275 284 291 211 268 167 216 104" fill="none" stroke="#b6af7f" stroke-opacity=".5" stroke-dasharray="2 5"/><g fill="#d9bc7a">${[
        [120, 317],
        [141, 270],
        [118, 244],
        [149, 193],
        [165, 121],
        [212, 343],
        [275, 284],
        [291, 211],
        [268, 167],
        [216, 104],
      ]
        .map(([x, y]) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" transform="rotate(45 ${x} ${y})"/>`)
        .join(
          '',
        )}</g><g fill="#d6ceb0" font-family="Georgia" font-size="11"><text x="56" y="332">Seyda Neen</text><text x="62" y="269">Balmora</text><text x="218" y="352">Vivec</text><text x="257" y="194">Sadrith Mora</text><text x="105" y="112">Urshilaku</text><text x="154" y="235" font-size="10" letter-spacing="2">RED MOUNTAIN</text></g><g stroke="#c7b480" fill="none"><path d="m355 45 0 55m-20-27h40m-20-20 10 20-10-7-10 7Z"/></g><text x="351" y="36" fill="#c7b480" font-size="10">N</text></svg><div class="map-label">TRAVEL ATLAS · SCHEMATIC, NOT A GEOGRAPHIC MAP</div></div><div><div class="row spread"><small>${s.gold} drakes · ${s.visited.length} places visited</small>${B('Current objective', 'map', activeStep(s)?.area || s.area, 'small')}</div><label style="margin:14px 0">Region<select id="map-region">${c.regions.map((r) => option(r.id, region, r.name)).join('')}</select></label><input id="map-search" aria-label="Find any location" placeholder="Search all locations…" style="margin-bottom:12px"><div class="map-rows" id="map-rows"></div><div class="notice">${this.g.canTravel() ? 'Passage is available. Travel between cells in the same region is free; other routes cost 12 drakes.' : 'Find a route sign, shrine, or gate and move away from enemies to use travel services.'}</div></div></div>`,
      { tabs: true },
    );
    this.mapRows();
  }
  mapRows(search = '') {
    const s = this.g.state,
      c = this.g.catalogue;
    const rows = c.areas.filter((a) =>
      search ? a.name.toLowerCase().includes(search.toLowerCase()) : a.region === this.mapRegion,
    );
    document.getElementById('map-rows').innerHTML =
      rows
        .map((a) => {
          const gate = gateForArea(a.id, s),
            target = a.id === activeStep(s)?.area;
          return B(
            `<span>${target ? '◇ ' : ''}${H(a.name)}${gate ? '<br><small>' + H(gate) + '</small>' : ''}</span><small>${a.id === s.area ? 'HERE' : s.visited.includes(a.id) ? 'REVISIT' : 'TRAVEL'}</small>`,
            'travel',
            a.id,
            target ? 'quest-destination' : '',
            !!gate || a.id === s.area || !this.g.canTravel(),
          );
        })
        .join('') || '<p>No place matches that name.</p>';
  }
  character() {
    this.screen = 'character';
    const s = this.g.state,
      c = this.g.catalogue;
    this.mount(
      s.name,
      `<div class="row spread"><p class="lead">${H(s.race)} · ${H(s.class)} · ${H(s.sign)}</p><span class="tag current">Level ${s.level}</span></div><div class="grid three"><div class="panel"><div class="eyebrow">Attributes</div>${Object.entries(
        s.attrs,
      )
        .map(([a, v]) => `<div class="stat"><span>${a}</span><b>${v}</b></div>`)
        .join('')}</div><div class="panel"><div class="eyebrow">The living body</div>${[
        ['Health', Math.floor(maxHealth(s))],
        ['Magicka', maxMagicka(s)],
        ['Fatigue', maxFatigue(s)],
        ['Carry capacity', capacity(s)],
        ['Armor rating', Math.round(armorRating(s, c))],
        ['Skill gains this level', `${s.levelGains} / 10`],
        ['Bounty', `${s.bounty} dr`],
      ]
        .map(([n, v]) => `<div class="stat"><span>${n}</span><b>${v}</b></div>`)
        .join(
          '',
        )}<div class="notice">${s.pendingLevels.length ? 'You should rest and meditate on what you’ve learned.' : 'Raise major or minor skills ten times, then rest to advance. All skill gains contribute to attribute multipliers.'}</div></div><div class="panel"><div class="eyebrow">Allegiances</div>${
        Object.entries(s.factions)
          .map(([n, v]) => `<div class="stat"><span>${H(n)}</span><small>Rank ${v}</small></div>`)
          .join('') || '<p>No allegiances yet.</p>'
      }<hr><small>${H(SIGN_INFO[s.sign])}</small>${B('Use birthsign power', 'power', '', 'small', s.powerUsed)}</div></div><h3 style="margin-top:26px">Skills</h3><div class="skill-grid">${c.skills.map((sk) => `<div class="stat"><span class="${s.major.includes(sk.name) ? 'major' : ''}">${H(sk.name)}<br><small>${s.major.includes(sk.name) ? 'Major' : s.minor.includes(sk.name) ? 'Minor' : 'Miscellaneous'} · ${H(sk.attribute)}</small></span><b>${s.skills[sk.name]}</b></div>`).join('')}</div>`,
      { tabs: true },
    );
  }
  dialogue(actor) {
    this.screen = 'dialogue';
    this.context = actor;
    const s = this.g.state,
      q = activeStep(s);
    const relevant = q?.area === s.area && q.type === 'talk' && q.target === actor.name;
    const side = SIDES.filter((x) => x.giver === actor.name && x.area === s.area);
    const disp = this.g.disposition(actor.name);
    this.mount(
      actor.name,
      `<div class="dialogue-layout"><div><div class="eyebrow">${relevant ? H(q.title) : H(this.g.areaName(s.area))}</div><div class="dialogue-quote">${H(relevant ? this.g.dialogueLine(q) : actor.line || 'An unfamiliar face. There are roads enough for anyone, but not all of them are kind. What brings you here?')}</div><div class="topics stack">${relevant ? B(`${H(q.title)} <span>→</span>`, 'main-talk', actor.name, 'primary', disp < (q.disposition || 0)) : ''}${relevant && disp < (q.disposition || 0) ? `<small>You need ${q.disposition} disposition to earn this person’s support. Persuade or bribe them.</small>` : ''}${side.map((x) => B(`${s.sides[x.id] === 2 ? '✓ ' : s.sides[x.id] === 1 ? '↩ ' : ''}${H(x.title)}`, 'side-talk', x.id, '', s.sides[x.id] === 2)).join('')}${B('Barter · supplies & equipment', 'barter', actor.name)}${B('Spells & spellmaking', 'magic', 'learn')}${B('Local rumors', 'rumors', actor.name)}${B('Goodbye', 'resume', '', 'ghost')}</div></div><aside class="panel"><div class="row spread"><span class="eyebrow">Disposition</span><span class="gold">${disp} / 100</span></div><div class="disposition"><i style="width:${disp}%"></i></div><p style="font-size:12px">Reputation, a thoughtful word, or a little generosity may open a closed door.</p><div class="stack">${B('Admire', 'persuade', 'admire', 'small')}${B('Intimidate', 'persuade', 'intimidate', 'small')}${B('Bribe · 10 drakes', 'persuade', 'bribe', 'small', s.gold < 10)}</div><hr><small>Your Speechcraft: ${s.skills.Speechcraft}<br>Your Personality: ${s.attrs.Personality}</small></aside></div>`,
      { compact: false },
    );
  }
  barter(name) {
    this.screen = 'barter';
    this.context = name;
    const s = this.g.state;
    const stock = this.g.stock();
    this.mount(
      `${name} · Barter`,
      `<div class="row spread" style="margin-bottom:15px"><span class="gold">${s.gold} drakes</span><small>Prices account for Mercantile and disposition.</small></div><div class="grid two"><div><h3>Buy</h3><div class="buy-list">${stock
        .map((n) => {
          const i = itemInfo(n, this.g.catalogue),
            price = this.g.price(n, true, name);
          return `<div class="inventory-item"><span class="icon">${glyph[i.type]}</span><div><div class="item-name">${H(n)}</div><small>${i.damage ? i.damage + ' damage · ' : ''}${i.armor ? i.armor + ' armor · ' : ''}${i.weight} weight</small></div>${B(price + ' dr', 'buy', n, 'small', s.gold < price)}</div>`;
        })
        .join('')}</div></div><div><h3>Sell</h3><div class="buy-list">${Object.entries(s.inventory)
        .filter(([n]) => !ESSENTIAL.has(n) && !Object.values(s.equipment).includes(n))
        .map(
          ([n, q]) =>
            `<div class="inventory-item"><span class="icon">${glyph[itemInfo(n, this.g.catalogue).type]}</span><div><div class="item-name">${H(n)} <small>×${q}</small></div></div>${B(this.g.price(n, false, name) + ' dr', 'sell', n, 'small')}</div>`,
        )
        .join(
          '',
        )}</div></div></div><div class="notice">Merchants restock standard supplies. Unique artifacts cannot be sold accidentally. A small successful bargain improves Mercantile.</div>`,
    );
  }
  loot(obj) {
    this.screen = 'loot';
    this.context = obj;
    this.mount(
      obj.name,
      `<div class="stack">${
        obj.items
          .map((n) => {
            const i = itemInfo(n, this.g.catalogue);
            return `<div class="inventory-item"><span class="icon">${glyph[i.type]}</span><div><div class="item-name">${H(n)}</div><div class="item-meta">${i.weight} weight · ${i.value} drakes</div></div>${B('Take', 'take', n, 'small')}</div>`;
          })
          .join('') || '<p>The container is empty.</p>'
      }${B('Take all', 'take-all', '', 'primary', !obj.items.length)}${B('Leave', 'resume', '', 'ghost')}</div>`,
      { compact: true },
    );
  }
  lock(obj) {
    this.screen = 'lock';
    this.context = obj;
    const chance = this.g.lockChance(obj);
    this.mount(
      obj.name,
      `<p>A ${obj.locked}-point lock guards this container.${obj.trapped ? ' A faint magical hum suggests a trap.' : ''}</p><div class="notice">Security ${this.g.state.skills.Security} · ${Math.round(chance * 100)}% chance<br>A failed attempt spends a tool use. Open spells are an alternative; they do not disarm traps.</div><div class="stack">${obj.trapped ? B('Disarm trap with a probe', 'disarm', '', '') : ''}${obj.locked ? B('Try a lockpick', 'pick', '', 'primary') : B('Open container', 'open-container', '', 'primary')}${B('Cast readied Open spell', 'open-lock')}${B('Leave', 'resume', '', 'ghost')}</div>`,
      { compact: true },
    );
  }
  alchemy() {
    this.screen = 'alchemy';
    const s = this.g.state,
      c = this.g.catalogue;
    const items = Object.keys(s.inventory).filter((n) => itemInfo(n, c).type === 'ingredient');
    this.mount(
      'Mortar, pestle & possibility',
      `<p>Combine two ingredients with a shared effect. Brewing improves Alchemy; a useful potion is worth more than its raw ingredients.</p><div class="grid two"><label>First ingredient<select id="alchemy-a">${items.map((n) => option(n, items[0])).join('')}</select></label><label>Second ingredient<select id="alchemy-b">${items.map((n) => option(n, items[1])).join('')}</select></label></div><div class="notice">The introductory pair is Marshmerrow + Saltrice. Ingredient effects are indexed from the guide. Potion strength and success have been simplified for this adaptation.</div>${B('Brew a potion', 'brew', '', 'primary', items.length < 2)}`,
      { compact: true },
    );
  }
  enchantMenu() {
    this.screen = 'enchant';
    const s = this.g.state,
      c = this.g.catalogue;
    const items = Object.keys(s.inventory).filter((n) => ['weapon', 'armor', 'jewelry'].includes(itemInfo(n, c).type));
    this.mount(
      'A soul in the making',
      `<p>A filled soul gem can bind an effect to a weapon or a piece of clothing. Use Soul Trap before defeating a creature.</p><label>Item<select id="enchant-item">${items.map((n) => option(n, s.equipment.weapon)).join('')}</select></label><div class="notice">Weapons gain an on-strike Shock enchantment. Worn armor or jewelry gains constant Fatigue restoration. This workshop is a simplified subset of source enchanting.<br>Cost: one Filled Soul Gem and 80 drakes.</div>${B('Bind the enchantment', 'enchant', '', 'primary', s.gold < 80 || !s.inventory['Filled Soul Gem'])}`,
      { compact: true },
    );
  }
  repairMenu() {
    this.screen = 'repair';
    const s = this.g.state,
      c = this.g.catalogue;
    this.mount(
      'Tools before trouble',
      `<p>Worn weapons deal less damage. Damaged armor offers less protection. Repairing improves Armorer.</p><div class="stack">${Object.keys(
        s.inventory,
      )
        .filter((n) => ['weapon', 'armor'].includes(itemInfo(n, c).type))
        .map((n) =>
          B(`${H(n)} <small> · ${Math.round(s.condition[n] ?? 100)}%</small>`, 'repair', n, '', !(s.condition[n] < 100)),
        )
        .join('')}</div>`,
      { compact: true },
    );
  }
  puzzle(obj) {
    this.screen = 'puzzle';
    this.context = obj;
    const q = activeStep(this.g.state);
    if (!q) return this.resume();
    const n = this.g.state.puzzle;
    this.mount(
      obj.name,
      `<p class="dialogue-quote">${H(q.text)}</p><div class="ritual-slots">${q.pattern.map((_, i) => `<span class="${i < n ? 'lit' : ''}"></span>`).join('')}</div><div class="row" style="justify-content:center">${[...new Set(q.pattern)].map((x) => B(H(x.charAt(0).toUpperCase() + x.slice(1)), 'lever', x)).join('')}</div><div class="notice">${n ? 'The mechanism answers. Continue the sequence.' : 'The machine is waiting. A wrong input resets its sequence.'}</div>`,
      { compact: true },
    );
  }
  aspect(actor) {
    this.screen = 'aspect';
    this.context = actor;
    this.mount(
      'The Hunter’s question',
      `<p class="dialogue-quote">What is a hunter’s greatest strength? Choose the challenge you will face.</p><div class="stack">${B('Strength · slower, heavier blows', 'aspect', 'Strength')}${B('Speed · relentless pursuit', 'aspect', 'Speed')}${B('Guile · ranged magic', 'aspect', 'Guile')}</div><div class="notice">The choice changes Hircine’s attacks. Your reward is the Spear of the Hunter, following the guide’s preferred Guile route in this compact adaptation.</div>`,
      { compact: true },
    );
  }
  level() {
    this.screen = 'level';
    this.levelSelected = [];
    const s = this.g.state;
    const gains = s.pendingLevels[0];
    if (!gains) return this.resume();
    this.mount(
      'Rest and meditate',
      `<p class="lead">The lessons of the road begin to make sense.</p><p>Choose three attributes. Bonuses reflect the skills used before this level became available. Endurance determines your new Health gain.</p><div class="grid two">${Object.keys(
        s.attrs,
      )
        .map((a) =>
          B(`<span>${a} <small>${s.attrs[a]}</small></span><b>+${multiplier(gains, a)}</b>`, 'level-choose', a, 'level-choice'),
        )
        .join(
          '',
        )}</div><div class="notice" id="level-count">Choose 3 attributes.</div>${B('Awaken · level ' + (s.level + 1), 'level-confirm', '', 'primary', true)}`,
      { compact: true },
    );
  }
  ending() {
    this.screen = 'ending';
    const s = this.g.state;
    this.mount(
      'The ash remembers your name',
      `<div class="ending"><div class="ending-mark">✧</div><div class="eyebrow">THREE PROPHECIES FULFILLED</div><p class="lead">The Heart is silent. The false mercy is ended.<br>The Hunter has been bested.<br>For the first time, the next road belongs only to you.</p><div class="medallions"><span class="medallion">The Nerevarine</span><span class="medallion">The Tribunal</span><span class="medallion">The Bloodmoon</span></div><div class="grid four ending-stats">${[
        [s.level, 'Level'],
        [s.kills, 'Foes defeated'],
        [s.visited.length, 'Places visited'],
        [Math.floor(s.seconds / 60), 'Minutes played'],
      ]
        .map(([v, l]) => `<div><strong>${v}</strong><small>${l}</small></div>`)
        .join(
          '',
        )}</div><p>${Object.values(s.sides).filter((v) => v === 2).length} of ${SIDES.length} authored side undertakings completed · ${s.deaths} defeats overcome</p><div class="row" style="justify-content:center">${B('Continue wandering', 'resume', '', 'primary')}${B('Save & return to title', 'end-title')}</div><hr><small>Generated September 26, 2026 · GPT-6 Astra Pro<br>Guide: tarvis79 · Original procedural art and rewritten dialogue<br>An unofficial, internal non-commercial adaptation</small></div>`,
    );
  }
  death() {
    this.screen = 'death';
    this.mount(
      'The thread is not yet broken',
      `<p class="lead">An outlander’s road is seldom kind.</p><p>Return to your last saved moment. Try a different weapon, restore Fatigue before combat, or bring a spell that changes the odds.</p><div class="stack">${B('Load last saved journey', 'retry', '', 'primary')}${B('Options', 'options')}${B('Return to title', 'title', '', 'ghost')}</div>`,
      { compact: true },
    );
  }
  atlas(kind = 'areas') {
    this.screen = 'atlas';
    this.context = kind;
    this.mount(
      'The source atlas',
      `<p>This index was extracted from the supplied guide. <strong>Names in the catalogue are not a claim of fully scripted quest coverage.</strong> Areas are compact generated cells; loot uses adapted statistics. The completion report identifies omissions.</p><div class="search-row"><select id="atlas-kind">${['areas', 'items', 'quests', 'spells', 'npcs', 'effects'].map((k) => option(k, kind, k.charAt(0).toUpperCase() + k.slice(1))).join('')}</select><input id="atlas-search" aria-label="Search source catalogue" placeholder="Search the guide’s catalogue…"></div><div id="atlas-count" class="eyebrow" style="margin:12px 0"></div><div id="atlas-list" class="buy-list"></div>`,
      { tabs: true },
    );
    this.atlasRows();
  }
  atlasRows(search = '') {
    const kind = this.context || 'areas';
    const rows = this.g.catalogue[kind].filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
    document.getElementById('atlas-count').textContent = `${rows.length} entries · showing up to 100`;
    document.getElementById('atlas-list').innerHTML = rows
      .slice(0, 100)
      .map((x) => {
        const areas = x.areas || [x.id].filter((id) => this.g.catalogue.areas.some((a) => a.id === id));
        return `<div class="atlas-row"><span>${H(x.name)}</span> <span class="tag">${kind === 'quests' ? 'Reference entry' : kind === 'areas' ? 'Generated cell' : kind === 'npcs' ? 'Source record' : 'Adapted catalogue'}</span><small>${x.sourceLine ? 'Guide line ' + x.sourceLine + ' · ' : ''}${H(x.school || x.region || '')}${
          areas.length
            ? ' · ' +
              areas
                .map((id) => this.g.areaName(id))
                .slice(0, 3)
                .map(H)
                .join(' / ')
            : ''
        }</small>${kind === 'areas' ? B('Show in travel atlas', 'map', x.id, 'small') : ''}</div>`;
      })
      .join('');
  }
  action(action, arg) {
    const g = this.g,
      s = g.state;
    switch (action) {
      case 'title':
        g.toTitle();
        break;
      case 'create':
        this.create();
        break;
      case 'start':
        g.newGame(this.choice());
        break;
      case 'continue':
        g.continueGame();
        break;
      case 'close':
      case 'resume':
        s ? this.resume() : this.title();
        break;
      case 'pause':
        this.pause();
        break;
      case 'controls':
        this.controls();
        break;
      case 'options':
        this.options();
        break;
      case 'inventory':
        this.inventory();
        break;
      case 'filter-inventory':
        this.inventory(arg);
        break;
      case 'magic':
        this.magic(arg || 'known');
        break;
      case 'journal':
        this.journal();
        break;
      case 'map':
        this.map(arg);
        break;
      case 'character':
        this.character();
        break;
      case 'atlas':
        this.atlas(arg || 'areas');
        break;
      case 'travel':
        g.travel(arg);
        break;
      case 'interact':
        g.interact();
        break;
      case 'cast':
        g.cast();
        break;
      case 'slot':
        g.slot(+arg);
        break;
      case 'power':
        g.power();
        break;
      case 'save':
        g.save();
        break;
      case 'load':
        g.continueGame();
        break;
      case 'retry':
        g.retry();
        break;
      case 'fullscreen':
        g.fullscreen();
        break;
      case 'equip':
        g.equip(arg);
        this.inventory(this.tab);
        break;
      case 'drink':
        g.drink(arg);
        this.inventory(this.tab);
        break;
      case 'drop':
        g.drop(arg);
        this.inventory(this.tab);
        break;
      case 'read':
        g.read(arg);
        break;
      case 'use-ring':
        g.useRing(arg);
        this.inventory(this.tab);
        break;
      case 'ready-spell':
        s.selectedSpell = arg;
        g.toast(`${spellById(s, g.catalogue, arg).name} readied.`);
        this.magic();
        break;
      case 'learn':
        g.learn(arg);
        this.magic('learn');
        break;
      case 'main-talk':
        g.completeTalk(this.context);
        break;
      case 'side-talk':
        g.sideTalk(arg, this.context);
        break;
      case 'persuade':
        g.persuade(this.context, arg);
        this.dialogue(this.context);
        break;
      case 'barter':
        this.barter(arg);
        break;
      case 'buy':
        g.buy(arg, this.context);
        this.barter(this.context);
        break;
      case 'sell':
        g.sell(arg, this.context);
        this.barter(this.context);
        break;
      case 'rumors':
        g.rumors(this.context);
        break;
      case 'open-container':
        g.openContainer(this.context);
        break;
      case 'take':
        g.take(this.context, arg);
        if (this.screen === 'loot' && this.context?.items) this.loot(this.context);
        break;
      case 'take-all':
        g.takeAll(this.context);
        break;
      case 'pick':
        g.pick(this.context);
        break;
      case 'disarm':
        g.disarm(this.context);
        break;
      case 'open-lock':
        g.openLock(this.context);
        break;
      case 'alchemy':
        this.alchemy();
        break;
      case 'brew':
        g.brew(document.getElementById('alchemy-a').value, document.getElementById('alchemy-b').value);
        this.alchemy();
        break;
      case 'enchant-menu':
        this.enchantMenu();
        break;
      case 'enchant':
        g.enchant(document.getElementById('enchant-item').value);
        this.enchantMenu();
        break;
      case 'repair-menu':
        this.repairMenu();
        break;
      case 'repair':
        g.repair(arg);
        this.repairMenu();
        break;
      case 'spellmaking':
        this.spellmaking();
        break;
      case 'make-spell': {
        const el = document.getElementById('make-effect');
        g.makeSpell({
          name: document.getElementById('make-name').value,
          effect: el.value,
          school: el.selectedOptions[0].dataset.school,
          magnitude: document.getElementById('make-magnitude').value,
          duration: document.getElementById('make-duration').value,
          target: document.getElementById('make-target').value,
        });
        break;
      }
      case 'lever':
        g.lever(arg);
        break;
      case 'aspect':
        g.chooseAspect(arg, this.context);
        break;
      case 'level-choose': {
        const i = this.levelSelected.indexOf(arg);
        if (i >= 0) this.levelSelected.splice(i, 1);
        else if (this.levelSelected.length < 3) this.levelSelected.push(arg);
        this.root
          .querySelectorAll('[data-action="level-choose"]')
          .forEach((b) => b.classList.toggle('selected', this.levelSelected.includes(b.dataset.arg)));
        document.getElementById('level-count').textContent = `${this.levelSelected.length} / 3 attributes selected.`;
        this.root.querySelector('[data-action="level-confirm"]').disabled = this.levelSelected.length !== 3;
        break;
      }
      case 'level-confirm':
        g.level(this.levelSelected);
        break;
      case 'kit-settings':
        this.g.kit.menu.open();
        break;
      case 'export':
        g.exportSave();
        break;
      case 'import':
        document.getElementById('save-import').click();
        break;
      case 'end-title':
        g.save(false);
        g.toTitle();
        break;
    }
  }
  change(e) {
    const id = e.target.id;
    if (id.startsWith('char-')) this.characterPreview();
    if (id.startsWith('option-')) this.optionChange(e.target);
    if (id === 'map-region') {
      this.mapRegion = e.target.value;
      document.getElementById('map-search').value = '';
      this.mapRows();
    }
    if (id === 'atlas-kind') {
      this.context = e.target.value;
      this.atlasRows(document.getElementById('atlas-search').value);
    }
    if (id.startsWith('make-')) this.spellCost();
    if (id === 'save-import' && e.target.files[0]) this.g.importSave(e.target.files[0]);
  }
  input(e) {
    const id = e.target.id;
    if (id === 'map-search') this.mapRows(e.target.value);
    if (id === 'atlas-search') this.atlasRows(e.target.value);
    if (id === 'spell-search') {
      const q = e.target.value.toLowerCase();
      this.root.querySelectorAll('.spell-row').forEach((r) => (r.hidden = !r.dataset.search.includes(q)));
    }
    if (id.startsWith('make-') && id !== 'make-name') this.spellCost();
    if (id.startsWith('option-') && e.target.type === 'range') this.optionChange(e.target);
  }
  optionChange(el) {
    const key = el.id.replace('option-', '');
    const value = el.type === 'checkbox' ? el.checked : el.type === 'range' || key === 'difficulty' ? +el.value : el.value;
    // Quality, sensitivity and invert are the kit's shared settings, the same ones its F9 panel shows.
    if (KIT_SETTINGS.includes(key)) {
      this.g.kit.settings.set({ [key]: value });
      return;
    }
    this.g.options[key] = value;
    this.g.applyOptions();
  }
}
