import { RINK, segmentGoal, distance, other } from "./math.js";
export class PenaltyBox {
    penalties = [];
    nextId = 1;
    add(team, player, reason, kind = 'minor', coincidental = false) {
        const p = { id: this.nextId++, team, player, reason, kind, remaining: kind === 'major' ? 300 : kind === 'misconduct' ? 600 : kind === 'game-misconduct' ? Infinity : 120, segments: kind === 'double-minor' ? 2 : 1, active: false, coincidental };
        this.penalties.push(p);
        this.activate();
        return p;
    }
    reducing(p) { return !p.coincidental && p.kind !== 'misconduct' && p.kind !== 'game-misconduct'; }
    activate() {
        for (const team of [0, 1]) {
            let active = this.penalties.filter(p => p.team === team && this.reducing(p) && p.active).length;
            for (const p of this.penalties)
                if (p.team === team && !p.active) {
                    if (!this.reducing(p) || active < 2) {
                        p.active = true;
                        if (this.reducing(p))
                            active++;
                    }
                }
        }
    }
    reductions(team) { return this.penalties.filter(p => p.team === team && p.active && this.reducing(p)).length; }
    counts(overtime = false) {
        const a = this.reductions(0), b = this.reductions(1);
        if (overtime)
            return a > b ? [3, Math.min(5, 3 + a - b)] : [Math.min(5, 3 + b - a), 3];
        return [Math.max(3, 5 - a), Math.max(3, 5 - b)];
    }
    unavailable(player) { return this.penalties.some(p => p.player === player); }
    advance(seconds) {
        const expired = [];
        // Consume a step by the next expiry so queued minors cannot lose time before activation.
        let left = Math.max(0, seconds), guard = 0;
        while (left > 1e-8 && guard++ < 50) {
            this.activate();
            const running = this.penalties.filter(p => p.active && Number.isFinite(p.remaining));
            if (!running.length)
                break;
            const dt = Math.min(left, ...running.map(p => p.remaining));
            for (const p of running)
                p.remaining -= dt;
            left -= dt;
            for (const p of [...running])
                if (p.remaining <= 1e-8) {
                    if (p.segments > 1) {
                        p.segments--;
                        p.remaining = 120;
                    }
                    else {
                        expired.push(p);
                        this.penalties = this.penalties.filter(v => v.id !== p.id);
                    }
                }
        }
        this.activate();
        return expired;
    }
    goal(scoring, counts) {
        const victim = other(scoring);
        if (counts[scoring] <= counts[victim])
            return;
        const candidates = this.penalties.filter(p => p.team === victim && p.active && this.reducing(p) && (p.kind === 'minor' || p.kind === 'double-minor')).sort((a, b) => a.remaining - b.remaining || a.id - b.id);
        const p = candidates[0];
        if (!p)
            return;
        if (p.segments > 1) {
            p.segments--;
            p.remaining = 120;
        }
        else
            this.penalties = this.penalties.filter(v => v.id !== p.id);
        this.activate();
        return p;
    }
}
export class RinkRules {
    offside = [false, false];
    icing = null;
    reset() { this.offside = [false, false]; this.icing = null; }
    touch() { this.icing = null; }
    release(team, dir, point, player, counts) {
        this.icing = point.x * dir < 0 && counts[team] >= counts[other(team)] ? { team, dir, origin: { ...point }, releasedBy: player } : null;
    }
    updateOffside(previous, puck, skaters, dirs, carrier, lastTeam) {
        for (const team of [0, 1]) {
            const dir = dirs[team], all = skaters.filter(p => p.active && !p.goalie && p.team === team);
            if (puck.x * dir <= RINK.blue || all.every(p => p.x * dir < RINK.blue - .25))
                this.offside[team] = false;
            if (previous.x * dir <= RINK.blue && puck.x * dir > RINK.blue && lastTeam === team) {
                // The puck carrier may enter backwards under control; teammates may not precede the puck.
                this.offside[team] = all.some(p => p.id !== carrier && p.x * dir > RINK.blue + .5);
            }
            if (this.offside[team] && carrier !== null && all.some(p => p.id === carrier))
                return team;
        }
        return null;
    }
    checkIcing(previous, puck, skaters) {
        const icing = this.icing;
        if (!icing)
            return null;
        if (previous.x * icing.dir >= RINK.goal || puck.x * icing.dir < RINK.goal || Math.abs(puck.z) < RINK.goalHalf)
            return null;
        this.icing = null;
        const target = { x: icing.dir * 28, z: puck.z };
        const attackers = skaters.filter(p => p.active && !p.goalie && p.team === icing.team);
        const defenders = skaters.filter(p => p.active && !p.goalie && p.team !== icing.team);
        const attackDistance = Math.min(...attackers.map(p => distance(p, target)));
        const defenseDistance = Math.min(...defenders.map(p => distance(p, target)));
        return defenseDistance <= attackDistance + .5 ? icing.team : null;
    }
}
export function shootoutWinner(attempts) {
    const a = attempts[0].filter(Boolean).length, b = attempts[1].filter(Boolean).length;
    const na = attempts[0].length, nb = attempts[1].length;
    if (na <= 3 && nb <= 3) {
        if (a > b + Math.max(0, 3 - nb))
            return 0;
        if (b > a + Math.max(0, 3 - na))
            return 1;
    }
    if (na >= 3 && na === nb && a !== b)
        return a > b ? 0 : 1;
    return null;
}
export function goalCrossing(previous, puck, attackingDirection) {
    for (const team of [0, 1])
        if (segmentGoal(previous, puck, attackingDirection[team]))
            return team;
    return null;
}
export function classifyCheck(c) {
    if (c.goalie)
        return { reason: 'GOALTENDER INTERFERENCE', kind: 'minor', penaltyShot: false };
    if (!c.hasPuck)
        return { reason: 'INTERFERENCE', kind: 'minor', penaltyShot: false };
    if (c.fromBehind && c.breakaway)
        return { reason: 'DENIED BREAKAWAY', kind: 'minor', penaltyShot: true };
    if (c.atBoards && c.fromBehind)
        return { reason: 'BOARDING', kind: c.speed > 12 ? 'major' : 'minor', penaltyShot: false };
    if (c.turbo && c.speed > 16)
        return { reason: 'CHARGING', kind: 'minor', penaltyShot: false };
    return null;
}
