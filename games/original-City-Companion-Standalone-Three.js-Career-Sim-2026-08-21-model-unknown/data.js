// Every table of content and balance the game runs on. Numbers match the
// original single-file build; entries marked "new" were added in the 2026
// upgrade pass (Lantern Gallery, Harborlight Collective, five mid-date
// scenarios, three client types, difficulty paces and career achievements).

export const SAVE_KEY = 'city-companion-save-v1';
export const RECORDS_KEY = 'city-companion-records-v1';
export const SOUND_KEY = 'city-companion-sound-v1';
export const SAVE_VERSION = 2;
export const SAVINGS_GOAL = 7500;
/** In-game minutes per real second at 1× speed. */
export const MINUTES_PER_SECOND = 2;
export const MAP_MIN = -30;
export const MAP_MAX = 30;
export const SKILL_CAP = 8;
/** Daily dues for Harborlight Collective members (new). */
export const COLLECTIVE_DUES = 12;

export const REGIONS = {
  sunharbor: {
    name: 'Sunharbor',
    policy: 'Regulated market',
    description: 'Steady demand, moderate overhead, and clear compliance expectations.',
    rateMultiplier: 1,
    demand: 1,
    dailyCost: 62,
    exposureFactor: 1,
    reputationFactor: 1,
    safetyModifier: 2,
    moveCost: 260,
    sky: 0x9ddff7,
    fog: 0xcbeef7,
    accent: '#f4c65b',
  },
  gardenloop: {
    name: 'Garden Loop',
    policy: 'Decriminalized market',
    description: 'Lower operating pressure and costs, with slower visibility growth.',
    rateMultiplier: 0.9,
    demand: 0.9,
    dailyCost: 45,
    exposureFactor: 0.72,
    reputationFactor: 0.86,
    safetyModifier: 7,
    moveCost: 220,
    sky: 0xbcebd5,
    fog: 0xe1f5e8,
    accent: '#55c7a5',
  },
  neoncenter: {
    name: 'Neon Center',
    policy: 'Restricted market',
    description: 'Strong demand and higher fees, paired with greater scrutiny and overhead.',
    rateMultiplier: 1.22,
    demand: 1.28,
    dailyCost: 88,
    exposureFactor: 1.35,
    reputationFactor: 1.18,
    safetyModifier: -3,
    moveCost: 330,
    sky: 0xc9c8f5,
    fog: 0xe4e5fb,
    accent: '#8e7ddb',
  },
};

export const MODELS = {
  independent: {
    name: 'Independent',
    description: 'Full control, no commission, and full responsibility for screening and logistics.',
    commission: 0,
    dailyRetainer: 0,
    leadQuality: 0,
    safety: 0,
    screening: 0,
    visibility: 0,
  },
  protected: {
    name: 'Protected',
    description: 'Driver and safe-call support in exchange for a retainer and a small service cut.',
    commission: 0.1,
    dailyRetainer: 38,
    leadQuality: 0.05,
    safety: 17,
    screening: 7,
    visibility: 0,
  },
  agency: {
    name: 'Agency',
    description: 'Managed lead pipeline and scheduling support with a larger commission.',
    commission: 0.23,
    dailyRetainer: 0,
    leadQuality: 0.14,
    safety: 9,
    screening: 4,
    visibility: 8,
  },
};

export const BRANDS = {
  warm: {
    name: 'Warm Host',
    description: 'Approachable, conversational, and regular-client focused.',
    reviewBonus: 4,
    rateMultiplier: 0.98,
    exposure: 0,
  },
  executive: {
    name: 'Executive Companion',
    description: 'Polished, discreet, and higher-fee professional social engagements.',
    reviewBonus: 0,
    rateMultiplier: 1.12,
    exposure: 2,
  },
  cityguide: {
    name: 'City Guide',
    description: 'Culture, dining, and event-focused dates with lower encounter stress.',
    reviewBonus: 2,
    rateMultiplier: 1.03,
    exposure: 1,
  },
};

export const SKILLS = {
  presence: {
    name: 'Presence',
    description: 'Rapport, conversation, confidence, and review quality.',
    location: 'cafe',
    trainingName: 'Conversation practice',
  },
  insight: {
    name: 'Insight',
    description: 'Screening, reading situations, and detecting mismatched expectations.',
    location: 'park',
    trainingName: 'Observation practice',
  },
  negotiation: {
    name: 'Negotiation',
    description: 'Pricing, deposits, extensions, and schedule boundaries.',
    location: 'agency',
    trainingName: 'Negotiation workshop',
  },
  branding: {
    name: 'Branding',
    description: 'Profile quality, marketing efficiency, and lead conversion.',
    location: 'studio',
    trainingName: 'Brand workshop',
  },
  safety: {
    name: 'Safety',
    description: 'Preparation, de-escalation, safe exits, and risk reduction.',
    location: 'safety',
    trainingName: 'Safety class',
  },
  resilience: {
    name: 'Resilience',
    description: 'Stress recovery, energy management, and sustainable pacing.',
    location: 'gym',
    trainingName: 'Recovery training',
  },
};

/** Places the character can walk to. x/z is the building centre, entry is where you stand to use it. */
export const LOCATIONS = {
  home: {
    name: 'Home',
    short: 'Rest & plan',
    description: 'Recover, organize the calendar, and prepare your presentation.',
    x: -21,
    z: -19,
    entry: { x: -16.5, z: -14.2 },
    footprint: { w: 7, d: 7 },
    height: 6.2,
    color: 0xf3b96f,
    roof: 0xe67f67,
    icon: 'H',
  },
  cafe: {
    name: 'Lemon Café',
    short: 'Practice & meet',
    description: 'A relaxed public venue for practice, networking, and some bookings.',
    x: -10,
    z: -19,
    entry: { x: -10, z: -14.1 },
    footprint: { w: 7, d: 7 },
    height: 5.2,
    color: 0xf2d86e,
    roof: 0xef9c61,
    icon: 'C',
  },
  studio: {
    name: 'Brightside Studio',
    short: 'Profile & privacy',
    description: 'Improve profile quality, photography, messaging, and privacy controls.',
    x: 8,
    z: -19,
    entry: { x: 8, z: -14.1 },
    footprint: { w: 8, d: 7 },
    height: 7.3,
    color: 0xe996b7,
    roof: 0xb66fa4,
    icon: 'S',
  },
  hotel: {
    name: 'Harbor Hotel',
    short: 'Booking venue',
    description: 'A staffed venue used for scheduled professional dates.',
    x: 20,
    z: -17,
    entry: { x: 15.1, z: -11.2 },
    footprint: { w: 7, d: 9 },
    height: 12.5,
    color: 0x76b9df,
    roof: 0x527ea8,
    icon: 'HT',
  },
  clinic: {
    name: 'Wellbeing Clinic',
    short: 'Health & support',
    description: 'Routine care, counselling, and recovery support.',
    x: 20,
    z: -4,
    entry: { x: 15.4, z: -4 },
    footprint: { w: 7, d: 7 },
    height: 6.8,
    color: 0x7fd5bd,
    roof: 0x47a78d,
    icon: '+',
  },
  safety: {
    name: 'SafeLine Office',
    short: 'Safety & support',
    description: 'Safe-call setup, de-escalation training, and protection services.',
    x: 20,
    z: 9,
    entry: { x: 15.4, z: 9 },
    footprint: { w: 7, d: 7 },
    height: 7.4,
    color: 0x73c7df,
    roof: 0x3a93b1,
    icon: 'SH',
  },
  agency: {
    name: 'Northstar Agency',
    short: 'Management & deals',
    description: 'Review operating models, rates, contracts, and business strategy.',
    x: 11,
    z: 20,
    entry: { x: 11, z: 15.4 },
    footprint: { w: 8, d: 7 },
    height: 10.5,
    color: 0x9a8be0,
    roof: 0x6b62b3,
    icon: 'A',
  },
  lounge: {
    name: 'Skyglass Lounge',
    short: 'Network & dates',
    description: 'An upbeat social venue for preparation, networking, and bookings.',
    x: -2,
    z: 20,
    entry: { x: -2, z: 15.4 },
    footprint: { w: 8, d: 7 },
    height: 8.7,
    color: 0xe88da2,
    roof: 0xaf647c,
    icon: 'L',
  },
  gym: {
    name: 'Pulse Gym',
    short: 'Fitness & recovery',
    description: 'Build sustainable energy, health, and resilience.',
    x: -20,
    z: 20,
    entry: { x: -15.4, z: 15.4 },
    footprint: { w: 7, d: 7 },
    height: 6.6,
    color: 0xf09a69,
    roof: 0xcb6f58,
    icon: 'G',
  },
  park: {
    name: 'Garden Park',
    short: 'Reflect & recover',
    description: 'A quiet place to decompress, call someone you trust, or journal.',
    x: -20,
    z: 4,
    entry: { x: -15.2, z: 4 },
    footprint: null,
    height: 1.2,
    color: 0x6fca88,
    roof: 0x55ae6b,
    icon: 'P',
  },
  transit: {
    name: 'Central Transit',
    short: 'Move regions',
    description: 'Relocate to another fictional region or take a quick city tour.',
    x: 6.5,
    z: 4.5,
    entry: { x: 6.5, z: 2.3 },
    footprint: null,
    height: 3,
    color: 0x72b5dc,
    roof: 0x4a80aa,
    icon: 'T',
  },
  // New: the green block by the main crossing was an unnamed filler building; it is now a
  // culture venue (same size, colours and spot, so the skyline is unchanged).
  gallery: {
    name: 'Lantern Gallery',
    short: 'Culture & dates',
    description: 'A bright gallery and café for exhibitions, cultural dates, and quiet networking.',
    x: -7,
    z: 7,
    entry: { x: -7, z: 2.7 },
    footprint: { w: 6, d: 6 },
    padding: 0.65,
    height: 9.5,
    color: 0xa7d27d,
    roof: 0x6b9f51,
    icon: 'GA',
  },
  // New: a peer-support hub on the empty lot east of Northstar Agency.
  collective: {
    name: 'Harborlight Collective',
    short: 'Peer support',
    description: 'A peer-run hub for independent companions: shared safety alerts, mentoring, and rights workshops.',
    x: 20,
    z: 21.5,
    entry: { x: 20, z: 16.9 },
    footprint: { w: 5.5, d: 6 },
    height: 5.8,
    color: 0x8fd6c4,
    roof: 0x3f9e8a,
    icon: 'PC',
  },
};

/** Unnamed buildings that fill out the blocks. */
export const FILLER_BUILDINGS = [
  { x: -7, z: -7, w: 6, d: 6, h: 6.5, color: 0x85c7dd, roof: 0x4c91ad },
  { x: 7, z: -7, w: 6, d: 6, h: 8.5, color: 0xf0a98c, roof: 0xbf715d },
  { x: 7, z: 9, w: 6, d: 6, h: 6.2, color: 0xe0a3d2, roof: 0xab71a0 },
  { x: -27, z: -5, w: 4.5, d: 6, h: 8, color: 0xe7cc78, roof: 0xb9a052 },
  { x: 26, z: 21, w: 5, d: 6, h: 9, color: 0x82c7b8, roof: 0x4a9789 },
];

export const CLIENT_NAMES = [
  'Jordan', 'Morgan', 'Taylor', 'Casey', 'Avery', 'Riley', 'Quinn', 'Cameron', 'Hayden', 'Rowan', 'Sasha', 'Devon',
  'Jamie', 'Noor', 'Emery', 'Parker', 'Drew', 'Reese', 'Robin', 'Skyler', 'Sam', 'Kai', 'Alexis', 'Marin',
];

export const ARCHETYPES = [
  {
    id: 'new-in-town',
    label: 'Visitor',
    summary: 'New in town and looking for an easygoing dinner companion.',
    rate: 1,
    risk: 2,
    duration: [120, 180],
    venues: ['cafe', 'lounge', 'hotel'],
  },
  {
    id: 'busy-professional',
    label: 'Professional',
    summary: 'Values punctuality, discretion, and polished conversation.',
    rate: 1.22,
    risk: 4,
    duration: [120, 180, 240],
    venues: ['lounge', 'hotel'],
  },
  {
    id: 'arts-patron',
    label: 'Culture fan',
    summary: 'Wants company for a gallery, dinner, or local cultural event.',
    rate: 1.08,
    risk: -3,
    duration: [120, 180],
    venues: ['cafe', 'lounge', 'gallery'],
  },
  {
    id: 'returning-visitor',
    label: 'Returning visitor',
    summary: 'Travels often and may become a reliable regular after a strong date.',
    rate: 1.16,
    risk: 0,
    duration: [180, 240],
    venues: ['hotel', 'lounge'],
  },
  {
    id: 'last-minute',
    label: 'Last-minute request',
    summary: 'Has a narrow window and is willing to pay for schedule flexibility.',
    rate: 1.28,
    risk: 12,
    duration: [90, 120],
    venues: ['hotel', 'lounge'],
  },
  {
    id: 'quiet-regular',
    label: 'Low-key local',
    summary: 'Prefers a calm, private-feeling public date and consistent communication.',
    rate: 0.96,
    risk: -5,
    duration: [120, 180],
    venues: ['cafe', 'lounge'],
  },
  // New client types.
  {
    id: 'conference-guest',
    label: 'Conference guest',
    summary: 'In town for a conference and wants engaging company at a networking dinner.',
    rate: 1.14,
    risk: 1,
    duration: [120, 180],
    venues: ['hotel', 'lounge', 'cafe'],
  },
  {
    id: 'theatre-lover',
    label: 'Theatre lover',
    summary: 'Has two tickets to an evening show and wants a thoughtful companion for it.',
    rate: 1.06,
    risk: -4,
    duration: [180, 240],
    venues: ['gallery', 'lounge'],
  },
  {
    id: 'event-plus-one',
    label: 'Event plus-one',
    summary: 'Needs a poised plus-one for a formal reception and values discretion.',
    rate: 1.3,
    risk: 3,
    duration: [240],
    venues: ['hotel', 'gallery'],
  },
];

export const POSITIVE_FLAGS = [
  'Verified identity',
  'Clear itinerary',
  'Reference confirmed',
  'Deposit ready',
  'Respectful communication',
  'Flexible public venue',
];

export const WARNING_FLAGS = [
  'Rushed communication',
  'Vague venue details',
  'Avoids deposit discussion',
  'Schedule details changed',
  'Expectations need clarification',
  'Privacy terms not yet acknowledged',
];

/** Serious warning signs: they raise screened risk and steer the date to a boundary scenario. */
export const SERIOUS_FLAGS = [
  'Repeated boundary pushing',
  'Identity mismatch',
  'Payment details inconsistent',
  'Refuses agreed safety check-in',
];

/**
 * Mid-date scenarios. Each choice: skill (null = no check), difficulty, success/fail score
 * change, optional extension minutes, safeExit (ends the date; blacklist: false keeps the
 * client off the blacklist), failStats (stat changes when the check fails).
 */
export const SCENARIOS = {
  conversation: {
    title: 'Find the rhythm',
    copy: 'The conversation begins politely but has not found an easy rhythm yet. Choose how to improve the atmosphere without overextending yourself.',
    choices: [
      { label: 'Ask a thoughtful open question', detail: 'Use Presence to build natural rapport.', skill: 'presence', difficulty: 64, success: 11, fail: -2 },
      { label: 'Suggest a change of setting', detail: 'Use Branding to match the experience to your profile.', skill: 'branding', difficulty: 70, success: 10, fail: -2 },
      { label: 'Keep the pace calm and simple', detail: 'A reliable low-risk option with a modest score gain.', skill: null, difficulty: 0, success: 6, fail: 0, automatic: true },
    ],
  },
  extension: {
    title: 'Handle an extension request',
    copy: 'The client asks to extend the date. The extra time has not been priced or added to the original plan.',
    choices: [
      { label: 'Restate the extension rate', detail: 'Use Negotiation to protect your time and pricing.', skill: 'negotiation', difficulty: 69, success: 12, fail: -2, extension: 60 },
      { label: 'Offer a shorter paid extension', detail: 'Use Presence and flexibility while keeping clear terms.', skill: 'presence', difficulty: 66, success: 9, fail: -1, extension: 30 },
      { label: 'Keep the original end time', detail: 'Decline the extension clearly. No skill check required.', skill: null, difficulty: 0, success: 7, fail: 0, automatic: true },
    ],
  },
  privacy: {
    title: 'Protect privacy expectations',
    copy: 'The client suggests taking a personal photo together, although photography was not part of the agreement.',
    choices: [
      { label: 'Decline and restate the privacy terms', detail: 'Use Safety to keep the boundary clear and calm.', skill: 'safety', difficulty: 66, success: 12, fail: -1 },
      { label: 'Offer a scenery-only photo instead', detail: 'Use Branding to redirect the request without including either person.', skill: 'branding', difficulty: 68, success: 9, fail: -1 },
      { label: 'End the date if pressure continues', detail: 'Take a safe exit. Boundary enforcement never reduces reputation.', skill: null, difficulty: 0, success: 5, fail: 0, safeExit: true, automatic: true },
    ],
  },
  boundary: {
    title: 'Reaffirm the agreed plan',
    copy: 'The client proposes changing the date in a way that falls outside the plan you confirmed beforehand.',
    choices: [
      { label: 'Restate the boundary directly', detail: 'Use Safety to keep the date within the agreement.', skill: 'safety', difficulty: 72, success: 13, fail: -1 },
      { label: 'Redirect to an agreed activity', detail: 'Use Insight to identify an acceptable alternative.', skill: 'insight', difficulty: 73, success: 10, fail: -1 },
      { label: 'Leave the date', detail: 'Use your exit plan. Safety comes before earnings or reviews.', skill: null, difficulty: 0, success: 6, fail: 0, safeExit: true, automatic: true },
    ],
  },
  delay: {
    title: 'Reset the schedule',
    copy: 'The client arrives late and expects the original end time to move. Your next booking and recovery time still matter.',
    choices: [
      { label: 'Confirm the original end time', detail: 'Use Negotiation to keep the calendar intact.', skill: 'negotiation', difficulty: 67, success: 11, fail: -1 },
      { label: 'Offer paid extra time if available', detail: 'Use Insight to balance the schedule and added fee.', skill: 'insight', difficulty: 70, success: 10, fail: -2, extension: 30 },
      { label: 'Shorten the plan fairly', detail: 'A calm compromise that protects the rest of the day.', skill: null, difficulty: 0, success: 6, fail: 0, automatic: true },
    ],
  },
  // New scenarios.
  venue: {
    title: 'Sort out a venue mix-up',
    copy: 'The reservation was logged for the wrong time, and the host says the table will not be ready for a while.',
    choices: [
      { label: 'Negotiate another table', detail: 'Use Negotiation to rescue the reservation politely.', skill: 'negotiation', difficulty: 66, success: 11, fail: -2 },
      { label: 'Suggest a nearby alternative', detail: 'Use Insight to pick a place you know works.', skill: 'insight', difficulty: 64, success: 10, fail: -2 },
      { label: 'Wait it out with light conversation', detail: 'No check. The evening starts a little slower.', skill: null, difficulty: 0, success: 5, fail: 0, automatic: true },
    ],
  },
  payment: {
    title: 'Resolve a payment hiccup',
    copy: 'The client’s payment app fails when settling the agreed balance, and they suggest settling up “next time.”',
    choices: [
      { label: 'Calmly restate the payment terms', detail: 'Use Negotiation to keep the agreement intact.', skill: 'negotiation', difficulty: 68, success: 12, fail: -2, failStats: { stress: 3 } },
      { label: 'Offer a verified alternative method', detail: 'Use Insight to find a method that works for both of you.', skill: 'insight', difficulty: 66, success: 10, fail: -1 },
      { label: 'Close early and keep the deposit', detail: 'End the date without drama. The client is not blacklisted.', skill: null, difficulty: 0, success: 4, fail: 0, safeExit: true, blacklist: false, automatic: true },
    ],
  },
  acquaintance: {
    title: 'Protect your privacy in public',
    copy: 'Someone you know from your personal life walks into the venue and glances your way.',
    choices: [
      { label: 'Greet them briefly and move on', detail: 'Use Presence to keep the moment light. A slip adds exposure.', skill: 'presence', difficulty: 67, success: 10, fail: -2, failStats: { exposure: 3, stress: 2 } },
      { label: 'Steer the date to a quieter table', detail: 'Use Insight to change the setting smoothly.', skill: 'insight', difficulty: 64, success: 9, fail: -1, failStats: { exposure: 1 } },
      { label: 'Excuse yourself for a moment', detail: 'No check. A short pause keeps things private.', skill: null, difficulty: 0, success: 4, fail: 0, automatic: true },
    ],
  },
  fatigue: {
    title: 'Adjust to a tired client',
    copy: 'The client is worn out after a long travel day and is clearly struggling to enjoy the original plan.',
    choices: [
      { label: 'Switch to something low-key', detail: 'Use Presence to keep the date warm and easy.', skill: 'presence', difficulty: 60, success: 10, fail: -1 },
      { label: 'Suggest a shorter, relaxed plan', detail: 'Use Insight to read what the client actually needs.', skill: 'insight', difficulty: 62, success: 9, fail: -1 },
      { label: 'Carry on as planned', detail: 'No check. Reliable, if a little flat.', skill: null, difficulty: 0, success: 5, fail: 0, automatic: true },
    ],
  },
  weather: {
    title: 'Adapt to a change of plans',
    copy: 'Heavy rain cancels the outdoor event the client had planned, and both of you are standing under an awning.',
    choices: [
      { label: 'Propose an indoor alternative', detail: 'Use Insight to find a good plan B quickly.', skill: 'insight', difficulty: 63, success: 10, fail: -2 },
      { label: 'Turn it into a cosy café stop', detail: 'Use Presence to make the change feel intentional.', skill: 'presence', difficulty: 62, success: 9, fail: -1 },
      { label: 'Keep the timing and simplify', detail: 'No check. A calm, modest evening.', skill: null, difficulty: 0, success: 6, fail: 0, automatic: true },
    ],
  },
};

export const CAMPAIGNS = {
  referral: { name: 'Referral circle', cost: 75, leads: 1, visibility: 7, exposure: 1, profile: 1, qualityBoost: 14, detail: 'Lower-risk visibility with one screened-quality lead.' },
  targeted: { name: 'Targeted listing', cost: 120, leads: 2, visibility: 13, exposure: 4, profile: 2, qualityBoost: 5, detail: 'More visibility and two likely inquiries, with modest exposure.' },
  spotlight: { name: 'City spotlight', cost: 210, leads: 3, visibility: 24, exposure: 10, profile: 3, qualityBoost: 0, detail: 'A strong demand burst that also raises public exposure.' },
};

/** New: difficulty paces chosen on the setup screen. */
export const DIFFICULTIES = {
  relaxed: {
    name: 'Relaxed',
    tag: 'Gentler pace',
    description: 'Lower overhead, safer leads, and slower fatigue while you learn the systems.',
    cashBonus: 250,
    costMultiplier: 0.8,
    riskOffset: -6,
    drainMultiplier: 0.85,
  },
  standard: {
    name: 'Standard',
    tag: 'Original balance',
    description: 'The balance the career was designed around.',
    cashBonus: 0,
    costMultiplier: 1,
    riskOffset: 0,
    drainMultiplier: 1,
  },
  demanding: {
    name: 'Demanding',
    tag: 'Tight margins',
    description: 'Higher overhead, riskier inquiries, and faster fatigue.',
    cashBonus: -200,
    costMultiplier: 1.25,
    riskOffset: 6,
    drainMultiplier: 1.15,
  },
};

/** New: career achievements, checked a couple of times a second. */
export const ACHIEVEMENTS = [
  { id: 'first-date', name: 'First booking', detail: 'Complete your first date.', check: (s) => s.completedDates >= 1 },
  { id: 'five-star', name: 'Five-star evening', detail: 'Earn a five-star review.', check: (s) => s.bookings.some((b) => b.review === 5) },
  { id: 'safety-first', name: 'Safety first', detail: 'Decline three screened high-risk leads.', check: (s) => s.declinedUnsafe >= 3 },
  { id: 'safe-exit', name: 'Knew when to leave', detail: 'Use a safe exit to end a date.', check: (s) => s.bookings.some((b) => b.safeExit) },
  { id: 'regulars', name: 'Familiar faces', detail: 'Build a circle of three regular clients.', check: (s) => s.clients.filter((c) => c.regular && !c.blacklisted).length >= 3 },
  { id: 'mastery', name: 'Mastery', detail: 'Raise any skill to level 8.', check: (s) => Object.values(s.skills).some((k) => k.level >= SKILL_CAP) },
  { id: 'balanced', name: 'Sustainable pace', detail: 'Start five days in a row with stress under 35 and health over 70.', check: (s) => (s.stats?.bestBalancedStreak ?? 0) >= 5 },
  { id: 'gallery', name: 'Gallery regular', detail: 'Complete three dates at Lantern Gallery.', check: (s) => s.bookings.filter((b) => b.status === 'completed' && !b.safeExit && b.venueId === 'gallery').length >= 3 },
  { id: 'collective', name: 'Stronger together', detail: 'Join Harborlight Collective and mentor three newcomers.', check: (s) => (s.collective?.mentored ?? 0) >= 3 },
  { id: 'regions', name: 'Three cities', detail: 'Complete a date in every region.', check: (s) => (s.stats?.regionsWorked?.length ?? 0) >= 3 },
  { id: 'reliable', name: 'Reliable professional', detail: 'Complete ten dates without missing a booking.', check: (s) => s.completedDates >= 10 && !s.bookings.some((b) => b.status === 'missed') },
  { id: 'savings', name: 'Financial independence', detail: 'Reach the savings goal.', check: (s) => !!s.flags.goalReached },
];

export const TUTORIAL = [
  {
    title: 'Move through the city',
    copy: {
      keyboard: 'Click the ground or use WASD. Major care, training, travel, and meeting actions are completed through your character.',
      gamepad: 'Walk with the left stick and press A at a doorway. Major care, training, travel, and meeting actions are completed through your character.',
      touch: 'Tap the ground or a building to walk there. Major care, training, travel, and meeting actions are completed through your character.',
    },
  },
  {
    title: 'Screen before committing',
    copy: {
      keyboard: 'Open Leads on the business phone (Q). Screening reveals reliability signals and gives you better information for pricing and boundaries.',
      gamepad: 'Open the business phone with Y. Screening reveals reliability signals and gives you better information for pricing and boundaries.',
      touch: 'Open Leads on the business phone. Screening reveals reliability signals and gives you better information for pricing and boundaries.',
    },
  },
  {
    title: 'Prepare and arrive on time',
    copy: {
      keyboard: 'Accepted bookings appear in Calendar. Set one as your objective (G walks you there), manage your energy, and travel to its venue.',
      gamepad: 'Accepted bookings appear in Calendar. Set one as your objective (X walks you there), manage your energy, and travel to its venue.',
      touch: 'Accepted bookings appear in Calendar. Set one as your objective (Go walks you there), manage your energy, and travel to its venue.',
    },
  },
  {
    title: 'Build a sustainable career',
    copy: {
      keyboard: 'Strong dates improve reviews and fees, but visibility can also raise exposure. Balance income, safety, health, stress, and privacy.',
      gamepad: 'Strong dates improve reviews and fees, but visibility can also raise exposure. Balance income, safety, health, stress, and privacy.',
      touch: 'Strong dates improve reviews and fees, but visibility can also raise exposure. Balance income, safety, health, stress, and privacy.',
    },
  },
];
