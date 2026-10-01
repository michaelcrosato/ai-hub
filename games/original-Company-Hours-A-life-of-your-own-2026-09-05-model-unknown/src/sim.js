/* Company Hours — authored game content and the life/business simulation. All places and
   regulations are fictional. Pure data and functions: no DOM, no renderer, so it can be
   smoke-tested under node. */
export const VERSION = '0.7.0';
export const SAVE_VERSION = 3;
export const REGIONS = {
    sunhaven: { name: 'Sunhaven', tagline: 'Salt air, new beginnings.', description: 'A relaxed waterfront community. Modest overheads and a steady appetite for coffee, walks, and genuine connection.', rate: 1, rent: 280, permit: 0, demand: 1, safety: 12, move: 0, color: '#f1ac8d', accent: '#87ad85', specialty: 'outdoors', rule: 'Public-companionship bookings need no permit in this fictional district.' },
    bellmere: { name: 'Bellmere', tagline: 'Find your people.', description: 'Galleries, independent cafés, and a busy festival calendar. Cultural interests matter here; a weekly business permit is required.', rate: 1.15, rent: 350, permit: 65, demand: 1.2, safety: 8, move: 350, color: '#afa8d0', accent: '#76a39e', specialty: 'art', rule: 'A fictional weekly business permit costs $65. Overdue permits pause new bookings; existing dates remain valid.' },
    marigold: { name: 'Marigold Hills', tagline: 'A little more extraordinary.', description: 'A polished retreat for demanding clients. Higher budgets come with expensive rent and higher expectations.', rate: 1.4, rent: 460, permit: 100, demand: .9, safety: 18, move: 600, color: '#e4ba71', accent: '#7daca0', specialty: 'food', rule: 'A fictional weekly business permit costs $100. New bookings require a current permit.' }
};
export const VENUES = {
    home: { name: 'Your apartment', short: 'Home', icon: 'home', x: -16, z: 12, door: [-16, 16.7], w: 8, d: 7, color: '#e6b491', subtitle: 'Rest, reset, make room for life.', kind: 'home' },
    cafe: { name: 'Petal Café', short: 'Petal Café', icon: 'coffee', x: -16, z: -3, door: [-16, 1.8], w: 8, d: 7, color: '#edb8a2', subtitle: 'Good coffee. Better conversation.', kind: 'date', cost: 16, likes: ['food', 'books'] },
    gallery: { name: 'The Little Gallery', short: 'Gallery', icon: 'art', x: 0, z: -17, door: [0, -12.3], w: 9, d: 7, color: '#c2bddc', subtitle: 'A different perspective, together.', kind: 'date', cost: 22, likes: ['art', 'books'] },
    bistro: { name: 'Juniper Table', short: 'Juniper', icon: 'dining', x: 16, z: -3, door: [16, 1.8], w: 8, d: 7, color: '#e3c782', subtitle: 'Dinner with a little occasion.', kind: 'date', cost: 36, likes: ['food', 'music'] },
    studio: { name: 'Company Studio', short: 'Studio', icon: 'spark', x: 15, z: 12, door: [15, 16.7], w: 8, d: 7, color: '#97b7a7', subtitle: 'Build your skills. Shape your brand.', kind: 'studio' },
    wellness: { name: 'Bloom Wellbeing', short: 'Bloom', icon: 'heart', x: -15, z: -17, door: [-15, -12.3], w: 8, d: 7, color: '#aac3b2', subtitle: 'Taking care of yourself is part of the work.', kind: 'wellness' },
    park: { name: 'Sunbeam Gardens', short: 'Gardens', icon: 'leaf', x: 0, z: 9, door: [0, 10], w: 0, d: 0, color: '#a9c489', subtitle: 'Slow down. There is no rush here.', kind: 'date', cost: 0, likes: ['outdoors', 'music'] },
    collective: { name: 'The Common Room', short: 'Common Room', icon: 'people', x: 15, z: -17, door: [15, -12.3], w: 8, d: 7, color: '#b3c5da', subtitle: 'You do not have to do it alone.', kind: 'collective' },
    // New in 0.7: an open-air venue at the end of a pier off the waterfront boardwalk.
    pier: { name: 'Lantern Pier', short: 'Lantern Pier', icon: 'wave', x: 38.6, z: -3.6, door: [37.4, -3.6], w: 0, d: 0, color: '#9fc3c9', subtitle: 'Sea air, the Tidewater kiosk, and lanterns at dusk.', kind: 'date', cost: 10, likes: ['travel', 'outdoors'] }
};
/** Venues a client can ask to meet at. */
export const DATE_VENUES = Object.keys(VENUES).filter(id => VENUES[id].kind === 'date');
export const INTERESTS = {
    art: { name: 'Art & design', icon: 'art', line: 'They notice the little details: a painting, a book cover, the way a room feels.' },
    food: { name: 'Food & coffee', icon: 'coffee', line: 'They light up when the conversation turns to a memorable meal.' },
    outdoors: { name: 'Outdoors', icon: 'leaf', line: 'They would choose a slow walk and fresh air over another busy evening.' },
    music: { name: 'Music', icon: 'music', line: 'There is always a song attached to their favourite memory.' },
    travel: { name: 'Travel', icon: 'compass', line: 'They are more interested in the people they met than the places they checked off.' },
    books: { name: 'Books & ideas', icon: 'book', line: 'A thoughtful question is their favourite way to start a conversation.' }
};
export const PEOPLE = [
    ['Alex Rivera', 'they/them', 31, 'art', '#d39b76', '#5d8573', 'A designer taking a break from a very long project.'],
    ['Jamie Chen', 'he/him', 34, 'food', '#e4b99c', '#b9a0b8', 'New in town, with an ever-growing list of places to eat.'],
    ['Morgan Ellis', 'she/her', 38, 'outdoors', '#9c684d', '#dfb865', 'Looking for a peaceful afternoon away from the office.'],
    ['Sam Okafor', 'they/them', 29, 'music', '#835a45', '#8ea4bc', 'An easygoing music lover with a hundred unfinished playlists.'],
    ['Riley Park', 'she/her', 27, 'books', '#d7a885', '#bc7c68', 'A researcher who wants an evening without talking about work.'],
    ['Jordan Brooks', 'he/him', 42, 'travel', '#bc8866', '#789391', 'Visiting for a conference; prefers local discoveries to tourist lists.'],
    ['Avery Singh', 'they/them', 36, 'art', '#a2704f', '#b99369', 'A thoughtful collector of small, beautifully made things.'],
    ['Taylor Martin', 'she/her', 45, 'food', '#ebc2a3', '#acb28c', 'Celebrating a milestone with excellent food and good company.'],
    ['Casey Reed', 'he/him', 30, 'music', '#c08765', '#b58e9c', 'A shy engineer who is much more animated about live music.'],
    ['Quinn Laurent', 'they/them', 40, 'books', '#e2bda3', '#7e9dae', 'Prefers a quiet conversation to a crowded room.'],
    ['Harper Silva', 'she/her', 33, 'travel', '#b3805e', '#c99a72', 'A photographer with stories from every corner of the coast.'],
    ['Drew Patel', 'he/him', 37, 'outdoors', '#986444', '#8faa76', 'A busy professional trying to become less busy.'],
    ['Robin Adler', 'they/them', 48, 'food', '#deb293', '#d79383', 'A new chapter in life calls for a new favourite café.'],
    ['Sasha Bell', 'she/her', 28, 'music', '#825640', '#9e96bd', 'An illustrator who thinks every day needs a soundtrack.'],
    ['Noah Kim', 'he/him', 35, 'art', '#d3a181', '#7fa89c', 'A city planner fascinated by buildings and the people inside them.'],
    ['Emery Costa', 'they/them', 32, 'travel', '#b98059', '#e0b271', 'A friendly visitor with a fondness for hidden gardens.'],
    ['Dana West', 'she/her', 44, 'books', '#c99070', '#929dc4', 'A teacher enjoying a well-earned sabbatical.'],
    ['Lee Foster', 'he/him', 39, 'outdoors', '#a57657', '#c79075', 'A familiar face at the weekend farmers market.'],
    // New in 0.7: three harbour regulars. Appended, so existing client ids stay stable.
    ['Marin Okoye', 'they/them', 34, 'travel', '#8a5a3f', '#7fa3b5', 'Repairs ferry engines and knows every boat on the harbour by name.'],
    ['Elena Vasquez', 'she/her', 41, 'outdoors', '#c4906b', '#d4a35f', 'A sea swimmer who insists every problem looks smaller from the water.'],
    ['Tomás Reyes', 'he/him', 36, 'music', '#b07a55', '#a3b77e', 'Plays the accordion on the pier on Sundays, badly and happily.']
].map((p, i) => ({ id: 'p' + i, name: p[0], pronouns: p[1], age: p[2], interest: p[3], skin: p[4], shirt: p[5], bio: p[6] }));
export const MODELS = {
    independent: { name: 'Independent', cut: 0, daily: 0, safety: 0, leads: 0, desc: 'Your calendar, your brand, your decisions. Keep your earnings and handle your own admin.' },
    collective: { name: 'Peer collective', cut: .15, daily: 0, safety: 16, leads: 1, desc: 'Share 15% of booking fees for peer check-ins, referrals, and reduced screening costs.' },
    managed: { name: 'Boutique agency', cut: .28, daily: 0, safety: 25, leads: 2, desc: 'Share 28% of booking fees for organized referrals, negotiation support, and safety coordination.' }
};
export const SKILLS = { conversation: 'Conversation', negotiation: 'Negotiation', insight: 'Client insight', branding: 'Brand building' };
export const ACTIONS = {
    meal: { label: 'Make a proper meal', venue: 'home', cost: 12, time: 40, fullness: 55, energy: 8, stress: -5, icon: 'dining', desc: 'A little nourishment goes a long way.' },
    shower: { label: 'Freshen up', venue: 'home', cost: 0, time: 25, hygiene: 65, stress: -6, icon: 'drop', desc: 'Step out feeling like yourself.' },
    nap: { label: 'Take a restorative nap', venue: 'home', cost: 0, time: 90, energy: 42, stress: -18, icon: 'moon', desc: 'Rest is productive, too.' },
    coffee: { label: 'Coffee & a pastry', venue: 'cafe', cost: 12, time: 30, energy: 16, fullness: 25, stress: -5, icon: 'coffee', desc: 'A small pause in a busy day.' },
    walk: { label: 'Take an unhurried walk', venue: 'park', cost: 0, time: 45, energy: -5, stress: -24, social: 5, icon: 'leaf', desc: 'Clear your head by the fountain.' },
    gallery: { label: 'Explore the exhibition', venue: 'gallery', cost: 15, time: 60, stress: -16, social: 8, skill: 'conversation', xp: 10, icon: 'art', desc: 'Collect a few new conversation starters.' },
    care: { label: 'Wellbeing appointment', venue: 'wellness', cost: 45, time: 60, energy: 14, stress: -36, health: 22, icon: 'heart', desc: 'Support, care, and a preventative check-in. No medical simulation.' },
    friend: { label: 'Meet your friend Jules', venue: 'cafe', cost: 18, time: 90, stress: -22, social: 35, relationship: 18, icon: 'people', desc: 'A friend who sees the person behind the work.' },
    peer: { label: 'Join a peer meet-up', venue: 'collective', cost: 0, time: 60, stress: -14, social: 20, skill: 'insight', xp: 18, icon: 'shield', desc: 'Trade perspective with people who understand.' },
    gig: { label: 'Help at the community café', venue: 'cafe', cost: 0, time: 120, energy: -16, fullness: -10, income: 85, icon: 'coin', desc: 'A reliable side job, available once per day. There is always another way forward.' },
    train_conversation: { label: 'Conversation workshop', venue: 'studio', cost: 65, time: 90, energy: -10, skill: 'conversation', xp: 45, icon: 'chat', desc: 'Practise listening, curiosity, and finding common ground.' },
    train_negotiation: { label: 'Business workshop', venue: 'studio', cost: 65, time: 90, energy: -10, skill: 'negotiation', xp: 45, icon: 'coin', desc: 'Learn to communicate your value without losing your boundaries.' },
    train_insight: { label: 'Screening workshop', venue: 'collective', cost: 55, time: 90, energy: -10, skill: 'insight', xp: 45, icon: 'shield', desc: 'Build a more consistent, thoughtful screening process.' },
    train_branding: { label: 'Branding workshop', venue: 'studio', cost: 65, time: 90, energy: -10, skill: 'branding', xp: 45, icon: 'spark', desc: 'Find a voice that feels genuinely yours.' },
    photos: { label: 'Refresh your portfolio', venue: 'studio', cost: 90, time: 75, energy: -8, followers: 65, rep: 2, icon: 'camera', desc: 'A warm, professional profile. Available once per week.' },
    tide: { label: 'Watch the tide come in', venue: 'pier', cost: 0, time: 40, stress: -20, social: 3, icon: 'wave', desc: 'Lanterns, gulls, and nowhere else to be.' },
    tea: { label: 'Tea at the Tidewater kiosk', venue: 'pier', cost: 8, time: 25, fullness: 18, energy: 10, stress: -6, icon: 'coffee', desc: 'A warm cup with a view of the whole harbour.' },
    sail: { label: 'An evening sail with Jules', venue: 'pier', cost: 30, time: 90, stress: -26, social: 30, relationship: 14, after: 17 * 60, icon: 'compass', desc: 'Jules borrows a friend’s dinghy and the harbour turns gold. From 17:00.' }
};
export const UPGRADES = {
    linen: { name: 'A restful bedroom', cost: 250, desc: '+15 energy each morning. Makes recovery more reliable.', icon: 'moon' },
    wardrobe: { name: 'A signature wardrobe', cost: 350, desc: '+5 date quality when hygiene is at least 60.', icon: 'spark' },
    privacy: { name: 'Privacy essentials', cost: 220, desc: 'Reduces daily exposure by 3. Separates work from your own life.', icon: 'lock' },
    studio: { name: 'Home office', cost: 450, desc: 'Screening takes half the time. Marketing costs 20% less.', icon: 'home' }
};
export const EVENTS = [
    { id: 'festival', title: 'The town is in bloom', text: 'The weekend arts festival brings new visitors. For today, every completed date earns a 15% booking bonus.', effect: 'festival', icon: 'art' },
    { id: 'message', title: 'A message from Jules', text: '“I found a little place you would love. Let’s catch up?” Making space for your friendship will help your stress and connection.', effect: 'friend', icon: 'chat' },
    { id: 'quiet', title: 'A quieter kind of day', text: 'The waterfront is unusually peaceful. A good day to learn something, reset, or spend time on your own plans.', effect: 'quiet', icon: 'leaf' },
    { id: 'referral', title: 'Your name came up', text: 'A satisfied client passed your profile along. Your audience is growing, one good experience at a time.', effect: 'referral', icon: 'people' },
    { id: 'admin', title: 'A little business housekeeping', text: 'Before a busy week, check your expenses, permit status, and outstanding deposits. The money on hand is not always all yours to spend.', effect: 'admin', icon: 'book' },
    { id: 'support', title: 'An open door', text: 'The Common Room has a peer meet-up today. You are welcome whether you work independently or with an agency.', effect: 'support', icon: 'shield' }
];
export const MILESTONES = [
    { id: 'first', name: 'A lovely first impression', text: 'Complete your first date.', goal: 1, type: 'dates', reward: 75 },
    { id: 'careful', name: 'On your own terms', text: 'Screen 5 enquiries.', goal: 5, type: 'screens', reward: 80 },
    { id: 'regular', name: 'A familiar face', text: 'Complete 3 dates with returning clients.', goal: 3, type: 'regulars', reward: 120 },
    { id: 'grounded', name: 'Room to breathe', text: 'Set aside $1,000 in savings.', goal: 1000, type: 'savings', reward: 150 },
    { id: 'name', name: 'Making a name', text: 'Reach 65 reputation.', goal: 65, type: 'rep', reward: 200 },
    { id: 'balance', name: 'A life, not just a living', text: 'See Jules 4 times.', goal: 4, type: 'friends', reward: 120 },
    { id: 'ten', name: 'Good company', text: 'Complete 12 dates.', goal: 12, type: 'dates', reward: 200 },
    { id: 'team', name: 'Better together', text: 'Build a team of 3 consenting adult peers.', goal: 3, type: 'team', reward: 250 }
];
export const DATE_TOPICS = [
    { label: 'Ask what has inspired them lately', interest: 'art', base: 8, reply: 'They describe a tiny gallery they found by accident. The conversation starts to flow.' },
    { label: 'Trade favourite places to eat', interest: 'food', base: 8, reply: 'A favourite bakery becomes a story, and then another. This feels easy.' },
    { label: 'Talk about a perfect day outside', interest: 'outdoors', base: 8, reply: 'Their shoulders relax as they describe their favourite walk.' },
    { label: 'Ask about a song they keep returning to', interest: 'music', base: 8, reply: 'They smile before they even answer. You have found something that matters.' },
    { label: 'Share stories about unfamiliar places', interest: 'travel', base: 8, reply: 'The best part of the trip, it turns out, was the unexpected conversation.' },
    { label: 'Ask about a book that stayed with them', interest: 'books', base: 8, reply: 'They pause to think, then answer with real enthusiasm.' }
];
/**
 * New in 0.7 — regulars pick up where you left off. On a returning client's date, the
 * common-ground moment becomes a story beat about their interest: one for the second date,
 * another for every date after it. Remembering the detail is the warmest answer, and notes
 * kept in the client book make it warmer still.
 */
export const STORIES = {
    art: [
        { title: '“I went back to that little gallery.”', desc: '{name} has been sketching again since you last met, and brought a notebook to show you.', recall: 'Ask about the drawing they were stuck on last time', reply: 'They flip straight to it. It is finished, and they want to know what you think.' },
        { title: '“The exhibition is finally up.”', desc: 'Something {name} mentioned a while ago has become real: a small show of their work in a friend’s window.', recall: 'Ask how the opening went, as you promised you would', reply: 'They laugh about how nervous they were, then show you the one piece that sold.' }
    ],
    food: [
        { title: '“I tried the bakery you suggested.”', desc: '{name} arrives with a paper bag and a firm verdict on the cardamom buns.', recall: 'Ask whether they found the harbour café they were hunting for', reply: 'They did, and they have already been back twice. The list keeps growing.' },
        { title: '“I cooked my grandmother’s recipe.”', desc: 'Last time, {name} said they could never get it right. Today they look quietly proud.', recall: 'Ask if it tasted the way they remembered', reply: 'Almost, they say. Close enough that they called home afterwards.' }
    ],
    outdoors: [
        { title: '“I finally walked the whole coast path.”', desc: '{name} is sunburnt in one exact stripe and very pleased about it.', recall: 'Ask about the cliff stretch they were worried about', reply: 'They took it slowly and sat at the top for an hour. It was worth every step.' },
        { title: '“The swifts are back.”', desc: '{name} has been counting birds from the balcony again, a habit they told you about.', recall: 'Ask how many they have counted this year', reply: 'Forty-one, and one that keeps landing on the same chimney. They have named it.' }
    ],
    music: [
        { title: '“I made you a playlist. Is that strange?”', desc: '{name} hands you a scrap of paper with twelve songs and a lot of crossings-out.', recall: 'Look for the song they kept humming last time', reply: 'It is the very first track. They grin when you notice.' },
        { title: '“I played in front of people.”', desc: 'An open-mic night, the thing {name} swore they would never do, has happened.', recall: 'Ask whether the shaky second verse held up', reply: 'It did not, and nobody minded. They are already planning the next one.' }
    ],
    books: [
        { title: '“I finished the book. I have thoughts.”', desc: '{name} has the novel with them, bristling with paper bookmarks.', recall: 'Ask whether the ending was the one they were dreading', reply: 'It was worse, and better. They talk about it for ten minutes without stopping.' },
        { title: '“I started writing something of my own.”', desc: 'Just a few pages, {name} says, which is how every good story starts.', recall: 'Ask about the character they described to you last time', reply: 'She has a name now, and a stubborn streak. They read you the first line.' }
    ],
    travel: [
        { title: '“I came back with a story for you.”', desc: '{name} is just back from a trip and saved the best part to tell you.', recall: 'Ask whether they found the café from the old postcard', reply: 'It is a launderette now, but the owner remembered the café and drew them a map of it.' },
        { title: '“I think I might stay a while.”', desc: '{name} has been looking at little flats near the harbour. The visitor is becoming a local.', recall: 'Ask what made this town feel like somewhere to stay', reply: 'The slow mornings, they say. The pier at dusk. People who remember what you told them.' }
    ]
};
/** The story beat for a booking with a returning client, or null for a first date. */
export function storyFor(s, b) {
    const c = s.clients[b.person];
    if (!c || c.dates < 1)
        return null;
    const beats = STORIES[person(b.person).interest];
    return beats ? beats[Math.min(beats.length - 1, c.dates - 1)] : null;
}
/** Does this client especially like the venue they asked for? */
export const venueFit = (b) => !!VENUES[b.venue]?.likes?.includes(person(b.person).interest);



export const clamp = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
export const money = v => Number.isFinite(v) ? (v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US') : '—';
export const clock = v => `${String(Math.floor(v / 60) % 24).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
export function newGame(options = {}) {
    const validColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    const seed = Number.isFinite(options.seed) ? Math.abs(Math.trunc(options.seed)) % 4294967296 : Date.now() % 4294967296;
    const s = { version: SAVE_VERSION, seed, day: 1, time: 9 * 60, region: Object.hasOwn(REGIONS, options.region) ? options.region : 'sunhaven',
        player: { name: String(options.name || 'Rowan').trim().slice(0, 28) || 'Rowan', age: Math.trunc(clamp(Number(options.age) || 28, 21, 80)), pronouns: ['they/them', 'she/her', 'he/him'].includes(options.pronouns) ? options.pronouns : 'they/them', skin: validColor(options.skin, '#bd8966'), shirt: validColor(options.shirt, '#739780'), hair: validColor(options.hair, '#513d34'), style: ['relaxed', 'polished', 'creative'].includes(options.style) ? options.style : 'relaxed' },
        difficulty: ['relaxed', 'balanced', 'ambitious'].includes(options.difficulty) ? options.difficulty : 'balanced', goal: ['independent', 'exit', 'studio'].includes(options.goal) ? options.goal : 'independent', wallet: options.difficulty === 'relaxed' ? 1400 : 950, savings: 0, debt: 0, rate: 150, rep: 38, followers: 48,
        needs: { energy: 90, stress: 12, hygiene: 88, fullness: 82, social: 75, health: 90 }, skills: { conversation: 15, negotiation: 5, insight: 5, branding: 0 },
        model: 'independent', security: false, manager: false, privacy: 'balanced', permitUntil: 0, careUntil: 7, relationship: { name: 'Jules', bond: 65, disclosure: 'open', visits: 0, lastVisit: 0, lastDisclosure: 0 },
        leads: [], bookings: [], clients: {}, activeDate: null, report: null, ledger: [], journal: [], achievements: [], upgrades: [], team: [], nextId: 1, position: [-16, 17],
        stats: { dates: 0, screens: 0, regulars: 0, earned: 0, spent: 0, ratings: [], noShows: 0, cancelled: 0, safeExits: 0, days: 1 },
        today: { gig: false, photos: false, event: 'welcome', campaign: false, earned: 0, spent: 0 }, lastPhotos: -10, exposure: 8, finished: false, celebrated: false, tutorial: 0, settings: { quality: 'auto', audio: false, volume: .25, reduceMotion: false, highContrast: false, textScale: 1, showLabels: true }, event: null };
    if (REGIONS[s.region].permit) {
        s.permitUntil = 7;
        s.wallet -= REGIONS[s.region].permit;
    }
    fillLeads(s);
    note(s, 'A fresh start', `Welcome to ${REGIONS[s.region].name}. Your first week’s rent is due on day 8.`, 'leaf');
    return s;
}
export function random(s) {
    s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
    return s.seed / 4294967296;
}
export function pick(s, a) {
    return a[Math.floor(random(s) * a.length)];
}
export const level = (s, k) => 1 + Math.min(9, Math.floor(s.skills[k] / 65));
export const liabilities = s => s.bookings.filter(b => ['booked', 'active'].includes(b.status)).reduce((n, b) => n + b.deposit, 0);
export const available = s => Math.max(0, s.wallet - liabilities(s));
export function note(s, title, text, icon = 'book') {
    s.journal.unshift({ id: s.nextId++, day: s.day, time: Math.floor(s.time), title, text, icon });
    s.journal = s.journal.slice(0, 100);
}
export function transaction(s, amount, label, kind = 'operating') {
    if (!Number.isFinite(amount))
        throw new Error('A financial entry must be finite.');
    amount = Math.round(amount);
    if (amount === 0)
        return 0;
    s.wallet += amount;
    s.ledger.unshift({ id: s.nextId++, day: s.day, time: Math.floor(s.time), amount, label, kind });
    s.ledger = s.ledger.slice(0, 180);
    if (amount > 0 && !['transfer', 'deposit', 'refund'].includes(kind)) {
        s.stats.earned += amount;
        s.today.earned += amount;
    }
    if (amount < 0 && !['transfer', 'deposit', 'refund'].includes(kind)) {
        s.stats.spent -= amount;
        s.today.spent -= amount;
    }
    return amount;
}
export function pay(s, amount, label, allowDebt = false) {
    if (!Number.isFinite(amount) || amount < 0)
        return false;
    amount = Math.round(amount);
    if (available(s) < amount) {
        if (!allowDebt)
            return false;
        const cash = available(s);
        s.debt += amount - cash;
        transaction(s, -cash, label + ' (part paid)');
        note(s, 'An outstanding bill', `${money(amount - cash)} added to your interest-free arrears. Community work and smaller dates can help you recover.`, 'coin');
        return true;
    }
    transaction(s, -amount, label);
    return true;
}
export function safety(s, c = null) {
    return clamp(38 + REGIONS[s.region].safety + level(s, 'insight') * 3 + MODELS[s.model].safety + (s.security ? 22 : 0) + (s.upgrades.includes('privacy') ? 6 : 0) + (c?.screened ? 12 : 0) - (s.needs.energy < 25 ? 12 : 0) - s.exposure * .18, 0, 98);
}
export function expectedPrice(s) {
    return Math.round((130 + s.rep * 1.7 + level(s, 'negotiation') * 6) * REGIONS[s.region].rate);
}
export function fillLeads(s) {
    const count = Math.min(9, Math.max(2, Math.floor((3 + Math.floor(s.followers / 90)) * REGIONS[s.region].demand)) + MODELS[s.model].leads + (s.manager ? 1 : 0));
    const existing = new Set(s.leads.map(l => l.person));
    const active = new Set(s.bookings.filter(b => ['booked', 'active'].includes(b.status)).map(b => b.person));
    let pool = PEOPLE.filter(p => !existing.has(p.id) && !active.has(p.id) && !s.clients[p.id]?.blocked);
    while (s.leads.length < count && pool.length) {
        const p = pick(s, [...pool, ...pool.filter(p => p.interest === REGIONS[s.region].specialty)]);
        pool = pool.filter(x => x.id !== p.id);
        const returning = (s.clients[p.id]?.dates ?? 0) > 0;
        const risk = Math.floor(random(s) * 100);
        const desired = s.leads.length === 0 && s.day === 1 ? 'cafe' : pick(s, DATE_VENUES);
        const budget = Math.round(expectedPrice(s) * (.76 + random(s) * .65) * (returning ? 1.08 : 1));
        s.leads.push({ id: 'l' + s.nextId++, person: p.id, originModel: s.model, venue: desired, duration: desired === 'bistro' ? 90 : 60, budget, offer: s.rate, screened: false, negotiated: false, risk, returning, created: s.day, expires: s.day + 2, depositAgreed: risk < 78, reference: risk < 70, signal: risk > 83 ? 'Asks to change the agreed meeting place.' : risk > 64 ? 'A few details are missing from their profile.' : returning ? 'A familiar client who knows your boundaries.' : 'Clear request, public venue, no urgency.', tone: pick(s, ['thoughtful', 'upbeat', 'quiet']), noShow: random(s) < (risk > 65 ? .24 : .05) });
    }
}
export function timeConflict(s, start, end, day = s.day, ignore = null) {
    return s.bookings.some(b => b.id !== ignore && b.day === day && ['booked', 'active'].includes(b.status) && start < b.time + b.duration + 25 && end > b.time - 25);
}
export function canSpendTime(s, minutes) {
    return !timeConflict(s, s.time, s.time + minutes) && s.time + minutes <= 22 * 60;
}
export function advance(s, minutes) {
    if (!Number.isFinite(minutes) || minutes < 0)
        return;
    const m = Math.min(minutes, 22 * 60 - s.time);
    s.time += m;
    const f = s.difficulty === 'relaxed' ? .7 : s.difficulty === 'ambitious' ? 1.15 : 1;
    s.needs.energy = clamp(s.needs.energy - m * .020 * f * (s.needs.health < 35 ? 1.4 : 1));
    s.needs.fullness = clamp(s.needs.fullness - m * .033 * f);
    s.needs.hygiene = clamp(s.needs.hygiene - m * .018 * f);
    s.needs.social = clamp(s.needs.social - m * .009 * f);
    if (s.needs.fullness < 20)
        s.needs.stress = clamp(s.needs.stress + m * .014);
    if (s.needs.energy < 15)
        s.needs.stress = clamp(s.needs.stress + m * .025);
    for (const b of s.bookings) {
        if (b.status === 'booked' && (b.day < s.day || (b.day === s.day && s.time > b.time + 40))) {
            b.status = 'missed';
            transaction(s, -b.deposit, `Refund · missed booking with ${person(b.person).name}`, 'refund');
            s.rep = clamp(s.rep - 3);
            s.stats.cancelled++;
            note(s, 'A missed booking', `${person(b.person).name}'s deposit was refunded. Leave travel time before your next booking.`, 'calendar');
        }
    }
}
export const person = id => PEOPLE.find(p => p.id === id) || PEOPLE[0];
export const getLead = (s, id) => s.leads.find(l => l.id === id);
export function screen(s, id) {
    const c = getLead(s, id);
    if (!c)
        return { ok: false, message: 'This enquiry is no longer available.' };
    if (c.screened)
        return { ok: false, message: 'You have already screened this enquiry.' };
    const fee = s.model === 'collective' ? 5 : 10, minutes = s.upgrades.includes('studio') ? 10 : 20;
    if (!canSpendTime(s, minutes))
        return { ok: false, message: 'Leave time for your booking, or screen this enquiry tomorrow.' };
    if (!pay(s, fee, 'Client screening'))
        return { ok: false, message: 'Not enough available funds. Outstanding deposits are reserved.' };
    advance(s, minutes);
    c.screened = true;
    s.skills.insight += 7;
    s.stats.screens++;
    note(s, 'Screening complete', `${person(c.person).name}: ${c.risk > 78 ? 'concerns remain; declining is a valid choice.' : c.risk > 60 ? 'some details need care.' : 'consistent information and a clear public meeting request.'}`, 'shield');
    checkMilestones(s);
    return { ok: true, message: c.risk > 78 ? 'Concerns remain. You can decline without penalty.' : 'Screened. Preparation reduces risk, but never guarantees it.' };
}
export function negotiate(s, id, price) {
    const c = getLead(s, id);
    price = Number(price);
    if (!c || !Number.isFinite(price) || price < 60 || price > 1500)
        return { ok: false, message: 'Choose a whole-number rate between $60 and $1,500.' };
    if (c.negotiated)
        return { ok: false, message: 'This enquiry already has a final negotiated rate.' };
    price = Math.round(price);
    const support = (s.manager ? 12 : 0) + (s.model === 'managed' ? 18 : 0) + level(s, 'negotiation') * 3;
    const accepted = price <= c.budget + support;
    c.negotiated = true;
    c.offer = accepted ? price : Math.max(60, Math.floor((c.budget + support) * .95));
    s.skills.negotiation += 5;
    return { ok: true, message: accepted ? `Agreed: ${money(c.offer)} for the booking.` : `Their final counteroffer is ${money(c.offer)}. Accept it or pass; no penalty.` };
}
export function book(s, id, day, start) {
    const c = getLead(s, id);
    day = Number(day);
    start = Number(start);
    if (!c)
        return { ok: false, message: 'That enquiry has expired.' };
    if (!Number.isInteger(day) || day < s.day || day > s.day + 2 || !Number.isFinite(start) || start < 9 * 60 || start + c.duration > 21 * 60 || (day === s.day && start < s.time + 25))
        return { ok: false, message: 'Choose a future slot with at least 25 minutes to prepare, ending by 21:00.' };
    if (timeConflict(s, start, start + c.duration, day))
        return { ok: false, message: 'That overlaps a booking or its 25-minute travel buffer.' };
    if (REGIONS[s.region].permit && s.permitUntil < day)
        return { ok: false, message: 'Renew your district permit in Business to cover the requested booking day.' };
    if (!c.negotiated && c.offer > c.budget + level(s, 'negotiation') * 3)
        return { ok: false, message: 'This rate exceeds their budget. Negotiate first.' };
    const deposit = c.depositAgreed ? Math.round(c.offer * .25) : 0;
    const b = { ...c, id: 'b' + s.nextId++, day, time: start, status: 'booked', deposit, supportCut: Math.max(MODELS[s.model].cut, MODELS[c.originModel || s.model].cut) };
    s.bookings.push(b);
    s.leads = s.leads.filter(l => l.id !== id);
    transaction(s, deposit, `Deposit · ${person(c.person).name}`, 'deposit');
    s.clients[c.person] ??= { dates: 0, notes: '', blocked: false, trust: 50, earned: 0 };
    s.tutorial = Math.max(s.tutorial, 2);
    note(s, 'A date in the diary', `${person(c.person).name}, day ${day} at ${clock(start)} · ${VENUES[c.venue].name}. Deposit reserved: ${money(deposit)}.`, 'calendar');
    return { ok: true, message: 'Booked. Your deposit is held safely until the date concludes.' };
}
export function decline(s, id) {
    s.leads = s.leads.filter(l => l.id !== id);
    return { ok: true, message: 'Enquiry declined. Your boundaries do not need an explanation.' };
}
export function cancel(s, id) {
    const b = s.bookings.find(x => x.id === id);
    if (!b || b.status !== 'booked')
        return { ok: false, message: 'This booking is no longer pending.' };
    b.status = 'cancelled';
    transaction(s, -b.deposit, 'Booking deposit returned', 'refund');
    s.stats.cancelled++;
    note(s, 'Booking cancelled', `${person(b.person).name}'s deposit was returned. A clear boundary is better than an unwanted booking.`, 'shield');
    return { ok: true, message: 'Cancelled and refunded. No reputation penalty.' };
}
export function beginDate(s, id) {
    const b = s.bookings.find(x => x.id === id);
    if (!b || b.status !== 'booked' || s.activeDate)
        return { ok: false, message: 'This date is not available.' };
    if (b.day !== s.day)
        return { ok: false, message: 'This booking is on another day.' };
    if (s.time < b.time - 20)
        return { ok: false, message: `You are early. Come back at ${clock(b.time - 20)} or wait here.` };
    if (s.time > b.time + 40)
        return { ok: false, message: 'The client has already left.' };
    const door = VENUES[b.venue].door;
    if (Math.hypot(s.position[0] - door[0], s.position[1] - door[1]) > 3)
        return { ok: false, message: 'Walk to the booked venue first.' };
    if (b.noShow) {
        b.status = 'no-show';
        advance(s, Math.max(0, b.time + 15 - s.time));
        s.stats.noShows++;
        s.stats.earned += b.deposit;
        s.today.earned += b.deposit;
        note(s, 'They could not make it', `${person(b.person).name} did not arrive. The agreed ${money(b.deposit)} reservation deposit is retained.`, 'calendar');
        s.report = { type: 'no-show', title: 'A change of plans', text: 'The client did not arrive. You kept the agreed reservation deposit; the rest of the afternoon is yours.', gross: b.deposit, net: b.deposit, quality: 0, tip: 0 };
        return { ok: true, message: 'A no-show. The reservation deposit is now available.' };
    }
    if (!pay(s, VENUES[b.venue].cost, 'Venue expenses · ' + VENUES[b.venue].name))
        return { ok: false, message: `You need ${money(VENUES[b.venue].cost)} of available cash for this venue. Deposits remain reserved.` };
    b.status = 'active';
    s.activeDate = { booking: b.id, step: 0, quality: 30 + level(s, 'conversation') * 3 + (b.screened ? 5 : 0) + (b.returning ? 5 : 0) + (s.needs.energy > 50 ? 4 : -8) + (s.needs.hygiene > 60 ? 4 : -7) + (s.needs.stress < 50 ? 3 : -5) + (s.needs.health < 40 ? -8 : 0) + (s.needs.social < 25 ? -4 : 0) + (person(b.person).interest === REGIONS[s.region].specialty ? 3 : 0) + (venueFit(b) ? 3 : 0), boundary: b.risk > 68 && random(s) * 100 > safety(s, b) - 15, choices: [], lastReply: '', consent: true };
    s.tutorial = Math.max(s.tutorial, 3);
    return { ok: true, message: 'Your date has begun.' };
}
export function dateChoice(s, choice) {
    const d = s.activeDate;
    if (!d)
        return { ok: false, message: 'No date is in progress.' };
    const b = s.bookings.find(b => b.id === d.booking), p = person(b.person);
    let delta = 0, reply = '';
    if (choice === 'exit') {
        return endDate(s, true);
    }
    if (d.step === 0) {
        if (choice === 'listen') {
            delta = 12;
            reply = 'You make room for their answer instead of rushing ahead. They seem more at ease.';
        }
        else if (choice === 'plan') {
            delta = b.tone === 'thoughtful' ? 14 : 9;
            reply = 'You agree on a simple plan together. Knowing what to expect helps.';
        }
        else if (choice === 'pitch') {
            delta = -7;
            reply = 'The conversation feels a little like a sales pitch. They would rather get to know you.';
        }
        else
            return { ok: false, message: 'Choose one of the available responses.' };
    }
    if (d.step === 1) {
        const story = storyFor(s, b), notes = !!s.clients[b.person]?.notes?.trim();
        if (story && choice === 'recall') {
            delta = 20 + (notes ? 4 : 0);
            reply = story.reply + (notes ? ' Your notes helped you remember the small things.' : '');
        }
        else if (!story && choice === p.interest) {
            delta = 20;
            reply = 'Their face lights up. You remembered what matters to them, and the conversation finds its own rhythm.';
        }
        else if (choice === 'curious') {
            delta = 10;
            reply = 'You ask an open question and listen closely. There is always something new to learn.';
        }
        else if (['art', 'food', 'outdoors', 'music', 'travel', 'books'].includes(choice)) {
            delta = 4;
            reply = 'It is not quite their favourite subject, but you find a little common ground.';
        }
        else
            return { ok: false, message: 'Choose one of the available responses.' };
    }
    if (d.step === 2) {
        if (d.boundary) {
            if (choice === 'boundary') {
                delta = 14;
                reply = 'You calmly return to the agreed plan. Your boundary is clear and the public venue stays the same.';
                s.needs.stress = clamp(s.needs.stress - 3);
            }
            else if (choice === 'checkin') {
                delta = 9;
                reply = 'You take a moment to check in with your support contact, then continue on the agreed terms.';
            }
            else
                return { ok: false, message: 'Choose a boundary, check in, or leave safely.' };
        }
        else {
            if (choice === 'thoughtful') {
                delta = 12;
                reply = 'You end with a small detail from the conversation. It feels sincere, not rehearsed.';
            }
            else if (choice === 'extend') {
                delta = 4;
                reply = 'You keep to the agreed time rather than promise an extension you have not scheduled.';
            }
            else if (choice === 'phone') {
                delta = -8;
                reply = 'Checking your notifications breaks the connection at the end.';
            }
            else
                return { ok: false, message: 'Choose one of the available responses.' };
        }
    }
    d.quality += delta;
    d.lastReply = reply;
    d.choices.push(choice);
    d.step++;
    s.skills.conversation += 4;
    if (d.step >= 3)
        return endDate(s, false, reply);
    return { ok: true, message: reply };
}
export function endDate(s, safeExit = false, reply = '') {
    const d = s.activeDate;
    if (!d)
        return { ok: false, message: 'No date is active.' };
    const b = s.bookings.find(x => x.id === d.booking), client = s.clients[b.person];
    b.status = safeExit ? 'ended-safely' : 'completed';
    s.activeDate = null;
    if (safeExit) {
        transaction(s, -b.deposit, 'Deposit returned · safe exit', 'refund');
        s.stats.safeExits++;
        s.needs.stress = clamp(s.needs.stress - 2);
        advance(s, 15);
        s.report = { type: 'safe', title: 'Your time. Your terms.', text: 'You ended the meeting and returned the deposit. Your reputation is unchanged. Looking after yourself comes first.', gross: 0, net: -VENUES[b.venue].cost, venueCost: VENUES[b.venue].cost, quality: 0, tip: 0 };
        note(s, 'A boundary respected', 'You chose to end a date. No rating or reputation penalty was applied.', 'shield');
        return { ok: true, message: 'Date ended safely. No reputation penalty.' };
    }
    const quality = clamp(d.quality + (s.upgrades.includes('wardrobe') && s.needs.hygiene >= 60 ? 5 : 0));
    const tip = Math.round(b.offer * Math.max(0, (quality - 62) / 180));
    const bonus = s.today.event === 'festival' ? Math.round(b.offer * .15) : 0;
    const cut = Math.round(b.offer * (b.supportCut ?? MODELS[s.model].cut));
    const gross = b.offer + tip + bonus;
    transaction(s, b.offer - b.deposit + tip + bonus, 'Completed date · ' + person(b.person).name);
    s.stats.earned += b.deposit;
    s.today.earned += b.deposit;
    if (cut)
        transaction(s, -cut, 'Business support share');
    const net = gross - cut - VENUES[b.venue].cost;
    s.stats.dates++;
    if (client.dates > 0)
        s.stats.regulars++;
    client.dates++;
    client.trust = clamp(client.trust + (quality - 50) / 4);
    client.earned += gross;
    client.lastVisit = s.day;
    const rating = clamp(quality / 20, 1, 5);
    s.stats.ratings.push(Math.round(rating * 10) / 10);
    s.stats.ratings = s.stats.ratings.slice(-100);
    s.rep = clamp(s.rep + (quality >= 70 ? 3.5 : quality >= 50 ? 1 : -2));
    s.followers += Math.round(quality / 8);
    s.needs.energy = clamp(s.needs.energy - 9);
    s.needs.stress = clamp(s.needs.stress + (d.boundary ? 6 : 2));
    s.needs.social = clamp(s.needs.social + 8);
    s.exposure = clamp(s.exposure + (s.privacy === 'public' ? 5 : s.privacy === 'private' ? 1 : 2));
    const mins = Math.max(20, b.time + b.duration - s.time);
    advance(s, mins);
    s.skills.conversation += 10;
    s.report = { type: 'success', title: quality >= 85 ? 'A genuinely lovely time' : quality >= 65 ? 'A good connection' : 'Something to learn from', text: reply || 'Every date brings a little more experience.', gross, net, quality, tip, cut, bonus, rating, person: b.person, venueCost: VENUES[b.venue].cost };
    note(s, 'Date completed', `${person(b.person).name} · ${rating.toFixed(1)} stars · ${money(net)} after venue and support costs.`, 'heart');
    checkMilestones(s);
    return { ok: true, message: `Date complete. ${money(net)} net income.` };
}
export function doAction(s, id) {
    const a = Object.hasOwn(ACTIONS, id) ? ACTIONS[id] : null;
    if (!a)
        return { ok: false, message: 'Unknown activity.' };
    if (s.activeDate)
        return { ok: false, message: 'Finish your current date first.' };
    if (Math.hypot(s.position[0] - VENUES[a.venue].door[0], s.position[1] - VENUES[a.venue].door[1]) > 3)
        return { ok: false, message: 'Walk to ' + VENUES[a.venue].name + ' first.' };
    if (id === 'gig' && s.today.gig)
        return { ok: false, message: 'You have already helped at the café today.' };
    if (id === 'photos' && s.day - s.lastPhotos < 7)
        return { ok: false, message: 'Your portfolio is still fresh. Update it once a week.' };
    if (a.after && s.time < a.after)
        return { ok: false, message: `${a.label} is available from ${clock(a.after)}.` };
    if (!canSpendTime(s, a.time))
        return { ok: false, message: 'This activity would overlap a booking or continue past 22:00.' };
    if (!pay(s, a.cost, a.label))
        return { ok: false, message: 'Not enough available cash. A walk, peer meet-up, rest, or community shift can help.' };
    advance(s, a.time);
    for (const k of Object.keys(s.needs))
        if (a[k])
            s.needs[k] = clamp(s.needs[k] + a[k]);
    if (a.skill)
        s.skills[a.skill] += a.xp;
    if (a.rep)
        s.rep = clamp(s.rep + a.rep);
    if (a.followers)
        s.followers += a.followers;
    if (a.income)
        transaction(s, a.income, 'Community café shift');
    if (id === 'gig')
        s.today.gig = true;
    if (id === 'photos')
        s.lastPhotos = s.day;
    if (id === 'care')
        s.careUntil = s.day + 7;
    if (a.relationship) {
        s.relationship.bond = clamp(s.relationship.bond + a.relationship);
        s.relationship.visits++;
        s.relationship.lastVisit = s.day;
    }
    note(s, a.label, a.desc, a.icon);
    checkMilestones(s);
    return { ok: true, message: a.label + ' · ' + a.time + ' minutes well spent.' };
}
export function sleep(s) {
    if (s.activeDate)
        return { ok: false, message: 'End your current date first.' };
    if (s.bookings.some(b => b.day === s.day && b.status === 'booked'))
        return { ok: false, message: 'Finish or cancel today’s bookings before sleeping.' };
    if (Math.hypot(s.position[0] + 16, s.position[1] - 17) > 4)
        return { ok: false, message: 'Go home to end the day.' };
    const summary = { earned: s.today.earned, spent: s.today.spent, day: s.day };
    s.day++;
    s.stats.days = s.day;
    s.time = 9 * 60;
    s.today = { gig: false, photos: false, event: '', campaign: false, earned: 0, spent: 0 };
    s.needs.energy = clamp(s.needs.energy + 58 + (s.upgrades.includes('linen') ? 15 : 0));
    s.needs.stress = clamp(s.needs.stress - 23);
    s.needs.health = clamp(s.needs.health + (s.needs.stress < 60 ? 3 : -3) + (s.careUntil < s.day ? -4 : 0));
    s.needs.fullness = clamp(s.needs.fullness - 22, 10, 100);
    s.needs.hygiene = clamp(s.needs.hygiene - 10);
    s.relationship.bond = clamp(s.relationship.bond - (s.relationship.disclosure === 'private' ? 3 : 1));
    s.exposure = clamp(s.exposure - (s.upgrades.includes('privacy') ? 5 : 2));
    if ((s.day - 1) % 7 === 0)
        pay(s, REGIONS[s.region].rent, 'Weekly rent', true);
    if (s.security)
        pay(s, 35, 'Daily safety coordinator', true);
    if (s.manager)
        pay(s, 30, 'Daily booking manager', true);
    if (s.exposure > 60 && s.relationship.disclosure === 'private') {
        s.relationship.bond = clamp(s.relationship.bond - 4);
        s.needs.stress = clamp(s.needs.stress + 5);
        note(s, 'Work is coming home', 'Keeping every detail private is taking effort. An honest conversation with Jules could help.', 'chat');
    }
    for (const member of s.team) {
        const fee = Math.round((70 + random(s) * 65) * REGIONS[s.region].demand);
        const overhead = 25;
        transaction(s, fee, 'Team coordination · ' + member.name);
        pay(s, overhead, 'Team studio overhead', true);
        member.dates++;
    }
    s.followers = Math.max(20, s.followers - Math.round(s.followers * .02));
    s.leads = s.leads.filter(l => l.expires >= s.day);
    s.bookings = [...s.bookings.filter(b => !['booked', 'active'].includes(b.status)).slice(-200), ...s.bookings.filter(b => ['booked', 'active'].includes(b.status))];
    const event = EVENTS[(s.day - 2) % EVENTS.length];
    s.today.event = event.effect;
    // A small morning recap rides along with the town event (events are not saved).
    const recap = { day: summary.day, earned: summary.earned, spent: summary.spent, bills: s.today.spent, team: s.today.earned, rentDay: (s.day - 1) % 7 === 0 };
    s.event = { ...event, recap };
    if (event.effect === 'referral') {
        s.followers += 35;
        if (s.stats.dates === 0)
            s.event = { ...event, recap, title: 'A welcome from the neighbourhood', text: 'The Common Room shared your introduction. A few new people are following your public profile.' };
    }
    fillLeads(s);
    note(s, 'A new morning', `${money(summary.earned - summary.spent)} net yesterday. A new day, at your own pace.`, 'sun');
    checkMilestones(s);
    return { ok: true, message: `Day ${s.day}. Rested, reset, and ready.` };
}
export function market(s, type) {
    const campaigns = { quiet: { cost: 35, reach: 45, exposure: 1, label: 'Word of mouth' }, social: { cost: 80, reach: 115, exposure: 8, label: 'Social campaign' }, premium: { cost: 150, reach: 205, exposure: 4, label: 'Curated directory' } };
    const c = Object.hasOwn(campaigns, type) ? campaigns[type] : null;
    if (!c)
        return { ok: false, message: 'Unknown campaign.' };
    if (s.today.campaign)
        return { ok: false, message: 'Your daily campaign is already running.' };
    if (!canSpendTime(s, 40))
        return { ok: false, message: 'Leave time for your next booking.' };
    const cost = Math.round(c.cost * (s.upgrades.includes('studio') ? .8 : 1));
    if (!pay(s, cost, c.label))
        return { ok: false, message: 'Not enough available funds.' };
    advance(s, 40);
    s.today.campaign = true;
    s.followers += Math.round(c.reach * (1 + level(s, 'branding') * .08) * (s.privacy === 'private' ? .65 : 1));
    s.exposure = clamp(s.exposure + c.exposure);
    s.skills.branding += 14;
    fillLeads(s);
    note(s, 'A little more visible', `${c.label} is running. Check your enquiries for new connections.`, 'spark');
    return { ok: true, message: 'Campaign launched. New enquiries may be waiting.' };
}
export function setModel(s, id) {
    if (!Object.hasOwn(MODELS, id))
        return { ok: false, message: 'Unknown operating model.' };
    if (id === s.model)
        return { ok: false, message: 'That is already your operating model.' };
    if (s.bookings.some(b => ['booked', 'active'].includes(b.status)))
        return { ok: false, message: 'Finish or cancel your accepted bookings before changing their support contract.' };
    s.model = id;
    fillLeads(s);
    return { ok: true, message: 'Your new business arrangement is in place.' };
}
export function buyUpgrade(s, id) {
    if (!Object.hasOwn(UPGRADES, id) || s.upgrades.includes(id))
        return { ok: false, message: 'This upgrade is already owned or unavailable.' };
    if (!pay(s, UPGRADES[id].cost, UPGRADES[id].name))
        return { ok: false, message: 'Not enough available funds.' };
    s.upgrades.push(id);
    return { ok: true, message: 'Upgrade installed: ' + UPGRADES[id].name };
}
export function transfer(s, amount) {
    amount = Math.round(Number(amount));
    if (!Number.isFinite(amount) || amount === 0)
        return { ok: false, message: 'Enter a valid amount.' };
    if (amount > available(s) || -amount > s.savings)
        return { ok: false, message: 'Not enough unreserved funds for that transfer.' };
    s.savings += amount;
    transaction(s, -amount, amount > 0 ? 'Moved to savings' : 'Withdrawal from savings', 'transfer');
    checkMilestones(s);
    return { ok: true, message: amount > 0 ? 'A little more freedom, set aside.' : 'Savings returned to your available balance.' };
}
export function repay(s, amount) {
    amount = Math.min(s.debt, Math.max(0, Math.round(Number(amount))));
    if (!Number.isFinite(amount) || amount <= 0 || amount > available(s))
        return { ok: false, message: 'Not enough available cash, or nothing is owed.' };
    transaction(s, -amount, 'Arrears repaid');
    s.debt -= amount;
    return { ok: true, message: 'Outstanding bills reduced by ' + money(amount) };
}
export function renewPermit(s) {
    const fee = REGIONS[s.region].permit;
    if (!fee)
        return { ok: false, message: 'No permit is required in this fictional district.' };
    if (s.permitUntil >= s.day + 6)
        return { ok: false, message: 'Your permit is already current for the coming week.' };
    if (!pay(s, fee, 'Weekly district permit'))
        return { ok: false, message: 'Not enough available funds.' };
    s.permitUntil = Math.max(s.day - 1, s.permitUntil) + 7;
    return { ok: true, message: `Permit valid through day ${s.permitUntil}.` };
}
export function relocate(s, id) {
    if (!Object.hasOwn(REGIONS, id) || id === s.region)
        return { ok: false, message: 'You already live here.' };
    if (s.bookings.some(b => ['booked', 'active'].includes(b.status)))
        return { ok: false, message: 'Finish or cancel all pending bookings before relocating.' };
    const cost = REGIONS[id].move + REGIONS[id].permit;
    if (!pay(s, cost, 'Relocation to ' + REGIONS[id].name))
        return { ok: false, message: 'Not enough available funds for moving and the first permit.' };
    s.region = id;
    s.permitUntil = s.day + 6;
    s.leads = [];
    s.position = [-16, 17];
    s.followers = Math.round(s.followers * .8);
    fillLeads(s);
    note(s, 'A new neighbourhood', `${REGIONS[id].name}. Existing client notes travel with you. Your audience needs time to adapt.`, 'compass');
    return { ok: true, message: 'Welcome to ' + REGIONS[id].name + '.' };
}
export function recruit(s) {
    if (s.rep < 65 || s.stats.dates < 12)
        return { ok: false, message: 'Build 65 reputation and complete 12 dates before offering peer management.' };
    if (s.team.length >= 3)
        return { ok: false, message: 'Your small studio is at capacity.' };
    if (!pay(s, 650, 'Peer studio onboarding'))
        return { ok: false, message: 'Onboarding requires $650 in available funds.' };
    const names = ['Indigo', 'Cleo', 'Ren'];
    s.team.push({ name: names[s.team.length], age: 28 + s.team.length * 4, dates: 0 });
    note(s, 'Growing, together', 'A peer joined the studio voluntarily. Peers keep their own booking income; you earn a coordination fee and cover studio overhead.', 'people');
    checkMilestones(s);
    return { ok: true, message: 'A new peer has joined your studio.' };
}
export function disclosure(s, mode) {
    if (!['open', 'private'].includes(mode) || s.relationship.disclosure === mode)
        return { ok: false, message: 'That is already your preference.' };
    if (s.relationship.lastDisclosure === s.day)
        return { ok: false, message: 'Give this conversation some space. Revisit your boundary tomorrow.' };
    if (!canSpendTime(s, 30))
        return { ok: false, message: 'Leave 30 minutes for an unrushed personal conversation.' };
    advance(s, 30);
    s.relationship.lastDisclosure = s.day;
    s.relationship.disclosure = mode;
    if (mode === 'open') {
        s.relationship.bond = clamp(s.relationship.bond + 8);
        s.needs.stress = clamp(s.needs.stress - 10);
    }
    note(s, 'A personal conversation', mode === 'open' ? 'You and Jules agree on an open, supportive conversation about work.' : 'You set a more private boundary around your working life. Maintaining it takes some energy.', 'chat');
    return { ok: true, message: 'Your personal boundary has been updated.' };
}
export function milestoneValue(s, m) {
    return m.type === 'savings' ? s.savings : m.type === 'rep' ? s.rep : m.type === 'friends' ? s.relationship.visits : m.type === 'team' ? s.team.length : s.stats[m.type] || 0;
}
export function checkMilestones(s) {
    for (const m of MILESTONES) {
        if (!s.achievements.includes(m.id) && milestoneValue(s, m) >= m.goal) {
            s.achievements.push(m.id);
            transaction(s, m.reward, 'Milestone · ' + m.name);
            note(s, m.name, `${m.text} A ${money(m.reward)} milestone bonus is yours.`, 'award');
        }
    }
    const completed = s.goal === 'independent' ? s.stats.dates >= 12 && s.rep >= 65 && s.savings >= 3000 : s.goal === 'exit' ? s.savings >= 8000 && s.relationship.bond >= 60 : s.team.length >= 3 && s.savings >= 2000;
    if (completed && !s.finished) {
        s.finished = true;
        note(s, 'A life of your own', 'Your chosen career goal is complete. You may continue your story for as long as you like.', 'award');
    }
}
/** Validate imported data before it can replace live state. No save code is executed. */
export function validateSave(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== SAVE_VERSION) {
        throw new Error('This save version is unsupported. The existing game has not been changed.');
    }
    const finite = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
    const integer = (v, a, b) => Number.isInteger(v) && finite(v, a, b);
    const text = (v, n) => typeof v === 'string' && v.length <= n;
    const reject = message => {
        throw new Error(message);
    };
    const checkTree = (node, depth = 0) => {
        if (depth > 12)
            reject('This save is nested too deeply.');
        if (node && typeof node === 'object') {
            for (const [key, child] of Object.entries(node)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key))
                    reject('Unsafe save field.');
                checkTree(child, depth + 1);
            }
        }
    };
    checkTree(value);
    const s = structuredClone(value);
    if (!integer(s.day, 1, 100000) || !finite(s.time, 540, 1320) ||
        !Object.hasOwn(REGIONS, s.region) || !Object.hasOwn(MODELS, s.model) ||
        !['relaxed', 'balanced', 'ambitious'].includes(s.difficulty) ||
        !['independent', 'exit', 'studio'].includes(s.goal))
        reject('Invalid career data.');
    for (const k of ['wallet', 'savings', 'debt', 'followers', 'nextId', 'seed']) {
        if (!integer(s[k], 0, 1e12))
            reject('Invalid financial or random-state data.');
    }
    if (!integer(s.rate, 60, 1500) || s.seed > 4294967295)
        reject('Invalid rate or random-state data.');
    if (!s.player || !text(s.player.name, 28) || !integer(s.player.age, 21, 80) ||
        !text(s.player.pronouns, 24) || !['relaxed', 'polished', 'creative'].includes(s.player.style))
        reject('Invalid adult character data.');
    for (const k of ['skin', 'hair', 'shirt']) {
        if (!/^#[0-9a-f]{6}$/i.test(s.player[k]))
            reject('Invalid character colour.');
    }
    for (const k of ['energy', 'stress', 'hygiene', 'fullness', 'social', 'health']) {
        if (!finite(s.needs?.[k], 0, 100))
            reject('Invalid wellbeing data.');
    }
    for (const k of Object.keys(SKILLS))
        if (!finite(s.skills?.[k], 0, 1e9))
            reject('Invalid skill data.');
    // The waterfront pier reaches past the old town edge (x 25 → 41).
    if (!Array.isArray(s.position) || s.position.length !== 2 || !finite(s.position[0], -25, 41) || !finite(s.position[1], -25, 25))
        reject('Invalid world position.');
    for (const k of ['leads', 'bookings', 'ledger', 'journal', 'achievements', 'upgrades', 'team']) {
        if (!Array.isArray(s[k]) || s[k].length > (k === 'bookings' ? 3000 : 250))
            reject('Invalid collection: ' + k);
    }
    const ids = new Set();
    const statuses = ['booked', 'active', 'cancelled', 'missed', 'no-show', 'ended-safely', 'completed'];
    const validateEnquiry = (b, isBooking) => {
        if (!b || !text(b.id, 32) || !b.id || ids.has(b.id) || !PEOPLE.some(p => p.id === b.person) ||
            !DATE_VENUES.includes(b.venue) || !integer(b.offer, 60, 1500) ||
            !integer(b.risk, 0, 100) || !integer(b.budget, 0, 10000) || ![60, 90].includes(b.duration))
            reject('Invalid enquiry or booking.');
        ids.add(b.id);
        b.originModel ??= s.model;
        if (!Object.hasOwn(MODELS, b.originModel))
            reject('Invalid referral arrangement.');
        if (isBooking) {
            b.supportCut ??= MODELS[s.model].cut;
            if (![0, .15, .28].includes(b.supportCut))
                reject('Invalid booking support share.');
        }
        for (const k of ['screened', 'negotiated', 'depositAgreed', 'reference', 'returning', 'noShow']) {
            if (typeof b[k] !== 'boolean')
                reject('Invalid screening or agreement data.');
        }
        if (!['thoughtful', 'upbeat', 'quiet'].includes(b.tone) || !text(b.signal, 300) ||
            !integer(b.created, 1, 100000) || !integer(b.expires, 1, 1000000))
            reject('Invalid enquiry timing or tone.');
        if (isBooking && (!statuses.includes(b.status) || !integer(b.day, 1, 100000) ||
            !finite(b.time, 540, 1260 - b.duration) || !integer(b.deposit, 0, b.offer) ||
            b.deposit !== (b.depositAgreed ? Math.round(b.offer * .25) : 0)))
            reject('Invalid booking state.');
        if (!isBooking && b.status !== undefined)
            reject('An enquiry cannot have a booking status.');
    };
    s.leads.forEach(b => validateEnquiry(b, false));
    s.bookings.forEach(b => validateEnquiry(b, true));
    if (new Set(s.leads.map(b => b.person)).size !== s.leads.length)
        reject('Duplicate client enquiry.');
    if (!['private', 'balanced', 'public'].includes(s.privacy) || typeof s.security !== 'boolean' || typeof s.manager !== 'boolean')
        reject('Invalid business settings.');
    if (liabilities(s) > s.wallet)
        reject('This save is missing money reserved for deposits.');
    if (!s.stats || !Array.isArray(s.stats.ratings) || s.stats.ratings.length > 100 || s.stats.ratings.some(r => !finite(r, 1, 5)))
        reject('Invalid rating data.');
    for (const k of ['dates', 'screens', 'regulars', 'earned', 'spent', 'noShows', 'cancelled', 'safeExits', 'days']) {
        if (!integer(s.stats[k], 0, 1e12))
            reject('Invalid career statistics.');
    }
    if (!s.clients || Array.isArray(s.clients) || typeof s.clients !== 'object')
        reject('Invalid client book.');
    for (const [id, c] of Object.entries(s.clients)) {
        if (!PEOPLE.some(p => p.id === id) || !c || !text(c.notes, 800) || !integer(c.dates, 0, 100000) ||
            !finite(c.trust, 0, 100) || !integer(c.earned, 0, 1e12) || typeof c.blocked !== 'boolean')
            reject('Invalid client notes.');
    }
    if (s.bookings.some(b => !s.clients[b.person]))
        reject('A booking is missing its client record.');
    for (const k of ['rep', 'exposure'])
        if (!finite(s[k], 0, 100))
            reject('Invalid reputation or visibility.');
    if (!s.relationship || !text(s.relationship.name, 28) || !finite(s.relationship.bond, 0, 100) ||
        !integer(s.relationship.visits, 0, 100000) || !integer(s.relationship.lastVisit, 0, 100000) ||
        !['open', 'private'].includes(s.relationship.disclosure))
        reject('Invalid relationship data.');
    // Older schema-3 builds did not have a daily conversation cooldown.
    s.relationship.lastDisclosure ??= 0;
    if (!integer(s.relationship.lastDisclosure, 0, 100000))
        reject('Invalid relationship conversation date.');
    if (!s.today || !integer(s.today.earned, 0, 1e12) || !integer(s.today.spent, 0, 1e12) ||
        !['welcome', '', ...EVENTS.map(e => e.effect)].includes(s.today.event) ||
        ['gig', 'photos', 'campaign'].some(k => typeof s.today[k] !== 'boolean') ||
        !integer(s.permitUntil, 0, 1000000) || !integer(s.careUntil, 0, 1000000) ||
        !integer(s.lastPhotos, -100, 1000000))
        reject('Invalid daily state.');
    if (s.upgrades.some(x => !Object.hasOwn(UPGRADES, x)) || new Set(s.upgrades).size !== s.upgrades.length ||
        s.achievements.some(x => !MILESTONES.some(m => m.id === x)) || new Set(s.achievements).size !== s.achievements.length ||
        s.team.length > 3 || s.team.some(t => !text(t.name, 28) || !integer(t.age, 21, 80) || !integer(t.dates, 0, 100000)))
        reject('Invalid progression.');
    if (typeof s.finished !== 'boolean' || !integer(s.tutorial, 0, 3))
        reject('Invalid progression flags.');
    // New in 0.7: whether the results screen for the finished goal has been shown.
    s.celebrated = typeof s.celebrated === 'boolean' ? s.celebrated : s.finished;
    for (const l of s.ledger) {
        if (!integer(l.amount, -1e12, 1e12) || !text(l.label, 200) || !integer(l.day, 1, 100000) ||
            !integer(l.id, 0, 1e12) || !finite(l.time, 540, 1320) ||
            !['operating', 'transfer', 'deposit', 'refund'].includes(l.kind))
            reject('Invalid ledger.');
    }
    for (const l of s.journal) {
        if (!text(l.title, 200) || !text(l.text, 1000) || !integer(l.day, 1, 100000) ||
            !text(l.icon, 40) || !integer(l.id, 0, 1e12) || !finite(l.time, 540, 1320))
            reject('Invalid journal.');
    }
    const active = s.bookings.filter(b => b.status === 'active');
    if (s.activeDate) {
        const d = s.activeDate;
        if (active.length !== 1 || active[0].id !== d.booking || !integer(d.step, 0, 2) ||
            !finite(d.quality, -100, 200) || !Array.isArray(d.choices) || d.choices.length !== d.step ||
            d.choices.some(c => !text(c, 40)) || !text(d.lastReply, 1000) ||
            typeof d.boundary !== 'boolean' || d.consent !== true)
            reject('Invalid in-progress date.');
    }
    else if (active.length)
        reject('A date is missing its active state.');
    const settings = s.settings;
    s.settings = {
        quality: ['auto', 'desktop', 'mobile'].includes(settings?.quality) ? settings.quality : 'auto',
        audio: !!settings?.audio,
        volume: finite(settings?.volume, 0, 1) ? settings.volume : .25,
        reduceMotion: !!settings?.reduceMotion,
        highContrast: !!settings?.highContrast,
        textScale: [1, 1.15, 1.3].includes(settings?.textScale) ? settings.textScale : 1,
        showLabels: settings?.showLabels !== false,
    };
    s.report = null;
    s.event = null;
    return s;
}
export function serialize(s) {
    return JSON.stringify({ game: 'good-company', version: SAVE_VERSION, savedAt: new Date().toISOString(), state: s });
}
export function deserialize(raw) {
    if (typeof raw !== 'string' || raw.length > 2000000)
        throw new Error('Save file is too large or unreadable.');
    const o = JSON.parse(raw);
    if (o.game !== 'good-company')
        throw new Error('This is not a Company Hours save.');
    return validateSave(o.state);
}


/**
 * The walkable ground: the town square, the waterfront boardwalk, and (new in 0.7) the
 * Lantern Pier with its end platform. Rectangles in world units; obstacles are cut out.
 */
export const WALK_AREAS = [
    { x0: -25, x1: 25, z0: -25, z1: 25 },
    { x0: 25, x1: 28.3, z0: -25, z1: 25 },
    { x0: 28.2, x1: 36.5, z0: -5.05, z1: -2.95 },
    { x0: 36, x1: 41, z0: -7, z1: -1 },
];
/** Bounded A* grid on whole-unit cells. Diagonal moves never cut a blocked corner. */
export class Navigation {
    constructor(obstacles = [], areas = WALK_AREAS) {
        this.obstacles = obstacles;
        this.areas = areas;
        this.minX = Math.min(...areas.map(a => a.x0));
        this.maxX = Math.max(...areas.map(a => a.x1));
        this.minZ = Math.min(...areas.map(a => a.z0));
        this.maxZ = Math.max(...areas.map(a => a.z1));
        // Whole-unit cells are tested over and over by A*: remember them (0 unknown, 1 open, 2 blocked).
        this.gx = Math.floor(this.minX) - 1;
        this.gz = Math.floor(this.minZ) - 1;
        this.gw = Math.ceil(this.maxX) - this.gx + 2;
        this.gh = Math.ceil(this.maxZ) - this.gz + 2;
        this.grid = new Uint8Array(this.gw * this.gh);
    }
    walkable(x, z) {
        let inside = false;
        for (const a of this.areas) {
            if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) {
                inside = true;
                break;
            }
        }
        if (!inside)
            return false;
        for (const r of this.obstacles) {
            if (Math.abs(x - r.x) < r.w / 2 + .55 && Math.abs(z - r.z) < r.d / 2 + .55)
                return false;
        }
        return true;
    }
    /** walkable() for whole-unit cells, cached. */
    cell(x, z) {
        const i = x - this.gx, j = z - this.gz;
        if (i < 0 || j < 0 || i >= this.gw || j >= this.gh)
            return false;
        const k = j * this.gw + i;
        if (!this.grid[k])
            this.grid[k] = this.walkable(x, z) ? 1 : 2;
        return this.grid[k] === 1;
    }
    nearest(x, z) {
        x = Math.max(Math.ceil(this.minX), Math.min(Math.floor(this.maxX), Math.round(x)));
        z = Math.max(Math.ceil(this.minZ), Math.min(Math.floor(this.maxZ), Math.round(z)));
        if (this.cell(x, z))
            return [x, z];
        for (let r = 1; r < 20; r++)
            for (let a = -r; a <= r; a++)
                for (const b of [-r, r]) {
                    if (this.cell(x + a, z + b))
                        return [x + a, z + b];
                    if (this.cell(x + b, z + a))
                        return [x + b, z + a];
                }
        return null;
    }
    path(start, end) {
        const s = this.nearest(...start), g = this.nearest(...end);
        if (!s || !g)
            return [];
        const W = 4096, key = (x, z) => (x + 2048) * W + (z + 2048);
        const sk = key(...s), gk = key(...g);
        const came = new Map(), score = new Map([[sk, 0]]), closed = new Set();
        // A binary heap of [f, key]; stale entries are skipped when popped.
        const heap = [[0, sk]];
        const push = (f, k) => {
            heap.push([f, k]);
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p][0] <= heap[i][0])
                    break;
                [heap[p], heap[i]] = [heap[i], heap[p]];
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0], last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let i = 0;
                for (;;) {
                    const l = i * 2 + 1, r = l + 1;
                    let m = i;
                    if (l < heap.length && heap[l][0] < heap[m][0])
                        m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0])
                        m = r;
                    if (m === i)
                        break;
                    [heap[m], heap[i]] = [heap[i], heap[m]];
                    i = m;
                }
            }
            return top;
        };
        const unkey = k => [Math.floor(k / W) - 2048, (k % W) - 2048];
        let visits = 0;
        while (heap.length && visits < 6000) {
            const cur = pop()[1];
            if (closed.has(cur))
                continue;
            visits++;
            if (cur === gk) {
                const out = [];
                let k = cur;
                while (k !== sk) {
                    out.push(unkey(k));
                    k = came.get(k);
                }
                return out.reverse();
            }
            closed.add(cur);
            const [x, z] = unkey(cur);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const nx = x + dx, nz = z + dz, k = key(nx, nz);
                if (closed.has(k) || !this.cell(nx, nz) || (dx && dz && (!this.cell(x + dx, z) || !this.cell(x, z + dz))))
                    continue;
                const n = score.get(cur) + (dx && dz ? Math.SQRT2 : 1);
                if (n < (score.get(k) ?? Infinity)) {
                    came.set(k, cur);
                    score.set(k, n);
                    push(n + Math.hypot(nx - g[0], nz - g[1]), k);
                }
            }
        }
        return [];
    }
}



/** A closed, outward-wound triangular-prism roof. No renderer is needed to test it. */
export function roofVertices() {
    const leftBack = [-.5, -.5, -.5], rightBack = [.5, -.5, -.5];
    const leftFront = [-.5, -.5, .5], rightFront = [.5, -.5, .5];
    const ridgeBack = [0, .5, -.5], ridgeFront = [0, .5, .5];
    return new Float32Array([
        ...leftBack, ...ridgeBack, ...rightBack,
        ...leftFront, ...rightFront, ...ridgeFront,
        ...leftBack, ...ridgeFront, ...ridgeBack,
        ...leftBack, ...leftFront, ...ridgeFront,
        ...rightBack, ...ridgeFront, ...rightFront,
        ...rightBack, ...ridgeBack, ...ridgeFront,
        ...leftBack, ...rightFront, ...leftFront,
        ...leftBack, ...rightBack, ...rightFront,
    ]);
}
/** Walkable-space blockers include buildings and the most substantial street furniture. */
export function townObstacles() {
    return [
        ...Object.values(VENUES).filter(v => v.w).map(({ x, z, w, d }) => ({ x, z, w, d })),
        { x: 0, z: 0, w: 4.2, d: 4.2 },
        { x: 0, z: 13, w: 2, d: 2 },
        ...[-5.3, 5.3].map(x => ({ x, z: 12.5, w: 2, d: 7 })),
        ...[-20, -12, 12, 20].map(x => ({ x, z: 2, w: 1.8, d: 1.8 })),
        ...[[-21, 7], [-11, 7], [-23, 18], [-23, -10], [-24, -24], [-8, -23], [7, -24], [24, -24], [24, -10], [24, 8], [24, 23], [7, 23], [-6, 23], [-24, 24], [7, -2]].map(([x, z]) => ({ x, z, w: .7, d: .7 })),
        // Lantern Pier: the Tidewater kiosk and the café table on the end platform.
        { x: 38.8, z: -6.3, w: 3, d: 2 },
        { x: 39.2, z: -1.4, w: 1.8, d: 1.8 },
    ];
}
