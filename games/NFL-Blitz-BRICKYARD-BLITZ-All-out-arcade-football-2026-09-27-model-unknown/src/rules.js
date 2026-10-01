import { clamp, other } from './model.js';
/** Pure football state machine. Coordinates are yards from the possessing team's own goal.
 * Rules basis: 2026 NFL Rulebook, with arcade abstractions for collisions, catching and officiating.
 * No renderer, wall clock, randomness, or browser dependencies live in this module. */
/** Enforcement definitions are reusable; not every foul has a live-play detector. */
export const PENALTIES = {
    delay: { name: 'DELAY OF GAME', yards: 5, side: 'offense', dead: true },
    falseStart: { name: 'FALSE START', yards: 5, side: 'offense', dead: true },
    offside: { name: 'OFFSIDE', yards: 5, side: 'defense' },
    encroachment: { name: 'ENCROACHMENT', yards: 5, side: 'defense', dead: true },
    neutralZone: { name: 'NEUTRAL ZONE INFRACTION', yards: 5, side: 'defense', dead: true },
    illegalFormation: { name: 'ILLEGAL FORMATION', yards: 5, side: 'offense' },
    illegalShift: { name: 'ILLEGAL SHIFT', yards: 5, side: 'offense' },
    illegalMotion: { name: 'ILLEGAL MOTION', yards: 5, side: 'offense' },
    tooMany: { name: 'TOO MANY PLAYERS', yards: 5, side: 'either' },
    holding: { name: 'OFFENSIVE HOLDING', yards: 10, side: 'offense' },
    defensiveHolding: { name: 'DEFENSIVE HOLDING', yards: 5, side: 'defense', first: true },
    illegalContact: { name: 'ILLEGAL CONTACT', yards: 5, side: 'defense', first: true },
    dpi: { name: 'DEFENSIVE PASS INTERFERENCE', yards: 0, side: 'defense', first: true, spot: true },
    opi: { name: 'OFFENSIVE PASS INTERFERENCE', yards: 10, side: 'offense' },
    ineligible: { name: 'INELIGIBLE RECEIVER DOWNFIELD', yards: 5, side: 'offense' },
    illegalPass: { name: 'ILLEGAL FORWARD PASS', yards: 5, side: 'offense', loss: true, spot: true },
    grounding: { name: 'INTENTIONAL GROUNDING', yards: 10, side: 'offense', loss: true },
    facemask: { name: 'FACEMASK', yards: 15, side: 'either', first: true },
    horseCollar: { name: 'HORSE-COLLAR TACKLE', yards: 15, side: 'defense', first: true },
    roughingPasser: { name: 'ROUGHING THE PASSER', yards: 15, side: 'defense', first: true },
    roughingKicker: { name: 'ROUGHING THE KICKER', yards: 15, side: 'defense', first: true },
    runningKicker: { name: 'RUNNING INTO THE KICKER', yards: 5, side: 'defense' },
    unnecessary: { name: 'UNNECESSARY ROUGHNESS', yards: 15, side: 'either', first: true },
    unsportsmanlike: { name: 'UNSPORTSMANLIKE CONDUCT', yards: 15, side: 'either', dead: true },
    blockBack: { name: 'ILLEGAL BLOCK IN THE BACK', yards: 10, side: 'either' },
    clipping: { name: 'CLIPPING', yards: 15, side: 'either' },
    chopBlock: { name: 'CHOP BLOCK', yards: 15, side: 'offense' },
    tripping: { name: 'TRIPPING', yards: 15, side: 'either', first: true },
    fairCatchInterference: { name: 'KICK-CATCH INTERFERENCE', yards: 15, side: 'either', spot: true },
};
const blankStats = () => ({ plays: 0, yards: 0, passing: 0, rushing: 0, completions: 0, attempts: 0, firstDowns: 0, sacks: 0, turnovers: 0, touchdowns: 0, possession: 0, penalties: 0, penaltyYards: 0 });
export class Rules {
    settings;
    s;
    constructor(settings) {
        this.settings = settings;
        this.s = { phase: 'coin', possession: 0, ball: 35, hash: 0, down: 1, target: 45, score: [0, 0], quarter: 1,
            clock: settings.quarterSeconds, playClock: 40, clockRunning: false, timeouts: [3, 3], challenges: [2, 2], firstReceiver: 0,
            tryMode: false, kickFrom: 35, safetyKick: false, otCompleted: [false, false], otStarted: [false, false], overtimePeriod: 0,
            twoMinute: [false, false, false], snapBall: 35, pendingQuarter: false, warningPending: false, next: 'huddle', message: 'WELCOME TO THE YARD',
            detail: 'Two teams. One field. All-out football.', stats: [blankStats(), blankStats()], journal: [], lastResult: null, noticeSerial: 0 };
    }
    get direction() { return (this.s.quarter % 2 === 1 ? 1 : -1) * (this.s.possession === 0 ? 1 : -1); }
    get toGo() { return Math.max(0, this.s.target - this.s.ball); }
    get downText() {
        return `${['', '1ST', '2ND', '3RD', '4TH'][this.s.down] || '1ST'} & ${this.s.target >= 100 ? 'GOAL' : Math.max(1, Math.ceil(this.toGo))}`;
    }
    worldZ(yards = this.s.ball) { return (yards - 50) * this.direction; }
    yards(z) { return z * this.direction + 50; }
    say(title, detail = '', log = false) {
        this.s.message = title;
        this.s.detail = detail;
        this.s.noticeSerial++;
        if (log)
            this.s.journal.push({ quarter: this.s.quarter, clock: this.s.clock, team: this.s.possession, title, detail, score: [...this.s.score] });
        if (this.s.journal.length > 200)
            this.s.journal.shift();
    }
    start(receiver) {
        this.s.firstReceiver = receiver;
        this.kickoff(other(receiver));
        this.say('LET’S MAKE SOME NOISE', 'Opening kickoff · the receiving team gets the ball.', true);
    }
    kickoff(kicking, safety = false) {
        const s = this.s;
        s.possession = kicking;
        s.phase = 'kickoff';
        s.ball = safety ? 20 : 35;
        s.kickFrom = s.ball;
        s.safetyKick = safety;
        s.hash = 0;
        s.down = 1;
        s.target = s.ball + 10;
        s.playClock = 25;
        s.clockRunning = false;
        s.tryMode = false;
    }
    newSeries(team, spot) {
        const s = this.s;
        s.possession = team;
        s.ball = clamp(spot, 0.1, 99.9);
        s.down = 1;
        s.target = Math.min(100, s.ball + 10);
        s.hash = clamp(s.hash, -3.0833, 3.0833);
        s.playClock = 40;
        s.clockRunning = false;
        s.safetyKick = false;
        s.next = 'huddle';
        if (s.quarter > 4)
            s.otStarted[team] = true;
    }
    snap() {
        const s = this.s;
        if (!['huddle', 'try', 'kickoff'].includes(s.phase))
            return false;
        s.snapBall = s.ball;
        const kick = s.phase === 'kickoff';
        s.phase = 'live';
        if (!s.tryMode && !kick) {
            s.clockRunning = true;
            s.stats[s.possession].plays++;
        }
        if (s.quarter > 4 && !kick)
            s.otStarted[s.possession] = true;
        return true;
    }
    tick(dt) {
        const s = this.s;
        if (['huddle', 'try', 'kickoff'].includes(s.phase)) {
            s.playClock = Math.max(0, s.playClock - dt);
            if (s.playClock === 0) {
                this.penalty('delay', s.possession);
                return;
            }
        }
        if (!s.clockRunning || s.tryMode || s.phase === 'final')
            return;
        const old = s.clock;
        s.clock = Math.max(0, s.clock - dt);
        if (s.phase === 'live')
            s.stats[s.possession].possession += old - s.clock;
        const warningIndex = s.quarter === 2 ? 0 : s.quarter === 4 ? 1 : s.quarter > 4 ? 2 : -1;
        if (warningIndex >= 0 && !s.twoMinute[warningIndex] && old > 120 && s.clock <= 120) {
            s.twoMinute[warningIndex] = true;
            // A warning never interrupts a live down.
            if (s.phase !== 'live') {
                s.clockRunning = false;
                this.say('TWO-MINUTE WARNING', 'The clock stops. Make the next play count.', true);
            }
            else
                s.warningPending = true;
        }
        if (s.clock === 0) {
            s.pendingQuarter = true;
            s.clockRunning = false;
            if (s.phase !== 'live')
                this.advancePeriod();
        }
    }
    timeout(team) {
        const s = this.s;
        if (s.timeouts[team] <= 0 || !['huddle', 'try', 'kickoff'].includes(s.phase))
            return false;
        s.timeouts[team]--;
        s.clockRunning = false;
        s.playClock = 25;
        this.say('TIMEOUT', `${s.timeouts[team]} remaining this ${s.quarter > 4 ? 'overtime' : 'half'}.`, true);
        return true;
    }
    finish(r) {
        const s = this.s;
        if (s.phase !== 'live')
            return;
        const offense = s.possession;
        const defense = other(offense);
        const isTry = !!s.tryMode;
        s.lastResult = r;
        s.clockRunning = false;
        s.hash = clamp(r.hash || 0, -3.0833, 3.0833);
        if (isTry) {
            const scoringTeam = r.team ?? offense;
            const good = r.kind === 'touchdown' || r.kind === 'fg-good';
            const points = r.kind === 'safety' ? 1 : good ? (scoringTeam !== offense ? 2 : s.tryMode === 'pat' ? 1 : 2) : 0;
            if (points)
                s.score[scoringTeam] += points;
            this.say(points ? `${points === 1 ? 'EXTRA POINT' : 'TWO-POINT TRY'} GOOD` : 'TRY NO GOOD', points ? `+${points} on the board.` : 'Defense holds the line.', true);
            s.tryMode = false;
            s.next = 'kickoff';
            if (s.quarter > 4 && this.overtimeWinner())
                return;
            if (s.pendingQuarter) {
                this.advancePeriod();
                return;
            }
            s.phase = 'dead';
            s.next = 'kickoff';
            return;
        }
        const regular = !r.kick && (r.team === undefined || r.team === offense) && !['kick-return', 'punt', 'touchback', 'fg-good', 'fg-miss'].includes(r.kind);
        if (regular) {
            const gained = clamp(r.spot, 0, 100) - s.snapBall;
            if (r.kind !== 'incomplete' && r.kind !== 'spike') {
                s.stats[offense].yards += gained;
                if (r.passing || r.sack)
                    s.stats[offense].passing += gained;
                else
                    s.stats[offense].rushing += gained;
            }
            if (r.sack)
                s.stats[defense].sacks++;
        }
        if (r.kind === 'fg-good') {
            s.score[offense] += 3;
            s.safetyKick = false;
            this.completeOTDrive(offense);
            this.say('IT’S GOOD!', `A ${Math.round(117 - s.snapBall)}-yard field goal. +3.`, true);
            s.next = 'kickoff';
            s.phase = 'dead';
            if (s.quarter > 4 && this.overtimeWinner())
                return;
        }
        else if (r.kind === 'fg-miss') {
            this.say('NO GOOD', 'The kick misses. The other team takes over.', true);
            this.changePossession(defense, Math.max(20, 107 - s.snapBall));
        }
        else if (r.kind === 'touchback') {
            const receiver = r.team ?? defense;
            if (!r.freeKick) {
                this.completeOTDrive(offense);
                if (!r.kick)
                    s.stats[offense].turnovers++;
                if (s.quarter > 4 && this.overtimeWinner())
                    return;
            }
            this.say('TOUCHBACK', `First down at the ${Math.round(r.spot)}.`, true);
            this.newSeries(receiver, r.spot);
            s.phase = 'dead';
            s.next = 'huddle';
        }
        else if (r.kind === 'punt') {
            this.say('FIELD FLIPPED', `Punt downed at the ${Math.round(100 - r.spot)}.`, true);
            this.changePossession(defense, r.spot >= 100 ? 20 : 100 - r.spot);
        }
        else if (r.kind === 'kick-return') {
            const receiver = r.team ?? defense;
            this.say('LET’S GO TO WORK', `Return to the ${Math.round(r.spot)}.`, true);
            this.newSeries(receiver, r.spot);
            s.phase = 'dead';
            s.next = 'huddle';
        }
        else if (r.kind === 'turnover') {
            const team = r.team ?? defense;
            if (!r.kick)
                s.stats[offense].turnovers++;
            this.say(r.description || 'TURNOVER!', `The defense takes it away.`, true);
            this.changePossession(team, 100 - r.spot);
        }
        else if (r.kind === 'touchdown' || r.spot >= 100) {
            const team = r.team ?? offense;
            s.score[team] += 6;
            s.safetyKick = false;
            s.stats[team].touchdowns++;
            if (team !== offense && !r.kick)
                s.stats[offense].turnovers++;
            this.completeOTDrive(r.freeKick ? team : offense);
            this.say('TOUCHDOWN!', r.description || 'Big play. Bigger energy. Six on the board.', true);
            if (s.pendingQuarter && s.quarter === 4 && Math.abs(s.score[0] - s.score[1]) > 2) {
                this.advancePeriod();
                return;
            }
            if (s.quarter > 4 && team !== offense && !r.freeKick) {
                s.phase = 'final';
                s.next = 'final';
                return;
            }
            // The second team's go-ahead touchdown (or sudden-death score) needs no try.
            if (s.quarter > 4 && s.otCompleted[0] && s.otCompleted[1] && s.score[team] > s.score[other(team)]) {
                s.phase = 'final';
                s.next = 'final';
                return;
            }
            s.possession = team;
            s.phase = 'dead';
            s.next = 'try';
            s.ball = 98;
            s.target = 100;
            s.down = 1;
        }
        else if (r.kind === 'safety' || r.spot <= 0) {
            s.score[defense] += 2;
            this.completeOTDrive(offense);
            this.say('SAFETY!', 'Two points. The offense must free kick from its 20.', true);
            s.safetyKick = true;
            s.phase = 'dead';
            s.next = 'kickoff';
            if (s.quarter > 4) {
                s.phase = 'final';
                s.next = 'final';
                return;
            }
        }
        else {
            const incomplete = r.kind === 'incomplete' || r.kind === 'spike';
            if (!incomplete)
                s.ball = clamp(r.spot, 0.1, 99.9);
            if (!incomplete && s.ball + 0.001 >= s.target) {
                s.down = 1;
                s.target = Math.min(100, s.ball + 10);
                s.stats[offense].firstDowns++;
                this.say('MOVE THE CHAINS', `${Math.round(s.ball - s.snapBall)} yards. A fresh set of downs.`, true);
            }
            else {
                s.down++;
                this.say(incomplete ? 'INCOMPLETE' : r.sack ? 'SACK ATTACK' : r.kind === 'kneel' ? 'TAKING A KNEE' : 'DOWN AT THE SPOT', r.description || `${Math.round(s.ball - s.snapBall)} yards on the play.`, true);
            }
            if (s.down > 4) {
                this.say('TURNOVER ON DOWNS', 'Four chances. No more. Defense takes over.', true);
                this.changePossession(defense, 100 - s.ball);
            }
            else {
                s.phase = 'dead';
                s.next = 'huddle';
                // Ready-for-play restart outside the late-half out-of-bounds exceptions.
                const lateOut = (s.quarter === 2 && s.clock <= 120) || (s.quarter === 4 && s.clock <= 300) || s.quarter > 4;
                s.clockRunning = !incomplete && (r.kind !== 'out' || !lateOut);
            }
        }
        if (s.warningPending) {
            s.warningPending = false;
            s.clockRunning = false;
            this.say('TWO-MINUTE WARNING', s.message + ' · The clock stops.', true);
        }
        if (s.pendingQuarter && s.next !== 'try' && s.phase !== 'final')
            this.advancePeriod();
        s.playClock = 40;
    }
    continue() {
        const s = this.s;
        if (s.phase === 'final')
            return;
        if (s.phase === 'halftime') {
            s.quarter = 3;
            s.clock = this.settings.quarterSeconds;
            s.timeouts = [3, 3];
            this.kickoff(s.firstReceiver);
            return;
        }
        if (s.phase === 'overtime') {
            s.quarter = 5;
            s.clock = this.settings.postseason ? 900 : 600;
            s.timeouts = this.settings.postseason ? [3, 3] : [2, 2];
            s.overtimePeriod = 1;
            this.kickoff(other(s.firstReceiver));
            return;
        }
        if (s.phase !== 'dead')
            return;
        if (s.next === 'kickoff') {
            this.kickoff(s.possession, s.safetyKick);
            return;
        }
        if (s.next === 'try') {
            s.phase = 'try';
            s.tryMode = 'two';
            s.ball = 98;
            s.target = 100;
            s.down = 1;
            s.hash = 0;
            s.playClock = 25;
            s.clockRunning = false;
            return;
        }
        s.phase = 'huddle';
        s.playClock = 40;
    }
    chooseTry(mode) {
        const s = this.s;
        if (s.phase !== 'try')
            return;
        s.tryMode = mode;
        s.ball = mode === 'pat' ? 85 : 98;
        s.target = 100;
        s.down = 1;
        s.hash = 0;
    }
    /** Converts actual kick landing events into the NFL's 20 / 35 / 40 yard outcomes. */
    kickoffTouchback(bouncedInLanding) {
        const spot = this.s.kickFrom === 50 || bouncedInLanding ? 20 : 35;
        this.finish({ kind: 'touchback', spot, team: other(this.s.possession), kick: true, freeKick: true });
    }
    illegalKickoff() {
        this.finish({ kind: 'touchback', spot: 40, team: other(this.s.possession), kick: true, freeKick: true });
        this.say('KICKOFF OUTSIDE LANDING ZONE', 'Receiving team takes over at its 40.', true);
    }
    completeOTDrive(team) { if (this.s.quarter > 4)
        this.s.otCompleted[team] = true; }
    changePossession(team, spot) {
        this.completeOTDrive(this.s.possession);
        if (this.s.quarter > 4 && this.overtimeWinner())
            return;
        this.newSeries(team, spot);
        this.s.phase = 'dead';
        this.s.next = 'huddle';
    }
    overtimeWinner() {
        const s = this.s;
        if (s.otCompleted[0] && s.otCompleted[1] && s.score[0] !== s.score[1]) {
            s.phase = 'final';
            s.next = 'final';
            s.clockRunning = false;
            return true;
        }
        return false;
    }
    advancePeriod() {
        const s = this.s;
        s.pendingQuarter = false;
        s.clockRunning = false;
        if (s.quarter === 2) {
            s.phase = 'halftime';
            this.say('HALFTIME', 'Take a breath. Then bring the heat.', true);
            return;
        }
        if (s.quarter === 4) {
            s.phase = s.score[0] === s.score[1] ? 'overtime' : 'final';
            this.say(s.phase === 'overtime' ? 'OVERTIME' : 'THAT’S THE BALLGAME', s.phase === 'overtime' ? 'Both teams get a possession, subject to the regular-season overtime clock.' : 'The final whistle.', true);
            return;
        }
        if (s.quarter > 4) {
            if (!this.settings.postseason) {
                s.phase = 'final';
                s.next = 'final';
                this.say('FINAL', s.score[0] === s.score[1] ? 'Overtime expires. This one ends in a tie.' : 'Overtime expires.', true);
                return;
            }
            s.quarter++;
            s.overtimePeriod++;
            s.clock = 900;
            s.playClock = 40;
            s.phase = 'huddle';
            if (s.overtimePeriod % 2 === 1)
                s.timeouts = [3, 3];
            this.say('OVERTIME CONTINUES', 'Switch ends. Play until there’s a winner.', true);
            return;
        }
        s.quarter++;
        s.clock = this.settings.quarterSeconds;
        s.playClock = 40;
        if (s.next === 'kickoff')
            this.kickoff(s.possession, s.safetyKick);
        else
            s.phase = 'huddle';
        this.say(`QUARTER ${s.quarter}`, 'Switch ends. Keep the drive alive.', true);
    }
    penalty(key, team, spot = this.s.ball, declined = false) {
        const p = PENALTIES[key];
        if (!p)
            throw new Error(`Unknown penalty: ${key}`);
        const s = this.s;
        if (declined) {
            this.say('PENALTY DECLINED', p.name, true);
            return;
        }
        const againstOffense = team === s.possession;
        const before = s.ball;
        const kickoffPhase = s.phase === 'kickoff';
        s.clockRunning = false;
        if (key === 'grounding') {
            if (spot <= 0) {
                s.phase = 'live';
                this.finish({ kind: 'safety', spot: 0 });
                return;
            }
            s.ball = Math.min(s.ball - Math.min(10, s.ball / 2), spot);
        }
        else if (key === 'dpi') {
            s.ball = spot >= 100 ? (before >= 98 ? (before + 100) / 2 : 99) : Math.max(before, spot);
        }
        else {
            const base = p.spot ? spot : s.ball;
            const distance = againstOffense ? base : 100 - base;
            s.ball = clamp(base + (againstOffense ? -1 : 1) * Math.min(p.yards, distance / 2), 0.01, 99.99);
        }
        s.stats[team].penalties++;
        s.stats[team].penaltyYards += Math.abs(s.ball - before);
        if (!againstOffense && (p.first || s.ball >= s.target)) {
            s.down = 1;
            s.target = Math.min(100, s.ball + 10);
        }
        if (againstOffense && p.loss)
            s.down++;
        if (s.down > 4)
            this.changePossession(other(team), 100 - s.ball);
        else {
            s.phase = kickoffPhase ? 'kickoff' : s.tryMode ? 'try' : 'huddle';
            if (kickoffPhase)
                s.kickFrom = s.ball;
            s.playClock = 25;
        }
        this.say('FLAG ON THE PLAY', `${p.name} · ${Math.round(Math.abs(s.ball - before) * 10) / 10} yards${p.first && !againstOffense ? ' · automatic first down' : ''}${p.loss ? ' · loss of down' : ''}.`, true);
    }
    offsetting() { this.s.ball = this.s.snapBall; this.s.phase = 'huddle'; this.s.playClock = 25; this.s.clockRunning = false; this.say('OFFSETTING FOULS', 'Replay the down.', true); }
    challenge(team) {
        const s = this.s;
        if (s.quarter > 4 || (s.quarter % 2 === 0 && s.clock <= 120) || s.challenges[team] <= 0 || s.timeouts[team] <= 0 || !s.lastResult || !['dead', 'huddle'].includes(s.phase))
            return false;
        if (['touchdown', 'turnover', 'fg-good', 'safety'].includes(s.lastResult.kind))
            return false;
        s.challenges[team]--;
        s.timeouts[team]--;
        s.clockRunning = false;
        this.say('THE RULING STANDS', 'The exact simulation spot is confirmed. Charged timeout.', true);
        return true;
    }
}

