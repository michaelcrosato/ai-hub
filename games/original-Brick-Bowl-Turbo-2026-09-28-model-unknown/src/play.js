import * as THREE from "three/webgpu";
import { depthChart } from "./ai.js";
import { DIFFICULTY, FIELD, PLAYER } from "./config.js";
import { fgBlockPlay } from "./plays.js";
import { other } from "./rules.js";

export const _v2 = new THREE.Vector2();
export const _v3 = new THREE.Vector3();
const _home = new THREE.Vector3(); // pass-block anchor when there is no passer or kicker
export const HALF_W = FIELD.HALF_W;
export const clamp = (e, t, n) => Math.max(t, Math.min(n, e));
export const rand = (e, t) => e + Math.random() * (t - e);
export const PlaySession = class {
  env;
  setup;
  phase = `presnap`;
  t = 0;
  liveT = 0;
  deadT = 0;
  off = [];
  def = [];
  all = []; // off + def, built once per play instead of spread in every step
  slotsO = new Map();
  slotsD = new Map();
  possession;
  passer = null;
  passThrown = false;
  forwardPassMade = false;
  handoffDone = false;
  runCommitT = -1;
  turnover = false;
  fouls = [];
  eligible = [];
  targeted = null;
  controlled = [null, null];
  meter = null;
  playClock = 20;
  report = null;
  resolveFn;
  done;
  stats = [];
  highlights = [];
  gainedInEZ = false;
  leftEZ = false;
  kickTouchedByR = false;
  kickTouchedByK = false;
  kickGrounded = false;
  kickSpot = new THREE.Vector3();
  kicker = null;
  returner = null;
  fairCatchSignal = false;
  completion = null;
  rusher = null;
  sack = false;
  hardHit = false;
  bigPlay = false;
  scorer = null;
  fumbleT = -1;
  lastPossessor;
  dpiContact = 0;
  dpiCalled = false;
  holdingRoll = false;
  passerSpotAtThrow = 0;
  catchAttempts = new Set();
  hardCounts = 0;
  snapT = -1;
  qbHoldT = 0;
  humanPressT = [0, 0];
  actionHeldT = [0, 0];
  pendingThrow = [null, null];
  endZoneKneel = false;
  deadReason = ``;
  puntBlocked = false;
  illegalBlockRolled = false;
  cpuSnapAt;
  minPresnap = 1;
  tackleSpot = new THREE.Vector3();
  fgResultDone = false;
  defMode = `normal`;
  unitO = `offense`;
  unitD = `defense`;
  timeoutRequest = null;
  lateHitWindow = 0;
  constructor(e, t) {
    this.env = e;
    this.setup = t;
    this.possession = t.offense;
    this.lastPossessor = t.offense;
    this.done = new Promise((e) => (this.resolveFn = e));
    this.cpuSnapAt = rand(1.4, 2.6);
    this.playClock = 20;
    this.build();
    this.all = [...this.off, ...this.def];
    // Difficulty speed (rookie CPUs a step slower, legend CPUs a step faster); human teams play at 1.
    for (const p of this.all) p.speedScale = this.mods(p).cpuSpeed ?? 1;
  }
  get dir() {
    return this.setup.dir;
  }
  get O() {
    return this.setup.offense;
  }
  get D() {
    return other(this.setup.offense);
  }
  attackDir(e) {
    return e === this.setup.offense ? this.setup.dir : -this.setup.dir;
  }
  W(e, t) {
    return { x: this.setup.spotX - e * this.dir, z: this.setup.spotZ + t * this.dir };
  }
  latOf(e) {
    return (this.setup.spotX - e) * this.dir;
  }
  depthOf(e) {
    return (e - this.setup.spotZ) * this.dir;
  }
  yardOf(t, n) {
    return n * this.attackDir(t) + FIELD.GOAL;
  }
  teamPlayers(e) {
    return e === this.O ? this.off : this.def;
  }
  get carrier() {
    return this.env.ball.holder;
  }
  mods(e) {
    return e.human || this.env.controllers[e.team] !== null
      ? DIFFICULTY.pro
      : DIFFICULTY[this.env.settings.difficulty];
  }
  isHumanTeam(e) {
    return this.env.controllers[e] !== null;
  }
  stat(e, t, n = 1) {
    this.stats.push({ team: e.team, player: e.info, key: t, n });
  }
  get isKickoff() {
    return this.setup.kind === `kickoff`;
  }
  get offPlay() {
    return this.setup.offCall?.play ?? null;
  }
  build() {
    let t = this.setup,
      n = this.env.ball;
    for (let e of [0, 1]) for (let t of this.env.squads[e]) t.setActive(false);
    if (t.kind === `kickoff`) {
      this.unitO = `kickoff`;
      this.unitD = `kickReturn`;
      this.buildKickoff();
      return;
    }
    let r = t.offCall.play;
    this.unitO = r.unit === `punt` ? `punt` : r.unit === `fg` ? `fg` : `offense`;
    let i = t.defCall.play;
    r.unit === `punt`
      ? ((this.defMode = i.vs === `punt-block` || i.page === 1 ? `puntBlock` : `puntReturn`),
        (this.unitD = `puntReturn`))
      : r.unit === `fg`
        ? ((this.defMode = `fgBlock`), (this.unitD = `fgBlock`))
        : (this.unitD = `defense`);
    let a = depthChart(this.env.teams[this.O], this.unitO),
      o = t.offCall.flip ? -1 : 1,
      s = 0;
    for (let [t, n] of Object.entries(a)) {
      let i = this.env.squads[this.O][s++];
      i.bind(n);
      i.slot = t;
      i.setActive(true);
      let a = r.formation[t] ?? [0, -3],
        c = a[0] * o,
        l = a[1],
        u = this.W(c, l);
      Math.abs(u.z) > FIELD.END - 1 && (u.z = Math.sign(u.z) * (FIELD.END - 1));
      Math.abs(u.x) > HALF_W - 1.5 && ((u.x = Math.sign(u.x) * (HALF_W - 1.5)), (c = this.latOf(u.x)));
      i.place(u.x, u.z, this.dir > 0 ? 0 : Math.PI);
      this.slotsO.set(t, i);
      this.off.push(i);
    }
    let c = depthChart(this.env.teams[this.D], this.unitD);
    s = 0;
    for (let [e, t] of Object.entries(c)) {
      let n = this.env.squads[this.D][s++];
      n.bind(t);
      n.slot = e;
      n.setActive(true);
      this.slotsD.set(e, n);
      this.def.push(n);
    }
    this.assignOffense(r, o);
    this.unitD === `puntReturn`
      ? this.alignPuntReturn()
      : this.alignDefense(this.defMode === `fgBlock` ? fgBlockPlay() : i, t.defCall.flip ? -1 : 1);
    n.placeAt(t.spotX, 0.18, t.spotZ);
    this.env.ball.mesh.rotation.set(0, this.dir > 0 ? 0 : Math.PI, 0);
    this.pickDefaultControl();
    this.presnapTargets();
    (r.kind === `punt` || r.kind === `fg`) &&
      this.isHumanTeam(this.O) &&
      (this.meter = { team: this.O, stage: 0, aim: 0, power: 0, acc: 0, osc: 0, t: 0 });
  }
  assignOffense(e, t) {
    let n = e.passer;
    this.passer = this.slotsO.get(n) ?? null;
    let r =
      e.unit === `offense`
        ? [`WR1`, `WR2`, `WR3`, `TE`, `RB`]
        : Object.keys(e.assign).filter((t) => e.assign[t].a === `route` || e.assign[t].a === `checkRelease`);
    for (let n of this.off) {
      let r = e.assign[n.slot],
        i = this.latOf(n.pos.x),
        a = this.depthOf(n.pos.z);
      if (!r) {
        n.role = { k: `passBlock`, lat: i };
        continue;
      }
      switch (r.a) {
        case `qb`:
          if (n.slot === `K` && e.kind === `fg`) {
            n.role = { k: `kicker`, spot: new THREE.Vector3() };
            this.kicker = n;
          } else if (e.kind === `fg` && n.slot === `H`) n.role = { k: `holder` };
          else if (e.kind === `punt`) {
            n.role = { k: `punter` };
            this.kicker = n;
          } else {
            let e = r.mesh ? this.W(r.mesh[0] * t, r.mesh[1]) : undefined,
              o = r.boot ? this.W(r.boot[0] * t, r.boot[1]) : undefined,
              s = o ?? this.W(i, a - r.drop);
            n.role = { k: `passer`, drop: r.drop, mesh: e, boot: o, phase: `snap`, readT: 0, dropSpot: s };
          }
          break;
        case `block`:
          n.role =
            e.kind === `run`
              ? { k: `runBlock`, lat: i, runLat: this.runLat(e, t) }
              : { k: `passBlock`, lat: i };
          break;
        case `route`:
        case `checkRelease`: {
          let e = r.route.side ? r.route.side * t : i >= 0 ? 1 : -1;
          n.role = {
            k: `route`,
            pts: r.route.pts.map((t) => {
              let n = i + t[0] * e,
                r = this.W(n, a + t[1]);
              return ((r.x = clamp(r.x, -HALF_W + 1, HALF_W - 1)), t[2] && (r.pause = t[2]), r);
            }),
            idx: 0,
            pauseT: 0,
            settle: !!r.route.settle,
            release: r.a === `checkRelease` ? 1.1 : 0,
            done: false,
          };
          break;
        }
        case `carry`:
          n.role = {
            k: `runner`,
            pts: r.path.map((e) => {
              let n = this.W(e[0] * t, e[1]);
              return (e[2] && (n.pause = e[2]), n);
            }),
            idx: 0,
            pauseT: 0,
          };
          n === this.passer && (this.passer = n);
          break;
        case `fake`:
          n.role = { k: `fake`, pts: r.path.map((e) => this.W(e[0] * t, e[1])), idx: 0, pauseT: 0 };
      }
    }
    if (e.kind === `punt`)
      for (let e of this.off)
        (e.slot === `GL` || e.slot === `GR`) && (e.role = { k: `cover`, laneX: e.pos.x * 0.5, delay: 0 });
    this.eligible = r.map((e) => this.slotsO.get(e)).filter((e) => !!e && e.role.k === `route`);
    e.kind !== `pass` && e.kind !== `fakepunt` && e.kind !== `fakefg` && (this.eligible = []);
  }
  runLat(e, t) {
    if (!e.carrier) return 0;
    let n = e.assign[e.carrier];
    return n && n.a === `carry` ? n.path[Math.min(2, n.path.length - 1)][0] * t : 0;
  }
  alignDefense(e, t) {
    let n = this.off
        .filter(
          (e) =>
            e.role.k === `route` ||
            e.role.k === `runner` ||
            e.role.k === `fake` ||
            [`WR1`, `WR2`, `WR3`, `TE`, `RB`, `GL`, `GR`, `UB`, `TEL`, `TER`, `WL`, `WR`].includes(e.slot),
        )
        .filter((e) => e !== this.passer && ![`LT`, `LG`, `C`, `RG`, `RT`].includes(e.slot)),
      r = n.map((e) => this.latOf(e.pos.x)),
      i = n[r.indexOf(Math.min(...r))],
      a = n[r.indexOf(Math.max(...r))],
      o = new Set(),
      s = {
        DEL: [-3.9, 1.2],
        DTL: [-1.1, 1.1],
        DTR: [1.1, 1.1],
        DER: [3.9, 1.2],
        OLBL: [-4.6, 4.6],
        MLB: [0, 4.9],
        OLBR: [4.6, 4.6],
        CBL: [i ? this.latOf(i.pos.x) : -14, 6.5],
        CBR: [a ? this.latOf(a.pos.x) : 14, 6.5],
        FS: e.shell === `two` ? [-9, 12.5] : e.shell === `deep` ? [0, 20] : [0, 14],
        SS: e.shell === `two` ? [9, 12.5] : e.shell === `deep` ? [-8, 16] : [5, 7.5],
      },
      c = this.def.filter((t) => e.assign[t.slot]?.a === `man`),
      l = (e) => (e.slot.startsWith(`CB`) ? 0 : e.slot === `SS` || e.slot === `FS` ? 1 : 2);
    c.sort((e, t) => l(e) - l(t));
    let u = new Map();
    for (let e of c) {
      let t;
      if (e.slot === `CBL` && i && !o.has(i)) t = i;
      else if (e.slot === `CBR` && a && !o.has(a)) t = a;
      else {
        let r = s[e.slot] ?? [0, 6],
          i = 1e9;
        for (let a of n) {
          if (o.has(a)) continue;
          let n = Math.abs(this.latOf(a.pos.x) - r[0]) + (a.slot === `RB` && l(e) < 2 ? 6 : 0);
          n < i && ((i = n), (t = a));
        }
      }
      t && (o.add(t), u.set(e, t));
    }
    for (let n of this.def) {
      let r = e.assign[n.slot] ?? { a: `zone`, x: 0, y: 8 },
        [i, a] = s[n.slot] ?? [0, 6];
      switch (r.a) {
        case `rush`: {
          let e = (r.lane ?? i) * t;
          [`DEL`, `DTL`, `DTR`, `DER`].includes(n.slot) ||
            ((i = e + rand(-0.4, 0.4)), (a = n.slot.startsWith(`CB`) ? 5 : 2.6));
          n.role = { k: `rush`, lane: e, delay: r.delay ?? 0 };
          break;
        }
        case `contain`:
          n.role = { k: `rush`, lane: r.side * t * 6, delay: 0, contain: r.side * t };
          break;
        case `man`: {
          let t = u.get(n) ?? null;
          if (t) {
            let r = this.latOf(t.pos.x);
            i = r + (r > 0 ? -0.7 : 0.7);
            a = e.press ? 1.6 : t.slot === `RB` ? 5.5 : 5.8;
            n.role = { k: `man`, target: t, bite: 0 };
          } else n.role = { k: `zone`, lat: i * 0.5, depth: Math.max(a, 8), r: 8 };
          break;
        }
        case `zone`:
          n.role = { k: `zone`, lat: r.x * t, depth: r.y, r: r.r ?? 7 };
          n.slot.startsWith(`CB`) && (a = r.y > 12 ? 8 : 5.5);
          break;
        case `spy`:
          n.role = { k: `spy` };
      }
      let o = this.W(i, a);
      o.x = clamp(o.x, -HALF_W + 1, HALF_W - 1);
      n.place(o.x, o.z, this.dir > 0 ? Math.PI : 0);
    }
  }
  alignPuntReturn() {
    let t = this.defMode === `puntBlock`,
      n = this.slotsO.get(`GL`),
      r = this.slotsO.get(`GR`);
    for (let i of this.def) {
      let a = 0,
        o = 1.2;
      switch (i.slot) {
        case `R1`:
          a = -3.5;
          i.role = { k: `rush`, lane: -2.2, delay: 0 };
          break;
        case `R2`:
          a = -1.1;
          i.role = { k: `rush`, lane: -0.8, delay: 0 };
          break;
        case `R3`:
          a = 1.1;
          i.role = { k: `rush`, lane: 0.8, delay: 0 };
          break;
        case `R4`:
          a = 3.5;
          i.role = { k: `rush`, lane: 2.2, delay: 0 };
          break;
        case `L1`:
          a = -5.5;
          o = t ? 1.2 : 2.5;
          i.role = t ? { k: `rush`, lane: -3.2, delay: 0 } : { k: `returnBlock`, homeX: 0, homeZ: 0 };
          break;
        case `L2`:
          a = 0;
          o = t ? 1.2 : 4;
          i.role = t ? { k: `rush`, lane: 0.3, delay: 0 } : { k: `returnBlock`, homeX: 0, homeZ: 0 };
          break;
        case `L3`:
          a = 5.5;
          o = t ? 1.2 : 2.5;
          i.role = t ? { k: `rush`, lane: 3.2, delay: 0 } : { k: `returnBlock`, homeX: 0, homeZ: 0 };
          break;
        case `JL`:
          a = n ? this.latOf(n.pos.x) : -20;
          o = 1.4;
          i.role = { k: `jammer`, target: n ?? null };
          break;
        case `JR`:
          a = r ? this.latOf(r.pos.x) : 20;
          o = 1.4;
          i.role = { k: `jammer`, target: r ?? null };
          break;
        case `S`:
          a = 0;
          o = 12;
          i.role = { k: `zone`, lat: 0, depth: 14, r: 12 };
          break;
        case `PR`: {
          let t = FIELD.GOAL - 3 - this.setup.spotZ * this.dir;
          o = Math.min(38, t);
          a = 0;
          i.role = { k: `returner`, primary: true };
          this.returner = i;
          break;
        }
      }
      let s = this.W(a, o);
      s.x = clamp(s.x, -HALF_W + 1, HALF_W - 1);
      i.place(s.x, s.z, this.dir > 0 ? Math.PI : 0);
      i.role.k === `returnBlock` && ((i.role.homeX = s.x), (i.role.homeZ = s.z + this.dir * 20));
    }
  }
  buildKickoff() {
    let t = this.setup,
      n = this.O,
      r = this.D,
      i = depthChart(this.env.teams[n], `kickoff`),
      a = depthChart(this.env.teams[r], `kickReturn`),
      o = this.dir,
      s = t.spotZ,
      c = 0,
      l = { L1: -22, L2: -17, L3: -12, L4: -7.5, L5: -3.5, R1: 3.5, R2: 7.5, R3: 12, R4: 17, R5: 22 };
    for (let [e, r] of Object.entries(i)) {
      let i = this.env.squads[n][c++];
      if ((i.bind(r), (i.slot = e), i.setActive(true), e === `K`)) {
        i.place(t.spotX - 1.2, s - o * 7, o > 0 ? 0 : Math.PI);
        i.role = { k: `kicker`, spot: new THREE.Vector3(t.spotX, 0, s) };
        this.kicker = i;
      } else {
        let t = l[e];
        i.place(t, s - o * 1.2, o > 0 ? 0 : Math.PI);
        i.role = { k: `cover`, laneX: t, delay: 0 };
      }
      this.slotsO.set(e, i);
      this.off.push(i);
    }
    c = 0;
    let u = t.returnChoice === `hands` || t.kickChoice === `onside`,
      d = FIELD.GOAL * o,
      f = u
        ? {
            KR: [0, d - o * 22],
            KR2: [-8, d - o * 26],
            F1: [-16, s + o * 11],
            F2: [-8, s + o * 11],
            F3: [0, s + o * 11],
            F4: [8, s + o * 11],
            F5: [16, s + o * 11],
            M1: [-12, s + o * 13.5],
            M2: [12, s + o * 13.5],
            M3: [-4, s + o * 14.5],
            M4: [4, s + o * 14.5],
          }
        : {
            KR: [0, d - o * 3],
            KR2: [7, d - o * 8],
            F1: [-16, s + o * 11],
            F2: [-8, s + o * 11],
            F3: [0, s + o * 11],
            F4: [8, s + o * 11],
            F5: [16, s + o * 11],
            M1: [-10, d - o * 30],
            M2: [0, d - o * 27],
            M3: [10, d - o * 30],
            M4: [-7, d - o * 8],
          };
    for (let [e, t] of Object.entries(a)) {
      let n = this.env.squads[r][c++];
      n.bind(t);
      n.slot = e;
      n.setActive(true);
      let [i, a] = f[e];
      n.place(i, a, o > 0 ? Math.PI : 0);
      e === `KR`
        ? ((n.role = { k: `returner`, primary: true }), (this.returner = n))
        : (n.role =
            e === `KR2`
              ? { k: `returner`, primary: false }
              : { k: `returnBlock`, homeX: i * 0.7, homeZ: d - o * (e.startsWith(`F`) ? 22 : 16) });
      u && (n.role = e === `KR` ? n.role : { k: `onside` });
      this.slotsD.set(e, n);
      this.def.push(n);
    }
    this.env.ball.placeAt(t.spotX, 0.35, s);
    this.env.ball.mesh.rotation.set(-0.3, 0, 0);
    this.possession = n;
    this.lastPossessor = n;
    this.isHumanTeam(n) && (this.meter = { team: n, stage: 0, aim: 0, power: 0, acc: 0, osc: 0, t: 0 });
    this.pickDefaultControl();
  }
  pickDefaultControl() {
    for (let e of [0, 1]) {
      let t = this.env.controllers[e];
      for (let t of this.teamPlayers(e)) t.human = null;
      if (((this.controlled[e] = null), !t)) continue;
      let n = null,
        r = this.teamPlayers(e);
      if (this.isKickoff) n = e === this.O ? this.kicker : this.returner;
      else if (e === this.O) {
        let e = this.offPlay;
        n = e.kind === `punt` || e.kind === `fg` ? this.kicker : this.passer;
      } else n = this.unitD === `puntReturn` ? this.returner : (r.find((e) => e.slot === `MLB`) ?? r[0]);
      n && this.setControl(e, n);
    }
  }
  setControl(e, t) {
    let n = this.env.controllers[e],
      r = this.controlled[e];
    r && (r.human = null);
    this.controlled[e] = t;
    t && n && (t.human = n);
  }
  presnapTargets() {
    this.targeted = this.eligible[0] ?? null;
  }
  preStep(e) {
    if (((this.t += e), this.env.ball, this.phase === `presnap`)) this.presnap(e);
    else if (this.phase === `live`) {
      if (((this.liveT += e), this.meter && this.meter.stage > 0 && this.meter.stage < 3)) {
        let t = this.env.controllers[this.meter.team];
        t && this.updateMeter(e, t);
      }
      for (let t of this.all) {
        if (!t.active) continue;
        let n = t.role.k === `kicker` || t.role.k === `punter` || t.role.k === `holder`;
        t.human && !n ? this.humanThink(t, e) : this.think(t, e);
        t.engaged && !BLOCK_ROLES.has(t.role.k) && this.applyBlock(t);
      }
      this.updateTurbo(e);
      this.burstP && this.liveT > this.burstUntil && ((this.burstP.speedMod = 1), (this.burstP = null));
    } else if (this.phase === `dead`) {
      this.deadT += e;
      this.lateHitWindow -= e;
      for (let t of this.all)
        t.active &&
          (t.human && this.lateHitWindow > 0 && !t.isDown ? this.humanThink(t, e) : this.deadThink(t, e));
      this.deadT > (this.report?.end.t === `td` ? 2.4 : 1.6) &&
        ((this.phase = `done`), this.resolveFn(this.report));
    }
    for (let t of this.all) t.applyMovement(e);
  }
  postStep(e) {
    let t = this.env.ball;
    for (let e of this.all) {
      if (!e.active) continue;
      e.ragdoll && e.ragdollT <= 0 && e.endRagdoll();
      e.isDown && !e.ragdoll && e.downT <= 0 && this.phase === `live` && e.getUp();
      let t = e.body.translation();
      e.pos.set(t.x, 0, t.z);
      let n = e.body.linvel();
      e.vel.set(n.x, 0, n.z);
      t.y < e.standY + 0.05 && !e.ragdoll && (e.airborne = false);
      e.action === `jump` && e.actionT > 0.2 && !e.airborne && e.setAction(`none`);
      e.action === `hurdle` && e.actionT > 0.2 && !e.airborne && e.setAction(`none`);
      e.action === `spin` && e.actionT > 0.38 && e.setAction(`none`);
      e.action === `stiffarm` && e.actionT > 0.55 && e.setAction(`none`);
      e.action === `throw` && e.actionT > 0.4 && e.setAction(`none`);
      e.action === `handoff` && e.actionT > 0.4 && e.setAction(`none`);
      e.action === `dive` && e.actionT > 0.55 && (e.setAction(`none`), e.knockDown(0.7));
    }
    t.sync();
    this.phase === `live`
      ? (this.updateBlocks(e),
        this.checkBall(e),
        this.phase === `live` && this.checkTackles(),
        this.phase === `live` && this.checkCarrierBounds(),
        this.afterStep())
      : this.phase === `dead` && this.checkLateHits();
  }
  presnap(e) {
    let t = this.env.controllers[this.O],
      n = this.env.controllers[this.D];
    this.playClock -= e;
    for (let e of this.all) {
      e.move.set(0, 0);
      e.turbo = false;
      e.faceTarget = null;
      (!e.human || e.team !== this.D || this.isKickoff) &&
        (e.yaw = e.team === this.O ? (this.dir > 0 ? 0 : Math.PI) : this.dir > 0 ? Math.PI : 0);
    }
    if (n && !this.isKickoff) {
      let e = this.controlled[this.D];
      n.consume(`special`) && this.switchDefender(this.D, true);
      e &&
        (this.env.rig.stickToWorld(n.axis.x, n.axis.y, _v2),
        e.move.set(_v2.x, _v2.y),
        (e.throttle = 0.5),
        this.depthOf(e.pos.z) < 0.9 && _v2.y * this.dir < 0 && (e.move.y = 0),
        Math.hypot(_v2.x, _v2.y) > 0.1 && (e.yaw = this.dir > 0 ? Math.PI : 0));
    }
    if (this.timeoutRequest !== null) return;
    if (this.meter && this.meter.stage === 0) {
      let t = this.env.controllers[this.meter.team];
      t && (this.meter.aim = clamp(this.meter.aim + t.axis.x * e * 1.2, -1, 1));
    }
    let r = this.t > this.minPresnap;
    if (this.isKickoff) {
      t
        ? ((r && t.consume(`action`)) || this.t > 9) && this.startKickoffApproach()
        : this.t > this.cpuSnapAt && this.startKickoffApproach();
      return;
    }
    if (t) {
      r && t.consume(`special`) && this.offPlay?.unit === `offense` && this.hardCount();
      r && t.consume(`action`) && this.snap();
    } else {
      let e = this.cpuSnapAt;
      if ((this.env.urgent[this.O] === false && this.bleedClock && (e = Math.max(e, 18.8)), this.t > e)) {
        if (this.env.settings.penalties && Math.random() < 0.012 && this.offPlay?.unit === `offense`)
          return this.deadBallFoul(`falseStart`, this.O, this.slotsO.get(`LT`) ?? this.off[0]);
        this.snap();
      }
    }
    this.phase === `presnap` &&
      this.playClock <= 0 &&
      this.deadBallFoul(`delay`, this.O, this.passer ?? this.off[0]);
  }
  bleedClock = false;
  hardCount() {
    if (
      (this.hardCounts++,
      this.env.hooks.say([`Hut!`, `Blue 42!`, `Set... HUT!`, `Omaha!`][this.hardCounts % 4]),
      !this.env.settings.penalties)
    )
      return;
    let e = this.hardCounts === 1 ? 0.18 : 0.07;
    if (!this.isHumanTeam(this.D) && Math.random() < e) {
      let e = this.def.filter((e) => e.role.k === `rush`),
        t = e[Math.floor(Math.random() * e.length)] ?? this.def[0];
      t.impulse(0, 0, -this.dir * 4);
      this.deadBallFoul(`offside`, this.D, t);
    } else
      Math.random() < 0.05 && this.deadBallFoul(`falseStart`, this.O, this.slotsO.get(`RG`) ?? this.off[0]);
  }
  deadBallFoul(e, t, n) {
    this.fouls.push({ kind: e, team: t, player: `#${n.info.num} ${n.info.last}` });
    this.env.audio.play(`whistle`);
    this.env.fx.throwFlag(n.pos, n.pos);
    this.finish({ t: `dead`, z: this.setup.spotZ, x: this.setup.spotX, team: this.O }, `foul`, false);
  }
  snap() {
    if (this.phase !== `presnap`) return;
    let e = this.offPlay;
    if (this.env.settings.penalties) {
      let e = this.controlled[this.D];
      if (e && this.depthOf(e.pos.z) < 0.35) return this.deadBallFoul(`offside`, this.D, e);
    }
    this.phase = `live`;
    this.snapT = this.t;
    this.liveT = 0;
    this.env.audio.play(`thud`, 0.6);
    let t = this.env.ball,
      n = this.slotsO.get(`C`),
      r = this.passer;
    if (e.kind === `kneel` || e.kind === `spike`) {
      t.give(r);
      r.setAction(e.kind === `kneel` ? `kneel` : `spike`);
      e.kind === `spike` && (this.forwardPassMade = true);
      return;
    }
    if (n && r.dist(n) > 2) {
      let e = new THREE.Vector3(n.pos.x, 0.5, n.pos.z),
        i = new THREE.Vector3(r.pos.x, 1.3, r.pos.z),
        a = Math.max(0.28, r.dist(n) / 20);
      t.launch(e, this.ballistic(e, i, a), `snap`, n, r, a);
    } else t.give(r);
    r.role.k === `runner` && e.kind === `run` && (this.rusher = r);
    e.kind === `run` && this.assignRunBlocks();
    for (let e of this.def)
      e.role.k === `man` &&
        e.role.target &&
        e.dist(e.role.target) < 2.2 &&
        Math.random() < e.r.cov / 140 &&
        (e.role.target.stumbleT = 0.35);
    for (let e of this.off) e.role.k === `cover` && e.slot.startsWith(`G`) && (e.turbo = true);
  }
  ballistic(e, t, n) {
    return new THREE.Vector3((t.x - e.x) / n, (t.y - e.y + 9 * n * n) / n, (t.z - e.z) / n);
  }
  landingPoint(e, t, n = 1.2) {
    let r = t.y,
      i = e.y - n,
      a = r * r - -36 * i,
      o = a < 0 ? 0.5 : (-r - Math.sqrt(a)) / -18;
    return { pt: new THREE.Vector3(e.x + t.x * o, n, e.z + t.z * o), t: Math.max(0.05, o) };
  }
  throwTo(e, t, n) {
    let r = this.env.ball;
    if (r.holder !== e) return;
    (!(this.depthOf(e.pos.z) <= 0.05) || this.forwardPassMade) &&
      (this.env.settings.penalties &&
        this.fouls.push({
          kind: `illegalForward`,
          team: this.O,
          spot: this.yardOf(this.O, e.pos.z),
          player: `#${e.info.num} ${e.info.last}`,
        }),
      this.env.fx.throwFlag(e.pos, e.pos),
      this.env.audio.play(`flag`));
    let i = e.r.arm,
      a = new THREE.Vector3(e.pos.x, 2.1, e.pos.z),
      o = n ? 15 + i * 0.07 : 19 + i * 0.12,
      s = t.pos.clone(),
      c = 0.5,
      l = t.human ? 1 : 1.05;
    for (let e = 0; e < 4; e++) {
      c = Math.max(0.3, a.distanceTo(s.clone().setY(2.1)) / o);
      n && (c *= 1.25);
      s = t.pos.clone().addScaledVector(t.vel, c * l);
    }
    s.x = clamp(s.x, -HALF_W + 0.3, HALF_W - 0.3);
    let u = this.mods(e),
      d = +(this.nearestOpponentDist(e) < 2.5),
      f = +(Math.hypot(e.vel.x, e.vel.z) > 3),
      p =
        (((100 - e.r.acc) / 100) * 0.9 + d * 0.9 + f * 0.5 + a.distanceTo(s) * 0.012) /
        Math.max(0.6, u.cpuAccuracy) /
        (e.onFire ? 2.5 : 1);
    s.x += rand(-1, 1) * p;
    s.z += rand(-1, 1) * p;
    s.y = 1.45;
    let m = this.ballistic(a, s, c);
    if (
      (r.launch(a, m, `pass`, e, t, c),
      r.landing.copy(s),
      e.setAction(`throw`),
      (this.passThrown = true),
      (this.forwardPassMade = true),
      (this.passerSpotAtThrow = this.yardOf(this.O, e.pos.z)),
      this.catchAttempts.clear(),
      (this.dpiContact = 0),
      this.env.audio.play(`throw`),
      this.stat(e, `passAtt`),
      this.env.settings.penalties && d)
    ) {
      let t = Math.abs(this.latOf(e.pos.x)) < 4,
        n = Math.min(
          ...this.off
            .filter((t) => t !== e && ![`LT`, `LG`, `C`, `RG`, `RT`].includes(t.slot))
            .map((e) => e.dist(s)),
        );
      t &&
        n > 7 &&
        (this.fouls.push({
          kind: `grounding`,
          team: this.O,
          spot: this.yardOf(this.O, e.pos.z),
          player: `#${e.info.num} ${e.info.last}`,
        }),
        this.env.fx.throwFlag(e.pos, e.pos),
        this.env.audio.play(`flag`));
    }
    e.human && this.setControl(e.team, t);
    this.runCommitT = -1;
  }
  throwAway(e) {
    let t = new THREE.Vector3((e.pos.x > 0 ? 1 : -1) * (HALF_W + 4), 1, e.pos.z + this.dir * 8),
      n = new THREE.Vector3(e.pos.x, 2.1, e.pos.z),
      r = 0.9,
      i = this.env.ball;
    i.launch(n, this.ballistic(n, t, r), `pass`, e, null, r);
    i.landing.copy(t);
    e.setAction(`throw`);
    this.passThrown = true;
    this.forwardPassMade = true;
    this.stat(e, `passAtt`);
    this.env.audio.play(`throw`);
    this.env.settings.penalties &&
      Math.abs(this.latOf(e.pos.x)) < 3.5 &&
      Math.random() < 0.6 &&
      (this.fouls.push({
        kind: `grounding`,
        team: this.O,
        spot: this.yardOf(this.O, e.pos.z),
        player: `#${e.info.num} ${e.info.last}`,
      }),
      this.env.fx.throwFlag(e.pos, e.pos),
      this.env.audio.play(`flag`));
  }
  burst(e) {
    e.speedMod = 1.12;
    this.burstUntil = this.liveT + 1.3;
    this.burstP = e;
  }
  burstUntil = 0;
  burstP = null;
  pitch(e, t) {
    let n = this.env.ball,
      r = new THREE.Vector3(e.pos.x, 1.3, e.pos.z),
      i = Math.max(0.25, e.dist(t) / 16),
      a = new THREE.Vector3(t.pos.x + t.vel.x * i, 1.2, t.pos.z + t.vel.z * i);
    n.launch(r, this.ballistic(r, a, i), `pitch`, e, t, i);
    n.landing.copy(a);
    this.qbCarryOutFake(e, t);
    e.setAction(`handoff`);
    this.handoffDone = true;
    this.rusher = t;
    this.runCommitT = this.liveT;
    this.env.audio.play(`throw`);
  }
  qbCarryOutFake(e, t) {
    let n = this.latOf(t.pos.x) >= this.latOf(e.pos.x) ? -1 : 1,
      r = this.latOf(e.pos.x) + n * 4;
    e.role = { k: `fake`, pts: [this.W(r, this.depthOf(e.pos.z) - 1.5)], idx: 0, pauseT: 0 };
  }
  handoff(e, t) {
    this.env.ball.give(t);
    this.burst(t);
    this.qbCarryOutFake(e, t);
    e.setAction(`handoff`);
    this.handoffDone = true;
    this.rusher = t;
    this.runCommitT = this.liveT;
    e.human && this.setControl(e.team, t);
    this.env.audio.play(`catch`);
  }
  giveBall(t, n) {
    let r = this.env.ball,
      i = this.lastPossessor;
    r.give(t);
    this.possession = t.team;
    this.lastPossessor = t.team;
    this.runCommitT = this.liveT;
    let a = t.team !== i,
      o = this.attackDir(t.team),
      s = t.pos.z * o <= -FIELD.GOAL;
    (a || n === `return`) && ((this.gainedInEZ = s), (this.leftEZ = false));
    a &&
      !(this.isKickoff || this.offPlay?.kind === `punt` || this.offPlay?.kind === `fg`) &&
      (this.turnover = true);
    t.team === this.O ? a && this.defHadBall && (this.regained = true) : (this.defHadBall = true);
    a &&
      (this.isKickoff || this.offPlay?.kind === `punt`) &&
      n === `recover` &&
      t.team === this.O &&
      (this.turnover = true);
    this.env.controllers[t.team] && this.setControl(t.team, t);
    this.env.controllers[other(t.team)] && this.switchDefender(other(t.team), false);
    for (let e of this.teamPlayers(t.team === this.O ? this.O : this.D))
      e !== t && e.role.k !== `returnBlock` && (e.role = { k: `escort` });
    for (let e of this.teamPlayers(t.team === this.O ? this.D : this.O)) e.role = { k: `pursue` };
    if (t.team === this.O && this.isKickoff) for (let e of this.off) e !== t && (e.role = { k: `escort` });
  }
  fumbler = null;
  defHadBall = false;
  regained = false;
  fumble(e, t) {
    let n = this.env.ball;
    this.fumbler = e;
    let r = new THREE.Vector3(e.pos.x, 1.1, e.pos.z),
      i = Math.random() * Math.PI * 2;
    n.launch(
      r,
      new THREE.Vector3(
        Math.cos(i) * rand(2, 5) + e.vel.x * 0.4,
        rand(3, 6),
        Math.sin(i) * rand(2, 5) + e.vel.z * 0.4,
      ),
      `fumble`,
      e,
      null,
      1,
    );
    n.body.setAngvel({ x: rand(-10, 10), y: rand(-10, 10), z: rand(-10, 10) }, true);
    this.fumbleT = this.liveT;
    this.lastPossessor = e.team;
    this.env.hooks.splash(`FUMBLE!`, `bad`);
    this.env.hooks.say(`Fumble! The ball is loose!`, true);
    this.env.audio.play(`fumble`);
    this.env.audio.crowd(1);
    this.highlights.push(`fumble`);
    this.env.hooks.rumble(0, 0.6, 220);
    this.env.hooks.rumble(1, 0.6, 220);
    t && this.stat(t, `ffum`);
    for (let t of this.all) t !== e && !t.isDown && (t.role = { k: `pursue` });
    let a = this.env.controllers;
    for (let e of [0, 1]) a[e] && this.switchDefender(e, false);
  }
  startKickoffApproach() {
    this.phase === `presnap` &&
      ((this.phase = `live`), (this.snapT = this.t), (this.liveT = 0), this.meter && (this.meter.stage = 1));
  }
  kickVelocity(t, n, r, i, a, o) {
    let s = n.r.kpw,
      c = this.dir,
      l,
      u,
      d = i * 0.22;
    switch (t) {
      case `kickoff`:
        l = (26 + s * 0.1) * (0.62 + 0.38 * r);
        u = 0.77;
        break;
      case `squib`:
        l = 27;
        u = 0.2;
        break;
      case `onside`:
        l = 13;
        u = 0.45;
        d = (i === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(i)) * 0.55;
        break;
      case `punt`:
        l = (23 + s * 0.09) * (0.6 + 0.4 * r);
        u = 0.92;
        break;
      case `fg`: {
        l = (26 + s * 0.12) * (0.55 + 0.45 * r);
        u = 0.63;
        let t = FIELD.END * c,
          n = Math.atan2(-(0 - o.x) * c, Math.abs(t - o.z));
        d += n;
        break;
      }
    }
    d += a * 0.16 + rand(-1, 1) * ((100 - n.r.kac) / 100) * 0.08;
    let f = l * Math.cos(u),
      p = -Math.sin(d) * f * c,
      m = Math.cos(d) * f * c;
    return new THREE.Vector3(p, l * Math.sin(u), m);
  }
  cpuFgPower(t, n) {
    let r = Math.abs(FIELD.END * this.dir - n.z);
    for (let e = 0.3; e <= 1; e += 0.02) {
      let i = (26 + t.r.kpw * 0.12) * (0.55 + 0.45 * e),
        a = r / (i * Math.cos(0.63));
      if (n.y + i * Math.sin(0.63) * a - 9 * a * a > 6) return Math.min(1, e + 0.04);
    }
    return 1;
  }
  doKick(t) {
    let n = this.kicker,
      r = this.env.ball,
      i =
        r.state === `held` || r.state === `placed`
          ? new THREE.Vector3(r.pos.x, t === `punt` ? 1.1 : 0.35, r.pos.z)
          : r.pos.clone();
    (t === `fg` || t === `kickoff` || t === `squib` || t === `onside`) &&
      i.set(r.mesh.position.x, 0.35, r.mesh.position.z);
    let a,
      o,
      s,
      c = this.meter;
    if (c && c.team === n.team) {
      a = c.power;
      o = c.aim;
      s = c.acc;
      c.stage = 3;
    } else {
      let r = this.mods(n);
      if (((o = 0), (s = (rand(-1, 1) * 0.25) / r.cpuAccuracy), t === `fg`)) a = this.cpuFgPower(n, i);
      else if (t === `punt`) {
        let t = FIELD.GOAL - this.setup.spotZ * this.dir;
        a = t < 45 ? clamp((t - 20) / 30, 0.25, 0.9) : rand(0.8, 1);
        o = rand(-0.4, 0.4);
      } else a = rand(0.82, 1);
      t === `kickoff` && (o = rand(-0.4, 0.4));
    }
    let l = this.teamPlayers(other(n.team)).filter((e) => e.canAct() && e.dist(i) < 1.6);
    if ((t === `punt` || t === `fg`) && l.length && Math.random() < 0.35 + l.length * 0.15) {
      this.env.hooks.splash(`BLOCKED!`, `big`);
      this.env.hooks.say(`Blocked kick! Blocked!`, true);
      this.env.audio.play(`bighit`);
      this.env.audio.crowd(1);
      this.puntBlocked = true;
      this.fumbleT = this.liveT;
      this.highlights.push(`blocked`);
      let e = new THREE.Vector3(rand(-4, 4), rand(3, 6), -this.dir * rand(2, 8));
      r.launch(i, e, `fumble`, n, null, 1);
      this.lastPossessor = n.team;
      n.setAction(`kick`);
      for (let e of this.all) e.isDown || (e.role = { k: `pursue` });
      return;
    }
    let u = this.kickVelocity(t, n, a, o, s, i),
      d = t === `fg` ? `fg` : t === `punt` ? `punt` : t === `onside` || t === `squib` ? `onside` : `kick`;
    r.launch(i, u, d, n, null, 3);
    this.kickSpot.copy(i);
    t === `squib` && (r.state = `air`);
    n.setAction(`kick`);
    this.env.audio.play(`kick`);
    this.env.hooks.rumble(n.team, 0.3, 90);
    this.env.rig.shake(0.15);
    let f = this.landingPoint(i, u, 1.3);
    if (
      (r.landing.copy(f.pt),
      (t === `kickoff` || t === `punt` || t === `squib`) && this.env.rig.swingTo(-this.dir),
      t === `punt`)
    ) {
      for (let e of this.off)
        (e.role.k === `passBlock` || e.role.k === `punter`) &&
          (e.role = { k: `cover`, laneX: e.pos.x, delay: 0.5 });
      this.stat(n, `punts`);
    }
    if (
      (t === `fg` && this.stat(n, this.setup.kind === `pat` ? `xpAtt` : `fgAtt`),
      this.env.controllers[n.team] && t !== `fg`)
    ) {
      let e = this.teamPlayers(n.team)
        .filter((e) => e !== n && e.active)
        .sort((e, t) => e.dist(r.landing) - t.dist(r.landing));
      e[0] && this.setControl(n.team, e[0]);
    }
  }
  humanThink(t, n) {
    let r = t.human,
      i = t.team,
      a = this.env.ball;
    this.env.rig.stickToWorld(r.axis.x, r.axis.y, _v2);
    let o = Math.hypot(r.axis.x, r.axis.y);
    if (
      (t.move.set(_v2.x, _v2.y),
      (t.throttle = 1),
      (t.faceTarget = null),
      (t.turbo = r.isHeld(`turbo`) && o > 0.2 && (this.env.turbo[i] > 0.02 || this.env.onFire[i])),
      r.isHeld(`action`) && (this.actionHeldT[i] += n),
      this.meter &&
        this.meter.team === i &&
        this.meter.stage < 3 &&
        (t === this.kicker || t.role.k === `holder`))
    ) {
      t.move.set(0, 0);
      return;
    }
    let s = a.holder === t;
    if (
      s &&
      t === this.passer &&
      t.role.k === `passer` &&
      !this.handoffDone &&
      this.offPlay?.kind === `run`
    ) {
      this.cpuPasserMove(t, n, false);
      return;
    }
    if (
      s &&
      t === this.passer &&
      this.depthOf(t.pos.z) < 0.8 &&
      !this.passThrown &&
      !this.handoffDone &&
      (this.offPlay?.kind === `pass` || this.offPlay?.kind === `fakepunt` || this.offPlay?.kind === `fakefg`)
    ) {
      let e = t.role;
      e.k === `passer` &&
        e.phase !== `set` &&
        e.phase !== `scramble` &&
        (o > 0.2 && e.phase === `drop`
          ? (e.phase = `scramble`)
          : e.phase !== `snap` && this.cpuPasserMove(t, n, true));
      this.updateTargeting(t, r);
      for (let [e, n] of [
        [`r1`, 0],
        [`r2`, 1],
        [`r3`, 2],
        [`r4`, 3],
        [`r5`, 4],
      ])
        if (r.consume(e) && this.eligible[n]) {
          this.throwTo(t, this.eligible[n], false);
          return;
        }
      if (
        (r.pressed(`action`) && ((this.actionHeldT[i] = 0), (this.pendingThrow[i] = this.targeted)),
        this.pendingThrow[i] && (!r.isHeld(`action`) || this.actionHeldT[i] > 0.3))
      ) {
        let e = this.pendingThrow[i];
        this.pendingThrow[i] = null;
        this.throwTo(t, e, this.actionHeldT[i] > 0.22);
      }
      return;
    }
    if (s) {
      let n = this.attackDir(i);
      if (r.consume(`special`)) {
        if (t.pos.z * n < -FIELD.GOAL && this.gainedInEZ && !this.leftEZ) {
          this.endZoneKneel = true;
          t.setAction(`kneel`);
          return;
        }
        t.canAct() && (t.setAction(`hurdle`), t.jump(9), this.env.audio.play(`swoosh`));
      }
      r.consume(`action`) &&
        t.canAct() &&
        t.action !== `spin` &&
        (t.setAction(`spin`), this.env.audio.play(`spin`));
      t.turbo &&
        this.nearestOpponentAhead(t) < 2.2 &&
        t.action === `none` &&
        Math.random() < 0.08 &&
        t.setAction(`stiffarm`);
      return;
    }
    if (a.state === `air` && (a.kind === `pass` || a.kind === `kick` || a.kind === `punt`)) {
      r.consume(`action`) &&
        t.canAct() &&
        (t.setAction(`jump`), t.jump(8), (this.humanPressT[i] = this.liveT));
      r.consume(`special`) &&
        (a.kind === `punt` && t === this.returner
          ? ((this.fairCatchSignal = true), t.setAction(`wave`), this.env.hooks.splash(`FAIR CATCH`, `small`))
          : this.switchDefender(i, false));
      o < 0.2 && (a.target === t || t === this.returner) && this.steer(t, a.landing.x, a.landing.z, 0.3);
      return;
    }
    if ((r.consume(`special`) && this.switchDefender(i, false), r.consume(`action`) && t.canAct())) {
      if (t.engaged) {
        t.engageT += 0.35;
        this.env.audio.play(`swoosh`);
      } else {
        let e = this.carrier;
        e && e.team !== i && t.dist(e) < 5
          ? (_v3.set(e.pos.x - t.pos.x, 0, e.pos.z - t.pos.z).normalize(),
            (t.yaw = Math.atan2(_v3.x, _v3.z)),
            t.setAction(`dive`),
            t.impulse(_v3.x * 4, 2.2, _v3.z * 4))
          : a.state === `air` || !e
            ? (t.setAction(`jump`), t.jump(8))
            : (_v3.set(Math.sin(t.yaw), 0, Math.cos(t.yaw)),
              t.setAction(`dive`),
              t.impulse(_v3.x * 4, 2.2, _v3.z * 4));
        this.humanPressT[i] = this.liveT;
      }
    }
  }
  updateMeter(e, t) {
    let n = this.meter;
    n.t += e;
    n.stage === 1
      ? ((n.osc = (n.osc + e * 1.25) % 2),
        (n.power = n.osc < 1 ? n.osc : 2 - n.osc),
        t.consume(`action`) && ((n.stage = 2), (n.osc = 0.5), this.env.audio.play(`tick`)))
      : n.stage === 2 &&
        ((n.osc = (n.osc + e * 1.6) % 2),
        (n.acc = (n.osc < 1 ? n.osc : 2 - n.osc) * 2 - 1),
        t.consume(`action`) && (this.env.audio.play(`tick`), this.triggerKick()));
    n.stage < 3 && n.t > 3.2 && this.triggerKick();
  }
  triggerKick() {
    this.meter && (this.meter.stage = 3);
  }
  updateTargeting(e, t) {
    if (!this.eligible.length) return;
    if (Math.hypot(t.axis.x, t.axis.y) < 0.3) {
      (!this.targeted || !this.eligible.includes(this.targeted)) && (this.targeted = this.eligible[0]);
      return;
    }
    this.env.rig.stickToWorld(t.axis.x, t.axis.y, _v2);
    let n = -2;
    for (let t of this.eligible) {
      _v3.set(t.pos.x - e.pos.x, 0, t.pos.z - e.pos.z).normalize();
      let r = _v3.x * _v2.x + _v3.z * _v2.y;
      r > n && ((n = r), (this.targeted = t));
    }
  }
  switchDefender(e, t) {
    let n = this.env.ball,
      r = n.state === `air` ? n.landing : n.holder ? n.holder.pos : n.pos,
      i = this.controlled[e],
      a = this.teamPlayers(e).filter((e) => e.active && !e.isDown && e !== i && e !== n.holder);
    if (!a.length) return;
    a.sort((e, t) => e.dist(r) - t.dist(r));
    let o = a[0];
    if (t && i) {
      let t = this.teamPlayers(e)
        .slice()
        .sort((e, t) => this.latOf(e.pos.x) - this.latOf(t.pos.x));
      o = t[(t.indexOf(i) + 1) % t.length];
    }
    this.setControl(e, o);
    this.env.audio.play(`blip`);
  }
  updateTurbo(e) {
    for (let t of [0, 1]) {
      let n = this.controlled[t]?.turbo ?? false;
      if (this.env.onFire[t]) {
        this.env.turbo[t] = 1;
        continue;
      }
      this.env.turbo[t] = clamp(this.env.turbo[t] + (n ? -0.42 : 0.16) * e, 0, 1);
    }
  }
  steer(e, t, n, r = 0.6, i = 1) {
    let a = t - e.pos.x,
      o = n - e.pos.z,
      s = Math.hypot(a, o);
    return s < 0.05
      ? (e.move.set(0, 0), s)
      : (e.move.set(a / s, o / s), (e.throttle = i * clamp(s / Math.max(0.01, r), 0, 1)), s);
  }
  applyBlock(e) {
    let t = e.engaged,
      n = e.pos.x - t.pos.x,
      r = e.pos.z - t.pos.z,
      i = Math.hypot(n, r) || 1;
    n /= i;
    r /= i;
    let a =
        t.role.k === `runBlock` ||
        t.role.k === `escort` ||
        t.role.k === `returnBlock` ||
        t.role.k === `jammer`,
      o = (t.r.str - e.r.str) / 22 + +!!t.onFire - !!e.onFire,
      s = clamp((a ? 1.8 : 0.8) + o, 0.2, 3.2),
      c = e.human ? 0.45 : a ? 0.32 : 0.38,
      l = e.topSpeed() * e.throttle * c;
    this.setVel(e, n * s + e.move.x * l, r * s + e.move.y * l);
    e.turbo = false;
  }
  setVel(e, t, n) {
    let r = Math.hypot(t, n);
    if (r < 0.05) {
      e.move.set(0, 0);
      return;
    }
    let i = e.topSpeed() * 1.3;
    e.move.set(t / r, n / r);
    e.throttle = Math.min(1, r / i) * (e.topSpeed(), 1);
    r > e.topSpeed() && (e.throttle = 1);
  }
  seenVels = new Map();
  seenVel(e, t) {
    let n = this.seenVels.get(e.id);
    n || ((n = t.vel.clone()), this.seenVels.set(e.id, n));
    let r = Math.min(1, ((1 / 60) * (4 + e.r.cov / 11)) / this.mods(e).cpuReact);
    return (n.lerp(t.vel, r), n);
  }
  intercept(e, t, n, r = 1) {
    let i = e.topSpeed() * 1.15,
      a = e.dist(t.pos) / i;
    for (let o = 0; o < 3; o++) {
      n.set(t.pos.x + t.vel.x * a * r, 0, t.pos.z + t.vel.z * a * r);
      a = Math.min(2, e.dist(n) / i);
    }
    return n;
  }
  nearestOpponentDist(e) {
    let t = 99;
    for (let n of this.teamPlayers(other(e.team) === this.O ? this.O : this.D))
      !n.active || n.isDown || (n.engaged && n.team !== this.O) || (t = Math.min(t, n.dist(e)));
    return t;
  }
  nearestFreeOpponentAhead(e) {
    let t = this.attackDir(e.team),
      n = 99;
    for (let r of this.teamPlayers(e.team === this.O ? this.D : this.O))
      !r.active || r.isDown || r.engaged || (r.pos.z - e.pos.z) * t < -0.3 || (n = Math.min(n, r.dist(e)));
    return n;
  }
  nearestOpponentAhead(e) {
    let t = this.attackDir(e.team),
      n = 99;
    for (let r of this.teamPlayers(e.team === this.O ? this.D : this.O))
      r.active && !r.isDown && ((r.pos.z - e.pos.z) * t < -0.3 || (n = Math.min(n, r.dist(e))));
    return n;
  }
  cpuTurbo(e, t) {
    if (!t) {
      e.turbo = false;
      return;
    }
    e.turbo = this.env.onFire[e.team] || this.env.turbo[e.team] > 0.1 || !this.isHumanTeam(e.team);
  }
  think(e, t) {
    if (((e.faceTarget = null), (e.throttle = 1), (e.turbo = false), !e.canAct())) {
      e.move.set(0, 0);
      return;
    }
    let n = this.env.ball,
      r = e.role;
    if (n.holder === e && r.k !== `passer` && r.k !== `punter` && r.k !== `holder` && r.k !== `runner`)
      return this.carrierThink(e, t);
    switch (r.k) {
      case `idle`:
        e.move.set(0, 0);
        return;
      case `passer`:
        return this.cpuPasserMove(e, t, false);
      case `runner`:
        return this.runnerThink(e, r);
      case `fake`:
        return this.followPts(e, r, 0.9);
      case `route`:
        return this.routeThink(e, r, t);
      case `passBlock`:
        return this.passBlockThink(e, r);
      case `runBlock`:
        return this.runBlockThink(e, r);
      case `escort`:
        return this.escortThink(e);
      case `rush`:
        return this.rushThink(e, r);
      case `man`:
        return this.manThink(e, r);
      case `zone`:
        return this.zoneThink(e, r);
      case `spy`:
        return this.spyThink(e);
      case `pursue`:
        return this.pursueThink(e);
      case `kicker`:
        return this.kickerThink(e, r, t);
      case `holder`:
        return this.holderThink(e);
      case `punter`:
        return this.punterThink(e, t);
      case `cover`:
        return this.coverThink(e, r);
      case `returner`:
        return this.returnerThink(e, r);
      case `returnBlock`:
        return this.returnBlockThink(e, r);
      case `jammer`:
        return this.jammerThink(e, r);
      case `onside`:
        return this.pursueThink(e);
    }
  }
  cpuPasserMove(e, t, n) {
    let r = e.role,
      i = this.env.ball;
    if (r.k !== `passer`) return;
    if (r.phase === `snap`) {
      e.move.set(0, 0);
      i.holder === e && (r.phase = r.mesh ? `mesh` : `drop`);
      return;
    }
    let a = this.offPlay;
    if (r.phase === `mesh` && r.mesh) {
      this.steer(e, r.mesh.x, r.mesh.z, 0.4, 0.8);
      let t = this.off.find((e) => e.role.k === `runner` || e.role.k === `fake`);
      if (t && i.holder === e) {
        if (t.role.k === `runner` && t.dist(e) < 1.3 && this.liveT > (a.handoffTime ?? 0.5) * 0.6)
          return this.handoff(e, t);
        if (t.role.k === `runner` && this.liveT > (a.handoffTime ?? 0.5) + 0.12 && t.dist(e) < 9)
          return this.pitch(e, t);
        if (t.role.k === `fake` && t.dist(e) < 1.4 && this.liveT > 0.5) {
          e.setAction(`handoff`);
          r.phase = `drop`;
          for (let e of this.def)
            (e.role.k === `zone` || e.role.k === `man`) &&
              (e.role.k === `man` && (e.role.bite = 0.45),
              (e.stumbleT = Math.max(e.stumbleT, e.slot.includes(`LB`) ? 0.5 : 0.25)));
        }
      }
      a.kind === `run` &&
        this.liveT > (a.handoffTime ?? 0.6) + 1.3 &&
        i.holder === e &&
        ((e.role = { k: `runner`, pts: [], idx: 0, pauseT: 0 }), (this.rusher = e));
      return;
    }
    if (r.phase === `drop`) {
      let t = this.steer(e, r.dropSpot.x, r.dropSpot.z, 0.6, 0.85);
      e.faceTarget = e.faceScratch.set(e.pos.x, 0, e.pos.z + this.dir * 10);
      t < 0.5 && (r.phase = `set`);
      return;
    }
    if (n) return;
    r.readT += t;
    this.qbHoldT += t;
    let o = this.nearestOpponentDist(e),
      s = this.mods(e);
    if (r.phase === `set`) {
      let t = this.nearestThreat(e);
      t && t.dist(e) < 3.5
        ? (_v3.set(e.pos.x - t.pos.x, 0, e.pos.z - t.pos.z).normalize(),
          e.move.set(_v3.x * 0.6, _v3.z * 0.3 + this.dir * 0.2),
          (e.throttle = 0.6))
        : e.move.set(0, 0);
      e.faceTarget = e.faceScratch.set(e.pos.x, 0, e.pos.z + this.dir * 10);
      o < 1.8 && e.r.agi > 70 && Math.random() < 0.02 && (r.phase = `scramble`);
    } else {
      let t = e.pos.x > this.setup.spotX ? 1 : -1,
        n = clamp(e.pos.x + t * 6, -HALF_W + 3, HALF_W - 3);
      if (
        (this.steer(e, n, e.pos.z + this.dir * 2, 1),
        this.cpuTurbo(e, true),
        this.depthOf(e.pos.z) > -0.5 && o > 3)
      ) {
        e.role = { k: `runner`, pts: [], idx: 0, pauseT: 0 };
        this.rusher = e;
        this.runCommitT = this.liveT;
        return;
      }
    }
    let c = (a.kind === `pass` && this.eligible.length ? 0.35 : 0.2) * s.cpuReact;
    if (r.readT < c) return;
    let l = null,
      u = -99;
    for (let t of this.eligible) {
      if (t.isDown) continue;
      let n = this.openness(e, t);
      n > u && ((u = n), (l = t));
    }
    let d = this.qbHoldT;
    if (l && (u > (d < 1.6 ? 3.2 : d < 2.6 ? 2.2 : 1.3) || (o < 1.6 && u > 0.6))) {
      this.throwTo(e, l, u > 5 && this.depthOf(l.pos.z) > 18);
      return;
    }
    if (o < 1.5 && d > 1.5 && Math.abs(this.latOf(e.pos.x)) > 4 && Math.random() < 0.3) {
      this.throwAway(e);
      return;
    }
    d > 3.8 && r.phase === `set` && (r.phase = `scramble`);
    d > 5 && l && this.throwTo(e, l, false);
  }
  nearestThreat(e) {
    let t = null,
      n = 99;
    for (let r of this.def) {
      if (!r.active || r.isDown || r.engaged) continue;
      let i = r.dist(e);
      i < n && ((n = i), (t = r));
    }
    return t;
  }
  openness(e, t) {
    let n = Math.max(0.35, e.dist(t) / 26),
      r = t.pos.x + t.vel.x * n,
      i = t.pos.z + t.vel.z * n,
      a = 99;
    for (let t of this.def) {
      if (!t.active || t.isDown) continue;
      let o = t.pos.x + t.vel.x * n * 0.6 - r,
        s = t.pos.z + t.vel.z * n * 0.6 - i;
      a = Math.min(a, Math.hypot(o, s));
      let c = r - e.pos.x,
        l = i - e.pos.z,
        u = Math.hypot(c, l),
        d = ((t.pos.x - e.pos.x) * c + (t.pos.z - e.pos.z) * l) / (u * u);
      if (d > 0.15 && d < 0.9) {
        let n = e.pos.x + c * d - t.pos.x,
          r = e.pos.z + l * d - t.pos.z,
          i = Math.hypot(n, r);
        i < 1.3 && (a -= (1.3 - i) * 3);
      }
    }
    let o = this.depthOf(i),
      s = (this.setup.lineToGainZ - this.setup.spotZ) * this.dir,
      c = Math.min(a, 7);
    return (
      this.setup.down >= 3 && o >= s && (c += 1.2),
      o < 0 && --c,
      o > 20 && (c += 0.5),
      Math.abs(r) > HALF_W - 1 && (c -= 3),
      c
    );
  }
  runnerThink(e, t) {
    if (this.env.ball.holder !== e) {
      this.followPts(e, t, 1);
      return;
    }
    this.carrierThink(e, 0);
  }
  followPts(e, t, n) {
    if (t.idx >= t.pts.length) return (e.move.set(0, 0), true);
    let r = t.pts[t.idx];
    return t.pauseT > 0
      ? ((t.pauseT -= 1 / 60), e.move.set(0, 0), t.pauseT <= 0 && t.idx++, false)
      : (this.steer(e, r.x, r.z, 0.01, n) < 0.7 && (r.pause ? (t.pauseT = r.pause) : t.idx++), false);
  }
  routeThink(e, t, n) {
    let r = this.env.ball;
    if (r.state === `air` && r.kind === `pass` && r.target === e) {
      this.steer(e, r.landing.x, r.landing.z, 0.2);
      this.cpuTurbo(e, true);
      return;
    }
    if (r.state === `air` && r.kind === `pass`) {
      this.steer(e, r.landing.x, r.landing.z, 3, 0.7);
      return;
    }
    if (t.release > 0) {
      t.release -= n;
      let r = this.def.find((t) => t.role.k === `rush` && !t.engaged && t.dist(e) < 3);
      if (r) {
        this.steer(e, r.pos.x, r.pos.z, 0.2);
        return;
      }
      e.move.set(0, 0);
      return;
    }
    let i = this.passer,
      a = i?.role;
    if (i && a && a.k === `passer` && a.phase === `scramble` && t.done) {
      let t = clamp(i.pos.x + (e.pos.x - i.pos.x) * 0.6, -HALF_W + 2, HALF_W - 2);
      this.steer(e, t, e.pos.z, 1, 0.9);
      return;
    }
    if (!t.done) {
      (this.followPts(e, t, 1) || t.idx >= t.pts.length) && (t.done = true);
      this.cpuTurbo(
        e,
        this.liveT > 0.6 &&
          this.liveT < 2.5 &&
          t.pts.length > 0 &&
          this.depthOf(t.pts[t.pts.length - 1].z) > 18,
      );
      return;
    }
    if (t.settle) {
      let t = this.nearestDefTo(e);
      if (t && t.dist(e) < 3) {
        let n = e.pos.x - t.pos.x;
        this.steer(e, clamp(e.pos.x + Math.sign(n || 1) * 2, -HALF_W + 2, HALF_W - 2), e.pos.z, 1, 0.6);
      } else e.move.set(0, 0);
      e.faceTarget = i ? i.pos : null;
      return;
    }
    let o = t.pts[t.pts.length - 1],
      s = t.pts.length > 1 ? t.pts[t.pts.length - 2] : { x: e.pos.x, z: e.pos.z - this.dir };
    _v3.set(o.x - s.x, 0, o.z - s.z).normalize();
    Math.abs(e.pos.x) > HALF_W - 2 && (_v3.x = 0);
    this.yardOf(this.O, e.pos.z) > 108 ? e.move.set(0, 0) : e.move.set(_v3.x, _v3.z).normalize();
  }
  nearestDefTo(e) {
    let t = null,
      n = 1e9;
    for (let r of this.teamPlayers(e.team === this.O ? this.D : this.O)) {
      if (!r.active || r.isDown) continue;
      let i = r.dist(e);
      i < n && ((n = i), (t = r));
    }
    return t;
  }
  passBlockThink(e, t) {
    let n = this.passer ?? this.kicker,
      r = n ? n.pos : _home.set(this.setup.spotX, 0, this.setup.spotZ - this.dir * 5);
    if (e.engaged) {
      let t = e.engaged;
      _v3.set(r.x - t.pos.x, 0, r.z - t.pos.z).normalize();
      this.steer(e, t.pos.x + _v3.x * 0.95, t.pos.z + _v3.z * 0.95, 0.15, 1);
      e.faceTarget = t.pos;
      return;
    }
    let i = null,
      a = 1e9;
    for (let n of this.def) {
      if (
        !n.active ||
        n.isDown ||
        (n.role.k !== `rush` && n.role.k !== `pursue`) ||
        (n.engaged && n.engaged !== e)
      )
        continue;
      let o = Math.abs(this.latOf(n.pos.x) - t.lat),
        s = n.dist(e) + o * 0.6;
      s < a && n.dist(r) < 9 && ((a = s), (i = n));
    }
    if (i && e.blockCooldown <= 0) {
      _v3.set(r.x - i.pos.x, 0, r.z - i.pos.z).normalize();
      this.steer(e, i.pos.x + _v3.x * 0.9, i.pos.z + _v3.z * 0.9, 0.3);
      e.faceTarget = i.pos;
    } else {
      let n = this.W(t.lat * 1.1, Math.min(-1.5, this.depthOf(r.z) + 2.5));
      this.steer(e, n.x, n.z, 0.5, 0.7);
      e.faceTarget = e.faceScratch.set(e.pos.x, 0, e.pos.z + this.dir * 5);
    }
  }
  assignRunBlocks() {
    let e = this.off
        .filter((e) => e.role.k === `runBlock` && !e.slot.startsWith(`WR`))
        .sort((e, t) => this.latOf(e.pos.x) - this.latOf(t.pos.x)),
      t = this.def
        .filter((e) => this.depthOf(e.pos.z) < 7.5 && Math.abs(this.latOf(e.pos.x)) < 9)
        .sort((e, t) => this.depthOf(e.pos.z) - this.depthOf(t.pos.z)),
      n = new Set(e);
    for (let e of t) {
      let t = null,
        r = 1e9,
        i = this.latOf(e.pos.x);
      for (let a of n) {
        let n = Math.abs(this.latOf(a.pos.x) - i) + (this.depthOf(e.pos.z) > 3 ? 1.5 : 0);
        n < r && ((r = n), (t = a));
      }
      t && r < 5.5 && (n.delete(t), t.role.k === `runBlock` && (t.role.target = e));
    }
  }
  runBlockThink(e, t) {
    let n = t.target;
    if (!e.engaged && n && n.active && !n.isDown && (!n.engaged || n.engaged === e) && e.blockCooldown <= 0) {
      let r = this.carrier,
        i = r ? r.pos.x : this.W(t.runLat, 0).x,
        a = Math.sign(n.pos.x - i) || 1;
      this.steer(e, n.pos.x - a * 0.35, n.pos.z - this.dir * 0.6, 0.1);
      e.faceTarget = n.pos;
      return;
    }
    if (e.engaged) {
      let n = e.engaged,
        r = this.carrier,
        i = Math.sign(r ? n.pos.x - r.pos.x || 1 : this.latOf(n.pos.x) - t.runLat || 1);
      this.steer(e, n.pos.x + i * 0.8, n.pos.z + this.dir * 1.2, 0.1, 0.9);
      e.faceTarget = n.pos;
      return;
    }
    let r = null,
      i = 1e9,
      a = e.slot.startsWith(`WR`);
    for (let n of this.def) {
      if (!n.active || n.isDown || (n.engaged && n.engaged !== e)) continue;
      let o = this.latOf(n.pos.x),
        s = Math.abs(o - t.lat);
      if (!a && s > 4.5) continue;
      let c = n.dist(e);
      if (c > (a ? 12 : 7)) continue;
      let l = c + Math.abs(o - t.runLat) * 0.25;
      l < i && ((i = l), (r = n));
    }
    if (r && e.blockCooldown <= 0) {
      this.steer(e, r.pos.x, r.pos.z, 0.2);
      e.faceTarget = r.pos;
    } else {
      let n = this.W(t.lat, Math.max(1.5, this.depthOf(e.pos.z) + 2));
      this.steer(e, n.x, n.z, 0.5, 0.6);
    }
  }
  escortThink(e) {
    let t = this.carrier;
    if (!t) {
      let t = this.env.ball;
      t.state === `loose`
        ? this.steer(e, t.pos.x, t.pos.z, 0.2)
        : t.state === `air`
          ? this.steer(e, t.landing.x, t.landing.z, 2, 0.8)
          : e.move.set(0, 0);
      return;
    }
    if (e.engaged) {
      let n = e.engaged;
      _v3.set(n.pos.x - t.pos.x, 0, n.pos.z - t.pos.z).normalize();
      this.steer(e, n.pos.x + _v3.x * 0.8, n.pos.z + _v3.z * 0.8, 0.1);
      return;
    }
    let n = this.attackDir(t.team),
      r = null,
      i = 1e9;
    for (let a of this.teamPlayers(t.team === this.O ? this.D : this.O)) {
      if (!a.active || a.isDown || (a.engaged && a.engaged !== e)) continue;
      let o = a.dist(t);
      if (o > 14) continue;
      let s = (a.pos.z - t.pos.z) * n,
        c = o + e.dist(a) * 0.7 - (s > 0 ? 2 : 0);
      c < i && ((i = c), (r = a));
    }
    r && e.blockCooldown <= 0
      ? (_v3.set(t.pos.x - r.pos.x, 0, t.pos.z - r.pos.z).normalize(),
        this.steer(e, r.pos.x + _v3.x * 0.8, r.pos.z + _v3.z * 0.8, 0.2),
        this.cpuTurbo(e, e.dist(r) > 4))
      : this.steer(e, t.pos.x + (e.pos.x > t.pos.x ? 2 : -2), t.pos.z + n * 4, 1, 0.9);
  }
  carrierThink(t, n) {
    let r = t.role,
      i = this.attackDir(t.team);
    if (
      (this.isKickoff || this.offPlay?.kind === `punt`) &&
      t.pos.z * i < -FIELD.GOAL - 1.5 &&
      this.gainedInEZ &&
      !this.leftEZ &&
      this.liveT - this.runCommitT < 0.4 &&
      (t.pos.z * i < -FIELD.GOAL - 3 || Math.random() < 0.5)
    ) {
      this.endZoneKneel = true;
      t.setAction(`kneel`);
      return;
    }
    if (r.k === `runner` && r.idx < r.pts.length) {
      let e = r.pts[r.idx];
      if (r.pauseT <= 0 && this.nearestFreeOpponentAhead(t) > 1.9) {
        (this.steer(t, e.x, e.z, 0.01) < 1 || (e.z - t.pos.z) * i < 0) && r.idx++;
        this.cpuTurbo(t, this.depthOf(t.pos.z) > -1);
        return;
      }
      r.idx = r.pts.length;
    }
    let a = this.teamPlayers(t.team === this.O ? this.D : this.O),
      o = 99,
      s = null;
    for (let e of a) {
      if (!e.active || e.isDown) continue;
      let n = e.dist(t);
      n < o && ((o = n), (s = e));
    }
    let c = this.env.urgent[t.team],
      l = i > 0 ? 0 : Math.PI,
      u = -1e9,
      d = 0,
      f = i,
      p = this.yardOf(t.team, t.pos.z) > 94;
    for (let e = -85; e <= 85; e += 17) {
      let n = l + (e * Math.PI) / 180,
        r = Math.sin(n),
        i = Math.cos(n),
        o = t.team === this.O && this.depthOf(t.pos.z) < 1.5 && !this.turnover,
        s = Math.cos((e * Math.PI) / 180) * (p ? 3.2 : o ? 2.6 : 1.6);
      for (let e of a) {
        if (!e.active || e.isDown) continue;
        let n = e.pos.x - t.pos.x,
          a = e.pos.z - t.pos.z,
          o = n * r + a * i;
        if (o < -1.5) continue;
        let c;
        c = o < 0 ? Math.hypot(n, a) : o > 6 ? Math.hypot(n - r * 6, a - i * 6) : Math.abs(n * i - a * r);
        let l = e.engaged ? 0.12 : 1,
          u = Math.hypot(n, a);
        u > 14 || (s -= (l * (u < 9 ? 1 : 0.4) * 2.3) / Math.max(0.35, c * c));
      }
      let m = t.pos.x + r * 4;
      Math.abs(m) > HALF_W - 1.2 && (s -= c ? -1.5 : 4 + (Math.abs(m) - HALF_W + 1.2));
      c && Math.abs(m) > Math.abs(t.pos.x) && (s += 0.6);
      s > u && ((u = s), (d = r), (f = i));
    }
    if (
      (t.move.set(d, f),
      this.cpuTurbo(t, o < 7 || this.depthOf(t.pos.z) > 2 || this.isKickoff),
      s && o < 1.9 && t.action === `none`)
    ) {
      let e = (s.pos.z - t.pos.z) * i > 0;
      s.action === `dive` && Math.random() < 0.25
        ? (t.setAction(`hurdle`), t.jump(9))
        : e && Math.random() < 0.035 * (t.r.agi / 80)
          ? (t.setAction(`spin`), this.env.audio.play(`spin`))
          : e && t.r.str > 75 && Math.random() < 0.05 && t.setAction(`stiffarm`);
    }
    c && Math.abs(t.pos.x) > HALF_W - 1.5 && o < 5 && t.move.set(Math.sign(t.pos.x), 0);
  }
  runRecognized(e) {
    if (this.runCommitT < 0) {
      let e = this.carrier;
      if (e && e.team === this.O && e !== this.passer && this.handoffDone) this.runCommitT = this.liveT;
      else if (e && e.team === this.O && this.depthOf(e.pos.z) > 0.5) this.runCommitT = this.liveT;
      else return false;
    }
    let t = (0.25 + (100 - e.r.cov) / 250) * this.mods(e).cpuReact;
    return this.liveT - this.runCommitT > t;
  }
  chaseCarrier(e, t) {
    let n = this.intercept(e, t, _v3);
    this.steer(e, n.x, n.z, 0.01);
    let r = e.dist(t);
    if ((this.cpuTurbo(e, true), r > 1.2 && r < 2.6 && e.action === `none` && !e.engaged)) {
      let n = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z),
        r = n - e.yaw;
      for (; r > Math.PI; ) r -= Math.PI * 2;
      for (; r < -Math.PI; ) r += Math.PI * 2;
      Math.abs(r) < 0.5 &&
        Math.random() < 0.045 * this.mods(e).cpuTackle &&
        ((e.yaw = n), e.setAction(`dive`), e.impulse(Math.sin(n) * 4, 2.2, Math.cos(n) * 4));
    }
  }
  rushThink(e, t) {
    if (this.liveT < t.delay) {
      e.move.set(0, 0);
      return;
    }
    let n = this.carrier,
      r = this.env.ball;
    if (r.state === `air` && r.kind === `pass`) {
      e.dist(r.landing) < 12 ? this.steer(e, r.landing.x, r.landing.z, 0.3, 0.8) : e.move.set(0, 0);
      return;
    }
    if (!n) {
      let t = this.kicker ?? this.passer;
      t
        ? this.steer(e, t.pos.x, t.pos.z, 0.01)
        : r.state === `loose` && this.steer(e, r.pos.x, r.pos.z, 0.01);
      return;
    }
    if (n.team !== this.O) return this.pursueThink(e);
    let i = this.depthOf(e.pos.z);
    if (n !== this.passer || this.handoffDone || this.runRecognized(e)) return this.chaseCarrier(e, n);
    if (t.contain) {
      let r = this.W(this.latOf(n.pos.x) + t.contain * 3, this.depthOf(n.pos.z)).x;
      this.steer(e, r, n.pos.z, 0.01);
      e.dist(n) < 3 && this.chaseCarrier(e, n);
      return;
    }
    if (i > 0.3 && Math.abs(this.latOf(e.pos.x) - t.lane) > 1.2) {
      let n = this.W(t.lane, -0.5);
      this.steer(e, n.x, n.z, 0.01);
    } else this.chaseCarrier(e, n);
    if ((this.cpuTurbo(e, i < 0 && e.dist(n) < 5), e.engaged)) {
      let t = e.engaged,
        n = this.latOf(e.pos.x) > this.latOf(t.pos.x) ? 1 : -1,
        r = this.W(this.latOf(e.pos.x) + n * 1.5, this.depthOf(e.pos.z) - 1);
      this.steer(e, r.x, r.z, 0.01, 0.4);
    }
  }
  ballBreak(e) {
    let t = this.env.ball;
    if (t.state !== `air` || t.kind !== `pass`) return false;
    let n = (0.15 + (100 - e.r.cov) / 300) * this.mods(e).cpuReact;
    return t.flightT < n || e.dist(t.landing) > 16
      ? false
      : (this.steer(e, t.landing.x, t.landing.z, 0.01), this.cpuTurbo(e, true), true);
  }
  manThink(e, t) {
    let n = this.carrier;
    if (n && n.team === this.O && n !== this.passer && n === t.target) return this.chaseCarrier(e, n);
    if (n && (n.team !== this.O || this.runRecognized(e)))
      return n.team === e.team ? this.escortThink(e) : this.chaseCarrier(e, n);
    if (this.ballBreak(e)) return;
    let r = t.target;
    if (!r || !r.active) return this.pursueThink(e);
    if (t.bite > 0) {
      t.bite -= 1 / 60;
      let n = this.W(this.latOf(e.pos.x), this.depthOf(e.pos.z) - 1);
      this.steer(e, n.x, n.z, 0.01, 0.6);
      return;
    }
    let i = this.seenVel(e, r),
      a = this.latOf(r.pos.x) > 0 ? -0.5 : 0.5,
      o = this.depthOf(r.pos.z) > 12 ? 1 : 0.6,
      s = r.pos.x + i.x * 0.18 - a * this.dir,
      c = r.pos.z + i.z * 0.18 + this.dir * o,
      l = s - e.pos.x,
      u = c - e.pos.z,
      d = Math.hypot(l, u);
    this.setVel(e, i.x + l * 3.2, i.z + u * 3.2);
    this.cpuTurbo(e, d > 1.2 || Math.hypot(i.x, i.z) > 7);
    e.faceTarget =
      this.depthOf(r.pos.z) < this.depthOf(e.pos.z) - 1 && this.liveT < 1.5 && this.passer
        ? this.passer.pos
        : null;
    this.env.settings.penalties &&
      !this.holdingRoll &&
      d > 3 &&
      e.dist(r) < 1.8 &&
      this.liveT > 1.2 &&
      !this.passThrown &&
      ((this.holdingRoll = true), Math.random() < 0.08 && this.liveFoul(`holdingD`, e.team, e));
  }
  zoneThink(e, t) {
    let n = this.carrier;
    if (n && (n.team !== this.O || this.runRecognized(e)))
      return n.team === e.team ? this.escortThink(e) : this.chaseCarrier(e, n);
    if (this.ballBreak(e)) return;
    let r = this.W(t.lat, t.depth);
    r.x = clamp(r.x, -HALF_W + 2, HALF_W - 2);
    let i = t.depth >= 14,
      a = null,
      o = 1e9;
    for (let e of this.eligible) {
      if (!e.active || e.isDown) continue;
      let n = this.depthOf(e.pos.z),
        s;
      if (i) {
        if (
          n < t.depth - 9 ||
          ((s = Math.abs(e.pos.x - r.x) - (n - t.depth) * 0.3), Math.abs(e.pos.x - r.x) > t.r + 3)
        )
          continue;
      } else if (((s = Math.hypot(e.pos.x - r.x, e.pos.z - r.z)), s > t.r + 2.5 || n > t.depth + 7)) continue;
      s < o && ((o = s), (a = e));
    }
    if (a) {
      let t = this.seenVel(e, a),
        n = a.pos.z + t.z * 0.2 + this.dir * (i ? 2.5 : 0.8),
        r = a.pos.x + t.x * 0.2 - e.pos.x,
        o = n - e.pos.z;
      this.setVel(e, t.x * 0.9 + r * 2.6, t.z * 0.9 + o * 2.6);
      this.cpuTurbo(e, Math.hypot(r, o) > 2);
    } else {
      let t = this.passer,
        n = t ? (t.pos.x - this.setup.spotX) * 0.3 : 0;
      this.steer(e, r.x + n, r.z, 0.8, 0.85);
    }
    this.passer && (e.faceTarget = this.passer.pos);
  }
  spyThink(e) {
    let t = this.carrier,
      n = this.passer;
    if (!t || !n || t !== n || this.depthOf(n.pos.z) > -0.5 || this.runRecognized(e))
      return t && t.team !== e.team
        ? this.chaseCarrier(e, t)
        : this.ballBreak(e)
          ? undefined
          : this.pursueThink(e);
    if (this.ballBreak(e)) return;
    let r = this.W(this.latOf(n.pos.x), 4.5);
    this.steer(e, r.x, r.z, 0.5);
    e.faceTarget = n.pos;
  }
  pursueThink(e) {
    let t = this.env.ball,
      n = this.carrier;
    if (n) return n.team === e.team ? this.escortThink(e) : this.chaseCarrier(e, n);
    if (t.state === `loose`) {
      this.steer(e, t.pos.x, t.pos.z, 0.01);
      this.cpuTurbo(e, true);
      return;
    }
    if (t.state === `air`) {
      this.steer(e, t.landing.x, t.landing.z, 0.5);
      return;
    }
    e.move.set(0, 0);
  }
  kickerThink(e, t, n) {
    let r = this.env.ball;
    if (this.isKickoff) {
      let n = this.meter;
      if (n && n.stage < 3) {
        e.move.set(0, 0);
        return;
      }
      if (r.state === `placed`) {
        this.steer(e, t.spot.x - 0.2, t.spot.z - this.dir * 0.5, 0.01, 0.8) < 0.7 &&
          this.doKick(
            this.setup.kickChoice === `deep` || this.setup.freeKick
              ? `kickoff`
              : this.setup.kickChoice === `squib`
                ? `squib`
                : `onside`,
          );
        return;
      }
      return this.coverThink(e, { k: `cover`, laneX: 0, delay: 0.6 });
    }
    if ((r.state === `held` && r.holder?.role.k === `holder`) || r.state === `placed`) {
      let t = this.slotsO.get(`H`),
        n = new THREE.Vector3(t.pos.x, 0, t.pos.z),
        i = this.meter,
        a = i ? (i.stage === 3 ? 0 : 99) : 0.75;
      this.liveT > a
        ? this.steer(e, n.x + 0.1, n.z - this.dir * 0.6, 0.01, 0.7) < 0.8 &&
          (i ? i.stage === 3 : this.liveT > 1.15) &&
          (r.placeAt(n.x, 0.35, n.z + this.dir * 0.3), this.doKick(`fg`))
        : e.move.set(0, 0);
      return;
    }
    e.move.set(0, 0);
  }
  holderThink(e) {
    let t = this.env.ball;
    if ((e.move.set(0, 0), t.holder === e)) {
      e.model.setMode(`hold`);
      let t = this.meter;
      t && t.stage === 0 && (t.stage = 1);
    }
  }
  punterThink(e, t) {
    let n = this.env.ball;
    if ((e.move.set(0, 0), n.holder !== e)) return;
    let r = this.meter;
    if (r) {
      r.stage === 0 && (r.stage = 1);
      r.stage === 3 && this.doKick(`punt`);
      return;
    }
    (this.liveT > 1.25 || this.nearestOpponentDist(e) < 2.2) && this.doKick(`punt`);
  }
  coverThink(e, t) {
    let n = this.env.ball;
    if (this.liveT < t.delay && !this.isKickoff) {
      e.move.set(0, 0);
      return;
    }
    if (this.isKickoff && n.state === `placed`) {
      let t = this.kicker;
      (t ? (t.pos.z - e.pos.z) * this.dir : 0) > -1.5 ? e.move.set(0, this.dir * 0.4) : e.move.set(0, 0);
      e.throttle = 0.4;
      return;
    }
    let r = this.carrier;
    if (r && r.team !== e.team) return this.chaseCarrier(e, r);
    if (n.state === `loose`) {
      this.steer(e, n.pos.x, n.pos.z, 0.01);
      this.cpuTurbo(e, true);
      return;
    }
    if (n.state === `air`) {
      let r = n.landing,
        i = Math.abs(e.pos.z - r.z) > 15 ? t.laneX * 0.7 + r.x * 0.3 : t.laneX * 0.3 + r.x * 0.7,
        a = r.z - this.dir * 4;
      this.steer(e, i, a, 3);
      this.cpuTurbo(e, true);
      return;
    }
    e.move.set(0, 0);
  }
  returnerThink(t, n) {
    let r = this.env.ball;
    if (r.state === `air` && (r.kind === `kick` || r.kind === `punt`)) {
      if (n.primary) {
        let n = r.landing,
          i = this.attackDir(t.team);
        if (r.kind === `punt` && n.z * i < -FIELD.GOAL + 6) {
          this.steer(t, n.x, n.z + i * 8, 0.5);
          return;
        }
        if ((this.steer(t, n.x, n.z, 0.2), r.kind === `punt` && r.flightT > 1.2 && !this.fairCatchSignal)) {
          let e = this.off.filter((e) => e.active && !e.isDown).map((e) => e.dist(n));
          Math.min(...e) < 6 && ((this.fairCatchSignal = true), t.setAction(`wave`));
        }
      } else {
        let e = this.returner;
        e && this.steer(t, e.pos.x + 3, e.pos.z + this.attackDir(t.team) * 5, 1);
      }
      return;
    }
    if (r.state === `loose` && (r.kind === `kick` || r.kind === `punt` || r.kind === `onside`)) {
      if (r.kind === `punt` && this.yardOf(t.team, r.pos.z) < 8) {
        t.move.set(0, 0);
        return;
      }
      this.steer(t, r.pos.x, r.pos.z, 0.01);
      return;
    }
    return this.escortThink(t);
  }
  returnBlockThink(e, t) {
    let n = this.env.ball;
    if (!this.carrier || this.carrier.team !== e.team) {
      if (n.state === `air` || n.state === `placed` || n.state === `held`) {
        this.steer(e, t.homeX, t.homeZ, 1, 0.9);
        e.faceTarget = this.kicker?.pos ?? null;
        return;
      }
      if (n.state === `loose`) {
        this.steer(e, n.pos.x, n.pos.z, 0.01);
        return;
      }
    }
    if (
      this.env.settings.penalties &&
      e.engaged &&
      !this.illegalBlockRolled &&
      this.carrier &&
      this.carrier.team === e.team
    ) {
      let t = e.engaged;
      Math.cos(t.yaw) * (e.pos.z - t.pos.z) + Math.sin(t.yaw) * (e.pos.x - t.pos.x) < -0.3 &&
        ((this.illegalBlockRolled = true), Math.random() < 0.12 && this.liveFoul(`illegalBlock`, e.team, e));
    }
    this.escortThink(e);
  }
  jammerThink(e, t) {
    let n = t.target;
    if (this.carrier && this.carrier.team === e.team) return this.escortThink(e);
    if (
      !n ||
      (this.env.ball.state !== `air` && this.env.ball.state !== `held` && this.env.ball.state !== `placed`)
    )
      return this.pursueThink(e);
    this.steer(e, n.pos.x, n.pos.z + this.dir * 1, 0.2);
    this.cpuTurbo(e, true);
  }
  updateBlocks(e) {
    let t = new Set([`passBlock`, `runBlock`, `escort`, `returnBlock`, `jammer`, `route`]);
    for (let e of this.all)
      if (
        e.active &&
        !e.isDown &&
        e !== this.carrier &&
        t.has(e.role.k) &&
        !(e.role.k === `route` && (e.role.release <= 0 || this.passThrown))
      ) {
        if (e.engaged) {
          let t = e.engaged;
          if (
            !t.active ||
            t.isDown ||
            e.dist(t) > 2.2 ||
            (t.engaged !== e && t.engaged !== null && t.engaged.engaged !== t)
          ) {
            e.engaged = null;
            continue;
          }
          continue;
        }
        if (!(e.blockCooldown > 0)) {
          for (let t of this.teamPlayers(e.team === this.O ? this.D : this.O))
            if (
              !(!t.active || t.isDown || t === this.carrier || t.stunT > 0) &&
              !(e.dist(t) > 1.3) &&
              t.role.k !== `returner` &&
              t.role.k !== `route`
            ) {
              if (((e.engaged = t), t.engaged)) t.shedTime += 0.9;
              else {
                t.engaged = e;
                t.engageT = 0;
                let n = (e.r.str - t.r.str) / 100,
                  r = t.role.k === `rush` ? (t.r.cov - 60) / 100 : 0,
                  i = 1.5 + n * 3 - r * 1.5 + rand(0, 1.2);
                (e.role.k === `runBlock` || e.role.k === `escort` || e.role.k === `returnBlock`) &&
                  (i *= 1.6);
                !t.human && !this.isHumanTeam(t.team) && (i /= this.mods(t).cpuTackle);
                t.shedTime = clamp(i, 0.5, 4.5);
              }
              this.env.audio.play(`thud`, 0.4);
              break;
            }
        }
      }
    for (let t of this.all) {
      if (
        !t.engaged ||
        t.role.k === `passBlock` ||
        t.role.k === `runBlock` ||
        t.role.k === `escort` ||
        t.role.k === `returnBlock` ||
        t.role.k === `jammer`
      )
        continue;
      t.engageT += e;
      let n = t.engaged;
      if (!n.active || n.isDown || n.dist(t) > 2.2) {
        t.engaged = null;
        continue;
      }
      if (t.engageT > t.shedTime) {
        t.engaged = null;
        for (let e of this.teamPlayers(n.team))
          e.engaged === t && ((e.engaged = null), (e.blockCooldown = 0.8));
        t.stunT = 0;
        this.env.settings.penalties &&
          !this.holdingRoll &&
          n.team === this.O &&
          this.phase === `live` &&
          !this.isKickoff &&
          ((this.holdingRoll = true), Math.random() < 0.035 && this.liveFoul(`holdingO`, n.team, n));
        Math.random() < 0.3 && (n.stumbleT = 0.5);
      }
    }
  }
  liveFoul(e, t, n, r) {
    if (this.fouls.some((n) => n.kind === e && n.team === t)) return;
    let i = this.O,
      a = r === undefined ? this.yardOf(i, n.pos.z) : this.yardOf(i, r);
    this.fouls.push({ kind: e, team: t, spot: a, player: `#${n.info.num} ${n.info.last}` });
    this.env.fx.throwFlag(n.pos.clone().add(new THREE.Vector3(rand(-4, 4), 0, -this.dir * 6)), n.pos);
    this.env.audio.play(`flag`);
    this.highlights.push(`flag`);
  }
  checkTackles() {
    let e = this.carrier;
    if (!e || e.isDown) return;
    this.env.ball;
    let t = this.teamPlayers(e.team === this.O ? this.D : this.O);
    for (let r of t) {
      if (
        !r.active ||
        r.isDown ||
        r.stunT > 0 ||
        r.dist(e) > (r.engaged ? 0.75 : PLAYER.TACKLE_RANGE + (r.action === `dive` ? 0.35 : 0)) ||
        Math.abs(e.bodyY() - r.bodyY()) > 1.3 ||
        this.liveT - r.lastTackleTry < 0.7
      )
        continue;
      r.lastTackleTry = this.liveT;
      let i = this.mods(r),
        a = 0.5 + (r.r.tkl - 70) / 160 - (e.r.str * 0.5 + e.r.agi * 0.5 - 75) / 150;
      r.action === `dive` && (a += 0.22);
      r.turbo && (a += 0.08);
      r.engaged && (a -= 0.45);
      let o = t.filter((t) => t !== r && t.active && !t.isDown && t.dist(e) < 2).length;
      a += o * 0.1;
      let s = (r.pos.z - e.pos.z) * this.attackDir(e.team) < 0;
      s ? (a += 0.03) : !r.engaged && r.action !== `dive` && (a += 0.1);
      e.action === `spin` && e.actionT < 0.38 && (a *= 0.25);
      e.action === `hurdle` && r.action === `dive` && (a *= 0.1);
      e.action === `stiffarm` && !s && (a -= 0.25);
      e === this.passer && !this.passThrown && !this.handoffDone && (a += 0.15);
      e.onFire && (a -= 0.15);
      r.onFire && (a += 0.15);
      a *= i.cpuTackle;
      a = clamp(a, 0.12, 0.97);
      let c = Math.hypot(r.vel.x - e.vel.x, r.vel.z - e.vel.z);
      if (Math.random() < a) {
        this.tackle(r, e, c);
        return;
      }
      r.stumbleT = 0.7;
      (r.action === `dive` || Math.random() < 0.5) && r.knockDown(0.9);
      e.stumbleT = 0.15;
      this.env.audio.play(`hit`, 0.6);
      this.env.fx.hitBurst(e.pos, [r.teamDef.colors.jersey, `#ffffff`], 0.5);
      e.action === `spin`
        ? this.env.hooks.splash(`SPIN MOVE!`, `mid`)
        : e.action === `stiffarm`
          ? this.env.hooks.splash(`STIFF ARM!`, `mid`)
          : Math.random() < 0.5 && this.env.hooks.splash(`BROKE THE TACKLE!`, `mid`);
      e.human && this.env.hooks.rumble(e.team, 0.25, 80);
      Math.random() < 0.4 &&
        this.env.hooks.say(
          [`Shakes him off!`, `He breaks free!`, `Can not bring him down!`][Math.floor(Math.random() * 3)],
        );
      e.action === `stiffarm` && r.launch(r.pos.x - e.pos.x, r.pos.z - e.pos.z, 6);
    }
  }
  lastTackler = ``;
  tackle(e, t, n) {
    this.lastTackler = `${e.slot}@${this.depthOf(t.pos.z).toFixed(1)} t=${this.liveT.toFixed(2)} eng=${!!e.engaged} act=${e.action}`;
    let r =
      n > 16.5 ||
      (e.turbo && n > 15) ||
      (e.action === `dive` && n > 15.5) ||
      (e.human !== null && e.turbo && n > 10.5) ||
      (e.onFire && n > 9);
    this.tackleSpot.copy(t.pos);
    let i = this.depthOf(t.pos.z) < 0,
      a =
        t === this.passer &&
        !this.passThrown &&
        !this.handoffDone &&
        i &&
        t.team === this.O &&
        this.setup.kind !== `kickoff`;
    this.stat(e, `tackles`);
    let o = 0.008 + (r ? 0.05 : 0) + ((100 - t.r.hnd) / 100) * 0.02 + (a ? 0.04 : 0);
    t.onFire && (o *= 0.3);
    t.action === `kneel` && (o = 0);
    let s = new THREE.Vector3(t.pos.x - e.pos.x, 0, t.pos.z - e.pos.z);
    if (
      (s.lengthSq() < 0.01 && s.set(e.vel.x, 0, e.vel.z),
      r
        ? ((this.hardHit = true),
          t.launch(s.x + e.vel.x * 0.3, s.z + e.vel.z * 0.3, 9 + n * 0.4),
          e.knockDown(0.9),
          this.env.rig.shake(0.9),
          this.env.fx.hitBurst(
            t.pos,
            [t.teamDef.colors.jersey, e.teamDef.colors.jersey, `#ffffff`, `#ffd23f`],
            1.6,
          ),
          this.env.fx.ring(t.pos, `#ffffff`, 5),
          this.env.audio.play(`bighit`),
          this.env.audio.crowd(0.9),
          this.env.hooks.hitStop(),
          this.env.hooks.splash(
            [`BOOM!`, `WHAM!`, `SMASH!`, `KA-POW!`, `CRUNCH!`][Math.floor(Math.random() * 5)],
            `big`,
          ),
          this.env.hooks.say(
            [
              `Oh! He got destroyed!`,
              `What a hit!`,
              `Boom! Lights out!`,
              `He got smoked!`,
              `Oof! Somebody call a doctor!`,
            ][Math.floor(Math.random() * 5)],
            true,
          ),
          this.highlights.push(`bigHit`),
          this.env.hooks.rumble(t.team, 0.9, 260),
          this.env.hooks.rumble(e.team, 0.7, 200))
        : (t.knockDown(1.2),
          t.human && this.env.hooks.rumble(t.team, 0.4, 110),
          e.human && this.env.hooks.rumble(e.team, 0.3, 90),
          e.action !== `dive` && e.knockDown(0.8),
          (t.yaw = Math.atan2(s.x, s.z)),
          this.env.audio.play(`hit`),
          this.env.fx.hitBurst(t.pos, [t.teamDef.colors.jersey, `#ffffff`], 0.7),
          this.env.rig.shake(0.25)),
      this.env.settings.penalties &&
        Math.random() < 0.006 &&
        t.team === this.O &&
        !this.isKickoff &&
        this.liveFoul(`faceMask`, e.team, e, t.pos.z),
      Math.random() < o && this.setup.kind !== `pat`)
    ) {
      this.fumble(t, e);
      return;
    }
    a &&
      ((this.sack = true),
      this.stat(e, `sacks`),
      this.stat(t, `sacked`),
      this.env.hooks.splash(`SACK!`, `big`),
      this.env.hooks.say(
        [`Sacked!`, `He brings down the quarterback!`, `Sack! What a rush!`][Math.floor(Math.random() * 3)],
        true,
      ),
      this.env.audio.crowd(0.8),
      this.highlights.push(`sack`));
    this.downCarrier(t, this.tackleSpot);
  }
  downCarrier(t, n) {
    let r = t.team,
      i = this.attackDir(r),
      a = n.z;
    if (a * i >= FIELD.GOAL) return this.touchdown(t);
    if (a * i <= -FIELD.GOAL) return this.ownEndZoneDead(t);
    this.finish({ t: `dead`, z: a, x: n.x, team: r }, `tackle`, false);
  }
  ownEndZoneDead(e) {
    let t = e.team;
    if (
      (t !== this.O || this.turnover || this.setup.kind === `kickoff` || this.offPlay?.kind === `punt`) &&
      this.gainedInEZ &&
      !this.leftEZ
    ) {
      let e = this.isKickoff ? 25 : 20;
      return (
        this.env.hooks.splash(`TOUCHBACK`, `small`),
        this.finish({ t: `touchback`, team: t, yard: e }, `touchback`, true)
      );
    }
    this.env.hooks.splash(`SAFETY!`, `big`);
    this.env.hooks.say(`Safety! Two points!`, true);
    this.env.audio.play(`horn`);
    this.env.audio.crowd(1);
    this.highlights.push(`safety`);
    this.finish({ t: `safety`, against: t }, `safety`, true);
  }
  touchdown(e) {
    let t = e.team;
    this.scorer = e;
    let n = this.setup.kind === `two` || this.setup.kind === `pat`;
    e.team !== this.O && !this.isKickoff && this.stat(e, `defTD`);
    this.completion && this.completion.rec === e && !this.turnover
      ? (this.stat(this.completion.qb, `passTD`), this.stat(e, `recTD`))
      : this.rusher === e && !this.turnover
        ? this.stat(e, `rushTD`)
        : (this.isKickoff || this.offPlay?.kind === `punt`) && this.stat(e, `retTD`);
    e.setAction(`celebrate`);
    for (let e of this.teamPlayers(t === this.O ? this.O : this.D)) e.celebrate = true;
    n ||
      (this.env.hooks.splash(`TOUCHDOWN!`, `big`),
      this.env.hooks.say(
        [
          `Touchdown!`,
          `He scores! Touchdown!`,
          `Six points! Unbelievable!`,
          `Touchdown! The crowd goes wild!`,
        ][Math.floor(Math.random() * 4)],
        true,
      ));
    this.finish({ t: `td`, team: t }, `td`, true);
  }
  checkCarrierBounds() {
    let t = this.carrier;
    if (!t || t.isDown) return;
    let n = this.attackDir(t.team),
      r = t.pos.z;
    if ((r * n > -FIELD.GOAL && (this.leftEZ = this.leftEZ || this.gainedInEZ), t.action === `kneel`))
      return this.endZoneKneel
        ? this.ownEndZoneDead(t)
        : t.actionT > 0.5
          ? (this.env.hooks.splash(`TAKE A KNEE`, `small`), this.downCarrier(t, t.pos))
          : undefined;
    if (t.action === `spike` && t.actionT > 0.3)
      return (
        this.env.hooks.splash(`SPIKE!`, `small`),
        this.stat(t, `passAtt`),
        this.finish({ t: `incomplete` }, `spike`, true)
      );
    if (r * n >= FIELD.GOAL && Math.abs(t.pos.x) <= HALF_W + 0.3) return this.touchdown(t);
    if (Math.abs(t.pos.x) > HALF_W || Math.abs(r) > FIELD.END) {
      let i = new THREE.Vector3(clamp(t.pos.x, -HALF_W, HALF_W), 0, clamp(r, -FIELD.END, FIELD.END));
      if (i.z * n <= -FIELD.GOAL) return this.ownEndZoneDead(t);
      this.env.hooks.splash(`OUT OF BOUNDS`, `small`);
      this.finish({ t: `dead`, z: i.z, x: i.x, team: t.team }, `oob`, true);
    }
  }
  checkBall(e) {
    let t = this.env.ball;
    if ((this.setup, t.state === `air` && t.kind === `pitch`)) {
      let e = t.target;
      if (Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 1.3 && t.pos.y < 2.4) {
        t.give(e);
        this.burst(e);
        this.env.audio.play(`catch`);
        this.env.controllers[e.team] && this.setControl(e.team, e);
        return;
      }
      if (t.pos.y < 0.25) {
        t.setLoose();
        this.fumbleT = this.liveT;
        this.lastPossessor = this.O;
        this.env.hooks.splash(`LOOSE BALL!`, `bad`);
        for (let e of this.all) e.isDown || (e.role = { k: `pursue` });
      }
      return;
    }
    if (t.state === `air` && t.kind === `snap`) {
      let e = t.target;
      (Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 1 || t.flightT > t.flightDur + 0.1) &&
        (t.give(e), this.env.audio.play(`catch`));
      return;
    }
    if (t.state === `air` && t.kind === `pass`) return this.checkPass();
    if (t.state === `air` && t.kind === `fg`) return this.checkFG();
    if (
      (t.state === `air` || t.state === `loose`) &&
      (t.kind === `kick` || t.kind === `punt` || t.kind === `onside`)
    )
      return this.checkKickBall();
    if (t.state === `loose`) return this.checkLoose();
  }
  checkPass() {
    let t = this.env.ball,
      r = t.target;
    if (r && this.env.settings.penalties && !this.dpiCalled) {
      let e = t.flightDur - t.flightT;
      for (let n of this.def)
        n.active &&
          !n.isDown &&
          n.dist(r) < 0.95 &&
          e > 0.3 &&
          t.pos.distanceTo(n.pos) > 3 &&
          (this.dpiContact += (1 / 60) * (n.human ? 1.6 : 1));
      if (this.dpiContact > 0.4 && ((this.dpiCalled = true), Math.random() < 0.55)) {
        let e = this.def.reduce((e, t) => (e.dist(r) < t.dist(r) ? e : t));
        this.liveFoul(`dpi`, this.D, e, r.pos.z);
      }
    }
    let i = this.all
      .filter((e) => e.active && !e.isDown && e !== t.thrower && !this.catchAttempts.has(e.id))
      .map((e) => ({ p: e, d: Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) }))
      .filter((e) => {
        let r = PLAYER.CATCH_REACH + (e.p.airborne ? 0.35 : 0) + (e.p.action === `dive` ? 0.5 : 0),
          i = 2.7 + Math.max(0, e.p.bodyY());
        return e.d < r && t.pos.y > 0.15 && t.pos.y < i && t.flightT > 0.12;
      })
      .sort((e, t) => e.d - t.d);
    for (let { p: e } of i) {
      this.catchAttempts.add(e.id);
      let n = e.team === this.O,
        r = this.liveT - this.humanPressT[e.team] < 0.5 && !!e.human;
      if (n) {
        let n = 0.72 + (e.r.hnd / 100) * 0.25;
        for (let t of this.def) {
          if (!t.active || t.isDown) continue;
          let r = t.dist(e);
          r < 1.4 && (n -= (1 - r / 1.4) * 0.35 * (0.6 + t.r.cov / 250));
        }
        r && (n += 0.08);
        e !== t.target && (n -= 0.15);
        e.onFire && (n += 0.2);
        let i = e.human ? DIFFICULTY[this.env.settings.difficulty].humanCatch : 1;
        if (((n = clamp(n * i, 0.08, 0.98)), Math.random() < n)) {
          if (Math.abs(e.pos.x) > HALF_W)
            return (
              this.env.hooks.splash(`INCOMPLETE`, `small`),
              this.finish({ t: `incomplete` }, `oob-catch`, true)
            );
          this.completion = { qb: t.thrower, rec: e };
          this.stat(t.thrower, `passComp`);
          this.stat(e, `rec`);
          // Read the dive before it is cleared (the original checked after, so diving grabs never showed).
          const diving = e.action === `dive`;
          e.setAction(`none`);
          this.giveBall(e, `catch`);
          this.env.audio.play(`catch`);
          this.env.audio.crowd(0.5);
          (diving || e.airborne) && this.env.hooks.splash(`WHAT A GRAB!`, `mid`);
          e.human && this.env.hooks.rumble(e.team, 0.2, 60);
          Math.random() < 0.35 &&
            this.env.hooks.say(
              [`Caught!`, `Got it!`, `Great hands!`, `Reception!`][Math.floor(Math.random() * 4)],
            );
          this.env.settings.penalties &&
            this.def.some((t) => t.active && t.dist(e) < 1) &&
            Math.random() < 0.03 &&
            this.liveFoul(`opi`, this.O, e);
          return;
        }
        this.env.hooks.splash(`DROPPED!`, `bad`);
        this.env.audio.play(`thud`);
        t.target = null;
        continue;
      }
      let i = 0.1 + (e.r.cov / 100) * 0.18 + (e.r.hnd / 100) * 0.1 + (r ? 0.22 : 0) + (e.onFire ? 0.2 : 0);
      e.human === null && !this.isHumanTeam(e.team) && (i *= this.mods(e).cpuTackle);
      let o = Math.random();
      if (o < i) {
        this.stat(t.thrower, `intThrown`);
        this.stat(e, `defInt`);
        this.giveBall(e, `int`);
        this.env.audio.play(`catch`);
        this.env.audio.crowd(1);
        this.env.hooks.splash(`INTERCEPTED!`, `big`);
        this.env.hooks.say(
          [`Intercepted!`, `Picked off!`, `He reads it and takes it away!`][Math.floor(Math.random() * 3)],
          true,
        );
        this.highlights.push(`int`);
        this.env.hooks.rumble(0, 0.6, 240);
        this.env.hooks.rumble(1, 0.6, 240);
        return;
      }
      if (o < i + 0.45) {
        let e = t.vel.clone().multiplyScalar(0.25);
        e.y = rand(3, 6);
        e.x += rand(-3, 3);
        e.z += rand(-3, 3);
        t.launch(t.pos.clone(), e, `pass`, t.thrower, null, 0.8);
        t.state = `air`;
        this.env.audio.play(`thud`);
        this.env.hooks.splash(`SWATTED!`, `mid`);
        let n = this.landingPoint(t.pos, e, 1.2);
        t.landing.copy(n.pt);
        return;
      }
    }
    (t.pos.y < 0.2 ||
      (Math.abs(t.pos.x) > HALF_W + 2 && t.pos.y < 2.5) ||
      Math.abs(t.pos.z) > FIELD.END + 3) &&
      (this.env.hooks.splash(`INCOMPLETE`, `small`),
      Math.random() < 0.3 &&
        this.env.hooks.say(
          [`Incomplete.`, `Falls incomplete.`, `No good. Incomplete.`][Math.floor(Math.random() * 3)],
        ),
      this.finish({ t: `incomplete` }, `incomplete`, true));
  }
  checkFG() {
    let t = this.env.ball;
    if (this.fgResultDone) return;
    let n = FIELD.END * this.dir;
    if ((t.prev.z - n) * this.dir < 0 && (t.pos.z - n) * this.dir >= 0) {
      let r = (n - t.prev.z) / (t.pos.z - t.prev.z || 1e-6),
        i = t.prev.x + (t.pos.x - t.prev.x) * r,
        a = t.prev.y + (t.pos.y - t.prev.y) * r;
      this.fgResultDone = true;
      let o = Math.abs(i) < FIELD.POST_HALF && a > FIELD.CROSSBAR,
        s = Math.round(Math.abs(n - this.kickSpot.z));
      o
        ? (this.kicker && this.stat(this.kicker, this.setup.kind === `pat` ? `xpMade` : `fgMade`),
          this.env.hooks.splash(this.setup.kind === `pat` ? `IT'S GOOD!` : `${s} YD FG GOOD!`, `big`),
          this.env.hooks.say(
            this.setup.kind === `pat` ? `The extra point is good.` : `It's good! A ${s} yard field goal!`,
            true,
          ),
          this.env.audio.play(`horn`),
          this.env.audio.crowd(0.9),
          this.finishSoon({ t: `fgGood` }, 0.8))
        : (this.env.hooks.splash(`NO GOOD!`, `bad`),
          this.env.hooks.say(
            Math.abs(i) < FIELD.POST_HALF + 0.3 ? `Doink! Off the upright! No good!` : `No good! Wide!`,
            true,
          ),
          this.env.audio.play(`buzzer`),
          this.finishSoon({ t: `fgMiss`, z: this.kickSpot.z }, 0.8));
      return;
    }
    t.pos.y < 0.25 &&
      t.flightT > 0.3 &&
      ((this.fgResultDone = true),
      this.env.hooks.splash(`NO GOOD!`, `bad`),
      this.env.hooks.say(`Short! No good!`, true),
      this.env.audio.play(`buzzer`),
      this.finishSoon({ t: `fgMiss`, z: this.kickSpot.z }, 0.5));
  }
  finishPending = null;
  finishSoon(e, t) {
    this.finishPending = { end: e, t: this.liveT + t };
  }
  checkKickBall() {
    let t = this.env.ball,
      n = this.O,
      r = this.D,
      i = this.attackDir(r),
      a = t.kind === `punt`;
    if (this.finishPending && this.liveT >= this.finishPending.t)
      return this.finish(this.finishPending.end, `kick`, true);
    if (t.state === `air`) {
      for (let n of this.teamPlayers(r))
        if (
          n.active &&
          !n.isDown &&
          Math.hypot(n.pos.x - t.pos.x, n.pos.z - t.pos.z) < 1.25 &&
          t.pos.y < 2.9 &&
          t.pos.y > 0.3 &&
          t.vel.y < 0
        ) {
          if (Math.random() < (n.r.hnd > 80 ? 0.03 : 0.07)) {
            this.kickTouchedByR = true;
            t.state = `loose`;
            t.body.setLinvel({ x: rand(-3, 3), y: 3, z: rand(-3, 3) }, true);
            this.env.hooks.splash(`MUFFED!`, `bad`);
            this.env.audio.play(`fumble`);
            this.lastPossessor = r;
            for (let e of this.all) e.isDown || (e.role = { k: `pursue` });
            return;
          }
          if (((this.kickTouchedByR = true), this.env.audio.play(`catch`), a && this.fairCatchSignal)) {
            if ((t.give(n), n.pos.z * i <= -FIELD.GOAL)) {
              this.env.hooks.splash(`TOUCHBACK`, `small`);
              this.finish({ t: `touchback`, team: r, yard: 20 }, `touchback`, true);
              return;
            }
            this.env.hooks.splash(`FAIR CATCH`, `small`);
            this.finish({ t: `dead`, z: n.pos.z, x: n.pos.x, team: r }, `fair`, true);
            return;
          }
          this.returner = n;
          this.giveBall(n, `return`);
          this.retStart = n.pos.z;
          return;
        }
      if (Math.abs(t.pos.z) > FIELD.END + 0.5 && t.pos.z * i < 0)
        return this.finish({ t: `touchback`, team: r, yard: this.isKickoff ? 25 : 20 }, `touchback`, true);
      (t.pos.y < 0.3 || Math.abs(t.pos.x) > HALF_W + 0.3) &&
        ((this.kickGrounded = true), (t.state = `loose`));
    }
    if (t.state === `loose`) {
      if (t.pos.z * i <= -FIELD.GOAL && !this.kickTouchedByR)
        return (
          this.env.hooks.splash(`TOUCHBACK`, `small`),
          this.finish({ t: `touchback`, team: r, yard: this.isKickoff ? 25 : 20 }, `touchback`, true)
        );
      if (Math.abs(t.pos.z) > FIELD.END)
        return t.pos.z * i < 0
          ? (this.env.hooks.splash(`TOUCHBACK`, `small`),
            this.finish({ t: `touchback`, team: r, yard: this.isKickoff ? 25 : 20 }, `touchback`, true))
          : (this.env.hooks.splash(`SAFETY!`, `big`),
            this.finish({ t: `safety`, against: n }, `safety`, true));
      if (Math.abs(t.pos.x) > HALF_W)
        return this.isKickoff &&
          !this.kickTouchedByR &&
          (t.kind === `kick` || this.setup.kickChoice === `deep`)
          ? (this.env.hooks.splash(`KICK OUT OF BOUNDS`, `bad`),
            this.finish({ t: `kickoffOOB`, team: r }, `kickoob`, true))
          : this.finish(
              { t: `dead`, z: t.pos.z, x: t.pos.x, team: this.kickTouchedByR && !a ? this.lastPossessor : r },
              `oob`,
              true,
            );
      let o = (t.pos.z - this.kickSpot.z) * this.dir;
      for (let i of this.all)
        if (
          i.active &&
          !i.isDown &&
          !(Math.hypot(i.pos.x - t.pos.x, i.pos.z - t.pos.z) > 1 || t.pos.y > 1.2)
        ) {
          if (i.team === n) {
            if (a) {
              if (!this.kickTouchedByR)
                return (
                  (this.kickTouchedByK = true),
                  this.env.hooks.splash(`DOWNED`, `small`),
                  this.finish({ t: `dead`, z: t.pos.z, x: t.pos.x, team: r }, `downed`, true)
                );
              if (Math.random() < 0.3)
                return (
                  this.giveBall(i, `recover`),
                  i.pos.z * this.attackDir(n) >= FIELD.GOAL
                    ? this.touchdown(i)
                    : (this.env.hooks.splash(`RECOVERED!`, `big`),
                      this.finish(
                        { t: `dead`, z: i.pos.z, x: i.pos.x, team: n, firstDown: true },
                        `recover`,
                        true,
                      ))
                );
              continue;
            }
            if (o < 10 && !this.kickTouchedByR) continue;
            if (Math.random() < 0.18)
              return (
                this.giveBall(i, `recover`),
                i.pos.z * this.attackDir(n) >= FIELD.GOAL
                  ? this.touchdown(i)
                  : (this.env.hooks.splash(`ONSIDE RECOVERED!`, `big`),
                    this.env.hooks.say(`They got it back! Onside kick recovered!`, true),
                    this.env.audio.crowd(1),
                    this.highlights.push(`onside`),
                    this.finish(
                      { t: `dead`, z: i.pos.z, x: i.pos.x, team: n, firstDown: true },
                      `recover`,
                      true,
                    ))
              );
          } else if (Math.random() < 0.25) {
            this.kickTouchedByR = true;
            this.returner = i;
            this.giveBall(i, `return`);
            this.retStart = i.pos.z;
            return;
          }
        }
      if (
        (t.vel.length() < 0.6 &&
          t.pos.y < 0.4 &&
          t.flightT > 1 &&
          !this.kickTouchedByR &&
          ((this.isKickoff && o < 10) || a || !this.isKickoff)) ||
        t.flightT > 9
      )
        return this.finish({ t: `dead`, z: t.pos.z, x: t.pos.x, team: r }, `dead`, true);
    }
  }
  retStart = 0;
  checkLoose() {
    let t = this.env.ball;
    if (Math.abs(t.pos.x) > HALF_W || Math.abs(t.pos.z) > FIELD.END) {
      let n = this.lastPossessor,
        r = this.attackDir(n);
      return t.pos.z * r >= FIELD.GOAL
        ? (this.env.hooks.splash(`TOUCHBACK`, `small`),
          this.finish({ t: `touchback`, team: other(n), yard: 20 }, `touchback`, true))
        : t.pos.z * r <= -FIELD.GOAL
          ? (this.env.hooks.splash(`SAFETY!`, `big`),
            this.env.audio.play(`horn`),
            this.finish({ t: `safety`, against: n }, `safety`, true))
          : (this.env.hooks.splash(`OUT OF BOUNDS`, `small`),
            this.finish(
              {
                t: `dead`,
                z: clamp(t.pos.z, -FIELD.GOAL + 0.5, FIELD.GOAL - 0.5),
                x: clamp(t.pos.x, -HALF_W, HALF_W),
                team: n,
              },
              `oob`,
              true,
            ));
    }
    let n = this.all.filter(
      (e) => e.active && !e.isDown && Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) < 1 && t.pos.y < 1.1,
    );
    for (let t of n)
      if (Math.random() < 0.22 + t.r.hnd / 500) {
        let n = t.team !== this.lastPossessor;
        this.giveBall(t, `recover`);
        this.env.audio.play(`catch`);
        n &&
          (this.env.hooks.splash(`RECOVERED!`, `big`),
          this.env.hooks.say(`And they recover the fumble! Turnover!`, true),
          this.env.audio.crowd(1),
          this.fumbler && this.stat(this.fumbler, `fumLost`));
        let r = this.attackDir(t.team);
        return t.pos.z * r >= FIELD.GOAL
          ? this.touchdown(t)
          : Math.random() < 0.6 || t.isDown
            ? this.downCarrier(t, t.pos.clone())
            : undefined;
      }
    if (this.fumbleT >= 0 && this.liveT - this.fumbleT > 6) {
      let e = null,
        n = 1e9;
      for (let r of this.all) {
        if (!r.active) continue;
        let i = Math.hypot(r.pos.x - t.pos.x, r.pos.z - t.pos.z);
        i < n && ((n = i), (e = r));
      }
      e && (this.giveBall(e, `recover`), this.downCarrier(e, t.pos.clone()));
    }
  }
  finish(t, n, r) {
    if (this.phase === `dead` || this.phase === `done`) return;
    let i = this.env.ball;
    this.deadReason = n;
    let a = this.phase === `presnap`;
    this.phase = `dead`;
    this.deadT = 0;
    this.lateHitWindow = a ? 0 : 0.9;
    a || this.env.audio.play(`whistle`);
    let o = i.holder;
    t.t === `dead` || t.t === `td` ? (i.kill(), o && i.pos.copy(o.pos).setY(0.2)) : i.kill();
    let s = 0,
      c = this.O;
    if (
      (t.t === `dead` && t.team === c && !this.turnover && (s = (t.z - this.setup.spotZ) * this.dir),
      t.t === `td` &&
        t.team === c &&
        !this.turnover &&
        (s = (FIELD.GOAL * this.dir - this.setup.spotZ) * this.dir),
      t.t === `safety` && t.against === c && (s = (-FIELD.GOAL * this.dir - this.setup.spotZ) * this.dir),
      (s = Math.round(s)),
      (this.setup.kind === `scrimmage` || this.setup.kind === `two`) &&
        (this.completion && !this.turnover
          ? (this.stat(this.completion.qb, `passYds`, s), this.stat(this.completion.rec, `recYds`, s))
          : this.rusher && !this.passThrown
            ? (this.stat(this.rusher, `rushAtt`), this.turnover || this.stat(this.rusher, `rushYds`, s))
            : this.sack && this.passer),
      (this.isKickoff || this.offPlay?.kind === `punt`) &&
        this.returner &&
        (t.t === `dead` || t.t === `td`) &&
        this.kickTouchedByR)
    ) {
      let n = Math.round(
        ((t.t === `dead` ? t.z : FIELD.GOAL * this.attackDir(this.returner.team)) - this.retStart) *
          this.attackDir(this.returner.team),
      );
      n !== 0 && this.stat(this.returner, `retYds`, n);
    }
    if (this.offPlay?.kind === `punt` && this.kicker && !this.puntBlocked) {
      let n = t.t === `dead` ? t.z : t.t === `touchback` ? FIELD.GOAL * this.dir : this.setup.spotZ;
      this.stat(this.kicker, `puntYds`, Math.round((n - this.setup.spotZ) * this.dir));
    }
    (Math.abs(s) >= 20 || (t.t === `td` && ![`pat`, `two`].includes(this.setup.kind))) &&
      (this.bigPlay = true);
    this.report = {
      end: t,
      fouls: this.fouls,
      clockStops: r || this.turnover || this.fouls.length > 0,
      stats: this.stats,
      highlights: this.highlights,
      turnover: this.turnover,
      bigPlay: this.bigPlay,
      sack: this.sack,
      gain: s,
      scorer: this.scorer,
      hardHit: this.hardHit,
      outOfBounds: n === `oob`,
      fairCatch: n === `fair`,
      regained: this.regained,
    };
    for (let e of this.all) e.human || e.move.set(0, 0);
    a && (this.deadT = 0.6);
  }
  deadThink(e, t) {
    if (((e.turbo = false), (e.faceTarget = null), e.celebrate && !e.isDown)) {
      let t = this.scorer;
      if (t && e !== t && e.dist(t) > 2.2) {
        this.steer(e, t.pos.x, t.pos.z, 1.5, 0.8);
        return;
      }
      e.action !== `celebrate` && Math.random() < 0.05 && e.setAction(`celebrate`);
      e.move.set(0, 0);
      return;
    }
    e.move.multiplyScalar(0.92);
    e.throttle = 0.5;
    e.isDown && e.downT <= 0 && !e.ragdoll && this.deadT > 0.6 && e.getUp();
  }
  checkLateHits() {
    if (this.lateHitWindow <= 0) return;
    let e = this.env.ball;
    this.report && this.report.end.t === `dead` && this.all.find((t) => t.isDown && t.dist(e.pos) < 1.5);
    for (let e of this.all)
      if (!(!e.human || e.lateHitDone || e.isDown)) {
        for (let t of this.all)
          if (t.team !== e.team && t.active && e.dist(t) < 1.1 && (e.action === `dive` || e.turbo)) {
            e.lateHitDone = true;
            t.launch(t.pos.x - e.pos.x, t.pos.z - e.pos.z, 12);
            this.env.audio.play(`bighit`);
            this.env.rig.shake(0.7);
            this.env.fx.hitBurst(t.pos, [t.teamDef.colors.jersey, `#ffffff`], 1.2);
            this.env.hooks.splash(`LATE HIT!`, `big`);
            this.env.audio.crowd(0.8);
            let n = t === this.passer && this.passThrown;
            if (this.env.settings.penalties && Math.random() < (n ? 0.85 : 0.45) && this.report) {
              let r = n && e.team === this.D ? `roughingPasser` : `lateHit`;
              this.fouls.push({ kind: r, team: e.team, player: `#${e.info.num} ${e.info.last}` });
              this.env.fx.throwFlag(t.pos.clone().add(new THREE.Vector3(3, 0, 3)), t.pos);
              this.env.audio.play(`flag`);
              this.report.clockStops = true;
            }
            break;
          }
      }
  }
  abortPresnap() {
    this.phase === `presnap` &&
      (this.finish({ t: `dead`, z: this.setup.spotZ, x: this.setup.spotX, team: this.O }, `abort`, true),
      (this.report.aborted = true),
      (this.fouls.length = 0));
  }
  afterStep() {
    if (this.phase !== `live`) return;
    let e = this.meter;
    if (this.finishPending && this.liveT >= this.finishPending.t) {
      let e = this.finishPending.end;
      this.finishPending = null;
      this.finish(e, `kick`, true);
      return;
    }
    e && e.stage === 3 && this.isKickoff && this.env.ball.state === `placed` && this.kicker;
  }
  receiverBadges() {
    if (this.phase !== `live` && this.phase !== `presnap`) return [];
    let e = this.passer;
    return !e || !e.human || this.passThrown || this.env.ball.holder !== e || this.handoffDone
      ? this.phase === `presnap` && e?.human
        ? this.eligible.map((e, t) => ({ p: e, n: t + 1, targeted: false }))
        : []
      : this.eligible.map((e, t) => ({ p: e, n: t + 1, targeted: e === this.targeted }));
  }
  focusPoint(e) {
    let t = this.env.ball;
    return t.state === `held` && t.holder
      ? e.copy(t.holder.pos)
      : t.state === `air` && (t.kind === `pass` || t.kind === `kick` || t.kind === `punt` || t.kind === `fg`)
        ? e.set(t.pos.x * 0.5 + t.landing.x * 0.5, 0, t.pos.z * 0.55 + t.landing.z * 0.45)
        : e.set(t.pos.x, 0, t.pos.z);
  }
};
export const BLOCK_ROLES = new Set([`passBlock`, `runBlock`, `escort`, `returnBlock`, `jammer`]);
