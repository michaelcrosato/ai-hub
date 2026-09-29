/**
 * ui.js — Brightline City's HUD, minimap, full map, journal, stores and
 * menus. React, exactly as the original built them; the game drives them
 * through the `onHud` snapshot it emits ten times a second, and they call
 * back into the game through `api.current`.
 *
 * On-screen touch controls come from the kit now (built from the game's
 * input actions), so the old touch pad is gone from here.
 */
import { useState, useEffect, useRef, useMemo, useCallback, createRoot, jsx, jsxs, Fragment } from "./vendor/react.js";
import { CITY, FACTIONS, DISTRICTS, DEFAULT_SETTINGS } from "./data.js";
import { startCityGame } from "./game.js";

const INITIAL_HUD = {
  ready: false,
  renderer: "WebGL2",
  inputSource: "keyboard",
  cameraMode: "isometric",
  money: 475,
  health: 100,
  armor: 0,
  wanted: 0,
  heat: 0,
  district: "Sunline Center",
  districtSubtitle: "Towers, transit and bright ideas",
  objective: "Preparing the city\u2026",
  objectiveDetail: "Starting the living simulation.",
  objectiveTime: 0,
  interaction: "",
  speed: 0,
  vehicleName: "",
  vehicleHealth: 0,
  vehicleCondition: "",
  movementLabel: "ON FOOT",
  timeLabel: "9:15 AM",
  weather: "clear",
  reputation: 0,
  collectibles: 0,
  collectibleTotal: 12,
  missionTitle: "A Favor in Motion",
  missionOptional: "",
  factions: FACTIONS.map((i) => ({
    id: i.id,
    name: i.name,
    color: i.color,
    standing: 0,
    tier: "Neutral",
  })),
  activityTitle: "",
  activityProgress: "",
  activityTime: 0,
  eventTitle: "",
  eventObjective: "",
  eventProgress: "",
  eventTime: 0,
  isDriving: false,
  titleOpen: false,
  paused: false,
  mapOpen: false,
  helpOpen: false,
  settingsOpen: false,
  onboardingOpen: false,
  newGameConfirmOpen: false,
  storeOpen: false,
  journalOpen: false,
  storeTitle: "",
  storeSubtitle: "",
  storeOffers: [],
  missionJournal: [],
  result: null,
  record: null,
  settings: { ...DEFAULT_SETTINGS },
  hasSave: false,
  minimap: [],
  route: [],
  playerX: -49,
  playerZ: -44,
  toasts: [],
};
const DESTINATION_RANK = { objective: 0, event: 1, mission: 2, activity: 3, business: 4 };
const MAP_ROADS_X = [-96, -32, 32, 96];
const MAP_ROADS_Z = [-76, -20, 36, 88];
function mapX(i) {
  return i + CITY.width / 2;
}
function mapZ(i) {
  return i + CITY.depth / 2;
}
function markerColor(i) {
  switch (i) {
    case "player":
      return "#fff7d6";
    case "objective":
      return "#ffe05c";
    case "mission":
      return "#ff78c8";
    case "police":
      return "#ff5f73";
    case "event":
      return "#44edca";
    case "business":
      return "#b49aff";
    case "activity":
      return "#ffb84d";
  }
}
function markerLabel(i) {
  return i.kind === "objective"
    ? "Current objective"
    : i.kind === "player"
      ? "Your position"
      : i.id
          .replace(/^(activity-|event-|business-|mission-)/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (e) => e.toUpperCase());
}
function MapMarker({ entity: i, compact: e }) {
  let t = markerColor(i.kind),
    r = e ? 4.2 : 3.2,
    s = { fill: t, stroke: "#243446", strokeWidth: e ? 1.7 : 1.25 };
  return i.kind === "player"
    ? jsxs(Fragment, {
        children: [
          jsx("polygon", {
            points: `0,-${r + 2} ${r + 1},${r + 2} 0,${r} -${r + 1},${r + 2}`,
            ...s,
          }),
          jsx("circle", {
            r: e ? 9.5 : 7,
            fill: "none",
            stroke: "#fff7d6",
            strokeWidth: "1",
            opacity: "0.6",
          }),
        ],
      })
    : i.kind === "objective"
      ? jsx("rect", {
          x: -r,
          y: -r,
          width: r * 2,
          height: r * 2,
          transform: "rotate(45)",
          ...s,
        })
      : i.kind === "mission"
        ? jsxs(Fragment, {
            children: [jsx("circle", { r: r + 1, ...s }), jsx("circle", { r: 1.2, fill: "#243446" })],
          })
        : i.kind === "business"
          ? jsx("rect", {
              x: -r,
              y: -r,
              width: r * 2,
              height: r * 2,
              rx: "0.8",
              ...s,
            })
          : i.kind === "police"
            ? jsx("path", {
                d: `M-${r},-1 H-1 V-${r} H1 V-1 H${r} V1 H1 V${r} H-1 V1 H-${r} Z`,
                ...s,
              })
            : i.kind === "event"
              ? jsx("polygon", {
                  points: `0,-${r + 1} ${r},${r} -${r},${r}`,
                  ...s,
                })
              : jsx("polygon", {
                  points: `0,-${r + 1} ${r + 1},-${r / 2} ${r},${r} -${r},${r} -${r + 1},-${r / 2}`,
                  ...s,
                });
}
function CityMap({ entities: i, route: e, compact: t, onWaypoint: r }) {
  let s = useRef(null),
    [n, a] = useState({ x: 0, z: 0 }),
    o = e.map((f) => `${mapX(f.x)},${mapZ(f.z)}`).join(" "),
    l = (f) => {
      if (!r || !s.current) return;
      let u = s.current.getBoundingClientRect(),
        h = ((f.clientX - u.left) / u.width) * CITY.width - CITY.width / 2,
        d = ((f.clientY - u.top) / u.height) * CITY.depth - CITY.depth / 2;
      (a({ x: h, z: d }), r(h, d));
    },
    c = (f) => {
      if (!r) return;
      let u = f.shiftKey ? 20 : 8,
        h = n;
      if (f.key === "ArrowLeft") h = { ...n, x: Math.max(-CITY.width / 2, n.x - u) };
      else if (f.key === "ArrowRight") h = { ...n, x: Math.min(CITY.width / 2, n.x + u) };
      else if (f.key === "ArrowUp") h = { ...n, z: Math.max(-CITY.depth / 2, n.z - u) };
      else if (f.key === "ArrowDown") h = { ...n, z: Math.min(CITY.depth / 2, n.z + u) };
      else if (f.key === "Enter" || f.key === " ") {
        (f.preventDefault(), r(n.x, n.z));
        return;
      } else return;
      (f.preventDefault(), a(h));
    };
  return jsxs("svg", {
    ref: s,
    className: t ? "city-map city-map--compact" : "city-map",
    viewBox: `0 0 ${CITY.width} ${CITY.depth}`,
    role: !t && r ? "application" : "img",
    "aria-label": t
      ? "Nearby city map"
      : "Brightline city map. Use arrow keys to move the cursor and Enter to set a waypoint.",
    tabIndex: !t && r ? 0 : undefined,
    onClick: l,
    onKeyDown: c,
    children: [
      jsx("rect", {
        width: "124",
        height: "104",
        x: "0",
        y: "0",
        fill: "#3c87bd",
      }),
      jsx("rect", {
        width: "124",
        height: "104",
        x: "124",
        y: "0",
        fill: "#35a892",
      }),
      jsx("rect", {
        width: "124",
        height: "104",
        x: "0",
        y: "104",
        fill: "#6eb659",
      }),
      jsx("rect", {
        width: "124",
        height: "104",
        x: "124",
        y: "104",
        fill: "#d9823e",
      }),
      jsx("rect", {
        width: "18",
        height: "104",
        x: "230",
        y: "0",
        fill: "#299bb3",
        opacity: "0.85",
      }),
      jsxs("g", {
        opacity: "0.82",
        "aria-hidden": "true",
        children: [
          MAP_ROADS_X.map((f) =>
            jsx(
              "rect",
              {
                x: mapX(f) - 5.5,
                y: "0",
                width: "11",
                height: CITY.depth,
                rx: "1.5",
                fill: "#425565",
              },
              `road-x-${f}`,
            ),
          ),
          MAP_ROADS_Z.map((f) =>
            jsx(
              "rect",
              {
                x: "0",
                y: mapZ(f) - 5.5,
                width: CITY.width,
                height: "11",
                rx: "1.5",
                fill: "#425565",
              },
              `road-z-${f}`,
            ),
          ),
        ],
      }),
      !t &&
        jsxs("g", {
          className: "map-district-labels",
          "aria-hidden": "true",
          children: [
            jsx("text", { x: "14", y: "18", children: "SUNLINE" }),
            jsx("text", { x: "150", y: "18", children: "OLD QUAY" }),
            jsx("text", { x: "14", y: "125", children: "GARDEN ROW" }),
            jsx("text", { x: "150", y: "125", children: "MAKER YARD" }),
          ],
        }),
      o &&
        jsx("polyline", {
          className: "map-route-line",
          points: o,
          fill: "none",
          stroke: "#43f0cc",
          strokeWidth: t ? 3.4 : 2.2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeDasharray: t ? "4 3" : "3 2",
        }),
      i.map((f) =>
        jsxs(
          "g",
          {
            className: `map-marker map-marker--${f.kind}`,
            transform: `translate(${mapX(f.x)} ${mapZ(f.z)})`,
            children: [jsx("title", { children: markerLabel(f) }), jsx(MapMarker, { entity: f, compact: t })],
          },
          f.id,
        ),
      ),
      !t &&
        r &&
        jsxs("g", {
          transform: `translate(${mapX(n.x)} ${mapZ(n.z)})`,
          className: "map-cursor",
          "aria-hidden": "true",
          children: [
            jsx("circle", {
              r: "6",
              fill: "none",
              stroke: "#fff",
              strokeWidth: "1.5",
            }),
            jsx("path", {
              d: "M-9 0 H-4 M4 0 H9 M0 -9 V-4 M0 4 V9",
              stroke: "#fff",
              strokeWidth: "1.5",
            }),
          ],
        }),
    ],
  });
}
function Meter({ value: i, tone: e, label: t }) {
  let r = Math.round(Math.max(0, Math.min(100, i)));
  return jsx("span", {
    className: `meter meter--${e}`,
    role: "progressbar",
    "aria-label": t,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": r,
    "aria-valuetext": `${r} percent`,
    children: jsx("span", {
      style: { transform: `scaleX(${r / 100})` },
    }),
  });
}
function AbandonMissionButton({ api: i }) {
  let [e, t] = useState(false);
  return (
    useEffect(() => {
      if (!e) return;
      let r = window.setTimeout(() => t(false), 5e3);
      return () => window.clearTimeout(r);
    }, [e]),
    jsx("button", {
      type: "button",
      className: "danger-action",
      onClick: () => {
        if (!e) {
          t(true);
          return;
        }
        (t(false), i.current?.abandonCurrentMission());
      },
      children: e ? "Confirm checkpoint reset" : "Set aside current mission",
    })
  );
}
function useDialogFocus(i, e, t) {
  useEffect(() => {
    if (!i || !e.current) return;
    let r = e.current,
      s = t.current,
      n = document.activeElement instanceof HTMLElement ? document.activeElement : null,
      a = () =>
        Array.from(
          r.querySelectorAll(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((c) => c.offsetParent !== null),
      // Start on the dialog's main action (Next, Enter city, Resume…) so Enter or the
      // gamepad's A does the expected thing; otherwise on its first control.
      o = requestAnimationFrame(() => (a().find((c) => c.classList.contains("primary-action")) ?? a()[0] ?? r).focus()),
      l = (c) => {
        if (c.key !== "Tab") return;
        let f = a();
        if (!f.length) {
          (c.preventDefault(), r.focus());
          return;
        }
        let u = f[0],
          h = f[f.length - 1];
        c.shiftKey && document.activeElement === u
          ? (c.preventDefault(), h.focus())
          : !c.shiftKey && document.activeElement === h && (c.preventDefault(), u.focus());
      };
    return (
      r.addEventListener("keydown", l),
      () => {
        (cancelAnimationFrame(o),
          r.removeEventListener("keydown", l),
          n && n !== document.body && n.isConnected ? n.focus() : s?.focus());
      }
    );
  }, [i, t, e]);
}
/**
 * The controls strip in the guide, for whatever the player is holding. The
 * keyboard strip is the original's; the controller and touch ones follow the
 * game's input actions.
 */
var CONTROL_STRIPS = {
  keyboard: {
    title: "Keyboard & mouse",
    keys: [
      ["F", "shove"],
      ["CTRL", "crouch"],
      ["C", "camera"],
      ["J", "missions"],
      ["M", "map"],
      ["O", "settings"],
      ["P", "pause"],
      [null, "Drag \xB7 look"],
      [null, "Wheel \xB7 zoom"],
    ],
  },
  gamepad: {
    title: "Controller",
    keys: [
      ["L-STICK", "move / steer"],
      ["RT / LT", "drive / reverse"],
      ["A", "jump / brake"],
      ["B", "sprint \xB7 back"],
      ["LT", "crouch"],
      ["Y", "interact"],
      ["X", "shove / horn"],
      ["R-STICK", "look"],
      ["RS", "camera"],
      ["LB / RB", "zoom"],
      ["BACK", "map"],
      ["START", "pause"],
    ],
  },
  touch: {
    title: "Touch",
    keys: [
      ["STICK", "move / steer"],
      ["USE", "interact \xB7 exit"],
      ["JUMP", "jump \xB7 brake"],
      ["ACT", "shove"],
      ["RUN", "sprint"],
      ["DUCK", "crouch"],
      ["CAM", "camera"],
      [null, "Drag right side \xB7 look"],
      [null, "Pinch \xB7 zoom"],
      [null, "Tap minimap \xB7 map"],
    ],
  },
};
var ONBOARDING = [
  {
    kicker: "WELCOME TO BRIGHTLINE",
    title: "One city. Your own rhythm.",
    body: "Walk, drive, explore, help people, run jobs, or simply watch the city react. The gold route suggests a story path, but it never locks the streets.",
    detail: "Use WASD or the on-screen pad \xB7 E / USE interacts \xB7 C / CAM changes camera",
  },
  {
    kicker: "A LIVING SYSTEM",
    title: "The city notices what happens.",
    body: "Traffic follows signals, citizens keep schedules, weather changes grip and crowds, and witnesses\u2014not invisible rules\u2014report crime. Lose observation to end a search.",
    detail: "Normal city systems remain active during missions",
  },
  {
    kicker: "CHOOSE A PATH",
    title: "Every district rewards curiosity.",
    body: "Follow missions, start orange activities, respond to mint city events, visit businesses, build faction trust, or collect purple City Sparks. Pause any time for settings and the guide.",
    detail: "Use J / M / H on keyboard, or the labeled HUD buttons",
  },
];
function App() {
  let canvasRef = useRef(null),
    gameRef = useRef(null),
    api = useRef(null),
    dialogRef = useRef(null),
    [hud, setHud] = useState(INITIAL_HUD),
    [fatal, setFatal] = useState(""),
    [step, setStep] = useState(0);
  useEffect(() => {
    let A = canvasRef.current;
    if (!A) return;
    let T = false,
      C = null;
    return (
      startCityGame(A, (M) => {
        T || setHud(M);
      })
        .then((I) => {
          if (T) {
            I.dispose();
            return;
          }
          ((C = I), (gameRef.current = I), (api.current = I));
        })
        .catch((I) => {
          (console.error(I),
            T ||
              setFatal(
                "Brightline could not start its 3D renderer. Try updating your browser or enabling hardware acceleration.",
              ));
        }),
      () => {
        ((T = true), C?.dispose(), (gameRef.current = null), (api.current = null));
      }
    );
  }, []);
  let setWaypoint = useCallback((A, T) => api.current?.setWaypoint(A, T), []),
    overlay = hud.onboardingOpen
      ? "onboarding"
      : hud.titleOpen
        ? "title"
        : hud.mapOpen
          ? "map"
          : hud.helpOpen
            ? "help"
            : hud.settingsOpen
              ? "settings"
              : hud.journalOpen
                ? "journal"
                : hud.storeOpen
                  ? "store"
                  : hud.newGameConfirmOpen
                    ? "confirm"
                    : hud.paused
                      ? "pause"
                      : "";
  useDialogFocus(overlay, dialogRef, canvasRef);
  let overlayOpen = !!overlay,
    visibleToasts = hud.titleOpen || hud.onboardingOpen ? hud.toasts.filter((A) => A.tone === "danger") : hud.toasts,
    weatherLabel = hud.weather === "rain" ? "RAIN" : hud.weather === "fog" ? "MIST" : hud.weather.toUpperCase(),
    cameraLabel = hud.cameraMode === "isometric" ? "ISO" : hud.cameraMode === "third-person" ? "3RD" : "1ST",
    pad = hud.inputSource === "gamepad",
    controlStrip = CONTROL_STRIPS[hud.inputSource] ?? CONTROL_STRIPS.keyboard,
    wantedPips = Array.from({ length: 5 }, (A, T) => T < hud.wanted),
    // Quick destinations, most useful first: the current objective, an incident,
    // new missions, then activities and businesses.
    destinations = useMemo(
      () =>
        hud.minimap
          .filter((A) => A.kind !== "player" && A.kind !== "police")
          .sort((A, T) => (DESTINATION_RANK[A.kind] ?? 9) - (DESTINATION_RANK[T.kind] ?? 9)),
      [hud.minimap],
    ),
    a11yAttrs = {
      "data-contrast": hud.settings.highContrast ? "true" : "false",
      "data-large-text": hud.settings.largeText ? "true" : "false",
      "data-reduced-motion": hud.settings.reducedMotion ? "true" : "false",
      "data-color-vision": hud.settings.colorVision,
    },
    updateSettings = (A) => api.current?.updateSettings(A);
  return jsxs("main", {
    className: "game-shell",
    ...a11yAttrs,
    children: [
      jsx("canvas", {
        ref: canvasRef,
        className: "game-canvas",
        "aria-label": "Brightline City playable 3D world",
        "aria-hidden": overlayOpen,
        tabIndex: overlayOpen ? -1 : 0,
      }),
      !hud.ready &&
        !fatal &&
        jsxs("section", {
          className: "loading-screen",
          "aria-live": "polite",
          children: [
            jsxs("div", {
              className: "loading-logo",
              "aria-hidden": "true",
              children: [jsx("span", {}), jsx("span", {}), jsx("span", {})],
            }),
            jsx("p", {
              className: "eyebrow",
              children: "A systemic city sandbox",
            }),
            jsx("h1", { children: "BRIGHTLINE" }),
            jsx("div", {
              className: "loading-track",
              children: jsx("span", {}),
            }),
            jsx("p", {
              className: "loading-note",
              children: "Opening streets \xB7 scheduling citizens \xB7 waking traffic",
            }),
          ],
        }),
      fatal &&
        jsxs("section", {
          className: "fatal-card",
          role: "alert",
          children: [
            jsx("p", {
              className: "eyebrow",
              children: "Renderer unavailable",
            }),
            jsx("h1", { children: "The city lights are off." }),
            jsx("p", { children: fatal }),
            jsx("button", {
              type: "button",
              onClick: () => window.location.reload(),
              children: "Try again",
            }),
          ],
        }),
      hud.ready &&
        !fatal &&
        !overlayOpen &&
        jsxs("div", {
          className: "hud",
          "aria-label": "Game heads-up display",
          children: [
            // Each hit remounts this (new key), which replays its fade.
            hud.hurt > 0 && jsx("div", { className: "hurt-flash", "aria-hidden": "true" }, `hurt-${hud.hurt}`),
            jsxs("header", {
              className: "topbar",
              children: [
                jsxs("section", {
                  className: "district-card glass-panel",
                  children: [
                    jsxs("div", {
                      className: "brand-mark",
                      "aria-hidden": "true",
                      children: [jsx("span", {}), jsx("span", {}), jsx("span", {})],
                    }),
                    jsxs("div", {
                      children: [
                        jsx("p", {
                          className: "eyebrow",
                          children: "NOW IN",
                        }),
                        jsx("h2", { children: hud.district }),
                        jsx("p", { children: hud.districtSubtitle }),
                      ],
                    }),
                  ],
                }),
                jsxs("section", {
                  className: "city-status glass-panel",
                  children: [
                    jsx("span", {
                      className: "status-chip",
                      children: hud.timeLabel,
                    }),
                    jsx("span", {
                      className: `status-chip weather weather--${hud.weather}`,
                      children: weatherLabel,
                    }),
                    jsx("span", {
                      className: "status-chip renderer-chip",
                      children: hud.renderer,
                    }),
                    jsxs("button", {
                      type: "button",
                      className: "status-chip camera-chip",
                      onClick: () => api.current?.cycleCamera(),
                      "aria-label": `Camera mode: ${hud.cameraMode}. Change camera.`,
                      title: "Change camera (C)",
                      children: [
                        jsx("span", { className: "camera-chip__cam", children: "CAM" }, "c"),
                        jsx("span", { children: cameraLabel }, "m"),
                      ],
                    }),
                    jsx("button", {
                      type: "button",
                      className: "icon-button",
                      onClick: () => api.current?.toggleJournal(),
                      "aria-label": "Open mission journal",
                      title: "Mission journal (J)",
                      children: "J",
                    }),
                    jsx("button", {
                      type: "button",
                      className: "icon-button settings-button",
                      onClick: () => api.current?.toggleSettings(),
                      "aria-label": "Open settings",
                      children: "O",
                    }),
                    jsx("button", {
                      type: "button",
                      className: "icon-button",
                      onClick: () => api.current?.toggleHelp(),
                      "aria-label": "Open controls",
                      children: "?",
                    }),
                    jsx("button", {
                      type: "button",
                      className: "icon-button",
                      onClick: () => api.current?.togglePause(),
                      "aria-label": "Pause game",
                      children: "II",
                    }),
                  ],
                }),
              ],
            }),
            jsxs("div", {
              className: "right-status-stack",
              children: [
                jsxs("section", {
                  className: "mission-card glass-panel",
                  children: [
                    jsxs("div", {
                      className: "mission-kicker",
                      children: [jsx("span", {}), " ", hud.missionTitle],
                    }),
                    jsx("h3", { children: hud.objective }),
                    jsx("p", { children: hud.objectiveDetail }),
                    hud.missionOptional &&
                      jsx("em", {
                        className: "mission-optional",
                        children: hud.missionOptional,
                      }),
                    hud.objectiveTime > 0 &&
                      jsxs("strong", {
                        className: "objective-timer",
                        children: [hud.objectiveTime, "s"],
                      }),
                  ],
                }),
                hud.activityTitle &&
                  jsxs("section", {
                    className: "activity-card glass-panel",
                    children: [
                      jsxs("div", {
                        children: [
                          jsx("span", { children: "LIVE ACTIVITY" }),
                          jsx("strong", { children: hud.activityTitle }),
                        ],
                      }),
                      jsxs("div", {
                        className: "activity-time",
                        children: [hud.activityTime, jsx("small", { children: "SEC" })],
                      }),
                      jsx("p", { children: hud.activityProgress }),
                    ],
                  }),
                hud.eventTitle &&
                  jsxs("section", {
                    className: "event-card glass-panel",
                    children: [
                      jsxs("div", {
                        children: [
                          jsx("span", { children: "LIVE INCIDENT" }),
                          jsx("strong", { children: hud.eventTitle }),
                        ],
                      }),
                      jsxs("div", {
                        className: "event-time",
                        children: [hud.eventTime, jsx("small", { children: "SEC" })],
                      }),
                      jsx("p", { children: hud.eventObjective }),
                      jsx("em", { children: hud.eventProgress }),
                    ],
                  }),
                hud.wanted > 0 &&
                  jsxs("section", {
                    className: "wanted-card",
                    children: [
                      jsx("div", {
                        className: "wanted-label",
                        children: "CITY SEARCH",
                      }),
                      jsx("div", {
                        className: "wanted-pips",
                        "aria-label": `Wanted level ${hud.wanted} out of 5`,
                        children: wantedPips.map((A, T) =>
                          jsx(
                            "span",
                            {
                              className: A ? "is-active" : "",
                              children: "\u25C6",
                            },
                            T,
                          ),
                        ),
                      }),
                      jsx(Meter, {
                        value: hud.heat,
                        tone: "heat",
                        label: "Police search heat",
                      }),
                      jsx("p", {
                        children:
                          hud.heat > 75
                            ? "Observed \u2014 break line of sight"
                            : "Search cooling \u2014 stay out of view",
                      }),
                    ],
                  }),
              ],
            }),
            jsxs("section", {
              className: "player-status glass-panel",
              children: [
                jsxs("div", {
                  className: "stat-row",
                  children: [
                    jsx("span", {
                      className: "stat-icon stat-icon--heart",
                      "aria-hidden": "true",
                      children: "+",
                    }),
                    jsx(Meter, {
                      value: hud.health,
                      tone: "health",
                      label: "Player health",
                    }),
                    jsx("strong", { children: hud.health }),
                  ],
                }),
                hud.armor > 0 &&
                  jsxs("div", {
                    className: "stat-row",
                    children: [
                      jsx("span", {
                        className: "stat-icon stat-icon--armor",
                        "aria-hidden": "true",
                        children: "\u25C7",
                      }),
                      jsx(Meter, {
                        value: hud.armor,
                        tone: "armor",
                        label: "Player armor",
                      }),
                      jsx("strong", { children: hud.armor }),
                    ],
                  }),
                jsxs("div", {
                  className: "wallet-row",
                  children: [
                    jsxs("span", {
                      className: "wallet",
                      children: ["$", hud.money.toLocaleString()],
                    }),
                    jsxs("span", {
                      className: "rep",
                      children: ["REP ", hud.reputation],
                    }),
                  ],
                }),
              ],
            }),
            jsxs("section", {
              className: "minimap-card glass-panel",
              children: [
                jsxs("button", {
                  type: "button",
                  className: "map-open",
                  onClick: () => api.current?.toggleMap(),
                  "aria-label": "Open full city map",
                  children: [
                    jsx(CityMap, {
                      entities: hud.minimap,
                      route: hud.route,
                      compact: true,
                    }),
                    jsx("span", { className: "map-key", children: "M" }),
                  ],
                }),
                jsxs("div", {
                  className: "map-footer",
                  children: [
                    jsxs("span", {
                      children: [Math.round(hud.playerX), ", ", Math.round(hud.playerZ)],
                    }),
                    jsxs("span", {
                      className: "spark-count",
                      children: ["\u25C6 ", hud.collectibles, "/", hud.collectibleTotal],
                    }),
                  ],
                }),
              ],
            }),
            jsx("section", {
              className: `motion-card glass-panel ${hud.isDriving ? "is-driving" : ""}`,
              children: hud.isDriving
                ? jsxs(Fragment, {
                    children: [
                      jsx("p", { children: hud.vehicleName }),
                      jsxs("div", {
                        className: "speed",
                        children: [jsx("strong", { children: hud.speed }), jsx("span", { children: "KM/H" })],
                      }),
                      jsxs("div", {
                        className: `vehicle-condition vehicle-condition--${hud.vehicleCondition}`,
                        children: [
                          jsx("span", { children: hud.vehicleCondition }),
                          jsx(Meter, {
                            value: hud.vehicleHealth,
                            tone: "vehicle",
                            label: "Vehicle condition",
                          }),
                          jsxs("strong", {
                            children: [hud.vehicleHealth, "%"],
                          }),
                        ],
                      }),
                      jsxs("div", {
                        className: "control-hint",
                        children: [
                          jsx("kbd", { children: pad ? "A" : "SPACE" }),
                          " brake \xB7 ",
                          jsx("kbd", { children: pad ? "X" : "Q" }),
                          " horn \xB7 ",
                          jsx("kbd", { children: pad ? "RS" : "C" }),
                          " camera",
                        ],
                      }),
                    ],
                  })
                : jsxs(Fragment, {
                    children: [
                      jsx("p", { children: hud.movementLabel }),
                      jsxs("div", {
                        className: "foot-actions",
                        children: pad
                          ? [
                              jsx("span", { children: "L-STICK" }, "m"),
                              jsx("span", { children: "B" }, "s"),
                              jsx("span", { children: "A" }, "j"),
                              jsx("span", { children: "LT" }, "c"),
                            ]
                          : [
                              jsx("span", { children: "WASD" }, "m"),
                              jsx("span", { children: "SHIFT" }, "s"),
                              jsx("span", { children: "SPACE" }, "j"),
                              jsx("span", { children: "CTRL" }, "c"),
                            ],
                      }),
                      jsxs("div", {
                        className: "control-hint",
                        children: [
                          "move \xB7 sprint \xB7 jump \xB7 crouch \xB7 ",
                          jsx("kbd", { children: pad ? "RS" : "C" }),
                          " camera",
                        ],
                      }),
                    ],
                  }),
            }),
            hud.interaction &&
              jsxs("section", {
                className: "interaction-prompt",
                children: [
                  jsx("kbd", {
                    children:
                      hud.inputSource === "gamepad"
                        ? "Y"
                        : hud.inputSource === "touch"
                          ? hud.interactionButton || "USE"
                          : "E",
                  }),
                  jsxs("div", {
                    children: [jsx("span", { children: "INTERACT" }), jsx("strong", { children: hud.interaction })],
                  }),
                ],
              }),
            hud.cameraMode === "first-person" &&
              jsx("span", {
                className: "first-person-reticle",
                "aria-hidden": "true",
              }),
            hud.result &&
              jsxs(
                "section",
                {
                  className: `result-banner result-banner--${hud.result.kind}`,
                  role: "status",
                  "aria-live": "polite",
                  children: [
                    jsx("p", { className: "eyebrow", children: hud.result.kicker }),
                    jsx("h2", { children: hud.result.title }),
                    jsxs("strong", {
                      className: "result-total",
                      children: ["+$", hud.result.total.toLocaleString()],
                    }),
                    jsx("ul", {
                      children: hud.result.lines.map((A, T) => jsx("li", { children: A }, T)),
                    }),
                    hud.result.time &&
                      jsxs("p", {
                        className: "result-time",
                        children: [
                          "TIME ",
                          hud.result.time,
                          hud.result.record
                            ? jsx("b", { children: " \xB7 NEW BEST" })
                            : hud.result.best && hud.result.best !== hud.result.time
                              ? ` \xB7 BEST ${hud.result.best}`
                              : "",
                        ],
                      }),
                  ],
                },
                hud.result.id,
              ),
          ],
        }),
      hud.ready &&
        !fatal &&
        visibleToasts.length > 0 &&
        jsx("div", {
          className: `toast-stack ${overlayOpen ? "toast-stack--overlay" : ""} ${hud.result && !overlayOpen ? "toast-stack--behind-result" : ""}`,
          children: visibleToasts.map((A) =>
            jsxs(
              "article",
              {
                role: A.tone === "danger" ? "alert" : "status",
                className: `toast toast--${A.tone ?? "neutral"}`,
                children: [
                  jsx("span", {
                    className: "toast-dot",
                    "aria-hidden": "true",
                  }),
                  jsxs("div", {
                    children: [jsx("strong", { children: A.title }), jsx("p", { children: A.body })],
                  }),
                ],
              },
              A.id,
            ),
          ),
        }),
      hud.titleOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen title-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "title-screen-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "title-card",
            children: [
              jsxs("div", {
                className: "title-brand",
                "aria-hidden": "true",
                children: [jsx("span", {}), jsx("span", {}), jsx("span", {})],
              }),
              jsx("p", {
                className: "eyebrow",
                children: "A LIVING LOW-POLY CITY",
              }),
              jsx("h1", {
                id: "title-screen-heading",
                children: "BRIGHTLINE",
              }),
              jsx("p", {
                className: "title-tagline",
                children: "Choose a destination\u2014or make your own reason to cross town.",
              }),
              jsxs("div", {
                className: "title-actions",
                children: [
                  jsx("button", {
                    type: "button",
                    className: "primary-action",
                    onClick: () => api.current?.startCity(),
                    children: hud.hasSave ? "Continue city" : "Enter city",
                  }),
                  hud.hasSave &&
                    jsx("button", {
                      type: "button",
                      onClick: () => api.current?.requestNewGame(),
                      children: "Start a new city",
                    }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.toggleSettings(),
                    children: "Settings & accessibility",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.toggleHelp(),
                    children: "How to play",
                  }),
                ],
              }),
              jsxs("div", {
                className: "title-system-strip",
                children: [
                  jsx("span", { children: "3 CAMERAS" }),
                  jsx("span", { children: "4 DISTRICTS" }),
                  jsx("span", { children: "DYNAMIC CITY" }),
                  jsx("span", { children: hud.renderer }),
                ],
              }),
            ],
          }),
        }),
      hud.onboardingOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen onboarding-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "onboarding-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "onboarding-card",
            children: [
              jsxs("div", {
                className: "onboarding-visual",
                "aria-hidden": "true",
                children: [
                  jsxs("div", {
                    className: "onboarding-city",
                    children: [jsx("span", {}), jsx("span", {}), jsx("span", {}), jsx("span", {}), jsx("i", {})],
                  }),
                  jsxs("div", {
                    className: "onboarding-step-number",
                    children: ["0", step + 1],
                  }),
                ],
              }),
              jsxs("div", {
                className: "onboarding-copy",
                "aria-live": "polite",
                children: [
                  jsx("p", {
                    className: "eyebrow",
                    children: ONBOARDING[step].kicker,
                  }),
                  jsx("h1", {
                    id: "onboarding-heading",
                    children: ONBOARDING[step].title,
                  }),
                  jsx("p", { children: ONBOARDING[step].body }),
                  jsx("strong", { children: ONBOARDING[step].detail }),
                  jsx("div", {
                    className: "onboarding-progress",
                    "aria-label": `Step ${step + 1} of ${ONBOARDING.length}`,
                    children: ONBOARDING.map((A, T) =>
                      jsx("span", { className: T === step ? "is-active" : "" }, A.kicker),
                    ),
                  }),
                  jsxs("div", {
                    className: "onboarding-actions",
                    children: [
                      jsx("button", {
                        type: "button",
                        onClick: () => api.current?.toggleSettings(),
                        children: "Settings",
                      }),
                      step > 0 &&
                        jsx("button", {
                          type: "button",
                          onClick: () => setStep((A) => A - 1),
                          children: "Back",
                        }),
                      jsx("button", {
                        type: "button",
                        onClick: () => api.current?.completeOnboarding(),
                        children: "Skip",
                      }),
                      step < ONBOARDING.length - 1
                        ? jsx("button", {
                            type: "button",
                            className: "primary-action",
                            onClick: () => setStep((A) => A + 1),
                            children: "Next",
                          })
                        : jsx("button", {
                            type: "button",
                            className: "primary-action",
                            onClick: () => api.current?.completeOnboarding(),
                            children: "Enter the city",
                          }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        }),
      hud.mapOpen &&
        jsxs("section", {
          ref: dialogRef,
          className: "overlay-screen map-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "map-heading",
          tabIndex: -1,
          children: [
            jsxs("div", {
              className: "overlay-header",
              children: [
                jsxs("div", {
                  children: [
                    jsx("p", {
                      className: "eyebrow",
                      children: "CITY NAVIGATION",
                    }),
                    jsx("h2", {
                      id: "map-heading",
                      children: "Brightline map",
                    }),
                  ],
                }),
                jsxs("button", {
                  type: "button",
                  onClick: () => api.current?.toggleMap(),
                  children: ["Close ", jsx("kbd", { children: "M" })],
                }),
              ],
            }),
            jsxs("div", {
              className: "full-map-wrap",
              children: [
                jsx(CityMap, {
                  entities: hud.minimap,
                  route: hud.route,
                  onWaypoint: setWaypoint,
                }),
                jsx("div", {
                  className: "map-instruction",
                  children: "Click, tap, or use arrow keys + Enter to set a waypoint",
                }),
              ],
            }),
            jsx("div", {
              className: "district-legend",
              children: DISTRICTS.map((A) =>
                jsxs(
                  "article",
                  {
                    style: { "--district": A.color },
                    children: [
                      jsx("span", {}),
                      jsxs("div", {
                        children: [jsx("strong", { children: A.name }), jsx("p", { children: A.subtitle })],
                      }),
                    ],
                  },
                  A.id,
                ),
              ),
            }),
            jsxs("div", {
              className: "map-sidebar",
              children: [
                jsxs("div", {
                  className: "marker-legend",
                  children: [
                    jsxs("span", {
                      children: [
                        jsx("i", {
                          className: "marker marker--objective",
                        }),
                        " Objective",
                      ],
                    }),
                    jsxs("span", {
                      children: [
                        jsx("i", {
                          className: "marker marker--mission",
                        }),
                        " Mission",
                      ],
                    }),
                    jsxs("span", {
                      children: [
                        jsx("i", {
                          className: "marker marker--business",
                        }),
                        " Business",
                      ],
                    }),
                    jsxs("span", {
                      children: [jsx("i", { className: "marker marker--event" }), " Dynamic event"],
                    }),
                    jsxs("span", {
                      children: [
                        jsx("i", {
                          className: "marker marker--activity",
                        }),
                        " Activity",
                      ],
                    }),
                    jsxs("span", {
                      children: [jsx("i", { className: "marker marker--police" }), " Police"],
                    }),
                  ],
                }),
                jsxs("nav", {
                  className: "destination-list",
                  "aria-label": "Map destinations",
                  children: [
                    jsx("p", { children: "Quick destinations" }),
                    destinations.slice(0, 12).map((A) =>
                      jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => setWaypoint(A.x, A.z),
                          children: [
                            jsx("i", {
                              className: `marker marker--${A.kind}`,
                            }),
                            jsx("span", { children: markerLabel(A) }),
                          ],
                        },
                        A.id,
                      ),
                    ),
                  ],
                }),
              ],
            }),
          ],
        }),
      hud.helpOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen help-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "help-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "help-card",
            children: [
              jsxs("div", {
                className: "overlay-header",
                children: [
                  jsxs("div", {
                    children: [
                      jsx("p", {
                        className: "eyebrow",
                        children: "QUICK GUIDE",
                      }),
                      jsx("h2", {
                        id: "help-heading",
                        children: "Make the city yours",
                      }),
                    ],
                  }),
                  jsxs("button", {
                    type: "button",
                    onClick: () => api.current?.toggleHelp(),
                    children: ["Close ", jsx("kbd", { children: "H" })],
                  }),
                ],
              }),
              jsxs("div", {
                className: "help-grid",
                children: [
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "01",
                      }),
                      jsx("h3", { children: "Move freely" }),
                      jsxs("p", {
                        children: [
                          jsx("kbd", { children: "WASD" }),
                          " or the touch pad moves, ",
                          jsx("kbd", { children: "SHIFT" }),
                          " / RUN sprints, ",
                          jsx("kbd", { children: "SPACE" }),
                          " / JUMP jumps or brakes, and ",
                          jsx("kbd", { children: "CTRL" }),
                          " / DUCK crouches. The Old Quay shoreline is swimmable.",
                        ],
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "02",
                      }),
                      jsx("h3", { children: "Use one action" }),
                      jsxs("p", {
                        children: [
                          jsx("kbd", { children: "E" }),
                          " or the touch USE button chooses the best nearby action: talk, enter, shop, help, or deliver.",
                        ],
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "03",
                      }),
                      jsx("h3", { children: "Drive anything" }),
                      jsx("p", {
                        children: "Cars have different speed, steering and durability. Wet roads have less grip.",
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "04",
                      }),
                      jsx("h3", { children: "The city witnesses" }),
                      jsx("p", {
                        children:
                          "Crime is reported by people or visible police. Stop a caller and no global search begins.",
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "05",
                      }),
                      jsx("h3", { children: "Break observation" }),
                      jsx("p", {
                        children: "Police search the last known location. Stay out of sight while the red meter cools.",
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "06",
                      }),
                      jsx("h3", { children: "Choose your rhythm" }),
                      jsx("p", {
                        children:
                          "Follow missions, find purple City Sparks, shop, greet locals, or respond to mint events.",
                      }),
                    ],
                  }),
                  jsxs("article", {
                    children: [
                      jsx("span", {
                        className: "guide-number",
                        children: "07",
                      }),
                      jsx("h3", { children: "Choose your view" }),
                      jsxs("p", {
                        children: [
                          jsx("kbd", { children: "C" }),
                          " or CAM cycles isometric, behind-player and first-person cameras. Drag to look in perspective views.",
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                className: "keyboard-strip",
                "aria-label": `${controlStrip.title} controls`,
                children: [
                  jsx("strong", { className: "keyboard-strip__title", children: controlStrip.title }),
                  controlStrip.keys.map(([key, label]) =>
                    key
                      ? jsxs("span", { children: [jsx("kbd", { children: key }), " ", label] }, `${key}-${label}`)
                      : jsx("span", { children: label }, label),
                  ),
                ],
              }),
            ],
          }),
        }),
      hud.settingsOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen settings-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "settings-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "settings-card",
            children: [
              jsxs("div", {
                className: "overlay-header",
                children: [
                  jsxs("div", {
                    children: [
                      jsx("p", {
                        className: "eyebrow",
                        children: "PLAYER PREFERENCES",
                      }),
                      jsx("h2", {
                        id: "settings-heading",
                        children: "Settings & accessibility",
                      }),
                    ],
                  }),
                  jsxs("button", {
                    type: "button",
                    onClick: () => api.current?.toggleSettings(),
                    children: ["Done ", jsx("kbd", { children: "O" })],
                  }),
                ],
              }),
              jsxs("div", {
                className: "settings-grid",
                children: [
                  jsxs("fieldset", {
                    children: [
                      jsx("legend", { children: "Experience" }),
                      jsxs("label", {
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", { children: "Difficulty" }),
                              jsx("small", {
                                children: "Damage, police cooldown, and activity timing",
                              }),
                            ],
                          }),
                          jsxs("select", {
                            value: hud.settings.difficulty,
                            onChange: (A) => updateSettings({ difficulty: A.target.value }),
                            children: [
                              jsx("option", {
                                value: "relaxed",
                                children: "Relaxed",
                              }),
                              jsx("option", {
                                value: "standard",
                                children: "Standard",
                              }),
                              jsx("option", {
                                value: "challenging",
                                children: "Challenging",
                              }),
                            ],
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "display-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", { children: "Graphics & display" }),
                              jsx("small", {
                                children: "Quality, resolution, renderer, touch and controller options (F9)",
                              }),
                            ],
                          }),
                          jsx("button", {
                            type: "button",
                            onClick: () => api.current?.openDisplaySettings(),
                            children: "Open",
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "range-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Master volume",
                              }),
                              jsx("small", {
                                children: "All ambience, vehicles, and feedback",
                              }),
                            ],
                          }),
                          jsxs("output", {
                            children: [Math.round(hud.settings.masterVolume * 100), "%"],
                          }),
                          jsx("input", {
                            "aria-label": "Master volume",
                            type: "range",
                            min: "0",
                            max: "1",
                            step: "0.05",
                            value: hud.settings.masterVolume,
                            onChange: (A) => updateSettings({ masterVolume: Number(A.target.value) }),
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "range-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Look sensitivity",
                              }),
                              jsx("small", {
                                children: "Mouse and touch camera movement",
                              }),
                            ],
                          }),
                          jsxs("output", {
                            children: [hud.settings.cameraSensitivity.toFixed(2), "\xD7"],
                          }),
                          jsx("input", {
                            "aria-label": "Camera sensitivity",
                            type: "range",
                            min: "0.5",
                            max: "1.75",
                            step: "0.05",
                            value: hud.settings.cameraSensitivity,
                            onChange: (A) => updateSettings({ cameraSensitivity: Number(A.target.value) }),
                          }),
                        ],
                      }),
                    ],
                  }),
                  jsxs("fieldset", {
                    children: [
                      jsx("legend", { children: "Accessibility" }),
                      jsxs("label", {
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Color differentiation",
                              }),
                              jsx("small", {
                                children: "Adjust navigation and marker accent colors",
                              }),
                            ],
                          }),
                          jsxs("select", {
                            value: hud.settings.colorVision,
                            onChange: (A) => updateSettings({ colorVision: A.target.value }),
                            children: [
                              jsx("option", {
                                value: "default",
                                children: "Default palette",
                              }),
                              jsx("option", {
                                value: "deuteranopia",
                                children: "Deuteranopia support",
                              }),
                              jsx("option", {
                                value: "protanopia",
                                children: "Protanopia support",
                              }),
                              jsx("option", {
                                value: "tritanopia",
                                children: "Tritanopia support",
                              }),
                            ],
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "toggle-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Reduced motion",
                              }),
                              jsx("small", {
                                children: "Snaps camera movement and reduces particles and pulses",
                              }),
                            ],
                          }),
                          jsx("input", {
                            type: "checkbox",
                            checked: hud.settings.reducedMotion,
                            onChange: (A) => updateSettings({ reducedMotion: A.target.checked }),
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "toggle-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "High-contrast HUD",
                              }),
                              jsx("small", {
                                children: "Stronger borders, text, and panel separation",
                              }),
                            ],
                          }),
                          jsx("input", {
                            type: "checkbox",
                            checked: hud.settings.highContrast,
                            onChange: (A) => updateSettings({ highContrast: A.target.checked }),
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "toggle-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Larger interface text",
                              }),
                              jsx("small", {
                                children: "Increases important HUD and menu text",
                              }),
                            ],
                          }),
                          jsx("input", {
                            type: "checkbox",
                            checked: hud.settings.largeText,
                            onChange: (A) => updateSettings({ largeText: A.target.checked }),
                          }),
                        ],
                      }),
                      jsxs("label", {
                        className: "toggle-setting",
                        children: [
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: "Tutorial hints",
                              }),
                              jsx("small", {
                                children: "Show contextual control and system reminders",
                              }),
                            ],
                          }),
                          jsx("input", {
                            type: "checkbox",
                            checked: hud.settings.tutorialHints,
                            onChange: (A) => updateSettings({ tutorialHints: A.target.checked }),
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                className: "settings-footer",
                children: [
                  jsx("p", {
                    children: "Settings are saved separately and remain when starting a new city.",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () =>
                      updateSettings({
                        ...DEFAULT_SETTINGS,
                        onboardingComplete: hud.settings.onboardingComplete,
                      }),
                    children: "Restore defaults",
                  }),
                ],
              }),
            ],
          }),
        }),
      hud.journalOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen journal-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "journal-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "journal-card",
            children: [
              jsxs("div", {
                className: "overlay-header",
                children: [
                  jsxs("div", {
                    children: [
                      jsx("p", {
                        className: "eyebrow",
                        children: "CITY STORIES",
                      }),
                      jsx("h2", {
                        id: "journal-heading",
                        children: "Mission journal",
                      }),
                      jsx("p", {
                        children:
                          "Choose when to begin a chapter. Free roam, activities, police, weather, and city events remain active during every mission.",
                      }),
                    ],
                  }),
                  jsxs("button", {
                    type: "button",
                    onClick: () => api.current?.toggleJournal(),
                    children: ["Close ", jsx("kbd", { children: "J" })],
                  }),
                ],
              }),
              jsx("div", {
                className: "journal-grid",
                children: hud.missionJournal.map((A, T) =>
                  jsxs(
                    "article",
                    {
                      className: `journal-entry journal-entry--${A.status}`,
                      style: { "--mission": A.factionColor },
                      children: [
                        jsx("div", {
                          className: "journal-number",
                          "aria-hidden": "true",
                          children: String(T + 1).padStart(2, "0"),
                        }),
                        jsxs("div", {
                          className: "journal-copy",
                          children: [
                            jsxs("div", {
                              className: "journal-meta",
                              children: [
                                jsx("span", {
                                  children: A.status.replace("current", "ACTIVE"),
                                }),
                                jsx("strong", { children: A.faction }),
                              ],
                            }),
                            jsx("h3", { children: A.title }),
                            jsx("p", {
                              className: "journal-giver",
                              children: A.giver,
                            }),
                            jsx("p", { children: A.summary }),
                            A.best &&
                              jsx("p", {
                                className: "journal-best",
                                children: `Best time ${A.best}`,
                              }),
                            jsxs("div", {
                              className: "journal-progress",
                              children: [
                                jsx("span", { children: A.progress }),
                                jsxs("strong", {
                                  children: ["$", A.reward.toLocaleString()],
                                }),
                              ],
                            }),
                            A.lockedReason &&
                              jsx("p", {
                                className: "journal-lock",
                                children: A.lockedReason,
                              }),
                          ],
                        }),
                        jsx("button", {
                          type: "button",
                          disabled: A.status === "locked" || !!A.lockedReason,
                          onClick: () => api.current?.acceptMission(A.id),
                          children: A.actionLabel,
                        }),
                      ],
                    },
                    A.id,
                  ),
                ),
              }),
              jsxs("footer", {
                className: "journal-footer",
                children: [
                  jsx("p", {
                    children:
                      "Completed chapters can be replayed for a smaller cash reward without repeating faction standing.",
                  }),
                  hud.missionJournal.some((A) => A.status === "current") && jsx(AbandonMissionButton, { api: api }),
                ],
              }),
            ],
          }),
        }),
      hud.storeOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen store-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "store-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "store-card",
            children: [
              jsxs("div", {
                className: "overlay-header",
                children: [
                  jsxs("div", {
                    children: [
                      jsx("p", {
                        className: "eyebrow",
                        children: "CITY COMMERCE",
                      }),
                      jsx("h2", {
                        id: "store-heading",
                        children: hud.storeTitle,
                      }),
                      jsx("p", { children: hud.storeSubtitle }),
                    ],
                  }),
                  jsxs("div", {
                    className: "store-header-actions",
                    children: [
                      jsxs("strong", {
                        children: ["$", hud.money.toLocaleString()],
                      }),
                      jsx("button", {
                        type: "button",
                        onClick: () => api.current?.closeStore(),
                        children: "Close",
                      }),
                    ],
                  }),
                ],
              }),
              jsx("div", {
                className: "store-grid",
                children: hud.storeOffers.map((A) =>
                  jsxs(
                    "article",
                    {
                      className: "store-offer",
                      style: { "--offer": A.color },
                      children: [
                        jsx("div", {
                          className: "offer-color",
                          "aria-hidden": "true",
                        }),
                        jsxs("div", {
                          className: "offer-heading",
                          children: [jsx("span", { children: A.tag }), jsx("h3", { children: A.name })],
                        }),
                        jsx("p", { children: A.description }),
                        jsx("ul", {
                          children: A.stats.map((T) => jsx("li", { children: T }, T)),
                        }),
                        A.lockedReason &&
                          jsx("strong", {
                            className: "offer-lock",
                            children: A.lockedReason,
                          }),
                        jsxs("div", {
                          className: "offer-action",
                          children: [
                            jsx("span", {
                              children: A.price > 0 ? `$${A.price.toLocaleString()}` : A.owned ? "OWNED" : "NO CHARGE",
                            }),
                            jsx("button", {
                              type: "button",
                              disabled: !!A.lockedReason,
                              onClick: () => api.current?.purchaseStoreOffer(A.id),
                              children: A.actionLabel,
                            }),
                          ],
                        }),
                      ],
                    },
                    A.id,
                  ),
                ),
              }),
              jsxs("footer", {
                className: "store-footer",
                children: [
                  jsxs("span", { children: ["REP ", hud.reputation] }),
                  jsx("p", {
                    children: "Owned vehicles and investments persist across saves. Ordinary world vehicles do not.",
                  }),
                ],
              }),
            ],
          }),
        }),
      hud.paused &&
        jsx("section", {
          ref: dialogRef,
          className: "overlay-screen pause-screen",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "pause-heading",
          tabIndex: -1,
          children: jsxs("div", {
            className: "pause-card",
            children: [
              jsx("p", {
                className: "eyebrow",
                children: "BRIGHTLINE IS WAITING",
              }),
              jsx("h2", {
                id: "pause-heading",
                children: "City paused",
              }),
              jsx("p", {
                children: "Traffic, citizens, events, weather and the current search are frozen.",
              }),
              jsxs("section", {
                className: "faction-network",
                "aria-label": "Faction standings",
                children: [
                  jsx("p", { children: "City network" }),
                  jsx("div", {
                    children: hud.factions.map((A) =>
                      jsxs(
                        "span",
                        {
                          style: { "--faction": A.color },
                          children: [
                            jsx("i", {}),
                            jsx("strong", { children: A.name }),
                            jsxs("small", {
                              children: [A.tier, " \xB7 ", A.standing > 0 ? "+" : "", A.standing],
                            }),
                          ],
                        },
                        A.id,
                      ),
                    ),
                  }),
                ],
              }),
              hud.record &&
                jsxs("section", {
                  className: "city-record",
                  "aria-label": "City record",
                  children: [
                    jsx("p", { children: "City record" }),
                    jsx("div", {
                      children: [
                        ["Missions", hud.record.missions],
                        ["Sparks", hud.record.sparks],
                        ["Districts", hud.record.districts],
                        ["Activities", hud.record.activities],
                        ["Vehicles", hud.record.vehicles],
                      ].map(([label, value]) =>
                        jsxs(
                          "span",
                          { children: [jsx("strong", { children: value }), jsx("small", { children: label })] },
                          label,
                        ),
                      ),
                    }),
                  ],
                }),
              jsxs("div", {
                className: "pause-actions",
                children: [
                  jsx("button", {
                    type: "button",
                    className: "primary-action",
                    onClick: () => api.current?.togglePause(),
                    children: "Resume city",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.toggleJournal(),
                    children: "Mission journal",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.save(),
                    children: "Save progress",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.toggleSettings(),
                    children: "Settings & accessibility",
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.toggleHelp(),
                    children: "Controls & guide",
                  }),
                  jsx("button", {
                    type: "button",
                    className: "danger-action",
                    onClick: () => api.current?.requestNewGame(),
                    children: "Start new game",
                  }),
                ],
              }),
              jsxs("div", {
                className: "pause-meta",
                children: [
                  jsx("span", { children: hud.district }),
                  jsx("span", { children: hud.timeLabel }),
                  jsx("span", { children: hud.renderer }),
                ],
              }),
            ],
          }),
        }),
      hud.newGameConfirmOpen &&
        jsx("section", {
          ref: dialogRef,
          className: "confirm-dialog",
          role: "alertdialog",
          "aria-modal": "true",
          "aria-labelledby": "confirm-title",
          "aria-describedby": "confirm-description",
          tabIndex: -1,
          children: jsxs("div", {
            children: [
              jsx("p", {
                className: "eyebrow",
                children: "START OVER?",
              }),
              jsx("h2", {
                id: "confirm-title",
                children: "Replace saved progress",
              }),
              jsx("p", {
                id: "confirm-description",
                children:
                  "This clears mission, money, vehicle, collectible and exploration progress stored on this device. Settings and accessibility choices stay intact.",
              }),
              jsxs("div", {
                children: [
                  jsx("button", {
                    type: "button",
                    onClick: () => api.current?.cancelNewGame(),
                    children: "Keep my city",
                  }),
                  jsx("button", {
                    type: "button",
                    className: "danger-action",
                    onClick: () => api.current?.confirmNewGame(),
                    children: "Start fresh",
                  }),
                ],
              }),
            ],
          }),
        }),
    ],
  });
}

/** Mount the whole game (HUD + canvas) into `root`. */
export function mountUI(root) {
  createRoot(root).render(jsx(App, {}));
}
