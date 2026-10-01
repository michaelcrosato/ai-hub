import { RINK, Random, clamp, distance, inRink, length, normal, other, approach } from "./math.js";
import { TEAMS, playerById } from "./rosters.js";
import { PenaltyBox, RinkRules, classifyCheck, goalCrossing, shootoutWinner } from "./rules.js";
/** mode: exhibition | playoffs | practice | cup (Brick Cup best-of-five, exhibition rules). venue: brickyard | pond. */
export const DEFAULT_SETTINGS = { team: 0, periodSeconds: 120, difficulty: 2, mode: 'exhibition', players: 1, rules: true, sound: true, music: true, shake: true, camera: 'broadcast', venue: 'brickyard' };
export const emptyInput = () => ({ x: 0, z: 0, shoot: false, shootPressed: false, shootReleased: false, pass: false, check: false, deke: false, switch: false, turbo: false, power: false, line: false, goalie: false });
const newStats = () => ({ shots: 0, hits: 0, saves: 0, faceoffs: 0, possession: 0, passes: 0, penaltyMinutes: 0 });
export class Game {
    settings = { ...DEFAULT_SETTINGS };
    phase = 'attract';
    paused = false;
    phaseTimer = 0;
    time = 0;
    clock = 1200;
    period = 1;
    score = [0, 0];
    stats = [newStats(), newStats()];
    heat = [35, 35];
    selected = [0, 20];
    line = [0, 0];
    defense = [0, 0];
    goalieChoice = [18, 18];
    goaliePulled = [false, false];
    icingLock = null;
    players = [];
    puck = { position: { x: 0, y: .13, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    physics = null;
    carrier = null;
    lastTeam = null;
    lastTouch = [];
    shot = null;
    noPickup = 0;
    formerCarrier = -1;
    formerCooldown = 0;
    rules = new RinkRules();
    box = new PenaltyBox();
    delayed = null;
    rng = new Random();
    banner = 'BIG HITS. BRIGHT LIGHTS.';
    detail = 'WELCOME TO THE BRICK LEAGUE';
    bannerTime = 0;
    impact = 0;
    fireTime = 0;
    faceoffSpot = { x: 0, z: 0 };
    faceoffPress = [null, null];
    faceoffDuration = 2.6;
    nextPhase = 'faceoff';
    log = [];
    replay = [];
    replayTick = 0;
    winningTeam = null;
    shootout = [[], []];
    duelTeam = 0;
    duelIsShootout = true;
    duelShot = false;
    duelReleased = false;
    duelLastX = -4;
    duelResult = false;
    otFloor = [3, 3];
    timeoutUsed = [false, false];
    lastLineChange = [0, 0];
    onEvent = null;
    /** Reused by visual() so the renderer reads live state without per-frame allocation. */
    liveView = { players: [], puck: null };
    lastPuckEvent = 0;
    constructor(physics = null) {
        this.physics = physics;
        this.players = TEAMS.flatMap(team => team.roster.map(data => ({ id: data.id, team: team.id, data, x: 0, z: 0, vx: 0, vz: 0, angle: 0, active: false, goalie: data.position === 'G', energy: 100, stun: 0, cooldown: 0, deke: 0, check: 0, shotAnimation: 0, charge: 0, aiTime: 0, turbo: false, skating: 0, goals: 0, assists: 0, shots: 0 })));
        this.refreshLineup(false);
        this.positionFaceoff({ x: 0, z: 0 });
        this.carrier = 0;
    }
    get overtime() { return this.period >= 4; }
    get counts() {
        const c = this.box.counts(this.overtime && this.settings.mode !== 'playoffs');
        if (this.overtime && this.settings.mode !== 'playoffs')
            return [Math.max(c[0], this.otFloor[0]), Math.max(c[1], this.otFloor[1])];
        return c;
    }
    dir(team) {
        if (this.phase === 'duel' || this.phase === 'duel-result' || this.phase === 'shootout-intro')
            return team === this.duelTeam ? 1 : -1;
        return (team === 0 ? 1 : -1) * (this.period % 2 === 0 ? -1 : 1);
    }
    isHuman(team) { return this.phase !== 'attract' && (this.settings.players === 2 || this.settings.team === team); }
    skatingPlayers(team) { return this.players.filter(p => p.active && !p.goalie && (team === undefined || p.team === team)); }
    keeper(team) { return this.players.find(p => p.team === team && p.active && p.goalie); }
    emit(kind, text, detail = '', team, strength = 1) {
        if (['goal', 'whistle', 'period', 'finish'].includes(kind))
            this.log.unshift({ period: this.period, clock: this.clock, team, text, detail });
        if (this.log.length > 80)
            this.log.length = 80;
        this.onEvent?.({ kind, text, detail, team, strength });
    }
    notice(text, detail = '', duration = 2) { this.banner = text; this.detail = detail; this.bannerTime = duration; this.emit('notice', text, detail); }
    setPhysics(physics) { this.physics?.dispose(); this.physics = physics; }
    /** Attacking direction from the period alone (ignores the shootout/penalty-shot override). */
    baseDir(team) { return (team === 0 ? 1 : -1) * (this.period % 2 === 0 ? -1 : 1); }
    start(settings) {
        this.settings = { ...settings };
        this.rng = new Random((Date.now() & 0xffffffff) >>> 0);
        this.period = 1;
        this.clock = 1200;
        this.time = 0;
        this.phase = 'faceoff';
        this.paused = false;
        this.score = [0, 0];
        this.stats = [newStats(), newStats()];
        this.heat = [35, 35];
        this.box = new PenaltyBox();
        this.rules.reset();
        this.delayed = null;
        this.line = [0, 0];
        this.defense = [0, 0];
        this.goaliePulled = [false, false];
        this.goalieChoice = [18, 18];
        this.timeoutUsed = [false, false];
        this.otFloor = [3, 3];
        this.shootout = [[], []];
        this.log = [];
        this.replay = [];
        this.winningTeam = null;
        this.lastLineChange = [0, 0];
        this.icingLock = null;
        this.nextPhase = 'faceoff';
        this.lastTouch = [];
        this.shot = null;
        this.fireTime = 0;
        this.impact = 0;
        this.formerCarrier = -1;
        this.formerCooldown = 0;
        this.replayTick = 0;
        for (const p of this.players) {
            p.active = false;
            p.energy = 100;
            p.goals = 0;
            p.assists = 0;
            p.shots = 0;
            p.stun = 0;
            p.cooldown = 0;
            p.deke = 0;
            p.check = 0;
            p.aiTime = 0;
            p.charge = 0;
        }
        this.refreshLineup(false);
        this.beginFaceoff({ x: 0, z: 0 }, 'OPENING FACEOFF');
    }
    refreshLineup(preserve = true) {
        const counts = this.counts;
        for (const team of [0, 1]) {
            const roster = TEAMS[team].roster, old = new Set(this.players.filter(p => p.team === team && p.active).map(p => p.id));
            const forwards = roster.slice(this.line[team] * 3, this.line[team] * 3 + 3);
            const defense = roster.slice(12 + this.defense[team] * 2, 14 + this.defense[team] * 2);
            let priority = this.overtime && this.settings.mode !== 'playoffs' ? [forwards[0], forwards[1], defense[0], defense[1], forwards[2]] : [...forwards, ...defense];
            priority = [...priority, ...roster.filter(p => p.position !== 'G')].filter((p, i, a) => a.findIndex(q => q.id === p.id) === i && !this.box.unavailable(p.id));
            const delayedExtra = this.delayed && this.delayed.team !== team;
            const pulled = this.goaliePulled[team] || !!delayedExtra;
            const chosen = priority.slice(0, counts[team] + (pulled ? 1 : 0)).map(p => p.id);
            if (!pulled)
                chosen.push(team * 20 + this.goalieChoice[team]);
            for (const p of this.players.filter(p => p.team === team)) {
                p.active = chosen.includes(p.id);
                if (!p.active) {
                    p.x = -10 + (p.id % 20) * .8 + team * 11;
                    p.z = -15.2;
                    p.vx = 0;
                    p.vz = 0;
                }
                else if (!preserve || !old.has(p.id)) {
                    p.x = team === 0 ? -7 : 7;
                    p.z = -11;
                    p.vx = 0;
                    p.vz = 0;
                    p.stun = 0;
                }
            }
            if (!this.players[this.selected[team]]?.active || this.players[this.selected[team]].goalie)
                this.selected[team] = chosen[0];
        }
        if (this.carrier !== null && !this.players[this.carrier].active)
            this.dropPuck(this.players[this.carrier]);
    }
    changeLine(team) {
        if (this.icingLock === team && this.phase !== 'live') {
            this.notice('LINE CHANGE DENIED', 'The icing team must keep its skaters on the ice.');
            return;
        }
        if (['duel', 'duel-result', 'shootout-intro', 'final'].includes(this.phase))
            return;
        if (this.time - this.lastLineChange[team] < 1 && this.time > 0)
            return;
        if (this.carrier !== null && this.players[this.carrier].team === team)
            this.dropPuck(this.players[this.carrier]);
        this.line[team] = (this.line[team] + 1) % 4;
        this.defense[team] = (this.defense[team] + 1) % 3;
        this.lastLineChange[team] = this.time;
        this.refreshLineup(true);
        if (this.phase === 'faceoff' || this.phase === 'stoppage')
            this.positionFaceoff(this.faceoffSpot);
        this.notice(`${TEAMS[team].abbr} • LINE ${this.line[team] + 1}`, 'Fresh legs. New energy.', 1.6);
    }
    toggleGoalie(team) {
        if (!['live', 'faceoff', 'stoppage'].includes(this.phase))
            return;
        this.goaliePulled[team] = !this.goaliePulled[team];
        this.refreshLineup(true);
        this.notice(this.goaliePulled[team] ? 'EMPTY NET!' : 'GOALIE RETURNS', `${TEAMS[team].abbr} ${this.goaliePulled[team] ? 'adds an extra attacker' : 'is back at full protection'}.`);
    }
    substituteGoalie(team) {
        if (!this.paused && this.phase === 'live')
            return;
        this.goalieChoice[team] = this.goalieChoice[team] === 18 ? 19 : 18;
        this.refreshLineup();
        this.notice('GOALIE CHANGE', playerById(team * 20 + this.goalieChoice[team]).name);
    }
    timeout(team) {
        if (this.timeoutUsed[team] || !['faceoff', 'stoppage', 'intermission'].includes(this.phase) || this.icingLock === team)
            return false;
        this.timeoutUsed[team] = true;
        for (const p of this.players.filter(p => p.team === team))
            p.energy = 100;
        this.notice('TIMEOUT', `${TEAMS[team].name} catches a second wind.`, 3);
        return true;
    }
    positionFaceoff(spot) {
        for (const team of [0, 1]) {
            const dir = this.dir(team), ps = this.skatingPlayers(team);
            ps.forEach((p, i) => {
                const formation = [{ x: -1.1, z: 0 }, { x: -2.8, z: -4.4 }, { x: -2.8, z: 4.4 }, { x: -8, z: -3.8 }, { x: -8, z: 3.8 }, { x: -5, z: 0 }];
                const f = formation[i] ?? formation[0], inside = inRink(spot.x + f.x * dir, spot.z + f.z, 1);
                p.x = inside.x;
                p.z = inside.z;
                p.vx = 0;
                p.vz = 0;
                p.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
                p.charge = 0;
                p.stun = 0;
            });
            const g = this.keeper(team);
            if (g) {
                g.x = -dir * (RINK.goal - .7);
                g.z = 0;
                g.angle = dir * Math.PI / 2;
                g.stun = 0;
                g.vx = 0;
                g.vz = 0;
            }
            if (ps[0])
                this.selected[team] = ps[0].id;
        }
        this.puck.position = { ...spot, y: .13 };
        this.puck.velocity = { x: 0, y: 0, z: 0 };
        this.carrier = null;
        this.shot = null;
    }
    beginFaceoff(spot = { x: 0, z: 0 }, label = 'FACEOFF') {
        this.phase = 'faceoff';
        this.phaseTimer = this.faceoffDuration;
        this.faceoffSpot = { ...spot };
        this.faceoffPress = [null, null];
        this.otFloor = [3, 3];
        this.rules.reset();
        this.lastTouch = [];
        this.lastTeam = null;
        this.noPickup = .2;
        for (const team of [0, 1])
            if (!this.isHuman(team) && this.time - this.lastLineChange[team] > 28 && this.icingLock !== team) {
                this.line[team] = (this.line[team] + 1) % 4;
                this.defense[team] = (this.defense[team] + 1) % 3;
                this.lastLineChange[team] = this.time;
            }
        this.refreshLineup(true);
        this.positionFaceoff(spot);
        this.banner = label;
        this.detail = 'PRESS SHOOT AS THE PUCK DROPS';
        this.bannerTime = 3;
    }
    whistle(reason, spot, detail = '') {
        this.phase = 'stoppage';
        this.phaseTimer = 1.8;
        this.faceoffSpot = spot;
        this.banner = reason;
        this.detail = detail;
        this.bannerTime = 3;
        this.carrier = null;
        this.shot = null;
        this.puck.velocity = { x: 0, y: 0, z: 0 };
        this.rules.reset();
        this.emit('whistle', reason, detail);
        if (this.delayed)
            this.assessDelayed();
    }
    defensiveDot(team, z = this.puck.position.z) { return { x: -this.dir(team) * RINK.faceoff, z: z >= 0 ? RINK.dotZ : -RINK.dotZ }; }
    touch(player) {
        if (this.lastTeam !== null && this.lastTeam !== player.team)
            this.lastTouch = [];
        this.lastTeam = player.team;
        if (this.lastTouch[0]?.player !== player.id)
            this.lastTouch.unshift({ player: player.id, team: player.team, at: this.time });
        this.lastTouch = this.lastTouch.slice(0, 5);
        this.rules.touch();
    }
    possess(player) {
        if (this.delayed?.team === player.team) {
            this.assessDelayed();
            return;
        }
        if (this.phase !== 'attract' && this.settings.rules && this.rules.offside[player.team]) {
            this.whistle('OFFSIDE', { x: this.dir(player.team) * (RINK.blue - 1.8), z: this.puck.position.z > 0 ? RINK.dotZ : -RINK.dotZ }, 'Tag up behind the blue line before touching the puck.');
            return;
        }
        this.carrier = player.id;
        this.touch(player);
        this.shot = null;
        if (this.isHuman(player.team) && !player.goalie)
            this.selected[player.team] = player.id;
    }
    dropPuck(player) {
        this.carrier = null;
        this.formerCarrier = player.id;
        this.formerCooldown = .45;
        this.noPickup = .12;
        this.puck.velocity = { x: player.vx * .8 + this.rng.between(-2, 2), z: player.vz * .8 + this.rng.between(-2, 2), y: 1.2 };
    }
    switchPlayer(team) {
        const ps = this.skatingPlayers(team).filter(p => p.id !== this.selected[team]);
        ps.sort((a, b) => distance(a, this.puck.position) - distance(b, this.puck.position));
        if (ps[0])
            this.selected[team] = ps[0].id;
    }
    shoot(player, power, aim, superShot = false) {
        if (this.carrier !== player.id || player.stun > 0 || player.cooldown > 0)
            return;
        if (superShot && this.heat[player.team] < 100) {
            this.notice('NOT HOT ENOUGH', 'Fill the heat meter with passes, shots, and big hits.');
            return;
        }
        if (superShot) {
            this.heat[player.team] = 0;
            this.fireTime = 2.8;
            this.impact = .8;
            this.emit('power', 'HEATSEEKER!', 'A brick-breaking blast.', player.team);
            this.notice('HEATSEEKER!', TEAMS[player.team].name, 1.5);
        }
        const dir = this.dir(player.team), accuracy = (100 - player.data.shot) * .008;
        const defendingGoalie = this.keeper(other(player.team));
        // A goalie commits to the release, rather than tracking a 65 m/s puck with zero reaction latency.
        if (defendingGoalie)
            defendingGoalie.aiTime = .27 + (3 - this.settings.difficulty) * .14;
        const target = clamp(aim * 1.05 + this.rng.between(-accuracy, accuracy), -1.28, 1.28);
        const n = normal(dir * (RINK.goal + .6) - player.x, target - player.z);
        const speed = superShot ? 65 : (27 + clamp(power, 0, 1) * 20) * (.8 + player.data.shot * .002);
        this.puck.position = { x: player.x + n.x * .95, z: player.z + n.z * .95, y: .18 };
        this.puck.velocity = { x: n.x * speed, z: n.z * speed, y: (superShot ? .5 : power * 2.1) };
        this.carrier = null;
        this.noPickup = .16;
        this.formerCarrier = player.id;
        this.formerCooldown = .7;
        this.shot = { player: player.id, team: player.team, onGoal: false, power: superShot };
        this.touch(player);
        this.rules.release(player.team, dir, player, player.id, this.counts);
        player.shotAnimation = .4;
        player.cooldown = .4;
        player.charge = 0;
        this.heat[player.team] = clamp(this.heat[player.team] + (superShot ? 0 : 5), 0, 100);
        if (this.phase === 'duel') {
            this.duelShot = true;
            this.duelReleased = true;
        }
        this.emit('shot', superShot ? 'HEATSEEKER' : power > .65 ? 'SLAPSHOT' : 'WRISTER', '', player.team);
    }
    pass(player, input) {
        if (this.carrier !== player.id || player.cooldown > 0)
            return;
        const teammates = this.skatingPlayers(player.team).filter(p => p.id !== player.id && p.stun <= 0);
        const dir = this.dir(player.team), aim = length(input) > .2 ? normal(input.x, input.z) : { x: dir, z: 0 };
        teammates.sort((a, b) => {
            const score = (p) => { const n = normal(p.x - player.x, p.z - player.z); return (n.x * aim.x + n.z * aim.z) * 12 - distance(p, player) * .23; };
            return score(b) - score(a);
        });
        const target = teammates[0];
        if (!target)
            return;
        const n = normal(target.x + target.vx * .28 - player.x, target.z + target.vz * .28 - player.z);
        this.puck.position = { x: player.x + n.x * .9, z: player.z + n.z * .9, y: .16 };
        this.puck.velocity = { x: n.x * 26, z: n.z * 26, y: .25 };
        this.carrier = null;
        this.noPickup = .14;
        this.shot = null;
        this.formerCarrier = player.id;
        this.formerCooldown = .65;
        player.cooldown = .22;
        this.touch(player);
        this.rules.release(player.team, dir, player, player.id, this.counts);
        this.stats[player.team].passes++;
        this.heat[player.team] = clamp(this.heat[player.team] + 4, 0, 100);
        if (this.isHuman(player.team))
            this.selected[player.team] = target.id;
        this.emit('pass', 'PASS', '', player.team);
    }
    check(player) {
        if (player.cooldown > 0 || player.stun > 0 || this.phase === 'duel')
            return;
        player.check = .25;
        player.cooldown = .72;
        player.energy = Math.max(0, player.energy - 7);
        const victims = this.players.filter(p => p.active && p.team !== player.team && p.stun <= 0).sort((a, b) => distance(a, player) - distance(b, player));
        const victim = victims[0];
        if (!victim || distance(victim, player) > 2.1 || victim.deke > 0)
            return;
        const hasPuck = this.carrier === victim.id, dir = this.dir(victim.team);
        const fromBehind = (player.x - victim.x) * dir < -.55;
        const ahead = this.skatingPlayers(player.team).filter(p => (p.x - victim.x) * dir > 0 && p.id !== player.id);
        const foul = this.settings.rules && this.phase !== 'attract' ? classifyCheck({ hasPuck, goalie: victim.goalie, atBoards: Math.abs(victim.z) > 11 || Math.abs(victim.x) > 28, fromBehind, speed: length({ x: player.vx, z: player.vz }), turbo: player.turbo, breakaway: hasPuck && victim.x * dir > 7.6 && ahead.length === 0 }) : null;
        if (foul?.penaltyShot) {
            this.startPenaltyShot(victim.team);
            return;
        }
        victim.stun = 1.05 + player.data.check * .006;
        const n = normal(victim.x - player.x, victim.z - player.z);
        victim.vx = n.x * 11;
        victim.vz = n.z * 11;
        this.stats[player.team].hits++;
        this.heat[player.team] = clamp(this.heat[player.team] + 13, 0, 100);
        this.impact = .55;
        if (hasPuck)
            this.dropPuck(victim);
        this.emit('hit', 'BRICKED!', victim.data.name, player.team);
        if (foul)
            this.penalty(player.team, player.id, foul.reason, foul.kind);
        else
            this.notice('BIG HIT!', `${player.data.name.toUpperCase()} • ${TEAMS[player.team].abbr}`, 1.2);
    }
    penalty(team, player, reason, kind = 'minor') {
        if (this.delayed || this.phase === 'attract')
            return;
        this.delayed = { team, player, reason, kind, timer: 8 };
        if (this.carrier !== null && this.players[this.carrier].team !== team) {
            this.refreshLineup();
            this.notice('DELAYED PENALTY', `${TEAMS[team].abbr} • ${reason}`);
        }
        else
            this.assessDelayed();
    }
    assessDelayed() {
        const p = this.delayed;
        if (!p)
            return;
        this.delayed = null;
        this.box.add(p.team, p.player, p.reason, p.kind);
        this.stats[p.team].penaltyMinutes += p.kind === 'major' ? 5 : p.kind === 'double-minor' ? 4 : 2;
        this.refreshLineup();
        this.whistle(p.reason, this.defensiveDot(p.team), `${playerById(p.player).name} • ${p.kind === 'major' ? '5:00 MAJOR' : '2:00 MINOR'}`);
    }
    recordShot(team) {
        if (this.phase === 'duel' && this.duelIsShootout)
            return;
        if (team !== undefined && (!this.shot || this.shot.team !== team)) {
            const touch = this.lastTouch.find(t => t.team === team);
            if (touch)
                this.shot = { team, player: touch.player, onGoal: false, power: false };
        }
        if (this.shot && !this.shot.onGoal) {
            this.shot.onGoal = true;
            this.stats[this.shot.team].shots++;
            this.players[this.shot.player].shots++;
        }
    }
    goal(team) {
        if (this.phase === 'duel') {
            this.finishDuel(true);
            return;
        }
        if (this.phase === 'attract') {
            this.positionFaceoff({ x: 0, z: 0 });
            this.carrier = this.skatingPlayers(team)[0].id;
            return;
        }
        if (this.settings.rules && this.rules.offside[team]) {
            this.whistle('NO GOAL • OFFSIDE', { x: this.dir(team) * 5.8, z: RINK.dotZ });
            return;
        }
        this.recordShot(team);
        this.score[team]++;
        this.heat[team] = clamp(this.heat[team] + 30, 0, 100);
        const touch = this.lastTouch.find(t => t.team === team && this.time - t.at < 15), scorer = touch ? this.players[touch.player] : null;
        if (scorer)
            scorer.goals++;
        const assists = this.lastTouch.filter(t => t.team === team && t.player !== scorer?.id && this.time - t.at < 15).filter((t, i, all) => all.findIndex(a => a.player === t.player) === i).slice(0, 2);
        for (const assist of assists)
            this.players[assist.player].assists++;
        const currentCounts = this.counts;
        const cancelledMinor = this.box.goal(team, currentCounts);
        if (this.delayed) {
            const dp = this.delayed;
            this.delayed = null;
            if (dp.team === team || dp.kind === 'major' || dp.kind === 'double-minor' || cancelledMinor) {
                const kind = dp.kind === 'double-minor' && !cancelledMinor ? 'minor' : dp.kind;
                this.box.add(dp.team, dp.player, dp.reason, kind);
                this.stats[dp.team].penaltyMinutes += kind === 'major' ? 5 : kind === 'double-minor' ? 4 : 2;
            }
        }
        this.banner = 'GOOOAL!';
        this.detail = scorer ? `#${scorer.data.number} ${scorer.data.name.toUpperCase()}${assists.length ? '  /  ' + assists.map(a => playerById(a.player).name).join(' + ') : '  /  UNASSISTED'}` : `${TEAMS[team].name} • OWN GOAL`;
        this.bannerTime = 6;
        this.phase = 'goal';
        this.phaseTimer = 2.3;
        this.impact = 1;
        this.fireTime = 2;
        this.carrier = null;
        this.goaliePulled = [false, false];
        this.icingLock = null;
        this.nextPhase = this.overtime ? 'final' : 'faceoff';
        if (this.overtime)
            this.winningTeam = team;
        this.emit('goal', 'GOAL', this.detail, team);
    }
    finish(team) { this.winningTeam = team; this.phase = 'final'; this.banner = `${TEAMS[team].name} WINS!`; this.detail = 'THAT’S BRICK LEAGUE HOCKEY.'; this.emit('finish', this.banner, '', team); }
    endPeriod() {
        this.carrier = null;
        this.puck.velocity = { x: 0, y: 0, z: 0 };
        this.delayed && this.assessDelayed();
        if (this.period >= 3 && this.score[0] !== this.score[1]) {
            this.finish(this.score[0] > this.score[1] ? 0 : 1);
            return;
        }
        if (this.period === 4 && this.settings.mode !== 'playoffs') {
            this.startShootout();
            return;
        }
        this.phase = 'intermission';
        this.phaseTimer = 7;
        this.banner = this.period >= 3 ? 'SUDDEN DEATH' : 'INTERMISSION';
        this.detail = this.period >= 3 ? (this.settings.mode === 'playoffs' ? '5 ON 5 • NEXT GOAL WINS' : '3 ON 3 • NEXT GOAL WINS') : 'CATCH YOUR BREATH. THE NEXT PERIOD IS COMING.';
        this.emit('period', this.banner, `End of period ${this.period}`);
    }
    advancePeriod() {
        this.period++;
        this.clock = this.period >= 4 && this.settings.mode !== 'playoffs' ? 300 : 1200;
        this.goaliePulled = [false, false];
        this.otFloor = [3, 3];
        this.icingLock = null;
        for (const p of this.players)
            p.energy = Math.min(100, p.energy + 65);
        this.refreshLineup(false);
        this.beginFaceoff({ x: 0, z: 0 }, this.period >= 4 ? 'OVERTIME' : `PERIOD ${this.period}`);
    }
    startShootout() { this.shootout = [[], []]; this.duelTeam = 0; this.duelIsShootout = true; this.phase = 'shootout-intro'; this.phaseTimer = 4; this.banner = 'THE SHOOTOUT'; this.detail = 'THREE ROUNDS. ONE SHOT. ALL NERVES.'; }
    startPenaltyShot(team) {
        if (this.delayed) {
            const dp = this.delayed;
            this.delayed = null;
            this.box.add(dp.team, dp.player, dp.reason, dp.kind);
            this.stats[dp.team].penaltyMinutes += dp.kind === 'major' ? 5 : dp.kind === 'double-minor' ? 4 : 2;
        }
        this.duelTeam = team; this.duelIsShootout = false; this.phase = 'shootout-intro'; this.phaseTimer = 3; this.banner = 'PENALTY SHOT!'; this.detail = 'A clear breakaway was denied.'; this.emit('whistle', this.banner, this.detail, team); }
    beginDuel() {
        this.phase = 'duel';
        this.shot = null;
        this.phaseTimer = 14;
        this.duelShot = false;
        this.duelReleased = false;
        this.duelLastX = -4;
        this.rules.reset();
        for (const p of this.players) {
            p.active = false;
            p.vx = 0;
            p.vz = 0;
            p.stun = 0;
            p.cooldown = 0;
        }
        const index = this.duelIsShootout ? this.shootout[this.duelTeam].length % 18 : 0;
        const shooter = this.players[this.duelTeam * 20 + index], goalie = this.players[other(this.duelTeam) * 20 + this.goalieChoice[other(this.duelTeam)]];
        shooter.active = true;
        shooter.x = -4;
        shooter.z = 0;
        shooter.energy = 100;
        shooter.angle = Math.PI / 2;
        shooter.charge = 0;
        goalie.active = true;
        goalie.x = RINK.goal - .7;
        goalie.z = 0;
        goalie.angle = -Math.PI / 2;
        this.carrier = shooter.id;
        this.selected[this.duelTeam] = shooter.id;
        this.lastTeam = this.duelTeam;
        this.lastTouch = [{ player: shooter.id, team: shooter.team, at: this.time }];
        this.puck.position = { x: -3.2, z: 0, y: .15 };
        this.puck.velocity = { x: 0, y: 0, z: 0 };
        this.noPickup = 0;
        this.banner = `${TEAMS[this.duelTeam].abbr} • ${this.duelIsShootout ? 'ROUND ' + (this.shootout[this.duelTeam].length + 1) : 'PENALTY SHOT'}`;
        this.detail = 'Keep moving forward. No rebounds.';
        this.bannerTime = 2;
    }
    finishDuel(scored) {
        this.duelResult = scored;
        this.phase = 'duel-result';
        this.phaseTimer = 2.6;
        this.carrier = null;
        if (this.duelIsShootout)
            this.shootout[this.duelTeam].push(scored);
        else if (scored) {
            this.score[this.duelTeam]++;
            this.players[this.selected[this.duelTeam]].goals++;
            this.recordShot(this.duelTeam);
        }
        this.banner = scored ? 'BURY IT!' : 'DENIED!';
        this.detail = TEAMS[this.duelTeam].name;
        this.impact = scored ? .8 : .3;
        this.emit(scored ? 'goal' : 'save', this.banner, this.duelIsShootout ? 'Shootout attempt' : 'Penalty shot', this.duelTeam);
    }
    skip() {
        if (this.phase === 'intermission')
            this.advancePeriod();
        else if (this.phase === 'replay' || this.phase === 'goal')
            this.afterGoal();
        else if (this.phase === 'shootout-intro')
            this.beginDuel();
    }
    afterGoal() { if (this.nextPhase === 'final' && this.winningTeam !== null)
        this.finish(this.winningTeam);
    else
        this.beginFaceoff(); }
    snapshot() { return { players: this.players.filter(p => p.active).map(p => ({ id: p.id, team: p.team, x: p.x, z: p.z, angle: p.angle, active: p.active, goalie: p.goalie, stun: p.stun, deke: p.deke, turbo: p.turbo, skating: p.skating, charge: p.charge, shotAnimation: p.shotAnimation })), puck: { ...this.puck.position } }; }
    visual() {
        if (this.phase === 'replay' && this.replay.length)
            return this.replay[clamp(Math.floor((1 - this.phaseTimer / 3.5) * this.replay.length), 0, this.replay.length - 1)];
        const view = this.liveView, list = view.players;
        list.length = 0;
        for (const p of this.players)
            if (p.active)
                list.push(p);
        view.puck = this.puck.position;
        return view;
    }
    update(dt, inputs) {
        if (this.paused)
            return;
        dt = clamp(dt, 0, 1 / 30);
        if (this.phase === 'final') {
            // The match is over, but the celebration keeps moving.
            this.time += dt;
            this.impact = Math.max(0, this.impact - dt * 2.2);
            this.fireTime = Math.max(0, this.fireTime - dt);
            return;
        }
        this.time += dt;
        this.bannerTime = Math.max(0, this.bannerTime - dt);
        this.impact = Math.max(0, this.impact - dt * 2.2);
        this.fireTime = Math.max(0, this.fireTime - dt);
        if (this.phase === 'faceoff') {
            for (const team of [0, 1])
                if (this.isHuman(team) && inputs[team].shootPressed && this.faceoffPress[team] === null)
                    this.faceoffPress[team] = this.phaseTimer;
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0) {
                const timing = [0, 1].map(team => this.isHuman(team) ? (this.faceoffPress[team] === null ? 1.2 : Math.abs(this.faceoffPress[team] - .06)) : this.rng.between(.11, .40 - this.settings.difficulty * .055));
                const winner = timing[0] + this.rng.between(0, .025) < timing[1] ? 0 : 1;
                this.phase = 'live';
                this.icingLock = null;
                const center = this.skatingPlayers(winner)[0];
                this.possess(center);
                this.stats[winner].faceoffs++;
                this.notice(timing[winner] < .14 ? 'PERFECT DRAW!' : `${TEAMS[winner].abbr} WINS THE DRAW`, '', 1.4);
                this.emit('faceoff', 'PUCK DROP', '', winner);
                this.replay = [];
            }
            return;
        }
        if (this.phase === 'stoppage') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0)
                this.beginFaceoff(this.faceoffSpot);
            return;
        }
        if (this.phase === 'intermission') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0)
                this.advancePeriod();
            return;
        }
        if (this.phase === 'goal') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0) {
                this.phase = 'replay';
                this.phaseTimer = 3.5;
            }
            return;
        }
        if (this.phase === 'replay') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0)
                this.afterGoal();
            return;
        }
        if (this.phase === 'shootout-intro') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0)
                this.beginDuel();
            return;
        }
        if (this.phase === 'duel-result') {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0) {
                if (!this.duelIsShootout) {
                    if (this.overtime && this.duelResult)
                        this.finish(this.duelTeam);
                    else {
                        const defending = other(this.duelTeam);
                        const dot = { x: -this.baseDir(defending) * RINK.faceoff, z: this.puck.position.z >= 0 ? RINK.dotZ : -RINK.dotZ };
                        this.refreshLineup(false);
                        this.beginFaceoff(this.duelResult ? { x: 0, z: 0 } : dot);
                    }
                }
                else {
                    const winner = shootoutWinner(this.shootout);
                    if (winner !== null) {
                        this.score[winner]++;
                        this.finish(winner);
                    }
                    else {
                        this.duelTeam = other(this.duelTeam);
                        this.beginDuel();
                    }
                }
            }
            return;
        }
        const attract = this.phase === 'attract', duel = this.phase === 'duel';
        if (duel) {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0) {
                this.finishDuel(false);
                return;
            }
        }
        if (!attract && !duel && this.settings.mode !== 'practice') {
            const clockDt = dt * 1200 / this.settings.periodSeconds;
            this.clock = Math.max(0, this.clock - clockDt);
            const oldCounts = this.counts, expired = this.box.advance(clockDt);
            if (expired.length) {
                if (this.overtime && this.settings.mode !== 'playoffs') {
                    for (const team of [0, 1])
                        this.otFloor[team] = Math.min(5, oldCounts[team] + expired.filter(p => p.team === team && this.box.reducing(p)).length);
                    this.otFloor[0] = Math.max(this.otFloor[0], oldCounts[0]);
                    this.otFloor[1] = Math.max(this.otFloor[1], oldCounts[1]);
                }
                this.refreshLineup();
                this.notice('OUT OF THE BOX', 'Penalty time served.', 1.3);
            }
            if (this.clock <= 0) {
                this.endPeriod();
                return;
            }
        }
        this.noPickup -= dt;
        this.formerCooldown -= dt;
        for (const team of [0, 1]) {
            this.heat[team] = Math.min(100, this.heat[team] + dt * .2);
            if (!duel && this.isHuman(team)) {
                if (inputs[team].switch)
                    this.switchPlayer(team);
                if (inputs[team].line)
                    this.changeLine(team);
                if (inputs[team].goalie)
                    this.toggleGoalie(team);
            }
        }
        const previous = { ...this.puck.position };
        for (const p of this.players) {
            p.stun = Math.max(0, p.stun - dt);
            p.cooldown = Math.max(0, p.cooldown - dt);
            p.deke = Math.max(0, p.deke - dt);
            p.check = Math.max(0, p.check - dt);
            p.shotAnimation = Math.max(0, p.shotAnimation - dt);
            p.aiTime -= dt;
            if (!p.active) {
                p.energy = Math.min(100, p.energy + dt * 6);
                continue;
            }
            if (p.goalie) {
                this.moveGoalie(p, dt);
                continue;
            }
            let move = { x: 0, z: 0 }, turbo = false;
            if (this.isHuman(p.team) && this.selected[p.team] === p.id) {
                const input = inputs[p.team];
                move = normal(input.x, input.z);
                turbo = input.turbo && length(move) > .1;
                if (p.stun <= 0) {
                    if (input.shoot && this.carrier === p.id)
                        p.charge = Math.min(1, p.charge + dt * 1.2);
                    if (input.shootReleased && this.carrier === p.id)
                        this.shoot(p, Math.max(.12, p.charge), input.z);
                    if (input.power)
                        this.shoot(p, 1, input.z, true);
                    if (input.pass) {
                        if (this.carrier === p.id && !duel)
                            this.pass(p, move);
                        else if (!duel)
                            this.poke(p);
                    }
                    if (input.check && !duel)
                        this.check(p);
                    if (input.deke && p.cooldown <= 0 && p.energy >= 12) {
                        p.deke = .48;
                        p.cooldown = .65;
                        p.energy -= 12;
                        p.vz += (input.z || (p.z > 0 ? -1 : 1)) * 7;
                        this.notice('SILKY!', '', .6);
                    }
                }
                // A wind-up only lasts while Shoot is held (losing the puck mid-charge used to leave it stuck).
                if (!input.shoot)
                    p.charge = 0;
            }
            else {
                // Skaters the CPU drives never wind up (a human switching away mid-charge left the stick raised).
                p.charge = 0;
                const ai = this.ai(p, dt);
                move = ai.move;
                turbo = ai.turbo;
            }
            if (p.stun > 0) {
                p.vx *= Math.exp(-dt * 3);
                p.vz *= Math.exp(-dt * 3);
            }
            else {
                const speed = (7.2 + p.data.speed * .045) * (p.energy < 15 ? .75 : 1) * (turbo && p.energy > 2 ? 1.43 : 1) * (p.charge > .15 ? .82 : 1);
                p.turbo = turbo && p.energy > 2;
                p.energy = clamp(p.energy + dt * (p.turbo ? -17 : 5), 0, 100);
                const acceleration = length(move) > .1 ? 32 : 17;
                p.vx = approach(p.vx, move.x * speed, dt * acceleration);
                p.vz = approach(p.vz, move.z * speed, dt * acceleration);
                if (length(move) > .1)
                    p.angle = Math.atan2(move.x, move.z);
            }
            const pos = inRink(p.x + p.vx * dt, p.z + p.vz * dt, .6);
            p.x = pos.x;
            p.z = pos.z;
            // Players cannot skate through the back of a goal.
            if (Math.abs(p.x) > RINK.goal && Math.abs(p.x) < RINK.goal + 1.65 && Math.abs(p.z) < 1.9)
                p.z = (p.z >= 0 ? 1 : -1) * 1.9;
            p.skating += length({ x: p.vx, z: p.vz }) * dt;
        }
        if (!['live', 'attract', 'duel'].includes(this.phase))
            return;
        this.separatePlayers();
        if (this.carrier !== null) {
            const p = this.players[this.carrier];
            const dir = this.dir(p.team), speed = length({ x: p.vx, z: p.vz });
            const n = speed > 1 ? normal(p.vx, p.vz) : { x: dir, z: 0 };
            this.puck.position = { x: p.x + n.x * .86, z: p.z + n.z * .86, y: .15 };
            this.puck.velocity = { x: p.vx, z: p.vz, y: 0 };
            this.stats[p.team].possession += dt;
            if (duel && p.team === this.duelTeam) {
                if (p.x < this.duelLastX - 2 || p.x > RINK.goal + .3) {
                    this.finishDuel(false);
                    return;
                }
                this.duelLastX = Math.max(this.duelLastX, p.x);
            }
        }
        const freePuck = this.carrier === null, vx0 = this.puck.velocity.x, vz0 = this.puck.velocity.z;
        this.physics.step(dt, this.puck, !freePuck);
        if (freePuck)
            this.puckContact(vx0, vz0);
        if (this.carrier !== null || !this.checkGoalieSave(previous, duel)) {
            const goalTeam = goalCrossing(previous, this.puck.position, [this.dir(0), this.dir(1)]);
            if (goalTeam !== null) {
                this.goal(goalTeam);
                return;
            }
        }
        if (!['live', 'attract', 'duel'].includes(this.phase))
            return;
        if (duel && this.duelReleased && (this.puck.position.x > 29 || length(this.puck.velocity) < 2 || this.puck.position.x < -6)) {
            this.finishDuel(false);
            return;
        }
        if (this.settings.rules && !attract && !duel) {
            const offside = this.rules.updateOffside(previous, this.puck.position, this.players, [this.dir(0), this.dir(1)], this.carrier, this.lastTeam);
            if (offside !== null) {
                this.whistle('OFFSIDE', { x: this.dir(offside) * (RINK.blue - 1.8), z: this.puck.position.z >= 0 ? RINK.dotZ : -RINK.dotZ }, 'Puck first. Then the players.');
                return;
            }
            const icing = this.rules.checkIcing(previous, this.puck.position, this.players);
            if (icing !== null) {
                this.icingLock = icing;
                this.whistle('ICING', this.defensiveDot(icing), 'No line change for the icing team.');
                return;
            }
        }
        if (Math.abs(this.puck.position.x) > 32 || Math.abs(this.puck.position.z) > 14.8 || this.puck.position.y > 8) {
            if (attract) {
                this.positionFaceoff({ x: 0, z: 0 });
                this.carrier = this.skatingPlayers(0)[0].id;
            }
            else if (duel)
                this.finishDuel(false);
            else if (this.settings.rules && this.lastTeam !== null && previous.x * this.dir(this.lastTeam) < -RINK.blue)
                this.penalty(this.lastTeam, this.lastTouch[0]?.player ?? this.selected[this.lastTeam], 'DELAY OF GAME');
            else
                this.whistle('PUCK OUT OF PLAY', { x: clamp(previous.x, -RINK.faceoff, RINK.faceoff), z: previous.z >= 0 ? RINK.dotZ : -RINK.dotZ });
            return;
        }
        if (this.carrier === null && this.noPickup <= 0 && !duel) {
            const nearest = this.skatingPlayers().filter(p => p.stun <= 0 && (p.id !== this.formerCarrier || this.formerCooldown <= 0) && distance(p, this.puck.position) < 1.08 && this.puck.position.y < 1.05).sort((a, b) => distance(a, this.puck.position) - distance(b, this.puck.position))[0];
            if (nearest) {
                this.possess(nearest);
                if (this.isHuman(nearest.team) && inputs[nearest.team].shoot && this.carrier === nearest.id)
                    this.shoot(nearest, .7, inputs[nearest.team].z);
            }
        }
        if (this.delayed) {
            this.delayed.timer -= dt;
            if (this.delayed.timer <= 0) {
                this.assessDelayed();
                return;
            }
        }
        if (!duel) {
            this.replayTick += dt;
            if (this.replayTick >= 1 / 15) {
                this.replayTick = 0;
                this.replay.push(this.snapshot());
                if (this.replay.length > 65)
                    this.replay.shift();
            }
        }
    }
    /** Ring a post or thump the boards when the free puck changes direction sharply. */
    puckContact(vx0, vz0) {
        const v = this.puck.velocity, p = this.puck.position, change = Math.hypot(v.x - vx0, v.z - vz0);
        if (change < 3.2 || this.time - this.lastPuckEvent < .12)
            return;
        this.lastPuckEvent = this.time;
        // Posts: at the goal line (not deep along the side netting), crossbar: above the mouth.
        const lineGap = Math.abs(p.x) - RINK.goal, nearPost = lineGap > -.45 && lineGap < .2 && Math.abs(Math.abs(p.z) - RINK.goalHalf) < .4 && p.y < 1.4;
        const crossbar = Math.abs(Math.abs(p.x) - RINK.goal) < .4 && Math.abs(p.z) < RINK.goalHalf + .1 && p.y > 1.05;
        if (nearPost || crossbar) {
            this.emit('post', 'DING!', crossbar ? 'Off the crossbar.' : 'Off the post.');
            if (this.phase === 'live' || this.phase === 'duel')
                this.notice(crossbar ? 'OFF THE BAR!' : 'OFF THE POST!', 'So close.', 1.1);
        }
        else
            this.emit('boards', '', '', undefined, Math.min(1, change / 30));
    }
    poke(player) {
        if (player.cooldown > 0)
            return;
        player.cooldown = .5;
        if (this.carrier === null)
            return;
        const victim = this.players[this.carrier];
        if (victim.team !== player.team && distance(victim, player) < 1.75 && victim.deke <= 0) {
            if (this.rng.next() < .7) {
                this.dropPuck(victim);
                this.heat[player.team] = Math.min(100, this.heat[player.team] + 5);
            }
            else if (this.settings.rules && (player.x - victim.x) * this.dir(victim.team) < -.4)
                this.penalty(player.team, player.id, 'TRIPPING');
        }
    }
    ai(p, dt) {
        const dir = this.dir(p.team), own = this.skatingPlayers(p.team), index = own.findIndex(q => q.id === p.id);
        const puck = this.puck.position, carrier = this.carrier !== null ? this.players[this.carrier] : null;
        const aiStrength = this.isHuman(p.team) ? 2 : this.settings.difficulty;
        let target = { x: puck.x, z: puck.z }, turbo = false;
        if (this.rules.offside[p.team] && this.settings.rules && this.phase !== 'duel') {
            target = { x: dir * (RINK.blue - 1.4), z: p.z };
            return { move: normal(target.x - p.x, target.z - p.z), turbo: true };
        }
        if (carrier?.id === p.id) {
            const pressure = this.skatingPlayers(other(p.team)).filter(q => distance(p, q) < 3);
            target = { x: dir * 23.5, z: Math.sin(this.time * 1.5 + p.id) * 2.6 };
            if (p.x * dir > 24)
                target = { x: dir * 21, z: Math.sign(p.z || 1) * 4.2 };
            turbo = pressure.length > 0 && p.energy > 25;
            if (p.aiTime <= 0 && p.x * dir > 11 && Math.abs(p.z) < 8 && p.x * dir < RINK.goal - 1) {
                p.aiTime = this.rng.between(.65, 1.2);
                if (this.phase === 'duel' ? p.x > 15 : (p.x * dir > 18 || this.rng.next() < .25))
                    this.shoot(p, this.rng.between(.3, .95), this.rng.next() > .5 ? .85 : -.85, this.heat[p.team] >= 100 && this.phase !== 'duel');
            }
            if (this.phase !== 'duel' && pressure.length > 1 && p.aiTime < .15 && this.rng.next() < dt * .7) {
                this.pass(p, { x: dir, z: -Math.sign(p.z) });
                p.aiTime = .8;
            }
        }
        else if (carrier?.team === p.team) {
            const lane = index === 1 ? -5 : index === 2 ? 5 : (index % 2 ? -3.8 : 3.8);
            target = { x: clamp(carrier.x + dir * (index < 3 ? 5 : -8), -23, 23), z: lane };
            if (this.settings.rules && puck.x * dir < RINK.blue + .6)
                target.x = dir * Math.min(target.x * dir, RINK.blue - 1, puck.x * dir + 1.5);
        }
        else {
            const sorted = [...own].sort((a, b) => distance(a, puck) - distance(b, puck));
            const rank = sorted.findIndex(q => q.id === p.id);
            if (rank < (carrier ? 2 : 1)) {
                target = { x: puck.x + (carrier?.vx ?? this.puck.velocity.x) * .16, z: puck.z + (carrier?.vz ?? this.puck.velocity.z) * .16 };
                turbo = rank === 0 && distance(p, puck) > 5 && p.energy > 40;
                if (carrier && carrier.team !== p.team && distance(carrier, p) < 1.75 && p.cooldown <= 0 && this.phase !== 'duel') {
                    if (this.rng.next() < dt * (aiStrength * .55))
                        this.poke(p);
                    if (this.rng.next() < dt * .35 && Math.abs(p.z) < 10 && Math.abs(carrier.x - p.x) < 1.3)
                        this.check(p);
                }
            }
            else {
                target = { x: clamp(puck.x - dir * (index >= 3 ? 7 : 4), -23, 23), z: clamp(puck.z * .45 + (index % 2 ? -4 : 4), -9, 9) };
            }
        }
        if (distance(p, target) < .6)
            return { move: { x: 0, z: 0 }, turbo: false };
        const n = normal(target.x - p.x, target.z - p.z);
        // Avoid teammates rather than piling ten skaters onto one point.
        for (const q of own)
            if (q.id !== p.id && distance(p, q) < 1.8) {
                n.x += (p.x - q.x) * .35;
                n.z += (p.z - q.z) * .35;
            }
        return { move: normal(n.x, n.z), turbo };
    }
    moveGoalie(g, dt) {
        const dir = this.dir(g.team), puck = this.puck.position;
        const defending = puck.x * dir < 0, targetX = -dir * (RINK.goal - (defending ? .9 : .4));
        const targetZ = g.aiTime > 0 ? g.z : clamp(puck.z * (defending ? .6 : .25), -1.1, 1.1);
        const oldX = g.x, oldZ = g.z;
        g.x = approach(g.x, targetX, dt * 4.5);
        g.z = approach(g.z, targetZ, dt * (5 + g.data.skill * .028));
        g.vx = (g.x - oldX) / dt;
        g.vz = (g.z - oldZ) / dt;
        g.angle = Math.atan2(puck.x - g.x, puck.z - g.z);
    }
    checkGoalieSave(previous, duel) {
        const puck = this.puck.position, v = this.puck.velocity;
        for (const team of [0, 1]) {
            const g = this.keeper(team);
            if (!g || g.cooldown > 0 || puck.y > 1.3)
                continue;
            const dir = this.dir(team);
            if (v.x * dir >= 0 || previous.x * dir < g.x * dir - .3)
                continue;
            const dx = puck.x - previous.x, dz = puck.z - previous.z, denom = dx * dx + dz * dz;
            const t = denom ? clamp(((g.x - previous.x) * dx + (g.z - previous.z) * dz) / denom, 0, 1) : 0;
            const closest = { x: previous.x + dx * t, z: previous.z + dz * t };
            const reach = this.shot?.power ? .55 : .56 + g.data.skill * .0025;
            if (distance(closest, g) > reach || Math.abs(puck.x - g.x) > 2)
                continue;
            if (!(duel && this.duelIsShootout) && this.lastTeam !== null && this.lastTeam !== team) {
                this.recordShot(other(team));
                this.stats[team].saves++;
            }
            this.heat[team] = Math.min(100, this.heat[team] + 5);
            g.cooldown = .6;
            g.deke = .5;
            this.emit('save', 'BIG SAVE', g.data.name, team);
            if (duel) {
                this.finishDuel(false);
                return true;
            }
            const speed = length(v);
            this.puck.position.x = g.x + dir * 1.0;
            this.puck.velocity = { x: dir * Math.min(15, speed * .42), z: (puck.z >= g.z ? 1 : -1) * this.rng.between(7, 12), y: .6 };
            this.noPickup = .12;
            this.rules.touch();
            this.shot = null;
            this.touch(g);
            if (this.phase !== 'attract' && (speed < 15 || this.rng.next() < .18))
                this.whistle('GLOVE SAVE', this.defensiveDot(team), `${g.data.name.toUpperCase()} HOLDS ON.`);
            return true;
        }
        return false;
    }
    separatePlayers() {
        const active = this.players.filter(p => p.active);
        for (let i = 0; i < active.length; i++)
            for (let j = i + 1; j < active.length; j++) {
                const a = active[i], b = active[j], d = distance(a, b);
                if (d < .82 && d > .001 && a.stun <= 0 && b.stun <= 0) {
                    const n = normal(a.x - b.x, a.z - b.z), overlap = (.82 - d) * .5;
                    if (!a.goalie) {
                        a.x += n.x * overlap;
                        a.z += n.z * overlap;
                    }
                    if (!b.goalie) {
                        b.x -= n.x * overlap;
                        b.z -= n.z * overlap;
                    }
                }
            }
    }
}
