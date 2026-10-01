/**
 * The Brick Cup: a best-of-five series between Inferno and Frostbite, saved in
 * localStorage so it can be continued later. Home ice follows a 2-2-1 schedule:
 * games 1, 2 and 5 at the Brickyard, games 3 and 4 outdoors at Frostbite Pond.
 */
const KEY = 'slapshot.cup.v1';
export const CUP_WINS = 3;
const SCHEDULE = ['brickyard', 'brickyard', 'pond', 'pond', 'brickyard'];

export class BrickCup {
    wins = [0, 0];
    results = [];
    champion = null;
    constructor() {
        try {
            const x = JSON.parse(localStorage.getItem(KEY) ?? 'null');
            if (x && Array.isArray(x.wins) && Array.isArray(x.results)) {
                this.wins = [Number(x.wins[0]) || 0, Number(x.wins[1]) || 0];
                this.results = x.results.filter(r => r && (r.winner === 0 || r.winner === 1)).slice(0, 5).map(r => ({ winner: r.winner, score: Array.isArray(r.score) ? [Number(r.score[0]) || 0, Number(r.score[1]) || 0] : [0, 0], so: !!r.so, ot: !!r.ot }));
                this.champion = x.champion === 0 || x.champion === 1 ? x.champion : null;
            }
        }
        catch { /* storage may be unavailable */ }
    }
    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ wins: this.wins, results: this.results, champion: this.champion }));
        }
        catch { /* storage may be unavailable */ }
    }
    /** The next game to play (1-5); a finished series starts over at game 1. */
    get gameNumber() { return this.over ? 1 : Math.min(5, this.results.length + 1); }
    get started() { return this.results.length > 0 && this.champion === null; }
    get over() { return this.champion !== null; }
    /** Home ice for the next game. */
    get venue() { return SCHEDULE[this.over ? 0 : Math.min(SCHEDULE.length - 1, this.results.length)]; }
    reset() {
        this.wins = [0, 0];
        this.results = [];
        this.champion = null;
        this.save();
    }
    /** Record a finished game. Returns true when it clinched the cup. */
    record(winner, score, extra = {}) {
        if (this.champion !== null)
            return false;
        this.results.push({ winner, score: [score[0], score[1]], so: !!extra.so, ot: !!extra.ot });
        this.wins[winner]++;
        if (this.wins[winner] >= CUP_WINS)
            this.champion = winner;
        this.save();
        return this.champion !== null;
    }
    /** "INF 2–1" style series line. */
    line(teams) {
        const [a, b] = this.wins;
        if (a === b)
            return `SERIES TIED ${a}–${b}`;
        const lead = a > b ? 0 : 1;
        return `${teams[lead].abbr} ${this.champion !== null ? 'WINS' : 'LEADS'} ${Math.max(a, b)}–${Math.min(a, b)}`;
    }
}
