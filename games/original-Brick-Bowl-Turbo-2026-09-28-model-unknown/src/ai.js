import { DEFENSE_PLAYS, OFFENSE_PLAYS } from "./plays.js";
import { byPos } from "./teams.js";

export const pick = (e) => e[Math.floor(Math.random() * e.length)];
export const offById = (e) => OFFENSE_PLAYS.find((t) => t.id === e);
export const defById = (e) => DEFENSE_PLAYS.find((t) => t.id === e);
export function weighted(e) {
  let t = e.reduce((e, [, t]) => e + Math.max(0, t), 0),
    n = Math.random() * t;
  for (let [t, r] of e) if (((n -= Math.max(0, r)), n <= 0)) return t;
  return e[0][0];
}
export function lateGame(e) {
  return (e.quarter === 4 || e.quarter === 5) && e.clock < Math.min(150, e.quarterLen * 0.6);
}
export function endOfHalf(e) {
  return e.quarter === 2 && e.clock < Math.min(40, e.quarterLen * 0.25);
}
export function inFgRange(e) {
  return 100 - e.ballOn + 17 <= 40 + e.kickerPower * 0.17;
}
export function cpuOffenseCall(e) {
  let t = Math.random() < 0.5,
    n = lateGame(e),
    r = 100 - e.ballOn + 17;
  if (
    (n && e.diff > 0 && e.clock < 42 && e.down < 4) ||
    (endOfHalf(e) && e.clock < 18 && e.ballOn < 55 && e.diff >= 0)
  )
    return { play: offById(`kneel`), flip: t };
  if (
    ((e.quarter === 2 || n) && e.clock < 8 && inFgRange(e) && e.diff >= -3 && e.diff <= 0) ||
    (e.quarter === 2 && e.clock < 8 && inFgRange(e))
  )
    return { play: offById(`fg`), flip: t };
  if (
    (n || e.quarter === 2) &&
    e.clockRunning &&
    e.clock < 28 &&
    e.clock > 4 &&
    e.timeouts === 0 &&
    e.down < 4 &&
    e.diff <= 0
  )
    return { play: offById(`spike`), flip: t };
  if ((n || e.quarter === 2) && e.clock < 7 && e.ballOn > 40 && !(inFgRange(e) && e.diff >= -3))
    return { play: offById(`hail-mary`), flip: t };
  if (
    e.down === 4 &&
    !(
      (n && e.diff < 0 && !(inFgRange(e) && e.diff >= -3)) ||
      (e.toGo <= 1 && e.ballOn >= 55
        ? Math.random() < 0.45
        : e.toGo <= 2 && e.ballOn >= 45 && e.ballOn < 65 && !inFgRange(e) && Math.random() < 0.4)
    )
  )
    return inFgRange(e) && r <= 58
      ? { play: offById(`fg`), flip: t }
      : e.ballOn > 62 && Math.random() < 0.08
        ? { play: offById(`fake-fg`), flip: t }
        : Math.random() < 0.03
          ? { play: offById(`fake-punt`), flip: t }
          : { play: offById(`punt`), flip: t };
  let i = 0.5;
  if (
    (e.toGo >= 8 && (i += 0.25),
    e.toGo <= 2 && (i -= 0.3),
    n && e.diff < 0 && (i += 0.3),
    n && e.diff > 0 && (i -= 0.35),
    e.ballOn >= 97 && (i -= 0.1),
    !(Math.random() < i))
  ) {
    let n = e.toGo <= 2;
    return {
      play: offById(
        weighted([
          [`hb-dive`, n ? 3 : 1.4],
          [`power-o`, n ? 3 : 1.6],
          [`qb-sneak`, n && e.toGo <= 1 ? 3 : 0.1],
          [`hb-toss`, n ? 0.5 : 1.4],
          [`counter`, 1.2],
          [`stretch`, 1.3],
          [`hb-draw`, e.toGo > 6 ? 1.6 : 0.6],
          [`jet-sweep`, 0.9],
          [`qb-draw`, 0.7],
        ]),
      ),
      flip: t,
    };
  }
  let a = e.toGo >= 12 || (n && e.diff < 0 && e.clock < 60),
    o = e.toGo <= 4;
  return {
    play: offById(
      weighted([
        [`four-verts`, a ? 2.2 : 0.8],
        [`deep-post`, a ? 2 : 0.8],
        [`double-move`, a ? 1.4 : 0.6],
        [`mesh`, 1.4],
        [`levels`, 1.3],
        [`smash`, 1.2],
        [`flood`, 1.2],
        [`slants`, o ? 2.2 : 1],
        [`curl-flat`, o ? 1.8 : 1],
        [`screen`, e.toGo > 6 ? 0.8 : 0.3],
        [`pa-boot`, e.down <= 2 ? 1 : 0.4],
      ]),
    ),
    flip: t,
  };
}
export function cpuDefenseCall(e) {
  let t = Math.random() < 0.5,
    n = lateGame(e);
  if (e.down === 4 && !(n && e.diff < 0)) {
    if (100 - e.ballOn + 17 <= 57 && e.toGo > 1) return { play: defById(`fg-block`), flip: t };
    if (e.toGo > 2 && e.ballOn < 62)
      return { play: defById(Math.random() < 0.2 ? `punt-block` : `punt-return`), flip: t };
  }
  if (e.ballOn >= 97 || (e.toGo <= 1 && e.ballOn > 60))
    return { play: pick([defById(`goal-line`), defById(`run-stuff`), defById(`double-a`)]), flip: t };
  if (n && e.diff < 0 && e.toGo > 5 && e.clock < 50)
    return { play: pick([defById(`prevent`), defById(`dime`), defById(`cover4`)]), flip: t };
  let r = e.toGo >= 8 || (n && e.diff < 0),
    i = e.toGo <= 2;
  return {
    play: defById(
      weighted([
        [`cover2`, r ? 1.5 : 1],
        [`cover3`, 1.5],
        [`cover4`, r ? 1.3 : 0.6],
        [`man1`, 1.2],
        [`robber`, 0.9],
        [`spy`, 0.6],
        [`dime`, r ? 1.4 : 0.2],
        [`prevent`, e.toGo > 15 ? 0.8 : 0.05],
        [`goal-line`, i ? 1 : 0.1],
        [`lb-blitz`, i ? 1.2 : 0.8],
        [`safety-blitz`, 0.6],
        [`corner-blitz`, 0.5],
        [`zero-blitz`, r ? 0.5 : 0.25],
        [`zone-blitz`, 0.7],
        [`double-a`, 0.6],
        [`edge-storm`, 0.6],
        [`run-stuff`, i ? 1.6 : 0.6],
        [`contain`, 0.4],
      ]),
    ),
    flip: t,
  };
}
export function cpuGoForTwo(e, t, n, r) {
  return t < 3
    ? false
    : [-2, -5, -10, -13, -17, 1, 4, 5, 12, 15, 19].includes(e)
      ? t >= 4 || e === -2 || e === 1 || Math.random() < 0.5
      : t >= 4 && n < r * 0.2 && e === -1;
}
export function cpuKickChoice(e, t, n, r) {
  return (t >= 4 && n < Math.min(150, r * 0.55) && e < 0 && e >= -16) || Math.random() < 0.025
    ? `onside`
    : Math.random() < 0.08
      ? `squib`
      : `deep`;
}
export function cpuReturnChoice(e, t, n, r) {
  return t >= 4 && n < Math.min(150, r * 0.55) && e < 0 && e >= -16 ? `hands` : `return`;
}
export function cpuWantsTimeout(e) {
  let { isOffense: t, diff: n, quarter: r, clock: i, timeouts: a, clockRunning: o } = e;
  if (!o || a <= 0 || i < 3) return false;
  let s = Math.min(120, e.quarterLen * 0.5);
  if (r === 4 || r === 5) {
    if (i > s) return false;
    if ((t && n <= 0) || (!t && n < 0)) return true;
    if (!t && n === 0) return i < s * 0.5;
  }
  return !!(r === 2 && t && i < Math.min(40, e.quarterLen * 0.2));
}
export function depthChart(e, t) {
  let n = (t, n) => {
    let r = byPos(e, t);
    return r[Math.min(n, r.length - 1)];
  };
  switch (t) {
    case `offense`:
      return {
        QB: n(`QB`, 0),
        RB: n(`RB`, 0),
        WR1: n(`WR`, 0),
        WR2: n(`WR`, 1),
        WR3: n(`WR`, 2),
        TE: n(`TE`, 0),
        LT: n(`OL`, 0),
        LG: n(`OL`, 1),
        C: n(`OL`, 2),
        RG: n(`OL`, 3),
        RT: n(`OL`, 4),
      };
    case `defense`:
    case `fgBlock`:
      return {
        DEL: n(`DE`, 0),
        DTL: n(`DT`, 0),
        DTR: n(`DT`, 1),
        DER: n(`DE`, 1),
        OLBL: n(`LB`, 1),
        MLB: n(`LB`, 0),
        OLBR: n(`LB`, 2),
        CBL: n(`CB`, 0),
        CBR: n(`CB`, 1),
        FS: n(`S`, 1),
        SS: n(`S`, 0),
      };
    case `punt`:
      return {
        P: n(`P`, 0),
        C: n(`OL`, 2),
        LG: n(`OL`, 5),
        RG: n(`OL`, 6),
        LT: n(`OL`, 7),
        RT: n(`TE`, 1),
        WL: n(`LB`, 3),
        WR: n(`LB`, 4),
        UB: n(`RB`, 2),
        GL: n(`CB`, 2),
        GR: n(`CB`, 3),
      };
    case `puntReturn`:
      return {
        PR: n(`WR`, 4),
        R1: n(`DE`, 0),
        R2: n(`DT`, 0),
        R3: n(`DT`, 1),
        R4: n(`DE`, 1),
        L1: n(`LB`, 1),
        L2: n(`LB`, 0),
        L3: n(`LB`, 2),
        JL: n(`CB`, 0),
        JR: n(`CB`, 1),
        S: n(`S`, 1),
      };
    case `fg`:
      return {
        K: n(`K`, 0),
        H: n(`P`, 0),
        C: n(`OL`, 2),
        LG: n(`OL`, 1),
        RG: n(`OL`, 3),
        LT: n(`OL`, 0),
        RT: n(`OL`, 4),
        TEL: n(`TE`, 0),
        TER: n(`TE`, 1),
        WL: n(`OL`, 5),
        WR: n(`OL`, 6),
      };
    case `kickoff`:
      return {
        K: n(`K`, 0),
        L1: n(`LB`, 3),
        L2: n(`LB`, 4),
        L3: n(`LB`, 2),
        L4: n(`S`, 1),
        L5: n(`CB`, 2),
        R1: n(`CB`, 3),
        R2: n(`RB`, 2),
        R3: n(`WR`, 5),
        R4: n(`TE`, 1),
        R5: n(`WR`, 3),
      };
    case `kickReturn`:
      return {
        KR: n(`RB`, 1),
        KR2: n(`WR`, 4),
        F1: n(`OL`, 5),
        F2: n(`OL`, 6),
        F3: n(`TE`, 1),
        F4: n(`LB`, 3),
        F5: n(`LB`, 4),
        M1: n(`RB`, 2),
        M2: n(`S`, 1),
        M3: n(`CB`, 2),
        M4: n(`WR`, 3),
      };
  }
}
