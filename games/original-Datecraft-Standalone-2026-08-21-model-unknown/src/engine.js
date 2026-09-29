// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
import * as data_js_1 from './data.js';
import * as utils_js_1 from './utils.js';
const exports = {};
exports.validateStateInvariants = validateStateInvariants;
const DIFFICULTY = {
    gentle: { risk: 0.72, expenses: 0.82, decay: 0.78, demand: 1.18, incident: 0.55 },
    balanced: { risk: 1, expenses: 1, decay: 1, demand: 1, incident: 1 },
    grounded: { risk: 1.23, expenses: 1.16, decay: 1.14, demand: 0.91, incident: 1.3 },
};
const NEED_DECAY = { energy: -7, mood: -3, hygiene: -5, health: -1.5, social: -3 };
const ARCHETYPE_WEIGHTS = [
    { value: 'respectful', weight: 30 }, { value: 'nervous', weight: 20 },
    { value: 'executive', weight: 16 }, { value: 'tourist', weight: 16 },
    { value: 'charmer', weight: 12 }, { value: 'demanding', weight: 6 },
];
function difficultyFor(state) {
    return DIFFICULTY[state.meta.difficulty] || DIFFICULTY.balanced;
}
function goalDefinition(id) {
    return data_js_1.GOAL_DEFINITIONS.find((goal) => goal.id === id);
}
function modelRiskReduction(state) {
    const model = data_js_1.BUSINESS_MODELS[state.business.model] || data_js_1.BUSINESS_MODELS.independent;
    const contactReduction = data_js_1.CONTACTS.filter((contact) => state.business.hiredContacts.includes(contact.id)).reduce((sum, contact) => sum + contact.riskReduction, 0);
    return model.riskReduction + contactReduction;
}
function contactLeadBonus(state) {
    return data_js_1.CONTACTS.filter((contact) => state.business.hiredContacts.includes(contact.id)).reduce((sum, contact) => sum + contact.leadBonus, 0);
}
function contactExposure(state) {
    return data_js_1.CONTACTS.filter((contact) => state.business.hiredContacts.includes(contact.id)).reduce((sum, contact) => sum + contact.exposure, 0);
}
function findPackage(id) {
    return data_js_1.DATE_PACKAGES.find((item) => item.id === id) || data_js_1.DATE_PACKAGES[0];
}
function findLead(state, leadId) {
    return state.leads.find((lead) => lead.id === leadId);
}
function findBooking(state, bookingId) {
    return state.bookings.find((booking) => booking.id === bookingId);
}
function bookingAt(state, day, slot) {
    return state.bookings.find((booking) => booking.day === day && booking.slot === slot && ['confirmed', 'in_progress'].includes(booking.status));
}
function journal(state, type, title, text) {
    state.journal.unshift({ id: (0, utils_js_1.uniqueId)(state, 'log'), day: state.clock.day, slot: state.clock.slot, type, title, text });
    state.journal = state.journal.slice(0, 120);
}
function addLedger(state, label, amount, category = 'general') {
    const value = (0, utils_js_1.roundMoney)(amount);
    state.finance.cash = (0, utils_js_1.roundMoney)(state.finance.cash + value);
    if (value >= 0) {
        state.finance.weeklyRevenue += value;
        state.finance.totalRevenue += value;
    }
    else {
        state.finance.weeklyExpenses += Math.abs(value);
        state.finance.totalExpenses += Math.abs(value);
    }
    state.finance.ledger.unshift({ id: (0, utils_js_1.uniqueId)(state, 'tx'), day: state.clock.day, slot: state.clock.slot, label, amount: value, category });
    state.finance.ledger = state.finance.ledger.slice(0, 260);
    return value;
}
function metricValue(state, metric) {
    if (metric === 'reputation')
        return state.profile.reputation;
    if (metric === 'cash')
        return state.finance.cash;
    if (metric === 'contacts')
        return state.business.hiredContacts.length;
    if (metric === 'day')
        return state.clock.day;
    return state.metrics[metric] || 0;
}
function careerValue(state, key) {
    const partner = state.relationships.partner;
    const values = {
        day: state.clock.day,
        cash: state.finance.cash,
        debtMax: state.finance.debt,
        safeBookings: state.metrics.safeBookings,
        safety: state.profile.safety,
        exposureMax: state.profile.exposure,
        independentModel: state.business.model === 'independent' ? 1 : 0,
        reputation: state.profile.reputation,
        contacts: state.business.hiredContacts.length,
        completedBookings: state.metrics.completedBookings,
        peerNetwork: state.relationships.peerNetwork,
        positiveReviews: state.metrics.positiveReviews,
        partnerTrust: partner?.trust ?? 0,
        partnerKnowledge: partner?.knowledge === 'supportive' ? 1 : 0,
    };
    return Number(values[key] ?? 0);
}
function careerPathStatus(state, definition) {
    const unavailable = Boolean(definition.requiresPartner && !state.relationships.partner);
    const requirements = definition.requirements.map((requirement) => {
        const current = careerValue(state, requirement.key);
        const ready = requirement.mode === 'max' ? current <= requirement.target : current >= requirement.target;
        return { ...requirement, current, ready };
    });
    return { ...definition, unavailable, requirements, ready: !unavailable && requirements.every((item) => item.ready) };
}
function careerScore(state) {
    const partnerTrust = state.relationships.partner?.trust || 0;
    return Math.max(0, Math.round(state.finance.cash / 20 + state.profile.reputation * 4 + state.profile.safety * 3 - state.profile.exposure * 2 +
        state.metrics.completedBookings * 45 + state.relationships.peerNetwork * 1.5 + partnerTrust));
}
function updateGoals(state) {
    const newlyCompleted = [];
    for (const goal of state.goals) {
        const definition = goalDefinition(goal.id);
        if (!definition)
            continue;
        goal.progress = Math.max(0, metricValue(state, definition.metric));
        if (!goal.complete && goal.progress >= definition.target) {
            goal.complete = true;
            newlyCompleted.push({ ...definition });
        }
    }
    return newlyCompleted;
}
function processLevel(state) {
    const gained = [];
    while (state.profile.xp >= state.profile.level * 100) {
        state.profile.xp -= state.profile.level * 100;
        state.profile.level += 1;
        state.profile.skillPoints += 1;
        gained.push(state.profile.level);
    }
    return gained;
}
function normalizeState(state) {
    const needs = state.profile.needs;
    for (const key of Object.keys(needs))
        needs[key] = (0, utils_js_1.clamp)(needs[key]);
    state.profile.safety = (0, utils_js_1.clamp)(state.profile.safety);
    state.profile.exposure = (0, utils_js_1.clamp)(state.profile.exposure);
    state.profile.reputation = (0, utils_js_1.clamp)(state.profile.reputation);
    state.profile.stats = Object.fromEntries(Object.entries(state.profile.stats).map(([key, value]) => [key, (0, utils_js_1.clamp)(Math.round(value), 1, 10)]));
    state.business.rate = (0, utils_js_1.clamp)((0, utils_js_1.roundMoney)(state.business.rate), 80, 1500);
    state.business.depositPct = (0, utils_js_1.clamp)(Math.round(state.business.depositPct), 0, 80);
    state.business.screening = (0, utils_js_1.clamp)(Math.round(state.business.screening), 1, 5);
    state.business.privacy = (0, utils_js_1.clamp)(Math.round(state.business.privacy), 1, 5);
    state.clock.day = Math.max(1, Math.round(state.clock.day));
    state.clock.slot = (0, utils_js_1.clamp)(Math.round(state.clock.slot), 0, 3);
    state.finance.cash = (0, utils_js_1.roundMoney)(state.finance.cash);
    state.relationships.friend.trust = (0, utils_js_1.clamp)(state.relationships.friend.trust);
    state.relationships.family.closeness = (0, utils_js_1.clamp)(state.relationships.family.closeness);
    state.relationships.peerNetwork = (0, utils_js_1.clamp)(state.relationships.peerNetwork);
    if (state.relationships.partner) {
        state.relationships.partner.trust = (0, utils_js_1.clamp)(state.relationships.partner.trust);
        state.relationships.partner.discoveryRisk = (0, utils_js_1.clamp)(state.relationships.partner.discoveryRisk ?? 0);
        if (!['unaware', 'partial', 'supportive'].includes(state.relationships.partner.knowledge))
            state.relationships.partner.knowledge = 'partial';
    }
    state.career || (state.career = { ending: null, completedDay: null, score: null, endingSeen: false });
    if (state.career.ending && !data_js_1.CAREER_ENDINGS[state.career.ending])
        state.career.ending = null;
    state.meta.updatedAt = new Date().toISOString();
}
function applyEffects(state, effects = {}) {
    for (const [key, amount] of Object.entries(effects)) {
        if (key in state.profile.needs)
            (0, utils_js_1.boundedAdd)(state.profile.needs, key, amount);
    }
}
function getRiskLabel(score) {
    if (score < 28)
        return 'Low';
    if (score < 56)
        return 'Guarded';
    return 'High';
}
function computeRiskScore(state) {
    const region = data_js_1.REGIONS[state.profile.region] || data_js_1.REGIONS.brightwater;
    const lowNeeds = 100 - (0, utils_js_1.average)([state.profile.needs.energy, state.profile.needs.mood, state.profile.needs.health]);
    const openRisk = state.leads.filter((lead) => lead.status === 'new').reduce((sum, lead) => sum + Math.max(0, lead.risk - 45) * 0.06, 0);
    const score = state.profile.exposure * 0.45 + (100 - state.profile.safety) * 0.3 + lowNeeds * 0.16 + openRisk + (region.risk - 1) * 18 - modelRiskReduction(state) * 0.35;
    return (0, utils_js_1.clamp)(Math.round(score));
}
function preferredSlot(state, datePackage) {
    const indexes = datePackage.slots.map((slot) => data_js_1.SLOTS.indexOf(slot)).filter((index) => index >= 0);
    return (0, utils_js_1.pick)(state, indexes.length ? indexes : [2, 3]);
}
function findAvailableSlot(state, requestedDay, requestedSlot) {
    let cursor = (0, utils_js_1.absoluteSlot)(requestedDay, requestedSlot);
    const now = (0, utils_js_1.absoluteSlot)(state.clock.day, state.clock.slot);
    cursor = Math.max(cursor, now + 1);
    for (let attempts = 0; attempts < 28; attempts += 1) {
        const candidate = (0, utils_js_1.fromAbsoluteSlot)(cursor + attempts);
        if (!bookingAt(state, candidate.day, candidate.slot))
            return candidate;
    }
    return null;
}
function leadExpiryReached(state, lead) {
    return (0, utils_js_1.absoluteSlot)(state.clock.day, state.clock.slot) >= lead.expiresAt;
}
function calculateScreenedRisk(state, lead) {
    const skill = state.profile.stats.safety * 3 + state.profile.stats.intuition * 2;
    const tools = state.business.screening * 6;
    const model = modelRiskReduction(state) * 0.35;
    return (0, utils_js_1.clamp)(Math.round(lead.risk - skill - tools - model + 25), 2, 95);
}
function makeLead(state, source = 'organic') {
    const region = data_js_1.REGIONS[state.profile.region] || data_js_1.REGIONS.brightwater;
    const brand = data_js_1.BRAND_FOCUSES[state.business.brand] || data_js_1.BRAND_FOCUSES.warm;
    const model = data_js_1.BUSINESS_MODELS[state.business.model] || data_js_1.BUSINESS_MODELS.independent;
    const archetypeId = (0, utils_js_1.weightedPick)(state, ARCHETYPE_WEIGHTS);
    const archetype = data_js_1.CLIENT_ARCHETYPES[archetypeId];
    const datePackage = (0, utils_js_1.pick)(state, data_js_1.DATE_PACKAGES);
    const reputationPremium = 0.78 + state.profile.reputation / 180;
    const sourcePremium = source === 'referral' ? 1.12 : source === 'marketing' ? 1.04 : 1;
    const variance = 0.82 + (0, utils_js_1.randomFloat)(state) * 0.45;
    const offered = (0, utils_js_1.roundMoney)(state.business.rate * region.price * archetype.budget * reputationPremium * variance * sourcePremium);
    const baseRisk = (archetype.risk + datePackage.baseRisk + (0, utils_js_1.randomInt)(state, -7, 10)) * region.risk * difficultyFor(state).risk;
    const risk = (0, utils_js_1.clamp)(Math.round(baseRisk), 4, 88);
    const desiredDay = state.clock.day + (0, utils_js_1.randomInt)(state, state.clock.slot >= 2 ? 1 : 0, 3);
    const desiredSlot = preferredSlot(state, datePackage);
    const flags = [];
    if ((0, utils_js_1.chance)(state, (0, utils_js_1.clamp)((risk - 25) / 120, 0, .5)))
        flags.push((0, utils_js_1.pick)(state, data_js_1.RED_FLAGS));
    if (risk > 58 && (0, utils_js_1.chance)(state, .34)) {
        const second = (0, utils_js_1.pick)(state, data_js_1.RED_FLAGS.filter((flag) => !flags.includes(flag)));
        if (second)
            flags.push(second);
    }
    const preferenceCount = (0, utils_js_1.randomInt)(state, 2, 3);
    const preferences = [];
    while (preferences.length < preferenceCount) {
        const preference = (0, utils_js_1.pick)(state, data_js_1.PREFERENCES);
        if (!preferences.includes(preference))
            preferences.push(preference);
    }
    const verification = (0, utils_js_1.clamp)(Math.round(archetype.verification + (0, utils_js_1.randomInt)(state, -18, 16)), 8, 96);
    const alias = (0, utils_js_1.pick)(state, data_js_1.CLIENT_NAMES);
    const suffix = (0, utils_js_1.randomInt)(state, 10, 99);
    const id = (0, utils_js_1.uniqueId)(state, 'lead');
    return {
        id, alias: `${alias} ${suffix}`, archetype: archetypeId,
        packageId: datePackage.id, offered, finalRate: offered,
        desiredDay, desiredSlot, requestedLocation: (0, utils_js_1.pick)(state, ['Sol Hotel', 'Juniper Café', 'Sunset Pier', 'Private venue', 'Client hotel']),
        risk, screenedRisk: null, verification, screened: false,
        source, status: 'new', flags, discoveredFlags: [], preferences,
        message: `${archetype.description} Interested in ${datePackage.name.toLowerCase()} and values ${preferences[0]}.`,
        expiresAt: (0, utils_js_1.absoluteSlot)(state.clock.day, state.clock.slot) + (0, utils_js_1.randomInt)(state, 4, 10),
        negotiationAttempts: 0,
    };
}
const EVENT_BUILDERS = [
    (state) => ({
        id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'peer_referral', title: 'Peer referral',
        text: 'A trusted peer has a screened inquiry that does not fit their schedule.',
        choices: [
            { id: 'accept', label: 'Accept the introduction', description: 'Gain a stronger lead; small exposure increase.' },
            { id: 'pass', label: 'Pass it onward', description: 'Strengthen the peer network instead.' },
        ],
    }),
    (state) => ({
        id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'profile_report', title: 'Platform review',
        text: 'An automated system has limited the reach of one profile pending a routine review.',
        choices: [
            { id: 'appeal', label: 'Prepare a calm appeal', description: 'Uses admin skill; may reduce exposure.' },
            { id: 'switch', label: 'Shift to referrals', description: 'Lower volume, safer visibility.' },
        ],
    }),
    (state) => ({
        id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'family_invite', title: 'A personal invitation',
        text: 'Family asks for time this week. Protecting your personal life may compete with prime booking hours.',
        choices: [
            { id: 'make_time', label: 'Make time', description: 'Restore social wellbeing and closeness.' },
            { id: 'decline', label: 'Decline politely', description: 'Keep the calendar open; accept a mood cost.' },
        ],
    }),
    (state) => ({
        id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'lease_inspection', title: 'Routine building inspection',
        text: 'Your landlord announces a standard inspection. The home office needs a privacy pass.',
        choices: [
            { id: 'prepare', label: 'Pay for secure storage', description: 'Costs money but protects privacy.' },
            { id: 'improvise', label: 'Handle it yourself', description: 'No cost; outcome depends on privacy skill.' },
        ],
    }),
    (state) => ({
        id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'city_festival', title: 'Festival weekend',
        text: 'Visitors fill the waterfront and demand rises for local guides and event companions.',
        choices: [
            { id: 'promote', label: 'Run a targeted listing', description: 'Spend now for several festival leads.' },
            { id: 'stay_low', label: 'Keep a low profile', description: 'Gain mood and reduce exposure.' },
        ],
    }),
    (state) => {
        const partner = state.relationships.partner;
        const hidden = partner?.knowledge === 'unaware' || partner?.knowledge === 'partial';
        return {
            id: (0, utils_js_1.uniqueId)(state, 'event'), type: 'partner_tension', title: hidden ? 'Two calendars collide' : 'Time together is slipping',
            text: hidden
                ? `${partner.name} notices another unexplained schedule change. The work calendar and personal calendar are becoming harder to separate.`
                : `${partner.name} supports the career, but repeated late bookings have left too little protected time together.`,
            choices: [
                { id: 'honest', label: hidden ? 'Share more of the truth' : 'Talk openly about the strain', description: 'Reduce secrecy pressure; trust can change sharply.' },
                { id: 'quality_time', label: 'Protect time together', description: 'Restore trust and social wellbeing without changing disclosure.' },
                { id: 'cover', label: hidden ? 'Maintain the cover story' : 'Deflect and keep working', description: 'Preserve the immediate calendar but increase relationship pressure.' },
            ],
        };
    },
];
class GameSimulation {
    constructor(state) {
        this.state = state;
        this.listeners = new Set();
        normalizeState(this.state);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    snapshot() { return (0, utils_js_1.deepClone)(this.state); }
    _commit(type, payload = {}) {
        this.state.meta.actions += 1;
        normalizeState(this.state);
        const goals = updateGoals(this.state);
        const levels = processLevel(this.state);
        const event = { type, payload, goals, levels, state: this.state };
        for (const listener of this.listeners)
            listener(event);
        return event;
    }
    initialize() {
        if (!this.state.leads.length && !this.state.bookings.length)
            this.generateLeads(4, 'launch', false);
        updateGoals(this.state);
        normalizeState(this.state);
        return this.state;
    }
    getCurrentBooking() { return bookingAt(this.state, this.state.clock.day, this.state.clock.slot); }
    getRiskSummary() {
        const score = computeRiskScore(this.state);
        return { score, label: getRiskLabel(score), level: score < 28 ? 'low' : score < 56 ? 'guarded' : 'high' };
    }
    generateLeads(count = 1, source = 'organic', commit = true) {
        const difficulty = difficultyFor(this.state);
        const region = data_js_1.REGIONS[this.state.profile.region] || data_js_1.REGIONS.brightwater;
        const brand = data_js_1.BRAND_FOCUSES[this.state.business.brand] || data_js_1.BRAND_FOCUSES.warm;
        const model = data_js_1.BUSINESS_MODELS[this.state.business.model] || data_js_1.BUSINESS_MODELS.independent;
        const multiplier = region.demand * brand.demand * difficulty.demand * (1 + model.leadBonus + contactLeadBonus(this.state));
        const actual = Math.max(1, Math.round(count * multiplier));
        const created = [];
        for (let index = 0; index < actual; index += 1) {
            const lead = makeLead(this.state, source);
            this.state.leads.unshift(lead);
            created.push(lead);
        }
        this.state.leads = this.state.leads.slice(0, 28);
        if (commit)
            this._commit('leads:generated', { count: created.length, source });
        return created;
    }
    screenLead(leadId) {
        const lead = findLead(this.state, leadId);
        if (!lead || lead.status !== 'new')
            return { ok: false, reason: 'Lead is no longer available.' };
        if (lead.screened)
            return { ok: false, reason: 'Lead has already been screened.' };
        const cost = (0, utils_js_1.roundMoney)(6 + this.state.business.screening * 3);
        if (this.state.finance.cash < cost)
            return { ok: false, reason: 'Not enough cash for screening tools.' };
        addLedger(this.state, 'Identity and reference screening', -cost, 'safety');
        lead.screened = true;
        lead.screenedRisk = calculateScreenedRisk(this.state, lead);
        const detection = (0, utils_js_1.clamp)(.34 + this.state.profile.stats.intuition * .07 + this.state.profile.stats.safety * .05 + this.state.business.screening * .06, 0, .96);
        lead.discoveredFlags = lead.flags.filter(() => (0, utils_js_1.chance)(this.state, detection));
        lead.verification = (0, utils_js_1.clamp)(lead.verification + this.state.business.screening * 5 + (0, utils_js_1.randomInt)(this.state, 2, 12));
        this.state.metrics.screenings += 1;
        this.state.profile.xp += 8;
        (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', 1);
        journal(this.state, 'safety', 'Lead screened', `${lead.alias}: verification ${Math.round(lead.verification)} and assessed risk ${lead.screenedRisk}.`);
        this._commit('lead:screened', { leadId, cost });
        return { ok: true, lead, cost };
    }
    negotiateLead(leadId, targetRate) {
        const lead = findLead(this.state, leadId);
        if (!lead || lead.status !== 'new')
            return { ok: false, reason: 'Lead is no longer available.' };
        if (leadExpiryReached(this.state, lead))
            return { ok: false, reason: 'The inquiry has expired.' };
        const target = (0, utils_js_1.clamp)((0, utils_js_1.roundMoney)(targetRate), 80, 1500);
        lead.negotiationAttempts += 1;
        const gap = (target - lead.offered) / Math.max(lead.offered, 1);
        const archetype = data_js_1.CLIENT_ARCHETYPES[lead.archetype];
        const skill = this.state.profile.stats.business * .055 + this.state.profile.stats.charisma * .025 + this.state.profile.reputation * .002;
        const screeningTrust = lead.screened ? .07 : 0;
        const patience = archetype.patience * .12;
        const probability = (0, utils_js_1.clamp)(.66 + skill + screeningTrust + patience - Math.max(0, gap) * 1.35 - lead.negotiationAttempts * .08, .08, .94);
        if ((0, utils_js_1.chance)(this.state, probability)) {
            lead.finalRate = target;
            lead.offered = target;
            this.state.metrics.negotiationsWon += 1;
            this.state.profile.xp += 10;
            journal(this.state, 'business', 'Rate agreed', `${lead.alias} agreed to ${target}.`);
            this._commit('lead:negotiated', { leadId, target, success: true });
            return { ok: true, success: true, rate: target, probability };
        }
        const walks = (0, utils_js_1.chance)(this.state, (0, utils_js_1.clamp)(.16 + Math.max(0, gap) * .65 + lead.negotiationAttempts * .09, .1, .76));
        this.state.metrics.negotiationsLost += 1;
        if (walks) {
            lead.status = 'lost';
            journal(this.state, 'business', 'Negotiation ended', `${lead.alias} declined the proposed rate.`);
        }
        else {
            lead.offered = (0, utils_js_1.roundMoney)((lead.offered + target) / 2 * .94);
            lead.finalRate = lead.offered;
        }
        this._commit('lead:negotiated', { leadId, target, success: false, walks });
        return { ok: true, success: false, walks, counter: lead.offered, probability };
    }
    acceptLead(leadId) {
        const lead = findLead(this.state, leadId);
        if (!lead || lead.status !== 'new')
            return { ok: false, reason: 'Lead is no longer available.' };
        if (leadExpiryReached(this.state, lead))
            return { ok: false, reason: 'The inquiry has expired.' };
        if (!lead.screened && this.state.meta.difficulty === 'grounded')
            return { ok: false, reason: 'Grounded mode requires screening before confirmation.' };
        if (lead.discoveredFlags.includes('avoids deposit'))
            return { ok: false, reason: 'This lead will not provide the required deposit.' };
        const slot = findAvailableSlot(this.state, lead.desiredDay, lead.desiredSlot);
        if (!slot)
            return { ok: false, reason: 'No available slot in the next week.' };
        const rate = lead.finalRate || lead.offered;
        const deposit = (0, utils_js_1.roundMoney)(rate * this.state.business.depositPct / 100);
        const booking = {
            id: (0, utils_js_1.uniqueId)(this.state, 'booking'), leadId: lead.id, alias: lead.alias,
            packageId: lead.packageId, day: slot.day, slot: slot.slot,
            rate, deposit, status: 'confirmed', location: lead.requestedLocation,
            createdDay: this.state.clock.day, risk: lead.screenedRisk ?? lead.risk,
            result: null,
        };
        lead.status = 'accepted';
        this.state.bookings.push(booking);
        if (deposit > 0)
            addLedger(this.state, `Deposit · ${lead.alias}`, deposit, 'booking');
        this.state.profile.xp += 8;
        journal(this.state, 'booking', 'Booking confirmed', `${lead.alias} booked ${findPackage(lead.packageId).name} for day ${slot.day}, ${data_js_1.SLOTS[slot.slot]}.`);
        this._commit('booking:accepted', { leadId, bookingId: booking.id, deposit });
        return { ok: true, booking };
    }
    declineLead(leadId, blacklist = false) {
        const lead = findLead(this.state, leadId);
        if (!lead || lead.status !== 'new')
            return { ok: false, reason: 'Lead is no longer available.' };
        lead.status = blacklist ? 'blacklisted' : 'declined';
        if (blacklist)
            this.state.blacklist.push({ alias: lead.alias, reason: lead.discoveredFlags.join(', ') || 'Player decision', day: this.state.clock.day });
        this.state.metrics.declinedLeads += 1;
        this.state.profile.xp += blacklist && lead.risk > 50 ? 5 : 1;
        if (blacklist && lead.risk > 45)
            (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', 2);
        journal(this.state, 'lead', blacklist ? 'Lead blacklisted' : 'Lead declined', `${lead.alias} was removed from active inquiries.`);
        this._commit('lead:declined', { leadId, blacklist });
        return { ok: true };
    }
    performActivity(activityId) {
        if (this.state.pending.event || this.state.pending.encounter)
            return { ok: false, reason: 'Resolve the current situation first.' };
        const booking = this.getCurrentBooking();
        if (booking)
            return { ok: false, requiresEncounter: true, booking };
        const activity = data_js_1.ACTIVITIES[activityId];
        if (!activity)
            return { ok: false, reason: 'Unknown activity.' };
        if (this.state.finance.cash < activity.cost)
            return { ok: false, reason: 'Not enough cash.' };
        if (activity.cost)
            addLedger(this.state, activity.name, -activity.cost, 'activity');
        applyEffects(this.state, activity.effects);
        if (activity.exposure)
            (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', activity.exposure);
        if (activity.safety)
            (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', activity.safety);
        this.state.profile.xp += activity.xp || 0;
        this.state.metrics.activities += 1;
        if (activityId === 'training') {
            const lowest = Object.entries(this.state.profile.stats).sort((a, b) => a[1] - b[1])[0]?.[0];
            if (lowest && (0, utils_js_1.chance)(this.state, .24))
                this.state.profile.stats[lowest] = (0, utils_js_1.clamp)(this.state.profile.stats[lowest] + 1, 1, 10);
        }
        if (activity.leads)
            this.generateLeads(activity.leads, 'marketing', false);
        journal(this.state, 'activity', activity.name, activity.description);
        const time = this._consumeCurrentSlot(activityId);
        this._commit('activity:performed', { activityId, time });
        return { ok: true, activity, time };
    }
    performVenueAction(venueId, actionId) {
        const venue = data_js_1.VENUES.find((item) => item.id === venueId);
        if (!venue || !venue.actions.includes(actionId))
            return { ok: false, reason: 'That service is not available here.' };
        if (data_js_1.ACTIVITIES[actionId])
            return this.performActivity(actionId);
        if (this.getCurrentBooking())
            return { ok: false, requiresEncounter: true, booking: this.getCurrentBooking() };
        const custom = {
            photoshoot: { cost: 180, xp: 18, exposure: 6, text: 'A polished photo set raises premium conversion.', effects: { mood: 6, energy: -8 }, leads: 3 },
            network: { cost: 20, xp: 12, exposure: -1, text: 'You exchange safety notes and referrals with peers.', effects: { social: 16, mood: 8 }, leads: 1 },
            checkup: { cost: 90, xp: 10, exposure: -1, text: 'A confidential routine checkup updates your health plan.', effects: { health: 18, mood: 4 }, safety: 4 },
            counselling: { cost: 70, xp: 8, exposure: 0, text: 'A confidential session supports resilience and recovery.', effects: { mood: 22, social: 8, energy: 4 }, safety: 2 },
            scout: { cost: 25, xp: 8, exposure: 1, text: 'You learn venue layouts, exits, staff patterns, and demand.', effects: { energy: -5, mood: 4 }, safety: 5, leads: 2 },
        }[actionId];
        if (actionId === 'business' || actionId === 'hire' || actionId === 'booking')
            return { ok: true, uiAction: actionId };
        if (!custom)
            return { ok: false, reason: 'Unknown venue action.' };
        if (this.state.finance.cash < custom.cost)
            return { ok: false, reason: 'Not enough cash.' };
        if (custom.cost)
            addLedger(this.state, `${venue.name} · ${actionId}`, -custom.cost, 'service');
        applyEffects(this.state, custom.effects);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', custom.exposure || 0);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', custom.safety || 0);
        this.state.profile.xp += custom.xp;
        if (custom.leads)
            this.generateLeads(custom.leads, actionId === 'network' ? 'referral' : 'marketing', false);
        if (actionId === 'checkup') {
            this.state.profile.lastCheckupDay = this.state.clock.day;
            this.state.profile.healthStatus = 'up to date';
        }
        if (actionId === 'photoshoot')
            this.state.business.marketingLevel = (0, utils_js_1.clamp)(this.state.business.marketingLevel + 1, 1, 5);
        if (actionId === 'network')
            this.state.relationships.peerNetwork = (0, utils_js_1.clamp)(this.state.relationships.peerNetwork + 12);
        journal(this.state, 'venue', venue.name, custom.text);
        const time = this._consumeCurrentSlot(actionId);
        this._commit('venue:action', { venueId, actionId, time });
        return { ok: true, action: custom, time };
    }
    advanceSlot() {
        if (this.state.pending.event)
            return { ok: false, requiresEvent: true, event: this.state.pending.event };
        if (this.state.pending.encounter)
            return { ok: false, requiresEncounter: true, session: this.state.pending.encounter };
        const booking = this.getCurrentBooking();
        if (booking)
            return { ok: false, requiresEncounter: true, booking };
        applyEffects(this.state, { mood: -1 });
        const time = this._consumeCurrentSlot('idle');
        journal(this.state, 'time', 'Time advanced', `You kept ${data_js_1.SLOTS[time.previous.slot].toLowerCase()} open.`);
        this._commit('time:advanced', { time });
        return { ok: true, time };
    }
    _consumeCurrentSlot(reason) {
        const previous = { day: this.state.clock.day, slot: this.state.clock.slot };
        const decay = difficultyFor(this.state).decay;
        for (const [key, amount] of Object.entries(NEED_DECAY))
            (0, utils_js_1.boundedAdd)(this.state.profile.needs, key, amount * decay);
        if (reason === 'booking') {
            (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'energy', -7 * decay);
            (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'hygiene', -6 * decay);
        }
        this._expireLeads();
        this.state.clock.slot += 1;
        let newDay = false;
        let weeklyReport = null;
        if (this.state.clock.slot > 3) {
            this.state.clock.slot = 0;
            this.state.clock.day += 1;
            newDay = true;
            weeklyReport = this._startDay();
        }
        else {
            const organicChance = .16 + this.state.business.marketingLevel * .025 + this.state.profile.reputation * .002;
            if ((0, utils_js_1.chance)(this.state, organicChance))
                this.generateLeads(1, 'organic', false);
        }
        if (!this.state.pending.event && (0, utils_js_1.chance)(this.state, .1 + (this.state.clock.slot === 0 ? .04 : 0)))
            this._triggerRandomEvent();
        return { previous, current: { day: this.state.clock.day, slot: this.state.clock.slot }, newDay, weeklyReport };
    }
    _startDay() {
        const region = data_js_1.REGIONS[this.state.profile.region] || data_js_1.REGIONS.brightwater;
        const daily = (0, utils_js_1.roundMoney)((48 + 10 + Math.max(0, this.state.finance.debt) * .0007) * region.costs * difficultyFor(this.state).expenses);
        addLedger(this.state, 'Daily living and platform costs', -daily, 'overhead');
        if (this.state.finance.debt > 0 && this.state.clock.day % 7 === 1) {
            const payment = (0, utils_js_1.roundMoney)(Math.min(this.state.finance.debt, Math.max(25, this.state.finance.debt * .04)));
            this.state.finance.debt = (0, utils_js_1.roundMoney)(Math.max(0, this.state.finance.debt - payment));
            addLedger(this.state, 'Debt payment', -payment, 'debt');
        }
        const leadCount = (0, utils_js_1.randomInt)(this.state, 1, this.state.clock.day % 5 === 0 ? 3 : 2);
        this.generateLeads(leadCount, 'organic', false);
        this.state.profile.healthStatus = this.state.clock.day - this.state.profile.lastCheckupDay > 14 ? 'checkup due' : 'up to date';
        if (this.state.finance.cash < 0) {
            (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', -8);
            (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', 2);
        }
        if (this.state.profile.needs.social < 35)
            this.state.relationships.friend.trust = (0, utils_js_1.clamp)(this.state.relationships.friend.trust - 2);
        const partner = this.state.relationships.partner;
        if (partner) {
            const yesterdayDates = this.state.bookings.filter((booking) => ['completed', 'exited'].includes(booking.status) && booking.completedDay === this.state.clock.day - 1).length;
            const disclosurePressure = partner.knowledge === 'unaware' ? 2.4 : partner.knowledge === 'partial' ? 1.35 : 0.35;
            const exposurePressure = Math.max(0, this.state.profile.exposure - 25) / 22;
            partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk + Math.round(disclosurePressure + exposurePressure + Math.max(0, yesterdayDates - 1)));
            if (this.state.profile.needs.social < 40 || yesterdayDates >= 2)
                partner.trust = (0, utils_js_1.clamp)(partner.trust - 2);
            else if (partner.knowledge === 'supportive' && this.state.profile.needs.social >= 70)
                partner.trust = (0, utils_js_1.clamp)(partner.trust + 1);
            if (partner.knowledge === 'supportive')
                partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk - 2);
        }
        if (this.state.business.hiredContacts.includes('sloane_counsel'))
            (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', 3);
        let report = null;
        if ((this.state.clock.day - 1) % 7 === 0 && this.state.clock.day > 1)
            report = this._closeWeek();
        journal(this.state, 'day', `Day ${this.state.clock.day}`, `${data_js_1.DAY_NAMES[(this.state.clock.day - 1) % 7]} begins in ${region.name}.`);
        return report;
    }
    _closeWeek() {
        const model = data_js_1.BUSINESS_MODELS[this.state.business.model] || data_js_1.BUSINESS_MODELS.independent;
        const contacts = data_js_1.CONTACTS.filter((contact) => this.state.business.hiredContacts.includes(contact.id));
        const weeklyFees = (0, utils_js_1.roundMoney)(model.weeklyFee + contacts.reduce((sum, contact) => sum + contact.weeklyCost, 0));
        if (weeklyFees)
            addLedger(this.state, 'Weekly team and business retainers', -weeklyFees, 'overhead');
        const report = {
            id: (0, utils_js_1.uniqueId)(this.state, 'week'), week: Math.floor((this.state.clock.day - 2) / 7) + 1,
            revenue: this.state.finance.weeklyRevenue, expenses: this.state.finance.weeklyExpenses,
            net: this.state.finance.weeklyRevenue - this.state.finance.weeklyExpenses,
            completedBookings: this.state.bookings.filter((booking) => booking.status === 'completed' && booking.completedDay >= this.state.clock.day - 7).length,
            reputation: this.state.profile.reputation, exposure: this.state.profile.exposure,
            wellbeing: Math.round((0, utils_js_1.average)(Object.values(this.state.profile.needs))),
        };
        this.state.pending.weeklyReport = report;
        this.state.metrics.weeks += 1;
        this.state.finance.weeklyRevenue = 0;
        this.state.finance.weeklyExpenses = 0;
        return report;
    }
    _expireLeads() {
        for (const lead of this.state.leads) {
            if (lead.status === 'new' && leadExpiryReached(this.state, lead))
                lead.status = 'expired';
        }
    }
    _triggerRandomEvent() {
        const partnerBuilder = EVENT_BUILDERS[EVENT_BUILDERS.length - 1];
        const partner = this.state.relationships.partner;
        const pool = partner ? [...EVENT_BUILDERS] : EVENT_BUILDERS.slice(0, -1);
        if (partner?.discoveryRisk >= 45)
            pool.push(partnerBuilder);
        if (partner?.discoveryRisk >= 70)
            pool.push(partnerBuilder, partnerBuilder);
        const builder = (0, utils_js_1.pick)(this.state, pool);
        this.state.pending.event = builder(this.state);
        journal(this.state, 'event', this.state.pending.event.title, this.state.pending.event.text);
        return this.state.pending.event;
    }
    resolveEvent(choiceId) {
        const event = this.state.pending.event;
        if (!event)
            return { ok: false, reason: 'No event is waiting.' };
        const choiceItem = event.choices.find((choice) => choice.id === choiceId);
        if (!choiceItem)
            return { ok: false, reason: 'Unknown event choice.' };
        let outcome = '';
        switch (`${event.type}:${choiceId}`) {
            case 'peer_referral:accept':
                this.generateLeads(1, 'referral', false);
                (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', 2);
                outcome = 'The introduction becomes a new referral lead.';
                break;
            case 'peer_referral:pass':
                this.state.relationships.peerNetwork = (0, utils_js_1.clamp)(this.state.relationships.peerNetwork + 7);
                outcome = 'Your peer network remembers the favour.';
                break;
            case 'profile_report:appeal': {
                const success = (0, utils_js_1.chance)(this.state, .42 + this.state.profile.stats.business * .07 + this.state.business.privacy * .04);
                (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', success ? -6 : 2);
                this.state.profile.xp += 10;
                outcome = success ? 'The review clears with no lasting reach penalty.' : 'The appeal is filed, but visibility stays limited for now.';
                break;
            }
            case 'profile_report:switch':
                (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', -4);
                this.generateLeads(1, 'referral', false);
                outcome = 'You shift attention to quieter referral channels.';
                break;
            case 'family_invite:make_time':
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'social', 18);
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', 10);
                this.state.relationships.family.closeness = (0, utils_js_1.clamp)(this.state.relationships.family.closeness + 8);
                outcome = 'The time away restores perspective.';
                break;
            case 'family_invite:decline':
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', -5);
                outcome = 'The calendar stays open, though the distance is felt.';
                break;
            case 'lease_inspection:prepare':
                if (this.state.finance.cash >= 80) {
                    addLedger(this.state, 'Secure storage', -80, 'privacy');
                    (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', -5);
                    outcome = 'The inspection is uneventful.';
                }
                else {
                    (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', 5);
                    outcome = 'You cannot afford the storage upgrade and accept more exposure.';
                }
                break;
            case 'lease_inspection:improvise': {
                const success = (0, utils_js_1.chance)(this.state, .28 + this.state.business.privacy * .12 + this.state.profile.stats.business * .04);
                (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', success ? -2 : 8);
                outcome = success ? 'Your privacy plan holds.' : 'A few questions raise your exposure.';
                break;
            }
            case 'city_festival:promote':
                if (this.state.finance.cash >= 65) {
                    addLedger(this.state, 'Festival promotion', -65, 'marketing');
                    this.generateLeads(3, 'marketing', false);
                    (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', 5);
                    outcome = 'The campaign fills your inbox.';
                }
                else
                    outcome = 'You skip the promotion because funds are tight.';
                break;
            case 'city_festival:stay_low':
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', 8);
                (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', -4);
                outcome = 'You enjoy the city without turning it into work.';
                break;
            case 'partner_tension:honest': {
                const partner = this.state.relationships.partner;
                if (!partner) {
                    outcome = 'There is no partner conversation to resolve.';
                    break;
                }
                if (partner.knowledge === 'unaware') {
                    partner.knowledge = 'partial';
                    partner.trust = (0, utils_js_1.clamp)(partner.trust - 5 + this.state.profile.stats.charisma);
                    partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk - 18);
                    outcome = `${partner.name} is unsettled by the disclosure, but the hidden pressure drops and a more honest conversation begins.`;
                }
                else if (partner.knowledge === 'partial') {
                    partner.knowledge = 'supportive';
                    partner.trust = (0, utils_js_1.clamp)(partner.trust + 4 + this.state.profile.stats.charisma);
                    partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk - 24);
                    outcome = `${partner.name} now understands the career clearly. The relationship has firmer agreements and less secrecy.`;
                }
                else {
                    partner.trust = (0, utils_js_1.clamp)(partner.trust + 8);
                    partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk - 12);
                    outcome = `The direct conversation with ${partner.name} restores trust and creates a clearer shared calendar.`;
                }
                this.state.metrics.disclosures = (this.state.metrics.disclosures || 0) + 1;
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', 5);
                break;
            }
            case 'partner_tension:quality_time': {
                const partner = this.state.relationships.partner;
                if (!partner) {
                    outcome = 'You use the time to reconnect with friends instead.';
                    (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'social', 10);
                    break;
                }
                partner.trust = (0, utils_js_1.clamp)(partner.trust + 8);
                partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk - 5);
                this.state.metrics.partnerTime = (this.state.metrics.partnerTime || 0) + 1;
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'social', 16);
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', 7);
                outcome = `Protected time with ${partner.name} restores connection, though any undisclosed facts remain unresolved.`;
                break;
            }
            case 'partner_tension:cover': {
                const partner = this.state.relationships.partner;
                if (!partner) {
                    outcome = 'The scheduling pressure passes.';
                    break;
                }
                partner.trust = (0, utils_js_1.clamp)(partner.trust - 6);
                partner.discoveryRisk = (0, utils_js_1.clamp)(partner.discoveryRisk + 12);
                (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', -5);
                outcome = `The immediate calendar stays open, but ${partner.name} is less convinced and discovery pressure rises.`;
                break;
            }
            default: outcome = 'The situation passes.';
        }
        this.state.pending.event = null;
        journal(this.state, 'event', event.title, outcome);
        this._commit('event:resolved', { eventId: event.id, choiceId, outcome });
        return { ok: true, outcome };
    }
    startEncounter(bookingId) {
        if (this.state.pending.event)
            return { ok: false, reason: 'Resolve the current event first.' };
        const booking = findBooking(this.state, bookingId);
        if (!booking || booking.status !== 'confirmed')
            return { ok: false, reason: 'Booking is not ready.' };
        if (booking.day !== this.state.clock.day || booking.slot !== this.state.clock.slot)
            return { ok: false, reason: 'This booking is scheduled for another time.' };
        const lead = findLead(this.state, booking.leadId);
        const session = {
            id: (0, utils_js_1.uniqueId)(this.state, 'encounter'), bookingId: booking.id, leadId: lead.id,
            stage: 0, quality: 48, safety: 40, tip: 0, privacy: 0, stress: 0,
            review: false, rebook: false, exited: false, choices: [],
            pressure: (lead.screenedRisk ?? lead.risk) > 42 || lead.discoveredFlags.length > 0,
        };
        booking.status = 'in_progress';
        this.state.pending.encounter = session;
        this._commit('encounter:started', { bookingId });
        return { ok: true, session, view: this.getEncounterView() };
    }
    getEncounterView() {
        const session = this.state.pending.encounter;
        if (!session)
            return null;
        const booking = findBooking(this.state, session.bookingId);
        const lead = findLead(this.state, session.leadId);
        const datePackage = findPackage(booking.packageId);
        if (session.stage === 0)
            return {
                stage: 0, title: 'Arrival and expectations',
                text: `${lead.alias} arrives for ${datePackage.name.toLowerCase()} at ${booking.location}. Set the tone before the date develops.`,
                context: [lead.screened ? 'screened' : 'not screened', `${booking.risk} assessed risk`, `${booking.rate} rate`],
                choices: [
                    { id: 'brief', label: 'Confirm the plan and boundaries', description: 'Strong safety gain and a professional start.' },
                    { id: 'connect', label: 'Open with warm conversation', description: 'Higher quality and tip potential; smaller safety gain.' },
                    { id: 'observe', label: 'Pause and read the room', description: 'Use intuition to protect both quality and privacy.' },
                ],
            };
        if (session.stage === 1)
            return {
                stage: 1, title: session.pressure ? 'An unplanned change' : 'The date settles in',
                text: session.pressure ? 'The client proposes changing an agreed detail. The request is not automatically unsafe, but it tests the plan you set.' : 'Conversation is comfortable. You can deepen the connection, check in, or keep the schedule structured.',
                context: [session.pressure ? 'boundary pressure' : 'stable mood', `quality ${session.quality}`, `safety ${session.safety}`],
                choices: session.pressure ? [
                    { id: 'boundary', label: 'Hold the agreed boundary', description: 'Clear, calm, and safety-forward.' },
                    { id: 'redirect', label: 'Redirect to the original plan', description: 'Balance rapport and control.' },
                    { id: 'exit', label: 'Use the safe exit plan', description: 'End the date and prioritise safety.' },
                ] : [
                    { id: 'checkin', label: 'Check in and listen', description: 'Build trust and date quality.' },
                    { id: 'guide', label: 'Guide the pace', description: 'Keep time and expectations well managed.' },
                    { id: 'privacy_pause', label: 'Do a discreet privacy check', description: 'Lower exposure and confirm the environment.' },
                ],
            };
        return {
            stage: 2, title: 'Close the date professionally',
            text: 'The scheduled time is ending. Choose what to prioritise in the final impression and follow-up.',
            context: [`quality ${session.quality}`, `safety ${session.safety}`, `stress ${session.stress}`],
            choices: [
                { id: 'review', label: 'Invite an honest review', description: 'Reputation upside with a little more exposure.' },
                { id: 'privacy', label: 'Prioritise a discreet departure', description: 'Lower exposure and reinforce boundaries.' },
                { id: 'rebook', label: 'Offer a future booking window', description: 'Chance to create a valuable regular.' },
            ],
        };
    }
    chooseEncounter(choiceId) {
        const session = this.state.pending.encounter;
        if (!session)
            return { ok: false, reason: 'No encounter is active.' };
        const valid = this.getEncounterView()?.choices.some((choice) => choice.id === choiceId);
        if (!valid)
            return { ok: false, reason: 'That choice is not available.' };
        const lead = findLead(this.state, session.leadId);
        const skill = this.state.profile.stats;
        switch (choiceId) {
            case 'brief':
                session.quality += 4 + skill.business;
                session.safety += 14 + skill.safety;
                session.stress -= 2;
                break;
            case 'connect':
                session.quality += 13 + skill.charisma * 2;
                session.safety += 4;
                session.tip += 5;
                break;
            case 'observe':
                session.quality += 6 + skill.intuition;
                session.safety += 9 + skill.intuition * 2;
                session.privacy += 3;
                break;
            case 'boundary':
                session.quality += 3 + skill.resilience;
                session.safety += 18 + skill.safety * 2;
                session.stress += 4;
                break;
            case 'redirect':
                session.quality += 8 + skill.charisma;
                session.safety += 9 + skill.intuition;
                session.stress += 2;
                break;
            case 'exit':
                session.exited = true;
                session.safety += 30;
                session.quality -= 10;
                session.stress += 8;
                break;
            case 'checkin':
                session.quality += 15 + skill.charisma;
                session.tip += 6;
                session.safety += 4;
                break;
            case 'guide':
                session.quality += 10 + skill.business;
                session.safety += 8 + skill.resilience;
                break;
            case 'privacy_pause':
                session.quality += 4;
                session.safety += 10;
                session.privacy += 10 + skill.safety;
                break;
            case 'review':
                session.review = true;
                session.quality += 5;
                session.tip += 3;
                session.privacy -= 3;
                break;
            case 'privacy':
                session.privacy += 18 + this.state.business.privacy * 2;
                session.safety += 4;
                break;
            case 'rebook':
                session.rebook = true;
                session.quality += 4;
                session.tip += 2;
                break;
            default: break;
        }
        session.choices.push(choiceId);
        if (session.exited)
            session.stage = 3;
        else
            session.stage += 1;
        if (session.stage >= 3)
            return this._completeEncounter();
        this._commit('encounter:choice', { choiceId, stage: session.stage });
        return { ok: true, complete: false, session, view: this.getEncounterView() };
    }
    _completeEncounter() {
        const session = this.state.pending.encounter;
        const booking = findBooking(this.state, session.bookingId);
        const lead = findLead(this.state, session.leadId);
        const archetype = data_js_1.CLIENT_ARCHETYPES[lead.archetype];
        const region = data_js_1.REGIONS[this.state.profile.region] || data_js_1.REGIONS.brightwater;
        const model = data_js_1.BUSINESS_MODELS[this.state.business.model] || data_js_1.BUSINESS_MODELS.independent;
        const datePackage = findPackage(booking.packageId);
        const quality = (0, utils_js_1.clamp)(Math.round(session.quality + this.state.profile.stats[datePackage.qualityStat] * 2 - Math.max(0, 50 - this.state.profile.needs.energy) * .25));
        const safetyCapacity = (0, utils_js_1.clamp)(session.safety + this.state.profile.stats.safety * 4 + modelRiskReduction(this.state));
        const incidentPressure = Math.max(0, booking.risk * region.risk - safetyCapacity * .72);
        const incidentChance = (0, utils_js_1.clamp)(incidentPressure / 150 * difficultyFor(this.state).incident, 0, .55);
        const incident = !session.exited && (0, utils_js_1.chance)(this.state, incidentChance);
        const uncomfortable = !incident && !session.exited && booking.risk > safetyCapacity && (0, utils_js_1.chance)(this.state, .3);
        const brand = data_js_1.BRAND_FOCUSES[this.state.business.brand] || data_js_1.BRAND_FOCUSES.warm;
        const tipRate = (0, utils_js_1.clamp)(archetype.tip * brand.tip + session.tip / 100 + Math.max(0, quality - 60) / 260, 0, .42);
        const tip = session.exited ? 0 : (0, utils_js_1.roundMoney)(booking.rate * tipRate);
        const due = session.exited ? 0 : Math.max(0, booking.rate - booking.deposit);
        const managementCut = (0, utils_js_1.roundMoney)((booking.rate + tip) * model.cut);
        const settlement = (0, utils_js_1.roundMoney)(due + tip - managementCut);
        if (settlement)
            addLedger(this.state, `${session.exited ? 'Safe exit' : 'Booking settlement'} · ${lead.alias}`, settlement, 'booking');
        const privacyChange = Math.round((booking.risk / 20) + model.exposureModifier + contactExposure(this.state) - session.privacy / 5 + (session.review ? 3 : 0));
        (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', privacyChange);
        (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'energy', session.exited ? -5 : -12);
        (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'mood', incident ? -24 : uncomfortable ? -10 : session.exited ? -6 : Math.round((quality - 55) / 5));
        (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'health', incident ? -10 : uncomfortable ? -3 : 0);
        (0, utils_js_1.boundedAdd)(this.state.profile.needs, 'social', session.exited ? -3 : 3);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', incident ? -9 : session.exited ? 5 : quality > 65 ? 2 : 0);
        const reputationDelta = session.exited ? (lead.discoveredFlags.length ? 0 : -1) : incident ? -4 : Math.round((quality - 50) / 10) + (session.review ? 2 : 0);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'reputation', reputationDelta);
        this.state.profile.xp += session.exited ? 14 : 20 + Math.max(0, Math.round((quality - 50) / 3));
        this.state.metrics.completedBookings += session.exited ? 0 : 1;
        this.state.metrics.bookingsExited += session.exited ? 1 : 0;
        this.state.metrics.incidents += incident ? 1 : 0;
        if (!incident && !uncomfortable)
            this.state.metrics.safeBookings += 1;
        if (quality >= 68 && !session.exited)
            this.state.metrics.positiveReviews += 1;
        const review = session.exited ? 'No review' : quality >= 80 ? 'Excellent' : quality >= 65 ? 'Positive' : quality >= 48 ? 'Mixed' : 'Poor';
        const regular = session.rebook && !session.exited && quality > 62 && (0, utils_js_1.chance)(this.state, .38 + quality / 220);
        const client = this.state.clients.find((item) => item.alias === lead.alias) || {
            id: (0, utils_js_1.uniqueId)(this.state, 'client'), alias: lead.alias, archetype: lead.archetype,
            preferences: lead.preferences, notes: [], visits: 0, lifetimeValue: 0, regular: false,
        };
        if (!this.state.clients.includes(client))
            this.state.clients.push(client);
        client.visits += session.exited ? 0 : 1;
        client.lifetimeValue += booking.rate + tip;
        client.regular = client.regular || regular;
        client.notes.unshift(`${datePackage.name}: ${review.toLowerCase()} outcome${session.exited ? ', safe exit used' : ''}.`);
        booking.status = session.exited ? 'exited' : 'completed';
        booking.completedDay = this.state.clock.day;
        booking.result = { quality, safety: Math.round(safetyCapacity), incident, uncomfortable, exited: session.exited, tip, managementCut, settlement, review, regular, reputationDelta, privacyChange };
        this.state.pending.encounter = null;
        journal(this.state, 'booking', session.exited ? 'Safe exit completed' : `${review} date`, `${lead.alias}: quality ${quality}, net settlement ${settlement}.`);
        const time = this._consumeCurrentSlot('booking');
        this._commit('encounter:completed', { bookingId: booking.id, result: booking.result, time });
        return { ok: true, complete: true, booking, result: booking.result, time };
    }
    setRate(value) {
        this.state.business.rate = (0, utils_js_1.clamp)((0, utils_js_1.roundMoney)(value), 80, 1500);
        this._commit('business:rate', { rate: this.state.business.rate });
        return { ok: true, rate: this.state.business.rate };
    }
    setDeposit(value) {
        this.state.business.depositPct = (0, utils_js_1.clamp)(Math.round(value), 0, 80);
        this._commit('business:deposit', { depositPct: this.state.business.depositPct });
        return { ok: true };
    }
    setOperations({ screening, privacy, marketingBudget } = {}) {
        if (screening != null)
            this.state.business.screening = (0, utils_js_1.clamp)(Math.round(screening), 1, 5);
        if (privacy != null)
            this.state.business.privacy = (0, utils_js_1.clamp)(Math.round(privacy), 1, 5);
        if (marketingBudget != null)
            this.state.business.marketingBudget = (0, utils_js_1.clamp)((0, utils_js_1.roundMoney)(marketingBudget), 0, 500);
        this._commit('business:operations', { screening, privacy, marketingBudget });
        return { ok: true };
    }
    changeBrand(brandId) {
        if (!data_js_1.BRAND_FOCUSES[brandId])
            return { ok: false, reason: 'Unknown brand.' };
        if (this.state.business.brand === brandId)
            return { ok: true };
        const cost = 90;
        if (this.state.finance.cash < cost)
            return { ok: false, reason: 'Not enough cash for the rebrand.' };
        addLedger(this.state, 'Profile rebrand', -cost, 'marketing');
        this.state.business.brand = brandId;
        (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', data_js_1.BRAND_FOCUSES[brandId].exposure);
        this.generateLeads(1, 'marketing', false);
        journal(this.state, 'business', 'Brand updated', `Your public positioning is now ${data_js_1.BRAND_FOCUSES[brandId].name}.`);
        this._commit('business:brand', { brandId, cost });
        return { ok: true };
    }
    changeBusinessModel(modelId) {
        if (!data_js_1.BUSINESS_MODELS[modelId])
            return { ok: false, reason: 'Unknown business model.' };
        if (this.state.business.model === modelId)
            return { ok: true };
        const cost = modelId === 'independent' ? 40 : modelId === 'protected' ? 220 : 320;
        if (this.state.finance.cash < cost)
            return { ok: false, reason: 'Not enough cash for onboarding and contracts.' };
        addLedger(this.state, `${data_js_1.BUSINESS_MODELS[modelId].name} onboarding`, -cost, 'business');
        this.state.business.model = modelId;
        (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', data_js_1.BUSINESS_MODELS[modelId].riskReduction / 3);
        journal(this.state, 'business', 'Operating model changed', data_js_1.BUSINESS_MODELS[modelId].description);
        this._commit('business:model', { modelId, cost });
        return { ok: true };
    }
    hireContact(contactId) {
        const contact = data_js_1.CONTACTS.find((item) => item.id === contactId);
        if (!contact)
            return { ok: false, reason: 'Unknown contact.' };
        if (this.state.business.hiredContacts.includes(contactId))
            return { ok: false, reason: 'Already hired.' };
        if (this.state.finance.cash < contact.hireCost)
            return { ok: false, reason: 'Not enough cash for onboarding.' };
        addLedger(this.state, `${contact.name} onboarding`, -contact.hireCost, 'team');
        this.state.business.hiredContacts.push(contactId);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'safety', Math.ceil(contact.riskReduction / 4));
        this.state.profile.xp += 12;
        journal(this.state, 'team', `${contact.name} hired`, contact.description);
        this._commit('contact:hired', { contactId });
        return { ok: true, contact };
    }
    fireContact(contactId) {
        const contact = data_js_1.CONTACTS.find((item) => item.id === contactId);
        const index = this.state.business.hiredContacts.indexOf(contactId);
        if (!contact || index < 0)
            return { ok: false, reason: 'Contact is not hired.' };
        this.state.business.hiredContacts.splice(index, 1);
        journal(this.state, 'team', `${contact.name} contract ended`, 'The working relationship ended professionally.');
        this._commit('contact:fired', { contactId });
        return { ok: true };
    }
    moveRegion(regionId) {
        const region = data_js_1.REGIONS[regionId];
        if (!region)
            return { ok: false, reason: 'Unknown region.' };
        if (regionId === this.state.profile.region)
            return { ok: true };
        const cost = region.moveCost;
        if (this.state.finance.cash < cost)
            return { ok: false, reason: 'Not enough cash for relocation.' };
        if (this.state.bookings.some((booking) => booking.status === 'confirmed'))
            return { ok: false, reason: 'Resolve or complete confirmed bookings before moving.' };
        addLedger(this.state, `Relocation to ${region.name}`, -cost, 'relocation');
        this.state.profile.region = regionId;
        this.state.leads = this.state.leads.filter((lead) => lead.status !== 'new');
        (0, utils_js_1.boundedAdd)(this.state.profile, 'reputation', -6);
        (0, utils_js_1.boundedAdd)(this.state.profile, 'exposure', -4);
        this.generateLeads(3, 'launch', false);
        journal(this.state, 'region', `Moved to ${region.name}`, region.description);
        this._commit('region:moved', { regionId, cost });
        return { ok: true };
    }
    upgradeSkill(skillId) {
        if (!data_js_1.SKILLS[skillId])
            return { ok: false, reason: 'Unknown skill.' };
        if (this.state.profile.skillPoints < 1)
            return { ok: false, reason: 'No skill points available.' };
        if (this.state.profile.stats[skillId] >= 10)
            return { ok: false, reason: 'Skill is already mastered.' };
        this.state.profile.skillPoints -= 1;
        this.state.profile.stats[skillId] += 1;
        journal(this.state, 'growth', `${data_js_1.SKILLS[skillId].name} improved`, data_js_1.SKILLS[skillId].description);
        this._commit('skill:upgraded', { skillId });
        return { ok: true };
    }
    claimGoal(goalId) {
        const goal = this.state.goals.find((item) => item.id === goalId);
        const definition = goalDefinition(goalId);
        if (!goal || !definition || !goal.complete || goal.claimed)
            return { ok: false, reason: 'Goal reward is not available.' };
        goal.claimed = true;
        if (definition.rewardCash)
            addLedger(this.state, `Goal reward · ${definition.name}`, definition.rewardCash, 'reward');
        this.state.profile.xp += definition.rewardXp;
        journal(this.state, 'growth', 'Goal completed', definition.name);
        this._commit('goal:claimed', { goalId });
        return { ok: true, definition };
    }
    getCareerPaths() {
        return Object.values(data_js_1.CAREER_ENDINGS).map((definition) => careerPathStatus(this.state, definition));
    }
    completeCareer(endingId) {
        const definition = data_js_1.CAREER_ENDINGS[endingId];
        if (!definition)
            return { ok: false, reason: 'Unknown career path.' };
        if (this.state.career?.ending)
            return { ok: false, reason: 'This career already has a completed ending.' };
        if (this.state.pending.event || this.state.pending.encounter)
            return { ok: false, reason: 'Resolve the current situation first.' };
        const status = careerPathStatus(this.state, definition);
        if (status.unavailable)
            return { ok: false, reason: 'This path requires an active partner relationship.' };
        if (!status.ready)
            return { ok: false, reason: 'The ending requirements are not complete.', status };
        this.state.career = {
            ending: endingId,
            completedDay: this.state.clock.day,
            score: careerScore(this.state),
            endingSeen: false,
        };
        this.state.profile.xp += 100;
        journal(this.state, 'growth', `Career ending: ${definition.name}`, definition.epilogue);
        this._commit('career:completed', { endingId, score: this.state.career.score });
        return { ok: true, definition, status, career: (0, utils_js_1.deepClone)(this.state.career) };
    }
    acknowledgeEnding() {
        if (!this.state.career?.ending)
            return { ok: false, reason: 'No career ending is complete.' };
        this.state.career.endingSeen = true;
        this._commit('career:acknowledged', { endingId: this.state.career.ending });
        return { ok: true };
    }
    dismissWeeklyReport() {
        if (!this.state.pending.weeklyReport)
            return { ok: false };
        this.state.meta.weeklyReportsSeen += 1;
        this.state.pending.weeklyReport = null;
        this._commit('week:dismissed');
        return { ok: true };
    }
    selectVenue(venueId) {
        const venue = data_js_1.VENUES.find((item) => item.id === venueId);
        if (!venue)
            return { ok: false };
        this.state.world.selectedVenue = venueId;
        this.state.world.player = { x: venue.x, z: venue.z };
        this._commit('world:venue', { venueId });
        return { ok: true, venue };
    }
    setSettings(patch = {}) {
        Object.assign(this.state.settings, patch);
        this._commit('settings:changed', { patch });
        return { ok: true };
    }
    setTutorialStep(step) {
        this.state.meta.tutorialStep = Math.max(0, Math.round(step));
        this._commit('tutorial:step', { step: this.state.meta.tutorialStep });
    }
}
exports.GameSimulation = GameSimulation;
function validateStateInvariants(state) {
    const errors = [];
    if (!data_js_1.REGIONS[state.profile.region])
        errors.push('Unknown region');
    if (!data_js_1.BUSINESS_MODELS[state.business.model])
        errors.push('Unknown business model');
    if (!data_js_1.BRAND_FOCUSES[state.business.brand])
        errors.push('Unknown brand');
    if (state.clock.slot < 0 || state.clock.slot > 3)
        errors.push('Clock slot out of range');
    for (const [key, value] of Object.entries(state.profile.needs))
        if (value < 0 || value > 100)
            errors.push(`Need ${key} out of range`);
    for (const key of ['safety', 'exposure', 'reputation'])
        if (state.profile[key] < 0 || state.profile[key] > 100)
            errors.push(`${key} out of range`);
    const bookingSlots = new Set();
    for (const booking of state.bookings.filter((item) => ['confirmed', 'in_progress'].includes(item.status))) {
        const key = `${booking.day}:${booking.slot}`;
        if (bookingSlots.has(key))
            errors.push(`Duplicate booking slot ${key}`);
        bookingSlots.add(key);
    }
    if (!Number.isFinite(state.finance.cash))
        errors.push('Cash is not finite');
    if (state.relationships.partner) {
        if (state.relationships.partner.trust < 0 || state.relationships.partner.trust > 100)
            errors.push('Partner trust out of range');
        if (state.relationships.partner.discoveryRisk < 0 || state.relationships.partner.discoveryRisk > 100)
            errors.push('Partner discovery risk out of range');
        if (!['unaware', 'partial', 'supportive'].includes(state.relationships.partner.knowledge))
            errors.push('Unknown partner knowledge state');
    }
    if (!state.career || typeof state.career !== 'object')
        errors.push('Career state missing');
    else if (state.career.ending && !data_js_1.CAREER_ENDINGS[state.career.ending])
        errors.push('Unknown career ending');
    return errors;
}
export { validateStateInvariants, GameSimulation };
