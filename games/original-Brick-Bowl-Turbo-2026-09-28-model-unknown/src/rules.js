export const other = (e) => +(e === 0);
export const toGo = (e) => e.lineToGain - e.ballOn;
export const goalToGo = (e) => e.lineToGain >= 100;
export const FOULS = {
  offside: { name: `Offside`, yards: 5, deadBall: true },
  falseStart: { name: `False Start`, yards: 5, deadBall: true },
  delay: { name: `Delay of Game`, yards: 5, deadBall: true },
  holdingO: { name: `Offensive Holding`, yards: 10 },
  holdingD: { name: `Defensive Holding`, yards: 5, autoFirst: true },
  dpi: { name: `Defensive Pass Interference`, yards: 0, spotFoul: true, autoFirst: true },
  opi: { name: `Offensive Pass Interference`, yards: 10 },
  grounding: { name: `Intentional Grounding`, yards: 10, lossOfDown: true, spotFoul: true },
  illegalForward: { name: `Illegal Forward Pass`, yards: 5, lossOfDown: true, spotFoul: true },
  roughingPasser: { name: `Roughing the Passer`, yards: 15, autoFirst: true, fromEnd: true },
  faceMask: { name: `Face Mask`, yards: 15, autoFirst: true, fromEnd: true },
  lateHit: { name: `Unnecessary Roughness`, yards: 15, autoFirst: true, postPlay: true },
  illegalBlock: { name: `Illegal Block in the Back`, yards: 10, spotFoul: true },
};
export const clampYd = (e, t, n) => Math.max(t, Math.min(n, e));
export function emptyResult() {
  return {
    next: null,
    score: null,
    firstDown: false,
    turnoverOnDowns: false,
    possessionChanged: false,
    replayDown: false,
    penaltyText: [],
    acceptedFouls: [],
    declinedFouls: [],
    offsetting: false,
  };
}
export function firstDownAt(e, t) {
  let n = clampYd(t, 0.5, 99.5);
  return { offense: e, ballOn: n, down: 1, lineToGain: Math.min(100, n + 10) };
}
export function penaltyBack(e, t) {
  return t > e / 2 ? e / 2 : e - t;
}
export function penaltyForward(e, t) {
  let n = 100 - e;
  return t > n / 2 ? e + n / 2 : e + t;
}
export function resolveEnd(e, t) {
  let n = emptyResult();
  switch (t.type) {
    case `td`:
      return (
        (n.score = { team: t.team, pts: 6, type: `td` }),
        (n.possessionChanged = t.team !== e.offense),
        n
      );
    case `safety`:
      return (
        (n.score = { team: other(t.against), pts: 2, type: `safety` }),
        (n.freeKickBy = t.against),
        (n.possessionChanged = true),
        n
      );
    case `touchback`:
      return ((n.next = firstDownAt(t.team, 20)), (n.possessionChanged = t.team !== e.offense), n);
    case `incomplete`:
      return advanceDown(e, e.ballOn, n);
    case `dead`:
      return t.possession === e.offense
        ? advanceDown(e, t.spot, n)
        : ((n.next = firstDownAt(t.possession, 100 - t.spot)), (n.possessionChanged = true), n);
  }
}
export function advanceDown(e, t, n) {
  return (
    (t = clampYd(t, 0.5, 99.5)),
    t >= e.lineToGain
      ? ((n.firstDown = true), (n.next = firstDownAt(e.offense, t)), n)
      : e.down >= 4
        ? ((n.turnoverOnDowns = true),
          (n.possessionChanged = true),
          (n.next = firstDownAt(other(e.offense), 100 - t)),
          n)
        : ((n.next = { offense: e.offense, ballOn: t, down: e.down + 1, lineToGain: e.lineToGain }), n)
  );
}
export function resultValue(e, t) {
  let n = 0;
  if (e.score) {
    let r = e.score.type === `td` ? 6.95 : e.score.pts;
    n += e.score.team === t ? r : -r;
    let i = e.score.type === `safety` ? 1.2 : -0.6;
    n += e.score.team === t ? i : -i;
  }
  if (e.next) {
    let r = expectedPoints(e.next);
    n += e.next.offense === t ? r : -r;
  }
  return n;
}
export function expectedPoints(e) {
  let t = -1.4 + 0.072 * e.ballOn;
  return ((t -= [0, 0.35, 0.95, 1.9][clampYd(e.down, 1, 4) - 1]), (t -= Math.min(toGo(e), 25) * 0.045), t);
}
export function applyFoul(e, t, n) {
  let r = FOULS[t.kind],
    i = emptyResult();
  i.acceptedFouls.push(t);
  let a = t.team === e.offense,
    o = e.ballOn;
  if ((i.penaltyText.push(`${r.name} — ${a ? `Offense` : `Defense`}`), r.postPlay)) {
    let a = n ? resolveEnd(e, n) : resolveEnd(e, { type: `incomplete` });
    if ((a.acceptedFouls.push(t), a.penaltyText.push(i.penaltyText[0]), a.score || !a.next)) return a;
    let o = a.next;
    if (t.team === o.offense) {
      let e = penaltyBack(o.ballOn, r.yards);
      a.next = { ...o, ballOn: e };
      o.lineToGain >= 100 && (a.next.lineToGain = 100);
    } else {
      let e = penaltyForward(o.ballOn, r.yards);
      a.next = firstDownAt(o.offense, e);
      a.firstDown = true;
      a.turnoverOnDowns = a.turnoverOnDowns && false;
    }
    return a;
  }
  if (a) {
    let n;
    if (
      ((n =
        r.spotFoul && t.spot !== undefined
          ? t.kind === `grounding`
            ? Math.min(penaltyBack(o, r.yards), t.spot)
            : penaltyBack(Math.min(t.spot, o), r.yards)
          : penaltyBack(o, r.yards)),
      n <= 0)
    )
      return (
        (i.score = { team: other(e.offense), pts: 2, type: `safety` }),
        (i.freeKickBy = e.offense),
        (i.possessionChanged = true),
        i
      );
    if (r.lossOfDown) {
      let t = { ...e, ballOn: n };
      return e.down >= 4
        ? ((i.turnoverOnDowns = true),
          (i.possessionChanged = true),
          (i.next = firstDownAt(other(e.offense), 100 - n)),
          i)
        : ((i.next = { ...t, down: e.down + 1 }), i);
    }
    return ((i.replayDown = true), (i.next = { ...e, ballOn: n }), i);
  }
  let s;
  return (
    (s =
      t.kind === `dpi` && t.spot !== undefined
        ? t.spot >= 100
          ? 99
          : Math.max(t.spot, o + 1)
        : r.fromEnd && n && n.type === `dead` && n.possession === e.offense && n.spot > o
          ? penaltyForward(n.spot, r.yards)
          : penaltyForward(o, r.yards)),
    (s = clampYd(s, 0.5, 99.5)),
    r.autoFirst || s >= e.lineToGain
      ? ((i.firstDown = true), (i.next = firstDownAt(e.offense, s)), i)
      : ((i.replayDown = true), (i.next = { ...e, ballOn: s }), i)
  );
}
export function adjudicate(e, t, n) {
  if (n.length === 0) return resolveEnd(e, t);
  let r = n.find((e) => FOULS[e.kind].deadBall);
  if (r) return applyFoul(e, r, null);
  let i = n.filter((e) => !FOULS[e.kind].postPlay),
    a = n.filter((e) => FOULS[e.kind].postPlay),
    o = i.filter((t) => t.team === e.offense),
    s = i.filter((t) => t.team !== e.offense);
  if (o.length && s.length) {
    let t = emptyResult();
    return (
      (t.offsetting = true),
      (t.replayDown = true),
      (t.next = { ...e }),
      t.penaltyText.push(`Offsetting penalties — replay the down`),
      t.acceptedFouls.push(...i),
      t
    );
  }
  let c;
  if (i.length) {
    let n = o.length ? other(e.offense) : e.offense,
      r = resolveEnd(e, t);
    r.declinedFouls.push(...i);
    for (let e of i) r.penaltyText.push(`${FOULS[e.kind].name} — Declined`);
    c = r;
    let a = resultValue(r, n);
    for (let r of i) {
      let o = applyFoul(e, r, t),
        s = resultValue(o, n);
      s > a + 0.01 && ((c = o), (a = s), o.declinedFouls.push(...i.filter((e) => e !== r)));
    }
  } else c = resolveEnd(e, t);
  for (let e of a) {
    if (c.score || !c.next) {
      c.declinedFouls.push(e);
      continue;
    }
    let t = c.next,
      n = FOULS[e.kind];
    c.acceptedFouls.push(e);
    c.penaltyText.push(`${n.name} — ${e.team === t.offense ? `Offense` : `Defense`}`);
    e.team === t.offense
      ? (c.next = { ...t, ballOn: penaltyBack(t.ballOn, n.yards) })
      : ((c.next = firstDownAt(t.offense, penaltyForward(t.ballOn, n.yards))), (c.firstDown = true));
  }
  return c;
}
export function yardText(e) {
  let t = Math.round(e);
  return t === 50 ? `50` : t < 50 ? `OWN ${Math.max(1, t)}` : `OPP ${Math.max(1, 100 - t)}`;
}
export function downText(e) {
  let t = [`1st`, `2nd`, `3rd`, `4th`][clampYd(e.down, 1, 4) - 1];
  if (goalToGo(e)) return `${t} & GOAL`;
  let n = toGo(e);
  return n < 0.6 ? `${t} & INCHES` : `${t} & ${Math.max(1, Math.round(n))}`;
}
