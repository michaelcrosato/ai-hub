import { BUILD, SYSTEMS, SYSTEM, SHIPS, SHIP, OUTFITS, COMMODITIES, CAMPAIGN, SIDE_QUESTS, DIFFICULTY } from './content.js';
import { cargoUsed, bunksUsed, money, price, route, jobsAt, canAccess, clamp, sideOffers, oreName } from './core.js';
import { PORT, SCAN } from './sim.js';
import { focusKey, findByKey } from './nav.js';
export const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const e = escapeHTML;
const btn = (action, text, id = '', klass = '', disabled = false) =>
  `<button data-action="${e(action)}" data-id="${e(id)}" class="${klass}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const glyph = (kind = 'shuttle') =>
  `<svg viewBox="0 0 110 90" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2"><path d="${kind === 'barge' ? 'M25 24H85V70H25Z M34 15H76V24H34Z M18 33H25V63H18Z M85 33H92V63H85Z' : 'M55 8L68 28V43L93 61V70H69V78H41V70H17V61L42 43V28Z'}" fill="currentColor" fill-opacity=".13"/><path d="M45 29H65V47H45Z" fill="currentColor" fill-opacity=".3"/><path d="M43 58H67V70H43Z M44 80V86M55 81V89M66 80V86"/><circle cx="32" cy="58" r="3"/><circle cx="78" cy="58" r="3"/><circle cx="49" cy="53" r="2"/><circle cx="61" cy="53" r="2"/></g></svg>`;
const logo = `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 3L22 14L32 25L21 22L18 32L15 22L4 25L14 14Z" fill="none" stroke="#9edbc3" stroke-width="1.3"/><path d="M18 10V23M11 23L18 19L25 23" fill="none" stroke="#9edbc3" stroke-width="1.2"/></svg>`;
function statline(label, value) {
  return `<div class="statline"><span>${e(label)}</span><b>${e(value)}</b></div>`;
}
function meter(name, label, klass = '') {
  return `<div class="meter ${klass}"><div class="meter-head"><span>${label}</span><span id="${name}-text">—</span></div><div class="meter-track"><div class="meter-fill" id="${name}-fill"></div></div></div>`;
}
/** Button prompts for the HUD, per input device (touch shows none: the buttons are tapped). */
const PROMPTS = {
  keyboard: { map: 'M', missions: 'N', fleet: 'G', log: 'I', land: 'L', jump: 'J', board: 'B', hail: 'H', scanHelp: 'E', target: 'Tab' },
  gamepad: { map: 'View', land: 'D↓', jump: 'D↑', board: 'D←', hail: 'D→', scanHelp: 'Y', target: 'LB' },
  touch: {},
};
const kbd = (key) => `<kbd data-prompt="${key}">${PROMPTS.keyboard[key]}</kbd>`;
/** DOM menus and HUD. All mutations are routed through a single action callback. */
export class UI {
  constructor(root, model, callbacks = {}) {
    this.root = root;
    this.model = model;
    this.callbacks = callbacks;
    this.panel = 'title';
    this.portTab = 'spaceport';
    this.shipSelection = 'shuttle';
    this.mapSelection = 'sirius';
    this.ready = false;
    this.hasSave = false;
    this.engineMessage = 'Preparing your corner of the galaxy…';
    this.engineError = false;
    this.backend = 'Initializing';
    this.quality = 'Balanced';
    this.settings = {};
    this.data = null;
    this.lastFocus = null;
    this.records = [];
    this.source = 'keyboard';
    this.renderedPanel = undefined;
    this.textCache = new Map();
    this.els = new Map();
    this.labelSpecs = [];
    this.labelEls = new Map();
    this._pt = { x: 0, y: 0, visible: false };
    this.root.innerHTML = `<canvas id="world" aria-label="Three-dimensional top-down space flight"></canvas><div id="vignette"></div><div id="hit-flash"></div><div id="warp"></div>
   <div id="hud"><div class="topbar"><div class="brandmark">${logo}<div><div class="brand-title">STARLIGHT DRIFTER</div><div class="brand-sub">INDEPENDENT CAPTAIN’S LOG</div></div></div><div class="separator"></div><div class="location"><span id="region">THE DIRT BELT</span><strong id="system-name">Rutilicus system</strong></div><div class="spacer"></div><div class="topstats"><div><small>AVAILABLE CREDITS</small><strong id="credits">3,400</strong></div><div class="day-stat"><small>SHIP’S DAY</small><strong id="day">001</strong></div></div>${btn('options', '⚙', '', 'icon')}${btn('pause', 'Ⅱ', '', 'icon')}</div>
   <nav class="topnav" aria-label="Ship navigation">${btn('map', `Star chart ${kbd('map')}`)}${btn('missions', `Missions ${kbd('missions')}`)}${btn('fleet', `Fleet ${kbd('fleet')}`)}${btn('log', `Captain’s log ${kbd('log')}`)}</nav>
   <aside class="objective"><header><span class="eyebrow">YOUR NEXT HORIZON</span><span class="step" id="chapter">01 / 10</span></header><h4 id="objective-title"></h4><p id="objective-detail"></p><div class="row">${btn('objective', 'Plot mission route', '', 'small')}${btn('missions', 'Details', '', 'small ghost')}</div></aside>
   <section class="instruments" aria-label="Ship instruments"><div class="ship-heading"><b id="ship-name">Shuttle</b><span id="flight-state">DOCKED</span></div>${meter('shield', 'SHIELDS')}${meter('hull', 'HULL', 'hull')}<div class="meter-grid">${meter('energy', 'ENERGY', 'energy')}${meter('heat', 'HEAT', 'heat')}</div><div class="ship-readout"><span id="fuel">FUEL 4 / 4</span><span id="hold">HOLD 0 / 24</span></div></section>
   <div class="flight-actions">${btn('land', `Land ${kbd('land')}`)}${btn('jump', `Jump ${kbd('jump')}`)}${btn('board', `Board ${kbd('board')}`)}${btn('hail', `Hail ${kbd('hail')}`)}${btn('scanHelp', `Scan ${kbd('scanHelp')}`)}${btn('target', `Target ${kbd('target')}`)}</div>
   <aside class="scanner"><div class="scanner-label"><span>LOCAL SCANNER</span><span>120 AU</span></div><canvas id="radar" width="300" height="300" aria-label="Local radar: hostiles red, allies green, port white"></canvas></aside><div id="labels"></div><div id="flight-mode"></div>
   <div id="boss-bar" hidden><div class="boss-head"><span id="boss-name">THE CORSAIR</span><span id="boss-text"></span></div><div class="meter-track"><div class="meter-fill" id="boss-fill"></div></div></div></div>
   <div id="diagnostics" aria-live="off">INITIALIZING</div><div id="toasts" aria-live="polite" aria-atomic="false"></div><div id="overlay"></div><input type="file" id="save-file" accept=".json,application/json" hidden>`;
    this.overlay = this.root.querySelector('#overlay');
    this.canvas = this.root.querySelector('#world');
    this.radar = this.root.querySelector('#radar');
    this.context = this.radar.getContext('2d');
    this.root.addEventListener('click', (event) => {
      const b = event.target.closest('[data-action]');
      if (!b || b.disabled) return;
      const { action, id } = b.dataset;
      this.callbacks.action?.(action, id, b, event);
    });
    this.root.addEventListener('change', (event) => {
      const control = event.target;
      if (control.dataset.option)
        this.callbacks.option?.(control.dataset.option, control.type === 'checkbox' ? control.checked : control.value);
    });
    this.root.addEventListener('input', (event) => {
      if (event.target.dataset.option && event.target.type === 'range')
        this.callbacks.option?.(event.target.dataset.option, Number(event.target.value));
    });
    this.overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const all = [...this.overlay.querySelectorAll('button:not([disabled]),input:not([type=hidden]),select,a[href]')].filter(
        (el) => el.getClientRects().length,
      );
      if (!all.length) return;
      const first = all[0],
        last = all.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    });
    this.show('title');
  }
  get s() {
    return this.model.s;
  }
  get st() {
    return this.model.st;
  }
  setModel(model) {
    this.model = model;
    this.refreshHUD();
  }
  engine(status, error = false) {
    this.engineMessage = status;
    this.engineError = error;
    if (this.panel === 'title') this.render();
  }
  show(panel, data = null) {
    const same = panel === this.panel;
    if (!same && !this.overlay.contains(document.activeElement)) this.lastFocus = document.activeElement;
    this.panel = panel;
    this.data = data;
    this.render();
    this.callbacks.panel?.(panel);
    // Put focus on the panel's main action (keyboard and controller menus start there), unless a re-render kept it.
    if (panel && panel !== 'title' && !(same && this.overlay.contains(document.activeElement)))
      requestAnimationFrame(() => {
        if (!this.overlay.contains(document.activeElement)) this.focusDefault();
      });
  }
  focusDefault() {
    const o = this.overlay;
    const el =
      o.querySelector('.panel-content button.primary:not([disabled])') ||
      o.querySelector('.panel-foot button.primary:not([disabled])') ||
      o.querySelector('.panel-head .close, button:not([disabled]), input');
    el?.focus({ preventScroll: true });
  }
  close() {
    this.show(null);
    if (this.lastFocus?.isConnected && !this.lastFocus.closest('#hud')) this.lastFocus.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
  }
  render() {
    const hud = this.root.querySelector('#hud');
    hud.inert = !!this.panel;
    hud.setAttribute('aria-hidden', String(!!this.panel));
    document.body.classList.toggle('title-mode', this.panel === 'title' || this.panel === 'new' || !this.callbacks.playing?.());
    document.body.classList.toggle('panel-open', !!this.panel);
    // Re-rendering the same panel (a purchase, a new selection) keeps focus and scroll where they were.
    const samePanel = this.renderedPanel === this.panel;
    const active = document.activeElement;
    const key = samePanel && this.overlay.contains(active) ? focusKey(active) : '';
    const scroll = samePanel ? this.overlay.querySelector('.panel-content')?.scrollTop || 0 : 0;
    this.renderedPanel = this.panel;
    if (!this.panel) {
      this.overlay.innerHTML = '';
      return;
    }
    const methods = {
      title: 'renderTitle',
      new: 'renderNew',
      port: 'renderPort',
      map: 'renderMap',
      missions: 'renderMissions',
      fleet: 'renderFleet',
      log: 'renderLog',
      controls: 'renderControls',
      options: 'renderOptions',
      about: 'renderAbout',
      pause: 'renderPause',
      board: 'renderBoard',
      debrief: 'renderDebrief',
      results: 'renderResults',
      rescue: 'renderRescue',
      confirm: 'renderConfirm',
    };
    this.overlay.innerHTML = this[methods[this.panel] || 'renderPause']();
    if (scroll) {
      const content = this.overlay.querySelector('.panel-content');
      if (content) content.scrollTop = scroll;
    }
    if (key) findByKey(this.overlay, key)?.focus({ preventScroll: true });
  }
  shell(title, eyebrow, body, { compact = false, foot = '', tabs = '', closable = true } = {}) {
    return `<div class="overlay-backdrop"></div><section class="panel ${compact ? 'compact' : ''}" role="dialog" aria-modal="true" aria-label="${e(title)}"><header class="panel-head"><div><div class="eyebrow">${eyebrow}</div><h2>${e(title)}</h2></div>${closable ? btn('close', '×', '', 'close') : this.panel === 'port' ? btn('options', '⚙', '', 'icon') : ''}</header>${tabs}<div class="panel-content">${body}</div>${foot ? `<footer class="panel-foot">${foot}</footer>` : ''}</section>`;
  }
  renderTitle() {
    return `<section class="title-overlay"><div class="title-decor">AN ENDLESS SKY–INSPIRED VOYAGE</div><div class="title-cross">+</div><div class="title-content"><div class="title-kicker">A SHIP. A DEBT. AN OPEN HORIZON.</div><h1>Starlight<em>Drifter.</em></h1><p>Make a living between the stars.<br>Find your people. Choose what is worth fighting for.</p><div class="actions">${btn(this.hasSave ? 'continue' : 'new', this.hasSave ? 'Continue your journey <span aria-hidden="true">↗</span>' : 'Begin your journey <span aria-hidden="true">↗</span>', '', 'primary', !this.ready)}${this.hasSave ? btn('new', 'New captain', '', '', !this.ready) : btn('controls', 'Flight handbook')}</div><div class="title-links">${btn('options', 'Options', '', 'ghost')}${btn('controls', 'Controls', '', 'ghost')}${btn('about', 'About this voyage', '', 'ghost')}</div><div class="engine-message ${this.engineError ? 'error' : ''}" role="status">${e(this.engineMessage)}${this.engineError ? ` ${btn('retry', 'Retry engine', '', 'small')}` : ''}</div></div><div class="title-note"><small>RUTILICUS · NEW BOSTON</small><b>Every journey starts somewhere.</b></div><footer class="title-footer"><div>GENERATED ${BUILD.date}<br>${BUILD.model.toUpperCase()} · BUILD ${BUILD.version}</div><div class="footer-right">${this.records[0] ? `BEST VOYAGE · ${this.records[0].minutes} MIN · ${e(this.records[0].name.toUpperCase())}` : 'TRADE / EXPLORE / SURVIVE'}<br>LOCAL SAVE · KEYS · CONTROLLER · TOUCH</div></footer></section>`;
  }
  renderNew() {
    const starters = SHIPS.filter((s) => s.starter);
    return this.shell(
      'Your first command',
      'CAPTAIN’S REGISTRATION / NEW BOSTON',
      `<p style="margin-top:0">The shipyard has three affordable ships. Each comes with a mortgage—and a different way to make your living.</p><div class="card-grid">${starters.map((s) => `<article class="card selectable ${s.id === this.shipSelection ? 'selected' : ''}"><button class="ghost" data-action="selectShip" data-id="${s.id}" style="position:absolute;inset:0;width:100%;height:100%;z-index:1" aria-label="Select ${s.name}" aria-pressed="${s.id === this.shipSelection}"></button><div class="card-icon">${glyph(s.id)}</div><div class="eyebrow">${s.role}</div><h3>${s.name}</h3><p>${s.desc}</p>${statline('Cargo hold', s.cargo + ' t')}${statline('Passenger berths', s.bunks)}${statline('Shield / hull', s.shield + ' / ' + s.hull)}${statline('Outfit space', s.slots + ' t')}</article>`).join('')}</div><div class="start-form"><label for="captain-name">CAPTAIN’S NAME<input id="captain-name" maxlength="24" placeholder="Captain" value="${e(this.captainName || '')}" autocomplete="off"></label>${btn('start', 'Sign the papers & launch ↗', '', 'primary', !this.ready)}</div><div class="rule"></div><div class="note">You begin docked with <b>3,400 credits</b> and a <b>12,500-credit mortgage</b>. Start with the spaceport’s first contract, or make your own way. Repairs and refueling are free at every port.</div>`,
      { foot: 'Your choices are saved on this device. Starting a new captain replaces its existing save.' },
    );
  }
  renderPort() {
    const sy = SYSTEM[this.s.system],
      tabs = ['spaceport', 'trading', 'outfitter', 'shipyard', 'jobs', 'bank'];
    const tabMarkup = `<nav class="tabs" aria-label="Port services">${tabs.map((t) => btn('portTab', { spaceport: 'Spaceport', trading: 'Trading', outfitter: 'Outfitter', shipyard: 'Shipyard', jobs: 'Job board', bank: 'Bank & crew' }[t], t, t === this.portTab ? 'active' : '')).join('')}</nav>`;
    let body =
      {
        spaceport: () => this.spaceport(),
        trading: () => this.trading(),
        outfitter: () => this.outfitter(),
        shipyard: () => this.shipyard(),
        jobs: () => this.jobs(),
        bank: () => this.bank(),
      }[this.portTab]?.() || '';
    return this.shell(sy.planet, `${e(sy.name.toUpperCase())} / ${e(sy.faction.toUpperCase())} SPACE`, body, {
      tabs: tabMarkup,
      closable: false,
      foot: `<span><span class="accent">●</span> Docked · Repaired · Refueled &nbsp; / &nbsp; ${money(this.s.credits)} cr</span><div class="row">${btn('map', 'Star chart', '', 'small')}${btn('launch', 'Depart port ↗', '', 'primary')}</div>`,
    });
  }
  spaceport() {
    const q = this.model.quest,
      atContact = q && !this.s.activeStory && q.from === this.s.system;
    const sides = sideOffers(this.s);
    return `<div class="two-col"><section>${atContact ? this.storyOffer(q) : this.s.activeStory ? `<div class="eyebrow">ACTIVE CAMPAIGN</div><h3 style="margin-top:9px">${e(q.title)}</h3><p>${e(this.objectiveText())}</p><div class="mission-metadata"><div><small>DESTINATION</small><strong>${e(SYSTEM[q.to].name)}</strong></div><div><small>PAYMENT</small><strong class="orange">${money(q.reward)} cr</strong></div><div><small>STATUS</small><strong>In progress</strong></div></div>${btn('objective', 'Plot mission route ↗', '', 'primary')}` : q ? `<div class="eyebrow">A MESSAGE IS WAITING</div><h3 style="margin-top:10px">${e(q.title)}</h3><p>Your next contact is at <b>${e(SYSTEM[q.from].planet)}</b>, in the ${e(SYSTEM[q.from].name)} system.</p>${btn('objective', 'Plot contact route ↗', '', 'primary')}` : `<div class="eyebrow">THE LANES ARE OPEN</div><h3 style="margin-top:10px">The story continues with you.</h3><p>Explore the frontier, build a trading fleet, or seek out the optional expeditions. The galaxy is yours to travel.</p>${btn('results', 'View your journey', '', 'primary')}`}${sides.length ? `<div class="rule"></div><div class="eyebrow">SPACEPORT CONVERSATIONS</div>${sides.map((q) => `<div style="margin-top:17px"><h4>${e(q.name)}</h4>${q.kind === 'hunt' ? `<div class="eyebrow orange" style="margin-top:6px">COMBAT EXPEDITION · ${e(SYSTEM[q.to].name.toUpperCase())}</div>` : ''}<p class="small-text">${e(q.text)}</p><div class="row between"><span class="mono orange small-text">${money(q.reward)} cr</span>${btn('acceptSide', 'Accept expedition', q.id, 'small')}</div></div>`).join('')}` : ''}</section><aside class="port-info"><div class="port-scene"><span class="eyebrow">${e(SYSTEM[this.s.system].region)}</span><h3>${e(SYSTEM[this.s.system].planet)}</h3></div><p class="small-text" style="line-height:1.8">${e(SYSTEM[this.s.system].desc)}</p><div class="service-list"><div><span>Landing services</span><b class="accent">Complimentary</b></div><div><span>Local economy</span><span>${e(SYSTEM[this.s.system].economy)}</span></div><div><span>Traffic risk</span><span class="orange">${['Peaceful', 'Patrolled', 'Contested', 'Dangerous', 'War zone'][SYSTEM[this.s.system].danger]}</span></div><div><span>Current hull</span><span>${SHIP[this.s.ship].name}</span></div></div></aside></div>`;
  }
  storyOffer(q) {
    return `<div class="contact"><div class="portrait-mark">${e(q.contact.slice(0, 1))}</div><div><b>${e(q.contact.split(' · ')[0])}</b><small>${e(q.contact.split(' · ')[1] || 'Mission contact')}</small></div><span class="status-pill" style="margin-left:auto">STORY CONTRACT</span></div><div class="eyebrow">${e(q.chapter)}</div><h3 style="font-size:27px;margin-top:9px">${e(q.title)}</h3><p class="mission-copy">${e(q.text)}</p><div class="mission-metadata"><div><small>DESTINATION</small><strong>${e(SYSTEM[q.to].name)}</strong></div><div><small>PAYMENT</small><strong class="orange">${money(q.reward)} cr</strong></div><div><small>REQUIREMENT</small><strong>${q.cargo ? `${q.cargo} t of cargo` : q.passengers ? `${q.passengers} berths` : q.enemies ? `${q.enemies} hostiles` : 'Explore'}</strong></div></div><div class="row wrap">${q.choice ? `${btn('acceptStory', 'Fly with the Free Worlds', 'freeworlds', 'primary')}${btn('acceptStory', 'Help as an independent', 'independent')}` : btn('acceptStory', 'Accept this contract ↗', '', 'primary')}${btn('portTab', 'Not just yet', 'jobs', 'ghost')}</div>${q.choice ? '<p class="small-text">Both choices support the relief effort. Your choice changes your standing and the closing report, not the route through this compact campaign.</p>' : ''}`;
  }
  trading() {
    return `<div class="section-head"><div><h3>Cargo exchange</h3><p class="small-text">Local prices · No transaction tax · Same-port buying and selling use the same price.</p></div><span class="status-pill">${cargoUsed(this.s)} / ${this.st.cargo} t occupied</span></div><div class="table-scroll"><table class="market"><thead><tr><th>COMMODITY</th><th>PRICE / TON</th><th>IN HOLD</th><th style="text-align:right">TRADE</th></tr></thead><tbody>${COMMODITIES.map((c) => `<tr><td><span class="commodity-icon">${c.icon}</span><strong>${c.name}</strong></td><td class="price">${money(price(c.id, this.s.system, this.s.day))} cr</td><td class="mono">${this.s.cargo[c.id] || '—'} t</td><td class="controls">${btn('sell5', '−5', c.id, '', !this.s.cargo[c.id])}${btn('sell', '−1', c.id, '', !this.s.cargo[c.id])}${btn('buy', '+1', c.id)}${btn('buy5', '+5', c.id)}</td></tr>`).join('')}</tbody></table></div><div class="note" style="margin-top:19px">A useful first route: <b>food from Sirius to Sol</b>. Compare destination prices on the star chart. Contracts reserve cargo capacity until delivered or canceled.</div>`;
  }
  outfitter() {
    return `<div class="section-head"><div><h3>Make it your own.</h3><p class="small-text">Installed equipment transfers with your flagship. Removal returns 70% of its price.</p></div><span class="status-pill">${this.st.used} / ${this.st.slots} outfit tons</span></div><div class="item-grid">${OUTFITS.map(
      (o) => {
        const n = this.s.outfits[o.id] || 0,
          locked = (o.unlock && this.s.story < o.unlock) || (o.alien && !SYSTEM[this.s.system].alien);
        return `<article class="item ${locked ? 'locked' : ''}"><header><div><div class="eyebrow" style="font-size:8px;margin-bottom:7px">${o.type}</div><h4>${e(o.name)}</h4></div><span class="price">${o.id === 'jump' && this.s.jumpVoucher ? 'FREE CORE' : money(o.cost) + ' cr'}</span></header><p>${e(o.desc)}</p><footer><small>${o.space} t · ${n} / ${o.max} fitted${locked ? (o.alien ? ' · Alien space' : ' · Campaign unlock') : ''}</small><div class="row" style="gap:5px">${btn('removeOutfit', '−', o.id, 'small', !n)}${btn('buyOutfit', 'Install', o.id, 'small', !!locked || n >= o.max)}</div></footer></article>`;
      },
    ).join(
      '',
    )}</div><div class="rule"></div><div class="row between"><span>Missile stores: <b class="orange">${this.s.ammo}</b></span>${btn('ammo', '10 missiles · 600 cr', '', 'small', !this.st.launcher)}</div>`;
  }
  shipyard() {
    return `<div class="section-head"><div><h3>Room for bigger plans.</h3><p class="small-text">Trade-in allowance: ${money(Math.round((SHIP[this.s.ship].price || 4500) * 0.6))} cr. Escorts have stock equipment.</p></div><span class="status-pill">${this.s.escorts.length} / 5 escorts</span></div><div class="item-grid">${SHIPS.filter(
      (s) => !s.starter,
    )
      .map((s) => {
        const locked = (s.unlock && this.s.story < s.unlock) || (s.alien && !SYSTEM[this.s.system].alien);
        return `<article class="item ${locked ? 'locked' : ''}"><header><div><div class="eyebrow" style="font-size:8px;margin-bottom:7px">${s.role}</div><h4>${s.name}</h4></div><span class="price">${money(s.price)} cr</span></header><p>${s.desc}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px">${statline('Hold', s.cargo + ' t')}${statline('Berths', s.bunks)}${statline('Shields', s.shield)}${statline('Outfits', s.slots + ' t')}</div><footer><small>${locked ? (s.alien ? 'ALIEN SHIPYARD' : 'CAMPAIGN UNLOCK') : s.id === this.s.ship ? 'CURRENT FLAGSHIP' : `${s.hull} HULL · ${s.guns} GUNS`}</small><div class="row" style="gap:5px">${btn('buyEscort', '+ Escort', s.id, 'small', !!locked)}${btn('buyShip', 'Buy flagship', s.id, 'small', !!locked || s.id === this.s.ship)}</div></footer></article>`;
      })
      .join('')}</div>`;
  }
  jobs() {
    const jobs = jobsAt(this.s);
    return `<div class="section-head"><div><h3>Honest work. Open space.</h3><p class="small-text">Complete contracts by landing at their destination. Offers refresh every three ship days.</p></div><span class="status-pill">${this.s.jobs.length} / 6 accepted</span></div><div class="job-list">${jobs.map((j) => `<article class="job"><div class="job-symbol">${j.kind === 'bounty' ? '⌖' : j.kind === 'passengers' ? '♧' : j.kind === 'ore' ? '⬡' : '▧'}</div><div class="job-body"><h4>${j.name} → ${e(SYSTEM[j.to].name)}</h4><p>${j.kind === 'ore' ? `${j.amount} t ${oreName(j.ore)} to mine and deliver` : j.cargo ? j.cargo + ' t cargo' : j.passengers ? j.passengers + ' passengers' : j.enemies + ' marked raiders'} · ${route(this.s.system, j.to, this.s)?.length || 0} jump(s)</p></div><span class="job-reward">${money(j.reward)} cr</span>${btn('acceptJob', 'Accept', j.id, 'small')}</article>`).join('') || '<p>No further work available today. Check back after your next voyage.</p>'}</div><div class="rule"></div><h4>Already aboard</h4>${this.s.jobs.length ? this.jobEntries() : `<p class="small-text">No accepted contracts. The spaceport also has your next story mission.</p>`}`;
  }
  bank() {
    return `<div class="two-col"><section><div class="eyebrow">INDEPENDENT CAPTAIN’S CREDIT UNION</div><h3 style="font-size:34px;margin:12px 0">${money(this.s.debt)} <span class="muted" style="font-size:17px">cr remaining</span></h3><p>Your mortgage accrues 0.15% interest per ship day. When funds allow, 150 credits are paid automatically. Time advances on launch and on each jump—not while reading.</p><div class="row wrap" style="margin-top:22px">${btn('pay1000', 'Pay 1,000 cr', '', 'primary', this.s.debt === 0)}${btn('payAll', 'Clear mortgage', '', '', this.s.debt === 0)}${btn('borrow', 'Borrow 5,000 cr', '', '', this.s.debt >= 22000)}</div><div class="note" style="margin-top:20px">Running low? Small cargo and passenger jobs are always available. Hailing a merchant provides emergency fuel without stranding a broke captain.</div></section><section><div class="eyebrow">CREW OFFICE</div><h3 style="margin:13px 0">${this.s.crew} aboard</h3><p class="small-text">Capturing a disabled ship requires five crew. Two transfer to your prize. Additional crew cost 4 cr/day; each escort costs 25 cr/day.</p>${btn('hire', 'Hire one crew · 350 cr', '', 'primary')}<div class="rule"></div><div class="eyebrow">REPUTATION</div>${Object.entries(
      this.s.reputation,
    )
      .map(([k, v]) => statline(k, v))
      .join('')}</section></div>`;
  }
  renderMap() {
    const sy = SYSTEM[this.mapSelection] || SYSTEM[this.s.system],
      travel = route(this.s.system, sy.id, this.s),
      q = this.model.quest,
      goal = q ? (this.s.activeStory ? q.to : q.from) : null;
    const edges = [];
    for (const a of SYSTEMS) for (const b of a.links) if (a.id < b) edges.push([a, SYSTEM[b]]);
    const selectedRoute = [this.s.system, ...(travel || [])];
    return this.shell(
      'A little farther out.',
      'GALACTIC NAVIGATION / SECTOR CHART',
      `<div class="map-layout"><div class="star-map"><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges.map(([a, b]) => `<line x1="${a.map[0]}" y1="${a.map[1]}" x2="${b.map[0]}" y2="${b.map[1]}" stroke="#779b9550" stroke-width=".25" ${a.alien || b.alien ? 'stroke-dasharray="1 1"' : ''}/>`).join('')}${selectedRoute
        .slice(1)
        .map(
          (id, i) =>
            `<line x1="${SYSTEM[selectedRoute[i]].map[0]}" y1="${SYSTEM[selectedRoute[i]].map[1]}" x2="${SYSTEM[id].map[0]}" y2="${SYSTEM[id].map[1]}" stroke="#f5ab72" stroke-width=".38"/>`,
        )
        .join(
          '',
        )}</svg>${SYSTEMS.map((s) => `<button class="map-node ${s.id === this.s.system ? 'current' : ''} ${s.id === sy.id ? 'selected' : ''} ${!this.s.visited.includes(s.id) ? 'unvisited' : ''} ${!canAccess(this.s, s.id) ? 'locked' : ''}" style="left:${s.map[0]}%;top:${s.map[1]}%" data-action="mapSelect" data-id="${s.id}" aria-label="${e(s.name)}${s.id === this.s.system ? ', current system' : ''}"><i>${e(s.name)}</i>${s.id === goal ? '<span class="quest-dot"></span>' : ''}</button>`).join('')}</div><aside class="map-details"><div class="eyebrow">${e(sy.faction)} / ${e(sy.region)}</div><h3>${e(sy.name)}</h3><p>${e(sy.planet)} · ${e(sy.economy)}<br>${this.s.visited.includes(sy.id) ? 'Charted system' : 'Uncharted system'}</p><div class="danger-level"><span class="orange">${'●'.repeat(sy.danger)}${'○'.repeat(4 - sy.danger)}</span> <small>${['Peaceful', 'Patrolled', 'Contested', 'Dangerous', 'War zone'][sy.danger]}</small></div><div class="rule"></div><div class="route-list">${travel === null ? '<p>A Jump Drive is required to travel here.</p>' : travel.length ? travel.map((id) => `<div class="route-stop">${e(SYSTEM[id].name)}</div>`).join('') : '<p>You are here.</p>'}</div><p class="small-text">${travel?.length ? `${travel.length} jump(s) · ${travel.length} fuel<br>${Math.floor(this.s.fuel)} / ${this.st.fuel} fuel available` : ''}</p>${btn('plot', 'Set course ↗', sy.id, 'primary', !travel?.length)}${travel && travel.length > this.s.fuel ? '<p class="small-text orange">Land to refuel along the way.</p>' : ''}</aside></div><div class="row wrap" style="margin-top:20px;gap:25px"><span class="eyebrow">MARKET PREVIEW</span>${['food', 'metal', 'equipment', 'medical'].map((id) => `<span class="small-text">${COMMODITIES.find((c) => c.id === id).name} <b class="orange mono">${price(id, sy.id, this.s.day)} cr</b></span>`).join('')}</div>`,
      { foot: 'Solid links: hyperlanes · Dashed links: alien frontier · Amber dot: next story destination' },
    );
  }
  objectiveText() {
    const q = this.model.quest;
    if (!q) return 'Follow the trade lanes, chart the frontier, and finish your optional expeditions.';
    if (!this.s.activeStory) return `Meet your contact on ${SYSTEM[q.from].planet}, ${SYSTEM[q.from].name}.`;
    if (this.s.convoyLost && q.kind === 'escort') return 'Convoy lost. Return to Dschubba and land to regroup.';
    if (this.s.system !== q.to)
      return `Travel to ${SYSTEM[q.to].name}${q.cargo ? ` with ${q.cargo} tons of cargo` : q.passengers ? ` with ${q.passengers} passengers` : ''}.`;
    if (this.model.storyReady()) return `Land on ${SYSTEM[q.to].planet} to complete the mission.`;
    if (q.kind === 'scan') return 'Approach the SCAN beacon. Hold E to retrieve the courier’s manifest, then land.';
    if (q.kind === 'finale')
      return this.s.storyProgress < 4
        ? `Disable the relay defenders: ${this.s.storyProgress} / 4. Two allies are supporting you.`
        : 'Approach the relay. Hold E to shut it down, then land.';
    if (q.enemies)
      return `Disable marked hostiles: ${this.s.storyProgress} / ${q.enemies}. ${q.kind === 'escort' ? 'Protect the relief convoy.' : ''}`;
    return `Land on ${SYSTEM[q.to].planet} to deliver your passengers or cargo.`;
  }
  jobEntries() {
    return `<div class="job-list" style="margin-top:15px">${this.s.jobs.map((j) => `<article class="job"><div class="job-body"><h4>${e(j.name)} → ${e(SYSTEM[j.to].name)}</h4><p>${j.kind === 'bounty' ? `${j.progress} / ${j.enemies} neutralized` : j.kind === 'ore' ? `${Math.min(this.s.cargo[j.ore] || 0, j.amount)} / ${j.amount} t ${oreName(j.ore)} aboard` : j.cargo ? `${j.cargo} tons reserved` : `${j.passengers} berths reserved`} · ${money(j.reward)} cr</p></div>${btn('routeJob', 'Route', j.to, 'small')}${btn('abandonJob', 'Cancel', j.id, 'small ghost')}</article>`).join('')}</div>`;
  }
  renderMissions() {
    const q = this.model.quest;
    return this.shell(
      'Every voyage has a purpose.',
      'CONTRACTS / CAMPAIGN & SIDE EXPEDITIONS',
      `<div class="two-col"><section><div class="eyebrow">${q ? e(q.chapter) : 'CAMPAIGN COMPLETE'}</div><h3 style="font-size:27px;margin-top:12px">${q ? e(q.title) : 'An open horizon'}</h3><p class="mission-copy">${e(this.objectiveText())}</p>${q ? `<p class="small-text">${e(q.text)}</p><div class="row" style="margin-top:20px">${btn('objective', 'Plot story route', '', 'primary')}${!this.s.activeStory && this.s.docked && this.s.system === q.from ? btn('portTab', 'Meet contact', 'spaceport') : ''}</div>` : btn('results', 'Your journey in numbers', '', 'primary')}<div class="rule"></div><h4>Accepted contracts</h4>${this.s.jobs.length ? this.jobEntries() : '<p class="small-text">No active jobs. Visit a port’s job board for freight, passengers, and bounties.</p>'}</section><section><div class="eyebrow">EXPEDITIONS</div>${this.s.side.map((q) => `<article class="item" style="margin-top:13px"><h4>${e(q.name)}</h4><p>${e(q.text)}</p>${q.kind === 'hunt' ? `<p class="small-text accent">${q.progress >= q.enemies ? `Targets cleared. Land at ${e(SYSTEM[q.to].planet)} to collect.` : `${q.progress} / ${q.enemies} ${q.boss ? 'targets (three escorts, then the flagship)' : 'raiders'} disabled.`}</p>` : q.kind === 'survey' && q.progress ? `<p class="small-text accent">Survey recorded. Report back at ${e(SYSTEM[q.from].name)}.</p>` : ''}<footer><span class="orange mono small-text">${money(q.reward)} cr</span>${btn('routeJob', 'Route', q.kind === 'survey' && q.progress ? q.from : q.to, 'small')}</footer></article>`).join('') || '<p class="small-text">Optional expeditions begin in the spaceports of Vega, Kraz, Hai Space and, once the convoy work is done, Alniyat.</p>'}<div class="rule"></div><h4>Completed chapters</h4><div style="margin-top:12px">${
        CAMPAIGN.slice(0, this.s.story)
          .map(
            (q, i) => `<div class="statline"><span>${String(i + 1).padStart(2, '0')} / ${e(q.title)}</span><b class="accent">✓</b></div>`,
          )
          .join('') || '<p class="small-text">Your story is just beginning.</p>'
      }</div>${this.s.sideDone.length ? `<div class="rule"></div><div class="eyebrow">FINISHED EXPEDITIONS</div>${this.s.sideDone.map((id) => `<p class="small-text accent">✓ ${e(SIDE_QUESTS.find((q) => q.id === id).name)}</p>`).join('')}` : ''}</section></div>`,
      {
        foot: `Cargo reserved: ${cargoUsed(this.s)} / ${this.st.cargo} t &nbsp; · &nbsp; Passengers: ${bunksUsed(this.s)} / ${this.st.bunks}`,
      },
    );
  }
  renderFleet() {
    return this.shell(
      'Better together.',
      'FLEET COMMAND / UP TO FIVE ESCORTS',
      `<div class="section-head"><div><h3>${e(SHIP[this.s.ship].name)}</h3><p class="small-text">Flagship · ${e(this.s.name)} commanding</p></div><span class="status-pill">${this.s.crew} CREW</span></div><div class="row wrap">${['defend', 'attack', 'hold'].map((order) => btn('fleetOrder', { defend: 'Defend flagship', attack: 'Attack hostiles', hold: 'Hold position' }[order], order, this.s.fleetOrder === order ? 'primary' : '')).join('')}</div><p class="small-text">Orders affect your purchased and captured escorts. Story allies act independently. Damaged escorts are repaired when you land.</p><div class="rule"></div>${this.s.escorts.length ? `<div class="item-grid">${this.s.escorts.map((s, i) => `<article class="item"><header><h4>${e(SHIP[s.ship].name)} / ${i + 1}</h4><span class="status-pill">${Math.round((100 * s.hull) / SHIP[s.ship].hull)}% HULL</span></header><p>${SHIP[s.ship].role} · Stock weapons · 25 cr / ship day</p></article>`).join('')}</div>` : '<p>You are flying solo. Buy an escort at a shipyard, or hire enough crew to capture a disabled enemy. Press B after disabling a hostile.</p>'}`,
      { compact: true },
    );
  }
  renderLog() {
    return this.shell(
      'The things we carry.',
      'CAPTAIN’S LOG / RECENT 80 ENTRIES',
      `${
        this.s.log
          .slice()
          .reverse()
          .map(
            (l) =>
              `<article class="log-entry"><div class="eyebrow">SHIP DAY ${String(l.day).padStart(3, '0')}</div><p>${e(l.text)}</p></article>`,
          )
          .join('') || '<p>A blank page, an unfamiliar cockpit, and all the sky ahead.</p>'
      }`,
      {
        compact: true,
        foot: `${this.s.visited.length} systems charted · ${this.s.kills} threats neutralized · ${this.s.mined} tons mined`,
      },
    );
  }
  renderControls() {
    const sections = [
      {
        id: 'keyboard',
        title: 'Keyboard & mouse',
        rows: [
          ['Thrust / brake', 'W / S or ↑ / ↓'],
          ['Turn left / right', 'A / D or ← / →'],
          ['Primary weapons', 'Space'],
          ['Secondary missiles', 'F'],
          ['Point ship at cursor', 'Hold right mouse'],
          ['Fire at cursor', 'Hold left mouse'],
          ['Target next hostile', 'Tab or T'],
          ['Landing autopilot', 'L'],
          ['Jump along plotted route', 'J'],
          ['Galactic star chart', 'M'],
          ['Scan / survey (hold)', 'E'],
          ['Board disabled ship', 'B'],
          ['Hail / emergency fuel', 'H'],
          ['Afterburner (outfit)', 'Shift'],
          ['Contracts and missions', 'N'],
          ['Captain’s log', 'I'],
          ['Fleet orders', 'G'],
          ['Zoom view', 'Mouse wheel / + −'],
          ['Pause / close menu', 'Esc or P'],
          ['Graphics & controls', 'F9'],
        ],
      },
      {
        id: 'gamepad',
        title: 'Controller',
        rows: [
          ['Steer and thrust', 'Left stick'],
          ['Point the nose', 'Right stick'],
          ['Primary weapons', 'RT or X'],
          ['Secondary missiles', 'RB'],
          ['Brake', 'LT or B'],
          ['Afterburner (outfit)', 'A'],
          ['Scan / survey (hold)', 'Y'],
          ['Target next hostile', 'LB'],
          ['Jump / land', 'D-pad ↑ / ↓'],
          ['Board / hail', 'D-pad ← / →'],
          ['Galactic star chart', 'View'],
          ['Zoom view', 'Right-stick click'],
          ['Pause menu', 'Start'],
          ['Menus', 'D-pad · A choose · B back'],
          ['Port tabs / scroll', 'LB RB / right stick'],
        ],
      },
      {
        id: 'touch',
        title: 'Touch',
        rows: [
          ['Steer and thrust', 'Drag on the left'],
          ['Fire (aims at the nearest hostile)', 'FIRE'],
          ['Brake', 'BRAKE'],
          ['Missiles, afterburner', 'When fitted'],
          ['Scan / survey', 'SCAN, near a beacon'],
          ['Land, jump, board, hail, target', 'Buttons at the top'],
          ['Zoom view', 'Pinch'],
          ['Pause', 'Ⅱ'],
        ],
      },
    ];
    const order = [this.source, ...['keyboard', 'gamepad', 'touch'].filter((x) => x !== this.source)];
    const body = order
      .map((id) => sections.find((x) => x.id === id))
      .filter(Boolean)
      .map(
        (sec, i) =>
          `${i ? '<div class="rule"></div>' : ''}<h4>${sec.title}${i === 0 ? ' <span class="status-pill" style="margin-left:8px">IN USE</span>' : ''}</h4><div class="controls-grid" style="margin-top:12px">${sec.rows.map(([label, key]) => `<div class="control-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div>`,
      )
      .join('');
    return this.shell(
      'Know your ship.',
      'FLIGHT HANDBOOK / KEYBOARD · CONTROLLER · TOUCH',
      `${body}<div class="rule"></div><div class="note">Start at the <b>Spaceport</b>, accept a contract, and depart. Open the <b>Star chart</b>, select a destination, set your course, and jump once per system. On arrival, land. Direct movement cancels autopilot. Release fire to cool and recharge. Mine asteroids by shooting them apart and flying over the ore.</div><p class="small-text">The simulation pauses in menus and when the browser is hidden. Disabling flight assistance preserves inertial coasting. A faint target bracket identifies the selected ship; radar colors are red for hostiles and teal for allies. Touch layout, controller vibration and graphics quality live in Options → Graphics, controls & touch.</p>`,
      { compact: true },
    );
  }
  renderOptions() {
    const s = this.settings;
    const toggle = (id, label, desc) =>
      `<div class="option-row"><div><div class="label">${label}</div><p>${desc}</p></div><input type="checkbox" data-option="${id}" aria-label="${label}" ${s[id] ? 'checked' : ''}></div>`;
    return this.shell(
      'Make space for yourself.',
      'OPTIONS / SAVED ON THIS DEVICE',
      `<section class="options-section"><h3>Presentation</h3><div class="option-row"><div><div class="label">Graphics, controls & touch</div><p>Quality tier, resolution, frame cap, renderer, touch layout and size, controller vibration. Shared by every game on this device (also F9).</p></div>${btn('kitSettings', 'Open', '', 'small')}</div><div class="quality-notes">ACTIVE: ${e(this.backend)} / ${e(String(this.quality).toUpperCase())}<br>Both renderers use the same geometry, lighting, materials and bloom · fixed 60 Hz simulation</div>${toggle('reducedMotion', 'Reduce motion', 'Suppress screen flashes, camera shake and jump overlays. Essential movement stays visible.')}${toggle('diagnostics', 'Performance diagnostics', 'Show renderer backend, quality tier, frame rate, and active physics bodies.')}${btn('fullscreen', document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen', '', 'small')}</section><section class="options-section"><h3>Audio</h3><div class="option-row"><div class="label">Master volume</div><input aria-label="Master volume" data-option="volume" type="range" min="0" max="1" step="0.05" value="${s.volume ?? 0.6}"></div><div class="option-row"><div class="label">Music volume</div><input aria-label="Music volume" data-option="music" type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.35}"></div>${toggle('muted', 'Mute all audio', 'Sound begins after your first click, tap or key press.')}</section><section class="options-section"><h3>Flight</h3><div class="option-row"><div><div class="label">Combat difficulty</div><p>Relaxed softens incoming fire; Veteran hits harder and makes hostiles tougher. Rewards are the same.</p></div><select data-option="difficulty" aria-label="Combat difficulty">${Object.entries(DIFFICULTY).map(([id, d]) => `<option value="${id}" ${(s.difficulty || 'standard') === id ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>${toggle('flightAssist', 'Flight assistance', 'Gently damps unpowered drift. Disable for traditional inertial coasting.')}${toggle('aimAssist', 'Aim assistance', 'Adds modest target leading within a narrow firing cone, plus touch and controller auto-aim while firing.')}</section><section class="options-section"><h3>Your captain’s log</h3><p class="small-text">Autosaves on port actions, jumps, and periodically in flight. Export a backup before clearing browser storage. Imported saves are validated before replacing your current captain.</p><div class="row wrap">${btn('exportSave', 'Export save', '', 'small', !this.hasSave && !this.callbacks.playing?.())}${btn('importSave', 'Import save', '', 'small')}${btn('title', 'Save & title screen', '', 'small')}</div></section>`,
      { compact: true },
    );
  }
  renderAbout() {
    return this.shell(
      'A familiar sky. A new journey.',
      'ABOUT STARLIGHT DRIFTER',
      `<p><b>Starlight Drifter</b> is an independently built, compact adaptation of <b>Endless Sky</b>. Trade, carry passengers, mine asteroid fields, pilot an upgradeable ship, escort convoys, board disabled enemies, explore alien space, hunt the Corsair of Farpoint, and follow a ten-contract campaign to an ending.</p><p class="small-text">It is not the complete upstream game. The sector map is compressed and its placement, dialogue, characters, balance, and mission sequence are original. Major canonical factions, the three starting ships, named ship classes, and the broad Free Worlds / Pug themes are adapted from the source.</p><div class="rule"></div><div class="eyebrow">BUILD INFORMATION</div>${statline('Generation date', BUILD.date)}${statline('AI model', BUILD.model)}${statline('Version', BUILD.version)}${statline('Renderer', `three.js r186 · ${this.backend}`)}${statline('Physics', 'Rapier 0.20 · fixed 60 Hz')}<div class="rule"></div><p class="small-text">Source and inspiration: <a href="https://github.com/endless-sky/endless-sky" target="_blank" rel="noopener noreferrer">Endless Sky community</a>. Source code license: GPL-3.0-or-later. All visuals in this adaptation are procedural geometry. All bundled audio is original, generated placeholder audio; no third-party ripped sounds are mislabeled as source assets. Requested archive sourcing was not verified.</p>`,
      { compact: true },
    );
  }
  renderPause() {
    const playing = this.callbacks.playing?.();
    return this.shell(
      'A moment between stars.',
      'FLIGHT PAUSED',
      `<p>All simulation is paused. Your next horizon will still be here.</p><div class="stack" style="margin-top:20px">${btn('close', 'Resume voyage', '', 'primary')}${playing ? `<div class="row wrap" style="gap:8px">${btn('map', 'Star chart', '', 'small')}${btn('missions', 'Missions', '', 'small')}${btn('fleet', 'Fleet', '', 'small')}${btn('log', 'Captain’s log', '', 'small')}</div>` : ''}${btn('options', 'Options')}${btn('kitSettings', 'Graphics, controls & touch')}${btn('controls', 'Flight handbook')}${btn('title', 'Save & return to title')}</div>`,
      { compact: true },
    );
  }
  renderBoard() {
    const d = this.data || {},
      prize = SHIP[d.prize || (d.ship === 'bastion' ? 'firebird' : 'sparrow')],
      value = d.salvage || 1100 + SYSTEM[this.s.system].danger * 350;
    return this.shell(
      d.boss ? 'The Corsair’s bridge is empty.' : 'The engines have gone quiet.',
      'BOARDING / DISABLED VESSEL',
      `<div class="row"><div class="card-icon" style="width:100px;color:var(--teal)">${glyph()}</div><div><h3>${e(d.label || 'Disabled ship')}</h3><p class="small-text">${d.boss ? 'The pirate crew fled in their lifeboats. The flagship’s reactor is cold but intact.' : 'No hostile resistance remains. Your boarding team awaits orders.'}</p></div></div><p>Salvage the ship for immediate credits, or capture it as an escort (${e(prize.name)}). Capturing requires five crew aboard and transfers two of them to the prize.</p><div class="mission-metadata"><div><small>AVAILABLE CREW</small><strong>${this.s.crew}</strong></div><div><small>FLEET</small><strong>${this.s.escorts.length} / 5 escorts</strong></div><div><small>SALVAGE VALUE</small><strong class="orange">${money(value)} cr</strong></div></div><div class="row wrap">${btn('salvage', 'Salvage the ship', '', 'primary')}${btn('capture', `Capture as escort`, '', '', this.s.crew < 5 || this.s.escorts.length >= 5)}${btn('close', 'Leave it behind', '', 'ghost')}</div>`,
      { compact: true },
    );
  }
  renderDebrief() {
    const q = this.data;
    return this.shell(
      q?.title || 'Safe arrival',
      'CONTRACT COMPLETE / PORT DEBRIEF',
      `<div class="eyebrow accent">✓ MISSION COMPLETE</div><p class="mission-copy">${e(q?.debrief || 'Your destination is reached.')}</p><div class="mission-metadata"><div><small>CONTRACT REWARD</small><strong class="orange">+${money(q?.reward || 0)} cr</strong></div><div><small>CAMPAIGN</small><strong>${this.s.story} / ${CAMPAIGN.length} chapters</strong></div><div><small>PORT</small><strong>${e(SYSTEM[this.s.system].planet)}</strong></div></div><div class="footer-actions">${btn(this.s.ended ? 'results' : 'port', 'Continue ↗', '', 'primary')}</div>`,
      { compact: true, closable: false },
    );
  }
  renderResults() {
    const s = this.s,
      best = this.records[0];
    const records = this.records.length
      ? `<div class="rule"></div><div class="eyebrow">FASTEST VOYAGES ON THIS DEVICE</div>${this.records.map((r, i) => statline(`${i + 1}. ${r.name} · ${SHIP[r.ship]?.name || 'Ship'} · day ${r.day}`, `${r.minutes} min`)).join('')}`
      : '';
    return this.shell(
      'Your open horizon.',
      'CAMPAIGN RESULTS / THE JOURNEY IS YOURS',
      `<div class="results-hero"><div class="emblem">✧</div><div class="eyebrow">TEN CHAPTERS. ONE INDEPENDENT CAPTAIN.</div><h2>The sky is open again.</h2><p>${e(s.name)}, you began with a small ship and a large debt. You carried people, uncovered a conspiracy, and stood with strangers when the eastern sky went dark. ${s.choice === 'freeworlds' ? 'The Free Worlds remember you as one of their own.' : 'Both sides remember the independent captain who chose people over flags.'}</p></div><div class="results-stats"><div><strong>${s.visited.length}</strong><small>SYSTEMS CHARTED</small></div><div><strong>${s.kills}</strong><small>THREATS NEUTRALIZED</small></div><div><strong>${money(s.earned)}</strong><small>CREDITS EARNED</small></div><div><strong>${Math.round(s.playTime / 60)}</strong><small>MINUTES IN FLIGHT</small></div></div><div class="milestones">${s.achievements.map((a) => `<span class="milestone">✧ ${e(a)}</span>`).join('')}</div><p class="small-text">${s.debt === 0 ? 'Mortgage paid. Your ship is entirely your own.' : `${money(s.debt)} credits remain on your mortgage.`} ${s.sideDone.length} / ${SIDE_QUESTS.length} optional expeditions completed.${best ? ` Personal best: ${best.minutes} minutes in flight.` : ''} Free play remains open after this ending.</p>${records}<div class="footer-actions">${btn('title', 'Return to title')}${btn('port', 'Keep flying ↗', '', 'primary')}</div>`,
      { closable: false },
    );
  }
  renderRescue() {
    return this.shell(
      'A signal in the dark.',
      'YOUR SHIP HAS BEEN DISABLED',
      `<p class="mission-copy">An independent freighter answers your distress call. They will tow your ship to the last safe port. Your contracts and installed equipment are recoverable; loose trade cargo is not.</p><div class="note">Recovery costs 12% of available credits plus 350 cr, capped at your balance. Combat objectives reset so you can prepare and try again. There is no permanent death or unrecoverable debt trap.</div><div class="footer-actions">${btn('rescue', 'Accept the tow', '', 'primary')}</div>`,
      { compact: true, closable: false },
    );
  }
  /** An in-game yes/no question (native confirm() cannot be answered with a controller). */
  renderConfirm() {
    const d = this.data || {};
    return this.shell(
      d.title || 'Are you sure?',
      d.eyebrow || 'PLEASE CONFIRM',
      `<p class="mission-copy">${e(d.text || '')}</p><div class="footer-actions">${btn('confirmNo', e(d.no || 'Cancel'), '', d.danger ? '' : 'ghost')}${btn('confirmYes', e(d.yes || 'Confirm'), '', d.danger ? 'warm' : 'primary')}</div>`,
      { compact: true },
    );
  }
  /** Switch HUD button prompts to the device in use. */
  setPrompts(source) {
    this.source = source;
    const table = PROMPTS[source] || PROMPTS.keyboard;
    for (const k of this.root.querySelectorAll('kbd[data-prompt]')) {
      const text = table[k.dataset.prompt] || '';
      k.textContent = text;
      k.hidden = !text;
    }
    if (this.panel === 'controls') this.render();
  }
  el(id) {
    let el = this.els.get(id);
    if (!el || !el.isConnected) {
      el = this.root.querySelector('#' + id);
      this.els.set(id, el);
    }
    return el;
  }
  /** Write text only when it changed (no DOM churn at 10 Hz). */
  text(id, value) {
    if (this.textCache.get(id) === value) return;
    this.textCache.set(id, value);
    const el = this.el(id);
    if (el) el.textContent = value;
  }
  fill(id, fraction) {
    const v = clamp(fraction, 0, 1).toFixed(3);
    if (this.textCache.get(id) === v) return;
    this.textCache.set(id, v);
    const el = this.el(id);
    if (el) el.style.transform = `scaleX(${v})`;
  }
  refreshHUD() {
    const s = this.s,
      st = this.st,
      sy = SYSTEM[s.system];
    this.text('region', sy.region.toUpperCase());
    this.text('system-name', sy.name + ' system');
    this.text('credits', money(s.credits));
    this.text('day', String(s.day).padStart(3, '0'));
    this.text('ship-name', SHIP[s.ship].name);
    this.text('fuel', `FUEL ${Math.floor(s.fuel)} / ${st.fuel}`);
    this.text('hold', `HOLD ${cargoUsed(s)} / ${st.cargo}`);
    this.text('chapter', s.story < CAMPAIGN.length ? `${String(s.story + 1).padStart(2, '0')} / ${CAMPAIGN.length}` : 'COMPLETE');
    this.text('objective-title', this.model.quest?.title || 'An open horizon');
    this.text('objective-detail', this.objectiveText());
    for (const [id, value, max] of [
      ['shield', s.shield, st.shield],
      ['hull', s.hull, st.hull],
      ['energy', s.energy, st.energy],
      ['heat', s.heat, 100],
    ]) {
      this.text(id + '-text', `${Math.max(0, Math.ceil(value))}${id === 'heat' ? '%' : ` / ${max}`}`);
      this.fill(id + '-fill', value / max);
    }
  }
  flightHUD(sim) {
    this.refreshHUD();
    const speed = sim.physics.velocity('player');
    this.text(
      'flight-state',
      this.s.docked ? 'DOCKED' : sim.autopilot ? sim.autopilot.toUpperCase() : `${Math.round(Math.hypot(speed.x, speed.z))} AU/S`,
    );
    let mode = '';
    if (sim.jump) mode = `HYPERDRIVE ${Math.round(clamp(sim.jump.time / 2.1, 0, 1) * 100)}% / ${SYSTEM[sim.jump.to].name.toUpperCase()}`;
    else if (sim.scanProgress > 0) mode = `SCANNING ${Math.round(sim.scanProgress * 100)}%`;
    else if (sim.autopilot === 'land') mode = 'APPROACHING PORT';
    else if (sim.autopilot === 'board') mode = 'BOARDING APPROACH';
    else if (sim.scanInRange) mode = this.source === 'touch' ? 'IN SCAN RANGE · HOLD SCAN' : `IN SCAN RANGE · HOLD ${this.source === 'gamepad' ? 'Y' : 'E'}`;
    this.text('flight-mode', mode);
    // Target labels: which ones exist is decided here; they are positioned every frame by updateLabels.
    const q = this.model.quest,
      here = this.s.activeStory && q?.to === this.s.system,
      specs = this.labelSpecs;
    specs.length = 0;
    specs.push({ key: 'port', x: PORT.x, z: PORT.z, label: SYSTEM[this.s.system].planet, klass: 'port' });
    if (here && q.kind === 'scan') specs.push({ key: 'scan', x: SCAN.x, z: SCAN.z, label: 'COURIER / HOLD E', klass: '' });
    else if (here && q.kind === 'finale') specs[0].label = this.s.storyProgress < 4 ? 'RELAY / HOSTILE' : 'RELAY / HOLD E';
    else specs.push({ key: 'scan', x: SCAN.x, z: SCAN.z, label: 'SURVEY / HOLD E', klass: '' });
    const target = sim.entities.get(sim.target);
    if (target) specs.push({ key: 'target', id: target.id, label: target.label || 'Target', klass: target.disabled ? 'disabled' : 'hostile' });
    if (this.source !== 'keyboard')
      for (const sp of specs) sp.label = sp.label.replace('HOLD E', this.source === 'gamepad' ? 'HOLD Y' : 'HOLD SCAN');
    // The Corsair's health bar.
    let boss = null;
    for (const a of sim.entities.values()) if (a.boss && !a.disabled) boss = a;
    const bar = this.el('boss-bar');
    if (bar && bar.hidden !== !boss) bar.hidden = !boss;
    if (boss) {
      this.text('boss-text', `${Math.max(0, Math.round((100 * (boss.hp - boss.maxHp * 0.22)) / (boss.maxHp * 0.78)))}%`);
      this.fill('boss-fill', (boss.hp - boss.maxHp * 0.22) / (boss.maxHp * 0.78));
    }
  }
  /** Keep the port, beacon and target brackets on their objects every frame (transform only, no layout). */
  updateLabels(view, sim) {
    const root = this.el('labels');
    if (!root) return;
    const stamp = (this.labelStamp = (this.labelStamp || 0) + 1);
    for (const sp of this.labelSpecs) {
      let x = sp.x,
        z = sp.z;
      if (sp.id) {
        const ent = sim.entities.get(sp.id);
        if (!ent || ent.rx === undefined) continue;
        x = ent.rx;
        z = ent.rz;
      }
      let item = this.labelEls.get(sp.key);
      if (!item) {
        const el = document.createElement('div');
        el.className = 'target-label';
        root.append(el);
        item = { el, label: null, klass: null, shown: true };
        this.labelEls.set(sp.key, item);
      }
      if (item.label !== sp.label || item.klass !== sp.klass) {
        item.label = sp.label;
        item.klass = sp.klass;
        item.el.className = `target-label ${sp.klass}`;
        item.el.innerHTML = `<div class="target-bracket"></div>${e(sp.label)}`;
      }
      const p = view.project(x, z, 1, this._pt);
      const shown = !(p.x < 30 || p.x > view.width - 30 || p.y < 100 || p.y > view.height - 30);
      if (shown !== item.shown) {
        item.shown = shown;
        item.el.hidden = !shown;
      }
      if (shown) item.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;
      item.stamp = stamp;
    }
    for (const item of this.labelEls.values())
      if (item.stamp !== stamp && item.shown) {
        item.shown = false;
        item.el.hidden = true;
      }
  }
  drawRadar(snapshot) {
    const c = this.context;
    if (!c) return;
    c.clearRect(0, 0, 300, 300);
    c.save();
    c.beginPath();
    c.arc(150, 150, 148, 0, Math.PI * 2);
    c.clip();
    c.strokeStyle = '#6fa79c23';
    c.lineWidth = 1;
    for (const r of [45, 90, 135]) {
      c.beginPath();
      c.arc(150, 150, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, 150);
    c.lineTo(300, 150);
    c.moveTo(150, 0);
    c.lineTo(150, 300);
    c.stroke();
    const scale = 1.6,
      p = snapshot.player;
    const point = (x, z, col, r = 3) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(150 + (x - p.x) * scale, 150 + (z - p.z) * scale, r, 0, Math.PI * 2);
      c.fill();
    };
    point(PORT.x, PORT.z, '#e0e9d4', 5);
    point(SCAN.x, SCAN.z, '#9d83c0', 3);
    for (const a of snapshot.entities) {
      if (a.id === 'player' || a.type === 'debris') continue;
      point(
        a.rx,
        a.rz,
        a.disabled
          ? '#f5ab72'
          : a.team === 'hostile'
            ? '#f68c7c'
            : a.team === 'ally'
              ? '#8ad6bf'
              : a.type === 'asteroid'
                ? '#536d6a'
                : a.type === 'pickup'
                  ? '#f3bb70'
                  : '#9eb2b3',
        a.type === 'asteroid' || a.type === 'pickup' ? 1.4 : a.boss ? 5 : 3,
      );
    }
    c.save();
    c.translate(150, 150);
    c.rotate(p.angle || 0);
    c.fillStyle = '#bcead5';
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(5, 6);
    c.lineTo(0, 3);
    c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
    c.restore();
  }
  diagnostics(fps, bodies, backend, tier) {
    this.backend = backend;
    this.quality = tier;
    const d = this.el('diagnostics');
    if (!d) return;
    d.hidden = this.settings.diagnostics === false;
    this.text('diagnostics', `${backend.toUpperCase()} · ${String(tier).toUpperCase()} · ${fps} FPS · ${bodies} BODIES`);
  }
  toast(text, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = text;
    const parent = this.el('toasts');
    parent.append(el);
    while (parent.children.length > 4) parent.firstElementChild.remove();
    setTimeout(() => el.remove(), 5500);
  }
  flash(kind = 'hit') {
    if (this.settings.reducedMotion) return;
    const el = this.el(kind === 'jump' ? 'warp' : 'hit-flash');
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), kind === 'jump' ? 550 : 110);
  }
}
