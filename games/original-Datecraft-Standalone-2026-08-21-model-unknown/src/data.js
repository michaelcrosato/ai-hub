// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
const exports = {};
exports.GAME_VERSION = '1.0.0';
exports.SCHEMA_VERSION = 4;
exports.DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
exports.SLOTS = ['Morning', 'Afternoon', 'Evening', 'Late'];
exports.REGIONS = {
    brightwater: {
        id: 'brightwater',
        name: 'Brightwater',
        tagline: 'Regulated, polished, expensive',
        legalModel: 'Licensed companion work',
        description: 'Strong infrastructure and lower compliance volatility, balanced by licensing and high living costs.',
        demand: 1.0,
        price: 1.12,
        risk: 0.72,
        exposure: 0.84,
        costs: 1.22,
        tourism: 0.9,
        moveCost: 0,
        palette: ['#76c8dd', '#f4d078', '#ff9b93'],
    },
    sunport: {
        id: 'sunport',
        name: 'Sunport',
        tagline: 'Tourism, volume, fast changes',
        legalModel: 'Decriminalized independent work',
        description: 'High seasonal demand and a large visitor pool. Reputation moves quickly in both directions.',
        demand: 1.22,
        price: 1.02,
        risk: 0.94,
        exposure: 1.16,
        costs: 1.0,
        tourism: 1.35,
        moveCost: 620,
        palette: ['#69c9d0', '#ffd16d', '#ff8b77'],
    },
    cedar_heights: {
        id: 'cedar_heights',
        name: 'Cedar Heights',
        tagline: 'Discreet, loyal, restrictive',
        legalModel: 'Restricted solicitation',
        description: 'Smaller client pool with loyal regulars. Careful screening, privacy, and legal preparation are essential.',
        demand: 0.82,
        price: 1.2,
        risk: 1.24,
        exposure: 1.28,
        costs: 0.88,
        tourism: 0.55,
        moveCost: 540,
        palette: ['#8bc9b1', '#e9c67a', '#c79adf'],
    },
};
exports.BACKGROUNDS = {
    fresh_start: { id: 'fresh_start', name: 'Fresh Start', description: 'Balanced finances, needs, and skills.', cash: 700, debt: 0, stats: {} },
    hospitality: { id: 'hospitality', name: 'Hospitality Pro', description: 'Excellent conversation and client reading; some old debt.', cash: 520, debt: 450, stats: { charisma: 1, intuition: 1 } },
    creator: { id: 'creator', name: 'Online Creator', description: 'A small audience and strong marketing skill, with higher starting exposure.', cash: 620, debt: 150, stats: { business: 1, style: 1 }, exposure: 12 },
    survivor: { id: 'survivor', name: 'Careful Rebuilder', description: 'High resilience and safety awareness; lower starting energy.', cash: 450, debt: 0, stats: { resilience: 1, safety: 1 }, energy: 68 },
};
exports.PRESENTATIONS = {
    classic: { id: 'classic', name: 'Classic', description: 'Balanced appeal and reliable expectations.', quality: 1, discretion: 1 },
    playful: { id: 'playful', name: 'Playful', description: 'Strong social energy and event demand.', quality: 2, discretion: 0 },
    executive: { id: 'executive', name: 'Executive', description: 'Higher business-client appeal and wardrobe costs.', quality: 2, discretion: 1 },
    understated: { id: 'understated', name: 'Understated', description: 'Privacy-forward presentation with lower exposure.', quality: 0, discretion: 3 },
};
exports.PERSONAL_LIFE_OPTIONS = {
    single: {
        id: 'single', name: 'Independent personal life',
        description: 'No current partner. More schedule freedom, with friendship and family as the main personal anchors.',
        partner: null,
    },
    supportive: {
        id: 'supportive', name: 'Supportive partner',
        description: 'Casey knows about the career and supports clear agreements, but still needs time and honesty.',
        partner: { name: 'Casey', trust: 72, knowledge: 'supportive', discoveryRisk: 0 },
    },
    partial: {
        id: 'partial', name: 'Partly disclosed relationship',
        description: 'Casey knows the work is client-facing but not every detail. Privacy protects the short term and creates tension.',
        partner: { name: 'Casey', trust: 64, knowledge: 'partial', discoveryRisk: 16 },
    },
    secret: {
        id: 'secret', name: 'Secret dual life',
        description: 'Casey does not know. The relationship starts intact, but exposure and scheduling can build discovery pressure.',
        partner: { name: 'Casey', trust: 60, knowledge: 'unaware', discoveryRisk: 28 },
    },
};
exports.BUSINESS_MODELS = {
    independent: { id: 'independent', name: 'Independent', description: 'Full autonomy and income. You own every operational decision.', cut: 0, leadBonus: 0, riskReduction: 0, exposureModifier: 0, weeklyFee: 0 },
    protected: { id: 'protected', name: 'Security Partnership', description: 'A driver and safe-call partner reduce incident risk for a percentage.', cut: 0.12, leadBonus: 0.02, riskReduction: 14, exposureModifier: -2, weeklyFee: 90 },
    agency: { id: 'agency', name: 'Boutique Agency', description: 'More vetted leads and admin help, in exchange for a larger cut and less autonomy.', cut: 0.24, leadBonus: 0.34, riskReduction: 9, exposureModifier: 3, weeklyFee: 140 },
};
exports.BRAND_FOCUSES = {
    warm: { id: 'warm', name: 'Warm Companion', description: 'Conversation, comfort, and thoughtful dates.', demand: 1.05, tip: 1.08, exposure: 0 },
    luxury: { id: 'luxury', name: 'Luxury Events', description: 'Premium presentation and formal occasions.', demand: 0.84, tip: 1.18, exposure: 3 },
    discreet: { id: 'discreet', name: 'Private & Discreet', description: 'Lower volume, privacy-forward positioning.', demand: 0.78, tip: 1.05, exposure: -5 },
    nightlife: { id: 'nightlife', name: 'Nightlife Guide', description: 'High-energy evening and tourism bookings.', demand: 1.18, tip: 1.02, exposure: 5 },
};
exports.ACTIVITIES = {
    rest: { id: 'rest', name: 'Rest', description: 'Recover energy and mood at home.', cost: 0, effects: { energy: 28, mood: 8, hygiene: -2, social: -3 }, xp: 2 },
    marketing: { id: 'marketing', name: 'Market', description: 'Refresh listings, post tasteful brand content, and answer inquiries.', cost: 35, effects: { energy: -7, mood: -2, social: -2 }, xp: 9, leads: 2, exposure: 4 },
    training: { id: 'training', name: 'Train', description: 'Practice negotiation, client reading, and professional communication.', cost: 45, effects: { energy: -10, mood: 2, health: 4 }, xp: 22 },
    social: { id: 'social', name: 'Connect', description: 'Spend time with a trusted friend or peer network.', cost: 25, effects: { energy: -5, mood: 18, social: 25 }, xp: 5, exposure: -1 },
    admin: { id: 'admin', name: 'Admin', description: 'Update records, privacy practices, screening notes, and finances.', cost: 0, effects: { energy: -7, mood: -3 }, xp: 12, exposure: -8, safety: 3 },
    selfcare: { id: 'selfcare', name: 'Self-care', description: 'A slower reset for health, hygiene, and resilience.', cost: 50, effects: { energy: 9, mood: 15, hygiene: 22, health: 12 }, xp: 6 },
};
exports.VENUES = [
    { id: 'home', name: 'Home', icon: '⌂', x: -9, z: 7, color: '#ff9f99', description: 'Private base for rest, wardrobe, admin, and safe-call preparation.', actions: ['rest', 'admin', 'selfcare'] },
    { id: 'studio', name: 'Luma Studio', icon: '✦', x: -2, z: 9, color: '#f3c870', description: 'Photography, profile work, and branding services.', actions: ['marketing', 'photoshoot'] },
    { id: 'cafe', name: 'Juniper Café', icon: '☕', x: 7, z: 8, color: '#72d6bd', description: 'A public meeting point for networking, screening, and social time.', actions: ['social', 'network'] },
    { id: 'gym', name: 'Pulse Club', icon: '↑', x: 10, z: 1, color: '#7fb8ea', description: 'Training, stamina work, and structured recovery.', actions: ['training', 'selfcare'] },
    { id: 'clinic', name: 'Harbour Health', icon: '+', x: 8, z: -7, color: '#95dfcf', description: 'Confidential checkups, counselling referrals, and health planning.', actions: ['checkup', 'counselling'] },
    { id: 'agency', name: 'Brightline House', icon: '◇', x: 0, z: -9, color: '#b19be8', description: 'Management offers, security contacts, accountants, and professional services.', actions: ['business', 'hire'] },
    { id: 'hotel', name: 'Sol Hotel', icon: '▦', x: -8, z: -6, color: '#ffd37c', description: 'A staffed, public-facing venue used for many premium bookings.', actions: ['booking', 'scout'] },
    { id: 'waterfront', name: 'Sunset Pier', icon: '≈', x: -11, z: 0, color: '#73c6df', description: 'Restaurants, events, and high-tourism evening demand.', actions: ['social', 'scout'] },
];
exports.CONTACTS = [
    { id: 'mara_security', name: 'Mara Chen', role: 'Security & driver', description: 'Safe-call coverage, transport, and venue checks.', hireCost: 260, weeklyCost: 110, riskReduction: 18, leadBonus: 0, exposure: -1 },
    { id: 'devon_manager', name: 'Devon Price', role: 'Independent manager', description: 'Calendar administration and higher-value negotiations.', hireCost: 340, weeklyCost: 150, riskReduction: 4, leadBonus: 0.2, exposure: 2 },
    { id: 'imani_photo', name: 'Imani Vale', role: 'Photographer', description: 'Raises profile quality and premium-brand conversion.', hireCost: 210, weeklyCost: 60, riskReduction: 0, leadBonus: 0.12, exposure: 2 },
    { id: 'noah_accounting', name: 'Noah Bell', role: 'Accountant', description: 'Lowers overhead leakage and improves legal preparedness.', hireCost: 300, weeklyCost: 95, riskReduction: 5, leadBonus: 0.03, exposure: -2 },
    { id: 'sloane_counsel', name: 'Sloane Reed', role: 'Peer counsellor', description: 'Weekly wellbeing support and burnout prevention.', hireCost: 160, weeklyCost: 75, riskReduction: 3, leadBonus: 0, exposure: 0 },
];
exports.CLIENT_ARCHETYPES = {
    respectful: { id: 'respectful', label: 'Respectful regular', risk: 8, budget: 1.04, verification: 72, tip: .13, patience: 1.15, description: 'Clear communication and reliable expectations.' },
    nervous: { id: 'nervous', label: 'First-time client', risk: 18, budget: .92, verification: 58, tip: .08, patience: 1.02, description: 'Needs reassurance and a clear plan.' },
    executive: { id: 'executive', label: 'Busy professional', risk: 13, budget: 1.35, verification: 76, tip: .16, patience: .82, description: 'Values punctuality, discretion, and efficiency.' },
    tourist: { id: 'tourist', label: 'Visitor', risk: 24, budget: 1.12, verification: 48, tip: .12, patience: .92, description: 'Short notice and interested in local guidance.' },
    charmer: { id: 'charmer', label: 'Social charmer', risk: 32, budget: 1.08, verification: 51, tip: .1, patience: 1.12, description: 'Friendly, persuasive, and prone to testing soft limits.' },
    demanding: { id: 'demanding', label: 'Demanding prospect', risk: 48, budget: 1.22, verification: 39, tip: .05, patience: .62, description: 'High expectations and more negotiation pressure.' },
};
exports.CLIENT_NAMES = ['Avery', 'Blake', 'Cameron', 'Drew', 'Elliot', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jordan', 'Kai', 'Lane', 'Morgan', 'Nico', 'Oakley', 'Parker', 'Quinn', 'Reese', 'Sage', 'Taylor'];
exports.DATE_PACKAGES = [
    { id: 'dinner', name: 'Dinner Companion', slots: ['Evening'], qualityStat: 'charisma', baseRisk: 4 },
    { id: 'event', name: 'Event Plus-One', slots: ['Afternoon', 'Evening'], qualityStat: 'style', baseRisk: 6 },
    { id: 'city_guide', name: 'City Guide Date', slots: ['Afternoon', 'Evening'], qualityStat: 'intuition', baseRisk: 5 },
    { id: 'private_evening', name: 'Private Evening', slots: ['Evening', 'Late'], qualityStat: 'resilience', baseRisk: 12 },
    { id: 'travel_day', name: 'Travel Day Companion', slots: ['Morning', 'Afternoon'], qualityStat: 'business', baseRisk: 10 },
];
exports.PREFERENCES = ['good conversation', 'punctuality', 'fine dining', 'local knowledge', 'discretion', 'formal events', 'quiet company', 'nightlife', 'clear planning', 'humour'];
exports.RED_FLAGS = ['resists verification', 'changes location repeatedly', 'pushes for a discount', 'avoids deposit', 'ignores scheduling details', 'uses inconsistent contact information'];
exports.SKILLS = {
    charisma: { name: 'Connection', description: 'Conversation, warmth, and date quality.' },
    intuition: { name: 'Client Reading', description: 'Spot pressure, read mood, and detect inconsistencies.' },
    resilience: { name: 'Resilience', description: 'Manage stress and recover from difficult sessions.' },
    style: { name: 'Presentation', description: 'Branding, wardrobe, and premium-event confidence.' },
    business: { name: 'Business', description: 'Pricing, negotiation, finance, and scheduling.' },
    safety: { name: 'Safety', description: 'Screening, boundaries, de-escalation, and exit planning.' },
};
exports.GOAL_DEFINITIONS = [
    { id: 'screen_first', name: 'Do the homework', description: 'Screen one new lead.', metric: 'screenings', target: 1, rewardCash: 40, rewardXp: 20 },
    { id: 'book_first', name: 'First booking', description: 'Confirm and complete a professional date.', metric: 'completedBookings', target: 1, rewardCash: 75, rewardXp: 35 },
    { id: 'safe_three', name: 'Safety streak', description: 'Complete three bookings without an incident.', metric: 'safeBookings', target: 3, rewardCash: 120, rewardXp: 45 },
    { id: 'rep_35', name: 'Known for quality', description: 'Reach 35 reputation.', metric: 'reputation', target: 35, rewardCash: 160, rewardXp: 50 },
    { id: 'cash_2500', name: 'Build a runway', description: 'Hold $2,500 in cash.', metric: 'cash', target: 2500, rewardCash: 0, rewardXp: 65 },
    { id: 'support_team', name: 'Build a support team', description: 'Hire one professional contact.', metric: 'contacts', target: 1, rewardCash: 100, rewardXp: 40 },
    { id: 'week_one', name: 'One full week', description: 'Reach day 8 with your wellbeing intact.', metric: 'day', target: 8, rewardCash: 200, rewardXp: 80 },
];
exports.CAREER_ENDINGS = {
    clean_exit: {
        id: 'clean_exit', name: 'Planned transition', icon: '→',
        description: 'Leave the business on your own timetable with debt cleared and a practical financial runway.',
        epilogue: 'You close the calendar deliberately, settle the final accounts, and step into the next chapter with choices still open.',
        requirements: [
            { key: 'day', label: 'Reach day 30', target: 30 },
            { key: 'cash', label: 'Hold $3,500', target: 3500 },
            { key: 'debtMax', label: 'Clear all debt', target: 0, mode: 'max' },
        ],
    },
    sustainable_independent: {
        id: 'sustainable_independent', name: 'Sustainable independent', icon: '◇',
        description: 'Build a low-exposure, safety-forward independent practice that can last without sacrificing the rest of life.',
        epilogue: 'Your calendar becomes smaller, stronger, and yours. A stable regular base and disciplined operations create long-term autonomy.',
        requirements: [
            { key: 'day', label: 'Reach day 35', target: 35 },
            { key: 'safeBookings', label: 'Complete 8 safe dates', target: 8 },
            { key: 'safety', label: 'Reach 72 safety', target: 72 },
            { key: 'exposureMax', label: 'Keep exposure at 45 or below', target: 45, mode: 'max' },
            { key: 'independentModel', label: 'Operate independently', target: 1 },
        ],
    },
    boutique_owner: {
        id: 'boutique_owner', name: 'Boutique owner', icon: '◆',
        description: 'Turn experience into a carefully managed brand with staff, capital, and a strong reputation.',
        epilogue: 'You stop thinking only in individual bookings and build a small organization around standards, support, and a recognizable name.',
        requirements: [
            { key: 'day', label: 'Reach day 45', target: 45 },
            { key: 'cash', label: 'Hold $6,500', target: 6500 },
            { key: 'reputation', label: 'Reach 60 reputation', target: 60 },
            { key: 'contacts', label: 'Hire 2 contacts', target: 2 },
            { key: 'completedBookings', label: 'Complete 10 dates', target: 10 },
        ],
    },
    community_advocate: {
        id: 'community_advocate', name: 'Community advocate', icon: '⌁',
        description: 'Use professional credibility and peer trust to strengthen a wider support network.',
        epilogue: 'Referrals become resources, private warnings become shared knowledge, and your career grows into work that improves the whole network.',
        requirements: [
            { key: 'day', label: 'Reach day 40', target: 40 },
            { key: 'peerNetwork', label: 'Reach 65 peer network', target: 65 },
            { key: 'reputation', label: 'Reach 45 reputation', target: 45 },
            { key: 'positiveReviews', label: 'Earn 6 positive reviews', target: 6 },
        ],
    },
    stable_dual_life: {
        id: 'stable_dual_life', name: 'Stable dual life', icon: '♥',
        description: 'Sustain the business while building a trusted adult partnership and keeping public exposure controlled.',
        epilogue: 'The double calendar becomes an honest shared plan. Work remains part of life, but secrecy no longer runs the relationship.',
        requiresPartner: true,
        requirements: [
            { key: 'day', label: 'Reach day 40', target: 40 },
            { key: 'partnerTrust', label: 'Reach 78 partner trust', target: 78 },
            { key: 'partnerKnowledge', label: 'Reach supportive disclosure', target: 1 },
            { key: 'cash', label: 'Hold $3,000', target: 3000 },
            { key: 'exposureMax', label: 'Keep exposure at 35 or below', target: 35, mode: 'max' },
        ],
    },
};
export const { GAME_VERSION, SCHEMA_VERSION, DAY_NAMES, SLOTS, REGIONS, BACKGROUNDS, PRESENTATIONS, PERSONAL_LIFE_OPTIONS, BUSINESS_MODELS, BRAND_FOCUSES, ACTIVITIES, VENUES, CONTACTS, CLIENT_ARCHETYPES, CLIENT_NAMES, DATE_PACKAGES, PREFERENCES, RED_FLAGS, SKILLS, GOAL_DEFINITIONS, CAREER_ENDINGS } = exports;
