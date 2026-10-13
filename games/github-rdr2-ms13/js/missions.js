// RED HARROW — data-driven mission runner (pure logic, engine-agnostic).
// The scene feeds events via notify(); the runner tracks objective progress.
export class MissionRunner {
  constructor(mission) {
    this.m = mission;
    this.i = 0;
    this.count = 0;      // kill/collect progress on current objective
    this.timer = 0;      // defend/wait progress
    this.failed = null;
    this.finished = false;
    this.choices = [];
    this.checkpoint = 0;
  }
  current() { return this.m.o[this.i]; }
  get objectiveIndex() { return this.i; }
  // Human-readable tracker line.
  describe(charName = (id) => id) {
    if (this.finished) return 'Done';
    const c = this.current();
    if (!c) return '';
    const [verb, a, b] = c;
    const place = (p) => String(p).toLowerCase().replace(/_/g, ' ');
    switch (verb) {
      case 'goto': return `Ride to ${place(a)}`;
      case 'talk': return `Talk to ${charName(a)}`;
      case 'kill': return `Defeat ${place(a)} (${this.count}/${b})`;
      case 'collect': return `Collect ${place(a)} (${this.count}/${b})`;
      case 'defend': return `Hold ${place(a)} (${Math.ceil(b - this.timer)}s)`;
      case 'escort': return `Escort ${charName(a)} to ${place(b)}`;
      case 'wait': return `Wait (${Math.ceil(a - this.timer)}s)`;
      case 'choice': return a;
      case 'mount': return 'Mount your horse';
      case 'pay': return `Pay $${a}`;
      case 'play': return a === 'POKER' ? 'Play a hand of poker' : a === 'FISH' ? 'Catch fish' : 'Hunt game';
      default: return verb;
    }
  }
  advance() {
    this.i += 1; this.count = 0; this.timer = 0;
    this.checkpoint = this.i;
    if (this.i >= this.m.o.length) { this.finished = true; return 'done'; }
    return 'advanced';
  }
  fail(reason) { this.failed = reason; }
  retry() { this.i = this.checkpoint; this.count = 0; this.timer = 0; this.failed = null; }
  // Events: {t:'reach'|'talk'|'kill'|'collect'|'tick'|'choice'|'mount'|'pay'|'play', ...}
  notify(e) {
    if (this.finished || this.failed) return null;
    const c = this.current();
    if (!c) return null;
    const [verb, a, b] = c;
    switch (verb) {
      case 'goto': if (e.t === 'reach' && e.place === a) return this.advance(); break;
      case 'talk': if (e.t === 'talk' && e.id === a) return this.advance(); break;
      case 'kill':
        if (e.t === 'kill' && e.tag === a) { this.count += 1; if (this.count >= b) return this.advance(); return 'progress'; }
        break;
      case 'collect':
        if (e.t === 'collect' && e.item === a) { this.count += 1; if (this.count >= b) return this.advance(); return 'progress'; }
        break;
      case 'defend':
        if (e.t === 'tick' && e.near) { this.timer += e.dt; if (this.timer >= b) return this.advance(); return 'progress'; }
        break;
      case 'escort': if (e.t === 'escort' && e.id === a && e.place === b) return this.advance(); break;
      case 'wait': if (e.t === 'tick') { this.timer += e.dt; if (this.timer >= a) return this.advance(); return 'progress'; } break;
      case 'choice': if (e.t === 'choice') { this.choices.push(e.idx); return this.advance(); } break;
      case 'mount': if (e.t === 'mount') return this.advance(); break;
      case 'pay': if (e.t === 'pay' && e.amount >= a) return this.advance(); break;
      case 'play': if (e.t === 'play' && e.game === a) return this.advance(); break;
      default: break;
    }
    return null;
  }
}

// Stranger arcs become playable side missions: each part gets an objective
// triplet (travel -> action -> turn-in) derived deterministically from the arc id.
export function strangerMission(arc, part, characters) {
  const o = [];
  const place = arc.place.toUpperCase().replace(/[^A-Z]+/g, '_') || 'WOODS';
  o.push(['goto', place]);
  if (part % 3 === 0) o.push(['kill', 'THUG', 2 + (part % 3)]);
  else if (part % 3 === 1) o.push(['collect', 'SUPPLIES', 2]);
  else o.push(['talk', arcGiver(arc, characters)]);
  o.push(['wait', 3]);
  return {
    id: `${arc.id}p${part}`, ch: 0, no: part, t: `${arc.t} — part ${part} of ${arc.parts}`,
    g: arcGiver(arc, characters), b: arc.b, src: 'stranger', o,
    f: [['die']], r: { cash: 20 + part * 10, honor: 1 },
  };
}

function arcGiver(arc, characters) {
  const all = [...characters.gang, ...characters.foes, ...characters.supporting];
  let h = 0;
  for (const ch of arc.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return all[h % all.length].id;
}

// Fail-condition helpers (evaluated by the scene each tick).
export function checkFail(failSpecs, s) {
  // s: {dead, stars, seen, elapsed, stray}
  for (const [kind, val] of failSpecs) {
    if (kind === 'die' && s.dead) return 'You died';
    if (kind === 'wanted' && s.stars >= (val || 3)) return 'The law closed in';
    if (kind === 'seen' && s.seen) return 'Spotted';
    if (kind === 'timer' && s.elapsed >= val) return 'Out of time';
    if (kind === 'stray' && s.stray >= (val || 60)) return 'Abandoned the mission';
  }
  return null;
}
