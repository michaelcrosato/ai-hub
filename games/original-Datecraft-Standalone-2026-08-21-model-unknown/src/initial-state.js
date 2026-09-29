// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
import * as data_js_2 from './data.js';
import * as utils_js_2 from './utils.js';
const exports = {};
exports.createInitialState = createInitialState;
function createInitialState(options = {}) {
    const background = data_js_2.BACKGROUNDS[options.background] || data_js_2.BACKGROUNDS.fresh_start;
    const presentation = data_js_2.PRESENTATIONS[options.presentation] || data_js_2.PRESENTATIONS.classic;
    const region = data_js_2.REGIONS[options.region] || data_js_2.REGIONS.brightwater;
    const personalLife = data_js_2.PERSONAL_LIFE_OPTIONS[options.relationship] || data_js_2.PERSONAL_LIFE_OPTIONS.single;
    const seedText = options.seed || `${options.name || 'Alex'}-${options.region || 'brightwater'}-${Date.now()}`;
    const baseStats = { charisma: 2, intuition: 2, resilience: 2, style: 2, business: 2, safety: 2 };
    for (const [key, amount] of Object.entries(background.stats || {}))
        baseStats[key] += amount;
    return {
        schemaVersion: data_js_2.SCHEMA_VERSION,
        version: data_js_2.GAME_VERSION,
        meta: {
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            rngState: (0, utils_js_2.hashSeed)(seedText), idCounter: 0, actions: 0,
            difficulty: options.difficulty || 'balanced', tutorial: options.tutorial !== false,
            tutorialStep: 0, weeklyReportsSeen: 0,
        },
        clock: { day: 1, slot: 0, paused: true, speed: 0 },
        profile: {
            name: String(options.name || 'Alex').trim().slice(0, 24) || 'Alex',
            pronouns: options.pronouns || 'they/them',
            adultConfirmed: Boolean(options.adultConfirmed),
            background: background.id, presentation: presentation.id, region: region.id,
            level: 1, xp: 0, skillPoints: 0,
            stats: baseStats,
            needs: {
                energy: (0, utils_js_2.clamp)(background.energy ?? 82), mood: 78, hygiene: 76,
                health: 88, social: 68,
            },
            safety: 68, exposure: (0, utils_js_2.clamp)(background.exposure ?? 6), reputation: 14,
            healthStatus: 'up to date', lastCheckupDay: 1,
        },
        business: {
            model: 'independent', rate: 180, depositPct: 30,
            marketingLevel: 1, marketingBudget: 35, screening: 2, privacy: 2,
            brand: 'warm', hiredContacts: [],
        },
        finance: {
            cash: background.cash, debt: background.debt,
            weeklyRevenue: 0, weeklyExpenses: 0, totalRevenue: 0, totalExpenses: 0,
            ledger: [{ id: 'opening', day: 1, slot: 0, label: 'Opening balance', amount: background.cash, category: 'capital' }],
        },
        leads: [], bookings: [], clients: [], blacklist: [],
        calendar: [],
        relationships: {
            friend: { name: 'Riley', trust: 66, knowledge: 'supportive' },
            family: { closeness: 55, knowledge: 'unknown' },
            partner: personalLife.partner ? { ...personalLife.partner } : null,
            peerNetwork: 24,
        },
        goals: data_js_2.GOAL_DEFINITIONS.map((goal) => ({ id: goal.id, progress: 0, complete: false, claimed: false })),
        metrics: {
            screenings: 0, completedBookings: 0, safeBookings: 0, declinedLeads: 0,
            negotiationsWon: 0, negotiationsLost: 0, bookingsExited: 0,
            positiveReviews: 0, incidents: 0, activities: 0, weeks: 0,
            disclosures: 0, partnerTime: 0,
        },
        journal: [{ id: 'welcome', day: 1, slot: 0, type: 'system', title: 'A new beginning', text: `You opened an independent profile in ${region.name}.` }],
        career: { ending: null, completedDay: null, score: null, endingSeen: false },
        pending: { event: null, weeklyReport: null, encounter: null },
        world: { selectedVenue: null, player: { x: -9, z: 7 }, cameraRotation: 0 },
        settings: {
            sound: true, music: true, reducedMotion: false, highContrast: false,
            largeText: false, reduceTransparency: false, autoSave: true,
            contentTone: 'balanced',
        },
    };
}
export { createInitialState };
