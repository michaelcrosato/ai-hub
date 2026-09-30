import { VERSION, CHAPTERS, SEASONS, ACTIONS, UPGRADES, ROUTINES, EVENTS, MEMORIES } from './data.js';
export const STAT_KEYS = ['home', 'meals', 'bond', 'energy', 'joy', 'care', 'social', 'condition'];
const clamp = (n, a = 0, b = 100) => Math.min(b, Math.max(a, n));
const copy = s => JSON.parse(JSON.stringify(s));
const round = n => Math.round(n * 10) / 10;
const NAME = s => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 22);
export function eraIndex(s) { return Math.min(8, Math.floor(s.turn / 4)); }
export function chapter(s) { return CHAPTERS[eraIndex(s)]; }
export function dayIndex(s) { return s.turn < 32 ? s.turn % 4 : s.turn - 32; }
export function year(s) { return chapter(s).years[dayIndex(s)] ?? 2012; }
export function season(s) { return SEASONS[dayIndex(s) % 4]; }
export function age(s) { return 22 + year(s) - 1952; }
export function liveChildren(s) { return s.children.filter(c => year(s) - c.born < 18); }
export function owns(s, id) { return s.owned.includes(id); }
export function functioning(s, id) { return owns(s, id) && s.broken !== id; }
export function homeSize(s) { return 1 + UPGRADES.filter(u => u.space && owns(s, u.id)).length; }
export function nextEvent(s) { return s.decisions.some(d => d.turn === s.turn) ? null : EVENTS[s.turn]; }
export function householdSize(s) { return (s.partnerAlive ? 2 : 1) + liveChildren(s).length; }
export function careLoad(s) { return liveChildren(s).reduce((n, c) => n + (year(s) - c.born < 3 ? 1.9 : year(s) - c.born < 13 ? 1.2 : .8), 0) + (s.elder ? .8 : 0) + (eraIndex(s) > 5 ? .65 : 0); }
export function createState(options = {}) {
    const s = { version: VERSION, storyId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), profile: { name: NAME(options.name) || 'June', partner: NAME(options.partner) || 'Sam', surname: NAME(options.surname) || 'Parker', skin: options.skin || '#d5a078' }, mode: options.mode === 'gentle' ? 'gentle' : 'balanced', turn: 0, minutes: 480, cash: 210, savings: 60, debt: 0, pantry: 5, stats: { home: 67, meals: 61, bond: 76, energy: 88, joy: 68, care: 73, social: 53, condition: 89 }, skills: { cooking: 0, organizing: 0, caring: 0, making: 0 }, owned: [], routines: [], children: [], elder: false, grandchild: false, partnerAlive: true, helpBase: 1, helpRemaining: 1, prepared: 0, clutter: 8, broken: null, flags: [], decisions: [], memories: [{ year: 1952, title: 'The key to our first home', type: 'milestone' }], counts: {}, eraCounts: {}, dayCounts: {}, eraGoals: {}, rewarded: [], history: [], log: [{ id: 0, text: 'The keys are yours. A whole life is waiting inside.', kind: 'story' }], ended: false, finished: false, ending: null, epilogue: false, lastSummary: null, assistance: 0, actionSerial: 0 };
    return checkGoals(s);
}
export function addLog(s, text, kind = 'action') {
    s.actionSerial = (s.actionSerial || 0) + 1;
    s.log.unshift({ id: s.actionSerial, text, kind });
    s.log = s.log.slice(0, 60);
}
function effect(s, values) { for (const [k, v] of Object.entries(values || {})) {
    if (STAT_KEYS.includes(k))
        s.stats[k] = round(clamp(s.stats[k] + v));
} }
function count(s, key, n = 1) { s.counts[key] = (s.counts[key] || 0) + n; s.eraCounts[key] = (s.eraCounts[key] || 0) + n; s.dayCounts[key] = (s.dayCounts[key] || 0) + n; }
function remember(s, title, type = 'moment') { s.memories.push({ year: year(s), title, type }); }
export function goalValue(s, key) { if (STAT_KEYS.includes(key))
    return Math.round(s.stats[key]); if (key === 'savings')
    return s.savings; return s.eraCounts[key] || 0; }
export function goalStatus(s) { const done = s.eraGoals[eraIndex(s)] || []; return chapter(s).goals.map(([key, target, label], i) => ({ key, target, label, value: goalValue(s, key), done: done.includes(i) })); }
function checkGoals(s) { const e = eraIndex(s); const done = s.eraGoals[e] || []; chapter(s).goals.forEach(([k, target], i) => { if (goalValue(s, k) >= target && !done.includes(i))
    done.push(i); }); s.eraGoals[e] = done; if (done.length === 3 && !s.rewarded.includes(e)) {
    s.rewarded.push(e);
    s.cash += 35;
    remember(s, chapter(s).name + ': a chapter worth keeping', 'chapter');
    addLog(s, 'Chapter wishes fulfilled. A little celebration fund: +$35.', 'milestone');
} return s; }
export function actionLabel(s, a) { if (a.id === 'care') {
    if (!s.partnerAlive)
        return 'Accept a little care';
    if (s.elder)
        return 'Check in on Aunt Ruth';
    const children = liveChildren(s);
    if (children.some(c => year(s) - c.born < 3))
        return 'Settle the little one';
    if (children.some(c => year(s) - c.born < 13))
        return 'A little help with growing up';
    if (children.length)
        return 'Listen, without trying to fix';
    if (eraIndex(s) > 5)
        return 'Look after each other';
} if (a.id === 'talk' && !s.partnerAlive)
    return 'Talk with someone who understands'; if (a.id === 'date' && !s.partnerAlive)
    return 'Revisit a favorite place'; return a.name; }
export function quoteAction(s, id, delegate = false) {
    const a = ACTIONS.find(a => a.id === id);
    if (!a)
        return { ok: false, reason: 'That activity is not available.' };
    let time = a.time, cost = a.cost || 0, food = a.food || 0, energy = a.energy || 0;
    if (a.id === 'cook')
        food += Math.floor(liveChildren(s).length / 2);
    if (a.id === 'clean')
        time += (homeSize(s) - 1) * 15;
    if ((a.id === 'tidy' || a.id === 'clean') && functioning(s, 'vacuum'))
        time -= 15;
    if (a.id === 'laundry' && functioning(s, 'washer')) {
        time -= 30;
        energy -= 6;
    }
    if ((a.id === 'cook' || a.id === 'batch') && functioning(s, 'dishwasher')) {
        time -= 15;
        energy -= 3;
    }
    if (a.id === 'sew' && functioning(s, 'sewing'))
        time -= 30;
    if (a.id === 'call' && functioning(s, 'phone'))
        time -= 15;
    if (a.id === 'memory' && owns(s, 'album'))
        time -= 15;
    if (a.id === 'rest' && owns(s, 'comfortable'))
        energy -= 9;
    if (a.skill && s.skills[a.skill] >= 6)
        time -= 15;
    if (eraIndex(s) === 3 && (a.id === 'shop' || a.id === 'host'))
        cost = Math.ceil(cost * 1.22);
    if (age(s) >= 65 && energy > 0)
        energy += 4;
    if (owns(s, 'accessible') && ['house', 'family'].includes(a.cat) && energy > 0)
        energy = Math.max(0, energy - 5);
    if (s.mode === 'gentle' && energy > 0)
        energy = Math.ceil(energy * .8);
    time = Math.max(15, time);
    if (delegate) {
        if (!a.delegate)
            return { ok: false, reason: 'This is an activity to do yourself.' };
        time = 15;
        energy = 0;
    }
    let reason = '';
    if (s.finished || s.ended)
        reason = 'Begin the next day first.';
    else if (a.season && season(s) !== a.season)
        reason = `A ${a.season.toLowerCase()} tradition. It comes round again next ${a.season.toLowerCase()}.`;
    else if (a.requires && !owns(s, a.requires))
        reason = 'This needs a family dog. Look under Home improvements.';
    else if (delegate && s.helpRemaining < 1)
        reason = 'No helping hands left. Ask your circle or share the load.';
    else if (a.once && (s.dayCounts[a.id] || 0) > 0)
        reason = 'You have already done this today.';
    else if (s.minutes < time)
        reason = `Needs ${time} minutes. There are ${s.minutes} left.`;
    else if (s.cash < cost)
        reason = `Needs $${cost}. Transfer some savings or choose a free activity.`;
    else if (s.pantry < food)
        reason = `Needs ${food} pantry portions. Pick up groceries first.`;
    else if (energy > 0 && s.stats.energy < energy)
        reason = 'You need a rest first. Tea and a sit-down is free.';
    return { ok: !reason, reason, time, energy, cost, food, delegate, a };
}
/** Whether an activity belongs in today's menu at all (seasonal traditions, the dog walk). */
export function available(s, a) { return (!a.season || season(s) === a.season) && (!a.requires || owns(s, a.requires)); }
export function performAction(state, id, delegate = false) {
    const q = quoteAction(state, id, delegate);
    if (!q.ok)
        return { state, error: q.reason };
    const s = copy(state), a = q.a, h = q.time / 60, pressure = s.mode === 'gentle' ? .65 : 1;
    s.minutes -= q.time;
    s.cash -= q.cost;
    s.pantry -= q.food;
    s.stats.energy = round(clamp(s.stats.energy - q.energy));
    effect(s, { home: -h * (2.4 + careLoad(s) * .9 + homeSize(s) * .35 + s.clutter / 50) * pressure, meals: -h * (2.7 + careLoad(s) * .65) * pressure, care: -h * (.8 + careLoad(s) * 1.1) * pressure, bond: -h * .45, social: -h * .5, joy: -h * .3, condition: -h * (.3 + s.owned.length * .045) * pressure });
    const boost = delegate ? .9 : 1;
    effect(s, Object.fromEntries(Object.entries(a.effects || {}).map(([k, v]) => [k, v * boost])));
    if (a.addFood)
        s.pantry += a.addFood + (a.id === 'shop' && functioning(s, 'freezer') ? 3 : 0);
    if (a.harvest)
        s.pantry += a.harvest + (owns(s, 'gardenbeds') ? 2 : 0);
    if (a.earn)
        s.cash += a.earn + (functioning(s, 'sewing') ? 8 : 0) + (owns(s, 'workshop') ? 14 : 0) + (functioning(s, 'computer') ? 12 : 0) + Math.min(20, s.skills.making * 2);
    if (a.prepared)
        s.prepared = Math.min(3, s.prepared + a.prepared);
    if (a.clutter)
        s.clutter = clamp(s.clutter + a.clutter, 0, 100);
    if (a.skill && !delegate)
        s.skills[a.skill] = clamp(s.skills[a.skill] + 1, 0, 30);
    if (delegate) {
        s.helpRemaining--;
        count(s, 'delegate');
        effect(s, { bond: 3 });
    }
    for (const tag of new Set([a.id, ...(a.tags || [])]))
        count(s, tag);
    if (a.id === 'rebalance') {
        s.helpBase = Math.min(4, s.helpBase + 1);
        s.helpRemaining = Math.min(6, s.helpRemaining + 1);
    }
    if (a.id === 'support')
        s.helpRemaining = Math.min(6, s.helpRemaining + 2);
    if (a.id === 'repair')
        s.broken = null;
    if (a.id === 'memory')
        remember(s, MEMORIES[((s.counts.memory || 1) - 1) % MEMORIES.length]);
    if (a.memory && s.counts[a.id] === 1)
        remember(s, a.memory, 'tradition');
    if (['care', 'outing', 'call', 'host', 'talk'].includes(a.id))
        s.children.forEach(c => c.connection = clamp(c.connection + 4));
    s.pantry = Math.min(35, s.pantry);
    s.cash = round(s.cash);
    addLog(s, `${delegate ? 'Shared the work: ' : ''}${a.flavor}`);
    return { state: checkGoals(s), message: delegate ? 'A shared task, and a little breathing room.' : a.flavor, action: q };
}
export function applyChoice(state, index) {
    const ev = nextEvent(state), c = ev?.choices[index];
    if (!c)
        return { state, error: 'That story choice is not available.' };
    if ((c.cost || 0) > state.cash)
        return { state, error: 'This choice needs more cash. A free option is always available.' };
    const s = copy(state);
    effect(s, c.effects);
    s.cash += (c.cash || 0) - (c.cost || 0);
    s.pantry = clamp(s.pantry + (c.food || 0), 0, 35);
    if (c.save) {
        const n = Math.min(c.save, Math.max(0, s.cash));
        s.cash -= n;
        s.savings += n;
    }
    if (c.flag && !s.flags.includes(c.flag))
        s.flags.push(c.flag);
    if (c.skill)
        s.skills[c.skill] = clamp(s.skills[c.skill] + (c.skillAmount || 1), 0, 30);
    if (c.duty) {
        s.helpBase = Math.min(4, s.helpBase + c.duty);
        s.helpRemaining = Math.min(6, s.helpRemaining + c.duty);
    }
    if (c.child && s.children.length < 2) {
        const name = s.children.length === 0 ? 'Ellis' : 'Robin';
        s.children.push({ name, born: year(s), connection: 75 });
        remember(s, `${name} joins our family`, 'milestone');
    }
    else if (c.child) {
        effect(s, { care: 12, social: 12 });
        addLog(s, 'Your home is already full. A younger friend becomes part of your circle.', 'story');
    }
    if (c.elder)
        s.elder = true;
    if (c.grandchild)
        s.grandchild = true;
    if (c.fix)
        s.broken = null;
    if (c.break) {
        s.broken = s.owned.find(x => ['washer', 'vacuum', 'sewing', 'phone', 'dishwasher', 'computer'].includes(x)) || null;
    }
    if (c.clutter)
        s.clutter = clamp(s.clutter + c.clutter, 0, 100);
    if (c.memory)
        remember(s, c.memory, 'story');
    if (ev.bereavement) {
        s.partnerAlive = false;
        s.elder = false;
    }
    s.decisions.push({ turn: s.turn, title: ev.title, choice: c.label });
    addLog(s, `${ev.title} — ${c.label}.`, 'story');
    return { state: checkGoals(s), message: c.detail };
}
export function upgradeReason(s, id) { const u = UPGRADES.find(u => u.id === id); if (!u)
    return 'Unknown improvement.'; if (owns(s, id))
    return 'Already part of your home.'; if (eraIndex(s) < u.era)
    return `Available in ${CHAPTERS[u.era].range}.`; if (s.ended || s.finished)
    return 'Begin a new day first.'; if (s.cash < u.cost)
    return `Needs $${u.cost}. You can transfer money from savings.`; return ''; }
export function buyUpgrade(state, id) { const reason = upgradeReason(state, id); if (reason)
    return { state, error: reason }; const s = copy(state), u = UPGRADES.find(u => u.id === id); s.cash -= u.cost; s.owned.push(id); s.clutter = clamp(s.clutter + (u.clutter || 0)); if (u.space)
    remember(s, `A new room: ${u.name}`, 'milestone'); if (u.id === 'dog')
    remember(s, 'Biscuit comes home', 'milestone'); effect(s, { joy: 8, home: 5 }); addLog(s, `${u.name} is now part of your home. Its daily upkeep is ${u.upkeep < 0 ? '−$' + Math.abs(u.upkeep) : '$' + u.upkeep}.`, 'purchase'); return { state: checkGoals(s), message: `A new ${u.name.toLowerCase()}.` }; }
export function sellUpgrade(state, id) {
    const u = UPGRADES.find(u => u.id === id);
    if (!u || !owns(state, id))
        return { state, error: 'That is not part of your home.' };
    if (u.keeps)
        return { state, error: 'Biscuit is family. Family stays.' };
    if (u.space || ['insulation', 'accessible'].includes(id))
        return { state, error: 'Permanent home improvements cannot be sold.' };
    if (state.ended || state.finished)
        return { state, error: 'Begin the next day first.' };
    const s = copy(state), refund = id === 'help' ? 0 : Math.floor(u.cost * .4);
    s.owned = s.owned.filter(x => x !== id);
    s.cash += refund;
    s.clutter = clamp(s.clutter - u.clutter);
    if (id === 'help')
        s.helpRemaining = Math.max(0, s.helpRemaining - 1);
    if (s.broken === id)
        s.broken = null;
    addLog(s, id === 'help' ? 'Ended the regular paid-help arrangement. Future fees stop; the arrangement fee is not refundable.' : `Passed on the ${u.name.toLowerCase()}. It sold for $${refund}.`);
    return { state: s, message: id === 'help' ? 'The regular-help arrangement has ended.' : 'One less thing to look after.' };
}
export function transfer(state, amount) { if (!Number.isFinite(amount) || amount === 0)
    return { state, error: 'Choose a valid amount.' }; const s = copy(state), n = Math.abs(Math.round(amount)); if (amount > 0) {
    if (s.cash < n)
        return { state, error: 'There is not enough cash to set that aside.' };
    s.cash -= n;
    s.savings += n;
}
else {
    if (s.savings < n)
        return { state, error: 'There is not that much in savings.' };
    s.savings -= n;
    s.cash += n;
} return { state: checkGoals(s), message: amount > 0 ? 'A little more set aside.' : 'Savings are there to be used when needed.' }; }
export function toggleRoutine(state, id) { if (!ROUTINES.some(r => r.id === id))
    return { state, error: 'Unknown routine.' }; const s = copy(state); if (s.routines.includes(id))
    s.routines = s.routines.filter(x => x !== id);
else if (s.routines.length < 2)
    s.routines.push(id);
else
    return { state, error: 'Choose up to two routines. Remove one first.' }; return { state: s, message: 'Your routines will begin next morning.' }; }
export function budget(s) { const e = eraIndex(s), gross = s.partnerAlive ? chapter(s).income : 103; const housing = chapter(s).housing + (homeSize(s) - 1) * 4; const utilities = 17 + (season(s) === 'Winter' ? 8 : 0); const children = liveChildren(s).length * 12; const elder = s.elder ? 10 : 0; const upkeep = UPGRADES.filter(u => owns(s, u.id)).reduce((v, u) => v + u.upkeep, 0); const repairs = s.stats.condition < 30 ? 18 : 0; const discount = (s.dayCounts.budget || 0) > 0 ? 9 : 0; const repayment = Math.min(s.debt, 15); const total = housing + utilities + children + elder + upkeep + repairs - discount + repayment; return { gross, housing, utilities, children, elder, upkeep, repairs, discount, repayment, total, net: gross - total }; }
export function endDay(state) {
    if (state.ended || state.finished)
        return { state, error: 'This day is already complete.' };
    if (nextEvent(state))
        return { state, error: 'There is one story choice to make before the day ends.', event: true };
    const s = copy(state), b = budget(s);
    s.cash += b.net;
    s.debt -= b.repayment;
    let aid = 0;
    if (s.cash < 0 && s.savings > 0) {
        const transfer = Math.min(s.savings, -s.cash);
        s.savings -= transfer;
        s.cash += transfer;
        addLog(s, `Used $${Math.ceil(transfer)} of the rainy-day fund for the bills.`, 'budget');
    }
    if (s.cash < 45) {
        aid = 100 - Math.floor(s.cash);
        s.cash += aid;
        s.debt += aid;
        s.assistance++;
        addLog(s, `A community advance of $${aid} keeps the essentials covered. Repayments are $15 per representative day.`, 'budget');
    }
    const rest = Math.min(24, Math.floor(s.minutes / 10));
    effect(s, { energy: rest, joy: s.minutes >= 90 ? 5 : 0 });
    const avg = { turn: s.turn, year: year(s), home: s.stats.home, meals: s.stats.meals, bond: s.stats.bond, joy: s.stats.joy, care: s.stats.care, social: s.stats.social, energy: s.stats.energy, security: clamp((s.cash + s.savings - s.debt) / 5) };
    s.history.push(avg);
    const low = Object.entries(s.stats).filter(([k, v]) => v < 35 && k !== 'condition').map(([k]) => k);
    let reflection = low.includes('energy') ? 'You carried a lot today. Tomorrow needs a little more room for you.' : low.includes('meals') ? 'Tomorrow may feel easier with a stocked pantry and a simple meal.' : low.includes('bond') ? 'A real conversation may matter more than another finished chore.' : s.stats.joy > 70 ? 'You made room for yourself as well as everyone else. That matters.' : s.stats.social > 75 ? 'A home does not have to hold a whole life by itself. Your circle made this one lighter.' : 'Some things are done. Some things can wait. A home is lived in, not finished.';
    s.lastSummary = { ...b, aid, rest, reflection, year: year(s), season: season(s), actions: Object.values(s.dayCounts).reduce((v, n) => v + n, 0), minutesUsed: 480 - s.minutes };
    s.ended = true;
    addLog(s, `${season(s)} ${year(s)}: the house settles for the night.`, 'story');
    return { state: checkGoals(s) };
}
function morning(s) {
    s.minutes = 480;
    s.ended = false;
    s.dayCounts = {};
    s.lastSummary = null;
    const load = careLoad(s), p = s.mode === 'gentle' ? .65 : 1;
    effect(s, { home: -(10 + load * 2 + homeSize(s) * 1.3) * p, meals: -(18 + load * 2) * p, bond: -4, joy: -4, care: -(10 + load * 2) * p, social: -8, condition: -(3 + s.owned.length * .6) * p, energy: 35 - (load > 2 ? 8 : 0) });
    s.clutter = clamp(s.clutter + 3 + liveChildren(s).length * 2 + s.owned.length * .25, 0, 100);
    s.helpRemaining = Math.min(6, s.helpBase + (owns(s, 'help') ? 1 : 0) + (eraIndex(s) >= 6 && s.partnerAlive ? 1 : 0));
    s.children.forEach(c => c.connection = clamp(c.connection - 2));
    if (s.elder && eraIndex(s) >= 6) {
        s.elder = false;
        remember(s, 'The care we gave Aunt Ruth', 'story');
    }
    for (const u of UPGRADES.filter(u => owns(s, u.id)))
        if (s.broken !== u.id)
            effect(s, u.daily);
    if (owns(s, 'gardenbeds'))
        s.pantry = Math.min(35, s.pantry + 3);
    if (s.prepared > 0) {
        s.prepared--;
        effect(s, { meals: 26 });
        addLog(s, 'Yesterday’s batch cooking has today’s first meal covered.', 'routine');
    }
    for (const id of s.routines) {
        const r = ROUTINES.find(x => x.id === id);
        if (!r)
            continue;
        if (s.pantry < (r.food || 0)) {
            addLog(s, `${r.name} could not run: the pantry needs restocking.`, 'warning');
            continue;
        }
        if (s.stats.energy < (r.energy || 0)) {
            addLog(s, `${r.name} could not run: you need some rest.`, 'warning');
            continue;
        }
        s.minutes -= r.time;
        s.pantry -= r.food || 0;
        effect(s, { ...r.effects, energy: -(r.energy || 0) });
        addLog(s, `${r.name}: a familiar morning rhythm (${r.time} min).`, 'routine');
    }
    if (s.stats.condition < 45 && !s.broken) {
        const machine = s.owned.find(x => ['washer', 'vacuum', 'sewing', 'dishwasher', 'computer', 'phone'].includes(x));
        if (machine) {
            s.broken = machine;
            addLog(s, `The ${UPGRADES.find(x => x.id === machine).name.toLowerCase()} needs a repair. Its benefits are paused.`, 'warning');
        }
    }
    if (s.turn === 34) {
        s.partnerAlive = false;
        s.elder = false;
        s.helpRemaining = Math.max(2, s.helpRemaining);
    }
    const tradition = ACTIONS.find(a => a.season === season(s));
    if (tradition && !s.finished)
        addLog(s, `A ${season(s).toLowerCase()} tradition is waiting, if you want it: ${tradition.short.toLowerCase()}.`, 'routine');
    addLog(s, `${season(s)}, ${year(s)}. Another ordinary day, in a changing life.`, 'story');
    return checkGoals(s);
}
export function advanceDay(state) { if (!state.ended)
    return { state, error: 'Settle this day before moving on.' }; const s = copy(state); if (s.turn === 31) {
    s.finished = true;
    s.ending = 'anniversary';
    remember(s, 'Fifty years, a life together', 'milestone');
    return { state: s };
} if (s.turn === 34) {
    s.finished = true;
    s.ending = 'legacy';
    remember(s, 'A life of making a home', 'milestone');
    return { state: s };
} s.turn++; if (s.turn % 4 === 0) {
    s.eraCounts = {};
    if (s.savings > 0)
        s.savings += Math.floor(s.savings * .03);
    remember(s, chapter(s).name, 'milestone');
} return { state: morning(s) }; }
export function beginEpilogue(state) { if (!state.finished || state.ending !== 'anniversary')
    return { state, error: 'The optional epilogue begins after your golden anniversary.' }; const s = copy(state); s.turn = 32; s.finished = false; s.ended = false; s.ending = null; s.epilogue = true; s.eraCounts = {}; remember(s, 'The later years, together', 'milestone'); return { state: morning(s) }; }
export function lifeReflection(s) { const histories = s.history.filter(h => h.turn < 32); const list = histories.length ? histories : [s.stats]; const average = k => Math.round(list.reduce((n, h) => n + (h[k] || 0), 0) / list.length); const values = { companionship: average('bond'), personalJoy: average('joy'), community: average('social'), care: average('care') }; const best = Object.entries(values).sort((a, b) => b[1] - a[1])[0][0]; const titles = { companionship: 'A life of choosing each other', personalJoy: 'A life with room for yourself', community: 'The house with the open door', care: 'A life of a thousand kindnesses' }; return { values, title: titles[best], years: year(s) - 1952, shared: s.counts.delegate || 0, rest: s.counts.rest || 0, memories: s.memories.length, chapters: s.rewarded.length, traditions: s.counts.tradition || 0 }; }
export function validateSave(input) {
    if (!input || typeof input !== 'object' || input.version !== VERSION)
        throw Error('This is not a compatible Hearth & Home save (version 3).');
    const s = copy(input);
    const number = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
    if (!Number.isInteger(s.turn) || !number(s.turn, 0, 34) || !number(s.minutes, 0, 480) || !number(s.cash, -1000, 1000000) || !number(s.savings, 0, 1000000) || !number(s.debt, 0, 1000000) || !number(s.pantry, 0, 35))
        throw Error('The save contains invalid time or budget values.');
    if (!s.stats || !STAT_KEYS.every(k => number(s.stats[k], 0, 100)))
        throw Error('The household needs in this save are invalid.');
    if (!s.skills || !['cooking', 'organizing', 'caring', 'making'].every(k => number(s.skills[k], 0, 30)))
        throw Error('The skill values in this save are invalid.');
    if (!s.profile || !['name', 'partner', 'surname'].every(k => typeof s.profile[k] === 'string' && s.profile[k].length <= 22) || !/^#[a-fA-F0-9]{6}$/.test(s.profile.skin))
        throw Error('The household profile in this save is invalid.');
    if (!Array.isArray(s.owned) || s.owned.length > UPGRADES.length || !s.owned.every(id => UPGRADES.some(u => u.id === id)) || new Set(s.owned).size !== s.owned.length)
        throw Error('The home inventory is invalid.');
    if (!Array.isArray(s.routines) || s.routines.length > 2 || !s.routines.every(id => ROUTINES.some(r => r.id === id)) || new Set(s.routines).size !== s.routines.length)
        throw Error('The routine list is invalid.');
    if (!Array.isArray(s.children) || s.children.length > 2 || !s.children.every(c => typeof c.name === 'string' && c.name.length <= 22 && number(c.born, 1952, 2012) && number(c.connection, 0, 100)))
        throw Error('The family record is invalid.');
    for (const k of ['helpBase', 'helpRemaining', 'clutter', 'prepared', 'assistance', 'actionSerial'])
        if (!number(s[k], 0, k === 'helpBase' ? 4 : k === 'helpRemaining' ? 6 : k === 'prepared' ? 3 : k === 'clutter' ? 100 : 1000000))
            throw Error('The save contains an invalid household value.');
    for (const k of ['ended', 'finished', 'epilogue', 'partnerAlive', 'elder', 'grandchild'])
        if (typeof s[k] !== 'boolean')
            throw Error('The story state is invalid.');
    for (const k of ['flags', 'decisions', 'memories', 'rewarded', 'history', 'log'])
        if (!Array.isArray(s[k]) || s[k].length > 2000)
            throw Error('The journal record is invalid.');
    for (const k of ['counts', 'eraCounts', 'dayCounts'])
        if (!s[k] || typeof s[k] !== 'object' || !Object.values(s[k]).every(n => number(n, 0, 1000000)))
            throw Error('The activity record is invalid.');
    if (!s.eraGoals || typeof s.eraGoals !== 'object' || !Object.values(s.eraGoals).every(a => Array.isArray(a) && a.length <= 3 && a.every(v => [0, 1, 2].includes(v))))
        throw Error('The chapter record is invalid.');
    if (!s.memories.every(m => typeof m.title === 'string' && m.title.length < 400 && number(m.year, 1952, 2012)) || !s.log.every(m => typeof m.text === 'string' && m.text.length < 2000) || !s.decisions.every(d => Number.isInteger(d.turn) && d.turn >= 0 && d.turn <= 34 && typeof d.title === 'string' && typeof d.choice === 'string') || !s.history.every(h => number(h.turn, 0, 34) && ['bond', 'joy', 'care', 'social'].every(k => number(h[k], 0, 100))))
        throw Error('The journal contains an invalid entry.');
    if (s.broken !== null && !s.owned.includes(s.broken))
        throw Error('The appliance record is invalid.');
    if (!['gentle', 'balanced'].includes(s.mode))
        throw Error('Unknown game mode.');
    if (s.storyId !== undefined && (typeof s.storyId !== 'string' || s.storyId.length > 40))
        throw Error('The story record is invalid.');
    s.profile = { ...s.profile, name: NAME(s.profile.name), partner: NAME(s.profile.partner), surname: NAME(s.profile.surname) };
    return s;
}
