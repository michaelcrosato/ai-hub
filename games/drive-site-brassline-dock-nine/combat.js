/* BRASSLINE · Original encounter model. Rendering and input are separate. */
(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const LEVELS = {
    club: { label: 'Club', wind: 1.22, damage: .75, health: .9, score: .8 },
    contender: { label: 'Contender', wind: 1, damage: 1, health: 1, score: 1 },
    champion: { label: 'Champion', wind: .84, damage: 1.2, health: 1.12, score: 1.3 }
  };
  const STRIKES = {
    left: { name: 'LEFT HOOK', cue: 'Dodge right', safe: ['right'], side: -1, damage: 16, guard: true, counter: 'body' },
    right: { name: 'RIGHT HOOK', cue: 'Dodge left', safe: ['left'], side: 1, damage: 16, guard: true, counter: 'body' },
    body: { name: 'BODY DRIVE', cue: 'Dodge either way', safe: ['left', 'right'], side: 1, damage: 20, guard: false, counter: 'head' },
    sweep: { name: 'HIGH SWEEP', cue: 'Duck under it', safe: ['duck'], side: -1, damage: 24, guard: false, counter: null },
    delay: { name: 'DELAYED CROSS', cue: 'Wait. Then dodge left', safe: ['left'], side: 1, damage: 22, guard: true, counter: 'body' }
  };
  const PATTERNS = {
    left: { name: 'LEFT HOOK', hits: [[.82, 'left']], recovery: 1.06 },
    right: { name: 'RIGHT HOOK', hits: [[.82, 'right']], recovery: 1.06 },
    body: { name: 'BODY DRIVE', hits: [[.95, 'body']], recovery: 1.12 },
    sweep: { name: 'HIGH SWEEP', hits: [[1.05, 'sweep']], recovery: 1.22 },
    double: { name: 'SWITCH TRACK', hits: [[.82, 'left'], [1.48, 'right']], recovery: 1.35 },
    delay: { name: 'LATE ARRIVAL', hits: [[1.42, 'delay']], recovery: 1.35 },
    express: { name: 'NIGHT EXPRESS', hits: [[1.0, 'left'], [1.64, 'right'], [2.48, 'sweep']], recovery: 1.7 },
    feint: { name: 'FALSE START', hits: [[1.6, 'body']], recovery: 1.25, feint: true }
  };
  const SEQUENCES = [
    ['left', 'right', 'body', 'left', 'sweep', 'right', 'body'],
    ['double', 'sweep', 'delay', 'body', 'double', 'left'],
    ['express', 'feint', 'delay', 'double', 'sweep', 'body', 'express']
  ];
  const LESSONS = [
    { title: 'Find the open body', text: 'Press J or K to land a body punch.', action: 'body' },
    { title: 'Change your target', text: 'Hold W and punch. Or press U or I for a head punch.', action: 'head' },
    { title: 'Make the hook miss', text: 'When his left glove comes forward, tap D to dodge right.', action: 'dodge' },
    { title: 'Get under the sweep', text: 'When both gloves rise, tap S to duck.', action: 'duck' },
    { title: 'Use your Break punch', text: 'Your power is full. Press Space to break his guard.', action: 'power' }
  ];

  class Bout {
    constructor(options = {}) {
      this.difficulty = LEVELS[options.difficulty] ? options.difficulty : 'contender';
      this.rules = LEVELS[this.difficulty];
      this.Attack = options.Attack || root.My3D2dge?.Attack;
      if (!this.Attack) throw new Error('BRASSLINE requires the my-3D2dge Attack system.');
      this.practice = !!options.practice;
      this.state = this.practice ? 'training' : 'intro';
      this.t = 0; this.stateTime = 0; this.remaining = 180;
      this.phase = 0; this.patternIndex = 0; this.wait = this.practice ? 1 : 1.15;
      this.player = { hp: 100, breath: 100, power: 0, downs: 0, dodge: null, dodgeTime: 0, dodgeCooldown: 0, guard: false, hurt: 0, attack: null, lastHand: 'right', combo: 0, lastPunch: -10 };
      this.opponent = { hp: this.healthFor(0), maxHp: this.healthFor(0), downs: 0, guard: 'head', guardTime: 0, attack: null, opening: 0, stagger: 0, stunned: 0, hurt: 0, hitSide: -1, hitTarget: 'head' };
      this.stats = { punches: 0, landed: 0, counters: 0, dodges: 0, perfects: 0, blocked: 0, damage: 0, bestCombo: 0, breaks: 0 };
      this.events = []; this.message = ''; this.messageTime = 0; this.result = null;
      this.lesson = 0; this.lessonPause = 0; this.rise = 0; this.count = 0;
      this.emit('state', { state: this.state });
    }
    healthFor(phase) { return Math.round([106, 120, 138][phase] * this.rules.health); }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    say(text, seconds = 1.2) { this.message = text; this.messageTime = seconds; }
    setState(state) { this.state = state; this.stateTime = 0; this.emit('state', { state }); }
    get live() { return this.state === 'fight' || this.state === 'training'; }
    get currentStrike() {
      const a = this.opponent.attack;
      if (!a) return null;
      return a.hits.find(h => !h.done) || null;
    }
    get cue() {
      if (!this.live) return null;
      const o = this.opponent, a = o.attack, hit = this.currentStrike;
      if (o.stunned > 0) return { title: 'GUARD BROKEN', text: 'Keep the punches coming', kind: 'open', progress: o.stunned / 2.2 };
      if (o.opening > 0) return { title: 'YOUR OPENING', text: 'Change hands. Strike now.', kind: 'open', progress: o.opening / (a?.recovery || 1.3) };
      if (!hit || !a) return { title: o.guard === 'head' ? 'BODY IS OPEN' : 'HEAD IS OPEN', text: 'Read his guard', kind: 'neutral', progress: 0 };
      if (a.feint && a.t < .72 * this.rules.wind) return { title: 'FALSE START', text: 'Hold. Watch his feet.', kind: 'feint', progress: .12 };
      const d = hit.time - a.t;
      return { title: a.hits.length > 1 ? a.name + ' · ' + (a.hits.indexOf(hit) + 1) + '/' + a.hits.length : hit.spec.name,
        text: hit.spec.cue, kind: d < .26 ? 'danger' : 'wind', progress: clamp(1 - d / (a.hits.indexOf(hit) ? .8 : hit.time), 0, 1),
        counter: !!hit.spec.counter && d > .09 && d < .27 };
    }
    startPattern(key) {
      const p = PATTERNS[key];
      const wind = this.practice ? 1.18 : this.rules.wind;
      this.opponent.attack = { key, name: p.name, t: 0, hits: p.hits.map(([time, kind]) => ({ time: time * wind, kind, spec: STRIKES[kind], done: false })), recovery: p.recovery, feint: !!p.feint, opened: false };
      this.opponent.opening = 0;
      this.emit('tell', { key });
    }
    punch(hand = 'left', target = 'body', power = false) {
      const p = this.player, o = this.opponent;
      if (!this.live || this.lessonPause > 0 || p.hurt > .12 || p.dodge || p.attack?.clock.busy) return false;
      if (power && p.power < 100) { this.say('Build power with clean hits and dodges.'); this.emit('denied'); return false; }
      const cost = power ? 18 : 12;
      if (p.breath < cost) { this.say('Breathe. Let your energy recover.'); this.emit('denied'); return false; }
      const clock = new this.Attack({ wind: power ? .14 : .065, active: .055, recover: power ? .31 : .165, hitAt: 0 });
      clock.start();
      p.breath -= cost; p.guard = false; p.lastPunch = this.t;
      if (power) p.power = 0;
      p.attack = { clock, hand, target, power, elapsed: 0, resolved: false };
      this.stats.punches++; this.emit('swing', { hand, target, power });
      return true;
    }
    dodge(direction) {
      const p = this.player;
      if (!this.live || this.lessonPause > 0 || p.hurt > .15 || p.dodge || p.dodgeCooldown > 0 || p.attack?.clock.busy || p.breath < 8) return false;
      if (!['left', 'right', 'duck'].includes(direction)) return false;
      p.dodge = direction; p.dodgeTime = 0; p.breath -= 8; p.guard = false;
      this.emit('dodgeStart', { direction }); return true;
    }
    update(dt, held = {}) {
      if (!(dt > 0) || dt > .1) return;
      this.t += dt; this.stateTime += dt; this.messageTime = Math.max(0, this.messageTime - dt);
      const p = this.player, o = this.opponent;
      p.hurt = Math.max(0, p.hurt - dt); o.hurt = Math.max(0, o.hurt - dt);
      if (this.state === 'intro') { if (this.stateTime > 3.0) { this.setState('fight'); this.emit('bell'); } return; }
      if (this.state === 'phaseIntro') { if (this.stateTime > 2.5) { this.setState('fight'); this.emit('bell'); } return; }
      if (this.state === 'opponentDown') {
        this.count = Math.min(10, Math.floor(this.stateTime / .63) + 1);
        if (o.downs === 3 && this.stateTime > 3) { this.finish(true, 'TKO'); return; }
        if (this.stateTime > 4.5) {
          this.phase = o.downs; this.patternIndex = 0;
          o.maxHp = this.healthFor(this.phase); o.hp = o.maxHp; o.stagger = 0; o.stunned = 0; o.hurt = 0;
          p.hp = Math.min(100, p.hp + 16); p.breath = 100;
          this.wait = .75; this.setState('phaseIntro');
        }
        return;
      }
      if (this.state === 'playerDown') {
        this.count = Math.min(10, Math.floor(this.stateTime / .7) + 1);
        if (held.rise) this.rise = Math.min(1, this.rise + dt / (p.downs === 1 ? 2.1 : 2.9));
        else this.rise = Math.max(0, this.rise - dt * .08);
        if (p.downs === 3 && this.stateTime > 2.2) { this.finish(false, 'TKO'); return; }
        if (p.downs < 3 && this.rise >= 1 && this.stateTime > 1.5) {
          p.hp = p.downs === 1 ? 70 : 58; p.breath = 100; p.hurt = 0;
          this.wait = 1.65; this.setState('fight'); this.say('Back on your feet. Make the next one miss.', 2); this.emit('rise'); return;
        }
        if (this.stateTime >= 7) this.finish(false, 'KO');
        return;
      }
      if (!this.live) return;
      if (!this.practice) { this.remaining = Math.max(0, this.remaining - dt); if (this.remaining === 0) { this.finish(false, 'TIME'); return; } }
      this.lessonPause = Math.max(0, this.lessonPause - dt);
      p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
      p.guard = !!held.guard && !p.dodge && !p.attack?.clock.busy && p.breath > 5 && p.hurt <= 0;
      p.breath = Math.min(100, p.breath + dt * (p.guard ? 7 : p.attack?.clock.busy ? 7 : 28));
      if (p.dodge) {
        p.dodgeTime += dt;
        if (p.dodgeTime > .43) { p.dodge = null; p.dodgeCooldown = .07; }
      }
      if (p.attack) {
        const a = p.attack; a.elapsed += dt; a.clock.update(dt);
        if (a.clock.active && !a.resolved) { a.resolved = true; this.resolvePunch(a); }
        if (!a.clock.busy) p.attack = null;
      }
      if (!this.live) return;
      o.opening = Math.max(0, o.opening - dt); o.stunned = Math.max(0, o.stunned - dt);
      if (o.stunned > 0) { o.opening = Math.max(o.opening, o.stunned); return; }
      if (this.practice && this.lessonPause > 0) return;
      if (o.attack) {
        const a = o.attack; a.t += dt;
        for (const h of a.hits) {
          if (!h.done && a.t >= h.time) { h.done = true; this.resolveStrike(h); if (!this.live || o.attack !== a) return; }
        }
        const last = a.hits[a.hits.length - 1].time;
        if (!a.opened && a.t >= last + .15) { a.opened = true; o.opening = a.recovery; this.emit('opening'); }
        if (a.t >= last + .15 + a.recovery) { o.attack = null; this.wait = .72; o.guard = o.guard === 'head' ? 'body' : 'head'; }
      } else {
        o.guardTime += dt;
        if (o.guardTime > 2.0) { o.guardTime = 0; o.guard = o.guard === 'head' ? 'body' : 'head'; }
        this.wait -= dt;
        if (this.practice) {
          if (this.lesson === 0) o.guard = 'head';
          else if (this.lesson === 1) o.guard = 'body';
          else if (this.lesson === 4) { p.power = 100; o.opening = 1; }
          if (this.wait <= 0 && (this.lesson === 2 || this.lesson === 3)) this.startPattern(this.lesson === 2 ? 'left' : 'sweep');
        } else if (this.wait <= 0) {
          const seq = SEQUENCES[this.phase]; this.startPattern(seq[this.patternIndex % seq.length]); this.patternIndex++;
        }
      }
      if (this.t - p.lastPunch > 2.3) p.combo = 0;
    }
    resolvePunch(a) {
      const p = this.player, o = this.opponent, h = this.currentStrike;
      const timeToHit = h ? h.time - o.attack.t : 10;
      const counter = !!h && h.spec.counter === a.target && timeToHit >= .07 && timeToHit <= .27;
      const open = o.opening > 0 || o.stunned > 0;
      const guarded = !open && !counter && (o.attack || o.guard === a.target);
      if (guarded && !a.power) { this.stats.blocked++; p.combo = 0; this.emit('blocked', { hand: a.hand, target: a.target }); this.say(o.attack ? 'Wait for the whole combination.' : 'Change your target.', .8); return; }
      let damage = a.power ? 31 : a.target === 'head' ? 9 : 7;
      if (open) damage *= 1.25;
      if (counter) damage *= 2.0;
      if (a.hand !== p.lastHand && !a.power && p.combo > 0) damage *= 1.12;
      if (guarded && a.power) damage *= .7;
      damage = Math.round(damage);
      o.hp = Math.max(0, o.hp - damage); o.hurt = a.power ? .48 : .25; o.hitSide = a.hand === 'left' ? 1 : -1; o.hitTarget = a.target;
      o.stagger = clamp(o.stagger + (a.power ? 28 : counter ? 32 : open ? 13 : 6), 0, 100);
      p.hp = Math.min(100, p.hp + .7); p.power = clamp(p.power + (a.power ? 0 : counter ? 22 : 10), 0, 100);
      p.lastHand = a.hand; p.combo++; p.lastPunch = this.t;
      this.stats.landed++; this.stats.damage += damage; this.stats.bestCombo = Math.max(this.stats.bestCombo, p.combo);
      if (a.power) this.stats.breaks++;
      if (counter) { this.stats.counters++; o.attack = null; o.opening = 1.2; this.wait = 1.5; this.say('COUNTER', .85); }
      this.emit('hit', { damage, counter, power: a.power, hand: a.hand, target: a.target, guarded: !!guarded });
      if (this.practice) { o.hp = o.maxHp; if ((this.lesson === 0 && a.target === 'body') || (this.lesson === 1 && a.target === 'head') || (this.lesson === 4 && a.power)) this.advanceLesson(); return; }
      if (o.hp <= 0) { this.knockdown('opponent'); return; }
      if (o.stagger >= 100 && !o.stunned) { o.stagger = 0; o.stunned = 2.2; o.opening = 2.2; o.attack = null; this.wait = 2.7; this.say('GUARD BROKEN', 1.3); this.emit('stagger'); }
    }
    resolveStrike(h) {
      const p = this.player;
      const validDodge = p.dodge && p.dodgeTime >= .018 && p.dodgeTime <= .35 && h.spec.safe.includes(p.dodge);
      if (validDodge) {
        const perfect = p.dodgeTime <= .14;
        this.stats.dodges++; if (perfect) this.stats.perfects++;
        p.power = Math.min(100, p.power + (perfect ? 14 : 7));
        this.say(perfect ? 'PERFECT' : 'CLEAN DODGE', .65); this.emit('evade', { perfect, direction: p.dodge });
        if (this.practice && ((this.lesson === 2 && p.dodge === 'right') || (this.lesson === 3 && p.dodge === 'duck'))) this.advanceLesson();
        return;
      }
      let damage = Math.round(h.spec.damage * this.rules.damage);
      const blocked = p.guard && h.spec.guard && p.breath >= 14;
      if (blocked) { damage = Math.max(2, Math.round(damage * .18)); p.breath = Math.max(0, p.breath - 14); }
      if (this.practice) { this.say(h.spec.cue + '. Tap just before contact.', 1.5); damage = 0; }
      p.hp = Math.max(0, p.hp - damage); p.power = Math.max(0, p.power - (blocked ? 3 : 15)); p.combo = 0;
      p.hurt = blocked ? .12 : .42; p.attack?.clock.cancel(); p.attack = null;
      this.emit('hurt', { damage, blocked, side: h.spec.side });
      if (p.hp <= 0) this.knockdown('player');
    }
    knockdown(who) {
      const p = this.player, o = this.opponent;
      p.attack?.clock.cancel(); p.attack = null; p.dodge = null; p.guard = false;
      o.attack = null; o.opening = 0; o.stunned = 0;
      if (who === 'opponent') { o.downs++; this.setState('opponentDown'); }
      else { p.downs++; this.rise = 0; this.setState('playerDown'); }
      this.emit('knockdown', { who });
    }
    advanceLesson() {
      this.lesson++; this.lessonPause = 1.0; this.opponent.attack = null; this.opponent.opening = 0;
      this.player.dodge = null; this.wait = 1.2; this.say('NICE WORK', .75); this.emit('lesson', { lesson: this.lesson });
      if (this.lesson === 4) this.player.power = 100;
      if (this.lesson >= LESSONS.length) this.setState('trained');
    }
    finish(won, method) {
      const s = this.stats, p = this.player;
      const score = Math.round((s.landed * 60 + s.counters * 190 + s.perfects * 140 + s.breaks * 200 + (won ? 2500 + this.remaining * 22 + p.hp * 12 : 0)) * this.rules.score);
      const grade = !won ? '—' : p.downs === 0 && s.perfects >= 6 && this.remaining > 70 ? 'S' : p.downs === 0 && this.remaining > 40 ? 'A' : p.downs <= 1 ? 'B' : 'C';
      this.result = { won, method, score, grade, time: +(180 - this.remaining).toFixed(2), hp: Math.round(p.hp), difficulty: this.difficulty, accuracy: s.punches ? Math.round(s.landed / s.punches * 100) : 0, ...s };
      this.setState(won ? 'win' : 'lose'); this.emit('result', { result: this.result });
    }
    snapshot() {
      return { state: this.state, remaining: +this.remaining.toFixed(2), phase: this.phase + 1, difficulty: this.difficulty, practice: this.practice,
        player: { hp: +this.player.hp.toFixed(1), breath: +this.player.breath.toFixed(1), power: this.player.power, knockdowns: this.player.downs },
        opponent: { hp: this.opponent.hp, knockdowns: this.opponent.downs, pattern: this.opponent.attack?.key || null, opening: +this.opponent.opening.toFixed(2) },
        result: this.result };
    }
  }
  root.BrasslineCombat = { Bout, LEVELS, STRIKES, PATTERNS, LESSONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BrasslineCombat;
})(typeof globalThis !== 'undefined' ? globalThis : this);
