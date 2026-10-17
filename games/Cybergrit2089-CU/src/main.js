import {
  ID,
  TITLE,
  BUILD,
  SOURCE,
  INPUT,
  WEAPONS,
  HACKS,
  UPGRADES,
  DIALOGUE,
  ENDINGS,
  MUSIC,
} from "./data.js";
import { World, DemoDirector } from "./world.js";
import { CityRenderer } from "./render.js";
import { SaveStore } from "./persistence.js";
import { registerAssets } from "./assets.js";
import { LEVELS } from "./level.js";

const E = globalThis.My3D2dge;
registerAssets(E);
const $ = (id) =>
  typeof document === "undefined" ? null : document.getElementById(id);
const text = (id, value) => {
  const el = $(id);
  if (el && el.textContent !== String(value)) el.textContent = value;
};
const show = (id, on) => {
  const el = $(id);
  if (el) el.hidden = !on;
};
export function createApp(options = {}) {
  const store = new SaveStore(options.storage);
  const app = {
    world: null,
    director: null,
    idleAt: 0,
    demoCycles: 0,
    demoRuns: [],
    pendingDemoAt: 0,
    radioUntil: 0,
    saveUntil: 0,
    perfSamples: [],
    lastHud: -1,
    lastPerf: -1,
  };
  const game = (app.game = new E.Game({
    canvas: "screen",
    id: ID,
    res: [640, 360],
    expand: true,
    view: "iso",
    views: ["iso"],
    input: INPUT,
    headless: options.headless,
    loop:
      options.loop ?? (typeof document !== "undefined" && !options.headless),
    fullscreen: "button",
    camera: { zoom: [0.75, 1.5], start: 1 },
    menu: {
      quit: "title",
      items: [
        ["District map", () => app.map()],
        ["Load checkpoint", () => app.startRun(true)],
      ],
      settings: [
        {
          key: "difficulty",
          label: "Difficulty",
          type: "select",
          options: ["Story", "Runner", "Edgerunner"],
          value: "Runner",
        },
        { key: "rain", label: "Rain effects", type: "toggle", value: true },
        { key: "hints", label: "Control prompts", type: "toggle", value: true },
      ],
      controls: {
        interact: "Interact / hold to breach",
        fire: "Fire",
        aim: "Precision aim",
        dash: "Dash",
        reload: "Reload",
        weapon: "Switch weapon",
        deck: "Neural deck",
        hack: "Quick short circuit",
        crouch: "Toggle crouch",
        heal: "Trauma patch",
        journal: "District map",
        start: false,
      },
    },
  }));
  app.now = () => (game.headless ? game.real : performance.now() / 1000);
  if (!game.headless) {
    const ua = navigator.userAgent;
    document.body.dataset.renderer =
      /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR)/.test(ua)
        ? "webkit"
        : "canvas";
  }
  // The supplied engine owns pause, settings, binding, focus navigation and fullscreen.
  const ui = (app.ui = new E.Shell(game, {
    theme: {
      ink: "#e9f1e7",
      paper: "#0e1b29ed",
      accent: "#dbf859",
      muted: "#adc2cb",
      danger: "#ff7e8d",
      line: "#6c8b9866",
      font: "Arial, sans-serif",
      titleFont: "Impact, Arial Narrow, sans-serif",
    },
    screens: {
      pause: {
        kicker: "SIGNAL HELD",
        title: "Take a breath.",
        text: () =>
          game.pauseReason === "controller"
            ? "Your controller disconnected. Reconnect it or use the keyboard to resume."
            : "Lowlight can wait.",
      },
      help: {
        kicker: "RUNNER FIELD GUIDE",
        title: "Make your own way.",
        sections: [
          [
            "01 / MOVE WITH INTENT",
            "Left stick moves. Right stick aims. R2 fires. A visible enemy is selected automatically when you fire without aiming. Crouching reduces your silhouette; buildings and cargo break sight.",
          ],
          [
            "02 / MAKE THE CITY WORK FOR YOU",
            "Cross interacts. Hold Cross at terminals to breach. L1 opens the neural deck; R1 casts Short circuit instantly. RAM regenerates. Short circuit is nonlethal and strips Warden armor.",
          ],
          [
            "03 / STAY ALIVE",
            "Circle dashes through fire. Square reloads. Triangle changes weapons. R3 uses a trauma patch. Iris can heal you and install implants. Yellow diamonds mark the contract.",
          ],
          [
            "04 / LEAVE A MARK",
            "Free Sable for a service passage and a peaceful archive override. Broadcast, sell or erase the archive. Then reach the extraction car. Checkpoints save at major decisions.",
          ],
        ],
        keys: [
          ["W A S D", "Move"],
          ["J / Mouse", "Fire"],
          ["E", "Interact / hold to breach"],
          ["Space", "Dash"],
          ["Tab / F", "Deck / short circuit"],
          ["Q / R / H", "Weapon / reload / heal"],
          ["C / M", "Crouch / district map"],
        ],
      },
    },
  }));
  const city = new CityRenderer(game);
  const originalCodeLabel = game.input.codeLabel.bind(game.input);
  game.input.codeLabel = (code) =>
    code === "Pad17"
      ? game.input.padStyle() === "playstation"
        ? "Touchpad"
        : originalCodeLabel("Pad8")
      : originalCodeLabel(code);
  game.input.touchEnabled = false;
  game.input.touchButtons([]);
  game.settings.set("touch", "off");
  if (!game.settings._raw.glyphs) game.input.glyphs = "playstation";
  game.fadeTime = 0.12;
  game.cam.smooth = 0.14;
  app.buildWorld = (opts = {}) => {
    app.world = new World(game, {
      difficulty: game.settings.difficulty,
      ...opts,
    });
    const w = app.world;
    w.bus.on("toast", ({ title, text }) => ui.toast(title, text, 3.5));
    w.bus.on("dialogue", () => {
      if (!w.demo) app.dialogue();
    });
    w.bus.on("shop", () => {
      if (!w.demo) app.shop();
    });
    w.bus.on("checkpoint", ({ data }) => {
      if (w.demo) return;
      if (store.write(data)) {
        app.saveUntil = game.real + 3;
        show("save-indicator", true);
      } else
        ui.toast(
          "SAVE UNAVAILABLE",
          store.error || "This run continues in memory.",
        );
    });
    w.bus.on("failed", () => {
      if (!w.demo) game.go("dead");
    });
    w.bus.on("complete", ({ result }) => {
      if (!w.demo) {
        store.best(result);
        store.clear();
        game.go("results");
      }
    });
    w.bus.on("objective", ({ stage }) => {
      if (!w.demo && stage === 2)
        app.radio(
          "Gate is green. Helix is ahead. Sable can help with the Warden — if you help her first.",
          7,
        );
    });
    return w;
  };
  app.title = () => {
    app.idleAt = app.now();
    game.timeScale = 1;
    game.resume();
    ui.hide();
    app.buildWorld();
    game.cam.offset = [130, 35];
    game.focus(224, 516, 26);
    game.cam.snap = true;
    const saved = store.read();
    ui.root?.querySelector(".esh-toast")?.classList.remove("on");
    ui.show(
      "title",
      (app.titleSpec = {
        kicker: "ONE DISTRICT. A THOUSAND STOLEN LIVES.",
        name: TITLE,
        subtitle: "2 0 8 9",
        back: () => {},
        text: "THE CITY KEEPS WHAT YOU OWE.\nTONIGHT, YOU TAKE SOMETHING BACK.",
        actions: [
          {
            label: saved ? "Continue contract" : "Enter Lowlight",
            primary: true,
            fn: () => app.startRun(!!saved),
          },
          ...(saved
            ? [
                [
                  "New contract",
                  () =>
                    ui.show("new-run", {
                      kicker: "A CLEAN SLATE",
                      title: "Start a new contract?",
                      text: "Your existing checkpoint will be replaced when you reach the next checkpoint.",
                      actions: [
                        ["Keep my checkpoint", () => ui.back()],
                        ["Start new contract", () => app.startRun(false)],
                      ],
                    }),
                ],
              ]
            : []),
          ["How to play", () => ui.show("help")],
          ["Settings", () => ui.show("settings")],
          ["Credits & source", () => app.about()],
        ],
        meta: ["DUALSENSE READY", "ISOMETRIC / ORIGINAL STORY"],
      }),
    );
    app.setMode("title");
    game.audio.stopMusic();
  };
  app.startRun = (resume = false, levelId = "lowlight") => {
    const saved = resume ? store.read() : null;
    ui.hide();
    game.resume();
    game.timeScale = 1;
    app.buildWorld({ level: LEVELS[saved?.level || levelId], saved });
    game.cam.offset = [0, 15];
    game.cam.snap = true;
    game.go("play");
    app.setMode("play");
    game.input.consumeAll();
    game.audio.music(MUSIC);
    if (!resume)
      app.radio(
        "Vex. Over here. Find me by the noodle bar. We have a city to disappoint.",
        6,
      );
  };
  app.startDemo = () => {
    ui.hide();
    game.resume();
    game.timeScale = 1;
    app.buildWorld({ demo: true });
    app.director = new DemoDirector(app.world, app.demoCycles);
    app.pendingDemoAt = 0;
    game.cam.offset = [0, 20];
    game.cam.snap = true;
    game.go("demo", null, { fade: 0 });
    app.setMode("demo");
    game.input.clear();
  };
  app.noteActivity = () => {
    app.idleAt = app.now();
    if (game.sceneName === "demo" || game._next?.name === "demo") {
      app.pendingDemoAt = 0;
      game.fadeTime = 0;
      ui.hide();
      game.input.clear();
      game.go("title");
      app.setMode("title");
      return true;
    }
    return false;
  };
  app.setMode = (mode) => {
    if (typeof document !== "undefined") document.body.dataset.mode = mode;
    show("hud", mode === "play" || mode === "demo");
    show("demo-badge", mode === "demo");
    for (const id of ["masthead", "title-location", "title-bottom"])
      show(id, mode === "title");
    if (mode === "title") {
      show("radio", false);
      show("save-indicator", false);
    }
  };
  app.radio = (message, seconds = 5) => {
    app.radioUntil = game.real + seconds;
    const p = $("radio")?.querySelector("p");
    if (p) p.textContent = message;
    show("radio", true);
  };
  app.dialogue = () => {
    const w = app.world,
      id = w.dialogue,
      d = w.level.dialogue[id];
    if (id === "shard") {
      ui.show("dialogue", {
        kicker: "ARCHIVED / PRIVATE MESSAGE",
        title: "Don’t forget the rain.",
        text: "“Ma, the procedure is tomorrow. They say I won’t miss what I can’t remember. If I come home different, play that old song. The one about the rain. — Sable”",
        actions: [
          [
            "Close archive",
            () => {
              w.choose(0);
              ui.hide();
            },
          ],
        ],
        back: () => {
          w.dialogue = null;
          ui.hide();
        },
      });
      return;
    }
    if (!d) return;
    ui.show("dialogue", {
      kicker: d.role,
      title: d.name,
      text: d.text,
      actions: d.choices.map((label, i) => ({
        label,
        fn: () => {
          ui.hide();
          const ok = w.choose(i);
          if (ok && d.replies?.[i]) app.radio(d.replies[i], 6);
        },
      })),
      back: () => {
        w.dialogue = null;
        ui.hide();
      },
    });
    if (ui.root) {
      const box = ui.root.querySelector(".esh-mod"),
        rig = w.npcs.find((n) => n.id === id)?.rig || w.player.rig;
      const cv = document.createElement("canvas");
      cv.className = "dialogue-portrait";
      cv.width = cv.height = 80;
      box.prepend(cv);
      rig.drawPortrait(cv.getContext("2d"), 1, 1, 78, {
        frame: false,
        bg: "#182e3d",
        zoom: 3,
        weapon: false,
      });
    }
  };
  app.shop = () => {
    const w = app.world,
      p = w.player;
    ui.show("shop", {
      kicker: "IRIS / STREET CLINIC",
      title: "Better than yesterday.",
      text: `${p.credits} credits available. One installation per implant.`,
      actions: [
        ...UPGRADES.map((u) => ({
          label: `${p.upgrades.includes(u.id) ? "INSTALLED" : u.cost + " CR"} / ${u.name} — ${u.text}`,
          disabled: p.upgrades.includes(u.id) || p.credits < u.cost,
          fn: () => {
            w.purchase(u.id);
            app.shop();
          },
        })),
        ["Back to the street", () => ui.hide()],
      ],
      back: () => ui.hide(),
    });
  };
  app.deck = () => {
    const w = app.world,
      p = w.player,
      t = w.selectTarget();
    ui.show("deck", {
      kicker: `NEURAL DECK / ${Math.floor(p.ram)} OF ${p.maxRam} RAM`,
      title: "Rewrite the odds.",
      text: t
        ? `Linked: ${t.kind === "boss" ? "The Warden" : "Helix security"} · ${Math.round(Math.hypot(t.x - p.x, t.y - p.y) / 8)} m`
        : "No visible network target. Optic cloak remains available.",
      actions: [
        ...HACKS.map((h) => ({
          label: `${h.cost} RAM / ${h.name} — ${h.text}`,
          disabled: p.ram < h.cost || (h.id !== "cloak" && !t),
          fn: () => {
            ui.hide();
            w.hack(h.id);
          },
        })),
        ["Close neural deck", () => ui.hide()],
      ],
      back: () => ui.hide(),
    });
  };
  app.map = () => {
    const w = app.world;
    ui.show("map", {
      kicker: "LOWLIGHT / DISTRICT 06",
      title: "Ghost Dividend",
      text: w.objective().text,
      map: w.map,
      at: w.player,
      labels: [
        ["MARKET", 200, 600],
        ["CLINIC", 120, 440],
        ["SABLE", 296, 176],
        ["RELAY", 480, 448],
        ["HELIX", 720, 232],
        ["TRANSIT", 780, 560],
      ],
      markers: [
        { ...w.objectivePoint(), kind: "diamond", color: "#dbf859" },
        ...w.interactables
          .filter((i) => i.kind === "npc")
          .map((i) => ({ ...i, kind: "dot", color: "#70edd6" })),
      ],
      actions: [["Back to the street", () => ui.hide()]],
      back: () => ui.hide(),
    });
  };
  app.about = () =>
    ui.show("about", {
      kicker: "CYBERGRIT 2089-CU / ORIGINAL VERTICAL SLICE",
      title: "Built after hours.",
      text: `SOURCE INFORMATION\nInitial date: ${SOURCE.initialDate}\nInspiration: ${SOURCE.source}\nEngine: ${SOURCE.engine}\nHandoff: ${SOURCE.handoff}\nEnvironment: ${SOURCE.environment}\nModel: ${SOURCE.model}\n\nAll story, characters, architecture, music and game art are original procedural work. Engine © 2026 Michael Crosato (MIT). Title drawn randomly from 50 candidates.\n\nEngine evaluation is documented separately in docs/ENGINE-EVALUATION.md.`,
      actions: [["Back", () => ui.back()]],
    });
  app.playerActions = () => {
    const I = game.input,
      p = app.world.player,
      move = game.view.screenDirToGround(...I.move());
    let aim = null;
    if (I.padAim) {
      const d = game.view.screenDirToGround(...I.padAim);
      aim = Math.atan2(d[1], d[0]);
    } else if (I.lastDevice === "mouse" && I.mouse.active) {
      const q = game.mouseGround();
      if (q) aim = Math.atan2(q[1] - p.y, q[0] - p.x);
    }
    if (I.pressed("deck")) {
      app.deck();
      return {};
    }
    if (I.pressed("journal")) {
      app.map();
      return {};
    }
    return {
      move,
      aim,
      aimHeld: I.down("aim"),
      fire: I.down("fire"),
      dash: I.pressed("dash"),
      reload: I.pressed("reload"),
      weapon: I.pressed("weapon"),
      crouch: I.pressed("crouch"),
      heal: I.pressed("heal"),
      hack: I.pressed("hack"),
      interact: I.pressed("interact"),
      interactHeld: I.down("interact"),
    };
  };
  app.maintenance = () => {
    // Runs from draw, including while the engine's standard menu pauses the scene.
    // Thus idle Settings/Controls screens also enter the kiosk loop after ten seconds.
    if (
      game.input.held.size > 0 ||
      game.input.padPrev.some(Boolean) ||
      game.input.padAxes.some((v) => Math.abs(v) > game.input.deadzone)
    )
      app.noteActivity();
    if (game.sceneName === "title" && !ui.screen && !game._fade && !game._next)
      ui.show("title", app.titleSpec);
    // The Shell's universal close button also cancels an in-world conversation.
    if (app.world?.dialogue && !app.world.demo && !ui.screen)
      app.world.dialogue = null;
    if (game.sceneName === "title" && app.now() - app.idleAt >= 10)
      app.startDemo();
    const remaining = Math.max(0, Math.ceil(10 - (app.now() - app.idleAt)));
    text("idle-clock", "LIVE DEMO IN " + remaining);
    if (typeof document !== "undefined")
      document.body.dataset.screen = ui.screen || "";
    show(
      "radio",
      game.real < app.radioUntil && !ui.screen && game.sceneName === "play",
    );
    if (typeof document !== "undefined")
      document.body.dataset.radio =
        game.real < app.radioUntil && !ui.screen && game.sceneName === "play"
          ? "true"
          : "false";
    if (game.real >= app.saveUntil) show("save-indicator", false);
    if (game.real - app.lastPerf > 0.5) {
      app.lastPerf = game.real;
      const ms = game.stats?.frameMs || 1000 / (game.fps || 60);
      text("fps", game.fps);
      text("frame-ms", ms.toFixed(1));
      app.perfSamples.push({
        fps: game.fps,
        ms,
        renderMs: game.stats?.renderMs || 0,
        scene: game.sceneName,
      });
      if (app.perfSamples.length > 600) app.perfSamples.shift();
    }
    if (game.real - app.lastHud > 0.15) {
      app.lastHud = game.real;
      app.hud();
    }
  };
  app.hud = () => {
    const w = app.world;
    if (!w) return;
    const playing = ["play", "demo"].includes(game.sceneName);
    show("hud", playing && !ui.screen);
    if (!playing || ui.screen) {
      ui.hud({});
      return;
    }
    const p = w.player,
      o = w.objective(),
      at = w.objectivePoint(),
      near = w.nearest(),
      weapon = WEAPONS[p.weapon];
    text(
      "mission-step",
      "GHOST DIVIDEND / " + String(w.stage + 1).padStart(2, "0"),
    );
    text("mission-title", o.title);
    text("mission-text", o.text);
    text(
      "mission-distance",
      Math.round(Math.hypot(at.x - p.x, at.y - p.y) / 8) + " M  ◇",
    );
    text("district", w.zone());
    text(
      "status",
      p.cloak > 0
        ? "OPTIC CLOAK / " + Math.ceil(p.cloak) + "s"
        : w.alert >= 1
          ? "HOSTILE SIGNAL"
          : w.alert > 0
            ? "SEARCH IN PROGRESS"
            : p.crouched
              ? "LOW PROFILE"
              : "SIGNAL / UNDETECTED",
    );
    text("health-value", Math.ceil(p.hp) + " / " + p.maxHp);
    if ($("health-bar"))
      $("health-bar").style.width = (p.hp / p.maxHp) * 100 + "%";
    text("ram-value", Math.floor(p.ram));
    const pp = $("ram-pips");
    if (pp) {
      const count = Math.floor(p.ram);
      if (pp.dataset.state !== count + "/" + p.maxRam) {
        pp.dataset.state = count + "/" + p.maxRam;
        pp.replaceChildren(
          ...Array.from({ length: p.maxRam }, (_, i) => {
            const x = document.createElement("i");
            if (i >= count) x.className = "off";
            return x;
          }),
        );
      }
    }
    text("meds", game.input.label("heal") + " / " + p.meds + " PATCHES");
    text("credits", "₡ " + p.credits);
    text("weapon-kind", weapon.kind);
    text("weapon-name", weapon.name);
    text("ammo", String(p.ammo[p.weapon]).padStart(2, "0"));
    text("reserve", "/ " + p.reserve);
    text(
      "reload-state",
      p.reloadTime > 0 ? "RELOADING" : game.input.label("weapon") + " SWITCH",
    );
    show("context", !!near);
    if (near) {
      text("context-key", game.input.label("interact"));
      text(
        "context-hint",
        ["relay", "core"].includes(near.id)
          ? "HOLD TO BREACH"
          : near.role.toUpperCase(),
      );
      text("context-label", near.name);
      if ($("channel-progress"))
        $("channel-progress").style.width =
          (w.channel?.progress || 0) * 100 + "%";
    }
    const strip = $("controls-strip");
    if (strip) {
      const device = game.input.lastDevice,
        signature = device + JSON.stringify(game.input.map);
      if (strip.dataset.device !== signature) {
        strip.dataset.device = signature;
        strip.replaceChildren(
          ...[
            ["fire", "Fire"],
            ["dash", "Dash"],
            ["deck", "Neural deck"],
            ["crouch", "Crouch"],
            ["reload", "Reload"],
            ["journal", "Map"],
          ].map(([key, label]) => {
            const span = document.createElement("span"),
              kbd = document.createElement("kbd");
            kbd.textContent = game.input.label(key);
            span.append(kbd, document.createTextNode(label));
            return span;
          }),
        );
      }
      strip.hidden = !game.settings.hints;
    }
    const boss = w.enemies.find((e) => e.kind === "boss");
    const showBoss =
      !boss.dead &&
      !boss.asleep &&
      Math.hypot(boss.x - p.x, boss.y - p.y) < 260;
    show("boss-hud", showBoss);
    if (showBoss && $("boss-hud"))
      $("boss-hud").querySelector("i").style.width =
        (boss.hp / boss.maxHp) * 100 + "%";
    ui.hud({
      minimap: {
        map: w.map,
        at: p,
        markers: [
          { ...at, kind: "diamond", color: "#dbf859" },
          ...w.enemies
            .filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 180)
            .map((e) => ({ ...e, kind: "dot", color: "#e98592" })),
        ],
      },
    });
  };
  const draw = (r, title = false) => {
    if (app.world)
      city.draw(r, app.world, { title, scan: ui.screen === "deck" });
    app.maintenance();
  };
  const scenes = {
    title: {
      view: "iso",
      touch: [],
      enter() {
        app.title();
      },
      update(dt) {
        if (game.headless) app.maintenance();
        app.world.update(dt, {});
        game.focus(240 + Math.sin(game.real * 0.07) * 12, 532, 28);
      },
      draw(r) {
        draw(r, true);
      },
    },
    play: {
      pausable: true,
      view: "iso",
      touch: [],
      enter() {
        game.fadeTime = 0.12;
        app.setMode("play");
      },
      update(dt) {
        if (ui.screen) return;
        const a = app.playerActions();
        if (ui.screen) return;
        app.world.difficulty = game.settings.difficulty;
        app.world.update(dt, a);
        const p = app.world.player;
        game.focus(p.x, p.y, 20);
      },
      draw,
    },
    demo: {
      pausable: false,
      view: "iso",
      touch: [],
      enter() {
        app.setMode("demo");
        game.fadeTime = 0.12;
      },
      update(dt) {
        const w = app.world;
        if (game.headless) app.maintenance();
        if (w.finished || w.failed) {
          if (!app.pendingDemoAt) {
            app.pendingDemoAt = game.real + 4;
            app.demoRuns.push({
              finished: w.finished,
              ...w.result(),
              events: [...new Set(w.bus.history.map((e) => e.type))],
            });
            if (app.demoRuns.length > 50) app.demoRuns.shift();
            ui.toast(
              w.finished ? ENDINGS[w.ending].title : "RECONNECTING",
              "Live demo continues automatically.",
              4,
            );
          }
          if (game.real >= app.pendingDemoAt) {
            app.demoCycles++;
            app.startDemo();
          }
          return;
        }
        const a = app.director.update(dt);
        w.update(dt, a);
        game.focus(w.player.x, w.player.y, 20);
      },
      draw,
    },
    dead: {
      enter() {
        app.setMode("dead");
        ui.show("dead", {
          kicker: "CONNECTION LOST",
          title: "The city hit back.",
          text: "Your last checkpoint is safe. Try a quieter route, visit Iris, or put the neural deck to work.",
          actions: [
            {
              label: store.read() ? "Load checkpoint" : "Try again",
              primary: true,
              fn: () => app.startRun(!!store.read()),
            },
            [
              "Return to title",
              () => {
                ui.hide();
                game.go("title");
              },
            ],
          ],
        });
      },
      draw,
    },
    results: {
      enter() {
        app.setMode("results");
        const w = app.world,
          result = w.result(),
          end = ENDINGS[w.ending];
        game.audio.music("victory");
        ui.show("results", {
          kicker: "CONTRACT CLOSED / GHOST DIVIDEND",
          title: end.title,
          text: end.text,
          emblem: "◇ " + String(result.score).padStart(4, "0") + " REP",
          stats: [
            [
              Math.floor(result.seconds / 60) +
                ":" +
                String(result.seconds % 60).padStart(2, "0"),
              "RUN TIME",
            ],
            [result.kills, "LETHAL"],
            [result.nonlethal, "NONLETHAL"],
            [result.credits, "CREDITS"],
          ],
          medals: [
            ["Sable rescued", result.savedSable],
            ["Clean hands", result.kills === 0],
            ["Ghost", result.detections === 0],
          ],
          actions: [
            {
              label: "Another night in Lowlight",
              primary: true,
              fn: () => app.startRun(false),
            },
            [
              "Return to title",
              () => {
                ui.hide();
                game.go("title");
              },
            ],
          ],
        });
      },
      draw,
    },
  };
  game.debug = {
    snapshot: () => ({
      scene: game.sceneName,
      paused: game.paused,
      screen: ui.screen,
      idle: app.now() - app.idleAt,
      demoCycles: app.demoCycles,
      engine: E.version,
      ...app.world?.snapshot(),
    }),
    perf: () => app.perfSamples,
    teleport(x, y) {
      Object.assign(app.world.player, { x, y, z: 0, vx: 0, vy: 0 });
      game.cam.snap = true;
    },
  };
  if (!game.headless) {
    for (const name of [
      "keydown",
      "keyup",
      "pointerdown",
      "pointerup",
      "pointermove",
      "wheel",
      "touchstart",
      "touchend",
    ])
      window.addEventListener(
        name,
        (event) => {
          const wasDemo = game.sceneName === "demo";
          app.noteActivity();
          if (wasDemo) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        { capture: true, passive: false, signal: game._abort.signal },
      );
    // The title's loading label is real; the engine does setup and the warm-up frame before removing it.
    game.booted.then(() => show("boot-message", false));
  }
  game.start({ scene: "title", scenes });
  show("boot-message", false);
  return app;
}

if (typeof document !== "undefined") {
  try {
    const app = createApp();
    globalThis.Cybergrit = app;
  } catch (error) {
    console.error(error);
    const el = $("boot-message");
    if (el) {
      el.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = "Unable to connect to Lowlight";
      const detail = document.createElement("p");
      detail.textContent = error.message;
      el.append(title, detail);
    }
  }
}
