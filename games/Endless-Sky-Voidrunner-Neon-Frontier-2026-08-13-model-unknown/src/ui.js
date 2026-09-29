import { useState, useEffect, useRef, jsx, jsxs, Fragment, createPortal } from "./react.js";
import { hint, CONTROL_ROWS } from "./controls.js";
import {
  COMMODITIES,
  CONTACTS,
  CREW,
  DIFFICULTY,
  FACTIONS,
  MODULES,
  PROPERTIES,
  SHIPS,
  STORY_CHOICES,
  SYSTEMS,
  WEAPONS,
  bestKnownSale,
  cargoCapacity,
  cargoMass,
  commodityById,
  heatLabel,
  heatTier,
  marketQuotes,
  missionBoard,
  reputationLabel,
  shipById,
  shipStats,
  systemById,
  systemOwner,
  systemSecurity,
  upgradeCost,
} from "./data.js";

function Icon({ name: r }) {
  return jsx("svg", {
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    className: "icon",
    children: {
      shield: jsx("path", {
        d: "M12 2 4.5 5v5.8c0 4.8 3.1 8.7 7.5 11.2 4.4-2.5 7.5-6.4 7.5-11.2V5L12 2Zm0 3 4.5 1.8v4c0 3.3-1.8 6-4.5 8-2.7-2-4.5-4.7-4.5-8v-4L12 5Z",
      }),
      hull: jsx("path", {
        d: "m12 2 8 8-3 10H7L4 10l8-8Zm0 4-4.7 5 1.8 6h5.8l1.8-6L12 6Z",
      }),
      energy: jsx("path", {
        d: "M13.2 1 5 13h5l-1.2 10L19 9h-5l-.8-8Z",
      }),
      heat: jsx("path", {
        d: "M12.8 2c.7 4.4-3.5 5.8-3.5 9.1 0 1.2.6 2.2 1.5 2.8-.1-2.3 2.1-3.7 3.1-5.5 2 1.8 3.6 4 3.6 6.8A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-5.8C6.5 9.8 11.5 7.4 12.8 2Z",
      }),
      credits: jsx("path", {
        d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 4v1.1c1.8.3 3 1.4 3 3h-2c0-.8-.7-1.3-2-1.3s-2 .5-2 1.2c0 .6.6.9 2.4 1.3 2.6.6 3.8 1.5 3.8 3.5 0 1.7-1.2 2.8-3.2 3.1V19h-2v-1.1c-2-.3-3.3-1.5-3.3-3.3h2.1c0 .9.8 1.5 2.3 1.5 1.4 0 2.1-.5 2.1-1.2 0-.7-.6-1-2.6-1.5-2.4-.6-3.6-1.4-3.6-3.3 0-1.6 1.2-2.7 3-3V6h2Z",
      }),
      cargo: jsx("path", {
        d: "m4 7 8-4 8 4v10l-8 4-8-4V7Zm8-1.8L7.4 7.5 12 9.8l4.6-2.3L12 5.2Zm-6 5v5.6l5 2.5v-5.6l-5-2.5Zm7 8.1 5-2.5v-5.6l-5 2.5v5.6Z",
      }),
      target: jsx("path", {
        d: "M4 3h5v2H6v3H4V3Zm11 0h5v5h-2V5h-3V3ZM4 16h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
      }),
      map: jsx("path", {
        d: "m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm7-.3v12.6l4 2V6.7l-4-2Zm-5 1.6v12.5l3-1.5V4.8L5 6.3Zm11 .4v12.5l3-1.5V4.8l-3 1.9Z",
      }),
      scan: jsx("path", {
        d: "M4 4h5v2H6v3H4V4Zm11 0h5v5h-2V6h-3V4ZM4 15h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3Zm-9.5-3a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z",
      }),
      boost: jsx("path", {
        d: "M4 13 15 2l-2 7h7L9 22l2-9H4Z",
      }),
      missile: jsx("path", {
        d: "M14.5 3.2c2.2-1 4.5-1.1 6.3-1-0 1.8-.2 4.1-1.2 6.2l-5.3 5.3-4-4 4.2-6.5ZM8.8 11.1l4.1 4.1-3 3-2.4-.5-.5-2.5 1.8-4.1ZM6 17l1 1-3 3H2v-2l4-2Z",
      }),
      dock: jsx("path", {
        d: "M5 3h14v18H5V3Zm3 3v12h8V6H8Zm3 2h2v4h2l-3 4-3-4h2V8Z",
      }),
      arrow: jsx("path", {
        d: "m9 5 7 7-7 7-1.5-1.5L13 12 7.5 6.5 9 5Z",
      }),
      close: jsx("path", {
        d: "m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z",
      }),
      play: jsx("path", {
        d: "M7 4v16l13-8L7 4Z",
      }),
      save: jsx("path", {
        d: "M4 3h14l2 2v16H4V3Zm3 2v5h9V5H7Zm0 9v5h10v-5H7Zm7-8h2v3h-2V6Z",
      }),
      settings: jsx("path", {
        d: "m9.4 2 .5 2.2c.7-.2 1.4-.2 2.1-.1L13 2l3 1.2-.4 2.2c.6.4 1.1.9 1.5 1.5l2.2-.4 1.2 3-2 1a8 8 0 0 1 0 2l2 1-1.2 3-2.2-.4c-.4.6-.9 1.1-1.5 1.5l.4 2.2-3 1.2-1-2.1a8 8 0 0 1-2.1-.1L9.4 22l-3-1.2.4-2.2a7 7 0 0 1-1.5-1.5l-2.2.4-1.2-3 2-1a8 8 0 0 1 0-2l-2-1 1.2-3 2.2.4c.4-.6.9-1.1 1.5-1.5l-.4-2.2 3-1.2ZM11.5 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
      }),
      warning: jsx("path", {
        d: "M12 2 1 21h22L12 2Zm-1 6h2v7h-2V8Zm0 9h2v2h-2v-2Z",
      }),
      station: jsx("path", {
        d: "M4 8h16v10H4V8Zm3-4h10v3H7V4Zm2 6v6h2v-6H9Zm4 0v6h2v-6h-2ZM2 19h20v2H2v-2Z",
      }),
      ship: jsx("path", {
        d: "m12 2 8 15-8-3-8 3 8-15Zm0 5-2.4 6 2.4-.8 2.4.8L12 7Zm-5 11 5-2 5 2-2 4-3-2-3 2-2-4Z",
      }),
      contract: jsx("path", {
        d: "M6 2h12v20H6V2Zm3 4v2h6V6H9Zm0 5v2h6v-2H9Zm0 5v2h4v-2H9Z",
      }),
      people: jsx("path", {
        d: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-3c0-3 2.7-5 7-5s7 2 7 5v3H2Zm14-8c3.7.1 6 2 6 4.8V21h-4v-3c0-2-.7-3.7-2-5Z",
      }),
      business: jsx("path", {
        d: "M4 5h16v16H4V5Zm4-3h8v2H8V2ZM7 9v8h3V9H7Zm7 0v8h3V9h-3Z",
      }),
    }[r],
  });
}
function Meter({ value: r, max: e, color: t, label: i }) {
  let s = clampPercent((r / Math.max(1, e)) * 100);
  return jsxs("div", {
    className: "meter",
    role: "progressbar",
    "aria-label": i,
    "aria-valuemin": 0,
    "aria-valuemax": Math.round(e),
    "aria-valuenow": Math.round(r),
    children: [
      jsx("div", {
        className: "meter__fill",
        style: {
          width: `${s}%`,
          background: t,
        },
      }),
      jsx("span", {
        children: Math.round(r),
      }),
    ],
  });
}
function clampPercent(r) {
  return Math.max(0, Math.min(100, r));
}
function formatNumber(r) {
  return Math.round(r).toLocaleString("en-US");
}
function riskTone(r) {
  return r === "HIGH" || r === "EXTREME" ? "danger" : r === "MED" ? "warn" : "good";
}
/** What the HUD shows before the flight controller reports its first frame. */
const DEFAULT_VIEW = {
  ready: false,
  renderer: "WebGL",
  fps: 0,
  speed: 0,
  aimAngle: 0,
  target: null,
  prompt: null,
  promptKey: null,
  enemies: 0,
  inCombat: false,
  stationDistance: 999,
  coordinates: [0, 0],
  nearbyLabel: null,
  eventLabel: "Initializing local traffic control",
  boss: null,
  grace: false,
};

/** The device the player last used ('keyboard' | 'gamepad' | 'touch'), for key prompts. */
function useInputSource(kit) {
  const [source, setSource] = useState(kit.input.source);
  useEffect(() => {
    setSource(kit.input.source);
    const off = kit.input.onSourceChange(setSource);
    return () => {
      off();
    };
  }, [kit]);
  return source;
}

/** The kit's shared settings (quality, touch controls), kept in step with its panel. */
function useKitSettings(kit) {
  const [settings, setSettings] = useState(kit.settings.get());
  useEffect(() => {
    const off = kit.settings.subscribe((next) => setSettings(next));
    return () => {
      off();
    };
  }, [kit]);
  return settings;
}

/** A keycap for an action, labelled for the current input device. */
function Key({ source, action, className = "keycap" }) {
  return jsx("span", {
    className,
    children: hint(source, action),
  });
}

/**
 * @param {object} props
 * @param {object} props.kit      from boot()
 * @param {object} props.flight   the FlightController
 * @param {object} props.model    the Career
 * @param {HTMLCanvasElement} props.canvas  the kit's canvas
 * @param {object} props.bridge   what the frame loop reads: the current screen and the Escape/M transitions
 * @param {object} [props.sfx]    sound effects (src/audio.js)
 */
function App({ kit, flight, model, canvas, bridge, sfx }) {
  const i = model;
  const source = useInputSource(kit);
  const kitSettings = useKitSettings(kit);
  let [s, setScreen] = useState("title"),
    [a, o] = useState(flight.lastView ?? DEFAULT_VIEW),
    [l, c] = useState(0),
    [u, h] = useState([]),
    [d, f] = useState(!1),
    [m, p] = useState("hub"),
    [g, S] = useState("meridian"),
    [x, v] = useState("careers"),
    [E, R] = useState("paused"),
    [I, C] = useState("flight"),
    [confirmNew, setConfirmNew] = useState(false),
    screen = useRef("title"),
    shownScreen = useRef(""),
    P = useRef("paused"),
    M = useRef("flight"),
    O = i.state,
    N = shipStats(O);
  /**
   * Change screens. The frame loop reads bridge.mode on the very next frame,
   * so it is set here rather than after React commits.
   */
  const n = (next) => {
    const value = typeof next === "function" ? next(screen.current) : next;
    screen.current = value;
    bridge.mode = value;
    setScreen(value);
  };
  // The tutorial card lives above the kit's touch controls, so SKIP TOUR stays tappable on phones.
  const [topLayer] = useState(() => {
    const el = document.createElement("div");
    el.className = "game-top-layer";
    document.body.append(el);
    return el;
  });
  topLayer.dataset.highContrast = O.settings.highContrast ? "true" : "false";
  // The kit's canvas sits in its own host, which React never re-renders.
  const mountCanvas = (el) => {
    if (el && canvas.parentNode !== el) el.appendChild(canvas);
  };
  (useEffect(() => {
    i.onChange = () => c((V) => V + 1);
    i.onToast = (V) => {
      (h((X) => [...X.slice(-2), V]), window.setTimeout(() => h((X) => X.filter((H) => H.id !== V.id)), 5200));
      sfx?.toast(V.tone);
    };
    f(i.hasSave());
    const onPause = () => {
      n((H) =>
        H === "flight"
          ? "paused"
          : H === "paused"
            ? "flight"
            : H === "map"
              ? M.current
              : H === "settings" || H === "guide"
                ? P.current === "title"
                  ? "title"
                  : "paused"
                : H,
      );
    };
    const onOpenMap = () => {
      n((H) => (H !== "flight" ? H : (C("flight"), "map")));
    };
    flight.callbacks = {
      onView: o,
      onDock: () => {
        (p("hub"), n("docked"));
      },
      onOpenMap,
      onPause,
      // The Quiet Warden fell: the finale's choice (only from flight, never over another screen).
      onStoryChoice: () => n((H) => (H === "flight" ? "finale" : H)),
    };
    // Menu buttons click softly (the HUD's own buttons too).
    const click = (e) => {
      if (e.target?.closest?.(".overlay-screen button, .hud button, .tutorial-card button")) sfx?.ui();
    };
    document.addEventListener("click", click, true);
    bridge.onPause = onPause;
    bridge.onOpenMap = onOpenMap;
    // M closes the map again, as its CLOSE [M] button says.
    bridge.onCloseMap = () => n((H) => (H === "map" ? M.current : H));
    if (flight.lastView) o(flight.lastView);
    const save = () => {
      if (i.state.started) i.save(!0);
    };
    addEventListener("pagehide", save);
    return () => {
      removeEventListener("pagehide", save);
      document.removeEventListener("click", click, true);
      save();
      i.onChange = void 0;
      i.onToast = void 0;
    };
  }, [i]),
    useEffect(() => {
      const flying = s === "flight";
      flight.setPaused(!flying);
      // The game's own screens are DOM menus: taps go to their buttons, not the flight controls.
      kit.touch?.suspend(!flying, "game");
      // The press that closed a menu does not also act in flight.
      if (flying) kit.input.settle();
      if (s !== "title") setConfirmNew(false);
      // A career saved after the Warden fell but before the route was given away asks again.
      const story = model.state.world.story;
      if (flying && model.state.started && story.wardenDefeated && !story.finaleDone) n("finale");
    }, [s]),
    useEffect(() => {
      ((M.current = I), (P.current = E));
    }, [I, E]),
    useEffect(
      () => (
        (document.documentElement.style.fontSize = `${16 * O.settings.uiScale}px`),
        () => {
          document.documentElement.style.fontSize = "16px";
        }
      ),
      [O.settings.uiScale],
    ),
    useEffect(() => {
      const opened = shownScreen.current !== s;
      shownScreen.current = s;
      if (s === "flight") {
        window.setTimeout(() => canvas.focus({ preventScroll: true }), 0);
        return;
      }
      // Focus the first control of the screen that opened (keyboard, gamepad and
      // screen readers start there). Tab and the D-pad move on from it; see controls.js.
      // A tab change inside a screen keeps the focus where it is (on the tab, after LB/RB).
      let j = document.querySelector(".overlay-screen");
      if (!j) return;
      if (!opened && j.contains(document.activeElement)) return;
      let X = Array.from(
        j.querySelectorAll(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      window.setTimeout(() => X[0]?.focus({ preventScroll: true }), 0);
    }, [s, m, x]),
    useEffect(() => {
      s === "flight" &&
        (O.tutorialStep === 0 && a.speed > 1.2
          ? (O.tutorialStep = 1)
          : O.tutorialStep === 1 && O.weaponHeat > 2
            ? (O.tutorialStep = 2)
            : O.tutorialStep === 2 && a.target
              ? (O.tutorialStep = 3)
              : O.tutorialStep === 3 && a.stationDistance < 7.4 && (O.tutorialStep = 4));
    }, [s, O, a.speed, a.stationDistance, a.target]));
  let startNew = () => {
      // A new career starts at the station, not wherever the last career's ship was parked.
      (i.startNewGame(), flight.refreshShipVisual(!1), f(!0), setConfirmNew(false), n("flight"));
    },
    L = () => {
      // An in-game confirmation instead of window.confirm(), so a gamepad can answer it.
      d ? setConfirmNew(true) : startNew();
    },
    U = () => {
      i.continueGame() && (flight.refreshShipVisual(), S(i.state.currentSystem), n("flight"));
    },
    z = () => {
      n(s === "settings" || s === "guide" ? (E === "title" ? "title" : "paused") : "flight");
    },
    q = (j) => {
      (R(j), n("settings"));
    },
    ue = (j, V) => {
      ((O.settings[j] = V), i.changed());
      // Graphics quality and touch controls are the kit's device-wide settings.
      if (j === "graphicsQuality") kit.settings.set({ quality: V });
      if (j === "touchControls") kit.settings.set({ touch: V ? "on" : "auto" });
      // Let the new level be heard right away.
      if (j === "sfxVolume") sfx?.ui();
    },
    re = () => {
      let j = N.hull - O.hull,
        V = N.armor - O.armor,
        X = Math.max(0, 6 - O.missiles),
        H = O.propertyOperations.some((K) => K.id === "dock" && K.system === O.currentSystem) ? 0.65 : 1,
        ee = Math.ceil((j * 4 + V * 2.5 + X * 55) * H);
      if (!(ee <= 0)) {
        if (O.credits < ee) {
          i.notify("warn", "Repair estimate exceeds funds", `Need ${formatNumber(ee - O.credits)} more credits.`);
          return;
        }
        ((O.credits -= ee),
          (O.hull = N.hull),
          (O.armor = N.armor),
          (O.shield = N.shield),
          (O.missiles = Math.max(O.missiles, 6)),
          i.notify(
            "good",
            "Ship fully serviced",
            `${formatNumber(ee)} cr \xB7 hull, armor, shields, and ordnance restored`,
          ),
          i.changed());
      }
    },
    le = (j) => {
      flight.jumpTo(j) && (S(j), n("flight"));
    },
    ce = () => {
      (i.save(!0), sfx?.undock(), n("flight"));
    },
    oe = (j) => {
      let V = O.shipId;
      (i.buyShip(j), O.shipId !== V && flight.refreshShipVisual());
    };
  return jsxs("main", {
    className: `game-shell mode-${s}`,
    style: {
      "--ui-scale": O.settings.uiScale,
    },
    "data-reduced-motion": O.settings.reducedMotion ? "true" : "false",
    "data-high-contrast": O.settings.highContrast ? "true" : "false",
    "data-input": source,
    children: [
      jsx("div", {
        ref: mountCanvas,
        className: "game-canvas-host",
        "aria-hidden": s !== "flight",
      }),
      jsxs("div", {
        className: `css-space-scene ${a.ready && a.renderer !== "CPU" ? "is-hidden" : ""}`,
        "aria-hidden": "true",
        children: [
          jsx("div", {
            className: "css-nebula",
          }),
          jsx("div", {
            className: "css-orbit css-orbit--one",
          }),
          jsx("div", {
            className: "css-orbit css-orbit--two",
          }),
          jsxs("div", {
            className: "css-planet",
            children: [jsx("span", {}), jsx("i", {})],
          }),
          jsxs("div", {
            className: "css-station",
            children: [
              jsx("span", {
                className: "css-station__ring",
              }),
              jsx("span", {
                className: "css-station__hub",
              }),
              jsx("i", {}),
              jsx("b", {}),
            ],
          }),
          jsxs("div", {
            className: "css-ship css-ship--player",
            children: [jsx("span", {}), jsx("i", {}), jsx("b", {})],
          }),
          jsxs("div", {
            className: "css-ship css-ship--npc",
            children: [jsx("span", {}), jsx("i", {}), jsx("b", {})],
          }),
          jsx("div", {
            className: "css-asteroid css-asteroid--one",
          }),
          jsx("div", {
            className: "css-asteroid css-asteroid--two",
          }),
          jsx("div", {
            className: "css-asteroid css-asteroid--three",
          }),
          jsxs("div", {
            className: "css-lane",
            children: [jsx("span", {}), jsx("i", {}), jsx("b", {})],
          }),
        ],
      }),
      jsx("div", {
        className: "screen-shade",
      }),
      jsx("div", {
        className: "hit-flash",
        ref: flight.flashRef,
        "aria-hidden": "true",
      }),
      s === "flight" &&
        jsx(FlightHud, {
          state: O,
          view: a,
          source,
          radarRef: flight.radarRef,
          onSelectWeapon: (g) => flight.selectWeapon(g),
          onMap: () => {
            (C("flight"), n("map"));
          },
          onPause: () => n("paused"),
          onTarget: () => flight.targetNearest(),
          onScan: () => flight.scan(),
          onDock: () => flight.dockFromUi(),
        }),
      s === "flight" &&
        O.tutorialStep < 5 &&
        createPortal(
          jsx(TutorialCard, {
            step: O.tutorialStep,
            source,
            onSkip: () => {
              ((O.tutorialStep = 5), i.changed());
            },
          }),
          topLayer,
        ),
      s === "title" &&
        jsx(TitleScreen, {
          ready: a.ready,
          renderer: a.renderer,
          hasSave: d,
          source,
          confirmNew,
          onContinue: U,
          onNew: L,
          onConfirmNew: startNew,
          onCancelNew: () => setConfirmNew(false),
          onGuide: () => {
            (R("title"), n("guide"));
          },
          onSettings: () => q("title"),
        }),
      s === "docked" &&
        jsx(DockScreen, {
          model: i,
          tab: m,
          setTab: p,
          onUndock: ce,
          onMap: () => {
            (C("docked"), n("map"));
          },
          onRepair: re,
          onShipAction: oe,
          revision: l,
        }),
      s === "map" &&
        jsx(GalaxyMap, {
          state: O,
          source,
          selectedId: g,
          setSelectedId: S,
          onJump: le,
          onClose: () => n(I),
        }),
      s === "paused" &&
        jsx(PauseScreen, {
          state: O,
          source,
          onResume: () => n("flight"),
          onSave: () => {
            (i.save(), f(!0));
          },
          onMap: () => {
            (C("paused"), n("map"));
          },
          onSettings: () => q("paused"),
          onGuide: () => {
            (R("paused"), n("guide"));
          },
          onTitle: () => {
            (i.save(!0), f(!0), n("title"));
          },
        }),
      s === "settings" &&
        jsx(SettingsScreen, {
          settings: O.settings,
          kitSettings,
          onChange: ue,
          onClose: z,
          onDisplay: () => kit.menu.open(),
        }),
      s === "guide" &&
        jsx(FieldGuide, {
          page: x,
          source,
          setPage: v,
          onClose: z,
        }),
      s === "finale" &&
        jsx(FinaleScreen, {
          state: O,
          onChoose: (j) => {
            i.resolveStoryChoice(j) && (sfx?.chime(), n("flight"));
          },
        }),
      jsx("div", {
        className: "toast-stack",
        "aria-live": "polite",
        "aria-atomic": "false",
        children: u.map((j) =>
          jsxs(
            "article",
            {
              className: `toast toast--${j.tone}`,
              children: [
                jsx("span", {
                  className: "toast__pip",
                }),
                jsxs("div", {
                  children: [
                    jsx("strong", {
                      children: j.title,
                    }),
                    j.body &&
                      jsx("p", {
                        children: j.body,
                      }),
                  ],
                }),
              ],
            },
            j.id,
          ),
        ),
      }),
    ],
  });
}
function TitleScreen({
  ready: r,
  renderer: e,
  hasSave: t,
  source,
  confirmNew,
  onContinue: i,
  onNew: s,
  onConfirmNew,
  onCancelNew,
  onGuide: n,
  onSettings: a,
}) {
  const confirmRef = useRef(null);
  useEffect(() => {
    // The confirmation takes focus, so Enter, A or a tap answers it.
    if (confirmNew) confirmRef.current?.focus({ preventScroll: true });
  }, [confirmNew]);
  return jsxs("section", {
    className: "title-screen overlay-screen",
    "aria-labelledby": "game-title",
    children: [
      jsxs("div", {
        className: "title-topline",
        children: [
          jsxs("span", {
            className: "eyebrow",
            children: [
              jsx("span", {
                className: `status-dot ${r ? "is-ready" : ""}`,
              }),
              " ",
              r ? `${e === "CPU" ? "ACCESSIBLE" : e} FLIGHT CORE ONLINE` : "SPINNING UP FLIGHT CORE",
            ],
          }),
          jsx("span", {
            className: "title-version",
            children: "BUILD NF.02 \xB7 LIVING FRONTIER",
          }),
        ],
      }),
      jsxs("div", {
        className: "title-lockup",
        children: [
          jsx("p", {
            className: "title-kicker",
            children: "A LIVING FRONTIER. A SHIP THAT'S YOURS.",
          }),
          jsxs("h1", {
            id: "game-title",
            children: [
              jsx("span", {
                children: "VOID",
              }),
              "RUNNER",
            ],
          }),
          jsxs("div", {
            className: "title-subtitle",
            children: [jsx("span", {}), " NEON FRONTIER ", jsx("span", {})],
          }),
          jsx("p", {
            className: "title-copy",
            children: "Trade the shortage. Hunt the raider. Become the reason prices changed.",
          }),
          jsxs("div", {
            className: "title-actions",
            children: [
              t &&
                jsxs("button", {
                  className: "button button--primary button--large",
                  onClick: i,
                  children: [
                    jsx(Icon, {
                      name: "play",
                    }),
                    " Continue career ",
                    jsxs("span", {
                      className: "button__trail",
                      children: [
                        "AUTO SAVE ",
                        jsx(Icon, {
                          name: "arrow",
                        }),
                      ],
                    }),
                  ],
                }),
              confirmNew
                ? jsxs("div", {
                    className: "title-confirm",
                    role: "alertdialog",
                    "aria-label": "Start a new career",
                    children: [
                      jsx("p", {
                        children: "Start a new career? Your current autosave will be replaced.",
                      }),
                      jsxs("div", {
                        children: [
                          jsxs("button", {
                            className: "button button--primary",
                            ref: confirmRef,
                            onClick: onConfirmNew,
                            children: [
                              jsx(Icon, {
                                name: "ship",
                              }),
                              " Start new career",
                            ],
                          }),
                          jsx("button", {
                            className: "button button--ghost",
                            onClick: onCancelNew,
                            children: "Keep my career",
                          }),
                        ],
                      }),
                    ],
                  })
                : jsxs("button", {
                    className: `button ${t ? "button--ghost" : "button--primary"} button--large`,
                    onClick: s,
                    children: [
                      jsx(Icon, {
                        name: "ship",
                      }),
                      " New career ",
                      jsxs("span", {
                        className: "button__trail",
                        children: [
                          "KITE MK II ",
                          jsx(Icon, {
                            name: "arrow",
                          }),
                        ],
                      }),
                    ],
                  }),
              jsxs("div", {
                className: "title-secondary-actions",
                children: [
                  jsx("button", {
                    className: "text-button",
                    onClick: n,
                    children: "Field guide",
                  }),
                  jsx("span", {
                    children: "\u2022",
                  }),
                  jsx("button", {
                    className: "text-button",
                    onClick: a,
                    children: "Settings",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      jsxs("div", {
        className: "title-stats",
        children: [
          jsxs("div", {
            children: [
              jsx("strong", {
                children: "15",
              }),
              jsx("span", {
                children: "STAR SYSTEMS",
              }),
            ],
          }),
          jsxs("div", {
            children: [
              jsx("strong", {
                children: "06",
              }),
              jsx("span", {
                children: "COMPETING FACTIONS",
              }),
            ],
          }),
          jsxs("div", {
            children: [
              jsx("strong", {
                children: "10",
              }),
              jsx("span", {
                children: "CAPTURABLE HULLS",
              }),
            ],
          }),
        ],
      }),
      jsxs("div", {
        className: "title-tip",
        children: [
          jsx(Key, {
            source,
            action: "move",
          }),
          " MOVE ",
          jsx(Key, {
            source,
            action: "aim",
            className: source === "keyboard" ? "keycap mouse" : "keycap",
          }),
          " AIM & FIRE ",
          jsx(Key, {
            source,
            action: "map",
          }),
          " GALAXY",
        ],
      }),
    ],
  });
}
function FlightHud({ state: r, view: e, source, radarRef, onSelectWeapon, onMap: t, onPause: i, onTarget: s, onScan: n, onDock: a }) {
  let o = shipStats(r),
    l = systemById(r.currentSystem),
    c = systemOwner(r.world, r.currentSystem),
    u = r.jurisdictionHeat[r.currentSystem] ?? 0,
    h = r.jurisdictionBounty[r.currentSystem] ?? 0,
    d = r.acceptedMissions[0],
    m = r.weaponLoadouts[r.shipId] ?? [shipById(r.shipId).weapon];
  return jsxs("div", {
    className: "hud",
    "aria-label": "Flight heads-up display",
    children: [
      jsxs("header", {
        className: "hud-top",
        children: [
          jsxs("section", {
            className: "hud-vitals glass-panel",
            "aria-label": "Ship status",
            children: [
              jsxs("div", {
                className: "ship-badge",
                children: [
                  jsx("span", {
                    className: "ship-mark",
                    children: "VR",
                  }),
                  jsxs("div", {
                    children: [
                      jsx("strong", {
                        children: shipById(r.shipId).name,
                      }),
                      jsx("span", {
                        children: shipById(r.shipId).className.toUpperCase(),
                      }),
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                className: "vital-row",
                children: [
                  jsx(Icon, {
                    name: "shield",
                  }),
                  jsx("span", {
                    children: "SHIELD",
                  }),
                  jsx(Meter, {
                    value: r.shield,
                    max: o.shield,
                    color: "#58e8ff",
                    label: "Shield",
                  }),
                ],
              }),
              jsxs("div", {
                className: "vital-row",
                children: [
                  jsx(Icon, {
                    name: "shield",
                  }),
                  jsx("span", {
                    children: "ARMOR",
                  }),
                  jsx(Meter, {
                    value: r.armor,
                    max: o.armor,
                    color: "#ffd477",
                    label: "Armor",
                  }),
                ],
              }),
              jsxs("div", {
                className: "vital-row",
                children: [
                  jsx(Icon, {
                    name: "hull",
                  }),
                  jsx("span", {
                    children: "HULL",
                  }),
                  jsx(Meter, {
                    value: r.hull,
                    max: o.hull,
                    color: "#78f2b8",
                    label: "Hull",
                  }),
                ],
              }),
              jsxs("div", {
                className: "vital-row compact",
                children: [
                  jsx(Icon, {
                    name: "energy",
                  }),
                  jsx("span", {
                    children: "ENERGY",
                  }),
                  jsx(Meter, {
                    value: r.energy,
                    max: o.energy,
                    color: "#ffd35a",
                    label: "Energy",
                  }),
                ],
              }),
            ],
          }),
          jsxs("section", {
            className: "location-chip glass-panel",
            children: [
              jsxs("span", {
                className: "eyebrow",
                children: [
                  FACTIONS[c].short,
                  " CONTROL \xB7 SECURITY ",
                  Math.round(systemSecurity(r.world, l.id) * 5),
                  "/5",
                ],
              }),
              jsx("strong", {
                children: l.name,
              }),
              jsx("span", {
                children: l.subtitle,
              }),
              jsxs("button", {
                onClick: t,
                "aria-label": "Open galaxy map",
                children: [
                  jsx(Icon, {
                    name: "map",
                  }),
                  " GALAXY ",
                  jsx(Key, {
                    source,
                    action: "map",
                  }),
                ],
              }),
            ],
          }),
          jsxs("section", {
            className: "hud-resources glass-panel",
            children: [
              jsxs("div", {
                children: [
                  jsx(Icon, {
                    name: "credits",
                  }),
                  jsxs("span", {
                    children: [
                      jsx("strong", {
                        children: formatNumber(r.credits),
                      }),
                      jsx("small", {
                        children: "CREDITS",
                      }),
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx(Icon, {
                    name: "cargo",
                  }),
                  jsxs("span", {
                    children: [
                      jsxs("strong", {
                        children: [cargoMass(r), "/", cargoCapacity(r)],
                      }),
                      jsx("small", {
                        children: "CARGO",
                      }),
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                className: u >= 20 ? "is-danger" : "",
                children: [
                  jsx(Icon, {
                    name: "warning",
                  }),
                  jsxs("span", {
                    children: [
                      jsx("strong", {
                        children: heatLabel(u),
                      }),
                      jsx("small", {
                        children: u > 0 ? `${formatNumber(h)} CR \xB7 TIER ${heatTier(u)}` : "LEGAL",
                      }),
                    ],
                  }),
                ],
              }),
              jsx("button", {
                className: "icon-button",
                onClick: i,
                "aria-label": "Pause game",
                children: jsx(Icon, {
                  name: "settings",
                }),
              }),
            ],
          }),
        ],
      }),
      e.target &&
        jsxs("section", {
          className: "target-card glass-panel",
          "aria-label": "Locked target",
          children: [
            jsx("div", {
              className: "target-bracket",
              children: jsx(Icon, {
                name: "target",
              }),
            }),
            jsxs("div", {
              className: "target-main",
              children: [
                jsx("span", {
                  className: `tag tag--${e.target.relation === "HOSTILE" ? "danger" : "neutral"}`,
                  children: e.target.relation,
                }),
                jsx("strong", {
                  children: e.target.name,
                }),
                jsxs("span", {
                  children: [e.target.faction, " \xB7 ", e.target.role.toUpperCase()],
                }),
              ],
            }),
            jsxs("div", {
              className: "target-bars",
              children: [
                jsxs("div", {
                  children: [
                    jsx("span", {
                      children: "SHD",
                    }),
                    jsx(Meter, {
                      value: e.target.shield,
                      max: e.target.maxShield,
                      color: "#58e8ff",
                      label: "Target shield",
                    }),
                  ],
                }),
                jsxs("div", {
                  children: [
                    jsx("span", {
                      children: "ARM",
                    }),
                    jsx(Meter, {
                      value: e.target.armor,
                      max: e.target.maxArmor,
                      color: "#ffd477",
                      label: "Target armor",
                    }),
                  ],
                }),
                jsxs("div", {
                  children: [
                    jsx("span", {
                      children: "HUL",
                    }),
                    jsx(Meter, {
                      value: e.target.hull,
                      max: e.target.maxHull,
                      color: "#ff758d",
                      label: "Target hull",
                    }),
                  ],
                }),
              ],
            }),
            jsxs("div", {
              className: "target-meta",
              children: [
                jsxs("strong", {
                  children: [e.target.distance.toFixed(1), " km \xB7 THREAT ", e.target.threat],
                }),
                jsx("span", {
                  children: e.target.disabled
                    ? "DRIVE DISABLED \xB7 BOARDABLE"
                    : e.target.bounty
                      ? `${formatNumber(e.target.bounty)} CR BOUNTY`
                      : "NO ACTIVE BOUNTY",
                }),
              ],
            }),
            jsxs("button", {
              className: "scan-button",
              onClick: n,
              children: [
                jsx(Icon, {
                  name: "scan",
                }),
                " SCAN ",
                jsx(Key, {
                  source,
                  action: "scan",
                }),
              ],
            }),
          ],
        }),
      jsxs("aside", {
        className: "objective-panel glass-panel",
        children: [
          jsxs("div", {
            className: "panel-label",
            children: [
              jsx("span", {
                className: "signal-pulse",
              }),
              " LIVE NETWORK",
            ],
          }),
          jsx("p", {
            children: e.eventLabel,
          }),
          d
            ? jsxs("div", {
                className: "objective-card",
                children: [
                  jsxs("span", {
                    className: "eyebrow",
                    children: ["TRACKED \xB7 ", d.type.toUpperCase()],
                  }),
                  jsx("strong", {
                    children: d.title,
                  }),
                  jsxs("span", {
                    children: [systemById(d.targetSystem).name, " \xB7 ", d.progress, "/", d.amount],
                  }),
                  jsx("div", {
                    className: "objective-progress",
                    children: jsx("span", {
                      style: {
                        width: `${(d.progress / d.amount) * 100}%`,
                      },
                    }),
                  }),
                ],
              })
            : jsxs("div", {
                className: "objective-card objective-card--free",
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "NO CONTRACT TRACKED",
                  }),
                  jsx("strong", {
                    children: "Make your own opportunity",
                  }),
                  jsx("span", {
                    children: "Dock for work, mine a field, or follow the trouble.",
                  }),
                ],
              }),
        ],
      }),
      jsxs("aside", {
        className: "radar glass-panel",
        "aria-label": "Tactical radar",
        children: [
          jsxs("div", {
            className: "radar-ring",
            children: [
              // Drawn by the flight controller: station, contacts, salvage, anomalies.
              jsx("canvas", {
                className: "radar-canvas",
                width: 204,
                height: 204,
                ref: radarRef,
              }),
              jsx("span", {
                className: "radar-sweep",
              }),
              jsx("span", {
                className: "radar-player",
              }),
            ],
          }),
          jsxs("div", {
            children: [
              jsx("strong", {
                children: "LOCAL GRID",
              }),
              jsxs("span", {
                children: [e.coordinates[0], " : ", e.coordinates[1]],
              }),
            ],
          }),
        ],
      }),
      jsxs("section", {
        className: "weapon-rack glass-panel",
        children: [
          m.map((p, g) =>
            jsxs(
              "button",
              {
                className: `weapon-slot ${g === r.activeWeaponIndex ? "is-active" : ""}`,
                onClick: () => onSelectWeapon(g),
                "aria-pressed": g === r.activeWeaponIndex,
                children: [
                  jsx("span", {
                    className: "slot-key",
                    children: g + 1,
                  }),
                  jsxs("div", {
                    children: [
                      jsx("strong", {
                        children: WEAPONS[p].name,
                      }),
                      jsxs("span", {
                        children: [
                          Math.round(WEAPONS[p].damage * (1 + r.upgrades.weapon * 0.1)),
                          " DMG \xB7 ",
                          WEAPONS[p].range,
                          " RANGE",
                        ],
                      }),
                    ],
                  }),
                  jsx(Icon, {
                    name: "target",
                  }),
                ],
              },
              `${p}-${g}`,
            ),
          ),
          jsxs("div", {
            className: "weapon-slot",
            children: [
              jsx(Key, {
                source,
                action: "missile",
                className: "slot-key",
              }),
              jsxs("div", {
                children: [
                  jsxs("strong", {
                    children: ["Starbreaker \xD7", r.missiles],
                  }),
                  jsx("span", {
                    children: "HOMING \xB7 ENERGY 24",
                  }),
                ],
              }),
              jsx(Icon, {
                name: "missile",
              }),
            ],
          }),
          jsxs("div", {
            className: `heat-gauge ${r.weaponHeat > 75 ? "is-hot" : ""}`,
            children: [
              jsx(Icon, {
                name: "heat",
              }),
              jsxs("div", {
                children: [
                  jsx("span", {
                    children: "WEAPON HEAT",
                  }),
                  jsx("div", {
                    children: jsx("i", {
                      style: {
                        width: `${r.weaponHeat}%`,
                      },
                    }),
                  }),
                ],
              }),
              jsxs("strong", {
                children: [Math.round(r.weaponHeat), "%"],
              }),
            ],
          }),
        ],
      }),
      jsxs("div", {
        className: "flight-help",
        children: [
          jsxs("span", {
            children: [
              jsx(Key, {
                source,
                action: "move",
                className: "keycap",
              }),
              " STRAFE",
            ],
          }),
          jsxs("span", {
            children: [
              jsx(Key, {
                source,
                action: "boost",
                className: "keycap wide",
              }),
              " BOOST",
            ],
          }),
          jsxs("span", {
            children: [
              jsx(Key, {
                source,
                action: "repair",
                className: "keycap",
              }),
              " REPAIR",
            ],
          }),
          jsxs("span", {
            children: [
              jsx(Key, {
                source,
                action: "ecm",
                className: "keycap",
              }),
              " ECM",
            ],
          }),
          jsxs("button", {
            onClick: s,
            children: [
              jsx(Key, {
                source,
                action: "target",
                className: "keycap",
              }),
              " TARGET",
            ],
          }),
        ],
      }),
      e.prompt &&
        jsxs("button", {
          className: "interaction-prompt",
          onClick: a,
          children: [
            jsx("span", {
              className: "interaction-prompt__key",
              children:
                e.promptKey === "E / R" ? `${hint(source, "interact")} / ${hint(source, "scan")}` : hint(source, "interact"),
            }),
            jsxs("span", {
              children: [
                jsx("small", {
                  children: e.nearbyLabel,
                }),
                jsx("strong", {
                  children: e.prompt,
                }),
              ],
            }),
            jsx(Icon, {
              name: "arrow",
            }),
          ],
        }),
      // After an insurance recovery the alert line says you are shielded for a moment.
      e.grace
        ? jsxs("div", {
            className: "combat-alert is-grace",
            children: [jsx("span", {}), " RECOVERY FIELD \xB7 SHIELDED"],
          })
        : e.enemies > 0 &&
          jsxs("div", {
            className: "combat-alert",
            children: [jsx("span", {}), " COMBAT ENGAGED \xB7 ", e.enemies, " HOSTILE", e.enemies === 1 ? "" : "S"],
          }),
      e.boss &&
        jsxs("section", {
          className: "boss-bar glass-panel",
          "aria-label": `${e.boss.name} status`,
          children: [
            jsxs("div", {
              className: "boss-bar__head",
              children: [
                jsx("strong", {
                  children: e.boss.name,
                }),
                jsx("span", {
                  children: e.boss.phase === 3 ? "CORE EXPOSED" : e.boss.phase === 2 ? "LATTICE FRACTURING" : "SHIELD LATTICE",
                }),
              ],
            }),
            jsxs("div", {
              className: "boss-bar__track",
              children: [
                jsx("i", {
                  className: "boss-bar__hull",
                  style: {
                    width: `${clampPercent((e.boss.hull / Math.max(1, e.boss.maxHull)) * 100)}%`,
                  },
                }),
                e.boss.maxShield > 0 &&
                  jsx("i", {
                    className: "boss-bar__shield",
                    style: {
                      width: `${clampPercent((e.boss.shield / Math.max(1, e.boss.maxShield)) * 100)}%`,
                    },
                  }),
              ],
            }),
          ],
        }),
    ],
  });
}
function TutorialCard({ step: r, source, onSkip: e }) {
  let t = [
      {
        key: "01",
        title: "Move on the plane",
        body: jsxs(Fragment, {
          children: [
            "Use ",
            jsx(Key, {
              source,
              action: "move",
            }),
            " to strafe in any direction. Your ship keeps a little momentum.",
          ],
        }),
      },
      {
        key: "02",
        title: "Aim independently",
        body:
          source === "touch"
            ? jsxs(Fragment, {
                children: [
                  "Push the ",
                  jsx(Key, {
                    source,
                    action: "aim",
                  }),
                  " past halfway to aim and fire while moving another way.",
                ],
              })
            : source === "gamepad"
              ? jsxs(Fragment, {
                  children: [
                    "Aim with ",
                    jsx(Key, {
                      source,
                      action: "aim",
                    }),
                    " and hold ",
                    jsx(Key, {
                      source,
                      action: "fire",
                    }),
                    " to fire while moving another way.",
                  ],
                })
              : jsxs(Fragment, {
                  children: [
                    "Aim with the pointer and hold ",
                    jsx("span", {
                      className: "keycap mouse",
                      children: "LMB",
                    }),
                    " to fire while moving another way.",
                  ],
                }),
      },
      {
        key: "03",
        title: "Read the traffic",
        body: jsxs(Fragment, {
          children: [
            "Press ",
            jsx(Key, {
              source,
              action: "target",
            }),
            " to lock the nearest contact. Neutral ships can still be attacked\u2014with consequences.",
          ],
        }),
      },
      {
        key: "04",
        title: "Dock for opportunities",
        body: jsxs(Fragment, {
          children: [
            "Approach ",
            jsx("strong", {
              children: systemById("meridian").landmarks[0],
            }),
            ". Slow below 8 and press ",
            jsx(Key, {
              source,
              action: "interact",
            }),
            ".",
          ],
        }),
      },
      {
        key: "05",
        title: "Open the frontier",
        body: jsx(Fragment, {
          children: "Dock now, or ignore the plan. Trade, mine, hunt, steal, or simply follow the next distress call.",
        }),
      },
    ],
    i = t[Math.min(r, t.length - 1)];
  return jsxs("aside", {
    className: "tutorial-card glass-panel",
    children: [
      jsx("div", {
        className: "tutorial-index",
        children: i.key,
      }),
      jsxs("div", {
        children: [
          jsx("span", {
            className: "eyebrow",
            children: "FLIGHT CERTIFICATION",
          }),
          jsx("strong", {
            children: i.title,
          }),
          jsx("p", {
            children: i.body,
          }),
        ],
      }),
      jsx("button", {
        onClick: e,
        children: "SKIP TOUR",
      }),
    ],
  });
}
function DockScreen({ model: r, tab: e, setTab: t, onUndock: i, onMap: s, onRepair: n, onShipAction: a }) {
  let o = r.state,
    l = systemById(o.currentSystem),
    c = systemOwner(o.world, o.currentSystem),
    u = shipStats(o),
    h = o.jurisdictionHeat[o.currentSystem] ?? 0,
    d = l.stations[0]?.services ?? [],
    f = [
      {
        id: "hub",
        label: "Station hub",
        icon: "station",
      },
      {
        id: "market",
        label: "Market",
        icon: "cargo",
      },
      {
        id: "contracts",
        label: "Contracts",
        icon: "contract",
      },
      {
        id: "shipyard",
        label: "Shipyard",
        icon: "ship",
      },
      {
        id: "equipment",
        label: "Loadout",
        icon: "target",
      },
      {
        id: "crew",
        label: "Crew",
        icon: "people",
      },
      {
        id: "contacts",
        label: "Contacts",
        icon: "scan",
      },
      {
        id: "enterprise",
        label: "Enterprise",
        icon: "business",
      },
    ],
    m = (p) =>
      p === "hub" ||
      p === "enterprise" ||
      (p === "market" && (d.includes("market") || d.includes("blackMarket"))) ||
      (p === "contracts" && d.includes("contracts")) ||
      (p === "shipyard" && d.includes("shipyard")) ||
      (p === "equipment" && d.includes("equipment")) ||
      (p === "crew" && d.includes("crew")) ||
      (p === "contacts" && (d.includes("intel") || CONTACTS.some((g) => g.system === l.id)));
  return jsxs("section", {
    className: "dock-screen overlay-screen",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": `${l.landmarks[0]} station interface`,
    children: [
      jsxs("header", {
        className: "dock-header",
        children: [
          jsxs("div", {
            className: "station-identity",
            children: [
              jsx("span", {
                className: "station-glyph",
                children: jsx(Icon, {
                  name: "station",
                }),
              }),
              jsxs("div", {
                children: [
                  jsxs("span", {
                    className: "eyebrow",
                    children: ["DOCKED \xB7 ", FACTIONS[c].name.toUpperCase()],
                  }),
                  jsx("h2", {
                    children: l.landmarks[0],
                  }),
                  jsxs("p", {
                    children: [l.government, " \xB7 ", l.economy, " \xB7 ", l.landmarks.slice(1).join(" \xB7 ")],
                  }),
                ],
              }),
            ],
          }),
          jsxs("div", {
            className: "dock-balance",
            children: [
              jsxs("span", {
                children: [
                  jsx(Icon, {
                    name: "credits",
                  }),
                  jsx("strong", {
                    children: formatNumber(o.credits),
                  }),
                  jsx("small", {
                    children: "CREDITS",
                  }),
                ],
              }),
              jsxs("span", {
                children: [
                  jsx(Icon, {
                    name: "cargo",
                  }),
                  jsxs("strong", {
                    children: [cargoMass(o), "/", cargoCapacity(o)],
                  }),
                  jsx("small", {
                    children: "CARGO",
                  }),
                ],
              }),
            ],
          }),
          jsxs("button", {
            className: "button button--primary",
            onClick: i,
            children: [
              jsx(Icon, {
                name: "play",
              }),
              " Undock",
            ],
          }),
        ],
      }),
      jsxs("nav", {
        className: "dock-nav",
        "aria-label": "Station services",
        children: [
          f.map((p) =>
            jsxs(
              "button",
              {
                className: e === p.id ? "is-active" : "",
                "aria-selected": e === p.id,
                disabled: !m(p.id),
                title: m(p.id) ? p.label : `${p.label} unavailable at this station`,
                onClick: () => t(p.id),
                children: [
                  jsx(Icon, {
                    name: p.icon,
                  }),
                  p.label,
                  jsx("span", {}),
                ],
              },
              p.id,
            ),
          ),
          jsxs("button", {
            onClick: s,
            children: [
              jsx(Icon, {
                name: "map",
              }),
              " Galaxy map",
            ],
          }),
        ],
      }),
      jsxs("div", {
        className: "dock-content",
        children: [
          e === "hub" &&
            jsx(HubTab, {
              model: r,
              onRepair: n,
              setTab: t,
            }),
          e === "market" &&
            jsx(MarketTab, {
              model: r,
            }),
          e === "contracts" &&
            jsx(ContractsTab, {
              model: r,
            }),
          e === "shipyard" &&
            jsx(ShipyardTab, {
              model: r,
              onShipAction: a,
            }),
          e === "equipment" &&
            jsx(LoadoutTab, {
              model: r,
            }),
          e === "crew" &&
            jsx(CrewTab, {
              model: r,
            }),
          e === "contacts" &&
            jsx(ContactsTab, {
              model: r,
            }),
          e === "enterprise" &&
            jsx(EnterpriseTab, {
              model: r,
            }),
        ],
      }),
      jsxs("footer", {
        className: "dock-footer",
        children: [
          jsxs("span", {
            children: [
              "LOCAL TIME ",
              String(Math.floor(o.playSeconds / 60)).padStart(2, "0"),
              ":",
              String(Math.floor(o.playSeconds % 60)).padStart(2, "0"),
            ],
          }),
          jsxs("span", {
            children: ["MARKET CYCLE ", o.marketTick],
          }),
          jsxs("span", {
            children: [
              "SHIP: ",
              shipById(o.shipId).name.toUpperCase(),
              " \xB7 HULL ",
              Math.round(o.hull),
              "/",
              Math.round(u.hull),
            ],
          }),
          jsx("span", {
            className: h > 0 ? "danger-text" : "",
            children: h > 0 ? `${heatLabel(h)} \xB7 ${Math.ceil(h)} HEAT` : "LEGAL STATUS: CLEAR",
          }),
        ],
      }),
    ],
  });
}
function HubTab({ model: r, onRepair: e, setTab: t }) {
  let i = r.state,
    s = systemById(i.currentSystem),
    n = systemOwner(i.world, i.currentSystem),
    a = shipStats(i),
    o = i.jurisdictionHeat[i.currentSystem] ?? 0,
    l = i.jurisdictionBounty[i.currentSystem] ?? 0,
    c = s.stations[0]?.services ?? [],
    u = i.propertyOperations.some((f) => f.id === "dock" && f.system === i.currentSystem) ? 0.65 : 1,
    h = Math.ceil(((a.hull - i.hull) * 4 + (a.armor - i.armor) * 2.5 + Math.max(0, 6 - i.missiles) * 55) * u),
    d = CONTACTS.filter((f) => f.system === i.currentSystem);
  return jsxs("div", {
    className: "hub-layout",
    children: [
      jsxs("section", {
        className: "hub-hero",
        children: [
          jsxs("span", {
            className: "eyebrow",
            children: ["WELCOME TO ", s.name.toUpperCase()],
          }),
          jsx("h3", {
            children: s.subtitle,
          }),
          jsxs("p", {
            children: [s.mechanicalIdentity, " ", FACTIONS[n].description, " ", FACTIONS[n].law],
          }),
          jsxs("div", {
            className: "hub-actions",
            children: [
              jsxs("button", {
                className: "service-card",
                disabled: !c.includes("contracts"),
                onClick: () => t("contracts"),
                children: [
                  jsx("span", {
                    className: "service-card__icon",
                    children: jsx(Icon, {
                      name: "contract",
                    }),
                  }),
                  jsxs("div", {
                    children: [
                      jsx("span", {
                        className: "eyebrow",
                        children: "LIVE BOARD",
                      }),
                      jsx("strong", {
                        children: c.includes("contracts")
                          ? `${
                              missionBoard({
                                ...i,
                              }).length
                            } contracts available`
                          : "No public contract terminal",
                      }),
                      jsx("p", {
                        children: "Trade, combat, exploration, and work that asks fewer questions.",
                      }),
                    ],
                  }),
                  jsx(Icon, {
                    name: "arrow",
                  }),
                ],
              }),
              jsxs("button", {
                className: "service-card",
                disabled: !c.includes("market") && !c.includes("blackMarket"),
                onClick: () => t("market"),
                children: [
                  jsx("span", {
                    className: "service-card__icon amber",
                    children: jsx(Icon, {
                      name: "cargo",
                    }),
                  }),
                  jsxs("div", {
                    children: [
                      jsx("span", {
                        className: "eyebrow",
                        children: "MARKET MOVED",
                      }),
                      jsx("strong", {
                        children:
                          c.includes("market") || c.includes("blackMarket")
                            ? "Fresh margins this cycle"
                            : "No commodity exchange",
                      }),
                      jsx("p", {
                        children: "Compare local prices and move cargo without a spreadsheet.",
                      }),
                    ],
                  }),
                  jsx(Icon, {
                    name: "arrow",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      jsxs("aside", {
        className: "station-services",
        children: [
          jsx("div", {
            className: "section-heading",
            children: jsxs("div", {
              children: [
                jsx("span", {
                  className: "eyebrow",
                  children: "FLIGHT SERVICES",
                }),
                jsx("h3", {
                  children: "Turnaround",
                }),
              ],
            }),
          }),
          jsxs("article", {
            className: "service-line",
            children: [
              jsxs("div", {
                children: [
                  jsx(Icon, {
                    name: "hull",
                  }),
                  jsxs("span", {
                    children: [
                      jsx("strong", {
                        children: "Hull & shield service",
                      }),
                      jsx("small", {
                        children: c.includes("repair")
                          ? h > 0
                            ? `${formatNumber(h)} cr estimate`
                            : "No damage detected"
                          : "No repair berth at this station",
                      }),
                    ],
                  }),
                ],
              }),
              jsx("button", {
                disabled: h <= 0 || !c.includes("repair"),
                onClick: e,
                children: c.includes("repair") ? (h > 0 ? "Repair all" : "Ready") : "Unavailable",
              }),
            ],
          }),
          jsxs("article", {
            className: `service-line ${o > 0 ? "is-wanted" : ""}`,
            children: [
              jsxs("div", {
                children: [
                  jsx(Icon, {
                    name: "warning",
                  }),
                  jsxs("span", {
                    children: [
                      jsx("strong", {
                        children: "Jurisdiction account",
                      }),
                      jsx("small", {
                        children: c.includes("legal")
                          ? o > 0
                            ? `${heatLabel(o)} \xB7 ${formatNumber(l)} cr warrant`
                            : "No active violations"
                          : "No lawful registry terminal",
                      }),
                    ],
                  }),
                ],
              }),
              jsx("button", {
                disabled: o <= 0 || !c.includes("legal"),
                onClick: () => r.payFine(),
                children: c.includes("legal") ? (o > 0 ? "Settle account" : "Clear") : "Unavailable",
              }),
            ],
          }),
          o > 0 &&
            jsxs("div", {
              className: "legal-actions",
              children: [
                jsx("button", {
                  onClick: () => r.bribeOfficials(),
                  children: "BRIBE INTERMEDIARY",
                }),
                jsx("button", {
                  onClick: () => r.forgeIdentity(),
                  children: "FORGE SHIP ID",
                }),
                jsx("button", {
                  onClick: () => r.hackRecords(),
                  children: "HACK RECORDS",
                }),
              ],
            }),
          d.length > 0
            ? d.map((f) =>
                jsxs(
                  "button",
                  {
                    className: "contact-card",
                    onClick: () => t("contacts"),
                    children: [
                      jsx("div", {
                        className: "contact-avatar",
                        children: f.name
                          .split(" ")
                          .map((m) => m[0])
                          .join(""),
                      }),
                      jsxs("div", {
                        children: [
                          jsx("span", {
                            className: "eyebrow",
                            children: "LOCAL CONTACT",
                          }),
                          jsxs("strong", {
                            children: [f.name, " \xB7 ", f.role],
                          }),
                          jsxs("p", {
                            children: ["\u201C", f.greeting, "\u201D"],
                          }),
                        ],
                      }),
                    ],
                  },
                  f.id,
                ),
              )
            : jsxs("article", {
                className: "contact-card",
                children: [
                  jsx("div", {
                    className: "contact-avatar",
                    children: "?",
                  }),
                  jsxs("div", {
                    children: [
                      jsx("span", {
                        className: "eyebrow",
                        children: "NO ESTABLISHED CONTACT",
                      }),
                      jsx("strong", {
                        children: "The local bar network is quiet",
                      }),
                      jsx("p", {
                        children: "Follow contracts and faction intelligence to find recurring contacts.",
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
function MarketTab({ model: r }) {
  let e = r.state,
    t = marketQuotes(e),
    [i, s] = useState("medicine"),
    n = commodityById(i),
    a = t.find((u) => u.id === i),
    o = bestKnownSale(e, i),
    l = Math.max(1, Math.max(...a.history) - Math.min(...a.history)),
    c = a.history
      .map((u, h) => `${(h / Math.max(1, a.history.length - 1)) * 100},${34 - ((u - Math.min(...a.history)) / l) * 30}`)
      .join(" ");
  return jsxs("div", {
    className: "market-layout",
    children: [
      jsxs("section", {
        className: "market-table-wrap",
        children: [
          jsxs("div", {
            className: "section-heading",
            children: [
              jsxs("div", {
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "REGIONAL COMMODITY EXCHANGE",
                  }),
                  jsx("h3", {
                    children: "Live market",
                  }),
                ],
              }),
              jsxs("div", {
                className: "market-legend",
                children: [
                  jsx("span", {
                    className: "good-text",
                    children: "\u25B2 DEMAND",
                  }),
                  jsx("span", {
                    className: "danger-text",
                    children: "RESTRICTED",
                  }),
                ],
              }),
            ],
          }),
          jsxs("div", {
            className: "market-table",
            role: "table",
            "aria-label": "Commodity market",
            children: [
              jsxs("div", {
                className: "market-row market-row--head",
                role: "row",
                children: [
                  jsx("span", {
                    children: "COMMODITY",
                  }),
                  jsx("span", {
                    children: "STOCK",
                  }),
                  jsx("span", {
                    children: "TREND",
                  }),
                  jsx("span", {
                    children: "BUY",
                  }),
                  jsx("span", {
                    children: "SELL",
                  }),
                  jsx("span", {
                    children: "HOLD",
                  }),
                ],
              }),
              t.map((u) => {
                let h = commodityById(u.id);
                return jsxs(
                  "button",
                  {
                    role: "row",
                    className: `market-row ${i === u.id ? "is-selected" : ""}`,
                    onClick: () => s(u.id),
                    children: [
                      jsxs("span", {
                        className: "commodity-name",
                        children: [
                          jsx("i", {
                            className: u.illegal ? "illegal" : "",
                            children: h.icon,
                          }),
                          jsxs("span", {
                            children: [
                              jsx("strong", {
                                children: h.name,
                              }),
                              jsx("small", {
                                children: u.illegal ? "RESTRICTED HERE" : h.description,
                              }),
                            ],
                          }),
                        ],
                      }),
                      jsx("span", {
                        children: u.stock,
                      }),
                      jsxs("span", {
                        className: u.trend > 0 ? "good-text" : "danger-text",
                        children: [u.trend > 0 ? "\u25B2" : "\u25BC", " ", Math.abs(u.trend), "%"],
                      }),
                      jsx("strong", {
                        children: u.buy,
                      }),
                      jsx("strong", {
                        children: u.sell,
                      }),
                      jsx("span", {
                        children: u.owned,
                      }),
                    ],
                  },
                  u.id,
                );
              }),
            ],
          }),
        ],
      }),
      jsxs("aside", {
        className: "trade-ticket",
        children: [
          jsx("div", {
            className: `commodity-monogram ${a.illegal ? "is-illegal" : ""}`,
            children: n.icon,
          }),
          jsx("span", {
            className: "eyebrow",
            children: "SELECTED COMMODITY",
          }),
          jsx("h3", {
            children: n.name,
          }),
          jsx("p", {
            children: n.description,
          }),
          a.illegal &&
            jsxs("div", {
              className: "legal-warning",
              children: [
                jsx(Icon, {
                  name: "warning",
                }),
                jsxs("span", {
                  children: [
                    jsx("strong", {
                      children: "Restricted cargo",
                    }),
                    jsx("small", {
                      children: "Patrols may scan, confiscate, and issue a bounty.",
                    }),
                  ],
                }),
              ],
            }),
          jsx("svg", {
            className: "market-sparkline",
            viewBox: "0 0 100 36",
            preserveAspectRatio: "none",
            "aria-label": `${n.name} price history`,
            children: jsx("polyline", {
              points: c,
            }),
          }),
          jsxs("dl", {
            className: "trade-facts",
            children: [
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "Local stock",
                  }),
                  jsxs("dd", {
                    children: [a.stock, " units"],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "In your hold",
                  }),
                  jsxs("dd", {
                    children: [
                      a.owned,
                      " units",
                      (e.stolenCargo[i] ?? 0) > 0 ? ` \xB7 ${e.stolenCargo[i]} stolen` : "",
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "Production / demand",
                  }),
                  jsxs("dd", {
                    children: [a.production.toFixed(1), " / ", a.consumption.toFixed(1)],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "Known best resale",
                  }),
                  jsx("dd", {
                    children: o ? `${o.record.sell} cr \xB7 ${o.system.name}` : "No current intelligence",
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "Potential margin",
                  }),
                  jsx("dd", {
                    className: o && o.record.sell > a.buy ? "good-text" : "",
                    children: o ? `${o.record.sell - a.buy > 0 ? "+" : ""}${o.record.sell - a.buy} cr/u` : "\u2014",
                  }),
                ],
              }),
            ],
          }),
          jsxs("div", {
            className: "trade-actions",
            children: [
              jsxs("button", {
                className: "button button--primary",
                onClick: () => r.buyCommodity(i, 1),
                disabled: e.credits < a.buy || cargoMass(e) >= cargoCapacity(e),
                children: [
                  "Buy 1 ",
                  jsxs("span", {
                    children: [a.buy, " cr"],
                  }),
                ],
              }),
              jsx("button", {
                className: "button button--ghost",
                onClick: () => r.buyCommodity(i, Math.max(1, Math.min(a.stock, cargoCapacity(e) - cargoMass(e)))),
                disabled: e.credits < a.buy || cargoMass(e) >= cargoCapacity(e),
                children: "Buy max",
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: () => r.sellCommodity(i, 1),
                disabled: a.owned <= 0,
                children: [
                  "Sell 1 ",
                  jsxs("span", {
                    children: [a.sell, " cr"],
                  }),
                ],
              }),
              jsx("button", {
                className: "button button--ghost",
                onClick: () => r.sellCommodity(i, a.owned),
                disabled: a.owned <= 0,
                children: "Sell all",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
function ContractsTab({ model: r }) {
  let e = r.state,
    t = missionBoard(e).filter((i) => !e.acceptedMissions.some((s) => s.id === i.id));
  return jsxs("div", {
    className: "contracts-layout",
    children: [
      jsxs("section", {
        children: [
          jsxs("div", {
            className: "section-heading",
            children: [
              jsxs("div", {
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "OPPORTUNITY NETWORK",
                  }),
                  jsx("h3", {
                    children: "Open contracts",
                  }),
                ],
              }),
              jsxs("span", {
                className: "capacity-label",
                children: ["ACTIVE ", e.acceptedMissions.length, "/5"],
              }),
            ],
          }),
          jsx("div", {
            className: "contract-grid",
            children: t.map((i) =>
              jsxs(
                "article",
                {
                  className: "contract-card",
                  children: [
                    jsxs("div", {
                      className: "contract-card__top",
                      children: [
                        jsx("span", {
                          className: "contract-icon",
                          children: jsx(Icon, {
                            name: i.illegal ? "warning" : "contract",
                          }),
                        }),
                        jsxs("div", {
                          children: [
                            jsxs("span", {
                              className: "eyebrow",
                              children: [i.type.toUpperCase(), " \xB7 ", FACTIONS[i.issuer].short],
                            }),
                            jsx("h4", {
                              children: i.title,
                            }),
                          ],
                        }),
                        jsx("span", {
                          className: `risk-badge ${riskTone(i.risk)}`,
                          children: i.risk,
                        }),
                      ],
                    }),
                    jsx("p", {
                      children: i.description,
                    }),
                    jsxs("div", {
                      className: "contract-route",
                      children: [
                        jsx("span", {
                          children: systemById(e.currentSystem).name,
                        }),
                        jsx("i", {}),
                        jsx(Icon, {
                          name: "arrow",
                        }),
                        jsx("i", {}),
                        jsx("span", {
                          children: systemById(i.targetSystem).name,
                        }),
                      ],
                    }),
                    jsxs("dl", {
                      children: [
                        jsxs("div", {
                          children: [
                            jsx("dt", {
                              children: "OBJECTIVE",
                            }),
                            jsxs("dd", {
                              children: [i.objective.toUpperCase(), " \xB7 ", i.amount],
                            }),
                          ],
                        }),
                        jsxs("div", {
                          children: [
                            jsx("dt", {
                              children: "DEADLINE",
                            }),
                            jsxs("dd", {
                              children: ["Cycle ", i.deadlineTick],
                            }),
                          ],
                        }),
                        jsxs("div", {
                          children: [
                            jsx("dt", {
                              children: "LEGALITY",
                            }),
                            jsx("dd", {
                              className: i.illegal ? "danger-text" : "good-text",
                              children: i.illegal ? "ILLEGAL" : "SANCTIONED",
                            }),
                          ],
                        }),
                        jsxs("div", {
                          children: [
                            jsx("dt", {
                              children: "PAYOUT",
                            }),
                            jsxs("dd", {
                              children: [formatNumber(i.reward), " cr"],
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsx("small", {
                      className: "contract-consequence",
                      children: i.consequences,
                    }),
                    jsxs("button", {
                      className: "button button--primary",
                      onClick: () => r.acceptMission(i),
                      children: [
                        "Accept & track ",
                        jsx(Icon, {
                          name: "arrow",
                        }),
                      ],
                    }),
                  ],
                },
                i.id,
              ),
            ),
          }),
        ],
      }),
      jsxs("aside", {
        className: "active-contracts",
        children: [
          jsx("span", {
            className: "eyebrow",
            children: "ACTIVE LOG",
          }),
          jsx("h3", {
            children: "Your contracts",
          }),
          e.acceptedMissions.length === 0 &&
            jsxs("div", {
              className: "empty-state",
              children: [
                jsx(Icon, {
                  name: "contract",
                }),
                jsx("strong", {
                  children: "No active contracts",
                }),
                jsx("p", {
                  children: "You are free to improvise. The board is optional.",
                }),
              ],
            }),
          e.acceptedMissions.map((i) =>
            jsxs(
              "article",
              {
                children: [
                  jsx("span", {
                    className: `risk-dot ${riskTone(i.risk)}`,
                  }),
                  jsxs("div", {
                    children: [
                      jsx("strong", {
                        children: i.title,
                      }),
                      jsxs("span", {
                        children: [systemById(i.targetSystem).name, " \xB7 ", i.progress, "/", i.amount],
                      }),
                      jsx("div", {
                        className: "objective-progress",
                        children: jsx("span", {
                          style: {
                            width: `${(i.progress / i.amount) * 100}%`,
                          },
                        }),
                      }),
                    ],
                  }),
                  jsx("button", {
                    onClick: () => r.abandonMission(i.id),
                    children: "ABANDON",
                  }),
                ],
              },
              i.id,
            ),
          ),
        ],
      }),
    ],
  });
}
function ShipyardTab({ model: r, onShipAction: e }) {
  let t = r.state,
    [i, s] = useState("ships");
  return jsxs("div", {
    className: "shipyard-layout",
    children: [
      jsxs("div", {
        className: "section-heading",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "LICENSED HULLS & SYSTEMS",
              }),
              jsx("h3", {
                children: i === "ships" ? "Ship dealer" : "Refit bay",
              }),
            ],
          }),
          jsxs("div", {
            className: "segmented",
            children: [
              jsx("button", {
                className: i === "ships" ? "is-active" : "",
                onClick: () => s("ships"),
                children: "HULLS",
              }),
              jsx("button", {
                className: i === "upgrades" ? "is-active" : "",
                onClick: () => s("upgrades"),
                children: "UPGRADES",
              }),
            ],
          }),
        ],
      }),
      i === "ships"
        ? jsx("div", {
            className: "ship-grid",
            children: SHIPS.map((n) => {
              let a = t.ownedShips.includes(n.id),
                o = t.shipId === n.id,
                l = !n.faction || t.reputation[n.faction] >= (n.requiredReputation ?? 0);
              return jsxs(
                "article",
                {
                  className: `ship-card ${o ? "is-active" : ""}`,
                  children: [
                    jsxs("div", {
                      className: `ship-silhouette ship-silhouette--${n.id}`,
                      children: [jsx("span", {}), jsx("i", {}), jsx("b", {})],
                    }),
                    jsxs("div", {
                      className: "ship-card__title",
                      children: [
                        jsxs("div", {
                          children: [
                            jsx("span", {
                              className: "eyebrow",
                              children: n.className.toUpperCase(),
                            }),
                            jsx("h4", {
                              children: n.name,
                            }),
                          ],
                        }),
                        o &&
                          jsx("span", {
                            className: "tag tag--good",
                            children: "ACTIVE",
                          }),
                      ],
                    }),
                    jsx("p", {
                      children: n.blurb,
                    }),
                    jsxs("div", {
                      className: "ship-stats",
                      children: [
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "HULL",
                            }),
                            jsx("strong", {
                              children: n.hull,
                            }),
                          ],
                        }),
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "ARMOR",
                            }),
                            jsx("strong", {
                              children: n.armor,
                            }),
                          ],
                        }),
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "SHIELD",
                            }),
                            jsx("strong", {
                              children: n.shield,
                            }),
                          ],
                        }),
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "SPEED",
                            }),
                            jsx("strong", {
                              children: n.speed,
                            }),
                          ],
                        }),
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "CARGO",
                            }),
                            jsx("strong", {
                              children: n.cargo,
                            }),
                          ],
                        }),
                        jsxs("span", {
                          children: [
                            jsx("small", {
                              children: "MOUNTS",
                            }),
                            jsx("strong", {
                              children: n.mounts,
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "ship-loadout",
                      children: [
                        jsx("span", {
                          children: n.defaultWeapons.map((c) => WEAPONS[c].name).join(" \xB7 "),
                        }),
                        jsxs("span", {
                          children: [n.slots, " modules \xB7 ", n.mass, " mass"],
                        }),
                      ],
                    }),
                    !l &&
                      jsxs("small", {
                        className: "danger-text",
                        children: [
                          "LICENSE: ",
                          n.requiredReputation,
                          " ",
                          n.faction ? FACTIONS[n.faction].short : "",
                          " reputation",
                        ],
                      }),
                    jsx("button", {
                      className: `button ${o ? "button--disabled" : "button--primary"}`,
                      disabled: o || !l,
                      onClick: () => e(n.id),
                      children: o
                        ? "Current ship"
                        : a
                          ? "Make active"
                          : l
                            ? `Buy \xB7 ${formatNumber(n.price)} cr`
                            : "License locked",
                    }),
                  ],
                },
                n.id,
              );
            }),
          })
        : jsx(UpgradesPanel, {
            model: r,
          }),
    ],
  });
}
function UpgradesPanel({ model: r }) {
  return jsx("div", {
    className: "upgrade-grid",
    children: [
      {
        id: "weapon",
        name: "Weapon capacitors",
        icon: "target",
        effect: "+10% weapon damage per mark",
      },
      {
        id: "shield",
        name: "Shield lattice",
        icon: "shield",
        effect: "+12% shield capacity per mark",
      },
      {
        id: "engine",
        name: "Vector thrusters",
        icon: "boost",
        effect: "+7% speed and +8% acceleration",
      },
      {
        id: "cargo",
        name: "Folded cargo racks",
        icon: "cargo",
        effect: "+5 cargo capacity per mark",
      },
    ].map((t) => {
      let i = r.state.upgrades[t.id];
      return jsxs(
        "article",
        {
          children: [
            jsx("span", {
              className: "upgrade-icon",
              children: jsx(Icon, {
                name: t.icon,
              }),
            }),
            jsxs("div", {
              children: [
                jsx("span", {
                  className: "eyebrow",
                  children: "SYSTEM TUNE",
                }),
                jsx("h4", {
                  children: t.name,
                }),
                jsx("p", {
                  children: t.effect,
                }),
                jsx("div", {
                  className: "upgrade-pips",
                  children: [0, 1, 2, 3, 4].map((s) =>
                    jsx(
                      "i",
                      {
                        className: s < i ? "is-filled" : "",
                      },
                      s,
                    ),
                  ),
                }),
              ],
            }),
            jsx("button", {
              className: "button button--primary",
              disabled: i >= 5,
              onClick: () => r.buyUpgrade(t.id),
              children: i >= 5 ? "Maxed" : `Mk ${i + 1} \xB7 ${formatNumber(upgradeCost(i))} cr`,
            }),
          ],
        },
        t.id,
      );
    }),
  });
}
function LoadoutTab({ model: r }) {
  let e = r.state,
    t = shipStats(e),
    i = shipById(e.shipId),
    [s, n] = useState(Math.min(e.activeWeaponIndex, i.mounts - 1)),
    a = e.weaponLoadouts[e.shipId] ?? [],
    o = e.installedModules[e.shipId] ?? [];
  return jsxs("div", {
    className: "equipment-layout",
    children: [
      jsxs("div", {
        className: "section-heading",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "MASS \xB7 POWER \xB7 HEAT",
              }),
              jsxs("h3", {
                children: [i.name, " loadout"],
              }),
            ],
          }),
          jsxs("div", {
            className: "loadout-summary",
            children: [
              jsxs("span", {
                children: [t.mass, " MASS"],
              }),
              jsxs("span", {
                children: [t.powerUsed, "/", t.powerCapacity, " POWER"],
              }),
              jsxs("span", {
                children: [o.length, "/", i.slots, " MODULES"],
              }),
            ],
          }),
        ],
      }),
      jsxs("section", {
        className: "mount-console",
        children: [
          jsx("div", {
            className: "mount-tabs",
            children: Array.from(
              {
                length: i.mounts,
              },
              (l, c) =>
                jsxs(
                  "button",
                  {
                    className: s === c ? "is-active" : "",
                    "aria-pressed": s === c,
                    onClick: () => n(c),
                    children: [
                      jsxs("small", {
                        children: ["MOUNT ", c + 1],
                      }),
                      jsx("strong", {
                        children: a[c] ? WEAPONS[a[c]].name : "EMPTY",
                      }),
                    ],
                  },
                  c,
                ),
            ),
          }),
          jsx("div", {
            className: "weapon-catalog",
            children: Object.values(WEAPONS).map((l) => {
              let c = e.ownedWeapons.includes(l.id),
                u = a[s] === l.id;
              return jsxs(
                "article",
                {
                  className: u ? "is-installed" : "",
                  children: [
                    jsx("span", {
                      className: "equipment-icon",
                      children: jsx(Icon, {
                        name: l.splash > 0 ? "missile" : "target",
                      }),
                    }),
                    jsxs("div", {
                      children: [
                        jsx("span", {
                          className: "eyebrow",
                          children: l.category.toUpperCase(),
                        }),
                        jsx("h4", {
                          children: l.name,
                        }),
                        jsx("p", {
                          children: l.blurb,
                        }),
                        jsxs("dl", {
                          children: [
                            jsxs("span", {
                              children: [l.damage, " DMG"],
                            }),
                            jsxs("span", {
                              children: [l.range, " RNG"],
                            }),
                            jsxs("span", {
                              children: [l.energy, " EN"],
                            }),
                            jsxs("span", {
                              children: [l.heat, " HEAT"],
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsx("button", {
                      className: `button ${u ? "button--disabled" : "button--primary"}`,
                      disabled: u,
                      onClick: () => {
                        (c || r.buyWeapon(l.id)) && r.equipWeapon(l.id, s);
                      },
                      children: u ? "Mounted" : c ? `Mount in slot ${s + 1}` : `Buy \xB7 ${formatNumber(l.price)} cr`,
                    }),
                  ],
                },
                l.id,
              );
            }),
          }),
        ],
      }),
      jsxs("section", {
        className: "module-console",
        children: [
          jsx("div", {
            className: "section-heading",
            children: jsxs("div", {
              children: [
                jsx("span", {
                  className: "eyebrow",
                  children: "CONFIGURABLE SYSTEMS",
                }),
                jsx("h3", {
                  children: "Module inventory",
                }),
              ],
            }),
          }),
          jsx("div", {
            className: "module-grid",
            children: Object.values(MODULES).map((l) => {
              let c = e.ownedModules.includes(l.id),
                u = o.includes(l.id);
              return jsxs(
                "article",
                {
                  className: u ? "is-installed" : "",
                  children: [
                    jsxs("div", {
                      children: [
                        jsxs("span", {
                          className: "eyebrow",
                          children: [l.category.toUpperCase(), " \xB7 ", l.mass, " MASS \xB7 ", l.power, " POWER"],
                        }),
                        jsx("h4", {
                          children: l.name,
                        }),
                        jsx("p", {
                          children: l.description,
                        }),
                        jsx("strong", {
                          children: l.effect,
                        }),
                      ],
                    }),
                    jsx("button", {
                      onClick: () => (u ? r.uninstallModule(l.id) : c ? r.installModule(l.id) : r.buyModule(l.id)),
                      children: u ? "REMOVE" : c ? "INSTALL" : `${formatNumber(l.price)} CR`,
                    }),
                  ],
                },
                l.id,
              );
            }),
          }),
        ],
      }),
    ],
  });
}
function CrewTab({ model: r }) {
  let e = Math.min(8, 2 + Math.ceil(shipById(r.state.shipId).slots / 2));
  return jsxs("div", {
    className: "crew-layout",
    children: [
      jsxs("div", {
        className: "section-heading",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "DOCKSIDE TALENT",
              }),
              jsx("h3", {
                children: "Crew roster",
              }),
            ],
          }),
          jsxs("span", {
            className: "capacity-label",
            children: ["SIGNED ", r.state.crew.length, "/", e],
          }),
        ],
      }),
      jsx("div", {
        className: "crew-grid",
        children: CREW.map((t, i) => {
          let s = r.state.crew.includes(t.id);
          return jsxs(
            "article",
            {
              className: s ? "is-hired" : "",
              children: [
                jsx("div", {
                  className: `crew-portrait crew-portrait--${i}`,
                  children: jsx("span", {
                    children: t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join(""),
                  }),
                }),
                jsxs("div", {
                  children: [
                    jsxs("span", {
                      className: "eyebrow",
                      children: [t.role.toUpperCase(), " \xB7 ", t.salary, " CR/PAYROLL"],
                    }),
                    jsxs("h4", {
                      children: [t.name, t.companion ? " \xB7 COMPANION" : ""],
                    }),
                    jsx("p", {
                      children: t.trait,
                    }),
                    jsxs("strong", {
                      className: "crew-bonus",
                      children: [t.bonus, s ? ` \xB7 Loyalty ${Math.round(r.state.crewLoyalty[t.id] ?? 50)}` : ""],
                    }),
                  ],
                }),
                jsx("button", {
                  className: `button ${s ? "button--disabled" : "button--primary"}`,
                  disabled: s,
                  onClick: () => r.hireCrew(t.id),
                  children: s ? "On roster" : `Hire \xB7 ${formatNumber(t.cost)} cr`,
                }),
              ],
            },
            t.id,
          );
        }),
      }),
      jsxs("aside", {
        className: "crew-note",
        children: [
          jsx(Icon, {
            name: "people",
          }),
          jsxs("div", {
            children: [
              jsx("strong", {
                children: "People, not spreadsheets",
              }),
              jsx("p", {
                children:
                  "Payroll resolves every four travel cycles. Pay on time and loyalty rises; miss it and companions may reconsider the arrangement.",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
function ContactsTab({ model: r }) {
  let e = r.state,
    t = CONTACTS.filter((s) => s.system === e.currentSystem),
    i = e.world.systems[e.currentSystem];
  return jsxs("div", {
    className: "contacts-layout",
    children: [
      jsxs("section", {
        className: "contact-network",
        children: [
          jsxs("div", {
            className: "section-heading",
            children: [
              jsxs("div", {
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "RECURRING PEOPLE \xB7 UNUSUAL WORK",
                  }),
                  jsx("h3", {
                    children: "Contact network",
                  }),
                ],
              }),
              jsxs("span", {
                className: "capacity-label",
                children: [t.length, " LOCAL"],
              }),
            ],
          }),
          jsx("div", {
            className: "contact-grid",
            children: CONTACTS.map((s) => {
              let n = e.world.contacts[s.id],
                a = s.system === e.currentSystem;
              return jsxs(
                "article",
                {
                  className: `${n.met ? "is-met" : ""} ${a ? "is-local" : ""}`,
                  children: [
                    jsx("div", {
                      className: "contact-avatar",
                      children: s.name
                        .split(" ")
                        .map((o) => o[0])
                        .join(""),
                    }),
                    jsxs("div", {
                      children: [
                        jsxs("span", {
                          className: "eyebrow",
                          children: [s.role.toUpperCase(), " \xB7 ", systemById(s.system).name.toUpperCase()],
                        }),
                        jsx("h4", {
                          children: s.name,
                        }),
                        jsxs("p", {
                          children: ["\u201C", s.greeting, "\u201D"],
                        }),
                        jsx("strong", {
                          children: s.unlock,
                        }),
                        jsx("div", {
                          className: "trust-meter",
                          children: jsx("span", {
                            style: {
                              width: `${n.trust}%`,
                            },
                          }),
                        }),
                        jsxs("small", {
                          children: ["TRUST ", Math.round(n.trust), " \xB7 ARC ", n.arc, "/4"],
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "contact-actions",
                      children: [
                        jsx("button", {
                          disabled: !a,
                          onClick: () => r.talkToContact(s.id, "work"),
                          children: "ASK FOR WORK",
                        }),
                        jsx("button", {
                          disabled: !a,
                          onClick: () => r.talkToContact(s.id, "intel"),
                          children: "BUY INTEL",
                        }),
                        jsx("button", {
                          disabled: !a || e.credits < 350,
                          onClick: () => r.talkToContact(s.id, "trust"),
                          children: "FAVOR \xB7 350 CR",
                        }),
                      ],
                    }),
                  ],
                },
                s.id,
              );
            }),
          }),
        ],
      }),
      jsxs("aside", {
        className: "intel-console",
        children: [
          jsx("span", {
            className: "eyebrow",
            children: "SYSTEM INTELLIGENCE",
          }),
          jsxs("h3", {
            children: [systemById(e.currentSystem).name, " situation"],
          }),
          jsxs("dl", {
            className: "intel-stats",
            children: [
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "CONTROL",
                  }),
                  jsx("dd", {
                    children: FACTIONS[i.owner].short,
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "WAR",
                  }),
                  jsxs("dd", {
                    children: [Math.round(i.war * 100), "%"],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "PIRACY",
                  }),
                  jsxs("dd", {
                    children: [Math.round(i.piracy * 100), "%"],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "BLOCKADE",
                  }),
                  jsxs("dd", {
                    children: [Math.round(i.blockade * 100), "%"],
                  }),
                ],
              }),
            ],
          }),
          jsx("span", {
            className: "eyebrow",
            children: "OPTIONAL STORY",
          }),
          jsxs("div", {
            className: "story-card",
            children: [
              jsx("strong", {
                children: e.world.story.finaleDone
                  ? "Signal in the Static \xB7 Resolved"
                  : e.world.story.chapter >= 5
                    ? "Signal in the Static \xB7 Finale"
                    : `Signal in the Static \xB7 Chapter ${e.world.story.chapter + 1}`,
              }),
              jsx("p", {
                children: e.world.story.finaleDone
                  ? `${STORY_CHOICES[e.world.story.choice]?.title ?? "The route was given away"}. ${STORY_CHOICES[e.world.story.choice]?.perk ?? ""}`
                  : e.world.story.wardenDefeated
                    ? "The Quiet Warden is silent. Undock to decide who receives the impossible route."
                    : e.world.story.chapter >= 5
                      ? "Scanning the Quiet Star woke something in Null. Return there, destroy the Quiet Warden, then decide who receives the route."
                      : e.world.story.signalDecoded
                        ? "The impossible route is decoded. Its future now depends on who receives the coordinates."
                        : `${e.world.story.shards.length}/4 signal shards recovered. Scan anomalies in the marked frontier systems.`,
              }),
            ],
          }),
          jsx("span", {
            className: "eyebrow",
            children: "NAMED BOUNTIES",
          }),
          jsx("div", {
            className: "bounty-list",
            children: e.world.targets.map((s) =>
              jsxs(
                "article",
                {
                  children: [
                    jsxs("div", {
                      children: [
                        jsx("strong", {
                          children: s.name,
                        }),
                        jsxs("span", {
                          children: [s.status.toUpperCase(), " \xB7 THREAT ", s.threat],
                        }),
                      ],
                    }),
                    jsxs("span", {
                      children: [
                        formatNumber(s.bounty),
                        " CR",
                        jsx("br", {}),
                        s.status === "hidden" ? "LAST SIGNAL LOST" : systemById(s.system).name,
                      ],
                    }),
                  ],
                },
                s.id,
              ),
            ),
          }),
          jsx("span", {
            className: "eyebrow",
            children: "FRONTIER NEWS",
          }),
          jsx("div", {
            className: "news-feed",
            children: e.world.news.slice(0, 6).map((s) =>
              jsxs(
                "article",
                {
                  className: `news--${s.tone}`,
                  children: [
                    jsx("strong", {
                      children: s.headline,
                    }),
                    jsx("p", {
                      children: s.detail,
                    }),
                    jsxs("small", {
                      children: ["CYCLE ", s.tick, " \xB7 ", systemById(s.system).name],
                    }),
                  ],
                },
                s.id,
              ),
            ),
          }),
        ],
      }),
      jsxs("section", {
        className: "faction-ledger",
        children: [
          jsx("div", {
            className: "section-heading",
            children: jsxs("div", {
              children: [
                jsx("span", {
                  className: "eyebrow",
                  children: "POLITICS & ACCESS",
                }),
                jsx("h3", {
                  children: "Faction standing",
                }),
              ],
            }),
          }),
          jsx("div", {
            className: "skill-strip",
            children: Object.entries(e.skills).map(([s, n]) =>
              jsxs(
                "span",
                {
                  children: [
                    jsx("small", {
                      children: s.toUpperCase(),
                    }),
                    jsx("strong", {
                      children: n,
                    }),
                  ],
                },
                s,
              ),
            ),
          }),
          jsx("div", {
            className: "faction-ledger-grid",
            children: Object.values(FACTIONS).map((s) => {
              let n = e.reputation[s.id],
                a = e.world.factions[s.id];
              return jsxs(
                "article",
                {
                  style: {
                    "--faction": s.color,
                  },
                  children: [
                    jsx("span", {
                      className: "faction-sigil",
                      children: s.short,
                    }),
                    jsxs("div", {
                      children: [
                        jsx("strong", {
                          children: s.name,
                        }),
                        jsxs("span", {
                          children: [reputationLabel(n), " \xB7 ", Math.round(n)],
                        }),
                        jsx("p", {
                          children: s.doctrine,
                        }),
                        jsxs("small", {
                          children: [
                            "MIL ",
                            Math.round(a.military),
                            " \xB7 TECH ",
                            Math.round(a.technology),
                            " \xB7 ",
                            a.objective,
                          ],
                        }),
                      ],
                    }),
                  ],
                },
                s.id,
              );
            }),
          }),
        ],
      }),
    ],
  });
}
function EnterpriseTab({ model: r }) {
  let e = PROPERTIES.filter((s) => r.state.properties.includes(s.id)).reduce((s, n) => s + n.income, 0),
    t = r.state.ownedShips.filter((s) => s !== r.state.shipId),
    i = [
      {
        id: "standby",
        label: "Standby",
      },
      {
        id: "trade",
        label: "Trade route",
      },
      {
        id: "mining",
        label: "Mining claim",
      },
      {
        id: "escort",
        label: "Convoy escort",
      },
      {
        id: "salvage",
        label: "Salvage sweep",
      },
      {
        id: "patrol",
        label: "Faction patrol",
      },
    ];
  return jsxs("div", {
    className: "enterprise-layout",
    children: [
      jsxs("div", {
        className: "section-heading",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "AUTOMATED OPERATIONS",
              }),
              jsx("h3", {
                children: "Build something that changes the region",
              }),
            ],
          }),
          jsxs("span", {
            className: "income-chip",
            children: [formatNumber(e), " CR GROSS / PAYROLL"],
          }),
        ],
      }),
      jsxs("section", {
        className: "fleet-console",
        children: [
          jsxs("div", {
            className: "fleet-console__heading",
            children: [
              jsx("span", {
                className: "fleet-emblem",
                children: jsx(Icon, {
                  name: "ship",
                }),
              }),
              jsxs("div", {
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "CAPTAIN-DIRECTED FLEET",
                  }),
                  jsx("h4", {
                    children: "Assign intent, not waypoints",
                  }),
                  jsx("p", {
                    children:
                      "Captains travel real routes, face regional risk, move market stock, and report results every payroll cycle.",
                  }),
                ],
              }),
            ],
          }),
          t.length === 0
            ? jsxs("div", {
                className: "fleet-empty",
                children: [
                  jsx("span", {
                    children: "Purchase or capture a second ship to unlock automated fleet orders.",
                  }),
                  jsx("strong", {
                    children: "0 SHIPS AVAILABLE",
                  }),
                ],
              })
            : jsx("div", {
                className: "fleet-list",
                children: t.map((s) => {
                  let n = shipById(s),
                    a = r.state.fleetOrders[s],
                    o = a?.role ?? "standby";
                  return jsxs(
                    "article",
                    {
                      children: [
                        jsxs("div", {
                          children: [
                            jsxs("span", {
                              className: "eyebrow",
                              children: [
                                n.className.toUpperCase(),
                                " \xB7 ",
                                a?.captain ? CREW.find((l) => l.id === a.captain)?.name : "AUTOMATED CAPTAIN",
                              ],
                            }),
                            jsx("strong", {
                              children: n.name,
                            }),
                            a &&
                              jsxs(Fragment, {
                                children: [
                                  jsxs("small", {
                                    children: [
                                      a.status.toUpperCase(),
                                      " \xB7 ",
                                      systemById(a.destination).name,
                                      " \xB7 RISK ",
                                      Math.round(a.risk * 100),
                                      "%",
                                    ],
                                  }),
                                  jsx("div", {
                                    className: "objective-progress",
                                    children: jsx("span", {
                                      style: {
                                        width: `${a.progress}%`,
                                      },
                                    }),
                                  }),
                                  jsx("p", {
                                    children: a.lastReport,
                                  }),
                                ],
                              }),
                          ],
                        }),
                        jsx("div", {
                          className: "fleet-orders",
                          children: i.map((l) =>
                            jsx(
                              "button",
                              {
                                className: o === l.id ? "is-active" : "",
                                "aria-pressed": o === l.id,
                                onClick: () => r.assignFleetShip(s, l.id),
                                children: l.label,
                              },
                              l.id,
                            ),
                          ),
                        }),
                      ],
                    },
                    s,
                  );
                }),
              }),
        ],
      }),
      jsx("div", {
        className: "property-grid",
        children: PROPERTIES.map((s, n) =>
          jsx(
            PropertyCard,
            {
              model: r,
              property: s,
              index: n,
            },
            s.id,
          ),
        ),
      }),
    ],
  });
}
function PropertyCard({ model: r, property: e, index: t }) {
  let [i, s] = useState("ore"),
    n = r.state.properties.includes(e.id),
    a = r.state.propertyOperations.find((c) => c.id === e.id),
    o = a?.system === r.state.currentSystem,
    l = a ? Object.values(a.stored).reduce((c, u) => c + (u ?? 0), 0) : 0;
  return jsxs("article", {
    className: n ? "is-owned" : "",
    children: [
      jsxs("div", {
        className: `property-art property-art--${t}`,
        children: [jsx("span", {}), jsx("i", {}), jsx("b", {})],
      }),
      jsxs("div", {
        children: [
          jsx("span", {
            className: "eyebrow",
            children: n
              ? `${a ? systemById(a.system).name.toUpperCase() : "OPERATIONAL"} \xB7 CONDITION ${a?.condition ?? 100}%`
              : "AVAILABLE LICENSE",
          }),
          jsx("h4", {
            children: e.name,
          }),
          jsx("p", {
            children: e.blurb,
          }),
          jsxs("dl", {
            children: [
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "GROSS INCOME",
                  }),
                  jsxs("dd", {
                    children: ["+", formatNumber(e.income), " cr"],
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "SERVICE",
                  }),
                  jsx("dd", {
                    children: e.service.toUpperCase(),
                  }),
                ],
              }),
              jsxs("div", {
                children: [
                  jsx("dt", {
                    children: "STORAGE",
                  }),
                  jsxs("dd", {
                    children: [l, "/", e.capacity || "\u2014"],
                  }),
                ],
              }),
            ],
          }),
          n &&
            e.capacity > 0 &&
            jsxs("div", {
              className: "storage-actions",
              children: [
                jsx("select", {
                  value: i,
                  onChange: (c) => s(c.target.value),
                  "aria-label": `${e.name} storage commodity`,
                  children: COMMODITIES.map((c) =>
                    jsx(
                      "option",
                      {
                        value: c.id,
                        children: c.name,
                      },
                      c.id,
                    ),
                  ),
                }),
                jsx("button", {
                  disabled: !o || (r.state.cargo[i] ?? 0) <= 0,
                  onClick: () => r.transferToStorage(e.id, i, 1),
                  children: "STORE 1",
                }),
                jsx("button", {
                  disabled: !o || (a?.stored[i] ?? 0) <= 0,
                  onClick: () => r.withdrawFromStorage(e.id, i, 1),
                  children: "TAKE 1",
                }),
              ],
            }),
        ],
      }),
      jsx("button", {
        className: `button ${n ? "button--disabled" : "button--primary"}`,
        disabled: n,
        onClick: () => r.buyProperty(e.id),
        children: n ? (o ? "Local operation" : "Remote operation") : `Invest \xB7 ${formatNumber(e.price)} cr`,
      }),
    ],
  });
}
function GalaxyMap({ state: r, source, selectedId: e, setSelectedId: t, onJump: i, onClose: s }) {
  let n = r.currentSystem,
    a = r.knownSystems,
    o = r.jurisdictionHeat,
    l = systemById(e),
    c = systemById(n),
    u = r.world.systems[e],
    h = systemOwner(r.world, e),
    d =
      r.world.story.signalDecoded &&
      [
        ["null", "zenith"],
        ["zenith", "null"],
      ].some(([g, S]) => n === g && e === S),
    f = c.links.includes(e) || d,
    m = a.includes(e),
    p = SYSTEMS.flatMap((g) => g.links.filter((S) => g.id < S).map((S) => [g, systemById(S)]));
  return (
    r.world.story.signalDecoded && p.push([systemById("null"), systemById("zenith")]),
    jsxs("section", {
      className: "map-screen overlay-screen",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Galaxy map",
      children: [
        jsxs("header", {
          className: "overlay-header",
          children: [
            jsxs("div", {
              children: [
                jsx("span", {
                  className: "eyebrow",
                  children: "NAVIGATION & INTELLIGENCE",
                }),
                jsx("h2", {
                  children: "Neon Frontier",
                }),
                jsxs("p", {
                  children: [a.length, "/", SYSTEMS.length, " systems charted \xB7 current location: ", c.name],
                }),
              ],
            }),
            jsxs("button", {
              className: "close-button",
              onClick: s,
              children: [
                jsx(Icon, {
                  name: "close",
                }),
                " CLOSE ",
                jsx(Key, {
                  source,
                  action: "map",
                }),
              ],
            }),
          ],
        }),
        jsxs("div", {
          className: "galaxy-canvas",
          children: [
            jsx("div", {
              className: "galaxy-haze galaxy-haze--one",
            }),
            jsx("div", {
              className: "galaxy-haze galaxy-haze--two",
            }),
            jsx("svg", {
              className: "route-lines",
              viewBox: "0 0 100 100",
              preserveAspectRatio: "none",
              "aria-hidden": "true",
              children: p.map(([g, S]) =>
                jsx(
                  "line",
                  {
                    x1: g.position[0],
                    y1: g.position[1],
                    x2: S.position[0],
                    y2: S.position[1],
                    className: `${a.includes(g.id) && a.includes(S.id) ? "is-known" : ""} ${g.id === "null" && S.id === "zenith" ? "is-impossible" : ""}`,
                  },
                  `${g.id}-${S.id}`,
                ),
              ),
            }),
            SYSTEMS.map((g) => {
              let S = a.includes(g.id),
                x = n === g.id,
                v = r.world.systems[g.id],
                E = systemOwner(r.world, g.id);
              return jsxs(
                "button",
                {
                  className: `system-node ${x ? "is-current" : ""} ${e === g.id ? "is-selected" : ""} ${S ? "is-known" : "is-unknown"}`,
                  "aria-pressed": e === g.id,
                  style: {
                    left: `${g.position[0]}%`,
                    top: `${g.position[1]}%`,
                    "--faction": FACTIONS[E].color,
                  },
                  onClick: () => t(g.id),
                  children: [
                    jsx("span", {
                      className: "system-orbit",
                      children: jsx("i", {}),
                    }),
                    jsx("strong", {
                      children: S ? g.name : "UNKNOWN",
                    }),
                    jsx("small", {
                      children: x
                        ? "YOU ARE HERE"
                        : S
                          ? `${Math.round(v.security * 5)}/5 SEC \xB7 ${Math.round(v.war * 100)}% WAR`
                          : "UNCHARTED",
                    }),
                    (o[g.id] ?? 0) > 0 &&
                      jsx("b", {
                        children: "!",
                      }),
                  ],
                },
                g.id,
              );
            }),
            jsxs("div", {
              className: "map-legend",
              children: [
                jsxs("span", {
                  children: [
                    jsx("i", {
                      className: "legend-current",
                    }),
                    " CURRENT",
                  ],
                }),
                jsxs("span", {
                  children: [
                    jsx("i", {
                      className: "legend-known",
                    }),
                    " CHARTED",
                  ],
                }),
                jsxs("span", {
                  children: [
                    jsx("i", {
                      className: "legend-route",
                    }),
                    " JUMP LINK",
                  ],
                }),
                jsxs("span", {
                  children: [
                    jsx("i", {
                      className: "legend-wanted",
                    }),
                    " WANTED",
                  ],
                }),
              ],
            }),
          ],
        }),
        jsxs("aside", {
          className: "system-inspector",
          children: [
            jsxs("div", {
              className: "inspector-orb",
              style: {
                "--orb-a": l.palette[1],
                "--orb-b": l.palette[2],
              },
              children: [jsx("span", {}), jsx("i", {})],
            }),
            jsx("span", {
              className: "eyebrow",
              children: m ? `${FACTIONS[h].short} TERRITORY \xB7 CYCLE ${r.world.tick}` : "UNVERIFIED SIGNAL",
            }),
            jsx("h3", {
              children: m ? l.name : "Unknown system",
            }),
            jsx("p", {
              children: m ? l.subtitle : "Travel through an adjacent gate to chart this region and reveal its markets.",
            }),
            m &&
              jsxs(Fragment, {
                children: [
                  jsxs("dl", {
                    children: [
                      jsxs("div", {
                        children: [
                          jsx("dt", {
                            children: "SECURITY",
                          }),
                          jsxs("dd", {
                            children: [Math.round(u.security * 5), "/5"],
                          }),
                        ],
                      }),
                      jsxs("div", {
                        children: [
                          jsx("dt", {
                            children: "ECONOMY",
                          }),
                          jsx("dd", {
                            children: l.economy,
                          }),
                        ],
                      }),
                      jsxs("div", {
                        children: [
                          jsx("dt", {
                            children: "WAR / PIRACY",
                          }),
                          jsxs("dd", {
                            className: u.war + u.piracy > 1.1 ? "danger-text" : "warn-text",
                            children: [Math.round(u.war * 100), "% / ", Math.round(u.piracy * 100), "%"],
                          }),
                        ],
                      }),
                      jsxs("div", {
                        children: [
                          jsx("dt", {
                            children: "PROSPERITY",
                          }),
                          jsxs("dd", {
                            children: [Math.round(u.prosperity * 100), "%"],
                          }),
                        ],
                      }),
                      jsxs("div", {
                        children: [
                          jsx("dt", {
                            children: "LEGAL",
                          }),
                          jsxs("dd", {
                            className: (o[l.id] ?? 0) > 0 ? "danger-text" : "good-text",
                            children: [
                              heatLabel(o[l.id] ?? 0),
                              " \xB7 ",
                              formatNumber(r.jurisdictionBounty[l.id] ?? 0),
                              " CR",
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  jsx("p", {
                    className: "system-mechanics",
                    children: l.mechanicalIdentity,
                  }),
                  jsxs("div", {
                    className: "landmark-list",
                    children: [
                      jsx("span", {
                        className: "eyebrow",
                        children: "KNOWN LANDMARKS",
                      }),
                      l.landmarks.map((g) =>
                        jsxs(
                          "span",
                          {
                            children: [jsx("i", {}), g],
                          },
                          g,
                        ),
                      ),
                    ],
                  }),
                  jsxs("div", {
                    className: "landmark-list",
                    children: [
                      jsx("span", {
                        className: "eyebrow",
                        children: "ACTIVE SIGNALS",
                      }),
                      r.world.events
                        .filter((g) => g.system === l.id && !g.resolved)
                        .slice(0, 3)
                        .map((g) =>
                          jsxs(
                            "span",
                            {
                              children: [jsx("i", {}), g.title, " \xB7 ", g.expiresTick - r.world.tick, " cycles"],
                            },
                            g.id,
                          ),
                        ),
                      r.world.events.every((g) => g.system !== l.id || g.resolved) &&
                        jsxs("span", {
                          children: [jsx("i", {}), "No verified event traffic"],
                        }),
                    ],
                  }),
                ],
              }),
            jsx("button", {
              className: "button button--primary button--large",
              disabled: e === n || !f,
              onClick: () => i(e),
              children:
                e === n
                  ? "Current system"
                  : f
                    ? jsxs(Fragment, {
                        children: [
                          d ? "Enter impossible route" : "Spool direct jump",
                          " ",
                          jsx(Icon, {
                            name: "arrow",
                          }),
                        ],
                      })
                    : jsx(Fragment, {
                        children: "No direct route",
                      }),
            }),
            !f &&
              e !== n &&
              jsxs("small", {
                className: "route-hint",
                children: ["Travel through ", c.links.map((g) => systemById(g).name).join(" or "), "."],
              }),
          ],
        }),
      ],
    })
  );
}
function PauseScreen({ state: r, source, onResume: e, onSave: t, onMap: i, onSettings: s, onGuide: n, onTitle: a }) {
  return jsxs("section", {
    className: "pause-screen overlay-screen",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "pause-title",
    children: [
      jsxs("div", {
        className: "pause-card",
        children: [
          jsx("span", {
            className: "eyebrow",
            children: "FLIGHT SUSPENDED",
          }),
          jsx("h2", {
            id: "pause-title",
            children: "Paused",
          }),
          jsxs("p", {
            children: [
              systemById(r.currentSystem).name,
              " \xB7 ",
              shipById(r.shipId).name,
              " \xB7 ",
              formatNumber(r.credits),
              " cr",
            ],
          }),
          jsxs("div", {
            className: "pause-actions",
            children: [
              jsxs("button", {
                className: "button button--primary button--large",
                onClick: e,
                children: [
                  jsx(Icon, {
                    name: "play",
                  }),
                  " Resume flight ",
                  jsx("span", {
                    className: "button__trail",
                    children: hint(source, "pause"),
                  }),
                ],
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: t,
                children: [
                  jsx(Icon, {
                    name: "save",
                  }),
                  " Save game",
                ],
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: i,
                children: [
                  jsx(Icon, {
                    name: "map",
                  }),
                  " Galaxy map",
                ],
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: s,
                children: [
                  jsx(Icon, {
                    name: "settings",
                  }),
                  " Settings",
                ],
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: n,
                children: [
                  jsx(Icon, {
                    name: "contract",
                  }),
                  " Field guide",
                ],
              }),
            ],
          }),
          jsx("button", {
            className: "text-button pause-title-link",
            onClick: a,
            children: "Save & return to title",
          }),
        ],
      }),
      jsxs("div", {
        className: "pause-side",
        children: [
          jsxs("div", {
            className: "pause-quote",
            children: [
              "\u201CA good route makes money. A great route makes enemies.\u201D",
              jsx("span", {
                children: "\u2014 RHEA VOSS",
              }),
            ],
          }),
          jsx(CareerRecord, {
            state: r,
          }),
        ],
      }),
    ],
  });
}
/** The career so far, on the pause screen. */
function CareerRecord({ state: r }) {
  const minutes = Math.floor(r.playSeconds / 60);
  const story = r.world.story;
  const rows = [
    ["RENOWN", formatNumber(r.renown)],
    ["CONTRACTS", formatNumber(r.contractsCompleted ?? 0)],
    ["KILLS", formatNumber(r.kills)],
    ["BOUNTIES", `${formatNumber(r.bountiesCollected ?? 0)} CR`],
    ["ORE MINED", formatNumber(r.mined)],
    ["SALVAGE", formatNumber(r.salvaged)],
    ["BOARDED", formatNumber(r.boarded)],
    ["DISCOVERIES", formatNumber(r.world.discoveries.length)],
    ["SYSTEMS", `${r.visitedSystems.length}/${SYSTEMS.length}`],
    ["FLEET", `${r.ownedShips.length} HULL${r.ownedShips.length === 1 ? "" : "S"}`],
    ["FLIGHT TIME", `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, "0")}M`],
    [
      "STORY",
      story.finaleDone ? "RESOLVED" : story.chapter >= 5 ? "FINALE" : `CHAPTER ${story.chapter + 1}/5`,
    ],
  ];
  return jsxs("section", {
    className: "career-record",
    "aria-label": "Career record",
    children: [
      jsx("span", {
        className: "eyebrow",
        children: "CAREER RECORD",
      }),
      jsx("dl", {
        children: rows.map(([k, v]) =>
          jsxs(
            "div",
            {
              children: [
                jsx("dt", {
                  children: k,
                }),
                jsx("dd", {
                  children: v,
                }),
              ],
            },
            k,
          ),
        ),
      }),
    ],
  });
}
/**
 * Signal in the Static, resolved: who receives the impossible route. Two
 * steps (pick, then transmit), so a boost key or button still held when the
 * screen opens can never commit the choice by itself.
 */
function FinaleScreen({ state: r, onChoose }) {
  const [picked, setPicked] = useState(null);
  const confirmRef = useRef(null);
  useEffect(() => {
    if (picked) confirmRef.current?.focus({ preventScroll: true });
  }, [picked]);
  const choice = picked ? STORY_CHOICES[picked] : null;
  return jsxs("section", {
    className: "finale-screen overlay-screen",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "finale-title",
    children: [
      jsxs("header", {
        className: "finale-head",
        children: [
          jsx("span", {
            className: "eyebrow",
            children: "SIGNAL IN THE STATIC \xB7 FINALE",
          }),
          jsx("h2", {
            id: "finale-title",
            children: "The Quiet Star",
          }),
          jsx("p", {
            children:
              "The Warden is silent and its heart still hums in your hold. The Null\u2013Zenith corridor answers whoever holds these coordinates. Every faction is listening for your transmission.",
          }),
        ],
      }),
      jsx("div", {
        className: "finale-choices",
        children: Object.values(STORY_CHOICES).map((c) =>
          jsxs(
            "button",
            {
              className: `finale-choice ${picked === c.id ? "is-picked" : ""}`,
              "aria-pressed": picked === c.id,
              style: {
                "--faction": FACTIONS[c.faction].color,
              },
              onClick: () => setPicked(c.id),
              children: [
                jsx("span", {
                  className: "faction-sigil",
                  children: c.id === "self" ? "VR" : FACTIONS[c.faction].short,
                }),
                jsx("strong", {
                  children: c.title,
                }),
                jsx("p", {
                  children: c.body,
                }),
                jsx("small", {
                  children: c.perk,
                }),
                jsxs("em", {
                  children: [
                    "+",
                    formatNumber(c.credits),
                    " CR \xB7 ",
                    Object.entries(c.reputation)
                      .map(([f, v]) => `${FACTIONS[f].short} ${v > 0 ? "+" : ""}${v}`)
                      .join(" \xB7 "),
                  ],
                }),
              ],
            },
            c.id,
          ),
        ),
      }),
      jsxs("div", {
        className: "finale-actions",
        children: [
          jsxs("button", {
            className: "button button--primary button--large",
            ref: confirmRef,
            disabled: !choice,
            onClick: () => choice && onChoose(choice.id),
            children: [
              jsx(Icon, {
                name: "map",
              }),
              choice
                ? choice.id === "self"
                  ? " Keep the coordinates"
                  : ` Transmit to ${FACTIONS[choice.faction].short}`
                : " Choose who receives the route",
            ],
          }),
          jsxs("p", {
            className: "finale-foot",
            children: [formatNumber(r.credits), " cr \xB7 ", shipById(r.shipId).name, " \xB7 this choice is final"],
          }),
        ],
      }),
    ],
  });
}
function SettingsScreen({ settings: r, kitSettings, onChange: e, onClose: t, onDisplay }) {
  return jsxs("section", {
    className: "settings-screen overlay-screen",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "settings-title",
    children: [
      jsxs("header", {
        className: "overlay-header",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "PREFERENCES",
              }),
              jsx("h2", {
                id: "settings-title",
                children: "Settings",
              }),
              jsx("p", {
                children: "Changes apply immediately and save with your career.",
              }),
            ],
          }),
          jsxs("button", {
            className: "close-button",
            onClick: t,
            children: [
              jsx(Icon, {
                name: "close",
              }),
              " CLOSE",
            ],
          }),
        ],
      }),
      jsxs("div", {
        className: "settings-layout",
        children: [
          jsxs("section", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "ACCESSIBILITY & GAMEPLAY",
              }),
              jsx("h3", {
                children: "Make the frontier yours",
              }),
              jsx(SettingToggle, {
                title: "Reduced motion",
                body: "Removes camera impulses, cuts particle bursts, and calms interface pulses.",
                value: r.reducedMotion,
                onChange: (i) => e("reducedMotion", i),
              }),
              jsx(SettingToggle, {
                title: "Aim assistance",
                body: "Gently biases manual fire toward the locked target without steering the ship.",
                value: r.aimAssist,
                onChange: (i) => e("aimAssist", i),
              }),
              jsx(SettingToggle, {
                title: "Automatic fire",
                body: "Fires the active weapon while a valid locked hostile is in range.",
                value: r.autoFire,
                onChange: (i) => e("autoFire", i),
              }),
              jsx(SettingToggle, {
                title: "Flight assist braking",
                body: "Actively arrests drift when movement input is released.",
                value: r.autoBrake,
                onChange: (i) => e("autoBrake", i),
              }),
              jsx(SettingToggle, {
                title: "High-contrast interface",
                body: "Strengthens panel borders, focus rings, and non-color status separation.",
                value: r.highContrast,
                onChange: (i) => e("highContrast", i),
              }),
              jsx(SettingToggle, {
                title: "Camera impact response",
                body: "Allows subtle recoil and collision feedback during combat.",
                value: r.cameraShake,
                onChange: (i) => e("cameraShake", i),
              }),
              jsx(SettingToggle, {
                title: "Always show touch controls",
                body: "Displays twin virtual sticks even when a mouse is detected.",
                value: kitSettings.touch === "on",
                onChange: (i) => e("touchControls", i),
              }),
            ],
          }),
          jsxs("aside", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "INTERFACE SCALE",
              }),
              jsxs("h3", {
                children: [Math.round(r.uiScale * 100), "%"],
              }),
              jsx("input", {
                type: "range",
                min: "0.85",
                max: "1.4",
                step: "0.05",
                value: r.uiScale,
                onChange: (i) => e("uiScale", Number(i.target.value)),
                "aria-label": "Interface scale",
              }),
              jsxs("div", {
                className: "scale-labels",
                children: [
                  jsx("span", {
                    children: "COMPACT",
                  }),
                  jsx("span", {
                    children: "DEFAULT",
                  }),
                  jsx("span", {
                    children: "LARGE",
                  }),
                ],
              }),
              jsx("span", {
                className: "eyebrow settings-subhead",
                children: "SOUND EFFECTS",
              }),
              jsxs("h3", {
                children: [Math.round((r.sfxVolume ?? 0.7) * 100), "%"],
              }),
              jsx("input", {
                type: "range",
                min: "0",
                max: "1",
                step: "0.05",
                value: r.sfxVolume ?? 0.7,
                onChange: (i) => e("sfxVolume", Number(i.target.value)),
                "aria-label": "Sound effects volume",
              }),
              jsxs("label", {
                className: "quality-select",
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "DIFFICULTY",
                  }),
                  jsx("select", {
                    value: r.difficulty ?? "standard",
                    onChange: (i) => e("difficulty", i.target.value),
                    children: Object.values(DIFFICULTY).map((d) =>
                      jsx(
                        "option",
                        {
                          value: d.id,
                          children:
                            d.id === "relaxed"
                              ? "Relaxed \xB7 softer hits, slower enemy fire"
                              : d.id === "veteran"
                                ? "Veteran \xB7 harder hits, richer bounties"
                                : "Standard \xB7 the frontier as designed",
                        },
                        d.id,
                      ),
                    ),
                  }),
                  jsx("small", {
                    children: "Changes incoming damage, hostile rate of fire, insurance deductibles and pirate bounties.",
                  }),
                ],
              }),
              jsxs("label", {
                className: "quality-select",
                children: [
                  jsx("span", {
                    className: "eyebrow",
                    children: "GRAPHICS QUALITY",
                  }),
                  jsxs("select", {
                    value: kitSettings.quality,
                    onChange: (i) => e("graphicsQuality", i.target.value),
                    children: [
                      jsx("option", {
                        value: "auto",
                        children: "Auto \xB7 recommended",
                      }),
                      jsx("option", {
                        value: "ultra",
                        children: "Ultra \xB7 4K shadows + MSAA + bloom",
                      }),
                      jsx("option", {
                        value: "high",
                        children: "High \xB7 MSAA + sharp shadows + bloom",
                      }),
                      jsx("option", {
                        value: "medium",
                        children: "Medium \xB7 balanced",
                      }),
                      jsx("option", {
                        value: "low",
                        children: "Low \xB7 simple shadows + light bloom",
                      }),
                    ],
                  }),
                  jsx("small", {
                    children: "Graphics changes apply immediately and follow you to every game on this device.",
                  }),
                ],
              }),
              jsxs("div", {
                className: "accessibility-note",
                children: [
                  jsx(Icon, {
                    name: "shield",
                  }),
                  jsx("p", {
                    children:
                      "Essential status uses labels, values, and shapes in addition to color. Menus trap focus and remain keyboard accessible.",
                  }),
                ],
              }),
              jsxs("button", {
                className: "button button--ghost",
                onClick: onDisplay,
                children: [
                  jsx(Icon, {
                    name: "settings",
                  }),
                  " Display & controls",
                ],
              }),
              jsx("button", {
                className: "button button--ghost",
                onClick: () => {
                  (e("reducedMotion", !1),
                    e("aimAssist", !0),
                    e("autoFire", !1),
                    e("autoBrake", !0),
                    e("cameraShake", !0),
                    e("highContrast", !1),
                    e("touchControls", !1),
                    e("graphicsQuality", "auto"),
                    e("sfxVolume", 0.7),
                    e("difficulty", "standard"),
                    e("uiScale", 1));
                },
                children: "Restore defaults",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
function SettingToggle({ title: r, body: e, value: t, onChange: i }) {
  return jsxs("label", {
    className: "setting-row",
    children: [
      jsxs("span", {
        children: [
          jsx("strong", {
            children: r,
          }),
          jsx("small", {
            children: e,
          }),
        ],
      }),
      jsx("input", {
        type: "checkbox",
        checked: t,
        onChange: (s) => i(s.target.checked),
      }),
      jsx("i", {
        "aria-hidden": "true",
        children: jsx("b", {}),
      }),
    ],
  });
}
function FieldGuide({ page: r, source, setPage: e, onClose: t }) {
  return jsxs("section", {
    className: "guide-screen overlay-screen",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "guide-title",
    children: [
      jsxs("header", {
        className: "overlay-header",
        children: [
          jsxs("div", {
            children: [
              jsx("span", {
                className: "eyebrow",
                children: "VOIDRUNNER DATABASE",
              }),
              jsx("h2", {
                id: "guide-title",
                children: "Field guide",
              }),
              jsx("p", {
                children: "Enough information to make a decision. Never enough to remove the surprise.",
              }),
            ],
          }),
          jsxs("button", {
            className: "close-button",
            onClick: t,
            children: [
              jsx(Icon, {
                name: "close",
              }),
              " CLOSE",
            ],
          }),
        ],
      }),
      jsxs("nav", {
        className: "guide-nav",
        children: [
          jsx("button", {
            className: r === "careers" ? "is-active" : "",
            "aria-pressed": r === "careers",
            onClick: () => e("careers"),
            children: "CAREERS",
          }),
          jsx("button", {
            className: r === "controls" ? "is-active" : "",
            "aria-pressed": r === "controls",
            onClick: () => e("controls"),
            children: "CONTROLS",
          }),
          jsx("button", {
            className: r === "world" ? "is-active" : "",
            "aria-pressed": r === "world",
            onClick: () => e("world"),
            children: "FACTIONS",
          }),
        ],
      }),
      jsxs("div", {
        className: "guide-content",
        children: [
          r === "careers" && jsx(GuideCareers, {}),
          r === "controls" && jsx(GuideControls, { source }),
          r === "world" && jsx(GuideFactions, {}),
        ],
      }),
    ],
  });
}
function GuideCareers() {
  return jsx("div", {
    className: "career-grid",
    children: [
      ["Trader", "Buy where supply is high, sell into shortages, and watch wars move prices.", "cargo"],
      ["Bounty hunter", "Scan named targets, follow active sightings, and collect lawful payouts.", "target"],
      ["Pirate", "Attack traffic, steal cargo, escape the response, and sell through Freewake ports.", "warning"],
      ["Smuggler", "Carry restricted goods through separate jurisdictions and manage regional heat.", "ship"],
      ["Miner", "Break asteroid deposits, recover ore, and survive whoever noticed your rare strike.", "business"],
      ["Explorer", "Chart unknown routes, scan anomalies, and find artifacts best left unregistered.", "map"],
      [
        "Salvager",
        "Disable ships, board surrendered crews, recover components, and sometimes capture the hull.",
        "dock",
      ],
      [
        "Industrialist",
        "Establish claims, warehouses, relays, and trade offices that alter regional supply.",
        "business",
      ],
      [
        "Mercenary",
        "Join border wars, escort faction logistics, patrol, or profit from whoever controls the field next.",
        "contract",
      ],
    ].map(([e, t, i]) =>
      jsxs(
        "article",
        {
          children: [
            jsx(Icon, {
              name: i,
            }),
            jsx("h3", {
              children: e,
            }),
            jsx("p", {
              children: t,
            }),
          ],
        },
        e,
      ),
    ),
  });
}
function GuideControls({ source }) {
  return jsx("div", {
    className: "controls-table",
    children: (CONTROL_ROWS[source] ?? CONTROL_ROWS.keyboard).map(([e, t]) =>
      jsxs(
        "div",
        {
          children: [
            jsx("span", {
              className: "keycap wide",
              children: e,
            }),
            jsx("span", {
              children: t,
            }),
          ],
        },
        e,
      ),
    ),
  });
}
function GuideFactions() {
  return jsx("div", {
    className: "faction-grid",
    children: Object.values(FACTIONS).map((r) =>
      jsxs(
        "article",
        {
          style: {
            "--faction": r.color,
          },
          children: [
            jsx("span", {
              className: "faction-sigil",
              children: r.short,
            }),
            jsxs("div", {
              children: [
                jsx("h3", {
                  children: r.name,
                }),
                jsx("p", {
                  children: r.description,
                }),
                jsx("small", {
                  children: r.law,
                }),
                jsxs("strong", {
                  children: [r.doctrine, " \xB7 ", r.specialty],
                }),
              ],
            }),
          ],
        },
        r.id,
      ),
    ),
  });
}
export { App };
