/**
 * Neon Skies — Mach & Mischief.
 *
 * Rebuilt from the original single-file bundle onto the wall's shared 3D stack:
 * three.js r186 (WebGPURenderer with the automatic WebGL 2 fallback) started by
 * kit/boot.js, the kit's TSL post chain and sized points, and every control
 * routed through kit.input actions (keyboard and mouse, gamepad, touch).
 *
 *   FlightEngine   the mission simulation (pure logic, no DOM)
 *   FlightView     the three.js scene on kit.renderer
 *   SoundSystem    synthesized engine, effects and music (Web Audio)
 *   the rest       menus, HUD, input and the frame loop
 */
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";
import { boot } from "kit/boot.js";
import { createPost } from "kit/post.js";
import { createPoints } from "kit/points.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { MISSIONS, AIRCRAFT, WEAPONS, SIDE_OPS, SOURCE_NOTES, GUIDE_TEXT } from "./data.js";

const kit = await boot({
  title: "Neon Skies",
  canvas: document.getElementById("scene-canvas"),
  gear: "none", // the game's own Settings panel and pause card open the kit menu (F9 works too)
  accent: "#c4f58b",
  background: "#06151f",
  input: {
    // flight
    // pitch and roll are separate axes, as in the original (holding W and D keeps both at full rate)
    fly: { type: "vector", keys: "wasd+arrows", gamepad: "leftStick+dpad", touch: "stick", clamp: false },
    trim: { type: "axis", keys: { pos: ["KeyE"], neg: ["KeyQ"] } },
    steer: { type: "look", mouse: "drag", gamepad: [] },
    missile: { keys: ["Space"], mouse: [2], gamepad: ["A"], touch: "Missile" },
    gun: { keys: ["KeyJ"], mouse: [0], gamepad: ["RT", "X"], touch: "Gun" },
    boost: { keys: ["ShiftLeft", "ShiftRight"], gamepad: ["RB"], touch: "Boost" },
    brake: { keys: ["ControlLeft", "ControlRight", "KeyX", "KeyK"], gamepad: ["LT", "LB"], touch: "Brake" },
    flare: { keys: ["KeyR"], gamepad: ["B"], touch: "Flare" },
    target: { keys: ["Tab", "KeyT"], gamepad: ["Y"], touch: { label: "Target", slot: "top" } },
    camera: { keys: ["KeyC"], gamepad: ["RS"], touch: { label: "Cam", slot: "top" } },
    map: { keys: ["KeyM"], gamepad: ["Back"], touch: { label: "Map", slot: "top" } },
    pause: { keys: ["Escape", "KeyP"], gamepad: ["Start"], touch: { label: "II", slot: "top" } },
    // menus: arrows / D-pad / stick move focus, Space or A confirms, B goes back
    nav: { type: "vector", keys: "arrows", gamepad: "leftStick+dpad" },
    confirm: { keys: ["Space"], gamepad: ["A"] },
    back: { gamepad: ["B"] },
  },
});

var clamp = (o, e, t) => Math.max(e, Math.min(t, o)),
  lerp = (o, e, t) => o + (e - o) * t,
  vec = (o = 0, e = 0, t = 0) => ({ x: o, y: e, z: t }),
  vadd = (o, e) => vec(o.x + e.x, o.y + e.y, o.z + e.z),
  vsub = (o, e) => vec(o.x - e.x, o.y - e.y, o.z - e.z),
  vscale = (o, e) => vec(o.x * e, o.y * e, o.z * e),
  vdot = (o, e) => o.x * e.x + o.y * e.y + o.z * e.z,
  vcross = (o, e) => vec(o.y * e.z - o.z * e.y, o.z * e.x - o.x * e.z, o.x * e.y - o.y * e.x),
  vlen = (o) => Math.hypot(o.x, o.y, o.z),
  vnorm = (o) => vscale(o, 1 / (vlen(o) || 1)),
  vdist = (o, e) => vlen(vsub(o, e)),
  heading = (o, e = 0) => vec(Math.sin(o) * Math.cos(e), Math.sin(e), -Math.cos(o) * Math.cos(e)),
  angleDiff = (o, e) => Math.atan2(Math.sin(o - e), Math.cos(o - e));
function seededRandom(o = 1) {
  let e = o >>> 0;
  return () => {
    e += 1831565813;
    let t = e;
    return (
      (t = Math.imul(t ^ (t >>> 15), t | 1)),
      (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  };
}
function formatClock(o) {
  return (
    (o = Math.max(0, o)),
    `${Math.floor(o / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(o % 60)
      .toString()
      .padStart(2, "0")}`
  );
}
var RANK_VALUE = { D: 1, C: 2, B: 3, A: 4 },
  SAVE_KEY = "neon-skies-save-v1";
function defaultSave() {
  return {
    version: 1,
    ranks: { easy: {}, normal: {}, hard: {} },
    records: {},
    unlocked: 1,
    xp: 0,
    credits: 0,
    upgrades: { armor: 0, engine: 0, link: 0 },
    completed: {},
    sideClears: {},
    selected: 0,
    gun: "Vul",
    missile: "Msl",
    chain: null,
    settings: {
      difficulty: "normal",
      sound: !0,
      music: 0.4,
      volume: 0.65,
      voice: !1,
      assist: !0,
      invert: !1,
      sensitivity: 1,
      shake: !0,
    },
    playTime: 0,
  };
}
function sanitizeSave(o) {
  if (!o || o.version !== 1 || typeof o != "object") throw new Error("This is not a compatible Neon Skies save.");
  let e = defaultSave();
  for (let t of ["easy", "normal", "hard"])
    for (let [s, i] of Object.entries(o.ranks?.[t] || {})) +s >= 1 && +s <= 36 && RANK_VALUE[i] && (e.ranks[t][s] = i);
  for (let t of ["xp", "credits", "playTime"]) e[t] = clamp(Number(o[t]) || 0, 0, 1e8);
  ((e.unlocked = clamp(Number(o.unlocked) || 1, 1, 36)), (e.selected = clamp(Number(o.selected) || 0, 0, 20)));
  for (let t of ["armor", "engine", "link"]) e.upgrades[t] = clamp(Math.floor(Number(o.upgrades?.[t]) || 0), 0, 3);
  for (let t of ["easy", "normal", "hard"]) e.completed[t] = !!o.completed?.[t];
  for (let t of [37, 38, 39]) e.sideClears[t] = !!o.sideClears?.[t];
  (WEAPONS[o.gun]?.slot === "gun" && (e.gun = o.gun),
    WEAPONS[o.missile]?.slot === "missile" && (e.missile = o.missile));
  for (let t of ["sound", "voice", "assist", "invert", "shake"])
    typeof o.settings?.[t] == "boolean" && (e.settings[t] = o.settings[t]);
  for (let [t, s, i] of [
    ["music", 0, 1],
    ["volume", 0, 1],
    ["sensitivity", 0.4, 2],
  ])
    Number.isFinite(o.settings?.[t]) && (e.settings[t] = clamp(o.settings[t], s, i));
  for (let [t, s] of Object.entries({
    difficulty: ["easy", "normal", "hard"],
  }))
    s.includes(o.settings?.[t]) && (e.settings[t] = o.settings[t]);
  o.chain &&
    Number.isInteger(o.chain.plane) &&
    o.chain.plane >= 0 &&
    o.chain.plane < 21 &&
    (e.chain = {
      plane: o.chain.plane,
      gun: WEAPONS[o.chain.gun]?.slot === "gun" ? o.chain.gun : "Vul",
      missile: WEAPONS[o.chain.missile]?.slot === "missile" ? o.chain.missile : "Msl",
    });
  for (let [t, s] of Object.entries(o.records || {}))
    +t > 0 &&
      +t <= 39 &&
      s &&
      Number.isFinite(s.time) &&
      (e.records[t] = {
        time: clamp(s.time, 0, 1e5),
        kills: clamp(+s.kills || 0, 0, 1e3),
        rank: RANK_VALUE[s.rank] ? s.rank : "D",
      });
  return e;
}
var PilotRecord = class {
    constructor(e) {
      ((this.storage = e), (this.persistent = !0));
      try {
        e === void 0 && (this.storage = globalThis.localStorage);
        let t = this.storage?.getItem(SAVE_KEY);
        ((this.data = t ? sanitizeSave(JSON.parse(t)) : defaultSave()), this.storage || (this.persistent = !1));
      } catch {
        ((this.data = defaultSave()), (this.persistent = !1));
      }
    }
    write() {
      try {
        this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch {
        this.persistent = !1;
      }
    }
    best(e, t = !1) {
      let s = "";
      for (let i of t ? ["normal", "hard"] : ["easy", "normal", "hard"]) {
        let n = this.data.ranks[i]?.[e];
        (RANK_VALUE[n] || 0) > (RANK_VALUE[s] || 0) && (s = n);
      }
      return s;
    }
    allRank(e = 3, t = !1, s = 35) {
      for (let i = 1; i <= s; i++) if ((RANK_VALUE[this.best(i, t)] || 0) < e) return !1;
      return !0;
    }
    get level() {
      return Math.min(30, 1 + Math.floor(this.data.xp / 650));
    }
    get simulator() {
      return !!(this.data.completed.normal || this.data.completed.hard);
    }
    get bonusMission() {
      return this.allRank(3);
    }
    get musicPlayer() {
      return !!this.data.completed.easy;
    }
    get osl() {
      return !!this.data.completed.hard;
    }
    isPlaneUnlocked(e) {
      if (e === 0 || (e === 6 && this.best(11)) || (e === 9 && this.best(15))) return !0;
      if (e === 18) return this.allRank(4, !1, 36);
      if (e === 19) return this.allRank(4, !0, 36);
      if (e === 20) return (this.data.records[36]?.time ?? 1 / 0) < 300;
      let t = AIRCRAFT[e];
      if (!t) return !1;
      let s = parseInt(t.unlock);
      return t.unlock.includes("*") ? this.best(s) === "A" : !!this.best(s);
    }
    canPlay(e) {
      if (e > 36) {
        let t = SIDE_OPS.find((s) => s.id === e);
        return !!t && this.level >= t.level;
      }
      return e === 36 ? this.bonusMission : e <= this.data.unlocked;
    }
    upgrade(e) {
      let t = this.data.upgrades[e],
        s = (t + 1) * 450;
      return t >= 3 || this.data.credits < s
        ? !1
        : ((this.data.credits -= s), this.data.upgrades[e]++, this.write(), !0);
    }
    import(e) {
      let t = sanitizeSave(JSON.parse(e));
      ((this.data = t), this.write());
    }
    reset() {
      ((this.data = defaultSave()), this.write());
    }
  },
  WATER_ENVIRONMENTS = new Set(["city", "harbor", "ocean", "island", "fjord", "canyon"]);
function buildWorld(o = "city", e = 42) {
  let t = seededRandom(e),
    s = {
      environment: o,
      seed: e,
      buildings: [],
      trees: [],
      decor: [],
      gates: [],
      water: WATER_ENVIRONMENTS.has(o),
      ceiling: o === "geofront" ? 1650 : o === "tunnel" ? 720 : 1 / 0,
    };
  if (
    ((s.canyonCenter = (i) => Math.sin(-i * 35e-5) * 680 + Math.sin(-i * 13e-5) * 740),
    (s.heightAt = (i, n) => {
      if (["space", "strato", "cyber", "geofront", "tunnel"].includes(o)) return 0;
      if (["city", "harbor"].includes(o)) {
        let a = Math.sin(n * 32e-5) * 450;
        return Math.abs(i - a) < 500 ? -12 : 18;
      }
      if (o === "ocean" || o === "island") {
        if (o === "ocean" && Math.abs(i) < 1450 && n < -1700 && n > -4600) return 24;
        let a = -30;
        for (let [l, c, u, h] of [
          [-2900, -3700, 1500, 2e3],
          [3e3, -6500, 2100, 1500],
          [2800, 2500, 1800, 1900],
        ]) {
          let d = ((i - l) / u) ** 2 + ((n - c) / h) ** 2;
          d < 1 && (a = Math.max(a, (1 - d) * (o === "island" ? 480 : 240)));
        }
        return a;
      }
      if (o === "canyon" || o === "fjord") {
        let a = Math.abs(i - s.canyonCenter(n));
        return Math.max(-20, Math.min(1250, (a - 450) * 1.8)) + Math.max(0, a - 700) * 0.05;
      }
      return o === "desert"
        ? 100 + Math.sin(i * 0.0012 + n * 4e-4) * 55 + Math.cos(n * 0.0012) * 35
        : o === "forest"
          ? 50 + Math.sin(i * 5e-4) * Math.cos(n * 6e-4) * 65
          : o === "plateau"
            ? 150 + Math.sin(i * 4e-4) * Math.cos(n * 3e-4) * 45
            : 40 +
              Math.pow(
                Math.abs(Math.sin(i * 47e-5) * Math.cos(n * 5e-4) + 0.35 * Math.sin(i * 0.001 + n * 7e-4)),
                1.45,
              ) *
                (o === "snow" ? 670 : 800);
    }),
    ["city", "harbor", "geofront", "ocean"].includes(o))
  ) {
    let i = o === "ocean",
      n = i ? 280 : 390,
      r = i ? 1200 : 6200;
    for (let a = -r; a < r; a += n)
      for (let l = i ? -4400 : -9e3; l < (i ? -1850 : 3600); l += n) {
        if (t() < 0.18 || s.heightAt(a, l) < 0 || (!i && Math.abs(a) < 700) || (!i && Math.abs(l % 1900) < 130))
          continue;
        let c = a + (t() - 0.5) * 90,
          u = l + (t() - 0.5) * 90,
          h = Math.max(0, 1 - Math.hypot(c * 0.65, (u + 3300) * 0.8) / 6500),
          d = 45 + t() * 210 + h * h * t() * 480;
        (o === "geofront" && (d *= 0.65),
          s.buildings.push({
            x: c,
            y: s.heightAt(c, u),
            z: u,
            w: 110 + t() * 140,
            d: 100 + t() * 160,
            h: d,
            color: t(),
            antenna: t() > 0.7,
          }));
      }
  }
  if (["forest", "island", "snow", "mountain"].includes(o))
    for (let i = 0; i < 700; i++) {
      let n = (t() - 0.5) * 16e3,
        r = (t() - 0.7) * 15e3,
        a = s.heightAt(n, r);
      a > 15 && a < 550 && s.trees.push({ x: n, y: a, z: r, h: 35 + t() * 60 });
    }
  if (o === "tunnel")
    for (let i = 0; i < 11; i++)
      s.gates.push({
        z: -1300 - i * 1450,
        lanes: i < 4 ? 2 : 3,
        open: Math.floor(t() * (i < 4 ? 2 : 3)),
        width: i < 7 ? 1050 : 820,
      });
  return s;
}
var nextEntityId = 1,
  GROUND_NAMES =
    /^(Gun|AA Gun|MSSL|Radarsite|Base|Bridge|Tower|Facilities|Pow\.Plant|Pr\.Plant|Chimney|Tank|Antlion|Nanobite|Timer|Oil Tank|Relay|Beacon|Core)$/,
  SHIP_NAMES = /^(Carrier|Convoy|Warship|S\.Warship|Submarine|Hydrofoil)$/,
  BOSS_NAMES = new Set(["X-49", "UI-4051 Aurora", "UI-4054 Aurora", "UI-4054", "XR-900"]);
function entityKind(o) {
  return SHIP_NAMES.test(o)
    ? "ship"
    : GROUND_NAMES.test(o)
      ? "ground"
      : o === "Satellite"
        ? "satellite"
        : o === "A.Train"
          ? "train"
          : o === "Container"
            ? "cargo"
            : o === "Decoy"
              ? "decoy"
              : o.startsWith("UI-4053") || o === "UI-4052"
                ? "airship"
                : ["AH-66B", "R-701", "V-22B"].includes(o)
                  ? "helicopter"
                  : "aircraft";
}
function entityHp(o, e) {
  return BOSS_NAMES.has(o)
    ? o === "XR-900"
      ? 132
      : 352
    : e === "airship"
      ? 704
      : e === "ship"
        ? o === "Hydrofoil"
          ? 88
          : 132
        : e === "satellite"
          ? 80
          : o === "Timer"
            ? 72
            : o === "Nanobite"
              ? 60
              : e === "ground"
                ? ["Base", "Tower", "Tank", "Core"].includes(o)
                  ? 60
                  : 40
                : e === "helicopter"
                  ? 44
                  : e === "aircraft"
                    ? /^R-50|^R-53|^C-17/.test(o)
                      ? 88
                      : 66
                    : 40;
}
var FlightEngine = class {
    constructor(e = new PilotRecord()) {
      ((this.pilot = e),
        (this.events = []),
        (this.worldVersion = 0),
        (this.state = "menu"),
        (this.demoTime = 0),
        (this.entities = []),
        (this.projectiles = []),
        (this.effects = []),
        (this.time = 0),
        (this.nextId = 1),
        (this.input = { x: 0, y: 0, boost: !1, brake: !1, gun: !1, missile: !1 }),
        (this.cameraMode = 0),
        (this.cameraShake = 0),
        (this.lock = 0),
        (this.targetId = null),
        (this.frameCount = 0),
        this.initDemo());
    }
    emit(e, t = {}) {
      this.events.push({ type: e, ...t });
    }
    drain() {
      return this.events.splice(0);
    }
    initDemo() {
      ((this.world = buildWorld("city", 79)),
        this.worldVersion++,
        (this.p = {
          pos: vec(100, 830, 2300),
          yaw: -0.24,
          pitch: 0.03,
          roll: -0.12,
          speed: 340,
          hp: 100,
          maxHp: 100,
          plane: this.pilot.data.selected,
          vel: vec(0, 0, -340),
          flares: 5,
        }),
        (this.entities = []),
        (this.projectiles = []),
        (this.effects = []),
        (this.state = "menu"),
        (this.mission = null));
    }
    start(
      e,
      {
        plane: t = this.pilot.data.selected,
        gun: s = this.pilot.data.gun,
        missile: i = this.pilot.data.missile,
        difficulty: n = this.pilot.data.settings.difficulty,
        practice: r = !1,
        simOverride: a = null,
      } = {},
    ) {
      let l = MISSIONS.find((d) => d.id === e) || SIDE_OPS.find((d) => d.id === e);
      if (!l) throw new Error("Unknown operation.");
      ([12, 19].includes(e) && (t = 6),
        e === 16 && (t = 9),
        e >= 31 && e <= 35 && this.pilot.data.chain && ({ plane: t, gun: s, missile: i } = this.pilot.data.chain));
      let c = AIRCRAFT[t] || AIRCRAFT[0];
      (c.guns.includes(s) || (s = c.guns[0]),
        !c.missiles.includes(i) && !(i === "OSL" && this.pilot.osl && this.pilot.simulator) && (i = c.missiles[0]),
        e === 16 && ((s = "Neutron Beam"), (i = "Plasma Beam")),
        e === 18 && (i = "Anti-Nanobite Bomb"),
        (this.simOverride =
          this.pilot.simulator &&
          this.pilot.best(e) &&
          ![16, 18].includes(e) &&
          ["Msl", "Spread Bomb", "OSL", "Plasma Beam"].includes(a)
            ? a
            : null),
        this.simOverride && (i = this.simOverride),
        e === 30 && !r && ((this.pilot.data.chain = { plane: t, gun: s, missile: i }), this.pilot.write()),
        (this.mission = l),
        (this.difficulty = n),
        (this.practice = r),
        (this.world = buildWorld(l.environment, e * 189 + (e === 31 ? Math.floor(Math.random() * 1e4) : 0))),
        (this.rng = seededRandom(e * 19 + 7)),
        (this.entities = []),
        (this.projectiles = []),
        (this.effects = []),
        (this.events = []),
        (this.time = 0),
        (this.phase = 0),
        (this.phaseTime = 0),
        (this.kills = 0),
        (this.optionalKills = 0),
        (this.score = 0),
        (this.shots = 0),
        (this.hits = 0),
        (this.civilianHits = 0),
        (this.detected = !1),
        (this.late = !1),
        (this.rankCap = "A"),
        (this.outTime = 0),
        (this.lock = 0),
        (this.lockId = null),
        (this.targetId = null),
        (this.formationLost = 0),
        (this.formation = 0),
        (this.gunCooldown = 0),
        (this.missileCooldown = 0),
        (this.heat = 0),
        (this.overheated = !1),
        (this.flareCooldown = 0),
        (this.evade = 0),
        (this.bossHack = !1),
        (this.clearance = !1),
        (this.timerLimit = 0),
        (this.phaseLimit = 0),
        (this.lastEnemyShot = 0),
        (this.sourceCount = 0),
        (this.groundWarning = !1),
        (this.message = ""),
        (this.service = null),
        (this.cameraShake = 0),
        (this.allyDown = !1),
        (this.endDelay = 0),
        this.worldVersion++);
      let u = ["space"].includes(l.environment)
        ? 18e3
        : l.environment === "strato"
          ? 9600
          : l.environment === "tunnel"
            ? 300
            : l.environment === "geofront"
              ? 700
              : 900;
      (e === 22 && (u = 4250), e === 27 && (u = 280), e === 10 && (u = 320));
      let h = 100 + c.stats[2] * 6 + this.pilot.data.upgrades.armor * 15;
      ((this.p = {
        pos: vec(0, u, e === 31 ? 350 : 2100),
        yaw: 0,
        pitch: 0,
        roll: 0,
        speed: e === 31 ? 265 : 320,
        desiredSpeed: 320,
        vel: vec(0, 0, -320),
        hp: h,
        maxHp: h,
        plane: t,
        gun: s,
        missile: i,
        ammo: c.ammo,
        flares: 6,
        racks: Array(t >= 7 ? 4 : 2).fill(0),
      }),
        e === 10 && (this.p.pos.x = this.world.canyonCenter(this.p.pos.z)),
        e === 27 && (this.p.pos.y = Math.max(230, this.world.heightAt(0, 2100) + 160)),
        (this.state = "playing"),
        this.setupPhase(0),
        this.worldVersion++,
        this.emit("start", { mission: l }),
        this.emit("radio", { speaker: "CONTROL / MICA", text: l.radio }),
        this.emit("banner", { title: "MISSION START", subtitle: l.role }));
    }
    spawn(e, t = 1, s = {}) {
      let i = [];
      for (let n = 0; n < t; n++) {
        let r = s.kind || entityKind(e),
          a = ["aircraft", "airship", "helicopter", "cargo", "decoy", "satellite"].includes(r),
          l = this.sourceCount++,
          c = (l * 2.39996) % 6.283,
          u = 900 + (Math.floor(l / 7) % 3) * 580,
          h = Math.sin(c) * u,
          d = -1900 - Math.cos(c) * u - this.phase * 650,
          p = a ? this.p.pos.y + (this.rng() - 0.5) * 380 : Math.max(8, this.world.heightAt(h, d)) + 20;
        (r === "ship" &&
          ((h = Math.sin(c) * (1800 + (l % 3) * 450)),
          (d = -1800 - Math.cos(c) * 1900),
          (p = 13),
          this.world.heightAt(h, d) > 0 && (h += h >= 0 ? 3800 : -3800)),
          this.world.environment === "strato" && (p = 9300 + (this.rng() - 0.5) * 800),
          this.world.environment === "space" &&
            ((h = Math.sin(c) * 2200), (d = -2e3 - Math.cos(c) * 1700), (p = 17900 + (this.rng() - 0.5) * 2200)),
          this.world.environment === "geofront" &&
            ((h = Math.sin(c) * 2200), (d = -2e3 - Math.cos(c) * 1600), (p = a ? 750 : 55)));
        let f = s.pos ? { ...s.pos } : vec(h, p, d);
        s.spread &&
          ((f.x += (n - (t - 1) / 2) * (s.spread.x || 0)),
          (f.y += (n - (t - 1) / 2) * (s.spread.y || 0)),
          (f.z += (n - (t - 1) / 2) * (s.spread.z || 0)));
        let m = s.hp || entityHp(e, r),
          g = {
            id: nextEntityId++,
            name: e,
            kind: r,
            pos: f,
            initial: { ...f },
            yaw: s.yaw ?? 0,
            pitch: 0,
            roll: 0,
            vel: vec(),
            hp: m,
            maxHp: m,
            radius: r === "airship" ? 100 : r === "ship" ? 65 : e === "Timer" ? 70 : r === "ground" ? 32 : 22,
            alive: !0,
            required: s.required ?? !1,
            neutral: s.neutral ?? !1,
            ally: s.ally ?? !1,
            gunOnly: s.gunOnly ?? !1,
            photo: s.photo ?? !1,
            sheltered: s.sheltered ?? !1,
            weakTop: s.weakTop ?? !1,
            weakUnder: s.weakUnder ?? !1,
            invulnerable: s.invulnerable ?? !1,
            boss: BOSS_NAMES.has(e),
            speed: s.speed ?? (r === "helicopter" ? 38 : r === "aircraft" ? 185 : r === "airship" ? 85 : 0),
            turn: s.turn ?? 0.6,
            fireTimer: 4 + this.rng() * 9,
            phase: this.phase,
            age: 0,
            seed: this.rng() * 100,
            hostile: s.hostile ?? !(s.neutral || s.ally),
            parked: s.parked ?? !1,
            parent: s.parent || null,
            counts: s.counts ?? !0,
            route: s.route || null,
            role: s.role || "",
            trainIndex: s.trainIndex ?? 0,
            protected: s.protected ?? !1,
            attackAlly: s.attackAlly ?? !1,
            mark: s.mark ?? !1,
          };
        (g.parked &&
          ((g.kind = "ground"),
          (g.radius = 25),
          (g.speed = 0),
          (g.pos.y = Math.max(10, this.world.heightAt(g.pos.x, g.pos.z)) + 12)),
          g.kind === "ground" &&
            !g.parent &&
            g.name !== "Timer" &&
            (g.pos.y = Math.max(g.pos.y, this.world.heightAt(g.pos.x, g.pos.z) + 25)),
          g.kind === "ground" &&
            (this.world.buildings = this.world.buildings.filter(
              (x) => Math.hypot(x.x - g.pos.x, x.z - g.pos.z) > Math.max(x.w, x.d) * 0.6 + 140,
            )),
          this.entities.push(g),
          i.push(g));
      }
      return t === 1 ? i[0] : i;
    }
    group(e, t, s = !1, i = {}) {
      return this.spawn(e, t, { required: s, ...i });
    }
    carrier(e = {}) {
      let t = this.spawn("UI-4053", 1, { required: !1, invulnerable: !0, counts: !1, hp: 704, speed: 60, ...e });
      for (let s = 0; s < 4; s++)
        this.spawn("UI-4053 NODE " + (s + 1), 1, {
          kind: "aircraft",
          required: !0,
          hp: 176,
          speed: 0,
          weakUnder: !0,
          parent: t.id,
          pos: vadd(t.pos, vec((s % 2 ? 1 : -1) * 55, -42, (s < 2 ? -1 : 1) * 65)),
          role: "carrierNode",
        });
      return t;
    }
    ship(e, t = !0, s = 0, i = {}) {
      let n = this.spawn(e, 1, { required: t, ...i });
      for (let r = 0; r < s; r++)
        this.spawn(r % 2 ? "MSSL" : "Gun", 1, {
          required: t,
          kind: "ground",
          parent: n.id,
          counts: this.mission.id !== 20,
          pos: vadd(n.pos, vec(r % 2 ? 20 : -20, 15, (r - s / 2) * 35)),
          role: "shipAux",
        });
      return n;
    }
    primary() {
      return this.entities.filter((e) => e.alive && e.required && !e.neutral && !e.ally);
    }
    setupPhase(e) {
      ((this.phase = e), (this.phaseTime = 0), (this.sourceCount = 0));
      let t = this.mission.id,
        s = (n, r, a = !1, l = {}) => this.group(n, r, a, l),
        i = (n, r = !0, a = 0, l = {}) => this.ship(n, r, a, l);
      switch (
        (e > 0 &&
          (this.emit("banner", { title: "MISSION UPDATE", subtitle: "NEW TARGETS CONFIRMED" }),
          this.emit("radio", { speaker: "CONTROL / MICA", text: this.updateText(t, e) })),
        t)
      ) {
        case 1:
          e
            ? (s("R-101", 2, !1, { pos: vec(0, 1100, -2200), spread: vec(700, 0, 300) }),
              (this.entities.at(-2).required = !0),
              s("R-201", 3))
            : (s("R-501", 4, !0, { hp: 66, speed: 130, pos: vec(0, 960, -900), spread: vec(340, 35, 420) }),
              s("R-201", 2),
              s("R-101", 1),
              (this.phaseLimit = 180));
          break;
        case 2:
          e
            ? (s("Base", 4, !0), s("Bridge", 1, !0))
            : (s("Radarsite", 8, !0), s("R-201", 2), s("R-101", 2), s("Gun", 5), s("MSSL", 2), (this.phaseLimit = 240));
          break;
        case 3:
          e
            ? e === 1
              ? (s("Decoy", 3, !0, { gunOnly: !0, speed: 0, pos: vec(0, 920, -1900), spread: vec(420, 60, 180) }),
                s("Tower", 3, !0))
              : (s("Container", 5, !0, { pos: vec(0, 1650, -1900), spread: vec(400, 90, 150), speed: 0 }),
                s("R-501", 1),
                s("R-201", 4))
            : (s("F-15S/MT", 1, !1, {
                ally: !0,
                protected: !0,
                role: "leader",
                pos: vadd(this.p.pos, vec(0, 0, -260)),
                speed: 275,
              }),
              (this.formation = 0));
          break;
        case 4:
          e
            ? (s("R-201", 2, !0), s("R-101", 2, !0))
            : (i("Carrier", !0, 2),
              i("Convoy", !0, 2),
              i("Warship", !0, 2),
              s("Gun", 4),
              s("MSSL", 4),
              s("Facilities", 4, !1, { neutral: !0 }),
              s("Transport", 2, !1, { neutral: !0, kind: "ground" }),
              s("R-201", 2),
              s("R-101", 3),
              (this.phaseLimit = 180));
          break;
        case 5:
          (s("R-201", 8, !0, { parked: !0, pos: vec(0, 40, -2500), spread: vec(180, 0, 0) }),
            s("Gun", 4),
            s("MSSL", 1),
            s("R-102", 2),
            s("R-211", 2),
            (this.phaseLimit = 180));
          break;
        case 6:
          e
            ? (s("F/A-18I", 3, !0), s("F-16XA", 3, !0))
            : (s("Facilities", 4, !0, { photo: !0 }),
              s("F-16XF", 3),
              s("F-16XA", 3),
              s("Gun", 8),
              s("MSSL", 3),
              (this.phaseLimit = 180));
          break;
        case 7:
          if (e) s("Hydrofoil", 1, !0, { pos: vec(0, 18, -1800), speed: 70 });
          else {
            s("UI-4052", 1, !1, {
              neutral: !0,
              protected: !0,
              pos: vec(0, 470, -700),
              speed: 45,
              hp: 150,
              role: "cargoEscort",
            });
            for (let n = 0; n < 10; n++)
              s("Chimney", 1, !0, { pos: vec(Math.sin(n * 0.9) * 500, 180, -1250 - n * 420), hp: 40 });
            s("Bridge", 1, !0, { pos: vec(0, 80, -5800) });
          }
          break;
        case 8:
          (s("Gun", 4, !0),
            s("Tower", 1, !0),
            s("R-101", 2, !0),
            s("Gun", 3),
            s("MSSL", 6),
            i("Convoy", !1, 2),
            i("Convoy", !1, 2),
            i("Carrier", !1, 2),
            s("R-201", 2),
            s("R-101", 4),
            (this.phaseLimit = 210));
          break;
        case 9:
          if (e) s("Core", 1, !0, { weakTop: !0, pos: vec(0, 270, -3150), hp: 90 });
          else {
            for (let n of [-650, 650])
              for (let r of [-2500, -3800]) s("Pow.Plant", 1, !0, { gunOnly: !0, pos: vec(n, 220, r), hp: 72 });
            (s("Gun", 4), s("MSSL", 4), s("R-101", 3), s("R-201", 4), s("R-701", 2), (this.timerLimit = 300));
          }
          break;
        case 10:
          if (e)
            (s("Base", 1, !0, { pos: vec(this.world.canyonCenter(-1e4), 50, -1e4) }),
              s("Oil Tank", 2, !1, {
                pos: vec(this.world.canyonCenter(-1e4) + 140, 50, -10150),
                spread: vec(220, 0, 0),
              }),
              s("Hydrofoil", 1, !1, { pos: vec(this.world.canyonCenter(-9600), 15, -9600) }));
          else {
            s("R/F-117X", 1, !1, {
              neutral: !0,
              protected: !0,
              role: "canyonLeader",
              pos: vec(this.world.canyonCenter(1500), 320, 1500),
              speed: 160,
            });
            for (let n = 0; n < 19; n++) {
              let r = 300 - n * 520;
              s("AH-66B", 1, !1, {
                pos: vec(this.world.canyonCenter(r) + (n % 2 ? 260 : -260), 200 + (n % 3) * 80, r),
                speed: 18,
              });
            }
            this.timerLimit = 330;
          }
          break;
        case 11:
          (s("R-5050", 1, !1, {
            ally: !0,
            protected: !0,
            role: "escort",
            hp: 210,
            pos: vec(0, 1050, -1e3),
            speed: 110,
          }),
            s("F/A-32C", 5, !0, { attackAlly: !0, pos: vec(1600, 1100, -3100), spread: vec(140, 40, 300) }));
          break;
        case 12:
          (s("R-531", 6, !0, { hp: 88, speed: 160, pos: vec(0, 9800, -1800), spread: vec(420, 110, 300) }),
            s("R-311", 8, !1, { pos: vec(0, 9300, -800), spread: vec(300, 40, 230) }),
            (this.timerLimit = 300));
          break;
        case 13:
          (s("Base", 8, !0),
            s("Gun", 2, !0),
            s("Gun", 7),
            s("MSSL", 4),
            s("R-102", 3),
            s("R-201", 2),
            s("R-211", 2),
            s("R-701", 3),
            (this.phaseLimit = 360));
          break;
        case 14:
          e
            ? (s("F/A-32C", 5, !0), (this.entities.at(-1).required = !1))
            : (s("Antlion", 10, !0, { kind: "cargo", pos: vec(0, 1200, -1700), spread: vec(210, 40, 140) }),
              s("C-17B", 1),
              s("F/A-32C", 3));
          break;
        case 15:
          e
            ? s("F-22C", 3, !0, { attackAlly: !0 })
            : (s("R-808", 1, !1, {
                ally: !0,
                protected: !0,
                role: "escort",
                hp: 230,
                pos: vec(0, 1100, -1800),
                speed: 110,
              }),
              s("F-22C", 4, !0, { attackAlly: !0 }),
              (this.timerLimit = 240));
          break;
        case 16:
          (s("Satellite", 4, !0, { hp: 80 }), (this.timerLimit = 180));
          break;
        case 17:
          for (let n = 0; n < 9; n++)
            s("A.Train", 1, n % 3 !== 2, {
              kind: "train",
              gunOnly: !0,
              neutral: n % 3 === 2,
              trainIndex: n,
              pos: vec(0, 125, -1800 + n * 85),
              hp: 45,
              speed: 33,
            });
          (s("F/A-32C", 6), (this.timerLimit = 270));
          break;
        case 18:
          for (let n = 0; n < 4; n++)
            for (let r = 0; r < 6; r++) {
              let a = (n % 2 ? 1 : -1) * 1200 + Math.sin(r) * 150,
                l = -900 - Math.floor(n / 2) * 2e3 + Math.cos(r) * 160;
              s("Nanobite", 1, !0, { pos: vec(a, this.world.heightAt(a, l) + 30, l), gunOnly: !0 });
            }
          break;
        case 19:
          (s("R-531", 4, !0, { hp: 88, pos: vec(0, 9600, -1500), spread: vec(540, 50, 260), speed: 190 }),
            (this.phaseLimit = 90));
          break;
        case 20:
          for (let n = 0; n < 3; n++)
            (i("Convoy", !0, 0, { pos: vec((n % 2 ? 1 : -1) * 350, 15, -1e3 - n * 1900), sheltered: !1 }),
              i("Submarine", !0, 0, { pos: vec((n % 2 ? 1 : -1) * 850, 15, -1500 - n * 1900), sheltered: !0 }));
          (s("Gun", 6, !0), s("R-201", 2), s("R-211", 10), s("R-701", 8), (this.phaseLimit = 540));
          break;
        case 21:
          e
            ? e === 1
              ? (s("Su-43", 2, !0), s("XFA-36A", 2, !0))
              : s("UI-4054", 1, !0, { hp: 176, turn: 1.15, speed: 290 })
            : this.carrier({ pos: vec(0, 1100, -2200) });
          break;
        case 22:
          (s("Pr.Plant", 2, !0, { pos: vec(1100, 45, -2500), spread: vec(1700, 0, 1400) }),
            s("Radarsite", 7),
            s("AH-66B", 2));
          break;
        case 23:
          if (e) {
            (s("MSSL", 6), s("Gun", 12));
            for (let n = 0; n < 4; n++) i("Convoy", !0);
            for (let n = 0; n < 2; n++) i("Carrier", !0);
            s("V-22B", 5, !1, { neutral: !0 });
          } else {
            s("Su-43", 1, !1, { ally: !0, role: "wingman", hp: 400, pos: vec(-330, 950, 1200) });
            for (let [n, r] of [
              ["R-101", 5],
              ["R-102", 5],
              ["R-103", 6],
              ["R-201", 5],
              ["R-211", 5],
            ])
              s(n, r, !0);
          }
          break;
        case 24:
          e
            ? (s("R-103", 2, !0), s("F/A-32C", 2, !0))
            : (s("R-102", 3),
              s("R-103", 4),
              s("F-22C", 6),
              s("XFA-36A", 7),
              [0, 3, 7, 10, 13, 17].forEach((n) => (this.entities[n].required = !0)),
              s("V-22B", 4, !1, { neutral: !0 }));
          break;
        case 25:
          e
            ? (s("V-22B", 1, !0, { pos: vec(0, 80, -2e3), speed: 0, sheltered: !0, role: "hangarEscape" }),
              (this.p.pos = vec(0, 110, 1100)),
              (this.p.yaw = 0),
              (this.p.pitch = 0))
            : (s("Base", 4, !0),
              s("R-211", 3, !0),
              s("Su-37", 3),
              (this.entities.at(-1).required = !0),
              (this.entities.at(-2).required = !0),
              s("Su-43", 4),
              s("MSSL", 3),
              s("Gun", 6));
          break;
        case 26:
          if (e) {
            for (let n = 0; n < 2; n++)
              i("Convoy", !0, 0, { pos: vec(-2600, 15, -3500 + n * 300), speed: 13, role: "recoveryThreat" });
            (s("Hydrofoil", 4, !0, {
              pos: vec(2500, 15, -3e3),
              spread: vec(160, 0, 160),
              speed: 21,
              role: "recoveryThreat",
            }),
              s("C-17B", 2),
              (this.phaseLimit = 150));
          } else {
            (s("Satellite", 1, !1, { ally: !0, kind: "ship", pos: vec(0, 12, -3500), hp: 200, role: "capsule" }),
              s("Hydrofoil", 4, !1, {
                ally: !0,
                role: "recovery",
                pos: vec(1e3, 13, -1700),
                spread: vec(100, 0, 160),
                hp: 110,
                speed: 12,
              }),
              i("Carrier", !0, 3, { pos: vec(-1100, 15, -2800), speed: 8, role: "recoveryThreat" }));
            for (let n = 0; n < 4; n++)
              i("Convoy", !0, n < 3 ? 2 : 0, {
                pos: vec(-1700 - n * 250, 15, -3e3 - n * 260),
                speed: 10,
                role: "recoveryThreat",
              });
            (s("XFA-36A", 6, !1, { attackAlly: !0 }), s("F-22C", 2, !1, { attackAlly: !0 }), (this.phaseLimit = 116));
          }
          break;
        case 27:
          (s("Carrier", 1, !1, { ally: !0, pos: vec(0, 5, 4e3) }),
            s("F-15S/MT", 2),
            s("Radarsite", 8, !0, { pos: vec(0, 240, -4e3), spread: vec(390, 0, 130) }),
            s("MSSL", 2),
            s("Gun", 4));
          break;
        case 28:
          e
            ? (s("Tank", 4, !0),
              s("Base", 2, !0),
              s("Su-37", 2, !0, { attackAlly: !0 }),
              s("Su-43", 6, !0, { attackAlly: !0 }),
              s("R-201U", 1, !1, {
                ally: !0,
                protected: !0,
                role: "escort",
                hp: 280,
                pos: vec(0, 450, -1800),
                speed: 100,
              }))
            : (s("R-201U", 1, !0),
              s("R-101U", 2),
              (this.entities.at(-2).required = !0),
              s("Su-37", 4),
              s("Tank", 10, !0));
          break;
        case 29:
          e
            ? (this.carrier({ pos: vec(0, 1200, -2800) }), s("R-103", 2), s("Su-32", 2))
            : (s("XFA-35A", 6, !0), s("Su-37", 10), (this.entities.at(-1).required = !0));
          break;
        case 30:
          e
            ? (this.carrier({ pos: vec(0, 1350, -2700) }), s("R-103", 6))
            : (s("XFA-36A", 8),
              i("S.Warship", !0, 2),
              i("S.Warship", !0, 2),
              i("S.Warship", !0, 2),
              i("Carrier", !0, 3));
          break;
        case 31:
          break;
        case 32:
          s("X-49", 1, !0, { hp: 352, pos: vec(0, 800, -1700), speed: 290, turn: 1.1 });
          break;
        case 33:
          for (let n = 0; n < 10; n++) {
            let r = (n / 10) * Math.PI * 2;
            s("Timer", 1, !0, { pos: vec(Math.sin(r) * 2400, 730, -2400 + Math.cos(r) * 1700), gunOnly: !0, hp: 72 });
          }
          s("X-49", 1, !1, { invulnerable: !0, counts: !1, speed: 310 });
          break;
        case 34:
          e
            ? s("UI-4051 Aurora", 1, !0, { hp: 264, speed: 315, turn: 1.35 })
            : (s("X-49", 1, !0, { hp: 352, speed: 300, turn: 1.2 }), s("R-103", 2), s("XFA-36A", 2), s("Su-43", 2));
          break;
        case 35:
          (s("UI-4054 Aurora", 1, !0, { hp: 132, speed: 285, turn: 1.2, pos: vadd(this.p.pos, vec(0, 100, -1300)) }),
            e === 1 &&
              ((this.world = buildWorld("cyber", 350)),
              this.worldVersion++,
              this.emit("banner", { title: "ELECTROSPHERE", subtitle: "REALITY LINK SEVERED" })));
          break;
        case 36:
          s("XR-900", 8, !0, { hp: 132, speed: 275, turn: 1.2, pos: vec(0, 1e3, -1800), spread: vec(330, 30, 280) });
          break;
        case 37:
          e ? s("R-101", 2, !0) : s("Beacon", 4, !0, { photo: !0 });
          break;
        case 38:
          (s("R-5050", 1, !1, { ally: !0, protected: !0, role: "escort", hp: 250, speed: 90, pos: vec(0, 950, -1600) }),
            s("F/A-32C", 6, !0, { attackAlly: !0 }));
          break;
        case 39:
          e ? s("UI-4054", 1, !0, { hp: 220, speed: 285, turn: 1.2 }) : s("Relay", 3, !0, { hp: 88 });
          break;
      }
      (this.chooseTarget(), this.worldVersion++);
    }
    updateText(e, t) {
      return (
        {
          1: "Transports confirmed down. Reinforcements approaching from the south.",
          2: "Radar network cleared. Strike the northern base and bridge.",
          3:
            t === 1
              ? "Formation complete. Guns for the decoys, missiles for the towers."
              : "Training suspended. Intercept the parachuting containers.",
          4: "Inbound fighters are approaching Megafloat. Intercept.",
          6: "Photography confirmed. Hostile response aircraft inbound.",
          7: "Cargo aircraft is safe. Neutralize the launched hydrofoil.",
          9: "The central core is exposed. Attack it from above.",
          10: "Chemical weapons factory located. You are cleared to engage.",
          14: "The tanks are gone. Enemy fighters approaching from the north.",
          15: "Second wave is closing on the shuttle. Stay alert.",
          21:
            t === 1
              ? "Carrier systems disabled. Clear its escort screen."
              : "A UI-4054 has escaped the carrier. Pursue it.",
          23: "Airspace clear. Shift your attention to the naval force.",
          24: "Four additional targets in the southeast district.",
          25: "Enemy personnel are evacuating through the underground hangar. Low approach.",
          26: "A second recovery fleet is inbound. Fast hydrofoils are the priority.",
          28: "Chairman recovered. Protect the R-201U on the way out.",
          29: "Aerial carrier identified to the north. Strike the underside.",
          30: "Megafloat is breaking apart. Intercept the carrier above the islands.",
          34: "Night Raven destroyed. Aurora inbound from the north.",
          35: "You are crossing into the Electrosphere. Maintain altitude. Trust the radar.",
          37: "Emergency beacons restored. Clear the rogue patrol.",
          39: "Relay network offline. A combat process is still active.",
        }[e] || "New target information uploaded to your flight systems."
      );
    }
    chooseTarget(e = !1) {
      let t = this.p,
        s = heading(t.yaw, t.pitch),
        i = this.entities.filter((n) => n.alive && !n.ally && (!n.neutral || n.photo) && !n.invulnerable);
      if (
        (i.sort((n, r) => {
          let a = (l) => {
            let c = vsub(l.pos, t.pos),
              u = vlen(c),
              h = vdot(vnorm(c), s);
            return (l.required ? 800 : 0) + h * 2600 - u * 0.15 + (l.photo ? 300 : 0);
          };
          return a(r) - a(n);
        }),
        e)
      ) {
        let n = i.findIndex((r) => r.id === this.targetId);
        this.targetId = i[(n + 1) % i.length]?.id ?? null;
      } else this.targetId = i[0]?.id ?? null;
      return ((this.lock = 0), this.target);
    }
    get target() {
      return this.entities.find((e) => e.id === this.targetId && e.alive);
    }
    get jammerActive() {
      return this.time % 105 < 90;
    }
    get remaining() {
      return this.timerLimit
        ? Math.max(0, this.timerLimit - this.time)
        : this.phaseLimit
          ? Math.max(0, this.phaseLimit - this.phaseTime)
          : null;
    }
    get objectiveProgress() {
      return this.mission?.id === 3 && this.phase === 0
        ? `FORMATION ${Math.floor(this.score)} / 3200`
        : this.mission?.id === 31
          ? `EXIT ${Math.max(0, Math.ceil((18e3 + this.p.pos.z) / 1e3))} KM`
          : this.mission?.id === 10 && this.phase === 0
            ? "FOLLOW THE RECON AIRCRAFT"
            : `${this.primary().length.toString().padStart(2, "0")} PRIMARY TARGETS`;
    }
    tick(e) {
      if (((e = clamp(e, 0, 0.05)), this.frameCount++, (this.demoTime += e), this.state === "menu")) {
        ((this.p.roll = -0.12 + Math.sin(this.demoTime * 0.25) * 0.08),
          (this.p.pitch = 0.02 + Math.sin(this.demoTime * 0.2) * 0.02));
        return;
      }
      if (this.state === "playing") {
        ((this.time += e),
          (this.phaseTime += e),
          (this.pilot.data.playTime += e),
          (this.gunCooldown -= e),
          (this.missileCooldown -= e),
          (this.flareCooldown = Math.max(0, this.flareCooldown - e)),
          (this.evade = Math.max(0, this.evade - e)),
          (this.cameraShake *= Math.exp(-e * 8)));
        for (let t = 0; t < this.p.racks.length; t++) this.p.racks[t] = Math.max(0, this.p.racks[t] - e);
        ((this.heat = Math.max(0, this.heat - e * 0.2)),
          this.heat < 0.28 && (this.overheated = !1),
          this.updatePlayer(e),
          this.state === "playing" &&
            (this.updateEnemies(e),
            this.updateLocks(e),
            this.updateProjectiles(e),
            this.updateEffects(e),
            this.input.gun && this.fireGun(),
            this.input.missile && this.fireMissile(),
            this.updateObjectives(e)));
      }
    }
    updatePlayer(e) {
      let t = this.p,
        s = this.input,
        i = AIRCRAFT[t.plane],
        n = this.pilot.data.settings.assist,
        r = this.pilot.data.settings.sensitivity,
        a = clamp(s.x * r, -1, 1),
        l = clamp(s.y * r * (this.pilot.data.settings.invert ? -1 : 1), -1, 1),
        c = 560 + i.stats[0] * 13 + this.pilot.data.upgrades.engine * 25;
      this.mission.id === 31 && (c = 450);
      let u = s.boost ? c : s.brake ? (n ? 135 : 85) : 300 + i.stats[0] * 6,
        h = (0.54 + i.stats[4] * 0.045) * (s.brake ? 1.45 : s.boost ? 0.73 : 1) * (this.mission.id === 16 ? 0.65 : 1);
      ((t.speed = lerp(t.speed, u, Math.min(1, e * (0.42 + i.stats[0] * 0.12)))),
        (t.yaw += a * h * e),
        (t.pitch = clamp(t.pitch + l * h * 0.8 * e, -1.42, 1.42)),
        Math.abs(l) < 0.04 && n && (t.pitch *= Math.exp(-e * 0.09)),
        (t.roll = lerp(t.roll, -a * 0.92, Math.min(1, e * 4))),
        t.speed < 112 && ((t.pitch -= e * 0.45), (this.groundWarning = !0)));
      let d = this.world.heightAt(t.pos.x, t.pos.z),
        p = this.world.ceiling;
      ((this.groundWarning = t.pos.y - d < 180 || t.pos.y > p - 150),
        n && this.groundWarning && t.pos.y - d < 135 && t.pitch < 0 && (t.pitch = lerp(t.pitch, 0.2, e * 7)),
        n && t.pos.y > p - 150 && t.pitch > 0 && (t.pitch = lerp(t.pitch, -0.15, e * 8)));
      let f = heading(t.yaw, t.pitch);
      t.vel =
        this.mission.id === 16
          ? vadd(vscale(t.vel, Math.exp(-e * 0.32)), vscale(f, t.speed * (1 - Math.exp(-e * 0.32))))
          : vscale(f, t.speed);
      let m = { ...t.pos };
      if (((t.pos = vadd(t.pos, vscale(t.vel, e))), t.pos.y < d + 9 || t.pos.y > p - 6)) {
        this.fail(t.pos.y > p - 6 ? "CEILING COLLISION" : "TERRAIN COLLISION");
        return;
      }
      for (let x of this.world.buildings)
        if (
          Math.abs(t.pos.x - x.x) < x.w * 0.5 + 8 &&
          Math.abs(t.pos.z - x.z) < x.d * 0.5 + 8 &&
          t.pos.y < x.y + x.h + 8
        ) {
          this.fail("STRUCTURE COLLISION");
          return;
        }
      if (this.mission.id === 31) {
        let x = this.tunnelWidth(t.pos.z) / 2;
        if (Math.abs(t.pos.x) > x - 8) {
          this.fail("TUNNEL WALL COLLISION");
          return;
        }
        for (let b of this.world.gates)
          if (m.z > b.z + 12 && t.pos.z <= b.z + 12) {
            let _ = b.width / b.lanes,
              T = -b.width / 2 + _ * (b.open + 0.5);
            if (Math.abs(t.pos.x - T) > _ * 0.4 || t.pos.y < 85 || t.pos.y > 610) {
              this.fail("BLAST DOOR COLLISION");
              return;
            }
            (this.emit("gate", { index: this.world.gates.indexOf(b) }),
              this.emit("radio", { speaker: "NAV / PIXEL", text: "Clear. Next gate uploaded." }));
          }
      }
      let g = this.mission.id === 31 ? 26e3 : 14e3;
      Math.abs(t.pos.x) > g || Math.abs(t.pos.z) > g || t.pos.y > 26e3
        ? ((this.outTime += e), this.outTime > 12 && this.fail("LEFT THE OPERATION AREA"))
        : (this.outTime = 0);
    }
    tunnelWidth(e) {
      return e < -11400 ? 820 : 1050;
    }
    nextGate() {
      return this.world.gates.find((e) => e.z < this.p.pos.z - 25);
    }
    updateEnemies(e) {
      let t = this.p,
        s = this.difficulty === "hard",
        i = this.difficulty === "easy";
      for (let n of this.entities) {
        if (!n.alive) continue;
        if (((n.age += e), (n.fireTimer -= e), n.parent)) {
          let d = this.entities.find((p) => p.id === n.parent);
          if (d?.alive)
            if (n.role === "carrierNode") {
              let p = +n.name.slice(-1) - 1;
              n.pos = vadd(d.pos, vec((p % 2 ? 1 : -1) * 55, -42, (p < 2 ? -1 : 1) * 65));
            } else n.pos = vadd(d.pos, vec(n.seed % 2 > 1 ? 20 : -20, 15, ((n.id % 3) - 1) * 35));
          continue;
        }
        let r = { ...n.pos };
        if (n.role === "leader") {
          let d = this.phaseTime,
            p = Math.sin(d * 0.08) * 0.65;
          ((n.yaw = p),
            (n.pitch = Math.sin(d * 0.13) * 0.22),
            (n.pos = vadd(n.pos, vscale(heading(n.yaw, n.pitch), n.speed * e))));
        } else if (n.role === "canyonLeader")
          ((n.pos.z -= n.speed * e),
            (n.pos.x = this.world.canyonCenter(n.pos.z)),
            (n.pos.y = 320 + Math.sin(n.age * 0.2) * 50),
            (n.yaw = Math.atan2(this.world.canyonCenter(n.pos.z - 20) - n.pos.x, 20)));
        else if (n.role === "escort" || n.role === "cargoEscort") {
          if (
            ((n.pos.z -= n.speed * e),
            (n.pos.x = Math.sin(n.age * 0.04) * 300),
            (n.yaw = -Math.cos(n.age * 0.04) * 0.08),
            n.role === "cargoEscort")
          ) {
            n.pos.y = Math.max(150, 470 - n.age * 0.7);
            let d = this.entities.find(
              (p) => p.alive && p.required && p.name !== "Hydrofoil" && p.pos.z > n.pos.z - 160,
            );
            if (d && n.age > 15 && Math.abs(d.pos.z - n.pos.z) < 180) {
              this.fail("CARGO AIRCRAFT HIT AN OBSTACLE");
              return;
            }
          }
        } else if (n.role === "recovery" || n.role === "recoveryThreat") {
          let d = this.entities.find((p) => p.role === "capsule");
          if (d) {
            let p = vsub(d.pos, n.pos);
            if (
              ((n.yaw = Math.atan2(p.x, -p.z)),
              (n.pos = vadd(n.pos, vscale(vnorm(p), n.speed * e))),
              vlen(p) < 130 && n.role === "recoveryThreat")
            ) {
              this.fail("ENEMY CAPTURED THE SATELLITE");
              return;
            }
            if (vlen(p) < 110 && n.role === "recovery") {
              ((this.rankCap = "B"), this.finish());
              return;
            }
          }
        } else if (n.role === "departing") ((n.pos.z += n.speed * e), (n.yaw = Math.PI));
        else if (n.kind === "train")
          ((n.pos.z = -1800 - this.time * 32 + n.trainIndex * 85),
            (n.pos.x = Math.sin(n.pos.z * 5e-4) * 350),
            (n.pos.y = this.world.heightAt(n.pos.x, n.pos.z) + 20),
            (n.yaw = -Math.cos(n.pos.z * 5e-4) * 0.17));
        else if (n.kind === "cargo")
          n.pos.y = Math.max(this.world.heightAt(n.pos.x, n.pos.z) + 25, n.pos.y - e * (n.name === "Antlion" ? 3 : 8));
        else if (n.name === "IRBM") {
          if (((n.pos.y += e * 85), (n.pos.z -= e * 430), n.age > 30)) {
            this.fail("BALLISTIC MISSILE ESCAPED");
            return;
          }
        } else if (n.kind === "aircraft" || n.kind === "helicopter" || n.kind === "airship")
          if (n.role === "hangarEscape") ((n.pos.y += e * 3), (n.pos.z -= e * 25));
          else if (n.neutral)
            ((n.pos.x = n.initial.x + Math.sin(n.age * 0.12) * 150),
              (n.pos.z = n.initial.z + Math.cos(n.age * 0.12) * 150),
              (n.yaw = n.age * 0.12));
          else if (n.ally && n.role === "wingman") {
            let d = this.entities.find((m) => m.alive && m.required && m.kind === "aircraft"),
              p = d?.pos || vadd(t.pos, vec(-300, 80, -300)),
              f = vnorm(vsub(p, n.pos));
            ((n.pos = vadd(n.pos, vscale(f, 230 * e))),
              (n.yaw = Math.atan2(f.x, -f.z)),
              d &&
                n.fireTimer < 0 &&
                vdist(n.pos, d.pos) < 1700 &&
                ((n.fireTimer = 7), this.makeProjectile(n, d, "Msl", !0)));
          } else if (/^R-50|^R-53|^C-17/.test(n.name) || n.kind === "airship")
            ((n.pos.z -= n.speed * e),
              (n.pos.x += Math.sin(n.age * 0.075 + n.seed) * e * 25),
              (n.yaw = -0.05 * Math.sin(n.age * 0.075 + n.seed)),
              n.pos.z < -9e3 && ((n.pos.z = 1200), (n.pos.x = -n.pos.x)));
          else {
            let d = n.attackAlly
                ? this.entities.find((w) => w.alive && w.ally && ["escort", "recovery"].includes(w.role))
                : null,
              p = d?.pos || t.pos,
              f = vdist(n.pos, p);
            if (n.boss) {
              let w = 850 + Math.sin(n.age * 0.3) * 400,
                v = n.age * (this.bossHack ? 0.3 : 0.22) + n.seed;
              p = vadd(t.pos, vec(Math.sin(v) * w, Math.sin(v * 0.8) * 250, -Math.cos(v) * w));
            } else if (!d && f < 1100) {
              let w = n.age * 0.22 + n.seed;
              p = vadd(t.pos, vec(Math.sin(w) * 1500, Math.sin(w * 0.6) * 160, -Math.cos(w) * 1500));
            }
            let m = vnorm(vsub(p, n.pos)),
              g = Math.atan2(m.x, -m.z),
              x = Math.asin(clamp(m.y, -1, 1)),
              b = n.turn * (n.boss ? 1.25 : 1) * (s ? 1.18 : i ? 0.78 : 1),
              _ = clamp(angleDiff(g, n.yaw), -b * e, b * e);
            ((n.yaw += _),
              (n.pitch = lerp(n.pitch, clamp(x, -0.65, 0.65), e * 1.3)),
              (n.roll = lerp(n.roll, -_ / Math.max(e, 0.001), e * 3)),
              n.speed && (n.pos = vadd(n.pos, vscale(heading(n.yaw, n.pitch), n.speed * e))));
            let T = this.world.heightAt(n.pos.x, n.pos.z);
            n.pos.y = clamp(n.pos.y, Math.max(110, T + 110), Math.min(22e3, this.world.ceiling - 180));
          }
        if (
          ((n.vel = vscale(vsub(n.pos, r), 1 / (e || 0.016))),
          !n.hostile ||
            n.neutral ||
            n.ally ||
            n.photo ||
            n.parked ||
            (this.bossHack && this.mission.id === 36) ||
            !(["aircraft", "airship", "ship"].includes(n.kind) || ["Gun", "MSSL", "AA Gun"].includes(n.name)) ||
            /^R-50|^R-53|^C-17/.test(n.name))
        )
          continue;
        let l = n.attackAlly
            ? this.entities.find((d) => d.alive && d.ally && ["escort", "recovery"].includes(d.role))
            : null,
          c = l || t,
          u = vdist(n.pos, c.pos),
          h = vnorm(vsub(c.pos, n.pos));
        if (
          n.fireTimer <= 0 &&
          u < 2500 &&
          u > 150 &&
          (n.kind !== "aircraft" || vdot(h, heading(n.yaw, n.pitch)) > 0.65)
        ) {
          if (
            ((n.fireTimer = (n.boss ? 5 : 8) + this.rng() * 7 + (i ? 6 : 0) - (s ? 2 : 0)),
            !l && this.time - this.lastEnemyShot < (i ? 3.8 : s ? 1.2 : 2.5))
          )
            continue;
          (l || (this.lastEnemyShot = this.time),
            this.makeProjectile(n, c, n.name === "Gun" ? "enemyGun" : "enemy", !1),
            l || this.emit("warning", { text: "MISSILE INBOUND" }));
        }
      }
    }
    updateLocks(e) {
      let t = this.target,
        s = heading(this.p.yaw, this.p.pitch);
      if (!t) t = this.chooseTarget();
      else {
        let d = vnorm(vsub(t.pos, this.p.pos));
        vdot(s, d) < -0.2 && this.frameCount % 90 === 0 && (t = this.chooseTarget());
      }
      if (!t) {
        this.lock = 0;
        return;
      }
      let i = WEAPONS[this.p.missile],
        n = vsub(t.pos, this.p.pos),
        r = vdot(vnorm(n), s),
        a = vlen(n),
        l =
          !t.gunOnly &&
          !t.invulnerable &&
          (this.p.missile !== "GrM" || ["ground", "ship", "train"].includes(t.kind)) &&
          !["Spread Bomb", "Anti-Nanobite Bomb"].includes(this.p.missile),
        c = this.pilot.data.settings.assist ? 0.88 : 0.94,
        u = r > c && a < i.range && a > 55 && l;
      t.id !== this.lockId && ((this.lock = 0), (this.lockId = t.id));
      let h = this.lock;
      ((this.lock = clamp(this.lock + (u ? e * (1.8 + this.pilot.data.upgrades.link * 0.25) : -e * 3), 0, 1)),
        h < 1 && this.lock === 1 && this.emit("lock"));
    }
    canDamage(e, t, s) {
      return !(
        !e.alive ||
        e.invulnerable ||
        e.photo ||
        (e.name === "Nanobite" && s !== "Anti-Nanobite Bomb") ||
        (e.weakTop && t.y < e.pos.y + 60) ||
        (e.weakUnder && t.y > e.pos.y + 90) ||
        (e.sheltered && t.y > e.pos.y + 260)
      );
    }
    fireGun() {
      if (this.state !== "playing" || this.gunCooldown > 0 || this.overheated) return !1;
      let e = this.p,
        t = WEAPONS[e.gun],
        s = heading(e.yaw, e.pitch);
      ((this.gunCooldown = t.rate),
        (this.heat += t.heat),
        this.heat >= 1 && ((this.heat = 1), (this.overheated = !0), this.emit("warning", { text: "GUN OVERHEAT" })));
      let i = null,
        n = 1 / 0,
        r = this.pilot.data.settings.assist ? 0.987 : 0.997;
      for (let c of this.entities) {
        if (!c.alive || c.invulnerable) continue;
        let u = vsub(c.pos, e.pos),
          h = vlen(u);
        h < t.range && vdot(vnorm(u), s) > r && h < n && ((n = h), (i = c));
      }
      let a = vadd(e.pos, vscale(s, 35)),
        l = i ? { ...i.pos } : vadd(a, vscale(s, t.range));
      return (
        this.effects.push({
          type: t.name.includes("Laser") || e.gun === "Neutron Beam" ? "beam" : "tracer",
          from: a,
          pos: l,
          life: 0.1,
          maxLife: 0.1,
          color: e.gun === "Las" ? "#ff615c" : e.gun === "Pul" ? "#6dfff1" : "#e9ffa4",
          width: e.gun === "Can" ? 3 : 1.5,
        }),
        this.emit("gun", { weapon: e.gun }),
        this.shots++,
        i && this.canDamage(i, e.pos, e.gun) && (this.hits++, this.damage(i, t.damage, e.gun, e.pos)),
        !0
      );
    }
    fireMissile() {
      if (this.state !== "playing" || this.missileCooldown > 0) return !1;
      let e = this.p,
        t = WEAPONS[e.missile],
        s = this.target;
      if (s?.photo) {
        let r = vsub(s.pos, e.pos);
        return vlen(r) < 3200 && vdot(vnorm(r), heading(e.yaw, e.pitch)) > 0.969
          ? ((this.missileCooldown = 0.8), this.damagePhoto(s), !0)
          : ((this.missileCooldown = 0.35), this.emit("warning", { text: "ALIGN CAMERA RETICLE" }), !1);
      }
      let i = e.racks.findIndex((r) => r <= 0);
      if (i < 0 || e.ammo <= 0)
        return (
          e.ammo <= 0 &&
            (this.emit("warning", { text: "MISSILES DEPLETED \u2014 USE GUNS" }), (this.missileCooldown = 0.6)),
          !1
        );
      if (
        (e.ammo--,
        (e.racks[i] = t.reload),
        (this.missileCooldown = 0.24),
        this.shots++,
        this.emit("missile", { weapon: e.missile }),
        e.missile === "OSL")
      )
        return this.lock < 1 || !s
          ? (e.ammo++, (e.racks[i] = 0), this.emit("warning", { text: "OSL REQUIRES A LOCK" }), !1)
          : (this.effects.push({
              type: "beam",
              from: vadd(s.pos, vec(0, 7e3, 0)),
              pos: { ...s.pos },
              life: 0.65,
              maxLife: 0.65,
              color: "#a6ffff",
              width: 20,
            }),
            this.canDamage(s, e.pos, "OSL") && (this.damage(s, 1e4, "OSL", e.pos), this.hits++),
            !0);
      if (e.missile === "Plasma Beam") {
        let r = heading(e.yaw, e.pitch),
          a = s && this.lock >= 1 ? s : null;
        return (
          a ||
            (a = this.entities.find(
              (l) => l.alive && !l.ally && vdist(l.pos, e.pos) < t.range && vdot(vnorm(vsub(l.pos, e.pos)), r) > 0.98,
            )),
          this.effects.push({
            type: "beam",
            from: { ...e.pos },
            pos: a ? { ...a.pos } : vadd(e.pos, vscale(r, 5e3)),
            life: 0.35,
            maxLife: 0.35,
            color: "#bf9fff",
            width: 9,
          }),
          a && this.canDamage(a, e.pos, e.missile) && (this.damage(a, t.damage, e.missile, e.pos), this.hits++),
          !0
        );
      }
      let n = this.makeProjectile(e, this.lock >= 1 ? s : null, e.missile, !0);
      return ((n.pos = vadd(n.pos, vec(i % 2 ? 10 : -10, -4, 0))), !0);
    }
    makeProjectile(e, t, s, i = !0) {
      let n = s === "enemy" || s === "enemyGun",
        r = ["Spread Bomb", "Anti-Nanobite Bomb"].includes(s),
        a = WEAPONS[s] || {
          speed: s === "enemyGun" ? 1300 : 670,
          damage: s === "enemyGun" ? 7 : 18,
          turn: s === "enemyGun" ? 0 : 0.9,
          range: 4200,
        },
        l = heading(e.yaw || 0, e.pitch || 0);
      n && t && (l = vnorm(vsub(t.pos, e.pos)));
      let c = {
        id: nextEntityId++,
        pos: vadd(e.pos, vscale(l, 30)),
        previous: { ...e.pos },
        origin: { ...e.pos },
        vel: vscale(l, r ? e.speed || 300 : a.speed),
        target: t === this.p ? "player" : (t?.id ?? null),
        weapon: s,
        player: i,
        enemy: n,
        bomb: r,
        damage: a.damage,
        speed: a.speed,
        turn: a.turn,
        life: 0,
        maxLife: r ? 16 : 7,
        trail: [],
        split: !1,
        owner: e.id || 0,
      };
      return (r && (c.vel.y -= 80), this.projectiles.push(c), c);
    }
    flare() {
      if (this.state !== "playing" || this.flareCooldown > 0 || this.p.flares <= 0) return !1;
      (this.p.flares--, (this.flareCooldown = 8), (this.evade = 1.05), (this.cameraShake = 0.3));
      for (let e of this.projectiles)
        e.target === "player" &&
          vdist(e.pos, this.p.pos) < 3400 &&
          ((e.target = null),
          (e.maxLife = Math.min(e.maxLife, e.life + 1.6)),
          (e.vel = vadd(e.vel, vec((this.rng() - 0.5) * 250, -160, (this.rng() - 0.5) * 250))));
      for (let e = 0; e < 16; e++)
        this.effects.push({
          type: "flare",
          pos: { ...this.p.pos },
          vel: vec((this.rng() - 0.5) * 240, -20 - this.rng() * 110, (this.rng() - 0.5) * 200),
          life: 2.5,
          maxLife: 2.5,
          size: 5,
          color: "#ffce86",
        });
      return (this.emit("flare"), !0);
    }
    updateProjectiles(e) {
      let t = [];
      for (let s of this.projectiles) {
        ((s.life += e), (s.previous = { ...s.pos }));
        let i = s.target === "player" ? this.p : this.entities.find((r) => r.id === s.target && r.alive);
        if ((s.target === "player" && this.evade > 0 && ((i = null), (s.target = null)), i && s.turn)) {
          let r = vnorm(vsub(vadd(i.pos, vscale(i.vel || vec(), 0.1)), s.pos)),
            a = vnorm(s.vel),
            l = clamp(vdot(a, r), -1, 1),
            c = Math.acos(l),
            u = c < 0.001 ? 1 : Math.min(1, (s.turn * e) / c);
          s.vel = vscale(vnorm(vadd(vscale(a, 1 - u), vscale(r, u))), s.speed);
        }
        if (
          (s.bomb && (s.vel.y -= 150 * e),
          (s.pos = vadd(s.pos, vscale(s.vel, e))),
          this.frameCount % 2 === 0 && (s.trail.push({ ...s.pos }), s.trail.length > 12 && s.trail.shift()),
          s.weapon === "MIRV" && !s.split && s.life > 0.5 && i && vdist(s.pos, i.pos) < 800)
        ) {
          ((s.split = !0), (s.life = s.maxLife));
          let r = this.entities
            .filter((a) => a.alive && !a.neutral && !a.ally && !a.invulnerable && vdist(a.pos, i.pos) < 1500)
            .sort((a, l) => vdist(a.pos, i.pos) - vdist(l.pos, i.pos));
          for (let a = 0; a < 3; a++) {
            let l = r[a % Math.max(1, r.length)] || i;
            t.push({
              ...s,
              id: nextEntityId++,
              weapon: "MIRV child",
              pos: vadd(s.pos, vec((a - 1) * 14, 0, 0)),
              vel: vscale(vnorm(vsub(l.pos, s.pos)), 1050),
              speed: 1050,
              turn: 3.5,
              target: l.id,
              life: 0,
              maxLife: 5,
              trail: [],
              split: !0,
            });
          }
          continue;
        }
        let n = this.world.heightAt(s.pos.x, s.pos.z);
        if (s.pos.y <= Math.max(0, n) + 9) {
          (s.bomb ? this.blast(s) : this.explode(s.pos, 24), (s.life = s.maxLife));
          continue;
        }
        if (s.pos.y > this.world.ceiling) {
          s.life = s.maxLife;
          continue;
        }
        if (!s.player)
          s.target === "player" || s.target === null
            ? this.segmentDistance(this.p.pos, s.previous, s.pos) < 35 &&
              (this.damagePlayer(s.damage), (s.life = s.maxLife))
            : i &&
              this.segmentDistance(i.pos, s.previous, s.pos) < i.radius + 15 &&
              (this.damage(i, s.damage, s.weapon, s.origin, !1), (s.life = s.maxLife));
        else if (!s.bomb) {
          let r = null,
            a = 1 / 0;
          for (let l of this.entities) {
            if (!l.alive || l.id === s.owner || (l.invulnerable && !l.weakUnder)) continue;
            let c = this.segmentDistance(l.pos, s.previous, s.pos);
            c < l.radius + 18 && c < a && ((r = l), (a = c));
          }
          r &&
            (this.canDamage(r, s.origin, s.weapon)
              ? (this.hits++, this.damage(r, s.damage, s.weapon, s.origin))
              : this.emit("ricochet"),
            this.explode(s.pos, 28),
            (s.life = s.maxLife));
        }
      }
      this.projectiles = this.projectiles.filter((s) => s.life < s.maxLife).concat(t);
    }
    segmentDistance(e, t, s) {
      let i = vsub(s, t),
        n = vdot(i, i),
        r = clamp(vdot(vsub(e, t), i) / (n || 1), 0, 1);
      return vdist(e, vadd(t, vscale(i, r)));
    }
    blast(e) {
      let t = WEAPONS[e.weapon]?.radius || 240;
      this.explode(e.pos, t * 0.5, e.weapon === "Anti-Nanobite Bomb" ? "#5bf7d2" : "#ffaa66");
      for (let s of this.entities)
        s.alive &&
          vdist(s.pos, e.pos) < t &&
          this.canDamage(s, e.origin, e.weapon) &&
          (this.hits++, this.damage(s, e.damage, e.weapon, e.origin));
    }
    damagePhoto(e) {
      e.alive &&
        ((e.alive = !1),
        (e.hp = 0),
        this.kills++,
        this.effects.push({ type: "photo", pos: { ...e.pos }, life: 0.5, maxLife: 0.5, size: 80, color: "#cafff5" }),
        this.emit("photo"),
        this.emit("radio", { speaker: "RECON / PIXEL", text: "Image captured. Telemetry confirmed." }),
        this.chooseTarget());
    }
    damage(e, t, s = "Vul", i = this.p.pos, n = !0) {
      if (!(!e.alive || e.invulnerable)) {
        if (
          (e.neutral || e.ally) &&
          n &&
          (this.civilianHits++, (this.rankCap = "C"), this.emit("warning", { text: "FRIENDLY FIRE" }), e.protected)
        ) {
          this.fail("PROTECTED AIRCRAFT HIT");
          return;
        }
        if (
          ((e.hp -= t),
          this.effects.push({
            type: "spark",
            pos: { ...e.pos },
            life: 0.35,
            maxLife: 0.35,
            size: 13,
            color: "#fff4ac",
          }),
          !(e.hp > 0))
        ) {
          if (
            ((e.alive = !1),
            this.explode(e.pos, e.kind === "airship" ? 250 : e.kind === "ship" ? 140 : 70),
            e.ally || e.neutral)
          ) {
            if (e.protected) {
              this.fail("PROTECTED AIRCRAFT LOST");
              return;
            }
            e.role === "recovery" &&
              !this.entities.some((r) => r.alive && r.role === "recovery") &&
              ((this.rankCap = "D"), (this.allyDown = !0));
          } else
            e.counts &&
              (n || this.mission.id === 23) &&
              (this.kills++,
              e.required || this.optionalKills++,
              this.emit("kill", { name: e.name, required: e.required }),
              this.mission.id === 3 && this.phase === 1 && (this.score += 300));
          if (e.kind === "ship")
            for (let r of this.entities.filter((a) => a.alive && a.parent === e.id)) this.damage(r, 1e4, s, i, n);
          if (e.role === "carrierNode" && this.entities.filter((a) => a.alive && a.parent === e.parent).length === 0) {
            let a = this.entities.find((l) => l.id === e.parent);
            a && ((a.alive = !1), this.explode(a.pos, 320));
          }
          if (this.mission.id === 36 && !this.bossHack && !e.neutral) {
            this.bossHack = !0;
            let r = AIRCRAFT[20];
            ((this.p.plane = 20),
              (this.p.gun = "Las"),
              (this.p.missile = "SRM"),
              (this.p.ammo = r.ammo),
              (this.p.hp = this.p.maxHp = 190),
              (this.p.racks = [0, 0, 0, 0]),
              this.worldVersion++,
              this.emit("banner", { title: "OVERRIDE COMPLETE", subtitle: "XR-900 GEOPELIA // YOU ARE THE SWARM" }),
              this.emit("radio", {
                speaker: "LINK / PIXEL",
                text: "Flight systems captured. They still think you are one of them.",
              }));
          }
          this.targetId === e.id && this.chooseTarget();
        }
      }
    }
    damagePlayer(e) {
      if (this.state !== "playing" || this.evade > 0.6) return;
      let t = this.difficulty === "easy" ? 0.6 : this.difficulty === "hard" ? 1.45 : 1;
      ((this.p.hp -= e * t),
        (this.cameraShake = 0.6),
        this.emit("damage"),
        this.explode(this.p.pos, 20),
        this.p.hp <= 0 && this.fail("AIRFRAME DESTROYED"));
    }
    explode(e, t = 60, s = "#ffad61") {
      this.effects.push({ type: "explosion", pos: { ...e }, life: 0.8, maxLife: 0.8, size: t, color: s });
      let i = this.rng || seededRandom(3);
      for (let n = 0; n < 8; n++)
        this.effects.push({
          type: "debris",
          pos: { ...e },
          vel: vec((i() - 0.5) * t * 3, i() * t * 2, (i() - 0.5) * t * 3),
          life: 1.5 + i(),
          maxLife: 2.5,
          size: 3 + i() * 6,
          color: n % 2 ? "#ffbc72" : "#61757e",
        });
      this.emit("explosion", { size: t, distance: vdist(e, this.p.pos) });
    }
    updateEffects(e) {
      for (let t of this.effects)
        ((t.life -= e), t.vel && ((t.pos = vadd(t.pos, vscale(t.vel, e))), (t.vel.y -= e * 50)));
      ((this.effects = this.effects.filter((t) => t.life > 0)),
        this.effects.length > 280 && this.effects.splice(0, this.effects.length - 280));
    }
    updateObjectives(e) {
      if (this.state !== "playing") return;
      let t = this.mission.id,
        s = this.p;
      if (this.timerLimit && this.time >= this.timerLimit) {
        this.fail(
          t === 16
            ? "SATELLITES ACTIVATED"
            : t === 17
              ? "TRAIN REACHED THE BASE"
              : t === 10
                ? "FACTORY NOT DISCOVERED"
                : "OPERATION WINDOW EXPIRED",
        );
        return;
      }
      if (t === 3 && this.phase === 0) {
        let n = this.entities.find((r) => r.role === "leader");
        if (n) {
          let r = vdist(s.pos, n.pos);
          if (
            (r < 305
              ? ((this.score += 50 * e), (this.formationLost = Math.max(0, this.formationLost - e * 2)))
              : r > 1300
                ? (this.formationLost += e)
                : (this.formationLost = Math.max(0, this.formationLost - e)),
            (this.formation = clamp(1 - r / 1300, 0, 1)),
            this.formationLost > 8)
          ) {
            this.fail("FORMATION CONTACT LOST");
            return;
          }
        }
        this.phaseTime >= 72 && this.setupPhase(1);
        return;
      }
      if (t === 10 && this.phase === 0) {
        let n = this.entities.find((r) => r.role === "canyonLeader");
        if (s.pos.y > 900) {
          this.fail("DETECTED ABOVE THE CANYON");
          return;
        }
        if (n && vdist(s.pos, n.pos) > 4500) {
          if (((this.formationLost += e), this.formationLost > 18)) {
            this.fail("RECONNAISSANCE CONTACT LOST");
            return;
          }
        } else this.formationLost = 0;
        n && n.pos.z < -9300 && vdist(s.pos, n.pos) < 2400 && this.setupPhase(1);
        return;
      }
      if (t === 31) {
        s.pos.z < -18e3 && this.finish();
        return;
      }
      if (
        (t === 22 &&
          !this.jammerActive &&
          s.pos.y < 3810 &&
          !this.detected &&
          ((this.detected = !0),
          (this.rankCap = "D"),
          this.group("F/A-32C", 3),
          this.group("F-22C", 5),
          this.group("RF-12A2", 4),
          this.emit("warning", { text: "RADAR DETECTION" }),
          this.emit("radio", {
            speaker: "CONTROL / MICA",
            text: "Your radar signature is exposed. Enemy interceptors are launching.",
          }),
          this.worldVersion++),
        t === 27 &&
          !this.clearance &&
          (s.pos.z < -2450
            ? ((this.clearance = !0),
              this.emit("banner", { title: "CLEARED TO ENGAGE", subtitle: "ALTITUDE RESTRICTION LIFTED" }))
            : s.pos.y > 396 &&
              !this.detected &&
              ((this.detected = !0),
              (this.rankCap = "D"),
              this.group("F-22C", 4),
              this.emit("warning", { text: "RADAR DETECTION" }),
              this.worldVersion++)),
        this.phaseLimit && this.phaseTime >= this.phaseLimit && !this.late)
      ) {
        if (
          ((this.late = !0),
          [1, 2, 4, 6].includes(t) &&
            ((this.rankCap = "D"),
            this.emit("radio", {
              speaker: "CONTROL / MICA",
              text: "Reinforcement opportunity lost. Finish the primary objective.",
            })),
          t === 5)
        ) {
          this.rankCap = "D";
          for (let n of this.entities)
            n.alive && n.parked && ((n.parked = !1), (n.kind = "aircraft"), (n.speed = 200), (n.pos.y += 260));
          (this.group("Tower", 1, !0),
            this.emit("banner", { title: "ENEMY SCRAMBLE", subtitle: "AIRCRAFT ARE AIRBORNE" }),
            this.worldVersion++);
        }
        if (
          (t === 8 &&
            ((this.rankCap = "B"),
            this.group("Hydrofoil", 1, !0, { speed: 65 }),
            this.emit("banner", { title: "HYDROFOIL LAUNCHED", subtitle: "INTERCEPT THE ESCAPING VESSEL" }),
            this.worldVersion++),
          t === 13 &&
            ((this.rankCap = "D"),
            this.group("IRBM", 1, !0, { gunOnly: !0, kind: "aircraft", pos: vec(0, 600, -2800), speed: 430 }),
            this.emit("banner", { title: "BALLISTIC LAUNCH", subtitle: "GUNS ONLY // INTERCEPT NOW" }),
            this.worldVersion++),
          t === 19)
        ) {
          this.rankCap = "C";
          for (let n of this.entities.filter((r) => r.alive && r.name === "R-531"))
            this.group("R-311", 2, !0, { pos: vadd(n.pos, vec(0, -80, 60)), spread: vec(190, 0, 0), speed: 310 });
          (this.emit("banner", { title: "PARASITE LAUNCH", subtitle: "NEW HIGH-SPEED CONTACTS" }), this.worldVersion++);
        }
        if (t === 20) {
          for (let n of this.entities)
            n.alive && n.kind === "ship" && ((n.speed = 20), (n.sheltered = !1), (n.role = "departing"));
          this.emit("banner", { title: "FLEET DEPARTING", subtitle: "CONTINUE THE ATTACK" });
        }
        if (t === 26) {
          this.fail("ENEMY REACHED THE RECOVERY ZONE");
          return;
        }
      }
      if (t === 8 && this.late && this.time > 390 && this.entities.some((n) => n.alive && n.name === "Hydrofoil")) {
        this.fail("HYDROFOIL ESCAPED");
        return;
      }
      if (this.primary().length) return;
      let i = {
        1: 2,
        2: 2,
        3: 3,
        4: 2,
        6: 2,
        7: 2,
        9: 2,
        10: 2,
        14: 2,
        15: 2,
        21: 3,
        23: 2,
        24: 2,
        25: 2,
        26: 2,
        28: 2,
        29: 2,
        30: 2,
        34: 2,
        35: 2,
        37: 2,
        39: 2,
      };
      if (this.phase < (i[t] || 1) - 1) {
        if ([1, 2, 4, 6].includes(t) && this.late) {
          this.finish();
          return;
        }
        ((this.phaseLimit = 0), (this.late = !1), this.setupPhase(this.phase + 1));
      } else this.finish();
    }
    grade() {
      let e = this.mission,
        t = "A";
      return (
        e.id === 3
          ? (t = this.score >= 5e3 ? "A" : this.score >= 3900 ? "B" : this.score >= 2800 ? "C" : "D")
          : e.id === 22
            ? (t = this.detected ? "D" : "A")
            : e.id === 7
              ? (t = "A")
              : e.aTime
                ? (t =
                    this.time < e.aTime ? "A" : this.time < e.aTime * 1.4 ? "B" : this.time < e.aTime * 2 ? "C" : "D")
                : e.aKills && (t = this.kills >= e.aKills ? "A" : this.kills >= Math.ceil(e.aKills * 0.65) ? "B" : "C"),
        this.civilianHits && (t = RANK_VALUE[t] > 2 ? "C" : t),
        RANK_VALUE[t] > RANK_VALUE[this.rankCap] && (t = this.rankCap),
        t
      );
    }
    finish() {
      if (this.state !== "playing") return;
      let e = this.grade(),
        t = this.mission;
      ((this.state = "won"), (this.p.hp = Math.max(1, this.p.hp)));
      let s = AIRCRAFT.filter((c) => this.pilot.isPlaneUnlocked(c.id)).map((c) => c.id),
        i = this.pilot.data,
        n = 240 + this.kills * 16 + RANK_VALUE[e] * 60 + (this.p.hp / this.p.maxHp > 0.75 ? 100 : 0),
        r = 180 + this.kills * 12 + RANK_VALUE[e] * 65,
        a = this.pilot.level;
      if (!this.practice) {
        if (t.id <= 36) {
          let u = i.ranks[this.difficulty][t.id];
          ((RANK_VALUE[u] || 0) < RANK_VALUE[e] && (i.ranks[this.difficulty][t.id] = e),
            t.id < 35 && (i.unlocked = Math.max(i.unlocked, t.id + 1)),
            t.id === 35 && (i.completed[this.difficulty] = !0));
        } else i.sideClears[t.id] = !0;
        let c = i.records[t.id];
        ((!c || RANK_VALUE[e] > RANK_VALUE[c.rank] || (e === c.rank && this.time < c.time)) &&
          (i.records[t.id] = { rank: e, time: this.time, kills: this.kills }),
          (i.xp += n),
          (i.credits += r),
          this.pilot.bonusMission && (i.unlocked = 36),
          (t.id === 35 || t.id === 36) && (i.chain = null),
          this.pilot.write());
      }
      let l = AIRCRAFT.filter((c) => this.pilot.isPlaneUnlocked(c.id) && !s.includes(c.id));
      ((this.result = {
        rank: e,
        time: this.time,
        kills: this.kills,
        accuracy: this.shots ? Math.min(100, Math.round((this.hits / this.shots) * 100)) : 100,
        integrity: Math.round((this.p.hp / this.p.maxHp) * 100),
        xp: this.practice ? 0 : n,
        credits: this.practice ? 0 : r,
        newPlanes: l,
        levelUp: this.pilot.level > a,
        practice: this.practice,
      }),
        this.emit("complete", this.result));
    }
    fail(e) {
      this.state === "playing" &&
        ((this.state = "lost"),
        (this.p.hp = Math.max(0, this.p.hp)),
        this.explode(this.p.pos, 130),
        this.emit("failed", { reason: e, time: this.time, kills: this.kills }));
    }
    pause() {
      this.state === "playing" &&
        ((this.state = "paused"),
        (this.input = { x: 0, y: 0, boost: !1, brake: !1, gun: !1, missile: !1 }),
        this.emit("pause"));
    }
    resume() {
      this.state === "paused" && ((this.state = "playing"), this.emit("resume"));
    }
  },
  PALETTES = {
    city: {
      top: "#061420",
      horizon: "#657476",
      low: "#12313d",
      sun: "#ffc595",
      ground: "#142c31",
      water: "#0e2e3a",
      fog: "#34525e",
      accent: "#88edcc",
    },
    harbor: {
      top: "#090e20",
      horizon: "#816c80",
      low: "#1b3044",
      sun: "#ffd4b3",
      ground: "#15272e",
      water: "#172e43",
      fog: "#3c4b63",
      accent: "#82efe1",
    },
    ocean: {
      top: "#08253b",
      horizon: "#b7cad0",
      low: "#38687c",
      sun: "#fff1c7",
      ground: "#405e58",
      water: "#164857",
      fog: "#607b86",
      accent: "#a4edcb",
    },
    island: {
      top: "#1b4059",
      horizon: "#d3e4d8",
      low: "#46868a",
      sun: "#fff1c0",
      ground: "#4d7564",
      water: "#226979",
      fog: "#749392",
      accent: "#a9f4bb",
    },
    mountain: {
      top: "#122836",
      horizon: "#a6afa4",
      low: "#47646b",
      sun: "#ffe0ad",
      ground: "#4d6261",
      water: "#1f4655",
      fog: "#728487",
      accent: "#a6e8c2",
    },
    snow: {
      top: "#1c304a",
      horizon: "#d1dce0",
      low: "#708695",
      sun: "#fbead2",
      ground: "#92aaaf",
      water: "#476b7a",
      fog: "#8a9eaa",
      accent: "#b8f5ef",
    },
    forest: {
      top: "#122b31",
      horizon: "#b2bdb0",
      low: "#497065",
      sun: "#ffe9b2",
      ground: "#254b3f",
      water: "#264c52",
      fog: "#6b897c",
      accent: "#a6efad",
    },
    plateau: {
      top: "#051a29",
      horizon: "#487583",
      low: "#163942",
      sun: "#dfd8be",
      ground: "#283f41",
      water: "#12303b",
      fog: "#3f626e",
      accent: "#b6f9c1",
    },
    canyon: {
      top: "#152d3b",
      horizon: "#a4b3ae",
      low: "#587976",
      sun: "#ffe1b2",
      ground: "#5a6b65",
      water: "#1b5b68",
      fog: "#688a8c",
      accent: "#9af9d0",
    },
    fjord: {
      top: "#123644",
      horizon: "#a9c4c2",
      low: "#547c7e",
      sun: "#ffdfbb",
      ground: "#486a69",
      water: "#245967",
      fog: "#708f90",
      accent: "#a5efdb",
    },
    desert: {
      top: "#292b37",
      horizon: "#dfb9a0",
      low: "#806459",
      sun: "#fff0ba",
      ground: "#a68869",
      water: "#514136",
      fog: "#b49a84",
      accent: "#e9f4c1",
    },
    strato: {
      top: "#020919",
      horizon: "#497b9c",
      low: "#a4cfdb",
      sun: "#fff0d8",
      ground: "#6e8da3",
      water: "#356174",
      fog: "#497088",
      accent: "#c3f3ff",
    },
    space: {
      top: "#020410",
      horizon: "#091022",
      low: "#172742",
      sun: "#d4e5ff",
      ground: "#30536d",
      water: "#153c65",
      fog: "#050a19",
      accent: "#c8c1ff",
    },
    tunnel: {
      top: "#06100e",
      horizon: "#081b1c",
      low: "#0c1f22",
      sun: "#7effb8",
      ground: "#172a29",
      water: "#123631",
      fog: "#071a18",
      accent: "#86ffb8",
    },
    geofront: {
      top: "#1d1919",
      horizon: "#4f4440",
      low: "#272625",
      sun: "#ffc88f",
      ground: "#282f30",
      water: "#242f34",
      fog: "#514b47",
      accent: "#c8e6b5",
    },
    cyber: {
      top: "#020a10",
      horizon: "#063b3c",
      low: "#052026",
      sun: "#a4ffee",
      ground: "#05212b",
      water: "#04323c",
      fog: "#073743",
      accent: "#64ffe1",
    },
  };
function buildModel(o = "EF2000E", e = !1) {
  let t = [],
    s = [],
    i = (w, v, S = !1) => t.push({ verts: w.map((A) => vec(...A)), color: v, glow: S }),
    n = (w, v, S, A, M, N, V) => {
      let G = [
        [-A / 2, -M / 2, -N / 2],
        [A / 2, -M / 2, -N / 2],
        [A / 2, M / 2, -N / 2],
        [-A / 2, M / 2, -N / 2],
        [-A / 2, -M / 2, N / 2],
        [A / 2, -M / 2, N / 2],
        [A / 2, M / 2, N / 2],
        [-A / 2, M / 2, N / 2],
      ].map((W) => [W[0] + w, W[1] + v, W[2] + S]);
      for (let W of [
        [0, 1, 2, 3],
        [1, 5, 6, 2],
        [5, 4, 7, 6],
        [4, 0, 3, 7],
        [3, 2, 6, 7],
        [4, 5, 1, 0],
      ])
        i(
          W.map((ie) => G[ie]),
          V,
        );
    },
    r = e ? "#657b87" : "#c7d9db",
    a = e ? "#354d5b" : "#91b0bb",
    l = "#19323e",
    c = e ? "#ff916d" : "#c2f58b",
    u = "#153e4c";
  if (o === "Satellite") {
    (n(0, 0, 0, 24, 32, 24, "#bcb28a"), n(-42, 0, 0, 58, 2, 44, "#184e83"), n(42, 0, 0, 58, 2, 44, "#184e83"));
    for (let w = -70; w <= 70; w += 12) s.push({ a: vec(w, 1, -21), b: vec(w, 1, 21), color: "#7799c6" });
    for (let w = -20; w <= 20; w += 10) s.push({ a: vec(-72, 1, w), b: vec(72, 1, w), color: "#7799c6" });
    return { faces: t, lines: s, scale: 1.3 };
  }
  if (["Carrier", "Convoy", "Warship", "S.Warship", "Submarine", "Hydrofoil"].includes(o)) {
    let w = o === "Carrier",
      v = w ? 65 : o === "Hydrofoil" ? 18 : 35,
      S = w ? 260 : o === "Hydrofoil" ? 70 : 155;
    return (
      i(
        [
          [-v, 0, -S * 0.35],
          [0, 0, -S * 0.6],
          [v, 0, -S * 0.35],
          [v, 0, S * 0.5],
          [-v, 0, S * 0.5],
        ],
        "#829496",
      ),
      i(
        [
          [-v, 0, -S * 0.35],
          [0, 0, -S * 0.6],
          [0, -18, -S * 0.46],
          [-v * 0.7, -18, S * 0.45],
          [-v, 0, S * 0.5],
        ],
        "#29434c",
      ),
      i(
        [
          [v, 0, -S * 0.35],
          [0, 0, -S * 0.6],
          [0, -18, -S * 0.46],
          [v * 0.7, -18, S * 0.45],
          [v, 0, S * 0.5],
        ],
        "#1d3944",
      ),
      i(
        [
          [-v, 0, S * 0.5],
          [v, 0, S * 0.5],
          [v * 0.7, -18, S * 0.45],
          [-v * 0.7, -18, S * 0.45],
        ],
        "#2f4b54",
      ),
      n(w ? 40 : 0, 16, 20, w ? 25 : 30, 32, w ? 85 : 48, "#6c8388"),
      n(w ? 40 : 0, 36, 15, 16, 12, 22, "#b2c3c0"),
      n(w ? 40 : 0, 58, 18, 3, 34, 3, "#b9cdcd"),
      w
        ? (i(
            [
              [-22, 0.5, -S * 0.38],
              [-18, 0.5, -S * 0.38],
              [-18, 0.5, S * 0.44],
              [-22, 0.5, S * 0.44],
            ],
            "#bfc9bb",
          ),
          i(
            [
              [6, 0.6, -S * 0.3],
              [9, 0.6, -S * 0.3],
              [32, 0.6, S * 0.42],
              [29, 0.6, S * 0.42],
            ],
            "#d9d4b1",
          ))
        : n(0, 8, -35, 14, 16, 20, "#536b72"),
      { faces: t, lines: s, scale: 1 }
    );
  }
  if (o === "UI-4053" || o === "UI-4052") {
    let S = [
      [-245, 0, 0],
      [-170, 65, 26],
      [-20, 135, 43],
      [150, 98, 36],
      [235, 30, 15],
    ].map(([A, M, N]) =>
      Array.from({ length: 16 }, (V, G) => [
        Math.cos((G / 16) * Math.PI * 2) * M,
        Math.sin((G / 16) * Math.PI * 2) * N,
        A,
      ]),
    );
    for (let A = 0; A < S.length - 1; A++)
      for (let M = 0; M < 16; M++)
        i([S[A][M], S[A][(M + 1) % 16], S[A + 1][(M + 1) % 16], S[A + 1][M]], M < 16 / 2 ? "#a1b4b1" : "#354e58");
    for (let A of [-1, 1])
      (i(
        [
          [A * 80, 0, -60],
          [A * 260, 5, 110],
          [A * 235, 0, 160],
          [A * 90, -3, 100],
        ],
        "#556e76",
      ),
        i(
          [
            [A * 60, 18, 140],
            [A * 100, 100, 225],
            [A * 90, 12, 235],
          ],
          "#657e7d",
        ),
        n(A * 63, -36, 50, 23, 18, 45, "#233941"));
    return { faces: t, lines: s, scale: 1 };
  }
  if (
    [
      "Gun",
      "AA Gun",
      "MSSL",
      "Radarsite",
      "Base",
      "Bridge",
      "Tower",
      "Facilities",
      "Pow.Plant",
      "Pr.Plant",
      "Chimney",
      "Tank",
      "Antlion",
      "Nanobite",
      "Timer",
      "Oil Tank",
      "Relay",
      "Beacon",
      "Core",
      "A.Train",
      "Decoy",
      "Container",
    ].includes(o) ||
    o.startsWith("UI-4053 NODE")
  ) {
    if (o === "Timer") {
      n(0, 0, 0, 42, 1460, 42, "#748185");
      for (let w = -700; w < 710; w += 180) n(0, w, 0, 75, 12, 75, "#a4b5ab");
      return { faces: t, lines: s, scale: 1 };
    }
    if (o === "Bridge") {
      n(0, 0, 0, 340, 18, 95, "#849391");
      for (let w = -140; w <= 140; w += 70) (n(w, -40, 0, 16, 90, 60, "#485e63"), n(w, 55, 0, 9, 95, 9, "#799392"));
      return { faces: t, lines: s, scale: 1 };
    }
    if (o === "Nanobite" || o === "Relay" || o === "Core") {
      let w = o === "Nanobite" ? "#50ad7d" : "#87e7c7";
      for (let v = 0; v < 7; v++) {
        let S = (v / 7) * Math.PI * 2;
        i(
          [
            [Math.cos(S) * 34, -12, Math.sin(S) * 34],
            [0, o === "Core" ? 110 : 54, 0],
            [Math.cos(S + 1) * 34, -12, Math.sin(S + 1) * 34],
          ],
          w,
          v % 3 === 0,
        );
      }
      return (n(0, -10, 0, 75, 16, 75, "#204a43"), { faces: t, lines: s, scale: 1 });
    }
    if (o === "Chimney" || o === "Tower")
      return (
        n(0, 0, 0, 30, o === "Chimney" ? 300 : 190, 30, "#7b9294"),
        n(0, 70, 0, 60, 24, 55, "#95b0ac"),
        n(0, 110, 0, 16, 8, 16, "#fc9777"),
        { faces: t, lines: s, scale: 1 }
      );
    if (o === "Radarsite" || o === "Beacon") {
      (n(0, -5, 0, 65, 20, 55, "#698c90"), n(0, 23, 0, 10, 45, 10, "#a5bbba"));
      for (let w = 0; w < 12; w++) {
        let v = (w / 12) * Math.PI * 2,
          S = ((w + 1) / 12) * Math.PI * 2;
        i(
          [
            [0, 40, 4],
            [Math.cos(v) * 38, 40 + Math.sin(v) * 38, -8],
            [Math.cos(S) * 38, 40 + Math.sin(S) * 38, -8],
          ],
          "#d0dfd8",
        );
      }
      return { faces: t, lines: s, scale: 1 };
    }
    if (o === "Tank" || o === "Antlion" || o === "MSSL" || o === "Gun" || o === "AA Gun") {
      if (
        (n(0, -10, 0, 40, 20, 62, "#50645c"),
        n(-23, -14, 0, 9, 17, 65, "#1c302c"),
        n(23, -14, 0, 9, 17, 65, "#1c302c"),
        n(0, 5, -5, 28, 17, 26, "#82947c"),
        n(0, 10, -34, 5, 5, 42, "#a2b095"),
        o === "MSSL")
      )
        for (let w = -12; w <= 12; w += 12) n(w, 19, 0, 8, 8, 65, "#bed0bb");
      return { faces: t, lines: s, scale: 1 };
    }
    return o === "Decoy" || o === "Container"
      ? (n(0, 0, 0, 30, 30, 30, o === "Decoy" ? "#f5c074" : "#a5b7a3"), { faces: t, lines: s, scale: 1 })
      : o === "A.Train"
        ? (n(0, 0, 0, 40, 42, 73, e ? "#9f826e" : "#b2c2bb"),
          n(0, 21, 0, 36, 5, 65, "#e6e0ce"),
          n(-22, -23, 0, 7, 8, 60, "#1b2827"),
          n(22, -23, 0, 7, 8, 60, "#1b2827"),
          { faces: t, lines: s, scale: 1 })
        : o.startsWith("UI-4053 NODE")
          ? (n(0, 0, 0, 30, 22, 38, "#81aea5"), n(0, -13, 0, 22, 5, 26, "#efb78a"), { faces: t, lines: s, scale: 1 })
          : (n(0, -10, 0, 110, 36, 95, "#48646a"),
            n(-20, 23, 8, 65, 42, 75, "#769396"),
            n(32, 8, -25, 36, 20, 40, "#96afab"),
            n(-20, 46, 8, 68, 4, 78, "#acbdb5"),
            { faces: t, lines: s, scale: 1 });
  }
  let p = /^R-10|^R-20|^R-21|XFA|XR-900|X-49|UI-405/.test(o),
    f = o.includes("Su-43"),
    m = o === "X-49" || o === "XR-900" || o.startsWith("UI-4054") || o.startsWith("UI-4051"),
    g = /R-50|R-53|C-17/.test(o),
    x = o === "R-352",
    b = [
      [-42, 0.15, 0.25],
      [-26, 2.8, 2.3],
      [-12, 4.8, 4.6],
      [3, 6.5, 4.2],
      [20, 6.1, 3.2],
      [28, 4.5, 2.1],
    ],
    _ = 8,
    T = b.map(([w, v, S]) =>
      Array.from({ length: _ }, (A, M) => [
        Math.cos((M / _) * Math.PI * 2) * v,
        Math.sin((M / _) * Math.PI * 2) * S,
        w,
      ]),
    );
  for (let w = 0; w < T.length - 1; w++)
    for (let v = 0; v < _; v++)
      i([T[w][v], T[w][(v + 1) % _], T[w + 1][(v + 1) % _], T[w + 1][v]], v < 4 ? (v % 3 === 0 ? a : r) : l);
  for (let w of [-1, 1]) {
    let v = g ? 44 : m ? 45 : p ? 34 : 31,
      S = f ? -13 : m ? 20 : 17;
    (i(
      [
        [w * 4, 1, -9],
        [w * v, -1, S],
        [w * (v - 3), -1, S + 8],
        [w * 6, 0, 19],
      ],
      r,
    ),
      i(
        [
          [w * 4, -1, -9],
          [w * v, -2, S],
          [w * (v - 3), -2, S + 8],
          [w * 6, -2, 19],
        ],
        l,
      ),
      i(
        [
          [w * 4, 1.1, -8],
          [w * v, -0.9, S],
          [w * (v - 2), -0.9, S + 1],
          [w * 6, 1.1, -3],
        ],
        a,
      ),
      i(
        [
          [w * 19, 0.3, S - 1],
          [w * 23, 0.1, S + 1],
          [w * 20, 0.1, S + 7],
          [w * 16, 0.3, S + 6],
        ],
        l,
      ),
      i(
        [
          [w * (v - 6), -0.6, S + 1],
          [w * (v - 2), -0.6, S + 2],
          [w * (v - 3), -0.6, S + 4],
          [w * (v - 7), -0.6, S + 3],
        ],
        c,
      ),
      !g &&
        !x &&
        i(
          [
            [w * 4, 2, -23],
            [w * 14, 1, -15],
            [w * 12, 1, -10],
            [w * 4, 2, -15],
          ],
          a,
        ),
      m ||
        (i(
          [
            [w * 4, 2, 12],
            [w * 7, 15, 14],
            [w * 11, 14, 27],
            [w * 7, 2, 28],
          ],
          r,
        ),
        i(
          [
            [w * 5, 3, 15],
            [w * 8, 12, 18],
            [w * 9, 12, 23],
            [w * 7, 3, 24],
          ],
          l,
        )),
      i(
        [
          [w * 5, 0, 17],
          [w * 17, 0, 26],
          [w * 15, 0, 31],
          [w * 4, 0, 26],
        ],
        a,
      ),
      n(w * 5, -2, -2, 4, 5, 15, l),
      i(
        [
          [w * 3, -2, -10],
          [w * 7, -2, -9],
          [w * 7, 1, -9],
          [w * 3, 1, -10],
        ],
        "#06171e",
      ),
      n(w * 4.2, -0.8, 24, 6, 5, 8, "#17323c"));
    let A = w * 4.2;
    i(
      [
        [A - 2.2, -2.2, 28.2],
        [A + 2.2, -2.2, 28.2],
        [A + 2.2, 1.3, 28.2],
        [A - 2.2, 1.3, 28.2],
      ],
      "#83f9ff",
      !0,
    );
  }
  if (
    (i(
      [
        [-2.1, 3, -28],
        [2.1, 3, -28],
        [3, 6.8, -18],
        [-3, 6.8, -18],
      ],
      u,
    ),
    i(
      [
        [-3, 6.8, -18],
        [3, 6.8, -18],
        [2.6, 5.8, -8],
        [-2.6, 5.8, -8],
      ],
      "#246171",
    ),
    i(
      [
        [-2.6, 5.8, -8],
        [2.6, 5.8, -8],
        [1.8, 4, -3],
        [-1.8, 4, -3],
      ],
      u,
    ),
    i(
      [
        [-2.5, 6.9, -17],
        [-1.9, 6.9, -17],
        [-1.9, 6, -9],
        [-2.5, 6, -9],
      ],
      "#8bd3ce",
    ),
    i(
      [
        [-1, 4.4, -8],
        [1, 4.4, -8],
        [1, 4.4, 17],
        [-1, 4.4, 17],
      ],
      l,
    ),
    m &&
      i(
        [
          [-6, 1, -11],
          [-45, 0, 18],
          [0, 7, 28],
          [45, 0, 18],
          [6, 1, -11],
        ],
        e ? "#284653" : "#527581",
      ),
    x)
  )
    for (let w of [-1, 1]) n(w * 12, -2, 10, 7, 9, 25, "#b9c9cc");
  return { faces: t, lines: s, scale: g ? 2.2 : o === "RF-12A2" ? 1.25 : m ? 1.3 : 1, engines: !0 };
}
var SUN_DIRECTION = new THREE.Vector3(-0.65, 0.16, -1).normalize(),
  KEY_LIGHT = new THREE.Vector3(-0.5, 1, 0.2).normalize();
var CameraRig = class {
    constructor() {
      ((this.pos = vec(0, 1e3, 2500)),
        (this.target = vec(0, 900, 0)),
        (this.fov = 64),
        (this.right = vec(1, 0, 0)),
        (this.up = vec(0, 1, 0)),
        (this.direction = vec(0, 0, -1)),
        (this.initial = !0));
    }
    update(e, t) {
      let s = e.p,
        i = e.state === "menu",
        n = heading(s.yaw, s.pitch),
        r = e.cameraMode === 2,
        a,
        l;
      if (i) {
        let u = Math.sin(e.demoTime * 0.07) * 0.17;
        ((a = vadd(s.pos, vec(118 + Math.sin(u) * 90, 46, 118 + Math.cos(u) * 5))),
          (l = vadd(s.pos, vec(-58, -2, -32))),
          (this.fov = 53));
      } else
        e.cameraMode === 1
          ? ((a = vadd(s.pos, vadd(vscale(n, 15), vec(0, 5, 0)))), (l = vadd(a, vscale(n, 1e3))), (this.fov = 75))
          : ((a = vadd(s.pos, vadd(vscale(n, r ? 160 : -160), vec(0, 45, 0)))),
            (l = vadd(s.pos, vadd(vscale(n, r ? -550 : 650), vec(0, 12, 0)))),
            (this.fov = 66 + (s.speed - 300) * 0.025));
      let c = this.initial ? 1 : Math.min(1, t * (i ? 2 : 10));
      ((this.pos = vadd(vscale(this.pos, 1 - c), vscale(a, c))),
        (this.target = vadd(vscale(this.target, 1 - c), vscale(l, c))),
        (this.initial = !1),
        e.cameraShake &&
          e.pilot.data.settings.shake &&
          ((this.pos.x += Math.sin(e.time * 92) * e.cameraShake * 2),
          (this.pos.y += Math.cos(e.time * 75) * e.cameraShake * 2)),
        (this.direction = vnorm(vsub(this.target, this.pos))),
        (this.right = vnorm(vcross(this.direction, vec(0, 1, 0)))),
        (this.up = vnorm(vcross(this.right, this.direction))));
    }
  },
  FlightView = class {
    constructor(kit, e) {
      this.kit = kit;
      this.renderer = kit.renderer;
      this.canvas = kit.canvas;
      this.engine = e;
      this.T = THREE;
      this.N = TSL;
      this.cameraRig = new CameraRig();
      this.version = -1;
      this.models = new Map();
      this.entityMeshes = new Map();
      this.name = (kit.backend === "webgpu" ? "WEBGPU" : "WEBGL 2") + " \xB7 TSL";
      this.frames = 0;
      this.tmpVec = new THREE.Vector3();
      this.tmpDir = new THREE.Vector3();
      this.sunProjected = new THREE.Vector3();
      this.sunScreen = TSL.uniform(new THREE.Vector3(0.5, 0.5, 0));
      // The space/strato planet is drawn in screen space like the shipped view: it follows the jet's pitch and
      // its rim line is sized in CSS pixels.
      this.planetPitch = TSL.uniform(0);
      this.horizonY = TSL.uniform(0.5);
      this.pixelRatio = TSL.uniform(1);
      this.softMats = new Map();
      this.applyTier();
    }
    /** Extras follow the kit's quality tier (the look stays the same on every tier): trees cast shadows on ultra. */
    applyTier() {
      this.ultra = this.kit.tier.name === "ultra";
    }
    async init() {
      let e = this.T,
        t = this.N,
        kit = this.kit,
        r = this.renderer;
      // The look is matched to the game's shipped art, the palette-true flat-shaded view players saw: neutral tone
      // mapping keeps the palette hues (the post chain gives back the black level it takes, see createPost), the
      // lights reproduce that view's face shading (below), and the fog is its linear haze.
      (r.setClearColor(464672, 1),
        (r.toneMapping = e.NeutralToneMapping),
        (r.toneMappingExposure = 1),
        (r.outputColorSpace = e.SRGBColorSpace),
        (r.shadowMap.enabled = !0),
        (r.shadowMap.type = e.PCFShadowMap),
        (this.scene = new e.Scene()),
        (this.camera = kit.fitCamera(new e.PerspectiveCamera(66, kit.size.width / kit.size.height, 4, 15e4))),
        (this.worldGroup = new e.Group()),
        (this.entityGroup = new e.Group()),
        this.scene.add(this.worldGroup, this.entityGroup),
        // The shipped view's haze: the palette fog colour mixed in sRGB by depth / 18.5 km, at most 86%.
        (this.fogColor = t.uniform(new e.Vector3(0.2, 0.32, 0.37))),
        (this.scene.fogNode = t.vec4(
          t.mix(t.output.rgb.max(0).pow(1 / 2.2), this.fogColor, t.positionView.z.negate().div(18500).clamp(0, 0.86)).pow(2.2),
          t.output.a,
        )),
        (this.clock = t.uniform(0)),
        // The shipped view shaded every face by 0.65 + 0.36·|n·L| of its colour, L a fixed key direction up and to
        // the left. In linear light that is an ambient term plus a key light along L and an equal fill along -L
        // (the |n·L|), all white and matte; the key also casts the shadows the shipped view never had.
        (this.ambient = new e.AmbientLight(16777215, 1.22)),
        (this.sun = new e.DirectionalLight(16777215, 1.93)),
        (this.fill = new e.DirectionalLight(16777215, 1.93)),
        this.scene.add(this.ambient, this.fill, this.fill.target),
        (this.sun.castShadow = !0),
        kit.shadow(this.sun, 2048),
        Object.assign(this.sun.shadow.camera, {
          left: -2200,
          right: 2200,
          top: 2200,
          bottom: -2200,
          near: 1,
          far: 16e3,
        }),
        this.sun.shadow.camera.updateProjectionMatrix(),
        (this.sun.shadow.bias = -25e-5),
        (this.sun.shadow.normalBias = 2),
        (this.sun.shadow.radius = 2),
        this.scene.add(this.sun, this.sun.target),
        this.createSharedMaterials(),
        this.createEffects(),
        this.createPost());
      // kit.shadow() above re-sizes the sun's map on quality changes; r186 re-allocates it from mapSize itself.
      kit.onQuality(() => {
        (this.applyTier(), (this.version = -1));
      });
      (this.rebuild(), this.cameraRig.update(this.engine, 1), this.updateCamera());
      try {
        await r.compileAsync(this.scene, this.camera);
      } catch (a) {
        logIssue("Shader warm-up", a, !0);
      }
      return this;
    }
    /**
     * Bloom plus the soft lens vignette, through the kit's TSL chain (it follows the tier: FXAA without MSAA, bloom
     * size). The shipped game drew its palette straight to the screen. Neutral tone mapping lowers the black level
     * (it subtracts up to 0.04 from every channel of dark colours), which turned the dusk haze, the tunnel and the
     * geofront murky; adding exactly that offset back here keeps dark palette colours as authored, while bright
     * highlights are still compressed by the curve. Pure: it runs again when the quality tier rebuilds the chain.
     */
    createPost() {
      let t = this.N;
      this.post = createPost(this.kit, this.scene, this.camera, {
        bloom: { strength: 0.25, radius: 0.35, threshold: 1.1 },
        output: (c) => {
          let v = c.rgb.mul(t.float(1).sub(t.screenUV.sub(0.5).length().mul(0.18))),
            u = v.x.min(v.y).min(v.z).max(0),
            h = t.select(u.greaterThanEqual(0.04), u.add(0.04), u.sqrt().mul(0.4));
          return t.vec4(v.add(h.sub(u)), c.a);
        },
      });
    }
    createSharedMaterials() {
      let e = this.T;
      ((this.antennaMat = new e.MeshLambertNodeMaterial({ color: 7773083 })),
        (this.aircraftMat = new e.MeshLambertNodeMaterial({ vertexColors: !0, side: e.DoubleSide })),
        (this.glowMat = new e.MeshBasicNodeMaterial({ vertexColors: !0, side: e.DoubleSide })),
        (this.treeMat = new e.MeshLambertNodeMaterial({ color: 2706238, flatShading: !0 })),
        (this.lineMat = new e.LineBasicNodeMaterial({ color: 8572599, transparent: !0, opacity: 0.4 })),
        (this.flameMat = new e.MeshBasicNodeMaterial({
          color: 7725055,
          transparent: !0,
          opacity: 0.65,
          depthWrite: !1,
          blending: e.AdditiveBlending,
          fog: !1,
        })),
        (this.flameGeo = new e.ConeGeometry(2.3, 29, 12)),
        this.flameGeo.rotateX(Math.PI / 2),
        (this.flameGeo.userData.shared = !0),
        (this.boxGeo = new e.BoxGeometry(1, 1, 1)),
        (this.boxGeo.userData.shared = !0));
    }
    /**
     * The shipped view's flat face shading for the tunnel and geofront structures: the palette colour times
     * 0.65 + 0.36·|n·L| toward a fixed key light (applied in sRGB, so pow 2.2 here), unlit, with the scene's haze.
     * The shipped view never drew the underside of a box; `open` leaves it out here too, so the tunnel roof shows
     * the dark sky between the lit front edges of its sections, as it did.
     */
    softMat(hex, open) {
      let k = hex + (open ? "/open" : ""),
        m = this.softMats.get(k);
      if (!m) {
        let t = this.N,
          f = t.normalWorld.dot(t.vec3(-0.5, 1, 0.2).normalize()).abs().mul(0.36).add(0.65).clamp(0.4, 1.02);
        ((m = new this.T.MeshBasicNodeMaterial()),
          (m.colorNode = t.color(hex).mul(f.pow(2.2))),
          open && (m.maskNode = t.normalGeometry.y.greaterThan(-0.5)),
          this.softMats.set(k, m));
      }
      return m;
    }
    /** Screen-space lines sized in pixels like the shipped view's canvas strokes (Line2 works on both backends). */
    pixelLines(points, hex, width, opacity, over = !1) {
      let e = this.T,
        g = new LineSegmentsGeometry();
      g.setPositions(points);
      let m = new e.Line2NodeMaterial({
        color: hex,
        linewidth: width,
        transparent: !over,
        opacity: over ? 1 : opacity,
        depthTest: !over,
        depthWrite: !1,
        fog: !1,
      });
      m.userData.temporary = !0;
      let l = new LineSegments2(g, m);
      // Lines drawn over the walls (open-lane markers) come after the level and before the jet.
      return ((l.frustumCulled = !1), over && (l.renderOrder = 1), this.worldGroup.add(l), l);
    }
    createEffects() {
      let e = this.T;
      ((this.fxGeo = new e.IcosahedronGeometry(1, 1)),
        (this.fxGeo.userData.shared = !0),
        (this.fxMaterial = new e.MeshBasicNodeMaterial({
          color: 16777215,
          transparent: !0,
          opacity: 0.8,
          depthWrite: !1,
          blending: e.AdditiveBlending,
          fog: !1,
        })),
        (this.fxInstances = new e.InstancedMesh(this.fxGeo, this.fxMaterial, 384)),
        (this.fxInstances.frustumCulled = !1),
        (this.fxInstances.count = 0),
        this.scene.add(this.fxInstances));
      let t = new e.BufferGeometry();
      ((this.linePositions = new Float32Array(24576)),
        (this.lineColors = new Float32Array(24576)),
        t.setAttribute("position", new e.BufferAttribute(this.linePositions, 3).setUsage(e.DynamicDrawUsage)),
        t.setAttribute("color", new e.BufferAttribute(this.lineColors, 3).setUsage(e.DynamicDrawUsage)),
        t.setDrawRange(0, 0),
        (this.fxLines = new e.LineSegments(
          t,
          new e.LineBasicNodeMaterial({ vertexColors: !0, transparent: !0, opacity: 0.7, fog: !1 }),
        )),
        (this.fxLines.frustumCulled = !1),
        this.scene.add(this.fxLines),
        (this.dummy = new e.Object3D()),
        (this.tmpColor = new e.Color()));
    }
    disposeGroup(e) {
      for (; e.children.length; ) {
        let t = e.children[0];
        (e.remove(t),
          t.traverse((s) => {
            (s.geometry && !s.geometry.userData.shared && s.geometry.dispose(),
              s.isInstancedMesh && s.dispose(),
              s.material?.userData?.temporary && s.material.dispose());
          }));
      }
    }
    buildTerrain(e, t) {
      let s = this.T,
        i = this.N,
        n = e.environment;
      // The ground as the shipped view drew it: big flat-shaded facets (600-unit quads, 850 over cities and water),
      // two triangles each, over the same 22 x 21 km area, in the palette ground colour (snow above 450, a dark teal
      // cyber floor); quads wholly under the sea are left out.
      if (!["space", "strato", "tunnel"].includes(n)) {
        let r = ["city", "harbor", "ocean", "cyber", "geofront"].includes(n) ? 850 : 600,
          a = [],
          l = [],
          c = new s.Color(),
          u = [];
        for (let d = -11e3; d < 11e3; d += r)
          for (let p = -12e3; p < 9e3; p += r) {
            let f = [
              [d, e.heightAt(d, p), p],
              [d + r, e.heightAt(d + r, p), p],
              [d + r, e.heightAt(d + r, p + r), p + r],
              [d, e.heightAt(d, p + r), p + r],
            ];
            if (e.water && f.every((m) => m[1] < 0)) continue;
            c.set(
              n === "cyber"
                ? "#06232d"
                : n === "snow" && (f[0][1] + f[1][1] + f[2][1] + f[3][1]) / 4 > 450
                  ? "#b8c8c6"
                  : t.ground,
            );
            for (let m of [0, 2, 1, 0, 3, 2]) (a.push(...f[m]), l.push(c.r, c.g, c.b));
          }
        let d = new s.BufferGeometry();
        (d.setAttribute("position", new s.Float32BufferAttribute(a, 3)),
          d.setAttribute("color", new s.Float32BufferAttribute(l, 3)),
          d.computeVertexNormals());
        // Matte (no specular sheen), so the dark palette greens and teals keep their colour under the haze.
        let h = new s.MeshLambertNodeMaterial({ vertexColors: !0 });
        h.userData.temporary = !0;
        let m = new s.Mesh(d, h);
        ((m.receiveShadow = !0), this.worldGroup.add(m));
      }
      // Water as the shipped view drew it: a flat sea that runs from the low sky colour at the horizon to the
      // water colour at the bottom of the screen, with a slow drift of lighter swell over it near the jet.
      if (e.water) {
        let r = new s.PlaneGeometry(8e4, 8e4, 1, 1);
        r.rotateX(-Math.PI / 2);
        let a = new s.MeshBasicNodeMaterial({ fog: !1 }),
          l = this.horizonY.max(0),
          c = i.mix(this.srgb(t.low), this.srgb(t.water), i.screenUV.y.sub(l).div(i.float(1).sub(l).max(0.001)).clamp(0, 1)),
          u = this.clock;
        // (the swell fades out within 5 km, before its bands get finer than a pixel and shimmer)
        ((a.colorNode = i.mix(
          i.sRGBTransferEOTF(c),
          i.color("#628e97"),
          i
            .sin(i.positionWorld.x.mul(0.01).add(i.positionWorld.z.mul(0.008)).add(u))
            .mul(0.02)
            .add(0.02)
            .mul(i.float(1).sub(i.smoothstep(1500, 5e3, i.positionView.z.negate()))),
        )),
          (a.userData.temporary = !0));
        let d = new s.Mesh(r, a);
        ((d.position.y = 0.4), this.worldGroup.add(d));
      }
    }
    /** An sRGB "#rrggbb" as a vec3 node, unconverted (the sky mixes in sRGB like the shipped 2D canvas). */
    srgb(c) {
      let k = parseInt(c.slice(1), 16);
      return this.N.vec3(((k >> 16) & 255) / 255, ((k >> 8) & 255) / 255, (k & 255) / 255);
    }
    /**
     * The planet in space and the stratosphere, as the shipped view drew it in screen space: a disc 1.64 screen
     * widths across whose top sits 8% of the height above the bottom edge in level flight and rises with the jet's
     * pitch, filled with the canvas radial gradient (#6190ab to #1e5078 to #081c3f) and outlined by a 3 px #7fcde2 rim.
     */
    planetNodes() {
      let i = this.N,
        W = i.screenSize.x.div(this.pixelRatio),
        H = i.screenSize.y.div(this.pixelRatio),
        px = i.screenUV.mul(i.vec2(W, H)),
        a = H.mul(0.92).sub(this.planetPitch.mul(H).mul(0.65)),
        l = W.mul(0.82),
        cx = W.mul(0.55),
        cy = a.add(l.mul(0.6)),
        dx = px.x.sub(cx),
        d = i.vec2(dx, px.y.sub(cy)).length(),
        upper = i.step(px.y, cy),
        // createRadialGradient(cx, a + .22l, .1l, cx, a + .45l, l): the largest t whose circle passes through the pixel
        dy = px.y.sub(a.add(l.mul(0.22))),
        E = l.mul(0.23),
        R0 = l.mul(0.1),
        DR = l.mul(0.9),
        A = E.mul(E).sub(DR.mul(DR)),
        B = dy.mul(E).add(R0.mul(DR)).mul(-2),
        C = dx.mul(dx).add(dy.mul(dy)).sub(R0.mul(R0)),
        g = B.negate()
          .sub(B.mul(B).sub(A.mul(C).mul(4)).max(0).sqrt())
          .div(A.mul(2))
          .clamp(0, 1),
        col = i.select(
          g.lessThan(0.65),
          i.mix(this.srgb("#6190ab"), this.srgb("#1e5078"), g.div(0.65)),
          i.mix(this.srgb("#1e5078"), this.srgb("#081c3f"), g.sub(0.65).div(0.35)),
        ),
        rim = i.smoothstep(2, 1, d.sub(l).abs()).mul(upper),
        cover = i.smoothstep(l.add(0.5), l.sub(0.5), d).mul(upper).max(rim);
      return { color: i.sRGBTransferEOTF(i.mix(col, this.srgb("#7fcde2"), rim)), cover };
    }
    /**
     * The sky is the backdrop players always saw in the shipped game: a screen-space gradient (top colour at the top
     * edge, the horizon colour 46% down, the low colour at the bottom edge), the low colour under the real horizon,
     * a soft screen-space sun glow and the sun disc, and the planet arc in space and the stratosphere. The camera
     * never rolls (lookAt with a world up), so screenUV reproduces it exactly and the sky keeps its hazy-dusk
     * brightness whether the jet is level or climbing. The colours are mixed in sRGB like the 2D canvas did, and the
     * post chain keeps them unchanged on screen.
     */
    buildSky(e, t) {
      let s = this.T,
        i = this.N,
        n = e.environment,
        r = new s.MeshBasicNodeMaterial({ side: s.BackSide, depthWrite: !1, fog: !1 }),
        hex = (c) => this.srgb(c),
        y = i.screenUV.y.clamp(0, 1),
        a = ["space", "strato", "cyber", "tunnel"].includes(n)
          ? hex(t.top)
          : i.select(
              y.lessThan(0.46),
              i.mix(hex(t.top), hex(t.horizon), y.div(0.46)),
              i.mix(hex(t.horizon), hex(t.low), y.sub(0.46).div(0.54)),
            ),
        l = i.float(0);
      // below the horizon: the low colour at the horizon line running to the water colour at the bottom edge
      if (!["space", "strato", "tunnel"].includes(n)) {
        let c = this.horizonY.max(0),
          u = i.mix(hex(t.low), hex(t.water), y.sub(c).div(i.float(1).sub(c).max(0.001)).clamp(0, 1));
        a = i.mix(a, u, i.smoothstep(0, -0.004, i.positionLocal.y.div(7e4)));
      }
      if (!["space", "tunnel", "geofront", "cyber"].includes(n)) {
        let c = this.sunScreen,
          u = i
            .vec2(i.screenUV.x.sub(c.x).mul(i.screenSize.x.div(i.screenSize.y)), i.screenUV.y.sub(c.y))
            .length()
            .div(0.336),
          h = i
            .select(
              u.lessThan(0.16),
              i.mix(i.float(0.62), i.float(0.28), u.div(0.16)),
              i.mix(i.float(0.28), i.float(0), u.sub(0.16).div(0.84).min(1)),
            )
            .mul(c.z);
        ((a = i.mix(a, i.vec3(1, 0.831, 0.659), h)), (l = i.float(1).sub(i.smoothstep(0.158, 0.1667, u)).mul(c.z)));
      }
      // The planet covers the sun in the stratosphere, as it did in the shipped view.
      let c = i.mix(i.sRGBTransferEOTF(a), i.color(t.sun).mul(1.35), l),
        planet = ["space", "strato"].includes(n) ? this.planetNodes() : null;
      if (
        (planet && (c = i.mix(c, planet.color, planet.cover)),
        (r.colorNode = c),
        (r.userData.temporary = !0),
        (this.sky = new s.Mesh(new s.SphereGeometry(7e4, 24, 16), r)),
        (this.sky.renderOrder = -10),
        this.worldGroup.add(this.sky),
        ["space", "strato", "cyber"].includes(n))
      ) {
        let c = seededRandom(630),
          u = [];
        // (over the cyber floor only the upper half, so no star shows between the floor's edge and the horizon)
        for (let p = 0; p < 1300; p++) {
          let f = c() * Math.PI * 2,
            m = c() * 2 - 1,
            g = Math.sqrt(1 - m * m);
          n === "cyber" && (m = Math.abs(m));
          u.push(Math.cos(f) * g * 63e3, m * 63e3, Math.sin(f) * g * 63e3);
        }
        let d = createPoints({
          positions: new Float32Array(u),
          size: 1.4,
          sizeAttenuation: !1,
          material: { color: 13166064, fog: !1 },
        });
        ((d.material.userData.temporary = !0),
          planet && (d.material.maskNode = planet.cover.lessThan(0.5)),
          (d.object.geometry.userData.shared = !0),
          (this.stars = d.object),
          this.worldGroup.add(this.stars));
      } else this.stars = null;
      if (!["space", "strato", "geofront", "tunnel", "cyber"].includes(n)) {
        if (!this.cloudTexture) {
          let c = document.createElement("canvas");
          ((c.width = 128), (c.height = 64));
          let u = c.getContext("2d"),
            h = u.createRadialGradient(64, 32, 0, 64, 32, 60);
          (h.addColorStop(0, "rgba(220,241,239,.32)"),
            h.addColorStop(0.4, "rgba(189,221,225,.15)"),
            h.addColorStop(1, "rgba(189,221,225,0)"),
            (u.fillStyle = h),
            u.fillRect(0, 0, 128, 64),
            (this.cloudTexture = new s.CanvasTexture(c)));
        }
        this.cloudMat ||= new s.SpriteNodeMaterial({
          map: this.cloudTexture,
          transparent: !0,
          opacity: 0.6,
          depthWrite: !1,
          color: 13359310,
        });
        let f = seededRandom(115);
        for (let m = 0, x = this.kit.detail(22, 8); m < x; m++) {
          let g = new s.Sprite(this.cloudMat);
          ((g.geometry.userData.shared = !0),
            g.position.set((f() - 0.5) * 35e3, 2600 + f() * 2500, (f() - 0.5) * 3e4),
            g.scale.set(4e3 + f() * 7e3, 800 + f() * 1500, 1),
            this.worldGroup.add(g));
        }
      }
    }
    /**
     * Towers as the shipped view drew them: dark teal blocks with lit window bands, a 3-unit strip across 76% of each
     * wall at every floor (up to ten floors), mint or amber per tower, every third band dark on some, only within
     * 8.5 km. Per-tower data: height, floors, colour, skip. The strips fade to their average brightness once a floor
     * is a pixel or two tall, so distant towers do not shimmer.
     */
    buildingMaterial(o) {
      let e = this.T,
        t = this.N,
        s = t.instancedBufferAttribute(o),
        i = new e.MeshLambertNodeMaterial(),
        n = t.positionGeometry,
        r = t.normalGeometry,
        a = n.y.add(0.5).mul(s.x),
        l = s.x.div(s.y.max(1)),
        c = a.div(l),
        u = c.floor(),
        h = c.fract().mul(l),
        d = t.fwidth(a).max(0.001),
        p = t.mix(
          h.min(t.float(3).sub(h)).div(d).add(0.5).clamp(0, 1),
          t.float(3).div(l),
          d.div(l).mul(2).sub(0.5).clamp(0, 1),
        ),
        f = u
          .greaterThanEqual(1)
          .and(u.lessThanEqual(s.y.sub(1)))
          .and(s.w.greaterThan(0.5).and(u.mod(3).lessThan(0.5)).not())
          .and(r.y.abs().lessThan(0.5))
          .and(t.select(r.z.abs().greaterThan(0.5), n.x.abs().lessThan(0.38), n.z.abs().lessThan(0.37))),
        m = t.float(1).sub(t.smoothstep(8e3, 9e3, t.positionView.z.negate()));
      return (
        (i.emissiveNode = t
          .select(s.z.greaterThan(0.5), t.color("#9ad9c1"), t.color("#e7be8f"))
          .mul(p.mul(t.select(f, t.float(1), t.float(0))).mul(m))),
        (i.userData.temporary = !0),
        i
      );
    }
    buildBuildings(e) {
      let t = this.T,
        i = new t.Object3D(),
        n = new t.Color();
      // An empty InstancedMesh has a zero-sized instance buffer, which WebGPU rejects; maps without buildings skip it.
      if (e.buildings.length) {
        let k = e.buildings.length,
          o = new t.InstancedBufferAttribute(new Float32Array(k * 4), 4),
          s = new t.InstancedMesh(this.boxGeo, this.buildingMaterial(o), k),
          r = e.buildings.filter((a) => a.antenna);
        ((s.castShadow = !0), (s.receiveShadow = !0));
        (e.buildings.forEach((a, l) => {
          (i.position.set(a.x, a.y + a.h / 2, a.z),
            i.scale.set(a.w, a.h, a.d),
            i.rotation.set(0, 0, 0),
            i.updateMatrix(),
            s.setMatrixAt(l, i.matrix),
            n.set(a.color > 0.65 ? "#345058" : a.color > 0.3 ? "#29424b" : "#213c46"),
            s.setColorAt(l, n),
            o.setXYZW(
              l,
              a.h,
              Math.min(10, Math.floor(a.h / 32)),
              Math.floor(a.x + a.z) % 3 ? 1 : 0,
              Math.floor(a.x) % 2 === 0 ? 1 : 0,
            ));
        }),
          this.worldGroup.add(s));
        if (r.length) {
          let a = new t.InstancedMesh(this.boxGeo, this.antennaMat, r.length);
          (r.forEach((l, c) => {
            (i.position.set(l.x, l.y + l.h + 22.5, l.z), i.scale.set(4, 45, 4), i.updateMatrix(), a.setMatrixAt(c, i.matrix));
          }),
            this.worldGroup.add(a));
        }
      }
      // The street grid as the shipped view drew it: faint lines every 1560 units, lengthwise a little brighter.
      if (["city", "harbor", "geofront", "cyber"].includes(e.environment)) {
        let r = [],
          a = [];
        for (let l = -5700; l <= 5700; l += 1560) r.push(l, 21, -9500, l, 21, 3600);
        for (let l = -9e3; l < 4e3; l += 1560) a.push(-6e3, 21, l, 6e3, 21, l);
        for (let [l, c, u] of [
          [r, e.environment === "cyber" ? 3794638 : 9166535, 0.25],
          [a, 7978423, 0.18],
        ]) {
          let h = new t.BufferGeometry(),
            d = new t.LineBasicNodeMaterial({ color: c, transparent: !0, opacity: u, depthWrite: !1, fog: !1 });
          ((d.userData.temporary = !0),
            h.setAttribute("position", new t.Float32BufferAttribute(l, 3)),
            this.worldGroup.add(new t.LineSegments(h, d)));
        }
      }
      if (e.trees.length) {
        this.treeMat.color.set(e.environment === "snow" ? "#769994" : "#254e40");
        let a = new t.ConeGeometry(30, 85, 5),
          l = new t.InstancedMesh(a, this.treeMat, e.trees.length);
        ((l.castShadow = this.ultra),
          (l.receiveShadow = !0),
          e.trees.forEach((c, u) => {
            (i.position.set(c.x, c.y + c.h * 0.5, c.z),
              i.scale.set(c.h / 85, c.h / 85, c.h / 85),
              i.updateMatrix(),
              l.setMatrixAt(u, i.matrix));
          }),
          this.worldGroup.add(l));
      }
    }
    /**
     * Boxes in the shipped view's flat shading, one InstancedMesh per colour. Each entry is
     * [x, base y, z, width, height, depth, "#hex" or "#hex/open" (no underside)]. No shadows: the shipped view had none here, and the tunnel
     * roof would otherwise put the jet in permanent shade.
     */
    slabs(list) {
      let e = this.T,
        t = new Map(),
        s = new e.Object3D();
      for (let i of list) (t.get(i[6]) || t.set(i[6], []).get(i[6])).push(i);
      for (let [i, n] of t) {
        let [a, l] = i.split("/"),
          r = new e.InstancedMesh(this.boxGeo, this.softMat(a, !!l), n.length);
        (n.forEach((a, l) => {
          (s.position.set(a[0], a[1] + a[4] / 2, a[2]), s.scale.set(a[3], a[4], a[5]), s.updateMatrix(), r.setMatrixAt(l, s.matrix));
        }),
          r.computeBoundingSphere(),
          this.worldGroup.add(r));
      }
    }
    /**
     * The tunnel and the geofront as the shipped view drew them. Tunnel: green-teal walls, roof and floor in 500-unit
     * sections, grey-green blast doors with one open lane, mint rungs across the roof and floor every 400 units, and a
     * bright lime bar under every open lane that shows through the doors, so the next two or three lanes can be read
     * ahead ("find the green lane"). Geofront: no roof slab, the brown-grey haze overhead is the sky, crossed by the
     * edges of the girders at the ceiling height.
     */
    buildInterior(e) {
      let t = e.environment;
      if (t === "tunnel") {
        let s = [],
          i = [],
          n = [],
          r = [];
        for (let a = 1e3; a > -19500; a -= 500) {
          let l = this.engine.tunnelWidth(a);
          s.push(
            [-l / 2 - 30, 0, a, 50, 720, 500, "#24413d"],
            [l / 2 + 30, 0, a, 50, 720, 500, "#1c3637"],
            [0, 720, a, l + 110, 35, 500, "#1d3331/open"],
            [0, -15, a, l + 110, 30, 500, "#172e30"],
          );
        }
        for (let a = 800; a > -19400; a -= 400) {
          let l = this.engine.tunnelWidth(a);
          (i.push(-l / 2 + 5, 610, a, l / 2 - 5, 610, a), n.push(-l / 2 + 5, 65, a, l / 2 - 5, 65, a));
        }
        for (let a of e.gates) {
          let l = a.width / a.lanes;
          for (let u = 0; u < a.lanes; u++) {
            let h = -a.width / 2 + l * (u + 0.5);
            u !== a.open
              ? s.push([h, 0, a.z, l - 8, 720, 35, "#526359"])
              : s.push([h, 0, a.z, l - 8, 70, 35, "#536b57"], [h, 630, a.z, l - 8, 90, 35, "#536b57"]);
          }
          let c = -a.width / 2 + l * (a.open + 0.5);
          r.push(c - l * 0.4, 80, a.z + 25, c + l * 0.4, 80, a.z + 25);
        }
        (this.slabs(s),
          this.pixelLines(i, 8454075, 2, 0.5),
          this.pixelLines(n, 7920552, 2, 0.4),
          this.pixelLines(r, 12189552, 4, 0.9, !0));
      }
      if (t === "geofront") {
        let s = [];
        for (let i = -9e3; i < 9e3; i += 1500) s.push([i, 1640, -3500, 90, 35, 15e3, "#4a4840/open"]);
        this.slabs(s);
      }
    }
    rebuild() {
      if (!this.scene) return;
      let e = this.engine.world,
        t = PALETTES[e.environment] || PALETTES.city;
      ((this.version = this.engine.worldVersion),
        this.disposeGroup(this.worldGroup),
        this.fogColor.value.set(...[1, 3, 5].map((a) => parseInt(t.fog.slice(a, a + 2), 16) / 255)),
        this.buildSky(e, t),
        this.buildTerrain(e, t),
        this.buildBuildings(e),
        this.buildInterior(e),
        (this.cameraRig.initial = !0));
    }
    getModel(e, t = !1) {
      let s = e + t;
      if (this.models.has(s)) return this.models.get(s);
      let i = this.T,
        n = buildModel(e, t),
        r = { solid: [], glow: [] };
      for (let l of n.faces) {
        let c = l.glow ? r.glow : r.solid,
          u = new i.Color(l.color);
        l.glow && u.multiplyScalar(3);
        for (let h = 1; h < l.verts.length - 1; h++)
          for (let d of [l.verts[0], l.verts[h], l.verts[h + 1]]) c.push(d.x, d.y, d.z, u.r, u.g, u.b);
      }
      let a = new i.Group();
      for (let [l, c] of Object.entries(r)) {
        if (!c.length) continue;
        let u = [],
          h = [];
        for (let f = 0; f < c.length; f += 6) (u.push(...c.slice(f, f + 3)), h.push(...c.slice(f + 3, f + 6)));
        let d = new i.BufferGeometry();
        (d.setAttribute("position", new i.Float32BufferAttribute(u, 3)),
          d.setAttribute("color", new i.Float32BufferAttribute(h, 3)),
          d.computeVertexNormals(),
          (d.userData.shared = !0));
        // Jets cast shadows on the ground but do not shade themselves: self-shadowing only speckled their flat panels.
        let p = new i.Mesh(d, l === "glow" ? this.glowMat : this.aircraftMat);
        ((p.castShadow = !0), a.add(p));
      }
      if (n.lines.length) {
        let l = [];
        for (let u of n.lines) l.push(u.a.x, u.a.y, u.a.z, u.b.x, u.b.y, u.b.z);
        let c = new i.BufferGeometry();
        (c.setAttribute("position", new i.Float32BufferAttribute(l, 3)),
          (c.userData.shared = !0),
          a.add(new i.LineSegments(c, this.lineMat)));
      }
      if (((a.userData.scale = n.scale), (a.userData.engines = n.engines), n.engines))
        for (let u of [-4.2, 4.2]) {
          let h = new i.Mesh(this.flameGeo, this.flameMat);
          (h.position.set(u, -0.5, 40), (h.name = "engine-flame"), a.add(h));
        }
      return (this.models.set(s, a), a);
    }
    syncEntities() {
      let e = this.T,
        t = this.engine,
        s = new Set();
      for (let a of t.entities) {
        if (!a.alive) continue;
        s.add(a.id);
        let l = a.parked ? "R-201" : a.name,
          c = this.entityMeshes.get(a.id);
        if (!c || c.code !== l) {
          c && this.entityGroup.remove(c.mesh);
          let h = this.getModel(l, !a.neutral && !a.ally).clone(!0);
          ((c = { mesh: h, code: l }), this.entityMeshes.set(a.id, c), this.entityGroup.add(h));
        }
        let u = c.mesh;
        (u.position.set(a.pos.x, a.pos.y, a.pos.z),
          u.rotation.set(a.pitch, -a.yaw, a.roll, "YXZ"),
          u.scale.setScalar(u.userData.scale || 1),
          (u.visible = vdist(a.pos, t.p.pos) < 19e3));
      }
      for (let [a, l] of this.entityMeshes) s.has(a) || (this.entityGroup.remove(l.mesh), this.entityMeshes.delete(a));
      let i = AIRCRAFT[t.p.plane].code;
      (!this.playerMesh || this.playerCode !== i) &&
        (this.playerMesh && this.scene.remove(this.playerMesh),
        (this.playerMesh = this.getModel(i, !1).clone(!0)),
        // after the tunnel's open-lane markers, which draw over the walls
        this.playerMesh.traverse((a) => (a.renderOrder = 2)),
        (this.playerCode = i),
        this.scene.add(this.playerMesh));
      let n = t.p,
        r = t.state === "menu";
      ((this.playerMesh.visible = t.cameraMode !== 1 || r),
        this.playerMesh.position.set(n.pos.x, n.pos.y, n.pos.z),
        this.playerMesh.rotation.set(
          n.pitch,
          -n.yaw,
          n.roll + (t.evade > 0 ? Math.sin((1 - t.evade) * Math.PI) * Math.PI * 2 : 0),
          "YXZ",
        ),
        this.playerMesh.scale.setScalar((this.playerMesh.userData.scale || 1) * (r ? 1.8 : 1.1)));
      for (let a of this.playerMesh.children)
        a.name === "engine-flame" && (a.scale.z = t.input.boost ? 1.9 : 1 + Math.sin(t.demoTime * 50) * 0.08);
    }
    updateCamera() {
      let e = this.cameraRig;
      (this.camera.position.set(e.pos.x, e.pos.y, e.pos.z),
        this.camera.lookAt(e.target.x, e.target.y, e.target.z),
        Math.abs(this.camera.fov - e.fov) > 0.05 && ((this.camera.fov = e.fov), this.camera.updateProjectionMatrix()),
        this.camera.updateMatrixWorld(),
        this.camera.getWorldDirection(this.tmpDir),
        this.sky && this.sky.position.copy(this.camera.position),
        this.stars && this.stars.position.copy(this.camera.position),
        (this.planetPitch.value = this.engine.p.pitch),
        (this.horizonY.value = clamp(
          0.5 - this.tmpVec.set(this.tmpDir.x, 0, this.tmpDir.z).normalize().multiplyScalar(1e6).add(this.camera.position).project(this.camera).y * 0.5,
          -1,
          2,
        )),
        (this.pixelRatio.value = this.renderer.getPixelRatio()));
      // Where the sun lands on screen, for the sky's glow and disc (z = 0 when it is behind the camera or far off-screen).
      let s = this.sunProjected.copy(SUN_DIRECTION).multiplyScalar(1e5).add(this.camera.position).project(this.camera),
        i = this.tmpDir.dot(SUN_DIRECTION) > 0 && s.x > -3 && s.x < 3;
      this.sunScreen.value.set(s.x * 0.5 + 0.5, 0.5 - s.y * 0.5, i ? 1 : 0);
    }
    updateEffects() {
      let e = this.T,
        t = this.engine,
        s = this.dummy,
        i = 0,
        n = 0,
        r = (l, c, u) => {
          i >= 384 ||
            (s.position.set(l.x, l.y, l.z),
            s.rotation.set(0, 0, 0),
            s.scale.setScalar(c),
            s.updateMatrix(),
            this.fxInstances.setMatrixAt(i, s.matrix),
            this.tmpColor.set(u),
            this.fxInstances.setColorAt(i, this.tmpColor),
            i++);
        },
        a = (l, c, u, h = 1) => {
          if (!(n + 6 > this.linePositions.length)) {
            this.tmpColor.set(u).multiplyScalar(h);
            for (let d of [l, c])
              ((this.linePositions[n] = d.x),
                (this.lineColors[n++] = this.tmpColor.r),
                (this.linePositions[n] = d.y),
                (this.lineColors[n++] = this.tmpColor.g),
                (this.linePositions[n] = d.z),
                (this.lineColors[n++] = this.tmpColor.b));
          }
        };
      for (let l of t.effects) {
        let c = l.life / l.maxLife;
        if (l.type === "beam" || l.type === "tracer")
          (a(l.from, l.pos, l.color, 2 * c), l.type === "beam" && r(l.pos, l.width * 2 * c, l.color));
        else {
          let u = l.type === "explosion" ? l.size * (1 - c + 0.1) : l.size || 8;
          r(l.pos, u * Math.sqrt(c), l.color);
        }
      }
      for (let l of t.projectiles) {
        r(l.pos, l.bomb ? 5 : 2.5, l.enemy ? "#ff9866" : "#d5f3d9");
        for (let c = 1; c < l.trail.length; c++)
          a(l.trail[c - 1], l.trail[c], l.enemy ? "#ce8066" : "#94bdb4", (c / l.trail.length) * 0.9);
      }
      if (t.state === "playing" || t.state === "menu") {
        let l = t.p,
          c = heading(l.yaw, l.pitch),
          u = vscale(c, -1);
        for (let h of [-1, 1]) {
          let d = vadd(l.pos, vec(h * 4.5, -2, 0)),
            p = t.state === "menu" ? 1700 : clamp(l.speed - 180, 0, 550);
          for (let f = 0; f < 12; f++) {
            let m = vadd(d, vscale(u, 45 + (f * p) / 12)),
              g = vadd(d, vscale(u, 45 + ((f + 1) * p) / 12));
            a(m, g, "#b3dbe1", (1 - f / 12) * 0.26);
          }
        }
      }
      ((this.fxInstances.count = i),
        (this.fxInstances.instanceMatrix.needsUpdate = !0),
        this.fxInstances.instanceColor && (this.fxInstances.instanceColor.needsUpdate = !0),
        this.fxLines.geometry.setDrawRange(0, n / 3),
        (this.fxLines.geometry.attributes.position.needsUpdate = !0),
        (this.fxLines.geometry.attributes.color.needsUpdate = !0));
    }
    /** Screen position of a world point for the 2D HUD (no allocations besides the result). */
    project(e) {
      let t = this.tmpVec.set(e.x, e.y, e.z),
        s =
          (t.x - this.camera.position.x) * this.tmpDir.x +
          (t.y - this.camera.position.y) * this.tmpDir.y +
          (t.z - this.camera.position.z) * this.tmpDir.z;
      return (
        t.project(this.camera),
        {
          x: (t.x * 0.5 + 0.5) * this.kit.size.width,
          y: (-t.y * 0.5 + 0.5) * this.kit.size.height,
          depth: s,
          visible: s > 1,
        }
      );
    }
    render(e) {
      (this.version !== this.engine.worldVersion && this.rebuild(),
        (this.clock.value = this.engine.demoTime),
        this.frames++,
        this.syncEntities(),
        this.cameraRig.update(this.engine, e),
        this.updateCamera(),
        this.updateEffects());
      let t = this.engine.p.pos;
      (this.sun.position.set(t.x + KEY_LIGHT.x * 9e3, t.y + KEY_LIGHT.y * 9e3, t.z + KEY_LIGHT.z * 9e3),
        this.sun.target.position.set(t.x, t.y - 500, t.z),
        this.fill.position.set(t.x - KEY_LIGHT.x, t.y - KEY_LIGHT.y, t.z - KEY_LIGHT.z),
        this.fill.target.position.set(t.x, t.y, t.z),
        this.post.render());
    }
  },
  SoundSystem = class {
    constructor(e) {
      ((this.pilot = e),
        (this.ready = !1),
        (this.track = 0),
        (this.tickIndex = 0),
        (this.nextTick = 0),
        (this.lastGun = 0),
        (this.musicEnabled = !0));
    }
    async unlock() {
      if (!this.ready) {
        let e = window.AudioContext || window.webkitAudioContext;
        if (!e) return;
        ((this.ctx = new e()),
          (this.master = this.ctx.createGain()),
          this.master.connect(this.ctx.destination),
          (this.musicBus = this.ctx.createGain()),
          this.musicBus.connect(this.master),
          (this.effectsBus = this.ctx.createGain()),
          this.effectsBus.connect(this.master),
          (this.engineOsc = this.ctx.createOscillator()),
          (this.engineOsc.type = "sawtooth"),
          (this.engineFilter = this.ctx.createBiquadFilter()),
          (this.engineFilter.type = "lowpass"),
          (this.engineFilter.frequency.value = 350),
          (this.engineGain = this.ctx.createGain()),
          (this.engineGain.gain.value = 0.014),
          this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.effectsBus),
          this.engineOsc.start());
        let t = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, t, this.ctx.sampleRate);
        let s = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < t; i++) s[i] = Math.random() * 2 - 1;
        ((this.ready = !0), (this.nextTick = this.ctx.currentTime + 0.1));
      }
      (this.ctx.state === "suspended" && (await this.ctx.resume()), this.apply());
    }
    apply() {
      if (!this.ready) return;
      let e = this.pilot.data.settings,
        t = this.ctx.currentTime;
      (this.master.gain.setTargetAtTime(e.sound ? e.volume : 0, t, 0.08),
        this.musicBus.gain.setTargetAtTime(e.music * 0.19, t, 0.08));
    }
    tone(e, t = 0.1, s = "sine", i = 0.15, n = this.ctx?.currentTime, r = this.effectsBus, a = null) {
      if (!this.ready) return;
      let l = this.ctx.createOscillator(),
        c = this.ctx.createGain();
      ((l.type = s),
        l.frequency.setValueAtTime(e, n),
        a && l.frequency.exponentialRampToValueAtTime(a, n + t),
        c.gain.setValueAtTime(1e-4, n),
        c.gain.exponentialRampToValueAtTime(i, n + 0.012),
        c.gain.exponentialRampToValueAtTime(1e-4, n + t),
        l.connect(c).connect(r),
        l.start(n),
        l.stop(n + t + 0.02));
    }
    noise(e = 0.2, t = 0.1, s = 800, i = this.ctx?.currentTime, n = this.effectsBus) {
      if (!this.ready) return;
      let r = this.ctx.createBufferSource(),
        a = this.ctx.createBiquadFilter(),
        l = this.ctx.createGain();
      ((r.buffer = this.noiseBuffer),
        (a.type = "lowpass"),
        (a.frequency.value = s),
        l.gain.setValueAtTime(t, i),
        l.gain.exponentialRampToValueAtTime(1e-4, i + e),
        r.connect(a).connect(l).connect(n),
        r.start(i),
        r.stop(i + e + 0.01));
    }
    event(e, t = {}) {
      if (!this.ready || !this.pilot.data.settings.sound) return;
      let s = this.ctx.currentTime;
      if (e === "gun") {
        if (s - this.lastGun < 0.07) return;
        ((this.lastGun = s),
          ["Pul", "Las", "Neutron Beam"].includes(t.weapon)
            ? this.tone(1300, 0.09, "sine", 0.09, s, this.effectsBus, 220)
            : this.noise(0.08, 0.13, 2100));
      }
      if (
        (e === "missile" &&
          (this.noise(0.35, 0.16, 600), this.tone(260, 0.4, "triangle", 0.06, s, this.effectsBus, 1100)),
        e === "lock" && (this.tone(960, 0.06, "sine", 0.08), this.tone(1440, 0.11, "sine", 0.08, s + 0.075)),
        e === "explosion" &&
          t.distance < 6e3 &&
          this.noise(0.55, clamp(0.23 * (1 - t.distance / 6500), 0.015, 0.23), 380),
        e === "damage" && (this.noise(0.22, 0.16, 450), this.tone(115, 0.25, "sawtooth", 0.07)),
        e === "warning" && (this.tone(700, 0.08, "square", 0.045), this.tone(520, 0.1, "square", 0.045, s + 0.15)),
        e === "photo" && (this.noise(0.06, 0.12, 6e3), this.tone(1500, 0.09, "sine", 0.04, s + 0.08)),
        e === "flare" && (this.noise(0.5, 0.15, 2700), this.tone(650, 0.4, "triangle", 0.05, s, this.effectsBus, 180)),
        e === "complete" &&
          [440, 554.37, 659.25, 880].forEach((i, n) => this.tone(i, 0.6, "triangle", 0.08, s + n * 0.14)),
        e === "failed" && [330, 261.6, 196].forEach((i, n) => this.tone(i, 0.5, "triangle", 0.09, s + n * 0.23)),
        e === "click" && this.tone(900, 0.035, "sine", 0.035),
        e === "radio" &&
          (this.tone(1500, 0.025, "sine", 0.035), this.pilot.data.settings.voice && window.speechSynthesis))
      ) {
        speechSynthesis.cancel();
        let i = new SpeechSynthesisUtterance(t.text);
        ((i.rate = 1.08),
          (i.pitch = 0.95),
          (i.volume = this.pilot.data.settings.volume * 0.8),
          speechSynthesis.speak(i));
      }
    }
    update(e) {
      if (!this.ready || this.ctx.state !== "running") return;
      let t = this.ctx.currentTime;
      if (
        (this.engineOsc.frequency.setTargetAtTime(32 + (e.p.speed || 300) * 0.16, t, 0.2),
        this.engineFilter.frequency.setTargetAtTime(e.input.boost ? 650 : 270, t, 0.1),
        this.engineGain.gain.setTargetAtTime(e.state === "playing" ? 0.021 : 0.009, t, 0.2),
        !this.pilot.data.settings.sound || !this.musicEnabled)
      )
        return;
      this.nextTick < t - 1 && (this.nextTick = t + 0.05);
      let s = [116, 94, 132][this.track],
        i = 60 / s / 4;
      for (; this.nextTick < t + 0.13; ) {
        let n = this.nextTick,
          r = this.tickIndex++,
          a = [45, 41, 48, 43][Math.floor(r / 64) % 4] + [0, 0, 12][this.track],
          l = (u) => 440 * 2 ** ((u - 69) / 12);
        (r % 4 === 0 &&
          (this.tone(130, 0.16, "sine", 0.43, n, this.musicBus, 38), this.noise(0.08, 0.06, 140, n, this.musicBus)),
          r % 8 === 4 && this.noise(0.13, 0.19, 1900, n, this.musicBus),
          r % 2 === 0 && this.noise(0.032, 0.045, 1e4, n, this.musicBus),
          r % 4 === 0 && this.tone(l(a - 12), i * 3.5, "triangle", 0.3, n, this.musicBus));
        let c = [0, 7, 12, 15, 7, 19, 12, 7];
        if (
          (this.tone(l(a + c[Math.floor(r / 2) % 8]), i * 2.4, "sine", r % 2 === 0 ? 0.09 : 0.025, n, this.musicBus),
          r % 32 === 0)
        )
          for (let u of [0, 3, 7, 14]) this.tone(l(a + u + 12), i * 30, "triangle", 0.035, n, this.musicBus);
        this.nextTick += i;
      }
    }
  },
  byId = (o) => document.getElementById(o),
  escapeHtml = (o) =>
    String(o ?? "").replace(
      /[&<>"']/g,
      (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e],
    ),
  ARROW = '<span class="arrow">\u2197</span>',
  PLANE_SILHOUETTE =
    '<svg class="plane-silhouette" viewBox="0 0 80 54"><path d="M40 0L45 22L76 41L75 47L46 36L48 48L56 53L40 49L24 53L32 48L34 36L5 47L4 41L35 22Z"/></svg>',
  pilot = new PilotRecord(),
  engine = new FlightEngine(pilot),
  sound = new SoundSystem(pilot),
  view = new FlightView(kit, engine),
  currentScreen = "home",
  briefingId = 1,
  hangarReturn = "home",
  hangarPlane = pilot.data.selected,
  archiveTab = "guide",
  campaignChapter = 0,
  toastUntil = 0,
  radioUntil = 0,
  bannerUntil = 0,
  warningUntil = 0,
  warningText = "",
  instrumentTimer = 0,
  introTime = 0,
  introSlide = -1,
  mapPausedFlight = !1,
  mouseSteer = { x: 0, y: 0 },
  heldAfterMenu = new Set(),
  menuRepeat = -1,
  inputSettle = 0,
  BUILD = "1.1.0-kit",
  perfLog = {
    build: BUILD,
    frames: 0,
    renderedFrames: 0,
    elapsed: 0,
    backend: view.name,
    errors: [],
    warnings: [],
  },
  loggedIssues = new Set(),
  audioEnabled = !0;
function logIssue(o, e, t = !1) {
  let s = o + ": " + String(e?.message || e || "Unavailable");
  if (loggedIssues.has(s)) return;
  loggedIssues.add(s);
  let i = t ? perfLog.warnings : perfLog.errors;
  (i.push(s), i.length > 40 && i.shift(), (t ? console.warn : console.error)("Neon Skies / " + s, t ? "" : e));
}
function disableAudio(o) {
  if (audioEnabled) {
    ((audioEnabled = !1), (sound.ready = !1), logIssue("Audio disabled for this session", o, !0));
    try {
      sound.master?.disconnect();
    } catch {}
    try {
      sound.ctx?.close()?.catch(() => {});
    } catch {}
  }
}
function soundCall(o, ...e) {
  if (audioEnabled)
    try {
      let t = sound[o](...e);
      t?.catch && t.catch(disableAudio);
    } catch (t) {
      disableAudio(t);
    }
}
function cancelSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch (o) {
    logIssue("Speech unavailable", o, !0);
  }
}
function guarded(o, e) {
  try {
    return e();
  } catch (t) {
    logIssue(o, t);
  }
}
function toast(o, e = 4200) {
  ((byId("toast").textContent = o), byId("toast").classList.add("active"), (toastUntil = performance.now() + e));
}
function showScreen(o) {
  ((currentScreen = o),
    (document.body.dataset.screen = o),
    (byId("home").hidden = o !== "home"),
    (byId("panel").hidden = !["campaign", "briefing", "hangar", "archive", "settings", "sideops"].includes(o)),
    byId("home").classList.toggle("hidden", o !== "home"),
    byId("panel").classList.toggle(
      "hidden",
      !["campaign", "briefing", "hangar", "archive", "settings", "sideops"].includes(o),
    ),
    byId("topbar").classList.toggle("hidden", ["game", "result", "pause", "intro", "service"].includes(o)),
    byId("hud").classList.toggle("hidden", !["game", "pause", "service"].includes(o)),
    byId("result-overlay").classList.toggle("hidden", !["result", "pause"].includes(o)),
    byId("intro").classList.toggle("hidden", o !== "intro"),
    o !== "hangar" && byId("panel").classList.remove("hangar-panel"),
    ["game", "pause", "service"].includes(o) || byId("map-overlay").classList.add("hidden"),
    syncTouchControls());
}
/** The kit's on-screen flight controls only belong to active flight; menus stay free to tap. */
function syncTouchControls() {
  kit.touch?.suspend(!["game", "service"].includes(currentScreen) || !byId("map-overlay").classList.contains("hidden"));
}
function openPanel(o) {
  return (
    showScreen(o),
    (byId("panel").scrollTop = 0),
    '<button class="square-btn close-panel" data-action="home" aria-label="Close panel">\xD7</button>'
  );
}
function nextMission() {
  return pilot.data.unlocked === 36 && pilot.bonusMission ? 36 : Math.min(pilot.data.unlocked, 35);
}
function refreshHome() {
  let o = AIRCRAFT[pilot.data.selected];
  ((byId("home-plane-code").textContent = o.code),
    (byId("home-plane-name").textContent = o.name.toUpperCase()),
    (document.querySelector(".airframe-label .kicker").textContent =
      `AIRFRAME ${String(o.id + 1).padStart(2, "0")} / READY FOR SORTIE`),
    (byId("main-play").innerHTML =
      (pilot.data.unlocked > 1 ? "CONTINUE OPERATION" : "ENTER THE COCKPIT") + " " + ARROW),
    byId("sound-button").querySelector(".sound-bars").classList.toggle("muted", !pilot.data.settings.sound),
    (byId("backend").textContent = view.name + " / 1.1.0" + (pilot.persistent ? " / LOCAL SAVE" : " / VOLATILE SAVE")),
    updateTouchMode());
}
function goHome() {
  (engine.initDemo(),
    (engine.cameraMode = 0),
    (engine.p.plane = pilot.data.selected),
    showScreen("home"),
    refreshHome(),
    cancelSpeech());
}
function unlockHint(o) {
  if (o.id === 0) return "STANDARD ISSUE";
  if (o.id === 18) return "A rank on all 36 missions, any difficulty.";
  if (o.id === 19) return "A rank on all 36 missions on Normal or Hard.";
  if (o.id === 20) return "Complete Geopelia in under 5:00.";
  let e = parseInt(o.unlock),
    t = MISSIONS[e - 1];
  return `${o.unlock.includes("*") ? "A rank in" : "Complete"} ${String(e).padStart(2, "0")} \xB7 ${t?.title || "special operation"}.`;
}
function rankGoal(o) {
  return o.id === 3
    ? "A RANK / 5,000 training points"
    : o.id === 22
      ? "A RANK / Remain undetected"
      : o.id === 7
        ? "A RANK / Complete all 12 targets"
        : o.aTime
          ? `A RANK / Finish under ${formatClock(o.aTime)}`
          : `A RANK / ${o.aKills}+ confirmed eliminations` + (o.id === 17 ? " \xB7 No civilian losses" : "");
}
function showCampaign(o = campaignChapter) {
  campaignChapter = o;
  let e = openPanel("campaign"),
    t = MISSIONS.filter((s) => pilot.best(s.id)).length;
  e += `<div class="panel-head"><div><div class="kicker">UPEO / OPERATIONS DESK</div><h1>The long way home.</h1><p>From Expo City to the edge of reality. Every operation is another piece of the signal.</p></div><div class="panel-meta"><span class="chip lime">${t} / 36 CLEARED</span><span class="chip">PILOT LEVEL ${pilot.level}</span></div></div><div class="chapter-tabs">${["I \xB7 FIRST CONTACT", "II \xB7 BEYOND THE CLOUDS", "III \xB7 HIDDEN HANDS", "IV \xB7 GHOST SIGNAL"].map((s, i) => `<button class="${o === i ? "active" : ""}" data-action="chapter" data-id="${i}">${s}</button>`).join("")}<button class="${o === 4 ? "active" : ""}" data-action="chapter" data-id="4">ALL OPERATIONS</button></div><div class="mission-grid">`;
  for (let s of MISSIONS.filter((i) => o === 4 || Math.floor((i.id - 1) / 9) === o)) {
    let i = pilot.best(s.id),
      n = pilot.canPlay(s.id),
      r = s.id === nextMission();
    e += `<button class="mission-card ${n ? "" : "locked"} ${r ? "current" : ""}" data-action="briefing" data-id="${s.id}"><span class="mission-number">${String(s.id).padStart(2, "0")} / ${s.environment.toUpperCase()}</span>${i ? `<span class="rank-badge">${i}</span>` : n ? (r ? '<span class="rank-badge" style="font-size:9px">NEXT \u2197</span>' : "") : '<span class="lock-mark">LOCKED</span>'}<h3>${escapeHtml(s.title)}</h3><span class="location">${escapeHtml(s.location)}</span></button>`;
  }
  ((e += `</div><div class="campaign-footer">${pilot.simulator ? "MISSION SIMULATOR ONLINE \xB7 Replay completed operations with unlocked airframes to improve your best ranks." : "MISSION SIMULATOR \xB7 Complete the campaign on Normal or Hard. Cleared operations can already be replayed."}<br>GEOPELIA ACCESS \xB7 Earn A or B on all 35 standard operations. Current qualifying marks: ${MISSIONS.slice(0, 35).filter((s) => (RANK_VALUE[pilot.best(s.id)] || 0) >= 3).length}/35.</div>`),
    (byId("panel").innerHTML = e));
}
function assignedPlane(o) {
  return [12, 19].includes(o)
    ? 6
    : o === 16
      ? 9
      : o >= 31 && o <= 35 && pilot.data.chain
        ? pilot.data.chain.plane
        : pilot.data.selected;
}
function loadoutFor(o) {
  let e = AIRCRAFT[assignedPlane(o.id)],
    t = o.id === 16 ? ["Neutron Beam"] : e.guns,
    s = o.id === 18 ? ["Anti-Nanobite Bomb"] : o.id === 16 ? ["Plasma Beam"] : [...e.missiles];
  return (
    pilot.osl && pilot.simulator && ![16, 18].includes(o.id) && s.push("OSL"),
    { plane: e, guns: t, missiles: s }
  );
}
function showBriefing(o) {
  let e = MISSIONS.find((l) => l.id === o) || SIDE_OPS.find((l) => l.id === o);
  if (!e) return;
  briefingId = o;
  let t = pilot.canPlay(o),
    { plane: s, guns: i, missiles: n } = loadoutFor(e),
    r = o <= 36 ? pilot.best(o) : pilot.data.records[o]?.rank,
    a = openPanel("briefing");
  ((a += `<button class="back-btn" data-action="${e.expansion ? "sideops" : "campaign"}">\u2190 ${e.expansion ? "SIDE OPERATIONS" : "OPERATIONS"}</button><div class="panel-head"><div><div class="kicker" style="margin-top:20px">OPERATION ${String(o).padStart(2, "0")} / ${escapeHtml(e.role)}</div><h1>${escapeHtml(e.title)}.</h1></div><div class="panel-meta"><span class="chip">${escapeHtml(e.location.toUpperCase())}</span>${r ? `<span class="chip lime">BEST RANK ${r}</span>` : ""}${e.expansion ? '<span class="chip amber">ORIGINAL EXPANSION</span>' : ""}</div></div><div class="brief-grid"><div><p class="brief-text">${escapeHtml(e.brief)}</p><div class="brief-objective"><div class="section-label">MISSION DIRECTIVE</div>${escapeHtml(e.objective)}</div><div class="rank-condition">${rankGoal(e)}</div><p class="tiny-copy" style="margin-top:18px">${o >= 30 && o <= 35 ? "CONTINUOUS OPERATION / Your selected airframe remains assigned through Mission 35. Modern checkpoint saves are enabled." : "PRIMARY TARGETS are marked TGT. Optional hostiles contribute to rank and pilot experience. Neutral aircraft and facilities must not be attacked."}</p><div class="soft-card" style="margin-top:22px"><div class="section-label">PILOT ADVISORY</div><p class="tiny-copy">${pilotAdvisory(e)}</p></div></div><div><div class="brief-map"><canvas id="brief-map"></canvas><div class="map-stamp">FLIGHT PLAN / ${String(o).padStart(2, "0")}</div><div class="map-coordinates"><span>RECON LINK ACTIVE</span><span>TACTICAL PROJECTION</span></div></div><div class="brief-loadout"><div><div class="kicker">ASSIGNED AIRFRAME</div><h3>${escapeHtml(s.code)} <span style="font-size:12px;color:var(--muted)">${escapeHtml(s.name)}</span></h3><p>${s.ammo} MISSILES \xB7 ${s.id >= 7 ? "4" : "2"} LAUNCH RAILS</p></div>${[12, 16, 19].includes(o) || (o >= 31 && o <= 35) ? '<span class="chip">MISSION LOCK</span>' : '<button class="outline-btn" data-action="brief-hangar">CHANGE \u2197</button>'}</div><div class="select-row"><div class="field"><label for="loadout-gun">GUN SLOT</label><select id="loadout-gun">${i.map((l) => `<option value="${l}" ${pilot.data.gun === l ? "selected" : ""}>${WEAPONS[l].name}</option>`).join("")}</select></div><div class="field"><label for="loadout-missile">MISSILE SLOT</label><select id="loadout-missile">${n.map((l) => `<option value="${l}" ${pilot.data.missile === l ? "selected" : ""}>${WEAPONS[l].name}</option>`).join("")}</select></div></div><div class="field"><label for="difficulty-select">DIFFICULTY</label><select id="difficulty-select"><option value="easy" ${pilot.data.settings.difficulty === "easy" ? "selected" : ""}>EASY / REDUCED ENEMY PRESSURE</option><option value="normal" ${pilot.data.settings.difficulty === "normal" ? "selected" : ""}>NORMAL / STANDARD ENGAGEMENT</option><option value="hard" ${pilot.data.settings.difficulty === "hard" ? "selected" : ""}>HARD / ELITE ENGAGEMENT</option></select></div>${pilot.simulator && pilot.best(o) && ![16, 18].includes(o) ? `<div class="field"><label for="sim-override">SIMULATOR WEAPON OVERRIDE</label><select id="sim-override"><option value="">STANDARD LOADOUT</option>${["Msl", "Spread Bomb", "OSL", "Plasma Beam"].map((l) => `<option value="${l}">${WEAPONS[l].name}</option>`).join("")}</select><p class="tiny-copy">Touch-friendly equivalent of the guide's Start + face-button simulator codes.</p></div>` : ""}<div class="launch-row"><button class="primary" data-action="launch" ${t ? "" : "disabled"}>${t ? "LAUNCH OPERATION" : o === 36 ? "A/B RANKS REQUIRED" : e.expansion ? "PILOT LEVEL " + e.level + " REQUIRED" : "COMPLETE PREVIOUS OPERATION"} ${ARROW}</button></div><p class="tiny-copy">GPU flight systems online / ${view.name}. ${pilot.data.settings.assist ? "FLIGHT ASSIST ON" : "FLIGHT ASSIST OFF"}</p></div></div>`),
    (byId("panel").innerHTML = a),
    requestAnimationFrame(() => drawMap(byId("brief-map"), e)));
}
function pilotAdvisory(o) {
  return (
    {
      3: "Follow at less than 1,000 ft / 305 world meters. Use BRAKE and BOOST to match speed. Earn 3,200 formation points before target practice.",
      6: "The MISSILE button becomes your camera when a facility is selected. Center the target precisely, within 3.2 km. No ammunition is consumed.",
      7: "Prioritize the nearest chimney in front of the UI-4052. A collision or direct hit on the cargo aircraft ends the operation.",
      9: "Missile locks are jammed. Line up a gun pass. The central core only takes damage from a higher firing position.",
      10: "Keep below the 900 m canyon radar ceiling. Stay close to the neutral lead aircraft and follow its river route.",
      16: "Acceleration carries momentum in zero gravity. Use small corrections and let the neutron and plasma beams do the work.",
      17: "Only six train cars are hostile. The other three are neutral. Missiles cannot lock on; use precision gun passes.",
      18: "The hollow ground circle predicts bomb impact. Release before the circle reaches the center of a colony cluster. Only the special bomb can clear nanobites.",
      20: "Sheltered submarines need a low, level attack through the harbor entrance. Shots from more than 260 m above the target strike the roof.",
      21: "Carrier weak points are underneath. Stay below the hull and fire four clean missiles per component.",
      22: "JAM ACTIVE gives you 90 seconds to attack below 12,500 ft. Climb during every 15-second jammer gap. Detection permanently caps the rank at D.",
      27: "Stay below 1,300 ft until CLEARED TO ENGAGE appears. Crossing the ceiling early summons interceptors and caps rank at D.",
      31: "Line up with the green lane before each gate. BRAKE makes direction changes easier, but keep moving. Later gates use three lanes.",
      32: "Geofront has a solid ceiling. Use close-range head-on or tail shots against the Night Raven.",
      33: "Supports cannot be locked. Use your gun reticle. The X-49 is a hazard, not a target.",
      34: "Do not waste salvos in a turning chase. Get close, match altitude, and shoot head-on or from directly behind.",
      35: "The digital floor is still solid. Watch the altimeter and radar after the environment changes.",
      36: "The first kill transfers you into an XR-900. Use its laser cannon and renewed missile supply to dismantle the remaining squadron.",
    }[o.id] ||
    "Keep the target near the center reticle until LOCK appears, then fire. Tail-aspect shots are most reliable. Brake for tighter turns, and deploy FLARE / ROLL when a missile closes in."
  );
}
function showHangar(o = hangarReturn) {
  hangarReturn = o;
  let e = openPanel("hangar");
  byId("panel").classList.add("hangar-panel");
  let t = AIRCRAFT[hangarPlane],
    s = pilot.isPlaneUnlocked(t.id);
  ((engine.p.plane = t.id),
    (e += `<div class="hangar-content"><button class="back-btn" data-action="hangar-back">\u2190 ${o === "briefing" ? "MISSION BRIEFING" : "HOME"}</button><div class="kicker" style="margin-top:23px">HANGAR / ${String(t.id + 1).padStart(2, "0")} OF 21</div><h1>${escapeHtml(t.code)}.</h1><p class="airframe-name">${escapeHtml(t.name.toUpperCase())}</p><div class="chip ${s ? "lime" : "amber"}">${s ? "AIRFRAME AVAILABLE" : "RESEARCH LOCKED"}</div><div style="margin:25px 0">${["Power", "Attack", "Armor", "Stability", "Mobility"].map((i, n) => `<div class="stat-row"><span>${i}</span><span class="stat-track"><i style="width:${t.stats[n] * 10}%"></i></span><span>${String(t.stats[n]).padStart(2, "0")}</span></div>`).join("")}</div><p class="tiny-copy">${t.ammo} MISSILE CAPACITY<br>${t.guns.map((i) => WEAPONS[i].name).join(" / ")}<br>${t.missiles.map((i) => WEAPONS[i].name).join(" / ")}</p><p class="tiny-copy" style="color:${s ? "var(--muted)" : "var(--amber)"}">${s ? "Unlocked and flight-certified." : escapeHtml(unlockHint(t))}</p><button class="primary" data-action="select-plane" data-id="${t.id}" ${s ? "" : "disabled"}>${pilot.data.selected === t.id ? "AIRFRAME EQUIPPED" : "EQUIP AIRFRAME"} ${ARROW}</button><div style="display:flex;justify-content:space-between;margin-top:25px"><span class="kicker">PILOT LEVEL ${pilot.level}</span><span class="kicker" style="color:var(--lime)">${pilot.data.credits.toLocaleString()} CREDITS</span></div><div class="upgrade-row">${[
      ["armor", "HULL PLATING", "+15 INTEGRITY"],
      ["engine", "THRUST VECTOR", "+25 BOOST SPEED"],
      ["link", "NEURAL LINK", "FASTER LOCK"],
    ]
      .map(
        ([i, n, r]) =>
          `<button class="upgrade-btn" data-action="upgrade" data-key="${i}" ${pilot.data.upgrades[i] >= 3 ? "disabled" : ""}>${n} ${pilot.data.upgrades[i]}/3<b>${pilot.data.upgrades[i] >= 3 ? "MAXIMUM" : (pilot.data.upgrades[i] + 1) * 450 + " CR"}</b>${r}</button>`,
      )
      .join(
        "",
      )}</div><p class="tiny-copy" style="font-size:8px">Pilot upgrades are original additions and apply to every airframe.</p></div><div class="airframe-tiles">${AIRCRAFT.map((i) => `<button class="airframe-tile ${i.id === t.id ? "selected" : ""} ${pilot.isPlaneUnlocked(i.id) ? "" : "locked"}" data-action="preview-plane" data-id="${i.id}"><span class="aircraft-index">${String(i.id + 1).padStart(2, "0")}</span>${PLANE_SILHOUETTE}<h3>${escapeHtml(i.code)}</h3><p>${escapeHtml(i.name)}</p></button>`).join("")}</div>`),
    (byId("panel").innerHTML = e),
    requestAnimationFrame(() => {
      byId("panel").querySelector(".airframe-tile.selected")?.scrollIntoView({ block: "nearest", inline: "center" });
    }));
}
function showSideOps() {
  let o = openPanel("sideops");
  o += `<div class="panel-head"><div><div class="kicker">OPTIONAL / ORIGINAL EXPANSION</div><h1>The stories between sorties.</h1><p>Three new operations set between the guide\u2019s events. These missions award experience and credits without changing the original campaign\u2019s rank requirements.</p></div><span class="chip lime" style="margin-top:25px">PILOT LEVEL ${pilot.level}</span></div><div class="mission-grid" style="margin-top:35px">`;
  for (let e of SIDE_OPS)
    o += `<button class="mission-card ${pilot.canPlay(e.id) ? "" : "locked"}" style="min-height:205px" data-action="briefing" data-id="${e.id}"><span class="mission-number">SIDE OP ${e.id - 36} / LV ${e.level}</span><h3 style="font-size:25px;margin-top:24px">${e.title}</h3><p class="tiny-copy">${e.brief.replace("Expansion: ", "")}</p><span class="location">${e.location}</span>${pilot.data.sideClears[e.id] ? '<span class="rank-badge">\u2713</span>' : ""}</button>`;
  ((o +=
    '</div><div class="campaign-footer">LEVEL PROGRESSION \xB7 Earn 650 experience per pilot level. Complete primary and optional targets, maintain airframe integrity, and improve your mission ranks.</div>'),
    (byId("panel").innerHTML = o));
}
function showArchive(o = archiveTab, e = "") {
  archiveTab = o;
  let t = openPanel("archive");
  if (
    ((t += `<div class="panel-head"><div><div class="kicker">FLIGHT ARCHIVE / OFFLINE REFERENCE</div><h1>Know your airspace.</h1><p>The complete supplied field guide, aircraft and weapon reference, and clearly identified additions.</p></div></div><div class="archive-layout"><nav class="archive-nav">${[
      ["guide", "MISSION DOSSIERS"],
      ["weapons", "WEAPON SYSTEMS"],
      ["controls", "FLIGHT SCHOOL"],
      ["source", "SOURCE & CONTINUITY"],
      ["music", "MUSIC PLAYER"],
      ["credits", "CREDITS"],
    ]
      .map(
        ([s, i]) =>
          `<button class="${o === s ? "active" : ""}" data-action="archive-tab" data-key="${s}">${i}</button>`,
      )
      .join("")}</nav><div class="archive-main">`),
    o === "guide")
  )
    t += `<input type="search" id="archive-search" placeholder="Search missions, locations, or objectives\u2026" aria-label="Search mission dossiers" value="${escapeHtml(e)}"><div id="dossier-list">${dossierList(e)}</div>`;
  else if (o === "weapons") {
    t +=
      '<h2>14 ways to make your point.</h2><p>Six gun systems and eight missile-slot weapons. Guns have unlimited ammunition but build heat; rail reloads and finite missile reserves reward careful firing.</p><div class="weapon-grid">';
    for (let [s, i] of Object.entries(WEAPONS))
      t += `<div class="weapon-card"><div class="kicker" style="color:var(--lime)">${i.slot.toUpperCase()} SLOT</div><h3 style="margin-top:13px">${i.name}</h3><p>${i.desc}</p><div class="tiny-copy">${(i.range / 1e3).toFixed(1)} KM RANGE / ${i.damage} DAMAGE${i.reload ? " / " + i.reload + " S RELOAD" : ""}</div></div>`;
    t += "</div>";
  } else if (o === "controls") t += flightSchoolHtml();
  else if (o === "source")
    t += `<h2>One guide. A complete flight record.</h2><p>Basis: <strong>Ace Combat 3: Electrosphere \u2014 Guide and Walkthrough</strong>, Shotgunnova (P. Summers), updated October 19, 2009. The supplied international campaign is retained, including all 36 mission dossiers, locations, aircraft, weapons, rankings, unlocks, and reference notes.</p>${SOURCE_NOTES.map((s) => `<p class="source-warning">${escapeHtml(s)}</p>`).join("")}<details class="dossier"><summary>OPEN THE COMPLETE USER-SUPPLIED GUIDE</summary><pre>${escapeHtml(GUIDE_TEXT)}</pre></details>`;
  else if (o === "music") {
    t += `<h2>Radio silence is overrated.</h2><p>Three original, procedurally synthesized tracks. No music from Ace Combat is reproduced.</p>${pilot.musicPlayer ? "" : '<div class="source-warning">MUSIC PLAYER LOCKED \xB7 Finish the campaign on Easy. The adaptive background soundtrack remains available during normal play.</div>'}`;
    for (let [s, i, n] of [
      [0, "Afterhours Airspace", "116 BPM / NEON DOWNTEMPO"],
      [1, "Above the Weather", "94 BPM / ORBITAL AMBIENT"],
      [2, "Ghosts in the Wire", "132 BPM / DIGITAL PURSUIT"],
    ])
      t += `<button class="track ${sound.track === s ? "active" : ""}" data-action="track" data-id="${s}" ${pilot.musicPlayer ? "" : "disabled"}><span>0${s + 1}</span><div><strong>${i}</strong><small>${n} \xB7 ORIGINAL COMPOSITION</small></div></button>`;
    t += `<p class="tiny-copy">HARD COMPLETION BONUS / ${pilot.osl ? "ALTERNATE INTRO UNLOCKED" : "ALTERNATE INTRO LOCKED"}</p><button class="outline-btn" data-action="intro" ${pilot.osl ? "" : "disabled"}>PLAY ORIGINAL ALTERNATE INTRO \u2197</button><p class="tiny-copy">The original Japanese commercial intro was not supplied. This unlock presents a newly authored cinematic instead.</p>`;
  } else t += creditsHtml();
  ((t += "</div></div>"), (byId("panel").innerHTML = t));
}
function dossierList(o = "") {
  let e = o.toLowerCase();
  return (
    MISSIONS.filter((t) => (t.title + " " + t.location + " " + t.source).toLowerCase().includes(e))
      .map(
        (t) =>
          `<article class="dossier"><div class="kicker">${String(t.id).padStart(2, "0")} / ${escapeHtml(t.location)}</div><h3 style="margin-top:10px">${escapeHtml(t.title)}</h3><p>${escapeHtml(t.brief)}</p><p style="color:var(--lime);font-size:11px">${escapeHtml(t.objective)}</p><div class="tiny-copy">${rankGoal(t)}</div><details><summary>FIELD NOTES / ORIGINAL SOURCE</summary><pre>${escapeHtml(t.source)}</pre></details><button class="secondary" data-action="briefing" data-id="${t.id}">OPEN BRIEFING \u2197</button></article>`,
      )
      .join("") || "<p>No matching records. Try a mission title, aircraft, or location.</p>"
  );
}
function flightSchoolHtml() {
  return `<h2>First flight. No wrong turns.</h2><p>Fly from behind your airframe, switch to the nose camera for precision work, and read the green target brackets. A confirmed lock is a firing opportunity\u2014not a promise.</p><div class="source-warning">TOUCH / Put your thumb anywhere on the left half to fly: the stick appears under it. Hold GUN or MISSILE to fire. BOOST adds speed; BRAKE tightens your turn. FLARE breaks nearby missile locks with an evasive roll. TARGET, CAM, MAP and pause sit along the top edge.</div><table class="controls-table"><tbody>${[
    ["W / S \xB7 \u2191 / \u2193", "Climb / descend"],
    ["A / D \xB7 \u2190 / \u2192", "Bank and turn"],
    ["Q / E", "Fine yaw adjustment"],
    ["Shift", "Afterburner / boost"],
    ["Control, X or K", "Airbrake / high-G turn"],
    ["Space or right mouse button", "Missile-slot weapon / recon camera"],
    ["J or left mouse button", "Gun-slot weapon"],
    ["R", "Countermeasures / evasive roll"],
    ["Tab or T", "Cycle target"],
    ["C", "Chase / nose / rear camera"],
    ["M", "Tactical map"],
    ["Escape or P", "Pause / resume"],
    ["Mouse drag", "Steer while holding a mouse button"],
    ["Gamepad left stick or D-pad", "Steer; A missile; RT or X gun; B flare; Y target"],
    ["Gamepad shoulders", "LB / LT brake; RB boost; right-stick click camera; Back map; Start pause"],
    ["Menus", "Arrows, D-pad or stick to move; Enter, Space or A to select; Escape or B to go back"],
  ]
    .map(([o, e]) => `<tr><td>${o}</td><td>${e}</td></tr>`)
    .join(
      "",
    )}</tbody></table><h2 style="margin-top:30px">Three things that keep you flying.</h2><p><strong>Read the range.</strong> Center a hostile within weapon range and wait for LOCK. Missiles are most reliable from behind at a matching altitude, or head-on at close range.</p><p><strong>Manage your closure.</strong> Faster is not always better. Brake before a firing pass rather than overshooting. With assistance disabled, excessive braking can induce a stall.</p><p><strong>Respect protected targets.</strong> Blue contacts are allied or neutral. Protected transport losses fail their mission; civilian train-car damage reduces your rank.</p><p class="tiny-copy">Flight assist adds emergency ground pull-up and a wider weapon aiming cone. It does not fly missions for you. Disable it in Settings for stricter control.</p><button class="primary" data-action="briefing" data-id="1">FLY YOUR FIRST SORTIE ${ARROW}</button>`;
}
function creditsHtml() {
  return '<div class="credits-mark">NEON SKIES.</div><div class="kicker" style="color:var(--lime)">MACH & MISCHIEF / AN UNOFFICIAL FLIGHT EXPERIMENT</div><p>A complete browser campaign inspired by the international PlayStation release of Ace Combat 3: Electrosphere. All aircraft meshes, environmental geometry, interface art, sound effects, and music in this build are procedurally created originals.</p><h2 style="margin-top:30px">Flight record</h2><p>Campaign source and gameplay reference: <strong>Shotgunnova (P. Summers)</strong>, user-supplied normalized Markdown guide, October 19, 2009. Original source notes and author acknowledgments remain accessible in the Source & Continuity archive.</p><p>Ace Combat and the original fictional aircraft, mission, location and organization names belong to their respective rights holders. This is not an official release, commercial remaster, or endorsed product.</p><p>Rendering: <strong>Three.js 0.186.1</strong> (MIT) on the wall\u2019s shared 3D kit: WebGPURenderer with an automatic WebGL 2 fallback, Three Shading Language, node-based materials, neutral tone mapping, dynamic shadows and a TSL post-processing pipeline.</p><p>New radio dialogue, pilot progression, hull / engine / link upgrades, three side operations, countermeasure rolls, heat management, and service drills are original additions. The guide\u2019s original Japanese opening movie was not supplied and is not included.</p><div class="source-warning">HARDWARE NOTE / Galaxy S26-class phones and RTX 4070 Super-class desktops are design targets, not measured performance claims. Adaptive resolution reduces GPU cost on mobile. This build has not been benchmarked on those physical devices.</div><p class="tiny-copy">SAVE DATA / Stored locally in this browser. No account, telemetry, advertising, or server upload. Export a save in Settings before changing browser or clearing site storage.</p><button class="outline-btn" data-action="archive-tab" data-key="source">READ SOURCE & CONTINUITY NOTES \u2197</button>';
}
function showSettings() {
  let o = openPanel("settings"),
    e = pilot.data.settings,
    t = (i, n, r) =>
      `<div class="setting-row"><label for="setting-${i}">${n}<small>${r}</small></label><input id="setting-${i}" class="toggle" type="checkbox" data-setting="${i}" ${e[i] ? "checked" : ""}></div>`,
    s = (i, n, r, a, l, c) =>
      `<div class="setting-row"><label for="setting-${i}">${n}<small>${r}</small></label><input type="range" id="setting-${i}" data-setting="${i}" min="${a}" max="${l}" step="${c}" value="${e[i]}"></div>`;
  ((o += `<div class="panel-head"><div><div class="kicker">PILOT PREFERENCES</div><h1>Your flight. Your rules.</h1><p>Settings are stored on this device and apply immediately. Graphics quality, touch controls and vibration live in the shared graphics & controls panel.</p></div><span class="chip lime" style="margin-top:25px">${pilot.persistent ? "LOCAL SAVE ACTIVE" : "STORAGE UNAVAILABLE"}</span></div><div class="settings-grid"><div><div class="section-label">FLIGHT & ACCESSIBILITY</div>${t("assist", "Flight assist", "Emergency ground recovery and a wider aiming cone.")}${t("invert", "Invert pitch", "Reverse the vertical steering axis.")}${s("sensitivity", "Control sensitivity", "Adjust stick response.", 0.4, 2, 0.05)}${t("shake", "Camera effects", "Impact shake and high-speed visual feedback.")}<div class="section-label" style="margin-top:29px">DISPLAY & CONTROLS</div><div class="settings-actions"><button class="outline-btn" data-action="kit-settings">GRAPHICS & CONTROLS \u2197</button><button class="outline-btn" data-action="fullscreen">FULLSCREEN \u2197</button></div><p class="tiny-copy">ACTIVE RENDERER / ${view.name} / ${kit.tier.name.toUpperCase()} QUALITY<br>Quality, resolution, frame-rate cap, renderer, touch controls and vibration are shared by every 3D game on this device. F9 opens the panel at any time.</p></div><div><div class="section-label">AUDIO</div>${t("sound", "Audio enabled", "Original synthesized engine, combat and music audio.")}${s("volume", "Master volume", "Overall audio level.", 0, 1, 0.05)}${s("music", "Music volume", "Original procedural soundtrack.", 0, 1, 0.05)}${t("voice", "Spoken radio", "Uses the browser\u2019s installed speech voice.")}<div class="section-label" style="margin-top:30px">PILOT RECORD</div><div class="soft-card"><div class="kicker">CALLSIGN / PIXEL</div><h2 style="font-weight:400;letter-spacing:-1px">LEVEL ${pilot.level} <span style="font:11px var(--mono);color:var(--muted)">${pilot.data.xp.toLocaleString()} XP</span></h2><p class="tiny-copy">${MISSIONS.filter((i) => pilot.best(i.id)).length} MISSIONS CLEARED \xB7 ${AIRCRAFT.filter((i) => pilot.isPlaneUnlocked(i.id)).length} AIRFRAMES UNLOCKED<br>${pilot.data.credits.toLocaleString()} CREDITS \xB7 ${Math.floor(pilot.data.playTime / 60)} FLIGHT MINUTES</p><div class="settings-actions"><button class="outline-btn" data-action="export-save">EXPORT SAVE</button><button class="outline-btn" data-action="import-save">IMPORT SAVE</button></div><button class="secondary danger" data-action="reset-save" style="margin-top:15px">RESET PILOT RECORD</button></div><p class="tiny-copy">Saves never leave the browser unless you explicitly export them. Imported saves are validated before replacing your local record.</p></div></div>`),
    (byId("panel").innerHTML = o));
}
function launchMission() {
  let o = briefingId,
    e = MISSIONS.find((n) => n.id === o) || SIDE_OPS.find((n) => n.id === o);
  if (!pilot.canPlay(o)) return;
  let t = byId("loadout-gun")?.value || pilot.data.gun,
    s = byId("loadout-missile")?.value || pilot.data.missile,
    i = byId("difficulty-select")?.value || pilot.data.settings.difficulty;
  ((pilot.data.gun = t),
    (pilot.data.missile = s),
    (pilot.data.settings.difficulty = i),
    pilot.write(),
    holdUntilReleased());
  (engine.start(o, {
    plane: assignedPlane(o),
    gun: t,
    missile: s,
    difficulty: i,
    simOverride: byId("sim-override")?.value || null,
  }),
    (engine.cameraMode = 0),
    showScreen("game"),
    resetCamera(),
    (byId("hud-title").textContent = e.title.toUpperCase()),
    (byId("hud-location").textContent = `OP ${String(o).padStart(2, "0")} / ${e.location.toUpperCase()}`),
    (byId("hud-racks").innerHTML = engine.p.racks.map(() => '<i class="rack ready"></i>').join("")),
    updateTouchMode(),
    soundCall("unlock"));
}
function showResult(o) {
  showScreen("result");
  let e = engine.mission,
    t = engine.state === "won",
    s = e.id === 35 ? (pilot.bonusMission ? 36 : null) : e.id >= 36 ? null : e.id + 1,
    i = t && ((e.id === 35 && !pilot.bonusMission) || e.id === 36),
    n = { 4: "carrier", 11: "refuel", 12: "runway", 16: "reentry" },
    r = `<div class="result-card"><div class="result-top"><div><div class="kicker" style="color:${t ? "var(--lime)" : "var(--amber)"}">${t ? "OPERATION COMPLETE" : "LINK INTERRUPTED"} / ${String(e.id).padStart(2, "0")}</div><h1>${t ? (i ? "The sky remembers." : "Airspace reclaimed.") : "Another pass."}</h1><p class="tiny-copy">${e.title.toUpperCase()} / ${e.location.toUpperCase()}</p></div><div class="rank-medal" style="${t ? "" : "color:var(--amber);border-color:#ffb38577"}">${t ? o.rank : "\xD7"}</div></div>`;
  if (
    (t ||
      (r += `<div class="source-warning">${escapeHtml(o.reason)}<br>The sortie was not saved as a completion. Your previous best record is safe.</div>`),
    (r += `<div class="result-stats"><div><b>${formatClock(o.time)}</b><span>FLIGHT TIME</span></div><div><b>${String(o.kills).padStart(2, "0")}</b><span>CONFIRMED TARGETS</span></div><div><b>${t ? o.accuracy : 0}%</b><span>WEAPON ACCURACY</span></div><div><b>${t ? o.integrity : 0}%</b><span>AIRFRAME INTEGRITY</span></div></div>`),
    t)
  ) {
    r += `<div class="reward-row"><span>+${o.xp} EXPERIENCE</span><span>+${o.credits} CREDITS</span><span>${o.levelUp ? "LEVEL UP / " : ""}PILOT LEVEL ${pilot.level}</span></div>`;
    for (let a of o.newPlanes)
      r += `<div class="unlock-notice">NEW AIRFRAME UNLOCKED / <strong>${a.code} ${a.name}</strong></div>`;
    (e.id === 35 &&
      (r += `<div class="unlock-notice">${pilot.simulator ? "MISSION SIMULATOR ONLINE. Replay operations to improve your ranks. " : ""}${pilot.musicPlayer ? "MUSIC PLAYER UNLOCKED. " : ""}${pilot.osl ? "ORBITAL SATELLITE LASER & ALTERNATE INTRO UNLOCKED. " : ""}${pilot.bonusMission ? "GEOPELIA: BONUS OPERATION AVAILABLE." : "A/B ranks across all 35 operations unlock Geopelia."}</div>`),
      e.id === 36 &&
        (r +=
          '<div class="unlock-notice">The Geopelia swarm has been neutralized. Your complete flight record is preserved in the archive.</div>'),
      (r += `<p class="tiny-copy">${rankGoal(e)}${o.rank !== "A" ? " \xB7 Replay with a better airframe or a cleaner approach to improve your record." : ""}</p>`));
  }
  ((r += `<div class="result-actions">${t && s ? `<button class="primary" data-action="next" data-id="${s}">NEXT OPERATION ${ARROW}</button>` : t ? `<button class="primary" data-action="${i ? "ending" : "home"}">${i ? "CLOSE THE FLIGHT RECORD" : "RETURN TO BASE"} ${ARROW}</button>` : `<button class="primary" data-action="retry">RETRY SORTIE ${ARROW}</button>`}<button class="outline-btn" data-action="${t ? "retry" : "brief-again"}">${t ? "FLY AGAIN" : "CHANGE LOADOUT"}</button><button class="outline-btn" data-action="result-home">RETURN TO BASE</button></div>`),
    t &&
      n[e.id] &&
      (r += `<button class="secondary" data-action="service" data-key="${n[e.id]}" style="margin-top:14px">OPTIONAL ${e.id === 11 ? "MID-AIR REFUEL" : e.id === 16 ? "REENTRY" : "LANDING"} DRILL \u2197</button><p class="tiny-copy">Safe service autopilot is the default. Manual drills are optional and do not change your mission rank.</p>`),
    (r += "</div>"),
    (byId("result-overlay").innerHTML = r));
}
function pauseFlight() {
  (engine.state === "playing" && engine.pause(),
    engine.state === "paused" &&
      (showScreen("pause"),
      (byId("result-overlay").innerHTML =
        `<div class="pause-card"><div class="kicker">FLIGHT SYSTEMS / HOLD</div><h1>Take a breath.</h1><button class="primary" data-action="resume">RESUME FLIGHT ${ARROW}</button><button class="outline-btn" data-action="retry">RESTART OPERATION</button><button class="outline-btn" data-action="pause-controls">FLIGHT CONTROLS</button><button class="outline-btn" data-action="kit-settings">GRAPHICS & CONTROLS</button><button class="outline-btn" data-action="result-home">RETURN TO BASE</button><p class="tiny-copy">${engine.mission.title.toUpperCase()} / ${formatClock(engine.time)}<br>Mission time is stopped. Returning to base abandons this attempt but preserves previous records.</p></div>`)));
}
function resumeFlight() {
  (engine.resume(), engine.state === "playing" && (showScreen("game"), holdUntilReleased()));
}
function retryMission() {
  let o = engine.mission;
  if (!o) return;
  let e = {
    plane: engine.p.plane,
    gun: engine.p.gun,
    missile: engine.p.missile,
    difficulty: engine.difficulty,
    simOverride: engine.simOverride,
  };
  (engine.start(o.id, e),
    showScreen("game"),
    resetCamera(),
    (byId("hud-title").textContent = o.title.toUpperCase()),
    (byId("hud-location").textContent = `OP ${String(o.id).padStart(2, "0")} / ${o.location.toUpperCase()}`),
    (byId("hud-racks").innerHTML = engine.p.racks.map(() => '<i class="rack ready"></i>').join("")),
    holdUntilReleased());
}
/** HUD layout follows the kit's touch controls: they show on touch devices and hide once a keyboard or pad is used. */
var touchMode = !1;
function updateTouchMode() {
  ((touchMode = !!kit.touch?.visible), document.body.classList.toggle("touch-mode", touchMode));
  // In portrait the idle stick ring would sit on the AIRFRAME INTEGRITY bar; the stick still appears under the thumb.
  kit.touch?.setHint?.(innerWidth > innerHeight);
}
function toggleMap() {
  let o = byId("map-overlay");
  if (o.classList.contains("hidden")) {
    if (!["playing", "paused"].includes(engine.state)) return;
    ((mapPausedFlight = engine.state === "playing"),
      mapPausedFlight && engine.pause(),
      o.classList.remove("hidden"),
      showScreen("game"),
      o.classList.remove("hidden"),
      drawMap(byId("full-map"), null, !0));
  } else
    (o.classList.add("hidden"),
      syncTouchControls(),
      mapPausedFlight ? (engine.resume(), holdUntilReleased()) : pauseFlight());
}
function playIntro(o = !1) {
  (engine.initDemo(),
    (engine.p.plane = o ? pilot.data.selected : 19),
    showScreen("intro"),
    (introTime = 0),
    (introSlide = -1),
    (engine.introEnding = o),
    (byId("intro").innerHTML =
      '<div class="intro-text"><p id="intro-kicker"></p><h1 id="intro-line"></h1><p id="intro-sub"></p><button class="outline-btn" data-action="end-intro">SKIP / RETURN TO BASE \u2192</button></div>'));
}
var INTRO_SLIDES = [
    ["A WORLD CONNECTED", "Every city. Every aircraft. Every thought.", "THE ELECTROSPHERE REMEMBERS"],
    [
      "A SKY CONTESTED",
      "Somewhere between a pilot and a program, a choice survives.",
      "NEUWORK / GENERAL RESOURCES / OUROBOROS",
    ],
    ["ONE SIGNAL REMAINS", "Yours.", "NEON SKIES / MACH & MISCHIEF"],
  ],
  ENDING_SLIDES = [
    [
      "THE FLIGHT RECORD IS COMPLETE",
      "The corporations kept their secrets. The sky kept your signal.",
      "36 OPERATIONS / ONE PILOT",
    ],
    [
      "ORIGINAL FIELD RECORD",
      "With thanks to Shotgunnova, and to every pilot who found a way through.",
      "CAMPAIGN REFERENCE / OCTOBER 2009",
    ],
    ["NEON SKIES", "Mach & Mischief", "YOUR RECORD IS SAVED. THE SKY IS STILL OPEN."],
  ];
function drawMap(o, e = null, t = !1) {
  if (!o) return;
  let s = o.getBoundingClientRect(),
    i = Math.max(300, s.width),
    n = Math.max(200, s.height),
    r = Math.min(devicePixelRatio, 2);
  ((o.width = i * r), (o.height = n * r));
  let a = o.getContext("2d");
  (a.scale(r, r), (a.fillStyle = "#0b2229"), a.fillRect(0, 0, i, n));
  let l = e ? buildWorld(e.environment, e.id * 189) : engine.world,
    c = l.environment,
    u = Math.min(i, n) / 17e3,
    h = i * 0.5,
    d = n * 0.55,
    p = (g) => ({ x: h + g.x * u, y: d + g.z * u });
  ((a.strokeStyle = "#91c8b116"), (a.lineWidth = 1));
  for (let g = 0; g < i; g += i / 12) (a.beginPath(), a.moveTo(g, 0), a.lineTo(g, n), a.stroke());
  for (let g = 0; g < n; g += n / 10) (a.beginPath(), a.moveTo(0, g), a.lineTo(i, g), a.stroke());
  if (["city", "harbor", "geofront", "ocean"].includes(c))
    for (let g of l.buildings) {
      let x = p(g);
      ((a.fillStyle = "#95c6ac28"),
        a.fillRect(x.x - (g.w * u) / 2, x.y - (g.d * u) / 2, Math.max(1, g.w * u), Math.max(1, g.d * u)));
    }
  else if (!["space", "cyber", "tunnel"].includes(c))
    for (let g = 100; g < 900; g += 140) {
      ((a.strokeStyle = "#8abc9e26"), a.beginPath());
      for (let x = 0; x <= i; x += 4) {
        let b =
          n * 0.5 +
          Math.sin((x / i) * 7 + g) * n * 0.2 +
          Math.cos((x / i) * 15 + g * 0.3) * n * 0.08 +
          (g - 450) * 0.16;
        x === 0 ? a.moveTo(x, b) : a.lineTo(x, b);
      }
      a.stroke();
    }
  let f = e
    ? Array.from({ length: Math.min(8, e.roster?.find((g) => g.count > 2)?.count || 4) }, (g, x) =>
        vec(Math.sin(x * 2.39) * 2e3, 0, -1800 - Math.cos(x * 2.39) * 2e3),
      )
    : engine.entities.filter((g) => g.alive && (t || g.required));
  (a.setLineDash([4, 5]), (a.strokeStyle = "#b9e6b18a"), a.beginPath());
  let m = p(e ? vec(0, 0, 2100) : engine.p.pos);
  a.moveTo(m.x, m.y);
  for (let g of f.slice(0, 5)) {
    let x = p(g.pos || g);
    a.lineTo(x.x, x.y);
  }
  if (
    (a.stroke(),
    a.setLineDash([]),
    f.forEach((g, x) => {
      let b = p(g.pos || g);
      ((a.strokeStyle = g.neutral || g.ally ? "#8cc9e5" : "#c7f494"),
        (a.lineWidth = 1),
        a.strokeRect(b.x - 4, b.y - 4, 8, 8),
        (e || g.required) &&
          ((a.fillStyle = "#c1dcc1"),
          (a.font = "7px monospace"),
          a.fillText(e ? "TGT " + String(x + 1).padStart(2, "0") : g.name, b.x + 9, b.y + 3)));
    }),
    (a.fillStyle = "#ecf9dd"),
    a.beginPath(),
    a.moveTo(m.x, m.y - 7),
    a.lineTo(m.x + 5, m.y + 6),
    a.lineTo(m.x, m.y + 3),
    a.lineTo(m.x - 5, m.y + 6),
    a.closePath(),
    a.fill(),
    (a.fillStyle = "#bad9be"),
    (a.font = "8px monospace"),
    a.fillText("ENTRY / PIXEL", m.x + 10, m.y + 3),
    (a.strokeStyle = "#92beaa8a"),
    a.beginPath(),
    a.moveTo(i - 28, 54),
    a.lineTo(i - 28, 29),
    a.lineTo(i - 32, 37),
    a.moveTo(i - 28, 29),
    a.lineTo(i - 24, 37),
    a.stroke(),
    a.fillText("N", i - 31, 23),
    t)
  ) {
    let g = engine.nextGate();
    if (g) {
      let x = p(vec(-g.width / 2 + (g.width / g.lanes) * (g.open + 0.5), 0, g.z));
      ((a.fillStyle = "#c4f58b"), a.fillRect(x.x - 5, x.y - 5, 10, 10));
    }
  }
}
/* The HUD and radar canvases never change; their 2D contexts are looked up once. */
var hudCtx = null,
  radarCtx = null;
function drawRadar() {
  let o = byId("radar"),
    e = (radarCtx ||= o.getContext("2d")),
    t = 340,
    s = 340,
    i = t / 2,
    n = s / 2,
    r = 141,
    a = r / 5500,
    l = engine.p;
  (e.setTransform(1, 0, 0, 1, 0, 0),
    (e.fillStyle = "#061b21"),
    e.fillRect(0, 0, t, s),
    (e.strokeStyle = "#7eae9738"),
    (e.lineWidth = 1));
  for (let h = 1; h <= 3; h++) (e.beginPath(), e.arc(i, n, (r * h) / 3, 0, Math.PI * 2), e.stroke());
  (e.beginPath(),
    e.moveTo(i, n - r),
    e.lineTo(i, n + r),
    e.moveTo(i - r, n),
    e.lineTo(i + r, n),
    e.stroke(),
    e.save(),
    e.translate(i, n),
    e.rotate(engine.time * 0.5));
  let c = e.createLinearGradient(0, 0, r, 0);
  (c.addColorStop(0, "#a1d9a322"),
    c.addColorStop(1, "#a1d9a300"),
    (e.fillStyle = c),
    e.beginPath(),
    e.moveTo(0, 0),
    e.arc(0, 0, r, -0.25, 0),
    e.closePath(),
    e.fill(),
    e.restore());
  let u = (h) => {
    let d = h.x - l.pos.x,
      p = h.z - l.pos.z;
    return {
      x: i + (d * Math.cos(l.yaw) + p * Math.sin(l.yaw)) * a,
      y: n + (-d * Math.sin(l.yaw) + p * Math.cos(l.yaw)) * a,
    };
  };
  e.fillStyle = "#66917f20";
  for (let h of engine.world.buildings) {
    let d = u(h);
    Math.hypot(d.x - i, d.y - n) < r && e.fillRect(d.x - 1, d.y - 1, 3, 3);
  }
  for (let h of engine.entities) {
    if (!h.alive || h.parent) continue;
    let d = u(h.pos);
    Math.hypot(d.x - i, d.y - n) > r ||
      ((e.strokeStyle =
        h.ally || h.neutral ? "#8fc6d9" : h.id === engine.targetId ? "#c4f58b" : h.required ? "#e6b28f" : "#80b497"),
      (e.fillStyle = e.strokeStyle),
      (e.lineWidth = 1.5),
      h.required || h.id === engine.targetId
        ? e.strokeRect(d.x - 4, d.y - 4, 8, 8)
        : e.fillRect(d.x - 2, d.y - 2, 4, 4));
  }
  if (engine.mission?.id === 31) {
    let h = engine.nextGate();
    if (h) {
      let d = u(vec(-h.width / 2 + (h.width / h.lanes) * (h.open + 0.5), 0, h.z));
      ((e.strokeStyle = "#c4f58b"), e.strokeRect(d.x - 5, d.y - 5, 10, 10));
    }
  }
  ((e.fillStyle = "#e6f2ce"),
    e.beginPath(),
    e.moveTo(i, n - 8),
    e.lineTo(i - 6, n + 6),
    e.lineTo(i, n + 3),
    e.lineTo(i + 6, n + 6),
    e.closePath(),
    e.fill(),
    (e.fillStyle = "#aec8b0"),
    (e.font = "13px monospace"),
    e.fillText("N", i + Math.sin(-l.yaw) * 154 - 4, n - Math.cos(l.yaw) * 154 + 4));
}
var hudWidth = 0,
  hudHeight = 0,
  hudRatio = 1;
function resizeHud() {
  let o = byId("hud-canvas");
  ((hudWidth = innerWidth),
    (hudHeight = innerHeight),
    (hudRatio = Math.min(devicePixelRatio, 2)),
    (o.width = hudWidth * hudRatio),
    (o.height = hudHeight * hudRatio));
}
function drawHud() {
  let o = (hudCtx ||= byId("hud-canvas").getContext("2d")),
    e = hudWidth,
    t = hudHeight;
  if (
    (o.setTransform(hudRatio, 0, 0, hudRatio, 0, 0),
    o.clearRect(0, 0, e, t),
    !["game", "pause", "service"].includes(currentScreen))
  )
    return;
  let s = engine.p,
    i = e < 700,
    n = t < 590;
  ((o.lineWidth = 1), (o.font = `${i ? 8 : 10}px monospace`), (o.textAlign = "center"));
  let r = view.project(vadd(s.pos, vscale(heading(s.yaw, s.pitch), 2200))),
    a = { x: clamp(r.x, e * 0.3, e * 0.7), y: clamp(r.y, t * 0.26, t * 0.7) };
  ((o.strokeStyle = "#c6eed393"),
    o.beginPath(),
    o.arc(a.x, a.y, i ? 10 : 13, 0, Math.PI * 2),
    o.moveTo(a.x - 23, a.y),
    o.lineTo(a.x - 8, a.y),
    o.moveTo(a.x + 8, a.y),
    o.lineTo(a.x + 23, a.y),
    o.moveTo(a.x, a.y - 23),
    o.lineTo(a.x, a.y - 10),
    o.stroke(),
    (o.fillStyle = "#e3f7d6"),
    o.fillRect(a.x - 1, a.y - 1, 2, 2));
  let l = s.roll * 0.5;
  (o.save(),
    o.translate(a.x, a.y + 38),
    o.rotate(l),
    (o.strokeStyle = "#badbc14d"),
    o.beginPath(),
    o.moveTo(-55, 0),
    o.lineTo(-22, 0),
    o.lineTo(-22, 4),
    o.moveTo(55, 0),
    o.lineTo(22, 0),
    o.lineTo(22, 4),
    o.stroke(),
    o.restore(),
    engine.cameraMode === 1 &&
      ((o.strokeStyle = "#a1d5c14d"),
      (o.lineWidth = 2),
      o.beginPath(),
      o.moveTo(e * 0.1, t),
      o.lineTo(e * 0.27, t * 0.7),
      o.lineTo(e * 0.36, t * 0.62),
      o.moveTo(e * 0.9, t),
      o.lineTo(e * 0.73, t * 0.7),
      o.lineTo(e * 0.64, t * 0.62),
      o.stroke()));
  let c = i ? 92 : touchMode ? 73 : 29,
    u = i ? e * 0.58 : e * 0.5,
    h = i ? 75 : 150,
    d = ((s.yaw * 180) / Math.PI + 3600) % 360;
  ((o.strokeStyle = "#c2e3c55e"), (o.fillStyle = "#c6dfc3"));
  for (let _ = -60; _ <= 60; _ += 10) {
    let T = Math.round(d / 10) * 10 + _,
      w = u + ((T - d) * h) / 60;
    if (
      !(w < u - h || w > u + h) &&
      (o.beginPath(), o.moveTo(w, c + 9), o.lineTo(w, c + (T % 30 === 0 ? 16 : 13)), o.stroke(), T % 30 === 0)
    ) {
      let v = (T + 3600) % 360,
        S = { 0: "N", 90: "E", 180: "S", 270: "W" }[v] ?? v.toString().padStart(3, "0");
      ((o.font = `${i ? 7 : 9}px monospace`), o.fillText(S, w, c + 2));
    }
  }
  ((o.strokeStyle = "#c4f58b"),
    o.beginPath(),
    o.moveTo(u - 4, c + 23),
    o.lineTo(u, c + 17),
    o.lineTo(u + 4, c + 23),
    o.stroke());
  let p = a.y,
    f = i ? e * 0.34 : e * 0.24,
    m = Math.round(s.speed * 5.2),
    g = Math.round(s.pos.y * 3.28084);
  for (let [_, T, w, v] of [
    [a.x - f, m, "SPEED", "MPH"],
    [a.x + f, g, "ALT", "FT"],
  ]) {
    ((o.strokeStyle = "#b3ddbd5b"),
      (o.fillStyle = "#d6eacb"),
      (o.font = `${i ? 7 : 9}px monospace`),
      o.fillText(w, _, p - 56),
      (o.font = `${i ? 14 : 19}px monospace`),
      o.fillText(T.toLocaleString(), _, p + 5),
      (o.font = `${i ? 6 : 8}px monospace`),
      o.fillText(v, _, p + 21));
    for (let S = -3; S <= 3; S++)
      Math.abs(S) < 1 || (o.beginPath(), o.moveTo(_ - 11, p + S * 13), o.lineTo(_ + 11, p + S * 13), o.stroke());
  }
  let x = engine.entities
    .filter(
      (_) =>
        (_.alive && (!_.invulnerable || _.role === "leader") && _.name !== "Timer" && !_.parent) ||
        (_.alive && _.role === "carrierNode") ||
        (_.alive && _.name === "Timer"),
    )
    .sort((_, T) =>
      _.id === engine.targetId ? -1 : T.id === engine.targetId ? 1 : vdist(_.pos, s.pos) - vdist(T.pos, s.pos),
    )
    .slice(0, i ? 15 : 28);
  for (let _ of x) {
    let T = view.project(_.pos);
    if (!T.visible || T.depth > 12e3 || T.x < 24 || T.x > e - 24 || T.y < 90 || T.y > t - 75) continue;
    let w = _.id === engine.targetId,
      v = _.neutral || _.ally ? "#97d3ec" : w && engine.lock >= 1 ? "#ceff99" : _.required ? "#ddf6ba" : "#88c5af";
    ((o.strokeStyle = v), (o.fillStyle = v), (o.lineWidth = w ? 1.6 : 1));
    let S = w ? (i ? 19 : 25) : i ? 11 : 15,
      A = w ? 8 : 4;
    o.beginPath();
    for (let [M, N] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      (o.moveTo(T.x + M * S, T.y + N * (S - A)),
        o.lineTo(T.x + M * S, T.y + N * S),
        o.lineTo(T.x + M * (S - A), T.y + N * S));
    if (
      (o.stroke(),
      (o.font = `${i ? 7 : 9}px monospace`),
      (o.textAlign = "left"),
      (_.required || w || _.ally || _.neutral) &&
        (o.fillText(_.neutral || _.ally ? "FRIENDLY" : _.required ? "TGT" : "HOSTILE", T.x + S + 6, T.y - S + 4),
        o.fillText(_.name, T.x + S + 6, T.y - S + 16)),
      w)
    ) {
      (o.fillText((vdist(_.pos, s.pos) / 1e3).toFixed(2) + " KM", T.x + S + 6, T.y + S - 2),
        (o.textAlign = "center"),
        (o.font = `${i ? 8 : 10}px monospace`));
      let M = _.photo
        ? "CAMERA"
        : _.gunOnly
          ? "GUNS ONLY"
          : engine.lock >= 1
            ? "LOCK"
            : engine.lock > 0
              ? "ACQUIRING"
              : "";
      (M && o.fillText(M, T.x, T.y - S - 12),
        engine.lock > 0 &&
          !_.gunOnly &&
          (o.beginPath(), o.arc(T.x, T.y, S + 7, -Math.PI / 2, -Math.PI / 2 + engine.lock * Math.PI * 2), o.stroke()));
      let N = clamp(_.hp / _.maxHp, 0, 1);
      ((o.fillStyle = "#76ac9333"),
        o.fillRect(T.x - S, T.y + S + 9, S * 2, 2),
        (o.fillStyle = v),
        o.fillRect(T.x - S, T.y + S + 9, S * 2 * N, 2));
    }
  }
  o.textAlign = "center";
  let b = engine.target;
  if (b) {
    let _ = view.project(b.pos);
    if (!_.visible || _.x < 30 || _.x > e - 30 || _.y < 90 || _.y > t - 75) {
      let T = _.x - e / 2,
        w = _.y - t / 2;
      Math.abs(T) + Math.abs(w) < 0.1 && (w = 1);
      let v = Math.atan2(w, T),
        S = Math.min(e * 0.36, 300),
        A = Math.min(t * 0.25, 190),
        M = e / 2 + Math.cos(v) * S,
        N = t / 2 + Math.sin(v) * A;
      (o.save(),
        o.translate(M, N),
        o.rotate(v),
        (o.strokeStyle = "#d1ecb9"),
        o.beginPath(),
        o.moveTo(-6, -7),
        o.lineTo(5, 0),
        o.lineTo(-6, 7),
        o.stroke(),
        o.restore(),
        (o.fillStyle = "#bcd6b2"),
        (o.font = `${i ? 7 : 9}px monospace`),
        o.fillText(_.visible ? "TARGET" : "BEHIND", M, N + 21));
    }
  }
  if (["Spread Bomb", "Anti-Nanobite Bomb"].includes(s.missile)) {
    let _ = Math.max(0, s.pos.y - engine.world.heightAt(s.pos.x, s.pos.z)),
      T = s.vel.y - 80,
      w = (T + Math.sqrt(T * T + 300 * _)) / 150,
      v = vadd(s.pos, vscale(s.vel, w));
    v.y = engine.world.heightAt(v.x, v.z) + 8;
    let S = view.project(v);
    S.visible &&
      S.x > 0 &&
      S.x < e &&
      S.y > 0 &&
      S.y < t &&
      ((o.strokeStyle = "#b9ffce"),
      o.setLineDash([5, 4]),
      o.beginPath(),
      o.ellipse(S.x, S.y, 30, 12, 0, 0, Math.PI * 2),
      o.stroke(),
      o.setLineDash([]),
      (o.font = "8px monospace"),
      (o.fillStyle = "#ceecd0"),
      o.fillText("BOMB IMPACT", S.x, S.y + 28));
  }
  if (engine.mission?.id === 31) {
    let _ = engine.nextGate();
    if (_) {
      let T = -_.width / 2 + (_.width / _.lanes) * (_.open + 0.5),
        w = view.project(vec(T, 330, _.z));
      w.visible &&
        ((o.strokeStyle = "#c4f58b"),
        (o.lineWidth = 2),
        o.beginPath(),
        o.arc(w.x, w.y, 27, 0, Math.PI * 2),
        o.stroke(),
        (o.fillStyle = "#dff6c6"),
        (o.font = "9px monospace"),
        o.fillText("OPEN LANE", w.x, w.y - 38));
    }
  }
  engine.mission?.id === 3 &&
    engine.phase === 0 &&
    ((o.fillStyle = engine.formation > 0.75 ? "#d5f8b6" : "#ffbb87"),
    (o.font = "11px monospace"),
    o.fillText(engine.formation > 0.75 ? "PURSUE / IN FORMATION" : "CLOSE FORMATION", e / 2, t * 0.7));
}
/* HUD DOM writes go through a small cache so an unchanged value never touches the DOM. */
var hudCache = new Map();
function setText(o, e) {
  let t = o + ":text";
  hudCache.get(t) !== e && (hudCache.set(t, e), (byId(o).textContent = e));
}
function setStyle(o, e, t) {
  let s = o + ":" + e;
  hudCache.get(s) !== t && (hudCache.set(s, t), (byId(o).style[e] = t));
}
function setClass(o, e, t) {
  let s = o + "." + e;
  hudCache.get(s) !== t && (hudCache.set(s, t), byId(o).classList.toggle(e, t));
}
function updateInstruments() {
  if (!["game", "pause", "service"].includes(currentScreen)) return;
  let o = engine.p,
    e = engine.mission;
  (setText("hud-objective", engine.objectiveProgress),
    setText("hud-ammo", o.ammo.toString().padStart(2, "0")),
    setText(
      "hud-weapon",
      (WEAPONS[o.missile]?.name || o.missile)
        .toUpperCase()
        .replace("SHORT-RANGE", "SR")
        .replace("ANTI-NANOBITE", "A-N"),
    ),
    setText("hud-gun", WEAPONS[o.gun].name.toUpperCase()),
    setStyle("gun-heat", "width", Math.round(engine.heat * 100) + "%"),
    setStyle("gun-heat", "background", engine.overheated ? "var(--amber)" : "var(--cyan)"),
    setText("heat-label", engine.overheated ? "COOLING" : "GUN READY"));
  let t = clamp(o.hp / o.maxHp, 0, 1);
  (setStyle("hp-fill", "width", Math.round(t * 100) + "%"),
    setStyle("hp-fill", "background", t < 0.3 ? "var(--amber)" : "var(--lime)"),
    setText("hp-value", Math.round(t * 100) + "%"),
    setText(
      "flare-count",
      engine.flareCooldown > 0 ? Math.ceil(engine.flareCooldown) + " S" : o.flares.toString().padStart(2, "0"),
    ),
    byId("hud-racks").children.length !== o.racks.length &&
      (byId("hud-racks").innerHTML = o.racks.map(() => '<i class="rack"></i>').join("")),
    [...byId("hud-racks").children].forEach((r, a) => r.classList.toggle("ready", o.racks[a] <= 0)),
    e.id === 22
      ? (setText(
          "hud-clock",
          (engine.jammerActive ? "JAM ACTIVE / " : "CLIMB / ") +
            formatClock(engine.jammerActive ? 90 - (engine.time % 105) : 105 - (engine.time % 105)),
        ),
        setStyle("hud-clock", "color", engine.jammerActive ? "var(--lime)" : "var(--amber)"))
      : (setText(
          "hud-clock",
          engine.remaining !== null ? "T\u2212 " + formatClock(engine.remaining) : formatClock(engine.time),
        ),
        setStyle(
          "hud-clock",
          "color",
          engine.remaining !== null && engine.remaining < 30 ? "var(--amber)" : "#dcedd3",
        )));
  let s = performance.now() < warningUntil ? warningText : "",
    i = engine.projectiles.filter((r) => r.target === "player");
  (i.length && (s = "MISSILE / " + Math.round(Math.min(...i.map((r) => vdist(r.pos, o.pos)))) + " M"),
    engine.groundWarning && (s = o.pos.y > engine.world.ceiling - 150 ? "CEILING / DESCEND" : "PULL UP"),
    o.speed < 112 && (s = "STALL / ACCELERATE"),
    engine.outTime > 0 && (s = "RETURN TO AREA / " + Math.ceil(12 - engine.outTime) + " S"),
    e.id === 27 && !engine.clearance && (s = s || "RADAR CEILING 1,300 FT"));
  let n = !!i.length || engine.groundWarning || engine.outTime > 0;
  (setText("warning", s), setClass("warning", "hidden", !s), setClass("warning", "urgent", n));
  let r = e.id === 18 && engine.entities.some((a) => a.alive && a.name === "Nanobite" && vdist(a.pos, o.pos) < 650);
  (setStyle("virus", "opacity", r ? "0.65" : "0"), drawRadar());
}
function handleEvents() {
  for (let o of engine.drain())
    (soundCall("event", o.type, o),
      o.type === "radio" &&
        ((byId("radio-speaker").textContent = o.speaker),
        (byId("radio-avatar").textContent = o.speaker.includes("PIXEL") ? "PX" : "MC"),
        (byId("radio-message").textContent = o.text),
        byId("radio").classList.add("active"),
        (radioUntil = performance.now() + 9e3)),
      o.type === "banner" &&
        ((byId("banner-title").textContent = o.title),
        (byId("banner-subtitle").textContent = o.subtitle),
        byId("mission-banner").classList.add("active"),
        (bannerUntil = performance.now() + 3400)),
      o.type === "warning" && ((warningText = o.text), (warningUntil = performance.now() + 2200)),
      o.type === "damage" &&
        ((byId("hit-flash").style.opacity = 1),
        setTimeout(() => (byId("hit-flash").style.opacity = 0), 160),
        kit.input.rumble(0.7, 160)),
      o.type === "flare" && kit.input.rumble(0.3, 70),
      o.type === "explosion" && o.distance < 900 && kit.input.rumble(0.25, 90),
      o.type === "photo" &&
        ((byId("hit-flash").style.background = "rgba(221,255,235,.3)"),
        (byId("hit-flash").style.opacity = 1),
        setTimeout(() => {
          ((byId("hit-flash").style.opacity = 0), (byId("hit-flash").style.background = ""));
        }, 120)),
      (o.type === "complete" || o.type === "failed") && showResult(o),
      o.type === "pause" &&
        currentScreen === "game" &&
        byId("map-overlay").classList.contains("hidden") &&
        pauseFlight());
}
/* ---------------------------------------------------------------- input (kit.input actions) */

/** Buttons still held from a menu (A / Space confirm) must not fire a missile the moment flight starts. */
function holdUntilReleased() {
  for (let o of ["missile", "gun", "boost", "brake"]) (heldAfterMenu.add(o), (engine.input[o] = !1));
}
function held(o) {
  if (!kit.input.down(o)) return (heldAfterMenu.delete(o), !1);
  return !heldAfterMenu.has(o);
}
/** Mouse drag steering: the offset from where the button went down, 140 px for full deflection. */
var MOUSE_STEER_PX = 140 * 0.0024;
function readInput() {
  let o = kit.input,
    e = ["playing", "service"].includes(engine.state),
    t = o.look("steer");
  e && o.pointer.type === "mouse" && o.mouseButtons.size
    ? ((mouseSteer.x = clamp(mouseSteer.x + t.x / MOUSE_STEER_PX, -1, 1)),
      (mouseSteer.y = clamp(mouseSteer.y - t.y / MOUSE_STEER_PX, -1, 1)))
    : (mouseSteer.x = mouseSteer.y = 0);
  let s = o.vector("fly");
  if (
    ((engine.input = {
      x: clamp(s.x + o.value("trim") * 0.35 + mouseSteer.x, -1, 1),
      y: clamp(s.y + mouseSteer.y, -1, 1),
      boost: held("boost"),
      brake: held("brake"),
      gun: held("gun"),
      missile: held("missile"),
    }),
    inputSettle > 0)
  )
    return;
  if (o.pressed("pause")) return onPauseAction();
  e &&
    (o.pressed("target") && engine.chooseTarget(!0),
    o.pressed("flare") && engine.flare(),
    o.pressed("camera") && cycleCamera(),
    o.pressed("map") && toggleMap());
}
function cycleCamera() {
  ((engine.cameraMode = (engine.cameraMode + 1) % 3),
    toast(["CHASE CAMERA", "NOSE CAMERA", "REAR CAMERA"][engine.cameraMode], 1300));
}
/** Escape / P / Start / the II pill: pause and resume in flight, close the map, or step back to base. */
function onPauseAction() {
  if (service) return endService();
  if (!byId("map-overlay").classList.contains("hidden")) return toggleMap();
  engine.state === "playing"
    ? pauseFlight()
    : engine.state === "paused"
      ? resumeFlight()
      : currentScreen !== "home" && goHome();
}

/* ---------------------------------------------------------------- menus with a gamepad or the keyboard */

var FOCUSABLE = "button, select, input:not([type=file]), summary";
/** The layer the player is looking at: map, pause/result card, intro, or the panels under the top bar. */
function menuLayers() {
  if (!byId("map-overlay").classList.contains("hidden")) return [byId("map-overlay")];
  if (["result", "pause"].includes(currentScreen)) return [byId("result-overlay")];
  if (currentScreen === "intro") return [byId("intro")];
  if (currentScreen === "home") return [byId("topbar"), byId("home")];
  if (["game", "service"].includes(currentScreen)) return [];
  return [byId("topbar"), byId("panel")];
}
function menuTargets() {
  let o = [];
  for (let e of menuLayers())
    for (let t of e.querySelectorAll(FOCUSABLE))
      !t.disabled && t.getClientRects().length && !t.closest(".hidden,[hidden]") && o.push(t);
  return o;
}
function focusMenuItem(o) {
  if (!o) return;
  (document.querySelector(".pad-focus")?.classList.remove("pad-focus"),
    o.classList.add("pad-focus"),
    o.focus({ preventScroll: !0 }),
    o.scrollIntoView({ block: "nearest", inline: "nearest" }));
}
/** Spatial focus move: the nearest control in the pushed direction, favouring ones in line with the current one. */
function moveMenuFocus(o, e) {
  let t = menuTargets();
  if (!t.length) return;
  let s = document.activeElement;
  if (!t.includes(s)) return focusMenuItem(t.find((c) => c.classList.contains("primary")) || t[0]);
  let i = s.getBoundingClientRect(),
    n = i.left + i.width / 2,
    r = i.top + i.height / 2,
    a = null,
    l = 1 / 0;
  for (let c of t) {
    if (c === s) continue;
    let u = c.getBoundingClientRect(),
      h = u.left + u.width / 2 - n,
      d = u.top + u.height / 2 - r,
      p = o * h + e * d;
    if (p <= 4) continue;
    let f = p + Math.abs(o ? d : h) * 2.2;
    f < l && ((l = f), (a = c));
  }
  a && focusMenuItem(a);
}
/** Left / right on a select or slider changes its value, like a console menu. */
function stepMenuValue(o, e) {
  if (o.tagName === "SELECT") {
    let t = clamp(o.selectedIndex + e, 0, o.options.length - 1);
    return (
      t !== o.selectedIndex && ((o.selectedIndex = t), o.dispatchEvent(new Event("change", { bubbles: !0 }))),
      !0
    );
  }
  return o.type === "range"
    ? (e > 0 ? o.stepUp() : o.stepDown(), o.dispatchEvent(new Event("input", { bubbles: !0 })), !0)
    : !1;
}
function menuBack() {
  if (!byId("map-overlay").classList.contains("hidden")) return toggleMap();
  if (currentScreen === "pause") return resumeFlight();
  if (currentScreen === "intro") return goHome();
  if (["result", "home"].includes(currentScreen)) return;
  let o = byId("panel").querySelector(".back-btn");
  o ? o.click() : goHome();
}
function updateMenus(o) {
  let e = kit.input;
  if (!menuLayers().length || inputSettle > 0) return;
  // a menu press must not also count as a flight action this frame (B is also FLARE, A also MISSILE)
  if (e.pressed("back")) return ((inputSettle = 1), menuBack());
  let t = e.vector("nav"),
    s = Math.abs(t.x) > 0.55 ? Math.sign(t.x) : 0,
    i = s ? 0 : Math.abs(t.y) > 0.55 ? -Math.sign(t.y) : 0;
  let n = menuRepeat < 0;
  if (!s && !i) menuRepeat = -1;
  else if (n || (menuRepeat -= o) <= 0) {
    menuRepeat = n ? 0.38 : 0.14;
    let n2 = document.activeElement;
    (s && menuTargets().includes(n2) && stepMenuValue(n2, s)) || moveMenuFocus(s, i);
  }
  if (e.pressed("confirm")) {
    inputSettle = 1;
    let n = document.activeElement;
    if (!menuTargets().includes(n)) return moveMenuFocus(0, 1);
    n.tagName === "SELECT"
      ? ((n.selectedIndex = (n.selectedIndex + 1) % n.options.length),
        n.dispatchEvent(new Event("change", { bubbles: !0 })))
      : n.type === "range" || n.click();
  }
}
addEventListener("pointerdown", () => document.querySelector(".pad-focus")?.classList.remove("pad-focus"), !0);

function resetCamera() {
  view.cameraRig.initial = !0;
}
function exportSave() {
  let o = new Blob([JSON.stringify(pilot.data, null, 2)], { type: "application/json" }),
    e = document.createElement("a");
  ((e.href = URL.createObjectURL(o)),
    (e.download = "neon-skies-pilot-save.json"),
    e.click(),
    setTimeout(() => URL.revokeObjectURL(e.href), 2e3),
    toast("Pilot record exported."));
}
function applySetting(o) {
  let e = o.dataset.setting;
  e &&
    ((pilot.data.settings[e] = o.type === "checkbox" ? o.checked : o.type === "range" ? Number(o.value) : o.value),
    pilot.write(),
    soundCall("apply"),
    updateTouchMode(),
    e === "sound" && refreshHome());
}
var service = null;
function beginService(o) {
  service = {
    kind: o,
    elapsed: 0,
    score: 0,
    drift: 0,
    saved: {
      p: engine.p,
      world: engine.world,
      entities: engine.entities,
      mission: engine.mission,
      result: engine.result,
      state: engine.state,
    },
  };
  let e = o === "carrier" ? "ocean" : o === "runway" ? "snow" : o === "reentry" ? "strato" : "ocean";
  ((engine.world = buildWorld(e, 543)),
    (engine.world.buildings = []),
    (engine.entities = []),
    (engine.projectiles = []),
    (engine.effects = []),
    (engine.p = {
      ...engine.p,
      pos: vec(0, o === "carrier" || o === "runway" ? 450 : 1600, 1700),
      vel: vec(0, 0, -250),
      yaw: 0,
      pitch: 0,
      roll: 0,
      speed: 250,
    }),
    engine.worldVersion++,
    (engine.state = "service"),
    (engine.cameraMode = 0),
    showScreen("service"),
    (byId("hud-title").textContent =
      o === "refuel"
        ? "MID-AIR REFUEL"
        : o === "reentry"
          ? "ATMOSPHERIC REENTRY"
          : o === "carrier"
            ? "CARRIER APPROACH"
            : "RUNWAY APPROACH"),
    (byId("hud-location").textContent = "OPTIONAL SERVICE / FOLLOW THE APPROACH DIRECTOR"),
    (byId("radio-speaker").textContent = "SERVICE / MICA"),
    (byId("radio-message").textContent =
      "Keep the flight director centered. Small stick corrections. Press Escape or the pause button for safe autopilot."),
    byId("radio").classList.add("active"),
    (radioUntil = performance.now() + 16e3),
    (engine.p.racks = engine.p.racks.map(() => 0)));
}
function updateService(o) {
  let e = service,
    t = engine.p;
  e.elapsed += o;
  let s = engine.input.x,
    i = engine.input.y;
  ((t.yaw += s * 0.45 * o),
    (t.pitch = clamp(t.pitch + i * 0.35 * o, -0.65, 0.65)),
    (t.roll = -s * 0.6),
    (t.speed = engine.input.brake ? 185 : engine.input.boost ? 380 : 250),
    (t.pos = vadd(t.pos, vscale(heading(t.yaw, t.pitch), t.speed * o))));
  let n = Math.sin(e.elapsed * 0.16) * 0.12,
    r = e.kind === "reentry" ? -0.14 : e.kind === "refuel" ? Math.sin(e.elapsed * 0.25) * 0.04 : -0.07;
  ((e.drift = Math.abs(angleDiff(t.yaw, n)) + Math.abs(t.pitch - r)),
    e.drift < 0.18 && (e.score += o),
    (engine.demoTime += o),
    setText("hud-objective", `FLIGHT DIRECTOR / ${Math.floor((e.score / 18) * 100)}% STABLE`),
    setText("hud-clock", formatClock(22 - e.elapsed)),
    setText("hud-ammo", "\u2014"),
    setClass("warning", "hidden", !1),
    setText(
      "warning",
      e.drift < 0.18
        ? "APPROACH STABLE"
        : t.pitch > r + 0.1
          ? "NOSE DOWN / SMALL CORRECTION"
          : "CENTER THE FLIGHT DIRECTOR",
    ),
    e.elapsed >= 22 &&
      endService(
        e.score >= 15
          ? "Manual service complete. Stable approach confirmed."
          : "Safe autopilot recovered the approach. No rank penalty.",
        e.score >= 15,
      ));
}
function endService(o = "Safe autopilot completed the service.", e = !1) {
  if (!service) return;
  let t = service.saved;
  (Object.assign(engine, t),
    engine.worldVersion++,
    (service = null),
    e && ((pilot.data.xp += 100), pilot.write()),
    showResult(t.result),
    toast(o + (e ? " +100 XP." : ""), 5500));
}
document.addEventListener("click", async (o) => {
  let e = o.target.closest("[data-action]");
  if (!e || e.disabled) return;
  let t = e.dataset.action,
    s = Number(e.dataset.id),
    i = e.dataset.key;
  (soundCall("unlock"), soundCall("event", "click"));
  try {
    switch (t) {
      case "home":
        goHome();
        break;
      case "play":
        showBriefing(nextMission());
        break;
      case "campaign":
        showCampaign();
        break;
      case "chapter":
        showCampaign(s);
        break;
      case "briefing":
        showBriefing(s);
        break;
      case "launch":
        launchMission();
        break;
      case "hangar":
        ((hangarPlane = pilot.data.selected), showHangar("home"));
        break;
      case "brief-hangar":
        ((hangarPlane = pilot.data.selected), showHangar("briefing"));
        break;
      case "preview-plane":
        ((hangarPlane = s), showHangar());
        break;
      case "select-plane":
        pilot.isPlaneUnlocked(s) &&
          ((pilot.data.selected = s), pilot.write(), toast(AIRCRAFT[s].name + " assigned."), showHangar());
        break;
      case "hangar-back":
        ((engine.p.plane = pilot.data.selected), hangarReturn === "briefing" ? showBriefing(briefingId) : goHome());
        break;
      case "upgrade":
        pilot.upgrade(i)
          ? (toast("Flight system upgraded."), showHangar())
          : toast("Insufficient credits for this upgrade.");
        break;
      case "sideops":
        showSideOps();
        break;
      case "archive":
        showArchive();
        break;
      case "archive-tab":
        showArchive(i);
        break;
      case "controls":
        showArchive("controls");
        break;
      case "credits":
        showArchive("credits");
        break;
      case "settings":
        showSettings();
        break;
      case "sound":
        ((pilot.data.settings.sound = !pilot.data.settings.sound),
          pilot.write(),
          soundCall("apply"),
          refreshHome(),
          toast(pilot.data.settings.sound ? "Audio enabled." : "Audio muted."));
        break;
      case "camera":
        cycleCamera();
        break;
      case "target":
        engine.chooseTarget(!0);
        break;
      case "flare":
        engine.flare();
        break;
      case "pause":
        service ? endService() : pauseFlight();
        break;
      case "resume":
        resumeFlight();
        break;
      case "retry":
        retryMission();
        break;
      case "next":
        (engine.initDemo(), (engine.p.plane = pilot.data.selected), showBriefing(s));
        break;
      case "brief-again":
        {
          let n = engine.mission.id;
          (engine.initDemo(), showBriefing(n));
        }
        break;
      case "result-home":
        (service && (service = null), goHome());
        break;
      case "pause-controls":
        byId("result-overlay").innerHTML =
          `<div class="pause-card" style="width:650px;max-height:85vh;overflow:auto;touch-action:pan-y"><div class="kicker">FLIGHT CONTROLS / PAUSED</div><p class="tiny-copy" style="line-height:2.2">W / S: climb and descend. A / D: turn. SHIFT: boost. CONTROL or X: brake.<br>SPACE: missile. J: gun. R: flare / roll. TAB: target. C: camera. M: map.<br>Touch: left stick flies; right buttons fire. Use the top-right pause button to stop.<br>Targets need to be centered and in range to lock. Braking tightens turns.</p><button class="primary" data-action="resume" style="margin-top:24px">RESUME FLIGHT ${ARROW}</button></div>`;
        break;
      case "map":
        toggleMap();
        break;
      case "fullscreen":
        document.fullscreenElement
          ? await document.exitFullscreen()
          : await document.documentElement.requestFullscreen();
        break;
      case "kit-settings":
        kit.menu.open();
        break;
      case "renderer-info":
        toast(
          "Three.js r" +
            THREE.REVISION +
            " / " +
            view.name +
            " / " +
            kit.tier.name.toUpperCase() +
            " QUALITY / filmic PBR",
          8500,
        );
        break;
      case "export-save":
        exportSave();
        break;
      case "import-save":
        byId("save-import").click();
        break;
      case "reset-save":
        byId("panel").innerHTML =
          `${openPanel("settings")}<div class="pause-card" style="margin:6vh auto"><div class="kicker">CONFIRM RECORD RESET</div><h1>A new callsign?</h1><p class="tiny-copy">This erases campaign ranks, aircraft unlocks, credits, and upgrades on this device. Export your record first to keep a backup.</p><button class="outline-btn" data-action="export-save">EXPORT BACKUP</button><button class="outline-btn danger" data-action="confirm-reset">ERASE PILOT RECORD</button><button class="primary" data-action="settings">KEEP MY RECORD \u2192</button></div>`;
        break;
      case "confirm-reset":
        (pilot.reset(), goHome(), toast("Pilot record reset. Welcome back to the flight line."));
        break;
      case "track":
        pilot.musicPlayer && ((sound.track = s), (sound.tickIndex = 0), showArchive("music"));
        break;
      case "intro":
        pilot.osl && playIntro(!1);
        break;
      case "ending":
        playIntro(!0);
        break;
      case "end-intro":
        goHome();
        break;
      case "service":
        beginService(i);
        break;
    }
  } catch (n) {
    (toast(n.message || "That action is not available in this browser."), console.error(n));
  }
});
document.addEventListener("input", (o) => {
  (o.target.dataset.setting && applySetting(o.target),
    o.target.id === "archive-search" && (byId("dossier-list").innerHTML = dossierList(o.target.value)));
});
document.addEventListener("change", (o) => {
  o.target.dataset.setting && applySetting(o.target);
});
byId("save-import").addEventListener("change", async (o) => {
  let e = o.target.files[0];
  if (e) {
    try {
      if (e.size > 2e6) throw new Error("Save file is too large.");
      (pilot.import(await e.text()), engine.initDemo(), showSettings(), toast("Pilot record imported and validated."));
    } catch (t) {
      toast("Import rejected: " + t.message, 6e3);
    }
    o.target.value = "";
  }
});
window.addEventListener("blur", () => {
  engine.state === "playing" && pauseFlight();
});
document.addEventListener("visibilitychange", () => {
  document.hidden && engine.state === "playing" && pauseFlight();
});
// The kit settings panel (gear-less: Settings, the pause card or F9) pauses the loop: hold the flight
// and the synthesized audio with it. (The kit settles input when the panel closes, so the button that
// closed it does not fire in the game.)
kit.onPause((o) => {
  (o && engine.state === "playing" && pauseFlight(),
    o ? sound.ctx?.suspend?.().catch?.(() => {}) : (sound.ready && soundCall("unlock"), updateTouchMode()));
});
kit.input.onSourceChange(updateTouchMode);
kit.settings.subscribe(updateTouchMode);
kit.onResize(() => {
  (resizeHud(),
    updateTouchMode(),
    currentScreen === "briefing" &&
      drawMap(
        byId("brief-map"),
        MISSIONS.find((o) => o.id === briefingId) || SIDE_OPS.find((o) => o.id === briefingId),
      ));
});
function frame(e) {
  let o = performance.now(),
    t = Math.min(0.05, e);
  (perfLog.frames++,
    (perfLog.elapsed += e),
    guarded("Menus", () => updateMenus(e)),
    guarded("Input", readInput),
    inputSettle > 0 && inputSettle--);
  try {
    service ? updateService(t) : engine.tick(t);
  } catch (s) {
    (logIssue("Simulation", s), engine.state === "playing" && pauseFlight());
  }
  try {
    (view.render(t), perfLog.renderedFrames++);
  } catch (s) {
    logIssue("Renderer", s);
  }
  if ((guarded("Mission events", handleEvents), soundCall("update", engine), currentScreen === "intro")) {
    introTime += t;
    let s = Math.floor(introTime / 6);
    if (s >= 3) goHome();
    else if (s !== introSlide) {
      introSlide = s;
      let i = (engine.introEnding ? ENDING_SLIDES : INTRO_SLIDES)[s];
      ((byId("intro-kicker").textContent = i[0]),
        (byId("intro-line").textContent = i[1]),
        (byId("intro-sub").textContent = i[2]));
    }
  }
  ((instrumentTimer += t),
    instrumentTimer > 0.09 && ((instrumentTimer = 0), service || guarded("Flight instruments", updateInstruments)),
    guarded("HUD", drawHud),
    o > toastUntil && byId("toast").classList.remove("active"),
    o > radioUntil && byId("radio").classList.remove("active"),
    o > bannerUntil && byId("mission-banner").classList.remove("active"));
}
refreshHome();
showScreen("home");
kit.loading.progress(0.8, "Building the airspace\u2026");
await view.init();
kit.start(frame);
window.NeonSkies = {
  build: BUILD,
  engine: engine,
  pilot: pilot,
  get renderer() {
    return view;
  },
  performanceLog: perfLog,
  showBriefing: showBriefing,
  showCampaign: showCampaign,
  showHangar: showHangar,
  showArchive: showArchive,
  showSettings: showSettings,
  launch: launchMission,
  goHome: goHome,
  beginService: beginService,
  endService: endService,
  get page() {
    return currentScreen;
  },
  content: { missions: MISSIONS, aircraft: AIRCRAFT, weapons: WEAPONS, sideOps: SIDE_OPS },
};
