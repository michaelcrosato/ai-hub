// node tests/smoke.mjs — deterministic bot bouts and progression checks on sim.js (no browser).
import {
  createFight,
  OPPONENTS,
  DIFFICULTY,
  sanitizeMeta,
  applyResult,
  buyOrEquip,
  isUnlocked,
  scoreCards,
} from '../sim.js';

let seed = 123456789;
const rnd = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
};
const freshMeta = () => sanitizeMeta({});

function runBot(profile, opponent, difficulty = DIFFICULTY.pro, meta = freshMeta()) {
  let ended = 0;
  const fight = createFight({ opponent, difficulty, meta, rng: rnd, onEvent: (t) => t === 'end' && ended++ });
  const s = fight.state;
  fight.begin();
  let lastMode = '';
  let plan = null;
  let recoverHandled = false;
  let steps = 0;
  const dt = 0.05;
  while (s.mode !== 'result' && steps++ < 20000) {
    const f = s.foe;
    if (s.mode === 'playerDown') {
      fight.getUpTap();
      fight.update(dt);
      continue;
    }
    if (s.mode === 'corner') {
      assert(fight.takeCorner('power'), 'corner boost must be taken');
      continue;
    }
    if (s.mode !== 'fight') {
      fight.update(dt);
      continue;
    }
    if (f.mode !== lastMode) {
      recoverHandled = false;
      if (f.mode === 'tell') {
        const q = rnd();
        plan = q < profile.counter ? 'counter' : q < profile.counter + profile.dodge ? 'dodge' : q < profile.counter + profile.dodge + profile.guard ? 'guard' : 'eat';
      } else plan = null;
      lastMode = f.mode;
    }
    let guard = false;
    if (f.mode === 'tell') {
      const a = f.attack;
      // The bot guesses the window from the tell like a player would (so feints fool it).
      const guess = Math.max(0.2, a.tell * (a.counterFrac ?? 0.48));
      if (plan === 'counter' && f.t < guess && s.actionCd <= 0) {
        fight.punch(rnd() < 0.5 ? -1 : 1, false);
        plan = 'done';
      }
      if (plan === 'dodge' && f.t < 0.22) {
        // A reader ducks what can't be slipped.
        if (a.kind === 'haymaker' ? fight.duck() : fight.slip(rnd() < 0.5 ? -1 : 1)) plan = 'done';
      }
      guard = plan === 'guard';
    }
    fight.setGuard(guard);
    if (f.mode === 'recover' && !recoverHandled && s.actionCd <= 0 && rnd() < profile.punish) {
      fight.punch(rnd() < 0.5 ? -1 : 1, rnd() < 0.18);
      recoverHandled = true;
    }
    if (s.rush >= 100 && s.actionCd <= 0 && rnd() < profile.rush) fight.rush();
    fight.update(dt);
    for (const k of ['playerHp', 'foeHp', 'stamina', 'rush', 'time']) assert(Number.isFinite(s[k]), `${k} must stay finite`);
  }
  assert(s.mode === 'result', `bout must end (stuck in ${s.mode}/${s.foe.mode})`);
  assert(ended === 1, 'exactly one end event');
  return s.result;
}

const profiles = {
  spam: { counter: 0.01, dodge: 0.02, guard: 0.05, punish: 0.08, rush: 0.5 },
  novice: { counter: 0.12, dodge: 0.28, guard: 0.25, punish: 0.48, rush: 0.68 },
  competent: { counter: 0.24, dodge: 0.43, guard: 0.22, punish: 0.7, rush: 0.82 },
};

const N = 120;
const table = {};
for (const op of OPPONENTS) {
  for (const [name, p] of Object.entries(profiles)) {
    let wins = 0, rounds = 0, pk = 0, fk = 0, counters = 0, dodges = 0, decisions = 0;
    for (let i = 0; i < N; i++) {
      seed = (123456789 + i * 9973) >>> 0;
      const r = runBot(p, op);
      wins += r.win ? 1 : 0;
      rounds += r.round;
      pk += r.playerKD;
      fk += r.foeKD;
      counters += r.counters;
      dodges += r.dodges;
      if (r.cards) decisions++;
    }
    const row = { winRate: +(wins / N).toFixed(3), avgRound: +(rounds / N).toFixed(2), playerKD: +(pk / N).toFixed(2), foeKD: +(fk / N).toFixed(2), counters: +(counters / N).toFixed(2), dodges: +(dodges / N).toFixed(2), decisions };
    table[`${op.id}/${name}`] = row;
    console.log(`${op.id.padEnd(5)} ${name.padEnd(10)} ${JSON.stringify(row)}`);
  }
}
// Difficulty: sparring is gentler, brutal is harder, for a novice.
for (const op of OPPONENTS) {
  const rates = {};
  for (const d of Object.values(DIFFICULTY)) {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      seed = (987654321 + i * 7919) >>> 0;
      wins += runBot(profiles.novice, op, d).win ? 1 : 0;
    }
    rates[d.id] = +(wins / N).toFixed(3);
  }
  console.log(`${op.id.padEnd(5)} novice by difficulty ${JSON.stringify(rates)}`);
  assert(rates.sparring >= rates.pro && rates.pro >= rates.brutal, `difficulty must order ${op.id}`);
}
// Balance guard rails: mashing never wins, a good reader always beats the first bout,
// and every opponent stays beatable by a competent reader without progression.
assert(table['gus/spam'].winRate === 0, 'button-mashing must not beat Gus');
assert(table['gus/competent'].winRate >= 0.95, 'a competent reader beats Gus');
for (const op of OPPONENTS) {
  assert(table[`${op.id}/spam`].winRate <= 0.02, `mashing must not beat ${op.id}`);
  assert(table[`${op.id}/competent`].winRate >= 0.6, `${op.id} must be beatable by a competent reader`);
}

// ---- verbs and progression
seed = 42;
{
  const meta = freshMeta();
  const fight = createFight({ opponent: OPPONENTS[0], meta, rng: rnd });
  fight.begin();
  fight.setGuard(true);
  assert(fight.state.guard, 'guard goes up when held');
  fight.punch(-1, false);
  assert(fight.state.guard === false, 'punch must release guard');
  fight.setGuard(true);
  assert(fight.state.guard === false, 'a dropped guard needs a fresh press');
  fight.setGuard(false);
  fight.setGuard(true);
  assert(fight.state.guard === true, 'a fresh press raises it again');
}
{
  // Pausing = not calling update: the rush hit waits on the fight clock, not wall time.
  const meta = freshMeta();
  const fight = createFight({ opponent: OPPONENTS[0], meta, rng: rnd });
  fight.begin();
  fight.state.rush = 100;
  const hp = fight.state.foeHp;
  assert(fight.rush(), 'rush fires when full');
  fight.update(0.1);
  assert(fight.state.foeHp === hp, 'rush has not landed yet');
  fight.update(0.2);
  assert(fight.state.foeHp < hp, 'rush lands on the fight clock');
}
{
  const meta = sanitizeMeta({ xp: 0, credits: 200, gear: { gloves: 'balanced', boots: 'quick', guard: 'classic' }, owned: ['balanced', 'quick', 'classic'] });
  assert(buyOrEquip(meta, 'hammers') === 'bought', 'gear purchase');
  assert(meta.gear.gloves === 'hammers', 'gear purchase must equip item');
  assert(meta.credits === 80, 'gear purchase must charge credits');
  assert(buyOrEquip(meta, 'wraps') === 'locked', 'circuit gear waits for its opponent');
  meta.beaten.push('gus');
  meta.credits = 500;
  assert(buyOrEquip(meta, 'wraps') === 'bought', 'circuit gear unlocks');
}
{
  // Old saves and damaged saves.
  const old = sanitizeMeta({ xp: 400, level: 3, credits: 50, wins: 2, gear: { gloves: 'nope', boots: 'anchors' }, owned: ['balanced', 'quick', 'classic', 'anchors'] });
  assert(old.level === 3 && old.gear.gloves === 'balanced' && old.gear.boots === 'anchors', 'old saves keep valid gear');
  assert(old.beaten.includes('gus') && isUnlocked(old, 'vera') && !isUnlocked(old, 'duke'), 'a pre-circuit win opens bout 02');
  const junk = sanitizeMeta({ xp: 'lots', credits: -5, gear: 7, owned: 'x', best: { gus: { score: 'NaN' } }, opponent: 'duke', difficulty: 'impossible' });
  assert(junk.xp === 0 && junk.credits === 0 && junk.opponent === 'gus' && junk.difficulty === 'pro', 'junk saves fall back to defaults');
}
{
  const meta = freshMeta();
  const res = applyResult(meta, { win: true, ko: true, opponent: 'gus', difficulty: 'pro', landed: 20, thrown: 30, counters: 5, dodges: 9, score: 9000, foeKD: 3, playerKD: 0, time: 48.2, round: 1 });
  assert(res.unlocked?.id === 'vera' && meta.beaten.includes('gus'), 'beating Gus opens Vera');
  assert(res.newScore && res.newKO && meta.best.gus.ko === 48.2, 'bests are recorded');
  assert(meta.xp === 55 + 45 + 15 && meta.credits === 85 + 20, 'Gus pays the original rewards');
}
{
  const cards = scoreCards([
    { dealt: 40, taken: 20, pKD: 0, fKD: 1 },
    { dealt: 10, taken: 30, pKD: 0, fKD: 0 },
    { dealt: 20, taken: 21, pKD: 0, fKD: 0 },
  ]);
  assert(cards.player === 29 && cards.foe === 28, `10-point must scoring (${cards.player}-${cards.foe})`);
}
console.log('assertions ok');
