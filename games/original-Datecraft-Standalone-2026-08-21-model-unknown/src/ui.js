// Converted from the original AMD bundle. Keys and controller buttons now arrive as kit.input
// actions from main.js (menuAction, toggleTime, …); the rest of the interface is the original.
import * as data_js_4 from './data.js';
import * as persistence_js_1 from './persistence.js';
import * as utils_js_4 from './utils.js';
const exports = {};
exports.runOnboarding = runOnboarding;
const NEED_META = {
    energy: { icon: '⚡', label: 'Energy' },
    mood: { icon: '☀', label: 'Mood' },
    hygiene: { icon: '◇', label: 'Hygiene' },
    health: { icon: '+', label: 'Health' },
    social: { icon: '♥', label: 'Social' },
};
const ACTION_LABELS = {
    rest: 'Rest here', admin: 'Do admin', selfcare: 'Self-care', marketing: 'Refresh profile',
    photoshoot: 'Book photo session', social: 'Spend social time', network: 'Network with peers',
    training: 'Train skills', checkup: 'Routine checkup', counselling: 'Counselling session',
    business: 'Open business desk', hire: 'Review support team', booking: 'Review bookings', scout: 'Scout the venue',
};
const JOURNAL_ICONS = {
    booking: '▦', safety: '✓', business: '◇', activity: '✦', venue: '⌂', day: '☀',
    event: '!', lead: '◎', team: '⌁', growth: '↑', region: '≈', time: '→', system: '◆',
};
function getPackage(id) {
    return data_js_4.DATE_PACKAGES.find((item) => item.id === id) || data_js_4.DATE_PACKAGES[0];
}
function getVenue(id) {
    return data_js_4.VENUES.find((item) => item.id === id);
}
function getContact(id) {
    return data_js_4.CONTACTS.find((item) => item.id === id);
}
function dayLabel(day) {
    return `${data_js_4.DAY_NAMES[(Math.max(1, day) - 1) % data_js_4.DAY_NAMES.length]} · Day ${day}`;
}
function compactDayLabel(day) {
    return `D${day} ${data_js_4.DAY_NAMES[(Math.max(1, day) - 1) % data_js_4.DAY_NAMES.length].slice(0, 3)}`;
}
function toneForValue(value, inverse = false) {
    const normalized = inverse ? 100 - value : value;
    if (normalized < 34)
        return 'low';
    if (normalized < 66)
        return 'mid';
    return 'high';
}
function riskTone(value) {
    if (value < 28)
        return 'good';
    if (value < 56)
        return 'warn';
    return 'risk';
}
function reputationLabel(value) {
    if (value < 20)
        return 'New';
    if (value < 35)
        return 'Promising';
    if (value < 55)
        return 'Established';
    if (value < 75)
        return 'Sought-after';
    return 'Premier';
}
function percent(value, max = 100) {
    return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / Math.max(1, max) * 100)));
}
function pill(text, tone = '') {
    return `<span class="pill"${tone ? ` data-tone="${tone}"` : ''}>${(0, utils_js_4.escapeHtml)(text)}</span>`;
}
function button(label, action, id = '', classes = '', attrs = '') {
    return `<button class="${classes}" data-action="${action}"${id ? ` data-id="${(0, utils_js_4.escapeHtml)(id)}"` : ''} ${attrs}>${(0, utils_js_4.escapeHtml)(label)}</button>`;
}
function modalMarkup({ eyebrow = '', title, text = '', body = '', actions = '' }) {
    return `
<div class="modal-hero">
  ${eyebrow ? `<span class="eyebrow">${(0, utils_js_4.escapeHtml)(eyebrow)}</span>` : ''}
  <h2>${(0, utils_js_4.escapeHtml)(title)}</h2>
  ${text ? `<p>${(0, utils_js_4.escapeHtml)(text)}</p>` : ''}
</div>
<div class="modal-body">
  ${body}
  ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
</div>`;
}
function selectedCard(group, id, item, selected, detail) {
    return `<button type="button" class="choice-card${selected === id ? ' is-selected' : ''}" data-onboard-group="${group}" data-id="${(0, utils_js_4.escapeHtml)(id)}">
<span class="choice-badge" aria-hidden="true">${selected === id ? '✓' : '○'}</span>
<strong>${(0, utils_js_4.escapeHtml)(item.name)}</strong>
<span>${(0, utils_js_4.escapeHtml)(detail || item.description)}</span>
  </button>`;
}
async function runOnboarding({ renderer = 'three.js 3D' } = {}) {
    const layer = document.querySelector('#modal-layer');
    if (!layer)
        throw new Error('Modal layer is missing.');
    const selections = {
        background: 'fresh_start', presentation: 'classic', relationship: 'single', region: 'brightwater', difficulty: 'balanced',
    };
    return new Promise((resolve) => {
        const render = () => {
            layer.classList.remove('is-hidden');
            layer.innerHTML = `<section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" data-kind="onboarding" data-closable="false">
    <div class="modal-hero">
      <span class="eyebrow">New career</span>
      <h1 id="onboarding-title">Open your calendar</h1>
      <p>Build a sustainable adult companionship business through planning, communication, pricing, boundaries, safety, and personal wellbeing. Dates are represented through non-graphic choices.</p>
    </div>
    <form id="onboarding-form" class="modal-body">
      <div class="form-grid">
        <div class="form-field">
          <label for="onboard-name">Professional name</label>
          <input id="onboard-name" name="name" type="text" maxlength="24" value="Alex" autocomplete="off" required />
        </div>
        <div class="form-field">
          <label for="onboard-pronouns">Pronouns</label>
          <select id="onboard-pronouns" name="pronouns">
            <option>they/them</option><option>she/her</option><option>he/him</option><option>she/they</option><option>he/they</option>
          </select>
        </div>
        <div class="form-field full">
          <span class="field-label">Starting background</span>
          <div class="choice-grid" data-choice-grid="background">
            ${Object.entries(data_js_4.BACKGROUNDS).map(([id, item]) => selectedCard('background', id, item, selections.background, `${item.description} Start with ${(0, utils_js_4.formatMoney)(item.cash)}${item.debt ? ` and ${(0, utils_js_4.formatMoney)(item.debt)} debt` : ''}.`)).join('')}
          </div>
        </div>
        <div class="form-field full">
          <span class="field-label">Presentation</span>
          <div class="choice-grid" data-choice-grid="presentation">
            ${Object.entries(data_js_4.PRESENTATIONS).map(([id, item]) => selectedCard('presentation', id, item, selections.presentation)).join('')}
          </div>
        </div>
        <div class="form-field full">
          <span class="field-label">Personal life</span>
          <div class="choice-grid" data-choice-grid="relationship">
            ${Object.entries(data_js_4.PERSONAL_LIFE_OPTIONS).map(([id, item]) => selectedCard('relationship', id, item, selections.relationship)).join('')}
          </div>
        </div>
        <div class="form-field full">
          <span class="field-label">Starting region</span>
          <div class="choice-grid" data-choice-grid="region">
            ${Object.entries(data_js_4.REGIONS).map(([id, item]) => selectedCard('region', id, item, selections.region, `${item.tagline}. ${item.legalModel}.`)).join('')}
          </div>
        </div>
        <div class="form-field full">
          <span class="field-label">Simulation style</span>
          <div class="choice-grid" data-choice-grid="difficulty">
            ${selectedCard('difficulty', 'gentle', { name: 'Gentle', description: 'Lower expenses and risk; stronger demand. Good for story-led play.' }, selections.difficulty)}
            ${selectedCard('difficulty', 'balanced', { name: 'Balanced', description: 'The intended management curve with recoverable setbacks.' }, selections.difficulty)}
            ${selectedCard('difficulty', 'grounded', { name: 'Grounded', description: 'Stricter screening, higher operating costs, and sharper consequences.' }, selections.difficulty)}
          </div>
        </div>
        <div class="form-field full">
          <div class="checkbox-row">
            <input id="onboard-tutorial" name="tutorial" type="checkbox" checked />
            <label for="onboard-tutorial"><strong>Guided opening.</strong> Show a concise orientation to leads, the calendar, venues, and safety tools.</label>
          </div>
        </div>
        <div class="form-field full">
          <div class="checkbox-row">
            <input id="onboard-adult" name="adultConfirmed" type="checkbox" required />
            <label for="onboard-adult"><strong>Adult confirmation required.</strong> I confirm that I am at least 18 years old and understand that the game addresses adult professional companionship, legal pressure, health, and personal safety in non-graphic terms.</label>
          </div>
        </div>
      </div>
      <p class="section-intro" style="margin-top:16px">Renderer: ${(0, utils_js_4.escapeHtml)(renderer)}. You can export or import saves from the pause menu.</p>
      <div class="form-actions"><button class="primary" type="submit">Begin in ${(0, utils_js_4.escapeHtml)(data_js_4.REGIONS[selections.region].name)}</button></div>
    </form>
  </section>`;
            const nameInput = layer.querySelector('#onboard-name');
            nameInput?.focus();
        };
        layer.addEventListener('click', (event) => {
            const card = event.target.closest('[data-onboard-group]');
            if (!card || !layer.contains(card))
                return;
            selections[card.dataset.onboardGroup] = card.dataset.id;
            const currentName = layer.querySelector('#onboard-name')?.value || 'Alex';
            const currentPronouns = layer.querySelector('#onboard-pronouns')?.value || 'they/them';
            const tutorial = layer.querySelector('#onboard-tutorial')?.checked ?? true;
            const adult = layer.querySelector('#onboard-adult')?.checked ?? false;
            render();
            layer.querySelector('#onboard-name').value = currentName;
            layer.querySelector('#onboard-pronouns').value = currentPronouns;
            layer.querySelector('#onboard-tutorial').checked = tutorial;
            layer.querySelector('#onboard-adult').checked = adult;
        });
        layer.addEventListener('submit', (event) => {
            if (event.target.id !== 'onboarding-form')
                return;
            event.preventDefault();
            const form = new FormData(event.target);
            const adultConfirmed = form.get('adultConfirmed') === 'on';
            if (!adultConfirmed)
                return;
            const result = {
                name: String(form.get('name') || 'Alex'),
                pronouns: String(form.get('pronouns') || 'they/them'),
                tutorial: form.get('tutorial') === 'on', adultConfirmed,
                ...selections,
            };
            layer.classList.add('is-hidden');
            layer.innerHTML = '';
            resolve(result);
        });
        render();
    });
}
class GameUI {
    constructor({ simulation, world, audio, diagnostics = {}, onNewGame = null, onGraphics = null }) {
        this.sim = simulation;
        this.world = world;
        this.audio = audio;
        this.diagnostics = diagnostics;
        this.onNewGame = onNewGame || (() => location.reload());
        this.onGraphics = onGraphics;
        this.externalPause = false;
        this.state = simulation.state;
        this.activeTab = 'leads';
        this.phoneOpen = true;
        this.networkSection = 'team';
        this.autoTimer = null;
        this.timeSpeed = 0;
        this.previousFocus = null;
        this.tutorialShown = false;
        this.destroyed = false;
        this.lastEventType = null;
        this.nodes = {
            game: document.querySelector('#game-ui'), day: document.querySelector('#hud-day'), slot: document.querySelector('#hud-slot'),
            cash: document.querySelector('#hud-cash'), reputation: document.querySelector('#hud-reputation'), risk: document.querySelector('#hud-risk'),
            playerName: document.querySelector('#player-name-label'), level: document.querySelector('#hud-level'), xp: document.querySelector('#hud-xp'),
            safety: document.querySelector('#hud-safety'), exposure: document.querySelector('#hud-exposure'), needs: document.querySelector('#needs-list'),
            phone: document.querySelector('#phone-panel'), phoneTitle: document.querySelector('#phone-title'), phoneContent: document.querySelector('#phone-content'),
            phoneToggle: document.querySelector('#phone-toggle'), leadBadge: document.querySelector('#lead-badge'), floatingBadge: document.querySelector('#floating-badge'),
            venue: document.querySelector('#venue-card'), nextSlot: document.querySelector('#next-slot-label'), modal: document.querySelector('#modal-layer'),
            toast: document.querySelector('#toast-region'), tooltip: document.querySelector('#tooltip'),
        };
        this.boundClick = (event) => this.handleClick(event);
        this.boundInput = (event) => this.handleInput(event);
        this.boundVisibility = () => { if (document.hidden)
            this.setTimeMode(0); };
        document.addEventListener('click', this.boundClick);
        document.addEventListener('input', this.boundInput);
        document.addEventListener('visibilitychange', this.boundVisibility);
        // Audio unlocks on the first click, tap or key press.
        this.boundUnlock = () => {
            this.audio?.unlock();
            document.removeEventListener('pointerdown', this.boundUnlock, true);
            document.removeEventListener('keydown', this.boundUnlock, true);
        };
        document.addEventListener('pointerdown', this.boundUnlock, true);
        document.addEventListener('keydown', this.boundUnlock, true);
        this.unsubscribe = this.sim.subscribe((event) => this.onCommit(event));
        this.applySettings();
        this.nodes.game?.classList.remove('is-hidden');
        this.world?.setState(this.state);
        this.render();
        this.showPendingModals();
        queueMicrotask(() => this.maybeShowTutorial());
    }
    destroy() {
        this.destroyed = true;
        clearInterval(this.autoTimer);
        this.unsubscribe?.();
        document.removeEventListener('click', this.boundClick);
        document.removeEventListener('input', this.boundInput);
        document.removeEventListener('visibilitychange', this.boundVisibility);
        document.removeEventListener('pointerdown', this.boundUnlock, true);
        document.removeEventListener('keydown', this.boundUnlock, true);
    }
    onCommit(event) {
        if (this.destroyed)
            return;
        this.state = event.state;
        this.lastEventType = event.type;
        if (this.state.settings.autoSave)
            (0, persistence_js_1.saveGame)(this.state);
        this.world?.setState(this.state);
        this.audio?.setSettings(this.state.settings);
        this.applySettings();
        this.render();
        if (event.type === 'lead:screened')
            this.audio?.play('click');
        else if (event.type === 'booking:accepted' || event.type === 'encounter:completed' || event.type === 'goal:claimed')
            this.audio?.play('cash');
        else if (event.type === 'leads:generated')
            this.audio?.play('message');
        else if (event.type.includes('declined') || event.type.includes('event'))
            this.audio?.play('warning');
        else
            this.audio?.play('click');
        for (const goal of event.goals || [])
            this.toast('Goal ready', `${goal.name} can now be claimed in Growth.`, 'success', '☆');
        for (const level of event.levels || [])
            this.toast(`Level ${level}`, 'You earned a skill point.', 'success', '↑');
        queueMicrotask(() => this.showPendingModals());
    }
    applySettings() {
        const settings = this.state.settings;
        document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));
        document.body.classList.toggle('large-text', Boolean(settings.largeText));
        document.body.classList.toggle('reduce-transparency', Boolean(settings.reduceTransparency));
        document.body.classList.toggle('reduced-motion', Boolean(settings.reducedMotion));
    }
    render() {
        this.renderHud();
        this.renderNeeds();
        this.renderPhone();
        this.renderVenue();
        this.updateTimeButtons();
    }
    renderHud() {
        const { state } = this;
        const risk = this.sim.getRiskSummary();
        this.nodes.day.textContent = `${state.clock.day} · ${data_js_4.DAY_NAMES[(state.clock.day - 1) % 7]}`;
        this.nodes.slot.textContent = data_js_4.SLOTS[state.clock.slot];
        this.nodes.cash.textContent = (0, utils_js_4.formatMoney)(state.finance.cash);
        this.nodes.reputation.textContent = `${reputationLabel(state.profile.reputation)} · ${Math.round(state.profile.reputation)}`;
        this.nodes.risk.textContent = `${risk.label} · ${risk.score}`;
        this.nodes.risk.dataset.level = risk.level;
        this.nodes.playerName.textContent = state.profile.name;
        this.nodes.level.textContent = state.profile.level;
        this.nodes.xp.textContent = `${Math.round(state.profile.xp)}/${state.profile.level * 100}`;
        this.nodes.safety.textContent = Math.round(state.profile.safety);
        this.nodes.exposure.textContent = Math.round(state.profile.exposure);
        this.nodes.nextSlot.textContent = state.clock.slot === 3 ? `Day ${state.clock.day + 1} · Morning` : data_js_4.SLOTS[state.clock.slot + 1];
        const newLeads = state.leads.filter((lead) => lead.status === 'new').length;
        this.nodes.leadBadge.textContent = newLeads;
        this.nodes.leadBadge.dataset.count = newLeads;
        this.nodes.floatingBadge.textContent = newLeads;
        this.nodes.floatingBadge.style.display = newLeads ? '' : 'none';
    }
    renderNeeds() {
        this.nodes.needs.innerHTML = Object.entries(this.state.profile.needs).map(([key, value]) => {
            const meta = NEED_META[key] || { icon: '•', label: (0, utils_js_4.titleCase)(key) };
            return `<div class="need-row">
    <span class="need-icon" aria-hidden="true">${meta.icon}</span>
    <div class="need-copy">
      <div class="need-label"><span>${meta.label}</span><span class="need-value">${Math.round(value)}</span></div>
      <div class="meter" data-level="${toneForValue(value)}"><span style="width:${percent(value)}%"></span></div>
    </div>
  </div>`;
        }).join('');
    }
    renderPhone() {
        this.nodes.phone.classList.toggle('is-hidden', !this.phoneOpen);
        this.nodes.phoneToggle.classList.toggle('is-hidden', this.phoneOpen);
        document.querySelectorAll('.phone-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === this.activeTab));
        const titles = { leads: 'Leads', calendar: 'Calendar', business: 'Business', network: 'Network', goals: 'Growth' };
        this.nodes.phoneTitle.textContent = titles[this.activeTab] || 'Brightline';
        if (this.activeTab === 'leads')
            this.renderLeads();
        else if (this.activeTab === 'calendar')
            this.renderCalendar();
        else if (this.activeTab === 'business')
            this.renderBusiness();
        else if (this.activeTab === 'network')
            this.renderNetwork();
        else
            this.renderGoals();
    }
    renderLeads() {
        const active = this.state.leads.filter((lead) => lead.status === 'new')
            .sort((a, b) => (b.screened - a.screened) || (a.screenedRisk ?? a.risk) - (b.screenedRisk ?? b.risk));
        const archived = this.state.leads.filter((lead) => lead.status !== 'new').slice(0, 6);
        if (!active.length) {
            this.nodes.phoneContent.innerHTML = `<div class="empty-state"><span class="empty-icon">◎</span><h3>Inbox clear</h3><p>Use Market, visit Luma Studio, or advance time to attract new inquiries.</p>${button('Market now', 'quick-activity', 'marketing', 'button primary')}</div>${this.renderLeadArchive(archived)}`;
            return;
        }
        this.nodes.phoneContent.innerHTML = `
  <p class="section-intro">Screen first, compare the assessed risk with your capacity, then negotiate and schedule. Grounded mode requires screening.</p>
  <div class="section-heading"><h3>${active.length} active ${active.length === 1 ? 'inquiry' : 'inquiries'}</h3><small>Base rate ${(0, utils_js_4.formatMoney)(this.state.business.rate)}</small></div>
  <div class="card-stack">${active.map((lead) => this.leadCard(lead)).join('')}</div>
  ${this.renderLeadArchive(archived)}`;
    }
    leadCard(lead) {
        const datePackage = getPackage(lead.packageId);
        const risk = lead.screened ? lead.screenedRisk : null;
        const expiryDelta = lead.expiresAt - (0, utils_js_4.absoluteSlot)(this.state.clock.day, this.state.clock.slot);
        const flags = lead.discoveredFlags || [];
        const groundedBlocked = this.state.meta.difficulty === 'grounded' && !lead.screened;
        return `<article class="data-card" data-lead-id="${(0, utils_js_4.escapeHtml)(lead.id)}">
  <div class="card-top">
    <div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(lead.alias)}</h3><p>${(0, utils_js_4.escapeHtml)(data_js_4.CLIENT_ARCHETYPES[lead.archetype]?.label || 'New inquiry')} · ${(0, utils_js_4.escapeHtml)(lead.source)}</p></div>
    <span class="card-amount">${(0, utils_js_4.formatMoney)(lead.finalRate || lead.offered)}</span>
  </div>
  <div class="card-meta">
    ${pill(datePackage.name, 'info')}
    ${pill(`Day ${lead.desiredDay} · ${data_js_4.SLOTS[lead.desiredSlot]}`)}
    ${lead.screened ? pill(`Risk ${risk}`, riskTone(risk)) : pill('Unscreened', 'warn')}
    ${pill(`ID ${Math.round(lead.verification)}%`, lead.verification >= 65 ? 'good' : lead.verification < 40 ? 'risk' : 'warn')}
    ${pill(expiryDelta <= 1 ? 'Expires soon' : `${expiryDelta} slots left`, expiryDelta <= 2 ? 'risk' : '')}
  </div>
  <p class="card-detail">${(0, utils_js_4.escapeHtml)(lead.message)} Requested: ${(0, utils_js_4.escapeHtml)(lead.requestedLocation)}.</p>
  ${flags.length ? `<p class="card-detail"><strong>Screening notes:</strong> ${flags.map(utils_js_4.escapeHtml).join(', ')}.</p>` : ''}
  <div class="card-actions">
    ${lead.screened ? button('View screening', 'view-screening', lead.id) : button('Screen', 'screen-lead', lead.id, 'primary')}
    ${button('Negotiate', 'negotiate-lead', lead.id)}
    ${button(groundedBlocked ? 'Screen to confirm' : 'Confirm', 'accept-lead', lead.id, 'accent', groundedBlocked ? 'disabled' : '')}
    ${button('Decline', 'decline-lead', lead.id)}
    ${lead.screened && (risk > 50 || flags.length) ? button('Blacklist', 'blacklist-lead', lead.id, 'danger') : ''}
  </div>
</article>`;
    }
    renderLeadArchive(archived) {
        if (!archived.length)
            return '';
        return `<div class="section-heading" style="margin-top:20px"><h3>Recent outcomes</h3></div>
  <div class="card-stack">${archived.map((lead) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(lead.alias)}</h3><p>${(0, utils_js_4.escapeHtml)(getPackage(lead.packageId).name)}</p></div>${pill((0, utils_js_4.titleCase)(lead.status), lead.status === 'accepted' ? 'good' : lead.status === 'blacklisted' ? 'risk' : '')}</div></div>`).join('')}</div>`;
    }
    renderCalendar() {
        const now = (0, utils_js_4.absoluteSlot)(this.state.clock.day, this.state.clock.slot);
        const days = Array.from({ length: 4 }, (_, index) => this.state.clock.day + index);
        const upcoming = this.state.bookings.filter((booking) => ['confirmed', 'in_progress'].includes(booking.status)).sort((a, b) => (0, utils_js_4.absoluteSlot)(a.day, a.slot) - (0, utils_js_4.absoluteSlot)(b.day, b.slot));
        const history = this.state.bookings.filter((booking) => ['completed', 'exited'].includes(booking.status)).sort((a, b) => (b.completedDay || b.day) - (a.completedDay || a.day)).slice(0, 5);
        this.nodes.phoneContent.innerHTML = `
  <p class="section-intro">Each action consumes one time slot. A confirmed booking occupies its slot and must be resolved before time can continue.</p>
  <div class="calendar-strip">${days.map((day) => `<section class="calendar-day">
    <div class="calendar-day-header"><span>${compactDayLabel(day)}</span><span>${day === this.state.clock.day ? 'Today' : ''}</span></div>
    <div class="calendar-slots">${data_js_4.SLOTS.map((slotName, slot) => {
            const abs = (0, utils_js_4.absoluteSlot)(day, slot);
            const booking = this.state.bookings.find((item) => item.day === day && item.slot === slot && ['confirmed', 'in_progress'].includes(item.status));
            const isCurrent = abs === now;
            const isPast = abs < now;
            return `<button class="calendar-slot${isCurrent ? ' is-current' : ''}${isPast ? ' is-past' : ''}" data-kind="${booking ? 'booking' : 'open'}" ${booking && isCurrent ? `data-action="start-booking" data-id="${(0, utils_js_4.escapeHtml)(booking.id)}"` : ''}>
        <small>${(0, utils_js_4.escapeHtml)(slotName)}</small><strong>${booking ? (0, utils_js_4.escapeHtml)(booking.alias) : isPast ? 'Past' : isCurrent ? 'Current' : 'Open'}</strong>
      </button>`;
        }).join('')}</div>
  </section>`).join('')}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Upcoming</h3><small>${upcoming.length} confirmed</small></div>
  ${upcoming.length ? `<div class="card-stack">${upcoming.map((booking) => this.bookingCard(booking, now)).join('')}</div>` : `<div class="empty-state" style="min-height:120px"><p>No bookings confirmed. Screen and accept a suitable lead.</p></div>`}
  ${history.length ? `<div class="section-heading" style="margin-top:18px"><h3>Recent dates</h3></div><div class="card-stack">${history.map((booking) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(booking.alias)}</h3><p>${(0, utils_js_4.escapeHtml)(getPackage(booking.packageId).name)} · Day ${booking.completedDay}</p></div>${pill(booking.result?.review || (0, utils_js_4.titleCase)(booking.status), booking.result?.incident ? 'risk' : booking.status === 'exited' ? 'warn' : 'good')}</div><div class="card-meta">${pill(`Net ${(0, utils_js_4.formatMoney)(booking.result?.settlement || 0)}`)}${pill(`Quality ${booking.result?.quality ?? '—'}`)}</div></div>`).join('')}</div>` : ''}`;
    }
    bookingCard(booking, now) {
        const abs = (0, utils_js_4.absoluteSlot)(booking.day, booking.slot);
        const ready = abs === now;
        const until = abs - now;
        return `<article class="data-card">
  <div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(booking.alias)}</h3><p>${(0, utils_js_4.escapeHtml)(getPackage(booking.packageId).name)} · ${(0, utils_js_4.escapeHtml)(booking.location)}</p></div><span class="card-amount">${(0, utils_js_4.formatMoney)(booking.rate)}</span></div>
  <div class="card-meta">${pill(`Day ${booking.day} · ${data_js_4.SLOTS[booking.slot]}`, ready ? 'warn' : 'info')}${pill(`Risk ${booking.risk}`, riskTone(booking.risk))}${pill(`${(0, utils_js_4.formatMoney)(booking.deposit)} deposit`, 'good')}</div>
  <div class="card-actions">${ready ? button('Begin date', 'start-booking', booking.id, 'primary') : `<button disabled>${until === 1 ? 'Next slot' : `${until} slots away`}</button>`}</div>
</article>`;
    }
    renderBusiness() {
        const model = data_js_4.BUSINESS_MODELS[this.state.business.model];
        const region = data_js_4.REGIONS[this.state.profile.region];
        const ledger = this.state.finance.ledger.slice(0, 10);
        this.nodes.phoneContent.innerHTML = `
  <p class="section-intro">Set a clear market position, keep screening and privacy practices funded, and choose how much autonomy to exchange for support.</p>
  <div class="summary-grid">
    <div><span>Cash</span><strong>${(0, utils_js_4.formatMoney)(this.state.finance.cash)}</strong></div>
    <div><span>Debt</span><strong>${(0, utils_js_4.formatMoney)(this.state.finance.debt)}</strong></div>
    <div><span>Revenue</span><strong>${(0, utils_js_4.formatMoney)(this.state.finance.totalRevenue)}</strong></div>
    <div><span>Expenses</span><strong>${(0, utils_js_4.formatMoney)(this.state.finance.totalExpenses)}</strong></div>
  </div>
  <div class="section-heading" style="margin-top:18px"><h3>Rates & operations</h3><small>${(0, utils_js_4.escapeHtml)(region.name)}</small></div>
  <div class="data-card">
    <div class="form-field">
      <label for="business-rate">Base rate</label>
      <div class="slider-row"><input id="business-rate" type="range" min="80" max="900" step="5" value="${this.state.business.rate}" data-output="business-rate-output" /><output id="business-rate-output" class="slider-output">${(0, utils_js_4.formatMoney)(this.state.business.rate)}</output></div>
    </div>
    <div class="form-field" style="margin-top:12px">
      <label for="business-deposit">Deposit</label>
      <div class="slider-row"><input id="business-deposit" type="range" min="0" max="80" step="5" value="${this.state.business.depositPct}" data-output="business-deposit-output" data-suffix="%" /><output id="business-deposit-output" class="slider-output">${this.state.business.depositPct}%</output></div>
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-field"><label for="business-screening">Screening tools</label><select id="business-screening">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}"${value === this.state.business.screening ? ' selected' : ''}>Level ${value}</option>`).join('')}</select></div>
      <div class="form-field"><label for="business-privacy">Privacy practice</label><select id="business-privacy">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}"${value === this.state.business.privacy ? ' selected' : ''}>Level ${value}</option>`).join('')}</select></div>
    </div>
    <div class="card-actions">${button('Save operating plan', 'apply-business', '', 'primary')}</div>
  </div>
  <div class="section-heading" style="margin-top:18px"><h3>Operating model</h3><small>${(0, utils_js_4.escapeHtml)(model.name)}</small></div>
  <div class="card-stack">${Object.values(data_js_4.BUSINESS_MODELS).map((item) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(item.name)}</h3><p>${Math.round(item.cut * 100)}% booking cut · ${(0, utils_js_4.formatMoney)(item.weeklyFee)}/week</p></div>${item.id === model.id ? pill('Current', 'good') : ''}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(item.description)}</p><div class="card-meta">${pill(`Safety +${item.riskReduction}`, 'good')}${pill(`Lead effect ${item.leadBonus >= 0 ? '+' : ''}${Math.round(item.leadBonus * 100)}%`, 'info')}</div><div class="card-actions">${item.id === model.id ? '<button disabled>Active</button>' : button(`Switch · ${(0, utils_js_4.formatMoney)(item.id === 'independent' ? 40 : item.id === 'protected' ? 220 : 320)}`, 'change-model', item.id)}</div></div>`).join('')}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Brand focus</h3></div>
  <div class="card-stack">${Object.values(data_js_4.BRAND_FOCUSES).map((item) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(item.name)}</h3><p>${(0, utils_js_4.escapeHtml)(item.description)}</p></div>${item.id === this.state.business.brand ? pill('Current', 'good') : ''}</div><div class="card-actions">${item.id === this.state.business.brand ? '<button disabled>Active</button>' : button('Rebrand · $90', 'change-brand', item.id)}</div></div>`).join('')}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Regions</h3><small>Fictional policy models</small></div>
  <div class="card-stack">${Object.values(data_js_4.REGIONS).map((item) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(item.name)}</h3><p>${(0, utils_js_4.escapeHtml)(item.legalModel)}</p></div>${item.id === region.id ? pill('Current', 'good') : ''}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(item.description)}</p><div class="card-meta">${pill(`Demand ×${item.demand.toFixed(2)}`)}${pill(`Rate ×${item.price.toFixed(2)}`)}${pill(`Risk ×${item.risk.toFixed(2)}`, item.risk > 1 ? 'warn' : 'good')}</div><div class="card-actions">${item.id === region.id ? '<button disabled>Current region</button>' : button(`Relocate · ${(0, utils_js_4.formatMoney)(item.moveCost)}`, 'move-region', item.id)}</div></div>`).join('')}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Ledger</h3><small>Latest ${ledger.length}</small></div>
  <div class="ledger-list">${ledger.map((item) => `<div class="ledger-row"><span>Day ${item.day} · ${(0, utils_js_4.escapeHtml)(item.label)}</span><strong class="${item.amount >= 0 ? 'positive' : 'negative'}">${item.amount >= 0 ? '+' : ''}${(0, utils_js_4.formatMoney)(item.amount)}</strong></div>`).join('')}</div>`;
    }
    renderNetwork() {
        const sections = [
            ['team', 'Support'], ['clients', 'Clients'], ['relationships', 'Personal'], ['journal', 'Journal'],
        ];
        const nav = `<div class="card-actions" style="margin:0 0 12px">${sections.map(([id, label]) => `<button class="${this.networkSection === id ? 'primary' : ''}" data-action="network-section" data-id="${id}">${label}</button>`).join('')}</div>`;
        let content = '';
        if (this.networkSection === 'team')
            content = this.renderTeam();
        if (this.networkSection === 'clients')
            content = this.renderClients();
        if (this.networkSection === 'relationships')
            content = this.renderRelationships();
        if (this.networkSection === 'journal')
            content = this.renderJournal();
        this.nodes.phoneContent.innerHTML = `<p class="section-intro">Professional support, trusted peers, regular clients, and a stable personal life all change the business you can safely sustain.</p>${nav}${content}`;
    }
    renderTeam() {
        const weeklyTotal = data_js_4.CONTACTS.filter((contact) => this.state.business.hiredContacts.includes(contact.id)).reduce((sum, contact) => sum + contact.weeklyCost, 0);
        return `<div class="section-heading"><h3>Professional contacts</h3><small>${(0, utils_js_4.formatMoney)(weeklyTotal)}/week</small></div><div class="card-stack">${data_js_4.CONTACTS.map((contact) => {
            const hired = this.state.business.hiredContacts.includes(contact.id);
            return `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(contact.name)}</h3><p>${(0, utils_js_4.escapeHtml)(contact.role)}</p></div>${hired ? pill('Hired', 'good') : ''}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(contact.description)}</p><div class="card-meta">${pill(`Onboard ${(0, utils_js_4.formatMoney)(contact.hireCost)}`)}${pill(`${(0, utils_js_4.formatMoney)(contact.weeklyCost)}/week`)}${contact.riskReduction ? pill(`Safety +${contact.riskReduction}`, 'good') : ''}</div><div class="card-actions">${hired ? button('End contract', 'fire-contact', contact.id, 'danger') : button('Hire', 'hire-contact', contact.id, 'primary')}</div></div>`;
        }).join('')}</div>`;
    }
    renderClients() {
        const clients = [...this.state.clients].sort((a, b) => Number(b.regular) - Number(a.regular) || b.lifetimeValue - a.lifetimeValue);
        const blacklist = this.state.blacklist.slice(0, 10);
        return `<div class="section-heading"><h3>Client notes</h3><small>${clients.length} known</small></div>
  ${clients.length ? `<div class="card-stack">${clients.map((client) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(client.alias)}</h3><p>${(0, utils_js_4.escapeHtml)(data_js_4.CLIENT_ARCHETYPES[client.archetype]?.label || 'Client')}</p></div>${client.regular ? pill('Regular', 'good') : ''}</div><div class="card-meta">${pill(`${client.visits} dates`)}${pill(`${(0, utils_js_4.formatMoney)(client.lifetimeValue)} value`)}</div><p class="card-detail"><strong>Preferences:</strong> ${(client.preferences || []).map(utils_js_4.escapeHtml).join(', ')}.</p>${client.notes?.[0] ? `<p class="card-detail"><strong>Latest:</strong> ${(0, utils_js_4.escapeHtml)(client.notes[0])}</p>` : ''}</div>`).join('')}</div>` : `<div class="empty-state" style="min-height:130px"><p>Completed dates create CRM notes and potential regulars.</p></div>`}
  <div class="section-heading" style="margin-top:18px"><h3>Blacklist</h3><small>${blacklist.length}</small></div>
  ${blacklist.length ? `<div class="card-stack">${blacklist.map((entry) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(entry.alias)}</h3><p>Added day ${entry.day}</p></div>${pill('Do not book', 'risk')}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(entry.reason)}</p></div>`).join('')}</div>` : `<p class="section-intro">No entries. Screening can reveal reasons to blacklist a lead.</p>`}`;
    }
    renderRelationships() {
        const relationships = this.state.relationships;
        const partner = relationships.partner;
        const partnerCard = partner
            ? `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(partner.name)}</h3><p>Partner · ${(0, utils_js_4.escapeHtml)((0, utils_js_4.titleCase)(partner.knowledge))} disclosure</p></div>${pill(`Trust ${Math.round(partner.trust)}`, partner.trust >= 70 ? 'good' : partner.trust < 45 ? 'risk' : 'warn')}</div><div class="card-meta">${pill(`Discovery pressure ${Math.round(partner.discoveryRisk)}`, partner.discoveryRisk >= 65 ? 'risk' : partner.discoveryRisk >= 35 ? 'warn' : 'good')}${pill(`${this.state.metrics.partnerTime || 0} protected-time choices`, 'info')}</div><div class="progress-bar" style="margin-top:10px"><span style="width:${partner.trust}%"></span></div><p class="card-detail">Disclosure, protected time, public exposure, and overloaded schedules change this relationship over the campaign.</p></div>`
            : `<div class="data-card"><div class="card-top"><div class="card-title"><h3>Independent personal life</h3><p>No current partner</p></div>${pill('Flexible calendar', 'info')}</div><p class="card-detail">Friendship, family, and peer connections remain important recovery resources. Partner-specific events and endings are unavailable in this campaign.</p></div>`;
        return `<div class="card-stack">
  ${partnerCard}
  <div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(relationships.friend.name)}</h3><p>Trusted friend · ${(0, utils_js_4.escapeHtml)(relationships.friend.knowledge)}</p></div>${pill(`Trust ${relationships.friend.trust}`, relationships.friend.trust >= 60 ? 'good' : 'warn')}</div><p class="card-detail">A reliable social connection helps recovery and can support safe-call planning.</p></div>
  <div class="data-card"><div class="card-top"><div class="card-title"><h3>Family</h3><p>Knowledge: ${(0, utils_js_4.escapeHtml)(relationships.family.knowledge)}</p></div>${pill(`Closeness ${relationships.family.closeness}`, relationships.family.closeness >= 55 ? 'good' : 'warn')}</div><p class="card-detail">Time choices and exposure events can change closeness over a long campaign.</p></div>
  <div class="data-card"><div class="card-top"><div class="card-title"><h3>Peer network</h3><p>Referrals, safety notes, and mutual support</p></div>${pill(`${relationships.peerNetwork}/100`, relationships.peerNetwork >= 55 ? 'good' : 'info')}</div><div class="progress-bar"><span style="width:${relationships.peerNetwork}%"></span></div></div>
</div>`;
    }
    renderJournal() {
        return `<div class="section-heading"><h3>Career journal</h3><small>${this.state.journal.length} entries</small></div><div class="card-stack">${this.state.journal.slice(0, 32).map((entry) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${JOURNAL_ICONS[entry.type] || '•'} ${(0, utils_js_4.escapeHtml)(entry.title)}</h3><p>${dayLabel(entry.day)} · ${data_js_4.SLOTS[entry.slot]}</p></div></div><p class="card-detail">${(0, utils_js_4.escapeHtml)(entry.text)}</p></div>`).join('')}</div>`;
    }
    renderGoals() {
        const skills = this.state.profile.stats;
        this.nodes.phoneContent.innerHTML = `
  <p class="section-intro">Experience unlocks skill points. Goals reward safe, sustainable progress rather than volume alone.</p>
  <div class="summary-grid"><div><span>Level</span><strong>${this.state.profile.level}</strong></div><div><span>Skill points</span><strong>${this.state.profile.skillPoints}</strong></div><div><span>XP</span><strong>${Math.round(this.state.profile.xp)}</strong></div><div><span>Next</span><strong>${this.state.profile.level * 100}</strong></div></div>
  <div class="progress-bar" style="margin-top:9px"><span style="width:${percent(this.state.profile.xp, this.state.profile.level * 100)}%"></span></div>
  <div class="section-heading" style="margin-top:18px"><h3>Skills</h3></div>
  <div class="card-stack">${Object.entries(data_js_4.SKILLS).map(([id, skill]) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(skill.name)}</h3><p>${(0, utils_js_4.escapeHtml)(skill.description)}</p></div>${pill(`${skills[id]}/10`, skills[id] >= 8 ? 'good' : 'info')}</div><div class="progress-bar" style="margin-top:10px"><span style="width:${skills[id] * 10}%"></span></div><div class="card-actions">${button(skills[id] >= 10 ? 'Mastered' : 'Spend 1 point', 'upgrade-skill', id, '', this.state.profile.skillPoints < 1 || skills[id] >= 10 ? 'disabled' : '')}</div></div>`).join('')}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Career goals</h3></div>
  <div class="card-stack">${data_js_4.GOAL_DEFINITIONS.map((definition) => {
            const goal = this.state.goals.find((item) => item.id === definition.id) || { progress: 0, complete: false, claimed: false };
            const progress = Math.min(definition.target, goal.progress);
            return `<div class="data-card goal-card${goal.complete ? ' is-complete' : ''}"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(definition.name)}</h3><p>${(0, utils_js_4.escapeHtml)(definition.description)}</p></div>${goal.claimed ? pill('Claimed', 'good') : goal.complete ? pill('Ready', 'good') : ''}</div><div class="progress-bar"><span style="width:${percent(progress, definition.target)}%"></span></div><div class="card-meta">${pill(`${Math.round(progress)}/${definition.target}`)}<span class="goal-reward">${definition.rewardCash ? `${(0, utils_js_4.formatMoney)(definition.rewardCash)} + ` : ''}${definition.rewardXp} XP</span></div><div class="card-actions">${goal.complete && !goal.claimed ? button('Claim reward', 'claim-goal', definition.id, 'primary') : ''}</div></div>`;
        }).join('')}</div>
  ${this.renderCareerPaths()}`;
    }
    renderCareerPaths() {
        const paths = this.sim.getCareerPaths();
        const completed = this.state.career?.ending ? data_js_4.CAREER_ENDINGS[this.state.career.ending] : null;
        const requirementValue = (item) => {
            if (['cash', 'debtMax'].includes(item.key))
                return `${(0, utils_js_4.formatMoney)(item.current)} / ${(0, utils_js_4.formatMoney)(item.target)}`;
            if (item.key === 'partnerKnowledge')
                return item.current >= 1 ? 'Supportive / Supportive' : 'Not supportive / Supportive';
            if (item.key === 'independentModel')
                return item.current >= 1 ? 'Independent / Independent' : 'Other / Independent';
            return `${Math.round(item.current)} / ${item.target}`;
        };
        return `<div class="section-heading" style="margin-top:18px"><h3>Long-term paths</h3><small>${completed ? 'Ending complete' : `${paths.filter((path) => path.ready).length} ready`}</small></div>
  ${completed ? `<div class="data-card goal-card is-complete"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(completed.icon)} ${(0, utils_js_4.escapeHtml)(completed.name)}</h3><p>Completed on day ${this.state.career.completedDay}</p></div>${pill(`Score ${this.state.career.score}`, 'good')}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(completed.epilogue)}</p></div>` : '<p class="section-intro">A campaign can conclude through several viable definitions of success. Completing an ending preserves the save and allows continued sandbox play.</p>'}
  <div class="card-stack">${paths.map((path) => {
            const selected = this.state.career?.ending === path.id;
            return `<div class="data-card goal-card${path.ready || selected ? ' is-complete' : ''}"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(path.icon)} ${(0, utils_js_4.escapeHtml)(path.name)}</h3><p>${(0, utils_js_4.escapeHtml)(path.description)}</p></div>${selected ? pill('Completed', 'good') : path.unavailable ? pill('Unavailable', 'warn') : path.ready ? pill('Ready', 'good') : ''}</div><div class="card-meta">${path.requirements.map((item) => pill(`${item.ready ? '✓' : '○'} ${item.label}: ${requirementValue(item)}`, item.ready ? 'good' : 'info')).join('')}</div><div class="card-actions">${!completed ? button(path.unavailable ? 'Partner path unavailable' : path.ready ? 'Complete this path' : 'Requirements incomplete', 'complete-career', path.id, path.ready ? 'primary' : '', path.ready && !path.unavailable ? '' : 'disabled') : ''}</div></div>`;
        }).join('')}</div>`;
    }
    renderVenue() {
        const venue = getVenue(this.state.world.selectedVenue);
        if (!venue) {
            this.nodes.venue.classList.add('is-hidden');
            return;
        }
        this.nodes.venue.classList.remove('is-hidden');
        this.nodes.venue.innerHTML = `<span class="eyebrow">Current venue</span><h3>${(0, utils_js_4.escapeHtml)(venue.icon)} ${(0, utils_js_4.escapeHtml)(venue.name)}</h3><p>${(0, utils_js_4.escapeHtml)(venue.description)}</p><div class="card-actions">${venue.actions.map((action) => button(ACTION_LABELS[action] || (0, utils_js_4.titleCase)(action), 'venue-action', `${venue.id}:${action}`, action === 'booking' && this.sim.getCurrentBooking() ? 'primary' : '')).join('')}</div>`;
    }
    setActiveTab(tab) {
        if (!['leads', 'calendar', 'business', 'network', 'goals'].includes(tab))
            return;
        this.activeTab = tab;
        this.phoneOpen = true;
        this.renderPhone();
    }
    togglePhone(force) {
        this.phoneOpen = typeof force === 'boolean' ? force : !this.phoneOpen;
        this.renderPhone();
    }
    handleInput(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement))
            return;
        const outputId = input.dataset.output;
        if (outputId) {
            const output = document.getElementById(outputId);
            if (output)
                output.textContent = input.dataset.suffix === '%' ? `${input.value}%` : (0, utils_js_4.formatMoney)(input.value);
        }
    }
    async handleClick(event) {
        const tab = event.target.closest('[data-tab]');
        if (tab) {
            this.setActiveTab(tab.dataset.tab);
            this.audio?.play('click');
            return;
        }
        const actionNode = event.target.closest('[data-action]');
        if (!actionNode || actionNode.disabled)
            return;
        const action = actionNode.dataset.action;
        const id = actionNode.dataset.id || '';
        try {
            switch (action) {
                case 'open-menu':
                    this.openMenu();
                    break;
                case 'close-modal':
                    this.closeModal();
                    break;
                case 'toggle-phone':
                    this.togglePhone();
                    break;
                case 'open-character':
                    this.openCharacter();
                    break;
                case 'open-graphics':
                    this.onGraphics?.();
                    break;
                case 'open-settings':
                    this.openSettings();
                    break;
                case 'open-help':
                    this.openHelp();
                    break;
                case 'time-pause':
                    this.setTimeMode(0);
                    break;
                case 'time-play':
                    this.setTimeMode(1);
                    break;
                case 'time-fast':
                    this.setTimeMode(2);
                    break;
                case 'quick-activity':
                    this.doActivity(id);
                    break;
                case 'advance-slot':
                    this.advanceSlot();
                    break;
                case 'screen-lead':
                    this.screenLead(id);
                    break;
                case 'view-screening':
                    this.openScreening(id);
                    break;
                case 'negotiate-lead':
                    this.openNegotiation(id);
                    break;
                case 'submit-negotiation':
                    this.submitNegotiation(id);
                    break;
                case 'accept-lead':
                    this.acceptLead(id);
                    break;
                case 'decline-lead':
                    this.declineLead(id, false);
                    break;
                case 'blacklist-lead':
                    this.confirmBlacklist(id);
                    break;
                case 'confirm-blacklist':
                    this.declineLead(id, true);
                    this.closeModal(true);
                    break;
                case 'start-booking':
                    this.startBooking(id);
                    break;
                case 'encounter-choice':
                    this.chooseEncounter(id);
                    break;
                case 'event-choice':
                    this.resolveEvent(id);
                    break;
                case 'dismiss-weekly':
                    this.sim.dismissWeeklyReport();
                    this.closeModal(true);
                    break;
                case 'apply-business':
                    this.applyBusinessForm();
                    break;
                case 'change-model':
                    this.runAction(() => this.sim.changeBusinessModel(id), { success: 'Operating model updated.' });
                    break;
                case 'change-brand':
                    this.runAction(() => this.sim.changeBrand(id), { success: 'Public brand updated.' });
                    break;
                case 'hire-contact':
                    this.runAction(() => this.sim.hireContact(id), { success: 'Contact added to your support team.' });
                    break;
                case 'fire-contact':
                    this.confirmFire(id);
                    break;
                case 'confirm-fire':
                    this.runAction(() => this.sim.fireContact(id), { success: 'Contract ended.' });
                    this.closeModal(true);
                    break;
                case 'move-region':
                    this.confirmMove(id);
                    break;
                case 'confirm-move':
                    this.runAction(() => this.sim.moveRegion(id), { success: 'Relocation complete.' });
                    this.closeModal(true);
                    break;
                case 'upgrade-skill':
                    this.runAction(() => this.sim.upgradeSkill(id), { success: `${data_js_4.SKILLS[id]?.name || 'Skill'} improved.` });
                    break;
                case 'claim-goal':
                    this.runAction(() => this.sim.claimGoal(id), { success: 'Goal reward claimed.' });
                    break;
                case 'complete-career':
                    this.confirmCareer(id);
                    break;
                case 'confirm-career':
                    this.finishCareer(id);
                    break;
                case 'continue-sandbox':
                    this.sim.acknowledgeEnding();
                    this.closeModal(true);
                    this.toast('Sandbox continues', 'The ending is recorded and the city remains playable.', 'success', '→');
                    break;
                case 'venue-action':
                    this.doVenueAction(id);
                    break;
                case 'network-section':
                    this.networkSection = id;
                    this.renderNetwork();
                    break;
                case 'save-now':
                    this.saveNow();
                    break;
                case 'export-save':
                    this.downloadSave();
                    break;
                case 'import-save-trigger':
                    document.querySelector('#import-save-input')?.click();
                    break;
                case 'new-game':
                    this.confirmNewGame();
                    break;
                case 'confirm-new-game':
                    (0, persistence_js_1.clearSave)();
                    this.closeModal(true);
                    this.onNewGame();
                    break;
                case 'apply-settings':
                    this.applySettingsForm();
                    break;
                case 'tutorial-start':
                    this.sim.setTutorialStep(1);
                    this.closeModal(true);
                    this.toast('First step', 'Open Leads, screen an inquiry, and compare the result before confirming.', 'success', '◎');
                    break;
                case 'tutorial-skip':
                    this.state.meta.tutorial = false;
                    this.sim.setTutorialStep(99);
                    this.closeModal(true);
                    break;
                default: break;
            }
        }
        catch (error) {
            console.error(error);
            this.toast('Action failed', error?.message || 'An unexpected error occurred.', 'danger', '!');
        }
    }
    /** Esc / Start: close the open dialog, or open the pause menu. */
    menuAction() {
        if (!this.nodes.modal.classList.contains('is-hidden'))
            this.closeModal();
        else
            this.openMenu();
    }
    /** Space / Back: play or pause automatic slot progression. */
    toggleTime() {
        this.setTimeMode(this.timeSpeed ? 0 : 1);
    }
    runAction(action, { success = '', close = false } = {}) {
        const result = action();
        if (!result?.ok) {
            if (result?.requiresEncounter) {
                const booking = result.booking || this.sim.getCurrentBooking();
                if (booking)
                    this.startBooking(booking.id);
                return result;
            }
            if (result?.requiresEvent)
                this.showEventModal();
            else
                this.toast('Not available', result?.reason || 'That action cannot be completed now.', 'warning', '!');
            return result;
        }
        if (success)
            this.toast('Done', success, 'success', '✓');
        if (close)
            this.closeModal(true);
        if (result.uiAction === 'business')
            this.setActiveTab('business');
        if (result.uiAction === 'hire') {
            this.networkSection = 'team';
            this.setActiveTab('network');
        }
        if (result.uiAction === 'booking')
            this.setActiveTab('calendar');
        return result;
    }
    doActivity(id) {
        this.setTimeMode(0);
        const activity = data_js_4.ACTIVITIES[id];
        const result = this.runAction(() => this.sim.performActivity(id), { success: activity ? `${activity.name} completed.` : '' });
        if (result?.ok)
            this.toast('Time moved', `${dayLabel(this.state.clock.day)} · ${data_js_4.SLOTS[this.state.clock.slot]}`, 'success', '→');
    }
    doVenueAction(compound) {
        const [venueId, actionId] = compound.split(':');
        this.setTimeMode(0);
        const result = this.runAction(() => this.sim.performVenueAction(venueId, actionId), { success: `${ACTION_LABELS[actionId] || (0, utils_js_4.titleCase)(actionId)} completed.` });
        if (result?.uiAction === 'business')
            this.setActiveTab('business');
        if (result?.uiAction === 'hire') {
            this.networkSection = 'team';
            this.setActiveTab('network');
        }
        if (result?.uiAction === 'booking') {
            const booking = this.sim.getCurrentBooking();
            if (booking)
                this.startBooking(booking.id);
            else
                this.setActiveTab('calendar');
        }
    }
    advanceSlot() {
        this.setTimeMode(0);
        const result = this.runAction(() => this.sim.advanceSlot());
        if (result?.ok)
            this.toast('Calendar advanced', `${dayLabel(this.state.clock.day)} · ${data_js_4.SLOTS[this.state.clock.slot]}`, 'success', '→');
    }
    screenLead(id) {
        const result = this.runAction(() => this.sim.screenLead(id));
        if (result?.ok) {
            this.toast('Screening complete', `${result.lead.alias} assessed at risk ${result.lead.screenedRisk}.`, result.lead.screenedRisk > 55 ? 'warning' : 'success', '✓');
            this.openScreening(id);
        }
    }
    openScreening(id) {
        const lead = this.state.leads.find((item) => item.id === id);
        if (!lead)
            return;
        if (!lead.screened) {
            this.screenLead(id);
            return;
        }
        const risk = lead.screenedRisk ?? lead.risk;
        const flags = lead.discoveredFlags || [];
        const body = `
  <div class="summary-grid"><div><span>Assessed risk</span><strong>${risk}</strong></div><div><span>Verification</span><strong>${Math.round(lead.verification)}%</strong></div><div><span>Offer</span><strong>${(0, utils_js_4.formatMoney)(lead.offered)}</strong></div><div><span>Package</span><strong>${(0, utils_js_4.escapeHtml)(getPackage(lead.packageId).name)}</strong></div></div>
  <div class="section-heading" style="margin-top:18px"><h3>Checks</h3></div>
  <div class="card-stack"><div class="data-card"><div class="card-meta">${pill(lead.verification >= 65 ? 'Identity confidence: strong' : lead.verification >= 45 ? 'Identity confidence: moderate' : 'Identity confidence: weak', lead.verification >= 65 ? 'good' : lead.verification < 45 ? 'risk' : 'warn')}${pill(`Risk ${risk}`, riskTone(risk))}</div><p class="card-detail">${flags.length ? `<strong>Detected red flags:</strong> ${flags.map(utils_js_4.escapeHtml).join(', ')}.` : 'No red flags were confirmed by the available tools. This does not guarantee safety.'}</p><p class="card-detail"><strong>Preferences:</strong> ${lead.preferences.map(utils_js_4.escapeHtml).join(', ')}.</p></div></div>
  <p class="section-intro" style="margin-top:14px">Screening is one layer. Compare the result with venue, support, wellbeing, and your own boundaries before accepting.</p>`;
        const actions = `${button('Close', 'close-modal')}${button('Negotiate', 'negotiate-lead', id)}${button('Confirm', 'accept-lead', id, 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Screening report', title: lead.alias, text: lead.message, body, actions }), { kind: 'screening', wide: true });
    }
    openNegotiation(id) {
        const lead = this.state.leads.find((item) => item.id === id);
        if (!lead || lead.status !== 'new')
            return;
        const start = Math.max(80, Math.round((lead.offered * 1.12) / 5) * 5);
        const max = Math.min(1500, Math.max(500, Math.round(lead.offered * 1.8 / 5) * 5));
        const body = `<div class="summary-grid"><div><span>Current offer</span><strong>${(0, utils_js_4.formatMoney)(lead.offered)}</strong></div><div><span>Your base</span><strong>${(0, utils_js_4.formatMoney)(this.state.business.rate)}</strong></div><div><span>Attempts</span><strong>${lead.negotiationAttempts}</strong></div><div><span>Screened</span><strong>${lead.screened ? 'Yes' : 'No'}</strong></div></div>
  <div class="form-field" style="margin-top:18px"><label for="negotiation-rate">Proposed total</label><div class="slider-row"><input id="negotiation-rate" type="range" min="80" max="${max}" step="5" value="${start}" data-output="negotiation-rate-output" /><output id="negotiation-rate-output" class="slider-output">${(0, utils_js_4.formatMoney)(start)}</output></div><small>A larger increase can succeed with strong business, charisma, reputation, and screening trust, but it can also end the inquiry.</small></div>`;
        const actions = `${button('Cancel', 'close-modal')}${button('Send proposal', 'submit-negotiation', id, 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Rate negotiation', title: lead.alias, text: `Their current offer is ${(0, utils_js_4.formatMoney)(lead.offered)} for ${getPackage(lead.packageId).name.toLowerCase()}.`, body, actions }), { kind: 'negotiation', narrow: true });
    }
    submitNegotiation(id) {
        const input = document.querySelector('#negotiation-rate');
        const target = Number(input?.value);
        const result = this.runAction(() => this.sim.negotiateLead(id, target));
        if (!result?.ok)
            return;
        if (result.success) {
            this.toast('Rate agreed', `${(0, utils_js_4.formatMoney)(result.rate)} confirmed as the working offer.`, 'success', '✓');
            this.closeModal(true);
        }
        else if (result.walks) {
            this.toast('Inquiry closed', 'The prospect declined the proposal and left the conversation.', 'warning', '!');
            this.closeModal(true);
        }
        else {
            this.toast('Counteroffer received', `The revised offer is ${(0, utils_js_4.formatMoney)(result.counter)}.`, 'warning', '◇');
            this.closeModal(true);
        }
    }
    acceptLead(id) {
        const lead = this.state.leads.find((item) => item.id === id);
        const result = this.runAction(() => this.sim.acceptLead(id));
        if (result?.ok) {
            this.toast('Booking confirmed', `${lead?.alias || 'Client'} · Day ${result.booking.day}, ${data_js_4.SLOTS[result.booking.slot]}.`, 'success', '▦');
            this.closeModal(true);
            this.setActiveTab('calendar');
        }
    }
    declineLead(id, blacklist) {
        const result = this.runAction(() => this.sim.declineLead(id, blacklist));
        if (result?.ok)
            this.toast(blacklist ? 'Lead blacklisted' : 'Lead declined', blacklist ? 'The record is stored in Network → Clients.' : 'The inquiry was closed.', blacklist ? 'warning' : 'success', blacklist ? '!' : '✓');
    }
    confirmBlacklist(id) {
        const lead = this.state.leads.find((item) => item.id === id);
        if (!lead)
            return;
        const actions = `${button('Cancel', 'close-modal')}${button('Blacklist lead', 'confirm-blacklist', id, 'danger')}`;
        this.openModal(modalMarkup({ eyebrow: 'Safety record', title: `Blacklist ${lead.alias}?`, text: 'This closes the inquiry and records the alias and screening reason. It cannot be undone during this campaign.', body: `<p class="section-intro">Detected notes: ${(lead.discoveredFlags || []).map(utils_js_4.escapeHtml).join(', ') || 'player judgement'}.</p>`, actions }), { kind: 'confirm', narrow: true });
    }
    startBooking(id) {
        this.setTimeMode(0);
        const result = this.sim.startEncounter(id);
        if (!result?.ok) {
            this.toast('Booking not ready', result?.reason || 'The date cannot begin now.', 'warning', '!');
            return;
        }
        this.showEncounterModal();
    }
    chooseEncounter(choiceId) {
        const result = this.sim.chooseEncounter(choiceId);
        if (!result?.ok) {
            this.toast('Choice unavailable', result?.reason || 'Try another option.', 'warning', '!');
            return;
        }
        if (result.complete)
            this.showEncounterResult(result);
        else
            this.showEncounterModal();
    }
    showEncounterModal() {
        const view = this.sim.getEncounterView();
        if (!view)
            return;
        const body = `<div class="encounter-meter">${[0, 1, 2].map((stage) => `<span class="${stage < view.stage ? 'is-complete' : stage === view.stage ? 'is-current' : ''}"></span>`).join('')}</div>
  <div class="encounter-context">${view.context.map((item) => pill(item, item.includes('pressure') ? 'warn' : '')).join('')}</div>
  <div class="encounter-choices">${view.choices.map((choice, index) => `<button class="encounter-choice" data-action="encounter-choice" data-id="${(0, utils_js_4.escapeHtml)(choice.id)}"><span class="choice-number">${index + 1}</span><span><strong>${(0, utils_js_4.escapeHtml)(choice.label)}</strong><span>${(0, utils_js_4.escapeHtml)(choice.description)}</span></span></button>`).join('')}</div>
  <p class="section-intro" style="margin-top:15px">This system represents communication, consent, safety, and professional judgement. No explicit activity is depicted.</p>`;
        this.openModal(modalMarkup({ eyebrow: `Date · Stage ${view.stage + 1} of 3`, title: view.title, text: view.text, body }), { kind: 'encounter', wide: true, closable: false });
    }
    showEncounterResult(result) {
        const outcome = result.result;
        const tone = outcome.incident ? 'risk' : outcome.exited ? 'warn' : 'good';
        const body = `<div class="result-grid"><div><span>Review</span><strong>${(0, utils_js_4.escapeHtml)(outcome.review)}</strong></div><div><span>Net settlement</span><strong>${(0, utils_js_4.formatMoney)(outcome.settlement)}</strong></div><div><span>Tip</span><strong>${(0, utils_js_4.formatMoney)(outcome.tip)}</strong></div></div>
  <div class="card-meta">${pill(`Quality ${outcome.quality}`, outcome.quality >= 65 ? 'good' : 'warn')}${pill(`Safety capacity ${outcome.safety}`, outcome.safety >= 60 ? 'good' : 'warn')}${pill(`Reputation ${outcome.reputationDelta >= 0 ? '+' : ''}${outcome.reputationDelta}`, outcome.reputationDelta >= 0 ? 'good' : 'risk')}${pill(`Exposure ${outcome.privacyChange >= 0 ? '+' : ''}${outcome.privacyChange}`, outcome.privacyChange <= 0 ? 'good' : 'warn')}${outcome.regular ? pill('New regular', 'good') : ''}</div>
  <p class="section-intro" style="margin-top:15px">${outcome.incident ? 'A serious incident occurred. Recovery, health, and safety planning now matter more than immediate growth.' : outcome.exited ? 'You used the safe exit plan. Protecting safety can be the correct professional result even without a completed booking.' : outcome.uncomfortable ? 'The date completed, but pressure reduced wellbeing. Review the screening notes and recovery needs.' : 'The date closed without a safety incident.'}</p>`;
        const actions = button('Continue', 'close-modal', '', 'primary');
        this.openModal(modalMarkup({ eyebrow: 'Date complete', title: outcome.exited ? 'Safe exit used' : `${outcome.review} outcome`, text: `The calendar moved to ${dayLabel(this.state.clock.day)}, ${data_js_4.SLOTS[this.state.clock.slot]}.`, body, actions }), { kind: 'result', wide: true, closable: true });
        this.toast('Date resolved', `${outcome.review} · ${(0, utils_js_4.formatMoney)(outcome.settlement)} net.`, tone === 'risk' ? 'danger' : tone === 'warn' ? 'warning' : 'success', outcome.exited ? '✓' : '◆');
    }
    resolveEvent(choiceId) {
        const result = this.sim.resolveEvent(choiceId);
        if (!result?.ok) {
            this.toast('Event unresolved', result?.reason || 'Choose another response.', 'warning', '!');
            return;
        }
        this.closeModal(true);
        this.toast('Choice resolved', result.outcome, 'success', '✓');
    }
    showEventModal() {
        const event = this.state.pending.event;
        if (!event)
            return;
        const body = `<div class="encounter-choices">${event.choices.map((choice, index) => `<button class="encounter-choice" data-action="event-choice" data-id="${(0, utils_js_4.escapeHtml)(choice.id)}"><span class="choice-number">${index + 1}</span><span><strong>${(0, utils_js_4.escapeHtml)(choice.label)}</strong><span>${(0, utils_js_4.escapeHtml)(choice.description)}</span></span></button>`).join('')}</div>`;
        this.openModal(modalMarkup({ eyebrow: 'City event', title: event.title, text: event.text, body }), { kind: 'event', wide: true, closable: false });
    }
    showWeeklyReport() {
        const report = this.state.pending.weeklyReport;
        if (!report)
            return;
        const body = `<div class="summary-grid"><div><span>Revenue</span><strong>${(0, utils_js_4.formatMoney)(report.revenue)}</strong></div><div><span>Expenses</span><strong>${(0, utils_js_4.formatMoney)(report.expenses)}</strong></div><div><span>Net</span><strong>${(0, utils_js_4.formatMoney)(report.net)}</strong></div><div><span>Dates</span><strong>${report.completedBookings}</strong></div></div>
  <div class="section-heading" style="margin-top:18px"><h3>Sustainability check</h3></div>
  <div class="card-stack"><div class="data-card"><div class="card-meta">${pill(`Reputation ${report.reputation}`, report.reputation >= 45 ? 'good' : 'info')}${pill(`Exposure ${report.exposure}`, report.exposure > 55 ? 'risk' : report.exposure > 30 ? 'warn' : 'good')}${pill(`Wellbeing ${report.wellbeing}`, report.wellbeing >= 65 ? 'good' : report.wellbeing < 40 ? 'risk' : 'warn')}</div><p class="card-detail">A strong week balances income, safety, privacy, relationships, and recovery. Net income alone does not determine the quality of the career.</p></div></div>`;
        const actions = button('Start next week', 'dismiss-weekly', '', 'primary');
        this.openModal(modalMarkup({ eyebrow: `Week ${report.week}`, title: report.net >= 0 ? 'A profitable week' : 'A week to rebalance', text: 'Your operating report is ready.', body, actions }), { kind: 'weekly', wide: true, closable: false });
    }
    showPendingModals() {
        if (this.state.career?.ending && !this.state.career.endingSeen) {
            this.showCareerEnding();
            return;
        }
        if (this.state.pending?.encounter) {
            this.showEncounterModal();
            return;
        }
        if (this.state.pending?.event) {
            this.showEventModal();
            return;
        }
        if (this.state.pending?.weeklyReport) {
            this.showWeeklyReport();
        }
    }
    confirmCareer(id) {
        const path = this.sim.getCareerPaths().find((item) => item.id === id);
        if (!path || !path.ready || path.unavailable)
            return;
        const body = `<div class="card-stack"><div class="data-card"><div class="card-meta">${path.requirements.map((item) => pill(`✓ ${item.label}`, 'good')).join('')}</div><p class="card-detail">${(0, utils_js_4.escapeHtml)(path.epilogue)}</p></div></div><p class="section-intro" style="margin-top:14px">This records a campaign ending and score. The save remains playable afterward, but another ending cannot replace it.</p>`;
        const actions = `${button('Keep building', 'close-modal')}${button('Complete career path', 'confirm-career', id, 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Career decision', title: `${path.icon} ${path.name}`, text: 'Choose this as the defining outcome of the campaign?', body, actions }), { kind: 'career-confirm', wide: true });
    }
    finishCareer(id) {
        const result = this.sim.completeCareer(id);
        if (!result?.ok) {
            this.toast('Path unavailable', result?.reason || 'The requirements changed.', 'warning', '!');
            this.closeModal(true);
            return;
        }
        this.closeModal(true);
        this.showCareerEnding();
    }
    showCareerEnding() {
        const career = this.state.career;
        const definition = data_js_4.CAREER_ENDINGS[career?.ending];
        if (!definition)
            return;
        const wellbeing = Math.round(Object.values(this.state.profile.needs).reduce((sum, value) => sum + value, 0) / Object.keys(this.state.profile.needs).length);
        const body = `<div class="summary-grid"><div><span>Career score</span><strong>${career.score}</strong></div><div><span>Days</span><strong>${career.completedDay}</strong></div><div><span>Dates</span><strong>${this.state.metrics.completedBookings}</strong></div><div><span>Wellbeing</span><strong>${wellbeing}</strong></div></div><div class="section-heading" style="margin-top:18px"><h3>Your epilogue</h3></div><div class="data-card goal-card is-complete"><p class="card-detail" style="font-size:.84rem">${(0, utils_js_4.escapeHtml)(definition.epilogue)}</p><div class="card-meta">${pill(`Cash ${(0, utils_js_4.formatMoney)(this.state.finance.cash)}`, 'good')}${pill(`Reputation ${Math.round(this.state.profile.reputation)}`, 'info')}${pill(`Safety ${Math.round(this.state.profile.safety)}`, 'good')}${pill(`Exposure ${Math.round(this.state.profile.exposure)}`, this.state.profile.exposure <= 35 ? 'good' : 'warn')}</div></div><p class="section-intro" style="margin-top:14px">The campaign ending is permanent for this save. Continue in sandbox mode to keep managing the same character, city, clients, and relationships.</p>`;
        const actions = button('Continue in sandbox', 'continue-sandbox', '', 'primary');
        this.openModal(modalMarkup({ eyebrow: 'Campaign complete', title: `${definition.icon} ${definition.name}`, text: `Completed on day ${career.completedDay}.`, body, actions }), { kind: 'career-ending', wide: true, closable: false });
    }
    applyBusinessForm() {
        const rate = Number(document.querySelector('#business-rate')?.value);
        const deposit = Number(document.querySelector('#business-deposit')?.value);
        const screening = Number(document.querySelector('#business-screening')?.value);
        const privacy = Number(document.querySelector('#business-privacy')?.value);
        this.sim.setRate(rate);
        this.sim.setDeposit(deposit);
        this.sim.setOperations({ screening, privacy });
        this.toast('Operating plan saved', `${(0, utils_js_4.formatMoney)(this.state.business.rate)} base · ${this.state.business.depositPct}% deposit.`, 'success', '✓');
    }
    confirmFire(id) {
        const contact = getContact(id);
        if (!contact)
            return;
        const actions = `${button('Keep contact', 'close-modal')}${button('End contract', 'confirm-fire', id, 'danger')}`;
        this.openModal(modalMarkup({ eyebrow: 'Support team', title: `End ${contact.name}'s contract?`, text: `You will lose ${contact.role.toLowerCase()} benefits before the next week.`, body: `<p class="section-intro">There is no severance fee, but hiring again requires a new ${(0, utils_js_4.formatMoney)(contact.hireCost)} onboarding payment.</p>`, actions }), { kind: 'confirm', narrow: true });
    }
    confirmMove(id) {
        const region = data_js_4.REGIONS[id];
        if (!region)
            return;
        const actions = `${button('Stay here', 'close-modal')}${button(`Move · ${(0, utils_js_4.formatMoney)(region.moveCost)}`, 'confirm-move', id, 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Relocation', title: `Move to ${region.name}?`, text: region.description, body: `<div class="card-meta">${pill(region.legalModel, 'info')}${pill(`Demand ×${region.demand}`)}${pill(`Risk ×${region.risk}`, region.risk > 1 ? 'warn' : 'good')}</div><p class="section-intro" style="margin-top:14px">Active inquiries will be closed, reputation falls slightly, and a new local lead pool is generated. Confirmed bookings must be completed first.</p>`, actions }), { kind: 'confirm', narrow: true });
    }
    openCharacter() {
        const profile = this.state.profile;
        const body = `<div class="summary-grid"><div><span>Level</span><strong>${profile.level}</strong></div><div><span>Reputation</span><strong>${Math.round(profile.reputation)}</strong></div><div><span>Safety</span><strong>${Math.round(profile.safety)}</strong></div><div><span>Exposure</span><strong>${Math.round(profile.exposure)}</strong></div></div>
  <div class="section-heading" style="margin-top:18px"><h3>Professional profile</h3></div>
  <div class="card-meta">${pill(data_js_4.BACKGROUNDS[profile.background]?.name || (0, utils_js_4.titleCase)(profile.background), 'info')}${pill(data_js_4.PRESENTATIONS[profile.presentation]?.name || (0, utils_js_4.titleCase)(profile.presentation))}${pill(data_js_4.REGIONS[profile.region]?.name || (0, utils_js_4.titleCase)(profile.region))}${pill(profile.pronouns)}</div>
  <div class="section-heading" style="margin-top:18px"><h3>Skills</h3><small>${profile.skillPoints} points</small></div>
  <div class="card-stack">${Object.entries(data_js_4.SKILLS).map(([id, skill]) => `<div class="data-card"><div class="card-top"><div class="card-title"><h3>${(0, utils_js_4.escapeHtml)(skill.name)}</h3><p>${(0, utils_js_4.escapeHtml)(skill.description)}</p></div>${pill(`${profile.stats[id]}/10`, 'info')}</div><div class="card-actions">${button('Improve', 'upgrade-skill', id, '', profile.skillPoints < 1 || profile.stats[id] >= 10 ? 'disabled' : '')}</div></div>`).join('')}</div>`;
        this.openModal(modalMarkup({ eyebrow: 'Character', title: profile.name, text: `${profile.pronouns} · ${profile.healthStatus}`, body, actions: button('Close', 'close-modal', '', 'primary') }), { kind: 'character', wide: true });
    }
    openMenu() {
        this.setTimeMode(0);
        const renderMode = this.diagnostics.rendererLabel || 'three.js 3D';
        const body = `<div class="menu-grid"><div class="menu-actions">
    <button class="primary" data-action="close-modal"><span>Resume</span><span>Esc</span></button>
    <button data-action="save-now"><span>Save now</span><span>Local</span></button>
    <button data-action="export-save"><span>Export save</span><span>JSON</span></button>
    <button data-action="import-save-trigger"><span>Import save</span><span>JSON</span></button>
    <button data-action="open-settings"><span>Settings & accessibility</span><span>›</span></button>
    <button data-action="open-graphics"><span>Graphics & controls</span><span>F9</span></button>
    <button data-action="open-help"><span>Controls & game guide</span><span>›</span></button>
    <button data-action="new-game"><span>Start a new career</span><span>Reset</span></button>
    <input id="import-save-input" class="sr-only" type="file" accept="application/json,.json" />
  </div><div class="menu-note"><strong>${(0, utils_js_4.escapeHtml)(renderMode)}</strong><br />Day ${this.state.clock.day}, ${data_js_4.SLOTS[this.state.clock.slot]} · ${data_js_4.REGIONS[this.state.profile.region].name}<br /><br />The save is stored locally and auto-saved after actions. Export a copy before clearing browser data.<br /><br /><strong>Build ${(0, utils_js_4.escapeHtml)(this.state.version)}</strong><br />Renderer: ${(0, utils_js_4.escapeHtml)(this.diagnostics.backendLabel || '3D')}</div></div>`;
        this.openModal(modalMarkup({ eyebrow: 'Paused', title: 'Datecraft', text: 'A bright city. A complicated calendar.', body }), { kind: 'menu', wide: true });
        const input = document.querySelector('#import-save-input');
        input?.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            try {
                const state = await (0, persistence_js_1.importSave)(file);
                (0, persistence_js_1.saveGame)(state);
                this.toast('Save imported', 'Reloading the imported career.', 'success', '✓');
                setTimeout(() => location.reload(), 250);
            }
            catch (error) {
                this.toast('Import failed', error?.message || 'The file is not a valid Datecraft save.', 'danger', '!');
            }
        }, { once: true });
    }
    openSettings() {
        const s = this.state.settings;
        const toggleRow = (key, title, text) => `<div class="setting-row"><div class="setting-copy"><strong>${(0, utils_js_4.escapeHtml)(title)}</strong><span>${(0, utils_js_4.escapeHtml)(text)}</span></div><label class="toggle"><input id="setting-${key}" type="checkbox" ${s[key] ? 'checked' : ''} /><span></span></label></div>`;
        const body = `${toggleRow('sound', 'Interface sound', 'Short procedural feedback tones.')}${toggleRow('music', 'Ambient music', 'A light procedural loop; no external audio files.')}${toggleRow('reducedMotion', 'Reduced motion', 'Minimise interface transitions and animations.')}${toggleRow('highContrast', 'High contrast', 'Darken text and strengthen boundaries.')}${toggleRow('largeText', 'Larger text', 'Increase the interface scale.')}${toggleRow('reduceTransparency', 'Reduce transparency', 'Use solid panel backgrounds.')}${toggleRow('autoSave', 'Automatic saves', 'Store progress after each committed action.')}
  <div class="form-field" style="margin-top:16px"><label for="setting-contentTone">Narrative tone</label><select id="setting-contentTone"><option value="gentle"${s.contentTone === 'gentle' ? ' selected' : ''}>Gentle language</option><option value="balanced"${s.contentTone === 'balanced' ? ' selected' : ''}>Balanced</option><option value="direct"${s.contentTone === 'direct' ? ' selected' : ''}>Direct system language</option></select><small>All modes remain non-graphic. This preference is reserved for expanded narrative content.</small></div>`;
        const actions = `${button('Cancel', 'close-modal')}${button('Apply settings', 'apply-settings', '', 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Preferences', title: 'Settings & accessibility', text: 'Changes apply immediately after confirmation.', body, actions }), { kind: 'settings', wide: true });
    }
    applySettingsForm() {
        const keys = ['sound', 'music', 'reducedMotion', 'highContrast', 'largeText', 'reduceTransparency', 'autoSave'];
        const patch = Object.fromEntries(keys.map((key) => [key, Boolean(document.querySelector(`#setting-${key}`)?.checked)]));
        patch.contentTone = document.querySelector('#setting-contentTone')?.value || 'balanced';
        this.sim.setSettings(patch);
        this.closeModal(true);
        this.toast('Settings applied', 'Accessibility and audio preferences were updated.', 'success', '✓');
    }
    openHelp() {
        const body = `<div class="card-stack">
  <div class="data-card"><h3>Core loop</h3><p class="card-detail">Review leads → screen and negotiate → confirm a calendar slot → prepare needs and safety → resolve a three-stage date → reinvest, recover, and grow.</p></div>
  <div class="data-card"><h3>World controls</h3><p class="card-detail"><strong>Mouse/touch:</strong> click or tap a venue to go there; drag to pan; right-drag to turn the city; wheel or pinch to zoom. <strong>WASD/arrows:</strong> pan. <strong>Q/E:</strong> rotate the camera. <strong>Home:</strong> reset the camera. On touch screens the ⟲ ⌂ ⟳ buttons turn and reset the view.</p></div>
  <div class="data-card"><h3>Interface controls</h3><p class="card-detail"><strong>Space:</strong> play/pause automatic slot progression. <strong>P:</strong> phone. <strong>1–5:</strong> Rest, Market, Train, Connect, Admin. <strong>Esc:</strong> close or open the pause menu. <strong>F9:</strong> graphics and control settings.</p></div>
  <div class="data-card"><h3>Controller</h3><p class="card-detail"><strong>D-pad:</strong> move between buttons (the left stick too inside dialogs). <strong>A:</strong> press. <strong>B:</strong> back or close. <strong>LT/RT:</strong> previous/next venue. <strong>Left stick:</strong> pan. <strong>Right stick:</strong> turn and zoom, or scroll a panel. <strong>LB/RB:</strong> rotate. <strong>X:</strong> next slot. <strong>Y:</strong> phone. <strong>View:</strong> play/pause. <strong>Menu:</strong> pause menu.</p></div>
  <div class="data-card"><h3>Safety model</h3><p class="card-detail">Risk is never removed by one upgrade. Screening, venue choice, business model, hired support, personal wellbeing, privacy practices, and in-date choices combine. Safe exit is a valid successful decision.</p></div>
  <div class="data-card"><h3>Fictional setting</h3><p class="card-detail">Regions and legal regimes are invented for gameplay. This game is not legal, health, financial, or personal safety advice.</p></div>
</div>`;
        this.openModal(modalMarkup({ eyebrow: 'Guide', title: 'How to play', text: 'Most systems are readable from the phone without leaving the isometric city.', body, actions: button('Close guide', 'close-modal', '', 'primary') }), { kind: 'help', wide: true });
    }
    saveNow() {
        const ok = (0, persistence_js_1.saveGame)(this.state);
        this.toast(ok ? 'Game saved' : 'Save failed', ok ? 'Your career is stored in this browser.' : 'Browser storage is unavailable. Export a save instead.', ok ? 'success' : 'danger', ok ? '✓' : '!');
    }
    downloadSave() {
        const blob = (0, persistence_js_1.exportSave)(this.state);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `datecraft-day-${this.state.clock.day}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast('Save exported', 'A portable JSON save was created.', 'success', '✓');
    }
    confirmNewGame() {
        const actions = `${button('Keep playing', 'close-modal')}${button('Erase and restart', 'confirm-new-game', '', 'danger')}`;
        this.openModal(modalMarkup({ eyebrow: 'New career', title: 'Erase the local save?', text: 'This removes the current browser save and returns to character creation.', body: '<p class="section-intro">Export the current career first if you may want to restore it later.</p>', actions }), { kind: 'confirm', narrow: true });
    }
    maybeShowTutorial() {
        if (this.tutorialShown || !this.state.meta.tutorial || this.state.meta.tutorialStep !== 0 || this.state.pending?.event || this.state.pending?.encounter)
            return;
        this.tutorialShown = true;
        const body = `<div class="card-stack"><div class="data-card"><h3>1. Qualify the inquiry</h3><p class="card-detail">Screening reveals assessed risk and may detect red flags. It costs money, but improves decisions.</p></div><div class="data-card"><h3>2. Protect the calendar</h3><p class="card-detail">Every activity uses one slot. Prepare before a booking reaches the current slot.</p></div><div class="data-card"><h3>3. Build sustainability</h3><p class="card-detail">Income, reputation, safety, privacy, needs, and relationships are all long-term resources.</p></div></div>`;
        const actions = `${button('Skip guidance', 'tutorial-skip')}${button('Start guided opening', 'tutorial-start', '', 'primary')}`;
        this.openModal(modalMarkup({ eyebrow: 'Orientation', title: 'Run the whole life, not only the bookings', text: 'Datecraft is a management game with a navigable isometric city and decision-based dates.', body, actions }), { kind: 'tutorial', wide: true, closable: false });
    }
    setTimeMode(speed) {
        clearInterval(this.autoTimer);
        this.autoTimer = null;
        this.timeSpeed = speed;
        this.state.clock.paused = speed === 0;
        this.state.clock.speed = speed;
        if (speed > 0) {
            const duration = speed === 2 ? 6500 : 18000;
            this.autoTimer = setInterval(() => this.timeTick(), duration);
        }
        this.updateTimeButtons();
    }
    timeTick() {
        if (document.hidden || this.externalPause || !this.nodes.modal.classList.contains('is-hidden'))
            return;
        if (this.state.pending?.event || this.state.pending?.encounter || this.sim.getCurrentBooking()) {
            this.setTimeMode(0);
            this.toast('Time paused', this.sim.getCurrentBooking() ? 'A booking is ready in the current slot.' : 'A decision needs your attention.', 'warning', 'Ⅱ');
            this.showPendingModals();
            return;
        }
        const result = this.sim.advanceSlot();
        if (!result.ok)
            this.setTimeMode(0);
    }
    updateTimeButtons() {
        document.querySelector('[data-action="time-pause"]')?.classList.toggle('is-active', this.timeSpeed === 0);
        document.querySelector('[data-action="time-play"]')?.classList.toggle('is-active', this.timeSpeed === 1);
        document.querySelector('[data-action="time-fast"]')?.classList.toggle('is-active', this.timeSpeed === 2);
    }
    openModal(content, { kind = 'generic', wide = false, narrow = false, closable = true } = {}) {
        this.previousFocus = document.activeElement;
        this.nodes.modal.classList.remove('is-hidden');
        this.nodes.modal.innerHTML = `<section class="modal${wide ? ' wide' : ''}${narrow ? ' narrow' : ''}" role="dialog" aria-modal="true" data-kind="${(0, utils_js_4.escapeHtml)(kind)}" data-closable="${closable}">${closable ? '<button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>' : ''}${content}</section>`;
        requestAnimationFrame(() => this.nodes.modal.querySelector('button:not([disabled]), input, select, [tabindex="0"]')?.focus());
    }
    closeModal(force = false) {
        const modal = this.nodes.modal.querySelector('.modal');
        if (!modal)
            return;
        if (!force && modal.dataset.closable !== 'true') {
            this.toast('Decision required', 'Resolve the current situation before closing.', 'warning', '!');
            return;
        }
        this.nodes.modal.classList.add('is-hidden');
        this.nodes.modal.innerHTML = '';
        if (this.previousFocus instanceof HTMLElement)
            this.previousFocus.focus({ preventScroll: true });
        this.previousFocus = null;
        queueMicrotask(() => this.showPendingModals());
    }
    currentModalKind() {
        return this.nodes.modal.querySelector('.modal')?.dataset.kind || null;
    }
    toast(title, message, tone = 'success', icon = '✓') {
        const node = document.createElement('div');
        node.className = 'toast';
        node.dataset.tone = tone;
        node.innerHTML = `<span class="toast-icon" aria-hidden="true">${(0, utils_js_4.escapeHtml)(icon)}</span><span class="toast-copy"><strong>${(0, utils_js_4.escapeHtml)(title)}</strong><span>${(0, utils_js_4.escapeHtml)(message)}</span></span><button aria-label="Dismiss notification">×</button>`;
        node.querySelector('button').addEventListener('click', () => node.remove());
        this.nodes.toast.prepend(node);
        while (this.nodes.toast.children.length > 4)
            this.nodes.toast.lastElementChild.remove();
        setTimeout(() => node.remove(), 5200);
    }
}
exports.GameUI = GameUI;
export { runOnboarding, GameUI };
