// Stillpoint Frontier on the shared 3D stack: three.js r186 (WebGPURenderer
// with its WebGL2 fallback) through kit/boot.js. React draws the interface;
// vendor-react.js is the game's own React 19 build.
import * as THREE from "three/webgpu";
import {
  Fn,
  uniform,
  attribute,
  float,
  vec2,
  vec3,
  vec4,
  mix,
  smoothstep,
  clamp,
  fract,
  floor,
  dot,
  cross,
  normalize,
  length,
  pow,
  max,
  abs,
  sign,
  sin,
  cos,
  mod,
  select,
  reflect,
  hash,
  dFdx,
  dFdy,
  uv,
  screenUV,
  screenCoordinate,
  positionLocal,
  positionWorld,
  positionView,
  positionGeometry,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  modelWorldMatrix,
  modelViewMatrix,
  instanceIndex,
  instancedBufferAttribute,
  materialColor,
  materialRoughness,
  materialNormal,
  mrt,
  output,
  pass,
  renderOutput,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { ao as gtao } from "three/addons/tsl/display/GTAONode.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { boot } from "kit/boot.js";
import { createPoints } from "kit/points.js";
import { ut, Bi, G2, Ht } from "./vendor-react.js";

// The kit, once booted (the React shell boots it with the game canvas).
var KIT = null;
// A shadow-map size from the profile's size at the "high" tier, scaled for
// the kit tier the player runs.
function kitShadowSize(t) {
  return KIT ? KIT.shadowSize(t) : t;
}
// The survey profile that suits a kit quality tier.
function qualityForKitTier(t) {
  return t === "low" ? "performance" : t === "ultra" ? "ultra" : "cinematic";
}
var qL = ut(Bi()),
  ZL = ut(G2());
var Ur = ut(Bi(), 1);
var Q2 = ut(Bi(), 1);
var Xg = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function Ya(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Lu(t) {
  return Number.isFinite(t) ? ((t % 360) + 360) % 360 : 0;
}
function i1(t) {
  return Number.isFinite(t) ? (-t * 180) / Math.PI : 0;
}
function Yg(t) {
  return Lu(i1(t));
}
function V2(t, e) {
  let n = e.x - t.x,
    i = e.z - t.z;
  return !Number.isFinite(n) || !Number.isFinite(i) || (n === 0 && i === 0)
    ? 0
    : Lu((Math.atan2(n, -i) * 180) / Math.PI);
}
function W2(t, e) {
  return Lu(t - e + 180) - 180;
}
function X2(t, e) {
  return Math.hypot(e.x - t.x, e.z - t.z);
}
function Y2(t, e) {
  return !Number.isFinite(t) || !Number.isFinite(e) || e <= 0
    ? 50
    : 50 + (t / (e * 2)) * 100;
}
function r1(t) {
  return Xg[Math.round(Lu(t) / 45) % Xg.length];
}
function Xl(t) {
  let e = Math.round(Lu(t)) % 360;
  return `${String(e).padStart(3, "0")}\xB0`;
}
function zs(t) {
  return !Number.isFinite(t) || t < 0
    ? "--"
    : t >= 1e4
      ? `${Math.round(t / 1e3)} KM`
      : t >= 1e3
        ? `${(t / 1e3).toFixed(1)} KM`
        : `${Math.round(t)} M`;
}
function q2(t, e = 60, n = 5) {
  let i = Number.isFinite(t) ? t : 0,
    r = Number.isFinite(e) && e > 0 ? e : 60,
    a = Number.isFinite(n) && n > 0 ? n : 5,
    o = Math.floor((i - r) / a) * a,
    s = Math.ceil((i + r) / a) * a,
    l = [];
  for (let c = o; c <= s; c += a) {
    let u = Lu(c),
      h = Math.round(u / 45) % Xg.length,
      d = Math.abs(u / 45 - Math.round(u / 45)) < 1e-6,
      p = Math.abs(u / 15 - Math.round(u / 15)) < 1e-6;
    l.push({
      absoluteHeading: c,
      heading: u,
      offset: c - i,
      label: d ? Xg[h] : p ? String(Math.round(u)).padStart(3, "0") : null,
      kind: d ? "cardinal" : p ? "degree" : "minor",
    });
  }
  return l;
}
var fn = ut(Ht(), 1),
  Ou = 60,
  LF = {
    running: "RUNNING",
    paused: "PAUSED",
    frozen: "DEV FROZEN",
    test_hold: "TEST HOLD",
  };
function Compass({ store: t, environment: e }) {
  let n = (0, Q2.useSyncExternalStore)(
      t.subscribe,
      t.getSnapshot,
      t.getServerSnapshot,
    ),
    i = q2(n.unwrappedHeading, Ou, 5),
    r = n.navigation,
    a = r ? Ya(r.relativeBearing, -Ou + 2, Ou - 2) : 0,
    o = r ? Math.abs(r.relativeBearing) >= Ou - 2 : !1,
    s =
      !r || Math.abs(r.relativeBearing) < 4
        ? "ahead"
        : r.relativeBearing < 0
          ? "left"
          : "right",
    l = `${String(e.hour).padStart(2, "0")}:${String(e.minute).padStart(2, "0")}`,
    c = r
      ? `Waypoint ${Xl(r.bearing)}, ${zs(r.distance)}, ${r.reached ? "arrived" : s}`
      : "No active waypoint";
  return (0, fn.jsxs)("div", {
    className: "compass",
    "data-testid": "compass",
    role: "group",
    "aria-label": `Heading ${Xl(n.heading)}, ${r1(n.heading)}. ${c}`,
    children: [
      (0, fn.jsxs)("div", {
        className: `navigation-summary ${r?.reached ? "is-reached" : ""}`,
        "data-testid": "world-clock",
        role: "group",
        "aria-label": `Day ${e.day}, time ${l}. ${c}`,
        children: [
          (0, fn.jsxs)("div", {
            children: [
              (0, fn.jsx)("span", { children: "DAY" }),
              (0, fn.jsx)("strong", {
                children: String(e.day).padStart(3, "0"),
              }),
            ],
          }),
          (0, fn.jsxs)("div", {
            children: [
              (0, fn.jsx)("span", { children: "TIME" }),
              (0, fn.jsx)("time", { dateTime: l, children: l }),
            ],
          }),
          (0, fn.jsxs)("div", {
            children: [
              (0, fn.jsx)("span", { children: "WAYPOINT" }),
              (0, fn.jsx)("strong", {
                "data-testid": "navigation-bearing",
                children: r ? Xl(r.bearing) : "---\xB0",
              }),
            ],
          }),
          (0, fn.jsxs)("div", {
            children: [
              (0, fn.jsx)("span", { children: "DISTANCE" }),
              (0, fn.jsx)("strong", {
                "data-testid": "navigation-distance",
                children: r ? zs(r.distance) : "--",
              }),
            ],
          }),
          (0, fn.jsx)("span", {
            className: "sr-only",
            children: e.phase.toUpperCase(),
          }),
          (0, fn.jsx)("span", {
            className: "sr-only",
            "data-testid": "world-clock-state",
            children: LF[e.clockState],
          }),
        ],
      }),
      (0, fn.jsxs)("div", {
        className: "compass-heading",
        children: [
          (0, fn.jsx)("span", { children: "HEADING" }),
          (0, fn.jsx)("strong", { children: Xl(n.heading) }),
          (0, fn.jsx)("em", { children: r1(n.heading) }),
        ],
      }),
      (0, fn.jsxs)("div", {
        className: "compass-window",
        "data-testid": "compass-tape",
        "aria-hidden": "true",
        children: [
          i.map((u) =>
            (0, fn.jsx)(
              "i",
              {
                className: `compass-mark is-${u.kind}`,
                style: { left: `${50 + (u.offset / (Ou * 2)) * 100}%` },
                children: u.label && (0, fn.jsx)("b", { children: u.label }),
              },
              u.absoluteHeading,
            ),
          ),
          r &&
            (0, fn.jsx)("span", {
              className: `compass-waypoint ${o ? "is-offscreen" : ""} ${r.reached ? "is-reached" : ""}`,
              "data-testid": "waypoint-compass-marker",
              "data-direction": s,
              style: { left: `${50 + (a / (Ou * 2)) * 100}%` },
              children: o ? (r.relativeBearing < 0 ? "\u2039" : "\u203A") : "",
            }),
          (0, fn.jsx)("span", { className: "compass-center" }),
        ],
      }),
    ],
  });
}
function OF(t, e, n) {
  if (!t.length) return null;
  let i = e === null ? -1 : t.indexOf(e);
  return i < 0
    ? n
      ? t[t.length - 1]
      : t[0]
    : n && i === 0
      ? t[t.length - 1]
      : !n && i === t.length - 1
        ? t[0]
        : null;
}
function Kr(t, e) {
  if (t.key !== "Tab" || !e) return;
  let n = Array.from(
      e.querySelectorAll(
        "button, a[href], input, select, textarea, [tabindex]",
      ),
    ).filter(
      (r) =>
        r.tabIndex >= 0 &&
        !r.matches(":disabled") &&
        !r.closest("[hidden], [inert]") &&
        r.getClientRects().length > 0,
    ),
    i = OF(n, document.activeElement, t.shiftKey);
  i ? (t.preventDefault(), i.focus()) : n.length || t.preventDefault();
}
var Ea = ut(Bi(), 1);
var J2 = "Stillpoint Frontier",
  ot = "STILL-0317";
var QUALITY_PROFILES = {
    ultra: {
      label: "ULTRA",
      pixelRatioCap: 2,
      sunShadowMapSize: 4096,
      flashlightShadowMapSize: 2048,
      shadows: !0,
      highDetail: !0,
      postProcessing: {
        enabled: !0,
        msaaSamples: 4,
        bloomStrength: 0.24,
        bloomRadius: 0.32,
        bloomThreshold: 0.38,
        gtao: !0,
        gtaoResolutionScale: 0.5,
        gradingStrength: 0.28,
        vignetteStrength: 0.1,
        ditherStrength: 0.55,
      },
      environmentMap: { size: 128, intensity: 0.82 },
      worldEffects: { surfaceDetailStrength: 1, vegetationWindStrength: 1 },
    },
    cinematic: {
      label: "CINEMATIC",
      pixelRatioCap: 1.75,
      sunShadowMapSize: 2048,
      flashlightShadowMapSize: 1024,
      shadows: !0,
      highDetail: !0,
      postProcessing: {
        enabled: !0,
        msaaSamples: 2,
        bloomStrength: 0.17,
        bloomRadius: 0.24,
        bloomThreshold: 0.42,
        gtao: !1,
        gtaoResolutionScale: 0.5,
        gradingStrength: 0.2,
        vignetteStrength: 0.075,
        ditherStrength: 0.42,
      },
      environmentMap: { size: 64, intensity: 0.68 },
      worldEffects: { surfaceDetailStrength: 0.78, vegetationWindStrength: 1 },
    },
    performance: {
      label: "PERFORMANCE",
      pixelRatioCap: 1,
      sunShadowMapSize: 2048,
      flashlightShadowMapSize: 1024,
      shadows: !1,
      highDetail: !1,
      postProcessing: {
        enabled: !1,
        msaaSamples: 0,
        bloomStrength: 0,
        bloomRadius: 0,
        bloomThreshold: 1.3,
        gtao: !1,
        gtaoResolutionScale: 0.5,
        gradingStrength: 0,
        vignetteStrength: 0,
        ditherStrength: 0,
      },
      environmentMap: { size: 32, intensity: 0.5 },
      worldEffects: {
        surfaceDetailStrength: 0.42,
        vegetationWindStrength: 0.78,
      },
    },
  },
  QUALITY_ORDER = ["performance", "cinematic", "ultra"],
  ZW = QUALITY_PROFILES.cinematic.pixelRatioCap,
  KW = QUALITY_PROFILES.cinematic.sunShadowMapSize;
function isQualityProfile(t) {
  return t === "ultra" || t === "cinematic" || t === "performance";
}
function qualityHasShadows(t) {
  return QUALITY_PROFILES[t].shadows;
}
function qualityHasHighDetail(t) {
  return QUALITY_PROFILES[t].highDetail;
}
var HORIZON_PROFILES = {
    standard: {
      label: "STANDARD",
      drawDistanceMeters: 1840,
      hazeMultiplier: 1,
      rings: [{ inner: 432, outer: 1920, cellSize: 48 }],
    },
    extended: {
      label: "EXTENDED",
      drawDistanceMeters: 12e3,
      hazeMultiplier: 0.2,
      rings: [
        { inner: 432, outer: 1920, cellSize: 48 },
        { inner: 1920, outer: 6144, cellSize: 192 },
        { inner: 6144, outer: 12288, cellSize: 384 },
      ],
    },
    unlimited: {
      label: "UNLIMITED",
      drawDistanceMeters: 7e4,
      hazeMultiplier: 0.055,
      rings: [
        { inner: 432, outer: 1920, cellSize: 48 },
        { inner: 1920, outer: 6144, cellSize: 192 },
        { inner: 6144, outer: 24576, cellSize: 768 },
        { inner: 24576, outer: 49152, cellSize: 1536 },
      ],
    },
  },
  Fs = "standard";
function Kg(t) {
  return t === "standard" || t === "extended" || t === "unlimited";
}
var RELAYS = [
  {
    id: "amber-relay",
    name: "Amber Relay",
    code: "SR-01",
    x: 38,
    z: -52,
    note: "A weather archive, sealed before the last migration.",
  },
  {
    id: "hollow-array",
    name: "Hollow Array",
    code: "SR-02",
    x: -112,
    z: -118,
    note: "Its alignment points below the horizon, not above it.",
  },
  {
    id: "meridian-vault",
    name: "Meridian Vault",
    code: "SR-03",
    x: 156,
    z: 76,
    note: "The final survey mark repeats a coordinate with no known place.",
  },
];
var tp = 2,
  ha = {
    0: {
      label: "LOW",
      description: "COARSE TERRAIN",
      nearCellSize: 48,
      detailBlendEnd: 576,
      sceneryOuter: 432,
      scenerySpacing: 128,
      sceneryDensity: 0,
      maxSceneryInstances: 0,
      maxTerrainTriangles: 6e4,
    },
    1: {
      label: "BALANCED",
      description: "0.96 KM DETAIL",
      nearCellSize: 32,
      detailBlendEnd: 960,
      sceneryOuter: 912,
      scenerySpacing: 104,
      sceneryDensity: 0.46,
      maxSceneryInstances: 700,
      maxTerrainTriangles: 85e3,
    },
    2: {
      label: "HIGH",
      description: "1.34 KM DETAIL",
      nearCellSize: 24,
      detailBlendEnd: 1344,
      sceneryOuter: 1248,
      scenerySpacing: 88,
      sceneryDensity: 0.66,
      maxSceneryInstances: 1200,
      maxTerrainTriangles: 12e4,
    },
    3: {
      label: "ULTRA",
      description: "1.63 KM DETAIL",
      nearCellSize: 16,
      detailBlendEnd: 1632,
      sceneryOuter: 1536,
      scenerySpacing: 72,
      sceneryDensity: 0.84,
      maxSceneryInstances: 1800,
      maxTerrainTriangles: 19e4,
    },
    4: {
      label: "MAXIMUM",
      description: "1.92 KM DETAIL",
      nearCellSize: 12,
      detailBlendEnd: 1920,
      sceneryOuter: 1872,
      scenerySpacing: 60,
      sceneryDensity: 1,
      maxSceneryInstances: 2600,
      maxTerrainTriangles: 3e5,
    },
  };
function zu(t, e = tp) {
  if (typeof t != "number" || !Number.isFinite(t)) return e;
  let n = Math.round(t);
  return Math.min(4, Math.max(0, n));
}
function jg(t) {
  return ha[zu(t)];
}
var s1 = [60, 90, 120, 144, 165, 240];
function cr(t, e = 2) {
  let n = 10 ** e;
  return Math.round(t * n) / n;
}
function np(t) {
  return Number.isFinite(t) && t >= 0;
}
function a1(t, e) {
  let n = t.filter(Number.isFinite).sort((a, o) => a - o);
  if (n.length === 0) return null;
  let i = Math.min(1, Math.max(0, e)),
    r = Math.max(0, Math.ceil(i * n.length) - 1);
  return n[r];
}
function Uu(t) {
  let e = t.filter(np);
  return e.length === 0
    ? null
    : {
        samples: e.length,
        p50: cr(a1(e, 0.5) ?? 0),
        p95: cr(a1(e, 0.95) ?? 0),
        p99: cr(a1(e, 0.99) ?? 0),
        max: cr(Math.max(...e)),
      };
}
function o1(t) {
  return Number.isFinite(t)
    ? s1.reduce((e, n) => (Math.abs(n - t) < Math.abs(e - t) ? n : e))
    : 60;
}
var GraphicsBenchmark = class {
  constructor(e = {}) {
    this.phase = "idle";
    this.phaseStartedAt = 0;
    this.captureStartedAt = 0;
    this.lastTimestamp = 0;
    this.gpuSupported = !1;
    this.cancelledReason = null;
    this.captureContext = null;
    this.frameIntervals = [];
    this.cpuWork = [];
    this.cpuRender = [];
    this.gpu = new Map();
    this.expectedGpuFrames = new Set();
    this.drawCalls = [];
    this.triangles = [];
    ((this.warmupMs = Math.max(0, e.warmupMs ?? 2e3)),
      (this.sampleDurationMs = Math.max(100, e.sampleDurationMs ?? 1e4)),
      (this.gpuDrainMs = Math.max(0, e.gpuDrainMs ?? 1250)),
      (this.minimumSampleFrames = Math.max(
        1,
        Math.floor(e.minimumSampleFrames ?? 30),
      )),
      (this.targetFps = o1(e.targetFps ?? 60)));
  }
  setTarget(e) {
    if (
      this.phase === "warming" ||
      this.phase === "sampling" ||
      this.phase === "finalizing"
    )
      return !1;
    let n = o1(e);
    return n === this.targetFps
      ? !1
      : (this.phase !== "idle" && this.resetToIdle(), (this.targetFps = n), !0);
  }
  start(e, n, i = null) {
    return Number.isFinite(e)
      ? (this.clearSamples(),
        (this.phase = this.warmupMs > 0 ? "warming" : "sampling"),
        (this.phaseStartedAt = e),
        (this.captureStartedAt = e),
        (this.lastTimestamp = e),
        (this.gpuSupported = n),
        (this.cancelledReason = null),
        (this.captureContext = i ? zF(i) : null),
        !0)
      : !1;
  }
  get isActive() {
    return (
      this.phase === "warming" ||
      this.phase === "sampling" ||
      this.phase === "finalizing"
    );
  }
  get isMeasuringGpu() {
    return this.phase === "sampling";
  }
  cancel(e = "Capture cancelled") {
    return this.isActive
      ? ((this.phase = "cancelled"), (this.cancelledReason = e), !0)
      : !1;
  }
  invalidate(e = "Capture configuration changed") {
    return this.phase === "idle"
      ? !1
      : this.isActive
        ? ((this.phase = "cancelled"), (this.cancelledReason = e), !0)
        : (this.resetToIdle(), !0);
  }
  reset(e = this.targetFps) {
    (this.resetToIdle(), (this.targetFps = o1(e)));
  }
  recordFrame(e) {
    return (this.phase !== "warming" &&
      this.phase !== "sampling" &&
      this.phase !== "finalizing") ||
      !Number.isFinite(e.timestampMs)
      ? !1
      : ((this.lastTimestamp = e.timestampMs),
        this.phase === "warming"
          ? e.timestampMs - this.phaseStartedAt < this.warmupMs
            ? !1
            : ((this.phase = "sampling"),
              (this.phaseStartedAt = e.timestampMs),
              !0)
          : this.phase === "sampling"
            ? (!e.hidden &&
                np(e.frameIntervalMs) &&
                np(e.cpuWorkMs) &&
                np(e.cpuRenderMs) &&
                (this.frameIntervals.push(e.frameIntervalMs),
                this.cpuWork.push(e.cpuWorkMs),
                this.cpuRender.push(e.cpuRenderMs),
                this.drawCalls.push(Math.max(0, e.drawCalls)),
                this.triangles.push(Math.max(0, e.triangles)),
                e.gpuQuerySubmitted &&
                  this.expectedGpuFrames.add(e.frameToken)),
              e.timestampMs - this.phaseStartedAt >= this.sampleDurationMs &&
                ((this.phase = "finalizing"),
                (this.phaseStartedAt = e.timestampMs)),
              !0)
            : (this.tryFinalize(e.timestampMs), !0));
  }
  resolveGpuSamples(e) {
    if (!this.isActive) return !1;
    let n = !1;
    for (let i of e)
      this.expectedGpuFrames.has(i.frameToken) &&
        np(i.milliseconds) &&
        (this.gpu.set(i.frameToken, i.milliseconds), (n = !0));
    return (
      this.phase === "finalizing" && this.tryFinalize(this.lastTimestamp),
      n
    );
  }
  get snapshot() {
    let e = Uu(this.frameIntervals),
      n = Uu(this.cpuWork),
      i = Uu(this.cpuRender),
      r = Uu([...this.gpu.values()]),
      a = Uu(this.drawCalls),
      o = Uu(this.triangles),
      s = 1e3 / this.targetFps,
      l = this.frameIntervals.length,
      c = this.expectedGpuFrames.size,
      u = this.gpu.size,
      h = l > 0 ? cr((c / l) * 100, 1) : null,
      d = c > 0 ? cr((u / c) * 100, 1) : null,
      p = Math.min(30, l),
      f = this.phase === "complete" && l < this.minimumSampleFrames,
      S =
        !this.gpuSupported ||
        (p > 0 && c >= Math.ceil(p * 0.8) && u >= Math.ceil(c * 0.8)),
      v = this.gpuSupported
        ? this.phase !== "complete"
          ? "PENDING"
          : S
            ? "VALID"
            : "INCOMPLETE"
        : "UNSUPPORTED",
      m = n?.p95 ?? null,
      y = r?.p95 ?? null,
      x = this.gpuSupported && !S ? null : y,
      g = this.phase === "complete" && this.gpuSupported && !S,
      E = m === null || g || f ? null : x === null ? m : Math.max(m, x),
      M = null;
    m !== null &&
      !f &&
      (g
        ? (M = "GPU_INCOMPLETE")
        : x === null
          ? (M = "CPU_ONLY")
          : (M = x > m ? "GPU" : "CPU"));
    let _ = E === null ? null : cr((1 - E / s) * 100, 1),
      b = Math.max(0, this.lastTimestamp - this.captureStartedAt),
      T = this.progress(b),
      R = e
        ? cr(
            (this.frameIntervals.filter((L) => L > s * 1.2).length /
              this.frameIntervals.length) *
              100,
            1,
          )
        : null,
      C = e && e.p50 > 0 ? cr(1e3 / e.p50, 1) : null,
      P = "PENDING",
      B = "PENDING";
    return (
      this.phase === "cancelled" && (P = "CANCELLED"),
      this.phase === "cancelled"
        ? (B = "CANCELLED")
        : this.phase === "complete" && (f || g)
          ? (P = "INCOMPLETE")
          : this.phase === "complete" &&
            E !== null &&
            (P = E > s * 0.9 ? "FAIL" : E <= s * 0.75 ? "PASS" : "MARGIN"),
      this.phase === "complete" &&
        (B =
          (R ?? 100) <= 1 &&
          (e && e.p99 > 0 ? 1e3 / e.p99 >= this.targetFps * 0.9 : !1)
            ? "PASS"
            : E !== null &&
                E <= s * 0.9 &&
                l >= 30 &&
                e !== null &&
                e.p99 <= e.p50 * 1.12 &&
                (C ?? 0) < this.targetFps * 0.9
              ? "CAP_LIMITED"
              : "MISS"),
      {
        phase: this.phase,
        targetFps: this.targetFps,
        budgetMs: cr(s),
        progress: T,
        warmupMs: this.warmupMs,
        sampleDurationMs: this.sampleDurationMs,
        minimumSampleFrames: this.minimumSampleFrames,
        elapsedMs: cr(b),
        frameInterval: e,
        cpuWork: n,
        cpuRender: i,
        gpu: r,
        drawCalls: a,
        triangles: o,
        gpuSupported: this.gpuSupported,
        sampledFrames: l,
        gpuQueriesSubmitted: c,
        gpuQueriesResolved: u,
        gpuSubmissionPercent: h,
        gpuCoveragePercent: d,
        gpuMeasurement: v,
        gpuSamplesPending: Math.max(
          0,
          this.expectedGpuFrames.size - this.gpu.size,
        ),
        bottleneck: M,
        headroomPercent: _,
        estimatedMaxFps: E && E > 0 ? cr(1e3 / E, 1) : null,
        observedFps: C,
        onePercentLowFps: e && e.p99 > 0 ? cr(1e3 / e.p99, 1) : null,
        missedRefreshPercent: R,
        grade: P,
        delivery: B,
        cancelledReason: this.cancelledReason,
        context: this.captureContext,
      }
    );
  }
  tryFinalize(e) {
    (!this.gpuSupported ||
      this.gpu.size >= this.expectedGpuFrames.size ||
      e - this.phaseStartedAt >= this.gpuDrainMs) &&
      (this.phase = "complete");
  }
  progress(e) {
    let n = this.warmupMs + this.sampleDurationMs;
    return this.phase === "complete"
      ? 1
      : this.phase === "idle" || this.phase === "cancelled"
        ? 0
        : this.phase === "finalizing"
          ? 0.98
          : cr(Math.min(0.98, e / Math.max(1, n)), 3);
  }
  clearSamples() {
    ((this.frameIntervals.length = 0),
      (this.cpuWork.length = 0),
      (this.cpuRender.length = 0),
      this.gpu.clear(),
      this.expectedGpuFrames.clear(),
      (this.drawCalls.length = 0),
      (this.triangles.length = 0));
  }
  resetToIdle() {
    (this.clearSamples(),
      (this.phase = "idle"),
      (this.phaseStartedAt = 0),
      (this.captureStartedAt = 0),
      (this.lastTimestamp = 0),
      (this.gpuSupported = !1),
      (this.cancelledReason = null),
      (this.captureContext = null));
  }
};
function zF(t) {
  return Object.freeze({
    ...t,
    resolution: Object.freeze({ ...t.resolution }),
    forest: Object.freeze({ ...t.forest }),
    viewpoint: Object.freeze({ ...t.viewpoint }),
    environment: Object.freeze({ ...t.environment }),
    hardware: Object.freeze({ ...t.hardware }),
  });
}
function eD() {
  return new GraphicsBenchmark().snapshot;
}
function ur(t) {
  let e = 2166136261;
  for (let n = 0; n < t.length; n += 1)
    ((e ^= t.charCodeAt(n)), (e = Math.imul(e, 16777619)));
  return e >>> 0;
}
function UF(t) {
  let e = t >>> 0;
  return () => {
    e = (e + 1831565813) | 0;
    let n = Math.imul(e ^ (e >>> 15), 1 | e);
    return (
      (n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
function kt(t) {
  return UF(ur(t));
}
function Kt(t, e, n) {
  return e + (n - e) * t();
}
var wt = {
    id: "canopy-load-lab",
    label: "Canopy Load Lab",
    center: { x: 6144, z: -5760 },
    arrival: { x: 6144, z: -5930 },
    forestRadius: 420,
    activationRadius: 2400,
    unloadRadius: 2640,
    lakeRadius: 94,
    lakeSurfaceOverlap: 0.75,
    shorelineRadius: 132,
    lakeSurfaceY: 6,
    lakeRenderOffset: 0.018,
    lakeBedY: 4.72,
    tileSize: 120,
    nearLodDistance: 150,
    midLodDistance: 330,
  },
  No = [
    {
      id: "baseline",
      label: "BASELINE",
      trees: 0,
      groundcover: 0,
      rocks: 0,
      reeds: 0,
    },
    {
      id: "reference",
      label: "REFERENCE",
      trees: 1500,
      groundcover: 6e3,
      rocks: 250,
      reeds: 512,
    },
    {
      id: "dense",
      label: "DENSE",
      trees: 3e3,
      groundcover: 12e3,
      rocks: 400,
      reeds: 1024,
    },
    {
      id: "heavy",
      label: "HEAVY",
      trees: 6e3,
      groundcover: 24e3,
      rocks: 700,
      reeds: 1536,
    },
    {
      id: "extreme",
      label: "EXTREME",
      trees: 12e3,
      groundcover: 48e3,
      rocks: 1100,
      reeds: 2048,
    },
    {
      id: "overload",
      label: "OVERLOAD",
      trees: 2e4,
      groundcover: 8e4,
      rocks: 1600,
      reeds: 4096,
    },
  ];
function nD(t) {
  return Math.min(1, Math.max(0, t));
}
function tD(t) {
  let e = nD(t);
  return e * e * e * (e * (e * 6 - 15) + 10);
}
function iD(t) {
  return Number.isFinite(t) ? Math.min(5, Math.max(0, Math.round(t))) : 2;
}
function rp(t, e) {
  return Math.hypot(t - wt.center.x, e - wt.center.z);
}
function rD(t, e, n = 0) {
  let i = Number.isFinite(n) ? n : 0,
    r = wt.lakeRadius + i;
  if (r <= 0) return !1;
  let a = t - wt.center.x,
    o = e - wt.center.z;
  return Math.abs(a) >= r || Math.abs(o) >= r ? !1 : Math.hypot(a, o) < r;
}
function Yl(t, e, n = 0) {
  let i = Math.max(0, Number.isFinite(n) ? n : 0),
    r = wt,
    a = t - r.center.x,
    o = e - r.center.z;
  return Math.abs(a) >= r.shorelineRadius + i ||
    o < -212 - i ||
    o >= r.shorelineRadius + i
    ? !1
    : rp(t, e) < r.shorelineRadius + i ||
        Math.hypot(t - r.arrival.x, e - r.arrival.z) < 12 + i
      ? !0
      : e >= r.center.z - 212 - i &&
        e <= r.center.z - r.shorelineRadius + 8 + i &&
        Math.abs(t - r.center.x) < 7 + i;
}
function l1(t, e, n) {
  if (!Number.isFinite(t)) return t;
  let i = wt,
    r = e - i.center.x,
    a = n - i.center.z;
  if (Math.abs(r) >= i.shorelineRadius || Math.abs(a) >= i.shorelineRadius)
    return t;
  let o = rp(e, n);
  if (o >= i.shorelineRadius) return t;
  let s = nD(o / i.lakeRadius),
    l = i.lakeBedY + tD(s) * (i.lakeSurfaceY - i.lakeBedY);
  if (o <= i.lakeRadius) return Math.min(t, l);
  let c = (o - i.lakeRadius) / (i.shorelineRadius - i.lakeRadius),
    u = tD(c);
  return Math.min(t, i.lakeSurfaceY * (1 - u) + t * u);
}
function aD(t, e) {
  let n = wt,
    i = n.forestRadius,
    r = Math.ceil((i * 2) / n.tileSize),
    a = Math.min(
      r - 1,
      Math.max(0, Math.floor((t - (n.center.x - i)) / n.tileSize)),
    ),
    o = Math.min(
      r - 1,
      Math.max(0, Math.floor((e - (n.center.z - i)) / n.tileSize)),
    );
  return `${a}:${o}`;
}
function Qg(t, e) {
  let n = Math.max(0, Math.floor(Number.isFinite(e) ? e : 0)),
    i = kt(`${ot}:canopy-benchmark:v1:${t}:capacity`),
    r = wt,
    a = [],
    o = r.shorelineRadius + (t === "trees" ? 4 : 1.5),
    s = n * 24 + 64,
    l = 0;
  for (; a.length < n && l < s; ) {
    l += 1;
    let c = i() * Math.PI * 2,
      u = Math.sqrt(o * o + i() * (r.forestRadius * r.forestRadius - o * o)),
      h = r.center.x + Math.cos(c) * u,
      d = r.center.z + Math.sin(c) * u;
    Yl(h, d, t === "trees" ? 1.8 : t === "rocks" ? 1.1 : 0.3) ||
      a.push({
        x: h,
        z: d,
        scale:
          t === "trees"
            ? 0.72 + i() * 0.82
            : t === "rocks"
              ? 0.3 + i() * 1.15
              : 0.58 + i() * 0.94,
        yaw: i() * Math.PI * 2,
        tint: 0.84 + i() * 0.22,
      });
  }
  return a;
}
function oD(t) {
  let e = Math.max(0, Math.floor(Number.isFinite(t) ? t : 0)),
    n = kt(`${ot}:canopy-benchmark:v1:reeds:capacity`),
    i = wt;
  return Array.from({ length: e }, () => {
    let r = n() * Math.PI * 2,
      a = i.lakeRadius + 1.5 + n() * 13;
    return {
      x: i.center.x + Math.cos(r) * a,
      z: i.center.z + Math.sin(r) * a,
      scale: 0.55 + n() * 0.8,
      yaw: r + (n() - 0.5) * 0.6,
      tint: 0.84 + n() * 0.2,
    };
  });
}
var FF = [
    "shadowStabilization",
    "surfaceDetail",
    "vegetationWind",
    "cloudShadows",
    "wetSurfaces",
    "atmosphericGrade",
    "horizonLights",
    "stormLightning",
    "selectiveBloom",
    "ambientOcclusion",
    "environmentReflections",
  ],
  DEFAULT_GRAPHICS_FEATURES = Object.freeze({
    shadowStabilization: !0,
    surfaceDetail: !0,
    vegetationWind: !0,
    cloudShadows: !0,
    wetSurfaces: !0,
    atmosphericGrade: !0,
    horizonLights: !0,
    stormLightning: !0,
    selectiveBloom: !0,
    ambientOcclusion: !0,
    environmentReflections: !0,
  }),
  sD = [
    {
      id: "shadowStabilization",
      label: "STABLE SUN SHADOWS",
      description:
        "Texel-snaps the local sun-shadow field to reduce crawling while moving.",
    },
    {
      id: "surfaceDetail",
      label: "SURFACE MICRO-DETAIL",
      description:
        "Adds distance-faded world-space color and roughness breakup to terrain and structures.",
    },
    {
      id: "vegetationWind",
      label: "VEGETATION WIND",
      description:
        "Bends trees, reeds, and ground cover with the live weather wind field.",
    },
    {
      id: "cloudShadows",
      label: "MOVING CLOUD SHADOWS",
      description:
        "Projects broad, weather-driven cloud shade over nearby outdoor surfaces without another render pass.",
    },
    {
      id: "wetSurfaces",
      label: "WET SURFACE POOLING",
      description:
        "Adds rain-darkening, localized puddle sheen, and stronger sky reflections to exposed surfaces.",
    },
    {
      id: "atmosphericGrade",
      label: "ATMOSPHERIC GRADE",
      description:
        "Adapts the final palette to daylight, golden hour, storms, dust, and night.",
    },
    {
      id: "horizonLights",
      label: "HORIZON CITY LIGHTS",
      description:
        "Adds capped render-only window and rooftop lights to distant cities at night.",
    },
    {
      id: "stormLightning",
      label: "STORM LIGHTNING",
      description:
        "Adds deterministic, weather-only illumination flashes to the sky and outdoor lighting.",
    },
    {
      id: "selectiveBloom",
      label: "SELECTIVE BLOOM",
      description:
        "Adds restrained glow to marked windows, relays, torches, and skyline lights.",
    },
    {
      id: "ambientOcclusion",
      label: "NEAR-FIELD GTAO",
      description:
        "Grounds nearby structures and vegetation on Ultra when the browser supports it.",
    },
    {
      id: "environmentReflections",
      label: "ENVIRONMENT REFLECTIONS",
      description:
        "Feeds the generated sky and horizon into PBR glass, metal, roofs, and wet surfaces.",
    },
  ];
function lD(t) {
  return FF.includes(t);
}
function cD(t, e, n) {
  return t[e] === n ? t : { ...t, [e]: n };
}
var c1 = ["normal", "fast", "veryFast"],
  ap = Object.freeze({ invincible: !1, speedMode: "normal", fly: !1 }),
  Fu = Object.freeze({
    normal: { label: "NORMAL", multiplier: 1 },
    fast: { label: "FAST", multiplier: 5 },
    veryFast: { label: "VERY FAST", multiplier: 20 },
  }),
  uD = 1500;
function dD(t) {
  return c1.includes(t);
}
function hD(t) {
  return Fu[t].multiplier;
}
function u1(t) {
  return (Object.assign(t, ap), t);
}
function pD(t) {
  let e = Number.isFinite(t.inputX) ? t.inputX : 0,
    n = Number.isFinite(t.inputZ) ? t.inputZ : 0,
    i = Number.isFinite(t.yaw) ? t.yaw : 0,
    r = Number.isFinite(t.pitch) ? t.pitch : 0,
    a = -n,
    o = Math.cos(r),
    s = Math.cos(i) * e - Math.sin(i) * o * a,
    l = Math.sin(r) * a,
    c = -Math.sin(i) * e - Math.cos(i) * o * a;
  l += (t.ascend ? 1 : 0) - (t.descend ? 1 : 0);
  let u = Math.hypot(s, l, c);
  return (u > 1 && ((s /= u), (l /= u), (c /= u)), { x: s, y: l, z: c });
}
function gc(t) {
  return Number.isFinite(t.x) && Number.isFinite(t.z);
}
function ro(t) {
  return gc(t) && Number.isFinite(t.y);
}
function lf(t) {
  return !t.id ||
    !gc(t) ||
    (t.minY !== void 0 && !Number.isFinite(t.minY)) ||
    (t.maxY !== void 0 && !Number.isFinite(t.maxY)) ||
    (t.minY !== void 0 && t.maxY !== void 0 && t.minY > t.maxY)
    ? !1
    : t.shape === "circle"
      ? Number.isFinite(t.radius) && t.radius >= 0
      : Number.isFinite(t.halfWidth) &&
        t.halfWidth >= 0 &&
        Number.isFinite(t.halfDepth) &&
        t.halfDepth >= 0 &&
        Number.isFinite(t.rotation);
}
function M_(t, e, n) {
  let i = Number.isFinite(e) ? e : -1 / 0,
    r = Number.isFinite(n) ? n : 1 / 0,
    a = Math.min(i, r),
    o = Math.max(i, r);
  return (t.maxY ?? 1 / 0) >= a && (t.minY ?? -1 / 0) <= o;
}
function w_(t, e) {
  let n = Math.cos(e.rotation),
    i = Math.sin(e.rotation),
    r = t.x - e.x,
    a = t.z - e.z;
  return { x: n * r - i * a, z: i * r + n * a };
}
function tN(t, e) {
  let n = Math.cos(e),
    i = Math.sin(e);
  return { x: n * t.x - i * t.z, z: i * t.x + n * t.z };
}
function nN(t, e) {
  let n = Math.cos(e),
    i = Math.sin(e);
  return { x: n * t.x + i * t.z, z: -i * t.x + n * t.z };
}
function __(t) {
  if (t.shape === "circle")
    return {
      minX: t.x - t.radius,
      maxX: t.x + t.radius,
      minZ: t.z - t.radius,
      maxZ: t.z + t.radius,
    };
  let e = Math.abs(Math.cos(t.rotation)),
    n = Math.abs(Math.sin(t.rotation)),
    i = e * t.halfWidth + n * t.halfDepth,
    r = n * t.halfWidth + e * t.halfDepth;
  return { minX: t.x - i, maxX: t.x + i, minZ: t.z - r, maxZ: t.z + r };
}
function cf(t, e) {
  let n = Math.max(t.min, e.min),
    i = Math.min(t.max, e.max);
  return i >= n - 1e-9 ? { min: n, max: i } : null;
}
function iN(t, e, n) {
  let i = t.x - n.x,
    r = t.z - n.z,
    a = e.x * e.x + e.z * e.z,
    o = n.radius * n.radius;
  if (a <= 1e-9) return i * i + r * r <= o + 1e-9 ? { min: 0, max: 1 } : null;
  let s = i * e.x + r * e.z,
    l = i * i + r * r - o,
    c = s * s - a * l;
  if (c < -1e-9) return null;
  let u = Math.sqrt(Math.max(0, c)),
    h = (-s - u) / a,
    d = (-s + u) / a;
  return cf({ min: Math.min(h, d), max: Math.max(h, d) }, { min: 0, max: 1 });
}
function JI(t, e, n, i) {
  if (Math.abs(n) <= 1e-9) return Math.abs(e) <= i + 1e-9 ? { ...t } : null;
  let r = (-i - e) / n,
    a = (i - e) / n;
  return cf(t, { min: Math.min(r, a), max: Math.max(r, a) });
}
function rN(t, e, n) {
  let i = w_(t, n),
    r = tN(e, n.rotation),
    a = JI({ min: 0, max: 1 }, i.x, r.x, n.halfWidth);
  return a ? JI(a, i.z, r.z, n.halfDepth) : null;
}
function aN(t, e, n) {
  let i = n.minY ?? -1 / 0,
    r = n.maxY ?? 1 / 0;
  if (Math.abs(e) <= 1e-9)
    return t >= i - 1e-9 && t <= r + 1e-9 ? { min: 0, max: 1 } : null;
  let a = (i - t) / e,
    o = (r - t) / e;
  return cf({ min: Math.min(a, o), max: Math.max(a, o) }, { min: 0, max: 1 });
}
function oN(t, e, n, i = new Set()) {
  if (!ro(t) || !ro(e)) return !1;
  let r = { x: e.x - t.x, z: e.z - t.z },
    a = e.y - t.y;
  for (let o of n) {
    if (i.has(o.id) || !lf(o)) continue;
    let s = o.shape === "circle" ? iN(t, r, o) : rN(t, r, o);
    if (!s) continue;
    let l = aN(t.y, a, o);
    if (!l) continue;
    let c = cf(s, l);
    if (!c) continue;
    let u = Math.max(c.min, 1e-4);
    if (Math.min(c.max, 1 - 1e-4) - u > 1e-9) return !1;
  }
  return !0;
}
function sN(t, e, n, i = 0) {
  if (!ro(t) || !ro(e)) return 0;
  let r = Number.isFinite(i) ? Math.max(0, i) : 0,
    a = { x: e.x - t.x, z: e.z - t.z },
    o = e.y - t.y,
    s = 1 / 0;
  for (let l of n) {
    if (!lf(l)) continue;
    let c =
        l.shape === "circle"
          ? {
              ...l,
              radius: l.radius + r,
              minY: l.minY === void 0 ? void 0 : l.minY - r,
              maxY: l.maxY === void 0 ? void 0 : l.maxY + r,
            }
          : {
              ...l,
              halfWidth: l.halfWidth + r,
              halfDepth: l.halfDepth + r,
              minY: l.minY === void 0 ? void 0 : l.minY - r,
              maxY: l.maxY === void 0 ? void 0 : l.maxY + r,
            },
      u = c.shape === "circle" ? iN(t, a, c) : rN(t, a, c);
    if (!u) continue;
    let h = aN(t.y, o, c);
    if (!h) continue;
    let d = cf(u, h);
    !d || d.max <= 1e-4 || (s = Math.min(s, Math.max(1e-4, d.min)));
  }
  return Number.isFinite(s) ? TG(s) : null;
}
function lN(t, e, n, i = 0, r = 0.75) {
  if (!ro(t) || !ro(e)) return 0;
  let a = Number.isFinite(i) ? Math.max(0, i) : 0,
    o = Math.hypot(e.x - t.x, e.z - t.z),
    s = Number.isFinite(r) && r > 0 ? Math.max(0.2, r) : 0.75,
    l = Math.min(192, Math.max(1, Math.ceil(o / s)));
  for (let c = 1; c <= l; c += 1) {
    let u = c / l,
      h = t.x + (e.x - t.x) * u,
      d = t.z + (e.z - t.z) * u,
      p = t.y + (e.y - t.y) * u,
      f = n(h, d);
    if (!Number.isFinite(f) || f + a >= p) return Math.max(0, (c - 1) / l);
  }
  return null;
}
function cN(t, e, n, i = 0, r = 0.55) {
  if (!ro(t) || !ro(e)) return 0;
  let a = Number.isFinite(i) ? Math.max(0, i) : 0,
    o = Math.hypot(e.x - t.x, e.y - t.y, e.z - t.z),
    s = Number.isFinite(r) && r > 0 ? Math.max(0.2, r) : 0.55,
    l = Math.min(192, Math.max(1, Math.ceil(o / s))),
    c = t.y;
  for (let u = 1; u <= l; u += 1) {
    let h = u / l,
      d = t.x + (e.x - t.x) * h,
      p = t.z + (e.z - t.z) * h,
      f = t.y + (e.y - t.y) * h,
      S = Math.min(c, f) - a,
      v = Math.max(c, f) + a,
      m = n(d, p, S);
    if (m === null) {
      c = f;
      continue;
    }
    if (!Number.isFinite(m)) return 0;
    if (m >= S && m <= v) return Math.max(0, (u - 1) / l);
    c = f;
  }
  return null;
}
function TG(t) {
  return Math.min(1, Math.max(0, t));
}
function uN(t, e, n, i = 1.25) {
  if (!ro(t) || !ro(e)) return !1;
  let r = Math.hypot(e.x - t.x, e.z - t.z);
  if (r <= 1e-9) return !0;
  let a = Number.isFinite(i) && i > 0 ? Math.max(0.25, i) : 1.25,
    o = Math.min(128, Math.max(1, Math.ceil(r / a)));
  for (let s = 1; s < o; s += 1) {
    let l = s / o,
      c = t.x + (e.x - t.x) * l,
      u = t.z + (e.z - t.z) * l,
      h = t.y + (e.y - t.y) * l,
      d = n(c, u);
    if (!Number.isFinite(d) || d >= h - 0.04) return !1;
  }
  return !0;
}
var CollisionIndex = class {
  constructor(e = 16) {
    this.cellSize = e;
    this.cells = new Map();
    this.maximumColliderReach = 0;
    if (!Number.isFinite(e) || e <= 0)
      throw new Error("Collision-index cell size must be positive and finite.");
  }
  rebuild(e) {
    (this.cells.clear(), (this.maximumColliderReach = 0));
    for (let n of e) {
      if (!lf(n)) continue;
      let i = __(n);
      this.maximumColliderReach = Math.max(
        this.maximumColliderReach,
        (i.maxX - i.minX) * 0.5,
        (i.maxZ - i.minZ) * 0.5,
      );
      let r = Math.floor(i.minX / this.cellSize),
        a = Math.floor(i.maxX / this.cellSize),
        o = Math.floor(i.minZ / this.cellSize),
        s = Math.floor(i.maxZ / this.cellSize);
      for (let l = r; l <= a; l += 1)
        for (let c = o; c <= s; c += 1) {
          let u = `${l}:${c}`,
            h = this.cells.get(u);
          h ? h.push(n) : this.cells.set(u, [n]);
        }
    }
  }
  querySweep(e, n, i) {
    if (!gc(e) || !gc(n)) return [];
    let a =
        (Number.isFinite(i) && i >= 0 ? i : 0) +
        this.maximumColliderReach * 2 +
        1e-4,
      o = {
        minX: Math.min(e.x, n.x) - a,
        maxX: Math.max(e.x, n.x) + a,
        minZ: Math.min(e.z, n.z) - a,
        maxZ: Math.max(e.z, n.z) + a,
      },
      s = new Set(),
      l = Math.floor(o.minX / this.cellSize),
      c = Math.floor(o.maxX / this.cellSize),
      u = Math.floor(o.minZ / this.cellSize),
      h = Math.floor(o.maxZ / this.cellSize);
    for (let d = l; d <= c; d += 1)
      for (let p = u; p <= h; p += 1)
        for (let f of this.cells.get(`${d}:${p}`) ?? []) {
          let S = __(f);
          o.maxX < S.minX ||
            o.minX > S.maxX ||
            o.maxZ < S.minZ ||
            o.minZ > S.maxZ ||
            s.add(f);
        }
    return [...s];
  }
};
function RG(t, e, n, i) {
  let r = __(n),
    a = t.x + e.x,
    o = t.z + e.z;
  return !(
    Math.max(t.x, a) + i < r.minX ||
    Math.min(t.x, a) - i > r.maxX ||
    Math.max(t.z, o) + i < r.minZ ||
    Math.min(t.z, o) - i > r.maxZ
  );
}
function CG(t, e, n) {
  let i = n + e.radius,
    r = t.x - e.x,
    a = t.z - e.z,
    o = r * r + a * a;
  if (o >= i * i - 1e-9) return null;
  let s = Math.sqrt(Math.max(0, o));
  return s <= 1e-9
    ? { x: 1, z: 0, depth: i }
    : { x: r / s, z: a / s, depth: i - s };
}
function AG(t, e, n) {
  let i = w_(t, e),
    r = Math.max(-e.halfWidth, Math.min(e.halfWidth, i.x)),
    a = Math.max(-e.halfDepth, Math.min(e.halfDepth, i.z)),
    o = i.x - r,
    s = i.z - a,
    l = o * o + s * s,
    c,
    u;
  if (l > 1e-9) {
    if (l >= n * n - 1e-9) return null;
    let d = Math.sqrt(l);
    ((c = { x: o / d, z: s / d }), (u = n - d));
  } else {
    let d = e.halfWidth - Math.abs(i.x),
      p = e.halfDepth - Math.abs(i.z);
    d <= p
      ? ((c = { x: i.x < 0 ? -1 : 1, z: 0 }), (u = d + n))
      : ((c = { x: 0, z: i.z < 0 ? -1 : 1 }), (u = p + n));
  }
  return { ...nN(c, e.rotation), depth: u };
}
function dN(t, e, n) {
  return lf(e) ? (e.shape === "circle" ? CG(t, e, n) : AG(t, e, n)) : null;
}
function eN(t, e, n) {
  let i = { ...t };
  for (let r = 0; r < 16; r += 1) {
    let a = null;
    for (let o of e) {
      let s = dN(i, o, n);
      s &&
        (!a ||
          s.depth > a.depth + 1e-9 ||
          (Math.abs(s.depth - a.depth) <= 1e-9 && o.id < a.id)) &&
        (a = { ...s, id: o.id });
    }
    if (!a) break;
    ((i.x += a.x * (a.depth + 1e-4)), (i.z += a.z * (a.depth + 1e-4)));
  }
  return i;
}
function DG(t, e, n, i) {
  let r = i + n.radius,
    a = t.x - n.x,
    o = t.z - n.z,
    s = e.x * e.x + e.z * e.z;
  if (s <= 1e-9) return null;
  let l = a * a + o * o,
    c = a * e.x + o * e.z;
  if (l <= r * r + 1e-9) {
    let y = Math.sqrt(Math.max(0, l)),
      x = y > 1e-9 ? { x: a / y, z: o / y } : { x: 1, z: 0 };
    return e.x * x.x + e.z * x.z < -1e-9 ? { ...x, time: 0 } : null;
  }
  let u = l - r * r,
    h = c * c - s * u;
  if (h < 0) return null;
  let d = (-c - Math.sqrt(Math.max(0, h))) / s;
  if (d < -1e-7 || d > 1 + 1e-7) return null;
  let p = Math.max(0, Math.min(1, d)),
    f = t.x + e.x * p,
    S = t.z + e.z * p,
    v = Math.hypot(f - n.x, S - n.z);
  if (v <= 1e-9) return null;
  let m = { x: (f - n.x) / v, z: (S - n.z) / v };
  return e.x * m.x + e.z * m.z >= -1e-9 ? null : { ...m, time: p };
}
function IG(t, e, n, i) {
  let r = w_(t, n),
    a = tN(e, n.rotation),
    o = null,
    s = (h, d, p) => {
      if (h < -1e-7 || h > 1 + 1e-7 || a.x * d.x + a.z * d.z >= -1e-9) return;
      let f = Math.max(0, Math.min(1, h));
      (!o ||
        f < o.time - 1e-7 ||
        (Math.abs(f - o.time) <= 1e-7 && p < o.rank)) &&
        (o = { ...d, time: f, rank: p });
    };
  if (Math.abs(a.x) > 1e-9)
    for (let h of [-1, 1]) {
      let p = (h * (n.halfWidth + i) - r.x) / a.x,
        f = r.z + a.z * p;
      f >= -n.halfDepth - 1e-9 &&
        f <= n.halfDepth + 1e-9 &&
        s(p, { x: h, z: 0 }, h < 0 ? 0 : 1);
    }
  if (Math.abs(a.z) > 1e-9)
    for (let h of [-1, 1]) {
      let p = (h * (n.halfDepth + i) - r.z) / a.z,
        f = r.x + a.x * p;
      f >= -n.halfWidth - 1e-9 &&
        f <= n.halfWidth + 1e-9 &&
        s(p, { x: 0, z: h }, h < 0 ? 2 : 3);
    }
  let l = a.x * a.x + a.z * a.z;
  for (let h of [-1, 1])
    for (let d of [-1, 1]) {
      let p = h * n.halfWidth,
        f = d * n.halfDepth,
        S = r.x - p,
        v = r.z - f,
        m = S * a.x + v * a.z,
        y = S * S + v * v - i * i,
        x = m * m - l * y;
      if (x < 0) continue;
      let g = (-m - Math.sqrt(Math.max(0, x))) / l;
      if (g < -1e-7 || g > 1 + 1e-7) continue;
      let E = r.x + a.x * g,
        M = r.z + a.z * g;
      if (E * h < n.halfWidth - 1e-9 || M * d < n.halfDepth - 1e-9) continue;
      let _ = Math.hypot(E - p, M - f);
      _ <= 1e-9 ||
        s(
          g,
          { x: (E - p) / _, z: (M - f) / _ },
          4 + (h > 0 ? 2 : 0) + (d > 0 ? 1 : 0),
        );
    }
  let c = o;
  return c ? { ...nN(c, n.rotation), time: c.time } : null;
}
function NG(t, e, n, i) {
  let r = null;
  for (let a of n) {
    if (!lf(a) || !RG(t, e, a, i + 1e-4)) continue;
    let o = a.shape === "circle" ? DG(t, e, a, i) : IG(t, e, a, i);
    o &&
      (!r ||
        o.time < r.time - 1e-7 ||
        (Math.abs(o.time - r.time) <= 1e-7 && a.id < r.id)) &&
      (r = { ...o, id: a.id });
  }
  return r;
}
function vc(t, e, n, i) {
  let r = gc(t) ? t : { x: 0, z: 0 },
    a = gc(e) ? e : r,
    o = Number.isFinite(i) && i >= 0 ? i : 0,
    s = { x: a.x - r.x, z: a.z - r.z },
    l = eN(r, n, o),
    c = { ...s };
  for (let u = 0; u < 8 && !(c.x * c.x + c.z * c.z <= 1e-9); u += 1) {
    let h = NG(l, c, n, o);
    if (!h) {
      ((l.x += c.x), (l.z += c.z), (c.x = 0), (c.z = 0));
      break;
    }
    ((l.x += c.x * h.time + h.x * 1e-4), (l.z += c.z * h.time + h.z * 1e-4));
    let d = Math.max(0, 1 - h.time);
    ((c.x *= d), (c.z *= d));
    let p = c.x * h.x + c.z * h.z;
    p < 0 && ((c.x -= h.x * p), (c.z -= h.z * p));
  }
  return eN(l, n, o);
}
function nl(t, e, n) {
  return !gc(t) || !Number.isFinite(n) || n < 0
    ? !1
    : e.every((i) => dN(t, i, n) === null);
}
var Xo = ["firstPerson", "thirdPerson", "isometric"],
  PG = 0,
  T_ = 96,
  mN = 1.15,
  uf = 15,
  R_ = 45,
  C_ = 70,
  Md = 56,
  rl = Object.freeze({
    firstPerson: {
      label: "FIRST PERSON",
      distance: 0,
      description: "Eye-level field view",
    },
    thirdPerson: {
      label: "THIRD PERSON",
      distance: 6.5,
      description: "Over-shoulder follow view",
    },
    isometric: {
      label: "ISOMETRIC",
      distance: 32,
      description: "Elevated survey view",
    },
  }),
  Ed = 0.22,
  LG = 0.18,
  hN = 0.55,
  pN = 0.005,
  OG = 0.5,
  zG = 0.18;
function il(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function ay(t, e, n) {
  if (e <= t) return n >= e ? 1 : 0;
  let i = il((n - t) / (e - t), 0, 1);
  return i * i * (3 - 2 * i);
}
function fN(t, e, n, i) {
  return !Number.isFinite(i) || i <= 0
    ? t
    : THREE.MathUtils.lerp(t, e, 1 - Math.exp(-n * Math.min(i, 0.1)));
}
function Yo(t) {
  return typeof t == "number" && Number.isFinite(t)
    ? il(t, PG, T_)
    : rl.firstPerson.distance;
}
function _d(t) {
  return typeof t == "number" && Number.isFinite(t) ? il(t, R_, C_) : Md;
}
function oy(t) {
  let e = Yo(t);
  return e <= mN ? "firstPerson" : e < uf ? "thirdPerson" : "isometric";
}
function A_(t) {
  return rl[t].distance;
}
function gN(t) {
  let e = oy(t),
    n = Xo.indexOf(e);
  return A_(Xo[(n + 1) % Xo.length]);
}
function vN(t, e) {
  let n = Yo(t);
  if (!Number.isFinite(e) || Math.abs(e) < 0.01) return n;
  let i = il(e, -480, 480),
    r = 0.014 + n * 0.0018;
  return Yo(n + i * r);
}
function UG(t) {
  return (
    t.minY !== void 0 &&
    t.maxY !== void 0 &&
    Number.isFinite(t.minY) &&
    Number.isFinite(t.maxY)
  );
}
function FG(t, e, n) {
  let i = Math.cos(e);
  return n.set(-Math.sin(t) * i, Math.sin(e), -Math.cos(t) * i);
}
var CameraRig = class {
  constructor(e = 0, n = Md) {
    this.focus = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.presentedPosition = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3();
    this.viewDirection = new THREE.Vector3();
    this.cameraToAim = new THREE.Vector3();
    ((this.targetDistance = Yo(e)),
      (this.smoothedDistance = this.targetDistance),
      (this.presentedDistance = this.targetDistance),
      (this.isometricAngleDegrees = _d(n)),
      (this.diagnosticsState = {
        mode: oy(this.targetDistance),
        targetDistance: this.targetDistance,
        distance: this.presentedDistance,
        collisionLimited: !1,
        isometricAngleDegrees: this.isometricAngleDegrees,
        effectiveFov: 67,
      }));
  }
  get diagnostics() {
    return { ...this.diagnosticsState };
  }
  setDistance(e, n = !1) {
    return (
      (this.targetDistance = Yo(e)),
      n &&
        ((this.smoothedDistance = this.targetDistance),
        (this.presentedDistance = this.targetDistance)),
      (this.diagnosticsState = {
        ...this.diagnosticsState,
        mode: oy(this.targetDistance),
        targetDistance: this.targetDistance,
        distance: n ? this.targetDistance : this.diagnosticsState.distance,
        collisionLimited:
          this.targetDistance <= 1e-4
            ? !1
            : this.diagnosticsState.collisionLimited,
      }),
      this.targetDistance
    );
  }
  setIsometricAngle(e) {
    return (
      (this.isometricAngleDegrees = _d(e)),
      (this.diagnosticsState = {
        ...this.diagnosticsState,
        isometricAngleDegrees: this.isometricAngleDegrees,
      }),
      this.isometricAngleDegrees
    );
  }
  projectGameplayAim(e, n, i = 8) {
    let r = Number.isFinite(i) ? il(i, 1, 24) : 8;
    (e.updateMatrixWorld(!0),
      n.updateMatrixWorld(!0),
      e.getWorldDirection(this.aimDirection),
      this.aimPoint.copy(e.position).addScaledVector(this.aimDirection, r),
      this.cameraToAim.copy(this.aimPoint).sub(n.position).normalize(),
      n.getWorldDirection(this.viewDirection));
    let a = this.cameraToAim.dot(this.viewDirection) > 0;
    return (
      this.aimPoint.project(n),
      !Number.isFinite(this.aimPoint.x) ||
      !Number.isFinite(this.aimPoint.y) ||
      !Number.isFinite(this.aimPoint.z)
        ? null
        : {
            visible: a && this.aimPoint.z >= -1 && this.aimPoint.z <= 1,
            xPercent: il(50 + this.aimPoint.x * 50, 8, 92),
            yPercent: il(50 - this.aimPoint.y * 50, 8, 88),
          }
    );
  }
  present(e) {
    let n = Number.isFinite(e.deltaSeconds) ? Math.max(0, e.deltaSeconds) : 0;
    e.snap
      ? ((this.smoothedDistance = this.targetDistance),
        (this.presentedDistance = this.targetDistance))
      : ((this.smoothedDistance = fN(
          this.smoothedDistance,
          this.targetDistance,
          9,
          n,
        )),
        this.targetDistance === 0 &&
          this.smoothedDistance < pN &&
          (this.smoothedDistance = 0));
    let i = oy(this.targetDistance),
      r = ay(uf * 0.72, uf * 1.75, this.smoothedDistance),
      a = THREE.MathUtils.lerp(
        e.pitch,
        il(e.pitch, -1.08, 0.58),
        ay(0, 3.2, this.smoothedDistance),
      ),
      o = -THREE.MathUtils.degToRad(this.isometricAngleDegrees),
      s = THREE.MathUtils.lerp(a, o, r),
      l = ay(mN, 3.2, this.smoothedDistance);
    (this.focus.set(
      e.playerPosition.x,
      e.playerPosition.y + e.eyeHeight,
      e.playerPosition.z,
    ),
      FG(e.yaw, s, this.forward),
      this.right.set(Math.cos(e.yaw), 0, -Math.sin(e.yaw)),
      this.desiredPosition
        .copy(this.focus)
        .addScaledVector(this.forward, -this.smoothedDistance)
        .addScaledVector(this.right, OG * l * (1 - r)),
      (this.desiredPosition.y += zG * l * (1 - r)));
    let c = this.smoothedDistance,
      u = !1;
    if (this.smoothedDistance > 1e-4) {
      let m = Math.min(this.focus.y, this.desiredPosition.y),
        y = Math.max(this.focus.y, this.desiredPosition.y),
        x = e.world
          .queryColliders(this.focus, this.desiredPosition, Ed, m - Ed, y + Ed)
          .filter(UG),
        g = this.focus,
        E = this.desiredPosition,
        M = sN(g, E, x, Ed),
        _ = lN(
          g,
          E,
          (R, C) => e.world.sampleGroundHeight(R, C, e.playerPosition.y),
          Ed,
          hN,
        ),
        b = cN(
          g,
          E,
          (R, C, P) => e.world.sampleOverheadHeight(R, C, P),
          Ed,
          hN,
        ),
        T = Math.min(M ?? 1, _ ?? 1, b ?? 1);
      T < 1 && ((u = !0), (c = Math.max(0, this.smoothedDistance * T - LG)));
    }
    (e.snap || u || c < this.presentedDistance
      ? (this.presentedDistance = c)
      : (this.presentedDistance = fN(this.presentedDistance, c, 6.5, n)),
      this.targetDistance === 0 &&
        this.presentedDistance < pN &&
        (this.presentedDistance = 0));
    let h =
      this.smoothedDistance > 1e-4
        ? this.presentedDistance / this.smoothedDistance
        : 0;
    this.presentedPosition.copy(this.focus).lerp(this.desiredPosition, h);
    let d = ay(uf * 0.72, uf * 1.75, this.presentedDistance),
      p = THREE.MathUtils.lerp(e.baseFov, Math.min(e.baseFov, 48), d),
      f = e.baseFar + this.presentedDistance,
      S = Math.min(
        THREE.MathUtils.lerp(0.08, 0.32, d),
        Math.max(0.08, this.presentedDistance * 0.35),
      );
    this.presentedDistance <= 1e-4
      ? (e.renderCamera.position.copy(e.playerCamera.position),
        e.renderCamera.quaternion.copy(e.playerCamera.quaternion))
      : (e.renderCamera.position.copy(this.presentedPosition),
        e.renderCamera.rotation.set(s, e.yaw, 0, "YXZ"));
    let v =
      Math.abs(e.renderCamera.fov - p) > 0.001 ||
      Math.abs(e.renderCamera.far - f) > 0.001 ||
      Math.abs(e.renderCamera.near - S) > 0.001;
    return (
      (e.renderCamera.fov = p),
      (e.renderCamera.far = f),
      (e.renderCamera.near = S),
      v && e.renderCamera.updateProjectionMatrix(),
      e.renderCamera.updateMatrixWorld(!0),
      (this.diagnosticsState = {
        mode: i,
        targetDistance: this.targetDistance,
        distance: this.presentedDistance,
        collisionLimited: u,
        isometricAngleDegrees: this.isometricAngleDegrees,
        effectiveFov: p,
      }),
      this.diagnostics
    );
  }
};
var D_ = ["compact", "standard", "large", "extraLarge"],
  yN = Object.freeze({
    compact: {
      label: "COMPACT",
      percentage: 90,
      description: "Maximum HUD density",
    },
    standard: {
      label: "STANDARD",
      percentage: 100,
      description: "Readable default",
    },
    large: {
      label: "LARGE",
      percentage: 120,
      description: "Larger field text",
    },
    extraLarge: {
      label: "X-LARGE",
      percentage: 140,
      description: "Maximum legibility",
    },
  }),
  KEY_BINDING_ACTIONS = [
    "moveForward",
    "moveBackward",
    "moveLeft",
    "moveRight",
    "sprint",
    "crouch",
    "jump",
    "interact",
    "harvest",
    "flashlight",
    "map",
    "inventory",
    "scanner",
    "fieldGuide",
    "quality",
    "cameraView",
    "recover",
  ],
  DEFAULT_KEY_BINDINGS = Object.freeze({
    moveForward: "KeyW",
    moveBackward: "KeyS",
    moveLeft: "KeyA",
    moveRight: "KeyD",
    sprint: "ShiftLeft",
    crouch: "ControlLeft",
    jump: "Space",
    interact: "KeyE",
    harvest: "KeyF",
    flashlight: "KeyL",
    map: "KeyM",
    inventory: "KeyI",
    scanner: "KeyG",
    fieldGuide: "KeyJ",
    quality: "KeyQ",
    cameraView: "KeyV",
    recover: "KeyR",
  }),
  DEFAULT_SETTINGS = Object.freeze({
    interfaceScale: "standard",
    fov: 67,
    lookSensitivity: 1,
    invertY: !1,
    masterVolume: 0.72,
    ambientVolume: 0.66,
    effectsVolume: 0.8,
    quality: "cinematic",
    horizonMode: "standard",
    worldDetail: tp,
    cameraDistance: 0,
    isometricAngle: Md,
    keyBindings: DEFAULT_KEY_BINDINGS,
  }),
  KEY_BINDING_LABELS = {
    moveForward: "Move forward",
    moveBackward: "Move backward",
    moveLeft: "Move left",
    moveRight: "Move right",
    sprint: "Sprint",
    crouch: "Crouch",
    jump: "Jump",
    interact: "Use / inspect",
    harvest: "Harvest",
    flashlight: "Phone light",
    map: "Map",
    inventory: "Inventory",
    scanner: "Field scanner",
    fieldGuide: "Field operations",
    quality: "Quality profile",
    cameraView: "Camera view",
    recover: "Recover",
  },
  kG =
    /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Space|Tab|Enter|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right))$/;
function df(t, e, n, i) {
  return typeof t == "number" && Number.isFinite(t)
    ? Math.min(i, Math.max(n, t))
    : e;
}
function BG(t) {
  return D_.includes(t);
}
function xN(t) {
  return typeof t == "string" && kG.test(t);
}
function GG(t) {
  let e = t && typeof t == "object" && !Array.isArray(t) ? t : {},
    n = { ...DEFAULT_KEY_BINDINGS };
  for (let i of KEY_BINDING_ACTIONS) {
    let r = e[i];
    xN(r) && (n = I_(n, i, r) ?? n);
  }
  return n;
}
function Nr(t, e = DEFAULT_SETTINGS.horizonMode) {
  let n = t && typeof t == "object" && !Array.isArray(t) ? t : {};
  return {
    interfaceScale: BG(n.interfaceScale)
      ? n.interfaceScale
      : DEFAULT_SETTINGS.interfaceScale,
    fov: df(n.fov, DEFAULT_SETTINGS.fov, 55, 95),
    lookSensitivity: df(
      n.lookSensitivity,
      DEFAULT_SETTINGS.lookSensitivity,
      0.25,
      2.5,
    ),
    invertY:
      typeof n.invertY == "boolean" ? n.invertY : DEFAULT_SETTINGS.invertY,
    masterVolume: df(n.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
    ambientVolume: df(n.ambientVolume, DEFAULT_SETTINGS.ambientVolume, 0, 1),
    effectsVolume: df(n.effectsVolume, DEFAULT_SETTINGS.effectsVolume, 0, 1),
    quality: isQualityProfile(n.quality) ? n.quality : DEFAULT_SETTINGS.quality,
    horizonMode:
      n.horizonMode === "standard" ||
      n.horizonMode === "extended" ||
      n.horizonMode === "unlimited"
        ? n.horizonMode
        : e,
    worldDetail: zu(n.worldDetail),
    cameraDistance: Yo(n.cameraDistance),
    isometricAngle: _d(n.isometricAngle),
    keyBindings: GG(n.keyBindings),
  };
}
function I_(t, e, n) {
  if (!xN(n)) return null;
  let i = { ...t },
    r = i[e],
    a = KEY_BINDING_ACTIONS.find((o) => o !== e && i[o] === n);
  return ((i[e] = n), a && (i[a] = r), i);
}
function N_(t) {
  return KEY_BINDING_LABELS[t];
}
function keyLabel(t) {
  return t.startsWith("Key")
    ? t.slice(3)
    : t.startsWith("Digit")
      ? t.slice(5)
      : t
          .replace("Control", "CTRL ")
          .replace("Shift", "SHIFT ")
          .replace("Arrow", "")
          .replace("Left", "L")
          .replace("Right", "R")
          .toUpperCase();
}
// Button prompts for whichever device the player used last (kit.input.source).
var PAD_GLYPHS = {
    jump: "A",
    crouch: "B",
    use: "X",
    interact: "X",
    harvest: "X",
    scanner: "LT",
    flashlight: "Y",
    map: "VIEW",
    inventory: "D-PAD \u25C0",
    fieldGuide: "D-PAD \u25B6",
    cameraView: "RS",
    sprint: "LB",
    pause: "START",
    recover: "A",
    zoom: "D-PAD \u25B2\u25BC",
  },
  TOUCH_GLYPHS = {
    jump: "JUMP",
    crouch: "CROUCH",
    use: "USE",
    interact: "USE",
    harvest: "USE",
    scanner: "SCAN",
    flashlight: "LIGHT",
    map: "MAP",
    cameraView: "VIEW",
    sprint: "RUN",
    pause: "II",
    recover: "TAP",
    zoom: "PINCH",
  };
var PAD_STRIP = [
  ["LS", "MOVE"],
  ["RS", "LOOK"],
  ["A", "JUMP"],
  ["B", "CROUCH"],
  ["LB", "SPRINT"],
  ["X", "USE"],
  ["RT", "HARVEST"],
  ["LT", "SCAN"],
  ["Y", "LIGHT"],
  ["RS \u25CF", "VIEW"],
  ["D-PAD \u25B2\u25BC", "ZOOM"],
  ["VIEW", "MAP"],
  ["D-PAD \u25C0", "KIT"],
  ["D-PAD \u25B6", "OPS"],
  ["START", "PAUSE"],
];
function controlGlyph(t, e, n) {
  return t === "gamepad"
    ? (PAD_GLYPHS[e] ?? "")
    : t === "touch"
      ? (TOUCH_GLYPHS[e] ?? "")
      : keyLabel(n?.[e] ?? "");
}
var k = ut(Ht(), 1),
  VG = [
    { label: "DAWN", time: "06:00", minutes: 360 },
    { label: "NOON", time: "12:00", minutes: 720 },
    { label: "DUSK", time: "18:00", minutes: 1080 },
    { label: "MIDNIGHT", time: "00:00", minutes: 0 },
  ];
function WG(t, e) {
  return `${String(t).padStart(2, "0")}:${String(e).padStart(2, "0")}`;
}
function bN(t) {
  return t >= 1e3
    ? `${(t / 1e3).toFixed(t >= 1e4 ? 0 : 1)} KM`
    : `${Math.round(t)} M`;
}
var XG = {
  standard: "LOCAL HLOD / WEATHER-AUTHENTIC",
  extended: "REGIONAL HLOD / RECOMMENDED",
  unlimited: "FINITE ATLAS / MAXIMUM HORIZON",
};
function DeveloperPanel({
  snapshot: t,
  onClose: e,
  onSetEnabled: n,
  onSetTime: i,
  onAdvanceTime: r,
  onSetClockPaused: a,
  onSetWeather: o,
  onSetHorizonMode: s,
  onSetHealth: l,
  onApplyFall: c,
  onRecover: u,
  onSetInvincible: h,
  onSetSpeedMode: d,
  onSetFly: p,
  onSetCameraView: f,
  onTravelToForestStressTest: S,
  onSetForestStressLevel: v,
  onSetGraphicsBenchmarkTarget: m,
  onStartGraphicsBenchmark: y,
  onCancelGraphicsBenchmark: x,
  onSetGraphicsFeature: g,
  onReset: E,
}) {
  let M = (0, Ea.useRef)(null),
    _ = (0, Ea.useRef)(null),
    b = (0, Ea.useRef)(v),
    T = t.environment.hour * 60 + t.environment.minute,
    R = t.devTools.weatherOverride,
    C = t.graphicsBenchmark,
    P =
      C.phase === "warming" ||
      C.phase === "sampling" ||
      C.phase === "finalizing",
    [B, L] = (0, Ea.useState)(t.forestStress.level),
    [O, G] = (0, Ea.useState)(""),
    F = No[B] ?? No[0];
  ((0, Ea.useEffect)(() => {
    b.current = v;
  }, [v]),
    (0, Ea.useEffect)(() => {
      if (P || B === t.forestStress.level) return;
      let H = window.setTimeout(() => b.current(B), 220);
      return () => window.clearTimeout(H);
    }, [P, B, t.forestStress.level]));
  let W = async () => {
    if (!C.context || C.phase !== "complete") return;
    let H = {
      capturedAt: C.context.capturedAt,
      captureContext: C.context,
      graphicsBenchmark: C,
    };
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      (await navigator.clipboard.writeText(JSON.stringify(H, null, 2)),
        G("REPORT COPIED"));
    } catch {
      G("COPY FAILED");
    }
  };
  (0, Ea.useEffect)(() => {
    let H = document.activeElement;
    return (_.current?.focus(), () => H?.focus?.());
  }, []);
  let U = (H) => {
    if (H.key === "Escape") {
      (H.preventDefault(), H.stopPropagation(), e());
      return;
    }
    Kr(H, M.current);
  };
  return (0, k.jsxs)("div", {
    className: "dev-overlay",
    "data-testid": "developer-overlay",
    children: [
      (0, k.jsx)("button", {
        type: "button",
        className: "dev-click-shield",
        "aria-label": "Close developer tools",
        tabIndex: -1,
        onClick: e,
      }),
      (0, k.jsxs)("section", {
        ref: M,
        className: `dev-panel ${t.devTools.enabled ? "is-enabled" : ""}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "developer-panel-title",
        "data-testid": "developer-panel",
        onKeyDown: U,
        children: [
          (0, k.jsxs)("header", {
            className: "dev-panel-header",
            children: [
              (0, k.jsxs)("div", {
                children: [
                  (0, k.jsx)("p", {
                    className: "eyebrow",
                    children: "PLAYTEST CONSOLE / DEV-01",
                  }),
                  (0, k.jsx)("h2", {
                    id: "developer-panel-title",
                    ref: _,
                    tabIndex: -1,
                    children: "Developer tools",
                  }),
                ],
              }),
              (0, k.jsxs)("button", {
                type: "button",
                className: "dev-close",
                onClick: e,
                children: [
                  "CLOSE ",
                  (0, k.jsx)("span", {
                    "aria-hidden": "true",
                    children: "\xD7",
                  }),
                ],
              }),
            ],
          }),
          (0, k.jsxs)("div", {
            className: "dev-panel-body",
            children: [
              (0, k.jsxs)("div", {
                className: "dev-panel-column dev-panel-column-primary",
                children: [
                  (0, k.jsxs)("div", {
                    className: "dev-session-notice",
                    role: "note",
                    children: [
                      (0, k.jsx)("span", {
                        "aria-hidden": "true",
                        children: "\u25C7",
                      }),
                      (0, k.jsxs)("p", {
                        children: [
                          (0, k.jsx)("strong", {
                            children:
                              t.sessionMode === "developer"
                                ? "ISOLATED QUICK-START"
                                : "SESSION-ONLY SANDBOX",
                          }),
                          t.sessionMode === "developer"
                            ? " This fresh developer world cannot overwrite the normal survey save. Rendering preferences remain local."
                            : " Time, weather, player sandbox, load-lab, and capture state are session-only. Rendering preferences are saved locally.",
                        ],
                      }),
                    ],
                  }),
                  (0, k.jsxs)("button", {
                    type: "button",
                    className: `dev-master ${t.devTools.enabled ? "is-active" : ""}`,
                    "aria-pressed": t.devTools.enabled,
                    "data-testid": "developer-mode-toggle",
                    onClick: () => n(!t.devTools.enabled),
                    children: [
                      (0, k.jsxs)("span", {
                        children: [
                          (0, k.jsx)("small", { children: "DEVELOPER MODE" }),
                          (0, k.jsx)("strong", {
                            children: t.devTools.enabled
                              ? "ENABLED"
                              : "DISABLED",
                          }),
                        ],
                      }),
                      (0, k.jsx)("i", {
                        "aria-hidden": "true",
                        children: (0, k.jsx)("b", {}),
                      }),
                    ],
                  }),
                  (0, k.jsxs)("fieldset", {
                    className: "dev-rendering",
                    children: [
                      (0, k.jsx)("legend", {
                        children: "RENDERING / SAVED LOCALLY",
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-horizon-heading",
                        children: [
                          (0, k.jsx)("span", { children: "WORLD HORIZON" }),
                          (0, k.jsx)("strong", {
                            children: HORIZON_PROFILES[t.horizonMode].label,
                          }),
                        ],
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-horizon-grid",
                        role: "radiogroup",
                        "aria-label": "World horizon distance",
                        children: Object.keys(HORIZON_PROFILES).map((H) =>
                          (0, k.jsxs)(
                            "button",
                            {
                              type: "button",
                              className: t.horizonMode === H ? "is-active" : "",
                              "aria-pressed": t.horizonMode === H,
                              "data-testid": `horizon-mode-${H}`,
                              onClick: () => s(H),
                              children: [
                                (0, k.jsx)("span", {
                                  children: HORIZON_PROFILES[H].label,
                                }),
                                (0, k.jsx)("strong", {
                                  children: bN(
                                    HORIZON_PROFILES[H].drawDistanceMeters,
                                  ),
                                }),
                                (0, k.jsx)("small", { children: XG[H] }),
                              ],
                            },
                            H,
                          ),
                        ),
                      }),
                      (0, k.jsxs)("p", {
                        className: "dev-horizon-status",
                        "data-testid": "developer-horizon-status",
                        children: [
                          (0, k.jsxs)("span", {
                            children: ["FULL DETAIL ", t.loadedChunks],
                          }),
                          (0, k.jsxs)("span", {
                            children: ["HLOD ", t.horizonTiles],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "FAR TRIS ",
                              Math.round(t.horizonTriangles).toLocaleString(),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "LOD ",
                              ha[t.settings.worldDetail].label,
                              " / ",
                              t.horizonNearCellSize,
                              " M",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: ["SCENERY ", t.horizonSceneryInstances],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "SETTLEMENTS ",
                              t.horizonSettlementInstances,
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "CITY LIGHTS ",
                              t.horizonSettlementLightInstances,
                            ],
                          }),
                          (0, k.jsxs)("strong", {
                            children: [
                              "OPTICAL ",
                              bN(t.environment.visibilityMeters),
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsx)("p", {
                        className: "dev-horizon-note",
                        children:
                          "Weather remains the final visibility limit. Distant terrain and settlement silhouettes carry no interiors, objects, collision, citizens, or shadows.",
                      }),
                    ],
                  }),
                  (0, k.jsxs)("fieldset", {
                    className: "dev-graphics-features",
                    disabled: !t.devTools.enabled,
                    children: [
                      (0, k.jsx)("legend", {
                        children: "GRAPHICS MODULES / SESSION A-B",
                      }),
                      (0, k.jsx)("p", {
                        className: "dev-horizon-note",
                        children:
                          "Toggle one module at a time, close the panel, and compare the same viewpoint. Captures record the active module state.",
                      }),
                      (0, k.jsxs)("p", {
                        className: "dev-horizon-status",
                        "data-testid": "graphics-pipeline-status",
                        children: [
                          (0, k.jsxs)("span", {
                            children: [
                              "PIPELINE ",
                              t.graphicsPipeline.postProcessing
                                ? "COMPOSITOR"
                                : "DIRECT",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "BLOOM ",
                              t.graphicsPipeline.bloom ? "ACTIVE" : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "GTAO ",
                              t.graphicsPipeline.gtao ? "ACTIVE" : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "GRADE ",
                              t.graphicsPipeline.grading ? "ACTIVE" : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "PMREM ",
                              t.graphicsPipeline.environmentReflections
                                ? "ACTIVE"
                                : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "CLOUD SHADE ",
                              t.devTools.graphicsFeatures.cloudShadows
                                ? "ACTIVE"
                                : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "WET ",
                              t.devTools.graphicsFeatures.wetSurfaces
                                ? "ACTIVE"
                                : "OFF",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "LIGHTNING ",
                              t.devTools.graphicsFeatures.stormLightning
                                ? "ACTIVE"
                                : "OFF",
                            ],
                          }),
                          (0, k.jsx)("strong", {
                            children: t.graphicsPipeline.fallback
                              ? "SAFE FALLBACK"
                              : "NOMINAL",
                          }),
                        ],
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-feature-grid",
                        children: sD.map((H) => {
                          let ne = t.devTools.graphicsFeatures[H.id];
                          return (0, k.jsxs)(
                            "button",
                            {
                              type: "button",
                              className: ne ? "is-active" : "",
                              "aria-pressed": ne,
                              "data-testid": `graphics-feature-${H.id}`,
                              onClick: () => g(H.id, !ne),
                              children: [
                                (0, k.jsx)("span", { children: H.label }),
                                (0, k.jsx)("strong", {
                                  children: ne ? "ON" : "OFF",
                                }),
                                (0, k.jsx)("small", {
                                  children: H.description,
                                }),
                              ],
                            },
                            H.id,
                          );
                        }),
                      }),
                    ],
                  }),
                ],
              }),
              (0, k.jsxs)("div", {
                className: "dev-panel-column dev-panel-column-secondary",
                children: [
                  (0, k.jsxs)("fieldset", {
                    className: "dev-performance",
                    disabled: !t.devTools.enabled,
                    children: [
                      (0, k.jsx)("legend", {
                        children: "PERFORMANCE LAB / DEVELOPER OPT-IN",
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-lab-heading",
                        children: [
                          (0, k.jsxs)("div", {
                            children: [
                              (0, k.jsx)("span", {
                                children: "CANOPY LOAD LAB",
                              }),
                              (0, k.jsx)("strong", {
                                children: "DENSE FOREST + SHALLOW LAKE",
                              }),
                            ],
                          }),
                          (0, k.jsx)("b", {
                            className: t.forestStress.active ? "is-active" : "",
                            children: t.forestStress.active
                              ? "ACTIVE"
                              : "STANDBY",
                          }),
                        ],
                      }),
                      (0, k.jsx)("p", {
                        className: "dev-horizon-note",
                        children:
                          "Render-only instancing and three tree LODs. No extra AI, targets, harvest state, collision, or discovery records.",
                      }),
                      (0, k.jsxs)("button", {
                        type: "button",
                        className: "dev-lab-travel",
                        "data-testid": "forest-stress-travel",
                        onClick: S,
                        children: [
                          "TRAVEL TO TEST SITE ",
                          (0, k.jsx)("span", {
                            children: "GRID 64:-60 \u2197",
                          }),
                        ],
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-control-heading",
                        children: [
                          (0, k.jsx)("label", {
                            htmlFor: "forest-stress-level",
                            children: "FOREST LOAD",
                          }),
                          (0, k.jsxs)("output", {
                            htmlFor: "forest-stress-level",
                            children: [
                              F.label,
                              B !== t.forestStress.level ? " / QUEUED" : "",
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsx)("input", {
                        id: "forest-stress-level",
                        "data-testid": "forest-stress-level",
                        className: "dev-time-slider",
                        type: "range",
                        min: "0",
                        max: No.length - 1,
                        step: "1",
                        value: B,
                        disabled: P,
                        "aria-valuetext": `${F.label}: ${F.trees.toLocaleString()} trees and ${F.groundcover.toLocaleString()} understory instances`,
                        onChange: (H) => {
                          (L(Number(H.currentTarget.value)), G(""));
                        },
                        onPointerUp: (H) => v(Number(H.currentTarget.value)),
                        onBlur: (H) => v(Number(H.currentTarget.value)),
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-load-scale",
                        "aria-hidden": "true",
                        children: No.map((H) =>
                          (0, k.jsx)("span", { children: H.label }, H.id),
                        ),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-lab-counts",
                        "data-testid": "forest-stress-counts",
                        children: [
                          (0, k.jsxs)("span", {
                            children: [
                              "TREES ",
                              (0, k.jsx)("strong", {
                                children: t.forestStress.trees.toLocaleString(),
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "UNDERSTORY ",
                              (0, k.jsx)("strong", {
                                children:
                                  t.forestStress.groundcover.toLocaleString(),
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "ROCKS ",
                              (0, k.jsx)("strong", {
                                children: t.forestStress.rocks.toLocaleString(),
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "REEDS ",
                              (0, k.jsx)("strong", {
                                children: t.forestStress.reeds.toLocaleString(),
                              }),
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsxs)("div", {
                        className:
                          "dev-control-heading dev-benchmark-target-heading",
                        children: [
                          (0, k.jsx)("label", {
                            htmlFor: "graphics-benchmark-target",
                            children: "CAPTURE TARGET",
                          }),
                          (0, k.jsxs)("output", {
                            htmlFor: "graphics-benchmark-target",
                            children: [
                              C.targetFps,
                              " HZ / ",
                              C.budgetMs.toFixed(2),
                              " MS",
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsx)("select", {
                        id: "graphics-benchmark-target",
                        "data-testid": "graphics-benchmark-target",
                        value: C.targetFps,
                        disabled: P,
                        onChange: (H) => m(Number(H.currentTarget.value)),
                        children: s1.map((H) =>
                          (0, k.jsxs)(
                            "option",
                            { value: H, children: [H, " HZ"] },
                            H,
                          ),
                        ),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-benchmark-actions",
                        children: [
                          (0, k.jsx)("button", {
                            type: "button",
                            "data-testid": "graphics-benchmark-start",
                            disabled: P,
                            onClick: y,
                            children: "RUN 10 SEC CAPTURE",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            disabled: !P,
                            onClick: x,
                            children: "CANCEL",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            disabled: C.phase !== "complete",
                            onClick: () => {
                              W();
                            },
                            children: O || "COPY REPORT",
                          }),
                        ],
                      }),
                      (0, k.jsx)("span", {
                        className: "sr-only",
                        role: "status",
                        "aria-live": "polite",
                        children: O,
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-benchmark-results",
                        "data-testid": "graphics-benchmark-results",
                        children: [
                          (0, k.jsxs)("span", {
                            children: [
                              "STATUS ",
                              (0, k.jsx)("strong", {
                                children: C.phase.toUpperCase(),
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "CPU P95 ",
                              (0, k.jsx)("strong", {
                                children: C.cpuWork
                                  ? `${C.cpuWork.p95.toFixed(2)} MS`
                                  : "\u2014",
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "GPU P95 ",
                              (0, k.jsx)("strong", {
                                children: C.gpu
                                  ? `${C.gpu.p95.toFixed(2)} MS`
                                  : P && C.gpuSupported
                                    ? "PENDING"
                                    : "N/A",
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "OBSERVED ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.observedFps === null
                                    ? "\u2014"
                                    : `${C.observedFps.toFixed(1)} HZ`,
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "1% LOW ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.onePercentLowFps?.toFixed(1) ?? "\u2014",
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "HEADROOM ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.headroomPercent === null
                                    ? "\u2014"
                                    : `${C.headroomPercent.toFixed(1)}%`,
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "MISSED ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.missedRefreshPercent === null
                                    ? "\u2014"
                                    : `${C.missedRefreshPercent.toFixed(1)}%`,
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "ENGINE ",
                              (0, k.jsx)("strong", { children: C.grade }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "DELIVERY ",
                              (0, k.jsx)("strong", { children: C.delivery }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "GPU COVERAGE ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.gpuCoveragePercent === null
                                    ? C.gpuMeasurement
                                    : `${C.gpuCoveragePercent.toFixed(1)}%`,
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "CALLS P95 ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.drawCalls?.p95.toLocaleString() ??
                                  t.drawCalls.toLocaleString(),
                              }),
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "TRIS P95 ",
                              (0, k.jsx)("strong", {
                                children:
                                  C.triangles?.p95.toLocaleString() ??
                                  t.triangles.toLocaleString(),
                              }),
                            ],
                          }),
                        ],
                      }),
                      C.context &&
                        C.phase === "complete" &&
                        (0, k.jsxs)("p", {
                          className: "dev-benchmark-context",
                          children: [
                            "CAPTURED ",
                            C.context.forest.label,
                            " \xB7 ",
                            C.context.quality.toUpperCase(),
                            " \xB7 ",
                            C.context.resolution.width,
                            "\xD7",
                            C.context.resolution.height,
                            " \xB7 ",
                            C.context.environment.weatherLabel.toUpperCase(),
                          ],
                        }),
                      (0, k.jsx)("p", {
                        className: "dev-benchmark-footnote",
                        children: t.gpuTimerSupported
                          ? "GPU timer online \xB7 coverage is validated before grading. Use the fixed arrival viewpoint and stand still for directly comparable runs."
                          : "GPU timer unavailable \xB7 result is a CPU-only estimate. Use the fixed arrival viewpoint and stand still for directly comparable runs.",
                      }),
                    ],
                  }),
                  (0, k.jsxs)("fieldset", {
                    className: "dev-environment",
                    disabled: !t.devTools.enabled,
                    children: [
                      (0, k.jsx)("legend", { children: "ENVIRONMENT" }),
                      (0, k.jsxs)("div", {
                        className: "dev-control-heading",
                        children: [
                          (0, k.jsx)("label", {
                            htmlFor: "developer-time",
                            children: "TIME OF DAY",
                          }),
                          (0, k.jsx)("output", {
                            htmlFor: "developer-time",
                            "data-testid": "developer-time-output",
                            children: WG(
                              t.environment.hour,
                              t.environment.minute,
                            ),
                          }),
                        ],
                      }),
                      (0, k.jsx)("input", {
                        id: "developer-time",
                        "data-testid": "developer-time",
                        className: "dev-time-slider",
                        type: "range",
                        min: "0",
                        max: "1439",
                        step: "5",
                        value: T,
                        onChange: (H) => i(Number(H.currentTarget.value)),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-time-scale",
                        "aria-hidden": "true",
                        children: [
                          (0, k.jsx)("span", { children: "00:00" }),
                          (0, k.jsx)("span", { children: "06:00" }),
                          (0, k.jsx)("span", { children: "12:00" }),
                          (0, k.jsx)("span", { children: "18:00" }),
                          (0, k.jsx)("span", { children: "24:00" }),
                        ],
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-preset-grid",
                        children: VG.map((H) =>
                          (0, k.jsxs)(
                            "button",
                            {
                              type: "button",
                              onClick: () => i(H.minutes),
                              children: [
                                (0, k.jsx)("span", { children: H.label }),
                                (0, k.jsx)("small", { children: H.time }),
                              ],
                            },
                            H.label,
                          ),
                        ),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-inline-controls",
                        children: [
                          (0, k.jsx)("button", {
                            type: "button",
                            onClick: () => r(-60),
                            children: "\u2212 1 HOUR",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            className: t.devTools.clockPaused
                              ? "is-active"
                              : "",
                            "aria-pressed": t.devTools.clockPaused,
                            "data-testid": "developer-clock-toggle",
                            onClick: () => a(!t.devTools.clockPaused),
                            children: t.devTools.clockPaused
                              ? "CLOCK FROZEN"
                              : "CLOCK RUNNING",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            onClick: () => r(60),
                            children: "+ 1 HOUR",
                          }),
                        ],
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-weather-control",
                        children: [
                          (0, k.jsxs)("div", {
                            className: "dev-control-heading",
                            children: [
                              (0, k.jsxs)("label", {
                                htmlFor: "developer-weather",
                                children: ["WEATHER / ", t.biome.name],
                              }),
                              (0, k.jsx)("span", {
                                children: R ? "FORCED" : "AUTO",
                              }),
                            ],
                          }),
                          (0, k.jsxs)("select", {
                            id: "developer-weather",
                            "data-testid": "developer-weather",
                            value: R ?? "",
                            onChange: (H) =>
                              o(
                                H.currentTarget.value
                                  ? H.currentTarget.value
                                  : null,
                              ),
                            children: [
                              (0, k.jsx)("option", {
                                value: "",
                                children: "AUTO / BIOME SYSTEM",
                              }),
                              t.devTools.weatherOptions.map((H) =>
                                (0, k.jsx)(
                                  "option",
                                  { value: H.id, children: H.label },
                                  H.id,
                                ),
                              ),
                            ],
                          }),
                          (0, k.jsxs)("p", {
                            className: "dev-weather-status",
                            "aria-live": "polite",
                            children: [
                              (0, k.jsx)("strong", {
                                children: t.environment.weatherLabel,
                              }),
                              (0, k.jsxs)("span", {
                                children: [
                                  Math.round(t.environment.temperatureC),
                                  "\xB0C \xB7 ",
                                  Math.round(t.environment.windKph),
                                  " KM/H \xB7 ",
                                  t.environment.precipitation.toUpperCase(),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  (0, k.jsxs)("fieldset", {
                    className: "dev-player-sandbox",
                    disabled: !t.devTools.enabled,
                    children: [
                      (0, k.jsx)("legend", {
                        children: "PLAYER / PLAYTEST SANDBOX",
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-player-toggle-grid",
                        children: [
                          (0, k.jsxs)("button", {
                            type: "button",
                            className: t.devTools.player.invincible
                              ? "is-active"
                              : "",
                            "aria-pressed": t.devTools.player.invincible,
                            "data-testid": "developer-invincible",
                            onClick: () => h(!t.devTools.player.invincible),
                            children: [
                              (0, k.jsx)("span", { children: "INVINCIBLE" }),
                              (0, k.jsx)("strong", {
                                children: t.devTools.player.invincible
                                  ? "ON"
                                  : "OFF",
                              }),
                              (0, k.jsx)("small", {
                                children:
                                  "Blocks gameplay damage and test damage controls.",
                              }),
                            ],
                          }),
                          (0, k.jsxs)("button", {
                            type: "button",
                            className: t.devTools.player.fly ? "is-active" : "",
                            "aria-pressed": t.devTools.player.fly,
                            "data-testid": "developer-fly",
                            onClick: () => p(!t.devTools.player.fly),
                            children: [
                              (0, k.jsx)("span", { children: "FLY / NOCLIP" }),
                              (0, k.jsx)("strong", {
                                children: t.devTools.player.fly ? "ON" : "OFF",
                              }),
                              (0, k.jsx)("small", {
                                children:
                                  "Bypasses gravity, terrain, and building collision.",
                              }),
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-control-heading",
                        children: [
                          (0, k.jsx)("span", {
                            id: "developer-speed-label",
                            children: "MOVEMENT SPEED",
                          }),
                          (0, k.jsxs)("output", {
                            children: [
                              Fu[t.devTools.player.speedMode].multiplier,
                              "\xD7",
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-speed-grid",
                        role: "group",
                        "aria-labelledby": "developer-speed-label",
                        children: c1.map((H) => {
                          let ne = Fu[H],
                            ae = t.devTools.player.speedMode === H;
                          return (0, k.jsxs)(
                            "button",
                            {
                              type: "button",
                              className: ae ? "is-active" : "",
                              "aria-pressed": ae,
                              "data-testid": `developer-movement-${H === "veryFast" ? "very-fast" : H}`,
                              onClick: () => d(H),
                              children: [
                                (0, k.jsx)("span", { children: ne.label }),
                                (0, k.jsxs)("strong", {
                                  children: [ne.multiplier, "\xD7"],
                                }),
                              ],
                            },
                            H,
                          );
                        }),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-control-heading",
                        children: [
                          (0, k.jsx)("span", {
                            id: "developer-camera-label",
                            children: "CAMERA PRESET",
                          }),
                          (0, k.jsx)("output", {
                            children: rl[t.camera.mode].label,
                          }),
                        ],
                      }),
                      (0, k.jsx)("div", {
                        className: "dev-speed-grid dev-camera-grid",
                        role: "group",
                        "aria-labelledby": "developer-camera-label",
                        children: Xo.map((H) => {
                          let ne = rl[H],
                            ae = t.camera.mode === H;
                          return (0, k.jsxs)(
                            "button",
                            {
                              type: "button",
                              className: ae ? "is-active" : "",
                              "aria-pressed": ae,
                              "data-testid": `developer-camera-${H}`,
                              onClick: () => f(H),
                              children: [
                                (0, k.jsx)("span", { children: ne.label }),
                                (0, k.jsx)("strong", {
                                  children:
                                    ne.distance === 0
                                      ? "0 M"
                                      : `${ne.distance} M`,
                                }),
                              ],
                            },
                            H,
                          );
                        }),
                      }),
                      (0, k.jsxs)("p", {
                        className: "dev-horizon-status",
                        "data-testid": "developer-camera-status",
                        children: [
                          (0, k.jsxs)("span", {
                            children: [
                              "REQUESTED ",
                              t.camera.targetDistance.toFixed(1),
                              " M",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "ACTUAL ",
                              t.camera.distance.toFixed(1),
                              " M",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "ANGLE ",
                              Math.round(t.camera.isometricAngleDegrees),
                              "\xB0",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "FOV ",
                              Math.round(t.camera.effectiveFov),
                              "\xB0",
                            ],
                          }),
                          (0, k.jsx)("strong", {
                            children: t.camera.collisionLimited
                              ? "BOOM RETRACTED"
                              : "CLEAR",
                          }),
                        ],
                      }),
                      (0, k.jsxs)("p", {
                        className: "dev-horizon-note dev-player-note",
                        children: [
                          "VIEW: WHEEL ZOOM \xB7 ",
                          keyLabel(t.settings.keyBindings.cameraView),
                          " CYCLE. FLY: WASD MOVE \xB7 SPACE ASCEND \xB7 CTRL/C DESCEND \xB7 SHIFT BOOST. Disabling flight returns you to the last safe grounded position.",
                        ],
                      }),
                    ],
                  }),
                  (0, k.jsxs)("fieldset", {
                    className: "dev-vitals",
                    disabled: !t.devTools.enabled,
                    children: [
                      (0, k.jsx)("legend", { children: "PLAYER / VITALS" }),
                      (0, k.jsxs)("div", {
                        className: "dev-control-heading",
                        children: [
                          (0, k.jsx)("label", {
                            htmlFor: "developer-health",
                            children: "HEALTH",
                          }),
                          (0, k.jsxs)("output", {
                            htmlFor: "developer-health",
                            children: [Math.ceil(t.health), " / ", t.maxHealth],
                          }),
                        ],
                      }),
                      (0, k.jsx)("input", {
                        id: "developer-health",
                        "data-testid": "developer-health",
                        className: "dev-time-slider",
                        type: "range",
                        min: "0",
                        max: t.maxHealth,
                        step: "1",
                        value: t.health,
                        onChange: (H) => l(Number(H.currentTarget.value)),
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-vitals-status",
                        children: [
                          (0, k.jsx)("span", {
                            children: t.sheltered ? "SHELTERED" : "EXPOSED",
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "WET ",
                              Math.round(t.wetness * 100),
                              "%",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "COLD ",
                              Math.round(t.coldStress * 100),
                              "%",
                            ],
                          }),
                          (0, k.jsxs)("span", {
                            children: [
                              "FEELS ",
                              Math.round(t.apparentTemperatureC),
                              "\xB0C",
                            ],
                          }),
                        ],
                      }),
                      (0, k.jsxs)("div", {
                        className: "dev-inline-controls",
                        children: [
                          (0, k.jsx)("button", {
                            type: "button",
                            onClick: () => l(Math.max(0, t.health - 25)),
                            children: "DAMAGE 25",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            onClick: () => c(34),
                            children: "FATAL FALL",
                          }),
                          (0, k.jsx)("button", {
                            type: "button",
                            onClick: u,
                            children: "RECOVER PLAYER",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          (0, k.jsxs)("footer", {
            className: "dev-panel-footer",
            children: [
              (0, k.jsx)("button", {
                type: "button",
                className: "dev-reset",
                disabled: !t.devTools.enabled,
                onClick: () => {
                  (L(2), E());
                },
                children: "RESET OVERRIDES",
              }),
              (0, k.jsxs)("button", {
                type: "button",
                className: "dev-resume",
                onClick: e,
                children: [
                  "CLOSE & RESUME ",
                  (0, k.jsx)("span", {
                    "aria-hidden": "true",
                    children: "\u2197",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
var sn = ut(Ht(), 1);
function SN(t, e = " MS") {
  return t == null ? "\u2014" : `${t.toFixed(2)}${e}`;
}
function BenchmarkHud({ snapshot: t }) {
  let e = t.graphicsBenchmark,
    n =
      e.phase === "warming" ||
      e.phase === "sampling" ||
      e.phase === "finalizing";
  return !t.devTools.enabled || (!t.forestStress.active && !n)
    ? null
    : (0, sn.jsxs)("aside", {
        className: `benchmark-hud ${n ? "is-capturing" : ""}`,
        "data-testid": "benchmark-hud",
        children: [
          (0, sn.jsxs)("header", {
            children: [
              (0, sn.jsxs)("div", {
                children: [
                  (0, sn.jsx)("span", {
                    children: t.forestStress.active
                      ? `CANOPY LOAD LAB / ${t.forestStress.levelLabel}`
                      : "WORLD PERFORMANCE CAPTURE",
                  }),
                  (0, sn.jsx)("strong", {
                    children: t.forestStress.active
                      ? `${t.forestStress.authoredInstances.toLocaleString()} AUTHORED INSTANCES`
                      : `${t.quality.toUpperCase()} / LIVE SCENE`,
                  }),
                ],
              }),
              (0, sn.jsx)("b", {
                children: n
                  ? e.phase.toUpperCase()
                  : `${e.grade} / ${e.delivery}`,
              }),
            ],
          }),
          n &&
            (0, sn.jsx)("div", {
              className: "benchmark-progress",
              role: "progressbar",
              "aria-label": "Performance capture progress",
              "aria-valuemin": 0,
              "aria-valuemax": 100,
              "aria-valuenow": Math.round(e.progress * 100),
              children: (0, sn.jsx)("b", {
                style: { width: `${e.progress * 100}%` },
              }),
            }),
          (0, sn.jsxs)("div", {
            children: [
              (0, sn.jsxs)("span", {
                children: [
                  "TARGET ",
                  (0, sn.jsxs)("strong", {
                    children: [
                      e.targetFps,
                      " / ",
                      e.budgetMs.toFixed(2),
                      " MS",
                    ],
                  }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "CPU P95 ",
                  (0, sn.jsx)("strong", { children: SN(e.cpuWork?.p95) }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "GPU P95 ",
                  (0, sn.jsx)("strong", {
                    children: e.gpu
                      ? SN(e.gpu.p95)
                      : n && e.gpuSupported
                        ? "PENDING"
                        : "N/A",
                  }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "HEADROOM ",
                  (0, sn.jsx)("strong", {
                    children:
                      e.headroomPercent === null
                        ? "\u2014"
                        : `${e.headroomPercent.toFixed(1)}%`,
                  }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "OBSERVED ",
                  (0, sn.jsx)("strong", {
                    children:
                      e.observedFps === null
                        ? "\u2014"
                        : `${e.observedFps.toFixed(1)} HZ`,
                  }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "1% LOW ",
                  (0, sn.jsx)("strong", {
                    children: e.onePercentLowFps?.toFixed(1) ?? "\u2014",
                  }),
                ],
              }),
              (0, sn.jsxs)("span", {
                children: [
                  "LIVE LOAD ",
                  (0, sn.jsxs)("strong", {
                    children: [
                      t.drawCalls.toLocaleString(),
                      " CALLS / ",
                      t.triangles.toLocaleString(),
                      " TRIS",
                    ],
                  }),
                ],
              }),
            ],
          }),
          (0, sn.jsxs)("footer", {
            children: [
              (0, sn.jsx)("span", {
                children: t.forestStress.active
                  ? `${t.forestStress.nearTiles}/${t.forestStress.midTiles}/${t.forestStress.farTiles} NEAR/MID/FAR TILES`
                  : `${t.loadedChunks} FULL-DETAIL CHUNKS`,
              }),
              (0, sn.jsx)("strong", {
                children: n
                  ? e.phase.toUpperCase()
                  : `${e.grade} ENGINE / ${e.delivery} DELIVERY`,
              }),
            ],
          }),
        ],
      });
}
var ITEMS = {
  stone: {
    name: "Stone",
    shortName: "STONE",
    category: "MINERAL",
    unitWeight: 2.4,
    stackLimit: 999,
    description: "Structural fragments suitable for masonry and aggregate.",
  },
  wood: {
    name: "Timber",
    shortName: "WOOD",
    category: "ORGANIC",
    unitWeight: 1.8,
    stackLimit: 999,
    description: "Worked lengths cut from harvestable trees.",
  },
  fiber: {
    name: "Plant fiber",
    shortName: "FIBER",
    category: "ORGANIC",
    unitWeight: 0.35,
    stackLimit: 999,
    description: "Dry stems and resilient strands for cordage and textiles.",
  },
  ore: {
    name: "Raw ore",
    shortName: "ORE",
    category: "MINERAL",
    unitWeight: 3.1,
    stackLimit: 999,
    description: "Unrefined mineral-bearing rock reserved for future smelting.",
  },
  relic: {
    name: "Old-world salvage",
    shortName: "RELIC",
    category: "SALVAGE",
    unitWeight: 0.9,
    stackLimit: 999,
    description:
      "Recoverable mechanisms and fragments from before the migration.",
  },
  first_aid_kit: {
    name: "First-aid kit",
    shortName: "MEDKIT",
    category: "FIELD GEAR",
    unitWeight: 0.8,
    stackLimit: 12,
    useKind: "heal",
    description:
      "A sealed field dressing that restores 35 health when injured.",
  },
  bedroll: {
    name: "Survey bedroll",
    shortName: "BEDROLL",
    category: "CAMP",
    unitWeight: 2.2,
    stackLimit: 8,
    useKind: "deploy_bedroll",
    description: "A compact rest site that can be deployed on clear ground.",
  },
  campfire_kit: {
    name: "Campfire kit",
    shortName: "FIRE",
    category: "CAMP",
    unitWeight: 2.8,
    stackLimit: 8,
    useKind: "deploy_campfire",
    description:
      "A contained heat source that improves nearby wilderness rest.",
  },
  survey_marker: {
    name: "Survey marker",
    shortName: "MARKER",
    category: "FIELD GEAR",
    unitWeight: 1.1,
    stackLimit: 16,
    useKind: "deploy_marker",
    description:
      "A persistent field stake that registers as a navigation target.",
  },
  weather_shelter: {
    name: "Weather shelter",
    shortName: "SHELTER",
    category: "CAMP",
    unitWeight: 5.4,
    stackLimit: 4,
    useKind: "deploy_shelter",
    description: "A low-profile rain fly that shelters nearby bedrolls.",
  },
  field_torch: {
    name: "Field torch",
    shortName: "TORCH",
    category: "FIELD GEAR",
    unitWeight: 0.7,
    stackLimit: 12,
    useKind: "deploy_torch",
    description:
      "A persistent low-energy path light for camps and survey routes.",
  },
};
function O_() {
  return Object.fromEntries(Object.keys(ITEMS).map((t) => [t, 0]));
}
var hf = O_();
function EN(t) {
  return Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
}
function cy(t, e, n) {
  let i = ITEMS[e];
  return { ...t, [e]: Math.min(i.stackLimit, t[e] + EN(n)) };
}
function z_(t, e, n) {
  let i = EN(n);
  return i <= 0 || t[e] < i ? null : { ...t, [e]: t[e] - i };
}
function uy(t, e) {
  let n = { ...t };
  for (let i of Object.keys(ITEMS)) {
    let r = e[i] ?? 0;
    if (!Number.isFinite(r) || !Number.isInteger(r)) return null;
    let a = n[i] + r;
    if (a < 0 || a > ITEMS[i].stackLimit) return null;
    n[i] = a;
  }
  return n;
}
function U_(t) {
  return Object.keys(ITEMS).reduce((e, n) => e + t[n] * ITEMS[n].unitWeight, 0);
}
function _N(t) {
  return Object.keys(ITEMS).reduce((e, n) => e + t[n], 0);
}
function dy(t) {
  return ITEMS[t].useKind ?? null;
}
var YG = {
    field_supplies: [
      { item: "fiber", chance: 1, minimum: 1, maximum: 3 },
      { item: "wood", chance: 0.8, minimum: 1, maximum: 2 },
      { item: "stone", chance: 0.55, minimum: 1, maximum: 2 },
      { item: "first_aid_kit", chance: 0.28, minimum: 1, maximum: 1 },
    ],
    tower_service: [
      { item: "relic", chance: 1, minimum: 1, maximum: 2 },
      { item: "ore", chance: 0.82, minimum: 1, maximum: 3 },
      { item: "fiber", chance: 0.5, minimum: 1, maximum: 2 },
      { item: "field_torch", chance: 0.45, minimum: 1, maximum: 1 },
    ],
  },
  qG = /^container:[a-z0-9][a-z0-9:._-]{0,103}$/i;
function ZG(t, e) {
  let n = kt(`${ot}:loot:v1:${e}:${t}`),
    i = {};
  for (let r of YG[e]) {
    if (n() > r.chance) continue;
    let a = Math.floor(Kt(n, r.minimum, r.maximum + 0.999999));
    a > 0 && (i[r.item] = a);
  }
  return i;
}
function MN(t, e, n) {
  let i = t[e];
  if (i)
    return {
      states: { ...t },
      state: { opened: !0, looted: i.looted, remaining: { ...i.remaining } },
    };
  let r = { opened: !0, looted: !1, remaining: ZG(e, n) };
  return { states: { ...t, [e]: r }, state: r };
}
function wN(t) {
  return t ? Object.values(t.remaining).reduce((e, n) => e + (n ?? 0), 0) : 0;
}
function F_(t, e, n, i, r) {
  let a = e[n],
    o = a?.remaining[i] ?? 0,
    s = ITEMS[i].stackLimit - t[i],
    l = Math.min(o, s, Number.isFinite(r) ? Math.max(0, Math.floor(r)) : 0);
  if (!a || l <= 0)
    return { inventory: { ...t }, states: { ...e }, quantity: 0 };
  let c = { ...a.remaining, [i]: o - l };
  return (
    c[i] === 0 && delete c[i],
    {
      inventory: cy(t, i, l),
      states: { ...e, [n]: { opened: !0, looted: !0, remaining: c } },
      quantity: l,
    }
  );
}
function TN(t, e, n) {
  let i = { ...t },
    r = { ...e },
    a = 0;
  for (let o of Object.keys(ITEMS)) {
    let s = F_(i, r, n, o, r[n]?.remaining[o] ?? 0);
    ((i = s.inventory), (r = s.states), (a += s.quantity));
  }
  return { inventory: i, states: r, quantity: a };
}
function RN(t) {
  if (!t || typeof t != "object" || Array.isArray(t)) return {};
  let e = {},
    n = 0;
  for (let [i, r] of Object.entries(t)) {
    if (n >= 512 || !qG.test(i) || !r || typeof r != "object") continue;
    let a = r;
    if (a.opened !== !0 || !a.remaining || typeof a.remaining != "object")
      continue;
    let o = {};
    for (let [s, l] of Object.entries(a.remaining))
      !Object.hasOwn(ITEMS, s) ||
        !Number.isSafeInteger(l) ||
        l <= 0 ||
        (o[s] = Math.min(ITEMS[s].stackLimit, l));
    ((e[i] = { opened: !0, looted: a.looted === !0, remaining: o }), (n += 1));
  }
  return e;
}
var yc = ut(Bi(), 1),
  Pr = ut(Ht(), 1);
function qo({
  title: t,
  titleId: e,
  kicker: n,
  testId: i,
  className: r = "",
  headerMeta: a,
  footer: o,
  children: s,
  onClose: l,
}) {
  let c = (0, yc.useRef)(null),
    u = (0, yc.useRef)(null),
    h = (0, yc.useRef)(l);
  ((0, yc.useEffect)(() => {
    h.current = l;
  }, [l]),
    (0, yc.useEffect)(() => {
      let p = document.activeElement;
      u.current?.focus();
      let f = (S) => {
        S.key === "Escape" && (S.preventDefault(), h.current());
      };
      return (
        window.addEventListener("keydown", f),
        () => {
          (window.removeEventListener("keydown", f), p?.focus?.());
        }
      );
    }, []));
  let d = (p) => {
    Kr(p, c.current);
  };
  return (0, Pr.jsxs)("div", {
    className: "field-overlay feature-overlay",
    "data-testid": i,
    children: [
      (0, Pr.jsx)("button", {
        className: "field-click-shield",
        type: "button",
        "aria-label": `Close ${t}`,
        onClick: l,
      }),
      (0, Pr.jsxs)("section", {
        ref: c,
        className: `field-panel feature-panel ${r}`.trim(),
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": e,
        onKeyDown: d,
        children: [
          (0, Pr.jsxs)("header", {
            className: "field-panel-header feature-panel-header",
            children: [
              (0, Pr.jsxs)("div", {
                children: [
                  (0, Pr.jsx)("p", { className: "eyebrow", children: n }),
                  (0, Pr.jsx)("h2", {
                    id: e,
                    ref: u,
                    tabIndex: -1,
                    children: t,
                  }),
                ],
              }),
              (0, Pr.jsxs)("div", {
                className: "feature-header-actions",
                children: [
                  a,
                  (0, Pr.jsxs)("button", {
                    type: "button",
                    onClick: l,
                    children: [
                      "CLOSE ",
                      (0, Pr.jsx)("span", {
                        "aria-hidden": "true",
                        children: "\xD7",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          s,
          o
            ? (0, Pr.jsx)("footer", {
                className: "field-panel-footer",
                children: o,
              })
            : null,
        ],
      }),
    ],
  });
}
var Bn = ut(Ht(), 1);
function KG(t) {
  return t.includes("meridian-tower")
    ? "Meridian service cache"
    : t.includes("survey-house")
      ? "Survey archive crate"
      : t.includes("field-unit")
        ? "Field supply locker"
        : "Field container";
}
function ContainerPanel({
  snapshot: t,
  containerId: e,
  onClose: n,
  onTakeItem: i,
  onTakeAll: r,
}) {
  let a = t.containerStates[e],
    o = Object.keys(ITEMS).filter((c) => (a?.remaining[c] ?? 0) > 0),
    s = wN(a),
    l = o.some((c) => t.inventory[c] < ITEMS[c].stackLimit);
  return (0, Bn.jsx)(qo, {
    title: KG(e),
    titleId: "container-title",
    kicker: "MATERIAL TRANSFER / LOCAL STORAGE",
    testId: "container-overlay",
    className: "container-panel",
    onClose: n,
    headerMeta: (0, Bn.jsxs)("span", {
      className: "feature-header-meta",
      children: [s, " ITEMS"],
    }),
    footer: (0, Bn.jsxs)(Bn.Fragment, {
      children: [
        (0, Bn.jsx)("span", {
          children: "CONTENTS PERSIST AFTER PARTIAL TRANSFER",
        }),
        (0, Bn.jsx)("button", {
          type: "button",
          className: "text-action",
          disabled: s === 0 || !l,
          onClick: () => r(e),
          children: "TAKE ALL \u2192",
        }),
      ],
    }),
    children: (0, Bn.jsx)("div", {
      className: "container-ledger",
      children:
        o.length === 0
          ? (0, Bn.jsxs)("div", {
              className: "empty-feature-state",
              children: [
                (0, Bn.jsx)("span", { children: "00" }),
                (0, Bn.jsx)("h3", { children: "Container empty" }),
                (0, Bn.jsx)("p", {
                  children: "No transferable materials remain in this cache.",
                }),
              ],
            })
          : o.map((c) => {
              let u = ITEMS[c],
                h = a?.remaining[c] ?? 0,
                d = t.inventory[c] >= u.stackLimit;
              return (0, Bn.jsxs)(
                "article",
                {
                  children: [
                    (0, Bn.jsx)("div", {
                      className: "inventory-index",
                      children: u.shortName.slice(0, 2),
                    }),
                    (0, Bn.jsxs)("div", {
                      children: [
                        (0, Bn.jsx)("small", { children: u.category }),
                        (0, Bn.jsx)("h3", { children: u.name }),
                        (0, Bn.jsx)("p", { children: u.description }),
                      ],
                    }),
                    (0, Bn.jsx)("strong", {
                      children: String(h).padStart(2, "0"),
                    }),
                    (0, Bn.jsx)("button", {
                      type: "button",
                      disabled: d,
                      onClick: () => i(e, c, 1),
                      children: d ? "STACK FULL" : "TAKE ONE",
                    }),
                  ],
                },
                c,
              );
            }),
    }),
  });
}
var V3 = ut(Bi(), 1);
var DN = (72 * Math.PI) / 180,
  fy = Math.cos(DN),
  my = Math.sin(DN),
  k_ = my,
  B_ = -fy,
  He = Object.freeze({
    id: "landmark:sunscar-canyon",
    overlookId: "landmark:sunscar-overlook",
    fastTravelId: "landmark:sunscar-overlook",
    navigationSystemId: "authored-landmarks",
    name: "Sunscar Canyon",
    overlookName: "Sunscar Overlook",
    region: "Glass Barrens",
    note: "A vast, terraced badlands canyon cut around a narrow river corridor.",
    center: Object.freeze({ x: 36960, z: -13440 }),
    overlookWaypoint: Object.freeze({ x: 33408, z: -12384 }),
    axis: Object.freeze({ x: fy, z: my }),
    normal: Object.freeze({ x: k_, z: B_ }),
    halfLength: 8640,
    footprintHalfWidth: 3456,
    carvedHalfWidth: 2800,
    maxDepth: 680,
    riverBedDepth: 18,
    riverSurfaceLift: 5,
    riverHalfWidth: 34,
    riverHalfLength: 6500,
    rimTrailWidth: 3.6,
    rimTrailShoulderWidth: 18,
    discoveryPadding: 420,
  });
function gy(t) {
  return Math.min(1, Math.max(0, t));
}
function vy(t) {
  let e = gy(t);
  return e * e * e * (e * (e * 6 - 15) + 10);
}
function hy(t, e, n) {
  return t <= e ? 1 : t >= n ? 0 : 1 - vy((t - e) / (n - e));
}
function G_(t, e) {
  let n = t - He.center.x,
    i = e - He.center.z;
  return { longitudinal: n * fy + i * my, lateral: n * k_ + i * B_ };
}
function IN(t, e) {
  return { x: He.center.x + t * fy + e * k_, z: He.center.z + t * my + e * B_ };
}
function yy(t) {
  let e = Number.isFinite(t) ? t : 0;
  return Math.sin(e * 54e-5 + 0.45) * 260 + Math.sin(e * 0.00117 - 0.8) * 92;
}
function NN(t) {
  let e = gy((t / He.riverHalfLength + 1) * 0.5);
  return He.riverHalfWidth * (0.88 + Math.sin(e * Math.PI) * 0.18);
}
function Td(t, e, n = 0) {
  let i = G_(t, e),
    r = Math.max(0, Number.isFinite(n) ? n : 0);
  return Math.abs(i.longitudinal) > He.riverHalfLength + r
    ? !1
    : Math.abs(i.lateral - yy(i.longitudinal)) <= NN(i.longitudinal) + r;
}
function jG(t) {
  let e = Math.abs(t) / He.halfLength;
  return e >= 1 ? 0 : vy((1 - e) / 0.24);
}
function ta(t, e) {
  let n = G_(t, e);
  if (Math.abs(n.longitudinal) >= He.halfLength - 1e-6) return 0;
  let i = jG(n.longitudinal);
  if (i <= 0) return 0;
  let r = yy(n.longitudinal),
    a = Math.abs(n.lateral - r);
  if (a >= He.carvedHalfWidth) return 0;
  let o = hy(a, 120, 760),
    s = hy(a, 640, 1580),
    l = hy(a, 1430, 2800),
    c = o * 0.44 + s * 0.34 + l * 0.22,
    u =
      0.965 +
      Math.sin(n.longitudinal * 73e-5 + 0.25) * 0.025 +
      Math.sin(n.longitudinal * 0.00161 - 1.1) * 0.01,
    h =
      a <= He.riverHalfWidth * 1.8
        ? He.riverBedDepth * hy(a, He.riverHalfWidth, He.riverHalfWidth * 1.8)
        : 0;
  return Math.max(0, He.maxDepth * i * c * u + h * i);
}
function V_(t, e, n) {
  return Number.isFinite(t) ? t - ta(e, n) : t;
}
function xy(t, e) {
  return gy(ta(t, e) / (He.maxDepth + He.riverBedDepth));
}
function pf(t, e) {
  return 1 - vy((xy(t, e) - 0.015) / 0.16);
}
function PN(t, e) {
  return 1 - vy((xy(t, e) - 0.025) / 0.28) * 0.88;
}
function by(t, e, n = 6) {
  let i = Math.max(3, Number.isFinite(n) ? n : 6),
    r = (ta(t + i, e) - ta(t - i, e)) / (i * 2),
    a = (ta(t, e + i) - ta(t, e - i)) / (i * 2);
  return Math.hypot(r, a) > 0.58;
}
var ao = Object.freeze(
    Array.from({ length: 69 }, (t, e) => {
      let i = ((e / 68) * 2 - 1) * He.riverHalfLength,
        r = IN(i, yy(i));
      return Object.freeze({ ...r, halfWidth: NN(i) });
    }),
  ),
  QG = [
    { longitudinal: 800, lateralOffset: -2940 },
    { longitudinal: 2050, lateralOffset: -2900 },
    { longitudinal: 3350, lateralOffset: -2860 },
    { longitudinal: 4650, lateralOffset: -2800 },
    { longitudinal: 5850, lateralOffset: -2700 },
    { longitudinal: 6750, lateralOffset: -2540 },
  ],
  py = [
    He.overlookWaypoint,
    ...QG.map(({ longitudinal: t, lateralOffset: e }) => IN(t, yy(t) + e)),
  ],
  LN = py.slice(1).map((t, e) => Math.hypot(t.x - py[e].x, t.z - py[e].z)),
  CN = LN.reduce((t, e) => t + e, 0),
  AN = 0,
  Lr = Object.freeze(
    py.map(
      (t, e) => (
        e > 0 && (AN += LN[e - 1]),
        Object.freeze({ ...t, progress: CN > 0 ? AN / CN : 0 })
      ),
    ),
  ),
  Zo = Object.freeze({
    minX: Math.min(...Lr.map((t) => t.x)),
    maxX: Math.max(...Lr.map((t) => t.x)),
    minZ: Math.min(...Lr.map((t) => t.z)),
    maxZ: Math.max(...Lr.map((t) => t.z)),
  });
function $G(t, e) {
  let n = He.rimTrailShoulderWidth + 4;
  if (t < Zo.minX - n || t > Zo.maxX + n || e < Zo.minZ - n || e > Zo.maxZ + n)
    return null;
  let i = null;
  for (let r = 0; r < Lr.length - 1; r += 1) {
    let a = Lr[r],
      o = Lr[r + 1],
      s = o.x - a.x,
      l = o.z - a.z,
      c = s * s + l * l,
      u = c > 1e-4 ? gy(((t - a.x) * s + (e - a.z) * l) / c) : 0,
      h = a.x + s * u,
      d = a.z + l * u,
      p = Math.hypot(t - h, e - d);
    (i && p >= i.distance) ||
      (i = {
        distance: p,
        progress: a.progress + (o.progress - a.progress) * u,
        x: h,
        z: d,
        segmentIndex: r,
      });
  }
  return i;
}
function ON(t, e, n = 0) {
  let i = $G(t, e);
  if (!i) return !1;
  let r = Math.max(0, Number.isFinite(n) ? n : 0);
  return i.distance <= He.rimTrailShoulderWidth + r;
}
function zN(t, e) {
  let n = G_(t, e),
    i = He.halfLength + He.discoveryPadding,
    r = He.footprintHalfWidth + He.discoveryPadding;
  return Math.hypot(n.longitudinal / i, n.lateral / r) <= 1;
}
var me = Object.freeze({
    id: "landmark:crownspire",
    trailheadId: "landmark:crownspire-trailhead",
    fastTravelId: "landmark:crownspire-trailhead",
    navigationSystemId: "authored-landmarks",
    name: "Crownspire",
    trailheadName: "Crownspire Trailhead",
    region: "Crownspire Range",
    note: "A towering alpine landmark with a marked switchback route to the summit.",
    center: Object.freeze({ x: -8640, z: -4800 }),
    summit: Object.freeze({ x: -8640, z: -4800 }),
    baseWaypoint: Object.freeze({ x: -14208, z: -6336 }),
    footprintRadius: 5760,
    baseRelief: 980,
    summitCapRelief: 220,
    summitRelief: 1200,
    trailWidth: 3.4,
    trailShoulderWidth: 16,
    discoveryRadius: 5920,
  }),
  UN = [
    { progress: 0, turn: 0 },
    { progress: 0.12, turn: 0.22 },
    { progress: 0.24, turn: -0.22 },
    { progress: 0.36, turn: 0.21 },
    { progress: 0.48, turn: -0.2 },
    { progress: 0.6, turn: 0.19 },
    { progress: 0.7, turn: -0.17 },
    { progress: 0.79, turn: 0.15 },
    { progress: 0.87, turn: 0.65 },
    { progress: 0.93, turn: 1.2 },
    { progress: 0.975, turn: 1.9 },
    { progress: 1, turn: 0 },
  ],
  JG = Math.atan2(
    me.baseWaypoint.z - me.center.z,
    me.baseWaypoint.x - me.center.x,
  ),
  Ko = Object.freeze(
    UN.map(({ progress: t, turn: e }, n) => {
      if (n === 0) return Object.freeze({ ...me.baseWaypoint, progress: t });
      if (n === UN.length - 1)
        return Object.freeze({ ...me.summit, progress: t });
      let i = me.footprintRadius * (1 - t),
        r = JG + e;
      return Object.freeze({
        x: me.center.x + Math.cos(r) * i,
        z: me.center.z + Math.sin(r) * i,
        progress: t,
      });
    }),
  );
function Sy(t) {
  return Math.min(1, Math.max(0, t));
}
function ff(t) {
  let e = Sy(t);
  return e * e * e * (e * (e * 6 - 15) + 10);
}
function W_(t, e) {
  return Math.hypot(t - me.center.x, e - me.center.z);
}
function FN(t, e) {
  let n = me.footprintRadius,
    i = W_(t, e);
  return i >= n ? 0 : ff(1 - i / n);
}
function oo(t, e) {
  let n = me.footprintRadius,
    i = t - me.center.x,
    r = e - me.center.z;
  if (Math.abs(i) >= n || Math.abs(r) >= n) return 0;
  let a = Math.hypot(i, r);
  if (a >= n) return 0;
  let o = a / n,
    s = ff(1 - o),
    l = Math.atan2(r, i),
    u =
      1 +
      Math.sin(Math.PI * Sy((o - 0.035) / 0.965)) *
        (Math.sin(l * 5 + 0.62) * 0.07 + Math.sin(l * 3 - o * 8.5) * 0.035),
    h = Math.hypot(t - me.summit.x, e - me.summit.z),
    d = me.summitCapRelief * Math.exp(-(h * h) / (2 * 680 * 680));
  return Math.max(0, me.baseRelief * s * u + d * s);
}
function mf(t, e) {
  let n = oo(t, e) / me.summitRelief;
  return 1 - ff((n - 0.36) / 0.3);
}
function HN(t, e) {
  let n = oo(t, e) / me.summitRelief;
  return 1 - ff((n - 0.48) / 0.28);
}
function kN(t, e) {
  let n = me.trailShoulderWidth + 4,
    i = Math.min(me.center.x - me.footprintRadius, me.baseWaypoint.x) - n,
    r = me.center.x + me.footprintRadius + n,
    a = me.center.z - me.footprintRadius - n,
    o = me.center.z + me.footprintRadius + n;
  if (t < i || t > r || e < a || e > o) return null;
  let s = null;
  for (let l = 0; l < Ko.length - 1; l += 1) {
    let c = Ko[l],
      u = Ko[l + 1],
      h = u.x - c.x,
      d = u.z - c.z,
      p = h * h + d * d,
      f = p > 1e-4 ? Sy(((t - c.x) * h + (e - c.z) * d) / p) : 0,
      S = c.x + h * f,
      v = c.z + d * f,
      m = Math.hypot(t - S, e - v);
    (s && m >= s.distance) ||
      (s = {
        distance: m,
        progress: c.progress + (u.progress - c.progress) * f,
        x: S,
        z: v,
        segmentIndex: l,
      });
  }
  return s;
}
function X_(t, e, n = 0) {
  let i = kN(t, e);
  if (!i) return !1;
  let r = Math.max(0, Number.isFinite(n) ? n : 0);
  return i.distance <= me.trailShoulderWidth + r;
}
function Y_(t, e, n, i = 1) {
  if (!Number.isFinite(t)) return t;
  let r = oo(e, n);
  if (r <= 0 && !X_(e, n)) return t;
  let a = r,
    o = Sy(Number.isFinite(i) ? i : 0);
  if (o > 0) {
    let s = kN(e, n);
    if (s) {
      let l = me.trailWidth * 0.5,
        c = me.trailShoulderWidth,
        u = 1 - ff((s.distance - l) / (c - l)),
        h = oo(s.x, s.z);
      a += (h - a) * u * o;
    }
  }
  return t + a;
}
var ei = 7.5,
  Ke = 6400 * ei,
  BN = Ke * 2,
  GN = (BN * BN) / 1e6,
  ci = -2.4,
  q_ = {
    riverlands: {
      id: "riverlands",
      name: "Greywater Riverlands",
      region: "Greywater Basin",
      color: 6647899,
      treeDensity: 0.45,
      rockDensity: 0.25,
      primaryResource: "fiber",
    },
    pine_forest: {
      id: "pine_forest",
      name: "Sable Pine Forest",
      region: "Sablewood",
      color: 4149572,
      treeDensity: 1,
      rockDensity: 0.45,
      primaryResource: "wood",
    },
    crown_highlands: {
      id: "crown_highlands",
      name: "Crown Highlands",
      region: "Crown Highlands",
      color: 6447967,
      treeDensity: 0.22,
      rockDensity: 1,
      primaryResource: "ore",
    },
    warden_steppe: {
      id: "warden_steppe",
      name: "Warden Steppe",
      region: "Warden Steppe",
      color: 9075032,
      treeDensity: 0.08,
      rockDensity: 0.38,
      primaryResource: "fiber",
    },
    glass_badlands: {
      id: "glass_badlands",
      name: "Glass Barrens",
      region: "Glass Barrens",
      color: 9134152,
      treeDensity: 0,
      rockDensity: 0.9,
      primaryResource: "stone",
    },
    salt_coast: {
      id: "salt_coast",
      name: "Salt Coast",
      region: "The Salt Reach",
      color: 9144182,
      treeDensity: 0.04,
      rockDensity: 0.32,
      primaryResource: "relic",
    },
    grey_meadow: {
      id: "grey_meadow",
      name: "Grey Meadow",
      region: "Red Basin Marches",
      color: 8024920,
      treeDensity: 0.24,
      rockDensity: 0.42,
      primaryResource: "fiber",
    },
  };
function gf(t) {
  return Math.min(1, Math.max(0, t));
}
function Fi(t, e, n) {
  let i = gf((n - t) / (e - t));
  return i * i * (3 - 2 * i);
}
function VN(t) {
  return 650 + Math.sin(t * 55e-5) * 520 + Math.sin(t * 0.0013 + 0.7) * 180;
}
function _a(t) {
  return VN(t / ei) * ei;
}
function gi(t) {
  let e = t / ei;
  return (34 + Fi(1800, 5300, e) * 32 + (Math.sin(e * 0.0017) + 1) * 4) * ei;
}
function Rd(t, e) {
  return Math.abs(t - _a(e));
}
function Ey(t, e) {
  let n = t / ei,
    i = e / ei,
    r = Math.sin(n * 0.00105 + 0.4) * 8 + Math.cos(i * 86e-5 - 0.7) * 6,
    a = Fi(-1900, -5800, i) * 34,
    o = Fi(1700, 4800, Math.abs(n)) * 15,
    s = Fi(2100, 5200, n) * 10;
  return r + a + o + s;
}
function ui(t, e) {
  let n = t / ei,
    i = e / ei,
    r = Ey(t, e),
    a = Rd(t, e),
    o = Math.exp(-a / (620 * ei)),
    s =
      (Math.sin(n * 72e-5 + i * 31e-5) + Math.cos(i * 57e-5 - n * 18e-5) + 2) /
      4,
    l = gf(0.66 - n / (6400 * 1.7)),
    c = gf(o * 0.62 + s * 0.2 + l * 0.27),
    u = gf(0.61 + i / (6400 * 3.2) - r * 0.007),
    h;
  return (
    i > 4750
      ? (h = "salt_coast")
      : a < gi(e) + 72 * ei
        ? (h = "riverlands")
        : i < -3250 || r > 32
          ? (h = "crown_highlands")
          : n > 2350 && c < 0.5
            ? (h = "glass_badlands")
            : c > 0.58 && u < 0.68
              ? (h = "pine_forest")
              : n < -1350 && c < 0.54
                ? (h = "warden_steppe")
                : (h = "grey_meadow"),
    {
      biome: q_[h],
      moisture: c,
      temperature: u,
      riverDistance: a,
      macroElevation: r,
    }
  );
}
var al = (t, e = 0) => Math.round(VN(t) + e),
  e8 = [
    {
      id: "vesper-crown",
      name: "Vesper Crown",
      tier: "megacity",
      x: al(1050, 120),
      z: 1050,
      population: 118e5,
      economy:
        "finance \xB7 precision industry \xB7 river trade \xB7 administration",
      reason:
        "Founded where the Greywater narrows at the continent's main east\u2013west caravan crossing.",
      radius: 560,
    },
    {
      id: "ironvale",
      name: "Ironvale",
      tier: "city",
      x: -3180,
      z: -3050,
      population: 162e3,
      economy: "iron \xB7 machine works \xB7 rail stock \xB7 stone",
      reason:
        "A spring-fed highland shelf beside the region's richest iron and hard-stone seams.",
      radius: 320,
    },
    {
      id: "reedwater",
      name: "Reedwater",
      tier: "city",
      x: al(-1020, -170),
      z: -1020,
      population: 118e3,
      economy: "grain \xB7 milling \xB7 river barges \xB7 food markets",
      reason:
        "Built on a broad, flood-renewed terrace where barges can load the northern grain belt.",
      radius: 300,
    },
    {
      id: "kilnreach",
      name: "Kilnreach",
      tier: "city",
      x: 3320,
      z: 620,
      population: 96e3,
      economy: "glass \xB7 ceramics \xB7 solar works \xB7 salt chemicals",
      reason:
        "Deep artesian wells support a factory city beside silica flats, clay beds, and unbroken sun.",
      radius: 290,
    },
    {
      id: "lumenport",
      name: "Lumenport",
      tier: "city",
      x: al(4850, 80),
      z: 4850,
      population: 204e3,
      economy: "shipping \xB7 fisheries \xB7 warehousing \xB7 ship repair",
      reason:
        "The Greywater's navigable estuary gives inland producers their only all-season sea port.",
      radius: 340,
    },
    {
      id: "timberfall",
      name: "Timberfall",
      tier: "town",
      x: -1720,
      z: -2420,
      population: 24e3,
      economy: "timber \xB7 resin \xB7 paper \xB7 carpentry",
      reason:
        "A managed-forest town where two logging valleys meet the highland road.",
      radius: 175,
    },
    {
      id: "crosswind",
      name: "Crosswind",
      tier: "town",
      x: -820,
      z: 460,
      population: 31e3,
      economy: "grain exchange \xB7 livestock \xB7 wagon works",
      reason:
        "A dry, level crossroads between western farms, Vesper Crown, and the northern mills.",
      radius: 180,
    },
    {
      id: "red-quay",
      name: "Red Quay",
      tier: "town",
      x: al(2650, -40),
      z: 2650,
      population: 28e3,
      economy: "river freight \xB7 orchards \xB7 cooperage",
      reason:
        "A natural landing above the tidal reach, surrounded by warm orchard terraces.",
      radius: 170,
    },
    {
      id: "bright-mine",
      name: "Bright Mine",
      tier: "town",
      x: 2620,
      z: -2520,
      population: 19e3,
      economy: "copper \xB7 rare earths \xB7 explosives",
      reason:
        "A mining settlement on an exposed mineral fault with a direct haul road to Kilnreach.",
      radius: 160,
    },
    {
      id: "saltmere",
      name: "Saltmere",
      tier: "town",
      x: 2850,
      z: 5030,
      population: 21e3,
      economy: "salt pans \xB7 fish curing \xB7 coastal trade",
      reason:
        "Shallow evaporation flats and a protected coastal inlet sustain salt and fishing fleets.",
      radius: 165,
    },
    {
      id: "barrow-gate",
      name: "Barrow Gate",
      tier: "town",
      x: -3720,
      z: 1620,
      population: 17e3,
      economy: "wool \xB7 horses \xB7 leather \xB7 caravan services",
      reason:
        "The western steppe road funnels through this dependable well and sheltered escarpment gap.",
      radius: 150,
    },
    {
      id: "greybridge",
      name: "Greybridge",
      tier: "town",
      x: al(-3050, 20),
      z: -3050,
      population: 14e3,
      economy: "hydropower \xB7 quarrying \xB7 bridge tolls",
      reason:
        "The last safe river crossing before the steep Crown Highlands controls northbound trade.",
      radius: 145,
    },
    {
      id: "dustmere",
      name: "Dustmere",
      tier: "village",
      x: -210,
      z: -240,
      population: 1420,
      economy: "goats \xB7 dry farming \xB7 relay salvage",
      reason:
        "A sheltered basin spring and old relay road support the frontier's nearest permanent village.",
      radius: 82,
    },
    {
      id: "willow-bank",
      name: "Willow Bank",
      tier: "village",
      x: al(-210, -90),
      z: -210,
      population: 2160,
      economy: "vegetables \xB7 reeds \xB7 ferries",
      reason:
        "Shallow riverbanks and rich silt favor market gardens and a local ferry crossing.",
      radius: 88,
    },
    {
      id: "pine-rest",
      name: "Pine Rest",
      tier: "village",
      x: -1350,
      z: -1640,
      population: 1080,
      economy: "charcoal \xB7 mushrooms \xB7 forestry",
      reason:
        "A forest clearing on the Timberfall road where charcoal burners share a perennial creek.",
      radius: 76,
    },
    {
      id: "long-acre",
      name: "Long Acre",
      tier: "village",
      x: -2180,
      z: 120,
      population: 1760,
      economy: "wheat \xB7 seed stock \xB7 sheep",
      reason:
        "Deep steppe loam, low slope, and easy access to Crosswind's grain market favor broad farms.",
      radius: 84,
    },
    {
      id: "cold-spring",
      name: "Cold Spring",
      tier: "village",
      x: -2480,
      z: -3820,
      population: 740,
      economy: "goats \xB7 slate \xB7 spring water",
      reason:
        "A mineral spring makes a rare habitable shelf beneath the northern quarry faces.",
      radius: 68,
    },
    {
      id: "copper-leaf",
      name: "Copperleaf",
      tier: "village",
      x: 2040,
      z: -1780,
      population: 980,
      economy: "prospecting \xB7 pack animals \xB7 herbs",
      reason:
        "A wooded fault valley provides water, browse, and a staging point for the eastern mines.",
      radius: 72,
    },
    {
      id: "white-clay",
      name: "White Clay",
      tier: "village",
      x: 3740,
      z: 1420,
      population: 1340,
      economy: "clay \xB7 kiln fuel \xB7 ceramics",
      reason:
        "A clay lens beside an artesian seep supplies Kilnreach's ceramic yards.",
      radius: 76,
    },
    {
      id: "orchard-bend",
      name: "Orchard Bend",
      tier: "village",
      x: al(3360, -260),
      z: 3360,
      population: 2420,
      economy: "fruit \xB7 cider \xB7 river pilots",
      reason:
        "A warm, south-facing river bend protects orchards from coastal wind.",
      radius: 90,
    },
    {
      id: "nettle-ford",
      name: "Nettle Ford",
      tier: "village",
      x: al(1920, 150),
      z: 1920,
      population: 1880,
      economy: "hemp fiber \xB7 ferries \xB7 poultry",
      reason:
        "A firm gravel ford and wet fields make this a natural fiber-growing and ferry village.",
      radius: 86,
    },
    {
      id: "sunbreak",
      name: "Sunbreak",
      tier: "village",
      x: 4360,
      z: 120,
      population: 860,
      economy: "solar maintenance \xB7 silica gathering",
      reason:
        "Unbroken sunlight and a shallow service well support workers on the eastern solar fields.",
      radius: 70,
    },
    {
      id: "west-well",
      name: "West Well",
      tier: "village",
      x: -4620,
      z: 580,
      population: 620,
      economy: "water stop \xB7 horses \xB7 caravan repair",
      reason:
        "The only reliable deep well across a long stretch of the western caravan route.",
      radius: 62,
    },
    {
      id: "crownstep",
      name: "Crownstep",
      tier: "village",
      x: -1971.2,
      z: -857.6,
      population: 720,
      economy:
        "trail services \xB7 goats \xB7 stonework \xB7 cold-weather gardens",
      reason:
        "A stable bench outside Crownspire's avalanche paths provides a practical base for highland travel.",
      radius: 72,
      landmarkGatewayId: me.id,
    },
    {
      id: "rimstead",
      name: "Rimstead",
      tier: "village",
      x: 4352,
      z: -1600,
      population: 920,
      economy: "pack services \xB7 stonework \xB7 grazing \xB7 canyon surveys",
      reason:
        "A level, well-drained terrace outside Sunscar Canyon anchors the safest approach to its western rim.",
      radius: 72,
      landmarkGatewayId: He.id,
    },
    {
      id: "low-tide",
      name: "Low Tide",
      tier: "village",
      x: -640,
      z: 5180,
      population: 1520,
      economy: "shellfish \xB7 rope \xB7 coastal pilots",
      reason:
        "Mudflats rich in shellfish sit beside the safest small-craft channel west of Lumenport.",
      radius: 78,
    },
  ],
  pr = e8.map((t) => ({
    ...t,
    x: Math.round(t.x * ei),
    z: Math.round(t.z * ei),
    radius:
      t.tier === "megacity" ? 8e3 : Math.round(t.radius * Math.min(ei, 4)),
  })),
  t8 = [
    { from: "ironvale", to: "greybridge", class: "regional" },
    { from: "greybridge", to: "reedwater", class: "trunk" },
    { from: "reedwater", to: "vesper-crown", class: "trunk" },
    { from: "vesper-crown", to: "red-quay", class: "trunk" },
    { from: "red-quay", to: "lumenport", class: "trunk" },
    { from: "vesper-crown", to: "crosswind", class: "trunk" },
    { from: "crosswind", to: "barrow-gate", class: "regional" },
    { from: "barrow-gate", to: "west-well", class: "local" },
    { from: "vesper-crown", to: "kilnreach", class: "trunk" },
    { from: "kilnreach", to: "bright-mine", class: "regional" },
    { from: "kilnreach", to: "sunbreak", class: "local" },
    { from: "kilnreach", to: "white-clay", class: "local" },
    { from: "lumenport", to: "saltmere", class: "regional" },
    { from: "crosswind", to: "long-acre", class: "local" },
    { from: "reedwater", to: "timberfall", class: "regional" },
    { from: "timberfall", to: "pine-rest", class: "local" },
    { from: "ironvale", to: "cold-spring", class: "local" },
    { from: "bright-mine", to: "copper-leaf", class: "local" },
    { from: "red-quay", to: "orchard-bend", class: "local" },
    { from: "vesper-crown", to: "nettle-ford", class: "local" },
    { from: "lumenport", to: "low-tide", class: "regional" },
    { from: "crosswind", to: "dustmere", class: "local" },
    { from: "dustmere", to: "willow-bank", class: "local" },
    { from: "crownstep", to: "pine-rest", class: "local" },
    { from: "crownstep", to: "long-acre", class: "local" },
    { from: "bright-mine", to: "rimstead", class: "regional" },
    { from: "rimstead", to: "sunbreak", class: "local" },
  ],
  n8 = new Map(pr.map((t) => [t.id, t]));
function Or(t) {
  return n8.get(t) ?? null;
}
function xc(t, e) {
  let n = pr[0],
    i = Number.POSITIVE_INFINITY;
  for (let r of pr) {
    let a = Math.hypot(t - r.x, e - r.z);
    a < i && ((n = r), (i = a));
  }
  return { settlement: n, distance: i };
}
function jo(t, e, n) {
  return gf(1 - Math.hypot(e - t.x, n - t.z) / t.radius);
}
function bc(t, e, n) {
  return pr.filter((i) => Math.hypot(t - i.x, e - i.z) <= i.radius + n);
}
function i8(t) {
  let e = Or(t.from),
    n = Or(t.to);
  return e && n ? { from: e, to: n } : null;
}
var Cd = [
  ...t8.flatMap((t) => {
    let e = i8(t);
    return e
      ? [
          {
            id: `${t.from}:${t.to}`,
            class: t.class,
            kind: "trade",
            from: { x: e.from.x, z: e.from.z },
            to: { x: e.to.x, z: e.to.z },
            endpointPopulations: [e.from.population, e.to.population],
          },
        ]
      : [];
  }),
  {
    id: "old-relay-spur:west",
    class: "local",
    kind: "service",
    from: { x: Or("dustmere")?.x ?? -1575, z: Or("dustmere")?.z ?? -1800 },
    to: { x: -112, z: -118 },
    endpointPopulations: [Or("dustmere")?.population ?? 1420, 48],
  },
  {
    id: "old-relay-spur:east",
    class: "local",
    kind: "service",
    from: { x: -112, z: -118 },
    to: { x: 38, z: -52 },
    endpointPopulations: [48, 34],
  },
  {
    id: "crownstep:crownspire-trailhead",
    class: "local",
    kind: "service",
    from: { x: Or("crownstep")?.x ?? -14784, z: Or("crownstep")?.z ?? -6432 },
    to: { ...me.baseWaypoint },
    endpointPopulations: [Or("crownstep")?.population ?? 720, 24],
  },
  {
    id: "rimstead:sunscar-overlook",
    class: "local",
    kind: "service",
    from: { x: Or("rimstead")?.x ?? 32640, z: Or("rimstead")?.z ?? -12e3 },
    to: { ...He.overlookWaypoint },
    endpointPopulations: [Or("rimstead")?.population ?? 920, 28],
  },
];
function vf(t, e, n, i, r, a) {
  let o = e.x - t.x,
    s = e.z - t.z,
    l = 0,
    c = 1,
    u = [
      [-o, t.x - n],
      [o, i - t.x],
      [-s, t.z - r],
      [s, a - t.z],
    ];
  for (let [h, d] of u) {
    if (h === 0) {
      if (d < 0) return null;
      continue;
    }
    let p = d / h;
    if ((h < 0 ? (l = Math.max(l, p)) : (c = Math.min(c, p)), l > c))
      return null;
  }
  return {
    start: { x: t.x + o * l, z: t.z + s * l },
    end: { x: t.x + o * c, z: t.z + s * c },
  };
}
var Z_ = (ur(ot) % 4096) / 4096;
function WN(t) {
  return Fi(4900, 5900, t / ei) * 38;
}
function XN(t, e, n) {
  let i = Math.sin(t * 0.013 + Z_ * 4.2) * 1.65,
    r = Math.cos(e * 0.015 - Z_ * 2.1) * 1.3,
    a = Math.sin((t + e) * 0.006 + Z_) * 2.4,
    o = Math.sin(t * 0.071) * Math.cos(e * 0.063) * 0.38 * n,
    s = Ey(t, e) + i + r + a + o - WN(e),
    l = Fi(gi(e) + 28, gi(e) - 4, Rd(t, e)),
    c = ci - 1.7 - Math.sin(e * 0.004) * 0.35;
  return V_(Y_(l1(s * (1 - l) + c * l, t, e), t, e, n), t, e);
}
function je(t, e) {
  return XN(t, e, 1);
}
function Ad(t, e, n) {
  let i = Number.isFinite(n) ? Math.max(0, n) : 0,
    r = 1 - Fi(22, 44, i);
  return XN(t, e, r);
}
function ol(t, e) {
  let n = Ey(t, e) - WN(e),
    i = Fi(gi(e) + 28, gi(e) - 4, Rd(t, e)),
    r = n * (1 - i) + ci * i;
  return V_(Y_(l1(Math.max(ci, r), t, e), t, e, 0), t, e);
}
function qn(t, e) {
  return { x: Math.floor((t + 96 / 2) / 96), z: Math.floor((e + 96 / 2) / 96) };
}
function ti(t, e) {
  return `${t}:${e}`;
}
function fr(t) {
  return { x: t.x * 96, z: t.z * 96 };
}
function Dd(t, e) {
  let n = [];
  for (let i = -e; i <= e; i += 1)
    for (let r = -e; r <= e; r += 1) n.push({ x: t.x + r, z: t.z + i });
  return n;
}
var K_ = { trunk: 9, regional: 6.2, local: 3.8 },
  YN = {
    megacity: { spacing: 34, width: 7.4 },
    city: { spacing: 48, width: 6.6 },
    town: { spacing: 72, width: 5.2 },
    village: { spacing: 92, width: 4.2 },
  };
function j_(t) {
  return Math.hypot(t.end.x - t.start.x, t.end.z - t.start.z);
}
function r8(t, e, n, i) {
  if (i <= 0) return null;
  let r = e.x - t.x,
    a = e.z - t.z,
    o = t.x - n.x,
    s = t.z - n.z,
    l = r * r + a * a;
  if (l < 1e-4) return null;
  let c = 2 * (o * r + s * a),
    u = o * o + s * s - i * i,
    h = c * c - 4 * l * u;
  if (h < 0) return u <= 0 ? { start: { ...t }, end: { ...e } } : null;
  let d = Math.sqrt(h),
    p = (-c - d) / (2 * l),
    f = (-c + d) / (2 * l),
    S = Math.max(0, Math.min(p, f)),
    v = Math.min(1, Math.max(p, f));
  return S > v
    ? null
    : {
        start: { x: t.x + r * S, z: t.z + a * S },
        end: { x: t.x + r * v, z: t.z + a * v },
      };
}
function _y(t, e, n, i, r, a, o, s) {
  let l = YN[t.tier];
  if (e === "x") {
    let S = n - t.z;
    if (Math.abs(S) >= t.radius) return null;
    let v = Math.sqrt(t.radius ** 2 - S ** 2),
      m = t.x - v,
      y = t.x + v,
      x = Math.max(r, m),
      g = Math.min(a, y);
    return g - x < 8
      ? null
      : {
          id: `street:${t.id}:x:${i}`,
          kind: "street",
          start: { x, z: n },
          end: { x: g, z: n },
          width: l.width,
          settlementId: t.id,
          capStart: Math.abs(x - m) < 0.001,
          capEnd: Math.abs(g - y) < 0.001,
        };
  }
  let c = n - t.x;
  if (Math.abs(c) >= t.radius) return null;
  let u = Math.sqrt(t.radius ** 2 - c ** 2),
    h = t.z - u,
    d = t.z + u,
    p = Math.max(o, h),
    f = Math.min(s, d);
  return f - p < 8
    ? null
    : {
        id: `street:${t.id}:z:${i}`,
        kind: "street",
        start: { x: n, z: p },
        end: { x: n, z: f },
        width: l.width,
        settlementId: t.id,
        capStart: Math.abs(p - h) < 0.001,
        capEnd: Math.abs(f - d) < 0.001,
      };
}
function a8(t, e, n, i, r) {
  let a = YN[t.tier],
    o = [],
    s = ur(t.id) % 2 === 0 ? "x" : "z",
    l = t.population >= 1500;
  if (t.tier === "village") {
    let p = _y(t, s, s === "x" ? t.z : t.x, 0, e, n, i, r);
    if ((p && o.push(p), l)) {
      let f = s === "x" ? "z" : "x",
        S = _y(t, f, f === "x" ? t.z : t.x, 0, e, n, i, r);
      S && o.push(S);
    }
    return o;
  }
  let c = Math.ceil((i - t.z) / a.spacing),
    u = Math.floor((r - t.z) / a.spacing);
  for (let p = c; p <= u; p += 1) {
    let f = _y(t, "x", t.z + p * a.spacing, p, e, n, i, r);
    f && o.push(f);
  }
  let h = Math.ceil((e - t.x) / a.spacing),
    d = Math.floor((n - t.x) / a.spacing);
  for (let p = h; p <= d; p += 1) {
    let f = _y(t, "z", t.x + p * a.spacing, p, e, n, i, r);
    f && o.push(f);
  }
  return o;
}
function qN(t, e) {
  let n = fr({ x: t, z: e }),
    i = 96 / 2,
    r = n.x - i,
    a = n.x + i,
    o = n.z - i,
    s = n.z + i,
    l = [];
  for (let c of Cd) {
    let u = vf(c.from, c.to, r, a, o, s);
    if (!u) continue;
    let h = {
      id: `road:${c.id}`,
      kind: "road",
      start: u.start,
      end: u.end,
      width: K_[c.class],
      roadClass: c.class,
      corridorId: c.id,
      capStart: Math.hypot(u.start.x - c.from.x, u.start.z - c.from.z) < 0.001,
      capEnd: Math.hypot(u.end.x - c.to.x, u.end.z - c.to.z) < 0.001,
    };
    j_(h) >= 0.5 && l.push(h);
  }
  return l;
}
function o8(t, e) {
  let n = fr({ x: t, z: e }),
    i = 96 / 2,
    r = n.x - i,
    a = n.x + i,
    o = n.z - i,
    s = n.z + i,
    l = Math.min(me.center.x - me.footprintRadius, me.baseWaypoint.x),
    c = me.center.x + me.footprintRadius,
    u = me.center.z - me.footprintRadius,
    h = me.center.z + me.footprintRadius;
  if (a < l || r > c || s < u || o > h) return [];
  let d = [];
  for (let p = 0; p < Ko.length - 1; p += 1) {
    let f = Ko[p],
      S = Ko[p + 1],
      v = vf(f, S, r, a, o, s);
    if (!v) continue;
    let m = {
      id: `trail:crownspire:${p}`,
      kind: "trail",
      start: v.start,
      end: v.end,
      width: me.trailWidth,
      corridorId: me.trailheadId,
      capStart: Math.hypot(v.start.x - f.x, v.start.z - f.z) < 0.001,
      capEnd: Math.hypot(v.end.x - S.x, v.end.z - S.z) < 0.001,
    };
    j_(m) >= 0.5 && d.push(m);
  }
  return d;
}
function s8(t, e) {
  let n = fr({ x: t, z: e }),
    i = 96 / 2,
    r = n.x - i,
    a = n.x + i,
    o = n.z - i,
    s = n.z + i;
  if (a < Zo.minX || r > Zo.maxX || s < Zo.minZ || o > Zo.maxZ) return [];
  let l = [];
  for (let c = 0; c < Lr.length - 1; c += 1) {
    let u = Lr[c],
      h = Lr[c + 1],
      d = vf(u, h, r, a, o, s);
    if (!d) continue;
    let p = {
      id: `trail:sunscar-rim:${c}`,
      kind: "trail",
      start: d.start,
      end: d.end,
      width: He.rimTrailWidth,
      corridorId: He.overlookId,
      capStart: Math.hypot(d.start.x - u.x, d.start.z - u.z) < 0.001,
      capEnd: Math.hypot(d.end.x - h.x, d.end.z - h.z) < 0.001,
    };
    j_(p) >= 0.5 && l.push(p);
  }
  return l;
}
function ZN(t, e) {
  let n = fr({ x: t, z: e }),
    i = 96 / 2,
    r = n.x - i,
    a = n.x + i,
    o = n.z - i,
    s = n.z + i;
  return bc(n.x, n.z, 96 * 0.72).flatMap((l) => a8(l, r, a, o, s));
}
function yf(t, e) {
  return [...qN(t, e), ...o8(t, e), ...s8(t, e), ...ZN(t, e)];
}
function l8(t, e, n, i, r, a) {
  let o = t.end.x - t.start.x,
    s = t.end.z - t.start.z,
    l = Math.hypot(o, s);
  if (l < 8) return [];
  let c = t.width / 2 + (t.kind === "street" ? 1.15 : 1.3),
    u = -s / l,
    h = o / l,
    d = [];
  for (let p of [-1, 1]) {
    let f = {
      start: { x: t.start.x + u * c * p, z: t.start.z + h * c * p },
      end: { x: t.end.x + u * c * p, z: t.end.z + h * c * p },
    };
    (a && (f = r8(f.start, f.end, a, Math.max(1, a.radius - 0.5))),
      f &&
        ((f = vf(f.start, f.end, e, n, i, r)),
        f &&
          (Math.hypot(f.end.x - f.start.x, f.end.z - f.start.z) < 6 ||
            d.push({
              id: `${t.id}:walk:${p < 0 ? "a" : "b"}`,
              source: t.kind === "street" ? "settlement" : "road",
              sourceId: t.settlementId ?? t.corridorId ?? t.id,
              start: f.start,
              end: f.end,
              roadClass: t.roadClass,
              settlementId: t.settlementId,
              corridorId: t.corridorId,
            }))));
  }
  return d;
}
function KN(t, e) {
  let n = fr({ x: t, z: e }),
    i = 96 / 2,
    r = n.x - i,
    a = n.x + i,
    o = n.z - i,
    s = n.z + i,
    l = ZN(t, e),
    c = new Map(bc(n.x, n.z, 96).map((u) => [u.id, u]));
  return [...qN(t, e), ...l].flatMap((u) =>
    l8(u, r, a, o, s, u.settlementId ? (c.get(u.settlementId) ?? null) : null),
  );
}
function My(t, e) {
  let n = e.end.x - e.start.x,
    i = e.end.z - e.start.z,
    r = n * n + i * i;
  if (r <= 1e-4) return Math.hypot(t.x - e.start.x, t.z - e.start.z);
  let a = Math.min(
    1,
    Math.max(0, ((t.x - e.start.x) * n + (t.z - e.start.z) * i) / r),
  );
  return Math.hypot(t.x - (e.start.x + n * a), t.z - (e.start.z + i * a));
}
function sl(t, e, n = 0) {
  if (!Number.isFinite(t) || !Number.isFinite(e)) return !0;
  let i = Math.max(0, Number.isFinite(n) ? n : 0);
  return Rd(t, e) <= gi(e) + i || e >= 4900 * ei - i || rD(t, e, i)
    ? !0
    : Td(t, e, i);
}
var c8 = 6,
  Q_ = { ultra: 72, cinematic: 72, performance: 36 },
  so = {
    marsh_deer: {
      id: "marsh_deer",
      label: "Greywater deer",
      body: "grazer",
      bodyColor: 7759184,
      accentColor: 12694417,
      scale: 0.92,
      minGroup: 1,
      maxGroup: 3,
      speed: 0.12,
      roamRadius: 6,
      flying: !1,
    },
    reed_heron: {
      id: "reed_heron",
      label: "Reed heron",
      body: "bird",
      bodyColor: 10988192,
      accentColor: 3160122,
      scale: 0.9,
      minGroup: 1,
      maxGroup: 2,
      speed: 0.1,
      roamRadius: 8,
      flying: !0,
    },
    sable_elk: {
      id: "sable_elk",
      label: "Sable elk",
      body: "grazer",
      bodyColor: 6048571,
      accentColor: 12363645,
      scale: 1.14,
      minGroup: 2,
      maxGroup: 4,
      speed: 0.1,
      roamRadius: 7,
      flying: !1,
    },
    forest_boar: {
      id: "forest_boar",
      label: "Forest boar",
      body: "stocky",
      bodyColor: 4275512,
      accentColor: 8221022,
      scale: 0.82,
      minGroup: 1,
      maxGroup: 3,
      speed: 0.14,
      roamRadius: 5,
      flying: !1,
    },
    crown_goat: {
      id: "crown_goat",
      label: "Crown mountain goat",
      body: "grazer",
      bodyColor: 9867653,
      accentColor: 4144441,
      scale: 0.84,
      minGroup: 1,
      maxGroup: 3,
      speed: 0.11,
      roamRadius: 5,
      flying: !1,
    },
    ridge_raven: {
      id: "ridge_raven",
      label: "Ridge raven",
      body: "bird",
      bodyColor: 2369578,
      accentColor: 4871256,
      scale: 0.66,
      minGroup: 1,
      maxGroup: 3,
      speed: 0.16,
      roamRadius: 10,
      flying: !0,
    },
    steppe_pronghorn: {
      id: "steppe_pronghorn",
      label: "Steppe pronghorn",
      body: "grazer",
      bodyColor: 10648913,
      accentColor: 14731421,
      scale: 0.88,
      minGroup: 2,
      maxGroup: 4,
      speed: 0.15,
      roamRadius: 8,
      flying: !1,
    },
    dune_fox: {
      id: "dune_fox",
      label: "Dune fox",
      body: "small",
      bodyColor: 10971458,
      accentColor: 14727565,
      scale: 0.72,
      minGroup: 1,
      maxGroup: 1,
      speed: 0.18,
      roamRadius: 6,
      flying: !1,
    },
    glass_lizard: {
      id: "glass_lizard",
      label: "Glassback lizard",
      body: "reptile",
      bodyColor: 8022096,
      accentColor: 11701081,
      scale: 0.66,
      minGroup: 1,
      maxGroup: 2,
      speed: 0.2,
      roamRadius: 3.5,
      flying: !1,
    },
    salt_gull: {
      id: "salt_gull",
      label: "Salt gull",
      body: "bird",
      bodyColor: 13881535,
      accentColor: 5199190,
      scale: 0.72,
      minGroup: 2,
      maxGroup: 3,
      speed: 0.18,
      roamRadius: 11,
      flying: !0,
    },
    meadow_hare: {
      id: "meadow_hare",
      label: "Meadow hare",
      body: "small",
      bodyColor: 8942428,
      accentColor: 12957852,
      scale: 0.56,
      minGroup: 1,
      maxGroup: 2,
      speed: 0.22,
      roamRadius: 4,
      flying: !1,
    },
  },
  u8 = {
    riverlands: [
      { id: "marsh_deer", weight: 0.58 },
      { id: "reed_heron", weight: 0.42 },
    ],
    pine_forest: [
      { id: "sable_elk", weight: 0.55 },
      { id: "forest_boar", weight: 0.3 },
      { id: "ridge_raven", weight: 0.15 },
    ],
    crown_highlands: [
      { id: "crown_goat", weight: 0.72 },
      { id: "ridge_raven", weight: 0.28 },
    ],
    warden_steppe: [
      { id: "steppe_pronghorn", weight: 0.68 },
      { id: "dune_fox", weight: 0.32 },
    ],
    glass_badlands: [
      { id: "glass_lizard", weight: 0.76 },
      { id: "ridge_raven", weight: 0.24 },
    ],
    salt_coast: [
      { id: "salt_gull", weight: 0.74 },
      { id: "reed_heron", weight: 0.26 },
    ],
    grey_meadow: [
      { id: "meadow_hare", weight: 0.42 },
      { id: "marsh_deer", weight: 0.35 },
      { id: "dune_fox", weight: 0.23 },
    ],
  };
function d8(t, e) {
  let n = u8[t],
    i = Math.min(0.999999, Math.max(0, e)),
    r = 0;
  for (let a of n) if (((r += a.weight), i <= r)) return so[a.id];
  return so[n[n.length - 1].id];
}
function jN(t, e) {
  let n = ti(t, e),
    i = fr({ x: t, z: e }),
    r = ui(i.x, i.z),
    a = xc(i.x, i.z);
  if (a.distance < a.settlement.radius + 34) return [];
  let o = kt(`${ot}:animals:v1:${n}`),
    s = 0.22 + r.moisture * 0.08;
  if (o() > s) return [];
  let l = d8(r.biome.id, o()),
    c = Math.min(
      c8,
      l.minGroup + Math.floor(o() * (l.maxGroup - l.minGroup + 1)),
    ),
    u = yf(t, e),
    h = null;
  for (let p = 0; p < 24; p += 1) {
    let f = i.x + Kt(o, -96 * 0.37, 96 * 0.37),
      S = i.z + Kt(o, -96 * 0.37, 96 * 0.37);
    if (Yl(f, S, l.scale + 1.5) || sl(f, S, l.scale + 0.18)) continue;
    let v = xc(f, S);
    if (
      !(v.distance < v.settlement.radius + 28) &&
      !u.some((m) => My({ x: f, z: S }, m) < m.width * 0.5 + 9)
    ) {
      h = { x: f, z: S };
      break;
    }
  }
  if (!h) return [];
  let d = [];
  for (let p = 0; p < c; p += 1) {
    let f = o() * Math.PI * 2,
      S = p === 0 ? 0 : Kt(o, 1.2, 4.2);
    d.push({
      id: `animal:${l.id}:v1:${n}:${p}`,
      speciesId: l.id,
      x: h.x + Math.cos(f) * S,
      z: h.z + Math.sin(f) * S,
      scale: l.scale * Kt(o, 0.86, 1.12),
      heading: o() * Math.PI * 2,
      speed: l.speed * Kt(o, 0.82, 1.18),
      roamRadius: l.roamRadius * Kt(o, 0.72, 1),
      phase: o() * Math.PI * 2,
      flightHeight: l.flying ? Kt(o, 2.8, 7.5) : 0,
    });
  }
  return d;
}
function QN(t, e) {
  let n = Math.max(0, Math.floor(t)),
    i = qualityHasHighDetail(e) ? n : Math.ceil(n * 0.55);
  return Math.min(i, Q_[e]);
}
function wy(t, e) {
  let n = Number.isFinite(e) ? Math.max(0, e) : 0,
    i = so[t.speciesId],
    r = t.phase + n * t.speed,
    a = t.x + Math.cos(r) * t.roamRadius,
    o = t.z + Math.sin(r * 0.83) * t.roamRadius * 0.72,
    s = -Math.sin(r) * t.roamRadius,
    l = Math.cos(r * 0.83) * t.roamRadius * 0.72 * 0.83,
    c = je(a, o);
  return {
    x: a,
    y: c + (i.flying ? t.flightHeight + Math.sin(r * 1.7) * 0.35 : 0),
    z: o,
    yaw: Math.atan2(s, l),
  };
}
var h8 = Object.values(so).map((t) => ({
    id: `guide:animal:${t.id}:v1`,
    category: "fauna",
    title: t.label,
    summary: t.flying
      ? "A regional flying species tracked through rigid silhouette and habitat records."
      : "A regional ground species whose range follows climate, water and settlement pressure.",
  })),
  p8 = [
    [
      "meadow-grass",
      "Grey meadow grass",
      "Hardy grassland cover that stabilizes the basin soil.",
    ],
    [
      "sable-fern",
      "Sablewood fern",
      "Dense shade flora adapted to the western forest floor.",
    ],
    [
      "river-reed",
      "Greywater reed",
      "Wetland cover concentrated near the river and estuary.",
    ],
    [
      "steppe-sage",
      "Warden sage",
      "Low aromatic scrub adapted to dry wind and shallow soil.",
    ],
    [
      "badland-succulent",
      "Glassland succulent",
      "Water-storing flora rooted in fractured mineral soil.",
    ],
    [
      "coast-dunegrass",
      "Salt dunegrass",
      "Salt-tolerant grass that binds exposed coastal sand.",
    ],
    [
      "crown-heather",
      "Crown heather",
      "Compact highland vegetation resistant to frost and wind.",
    ],
  ].map(([t, e, n]) => ({
    id: `guide:flora:${t}:v1`,
    category: "flora",
    title: e,
    summary: n,
  })),
  f8 = [
    ["stone", "Structural stone", "Common aggregate and masonry material."],
    [
      "wood",
      "Workable timber",
      "Renewable structural material gathered from woody vegetation.",
    ],
    [
      "fiber",
      "Plant fiber",
      "Flexible field material used for fabric and cordage.",
    ],
    [
      "ore",
      "Mineral-bearing ore",
      "Unrefined rock containing useful metallic compounds.",
    ],
    [
      "relic",
      "Old-world salvage",
      "Recoverable machinery and pre-migration components.",
    ],
  ].map(([t, e, n]) => ({
    id: `guide:resource:${t}:v1`,
    category: "resource",
    title: e,
    summary: n,
  })),
  m8 = [
    {
      id: "guide:landmark:field-unit-weather-mast:v1",
      category: "landmark",
      title: "Field Unit weather mast",
      summary: "A calibrated compound instrument used as the scanner baseline.",
    },
    ...RELAYS.map((t) => ({
      id: `guide:landmark:${t.id}:v1`,
      category: "landmark",
      title: t.name,
      summary: t.note,
    })),
  ],
  ll = Object.freeze([...h8, ...p8, ...f8, ...m8]),
  g8 = new Set(ll.map((t) => t.id));
function $_(t) {
  return typeof t == "string" && g8.has(t);
}
function Id(t) {
  return ll.find((e) => e.id === t) ?? null;
}
function $N(t, e) {
  return !$_(e) || t.includes(e) ? [...t] : [...t, e].sort();
}
function JN(t) {
  return Array.isArray(t)
    ? [...new Set(t)].filter($_).slice(0, ll.length).sort()
    : [];
}
function e3(t, e, n, i = () => !0) {
  let r = null;
  for (let a of t) {
    if (!$_(a.entryId)) continue;
    let o = a.position.x - e.x,
      s = a.position.y - e.y,
      l = a.position.z - e.z,
      c = Math.hypot(o, s, l);
    if (!Number.isFinite(c) || c <= 0 || c > a.maxDistance) continue;
    let u = (n.x * o + n.y * s + n.z * l) / c;
    if (u < 0.9) continue;
    let h = c + (1 - u) * 32;
    (r && h >= r.distance + (1 - r.alignment) * 32) ||
      (i(a) && (r = { candidate: a, distance: c, alignment: u }));
  }
  return r;
}
var lo = 1440,
  Sc = 450,
  bf = 1e7,
  Pd = 1,
  xf = 180,
  v8 = 36;
var Sf = {
  riverlands: [
    {
      id: "fair",
      label: "Riverbreak fair",
      weight: 28,
      cloudCover: 0.14,
      fogDensity: 0.0032,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 10,
      temperatureOffset: 1,
      dust: 0,
    },
    {
      id: "overcast",
      label: "Low river cloud",
      weight: 22,
      cloudCover: 0.72,
      fogDensity: 0.0041,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 14,
      temperatureOffset: -1,
      dust: 0,
    },
    {
      id: "fog",
      label: "Greywater mist",
      weight: 16,
      cloudCover: 0.62,
      fogDensity: 0.0095,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 4,
      temperatureOffset: -2,
      dust: 0,
    },
    {
      id: "rain",
      label: "Basin rain",
      weight: 22,
      cloudCover: 0.88,
      fogDensity: 0.0062,
      precipitation: "rain",
      precipitationRate: 0.68,
      windKph: 24,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "storm",
      label: "Greywater thunderhead",
      weight: 12,
      cloudCover: 1,
      fogDensity: 0.0084,
      precipitation: "rain",
      precipitationRate: 1,
      windKph: 48,
      temperatureOffset: -4,
      dust: 0,
    },
  ],
  pine_forest: [
    {
      id: "fair",
      label: "Canopy clear",
      weight: 24,
      cloudCover: 0.2,
      fogDensity: 0.0038,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 8,
      temperatureOffset: 0,
      dust: 0,
    },
    {
      id: "overcast",
      label: "Sable overcast",
      weight: 24,
      cloudCover: 0.76,
      fogDensity: 0.0048,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 12,
      temperatureOffset: -2,
      dust: 0,
    },
    {
      id: "fog",
      label: "Pine-floor fog",
      weight: 19,
      cloudCover: 0.68,
      fogDensity: 0.0105,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 3,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "rain",
      label: "Canopy drizzle",
      weight: 26,
      cloudCover: 0.9,
      fogDensity: 0.0068,
      precipitation: "rain",
      precipitationRate: 0.56,
      windKph: 18,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "storm",
      label: "Timber rain",
      weight: 7,
      cloudCover: 1,
      fogDensity: 0.0082,
      precipitation: "rain",
      precipitationRate: 0.88,
      windKph: 38,
      temperatureOffset: -5,
      dust: 0,
    },
  ],
  crown_highlands: [
    {
      id: "fair",
      label: "Cold highland clear",
      weight: 20,
      cloudCover: 0.12,
      fogDensity: 0.003,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 22,
      temperatureOffset: -6,
      dust: 0,
    },
    {
      id: "overcast",
      label: "Stone-grey ceiling",
      weight: 20,
      cloudCover: 0.82,
      fogDensity: 0.0046,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 28,
      temperatureOffset: -8,
      dust: 0,
    },
    {
      id: "snow",
      label: "Crown snow",
      weight: 26,
      cloudCover: 0.9,
      fogDensity: 0.0074,
      precipitation: "snow",
      precipitationRate: 0.72,
      windKph: 25,
      temperatureOffset: -12,
      dust: 0,
    },
    {
      id: "storm",
      label: "Highland sleet",
      weight: 16,
      cloudCover: 1,
      fogDensity: 0.0088,
      precipitation: "sleet",
      precipitationRate: 0.9,
      windKph: 52,
      temperatureOffset: -10,
      dust: 0,
    },
    {
      id: "dry_wind",
      label: "Crown gale",
      weight: 18,
      cloudCover: 0.34,
      fogDensity: 0.0038,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 64,
      temperatureOffset: -7,
      dust: 0,
    },
  ],
  warden_steppe: [
    {
      id: "fair",
      label: "Open steppe",
      weight: 40,
      cloudCover: 0.1,
      fogDensity: 0.0029,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 18,
      temperatureOffset: 3,
      dust: 0,
    },
    {
      id: "overcast",
      label: "Prairie overcast",
      weight: 16,
      cloudCover: 0.7,
      fogDensity: 0.0037,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 22,
      temperatureOffset: -1,
      dust: 0,
    },
    {
      id: "dry_wind",
      label: "Warden crosswind",
      weight: 25,
      cloudCover: 0.2,
      fogDensity: 0.0034,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 48,
      temperatureOffset: 2,
      dust: 0.16,
    },
    {
      id: "dust",
      label: "Loam blow",
      weight: 15,
      cloudCover: 0.45,
      fogDensity: 0.0068,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 58,
      temperatureOffset: 4,
      dust: 0.72,
    },
    {
      id: "rain",
      label: "Rare steppe rain",
      weight: 4,
      cloudCover: 0.82,
      fogDensity: 0.0052,
      precipitation: "rain",
      precipitationRate: 0.42,
      windKph: 28,
      temperatureOffset: -2,
      dust: 0,
    },
  ],
  glass_badlands: [
    {
      id: "fair",
      label: "Glass-clear heat",
      weight: 42,
      cloudCover: 0.05,
      fogDensity: 0.0028,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 12,
      temperatureOffset: 8,
      dust: 0.06,
    },
    {
      id: "dry_wind",
      label: "Kiln wind",
      weight: 28,
      cloudCover: 0.13,
      fogDensity: 0.0032,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 46,
      temperatureOffset: 7,
      dust: 0.24,
    },
    {
      id: "dust",
      label: "Glass dust storm",
      weight: 26,
      cloudCover: 0.62,
      fogDensity: 0.0086,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 66,
      temperatureOffset: 5,
      dust: 1,
    },
    {
      id: "overcast",
      label: "Ash-white ceiling",
      weight: 4,
      cloudCover: 0.65,
      fogDensity: 0.004,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 20,
      temperatureOffset: 2,
      dust: 0.08,
    },
  ],
  salt_coast: [
    {
      id: "fair",
      label: "Salt-bright fair",
      weight: 24,
      cloudCover: 0.18,
      fogDensity: 0.0034,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 18,
      temperatureOffset: 1,
      dust: 0,
    },
    {
      id: "overcast",
      label: "Marine layer",
      weight: 20,
      cloudCover: 0.82,
      fogDensity: 0.0052,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 17,
      temperatureOffset: -2,
      dust: 0,
    },
    {
      id: "fog",
      label: "Coastal fog",
      weight: 22,
      cloudCover: 0.76,
      fogDensity: 0.011,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 7,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "rain",
      label: "Salt rain",
      weight: 22,
      cloudCover: 0.92,
      fogDensity: 0.0069,
      precipitation: "rain",
      precipitationRate: 0.64,
      windKph: 30,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "storm",
      label: "Coastal squall",
      weight: 12,
      cloudCover: 1,
      fogDensity: 0.0092,
      precipitation: "rain",
      precipitationRate: 1,
      windKph: 70,
      temperatureOffset: -5,
      dust: 0,
    },
  ],
  grey_meadow: [
    {
      id: "fair",
      label: "Meadow fair",
      weight: 30,
      cloudCover: 0.14,
      fogDensity: 0.0031,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 12,
      temperatureOffset: 1,
      dust: 0,
    },
    {
      id: "overcast",
      label: "March overcast",
      weight: 23,
      cloudCover: 0.74,
      fogDensity: 0.0042,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 17,
      temperatureOffset: -2,
      dust: 0,
    },
    {
      id: "fog",
      label: "Low meadow mist",
      weight: 14,
      cloudCover: 0.66,
      fogDensity: 0.009,
      precipitation: "none",
      precipitationRate: 0,
      windKph: 5,
      temperatureOffset: -2,
      dust: 0,
    },
    {
      id: "rain",
      label: "March rain",
      weight: 23,
      cloudCover: 0.9,
      fogDensity: 0.0061,
      precipitation: "rain",
      precipitationRate: 0.62,
      windKph: 24,
      temperatureOffset: -3,
      dust: 0,
    },
    {
      id: "storm",
      label: "Basin thunderhead",
      weight: 10,
      cloudCover: 1,
      fogDensity: 0.008,
      precipitation: "rain",
      precipitationRate: 0.96,
      windKph: 50,
      temperatureOffset: -5,
      dust: 0,
    },
  ],
};
function Ma(t) {
  return Number.isFinite(t) ? Math.min(bf, Math.max(0, t)) : Sc;
}
function y8(t) {
  return t >= 300 && t < 420
    ? "dawn"
    : t >= 420 && t < 1020
      ? "day"
      : t >= 1020 && t < 1140
        ? "dusk"
        : "night";
}
function x8(t) {
  let e = Ma(t),
    i = Math.floor(e) % lo,
    r = i / lo,
    a = Math.sin((r - 0.25) * Math.PI * 2),
    o = Fi(-0.12, 0.25, a),
    s = 1 - Math.min(1, Math.abs(a - 0.08) / 0.34);
  return {
    totalMinutes: e,
    minuteOfDay: i,
    day: Math.floor(e / lo) + 1,
    hour: Math.floor(i / 60),
    minute: i % 60,
    phase: y8(i),
    sunElevation: a,
    sunAzimuth: (e / lo) * Math.PI * 2 + 0.38,
    daylight: o,
    goldenHour: s * Fi(-0.1, 0.12, a),
    night: 1 - o,
  };
}
function t3(t, e, n) {
  let i = Sf[e],
    r = kt(`${t}:weather:${e}:${n}`),
    a = i.reduce((c, u) => c + u.weight, 0),
    o = r() * a,
    s = 0,
    l = i[i.length - 1];
  for (let c of i)
    if (((s += c.weight), o <= s)) {
      l = c;
      break;
    }
  return { definition: l, direction: r() * 360 };
}
function Nd(t, e, n) {
  return t + (e - t) * n;
}
function b8(t, e, n) {
  let i = ((e - t + 540) % 360) - 180;
  return (t + i * n + 360) % 360;
}
function S8(t, e, n, i = ot) {
  let r = Ma(n),
    a = Math.floor(r / xf),
    o = (r - a * xf) / xf,
    s = 1 - v8 / xf,
    l = Fi(s, 1, o),
    c = t3(i, t, a),
    u = t3(i, t, a + 1),
    h = l < 0.5 ? c.definition : u.definition,
    d = l < 0.5 ? c.definition.precipitation : u.definition.precipitation,
    p = Nd(c.definition.fogDensity, u.definition.fogDensity, l),
    f = -8 + e.temperature * 36;
  return {
    weatherId: h.id,
    weatherLabel: h.label,
    cloudCover: Nd(c.definition.cloudCover, u.definition.cloudCover, l),
    fogDensity: p,
    precipitation: d,
    precipitationRate: Nd(
      c.definition.precipitationRate,
      u.definition.precipitationRate,
      l,
    ),
    windKph: Nd(c.definition.windKph, u.definition.windKph, l),
    windDirection: b8(c.direction, u.direction, l),
    temperatureC:
      f + Nd(c.definition.temperatureOffset, u.definition.temperatureOffset, l),
    dust: Nd(c.definition.dust, u.definition.dust, l),
    visibilityMeters: Math.round(Math.min(12e3, Math.max(120, 1.978 / p))),
    transition: l,
    epoch: a,
  };
}
function E8(t, e, n, i, r = ot) {
  let a = Sf[t].find((u) => u.id === i);
  if (!a) return null;
  let o = Ma(n),
    s = Math.floor(o / xf),
    l = kt(`${r}:developer-weather:${t}:${i}`),
    c = a.fogDensity;
  return {
    weatherId: a.id,
    weatherLabel: a.label,
    cloudCover: a.cloudCover,
    fogDensity: c,
    precipitation: a.precipitation,
    precipitationRate: a.precipitationRate,
    windKph: a.windKph,
    windDirection: l() * 360,
    temperatureC: -8 + e.temperature * 36 + a.temperatureOffset,
    dust: a.dust,
    visibilityMeters: Math.round(Math.min(12e3, Math.max(120, 1.978 / c))),
    transition: 1,
    epoch: s,
  };
}
function Ty(t, e, n = ot, i = null) {
  let r = x8(t),
    a =
      (i ? E8(e.biome.id, e, r.totalMinutes, i, n) : null) ??
      S8(e.biome.id, e, r.totalMinutes, n);
  return {
    ...r,
    ...a,
    biomeId: e.biome.id,
    lightScale: (0.16 + r.daylight * 0.84) * (1 - a.cloudCover * 0.52),
    exposure: 0.61 + r.daylight * 0.54 - a.cloudCover * 0.08,
  };
}
var CONTRACTS = [
  {
    id: "contract:field-calibration:v1",
    code: "FC-01",
    title: "Field calibration",
    summary: "Validate the compound workflow before taking remote assignments.",
    issuerNpcId: "npc:mara-venn:v1",
    objectives: [
      {
        id: "inspect-orders",
        label: "Read the Field Unit standing orders",
        amount: 1,
        matcher: {
          type: "inspect",
          targetId: "inspectable:field-unit-noticeboard",
        },
        target: { x: 3, z: 4.5 },
      },
      {
        id: "collect-fiber",
        label: "Collect 2 plant fiber",
        amount: 2,
        matcher: { type: "collect", item: "fiber" },
        target: { x: 2.3, z: 5.4 },
      },
      {
        id: "scan-mast",
        label: "Hold the scanner on the weather mast",
        amount: 1,
        matcher: {
          type: "scan",
          entryId: "guide:landmark:field-unit-weather-mast:v1",
        },
        target: { x: -1.8, z: 3.4 },
      },
      {
        id: "return-mara",
        label: "Return to Coordinator Mara Venn",
        amount: 1,
        matcher: { type: "return", npcId: "npc:mara-venn:v1" },
        target: { x: 5.5, z: 5.5 },
      },
    ],
    rewards: { first_aid_kit: 1 },
  },
  {
    id: "contract:shelter-protocol:v1",
    code: "SP-02",
    title: "Shelter protocol",
    summary: "Fabricate and prove a minimal field camp before extended travel.",
    issuerNpcId: "npc:mara-venn:v1",
    objectives: [
      {
        id: "craft-bedroll",
        label: "Craft a survey bedroll",
        amount: 1,
        matcher: { type: "craft", recipeId: "recipe:bedroll:v1" },
        target: { x: 12, z: -6 },
      },
      {
        id: "place-bedroll",
        label: "Deploy the bedroll on clear ground",
        amount: 1,
        matcher: { type: "place", archetypeId: "bedroll" },
      },
      {
        id: "rest-field",
        label: "Complete at least one hour of field rest",
        amount: 60,
        matcher: { type: "rest" },
      },
      {
        id: "return-mara",
        label: "Report the camp result to Mara",
        amount: 1,
        matcher: { type: "return", npcId: "npc:mara-venn:v1" },
        target: { x: 5.5, z: 5.5 },
      },
    ],
    rewards: { weather_shelter: 1 },
  },
  {
    id: "contract:meridian-stores:v1",
    code: "MS-03",
    title: "Meridian stores",
    summary: "Audit the tower service cache and add a live fauna record.",
    issuerNpcId: "npc:mara-venn:v1",
    objectives: [
      {
        id: "inspect-directory",
        label: "Read the Meridian Tower directory",
        amount: 1,
        matcher: {
          type: "inspect",
          targetId: "inspectable:meridian-tower-directory",
        },
        target: { x: 4, z: 27.6 },
      },
      {
        id: "loot-service-cache",
        label: "Recover the tower service cache",
        amount: 1,
        matcher: {
          type: "loot",
          containerId: "container:meridian-tower:service-a",
        },
        target: { x: 3.05, z: 31.5 },
      },
      {
        id: "scan-fauna",
        label: "Catalog any regional animal",
        amount: 1,
        matcher: { type: "scan", category: "fauna" },
      },
      {
        id: "return-mara",
        label: "Return the audit to Mara",
        amount: 1,
        matcher: { type: "return", npcId: "npc:mara-venn:v1" },
        target: { x: 5.5, z: 5.5 },
      },
    ],
    rewards: { relic: 2, field_torch: 1 },
  },
  // Long-range assignments from the relay archivist. They reuse the contract
  // matchers above plus two more: "relay" (a relay record recovered by hand)
  // and "discover" (a named location logged by the survey).
  {
    id: "contract:relay-line:v1",
    code: "RL-04",
    title: "Relay line",
    summary:
      "Recover all three basin relay records so the archive can be checked against the living land.",
    issuerNpcId: "npc:ines-harrow:v1",
    objectives: [
      {
        id: "relay-amber",
        label: "Recover the Amber Relay record",
        amount: 1,
        matcher: { type: "relay", relayId: "amber-relay" },
        target: { x: 38, z: -52 },
      },
      {
        id: "relay-hollow",
        label: "Recover the Hollow Array record",
        amount: 1,
        matcher: { type: "relay", relayId: "hollow-array" },
        target: { x: -112, z: -118 },
      },
      {
        id: "relay-meridian",
        label: "Recover the Meridian Vault record",
        amount: 1,
        matcher: { type: "relay", relayId: "meridian-vault" },
        target: { x: 156, z: 76 },
      },
      {
        id: "return-ines",
        label: "Bring the records to Ines Harrow",
        amount: 1,
        matcher: { type: "return", npcId: "npc:ines-harrow:v1" },
        target: { x: 20.8, z: 15.2 },
      },
    ],
    rewards: { relic: 3, first_aid_kit: 1 },
  },
  {
    id: "contract:dustmere-waypoint:v1",
    code: "DW-05",
    title: "Dustmere waypoint",
    summary:
      "Walk the old relay road to Dustmere, stake it for the next crew and log what grows along the way.",
    issuerNpcId: "npc:ines-harrow:v1",
    objectives: [
      {
        id: "craft-marker",
        label: "Fabricate a survey marker",
        amount: 1,
        matcher: { type: "craft", recipeId: "recipe:survey-marker:v1" },
      },
      {
        id: "reach-dustmere",
        label: "Reach Dustmere village",
        amount: 1,
        matcher: { type: "discover", locationId: "settlement:dustmere" },
        target: { x: -1575, z: -1800 },
      },
      {
        id: "stake-road",
        label: "Deploy a survey marker on the road",
        amount: 1,
        matcher: { type: "place", archetypeId: "survey_marker" },
      },
      {
        id: "log-flora",
        label: "Catalog a regional plant",
        amount: 1,
        matcher: { type: "scan", category: "flora" },
      },
      {
        id: "return-ines",
        label: "Report the route to Ines Harrow",
        amount: 1,
        matcher: { type: "return", npcId: "npc:ines-harrow:v1" },
        target: { x: 20.8, z: 15.2 },
      },
    ],
    rewards: { survey_marker: 3, campfire_kit: 1, field_torch: 1 },
  },
];
function Qo(t) {
  return CONTRACTS.find((e) => e.id === t) ?? null;
}
function n3() {
  return { contracts: {}, activeContractId: null };
}
function Ec(t) {
  return Object.values(t.contracts).some(
    (e) => e?.status === "active" || e?.status === "ready",
  );
}
function i3(t, e, n) {
  let i = Qo(e);
  return !i || t.contracts[i.id] || Ec(t)
    ? { contracts: { ...t.contracts }, activeContractId: t.activeContractId }
    : {
        contracts: {
          ...t.contracts,
          [i.id]: {
            status: "active",
            acceptedAt: Ry(n),
            completedAt: null,
            objectiveProgress: {},
          },
        },
        activeContractId: i.id,
      };
}
function Ry(t, e = 0) {
  return Number.isFinite(t) ? Math.min(bf, Math.max(0, t)) : e;
}
function Ta(t, e) {
  return (
    t.objectives.find((n) => (e.objectiveProgress[n.id] ?? 0) < n.amount) ??
    null
  );
}
function _8(t, e) {
  if (t.type === "relay" && e.type === "relay.recovered")
    return e.relayId === t.relayId ? 1 : 0;
  if (t.type === "discover" && e.type === "location.discovered")
    return !t.locationId || e.locationId === t.locationId ? 1 : 0;
  if (t.type === "inspect" && e.type === "object.inspected")
    return e.targetId === t.targetId ? 1 : 0;
  if (t.type === "collect" && e.type === "item.collected")
    return e.item === t.item ? Math.max(0, e.quantity) : 0;
  if (t.type === "scan" && e.type === "subject.scanned") {
    if (t.entryId) return e.entryId === t.entryId ? 1 : 0;
    let n = Id(e.entryId);
    return n && n.category === t.category ? 1 : 0;
  }
  return t.type === "craft" && e.type === "item.crafted"
    ? e.recipeId === t.recipeId
      ? Math.max(0, e.quantity)
      : 0
    : t.type === "place" && e.type === "structure.placed"
      ? e.archetypeId === t.archetypeId
        ? 1
        : 0
      : t.type === "rest" && e.type === "rest.completed"
        ? Math.max(0, e.minutes)
        : t.type === "loot" && e.type === "container.looted"
          ? e.containerId === t.containerId && e.quantity > 0
            ? 1
            : 0
          : t.type === "return" &&
              e.type === "npc.talked" &&
              e.npcId === t.npcId
            ? 1
            : 0;
}
function Cy(t, e) {
  let n = !1,
    i = { ...t.contracts };
  for (let r of CONTRACTS) {
    let a = i[r.id];
    if (!a || a.status !== "active") continue;
    let o = Ta(r, a);
    if (!o) continue;
    let s = _8(o.matcher, e);
    if (s <= 0) continue;
    let l = {
        ...a.objectiveProgress,
        [o.id]: Math.min(o.amount, (a.objectiveProgress[o.id] ?? 0) + s),
      },
      c = { ...a, objectiveProgress: l };
    (Ta(r, c) || (c.status = "ready"), (i[r.id] = c), (n = !0));
  }
  return n
    ? { contracts: i, activeContractId: t.activeContractId }
    : { contracts: { ...t.contracts }, activeContractId: t.activeContractId };
}
function r3(t, e, n) {
  let i = Qo(e),
    r = i ? t.contracts[i.id] : null;
  if (!i || !r || r.status !== "ready")
    return {
      state: {
        contracts: { ...t.contracts },
        activeContractId: t.activeContractId,
      },
      rewards: null,
    };
  let a = {
      ...t.contracts,
      [i.id]: { ...r, status: "completed", completedAt: Ry(n, r.acceptedAt) },
    },
    o =
      t.activeContractId === i.id
        ? (CONTRACTS.find((s) => {
            let l = a[s.id]?.status;
            return l === "active" || l === "ready";
          })?.id ?? null)
        : t.activeContractId;
  return {
    state: { contracts: a, activeContractId: o },
    rewards: { ...i.rewards },
  };
}
function a3(t) {
  let e = t && typeof t == "object" && !Array.isArray(t) ? t : {},
    n = e.contracts && typeof e.contracts == "object" ? e.contracts : {},
    i = {};
  for (let s of CONTRACTS) {
    let l = n[s.id];
    if (!l || typeof l != "object" || Array.isArray(l)) continue;
    let c = l,
      u = {},
      h =
        c.objectiveProgress && typeof c.objectiveProgress == "object"
          ? c.objectiveProgress
          : {};
    for (let v of s.objectives) {
      let m = h[v.id];
      typeof m == "number" &&
        Number.isFinite(m) &&
        m > 0 &&
        (u[v.id] = Math.min(v.amount, Math.floor(m)));
    }
    let d = s.objectives.every((v) => (u[v.id] ?? 0) >= v.amount),
      f = c.status === "completed" && d ? "completed" : d ? "ready" : "active",
      S = Ry(typeof c.acceptedAt == "number" ? c.acceptedAt : Number.NaN);
    i[s.id] = {
      status: f,
      acceptedAt: S,
      completedAt:
        f === "completed" &&
        typeof c.completedAt == "number" &&
        Number.isFinite(c.completedAt)
          ? Math.max(S, Ry(c.completedAt, S))
          : null,
      objectiveProgress: u,
    };
  }
  let r = e.activeContractId,
    a = typeof r == "string" && Object.hasOwn(i, r) ? i[r] : null,
    o =
      a && a.status !== "completed"
        ? r
        : (CONTRACTS.find((s) => {
            let l = i[s.id]?.status;
            return l === "active" || l === "ready";
          })?.id ?? null);
  return { contracts: i, activeContractId: o };
}
var o3 = new WeakMap(),
  M8 = {
    terrain: {
      frequency: 192,
      colorStrength: 0.075,
      roughnessStrength: 0.12,
      normalStrength: 0.055,
      fadeStart: 24,
      fadeEnd: 230,
    },
    road: {
      frequency: 320,
      colorStrength: 0.065,
      roughnessStrength: 0.15,
      normalStrength: 0.045,
      fadeStart: 18,
      fadeEnd: 175,
    },
    rock: {
      frequency: 384,
      colorStrength: 0.09,
      roughnessStrength: 0.16,
      normalStrength: 0.085,
      fadeStart: 16,
      fadeEnd: 145,
    },
    building: {
      frequency: 128,
      colorStrength: 0.048,
      roughnessStrength: 0.1,
      normalStrength: 0.035,
      fadeStart: 24,
      fadeEnd: 190,
    },
    roof: {
      frequency: 192,
      colorStrength: 0.06,
      roughnessStrength: 0.13,
      normalStrength: 0.045,
      fadeStart: 20,
      fadeEnd: 205,
    },
    metal: {
      frequency: 256,
      colorStrength: 0.025,
      roughnessStrength: 0.07,
      normalStrength: 0.018,
      fadeStart: 14,
      fadeEnd: 110,
    },
    fabric: {
      frequency: 256,
      colorStrength: 0.035,
      roughnessStrength: 0.08,
      normalStrength: 0.025,
      fadeStart: 10,
      fadeEnd: 90,
    },
    prop: {
      frequency: 192,
      colorStrength: 0.035,
      roughnessStrength: 0.08,
      normalStrength: 0.025,
      fadeStart: 12,
      fadeEnd: 105,
    },
  },
  Ld = (t, e, n, i) =>
    Number.isFinite(t) ? THREE.MathUtils.clamp(t, n, i) : e;
function s3(t, e) {
  if (e === !1) return null;
  let n = M8[t];
  if (!n) return null;
  let i = Ld(e?.fadeStart, n.fadeStart, 0, 500);
  return {
    frequency: Math.round(Ld(e?.frequency, n.frequency, 32, 1024) / 4) * 4,
    colorStrength: Ld(e?.colorStrength, n.colorStrength, 0, 0.2),
    roughnessStrength: Ld(e?.roughnessStrength, n.roughnessStrength, 0, 0.35),
    normalStrength: Ld(e?.normalStrength, n.normalStrength, 0, 0.2),
    fadeStart: i,
    fadeEnd: Math.max(i + 1, Ld(e?.fadeEnd, n.fadeEnd, 1, 600)),
  };
}
// World surface effects as TSL node slots on MeshStandardNodeMaterial:
// fine surface detail (colour, roughness and a derivative bump), drifting
// cloud shadows and wet pooling. The weather state lives in shared uniforms
// written once per frame by WorldMaterialLibrary; the per-role constants are
// baked into node graphs that are cached and shared between materials, so a
// streamed-in chunk reuses built shaders instead of building its own.
var WORLD_SURFACE = {
    detailEnabled: uniform(1),
    cloudShadows: uniform(0),
    wetPooling: uniform(0),
    wetness: uniform(0),
    cloudCover: uniform(0),
    daylight: uniform(1),
    cloudOffset: uniform(new THREE.Vector2()),
  },
  STILLPOINT_TAU = 6.28318530718,
  stillpointPlaneDetail = Fn(([t, e]) => {
    let n = t.mul(STILLPOINT_TAU / 256),
      i = sin(n.x.mul(e).add(sin(n.y.mul(e).mul(0.5)).mul(1.35))),
      r = sin(n.y.mul(e).mul(0.75).sub(cos(n.x.mul(e).mul(0.25)).mul(1.8))),
      a = sin(n.x.add(n.y).mul(e).mul(1.5).add(i.mul(0.7)));
    return clamp(
      float(0.5).add(i.mul(0.23)).add(r.mul(0.18)).add(a.mul(0.09)),
      0,
      1,
    );
  }).setLayout({
    name: "stillpointPlaneDetail",
    type: "float",
    inputs: [
      { name: "point", type: "vec2" },
      { name: "frequency", type: "float" },
    ],
  }),
  stillpointCloudField = Fn(([t]) => {
    let e = t.mul(STILLPOINT_TAU / 2048),
      n = sin(e.x.mul(6).add(sin(e.y.mul(3)).mul(1.7))),
      i = sin(e.y.mul(9).sub(cos(e.x.mul(4)).mul(1.25))),
      r = sin(e.x.add(e.y).mul(13).add(n.mul(0.82)));
    return clamp(
      float(0.5).add(n.mul(0.24)).add(i.mul(0.17)).add(r.mul(0.09)),
      0,
      1,
    );
  }).setLayout({
    name: "stillpointCloudField",
    type: "float",
    inputs: [{ name: "point", type: "vec2" }],
  }),
  SURFACE_NODE_CACHE = new Map(),
  WORLD_HOOK_NODES = new WeakSet();
function buildSurfaceDetailNodes(t, e) {
  let n = WORLD_SURFACE,
    i = float(t.frequency),
    r = positionWorld.sub(cameraPosition),
    a = length(r),
    o = r.add(mod(mod(cameraPosition, 256).add(256), 256)),
    // Derivatives stay in uniform control flow (WGSL requires it): no If().
    s = dFdx(o),
    l = dFdy(o),
    c = max(pow(abs(normalize(cross(s, l))), vec3(4)), vec3(1e-4)),
    u = c.div(c.x.add(c.y).add(c.z)),
    h = stillpointPlaneDetail(o.yz, i)
      .mul(u.x)
      .add(stillpointPlaneDetail(o.xz, i).mul(u.y))
      .add(stillpointPlaneDetail(o.xy, i).mul(u.z)),
    d = max(length(dFdx(r)), length(dFdy(r))).mul(t.frequency / 256),
    p = n.detailEnabled.greaterThan(1e-4).and(a.lessThan(t.fadeEnd)),
    f = select(p, h, float(0.5)),
    S = select(
      p,
      n.detailEnabled
        .mul(float(1).sub(smoothstep(t.fadeStart, t.fadeEnd, a)))
        .mul(float(1).sub(smoothstep(0.32, 1.2, d))),
      float(0),
    ),
    v = f.mul(2).sub(1),
    m = n.wetness.mul(e),
    y = n.cloudShadows
      .greaterThan(1e-4)
      .and(n.cloudCover.greaterThan(0.04))
      .and(a.lessThan(432)),
    x = r
      .add(mod(mod(cameraPosition, 2048).add(2048), 2048))
      .xz.sub(n.cloudOffset.mul(4)),
    g = mix(float(0.77), float(0.39), n.cloudCover),
    E = select(
      y,
      smoothstep(g, g.add(0.18), stillpointCloudField(x))
        .mul(smoothstep(0.04, 0.48, n.cloudCover))
        .mul(n.daylight)
        .mul(e)
        .mul(n.cloudShadows)
        .mul(float(1).sub(smoothstep(240, 432, a))),
      float(0),
    ),
    M = cross(s, l),
    _ = abs(M.y.div(max(length(M), 1e-4))),
    b = n.wetPooling
      .greaterThan(1e-4)
      .and(m.greaterThan(0.015))
      .and(a.lessThan(210)),
    T = select(
      b,
      smoothstep(0.59, 0.82, stillpointPlaneDetail(o.xz, float(24)))
        .mul(smoothstep(0.68, 0.96, _))
        .mul(m)
        .mul(n.wetPooling)
        .mul(float(1).sub(smoothstep(110, 210, a))),
      float(0),
    ),
    R = materialColor
      .mul(float(1).add(v.mul(t.colorStrength).mul(S)))
      .mul(float(1).sub(E.mul(0.18)))
      .mul(float(1).sub(T.mul(0.085))),
    C = clamp(
      materialRoughness.add(
        v
          .mul(t.roughnessStrength)
          .mul(S)
          .mul(float(1).sub(m.mul(0.45))),
      ),
      0.04,
      1,
    ),
    P = mix(C, max(float(0.04), C.mul(0.38)), T.mul(0.76)),
    B = materialNormal,
    L = dFdx(positionView),
    O = dFdy(positionView),
    G = dFdx(f),
    F = dFdy(f),
    W = cross(O, B),
    U = cross(B, L),
    H = dot(L, W),
    ne = sign(H).mul(G.mul(W).add(F.mul(U))),
    ae = float(t.normalStrength)
      .mul(S)
      .mul(float(1).sub(m.mul(0.35))),
    _e = select(
      S.greaterThan(1e-4).and(ae.greaterThan(1e-4)),
      normalize(abs(H).mul(B).sub(ae.mul(ne))),
      B,
    ),
    Ue = { color: R, roughness: P, normal: _e };
  return (
    WORLD_HOOK_NODES.add(R),
    WORLD_HOOK_NODES.add(P),
    WORLD_HOOK_NODES.add(_e),
    Ue
  );
}
function installSurfaceDetail(t, e, n = 0) {
  let i = [
      e.frequency,
      e.colorStrength,
      e.roughnessStrength,
      e.normalStrength,
      e.fadeStart,
      e.fadeEnd,
      n,
    ].join("|"),
    r = SURFACE_NODE_CACHE.get(i);
  r || ((r = buildSurfaceDetailNodes(e, n)), SURFACE_NODE_CACHE.set(i, r));
  // A clone of a hooked material carries the hook nodes; never treat those
  // as the material's own nodes.
  let a = (l) => (l && WORLD_HOOK_NODES.has(l) ? null : l),
    o = {
      color: a(t.colorNode),
      roughness: a(t.roughnessNode),
      normal: a(t.normalNode),
    };
  ((t.colorNode = r.color),
    (t.roughnessNode = r.roughness),
    (t.normalNode = r.normal),
    (t.needsUpdate = !0));
  let s = !1;
  return {
    dispose() {
      s ||
        ((s = !0),
        t.colorNode === r.color && (t.colorNode = o.color),
        t.roughnessNode === r.roughness && (t.roughnessNode = o.roughness),
        t.normalNode === r.normal && (t.normalNode = o.normal),
        (t.needsUpdate = !0));
    },
  };
}
var I8 = "stillpointWindWeight";
function c3(t) {
  if (!Number.isFinite(t) || t <= 2) return 0;
  let e = THREE.MathUtils.clamp((t - 2) / 48, 0, 1);
  return e * e * (3 - 2 * e);
}
function _c(t, e) {
  let n = t.getAttribute("position");
  if (!n) return t;
  t.computeBoundingBox();
  let i = t.boundingBox,
    r = i?.min.y ?? 0,
    a = Math.max(0.001, (i?.max.y ?? r + 1) - r),
    o = new Float32Array(n.count);
  for (let l = 0; l < n.count; l += 1) {
    let c = THREE.MathUtils.clamp((n.getY(l) - r) / a, 0, 1);
    o[l] = c * c * (3 - 2 * c);
  }
  t.setAttribute(I8, new THREE.BufferAttribute(o, 1));
  let s = Number.isFinite(e) ? Math.max(0, e) : 0;
  return (
    t.computeBoundingBox(),
    t.boundingBox?.min.add(new THREE.Vector3(-s, 0, -s)),
    t.boundingBox?.max.add(new THREE.Vector3(s, 0, s)),
    t.computeBoundingSphere(),
    t.boundingSphere && (t.boundingSphere.radius += s),
    (t.userData.stillpointMaximumWindSway = s),
    t
  );
}
// Vegetation sway: the old vertex hook, now a vertexNode that bends the
// instanced, world-placed vertex along the wind. The per-vertex weight comes
// from the stillpointWindWeight attribute that _c() bakes into the geometry.
var WORLD_WIND = {
    enabled: uniform(1),
    time: uniform(0),
    direction: uniform(new THREE.Vector2(1, 0)),
    strength: uniform(0),
  },
  WIND_NODE_CACHE = new Map();
function buildVegetationWindNode(t) {
  let e = WORLD_WIND;
  return Fn(() => {
    let n = attribute(I8, "float"),
      i = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz,
      r = dot(i.xz, vec2(0.071, 0.053)).add(
        hash(instanceIndex).mul(STILLPOINT_TAU),
      ),
      a = sin(e.time.mul(float(0.72).add(e.strength.mul(0.84))).add(r)),
      o = sin(e.time.mul(1.91).add(r.mul(1.73))),
      s = sin(
        e.time
          .mul(3.35)
          .add(r.mul(2.47))
          .add(positionGeometry.y.mul(0.82)),
      ),
      l = float(t).mul(e.strength).mul(n).mul(e.enabled),
      c = a.mul(0.68).add(o.mul(0.24)).mul(l),
      u = s.mul(l).mul(0.13),
      h = vec3(e.direction.x, 0, e.direction.y),
      d = vec3(e.direction.y.negate(), 0, e.direction.x),
      p = positionWorld.add(h.mul(c)).add(d.mul(u));
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(p, 1));
  })();
}
function installVegetationWind(t, e) {
  let n = THREE.MathUtils.clamp(Number.isFinite(e) ? e : 0, 0, 1.5),
    i = n.toFixed(3),
    r = WIND_NODE_CACHE.get(i);
  r ||
    ((r = buildVegetationWindNode(n)),
    WIND_NODE_CACHE.set(i, r),
    WORLD_HOOK_NODES.add(r));
  let a = t.vertexNode && !WORLD_HOOK_NODES.has(t.vertexNode) ? t.vertexNode : null;
  ((t.vertexNode = r), (t.needsUpdate = !0));
  let o = !1;
  return {
    dispose() {
      o ||
        ((o = !0),
        t.vertexNode === r && (t.vertexNode = a),
        (t.needsUpdate = !0));
    },
  };
}
var d3 = "stillpointWorldMaterial",
  $o = (t, e) => (Number.isFinite(t) ? t : e),
  Ef = (t, e) => THREE.MathUtils.clamp($o(t, e), 0, 1);
function h3(t, e = 1) {
  let n = t.detail;
  return {
    role: t.role,
    weatherExposure: Ef(t.weatherExposure, 0),
    wetRoughness: Ef(t.wetRoughness, e * 0.65),
    environmentScale: Math.max(0, $o(t.environmentScale, 1)),
    wetReflectionBoost: Math.max(0, $o(t.wetReflectionBoost, 0.35)),
    detail: s3(t.role, n === null ? !1 : n),
    windAmplitude: THREE.MathUtils.clamp($o(t.windAmplitude, 0), 0, 1.5),
  };
}
function ln(t, e) {
  return (
    (t.userData[d3] = h3(
      e,
      t instanceof THREE.MeshStandardNodeMaterial ? t.roughness : 1,
    )),
    t
  );
}
function u3(t) {
  let e = t.userData[d3];
  return !e || typeof e.role != "string"
    ? null
    : h3(e, t instanceof THREE.MeshStandardNodeMaterial ? t.roughness : 1);
}
var WorldMaterialLibrary = class {
  constructor() {
    this.tracked = new Map();
    this.roots = new Map();
    this.wetness = 0;
    this.effectSeconds = 0;
    this.windKph = 0;
    this.windDirection = 0;
    this.cloudOffset = new THREE.Vector2();
    this.cloudCover = 0;
    this.daylight = 1;
    this.quality = "cinematic";
    this.features = {
      surfaceDetail: !0,
      vegetationWind: !0,
      cloudShadows: !0,
      wetSurfaces: !0,
    };
    this.disposed = !1;
  }
  track(e) {
    if (this.disposed || this.roots.has(e)) return;
    let n = new Set();
    e.traverse((i) => {
      if (!(i instanceof THREE.Mesh)) return;
      let r = Array.isArray(i.material) ? i.material : [i.material];
      for (let a of r)
        !u3(a) || !(a instanceof THREE.MeshStandardNodeMaterial) || n.add(a);
    });
    for (let i of n) this.retainMaterial(i);
    this.roots.set(e, { materials: n });
  }
  untrack(e) {
    let n = this.roots.get(e);
    if (n) {
      this.roots.delete(e);
      for (let i of n.materials) this.releaseMaterial(i);
    }
  }
  present(e) {
    this.disposed ||
      ((this.wetness = Ef(e.surfaceWetness, 0)),
      (this.effectSeconds = Math.max(
        0,
        $o(e.effectSeconds, this.effectSeconds),
      )),
      (this.windKph = Math.max(0, $o(e.windKph, this.windKph))),
      (this.windDirection = $o(e.windDirection, this.windDirection)),
      e.cloudOffset &&
        this.cloudOffset.set(
          $o(e.cloudOffset.x, this.cloudOffset.x),
          $o(e.cloudOffset.y, this.cloudOffset.y),
        ),
      (this.cloudCover = Ef(e.cloudCover, this.cloudCover)),
      (this.daylight = Ef(e.daylight, this.daylight)),
      this.apply());
  }
  setFeatures(e) {
    if (this.disposed) return;
    let n = {
      surfaceDetail: e.surfaceDetail,
      vegetationWind: e.vegetationWind,
      cloudShadows: e.cloudShadows,
      wetSurfaces: e.wetSurfaces,
    };
    if (
      !(
        n.surfaceDetail === this.features.surfaceDetail &&
        n.vegetationWind === this.features.vegetationWind &&
        n.cloudShadows === this.features.cloudShadows &&
        n.wetSurfaces === this.features.wetSurfaces
      )
    ) {
      this.features = n;
      for (let i of this.tracked.values()) this.rebuildShaderHooks(i);
      this.apply();
    }
  }
  setQuality(e) {
    this.disposed || this.quality === e || ((this.quality = e), this.apply());
  }
  get diagnostics() {
    let e = 0,
      n = 0,
      i = 0,
      r = 0;
    for (let a of this.tracked.values())
      (a.surfaceDetail && this.features.surfaceDetail && (e += 1),
        a.vegetationWind && (n += 1),
        a.surfaceDetail && this.features.cloudShadows && (i += 1),
        a.surfaceDetail && this.features.wetSurfaces && (r += 1));
    return {
      trackedMaterials: this.tracked.size,
      wetness: this.wetness,
      surfaceDetail: this.features.surfaceDetail,
      detailMaterials: e,
      vegetationWind: this.features.vegetationWind,
      windMaterials: n,
      cloudShadows: this.features.cloudShadows,
      cloudShadowMaterials: i,
      wetSurfaces: this.features.wetSurfaces,
      wetSurfaceMaterials: r,
    };
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0), this.roots.clear());
      for (let e of this.tracked.values()) this.restoreMaterial(e);
      this.tracked.clear();
    }
  }
  retainMaterial(e) {
    let n = this.tracked.get(e);
    if (n) {
      n.references += 1;
      return;
    }
    if (!(e instanceof THREE.MeshStandardNodeMaterial)) return;
    let i = u3(e);
    if (!i) return;
    let r =
        this.needsSurfaceShader() && i.detail
          ? installSurfaceDetail(e, i.detail, i.weatherExposure)
          : null,
      a =
        this.features.vegetationWind && i.windAmplitude > 0
          ? installVegetationWind(e, i.windAmplitude)
          : null,
      o = {
        material: e,
        descriptor: i,
        dryRoughness: e.roughness,
        dryEnvironmentIntensity: e.envMapIntensity,
        references: 1,
        surfaceDetail: r,
        vegetationWind: a,
      };
    (this.tracked.set(e, o), this.apply([o]));
  }
  releaseMaterial(e) {
    let n = this.tracked.get(e);
    n &&
      ((n.references -= 1),
      !(n.references > 0) && (this.restoreMaterial(n), this.tracked.delete(e)));
  }
  restoreMaterial(e) {
    (this.removeShaderHooks(e),
      (e.material.roughness = e.dryRoughness),
      (e.material.envMapIntensity = e.dryEnvironmentIntensity));
  }
  rebuildShaderHooks(e) {
    (this.removeShaderHooks(e),
      this.needsSurfaceShader() &&
        e.descriptor.detail &&
        (e.surfaceDetail = installSurfaceDetail(
          e.material,
          e.descriptor.detail,
          e.descriptor.weatherExposure,
        )),
      this.features.vegetationWind &&
        e.descriptor.windAmplitude > 0 &&
        (e.vegetationWind = installVegetationWind(
          e.material,
          e.descriptor.windAmplitude,
        )));
  }
  removeShaderHooks(e) {
    (e.vegetationWind?.dispose(),
      (e.vegetationWind = null),
      e.surfaceDetail?.dispose(),
      (e.surfaceDetail = null));
  }
  needsSurfaceShader() {
    return (
      this.features.surfaceDetail ||
      this.features.cloudShadows ||
      this.features.wetSurfaces
    );
  }
  apply(e = this.tracked.values()) {
    let n = QUALITY_PROFILES[this.quality].worldEffects,
      i = (this.windDirection * Math.PI) / 180,
      r = c3(this.windKph),
      a = WORLD_SURFACE,
      o = WORLD_WIND;
    // Shared weather state for every hooked material (one write per frame).
    ((a.detailEnabled.value = this.features.surfaceDetail
      ? n.surfaceDetailStrength
      : 0),
      (a.cloudShadows.value = this.features.cloudShadows
        ? n.surfaceDetailStrength
        : 0),
      (a.wetPooling.value = this.features.wetSurfaces
        ? n.surfaceDetailStrength
        : 0),
      (a.wetness.value = this.features.wetSurfaces ? this.wetness : 0),
      (a.cloudCover.value = this.cloudCover),
      (a.daylight.value = this.daylight),
      a.cloudOffset.value.copy(this.cloudOffset),
      (o.enabled.value = this.features.vegetationWind ? 1 : 0),
      (o.time.value = this.effectSeconds),
      o.direction.value.set(Math.cos(i), Math.sin(i)),
      (o.strength.value = r * n.vegetationWindStrength));
    for (let s of e) {
      let l = this.features.wetSurfaces
        ? s.descriptor.weatherExposure * this.wetness
        : 0;
      ((s.material.roughness = THREE.MathUtils.lerp(
        s.dryRoughness,
        s.descriptor.wetRoughness,
        l,
      )),
        (s.material.envMapIntensity =
          s.dryEnvironmentIntensity *
          s.descriptor.environmentScale *
          (1 + s.descriptor.wetReflectionBoost * l)));
    }
  }
};
function tM(t, e) {
  let n = t.buildingRotation ?? 0,
    i = Math.cos(n),
    r = Math.sin(n),
    a = t.width * 0.5,
    o = t.buildingX + i * t.hingeX + r * t.hingeZ,
    s = t.buildingZ - r * t.hingeX + i * t.hingeZ,
    l = n + e;
  return {
    shape: "box",
    id: `authored-door:${t.id}`,
    x: o + Math.cos(l) * a,
    z: s - Math.sin(l) * a,
    halfWidth: a,
    halfDepth: t.thickness * 0.5,
    rotation: l,
    minY: t.floorY,
    maxY: t.floorY + t.height,
  };
}
function zd(t, e, n = !1) {
  let i = t.opensInwardRotation ?? Math.PI * 0.5,
    r = t.buildingRotation ?? 0,
    a = Math.cos(r),
    o = Math.sin(r),
    s = t.hingeX + t.width * 0.5,
    l = t.hingeZ,
    c = new THREE.Group();
  ((c.name = `authored-door:${t.id}:pivot`),
    c.position.set(t.hingeX, 0, t.hingeZ));
  let u = new THREE.Mesh(
    new THREE.BoxGeometry(t.width, t.height, t.thickness),
    e.clone(),
  );
  ((u.name = `authored-door:${t.id}:leaf`),
    u.position.set(t.width * 0.5, t.height * 0.5, 0),
    (u.castShadow = !0),
    (u.receiveShadow = !0),
    (u.userData.shadow = !0),
    c.add(u));
  let h = new THREE.MeshStandardNodeMaterial({
      color: 11700810,
      roughness: 0.38,
      metalness: 0.72,
    }),
    d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), h);
  ((d.name = `authored-door:${t.id}:handle`),
    d.position.set(t.width * 0.84, t.height * 0.47, 0.08),
    (d.castShadow = !0),
    (d.userData.shadow = !0),
    c.add(d));
  let p = tM(t, 0),
    f = !1,
    S = {
      id: t.id,
      name: t.name,
      pivot: c,
      targetPosition: new THREE.Vector3(
        t.buildingX + a * s + o * l,
        t.floorY + Math.min(1.45, t.height * 0.5),
        t.buildingZ - o * s + a * l,
      ),
      collider: p,
      get isOpen() {
        return f;
      },
      setOpen(v) {
        f = v;
        let m = f ? i : 0;
        c.rotation.y = m;
        let y = tM(t, m);
        (Object.assign(p, y), (c.userData.open = f), (u.userData.open = f));
      },
      colliderFor(v) {
        return tM(t, v ? i : 0);
      },
    };
  return (S.setOpen(n), S);
}
var co = { x: 12, z: -6, width: 8, depth: 6 },
  f3 = [-1, 0, 1].flatMap((t) =>
    [-1, 0, 1].map((e) =>
      je(co.x + t * co.width * 0.5, co.z + e * co.depth * 0.5),
    ),
  ),
  Ay = Math.max(...f3) + 0.04,
  U8 = Math.min(...f3) - 0.08,
  nM = 20,
  Dy = 2.25,
  iM = -2.25,
  Iy = Dy - iM,
  m3 = Iy / nM,
  F8 = Dy - m3 * 4,
  H8 = 2.55,
  k8 = 1.35,
  g3 = 3.5,
  v3 = 0.24,
  p3 = Ay + g3 + v3,
  Je = Object.freeze({
    id: "spawn-field-unit-01",
    name: "Field Unit 01",
    chunkKey: "0:0",
    x: co.x,
    z: co.z,
    width: co.width,
    depth: co.depth,
    floorY: Ay,
    floorCount: 1,
    hasBasement: !1,
    roofAccess: !0,
    doorId: "spawn-field-unit-01:front",
    wallHeight: g3,
    wallThickness: 0.22,
    roofThickness: v3,
    roofY: p3,
    doorWidth: 1.5,
    doorHeight: 3.2,
    windowWidth: 1.5,
    windowHeight: 1.1,
    windowSill: 0.92,
    roofStairCenterX: H8,
    roofStairWidth: k8,
    roofStairStartZ: Dy,
    roofStairEndZ: iM,
    roofStairSteps: nM,
    roofStairRise: (p3 - Ay) / nM,
    roofStairTread: m3,
    roofStairRailStartZ: F8,
    roofStairwellMinX: 1.78,
    roofStairwellMaxX: 3.32,
    roofStairwellMinZ: iM,
    roofStairwellMaxZ: Dy,
    foundationDepth: Ay - U8,
    clearanceRadius: Math.hypot(co.width, co.depth) * 0.5 + 1.25,
  });
function _f(t, e, n, i, r) {
  return {
    shape: "box",
    id: `spawn-building:${Je.id}:wall:${t}`,
    x: e,
    z: n,
    halfWidth: i,
    halfDepth: r,
    rotation: 0,
    minY: Je.floorY,
    maxY: Je.floorY + Je.wallHeight,
  };
}
function cl(t, e, n, i, r, a, o) {
  return {
    shape: "box",
    id: `spawn-building:${Je.id}:${t}`,
    x: Je.x + e,
    z: Je.z + n,
    halfWidth: i,
    halfDepth: r,
    rotation: 0,
    minY: a,
    maxY: o,
  };
}
function y3(t, e) {
  if (!Number.isFinite(t) || !Number.isFinite(e)) return [];
  let n = t - Je.x,
    i = e - Je.z,
    r = Je.width * 0.5 - Je.wallThickness,
    a = Je.depth * 0.5 - Je.wallThickness,
    o = Math.abs(n) <= r && Math.abs(i) <= a,
    s =
      Math.abs(n) <= Je.doorWidth * 0.5 && i > a && i <= Je.depth * 0.5 + 0.55;
  if (!o && !s) return [];
  let l = [Je.floorY];
  if (!o) return l;
  if (
    Math.abs(n - Je.roofStairCenterX) <= Je.roofStairWidth * 0.5 &&
    i <= Je.roofStairStartZ &&
    i >= Je.roofStairEndZ
  ) {
    let h = THREE.MathUtils.clamp((Je.roofStairStartZ - i) / Iy, 0, 0.999999),
      d = Math.floor(h * Je.roofStairSteps);
    l.push(Je.floorY + (d + 1) * Je.roofStairRise);
  }
  return (
    (n >= Je.roofStairwellMinX &&
      n <= Je.roofStairwellMaxX &&
      i >= Je.roofStairwellMinZ &&
      i <= Je.roofStairwellMaxZ) ||
      l.push(Je.roofY),
    [...new Set(l)].sort((h, d) => h - d)
  );
}
function x3(t, e = !1) {
  let n = Je,
    i = new THREE.Group();
  ((i.name = `spawn-building:${n.id}`),
    i.position.set(n.x, n.floorY, n.z),
    (i.userData.enterable = !0),
    (i.userData.floorCount = n.floorCount),
    (i.userData.roofAccess = !0));
  let r = ln(
      new THREE.MeshStandardNodeMaterial({
        color: 7827814,
        roughness: 0.9,
        metalness: 0.04,
      }),
      { role: "building", weatherExposure: 0, environmentScale: 0.78 },
    ),
    a = ln(
      new THREE.MeshStandardNodeMaterial({
        color: 5065541,
        roughness: 0.86,
        metalness: 0.08,
      }),
      { role: "building", weatherExposure: 0, environmentScale: 0.72 },
    ),
    o = ln(
      new THREE.MeshStandardNodeMaterial({
        color: 3422005,
        roughness: 0.76,
        metalness: 0.24,
      }),
      {
        role: "roof",
        weatherExposure: 1,
        wetRoughness: 0.3,
        environmentScale: 0.94,
        wetReflectionBoost: 0.5,
      },
    ),
    s = ln(
      new THREE.MeshStandardNodeMaterial({
        color: 2435110,
        roughness: 0.72,
        metalness: 0.3,
      }),
      { role: "metal", weatherExposure: 0, environmentScale: 0.92 },
    ),
    l = new THREE.MeshPhysicalNodeMaterial({
      color: 9420744,
      roughness: 0.12,
      metalness: 0.05,
      transmission: 0.72,
      thickness: 0.045,
      ior: 1.46,
      transparent: !0,
      opacity: 0.42,
      depthWrite: !1,
      side: THREE.DoubleSide,
    }),
    c = { wall: r, floor: a, roof: o, trim: s, glass: l },
    u = (L, O, G, F, W = 0) => {
      let U = new THREE.Mesh(
        new THREE.BoxGeometry(O[0], O[1], O[2]),
        c[F].clone(),
      );
      return (
        (U.name = `spawn-building:${L}`),
        U.position.set(G[0], G[1], G[2]),
        (U.rotation.y = W),
        (U.castShadow = qualityHasShadows(t) && F !== "glass"),
        (U.receiveShadow = F !== "glass"),
        (U.userData.shadow = F !== "glass"),
        (U.userData.glass = F === "glass"),
        i.add(U),
        U
      );
    },
    h = (L, O, G) => {
      let F = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        c[G].clone(),
        O.length,
      );
      ((F.name = `spawn-building:${L}`),
        (F.castShadow = qualityHasShadows(t) && G !== "glass"),
        (F.receiveShadow = G !== "glass"),
        (F.userData.shadow = G !== "glass"));
      let W = new THREE.Matrix4(),
        U = new THREE.Vector3(),
        H = new THREE.Vector3(),
        ne = new THREE.Quaternion();
      return (
        O.forEach((ae, _e) => {
          (U.set(...ae.position),
            H.set(...ae.size),
            W.compose(U, ne, H),
            F.setMatrixAt(_e, W));
        }),
        (F.instanceMatrix.needsUpdate = !0),
        F.computeBoundingBox(),
        F.computeBoundingSphere(),
        i.add(F),
        F
      );
    };
  u(
    "floor",
    [n.width, n.foundationDepth, n.depth],
    [0, -n.foundationDepth * 0.5, 0],
    "floor",
  );
  let d = n.width * 0.5 + 0.18,
    p = n.depth * 0.5 + 0.18,
    f = n.wallHeight + n.roofThickness * 0.5,
    S = [],
    v = (L, O, G, F) => {
      O <= L ||
        F <= G ||
        S.push({
          size: [O - L, n.roofThickness, F - G],
          position: [(L + O) * 0.5, f, (G + F) * 0.5],
        });
    };
  (v(-d, n.roofStairwellMinX, -p, p),
    v(n.roofStairwellMaxX, d, -p, p),
    v(n.roofStairwellMinX, n.roofStairwellMaxX, n.roofStairwellMaxZ, p),
    v(n.roofStairwellMinX, n.roofStairwellMaxX, -p, n.roofStairwellMinZ),
    h("roof", S, "roof"));
  let m = n.depth * 0.5,
    y = -m,
    x = n.width * 0.5,
    g = (n.width - n.doorWidth) * 0.5,
    E = n.doorWidth * 0.5 + g * 0.5;
  (u(
    "wall:front-left",
    [g, n.wallHeight, n.wallThickness],
    [-E, n.wallHeight * 0.5, m],
    "wall",
  ),
    u(
      "wall:front-right",
      [g, n.wallHeight, n.wallThickness],
      [E, n.wallHeight * 0.5, m],
      "wall",
    ),
    u(
      "wall:front-header",
      [n.doorWidth, n.wallHeight - n.doorHeight, n.wallThickness],
      [0, n.doorHeight + (n.wallHeight - n.doorHeight) * 0.5, m],
      "wall",
    ));
  let M = (L, O, G, F) => {
    let W = (F - n.windowWidth) * 0.5,
      U = n.windowWidth * 0.5 + W * 0.5,
      H = n.windowSill,
      ne = n.windowSill + n.windowHeight,
      ae = n.wallHeight - ne,
      _e = O
        ? [W, n.wallHeight, n.wallThickness]
        : [n.wallThickness, n.wallHeight, W],
      Ue = O
        ? [n.windowWidth, H, n.wallThickness]
        : [n.wallThickness, H, n.windowWidth],
      ze = O
        ? [n.windowWidth, ae, n.wallThickness]
        : [n.wallThickness, ae, n.windowWidth],
      Q = O
        ? [n.windowWidth - 0.1, n.windowHeight - 0.1, 0.045]
        : [0.045, n.windowHeight - 0.1, n.windowWidth - 0.1],
      de = (le, Ie) => (O ? [le, Ie, G] : [G, Ie, le]);
    (u(`wall:${L}-a`, _e, de(-U, n.wallHeight * 0.5), "wall"),
      u(`wall:${L}-b`, _e, de(U, n.wallHeight * 0.5), "wall"),
      u(`wall:${L}-lower`, Ue, de(0, H * 0.5), "wall"),
      u(`wall:${L}-upper`, ze, de(0, ne + ae * 0.5), "wall"),
      u(`window:${L}`, Q, de(0, n.windowSill + n.windowHeight * 0.5), "glass"));
  };
  (M("back", !0, y, n.width),
    M("left", !1, -x, n.depth),
    M("right", !1, x, n.depth));
  let _ = 0.08;
  u(
    "door:trim-left",
    [0.09, n.doorHeight, _],
    [-n.doorWidth * 0.5, n.doorHeight * 0.5, m + 0.13],
    "trim",
  );
  let b = [];
  for (let L = 0; L < n.roofStairSteps; L += 1) {
    let O = (L + 1) * n.roofStairRise,
      G = n.roofStairStartZ - (L + 0.5) * n.roofStairTread;
    b.push({
      size: [n.roofStairWidth, n.roofStairRise, n.roofStairTread + 0.012],
      position: [n.roofStairCenterX, O - n.roofStairRise * 0.5, G],
    });
  }
  h("roof-stair:steps", b, "floor");
  let T = [];
  for (let L of [-1, 1])
    for (let O = 1; O < 5; O += 1) {
      let G = Math.floor((O * n.roofStairSteps) / 5),
        F = Math.floor(((O + 1) * n.roofStairSteps) / 5),
        W = n.roofStairStartZ - G * n.roofStairTread,
        U = n.roofStairStartZ - F * n.roofStairTread;
      T.push({
        size: [0.07, 0.12, W - U],
        position: [
          n.roofStairCenterX + L * (n.roofStairWidth * 0.5 + 0.035),
          F * n.roofStairRise + 0.62,
          (W + U) * 0.5,
        ],
      });
    }
  let C = n.wallHeight + n.roofThickness + 0.525;
  (T.push(
    { size: [n.width + 0.18, 1.05, 0.09], position: [0, C, -n.depth * 0.5] },
    { size: [n.width + 0.18, 1.05, 0.09], position: [0, C, n.depth * 0.5] },
    { size: [0.09, 1.05, n.depth], position: [-n.width * 0.5, C, 0] },
    { size: [0.09, 1.05, n.depth], position: [n.width * 0.5, C, 0] },
    {
      size: [n.roofStairwellMaxX - n.roofStairwellMinX, 1.05, 0.08],
      position: [
        (n.roofStairwellMinX + n.roofStairwellMaxX) * 0.5,
        C,
        n.roofStairwellMaxZ,
      ],
    },
    { size: [0.08, 1.05, Iy], position: [n.roofStairwellMinX, C, 0] },
    { size: [0.08, 1.05, Iy], position: [n.roofStairwellMaxX, C, 0] },
  ),
    h("roof-stair:rails-and-parapets", T, "trim"),
    u(
      "door:trim-right",
      [0.09, n.doorHeight, _],
      [n.doorWidth * 0.5, n.doorHeight * 0.5, m + 0.13],
      "trim",
    ),
    u(
      "door:trim-top",
      [n.doorWidth + 0.18, 0.09, _],
      [0, n.doorHeight, m + 0.13],
      "trim",
    ));
  let P = zd(
    {
      id: n.doorId,
      name: `${n.name} door`,
      buildingX: n.x,
      buildingZ: n.z,
      floorY: n.floorY,
      hingeX: -n.doorWidth * 0.5,
      hingeZ: m,
      width: n.doorWidth,
      height: n.doorHeight,
      thickness: 0.07,
    },
    s,
    e,
  );
  (P.pivot.traverse((L) => {
    L instanceof THREE.Mesh && (L.castShadow = qualityHasShadows(t));
  }),
    i.add(P.pivot));
  for (let L of Object.values(c)) L.dispose();
  let B = [
    _f("back", n.x, n.z + y, n.width * 0.5, n.wallThickness * 0.5),
    _f("left", n.x - x, n.z, n.wallThickness * 0.5, n.depth * 0.5),
    _f("right", n.x + x, n.z, n.wallThickness * 0.5, n.depth * 0.5),
    _f("front-left", n.x - E, n.z + m, g * 0.5, n.wallThickness * 0.5),
    _f("front-right", n.x + E, n.z + m, g * 0.5, n.wallThickness * 0.5),
    cl(
      "wall:front-header",
      0,
      m,
      n.doorWidth * 0.5,
      n.wallThickness * 0.5,
      n.floorY + n.doorHeight,
      n.floorY + n.wallHeight,
    ),
    cl(
      "roof-stair:rail:left",
      n.roofStairCenterX - n.roofStairWidth * 0.5 - 0.04,
      (n.roofStairRailStartZ + n.roofStairEndZ) * 0.5,
      0.04,
      (n.roofStairRailStartZ - n.roofStairEndZ) * 0.5,
      n.floorY,
      n.roofY + 1.12,
    ),
    cl(
      "roof-stair:rail:right",
      n.roofStairCenterX + n.roofStairWidth * 0.5 + 0.04,
      (n.roofStairRailStartZ + n.roofStairEndZ) * 0.5,
      0.04,
      (n.roofStairRailStartZ - n.roofStairEndZ) * 0.5,
      n.floorY,
      n.roofY + 1.12,
    ),
    cl(
      "roof-stair:inactive-edge",
      (n.roofStairwellMinX + n.roofStairwellMaxX) * 0.5,
      n.roofStairwellMaxZ,
      (n.roofStairwellMaxX - n.roofStairwellMinX) * 0.5,
      0.05,
      n.roofY,
      n.roofY + 1.05,
    ),
    cl(
      "roof:parapet:back",
      0,
      -n.depth * 0.5,
      n.width * 0.5,
      0.05,
      n.roofY,
      n.roofY + 1.05,
    ),
    cl(
      "roof:parapet:front",
      0,
      n.depth * 0.5,
      n.width * 0.5,
      0.05,
      n.roofY,
      n.roofY + 1.05,
    ),
    cl(
      "roof:parapet:left",
      -n.width * 0.5,
      0,
      0.05,
      n.depth * 0.5,
      n.roofY,
      n.roofY + 1.05,
    ),
    cl(
      "roof:parapet:right",
      n.width * 0.5,
      0,
      0.05,
      n.depth * 0.5,
      n.roofY,
      n.roofY + 1.05,
    ),
    P.collider,
  ];
  return { root: i, colliders: B, doors: [P] };
}
var Ri = { x: 4, z: 34, width: 14, depth: 12, rotation: Math.PI },
  Tf = 10,
  Rf = 3.5,
  Oy = 20,
  b3 = Rf / Oy,
  Ny = 3.2,
  Py = -2.6,
  wf = Ny - Py,
  S3 = wf / Oy,
  E3 = [3.25, 4.95];
function _3(t, e) {
  let n = Math.cos(Ri.rotation),
    i = Math.sin(Ri.rotation);
  return { x: Ri.x + n * t + i * e, z: Ri.z - i * t + n * e };
}
function B8(t, e) {
  let n = Math.cos(Ri.rotation),
    i = Math.sin(Ri.rotation),
    r = t - Ri.x,
    a = e - Ri.z;
  return { x: n * r - i * a, z: i * r + n * a };
}
var M3 = [-1, 0, 1].flatMap((t) =>
    [-1, 0, 1].map((e) => {
      let n = _3(t * Ri.width * 0.5, e * Ri.depth * 0.5);
      return je(n.x, n.z);
    }),
  ),
  Ly = Math.max(...M3) + 0.04,
  G8 = Math.min(...M3) - 0.08,
  rM = Object.freeze(Array.from({ length: Tf }, (t, e) => Ly + e * Rf)),
  w3 = Ly + Tf * Rf,
  V8 = Object.freeze(
    Array.from({ length: Tf }, (t, e) => {
      let n = e % 2 === 0;
      return Object.freeze({
        index: e,
        fromFloor: e,
        toFloor: e + 1,
        lane: e % 2,
        centerX: E3[e % 2],
        startZ: n ? Ny : Py,
        endZ: n ? Py : Ny,
        startY: rM[e],
        endY: rM[e + 1] ?? w3,
        steps: Oy,
        rise: b3,
        tread: S3,
      });
    }),
  ),
  Jt = Object.freeze({
    id: "spawn-meridian-tower-03",
    name: "Meridian Tower 03",
    chunkKey: "0:0",
    x: Ri.x,
    z: Ri.z,
    rotation: Ri.rotation,
    width: Ri.width,
    depth: Ri.depth,
    floorY: Ly,
    floorYs: rM,
    roofY: w3,
    floorCount: Tf,
    storyHeight: Rf,
    wallHeight: Tf * Rf,
    wallThickness: 0.24,
    slabThickness: 0.18,
    roofThickness: 0.28,
    parapetHeight: 1.05,
    hasBasement: !1,
    roofAccess: !0,
    doorId: "spawn-meridian-tower-03:front",
    doorWidth: 1.6,
    doorHeight: 3.2,
    windowWidth: 2.4,
    windowHeight: 1.3,
    windowSill: 1,
    stairWidth: 1.4,
    stairSteps: Oy,
    stairRise: b3,
    stairTread: S3,
    stairwellMinX: 2.48,
    stairwellMaxX: 5.72,
    stairwellMinZ: Py,
    stairwellMaxZ: Ny,
    stairFlights: V8,
    foundationDepth: Ly - G8,
    clearanceRadius: Math.hypot(Ri.width, Ri.depth) * 0.5 + 1.25,
  });
function Qi(t, e, n, i, r, a = Jt.floorY, o = Jt.floorY + Jt.wallHeight) {
  let s = _3(e, n);
  return {
    shape: "box",
    id: `ten-story-building:${Jt.id}:${t}`,
    x: s.x,
    z: s.z,
    halfWidth: i,
    halfDepth: r,
    rotation: Jt.rotation,
    minY: a,
    maxY: o,
  };
}
function T3(t, e) {
  if (!Number.isFinite(t) || !Number.isFinite(e)) return [];
  let n = Jt,
    i = B8(t, e),
    r = n.width * 0.5 - n.wallThickness,
    a = n.depth * 0.5 - n.wallThickness,
    o = Math.abs(i.x) <= r && Math.abs(i.z) <= a,
    s =
      Math.abs(i.x) <= n.doorWidth * 0.5 &&
      i.z > a &&
      i.z <= n.depth * 0.5 + 0.55;
  if (!o && !s) return [];
  let l = [n.floorY];
  if (!o) return l;
  if (
    !(
      i.x >= n.stairwellMinX &&
      i.x <= n.stairwellMaxX &&
      i.z >= n.stairwellMinZ &&
      i.z <= n.stairwellMaxZ
    )
  )
    return (l.push(...n.floorYs.slice(1)), l.push(n.roofY), l);
  for (let u of n.stairFlights) {
    if (!(Math.abs(i.x - u.centerX) <= n.stairWidth * 0.5)) continue;
    let d = u.startZ > u.endZ ? u.startZ - i.z : i.z - u.startZ,
      p = THREE.MathUtils.clamp(d / wf, 0, 0.999999),
      f = Math.floor(p * u.steps);
    l.push(u.startY + (f + 1) * u.rise);
  }
  return [...new Set(l)].sort((u, h) => u - h);
}
function Mf(t, e, n, i, r = {}) {
  let a = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), i, n.length);
  ((a.name = `ten-story-building:${e}`),
    (a.castShadow = r.castShadow ?? !1),
    (a.receiveShadow = r.receiveShadow ?? !1),
    (a.userData.shadow = r.castShadow ?? !1),
    (a.userData.glass = r.glass ?? !1));
  let o = new THREE.Matrix4(),
    s = new THREE.Quaternion(),
    l = new THREE.Vector3(),
    c = new THREE.Vector3();
  return (
    n.forEach((u, h) => {
      (l.set(...u.position),
        c.set(...u.size),
        o.compose(l, s, c),
        a.setMatrixAt(h, o));
    }),
    (a.instanceMatrix.needsUpdate = !0),
    a.computeBoundingBox(),
    a.computeBoundingSphere(),
    t.add(a),
    a
  );
}
function R3(t, e = !1) {
  let n = Jt,
    i = new THREE.Group();
  ((i.name = `ten-story-building:${n.id}`),
    i.position.set(n.x, n.floorY, n.z),
    (i.rotation.y = n.rotation),
    (i.userData.enterable = !0),
    (i.userData.floorCount = n.floorCount),
    (i.userData.roofAccess = n.roofAccess),
    (i.userData.roofY = n.roofY));
  let r = {
      wall: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 6120031,
          roughness: 0.82,
          metalness: 0.12,
        }),
        { role: "building", weatherExposure: 0, environmentScale: 0.84 },
      ),
      floor: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 4080962,
          roughness: 0.86,
          metalness: 0.14,
        }),
        { role: "building", weatherExposure: 0, environmentScale: 0.76 },
      ),
      roof: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 2633517,
          roughness: 0.66,
          metalness: 0.38,
        }),
        {
          role: "roof",
          weatherExposure: 1,
          wetRoughness: 0.28,
          environmentScale: 1.04,
          wetReflectionBoost: 0.52,
        },
      ),
      trim: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 2107173,
          roughness: 0.62,
          metalness: 0.44,
        }),
        { role: "metal", weatherExposure: 0, environmentScale: 0.98 },
      ),
      glass: new THREE.MeshPhysicalNodeMaterial({
        color: 8499903,
        roughness: 0.1,
        metalness: 0.04,
        transmission: 0.76,
        thickness: 0.055,
        ior: 1.46,
        transparent: !0,
        opacity: 0.4,
        depthWrite: !1,
        side: THREE.DoubleSide,
      }),
    },
    a = [],
    o = [],
    s = [],
    l = [],
    c = { front: [], back: [], left: [], right: [] },
    u = (U, H, ne) => U.push({ size: H, position: ne });
  u(o, [n.width, n.foundationDepth, n.depth], [0, -n.foundationDepth * 0.5, 0]);
  let h = n.width * 0.5 - n.wallThickness,
    d = n.depth * 0.5 - n.wallThickness;
  for (let U = 1; U < n.floorCount; U += 1) {
    let H = U * n.storyHeight - n.slabThickness * 0.5,
      ne = (ae, _e, Ue, ze) => {
        _e <= ae ||
          ze <= Ue ||
          u(
            o,
            [_e - ae, n.slabThickness, ze - Ue],
            [(ae + _e) * 0.5, H, (Ue + ze) * 0.5],
          );
      };
    (ne(-h, n.stairwellMinX, -d, d),
      ne(n.stairwellMaxX, h, -d, d),
      ne(n.stairwellMinX, n.stairwellMaxX, n.stairwellMaxZ, d),
      ne(n.stairwellMinX, n.stairwellMaxX, -d, n.stairwellMinZ));
  }
  let f = n.wallHeight - n.roofThickness * 0.5,
    S = (U, H, ne, ae) => {
      H <= U ||
        ae <= ne ||
        u(
          s,
          [H - U, n.roofThickness, ae - ne],
          [(U + H) * 0.5, f, (ne + ae) * 0.5],
        );
    };
  (S(-h, n.stairwellMinX, -d, d),
    S(n.stairwellMaxX, h, -d, d),
    S(n.stairwellMinX, n.stairwellMaxX, n.stairwellMaxZ, d),
    S(n.stairwellMinX, n.stairwellMaxX, -d, n.stairwellMinZ));
  let v = (U, H) => {
    let ne = U === "front" || U === "back",
      ae = ne ? n.width : n.depth,
      _e =
        U === "front"
          ? n.depth * 0.5
          : U === "back"
            ? -n.depth * 0.5
            : U === "left"
              ? -n.width * 0.5
              : n.width * 0.5,
      Ue = H * n.storyHeight,
      ze = (ae - n.windowWidth) * 0.5,
      Q = n.windowWidth * 0.5 + ze * 0.5,
      de = n.windowSill + n.windowHeight,
      le = n.storyHeight - de,
      Ie = (re, ve) => (ne ? [re, Ue + ve, _e] : [_e, Ue + ve, re]),
      z = (re, ve, Pe = n.wallThickness) => (ne ? [re, ve, Pe] : [Pe, ve, re]);
    (u(a, z(ze, n.storyHeight), Ie(-Q, n.storyHeight * 0.5)),
      u(a, z(ze, n.storyHeight), Ie(Q, n.storyHeight * 0.5)),
      u(a, z(n.windowWidth, n.windowSill), Ie(0, n.windowSill * 0.5)),
      u(a, z(n.windowWidth, le), Ie(0, de + le * 0.5)),
      u(
        c[U],
        z(n.windowWidth - 0.12, n.windowHeight - 0.12, 0.045),
        Ie(0, n.windowSill + n.windowHeight * 0.5),
      ));
  };
  for (let U of ["back", "left", "right"])
    for (let H = 0; H < n.floorCount; H += 1) v(U, H);
  for (let U = 1; U < n.floorCount; U += 1) v("front", U);
  let m = n.depth * 0.5,
    y = (n.width - n.doorWidth) * 0.5,
    x = n.doorWidth * 0.5 + y * 0.5;
  (u(a, [y, n.storyHeight, n.wallThickness], [-x, n.storyHeight * 0.5, m]),
    u(a, [y, n.storyHeight, n.wallThickness], [x, n.storyHeight * 0.5, m]),
    u(
      a,
      [n.doorWidth, n.storyHeight - n.doorHeight, n.wallThickness],
      [0, n.doorHeight + (n.storyHeight - n.doorHeight) * 0.5, m],
    ));
  let g = 0.08;
  (u(
    l,
    [0.09, n.doorHeight, g],
    [-n.doorWidth * 0.5, n.doorHeight * 0.5, m + 0.13],
  ),
    u(
      l,
      [0.09, n.doorHeight, g],
      [n.doorWidth * 0.5, n.doorHeight * 0.5, m + 0.13],
    ),
    u(l, [n.doorWidth + 0.18, 0.09, g], [0, n.doorHeight, m + 0.13]));
  for (let U of n.stairFlights) {
    let H = Math.sign(U.endZ - U.startZ),
      ne = U.index * n.storyHeight;
    for (let ae = 0; ae < U.steps; ae += 1) {
      let _e = ne + (ae + 1) * U.rise,
        Ue = U.startZ + H * (ae + 0.5) * U.tread;
      u(
        o,
        [n.stairWidth, U.rise, U.tread + 0.012],
        [U.centerX, _e - U.rise * 0.5, Ue],
      );
    }
    for (let ae of [-1, 1])
      for (let _e = 0; _e < 5; _e += 1) {
        let Ue = Math.floor((_e * U.steps) / 5),
          ze = Math.floor(((_e + 1) * U.steps) / 5),
          Q = U.startZ + H * Ue * U.tread,
          de = U.startZ + H * ze * U.tread;
        u(
          l,
          [0.07, 0.12, Math.abs(de - Q)],
          [
            U.centerX + ae * (n.stairWidth * 0.5 + 0.035),
            ne + ze * U.rise + 0.62,
            (Q + de) * 0.5,
          ],
        );
      }
  }
  for (let U = 1; U < n.floorCount; U += 1) {
    let ne = U % 2 === 1 ? n.stairwellMaxZ : n.stairwellMinZ;
    u(
      l,
      [n.stairwellMaxX - n.stairwellMinX, 1.05, 0.08],
      [
        (n.stairwellMinX + n.stairwellMaxX) * 0.5,
        U * n.storyHeight + 0.525,
        ne,
      ],
    );
  }
  let E = n.wallHeight,
    M = n.stairFlights.at(-1),
    _ = M?.lane ?? 1,
    b = E3[_ === 0 ? 1 : 0],
    T = M?.endZ ?? n.stairwellMaxZ,
    R = M?.startZ ?? n.stairwellMinZ,
    C = b < (M?.centerX ?? 0) ? -1 : 1;
  (u(
    l,
    [n.stairwellMaxX - n.stairwellMinX, n.parapetHeight, 0.08],
    [(n.stairwellMinX + n.stairwellMaxX) * 0.5, E + n.parapetHeight * 0.5, R],
  ),
    u(l, [n.stairWidth + 0.12, 1.05, 0.08], [b, E + 0.525, T]),
    u(
      l,
      [0.08, 1.05, wf],
      [
        b + C * (n.stairWidth * 0.5 + 0.04),
        E + 0.525,
        (n.stairwellMinZ + n.stairwellMaxZ) * 0.5,
      ],
    ));
  let P = n.width * 0.5,
    B = n.depth * 0.5,
    L = E + n.parapetHeight * 0.5;
  for (let U of [-B, B]) u(l, [n.width, n.parapetHeight, 0.12], [0, L, U]);
  for (let U of [-P, P])
    u(l, [0.12, n.parapetHeight, n.depth - 0.24], [U, L, 0]);
  (Mf(i, "walls", a, r.wall, {
    castShadow: qualityHasShadows(t),
    receiveShadow: !0,
  }),
    Mf(i, "floors-and-stairs", o, r.floor, { receiveShadow: !0 }),
    Mf(i, "roof", s, r.roof, {
      castShadow: qualityHasShadows(t),
      receiveShadow: !0,
    }),
    Mf(i, "trim-and-rails", l, r.trim));
  for (let U of ["front", "back", "left", "right"])
    Mf(i, `glass:${U}`, c[U], r.glass, { glass: !0 });
  let O = zd(
    {
      id: n.doorId,
      name: `${n.name} door`,
      buildingX: n.x,
      buildingZ: n.z,
      buildingRotation: n.rotation,
      floorY: n.floorY,
      hingeX: -n.doorWidth * 0.5,
      hingeZ: m,
      width: n.doorWidth,
      height: n.doorHeight,
      thickness: 0.07,
    },
    r.trim,
    e,
  );
  (O.pivot.traverse((U) => {
    U instanceof THREE.Mesh && (U.castShadow = qualityHasShadows(t));
  }),
    i.add(O.pivot),
    (i.userData.staticInstanceCount =
      a.length +
      o.length +
      s.length +
      l.length +
      Object.values(c).reduce((U, H) => U + H.length, 0)));
  let G = n.width * 0.5,
    F = n.depth * 0.5,
    W = [
      Qi("wall:back", 0, -F, G, n.wallThickness * 0.5),
      Qi("wall:left", -G, 0, n.wallThickness * 0.5, F),
      Qi("wall:right", G, 0, n.wallThickness * 0.5, F),
      Qi("wall:front-left", -x, m, y * 0.5, n.wallThickness * 0.5),
      Qi("wall:front-right", x, m, y * 0.5, n.wallThickness * 0.5),
      Qi(
        "wall:front-header",
        0,
        m,
        n.doorWidth * 0.5,
        n.wallThickness * 0.5,
        n.floorY + n.doorHeight,
        n.floorY + n.wallHeight,
      ),
    ];
  for (let U of n.stairFlights)
    for (let H of [-1, 1])
      W.push(
        Qi(
          `stair:${U.index}:rail:${H}`,
          U.centerX + H * (n.stairWidth * 0.5 + 0.04),
          (U.startZ + U.endZ) * 0.5,
          0.04,
          wf * 0.5,
          U.startY,
          U.endY + 1.12,
        ),
      );
  for (let U = 1; U < n.floorCount; U += 1) {
    let H = U % 2 === 1;
    W.push(
      Qi(
        `stair:${U}:opposite-guard`,
        (n.stairwellMinX + n.stairwellMaxX) * 0.5,
        H ? n.stairwellMaxZ : n.stairwellMinZ,
        (n.stairwellMaxX - n.stairwellMinX) * 0.5,
        0.05,
        n.floorYs[U],
        n.floorYs[U] + 1.05,
      ),
    );
  }
  return (
    W.push(
      Qi(
        "stair:roof:opposite-guard",
        (n.stairwellMinX + n.stairwellMaxX) * 0.5,
        R,
        (n.stairwellMaxX - n.stairwellMinX) * 0.5,
        0.05,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
      Qi(
        "stair:roof:unused-lane-entry",
        b,
        T,
        n.stairWidth * 0.5 + 0.06,
        0.05,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
      Qi(
        "stair:roof:unused-lane-side",
        b + C * (n.stairWidth * 0.5 + 0.04),
        (n.stairwellMinZ + n.stairwellMaxZ) * 0.5,
        0.04,
        wf * 0.5,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
    ),
    W.push(
      Qi(
        "roof:parapet:back",
        0,
        -B,
        P,
        0.06,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
      Qi(
        "roof:parapet:front",
        0,
        B,
        P,
        0.06,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
      Qi(
        "roof:parapet:left",
        -P,
        0,
        0.06,
        B - 0.12,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
      Qi(
        "roof:parapet:right",
        P,
        0,
        0.06,
        B - 0.12,
        n.roofY,
        n.roofY + n.parapetHeight,
      ),
    ),
    W.push(O.collider),
    { root: i, colliders: W, doors: [O] }
  );
}
function oM(t, e) {
  if (t.length === 0) return null;
  let n = [...t].sort((r, a) => r - a);
  return e === void 0 || !Number.isFinite(e)
    ? n[0]
    : (n.filter((r) => r <= e + 0.22).at(-1) ?? n[0]);
}
var Ci = { x: 18, z: 13, width: 10, depth: 9, rotation: Math.PI },
  Af = 3.5,
  C3 = Af * 2,
  A3 = 0.24,
  ul = 20,
  Df = 2.9,
  If = -2.7,
  sM = (Df - If) / ul,
  W8 = 1.45,
  D3 = 3.3,
  I3 = 1.55;
function N3(t, e) {
  let n = Math.cos(Ci.rotation),
    i = Math.sin(Ci.rotation);
  return { x: Ci.x + n * t + i * e, z: Ci.z - i * t + n * e };
}
function X8(t, e) {
  let n = Math.cos(Ci.rotation),
    i = Math.sin(Ci.rotation),
    r = t - Ci.x,
    a = e - Ci.z;
  return { x: n * r - i * a, z: i * r + n * a };
}
var P3 = [-1, 0, 1].flatMap((t) =>
    [-1, 0, 1].map((e) => {
      let n = N3(t * Ci.width * 0.5, e * Ci.depth * 0.5);
      return je(n.x, n.z);
    }),
  ),
  Nf = Math.max(...P3) + 0.04,
  Y8 = Math.min(...P3) - 0.08,
  Cf = Nf + Af,
  zy = Nf + C3 + A3,
  q8 = Object.freeze([
    Object.freeze({
      id: "ground-to-upper",
      centerX: D3,
      startZ: Df,
      endZ: If,
      startY: Nf,
      endY: Cf,
      steps: ul,
      rise: Af / ul,
      tread: sM,
    }),
    Object.freeze({
      id: "upper-to-roof",
      centerX: I3,
      startZ: If,
      endZ: Df,
      startY: Cf,
      endY: zy,
      steps: ul,
      rise: (zy - Cf) / ul,
      tread: sM,
    }),
  ]),
  jt = Object.freeze({
    id: "spawn-survey-house-02",
    name: "Survey House 02",
    chunkKey: "0:0",
    x: Ci.x,
    z: Ci.z,
    rotation: Ci.rotation,
    width: Ci.width,
    depth: Ci.depth,
    floorY: Nf,
    floorCount: 2,
    storyHeight: Af,
    upperFloorY: Cf,
    roofY: zy,
    wallHeight: C3,
    wallThickness: 0.24,
    slabThickness: 0.18,
    roofThickness: A3,
    hasBasement: !1,
    roofAccess: !0,
    doorId: "spawn-survey-house-02:front",
    doorWidth: 1.5,
    doorHeight: 3.2,
    windowWidth: 1.8,
    windowHeight: 1.2,
    windowSill: 1.05,
    stairCenterX: D3,
    roofStairCenterX: I3,
    stairWidth: W8,
    stairStartZ: Df,
    stairEndZ: If,
    stairTopLandingEndZ: -3.05,
    stairSteps: ul,
    stairRise: Af / ul,
    roofStairRise: (zy - Cf) / ul,
    stairTread: sM,
    stairFlights: q8,
    stairwellMinX: 0.7,
    stairwellMaxX: 4.15,
    stairwellMinZ: -3.05,
    stairwellMaxZ: 3.2,
    roofStairwellMinX: 0.75,
    roofStairwellMaxX: 2.35,
    roofStairwellMinZ: If,
    roofStairwellMaxZ: Df,
    guardHeight: 1.05,
    foundationDepth: Nf - Y8,
    clearanceRadius: Math.hypot(Ci.width, Ci.depth) * 0.5 + 1.25,
  });
function $i(t, e, n, i, r, a = jt.floorY, o = jt.floorY + jt.wallHeight) {
  let s = N3(e, n);
  return {
    shape: "box",
    id: `two-story-building:${jt.id}:${t}`,
    x: s.x,
    z: s.z,
    halfWidth: i,
    halfDepth: r,
    rotation: jt.rotation,
    minY: a,
    maxY: o,
  };
}
function L3(t, e) {
  if (!Number.isFinite(t) || !Number.isFinite(e)) return [];
  let n = jt,
    i = X8(t, e),
    r = n.width * 0.5 - n.wallThickness,
    a = n.depth * 0.5 - n.wallThickness,
    o = Math.abs(i.x) <= r && Math.abs(i.z) <= a,
    s =
      Math.abs(i.x) <= n.doorWidth * 0.5 &&
      i.z > a &&
      i.z <= n.depth * 0.5 + 0.55;
  if (!o && !s) return [];
  let l = [n.floorY];
  if (!o) return l;
  for (let d of n.stairFlights) {
    let p = Math.abs(i.x - d.centerX) <= n.stairWidth * 0.5,
      f = Math.min(d.startZ, d.endZ),
      S = Math.max(d.startZ, d.endZ);
    if (!p || i.z < f || i.z > S) continue;
    let m = Math.sign(d.endZ - d.startZ) * (i.z - d.startZ),
      y = THREE.MathUtils.clamp(m / Math.abs(d.endZ - d.startZ), 0, 0.999999),
      x = Math.floor(y * d.steps);
    l.push(d.startY + (x + 1) * d.rise);
  }
  let c =
      i.x >= n.stairwellMinX &&
      i.x <= n.stairwellMaxX &&
      i.z >= n.stairwellMinZ &&
      i.z <= n.stairwellMaxZ,
    u =
      i.x >= n.stairwellMinX &&
      i.x <= n.stairwellMaxX &&
      i.z >= n.stairwellMinZ &&
      i.z <= n.stairEndZ;
  return (
    (!c || u) && l.push(n.upperFloorY),
    (i.x >= n.roofStairwellMinX &&
      i.x <= n.roofStairwellMaxX &&
      i.z >= n.roofStairwellMinZ &&
      i.z <= n.roofStairwellMaxZ) ||
      l.push(n.roofY),
    [...new Set(l)].sort((d, p) => d - p)
  );
}
function O3(t, e = !1) {
  let n = jt,
    i = new THREE.Group();
  ((i.name = `two-story-building:${n.id}`),
    i.position.set(n.x, n.floorY, n.z),
    (i.rotation.y = n.rotation),
    (i.userData.enterable = !0),
    (i.userData.floorCount = n.floorCount),
    (i.userData.roofAccess = n.roofAccess),
    (i.userData.roofY = n.roofY));
  let r = {
      wall: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 7367780,
          roughness: 0.88,
          metalness: 0.05,
        }),
        { role: "building", weatherExposure: 0, environmentScale: 0.8 },
      ),
      floor: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 4540740,
          roughness: 0.83,
          metalness: 0.12,
        }),
        { role: "building", weatherExposure: 0, environmentScale: 0.74 },
      ),
      roof: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 3159603,
          roughness: 0.7,
          metalness: 0.3,
        }),
        {
          role: "roof",
          weatherExposure: 1,
          wetRoughness: 0.3,
          environmentScale: 0.98,
          wetReflectionBoost: 0.5,
        },
      ),
      trim: ln(
        new THREE.MeshStandardNodeMaterial({
          color: 2369831,
          roughness: 0.68,
          metalness: 0.34,
        }),
        { role: "metal", weatherExposure: 0, environmentScale: 0.94 },
      ),
      glass: new THREE.MeshPhysicalNodeMaterial({
        color: 9091524,
        roughness: 0.1,
        metalness: 0.04,
        transmission: 0.76,
        thickness: 0.05,
        ior: 1.46,
        transparent: !0,
        opacity: 0.4,
        depthWrite: !1,
        side: THREE.DoubleSide,
      }),
    },
    a = (L, O, G, F) => {
      let W = new THREE.Mesh(
        new THREE.BoxGeometry(O[0], O[1], O[2]),
        r[F].clone(),
      );
      return (
        (W.name = `two-story-building:${L}`),
        W.position.set(G[0], G[1], G[2]),
        (W.castShadow = qualityHasShadows(t) && F !== "glass"),
        (W.receiveShadow = F !== "glass"),
        (W.userData.shadow = F !== "glass"),
        (W.userData.glass = F === "glass"),
        i.add(W),
        W
      );
    };
  a(
    "foundation",
    [n.width, n.foundationDepth, n.depth],
    [0, -n.foundationDepth * 0.5, 0],
    "floor",
  );
  let o = n.width * 0.5 - n.wallThickness,
    s = n.depth * 0.5 - n.wallThickness,
    l = n.storyHeight - n.slabThickness * 0.5,
    c = (L, O, G, F, W) => {
      G <= O ||
        W <= F ||
        a(
          `upper-floor:${L}`,
          [G - O, n.slabThickness, W - F],
          [(O + G) * 0.5, l, (F + W) * 0.5],
          "floor",
        );
    };
  (c("left", -o, n.stairwellMinX, -s, s),
    c("right", n.stairwellMaxX, o, -s, s),
    c("front-landing", n.stairwellMinX, n.stairwellMaxX, n.stairwellMaxZ, s),
    c("back-landing", n.stairwellMinX, n.stairwellMaxX, -s, n.stairwellMinZ));
  let u = (n.width + 0.38) * 0.5,
    h = (n.depth + 0.38) * 0.5,
    d = n.wallHeight + n.roofThickness * 0.5,
    p = (L, O, G, F, W) => {
      G <= O ||
        W <= F ||
        a(
          `roof:${L}`,
          [G - O, n.roofThickness, W - F],
          [(O + G) * 0.5, d, (F + W) * 0.5],
          "roof",
        );
    };
  (p("left", -u, n.roofStairwellMinX, -h, h),
    p("right", n.roofStairwellMaxX, u, -h, h),
    p(
      "back",
      n.roofStairwellMinX,
      n.roofStairwellMaxX,
      -h,
      n.roofStairwellMinZ,
    ),
    p(
      "front",
      n.roofStairwellMinX,
      n.roofStairwellMaxX,
      n.roofStairwellMaxZ,
      h,
    ));
  let f = (L, O) => {
    let G = L === "back",
      F = G ? n.width : n.depth,
      W =
        L === "back"
          ? -n.depth * 0.5
          : L === "left"
            ? -n.width * 0.5
            : n.width * 0.5,
      U = O * n.storyHeight,
      H = (F - n.windowWidth) * 0.5,
      ne = n.windowWidth * 0.5 + H * 0.5,
      ae = n.windowSill + n.windowHeight,
      _e = n.storyHeight - ae,
      Ue = (Q, de) => (G ? [Q, U + de, W] : [W, U + de, Q]),
      ze = (Q, de, le = n.wallThickness) => (G ? [Q, de, le] : [le, de, Q]);
    (a(
      `wall:${L}:${O}:a`,
      ze(H, n.storyHeight),
      Ue(-ne, n.storyHeight * 0.5),
      "wall",
    ),
      a(
        `wall:${L}:${O}:b`,
        ze(H, n.storyHeight),
        Ue(ne, n.storyHeight * 0.5),
        "wall",
      ),
      a(
        `wall:${L}:${O}:lower`,
        ze(n.windowWidth, n.windowSill),
        Ue(0, n.windowSill * 0.5),
        "wall",
      ),
      a(
        `wall:${L}:${O}:upper`,
        ze(n.windowWidth, _e),
        Ue(0, ae + _e * 0.5),
        "wall",
      ),
      a(
        `window:${L}:${O}`,
        ze(n.windowWidth - 0.1, n.windowHeight - 0.1, 0.045),
        Ue(0, n.windowSill + n.windowHeight * 0.5),
        "glass",
      ));
  };
  for (let L of ["back", "left", "right"]) (f(L, 0), f(L, 1));
  let S = n.depth * 0.5,
    v = (n.width - n.doorWidth) * 0.5,
    m = n.doorWidth * 0.5 + v * 0.5;
  (a(
    "wall:front-left",
    [v, n.wallHeight, n.wallThickness],
    [-m, n.wallHeight * 0.5, S],
    "wall",
  ),
    a(
      "wall:front-right",
      [v, n.wallHeight, n.wallThickness],
      [m, n.wallHeight * 0.5, S],
      "wall",
    ),
    a(
      "wall:front-header",
      [n.doorWidth, n.wallHeight - n.doorHeight, n.wallThickness],
      [0, n.doorHeight + (n.wallHeight - n.doorHeight) * 0.5, S],
      "wall",
    ));
  let y = 0.08;
  (a(
    "door:trim-left",
    [0.09, n.doorHeight, y],
    [-n.doorWidth * 0.5, n.doorHeight * 0.5, S + 0.13],
    "trim",
  ),
    a(
      "door:trim-right",
      [0.09, n.doorHeight, y],
      [n.doorWidth * 0.5, n.doorHeight * 0.5, S + 0.13],
      "trim",
    ),
    a(
      "door:trim-top",
      [n.doorWidth + 0.18, 0.09, y],
      [0, n.doorHeight, S + 0.13],
      "trim",
    ));
  for (let L of n.stairFlights) {
    let O = Math.sign(L.endZ - L.startZ),
      G = L.startY - n.floorY;
    for (let F = 0; F < L.steps; F += 1) {
      let W = (F + 1) * L.rise,
        U = L.startZ + O * (F + 0.5) * L.tread;
      a(
        `stair:${L.id}:${F + 1}`,
        [n.stairWidth, W, L.tread + 0.012],
        [L.centerX, G + W * 0.5, U],
        "floor",
      );
    }
    for (let F of [-1, 1])
      for (let W = 0; W < 5; W += 1) {
        let U = Math.floor((W * L.steps) / 5),
          H = Math.floor(((W + 1) * L.steps) / 5),
          ne = L.startZ + O * U * L.tread,
          ae = L.startZ + O * H * L.tread,
          _e = G + H * L.rise + 0.62;
        a(
          `stair:${L.id}:rail:${F}:${W}`,
          [0.07, 0.12, Math.abs(ae - ne)],
          [L.centerX + F * (n.stairWidth * 0.5 + 0.035), _e, (ne + ae) * 0.5],
          "trim",
        );
      }
  }
  (a(
    "stair:upper-switchback-landing",
    [
      n.stairwellMaxX - n.stairwellMinX,
      n.storyHeight,
      n.stairEndZ - n.stairTopLandingEndZ,
    ],
    [
      (n.stairwellMinX + n.stairwellMaxX) * 0.5,
      n.storyHeight * 0.5,
      (n.stairEndZ + n.stairTopLandingEndZ) * 0.5,
    ],
    "floor",
  ),
    a(
      "stair:upper-front-guard",
      [n.stairwellMaxX - n.stairwellMinX, 1.05, 0.08],
      [
        (n.stairwellMinX + n.stairwellMaxX) * 0.5,
        n.storyHeight + 0.525,
        n.stairwellMaxZ,
      ],
      "trim",
    ));
  let g = n.roofY - n.floorY + n.guardHeight * 0.5,
    E = n.roofStairwellMaxX - n.roofStairwellMinX,
    M = n.roofStairwellMaxZ - n.roofStairwellMinZ;
  a(
    "roof-guard:stair-back",
    [E, n.guardHeight, 0.08],
    [(n.roofStairwellMinX + n.roofStairwellMaxX) * 0.5, g, n.roofStairwellMinZ],
    "trim",
  );
  for (let L of [-1, 1])
    a(
      `roof-guard:stair-side:${L}`,
      [0.08, n.guardHeight, M],
      [
        L < 0 ? n.roofStairwellMinX : n.roofStairwellMaxX,
        g,
        (n.roofStairwellMinZ + n.roofStairwellMaxZ) * 0.5,
      ],
      "trim",
    );
  for (let L of [-1, 1])
    (a(
      `roof-guard:perimeter-x:${L}`,
      [0.08, n.guardHeight, s * 2],
      [L * o, g, 0],
      "trim",
    ),
      a(
        `roof-guard:perimeter-z:${L}`,
        [o * 2, n.guardHeight, 0.08],
        [0, g, L * s],
        "trim",
      ));
  let _ = zd(
    {
      id: n.doorId,
      name: `${n.name} door`,
      buildingX: n.x,
      buildingZ: n.z,
      buildingRotation: n.rotation,
      floorY: n.floorY,
      hingeX: -n.doorWidth * 0.5,
      hingeZ: S,
      width: n.doorWidth,
      height: n.doorHeight,
      thickness: 0.07,
    },
    r.trim,
    e,
  );
  (_.pivot.traverse((L) => {
    L instanceof THREE.Mesh && (L.castShadow = qualityHasShadows(t));
  }),
    i.add(_.pivot));
  for (let L of Object.values(r)) L.dispose();
  let b = n.width * 0.5,
    T = n.depth * 0.5,
    R = [
      $i("wall:back", 0, -T, b, n.wallThickness * 0.5),
      $i("wall:left", -b, 0, n.wallThickness * 0.5, T),
      $i("wall:right", b, 0, n.wallThickness * 0.5, T),
      $i("wall:front-left", -m, S, v * 0.5, n.wallThickness * 0.5),
      $i("wall:front-right", m, S, v * 0.5, n.wallThickness * 0.5),
      $i(
        "wall:front-header",
        0,
        S,
        n.doorWidth * 0.5,
        n.wallThickness * 0.5,
        n.floorY + n.doorHeight,
        n.floorY + n.wallHeight,
      ),
      $i(
        "stair:upper-front-guard",
        (n.stairwellMinX + n.stairwellMaxX) * 0.5,
        n.stairwellMaxZ,
        (n.stairwellMaxX - n.stairwellMinX) * 0.5,
        0.05,
        n.upperFloorY,
        n.upperFloorY + n.guardHeight,
      ),
    ];
  for (let L of n.stairFlights)
    for (let O of [-1, 1])
      R.push(
        $i(
          `stair:${L.id}:rail:${O}`,
          L.centerX + O * (n.stairWidth * 0.5 + 0.05),
          (L.startZ + L.endZ) * 0.5,
          0.05,
          Math.abs(L.startZ - L.endZ) * 0.5,
          L.startY,
          L.endY + 1.12,
        ),
      );
  let C = (n.roofStairwellMaxX - n.roofStairwellMinX) * 0.5,
    P = (n.roofStairwellMaxZ - n.roofStairwellMinZ) * 0.5,
    B = n.roofY + n.guardHeight;
  return (
    R.push(
      $i(
        "roof-guard:stair-back",
        (n.roofStairwellMinX + n.roofStairwellMaxX) * 0.5,
        n.roofStairwellMinZ,
        C,
        0.05,
        n.roofY,
        B,
      ),
      $i(
        "roof-guard:stair-left",
        n.roofStairwellMinX,
        (n.roofStairwellMinZ + n.roofStairwellMaxZ) * 0.5,
        0.05,
        P,
        n.roofY,
        B,
      ),
      $i(
        "roof-guard:stair-right",
        n.roofStairwellMaxX,
        (n.roofStairwellMinZ + n.roofStairwellMaxZ) * 0.5,
        0.05,
        P,
        n.roofY,
        B,
      ),
      $i("roof-guard:perimeter-left", -o, 0, 0.05, s, n.roofY, B),
      $i("roof-guard:perimeter-right", o, 0, 0.05, s, n.roofY, B),
      $i("roof-guard:perimeter-back", 0, -s, o, 0.05, n.roofY, B),
      $i("roof-guard:perimeter-front", 0, s, o, 0.05, n.roofY, B),
      _.collider,
    ),
    { root: i, colliders: R, doors: [_] }
  );
}
var Z8 = {
    id: "field-unit",
    definitionId: Je.id,
    landmarkId: "landmark:field-unit-compound",
    name: Je.name,
    chunkKey: Je.chunkKey,
    x: Je.x,
    z: Je.z,
    rotation: 0,
    width: Je.width,
    depth: Je.depth,
    wallThickness: Je.wallThickness,
    floorYs: [Je.floorY],
    roofY: Je.roofY,
    clearanceRadius: Je.clearanceRadius,
    reservations: [
      {
        id: "roof-stair",
        minX: Je.roofStairwellMinX,
        maxX: Je.roofStairwellMaxX,
        minZ: Je.roofStairwellMinZ,
        maxZ: Je.roofStairwellMaxZ,
      },
      {
        id: "front-door",
        minX: -Je.doorWidth * 0.5 - 0.45,
        maxX: Je.doorWidth * 0.5 + 0.45,
        minZ: Je.depth * 0.5 - 1.15,
        maxZ: Je.depth * 0.5 + 0.55,
      },
    ],
  },
  K8 = {
    id: "survey-house",
    definitionId: jt.id,
    landmarkId: "landmark:field-unit-compound",
    name: jt.name,
    chunkKey: jt.chunkKey,
    x: jt.x,
    z: jt.z,
    rotation: jt.rotation,
    width: jt.width,
    depth: jt.depth,
    wallThickness: jt.wallThickness,
    floorYs: [jt.floorY, jt.upperFloorY],
    roofY: jt.roofY,
    clearanceRadius: jt.clearanceRadius,
    reservations: [
      {
        id: "stairs",
        minX: jt.stairwellMinX,
        maxX: jt.stairwellMaxX,
        minZ: jt.stairwellMinZ,
        maxZ: jt.stairwellMaxZ,
      },
      {
        id: "front-door",
        minX: -jt.doorWidth * 0.5 - 0.45,
        maxX: jt.doorWidth * 0.5 + 0.45,
        minZ: jt.depth * 0.5 - 1.2,
        maxZ: jt.depth * 0.5 + 0.55,
      },
    ],
  },
  j8 = {
    id: "meridian-tower",
    definitionId: Jt.id,
    landmarkId: "landmark:field-unit-compound",
    name: Jt.name,
    chunkKey: Jt.chunkKey,
    x: Jt.x,
    z: Jt.z,
    rotation: Jt.rotation,
    width: Jt.width,
    depth: Jt.depth,
    wallThickness: Jt.wallThickness,
    floorYs: Jt.floorYs,
    roofY: Jt.roofY,
    clearanceRadius: Jt.clearanceRadius,
    reservations: [
      {
        id: "stairs",
        minX: Jt.stairwellMinX,
        maxX: Jt.stairwellMaxX,
        minZ: Jt.stairwellMinZ,
        maxZ: Jt.stairwellMaxZ,
      },
      {
        id: "front-door",
        minX: -Jt.doorWidth * 0.5 - 0.45,
        maxX: Jt.doorWidth * 0.5 + 0.45,
        minZ: Jt.depth * 0.5 - 1.2,
        maxZ: Jt.depth * 0.5 + 0.55,
      },
    ],
  },
  Ud = [
    {
      frame: Z8,
      doorIds: [Je.doorId],
      create: (t) => x3(t.quality, t.isDoorOpen(Je.doorId)),
      supportCandidates: y3,
    },
    {
      frame: K8,
      doorIds: [jt.doorId],
      create: (t) => O3(t.quality, t.isDoorOpen(jt.doorId)),
      supportCandidates: L3,
    },
    {
      frame: j8,
      doorIds: [Jt.doorId],
      create: (t) => R3(t.quality, t.isDoorOpen(Jt.doorId)),
      supportCandidates: T3,
    },
  ];
function Uy(t) {
  return Ud.find((e) => e.frame.id === t) ?? null;
}
function Q8(t) {
  return Ud.filter((e) => e.frame.chunkKey === t);
}
function z3(t) {
  return Ud.filter((e) => e.frame.landmarkId === t);
}
function U3(t, e, n) {
  return Q8(t).map((i) =>
    i.create({ quality: e, isDoorOpen: (r) => n[r] ?? !1 }),
  );
}
function Fy(t, e) {
  return Ud.flatMap((n) => n.supportCandidates(t, e));
}
function lM(t, e, n) {
  let i = Math.cos(t.rotation),
    r = Math.sin(t.rotation);
  return { x: t.x + i * e + r * n, z: t.z - r * e + i * n };
}
function F3(t) {
  let e = Uy(t.buildingId);
  if (!e || !Number.isInteger(t.floor)) return null;
  let n = e.frame.floorYs[t.floor];
  if (n === void 0) return null;
  let i = lM(e.frame, t.localX, t.localZ);
  return [i.x, i.z, t.localYOffset ?? 0, t.localYaw ?? 0].every(Number.isFinite)
    ? {
        x: i.x,
        y: n + (t.localYOffset ?? 0),
        z: i.z,
        yaw: e.frame.rotation + (t.localYaw ?? 0),
      }
    : null;
}
function cM(t) {
  return (((Number.isFinite(t) ? t : 0) % 1440) + 1440) % 1440;
}
function H3(t, e, n) {
  return e === n ? !0 : e < n ? t >= e && t < n : t >= e || t < n;
}
function uM(t, e) {
  let n = cM(e);
  return t.find((i) => H3(n, i.startMinute, i.endMinute)) ?? null;
}
function dM(t, e) {
  let n = cM(e);
  return t.find((i) => H3(n, i.startMinute, i.endMinute))?.text ?? "";
}
var NPCS = [
  {
    id: "npc:mara-venn:v1",
    name: "Mara Venn",
    role: "Field Coordinator",
    introduction:
      "You made it through the grid handshake. I keep assignments small until a surveyor proves the equipment\u2014and their judgment\u2014works outside a briefing room.",
    topics: [
      {
        id: "territory",
        label: "The territory",
        text: "Water explains the villages, ore explains Ironvale, and trade explains Vesper Crown. If a settlement seems misplaced, follow the road behind it.",
      },
      {
        id: "citizens",
        label: "Ambient citizens",
        text: "Most people you see are commuters, crews and market traffic. They are part of the place, not part of your assignment. Look for named field personnel when you need a response.",
      },
      {
        id: "fieldwork",
        label: "Field procedure",
        text: "Read the local record, gather only what you need, log unfamiliar subjects, and establish shelter before weather or distance makes the decision for you.",
      },
    ],
    greetings: [
      {
        id: "late-watch",
        startMinute: 0,
        endMinute: 360,
        text: "You are keeping difficult hours. Make the darkness useful.",
      },
      {
        id: "morning",
        startMinute: 360,
        endMinute: 720,
        text: "Morning. The instruments have already logged the first weather shift.",
      },
      {
        id: "afternoon",
        startMinute: 720,
        endMinute: 1080,
        text: "The afternoon wind is up. Keep an eye on visibility before leaving the basin.",
      },
      {
        id: "evening",
        startMinute: 1080,
        endMinute: 0,
        text: "Evening. File what you have before the night crews rotate through.",
      },
    ],
    schedule: [
      {
        id: "field-desk",
        startMinute: 360,
        endMinute: 1320,
        anchor: {
          kind: "building",
          buildingId: "field-unit",
          floor: 0,
          localX: -2.45,
          localZ: -2.28,
          localYaw: 0,
        },
      },
      {
        id: "survey-quarters",
        startMinute: 1320,
        endMinute: 360,
        anchor: {
          kind: "building",
          buildingId: "survey-house",
          floor: 1,
          localX: -1.35,
          localZ: 1.15,
          localYaw: 0,
        },
      },
    ],
    appearance: {
      presenter: "rigid-humanoid-v1",
      torso: 5202523,
      head: 11834232,
      coat: 3160632,
      legs: 2633261,
    },
    residentChunkKey: "0:0",
  },
  // The relay archivist: keeps the survey record at the Survey House desk and
  // issues the long-range contracts (RL-04, DW-05).
  {
    id: "npc:ines-harrow:v1",
    name: "Ines Harrow",
    role: "Signal Archivist",
    introduction:
      "Mara keeps people alive; I keep the record honest. Three relays still hold survey data from before the migration, and every one you wake lets me check the old maps against the living land.",
    topics: [
      {
        id: "relays",
        label: "The relays",
        text: "Amber Relay stands just north of the compound on the old weather line. Hollow Array is north-west, half sunk into the meadow. Meridian Vault is the far one, out to the south-east. Walk up to each housing and recover the record by hand; the scanner only catalogues the shell.",
      },
      {
        id: "dustmere",
        label: "Dustmere",
        text: "The nearest permanent village, a little over two kilometres north-west along the old relay road. Goats, dry farming and whatever the relays shed. Stake the road on your way and the next surveyor will not have to guess.",
      },
      {
        id: "archive",
        label: "The archive",
        text: "Paper outlives batteries. Everything you file with Mara is copied here, and the copies are what the next expedition will trust. Log what grows and what moves; the land changes faster than the ledgers do.",
      },
    ],
    greetings: [
      {
        id: "late-watch",
        startMinute: 0,
        endMinute: 360,
        text: "The relays are quietest before dawn. Good hours for listening.",
      },
      {
        id: "morning",
        startMinute: 360,
        endMinute: 720,
        text: "Morning. I have the overnight carrier logs if you want to compare notes.",
      },
      {
        id: "afternoon",
        startMinute: 720,
        endMinute: 1080,
        text: "Heat shimmer plays tricks on the old antennas. Trust the record, not the horizon.",
      },
      {
        id: "evening",
        startMinute: 1080,
        endMinute: 0,
        text: "Evening. Leave your field notes on the desk; I will index them tonight.",
      },
    ],
    schedule: [
      {
        id: "archive-desk",
        startMinute: 0,
        endMinute: 0,
        anchor: {
          kind: "building",
          buildingId: "survey-house",
          floor: 0,
          localX: -2.8,
          localZ: -2.15,
          localYaw: 0,
        },
      },
    ],
    appearance: {
      presenter: "rigid-humanoid-v1",
      torso: 0x6b5a48,
      head: 0x9c7458,
      coat: 0x3e3a33,
      legs: 0x2b2a27,
    },
    residentChunkKey: "0:0",
  },
];
function npcInitials(t) {
  return t.name
    .split(/\s+/)
    .map((e) => e[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function uo(t) {
  return NPCS.find((e) => e.id === t) ?? null;
}
function Hy(t, e) {
  let n = uM(t.schedule, e);
  if (!n) return null;
  if (n.anchor.kind === "world") {
    let { x: r, y: a, z: o, yaw: s } = n.anchor;
    return [r, a, o, s].every(Number.isFinite)
      ? { scheduleEntryId: n.id, x: r, y: a, z: o, yaw: s }
      : null;
  }
  let i = F3(n.anchor);
  return i ? { scheduleEntryId: n.id, ...i } : null;
}
function Pf(t, e) {
  let n = uo(t);
  return n ? Hy(n, e) : null;
}
function hM(t, e = NPCS[0].id) {
  let n = uo(e);
  return n ? dM(n.greetings, t) : "";
}
var k3 = new WeakMap();
function ky(t, e, n) {
  let i = new THREE.Mesh(
    t,
    new THREE.MeshStandardNodeMaterial({
      color: e,
      roughness: 0.88,
      flatShading: !0,
    }),
  );
  return ((i.castShadow = qualityHasShadows(n)), (i.receiveShadow = !0), i);
}
function B3(t, e, n) {
  let i = new THREE.Group();
  i.name = t.id;
  let r = ky(new THREE.BoxGeometry(0.58, 0.82, 0.34), t.appearance.torso, e);
  r.position.y = 1.18;
  let a = ky(new THREE.DodecahedronGeometry(0.24, 0), t.appearance.head, e);
  a.position.y = 1.83;
  let o = ky(new THREE.BoxGeometry(0.7, 0.42, 0.4), t.appearance.coat, e);
  o.position.y = 0.7;
  let s = ky(new THREE.BoxGeometry(0.18, 0.7, 0.2), t.appearance.legs, e);
  s.position.set(-0.17, 0.35, 0);
  let l = s.clone();
  ((l.material = s.material),
    (l.position.x = 0.17),
    i.add(r, a, o, s, l),
    k3.set(i, t));
  let c = {
    id: t.id,
    kind: "npc",
    action: "talk",
    name: t.name,
    position: new THREE.Vector3(),
    root: i,
    maxDistance: 4.8,
    hitsRequired: 0,
    hits: 0,
    npcId: t.id,
  };
  return (By(c, n), c);
}
function By(t, e) {
  if (!t.npcId) return;
  let n = k3.get(t.root),
    i = n ? Hy(n, e) : Pf(t.npcId, e);
  i &&
    (t.root.position.set(i.x, i.y, i.z),
    (t.root.rotation.y = i.yaw),
    (t.root.userData.scheduleAnchor = i.scheduleEntryId),
    t.position.set(i.x, i.y + 1.35, i.z));
}
function J8(t) {
  let n = uo(t.id) ?? NPCS[0];
  return {
    id: t.id,
    name: t.name,
    role: t.role,
    introduction: t.introduction,
    topics: t.topics,
    greetings: t.greetings ?? n.greetings,
    schedule: t.schedule ?? n.schedule,
    appearance: t.appearance ?? n.appearance,
    residentChunkKey: t.residentChunkKey ?? n.residentChunkKey,
  };
}
function G3(t, e, n) {
  return B3(J8(t), e, n);
}
var Yt = ut(Ht(), 1);
function DialoguePanel({
  snapshot: t,
  npcId: e,
  onClose: n,
  onAcceptContract: i,
  onTurnInContract: r,
  onOpenOperations: a,
}) {
  let o = uo(e),
    [s, l] = (0, V3.useState)(null);
  if (!o) return null;
  let c = o.topics.find((d) => d.id === s) ?? null,
    u = CONTRACTS.filter((d) => d.issuerNpcId === o.id),
    h = Ec(t.contractJournal);
  return (0, Yt.jsx)(qo, {
    title: o.name,
    titleId: "dialogue-title",
    kicker: `FIELD PERSONNEL / ${o.role.toUpperCase()}`,
    testId: "dialogue-overlay",
    className: "dialogue-panel",
    onClose: n,
    headerMeta: (0, Yt.jsx)("span", {
      className: "feature-header-meta",
      children: "NAMED PERSONNEL",
    }),
    footer: (0, Yt.jsxs)(Yt.Fragment, {
      children: [
        (0, Yt.jsx)("span", { children: "FIELD COORDINATION CHANNEL" }),
        (0, Yt.jsx)("button", {
          type: "button",
          className: "text-action",
          onClick: a,
          children: "OPEN FULL JOURNAL \u2192",
        }),
      ],
    }),
    children: (0, Yt.jsxs)("div", {
      className: "dialogue-layout",
      children: [
        (0, Yt.jsxs)("aside", {
          className: "npc-profile",
          "aria-label": `${o.name} profile`,
          children: [
            (0, Yt.jsxs)("div", {
              className: "npc-portrait",
              "aria-hidden": "true",
              children: [
                (0, Yt.jsx)("i", {}),
                (0, Yt.jsx)("b", {}),
                (0, Yt.jsx)("span", { children: npcInitials(o) }),
              ],
            }),
            (0, Yt.jsx)("p", { children: o.role }),
            (0, Yt.jsx)("strong", {
              children: hM(t.environment.totalMinutes, o.id),
            }),
            (0, Yt.jsx)("small", {
              children:
                "Schedule-linked field personnel \xB7 text channel only",
            }),
          ],
        }),
        (0, Yt.jsxs)("div", {
          className: "dialogue-body",
          children: [
            (0, Yt.jsx)("blockquote", { children: c?.text ?? o.introduction }),
            (0, Yt.jsxs)("nav", {
              className: "dialogue-topics",
              "aria-label": "Conversation topics",
              children: [
                (0, Yt.jsx)("button", {
                  type: "button",
                  className: s === null ? "is-active" : "",
                  onClick: () => l(null),
                  children: "ASSIGNMENTS",
                }),
                o.topics.map((d) =>
                  (0, Yt.jsx)(
                    "button",
                    {
                      type: "button",
                      className: s === d.id ? "is-active" : "",
                      onClick: () => l(d.id),
                      children: d.label.toUpperCase(),
                    },
                    d.id,
                  ),
                ),
              ],
            }),
            s === null &&
              (0, Yt.jsx)("div", {
                className: "dialogue-contracts",
                children: u.map((d) => {
                  let p = t.contractJournal.contracts[d.id],
                    f = p?.status ?? "available";
                  return (0, Yt.jsxs)(
                    "article",
                    {
                      children: [
                        (0, Yt.jsxs)("div", {
                          children: [
                            (0, Yt.jsxs)("span", {
                              children: [d.code, " / ", f.toUpperCase()],
                            }),
                            (0, Yt.jsx)("h3", { children: d.title }),
                            (0, Yt.jsx)("p", { children: d.summary }),
                          ],
                        }),
                        p
                          ? p.status === "ready"
                            ? (0, Yt.jsx)("button", {
                                type: "button",
                                className: "is-primary",
                                onClick: () => r(d.id),
                                children: "TURN IN",
                              })
                            : (0, Yt.jsx)("strong", {
                                className: `dialogue-status status-${p.status}`,
                                children:
                                  p.status === "completed"
                                    ? "FILED"
                                    : "TRACKING",
                              })
                          : (0, Yt.jsx)("button", {
                              type: "button",
                              disabled: h,
                              onClick: () => i(d.id),
                              children: h ? "ASSIGNMENT IN PROGRESS" : "ACCEPT",
                            }),
                      ],
                    },
                    d.id,
                  );
                }),
              }),
          ],
        }),
      ],
    }),
  });
}
var Lf = ut(Bi(), 1);
var Fd = Object.freeze({
  health: 100,
  wetness: 0,
  coldStress: 0,
  damageRecoveryDelay: 0,
  lastDamage: null,
});
function na(t, e, n, i) {
  return Number.isFinite(t) ? Math.min(i, Math.max(n, t)) : e;
}
function W3(t) {
  let e = na(t, 0, 0, 200);
  return na((e - 11) * 4.8, 0, 0, 100);
}
function X3(t, e, n) {
  let i = na(e, 0, 0, 100);
  return i <= 0 || t.health <= 0
    ? { ...t }
    : {
        ...t,
        health: Math.max(0, t.health - i),
        damageRecoveryDelay: 8,
        lastDamage: { kind: n, amount: i },
      };
}
function fM() {
  return { ...Fd };
}
function mM(t, e, n) {
  let i = na(t, 12, -80, 70),
    r = na(e, 0, 0, 180),
    a = na(n, 0, 0, 1);
  return i - r * 0.035 - a * 7.5;
}
function Y3(t, e, n) {
  let i = na(n, 0, 0, 0.25);
  if (i === 0) return { ...t };
  let r = na(e.precipitationRate, 0, 0, 1),
    o =
      e.precipitation !== "none" && !e.sheltered
        ? 0.055 + r * 0.12
        : e.sheltered
          ? -0.052
          : -0.018,
    s = na(t.wetness + o * i, 0, 0, 1),
    l = mM(e.temperatureC, e.windKph, s),
    c = l < 4 ? na((4 - l) / 18 + s * 0.36, 0, 0, 1) : 0,
    u = c > t.coldStress ? 0.035 : 0.045,
    h = na(
      t.coldStress +
        Math.sign(c - t.coldStress) *
          Math.min(Math.abs(c - t.coldStress), u * i),
      0,
      0,
      1,
    ),
    d = Math.max(0, t.damageRecoveryDelay - i);
  return {
    health:
      t.health > 0 && d === 0 && h < 0.72
        ? Math.min(100, t.health + 0.7 * i)
        : na(t.health, 100, 0, 100),
    wetness: s,
    coldStress: h,
    damageRecoveryDelay: d,
    lastDamage: t.lastDamage,
  };
}
function q3(t, e) {
  let n = [];
  return (
    e.sheltered && n.push("sheltered"),
    t.wetness >= 0.25 && n.push("wet"),
    t.coldStress >= 0.4 && n.push("cold"),
    e.stamina < 0.15 && n.push("exhausted"),
    t.health < 25 && t.health > 0
      ? n.push("critical")
      : t.health < 60 && t.health > 0 && n.push("injured"),
    e.inventoryWeight >= 72 && n.push("encumbered"),
    n
  );
}
var Ot = ut(Ht(), 1),
  e6 = {
    heal: "APPLY",
    deploy_bedroll: "DEPLOY",
    deploy_campfire: "DEPLOY",
    deploy_marker: "PLACE",
    deploy_shelter: "DEPLOY",
    deploy_torch: "PLACE",
  };
function InventoryPanel({ snapshot: t, onClose: e, onUseItem: n }) {
  let i = (0, Lf.useRef)(null),
    r = (0, Lf.useRef)(null);
  return (
    (0, Lf.useEffect)(() => {
      let o = document.activeElement;
      return (r.current?.focus(), () => o?.focus?.());
    }, []),
    (0, Ot.jsxs)("div", {
      className: "field-overlay",
      "data-testid": "inventory-overlay",
      children: [
        (0, Ot.jsx)("button", {
          className: "field-click-shield",
          type: "button",
          "aria-label": "Close inventory",
          onClick: e,
        }),
        (0, Ot.jsxs)("section", {
          ref: i,
          className: "field-panel inventory-panel",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "inventory-title",
          onKeyDown: (o) => {
            if (o.key === "Escape") {
              (o.preventDefault(), e());
              return;
            }
            Kr(o, i.current);
          },
          children: [
            (0, Ot.jsxs)("header", {
              className: "field-panel-header",
              children: [
                (0, Ot.jsxs)("div", {
                  children: [
                    (0, Ot.jsx)("p", {
                      className: "eyebrow",
                      children: "FIELD KIT / MATERIAL LEDGER",
                    }),
                    (0, Ot.jsx)("h2", {
                      id: "inventory-title",
                      ref: r,
                      tabIndex: -1,
                      children: "Inventory",
                    }),
                  ],
                }),
                (0, Ot.jsxs)("button", {
                  type: "button",
                  onClick: e,
                  children: [
                    "CLOSE ",
                    (0, Ot.jsx)("span", {
                      "aria-hidden": "true",
                      children: "\xD7",
                    }),
                  ],
                }),
              ],
            }),
            (0, Ot.jsxs)("div", {
              className: "inventory-summary",
              children: [
                (0, Ot.jsxs)("div", {
                  children: [
                    (0, Ot.jsx)("span", { children: "ITEMS" }),
                    (0, Ot.jsx)("strong", { children: t.inventoryItemCount }),
                  ],
                }),
                (0, Ot.jsxs)("div", {
                  children: [
                    (0, Ot.jsx)("span", { children: "LOAD" }),
                    (0, Ot.jsxs)("strong", {
                      children: [t.inventoryWeight.toFixed(1), " KG"],
                    }),
                  ],
                }),
                (0, Ot.jsxs)("div", {
                  className: t.inventoryWeight >= 72 ? "is-warning" : "",
                  children: [
                    (0, Ot.jsx)("span", { children: "MOBILITY" }),
                    (0, Ot.jsx)("strong", {
                      children:
                        t.inventoryWeight >= 72 ? "ENCUMBERED" : "NOMINAL",
                    }),
                  ],
                }),
              ],
            }),
            (0, Ot.jsx)("div", {
              className: "inventory-list",
              children: Object.keys(ITEMS).map((o) => {
                let s = ITEMS[o],
                  l = t.inventory[o],
                  c = dy(o),
                  u = l <= 0 || (c === "heal" && t.health >= t.maxHealth);
                return (0, Ot.jsxs)(
                  "article",
                  {
                    className: l > 0 ? "has-item" : "",
                    children: [
                      (0, Ot.jsx)("div", {
                        className: "inventory-index",
                        children: s.shortName.slice(0, 2),
                      }),
                      (0, Ot.jsxs)("div", {
                        children: [
                          (0, Ot.jsx)("small", { children: s.category }),
                          (0, Ot.jsx)("h3", { children: s.name }),
                          (0, Ot.jsx)("p", { children: s.description }),
                        ],
                      }),
                      (0, Ot.jsxs)("div", {
                        className: "inventory-quantity",
                        children: [
                          (0, Ot.jsx)("strong", {
                            children: String(l).padStart(2, "0"),
                          }),
                          (0, Ot.jsxs)("span", {
                            children: [(l * s.unitWeight).toFixed(1), " KG"],
                          }),
                          c &&
                            (0, Ot.jsx)("button", {
                              type: "button",
                              disabled: u,
                              onClick: () => n(o),
                              children:
                                c === "heal" && t.health >= t.maxHealth
                                  ? "VITALS FULL"
                                  : e6[c],
                            }),
                        ],
                      }),
                    ],
                  },
                  o,
                );
              }),
            }),
            (0, Ot.jsxs)("footer", {
              className: "field-panel-footer",
              children: [
                (0, Ot.jsx)("span", {
                  children: "FIELD INVENTORY / LIVE LOAD",
                }),
                (0, Ot.jsx)("p", {
                  children:
                    "Usable gear deploys ahead of the player on clear ground.",
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
}
var wc = ut(Bi(), 1);
var Ji = ut(Ht(), 1);
function InspectionPanel({ inspection: t, onClose: e }) {
  let n = (0, wc.useRef)(null),
    i = (0, wc.useRef)(null),
    r = (0, wc.useRef)(e);
  return (
    (0, wc.useEffect)(() => {
      r.current = e;
    }, [e]),
    (0, wc.useEffect)(() => {
      let a = document.activeElement;
      n.current?.focus();
      let o = (s) => {
        s.key === "Escape" && (s.preventDefault(), r.current());
      };
      return (
        window.addEventListener("keydown", o),
        () => {
          (window.removeEventListener("keydown", o), a?.focus?.());
        }
      );
    }, []),
    (0, Ji.jsxs)("div", {
      className: "field-overlay",
      "data-testid": "inspection-overlay",
      children: [
        (0, Ji.jsx)("button", {
          className: "field-click-shield",
          type: "button",
          "aria-label": "Close inspection",
          onClick: e,
        }),
        (0, Ji.jsxs)("article", {
          ref: i,
          onKeyDown: (a) => Kr(a, i.current),
          className: "field-panel inspection-panel",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "inspection-title",
          children: [
            (0, Ji.jsxs)("header", {
              className: "inspection-header",
              children: [
                (0, Ji.jsx)("p", { className: "eyebrow", children: t.kicker }),
                (0, Ji.jsxs)("span", {
                  children: ["ARCHIVE / ", t.id.toUpperCase()],
                }),
              ],
            }),
            (0, Ji.jsx)("h2", { id: "inspection-title", children: t.title }),
            (0, Ji.jsx)("blockquote", { children: t.body }),
            (0, Ji.jsxs)("footer", {
              children: [
                (0, Ji.jsx)("span", { children: "SOURCE" }),
                (0, Ji.jsx)("strong", { children: t.source }),
                (0, Ji.jsxs)("button", {
                  ref: n,
                  type: "button",
                  onClick: e,
                  children: [
                    "RETURN TO FIELD ",
                    (0, Ji.jsx)("span", { children: "\u2197" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
}
var zf = ut(Bi(), 1);
var Vy = {
    bedroll: {
      id: "recipe:bedroll:v1",
      label: "Survey bedroll",
      description: "Deploys a reusable wilderness rest site.",
      station: "field",
      ingredients: { fiber: 3 },
      output: { item: "bedroll", quantity: 1 },
    },
    campfire_kit: {
      id: "recipe:campfire-kit:v1",
      label: "Campfire kit",
      description: "Adds warmth to nearby rest sites.",
      station: "field",
      ingredients: { wood: 2, stone: 2 },
      output: { item: "campfire_kit", quantity: 1 },
    },
    survey_marker: {
      id: "recipe:survey-marker:v1",
      label: "Survey marker",
      description: "Creates a persistent navigation stake.",
      station: "field",
      ingredients: { wood: 1, stone: 1 },
      output: { item: "survey_marker", quantity: 1 },
    },
    first_aid_kit: {
      id: "recipe:first-aid-kit:v1",
      label: "First-aid kit",
      description: "Restores 35 health when used.",
      station: "workbench",
      ingredients: { fiber: 2, relic: 1 },
      output: { item: "first_aid_kit", quantity: 1 },
    },
    weather_shelter: {
      id: "recipe:weather-shelter:v1",
      label: "Weather shelter",
      description: "Shelters a nearby bedroll from precipitation.",
      station: "workbench",
      ingredients: { wood: 3, fiber: 4 },
      output: { item: "weather_shelter", quantity: 1 },
    },
    field_torch: {
      id: "recipe:field-torch:v1",
      label: "Field torch",
      description: "Marks a route with a persistent emissive light.",
      station: "workbench",
      ingredients: { wood: 1, fiber: 1, relic: 1 },
      output: { item: "field_torch", quantity: 1 },
    },
  },
  Of = Object.values(Vy).map((t) => t.id);
function Tc(t) {
  return Object.values(Vy).find((e) => e.id === t) ?? null;
}
function t6(t, e) {
  return t === "field" || e === "workbench";
}
function yM(t, e, n, i) {
  let r = Tc(e);
  if (!r) return "unknown_recipe";
  if (!i.includes(r.id)) return "locked";
  if (!t6(r.station, n)) return "wrong_station";
  if (xM(t, r.id).length > 0) return "missing_items";
  let a = r.output.item,
    o = r.ingredients[a] ?? 0;
  return t[a] - o + r.output.quantity > ITEMS[a].stackLimit
    ? "inventory_full"
    : "ready";
}
function Z3(t, e, n, i) {
  let r = Tc(e);
  if (!r)
    return {
      result: "unknown_recipe",
      inventory: { ...t },
      item: null,
      quantity: 0,
    };
  let a = yM(t, e, n, i);
  if (a !== "ready")
    return { result: a, inventory: { ...t }, item: null, quantity: 0 };
  let o = {};
  for (let [c, u] of Object.entries(r.ingredients)) o[c] = -u;
  let s = r.output.item;
  o[s] = (o[s] ?? 0) + r.output.quantity;
  let l = uy(t, o);
  return l
    ? { result: "crafted", inventory: l, item: s, quantity: r.output.quantity }
    : { result: "missing_items", inventory: { ...t }, item: null, quantity: 0 };
}
function xM(t, e) {
  let n = Tc(e);
  return n
    ? Object.entries(n.ingredients)
        .map(([i, r]) => ({ item: i, required: r, available: t[i] }))
        .filter((i) => i.available < i.required)
    : [];
}
var We = ut(Ht(), 1),
  Hd = [
    { id: "contracts", label: "CONTRACTS" },
    { id: "crafting", label: "FABRICATION" },
    { id: "fieldGuide", label: "FIELD GUIDE" },
  ],
  n6 = [
    { id: "fauna", label: "FAUNA" },
    { id: "flora", label: "FLORA" },
    { id: "resource", label: "RESOURCES" },
    { id: "landmark", label: "LANDMARKS" },
  ];
function i6({ snapshot: t, onAccept: e, onTurnIn: n }) {
  let i = t.contractJournal,
    r = Ec(i);
  return (0, We.jsx)("div", {
    className: "operations-card-list",
    "data-testid": "contract-list",
    children: CONTRACTS.map((a) => {
      let o = i.contracts[a.id],
        s = o?.status ?? "available",
        l = o && o.status === "active" ? Ta(a, o) : null;
      return (0, We.jsxs)(
        "article",
        {
          className: `operation-card contract-card status-${s} ${i.activeContractId === a.id ? "is-active" : ""}`,
          children: [
            (0, We.jsxs)("header", {
              children: [
                (0, We.jsx)("span", { children: a.code }),
                (0, We.jsx)("strong", {
                  children: s.replace("_", " ").toUpperCase(),
                }),
              ],
            }),
            (0, We.jsx)("h3", { children: a.title }),
            (0, We.jsx)("p", { children: a.summary }),
            (0, We.jsx)("ol", {
              className: "contract-objectives",
              children: a.objectives.map((c) => {
                let u = o?.objectiveProgress[c.id] ?? 0,
                  h = u >= c.amount,
                  d = l?.id === c.id;
                return (0, We.jsxs)(
                  "li",
                  {
                    className: h ? "is-complete" : d ? "is-current" : "",
                    children: [
                      (0, We.jsx)("i", {
                        "aria-hidden": "true",
                        children: h ? "\u2713" : d ? "\u2192" : "\xB7",
                      }),
                      (0, We.jsx)("span", { children: c.label }),
                      (0, We.jsxs)("strong", {
                        children: [Math.min(u, c.amount), " / ", c.amount],
                      }),
                    ],
                  },
                  c.id,
                );
              }),
            }),
            (0, We.jsxs)("div", {
              className: "contract-reward",
              children: [
                (0, We.jsx)("span", { children: "REWARD" }),
                (0, We.jsx)("p", {
                  children: Object.entries(a.rewards)
                    .map(([c, u]) => `${u}\xD7 ${ITEMS[c].shortName}`)
                    .join(" \xB7 "),
                }),
              ],
            }),
            o
              ? o.status === "ready"
                ? (0, We.jsx)("button", {
                    type: "button",
                    className: "is-primary",
                    onClick: () => n(a.id),
                    children: "FILE COMPLETED CONTRACT",
                  })
                : (0, We.jsx)("div", {
                    className: "operation-card-state",
                    children:
                      o.status === "completed"
                        ? `COMPLETED / DAY ${Math.floor((o.completedAt ?? 0) / 1440) + 1}`
                        : (l?.label ??
                          `OBJECTIVES COMPLETE \u2014 REPORT TO ${(uo(a.issuerNpcId)?.name.split(" ")[0] ?? "THE ISSUER").toUpperCase()}`),
                  })
              : (0, We.jsx)("button", {
                  type: "button",
                  disabled: r,
                  onClick: () => e(a.id),
                  children: r
                    ? "COMPLETE ACTIVE CONTRACT FIRST"
                    : "ACCEPT CONTRACT",
                }),
          ],
        },
        a.id,
      );
    }),
  });
}
function r6({ snapshot: t, station: e, onCraft: n }) {
  return (0, We.jsx)("div", {
    className: "operations-card-list crafting-list",
    "data-testid": "crafting-list",
    children: Object.values(Vy).map((i) => {
      let r = yM(t.inventory, i.id, e, t.unlockedRecipeIds),
        a = r !== "locked",
        o = r === "missing_items" ? xM(t.inventory, i.id) : [],
        s = r === "ready",
        l = ITEMS[i.output.item];
      return (0, We.jsxs)(
        "article",
        {
          className: `operation-card recipe-card ${s ? "is-ready" : ""}`,
          children: [
            (0, We.jsxs)("header", {
              children: [
                (0, We.jsxs)("span", {
                  children: [i.station.toUpperCase(), " RECIPE"],
                }),
                (0, We.jsx)("strong", { children: a ? "UNLOCKED" : "LOCKED" }),
              ],
            }),
            (0, We.jsxs)("div", {
              className: "recipe-heading",
              children: [
                (0, We.jsx)("div", {
                  className: "inventory-index",
                  children: l.shortName.slice(0, 2),
                }),
                (0, We.jsxs)("div", {
                  children: [
                    (0, We.jsx)("h3", { children: i.label }),
                    (0, We.jsx)("p", { children: i.description }),
                  ],
                }),
              ],
            }),
            (0, We.jsx)("div", {
              className: "ingredient-list",
              "aria-label": "Required ingredients",
              children: Object.entries(i.ingredients).map(([c, u]) => {
                let h = t.inventory[c];
                return (0, We.jsxs)(
                  "span",
                  {
                    className: h < u ? "is-missing" : "",
                    children: [
                      ITEMS[c].shortName,
                      " ",
                      (0, We.jsxs)("strong", { children: [h, "/", u] }),
                    ],
                  },
                  c,
                );
              }),
            }),
            (0, We.jsx)("button", {
              type: "button",
              disabled: !s,
              onClick: () => n(i.id, e),
              children: a
                ? r === "wrong_station"
                  ? "WORKBENCH REQUIRED"
                  : o.length > 0
                    ? `MISSING ${o.map((c) => ITEMS[c.item].shortName).join(" / ")}`
                    : r === "inventory_full"
                      ? `${l.shortName} STACK FULL`
                      : `FABRICATE ${i.output.quantity}\xD7 ${l.shortName}`
                : "RECIPE LOCKED",
            }),
          ],
        },
        i.id,
      );
    }),
  });
}
function a6({ snapshot: t }) {
  let [e, n] = (0, zf.useState)("fauna"),
    i = (0, zf.useMemo)(
      () => new Set(t.fieldGuideEntryIds),
      [t.fieldGuideEntryIds],
    ),
    r = ll.filter((a) => a.category === e);
  return (0, We.jsxs)("div", {
    className: "field-guide-layout",
    "data-testid": "field-guide-list",
    children: [
      (0, We.jsx)("nav", {
        className: "guide-category-tabs",
        "aria-label": "Field guide categories",
        children: n6.map((a) => {
          let o = ll.filter((l) => l.category === a.id && i.has(l.id)).length,
            s = ll.filter((l) => l.category === a.id).length;
          return (0, We.jsxs)(
            "button",
            {
              type: "button",
              className: e === a.id ? "is-active" : "",
              "aria-pressed": e === a.id,
              onClick: () => n(a.id),
              children: [
                (0, We.jsx)("span", { children: a.label }),
                (0, We.jsxs)("strong", { children: [o, "/", s] }),
              ],
            },
            a.id,
          );
        }),
      }),
      (0, We.jsx)("div", {
        className: "guide-entry-grid",
        children: r.map((a, o) => {
          let s = i.has(a.id);
          return (0, We.jsxs)(
            "article",
            {
              className: s ? "is-recorded" : "is-unknown",
              children: [
                (0, We.jsxs)("span", {
                  children: [
                    String(o + 1).padStart(2, "0"),
                    " / ",
                    e.toUpperCase(),
                  ],
                }),
                (0, We.jsx)("h3", {
                  children: s ? a.title : "UNRECORDED SUBJECT",
                }),
                (0, We.jsx)("p", {
                  children: s
                    ? a.summary
                    : "Hold the field scanner on a matching subject to resolve this record.",
                }),
                (0, We.jsx)("small", {
                  children: s ? "CATALOG ENTRY VERIFIED" : "SIGNATURE UNKNOWN",
                }),
              ],
            },
            a.id,
          );
        }),
      }),
    ],
  });
}
function OperationsPanel({
  snapshot: t,
  initialTab: e,
  station: n,
  onClose: i,
  onAcceptContract: r,
  onTurnInContract: a,
  onCraft: o,
}) {
  let [s, l] = (0, zf.useState)(e),
    c = t.fieldGuideEntryIds.length;
  return (0, We.jsxs)(qo, {
    title: "Field operations",
    titleId: "operations-title",
    kicker: "FIELD LINK / OPERATIONS CONSOLE",
    testId: "operations-overlay",
    className: "operations-panel",
    onClose: i,
    headerMeta: (0, We.jsxs)("span", {
      className: "feature-header-meta",
      children: [n.toUpperCase(), " ACCESS"],
    }),
    footer: (0, We.jsxs)(We.Fragment, {
      children: [
        (0, We.jsx)("span", {
          children: "PROGRESSION SAVES WITH EACH MATERIAL ACTION",
        }),
        (0, We.jsxs)("p", {
          children: [c, " / ", ll.length, " field records resolved"],
        }),
      ],
    }),
    children: [
      (0, We.jsx)("div", {
        className: "operations-tabs",
        role: "tablist",
        "aria-label": "Field operations sections",
        children: Hd.map((u, h) =>
          (0, We.jsx)(
            "button",
            {
              id: `operations-tab-${u.id}`,
              type: "button",
              className: s === u.id ? "is-active" : "",
              "aria-selected": s === u.id,
              "aria-controls": "operations-content",
              tabIndex: s === u.id ? 0 : -1,
              role: "tab",
              onClick: () => l(u.id),
              onKeyDown: (d) => {
                if (d.altKey || d.ctrlKey || d.metaKey) return;
                let p =
                  d.key === "ArrowRight"
                    ? (h + 1) % Hd.length
                    : d.key === "ArrowLeft"
                      ? (h + Hd.length - 1) % Hd.length
                      : d.key === "Home"
                        ? 0
                        : d.key === "End"
                          ? Hd.length - 1
                          : null;
                if (p === null) return;
                d.preventDefault();
                let f = Hd[p].id;
                (l(f),
                  d.currentTarget.parentElement
                    ?.querySelector(`#operations-tab-${f}`)
                    ?.focus());
              },
              children: u.label,
            },
            u.id,
          ),
        ),
      }),
      (0, We.jsx)("div", {
        id: "operations-content",
        className: "operations-content",
        role: "tabpanel",
        "aria-labelledby": `operations-tab-${s}`,
        tabIndex: 0,
        children:
          s === "contracts"
            ? (0, We.jsx)(i6, { snapshot: t, onAccept: r, onTurnIn: a })
            : s === "crafting"
              ? (0, We.jsx)(r6, { snapshot: t, station: n, onCraft: o })
              : (0, We.jsx)(a6, { snapshot: t }),
      }),
    ],
  });
}
var SM = [
  {
    id: "wait_1h",
    label: "Wait one hour",
    description: "Advance the clock with light recovery.",
  },
  {
    id: "rest_4h",
    label: "Rest four hours",
    description: "Recover health and reduce exposure.",
  },
  {
    id: "sleep_until_7",
    label: "Sleep until 07:00",
    description: "Advance to the next morning watch.",
  },
];
function o6(t, e) {
  if (t === "wait_1h") return 60;
  if (t === "rest_4h") return 240;
  let r = 420 - (((e % 1440) + 1440) % 1440);
  return r > 0 ? r : r + 1440;
}
function K3(t, e, n, i) {
  if (t.health <= 0 || !SM.some((d) => d.id === n))
    return { accepted: !1, minutes: 0, condition: { ...t } };
  let r = o6(n, Number.isFinite(i) ? i : 0),
    a = r / 60,
    o = e.safe ? 1 : 0.62,
    s = e.sheltered ? 1 : 0.46,
    l = Math.min(1, Math.max(0, e.warmth)),
    c = a * 5.5 * o * (0.72 + l * 0.28),
    u = a * (0.11 + s * 0.16 + l * 0.22),
    h = a * (0.09 + s * 0.12 + l * 0.3);
  return {
    accepted: !0,
    minutes: r,
    condition: {
      ...t,
      health: Math.min(100, t.health + c),
      wetness: Math.max(0, t.wetness - u),
      coldStress: Math.max(0, t.coldStress - h),
      damageRecoveryDelay: 0,
    },
  };
}
var cn = ut(Ht(), 1);
function s6(t, e) {
  if (t === "wait_1h") return 60;
  if (t === "rest_4h") return 240;
  let i = 420 - (((e % 1440) + 1440) % 1440);
  return i > 0 ? i : i + 1440;
}
function l6(t, e) {
  let n = t + e,
    i = Math.floor(n / 1440) + 1,
    r = ((n % 1440) + 1440) % 1440,
    a = Math.floor(r / 60),
    o = Math.floor(r % 60);
  return `DAY ${String(i).padStart(3, "0")} / ${String(a).padStart(2, "0")}:${String(o).padStart(2, "0")}`;
}
function RestPanel({ snapshot: t, site: e, onClose: n, onRest: i }) {
  let r = Math.round(
    (e.safe ? 40 : 12) +
      (e.sheltered ? 35 : 8) +
      Math.min(1, Math.max(0, e.warmth)) * 25,
  );
  return (0, cn.jsx)(qo, {
    title: e.label,
    titleId: "rest-title",
    kicker: "FIELD RECOVERY / TIME ADVANCE",
    testId: "rest-overlay",
    className: "rest-panel",
    onClose: n,
    headerMeta: (0, cn.jsxs)("span", {
      className: "feature-header-meta",
      children: ["SITE ", r, "%"],
    }),
    footer: (0, cn.jsxs)(cn.Fragment, {
      children: [
        (0, cn.jsx)("span", {
          children: "REST ADVANCES THE PERSISTENT WORLD CLOCK",
        }),
        (0, cn.jsx)("p", {
          children: "Weather and population will resynchronize on waking.",
        }),
      ],
    }),
    children: (0, cn.jsxs)("div", {
      className: "rest-layout",
      children: [
        (0, cn.jsxs)("aside", {
          className: "rest-site-readout",
          children: [
            (0, cn.jsxs)("div", {
              className: "rest-quality-ring",
              style: { "--rest-quality": `${r}%` },
              children: [
                (0, cn.jsx)("strong", { children: r }),
                (0, cn.jsx)("span", { children: "SITE" }),
              ],
            }),
            (0, cn.jsxs)("div", {
              children: [
                (0, cn.jsxs)("span", {
                  className: e.safe ? "is-positive" : "",
                  children: [
                    "SAFETY ",
                    (0, cn.jsx)("strong", {
                      children: e.safe ? "SECURE" : "EXPOSED",
                    }),
                  ],
                }),
                (0, cn.jsxs)("span", {
                  className: e.sheltered ? "is-positive" : "",
                  children: [
                    "SHELTER ",
                    (0, cn.jsx)("strong", {
                      children: e.sheltered ? "COVERED" : "OPEN",
                    }),
                  ],
                }),
                (0, cn.jsxs)("span", {
                  className: e.warmth > 0 ? "is-positive" : "",
                  children: [
                    "WARMTH ",
                    (0, cn.jsxs)("strong", {
                      children: [Math.round(e.warmth * 100), "%"],
                    }),
                  ],
                }),
              ],
            }),
            (0, cn.jsxs)("small", {
              children: [
                "VITALS ",
                Math.ceil(t.health),
                " \xB7 WET ",
                Math.round(t.wetness * 100),
                "% \xB7 COLD ",
                Math.round(t.coldStress * 100),
                "%",
              ],
            }),
          ],
        }),
        (0, cn.jsx)("div", {
          className: "rest-options",
          children: SM.map((a) => {
            let o = s6(a.id, t.environment.totalMinutes);
            return (0, cn.jsxs)(
              "button",
              {
                type: "button",
                disabled: t.health <= 0,
                onClick: () => i(a.id),
                children: [
                  (0, cn.jsx)("span", { children: a.label }),
                  (0, cn.jsx)("p", { children: a.description }),
                  (0, cn.jsx)("strong", {
                    children: l6(t.environment.totalMinutes, o),
                  }),
                  (0, cn.jsxs)("small", {
                    children: [Math.round((o / 60) * 10) / 10, " H WORLD TIME"],
                  }),
                ],
              },
              a.id,
            );
          }),
        }),
      ],
    }),
  });
}
var dl = ut(Bi(), 1);
var Re = ut(Ht(), 1);
function SettingsPanel({
  snapshot: t,
  onClose: e,
  onSetFov: n,
  onSetCameraDistance: i,
  onSetCameraView: r,
  onSetIsometricAngle: a,
  onSetSensitivity: o,
  onSetInvertY: s,
  onSetVolume: l,
  onSetQuality: c,
  onSetHorizon: u,
  onSetWorldDetail: h,
  onSetInterfaceScale: d,
  onRebind: p,
  onReset: f,
  onOpenDisplay: D,
}) {
  let S = (0, dl.useRef)(null),
    v = (0, dl.useRef)(null),
    [m, y] = (0, dl.useState)(null);
  ((0, dl.useEffect)(() => {
    let E = document.activeElement;
    return (v.current?.focus(), () => E?.focus?.());
  }, []),
    (0, dl.useEffect)(() => {
      if (!m) return;
      let E = (M) => {
        if ((M.preventDefault(), M.stopPropagation(), M.code === "Escape")) {
          y(null);
          return;
        }
        (p(m, M.code), y(null));
      };
      return (
        window.addEventListener("keydown", E, !0),
        () => window.removeEventListener("keydown", E, !0)
      );
    }, [m, p]));
  let x = (E) => {
      if (!m) {
        if (E.key === "Escape") {
          (E.preventDefault(), e());
          return;
        }
        Kr(E, S.current);
      }
    },
    g = [
      ["masterVolume", "MASTER"],
      ["ambientVolume", "AMBIENCE"],
      ["effectsVolume", "EFFECTS"],
    ];
  return (0, Re.jsxs)("div", {
    className: "field-overlay settings-overlay",
    "data-testid": "settings-overlay",
    children: [
      (0, Re.jsx)("button", {
        className: "field-click-shield",
        type: "button",
        "aria-label": "Close settings",
        onClick: e,
      }),
      (0, Re.jsxs)("section", {
        ref: S,
        className: "field-panel settings-panel",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "settings-title",
        onKeyDown: x,
        children: [
          (0, Re.jsxs)("header", {
            className: "field-panel-header",
            children: [
              (0, Re.jsxs)("div", {
                children: [
                  (0, Re.jsx)("p", {
                    className: "eyebrow",
                    children: "FIELD UNIT / LOCAL PREFERENCES",
                  }),
                  (0, Re.jsx)("h2", {
                    id: "settings-title",
                    ref: v,
                    tabIndex: -1,
                    children: "Settings",
                  }),
                ],
              }),
              (0, Re.jsxs)("button", {
                type: "button",
                onClick: e,
                children: [
                  "CLOSE ",
                  (0, Re.jsx)("span", {
                    "aria-hidden": "true",
                    children: "\xD7",
                  }),
                ],
              }),
            ],
          }),
          (0, Re.jsxs)("div", {
            className: "settings-columns",
            children: [
              (0, Re.jsxs)("div", {
                className: "settings-section",
                children: [
                  (0, Re.jsx)("h3", { children: "ACCESSIBILITY / INTERFACE" }),
                  (0, Re.jsx)("div", {
                    className: "settings-button-grid interface-scale-grid",
                    role: "group",
                    "aria-label": "Interface text size",
                    children: D_.map((E) => {
                      let M = yN[E],
                        _ = t.settings.interfaceScale === E;
                      return (0, Re.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: _ ? "is-active" : "",
                          "aria-pressed": _,
                          "data-testid": `interface-scale-${E}`,
                          onClick: () => d(E),
                          children: [
                            (0, Re.jsx)("span", { children: M.label }),
                            (0, Re.jsxs)("small", {
                              children: [
                                M.percentage,
                                "% \xB7 ",
                                M.description,
                              ],
                            }),
                          ],
                        },
                        E,
                      );
                    }),
                  }),
                  (0, Re.jsx)("h3", { children: "VIEW / CONTROL" }),
                  (0, Re.jsx)("div", {
                    className: "settings-button-grid camera-view-grid",
                    role: "group",
                    "aria-label": "Camera view preset",
                    children: Xo.map((E) => {
                      let M = rl[E],
                        _ = t.camera.mode === E;
                      return (0, Re.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: _ ? "is-active" : "",
                          "aria-pressed": _,
                          "data-testid": `camera-view-${E}`,
                          onClick: () => r(E),
                          children: [
                            (0, Re.jsx)("span", { children: M.label }),
                            (0, Re.jsx)("small", { children: M.description }),
                          ],
                        },
                        E,
                      );
                    }),
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-range",
                    htmlFor: "camera-distance-slider",
                    children: [
                      (0, Re.jsxs)("span", {
                        children: [
                          "CAMERA ZOOM",
                          (0, Re.jsx)("output", {
                            htmlFor: "camera-distance-slider",
                            children:
                              t.camera.targetDistance <= 1e-4
                                ? "FIRST PERSON"
                                : `${t.camera.targetDistance.toFixed(1)} M`,
                          }),
                        ],
                      }),
                      (0, Re.jsx)("input", {
                        id: "camera-distance-slider",
                        "data-testid": "camera-distance-slider",
                        type: "range",
                        min: "0",
                        max: T_,
                        step: "0.5",
                        value: t.settings.cameraDistance,
                        "aria-valuetext": `${rl[t.camera.mode].label}, ${t.camera.targetDistance.toFixed(1)} metres requested`,
                        onChange: (E) => i(Number(E.currentTarget.value)),
                      }),
                    ],
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-range",
                    htmlFor: "isometric-angle-slider",
                    children: [
                      (0, Re.jsxs)("span", {
                        children: [
                          "ISOMETRIC ANGLE",
                          (0, Re.jsxs)("output", {
                            htmlFor: "isometric-angle-slider",
                            children: [
                              Math.round(t.settings.isometricAngle),
                              "\xB0",
                            ],
                          }),
                        ],
                      }),
                      (0, Re.jsx)("input", {
                        id: "isometric-angle-slider",
                        "data-testid": "isometric-angle-slider",
                        type: "range",
                        min: R_,
                        max: C_,
                        step: "1",
                        value: t.settings.isometricAngle,
                        onChange: (E) => a(Number(E.currentTarget.value)),
                      }),
                    ],
                  }),
                  (0, Re.jsxs)("p", {
                    className: "settings-audio-state",
                    children: [
                      "WHEEL: CONTINUOUS ZOOM \xB7 ",
                      keyLabel(t.settings.keyBindings.cameraView),
                      ": CYCLE PRESETS \xB7 COLLISION-AWARE BOOM",
                      t.camera.collisionLimited
                        ? ` \xB7 RETRACTED TO ${t.camera.distance.toFixed(1)} M`
                        : "",
                    ],
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-range",
                    children: [
                      (0, Re.jsxs)("span", {
                        children: [
                          "BASE FIELD OF VIEW ",
                          (0, Re.jsxs)("output", {
                            children: [Math.round(t.settings.fov), "\xB0"],
                          }),
                        ],
                      }),
                      (0, Re.jsx)("input", {
                        type: "range",
                        min: "55",
                        max: "95",
                        step: "1",
                        value: t.settings.fov,
                        onChange: (E) => n(Number(E.currentTarget.value)),
                      }),
                    ],
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-range",
                    children: [
                      (0, Re.jsxs)("span", {
                        children: [
                          "LOOK SENSITIVITY ",
                          (0, Re.jsxs)("output", {
                            children: [
                              t.settings.lookSensitivity.toFixed(2),
                              "\xD7",
                            ],
                          }),
                        ],
                      }),
                      (0, Re.jsx)("input", {
                        type: "range",
                        min: "0.25",
                        max: "2.5",
                        step: "0.05",
                        value: t.settings.lookSensitivity,
                        onChange: (E) => o(Number(E.currentTarget.value)),
                      }),
                    ],
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-toggle",
                    children: [
                      (0, Re.jsx)("span", { children: "INVERT VERTICAL LOOK" }),
                      (0, Re.jsx)("input", {
                        type: "checkbox",
                        checked: t.settings.invertY,
                        onChange: (E) => s(E.currentTarget.checked),
                      }),
                      (0, Re.jsx)("i", {
                        "aria-hidden": "true",
                        children: (0, Re.jsx)("b", {}),
                      }),
                    ],
                  }),
                  (0, Re.jsx)("h3", { children: "RENDERING" }),
                  (0, Re.jsx)("div", {
                    className: "settings-button-grid quality-grid",
                    children: QUALITY_ORDER.map((E) =>
                      (0, Re.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: t.quality === E ? "is-active" : "",
                          "aria-pressed": t.quality === E,
                          onClick: () => c(E),
                          children: [
                            (0, Re.jsx)("span", {
                              children: QUALITY_PROFILES[E].label,
                            }),
                            (0, Re.jsx)("small", {
                              children:
                                E === "ultra"
                                  ? "4K SHADOWS / AO / BLOOM"
                                  : E === "cinematic"
                                    ? "SHADOWS / BLOOM / GRADE"
                                    : "LEAN GPU PROFILE",
                            }),
                          ],
                        },
                        E,
                      ),
                    ),
                  }),
                  (0, Re.jsxs)("label", {
                    className: "settings-range",
                    htmlFor: "world-detail-slider",
                    children: [
                      (0, Re.jsxs)("span", {
                        children: [
                          "MID-FIELD LOD",
                          (0, Re.jsxs)("output", {
                            htmlFor: "world-detail-slider",
                            children: [
                              ha[t.settings.worldDetail].label,
                              " \xB7 ",
                              ha[t.settings.worldDetail].description.replace(
                                " DETAIL",
                                "",
                              ),
                            ],
                          }),
                        ],
                      }),
                      (0, Re.jsx)("input", {
                        id: "world-detail-slider",
                        type: "range",
                        min: "0",
                        max: "4",
                        step: "1",
                        value: t.settings.worldDetail,
                        "aria-describedby": "world-detail-help",
                        "aria-valuetext": `${ha[t.settings.worldDetail].label}, ${ha[t.settings.worldDetail].description.toLowerCase()}`,
                        onChange: (E) => h(Number(E.currentTarget.value)),
                      }),
                    ],
                  }),
                  (0, Re.jsx)("p", {
                    className: "settings-audio-state",
                    id: "world-detail-help",
                    children:
                      "Refines render-only terrain and scenery between the loaded world and horizon. Simulation stays fixed.",
                  }),
                  (0, Re.jsx)("div", {
                    className: "settings-button-grid horizon-grid",
                    children: Object.keys(HORIZON_PROFILES).map((E) =>
                      (0, Re.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: t.horizonMode === E ? "is-active" : "",
                          "aria-pressed": t.horizonMode === E,
                          onClick: () => u(E),
                          children: [
                            (0, Re.jsx)("span", {
                              children: HORIZON_PROFILES[E].label,
                            }),
                            (0, Re.jsxs)("small", {
                              children: [
                                Math.round(
                                  HORIZON_PROFILES[E].drawDistanceMeters / 1e3,
                                ),
                                " KM",
                              ],
                            }),
                          ],
                        },
                        E,
                      ),
                    ),
                  }),
                  (0, Re.jsx)("h3", { children: "AUDIO" }),
                  g.map(([E, M]) =>
                    (0, Re.jsxs)(
                      "label",
                      {
                        className: "settings-range",
                        children: [
                          (0, Re.jsxs)("span", {
                            children: [
                              M,
                              " ",
                              (0, Re.jsx)("output", {
                                children: Math.round(t.settings[E] * 100),
                              }),
                            ],
                          }),
                          (0, Re.jsx)("input", {
                            type: "range",
                            min: "0",
                            max: "1",
                            step: "0.01",
                            value: t.settings[E],
                            onChange: (_) =>
                              l(E, Number(_.currentTarget.value)),
                          }),
                        ],
                      },
                      E,
                    ),
                  ),
                  (0, Re.jsxs)("p", {
                    className: "settings-audio-state",
                    children: [
                      "PROCEDURAL AUDIO \xB7 ",
                      t.audio.available
                        ? t.audio.unlocked
                          ? "ACTIVE"
                          : "AWAITING INPUT"
                        : "UNAVAILABLE",
                    ],
                  }),
                ],
              }),
              (0, Re.jsxs)("div", {
                className: "settings-section controls-settings",
                children: [
                  (0, Re.jsx)("h3", { children: "KEY BINDINGS" }),
                  (0, Re.jsx)("p", {
                    children:
                      "Choose a control, then press a key. Conflicting controls swap automatically.",
                  }),
                  (0, Re.jsx)("div", {
                    className: "binding-list",
                    children: KEY_BINDING_ACTIONS.map((E) =>
                      (0, Re.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: m === E ? "is-listening" : "",
                          "aria-label": `Rebind ${N_(E)}`,
                          onClick: () => y(E),
                          children: [
                            (0, Re.jsx)("span", { children: N_(E) }),
                            (0, Re.jsx)("kbd", {
                              children:
                                m === E
                                  ? "PRESS KEY"
                                  : keyLabel(t.settings.keyBindings[E]),
                            }),
                          ],
                        },
                        E,
                      ),
                    ),
                  }),
                  (0, Re.jsx)("h3", { children: "CONTROLLER" }),
                  (0, Re.jsx)("div", {
                    className: "control-reference",
                    "data-testid": "controller-reference",
                    children: PAD_STRIP.map(([E, M]) =>
                      (0, Re.jsxs)(
                        "span",
                        {
                          children: [
                            (0, Re.jsx)("kbd", { children: E }),
                            (0, Re.jsx)("small", { children: M }),
                          ],
                        },
                        M,
                      ),
                    ),
                  }),
                  (0, Re.jsx)("h3", { children: "TOUCH" }),
                  (0, Re.jsx)("p", {
                    children:
                      "Left thumb: move stick. Drag the right side to look, pinch to zoom. Buttons: Jump, Use (shown near something you can use), Crouch, Run, Scan. Top pills: II pause, Map, View, Light. Menus are tapped directly.",
                  }),
                ],
              }),
            ],
          }),
          (0, Re.jsxs)("footer", {
            className: "field-panel-footer settings-footer",
            children: [
              (0, Re.jsx)("p", {
                children:
                  "Preferences save on this device. World progress remains in the field save.",
              }),
              D &&
                (0, Re.jsx)("button", {
                  type: "button",
                  "data-testid": "open-display-settings",
                  onClick: D,
                  children: "DISPLAY / DEVICE (F9)",
                }),
              (0, Re.jsx)("button", {
                type: "button",
                onClick: f,
                children: "RESET DEFAULTS",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
var ra = ut(Ht(), 1),
  c6 = {
    running: "RUNNING",
    paused: "PAUSED",
    frozen: "DEV FROZEN",
    test_hold: "TEST HOLD",
  };
function WorldClock({ environment: t }) {
  let e = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    n = Math.round(1440 / Math.max(0.001, t.gameMinutesPerRealSecond) / 60);
  return (0, ra.jsxs)("section", {
    className: "world-clock",
    "data-testid": "world-clock",
    "aria-label": "World time",
    children: [
      (0, ra.jsx)("span", {
        className: "world-clock-label",
        children: "WORLD CLOCK / CYCLE",
      }),
      (0, ra.jsxs)("div", {
        className: "world-clock-primary",
        children: [
          (0, ra.jsxs)("span", {
            children: ["DAY ", String(t.day).padStart(3, "0")],
          }),
          (0, ra.jsx)("time", { dateTime: e, children: e }),
          (0, ra.jsx)("strong", { children: t.phase.toUpperCase() }),
        ],
      }),
      (0, ra.jsxs)("div", {
        className: `world-clock-state is-${t.clockState}`,
        "data-testid": "world-clock-state",
        children: [
          (0, ra.jsx)("i", { "aria-hidden": "true" }),
          (0, ra.jsx)("strong", { children: c6[t.clockState] }),
          (0, ra.jsxs)("span", {
            children: [
              t.gameMinutesPerRealSecond,
              " GAME MIN / REAL SEC \xB7 ",
              n,
              " REAL MIN / DAY",
            ],
          }),
        ],
      }),
    ],
  });
}
var Hi = ut(Bi(), 1);
var kd = "authored-landmarks",
  Wy = Object.freeze([
    Object.freeze({
      id: me.trailheadId,
      sourceId: me.id,
      label: me.trailheadName,
      position: Object.freeze({ ...me.baseWaypoint }),
      arrivalRadius: 24,
      detail: "marked summit trail \xB7 alpine terrain landmark",
    }),
    Object.freeze({
      id: He.overlookId,
      sourceId: He.id,
      label: He.overlookName,
      position: Object.freeze({ ...He.overlookWaypoint }),
      arrivalRadius: 28,
      detail: "marked rim trail \xB7 canyon overlook \xB7 river corridor",
    }),
  ]);
var u6 = pr.map((t) => ({
    id: `settlement:${t.id}`,
    sourceId: t.id,
    name: t.name,
    kind: t.tier,
    x: t.x,
    z: t.z,
    detail: t.economy,
  })),
  d6 = RELAYS.map((t) => ({
    id: `relay:${t.id}`,
    sourceId: t.id,
    name: t.name,
    kind: "relay",
    x: t.x,
    z: t.z,
    detail: t.code,
  })),
  h6 = Wy.map((t) => ({
    id: t.id,
    sourceId: t.sourceId,
    name: t.label,
    kind: "landmark",
    x: t.position.x,
    z: t.position.z,
    detail: t.detail,
  })),
  Uf = [...u6, ...d6, ...h6],
  p6 = new Map(Uf.map((t) => [t.id, t]));
function j3(t) {
  return p6.get(t) ?? null;
}
function f6(t) {
  switch (t) {
    case "megacity":
      return 72;
    case "city":
      return 52;
    case "town":
      return 34;
    case "village":
      return 22;
    case "relay":
      return 13;
    case "landmark":
      return 8;
  }
}
function m6(t, e, n) {
  if (sl(t, e, 0.15)) return !1;
  let i = 1.35;
  return [je(t + i, e), je(t - i, e), je(t, e + i), je(t, e - i)].every(
    (a) => Math.abs(a - n) <= 1.15,
  );
}
function g6(t, e, n) {
  return nl({ x: t, z: e }, n, 0.42 + 0.85);
}
function wM(t, e = []) {
  let n = f6(t.kind),
    i = (ur(`fast-travel:${t.id}:arrival:v1`) / 4294967296) * Math.PI * 2,
    r = Ke - 2,
    a = null,
    o = [n, n + 13, n + 26, n + 39, n + 52, 128, 256, 512, 1024, 2048, 4096];
  for (let c of o)
    for (let u = 0; u < 16; u += 1) {
      let h = i + (u / 16) * Math.PI * 2,
        d = Math.min(r, Math.max(-r, t.x + Math.cos(h) * c)),
        p = Math.min(r, Math.max(-r, t.z + Math.sin(h) * c)),
        f = je(d, p);
      if (((a ??= { x: d, y: f, z: p }), !!m6(d, p, f) && g6(d, p, e)))
        return { x: d, y: f, z: p };
    }
  if (a) return a;
  let s = Math.min(r, Math.max(-r, t.x)),
    l = Math.min(r, Math.max(-r, t.z));
  return { x: s, y: je(s, l), z: l };
}
function Ai(t, e) {
  return Number.isFinite(t) ? t : e;
}
function hl(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Bd(t) {
  let e = Ai(t.width, 0),
    n = Ai(t.height, 0);
  return e <= 0 || n <= 0
    ? null
    : { width: e, height: n, stageSize: Math.min(e, n) };
}
function Gd(t) {
  return Number.isFinite(t) && t > 0 ? t : 1;
}
function Ff() {
  return { centerX: 0, centerZ: 0, zoom: 1 };
}
function Q3(t) {
  let e = Bd(t);
  return e
    ? {
        left: (e.width - e.stageSize) * 0.5,
        top: (e.height - e.stageSize) * 0.5,
        size: e.stageSize,
      }
    : { left: 0, top: 0, size: 0 };
}
function ho(t, e, n) {
  let i = Gd(n),
    r = hl(Ai(t.zoom, 1), 1, 32),
    a = Bd(e);
  if (!a)
    return {
      centerX: hl(Ai(t.centerX, 0), -i, i),
      centerZ: hl(Ai(t.centerZ, 0), -i, i),
      zoom: r,
    };
  let o = (i * 2) / (a.stageSize * r),
    s = a.width * o * 0.5,
    l = a.height * o * 0.5,
    c = s >= i ? 0 : hl(Ai(t.centerX, 0), -i + s, i - s),
    u = l >= i ? 0 : hl(Ai(t.centerZ, 0), -i + l, i - l);
  return { centerX: c, centerZ: u, zoom: r };
}
function $3(t, e) {
  let n = Gd(e),
    i = 50 + (t.centerX / (n * 2)) * 100,
    r = 50 + (t.centerZ / (n * 2)) * 100;
  return {
    translateXPercent: 50 - i * t.zoom,
    translateYPercent: 50 - r * t.zoom,
    scale: t.zoom,
  };
}
function J3(t, e, n, i) {
  let r = Bd(n);
  if (
    !r ||
    !Number.isFinite(t.x) ||
    !Number.isFinite(t.y) ||
    t.x < 0 ||
    t.x > r.width ||
    t.y < 0 ||
    t.y > r.height
  )
    return null;
  let a = Gd(i),
    o = ho(e, n, a),
    s = (a * 2) / (r.stageSize * o.zoom),
    l = o.centerX + (t.x - r.width * 0.5) * s,
    c = o.centerZ + (t.y - r.height * 0.5) * s;
  return l < -a || l > a || c < -a || c > a ? null : { x: l, z: c };
}
function TM(t, e, n, i, r) {
  let a = Bd(i),
    o = Gd(r),
    s = ho(t, i, o),
    l = hl(Ai(e, s.zoom), 1, 32);
  if (!a || l === s.zoom) return { ...s, zoom: l };
  let c = hl(Ai(n.x, a.width * 0.5), 0, a.width),
    u = hl(Ai(n.y, a.height * 0.5), 0, a.height),
    h = (o * 2) / (a.stageSize * s.zoom),
    d = (o * 2) / (a.stageSize * l),
    p = c - a.width * 0.5,
    f = u - a.height * 0.5,
    S = s.centerX + p * h,
    v = s.centerZ + f * h;
  return ho({ centerX: S - p * d, centerZ: v - f * d, zoom: l }, i, o);
}
function RM(t, e, n, i) {
  let r = Bd(n),
    a = Gd(i),
    o = ho(t, n, a);
  if (!r) return o;
  let s = (a * 2) / (r.stageSize * o.zoom);
  return ho(
    {
      centerX: o.centerX - Ai(e.x, 0) * s,
      centerZ: o.centerZ - Ai(e.y, 0) * s,
      zoom: o.zoom,
    },
    n,
    a,
  );
}
function eP(t, e, n, i, r = t.zoom) {
  return ho(
    {
      centerX: Ai(e.x, t.centerX),
      centerZ: Ai(e.z, t.centerZ),
      zoom: Math.max(Ai(t.zoom, 1), Ai(r, 1)),
    },
    n,
    i,
  );
}
function tP(t, e, n) {
  let i = Gd(n),
    r = Bd(e),
    a = ho(t, e, i);
  if (!r) return { minX: -i, maxX: i, minZ: -i, maxZ: i };
  let o = (i * 2) / (r.stageSize * a.zoom),
    s = r.width * o * 0.5,
    l = r.height * o * 0.5;
  return {
    minX: Math.max(-i, a.centerX - s),
    maxX: Math.min(i, a.centerX + s),
    minZ: Math.max(-i, a.centerZ - l),
    maxZ: Math.min(i, a.centerZ + l),
  };
}
function nP(t) {
  let e = Ai(t, 1);
  return e >= 4 ? "local" : e >= 2 ? "regional" : "atlas";
}
function Xy(t, e) {
  return (
    Math.abs(t.centerX - e.centerX) < 1e-4 &&
    Math.abs(t.centerZ - e.centerZ) < 1e-4 &&
    Math.abs(t.zoom - e.zoom) < 1e-4
  );
}
var $ = ut(Ht(), 1);
function St(t) {
  return Y2(t, Ke);
}
var v6 = Array.from({ length: 33 }, (t, e) => {
    let n = -Ke + (e / 32) * Ke * 2;
    return `${St(_a(n)).toFixed(2)},${St(n).toFixed(2)}`;
  }).join(" "),
  y6 = Ko.map((t) => `${St(t.x).toFixed(2)},${St(t.z).toFixed(2)}`).join(" "),
  aP = (me.footprintRadius / (Ke * 2)) * 100,
  x6 = ao.map((t) => `${St(t.x).toFixed(2)},${St(t.z).toFixed(2)}`).join(" "),
  b6 = Lr.map((t) => `${St(t.x).toFixed(2)},${St(t.z).toFixed(2)}`).join(" "),
  oP = (He.halfLength / (Ke * 2)) * 100,
  S6 = (He.footprintHalfWidth / (Ke * 2)) * 100,
  sP = (Math.atan2(He.axis.z, He.axis.x) * 180) / Math.PI;
function E6(t, e = 110) {
  if (!Number.isFinite(t) || t <= 0) return 1e3;
  let n = e / t,
    i = 10 ** Math.floor(Math.log10(Math.max(1, n))),
    r = n / i;
  return (r >= 5 ? 5 : r >= 2 ? 2 : 1) * i;
}
function MapPanel({
  snapshot: t,
  viewport: e,
  onViewportChange: n,
  onClose: i,
  onSetWaypoint: r,
  onClearWaypoint: a,
  onActivateNavigationTarget: o,
  onFastTravel: s,
}) {
  let l = (0, Hi.useRef)(null),
    c = (0, Hi.useRef)(null),
    u = (0, Hi.useRef)(null),
    h = (0, Hi.useRef)(!1),
    [d, p] = (0, Hi.useState)(() => e),
    f = (0, Hi.useRef)(e),
    [S, v] = (0, Hi.useState)(!1),
    [m, y] = (0, Hi.useState)({ width: 0, height: 0 }),
    x = t.navigation,
    g = x?.target.source.kind === "player",
    E = t.navigationTargets.filter(
      (z) =>
        z.source.kind === "system" && z.source.systemId === "survey-markers",
    ),
    M = t.navigationTargets.filter(
      (z) => z.source.kind === "system" && z.source.systemId === kd,
    ),
    _ = (0, Hi.useCallback)((z) => {
      p((re) => {
        let ve = typeof z == "function" ? z(re) : z,
          Pe = Xy(re, ve) ? re : ve;
        return ((f.current = Pe), Pe);
      });
    }, []);
  ((0, Hi.useEffect)(
    () => () => {
      n(f.current);
    },
    [n],
  ),
    (0, Hi.useLayoutEffect)(() => {
      let z = l.current;
      if (!z) return;
      let re = () => {
        let lt = z.getBoundingClientRect(),
          pt = { width: lt.width, height: lt.height };
        (y(pt),
          _((Qe) => {
            let Gt = ho(Qe, pt, Ke);
            return Xy(Qe, Gt) ? Qe : Gt;
          }));
      };
      re();
      let ve = document.activeElement;
      z.focus({ preventScroll: !0 });
      let Pe = new ResizeObserver(re);
      return (
        Pe.observe(z),
        () => {
          (Pe.disconnect(), ve?.focus?.());
        }
      );
    }, [_]));
  let b = ho(d, m, Ke),
    T = Q3(m),
    R = $3(b, Ke),
    C = tP(b, m, Ke),
    P = Math.max(250, Math.min(C.maxX - C.minX, C.maxZ - C.minZ) * 0.08),
    B = (z) =>
      z.x >= C.minX - P &&
      z.x <= C.maxX + P &&
      z.z >= C.minZ - P &&
      z.z <= C.maxZ + P,
    L = nP(b.zoom),
    O = T.size > 0 ? (T.size * b.zoom) / (Ke * 2) : 0,
    G = E6(O),
    F = {
      left: `${T.left}px`,
      top: `${T.top}px`,
      width: `${T.size}px`,
      height: `${T.size}px`,
      transform: `translate(${R.translateXPercent}%, ${R.translateYPercent}%) scale(${R.scale})`,
      "--map-marker-scale": String(1 / b.zoom),
      "--map-line-width": `${1 / b.zoom}px`,
    },
    W = (z) => {
      _((re) => (Xy(re, z) ? re : z));
    },
    U = (z) => {
      _((re) => TM(re, z, { x: m.width * 0.5, y: m.height * 0.5 }, m, Ke));
    },
    H = (z, re = 4) => {
      _((ve) => eP(ve, z, m, Ke, re));
    },
    ne = (z) => {
      if (h.current) {
        h.current = !1;
        return;
      }
      let re = z.currentTarget.getBoundingClientRect(),
        ve = J3(
          { x: z.clientX - re.left, y: z.clientY - re.top },
          b,
          { width: re.width, height: re.height },
          Ke,
        );
      ve && r(ve.x, ve.z);
    },
    ae = (z) => {
      if (
        z.ctrlKey ||
        z.metaKey ||
        z.defaultPrevented ||
        z.target !== z.currentTarget
      )
        return;
      if ((z.key === "Delete" || z.key === "Backspace") && g) {
        (z.preventDefault(), a());
        return;
      }
      if (z.key === "+" || z.key === "=") {
        (z.preventDefault(), U(b.zoom * 1.5));
        return;
      }
      if (z.key === "-" || z.key === "_") {
        (z.preventDefault(), U(b.zoom / 1.5));
        return;
      }
      if (z.key === "0" || z.key === "Home") {
        (z.preventDefault(), W(Ff()));
        return;
      }
      if (z.key.toLowerCase() === "p") {
        (z.preventDefault(), H(t.position));
        return;
      }
      if (z.key.toLowerCase() === "n" && x) {
        (z.preventDefault(), H(x.target.position));
        return;
      }
      if (z.altKey && z.key.startsWith("Arrow")) {
        let Qe =
          z.key === "ArrowLeft"
            ? { x: 72, y: 0 }
            : z.key === "ArrowRight"
              ? { x: -72, y: 0 }
              : z.key === "ArrowUp"
                ? { x: 0, y: 72 }
                : { x: 0, y: -72 };
        (z.preventDefault(), W(RM(b, Qe, m, Ke)));
        return;
      }
      let re = z.shiftKey ? 5e3 : 1e3,
        ve = g && x ? x.target.position : t.position,
        Pe = ve.x,
        lt = ve.z;
      switch (z.key) {
        case "ArrowLeft":
          Pe -= re;
          break;
        case "ArrowRight":
          Pe += re;
          break;
        case "ArrowUp":
          lt -= re;
          break;
        case "ArrowDown":
          lt += re;
          break;
        case "Enter":
          break;
        default:
          return;
      }
      (z.preventDefault(), r(Ya(Pe, -Ke, Ke), Ya(lt, -Ke, Ke)));
    },
    _e = (z, re) => {
      (z.preventDefault(), z.stopPropagation(), s(re));
      let ve = Uf.find((Pe) => Pe.id === re);
      ve && H(ve, Math.max(4, b.zoom));
    },
    Ue = (z, re) => {
      (z.preventDefault(), z.stopPropagation(), o(re));
    },
    ze = (z) => {
      if (z.ctrlKey || z.metaKey || z.defaultPrevented) return;
      z.preventDefault();
      let re = z.currentTarget.getBoundingClientRect(),
        ve = Math.exp(-z.deltaY * 0.0015);
      _((Pe) =>
        TM(
          Pe,
          Pe.zoom * ve,
          { x: z.clientX - re.left, y: z.clientY - re.top },
          { width: re.width, height: re.height },
          Ke,
        ),
      );
    },
    Q = (z) => {
      z.button !== 0 ||
        z.target.closest("button, input, [data-map-control]") ||
        ((u.current = {
          pointerId: z.pointerId,
          startX: z.clientX,
          startY: z.clientY,
          viewport: b,
          moved: !1,
        }),
        z.currentTarget.setPointerCapture(z.pointerId));
    },
    de = (z) => {
      let re = u.current;
      if (!re || re.pointerId !== z.pointerId) return;
      let ve = { x: z.clientX - re.startX, y: z.clientY - re.startY };
      (!re.moved && Math.hypot(ve.x, ve.y) < 4) ||
        ((re.moved = !0), v(!0), W(RM(re.viewport, ve, m, Ke)));
    },
    le = (z, re = !1) => {
      let ve = u.current;
      !ve ||
        ve.pointerId !== z.pointerId ||
        (ve.moved && !re && (h.current = !0),
        (u.current = null),
        v(!1),
        z.currentTarget.hasPointerCapture(z.pointerId) &&
          z.currentTarget.releasePointerCapture(z.pointerId));
    },
    Ie = () => {
      ((u.current = null), v(!1));
    };
  return (0, $.jsxs)("section", {
    ref: c,
    onKeyDown: (z) => {
      if (z.key === "Escape") {
        (z.preventDefault(), z.stopPropagation(), i());
        return;
      }
      Kr(z, c.current);
    },
    className: "map-panel",
    "data-testid": "map-panel",
    "data-map-detail": L,
    "data-map-zoom": b.zoom.toFixed(2),
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "territory-map-title",
    children: [
      (0, $.jsxs)("header", {
        children: [
          (0, $.jsxs)("div", {
            children: [
              (0, $.jsx)("p", {
                className: "eyebrow",
                children: "FIELD CARTOGRAPHY",
              }),
              (0, $.jsx)("h2", {
                id: "territory-map-title",
                children: "GREYWATER TERRITORY / 96 \xD7 96 KM",
              }),
            ],
          }),
          (0, $.jsxs)("div", {
            className: "map-header-actions",
            children: [
              (0, $.jsx)("span", {
                className: "map-playtest-badge",
                children: "PLAYTEST / ALL DESTINATIONS OPEN",
              }),
              g &&
                (0, $.jsx)("button", {
                  type: "button",
                  "data-testid": "clear-waypoint",
                  onClick: a,
                  children: "CLEAR MARK",
                }),
              (0, $.jsxs)("button", {
                type: "button",
                onClick: i,
                children: [
                  "CLOSE ",
                  (0, $.jsx)("kbd", {
                    children: keyLabel(t.settings.keyBindings.map),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      (0, $.jsxs)("div", {
        className: "map-body",
        children: [
          (0, $.jsxs)("div", {
            ref: l,
            className: `map-plot ${S ? "is-panning" : ""}`,
            "data-testid": "map-plot",
            role: "application",
            tabIndex: 0,
            "aria-label":
              "Territory map. Scroll or use plus and minus to zoom, drag to pan, click ground to set a waypoint, or use arrow keys to move it.",
            onClick: ne,
            onKeyDown: ae,
            onWheel: ze,
            onPointerDown: Q,
            onPointerMove: de,
            onPointerUp: le,
            onPointerCancel: (z) => le(z, !0),
            onLostPointerCapture: Ie,
            onContextMenu: (z) => {
              z.target.closest("[data-map-control], button, input") ||
                (g && (z.preventDefault(), a()));
            },
            children: [
              (0, $.jsxs)("div", {
                className: "map-world",
                style: F,
                "aria-hidden": T.size <= 0,
                children: [
                  (0, $.jsxs)("svg", {
                    className: "map-geography",
                    viewBox: "0 0 100 100",
                    preserveAspectRatio: "none",
                    "aria-hidden": "true",
                    children: [
                      (0, $.jsx)("polyline", {
                        className: "map-river",
                        points: v6,
                      }),
                      (0, $.jsx)("circle", {
                        className: "map-mountain-contour is-outer",
                        cx: St(me.center.x),
                        cy: St(me.center.z),
                        r: aP,
                      }),
                      (0, $.jsx)("circle", {
                        className: "map-mountain-contour is-inner",
                        cx: St(me.center.x),
                        cy: St(me.center.z),
                        r: aP * 0.48,
                      }),
                      (0, $.jsx)("polyline", {
                        className: "map-mountain-trail",
                        points: y6,
                      }),
                      (0, $.jsx)("ellipse", {
                        className: "map-canyon-contour is-outer",
                        cx: St(He.center.x),
                        cy: St(He.center.z),
                        rx: oP,
                        ry: S6,
                        transform: `rotate(${sP} ${St(He.center.x)} ${St(He.center.z)})`,
                      }),
                      (0, $.jsx)("ellipse", {
                        className: "map-canyon-contour is-inner",
                        cx: St(He.center.x),
                        cy: St(He.center.z),
                        rx: oP * 0.78,
                        ry: (He.carvedHalfWidth / (Ke * 2)) * 100 * 0.62,
                        transform: `rotate(${sP} ${St(He.center.x)} ${St(He.center.z)})`,
                      }),
                      (0, $.jsx)("polyline", {
                        className: "map-canyon-river",
                        points: x6,
                      }),
                      (0, $.jsx)("polyline", {
                        className: "map-canyon-trail",
                        points: b6,
                      }),
                      Cd.map((z) =>
                        (0, $.jsx)(
                          "line",
                          {
                            className: `map-road is-${z.class}`,
                            x1: St(z.from.x),
                            y1: St(z.from.z),
                            x2: St(z.to.x),
                            y2: St(z.to.z),
                          },
                          z.id,
                        ),
                      ),
                      x &&
                        (0, $.jsx)("line", {
                          className: "map-waypoint-line",
                          x1: St(t.position.x),
                          y1: St(t.position.z),
                          x2: St(x.target.position.x),
                          y2: St(x.target.position.z),
                        }),
                    ],
                  }),
                  (0, $.jsx)("span", {
                    className: "map-player",
                    style: {
                      left: `${St(t.position.x)}%`,
                      top: `${St(t.position.z)}%`,
                    },
                    children: "YOU",
                  }),
                  x &&
                    (0, $.jsxs)("span", {
                      className: `map-waypoint is-${x.target.source.kind} ${x.reached ? "is-reached" : ""}`,
                      "data-testid": "map-waypoint",
                      style: {
                        left: `${St(x.target.position.x)}%`,
                        top: `${St(x.target.position.z)}%`,
                      },
                      children: [
                        (0, $.jsx)("i", {}),
                        (0, $.jsx)("b", {
                          children: x.reached ? "ARRIVED" : "WAYPOINT",
                        }),
                      ],
                    }),
                  E.filter((z) => B(z.position)).map((z) => {
                    let re = z.id.split(":").at(-1) ?? "?";
                    return (0, $.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: `map-survey-marker map-selectable-marker ${x?.target.id === z.id ? "is-current" : ""}`,
                        style: {
                          left: `${St(z.position.x)}%`,
                          top: `${St(z.position.z)}%`,
                        },
                        "data-testid": `survey-marker-${z.id}`,
                        "aria-label": `Navigate to ${z.label}`,
                        title: z.label,
                        onClick: (ve) => Ue(ve, z.id),
                        children: [
                          (0, $.jsx)("i", {}),
                          (0, $.jsxs)("b", { children: ["M", re] }),
                        ],
                      },
                      z.id,
                    );
                  }),
                  M.filter((z) => B(z.position)).map((z) =>
                    (0, $.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: `map-landmark-marker map-selectable-marker ${x?.target.id === z.id ? "is-current" : ""}`,
                        style: {
                          left: `${St(z.position.x)}%`,
                          top: `${St(z.position.z)}%`,
                        },
                        "data-testid": `landmark-marker-${z.id}`,
                        "aria-label": `Navigate to ${z.label}`,
                        title: `Navigate to ${z.label}`,
                        onClick: (re) => Ue(re, z.id),
                        children: [
                          (0, $.jsx)("i", {}),
                          (0, $.jsx)("b", { children: z.label }),
                        ],
                      },
                      z.id,
                    ),
                  ),
                  RELAYS.filter(B).map((z) =>
                    (0, $.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: `map-beacon map-fast-travel-marker ${t.scanned.includes(z.id) ? "is-scanned" : ""} ${t.lastFastTravel?.id === `relay:${z.id}` ? "is-current" : ""}`,
                        style: { left: `${St(z.x)}%`, top: `${St(z.z)}%` },
                        "data-testid": `fast-travel-marker-relay:${z.id}`,
                        "aria-label": `Fast travel to ${z.name}`,
                        onClick: (re) => _e(re, `relay:${z.id}`),
                        children: [(0, $.jsx)("i", {}), z.code],
                      },
                      z.id,
                    ),
                  ),
                  pr.filter(B).map((z) =>
                    (0, $.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: `map-settlement map-fast-travel-marker is-${z.tier} ${z.landmarkGatewayId ? "is-landmark-gateway" : ""} ${t.discoveredLocationIds.includes(`settlement:${z.id}`) ? "is-discovered" : ""} ${t.lastFastTravel?.id === `settlement:${z.id}` ? "is-current" : ""}`,
                        style: { left: `${St(z.x)}%`, top: `${St(z.z)}%` },
                        title: `${z.name}: ${z.economy}`,
                        "data-testid": `fast-travel-marker-settlement:${z.id}`,
                        "aria-label": `Fast travel to ${z.name}`,
                        onClick: (re) => _e(re, `settlement:${z.id}`),
                        children: [
                          (0, $.jsx)("i", {}),
                          (0, $.jsx)("b", { children: z.name }),
                        ],
                      },
                      z.id,
                    ),
                  ),
                ],
              }),
              (0, $.jsxs)("div", {
                className: "map-viewport-controls",
                "data-map-control": !0,
                onClick: (z) => z.stopPropagation(),
                onWheel: (z) => z.stopPropagation(),
                children: [
                  (0, $.jsxs)("div", {
                    className: "map-zoom-buttons",
                    role: "group",
                    "aria-label": "Map zoom",
                    children: [
                      (0, $.jsx)("button", {
                        type: "button",
                        "data-testid": "map-zoom-out",
                        "aria-label": "Zoom map out",
                        disabled: b.zoom <= 1,
                        onClick: () => U(b.zoom / 1.5),
                        children: "\u2212",
                      }),
                      (0, $.jsxs)("output", {
                        "data-testid": "map-zoom-output",
                        "aria-live": "polite",
                        children: [Math.round(b.zoom * 100), "%"],
                      }),
                      (0, $.jsx)("button", {
                        type: "button",
                        "data-testid": "map-zoom-in",
                        "aria-label": "Zoom map in",
                        disabled: b.zoom >= 32,
                        onClick: () => U(b.zoom * 1.5),
                        children: "+",
                      }),
                    ],
                  }),
                  (0, $.jsx)("input", {
                    type: "range",
                    "data-testid": "map-zoom-slider",
                    "aria-label": "Map zoom level",
                    "aria-valuetext": `${Math.round(b.zoom * 100)} percent`,
                    min: 1,
                    max: 32,
                    step: "any",
                    value: b.zoom,
                    onChange: (z) => U(Number(z.currentTarget.value)),
                  }),
                  (0, $.jsxs)("div", {
                    className: "map-focus-buttons",
                    role: "group",
                    "aria-label": "Map focus",
                    children: [
                      (0, $.jsxs)("button", {
                        type: "button",
                        "data-testid": "map-focus-player",
                        onClick: () => H(t.position),
                        children: [
                          "PLAYER ",
                          (0, $.jsx)("kbd", { children: "P" }),
                        ],
                      }),
                      x &&
                        (0, $.jsxs)("button", {
                          type: "button",
                          "data-testid": "map-focus-target",
                          onClick: () => H(x.target.position),
                          children: [
                            "TARGET ",
                            (0, $.jsx)("kbd", { children: "N" }),
                          ],
                        }),
                      (0, $.jsxs)("button", {
                        type: "button",
                        "data-testid": "map-fit",
                        onClick: () => W(Ff()),
                        children: [
                          "FIT ",
                          (0, $.jsx)("kbd", { children: "0" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              (0, $.jsxs)("div", {
                className: "map-scale-readout",
                "data-testid": "map-viewport-status",
                "data-map-control": !0,
                children: [
                  (0, $.jsxs)("span", {
                    children: [
                      "VIEW ",
                      ((C.maxX - C.minX) / 1e3).toFixed(1),
                      " \xD7 ",
                      ((C.maxZ - C.minZ) / 1e3).toFixed(1),
                      " KM",
                    ],
                  }),
                  (0, $.jsx)("i", {
                    style: { width: `${Math.max(34, Math.min(150, G * O))}px` },
                  }),
                  (0, $.jsx)("strong", { children: zs(G) }),
                ],
              }),
              (0, $.jsx)("span", {
                className: "map-instruction",
                children:
                  "SCROLL / + \u2212: ZOOM \xB7 DRAG / ALT+ARROWS: PAN \xB7 CLICK: WAYPOINT",
              }),
            ],
          }),
          (0, $.jsxs)("aside", {
            children: [
              (0, $.jsx)("p", {
                children: x ? "ACTIVE NAVIGATION" : "WORLD STATE",
              }),
              x &&
                (0, $.jsxs)("div", {
                  className: "map-navigation",
                  "data-testid": "map-navigation",
                  children: [
                    (0, $.jsxs)("span", {
                      children: [
                        x.target.source.kind.toUpperCase(),
                        " / DESTINATION",
                      ],
                    }),
                    (0, $.jsx)("strong", { children: x.target.label }),
                    (0, $.jsxs)("dl", {
                      children: [
                        (0, $.jsxs)("div", {
                          children: [
                            (0, $.jsx)("dt", { children: "DISTANCE" }),
                            (0, $.jsx)("dd", { children: zs(x.distance) }),
                          ],
                        }),
                        (0, $.jsxs)("div", {
                          children: [
                            (0, $.jsx)("dt", { children: "BEARING" }),
                            (0, $.jsx)("dd", { children: Xl(x.bearing) }),
                          ],
                        }),
                        (0, $.jsxs)("div", {
                          children: [
                            (0, $.jsx)("dt", { children: "X" }),
                            (0, $.jsx)("dd", {
                              children: x.target.position.x.toFixed(0),
                            }),
                          ],
                        }),
                        (0, $.jsxs)("div", {
                          children: [
                            (0, $.jsx)("dt", { children: "Z" }),
                            (0, $.jsx)("dd", {
                              children: x.target.position.z.toFixed(0),
                            }),
                          ],
                        }),
                      ],
                    }),
                    g &&
                      (0, $.jsx)("button", {
                        type: "button",
                        onClick: a,
                        children: "REMOVE WAYPOINT",
                      }),
                  ],
                }),
              (0, $.jsxs)("section", {
                className: "fast-travel-index",
                "aria-label": "Playtest fast travel destinations",
                children: [
                  (0, $.jsxs)("div", {
                    className: "fast-travel-heading",
                    children: [
                      (0, $.jsxs)("div", {
                        children: [
                          (0, $.jsx)("strong", { children: "FAST TRAVEL" }),
                          (0, $.jsx)("span", {
                            children: "TEMPORARY PLAYTEST TOOL",
                          }),
                        ],
                      }),
                      (0, $.jsx)("b", { children: Uf.length }),
                    ],
                  }),
                  t.lastFastTravel &&
                    (0, $.jsxs)("output", {
                      className: "fast-travel-status",
                      "aria-live": "polite",
                      children: ["ARRIVAL READY / ", t.lastFastTravel.name],
                    }),
                  (0, $.jsx)("div", {
                    className: "fast-travel-list",
                    children: Uf.map((z) => {
                      let re = Math.hypot(
                          z.x - t.position.x,
                          z.z - t.position.z,
                        ),
                        ve = t.lastFastTravel?.id === z.id;
                      return (0, $.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: ve ? "is-current" : "",
                          "data-testid": `fast-travel-list-${z.id}`,
                          onClick: (Pe) => _e(Pe, z.id),
                          children: [
                            (0, $.jsxs)("span", {
                              children: [
                                (0, $.jsx)("strong", { children: z.name }),
                                (0, $.jsxs)("small", {
                                  children: [
                                    z.kind.toUpperCase(),
                                    " \xB7 ",
                                    z.detail,
                                  ],
                                }),
                              ],
                            }),
                            (0, $.jsx)("b", { children: ve ? "HERE" : zs(re) }),
                          ],
                        },
                        z.id,
                      );
                    }),
                  }),
                ],
              }),
              (0, $.jsxs)("dl", {
                className: "map-world-state",
                children: [
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "SEED" }),
                      (0, $.jsx)("dd", { children: ot }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "AUTHORED AREA" }),
                      (0, $.jsxs)("dd", {
                        children: [GN.toLocaleString(), " KM\xB2"],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "SETTLEMENTS" }),
                      (0, $.jsx)("dd", { children: pr.length }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "ACTIVE GRID" }),
                      (0, $.jsxs)("dd", {
                        children: [t.chunk.x, ":", t.chunk.z],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "RESIDENT" }),
                      (0, $.jsxs)("dd", {
                        children: [t.loadedChunks, " CHUNKS"],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsxs)("dt", {
                        children: [
                          "DRAW HORIZON / ",
                          t.horizonMode.toUpperCase(),
                        ],
                      }),
                      (0, $.jsxs)("dd", {
                        children: [
                          (t.drawDistanceMeters / 1e3).toFixed(
                            t.drawDistanceMeters >= 1e4 ? 0 : 2,
                          ),
                          " KM",
                        ],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "OPTICAL VISIBILITY" }),
                      (0, $.jsx)("dd", {
                        children: zs(t.environment.visibilityMeters),
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "FAR HLOD" }),
                      (0, $.jsxs)("dd", {
                        children: [
                          t.horizonTiles,
                          " TILES / ",
                          t.horizonSettlementInstances,
                          " PROXIES / ",
                          t.horizonSettlementLightInstances,
                          " LIGHTS",
                        ],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "LOCAL TIME" }),
                      (0, $.jsxs)("dd", {
                        children: [
                          String(t.environment.hour).padStart(2, "0"),
                          ":",
                          String(t.environment.minute).padStart(2, "0"),
                        ],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "WEATHER" }),
                      (0, $.jsx)("dd", {
                        children: t.environment.weatherLabel.toUpperCase(),
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "AMBIENT CITIZENS" }),
                      (0, $.jsxs)("dd", {
                        children: [
                          t.citizenCount.toLocaleString(),
                          " / ",
                          t.crowdDensity,
                        ],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "LOCAL WILDLIFE" }),
                      (0, $.jsxs)("dd", {
                        children: [
                          t.animalCount,
                          " / ",
                          t.animalSpecies,
                          " SPECIES",
                        ],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "RECORDS" }),
                      (0, $.jsxs)("dd", {
                        children: [t.scanned.length, " / ", RELAYS.length],
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "LOCATIONS LOGGED" }),
                      (0, $.jsx)("dd", {
                        children: t.discoveredLocationIds.length,
                      }),
                    ],
                  }),
                  (0, $.jsxs)("div", {
                    children: [
                      (0, $.jsx)("dt", { children: "WORLD CHANGES" }),
                      (0, $.jsx)("dd", { children: t.worldChanges }),
                    ],
                  }),
                ],
              }),
              (0, $.jsxs)("small", {
                children: [
                  "All authored settlements and relays are unlocked for fast travel during playtesting. This temporary access layer is isolated from future discovery and quest unlock rules.",
                  (0, $.jsx)("br", {}),
                  (0, $.jsx)("br", {}),
                  !x &&
                    (0, $.jsxs)($.Fragment, {
                      children: [
                        "Click anywhere on the territory to place a persistent waypoint. The same navigation channel is available to future quests and scripted objectives.",
                        (0, $.jsx)("br", {}),
                        (0, $.jsx)("br", {}),
                      ],
                    }),
                  (0, $.jsx)("strong", { children: t.nearestSettlement.name }),
                  " \u2014 ",
                  t.nearestSettlement.reason,
                  (0, $.jsx)("br", {}),
                  (0, $.jsx)("br", {}),
                  "Its economy: ",
                  t.nearestSettlement.economy,
                  ".",
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
var lP = ut(Bi(), 1),
  Jo = ut(Ht(), 1);
function CameraAimReticle({ store: t, mode: e, viewKey: n }) {
  let r = (0, lP.useSyncExternalStore)(
    t.subscribe,
    t.getSnapshot,
    t.getServerSnapshot,
  ).aimScreen;
  return r
    ? r.visible
      ? (0, Jo.jsxs)("div", {
          className: `crosshair camera-aim-reticle ${e !== "isometric" ? "is-third-person" : "is-isometric"}`,
          "data-testid": "camera-aim-reticle",
          style: { left: `${r.xPercent}%`, top: `${r.yPercent}%` },
          "aria-hidden": "true",
          children: [
            (0, Jo.jsx)("span", {}),
            (0, Jo.jsx)("i", {}),
            (0, Jo.jsxs)("small", {
              className: "camera-view-chip",
              children: [
                e === "isometric" ? "ISO" : e === "thirdPerson" ? "TPV" : "FPV",
                " \xB7 ",
                n,
                " / WHEEL",
              ],
            }),
          ],
        })
      : null
    : (0, Jo.jsxs)("div", {
        className: "crosshair",
        "aria-hidden": "true",
        children: [(0, Jo.jsx)("span", {}), (0, Jo.jsx)("i", {})],
      });
}
var qy = 1,
  uP = 215;
var _6 = {
    megacity: { edge: 32, core: 210, medianPopulation: 118e5 },
    city: { edge: 10, core: 86, medianPopulation: 14e4 },
    town: { edge: 1.5, core: 24, medianPopulation: 22e3 },
    village: { edge: 0.15, core: 4.2, medianPopulation: 1400 },
  },
  M6 = {
    commuter: [1.15, 1.68],
    worker: [0.78, 1.18],
    trader: [0.54, 0.92],
    porter: [0.68, 1.02],
    traveler: [0.95, 1.42],
  },
  DM = [
    9395522, 5399647, 7303247, 5135728, 8083022, 9074259, 5196872, 7295838,
    4680039, 7957346, 5990468, 6443119,
  ];
function IM(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function dP(t, e) {
  let n = Math.max(0, t),
    i = Math.floor(n);
  return i + (e() < n - i ? 1 : 0);
}
function w6(t, e) {
  let n = _6[t.tier],
    i = Fi(0.08, 0.95, IM(e, 0, 1)) ** 1.6,
    r = IM((t.population / n.medianPopulation) ** 0.25, 0.75, 1.3);
  return (n.edge + (n.core - n.edge) * i) * r;
}
function T6(t) {
  if (!t) return [["traveler", 1]];
  let e = t.economy.toLowerCase(),
    n = /(mine|iron|machine|glass|ceramic|quarry|timber|solar)/.test(e),
    i = /(trade|market|freight|shipping|caravan|warehouse|ferr)/.test(e),
    r = /(grain|farm|wheat|orchard|goat|sheep|fish|vegetable)/.test(e);
  return [
    ["commuter", t.tier === "megacity" || t.tier === "city" ? 4.2 : 1.4],
    ["worker", 2.2 + (n || r ? 2.8 : 0)],
    ["trader", 1.2 + (i ? 2.6 : 0)],
    ["porter", 1 + (i || n ? 2.1 : 0)],
    ["traveler", t.tier === "village" ? 1.8 : 0.8],
  ];
}
function R6(t, e) {
  let n = T6(e),
    i = n.reduce((a, [, o]) => a + o, 0),
    r = t() * i;
  for (let [a, o] of n) if (((r -= o), r <= 0)) return a;
  return n.at(-1)?.[0] ?? "traveler";
}
function C6(t, e, n) {
  let i = Math.min(
      Math.hypot(e - t.from.x, n - t.from.z),
      Math.hypot(e - t.to.x, n - t.to.z),
    ),
    r = t.class === "trunk" ? 0.12 : t.class === "regional" ? 0.05 : 0,
    a = Math.max(r, Math.exp(-i / 1800)),
    o = t.class === "trunk" ? 8.5 : t.class === "regional" ? 4.2 : 2.15,
    s = Math.max(...t.endpointPopulations),
    l = IM(Math.log10(s + 10) / 4.8, 0.55, 1.45);
  return o * a * l;
}
function A6(t, e, n, i, r) {
  let a = R6(i, r),
    o = M6[a],
    s = a === "porter" ? 1.16 : a === "worker" ? 1.08 : 1;
  return {
    id: `citizen:v${qy}:${t}:${n.sourceId}:${e}`,
    laneId: n.id,
    source: n.source,
    sourceId: n.sourceId,
    start: { ...n.start },
    end: { ...n.end },
    roadClass: n.roadClass,
    role: a,
    speed: Kt(i, o[0], o[1]),
    phase: i(),
    height: Kt(i, 1.52, 1.96),
    width: Kt(i, 0.82, 1.16),
    depth: Kt(i, 0.86, 1.12) * s,
    palette: DM[Math.floor(i() * DM.length)] ?? DM[0],
  };
}
function hP(t, e, n, i, r) {
  if (e.length === 0 || n <= 0) return [];
  let a = kt(`${ot}:citizens:v${qy}:${t}:${i}`),
    o = Math.floor(a() * e.length),
    s = [];
  for (let l = 0; l < n; l += 1) {
    let c = e[(o + l) % e.length];
    s.push(A6(t, l, c, a, r));
  }
  return s;
}
function pP(t, e) {
  let n = ti(t, e),
    i = fr({ x: t, z: e }),
    r = KN(t, e),
    a = r.filter((c) => c.source === "settlement");
  if (a.length > 0) {
    let u = bc(i.x, i.z, 96)
      .filter((h) => a.some((d) => d.settlementId === h.id))
      .reduce(
        (h, d) => (h ? (jo(d, i.x, i.z) > jo(h, i.x, i.z) ? d : h) : d),
        null,
      );
    if (u) {
      let h = kt(`${ot}:citizens:v${qy}:${n}:budget`),
        d = Math.min(uP, dP(w6(u, jo(u, i.x, i.z)), h)),
        p = a.filter((f) => f.settlementId === u.id);
      return hP(n, p, d, `settlement:${u.id}`, u);
    }
  }
  let o = new Map(Cd.map((c) => [c.id, c])),
    s = new Map();
  for (let c of r) {
    if (c.source !== "road" || !c.corridorId) continue;
    let u = s.get(c.corridorId) ?? [];
    (u.push(c), s.set(c.corridorId, u));
  }
  let l = [];
  for (let [c, u] of [...s].sort(([h], [d]) => h.localeCompare(d))) {
    let h = o.get(c);
    if (!h) continue;
    let d = kt(`${ot}:citizens:v${qy}:${n}:road-budget:${c}`),
      p = dP(C6(h, i.x, i.z), d);
    l.push(...hP(n, u, p, `road:${c}`, null));
  }
  return l.slice(0, uP);
}
function NM(t, e) {
  if (t <= 0) return 0;
  let n = qualityHasHighDetail(e) ? 0.92 : 0.4;
  return Math.min(t, Math.max(1, Math.round(t * n)));
}
var D6 = { megacity: 0.18, city: 0.12, town: 0.07, village: 0.03, road: 0.05 },
  Yy = [
    { minute: 0, demand: 0.08 },
    { minute: 180, demand: 0 },
    { minute: 360, demand: 0.12 },
    { minute: 480, demand: 0.58 },
    { minute: 720, demand: 1 },
    { minute: 1020, demand: 0.9 },
    { minute: 1200, demand: 0.62 },
    { minute: 1380, demand: 0.18 },
    { minute: 1440, demand: 0.08 },
  ];
function I6(t, e) {
  let i = (((Number.isFinite(t) ? t : 720) % 1440) + 1440) % 1440,
    r = Yy[0],
    a = Yy[1];
  for (let u = 1; u < Yy.length && ((a = Yy[u]), !(i <= a.minute)); u += 1)
    r = a;
  let o = a.minute === r.minute ? 0 : (i - r.minute) / (a.minute - r.minute),
    s = Fi(0, 1, o),
    l = r.demand + (a.demand - r.demand) * s,
    c = D6[e];
  return c + (1 - c) * l;
}
function PM(t, e, n, i) {
  let r = NM(t, e);
  return r <= 0 ? 0 : Math.min(t, Math.max(0, Math.round(r * I6(n, i))));
}
function fP(t) {
  return t <= 0
    ? "WILDERNESS"
    : t <= 14
      ? "QUIET"
      : t <= 120
        ? "LOCAL"
        : t <= 700
          ? "ACTIVE"
          : t <= 2400
            ? "BUSY"
            : "SURGE";
}
function mP(t, e) {
  let n = Number.isFinite(e) ? e : 0,
    i = t.end.x - t.start.x,
    r = t.end.z - t.start.z,
    a = Math.max(0.001, Math.hypot(i, r)),
    s = (((t.phase + (n * t.speed) / (a * 2)) % 1) + 1) % 1,
    l = s < 0.5,
    c = l ? s * 2 : (1 - s) * 2,
    u = t.start.x + i * c,
    h = t.start.z + r * c,
    d = t.roadClass ? K_[t.roadClass] : 0,
    f =
      t.source === "road" && Math.abs(u - _a(h)) < gi(h) + d
        ? ci + 0.39
        : je(u, h) + 0.03,
    S = Math.atan2(i, r);
  return { x: u, y: f, z: h, yaw: l ? S : S + Math.PI };
}
var P6 = 1.8;
function Zy(t, e) {
  let n = t.index ? t.toNonIndexed() : t.clone();
  t.dispose();
  let i = new THREE.Color(e),
    r = new Float32Array(n.getAttribute("position").count * 3);
  for (let a = 0; a < r.length; a += 3)
    ((r[a] = i.r), (r[a + 1] = i.g), (r[a + 2] = i.b));
  return (n.setAttribute("color", new THREE.BufferAttribute(r, 3)), n);
}
function L6() {
  let t = Zy(new THREE.BoxGeometry(0.15, 0.62, 0.16), 3618611);
  t.translate(-0.12, 0.31, 0);
  let e = Zy(new THREE.BoxGeometry(0.15, 0.62, 0.16), 3618611);
  e.translate(0.12, 0.31, 0);
  let n = Zy(new THREE.BoxGeometry(0.5, 0.82, 0.27), 14012612);
  n.translate(0, 1.01, 0);
  let i = Zy(new THREE.OctahedronGeometry(0.23, 0), 13673599);
  (i.scale(0.86, 1.06, 0.9), i.translate(0, 1.61, 0));
  let r = mergeGeometries([t, e, n, i], !1);
  for (let a of [t, e, n, i]) a.dispose();
  if (!r) throw new Error("Citizen geometry could not be assembled");
  return (r.computeVertexNormals(), r.computeBoundingSphere(), r);
}
var CitizenCrowd = class {
  constructor(e, n) {
    this.scene = e;
    this.quality = n;
    this.geometry = L6();
    this.material = new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: !0,
      vertexColors: !0,
    });
    this.loaded = new Map();
    this.activeChunkKey = "";
    this.elapsedSeconds = 0;
    this.worldMinutes = 720;
    this.disposed = !1;
  }
  update(e, n, i, r) {
    this.updateStreaming(e, n);
    let a = Number.isFinite(i) ? Math.max(0, i) : 0;
    r || (this.elapsedSeconds += a);
  }
  present(e = 0) {
    let n = Number.isFinite(e) ? Math.min(0.1, Math.max(0, e)) : 0;
    this.updateMatrices(this.elapsedSeconds + n);
  }
  updateStreaming(e, n) {
    if (this.disposed) return !1;
    let i = qn(e, n),
      r = ti(i.x, i.z);
    if (r === this.activeChunkKey && this.loaded.size > 0) return !1;
    this.activeChunkKey = r;
    let a = new Set();
    for (let o of Dd(i, 2)) {
      let s = ti(o.x, o.z);
      (a.add(s), this.loaded.has(s) || this.loadChunk(o.x, o.z));
    }
    for (let [o, s] of this.loaded)
      a.has(o) || (this.unloadChunk(s), this.loaded.delete(o));
    return (this.updateMatrices(this.elapsedSeconds), !0);
  }
  setQuality(e) {
    this.quality !== e &&
      ((this.quality = e), this.updateMatrices(this.elapsedSeconds));
  }
  setWorldMinutes(e) {
    let n = Number.isFinite(e) ? e : 720,
      i = Math.floor(this.worldMinutes);
    ((this.worldMinutes = n),
      Math.floor(n) !== i && this.updateVisibleCounts());
  }
  get visibleCount() {
    let e = 0;
    for (let n of this.loaded.values()) e += n.mesh?.count ?? 0;
    return e;
  }
  get recipeCount() {
    let e = 0;
    for (let n of this.loaded.values()) e += n.recipes.length;
    return e;
  }
  get density() {
    return fP(this.visibleCount);
  }
  get activityMultiplier() {
    let e = 0;
    for (let n of this.loaded.values()) e += NM(n.recipes.length, this.quality);
    return e > 0 ? this.visibleCount / e : 0;
  }
  get updateHz() {
    return 60;
  }
  get loadedCount() {
    return this.loaded.size;
  }
  debugSnapshot(e = 64) {
    let n = [...this.loaded.values()]
      .flatMap((i) => i.recipes.slice(0, i.mesh?.count ?? 0).map((r) => r.id))
      .sort()
      .slice(0, Math.max(0, e));
    return {
      visible: this.visibleCount,
      generated: this.recipeCount,
      density: this.density,
      chunks: this.loadedCount,
      updateHz: this.updateHz,
      activityMultiplier: this.activityMultiplier,
      ids: n,
    };
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (let e of this.loaded.values()) this.unloadChunk(e);
      (this.loaded.clear(), this.geometry.dispose(), this.material.dispose());
    }
  }
  loadChunk(e, n) {
    let i = ti(e, n),
      r = pP(e, n),
      a = r[0],
      s = (a?.source === "settlement" ? Or(a.sourceId) : null)?.tier ?? "road",
      l = null;
    if (r.length > 0) {
      ((l = new THREE.InstancedMesh(this.geometry, this.material, r.length)),
        (l.name = `ambient-citizens:${i}`),
        l.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        (l.frustumCulled = !0),
        (l.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(e * 96, 18, n * 96),
          96 * 0.9,
        )),
        (l.castShadow = !1),
        (l.receiveShadow = !1),
        (l.userData.shadow = !1));
      let c = new THREE.Color();
      (r.forEach((u, h) => {
        l?.setColorAt(h, c.setHex(u.palette));
      }),
        l.instanceColor && (l.instanceColor.needsUpdate = !0),
        this.scene.add(l));
    }
    this.loaded.set(i, { key: i, recipes: r, mesh: l, activityClass: s });
  }
  unloadChunk(e) {
    e.mesh && (this.scene.remove(e.mesh), e.mesh.dispose());
  }
  updateVisibleCounts() {
    for (let e of this.loaded.values())
      e.mesh &&
        (e.mesh.count = PM(
          e.recipes.length,
          this.quality,
          this.worldMinutes,
          e.activityClass,
        ));
  }
  updateMatrices(e) {
    let n = new THREE.Matrix4(),
      i = new THREE.Quaternion(),
      r = new THREE.Vector3(),
      a = new THREE.Vector3(),
      o = new THREE.Vector3(0, 1, 0);
    for (let s of this.loaded.values()) {
      let l = s.mesh;
      if (!l) continue;
      let c = PM(
        s.recipes.length,
        this.quality,
        this.worldMinutes,
        s.activityClass,
      );
      l.count = c;
      for (let u = 0; u < c; u += 1) {
        let h = s.recipes[u],
          d = mP(h, e);
        (r.set(d.x, d.y, d.z),
          i.setFromAxisAngle(o, d.yaw),
          a.set(h.width, h.height / P6, h.depth),
          n.compose(r, i, a),
          l.setMatrixAt(u, n));
      }
      l.instanceMatrix.needsUpdate = !0;
    }
  }
};
function gP(t, e) {
  return e
    ? { alertRadius: 28, fleeRadius: 18, safeRadius: 38, fleeSpeed: 7.4 }
    : t === "small" || t === "reptile"
      ? { alertRadius: 16, fleeRadius: 9, safeRadius: 24, fleeSpeed: 5.2 }
      : { alertRadius: 22, fleeRadius: 13, safeRadius: 31, fleeSpeed: 4.6 };
}
function jy(t) {
  return {
    mode: "calm",
    offsetX: 0,
    offsetZ: 0,
    yaw: t.heading,
    modeSeconds: 0,
  };
}
function vP(t, e, n, i, r) {
  let a = Number.isFinite(r) ? Math.min(0.1, Math.max(0, r)) : 0,
    o = Number.isFinite(t.offsetX) ? t.offsetX : 0,
    s = Number.isFinite(t.offsetZ) ? t.offsetZ : 0,
    l = Number.isFinite(t.yaw) ? t.yaw : e.yaw,
    c = Number.isFinite(t.modeSeconds) ? Math.max(0, t.modeSeconds) : 0;
  if (a === 0)
    return { mode: t.mode, offsetX: o, offsetZ: s, yaw: l, modeSeconds: c };
  let u = Number.isFinite(n.x) ? n.x : e.x + 1e6,
    h = Number.isFinite(n.z) ? n.z : e.z + 1e6,
    d = e.x + o,
    p = e.z + s,
    f = d - u,
    S = p - h,
    v = Math.hypot(f, S),
    m = v > 0.001 ? f / v : Math.sin(e.yaw),
    y = v > 0.001 ? S / v : Math.cos(e.yaw),
    x = t.mode;
  v <= i.fleeRadius || (x === "flee" && v < i.safeRadius && t.modeSeconds < 4)
    ? (x = "flee")
    : x === "flee"
      ? (x = "return")
      : v <= i.alertRadius
        ? (x = "alert")
        : Math.hypot(t.offsetX, t.offsetZ) > 0.08
          ? (x = "return")
          : (x = "calm");
  let g = o,
    E = s,
    M = e.yaw;
  if (x === "alert") M = Math.atan2(-m, -y);
  else if (x === "flee") {
    ((g += m * i.fleeSpeed * a), (E += y * i.fleeSpeed * a));
    let _ = Math.hypot(g, E),
      b = i.safeRadius * 0.72;
    (_ > b && ((g = (g / _) * b), (E = (E / _) * b)), (M = Math.atan2(m, y)));
  } else if (x === "return") {
    let _ = Math.hypot(g, E),
      b = Math.min(_, i.fleeSpeed * 0.48 * a);
    _ > 0.001 &&
      ((g -= (g / _) * b), (E -= (E / _) * b), (M = Math.atan2(-g, -E)));
  } else Math.hypot(g, E) <= 0.08 && ((g = 0), (E = 0));
  return {
    mode: x,
    offsetX: g,
    offsetZ: E,
    yaw: M,
    modeSeconds: x === t.mode ? c + a : 0,
  };
}
function Qy(t, e) {
  let n = Number.isFinite(e.offsetX) ? e.offsetX : 0,
    i = Number.isFinite(e.offsetZ) ? e.offsetZ : 0,
    r = Number.isFinite(e.yaw) ? e.yaw : t.yaw;
  return { x: t.x + n, y: t.y, z: t.z + i, yaw: e.mode === "calm" ? t.yaw : r };
}
var O6 = 0.18,
  z6 = 0.22,
  U6 = 7,
  Jy = { sampleHeight: je };
function OM(t, e, n, i) {
  let r = t.sampleHeight(e, n);
  return Number.isFinite(r) ? r : i;
}
function $y(t, e, n) {
  let i = Math.max(0, n) * 0.82,
    r = i * Math.SQRT1_2;
  return [
    [0, 0],
    [i, 0],
    [-i, 0],
    [0, i],
    [0, -i],
    [r, r],
    [r, -r],
    [-r, r],
    [-r, -r],
  ].every(([o, s]) => {
    let l = e.x + o,
      c = e.z + s,
      u = t.sampleHeight(l, c);
    return Number.isFinite(u) ? (ta(l, c) > 0 ? !Td(l, c) : u > ci + O6) : !1;
  });
}
function LM(t, e, n) {
  return { x: t.x + (e.x - t.x) * n, z: t.z + (e.z - t.z) * n };
}
function F6(t, e, n, i) {
  let r = Math.hypot(n.x - e.x, n.z - e.z);
  if (r <= 1e-8) return { ...e };
  if (!$y(t, e, i)) return $y(t, n, i) ? { ...n } : { ...e };
  let o = Math.max(1, Math.ceil(r / z6)),
    s = 0;
  for (let l = 1; l <= o; l += 1) {
    let c = l / o,
      u = LM(e, n, c);
    if ($y(t, u, i)) {
      s = c;
      continue;
    }
    let h = s,
      d = c;
    for (let p = 0; p < U6; p += 1) {
      let f = (h + d) * 0.5;
      $y(t, LM(e, n, f), i) ? (h = f) : (d = f);
    }
    return LM(e, n, h);
  }
  return { ...n };
}
function H6(t, e, n) {
  let i = Math.cos(n),
    r = Math.sin(n);
  return { x: t * i - e * r, z: t * r + e * i };
}
function yP(t) {
  return Number.isFinite(t.x) && Number.isFinite(t.z);
}
function xP(t, e, n, i, r = Jy) {
  let a = yP(e) ? e : { x: 0, z: 0 },
    o = yP(n) ? n : a,
    s = Number.isFinite(i.radius) ? Math.max(0.08, i.radius) : 0.24,
    l = Number.isFinite(i.height) ? Math.max(0.2, i.height) : 0.8,
    c = o.x - a.x,
    u = o.z - a.z,
    h = Math.hypot(c, u);
  if (h <= 1e-8) return { ...a };
  let d = ur(t) % 2 === 0 ? 1 : -1,
    p = [
      0,
      d * Math.PI * 0.25,
      -d * Math.PI * 0.25,
      d * Math.PI * 0.5,
      -d * Math.PI * 0.5,
    ],
    f = OM(r, a.x, a.z, ci + 1),
    S = { ...a },
    v = Number.NEGATIVE_INFINITY;
  for (let m of p) {
    let y = H6(c, u, m),
      x = { x: a.x + y.x, z: a.z + y.z },
      g = OM(r, x.x, x.z, f),
      E = r.queryColliders?.(a, x, s, Math.min(f, g), Math.max(f, g) + l) ?? [],
      M = vc(a, x, E, s),
      _ = F6(r, a, M, s),
      b = _.x - a.x,
      T = _.z - a.z,
      R = Math.hypot(b, T),
      C = (b * c + T * u) / Math.max(h, 1e-8),
      P = R + Math.max(-h, C) * 0.28;
    if ((P > v + 1e-8 && ((S = _), (v = P)), m === 0 && R >= h * 0.995)) break;
  }
  return S;
}
function bP(t, e = Jy) {
  return { ...t, y: OM(e, t.x, t.z, t.y) };
}
function B6(t, e) {
  let n = t.index ? t.toNonIndexed() : t.clone();
  t.dispose();
  let i = new THREE.Color(e),
    r = new Float32Array(n.getAttribute("position").count * 3);
  for (let a = 0; a < r.length; a += 3)
    ((r[a] = i.r), (r[a + 1] = i.g), (r[a + 2] = i.b));
  return (n.setAttribute("color", new THREE.BufferAttribute(r, 3)), n);
}
function G6(t) {
  let e = [],
    n = (a, o, s, l, c, u = 1, h = 1, d = 1, p = 0) => {
      let f = B6(a, o);
      (f.scale(u, h, d), p && f.rotateZ(p), f.translate(s, l, c), e.push(f));
    },
    i = (a, o, s) =>
      n(new THREE.BoxGeometry(0.11, s, 0.12), t.accentColor, a, s / 2, o);
  switch (t.body) {
    case "grazer":
      (n(
        new THREE.DodecahedronGeometry(0.54, 0),
        t.bodyColor,
        0,
        0.83,
        0,
        1.35,
        0.78,
        0.72,
      ),
        n(
          new THREE.BoxGeometry(0.24, 0.72, 0.24),
          t.bodyColor,
          0,
          1.13,
          -0.47,
          1,
          1,
          0.85,
          -0.2,
        ),
        n(
          new THREE.DodecahedronGeometry(0.3, 0),
          t.accentColor,
          0,
          1.47,
          -0.68,
          1,
          0.78,
          1.2,
        ),
        i(-0.34, -0.27, 0.62),
        i(0.34, -0.27, 0.62),
        i(-0.34, 0.28, 0.62),
        i(0.34, 0.28, 0.62));
      break;
    case "stocky":
      (n(
        new THREE.DodecahedronGeometry(0.58, 0),
        t.bodyColor,
        0,
        0.58,
        0,
        1.35,
        0.78,
        0.82,
      ),
        n(
          new THREE.DodecahedronGeometry(0.34, 0),
          t.accentColor,
          0,
          0.65,
          -0.64,
          1.1,
          0.82,
          1.15,
        ),
        i(-0.34, -0.27, 0.4),
        i(0.34, -0.27, 0.4),
        i(-0.34, 0.27, 0.4),
        i(0.34, 0.27, 0.4));
      break;
    case "small":
      (n(
        new THREE.DodecahedronGeometry(0.35, 0),
        t.bodyColor,
        0,
        0.32,
        0,
        1.25,
        0.76,
        0.78,
      ),
        n(
          new THREE.DodecahedronGeometry(0.24, 0),
          t.accentColor,
          0,
          0.5,
          -0.38,
          0.9,
          0.9,
          1.05,
        ),
        n(
          new THREE.ConeGeometry(0.08, 0.34, 5),
          t.accentColor,
          -0.1,
          0.83,
          -0.35,
          1,
          1,
          0.7,
        ),
        n(
          new THREE.ConeGeometry(0.08, 0.34, 5),
          t.accentColor,
          0.1,
          0.83,
          -0.35,
          1,
          1,
          0.7,
        ));
      break;
    case "reptile":
      (n(
        new THREE.DodecahedronGeometry(0.34, 0),
        t.bodyColor,
        0,
        0.18,
        0,
        1.45,
        0.4,
        0.72,
      ),
        n(
          new THREE.DodecahedronGeometry(0.2, 0),
          t.accentColor,
          0,
          0.2,
          -0.42,
          1,
          0.65,
          1.1,
        ),
        n(
          new THREE.ConeGeometry(0.17, 0.88, 6),
          t.bodyColor,
          0,
          0.17,
          0.66,
          0.72,
          1,
          0.72,
          Math.PI / 2,
        ));
      break;
    case "bird":
      (n(
        new THREE.DodecahedronGeometry(0.3, 0),
        t.bodyColor,
        0,
        0.18,
        0,
        1.1,
        0.72,
        1.25,
      ),
        n(
          new THREE.BoxGeometry(0.92, 0.07, 0.34),
          t.accentColor,
          -0.42,
          0.22,
          0.02,
          1,
          1,
          1,
          0.1,
        ),
        n(
          new THREE.BoxGeometry(0.92, 0.07, 0.34),
          t.accentColor,
          0.42,
          0.22,
          0.02,
          1,
          1,
          1,
          -0.1,
        ),
        n(
          new THREE.DodecahedronGeometry(0.18, 0),
          t.bodyColor,
          0,
          0.35,
          -0.32,
          0.85,
          0.85,
          1,
        ));
      break;
  }
  let r = mergeGeometries(e, !1);
  for (let a of e) a.dispose();
  if (!r) throw new Error("Animal geometry could not be assembled");
  return (r.computeVertexNormals(), r.computeBoundingSphere(), r);
}
function V6(t, e) {
  let n = Number.isFinite(e) ? Math.max(0.1, e) : t.scale;
  switch (t.body) {
    case "grazer":
      return { radius: 0.58 * n, height: 1.72 * n };
    case "stocky":
      return { radius: 0.56 * n, height: 1.08 * n };
    case "reptile":
      return { radius: 0.34 * n, height: 0.48 * n };
    case "small":
      return { radius: 0.32 * n, height: 0.9 * n };
    case "bird":
      return { radius: 0.34 * n, height: 0.7 * n };
  }
}
var AnimalPopulation = class {
  constructor(e, n, i = Jy) {
    this.scene = e;
    this.quality = n;
    this.groundNavigation = i;
    this.material = new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: 0.96,
      metalness: 0,
      flatShading: !0,
      vertexColors: !0,
    });
    this.geometries = new Map();
    this.meshes = new Map();
    this.loaded = new Map();
    this.visibleRecipes = new Map();
    this.activeChunkKey = "";
    this.elapsedSeconds = 0;
    this.playerX = 0;
    this.playerZ = 0;
    this.reactions = new Map();
    this.presentedPoses = new Map();
    this.disposed = !1;
    let r = Math.max(...QUALITY_ORDER.map((a) => Q_[a]));
    for (let a of Object.values(so)) {
      let o = G6(a),
        s = new THREE.InstancedMesh(o, this.material, r);
      ((s.name = `ambient-animals:${a.id}`),
        (s.count = 0),
        s.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
        (s.frustumCulled = !0),
        (s.castShadow = !1),
        (s.receiveShadow = !1),
        (s.userData.shadow = !1),
        (s.userData.nonInteractive = !0),
        (s.userData.speciesId = a.id),
        this.geometries.set(a.id, o),
        this.meshes.set(a.id, s),
        this.scene.add(s));
    }
  }
  update(e, n, i, r) {
    ((this.playerX = e), (this.playerZ = n), this.updateStreaming(e, n));
    let a = Number.isFinite(i) ? Math.max(0, i) : 0;
    r || ((this.elapsedSeconds += a), this.updateReactions(a));
  }
  present(e = 0) {
    let n = Number.isFinite(e) ? Math.min(0.1, Math.max(0, e)) : 0,
      i = this.elapsedSeconds + n,
      r = new THREE.Matrix4(),
      a = new THREE.Quaternion(),
      o = new THREE.Vector3(),
      s = new THREE.Vector3(),
      l = new THREE.Vector3(0, 1, 0);
    for (let [c, u] of this.meshes) {
      let h = this.visibleRecipes.get(c) ?? [];
      ((u.count = h.length),
        h.forEach((d, p) => {
          let f = wy(d, i),
            S = this.reactions.get(d.id) ?? jy(d),
            v = Qy(f, S),
            m = so[d.speciesId].flying ? v : bP(v, this.groundNavigation);
          (this.presentedPoses.set(d.id, m),
            o.set(m.x, m.y, m.z),
            a.setFromAxisAngle(l, m.yaw),
            s.setScalar(d.scale),
            r.compose(o, a, s),
            u.setMatrixAt(p, r));
        }),
        h.length > 0 && (u.instanceMatrix.needsUpdate = !0),
        u.computeBoundingSphere());
    }
  }
  updateStreaming(e, n) {
    if (this.disposed) return !1;
    let i = qn(e, n),
      r = ti(i.x, i.z);
    if (r === this.activeChunkKey && this.loaded.size > 0) return !1;
    this.activeChunkKey = r;
    let a = new Set();
    for (let o of Dd(i, 2)) {
      let s = ti(o.x, o.z);
      (a.add(s), this.loaded.has(s) || this.loaded.set(s, jN(o.x, o.z)));
    }
    for (let o of this.loaded.keys()) a.has(o) || this.loaded.delete(o);
    return (this.rebuildVisibleRecipes(), this.present(), !0);
  }
  setQuality(e) {
    e !== this.quality &&
      ((this.quality = e), this.rebuildVisibleRecipes(), this.present());
  }
  get visibleCount() {
    let e = 0;
    for (let n of this.visibleRecipes.values()) e += n.length;
    return e;
  }
  get generatedCount() {
    let e = 0;
    for (let n of this.loaded.values()) e += n.length;
    return e;
  }
  get loadedCount() {
    return this.loaded.size;
  }
  get visibleSpeciesCount() {
    return [...this.visibleRecipes.values()].filter((e) => e.length > 0).length;
  }
  scanCandidates() {
    let e = [];
    for (let [n, i] of this.visibleRecipes) {
      let r = so[n];
      for (let a of i) {
        let o = this.presentedPoses.get(a.id) ?? wy(a, this.elapsedSeconds);
        e.push({
          id: a.id,
          entryId: `guide:animal:${n}:v1`,
          name: r.label,
          position: { x: o.x, y: o.y + r.scale, z: o.z },
          maxDistance: 45,
        });
      }
    }
    return e;
  }
  debugSnapshot(e = 96) {
    let n = {};
    for (let [a, o] of this.visibleRecipes) o.length > 0 && (n[a] = o.length);
    let i = [...this.visibleRecipes.values()]
        .flatMap((a) => a.map((o) => o.id))
        .sort()
        .slice(0, Math.max(0, e)),
      r = {};
    for (let a of this.reactions.values()) r[a.mode] = (r[a.mode] ?? 0) + 1;
    return {
      visible: this.visibleCount,
      generated: this.generatedCount,
      species: this.visibleSpeciesCount,
      chunks: this.loadedCount,
      updateHz: 60,
      ids: i,
      bySpecies: n,
      reactions: r,
    };
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (let e of this.meshes.values()) (this.scene.remove(e), e.dispose());
      this.meshes.clear();
      for (let e of this.geometries.values()) e.dispose();
      (this.geometries.clear(),
        this.material.dispose(),
        this.loaded.clear(),
        this.visibleRecipes.clear(),
        this.reactions.clear(),
        this.presentedPoses.clear());
    }
  }
  rebuildVisibleRecipes() {
    this.visibleRecipes.clear();
    let e = [...this.loaded.values()]
        .flat()
        .sort((r, a) => r.id.localeCompare(a.id)),
      n = e.slice(0, QN(e.length, this.quality));
    for (let r of n) {
      let a = this.visibleRecipes.get(r.speciesId) ?? [];
      (a.push(r),
        this.visibleRecipes.set(r.speciesId, a),
        this.reactions.has(r.id) || this.reactions.set(r.id, jy(r)));
    }
    let i = new Set(n.map((r) => r.id));
    for (let r of this.reactions.keys()) i.has(r) || this.reactions.delete(r);
    for (let r of this.presentedPoses.keys())
      i.has(r) || this.presentedPoses.delete(r);
  }
  updateReactions(e) {
    for (let [n, i] of this.visibleRecipes) {
      let r = so[n],
        a = gP(r.body, r.flying);
      for (let o of i) {
        let s = this.reactions.get(o.id) ?? jy(o),
          l = wy(o, this.elapsedSeconds),
          c = vP(s, l, { x: this.playerX, z: this.playerZ }, a, e);
        if (r.flying) {
          this.reactions.set(o.id, c);
          continue;
        }
        let u = Qy(l, s),
          h = Qy(l, c),
          d = xP(o.id, u, h, V6(r, o.scale), this.groundNavigation);
        this.reactions.set(o.id, {
          ...c,
          offsetX: d.x - l.x,
          offsetZ: d.z - l.z,
        });
      }
    }
  }
};
var SP = {
  collect: {
    startFrequency: 520,
    endFrequency: 760,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  harvest: {
    startFrequency: 135,
    endFrequency: 92,
    duration: 0.17,
    gain: 0.075,
    waveform: "triangle",
  },
  "door-open": {
    startFrequency: 180,
    endFrequency: 230,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  "door-close": {
    startFrequency: 210,
    endFrequency: 120,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  scan: {
    startFrequency: 410,
    endFrequency: 920,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  inspect: {
    startFrequency: 360,
    endFrequency: 470,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  discover: {
    startFrequency: 330,
    endFrequency: 660,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  damage: {
    startFrequency: 95,
    endFrequency: 58,
    duration: 0.17,
    gain: 0.13,
    waveform: "triangle",
  },
  recover: {
    startFrequency: 260,
    endFrequency: 520,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
  save: {
    startFrequency: 620,
    endFrequency: 780,
    duration: 0.17,
    gain: 0.075,
    waveform: "sine",
  },
};
function Hf(t) {
  return Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
}
function EP(t) {
  if (t.paused)
    return { wind: 0, weather: 0, wildlife: 0, settlement: 0, lowpassHz: 1e3 };
  let e = Hf(t.windKph / 72),
    n = t.precipitation === "none" ? 0 : Hf(t.precipitationRate),
    i = t.biomeId === "pine_forest" || t.biomeId === "riverlands";
  return {
    wind: 0.12 + e * 0.62,
    weather: n * 0.78,
    wildlife: Hf(t.animalActivity) * (i ? 0.72 : 0.42) * (1 - n * 0.75),
    settlement: Hf(t.settlementInfluence) * (0.35 + (1 - Hf(t.night)) * 0.65),
    lowpassHz: 900 + (1 - n) * 2400 + e * 1e3,
  };
}
function _P(t, e) {
  return e
    ? "interior"
    : t === "crown_highlands" || t === "glass_badlands"
      ? "stone"
      : t === "salt_coast"
        ? "sand"
        : t === "riverlands"
          ? "soil"
          : "grass";
}
function MP(t, e) {
  return e ? 1.45 : t ? 0.82 : 1.12;
}
function wP() {
  if (typeof window > "u") return null;
  let t = window;
  return window.AudioContext ?? t.webkitAudioContext ?? null;
}
function es(t) {
  return Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
}
var aa = (t, e) => (Number.isFinite(t) ? t : e);
function zM(t, e, n) {
  return t.some((i) => !i)
    ? !1
    : (t.forEach((i, r) => {
        i.setValueAtTime(e[r], n);
      }),
      !0);
}
function W6(t, e, n) {
  let i = t,
    r = [aa(e.position.x, 0), aa(e.position.y, 0), aa(e.position.z, 0)],
    a = [aa(e.forward.x, 0), aa(e.forward.y, 0), aa(e.forward.z, -1)],
    o = [aa(e.up.x, 0), aa(e.up.y, 1), aa(e.up.z, 0)];
  (zM([i.positionX, i.positionY, i.positionZ], r, n) || i.setPosition?.(...r),
    zM(
      [i.forwardX, i.forwardY, i.forwardZ, i.upX, i.upY, i.upZ],
      [...a, ...o],
      n,
    ) || i.setOrientation?.(...a, ...o));
}
function X6(t, e, n) {
  let i = t,
    r = [aa(e.x, 0), aa(e.y, 0), aa(e.z, 0)];
  zM([i.positionX, i.positionY, i.positionZ], r, n) || i.setPosition?.(...r);
}
var FieldAudio = class {
  constructor(e, n = !1) {
    this.disabled = n;
    this.context = null;
    this.master = null;
    this.ambient = null;
    this.effects = null;
    this.windGain = null;
    this.weatherGain = null;
    this.wildlifeGain = null;
    this.settlementGain = null;
    this.windFilter = null;
    this.weatherFilter = null;
    this.wildlifeFilter = null;
    this.settlementFilter = null;
    this.noiseBuffer = null;
    this.unlocked = !1;
    this.disposed = !1;
    this.cueCount = 0;
    this.spatialCueCount = 0;
    this.listenerUpdates = 0;
    this.lastCue = null;
    this.levels = { ...e };
  }
  async unlock() {
    if (
      this.disabled ||
      this.disposed ||
      (this.context || this.createGraph(), !this.context)
    )
      return !1;
    try {
      (await this.context.resume(),
        (this.unlocked = this.context.state === "running"));
    } catch {
      this.unlocked = !1;
    }
    return this.unlocked;
  }
  setLevels(e) {
    if (
      ((this.levels = { ...e }),
      !this.context || !this.master || !this.ambient || !this.effects)
    )
      return;
    let n = this.context.currentTime;
    (this.master.gain.setTargetAtTime(es(e.master), n, 0.04),
      this.ambient.gain.setTargetAtTime(es(e.ambient), n, 0.08),
      this.effects.gain.setTargetAtTime(es(e.effects), n, 0.04));
  }
  setListenerPose(e) {
    !this.context ||
      !this.unlocked ||
      (W6(this.context.listener, e, this.context.currentTime),
      (this.listenerUpdates += 1));
  }
  updateMix(e) {
    if (
      !this.context ||
      !this.windGain ||
      !this.weatherGain ||
      !this.wildlifeGain ||
      !this.settlementGain ||
      !this.windFilter
    )
      return;
    let n = this.context.currentTime;
    (this.windGain.gain.setTargetAtTime(es(e.wind) * 0.18, n, 0.45),
      this.weatherGain.gain.setTargetAtTime(es(e.weather) * 0.24, n, 0.35),
      this.wildlifeGain.gain.setTargetAtTime(es(e.wildlife) * 0.022, n, 0.9),
      this.settlementGain.gain.setTargetAtTime(
        es(e.settlement) * 0.036,
        n,
        0.75,
      ),
      this.windFilter.frequency.setTargetAtTime(
        Math.min(6e3, Math.max(200, e.lowpassHz)),
        n,
        0.35,
      ));
  }
  silenceAmbient() {
    if (!this.context) return;
    let e = this.context.currentTime;
    for (let n of [
      this.windGain,
      this.weatherGain,
      this.wildlifeGain,
      this.settlementGain,
    ])
      n && (n.gain.cancelScheduledValues(e), n.gain.setValueAtTime(0, e));
  }
  playFootstep(e, n = 1, i) {
    if (!this.context || !this.effects || !this.noiseBuffer || !this.unlocked)
      return;
    let r = this.context.createBufferSource(),
      a = this.context.createBiquadFilter(),
      o = this.context.createGain(),
      s = {
        grass: { frequency: 780, volume: 0.055 },
        soil: { frequency: 520, volume: 0.06 },
        sand: { frequency: 1050, volume: 0.045 },
        stone: { frequency: 1650, volume: 0.07 },
        interior: { frequency: 1250, volume: 0.062 },
      }[e];
    ((r.buffer = this.noiseBuffer),
      (a.type = "bandpass"),
      (a.frequency.value = s.frequency),
      (a.Q.value = 0.8));
    let l = this.context.currentTime;
    (o.gain.setValueAtTime(s.volume * es(n), l),
      o.gain.exponentialRampToValueAtTime(1e-4, l + 0.105),
      r.connect(a).connect(o),
      this.connectEffect(o, i),
      r.start(l, 0, 0.11),
      r.stop(l + 0.12),
      (this.cueCount += 1),
      (this.lastCue = "footstep"));
  }
  playCue(e, n) {
    if (!this.context || !this.effects || !this.unlocked) return;
    let i = SP[e],
      r = this.context.createOscillator(),
      a = this.context.createGain(),
      o = this.context.currentTime;
    ((r.type = i.waveform),
      r.frequency.setValueAtTime(i.startFrequency, o),
      r.frequency.exponentialRampToValueAtTime(
        i.endFrequency,
        o + i.duration * 0.7,
      ),
      a.gain.setValueAtTime(i.gain, o),
      a.gain.exponentialRampToValueAtTime(1e-4, o + i.duration * 0.94),
      r.connect(a),
      this.connectEffect(a, n),
      r.start(o),
      r.stop(o + i.duration),
      (this.cueCount += 1),
      (this.lastCue = e));
  }
  get diagnostics() {
    return {
      available: !this.disabled && wP() !== null,
      unlocked: this.unlocked,
      state: this.context?.state ?? "uninitialized",
      cueCount: this.cueCount,
      spatialCueCount: this.spatialCueCount,
      listenerUpdates: this.listenerUpdates,
      lastCue: this.lastCue,
    };
  }
  dispose() {
    if (this.disposed) return;
    ((this.disposed = !0), (this.unlocked = !1));
    let e = this.context;
    ((this.context = null),
      (this.master = null),
      (this.ambient = null),
      (this.effects = null),
      (this.windGain = null),
      (this.weatherGain = null),
      (this.wildlifeGain = null),
      (this.settlementGain = null),
      (this.windFilter = null),
      (this.weatherFilter = null),
      (this.wildlifeFilter = null),
      (this.settlementFilter = null),
      (this.noiseBuffer = null),
      e?.close().catch(() => {}));
  }
  createGraph() {
    let e = wP();
    if (!e) return;
    let n = new e(),
      i = n.createGain(),
      r = n.createGain(),
      a = n.createGain(),
      o = n.createGain(),
      s = n.createGain(),
      l = n.createGain(),
      c = n.createGain(),
      u = n.createBiquadFilter(),
      h = n.createBiquadFilter(),
      d = n.createBiquadFilter(),
      p = n.createBiquadFilter(),
      f = n.createBuffer(1, n.sampleRate * 3, n.sampleRate),
      S = f.getChannelData(0),
      v = 0;
    for (let y = 0; y < S.length; y += 1) {
      let x = Math.random() * 2 - 1;
      ((v = v * 0.965 + x * 0.035), (S[y] = v));
    }
    let m = (y, x) => {
      let g = n.createBufferSource();
      ((g.buffer = f),
        (g.loop = !0),
        g.connect(y).connect(x).connect(r),
        g.start(n.currentTime, Math.random() * f.duration));
    };
    ((u.type = "lowpass"),
      (u.frequency.value = 1800),
      (h.type = "highpass"),
      (h.frequency.value = 1200),
      (d.type = "bandpass"),
      (d.frequency.value = 2e3),
      (d.Q.value = 0.75),
      (p.type = "bandpass"),
      (p.frequency.value = 280),
      (p.Q.value = 0.5),
      (o.gain.value = 0),
      (s.gain.value = 0),
      (l.gain.value = 0),
      (c.gain.value = 0),
      r.connect(i),
      a.connect(i),
      i.connect(n.destination),
      m(u, o),
      m(h, s),
      m(d, l),
      m(p, c),
      (this.context = n),
      (this.master = i),
      (this.ambient = r),
      (this.effects = a),
      (this.windGain = o),
      (this.weatherGain = s),
      (this.wildlifeGain = l),
      (this.settlementGain = c),
      (this.windFilter = u),
      (this.weatherFilter = h),
      (this.wildlifeFilter = d),
      (this.settlementFilter = p),
      (this.noiseBuffer = f),
      this.setLevels(this.levels));
  }
  connectEffect(e, n) {
    if (!this.context || !this.effects) return;
    if (!n) {
      e.connect(this.effects);
      return;
    }
    let i = this.context.createPanner();
    ((i.panningModel = "HRTF"),
      (i.distanceModel = "inverse"),
      (i.refDistance = Math.max(
        0.25,
        Number.isFinite(n.referenceDistance) ? n.referenceDistance : 2.5,
      )),
      (i.maxDistance = Math.max(
        i.refDistance,
        Number.isFinite(n.maxDistance) ? n.maxDistance : 48,
      )),
      (i.rolloffFactor = 1));
    let r = this.context.currentTime;
    X6(i, n.position, r);
    let a = this.context.createGain();
    ((a.gain.value = es(n.gain ?? 1)),
      e.connect(a).connect(i).connect(this.effects),
      (this.spatialCueCount += 1));
  }
};
var UM = 48,
  TP = 190,
  RP = 22,
  PhoneFlashlight = class {
    constructor(e, n) {
      this.scene = e;
      this.root = new THREE.Group();
      this.coreTarget = new THREE.Object3D();
      this.spillTarget = new THREE.Object3D();
      this.core = new THREE.SpotLight(
        16773590,
        TP,
        UM,
        THREE.MathUtils.degToRad(17),
        0.42,
        1.45,
      );
      this.spill = new THREE.SpotLight(
        14543359,
        RP,
        11,
        THREE.MathUtils.degToRad(34),
        0.86,
        2,
      );
      this.cameraWorldPosition = new THREE.Vector3();
      this.cameraWorldQuaternion = new THREE.Quaternion();
      this.enabled = !1;
      this.disposed = !1;
      ((this.quality = n),
        (this.root.name = "player-phone-light"),
        (this.root.visible = !1),
        this.root.position.set(0, 0, 0),
        (this.core.name = "player-phone-light:core"),
        this.core.position.set(0.1, -0.09, -0.08),
        (this.coreTarget.name = "player-phone-light:core-target"),
        this.coreTarget.position.set(0, -0.025, -12),
        (this.core.target = this.coreTarget),
        (this.core.shadow.camera.near = 0.12),
        (this.core.shadow.camera.far = UM),
        (this.core.shadow.radius = 2),
        (this.spill.name = "player-phone-light:spill"),
        this.spill.position.set(0.1, -0.09, -0.06),
        (this.spillTarget.name = "player-phone-light:spill-target"),
        this.spillTarget.position.set(0, -0.06, -10),
        (this.spill.target = this.spillTarget),
        (this.spill.castShadow = !1),
        this.root.add(this.core, this.coreTarget, this.spill, this.spillTarget),
        this.scene.add(this.root),
        this.setQuality(n));
    }
    setEnabled(e) {
      if (this.disposed) return !1;
      let n = !!e;
      return n === this.enabled
        ? !1
        : ((this.enabled = n), this.applyRuntimeState(), !0);
    }
    toggle() {
      return (this.setEnabled(!this.enabled), this.enabled);
    }
    setQuality(e) {
      if (this.disposed) return;
      this.quality = e;
      let n = QUALITY_PROFILES[e];
      (this.core.shadow.mapSize.setScalar(
        kitShadowSize(n.flashlightShadowMapSize),
      ),
        (this.core.shadow.bias = e === "ultra" ? -1e-4 : -18e-5),
        (this.core.shadow.normalBias = e === "ultra" ? 0.025 : 0.035),
        this.applyRuntimeState());
    }
    present(e) {
      this.disposed ||
        (e.getWorldPosition(this.cameraWorldPosition),
        e.getWorldQuaternion(this.cameraWorldQuaternion),
        this.root.position.copy(this.cameraWorldPosition),
        this.root.quaternion.copy(this.cameraWorldQuaternion),
        this.root.updateMatrixWorld(!0));
    }
    prepareForCompile() {
      this.disposed ||
        ((this.root.visible = !0),
        (this.core.castShadow = qualityHasShadows(this.quality)),
        (this.core.intensity = 0),
        (this.spill.intensity = 0));
    }
    finishCompile() {
      this.disposed ||
        ((this.core.intensity = TP),
        (this.spill.intensity = RP),
        this.applyRuntimeState());
    }
    get isEnabled() {
      return this.enabled;
    }
    get diagnostics() {
      return {
        enabled: this.enabled,
        beams: 2,
        rangeMeters: UM,
        shadowsEnabled: this.core.castShadow,
        shadowMapSize: this.core.shadow.mapSize.width,
        quality: this.quality,
      };
    }
    dispose() {
      this.disposed ||
        ((this.disposed = !0),
        (this.enabled = !1),
        this.scene.remove(this.root),
        this.root.clear(),
        this.core.dispose(),
        this.spill.dispose());
    }
    applyRuntimeState() {
      ((this.root.visible = this.enabled),
        (this.core.castShadow =
          this.enabled && qualityHasShadows(this.quality)));
    }
  };
var Y6 = 0.65,
  q6 = 2.25;
function Z6(t) {
  return Number.isFinite(t) ? THREE.MathUtils.smoothstep(t, Y6, q6) : 0;
}
var PlayerAvatar = class {
  constructor(e, n) {
    this.root = new THREE.Group();
    this.castsShadows = !1;
    this.opacity = 0;
    ((this.root.name = "player-avatar"), (this.root.visible = !1));
    let i = new THREE.MeshStandardNodeMaterial({
        color: 3422776,
        roughness: 0.88,
        metalness: 0.04,
        flatShading: !0,
      }),
      r = new THREE.MeshStandardNodeMaterial({
        color: 6775640,
        roughness: 0.96,
        metalness: 0.01,
        flatShading: !0,
      }),
      a = new THREE.MeshStandardNodeMaterial({
        color: 12085047,
        emissive: 4857612,
        emissiveIntensity: 0.48,
        roughness: 0.62,
        metalness: 0.1,
        flatShading: !0,
      });
    this.materials = [i, r, a];
    let o = (s, l, c) => {
      let u = new THREE.Mesh(s, l);
      return (
        u.position.set(...c),
        (u.receiveShadow = !0),
        this.root.add(u),
        u
      );
    };
    (o(new THREE.CapsuleGeometry(0.25, 0.58, 3, 8), i, [0, 1.12, 0]),
      o(new THREE.SphereGeometry(0.2, 10, 6), r, [0, 1.61, 0]),
      o(new THREE.BoxGeometry(0.4, 0.54, 0.18), r, [0, 1.18, 0.24]),
      o(new THREE.BoxGeometry(0.2, 0.12, 0.055), a, [0, 1.31, 0.345]),
      o(new THREE.CylinderGeometry(0.105, 0.12, 0.7, 7), i, [-0.14, 0.4, 0]),
      o(new THREE.CylinderGeometry(0.105, 0.12, 0.7, 7), i, [0.14, 0.4, 0]),
      this.setQuality(n),
      e.add(this.root));
  }
  present(e, n, i, r) {
    let a = Z6(r.distance);
    ((this.opacity = a), (this.root.visible = a > 0.001));
    for (let o of this.materials) {
      let s = a < 0.999;
      (o.transparent !== s && (o.needsUpdate = !0),
        (o.transparent = s),
        (o.opacity = a),
        (o.depthWrite = !s));
    }
    (this.root.traverse((o) => {
      o instanceof THREE.Mesh &&
        (o.castShadow = this.castsShadows && a >= 0.999);
    }),
      this.root.visible &&
        (this.root.position.copy(e),
        this.root.rotation.set(0, n, 0),
        this.root.scale.set(1, THREE.MathUtils.clamp(i / 1.72, 0.72, 1), 1)));
  }
  setQuality(e) {
    ((this.castsShadows = qualityHasShadows(e)),
      this.root.traverse((n) => {
        n instanceof THREE.Mesh &&
          (n.castShadow = this.castsShadows && this.opacity >= 0.999);
      }));
  }
  dispose() {
    (this.root.removeFromParent(),
      this.root.traverse((e) => {
        e instanceof THREE.Mesh && e.geometry.dispose();
      }),
      this.materials.forEach((e) => e.dispose()));
  }
};
var Wf = (t, e) => Math.round(THREE.MathUtils.clamp(t, 0, 1) * e);
function HM(t, e) {
  let i =
      (Math.atan2(t.sunDirection.z, t.sunDirection.x) + Math.PI) /
      (Math.PI * 2),
    r = t.sunDirection.y * 0.5 + 0.5;
  return [
    e,
    Wf(t.daylight, 5),
    Wf(t.goldenHour, 3),
    Wf(t.cloudCover, 3),
    Wf(t.dust, 2),
    Wf(r, 7),
    Math.round(i * 12) % 12,
  ].join(":");
}
// ---------------------------------------------------------------------------
// Rendering on the shared kit: kit.renderer (WebGPU with a WebGL2 fallback)
// and a TSL post chain in place of the old EffectComposer stack.
// ---------------------------------------------------------------------------

// The image-based light the world materials read: a small procedural sky
// (gradient, sun core and glow, cloud and dust tint) captured into a PMREM.
function environmentSourceColor(u) {
  return Fn(() => {
    const direction = normalize(positionLocal);
    const skyAmount = smoothstep(-0.08, 0.48, direction.y);
    const sky = mix(u.horizonColor, u.skyColor, skyAmount);
    const withGround = mix(
      u.groundColor,
      sky,
      smoothstep(-0.28, 0.02, direction.y),
    );
    const sunDot = max(dot(direction, u.sunDirection), 0.0);
    const sunCore = pow(sunDot, 720.0);
    const sunGlow = pow(sunDot, 18.0);
    const lit = withGround.add(
      u.sunColor.mul(sunCore.mul(8.0).add(sunGlow.mul(0.42))).mul(u.daylight),
    );
    const clouded = mix(lit, u.horizonColor, u.cloudCover.mul(0.26));
    const dusty = mix(clouded, vec3(0.48, 0.28, 0.15), u.dust.mul(0.22));
    return max(dusty, vec3(0.0));
  })();
}
var EnvironmentMapGenerator = class {
  constructor(e, n, i) {
    this.renderer = e;
    this.scene = n;
    this.environmentScene = new THREE.Scene();
    this.target = null;
    this.targetSize = 0;
    this.signature = null;
    this.revision = 0;
    this.enabled = !0;
    this.disposed = !1;
    this.quality = i;
    this.generator = new THREE.PMREMGenerator(e);
    this.uniforms = {
      skyColor: uniform(new THREE.Color(5797506)),
      horizonColor: uniform(new THREE.Color(12954240)),
      groundColor: uniform(new THREE.Color(2435108)),
      sunColor: uniform(new THREE.Color(16769202)),
      sunDirection: uniform(new THREE.Vector3(0, 1, 0)),
      cloudCover: uniform(0),
      daylight: uniform(1),
      dust: uniform(0),
    };
    this.material = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: !1,
      depthTest: !1,
      toneMapped: !1,
      fog: !1,
    });
    this.material.name = "StillpointEnvironmentSource";
    this.material.colorNode = environmentSourceColor(this.uniforms);
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      this.material,
    );
    this.sphere.frustumCulled = !1;
    this.environmentScene.add(this.sphere);
    this.applyQuality();
  }
  setQuality(e) {
    (e !== this.quality && ((this.quality = e), (this.signature = null)),
      this.applyQuality());
  }
  setEnabled(e) {
    this.disposed ||
      this.enabled === e ||
      ((this.enabled = e),
      (this.signature = null),
      !e &&
        this.scene.environment === this.target?.texture &&
        (this.scene.environment = null),
      this.applyQuality());
  }
  present(e) {
    if (this.disposed || !this.enabled) return;
    let n = HM(e, this.quality);
    if (n === this.signature) return;
    this.signature = n;
    let i = this.uniforms;
    (i.skyColor.value.copy(e.skyColor),
      i.horizonColor.value.copy(e.horizonColor),
      i.groundColor.value
        .copy(e.horizonColor)
        .multiplyScalar(0.22 + e.daylight * 0.16),
      i.sunColor.value.copy(e.sunColor),
      i.sunDirection.value.copy(e.sunDirection),
      i.sunDirection.value.lengthSq() < 1e-6
        ? i.sunDirection.value.set(0, 1, 0)
        : i.sunDirection.value.normalize(),
      (i.cloudCover.value = e.cloudCover),
      (i.daylight.value = e.daylight),
      (i.dust.value = e.dust));
    let r = QUALITY_PROFILES[this.quality].environmentMap.size;
    try {
      // Re-render into the same target while the size holds, so the scene
      // keeps one environment texture and no material has to rebuild.
      let a = this.target && this.targetSize === r ? this.target : null,
        o = this.generator.fromScene(this.environmentScene, 0.04, 0.1, 20, {
          size: r,
          renderTarget: a,
        });
      if (o !== this.target) {
        let s = this.target;
        ((this.target = o), (this.targetSize = r), s?.dispose());
      }
      (this.scene.environment !== o.texture &&
        (this.scene.environment = o.texture),
        (this.revision += 1));
    } catch (a) {
      // Keep the previous environment; the sky and lights still carry the scene.
      this.signature = null;
    }
  }
  handleContextRestored() {
    this.signature = null;
  }
  get diagnostics() {
    return {
      active:
        !!this.target && this.scene.environment === this.target.texture,
      enabled: this.enabled,
      signature: this.signature,
      revision: this.revision,
      size: QUALITY_PROFILES[this.quality].environmentMap.size,
    };
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.scene.environment === this.target?.texture &&
        (this.scene.environment = null),
      this.target?.dispose(),
      (this.target = null),
      this.sphere.geometry.dispose(),
      this.material.dispose(),
      this.generator.dispose());
  }
  applyQuality() {
    this.scene.environmentIntensity = this.enabled
      ? QUALITY_PROFILES[this.quality].environmentMap.intensity
      : 0;
  }
};

// Selective bloom: lamps, signal cores, city windows and settlement lights
// write 1 into a bloomIntensity target next to the scene colour; only those
// pixels feed the bloom. Everything else writes the pass default (0).
var BLOOM_LAYER = 1;
var BLOOM_MRT = mrt({ bloomIntensity: float(1) });
function markBloomMaterial(e) {
  if (!e) return;
  let n = Array.isArray(e) ? e : [e];
  for (let i of n) i && i.isNodeMaterial && (i.mrtNode = BLOOM_MRT);
}
function markBloom(t) {
  return (
    t.traverse((e) => {
      (e instanceof THREE.Mesh ||
        e instanceof THREE.Points ||
        e instanceof THREE.Line ||
        e instanceof THREE.Sprite) &&
        (e.layers.enable(BLOOM_LAYER), markBloomMaterial(e.material));
    }),
    t
  );
}

// The old FieldGradeShader, as TSL on the linear HDR scene colour.
function fieldGrade(input, g) {
  return Fn(() => {
    const source = vec4(input);
    const weights = vec3(0.2126, 0.7152, 0.0722);
    const color = source.rgb.toVar();
    const luminance = dot(color, weights);
    const frontierGrade = mix(vec3(luminance), color, 0.93).mul(
      vec3(1.018, 1.004, 0.978),
    );
    color.assign(mix(color, frontierGrade, g.strength));
    // Keep the authored palette intact while giving broad weather and time
    // states a restrained, readable presentation signature.
    const adaptive = clamp(g.strength.mul(4.0), 0.0, 1.0);
    const balance = mix(vec3(0.945, 0.982, 1.055), vec3(1.0), g.daylight).toVar();
    balance.assign(
      mix(balance, vec3(1.085, 1.008, 0.885), g.goldenHour.mul(0.78)),
    );
    balance.assign(mix(balance, vec3(1.07, 0.985, 0.86), g.dust.mul(0.58)));
    color.mulAssign(mix(vec3(1.0), balance, adaptive.mul(0.62)));
    const desaturation = clamp(
      g.cloudCover
        .mul(0.045)
        .add(g.precipitation.mul(0.105))
        .add(g.night.mul(0.035)),
      0.0,
      0.16,
    );
    const luminance2 = dot(color, weights);
    color.assign(mix(color, vec3(luminance2), desaturation.mul(adaptive)));
    color.addAssign(vec3(0.12, 0.18, 0.3).mul(g.lightningFlash));
    const centered = screenUV.mul(2.0).sub(1.0);
    const vignette = smoothstep(0.28, 1.42, dot(centered, centered));
    color.mulAssign(float(1.0).sub(vignette.mul(g.vignette)));
    const noise = fract(
      float(52.9829189).mul(
        fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715))),
      ),
    ).sub(0.5);
    color.addAssign(noise.mul(g.dither.div(255.0)));
    return vec4(max(color, vec3(0.0)), source.a);
  })();
}

var FrontierRenderPipeline = class {
  constructor(e) {
    this.options = e;
    this.kit = e.kit;
    this.renderer = e.kit.renderer;
    this.drawingBufferSize = new THREE.Vector2();
    this.features = {
      atmosphericGrade: !0,
      selectiveBloom: !0,
      ambientOcclusion: !0,
      environmentReflections: !0,
    };
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.frameToken = 0;
    this.lastCpuRenderMilliseconds = 0;
    this.postProcessingFallback = !1;
    this.postProcessingFailureCount = 0;
    this.disposed = !1;
    this.pipeline = null;
    this.pipelineKey = "";
    this.pipelineState = { bloom: !1, gtao: !1, grading: !1, fxaa: !1 };
    this.grade = {
      strength: uniform(0.2),
      vignette: uniform(0.075),
      dither: uniform(0.42),
      daylight: uniform(1),
      goldenHour: uniform(0),
      night: uniform(0),
      cloudCover: uniform(0),
      precipitation: uniform(0),
      dust: uniform(0),
      lightningFlash: uniform(0),
    };
    this.bloomSettings = {
      strength: uniform(0),
      radius: uniform(0),
      threshold: uniform(1),
    };
    this.quality = e.quality;
    let n = this.renderer;
    ((n.outputColorSpace = THREE.SRGBColorSpace),
      (n.toneMapping = THREE.ACESFilmicToneMapping),
      (n.toneMappingExposure = 1.12),
      (n.shadowMap.type = THREE.PCFShadowMap),
      (n.info.autoReset = !1),
      (this.environmentMap = new EnvironmentMapGenerator(
        n,
        e.scene,
        e.quality,
      )),
      // FXAA and the bloom resolution follow the kit tier.
      (this.offQuality = this.kit.onQuality(() => {
        this.pipelineKey = "";
      })),
      this.configure(e.quality));
  }
  async compile() {
    try {
      await this.renderer.compileAsync(this.options.scene, this.options.camera);
    } catch {
      // Pipelines still compile on first use.
    }
  }
  render(e = 0, n = !1) {
    if (this.disposed)
      return {
        frameToken: this.frameToken,
        cpuRenderMilliseconds: 0,
        gpuQuerySubmitted: !1,
        gpuSamples: [],
      };
    let a = ++this.frameToken,
      s = performance.now();
    this.renderer.info.reset();
    try {
      if (this.usesPostProcessing())
        try {
          (this.buildPipeline(), this.pipeline.render());
        } catch (l) {
          (console.warn("[stillpoint] post chain failed, drawing direct:", l),
            (this.postProcessingFallback = !0),
            (this.postProcessingFailureCount += 1),
            this.renderer.setRenderTarget(null),
            this.renderer.render(this.options.scene, this.options.camera));
        }
      else this.renderer.render(this.options.scene, this.options.camera);
    } finally {
      this.lastCpuRenderMilliseconds = performance.now() - s;
    }
    return {
      frameToken: a,
      cpuRenderMilliseconds: this.lastCpuRenderMilliseconds,
      gpuQuerySubmitted: !1,
      gpuSamples: [],
    };
  }
  buildPipeline() {
    let e = QUALITY_PROFILES[this.quality].postProcessing,
      n = this.kit.tier,
      i = this.features.selectiveBloom && e.bloomStrength > 0,
      r = this.features.ambientOcclusion && e.gtao,
      a =
        this.features.atmosphericGrade &&
        (e.gradingStrength > 0 ||
          e.vignetteStrength > 0 ||
          e.ditherStrength > 0),
      o = !n.msaa && n.name !== "low",
      s = [i, r, a, o, n.post].join(":");
    if (this.pipeline && s === this.pipelineKey) return;
    (this.disposePipeline(), (this.pipelineKey = s));
    let { scene: l, camera: c } = this.options,
      u = new THREE.RenderPipeline(this.renderer),
      h = pass(l, c);
    i && h.setMRT(mrt({ output, bloomIntensity: float(0) }));
    let d = h.getTextureNode("output"),
      p = d;
    if (r) {
      // Ground contact shading on the ultra profile, blended like the old
      // GTAO pass (70 %). Normals come from the depth buffer.
      let f = gtao(h.getTextureNode("depth"), null, c);
      ((f.resolutionScale = e.gtaoResolutionScale),
        (f.radius.value = 1.2),
        (f.distanceExponent.value = 1.6),
        (f.thickness.value = 0.8),
        (f.distanceFallOff.value = 1),
        (f.scale.value = 1.1),
        (f.samples.value = 12));
      let S = f.getTextureNode().r;
      p = vec4(p.rgb.mul(mix(float(1), S, 0.7)), p.a);
    }
    if (i) {
      let f = h.getTextureNode("bloomIntensity").r,
        S = bloom(
          d.mul(f),
          this.bloomSettings.strength,
          this.bloomSettings.radius,
          this.bloomSettings.threshold,
        );
      (S.setResolutionScale(n.post === "lite" ? 0.35 : 0.5), (p = p.add(S)));
    }
    (a && (p = fieldGrade(p, this.grade)),
      (u.outputColorTransform = !o),
      (u.outputNode = o ? fxaa(renderOutput(p)) : p),
      (this.pipeline = u),
      (this.pipelineState = { bloom: i, gtao: r, grading: a, fxaa: o }));
  }
  disposePipeline() {
    (this.pipeline?.dispose(), (this.pipeline = null), (this.pipelineKey = ""));
  }
  presentEnvironment(e) {
    (this.environmentMap.present(e),
      (this.grade.daylight.value = e.daylight),
      (this.grade.goldenHour.value = e.goldenHour),
      (this.grade.night.value = e.night),
      (this.grade.cloudCover.value = e.cloudCover),
      (this.grade.precipitation.value = e.precipitationRate),
      (this.grade.dust.value = e.dust),
      (this.grade.lightningFlash.value = e.lightningFlash));
  }
  setFeatures(e) {
    this.disposed ||
      !(
        e.atmosphericGrade !== this.features.atmosphericGrade ||
        e.selectiveBloom !== this.features.selectiveBloom ||
        e.ambientOcclusion !== this.features.ambientOcclusion ||
        e.environmentReflections !== this.features.environmentReflections
      ) ||
      ((this.features = {
        atmosphericGrade: e.atmosphericGrade,
        selectiveBloom: e.selectiveBloom,
        ambientOcclusion: e.ambientOcclusion,
        environmentReflections: e.environmentReflections,
      }),
      (this.postProcessingFallback = !1),
      this.environmentMap.setEnabled(e.environmentReflections),
      this.configure(this.quality));
  }
  resize(e, n) {
    this.disposed ||
      ((this.width = Math.max(1, Math.floor(e))),
      (this.height = Math.max(1, Math.floor(n))),
      (this.pixelRatio = this.renderer.getPixelRatio()));
  }
  setQuality(e) {
    this.disposed ||
      ((this.quality = e),
      (this.postProcessingFallback = !1),
      this.environmentMap.setQuality(e),
      this.configure(e));
  }
  handleContextRestored() {
    this.disposed ||
      ((this.postProcessingFallback = !1),
      (this.pipelineKey = ""),
      this.environmentMap.handleContextRestored());
  }
  get diagnostics() {
    let e = this.usesPostProcessing(),
      n = this.renderer.info.render,
      i = this.kit.adapterInfo ?? window.__kit?.adapter ?? null;
    return (
      this.renderer.getDrawingBufferSize(this.drawingBufferSize),
      {
        backend: this.kit.backend,
        webgl2: this.kit.backend !== "webgpu",
        reversedDepth: !!this.renderer.reversedDepthBuffer,
        logarithmicDepth: !!this.renderer.logarithmicDepthBuffer,
        defaultFramebufferSamples: this.renderer.samples ?? 0,
        gpuVendor: i?.vendor ? String(i.vendor).toUpperCase() : "UNKNOWN",
        gpuRenderer: i?.architecture
          ? String(i.architecture).toUpperCase()
          : this.kit.backendLabel.toUpperCase(),
        compositorSamples: this.renderer.samples ?? 0,
        maxSamples: 4,
        quality: this.quality,
        postProcessing: e,
        postProcessingFallback: this.postProcessingFallback,
        postProcessingFailureCount: this.postProcessingFailureCount,
        bloom: e && this.pipelineState.bloom,
        gtao: e && this.pipelineState.gtao,
        grading: e && this.pipelineState.grading,
        drawCalls: n.calls,
        triangles: n.triangles,
        lines: n.lines,
        points: n.points,
        drawingBufferWidth: Math.round(this.drawingBufferSize.x),
        drawingBufferHeight: Math.round(this.drawingBufferSize.y),
        pixelRatio: this.renderer.getPixelRatio(),
        cpuRenderMilliseconds: this.lastCpuRenderMilliseconds,
        gpuRenderMilliseconds: null,
        gpuTimerSupported: !1,
        gpuTimerStatus: "unsupported",
        gpuQueriesPending: 0,
        environmentMap: this.environmentMap.diagnostics,
      }
    );
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.offQuality?.(),
      this.disposePipeline(),
      this.environmentMap.dispose());
  }
  configure(e) {
    let n = QUALITY_PROFILES[e],
      i = n.postProcessing;
    ((this.renderer.shadowMap.enabled = n.shadows),
      (this.bloomSettings.strength.value = i.bloomStrength),
      (this.bloomSettings.radius.value = i.bloomRadius),
      (this.bloomSettings.threshold.value = i.bloomThreshold),
      (this.grade.strength.value = i.gradingStrength),
      (this.grade.vignette.value = i.vignetteStrength),
      (this.grade.dither.value = i.ditherStrength),
      (this.pipelineKey = ""));
  }
  usesPostProcessing() {
    return (
      QUALITY_PROFILES[this.quality].postProcessing.enabled &&
      !this.postProcessingFallback
    );
  }
};
var SystemPipeline = class {
  constructor() {
    this.systems = [];
  }
  register(e) {
    if (this.systems.some((n) => n.id === e.id))
      throw new Error(`System already registered: ${e.id}`);
    return (
      this.systems.push(e),
      this.systems.sort((n, i) => n.order - i.order),
      this
    );
  }
  update(e, n) {
    for (let i of this.systems) i.update(e, n);
  }
  dispose() {
    for (let e of [...this.systems].reverse()) e.dispose?.();
    this.systems = [];
  }
  ids() {
    return this.systems.map((e) => e.id);
  }
};
var FeatureInstaller = class {
  constructor(e) {
    this.pipeline = e;
    this.installed = new Set();
  }
  use(e) {
    if (this.installed.has(e.id))
      throw new Error(`Feature already installed: ${e.id}`);
    return (this.installed.add(e.id), e.install(this), this);
  }
  system(e) {
    return (this.pipeline.register(e), this);
  }
  ids() {
    return [...this.installed];
  }
};
function mx(t) {
  return {
    enabled: !1,
    clockPaused: !1,
    worldMinutes: Ma(t),
    weatherOverride: null,
  };
}
function PP(t, e, n) {
  return e
    ? t.enabled
      ? { ...t }
      : {
          enabled: !0,
          clockPaused: !0,
          worldMinutes: Ma(n),
          weatherOverride: null,
        }
    : mx(n);
}
function LP(t, e) {
  return t.enabled
    ? {
        enabled: !0,
        clockPaused: !0,
        worldMinutes: Ma(e),
        weatherOverride: null,
      }
    : mx(e);
}
function OP(t, e) {
  if (!t.enabled || !Number.isFinite(e)) return { ...t };
  let n = ((Math.floor(e) % lo) + lo) % lo,
    i = Math.floor(t.worldMinutes / lo) * lo;
  return { ...t, worldMinutes: i + n };
}
function WM(t, e) {
  return !t.enabled || !Number.isFinite(e)
    ? { ...t }
    : { ...t, worldMinutes: Ma(t.worldMinutes + e) };
}
function zP(t, e, n) {
  return !t.enabled || t.clockPaused || !n || !Number.isFinite(e) || e <= 0
    ? { ...t }
    : WM(t, e * Pd);
}
function weatherOptionsFor(t) {
  return Sf[t].map(({ id: e, label: n }) => ({ id: e, label: n }));
}
function XM(t, e, n) {
  if (!t.enabled) return { ...t };
  if (e === null) return { ...t, weatherOverride: null };
  let i = Sf[n].some((r) => r.id === e);
  return { ...t, weatherOverride: i ? e : null };
}
function UP(t, e) {
  return t.weatherOverride ? XM(t, t.weatherOverride, e) : { ...t };
}
var YM = 720,
  J6 = 280;
function eV(t, e, n, i = !0) {
  if (!i || e !== "storm") return 0;
  let r = Number.isFinite(t) ? Math.max(0, t) : 0,
    a = THREE.MathUtils.clamp((Number.isFinite(n) ? n : 0) * 1.35 - 0.35, 0, 1);
  if (a <= 0) return 0;
  let o = 12.4,
    s = Math.floor(r / o),
    l = r - s * o,
    c = Math.sin((s + 1) * 12.9898 + 78.233) * 43758.5453,
    u = 2.1 + (c - Math.floor(c)) * 6.4,
    h = (d, p) => {
      let f = Math.max(0, 1 - Math.abs(l - d) / p);
      return f * f * (3 - 2 * f);
    };
  return THREE.MathUtils.clamp(
    Math.max(h(u, 0.075), h(u + 0.18, 0.055) * 0.62, h(u + 0.43, 0.14) * 0.24) *
      a,
    0,
    1,
  );
}
function tV(
  t,
  e,
  n,
  i,
  r = new THREE.Vector3(),
  a = {
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  },
) {
  let o = Math.max(0.001, n.right - n.left),
    s = Math.max(0.001, n.top - n.bottom),
    l = o / Math.max(1, i.x),
    c = s / Math.max(1, i.y);
  (a.forward.copy(e).normalize(),
    a.right.set(0, 1, 0).cross(a.forward),
    a.right.lengthSq() < 1e-6 ? a.right.set(1, 0, 0) : a.right.normalize(),
    a.up.copy(a.forward).cross(a.right).normalize());
  let u = a.right.dot(t),
    h = a.up.dot(t),
    d = Math.round(u / l) * l - u,
    p = Math.round(h / c) * c - h;
  return r.copy(t).addScaledVector(a.right, d).addScaledVector(a.up, p);
}
function nV(t, e, n = new THREE.Vector3(), i = new THREE.Vector3()) {
  let r = THREE.MathUtils.clamp(Number.isFinite(t) ? t : 0, -1, 1),
    a = Number.isFinite(e) ? e : 0,
    o = Math.sqrt(Math.max(0, 1 - r * r));
  return (
    n.set(Math.cos(a) * o, r, Math.sin(a) * o).normalize(),
    i.copy(n).multiplyScalar(-1),
    { sun: n, moon: i }
  );
}
var iV = [
  "sunElevation",
  "sunAzimuth",
  "daylight",
  "goldenHour",
  "night",
  "cloudCover",
  "fogDensity",
  "precipitationRate",
  "windKph",
  "windDirection",
  "temperatureC",
  "dust",
  "lightScale",
  "exposure",
];
// Rain, sleet, snow and dust around the camera: sized sprites (WebGPU draws
// THREE.Points at one pixel), wrapped in a moving column in the vertex stage.
function createPrecipitation() {
  let n = kt(`${ot}:atmosphere:precipitation:v1`),
    i = new Float32Array(YM * 3);
  for (let l = 0; l < YM; l += 1) {
    let c = l * 3,
      u = n() * Math.PI * 2,
      h = Math.sqrt(n()) * 58;
    ((i[c] = Math.cos(u) * h),
      (i[c + 1] = (n() - 0.5) * 40),
      (i[c + 2] = Math.sin(u) * h));
  }
  let r = new THREE.InstancedBufferAttribute(i, 3),
    a = {
      uTime: uniform(0),
      uOpacity: uniform(0),
      uColor: uniform(new THREE.Color(12175567)),
      uSpeed: uniform(20),
      uSize: uniform(2),
      uRadius: uniform(58),
      uHeight: uniform(40),
      uWind: uniform(new THREE.Vector2()),
    },
    o = new THREE.PointsNodeMaterial({
      transparent: !0,
      depthWrite: !1,
      sizeAttenuation: !1,
      fog: !1,
    }),
    l = instancedBufferAttribute(r),
    c = Fn(() => {
      let d = a.uHeight,
        p = a.uRadius,
        f = mod(l.y.sub(a.uTime.mul(a.uSpeed)).add(d.mul(0.5)), d).sub(
          d.mul(0.5),
        ),
        S = mod(l.x.add(a.uTime.mul(a.uWind.x)).add(p), p.mul(2)).sub(p),
        v = mod(l.z.add(a.uTime.mul(a.uWind.y)).add(p), p.mul(2)).sub(p);
      return vec3(S, f, v);
    })();
  ((o.positionNode = c),
    (o.sizeNode = a.uSize.mul(
      clamp(
        float(110).div(max(float(1), modelViewMatrix.mul(vec4(c, 1)).z.negate())),
        0.7,
        2.8,
      ),
    )));
  let u = uv().sub(0.5).length(),
    h = float(1).sub(smoothstep(0.08, 0.5, u));
  ((o.colorNode = vec4(a.uColor, 1)),
    (o.opacityNode = a.uOpacity.mul(h)),
    (o.alphaTestNode = float(0.01)));
  let s = new THREE.Sprite(o);
  return (
    (s.count = YM),
    (s.name = "biome-precipitation"),
    (s.frustumCulled = !1),
    (s.renderOrder = 5),
    {
      points: s,
      uniforms: a,
      setCount(d) {
        s.count = Math.max(0, Math.min(YM, d | 0));
      },
      dispose() {
        o.dispose();
      },
    }
  );
}
function createStarField() {
  let t = kt(`${ot}:atmosphere:stars:v1`),
    e = new Float32Array(480 * 3),
    n = 1840 * 0.84;
  for (let o = 0; o < 480; o += 1) {
    let s = o * 3,
      l = t() * Math.PI * 2,
      c = t() * Math.PI * 0.48 + Math.PI * 0.03;
    ((e[s] = Math.cos(l) * Math.sin(c) * n),
      (e[s + 1] = Math.cos(c) * n),
      (e[s + 2] = Math.sin(l) * Math.sin(c) * n));
  }
  let i = createPoints({
    positions: e,
    size: 1.45,
    sizeAttenuation: !1,
    material: {
      color: 14411239,
      transparent: !0,
      opacity: 0,
      depthWrite: !1,
      fog: !1,
    },
  });
  return (
    (i.object.name = "static-star-field"),
    (i.object.renderOrder = -2),
    { points: i.object, material: i.material }
  );
}
// The sky dome: gradient, sun and moon discs, two drifting cloud layers,
// dust tint and storm flashes, as a TSL node material.
var skyHash31 = Fn(([t]) => {
    let e = fract(t.mul(0.1031)).toVar();
    return (e.addAssign(dot(e, e.yzx.add(33.33))), fract(e.x.add(e.y).mul(e.z)));
  }).setLayout({
    name: "stillpointHash31",
    type: "float",
    inputs: [{ name: "p", type: "vec3" }],
  }),
  skyValueNoise = Fn(([t]) => {
    let e = floor(t).toVar(),
      n = fract(t).toVar(),
      i = n.mul(n).mul(vec3(3).sub(n.mul(2))).toVar(),
      r = skyHash31(e),
      a = skyHash31(e.add(vec3(1, 0, 0))),
      o = skyHash31(e.add(vec3(0, 1, 0))),
      s = skyHash31(e.add(vec3(1, 1, 0))),
      l = skyHash31(e.add(vec3(0, 0, 1))),
      c = skyHash31(e.add(vec3(1, 0, 1))),
      u = skyHash31(e.add(vec3(0, 1, 1))),
      h = skyHash31(e.add(vec3(1, 1, 1))),
      d = mix(r, a, i.x),
      p = mix(o, s, i.x),
      f = mix(l, c, i.x),
      S = mix(u, h, i.x);
    return mix(mix(d, p, i.y), mix(f, S, i.y), i.z);
  }).setLayout({
    name: "stillpointValueNoise",
    type: "float",
    inputs: [{ name: "p", type: "vec3" }],
  }),
  skyCloudFbm = Fn(([t]) =>
    skyValueNoise(t)
      .mul(0.58)
      .add(skyValueNoise(t.mul(2.03).add(7.1)).mul(0.28))
      .add(skyValueNoise(t.mul(4.07).sub(3.6)).mul(0.14)),
  ).setLayout({
    name: "stillpointCloudFbm",
    type: "float",
    inputs: [{ name: "p", type: "vec3" }],
  });
function createSkyMaterial() {
  let t = {
      topColor: uniform(new THREE.Color(1844518)),
      horizonColor: uniform(new THREE.Color(12684642)),
      groundColor: uniform(new THREE.Color(5851965)),
      cloudColor: uniform(new THREE.Color(7370618)),
      cloudCover: uniform(0.1),
      sunDirection: uniform(new THREE.Vector3(0, 1, 0)),
      moonDirection: uniform(new THREE.Vector3(0, -1, 0)),
      sunDiscColor: uniform(new THREE.Color(16769710)),
      moonDiscColor: uniform(new THREE.Color(11189200)),
      cloudOffset: uniform(new THREE.Vector2()),
      daylight: uniform(1),
      night: uniform(0),
      goldenHour: uniform(0),
      dust: uniform(0),
      lightningFlash: uniform(0),
    },
    e = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: !1,
      fog: !1,
    });
  return (
    (e.name = "atmosphere-sky"),
    (e.colorNode = Fn(() => {
      let n = normalize(positionLocal),
        i = n.y,
        r = select(
          i.greaterThan(0),
          mix(t.horizonColor, t.topColor, smoothstep(0, 0.72, i)),
          mix(t.horizonColor, t.groundColor, smoothstep(0, 0.32, i.negate())),
        ),
        a = dot(n, normalize(t.sunDirection)),
        o = dot(n, normalize(t.moonDirection)),
        s = smoothstep(0.99972, 0.99991, a).mul(t.daylight),
        l = smoothstep(0.955, 1, a)
          .mul(float(0.18).add(t.goldenHour.mul(0.34)))
          .mul(t.daylight),
        c = smoothstep(0.99942, 0.99978, o).mul(t.night),
        u = smoothstep(0.972, 1, o).mul(0.16).mul(t.night),
        h = r
          .add(t.sunDiscColor.mul(s.mul(2.2).add(l)))
          .add(t.moonDiscColor.mul(c.mul(1.15).add(u))),
        d = n
          .mul(3.45)
          .add(vec3(t.cloudOffset.x, 0, t.cloudOffset.y).mul(0.012)),
        p = skyCloudFbm(d),
        f = skyCloudFbm(
          n.mul(7.3).sub(vec3(t.cloudOffset.y, 0, t.cloudOffset.x).mul(0.006)),
        ),
        S = p.mul(0.78).add(f.mul(0.22)),
        v = mix(float(0.76), float(0.39), t.cloudCover),
        m = smoothstep(v, v.add(0.17), S)
          .mul(smoothstep(-0.015, 0.32, i))
          .mul(smoothstep(0, 0.08, t.cloudCover))
          .mul(mix(float(0.74), float(1), t.cloudCover)),
        y = mix(t.cloudColor, vec3(0.42, 0.34, 0.28), t.dust.mul(0.34));
      return mix(h, y, m.mul(0.68)).add(
        vec3(0.58, 0.72, 1)
          .mul(t.lightningFlash)
          .mul(float(0.18).add(m.mul(0.34))),
      );
    })()),
    (e.skyUniforms = t),
    e
  );
}
function createEnvironment(t, e, n, i = Sc) {
  let r = new THREE.FogExp2(9401943, 0.00365);
  ((t.fog = r), (t.background = new THREE.Color(1514008)));
  let a = new THREE.HemisphereLight(15191456, 2434850, 2.25);
  t.add(a);
  let o = new THREE.DirectionalLight(16766368, 4.1);
  (o.position.set(-70, 92, 38),
    (o.castShadow = qualityHasShadows(n)),
    (o.shadow.camera.near = 1),
    (o.shadow.camera.far = 260),
    (o.shadow.camera.left = -88),
    (o.shadow.camera.right = 88),
    (o.shadow.camera.top = 88),
    (o.shadow.camera.bottom = -88),
    (o.shadow.radius = 1.5));
  let s = new THREE.Object3D();
  (t.add(o, s), (o.target = s));
  let l = new THREE.SphereGeometry(1840 * 0.91, 32, 16),
    c = createSkyMaterial(),
    u = new THREE.Mesh(l, c);
  ((u.name = "atmosphere-sky"),
    (u.frustumCulled = !1),
    (u.renderOrder = -3),
    t.add(u));
  let h = createStarField();
  t.add(h.points);
  let d = createPrecipitation();
  t.add(d.points);
  let p = Ma(i),
    f = mx(p),
    S = 0,
    v = new THREE.Vector2(),
    m = "standard",
    y = ui(0, 8),
    x = Ty(p, y),
    g = { ...x },
    E = new THREE.Color(),
    M = new THREE.Color(),
    _ = new THREE.Color(),
    b = new THREE.Color(),
    T = new THREE.Color(),
    R = new THREE.Color(33e4),
    C = new THREE.Color(1383458),
    P = new THREE.Color(1514267),
    B = new THREE.Color(5797506),
    L = new THREE.Color(12954240),
    O = new THREE.Color(5987408),
    G = new THREE.Color(14186819),
    F = new THREE.Color(6910582),
    W = new THREE.Color(10119497),
    U = new THREE.Color(16769202),
    H = new THREE.Color(16751190),
    ne = new THREE.Color(9546184),
    ae = new THREE.Color(12441855),
    _e = new THREE.Color(),
    Ue = new THREE.Vector3(),
    ze = new THREE.Vector3(),
    Q = new THREE.Vector3(),
    de = new THREE.Vector3(),
    le = {
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
    },
    Ie = !0,
    z = !0,
    re = 0,
    ve = {
      effectSeconds: S,
      cloudOffset: new THREE.Vector2(),
      cloudCover: g.cloudCover,
      precipitationRate: g.precipitationRate,
      daylight: g.daylight,
      goldenHour: g.goldenHour,
      night: g.night,
      dust: g.dust,
      fogDensity: g.fogDensity,
      surfaceWetness: re,
      lightningFlash: 0,
      windKph: g.windKph,
      windDirection: g.windDirection,
      sunDirection: Ue,
      moonDirection: ze,
      sunColor: new THREE.Color(16769202),
      skyColor: new THREE.Color(),
      horizonColor: new THREE.Color(),
    },
    Pe = (Ce) => {
      let st = HORIZON_PROFILES[m].hazeMultiplier;
      if (st >= 1) return 1;
      let ft = Math.max(
          Ce.weatherId === "fog" ? 1 : 0,
          Ce.precipitationRate,
          Ce.dust,
        ),
        ct = m === "extended" ? 0.72 : 0.68;
      return THREE.MathUtils.lerp(st, ct, ft);
    },
    lt = (Ce) => Ce.fogDensity * Pe(Ce) * (1 + Ce.night * 0.08),
    pt = (Ce, st = Ce) => {
      let ft = eV(S, g.weatherId, g.precipitationRate, z);
      (E.lerpColors(R, B, g.daylight),
        M.lerpColors(C, L, g.daylight),
        _.lerpColors(P, O, g.daylight),
        M.lerp(G, g.goldenHour * 0.78),
        E.lerp(F, g.cloudCover * 0.42),
        M.lerp(F, g.cloudCover * 0.28),
        _.lerp(W, g.dust * 0.5),
        M.lerp(W, g.dust * 0.64),
        b.lerpColors(_, M, 0.7),
        T.lerpColors(F, W, g.dust * 0.7),
        E.lerp(ae, ft * 0.24),
        M.lerp(ae, ft * 0.34),
        T.lerp(ae, ft * 0.52),
        c.skyUniforms.topColor.value.copy(E),
        c.skyUniforms.horizonColor.value.copy(M),
        c.skyUniforms.groundColor.value.copy(_),
        c.skyUniforms.cloudColor.value.copy(T),
        (c.skyUniforms.cloudCover.value = g.cloudCover),
        c.skyUniforms.cloudOffset.value.copy(v),
        (c.skyUniforms.daylight.value = g.daylight),
        (c.skyUniforms.night.value = g.night),
        (c.skyUniforms.goldenHour.value = g.goldenHour),
        (c.skyUniforms.dust.value = g.dust),
        (c.skyUniforms.lightningFlash.value = ft),
        r.color.copy(b),
        (r.density = lt(g)),
        t.background.copy(b).multiplyScalar(0.72));
      let ct = g.sunElevation > -0.06;
      (nV(g.sunElevation, g.sunAzimuth, Ue, ze),
        c.skyUniforms.sunDirection.value.copy(Ue),
        c.skyUniforms.moonDirection.value.copy(ze));
      let Vt = ct ? Ue : ze,
        V = 116,
        Pn = Vt.x * V,
        Mt = Vt.z * V,
        I = ct ? Math.max(7, Vt.y * 126) : Math.max(28, Vt.y * 96);
      (de.set(Pn, I, Mt),
        Ie && o.castShadow
          ? tV(Ce, de, o.shadow.camera, o.shadow.mapSize, Q, le)
          : Q.copy(Ce),
        o.position.copy(Q).add(de),
        s.position.copy(Q),
        ct
          ? (_e.lerpColors(U, H, g.goldenHour * 0.86),
            o.color.copy(_e),
            c.skyUniforms.sunDiscColor.value.copy(_e),
            (o.intensity = 4.2 * g.lightScale))
          : (o.color.copy(ne),
            (o.intensity = 0.34 * g.night * (1 - g.cloudCover * 0.52))),
        ft > 0 && (o.color.lerp(ae, ft * 0.9), (o.intensity += ft * 7.5)),
        a.color.copy(E).lerp(L, 0.34 * g.daylight),
        a.groundColor.copy(_).multiplyScalar(0.62),
        (a.intensity = 0.32 + g.lightScale * 1.96 + ft * 2.8),
        (e.toneMappingExposure = g.exposure * (1 + ft * 0.26)),
        u.position.copy(st),
        h.points.position.copy(st),
        (h.material.opacity = Math.max(0, g.night - g.cloudCover * 0.66)));
      let w = Ce.y + 18;
      (d.points.position.set(
        (Ce.x + st.x) * 0.5,
        (w + st.y) * 0.5,
        (Ce.z + st.z) * 0.5,
      ),
        (d.uniforms.uHeight.value = 40 + Math.abs(st.y - w)),
        (d.uniforms.uTime.value = S));
      let q = g.dust > g.precipitationRate,
        Z = Math.max(g.precipitationRate, g.dust);
      ((d.points.visible = Z > 0.025),
        (d.uniforms.uOpacity.value = Z * (q ? 0.34 : 0.72)),
        (d.uniforms.uSpeed.value = q
          ? 1.8
          : g.precipitation === "snow"
            ? 3.2
            : g.precipitation === "sleet"
              ? 15
              : 24),
        (d.uniforms.uSize.value = q
          ? 4.2
          : g.precipitation === "snow"
            ? 3.4
            : 1.45),
        d.uniforms.uColor.value.setHex(
          q ? 12684124 : g.precipitation === "snow" ? 15002347 : 11452360,
        ));
      let ee = (g.windDirection * Math.PI) / 180,
        pe = Math.min(5, g.windKph / 18);
      (d.uniforms.uWind.value.set(Math.cos(ee) * pe, Math.sin(ee) * pe),
        (ve.effectSeconds = S),
        ve.cloudOffset.copy(v),
        (ve.cloudCover = g.cloudCover),
        (ve.precipitationRate = g.precipitationRate),
        (ve.daylight = g.daylight),
        (ve.goldenHour = g.goldenHour),
        (ve.night = g.night),
        (ve.dust = g.dust),
        (ve.fogDensity = r.density),
        (ve.surfaceWetness = re),
        (ve.lightningFlash = ft),
        (ve.windKph = g.windKph),
        (ve.windDirection = g.windDirection),
        ve.sunColor.copy(o.color),
        ve.skyColor.copy(E),
        ve.horizonColor.copy(M));
    },
    Qe = {
      sun: o,
      sunTarget: s,
      tick(Ce, st, ft) {
        let ct = Number.isFinite(st) ? Math.max(0, st) : 0;
        if (ft) {
          S += ct;
          let V =
              g.precipitation === "rain" || g.precipitation === "sleet"
                ? g.precipitationRate
                : 0,
            Pn = V > re ? 0.18 : 0.025;
          re = THREE.MathUtils.lerp(re, V, 1 - Math.exp(-Pn * ct));
          let Mt = (g.windDirection * Math.PI) / 180,
            I = THREE.MathUtils.clamp(g.windKph * 0.018, 0.025, 1.8);
          ((v.x += Math.cos(Mt) * ct * I),
            (v.y += Math.sin(Mt) * ct * I),
            f.enabled ? (f = zP(f, ct, !0)) : (p += ct * Pd));
        }
        Qe.sync(Ce);
      },
      present(Ce, st, ft = Ce) {
        let ct = Number.isFinite(st) ? Math.max(0, st) : 0,
          Vt = 1 - Math.exp(-ct * 2.25);
        for (let V of iV) g[V] = g[V] + (x[V] - g[V]) * Vt;
        ((g.weatherId = x.weatherId),
          (g.weatherLabel = x.weatherLabel),
          (g.precipitation = x.precipitation),
          pt(Ce, ft));
      },
      sync(Ce, st = !1) {
        ((y = ui(Ce.x, Ce.z)), (f = UP(f, y.biome.id)));
        let ft = f.enabled ? f.worldMinutes : p;
        ((x = Ty(ft, y, ot, f.enabled ? f.weatherOverride : null)),
          st && (g = { ...x }));
      },
      setWorldMinutes(Ce) {
        ((p = Ma(Ce)),
          f.enabled && (f = { ...f, worldMinutes: p }),
          (x = Ty(p, y, ot, f.enabled ? f.weatherOverride : null)),
          (g = { ...x }));
      },
      getPersistentWorldMinutes() {
        return p;
      },
      getSample() {
        let Ce = lt(x);
        return {
          ...x,
          visibilityMeters: Math.round(
            Math.min(HORIZON_PROFILES[m].drawDistanceMeters, 1.978 / Ce),
          ),
        };
      },
      getVisualState() {
        return ve;
      },
      setDeveloperMode(Ce) {
        f = PP(f, Ce, p);
      },
      setDeveloperClockPaused(Ce) {
        f.enabled && (f = { ...f, clockPaused: Ce });
      },
      setDeveloperMinuteOfDay(Ce) {
        f = OP(f, Ce);
      },
      advanceDeveloperMinutes(Ce) {
        f = WM(f, Ce);
      },
      setDeveloperWeather(Ce) {
        if (!f.enabled) return !1;
        let st = XM(f, Ce, y.biome.id),
          ft = Ce === null || st.weatherOverride === Ce;
        return ((f = st), ft);
      },
      resetDeveloperOverrides() {
        f = LP(f, p);
      },
      getDeveloperState() {
        return { ...f };
      },
      getDeveloperWeatherOptions() {
        return weatherOptionsFor(y.biome.id);
      },
      setQuality(Ce) {
        let st = QUALITY_PROFILES[Ce];
        ((Qe.quality = Ce),
          (o.castShadow = qualityHasShadows(Ce)),
          // The profile picks the map size at "high"; the kit tier scales it.
          // Never dispose light.shadow.map: r186 resizes it from mapSize.
          o.shadow.mapSize.setScalar(kitShadowSize(st.sunShadowMapSize)),
          (o.shadow.bias = Ce === "ultra" ? -8e-5 : -15e-5),
          (o.shadow.normalBias = Ce === "ultra" ? 0.015 : 0.02),
          d.setCount(qualityHasHighDetail(Ce) ? YM : J6));
      },
      setShadowStabilization(Ce) {
        Ie = Ce;
      },
      setStormLightning(Ce) {
        z = Ce;
      },
      setHorizonMode(Ce) {
        m = Ce;
      },
      dispose() {
        (t.remove(a, o, s, u, h.points, d.points),
          l.dispose(),
          c.dispose(),
          h.material.dispose(),
          d.dispose(),
          o.dispose());
      },
    },
    Gt = new THREE.Vector3(0, 0, 8);
  return (Qe.setQuality(n), Qe.sync(Gt, !0), Qe.present(Gt, 0), Qe);
}
function cV(t, e) {
  let n = Number.isFinite(t) ? t : 0,
    i = Number.isFinite(e) ? e : 0;
  return Math.max(-480, Math.min(480, n + i));
}
// ---------------------------------------------------------------------------
// Input: every control goes through kit.input actions (keyboard and mouse,
// gamepad, touch). The keyboard keys follow the player's rebindable key
// bindings; gamepad and touch follow the shared standard layout.
// ---------------------------------------------------------------------------
var EXTRA_KEYS = {
  sprint: ["ShiftRight"],
  crouch: ["ControlRight", "KeyC"],
};
function kitActionsFor(t) {
  let e = new Set(Object.values(t)),
    n = (a) => a.filter((o) => !e.has(o)),
    i = (a) => [t[a], ...n(EXTRA_KEYS[a] ?? [])];
  return {
    move: {
      type: "vector",
      keys: {
        up: [t.moveForward, ...n(["ArrowUp"])],
        down: [t.moveBackward, ...n(["ArrowDown"])],
        left: [t.moveLeft, ...n(["ArrowLeft"])],
        right: [t.moveRight, ...n(["ArrowRight"])],
      },
      gamepad: "leftStick",
      touch: "stick",
    },
    look: { type: "look", mouse: "locked", gamepad: "rightStick", touch: "drag" },
    pause: {
      keys: n(["KeyP"]),
      gamepad: ["Start"],
      touch: { label: "II", slot: "top" },
    },
    jump: { keys: [t.jump], gamepad: ["A"], touch: "Jump" },
    use: { gamepad: ["X"], touch: "Use" },
    interact: { keys: [t.interact] },
    harvest: { keys: [t.harvest], mouse: [0], gamepad: ["RT"] },
    crouch: { keys: i("crouch"), gamepad: ["B"], touch: "Crouch" },
    sprint: { keys: i("sprint"), gamepad: ["LB", "LS"], touch: "Run" },
    scanner: { keys: [t.scanner], gamepad: ["LT"], touch: "Scan" },
    flashlight: {
      keys: [t.flashlight],
      gamepad: ["Y"],
      touch: { label: "Light", slot: "top" },
    },
    map: { keys: [t.map], gamepad: ["Back"], touch: { label: "Map", slot: "top" } },
    inventory: { keys: [t.inventory], gamepad: ["Left"] },
    fieldGuide: { keys: [t.fieldGuide], gamepad: ["Right"] },
    quality: { keys: [t.quality] },
    cameraView: {
      keys: [t.cameraView],
      gamepad: ["RS"],
      touch: { label: "View", slot: "top" },
    },
    recover: { keys: [t.recover] },
    zoomIn: { gamepad: ["Up"] },
    zoomOut: { gamepad: ["Down"] },
    devPanel: { keys: ["Backquote"] },
    escape: { keys: ["Escape"] },
    menuUp: { keys: ["ArrowUp"], gamepad: ["Up"] },
    menuDown: { keys: ["ArrowDown"], gamepad: ["Down"] },
    menuLeft: { keys: ["ArrowLeft"], gamepad: ["Left"] },
    menuRight: { keys: ["ArrowRight"], gamepad: ["Right"] },
    menuConfirm: { gamepad: ["A"] },
    menuBack: { gamepad: ["B"] },
  };
}
// Game action -> the kit actions that trigger it.
var GAME_ACTION_SOURCES = {
  jump: ["jump"],
  interact: ["interact", "use"],
  harvest: ["harvest", "use"],
  crouch: ["crouch"],
  sprint: ["sprint"],
  scanner: ["scanner"],
  flashlight: ["flashlight"],
  map: ["map"],
  inventory: ["inventory"],
  fieldGuide: ["fieldGuide"],
  quality: ["quality"],
  cameraView: ["cameraView"],
  recover: ["recover"],
  Backquote: ["devPanel"],
  Escape: ["escape"],
};
// Toggles that still work while a menu is open (as the keyboard shortcuts
// always did). A pad's D-pad is menu navigation there, so it only keeps Map.
var MENU_KEYBOARD_ACTIONS = new Set([
    "map",
    "inventory",
    "fieldGuide",
    "quality",
    "recover",
    "Backquote",
    "Escape",
  ]),
  MENU_PAD_ACTIONS = new Set(["map"]),
  MOUSE_LOOK_RADIANS = 0.0024,
  PLAYER_LOOK_RADIANS = 0.00175;
var FrontierInput = class {
  constructor(e, n, i, r = DEFAULT_KEY_BINDINGS) {
    this.kit = e;
    this.canvas = n;
    this.pending = new Set();
    this.lookDelta = { x: 0, y: 0 };
    this.cameraZoomDelta = 0;
    this.virtualCapture = !1;
    this.wasLocked = !1;
    this.onPointerLockChange = i;
    this.handlePointerLockChange = () => {
      let a = document.pointerLockElement === this.canvas;
      ((a || this.wasLocked) && (this.virtualCapture = !1),
        (this.wasLocked = a));
      let o = this.isLocked();
      (o || this.handleBlur(), this.onPointerLockChange?.(o));
    };
    this.handlePointerLockError = () => {
      this.onPointerLockChange?.(this.isLocked());
    };
    this.handleBlur = () => {
      (this.pending.clear(),
        (this.lookDelta.x = 0),
        (this.lookDelta.y = 0),
        (this.cameraZoomDelta = 0));
    };
    (this.setBindings(r),
      document.addEventListener(
        "pointerlockchange",
        this.handlePointerLockChange,
      ),
      document.addEventListener("pointerlockerror", this.handlePointerLockError),
      window.addEventListener("blur", this.handleBlur));
  }
  get source() {
    return this.kit.input.source;
  }
  // Called once per rendered frame, before the fixed simulation steps. Presses
  // are latched until a system consumes them, so a tap is never lost between
  // steps and never counted twice.
  beginFrame(e, n) {
    let i = this.kit.input,
      r = i.source;
    for (let [a, o] of Object.entries(GAME_ACTION_SOURCES))
      (n &&
        !(r === "gamepad" ? MENU_PAD_ACTIONS : MENU_KEYBOARD_ACTIONS).has(a)) ||
        (o.some((s) => i.pressed(s)) && this.pending.add(a));
    if (n) return;
    if (this.isLocked()) {
      let a = i.look("look"),
        o = r === "keyboard" ? MOUSE_LOOK_RADIANS : PLAYER_LOOK_RADIANS;
      ((this.lookDelta.x += a.x / o), (this.lookDelta.y += a.y / o));
    }
    let a = i.zoom();
    (a !== 0 &&
      (this.cameraZoomDelta = cV(
        this.cameraZoomDelta,
        Math.max(-240, Math.min(240, -a * 100)),
      )),
      i.down("zoomIn") &&
        (this.cameraZoomDelta = cV(this.cameraZoomDelta, -600 * e)),
      i.down("zoomOut") &&
        (this.cameraZoomDelta = cV(this.cameraZoomDelta, 600 * e)));
  }
  requestPointerLock() {
    if (this.kit.input.source !== "keyboard") {
      // Touch and gamepad have no pointer to capture: play starts at once.
      this.virtualCapture ||
        ((this.virtualCapture = !0),
        queueMicrotask(() => this.onPointerLockChange?.(this.isLocked())));
      return;
    }
    if (document.pointerLockElement !== this.canvas)
      try {
        let e = this.canvas.requestPointerLock?.({ unadjustedMovement: !0 });
        Promise.resolve(e).catch(() => {
          try {
            let n = this.canvas.requestPointerLock?.();
            Promise.resolve(n).catch(this.handlePointerLockError);
          } catch {
            this.handlePointerLockError();
          }
        });
      } catch {
        this.handlePointerLockError();
      }
  }
  releasePointer() {
    ((this.virtualCapture = !1),
      document.pointerLockElement === this.canvas && document.exitPointerLock?.());
  }
  isLocked() {
    return document.pointerLockElement === this.canvas || this.virtualCapture;
  }
  isDown(e) {
    return this.kit.input.keys.has(e);
  }
  moveVector() {
    return this.kit.input.vector("move");
  }
  isActionDown(e) {
    let n = this.kit.input;
    switch (e) {
      case "moveForward":
        return n.vector("move").y > 0.3;
      case "moveBackward":
        return n.vector("move").y < -0.3;
      case "moveLeft":
        return n.vector("move").x < -0.3;
      case "moveRight":
        return n.vector("move").x > 0.3;
    }
    return (GAME_ACTION_SOURCES[e] ?? [e]).some((i) => n.down(i));
  }
  consumePressed(e) {
    let n = this.pending.has(e);
    return (this.pending.delete(e), n);
  }
  consumeActionPressed(e) {
    return this.consumePressed(e);
  }
  setBindings(e) {
    (this.kit.input.define(kitActionsFor(e)),
      this.kit.touch?.rebuild(),
      this.reset());
  }
  consumeLookDelta() {
    let e = { ...this.lookDelta };
    return ((this.lookDelta.x = 0), (this.lookDelta.y = 0), e);
  }
  consumeCameraZoomDelta() {
    let e = this.cameraZoomDelta;
    return ((this.cameraZoomDelta = 0), e);
  }
  reset() {
    (this.handleBlur(), this.kit.input.settle());
  }
  dispose() {
    (document.removeEventListener(
      "pointerlockchange",
      this.handlePointerLockChange,
    ),
      document.removeEventListener(
        "pointerlockerror",
        this.handlePointerLockError,
      ),
      window.removeEventListener("blur", this.handleBlur),
      this.releasePointer(),
      this.handleBlur());
  }
};
// Gamepad and arrow-key navigation for the game's own DOM menus: the D-pad or
// left stick moves focus spatially, A activates, B closes, sliders step with
// left and right. Touch and mouse use the menus directly.
var MENU_ROOTS = [
    ".dev-overlay .dev-panel",
    ".map-panel",
    ".settings-panel",
    ".inventory-panel",
    ".field-overlay [role='dialog']",
    ".field-overlay .field-panel",
    ".field-overlay article",
    ".incapacitated-panel",
    ".pause-panel",
    ".error-screen",
    ".entry-screen",
  ],
  MENU_FOCUSABLE =
    "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
var FrontierMenuNavigator = class {
  constructor(e) {
    this.kit = e;
    this.heldDirection = null;
    this.repeatAt = 0;
    this.focused = null;
  }
  root() {
    for (let e of MENU_ROOTS) {
      let n = document.querySelector(e);
      if (n && n.getClientRects().length > 0) return n;
    }
    return null;
  }
  focusables(e) {
    return Array.from(e.querySelectorAll(MENU_FOCUSABLE)).filter(
      (n) =>
        n.tabIndex >= 0 &&
        !n.closest("[hidden], [inert]") &&
        n.getClientRects().length > 0 &&
        !n.classList.contains("field-click-shield") &&
        !n.classList.contains("dev-click-shield"),
    );
  }
  direction() {
    let e = this.kit.input,
      n = e.source === "gamepad" ? e.vector("move") : { x: 0, y: 0 },
      i = 0,
      r = 0;
    return (
      (e.down("menuLeft") || n.x < -0.55) && (i = -1),
      (e.down("menuRight") || n.x > 0.55) && (i = 1),
      (e.down("menuUp") || n.y > 0.55) && (r = -1),
      (e.down("menuDown") || n.y < -0.55) && (r = 1),
      i !== 0 && r !== 0 && (Math.abs(n.x) > Math.abs(n.y) ? (r = 0) : (i = 0)),
      i || r ? `${i}:${r}` : null
    );
  }
  mark(e) {
    (this.focused && this.focused !== e && this.focused.classList.remove("is-pad-focus"),
      (this.focused = e),
      e &&
        (e.classList.add("is-pad-focus"),
        e.focus({ preventScroll: !1 }),
        e.scrollIntoView?.({ block: "nearest", inline: "nearest" })));
  }
  current(e, n) {
    let i = document.activeElement;
    return i && n.includes(i) ? i : null;
  }
  move(e, n, i) {
    let r = this.focusables(e);
    if (r.length === 0) return;
    let a = this.current(e, r);
    if (!a) {
      this.mark(r[0]);
      return;
    }
    if (a instanceof HTMLInputElement && a.type === "range" && n !== 0) {
      let c = Number(a.step) || 1,
        u = Math.min(
          Number(a.max),
          Math.max(Number(a.min), Number(a.value) + n * c),
        ),
        h = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      (h?.set?.call(a, String(u)),
        a.dispatchEvent(new Event("input", { bubbles: !0 })),
        a.dispatchEvent(new Event("change", { bubbles: !0 })));
      return;
    }
    let o = a.getBoundingClientRect(),
      s = o.left + o.width / 2,
      l = o.top + o.height / 2,
      c = null,
      u = 1 / 0;
    for (let h of r) {
      if (h === a) continue;
      let d = h.getBoundingClientRect(),
        p = d.left + d.width / 2 - s,
        f = d.top + d.height / 2 - l,
        S = n !== 0 ? p * n : f * i,
        v = n !== 0 ? Math.abs(f) : Math.abs(p);
      if (S <= 1) continue;
      let m = S + v * 2.2;
      m < u && ((u = m), (c = h));
    }
    if (!c && i !== 0) {
      // Wrap vertically so long lists loop.
      let h = r.indexOf(a);
      c = r[(h + (i > 0 ? 1 : r.length - 1)) % r.length];
    }
    c && this.mark(c);
  }
  // Returns true when a menu took the input this frame.
  update(e, n) {
    let i = this.root();
    if (!i) return ((this.heldDirection = null), !1);
    let r = this.kit.input,
      a = this.direction(),
      o = performance.now();
    if (a && a !== this.heldDirection)
      ((this.heldDirection = a), (this.repeatAt = o + 380), this.step(i, a));
    else if (a && o >= this.repeatAt)
      ((this.repeatAt = o + 110), this.step(i, a));
    else a || (this.heldDirection = null);
    if (r.pressed("menuConfirm")) {
      let s = this.focusables(i),
        l = this.current(i, s);
      l ? (this.mark(l), l.click()) : s.length > 0 && this.mark(s[0]);
    }
    return (r.pressed("menuBack") && n?.closeTopMenu(), !0);
  }
  step(e, n) {
    let [i, r] = n.split(":").map(Number);
    this.move(e, i, r);
  }
};
var yx = class {
  constructor() {
    this.listeners = new Map();
  }
  on(e, n) {
    let i = this.listeners.get(e) ?? new Set();
    return (i.add(n), this.listeners.set(e, i), () => i.delete(n));
  }
  emit(e, n) {
    this.listeners.get(e)?.forEach((i) => i(n));
  }
  clear() {
    this.listeners.clear();
  }
};
var Dc = "player:map",
  qM = 12,
  uV = 128,
  dV = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;
function BP(t) {
  return { ...t };
}
function Ac(t) {
  return { ...t, position: { ...t.position }, source: BP(t.source) };
}
function hV(t) {
  let e = t.id.trim(),
    n = t.label.trim().slice(0, 80),
    { x: i, z: r } = t.position;
  if (!dV.test(e) || !n || !Number.isFinite(i) || !Number.isFinite(r))
    return null;
  let a = t.arrivalRadius ?? qM,
    o = Number.isFinite(a) ? Math.min(1e3, Math.max(0.5, a)) : qM;
  return {
    id: e,
    label: n,
    position: { x: i, z: r },
    source: BP(t.source),
    arrivalRadius: o,
    clearOnArrival: t.clearOnArrival ?? !1,
  };
}
var NavigationSystem = class {
  constructor() {
    this.targets = new Map();
    this.reached = new Set();
    this.events = new yx();
    this.activeId = null;
  }
  setTarget(e, n = !0) {
    let i = hV(e);
    if (!i) return null;
    if (!this.targets.has(i.id) && this.targets.size >= uV) {
      let r = [...this.targets.keys()].find((a) => a !== this.activeId);
      if (!r) return null;
      (this.targets.delete(r), this.reached.delete(r));
    }
    return (
      this.targets.set(i.id, i),
      this.reached.delete(i.id),
      n && this.activateTarget(i.id),
      Ac(i)
    );
  }
  setManualWaypoint(e) {
    return this.setTarget({
      id: Dc,
      label: "Map waypoint",
      position: e,
      source: { kind: "player" },
      arrivalRadius: qM,
      clearOnArrival: !1,
    });
  }
  activateTarget(e) {
    let n = this.targets.get(e);
    return n
      ? ((this.activeId = e),
        this.reached.delete(e),
        this.events.emit("activeChanged", { target: Ac(n) }),
        !0)
      : !1;
  }
  clearActive(e) {
    return !this.activeId || (e && this.activeId !== e)
      ? !1
      : ((this.activeId = null),
        this.events.emit("activeChanged", { target: null }),
        !0);
  }
  removeTarget(e) {
    return this.targets.delete(e)
      ? (this.reached.delete(e),
        this.activeId === e &&
          ((this.activeId = null),
          this.events.emit("activeChanged", { target: null })),
        !0)
      : !1;
  }
  getTarget(e) {
    let n = this.targets.get(e);
    return n ? Ac(n) : null;
  }
  getActiveTarget() {
    if (!this.activeId) return null;
    let e = this.targets.get(this.activeId);
    return e ? Ac(e) : null;
  }
  targetsSnapshot() {
    return [...this.targets.values()].map(Ac);
  }
  getGuidance(e, n) {
    if (!this.activeId) return null;
    let i = this.targets.get(this.activeId);
    if (!i) return null;
    let r = X2(e, i.position),
      a = V2(e, i.position);
    return {
      target: Ac(i),
      distance: r,
      bearing: a,
      relativeBearing: W2(a, n),
      reached: this.reached.has(i.id),
    };
  }
  update(e) {
    let n = this.getGuidance(e, 0);
    !n ||
      n.distance > n.target.arrivalRadius ||
      this.reached.has(n.target.id) ||
      (this.reached.add(n.target.id),
      this.events.emit("arrived", {
        target: Ac(n.target),
        distance: n.distance,
      }),
      n.target.clearOnArrival && this.removeTarget(n.target.id));
  }
  on(e, n) {
    return this.events.on(e, n);
  }
  dispose() {
    (this.targets.clear(),
      this.reached.clear(),
      (this.activeId = null),
      this.events.clear());
  }
};
function bx(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= -1e3 && t <= 5e3;
}
var pV = { ultra: 12, cinematic: 12, performance: 6 },
  GP = { ultra: 15, cinematic: 15, performance: 11 },
  fV = 72,
  mV = -0.8,
  gV = 2.2,
  Ic = 999999,
  vV =
    /^placed:(?:bedroll|campfire|survey_marker|weather_shelter|field_torch):[0-9]{1,6}$/,
  yV = new Set([
    "bedroll",
    "campfire",
    "survey_marker",
    "weather_shelter",
    "field_torch",
  ]);
function fl(t, e, n) {
  let i = new THREE.Mesh(t, e);
  return ((i.castShadow = qualityHasShadows(n)), (i.receiveShadow = !0), i);
}
function ZM(t, e, n, i) {
  return {
    id: `${t.id}:rest`,
    kind: "rest",
    action: "rest",
    name: n,
    position: new THREE.Vector3(t.x, t.y + 0.75, t.z),
    root: e,
    maxDistance: 4.5,
    hitsRequired: 0,
    hits: 0,
    restSite: i,
  };
}
function KM(t, e) {
  let n = new THREE.Group();
  n.name = "player-placed-entities";
  let i = [],
    r = [],
    a = [];
  for (let o of t) {
    let s = new THREE.Group();
    if (
      ((s.name = o.id),
      s.position.set(o.x, o.y, o.z),
      (s.rotation.y = o.yaw),
      o.archetypeId === "bedroll")
    ) {
      let l = fl(
        new THREE.BoxGeometry(1.7, 0.13, 0.72),
        new THREE.MeshStandardNodeMaterial({ color: 5663324, roughness: 0.96 }),
        e,
      );
      ((l.position.y = 0.08),
        s.add(l),
        i.push(
          ZM(o, s, "Survey bedroll", {
            id: `${o.id}:rest`,
            label: "Survey bedroll",
            safe: !1,
            sheltered: !1,
            warmth: 0,
          }),
        ));
    } else if (o.archetypeId === "campfire") {
      let l = fl(
        new THREE.CylinderGeometry(0.48, 0.58, 0.18, 8),
        new THREE.MeshStandardNodeMaterial({ color: 4932407, roughness: 1 }),
        e,
      );
      l.position.y = 0.1;
      let c = fl(
        new THREE.ConeGeometry(0.28, 0.7, 6),
        new THREE.MeshStandardNodeMaterial({
          color: 13662773,
          emissive: 14835492,
          emissiveIntensity: 1.5,
          roughness: 0.7,
        }),
        e,
      );
      (markBloom(c),
        (c.position.y = 0.48),
        s.add(l, c),
        r.push({
          shape: "circle",
          id: o.id,
          x: o.x,
          z: o.z,
          radius: 0.5,
          minY: o.y,
          maxY: o.y + 0.75,
        }),
        i.push(
          ZM(o, s, "Warm campfire", {
            id: `${o.id}:rest`,
            label: "Warm campfire",
            safe: !1,
            sheltered: !1,
            warmth: 1,
          }),
        ));
    } else if (o.archetypeId === "survey_marker") {
      let l = fl(
        new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6),
        new THREE.MeshStandardNodeMaterial({ color: 3160887, roughness: 0.72 }),
        e,
      );
      l.position.y = 1.1;
      let c = fl(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshStandardNodeMaterial({
          color: 9159594,
          emissive: 3234634,
          emissiveIntensity: 1,
        }),
        e,
      );
      (markBloom(c), (c.position.y = 2.25), s.add(l, c));
    } else if (o.archetypeId === "weather_shelter") {
      let l = fl(
        new THREE.ConeGeometry(1.75, 1.15, 4),
        new THREE.MeshStandardNodeMaterial({
          color: 5859165,
          roughness: 0.92,
          side: THREE.DoubleSide,
        }),
        e,
      );
      ((l.rotation.y = Math.PI * 0.25),
        (l.position.y = 1.75),
        s.add(l),
        r.push({
          shape: "circle",
          id: o.id,
          x: o.x,
          z: o.z,
          radius: 0.32,
          minY: o.y,
          maxY: o.y + 2.35,
        }),
        i.push(
          ZM(o, s, "Weather shelter", {
            id: `${o.id}:rest`,
            label: "Weather shelter",
            safe: !1,
            sheltered: !0,
            warmth: 0.25,
          }),
        ));
    } else {
      let l = fl(
        new THREE.CylinderGeometry(0.05, 0.08, 1.55, 6),
        new THREE.MeshStandardNodeMaterial({ color: 3027504, roughness: 0.74 }),
        e,
      );
      l.position.y = 0.78;
      let c = fl(
        new THREE.SphereGeometry(0.18, 8, 6),
        new THREE.MeshStandardNodeMaterial({
          color: 15841391,
          emissive: 15895098,
          emissiveIntensity: 1.8,
        }),
        e,
      );
      (markBloom(c), (c.position.y = 1.62));
      let u = new THREE.PointLight(16756072, 0, GP[e], 2);
      ((u.name = `${o.id}:light`),
        (u.position.y = 1.64),
        (u.castShadow = !1),
        (u.visible = !1),
        s.add(l, c, u),
        a.push({ light: u, x: o.x, z: o.z, baseIntensity: fV }));
    }
    n.add(s);
  }
  return { root: n, targets: i, colliders: r, lights: a };
}
function VP(t, e, n, i = 0, r = 0) {
  let a = Number.isFinite(n) ? THREE.MathUtils.clamp(n, 0, 1) : 0,
    o = Number.isFinite(i) ? i : 0,
    s = Number.isFinite(r) ? r : 0,
    l = new Set(
      a <= 0.015
        ? []
        : t.lights
            .map((h, d) => ({
              index: d,
              distanceSquared: (h.x - o) ** 2 + (h.z - s) ** 2,
            }))
            .sort(
              (h, d) =>
                h.distanceSquared - d.distanceSquared || h.index - d.index,
            )
            .slice(0, pV[e])
            .map(({ index: h }) => h),
    ),
    c = qualityHasHighDetail(e) ? 1 : 0.72,
    u = 0;
  return (
    t.lights.forEach((h, d) => {
      let p = l.has(d);
      ((h.light.visible = p),
        (h.light.intensity = p ? h.baseIntensity * c * a : 0),
        (h.light.distance = GP[e]),
        (h.light.castShadow = !1),
        p && (u += 1));
    }),
    u
  );
}
function jf(t) {
  if (!Array.isArray(t)) return [];
  let e = [],
    n = new Set();
  for (let i of t) {
    if (e.length >= 64 || !i || typeof i != "object" || Array.isArray(i))
      continue;
    let r = i,
      a = typeof r.id == "string" ? (r.id.split(":").at(-1) ?? "") : "",
      o = Number(a);
    if (
      typeof r.id != "string" ||
      !vV.test(r.id) ||
      !Number.isSafeInteger(o) ||
      o < 1 ||
      o > Ic ||
      String(o) !== a ||
      n.has(r.id) ||
      typeof r.archetypeId != "string" ||
      !yV.has(r.archetypeId) ||
      typeof r.x != "number" ||
      !bx(r.y) ||
      typeof r.z != "number" ||
      typeof r.yaw != "number" ||
      ![r.x, r.y, r.z, r.yaw].every(Number.isFinite) ||
      Math.abs(r.x) > Ke ||
      Math.abs(r.z) > Ke
    )
      continue;
    let s =
      ((((r.yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
      Math.PI;
    (e.push({
      id: r.id,
      archetypeId: r.archetypeId,
      x: r.x,
      y: r.y,
      z: r.z,
      yaw: s,
    }),
      n.add(r.id));
  }
  return e;
}
function Sx(t, e, n, i) {
  let r = !1,
    a = 0;
  for (let o of t) {
    let s =
      i === void 0
        ? 0
        : Number.isFinite(i)
          ? i - o.y
          : Number.POSITIVE_INFINITY;
    if (s < mV || s > gV) continue;
    let l = Math.hypot(o.x - e, o.z - n);
    (o.archetypeId === "weather_shelter" && l <= 3.2 && (r = !0),
      o.archetypeId === "campfire" && l <= 4.5 && (a = Math.max(a, 1)));
  }
  return { sheltered: r, warmth: a };
}
var xV = /^npc:[a-z0-9][a-z0-9:._-]{0,103}$/i;
function Qf() {
  return {
    contractJournal: n3(),
    fieldGuideEntries: [],
    containerStates: {},
    placedEntities: [],
    nextPlacedSerial: 1,
    unlockedRecipeIds: [...Of],
    npcFlags: [],
    lastRestAt: null,
  };
}
function jM(t) {
  let e = t && typeof t == "object" && !Array.isArray(t) ? t : {},
    n = jf(e.placedEntities),
    i = n.reduce((d, p) => {
      let f = Number(p.id.split(":").at(-1));
      return Number.isSafeInteger(f) ? Math.max(d, f) : d;
    }, 0),
    r =
      typeof e.nextPlacedSerial == "number" &&
      Number.isSafeInteger(e.nextPlacedSerial)
        ? e.nextPlacedSerial
        : 1,
    a = new Set(
      n.map((d) => Number(d.id.split(":").at(-1))).filter(Number.isSafeInteger),
    ),
    s = ((Math.max(i + 1, r, 1) - 1) % Ic) + 1,
    l = Ic + 1;
  for (let d = 0; d <= n.length; d += 1) {
    let p = ((s - 1 + d) % Ic) + 1;
    if (!a.has(p)) {
      l = p;
      break;
    }
  }
  let c = Array.isArray(e.unlockedRecipeIds) ? e.unlockedRecipeIds : null,
    u = c
      ? [...new Set(c)]
          .filter((d) => typeof d == "string" && Of.includes(d))
          .sort()
      : [...Of],
    h = Array.isArray(e.npcFlags)
      ? [...new Set(e.npcFlags)]
          .filter((d) => typeof d == "string" && xV.test(d))
          .slice(0, 128)
          .sort()
      : [];
  return {
    contractJournal: a3(e.contractJournal),
    fieldGuideEntries: JN(e.fieldGuideEntries),
    containerStates: RN(e.containerStates),
    placedEntities: n,
    nextPlacedSerial: l,
    unlockedRecipeIds: c?.length === 0 ? [] : u.length > 0 ? u : [...Of],
    npcFlags: h,
    lastRestAt:
      typeof e.lastRestAt == "number" &&
      Number.isFinite(e.lastRestAt) &&
      e.lastRestAt >= 0
        ? Math.min(1e7, e.lastRestAt)
        : null,
  };
}
var XP = "landmark:field-unit-compound",
  $f = z3(XP),
  WP =
    $f.length > 0
      ? {
          x: $f.reduce((t, e) => t + e.frame.x, 0) / $f.length,
          z: $f.reduce((t, e) => t + e.frame.z, 0) / $f.length,
        }
      : { x: 0, z: 8 },
  Jf = {
    id: XP,
    name: "Field Unit Compound",
    kind: "landmark",
    region: "Grey Meadow",
    note: "Three restored survey structures mark the expedition's safe operating base.",
    x: WP.x,
    z: WP.z,
    radius: 54,
  },
  YP = {
    id: me.id,
    name: me.name,
    kind: "landmark",
    region: me.region,
    note: me.note,
  },
  qP = {
    id: He.id,
    name: He.name,
    kind: "landmark",
    region: He.region,
    note: He.note,
  },
  bV = Object.values(q_).map((t) => ({
    id: `biome:${t.id}`,
    name: t.name,
    kind: "biome",
    region: t.region,
    note: `Survey classification registered for ${t.name}.`,
  })),
  SV = pr.map((t) => ({
    id: `settlement:${t.id}`,
    name: t.name,
    kind: "settlement",
    region: t.tier.toUpperCase(),
    note: t.reason,
  })),
  EV = Object.freeze([Jf, YP, qP, ...bV, ...SV]),
  Ex = new Map(EV.map((t) => [t.id, t]));
function QM(t) {
  return typeof t == "string" && Ex.has(t);
}
function ZP(t) {
  return Ex.get(t) ?? null;
}
function Nc(t, e) {
  let n = pr.find((r) => Math.hypot(t - r.x, e - r.z) <= r.radius);
  if (n) return Ex.get(`settlement:${n.id}`);
  if (Math.hypot(t - Jf.x, e - Jf.z) <= Jf.radius) return Jf;
  if (W_(t, e) <= me.discoveryRadius) return YP;
  if (zN(t, e)) return qP;
  let i = ui(t, e).biome.id;
  return Ex.get(`biome:${i}`);
}
function KP(t, e) {
  return !QM(e) || t.includes(e) ? [...t] : [...t, e];
}
var _x = "stillpoint-frontier:survey:v1",
  _V = new Set(RELAYS.map((t) => t.id)),
  MV = new Set(Object.keys(ITEMS)),
  rL = /^[a-z0-9][a-z0-9:._-]{0,119}$/i,
  wV = 1e4,
  TV = 256,
  RV = 128,
  $M = 8;
function Pc() {
  return {
    version: 8,
    scanned: [],
    inventory: { ...hf },
    worldDiffs: {},
    doorStates: {},
    manualWaypoint: null,
    worldMinutes: Sc,
    horizonMode: Fs,
    player: null,
    discoveredLocations: [],
    featureProgress: Qf(),
  };
}
function jP(t) {
  let e = {};
  if (!t || typeof t != "object" || Array.isArray(t)) return e;
  for (let [n, i] of Object.entries(t).slice(0, TV))
    !rL.test(n) || typeof i != "boolean" || (e[n] = i);
  return e;
}
function JM(t) {
  return Array.isArray(t)
    ? [...new Set(t)]
        .filter((e) => typeof e == "string" && _V.has(e))
        .sort(
          (e, n) =>
            RELAYS.findIndex((i) => i.id === e) -
            RELAYS.findIndex((i) => i.id === n),
        )
    : [];
}
function QP(t) {
  let e = { ...hf };
  if (!t || typeof t != "object") return e;
  for (let [n, i] of Object.entries(t))
    MV.has(n) &&
      (!Number.isSafeInteger(i) ||
        i < 0 ||
        (e[n] = Math.min(i, ITEMS[n].stackLimit)));
  return e;
}
function $P(t) {
  let e = {};
  if (!t || typeof t != "object" || Array.isArray(t)) return e;
  for (let [n, i] of Object.entries(t).slice(0, wV)) {
    if (!rL.test(n) || !i || typeof i != "object") continue;
    let { hits: r, removed: a } = i;
    !Number.isSafeInteger(r) ||
      r < 0 ||
      r > 64 ||
      (typeof a == "boolean" && (e[n] = { hits: r, removed: a }));
  }
  return e;
}
function JP(t) {
  if (!t || typeof t != "object" || Array.isArray(t)) return null;
  let { x: e, z: n } = t;
  return typeof e != "number" ||
    typeof n != "number" ||
    !Number.isFinite(e) ||
    !Number.isFinite(n) ||
    Math.abs(e) > Ke ||
    Math.abs(n) > Ke
    ? null
    : { x: e, z: n };
}
function eL(t) {
  return typeof t != "number" || !Number.isFinite(t) || t < 0
    ? Sc
    : Math.min(t, bf);
}
function tL(t) {
  return Kg(t) ? t : Fs;
}
function nL(t) {
  if (!t || typeof t != "object" || Array.isArray(t)) return null;
  let e = t;
  if (
    typeof e.x != "number" ||
    !bx(e.y) ||
    typeof e.z != "number" ||
    typeof e.yaw != "number" ||
    !Number.isFinite(e.x) ||
    !Number.isFinite(e.z) ||
    !Number.isFinite(e.yaw) ||
    Math.abs(e.x) > Ke ||
    Math.abs(e.z) > Ke
  )
    return null;
  let n = (e.yaw + Math.PI) % (Math.PI * 2),
    i = (n < 0 ? n + Math.PI * 2 : n) - Math.PI,
    r =
      typeof e.pitch == "number" && Number.isFinite(e.pitch)
        ? Math.min(Math.PI * 0.48, Math.max(-Math.PI * 0.48, e.pitch))
        : 0,
    a = (o, s, l) =>
      typeof o == "number" && Number.isFinite(o)
        ? Math.min(l, Math.max(0, o))
        : s;
  return {
    x: e.x,
    y: e.y,
    z: e.z,
    yaw: i,
    pitch: r,
    health: a(e.health, 100, 100),
    wetness: a(e.wetness, 0, 1),
    coldStress: a(e.coldStress, 0, 1),
  };
}
function iL(t) {
  return Array.isArray(t) ? [...new Set(t)].filter(QM).slice(0, RV).sort() : [];
}
var SaveStore = class {
  constructor(e) {
    this.storage = e;
  }
  hasSave() {
    if (!this.storage) return !1;
    try {
      let e = this.storage.getItem(_x);
      if (!e) return !1;
      let n = JSON.parse(e);
      return !!(
        n &&
        typeof n == "object" &&
        Number.isSafeInteger(n.version) &&
        n.version >= 1 &&
        n.version <= $M
      );
    } catch {
      return !1;
    }
  }
  load() {
    if (!this.storage) return Pc();
    try {
      let e = this.storage.getItem(_x);
      if (!e) return Pc();
      let n = JSON.parse(e),
        i =
          typeof n.version == "number" && Number.isSafeInteger(n.version)
            ? n.version
            : 0;
      return i === 1
        ? { ...Pc(), scanned: JM(n.scanned) }
        : i < 2 || i > $M
          ? Pc()
          : {
              version: 8,
              scanned: JM(n.scanned),
              inventory: QP(n.inventory),
              worldDiffs: $P(n.worldDiffs),
              doorStates: i >= 5 ? jP(n.doorStates) : {},
              manualWaypoint: i >= 3 ? JP(n.manualWaypoint) : null,
              worldMinutes: i >= 4 ? eL(n.worldMinutes) : Sc,
              horizonMode: i >= 6 ? tL(n.horizonMode) : Fs,
              player: i >= 7 ? nL(n.player) : null,
              discoveredLocations: i >= 7 ? iL(n.discoveredLocations) : [],
              featureProgress: i >= 8 ? jM(n.featureProgress) : Qf(),
            };
    } catch {
      return Pc();
    }
  }
  save(e) {
    if (!this.storage) return !1;
    try {
      let n = this.storage.getItem(_x);
      if (n)
        try {
          let r = JSON.parse(n);
          if (Number.isSafeInteger(r?.version) && r.version > $M) return !1;
        } catch {}
      let i = {
        version: 8,
        scanned: JM(e.scanned),
        inventory: QP(e.inventory),
        worldDiffs: $P(e.worldDiffs),
        doorStates: jP(e.doorStates),
        manualWaypoint: JP(e.manualWaypoint),
        worldMinutes: eL(e.worldMinutes),
        horizonMode: tL(e.horizonMode),
        player: nL(e.player),
        discoveredLocations: iL(e.discoveredLocations),
        featureProgress: jM(e.featureProgress),
      };
      return (this.storage.setItem(_x, JSON.stringify(i)), !0);
    } catch {
      return !1;
    }
  }
  clear() {
    if (!this.storage) return !1;
    try {
      return (this.storage.removeItem(_x), !0);
    } catch {
      return !1;
    }
  }
};
var aL = "stillpoint-frontier:preferences:v1",
  PreferencesStore = class {
    constructor(e) {
      this.storage = e;
    }
    load(e = DEFAULT_SETTINGS.horizonMode) {
      if (!this.storage) return Nr(null, e);
      try {
        let n = this.storage.getItem(aL);
        if (!n) return Nr(null, e);
        let i = JSON.parse(n);
        return i.version !== 1 ? Nr(null, e) : Nr(i.settings, e);
      } catch {
        return Nr(null, e);
      }
    }
    hasSaved() {
      if (!this.storage) return !1;
      try {
        let e = this.storage.getItem(aL);
        return !!e && JSON.parse(e)?.version === 1;
      } catch {
        return !1;
      }
    }
    save(e) {
      if (!this.storage) return !1;
      try {
        let n = { version: 1, settings: Nr(e, e.horizonMode) };
        return (this.storage.setItem(aL, JSON.stringify(n)), !0);
      } catch {
        return !1;
      }
    }
  };
function oL(t, e) {
  let n = t.worldDiffs[e.id] ?? { hits: 0, removed: !1 };
  if (n.removed)
    return {
      state: { ...t },
      result: "unchanged",
      remainingHits: 0,
      loot: null,
    };
  let i = Number.isFinite(e.hitsRequired)
      ? Math.max(1, Math.floor(e.hitsRequired))
      : 1,
    r = e.action === "collect" ? i : Math.min(i, n.hits + 1),
    a = r >= i,
    o = { hits: r, removed: a },
    s = { ...t.worldDiffs, [e.id]: o };
  if (!a)
    return {
      state: { inventory: { ...t.inventory }, worldDiffs: s },
      result: "hit",
      remainingHits: i - r,
      loot: null,
    };
  let l = Number.isFinite(e.yieldAmount)
      ? Math.max(0, Math.floor(e.yieldAmount))
      : 0,
    c = uy(t.inventory, { [e.item]: l });
  return c
    ? {
        state: { inventory: c, worldDiffs: s },
        result: e.action === "collect" ? "collected" : "depleted",
        remainingHits: 0,
        loot: { item: e.item, quantity: l },
      }
    : {
        state: { ...t },
        result: "full",
        remainingHits: Math.max(0, i - n.hits),
        loot: null,
      };
}
function sL(t, e) {
  let n = structuredClone(t);
  for (let i = 0; i < 64; i += 1) {
    let r = null;
    for (let o of CONTRACTS) {
      let s = n.contracts[o.id];
      if (!s || s.status !== "active") continue;
      let l = Ta(o, s);
      if (!l) continue;
      let c = l.matcher,
        u = s.objectiveProgress[l.id] ?? 0;
      if (c.type === "scan") {
        let h =
          c.entryId ??
          e.fieldGuideEntries.find((d) => Id(d)?.category === c.category);
        h &&
          e.fieldGuideEntries.includes(h) &&
          (r = { type: "subject.scanned", entryId: h });
      } else if (c.type === "loot")
        e.containerStates[c.containerId]?.looted &&
          (r = {
            type: "container.looted",
            containerId: c.containerId,
            quantity: 1,
          });
      else if (c.type === "collect") {
        let h = Math.max(0, e.inventory[c.item] - u);
        h > 0 && (r = { type: "item.collected", item: c.item, quantity: h });
      } else if (c.type === "craft") {
        let h = Tc(c.recipeId),
          d = h && e.inventory[h.output.item] > 0,
          p =
            (c.recipeId === "recipe:bedroll:v1" &&
              e.placedEntities.some((f) => f.archetypeId === "bedroll")) ||
            (c.recipeId === "recipe:survey-marker:v1" &&
              e.placedEntities.some((f) => f.archetypeId === "survey_marker"));
        h &&
          (d || p) &&
          (r = {
            type: "item.crafted",
            recipeId: h.id,
            item: h.output.item,
            quantity: 1,
          });
      } else if (c.type === "relay")
        (e.scanned ?? []).includes(c.relayId) &&
          (r = { type: "relay.recovered", relayId: c.relayId });
      else if (c.type === "discover")
        c.locationId &&
          (e.discoveredLocations ?? []).includes(c.locationId) &&
          (r = { type: "location.discovered", locationId: c.locationId });
      else
        c.type === "place" &&
          e.placedEntities.some((h) => h.archetypeId === c.archetypeId) &&
          (r = { type: "structure.placed", archetypeId: c.archetypeId });
      if (r) break;
    }
    if (!r) break;
    let a = Cy(n, r);
    if (JSON.stringify(a) === JSON.stringify(n)) break;
    n = a;
  }
  return n;
}
function lL(t, e) {
  switch (t.action) {
    case "harvest":
      return {
        keyCode: e.harvest,
        verb: "HARVEST RESOURCE",
        detail: `${Math.max(1, t.hitsRequired - t.hits)} HITS`,
      };
    case "toggle":
      return {
        keyCode: e.interact,
        verb: t.open ? "CLOSE DOOR" : "OPEN DOOR",
        detail: null,
      };
    case "collect":
      return { keyCode: e.interact, verb: "COLLECT", detail: null };
    case "inspect":
      return { keyCode: e.interact, verb: "READ / INSPECT", detail: null };
    case "craft":
      return {
        keyCode: e.interact,
        verb: "USE FABRICATOR",
        detail: "WORKBENCH",
      };
    case "loot":
      return {
        keyCode: e.interact,
        verb: t.empty ? "SEARCH EMPTY CONTAINER" : "OPEN CONTAINER",
        detail: null,
      };
    case "rest":
      return { keyCode: e.interact, verb: "REST / WAIT", detail: null };
    case "talk":
      return { keyCode: e.interact, verb: "SPEAK TO", detail: null };
    case "scan":
      return t.fieldGuideId && !t.beaconId
        ? {
            keyCode: e.scanner,
            verb: "HOLD FIELD SCANNER",
            detail: "CATALOG SUBJECT",
          }
        : { keyCode: e.interact, verb: "RECOVER RECORD", detail: null };
  }
}
var Xd = new THREE.Vector3(),
  ew = new THREE.Vector3(),
  CV = 0.42,
  AV = 5,
  Tx = 1e-6,
  DV = new Set(["door", "inspectable", "station", "container", "rest", "npc"]),
  cL = 2.05;
function IV(t) {
  let e = t.interactionRadius;
  return typeof e != "number" || !Number.isFinite(e) || e <= 0
    ? 0
    : Math.min(e, t.maxDistance);
}
function NV(t) {
  let e = [t.id];
  return (
    t.root.name && e.push(t.root.name),
    t.doorId && e.push(`authored-door:${t.doorId}`),
    t.beaconId && e.push(`beacon:${t.beaconId}`),
    [...new Set(e)]
  );
}
function uL(t, e) {
  return e.kind !== "resource" &&
    Math.abs(e.position.y - t.camera.position.y) > cL
    ? !1
    : t.world.hasLineOfSight(t.camera.position, e.position, {
        ignoredColliderIds: NV(e),
        maxVerticalDelta: e.kind === "resource" ? 1 / 0 : cL,
        checkTerrain: !0,
        requireSameSupport: e.kind !== "resource",
      });
}
function PV(t, e, n, i) {
  let r = t.position.x - e.x,
    a = t.position.z - e.z,
    o = Math.hypot(r, a),
    s = IV(t),
    l = Math.max(0, o - s);
  if (l > t.maxDistance) return null;
  let c = o <= Tx ? 1 : (n * r + i * a) / o;
  if (c <= 0) return null;
  let u = Math.acos(THREE.MathUtils.clamp(c, -1, 1)),
    h = o <= Tx ? Math.PI / 2 : Math.asin(THREE.MathUtils.clamp(s / o, 0, 1)),
    d = Math.max(0, u - h);
  return Math.cos(d) < CV ? null : { distance: l, score: l + d * AV };
}
var InteractionSystem = class {
  constructor() {
    this.id = "interaction";
    this.order = 30;
  }
  update(e) {
    (e.input.consumePressed("Backquote") && e.toggleDeveloperPanel(),
      e.developerPanelOpen &&
        e.input.consumePressed("Escape") &&
        e.toggleDeveloperPanel(),
      e.input.consumeActionPressed("map") && e.toggleMap(),
      e.input.consumeActionPressed("inventory") && e.toggleInventory(),
      e.input.consumeActionPressed("quality") && e.toggleQuality());
    let n = e.input.consumeActionPressed("interact"),
      i = e.input.consumeActionPressed("harvest");
    if (
      ((e.nearbyTarget = null),
      (e.nearbyDistance = null),
      !e.started || e.paused)
    )
      return;
    e.camera.getWorldDirection(Xd);
    let r = Math.hypot(Xd.x, Xd.z),
      a = r > Tx ? Xd.x / r : -Math.sin(e.camera.rotation.y),
      o = r > Tx ? Xd.z / r : -Math.cos(e.camera.rotation.y),
      s = null,
      l = null,
      c = Number.POSITIVE_INFINITY;
    for (let h of e.world.targets) {
      if (h.kind === "resource") {
        let v = PV(h, e.camera.position, a, o);
        if (!v || v.score >= c || !uL(e, h)) continue;
        ((c = v.score), (s = h), (l = v.distance));
        continue;
      }
      ew.copy(h.position).sub(e.camera.position);
      let d = ew.length();
      if (d > h.maxDistance) continue;
      let p = Xd.dot(ew.normalize());
      if (p < (h.kind === "pickup" ? 0.5 : 0.58)) continue;
      let f = DV.has(h.kind) ? -0.35 : 0,
        S = d + (1 - p) * 4 + f;
      S >= c || (uL(e, h) && ((c = S), (s = h), (l = d)));
    }
    if (((e.nearbyTarget = s), (e.nearbyDistance = l), !s)) return;
    (s.action === "harvest" ? i : n) && e.performInteraction(s);
  }
};
var LV = 1.15,
  dL = new THREE.Vector3();
function OV(t) {
  ((t.scanner.active = !1),
    (t.scanner.focusId = null),
    (t.scanner.focusEntryId = null),
    (t.scanner.focusName = null),
    (t.scanner.progress = 0));
}
var ScannerSystem = class {
  constructor() {
    this.id = "field-scanner";
    this.order = 28;
  }
  update(e, n) {
    if (
      (e.input.consumeActionPressed("fieldGuide") && e.toggleOperations(),
      !e.started || e.paused || !e.input.isActionDown("scanner"))
    ) {
      OV(e);
      return;
    }
    ((e.scanner.active = !0), e.camera.getWorldDirection(dL));
    let i = e3(e.scanCandidates(), e.camera.position, dL, (o) =>
      e.world.hasLineOfSight(e.camera.position, o.position, {
        ignoredColliderIds: [o.id],
        checkTerrain: !0,
      }),
    );
    if (!i) {
      ((e.scanner.focusId = null),
        (e.scanner.focusEntryId = null),
        (e.scanner.focusName = null),
        (e.scanner.progress = 0));
      return;
    }
    let { candidate: r } = i;
    if (
      (e.scanner.focusId !== r.id &&
        ((e.scanner.focusId = r.id),
        (e.scanner.focusEntryId = r.entryId),
        (e.scanner.focusName = r.name),
        (e.scanner.progress = e.hasFieldGuideEntry(r.entryId) ? 1 : 0)),
      e.scanner.progress >= 1)
    )
      return;
    let a = Number.isFinite(n) ? Math.min(0.1, Math.max(0, n)) : 0;
    ((e.scanner.progress = Math.min(1, e.scanner.progress + a / LV)),
      e.scanner.progress >= 1 && e.completeScan(r.entryId));
  }
};
var CitizenCrowdSystem = class {
  constructor() {
    this.id = "ambient-citizen-crowd";
    this.order = 25;
  }
  update(e, n) {
    (e.citizens.setWorldMinutes(e.environment.getSample().totalMinutes),
      e.citizens.update(
        e.player.position.x,
        e.player.position.z,
        n,
        !e.started || e.paused,
      ));
  }
};
var AnimalPopulationSystem = class {
  constructor() {
    this.id = "ambient-animal-population";
    this.order = 26;
  }
  update(e, n) {
    e.animals.update(
      e.player.position.x,
      e.player.position.z,
      n,
      !e.started || e.paused,
    );
  }
};
var EquipmentSystem = class {
  constructor() {
    this.id = "player-equipment";
    this.order = 12;
  }
  update(e) {
    e.input.consumeActionPressed("flashlight") &&
      e.started &&
      !e.paused &&
      e.toggleFlashlight();
  }
};
var CameraControlSystem = class {
  constructor() {
    this.id = "camera-control";
    this.order = 11;
  }
  update(e) {
    let n = e.input.consumeCameraZoomDelta(),
      i = e.input.consumeActionPressed("cameraView");
    !e.started ||
      e.paused ||
      (n !== 0 && e.adjustCameraZoom(n), i && e.cycleCameraView());
  }
};
var AtmosphereSystem = class {
  constructor(e) {
    this.environment = e;
    this.id = "world-atmosphere";
    this.order = 5;
  }
  update(e, n) {
    this.environment.tick(
      e.player.position,
      n,
      e.started && !e.paused && !e.testMode,
    );
  }
};
var hL = 0.12,
  pL = 0.1;
function fL(t, e, n, i = 12) {
  if (!Number.isFinite(t) || !Number.isFinite(e)) return e;
  let r = Math.min(0.25, Math.max(0, n)),
    a = 1 - Math.exp(-Math.max(0, i) * r);
  return t + (e - t) * a;
}
function mL(t, e, n, i) {
  let r = Math.min(1, Math.max(0, t));
  if (n) return { stamina: Math.max(0, r - 0.24 * i), recoveryDelay: 0.65 };
  let a = Math.max(0, e - i);
  return { stamina: a === 0 ? Math.min(1, r + 0.18 * i) : r, recoveryDelay: a };
}
function gL(t, e, n, i, r = !1, a = 0) {
  let o = Math.max(0, Number.isFinite(a) ? a : 0);
  if (r && e <= 0 && t >= n && t - n <= o + 1e-6)
    return { y: n, velocity: 0, grounded: !0 };
  let s = e - 19.5 * i,
    l = t + s * i;
  return l <= n
    ? { y: n, velocity: 0, grounded: !0 }
    : { y: l, velocity: s, grounded: !1 };
}
var BV = 0.00175,
  ml = Ke - 0.42,
  PlayerControllerSystem = class {
    constructor() {
      this.id = "player-controller";
      this.order = 10;
    }
    update(e, n) {
      let i = e.input.consumeActionPressed("jump");
      if (!e.started || e.paused) {
        ((e.player.sprinting = !1), (e.player.jumpBufferRemaining = 0));
        return;
      }
      if (e.player.condition.health <= 0) {
        e.player.sprinting = !1;
        return;
      }
      if (!e.testMode && !e.input.isLocked()) return;
      let r = e.input.consumeLookDelta(),
        a = BV * e.settings.lookSensitivity;
      e.player.yaw -= r.x * a;
      let o = r.y * (e.settings.invertY ? -1 : 1);
      e.player.pitch = THREE.MathUtils.clamp(
        e.player.pitch - o * a,
        -Math.PI * 0.48,
        Math.PI * 0.48,
      );
      // Analog movement: a half-tilted stick walks slower, keys stay full speed.
      let w = e.input.moveVector(),
        s = w.x,
        l = -w.y,
        c = Math.hypot(s, l),
        k = Math.min(1, c),
        u = e.input.isActionDown("sprint"),
        h = hD(e.developerPlayer.speedMode);
      if (e.developerPlayer.fly) {
        e.player.eyeHeight = 1.72;
        let x = pD({
            inputX: s,
            inputZ: l,
            ascend: e.input.isActionDown("jump"),
            descend: e.input.isActionDown("crouch"),
            yaw: e.player.yaw,
            pitch: e.player.pitch,
          }),
          g = (u ? 10.5 : 6.4) * h,
          E = THREE.MathUtils.clamp(e.player.position.x + x.x * g * n, -ml, ml),
          M = THREE.MathUtils.clamp(e.player.position.z + x.z * g * n, -ml, ml),
          _ = e.world.sampleGroundHeight(E, M, e.player.position.y);
        (e.player.position.set(
          E,
          THREE.MathUtils.clamp(
            e.player.position.y + x.y * g * n,
            _ + 0.05,
            uD,
          ),
          M,
        ),
          (e.player.verticalVelocity = 0),
          (e.player.grounded = !1),
          (e.player.crouching = !1),
          (e.player.sprinting = !1),
          (e.player.stamina = 1),
          (e.player.staminaRecoveryDelay = 0),
          (e.player.jumpBufferRemaining = 0),
          (e.player.coyoteRemaining = 0),
          e.camera.position.set(
            e.player.position.x,
            e.player.position.y + e.player.eyeHeight,
            e.player.position.z,
          ),
          e.camera.rotation.set(e.player.pitch, e.player.yaw, 0, "YXZ"));
        return;
      }
      let d = e.input.isActionDown("crouch");
      e.player.crouching =
        d ||
        !e.world.canStandAt(
          e.player.position.x,
          e.player.position.z,
          e.player.position.y,
          0.42,
        );
      let p = e.player.crouching ? 1.08 : 1.72;
      ((e.player.eyeHeight = fL(e.player.eyeHeight, p, n)),
        (e.player.sprinting =
          c > 0.5 &&
          u &&
          !e.player.crouching &&
          e.player.grounded &&
          e.player.stamina > 0));
      let f = mL(
        e.player.stamina,
        e.player.staminaRecoveryDelay,
        e.player.sprinting,
        n,
      );
      if (
        ((e.player.stamina = f.stamina),
        (e.player.staminaRecoveryDelay = f.recoveryDelay),
        (e.player.coyoteRemaining = e.player.grounded
          ? pL
          : Math.max(0, e.player.coyoteRemaining - n)),
        (e.player.jumpBufferRemaining = i
          ? hL
          : Math.max(0, e.player.jumpBufferRemaining - n)),
        e.player.jumpBufferRemaining > 0 &&
          (e.player.grounded || e.player.coyoteRemaining > 0) &&
          !e.player.crouching &&
          e.player.stamina >= 0.08 &&
          ((e.player.verticalVelocity = 7.1),
          (e.player.grounded = !1),
          (e.player.stamina = Math.max(0, e.player.stamina - 0.08)),
          (e.player.staminaRecoveryDelay = Math.max(
            e.player.staminaRecoveryDelay,
            0.35,
          )),
          (e.player.jumpBufferRemaining = 0),
          (e.player.coyoteRemaining = 0)),
        c > 0)
      ) {
        ((s /= c), (l /= c));
        let g =
            (e.player.crouching ? 3.35 : e.player.sprinting ? 10.5 : 6.4) *
            h *
            k *
            (e.inventoryWeight() >= 72 ? 0.84 : 1),
          E = Math.sin(e.player.yaw),
          M = Math.cos(e.player.yaw),
          _ = s * M + l * E,
          b = l * M - s * E,
          T = { x: e.player.position.x, z: e.player.position.z },
          R = {
            x: THREE.MathUtils.clamp(T.x + _ * g * n, -ml, ml),
            z: THREE.MathUtils.clamp(T.z + b * g * n, -ml, ml),
          },
          C = vc(
            T,
            R,
            e.world.queryColliders(
              T,
              R,
              0.42,
              e.player.position.y,
              e.player.position.y + p,
            ),
            0.42,
          );
        ((e.player.position.x = C.x), (e.player.position.z = C.z));
      }
      let S = e.world.sampleGroundHeight(
          e.player.position.x,
          e.player.position.z,
          e.player.position.y,
        ),
        v = e.player.grounded,
        m = e.player.verticalVelocity,
        y = gL(
          e.player.position.y,
          e.player.verticalVelocity,
          S,
          n,
          e.player.grounded,
          0.22,
        );
      ((e.player.position.y = y.y),
        (e.player.verticalVelocity = y.velocity),
        (e.player.grounded = y.grounded),
        !v && y.grounded && e.applyFallImpact(Math.max(0, -(m - 19.5 * n))),
        e.camera.position.set(
          e.player.position.x,
          e.player.position.y + e.player.eyeHeight,
          e.player.position.z,
        ),
        e.camera.rotation.set(e.player.pitch, e.player.yaw, 0, "YXZ"));
    }
  };
var PlayerConditionSystem = class {
  constructor() {
    this.id = "player-condition";
    this.order = 11;
  }
  update(e, n) {
    if (
      e.input.consumeActionPressed("recover") &&
      e.player.condition.health <= 0
    ) {
      e.recoverPlayer();
      return;
    }
    if (!e.started || e.paused || e.player.condition.health <= 0) return;
    let r = e.environment.getSample();
    ((e.player.sheltered = e.world.isShelteredAt(
      e.player.position.x,
      e.player.position.z,
      e.player.position.y,
    )),
      (e.player.condition = Y3(
        e.player.condition,
        {
          sheltered: e.player.sheltered,
          precipitation: r.precipitation,
          precipitationRate: r.precipitationRate,
          temperatureC: r.temperatureC,
          windKph: r.windKph,
          stamina: e.player.stamina,
          inventoryWeight: e.inventoryWeight(),
        },
        n,
      )));
  }
};
var LocationDiscoverySystem = class {
  constructor() {
    this.id = "location-discovery";
    this.order = 24;
  }
  update(e) {
    !e.started || e.paused || e.discoverCurrentLocation();
  }
};
var EnvironmentalAudioSystem = class {
  constructor() {
    this.id = "environmental-audio";
    this.order = 46;
    this.previousX = null;
    this.previousZ = null;
    this.distanceSinceStep = 0;
    this.listenerForward = new THREE.Vector3();
    this.listenerUp = new THREE.Vector3();
  }
  update(e) {
    (e.camera.getWorldDirection(this.listenerForward),
      this.listenerUp.copy(e.camera.up).applyQuaternion(e.camera.quaternion),
      e.audio.setListenerPose({
        position: e.camera.position,
        forward: this.listenerForward,
        up: this.listenerUp,
      }));
    let n = e.environment.getSample(),
      i = ui(e.player.position.x, e.player.position.z),
      r = xc(e.player.position.x, e.player.position.z),
      a = jo(r.settlement, e.player.position.x, e.player.position.z),
      o = !e.started || e.paused;
    e.audio.updateMix(
      EP({
        windKph: n.windKph,
        precipitation: n.precipitation,
        precipitationRate: n.precipitationRate,
        night: n.night,
        biomeId: i.biome.id,
        settlementInfluence: a,
        animalActivity: e.animals.visibleCount > 0 ? 0.55 : 0,
        paused: o,
      }),
    );
    let s = e.player.position.x,
      l = e.player.position.z;
    if (this.previousX === null || this.previousZ === null || o) {
      ((this.previousX = s),
        (this.previousZ = l),
        (this.distanceSinceStep = 0));
      return;
    }
    let c = Math.hypot(s - this.previousX, l - this.previousZ);
    if (
      ((this.previousX = s),
      (this.previousZ = l),
      !e.player.grounded || c <= 1e-4)
    )
      return;
    this.distanceSinceStep += c;
    let u = MP(e.player.sprinting, e.player.crouching);
    this.distanceSinceStep < u ||
      ((this.distanceSinceStep %= u),
      e.audio.playFootstep(
        _P(i.biome.id, e.player.sheltered),
        e.player.sprinting ? 1 : e.player.crouching ? 0.55 : 0.78,
        {
          position: e.player.position,
          referenceDistance: 1.2,
          maxDistance: 12,
        },
      ));
  }
};
var NavigationUpdateSystem = class {
  constructor() {
    this.id = "navigation";
    this.order = 15;
  }
  update(e) {
    !e.started || e.paused || e.navigation.update(e.player.position);
  }
};
var WorldStreamingSystem = class {
  constructor() {
    this.id = "world-streaming";
    this.order = 20;
  }
  update(e) {
    (e.world.update(e.player.position.x, e.player.position.z),
      e.horizon.update(
        e.player.position.x,
        e.player.position.z,
        e.player.position.y,
      ));
    let n = e.environment.getSample();
    (e.world.setNightLighting(n.night),
      e.world.setWorldMinutes(n.totalMinutes));
  }
};
var INITIAL_SNAPSHOT = {
  ready: !1,
  started: !1,
  inputSource: "keyboard",
  sessionMode: "survey",
  paused: !1,
  mapOpen: !1,
  inventoryOpen: !1,
  settingsOpen: !1,
  inspectionOpen: !1,
  activeInspection: null,
  featureOverlay: null,
  devTools: {
    enabled: !1,
    panelOpen: !1,
    clockPaused: !1,
    persistentWorldMinutes: 450,
    weatherOverride: null,
    weatherOptions: weatherOptionsFor("grey_meadow"),
    graphicsFeatures: { ...DEFAULT_GRAPHICS_FEATURES },
    player: { ...ap },
  },
  contextStatus: "ready",
  camera: {
    mode: "firstPerson",
    targetDistance: 0,
    distance: 0,
    collisionLimited: !1,
    isometricAngleDegrees: Md,
    effectiveFov: DEFAULT_SETTINGS.fov,
  },
  position: { x: 0, y: 0, z: 0 },
  heading: 0,
  navigation: null,
  navigationTargets: [],
  fps: 60,
  chunk: { x: 0, z: 0 },
  loadedChunks: 0,
  drawDistanceMeters: 1840,
  horizonMode: Fs,
  horizonTiles: 0,
  horizonTriangles: 0,
  horizonSettlementInstances: 0,
  horizonSettlementLightInstances: 0,
  horizonSceneryInstances: 0,
  horizonDetailDistanceMeters: ha[DEFAULT_SETTINGS.worldDetail].detailBlendEnd,
  horizonNearCellSize: ha[DEFAULT_SETTINGS.worldDetail].nearCellSize,
  citizenCount: 0,
  citizenActivity: 0,
  animalCount: 0,
  animalSpecies: 0,
  crowdDensity: "WILDERNESS",
  triangles: 0,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  drawingBufferWidth: 0,
  drawingBufferHeight: 0,
  pixelRatio: 1,
  cpuRenderMilliseconds: 0,
  gpuRenderMilliseconds: null,
  gpuTimerSupported: !1,
  gpuTimerStatus: "unsupported",
  graphicsPipeline: {
    postProcessing: !1,
    fallback: !1,
    bloom: !1,
    gtao: !1,
    grading: !1,
    environmentReflections: !1,
  },
  graphicsBenchmark: eD(),
  forestStress: {
    id: "canopy-load-lab",
    label: "Canopy Load Lab",
    active: !1,
    level: 2,
    levelLabel: "DENSE",
    distanceMeters: -1,
    trees: 0,
    groundcover: 0,
    rocks: 0,
    reeds: 0,
    authoredInstances: 0,
    allocatedInstances: 0,
    activeLodInstances: 0,
    estimatedActiveLodTriangles: 0,
    estimatedActiveLodDrawCalls: 0,
    tiles: 0,
    nearTiles: 0,
    midTiles: 0,
    farTiles: 0,
    rebuilds: 0,
    buildMilliseconds: 0,
    renderOnly: !0,
  },
  quality: "cinematic",
  scanned: [],
  inventory: O_(),
  inventoryWeight: 0,
  inventoryItemCount: 0,
  worldChanges: 0,
  grounded: !0,
  crouching: !1,
  sprinting: !1,
  stamina: 1,
  health: 100,
  maxHealth: 100,
  wetness: 0,
  coldStress: 0,
  apparentTemperatureC: 16,
  sheltered: !1,
  conditions: [],
  incapacitated: !1,
  lastDamage: null,
  flashlightOn: !1,
  settings: {
    ...DEFAULT_SETTINGS,
    keyBindings: { ...DEFAULT_SETTINGS.keyBindings },
  },
  saveStatus: "unavailable",
  hasSurveySave: !1,
  lastSavedAt: null,
  audio: {
    available: !1,
    unlocked: !1,
    state: "uninitialized",
    cueCount: 0,
    spatialCueCount: 0,
    listenerUpdates: 0,
    lastCue: null,
  },
  scanner: {
    active: !1,
    focusId: null,
    focusEntryId: null,
    focusName: null,
    progress: 0,
  },
  contractJournal: { contracts: {}, activeContractId: null },
  fieldGuideEntryIds: [],
  containerStates: {},
  placedEntityCount: 0,
  unlockedRecipeIds: [],
  lastFeatureNotice: null,
  biome: {
    id: "grey_meadow",
    name: "Grey Meadow",
    region: "Red Basin Marches",
  },
  environment: {
    totalMinutes: 450,
    day: 1,
    hour: 7,
    minute: 30,
    phase: "day",
    weatherId: "fair",
    weatherLabel: "Meadow fair",
    precipitation: "none",
    temperatureC: 16,
    windKph: 12,
    windDirection: 0,
    visibilityMeters: 638,
    clockState: "paused",
    gameMinutesPerRealSecond: 1,
  },
  nearestSettlement: {
    id: "dustmere",
    name: "Dustmere",
    tier: "village",
    distance: 0,
    economy: "goats \xB7 dry farming \xB7 relay salvage",
    reason: "A basin settlement.",
  },
  nearbyTarget: null,
  interactionPrompt: null,
  nearbyBeacon: null,
  nearbyDistance: null,
  lastDiscovery: null,
  lastGather: null,
  lastFastTravel: null,
  currentLocation: ZP("landmark:field-unit-compound"),
  discoveredLocationIds: [],
  lastLocationDiscovery: null,
};
function xL(t, e) {
  return t.includes(e) ? [...t] : [...t, e];
}
function bL(t) {
  return RELAYS.find((e) => !t.includes(e.id)) ?? null;
}
var GV = Object.freeze([
  {
    id: "field-unit-noticeboard",
    title: "Field Unit Standing Orders",
    kicker: "OPERATIONS / NOTICE 01",
    body: "Keep the relay road clear. Record weather shifts before departure. Material gathered beyond the compound is expedition property until a fabrication bench is commissioned.",
    source: "Greywater Survey Authority",
    x: 3,
    z: 4.5,
    rotation: -0.35,
  },
  {
    id: "survey-house-ledger",
    title: "A Margin in the Survey Ledger",
    kicker: "FIELD NOTE / UNDATED",
    body: "The old roads still decide where people gather. Water explains the villages; ore explains Ironvale; the river crossing explains everything else. Follow infrastructure when the map feels empty.",
    source: "Signed only: M.",
    x: 16.4,
    z: 7.7,
    rotation: Math.PI,
  },
  {
    id: "meridian-tower-directory",
    title: "Meridian Tower Directory",
    kicker: "FACILITY INDEX / 03",
    body: "Floors 01\u201303: records. Floors 04\u201307: cartography. Floors 08\u201310: atmospheric observation. Roof access remains open to field personnel during clear wind conditions.",
    source: "Meridian Civil Survey",
    x: 4,
    z: 27.6,
    rotation: Math.PI,
  },
]);
function SL(t) {
  return GV.filter((e) => {
    let n = qn(e.x, e.z);
    return ti(n.x, n.z) === t;
  });
}
function EL(t, e) {
  let n = new THREE.Group();
  ((n.name = `inspectable:${t.id}`),
    n.position.set(t.x, je(t.x, t.z), t.z),
    (n.rotation.y = t.rotation));
  let i = new THREE.MeshStandardNodeMaterial({
      color: 2435110,
      roughness: 0.76,
      metalness: 0.28,
    }),
    r = new THREE.MeshStandardNodeMaterial({
      color: 12103056,
      roughness: 0.9,
      metalness: 0.02,
      emissive: 1844253,
      emissiveIntensity: 0.3,
    }),
    a = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 0.16), i);
  a.position.y = 0.72;
  let o = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.86, 0.08), r);
  o.position.y = 1.35;
  let s = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.055, 0.02),
    new THREE.MeshBasicNodeMaterial({ color: 12085039 }),
  );
  s.position.set(0, 1.55, 0.052);
  for (let l of [a, o])
    ((l.castShadow = qualityHasShadows(e)), (l.receiveShadow = !0));
  return (
    n.add(a, o, s),
    {
      id: `inspectable:${t.id}`,
      kind: "inspectable",
      action: "inspect",
      name: t.title,
      position: new THREE.Vector3(t.x, n.position.y + 1.35, t.z),
      root: n,
      maxDistance: 4.8,
      hitsRequired: 0,
      hits: 0,
      inspection: {
        id: t.id,
        title: t.title,
        kicker: t.kicker,
        body: t.body,
        source: t.source,
      },
    }
  );
}
var VV = (ur(`${ot}:surface-variation:v1`) % 65521) / 65521,
  WV = { building: 1.7, road: 4.3, rock: 7.9 },
  XV = {
    building: { hue: 0.008, saturation: 0.025, lightness: 0.11 },
    road: { hue: 0.004, saturation: 0.018, lightness: 0.075 },
    rock: { hue: 0.01, saturation: 0.03, lightness: 0.16 },
  },
  YV = new THREE.Color(6842983),
  qV = new THREE.Color(14211538),
  ZV = new THREE.Color(10118984),
  KV = new THREE.Color(7357235),
  jV = new THREE.Color(3484970);
function Zn(t) {
  return Number.isFinite(t) ? t : 0;
}
function _L(t, e, n = 0, i = 0) {
  let r = Zn(t),
    a = Zn(e),
    o = Math.max(0, Zn(i)),
    s = VV * Math.PI * 2 + Zn(n),
    l = 1 - THREE.MathUtils.smoothstep(o, 82, 124),
    c = Math.sin(r * 0.021 + a * 0.014 + s) * 0.5 * l,
    u = 1 - THREE.MathUtils.smoothstep(o, 58, 84),
    h = 1 - THREE.MathUtils.smoothstep(o, 18, 30),
    d = Math.cos(a * 0.037 - r * 0.011 - s * 0.71) * 0.3 * u,
    p = Math.sin((r - a) * 0.083 + s * 1.37) * 0.2 * h;
  return THREE.MathUtils.clamp((c + d + p) * 0.5 + 0.5, 0, 1);
}
function QV(t, e, n = 0) {
  let i = Zn(t),
    r = Zn(e),
    a = Math.max(0, Zn(n)),
    o = Math.max(3.5, a * 0.5),
    s = a >= 96 ? ol : a > 0 ? (u, h) => Ad(u, h, a) : je,
    l = (s(i + o, r) - s(i - o, r)) / (o * 2),
    c = (s(i, r + o) - s(i, r - o)) / (o * 2);
  return THREE.MathUtils.clamp(Math.hypot(l, c) / 1.25, 0, 1);
}
function $V(t, e, n, i = 0, r) {
  let a = Zn(t),
    o = Zn(e),
    s = Zn(n),
    l = ui(a, o);
  return {
    noise: _L(a, o, 0, i),
    slope:
      typeof r == "number" && Number.isFinite(r)
        ? THREE.MathUtils.clamp(r, 0, 1)
        : QV(a, o, i),
    moisture: l.moisture,
    elevation: THREE.MathUtils.clamp((s + 18) / 92, 0, 1),
  };
}
function Yd(t, e, n, i, r = 0, a) {
  let o = Zn(i),
    s = $V(e, n, o, r, a),
    l = ta(Zn(e), Zn(n));
  if (l > 0.001) {
    let u = xy(Zn(e), Zn(n)),
      h = THREE.MathUtils.smoothstep(u, 0.025, 0.64),
      d = THREE.MathUtils.smoothstep(u, 0.62, 0.94),
      p =
        Math.sin(l * 0.071 + s.noise * 5.4) * 0.018 +
        Math.sin(l * 0.021 - s.noise * 2.1) * 0.012;
    return (
      t.copy(ZV),
      t.lerp(KV, h * 0.92),
      t.lerp(jV, d * 0.86),
      t.offsetHSL(
        (s.noise - 0.5) * 0.01,
        -s.slope * 0.04,
        p + (s.noise - 0.5) * 0.045 - s.slope * 0.045,
      ),
      t
    );
  }
  if (o <= ci + 0.04)
    return (
      t.setHex(3561306),
      t.offsetHSL(0, -0.025, (s.noise - 0.5) * 0.035),
      t
    );
  (t.setHex(ui(Zn(e), Zn(n)).biome.color),
    t.offsetHSL(
      (s.moisture - 0.5) * -0.012,
      s.moisture * 0.045 - s.slope * 0.075,
      (s.noise - 0.5) * 0.15 - s.slope * 0.085 + s.elevation * 0.045,
    ));
  let c = FN(Zn(e), Zn(n));
  if (c > 0) {
    let u = THREE.MathUtils.clamp(oo(Zn(e), Zn(n)) / me.summitRelief, 0, 1),
      h = THREE.MathUtils.smoothstep(u, 0.08, 0.42),
      d =
        THREE.MathUtils.smoothstep(u, 0.66, 0.9) *
        THREE.MathUtils.lerp(1, 0.62, s.slope);
    (t.lerp(YV, c * h * 0.9),
      t.lerp(qV, c * d * 0.94),
      t.offsetHSL(0, -0.015, (s.noise - 0.5) * 0.055));
  }
  return t;
}
function mo(t, e, n, i, r) {
  let a = _L(i, r, WV[n]),
    o = XV[n],
    s = a - 0.5;
  return (
    t.setHex(e),
    t.offsetHSL(s * o.hue, s * o.saturation, s * o.lightness),
    t
  );
}
var JV = 4,
  iw = 5,
  kx = 0.052,
  ML = 0.048,
  wL = 0.012,
  eW = 14,
  tW = ci + 0.37,
  rw = {
    trunk: 4538940,
    regional: 5195579,
    local: 5852216,
    street: 3750454,
    trail: 6705465,
  };
function nW(t) {
  return t.kind === "street"
    ? rw.street
    : t.kind === "trail"
      ? rw.trail
      : rw[t.roadClass ?? "local"];
}
function em(t) {
  return t.kind === "street"
    ? 0.5
    : t.kind === "trail"
      ? 0.65
      : t.roadClass === "trunk"
        ? 1.15
        : t.roadClass === "regional"
          ? 0.9
          : 0.7;
}
function AL(t, e, n) {
  if (t.kind !== "road") return 0;
  let i = Math.abs(e - _a(n)) - (gi(n) + t.width * 0.55);
  return 1 - THREE.MathUtils.smoothstep(i, 0, eW);
}
function qd(t, e, n) {
  let i = je(e, n),
    r = AL(t, e, n);
  return r <= 0 ? i : THREE.MathUtils.lerp(i, Math.max(i, tW), r);
}
function TL(t, e, n, i) {
  let a = qd(e, n - 0.75, i),
    o = qd(e, n + 0.75, i),
    s = qd(e, n, i - 0.75),
    l = qd(e, n, i + 0.75);
  return t.set(a - o, 0.75 * 2, s - l).normalize();
}
function RL(t) {
  let e = ur(`${t.kind}:${t.id}`) % 3;
  return t.kind === "road"
    ? 0.008 + e * 5e-4
    : t.kind === "trail"
      ? 0.006 + e * 5e-4
      : (t.id.includes(":z:") ? 0.0045 : 0.0015) + e * 5e-4;
}
function CL(t, e, n, i, r, a, o) {
  let s = i.width * 0.5,
    l = em(i),
    c = je(r, a);
  (mo(e, nW(i), "road", r, a), Yd(n, r, a, c));
  let u = Math.abs(o),
    h =
      u <= s
        ? THREE.MathUtils.lerp(1, 0.82, u / Math.max(0.001, s))
        : THREE.MathUtils.lerp(0.82, 0.2, (u - s) / Math.max(0.001, l)),
    d = AL(i, r, a);
  return t.copy(n).lerp(e, Math.max(h, d * 0.82));
}
function DL(t) {
  let e = [],
    n = [],
    i = [],
    r = [],
    a = new THREE.Vector3(),
    o = new THREE.Color(),
    s = new THREE.Color(),
    l = new THREE.Color(),
    c = 0,
    u = 0,
    h = 0,
    d = new Map();
  for (let S of t) {
    let v = S.end.x - S.start.x,
      m = S.end.z - S.start.z,
      y = Math.hypot(v, m);
    if (!Number.isFinite(y) || y < 0.5) continue;
    let x = Math.max(2, Math.ceil(y / JV) + 1),
      g = y / (x - 1);
    h = Math.max(h, g);
    let E = v / y,
      _ = -(m / y),
      b = E,
      T = S.width * 0.5,
      R = em(S),
      C = [-T - R, -T, 0, T, T + R],
      P = e.length / 3,
      B = RL(S);
    for (let L = 0; L < x; L += 1) {
      let O = L / (x - 1),
        G = S.start.x + v * O,
        F = S.start.z + m * O;
      for (let W of C) {
        let U = G + _ * W,
          H = F + b * W,
          ne = Math.max(0, (Math.abs(W) - T) / Math.max(0.001, R)),
          ae =
            Math.max(0, 1 - Math.abs(W) / Math.max(0.001, T)) *
            (S.kind === "trail" ? wL : ML),
          _e = qd(S, U, H) + kx + ae - ne * 0.022 + B;
        (e.push(U, _e, H),
          TL(a, S, U, H).toArray(n, n.length),
          CL(o, s, l, S, U, H, W).toArray(i, i.length));
      }
    }
    for (let L = 0; L < x - 1; L += 1) {
      let O = P + L * iw,
        G = O + iw;
      for (let F = 0; F < iw - 1; F += 1) {
        let W = O + F,
          U = W + 1,
          H = G + F,
          ne = H + 1;
        r.push(W, U, ne, W, ne, H);
      }
    }
    ((c += x), (u += 1));
    for (let L of [S.capStart ? S.start : null, S.capEnd ? S.end : null]) {
      if (!L) continue;
      let O = `${Math.round(L.x * 100)}:${Math.round(L.z * 100)}`,
        G = d.get(O),
        F = G ? G.segment.width * 0.5 + em(G.segment) : 0,
        W = S.width * 0.5 + em(S);
      (!G || W > F) && d.set(O, { x: L.x, z: L.z, segment: S });
    }
  }
  let p = 12;
  for (let S of d.values()) {
    let { segment: v } = S,
      m = v.width * 0.5,
      y = em(v),
      x = e.length / 3,
      g = RL(v) + 0.014,
      E = (b, T, R, C) => {
        (e.push(b, qd(v, b, T) + C + g, T),
          TL(a, v, b, T).toArray(n, n.length),
          CL(o, s, l, v, b, T, R).toArray(i, i.length));
      };
    E(S.x, S.z, 0, kx + (v.kind === "trail" ? wL : ML));
    for (let b = 0; b < 2; b += 1) {
      let T = b === 0 ? m : m + y,
        R = b === 0 ? kx : kx - 0.022;
      for (let C = 0; C < p; C += 1) {
        let P = (C / p) * Math.PI * 2;
        E(S.x + Math.cos(P) * T, S.z + Math.sin(P) * T, T, R);
      }
    }
    let M = x + 1,
      _ = M + p;
    for (let b = 0; b < p; b += 1) {
      let T = (b + 1) % p,
        R = M + b,
        C = M + T,
        P = _ + b,
        B = _ + T;
      r.push(x, C, R, R, B, P, R, C, B);
    }
  }
  let f = new THREE.BufferGeometry();
  return (
    f.setAttribute("position", new THREE.Float32BufferAttribute(e, 3)),
    f.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3)),
    f.setAttribute("color", new THREE.Float32BufferAttribute(i, 3)),
    f.setIndex(r),
    f.computeBoundingBox(),
    f.computeBoundingSphere(),
    (f.userData.roadSurface = {
      segments: u,
      junctionPads: d.size,
      rows: c,
      vertices: e.length / 3,
      triangles: r.length / 3,
      maxStepMeters: h,
    }),
    f
  );
}
var iW = [
  {
    id: "operations-desk",
    buildingId: "field-unit",
    floor: 0,
    localX: -2.45,
    localZ: -1.65,
    width: 2.2,
    depth: 0.72,
    height: 0.82,
    color: 4934210,
    solid: !0,
  },
  {
    id: "fabrication-bench",
    buildingId: "field-unit",
    floor: 0,
    localX: -2.35,
    localZ: 1.65,
    width: 2.3,
    depth: 0.78,
    height: 0.92,
    color: 3687487,
    emissive: 1586731,
    solid: !0,
    interaction: {
      type: "craft",
      stationId: "station:field-unit-01:fabricator",
      stationKind: "workbench",
      label: "Field fabrication bench",
    },
  },
  {
    id: "field-cot",
    buildingId: "field-unit",
    floor: 0,
    localX: 0.15,
    localZ: -1.75,
    width: 1.9,
    depth: 0.76,
    height: 0.38,
    color: 6845290,
    interaction: {
      type: "rest",
      site: {
        id: "rest:field-unit-01:cot",
        label: "Field Unit cot",
        safe: !0,
        sheltered: !0,
        warmth: 0.7,
      },
    },
  },
  {
    id: "supply-locker",
    buildingId: "field-unit",
    floor: 0,
    localX: -3.3,
    localZ: 0.35,
    width: 0.78,
    depth: 0.52,
    height: 1.8,
    color: 4673869,
    solid: !0,
    interaction: {
      type: "loot",
      containerId: "container:field-unit-01:locker-a",
      tableId: "field_supplies",
      label: "Field supply locker",
    },
  },
  {
    id: "survey-desk",
    buildingId: "survey-house",
    floor: 0,
    localX: -2.8,
    localZ: -1.25,
    width: 2.4,
    depth: 0.8,
    height: 0.82,
    color: 5589821,
    solid: !0,
  },
  {
    id: "survey-archive",
    buildingId: "survey-house",
    floor: 0,
    localX: -3.7,
    localZ: 2.3,
    width: 0.62,
    depth: 2.2,
    height: 2.15,
    color: 4146755,
    solid: !0,
  },
  {
    id: "survey-bed",
    buildingId: "survey-house",
    floor: 1,
    localX: -2.7,
    localZ: -1.6,
    width: 2,
    depth: 0.82,
    height: 0.42,
    color: 7038296,
    interaction: {
      type: "rest",
      site: {
        id: "rest:survey-house:quarters",
        label: "Survey House bed",
        safe: !0,
        sheltered: !0,
        warmth: 0.8,
      },
    },
  },
  {
    id: "survey-crate",
    buildingId: "survey-house",
    floor: 1,
    localX: -3.7,
    localZ: 2.25,
    width: 1.05,
    depth: 0.8,
    height: 0.72,
    color: 6707269,
    solid: !0,
    interaction: {
      type: "loot",
      containerId: "container:survey-house:archive-a",
      tableId: "field_supplies",
      label: "Survey archive crate",
    },
  },
];
function rW() {
  return (Uy("meridian-tower")?.frame.floorYs ?? []).flatMap((e, n) => {
    let i = n <= 2 ? "records" : n <= 6 ? "cartography" : "observation",
      r = i === "records" ? 4540743 : i === "cartography" ? 4870473 : 3951440,
      a = [
        {
          id: `${i}-desk-${n + 1}`,
          buildingId: "meridian-tower",
          floor: n,
          localX: -3.7,
          localZ: -1.8,
          width: 2.4,
          depth: 0.8,
          height: 0.82,
          color: r,
          solid: !0,
        },
        {
          id: `${i}-shelf-${n + 1}`,
          buildingId: "meridian-tower",
          floor: n,
          localX: -5.2,
          localZ: 2.4,
          width: 0.58,
          depth: 2.6,
          height: 2.2,
          color: 3423034,
          solid: !0,
        },
        {
          id: `${i}-console-${n + 1}`,
          buildingId: "meridian-tower",
          floor: n,
          localX: -0.7,
          localZ: 2.7,
          width: 1.5,
          depth: 0.58,
          height: 1.05,
          color: 3358782,
          emissive: 1586477,
          solid: !0,
        },
      ];
    return (
      n === 0 &&
        a.push({
          id: "tower-service-cache",
          buildingId: "meridian-tower",
          floor: n,
          localX: 0.95,
          localZ: 2.5,
          width: 1.2,
          depth: 0.82,
          height: 0.78,
          color: 6115648,
          solid: !0,
          interaction: {
            type: "loot",
            containerId: "container:meridian-tower:service-a",
            tableId: "tower_service",
            label: "Meridian service cache",
          },
        }),
      a
    );
  });
}
var aW = Object.freeze([...iW, ...rW()]);
function oW(t, e, n, i, r, a) {
  let o = t.interaction;
  if (!o) return null;
  let s = new THREE.Vector3(n, i + Math.min(1.25, t.height), r);
  if (o.type === "craft")
    return {
      id: o.stationId,
      kind: "station",
      action: "craft",
      name: o.label,
      position: s,
      root: e,
      maxDistance: 4.5,
      hitsRequired: 0,
      hits: 0,
      stationId: o.stationId,
      stationKind: o.stationKind,
    };
  if (o.type === "rest")
    return {
      id: o.site.id,
      kind: "rest",
      action: "rest",
      name: o.site.label,
      position: s,
      root: e,
      maxDistance: 4.5,
      hitsRequired: 0,
      hits: 0,
      restSite: o.site,
    };
  let l = a[o.containerId];
  return {
    id: o.containerId,
    kind: "container",
    action: "loot",
    name: o.label,
    position: s,
    root: e,
    maxDistance: 4.5,
    hitsRequired: 0,
    hits: 0,
    containerId: o.containerId,
    lootTableId: o.tableId,
    empty: !!(l && Object.keys(l.remaining).length === 0),
  };
}
function IL(t, e, n, i) {
  let r = new THREE.Group();
  r.name = `authored-gameplay-features:${t}:v1`;
  let a = [],
    o = [];
  for (let h of aW) {
    let d = Uy(h.buildingId)?.frame;
    if (!d || d.chunkKey !== t) continue;
    let p = d.floorYs[h.floor];
    if (p === void 0) continue;
    let f = lM(d, h.localX, h.localZ),
      S = new THREE.Group();
    ((S.name = `interior:${h.buildingId}:v1:${h.id}`),
      S.position.set(f.x, p, f.z),
      (S.rotation.y = d.rotation));
    let v = new THREE.MeshStandardNodeMaterial({
        color: h.color,
        roughness: 0.9,
        metalness: h.emissive ? 0.18 : 0.04,
        emissive: h.emissive ?? 0,
        emissiveIntensity: h.emissive ? 0.65 : 0,
      }),
      m = new THREE.Mesh(new THREE.BoxGeometry(h.width, h.height, h.depth), v);
    ((m.position.y = h.height * 0.5),
      (m.castShadow = qualityHasShadows(e)),
      (m.receiveShadow = !0),
      S.add(m),
      r.add(S),
      h.solid &&
        a.push({
          shape: "box",
          id: S.name,
          x: f.x,
          z: f.z,
          halfWidth: h.width * 0.5,
          halfDepth: h.depth * 0.5,
          rotation: d.rotation,
          minY: p,
          maxY: p + h.height,
        }));
    let y = oW(h, S, f.x, p, f.z, i);
    y && o.push(y);
  }
  let s = -1.8,
    l = 3.4,
    c = qn(s, l);
  if (ti(c.x, c.z) === t) {
    let h = new THREE.Group();
    h.name = "scan-subject:field-unit-weather-mast";
    let d = je(s, l);
    h.position.set(s, d, l);
    let p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 2.7, 6),
      new THREE.MeshStandardNodeMaterial({ color: 4608077, roughness: 0.72 }),
    );
    p.position.y = 1.35;
    let f = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardNodeMaterial({
        color: 9353381,
        emissive: 2576192,
        emissiveIntensity: 1,
      }),
    );
    ((f.position.y = 2.82),
      h.add(p, f),
      r.add(h),
      o.push({
        id: "scan-subject:field-unit-weather-mast",
        kind: "scannable",
        action: "scan",
        name: "Field Unit weather mast",
        position: new THREE.Vector3(s, d + 2.2, l),
        root: h,
        maxDistance: 35,
        hitsRequired: 0,
        hits: 0,
        fieldGuideId: "guide:landmark:field-unit-weather-mast:v1",
      }));
  }
  for (let h of NPCS.filter((d) => d.residentChunkKey === t)) {
    let d = G3(h, e, n);
    (r.add(d.root), o.push(d));
  }
  return { root: r, colliders: a, targets: o };
}
var vl = {
    river_willow: {
      id: "river_willow",
      label: "Greywater willow",
      form: "willow",
      trunkColor: 4471084,
      foliageColor: 5269581,
      accentColor: 7372904,
      relativeHeight: 0.92,
      relativeWidth: 1.18,
      harvestName: "Workable willow",
    },
    grey_alder: {
      id: "grey_alder",
      label: "Grey alder",
      form: "round",
      trunkColor: 5326908,
      foliageColor: 4611141,
      accentColor: 6846043,
      relativeHeight: 0.88,
      relativeWidth: 0.96,
      harvestName: "Workable alder",
    },
    sable_pine: {
      id: "sable_pine",
      label: "Sable pine",
      form: "conifer",
      trunkColor: 3748649,
      foliageColor: 2636590,
      accentColor: 3492921,
      relativeHeight: 1,
      relativeWidth: 1,
      harvestName: "Workable sable pine",
    },
    frost_spruce: {
      id: "frost_spruce",
      label: "Frost spruce",
      form: "tiered_conifer",
      trunkColor: 3880237,
      foliageColor: 3229501,
      accentColor: 5071445,
      relativeHeight: 1.12,
      relativeWidth: 0.86,
      harvestName: "Workable frost spruce",
    },
    crown_juniper: {
      id: "crown_juniper",
      label: "Crown juniper",
      form: "columnar",
      trunkColor: 4799793,
      foliageColor: 4346438,
      accentColor: 6516834,
      relativeHeight: 0.72,
      relativeWidth: 0.72,
      harvestName: "Workable crown juniper",
    },
    ridge_birch: {
      id: "ridge_birch",
      label: "Ridge birch",
      form: "round",
      trunkColor: 11643542,
      foliageColor: 7042132,
      accentColor: 9080421,
      relativeHeight: 0.9,
      relativeWidth: 0.82,
      harvestName: "Workable ridge birch",
    },
    wind_acacia: {
      id: "wind_acacia",
      label: "Wind acacia",
      form: "acacia",
      trunkColor: 5784879,
      foliageColor: 6842438,
      accentColor: 8749146,
      relativeHeight: 0.74,
      relativeWidth: 1.2,
      harvestName: "Workable wind acacia",
    },
    steppe_juniper: {
      id: "steppe_juniper",
      label: "Steppe juniper",
      form: "columnar",
      trunkColor: 4930604,
      foliageColor: 5528380,
      accentColor: 7631694,
      relativeHeight: 0.62,
      relativeWidth: 0.7,
      harvestName: "Workable steppe juniper",
    },
    salt_cedar: {
      id: "salt_cedar",
      label: "Salt cedar",
      form: "willow",
      trunkColor: 5851450,
      foliageColor: 6910052,
      accentColor: 8751483,
      relativeHeight: 0.72,
      relativeWidth: 0.88,
      harvestName: "Workable salt cedar",
    },
    shore_pine: {
      id: "shore_pine",
      label: "Wind-bent shore pine",
      form: "conifer",
      trunkColor: 4273964,
      foliageColor: 4084039,
      accentColor: 5991261,
      relativeHeight: 0.76,
      relativeWidth: 0.86,
      harvestName: "Workable shore pine",
    },
    field_oak: {
      id: "field_oak",
      label: "Field oak",
      form: "round",
      trunkColor: 4930348,
      foliageColor: 5200701,
      accentColor: 7369809,
      relativeHeight: 0.96,
      relativeWidth: 1.14,
      harvestName: "Workable field oak",
    },
    silver_aspen: {
      id: "silver_aspen",
      label: "Silver aspen",
      form: "columnar",
      trunkColor: 11314575,
      foliageColor: 6713426,
      accentColor: 8883303,
      relativeHeight: 1.02,
      relativeWidth: 0.72,
      harvestName: "Workable silver aspen",
    },
  },
  Zd = {
    riverlands: {
      woody: ["river_willow", "grey_alder"],
      groundcover: "reeds",
      groundcoverDensity: 0.92,
      groundcoverColors: [6056010, 8025680, 9138241],
    },
    pine_forest: {
      woody: ["sable_pine", "frost_spruce"],
      groundcover: "ferns",
      groundcoverDensity: 0.72,
      groundcoverColors: [3229493, 4545086, 5924424],
    },
    crown_highlands: {
      woody: ["crown_juniper", "ridge_birch"],
      groundcover: "heather",
      groundcoverDensity: 0.48,
      groundcoverColors: [5857356, 7100769, 8679535],
    },
    warden_steppe: {
      woody: ["wind_acacia", "steppe_juniper"],
      groundcover: "sage",
      groundcoverDensity: 0.7,
      groundcoverColors: [8091224, 9141591, 6908239],
    },
    glass_badlands: {
      woody: [],
      groundcover: "succulents",
      groundcoverDensity: 0.3,
      groundcoverColors: [5858126, 7629896, 8870210],
    },
    salt_coast: {
      woody: ["salt_cedar", "shore_pine"],
      groundcover: "dune_grass",
      groundcoverDensity: 0.56,
      groundcoverColors: [8223586, 9474168, 7108191],
    },
    grey_meadow: {
      woody: ["field_oak", "silver_aspen"],
      groundcover: "meadow",
      groundcoverDensity: 1,
      groundcoverColors: [7106637, 8880986, 9269837],
    },
  },
  sW = 68;
function Bx(t, e) {
  let n = Zd[t].woody;
  if (n.length === 0) return null;
  let i = Number.isFinite(e) ? THREE.MathUtils.clamp(e, 0, 0.999999) : 0;
  return vl[n[Math.floor(i * n.length)]];
}
function ow(t, e = 1) {
  let n = Zd[t].groundcoverDensity,
    i = Number.isFinite(e) ? THREE.MathUtils.clamp(e, 0, 1) : 1;
  return Math.min(sW, Math.floor((18 + n * 50) * i));
}
function aw(t, e) {
  let n = t.index ? t.toNonIndexed() : t.clone();
  t.dispose();
  let i = new THREE.Color(e),
    r = new Float32Array(n.getAttribute("position").count * 3);
  for (let a = 0; a < r.length; a += 3)
    ((r[a] = i.r), (r[a + 1] = i.g), (r[a + 2] = i.b));
  return (n.setAttribute("color", new THREE.BufferAttribute(r, 3)), n);
}
function NL(t) {
  let e = mergeGeometries(t, !1);
  for (let n of t) n.dispose();
  if (!e) throw new Error("Vegetation geometry could not be assembled");
  return (e.computeVertexNormals(), e.computeBoundingSphere(), e);
}
function tm(t) {
  let e = [],
    n = aw(new THREE.CylinderGeometry(0.31, 0.46, 3.7, 6), t.trunkColor);
  (n.translate(0, 1.85, 0), e.push(n));
  let i = (a, o, s, l, c, u = 1, h = 1, d = 1) => {
    let p = aw(a, o);
    (p.scale(u, h, d), p.translate(s, l, c), e.push(p));
  };
  switch (t.form) {
    case "conifer":
      (i(new THREE.ConeGeometry(1.75, 4.8, 7), t.foliageColor, 0, 5, 0),
        i(new THREE.ConeGeometry(1.2, 3.2, 7), t.accentColor, 0, 6.7, 0));
      break;
    case "tiered_conifer":
      (i(new THREE.ConeGeometry(1.8, 2.5, 7), t.foliageColor, 0, 4.2, 0),
        i(new THREE.ConeGeometry(1.45, 2.7, 7), t.accentColor, 0, 5.6, 0),
        i(new THREE.ConeGeometry(1.05, 2.8, 7), t.foliageColor, 0, 7, 0));
      break;
    case "willow":
      (i(
        new THREE.DodecahedronGeometry(1.25, 0),
        t.foliageColor,
        -0.8,
        5.5,
        0,
        1.15,
        1.5,
        1,
      ),
        i(
          new THREE.DodecahedronGeometry(1.3, 0),
          t.accentColor,
          0.75,
          5.35,
          0.15,
          1.1,
          1.65,
          1.05,
        ),
        i(
          new THREE.DodecahedronGeometry(1.1, 0),
          t.foliageColor,
          0,
          6.25,
          -0.35,
          1.25,
          1.25,
          1.1,
        ));
      break;
    case "acacia":
      (i(
        new THREE.DodecahedronGeometry(1.35, 0),
        t.foliageColor,
        -0.75,
        5.05,
        0,
        1.25,
        0.55,
        1,
      ),
        i(
          new THREE.DodecahedronGeometry(1.45, 0),
          t.accentColor,
          0.75,
          5.15,
          0.1,
          1.25,
          0.58,
          1,
        ));
      break;
    case "columnar":
      (i(
        new THREE.DodecahedronGeometry(1.25, 0),
        t.foliageColor,
        0,
        4.65,
        0,
        0.85,
        1.65,
        0.85,
      ),
        i(
          new THREE.DodecahedronGeometry(0.95, 0),
          t.accentColor,
          0.15,
          6.2,
          0,
          0.75,
          1.35,
          0.75,
        ));
      break;
    case "round":
      (i(
        new THREE.DodecahedronGeometry(1.5, 0),
        t.foliageColor,
        -0.65,
        5.2,
        0,
        1.05,
        0.9,
        1,
      ),
        i(
          new THREE.DodecahedronGeometry(1.35, 0),
          t.accentColor,
          0.75,
          5.25,
          0.1,
          1.05,
          0.95,
          1,
        ),
        i(
          new THREE.DodecahedronGeometry(1.25, 0),
          t.foliageColor,
          0,
          6.1,
          -0.25,
          1,
          0.9,
          1,
        ));
      break;
  }
  let r = NL(e);
  return (
    r.scale(t.relativeWidth, t.relativeHeight, t.relativeWidth),
    _c(r, 0.42)
  );
}
function Gx(t) {
  let [e, n, i] = t.groundcoverColors,
    r = [],
    a = (o, s, l, c, u, h = 1, d = 1, p = 1) => {
      let f = aw(o, s);
      (f.scale(h, d, p), f.translate(l, c, u), r.push(f));
    };
  switch (t.groundcover) {
    case "reeds":
      for (let [o, s] of [-0.34, 0, 0.31].entries()) {
        let l = 0.82 + o * 0.16;
        (a(
          new THREE.CylinderGeometry(0.035, 0.045, l, 5),
          e,
          s,
          l / 2,
          o % 2 ? 0.15 : -0.12,
        ),
          a(
            new THREE.CapsuleGeometry(0.07, 0.22, 2, 5),
            i,
            s,
            l + 0.11,
            o % 2 ? 0.15 : -0.12,
            0.75,
            1,
            0.75,
          ));
      }
      break;
    case "ferns":
      for (let o = 0; o < 5; o += 1) {
        let s = (o / 5) * Math.PI * 2;
        a(
          new THREE.ConeGeometry(0.18, 0.88, 4),
          o % 2 ? n : e,
          Math.cos(s) * 0.22,
          0.31,
          Math.sin(s) * 0.22,
          0.75,
          0.7,
          1.8,
        );
      }
      break;
    case "succulents":
      (a(new THREE.CylinderGeometry(0.16, 0.2, 0.86, 6), e, 0, 0.43, 0),
        a(
          new THREE.CylinderGeometry(0.08, 0.1, 0.44, 5),
          n,
          0.2,
          0.43,
          0,
          1,
          1,
          1,
        ),
        a(
          new THREE.CylinderGeometry(0.08, 0.1, 0.36, 5),
          i,
          -0.18,
          0.34,
          0.06,
          1,
          1,
          1,
        ));
      break;
    case "heather":
      (a(new THREE.DodecahedronGeometry(0.36, 0), e, -0.2, 0.25, 0, 1, 0.7, 1),
        a(
          new THREE.DodecahedronGeometry(0.32, 0),
          n,
          0.2,
          0.22,
          0.08,
          1,
          0.75,
          1,
        ),
        a(new THREE.DodecahedronGeometry(0.18, 0), i, 0, 0.48, 0, 1, 0.8, 1));
      break;
    case "sage":
      (a(new THREE.IcosahedronGeometry(0.42, 0), e, -0.2, 0.28, 0, 1.1, 0.7, 1),
        a(
          new THREE.IcosahedronGeometry(0.36, 0),
          n,
          0.24,
          0.25,
          0.08,
          1.1,
          0.7,
          1,
        ));
      break;
    case "dune_grass":
    case "meadow":
      for (let o = 0; o < 6; o += 1) {
        let s = (o / 6) * Math.PI * 2,
          l = 0.46 + (o % 3) * 0.16;
        a(
          new THREE.ConeGeometry(0.075, l, 3),
          o % 3 === 2 ? i : o % 2 ? n : e,
          Math.cos(s) * 0.2,
          l / 2,
          Math.sin(s) * 0.2,
          0.7,
          1,
          0.7,
        );
      }
      break;
  }
  return _c(NL(r), 0.12);
}
function sw(t = "woody", e = THREE.FrontSide) {
  return ln(
    new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: 1,
      metalness: 0,
      flatShading: !0,
      vertexColors: !0,
      side: e,
    }),
    {
      role: "vegetation",
      weatherExposure: 0.82,
      wetRoughness: 0.62,
      environmentScale: 0.5,
      wetReflectionBoost: 0.18,
      detail: !1,
      windAmplitude: t === "woody" ? 0.42 : 0.12,
    },
  );
}
var Vx = (t) => THREE.MathUtils.clamp(Number.isFinite(t) ? t : 0, 0, 1),
  WaterSurface = class {
    constructor(e) {
      this.disposed = !1;
      this.uniforms = {
        uTime: uniform(0),
        uSunDirection: uniform(new THREE.Vector3(0, 1, 0)),
        uSunColor: uniform(new THREE.Color(16768432)),
        uSkyColor: uniform(new THREE.Color(5797506)),
        uHorizonColor: uniform(new THREE.Color(12954240)),
        uWind: uniform(new THREE.Vector2(1, 0)),
        uCloudCover: uniform(0),
        uPrecipitation: uniform(0),
        uDaylight: uniform(1),
        uDust: uniform(0),
        uDetail: uniform(qualityHasHighDetail(e) ? 1 : 0),
      };
      // Rivers and the sea share every uniform; only the palette differs, so
      // they are two materials instead of one material switched per draw.
      this.material = this.createMaterial(0);
      this.seaMaterial = this.createMaterial(1);
    }
    createMaterial(e) {
      let n = this.uniforms,
        i = new THREE.MeshBasicNodeMaterial({
          transparent: !0,
          depthWrite: !0,
          side: THREE.DoubleSide,
          fog: !0,
        });
      i.name = e ? "shared-world-sea" : "shared-world-water";
      let r = Fn(() => {
        let a = clamp(length(n.uWind), 0.2, 2.4),
          o = normalize(n.uWind.add(vec2(1e-4))),
          s = vec2(o.y.negate(), o.x),
          l = positionWorld.xz,
          c = n.uTime.mul(mix(float(0.64), float(1.28), a.sub(0.2).div(2.2))),
          u = dot(l, o).mul(0.115).add(c.mul(0.82)),
          h = dot(l, s).mul(0.173).sub(c.mul(0.53)),
          d = normalize(o.add(s.mul(0.46))),
          p = dot(l, d).mul(0.31).add(c.mul(1.19)),
          f = mix(float(0.55), float(1), n.uDetail),
          S = o
            .mul(cos(u).mul(0.052))
            .add(s.mul(cos(h).mul(0.034)))
            .add(d.mul(cos(p).mul(0.018).mul(f)))
            .mul(mix(float(0.72), float(1.36), a.sub(0.2).div(2.2)))
            .mul(float(1).add(n.uPrecipitation.mul(0.48))),
          v = normalize(vec3(S.x.negate(), 1, S.y.negate())),
          m = normalize(cameraPosition.sub(positionWorld)),
          y = pow(float(1).sub(max(dot(v, m), 0)), 4.1),
          x = e ? vec3(0.035, 0.105, 0.135) : vec3(0.055, 0.145, 0.16),
          g = e ? vec3(0.12, 0.32, 0.37) : vec3(0.19, 0.37, 0.38),
          E = sin(u)
            .mul(0.5)
            .add(sin(h).mul(0.28))
            .add(sin(p).mul(0.12)),
          M = mix(x, g, E.mul(0.12).add(0.42)).toVar(),
          _ = mix(
            n.uHorizonColor,
            n.uSkyColor,
            clamp(v.y.mul(0.72).add(y.mul(0.28)), 0, 1),
          );
        M.assign(mix(M, _, y.mul(0.52).add(0.16)));
        let b = reflect(normalize(n.uSunDirection).negate(), v),
          T = pow(
            max(dot(b, m), 0),
            mix(float(70), float(118), n.uDetail),
          )
            .mul(n.uDaylight)
            .mul(float(1).sub(n.uCloudCover.mul(0.78)));
        return (
          M.addAssign(n.uSunColor.mul(T).mul(1.75)),
          M.assign(mix(M, vec3(0.3, 0.22, 0.14), n.uDust.mul(0.16))),
          vec4(M, float(e ? 0.91 : 0.86).add(y.mul(0.045)))
        );
      })();
      return ((i.colorNode = r.rgb), (i.opacityNode = r.a), i);
    }
    present(e) {
      if (this.disposed) return;
      ((this.uniforms.uTime.value = Number.isFinite(e.effectSeconds)
        ? Math.max(0, e.effectSeconds)
        : 0),
        this.uniforms.uSunDirection.value.copy(e.sunDirection),
        this.uniforms.uSunDirection.value.lengthSq() < 1e-4
          ? this.uniforms.uSunDirection.value.set(0, 1, 0)
          : this.uniforms.uSunDirection.value.normalize(),
        this.uniforms.uSunColor.value.copy(e.sunColor),
        this.uniforms.uSkyColor.value.copy(e.skyColor),
        this.uniforms.uHorizonColor.value.copy(e.horizonColor));
      let n =
          ((Number.isFinite(e.windDirection) ? e.windDirection : 0) * Math.PI) /
          180,
        i = THREE.MathUtils.clamp(
          (Number.isFinite(e.windKph) ? e.windKph : 0) / 35,
          0.2,
          2.4,
        );
      (this.uniforms.uWind.value.set(Math.cos(n) * i, Math.sin(n) * i),
        (this.uniforms.uCloudCover.value = Vx(e.cloudCover)),
        (this.uniforms.uPrecipitation.value = Vx(e.precipitationRate)),
        (this.uniforms.uDaylight.value = Vx(e.daylight)),
        (this.uniforms.uDust.value = Vx(e.dust)));
    }
    bind(e, n) {
      ((e.userData.waterSurfaceKind = n),
        (e.material = n === "sea" ? this.seaMaterial : this.material));
    }
    setQuality(e) {
      this.disposed ||
        (this.uniforms.uDetail.value = qualityHasHighDetail(e) ? 1 : 0);
    }
    dispose() {
      this.disposed ||
        ((this.disposed = !0),
        this.material.dispose(),
        this.seaMaterial.dispose());
    }
  };
var cW = {
    megacity: { count: 44, height: 82, color: 3422518 },
    city: { count: 28, height: 38, color: 4934984 },
    town: { count: 15, height: 14, color: 6051144 },
    village: { count: 8, height: 7, color: 6708299 },
  },
  uW = {
    reeds: { id: "guide:flora:river-reed:v1", name: "Greywater reed" },
    ferns: { id: "guide:flora:sable-fern:v1", name: "Sablewood fern" },
    heather: { id: "guide:flora:crown-heather:v1", name: "Crown heather" },
    sage: { id: "guide:flora:steppe-sage:v1", name: "Warden sage" },
    succulents: {
      id: "guide:flora:badland-succulent:v1",
      name: "Glassland succulent",
    },
    dune_grass: {
      id: "guide:flora:coast-dunegrass:v1",
      name: "Salt dunegrass",
    },
    meadow: { id: "guide:flora:meadow-grass:v1", name: "Grey meadow grass" },
  },
  dW = [
    { x: 0, z: 8, radius: 4.5 },
    { x: 2.3, z: 5.4, radius: 1.1 },
    { x: 4.2, z: 0.8, radius: 2.4 },
    { x: -3.2, z: -0.4, radius: 1.45 },
    ...Ud.map(({ frame: t }) => ({
      x: t.x,
      z: t.z,
      radius: t.clearanceRadius,
    })),
  ];
function LL(t, e) {
  return t[e] ?? { hits: 0, removed: !1 };
}
var WorldStreamer = class {
  constructor(e, n, i = {}, r = {}, a = {}, o = [], s) {
    this.scene = e;
    this.quality = n;
    this.worldDiffs = i;
    this.doorStates = r;
    this.containerStates = a;
    this.loaded = new Map();
    this.activeChunkKey = "";
    this.activeChunkX = 0;
    this.activeChunkZ = 0;
    this.scanned = new Set();
    this.colliderCache = [];
    this.collisionIndex = new CollisionIndex(16);
    this.targetCache = [];
    this.nightLightingStrength = 0;
    this.worldMinutes = 450;
    this.placedRecords = [];
    this.placedLightFocusX = 0;
    this.placedLightFocusZ = 0;
    this.disposed = !1;
    ((this.materialLibrary = s ?? new WorldMaterialLibrary()),
      (this.ownsMaterialLibrary = s === void 0),
      (this.waterSurface = new WaterSurface(this.quality)),
      (this.benchmarkLake = this.createBenchmarkLake()),
      (this.canyonRiver = this.createCanyonRiver()),
      (this.sharedMaterials = new Set([
        this.waterSurface.material,
        this.waterSurface.seaMaterial,
      ])),
      (this.placedRecords = jf(o)),
      (this.placedRuntime = KM(this.placedRecords, this.quality)),
      this.materialLibrary.track(this.placedRuntime.root),
      this.scene.add(this.placedRuntime.root),
      this.scene.add(this.benchmarkLake),
      this.scene.add(this.canyonRiver));
  }
  update(e, n) {
    if (this.disposed) return !1;
    Math.hypot(e - this.placedLightFocusX, n - this.placedLightFocusZ) >= 2 &&
      ((this.placedLightFocusX = e),
      (this.placedLightFocusZ = n),
      this.applyPlacedLighting());
    let i = qn(e, n),
      r = ti(i.x, i.z);
    if (r === this.activeChunkKey && this.loaded.size > 0) return !1;
    ((this.activeChunkKey = ""),
      (this.activeChunkX = i.x),
      (this.activeChunkZ = i.z));
    let a = Dd(i, 4),
      o = new Set(a.map(({ x: s, z: l }) => ti(s, l)));
    try {
      for (let [s, l] of this.loaded)
        o.has(s) || (this.disposeChunk(l), this.loaded.delete(s));
      for (let s of a) {
        let l = ti(s.x, s.z);
        this.loaded.has(l) || this.loadChunk(s.x, s.z);
      }
      this.activeChunkKey = r;
    } finally {
      this.refreshCaches();
    }
    return !0;
  }
  setQuality(e) {
    ((this.quality = e), this.waterSurface.setQuality(e));
    let n = [
      ...[...this.loaded.values()].map((i) => i.root),
      this.placedRuntime.root,
    ];
    for (let i of n)
      i.traverse((r) => {
        if (
          (r instanceof THREE.Mesh || r instanceof THREE.InstancedMesh) &&
          ((r.castShadow = qualityHasShadows(e) && r.userData.shadow !== !1),
          r instanceof THREE.InstancedMesh &&
            r.userData.vegetationLayer === "decorative")
        ) {
          let a = Number(r.userData.highDetailCount),
            o = Number(r.userData.performanceCount),
            s = Number.isFinite(a) ? a : r.count,
            l = Number.isFinite(o) ? o : r.count;
          r.count = qualityHasHighDetail(e) ? s : l;
        }
      });
    this.applyPlacedLighting();
  }
  presentEnvironment(e) {
    (this.waterSurface.present(e), this.materialLibrary.present(e));
  }
  setWorldMinutes(e) {
    if (Number.isFinite(e)) {
      this.worldMinutes = Math.max(0, e);
      for (let n of this.loaded.values())
        for (let i of n.targets) i.kind === "npc" && By(i, this.worldMinutes);
    }
  }
  setContainerStates(e) {
    this.containerStates = Object.fromEntries(
      Object.entries(e).map(([n, i]) => [
        n,
        { opened: i.opened, looted: i.looted, remaining: { ...i.remaining } },
      ]),
    );
    for (let n of this.loaded.values())
      for (let i of n.targets) {
        if (!i.containerId) continue;
        let r = this.containerStates[i.containerId];
        ((i.empty = !!(r && Object.keys(r.remaining).length === 0)),
          this.applyContainerAppearance(i, r));
      }
    this.refreshCaches();
  }
  setPlacedEntities(e) {
    this.disposed ||
      (this.disposeObjectTree(this.placedRuntime.root),
      (this.placedRecords = jf(e)),
      (this.placedRuntime = KM(this.placedRecords, this.quality)),
      this.materialLibrary.track(this.placedRuntime.root),
      this.scene.add(this.placedRuntime.root),
      this.applyPlacedLighting(),
      this.refreshCaches());
  }
  get placedEntities() {
    return this.placedRecords.map((e) => ({ ...e }));
  }
  get scanCandidates() {
    return this.targetCache
      .filter((e) => !!e.fieldGuideId)
      .map((e) => ({
        id: e.id,
        entryId: e.fieldGuideId,
        name: e.name,
        position: { x: e.position.x, y: e.position.y, z: e.position.z },
        maxDistance: Math.max(18, e.maxDistance),
      }));
  }
  setNightLighting(e) {
    let n = Number.isFinite(e) ? THREE.MathUtils.clamp(e, 0, 1) : 0,
      i = THREE.MathUtils.smoothstep(n, 0.16, 0.92);
    if (!(Math.abs(i - this.nightLightingStrength) < 0.002)) {
      this.nightLightingStrength = i;
      for (let r of this.loaded.values())
        this.applyNightLighting(r.nightLighting);
      this.applyPlacedLighting();
    }
  }
  get nightLightingSnapshot() {
    let e = [...this.loaded.values()].flatMap(
        (i) => i.nightLighting.windowMeshes,
      ),
      n = [...this.loaded.values()].flatMap((i) => i.nightLighting.areaLights);
    return {
      strength: this.nightLightingStrength,
      windows: [...this.loaded.values()].reduce(
        (i, r) => i + r.nightLighting.windowCount,
        0,
      ),
      visibleWindowMeshes: e.filter((i) => i.visible).length,
      areaLights: n.length,
      activeAreaLights: n.filter(({ light: i }) => i.intensity > 0).length,
    };
  }
  markScanned(e) {
    this.scanned.add(e);
    let n = this.targetCache.find((i) => i.beaconId === e);
    n && this.applyScannedAppearance(n.root);
  }
  applyEntityDiff(e, n) {
    this.worldDiffs[e] = { ...n };
    let i = this.targetCache.find((r) => r.id === e);
    if (i) {
      if ((this.applyTargetVisualState(i, n), n.removed))
        for (let r of this.loaded.values())
          r.colliders = r.colliders.filter((a) => a.id !== e);
      this.refreshCaches();
    }
  }
  get colliders() {
    return this.colliderCache;
  }
  queryColliders(e, n, i, r, a) {
    let o = this.collisionIndex.querySweep(e, n, i);
    return r === void 0 && a === void 0
      ? o
      : o.filter((s) =>
          M_(s, r ?? Number.NEGATIVE_INFINITY, a ?? Number.POSITIVE_INFINITY),
        );
  }
  hasLineOfSight(e, n, i = {}) {
    if (this.disposed) return !1;
    let r = i.maxVerticalDelta ?? 1 / 0;
    if (Number.isNaN(r) || r < 0 || Math.abs(n.y - e.y) > r) return !1;
    if (i.requireSameSupport) {
      let o = i.supportTolerance ?? 0.85;
      if (!Number.isFinite(o) || o < 0) return !1;
      let s = this.sampleGroundHeight(e.x, e.z, e.y),
        l = this.sampleGroundHeight(n.x, n.z, n.y);
      if (Math.abs(l - s) > o) return !1;
    }
    let a = this.collisionIndex.querySweep(e, n, 0);
    return oN(e, n, a, new Set(i.ignoredColliderIds ?? []))
      ? i.checkTerrain === !1 || uN(e, n, je)
      : !1;
  }
  get targets() {
    return this.targetCache;
  }
  get loadedCount() {
    return this.loaded.size;
  }
  get doorsSnapshot() {
    return [...this.loaded.values()].flatMap((e) =>
      e.doors.map((n) => ({ id: n.id, open: n.isOpen })),
    );
  }
  sampleGroundHeight(e, n, i) {
    let r = Fy(e, n);
    return oM(r, i) ?? je(e, n);
  }
  sampleOverheadHeight(e, n, i) {
    return [e, n, i].every(Number.isFinite)
      ? (Fy(e, n)
          .filter((a) => Number.isFinite(a) && a >= i)
          .sort((a, o) => a - o)[0] ?? null)
      : null;
  }
  canStandAt(e, n, i, r) {
    let a = { x: e, z: n },
      o = this.queryColliders(a, a, r, i + 1.08, i + 1.72);
    return nl(a, o, r);
  }
  isShelteredAt(e, n, i) {
    return Fy(e, n).some((a) => a > i + 1.72 * 0.72)
      ? !0
      : Sx(this.placedRecords, e, n, i).sheltered;
  }
  restorePersistentState(
    e,
    n,
    i,
    r,
    a,
    o = this.containerStates,
    s = this.placedRecords,
  ) {
    for (let l of Object.keys(this.worldDiffs)) delete this.worldDiffs[l];
    Object.assign(this.worldDiffs, e);
    for (let l of Object.keys(this.doorStates)) delete this.doorStates[l];
    (Object.assign(this.doorStates, n),
      this.setContainerStates(o),
      this.setPlacedEntities(s),
      (this.scanned = new Set(i)));
    for (let l of this.loaded.values()) this.disposeChunk(l);
    (this.loaded.clear(), (this.activeChunkKey = ""), this.update(r, a));
    for (let l of i) this.markScanned(l);
  }
  toggleDoor(e, n, i) {
    for (let r of this.loaded.values()) {
      let a = r.doors.find((l) => l.id === e);
      if (!a) continue;
      let o = !a.isOpen;
      if (!o) {
        let l = a.colliderFor(!1);
        if (M_(l, n.y, n.y + 1.72) && !nl(n, [l], i)) return "blocked";
      }
      (a.setOpen(o), (this.doorStates[e] = o));
      let s = r.targets.find((l) => l.doorId === e);
      return (s && (s.open = o), this.refreshCaches(), o ? "opened" : "closed");
    }
    return null;
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (let e of this.loaded.values()) this.disposeChunk(e);
      (this.loaded.clear(),
        this.disposeObjectTree(this.placedRuntime.root),
        this.scene.remove(this.benchmarkLake),
        this.scene.remove(this.canyonRiver),
        this.benchmarkLake.geometry.dispose(),
        this.canyonRiver.geometry.dispose(),
        (this.placedRuntime = {
          root: new THREE.Group(),
          targets: [],
          colliders: [],
          lights: [],
        }),
        (this.placedRecords = []),
        this.waterSurface.dispose(),
        this.ownsMaterialLibrary && this.materialLibrary.dispose(),
        this.refreshCaches());
    }
  }
  refreshCaches() {
    if (this.disposed) {
      ((this.colliderCache = []),
        (this.targetCache = []),
        this.collisionIndex.rebuild([]));
      return;
    }
    let e = [...this.loaded.values()].filter(
        (r) =>
          Math.abs(r.chunkX - this.activeChunkX) <= 2 &&
          Math.abs(r.chunkZ - this.activeChunkZ) <= 2,
      ),
      n = this.placedRuntime.colliders.filter((r) => {
        let a = qn(r.x, r.z);
        return (
          Math.abs(a.x - this.activeChunkX) <= 2 &&
          Math.abs(a.z - this.activeChunkZ) <= 2
        );
      }),
      i = this.placedRuntime.targets.filter((r) => {
        let a = qn(r.position.x, r.position.z);
        return (
          Math.abs(a.x - this.activeChunkX) <= 2 &&
          Math.abs(a.z - this.activeChunkZ) <= 2
        );
      });
    ((this.colliderCache = [...e.flatMap((r) => r.colliders), ...n]),
      this.collisionIndex.rebuild(this.colliderCache),
      (this.targetCache = [
        ...e.flatMap((r) =>
          r.targets.filter((a) => !this.worldDiffs[a.id]?.removed),
        ),
        ...i,
      ]));
  }
  loadChunk(e, n) {
    let i = ti(e, n),
      r = fr({ x: e, z: n }),
      a = new THREE.Group();
    a.name = `chunk:${i}`;
    let o = ui(r.x, r.z),
      s = { windowMeshes: [], areaLights: [], windowCount: 0 },
      l = new THREE.PlaneGeometry(96, 96, 18, 18);
    l.rotateX(-Math.PI / 2);
    let c = l.getAttribute("position"),
      u = new Float32Array(c.count * 3),
      h = new THREE.Color();
    for (let g = 0; g < c.count; g += 1) {
      let E = r.x + c.getX(g),
        M = r.z + c.getZ(g),
        _ = je(E, M);
      (c.setY(g, _), Yd(h, E, M, _).toArray(u, g * 3));
    }
    (l.setAttribute("color", new THREE.BufferAttribute(u, 3)),
      l.computeVertexNormals());
    let d = ln(
        new THREE.MeshStandardNodeMaterial({
          color: 16777215,
          roughness: 0.96,
          metalness: 0.02,
          flatShading: !0,
          vertexColors: !0,
        }),
        {
          role: "terrain",
          weatherExposure: 1,
          wetRoughness: 0.55,
          environmentScale: 0.72,
          wetReflectionBoost: 0.48,
        },
      ),
      p = new THREE.Mesh(l, d);
    ((p.name = `terrain:${i}`),
      p.position.set(r.x, 0, r.z),
      (p.receiveShadow = !0),
      (p.userData.shadow = !1),
      a.add(p));
    let f = [],
      S = [],
      v = [];
    (this.addWater(a, r.x, r.z),
      this.addRoads(a, r.x, r.z, i),
      this.addMountainTrailhead(a, e, n, f),
      this.addCanyonOverlook(a, e, n, f));
    let m = U3(i, this.quality, this.doorStates);
    for (let g of m) {
      (a.add(g.root), f.push(...g.colliders), v.push(...g.doors));
      for (let E of g.doors) S.push(this.createDoorTarget(E));
    }
    for (let g of SL(i)) {
      let E = EL(g, this.quality);
      (a.add(E.root), S.push(E));
    }
    let y = IL(i, this.quality, this.worldMinutes, this.containerStates);
    (a.add(y.root),
      f.push(...y.colliders),
      S.push(...y.targets),
      this.addSettlementBuildings(a, r.x, r.z, i, f, s),
      this.addRockField(
        a,
        r.x,
        r.z,
        i,
        o.biome.rockDensity,
        o.biome.primaryResource,
        f,
        S,
      ),
      this.addVegetation(a, r.x, r.z, i, o.biome.id, o.biome.treeDensity, f, S),
      this.addRuinSlabs(a, r.x, r.z, i, f),
      this.addGatherables(
        a,
        r.x,
        r.z,
        i,
        o.biome.treeDensity,
        o.biome.rockDensity,
        o.biome.primaryResource,
        f,
        S,
      ));
    for (let g of RELAYS) {
      let E = qn(g.x, g.z);
      if (E.x !== e || E.z !== n) continue;
      let M = this.createBeacon(g);
      (a.add(M.root),
        S.push(M),
        f.push({
          shape: "circle",
          id: `beacon:${g.id}`,
          x: g.x,
          z: g.z,
          radius: 2.8,
          minY: M.root.position.y,
          maxY: M.root.position.y + 9.5,
        }),
        this.scanned.has(g.id) && this.applyScannedAppearance(M.root));
    }
    for (let g = f.length - 1; g >= 0; g -= 1)
      this.worldDiffs[f[g].id]?.removed && f.splice(g, 1);
    for (let g of S)
      g.containerId &&
        this.applyContainerAppearance(g, this.containerStates[g.containerId]);
    (this.materialLibrary.track(a), this.scene.add(a));
    let x = {
      key: i,
      chunkX: e,
      chunkZ: n,
      root: a,
      colliders: f,
      targets: S,
      doors: v,
      nightLighting: s,
    };
    (this.loaded.set(i, x), this.applyNightLighting(s));
  }
  createDoorTarget(e) {
    return {
      id: e.id,
      kind: "door",
      action: "toggle",
      name: e.name,
      position: e.targetPosition.clone(),
      root: e.pivot,
      maxDistance: 4.25,
      hitsRequired: 0,
      hits: 0,
      doorId: e.id,
      open: e.isOpen,
    };
  }
  findSolidPlacement(e, n, i, r, a, o, s = 96 * 0.44, l = 48) {
    let c = qn(n, i),
      u = yf(c.x, c.z);
    for (let h = 0; h < l; h += 1) {
      let d = n + Kt(e, -s, s),
        p = i + Kt(e, -s, s);
      if (
        !(Math.abs(d - _a(p)) <= gi(p) + a + 1.25) &&
        !Yl(d, p, a + 0.4) &&
        !X_(d, p, a + 0.4) &&
        !ON(d, p, a + 0.4) &&
        !Td(d, p, a + 1.25) &&
        !by(d, p, Math.max(5, a)) &&
        !(
          r === "0:0" &&
          dW.some((f) => Math.hypot(d - f.x, p - f.z) < a + f.radius)
        ) &&
        !RELAYS.some((f) => Math.hypot(d - f.x, p - f.z) < a + 3.1) &&
        !u.some((f) => My({ x: d, z: p }, f) < f.width * 0.5 + a + 1.25) &&
        nl({ x: d, z: p }, o, a + 0.2)
      )
        return { x: d, z: p };
    }
    return null;
  }
  addWater(e, n, i) {
    let r = 96 / 2,
      a = [i - r, i, i + r];
    if (a.some((l) => Math.abs(n - _a(l)) <= r + gi(l))) {
      let l = [];
      for (let h of a) {
        let d = _a(h),
          p = gi(h),
          f = Math.max(n - r, d - p),
          S = Math.min(n + r, d + p);
        l.push(f, ci, h, S, ci, h);
      }
      let c = new THREE.BufferGeometry();
      (c.setAttribute("position", new THREE.Float32BufferAttribute(l, 3)),
        c.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]),
        c.computeVertexNormals());
      let u = new THREE.Mesh(c, this.waterSurface.material);
      ((u.name = "greywater-river"),
        (u.receiveShadow = !0),
        (u.userData.shadow = !1),
        this.waterSurface.bind(u, "river"),
        e.add(u));
    }
    let s = 4900 * ei;
    if (i + r > s) {
      let l = Math.min(96, i + r - s),
        c = new THREE.PlaneGeometry(96, l);
      c.rotateX(-Math.PI / 2);
      let u = new THREE.Mesh(c, this.waterSurface.material);
      ((u.name = "salt-coast-water"),
        u.position.set(n, ci, i + r - l / 2),
        (u.userData.shadow = !1),
        this.waterSurface.bind(u, "sea"),
        e.add(u));
    }
  }
  createBenchmarkLake() {
    let e = wt,
      n = new THREE.CircleGeometry(e.lakeRadius + e.lakeSurfaceOverlap, 128);
    n.rotateX(-Math.PI / 2);
    let i = new THREE.Mesh(n, this.waterSurface.material);
    return (
      (i.name = "canopy-benchmark-lake"),
      i.position.set(
        e.center.x,
        e.lakeSurfaceY + e.lakeRenderOffset,
        e.center.z,
      ),
      (i.receiveShadow = !0),
      (i.userData.shadow = !1),
      (i.userData.benchmarkFixture = !0),
      (i.userData.persistentWorldSurface = !0),
      this.waterSurface.bind(i, "river"),
      i
    );
  }
  createCanyonRiver() {
    let e = [],
      n = [];
    for (let a = 0; a < ao.length; a += 1) {
      let o = ao[a],
        s = ao[Math.max(0, a - 1)],
        l = ao[Math.min(ao.length - 1, a + 1)],
        c = l.x - s.x,
        u = l.z - s.z,
        h = Math.max(1e-4, Math.hypot(c, u)),
        d = -u / h,
        p = c / h,
        f = je(o.x, o.z) + He.riverSurfaceLift;
      if (
        (e.push(
          o.x + d * o.halfWidth,
          f,
          o.z + p * o.halfWidth,
          o.x - d * o.halfWidth,
          f,
          o.z - p * o.halfWidth,
        ),
        a === ao.length - 1)
      )
        continue;
      let S = a * 2,
        v = S + 1,
        m = S + 2,
        y = S + 3;
      n.push(S, m, v, v, m, y);
    }
    let i = new THREE.BufferGeometry();
    (i.setAttribute("position", new THREE.Float32BufferAttribute(e, 3)),
      i.setIndex(n),
      i.computeVertexNormals(),
      i.computeBoundingBox(),
      i.computeBoundingSphere(),
      (i.userData.canyonRiver = {
        segments: ao.length - 1,
        triangles: n.length / 3,
      }));
    let r = new THREE.Mesh(i, this.waterSurface.material);
    return (
      (r.name = "sunscar-canyon-river"),
      (r.castShadow = !1),
      (r.receiveShadow = !0),
      (r.userData.shadow = !1),
      (r.userData.persistentWorldSurface = !0),
      this.waterSurface.bind(r, "river"),
      r
    );
  }
  addRoads(e, n, i, r) {
    let a = qn(n, i),
      o = yf(a.x, a.z);
    if (o.length === 0) return;
    let s = new THREE.Mesh(
      DL(o),
      ln(
        new THREE.MeshStandardNodeMaterial({
          color: 16777215,
          roughness: 0.94,
          metalness: 0.01,
          vertexColors: !0,
          polygonOffset: !0,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
        {
          role: "road",
          weatherExposure: 1,
          wetRoughness: 0.28,
          environmentScale: 0.62,
          wetReflectionBoost: 0.72,
        },
      ),
    );
    ((s.name = `roads:${r}`),
      (s.receiveShadow = !0),
      (s.userData.shadow = !1),
      (s.userData.roadSurface = s.geometry.userData.roadSurface),
      e.add(s));
  }
  addMountainTrailhead(e, n, i, r) {
    let a = me.baseWaypoint,
      o = qn(a.x, a.z);
    if (o.x !== n || o.z !== i) return;
    let s = new THREE.Group();
    ((s.name = "trailhead:crownspire"), s.position.set(a.x, je(a.x, a.z), a.z));
    let l = new THREE.MeshStandardNodeMaterial({
        color: 6645344,
        roughness: 0.96,
        metalness: 0.02,
        flatShading: !0,
      }),
      c = new THREE.MeshStandardNodeMaterial({
        color: 10967341,
        roughness: 0.8,
        metalness: 0.04,
      }),
      u = [
        { radius: 1.05, y: 0.72, yaw: 0.2 },
        { radius: 0.76, y: 1.74, yaw: 1.1 },
        { radius: 0.48, y: 2.5, yaw: 2.2 },
      ];
    for (let p of u) {
      let f = new THREE.Mesh(new THREE.DodecahedronGeometry(p.radius, 0), l);
      ((f.position.y = p.y),
        f.rotation.set(0.08, p.yaw, -0.06),
        f.scale.set(1, 0.72, 0.88),
        s.add(f));
    }
    let h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 3.6, 6), l);
    (h.position.set(1.5, 1.8, 0), s.add(h));
    let d = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.58, 0.06), c);
    (d.position.set(2.02, 3.02, 0),
      s.add(d),
      s.traverse((p) => {
        p instanceof THREE.Mesh &&
          ((p.castShadow = qualityHasShadows(this.quality)),
          (p.receiveShadow = !0));
      }),
      e.add(s),
      r.push({
        shape: "circle",
        id: me.trailheadId,
        x: a.x,
        z: a.z,
        radius: 1.7,
        minY: s.position.y,
        maxY: s.position.y + 3.7,
      }));
  }
  addCanyonOverlook(e, n, i, r) {
    let a = He.overlookWaypoint,
      o = qn(a.x, a.z);
    if (o.x !== n || o.z !== i) return;
    let s = new THREE.Group();
    ((s.name = "overlook:sunscar-canyon"),
      s.position.set(a.x, je(a.x, a.z), a.z),
      (s.rotation.y = -Math.atan2(He.axis.z, He.axis.x)));
    let l = new THREE.MeshStandardNodeMaterial({
        color: 6967618,
        roughness: 0.98,
        metalness: 0.01,
        flatShading: !0,
      }),
      c = new THREE.MeshStandardNodeMaterial({
        color: 11690806,
        roughness: 0.74,
        metalness: 0.08,
      });
    for (let d of [-3.2, 0, 3.2]) {
      let p = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.5, 0.44), l);
      (p.position.set(d, 1.25, 0), s.add(p));
    }
    let u = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 0.26), l);
    (u.position.set(0, 1.62, 0), s.add(u));
    let h = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 0.1), c);
    (h.position.set(0, 2.42, 0.27),
      s.add(h),
      s.traverse((d) => {
        d instanceof THREE.Mesh &&
          ((d.castShadow = qualityHasShadows(this.quality)),
          (d.receiveShadow = !0));
      }),
      e.add(s),
      r.push({
        shape: "box",
        id: He.overlookId,
        x: a.x,
        z: a.z,
        halfWidth: 3.7,
        halfDepth: 0.45,
        rotation: s.rotation.y,
        minY: s.position.y,
        maxY: s.position.y + 2.85,
      }));
  }
  addSettlementBuildings(e, n, i, r, a, o) {
    let s = bc(n, i, 96 * 0.72);
    for (let l of s) {
      let c = cW[l.tier],
        u = Math.max(0.08, jo(l, n, i)),
        h = Math.max(2, Math.floor(c.count * (0.35 + u * 0.65))),
        d = kt(`${ot}:chunk:${r}:settlement:${l.id}:v1`),
        p = new THREE.BoxGeometry(1, 1, 1),
        f = ln(
          new THREE.MeshStandardNodeMaterial({
            color: 16777215,
            roughness: 0.78,
            metalness: l.tier === "megacity" ? 0.22 : 0.08,
            vertexColors: !0,
          }),
          {
            role: "building",
            weatherExposure: 1,
            wetRoughness: 0.42,
            environmentScale: 0.86,
            wetReflectionBoost: 0.4,
          },
        ),
        S = new THREE.InstancedMesh(p, f, h);
      ((S.name = `settlement:${l.id}:${r}`),
        (S.castShadow = qualityHasShadows(this.quality)),
        (S.receiveShadow = !0));
      let v = new THREE.Matrix4(),
        m = new THREE.Quaternion(),
        y = new THREE.Vector3(),
        x = new THREE.Vector3(),
        g = new THREE.Color(),
        E =
          l.tier === "megacity"
            ? 5
            : l.tier === "city"
              ? 4
              : l.tier === "town"
                ? 2
                : 1,
        M = new THREE.PlaneGeometry(1, 1),
        _ = new THREE.MeshBasicNodeMaterial({
          color: 16777215,
          vertexColors: !0,
          transparent: !0,
          opacity: 0,
          depthWrite: !1,
          toneMapped: !1,
          polygonOffset: !0,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
        b = new THREE.InstancedMesh(M, _, h * E * 4);
      (markBloom(b),
        (b.name = `city-windows:${l.id}:${r}`),
        (b.castShadow = !1),
        (b.receiveShadow = !1),
        (b.userData.shadow = !1),
        (b.visible = !1),
        (b.renderOrder = 3));
      let T = kt(`${ot}:chunk:${r}:settlement:${l.id}:windows:v1`),
        R = new THREE.Matrix4(),
        C = new THREE.Quaternion(),
        P = new THREE.Vector3(),
        B = new THREE.Vector3(),
        L = new THREE.Color(),
        O = [16761711, 16768928, 11128015, 15251580],
        G =
          l.tier === "megacity"
            ? 0.72
            : l.tier === "city"
              ? 0.64
              : l.tier === "town"
                ? 0.54
                : 0.42,
        F = 0,
        W = 0;
      for (let U = 0; U < h; U += 1) {
        let H = Kt(d, 4.5, l.tier === "megacity" ? 14 : 9),
          ne = Kt(d, 4.2, l.tier === "megacity" ? 13 : 8),
          ae = this.findSolidPlacement(
            d,
            n,
            i,
            r,
            Math.hypot(H, ne) * 0.5,
            a,
            96 * 0.43,
            64,
          );
        if (!ae) continue;
        let { x: _e, z: Ue } = ae,
          ze = jo(l, _e, Ue),
          Q = Kt(d, 3.5, Math.max(5, c.height * (0.18 + ze * 0.82))),
          de = Math.round(d() * 3) * Math.PI * 0.5,
          le = je(_e, Ue);
        (y.set(_e, le + Q / 2, Ue),
          m.setFromEuler(new THREE.Euler(0, de, 0)),
          x.set(H, Q, ne),
          v.compose(y, m, x),
          S.setMatrixAt(F, v),
          S.setColorAt(F, mo(g, c.color, "building", _e, Ue)),
          a.push({
            shape: "box",
            id: `building:${l.id}:${r}:${F}`,
            x: _e,
            z: Ue,
            halfWidth: H * 0.5,
            halfDepth: ne * 0.5,
            rotation: de,
            minY: le,
            maxY: le + Q,
          }));
        let Ie = Math.min(E, Math.max(1, Math.floor(Q / 7))),
          z = THREE.MathUtils.clamp(Q * 0.035, 0.22, 0.52);
        for (let re = 0; re < Ie; re += 1) {
          let ve = le + (Q * (re + 1)) / (Ie + 1);
          for (let Pe = 0; Pe < 4; Pe += 1) {
            if (T() > G) continue;
            let lt = de + Pe * Math.PI * 0.5,
              pt = Pe % 2 === 0,
              Qe = (pt ? ne : H) * 0.5 + 0.025,
              Gt = pt ? H : ne;
            (P.set(_e + Math.sin(lt) * Qe, ve, Ue + Math.cos(lt) * Qe),
              C.setFromEuler(new THREE.Euler(0, lt, 0)),
              B.set(Gt * Kt(T, 0.42, 0.72), z, 1),
              R.compose(P, C, B),
              b.setMatrixAt(W, R),
              b.setColorAt(W, L.setHex(O[Math.floor(T() * O.length)] ?? O[0])),
              (W += 1));
          }
        }
        F += 1;
      }
      ((S.count = F),
        (S.instanceMatrix.needsUpdate = !0),
        S.instanceColor && (S.instanceColor.needsUpdate = !0),
        S.computeBoundingSphere(),
        e.add(S),
        W > 0
          ? ((b.count = W),
            (b.instanceMatrix.needsUpdate = !0),
            b.instanceColor && (b.instanceColor.needsUpdate = !0),
            b.computeBoundingSphere(),
            e.add(b),
            o.windowMeshes.push(b),
            (o.windowCount += W))
          : (M.dispose(), _.dispose(), b.dispose()),
        this.addSettlementMarker(e, l, n, i, a, o));
    }
  }
  addSettlementMarker(e, n, i, r, a, o) {
    if (Math.abs(n.x - i) > 96 / 2 || Math.abs(n.z - r) > 96 / 2) return;
    let s = n.tier === "megacity" ? 125 : n.tier === "city" ? 58 : 18,
      l = new THREE.Mesh(
        new THREE.BoxGeometry(n.tier === "megacity" ? 18 : 8, s, 8),
        ln(
          new THREE.MeshStandardNodeMaterial({
            color: 2370088,
            emissive: n.tier === "megacity" ? 1652788 : 0,
            emissiveIntensity: 0.8,
            metalness: 0.48,
            roughness: 0.5,
          }),
          {
            role: "metal",
            weatherExposure: 1,
            wetRoughness: 0.3,
            environmentScale: 1.1,
            wetReflectionBoost: 0.45,
          },
        ),
      );
    ((l.name = `landmark:${n.id}`),
      l.position.set(n.x, je(n.x, n.z) + s / 2, n.z),
      (l.castShadow = qualityHasShadows(this.quality)),
      e.add(l));
    let c =
        n.tier === "megacity"
          ? 900
          : n.tier === "city"
            ? 460
            : n.tier === "town"
              ? 190
              : 80,
      u =
        n.tier === "megacity"
          ? 380
          : n.tier === "city"
            ? 220
            : n.tier === "town"
              ? 120
              : 72,
      h = new THREE.PointLight(16760181, 0, u, 1.65);
    ((h.name = `settlement-night-light:${n.id}`),
      h.position.set(n.x, je(n.x, n.z) + Math.min(18, s * 0.32), n.z),
      (h.castShadow = !1),
      e.add(h),
      o.areaLights.push({ light: h, baseIntensity: c }),
      a.push({
        shape: "box",
        id: `landmark:${n.id}`,
        x: n.x,
        z: n.z,
        halfWidth: n.tier === "megacity" ? 9 : 4,
        halfDepth: 4,
        rotation: 0,
        minY: l.position.y - s / 2,
        maxY: l.position.y + s / 2,
      }));
  }
  applyNightLighting(e) {
    let n = this.nightLightingStrength;
    for (let i of e.windowMeshes) {
      i.visible = n > 0.015;
      let r = i.material;
      r.opacity = 0.12 + n * 0.88;
    }
    for (let { light: i, baseIntensity: r } of e.areaLights)
      ((i.intensity = r * n), (i.visible = n > 0.015));
  }
  applyPlacedLighting() {
    VP(
      this.placedRuntime,
      this.quality,
      this.nightLightingStrength,
      this.placedLightFocusX,
      this.placedLightFocusZ,
    );
  }
  addRockField(e, n, i, r, a, o, s, l) {
    let c = kt(`${ot}:chunk:${r}:rocks:v1`),
      u = Math.max(3, Math.floor(4 + a * 13 + c() * 4)),
      h = new THREE.InstancedMesh(
        new THREE.DodecahedronGeometry(1, 0),
        ln(
          new THREE.MeshStandardNodeMaterial({
            color: 16777215,
            roughness: 1,
            flatShading: !0,
            vertexColors: !0,
          }),
          {
            role: "rock",
            weatherExposure: 1,
            wetRoughness: 0.34,
            environmentScale: 0.7,
            wetReflectionBoost: 0.58,
          },
        ),
        u,
      );
    ((h.name = `rocks:${r}`),
      (h.castShadow = qualityHasShadows(this.quality)),
      (h.receiveShadow = !0));
    let d = new THREE.Matrix4(),
      p = new THREE.Quaternion(),
      f = new THREE.Vector3(),
      S = new THREE.Vector3(),
      v = new THREE.Color(),
      m = 0;
    for (let y = 0; y < u; y += 1) {
      let x = Kt(c, 0.35, 1.75),
        g = x * Kt(c, 0.72, 1.18),
        E = x * 0.72,
        M = Math.max(g, x, E),
        _ = this.findSolidPlacement(c, n, i, r, M, s);
      if (!_) continue;
      let { x: b, z: T } = _,
        R = je(b, T);
      (S.set(b, R + x * 0.42, T),
        p.setFromEuler(new THREE.Euler(c() * 2, c() * Math.PI, c())),
        f.set(g, x, E),
        d.compose(S, p, f));
      let C = m;
      (h.setMatrixAt(C, d),
        h.setColorAt(C, mo(v, o === "ore" ? 5593941 : 5064768, "rock", b, T)));
      let P = `resource:rock:v2:${r}:${y}`;
      s.push({
        shape: "circle",
        id: P,
        x: b,
        z: T,
        radius: M,
        minY: R,
        maxY: R + x * 1.5,
      });
      let B = o === "ore" ? "ore" : "stone",
        L = new THREE.Group();
      ((L.name = P),
        L.position.set(b, R, T),
        this.registerInstancedResource(l, {
          id: P,
          kind: "resource",
          action: "harvest",
          name: B === "ore" ? "Ore-bearing rock" : "Stone outcrop",
          item: B,
          yieldAmount: 3,
          hitsRequired: 3,
          hits: 0,
          maxDistance: 7.5,
          interactionRadius: M,
          position: new THREE.Vector3(b, R + x * 0.6, T),
          root: L,
          instanceVisuals: [
            {
              mesh: h,
              index: C,
              position: S.clone(),
              quaternion: p.clone(),
              scale: f.clone(),
              groundY: R,
            },
          ],
        }),
        (m += 1));
    }
    ((h.count = m),
      (h.instanceMatrix.needsUpdate = !0),
      h.instanceColor && (h.instanceColor.needsUpdate = !0),
      h.computeBoundingSphere(),
      e.add(h));
  }
  addVegetation(e, n, i, r, a, o, s, l) {
    let c = kt(`${ot}:chunk:${r}:forest:v1`),
      u = Math.floor(o * 18 + c() * 3),
      h = [],
      d = new THREE.Matrix4();
    for (let y = 0; y < u; y += 1) {
      let x = Kt(c, 0.78, 1.38),
        g = 0.42 * x,
        E = this.findSolidPlacement(c, n, i, r, g, s, 96 * 0.46);
      if (!E) continue;
      let { x: M, z: _ } = E,
        b = mf(M, _) * pf(M, _);
      if (b < 1 && c() > b) continue;
      let T = je(M, _),
        R = `resource:tree:v2:${r}:${y}`,
        C = kt(`${ot}:chunk:${r}:forest-style:v1:${y}`),
        P = Bx(a, C());
      P &&
        (s.push({
          shape: "circle",
          id: R,
          x: M,
          z: _,
          radius: g,
          minY: T,
          maxY: T + 8.6 * P.relativeHeight * x,
        }),
        h.push({
          id: R,
          x: M,
          z: _,
          baseY: T,
          size: x,
          species: P,
          quaternion: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, c() * Math.PI * 2, 0),
          ),
        }));
    }
    let p = new Map();
    for (let y of h) {
      let x = p.get(y.species.id) ?? [];
      (x.push(y), p.set(y.species.id, x));
    }
    let f = new Map();
    for (let y of p.values()) {
      let x = y[0].species,
        g = new THREE.InstancedMesh(tm(x), sw(), y.length);
      ((g.name = `forest:${r}:${x.id}`),
        (g.userData.vegetationLayer = "woody"),
        (g.userData.speciesId = x.id),
        (g.userData.shadowCandidate = !0),
        (g.castShadow = qualityHasShadows(this.quality)),
        (g.receiveShadow = !0),
        y.forEach((E, M) => {
          let _ = new THREE.Vector3(E.x, E.baseY, E.z),
            b = new THREE.Vector3(E.size, E.size, E.size);
          (d.compose(_, E.quaternion, b),
            g.setMatrixAt(M, d),
            f.set(E.id, {
              mesh: g,
              index: M,
              position: _,
              quaternion: E.quaternion.clone(),
              scale: b,
              groundY: E.baseY,
            }));
        }),
        (g.instanceMatrix.needsUpdate = !0),
        g.computeBoundingSphere(),
        e.add(g));
    }
    for (let y of h) {
      let x = f.get(y.id);
      if (!x) continue;
      let g = new THREE.Group();
      ((g.name = y.id),
        g.position.set(y.x, y.baseY, y.z),
        this.registerInstancedResource(l, {
          id: y.id,
          kind: "resource",
          action: "harvest",
          name: y.species.harvestName,
          item: "wood",
          yieldAmount: 4,
          hitsRequired: 3,
          hits: 0,
          maxDistance: 8.4,
          interactionRadius: Math.max(0.75, 1.25 * y.size),
          position: new THREE.Vector3(y.x, y.baseY + 2.2 * y.size, y.z),
          root: g,
          instanceVisuals: [x],
        }));
    }
    let S = Zd[a],
      v = ow(a, 1),
      m = ow(a, 0.52);
    if (v > 0) {
      let y = kt(`${ot}:chunk:${r}:groundcover:v1:${S.groundcover}`),
        x = new THREE.InstancedMesh(Gx(S), sw("groundcover"), v);
      ((x.name = `groundcover:${r}:${S.groundcover}`),
        (x.userData.vegetationLayer = "decorative"),
        (x.userData.groundcoverKind = S.groundcover),
        (x.castShadow = !1),
        (x.receiveShadow = !0),
        (x.userData.shadow = !1));
      let g = new THREE.Quaternion(),
        E = new THREE.Vector3(),
        M = new THREE.Vector3(),
        _ = null,
        b = 0;
      for (let T = 0; T < v; T += 1) {
        let R = this.findSolidPlacement(y, n, i, r, 0.08, s, 96 * 0.48, 20);
        if (!R) continue;
        let C = HN(R.x, R.z) * PN(R.x, R.z);
        if ((C < 1 && y() > C) || (ui(R.x, R.z).biome.id !== a && y() > 0.28))
          continue;
        let B = Kt(y, 0.7, 1.45);
        (E.set(R.x, je(R.x, R.z), R.z),
          (_ ??= E.clone()),
          g.setFromEuler(new THREE.Euler(0, y() * Math.PI * 2, 0)),
          M.set(B * Kt(y, 0.78, 1.2), B, B * Kt(y, 0.78, 1.2)),
          d.compose(E, g, M),
          x.setMatrixAt(b, d),
          (b += 1));
      }
      if (
        ((x.count = b),
        (x.userData.highDetailCount = b),
        (x.userData.performanceCount = Math.min(b, m)),
        x.computeBoundingSphere(),
        (x.count = qualityHasHighDetail(this.quality)
          ? x.userData.highDetailCount
          : x.userData.performanceCount),
        (x.instanceMatrix.needsUpdate = !0),
        e.add(x),
        _)
      ) {
        let T = uW[S.groundcover],
          R = new THREE.Group();
        ((R.name = `scan-subject:flora:${S.groundcover}:${r}`),
          R.position.copy(_),
          e.add(R),
          l.push({
            id: R.name,
            kind: "scannable",
            action: "scan",
            name: T.name,
            position: _.clone().add(new THREE.Vector3(0, 0.45, 0)),
            root: R,
            maxDistance: 15,
            hitsRequired: 0,
            hits: 0,
            fieldGuideId: T.id,
          }));
      }
    }
  }
  addRuinSlabs(e, n, i, r, a) {
    let o = kt(`${ot}:chunk:${r}:ruins:v1`),
      s = o() > 0.58 ? 3 + Math.floor(o() * 3) : 0;
    if (s === 0) return;
    let l = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.65, 5, 2.2),
      ln(
        new THREE.MeshStandardNodeMaterial({
          color: 2500645,
          roughness: 0.78,
          metalness: 0.28,
        }),
        {
          role: "building",
          weatherExposure: 1,
          wetRoughness: 0.4,
          environmentScale: 0.88,
          wetReflectionBoost: 0.45,
        },
      ),
      s,
    );
    ((l.name = `ruins:${r}`),
      (l.castShadow = qualityHasShadows(this.quality)),
      (l.receiveShadow = !0));
    let c = new THREE.Matrix4(),
      u = new THREE.Quaternion(),
      h = new THREE.Vector3(),
      d = new THREE.Vector3(),
      p = 0;
    for (let f = 0; f < s; f += 1) {
      let S = Kt(o, 0.58, 1.35),
        v = Kt(o, 0.72, 1.1),
        m = Kt(o, -0.35, 0.35),
        y = Math.hypot(0.325, 1.1 * v),
        x = this.findSolidPlacement(o, n, i, r, y, a, 32);
      if (!x) continue;
      let { x: g, z: E } = x,
        M = je(g, E);
      (d.set(g, M + 2.25 * S, E),
        u.setFromEuler(new THREE.Euler(0, m, 0)),
        h.set(1, S, v),
        c.compose(d, u, h),
        l.setMatrixAt(p, c),
        a.push({
          shape: "box",
          id: `ruin:${r}:${p}`,
          x: g,
          z: E,
          halfWidth: 0.325,
          halfDepth: 1.1 * v,
          rotation: m,
          minY: M,
          maxY: M + 5 * S,
        }),
        (p += 1));
    }
    ((l.count = p),
      (l.instanceMatrix.needsUpdate = !0),
      l.computeBoundingSphere(),
      e.add(l));
  }
  addGatherables(e, n, i, r, a, o, s, l, c) {
    let u = kt(`${ot}:chunk:${r}:pickups:v1`),
      h =
        r === "0:0"
          ? { x: 2.3, z: 5.4 }
          : this.findSolidPlacement(u, n, i, r, 0.65, l, 35),
      d = `pickup:${s}:v1:${r}:0`;
    if (
      (h && this.registerGatherable(e, c, l, this.createPickup(d, h.x, h.z, s)),
      o > 0.28)
    ) {
      let p = kt(`${ot}:chunk:${r}:resource-rock:v1`),
        f =
          r === "0:0"
            ? { x: 4.2, z: 0.8 }
            : this.findSolidPlacement(p, n, i, r, 1.56, l, 34),
        S = s === "ore" ? "ore" : "stone";
      f &&
        this.registerGatherable(
          e,
          c,
          l,
          this.createRockResource(`resource:rock:v1:${r}:0`, f.x, f.z, S),
        );
    }
    if (a > 0.15) {
      let p = kt(`${ot}:chunk:${r}:resource-tree:v1`),
        f =
          r === "0:0"
            ? { x: -3.2, z: -0.4 }
            : this.findSolidPlacement(p, n, i, r, 0.58, l, 34),
        S = f ? mf(f.x, f.z) * pf(f.x, f.z) : 0;
      f &&
        (S >= 1 || p() <= S) &&
        this.registerGatherable(
          e,
          c,
          l,
          this.createTreeResource(`resource:tree:v1:${r}:0`, f.x, f.z),
        );
    }
  }
  registerInstancedResource(e, n) {
    n.item &&
      !n.fieldGuideId &&
      (n.fieldGuideId = `guide:resource:${n.item}:v1`);
    let i = LL(this.worldDiffs, n.id);
    ((i.hits > 0 || i.removed) && this.applyTargetVisualState(n, i), e.push(n));
  }
  applyTargetVisualState(e, n) {
    e.hits = n.hits;
    let i = Math.max(0.28, 1 - (n.hits / Math.max(1, e.hitsRequired)) * 0.22);
    if (e.instanceVisuals?.length) {
      let r = new THREE.Matrix4();
      for (let a of e.instanceVisuals) {
        let o = a.position.clone(),
          s = a.scale.clone();
        (n.removed
          ? (s.setScalar(0), (o.y = a.groundY))
          : ((o.y = a.groundY + (a.position.y - a.groundY) * i), (s.y *= i)),
          r.compose(o, a.quaternion, s),
          a.mesh.setMatrixAt(a.index, r),
          (a.mesh.instanceMatrix.needsUpdate = !0));
      }
      e.root.visible = !n.removed;
      return;
    }
    ((e.root.visible = !n.removed), (e.root.scale.y = n.removed ? 1 : i));
  }
  registerGatherable(e, n, i, r) {
    r.item &&
      !r.fieldGuideId &&
      (r.fieldGuideId = `guide:resource:${r.item}:v1`);
    let a = LL(this.worldDiffs, r.id);
    ((a.hits > 0 || a.removed) && this.applyTargetVisualState(r, a),
      e.add(r.root),
      n.push(r),
      r.kind === "resource" &&
        i.push({
          shape: "circle",
          id: r.id,
          x: r.root.position.x,
          z: r.root.position.z,
          radius: r.item === "wood" ? 0.58 : 1.56,
          minY: r.root.position.y,
          maxY: r.root.position.y + (r.item === "wood" ? 8.5 : 1.8),
        }));
  }
  createPickup(e, n, i, r) {
    let a = new THREE.Group();
    ((a.name = e), a.position.set(n, je(n, i) + 0.48, i));
    let o = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardNodeMaterial({
        color: 13994565,
        emissive: 7419667,
        emissiveIntensity: 1.2,
        roughness: 0.42,
        metalness: 0.35,
      }),
    );
    return (
      o.rotation.set(0.25, 0.7, 0.1),
      (o.castShadow = qualityHasShadows(this.quality)),
      (o.receiveShadow = !0),
      a.add(o),
      {
        id: e,
        kind: "pickup",
        action: "collect",
        name: r === "relic" ? "Old-world salvage" : `Loose ${r}`,
        item: r,
        yieldAmount: 1,
        hitsRequired: 1,
        hits: 0,
        maxDistance: 5.2,
        fieldGuideId: `guide:resource:${r}:v1`,
        position: a.position.clone(),
        root: a,
      }
    );
  }
  createRockResource(e, n, i, r) {
    let a = new THREE.Group();
    ((a.name = e), a.position.set(n, je(n, i), i));
    let o = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.25, 0),
      ln(
        new THREE.MeshStandardNodeMaterial({
          color: mo(
            new THREE.Color(),
            r === "ore" ? 6120029 : 5327939,
            "rock",
            n,
            i,
          ),
          roughness: 1,
        }),
        {
          role: "rock",
          weatherExposure: 1,
          wetRoughness: 0.34,
          environmentScale: 0.72,
          wetReflectionBoost: 0.58,
        },
      ),
    );
    return (
      (o.position.y = 0.72),
      o.scale.set(1.25, 0.8, 1),
      (o.castShadow = qualityHasShadows(this.quality)),
      (o.receiveShadow = !0),
      a.add(o),
      {
        id: e,
        kind: "resource",
        action: "harvest",
        name: r === "ore" ? "Ore-bearing rock" : "Stone outcrop",
        item: r,
        yieldAmount: 3,
        hitsRequired: 3,
        hits: 0,
        maxDistance: 7.5,
        interactionRadius: 1.56,
        position: new THREE.Vector3(n, a.position.y + 0.75, i),
        root: a,
      }
    );
  }
  createTreeResource(e, n, i) {
    let r = new THREE.Group();
    ((r.name = e), r.position.set(n, je(n, i), i));
    let a = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 4, 7),
      new THREE.MeshStandardNodeMaterial({ color: 4208426, roughness: 1 }),
    );
    a.position.y = 2;
    let o = new THREE.Mesh(
      new THREE.ConeGeometry(2.15, 5.6, 7),
      new THREE.MeshStandardNodeMaterial({
        color: 2966579,
        roughness: 1,
        flatShading: !0,
      }),
    );
    o.position.y = 5.5;
    for (let s of [a, o])
      ((s.castShadow = qualityHasShadows(this.quality)),
        (s.receiveShadow = !0),
        r.add(s));
    return {
      id: e,
      kind: "resource",
      action: "harvest",
      name: "Workable pine",
      item: "wood",
      yieldAmount: 4,
      hitsRequired: 3,
      hits: 0,
      maxDistance: 8.4,
      interactionRadius: 1.25,
      position: new THREE.Vector3(n, r.position.y + 2.2, i),
      root: r,
    };
  }
  createBeacon(e) {
    let n = new THREE.Group();
    ((n.name = `beacon:${e.id}`),
      n.position.set(e.x, je(e.x, e.z), e.z),
      (n.userData.beaconId = e.id));
    let i = new THREE.MeshStandardNodeMaterial({
        color: 1514008,
        roughness: 0.55,
        metalness: 0.66,
      }),
      r = new THREE.MeshStandardNodeMaterial({
        color: 12085039,
        emissive: 10174228,
        emissiveIntensity: 1.5,
        roughness: 0.36,
        metalness: 0.35,
      }),
      a = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 0.7, 8), i);
    ((a.position.y = 0.35), n.add(a));
    let o = new THREE.Mesh(new THREE.BoxGeometry(0.82, 8.6, 0.82), i);
    ((o.position.y = 4.65), (o.rotation.y = Math.PI / 4), n.add(o));
    let s = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), r);
    (markBloom(s), (s.name = "signal-core"), (s.position.y = 8.8), n.add(s));
    let l = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.11, 8, 32), i);
    return (
      (l.position.y = 6.5),
      (l.rotation.x = Math.PI / 2),
      n.add(l),
      n.traverse((c) => {
        c instanceof THREE.Mesh &&
          ((c.castShadow = qualityHasShadows(this.quality)),
          (c.receiveShadow = !0));
      }),
      {
        id: `beacon:${e.id}`,
        kind: "beacon",
        action: "scan",
        name: e.name,
        beaconId: e.id,
        code: e.code,
        note: e.note,
        hitsRequired: 1,
        hits: 0,
        maxDistance: 6.25,
        fieldGuideId: `guide:landmark:${e.id}:v1`,
        position: new THREE.Vector3(e.x, n.position.y + 3.2, e.z),
        root: n,
      }
    );
  }
  applyScannedAppearance(e) {
    let n = e.getObjectByName("signal-core");
    if (!(n instanceof THREE.Mesh)) return;
    let i = n.material;
    (i.color.setHex(9549467),
      i.emissive.setHex(5217136),
      (i.emissiveIntensity = 2.1));
  }
  applyContainerAppearance(e, n) {
    let i = !!(n && Object.keys(n.remaining).length === 0);
    ((e.empty = i),
      (e.root.userData.opened = !!n?.opened),
      e.root.traverse((r) => {
        if (!(r instanceof THREE.Mesh)) return;
        let a = Array.isArray(r.material) ? r.material : [r.material];
        for (let o of a)
          o instanceof THREE.MeshStandardNodeMaterial &&
            (o.emissive.setHex(n?.opened ? 2107167 : 0),
            (o.emissiveIntensity = n?.opened ? (i ? 0.12 : 0.28) : 0));
      }));
  }
  disposeObjectTree(e) {
    (this.materialLibrary.untrack(e), this.scene.remove(e));
    let n = new Set(),
      i = new Set();
    e.traverse((r) => {
      if (!(r instanceof THREE.Mesh || r instanceof THREE.InstancedMesh))
        return;
      (r instanceof THREE.InstancedMesh && r.dispose(), n.add(r.geometry));
      let a = Array.isArray(r.material) ? r.material : [r.material];
      for (let o of a) this.sharedMaterials.has(o) || i.add(o);
    });
    for (let r of n) r.dispose();
    for (let r of i) r.dispose();
  }
  disposeChunk(e) {
    this.disposeObjectTree(e.root);
  }
};
function OL(t, e, n) {
  if (
    n.sceneryDensity <= 0 ||
    n.sceneryOuter <= 432 ||
    n.maxSceneryInstances <= 0
  )
    return [];
  let i = [],
    r = n.scenerySpacing,
    a = Math.floor((t - n.sceneryOuter) / r),
    o = Math.ceil((t + n.sceneryOuter) / r),
    s = Math.floor((e - n.sceneryOuter) / r),
    l = Math.ceil((e + n.sceneryOuter) / r),
    c = new THREE.Color();
  for (let u = s; u <= l; u += 1)
    for (let h = a; h <= o; h += 1) {
      let d = kt(`${ot}:scenery-lod:v1:${h}:${u}`),
        p = (h + 0.5 + (d() - 0.5) * 0.72) * r,
        f = (u + 0.5 + (d() - 0.5) * 0.72) * r,
        S = Math.max(Math.abs(p - t), Math.abs(f - e));
      if (
        S <= 432 + r * 0.28 ||
        S > n.sceneryOuter ||
        Math.abs(p) > Ke ||
        Math.abs(f) > Ke
      )
        continue;
      let v = ui(p, f);
      if (v.riverDistance <= gi(f) + 12 || Yl(p, f, 2)) continue;
      let m = Ad(p, f, n.nearCellSize);
      if (sl(p, f, 0.3)) continue;
      let y =
          v.biome.treeDensity * n.sceneryDensity * 0.44 * mf(p, f) * pf(p, f),
        x = by(p, f, n.nearCellSize * 0.5)
          ? 0
          : v.biome.rockDensity * n.sceneryDensity * 0.31,
        g = d();
      if (g < y) {
        let E = Bx(v.biome.id, d());
        if (!E) continue;
        let M = THREE.MathUtils.lerp(5.2, 10.8, d()) * E.relativeHeight;
        i.push({
          kind: "tree",
          x: p,
          y: m,
          z: f,
          yaw: d() * Math.PI * 2,
          height: M,
          width: M * THREE.MathUtils.lerp(0.2, 0.31, d()) * E.relativeWidth,
          trunkColor: E.trunkColor,
          foliageColor: d() < 0.28 ? E.accentColor : E.foliageColor,
        });
      } else if (g < y + x) {
        let E = THREE.MathUtils.lerp(0.65, 2.45, d());
        i.push({
          kind: "rock",
          x: p,
          y: m,
          z: f,
          yaw: d() * Math.PI,
          height: E,
          width: E * THREE.MathUtils.lerp(0.8, 1.75, d()),
          color: mo(c, 6117452, "rock", p, f).getHex(),
        });
      }
      if (i.length >= n.maxSceneryInstances) return i;
    }
  return i;
}
var zL = 0.08,
  hW = 18,
  lw = 8,
  pW = 320,
  yl = 24,
  nm = [0.12, 0.28, 0.46, 0.68, 0.78],
  fW = new THREE.Color(6251103),
  mW = { village: 2, town: 6, city: 12, megacity: 48 },
  gW = { village: 7695195, town: 6710365, city: 6120035, megacity: 5594465 },
  vW = { village: [4, 9], town: [7, 18], city: [14, 42], megacity: [24, 118] },
  yW = { village: 0, town: 1, city: 2, megacity: 4 };
function UL(t) {
  return THREE.MathUtils.clamp(t, -Ke, Ke);
}
function xW() {
  let t = [0, oo(me.center.x, me.center.z), 0],
    e = [];
  for (let [r, a] of nm.entries()) {
    let o = me.footprintRadius * a,
      s = r === nm.length - 1;
    for (let l = 0; l < yl; l += 1) {
      let c = (l / yl) * Math.PI * 2,
        u = Math.cos(c) * o,
        h = Math.sin(c) * o;
      t.push(u, s ? 0 : oo(me.center.x + u, me.center.z + h), h);
    }
  }
  let n = 1;
  for (let r = 0; r < yl; r += 1) {
    let a = (r + 1) % yl;
    e.push(0, n + a, n + r);
  }
  for (let r = 0; r < nm.length - 1; r += 1) {
    let a = 1 + r * yl,
      o = a + yl;
    for (let s = 0; s < yl; s += 1) {
      let l = (s + 1) % yl;
      e.push(a + s, a + l, o + s, a + l, o + l, o + s);
    }
  }
  let i = new THREE.BufferGeometry();
  return (
    i.setAttribute("position", new THREE.Float32BufferAttribute(t, 3)),
    i.setIndex(e),
    i.computeVertexNormals(),
    i.computeBoundingBox(),
    i.computeBoundingSphere(),
    (i.userData.mountainProxy = {
      triangles: e.length / 3,
      vertices: t.length / 3,
    }),
    i
  );
}
function bW(t, e, n) {
  let i = [];
  for (let a = 0; a < 4; a += 1) {
    let o = THREE.MathUtils.lerp(-n.outer, n.outer, a / 4),
      s = THREE.MathUtils.lerp(-n.outer, n.outer, (a + 1) / 4);
    i.push(
      {
        side: "north",
        tile: a,
        xMin: t + o,
        xMax: t + s,
        zMin: e - n.outer,
        zMax: e - n.inner,
      },
      {
        side: "south",
        tile: a,
        xMin: t + o,
        xMax: t + s,
        zMin: e + n.inner,
        zMax: e + n.outer,
      },
    );
    let l = THREE.MathUtils.lerp(-n.inner, n.inner, a / 4),
      c = THREE.MathUtils.lerp(-n.inner, n.inner, (a + 1) / 4);
    i.push(
      {
        side: "west",
        tile: a,
        xMin: t - n.outer,
        xMax: t - n.inner,
        zMin: e + l,
        zMax: e + c,
      },
      {
        side: "east",
        tile: a,
        xMin: t + n.inner,
        xMax: t + n.outer,
        zMin: e + l,
        zMax: e + c,
      },
    );
  }
  return i;
}
function SW(t, e, n, i, r, a) {
  let o = Math.max(Math.abs(t - n), Math.abs(e - i));
  if (o >= a.detailBlendEnd) return ol(t, e);
  let s = Ad(t, e, r),
    l = ta(t, e) > 0 ? s : Math.max(ci, s),
    c = Math.max(432, a.detailBlendEnd - Math.max(96, r * 6));
  if (o <= c) return l;
  let u = ol(t, e),
    h = THREE.MathUtils.smoothstep(o, c, a.detailBlendEnd);
  return THREE.MathUtils.lerp(l, u, h);
}
function EW(t, e, n, i, r, a, o) {
  (Yd(e, n, i, r, a, o), t.push(e.r, e.g, e.b));
}
function Yx(t, e, n, i) {
  if (t.length < 2) return;
  let r = [];
  for (let a of t) {
    let o = a * 3;
    (r.push(e.length / 3),
      e.push(e[o], e[o + 1] - hW, e[o + 2]),
      n.push(n[o] * 0.56, n[o + 1] * 0.56, n[o + 2] * 0.56));
  }
  for (let a = 0; a < t.length - 1; a += 1) {
    let o = t[a],
      s = t[a + 1],
      l = r[a],
      c = r[a + 1];
    i.push(o, l, s, s, l, c);
  }
}
function _W(t, e, n, i, r, a) {
  let o = t.xMax - t.xMin,
    s = t.zMax - t.zMin,
    l = Math.max(1, Math.round(o / e.cellSize)),
    c = Math.max(1, Math.round(s / e.cellSize)),
    u = [],
    h = [],
    d = [],
    p = new THREE.Color();
  for (let g = 0; g <= c; g += 1) {
    let E = THREE.MathUtils.lerp(t.zMin, t.zMax, g / c),
      M = UL(E);
    for (let _ = 0; _ <= l; _ += 1) {
      let b = THREE.MathUtils.lerp(t.xMin, t.xMax, _ / l),
        T = UL(b),
        R = SW(T, M, n, i, e.cellSize, a);
      u.push(T, R - zL - r, M);
    }
  }
  let f = l + 1;
  for (let g = 0; g <= c; g += 1)
    for (let E = 0; E <= l; E += 1) {
      let M = g * f + E,
        _ = g * f + Math.max(0, E - 1),
        b = g * f + Math.min(l, E + 1),
        T = Math.max(0, g - 1) * f + E,
        R = Math.min(c, g + 1) * f + E,
        C = Math.max(0.001, u[b * 3] - u[_ * 3]),
        P = Math.max(0.001, u[R * 3 + 2] - u[T * 3 + 2]),
        B = (u[b * 3 + 1] - u[_ * 3 + 1]) / C,
        L = (u[R * 3 + 1] - u[T * 3 + 1]) / P,
        O = u[M * 3 + 1] + zL + r;
      EW(
        h,
        p,
        u[M * 3],
        u[M * 3 + 2],
        O,
        e.cellSize,
        THREE.MathUtils.clamp(Math.hypot(B, L) / 1.25, 0, 1),
      );
    }
  for (let g = 0; g < c; g += 1) {
    let E = THREE.MathUtils.lerp(t.zMin, t.zMax, (g + 0.5) / c);
    if (!(E < -Ke || E > Ke))
      for (let M = 0; M < l; M += 1) {
        let _ = THREE.MathUtils.lerp(t.xMin, t.xMax, (M + 0.5) / l);
        if (_ < -Ke || _ > Ke) continue;
        let b = g * f + M,
          T = b + 1,
          R = b + f,
          C = R + 1;
        d.push(b, R, T, T, R, C);
      }
  }
  if (d.length === 0) return null;
  let S = Array.from({ length: l + 1 }, (g, E) => E),
    v = Array.from({ length: l + 1 }, (g, E) => c * f + E),
    m = Array.from({ length: c + 1 }, (g, E) => E * f),
    y = Array.from({ length: c + 1 }, (g, E) => E * f + l);
  (Yx(S, u, h, d), Yx(v, u, h, d), Yx(m, u, h, d), Yx(y, u, h, d));
  let x = new THREE.BufferGeometry();
  return (
    x.setAttribute("position", new THREE.Float32BufferAttribute(u, 3)),
    x.setAttribute("color", new THREE.Float32BufferAttribute(h, 3)),
    x.setIndex(d),
    x.computeVertexNormals(),
    x.computeBoundingBox(),
    x.computeBoundingSphere(),
    x
  );
}
function MW(t, e, n) {
  let i = [],
    r = new THREE.Color();
  for (let a of pr) {
    let o = kt(`${ot}:horizon:${a.id}:v1`),
      s = mW[a.tier],
      [l, c] = vW[a.tier];
    for (let u = 0; u < s; u += 1) {
      let h = o() * Math.PI * 2,
        d = Math.sqrt(o()) * a.radius * 0.72,
        p = a.x + Math.cos(h) * d,
        f = a.z + Math.sin(h) * d,
        S = Math.hypot(p - t, f - e);
      if (
        Math.max(Math.abs(p - t), Math.abs(f - e)) <= 504 ||
        S > n ||
        Math.abs(p) > Ke ||
        Math.abs(f) > Ke
      )
        continue;
      let m = THREE.MathUtils.lerp(l, c, o() ** 1.8),
        y = Math.max(3.2, m * THREE.MathUtils.lerp(0.16, 0.34, o())),
        x = (Math.atan2(p - t, f - e) + Math.PI * 2) % (Math.PI * 2);
      i.push({
        x: p,
        y: ol(p, f),
        z: f,
        width: y * THREE.MathUtils.lerp(0.72, 1.28, o()),
        height: m,
        depth: y * THREE.MathUtils.lerp(0.72, 1.28, o()),
        yaw: o() * Math.PI,
        color: mo(r, gW[a.tier], "building", p, f).getHex(),
        sector: Math.min(lw - 1, Math.floor((x / (Math.PI * 2)) * lw)),
        tier: a.tier,
      });
    }
  }
  return i;
}
var HorizonSystem = class {
  constructor(e, n, i = tp) {
    this.scene = e;
    this.group = new THREE.Group();
    this.terrainMaterial = new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: !0,
      vertexColors: !0,
      fog: !0,
      side: THREE.DoubleSide,
      polygonOffset: !0,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.settlementGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.settlementMaterial = new THREE.MeshLambertNodeMaterial({
      color: 16777215,
      vertexColors: !0,
      fog: !0,
    });
    // One sprite batch holds every horizon light (capped at pW): sized points
    // that WebGPU would otherwise draw at one pixel.
    this.settlementLightPositions = new Float32Array(pW * 3);
    this.settlementLightColors = new Float32Array(pW * 3);
    this.settlementLights = createPoints({
      positions: this.settlementLightPositions,
      colors: this.settlementLightColors,
      size: 1.45,
      sizeAttenuation: !1,
      material: {
        color: 16777215,
        transparent: !0,
        opacity: 0,
        depthWrite: !1,
        blending: THREE.AdditiveBlending,
        fog: !0,
        toneMapped: !1,
      },
    });
    this.settlementLights.setCount(0);
    this.settlementLights.object.name = "horizon-settlement-lights";
    this.settlementLights.object.renderOrder = -0.25;
    this.settlementLights.object.visible = !1;
    this.settlementLightMaterial = this.settlementLights.material;
    markBloomMaterial(this.settlementLightMaterial);
    this.sceneryMaterial = new THREE.MeshLambertNodeMaterial({
      color: 16777215,
      vertexColors: !0,
      fog: !0,
    });
    this.sceneryTrunkGeometry = new THREE.CylinderGeometry(0.18, 0.26, 1, 5);
    this.sceneryCrownGeometry = new THREE.ConeGeometry(1, 2, 5);
    this.sceneryRockGeometry = new THREE.DodecahedronGeometry(1, 0);
    this.mountainProxyGeometry = xW();
    this.mountainProxyMaterial = new THREE.MeshBasicNodeMaterial({
      color: 7632754,
      transparent: !0,
      opacity: 0,
      depthWrite: !1,
      fog: !1,
      side: THREE.FrontSide,
    });
    this.mountainProxy = new THREE.Mesh(
      this.mountainProxyGeometry,
      this.mountainProxyMaterial,
    );
    this.terrainRings = new Map();
    this.settlementMeshes = [];
    this.settlementLightMeshes = [];
    this.sceneryMeshes = [];
    this.anchor = null;
    this.settlementInstances = 0;
    this.settlementLightInstances = 0;
    this.horizonLightsEnabled = !0;
    this.horizonLightVisibility = 0;
    this.wetSurfacesEnabled = !0;
    this.surfaceWetness = 0;
    this.sceneryInstances = 0;
    this.mountainProxyRangeOpacity = 0;
    this.mountainProxyAtmosphereOpacity = 0.56;
    this.lastPlayerPosition = null;
    this.rebuilds = 0;
    ((this.mode = n),
      (this.detailLevel = zu(i)),
      this.settlementLightMaterial.color.setRGB(1.65, 1.35, 1.05),
      (this.group.name = "horizon-hlod"),
      (this.group.renderOrder = -1),
      (this.mountainProxy.name = `horizon-${me.id}`),
      (this.mountainProxy.castShadow = !1),
      (this.mountainProxy.receiveShadow = !1),
      (this.mountainProxy.frustumCulled = !0),
      (this.mountainProxy.renderOrder = -1.5),
      (this.mountainProxy.visible = !1),
      (this.mountainProxy.userData.shadow = !1),
      this.group.add(this.mountainProxy),
      this.scene.add(this.group));
  }
  setMode(e) {
    return e === this.mode
      ? !1
      : ((this.mode = e),
        this.anchor &&
          (this.lastPlayerPosition &&
            this.updateMountainProxy(
              this.lastPlayerPosition.x,
              this.lastPlayerPosition.z,
              this.lastPlayerPosition.y,
            ),
          this.rebuildAll()),
        !0);
  }
  setDetailLevel(e) {
    let n = zu(e);
    if (n === this.detailLevel) return !1;
    if (((this.detailLevel = n), this.anchor)) {
      let i = this.terrainRings.get(0);
      (i && (this.disposeTerrainRing(i), this.terrainRings.delete(0)),
        this.reconcileTerrainRings(),
        this.rebuildScenery(),
        (this.rebuilds += 1));
    }
    return !0;
  }
  setGraphicsFeatures(e) {
    let n = this.horizonLightsEnabled !== e.horizonLights,
      i = this.wetSurfacesEnabled !== e.wetSurfaces;
    (!n && !i) ||
      ((this.horizonLightsEnabled = e.horizonLights),
      (this.wetSurfacesEnabled = e.wetSurfaces),
      n && this.updateHorizonLightPresentation(),
      i && this.updateTerrainWetness());
  }
  presentEnvironment(e) {
    ((this.surfaceWetness = THREE.MathUtils.clamp(
      Number.isFinite(e.surfaceWetness) ? e.surfaceWetness : 0,
      0,
      1,
    )),
      this.updateTerrainWetness());
    let n = THREE.MathUtils.clamp(Number.isFinite(e.night) ? e.night : 0, 0, 1),
      i = THREE.MathUtils.clamp(
        Number.isFinite(e.cloudCover) ? e.cloudCover : 0,
        0,
        1,
      );
    ((this.horizonLightVisibility = THREE.MathUtils.clamp(
      ((n - 0.06) / 0.7) * (1 + i * 0.12),
      0,
      1,
    )),
      this.updateHorizonLightPresentation());
    let r = THREE.MathUtils.clamp(Number.isFinite(e.dust) ? e.dust : 0, 0, 1),
      a = THREE.MathUtils.clamp(
        Number.isFinite(e.precipitationRate) ? e.precipitationRate : 0,
        0,
        1,
      ),
      o = Number.isFinite(e.fogDensity) ? Math.max(0, e.fogDensity) : 0.0032,
      s = 1 - THREE.MathUtils.smoothstep(o, 0.0042, 0.008),
      l = THREE.MathUtils.clamp(
        (1 - i * 0.18 - r * 0.92 - a * 0.62) * s,
        0.015,
        1,
      );
    ((this.mountainProxyAtmosphereOpacity =
      THREE.MathUtils.lerp(0.012, 0.62, l) * THREE.MathUtils.lerp(0.74, 1, n)),
      e.horizonColor &&
        this.mountainProxyMaterial.color.copy(e.horizonColor).lerp(fW, 0.46),
      this.updateMountainProxyPresentation());
  }
  update(e, n, i) {
    let r = Number.isFinite(i) ? i : ol(e, n);
    ((this.lastPlayerPosition = { x: e, y: r, z: n }),
      this.updateMountainProxy(e, n, r));
    let a = qn(e, n),
      o = fr(a);
    return this.anchor?.x === o.x && this.anchor.z === o.z
      ? !1
      : ((this.anchor = o),
        this.reconcileTerrainRings(),
        this.rebuildSettlements(HORIZON_PROFILES[this.mode].drawDistanceMeters),
        this.rebuildScenery(),
        (this.rebuilds += 1),
        !0);
  }
  get diagnostics() {
    let e = jg(this.detailLevel);
    return {
      mode: this.mode,
      detailLevel: this.detailLevel,
      detailDistanceMeters: e.detailBlendEnd,
      nearCellSize: e.nearCellSize,
      terrainTiles: [...this.terrainRings.values()].reduce(
        (n, i) => n + i.meshes.length,
        0,
      ),
      terrainTriangles: [...this.terrainRings.values()].reduce(
        (n, i) => n + i.triangles,
        0,
      ),
      settlementInstances: this.settlementInstances,
      settlementLightInstances: this.settlementLightInstances,
      settlementLightDrawCalls: this.settlementLightMeshes.length,
      sceneryInstances: this.sceneryInstances,
      sceneryDrawCalls: this.sceneryMeshes.length,
      landmarkProxyVisible: this.mountainProxy.visible,
      landmarkProxyTriangles:
        (this.mountainProxyGeometry.index?.count ?? 0) / 3,
      rebuilds: this.rebuilds,
      anchor: this.anchor ? { ...this.anchor } : null,
    };
  }
  dispose() {
    (this.clearRuntimeMeshes(),
      this.scene.remove(this.group),
      this.terrainMaterial.dispose(),
      this.settlementGeometry.dispose(),
      this.settlementMaterial.dispose(),
      this.settlementLightMaterial.dispose(),
      this.sceneryTrunkGeometry.dispose(),
      this.sceneryCrownGeometry.dispose(),
      this.sceneryRockGeometry.dispose(),
      this.sceneryMaterial.dispose(),
      this.mountainProxyGeometry.dispose(),
      this.mountainProxyMaterial.dispose());
  }
  updateMountainProxy(e, n, i) {
    let r = me.center.x - e,
      a = me.center.z - n,
      o = Math.hypot(r, a);
    if (!Number.isFinite(o) || o < 1) {
      ((this.mountainProxyRangeOpacity = 0),
        this.updateMountainProxyPresentation());
      return;
    }
    let s = HORIZON_PROFILES[this.mode],
      l = s.rings[s.rings.length - 1].outer,
      c = THREE.MathUtils.smoothstep(o, l * 0.78, l * 0.96),
      u = THREE.MathUtils.smoothstep(
        o,
        me.footprintRadius * 0.48,
        me.footprintRadius * 0.72,
      );
    if (
      ((this.mountainProxyRangeOpacity = c * u),
      this.mountainProxyRangeOpacity <= 0.002)
    ) {
      this.updateMountainProxyPresentation();
      return;
    }
    let h = me.footprintRadius * nm[nm.length - 1],
      d = (s.drawDistanceMeters * 0.88) / (1 + h / o),
      f = Math.min(o, d) / o,
      S = ol(me.center.x, me.center.z) - oo(me.center.x, me.center.z);
    (this.mountainProxy.position.set(e + r * f, i + (S - i) * f, n + a * f),
      this.mountainProxy.scale.setScalar(f),
      this.updateMountainProxyPresentation());
  }
  updateMountainProxyPresentation() {
    let e =
      this.mountainProxyRangeOpacity * this.mountainProxyAtmosphereOpacity;
    ((this.mountainProxyMaterial.opacity = e),
      (this.mountainProxy.visible = e > 0.002));
  }
  clearRuntimeMeshes() {
    for (let e of this.terrainRings.values()) this.disposeTerrainRing(e);
    (this.terrainRings.clear(),
      this.clearSettlementMeshes(),
      this.clearSceneryMeshes());
  }
  clearSettlementMeshes() {
    for (let e of this.settlementMeshes) (this.group.remove(e), e.dispose());
    for (let e of this.settlementLightMeshes) this.group.remove(e);
    this.settlementLights.setCount(0);
    ((this.settlementMeshes = []),
      (this.settlementLightMeshes = []),
      (this.settlementInstances = 0),
      (this.settlementLightInstances = 0));
  }
  clearSceneryMeshes() {
    for (let e of this.sceneryMeshes) (this.group.remove(e), e.dispose());
    ((this.sceneryMeshes = []), (this.sceneryInstances = 0));
  }
  disposeTerrainRing(e) {
    for (let n of e.meshes) (this.group.remove(n), n.geometry.dispose());
  }
  rebuildAll() {
    this.anchor &&
      (this.clearRuntimeMeshes(),
      this.reconcileTerrainRings(),
      this.rebuildSettlements(HORIZON_PROFILES[this.mode].drawDistanceMeters),
      this.rebuildScenery(),
      (this.rebuilds += 1));
  }
  reconcileTerrainRings() {
    if (!this.anchor) return;
    let e = HORIZON_PROFILES[this.mode],
      n = jg(this.detailLevel);
    for (let [i, r] of this.terrainRings)
      i < e.rings.length ||
        (this.disposeTerrainRing(r), this.terrainRings.delete(i));
    for (let [i, r] of e.rings.entries()) {
      let a = i === 0 ? n.nearCellSize : r.cellSize,
        o = i === 0 ? 96 : Math.max(96, a),
        s = Math.round(this.anchor.x / o) * o,
        l = Math.round(this.anchor.z / o) * o,
        c = this.terrainRings.get(i);
      if (c?.anchorX === s && c.anchorZ === l) continue;
      c && this.disposeTerrainRing(c);
      let u = i === 0 ? a : a * 1.08,
        h = {
          ...r,
          cellSize: a,
          inner: i === 0 ? r.inner : Math.max(432, r.inner - u),
          outer: r.outer + u,
        },
        d = [],
        p = 0;
      for (let f of bW(s, l, h)) {
        let S = _W(f, h, s, l, i * 0.34, n);
        if (!S) continue;
        let v = new THREE.Mesh(S, this.terrainMaterial);
        ((v.name = `horizon-terrain:${i}:${f.side}:${f.tile}`),
          (v.castShadow = !1),
          (v.receiveShadow = !1),
          (v.frustumCulled = !0),
          (v.renderOrder = -1),
          (v.userData.shadow = !1),
          (p += (S.index?.count ?? 0) / 3),
          d.push(v),
          this.group.add(v));
      }
      this.terrainRings.set(i, {
        anchorX: s,
        anchorZ: l,
        meshes: d,
        triangles: p,
      });
    }
  }
  rebuildScenery() {
    if (!this.anchor) return;
    this.clearSceneryMeshes();
    let e = OL(this.anchor.x, this.anchor.z, jg(this.detailLevel)),
      n = e.filter((h) => h.kind === "tree"),
      i = e.filter((h) => h.kind === "rock"),
      r = new THREE.Matrix4(),
      a = new THREE.Vector3(),
      o = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      l = new THREE.Color(),
      c = (h, d, p) => {
        let f = new THREE.InstancedMesh(d, this.sceneryMaterial, p);
        return (
          (f.name = h),
          (f.castShadow = !1),
          (f.receiveShadow = !1),
          (f.frustumCulled = !0),
          (f.renderOrder = -0.5),
          (f.userData.shadow = !1),
          f
        );
      },
      u = (h) => {
        (h.instanceMatrix.setUsage(THREE.StaticDrawUsage),
          (h.instanceMatrix.needsUpdate = !0),
          h.instanceColor && (h.instanceColor.needsUpdate = !0),
          h.computeBoundingBox(),
          h.computeBoundingSphere(),
          this.sceneryMeshes.push(h),
          this.group.add(h));
      };
    if (n.length > 0) {
      let h = c(
          "horizon-scenery:tree-trunks",
          this.sceneryTrunkGeometry,
          n.length,
        ),
        d = c(
          "horizon-scenery:tree-crowns",
          this.sceneryCrownGeometry,
          n.length,
        );
      (n.forEach((p, f) => {
        (o.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw),
          a.set(p.x, p.y + p.height * 0.25, p.z),
          s.set(p.width * 0.5, p.height * 0.5, p.width * 0.5),
          r.compose(a, o, s),
          h.setMatrixAt(f, r),
          h.setColorAt(f, l.setHex(p.trunkColor)),
          a.set(p.x, p.y + p.height * 0.69, p.z),
          s.set(p.width, p.height * 0.31, p.width),
          r.compose(a, o, s),
          d.setMatrixAt(f, r),
          d.setColorAt(f, l.setHex(p.foliageColor)));
      }),
        u(h),
        u(d));
    }
    if (i.length > 0) {
      let h = c("horizon-scenery:rocks", this.sceneryRockGeometry, i.length);
      (i.forEach((d, p) => {
        (a.set(d.x, d.y + d.height * 0.45, d.z),
          o.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, d.yaw),
          s.set(d.width, d.height * 0.72, d.width * 0.78),
          r.compose(a, o, s),
          h.setMatrixAt(p, r),
          h.setColorAt(p, l.setHex(d.color)));
      }),
        u(h));
    }
    this.sceneryInstances = e.length;
  }
  rebuildSettlements(e) {
    if (!this.anchor) return;
    this.clearSettlementMeshes();
    let n = Array.from({ length: lw }, () => []);
    for (let l of MW(this.anchor.x, this.anchor.z, e)) n[l.sector].push(l);
    let i = new THREE.Matrix4(),
      r = new THREE.Vector3(),
      a = new THREE.Quaternion(),
      o = new THREE.Vector3(),
      s = new THREE.Color();
    for (let [l, c] of n.entries()) {
      if (c.length === 0) continue;
      let u = new THREE.InstancedMesh(
        this.settlementGeometry,
        this.settlementMaterial,
        c.length,
      );
      ((u.name = `horizon-settlements:${l}`),
        (u.castShadow = !1),
        (u.receiveShadow = !1),
        (u.frustumCulled = !0),
        (u.renderOrder = -1),
        (u.userData.shadow = !1),
        c.forEach((h, d) => {
          (r.set(h.x, h.y + h.height * 0.5, h.z),
            a.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h.yaw),
            o.set(h.width, h.height, h.depth),
            i.compose(r, a, o),
            u.setMatrixAt(d, i),
            u.setColorAt(d, s.setHex(h.color)));
        }),
        u.instanceMatrix.setUsage(THREE.StaticDrawUsage),
        (u.instanceMatrix.needsUpdate = !0),
        u.instanceColor && (u.instanceColor.needsUpdate = !0),
        u.computeBoundingBox(),
        u.computeBoundingSphere(),
        (this.settlementInstances += c.length),
        this.settlementMeshes.push(u),
        this.group.add(u));
    }
    this.rebuildSettlementLights(n);
  }
  rebuildSettlementLights(e) {
    if (!this.anchor) return;
    let n = pW,
      i = new THREE.Color(),
      o = this.settlementLightPositions,
      s = this.settlementLightColors,
      l = 0;
    for (let [, a] of e.entries()) {
      if (n <= 0) break;
      for (let u of a) {
        if (n <= 0) break;
        let h = kt(
            `${ot}:horizon-light:v1:${Math.round(u.x * 10)}:${Math.round(u.z * 10)}`,
          ),
          d = Math.min(yW[u.tier], n),
          p = this.anchor.x - u.x,
          f = this.anchor.z - u.z,
          S = Math.max(0.001, Math.hypot(p, f)),
          v = p / S,
          m = f / S,
          y = -m,
          x = v,
          g = Math.hypot(u.width, u.depth) * 0.51 + 0.18;
        for (let E = 0; E < d; E += 1) {
          let c = l * 3;
          if (u.tier === "megacity" && E === d - 1)
            ((o[c] = u.x),
              (o[c + 1] = u.y + u.height + 0.7 + h() * 1.4),
              (o[c + 2] = u.z),
              i.setRGB(1, 0.055, 0.018));
          else {
            let _ = (h() - 0.5) * Math.min(u.width, u.depth) * 0.54;
            ((o[c] = u.x + v * g + y * _),
              (o[c + 1] = u.y + u.height * (0.28 + h() * 0.58)),
              (o[c + 2] = u.z + m * g + x * _),
              i.setHSL(0.075 + h() * 0.065, 0.82, 0.7));
          }
          ((s[c] = i.r), (s[c + 1] = i.g), (s[c + 2] = i.b), (l += 1), (n -= 1));
        }
      }
    }
    if (l > 0) {
      let c = this.settlementLights;
      (c.setCount(l),
        (c.positions.needsUpdate = !0),
        c.colors && (c.colors.needsUpdate = !0),
        (this.settlementLightInstances = l),
        this.settlementLightMeshes.push(c.object),
        this.group.add(c.object));
    }
    this.updateHorizonLightPresentation();
  }
  updateHorizonLightPresentation() {
    let e = this.horizonLightsEnabled && this.horizonLightVisibility > 0.01;
    this.settlementLightMaterial.opacity = e
      ? this.horizonLightVisibility * 0.82
      : 0;
    for (let n of this.settlementLightMeshes) n.visible = e;
  }
  updateTerrainWetness() {
    let e = this.wetSurfacesEnabled ? this.surfaceWetness : 0;
    ((this.terrainMaterial.roughness = THREE.MathUtils.lerp(0.96, 0.55, e)),
      (this.terrainMaterial.envMapIntensity = 0.72 * (1 + 0.48 * e)));
  }
};
function FL(t, e) {
  let n = t.index ? t.toNonIndexed() : t.clone();
  t.dispose();
  let i = new THREE.Color(e),
    r = new Float32Array(n.getAttribute("position").count * 3);
  for (let a = 0; a < r.length; a += 3)
    ((r[a] = i.r), (r[a + 1] = i.g), (r[a + 2] = i.b));
  return (n.setAttribute("color", new THREE.BufferAttribute(r, 3)), n);
}
function wW(t) {
  let e = mergeGeometries(t, !1);
  for (let n of t) n.dispose();
  if (!e) throw new Error("Canopy benchmark geometry could not be merged");
  return (
    e.computeVertexNormals(),
    e.computeBoundingBox(),
    e.computeBoundingSphere(),
    e
  );
}
function HL(t) {
  let e = FL(new THREE.CylinderGeometry(0.3, 0.48, 3.5, 5), t.trunkColor);
  e.translate(0, 1.75, 0);
  let n = FL(new THREE.ConeGeometry(1.7, 5, 5), t.foliageColor);
  n.translate(0, 5.1, 0);
  let i = wW([e, n]);
  return (
    i.scale(t.relativeWidth, t.relativeHeight, t.relativeWidth),
    _c(i, 0.42)
  );
}
function kL(t) {
  let e = 1.72 * t.relativeWidth,
    n = 7.7 * t.relativeHeight,
    i = new Float32Array([
      -e,
      0,
      0,
      e,
      0,
      0,
      0,
      n,
      0,
      0,
      0,
      -e,
      0,
      0,
      e,
      0,
      n,
      0,
    ]),
    r = new THREE.Color(t.foliageColor),
    a = new Float32Array(i.length);
  for (let s = 0; s < a.length; s += 3)
    ((a[s] = r.r), (a[s + 1] = r.g), (a[s + 2] = r.b));
  let o = new THREE.BufferGeometry();
  return (
    o.setAttribute("position", new THREE.BufferAttribute(i, 3)),
    o.setAttribute("color", new THREE.BufferAttribute(a, 3)),
    o.computeVertexNormals(),
    o.computeBoundingBox(),
    o.computeBoundingSphere(),
    _c(o, 0.42)
  );
}
function TW() {
  let t = new Float32Array([
      -0.08, 0, 0, 0.08, 0, 0, 0.025, 1.15, 0, -0.08, 0, 0, 0.025, 1.15, 0,
      -0.025, 1.15, 0, 0, 0, -0.08, 0, 0, 0.08, 0, 1.15, 0.025, 0, 0, -0.08, 0,
      1.15, 0.025, 0, 1.15, -0.025,
    ]),
    e = new Float32Array(t.length),
    n = new THREE.Color(6321486);
  for (let r = 0; r < e.length; r += 3)
    ((e[r] = n.r), (e[r + 1] = n.g), (e[r + 2] = n.b));
  let i = new THREE.BufferGeometry();
  return (
    i.setAttribute("position", new THREE.BufferAttribute(t, 3)),
    i.setAttribute("color", new THREE.BufferAttribute(e, 3)),
    i.computeVertexNormals(),
    i.computeBoundingBox(),
    i.computeBoundingSphere(),
    _c(i, 0.12)
  );
}
function ts(t) {
  return t.index ? t.index.count / 3 : t.getAttribute("position").count / 3;
}
function Zx(t, e = THREE.FrontSide) {
  return ln(
    new THREE.MeshStandardNodeMaterial({
      color: 16777215,
      roughness: 1,
      metalness: 0,
      flatShading: !0,
      vertexColors: !0,
      side: e,
    }),
    {
      role: "vegetation",
      weatherExposure: 0.82,
      wetRoughness: 0.62,
      environmentScale: 0.5,
      wetReflectionBoost: 0.18,
      detail: !1,
      windAmplitude: t === "woody" ? 0.42 : 0.12,
    },
  );
}
var ForestStressLab = class {
  constructor(e, n, i) {
    this.scene = e;
    this.materialLibrary = i;
    this.nearGeometry = {
      sable_pine: tm(vl.sable_pine),
      frost_spruce: tm(vl.frost_spruce),
    };
    this.midGeometry = {
      sable_pine: HL(vl.sable_pine),
      frost_spruce: HL(vl.frost_spruce),
    };
    this.farGeometry = {
      sable_pine: kL(vl.sable_pine),
      frost_spruce: kL(vl.frost_spruce),
    };
    this.groundcoverGeometry = Gx(Zd.pine_forest);
    this.rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    this.reedGeometry = TW();
    this.treeMaterial = Zx("woody");
    this.farTreeMaterial = Zx("woody", THREE.DoubleSide);
    this.groundcoverMaterial = Zx("groundcover");
    this.reedMaterial = Zx("groundcover", THREE.DoubleSide);
    this.rockMaterial = ln(
      new THREE.MeshStandardNodeMaterial({
        color: 5067081,
        roughness: 1,
        flatShading: !0,
      }),
      {
        role: "rock",
        weatherExposure: 1,
        wetRoughness: 0.36,
        environmentScale: 0.68,
        wetReflectionBoost: 0.52,
      },
    );
    this.root = null;
    this.tiles = [];
    this.level = 2;
    this.disposed = !1;
    this.lastPlayerX = Number.POSITIVE_INFINITY;
    this.lastPlayerZ = Number.POSITIVE_INFINITY;
    this.rebuilds = 0;
    this.buildMilliseconds = 0;
    this.activeLodInstances = 0;
    this.estimatedActiveLodTriangles = 0;
    this.estimatedActiveLodDrawCalls = 0;
    this.activeLodSampleX = Number.POSITIVE_INFINITY;
    this.activeLodSampleZ = Number.POSITIVE_INFINITY;
    this.nearTiles = 0;
    this.midTiles = 0;
    this.farTiles = 0;
    this.quality = n;
  }
  update(e, n, i = !0) {
    if (this.disposed) return !1;
    if (((this.lastPlayerX = e), (this.lastPlayerZ = n), !i))
      return (this.clear(), !1);
    let r = rp(e, n);
    return (
      !this.root && r <= wt.activationRadius
        ? this.build()
        : this.root && r > wt.unloadRadius && this.clear(),
      this.root && this.updateActiveLodBudget(e, n),
      this.root !== null
    );
  }
  setLevel(e) {
    let n = iD(e);
    return n === this.level
      ? !1
      : ((this.level = n),
        this.root &&
          (this.clear(),
          this.build(),
          this.updateActiveLodBudget(this.lastPlayerX, this.lastPlayerZ)),
        !0);
  }
  setQuality(e) {
    return this.quality === e
      ? !1
      : ((this.quality = e), this.root && this.applyShadowPolicy(), !0);
  }
  get diagnostics() {
    let e = No[this.level];
    return {
      id: wt.id,
      label: wt.label,
      active: this.root !== null,
      level: this.level,
      levelLabel: e.label,
      distanceMeters: Number.isFinite(this.lastPlayerX)
        ? rp(this.lastPlayerX, this.lastPlayerZ)
        : Number.POSITIVE_INFINITY,
      trees: this.root ? e.trees : 0,
      groundcover: this.root ? e.groundcover : 0,
      rocks: this.root ? e.rocks : 0,
      reeds: this.root ? e.reeds : 0,
      authoredInstances: this.root
        ? e.trees + e.groundcover + e.rocks + e.reeds
        : 0,
      allocatedInstances: this.root
        ? e.trees * 3 + e.groundcover + e.rocks + e.reeds
        : 0,
      activeLodInstances: this.activeLodInstances,
      estimatedActiveLodTriangles: this.estimatedActiveLodTriangles,
      estimatedActiveLodDrawCalls: this.estimatedActiveLodDrawCalls,
      tiles: this.tiles.length,
      nearTiles: this.nearTiles,
      midTiles: this.midTiles,
      farTiles: this.farTiles,
      rebuilds: this.rebuilds,
      buildMilliseconds: this.buildMilliseconds,
      renderOnly: !0,
    };
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0), this.clear());
      for (let e of Object.values(this.nearGeometry)) e.dispose();
      for (let e of Object.values(this.midGeometry)) e.dispose();
      for (let e of Object.values(this.farGeometry)) e.dispose();
      (this.groundcoverGeometry.dispose(),
        this.rockGeometry.dispose(),
        this.reedGeometry.dispose(),
        this.treeMaterial.dispose(),
        this.farTreeMaterial.dispose(),
        this.groundcoverMaterial.dispose(),
        this.reedMaterial.dispose(),
        this.rockMaterial.dispose());
    }
  }
  build() {
    if (this.disposed || this.root) return;
    let e = performance.now(),
      n = No[this.level],
      i = new THREE.Group();
    ((i.name = `benchmark:${wt.id}`),
      (i.userData.benchmarkFixture = !0),
      (i.userData.renderOnly = !0));
    let r = this.createTileRecipes(n);
    ((this.tiles = [...r.values()].map((a) => this.createTile(a, i))),
      this.addReeds(i, oD(n.reeds)),
      this.materialLibrary.track(i),
      this.scene.add(i),
      (this.root = i),
      (this.rebuilds += 1),
      (this.buildMilliseconds = performance.now() - e),
      this.applyShadowPolicy());
  }
  createTileRecipes(e) {
    let n = new Map(),
      i = (r) => {
        let a = aD(r.x, r.z),
          o = n.get(a);
        if (!o) {
          let [s, l] = a.split(":").map(Number),
            c = wt.forestRadius;
          ((o = {
            key: a,
            centerX: wt.center.x - c + (s + 0.5) * wt.tileSize,
            centerZ: wt.center.z - c + (l + 0.5) * wt.tileSize,
            trees: [],
            groundcover: [],
            rocks: [],
          }),
            n.set(a, o));
        }
        return o;
      };
    Qg("trees", e.trees).forEach((r, a) => {
      i(r).trees.push({
        ...r,
        species: a % 5 === 0 ? "frost_spruce" : "sable_pine",
        terrainY: je(r.x, r.z),
      });
    });
    for (let r of Qg("groundcover", e.groundcover)) i(r).groundcover.push(r);
    for (let r of Qg("rocks", e.rocks)) i(r).rocks.push(r);
    return n;
  }
  createTile(e, n) {
    let i = je(e.centerX, e.centerZ),
      r = new THREE.LOD();
    ((r.name = `benchmark-tile:${e.key}`),
      r.position.set(e.centerX, i, e.centerZ),
      (r.userData.benchmarkFixture = !0));
    let a = new THREE.Group(),
      o = new THREE.Group(),
      s = new THREE.Group(),
      l = e.trees.filter((u) => u.species === "sable_pine"),
      c = e.trees.filter((u) => u.species === "frost_spruce");
    return (
      this.addTreeMeshes(a, o, s, l, "sable_pine", e, i),
      this.addTreeMeshes(a, o, s, c, "frost_spruce", e, i),
      this.addInstancedPoints(
        a,
        e.groundcover,
        this.groundcoverGeometry,
        this.groundcoverMaterial,
        e,
        i,
        "groundcover",
        !1,
      ),
      this.addInstancedPoints(
        a,
        e.rocks,
        this.rockGeometry,
        this.rockMaterial,
        e,
        i,
        "rocks",
        !1,
        0.42,
      ),
      r.addLevel(a, 0),
      r.addLevel(o, wt.nearLodDistance),
      r.addLevel(s, wt.midLodDistance),
      n.add(r),
      {
        lod: r,
        centerX: e.centerX,
        centerZ: e.centerZ,
        sablePines: l.length,
        frostSpruces: c.length,
        groundcover: e.groundcover.length,
        rocks: e.rocks.length,
      }
    );
  }
  addTreeMeshes(e, n, i, r, a, o, s) {
    r.length !== 0 &&
      (this.addInstancedPoints(
        e,
        r,
        this.nearGeometry[a],
        this.treeMaterial,
        o,
        s,
        `${a}:near`,
        !0,
      ),
      this.addInstancedPoints(
        n,
        r,
        this.midGeometry[a],
        this.treeMaterial,
        o,
        s,
        `${a}:mid`,
        !1,
      ),
      this.addInstancedPoints(
        i,
        r,
        this.farGeometry[a],
        this.farTreeMaterial,
        o,
        s,
        `${a}:far`,
        !1,
      ));
  }
  addInstancedPoints(e, n, i, r, a, o, s, l, c = 0) {
    if (n.length === 0) return null;
    let u = new THREE.InstancedMesh(i, r, n.length);
    ((u.name = `benchmark:${a.key}:${s}`),
      (u.userData.benchmarkFixture = !0),
      (u.userData.shadowCandidate = l),
      (u.castShadow = l && qualityHasShadows(this.quality)),
      (u.receiveShadow = s !== "groundcover"),
      u.instanceMatrix.setUsage(THREE.StaticDrawUsage));
    let h = new THREE.Matrix4(),
      d = new THREE.Quaternion(),
      p = new THREE.Vector3(),
      f = new THREE.Vector3(),
      S = new THREE.Color();
    return (
      n.forEach((v, m) => {
        let y = v.terrainY ?? je(v.x, v.z);
        (p.set(v.x - a.centerX, y - o + v.scale * c, v.z - a.centerZ),
          d.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, v.yaw),
          f.set(v.scale, v.scale, v.scale),
          h.compose(p, d, f),
          u.setMatrixAt(m, h),
          S.setRGB(v.tint, v.tint, v.tint),
          u.setColorAt(m, S));
      }),
      (u.instanceMatrix.needsUpdate = !0),
      u.instanceColor && (u.instanceColor.needsUpdate = !0),
      u.computeBoundingBox(),
      u.computeBoundingSphere(),
      e.add(u),
      u
    );
  }
  addReeds(e, n) {
    if (n.length === 0) return;
    let i = new THREE.InstancedMesh(
      this.reedGeometry,
      this.reedMaterial,
      n.length,
    );
    ((i.name = "benchmark:lake-reeds"),
      (i.userData.benchmarkFixture = !0),
      (i.castShadow = !1),
      (i.receiveShadow = !0),
      i.instanceMatrix.setUsage(THREE.StaticDrawUsage));
    let r = new THREE.Matrix4(),
      a = new THREE.Quaternion(),
      o = new THREE.Vector3(),
      s = new THREE.Vector3(),
      l = new THREE.Color();
    (n.forEach((c, u) => {
      (o.set(c.x, je(c.x, c.z), c.z),
        a.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.yaw),
        s.set(c.scale, c.scale, c.scale),
        r.compose(o, a, s),
        i.setMatrixAt(u, r),
        l.setRGB(c.tint, c.tint, c.tint),
        i.setColorAt(u, l));
    }),
      (i.instanceMatrix.needsUpdate = !0),
      i.instanceColor && (i.instanceColor.needsUpdate = !0),
      i.computeBoundingBox(),
      i.computeBoundingSphere(),
      e.add(i));
  }
  updateActiveLodBudget(e, n) {
    let i = e - this.activeLodSampleX,
      r = n - this.activeLodSampleZ;
    if (i * i + r * r < 1) return;
    ((this.activeLodSampleX = e), (this.activeLodSampleZ = n));
    let a = No[this.level],
      o = a.reeds,
      s = a.reeds * ts(this.reedGeometry),
      l = a.reeds > 0 ? 1 : 0,
      c = 0,
      u = 0,
      h = 0;
    for (let d of this.tiles) {
      let p = Math.hypot(e - d.centerX, n - d.centerZ),
        f = +(d.sablePines > 0) + +(d.frostSpruces > 0);
      p < wt.nearLodDistance
        ? ((c += 1),
          (o += d.sablePines + d.frostSpruces + d.groundcover + d.rocks),
          (s +=
            d.sablePines * ts(this.nearGeometry.sable_pine) +
            d.frostSpruces * ts(this.nearGeometry.frost_spruce) +
            d.groundcover * ts(this.groundcoverGeometry) +
            d.rocks * ts(this.rockGeometry)),
          (l += f + +(d.groundcover > 0) + +(d.rocks > 0)))
        : p < wt.midLodDistance
          ? ((u += 1),
            (o += d.sablePines + d.frostSpruces),
            (s +=
              d.sablePines * ts(this.midGeometry.sable_pine) +
              d.frostSpruces * ts(this.midGeometry.frost_spruce)),
            (l += f))
          : ((h += 1),
            (o += d.sablePines + d.frostSpruces),
            (s +=
              d.sablePines * ts(this.farGeometry.sable_pine) +
              d.frostSpruces * ts(this.farGeometry.frost_spruce)),
            (l += f));
    }
    ((this.activeLodInstances = o),
      (this.estimatedActiveLodTriangles = Math.round(s)),
      (this.estimatedActiveLodDrawCalls = l),
      (this.nearTiles = c),
      (this.midTiles = u),
      (this.farTiles = h));
  }
  applyShadowPolicy() {
    this.root?.traverse((e) => {
      e instanceof THREE.InstancedMesh &&
        (e.castShadow =
          e.userData.shadowCandidate === !0 && qualityHasShadows(this.quality));
    });
  }
  clear() {
    if (!this.root) return;
    let e = this.root;
    ((this.root = null),
      this.materialLibrary.untrack(e),
      this.scene.remove(e),
      e.traverse((n) => {
        n instanceof THREE.InstancedMesh && n.dispose();
      }),
      e.clear(),
      (this.tiles = []),
      (this.activeLodInstances = 0),
      (this.estimatedActiveLodTriangles = 0),
      (this.estimatedActiveLodDrawCalls = 0),
      (this.activeLodSampleX = Number.POSITIVE_INFINITY),
      (this.activeLodSampleZ = Number.POSITIVE_INFINITY),
      (this.nearTiles = 0),
      (this.midTiles = 0),
      (this.farTiles = 0));
  }
};
var SPAWN_POSE = Object.freeze({ x: 0, z: 8, yaw: -0.565, pitch: -0.035 }),
  Qd = Object.freeze({
    mode: "developer",
    persistence: "ephemeral",
    worldMinutes: 720,
    weatherId: "fair",
    player: Object.freeze({ invincible: !0, speedMode: "veryFast", fly: !0 }),
  }),
  RW = Object.freeze({
    survey: Object.freeze({ mode: "survey", persistence: "persistent" }),
    developer: Qd,
  });
function BL(t) {
  return RW[t].persistence === "persistent";
}
var $d = 1 / 60,
  AW = 0.075;
function cw(t) {
  return {
    master: t.masterVolume,
    ambient: t.ambientVolume,
    effects: t.effectsVolume,
  };
}
var FrontierEngine = class {
  constructor(e) {
    this.scene = new THREE.Scene();
    this.navigation = new NavigationSystem();
    this.graphicsBenchmark = new GraphicsBenchmark();
    this.graphicsFeatures = { ...DEFAULT_GRAPHICS_FEATURES };
    this.developerPlayer = { ...ap };
    this.pipeline = new SystemPipeline();
    this.projectionPoint = new THREE.Vector3();
    this.projectionDirection = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.player = {
      position: new THREE.Vector3(SPAWN_POSE.x, 0, SPAWN_POSE.z),
      yaw: SPAWN_POSE.yaw,
      pitch: SPAWN_POSE.pitch,
      verticalVelocity: 0,
      grounded: !0,
      crouching: !1,
      sprinting: !1,
      stamina: 1,
      staminaRecoveryDelay: 0,
      eyeHeight: 1.72,
      jumpBufferRemaining: 0,
      coyoteRemaining: 0,
      sheltered: !1,
      condition: { ...Fd },
      safePosition: new THREE.Vector3(SPAWN_POSE.x, 0, SPAWN_POSE.z),
      groundedSafeTime: 0,
    };
    this.animationFrame = 0;
    this.previousTime = 0;
    this.accumulator = 0;
    this.lastSnapshotTime = 0;
    this.framesSinceSample = 0;
    this.fpsSampleStarted = 0;
    this.fps = 60;
    this.ready = !1;
    this.started = !1;
    this.sessionMode = "survey";
    this.paused = !1;
    this.mapOpen = !1;
    this.inventoryOpen = !1;
    this.settingsOpen = !1;
    this.activeInspection = null;
    this.featureOverlay = null;
    this.developerPanelOpen = !1;
    this.contextStatus = "ready";
    this.quality = "cinematic";
    this.horizonMode = Fs;
    this.settings = {
      ...DEFAULT_SETTINGS,
      keyBindings: { ...DEFAULT_SETTINGS.keyBindings },
    };
    this.scanned = [];
    this.inventory = { ...hf };
    this.worldDiffs = {};
    this.doorStates = {};
    this.featureProgress = Qf();
    this.scanner = {
      active: !1,
      focusId: null,
      focusEntryId: null,
      focusName: null,
      progress: 0,
    };
    this.lastFeatureNotice = null;
    this.lastDiscovery = null;
    this.lastGather = null;
    this.noticeClock = {};
    this.lastFastTravel = null;
    this.discoveredLocations = [];
    this.currentLocation = Nc(SPAWN_POSE.x, SPAWN_POSE.z);
    this.lastLocationDiscovery = null;
    this.saveStatus = "unavailable";
    this.hasSurveySave = !1;
    this.lastSavedAt = null;
    this.lastClockPersistTime = 0;
    this.benchmarkTravelOrigin = null;
    this.snapshot = { ...INITIAL_SNAPSHOT };
    this.disposed = !1;
    this.cameraPreferenceTimer = null;
    this.frame = (e) => {
      if (this.disposed || this.halted) return;
      let n = performance.now(),
        i = this.previousTime ? e - this.previousTime : $d * 1e3,
        r = this.previousTime ? Math.min(i / 1e3, AW) : $d;
      this.previousTime = e;
      try {
        if (this.contextStatus === "ready") {
          // Menus read the pad first, so the press that closes a menu never
          // also jumps or harvests in the world on the same frame.
          let c = this.isMenuMode();
          (c
            ? this.menus.update(r, this)
            : this.menus.focused &&
              (this.menus.focused.classList.remove("is-pad-focus"),
              (this.menus.focused = null)),
            this.handlePauseAction(c),
            this.input.beginFrame(r, c),
            this.syncTouchControls(c),
            c || this.updateNotices(r));
          this.accumulator += r;
          let a = 0;
          for (; this.accumulator >= $d && a < 5; )
            ((this.runtime.started = this.started),
              (this.runtime.paused =
                this.paused ||
                this.mapOpen ||
                this.inventoryOpen ||
                this.settingsOpen ||
                this.activeInspection !== null ||
                this.featureOverlay !== null ||
                this.developerPanelOpen ||
                this.player.condition.health <= 0),
              (this.runtime.developerPanelOpen = this.developerPanelOpen),
              this.pipeline.update(this.runtime, $d),
              this.updateSafePosition($d),
              (this.accumulator -= $d),
              (a += 1));
          (a === 5 && (this.accumulator = 0),
            this.presentCamera(r),
            this.environment.present(
              this.player.position,
              r,
              this.camera.position,
            ),
            this.forestStress.update(
              this.player.position.x,
              this.player.position.z,
              this.environment.getDeveloperState().enabled,
            ),
            this.benchmarkTravelOrigin &&
              Math.hypot(
                this.player.position.x - wt.center.x,
                this.player.position.z - wt.center.z,
              ) > wt.unloadRadius &&
              (this.benchmarkTravelOrigin = null));
          let o = this.environment.getVisualState();
          (this.world.presentEnvironment(o),
            this.horizon.presentEnvironment(o),
            this.renderPipeline.presentEnvironment(o),
            this.citizens.present(
              this.started &&
                !this.paused &&
                !this.mapOpen &&
                !this.inventoryOpen &&
                !this.settingsOpen &&
                !this.activeInspection &&
                !this.featureOverlay &&
                !this.developerPanelOpen
                ? this.accumulator
                : 0,
            ),
            this.animals.present(
              this.started &&
                !this.paused &&
                !this.mapOpen &&
                !this.inventoryOpen &&
                !this.settingsOpen &&
                !this.activeInspection &&
                !this.featureOverlay &&
                !this.developerPanelOpen
                ? this.accumulator
                : 0,
            ),
            this.flashlight.present(this.playerCamera),
            this.emitPresentation());
          let s = this.renderPipeline.render(
            r,
            this.graphicsBenchmark.isMeasuringGpu,
          );
          (this.graphicsBenchmark.resolveGpuSamples(s.gpuSamples),
            this.trackPerformance(e),
            this.started &&
              !this.testMode &&
              e - this.lastClockPersistTime >= 3e4 &&
              (this.persist(), (this.lastClockPersistTime = e)));
          let l = this.renderPipeline.renderer.info.render;
          (this.graphicsBenchmark.recordFrame({
            frameToken: s.frameToken,
            timestampMs: e,
            frameIntervalMs: i,
            cpuWorkMs: performance.now() - n,
            cpuRenderMs: s.cpuRenderMilliseconds,
            drawCalls: l.calls,
            triangles: l.triangles,
            gpuQuerySubmitted: s.gpuQuerySubmitted,
            hidden: document.hidden,
          }),
            this.emitSnapshot(e - this.lastSnapshotTime > 140));
        }
      } catch (a) {
        ((this.halted = !0),
          this.kit.stop(),
          (this.ready = !1),
          this.onRendererError(a));
        return;
      }
    };
    this.resize = () => {
      this.graphicsBenchmark.invalidate("Render resolution changed");
      // The kit owns the canvas size and pixel ratio (tier cap, dynamic resolution).
      let e = Math.max(1, this.kit.size.width),
        n = Math.max(1, this.kit.size.height);
      (this.renderPipeline.resize(e, n),
        (this.camera.aspect = e / n),
        this.camera.updateProjectionMatrix(),
        (this.playerCamera.aspect = e / n),
        this.playerCamera.updateProjectionMatrix());
    };
    this.handlePointerLockChange = (e) => {
      !this.started ||
        this.testMode ||
        (e ||
          this.graphicsBenchmark.cancel(
            "Capture cancelled when pointer lock ended",
          ),
        (this.paused =
          this.developerPanelOpen ||
          this.mapOpen ||
          this.inventoryOpen ||
          this.settingsOpen ||
          this.activeInspection !== null ||
          this.featureOverlay !== null ||
          this.player.condition.health <= 0 ||
          !e),
        this.paused && this.audio.silenceAmbient(),
        this.emitSnapshot(!0));
    };
    this.handleVisibilityChange = () => {
      document.hidden &&
        this.started &&
        (this.graphicsBenchmark.cancel(
          "Capture cancelled when the tab was hidden",
        ),
        (this.paused = !0),
        this.audio.silenceAmbient(),
        this.input.releasePointer(),
        this.persist(),
        this.emitSnapshot(!0));
    };
    // Clicking the world resumes from the pause panel, and a mouse player who
    // was on a pad or touch gets the pointer captured again.
    this.handleCanvasClick = () => {
      !this.started ||
        this.testMode ||
        (this.paused &&
        !this.mapOpen &&
        !this.inventoryOpen &&
        !this.settingsOpen &&
        !this.activeInspection &&
        !this.featureOverlay &&
        this.player.condition.health > 0 &&
        !this.developerPanelOpen
          ? this.resume()
          : !this.isMenuMode() &&
            this.kit.input.source === "keyboard" &&
            document.pointerLockElement !== this.canvas &&
            ((this.input.virtualCapture = !1), this.input.requestPointerLock()));
    };
    // Audio can only start from a real gesture; a pad press is not one, so any
    // later key, click or tap also unlocks it.
    this.handleAnyGesture = () => {
      this.started && !this.audio.unlocked && this.audio.unlock();
    };
    ((this.kit = e.kit),
      (KIT = e.kit),
      (this.canvas = e.kit.canvas),
      (this.halted = !1),
      (this.touchSuspended = null),
      (this.touchUseShown = null),
      (this.testMode = e.testMode ?? !1),
      (this.onSnapshot = e.onSnapshot),
      (this.onPresentation = e.onPresentation ?? (() => {})),
      (this.onRendererError = e.onRendererError ?? (() => {})),
      (this.reducedCameraMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? !1));
    let n = null;
    if (e.storageEnabled ?? !this.testMode)
      try {
        n = window.localStorage;
      } catch {
        n = null;
      }
    ((this.saveStore = new SaveStore(n)),
      (this.preferencesStore = new PreferencesStore(n)));
    let r = this.saveStore.load();
    ((this.settings = this.preferencesStore.load(r.horizonMode)),
      (this.scanned = r.scanned),
      (this.inventory = r.inventory),
      (this.worldDiffs = r.worldDiffs),
      (this.doorStates = r.doorStates),
      (this.discoveredLocations = r.discoveredLocations),
      (this.featureProgress = r.featureProgress),
      (this.featureProgress = {
        ...this.featureProgress,
        contractJournal: this.reconcilePersistentContractEvidence(
          this.featureProgress.contractJournal,
        ),
      }),
      (this.horizonMode = this.settings.horizonMode),
      // First visit: start from the profile that suits the device's kit tier.
      this.preferencesStore.hasSaved() ||
        (this.settings = {
          ...this.settings,
          quality: qualityForKitTier(this.kit.tier.name),
        }),
      (this.quality = this.settings.quality),
      (this.hasSurveySave = this.saveStore.hasSave()),
      (this.saveStatus = n
        ? this.hasSurveySave
          ? "saved"
          : "unsaved"
        : "unavailable"),
      r.manualWaypoint && this.navigation.setManualWaypoint(r.manualWaypoint),
      r.player &&
        (this.player.position.set(r.player.x, r.player.y, r.player.z),
        (this.player.yaw = r.player.yaw),
        (this.player.pitch = r.player.pitch),
        (this.player.condition = {
          ...Fd,
          health: r.player.health,
          wetness: r.player.wetness,
          coldStress: r.player.coldStress,
        })),
      (this.currentLocation = Nc(
        this.player.position.x,
        this.player.position.z,
      )),
      (this.camera = new THREE.PerspectiveCamera(
        this.settings.fov,
        1,
        0.08,
        HORIZON_PROFILES[this.horizonMode].drawDistanceMeters,
      )),
      (this.playerCamera = new THREE.PerspectiveCamera(
        this.settings.fov,
        1,
        0.08,
        HORIZON_PROFILES[this.horizonMode].drawDistanceMeters,
      )),
      (this.cameraRig = new CameraRig(
        this.settings.cameraDistance,
        this.settings.isometricAngle,
      )),
      (this.renderPipeline = new FrontierRenderPipeline({
        kit: this.kit,
        scene: this.scene,
        camera: this.camera,
        quality: this.quality,
      })),
      (this.renderer = this.renderPipeline.renderer),
      (this.materialLibrary = new WorldMaterialLibrary()),
      this.materialLibrary.setQuality(this.quality),
      this.materialLibrary.setFeatures(this.graphicsFeatures),
      (this.input = new FrontierInput(
        this.kit,
        this.canvas,
        this.handlePointerLockChange,
        this.settings.keyBindings,
      )),
      (this.menus = new FrontierMenuNavigator(this.kit)),
      (this.world = new WorldStreamer(
        this.scene,
        this.quality,
        this.worldDiffs,
        this.doorStates,
        this.featureProgress.containerStates,
        this.featureProgress.placedEntities,
        this.materialLibrary,
      )),
      (this.forestStress = new ForestStressLab(
        this.scene,
        this.quality,
        this.materialLibrary,
      )),
      (this.horizon = new HorizonSystem(
        this.scene,
        this.horizonMode,
        this.settings.worldDetail,
      )),
      (this.citizens = new CitizenCrowd(this.scene, this.quality)),
      (this.animals = new AnimalPopulation(this.scene, this.quality, {
        sampleHeight: je,
        queryColliders: (a, o, s, l, c) =>
          this.world.queryColliders(a, o, s, l, c),
      })),
      (this.playerAvatar = new PlayerAvatar(this.scene, this.quality)),
      (this.flashlight = new PhoneFlashlight(this.scene, this.quality)),
      (this.audio = new FieldAudio(cw(this.settings), this.testMode)),
      (this.environment = createEnvironment(
        this.scene,
        this.renderer,
        this.quality,
        r.worldMinutes,
      )),
      this.applyGraphicsFeatures(),
      this.environment.setHorizonMode(this.horizonMode),
      r.player ||
        (this.player.position.y = je(
          this.player.position.x,
          this.player.position.z,
        )),
      this.player.safePosition.copy(this.player.position),
      this.camera.position.set(
        this.player.position.x,
        this.player.position.y + 1.72,
        this.player.position.z,
      ),
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, "YXZ"),
      this.playerCamera.position.copy(this.camera.position),
      this.playerCamera.rotation.copy(this.camera.rotation),
      (this.runtime = {
        input: this.input,
        camera: this.playerCamera,
        world: this.world,
        horizon: this.horizon,
        citizens: this.citizens,
        animals: this.animals,
        environment: this.environment,
        audio: this.audio,
        navigation: this.navigation,
        settings: this.settings,
        player: this.player,
        started: !1,
        paused: !1,
        testMode: this.testMode,
        developerPlayer: this.developerPlayer,
        scanner: this.scanner,
        nearbyTarget: null,
        nearbyDistance: null,
        discover: (a) => this.discover(a),
        performInteraction: (a) => this.performInteraction(a),
        toggleMap: () => this.toggleMap(),
        toggleInventory: () => this.toggleInventory(),
        toggleQuality: () => this.toggleQuality(),
        toggleFlashlight: () => this.toggleFlashlight(),
        adjustCameraZoom: (a) => this.adjustCameraZoom(a),
        cycleCameraView: () => this.cycleCameraView(),
        toggleDeveloperPanel: () => this.toggleDeveloperPanel(),
        toggleOperations: () => this.toggleOperations(),
        scanCandidates: () => [
          ...this.world.scanCandidates,
          ...this.animals.scanCandidates(),
        ],
        completeScan: (a) => this.completeScan(a),
        hasFieldGuideEntry: (a) =>
          this.featureProgress.fieldGuideEntries.includes(a),
        discoverCurrentLocation: () => this.discoverCurrentLocation(),
        applyFallImpact: (a) => this.applyFallImpact(a),
        recoverPlayer: () => this.recoverPlayer(),
        inventoryWeight: () => U_(this.inventory),
        developerPanelOpen: !1,
      }),
      new FeatureInstaller(this.pipeline)
        .use({
          id: "world-atmosphere",
          install: (a) => {
            a.system(new AtmosphereSystem(this.environment));
          },
        })
        .use({
          id: "navigation-core",
          install: (a) => {
            a.system(new NavigationUpdateSystem());
          },
        })
        .use({
          id: "field-equipment",
          install: (a) => {
            a.system(new CameraControlSystem()).system(new EquipmentSystem());
          },
        })
        .use({
          id: "frontier-survey",
          install: (a) => {
            a.system(new PlayerControllerSystem())
              .system(new PlayerConditionSystem())
              .system(new WorldStreamingSystem())
              .system(new LocationDiscoverySystem())
              .system(new ScannerSystem())
              .system(new InteractionSystem());
          },
        })
        .use({
          id: "ambient-citizens",
          install: (a) => {
            a.system(new CitizenCrowdSystem());
          },
        })
        .use({
          id: "ambient-wildlife",
          install: (a) => {
            a.system(new AnimalPopulationSystem());
          },
        })
        .use({
          id: "field-audio",
          install: (a) => {
            a.system(new EnvironmentalAudioSystem());
          },
        }));
  }
  async initialize() {
    (this.kit.loading.progress(0.7, "Streaming the frontier…"),
      (this.offResize = this.kit.onResize(this.resize)),
      this.world.update(this.player.position.x, this.player.position.z),
      this.forestStress.update(
        this.player.position.x,
        this.player.position.z,
        this.environment.getDeveloperState().enabled,
      ));
    let e = { x: this.player.position.x, z: this.player.position.z },
      n = this.world.sampleGroundHeight(e.x, e.z, this.player.position.y),
      i = vc(e, e, this.world.queryColliders(e, e, 0.42, n, n + 1.72), 0.42);
    (this.player.position.set(i.x, n, i.z),
      this.player.safePosition.copy(this.player.position),
      this.playerCamera.position.set(i.x, n + this.player.eyeHeight, i.z),
      this.playerCamera.rotation.set(
        this.player.pitch,
        this.player.yaw,
        0,
        "YXZ",
      ),
      this.presentCamera(0, !0),
      (this.currentLocation = Nc(i.x, i.z)),
      this.horizon.update(
        this.player.position.x,
        this.player.position.z,
        this.player.position.y,
      ),
      this.citizens.updateStreaming(
        this.player.position.x,
        this.player.position.z,
      ),
      this.animals.updateStreaming(
        this.player.position.x,
        this.player.position.z,
      ),
      this.flashlight.present(this.playerCamera),
      this.environment.sync(this.player.position, !0),
      this.environment.present(this.player.position, 0, this.camera.position));
    let r = this.environment.getVisualState();
    (this.world.presentEnvironment(r),
      this.horizon.presentEnvironment(r),
      this.renderPipeline.presentEnvironment(r),
      this.synchronizeTimeDependentWorld(),
      this.syncAuthoredLandmarkTargets(),
      this.syncPlacedNavigationTargets(),
      this.syncContractNavigation());
    for (let a of this.scanned) this.world.markScanned(a);
    (document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    ),
      this.canvas.addEventListener("click", this.handleCanvasClick),
      window.addEventListener("pointerdown", this.handleAnyGesture, !0),
      window.addEventListener("keydown", this.handleAnyGesture, !0),
      (this.offKitQuality = this.kit.onQuality((a) => this.onKitQuality(a))),
      (this.offKitPause = this.kit.onPause((a) => {
        // The kit's settings panel pauses the loop; hold the survey too.
        a && this.started && !this.isMenuMode() && this.pauseGame();
      })),
      (this.offSource = this.kit.input.onSourceChange(() =>
        this.emitSnapshot(!0),
      )),
      this.kit.loading.progress(0.85, "Compiling surfaces…"),
      this.flashlight.prepareForCompile());
    try {
      await this.renderPipeline.compile();
    } finally {
      this.flashlight.finishCompile();
    }
    this.disposed ||
      (this.renderPipeline.render(0),
      (this.ready = !0),
      this.emitSnapshot(!0),
      (this.previousTime = performance.now()),
      this.kit.start((a, o) => this.frame(o * 1e3)),
      this.kit.loading.done(),
      this.testMode && this.installTestBridge());
  }
  isMenuMode() {
    return (
      !this.ready ||
      !this.started ||
      this.paused ||
      this.mapOpen ||
      this.inventoryOpen ||
      this.settingsOpen ||
      this.activeInspection !== null ||
      this.featureOverlay !== null ||
      this.developerPanelOpen ||
      this.player.condition.health <= 0
    );
  }
  // Start / P / the II pill: pause while playing, back out of a menu otherwise.
  handlePauseAction(e) {
    if (!this.ready || !this.started) return;
    let n = this.kit.input;
    if (!e) {
      (n.pressed("pause") || n.pressed("escape")) && this.pauseGame();
      return;
    }
    n.pressed("pause") && this.closeTopMenu();
  }
  pauseGame() {
    !this.started ||
      this.paused ||
      (this.graphicsBenchmark.cancel("Capture cancelled by pause"),
      (this.paused = !0),
      (this.player.sprinting = !1),
      this.input.releasePointer(),
      this.input.reset(),
      this.audio.silenceAmbient(),
      this.persist(),
      this.emitSnapshot(!0));
  }
  // Pad B / Start in a menu: close the top menu (and resume play from it).
  closeTopMenu() {
    if (!this.started) {
      this.settingsOpen && this.setSettingsOpen(!1);
      return;
    }
    if (!(this.player.condition.health <= 0)) {
      if (this.developerPanelOpen) {
        this.setDeveloperPanelOpen(!1);
        return;
      }
      (this.mapOpen ||
        this.inventoryOpen ||
        this.settingsOpen ||
        this.activeInspection ||
        this.featureOverlay ||
        this.paused) &&
        this.resume();
    }
  }
  syncTouchControls(e) {
    let n = this.kit.touch;
    if (!n) return;
    e !== this.touchSuspended &&
      ((this.touchSuspended = e), n.suspend(e, "game"));
    let i = !!this.runtime.nearbyTarget;
    i !== this.touchUseShown && ((this.touchUseShown = i), n.setShown("use", i));
  }
  // Field notices clear themselves while the survey runs: with mouse-look, a
  // pad or touch controls their dismiss buttons are out of reach mid-play, so
  // they used to stay on screen for good. Cards that share a corner show one
  // at a time (relay record, then location, then field update); the next one
  // waits its turn instead of drawing on top. Clocks hold while a menu is open.
  updateNotices(dt) {
    let clock = this.noticeClock,
      changed = !1,
      tick = (key, seconds, running) => {
        let value = this[key];
        if (!value) return ((clock[key] = null), !1);
        clock[key]?.ref !== value && (clock[key] = { ref: value, left: seconds });
        if ((running && (clock[key].left -= dt), clock[key].left > 0)) return !0;
        return ((this[key] = null), (clock[key] = null), (changed = !0), !1);
      },
      relayShown = tick("lastDiscovery", 9, !0),
      placeShown = tick("lastLocationDiscovery", 7, !relayShown);
    (tick("lastFeatureNotice", 6, !relayShown && !placeShown),
      tick("lastGather", 4, !0),
      changed && this.emitSnapshot(!0));
  }
  onKitQuality(e) {
    // The kit panel's Quality picks the matching survey profile; shadow maps
    // are re-sized for the new tier either way.
    let n = qualityForKitTier(e.name);
    n !== this.quality
      ? this.setQuality(n)
      : (this.environment.setQuality(this.quality),
        this.flashlight.setQuality(this.quality));
  }
  beginSession() {
    return this.started
      ? !1
      : ((this.sessionMode = "survey"), this.enterSession(), !0);
  }
  beginDeveloperSession() {
    return this.started
      ? !1
      : ((this.sessionMode = Qd.mode),
        this.resetForDeveloperQuickStart(),
        this.enterSession(),
        !0);
  }
  // A fresh survey from the entry screen: erases the survey save and starts
  // over at the Field Unit with a clean world record. Settings are kept.
  beginNewSurvey() {
    if (this.started) return !1;
    this.saveStore.clear();
    let e = Pc();
    ((this.scanned = [...e.scanned]),
      (this.inventory = { ...e.inventory }),
      (this.discoveredLocations = [...e.discoveredLocations]),
      (this.featureProgress = e.featureProgress),
      this.world.restorePersistentState(
        e.worldDiffs,
        e.doorStates,
        e.scanned,
        SPAWN_POSE.x,
        SPAWN_POSE.z,
        e.featureProgress.containerStates,
        e.featureProgress.placedEntities,
      ));
    for (let n of Object.keys(this.worldDiffs)) delete this.worldDiffs[n];
    for (let n of Object.keys(this.doorStates)) delete this.doorStates[n];
    for (let n of this.navigation.targetsSnapshot())
      (n.source.kind === "system" && n.source.systemId === kd) ||
        this.navigation.removeTarget(n.id);
    return (
      this.navigation.clearActive(),
      this.environment.setWorldMinutes(e.worldMinutes),
      (this.benchmarkTravelOrigin = null),
      (this.player.yaw = SPAWN_POSE.yaw),
      (this.player.pitch = SPAWN_POSE.pitch),
      (this.player.condition = fM()),
      (this.player.sheltered = !1),
      (this.player.stamina = 1),
      this.relocatePlayer(SPAWN_POSE.x, SPAWN_POSE.z),
      this.flashlight.setEnabled(!1),
      (this.lastDiscovery = null),
      (this.lastGather = null),
      (this.lastFastTravel = null),
      (this.lastLocationDiscovery = null),
      (this.lastFeatureNotice = null),
      (this.scanner.active = !1),
      (this.scanner.focusId = null),
      (this.scanner.focusEntryId = null),
      (this.scanner.focusName = null),
      (this.scanner.progress = 0),
      (this.currentLocation = Nc(SPAWN_POSE.x, SPAWN_POSE.z)),
      (this.hasSurveySave = !1),
      (this.saveStatus = this.saveStore.storage ? "unsaved" : "unavailable"),
      (this.lastSavedAt = null),
      this.syncAuthoredLandmarkTargets(),
      this.syncPlacedNavigationTargets(),
      this.syncContractNavigation(),
      this.synchronizeTimeDependentWorld(),
      (this.sessionMode = "survey"),
      this.enterSession(),
      !0
    );
  }
  enterSession() {
    ((this.started = !0),
      (this.mapOpen = !1),
      (this.inventoryOpen = !1),
      (this.settingsOpen = !1),
      (this.activeInspection = null),
      (this.featureOverlay = null),
      (this.developerPanelOpen = !1),
      (this.paused = !this.testMode),
      (this.lastClockPersistTime = performance.now()),
      this.audio.unlock(),
      this.testMode || this.input.requestPointerLock(),
      this.emitSnapshot(!0));
  }
  resetForDeveloperQuickStart() {
    let e = Pc();
    ((this.scanned = [...e.scanned]),
      (this.inventory = { ...e.inventory }),
      (this.featureProgress = e.featureProgress),
      (this.discoveredLocations = [...e.discoveredLocations]),
      this.world.restorePersistentState(
        e.worldDiffs,
        e.doorStates,
        e.scanned,
        SPAWN_POSE.x,
        SPAWN_POSE.z,
        e.featureProgress.containerStates,
        e.featureProgress.placedEntities,
      ));
    for (let i of this.navigation.targetsSnapshot())
      (i.source.kind === "system" && i.source.systemId === kd) ||
        this.navigation.removeTarget(i.id);
    (this.navigation.clearActive(),
      this.syncAuthoredLandmarkTargets(),
      this.syncPlacedNavigationTargets(),
      this.syncContractNavigation(!1),
      this.environment.setDeveloperMode(!1),
      this.environment.setWorldMinutes(Qd.worldMinutes),
      this.environment.setDeveloperMode(!0),
      this.environment.setDeveloperClockPaused(!0),
      (this.player.yaw = SPAWN_POSE.yaw),
      (this.player.pitch = SPAWN_POSE.pitch),
      (this.player.condition = { ...Fd }),
      (this.player.sheltered = !1),
      (this.player.stamina = 1),
      (this.player.staminaRecoveryDelay = 0),
      this.relocatePlayer(SPAWN_POSE.x, SPAWN_POSE.z),
      Object.assign(this.developerPlayer, Qd.player),
      (this.player.grounded = !1),
      (this.player.verticalVelocity = 0),
      (this.player.jumpBufferRemaining = 0),
      (this.player.coyoteRemaining = 0),
      this.graphicsBenchmark.reset(60),
      this.forestStress.setLevel(2),
      (this.graphicsFeatures = { ...DEFAULT_GRAPHICS_FEATURES }),
      this.applyGraphicsFeatures(),
      (this.benchmarkTravelOrigin = null),
      this.flashlight.setEnabled(!1),
      (this.lastDiscovery = null),
      (this.lastGather = null),
      (this.lastFastTravel = null),
      (this.lastLocationDiscovery = null),
      (this.lastFeatureNotice = null),
      (this.activeInspection = null),
      (this.featureOverlay = null),
      (this.scanner.active = !1),
      (this.scanner.focusId = null),
      (this.scanner.focusEntryId = null),
      (this.scanner.focusName = null),
      (this.scanner.progress = 0),
      (this.runtime.nearbyTarget = null),
      (this.runtime.nearbyDistance = null),
      this.input.reset(),
      this.environment.setDeveloperWeather(Qd.weatherId),
      this.environment.sync(this.player.position, !0),
      this.environment.present(this.player.position, 0, this.camera.position));
    let n = this.environment.getVisualState();
    (this.world.presentEnvironment(n),
      this.horizon.presentEnvironment(n),
      this.renderPipeline.presentEnvironment(n),
      this.synchronizeTimeDependentWorld());
  }
  resume() {
    this.started &&
      ((this.mapOpen = !1),
      (this.inventoryOpen = !1),
      (this.settingsOpen = !1),
      (this.activeInspection = null),
      (this.featureOverlay = null),
      (this.developerPanelOpen = !1),
      this.audio.unlock(),
      this.testMode
        ? (this.paused = !1)
        : this.input.isLocked()
          ? (this.paused = !1)
          : ((this.paused = !0), this.input.requestPointerLock()),
      this.emitSnapshot(!0));
  }
  discover(e, n) {
    let i = this.scanned.length;
    ((this.scanned = xL(this.scanned, e)),
      this.world.markScanned(e),
      this.scanned.length !== i &&
        ((this.lastDiscovery = e),
        this.applyGameplayEvent({ type: "relay.recovered", relayId: e }),
        this.persist(),
        this.audio.playCue("scan", n ? { position: n } : void 0),
        this.kit.input.rumble(0.6, 260)),
      this.emitSnapshot(!0));
  }
  performInteraction(e) {
    if (e.action === "inspect" && e.inspection) {
      (this.applyGameplayEvent({ type: "object.inspected", targetId: e.id }),
        this.persist(),
        this.setInspection(e.inspection),
        this.audio.playCue("inspect", { position: e.position }));
      return;
    }
    if (e.action === "toggle") {
      if (e.doorId) {
        let r = this.world.toggleDoor(e.doorId, this.player.position, 0.42);
        (r === "opened" || r === "closed") &&
          (this.persist(),
          this.audio.playCue(r === "opened" ? "door-open" : "door-close", {
            position: e.position,
          }));
      }
      this.emitSnapshot(!0);
      return;
    }
    if (e.action === "scan" && e.beaconId) {
      this.discover(e.beaconId, e.position);
      return;
    }
    if (e.action === "craft" && e.stationKind) {
      (this.setFeatureOverlay({
        kind: "operations",
        tab: "crafting",
        station: e.stationKind,
      }),
        this.audio.playCue("inspect", { position: e.position }));
      return;
    }
    if (e.action === "loot" && e.containerId && e.lootTableId) {
      let r = MN(
        this.featureProgress.containerStates,
        e.containerId,
        e.lootTableId,
      );
      ((this.featureProgress = {
        ...this.featureProgress,
        containerStates: r.states,
      }),
        this.world.setContainerStates(r.states),
        this.persist(),
        this.setFeatureOverlay({
          kind: "container",
          containerId: e.containerId,
        }),
        this.audio.playCue("inspect", { position: e.position }));
      return;
    }
    if (e.action === "rest" && e.restSite) {
      let r = Sx(
        this.featureProgress.placedEntities,
        this.player.position.x,
        this.player.position.z,
        this.player.position.y,
      );
      (this.setFeatureOverlay({
        kind: "rest",
        site: {
          ...e.restSite,
          sheltered: e.restSite.sheltered || r.sheltered,
          warmth: Math.max(e.restSite.warmth, r.warmth),
        },
      }),
        this.audio.playCue("inspect", { position: e.position }));
      return;
    }
    if (e.action === "talk" && e.npcId) {
      this.talkToNpc(e.npcId, e.position);
      return;
    }
    if (!e.item || (e.action !== "collect" && e.action !== "harvest")) return;
    let n = oL(
      { inventory: this.inventory, worldDiffs: this.worldDiffs },
      {
        id: e.id,
        action: e.action,
        item: e.item,
        yieldAmount: e.yieldAmount ?? 0,
        hitsRequired: e.hitsRequired,
      },
    );
    if (n.result === "unchanged") return;
    if (n.result === "full") {
      ((this.lastFeatureNotice = {
        type: "item",
        title: "Not enough stack space",
        detail:
          "Use or craft with this material, then try again. The resource is still available.",
      }),
        this.emitSnapshot(!0));
      return;
    }
    ((this.inventory = n.state.inventory),
      (this.worldDiffs = n.state.worldDiffs));
    let i = this.worldDiffs[e.id];
    (i && this.world.applyEntityDiff(e.id, i),
      (this.lastGather = {
        targetName: e.name,
        item: e.item,
        quantity: n.loot?.quantity ?? 0,
        result: n.result,
        remainingHits: n.remainingHits,
      }),
      (n.loot?.quantity ?? 0) > 0 &&
        this.applyGameplayEvent({
          type: "item.collected",
          item: e.item,
          quantity: n.loot.quantity,
        }),
      this.persist(),
      this.audio.playCue(n.result === "hit" ? "harvest" : "collect", {
        position: e.position,
      }),
      n.result === "hit"
        ? this.kit.input.rumble(0.28, 70)
        : this.kit.input.rumble(0.4, 110),
      this.emitSnapshot(!0));
  }
  setFeatureOverlay(e) {
    return (!this.started && e) || (e?.kind === "dialogue" && !uo(e.npcId))
      ? !1
      : ((this.featureOverlay = e ? structuredClone(e) : null),
        this.input.reset(),
        e &&
          (this.graphicsBenchmark.cancel("Capture cancelled by an overlay"),
          (this.mapOpen = !1),
          (this.inventoryOpen = !1),
          (this.settingsOpen = !1),
          (this.activeInspection = null),
          (this.developerPanelOpen = !1),
          (this.paused = !0),
          !this.testMode &&
            this.input.releasePointer()),
        this.emitSnapshot(!0),
        !0);
  }
  acceptContract(e) {
    let n = Qo(e);
    if (
      !n ||
      this.featureProgress.contractJournal.contracts[n.id] ||
      Ec(this.featureProgress.contractJournal)
    )
      return !1;
    let i = i3(
      this.featureProgress.contractJournal,
      n.id,
      this.environment.getPersistentWorldMinutes(),
    );
    return (
      (this.featureProgress = {
        ...this.featureProgress,
        contractJournal: this.reconcilePersistentContractEvidence(i),
      }),
      (this.lastFeatureNotice = {
        type: "contract",
        title: `${n.code} accepted`,
        detail: n.title,
      }),
      this.syncContractNavigation(),
      this.persist(),
      this.audio.playCue("discover"),
      this.emitSnapshot(!0),
      !0
    );
  }
  turnInContract(e) {
    let n = Qo(e);
    if (!n) return !1;
    let i = this.featureProgress.contractJournal.contracts[n.id];
    if (!i || i.status !== "ready") return !1;
    for (let [o, s] of Object.entries(n.rewards)) {
      let l = o;
      if (this.inventory[l] + (s ?? 0) > ITEMS[l].stackLimit)
        return (
          (this.lastFeatureNotice = {
            type: "contract",
            title: "Reward capacity exceeded",
            detail: `Make room for ${ITEMS[l].name.toLowerCase()} before reporting.`,
          }),
          this.emitSnapshot(!0),
          !1
        );
    }
    let r = r3(
      this.featureProgress.contractJournal,
      n.id,
      this.environment.getPersistentWorldMinutes(),
    );
    if (!r.rewards) return !1;
    let a = { ...this.inventory };
    for (let [o, s] of Object.entries(r.rewards)) a = cy(a, o, s ?? 0);
    return (
      (this.inventory = a),
      (this.featureProgress = {
        ...this.featureProgress,
        contractJournal: r.state,
      }),
      (this.lastFeatureNotice = {
        type: "contract",
        title: `${n.code} complete`,
        detail: "Rewards transferred to the field kit.",
      }),
      this.syncContractNavigation(),
      this.persist(),
      this.audio.playCue("discover"),
      this.kit.input.rumble(0.45, 160),
      this.emitSnapshot(!0),
      !0
    );
  }
  craftRecipe(e, n) {
    let i = Tc(e),
      r = Z3(this.inventory, e, n, this.featureProgress.unlockedRecipeIds);
    return !i || r.result !== "crafted" || !r.item
      ? ((this.lastFeatureNotice = {
          type: "craft",
          title: "Fabrication unavailable",
          detail:
            r.result === "wrong_station"
              ? "This recipe requires the Field Unit fabrication bench."
              : r.result === "locked"
                ? "The recipe has not been unlocked."
                : r.result === "inventory_full"
                  ? "The output stack is full. Use or deploy an item, then try again."
                  : "Required materials are unavailable.",
        }),
        this.emitSnapshot(!0),
        !1)
      : ((this.inventory = r.inventory),
        this.applyGameplayEvent({
          type: "item.crafted",
          recipeId: i.id,
          item: r.item,
          quantity: r.quantity,
        }),
        (this.lastFeatureNotice = {
          type: "craft",
          title: `${i.label} fabricated`,
          detail: `${r.quantity} added to the field kit.`,
        }),
        this.persist(),
        this.audio.playCue("collect"),
        this.emitSnapshot(!0),
        !0);
  }
  useInventoryItem(e) {
    if (!(e in ITEMS) || this.inventory[e] <= 0) return !1;
    let n = dy(e);
    if (!n) return !1;
    if (n === "heal") {
      if (this.player.condition.health >= 100)
        return (
          (this.lastFeatureNotice = {
            type: "item",
            title: "Vitals nominal",
            detail: "The first-aid kit was not consumed.",
          }),
          this.emitSnapshot(!0),
          !1
        );
      let r = z_(this.inventory, e, 1);
      return r
        ? ((this.inventory = r),
          (this.player.condition = {
            ...this.player.condition,
            health: Math.min(100, this.player.condition.health + 35),
            damageRecoveryDelay: 0,
          }),
          this.applyGameplayEvent({ type: "item.used", item: e }),
          (this.lastFeatureNotice = {
            type: "item",
            title: "First aid applied",
            detail: "Health restored by 35 points.",
          }),
          this.persist(),
          this.audio.playCue("recover"),
          this.emitSnapshot(!0),
          !0)
        : !1;
    }
    let i = {
      deploy_bedroll: "bedroll",
      deploy_campfire: "campfire",
      deploy_marker: "survey_marker",
      deploy_shelter: "weather_shelter",
      deploy_torch: "field_torch",
    };
    return this.placeInventoryItem(e, i[n]);
  }
  takeContainerItem(e, n, i = 1) {
    let r = F_(this.inventory, this.featureProgress.containerStates, e, n, i);
    return r.quantity <= 0
      ? !1
      : ((this.inventory = r.inventory),
        (this.featureProgress = {
          ...this.featureProgress,
          containerStates: r.states,
        }),
        this.world.setContainerStates(r.states),
        this.applyGameplayEvents([
          { type: "container.looted", containerId: e, quantity: r.quantity },
          { type: "item.collected", item: n, quantity: r.quantity },
        ]),
        (this.lastFeatureNotice = {
          type: "loot",
          title: `${ITEMS[n].name} recovered`,
          detail: `${r.quantity} transferred to the field kit.`,
        }),
        this.persist(),
        this.audio.playCue("collect"),
        this.emitSnapshot(!0),
        !0);
  }
  takeAllContainerItems(e) {
    let n = this.inventory,
      i = TN(this.inventory, this.featureProgress.containerStates, e);
    if (i.quantity <= 0) return !1;
    ((this.inventory = i.inventory),
      (this.featureProgress = {
        ...this.featureProgress,
        containerStates: i.states,
      }),
      this.world.setContainerStates(i.states));
    let r = [
      { type: "container.looted", containerId: e, quantity: i.quantity },
    ];
    for (let a of Object.keys(ITEMS)) {
      let o = i.inventory[a] - n[a];
      o > 0 && r.push({ type: "item.collected", item: a, quantity: o });
    }
    return (
      this.applyGameplayEvents(r),
      (this.lastFeatureNotice = {
        type: "loot",
        title: "Container transfer complete",
        detail: `${i.quantity} item${i.quantity === 1 ? "" : "s"} recovered.`,
      }),
      this.persist(),
      this.audio.playCue("collect"),
      this.emitSnapshot(!0),
      !0
    );
  }
  completeRest(e) {
    if (!this.featureOverlay || this.featureOverlay.kind !== "rest") return !1;
    let n = this.featureOverlay.site,
      i = K3(
        this.player.condition,
        n,
        e,
        this.environment.getPersistentWorldMinutes(),
      );
    return i.accepted
      ? ((this.player.condition = i.condition),
        this.environment.setWorldMinutes(
          this.environment.getPersistentWorldMinutes() + i.minutes,
        ),
        this.environment.sync(this.player.position, !0),
        this.environment.present(this.player.position, 0, this.camera.position),
        this.synchronizeTimeDependentWorld(),
        (this.featureProgress = {
          ...this.featureProgress,
          lastRestAt: this.environment.getPersistentWorldMinutes(),
        }),
        this.applyGameplayEvent({
          type: "rest.completed",
          siteId: n.id,
          minutes: i.minutes,
        }),
        (this.lastFeatureNotice = {
          type: "rest",
          title: "Rest cycle complete",
          detail:
            i.minutes < 1
              ? "Less than one game minute elapsed."
              : `${Math.round(i.minutes)} game minute${Math.round(i.minutes) === 1 ? "" : "s"} elapsed.`,
        }),
        this.persist(),
        this.audio.playCue("recover"),
        this.emitSnapshot(!0),
        !0)
      : !1;
  }
  talkToNpc(e, n) {
    let i = uo(e);
    return i
      ? (this.applyGameplayEvent({ type: "npc.talked", npcId: i.id }),
        this.persist(),
        this.setFeatureOverlay({ kind: "dialogue", npcId: i.id }),
        this.audio.playCue("inspect", n ? { position: n } : void 0),
        !0)
      : !1;
  }
  clearFeatureNotice() {
    ((this.lastFeatureNotice = null), this.emitSnapshot(!0));
  }
  completeScan(e) {
    let n = Id(e);
    return !n || this.featureProgress.fieldGuideEntries.includes(n.id)
      ? !1
      : ((this.featureProgress = {
          ...this.featureProgress,
          fieldGuideEntries: $N(this.featureProgress.fieldGuideEntries, n.id),
        }),
        this.applyGameplayEvent({ type: "subject.scanned", entryId: n.id }),
        (this.lastFeatureNotice = {
          type: "scan",
          title: `${n.title} catalogued`,
          detail: `${n.category.toUpperCase()} entry added to the field guide.`,
        }),
        this.persist(),
        this.audio.playCue("scan"),
        this.kit.input.rumble(0.3, 90),
        this.emitSnapshot(!0),
        !0);
  }
  placeInventoryItem(e, n) {
    if (this.featureProgress.placedEntities.length >= 64)
      return (
        (this.lastFeatureNotice = {
          type: "placement",
          title: "Deployment registry full",
          detail:
            "The current field build supports up to 64 persistent placements.",
        }),
        this.emitSnapshot(!0),
        !1
      );
    let i = n === "weather_shelter" ? 3.1 : 2.35,
      r = this.player.position.x - Math.sin(this.player.yaw) * i,
      a = this.player.position.z - Math.cos(this.player.yaw) * i,
      o = this.world.sampleGroundHeight(r, a, this.player.position.y),
      s = n === "weather_shelter" ? 1.5 : n === "bedroll" ? 0.95 : 0.55,
      l = [
        this.world.sampleGroundHeight(r + s, a, o),
        this.world.sampleGroundHeight(r - s, a, o),
        this.world.sampleGroundHeight(r, a + s, o),
        this.world.sampleGroundHeight(r, a - s, o),
      ],
      c = this.featureProgress.placedEntities.some((f) => {
        let S =
          f.archetypeId === "weather_shelter"
            ? 1.5
            : f.archetypeId === "bedroll"
              ? 0.95
              : 0.55;
        return (
          Math.abs(f.y - o) < 1.5 && Math.hypot(f.x - r, f.z - a) < S + s + 0.25
        );
      });
    if (
      !Number.isFinite(o) ||
      !l.every(Number.isFinite) ||
      sl(r, a, s) ||
      Math.abs(o - this.player.position.y) > 1.1 ||
      Math.max(...l) - Math.min(...l) > 0.65 ||
      Math.abs(r) > Ke ||
      Math.abs(a) > Ke ||
      c ||
      !this.world.canStandAt(r, a, o, s)
    )
      return (
        (this.lastFeatureNotice = {
          type: "placement",
          title: "Clear ground required",
          detail: "Face a dry, unobstructed patch of terrain and try again.",
        }),
        this.emitSnapshot(!0),
        !1
      );
    let u = this.featureProgress.nextPlacedSerial;
    if (
      !Number.isSafeInteger(u) ||
      u < 1 ||
      u > Ic ||
      this.featureProgress.placedEntities.some(
        (f) => f.id === `placed:${n}:${u}`,
      )
    )
      return (
        (this.lastFeatureNotice = {
          type: "placement",
          title: "Deployment registry unavailable",
          detail:
            "No safe persistent identifier is available for this placement.",
        }),
        this.emitSnapshot(!0),
        !1
      );
    let h = z_(this.inventory, e, 1);
    if (!h) return !1;
    let d = {
      id: `placed:${n}:${u}`,
      archetypeId: n,
      x: r,
      y: o,
      z: a,
      yaw: this.player.yaw,
    };
    this.inventory = h;
    let p = [...this.featureProgress.placedEntities, d];
    return (
      (this.featureProgress = {
        ...this.featureProgress,
        placedEntities: p,
        nextPlacedSerial: u + 1,
      }),
      this.world.setPlacedEntities(p),
      n === "survey_marker" &&
        this.navigation.setTarget(
          {
            id: d.id,
            label: `Survey marker ${u}`,
            position: { x: r, z: a },
            source: { kind: "system", systemId: "survey-markers" },
            arrivalRadius: 3,
            clearOnArrival: !1,
          },
          !1,
        ),
      this.applyGameplayEvent({ type: "item.used", item: e }),
      this.applyGameplayEvent({ type: "structure.placed", archetypeId: n }),
      (this.lastFeatureNotice = {
        type: "placement",
        title: `${ITEMS[e].name} deployed`,
        detail: "Placement registered in the persistent world record.",
      }),
      this.persist(),
      this.audio.playCue("collect"),
      this.emitSnapshot(!0),
      !0
    );
  }
  applyGameplayEvent(e) {
    return this.applyGameplayEvents([e]);
  }
  applyGameplayEvents(e) {
    let n = JSON.stringify(this.featureProgress.contractJournal),
      i = this.reconcilePersistentContractEvidence(
        e.reduce((l, c) => Cy(l, c), this.featureProgress.contractJournal),
      );
    if (JSON.stringify(i) === n) return !1;
    this.featureProgress = { ...this.featureProgress, contractJournal: i };
    let r = i.activeContractId,
      a = r ? Qo(r) : null,
      o = a ? i.contracts[a.id] : null,
      s = a && o ? Ta(a, o) : null;
    return (
      (this.lastFeatureNotice = {
        type: "contract",
        title: a ? `${a.code} updated` : "Contract updated",
        detail: s?.label ?? "Objectives complete. Report to the issuer.",
      }),
      this.syncContractNavigation(),
      !0
    );
  }
  reconcilePersistentContractEvidence(e) {
    return sL(e, {
      inventory: this.inventory,
      fieldGuideEntries: this.featureProgress.fieldGuideEntries,
      containerStates: this.featureProgress.containerStates,
      placedEntities: this.featureProgress.placedEntities,
      lastRestAt: this.featureProgress.lastRestAt,
      scanned: this.scanned,
      discoveredLocations: this.discoveredLocations,
    });
  }
  syncContractNavigation(e = !0) {
    let n = "contract:active-objective",
      i = this.featureProgress.contractJournal.activeContractId,
      r = i ? Qo(i) : null,
      a = r ? this.featureProgress.contractJournal.contracts[r.id] : null,
      o = r && a?.status === "active" ? Ta(r, a) : null,
      s =
        o?.matcher.type === "return"
          ? Pf(o.matcher.npcId, this.environment.getSample().totalMinutes)
          : null,
      l = s ? { x: s.x, z: s.z } : o?.target;
    if (!r || !o || !l) {
      this.navigation.removeTarget(n);
      return;
    }
    let c = {
        id: n,
        label: o.label,
        position: l,
        source: { kind: "quest", questId: r.id, objectiveId: o.id },
        arrivalRadius: 4,
        clearOnArrival: !1,
      },
      u = this.navigation.getTarget(n),
      h = e && this.navigation.getActiveTarget()?.id !== Dc;
    u &&
    u.label === c.label &&
    u.position.x === c.position.x &&
    u.position.z === c.position.z &&
    u.source.kind === "quest" &&
    u.source.questId === r.id &&
    u.source.objectiveId === o.id
      ? h &&
        this.navigation.getActiveTarget()?.id !== n &&
        this.navigation.activateTarget(n)
      : this.navigation.setTarget(c, h);
  }
  syncPlacedNavigationTargets() {
    for (let e of this.navigation.targetsSnapshot())
      e.source.kind === "system" &&
        e.source.systemId === "survey-markers" &&
        this.navigation.removeTarget(e.id);
    for (let e of this.featureProgress.placedEntities) {
      if (e.archetypeId !== "survey_marker") continue;
      let n = e.id.split(":").at(-1) ?? "?";
      this.navigation.setTarget(
        {
          id: e.id,
          label: `Survey marker ${n}`,
          position: { x: e.x, z: e.z },
          source: { kind: "system", systemId: "survey-markers" },
          arrivalRadius: 3,
          clearOnArrival: !1,
        },
        !1,
      );
    }
  }
  syncAuthoredLandmarkTargets() {
    for (let e of Wy)
      this.navigation.setTarget(
        {
          id: e.id,
          label: e.label,
          position: { ...e.position },
          source: { kind: "system", systemId: kd },
          arrivalRadius: e.arrivalRadius,
          clearOnArrival: !1,
        },
        !1,
      );
  }
  setMapOpen(e) {
    if (!e && this.mapOpen && this.started) {
      // Closing the map goes straight back to the survey.
      this.resume();
      return;
    }
    ((this.mapOpen = e),
      e &&
        (this.graphicsBenchmark.cancel("Capture cancelled by the map"),
        (this.developerPanelOpen = !1),
        (this.inventoryOpen = !1),
        (this.settingsOpen = !1),
        (this.activeInspection = null),
        (this.featureOverlay = null)),
      this.input.reset(),
      e &&
        !this.testMode &&
        this.input.releasePointer(),
      this.emitSnapshot(!0));
  }
  setInventoryOpen(e) {
    if (!e && this.inventoryOpen && this.started) {
      this.resume();
      return;
    }
    this.started &&
      ((this.inventoryOpen = e),
      this.input.reset(),
      e &&
        (this.graphicsBenchmark.cancel("Capture cancelled by inventory"),
        (this.mapOpen = !1),
        (this.settingsOpen = !1),
        (this.activeInspection = null),
        (this.featureOverlay = null),
        (this.developerPanelOpen = !1),
        (this.paused = !0),
        !this.testMode &&
          this.input.releasePointer()),
      this.emitSnapshot(!0));
  }
  setSettingsOpen(e) {
    this.ready &&
      ((this.settingsOpen = e),
      this.input.reset(),
      e &&
        (this.graphicsBenchmark.cancel("Capture cancelled by settings"),
        (this.mapOpen = !1),
        (this.inventoryOpen = !1),
        (this.activeInspection = null),
        (this.featureOverlay = null),
        (this.developerPanelOpen = !1),
        this.started && (this.paused = !0),
        !this.testMode &&
          this.input.releasePointer()),
      this.emitSnapshot(!0));
  }
  setInspection(e) {
    this.started &&
      ((this.activeInspection = e ? { ...e } : null),
      this.input.reset(),
      e &&
        (this.graphicsBenchmark.cancel("Capture cancelled by inspection"),
        (this.mapOpen = !1),
        (this.inventoryOpen = !1),
        (this.settingsOpen = !1),
        (this.developerPanelOpen = !1),
        (this.featureOverlay = null),
        (this.paused = !0),
        !this.testMode &&
          this.input.releasePointer()),
      this.emitSnapshot(!0));
  }
  setDeveloperPanelOpen(e) {
    if (this.started) {
      if (((this.developerPanelOpen = e), this.input.reset(), e)) {
        (this.graphicsBenchmark.cancel("Capture cancelled by developer panel"),
          (this.mapOpen = !1),
          (this.inventoryOpen = !1),
          (this.settingsOpen = !1),
          (this.activeInspection = null),
          (this.featureOverlay = null),
          (this.paused = !0),
          !this.testMode &&
            this.input.releasePointer(),
          this.emitSnapshot(!0));
        return;
      }
      this.resume();
    }
  }
  setDeveloperMode(e) {
    (e ||
      (this.graphicsBenchmark.invalidate("Developer mode disabled"),
      (this.graphicsFeatures = { ...DEFAULT_GRAPHICS_FEATURES }),
      this.resetDeveloperPlayerSandbox(),
      this.applyGraphicsFeatures()),
      this.environment.setDeveloperMode(e),
      this.refreshEnvironment());
  }
  setDeveloperTimeOfDay(e) {
    (this.graphicsBenchmark.invalidate("Time of day changed"),
      this.environment.setDeveloperMinuteOfDay(e),
      this.refreshEnvironment());
  }
  advanceDeveloperMinutes(e) {
    (this.graphicsBenchmark.invalidate("Time of day changed"),
      this.environment.advanceDeveloperMinutes(e),
      this.refreshEnvironment());
  }
  setDeveloperClockPaused(e) {
    (this.graphicsBenchmark.invalidate("Clock policy changed"),
      this.environment.setDeveloperClockPaused(e),
      this.refreshEnvironment(!1));
  }
  setDeveloperWeather(e) {
    let n = this.environment.setDeveloperWeather(e);
    return (
      n && this.graphicsBenchmark.invalidate("Weather profile changed"),
      this.refreshEnvironment(),
      n
    );
  }
  setDeveloperInvincible(e) {
    if (!this.environment.getDeveloperState().enabled) return !1;
    let n = !!e;
    return this.developerPlayer.invincible === n
      ? !1
      : ((this.developerPlayer.invincible = n), this.emitSnapshot(!0), !0);
  }
  setDeveloperSpeedMode(e) {
    return !this.environment.getDeveloperState().enabled ||
      !dD(e) ||
      this.developerPlayer.speedMode === e
      ? !1
      : ((this.developerPlayer.speedMode = e), this.emitSnapshot(!0), !0);
  }
  setDeveloperFly(e) {
    if (!this.environment.getDeveloperState().enabled) return !1;
    let n = !!e;
    return this.developerPlayer.fly === n
      ? !1
      : ((this.developerPlayer.fly = n),
        (this.player.verticalVelocity = 0),
        (this.player.jumpBufferRemaining = 0),
        (this.player.coyoteRemaining = 0),
        n
          ? ((this.player.grounded = !1),
            (this.player.crouching = !1),
            (this.player.sprinting = !1),
            (this.player.eyeHeight = 1.72))
          : this.landDeveloperPlayer(),
        this.emitSnapshot(!0),
        !0);
  }
  resetDeveloperOverrides() {
    (this.environment.resetDeveloperOverrides(),
      this.graphicsBenchmark.reset(60),
      this.forestStress.setLevel(2),
      (this.graphicsFeatures = { ...DEFAULT_GRAPHICS_FEATURES }),
      this.resetDeveloperPlayerSandbox(),
      this.applyGraphicsFeatures(),
      this.refreshEnvironment());
  }
  resetDeveloperPlayerSandbox() {
    let e = this.developerPlayer.fly;
    (u1(this.developerPlayer), e && this.landDeveloperPlayer());
  }
  landDeveloperPlayer() {
    let e = this.player.safePosition,
      n = this.world.sampleGroundHeight(e.x, e.z, e.y);
    this.relocatePlayer(e.x, e.z, n);
  }
  setGraphicsFeature(e, n) {
    if (!this.environment.getDeveloperState().enabled || !lD(e)) return !1;
    let i = cD(this.graphicsFeatures, e, n);
    return i === this.graphicsFeatures
      ? !1
      : ((this.graphicsFeatures = i),
        this.graphicsBenchmark.invalidate(`Graphics feature ${e} changed`),
        this.applyGraphicsFeatures(),
        this.refreshEnvironment(!1),
        !0);
  }
  applyGraphicsFeatures() {
    (this.materialLibrary.setFeatures(this.graphicsFeatures),
      this.renderPipeline.setFeatures(this.graphicsFeatures),
      this.horizon.setGraphicsFeatures(this.graphicsFeatures),
      this.environment.setShadowStabilization(
        this.graphicsFeatures.shadowStabilization,
      ),
      this.environment.setStormLightning(this.graphicsFeatures.stormLightning));
  }
  setGraphicsBenchmarkTarget(e) {
    let n = this.graphicsBenchmark.setTarget(e);
    return (n && this.emitSnapshot(!0), n);
  }
  startGraphicsBenchmark() {
    if (
      !this.started ||
      !this.environment.getDeveloperState().enabled ||
      this.contextStatus !== "ready"
    )
      return !1;
    let e = this.renderPipeline.diagnostics,
      n = this.forestStress.diagnostics,
      i = this.environment.getSample(),
      r = Number(navigator.deviceMemory),
      a = {
        capturedAt: new Date().toISOString(),
        worldSeed: ot,
        quality: this.quality,
        horizonMode: this.horizonMode,
        worldDetail: this.settings.worldDetail,
        resolution: {
          width: e.drawingBufferWidth,
          height: e.drawingBufferHeight,
          pixelRatio: e.pixelRatio,
        },
        forest: {
          active: n.active,
          level: n.level,
          label: n.levelLabel,
          trees: n.trees,
          groundcover: n.groundcover,
          rocks: n.rocks,
          reeds: n.reeds,
        },
        viewpoint: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          heading: Yg(this.player.yaw),
          fov: this.camera.fov,
        },
        camera: {
          ...this.cameraRig.diagnostics,
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z,
        },
        environment: {
          worldMinutes: i.totalMinutes,
          weatherId: i.weatherId,
          weatherLabel: i.weatherLabel,
          visibilityMeters: i.visibilityMeters,
          precipitation: i.precipitation,
        },
        flashlightOn: this.flashlight.isEnabled,
        graphicsFeatures: { ...this.graphicsFeatures },
        hardware: {
          userAgent: navigator.userAgent,
          hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
            ? navigator.hardwareConcurrency
            : null,
          deviceMemoryGb: Number.isFinite(r) ? r : null,
          gpuVendor: e.gpuVendor,
          gpuRenderer: e.gpuRenderer,
        },
      };
    return this.graphicsBenchmark.start(
      performance.now(),
      e.gpuTimerSupported,
      a,
    )
      ? ((this.developerPanelOpen = !1), this.resume(), !0)
      : !1;
  }
  cancelGraphicsBenchmark() {
    let e = this.graphicsBenchmark.cancel();
    return (e && this.emitSnapshot(!0), e);
  }
  setForestStressLevel(e) {
    return !this.environment.getDeveloperState().enabled ||
      !this.forestStress.setLevel(e)
      ? !1
      : (this.graphicsBenchmark.invalidate("Forest load changed"),
        this.emitSnapshot(!0),
        !0);
  }
  travelToForestStressTest() {
    if (!this.environment.getDeveloperState().enabled) return !1;
    let { arrival: e, center: n } = wt;
    return (
      this.benchmarkTravelOrigin === null &&
        (this.benchmarkTravelOrigin = {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          yaw: this.player.yaw,
          pitch: this.player.pitch,
        }),
      this.graphicsBenchmark.invalidate("Viewpoint changed"),
      this.relocatePlayer(
        e.x,
        e.z,
        this.world.sampleGroundHeight(e.x, e.z),
        n.x,
        n.z,
      ),
      (this.developerPanelOpen = !1),
      this.resume(),
      this.emitSnapshot(!0),
      !0
    );
  }
  setManualWaypoint(e, n) {
    if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
    let i = this.navigation.setManualWaypoint({
      x: Ya(e, -Ke, Ke),
      z: Ya(n, -Ke, Ke),
    });
    return i
      ? (this.persist(), this.emitPresentation(), this.emitSnapshot(!0), i)
      : null;
  }
  clearManualWaypoint() {
    return this.navigation.removeTarget(Dc)
      ? (this.syncContractNavigation(),
        this.persist(),
        this.emitPresentation(),
        this.emitSnapshot(!0),
        !0)
      : !1;
  }
  fastTravel(e) {
    let n = j3(e);
    if (!n) return null;
    let i = wM(n);
    this.world.update(i.x, i.z);
    let r = wM(n, this.world.colliders);
    return (
      this.relocatePlayer(r.x, r.z, r.y, n.x, n.z),
      (this.lastFastTravel = { id: n.id, name: n.name, kind: n.kind }),
      this.persist(),
      this.emitSnapshot(!0),
      { location: n, arrival: r }
    );
  }
  setWorldMinutes(e) {
    (this.graphicsBenchmark.invalidate("World time changed"),
      this.environment.setWorldMinutes(e),
      this.environment.sync(this.player.position, !0),
      this.environment.present(this.player.position, 0, this.camera.position),
      this.synchronizeTimeDependentWorld(),
      this.persist(),
      this.emitSnapshot(!0));
  }
  setHorizonMode(e) {
    return !Kg(e) || e === this.horizonMode
      ? !1
      : (this.graphicsBenchmark.invalidate("Horizon profile changed"),
        (this.horizonMode = e),
        (this.settings = { ...this.settings, horizonMode: e }),
        (this.runtime.settings = this.settings),
        (this.camera.far = HORIZON_PROFILES[e].drawDistanceMeters),
        this.camera.updateProjectionMatrix(),
        (this.playerCamera.far = HORIZON_PROFILES[e].drawDistanceMeters),
        this.playerCamera.updateProjectionMatrix(),
        this.horizon.setMode(e),
        this.environment.setHorizonMode(e),
        this.environment.sync(this.player.position),
        this.environment.present(this.player.position, 0, this.camera.position),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setWorldDetail(e) {
    let n = Nr({ ...this.settings, worldDetail: e }, this.horizonMode);
    return n.worldDetail === this.settings.worldDetail
      ? !1
      : (this.graphicsBenchmark.invalidate("World LOD changed"),
        (this.settings = n),
        (this.runtime.settings = this.settings),
        this.horizon.setDetailLevel(n.worldDetail),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setInterfaceScale(e) {
    let n = Nr({ ...this.settings, interfaceScale: e }, this.horizonMode);
    return n.interfaceScale === this.settings.interfaceScale
      ? !1
      : ((this.settings = n),
        (this.runtime.settings = this.settings),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setFov(e) {
    let n = Nr({ ...this.settings, fov: e }, this.horizonMode);
    return n.fov === this.settings.fov
      ? !1
      : (this.graphicsBenchmark.invalidate("Field of view changed"),
        (this.settings = n),
        (this.runtime.settings = this.settings),
        (this.camera.fov = n.fov),
        this.camera.updateProjectionMatrix(),
        (this.playerCamera.fov = n.fov),
        this.playerCamera.updateProjectionMatrix(),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setCameraDistance(e, n = !1) {
    return this.applyCameraDistance(e, n, !0, !0);
  }
  setCameraView(e, n = !1) {
    return Xo.includes(e) ? this.setCameraDistance(A_(e), n) : !1;
  }
  setIsometricAngle(e) {
    let n = _d(e);
    return n === this.settings.isometricAngle
      ? !1
      : (this.graphicsBenchmark.invalidate("Isometric camera angle changed"),
        (this.settings = { ...this.settings, isometricAngle: n }),
        (this.runtime.settings = this.settings),
        this.cameraRig.setIsometricAngle(n),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  applyCameraDistance(e, n, i, r) {
    let a = Yo(e);
    return a === this.settings.cameraDistance
      ? !1
      : (this.graphicsBenchmark.invalidate("Camera view changed"),
        (this.settings = { ...this.settings, cameraDistance: a }),
        (this.runtime.settings = this.settings),
        this.cameraRig.setDistance(a, n),
        n && this.presentCamera(0, !0),
        i && this.persistPreferences(),
        r && this.emitSnapshot(!0),
        !0);
  }
  adjustCameraZoom(e) {
    let n = vN(this.settings.cameraDistance, e);
    this.applyCameraDistance(n, !1, !1, !1) &&
      this.queueCameraPreferencePersistence();
  }
  cycleCameraView() {
    this.setCameraDistance(gN(this.settings.cameraDistance));
  }
  queueCameraPreferencePersistence() {
    (this.cameraPreferenceTimer !== null &&
      window.clearTimeout(this.cameraPreferenceTimer),
      (this.cameraPreferenceTimer = window.setTimeout(() => {
        ((this.cameraPreferenceTimer = null), this.persistPreferences());
      }, 180)));
  }
  setLookSensitivity(e) {
    let n = Nr({ ...this.settings, lookSensitivity: e }, this.horizonMode);
    return n.lookSensitivity === this.settings.lookSensitivity
      ? !1
      : ((this.settings = n),
        (this.runtime.settings = this.settings),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setInvertY(e) {
    return e === this.settings.invertY
      ? !1
      : ((this.settings = { ...this.settings, invertY: e }),
        (this.runtime.settings = this.settings),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setAudioVolume(e, n) {
    let i = Nr({ ...this.settings, [e]: n }, this.horizonMode);
    return i[e] === this.settings[e]
      ? !1
      : ((this.settings = i),
        (this.runtime.settings = this.settings),
        this.audio.setLevels(cw(this.settings)),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  setKeyBinding(e, n) {
    let i = I_(this.settings.keyBindings, e, n);
    return i
      ? ((this.settings = { ...this.settings, keyBindings: i }),
        (this.runtime.settings = this.settings),
        this.input.setBindings(i),
        (this.touchUseShown = null),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0)
      : !1;
  }
  resetSettings() {
    (this.graphicsBenchmark.invalidate("Graphics settings reset"),
      (this.settings = {
        ...DEFAULT_SETTINGS,
        keyBindings: { ...DEFAULT_SETTINGS.keyBindings },
      }),
      (this.runtime.settings = this.settings),
      this.input.setBindings(this.settings.keyBindings),
      (this.touchUseShown = null),
      this.audio.setLevels(cw(this.settings)),
      (this.camera.fov = this.settings.fov),
      this.camera.updateProjectionMatrix(),
      (this.playerCamera.fov = this.settings.fov),
      this.playerCamera.updateProjectionMatrix(),
      this.cameraRig.setDistance(this.settings.cameraDistance, !0),
      this.cameraRig.setIsometricAngle(this.settings.isometricAngle),
      this.quality !== this.settings.quality &&
        this.applyQuality(this.settings.quality),
      this.horizonMode !== this.settings.horizonMode &&
        ((this.horizonMode = this.settings.horizonMode),
        (this.camera.far =
          HORIZON_PROFILES[this.horizonMode].drawDistanceMeters),
        this.camera.updateProjectionMatrix(),
        (this.playerCamera.far =
          HORIZON_PROFILES[this.horizonMode].drawDistanceMeters),
        this.playerCamera.updateProjectionMatrix(),
        this.horizon.setMode(this.horizonMode),
        this.environment.setHorizonMode(this.horizonMode)),
      this.horizon.setDetailLevel(this.settings.worldDetail),
      this.persistPreferences(),
      this.emitSnapshot(!0));
  }
  saveNow() {
    let e = this.persist();
    return (e && this.audio.playCue("save"), this.emitSnapshot(!0), e);
  }
  loadGame() {
    if (!this.saveStore.hasSave()) return !1;
    let e = this.saveStore.load();
    (this.environment.setDeveloperMode(!1),
      u1(this.developerPlayer),
      this.graphicsBenchmark.reset(60),
      this.forestStress.setLevel(2),
      (this.graphicsFeatures = { ...DEFAULT_GRAPHICS_FEATURES }),
      this.applyGraphicsFeatures(),
      (this.scanned = [...e.scanned]),
      (this.inventory = { ...e.inventory }),
      (this.discoveredLocations = [...e.discoveredLocations]),
      (this.featureProgress = e.featureProgress),
      (this.featureProgress = {
        ...this.featureProgress,
        contractJournal: this.reconcilePersistentContractEvidence(
          this.featureProgress.contractJournal,
        ),
      }));
    let n = e.player,
      i = n?.x ?? SPAWN_POSE.x,
      r = n?.z ?? SPAWN_POSE.z;
    this.world.restorePersistentState(
      e.worldDiffs,
      e.doorStates,
      this.scanned,
      i,
      r,
      this.featureProgress.containerStates,
      this.featureProgress.placedEntities,
    );
    for (let o of Object.keys(this.worldDiffs)) delete this.worldDiffs[o];
    Object.assign(this.worldDiffs, e.worldDiffs);
    for (let o of Object.keys(this.doorStates)) delete this.doorStates[o];
    Object.assign(this.doorStates, e.doorStates);
    for (let o of this.navigation.targetsSnapshot())
      (o.source.kind === "system" && o.source.systemId === kd) ||
        this.navigation.removeTarget(o.id);
    (this.navigation.clearActive(),
      e.manualWaypoint && this.navigation.setManualWaypoint(e.manualWaypoint),
      this.environment.setWorldMinutes(e.worldMinutes),
      (this.benchmarkTravelOrigin = null),
      (this.player.yaw = n?.yaw ?? SPAWN_POSE.yaw),
      (this.player.pitch = n?.pitch ?? SPAWN_POSE.pitch),
      (this.player.condition =
        n && n.health > 0
          ? {
              ...Fd,
              health: n.health,
              wetness: n.wetness,
              coldStress: n.coldStress,
            }
          : fM()));
    let a = this.world.sampleGroundHeight(i, r, n?.y);
    return (
      this.relocatePlayer(i, r, a),
      (this.currentLocation = Nc(i, r)),
      (this.lastDiscovery = null),
      (this.lastGather = null),
      (this.lastFastTravel = null),
      (this.lastLocationDiscovery = null),
      (this.lastFeatureNotice = null),
      (this.saveStatus = "saved"),
      (this.hasSurveySave = !0),
      (this.inventoryOpen = !1),
      (this.settingsOpen = !1),
      (this.activeInspection = null),
      (this.mapOpen = !1),
      (this.developerPanelOpen = !1),
      (this.featureOverlay = null),
      (this.scanner.active = !1),
      (this.scanner.focusId = null),
      (this.scanner.focusEntryId = null),
      (this.scanner.focusName = null),
      (this.scanner.progress = 0),
      this.syncAuthoredLandmarkTargets(),
      this.syncPlacedNavigationTargets(),
      this.syncContractNavigation(),
      (this.sessionMode = "survey"),
      this.emitSnapshot(!0),
      !0
    );
  }
  recoverPlayer() {
    ((this.player.condition = fM()),
      (this.player.sheltered = !1),
      (this.player.stamina = 1),
      this.relocatePlayer(SPAWN_POSE.x, SPAWN_POSE.z),
      (this.mapOpen = !1),
      (this.inventoryOpen = !1),
      (this.settingsOpen = !1),
      (this.activeInspection = null),
      (this.featureOverlay = null),
      (this.developerPanelOpen = !1),
      (this.paused = !this.testMode),
      this.persist(),
      this.audio.playCue("recover"),
      this.testMode || this.input.requestPointerLock(),
      this.emitSnapshot(!0));
  }
  applyFallImpact(e) {
    let n = W3(e);
    if (n <= 0 || this.developerPlayer.invincible) return 0;
    let i = this.player.condition.health;
    return (
      (this.player.condition = X3(this.player.condition, n, "fall")),
      this.player.condition.health < i &&
        (this.audio.playCue("damage"),
        this.kit.input.rumble(Math.min(1, 0.35 + n / 45), 200),
        this.persist()),
      this.player.condition.health <= 0 &&
        ((this.paused = !0),
        (this.player.sprinting = !1),
        !this.testMode &&
          this.input.releasePointer()),
      this.emitSnapshot(!0),
      i - this.player.condition.health
    );
  }
  setPlayerHealth(e) {
    if (!Number.isFinite(e)) return this.player.condition.health;
    let n = this.player.condition.health,
      i = THREE.MathUtils.clamp(e, 0, 100);
    return this.developerPlayer.invincible && i < n
      ? (this.emitSnapshot(!0), n)
      : ((this.player.condition = {
          ...this.player.condition,
          health: i,
          damageRecoveryDelay: i < n ? 8 : 0,
          lastDamage:
            i < n
              ? { kind: "exposure", amount: n - i }
              : this.player.condition.lastDamage,
        }),
        i <= 0 &&
          ((this.paused = !0),
          !this.testMode &&
            this.input.releasePointer()),
        this.emitSnapshot(!0),
        i);
  }
  advanceWorldMinutes(e) {
    Number.isFinite(e) &&
      this.setWorldMinutes(this.environment.getPersistentWorldMinutes() + e);
  }
  setNavigationTarget(e, n = !0) {
    let i = this.navigation.setTarget(e, n);
    return i ? (this.emitPresentation(), this.emitSnapshot(!0), i) : null;
  }
  activateNavigationTarget(e) {
    let n = this.navigation.activateTarget(e);
    return (n && (this.emitPresentation(), this.emitSnapshot(!0)), n);
  }
  clearActiveNavigationTarget(e) {
    let n = this.navigation.getActiveTarget()?.id ?? null,
      i = this.navigation.clearActive(e);
    return (
      i &&
        (n === Dc && this.syncContractNavigation(),
        this.emitPresentation(),
        this.emitSnapshot(!0)),
      i
    );
  }
  removeNavigationTarget(e) {
    let n = this.navigation.removeTarget(e);
    return (
      n &&
        (e === Dc && (this.syncContractNavigation(), this.persist()),
        this.emitPresentation(),
        this.emitSnapshot(!0)),
      n
    );
  }
  discoverCurrentLocation() {
    let e = Nc(this.player.position.x, this.player.position.z),
      n = e.id !== this.currentLocation.id;
    return (
      (this.currentLocation = e),
      this.discoveredLocations.includes(e.id)
        ? (n && this.emitSnapshot(!0), !1)
        : ((this.discoveredLocations = KP(this.discoveredLocations, e.id)),
          (this.lastLocationDiscovery = e),
          this.applyGameplayEvent({
            type: "location.discovered",
            locationId: e.id,
          }),
          this.persist(),
          this.audio.playCue("discover"),
          this.kit.input.rumble(0.25, 120),
          this.emitSnapshot(!0),
          !0)
    );
  }
  clearDiscoveryNotice() {
    ((this.lastDiscovery = null), this.emitSnapshot(!0));
  }
  clearGatherNotice() {
    ((this.lastGather = null), this.emitSnapshot(!0));
  }
  clearLocationDiscoveryNotice() {
    ((this.lastLocationDiscovery = null), this.emitSnapshot(!0));
  }
  toggleFlashlight() {
    this.graphicsBenchmark.invalidate("Flashlight state changed");
    let e = this.flashlight.toggle();
    return (this.emitSnapshot(!0), e);
  }
  setFlashlightEnabled(e) {
    return (
      e !== this.flashlight.isEnabled &&
        this.graphicsBenchmark.invalidate("Flashlight state changed"),
      this.flashlight.setEnabled(e),
      this.emitSnapshot(!0),
      this.flashlight.isEnabled
    );
  }
  relocatePlayer(e, n, i = this.world.sampleGroundHeight(e, n), r, a) {
    (this.player.position.set(e, i, n),
      (this.player.verticalVelocity = 0),
      (this.player.grounded = !0),
      (this.player.crouching = !1),
      (this.player.sprinting = !1),
      (this.player.staminaRecoveryDelay = 0),
      (this.player.eyeHeight = 1.72),
      (this.player.jumpBufferRemaining = 0),
      (this.player.coyoteRemaining = 0),
      (this.player.groundedSafeTime = 0),
      this.player.safePosition.set(e, i, n),
      r !== void 0 &&
        a !== void 0 &&
        ((this.player.yaw = Math.atan2(-(r - e), -(a - n))),
        (this.player.pitch = -0.035)),
      this.playerCamera.position.set(e, i + 1.72, n),
      this.playerCamera.rotation.set(
        this.player.pitch,
        this.player.yaw,
        0,
        "YXZ",
      ),
      (this.runtime.nearbyTarget = null),
      (this.runtime.nearbyDistance = null),
      this.world.update(e, n),
      this.presentCamera(0, !0),
      this.benchmarkTravelOrigin &&
        Math.hypot(e - wt.center.x, n - wt.center.z) > wt.unloadRadius &&
        (this.benchmarkTravelOrigin = null),
      this.forestStress.update(
        e,
        n,
        this.environment.getDeveloperState().enabled,
      ),
      this.horizon.update(e, n, i),
      this.citizens.update(e, n, 0, !0),
      this.animals.update(e, n, 0, !0),
      this.navigation.update(this.player.position),
      this.environment.sync(this.player.position, !0),
      this.environment.present(this.player.position, 0, this.camera.position),
      this.flashlight.present(this.playerCamera),
      this.synchronizeTimeDependentWorld(),
      (this.currentLocation = Nc(e, n)),
      this.emitPresentation());
  }
  persist() {
    if (!BL(this.sessionMode)) return !1;
    let e = this.navigation.getTarget(Dc)?.position ?? null,
      n = this.benchmarkTravelOrigin,
      i =
        n !== null &&
        Math.hypot(
          this.player.position.x - wt.center.x,
          this.player.position.z - wt.center.z,
        ) <= wt.unloadRadius;
    i || (this.benchmarkTravelOrigin = null);
    let r = i
        ? n
        : this.developerPlayer.fly
          ? {
              x: this.player.safePosition.x,
              y: this.player.safePosition.y,
              z: this.player.safePosition.z,
              yaw: this.player.yaw,
              pitch: this.player.pitch,
            }
          : {
              x: this.player.position.x,
              y: this.player.position.y,
              z: this.player.position.z,
              yaw: this.player.yaw,
              pitch: this.player.pitch,
            },
      a = this.saveStore.save({
        scanned: this.scanned,
        inventory: this.inventory,
        worldDiffs: this.worldDiffs,
        doorStates: this.doorStates,
        manualWaypoint: e,
        worldMinutes: this.environment.getPersistentWorldMinutes(),
        horizonMode: this.horizonMode,
        player: {
          x: r.x,
          y: r.y,
          z: r.z,
          yaw: r.yaw,
          pitch: r.pitch,
          health: this.player.condition.health,
          wetness: this.player.condition.wetness,
          coldStress: this.player.condition.coldStress,
        },
        discoveredLocations: this.discoveredLocations,
        featureProgress: this.featureProgress,
      });
    return (
      (this.saveStatus = a ? "saved" : "unavailable"),
      (this.hasSurveySave = a || this.saveStore.hasSave()),
      a && (this.lastSavedAt = Date.now()),
      a
    );
  }
  persistPreferences() {
    return this.preferencesStore.save(this.settings);
  }
  presentCamera(e, n = !1) {
    this.playerCamera.updateMatrixWorld(!0);
    let i = this.cameraRig.present({
      playerCamera: this.playerCamera,
      renderCamera: this.camera,
      world: this.world,
      playerPosition: this.player.position,
      eyeHeight: this.player.eyeHeight,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      baseFov: this.settings.fov,
      baseFar: HORIZON_PROFILES[this.horizonMode].drawDistanceMeters,
      deltaSeconds: e,
      snap: n || this.reducedCameraMotion,
    });
    return (
      this.playerAvatar.present(
        this.player.position,
        this.player.yaw,
        this.player.eyeHeight,
        i,
      ),
      i
    );
  }
  dispose() {
    this.disposed ||
      (this.started && this.persist(),
      (this.disposed = !0),
      this.cameraPreferenceTimer !== null &&
        (window.clearTimeout(this.cameraPreferenceTimer),
        (this.cameraPreferenceTimer = null),
        this.persistPreferences()),
      this.kit.stop(),
      this.offResize?.(),
      this.offKitQuality?.(),
      this.offKitPause?.(),
      this.offSource?.(),
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      ),
      this.canvas.removeEventListener("click", this.handleCanvasClick),
      window.removeEventListener("pointerdown", this.handleAnyGesture, !0),
      window.removeEventListener("keydown", this.handleAnyGesture, !0),
      this.input.dispose(),
      this.pipeline.dispose(),
      this.navigation.dispose(),
      this.citizens.dispose(),
      this.animals.dispose(),
      this.playerAvatar.dispose(),
      this.flashlight.dispose(),
      this.audio.dispose(),
      this.forestStress.dispose(),
      this.world.dispose(),
      this.materialLibrary.dispose(),
      this.horizon.dispose(),
      this.environment.dispose(),
      this.renderPipeline.dispose(),
      window.__STILLPOINT_TEST__ && delete window.__STILLPOINT_TEST__);
  }
  trackPerformance(e) {
    ((this.framesSinceSample += 1),
      this.fpsSampleStarted || (this.fpsSampleStarted = e));
    let n = e - this.fpsSampleStarted;
    n < 650 ||
      ((this.fps = Math.round((this.framesSinceSample * 1e3) / n)),
      (this.framesSinceSample = 0),
      (this.fpsSampleStarted = e));
  }
  updateSafePosition(e) {
    if (!this.player.grounded || this.player.condition.health <= 0) {
      this.player.groundedSafeTime = 0;
      return;
    }
    ((this.player.groundedSafeTime += e),
      this.player.groundedSafeTime >= 0.75 &&
        (this.player.safePosition.copy(this.player.position),
        (this.player.groundedSafeTime = 0.75)));
  }
  emitSnapshot(e = !1) {
    if (!e) return;
    ((this.lastSnapshotTime = performance.now()),
      this.syncContractNavigation(!1));
    let n = qn(this.player.position.x, this.player.position.z),
      i = Yg(this.player.yaw),
      r = ui(this.player.position.x, this.player.position.z),
      a = xc(this.player.position.x, this.player.position.z),
      o = this.environment.getSample(),
      s = this.environment.getDeveloperState(),
      l = this.runtime.nearbyTarget,
      c = this.horizon.diagnostics,
      u = this.renderPipeline.diagnostics,
      h = U_(this.inventory),
      d = _N(this.inventory),
      p = {
        sheltered: this.player.sheltered,
        stamina: this.player.stamina,
        inventoryWeight: h,
      };
    ((this.snapshot = {
      ready: this.ready,
      started: this.started,
      inputSource: this.kit.input.source,
      renderBackend: this.kit.backendLabel.toUpperCase(),
      sessionMode: this.sessionMode,
      paused: this.paused,
      mapOpen: this.mapOpen,
      inventoryOpen: this.inventoryOpen,
      settingsOpen: this.settingsOpen,
      inspectionOpen: this.activeInspection !== null,
      activeInspection: this.activeInspection
        ? { ...this.activeInspection }
        : null,
      featureOverlay: this.featureOverlay
        ? structuredClone(this.featureOverlay)
        : null,
      devTools: {
        enabled: s.enabled,
        panelOpen: this.developerPanelOpen,
        clockPaused: s.clockPaused,
        persistentWorldMinutes: this.environment.getPersistentWorldMinutes(),
        weatherOverride: s.weatherOverride,
        weatherOptions: this.environment.getDeveloperWeatherOptions(),
        graphicsFeatures: { ...this.graphicsFeatures },
        player: { ...this.developerPlayer },
      },
      contextStatus: this.contextStatus,
      camera: this.cameraRig.diagnostics,
      position: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      },
      heading: i,
      navigation: this.navigation.getGuidance(this.player.position, i),
      navigationTargets: this.navigation.targetsSnapshot(),
      fps: this.fps,
      chunk: n,
      loadedChunks: this.world.loadedCount,
      drawDistanceMeters: HORIZON_PROFILES[this.horizonMode].drawDistanceMeters,
      horizonMode: this.horizonMode,
      horizonTiles: c.terrainTiles,
      horizonTriangles: c.terrainTriangles,
      horizonSettlementInstances: c.settlementInstances,
      horizonSettlementLightInstances: c.settlementLightInstances,
      horizonSceneryInstances: c.sceneryInstances,
      horizonDetailDistanceMeters: c.detailDistanceMeters,
      horizonNearCellSize: c.nearCellSize,
      citizenCount: this.citizens.visibleCount,
      citizenActivity: this.citizens.activityMultiplier,
      animalCount: this.animals.visibleCount,
      animalSpecies: this.animals.visibleSpeciesCount,
      crowdDensity: this.citizens.density,
      triangles: this.renderer.info.render.triangles,
      drawCalls: u.drawCalls,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      drawingBufferWidth: u.drawingBufferWidth,
      drawingBufferHeight: u.drawingBufferHeight,
      pixelRatio: u.pixelRatio,
      cpuRenderMilliseconds: u.cpuRenderMilliseconds,
      gpuRenderMilliseconds: u.gpuRenderMilliseconds,
      gpuTimerSupported: u.gpuTimerSupported,
      gpuTimerStatus: u.gpuTimerStatus,
      graphicsPipeline: {
        postProcessing: u.postProcessing,
        fallback: u.postProcessingFallback,
        bloom: u.bloom,
        gtao: u.gtao,
        grading: u.grading,
        environmentReflections: u.environmentMap.active,
      },
      graphicsBenchmark: this.graphicsBenchmark.snapshot,
      forestStress: this.forestStress.diagnostics,
      quality: this.quality,
      scanned: [...this.scanned],
      inventory: { ...this.inventory },
      inventoryWeight: h,
      inventoryItemCount: d,
      worldChanges: Object.values(this.worldDiffs).filter((f) => f.removed)
        .length,
      grounded: this.player.grounded,
      crouching: this.player.crouching,
      sprinting: this.player.sprinting,
      stamina: this.player.stamina,
      health: this.player.condition.health,
      maxHealth: 100,
      wetness: this.player.condition.wetness,
      coldStress: this.player.condition.coldStress,
      apparentTemperatureC: mM(
        o.temperatureC,
        o.windKph,
        this.player.condition.wetness,
      ),
      sheltered: this.player.sheltered,
      conditions: q3(this.player.condition, p),
      incapacitated: this.player.condition.health <= 0,
      lastDamage: this.player.condition.lastDamage
        ? { ...this.player.condition.lastDamage }
        : null,
      flashlightOn: this.flashlight.isEnabled,
      settings: {
        ...this.settings,
        keyBindings: { ...this.settings.keyBindings },
      },
      saveStatus: this.saveStatus,
      hasSurveySave: this.hasSurveySave,
      lastSavedAt: this.lastSavedAt,
      audio: this.audio.diagnostics,
      scanner: { ...this.scanner },
      contractJournal: structuredClone(this.featureProgress.contractJournal),
      fieldGuideEntryIds: [...this.featureProgress.fieldGuideEntries],
      containerStates: structuredClone(this.featureProgress.containerStates),
      placedEntityCount: this.featureProgress.placedEntities.length,
      unlockedRecipeIds: [...this.featureProgress.unlockedRecipeIds],
      lastFeatureNotice: this.lastFeatureNotice
        ? { ...this.lastFeatureNotice }
        : null,
      biome: { id: r.biome.id, name: r.biome.name, region: r.biome.region },
      environment: {
        totalMinutes: o.totalMinutes,
        day: o.day,
        hour: o.hour,
        minute: o.minute,
        phase: o.phase,
        weatherId: o.weatherId,
        weatherLabel: o.weatherLabel,
        precipitation: o.precipitation,
        temperatureC: o.temperatureC,
        windKph: o.windKph,
        windDirection: o.windDirection,
        visibilityMeters: o.visibilityMeters,
        clockState:
          s.enabled && s.clockPaused
            ? "frozen"
            : this.testMode
              ? "test_hold"
              : this.started &&
                  this.contextStatus === "ready" &&
                  !this.paused &&
                  !this.mapOpen &&
                  !this.inventoryOpen &&
                  !this.settingsOpen &&
                  !this.activeInspection &&
                  !this.featureOverlay &&
                  !this.developerPanelOpen
                ? "running"
                : "paused",
        gameMinutesPerRealSecond: Pd,
      },
      nearestSettlement: {
        id: a.settlement.id,
        name: a.settlement.name,
        tier: a.settlement.tier,
        distance: a.distance,
        economy: a.settlement.economy,
        reason: a.settlement.reason,
      },
      nearbyTarget: l
        ? {
            id: l.id,
            kind: l.kind,
            action: l.action,
            name: l.name,
            item: l.item ?? null,
            hits: l.hits,
            hitsRequired: l.hitsRequired,
            beaconId: l.beaconId ?? null,
            open: l.open ?? null,
            empty: l.empty ?? null,
            fieldGuideId: l.fieldGuideId ?? null,
          }
        : null,
      interactionPrompt: l ? lL(l, this.settings.keyBindings) : null,
      nearbyBeacon: l?.beaconId ?? null,
      nearbyDistance: this.runtime.nearbyDistance,
      lastDiscovery: this.lastDiscovery,
      lastGather: this.lastGather,
      lastFastTravel: this.lastFastTravel,
      currentLocation: { ...this.currentLocation },
      discoveredLocationIds: [...this.discoveredLocations],
      lastLocationDiscovery: this.lastLocationDiscovery
        ? { ...this.lastLocationDiscovery }
        : null,
    }),
      this.onSnapshot(this.snapshot));
  }
  projectWaypoint() {
    let e = this.navigation.getActiveTarget();
    if (
      !e ||
      Math.hypot(
        e.position.x - this.player.position.x,
        e.position.z - this.player.position.z,
      ) > 846
    )
      return null;
    (this.camera.updateMatrixWorld(),
      this.projectionPoint.set(
        e.position.x,
        je(e.position.x, e.position.z) + 2.4,
        e.position.z,
      ),
      this.projectionDirection
        .copy(this.projectionPoint)
        .sub(this.camera.position)
        .normalize(),
      this.camera.getWorldDirection(this.cameraDirection));
    let i = this.projectionDirection.dot(this.cameraDirection) > 0;
    return (
      this.projectionPoint.project(this.camera),
      {
        visible:
          i &&
          this.projectionPoint.z >= -1 &&
          this.projectionPoint.z <= 1 &&
          Math.abs(this.projectionPoint.x) <= 0.86 &&
          Math.abs(this.projectionPoint.y) <= 0.74,
        xPercent: Ya(50 + this.projectionPoint.x * 50, 7, 93),
        yPercent: Ya(50 - this.projectionPoint.y * 50, 12, 88),
      }
    );
  }
  emitPresentation() {
    let e = i1(this.player.yaw),
      n = Yg(this.player.yaw);
    this.onPresentation({
      heading: n,
      unwrappedHeading: e,
      navigation: this.navigation.getGuidance(this.player.position, n),
      waypointScreen: this.projectWaypoint(),
      aimScreen:
        this.cameraRig.diagnostics.distance <= 1e-4
          ? null
          : this.cameraRig.projectGameplayAim(
              this.playerCamera,
              this.camera,
              this.runtime.nearbyDistance ?? 8,
            ),
    });
  }
  toggleMap() {
    this.setMapOpen(!this.mapOpen);
  }
  toggleInventory() {
    this.setInventoryOpen(!this.inventoryOpen);
  }
  toggleDeveloperPanel() {
    this.setDeveloperPanelOpen(!this.developerPanelOpen);
  }
  toggleOperations() {
    if (this.featureOverlay?.kind === "operations") {
      (this.setFeatureOverlay(null), this.resume());
      return;
    }
    this.setFeatureOverlay({
      kind: "operations",
      tab: "fieldGuide",
      station: "field",
    });
  }
  refreshEnvironment(e = !0) {
    (this.environment.sync(this.player.position, e),
      this.environment.present(this.player.position, 0, this.camera.position));
    let n = this.environment.getVisualState();
    (this.world.presentEnvironment(n),
      this.horizon.presentEnvironment(n),
      this.renderPipeline.presentEnvironment(n),
      this.synchronizeTimeDependentWorld(),
      this.emitSnapshot(!0));
  }
  synchronizeTimeDependentWorld() {
    let e = this.environment.getSample();
    (this.world.setNightLighting(e.night),
      this.world.setWorldMinutes(e.totalMinutes),
      this.citizens.setWorldMinutes(e.totalMinutes),
      this.syncContractNavigation(!1));
  }
  setQuality(e) {
    return !isQualityProfile(e) || e === this.quality
      ? !1
      : (this.applyQuality(e),
        (this.settings = { ...this.settings, quality: e }),
        (this.runtime.settings = this.settings),
        this.persistPreferences(),
        this.emitSnapshot(!0),
        !0);
  }
  applyQuality(e) {
    (this.graphicsBenchmark.invalidate("Quality profile changed"),
      (this.quality = e),
      this.renderPipeline.setQuality(e),
      this.environment.setQuality(this.quality),
      this.materialLibrary.setQuality(this.quality),
      this.world.setQuality(this.quality),
      this.forestStress.setQuality(this.quality),
      this.citizens.setQuality(this.quality),
      this.animals.setQuality(this.quality),
      this.playerAvatar.setQuality(this.quality),
      this.flashlight.setQuality(this.quality),
      this.resize());
  }
  toggleQuality() {
    let e = QUALITY_ORDER.indexOf(this.quality);
    this.setQuality(QUALITY_ORDER[(e + 1) % QUALITY_ORDER.length]);
  }
  installTestBridge() {
    window.__STILLPOINT_TEST__ = {
      isReady: () => this.ready,
      snapshot: () => structuredClone(this.snapshot),
      teleport: (e, n, i) => {
        (this.relocatePlayer(e, n, i), this.emitSnapshot(!0));
      },
      faceBeacon: (e) => {
        let n = RELAYS.find((a) => a.id === e);
        if (!n) return;
        let i = n.x - this.player.position.x,
          r = n.z - this.player.position.z;
        ((this.player.yaw = Math.atan2(-i, -r)),
          (this.player.pitch = -0.08),
          this.playerCamera.rotation.set(
            this.player.pitch,
            this.player.yaw,
            0,
            "YXZ",
          ),
          this.presentCamera(0, !0),
          this.emitPresentation(),
          this.emitSnapshot(!0));
      },
      discover: (e) => this.discover(e),
      loseContext: () => !1,
      restoreContext: () => !1,
      targets: () =>
        this.world.targets.map((e) => ({
          id: e.id,
          kind: e.kind,
          action: e.action,
          x: e.position.x,
          z: e.position.z,
          open: e.open ?? null,
        })),
      doors: () => structuredClone(this.world.doorsSnapshot),
      groundHeight: (e, n, i) => this.world.sampleGroundHeight(e, n, i),
      citizens: () => this.citizens.debugSnapshot(),
      animals: () => this.animals.debugSnapshot(),
      toggleFlashlight: () => this.toggleFlashlight(),
      setFlashlightEnabled: (e) => this.setFlashlightEnabled(e),
      flashlight: () => this.flashlight.diagnostics,
      audio: () => this.audio.diagnostics,
      graphics: () => this.renderPipeline.diagnostics,
      graphicsFeatures: () => ({ ...this.graphicsFeatures }),
      setGraphicsFeature: (e, n) => this.setGraphicsFeature(e, n),
      graphicsBenchmark: () => this.graphicsBenchmark.snapshot,
      forestStress: () => this.forestStress.diagnostics,
      setGraphicsBenchmarkTarget: (e) => this.setGraphicsBenchmarkTarget(e),
      startGraphicsBenchmark: () => this.startGraphicsBenchmark(),
      cancelGraphicsBenchmark: () => this.cancelGraphicsBenchmark(),
      setForestStressLevel: (e) => this.setForestStressLevel(e),
      travelToForestStressTest: () => this.travelToForestStressTest(),
      saveNow: () => this.saveNow(),
      loadGame: () => this.loadGame(),
      beginSession: () => this.beginSession(),
      beginDeveloperSession: () => this.beginDeveloperSession(),
      setFov: (e) => this.setFov(e),
      setCameraDistance: (e, n) => this.setCameraDistance(e, n),
      setCameraView: (e, n) => this.setCameraView(e, n),
      setIsometricAngle: (e) => this.setIsometricAngle(e),
      camera: () => this.cameraRig.diagnostics,
      setLookSensitivity: (e) => this.setLookSensitivity(e),
      setInvertY: (e) => this.setInvertY(e),
      setKeyBinding: (e, n) => this.setKeyBinding(e, n),
      setQuality: (e) => this.setQuality(e),
      setWorldDetail: (e) => this.setWorldDetail(e),
      setPlayerHealth: (e) => this.setPlayerHealth(e),
      applyFallImpact: (e) => this.applyFallImpact(e),
      recoverPlayer: () => this.recoverPlayer(),
      discoverCurrentLocation: () => this.discoverCurrentLocation(),
      inspectableIds: () =>
        this.world.targets
          .filter((e) => e.kind === "inspectable")
          .map((e) => e.id),
      nightLighting: () => this.world.nightLightingSnapshot,
      faceTarget: (e) => {
        let n = this.world.targets.find((a) => a.id === e);
        if (!n) return;
        let i = n.position.x - this.player.position.x,
          r = n.position.z - this.player.position.z;
        ((this.player.yaw = Math.atan2(-i, -r)),
          (this.player.pitch = -0.04),
          this.playerCamera.rotation.set(
            this.player.pitch,
            this.player.yaw,
            0,
            "YXZ",
          ),
          this.presentCamera(0, !0),
          this.emitPresentation(),
          this.emitSnapshot(!0));
      },
      interactTarget: (e) => {
        let n = this.world.targets.find((i) => i.id === e);
        n && this.performInteraction(n);
      },
      setWaypoint: (e, n) => {
        this.setManualWaypoint(e, n);
      },
      clearWaypoint: () => {
        this.clearManualWaypoint();
      },
      fastTravel: (e) => {
        this.fastTravel(e);
      },
      setWorldMinutes: (e) => {
        this.setWorldMinutes(e);
      },
      advanceWorldMinutes: (e) => {
        this.advanceWorldMinutes(e);
      },
      setDeveloperMode: (e) => {
        this.setDeveloperMode(e);
      },
      setDeveloperPanelOpen: (e) => {
        this.setDeveloperPanelOpen(e);
      },
      setDeveloperTimeOfDay: (e) => {
        this.setDeveloperTimeOfDay(e);
      },
      advanceDeveloperMinutes: (e) => {
        this.advanceDeveloperMinutes(e);
      },
      setDeveloperClockPaused: (e) => {
        this.setDeveloperClockPaused(e);
      },
      setDeveloperWeather: (e) => this.setDeveloperWeather(e),
      setDeveloperInvincible: (e) => this.setDeveloperInvincible(e),
      setDeveloperSpeedMode: (e) => this.setDeveloperSpeedMode(e),
      setDeveloperFly: (e) => this.setDeveloperFly(e),
      resetDeveloperOverrides: () => {
        this.resetDeveloperOverrides();
      },
      setHorizonMode: (e) => this.setHorizonMode(e),
      horizon: () => this.horizon.diagnostics,
      setHeading: (e) => {
        ((this.player.yaw = (-e * Math.PI) / 180),
          this.playerCamera.rotation.set(
            this.player.pitch,
            this.player.yaw,
            0,
            "YXZ",
          ),
          this.presentCamera(0, !0),
          this.emitPresentation(),
          this.emitSnapshot(!0));
      },
      navigationTargets: () => this.navigation.targetsSnapshot(),
      colliders: () => structuredClone(this.world.colliders),
      probeCollision: (e, n, i) => {
        let r = i ?? this.world.sampleGroundHeight(e.x, e.z),
          a = this.world.queryColliders(e, n, 0.42, r, r + 1.72),
          o = vc(e, n, a, 0.42);
        return { position: o, clear: nl(o, a, 0.42), candidateCount: a.length };
      },
    };
  }
};
var GL = {
  heading: 0,
  unwrappedHeading: 0,
  navigation: null,
  waypointScreen: null,
  aimScreen: null,
};
function VL(t, e) {
  return t === e
    ? !0
    : !t || !e
      ? !1
      : t.visible === e.visible &&
        t.xPercent === e.xPercent &&
        t.yPercent === e.yPercent;
}
function DW(t, e) {
  if (t.kind !== e.kind) return !1;
  switch (t.kind) {
    case "player":
      return !0;
    case "quest":
      return (
        e.kind === "quest" &&
        t.questId === e.questId &&
        t.objectiveId === e.objectiveId
      );
    case "script":
      return e.kind === "script" && t.scriptId === e.scriptId;
    case "system":
      return e.kind === "system" && t.systemId === e.systemId;
  }
}
function IW(t, e) {
  return t === e
    ? !0
    : !t || !e
      ? !1
      : t.target.id === e.target.id &&
        t.target.label === e.target.label &&
        t.target.position.x === e.target.position.x &&
        t.target.position.z === e.target.position.z &&
        DW(t.target.source, e.target.source) &&
        t.target.arrivalRadius === e.target.arrivalRadius &&
        t.target.clearOnArrival === e.target.clearOnArrival &&
        t.distance === e.distance &&
        t.bearing === e.bearing &&
        t.relativeBearing === e.relativeBearing &&
        t.reached === e.reached;
}
var PresentationStore = class {
  constructor() {
    this.current = GL;
    this.listeners = new Set();
    this.subscribe = (e) => (
      this.listeners.add(e),
      () => this.listeners.delete(e)
    );
    this.getSnapshot = () => this.current;
    this.getServerSnapshot = () => GL;
  }
  publish(e) {
    (this.current.heading === e.heading &&
      this.current.unwrappedHeading === e.unwrappedHeading &&
      IW(this.current.navigation, e.navigation) &&
      VL(this.current.waypointScreen, e.waypointScreen) &&
      VL(this.current.aimScreen, e.aimScreen)) ||
      ((this.current = e), this.listeners.forEach((n) => n()));
  }
};
var N = ut(Ht(), 1);
// Boot the shared kit once, on the canvas React renders: WebGPU first,
// WebGL2 when WebGPU is missing. The survey keeps its own boot screen; the
// kit's card covers startup until the world is streamed in.
var kitBoot = null;
function bootFrontierKit(t) {
  return (kitBoot ??= boot({
    title: "Stillpoint Frontier",
    canvas: t,
    mount: t.parentElement ?? document.body,
    gear: "none",
    holdLoading: !0,
    accent: "#d8753a",
    background: "#171a18",
    renderer: { reversedDepthBuffer: !0 },
    touch: { top: "center", topOffset: 10 },
    input: kitActionsFor(DEFAULT_KEY_BINDINGS),
  }).then((e) => {
    // Without EXT_clip_control (some WebGL2 devices) there is no reversed
    // depth: use a logarithmic depth buffer instead, as the original did, so
    // the 70 km horizon does not z-fight.
    return (
      e.renderer.reversedDepthBuffer || (e.renderer.logarithmicDepthBuffer = !0),
      (KIT = e),
      e
    );
  }));
}
function WL(t) {
  return RELAYS.find((e) => e.id === t) ?? null;
}
// The survey so far, on the pause panel: relay records, filed contracts,
// field guide entries, logged locations and the day in the field.
function SurveyRecord({ snapshot: t }) {
  let e = Object.values(t.contractJournal.contracts).filter(
      (i) => i?.status === "completed",
    ).length,
    n = [
      ["RELAYS", t.scanned.length, RELAYS.length],
      ["CONTRACTS", e, CONTRACTS.length],
      ["FIELD GUIDE", t.fieldGuideEntryIds.length, ll.length],
      ["LOCATIONS", t.discoveredLocationIds.length, EV.length],
    ];
  return (0, N.jsxs)("dl", {
    className: "survey-record",
    "data-testid": "survey-record",
    children: [
      ...n.map(([i, r, a]) =>
        (0, N.jsxs)(
          "div",
          {
            className: r >= a ? "is-complete" : "",
            children: [
              (0, N.jsx)("dt", { children: i }),
              (0, N.jsxs)("dd", {
                children: [r, (0, N.jsxs)("small", { children: ["/", a] })],
              }),
            ],
          },
          i,
        ),
      ),
      (0, N.jsxs)(
        "div",
        {
          children: [
            (0, N.jsx)("dt", { children: "FIELD DAY" }),
            (0, N.jsx)("dd", { children: t.environment.day }),
          ],
        },
        "day",
      ),
    ],
  });
}
function XL(t) {
  return t >= 1e3 ? `${(t / 1e3).toFixed(1)} KM` : `${Math.round(t)} M`;
}
function App() {
  let t = (0, Ur.useRef)(null),
    e = (0, Ur.useRef)(null),
    [n] = (0, Ur.useState)(() => new PresentationStore()),
    [i, r] = (0, Ur.useState)(INITIAL_SNAPSHOT),
    [a, o] = (0, Ur.useState)(Ff),
    [s, l] = (0, Ur.useState)(!1),
    [c, u] = (0, Ur.useState)(null),
    [newSurveyArmed, setNewSurveyArmed] = (0, Ur.useState)(!1);
  (0, Ur.useEffect)(() => {
    let _ = t.current;
    if (!_) return;
    let b = !0,
      T = new URLSearchParams(window.location.search),
      R = T.get("visual");
    if (R)
      return (
        queueMicrotask(() => {
          if (!b) return;
          let L = {
            target: {
              id: "player:map",
              label: "Sablewood crossing",
              position: { x: 8300, z: -7200 },
              source: { kind: "player" },
              arrivalRadius: 12,
              clearOnArrival: !1,
            },
            distance: 6500,
            bearing: 58,
            relativeBearing: 16,
            reached: !1,
          };
          (l(!0),
            r({
              ...INITIAL_SNAPSHOT,
              ready: !0,
              started: R !== "entry",
              sessionMode: R === "dev" ? "developer" : "survey",
              paused: R === "dev",
              mapOpen: R === "map",
              devTools: {
                enabled: R === "dev",
                panelOpen: R === "dev",
                clockPaused: R === "dev",
                persistentWorldMinutes: 450,
                weatherOverride: R === "dev" ? "rain" : null,
                weatherOptions: weatherOptionsFor("pine_forest"),
                graphicsFeatures: {
                  ...INITIAL_SNAPSHOT.devTools.graphicsFeatures,
                },
                player: { ...INITIAL_SNAPSHOT.devTools.player },
              },
              position: { x: 4240, y: 8.4, z: -3180 },
              heading: 42,
              navigation: L,
              fps: 60,
              chunk: { x: 44, z: -33 },
              loadedChunks: 81,
              citizenCount: R === "night" ? 88 : 486,
              citizenActivity: R === "night" ? 0.18 : 0.93,
              animalCount: R === "night" ? 4 : 11,
              animalSpecies: 3,
              crowdDensity: "ACTIVE",
              triangles: 48620,
              geometries: 138,
              textures: 4,
              scanned: ["amber-relay"],
              inventory: {
                ...INITIAL_SNAPSHOT.inventory,
                stone: 3,
                wood: 4,
                fiber: 2,
                ore: 1,
              },
              worldChanges: 4,
              stamina: 0.72,
              biome: {
                id: "pine_forest",
                name: "Sable Pine Forest",
                region: "Sablewood",
              },
              environment:
                R === "night"
                  ? {
                      totalMinutes: 126,
                      day: 1,
                      hour: 2,
                      minute: 6,
                      phase: "night",
                      weatherId: "fair",
                      weatherLabel: "Canopy clear",
                      precipitation: "none",
                      temperatureC: 7,
                      windKph: 8,
                      windDirection: 238,
                      visibilityMeters: 640,
                      clockState: "running",
                      gameMinutesPerRealSecond: 1,
                    }
                  : {
                      totalMinutes: 1015,
                      day: 1,
                      hour: 16,
                      minute: 55,
                      phase: "day",
                      weatherId: "rain",
                      weatherLabel: "Canopy drizzle",
                      precipitation: "rain",
                      temperatureC: 11,
                      windKph: 18,
                      windDirection: 238,
                      visibilityMeters: 410,
                      clockState: R === "dev" ? "frozen" : "running",
                      gameMinutesPerRealSecond: 1,
                    },
              nearestSettlement: {
                id: "timberfall",
                name: "Timberfall",
                tier: "town",
                distance: 1240,
                economy: "timber \xB7 resin \xB7 paper \xB7 carpentry",
                reason:
                  "A managed-forest town where two logging valleys meet the highland road.",
              },
              nearbyTarget: {
                id: "resource:tree:v1:44:-33:0",
                kind: "resource",
                action: "harvest",
                name: "Workable pine",
                item: "wood",
                hits: 1,
                hitsRequired: 3,
                beaconId: null,
                open: null,
                empty: null,
                fieldGuideId: "guide:resource:wood:v1",
              },
              nearbyDistance: 4.2,
            }),
            n.publish({
              heading: 42,
              unwrappedHeading: 42,
              navigation: L,
              waypointScreen: { visible: !0, xPercent: 64, yPercent: 41 },
              aimScreen: null,
            }));
        }),
        () => {
          b = !1;
        }
      );
    let C = T.get("test") === "1",
      P = !C || T.get("storage") === "1",
      B = (L) => {
        if (
          (console.error("Stillpoint renderer failure", L),
          KIT?.loading.done(),
          !b)
        )
          return;
        let O = e.current;
        ((e.current = null), O?.dispose());
        let G = L instanceof Error ? L.message : "Unknown renderer error";
        u(G);
      };
    bootFrontierKit(_)
      .then((L) => {
        if (b)
          try {
            let O = new FrontierEngine({
              kit: L,
              testMode: C,
              storageEnabled: P,
              onSnapshot: (G) => {
                b && r(G);
              },
              onPresentation: (G) => {
                b && n.publish(G);
              },
              onRendererError: B,
            });
            ((e.current = O),
              O.initialize().catch((G) => {
                B(G);
              }));
          } catch (O) {
            B(O);
          }
      })
      .catch((L) => {
        let O = L instanceof Error ? L.message : "Graphics could not start";
        b && u(O);
      });
    return () => {
      ((b = !1), e.current?.dispose(), (e.current = null));
    };
  }, [n]);
  let h = (0, Ur.useMemo)(() => bL(i.scanned), [i.scanned]),
    d = WL(i.nearbyBeacon),
    p = WL(i.lastDiscovery),
    f = i.nearbyTarget,
    S = i.lastGather ? ITEMS[i.lastGather.item] : null,
    v = i.scanned.length === RELAYS.length,
    m = i.interactionPrompt,
    y = i.contractJournal.activeContractId
      ? Qo(i.contractJournal.activeContractId)
      : null,
    x = y ? (i.contractJournal.contracts[y.id] ?? null) : null,
    g = y && x ? Ta(y, x) : null,
    E =
      y && x
        ? y.objectives.filter(
            (_) => (x.objectiveProgress[_.id] ?? 0) >= _.amount,
          ).length
        : 0,
    M = {
      sheltered: "SHELTERED",
      wet: "WET",
      cold: "COLD",
      exhausted: "EXHAUSTED",
      injured: "INJURED",
      critical: "CRITICAL",
      encumbered: "ENCUMBERED",
    };
  return (0, N.jsxs)("main", {
    className: "game-shell",
    "data-testid": "game-shell",
    "data-interface-scale": i.settings.interfaceScale,
    children: [
      (0, N.jsx)("canvas", {
        ref: t,
        className: "game-canvas",
        "data-testid": "game-canvas",
        "aria-label": "Stillpoint Frontier three-dimensional game world",
      }),
      s &&
        (0, N.jsxs)(N.Fragment, {
          children: [
            (0, N.jsxs)("div", {
              className: "visual-world-fixture",
              "aria-hidden": "true",
              children: [
                (0, N.jsx)("i", {}),
                (0, N.jsx)("span", {}),
                (0, N.jsx)("b", {}),
              ],
            }),
            (0, N.jsx)("small", {
              className: "visual-fixture-label",
              children: "UI TEST FIXTURE / WEBGL BYPASSED",
            }),
          ],
        }),
      (0, N.jsx)("div", { className: "optical-grain", "aria-hidden": "true" }),
      (0, N.jsx)("div", { className: "frame-corners", "aria-hidden": "true" }),
      !i.ready &&
        !c &&
        (0, N.jsxs)("section", {
          className: "boot-screen",
          "data-testid": "boot-screen",
          "aria-live": "polite",
          children: [
            (0, N.jsxs)("div", {
              className: "boot-mark",
              "aria-hidden": "true",
              children: [(0, N.jsx)("span", {}), (0, N.jsx)("span", {})],
            }),
            (0, N.jsx)("p", { children: "ESTABLISHING WORLD GRID" }),
            (0, N.jsxs)("small", { children: ["SEED ", ot] }),
          ],
        }),
      c &&
        (0, N.jsxs)("section", {
          className: "error-screen",
          role: "alert",
          "data-testid": "engine-error",
          children: [
            (0, N.jsx)("p", {
              className: "eyebrow",
              children: "RENDERER INTERRUPT",
            }),
            (0, N.jsx)("h1", { children: "Unable to establish the frontier." }),
            (0, N.jsx)("p", { children: c }),
            (0, N.jsx)("p", {
              className: "error-hint",
              children:
                "A WebGPU or WebGL2 browser with hardware acceleration is required.",
            }),
          ],
        }),
      i.ready &&
        !i.started &&
        !c &&
        (0, N.jsxs)("section", {
          className: "entry-screen",
          "data-testid": "entry-screen",
          children: [
            (0, N.jsxs)("header", {
              className: "entry-header",
              children: [
                (0, N.jsxs)("div", {
                  className: "wordmark",
                  children: [
                    (0, N.jsx)("span", {
                      className: "wordmark-glyph",
                      "aria-hidden": "true",
                      children: "S",
                    }),
                    (0, N.jsx)("span", { children: J2 }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  className: "entry-status",
                  children: [
                    (0, N.jsx)("span", { className: "status-dot" }),
                    "WORLD GRID ONLINE",
                  ],
                }),
              ],
            }),
            (0, N.jsx)(WorldClock, { environment: i.environment }),
            (0, N.jsxs)("div", {
              className: "entry-main",
              children: [
                (0, N.jsx)("p", {
                  className: "eyebrow",
                  children: "FIELD DIRECTIVE 01 / GREYWATER TERRITORY",
                }),
                (0, N.jsxs)("h1", {
                  children: [
                    "Read the land.",
                    (0, N.jsx)("br", {}),
                    (0, N.jsx)("em", { children: "Wake the signal." }),
                  ],
                }),
                (0, N.jsx)("p", {
                  className: "entry-deck",
                  children:
                    "A 96-kilometre territory unfolds around the Greywater: forest, highland, steppe, badland, coast, and the megacity that binds their economies together.",
                }),
                (0, N.jsxs)("div", {
                  className: "entry-session-actions",
                  children: [
                    (0, N.jsxs)("button", {
                      type: "button",
                      className: "enter-button",
                      "data-testid": "enter-frontier",
                      onClick: () => e.current?.beginSession(),
                      children: [
                        (0, N.jsx)("span", {
                          children: i.hasSurveySave
                            ? "RESUME SURVEY"
                            : "ENTER FRONTIER",
                        }),
                        (0, N.jsx)("span", {
                          "aria-hidden": "true",
                          children: "\u2197",
                        }),
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      className: "enter-developer-button",
                      "data-testid": "enter-developer",
                      onClick: () => e.current?.beginDeveloperSession(),
                      children: [
                        (0, N.jsxs)("span", {
                          children: [
                            (0, N.jsx)("strong", {
                              children: "START IN DEV MODE",
                            }),
                            (0, N.jsx)("small", {
                              children:
                                "FRESH WORLD \xB7 NOON \xB7 CLEAR \xB7 FROZEN \xB7 20\xD7 \xB7 FLY \xB7 INVINCIBLE",
                            }),
                          ],
                        }),
                        (0, N.jsx)("span", {
                          "aria-hidden": "true",
                          children: "\u25C7",
                        }),
                      ],
                    }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  className: "entry-settings-button",
                  onClick: () => e.current?.setSettingsOpen(!0),
                  children: [
                    "SETTINGS ",
                    (0, N.jsx)("span", {
                      "aria-hidden": "true",
                      children: "\u2301",
                    }),
                  ],
                }),
                i.hasSurveySave &&
                  (0, N.jsx)("button", {
                    type: "button",
                    className: `entry-settings-button entry-new-survey ${newSurveyArmed ? "is-armed" : ""}`,
                    "data-testid": "new-survey",
                    onClick: () => {
                      newSurveyArmed
                        ? (setNewSurveyArmed(!1), e.current?.beginNewSurvey())
                        : setNewSurveyArmed(!0);
                    },
                    onBlur: () => setNewSurveyArmed(!1),
                    children: newSurveyArmed
                      ? "CONFIRM \u2014 ERASE SAVE AND START OVER"
                      : "NEW SURVEY",
                  }),
                (0, N.jsx)("p", {
                  className: "entry-note",
                  children:
                    `${i.inputSource === "gamepad" ? "Press A to begin \xB7 Start pauses" : i.inputSource === "touch" ? "Tap to begin \xB7 the II pill pauses" : "Click to capture the mouse \xB7 P or Esc pauses"} \xB7 Dev launch cannot overwrite your survey save`,
                }),
              ],
            }),
            (0, N.jsxs)("footer", {
              className: "entry-footer",
              children: [
                (0, N.jsxs)("div", {
                  children: [
                    (0, N.jsx)("span", { children: "MODE" }),
                    (0, N.jsx)("strong", { children: "OPEN SURVEY" }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  children: [
                    (0, N.jsx)("span", { children: "MOTION PROFILE" }),
                    (0, N.jsx)("strong", { children: "RIG-FREE CROWDS" }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  children: [
                    (0, N.jsx)("span", { children: "RENDER TARGET" }),
                    (0, N.jsx)("strong", {
                      children: i.renderBackend ?? "WEBGPU / WEBGL2",
                    }),
                  ],
                }),
                (0, N.jsx)("p", {
                  children:
                    "No combat. No cutscenes. A low-animation world shaped by distance and work.",
                }),
              ],
            }),
          ],
        }),
      i.started &&
        !c &&
        (0, N.jsxs)("div", {
          className: "hud",
          "data-testid": "game-hud",
          children: [
            (0, N.jsxs)("header", {
              className: "hud-topbar",
              children: [
                (0, N.jsxs)("div", {
                  className: "hud-brand",
                  children: [
                    (0, N.jsx)("span", {
                      className: "hud-glyph",
                      children: "S",
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("strong", { children: "STILLPOINT" }),
                        (0, N.jsxs)("small", {
                          children: ["FIELD UNIT / ", ot],
                        }),
                      ],
                    }),
                  ],
                }),
                (0, N.jsx)(Compass, { store: n, environment: i.environment }),
                (0, N.jsxs)("div", {
                  className: "system-readout",
                  children: [
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "FRAME" }),
                        (0, N.jsx)("strong", { children: i.fps }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "CHUNKS" }),
                        (0, N.jsx)("strong", {
                          children: String(i.loadedChunks).padStart(2, "0"),
                        }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "CITIZENS" }),
                        (0, N.jsx)("strong", {
                          children: i.citizenCount.toLocaleString(),
                        }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "ANIMALS" }),
                        (0, N.jsx)("strong", {
                          children: i.animalCount.toLocaleString(),
                        }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "PROFILE" }),
                        (0, N.jsx)("strong", {
                          children:
                            i.quality === "ultra"
                              ? "ULTRA"
                              : i.quality === "cinematic"
                                ? "CINE"
                                : "PERF",
                        }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      children: [
                        (0, N.jsx)("span", { children: "HORIZON" }),
                        (0, N.jsx)("strong", {
                          children:
                            i.horizonMode === "standard"
                              ? "STD"
                              : i.horizonMode === "extended"
                                ? "EXT"
                                : "MAX",
                        }),
                      ],
                    }),
                    (0, N.jsxs)("div", {
                      className: "camera-readout",
                      "data-testid": "camera-readout",
                      children: [
                        (0, N.jsx)("span", { children: "VIEW" }),
                        (0, N.jsx)("strong", {
                          children:
                            i.camera.mode === "firstPerson"
                              ? "FPV"
                              : i.camera.mode === "thirdPerson"
                                ? "TPV"
                                : "ISO",
                        }),
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      className: `dev-launcher ${i.devTools.enabled ? "is-active" : ""}`,
                      "aria-pressed": i.devTools.enabled,
                      "data-testid": "developer-launcher",
                      onClick: () => e.current?.setDeveloperPanelOpen(!0),
                      children: [
                        (0, N.jsx)("span", { children: "DEV" }),
                        (0, N.jsx)("strong", {
                          children: i.devTools.enabled ? "ON" : "OFF",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            i.camera.mode === "firstPerson" &&
              (0, N.jsxs)("div", {
                className: "camera-mobile-hint",
                "aria-hidden": "true",
                children: [
                  (0, N.jsx)("kbd", {
                    children: controlGlyph(
                      i.inputSource,
                      "cameraView",
                      i.settings.keyBindings,
                    ),
                  }),
                  " VIEW",
                  (0, N.jsx)("span", { children: "\xB7" }),
                  (0, N.jsx)("kbd", {
                    children:
                      i.inputSource === "keyboard"
                        ? "WHEEL"
                        : controlGlyph(i.inputSource, "zoom"),
                  }),
                  " ZOOM",
                ],
              }),
            (0, N.jsxs)("aside", {
              className: "mission-card",
              "data-testid": "mission-card",
              children: [
                (0, N.jsx)("p", {
                  className: "eyebrow",
                  children: "ACTIVE DIRECTIVE",
                }),
                (0, N.jsxs)("div", {
                  className: "mission-count",
                  children: [
                    (0, N.jsx)("strong", {
                      children: String(y ? E : i.scanned.length).padStart(
                        2,
                        "0",
                      ),
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        "/ ",
                        String(
                          y ? y.objectives.length : RELAYS.length,
                        ).padStart(2, "0"),
                      ],
                    }),
                  ],
                }),
                (0, N.jsx)("h2", {
                  children: y
                    ? y.title
                    : v
                      ? "Survey complete"
                      : "Recover relay records",
                }),
                (0, N.jsx)("p", {
                  children: y
                    ? x?.status === "ready"
                      ? "Objectives complete. File the contract through Field Operations."
                      : (g?.label ?? y.summary)
                    : v
                      ? "All basin signals are coherent. The frontier now holds your survey state."
                      : h
                        ? `Next indexed signal: ${h.code} / ${h.name}.`
                        : "No remaining signal indexed.",
                }),
                (0, N.jsx)("div", {
                  className: "relay-list",
                  children:
                    y && x
                      ? y.objectives.map((_) => {
                          let b = x.objectiveProgress[_.id] ?? 0,
                            T = b >= _.amount;
                          return (0, N.jsxs)(
                            "div",
                            {
                              className: T
                                ? "is-scanned"
                                : g?.id === _.id
                                  ? "is-current"
                                  : "",
                              children: [
                                (0, N.jsx)("i", { "aria-hidden": "true" }),
                                (0, N.jsx)("span", {
                                  children: _.id.slice(0, 8).toUpperCase(),
                                }),
                                (0, N.jsx)("strong", {
                                  children: T
                                    ? "COMPLETE"
                                    : `${Math.min(b, _.amount)}/${_.amount}`,
                                }),
                              ],
                            },
                            _.id,
                          );
                        })
                      : RELAYS.map((_) =>
                          (0, N.jsxs)(
                            "div",
                            {
                              className: i.scanned.includes(_.id)
                                ? "is-scanned"
                                : "",
                              children: [
                                (0, N.jsx)("i", { "aria-hidden": "true" }),
                                (0, N.jsx)("span", { children: _.code }),
                                (0, N.jsx)("strong", {
                                  children: i.scanned.includes(_.id)
                                    ? "RECOVERED"
                                    : "SILENT",
                                }),
                              ],
                            },
                            _.id,
                          ),
                        ),
                }),
              ],
            }),
            (0, N.jsxs)("aside", {
              className: "region-card",
              "data-testid": "region-card",
              children: [
                (0, N.jsx)("p", { children: i.biome.region }),
                (0, N.jsx)("h2", { children: i.biome.name }),
                (0, N.jsxs)("div", {
                  className: "environment-readout",
                  "data-testid": "environment-readout",
                  children: [
                    (0, N.jsxs)("span", {
                      children: [
                        "DAY ",
                        i.environment.day,
                        " \xB7 ",
                        i.environment.phase.toUpperCase(),
                      ],
                    }),
                    (0, N.jsxs)("strong", {
                      children: [
                        String(i.environment.hour).padStart(2, "0"),
                        ":",
                        String(i.environment.minute).padStart(2, "0"),
                        " \xB7 ",
                        i.environment.weatherLabel,
                      ],
                    }),
                    (0, N.jsxs)("small", {
                      children: [
                        Math.round(i.environment.temperatureC),
                        "\xB0C \xB7 WIND ",
                        Math.round(i.environment.windKph),
                        " KM/H \xB7 VIS ",
                        XL(i.environment.visibilityMeters),
                      ],
                    }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  children: [
                    (0, N.jsxs)("span", {
                      children: [
                        "NEAREST ",
                        i.nearestSettlement.tier.toUpperCase(),
                      ],
                    }),
                    (0, N.jsx)("strong", {
                      children: i.nearestSettlement.name,
                    }),
                    (0, N.jsxs)("small", {
                      children: [
                        XL(i.nearestSettlement.distance),
                        " \xB7 ",
                        i.nearestSettlement.economy,
                      ],
                    }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  className: "crowd-readout",
                  "data-testid": "crowd-readout",
                  children: [
                    (0, N.jsx)("span", {
                      children: "AMBIENT / NON-INTERACTIVE",
                    }),
                    (0, N.jsxs)("strong", {
                      children: [
                        i.crowdDensity,
                        " \xB7 ",
                        i.citizenCount.toLocaleString(),
                        " VISIBLE",
                      ],
                    }),
                    (0, N.jsx)("small", {
                      children: "INSTANCED ROUTES \xB7 NO DIALOGUE STATE",
                    }),
                    (0, N.jsxs)("small", {
                      children: [
                        "TIME DEMAND ",
                        Math.round(i.citizenActivity * 100),
                        "% \xB7 DIURNAL SCHEDULE",
                      ],
                    }),
                    (0, N.jsxs)("small", {
                      children: [
                        "WILDLIFE ",
                        i.animalCount,
                        " \xB7 ",
                        i.animalSpecies,
                        " LOCAL SPECIES",
                      ],
                    }),
                  ],
                }),
              ],
            }),
            (0, N.jsx)(CameraAimReticle, {
              store: n,
              mode: i.camera.mode,
              viewKey: keyLabel(i.settings.keyBindings.cameraView),
            }),
            (0, N.jsx)(BenchmarkHud, { snapshot: i }),
            i.scanner.active &&
              (0, N.jsxs)("div", {
                className: "scanner-readout",
                "data-testid": "scanner-readout",
                "aria-live": "polite",
                children: [
                  (0, N.jsxs)("header", {
                    children: [
                      (0, N.jsx)("span", { children: "FIELD SCANNER / LIVE" }),
                      (0, N.jsxs)("strong", {
                        children: [Math.round(i.scanner.progress * 100), "%"],
                      }),
                    ],
                  }),
                  (0, N.jsx)("i", {
                    children: (0, N.jsx)("b", {
                      style: { width: `${i.scanner.progress * 100}%` },
                    }),
                  }),
                  (0, N.jsx)("p", {
                    children: i.scanner.focusName ?? "NO SUBJECT ALIGNED",
                  }),
                  (0, N.jsx)("small", {
                    children: i.scanner.focusEntryId
                      ? i.scanner.progress >= 1
                        ? "CATALOG RECORD CONFIRMED"
                        : "HOLD ALIGNMENT TO RESOLVE"
                      : "CENTER A CATALOG SUBJECT",
                  }),
                ],
              }),
            f &&
              m &&
              !(f.beaconId && i.scanned.includes(f.beaconId)) &&
              (0, N.jsxs)("div", {
                className: "interaction-prompt",
                "data-testid": "interaction-prompt",
                children: [
                  (0, N.jsx)("kbd", {
                    children:
                      i.inputSource === "keyboard"
                        ? keyLabel(m.keyCode)
                        : controlGlyph(i.inputSource, "use"),
                  }),
                  (0, N.jsxs)("div", {
                    children: [
                      (0, N.jsx)("span", { children: m.verb }),
                      (0, N.jsxs)("strong", {
                        children: [
                          f.beaconId && d?.code ? `${d.code} / ` : "",
                          f.name,
                        ],
                      }),
                    ],
                  }),
                  (0, N.jsxs)("small", {
                    children: [
                      m.detail ? `${m.detail} \xB7 ` : "",
                      i.nearbyDistance?.toFixed(1),
                      "M",
                    ],
                  }),
                ],
              }),
            f?.beaconId &&
              i.scanned.includes(f.beaconId) &&
              (0, N.jsxs)("div", {
                className: "interaction-prompt is-complete",
                children: [
                  (0, N.jsx)("span", {
                    className: "prompt-check",
                    children: "\u2713",
                  }),
                  (0, N.jsxs)("div", {
                    children: [
                      (0, N.jsx)("span", { children: "RECORD SECURED" }),
                      (0, N.jsxs)("strong", {
                        children: [d?.code, " / ", d?.name],
                      }),
                    ],
                  }),
                ],
              }),
            (0, N.jsxs)("div", {
              className: "survival-readout",
              "data-testid": "movement-readout",
              children: [
                i.devTools.enabled &&
                  (i.devTools.player.invincible ||
                    i.devTools.player.fly ||
                    i.devTools.player.speedMode !== "normal") &&
                  (0, N.jsxs)("div", {
                    className: "developer-player-status",
                    "data-testid": "developer-player-status",
                    children: [
                      (0, N.jsx)("span", { children: "DEV" }),
                      i.devTools.player.invincible &&
                        (0, N.jsx)("strong", { children: "GOD" }),
                      i.devTools.player.fly &&
                        (0, N.jsx)("strong", { children: "FLY" }),
                      i.devTools.player.speedMode !== "normal" &&
                        (0, N.jsxs)("strong", {
                          children: [
                            Fu[i.devTools.player.speedMode].multiplier,
                            "\xD7",
                          ],
                        }),
                    ],
                  }),
                (0, N.jsxs)("div", {
                  className: `health-line ${i.health < 25 ? "is-critical" : ""}`,
                  "data-testid": "health-readout",
                  children: [
                    (0, N.jsx)("span", { children: "VITALS" }),
                    (0, N.jsx)("i", {
                      children: (0, N.jsx)("b", {
                        style: { width: `${i.health}%` },
                      }),
                    }),
                    (0, N.jsx)("strong", { children: Math.ceil(i.health) }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  className: "stamina-line",
                  children: [
                    (0, N.jsx)("span", {
                      children: i.devTools.player.fly
                        ? "DEV FLIGHT"
                        : i.crouching
                          ? "CROUCHED"
                          : i.sprinting
                            ? "SPRINTING"
                            : i.grounded
                              ? "READY"
                              : "AIRBORNE",
                    }),
                    (0, N.jsx)("i", {
                      children: (0, N.jsx)("b", {
                        style: { width: `${i.stamina * 100}%` },
                      }),
                    }),
                    (0, N.jsx)("strong", {
                      children: Math.round(i.stamina * 100),
                    }),
                  ],
                }),
                i.conditions.length > 0 &&
                  (0, N.jsx)("div", {
                    className: "condition-strip",
                    "aria-live": "polite",
                    "data-testid": "condition-strip",
                    children: i.conditions.map((_) =>
                      (0, N.jsx)(
                        "span",
                        { className: `condition-${_}`, children: M[_] },
                        _,
                      ),
                    ),
                  }),
                (0, N.jsx)("div", {
                  className: "inventory-belt",
                  "data-testid": "inventory-belt",
                  children: Object.keys(ITEMS).map((_) =>
                    (0, N.jsxs)(
                      "span",
                      {
                        className: i.inventory[_] > 0 ? "has-item" : "",
                        children: [
                          (0, N.jsx)("small", { children: ITEMS[_].shortName }),
                          (0, N.jsx)("strong", {
                            children: String(i.inventory[_]).padStart(2, "0"),
                          }),
                        ],
                      },
                      _,
                    ),
                  ),
                }),
              ],
            }),
            (0, N.jsxs)("footer", {
              className: "hud-footer",
              children: [
                i.inputSource === "gamepad"
                  ? (0, N.jsx)("div", {
                      className: "controls-strip is-gamepad",
                      "data-testid": "gamepad-controls-strip",
                      children: PAD_STRIP.map(([_, b]) =>
                        (0, N.jsxs)(
                          "span",
                          { children: [(0, N.jsx)("kbd", { children: _ }), " ", b] },
                          b,
                        ),
                      ),
                    })
                  : (0, N.jsxs)("div", {
                  className: "controls-strip",
                  children: [
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: [
                            i.settings.keyBindings.moveForward,
                            i.settings.keyBindings.moveLeft,
                            i.settings.keyBindings.moveBackward,
                            i.settings.keyBindings.moveRight,
                          ]
                            .map(keyLabel)
                            .join(""),
                        }),
                        " MOVE",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.sprint),
                        }),
                        " SPRINT",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.jump),
                        }),
                        " JUMP",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.crouch),
                        }),
                        " CROUCH",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.cameraView),
                        }),
                        " VIEW",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", { children: "WHEEL" }),
                        " ZOOM",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.interact),
                        }),
                        " USE",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsxs)("kbd", {
                          children: [
                            keyLabel(i.settings.keyBindings.harvest),
                            "/CLICK",
                          ],
                        }),
                        " HARVEST",
                      ],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.scanner),
                        }),
                        " SCAN",
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      className: i.flashlightOn ? "is-active" : "",
                      "data-testid": "flashlight-toggle",
                      "aria-pressed": i.flashlightOn,
                      "aria-keyshortcuts": keyLabel(
                        i.settings.keyBindings.flashlight,
                      ),
                      "aria-label": "Phone flashlight",
                      onClick: () => e.current?.toggleFlashlight(),
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.flashlight),
                        }),
                        " PHONE LIGHT ",
                        i.flashlightOn ? "ON" : "OFF",
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      onClick: () => e.current?.setMapOpen(!0),
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.map),
                        }),
                        " MAP",
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      onClick: () => e.current?.setInventoryOpen(!0),
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.inventory),
                        }),
                        " KIT",
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      onClick: () =>
                        e.current?.setFeatureOverlay({
                          kind: "operations",
                          tab: "contracts",
                          station: "field",
                        }),
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.fieldGuide),
                        }),
                        " OPS",
                      ],
                    }),
                    (0, N.jsxs)("button", {
                      type: "button",
                      onClick: () => e.current?.setDeveloperPanelOpen(!0),
                      children: [(0, N.jsx)("kbd", { children: "`" }), " DEV"],
                    }),
                    (0, N.jsxs)("span", {
                      children: [
                        (0, N.jsx)("kbd", {
                          children: keyLabel(i.settings.keyBindings.quality),
                        }),
                        " QUALITY",
                      ],
                    }),
                  ],
                }),
                (0, N.jsxs)("div", {
                  className: "coordinates",
                  "data-testid": "coordinates",
                  children: [
                    (0, N.jsxs)("span", {
                      children: ["X ", i.position.x.toFixed(1)],
                    }),
                    (0, N.jsxs)("span", {
                      children: ["Z ", i.position.z.toFixed(1)],
                    }),
                    (0, N.jsxs)("strong", {
                      children: ["GRID ", i.chunk.x, ":", i.chunk.z],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      i.started &&
        i.paused &&
        !i.mapOpen &&
        !i.inventoryOpen &&
        !i.settingsOpen &&
        !i.inspectionOpen &&
        !i.featureOverlay &&
        !i.incapacitated &&
        !i.devTools.panelOpen &&
        i.contextStatus === "ready" &&
        (0, N.jsxs)("section", {
          className: "pause-panel",
          "data-testid": "pause-panel",
          children: [
            (0, N.jsx)("p", {
              className: "eyebrow",
              children: "FIELD LINK SUSPENDED",
            }),
            (0, N.jsx)("h2", { children: "The frontier is holding." }),
            (0, N.jsx)("p", {
              children:
                i.inputSource === "gamepad"
                  ? `Resume with A or Start. The D-pad moves between options.${i.audio.available && !i.audio.unlocked ? " Browsers start sound only after a key press, click or tap." : ""}`
                  : i.inputSource === "touch"
                    ? "Tap Resume to continue the survey."
                    : "Resume to recapture the mouse and continue the survey.",
            }),
            (0, N.jsx)(SurveyRecord, { snapshot: i }),
            (0, N.jsxs)("button", {
              type: "button",
              onClick: () => e.current?.resume(),
              children: [
                "RESUME SURVEY ",
                (0, N.jsx)("span", { children: "\u2197" }),
              ],
            }),
            (0, N.jsxs)("div", {
              className: "pause-action-grid",
              children: [
                (0, N.jsxs)("button", {
                  type: "button",
                  "data-testid": "save-now",
                  disabled: i.sessionMode === "developer",
                  onClick: () => e.current?.saveNow(),
                  children: [
                    i.sessionMode === "developer"
                      ? "SURVEY SAVE PROTECTED"
                      : "SAVE NOW",
                    (0, N.jsx)("span", {
                      children:
                        i.sessionMode === "developer"
                          ? "DEV SESSION"
                          : i.saveStatus.toUpperCase(),
                    }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  "data-testid": "load-save",
                  disabled: !i.hasSurveySave,
                  onClick: () => e.current?.loadGame(),
                  children: [
                    "LOAD SURVEY SAVE ",
                    (0, N.jsx)("span", { children: "RESTORE" }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  onClick: () => e.current?.setInventoryOpen(!0),
                  children: [
                    "INVENTORY ",
                    (0, N.jsxs)("span", {
                      children: [i.inventoryItemCount, " ITEMS"],
                    }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  onClick: () =>
                    e.current?.setFeatureOverlay({
                      kind: "operations",
                      tab: "contracts",
                      station: "field",
                    }),
                  children: [
                    "FIELD OPERATIONS ",
                    (0, N.jsxs)("span", {
                      children: [i.fieldGuideEntryIds.length, " RECORDS"],
                    }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  onClick: () => e.current?.setSettingsOpen(!0),
                  children: [
                    "SETTINGS ",
                    (0, N.jsx)("span", { children: "LOCAL" }),
                  ],
                }),
                (0, N.jsxs)("button", {
                  type: "button",
                  onClick: () => e.current?.recoverPlayer(),
                  children: [
                    "RECOVER AT FIELD UNIT ",
                    (0, N.jsx)("span", { children: "SAFE RETURN" }),
                  ],
                }),
              ],
            }),
            (0, N.jsxs)("button", {
              type: "button",
              className: "pause-dev-button",
              onClick: () => e.current?.setDeveloperPanelOpen(!0),
              children: [
                i.devTools.enabled ? "OPEN DEV TOOLS" : "OPEN DEV MODE",
                (0, N.jsx)("span", { children: "DEV-01" }),
              ],
            }),
          ],
        }),
      i.started &&
        i.mapOpen &&
        (0, N.jsx)(MapPanel, {
          snapshot: i,
          viewport: a,
          onViewportChange: o,
          onClose: () => e.current?.setMapOpen(!1),
          onSetWaypoint: (_, b) => e.current?.setManualWaypoint(_, b),
          onClearWaypoint: () => e.current?.clearManualWaypoint(),
          onActivateNavigationTarget: (_) =>
            e.current?.activateNavigationTarget(_),
          onFastTravel: (_) => e.current?.fastTravel(_),
        }),
      i.started &&
        i.devTools.panelOpen &&
        (0, N.jsx)(DeveloperPanel, {
          snapshot: i,
          onClose: () => e.current?.setDeveloperPanelOpen(!1),
          onSetEnabled: (_) => e.current?.setDeveloperMode(_),
          onSetTime: (_) => e.current?.setDeveloperTimeOfDay(_),
          onAdvanceTime: (_) => e.current?.advanceDeveloperMinutes(_),
          onSetClockPaused: (_) => e.current?.setDeveloperClockPaused(_),
          onSetWeather: (_) => e.current?.setDeveloperWeather(_),
          onSetHorizonMode: (_) => e.current?.setHorizonMode(_),
          onSetHealth: (_) => e.current?.setPlayerHealth(_),
          onApplyFall: (_) => e.current?.applyFallImpact(_),
          onRecover: () => e.current?.recoverPlayer(),
          onSetInvincible: (_) => e.current?.setDeveloperInvincible(_),
          onSetSpeedMode: (_) => e.current?.setDeveloperSpeedMode(_),
          onSetFly: (_) => e.current?.setDeveloperFly(_),
          onSetCameraView: (_) => e.current?.setCameraView(_),
          onTravelToForestStressTest: () =>
            e.current?.travelToForestStressTest(),
          onSetForestStressLevel: (_) => e.current?.setForestStressLevel(_),
          onSetGraphicsBenchmarkTarget: (_) =>
            e.current?.setGraphicsBenchmarkTarget(_),
          onStartGraphicsBenchmark: () => e.current?.startGraphicsBenchmark(),
          onCancelGraphicsBenchmark: () => e.current?.cancelGraphicsBenchmark(),
          onSetGraphicsFeature: (_, b) => e.current?.setGraphicsFeature(_, b),
          onReset: () => e.current?.resetDeveloperOverrides(),
        }),
      i.started &&
        i.inventoryOpen &&
        (0, N.jsx)(InventoryPanel, {
          snapshot: i,
          onClose: () => e.current?.resume(),
          onUseItem: (_) => e.current?.useInventoryItem(_),
        }),
      i.started &&
        i.featureOverlay?.kind === "operations" &&
        (0, N.jsx)(OperationsPanel, {
          snapshot: i,
          initialTab: i.featureOverlay.tab,
          station: i.featureOverlay.station,
          onClose: () => {
            (e.current?.setFeatureOverlay(null), e.current?.resume());
          },
          onAcceptContract: (_) => e.current?.acceptContract(_),
          onTurnInContract: (_) => e.current?.turnInContract(_),
          onCraft: (_, b) => e.current?.craftRecipe(_, b),
        }),
      i.started &&
        i.featureOverlay?.kind === "dialogue" &&
        (0, N.jsx)(DialoguePanel, {
          snapshot: i,
          npcId: i.featureOverlay.npcId,
          onClose: () => {
            (e.current?.setFeatureOverlay(null), e.current?.resume());
          },
          onAcceptContract: (_) => e.current?.acceptContract(_),
          onTurnInContract: (_) => e.current?.turnInContract(_),
          onOpenOperations: () =>
            e.current?.setFeatureOverlay({
              kind: "operations",
              tab: "contracts",
              station: "field",
            }),
        }),
      i.started &&
        i.featureOverlay?.kind === "container" &&
        (0, N.jsx)(ContainerPanel, {
          snapshot: i,
          containerId: i.featureOverlay.containerId,
          onClose: () => {
            (e.current?.setFeatureOverlay(null), e.current?.resume());
          },
          onTakeItem: (_, b, T) => e.current?.takeContainerItem(_, b, T),
          onTakeAll: (_) => e.current?.takeAllContainerItems(_),
        }),
      i.started &&
        i.featureOverlay?.kind === "rest" &&
        (0, N.jsx)(RestPanel, {
          snapshot: i,
          site: i.featureOverlay.site,
          onClose: () => {
            (e.current?.setFeatureOverlay(null), e.current?.resume());
          },
          onRest: (_) => e.current?.completeRest(_),
        }),
      i.settingsOpen &&
        (0, N.jsx)(SettingsPanel, {
          snapshot: i,
          onClose: () =>
            i.started ? e.current?.resume() : e.current?.setSettingsOpen(!1),
          onSetFov: (_) => e.current?.setFov(_),
          onSetCameraDistance: (_) => e.current?.setCameraDistance(_),
          onSetCameraView: (_) => e.current?.setCameraView(_),
          onSetIsometricAngle: (_) => e.current?.setIsometricAngle(_),
          onSetSensitivity: (_) => e.current?.setLookSensitivity(_),
          onSetInvertY: (_) => e.current?.setInvertY(_),
          onSetVolume: (_, b) => e.current?.setAudioVolume(_, b),
          onSetQuality: (_) => e.current?.setQuality(_),
          onSetHorizon: (_) => e.current?.setHorizonMode(_),
          onSetWorldDetail: (_) => e.current?.setWorldDetail(_),
          onSetInterfaceScale: (_) => e.current?.setInterfaceScale(_),
          onRebind: (_, b) => e.current?.setKeyBinding(_, b),
          onReset: () => e.current?.resetSettings(),
          onOpenDisplay: () => KIT?.menu.open(),
        }),
      i.started &&
        i.activeInspection &&
        (0, N.jsx)(InspectionPanel, {
          inspection: i.activeInspection,
          onClose: () => e.current?.resume(),
        }),
      i.started &&
        i.incapacitated &&
        i.contextStatus === "ready" &&
        (0, N.jsxs)("section", {
          className: "incapacitated-panel",
          role: "dialog",
          "aria-modal": "true",
          "data-testid": "incapacitated-panel",
          children: [
            (0, N.jsx)("p", {
              className: "eyebrow",
              children: "FIELD UNIT / VITALS LOST",
            }),
            (0, N.jsx)("h2", { children: "You cannot continue from here." }),
            (0, N.jsx)("p", {
              children:
                "The survey state is intact. Recover at the Field Unit Compound to resume with full health.",
            }),
            (0, N.jsxs)("button", {
              type: "button",
              autoFocus: !0,
              onClick: () => e.current?.recoverPlayer(),
              onKeyDown: (_) => {
                _.ctrlKey ||
                  _.metaKey ||
                  _.altKey ||
                  _.defaultPrevented ||
                  _.code !== i.settings.keyBindings.recover ||
                  _.repeat ||
                  (_.preventDefault(), e.current?.recoverPlayer());
              },
              children: [
                "RECOVER AT FIELD UNIT ",
                (0, N.jsx)("span", { children: "\u2197" }),
              ],
            }),
            (0, N.jsxs)("small", {
              children: [
                i.inputSource === "keyboard"
                  ? keyLabel(i.settings.keyBindings.recover)
                  : controlGlyph(i.inputSource, "recover"),
                " \xB7 QUICK RECOVERY",
              ],
            }),
          ],
        }),
      i.contextStatus === "lost" &&
        (0, N.jsxs)("section", {
          className: "context-panel",
          role: "alert",
          children: [
            (0, N.jsx)("p", {
              className: "eyebrow",
              children: "GRAPHICS CONTEXT LOST",
            }),
            (0, N.jsx)("h2", { children: "Holding simulation state." }),
            (0, N.jsx)("p", {
              children:
                "The renderer will resume if the browser restores GPU access.",
            }),
          ],
        }),
      p &&
        (0, N.jsxs)("aside", {
          className: "discovery-card",
          "data-testid": "discovery-card",
          "aria-live": "polite",
          children: [
            (0, N.jsx)("button", {
              type: "button",
              "aria-label": "Dismiss discovery",
              onClick: () => e.current?.clearDiscoveryNotice(),
              children: "\xD7",
            }),
            (0, N.jsxs)("p", { children: ["RECORD RECOVERED / ", p.code] }),
            (0, N.jsx)("h2", { children: p.name }),
            (0, N.jsx)("blockquote", { children: p.note }),
            (0, N.jsxs)("small", {
              children: [
                i.scanned.length,
                " OF ",
                RELAYS.length,
                " SIGNALS COHERENT",
              ],
            }),
          ],
        }),
      i.lastLocationDiscovery &&
        !p &&
        (0, N.jsxs)("aside", {
          className: "location-discovery-card",
          "data-testid": "location-discovery-card",
          "aria-live": "polite",
          children: [
            (0, N.jsx)("button", {
              type: "button",
              "aria-label": "Dismiss location discovery",
              onClick: () => e.current?.clearLocationDiscoveryNotice(),
              children: "\xD7",
            }),
            (0, N.jsxs)("p", {
              children: [
                "LOCATION DISCOVERED / ",
                i.lastLocationDiscovery.kind.toUpperCase(),
              ],
            }),
            (0, N.jsx)("h2", { children: i.lastLocationDiscovery.name }),
            (0, N.jsx)("blockquote", {
              children: i.lastLocationDiscovery.note,
            }),
            (0, N.jsxs)("small", {
              children: [
                i.lastLocationDiscovery.region,
                " \xB7 ",
                i.discoveredLocationIds.length,
                " LOCATIONS LOGGED",
              ],
            }),
          ],
        }),
      i.lastFeatureNotice &&
        !p &&
        !i.lastLocationDiscovery &&
        (0, N.jsxs)("aside", {
          className: `feature-notice feature-notice-${i.lastFeatureNotice.type}`,
          "data-testid": "feature-notice",
          "aria-live": "polite",
          children: [
            (0, N.jsx)("button", {
              type: "button",
              "aria-label": "Dismiss gameplay notice",
              onClick: () => e.current?.clearFeatureNotice(),
              children: "\xD7",
            }),
            (0, N.jsxs)("p", {
              children: [
                i.lastFeatureNotice.type.toUpperCase(),
                " / FIELD UPDATE",
              ],
            }),
            (0, N.jsx)("h2", { children: i.lastFeatureNotice.title }),
            (0, N.jsx)("small", { children: i.lastFeatureNotice.detail }),
          ],
        }),
      i.lastGather &&
        S &&
        (0, N.jsxs)("aside", {
          className: "gather-card",
          "data-testid": "gather-card",
          "aria-live": "polite",
          children: [
            (0, N.jsx)("button", {
              type: "button",
              "aria-label": "Dismiss gathering result",
              onClick: () => e.current?.clearGatherNotice(),
              children: "\xD7",
            }),
            (0, N.jsx)("p", {
              children:
                i.lastGather.result === "hit"
                  ? "RESOURCE WORKED"
                  : "MATERIAL SECURED",
            }),
            (0, N.jsx)("h2", { children: i.lastGather.targetName }),
            (0, N.jsx)("strong", {
              children:
                i.lastGather.quantity > 0
                  ? `+${i.lastGather.quantity} ${S.shortName}`
                  : `${i.lastGather.remainingHits} HITS REMAIN`,
            }),
            (0, N.jsx)("small", { children: "STATE SAVED TO THE WORLD DELTA" }),
          ],
        }),
    ],
  });
}
var YL = ut(Ht(), 1);
function dw() {
  return (0, YL.jsx)(App, {});
}
(0, ZL.createRoot)(document.getElementById("root")).render(
  qL.default.createElement(dw),
);
