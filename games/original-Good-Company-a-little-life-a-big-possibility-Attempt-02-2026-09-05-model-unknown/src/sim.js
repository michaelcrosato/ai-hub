/* Good Company: deterministic simulation, independent of the renderer and DOM.
   All currency, permits and regional rules are fictional game mechanics. */

export const VERSION = 1;
export const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v);
export const money = (v) => (Math.round(v) < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
export const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

export const REGIONS = {
  meadow: { id: 'meadow', name: 'Meadow Bay', tagline: 'Slow mornings. Familiar faces.', demand: 1, rent: 45, risk: 6, permit: 0, color: '#e0eacb', market: 'Relaxed, everyday company', description: 'A gentle place to begin. Affordable living, steady requests, and easygoing public venues.' },
  arts: { id: 'arts', name: 'Arts Quarter', tagline: 'Find your people. Find your rhythm.', demand: 1.28, rent: 68, risk: 10, permit: 90, color: '#ecdfe7', market: 'Creative dates, higher expectations', description: 'Better budgets and a lively creative scene. A fictional city business permit is required.' },
  coast: { id: 'coast', name: 'Lumen Coast', tagline: 'Big horizons. Bigger expectations.', demand: 1.6, rent: 95, risk: 17, permit: 150, color: '#f5e7c7', market: 'Premium budgets, more overhead', description: 'A bustling resort market. Higher living costs and privacy pressure reward careful planning.' },
};

export const MODELS = {
  independent: { id: 'independent', name: 'Independent', fee: 0, daily: 0, safety: 0, leads: 0, description: 'Your clients, your schedule, your income. Handle screening and check-ins yourself.' },
  supported: { id: 'supported', name: 'Trusted support', fee: 0, daily: 25, safety: 20, leads: 0, description: 'A driver and check-in partner. Keep your independence, reduce pressure, and screen for half the cost.' },
  collective: { id: 'collective', name: 'Agency collective', fee: 0.22, daily: 0, safety: 28, leads: 2, description: 'Screening included, two extra daily leads, and a support contact. The agency takes 22% of completed-date revenue.' },
};

/* x/z is where you stand to use a venue; label is where its map label floats.
   `opens` (minutes) keeps an evening-only venue closed earlier in the day. */
export const VENUES = {
  home: { name: 'Your little home', short: 'Home', icon: 'home', x: -13, z: -5.5, label: [-13, 5.5, -10], activities: ['rest', 'freshen', 'friend', 'sleep'] },
  cafe: { name: 'Bloom Café', short: 'Bloom Café', icon: 'coffee', x: -13, z: 4.4, label: [-13, 4.9, 8], activities: ['meal', 'coffee'] },
  gallery: { name: 'The Sunday Gallery', short: 'Sunday Gallery', icon: 'art', x: -3, z: 4.4, label: [-3, 4.9, 8], activities: ['conversation'] },
  lounge: { name: 'The Marigold', short: 'The Marigold', icon: 'sparkles', x: 10.5, z: 4.4, label: [10.5, 6.0, 8], activities: ['network'] },
  studio: { name: 'Little Light Studio', short: 'Little Light', icon: 'camera', x: 10.7, z: -6.2, label: [10.7, 4.6, -10], activities: ['photos', 'campaign'] },
  wellness: { name: 'Well & Co.', short: 'Well & Co.', icon: 'leaf', x: -3, z: -6.2, label: [-3, 4.5, -10], activities: ['wellness', 'negotiation'] },
  park: { name: 'Willow Green', short: 'Willow Green', icon: 'tree', x: 10.4, z: 0.9, label: [7.5, 0.4, 1.7], activities: ['unwind', 'walkfriend'] },
  barge: { name: 'The Lantern Barge', short: 'Lantern Barge', icon: 'music', x: 15.3, z: 7, label: [18.1, 2.5, 7], activities: ['openmic', 'sunset'], opens: 1020 },
};
/** Venues a client can be met at. */
export const DATE_VENUES = ['cafe', 'gallery', 'lounge', 'park', 'barge'];

export const ACTIVITIES = {
  rest: { name: 'A quiet hour', text: 'Put your feet up. The inbox can wait.', time: 60, cost: 0, effect: { energy: 28, calm: 15, health: 4 }, icon: 'moon' },
  freshen: { name: 'Freshen up', text: 'A shower, a clean outfit, a fresh start.', time: 30, cost: 0, effect: { style: 32, calm: 5 }, icon: 'sparkles' },
  friend: { name: 'Call Jamie', text: 'Make a little room for your personal life.', time: 30, cost: 0, effect: { connection: 20, calm: 10 }, icon: 'heart' },
  sleep: { name: 'Turn in for the night', text: 'Close the books, cover expenses, and greet a new day.', time: 0, cost: 0, effect: {}, icon: 'moon' },
  meal: { name: 'Something nourishing', text: 'A proper meal on the café terrace.', time: 40, cost: 18, effect: { hunger: 45, energy: 8, health: 3 }, icon: 'coffee' },
  coffee: { name: 'A little pick-me-up', text: 'One good coffee. Not a replacement for sleep.', time: 20, cost: 8, effect: { energy: 13, calm: -3 }, icon: 'coffee' },
  conversation: { name: 'Conversation workshop', text: 'Practice listening and talking about art.', time: 75, cost: 55, effect: { calm: 5 }, skill: 'conversation', icon: 'chat' },
  negotiation: { name: 'Business coaching', text: 'Build confidence in your pricing and your boundaries.', time: 75, cost: 60, effect: { calm: 8 }, skill: 'negotiation', icon: 'briefcase' },
  network: { name: 'Meet the neighborhood', text: 'Make a professional connection and get a fresh referral.', time: 60, cost: 25, effect: { calm: -3, connection: 6 }, leads: 1, icon: 'people' },
  photos: { name: 'Refresh your portfolio', text: 'A brighter profile. More reach, a little less privacy.', time: 90, cost: 80, effect: { style: 15, privacy: -8 }, followers: 75, boost: 3, leads: 2, icon: 'camera' },
  campaign: { name: 'Share your story', text: 'Run a small campaign for your companionship business.', time: 45, cost: 40, effect: { privacy: -5 }, followers: 35, boost: 2, leads: 1, icon: 'megaphone' },
  wellness: { name: 'A wellbeing appointment', text: 'Take care of your health and check in with yourself.', time: 60, cost: 45, effect: { health: 28, calm: 16 }, icon: 'leaf' },
  unwind: { name: 'Take the scenic route', text: 'A little fresh air, without an agenda.', time: 45, cost: 0, effect: { calm: 24, energy: 5, health: 5 }, icon: 'tree' },
  walkfriend: { name: 'A walk with Jamie', text: 'Quality time that has nothing to do with work.', time: 75, cost: 0, effect: { connection: 28, calm: 17, energy: -5 }, icon: 'heart' },
  // The Lantern Barge (evenings only).
  openmic: { name: 'Open mic on the water', text: 'Sing, read a poem, or simply listen. Everyone gets a turn.', time: 60, cost: 12, effect: { calm: 12, connection: 10, style: -4 }, followers: 20, after: 1020, icon: 'music' },
  sunset: { name: 'A sunset cruise with Jamie', text: 'Lanterns, slow water, and nowhere to be.', time: 90, cost: 30, effect: { connection: 30, calm: 20, energy: -6 }, after: 1080, icon: 'heart' },
};

export const PEOPLE = [
  { id: 'noah', name: 'Noah Park', age: 29, pronouns: 'he / him', job: 'Product designer', interests: ['art', 'travel'], kind: 'Coffee & conversation', venue: 'cafe', duration: 60, budget: 155, skin: '#d6a478', hair: '#3d3931', outfit: '#a8b7a0', bg: '#e1e8d8', note: '“New in town. Know somewhere with good coffee?”', style: 'Thoughtful', risk: 0 },
  { id: 'maya', name: 'Maya Bennett', age: 32, pronouns: 'she / her', job: 'Architect', interests: ['design', 'outdoors'], kind: 'An afternoon of art', venue: 'gallery', duration: 90, budget: 205, skin: '#a56e4f', hair: '#3c2d29', outfit: '#d2a283', bg: '#f0e0d0', note: '“An art show, an unhurried walk, good company.”', style: 'Creative', risk: 0 },
  { id: 'theo', name: 'Theo Ellis', age: 35, pronouns: 'he / him', job: 'Restaurant owner', interests: ['food', 'music'], kind: 'Dinner & a good story', venue: 'lounge', duration: 90, budget: 240, skin: '#e1bb93', hair: '#6a4d36', outfit: '#c5b19a', bg: '#ece5d9', note: '“A night off. I promise not to critique the menu.”', style: 'Easygoing', risk: 0 },
  { id: 'jordan', name: 'Jordan Rivera', age: 28, pronouns: 'they / them', job: 'Music producer', interests: ['music', 'film'], kind: 'A walk by the water', venue: 'park', duration: 60, budget: 140, skin: '#b4805a', hair: '#262b2a', outfit: '#9fa8bc', bg: '#e3e3ee', note: '“Could we keep chatting on your personal number?”', style: 'Outgoing', risk: 1 },
  { id: 'sana', name: 'Sana Okafor', age: 34, pronouns: 'she / her', job: 'Researcher', interests: ['books', 'travel'], kind: 'Coffee & conversation', venue: 'cafe', duration: 60, budget: 175, skin: '#845236', hair: '#332724', outfit: '#b2b786', bg: '#e6e9d6', note: '“Tell me about the last book you couldn’t put down.”', style: 'Curious', risk: 0 },
  { id: 'elliot', name: 'Elliot Chen', age: 31, pronouns: 'they / them', job: 'Photographer', interests: ['art', 'outdoors'], kind: 'An afternoon of art', venue: 'gallery', duration: 90, budget: 195, skin: '#d5b083', hair: '#393730', outfit: '#95b7aa', bg: '#dce9df', note: '“Let’s find the little things everyone walks past.”', style: 'Creative', risk: 0 },
  { id: 'remy', name: 'Remy Laurent', age: 41, pronouns: 'he / him', job: 'Consultant', interests: ['food', 'travel'], kind: 'Dinner & a good story', venue: 'lounge', duration: 90, budget: 270, skin: '#d9ac87', hair: '#66594c', outfit: '#9ca8b4', bg: '#e2e8eb', note: '“Can we change the agreed location at the last minute?”', style: 'Particular', risk: 2 },
  { id: 'avery', name: 'Avery Brooks', age: 30, pronouns: 'she / her', job: 'Landscape designer', interests: ['outdoors', 'design'], kind: 'A walk by the water', venue: 'park', duration: 60, budget: 160, skin: '#e1b998', hair: '#854e30', outfit: '#c6af8c', bg: '#ebe5d9', note: '“Fresh air and someone who enjoys a slow afternoon.”', style: 'Grounded', risk: 0 },
  // New faces who love the Lantern Barge.
  { id: 'ines', name: 'Inès Moreau', age: 33, pronouns: 'she / her', job: 'Cellist', interests: ['music', 'travel'], kind: 'Music on the water', venue: 'barge', duration: 90, budget: 225, skin: '#e0b48f', hair: '#2f2622', outfit: '#b69bb0', bg: '#eee2ea', note: '“There’s a string quartet on the canal tonight. Come listen with me?”', style: 'Warm', risk: 0 },
  { id: 'kofi', name: 'Kofi Mensah', age: 38, pronouns: 'he / him', job: 'Ferry captain', interests: ['outdoors', 'food'], kind: 'Music on the water', venue: 'barge', duration: 60, budget: 170, skin: '#6e4631', hair: '#1f1a17', outfit: '#8fb0b6', bg: '#dde9ea', note: '“I spend all day on boats. Show me the fun one.”', style: 'Cheerful', risk: 0 },
  { id: 'dana', name: 'Dana Whitlock', age: 45, pronouns: 'they / them', job: 'Tech investor', interests: ['design', 'books'], kind: 'Dinner & a good story', venue: 'lounge', duration: 90, budget: 310, skin: '#f0cfae', hair: '#8a8580', outfit: '#9aa39a', bg: '#e6e8e1', note: '“Could we skip the booking app and just text directly?”', style: 'Direct', risk: 1 },
];

export const EVENTS = [
  { name: 'Market day', description: 'The neighborhood is buzzing. Client budgets +12%.', demand: 1.12, icon: 'sun' },
  { name: 'A slower kind of day', description: 'A good day to rest, learn, or reconnect.', demand: 0.94, icon: 'leaf' },
  { name: 'Gallery late night', description: 'Creative energy is in the air. Client budgets +18%.', demand: 1.18, icon: 'art' },
  { name: 'A little coastal breeze', description: 'Steady requests and a little room to breathe.', demand: 1, icon: 'sun' },
  { name: 'Festival weekend', description: 'Visitors in town. Client budgets +25%.', demand: 1.25, icon: 'sparkles' },
  { name: 'Community afternoon', description: 'Familiar faces. A good day for your regulars.', demand: 1.08, icon: 'people' },
  { name: 'Sunday reset', description: 'A quieter market. Look after yourself, too.', demand: 0.91, icon: 'leaf' },
];

/* Life chapters: longer goals after the first milestone. progress(s) → [value, target]. */
export const GOALS = [
  { id: 'first', name: 'A sustainable beginning', text: 'Complete 6 dates, save $1,600, and keep calm above 50.', progress: (s) => [s.flags.goal ? 1 : 0, 1], reward: null, rewardText: 'Your first chapter' },
  { id: 'regulars', name: 'Familiar faces', text: 'Welcome back three regulars, with two or more dates each.', progress: (s) => [Object.values(s.contacts).filter((c) => c.visits >= 2).length, 3], reward: { skillPoints: 1 }, rewardText: '+1 skill point' },
  { id: 'glowing', name: 'A glowing review', text: 'Earn a review of 4.8 stars or more.', progress: (s) => [s.stats.bestRating >= 4.8 ? 1 : 0, 1], reward: { money: 120 }, rewardText: '$120 referral bonus' },
  { id: 'boundaries', name: 'Clear and kind', text: 'Hold a boundary gracefully on two dates.', progress: (s) => [s.stats.boundaries, 2], reward: { calm: 15, privacy: 10 }, rewardText: '+15 calm · +10 privacy' },
  { id: 'rested', name: 'A life, not just a job', text: 'Turn in on three nights with energy, calm, and connection all at 60 or more.', progress: (s) => [s.stats.wellDays, 3], reward: { skillPoints: 1 }, rewardText: '+1 skill point' },
  { id: 'barge', name: 'Music on the water', text: 'Complete two dates at The Lantern Barge.', progress: (s) => [s.stats.bargeDates, 2], reward: { followers: 60 }, rewardText: '+60 reach' },
  { id: 'reach', name: 'Word gets around', text: 'Grow your reach to 400 people.', progress: (s) => [s.followers, 400], reward: { money: 150 }, rewardText: '$150 sponsorship' },
  { id: 'master', name: 'Quietly brilliant', text: 'Master any skill at level 5.', progress: (s) => [Math.max(...Object.values(s.skills)), 5], reward: { followers: 50, calm: 10 }, rewardText: '+50 reach · +10 calm' },
  { id: 'traveler', name: 'A change of scenery', text: 'Make a home in all three regions.', progress: (s) => [s.stats.regions.length, 3], reward: { money: 200 }, rewardText: '$200 welcome gift' },
  { id: 'studio', name: 'A place of your own', text: 'Open the community studio.', progress: (s) => [s.flags.agency ? 1 : 0, 1], reward: { skillPoints: 1 }, rewardText: '+1 skill point' },
  {
    id: 'wellLived',
    name: 'Good company',
    text: 'Complete 20 dates with a reputation of 4.5 or more, and finish four other chapters.',
    progress: (s) => [s.completed >= 20 && s.reputation >= 4.5 && Object.keys(s.goals).filter((k) => k !== 'wellLived').length >= 4 ? 20 : Math.min(19, s.completed), 20],
    reward: { money: 500 },
    rewardText: 'The final chapter · $500',
    final: true,
  },
];

export const PERSON = (id) => PEOPLE.find((p) => p.id === id);

export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuleError';
  }
}
const requireRule = (ok, message) => {
  if (!ok) throw new RuleError(message);
};

const freshStats = (region = 'meadow') => ({ bestRating: 0, bargeDates: 0, boundaries: 0, wellDays: 0, regions: [region] });

export function freshState() {
  return {
    version: VERSION, day: 1, minute: 570, money: 680, reputation: 4.3, reviews: 3,
    energy: 86, calm: 82, health: 91, style: 78, hunger: 79, connection: 72, privacy: 90,
    followers: 128, baseRate: 120, region: 'meadow', model: 'independent', campaignUntil: 0, permitUntil: 0, xp: 0, level: 1, skillPoints: 0,
    skills: { conversation: 1, negotiation: 1, screening: 1, marketing: 1 },
    avatar: { name: 'Alex Morgan', age: 27, pronouns: 'they / them', skin: '#cc946b', hair: '#50392c', outfit: '#dc987b', background: 'fresh', customized: false, x: -8, z: -3.7 },
    rng: 470197, nextId: 1, requests: [], bookings: [], contacts: {}, ledger: [], journal: [], completed: 0, tips: 0, activeDate: null,
    settings: { speed: 1, reducedMotion: false, sound: true },
    flags: { goal: false, supportGrant: false, agency: false, tutorial: 0, ending: false },
    totalEarned: 0,
    goals: {},
    stats: freshStats(),
  };
}

export class Game {
  constructor(state) {
    this.state = state ? Game.validate(state) : freshState();
    if (!state) {
      this.generateRequests(3, true);
      this.log('A new beginning in Meadow Bay. Your first requests are waiting.');
    }
  }
  get s() {
    return this.state;
  }
  random() {
    let x = this.s.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s.rng = x >>> 0;
    return this.s.rng / 4294967296;
  }
  id(prefix) {
    return `${prefix}-${this.s.nextId++}`;
  }
  event() {
    return EVENTS[(this.s.day - 1) % EVENTS.length];
  }
  region() {
    return REGIONS[this.s.region];
  }
  model() {
    return MODELS[this.s.model];
  }
  log(message) {
    this.s.journal.unshift({ day: this.s.day, time: round(this.s.minute), message });
    this.s.journal = this.s.journal.slice(0, 100);
  }
  transact(amount, label) {
    amount = round(amount);
    this.s.money += amount;
    this.s.ledger.unshift({ id: this.id('tx'), day: this.s.day, time: round(this.s.minute), amount, label });
    this.s.ledger = this.s.ledger.slice(0, 180);
  }
  pay(amount, label) {
    requireRule(this.s.money >= amount, `You need ${money(amount)} for this. Try a free activity or a lower-cost plan.`);
    this.transact(-amount, label);
  }
  effect(values) {
    for (const [key, value] of Object.entries(values)) this.s[key] = clamp(this.s[key] + value);
  }
  contact(id) {
    return this.s.contacts[id] || (this.s.contacts[id] = { visits: 0, favorite: false, blocked: false, notes: '', lastRating: 0 });
  }
  request(id) {
    const r = this.s.requests.find((r) => r.id === id);
    requireRule(r, 'That request is no longer available.');
    return r;
  }
  booking(id) {
    const b = this.s.bookings.find((b) => b.id === id);
    requireRule(b, 'This booking could not be found.');
    return b;
  }
  /** A client with a booking still ahead (today or tomorrow) does not send a second request. */
  hasUpcoming(personId) {
    return this.s.bookings.some((b) => b.person === personId && b.day >= this.s.day && ['scheduled', 'active'].includes(b.status));
  }
  generateRequests(count = 3, starter = false) {
    const available = PEOPLE.filter((p) => !this.contact(p.id).blocked && !this.s.requests.some((r) => r.person === p.id) && !this.hasUpcoming(p.id));
    const chosen = starter
      ? available.slice(0, count)
      : available.sort((a, b) => {
          const fa = this.contact(a.id).favorite ? 1 : 0;
          const fb = this.contact(b.id).favorite ? 1 : 0;
          return fb - fa;
        });
    let added = 0;
    while (added < count && chosen.length) {
      const idx = starter ? 0 : Math.floor(this.random() * Math.min(chosen.length, 5));
      const p = chosen.splice(idx, 1)[0];
      const boost = this.s.campaignUntil >= this.s.day ? 1.08 : 1;
      const budget = round(p.budget * this.region().demand * this.event().demand * boost * (0.92 + this.random() * 0.16));
      this.s.requests.push({ id: this.id('req'), person: p.id, day: this.s.day, budget, screened: this.s.model === 'collective', counter: 0 });
      added++;
    }
    return added;
  }
  screeningCost() {
    return this.s.model === 'collective' ? 0 : this.s.model === 'supported' ? 4 : 8;
  }
  screen(id) {
    requireRule(!this.s.activeDate, 'Finish the current date first.');
    const r = this.request(id);
    requireRule(!r.screened, 'This request has already been screened.');
    requireRule(this.s.minute + 20 <= 1320, 'It is getting late. Start fresh tomorrow.');
    this.pay(this.screeningCost(), `Screening · ${PERSON(r.person).name}`);
    r.screened = true;
    this.advance(20);
    this.gainXP(7);
    this.s.flags.tutorial = Math.max(1, this.s.flags.tutorial);
    const p = PERSON(r.person);
    this.log(`Screened ${p.name}: ${p.risk ? 'a boundary question to discuss before booking.' : 'references checked; a public meeting agreed.'}`);
    return p.risk ? 'References checked. Discuss the flagged boundary before agreeing.' : 'References checked. Public venue confirmed. Looking promising.';
  }
  decline(id) {
    const r = this.request(id);
    this.s.requests = this.s.requests.filter((x) => x.id !== id);
    this.log(`Declined ${PERSON(r.person).name}’s request. No reputation penalty.`);
  }
  availability(day, start, duration) {
    return this.s.bookings.every((b) => b.day !== day || !['scheduled', 'active'].includes(b.status) || start >= b.start + b.duration + 20 || start + duration + 20 <= b.start);
  }
  offer(id, opts) {
    requireRule(!this.s.activeDate, 'Finish the current date first.');
    const r = this.request(id);
    const p = PERSON(r.person);
    const day = Number(opts.day);
    const start = Number(opts.start);
    const price = Number(opts.price);
    const venue = opts.venue;
    requireRule(Number.isFinite(price) && price >= 40 && price <= 1500, 'Set a total date fee between $40 and $1,500.');
    requireRule(Number.isInteger(day) && day >= this.s.day && day <= this.s.day + 1, 'Choose today or tomorrow.');
    requireRule(Number.isInteger(start) && start >= 600 && start + p.duration <= 1290, 'Choose a time between 10:00 and 21:30.');
    requireRule(day !== this.s.day || start >= this.s.minute + 15, 'Leave at least 15 minutes to get ready and travel.');
    requireRule(DATE_VENUES.includes(venue), 'Choose one of the public date venues.');
    requireRule(!VENUES[venue].opens || start >= VENUES[venue].opens, `${VENUES[venue].name} welcomes guests from ${clock(VENUES[venue].opens)}. Choose a later start.`);
    requireRule(this.availability(day, start, p.duration), 'That overlaps another booking, including a 20-minute travel buffer.');
    requireRule(opts.boundaries === true, 'Agree to professional boundaries and client consent before booking.');
    requireRule(!this.contact(p.id).blocked, 'This contact is blocked.');
    requireRule(this.region().permit === 0 || this.s.permitUntil >= day, 'This fictional region requires a current business permit. Arrange it in Business first.');
    const ceiling = round(r.budget * (1 + 0.045 * (this.s.skills.negotiation - 1) + 0.035 * Math.max(0, this.s.reputation - 4)));
    if (price > ceiling) {
      r.counter = Math.floor(ceiling / 5) * 5;
      return { accepted: false, counter: r.counter };
    }
    const deposit = opts.deposit ? round(price * 0.25) : 0;
    const b = { id: this.id('book'), person: p.id, day, start, duration: p.duration, price: round(price), venue, deposit, screened: r.screened, boundaries: true, status: 'scheduled', rating: 0, tip: 0 };
    this.s.bookings.push(b);
    this.s.requests = this.s.requests.filter((x) => x.id !== id);
    if (deposit) this.transact(deposit, `Booking deposit · ${p.name}`);
    this.s.flags.tutorial = Math.max(2, this.s.flags.tutorial);
    this.log(`Booked ${p.name} at ${VENUES[venue].name}, day ${day} at ${clock(start)}, for ${money(price)}.`);
    return { accepted: true, booking: b };
  }
  cancel(id, reason = 'cancelled') {
    const b = this.booking(id);
    requireRule(b.status === 'scheduled', 'Only upcoming bookings can be cancelled.');
    if (b.deposit) this.transact(-b.deposit, `Deposit refunded · ${PERSON(b.person).name}`);
    b.status = reason;
    this.log(`Booking with ${PERSON(b.person).name} ${reason}. Deposit returned; no reputation penalty.`);
  }
  advance(minutes) {
    requireRule(Number.isFinite(minutes) && minutes >= 0, 'Time must move forward.');
    const elapsed = Math.min(minutes, 1320 - this.s.minute);
    if (elapsed <= 0) return;
    this.s.minute += elapsed;
    this.effect({ energy: -elapsed * 0.014, hunger: -elapsed * 0.035, style: -elapsed * 0.012, calm: -elapsed * 0.005 });
    if (this.s.hunger < 20) this.effect({ energy: -elapsed * 0.02, health: -elapsed * 0.007 });
    if (this.s.connection < 25) this.effect({ calm: -elapsed * 0.015 });
    for (const b of this.s.bookings) {
      if (b.day === this.s.day && b.status === 'scheduled' && this.s.minute > b.start + 30) {
        b.status = 'missed';
        if (b.deposit) this.transact(-b.deposit, 'Missed booking · deposit refunded');
        this.s.reputation = Math.max(1, this.s.reputation - 0.08);
        this.log(`Missed ${PERSON(b.person).name}’s booking. Deposit refunded. Plan a little more travel time.`);
      }
    }
  }
  risk(booking) {
    const b = booking || { screened: true, person: 'noah' };
    return round(clamp(this.region().risk + (b.screened ? 0 : 18) + PERSON(b.person).risk * 13 + (this.s.energy < 30 ? 12 : 0) + (this.s.privacy < 30 ? 10 : 0) - this.model().safety - (this.s.skills.screening - 1) * 3));
  }
  startDate(id) {
    requireRule(!this.s.activeDate, 'You are already on a date.');
    const b = this.booking(id);
    const p = PERSON(b.person);
    const v = VENUES[b.venue];
    requireRule(b.status === 'scheduled' && b.day === this.s.day, 'This date is not scheduled for today.');
    requireRule(Math.hypot(this.s.avatar.x - v.x, this.s.avatar.z - v.z) <= 3.5, 'Walk to the agreed venue to meet your client.');
    requireRule(this.s.minute <= b.start + 30, 'That appointment has already passed.');
    requireRule(this.s.energy >= 12, 'You need a little rest before starting a date.');
    if (this.s.minute < b.start) this.advance(b.start - this.s.minute);
    b.status = 'active';
    if (!b.screened && !b.deposit && p.risk >= 2) {
      b.status = 'no-show';
      this.effect({ calm: -4 });
      this.log(`${p.name} did not arrive. Screening and a deposit help avoid no-shows.`);
      return { noShow: true };
    }
    // Meeting a client where they asked to go starts the date on a warmer note.
    const venueFit = b.venue === p.venue ? 4 : -2;
    const rapport = clamp(48 - this.risk(b) * 0.08 - (this.s.health < 35 ? 7 : 0) + this.s.skills.conversation * 4 + (this.s.energy - 50) * 0.12 + (this.s.style - 50) * 0.1 - (this.s.calm < 30 ? 8 : 0) + venueFit, 25, 75);
    this.s.activeDate = { bookingId: id, round: 0, rapport, feedback: '', answers: [], boundaryKept: true, initialMinute: this.s.minute };
    this.log(`Met ${p.name} at ${v.name}.`);
    return { noShow: false };
  }
  datePrompt() {
    const d = this.s.activeDate;
    requireRule(d, 'There is no date in progress.');
    const b = this.booking(d.bookingId);
    const p = PERSON(b.person);
    const interest = p.interests[0];
    if (d.round === 0) {
      const topics = {
        art: ['Ask which piece they would take home.', 'They light up describing a painting they love.'],
        design: ['Ask what makes a place feel like home.', 'You find common ground in thoughtful design.'],
        food: ['Ask about their favorite small restaurant.', 'Food stories turn out to be a perfect icebreaker.'],
        music: ['Ask which song they have on repeat.', 'One song leads to a whole conversation.'],
        books: ['Ask about the book they keep recommending.', 'They are glad you are genuinely interested.'],
        outdoors: ['Ask about their favorite hidden walking trail.', 'You swap little places worth discovering.'],
      };
      return {
        title: 'A good first impression',
        text: `${p.name.split(' ')[0]} settles in. “It’s nice to have time for something other than work.” What do you say?`,
        choices: [
          { text: topics[interest][0], score: 18, feedback: topics[interest][1], effect: { calm: 2 } },
          { text: 'Ask how they would like to spend your time together.', score: 14, feedback: 'A thoughtful check-in makes the conversation feel easy.', effect: { calm: 2 } },
          { text: 'Jump straight into a long story about yourself.', score: -8, feedback: 'The conversation feels a little one-sided. There is still time to listen.' },
        ],
      };
    }
    if (d.round === 1 && p.risk > 0) {
      return {
        title: 'Your time. Your boundaries.',
        text: p.risk === 1 ? 'They ask for your personal number instead of using your work profile. You agreed to keep the two separate.' : 'They suggest abandoning the agreed public venue for a private meeting. This is outside your agreed terms.',
        choices: [
          { text: p.risk === 1 ? 'Kindly keep contact on the work profile.' : 'Keep the date at the agreed public venue.', score: 13, feedback: 'You restate the agreement clearly. Your boundary is respected.', effect: { calm: 5, privacy: 3 }, boundary: true },
          { text: 'Pause and contact your support person before continuing.', score: 8, feedback: 'Taking a moment for support helps you feel grounded.', effect: { calm: 8 }, boundary: true },
          { text: 'End the date safely. A good fit matters.', exit: true, feedback: 'You leave on your own terms. Your time is paid proportionately; no reputation penalty.' },
        ],
      };
    }
    if (d.round === 1 && b.venue === 'barge') {
      return {
        title: 'Music on the water',
        text: 'The barge rocks gently as the quartet begins. Lantern light on the canal. Your client goes quiet, listening.',
        choices: [
          { text: 'Listen together, and save the conversation for the break.', score: 17, feedback: 'A shared silence can say a lot. They squeeze in a grateful smile.', effect: { calm: 6 } },
          { text: 'Whisper a question about the piece.', score: 9, feedback: 'They whisper back a little story about the composer.' },
          { text: 'Keep chatting over the music.', score: -9, feedback: 'A few heads turn. The moment slips away a little.', effect: { calm: -3 } },
        ],
      };
    }
    if (d.round === 1) {
      return {
        title: 'Read the room',
        text: 'A nearby group gets a little loud. Your client looks distracted. There is no need to rush the moment.',
        choices: [
          { text: 'Ask whether they would prefer a quieter spot nearby.', score: 16, feedback: 'They appreciate being asked rather than having the choice made for them.', effect: { calm: 3 } },
          { text: 'Offer a brief pause and a fresh topic.', score: 10, feedback: 'A little breathing room gets the conversation flowing again.' },
          { text: 'Ignore it and keep talking over the noise.', score: -9, feedback: 'It becomes harder to connect. Their comfort deserved a check-in.', effect: { calm: -3 } },
        ],
      };
    }
    return {
      title: 'Leave a little warmth',
      text: 'Your time together is coming to a close. How do you finish the date?',
      choices: [
        { text: `Mention something you enjoyed about their love of ${interest}.`, score: 17, feedback: 'Remembering the little things makes the goodbye feel personal, not rehearsed.', effect: { calm: 3 } },
        { text: 'Thank them, confirm the bill, and leave room for a future booking.', score: 12, feedback: 'Warm, clear, and professional. A good ending to the day.' },
        { text: 'Push for an immediate rebooking before saying goodbye.', score: -10, feedback: 'The hard sell takes a little warmth out of the goodbye.', effect: { calm: -2 } },
      ],
    };
  }
  dateChoice(index) {
    const d = this.s.activeDate;
    requireRule(d && Number.isInteger(index), 'Choose an available response.');
    const choice = this.datePrompt().choices[index];
    requireRule(choice, 'That response is not available.');
    if (choice.exit) {
      this.s.stats.boundaries++;
      return { done: true, result: this.finishDate(true) };
    }
    d.rapport = clamp(d.rapport + choice.score);
    d.feedback = choice.feedback;
    d.answers.push(index);
    d.round++;
    if (choice.boundary) this.s.stats.boundaries++;
    if (choice.effect) this.effect(choice.effect);
    if (d.round >= 3) return { done: true, result: this.finishDate(false) };
    return { done: false, feedback: choice.feedback };
  }
  finishDate(early = false) {
    const d = this.s.activeDate;
    requireRule(d, 'There is no date to finish.');
    const b = this.booking(d.bookingId);
    const p = PERSON(b.person);
    const contact = this.contact(p.id);
    const fraction = early ? Math.max(0.25, d.round / 3) : 1;
    const earned = round(b.price * fraction);
    const tip = early ? 0 : round(b.price * Math.max(0, (d.rapport - 60) / 250));
    const commission = round((earned + tip) * this.model().fee);
    const gross = earned + tip;
    const remaining = gross - b.deposit - commission;
    this.transact(remaining, `${early ? 'Early finish' : 'Date payment'} · ${p.name}${commission ? ` (agency fee ${money(commission)})` : ''}`);
    b.status = early ? 'ended' : 'completed';
    b.tip = tip;
    b.rating = early ? 0 : Math.round(clamp(2.9 + d.rapport * 0.021, 2.5, 5) * 10) / 10;
    b.earned = gross - commission;
    b.commission = commission;
    this.s.totalEarned += gross - commission;
    this.s.tips += tip;
    if (!early) {
      this.s.reputation = (this.s.reputation * this.s.reviews + b.rating) / (this.s.reviews + 1);
      this.s.reviews++;
      this.s.completed++;
      contact.visits++;
      contact.lastRating = b.rating;
      this.s.followers += round(3 + b.rating);
      this.s.stats.bestRating = Math.max(this.s.stats.bestRating, b.rating);
      if (b.venue === 'barge') this.s.stats.bargeDates++;
    }
    this.effect({ energy: -16 * fraction - b.duration * 0.035, calm: early ? 5 : (d.rapport >= 75 ? 4 : -5) - this.risk(b) * 0.18, hunger: -5, style: -5, privacy: b.screened ? 0 : -3 });
    this.gainXP(early ? 15 : 35 + (b.rating >= 4.5 ? 10 : 0));
    this.s.flags.tutorial = Math.max(3, this.s.flags.tutorial);
    this.s.activeDate = null;
    this.advance(Math.min(b.duration * fraction, 1320 - this.s.minute));
    this.log(`${early ? 'Safely ended' : 'Completed'} a date with ${p.name}. ${money(gross - commission)} earned${early ? '; no reputation penalty.' : ` · ${b.rating.toFixed(1)} stars.`}`);
    const result = { person: p.id, early, rating: b.rating, gross, tip, commission, deposit: b.deposit, received: remaining, net: gross - commission, rapport: round(d.rapport), feedback: d.feedback, goal: false };
    if (!this.s.flags.goal && this.s.completed >= 6 && this.s.money >= 1600 && this.s.calm >= 50) {
      this.s.flags.goal = true;
      result.goal = true;
      this.log('Milestone reached: a sustainable beginning. Keep growing, or choose your next chapter.');
    }
    return result;
  }
  gainXP(amount) {
    this.s.xp += amount;
    while (this.s.xp >= 100) {
      this.s.xp -= 100;
      this.s.level++;
      this.s.skillPoints++;
      this.log(`Level ${this.s.level}. You have a skill point to invest.`);
    }
  }
  upgrade(skill) {
    requireRule(Object.hasOwn(this.s.skills, skill), 'Choose an available skill.');
    requireRule(this.s.skillPoints > 0, 'Earn a skill point by completing dates.');
    requireRule(this.s.skills[skill] < 5, 'This skill is already at its maximum.');
    this.s.skills[skill]++;
    this.s.skillPoints--;
    this.log(`Improved ${skill} to level ${this.s.skills[skill]}.`);
  }
  activity(id) {
    const a = ACTIVITIES[id];
    requireRule(Object.hasOwn(ACTIVITIES, id) && id !== 'sleep', 'Choose an available activity.');
    requireRule(!this.s.activeDate, 'Finish or safely end your date first.');
    requireRule(!a.after || this.s.minute >= a.after, `${a.name} starts at ${clock(a.after)}. Come back this evening.`);
    requireRule(this.s.minute + a.time <= 1320, 'Not enough time before 22:00. Turn in and start tomorrow.');
    if (a.skill) requireRule(this.s.skills[a.skill] < 5, 'You have mastered this skill.');
    this.pay(a.cost, a.name);
    this.advance(a.time);
    this.effect(a.effect);
    if (a.skill) this.s.skills[a.skill]++;
    if (a.followers) this.s.followers += round(a.followers * (1 + 0.15 * (this.s.skills.marketing - 1)));
    if (a.boost) this.s.campaignUntil = Math.max(this.s.campaignUntil, this.s.day + a.boost);
    if (a.leads) this.generateRequests(a.leads + (this.s.skills.marketing >= 3 ? 1 : 0));
    this.gainXP(a.skill ? 15 : 4);
    this.log(`${a.name}. ${a.cost ? money(a.cost) + ' invested.' : 'A little time, well spent.'}`);
    return a;
  }
  setModel(id) {
    requireRule(Object.hasOwn(MODELS, id), 'Choose an available business structure.');
    requireRule(!this.s.activeDate, 'Finish your current date before changing structure.');
    requireRule(id !== this.s.model, 'This is already your current structure.');
    this.s.model = id;
    if (id === 'collective') {
      this.s.requests.forEach((r) => (r.screened = true));
      this.generateRequests(2);
    }
    this.log(`Now working ${id === 'independent' ? 'independently' : 'with ' + MODELS[id].name.toLowerCase()}.`);
  }
  permit() {
    requireRule(this.region().permit > 0, 'No permit is required in this fictional region.');
    requireRule(this.s.permitUntil < this.s.day + 7, 'Your current permit already covers the next seven days.');
    this.pay(this.region().permit, 'Fictional city permit · 7 days');
    this.s.permitUntil = this.s.day + 6;
    this.log(`Business permit current through day ${this.s.permitUntil}.`);
  }
  /** The move home to Meadow Bay is free when you cannot afford it, so a lapsed permit never strands you. */
  moveCost(id) {
    const cost = 100 + REGIONS[id].permit;
    return id === 'meadow' && this.s.money < cost ? 0 : cost;
  }
  moveRegion(id) {
    requireRule(Object.hasOwn(REGIONS, id) && id !== this.s.region, 'Choose a different region.');
    requireRule(!this.s.activeDate, 'Finish your date before moving.');
    requireRule(!this.s.bookings.some((b) => b.status === 'scheduled'), 'Complete or cancel your upcoming bookings before moving.');
    requireRule(this.s.minute + 60 <= 1320, 'Move tomorrow; there is not enough time left today.');
    const cost = this.moveCost(id);
    if (cost) this.pay(cost, `Move to ${REGIONS[id].name}${REGIONS[id].permit ? ' · permit included' : ''}`);
    else this.log('Jamie borrowed a van and helped you move home for free.');
    this.s.region = id;
    this.s.permitUntil = REGIONS[id].permit ? this.s.day + 6 : 0;
    this.s.requests = [];
    this.advance(60);
    this.generateRequests(3 + this.model().leads);
    if (!this.s.stats.regions.includes(id)) this.s.stats.regions.push(id);
    this.s.avatar.x = -8;
    this.s.avatar.z = -3.7;
    this.log(`A new chapter in ${REGIONS[id].name}. Your old client notes are kept.`);
  }
  nextDay() {
    requireRule(!this.s.activeDate, 'Finish or safely end the current date first.');
    const wellRested = this.s.energy >= 60 && this.s.calm >= 60 && this.s.connection >= 60;
    if (wellRested) this.s.stats.wellDays++;
    const pending = this.s.bookings.filter((b) => b.day === this.s.day && b.status === 'scheduled');
    pending.forEach((b) => this.cancel(b.id, 'cancelled at day end'));
    const day = this.s.day;
    const costs = this.region().rent + this.model().daily;
    this.transact(-this.region().rent, 'Daily living costs');
    if (this.model().daily) this.transact(-this.model().daily, 'Trusted support · daily fee');
    if (this.s.flags.agency) this.transact(65, 'Community studio · workspace income');
    this.log(`Closed day ${day}. ${money(costs)} in living and support costs.`);
    this.s.day++;
    this.s.minute = 540;
    this.effect({ energy: 65, calm: 22, health: 5, style: -10, hunger: -18, connection: -9, privacy: 5 });
    if (this.s.campaignUntil < this.s.day) this.s.followers = Math.max(0, this.s.followers - 4);
    this.s.requests = [];
    this.generateRequests(3 + this.model().leads + (this.s.campaignUntil >= this.s.day ? 1 : 0));
    this.s.avatar.x = -13;
    this.s.avatar.z = -5.5;
    const summary = {
      day,
      costs,
      income: this.s.ledger.filter((t) => t.day === day).reduce((sum, t) => sum + t.amount, 0),
      completed: this.s.bookings.filter((b) => b.day === day && b.status === 'completed').length,
      grant: false,
      wellRested,
    };
    if (this.s.money < 80 && !this.s.flags.supportGrant) {
      this.transact(200, 'One-time community restart grant');
      this.s.flags.supportGrant = true;
      summary.grant = true;
      this.log('The community fund offered a one-time $200 restart grant.');
    }
    this.log(`Day ${this.s.day}: ${this.event().name.toLowerCase()}. A fresh inbox and another chance.`);
    return summary;
  }
  setContact(id, values) {
    requireRule(PERSON(id), 'Contact not found.');
    const c = this.contact(id);
    if (typeof values.favorite === 'boolean') c.favorite = values.favorite;
    if (typeof values.blocked === 'boolean') {
      c.blocked = values.blocked;
      if (c.blocked) {
        this.s.requests = this.s.requests.filter((r) => r.person !== id);
        this.s.bookings.filter((b) => b.person === id && b.status === 'scheduled').forEach((b) => this.cancel(b.id));
      }
    }
    if (typeof values.notes === 'string') c.notes = values.notes.slice(0, 600);
  }
  customize(values) {
    requireRule(typeof values.name === 'string' && values.name.trim().length > 0 && values.name.trim().length <= 30, 'Choose a name between 1 and 30 characters.');
    requireRule(Number.isInteger(Number(values.age)) && Number(values.age) >= 21 && Number(values.age) <= 75, 'Characters must be adults aged 21–75.');
    for (const k of ['skin', 'hair', 'outfit']) requireRule(/^#[0-9a-f]{6}$/i.test(values[k]), 'Choose a valid character color.');
    requireRule(['they / them', 'she / her', 'he / him'].includes(values.pronouns), 'Choose available pronouns.');
    if (!this.s.avatar.customized && this.s.completed === 0 && this.s.bookings.length === 0) {
      const bonuses = { fresh: ['screening', 1, 0], people: ['conversation', 1, -80], business: ['negotiation', 1, -80] };
      requireRule(bonuses[values.background], 'Choose an available background.');
      const [skill, amt, fee] = bonuses[values.background];
      this.s.skills[skill] += amt;
      if (fee) this.transact(fee, 'Starting training investment');
      this.s.avatar.background = values.background;
    }
    Object.assign(this.s.avatar, { name: values.name.trim(), age: Number(values.age), pronouns: values.pronouns, skin: values.skin, hair: values.hair, outfit: values.outfit, customized: true });
  }
  startAgency() {
    requireRule(!this.s.flags.agency, 'Your community studio is already open.');
    requireRule(this.s.completed >= 8 && this.s.reputation >= 4.5 && this.s.money >= 3000, 'Reach eight completed dates, 4.5 reputation, and $3,000 savings first.');
    this.pay(1800, 'Community studio launch');
    this.s.flags.agency = true;
    this.log('Opened a community studio. A new chapter: collaboration without giving up boundaries.');
  }
  goalProgress(goal) {
    const [value, target] = goal.progress(this.s);
    return { value: Math.min(value, target), target, done: Object.hasOwn(this.s.goals, goal.id) };
  }
  /** Complete every chapter whose condition now holds; returns the newly finished ones (rewards applied). */
  checkGoals() {
    const done = [];
    for (const goal of GOALS) {
      if (Object.hasOwn(this.s.goals, goal.id)) continue;
      const [value, target] = goal.progress(this.s);
      if (value < target) continue;
      this.s.goals[goal.id] = this.s.day;
      const r = goal.reward || {};
      if (r.money) this.transact(r.money, `Chapter reward · ${goal.name}`);
      if (r.skillPoints) this.s.skillPoints += r.skillPoints;
      if (r.followers) this.s.followers += r.followers;
      const moods = {};
      for (const k of ['calm', 'privacy', 'connection', 'energy']) if (r[k]) moods[k] = r[k];
      if (Object.keys(moods).length) this.effect(moods);
      this.log(`Chapter complete: ${goal.name}.${goal.reward ? ' ' + goal.rewardText + '.' : ''}`);
      done.push(goal);
    }
    return done;
  }
  serialize() {
    return JSON.stringify(this.s);
  }
  static validate(raw) {
    const s = JSON.parse(JSON.stringify(raw));
    requireRule(s && s.version === VERSION, 'This is not a compatible Good Company save.');
    const base = freshState();
    const bounds = { day: [1, 100000], minute: [0, 1320], money: [-1000000, 100000000], reputation: [1, 5], reviews: [0, 1000000], followers: [0, 100000000], baseRate: [40, 600], campaignUntil: [0, 100010], permitUntil: [0, 100010], xp: [0, 100], level: [1, 100000], skillPoints: [0, 100000], rng: [0, 4294967295], nextId: [1, 100000000], completed: [0, 1000000], tips: [0, 1000000000], totalEarned: [-1000000, 1000000000] };
    for (const key of ['energy', 'calm', 'health', 'style', 'hunger', 'connection', 'privacy']) bounds[key] = [0, 100];
    for (const [key, [lo, hi]] of Object.entries(bounds)) requireRule(Number.isFinite(s[key]) && s[key] >= lo && s[key] <= hi, `Save data is invalid: ${key}.`);
    requireRule(Object.hasOwn(REGIONS, s.region) && Object.hasOwn(MODELS, s.model), 'Invalid region or business structure.');
    for (const key of ['day', 'reviews', 'followers', 'level', 'skillPoints', 'rng', 'nextId', 'completed']) requireRule(Number.isInteger(s[key]), `Save data is invalid: ${key}.`);
    requireRule(s.avatar && typeof s.avatar.name === 'string' && s.avatar.name.length <= 30 && Number.isInteger(s.avatar.age) && s.avatar.age >= 21 && s.avatar.age <= 75 && ['they / them', 'she / her', 'he / him'].includes(s.avatar.pronouns) && ['fresh', 'people', 'business'].includes(s.avatar.background) && Number.isFinite(s.avatar.x) && Number.isFinite(s.avatar.z) && Math.abs(s.avatar.x) <= 25 && Math.abs(s.avatar.z) <= 20, 'Invalid character in save.');
    for (const k of ['skin', 'hair', 'outfit']) requireRule(/^#[0-9a-f]{6}$/i.test(s.avatar[k]), 'Invalid character color in save.');
    for (const key of Object.keys(base.skills)) requireRule(s.skills && Number.isInteger(s.skills[key]) && s.skills[key] >= 1 && s.skills[key] <= 5, 'Invalid skill in save.');
    for (const key of ['requests', 'bookings', 'ledger', 'journal']) requireRule(Array.isArray(s[key]) && s[key].length <= (key === 'bookings' ? 20000 : 500), 'Invalid collection in save.');
    for (const key of ['requests', 'bookings']) requireRule(new Set(s[key].map((x) => x.id)).size === s[key].length, 'Duplicate records in save.');
    for (const r of s.requests) requireRule(r && typeof r.id === 'string' && /^[\w-]+$/.test(r.id) && PERSON(r.person) && Number.isFinite(r.budget) && r.budget >= 0 && r.budget < 100000 && typeof r.screened === 'boolean', 'Invalid request in save.');
    for (const b of s.bookings) {
      requireRule(b && typeof b.id === 'string' && /^[\w-]+$/.test(b.id) && PERSON(b.person) && Object.hasOwn(VENUES, b.venue) && ['scheduled', 'active', 'completed', 'ended', 'missed', 'no-show', 'cancelled', 'cancelled at day end'].includes(b.status), 'Invalid booking in save.');
      for (const k of ['day', 'start', 'duration', 'price', 'deposit']) requireRule(Number.isFinite(b[k]) && b[k] >= 0 && b[k] <= 100000, 'Invalid booking values.');
      requireRule(Number.isInteger(b.day) && b.day >= 1 && b.start >= 600 && b.start + b.duration <= 1290 && [60, 90].includes(b.duration) && b.price >= 40 && b.price <= 1500 && b.deposit <= b.price && typeof b.screened === 'boolean' && b.boundaries === true, 'Invalid booking terms.');
    }
    requireRule(s.contacts && typeof s.contacts === 'object' && !Array.isArray(s.contacts), 'Invalid contacts in save.');
    const contacts = {};
    for (const p of PEOPLE) {
      const c = s.contacts[p.id];
      if (c) {
        requireRule(typeof c.notes === 'string' && c.notes.length <= 600 && Number.isFinite(c.visits) && c.visits >= 0, 'Invalid contact notes.');
        contacts[p.id] = { visits: c.visits, favorite: !!c.favorite, blocked: !!c.blocked, notes: c.notes, lastRating: Number(c.lastRating) || 0 };
      }
    }
    s.contacts = contacts;
    for (const t of s.ledger) requireRule(t && Number.isFinite(t.amount) && Math.abs(t.amount) <= 1e9 && Number.isFinite(t.day) && Number.isFinite(t.time) && typeof t.label === 'string' && t.label.length <= 300, 'Invalid ledger in save.');
    for (const j of s.journal) requireRule(j && typeof j.message === 'string' && j.message.length <= 1000 && Number.isFinite(j.day) && Number.isFinite(j.time), 'Invalid journal in save.');
    if (s.activeDate) requireRule(s.bookings.some((b) => b.id === s.activeDate.bookingId && b.status === 'active') && Number.isInteger(s.activeDate.round) && s.activeDate.round >= 0 && s.activeDate.round <= 2 && Number.isFinite(s.activeDate.rapport) && s.activeDate.rapport >= 0 && s.activeDate.rapport <= 100 && Array.isArray(s.activeDate.answers) && typeof s.activeDate.feedback === 'string', 'Invalid active date in save.');
    // An active booking without an active date (an interrupted old save) would block walking forever: let it go.
    if (!s.activeDate) for (const b of s.bookings) if (b.status === 'active') b.status = 'ended';
    s.settings = { speed: [0, 1, 3].includes(s.settings?.speed) ? s.settings.speed : 1, reducedMotion: !!s.settings?.reducedMotion, sound: s.settings?.sound !== false };
    s.flags = { goal: !!s.flags?.goal, supportGrant: !!s.flags?.supportGrant, agency: !!s.flags?.agency, tutorial: Number.isFinite(s.flags?.tutorial) ? clamp(s.flags.tutorial, 0, 3) : 0, ending: !!s.flags?.ending };
    // Chapters and stats arrived after the first release: older saves start them fresh.
    const goals = {};
    if (s.goals && typeof s.goals === 'object') for (const g of GOALS) if (Number.isInteger(s.goals[g.id]) && s.goals[g.id] >= 1) goals[g.id] = s.goals[g.id];
    s.goals = goals;
    const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
    const count = (v) => (Number.isInteger(v) && v >= 0 && v < 1e7 ? v : 0);
    const regions = Array.isArray(st.regions) ? [...new Set(st.regions.filter((r) => Object.hasOwn(REGIONS, r)))] : [];
    if (!regions.includes(s.region)) regions.push(s.region);
    const best = Number.isFinite(st.bestRating) ? clamp(st.bestRating, 0, 5) : s.bookings.reduce((m, b) => (b.status === 'completed' && Number.isFinite(b.rating) ? Math.max(m, b.rating) : m), 0);
    s.stats = { bestRating: best, bargeDates: count(st.bargeDates), boundaries: count(st.boundaries), wellDays: count(st.wellDays), regions };
    const clean = {};
    for (const k of Object.keys(base)) clean[k] = s[k];
    return clean;
  }
}
