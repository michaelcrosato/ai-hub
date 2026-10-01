// Clutch Challenges: late-game situations built on the regular rules and simulation.
// Each one drops you into the fourth quarter with the clock, score, down and spot set,
// and ends when the drive does (a score and its try, a change of possession, or the
// final whistle). You win the challenge if your team leads at that moment.
import { other } from './model.js';

/**
 * side: which unit you play. ball: yards from the possessing team's own goal line.
 * lead: your score minus theirs at the start. toGo: yards for a first down ('goal' = goal to go).
 */
export const CHALLENGES = [
    {
        id: 'drill', name: 'TWO-MINUTE DRILL', tag: 'OFFENSE · 2:00',
        brief: 'Down four. Your own 25. Two minutes and two timeouts.',
        goal: 'Drive the length of the field and win it with a touchdown.',
        side: 'offense', clock: 120, ball: 25, down: 1, toGo: 10, lead: -4, timeouts: [2, 3], base: 20,
    },
    {
        id: 'fourth', name: 'FOURTH AND FURIOUS', tag: 'OFFENSE · 0:38',
        brief: 'Fourth and 6 at their 34. Thirty-eight seconds. Down five.',
        goal: 'Convert, keep the drive alive and find the end zone.',
        side: 'offense', clock: 38, ball: 66, down: 4, toGo: 6, lead: -5, timeouts: [1, 2], base: 23,
    },
    {
        id: 'stand', name: 'GOAL-LINE STAND', tag: 'DEFENSE · 1:10',
        brief: 'They have first and goal at your 8. You lead by four.',
        goal: 'Keep them out of the end zone until the drive or the clock runs out.',
        side: 'defense', clock: 70, ball: 92, down: 1, toGo: 'goal', lead: 4, timeouts: [1, 2], base: 24,
    },
    {
        id: 'gasp', name: 'LAST GASP', tag: 'ONE SNAP · 0:06',
        brief: 'Six seconds at midfield, down six. One snap left.',
        goal: 'Score the touchdown, then nail the extra point to win.',
        side: 'offense', clock: 6, ball: 50, down: 1, toGo: 10, lead: -6, timeouts: [0, 0], base: 21,
    },
];

const KEY = 'bb-challenges';

export function loadProgress() {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '{}');
        return v && typeof v === 'object' ? v : {};
    }
    catch {
        return {};
    }
}

export function saveResult(id, won) {
    const all = loadProgress();
    const r = all[id] || { wins: 0, tries: 0 };
    r.tries++;
    if (won)
        r.wins++;
    all[id] = r;
    try {
        localStorage.setItem(KEY, JSON.stringify(all));
    }
    catch {
        /* private mode: the challenge still plays */
    }
    return r;
}

/** Put a fresh Rules state into the challenge's situation. */
export function applyChallenge(rules, c, userTeam) {
    const s = rules.s, cpu = other(userTeam);
    s.phase = 'huddle';
    s.quarter = 4;
    s.clock = c.clock;
    s.possession = c.side === 'offense' ? userTeam : cpu;
    s.firstReceiver = cpu;
    s.ball = c.ball;
    s.snapBall = c.ball;
    s.hash = 0;
    s.down = c.down;
    s.target = c.toGo === 'goal' ? 100 : Math.min(100, c.ball + c.toGo);
    s.score = [0, 0];
    s.score[userTeam] = c.base + Math.max(0, c.lead);
    s.score[cpu] = c.base + Math.max(0, -c.lead);
    s.timeouts = [0, 0];
    s.timeouts[userTeam] = c.timeouts[0];
    s.timeouts[cpu] = c.timeouts[1];
    s.challenges = [0, 0];
    // Inside two minutes already: no warning interrupts the challenge.
    s.twoMinute = [true, true, false];
    s.playClock = 40;
    s.clockRunning = false;
    s.tryMode = false;
    s.next = 'huddle';
    s.pendingQuarter = false;
    s.warningPending = false;
    rules.say(c.name, c.brief, true);
}

/**
 * Called when a dead-ball pause ends (or the game reaches a break). True when the drive
 * the challenge is about has finished.
 */
export function challengeOver(s, startPossession) {
    if (['final', 'overtime', 'halftime', 'kickoff'].includes(s.phase))
        return true;
    if (s.phase === 'dead' && s.next === 'kickoff')
        return true;
    // A change of possession ends it, unless a defensive score still has its try to play.
    return s.possession !== startPossession && s.next !== 'try';
}
