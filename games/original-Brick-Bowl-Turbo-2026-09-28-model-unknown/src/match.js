import * as THREE from "three/webgpu";
import {
  cpuDefenseCall,
  cpuGoForTwo,
  cpuKickChoice,
  cpuOffenseCall,
  cpuReturnChoice,
  cpuWantsTimeout,
} from "./ai.js";
import { teamMaterials } from "./art.js";
import { FIELD, RULES } from "./config.js";
import { Ball } from "./physics.js";
import { PlaySession } from "./play.js";
import { Player } from "./player.js";
import { defensePlay, offensePlay } from "./plays.js";
import { Replay } from "./replay.js";
import {
  FOULS,
  adjudicate,
  applyFoul,
  downText,
  firstDownAt,
  goalToGo,
  other,
  penaltyBack,
  toGo,
  yardText,
} from "./rules.js";
import { TEAMS } from "./teams.js";
import { promptSet } from "./input.js";
import { recordChallenge, recordMatch } from "./records.js";

/** Slots that set up in a three-point stance before the snap. */
const STANCE3 = new Set([
  `LT`,
  `LG`,
  `C`,
  `RG`,
  `RT`,
  `DEL`,
  `DTL`,
  `DTR`,
  `DER`,
  `R1`,
  `R2`,
  `R3`,
  `R4`,
  `TEL`,
  `TER`,
]);
const _proj = new THREE.Vector3();

export const QuitSignal = class extends Error {};
export const emptyTeamStats = () => ({
  firstDowns: 0,
  totalYds: 0,
  passYds: 0,
  rushYds: 0,
  turnovers: 0,
  penalties: 0,
  penYds: 0,
  sacks: 0,
  top: 0,
  thirdAtt: 0,
  thirdConv: 0,
  plays: 0,
});
export const Match = class {
  gr;
  rig;
  stadium;
  fx;
  physics;
  audio;
  input;
  ui;
  squads;
  ball;
  replay = new Replay();
  settings;
  mode = `1p`;
  controllers = [null, null];
  session = null;
  inMatch = false;
  paused = false;
  timeScale = 1;
  slowT = 0;
  hitStopT = 0;
  timers = [];
  quitReject = null;
  quitPromise = new Promise(() => {});
  excite = 0.25;
  rings = [];
  tgtRing;
  aimArrow;
  focus = new THREE.Vector3();
  tmp = new THREE.Vector3();
  replayFocus = new THREE.Vector3();
  celebrating = null;
  scores = [0, 0];
  quarter = 1;
  quarterLen = 180;
  clock = 180;
  clockRunning = false;
  timeouts = [3, 3];
  dir = [1, -1];
  ds = firstDownAt(0, 25);
  ballX = 0;
  openingReceiver = 0;
  twoMinDone = false;
  twoMinPending = false;
  untimedDown = false;
  gameOver = false;
  ot = { active: false, first: 0, poss: [0, 0] };
  streak = [0, 0];
  onFire = [false, false];
  firePlays = [0, 0];
  turbo = [1, 1];
  teamStats = [emptyTeamStats(), emptyTeamStats()];
  playerStats = new Map();
  lastPlayText = ``;
  challenge = null; // a CLUTCH CHALLENGE from challenges.js, or null for a normal game
  challengeTeam = 0; // the team the player controls in a challenge
  restartRequested = false;
  waveT = 0; // seconds of crowd wave left
  constructor(e, t, n, r, i, a, o, s, c) {
    this.gr = e;
    this.rig = t;
    this.stadium = n;
    this.fx = r;
    this.physics = i;
    this.audio = a;
    this.input = o;
    this.ui = s;
    this.settings = c;
    let l = e.scene,
      u = [teamMaterials(TEAMS[0]), teamMaterials(TEAMS[1])];
    this.squads = [0, 1].map((e) => Array.from({ length: 11 }, () => new Player(e, TEAMS[e], u[e], i, l)));
    this.ball = new Ball(i, l);
    i.onBallContact = (e) => {
      e === `post`
        ? (this.audio.play(`doink`), this.ui.splash(`DOINK!`, `mid`))
        : this.ball.state === `loose` && this.ball.vel.length() > 3 && this.audio.play(`thud`, 0.3);
    };
    for (let e = 0; e < 2; e++) {
      let t = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.86, 28),
        new THREE.MeshBasicMaterial({
          color: TEAMS[e].colors.accent,
          transparent: true,
          opacity: 0.95,
          side: 2,
          depthWrite: false,
        }),
      );
      t.rotation.x = -Math.PI / 2;
      t.visible = false;
      l.add(t);
      this.rings.push(t);
    }
    this.tgtRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 4),
      new THREE.MeshBasicMaterial({
        color: `#ffe01a`,
        transparent: true,
        opacity: 0.9,
        side: 2,
        depthWrite: false,
      }),
    );
    this.tgtRing.rotation.x = -Math.PI / 2;
    this.tgtRing.visible = false;
    l.add(this.tgtRing);
    let d = new THREE.ConeGeometry(0.6, 3, 4);
    d.rotateX(Math.PI / 2);
    d.translate(0, 0, 3);
    this.aimArrow = new THREE.Mesh(
      d,
      new THREE.MeshBasicMaterial({ color: `#ffe01a`, transparent: true, opacity: 0.7 }),
    );
    this.aimArrow.visible = false;
    l.add(this.aimArrow);
    r.onFirework = () => this.audio.play(`firework`);
  }
  get hud() {
    return this.ui.hud;
  }
  step(e) {
    for (let t = this.timers.length - 1; t >= 0; t--) {
      let n = this.timers[t];
      n.t -= e;
      n.t <= 0 && (this.timers.splice(t, 1), n.res());
    }
    // Pause works any time during a game (coin toss, dialogs and replays included), not only mid-play.
    if (this.inMatch && !this.paused) {
      for (let e of this.controllers)
        if (e && e.consume(`pause`)) {
          this.openPause();
          return;
        }
      if (this.mode === `cpu` && (this.input.p1.consume(`pause`) || this.input.p1.consume(`action`))) {
        this.openPause();
        return;
      }
    }
    let t = this.session;
    if (!t || this.replay.playing) return;
    if (this.inMatch && !this.paused && t.phase === `presnap`)
      for (let e of [0, 1]) {
        let t = this.controllers[e];
        t && t.consume(`timeout`) && this.requestTimeout(e);
      }
    t.preStep(e);
    this.physics.step();
    t.postStep(e);
    let n = t.setup.kind,
      r =
        t.phase === `live` &&
        n !== `pat` &&
        n !== `two` &&
        (n !== `kickoff` || t.kickTouchedByR || this.ball.state === `held`),
      i = t.phase === `presnap` && this.clockRunning && n === `scrimmage` && t.timeoutRequest === null;
    this.inMatch && (r || i) && this.tickClock(e, t);
    t.phase === `live` && (this.teamStats[t.setup.offense].top += e);
    let a = t.phase === `presnap`;
    for (let n of [0, 1])
      for (let r of this.squads[n]) {
        if (!r.active) continue;
        let i;
        a && t.setup.kind !== `kickoff`
          ? STANCE3.has(r.slot)
            ? (i = `stance3`)
            : r === t.passer && t.passer && t.depthOf(r.pos.z) > -2
              ? (i = `qbset`)
              : (!r.human || r.vel.lengthSq() < 0.2) &&
                (i = r.slot === `P` || r.slot === `H` || r.slot === `K` ? `idle` : `stance2`)
          : a &&
            t.setup.kind === `kickoff` &&
            (i = r.slot === `K` ? `idle` : r.team === t.setup.offense ? `stance2` : `idle`);
        r.onFire = this.onFire[n];
        r.sync(e, i);
      }
    this.replay.record(this.ball);
    for (let e of [0, 1]) {
      if (!this.onFire[e]) continue;
      let n = t.carrier,
        r = t.controlled[e],
        i = n && n.team === e ? n : r;
      i && Math.random() < 0.8 && this.fx.fire(i.pos, i.vel);
    }
    for (let e of [0, 1]) {
      let n = t.controlled[e];
      n && n.turbo && Math.random() < 0.5 && this.fx.turboPuff(n.pos);
    }
    this.stadium.excitement.value += (this.excite - this.stadium.excitement.value) * 0.05;
    this.excite += ((this.onFire[0] || this.onFire[1] ? 0.5 : 0.22) - this.excite) * 0.01;
  }
  frame(e) {
    let t = this.session;
    this.replay.playing
      ? this.replay.update(e, this.ball, this.replayFocus) && this.rig.focus.copy(this.replayFocus)
      : t &&
        (this.celebrating
          ? this.rig.focus.copy(this.celebrating)
          : t.phase === `presnap`
            ? (this.tmp.set(
                t.setup.spotX,
                0,
                t.setup.spotZ + t.setup.dir * (t.setup.kind === `kickoff` ? 7 : 3),
              ),
              this.rig.focus.copy(this.tmp))
            : t.phase === `live` && (t.focusPoint(this.focus), this.rig.focus.lerp(this.focus, 1)));
    this.rig.update(e);
    // The crowd wave built into the stands' shader rolls while waveT runs (big moments).
    this.waveT = Math.max(0, this.waveT - e);
    const wave = this.stadium.wave;
    wave.value += ((this.waveT > 0 ? 1 : 0) - wave.value) * Math.min(1, e * 1.5);
    this.stadium.fadePosts(this.gr.camera.position.z);
    this.gr.focusShadows(this.rig.focus.x, this.rig.focus.z);
    this.stadium.update(e);
    this.fx.update(e);
    this.replay.playing || this.ball.render(e);
    this.updateMarkers(t);
    this.updateHud(t);
    this.stadium.jumbotron.update(e, {
      scores: this.scores,
      quarter: this.quarterName(),
      clock: this.clockText(),
      down: this.session && this.session.setup.kind === `scrimmage` ? downText(this.ds) : ``,
    });
  }
  updateMarkers(e) {
    let t = !!e && this.inMatch && !this.replay.playing && e.setup.kind === `scrimmage` && e.phase !== `done`;
    this.stadium.losLine.visible = t;
    this.stadium.firstDownLine.visible = t && !goalToGo(this.ds) && e.offPlay?.unit === `offense`;
    e &&
      t &&
      ((this.stadium.losLine.position.z = e.setup.spotZ),
      (this.stadium.firstDownLine.position.z = e.setup.lineToGainZ));
    for (let t = 0; t < 2; t++) {
      let n = e?.controlled[t],
        r = this.rings[t];
      if (((r.visible = !!n && !this.replay.playing && this.inMatch && e.phase !== `done`), n && r.visible)) {
        r.position.set(n.pos.x, 0.04, n.pos.z);
        let e = 1 + Math.sin(performance.now() / 120) * 0.08;
        r.scale.set(e, e, e);
      }
    }
    let n = e && e.targeted && e.receiverBadges().length ? e.targeted : null;
    this.tgtRing.visible = !!n && e.phase === `live`;
    n && (this.tgtRing.position.set(n.pos.x, 0.05, n.pos.z), (this.tgtRing.rotation.z += 0.05));
    let r = e?.meter;
    if (
      ((this.aimArrow.visible = !!r && r.stage < 3 && !!e && e.phase !== `done` && e.phase !== `dead`),
      r && e && this.aimArrow.visible)
    ) {
      e.setup.kind;
      let t = (e.setup.dir > 0 ? 0 : Math.PI) - r.aim * 0.22;
      this.aimArrow.position.set(this.ball.mesh.position.x, 0.1, this.ball.mesh.position.z);
      this.aimArrow.rotation.set(0, t, 0);
    }
  }
  project(e) {
    let t = _proj.copy(e).project(this.gr.camera);
    return { x: (t.x * 0.5 + 0.5) * window.innerWidth, y: (-t.y * 0.5 + 0.5) * window.innerHeight };
  }
  updateHud(e) {
    if (!this.inMatch) return;
    let t = [!!this.controllers[0], !!this.controllers[1]],
      n = [`P1`, `P1`];
    this.mode === `2p` &&
      ((n[0] = this.controllers[0] === this.input.p1 ? `P1` : `P2`),
      (n[1] = this.controllers[1] === this.input.p1 ? `P1` : `P2`));
    let r = (t) => {
        let n = e?.controlled[t];
        return n ? `#${n.info.num} ${n.info.last.toUpperCase()} · ${n.info.pos}` : ``;
      },
      i = e && (e.setup.kind === `scrimmage` || e.setup.kind === `two`),
      a = ``;
    if (
      (e && e.setup.kind === `scrimmage`
        ? (a = `${downText(this.ds)} · ${yardText(this.ds.ballOn)}`)
        : e && e.setup.kind === `two`
          ? (a = `TWO-POINT TRY`)
          : e && e.setup.kind === `pat`
            ? (a = `EXTRA POINT`)
            : e && e.setup.kind === `kickoff` && (a = e.setup.freeKick ? `FREE KICK` : `KICKOFF`),
      this.hud.update({
        teams: TEAMS,
        scores: this.scores,
        quarter: this.quarterName(),
        clock: this.clockText(),
        down: a,
        possession: e ? (i ? this.ds.offense : e.possession) : null,
        timeouts: this.timeouts,
        playClock: e && e.phase === `presnap` && e.setup.kind !== `kickoff` ? e.playClock : null,
        turbo: this.turbo,
        onFire: this.onFire,
        humans: t,
        humanLabels: n,
        controlled: [r(0), r(1)],
      }),
      e && !this.replay.playing)
    ) {
      let t = e.receiverBadges().map((e) => ({
        ...this.project(this.tmp.set(e.p.pos.x, 2.9, e.p.pos.z)),
        n: e.n,
        targeted: e.targeted,
      }));
      this.hud.setBadges(t);
      let n = e.controlled[0] ?? e.controlled[1];
      if (n && e.phase === `presnap`) {
        let e = this.project(this.tmp.set(n.pos.x, 2.6, n.pos.z));
        this.hud.setTag(`#${n.info.num} ${n.info.last.toUpperCase()}`, e.x, e.y);
      } else this.hud.setTag(null);
      let r = e.meter;
      this.hud.setKick(
        r && e.phase !== `dead` && e.phase !== `done` ? r : null,
        r ? promptSet(this.controllers[r.team] ?? this.input.p1, this.mode === `2p`).action : undefined,
      );
      this.hud.setHint(this.controlsHint(e));
    } else {
      this.hud.setBadges([]);
      this.hud.setTag(null);
      this.hud.setKick(null);
      this.hud.setHint(
        this.replay.playing
          ? `<span class="key">${promptSet(this.input.p1, this.mode === `2p`).action}</span> skip replay`
          : null,
      );
    }
    this.ui.fire(this.onFire.some((e, t) => e && !!this.controllers[t]));
  }
  controlsHint(e) {
    if (this.mode === `cpu`) return `<span class="key">${promptSet(this.input.p1).pause}</span> pause`;
    let t = this.controllers[e.setup.offense]
      ? e.setup.offense
      : this.controllers[other(e.setup.offense)]
        ? other(e.setup.offense)
        : null;
    if (t === null || this.mode === `2p`) return null;
    // Prompts follow the device in use: keyboard keys, gamepad buttons or the touch buttons.
    const P = promptSet(this.controllers[t]),
      K = (name) => (P[name] ? `<span class="key">${P[name]}</span>` : ``);
    let n = (e) =>
        e === `SPACE`
          ? K(`action`)
          : e === `E`
            ? K(`special`)
            : e === `SHIFT`
              ? K(`turbo`)
              : e === `T`
                ? K(`timeout`)
                : `<span class="key">${e}</span>`,
      r = t === e.setup.offense;
    if (e.phase === `presnap`)
      return e.meter && e.meter.team === t
        ? `${P.aim === `← →` ? `${n(`←`)}${n(`→`)}` : n(P.aim)} aim · ${n(`SPACE`)} ${e.setup.kind === `kickoff` ? `kick off` : `snap`}`
        : r && e.setup.kind === `kickoff`
          ? `${n(`SPACE`)} kick off`
          : e.setup.kind === `kickoff`
            ? `Kick incoming! Get under it · ${n(`SHIFT`)} turbo · in the end zone ${n(`E`)} = take a knee`
            : !r && e.offPlay?.unit === `punt`
              ? `Punt return: ${n(`E`)} while the ball is in the air = fair catch`
              : r
                ? `${n(`SPACE`)} hike · ${n(`E`)} hard count · ${n(`T`)} timeout`
                : `${n(`E`)} switch player · move to shift (don't jump offside!) · ${n(`T`)} timeout`;
    if (e.phase !== `live`) return null;
    let i = e.controlled[t];
    return i
      ? e.meter && e.meter.team === t && e.meter.stage < 3
        ? `${n(`SPACE`)} stop the meter`
        : this.ball.holder === i && i === e.passer && e.receiverBadges().length
          ? `${n(`SPACE`)} pass (hold = lob) · ${P.receivers ? `${n(P.receivers)} pick receiver` : `aim at a receiver`} · ${n(`SHIFT`)} turbo`
          : this.ball.holder === i
            ? `${n(`SPACE`)} spin · ${n(`E`)} hurdle · ${n(`SHIFT`)} turbo`
            : this.ball.state === `air`
              ? `${n(`SPACE`)} jump/dive · ${n(`E`)} ${i === e.returner ? `fair catch` : `switch`}`
              : `${n(`SPACE`)} dive tackle · ${n(`E`)} switch · ${n(`SHIFT`)} turbo`
      : null;
  }
  wait(e) {
    return this.guard(new Promise((t) => this.timers.push({ t: e, res: t })));
  }
  guard(e) {
    return Promise.race([e, this.quitPromise]);
  }
  slowmo(e, t = 0.35) {
    this.slowT = e;
    this.timeScale = t;
  }
  hitStop() {
    this.hitStopT = 0.09;
  }
  updateTimeScale(e) {
    if (this.paused) return 0; // a hit-stop in progress must not keep the game stepping under the pause menu
    return this.hitStopT > 0
      ? ((this.hitStopT -= e), 0.03)
      : (this.slowT > 0 && ((this.slowT -= e), this.slowT <= 0 && (this.timeScale = 1)),
        this.paused ? 0 : this.timeScale);
  }
  async openPause() {
    if (this.paused || !this.inMatch) return;
    this.paused = true;
    this.audio.play(`back`);
    // The press that opened the menu must not also act in it, and screens underneath
    // (play select, coin toss, dialogs) stop running until the menu closes.
    this.input.flush();
    this.ui.freeze(true);
    let e = await this.ui.pauseMenu(this.settings, !!this.challenge);
    this.ui.freeze(false);
    this.input.flush(); // ...and the RESUME press must not snap the ball or dive.
    this.applySettings();
    this.paused = false;
    if (e === `quit`) this.quit();
    else if (e === `restart`) {
      this.restartRequested = true;
      this.quit();
    }
  }
  quit() {
    this.inMatch = false;
    this.quitReject?.(new QuitSignal(`quit`));
  }
  applySettings() {
    this.audio.setVolumes(this.settings.music, this.settings.sfx, this.settings.announcer);
    this.gr.setBloom(this.settings.bloom);
  }
  quarterName() {
    return this.quarter >= 5 ? `OT` : [`1ST`, `2ND`, `3RD`, `4TH`][this.quarter - 1];
  }
  clockText() {
    let e = Math.max(0, Math.ceil(this.clock));
    return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, `0`)}`;
  }
  crossedTwoMin(e) {
    return (
      (this.quarter === 2 || this.quarter === 4) &&
      this.quarterLen > 150 &&
      !this.twoMinDone &&
      e > 120 &&
      this.clock <= 120 &&
      ((this.twoMinDone = true), (this.twoMinPending = true), true)
    );
  }
  huddleRunoff() {
    if (!this.clockRunning) return;
    let e = this.clock;
    this.clock -= Math.max(0, Math.min(RULES.HUDDLE_RUNOFF, this.clock - 1));
    this.crossedTwoMin(e) && this.twoMinuteCheck();
  }
  tickClock(e, t) {
    let n = this.clock;
    this.clock = Math.max(0, this.clock - e);
    this.crossedTwoMin(n) &&
      t.phase === `presnap` &&
      ((this.clockRunning = false),
      this.ui.banner(`TWO MINUTE WARNING`, `${this.quarterName()} QUARTER`),
      this.stadium.jumbotron.flash(`2:00 WARNING`, 3),
      (this.twoMinPending = false));
    this.clock <= 0 && t.phase === `presnap` && t.abortPresnap();
  }
  requestTimeout(e) {
    return this.timeouts[e] <= 0
      ? (this.ui.splash(`NO TIMEOUTS LEFT`, `small`), false)
      : (this.timeouts[e]--,
        (this.clockRunning = false),
        this.session && this.session.phase === `presnap` && (this.session.playClock = RULES.PLAY_CLOCK),
        this.audio.play(`whistle`),
        this.ui.banner(
          `TIMEOUT`,
          `${TEAMS[e].name.toUpperCase()} · ${this.timeouts[e]} LEFT`,
          TEAMS[e].colors.accent,
        ),
        this.audio.say(`Timeout, ${TEAMS[e].name}.`),
        true);
  }
  configure(e, t) {
    this.mode = e;
    let n = this.input.p1,
      r = this.input.p2;
    this.input.setTwoPlayer(e === `2p`);
    this.controllers =
      e === `1p`
        ? t === 0
          ? [n, null]
          : [null, n]
        : e === `2p`
          ? t === 0
            ? [n, r]
            : [r, n]
          : [null, null];
  }
  resetMatch() {
    this.scores = [0, 0];
    this.quarter = 1;
    this.quarterLen = this.settings.quarterMinutes * 60;
    this.clock = this.quarterLen;
    this.clockRunning = false;
    this.timeouts = [RULES.TIMEOUTS_PER_HALF, RULES.TIMEOUTS_PER_HALF];
    this.dir = [1, -1];
    this.twoMinDone = false;
    this.twoMinPending = false;
    this.untimedDown = false;
    this.gameOver = false;
    this.ot = { active: false, first: 0, poss: [0, 0] };
    this.streak = [0, 0];
    this.onFire = [false, false];
    this.firePlays = [0, 0];
    this.turbo = [1, 1];
    this.teamStats = [emptyTeamStats(), emptyTeamStats()];
    this.playerStats.clear();
    this.quitPromise = new Promise((e, t) => (this.quitReject = t));
    this.quitPromise.catch(() => {});
    this.timers.length = 0;
  }
  env() {
    return {
      teams: TEAMS,
      squads: this.squads,
      ball: this.ball,
      fx: this.fx,
      audio: this.audio,
      rig: this.rig,
      controllers: this.controllers,
      settings: this.settings,
      turbo: this.turbo,
      onFire: this.onFire,
      urgent: [this.urgent(0), this.urgent(1)],
      hooks: {
        splash: (e, t, n) => this.ui.splash(e, t, n),
        say: (e, t) => this.audio.say(e, { priority: t }),
        slowmo: (e, t) => this.slowmo(e, t),
        hitStop: () => this.hitStop(),
        rumble: (team, strength, ms) => this.controllers[team]?.rumble(strength, ms),
      },
    };
  }
  urgent(e) {
    let t = this.scores[e] - this.scores[other(e)],
      n = (this.quarter === 4 || this.quarter === 5) && this.clock < Math.min(150, this.quarterLen * 0.6),
      r = this.quarter === 2 && this.clock < Math.min(60, this.quarterLen * 0.3);
    return (n && t <= 0) || r;
  }
  situation(e) {
    let t = this.ds.offense === e;
    return {
      down: this.ds.down,
      toGo: toGo(this.ds),
      ballOn: this.ds.ballOn,
      diff: this.scores[this.ds.offense] - this.scores[other(this.ds.offense)],
      quarter: this.quarter,
      clock: this.clock,
      quarterLen: this.quarterLen,
      clockRunning: this.clockRunning,
      timeouts: this.timeouts[t ? e : this.ds.offense],
      kickerPower: TEAMS[this.ds.offense].roster.find((e) => e.pos === `K`).r.kpw,
    };
  }
  zOf(t, n) {
    return (n - FIELD.GOAL) * this.dir[t];
  }
  yardOf(t, n) {
    return n * this.dir[t] + FIELD.GOAL;
  }
  hashX(t) {
    return Math.max(-FIELD.HASH, Math.min(FIELD.HASH, t));
  }
  async runSession(e, t = false) {
    this.fx.clearFlags();
    let n = new PlaySession(this.env(), e);
    return (
      (n.bleedClock = t),
      (this.session = n),
      this.replay.begin([...n.off, ...n.def]),
      (this.rig.mode = `play`),
      this.rig.setDir(e.dir, false),
      (this.rig.targetZoom = e.kind === `kickoff` ? 1.25 : n.offPlay?.kind === `punt` ? 1.15 : 1),
      await this.guard(n.done)
    );
  }
  async playMatch() {
    this.resetMatch();
    this.applySettings();
    this.restartRequested = false;
    this.inMatch = true;
    this.ui.hud.show(true);
    try {
      let t;
      if (this.challenge) t = await this.challengeStart(this.challenge);
      else {
        await this.intro();
        let e = await this.coinToss(false);
        this.openingReceiver = e;
        t = { t: `kickoff`, kicker: other(e) };
      }
      for (
        ;
        t.t === `kickoff`
          ? (t = await this.kickoffFlow(t.kicker, !!t.free))
          : t.t === `down`
            ? (t = await this.downFlow())
            : t.t === `conv` && (t = await this.conversionFlow(t.team)),
          !(this.gameOver || t.t === `over`);
      )
        if (this.clock <= 0 && t.t !== `conv`) {
          if (this.untimedDown) {
            this.untimedDown = false;
            this.ui.banner(`UNTIMED DOWN`, `The half cannot end on a defensive foul`);
            continue;
          }
          if (((t = await this.endOfQuarter(t)), this.gameOver)) break;
        }
      return this.challenge ? await this.challengeResult(this.challenge) : await this.finalScreen();
    } catch (e) {
      if (e instanceof QuitSignal) {
        this.ui.clearScreens();
        return this.restartRequested ? `again` : `menu`;
      }
      throw e;
    } finally {
      this.inMatch = false;
      this.paused = false;
      this.ui.hud.show(false);
      this.ui.replayMode(false);
      this.ui.fire(false);
      this.replay.stop();
      this.celebrating = null;
      // Clear the field so the menus fly over an empty stadium instead of an abandoned play.
      this.session = null;
      for (let e of [0, 1]) for (let t of this.squads[e]) t.setActive(false);
      this.ball.placeAt(0, 0.35, 0);
      this.fx.clearFlags();
      this.rig.mode = `menu`;
    }
  }
  /** Set up a CLUTCH CHALLENGE: 4th quarter, custom score, clock, spot and timeouts. */
  async challengeStart(ch) {
    const h = this.challengeTeam,
      o = other(h);
    this.session = null;
    for (let e of [0, 1]) for (let t of this.squads[e]) t.setActive(false);
    this.ball.placeAt(0, 0.35, 0);
    this.scores[h] = ch.you;
    this.scores[o] = ch.them;
    this.quarter = 4;
    this.quarterLen = 300; // CPU clock management reads the quarter length; play it like a 5-minute quarter
    this.clock = ch.clock;
    this.clockRunning = false;
    this.timeouts[h] = ch.myTO;
    this.timeouts[o] = ch.theirTO;
    this.dir = [-1, 1]; // 4th-quarter ends, as in a full game
    this.twoMinDone = ch.clock <= 120;
    const off = ch.side === `offense` ? h : o;
    this.ds = {
      offense: off,
      ballOn: ch.ballOn,
      down: ch.down ?? 1,
      lineToGain: ch.goal ? 100 : Math.min(100, ch.ballOn + (ch.toGo ?? 10)),
    };
    this.ballX = 0;
    this.openingReceiver = o;
    this.rig.mode = `menu`;
    this.audio.crowd(0.9);
    this.excite = 0.8;
    this.waveT = 3;
    this.stadium.jumbotron.flash(ch.name, 4);
    this.ui.banner(ch.name, ch.brief, TEAMS[h].colors.accent);
    this.audio.say(ch.desc, { priority: true });
    this.audio.play(`horn`);
    await this.wait(3.4);
    return { t: `down` };
  }
  async challengeResult(ch) {
    this.inMatch = false;
    const h = this.challengeTeam,
      o = other(h),
      margin = this.scores[h] - this.scores[o],
      won = margin > 0,
      res = recordChallenge(ch.id, won, margin);
    this.audio.play(won ? `td` : `buzzer`);
    this.excite = won ? 1 : 0.3;
    if (won) {
      this.waveT = 6;
      this.fx.launchFireworks(16, [TEAMS[h].colors.jersey, TEAMS[h].colors.trim, `#ffffff`, `#ffd23f`]);
      this.fx.confetti(new THREE.Vector3(0, 0, 0), [TEAMS[h].colors.jersey, TEAMS[h].colors.trim, `#ffffff`]);
      this.audio.say(`Challenge complete! What a finish!`, { priority: true });
    } else
      this.audio.say(margin === 0 ? `A tie is not enough. Challenge failed.` : `Challenge failed.`, {
        priority: true,
      });
    this.rig.mode = `menu`;
    this.ui.hud.show(false);
    await new Promise((e) => setTimeout(e, 1500));
    const note = won
      ? res.first
        ? `★ FIRST CLEAR! ★`
        : res.best
          ? `★ NEW BEST MARGIN: +${margin} ★`
          : `CLEARED AGAIN · ATTEMPT ${res.tries}`
      : margin === 0
        ? `TIED — CHALLENGES NEED A WIN · ATTEMPT ${res.tries}`
        : `ATTEMPT ${res.tries} · TRY AGAIN!`;
    const html =
      this.statsHtml(won ? `CHALLENGE COMPLETE!` : `CHALLENGE FAILED`) +
      `<div class="mvp">${ch.name} · ${note}</div>`;
    return (await this.ui.stats(`final`, html, true, [`RETRY`, `CHALLENGES`])) === `again` ? `again` : `menu`;
  }
  async intro() {
    this.session = null;
    for (let e of [0, 1]) for (let t of this.squads[e]) t.setActive(false);
    this.ball.placeAt(0, 0.35, 0);
    this.rig.mode = `menu`;
    this.audio.crowd(0.9);
    this.excite = 0.8;
    this.ui.banner(
      `${TEAMS[0].name.toUpperCase()} VS ${TEAMS[1].name.toUpperCase()}`,
      `LIVE FROM MEGABLOCK STADIUM`,
    );
    this.audio.say(
      `Welcome to Megablock Stadium! It's the ${TEAMS[0].city} ${TEAMS[0].name} against the ${TEAMS[1].city} ${TEAMS[1].name}!`,
      { priority: true },
    );
    this.stadium.jumbotron.flash(`GAME DAY!`, 3);
    this.fx.launchFireworks(10, [
      TEAMS[0].colors.jersey,
      TEAMS[0].colors.trim,
      TEAMS[1].colors.jersey,
      TEAMS[1].colors.trim,
    ]);
    this.audio.play(`horn`);
    this.waveT = 3.5;
    await this.wait(3.2);
  }
  async coinToss(e) {
    this.rig.mode = `toss`;
    this.rig.focus.set(0, 0, 0);
    let { call: t, result: n } = await this.guard(this.ui.coinToss(`${TEAMS[1].name}`, this.controllers[1])),
      r = t === n ? 1 : other(1),
      i = e ? [`RECEIVE`, `KICK`] : [`RECEIVE`, `DEFER (KICK)`],
      a = await this.guard(
        this.ui.choose(
          `${TEAMS[r].name.toUpperCase()} WIN THE TOSS`,
          `What will you do?`,
          i,
          this.controllers[r],
          () => +!e,
        ),
      ),
      o = a === 0 ? r : other(r);
    return (this.audio.say(`${TEAMS[r].name} win the toss and will ${a === 0 ? `receive` : `kick`}.`), o);
  }
  async endOfQuarter(e) {
    let t = this.quarter;
    if ((this.audio.play(`buzzer`), (this.clockRunning = false), t === 1 || t === 3))
      return (
        this.ui.banner(
          `END OF ${this.quarterName()} QUARTER`,
          `${TEAMS[0].abbr} ${this.scores[0]} · ${TEAMS[1].abbr} ${this.scores[1]}`,
        ),
        await this.wait(2.5),
        this.quarter++,
        (this.clock = this.quarterLen),
        (this.dir = [this.dir[0] * -1, this.dir[1] * -1]),
        (this.ballX = -this.ballX),
        e
      );
    if (t === 2)
      return (
        this.ui.banner(`HALFTIME`, `${TEAMS[0].abbr} ${this.scores[0]} · ${TEAMS[1].abbr} ${this.scores[1]}`),
        this.audio.say(`That is the end of the first half!`),
        await this.wait(2.2),
        this.ui.hud.show(false),
        await this.guard(this.ui.stats(`half`, this.statsHtml(`HALFTIME`), false)),
        this.ui.hud.show(true),
        (this.quarter = 3),
        (this.clock = this.quarterLen),
        (this.timeouts = [RULES.TIMEOUTS_PER_HALF, RULES.TIMEOUTS_PER_HALF]),
        (this.twoMinDone = false),
        (this.dir = [1, -1]),
        { t: `kickoff`, kicker: this.openingReceiver }
      );
    if (t === 4 && this.scores[0] === this.scores[1] && !this.challenge) {
      this.ui.banner(`OVERTIME!`, `Both teams get the ball — then sudden death`);
      this.audio.say(`We are going to overtime!`, { priority: true });
      await this.wait(2.8);
      this.quarter = 5;
      this.clock = Math.max(60, Math.round((this.quarterLen * 2) / 3));
      this.timeouts = [2, 2];
      this.twoMinDone = false;
      this.dir = [1, -1];
      let e = await this.coinToss(true);
      return ((this.ot = { active: true, first: e, poss: [0, 0] }), { t: `kickoff`, kicker: other(e) });
    }
    return ((this.gameOver = true), { t: `over` });
  }
  async selectPlays(e, t) {
    let n = e.some((e) => e.ctrl);
    if (((this.rig.mode = `play`), !n)) return (await this.wait(0.8), [e[0].cpuPick(), e[1].cpuPick()]);
    this.ui.hud.show(false);
    let i = await this.guard(this.ui.playSelect(e, t, RULES.PLAY_SELECT_TIME, (e) => this.requestTimeout(e)));
    return (this.ui.hud.show(true), i);
  }
  situationText() {
    return `${TEAMS[this.ds.offense].abbr} BALL · ${downText(this.ds)} · ${yardText(this.ds.ballOn)} · ${this.quarterName()} ${this.clockText()}`;
  }
  async downFlow() {
    let e = this.ds.offense,
      t = other(e),
      n = this.situation(e),
      r = window.__force,
      i = [
        {
          team: e,
          ctrl: this.controllers[e],
          kind: `offense`,
          cpuPick: () => {
            let e = cpuOffenseCall(n);
            return { id: r?.off ?? e.play.id, flip: e.flip };
          },
        },
        {
          team: t,
          ctrl: this.controllers[t],
          kind: `defense`,
          cpuPick: () => {
            let e = cpuDefenseCall(n);
            return { id: r?.def ?? e.play.id, flip: e.flip };
          },
        },
      ],
      [a, o] = await this.selectPlays(i, this.situationText());
    this.huddleRunoff();
    let s = offensePlay(a.id),
      c = {
        kind: `scrimmage`,
        offense: e,
        dir: this.dir[e],
        spotZ: this.zOf(e, this.ds.ballOn),
        spotX: this.ballX,
        lineToGainZ: this.zOf(e, Math.min(100, this.ds.lineToGain)),
        down: this.ds.down,
        offCall: { play: s, flip: a.flip },
        defCall: { play: defensePlay(o.id), flip: o.flip },
        kickChoice: `deep`,
        returnChoice: `return`,
      },
      l = this.scores[e] - this.scores[t],
      u = !this.controllers[e] && l > 0 && (this.quarter >= 4 || this.quarter === 2) && this.clockRunning,
      d = { ...this.ds },
      f = await this.runSession(c, u);
    return f.aborted ? { t: `down` } : await this.afterScrimmage(f, d, c);
  }
  toRulesEnd(e, t) {
    let n = e.end;
    switch (n.t) {
      case `dead`:
        return { type: `dead`, spot: this.yardOf(t, n.z), possession: n.team };
      case `incomplete`:
        return { type: `incomplete` };
      case `td`:
        return { type: `td`, team: n.team };
      case `safety`:
        return { type: `safety`, against: n.against };
      case `touchback`:
        return { type: `touchback`, team: n.team };
      default:
        return { type: `incomplete` };
    }
  }
  async afterScrimmage(e, t, n) {
    let r = t.offense,
      i = other(r),
      a = n.offCall.play;
    this.applyStats(e);
    let o = this.teamStats[r];
    o.plays++;
    t.down === 3 && o.thirdAtt++;
    await this.wait(0.2);
    let s,
      c = e.fouls.find((e) => FOULS[e.kind].deadBall),
      l = a.kind === `punt`,
      u = l ? e.fouls.filter((e) => e.kind === `illegalBlock`) : [],
      d = e.fouls.filter((e) => !u.includes(e));
    if (!c && (e.end.t === `fgGood` || e.end.t === `fgMiss`)) {
      if (e.end.t === `fgGood`)
        return (
          (this.clockRunning = false),
          await this.score(r, 3, `fg`, e),
          this.otPossessionEnd(r),
          this.gameOver ? { t: `over` } : { t: `kickoff`, kicker: r }
        );
      let t = Math.max(20, this.yardOf(i, e.end.z));
      return (
        (this.ds = firstDownAt(i, t)),
        (this.ballX = 0),
        (this.clockRunning = false),
        this.otPossessionEnd(r),
        this.resetStreaksOnChange(r),
        this.gameOver ? { t: `over` } : { t: `down` }
      );
    }
    if (e.end.t === `td` && e.end.team === i && u.length && this.settings.penalties) {
      let t = u[0],
        n = t.spot === undefined ? 50 : 100 - t.spot;
      e.end = { t: `dead`, z: this.zOf(i, penaltyBack(n, 10)), x: 0, team: i };
      u.length = 0;
      this.ui.penaltyCard(
        `FLAG!`,
        [`ILLEGAL BLOCK IN THE BACK`, `${TEAMS[i].name} · ${t.player ?? ``}`],
        `TOUCHDOWN NULLIFIED · 10 YDS`,
      );
      this.ui.splash(`NO TOUCHDOWN!`, `bad`);
    }
    let f = this.toRulesEnd(e, r);
    if (
      ((s =
        (e.end.t === `dead` && e.end.team === r && e.regained && !e.end.firstDown) ||
        (e.end.t === `dead` && e.end.firstDown && e.end.team === r)
          ? {
              next: firstDownAt(r, this.yardOf(r, e.end.z)),
              score: null,
              firstDown: true,
              turnoverOnDowns: false,
              possessionChanged: false,
              replayDown: false,
              penaltyText: [],
              acceptedFouls: [],
              declinedFouls: [],
              offsetting: false,
            }
          : e.end.t === `touchback` && l
            ? {
                next: firstDownAt(e.end.team, e.end.yard),
                score: null,
                firstDown: false,
                turnoverOnDowns: false,
                possessionChanged: true,
                replayDown: false,
                penaltyText: [],
                acceptedFouls: [],
                declinedFouls: [],
                offsetting: false,
              }
            : adjudicate(t, f, this.settings.penalties ? d : d.filter((e) => e.kind === `delay`))),
      u.length && s.next && s.next.offense === i && this.settings.penalties)
    ) {
      let e = u[0],
        t = 100 - (e.spot ?? 100 - s.next.ballOn),
        n = Math.min(s.next.ballOn, t);
      s.next = firstDownAt(i, penaltyBack(n, 10));
      s.acceptedFouls.push(e);
      s.penaltyText.push(`${FOULS[e.kind].name} — Return team`);
    }
    e.fouls.length &&
      (s.acceptedFouls.length || s.declinedFouls.length || s.offsetting) &&
      this.showPenalties(s, t);
    !e.turnover &&
      (e.end.t === `dead` || e.end.t === `td`) &&
      !s.acceptedFouls.some((e) => !FOULS[e.kind].postPlay) &&
      ((o.totalYds += e.gain),
      e.stats.some((e) => e.key === `passComp`)
        ? (o.passYds += e.gain)
        : e.stats.some((e) => e.key === `rushAtt`)
          ? (o.rushYds += e.gain)
          : e.sack && (o.passYds += e.gain));
    e.sack && this.teamStats[i].sacks++;
    for (let e of s.acceptedFouls) {
      this.teamStats[e.team].penalties++;
      this.teamStats[e.team].penYds += FOULS[e.kind].yards || 15;
    }
    let p =
      e.clockStops ||
      !!s.score ||
      s.possessionChanged ||
      s.acceptedFouls.length > 0 ||
      e.end.t === `incomplete`;
    if (
      ((this.clockRunning = !p),
      this.clock <= 0 &&
        s.acceptedFouls.some((e) => e.team === i && !FOULS[e.kind].postPlay) &&
        !s.score &&
        (this.untimedDown = true),
      e.turnover && this.teamStats[e.end.t === `dead` && e.end.team === r ? i : r].turnovers++,
      this.updateFire(r, e, s),
      s.score)
    ) {
      let t = s.score;
      if (t.type === `td`)
        return (
          await this.score(t.team, 6, `td`, e),
          t.team !== r && this.otPossessionEnd(r),
          this.gameOver ? { t: `over` } : { t: `conv`, team: t.team }
        );
      if (t.type === `safety`)
        return (
          await this.score(t.team, 2, `safety`, e),
          this.otPossessionEnd(r),
          this.gameOver ? { t: `over` } : { t: `kickoff`, kicker: other(t.team), free: true }
        );
    }
    if (s.next) {
      let n = s.next.offense !== r;
      if (
        ((this.ds = s.next),
        e.end.t === `dead` && !s.acceptedFouls.length && (this.ballX = this.hashX(e.end.x)),
        n)
      ) {
        if ((this.otPossessionEnd(r), this.gameOver)) return { t: `over` };
        s.turnoverOnDowns &&
          (this.ui.splash(`TURNOVER ON DOWNS`, `bad`),
          this.audio.say(`They come up short! Turnover on downs!`));
        this.resetStreaksOnChange(r);
      } else
        s.firstDown && !s.acceptedFouls.length
          ? (o.firstDowns++,
            t.down === 3 && o.thirdConv++,
            this.ui.splash(`FIRST DOWN!`, `mid`),
            Math.random() < 0.35 &&
              this.audio.say(
                [`First down!`, `Moving the chains!`, `And that is a first down.`][
                  Math.floor(Math.random() * 3)
                ],
              ),
            this.audio.crowd(0.6))
          : s.firstDown && o.firstDowns++;
    }
    return (
      (e.bigPlay || e.hardHit || e.turnover) && (await this.maybeReplay(e)),
      await this.wait(0.3),
      this.twoMinuteCheck(),
      await this.cpuTimeouts(),
      { t: `down` }
    );
  }
  showPenalties(e, t) {
    let n = [],
      r = [...e.acceptedFouls, ...e.declinedFouls];
    for (let e of r) {
      n.push(`${FOULS[e.kind].name.toUpperCase()}`);
      n.push(
        `${TEAMS[e.team].name}${e.player ? ` · ${e.player}` : ``}${e.team === t.offense ? ` (offense)` : ` (defense)`}`,
      );
    }
    let i = ``;
    if (e.offsetting) i = `OFFSETTING · REPLAY THE DOWN`;
    else if (e.acceptedFouls.length) {
      let n = e.acceptedFouls[0],
        r = FOULS[n.kind];
      i = `ACCEPTED${r.yards ? ` · ${r.yards} YDS` : ` · SPOT FOUL`}${r.autoFirst && n.team !== t.offense ? ` · AUTO 1ST DOWN` : ``}${r.lossOfDown ? ` · LOSS OF DOWN` : ``}`;
    } else i = `DECLINED`;
    e.next && !e.score && (i += ` → ${downText(e.next)}`);
    this.ui.penaltyCard(`FLAG!`, n.slice(0, 4), i);
    this.audio.say(
      `Flag on the play. ${FOULS[(e.acceptedFouls[0] ?? e.declinedFouls[0]).kind].name}${e.offsetting ? `, offsetting` : e.acceptedFouls.length ? `` : `, declined`}.`,
    );
  }
  twoMinuteCheck() {
    this.twoMinPending &&
      ((this.twoMinPending = false),
      (this.clockRunning = false),
      this.ui.banner(`TWO MINUTE WARNING`, `${this.quarterName()} QUARTER`),
      this.stadium.jumbotron.flash(`2:00 WARNING`, 3),
      this.audio.say(`Two minute warning.`));
  }
  async cpuTimeouts() {
    if (!this.clockRunning || this.clock <= 0) return;
    let e = this.ds.offense;
    for (let t of [e, other(e)])
      if (
        !this.controllers[t] &&
        cpuWantsTimeout({
          isOffense: t === e,
          diff: this.scores[t] - this.scores[other(t)],
          quarter: this.quarter,
          clock: this.clock,
          timeouts: this.timeouts[t],
          quarterLen: this.quarterLen,
          clockRunning: this.clockRunning,
        })
      ) {
        this.requestTimeout(t);
        await this.wait(1.2);
        return;
      }
  }
  async kickoffFlow(e, t) {
    let n = other(e),
      i = this.scores[e] - this.scores[n],
      a = [
        {
          team: e,
          ctrl: this.controllers[e],
          kind: `kickoff`,
          cpuPick: () => ({ id: cpuKickChoice(i, this.quarter, this.clock, this.quarterLen), flip: false }),
        },
        {
          team: n,
          ctrl: this.controllers[n],
          kind: `kickret`,
          cpuPick: () => ({ id: cpuReturnChoice(i, this.quarter, this.clock, this.quarterLen), flip: false }),
        },
      ];
    this.ds = firstDownAt(e, t ? RULES.SAFETY_FREE_KICK : RULES.KICKOFF_SPOT);
    let [o, s] = await this.selectPlays(
        a,
        `${TEAMS[e].abbr} ${t ? `FREE KICK` : `KICKOFF`} · ${this.quarterName()} ${this.clockText()}`,
      ),
      c = {
        kind: `kickoff`,
        offense: e,
        dir: this.dir[e],
        spotZ: this.zOf(e, t ? RULES.SAFETY_FREE_KICK : RULES.KICKOFF_SPOT),
        spotX: 0,
        lineToGainZ: 0,
        down: 1,
        offCall: null,
        defCall: null,
        kickChoice: o.id,
        returnChoice: s.id,
        freeKick: t,
      },
      l = await this.runSession(c);
    if (l.aborted) return { t: `kickoff`, kicker: e, free: t };
    this.applyStats(l);
    this.clockRunning = false;
    this.ballX = 0;
    let u = l.fouls.find((e) => e.kind === `illegalBlock` && e.team === n);
    if (l.end.t === `td` && l.end.team === n && u && this.settings.penalties) {
      let e = u.spot === undefined ? 50 : 100 - u.spot;
      l.end = { t: `dead`, z: this.zOf(n, penaltyBack(e, 10)), x: 0, team: n };
      l.fouls = l.fouls.filter((e) => e !== u);
      this.ui.penaltyCard(
        `FLAG!`,
        [`ILLEGAL BLOCK IN THE BACK`, `${TEAMS[n].name} · ${u.player ?? ``}`],
        `TOUCHDOWN NULLIFIED · 10 YDS`,
      );
      this.ui.splash(`NO TOUCHDOWN!`, `bad`);
    }
    let d = l.end;
    switch (d.t) {
      case `td`:
        return (
          this.updateFire(n, l, null),
          await this.score(d.team, 6, `td`, l),
          this.gameOver ? { t: `over` } : { t: `conv`, team: d.team }
        );
      case `safety`:
        return (
          await this.score(other(d.against), 2, `safety`, l),
          this.gameOver ? { t: `over` } : { t: `kickoff`, kicker: d.against, free: true }
        );
      case `touchback`:
        this.ds = firstDownAt(d.team, RULES.KICKOFF_TOUCHBACK);
        break;
      case `kickoffOOB`:
        this.ds = firstDownAt(n, RULES.KICKOFF_OOB);
        this.ui.penaltyCard(
          `FLAG!`,
          [`KICKOFF OUT OF BOUNDS`, `${TEAMS[e].name}`],
          `BALL AT THE ${TEAMS[n].abbr} 40`,
        );
        break;
      case `dead`: {
        let t = this.yardOf(d.team, d.z),
          n = l.fouls.find((e) => e.kind === `illegalBlock` && e.team === d.team);
        if (n && this.settings.penalties) {
          let r = n.spot === undefined ? t : d.team === e ? n.spot : 100 - n.spot;
          t = penaltyBack(Math.min(t, r), 10);
          this.ui.penaltyCard(
            `FLAG!`,
            [`ILLEGAL BLOCK IN THE BACK`, `${TEAMS[d.team].name} · ${n.player ?? ``}`],
            `ACCEPTED · 10 YARDS`,
          );
        }
        this.ds = firstDownAt(d.team, t);
        this.ballX = this.hashX(d.x);
        d.team === e &&
          (this.ui.banner(`ONSIDE RECOVERED!`, `${TEAMS[e].name.toUpperCase()} BALL`),
          this.updateFire(e, l, null));
        break;
      }
      default:
        this.ds = firstDownAt(n, RULES.KICKOFF_TOUCHBACK);
    }
    return (
      (l.bigPlay || l.hardHit) && (await this.maybeReplay(l)),
      await this.wait(0.4),
      this.twoMinuteCheck(),
      { t: `down` }
    );
  }
  async conversionFlow(e) {
    let t = other(e),
      n = this.scores[e] - this.scores[t],
      i = this.controllers[e];
    this.ui.hud.show(false);
    let a = await this.guard(
      this.ui.choose(
        `TRY FOR POINT`,
        `${TEAMS[e].name} lead${n < 0 ? ` — trailing` : ``} ${this.scores[e]}–${this.scores[t]}`,
        [`KICK THE EXTRA POINT (1)`, `GO FOR TWO (2)`],
        i,
        () => +!!cpuGoForTwo(n, this.quarter, this.clock, this.quarterLen),
      ),
    );
    this.ui.hud.show(true);
    let o = a === 1,
      s = { offense: e, ballOn: o ? 100 - RULES.TWO_PT_SPOT : 100 - RULES.XP_SPOT, down: 1, lineToGain: 100 },
      c = `fail`,
      l = o ? 2 : 1;
    for (let n = 0; n < 4; n++) {
      let n = { id: `fg`, flip: false },
        r = { id: `fg-block`, flip: false };
      if (o) {
        this.ds = s;
        let i = this.situation(e);
        i.down = 4;
        let a = [
          {
            team: e,
            ctrl: this.controllers[e],
            kind: `offense`,
            cpuPick: () => {
              let e = cpuOffenseCall(i);
              return (
                [`punt`, `fg`, `kneel`, `spike`, `fake-punt`, `fake-fg`].includes(e.play.id) &&
                  (e = { play: offensePlay(`slants`), flip: e.flip }),
                { id: e.play.id, flip: e.flip }
              );
            },
          },
          {
            team: t,
            ctrl: this.controllers[t],
            kind: `defense`,
            cpuPick: () => ({ id: Math.random() < 0.5 ? `goal-line` : `man1`, flip: Math.random() < 0.5 }),
          },
        ];
        [n, r] = await this.selectPlays(a, `${TEAMS[e].abbr} TWO-POINT TRY`);
        [`punt`, `kneel`, `spike`].includes(n.id) && (n = { id: `slants`, flip: n.flip });
      }
      let i = {
          kind: o ? `two` : `pat`,
          offense: e,
          dir: this.dir[e],
          spotZ: this.zOf(e, s.ballOn),
          spotX: 0,
          lineToGainZ: this.zOf(e, 100),
          down: 4,
          offCall: { play: offensePlay(n.id), flip: n.flip },
          defCall: { play: defensePlay(r.id), flip: r.flip },
          kickChoice: `deep`,
          returnChoice: `return`,
        },
        a = await this.runSession(i);
      this.applyStats(a);
      let u = a.fouls.find((e) => FOULS[e.kind].deadBall && (this.settings.penalties || e.kind === `delay`));
      if (u) {
        let e = applyFoul(s, u, null);
        this.showPenalties(e, s);
        e.next && (s = { ...e.next, down: 1, lineToGain: 100 });
        await this.wait(1.4);
        continue;
      }
      let d = a.end;
      d.t === `fgGood`
        ? ((c = `good`), (l = 1))
        : (c = d.t === `td` ? (d.team === e ? `good` : `defense`) : `fail`);
      break;
    }
    return (
      c === `good`
        ? (await this.score(e, l, l === 2 ? `2pt` : `xp`, null),
          l === 2 &&
            (this.ui.splash(`TWO POINTS!`, `big`),
            this.audio.say(`The two point try is good!`, { priority: true })))
        : c === `defense`
          ? (await this.score(t, 2, `def2`, null), this.ui.splash(`DEFENSIVE 2!`, `big`))
          : (this.ui.splash(o ? `NO GOOD!` : `MISSED!`, `bad`),
            this.audio.say(o ? `The try fails!` : `The extra point is no good!`)),
      this.otPossessionEnd(e),
      await this.wait(1.2),
      this.twoMinuteCheck(),
      this.gameOver ? { t: `over` } : { t: `kickoff`, kicker: e }
    );
  }
  async score(e, t, n, r) {
    if (
      ((this.scores[e] += t),
      (this.onFire[other(e)] = false),
      (this.streak[other(e)] = 0),
      (this.excite = 1),
      this.audio.crowd(1),
      n === `td`)
    ) {
      this.stadium.jumbotron.flash(`TOUCHDOWN!`, 6);
      this.audio.play(`td`);
      this.waveT = 5;
      this.controllers[e]?.rumble(0.5, 380);
      this.fx.launchFireworks(14, [TEAMS[e].colors.jersey, TEAMS[e].colors.trim, `#ffffff`, `#ffd23f`]);
      let t = r?.scorer;
      t &&
        ((this.celebrating = t.pos.clone()),
        (this.rig.mode = `orbit`),
        this.fx.confetti(t.pos, [TEAMS[e].colors.jersey, TEAMS[e].colors.trim, `#ffffff`]));
      await this.wait(2.6);
      this.celebrating = null;
      this.rig.mode = `play`;
      r && (await this.maybeReplay(r, true));
      this.ui.banner(
        `${TEAMS[0].abbr} ${this.scores[0]}  ·  ${TEAMS[1].abbr} ${this.scores[1]}`,
        `${TEAMS[e].name.toUpperCase()} TOUCHDOWN`,
        TEAMS[e].colors.accent,
      );
    } else
      n === `fg`
        ? (this.stadium.jumbotron.flash(`FIELD GOAL!`, 4),
          this.fx.launchFireworks(5, [TEAMS[e].colors.jersey, `#ffd23f`]),
          await this.wait(1.6))
        : n === `safety`
          ? (this.stadium.jumbotron.flash(`SAFETY!`, 4), await this.wait(1.6))
          : this.stadium.jumbotron.flash(n === `xp` ? `EXTRA POINT` : `TWO POINTS!`, 3);
    this.checkOT(n === `safety` ? e : null);
  }
  otPossessionEnd(e) {
    this.ot.active && (this.ot.poss[e]++, this.checkOT(null));
  }
  checkOT(e) {
    if (!this.ot.active || this.gameOver) return;
    let t = this.ot.first,
      n = other(t),
      r = this.ot.poss[t],
      i = this.ot.poss[n],
      a = false;
    r === 0
      ? (e === n || this.scores[n] > this.scores[t]) && (a = true)
      : i === 0
        ? this.scores[n] > this.scores[t] && (a = true)
        : this.scores[0] !== this.scores[1] && (a = true);
    a &&
      ((this.gameOver = true),
      this.ui.banner(
        `GAME OVER!`,
        `${TEAMS[this.scores[0] > this.scores[1] ? 0 : 1].name.toUpperCase()} WIN IN OVERTIME!`,
      ));
  }
  updateFire(e, t, n) {
    let r = other(e),
      i = (!t.turnover && t.gain >= 10) || (t.end.t === `td` && t.end.team === e),
      a =
        t.sack ||
        t.turnover ||
        t.gain <= -2 ||
        !!n?.turnoverOnDowns ||
        (t.end.t === `td` && t.end.team === r);
    i
      ? (this.streak[e]++, (this.streak[r] = 0))
      : a
        ? (this.streak[r]++, (this.streak[e] = 0))
        : t.gain < 4 && (this.streak[e] = 0);
    for (let e of [0, 1])
      this.onFire[e]
        ? (this.firePlays[e]++, this.firePlays[e] > 8 && ((this.onFire[e] = false), (this.streak[e] = 0)))
        : this.streak[e] >= 3 &&
          ((this.onFire[e] = true),
          (this.firePlays[e] = 0),
          this.ui.splash(`${TEAMS[e].name.toUpperCase()} ON FIRE!`, `fire`),
          this.audio.play(`fire`),
          this.audio.say(`${TEAMS[e].name} are heating up... they're on fire!`, { priority: true }),
          (this.excite = 1),
          (this.waveT = 4));
    t.turnover && (this.onFire[t.end.t === `dead` && t.end.team === e ? r : e] = false);
  }
  resetStreaksOnChange(e) {}
  async maybeReplay(e, t = false) {
    if (
      (t || e.bigPlay || e.hardHit || e.turnover) &&
      this.replay.start(t ? 6 : 5) &&
      (this.ui.replayMode(true),
      (this.rig.mode = `replay`),
      (this.rig.replaySide = Math.random() < 0.5 ? -1 : 1),
      (this.stadium.losLine.visible = false),
      await this.guard(
        new Promise((e) => {
          let t = this.ui.loop(() => {
            if (this.paused) return;
            let n = false;
            for (const c of [this.input.p1, this.input.p2])
              if (c.consume(`action`) | c.consume(`confirm`)) n = true;
            if (!this.replay.playing || n) {
              t();
              this.replay.stop();
              e();
            }
          });
        }),
      ),
      this.ui.replayMode(false),
      (this.rig.mode = `play`),
      this.session)
    )
      for (let e of this.session.all) e.sync(0);
  }
  applyStats(e) {
    for (let t of e.stats) {
      let e = this.playerStats.get(t.player.id);
      e || ((e = { rp: t.player, team: t.team, s: {} }), this.playerStats.set(t.player.id, e));
      e.s[t.key] = (e.s[t.key] ?? 0) + t.n;
    }
  }
  leaders(e) {
    let t = [...this.playerStats.values()].filter((t) => t.team === e),
      n = (e) => t.filter((t) => (t.s[e] ?? 0) !== 0).sort((t, n) => (n.s[e] ?? 0) - (t.s[e] ?? 0))[0],
      r = [],
      i = n(`passAtt`);
    i &&
      r.push(
        `<b>PASS</b> ${i.rp.last}: ${i.s.passComp ?? 0}/${i.s.passAtt ?? 0}, ${i.s.passYds ?? 0} yds, ${i.s.passTD ?? 0} TD, ${i.s.intThrown ?? 0} INT`,
      );
    let a = n(`rushYds`) ?? n(`rushAtt`);
    a &&
      r.push(
        `<b>RUSH</b> ${a.rp.last}: ${a.s.rushAtt ?? 0} car, ${a.s.rushYds ?? 0} yds, ${a.s.rushTD ?? 0} TD`,
      );
    let o = n(`recYds`) ?? n(`rec`);
    o && r.push(`<b>REC</b> ${o.rp.last}: ${o.s.rec ?? 0} rec, ${o.s.recYds ?? 0} yds, ${o.s.recTD ?? 0} TD`);
    let s = n(`tackles`);
    s &&
      r.push(
        `<b>TKL</b> ${s.rp.last}: ${s.s.tackles ?? 0} tackles${s.s.sacks ? `, ${s.s.sacks} sacks` : ``}`,
      );
    let c = n(`sacks`);
    c && c !== s && r.push(`<b>SACKS</b> ${c.rp.last}: ${c.s.sacks}`);
    let l = n(`defInt`);
    l && r.push(`<b>INT</b> ${l.rp.last}: ${l.s.defInt}`);
    let u = n(`fgAtt`);
    return (
      u && r.push(`<b>FG</b> ${u.rp.last}: ${u.s.fgMade ?? 0}/${u.s.fgAtt ?? 0}`),
      r.length ? r.join(`<br>`) : `No stats yet`
    );
  }
  mvp() {
    let e = ``,
      t = -1;
    for (let n of this.playerStats.values()) {
      let r = n.s,
        i =
          (r.passYds ?? 0) * 0.04 +
          (r.passTD ?? 0) * 4 -
          (r.intThrown ?? 0) * 3 +
          (r.rushYds ?? 0) * 0.1 +
          (r.rushTD ?? 0) * 6 +
          (r.recYds ?? 0) * 0.1 +
          (r.recTD ?? 0) * 6 +
          (r.tackles ?? 0) * 0.8 +
          (r.sacks ?? 0) * 3 +
          (r.defInt ?? 0) * 5 +
          (r.defTD ?? 0) * 6 +
          (r.retYds ?? 0) * 0.05 +
          (r.retTD ?? 0) * 6 +
          (r.fgMade ?? 0) * 2 +
          (this.scores[n.team] > this.scores[other(n.team)] ? 3 : 0);
      i > t &&
        ((t = i),
        (e = `#${n.rp.num} ${n.rp.first} ${n.rp.nick ? `"${n.rp.nick}" ` : ``}${n.rp.last} · ${TEAMS[n.team].name}`));
    }
    return e;
  }
  statsHtml(e) {
    let t = this.teamStats,
      n = (e) => `${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, `0`)}`,
      r = [
        [`FIRST DOWNS`, String(t[0].firstDowns), String(t[1].firstDowns)],
        [`TOTAL YARDS`, String(t[0].totalYds), String(t[1].totalYds)],
        [`PASSING`, String(t[0].passYds), String(t[1].passYds)],
        [`RUSHING`, String(t[0].rushYds), String(t[1].rushYds)],
        [`3RD DOWN`, `${t[0].thirdConv}/${t[0].thirdAtt}`, `${t[1].thirdConv}/${t[1].thirdAtt}`],
        [`TURNOVERS`, String(t[0].turnovers), String(t[1].turnovers)],
        [`SACKS`, String(t[0].sacks), String(t[1].sacks)],
        [`PENALTIES`, `${t[0].penalties}-${t[0].penYds}`, `${t[1].penalties}-${t[1].penYds}`],
        [`POSSESSION`, n(t[0].top), n(t[1].top)],
      ],
      i = (e) => `background:linear-gradient(160deg, ${TEAMS[e].colors.jersey}, ${TEAMS[e].colors.dark})`;
    return `<h1>${e}</h1>
      <div class="scoreline"><div class="tm" style="${i(0)}">${TEAMS[0].name.toUpperCase()}</div><div class="sc">${this.scores[0]}</div><div class="sc">–</div><div class="sc">${this.scores[1]}</div><div class="tm" style="${i(1)}">${TEAMS[1].name.toUpperCase()}</div></div>
      <table>${r.map(([e, t, n]) => `<tr><td class="v">${t}</td><td class="c">${e}</td><td class="v">${n}</td></tr>`).join(``)}</table>
      <div class="leaders"><div><h3>${TEAMS[0].name.toUpperCase()} LEADERS</h3>${this.leaders(0)}</div><div><h3>${TEAMS[1].name.toUpperCase()} LEADERS</h3>${this.leaders(1)}</div></div>`;
  }
  async finalScreen() {
    this.inMatch = false;
    let e = this.scores[0] === this.scores[1] ? null : this.scores[0] > this.scores[1] ? 0 : 1;
    this.audio.play(`horn`);
    this.excite = 1;
    e === null
      ? this.audio.say(`It ends in a tie!`, { priority: true })
      : (this.fx.launchFireworks(20, [TEAMS[e].colors.jersey, TEAMS[e].colors.trim, `#ffffff`]),
        this.fx.confetti(new THREE.Vector3(0, 0, 0), [
          TEAMS[e].colors.jersey,
          TEAMS[e].colors.trim,
          `#ffffff`,
        ]),
        this.audio.say(
          `That's the game! The ${TEAMS[e].city} ${TEAMS[e].name} win it ${Math.max(...this.scores)} to ${Math.min(...this.scores)}!`,
          { priority: true },
        ));
    this.rig.mode = `menu`;
    this.ui.hud.show(false);
    await new Promise((e) => setTimeout(e, 1500));
    const human = this.mode === `1p` ? (this.controllers[0] ? 0 : 1) : null,
      line = recordMatch({
        mode: this.mode,
        human,
        scores: this.scores,
        difficulty: this.settings.difficulty,
        teamNames: TEAMS.map((t) => t.name.toUpperCase()),
        humanStats: human === null ? null : this.humanTotals(human),
      });
    let t = e === null ? `TIE GAME` : `${TEAMS[e].name.toUpperCase()} WIN!`,
      n =
        this.statsHtml(t) +
        `<div class="mvp">★ PLAYER OF THE GAME: ${this.mvp()} ★</div>` +
        (line ? `<div class="record-line">${line}</div>` : ``);
    return (await this.ui.stats(`final`, n, true)) === `again` ? `again` : `menu`;
  }
  /** Career numbers for the records screen: the human team's totals this game. */
  humanTotals(team) {
    const out = { td: 0, passYds: 0, rushYds: 0, sacks: 0, ints: 0 };
    for (const p of this.playerStats.values()) {
      if (p.team !== team) continue;
      const s = p.s;
      out.td += (s.rushTD ?? 0) + (s.recTD ?? 0) + (s.retTD ?? 0) + (s.defTD ?? 0);
      out.passYds += s.passYds ?? 0;
      out.rushYds += s.rushYds ?? 0;
      out.sacks += s.sacks ?? 0;
      out.ints += s.defInt ?? 0;
    }
    return out;
  }
};
