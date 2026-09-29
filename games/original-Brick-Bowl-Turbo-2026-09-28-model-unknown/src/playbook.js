import { OFFENSE_PLAYS } from "./plays.js";

export const PB_HALF = 22;
export const PB_BACK = -12;
export function pbMapper(e, t, n) {
  return (r, i) => [6 + (((n ? -r : r) + PB_HALF) / 44) * (e - 12), t - 22 - ((i - PB_BACK) / 38) * (t - 30)];
}
export function pbField(e, t, n, r) {
  let i = e.createLinearGradient(0, 0, 0, n);
  i.addColorStop(0, `#2a8a3c`);
  i.addColorStop(1, `#1f6a2d`);
  e.fillStyle = i;
  e.fillRect(0, 0, t, n);
  e.strokeStyle = `rgba(255,255,255,.14)`;
  e.lineWidth = 1;
  for (let n = -10; n <= 25; n += 5) {
    let [, i] = r(0, n);
    e.beginPath();
    e.moveTo(0, i);
    e.lineTo(t, i);
    e.stroke();
  }
  let [, a] = r(0, 0);
  e.strokeStyle = `rgba(80,160,255,.9)`;
  e.lineWidth = 2;
  e.beginPath();
  e.moveTo(0, a);
  e.lineTo(t, a);
  e.stroke();
}
export function pbPath(e, t, n, r = 2.2, i = false, a = true) {
  if (t.length < 2) return;
  e.strokeStyle = n;
  e.fillStyle = n;
  e.lineWidth = r;
  e.lineJoin = `round`;
  e.setLineDash(i ? [4, 3] : []);
  e.beginPath();
  e.moveTo(t[0][0], t[0][1]);
  for (let n of t.slice(1)) e.lineTo(n[0], n[1]);
  if ((e.stroke(), e.setLineDash([]), !a)) return;
  let [o, s] = t[t.length - 2],
    [c, l] = t[t.length - 1],
    u = Math.atan2(l - s, c - o);
  e.beginPath();
  e.moveTo(c + Math.cos(u) * 3, l + Math.sin(u) * 3);
  e.lineTo(c - Math.cos(u - 0.5) * 7, l - Math.sin(u - 0.5) * 7);
  e.lineTo(c - Math.cos(u + 0.5) * 7, l - Math.sin(u + 0.5) * 7);
  e.closePath();
  e.fill();
}
export function pbDot(e, t, n, r, i, a = `#0d0721`) {
  e.beginPath();
  e.arc(t, n, r, 0, Math.PI * 2);
  e.fillStyle = i;
  e.fill();
  e.lineWidth = 2;
  e.strokeStyle = a;
  e.stroke();
}
export function pbX(e, t, n, r) {
  e.strokeStyle = `#0d0721`;
  e.lineWidth = 5;
  e.beginPath();
  e.moveTo(t - 5, n - 5);
  e.lineTo(t + 5, n + 5);
  e.moveTo(t + 5, n - 5);
  e.lineTo(t - 5, n + 5);
  e.stroke();
  e.strokeStyle = r;
  e.lineWidth = 2.5;
  e.stroke();
}
export const pbClampX = (e) => Math.max(-21, Math.min(21, e));
export function drawOffense(e, t, n, r) {
  let i = e.getContext(`2d`),
    a = e.width,
    o = e.height,
    s = pbMapper(a, o, n);
  pbField(i, a, o, s);
  let c = t.formation;
  for (let [e, n] of Object.entries(t.assign)) {
    let t = c[e];
    if (!t) continue;
    let [r, a] = t;
    if (n.a === `route` || n.a === `checkRelease`) {
      let e = n.route.side ?? (r >= 0 ? 1 : -1),
        t = [s(r, a)];
      for (let i of n.route.pts) t.push(s(pbClampX(r + i[0] * e), Math.min(25, a + i[1])));
      if (
        (pbPath(i, t, n.a === `checkRelease` ? `#9ff` : `#ffe14d`, 2.2, false, !n.route.settle),
        n.route.settle)
      ) {
        let [e, n] = t[t.length - 1];
        i.strokeStyle = `#ffe14d`;
        i.lineWidth = 3;
        i.beginPath();
        i.moveTo(e - 5, n);
        i.lineTo(e + 5, n);
        i.stroke();
      }
    } else if (n.a === `carry`)
      pbPath(i, [s(r, a), ...n.path.map((e) => s(pbClampX(e[0]), Math.min(25, e[1])))], `#ff3b3b`, 3.2);
    else if (n.a === `fake`) pbPath(i, [s(r, a), ...n.path.map((e) => s(e[0], e[1]))], `#ffa0a0`, 2, true);
    else if (n.a === `block` && ![`LT`, `LG`, `C`, `RG`, `RT`].includes(e)) {
      let [e, t] = s(r, a);
      i.strokeStyle = `#ffffff`;
      i.lineWidth = 2;
      i.beginPath();
      i.moveTo(e, t - 5);
      i.lineTo(e, t - 11);
      i.moveTo(e - 4, t - 11);
      i.lineTo(e + 4, t - 11);
      i.stroke();
    } else
      n.a === `qb` &&
        (n.boot
          ? pbPath(
              i,
              [s(r, a), ...(n.mesh ? [s(n.mesh[0], n.mesh[1])] : []), s(n.boot[0], n.boot[1])],
              `#c9c9ff`,
              2,
              true,
            )
          : n.drop > 0.5 && pbPath(i, [s(r, a), s(r, a - n.drop)], `#c9c9ff`, 2, true));
  }
  for (let [e, t] of Object.entries(c)) {
    let [n, a] = s(pbClampX(t[0]), t[1]);
    pbDot(i, n, a, 5, e === `C` ? `#ffffff` : r);
  }
}
export const PB_OFF_FORMATION = OFFENSE_PLAYS.find((e) => e.id === `four-verts`).formation;
export function pbDefSpot(e, t) {
  return (
    {
      DEL: [-3.9, 1.4],
      DTL: [-1.1, 1.3],
      DTR: [1.1, 1.3],
      DER: [3.9, 1.4],
      OLBL: [-4.6, 4.6],
      MLB: [0, 4.9],
      OLBR: [4.6, 4.6],
      CBL: [-19, 6.5],
      CBR: [19, 6.5],
      FS: t === `two` ? [-9, 12.5] : t === `deep` ? [0, 20] : [0, 14],
      SS: t === `two` ? [9, 12.5] : t === `deep` ? [-8, 16] : [5, 7.5],
    }[e] ?? [0, 6]
  );
}
export function drawDefense(e, t, n, r) {
  let i = e.getContext(`2d`),
    a = e.width,
    o = e.height,
    s = pbMapper(a, o, n);
  pbField(i, a, o, s);
  for (let [, e] of Object.entries(PB_OFF_FORMATION)) {
    let [t, n] = s(e[0], e[1]);
    i.globalAlpha = 0.35;
    pbDot(i, t, n, 4, `#ffffff`);
    i.globalAlpha = 1;
  }
  let c = [`WR1`, `WR2`, `WR3`, `TE`, `RB`].map((e) => PB_OFF_FORMATION[e]),
    l = new Set();
  for (let [e, n] of Object.entries(t.assign)) {
    let [o, u] = pbDefSpot(e, t.shell);
    n.a === `rush` &&
      ![`DEL`, `DTL`, `DTR`, `DER`].includes(e) &&
      ((o = n.lane ?? o), (u = e.startsWith(`CB`) ? 5 : 2.6));
    let [d, f] = s(o, u);
    if (n.a === `zone`) {
      let [e, t] = s(n.x, n.y),
        r = ((n.r ?? 7) / 44) * (a - 12);
      i.fillStyle = n.y > 14 ? `rgba(60,140,255,.35)` : `rgba(255,220,60,.3)`;
      i.strokeStyle = n.y > 14 ? `rgba(120,190,255,.9)` : `rgba(255,230,120,.9)`;
      i.lineWidth = 1.5;
      i.beginPath();
      i.ellipse(e, t, r, r * 0.55, 0, 0, Math.PI * 2);
      i.fill();
      i.stroke();
      pbPath(
        i,
        [
          [d, f],
          [e, t],
        ],
        `rgba(255,255,255,.7)`,
        1.5,
        true,
      );
    } else if (n.a === `rush` || n.a === `contain`) {
      let e = n.a === `rush` ? (n.lane ?? o) : n.side * 6;
      pbPath(i, [[d, f], s(e, -1.5), s(e * 0.3, -5)], `#ff3b3b`, 2.4);
    } else if (n.a === `man`) {
      let t = 0,
        n = 1e9;
      c.forEach((r, i) => {
        if (l.has(i)) return;
        let a = Math.abs(r[0] - o) + (e.startsWith(`CB`) ? 0 : Math.abs(r[1]) * 0.5);
        a < n && ((n = a), (t = i));
      });
      l.add(t);
      let [r, a] = s(c[t][0], c[t][1]);
      pbPath(
        i,
        [
          [d, f],
          [r, a - 6],
        ],
        `#ff9df0`,
        1.6,
        true,
        false,
      );
    } else if (n.a === `spy`) {
      let [e, t] = s(0, -5);
      pbPath(
        i,
        [
          [d, f],
          [e, t],
        ],
        `#ffffff`,
        1.4,
        true,
        false,
      );
    }
    pbX(i, d, f, r);
  }
}
export function drawKick(e, t, n) {
  let r = e.getContext(`2d`),
    i = e.width,
    a = e.height,
    o = pbMapper(i, a, false);
  pbField(r, i, a, o);
  let [s, c] = o(0, -8);
  pbDot(r, s, c, 6, n);
  let l = (e, t, n) => {
    r.strokeStyle = n;
    r.lineWidth = 3;
    r.setLineDash([5, 4]);
    r.beginPath();
    r.moveTo(s, c);
    r.quadraticCurveTo((s + e[0]) / 2, Math.min(c, e[1]) - t, e[0], e[1]);
    r.stroke();
    r.setLineDash([]);
    pbDot(r, e[0], e[1], 4, `#8b4a1f`, `#fff`);
  };
  switch (t) {
    case `deep`:
      l(o(0, 24), 40, `#ffe14d`);
      break;
    case `squib`:
      l(o(-4, 10), 6, `#ffe14d`);
      l(o(-7, 18), 4, `rgba(255,225,77,.5)`);
      break;
    case `onside`:
      l(o(8, 3), 10, `#ff5a8a`);
      break;
    case `return`:
      pbPath(r, [o(0, 22), o(-4, 10), o(3, -2), o(2, -10)], `#ff3b3b`, 3);
      for (let e of [-10, -4, 4, 10]) pbX(r, ...o(e, 4), `#fff`);
      break;
    case `hands`:
      for (let e of [-15, -9, -3, 3, 9, 15]) pbDot(r, ...o(e, 6), 5, n);
      l(o(6, 5), 10, `#ff5a8a`);
      break;
    case `xp`:
      l(o(0, 24), 30, `#ffe14d`);
      break;
    case `two`:
      pbPath(r, [o(0, -2), o(3, 12)], `#ff3b3b`, 3);
  }
}
