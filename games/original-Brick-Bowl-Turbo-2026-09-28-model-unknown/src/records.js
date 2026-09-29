/**
 * records.js — what the game remembers between visits (localStorage):
 * results against the CPU per difficulty, 2-player head-to-head, win streaks,
 * record margins and career totals for the human side, and CLUTCH CHALLENGE
 * progress. Everything is best-effort: private windows simply start fresh.
 */
const KEY = `brickbowl-records-v1`;

const blankWLT = () => ({ w: 0, l: 0, t: 0 });

function fresh() {
  return {
    vsCpu: { rookie: blankWLT(), pro: blankWLT(), legend: blankWLT() },
    versus: { played: 0, wins: [0, 0], ties: 0 },
    streak: 0,
    bestStreak: 0,
    bestWin: null, // { margin, score, team, difficulty }
    mostPoints: null, // { pts, team, difficulty }
    career: { games: 0, td: 0, passYds: 0, rushYds: 0, sacks: 0, ints: 0 },
    challenges: {}, // id -> { done, best, tries }
  };
}

let cache = null;

export function loadRecords() {
  if (cache) return cache;
  const base = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || `null`);
    if (raw && typeof raw === `object`) {
      for (const d of Object.keys(base.vsCpu)) Object.assign(base.vsCpu[d], raw.vsCpu?.[d] || {});
      if (raw.versus) {
        base.versus.played = +raw.versus.played || 0;
        base.versus.ties = +raw.versus.ties || 0;
        if (Array.isArray(raw.versus.wins))
          base.versus.wins = [+raw.versus.wins[0] || 0, +raw.versus.wins[1] || 0];
      }
      base.streak = +raw.streak || 0;
      base.bestStreak = +raw.bestStreak || 0;
      base.bestWin = raw.bestWin && typeof raw.bestWin === `object` ? raw.bestWin : null;
      base.mostPoints = raw.mostPoints && typeof raw.mostPoints === `object` ? raw.mostPoints : null;
      Object.assign(base.career, raw.career || {});
      if (raw.challenges && typeof raw.challenges === `object`) base.challenges = raw.challenges;
    }
  } catch {
    /* unreadable or blocked storage: start fresh */
  }
  cache = base;
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked */
  }
}

/**
 * Record a finished exhibition. human = the team index a person played (null in CPU vs CPU),
 * mode '1p' | '2p' | 'cpu'. Returns a short line for the results screen, or ''.
 */
export function recordMatch({ mode, human, scores, difficulty, teamNames, humanStats }) {
  const r = loadRecords();
  if (mode === `2p`) {
    r.versus.played++;
    if (scores[0] === scores[1]) r.versus.ties++;
    else r.versus.wins[scores[0] > scores[1] ? 0 : 1]++;
    save();
    return `HEAD TO HEAD · ${teamNames[0]} ${r.versus.wins[0]} – ${r.versus.wins[1]} ${teamNames[1]}${r.versus.ties ? ` · ${r.versus.ties} TIED` : ``}`;
  }
  if (mode !== `1p` || human === null) return ``;
  const me = scores[human];
  const them = scores[1 - human];
  const rec = (r.vsCpu[difficulty] ||= blankWLT());
  let note = ``;
  if (me > them) {
    rec.w++;
    r.streak++;
    r.bestStreak = Math.max(r.bestStreak, r.streak);
    const margin = me - them;
    if (!r.bestWin || margin > r.bestWin.margin) {
      r.bestWin = { margin, score: `${me}–${them}`, team: teamNames[human], difficulty };
      note = `NEW RECORD WIN MARGIN (+${margin})`;
    }
  } else if (me < them) {
    rec.l++;
    r.streak = 0;
  } else {
    rec.t++;
    r.streak = 0;
  }
  if (!r.mostPoints || me > r.mostPoints.pts) {
    r.mostPoints = { pts: me, team: teamNames[human], difficulty };
    if (me > 0 && !note) note = `NEW RECORD · ${me} POINTS`;
  }
  const c = r.career;
  c.games++;
  if (humanStats) {
    c.td += humanStats.td || 0;
    c.passYds += humanStats.passYds || 0;
    c.rushYds += humanStats.rushYds || 0;
    c.sacks += humanStats.sacks || 0;
    c.ints += humanStats.ints || 0;
  }
  save();
  const line = `VS CPU (${difficulty.toUpperCase()}) ${rec.w}-${rec.l}-${rec.t}${r.streak > 1 ? ` · ${r.streak} WIN STREAK` : ``}`;
  return note ? `${line} · ${note}` : line;
}

/** Record a challenge attempt. Returns { first, best } for the results screen. */
export function recordChallenge(id, won, margin) {
  const r = loadRecords();
  const c = (r.challenges[id] ||= { done: false, best: null, tries: 0 });
  c.tries++;
  const first = won && !c.done;
  let best = false;
  if (won) {
    c.done = true;
    if (c.best === null || margin > c.best) {
      best = c.best !== null;
      c.best = margin;
    }
  }
  save();
  return { first, best, tries: c.tries };
}

export function challengeStatus(id) {
  return loadRecords().challenges[id] || null;
}
