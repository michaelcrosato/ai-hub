import { TEAMS, getPlayer } from './teams.js';

const blankStats = () => ({ ab: 0, hits: 0, runs: 0, rbi: 0, hr: 0, bb: 0, k: 0, sb: 0, cs: 0, pitches: 0 });
const newTeam = (side) => ({
  lineup: TEAMS[side].roster.slice(0, 9).map((p) => p.id),
  pitcher: TEAMS[side].roster[14].id,
  used: [],
  hits: 0,
  errors: 0,
  runs: [0],
  stats: Object.fromEntries(TEAMS[side].roster.map((p) => [p.id, blankStats()])),
});

/** Rules have no dependency on rendering, physics, wall-clock time, or random numbers. */
export class BaseballRules {
  constructor(innings = 9, ghostRunner = false, snapshot) {
    this.state = snapshot
      ? structuredClone(snapshot)
      : { version: 1, inning: 1, half: 0, outs: 0, balls: 0, strikes: 0, bases: [null, null, null], orders: [0, 0], teams: [newTeam(0), newTeam(1)], scheduledInnings: innings, ghostRunner, finished: false, winner: null, playLog: ['WELCOME TO BRICK LEAGUE.'] };
    this.validate();
  }
  get offense() {
    return this.state.half;
  }
  get defense() {
    return this.state.half === 0 ? 1 : 0;
  }
  get batter() {
    return getPlayer(this.offense, this.state.teams[this.offense].lineup[this.state.orders[this.offense]]);
  }
  get pitcher() {
    return getPlayer(this.defense, this.state.teams[this.defense].pitcher);
  }
  get score() {
    return [this.state.teams[0].runs.reduce((a, b) => a + b, 0), this.state.teams[1].runs.reduce((a, b) => a + b, 0)];
  }
  get batterStats() {
    return this.state.teams[this.offense].stats[this.batter.id];
  }
  get pitcherStats() {
    return this.state.teams[this.defense].stats[this.pitcher.id];
  }
  log(message) {
    this.state.playLog.push(message);
    if (this.state.playLog.length > 160) this.state.playLog.shift();
  }
  snapshot() {
    return structuredClone(this.state);
  }
  active() {
    if (this.state.finished) throw new Error('The game is over.');
  }
  resetCount() {
    this.state.balls = 0;
    this.state.strikes = 0;
  }
  nextBatter() {
    const s = this.state;
    s.orders[s.half] = (s.orders[s.half] + 1) % 9;
    this.resetCount();
  }
  runner(player = this.batter) {
    return { player, earned: true };
  }
  scoreRunner(r, rbi = true, allRuns = false) {
    const s = this.state;
    // A non-home-run walk-off ends once the winning run scores.
    if (!allRuns && s.half === 1 && s.inning >= s.scheduledInnings && this.score[1] > this.score[0]) return;
    const team = s.teams[s.half];
    while (team.runs.length < s.inning) team.runs.push(0);
    team.runs[s.inning - 1]++;
    team.stats[r.player.id].runs++;
    if (rbi) this.batterStats.rbi++;
  }
  finishIfWalkoff() {
    const s = this.state;
    if (s.half === 1 && s.inning >= s.scheduledInnings && this.score[1] > this.score[0]) this.finish(1);
  }
  finish(winner) {
    this.state.finished = true;
    this.state.winner = winner;
    this.log(`${TEAMS[winner].name} WIN! ${this.score[0]}–${this.score[1]}`);
  }
  checkOuts() {
    if (this.state.outs >= 3) this.endHalf();
  }
  endHalf() {
    const s = this.state;
    s.bases = [null, null, null];
    s.outs = 0;
    this.resetCount();
    if (s.half === 0) {
      if (s.inning >= s.scheduledInnings && this.score[1] > this.score[0]) {
        this.finish(1);
        return;
      }
      s.half = 1;
    } else {
      if (s.inning >= s.scheduledInnings && this.score[0] !== this.score[1]) {
        this.finish(this.score[0] > this.score[1] ? 0 : 1);
        return;
      }
      s.half = 0;
      s.inning++;
    }
    while (s.teams[s.half].runs.length < s.inning) s.teams[s.half].runs.push(0);
    if (s.ghostRunner && s.inning > s.scheduledInnings) {
      const previous = (s.orders[s.half] + 8) % 9;
      const p = getPlayer(s.half, s.teams[s.half].lineup[previous]);
      s.bases[1] = { player: p, earned: false };
    }
    this.log(`${s.half === 0 ? 'TOP' : 'BOTTOM'} ${s.inning} • ${TEAMS[s.half].name} AT BAT`);
  }
  pitch() {
    this.active();
    this.pitcherStats.pitches++;
  }
  ball() {
    this.active();
    this.state.balls++;
    if (this.state.balls >= 4) {
      this.walk();
      return 'WALK';
    }
    this.log('BALL');
    return 'BALL';
  }
  strike(swinging = false) {
    this.active();
    this.state.strikes++;
    if (this.state.strikes >= 3) {
      this.strikeout(swinging);
      return 'STRIKEOUT';
    }
    this.log(swinging ? 'SWINGING STRIKE' : 'CALLED STRIKE');
    return 'STRIKE';
  }
  foul(bunt = false) {
    this.active();
    if (bunt && this.state.strikes === 2) {
      this.strikeout(true);
      return 'BUNT STRIKEOUT';
    }
    this.state.strikes = Math.min(2, this.state.strikes + 1);
    this.log('FOUL BALL');
    return 'FOUL BALL';
  }
  foulTip(caught) {
    return caught ? this.strike(true) : this.foul();
  }
  walk(intentional = false) {
    this.active();
    const s = this.state;
    const batter = this.runner();
    const name = this.batter.name;
    this.batterStats.bb++;
    if (s.bases[0]) {
      if (s.bases[1]) {
        if (s.bases[2]) this.scoreRunner(s.bases[2]);
        s.bases[2] = s.bases[1];
      }
      s.bases[1] = s.bases[0];
    }
    s.bases[0] = batter;
    this.log(`${name}: ${intentional ? 'INTENTIONAL WALK' : 'WALK'}`);
    this.nextBatter();
    this.finishIfWalkoff();
  }
  hitByPitch() {
    this.active();
    this.walk();
    const old = (this.state.orders[this.offense] + 8) % 9;
    const id = this.state.teams[this.offense].lineup[old];
    this.state.teams[this.offense].stats[id].bb--;
    this.log('HIT BY PITCH • TAKE YOUR BASE');
  }
  strikeout(swinging = true) {
    this.active();
    const name = this.batter.name;
    this.batterStats.ab++;
    this.batterStats.k++;
    this.state.outs++;
    this.log(`${name}: STRUCK OUT ${swinging ? 'SWINGING' : 'LOOKING'}`);
    this.nextBatter();
    this.checkOuts();
  }
  hit(bases, error = false) {
    this.active();
    const s = this.state;
    const batter = this.runner();
    const name = this.batter.name;
    this.batterStats.ab++;
    if (!error) {
      this.batterStats.hits++;
      s.teams[this.offense].hits++;
      if (bases === 4) this.batterStats.hr++;
    } else {
      s.teams[this.defense].errors++;
      batter.earned = false;
    }
    for (let i = 2; i >= 0; i--) {
      const r = s.bases[i];
      s.bases[i] = null;
      if (r) {
        if (i + bases >= 3) this.scoreRunner(r, !error, bases === 4);
        else s.bases[i + bases] = r;
      }
    }
    if (bases === 4) this.scoreRunner(batter, true, true);
    else s.bases[bases - 1] = batter;
    this.log(`${name}: ${error ? 'REACHED ON ERROR' : ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'HOME RUN!'][bases]}`);
    this.nextBatter();
    this.finishIfWalkoff();
  }
  /** A catch precedes a tag-up. No run scores if the catch is the third out. */
  flyOut(tagUp = false) {
    this.active();
    const s = this.state;
    const sac = tagUp && s.outs < 2 && !!s.bases[2];
    if (!sac) this.batterStats.ab++;
    if (sac) {
      this.scoreRunner(s.bases[2]);
      s.bases[2] = null;
    }
    s.outs++;
    this.log(sac ? 'SACRIFICE FLY • RUN SCORES' : 'FLY OUT');
    this.nextBatter();
    this.finishIfWalkoff();
    if (!s.finished) this.checkOuts();
  }
  /** A ground ball force never scores a run on the third out. */
  groundOut(doublePlay = false, productive = false) {
    this.active();
    const s = this.state;
    this.batterStats.ab++;
    const dp = doublePlay && !!s.bases[0] && s.outs < 2;
    if (dp) {
      s.bases[0] = null;
      s.outs += 2;
    } else s.outs++;
    if (productive && s.outs < 3) {
      if (s.bases[2]) {
        this.scoreRunner(s.bases[2], !dp);
        s.bases[2] = null;
      }
      for (let i = 1; i >= 0; i--)
        if (s.bases[i] && !s.bases[i + 1]) {
          s.bases[i + 1] = s.bases[i];
          s.bases[i] = null;
        }
    }
    this.log(dp ? 'DOUBLE PLAY!' : 'GROUND OUT');
    this.nextBatter();
    this.finishIfWalkoff();
    if (!s.finished) this.checkOuts();
  }
  sacrificeBunt() {
    this.active();
    const side = this.offense;
    const id = this.batter.id;
    const sacrifice = this.state.outs < 2 && this.state.bases.some(Boolean);
    this.groundOut(false, true);
    if (sacrifice) {
      this.state.teams[side].stats[id].ab--;
      this.log('SACRIFICE BUNT • RUNNERS ADVANCE');
    }
  }
  /** Retire the leading forced runner; batter reaches first. No hit is awarded. */
  fieldersChoice(forceBase = 2) {
    this.active();
    const s = this.state;
    const count = forceBase - 1;
    if (!s.bases[0] || (count >= 2 && !s.bases[1]) || (count === 3 && !s.bases[2])) {
      this.groundOut();
      return;
    }
    const batter = this.runner();
    this.batterStats.ab++;
    s.outs++;
    if (s.outs < 3) {
      s.bases[count - 1] = null;
      for (let i = count - 2; i >= 0; i--) {
        s.bases[i + 1] = s.bases[i];
        s.bases[i] = null;
      }
      s.bases[0] = batter;
    }
    this.log(`FIELDER'S CHOICE • FORCE AT ${forceBase === 4 ? 'HOME' : forceBase}`);
    this.nextBatter();
    this.checkOuts();
  }
  advanceRunner(from, safe = true, steal = false) {
    this.active();
    const s = this.state;
    const r = s.bases[from];
    if (!r) return false;
    if (safe && from < 2 && s.bases[from + 1]) return false;
    s.bases[from] = null;
    if (safe) {
      if (from === 2) this.scoreRunner(r, false);
      else s.bases[from + 1] = r;
      if (steal) s.teams[this.offense].stats[r.player.id].sb++;
      this.log(steal ? 'STOLEN BASE!' : 'RUNNER ADVANCES');
      this.finishIfWalkoff();
    } else {
      s.outs++;
      if (steal) s.teams[this.offense].stats[r.player.id].cs++;
      this.log(steal ? 'CAUGHT STEALING' : 'TAG OUT');
      this.checkOuts();
    }
    return true;
  }
  pickoff(base) {
    const r = this.state.bases[base];
    if (!r) return false;
    const result = this.advanceRunner(base, false);
    this.log('PICKED OFF!');
    return result;
  }
  wildPitch() {
    this.active();
    for (let i = 2; i >= 0; i--) if (this.state.bases[i]) this.advanceRunner(i, true);
    this.log('WILD PITCH');
  }
  balk() {
    this.active();
    this.wildPitch();
    this.log('BALK • RUNNERS ADVANCE');
  }
  /** The infield fly retires only the batter; runners keep their bases. */
  infieldFly() {
    this.active();
    if (this.state.outs < 2 && this.state.bases[0] && this.state.bases[1]) {
      this.batterStats.ab++;
      this.state.outs++;
      this.log('INFIELD FLY • BATTER OUT');
      this.nextBatter();
    } else this.flyOut();
  }
  catcherInterference() {
    this.active();
    const t = this.state.teams[this.defense];
    t.errors++;
    this.walk();
    const id = this.state.teams[this.offense].lineup[(this.state.orders[this.offense] + 8) % 9];
    this.state.teams[this.offense].stats[id].bb--;
    this.log('CATCHER INTERFERENCE • FIRST BASE AWARDED');
  }
  /** Dropped third strike: first unoccupied, or two outs. Safe arrival records K, not a hit. */
  droppedThirdStrike(reached) {
    this.active();
    if (!reached || (this.state.bases[0] && this.state.outs < 2)) {
      this.strikeout();
      return;
    }
    const s = this.state;
    const batter = this.runner();
    this.batterStats.ab++;
    this.batterStats.k++;
    if (s.bases[0]) {
      if (s.bases[1]) {
        if (s.bases[2]) this.scoreRunner(s.bases[2], false);
        s.bases[2] = s.bases[1];
      }
      s.bases[1] = s.bases[0];
    }
    s.bases[0] = batter;
    this.log('DROPPED THIRD STRIKE • BATTER SAFE');
    this.nextBatter();
    this.finishIfWalkoff();
  }
  substitute(side, slot, id) {
    this.active();
    const team = this.state.teams[side];
    const incoming = getPlayer(side, id);
    if (slot < 0 || slot > 8 || !Number.isInteger(slot)) throw new Error('Choose a batting-order slot.');
    if (team.used.includes(id) || team.lineup.includes(id) || team.pitcher === id) throw new Error('Player is already active or has left the game.');
    if (incoming.position === 'P') throw new Error('Use the bullpen to change pitchers.');
    const out = team.lineup[slot];
    team.used.push(out);
    team.lineup[slot] = id;
    for (const runner of this.state.bases) if (runner?.player.id === out) runner.player = incoming;
    this.log(`${incoming.name} ENTERS FOR ${getPlayer(side, out).name}`);
  }
  changePitcher(side, id) {
    this.active();
    const team = this.state.teams[side];
    const incoming = getPlayer(side, id);
    if (incoming.position !== 'P' || team.used.includes(id) || team.pitcher === id) throw new Error('Pitcher unavailable.');
    team.used.push(team.pitcher);
    team.pitcher = id;
    this.log(`${incoming.name} TAKES THE MOUND`);
  }
  validate() {
    const s = this.state;
    if (s.version !== 1 || s.inning < 1 || !Number.isInteger(s.inning) || ![0, 1].includes(s.half) || ![0, 1, 2].includes(s.outs) || s.balls < 0 || s.balls > 3 || s.strikes < 0 || s.strikes > 2) throw new Error('Invalid saved game.');
    if (![3, 6, 9].includes(s.scheduledInnings)) throw new Error('Invalid innings setting.');
    if (s.bases.length !== 3 || new Set(s.bases.filter(Boolean).map((r) => r.player.id)).size !== s.bases.filter(Boolean).length) throw new Error('Invalid baserunners.');
    for (const side of [0, 1]) {
      const t = s.teams[side];
      if (t.lineup.length !== 9 || new Set(t.lineup).size !== 9) throw new Error('Invalid lineup.');
      for (const id of t.lineup) getPlayer(side, id);
      getPlayer(side, t.pitcher);
      if (t.runs.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Invalid score.');
    }
  }
}
