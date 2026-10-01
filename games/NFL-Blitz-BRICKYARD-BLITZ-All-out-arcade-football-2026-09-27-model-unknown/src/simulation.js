import { clamp, dist, other, Random } from './model.js';
import { TEAMS, PLAYS, depthCharts, lineup } from './data.js';

/** Nearest actor (by field distance) that passes `test`, without building arrays. */
function nearest(actors, from, test) {
    let best = null, bestD = Infinity;
    for (const d of actors) {
        if (!test(d))
            continue;
        const dd = dist(from, d);
        if (dd < bestD) {
            bestD = dd;
            best = d;
        }
    }
    return best;
}

export class Simulation {
    rules;
    actors = [];
    ball = { x: 0, y: 2, z: -15, vx: 0, vy: 0, vz: 0, mode: 'held', target: -1, age: 0 };
    particles = [];
    /** Particle cap; main.js scales it with the quality tier (kit.detail). */
    maxParticles = 240;
    physics;
    play = PLAYS[0];
    defense = 'zone';
    controlled = 0;
    carrier = 0;
    time = 0;
    elapsed = 0;
    direction = 1;
    startTeam = 0;
    passed = false;
    completed = false;
    crossed = false;
    changed = false;
    kickPlay = false;
    kickKind = 'kickoff';
    kickLanded = false;
    fairCatch = false;
    fumbler = -1;
    fumbleSpot = 0;
    looseAge = 0;
    invulnerable = 0;
    actionCooldown = 0;
    shake = 0;
    turbo = false;
    rng = new Random();
    aiThrowAt = 2;
    handoff = false;
    pastEndzone = false;
    kickAccuracy = 0;
    kickPower = 0.8;
    events = [];
    replay = [];
    lastReplay = [];
    /** A reused view of the live state for the renderer (no per-frame copies). */
    liveView = { actors: null, ball: null, particles: null, spotZ: 0, targetZ: 0, direction: 1, focus: { x: 0, z: 0 }, phase: 'coin', time: 0, turbo: false, routes: false, selected: 0, shake: 0, camera: 'broadcast', lobby: false };
    constructor(rules, physics) {
        this.rules = rules;
        // One physics world lives for the whole session; each formation resets its bodies.
        this.physics = physics;
        this.prepare();
    }
    // Actor ids are their index in the formation (see prepare()).
    actor(id) { return this.actors[id] || this.actors[0]; }
    get userOffense() { return this.rules.s.possession === this.rules.settings.team; }
    prepare() {
        const r = this.rules, s = r.s;
        s.snapBall = s.ball;
        this.direction = r.direction;
        this.startTeam = s.possession;
        this.passed = false;
        this.completed = false;
        this.crossed = false;
        this.changed = false;
        this.elapsed = 0;
        this.handoff = false;
        this.invulnerable = 0.45;
        this.actionCooldown = 0;
        this.kickPlay = s.phase === 'kickoff';
        this.kickLanded = false;
        this.fairCatch = false;
        this.pastEndzone = false;
        this.kickKind = this.kickPlay ? 'kickoff' : this.play.kind === 'punt' ? 'punt' : 'fieldgoal';
        this.actors = [];
        this.replay = [];
        this.aiThrowAt = this.rng.range(1.3, 2.8);
        const spot = r.worldZ();
        const offense = lineup(s.possession, true), defense = lineup(other(s.possession), false);
        const pos = { QB: [0, -5], RB: [-3, -8], WR1: [-21, 0], WR2: [21, 0], WR3: [-13, -1.5], TE: [8, -1.5], LT: [-4.4, 0], LG: [-2.2, 0], C: [0, 0], RG: [2.2, 0], RT: [4.4, 0], LE: [-6, 2], DT1: [-2.5, 2], DT2: [2.5, 2], RE: [6, 2], LB1: [-8, 7], MLB: [0, 7], LB2: [8, 7], CB1: [-20, 5], CB2: [20, 5], FS: [-9, 18], SS: [9, 18] };
        for (const [i, { role, player }] of [...offense, ...defense].entries()) {
            const o = i < 11, team = o ? s.possession : other(s.possession);
            const p = pos[role];
            const x = p[0] * this.direction + s.hash, z = spot + p[1] * this.direction;
            this.actors.push({ id: i, team, role, player, x, y: 0, z, startX: x, startZ: z, vx: 0, vz: 0, facing: o ? this.direction : -this.direction, fallen: 0, action: 0, jump: 0, stamina: 100, hasBall: i === 0, eligible: ['WR1', 'WR2', 'WR3', 'TE', 'RB'].includes(role), controlled: false, route: [], routeIndex: 0 });
        }
        this.carrier = 0;
        if (this.kickPlay) {
            for (const [i, a] of this.actors.entries()) {
                if (i === 0) {
                    a.z = (s.kickFrom - 50) * this.direction;
                    a.x = 0;
                    a.role = 'K';
                    a.player = TEAMS[a.team].roster.find(p => p.id === depthCharts[a.team].K) || TEAMS[a.team].roster.find(p => p.position === 'K');
                }
                else if (i < 11) {
                    a.x = (-24 + (i - 1) * 5.333) * this.direction;
                    a.z = 10 * this.direction;
                    a.role = 'GUN';
                }
                else if (i < 20) {
                    const k = i - 11;
                    a.x = (-23 + k * 5.75) * this.direction;
                    a.z = (k < 5 ? 15 : 18) * this.direction;
                    a.role = 'BLOCK';
                }
                else {
                    a.x = (i === 20 ? -9 : 8) * this.direction;
                    a.z = (i === 20 ? 39 : 46) * this.direction;
                    a.role = 'KR';
                    a.player = TEAMS[a.team].roster.filter(p => p.position === 'RB')[i - 20];
                }
                a.startX = a.x;
                a.startZ = a.z;
            }
        }
        else if (['punt', 'fieldgoal'].includes(this.play.kind) || s.tryMode === 'pat') {
            this.actors[0].role = this.play.kind === 'punt' ? 'P' : 'K';
            this.actors[0].player = TEAMS[s.possession].roster.find(p => p.id === depthCharts[s.possession][this.actors[0].role]) || TEAMS[s.possession].roster.find(p => p.position === this.actors[0].role);
            this.actors[0].z = spot - (this.play.kind === 'punt' ? 12 : 7) * this.direction;
            if (this.play.kind === 'punt') {
                this.actors[21].z = clamp(spot + 38 * this.direction, -47, 47);
                this.actors[21].x = 0;
                this.actors[21].role = 'KR';
            }
        }
        // Roles are final for this formation, so the receiver list is built once per play.
        this.receiverList = ['WR1', 'WR2', 'WR3', 'TE', 'RB'].map(role => this.actors.find(a => a.role === role)).filter(Boolean);
        const rec = this.receiverList;
        for (let i = 0; i < rec.length; i++)
            rec[i].route = (this.play.routes[i] || []).map(p => ({ x: clamp(rec[i].startX + p.x * this.direction, -24, 24), z: clamp(rec[i].startZ + p.z * this.direction, -58, 58) }));
        this.controlled = this.userOffense ? 0 : 16;
        if (this.kickPlay && !this.userOffense)
            this.controlled = 21;
        this.markControl();
        this.attachBall();
        this.physics.reset(this.actors, this.ball);
        this.formation++;
    }
    /** Bumps whenever prepare() lines the teams up again (the renderer rebuilds route lines on change). */
    formation = 0;
    receiverList = [];
    receivers() { return this.receiverList; }
    /** The user's team holds the ball (so Switch must not take control away from the carrier). */
    get userHasBall() { return this.ball.mode === 'held' && this.actor(this.carrier).team === this.rules.settings.team; }
    /** The user's carrier may still throw a forward pass this play. */
    get userCanPass() {
        const a = this.actor(this.carrier);
        return this.rules.s.phase === 'live' && this.userHasBall && !this.passed && !this.crossed && !this.kickPlay && a.team === this.startTeam && (a.role === 'QB' || this.play.kind === 'pass');
    }
    markControl() { for (const a of this.actors)
        a.controlled = a.id === this.controlled; }
    selectPlay(play) { this.play = play; this.prepare(); }
    snap() {
        if (!this.rules.snap())
            return;
        this.elapsed = 0;
        this.events.push({ type: 'snap' });
        this.rules.say(this.userOffense ? 'MAKE IT HAPPEN' : 'SHUT IT DOWN', this.play.name);
    }
    attachBall() {
        const a = this.actor(this.carrier);
        if (!a)
            return;
        this.ball.x = a.x + 0.43;
        this.ball.z = a.z + 0.3 * a.facing;
        this.ball.y = 2.05 + Math.sin(Math.max(0, a.jump) * Math.PI) * 2.3;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.mode = 'held';
        for (const p of this.actors)
            p.hasBall = p.id === this.carrier;
    }
    takeBall(a) {
        this.carrier = a.id;
        this.ball.mode = 'held';
        a.hasBall = true;
        this.invulnerable = 0.3;
        if (a.team === this.rules.settings.team)
            this.controlled = a.id;
        else if (this.actor(this.controlled).team !== this.rules.settings.team)
            this.switchDefender();
        this.markControl();
        this.attachBall();
    }
    launchKick(power, accuracy, onside = false) {
        this.kickPower = clamp(power, 0, 1);
        this.kickAccuracy = clamp(accuracy, -1, 1);
        this.kickKind = this.rules.s.phase === 'kickoff' ? (onside ? 'onside' : 'kickoff') : this.play.kind === 'punt' ? 'punt' : 'fieldgoal';
        this.kickPlay = true;
        this.kickLanded = false;
        this.snap();
        const a = this.actor(0), s = this.rules.s;
        if (onside) {
            for (const [i, p] of this.actors.entries())
                if (i > 0 && i < 11) {
                    p.z = (s.kickFrom - 50) * this.direction;
                    p.startZ = p.z;
                }
                else if (i >= 11) {
                    p.z = (s.kickFrom - 40 + (i - 11) % 3) * this.direction;
                    p.startZ = p.z;
                }
            this.physics.reset(this.actors, this.ball);
        }
        this.ball = { x: a.x, y: 1.2, z: a.z, vx: 0, vy: 0, vz: 0, mode: 'kick', target: -1, age: 0 };
        let distance = 0, t = 0;
        if (this.kickKind === 'kickoff') {
            distance = 48 + power * 25;
            t = 2.8;
        }
        else if (this.kickKind === 'onside') {
            distance = 7 + power * 12;
            t = 0.75;
        }
        else if (this.kickKind === 'punt') {
            distance = 42 + power * 28;
            t = 3.1;
        }
        else {
            distance = 24 + power * 51;
            t = 2.1;
        }
        this.ball.vz = distance / t * this.direction;
        this.ball.vy = (0.4 - this.ball.y) / t + 11 * t;
        this.ball.vx = accuracy * (this.kickKind === 'fieldgoal' ? 7 : 20) / t;
        for (const p of this.actors)
            p.hasBall = false;
        this.rules.s.clockRunning = this.kickKind === 'punt' || this.kickKind === 'fieldgoal' ? !s.tryMode : false;
        this.events.push({ type: 'kick' });
    }
    throwPass(index) {
        const a = this.actor(this.carrier), r = this.rules;
        // After a completion the ball is no longer the passer's: a stray pass button is ignored
        // instead of drawing an illegal-forward-pass flag on the receiver.
        if (a.team !== this.startTeam || this.ball.mode !== 'held' || this.kickPlay || this.passed)
            return;
        if (this.crossed || r.yards(a.z) > r.s.snapBall + 0.5) {
            r.penalty('illegalPass', this.startTeam, r.yards(a.z));
            this.events.push({ type: 'whistle' });
            return;
        }
        const target = this.receivers()[index];
        if (!target)
            return;
        const d = dist(a, target), t = clamp(0.55 + d / 43, 0.62, 1.6);
        const error = (100 - a.player.skill) * 0.026;
        const x = target.x + target.vx * t * 0.8 + this.rng.range(-error, error), z = target.z + target.vz * t * 0.8;
        this.ball = { x: a.x, y: 2.6, z: a.z, vx: (x - a.x) / t, vy: 11 * t, vz: (z - a.z) / t, mode: 'pass', target: target.id, age: 0 };
        a.hasBall = false;
        this.passed = true;
        r.s.stats[this.startTeam].attempts++;
        this.events.push({ type: 'pass' });
    }
    throwAway() {
        const a = this.actor(this.carrier), s = this.rules.s;
        if (this.ball.mode !== 'held' || this.passed || this.kickPlay || a.team !== this.startTeam)
            return;
        const yard = this.rules.yards(a.z);
        if (yard > s.snapBall || this.crossed) {
            this.rules.penalty('illegalPass', a.team, yard);
            return;
        }
        const eligible = this.receivers().some(t => dist(t, a) < 9);
        if (Math.abs(a.x - s.hash) < 5.5 && !eligible) {
            this.rules.penalty('grounding', a.team, yard);
            this.events.push({ type: 'whistle' });
            return;
        }
        this.passed = true;
        s.stats[a.team].attempts++;
        this.end({ kind: 'incomplete', spot: s.snapBall, description: 'Thrown away legally outside the pocket.' });
    }
    lateral() {
        if (this.ball.mode !== 'held')
            return;
        const a = this.actor(this.carrier), dir = a.team === this.startTeam ? this.direction : -this.direction;
        const mate = this.actors.filter(p => p.team === a.team && p.id !== a.id && (p.z - a.z) * dir < -0.7 && dist(a, p) < 17).sort((b, c) => dist(a, b) - dist(a, c))[0];
        if (!mate)
            return;
        const t = 0.6;
        this.fumbler = a.id;
        this.fumbleSpot = this.rules.yards(a.z);
        this.looseAge = 0;
        this.ball = { x: a.x, y: 2, z: a.z, vx: (mate.x - a.x) / t, vy: 5, vz: (mate.z - a.z) / t, mode: 'loose', target: mate.id, age: 0 };
        a.hasBall = false;
        this.events.push({ type: 'pass' });
    }
    switchDefender() {
        const point = this.ball.mode === 'held' ? this.actor(this.carrier) : this.ball;
        const candidates = this.actors.filter(a => a.team === this.rules.settings.team && a.fallen <= 0 && a.id !== this.carrier).sort((a, b) => dist(a, point) - dist(b, point));
        this.controlled = (candidates.find(a => a.id !== this.controlled) || candidates[0])?.id ?? this.controlled;
        this.markControl();
    }
    runTo(a, target, speed, dt) {
        const dx = target.x - a.x, dz = target.z - a.z, d = Math.hypot(dx, dz);
        const factor = Math.min(1, d / 1.4);
        const smooth = Math.min(1, dt * 10);
        a.vx += (d > 0.1 ? dx / d * speed * factor - a.vx : -a.vx) * smooth;
        a.vz += (d > 0.1 ? dz / d * speed * factor - a.vz : -a.vz) * smooth;
    }
    ai(a, dt) {
        const r = this.rules;
        const ballCarrier = this.actor(this.carrier);
        const offense = a.team === this.startTeam;
        const dir = offense ? this.direction : -this.direction;
        const speed = 5.2 + a.player.speed * 0.043;
        if (this.ball.mode === 'loose') {
            this.runTo(a, this.ball, speed * 1.1, dt);
            return;
        }
        if (this.kickPlay) {
            this.kickAI(a, dt, speed);
            return;
        }
        if (a.id === this.carrier && this.ball.mode === 'held') {
            if (offense && a.role === 'QB' && this.play.kind === 'pass' && !this.passed) {
                this.runTo(a, { x: a.startX, z: a.startZ - this.direction }, 3, dt);
                if (this.elapsed > this.aiThrowAt) {
                    const choices = this.receivers().map((t, i) => ({ i, score: Math.min(...this.actors.filter(d => d.team !== a.team).map(d => dist(t, d))) + Math.max(0, (t.z - a.z) * dir) * 0.05 })).sort((a, b) => b.score - a.score);
                    this.throwPass(choices[0]?.i ?? 0);
                    this.aiThrowAt = 99;
                }
                return;
            }
            let lane = this.play.runLane ?? 0;
            // Counter plays sell one side first, then cut back to the real lane.
            if (this.play.fakeLane !== undefined && this.elapsed < 0.9)
                lane = this.play.fakeLane;
            if (this.changed || this.completed)
                lane = a.x;
            else
                lane = lane * this.direction + r.s.hash;
            let avoid = 0;
            for (const d of this.actors) {
                if (d.team === a.team || d.fallen > 0 || (d.z - a.z) * dir <= 0)
                    continue;
                const dd = dist(a, d);
                if (dd < 9)
                    avoid += (a.x < d.x ? -1 : 1) * (9 - dd) * 0.65;
            }
            this.runTo(a, { x: clamp(lane + avoid, -23, 23), z: a.z + dir * 14 }, speed * 1.06, dt);
            return;
        }
        if (offense && !this.changed) {
            if (a.eligible && this.play.kind === 'pass') {
                const target = a.route[Math.min(a.routeIndex, a.route.length - 1)];
                if (target) {
                    this.runTo(a, target, speed, dt);
                    if (dist(a, target) < 1.8 && a.routeIndex < a.route.length - 1)
                        a.routeIndex++;
                }
                return;
            }
            const threat = nearest(this.actors, a, d => d.team !== a.team && d.fallen <= 0);
            if (threat && dist(a, threat) < 7)
                this.runTo(a, { x: threat.x, z: threat.z - dir * 0.8 }, speed * 0.7, dt);
            else {
                // On runs the line drives toward the called lane, so each run play opens its own hole.
                const shift = this.play.kind === 'run' ? clamp(((this.play.runLane ?? 0) * this.direction + this.rules.s.hash - a.startX) * 0.25, -2.5, 2.5) * Math.min(1, this.elapsed) : 0;
                this.runTo(a, { x: a.startX + shift, z: a.startZ + dir * (this.play.kind === 'run' ? Math.min(12, this.elapsed * 3) : 0.5) }, speed * 0.8, dt);
            }
        }
        else if (a.team !== ballCarrier.team || this.ball.mode === 'pass') {
            const isDL = ['LE', 'RE', 'DT1', 'DT2'].includes(a.role);
            const chase = this.changed || this.completed || this.play.kind !== 'pass' || this.elapsed > 5 || this.defense === 'blitz' || isDL;
            if (chase) {
                const target = this.ball.mode === 'pass' ? { x: this.ball.x + this.ball.vx * 0.2, z: this.ball.z + this.ball.vz * 0.2 } : ballCarrier;
                const block = this.actors.find(b => b.team !== a.team && b.id !== this.carrier && dist(a, b) < 2.7);
                const dodge = block ? (a.x > block.x ? 1 : -1) * 2 : 0;
                const delay = this.rules.settings.difficulty === 'rookie' ? 0.8 : this.rules.settings.difficulty === 'pro' ? 0.42 : 0.2;
                if (this.elapsed > delay)
                    this.runTo(a, { x: target.x + dodge, z: target.z }, speed * (this.rules.settings.difficulty === 'allstar' ? 1.04 : 0.94), dt);
            }
            else {
                const receivers = this.receivers();
                let target;
                if (this.defense === 'man' || a.role.startsWith('CB')) {
                    const i = a.role === 'CB1' ? 0 : a.role === 'CB2' ? 1 : a.role === 'FS' ? 2 : a.role === 'SS' ? 3 : 4;
                    const t = receivers[i] || ballCarrier;
                    target = { x: t.x, z: t.z + this.direction * 1.3 };
                }
                else {
                    const deep = ['FS', 'SS'].includes(a.role);
                    target = { x: a.startX * 0.75 + ballCarrier.x * 0.25, z: a.startZ + this.direction * (deep ? Math.min(this.elapsed * 2, 12) : 1) };
                    if (this.ball.mode === 'pass')
                        target = { x: this.ball.x + this.ball.vx * 0.45, z: this.ball.z + this.ball.vz * 0.45 };
                }
                this.runTo(a, target, speed * 0.9, dt);
            }
        }
        else {
            const target = nearest(this.actors, a, d => d.team !== a.team);
            if (target)
                this.runTo(a, target, speed, dt);
        }
    }
    kickAI(a, dt, speed) {
        const kicker = a.team === this.startTeam;
        const returning = this.ball.mode === 'held';
        if (returning) {
            const carrier = this.actor(this.carrier);
            if (a.id === carrier.id) {
                let lane = a.x;
                for (const t of this.actors)
                    if (t.team !== a.team && dist(a, t) < 12)
                        lane += (a.x < t.x ? -1 : 1) * 2;
                this.runTo(a, { x: clamp(lane, -22, 22), z: a.z - this.direction * 18 }, speed * 1.2, dt);
            }
            else if (kicker)
                this.runTo(a, carrier, speed, dt);
            else {
                const target = nearest(this.actors, a, d => d.team !== a.team);
                if (target)
                    this.runTo(a, target, speed, dt);
            }
            return;
        }
        if (this.kickKind === 'fieldgoal') {
            a.vx = 0;
            a.vz = 0;
            return;
        }
        const frozen = (this.kickKind === 'kickoff' && !this.kickLanded && a.role !== 'KR');
        if (frozen) {
            a.vx = 0;
            a.vz = 0;
            return;
        }
        if (!kicker && (a.role === 'KR' || this.kickKind === 'onside')) {
            const t = Math.max(0, (this.ball.vy + Math.sqrt(Math.max(0, this.ball.vy * this.ball.vy + 44 * (this.ball.y - 0.4)))) / 22);
            this.runTo(a, { x: clamp(this.ball.x + this.ball.vx * t, -24, 24), z: clamp(this.ball.z + this.ball.vz * t, -58, 58) }, speed * 1.2, dt);
        }
        else if (this.kickKind === 'onside' || this.kickLanded || this.kickKind === 'punt')
            this.runTo(a, this.ball, speed, dt);
    }
    update(dt, input) {
        this.time += dt;
        this.shake = Math.max(0, this.shake - dt * 2);
        this.updateParticles(dt);
        if (this.rules.s.phase !== 'live') {
            for (const a of this.actors) {
                a.vx = 0;
                a.vz = 0;
                a.action = Math.max(0, a.action - dt);
                a.fallen = Math.max(0, a.fallen - dt);
            }
            return;
        }
        this.elapsed += dt;
        this.ball.age += dt;
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.actionCooldown = Math.max(0, this.actionCooldown - dt);
        const s = this.rules.s;
        // Switch hands control to the defender nearest the ball; never away from your own carrier.
        if (input.switch && !this.userHasBall)
            this.switchDefender();
        if (input.pass >= 0 && this.actor(this.carrier).team === this.rules.settings.team)
            this.throwPass(input.pass);
        if (input.throwaway) {
            if (this.kickPlay && this.ball.mode === 'kick' && this.startTeam !== this.rules.settings.team)
                this.fairCatch = true;
            else if (this.actor(this.carrier).team === this.rules.settings.team)
                this.throwAway();
        }
        if (input.lateral && this.actor(this.carrier).team === this.rules.settings.team)
            this.lateral();
        const user = this.actor(this.controlled);
        if (input.action && this.actionCooldown <= 0) {
            user.action = 0.55;
            this.actionCooldown = 0.95;
            this.events.push({ type: 'whoosh' });
        }
        if (input.jump && user.jump <= 0 && this.ball.mode === 'held') {
            user.jump = 1;
            this.events.push({ type: 'whoosh' });
        }
        if (this.play.kind === 'spike' && !this.kickPlay && this.elapsed > 0.25) {
            s.stats[this.startTeam].attempts++;
            this.end({ kind: 'spike', spot: s.snapBall });
            return;
        }
        if (this.play.kind === 'kneel' && !this.kickPlay && this.elapsed > 0.6) {
            this.end({ kind: 'kneel', spot: Math.max(0, s.snapBall - 1) });
            return;
        }
        if (this.play.kind === 'run' && !this.handoff && this.elapsed > 0.28) {
            this.handoff = true;
            if (this.play.id !== 'qb') {
                this.takeBall(this.actors[1]);
                this.invulnerable = 0.8;
            }
        }
        this.turbo = input.turbo && user.stamina > 1;
        for (const a of this.actors) {
            a.action = Math.max(0, a.action - dt);
            a.jump = Math.max(0, a.jump - dt * 1.65);
            if (a.fallen > 0) {
                a.fallen -= dt;
                a.vx *= 0.93;
                a.vz *= 0.93;
                continue;
            }
            const useHuman = a.id === this.controlled && a.team === this.rules.settings.team;
            // Returner assists while tracking a kick; manual movement overrides the assist.
            if (useHuman && (!this.kickPlay || this.ball.mode === 'held' || Math.abs(input.x) + Math.abs(input.z) > 0)) {
                // The broadcast camera always sits behind the offense. 'screen' (the default) keeps
                // up on the stick = up the screen for defenders and returners too; 'team' is the
                // original mapping, where up always means toward the end zone your side attacks.
                const attack = this.rules.settings.controls === 'team' && a.team !== this.startTeam ? -this.direction : this.direction;
                const magnitude = Math.hypot(input.x, input.z);
                const boost = this.turbo ? 1.48 : 1;
                const speed = (6 + a.player.speed * 0.051) * boost * (a.action > 0 && a.id !== this.carrier ? 1.5 : 1);
                const ix = magnitude ? input.x / magnitude : 0, iz = magnitude ? input.z / magnitude : 0;
                a.vx = -ix * speed * attack;
                a.vz = iz * speed * attack;
                if (this.turbo && magnitude > 0)
                    a.stamina = Math.max(0, a.stamina - 28 * dt);
                else
                    a.stamina = Math.min(100, a.stamina + 15 * dt);
                if (this.turbo && magnitude > 0 && this.rng.next() < 0.3)
                    this.burst(a, TEAMS[a.team].color, 1, 0.35);
            }
            else
                this.ai(a, dt);
            if (Math.hypot(a.vx, a.vz) > 0.3)
                a.facing = a.vz >= 0 ? 1 : -1;
        }
        if (this.ball.mode === 'held')
            this.attachBall();
        const previousBallY = this.ball.y;
        this.physics.step(this.actors, this.ball, dt);
        if (this.ball.mode === 'held')
            this.attachBall();
        if (this.rules.s.phase !== 'live')
            return;
        if (this.kickPlay && this.ball.mode === 'kick')
            this.updateKick(previousBallY);
        else if (this.ball.mode === 'pass')
            this.updatePass();
        else if (this.ball.mode === 'loose')
            this.updateLoose(dt);
        else
            this.updateCarrier();
        if (this.rules.s.phase === 'live' && this.elapsed > 28) {
            // Arcade anti-stall: defense finishes a stationary play rather than hanging indefinitely.
            const a = this.actor(this.carrier);
            if (this.ball.mode === 'held')
                this.tackle(a);
            else if (this.ball.mode === 'pass')
                this.end({ kind: 'incomplete', spot: s.snapBall });
            else
                this.updateLoose(8);
        }
        if (Math.floor(this.time * 30) !== Math.floor((this.time - dt) * 30)) {
            this.replay.push(this.frame(false));
            if (this.replay.length > 150)
                this.replay.shift();
        }
    }
    updatePass() {
        const b = this.ball;
        if (b.y < 3.3 && b.age > 0.3) {
            const catchers = this.actors.filter(a => a.fallen <= 0 && (a.eligible || a.team !== this.startTeam) && dist(a, b) < (a.id === b.target ? 2.45 : 1.35) && Math.abs(a.x) < 25.65);
            catchers.sort((a, c) => dist(a, b) - dist(c, b));
            const a = catchers[0];
            if (a) {
                if (a.team !== this.startTeam) {
                    this.changed = true;
                    this.rules.say('PICKED OFF!', 'Turn it around. Take it to the house.');
                    this.events.push({ type: 'turnover' });
                    this.burst(a, '#ffe17b', 20);
                }
                else {
                    this.completed = true;
                    this.rules.s.stats[a.team].completions++;
                    this.events.push({ type: 'catch' });
                }
                this.takeBall(a);
                this.pastEndzone = this.rules.yards(a.z) < 100;
                return;
            }
        }
        if (b.y <= 0.4 || Math.abs(b.x) > 27.5 || Math.abs(b.z) > 60.5 || b.age > 4)
            this.end({ kind: 'incomplete', spot: this.rules.s.snapBall });
    }
    updateKick(previousY) {
        const b = this.ball, yard = b.z * this.direction + 50;
        if (this.kickKind === 'fieldgoal') {
            if (yard >= 110) {
                const good = Math.abs(b.x) < 3.083 && b.y > 3.333;
                this.end({ kind: good ? 'fg-good' : 'fg-miss', spot: this.rules.s.snapBall });
                return;
            }
            if (b.y < 0.5 && b.age > 0.5 || Math.abs(b.x) > 27 || b.age > 5) {
                this.end({ kind: 'fg-miss', spot: this.rules.s.snapBall });
                return;
            }
        }
        else if (this.kickKind === 'kickoff') {
            if (b.y < 0.6 && b.age > 1) {
                if (!this.kickLanded && yard < 80) {
                    this.rules.illegalKickoff();
                    this.finishEffects();
                    return;
                }
                if (!this.kickLanded && yard >= 100) {
                    this.rules.kickoffTouchback(false);
                    this.finishEffects();
                    return;
                }
                this.kickLanded = true;
            }
            if (Math.abs(b.x) > 26.667 || yard > 110) {
                if (yard >= 100)
                    this.rules.kickoffTouchback(this.kickLanded);
                else
                    this.rules.illegalKickoff();
                this.finishEffects();
                return;
            }
        }
        if (this.kickKind === 'punt' && (yard >= 100 || Math.abs(b.x) > 26.667)) {
            this.end({ kind: 'punt', spot: Math.min(100, yard) });
            return;
        }
        const near = this.actors.filter(a => a.fallen <= 0 && dist(a, b) < 2.5 && b.y < 3 && b.age > 0.4).sort((a, c) => dist(a, b) - dist(c, b));
        for (const a of near) {
            if (a.team === this.startTeam) {
                if (this.kickKind === 'onside' && yard >= this.rules.s.kickFrom + 10) {
                    this.rules.newSeries(this.startTeam, yard);
                    this.rules.s.phase = 'dead';
                    this.rules.s.next = 'huddle';
                    this.rules.say('ONSIDE RECOVERED!', 'The kicking team keeps the ball.', true);
                    this.finishEffects();
                    return;
                }
                if (this.kickKind === 'punt' && yard > this.rules.s.snapBall) {
                    this.end({ kind: 'punt', spot: yard });
                    return;
                }
            }
            else {
                this.kickLanded = true;
                this.rules.s.clockRunning = true;
                if (this.fairCatch || this.kickKind === 'onside') {
                    if (this.kickKind === 'punt')
                        this.end({ kind: 'punt', spot: yard });
                    else
                        this.end({ kind: 'kick-return', spot: 100 - yard, team: a.team });
                    return;
                }
                this.takeBall(a);
                this.invulnerable = 0.55;
                this.rules.say('BRING IT BACK', 'Find a lane. Hit the turbo.');
                this.events.push({ type: 'catch' });
                return;
            }
        }
        if (this.kickKind === 'onside' && b.age > 6) {
            this.end({ kind: 'kick-return', spot: Math.max(1, 100 - yard), team: other(this.startTeam) });
            return;
        }
        if (b.age > 8) {
            this.end({ kind: this.kickKind === 'punt' ? 'punt' : 'kick-return', spot: this.kickKind === 'punt' ? yard : 100 - yard, team: other(this.startTeam) });
            return;
        }
        if (previousY > 0.6 && b.y <= 0.6)
            this.events.push({ type: 'bounce' });
    }
    updateLoose(dt) {
        const b = this.ball;
        this.looseAge += dt;
        const yard = this.rules.yards(b.z), s = this.rules.s;
        if (Math.abs(b.x) > 26.667 || Math.abs(b.z) > 60) {
            if (yard >= 100) {
                this.end({ kind: 'touchback', spot: 20, team: other(this.startTeam) });
                return;
            }
            if (yard <= 0) {
                this.end({ kind: 'safety', spot: 0 });
                return;
            }
            this.end({ kind: 'out', spot: Math.min(this.fumbleSpot, yard) });
            return;
        }
        if (b.y < 2.4 && this.looseAge > 0.22) {
            const a = this.actors.filter(a => a.fallen <= 0 && dist(a, b) < 1.8).sort((a, c) => dist(a, b) - dist(c, b))[0];
            if (a) {
                const restrictive = s.down === 4 || (s.clock <= 120 && s.quarter % 2 === 0) || !!s.tryMode;
                if (a.team === this.startTeam && a.id !== this.fumbler && restrictive && b.target === -1) {
                    this.end({ kind: 'tackle', spot: Math.min(this.fumbleSpot, yard) });
                    return;
                }
                if (a.team !== this.startTeam) {
                    this.changed = true;
                    this.rules.say('FUMBLE RECOVERED', 'New possession. Go the other way.');
                    this.events.push({ type: 'turnover' });
                }
                this.takeBall(a);
                return;
            }
        }
        if (this.looseAge > 7)
            this.end({ kind: 'tackle', spot: Math.min(this.fumbleSpot, yard) });
    }
    updateCarrier() {
        const a = this.actor(this.carrier), yard = this.rules.yards(a.z);
        const team = a.team, s = this.rules.s;
        const original = team === this.startTeam;
        if (original && yard > s.snapBall + 0.7)
            this.crossed = true;
        if (!original && yard < 99)
            this.pastEndzone = true;
        const touch = original ? yard >= 100 : yard <= 0;
        if (touch) {
            this.end({ kind: 'touchdown', spot: 100, team, passing: this.completed });
            return;
        }
        if (Math.abs(a.x) >= 26.667) {
            this.tackle(a, true);
            return;
        }
        if (Math.abs(a.z) > 60) {
            this.tackle(a, true);
            return;
        }
        if (this.invulnerable > 0)
            return;
        const d = this.actors.find(d => d.team !== team && d.fallen <= 0 && dist(d, a) < (d.action > 0 ? 2.6 : 1.68));
        if (!d)
            return;
        // Hits the player feels: rumble when the controlled player is involved.
        const felt = a.id === this.controlled || d.id === this.controlled;
        if (a.action > 0 || (a.jump > 0.2 && a.jump < 0.8 && d.action <= 0)) {
            d.fallen = 1.5;
            d.vx = (d.x - a.x) * 5;
            d.vz = (d.z - a.z) * 5;
            this.invulnerable = 0.45;
            a.action = 0;
            this.shake = 0.3;
            this.burst(a, TEAMS[team].accent, 12);
            this.events.push({ type: 'hit', user: felt, big: true });
            this.rules.say('CAN’T TOUCH THIS', 'Keep those legs moving!');
            return;
        }
        const force = d.action > 0 ? 0.1 : 0.008;
        if (!this.kickPlay && this.rng.next() < force) {
            this.fumbler = a.id;
            this.fumbleSpot = yard;
            this.looseAge = 0;
            a.hasBall = false;
            a.fallen = 1;
            this.ball.mode = 'loose';
            this.ball.target = -1;
            this.ball.vx = this.rng.range(-7, 7);
            this.ball.vy = 6;
            this.ball.vz = this.rng.range(-8, 8);
            this.ball.age = 0;
            this.events.push({ type: 'hit', user: felt, big: true });
            this.events.push({ type: 'fumble' });
            this.rules.say('BALL’S LOOSE!', 'Get on it. Anybody’s ball.');
            this.burst(a, '#ffe17b', 20);
            return;
        }
        a.fallen = 1.1;
        a.vx = (a.x - d.x) * 4;
        a.vz = (a.z - d.z) * 4;
        d.fallen = 0.5;
        this.shake = 0.7;
        this.burst(a, '#ffe17b', 18);
        this.events.push({ type: 'hit', user: felt, big: d.action > 0 });
        this.tackle(a);
    }
    tackle(a, out = false) {
        const yard = this.rules.yards(a.z), s = this.rules.s;
        if (this.kickPlay) {
            if (yard >= 100) {
                if (this.kickKind === 'punt')
                    this.end({ kind: 'touchback', spot: 20, team: a.team });
                else {
                    this.rules.kickoffTouchback(this.kickLanded);
                    this.finishEffects();
                }
            }
            else if (this.kickKind === 'punt') {
                this.end({ kind: 'turnover', spot: yard, team: a.team, description: 'PUNT RETURN' });
            }
            else
                this.end({ kind: 'kick-return', spot: 100 - yard, team: a.team });
        }
        else if (a.team !== this.startTeam) {
            if (yard >= 100 && !this.pastEndzone)
                this.end({ kind: 'touchback', spot: 20, team: a.team });
            else if (yard >= 100) {
                s.possession = a.team;
                this.end({ kind: 'safety', spot: 0 });
            }
            else
                this.end({ kind: 'turnover', spot: yard, team: a.team, description: this.passed ? 'INTERCEPTION RETURN' : 'FUMBLE RETURN' });
        }
        else
            this.end({ kind: out ? 'out' : 'tackle', spot: yard, passing: this.completed, sack: a.role === 'QB' && this.play.kind === 'pass' && !this.completed && yard < s.snapBall, hash: a.x });
    }
    end(result) { if (this.kickPlay && this.kickKind !== 'fieldgoal') {
        result.kick = true;
        result.freeKick = this.kickKind === 'kickoff' || this.kickKind === 'onside';
    } this.rules.finish(result); this.finishEffects(); }
    finishEffects() {
        this.lastReplay = this.replay.slice();
        this.events.push({ type: 'whistle' });
        if (this.rules.s.message.includes('TOUCHDOWN') || this.rules.s.message === 'IT’S GOOD!') {
            const a = this.actor(this.carrier);
            this.burst(a, TEAMS[this.rules.s.possession].color, 90, 2.8);
            this.events.push({ type: 'score' });
        }
    }
    burst(at, color, count, life = 0.8) {
        for (let i = 0; i < count; i++)
            this.particles.push({ x: at.x, y: 1.5, z: at.z, vx: this.rng.range(-7, 7), vy: this.rng.range(3, 12), vz: this.rng.range(-7, 7), life, maxLife: life, color, size: this.rng.range(0.13, 0.5) });
        if (this.particles.length > this.maxParticles)
            this.particles.splice(0, this.particles.length - this.maxParticles);
    }
    updateParticles(dt) {
        // Age and compact in place: no new array every step.
        const list = this.particles;
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            p.life -= dt;
            if (p.life <= 0)
                continue;
            p.vy -= 18 * dt;
            p.x += p.vx * dt;
            p.y = Math.max(0.1, p.y + p.vy * dt);
            p.z += p.vz * dt;
            list[n++] = p;
        }
        list.length = n;
    }
    /** The live state for the renderer, filled into one reused object (no copies). */
    view(lobby = false) {
        const v = this.liveView, s = this.rules.s;
        const c = this.ball.mode === 'pass' || this.ball.mode === 'kick' ? this.ball : this.actor(this.carrier);
        v.actors = this.actors;
        v.ball = this.ball;
        v.particles = this.particles;
        v.spotZ = (s.snapBall - 50) * this.direction;
        v.targetZ = (s.target - 50) * this.direction;
        v.direction = this.direction;
        v.focus.x = c?.x || 0;
        v.focus.z = c?.z || 0;
        v.phase = s.phase;
        v.time = this.time;
        v.turbo = this.turbo;
        v.routes = s.phase === 'huddle' || s.phase === 'try';
        v.selected = this.controlled;
        v.shake = this.shake;
        v.camera = this.rules.settings.camera;
        v.lobby = lobby;
        v.formation = this.formation;
        return v;
    }
    /** A snapshot copy for the instant replay buffer. */
    frame(lobby = false) {
        const c = this.ball.mode === 'pass' || this.ball.mode === 'kick' ? this.ball : this.actor(this.carrier);
        return { actors: this.actors.map(a => ({ ...a })), ball: { ...this.ball }, particles: this.particles.map(p => ({ ...p })),
            spotZ: (this.rules.s.snapBall - 50) * this.direction, targetZ: (this.rules.s.target - 50) * this.direction,
            direction: this.direction, focus: { x: c?.x || 0, z: c?.z || 0 }, phase: this.rules.s.phase, time: this.time, turbo: this.turbo,
            routes: this.rules.s.phase === 'huddle' || this.rules.s.phase === 'try', selected: this.controlled, shake: this.shake,
            camera: this.rules.settings.camera, lobby };
    }
}

