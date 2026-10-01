import { Random } from './model.js';

const firstNames = ['Jett', 'Dash', 'Roman', 'Ace', 'Knox', 'Miles', 'Zion', 'Cruz', 'Troy', 'Blake', 'Jalen', 'Dante', 'Chase', 'Nico', 'Kai', 'Beau', 'Leo', 'Cole', 'Jules', 'Max', 'Drew', 'Ty', 'Sam', 'Eli', 'Dax', 'Cal', 'Quinn', 'Cam', 'Ray', 'Finn', 'Jace', 'Noah', 'Milo', 'Luca', 'Zeke', 'Gus', 'Rex', 'Ivan', 'Reed', 'Owen', 'Axel', 'Ezra', 'Remy', 'Jude', 'Seth', 'Theo', 'Clark', 'Lane', 'Grant', 'Brock', 'Rhys', 'Shay', 'Vince'];
const lastNames = ['Rocket', 'Steel', 'Stone', 'Reed', 'Cannon', 'Hayes', 'Banks', 'Wilder', 'Price', 'Storm', 'King', 'Carter', 'Woods', 'Lane', 'Frost', 'Brooks', 'Knight', 'Cruz', 'Vega', 'Fox', 'Blaze', 'Holt', 'Chase', 'Cole', 'Cross', 'Wells', 'Grant', 'Duke', 'Hawk', 'Ward', 'West', 'Rivers', 'Scott', 'Knox', 'Rush', 'Ford', 'Moss', 'Wolf', 'Cash', 'Drake', 'Fisher', 'Reese', 'Young', 'Nash', 'Pierce', 'Hill', 'Finch', 'Sparks', 'Mills', 'Rhodes', 'Hart', 'Shaw', 'Quake'];
const distribution = [['QB', 3], ['RB', 3], ['FB', 1], ['WR', 6], ['TE', 3], ['OT', 4], ['OG', 4], ['C', 2], ['DE', 4], ['DT', 4], ['LB', 6], ['CB', 5], ['S', 5], ['K', 1], ['P', 1], ['LS', 1]];
const ranges = { QB: [1, 19], RB: [20, 49], FB: [20, 49], WR: [1, 19], TE: [80, 89], OT: [60, 79], OG: [60, 79], C: [50, 79], DE: [90, 99], DT: [90, 99], LB: [40, 59], CB: [20, 49], S: [20, 49], K: [1, 19], P: [1, 19], LS: [40, 99] };
function makeRoster(team) {
    const rng = new Random(9814 + team * 821);
    const used = new Set();
    const roster = [];
    for (const [position, count] of distribution)
        for (let depth = 0; depth < count; depth++) {
            const i = roster.length;
            const [lo, hi] = ranges[position];
            let number = i === 0 ? (team === 0 ? 7 : 12) : rng.int(lo, hi);
            while (used.has(number)) {
                number++;
                if (number > hi)
                    number = lo;
                if (used.size > 99)
                    break;
            }
            // If a positional interval is full, use a legal alternative WR / front-seven interval.
            if (used.has(number))
                number = 0;
            used.add(number);
            const line = ['OT', 'OG', 'C', 'DT', 'DE', 'LS'].includes(position);
            const speed = rng.int(line ? 58 : 76, line ? 75 : 97) - depth;
            const power = rng.int(line ? 85 : 67, line ? 98 : 89) - depth;
            const skill = rng.int(78, 98) - Math.min(depth, 3) * 3;
            roster.push({ id: team * 100 + i, name: `${firstNames[(i + team * 17) % 53]} ${lastNames[(i * (team ? 7 : 1) + team * 11) % 53]}`, number, position, speed, power, skill, stamina: rng.int(80, 99), overall: Math.round((speed + power + skill) / 3) });
        }
    roster[0].name = team === 0 ? 'Jett Rocket' : 'Kai Frost';
    roster[3].name = team === 0 ? 'Dash Wilder' : 'Ace Storm';
    return roster;
}
export const TEAMS = [
    { id: 0, city: 'MOTOR CITY', name: 'INFERNO', short: 'INF', color: '#ff642d', dark: '#ad3524', accent: '#ffe17b', slogan: 'BRING THE HEAT.', roster: makeRoster(0) },
    { id: 1, city: 'NORTH COAST', name: 'FROSTBITE', short: 'ICE', color: '#36dce8', dark: '#14748f', accent: '#e5ffff', slogan: 'COLD. BLOODED.', roster: makeRoster(1) },
];
export const OFFENSE_ROLES = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
export const DEFENSE_ROLES = ['LE', 'DT1', 'DT2', 'RE', 'LB1', 'MLB', 'LB2', 'CB1', 'CB2', 'FS', 'SS'];
const positions = { QB: 'QB', RB: 'RB', WR1: 'WR', WR2: 'WR', WR3: 'WR', TE: 'TE', LT: 'OT', RT: 'OT', LG: 'OG', RG: 'OG', C: 'C', LE: 'DE', RE: 'DE', DT1: 'DT', DT2: 'DT', LB1: 'LB', MLB: 'LB', LB2: 'LB', CB1: 'CB', CB2: 'CB', FS: 'S', SS: 'S' };
export const depthCharts = [{}, {}];
export function lineup(team, offense) {
    const seen = {};
    return (offense ? OFFENSE_ROLES : DEFENSE_ROLES).map(role => {
        const pos = positions[role];
        const depth = seen[pos] || 0;
        seen[pos] = depth + 1;
        const candidates = TEAMS[team].roster.filter(p => p.position === pos);
        return { role, player: TEAMS[team].roster.find(p => p.id === depthCharts[team][role]) || candidates[depth % candidates.length] };
    });
}
const r = (...coords) => coords.map(([x, z]) => ({ x, z }));
export const PLAYS = [
    { id: 'crossfire', name: 'CROSSFIRE', kind: 'pass', family: 'PASS', description: 'Stretch the middle. Hit the crossing route.', tag: 'BALANCED', routes: [r([0, 9], [22, 16]), r([0, 8], [-24, 15]), r([0, 17], [8, 30]), r([2, 6], [12, 8]), r([-8, 2], [-12, 7])] },
    { id: 'verticals', name: 'AFTERBURNER', kind: 'pass', family: 'PASS', description: 'Four verticals. One very big statement.', tag: 'DEEP SHOT', routes: [r([0, 38]), r([0, 38]), r([-3, 40]), r([4, 32]), r([7, 1], [10, 5])] },
    { id: 'slants', name: 'QUICK STRIKE', kind: 'pass', family: 'PASS', description: 'Three fast slants. Beat the blitz.', tag: 'QUICK PASS', routes: [r([0, 3], [18, 15]), r([0, 3], [-18, 15]), r([0, 4], [17, 18]), r([3, 6]), r([-7, 0], [-12, 6])] },
    { id: 'flood', name: 'TIDAL WAVE', kind: 'pass', family: 'PASS', description: 'Flood the right sideline at three levels.', tag: 'ZONE BEATER', routes: [r([0, 10], [28, 14]), r([0, 35]), r([0, 6], [22, 8]), r([7, 3], [14, 4]), r([-4, 2], [-8, 6])] },
    { id: 'screen', name: 'SMOKE SCREEN', kind: 'pass', family: 'PASS', description: 'Invite the rush. Slip it to the back.', tag: 'SAFE HANDS', routes: [r([0, 24]), r([0, 24]), r([4, 8], [16, 10]), r([0, 7], [10, 9]), r([-10, 0], [-14, 3])] },
    { id: 'hailmary', name: 'MOON SHOT', kind: 'pass', family: 'PASS', description: 'Everyone deep. Make the highlight reel.', tag: 'HIGH RISK', routes: [r([10, 44]), r([-10, 44]), r([8, 44]), r([-6, 40]), r([0, 26])] },
    { id: 'power', name: 'WRECKING BALL', kind: 'run', family: 'RUN', description: 'Follow your big guys. Run through trouble.', tag: 'POWER RUN', runLane: 2, routes: [] },
    { id: 'sweep', name: 'JET SWEEP', kind: 'run', family: 'RUN', description: 'Get outside. Turn on the afterburners.', tag: 'OUTSIDE RUN', runLane: -13, routes: [] },
    { id: 'draw', name: 'DELAYED FUSE', kind: 'run', family: 'RUN', description: 'Sell the pass. Explode through the gap.', tag: 'DRAW PLAY', runLane: -3, routes: [] },
    { id: 'qb', name: 'ROCKET KEEP', kind: 'run', family: 'RUN', description: 'Your quarterback. Your moment.', tag: 'QB RUN', runLane: 7, routes: [] },
    { id: 'kneel', name: 'VICTORY LAP', kind: 'kneel', family: 'SPECIAL', description: 'Take a knee. Keep the game clock moving.', tag: 'CLOCK CONTROL', routes: [] },
    { id: 'spike', name: 'STOP THE CLOCK', kind: 'spike', family: 'SPECIAL', description: 'Spike immediately. Lose a down, save time.', tag: 'CLOCK CONTROL', routes: [] },
    { id: 'punt', name: 'SKY HAMMER', kind: 'punt', family: 'SPECIAL', description: 'Flip the field. Time your power and accuracy.', tag: 'PUNT', routes: [] },
    { id: 'fieldgoal', name: 'SPLIT THE POSTS', kind: 'fieldgoal', family: 'SPECIAL', description: 'Put three on the board. Aim for the sweet spot.', tag: 'FIELD GOAL', routes: [] },
    // Added in the upgrade: two more runs, so the run page fills out like the pass book.
    // fakeLane: the back (and his line) sells this lane first, then cuts back to runLane.
    { id: 'counter', name: 'BACKDRAFT', kind: 'run', family: 'RUN', description: 'Show them one side. Cut back against the flow.', tag: 'COUNTER', runLane: -6, fakeLane: 7, routes: [] },
    { id: 'toss', name: 'PITCHFORK', kind: 'run', family: 'RUN', description: 'Quick toss to the right. Bounce it to the boundary.', tag: 'TOSS SWEEP', runLane: 15, routes: [] },
];
export const DEFENSES = [
    { id: 'zone', name: 'COVER 2', tag: 'ZONE COVERAGE', description: 'Keep everything in front. Protect the deep ball.' },
    { id: 'man', name: 'LOCKDOWN', tag: 'MAN COVERAGE', description: 'Match up. Stay on your receiver.' },
    { id: 'blitz', name: 'HOUSE PARTY', tag: 'ALL-OUT BLITZ', description: 'Send the heat. Get to the quarterback.' },
];

