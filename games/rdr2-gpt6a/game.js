/* Dust & Mercy: Cinder Valley. Original game, adapted from the my-3D2dge handoff template.
   Core loop: prepare, ride, read the trail, decide, rescue, return. Local engine changes are isolated in docs/engine-runtime.patch. */
(() => {
  "use strict";
  const E = My3D2dge,
    W = WesternWorld;
  const lifecycle = new DustRuntime.Lifecycle();
  const content = new DustRuntime.ContentIndex(DustContent);
  let actors = new Map();
  let randomStreams,
    campaign,
    dialogues,
    interactions,
    sequences,
    inventory,
    weapons,
    statuses,
    combat,
    meleeCombat,
    behaviors,
    mounts,
    activities,
    actions;
  E.VIEWS.frontier = new E.View(
    "frontier",
    "Frontier portrait",
    -25,
    42,
    1.12,
    1.05,
  );
  // Saves: the current envelope lives under SAVE; shipped v1 saves under
  // LEGACY_SAVE are read for migration and never overwritten. Preview and
  // scenario sessions use their own namespace, so they cannot touch either.
  const SAVE = "dust-mercy:save",
    LEGACY_SAVE = "dust-mercy:v1",
    VERSION = 1;
  const Saves = DustRuntime.Saves;
  const previewScenario =
    typeof location !== "undefined"
      ? new URLSearchParams(location.search).get("scenario")
      : null;
  let saveKey = previewScenario ? `dust-mercy:preview:${previewScenario}` : SAVE,
    orphans = {},
    migratedFrom,
    saveStatus = null;
  const touchDisplay =
    typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
  const bindings = DustRuntime.actionBindings(content);
  // Chapter screens (title, guide, tutorial, map, death, results) are content.
  const chapterPack = content.data.packs.find((p) => p.id === content.data.defaultChapter);
  const screens = chapterPack.records.find((r) => r.kind === "chapter");
  const fillLabels = (text) =>
    text.replace(/\{([a-z-]+)\}/g, (_, name) => game.input.label(name));
  const game = new E.Game({
    canvas: "screen",
    id: "dust-mercy",
    maxDpr: touchDisplay ? 1 : 3,
    res: [480, 300],
    portrait: { res: [288, 240] },
    expand: true,
    view: "threequarter",
    views: ["threequarter", "iso", "topdown", "brawler", "overhead"],
    input: bindings,
    fullscreen: "button",
    corner: true,
    menu: {
      controls: DustRuntime.actionLabels(content),
      settings: [
        {
          key: "difficulty",
          label: "Difficulty",
          options: ["Story", "Standard", "Hard"],
          value: "Standard",
          help: "Changes incoming damage; never blocks a story path.",
        },
        {
          key: "aimAssist",
          label: "Aim assistance",
          value: true,
          help: "Automatically aim at the nearest visible hostile. Turn off for mouse aim.",
        },
        { key: "hints", label: "Trail hints", value: true },
        {
          key: "visualDetail",
          label: "Visual detail",
          options: ["Automatic", "Full"],
          value: "Automatic",
          help: "Automatic keeps touch-screen play responsive. Full adds stronger character outlines.",
        },
        {
          key: "weather",
          label: "Weather",
          options: ["Changing", "Clear", "Rain"],
          value: "Changing",
        },
      ],
      items: () => [
        ["Map & journal", () => openMap()],
        ["Satchel", () => openSatchel()],
        ["Photo mode", () => photoMode()],
        game.sceneName === "play" && ["Tactics", () => openTactics()],
      ],
      quit: "title",
    },
  });
  const ui = new E.Shell(game, {
    settings: {
      onChange(settings, key) {
        if (key === "visualDetail")
          game.screen.setOptions({
            maxDpr: touchDisplay && settings.visualDetail !== "Full" ? 1 : 3,
          });
      },
    },
    theme: {
      ink: "#f0e9d9",
      paper: "#22251ded",
      accent: "#ddb775",
      muted: "#c1b399",
      danger: "#bb6553",
      line: "#8f7952",
      font: "Arial, sans-serif",
      titleFont: "Georgia, serif",
    },
    screens: {
      help: {
        kicker: screens.help.kicker,
        title: screens.help.title,
        sections: screens.help.sections.map((section) => [...section]),
        keys: [],
      },
    },
  });
  game.screen.setOptions({
    maxDpr: touchDisplay && game.settings.visualDetail !== "Full" ? 1 : 3,
  });
  const showScreen = ui.show.bind(ui);
  const hideScreen = ui.hide.bind(ui),
    screenOwners = new Map();
  ui.hide = () => {
    screenOwners.clear();
    return hideScreen();
  };
  ui.show = (name, spec = {}) => {
    const owner = {};
    screenOwners.set(name, owner);
    const own = (fn) =>
      typeof fn === "function"
        ? lifecycle.guard((...args) => {
            if (ui.screen === name && screenOwners.get(name) === owner)
              return fn(...args);
          })
        : fn;
    const result = showScreen(name, {
      ...spec,
      actions: spec.actions?.map((a) =>
        Array.isArray(a) ? [a[0], own(a[1])] : { ...a, fn: own(a.fn) },
      ),
      onPick: own(spec.onPick),
    });
    // Long informational screens start at their heading. The shell's default
    // action focus would scroll a small phone straight to the bottom button.
    if (name === "map" || name === "help") {
      const panel = ui.els?.scr?.querySelector(".esh-mod");
      if (panel && panel.scrollHeight > panel.clientHeight) {
        const heading = panel.querySelector("h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        panel.scrollTop = 0;
      }
    }
    return result;
  };
  const talk = new E.Dialog(game, {
    speed: 38,
    place: "bottom",
    bg: "#25281f",
    border: "#b79b65",
    nameColor: "#efd59d",
  });
  const disposeGame = game.dispose.bind(game);
  game.dispose = () => {
    lifecycle.dispose();
    closeTransient();
    disposeGame();
  };
  const shots = new E.Bullets(game, { plane: "ground", max: 120 });
  // Selected-motion sets by asset ID; the vendored WESTERN set is the default.
  const motionSets = new Map(
    typeof Mocap === "undefined"
      ? []
      : content.data.assets
          .filter((a) => a.kind === "motion" && globalThis.MOCAP?.[a.set])
          .map((a) => [a.id, Mocap.load(MOCAP[a.set])]),
  );
  const motion =
    typeof Mocap !== "undefined" ? Mocap.load(MOCAP.WESTERN) : null;
  const motionFor = (asset) => (asset && motionSets.get(asset)) || motion;
  let world,
    hero,
    horse,
    heroRig,
    doctor,
    npcs = [],
    foes = [],
    flow,
    spatial,
    checkpoint = null,
    state,
    near = null,
    mine,
    interiors = new Map(),
    frontier;
  let dustTimer = 0,
    saveTimer = 0,
    noise = null,
    lassoLine = null,
    toastFlags = new Set();
  let campMenu = null,
    photo = false,
    photoView = "threequarter",
    waypoint = null,
    lastHud = -1,
    flashTrail = 0;
  let musicName = "";
  // Music cues are content records; quests, regions and triggers name them.
  function regionSettings() {
    return content.get(world?.region || "cinder:valley", "region").settings || {};
  }
  function music(id) {
    id ||= regionSettings().music;
    if (musicName !== id) {
      musicName = id;
      const cue = content.byId.get(id);
      game.audio.music(cue?.kind === "cue" ? cue.config : null);
    }
  }
  function notify(title, text = "") {
    ui.toast(title, text, 4);
  }
  function once(id, title, text) {
    if (!toastFlags.has(id)) {
      toastFlags.add(id);
      notify(title, text);
    }
  }
  function closeTransient() {
    talk.close();
    talk.onDone = talk.onChoice = null;
    ui.hide();
    game.input.clear();
    shots.clear();
    meleeCombat?.cancel();
    for (const actor of actors.values()) {
      actor.action?.cancel();
      actor.action = null;
    }
    near = null;
    noise = null;
    lassoLine = null;
    campMenu = null;
    activities?.exit();
    actions?.clear();
    if (photo) game.setView(photoView);
    photo = false;
    state && (state.focusOn = false);
    game.timeScale = 1;
    game.audio.duck(false);
  }
  function clampStats() {
    for (const k of ["hp", "stamina", "focus", "core", "horseStamina"])
      state[k] = E.clamp(state[k], 0, 100);
    state.honor = E.clamp(state.honor, -100, 100);
    state.bond = E.clamp(state.bond, 0, 100);
  }
  function freshState() {
    return {
      version: VERSION,
      stage: 0,
      hp: 100,
      stamina: 100,
      focus: 100,
      core: 85,
      honor: 0,
      money: 18,
      mounted: false,
      tracking: false,
      focusOn: false,
      wanted: 0,
      bounty: 0,
      time: 0,
      elapsed: 0,
      weather: "clear",
      night: false,
      shots: 0,
      kills: 0,
      spared: 0,
      deaths: 0,
      medicine: false,
      rescued: false,
      negotiated: false,
      missionComplete: false,
      activities: {},
      discovered: [],
      collected: [],
      log: ["Marshal Bell sent word: the valley’s doctor is missing."],
    };
  }
  function initializeCampaign() {
    DustRuntime.bindLegacy(state, content);
    campaign = new DustRuntime.Campaign(content, {
      getState: () => state,
      onCommit: () => {
        weapons?.sync();
        frontier?.syncObjects();
      },
      activityAvailable: (id) => activities?.available(id),
      actors: () => actors,
      hero: () => hero,
      scene: () =>
        activeInterior()?.debug.definition.id ||
        content.get(world.region, "region").scene,
      effects: {
        "dialogue.open": (p) => dialogues.open(p.dialogue),
        "sequence.play": (p) => sequences.play(p.sequence),
        "law.report": (p) => frontier.report(p),
        "shop.open": (p) => openStore(p.shop),
        "activity.open": (p) => activities.open(p.activity),
        notify: (p) => notify(p.title, p.text || ""),
        sound: (p) => game.audio.sfx(p.cue),
        save: save,
        end: () => game.go("end"),
        "trail.reveal": (p) => {
          state.tracking = true;
          flashTrail = p.seconds;
        },
        "screen.open": (p) =>
          ({
            law: openLaw,
            store: openStore,
            cards: () =>
              activities.open(
                content.list("activity").find((a) => a.handler.op === "cards")
                  .id,
              ),
            camp: openCamp,
            satchel: openSatchel,
          })[p.screen](),
      },
    });
    inventory = new DustRuntime.Inventory(campaign);
    weapons = new DustRuntime.Weapons(campaign, hero.archetype.weapon, {
      onReload: () => game.audio.sfx("confirm", { vol: 0.25 }),
      onEquip: (weapon) => {
        heroRig.o.weapon =
          content.get(weapon.presentation, "presentation").renderer.params
            ?.weapon || "gun";
      },
    });
    statuses = new DustRuntime.StatusEffects(campaign);
    combat = new DustRuntime.Combat(campaign, statuses, {
      hero: () => hero,
      body: (target) =>
        target.id === hero.id && activeInterior()
          ? activeInterior().debug.hero
          : target,
      difficulty: (target) =>
        target.id === hero.id
          ? { Story: 0.45, Standard: 1, Hard: 1.4 }[game.settings.difficulty] ||
            1
          : 1,
      onHit: onCombatHit,
      onDeath: onCombatDeath,
    });
    mounts = new DustRuntime.Mounts(E, campaign, {
      game,
      statuses,
      save,
      notify,
      actors: () => actors,
      hero: () => hero,
      map: () => world.map,
      onSelect: (actor) => {
        horse = actor;
      },
      onMounted: () => ui.tutorial(null),
    });
    behaviors = new DustRuntime.ActorBehaviors(E, campaign, {
      game,
      combat,
      statuses,
      motion,
      shots,
      once,
      actors: () => actors,
      hero: () => hero,
      map: () => world.map,
      flow: () => flow,
      noise: () => noise,
    });
    meleeCombat = new DustRuntime.Melee(E, campaign, {
      game,
      combat,
      hero: () => hero,
      targets: () => [...foes, ...(frontier?.objects.targets("melee") || [])],
      map: () => world.map,
      defaultProfile: () => hero.archetype.melee,
      hit: (target, amount, event) =>
        target.objectId
          ? frontier.objects.damage(
              target.id,
              combat.prepare({ source: hero, amount, type: "melee" }).damage,
              "melee",
            )
          : enemyHit(target, amount, event),
      save,
    });
    activities = new DustRuntime.Activities(campaign, {
      game,
      inventory,
      weapons,
      random: randomStreams,
      modal,
      close: closeModal,
      notify,
      save,
      openCamp,
      openShop: openStore,
      dialogue: (id) => dialogues.open(id),
      pickup: (definition) => {
        game.particles.glints(
          hero.x,
          hero.y,
          10,
          10,
          definition.handler.params.color || "#e7cf88",
        );
      },
      enterScene: (id) => enterInterior(id),
    });
    actions = new DustRuntime.PlayerActions(campaign, {
      game,
      inventory,
      notify,
      close: closeModal,
      talk: () => talk,
      sequence: () => sequences?.active,
      menu: () => ui.screen || campMenu,
      photo: () => photo,
      label: (definition) => {
        const op = definition.handler.op;
        if (op === "crouch" && hero.crouch) return "Stand up";
        if (op === "auto-sprint" && state.autoSprint) return "Stop running";
        const targetMount = definition.handler.params?.mount
          ? actors.get(definition.handler.params.mount)
          : op === "mount" && !state.mounted
            ? mounts.nearest() || horse
            : horse;
        const label = (definition.menuLabel || definition.label).replaceAll(
          "{mount}",
          targetMount.name,
        );
        if (op === "dynamite") {
          const profile = content.get(
            definition.handler.params?.profile || hero.archetype.throwable,
            "throwable",
          );
          return `${label} (${inventory.count(profile.item)})`;
        }
        return label;
      },
      touch: (definition) => {
        const op = definition.handler.op;
        if (op === "interact")
          return {
            label: activities.fishing ? "REEL" : near ? "USE" : "TALK",
            show: !!near || !!activities.fishing,
          };
        if (op === "jump") return { show: !state.mounted };
        if (op === "fire") return { label: "FIRE" };
      },
      handlers: {
        interact: () => interact(),
        fire: (_, { definition, source }) => {
          if (
            !state.mounted ||
            source === "menu" ||
            game.input.pressed(definition.input || definition.id)
          )
            fire();
        },
        reload,
        mount: (params) => mount(params.mount),
        care: (params) => care(params.mount),
        lasso,
        melee,
        dynamite: (params) => frontier.throwDynamite(params.profile),
        map: openMap,
        satchel: openSatchel,
        photo: photoMode,
        view: () => {
          game.nextView();
          notify("A different perspective", game.view.label || game.view.id);
        },
        focus: () => {
          state.focusOn = !state.focusOn && state.focus > 3;
          state.tracking = state.focusOn;
          state.activities.focus = true;
          game.audio.sfx("charge", { vol: 0.2, pitch: 0.5 });
        },
        dodge: () => {
          if (!state.mounted) {
            hero.dodge();
            state.stamina -= 9;
          }
        },
        crouch: (_, { source }) => {
          if (source === "menu" && state.mounted) mount();
          if (!state.mounted) hero.crouch = !hero.crouch;
        },
        jump: () => {
          actions.intent.jump = true;
        },
        sprint: () => {
          actions.intent.sprint = true;
        },
        "auto-sprint": () => {
          state.autoSprint = !state.autoSprint;
        },
      },
    });
    const oldRangeActive = state.rangeActive,
      oldRangeScore = state.rangeScore || 0,
      rangeId = content.list("activity").find((a) => a.legacyId === "range").id;
    if (!state.activityState[rangeId]) {
      const range = activities.range(rangeId);
      range.active = !!oldRangeActive;
      range.score = oldRangeScore;
      range.targets.forEach((t, i) => (t.alive = i >= oldRangeScore));
      if (oldRangeActive || oldRangeScore) state.activeRange = rangeId;
    }
    Object.defineProperty(state, "rangeActive", {
      enumerable: true,
      configurable: true,
      get: () => !!activities.activeRange?.state.active,
      set: (value) => {
        state.activeRange ||= rangeId;
        activities.range(state.activeRange).active = value;
      },
    });
    Object.defineProperty(state, "rangeScore", {
      enumerable: true,
      configurable: true,
      get: () => activities.activeRange?.state.score || 0,
      set: (value) => {
        state.activeRange ||= rangeId;
        activities.range(state.activeRange).score = value;
      },
    });
    if (state.collected.includes("herb"))
      state.rewardClaims["cinder:yarrow-patch"] = true;
    if (state.activities.grave) state.rewardClaims["cinder:memorial"] = true;
    interactions = new DustRuntime.Interactions(campaign, {
      hero: () => hero,
      actors: () => actors,
      map: () => world.map,
      region: () => "cinder:valley",
    });
    // Portal records: data-only doors into interior scenes, using the shared
    // interaction policy (reach, conditions, explanations).
    interactions.register("runtime:portals", {
      entries: () =>
        content.list("portal").map((portal) => {
          const from = content.get(portal.from, "location"),
            available = portal.when ? campaign.explain(portal.when) : { ok: true };
          return {
            id: `portal:${portal.id}`,
            entity: portal.id,
            portal,
            point: { x: from.x, y: from.y, z: from.z || 0, region: from.region },
            label: portal.name,
            radius: 32,
            height: 48,
            sight: false,
            availability: { ok: available.ok, reason: available.reason },
          };
        }),
      perform: (definition) => {
        const arrival = content.get(definition.portal.arrival, "location");
        enterInterior(definition.portal.to, {
          arrival: { x: arrival.x, z: arrival.z ?? 32 },
        });
        return { ok: true };
      },
    });
    interactions.register("runtime:corpse-loot", {
      entries: () => [
        ...(world.animals || []).map((a) => ({
          id: `animal:${a.id}`,
          legacyId: a.legacyId ? `animal:${a.legacyId}` : undefined,
          entity: a.id,
          loot: a.loot,
          point: {
            x: a.x,
            y: a.y,
            z: a.z,
            region: a.regionId || "cinder:valley",
          },
          label: `Gather ${a.name}`,
          radius: 32,
          height: 32,
          sight: true,
          availability: {
            ok: !a.alive && !state.collected.includes(a.id),
            reason: a.alive ? "The animal is still alive" : "Already collected",
          },
        })),
        ...foes
          .filter((f) => f.archetype.behavior.params?.loot)
          .map((f) => ({
            id: `loot:${f.id}`,
            entity: f.id,
            loot: f.archetype.behavior.params.loot,
            point: { x: f.x, y: f.y, z: f.z, region: f.regionId },
            label: "Recover supplies",
            radius: 32,
            height: 32,
            sight: true,
            availability: {
              ok: (!f.alive || f.bound) && !state.collected.includes(f.id),
              reason:
                f.alive && !f.bound
                  ? "The actor is still fighting"
                  : "Already collected",
            },
          })),
      ],
      perform: (definition) =>
        inventory.loot(
          definition.loot,
          `loot:${definition.entity.replaceAll(":", "/")}`,
          null,
          definition.entity,
        ),
    });
  }
  function enterDialogueScope() {
    dialogues = new DustRuntime.Dialogues(campaign, {
      game,
      talk,
      lifecycle,
      actors: () => actors,
      notify,
      say(actor, lines, options) {
        ui.tutorial(null);
        // The dialogue's pixel font has ASCII punctuation only.
        const plain = (text) =>
          String(text)
            .replace(/[‘’‛′]/g, "'")
            .replace(/[“”„″]/g, '"')
            .replace(/[–—―]/g, "-")
            .replace(/…/g, "...")
            .replace(/·/g, "-");
        talk.say(Array.isArray(lines) ? lines.map(plain) : plain(lines), {
          name: plain(actor.name),
          portrait: actor.rig,
          ...options,
          ...(options?.choices ? { choices: options.choices.map(plain) } : {}),
        });
        state.focusOn = false;
        game.timeScale = 1;
        game.input.clear();
      },
    });
  }
  function enterSequenceScope() {
    sequences = new DustRuntime.Sequences(campaign, {
      game,
      talk,
      lifecycle,
      actors: () => actors,
      dialogues: () => dialogues,
      map: () => world.map,
      notify,
      skipPressed: () => game.input.pressed("interact"),
      capture: () => ({
        view: game.view.id,
        offset: [...game.cam.offset],
        smooth: game.cam.smooth,
      }),
      prepare(definition) {
        ui.hide();
        ui.hud({});
        ui.tutorial(null);
        state.focusOn = false;
        game.timeScale = 1;
        game.input.touchSet("interact", "SKIP", true);
        notify(
          definition.name,
          `${game.input.label("interact")} skips this scene.`,
        );
      },
      restore(saved) {
        game.setView(saved.view);
        game.cam.offset = saved.offset;
        game.cam.smooth = saved.smooth;
        game.follow(hero, { z: 18, lead: 9 });
        game.timeScale = 1;
        lastHud = -1;
      },
    });
  }
  function activeInterior() {
    for (const interior of interiors.values())
      if (game.sceneName === interior.engineScene) return interior.instance;
    return null;
  }
  let resumeAt = null,
    scenarioSeed = null;
  function enterInterior(id, { save: persist = true, arrival = null } = {}) {
    const interior = interiors.get(id);
    if (!interior)
      throw new Error(`Scene ${id} has no installed interior template`);
    if (state.mounted) mount();
    closeModal();
    state.focusOn = false;
    game.timeScale = 1;
    const record = state.interiors?.[id] || {};
    // Set before switching: the engine may enter the scene synchronously.
    resumeAt = arrival;
    pendingInteriorSave =
      persist && interior.definition.savePolicy === "resume";
    game.go(interior.engineScene, {
      collected: { ...record.collected },
      barriers: { ...record.barriers },
    });
  }
  let pendingInteriorSave = false;
  // Interior rewards commit on voluntary exit, once per pickup claim. A failed
  // transaction leaves the pickup uncollected so it can be retried later.
  function commitInterior(result) {
    const definition = content.get(result.scene, "scene");
    state.interiors ||= {};
    const record = (state.interiors[result.scene] ||= {
      collected: {},
      barriers: {},
    });
    record.collected ||= {};
    record.barriers ||= {};
    Object.assign(record.barriers, result.barriers);
    record.visits = (record.visits || 0) + 1;
    for (const id of result.collected) {
      const pickup = definition.config.pickups.find((p) => p.id === id);
      const outcome = inventory.loot(
        pickup.loot,
        `interior:${result.scene}/${id}`.replaceAll(":", "/"),
      );
      if (outcome.ok) record.collected[id] = true;
      else notify("Supplies left behind", outcome.reason);
    }
    save();
    game.go("play");
  }
  function objective() {
    return (
      campaign?.objective() || {
        title: "The open trail",
        text: "The valley is yours to explore.",
        badge: "FRONTIER",
        at: null,
      }
    );
  }
  function encounterActive(actor) {
    return behaviors.encounterActive(actor);
  }
  function followerActive(actor) {
    return behaviors.followerActive(actor);
  }
  function openLaw() {
    modal("law", {
      kicker: "Marshal’s office",
      title: "Settle your debt",
      text: `Bounty: $${state.bounty}. Firing in town draws the law. Honor and the law are separate.`,
      actions: [
        {
          label: `Pay $${state.bounty}`,
          disabled: state.money < state.bounty,
          fn: () => {
            const result = campaign.run([
              { op: "law.settle" },
              { op: "save" },
              {
                op: "notify",
                params: {
                  title: "Debt settled",
                  text: "The law has a long memory.",
                },
              },
            ]);
            if (result.ok) closeModal();
            else notify("Debt remains", result.reason);
          },
        },
        ["Leave", closeModal],
      ],
    });
  }
  function createPeople() {
    const definitions = content
      .list("actor")
      .filter(
        (d) =>
          content.resolve(d.id).region === "cinder:valley" &&
          !["traveler", "law"].includes(
            content.get(d.archetype, "archetype").behavior.op,
          ),
      );
    const ordered = definitions.sort(
      (a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id),
    );
    actors = new Map(
      ordered.map((d) => [
        d.id,
        world.animals.find((a) => a.id === d.id) ||
          DustRuntime.createActor(E, content, d, motionFor, randomStreams),
      ]),
    );
    hero = [...actors.values()].find((a) => a.behavior === "player");
    heroRig = hero.rig;
    horse = [...actors.values()].find((a) => a.behavior === "mount");
    doctor = actors.get("cinder:vale");
    npcs = [...actors.values()].filter((a) =>
      ["speaker", "vendor", "witness"].includes(a.behavior),
    );
    foes = [...actors.values()].filter((a) => a.behavior === "patrol");
    for (const n of npcs)
      if (motion && (n.pose === "kneel" ? n.clips.kneel : n.clips.idle))
        n.rig.mocap = (n.motion || motion).sample(
          (n.motion || motion).clip(n.pose === "kneel" ? n.clips.kneel : n.clips.idle),
          0,
        );
  }
  function reset(saved = null) {
    lifecycle.reset(saved?.state?.simTime || 0);
    closeTransient();
    state = freshState();
    orphans = JSON.parse(JSON.stringify(saved?.orphans || {}));
    migratedFrom = saved?.migratedFrom;
    if (saved) {
      const s = JSON.parse(JSON.stringify(saved.state));
      Object.assign(state, s, {
        version: VERSION,
        mounted: false,
        focusOn: false,
        tracking: false,
      });
      state.activities = { ...(s.activities || {}) };
      state.collected = [...(s.collected || [])];
      state.log = [...(s.log || [])];
      state.discovered = [...(s.discovered || [])];
    }
    randomStreams = new DustRuntime.RandomStreams(
      scenarioSeed ?? 1887,
      state.randomStreams || {},
    );
    for (const a of world.animals) {
      const point = content.resolve(a.id);
      Object.assign(a, {
        x: point.x,
        y: point.y,
        z: point.z || 0,
        homeX: point.x,
        homeY: point.y,
        hp: a.stats.hp ?? 1,
        alive: true,
        vx: 0,
        vy: 0,
        vz: 0,
        phase: a.stats.phase || 0,
        facing: a.stats.facing || 0,
        behaviorState: {},
      });
    }
    createPeople();
    shots.clear();
    meleeCombat?.cancel();
    noise = null;
    campMenu = null;
    photo = false;
    toastFlags = new Set();
    triggerInside = new Set();
    if (saved) {
      const fields = [
        "x",
        "y",
        "z",
        "facing",
        "hp",
        "alive",
        "bound",
        "takedown",
        "following",
        "arrived",
        "cool",
        "wind",
        "death",
        "phase",
      ];
      for (const [id, record] of Object.entries(saved.actors || {})) {
        const actor = actors.get(id);
        if (actor)
          for (const key of fields)
            if (record[key] !== undefined) actor[key] = record[key];
      }
      if (saved.hero)
        Object.assign(hero, {
          x: saved.hero.x,
          y: saved.hero.y,
          z: saved.hero.z || 0,
        });
      if (!saved.state.mounts)
        Object.assign(horse, { x: hero.x + 30, y: hero.y + 10 });
      if (saved.foes) {
        const records = new Map(
          saved.foes.map((f, i) => [f.id || "foe" + i, f]),
        );
        for (const f of foes) {
          const data = records.get(f.id) || records.get(f.legacyId);
          if (data) Object.assign(f, { ...data, id: f.id });
        }
      }
      if (saved.doctor) Object.assign(doctor, saved.doctor);
    }
    if (saved?.animals)
      for (const a of world.animals || []) {
        const sa = saved.animals.find(
          (v) => v.id === a.id || v.id === a.legacyId,
        );
        if (sa) Object.assign(a, { ...sa, id: a.id });
      }
    initializeCampaign();
    if (saved?.state?.mounted) mounts.parkAfterReload();
    behaviors.hydrate(saved?.actors);
    frontier?.hydrate();
    clampStats();
    checkpoint = serialise();
    game.timeScale = 1;
    setBodyClass();
  }
  function serialise() {
    state.randomStreams = randomStreams.serialize();
    const inside = activeInterior(),
      resume = inside && inside.debug.definition.savePolicy === "resume";
    return Saves.envelope(snapshot(), content, {
      scene: resume
        ? inside.debug.definition.id
        : Saves.overworldScene(content),
      interior: resume
        ? { x: inside.debug.hero.x, z: inside.debug.hero.z }
        : undefined,
    });
  }
  function snapshot() {
    return {
      version: VERSION,
      orphans,
      ...(migratedFrom ? { migratedFrom } : {}),
      state: JSON.parse(JSON.stringify(state)),
      hero: { x: hero.x, y: hero.y, z: hero.z },
      doctor: { x: doctor.x, y: doctor.y, z: doctor.z },
      actors: behaviors.serialize(),
      foes: foes.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        z: f.z,
        hp: f.hp,
        alive: f.alive,
        bound: f.bound,
        takedown: !!f.takedown,
      })),
      animals: (world.animals || []).map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        alive: a.alive,
      })),
    };
  }
  // Read, migrate and validate the stored journey. The raw record is never
  // modified here; see saves.js for the schema and orphan policy.
  function readSave() {
    let raw = E.store.get(saveKey, null),
      key = saveKey;
    if (raw === null && saveKey === SAVE) {
      raw = E.store.get(LEGACY_SAVE, null);
      key = LEGACY_SAVE;
    }
    const result = Saves.load(raw, content);
    saveStatus = { ...result, key, raw: result.ok ? undefined : raw };
    return saveStatus;
  }
  function getSave() {
    const result = readSave();
    return result.ok ? result.save : null;
  }
  // Keep an unreadable save before anything replaces it.
  function backupUnreadable() {
    if (!saveStatus || saveStatus.ok || saveStatus.code === "empty") return;
    const key = `dust-mercy:backup:${saveStatus.key}:${Date.now()}`;
    E.store.set(key, saveStatus.raw);
    if (saveStatus.key === saveKey) E.store.remove(saveKey);
    saveStatus = { ok: false, code: "empty", backup: key };
  }
  function save() {
    if (!state || state.hp <= 0) return;
    checkpoint = serialise();
    backupUnreadable();
    const saved = E.store.set(saveKey, checkpoint);
    if (!saved)
      once(
        "storage",
        "Saving is unavailable",
        "This browser is blocking storage. Your checkpoint lasts for this visit.",
      );
    saveTimer = 0;
  }
  function setBodyClass() {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("playing", game.sceneName !== "title");
    document.body.classList.toggle("focus", state?.focusOn || false);
  }
  function titleScreen() {
    ui.hud({});
    ui.tutorial(null);
    setBodyClass();
    const saved = getSave();
    const unreadable = !saved && saveStatus && saveStatus.code !== "empty";
    ui.show("title", {
      kicker: screens.title.kicker,
      name: screens.title.name,
      subtitle: screens.title.subtitle,
      text: unreadable
        ? `${saveStatus.reason} Your saved data is kept: beginning again stores it as a backup first.`
        : screens.title.text,
      actions: [
        ...(saved ? [["Continue your journey", () => begin(saved)]] : []),
        [
          saved ? "Begin again" : screens.title.start,
          () =>
            saved
              ? ui.show("confirm", {
                  title: "Begin a new journey?",
                  text: "This replaces your saved chapter. Your settings stay with you.",
                  actions: [
                    ["Keep my journey", () => ui.back()],
                    ["Begin again", () => begin()],
                  ],
                })
              : begin(),
        ],
        ["Trail guide", () => help()],
        ["Settings", () => game.menu("settings")],
      ],
      meta: [...(screens.title.meta || [])],
    });
  }
  function begin(saved = null) {
    reset(saved);
    ui.hide();
    game.go("play");
    // A journey saved inside a resume-policy interior continues there.
    if (saved && saved.scene !== Saves.overworldScene(content) && interiors.has(saved.scene)) {
      enterInterior(saved.scene, { save: false, arrival: saved.interior || null });
    }
    if (saved && Object.keys(saved.orphans || {}).length)
      notify(
        "Some progress was set aside",
        "Part of this journey belongs to content that is no longer installed. It stays in your save.",
      );
    musicName = "";
    music();
    if (!saved) save();
    game.input.clear();
    if (!saved)
      ui.tutorial(
        screens.tutorial.title,
        typeof matchMedia === "function" &&
          matchMedia("(pointer:coarse)").matches
          ? screens.tutorial.touch
          : fillLabels(screens.tutorial.keyboard),
        12,
      );
    else ui.tutorial(null);
  }
  function help() {
    ui.o.screens.help.keys = [
      ["W A S D / stick", "Move"],
      [game.input.label("interact"), "Talk / interact"],
      [game.input.label("mount"), "Mount / dismount"],
      [game.input.label("attack"), "Fire / assisted aim"],
      [game.input.label("focus"), "Focus / reveal tracks"],
      [game.input.label("reload"), "Reload"],
      [game.input.label("jump"), "Jump / climb"],
      [game.input.label("crouch"), "Sneak / cover"],
      [game.input.label("lasso"), "Non-lethal lasso"],
      [game.input.label("melee"), "Melee / takedown"],
      [game.input.label("tonic"), "Drink tonic"],
      [game.input.label("map"), "Map & journal"],
    ];
    ui.show("help");
  }
  function modal(name, spec) {
    state.focusOn = false;
    game.timeScale = 1;
    game.audio.duck(true);
    ui.show(name, spec);
    game.input.clear();
  }
  function closeModal() {
    ui.hide();
    game.audio.duck(false);
    game.input.clear();
  }
  function say(name, lines, options = {}) {
    options = {
      ...options,
      onChoice: lifecycle.guard(options.onChoice),
      onDone: lifecycle.guard(options.onDone),
    };
    const p =
      npcs.find((n) => n.name === name)?.rig ||
      (name === "Dr. Ada Vale"
        ? doctor.rig
        : foes.find((f) => f.name === name)?.rig) ||
      heroRig;
    talk.say(lines, { name, portrait: p, ...options });
    state.focusOn = false;
    game.timeScale = 1;
    game.input.clear();
  }
  function results() {
    ui.tutorial(null);
    ui.hud({});
    music(regionSettings().endMusic);
    const results = screens.results,
      ending =
        results.endings.find((e) => !e.when || campaign.explain(e.when).ok) ||
        results.endings.at(-1);
    const shown = {
      elapsed: () =>
        Math.floor(state.elapsed / 60) + "m " + Math.floor(state.elapsed % 60) + "s",
      honor: () => state.honor,
      money: () => "$" + state.money,
      kills: () => state.kills,
      spared: () => state.spared,
    };
    ui.show("results", {
      emblem: results.emblem,
      kicker: results.kicker,
      title: ending.title,
      text: ending.text,
      stats: (results.stats || []).map((s) => [
        s.show ? shown[s.show]() : s.text,
        s.label,
      ]),
      medals: (results.medals || []).map((m) => [
        m.label,
        campaign.explain(m.when).ok,
      ]),
      actions: [
        [
          "Stay in the valley",
          () => {
            closeModal();
            game.go("play");
          },
        ],
        [
          "Return to title",
          () => {
            closeModal();
            game.go("title");
          },
        ],
      ],
    });
  }
  function defeated() {
    state.hp = 0;
    state.focusOn = false;
    game.timeScale = 1;
    game.go("dead");
  }
  function hurt(amount, event = {}) {
    return combat.apply({
      ...event,
      target: hero,
      amount,
      type: event.type || "hazard",
    });
  }
  function onCombatHit(event) {
    const { source, target, damage } = event;
    if (target.id === hero.id) {
      if (event.presentation === false) return;
      heroRig.kick?.(0.3);
      game.hitFx(hero.x, hero.y, hero.z + 18, {
        power: 0.4,
        damage: Math.round(damage),
        textScale: 1,
      });
      game.audio.sfx("hurt");
    } else if (target.behavior === "patrol") {
      target.mind.level = 1.2;
      game.hitFx(target.x, target.y, target.z + 18, {
        power: 0.55,
        damage: Math.round(damage),
        textScale: 1,
      });
      E.knockback(source || hero, target, 30, 0);
    }
  }
  function onCombatDeath({ source, target }) {
    if (target.id === hero.id) {
      defeated();
      return;
    }
    if (target.behavior === "patrol") {
      target.death = 0;
      if (source?.id === hero.id) {
        state.kills++;
        state.honor -= 6;
        state.activities.combat = true;
      }
      game.particles.bits(target.x, target.y, 10, 7, ["#76674c", "#bdab81"]);
      game.audio.sfx("die", { vol: 0.25 });
      save();
    } else if ((world.animals || []).includes(target)) {
      game.particles.bits(target.x, target.y, 5, 5, ["#a08759", "#60513e"]);
      notify(
        "A clean harvest",
        target.archetype.behavior.params.harvestText ||
          "Approach to gather the harvest.",
      );
    }
  }
  function interact(id = near?.id, force = false) {
    if (!id) return;
    const defined = interactions.has(id)
      ? [interactions.inspect(id, { ignoreReach: true })]
      : content
          .list("interaction")
          .filter((d) => d.legacyId === id)
          .map((d) => interactions.inspect(d.id, { ignoreReach: true }))
          .sort(
            (a, b) =>
              (b.definition.priority || 0) - (a.definition.priority || 0),
          );
    if (defined.length) {
      const chosen = defined.find((d) => d.available) || defined[0];
      const result = interactions.perform(chosen.id, { ignoreReach: force });
      if (!result.ok) notify("Not available", result.reason);
      return;
    }
  }
  function mount(id) {
    return mounts.toggle(id);
  }
  function care(id) {
    return mounts.care(id);
  }
  function openStore(id) {
    id ||= npcs
      .filter((n) => n.behavior === "vendor")
      .sort((a, b) => E.dist(hero, a) - E.dist(hero, b))[0]?.archetype.behavior
      .params.shop;
    const shop = content.get(id, "shop");
    modal("store", {
      kicker: shop.name,
      title: shop.title || shop.name,
      text: `$${state.money} in your purse. ${shop.description || ""}`,
      actions: [
        ...inventory.offers(id).map(({ offer, quote }) => ({
          label: offer.sellAll
            ? offer.label
                .replaceAll("{count}", quote.inputs[offer.sellAll])
                .replaceAll("{proceeds}", quote.proceeds)
            : offer.doneLabel &&
                (state.rewardClaims[`${id}/${offer.id}`] ||
                  (offer.when && !campaign.explain(offer.when).ok))
              ? offer.doneLabel
              : offer.label,
          disabled: !quote.ok,
          fn: () => {
            const result = inventory.buy(id, offer.id);
            if (!result.ok) notify("Cannot trade", result.reason);
            openStore(id);
          },
        })),
        ["Leave the store", closeModal],
      ],
    });
  }

  function openSatchel() {
    const items = inventory.list(),
      weapon = weapons.definition;
    modal("satchel", {
      kicker: `${hero.name}’s satchel`,
      title: "What you carry",
      text: `$${state.money} · ${weapon.name}: ${weapons.loaded}/${weapon.capacity} loaded\n${items
        .filter((i) => i.count > 0)
        .map((i) => `${i.name} ×${i.count}`)
        .join(" · ")}`,
      actions: [
        ...items
          .filter(
            (i) =>
              i.use?.length && (i.count > 0 || i.category === "consumable"),
          )
          .map((item) => {
            const equipped = content
              .list("weapon")
              .some((w) => w.item === item.id && w.id === weapon.id);
            return {
              label: equipped
                ? `${item.name} · equipped`
                : item.useLabel || `Use ${item.name}`,
              disabled: item.count < 1 || equipped,
              fn: () => {
                const result = inventory.use(item.id);
                if (!result.ok) notify("Cannot use item", result.reason);
                openSatchel();
              },
            };
          }),
        [
          `Care for ${horse.name}`,
          () => {
            care();
            closeModal();
          },
        ],
        ["Close satchel", closeModal],
      ],
    });
  }
  function openTactics() {
    modal("tactics", {
      kicker: "Choose your approach",
      title: "A steady hand",
      text: "Choose an action. The trail waits while you choose.",
      actions: [
        ...actions.tactics(),
        ["Trail guide", help],
        ["Back to the trail", closeModal],
      ],
    });
  }
  function openCamp(id) {
    id ||= content
      .list("activity")
      .filter((a) => a.handler.op === "camp")
      .sort(
        (a, b) =>
          E.dist(hero, content.resolve(a.at)) -
          E.dist(hero, content.resolve(b.at)),
      )[0]?.id;
    const definition = content.get(id, "activity"),
      p = definition.handler.params,
      rows = [];
    if (p.restEffects)
      rows.push({
        label: p.restLabel || "Rest",
        run: () =>
          campaign.run([
            ...p.restEffects,
            { op: "activity.complete", params: { activity: id } },
            { op: "save" },
          ]),
      });
    for (const group of p.groups || []) {
      const available = group.recipes.map((id) => content.get(id, "recipe"));
      const ingredients = [
        ...new Set(available.flatMap((r) => Object.keys(r.inputs))),
      ];
      rows.push({
        label: `${group.label} (${ingredients.reduce((n, id) => n + inventory.count(id), 0)})`,
        run: () => {
          const recipe = available.find((r) => inventory.quote(r).ok);
          return recipe
            ? inventory.craft(recipe.id, id)
            : { ok: false, reason: inventory.quote(available[0]).reason };
        },
      });
    }
    rows.push({ label: p.leaveLabel || "Leave", run: () => ({ ok: true }) });
    const menu = new E.Menu(
      game,
      rows.map((r) => r.label),
      {
        title: p.title || definition.name,
        x: "center",
        y: "center",
        onPick: lifecycle.guard((i) => {
          if (campMenu !== menu) return;
          const result = rows[i].run();
          if (result.ok) campMenu = null;
          else notify("Supplies needed", result.reason);
        }),
        onCancel: lifecycle.guard(() => {
          if (campMenu === menu) campMenu = null;
        }),
      },
    );
    campMenu = menu;
    campMenu.activityId = id;
    game.input.clear();
  }
  function openMap() {
    if (!world) return;
    const q = objective();
    modal("map", {
      kicker: screens.map.kicker,
      title: screens.map.title,
      text: q.title + " — " + q.text,
      map: world.map,
      at: hero,
      markers: markers(),
      labels: Object.values(world.locations)
        .filter((p) => p.mapLabel)
        .map((p) => [p.label.toUpperCase(), p.x, p.y]),
      onPick: (x, y) => {
        waypoint = { x, y, z: 0 };
        notify("Waypoint marked", "A white marker guides your ride.");
      },
      sections: [
        ["Journal", state.log.slice(-5).join("\n")],
        [
          "Frontier pursuits",
          Object.keys(state.activities)
            .filter((k) => k.includes(":") && state.activities[k])
            .map((k) => content.byId.get(k)?.name || k.split(":").at(-1))
            .join(" · ") || "The valley is waiting to be discovered.",
        ],
        [
          "Your standing",
          `Honor ${Math.round(state.honor)} · Bounty $${state.bounty} · ${horse.name}’s bond ${Math.round(state.bond)}/100`,
        ],
      ],
      actions: [
        ...content
          .list("quest")
          .filter(
            (q) => state.quests[q.id]?.active && q.id !== state.trackedQuest,
          )
          .map((q) => [
            `Track ${q.name}`,
            () => {
              campaign.run([
                { op: "quest.track", params: { quest: q.id } },
                { op: "save" },
              ]);
              openMap();
            },
          ]),
        ["Back to the trail", closeModal],
      ],
    });
  }
  function photoMode() {
    photo = true;
    photoView = game.view.id;
    game.timeScale = 0;
    modal("photo", {
      kicker: "A moment on the frontier",
      title: "The photographer’s eye",
      text: "Choose a lens and return to the viewfinder. Your browser’s screenshot command captures the scene. Escape opens the menu again.",
      actions: [
        ["Frontier portrait", () => photoLens("frontier")],
        ["Isometric", () => photoLens("iso")],
        ["Three-quarter", () => photoLens("threequarter")],
        ["Overhead", () => photoLens("overhead")],
        ["Low horizon", () => photoLens("brawler")],
        ["Side silhouette", () => photoLens("side")],
        ["Top-down", () => photoLens("topdown")],
        [
          "Turn camera 45°",
          () => {
            game.rotateView(45);
            photoFrame();
          },
        ],
        [
          "Return to the trail",
          () => {
            photo = false;
            game.timeScale = 1;
            game.setView(photoView);
            closeModal();
          },
        ],
      ],
    });
    game.timeScale = 0;
  }
  function photoLens(id) {
    game.setView(id);
    photoFrame();
  }
  function photoFrame() {
    closeModal();
    game.timeScale = 0;
    notify(
      "Photo mode",
      `${game.input.label("photo")} for lenses · ${game.input.label("interact")} to return to the trail.`,
    );
  }
  // Sprite presentations reference string/bitmap sprite assets.
  const sprites = new Map();
  function drawSprite(r, at, presentationId, bobScale = 1) {
    if (!presentationId) return;
    const params = content.get(presentationId, "presentation").renderer.params;
    if (!sprites.has(params.asset)) {
      const data = content.data.assets.find((a) => a.id === params.asset).data;
      sprites.set(
        params.asset,
        E.sprite([...data.rows], { ...data.colors }, (data.scale ?? 1) * (params.scale ?? 1)),
      );
    }
    r.sprite(
      at.x,
      at.y,
      (params.z || 0) + Math.sin(state.time * 2) * (params.bob || 0) * bobScale,
      sprites.get(params.asset),
      params.glowOnFocus ? { glow: state.focusOn ? 1 : 0 } : undefined,
    );
  }
  // Region triggers: authored areas that select music, weather, light or a
  // place label while the player is inside, and may run effects on entry.
  let triggerInside = new Set();
  function activeTrigger() {
    if (!hero || !world) return null;
    const triggers = world.definition.triggers || [];
    return (
      triggers.find((t) => triggerInside.has(t.id)) || null
    );
  }
  function updateTriggers() {
    const now = new Set();
    for (const trigger of world.definition.triggers || []) {
      const at = content.get(trigger.at, "location");
      if (
        E.dist(hero, at) < trigger.radius &&
        (!trigger.when || campaign.explain(trigger.when).ok)
      ) {
        now.add(trigger.id);
        if (!triggerInside.has(trigger.id) && trigger.enter?.length)
          campaign.run(trigger.enter, null, { trigger: trigger.id });
      }
    }
    triggerInside = now;
    return activeTrigger();
  }
  function placeLabel() {
    const trigger = activeTrigger(),
      labels = regionSettings().place || {};
    if (trigger?.place) return trigger.place;
    return state.weather === "rain"
      ? labels.rain
      : state.night
        ? labels.night
        : labels.day;
  }
  function rangeTargets() {
    return (
      activities?.activeRange?.state.targets ||
      activities?.range(
        content.list("activity").find((a) => a.legacyId === "range").id,
      ).targets ||
      []
    );
  }
  function targets() {
    const range = weapons.definition.range,
      policy = { policy: weapons.definition.targetPolicy || "unprotected" };
    const visible = (list) => {
      spatial.build(list);
      const nearby = [];
      spatial.near(hero.x, hero.y, range, (target) => nearby.push(target));
      return E.targets(hero, nearby, {
        range,
        arc: Math.PI,
        sight: world.map,
        dz: 60,
      }).map((entry) => entry.target);
    };
    if (
      activities.activeRange?.state.active &&
      E.dist(hero, activities.point(activities.activeRange.definition.id)) <
        (activities.activeRange.definition.handler.params.radius || 130)
    )
      return visible(rangeTargets().filter((target) => target.alive));
    const enemies = foes.filter(
      (target) => combat.canTarget(hero, target, policy).ok,
    );
    const threatening = visible(enemies.filter(encounterActive));
    if (threatening.some((target) => E.dist(hero, target) < range * 0.92))
      return threatening;
    const wildlife = visible(
      world.animals.filter(
        (target) => combat.canTarget(hero, target, policy).ok,
      ),
    );
    return wildlife.length ? wildlife : visible(enemies);
  }
  function fire() {
    if (weapons.cooldown > 0 || weapons.reloadRemaining > 0) return;
    if (state.ammo <= 0) {
      reload();
      return;
    }
    const shot = weapons.fire(state.focusOn);
    if (!shot) return;
    state.shots++;
    const weapon = shot.definition;
    const target =
      game.settings.aimAssist && weapon.assist !== false ? targets()[0] : null;
    let angle = hero.facing;
    if (game.input.padAim) {
      const a = game.view.screenDirToGround(...game.input.padAim);
      angle = Math.atan2(a[1], a[0]);
    } else if (target) angle = E.angleTo(hero, target);
    else if (game.input.lastDevice === "mouse") {
      const p = game.mouseGround();
      if (p) angle = Math.atan2(p[1] - hero.y, p[0] - hero.x);
    }
    hero.facing = angle;
    const damage = combat.prepare({
      source: hero,
      amount: shot.damage,
      type: "projectile",
      policy: weapon.targetPolicy || "unprotected",
    });
    shots.fire({
      x: hero.x + Math.cos(angle) * 10,
      y: hero.y + Math.sin(angle) * 10,
      z: hero.z + 20,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      r: weapon.radius,
      dmg: damage.damage,
      data: damage,
      life: weapon.life,
      team: "player",
      onWall: (bullet) => frontier.objects.hitWall(bullet),
      color: weapon.color || "#eeca7e",
    });
    game.particles.sparks(
      hero.x + Math.cos(angle) * 15,
      hero.y + Math.sin(angle) * 15,
      hero.z + 20,
      6,
      angle,
    );
    game.particles.smoke(hero.x, hero.y, hero.z + 22, 2, {
      size: 0.6,
      color: "#b4b0a0",
    });
    game.audio.sfx(weapon.cue || "shoot", { vol: 0.6, pitch: 0.9 });
    game.shake(0.7);
    noise = { x: hero.x, y: hero.y, z: hero.z, loud: 250, t: 0.3 };
    frontier.gunfire(hero);
  }
  function reload() {
    if (
      weapons.reloadRemaining > 0 ||
      weapons.loaded >= weapons.definition.capacity
    )
      return;
    if (!weapons.reload()) {
      notify(
        "Out of cartridges",
        "Buy ammunition or recover supplies on the trail.",
      );
      return;
    }
    game.audio.sfx("select", { pitch: 0.6 });
  }
  function lasso() {
    const t = E.targets(
      hero,
      foes.filter((f) => f.alive && !f.bound),
      { range: 85, arc: Math.PI, sight: world.map },
    )[0]?.target;
    if (!t) {
      notify("No one in reach", "Move within lasso range of a raider.");
      return;
    }
    t.bound = true;
    t.mind.reset();
    state.honor += 3;
    state.spared++;
    state.activities.lasso = true;
    lassoLine = { x: t.x, y: t.y, z: 14, t: 0.6 };
    game.audio.sfx("whoosh");
    game.particles.text(t.x, t.y, 35, "BOUND", "#daca91");
    save();
  }
  function melee(params = {}) {
    return meleeCombat.strike(params.profile);
  }
  function enemyHit(target, amount, event = {}) {
    return combat.apply({
      ...event,
      target,
      amount,
      source: event.source || hero,
      type: event.type || "melee",
    });
  }
  function nearestInteraction() {
    return interactions?.nearest() || null;
  }
  function updateAI(dt) {
    const fighting = behaviors.update(dt);
    const trigger = activeTrigger();
    music(
      fighting
        ? regionSettings().dangerMusic
        : trigger?.music || objective().music || regionSettings().music,
    );
  }
  function update(dt) {
    setBodyClass();
    actions.syncTouch();
    if (photo) {
      if (game.input.pressed("photo")) photoMode();
      if (game.input.pressed("interact")) {
        photo = false;
        game.timeScale = 1;
        game.setView(photoView);
      }
      return;
    }
    if (ui.screen) return;
    if (sequences?.update(dt)) return;
    if (campMenu) {
      campMenu.update(dt);
      return;
    }
    if (dialogues ? dialogues.update(dt) : talk.update(dt)) {
      ui.hud({});
      game.audio.duck(true);
      return;
    }
    game.audio.duck(false);
    if (activities.fishing) {
      activities.updateFishing(dt);
      hud();
      return;
    }
    const I = game.input;
    actions.beginFrame();
    if (actions.run("overlay")) return;
    actions.run("preflight");
    game.timeScale = state.focusOn ? 0.34 : 1;
    const realDt = state.focusOn ? dt / 0.34 : dt;
    lifecycle.update(dt);
    campaign.updateQuests();
    state.simTime = lifecycle.time;
    state.time += dt;
    state.elapsed += realDt;
    const climate = regionSettings(),
      trigger = updateTriggers();
    state.night =
      state.time % (climate.dayLength ?? 480) > (climate.nightStart ?? 310);
    state.weather =
      game.settings.weather === "Rain"
        ? "rain"
        : game.settings.weather === "Clear"
          ? "clear"
          : trigger?.weather ||
            (climate.weather === "rain"
              ? "rain"
              : climate.weather === "clear"
                ? "clear"
                : Math.floor(state.time / (climate.weatherPeriod ?? 90)) % 3 === 1
                  ? "rain"
                  : "clear");
    weapons.update(dt);
    statuses.update(dt);
    combat.update(dt);
    flashTrail = Math.max(0, flashTrail - dt);
    saveTimer += dt;
    if (lassoLine) {
      lassoLine.t -= dt;
      if (lassoLine.t <= 0) lassoLine = null;
    }
    if (noise) {
      noise.t -= dt;
      if (noise.t <= 0) noise = null;
    }
    actions.run("beforeMove");
    const [mx, my] = I.move(),
      [dx, dy] = game.view.screenDirToGround(mx, my);
    const run =
      (actions.intent.sprint || state.autoSprint) &&
      (state.mounted ? state.horseStamina : state.stamina) > 3;
    const speedModifier =
      statuses.multiplier("speed") *
      (state.mounted ? statuses.multiplier("speed", horse.id) : 1);
    hero.run =
      (state.mounted ? mounts.speed(false) : hero.stats.run) * speedModifier;
    hero.sprintSpeed =
      (state.mounted ? mounts.speed(true) : hero.stats.sprintSpeed) *
      speedModifier;
    hero.update(dt, world.map, {
      move: [dx, dy],
      sprint: run,
      crouch: hero.crouch,
      jumpPressed: !!actions.intent.jump,
    });
    hero.x = E.clamp(hero.x, 28, world.map.w * 16 - 28);
    hero.y = E.clamp(hero.y, 28, world.map.h * 16 - 28);
    if (hero.landed) {
      game.particles.ring(hero.x, hero.y, 2, 16, "#c3ae7b", 0.35);
      game.audio.sfx("land", { vol: 0.16 });
    }
    if (hero.hurt) hurt(12);
    if (hero.inHazard) {
      hero.respawn();
      hurt(10);
    }
    const moving = Math.hypot(hero.vx, hero.vy) > 10;
    state.stamina += (!state.mounted && run && moving ? -12 : 8) * realDt;
    mounts.resources(realDt, run, moving);
    state.core -= realDt * 0.014;
    if (state.core > 10 && combat.remaining() <= 0) state.hp += realDt * 0.45;
    state.focus += state.focusOn ? -realDt * 13 : realDt * 2;
    if (state.focus <= 0) {
      state.focusOn = false;
      state.tracking = false;
      game.timeScale = 1;
    }
    frontier.update(dt);
    if (moving) {
      dustTimer += dt;
      if (dustTimer > (state.mounted ? 0.15 : 0.26)) {
        dustTimer = 0;
        game.particles.dust(hero.x, hero.y, 0, state.mounted ? 3 : 1);
        const steps = regionSettings().footsteps || {};
        game.audio.sfx(state.mounted ? steps.ride || "step" : steps.walk || "step", {
          vol: state.mounted ? 0.25 : 0.035,
          pitch: state.mounted ? 0.5 : 0.8,
        });
      }
    }
    actions.run("attack");
    meleeCombat.update(dt);
    shots.update(dt, world.map);
    frontier.objects.hitProjectiles(shots);
    shots.hit(
      foes,
      (b, f) => enemyHit(f, b.dmg, b.data || { type: "projectile" }),
      "player",
    );
    shots.hit(
      [hero],
      (b) => hurt(b.dmg, b.data || { type: "projectile" }),
      "enemy",
    );
    shots.hit(
      (world.animals || []).filter((a) => a.alive),
      (b, a) =>
        combat.apply({
          ...b.data,
          source: hero,
          target: a,
          amount: b.dmg,
          type: "projectile",
        }),
      "player",
    );
    if (activities.activeRange?.state.active)
      shots.hit(rangeTargets(), (b, t) => activities.hitRange(t), "player");
    mounts.update(dt);
    updateAI(dt);
    clampStats();
    if (motion && hero.clips.reload) {
      const set = hero.motion || motion;
      heroRig.mocap =
        weapons.reloadRemaining > 0
          ? set.sample(
              set.clip(hero.clips.reload),
              weapons.definition.reload - weapons.reloadRemaining,
            )
          : null;
      heroRig.mocapMask = "upper";
      heroRig.mocapW =
        weapons.reloadRemaining > 0
          ? Math.min(
              1,
              (weapons.definition.reload - weapons.reloadRemaining) * 8,
              weapons.reloadRemaining * 8,
            )
          : 0;
    }
    if (previewClip) {
      previewClip.t += dt;
      heroRig.mocap = previewClip.set.sample(previewClip.clip, previewClip.t);
      heroRig.mocapMask = null;
      heroRig.mocapW = 1;
      if (previewClip.t > previewClip.clip.dur + 0.5) previewClip = null;
    }
    heroRig.update(dt, {
      ...hero.rigState(),
      vx: state.mounted ? 0 : hero.vx,
      vy: state.mounted ? 0 : hero.vy,
      pose: state.mounted ? "kneel" : hero.crouch ? "crouch" : null,
      point: weapons.cooldown > 0.1,
      attack: meleeCombat.state,
      hurt: combat.remaining() > 0.35,
    });
    near = nearestInteraction();
    actions.run("interact");
    for (const [name, p] of Object.entries(world.locations)) {
      if (E.dist(hero, p) < 65 && !state.discovered.includes(name)) {
        state.discovered.push(name);
        if (p.discoverNote) notify("A place worth remembering", p.discoverNote);
      }
    }
    if (
      saveTimer > 45 &&
      state.wanted === 0 &&
      !foes.some((f) => f.mind.state === "alert")
    )
      save();
    game.focus(hero.x, hero.y, 18);
    hud();
  }
  function markers() {
    const q = objective(),
      at = q.at;
    return [
      ...(at ? [{ ...at, kind: "diamond", color: "#edc77b" }] : []),
      ...mounts
        .list()
        .map((a) => ({ x: a.x, y: a.y, kind: "dot", color: "#dadbc1" })),
      ...[...actors.values()]
        .filter((a) => a.behavior === "follower" && followerActive(a))
        .map((a) => ({ x: a.x, y: a.y, kind: "ring", color: "#b5daa5" })),
      ...(waypoint ? [{ ...waypoint, kind: "cross", color: "#ffffff" }] : []),
    ];
  }
  function hud() {
    const fishing = activities.fishing;
    if (game.real - lastHud < 0.12 && !game.headless) return;
    lastHud = game.real;
    const q = objective(),
      at = q.at;
    const danger = foes.some(
      (f) => f.alive && !f.bound && f.mind.state === "alert",
    );
    ui.hud({
      objective: {
        step: q.badge || q.name || "FRONTIER",
        title: q.title,
        text: q.text,
        at,
        from: hero,
      },
      status: {
        text:
          state.wanted > 0
            ? "WANTED · LEAVE TOWN"
            : danger
              ? "UNDER FIRE"
              : state.focusOn
                ? "FOCUS"
                : hero.crouch
                  ? "KEEPING LOW"
                  : state.mounted
                    ? horse.name.toUpperCase() +
                      " · " +
                      Math.round(state.bond) +
                      " BOND"
                    : "ON THE TRAIL",
        color: danger || state.wanted ? "#e19a78" : "#d7b97a",
      },
      bars: [
        {
          label: "Health",
          value: Math.round(state.hp),
          max: 100,
          color: "#cba581",
        },
        {
          label: state.mounted ? `${horse.name}’s stamina` : "Stamina",
          value: Math.round(state.mounted ? state.horseStamina : state.stamina),
          max: 100,
          color: "#a4b88b",
        },
        {
          label: "Focus",
          value: Math.round(state.focus),
          max: 100,
          color: "#dbba6b",
        },
        {
          label:
            weapons.reloadRemaining > 0
              ? "Reloading…"
              : weapons.definition.name,
          value: weapons.loaded,
          max: weapons.definition.capacity,
          kind: weapons.definition.capacity <= 7 ? "pips" : "bar",
          color: "#dfcbaa",
        },
      ],
      counts: [
        [content.get(weapons.definition.ammo, "item").name, weapons.reserve],
        ["Purse", "$" + state.money],
      ],
      prompt: fishing
        ? {
            act: "interact",
            label:
              fishing.phase === "waiting"
                ? "Wait for a bite…"
                : "Reel in the gold band",
            hint: "STILLWATER FISHING",
          }
        : near
          ? { act: "interact", label: near.label, hint: "ON THE TRAIL" }
          : null,
      place: placeLabel(),
      keys: [
        [game.input.label("interact"), "Interact"],
        [game.input.label("mount"), "Horse"],
        [game.input.label("focus"), "Focus"],
        [game.input.label("map"), "Map"],
        [game.input.label("pause"), "Pause"],
      ],
      buttons: [
        ["Map", openMap],
        ["Satchel", openSatchel],
        ["Tactics", openTactics],
      ],
      minimap: {
        map: world.map,
        at: hero,
        markers: markers(),
        onClick: openMap,
      },
    });
    actions.syncTouch();
  }
  function draw(r) {
    const fishing = activities.fishing;
    W.draw(r, game, world, state, { heat: true });
    frontier?.draw(r);
    if (state.focusOn || flashTrail > 0) {
      // Revealed tracks are region trail definitions, optionally conditional.
      const trails = (world.definition.trails || []).filter(
        (trail) => !trail.when || campaign.explain(trail.when).ok,
      );
      r.decal((g) => {
        for (const trail of trails)
          for (let i = 0; i < trail.points.length - 1; i++) {
            const { x: ax, y: ay } = trail.points[i],
              { x: bx, y: by } = trail.points[i + 1],
              d = Math.hypot(bx - ax, by - ay);
            for (let t = 0; t < 1; t += trail.spacing / d) {
              const x = E.lerp(ax, bx, t),
                y = E.lerp(ay, by, t),
                p = r.w(x, y, 1);
              E.px.ell(g, p[0], p[1], 2, 1, trail.color);
            }
          }
      });
    }
    const liveActors = [
      ...npcs,
      ...[...actors.values()].filter((a) => a.behavior === "follower"),
      ...foes,
    ];
    for (const n of liveActors) {
      if (!r.visible(n.x, n.y, n.z || 0, 60, 80, 60)) continue;
      r.shadow(n.x, n.y, 6, 0.32);
      W.drawCowboy(r, E, n, n.rig, {
        xray: false,
        every: n.id && npcs.includes(n) ? 2 : 1,
        key: n.rig,
      });
      if (n.bound) r.textAt(n.x, n.y, 40, "BOUND", "#dcca9e");
      if (
        n.mind &&
        n.alive &&
        !n.bound &&
        encounterActive(n) &&
        (state.focusOn || hero.crouch)
      )
        r.sightCone(n, {
          map: world.map,
          range: n.stats.sight ?? 140,
          fov: n.stats.fov ?? 1.8,
          color: n.mind.state === "alert" ? "#bc6044" : "#caa660",
          alpha: 0.12,
        });
    }
    for (const actor of mounts.list())
      W.drawHorse(r, E, actor, {
        mounted: state.mounted && actor === horse,
        bond: mounts.record(actor).bond,
        t: state.time,
      });
    r.shadow(
      hero.x,
      hero.y,
      state.mounted ? 13 : 7,
      0.38,
      undefined,
      hero.groundZ || 0,
    );
    W.drawCowboy(r, E, hero, heroRig, {
      mounted: state.mounted,
      mountSize: horse.appearance?.size || 1,
      xray: { color: "#e2cf94", outline: "#f2e4b9", actors: true },
      flash: combat.remaining() > 0.35 ? "#eee4c7" : undefined,
      ghost:
        state.focusOn &&
        Math.hypot(hero.vx, hero.vy) > 10 &&
        Math.floor(game.time * 15) !== hero.lastGhostFrame
          ? ((hero.lastGhostFrame = Math.floor(game.time * 15)),
            { color: "#d1b273", life: 0.15, alpha: 0.2, owner: hero })
          : undefined,
    });
    heroRig.drawSmear(r);
    const q = objective(),
      at = q.at;
    if (game.settings.hints && at)
      r.marker(at.x, at.y, 50, {
        label: q.markerLabel || "TRAIL",
        color: "#f2d28f",
      });
    if (waypoint)
      r.marker(waypoint.x, waypoint.y, 35, {
        label: "WAYPOINT",
        color: "#edead9",
      });
    for (const follower of actors.values())
      if (follower.behavior === "follower" && followerActive(follower))
        r.marker(follower.x, follower.y, 48, {
          label:
            follower.archetype.behavior.params?.markerLabel || follower.name,
          color: "#bfd9a6",
        });
    if (near && !fishing) r.groundRing(near.x, near.y, 16, "#e5c183", 0.5);
    for (const t of activities
      .ranges()
      .flatMap((d) => activities.range(d.id).targets))
      if (t.alive) {
        r.prop("crate", t.x, t.y, 0, { size: 0.65 });
        r.queue(t.x, t.y, t.z, (g) => {
          const p = r.w(t.x, t.y, t.z);
          E.px.rect(g, p[0] - 2, p[1] - 9, 4, 9, "#518572");
          E.px.rect(g, p[0] - 1, p[1] - 12, 2, 4, "#c4caa3");
        });
      }
    for (const place of Object.values(world.locations))
      if (
        place.presentation &&
        (!place.showWhen || campaign.explain(place.showWhen).ok)
      )
        drawSprite(r, place, place.presentation);
    for (const activity of content
      .list("activity")
      .filter((a) => a.handler.op === "gather")) {
      const p = content.resolve(activity.at),
        options = activity.handler.params;
      if (activities.available(activity.id).ok) {
        if (options.prop)
          r.prop(options.prop.name, p.x, p.y, p.z || 0, {
            ...options.prop,
            hides: false,
          });
        if (state.focusOn || E.dist(hero, p) < 150)
          r.marker(p.x, p.y, (p.z || 0) + 15, {
            label:
              options.markerLabel ||
              content.get(options.item, "item").name.toUpperCase(),
            color: options.color || "#d8c56a",
          });
      }
    }
    if (lassoLine)
      r.queue(hero.x, hero.y, 15, (g) => {
        const a = r.w(hero.x, hero.y, 18),
          b = r.w(lassoLine.x, lassoLine.y, lassoLine.z);
        E.px.line(g, a[0], a[1], b[0], b[1], "#caba85", 1);
      });
    for (const a of world.animals || [])
      if (!a.alive && !state.collected.includes(a.id)) {
        drawSprite(r, a, regionSettings().lootMarker, 0);
        r.marker(a.x, a.y, 20, { label: "GAME", color: "#daca9a" });
      }
    shots.draw(r);
    game.lights.enabled = true;
    const lighting = regionSettings();
    game.lights.ambient =
      activeTrigger()?.ambient ??
      (state.night ? (lighting.nightAmbient ?? 0.42) : (lighting.ambient ?? 0.9));
    game.lights.add(hero.x, hero.y, 28, 85, 0.4, { color: "#ecc481" });
    game.lights.caster(hero.x, hero.y, 6, hero.z + 37);
    if (state.weather === "rain")
      r.overlay((g) => {
        for (let i = 0; i < 75; i++) {
          const x = (i * 83 + state.time * 23) % r.W,
            y = (i * 59 + state.time * 260) % r.H;
          E.px.line(g, x, y, x - 3, y + 9, "#95a79e", 1);
        }
      });
    if (fishing)
      r.overlay((g) => {
        const w = Math.min(180, r.W - 40),
          x = (r.W - w) / 2,
          y = r.H * 0.43;
        E.ui.box(g, x - 10, y - 25, w + 20, 53, {
          bg: "#202920",
          border: "#bfa775",
        });
        E.font.text(
          g,
          fishing.phase === "waiting" ? "WAIT FOR A BITE" : "REEL IN THE GOLD",
          r.W / 2,
          y - 16,
          "#e9d7ae",
          { align: "center" },
        );
        E.px.rect(g, x, y, w, 7, "#3c463b");
        if (fishing.phase === "reel") {
          const p = activities.definition(fishing.id).handler.params;
          const band = p.band || [0.28, 0.74];
          E.px.rect(
            g,
            x + w * band[0],
            y,
            w * (band[1] - band[0]),
            7,
            "#b69754",
          );
          const pos = (Math.sin(fishing.t * (p.speed || 3.5)) + 1) / 2;
          E.px.rect(g, x + pos * w - 1, y - 3, 3, 13, "#f6f0d5");
        }
      });
    if (campMenu) campMenu.draw(r);
    talk.draw(r);
    if (overlays.size) drawOverlays(r);
    if (photo)
      r.text(
        "PHOTO MODE / " +
          game.input.label("interact").toUpperCase() +
          " TO RETURN",
        r.W / 2,
        r.H - 20,
        "#f0e7ce",
        { align: "center" },
      );
  }
  let previewStarted = false;
  const title = {
    enter() {
      // Author preview: ?scenario=<id> starts that scenario once, in its own
      // save namespace; returning to the title afterwards behaves normally.
      if (previewScenario && !previewStarted) {
        previewStarted = true;
        try {
          applyScenario(previewScenario);
          return;
        } catch (error) {
          titleScreen();
          notify("Scenario unavailable", error.message);
          return;
        }
      }
      titleScreen();
    },
    update(dt) {
      state.time += dt;
      heroRig.update(dt, { x: hero.x, y: hero.y, z: 0, facing: -0.8 });
      if (game.input.pressed("start") && ui.screen === "title")
        begin(getSave());
    },
    draw(r) {
      W.draw(r, game, world, state);
    },
  };
  const play = {
    pausable: true,
    res: [480, 300],
    expand: true,
    views: ["threequarter", "iso", "topdown", "brawler", "overhead"],
    view: "threequarter",
    input: bindings,
    touch: DustRuntime.actionTouch(content),
    camera: { zoom: [0.7, 1.65], start: 1, tall: 1 },
    enter() {
      enterDialogueScope();
      enterSequenceScope();
      ui.hide();
      actions.syncTouch();
      lastHud = -1;
      musicName = "";
      music(objective().music);
      game.cam.offset = [0, 0];
      game.cam.bounds = (v) => world.map.bounds(v);
      game.follow(hero, { z: 18, lead: 9 });
      game.particles.ground = (x, y, z) => world.map.groundAt(x, y, 2, z);
      game.timeScale = 1;
      game.every(14, () => {
        game.audio.sfx({
          wave: "sine",
          freq: 1450,
          to: 2100,
          dur: 0.12,
          vol: 0.03,
          arp: [0, 5, -2],
          step: 0.055,
        });
      });
      setBodyClass();
    },
    exit() {
      lifecycle.exit();
      closeTransient();
    },
    update,
    draw,
  };
  const end = {
    enter() {
      results();
    },
    update() {},
    draw,
  };
  const dead = {
    enter() {
      ui.hud({});
      ui.tutorial(null);
      state.deaths++;
      ui.show("results", {
        kicker: screens.death.kicker,
        title: screens.death.title,
        text: screens.death.text,
        actions: [
          [
            "Return to checkpoint",
            () => {
              const s = checkpoint || getSave();
              const deaths = state.deaths;
              reset(s);
              state.deaths = deaths;
              state.hp = 100;
              hero.play("getUp");
              ui.hide();
              game.go("play");
              if (s && s.scene !== Saves.overworldScene(content) && interiors.has(s.scene)) {
                enterInterior(s.scene, { save: false, arrival: s.interior || null });
              }
            },
          ],
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
    update() {},
    draw,
  };
  function boot() {
    world = W.build(E, content);
    flow = new E.FlowField(world.map, { climb: 48, drop: 48, jump: 45 });
    spatial = new E.SpatialHash(48);
    reset();
    game.cam.bounds = (v) => world.map.bounds(v);
    game.focus(220, 675, 18);
    // Interior scenes come from scene definitions. Cinder No. 4 is installed
    // first, at its historical point in engine random order; every later
    // interior owns an isolated presentation stream.
    const interiorCallbacks = {
      getRig: () => heroRig,
      onExit: commitInterior,
      paused: () => !!ui.screen || talk.open || !!campMenu || photo,
      onSimulation: (dt) => {
        const targets = [hero.id];
        statuses.update(dt, { targets });
        combat.update(dt, { targets });
      },
      speedMultiplier: () => statuses.multiplier("speed"),
      onHurt: (amount, hazard) =>
        hurt(amount, {
          type: "hazard",
          presentation: false,
          invulnerability: hazard?.invulnerability ?? 1.6,
        }),
      onToast: notify,
      onEnter: () => {
        setBodyClass();
        const inside = activeInterior();
        if (resumeAt && inside) inside.debug.teleport(resumeAt.x, resumeAt.z);
        resumeAt = null;
        // Resume-policy interiors checkpoint on entry, inside the scene.
        if (pendingInteriorSave) save();
        pendingInteriorSave = false;
      },
    };
    const interiorDefinitions = content
      .list("scene")
      .filter((d) => d.template === "mine")
      .sort(
        (a, b) =>
          (b.engineScene === "mine") - (a.engineScene === "mine") ||
          a.id.localeCompare(b.id),
      );
    for (const definition of interiorDefinitions) {
      const region = content.get(definition.region, "region"),
        legacy = definition.engineScene === "mine",
        presentation = new DustRuntime.RandomStreams(region.seed);
      const instance = WesternMine.create(
        E,
        game,
        {
          ...interiorCallbacks,
          ...(legacy
            ? {}
            : {
                scopeRandom: (fn) => presentation.with(definition.id, fn),
              }),
        },
        WesternMine.setupFrom(content.data, definition.id),
      );
      const engineScene = definition.engineScene || definition.id;
      instance.scene.interior = true;
      interiors.set(definition.id, { definition, instance, engineScene });
      scenes[engineScene] = instance.scene;
      if (legacy) mine = instance;
    }
    frontier = WesternFrontier.create(E, game, {
      get lifecycle() {
        return lifecycle;
      },
      get heroRig() {
        return heroRig;
      },
      get state() {
        return state;
      },
      get hero() {
        return hero;
      },
      get world() {
        return world;
      },
      get witnesses() {
        return [...actors.values()].filter(
          (a) =>
            a.definition.witness ??
            ["witness", "traveler"].includes(a.behavior),
        );
      },
      content,
      get actors() {
        return actors;
      },
      get campaign() {
        return campaign;
      },
      get inventory() {
        return inventory;
      },
      get activities() {
        return activities;
      },
      get statuses() {
        return statuses;
      },
      registerActors: (entries) => {
        for (const [id, actor] of entries) actors.set(id, actor);
      },
      get foes() {
        return foes;
      },
      ui,
      notify,
      hurt,
      save,
      enemyHit,
      defaultThrowable: () => hero.archetype.throwable,
      attackPower: () => statuses.multiplier("damage"),
    });
    // Sound cues are content records, played by their ID like engine presets.
    for (const cue of content.list("cue"))
      if (cue.type === "sound")
        game.audio.define(
          cue.id,
          JSON.parse(
            JSON.stringify(
              cue.config.voices.length === 1
                ? cue.config.voices[0]
                : cue.config.voices,
            ),
          ),
        );
    if (
      typeof matchMedia === "function" &&
      matchMedia("(pointer:fine)").matches
    ) {
      game.enableGPU({ map: world.map });
    }
  }
  // Developer overlays (inspector): collision cells, sight, interaction reach
  // and the navigation route to the tracked objective. Presentation only.
  const overlays = new Set();
  let overlayFlow = null,
    previewClip = null;
  function drawOverlays(r) {
    const map = world.map,
      T = map.T;
    if (overlays.has("collision"))
      r.decal((g) => {
        for (let cy = 0; cy < map.h; cy++)
          for (let cx = 0; cx < map.w; cx++) {
            const x = cx * T + T / 2,
              y = cy * T + T / 2;
            if (Math.abs(x - hero.x) > 260 || Math.abs(y - hero.y) > 200) continue;
            if (!map.walkable(cx, cy)) {
              const a = r.w(cx * T, cy * T, 1),
                b = r.w(cx * T + T, cy * T + T, 1);
              E.px.line(g, a[0], a[1], b[0], b[1], "#ff5a4a");
              E.px.line(g, b[0], a[1], a[0], b[1], "#ff5a4a");
            }
          }
      });
    if (overlays.has("sight"))
      for (const a of actors.values())
        if (a.mind && a.alive !== false)
          r.sightCone(a, {
            map,
            range: a.stats.sight ?? 140,
            fov: a.stats.fov ?? 1.8,
            color: a.mind.state === "alert" ? "#ff5a4a" : "#ffd27a",
            alpha: 0.18,
          });
    if (overlays.has("interactions"))
      for (const d of content.list("interaction")) {
        const p = content.resolve(d.at);
        if (p.region !== world.region || E.dist(hero, p) > 260) continue;
        const ok = interactions.inspect(d.id, { ignoreReach: true }).available;
        r.groundRing(p.x, p.y, d.radius, ok ? "#7dff9a" : "#ff8a7a", 0.5);
      }
    if (overlays.has("navigation")) {
      const at = objective().at;
      if (at) {
        overlayFlow ||= new E.FlowField(map, world.definition.traversal || {});
        overlayFlow.update(at.x, at.y);
        r.decal((g) => {
          let [cx, cy] = map.toCell(hero.x, hero.y);
          for (let i = 0; i < 80; i++) {
            const here = overlayFlow.d[cy * map.w + cx];
            if (!(here > 0) || here >= 1e9) break;
            let best = null;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
              const nx = cx + dx,
                ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
              const v = overlayFlow.d[ny * map.w + nx];
              if (v < (best?.v ?? here)) best = { nx, ny, v };
            }
            if (!best) break;
            const a = r.w(cx * T + T / 2, cy * T + T / 2, 2),
              b = r.w(best.nx * T + T / 2, best.ny * T + T / 2, 2);
            E.px.line(g, a[0], a[1], b[0], b[1], "#7ad7ff", 2);
            [cx, cy] = [best.nx, best.ny];
          }
        });
      }
    }
  }
  // Author scenarios: a fresh journey in an isolated save namespace, placed at
  // the scenario spawn with its setup effects applied atomically.
  function applyScenario(id) {
    const scenario = content.get(id, "scenario");
    saveKey = `dust-mercy:preview:${id}`;
    scenarioSeed = scenario.seed;
    begin();
    scenarioSeed = null;
    ui.tutorial(null);
    const spawn = content.get(scenario.spawn, "location");
    if (interiors.has(scenario.scene)) {
      enterInterior(scenario.scene, {
        save: false,
        arrival: { x: spawn.x, z: spawn.z ?? 32 },
      });
    } else game.debug.teleport(spawn.x, spawn.y, spawn.z || 0);
    const result = campaign.run(scenario.setup, null, { scenario: id });
    if (!result.ok) throw new Error(`Scenario ${id} setup failed: ${result.reason}`);
    save();
    return { scenario: id, saveKey };
  }
  // A structured view of what an author needs to debug a situation.
  function inspect({ radius = 220 } = {}) {
    const inside = activeInterior();
    const nearby = interactions
      ? content
          .list("interaction")
          .map((d) => {
            const point = content.resolve(d.at);
            return { d, point, distance: E.dist(hero, point) };
          })
          .filter(({ point, distance }) => !inside && point.region === world.region && distance < radius)
          .sort((a, b) => a.distance - b.distance)
          .map(({ d, distance }) => {
            const info = interactions.inspect(d.id);
            return {
              id: d.id,
              label: d.label,
              distance: Math.round(distance),
              available: info.available,
              reasons: info.reasons,
            };
          })
      : [];
    return {
      build: { contentRevision: content.data.revision },
      scene: inside ? inside.debug.definition.id : Saves.overworldScene(content),
      engineScene: game.sceneName,
      saveKey,
      hero: inside
        ? { x: inside.debug.hero.x, z: inside.debug.hero.z }
        : { x: +hero.x.toFixed(1), y: +hero.y.toFixed(1), z: +(hero.z || 0).toFixed(1) },
      interior: inside?.debug.snapshot() || null,
      quests: Object.fromEntries(
        content.list("quest").map((q) => {
          const record = state.quests[q.id];
          const definition = q.states[record?.state];
          return [
            q.id,
            {
              state: record?.state,
              active: !!record?.active,
              tracked: state.trackedQuest === q.id,
              objective: definition?.objective || null,
              transitions: (definition?.transitions || []).map((t) => ({
                id: t.id,
                to: t.to,
                ...campaign.explain(t.when),
              })),
            },
          ];
        }),
      ),
      interactions: nearby,
      actors: [...actors.values()].map((a) => ({
        id: a.id,
        behavior: a.behavior,
        x: Math.round(a.x),
        y: Math.round(a.y),
        ...(a.hp !== undefined ? { hp: a.hp } : {}),
        ...(a.alive !== undefined ? { alive: a.alive } : {}),
        ...(a.bound ? { bound: true } : {}),
        ...(a.mind ? { alert: a.mind.state } : {}),
      })),
      inventory: Object.fromEntries(
        Object.entries(state.inventory).filter(([, n]) => n),
      ),
      money: state.money,
      flags: { ...state.flags },
      encounters: { ...state.encounters },
      rewardClaims: Object.keys(state.rewardClaims || {}),
      interiors: JSON.parse(JSON.stringify(state.interiors || {})),
      trace: campaign.trace.slice(-25),
      errors: game.errors.map((e) => e.message || String(e)),
    };
  }
  game.debug = {
    content,
    applyScenario,
    inspect,
    stateDigest,
    overlays,
    // Play a clip from a selected-motion asset on the player (presentation only).
    previewAnimation(asset, clipName) {
      const set = motionFor(asset),
        clip = set?.clip(clipName);
      if (!clip) return false;
      previewClip = { set, clip, t: 0 };
      return true;
    },
    motionAssets: () =>
      content.data.assets
        .filter((a) => a.kind === "motion")
        .map((a) => ({ id: a.id, clips: [...(a.clips || [])] })),
    jump(id) {
      const point = actors.get(id) || content.resolve(id);
      if (point.region && point.region !== world.region) return false;
      game.debug.teleport(point.x, point.y, point.z || 0);
      return true;
    },
    explain: (condition) => campaign.explain(condition),
    get sequences() {
      return sequences;
    },
    get inventory() {
      return inventory;
    },
    get weapons() {
      return weapons;
    },
    get statuses() {
      return statuses;
    },
    get combat() {
      return combat;
    },
    get mounts() {
      return mounts;
    },
    get behaviors() {
      return behaviors;
    },
    get melee() {
      return meleeCombat;
    },
    get campaign() {
      return campaign;
    },
    get dialogues() {
      return dialogues;
    },
    get interactions() {
      return interactions;
    },
    get actors() {
      return actors;
    },
    snapshot: () => ({
      scene: game.sceneName,
      hero: hero ? [hero.x, hero.y, hero.z] : null,
      state: state ? JSON.parse(JSON.stringify(state)) : null,
      foes: foes.map((f) => ({
        id: f.id,
        hp: f.hp,
        alive: f.alive,
        bound: f.bound,
        mind: f.mind.state,
        x: f.x,
        y: f.y,
      })),
      doctor: doctor ? { x: doctor.x, y: doctor.y } : null,
      horse: horse ? { x: horse.x, y: horse.y } : null,
      near: near?.definition?.legacyId || near?.id,
      dialog: !!talk.open,
      errors: game.errors,
      engine: E.version,
      gpu: game.gpu?.status(),
      mine: mine?.debug?.snapshot?.(),
      interior: activeInterior()?.debug.snapshot(),
    }),
    teleport(x, y, z = 0) {
      Object.assign(hero, {
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        action: null,
      });
      game.focus(x, y, z + 18);
      near = nearestInteraction();
    },
    interact: (id) => interact(id, true),
    begin,
    save,
    openMap,
    openSatchel,
    fire,
    lasso,
    care,
    mount,
    drink: () => actions.execute("core:action/tonic"),
    enemyHit,
    help,
    photoMode,
    get lifecycle() {
      return lifecycle;
    },
    get heroRig() {
      return heroRig;
    },
    get state() {
      return state;
    },
    get hero() {
      return hero;
    },
    get world() {
      return world;
    },
    get foes() {
      return foes;
    },
    get doctor() {
      return doctor;
    },
    get horse() {
      return horse;
    },
    get talk() {
      return talk;
    },
    get ui() {
      return ui;
    },
    get mine() {
      return mine;
    },
    get interiors() {
      return new Map(
        [...interiors].map(([id, interior]) => [id, interior.instance]),
      );
    },
    get interior() {
      return activeInterior();
    },
    get music() {
      return musicName;
    },
    get trigger() {
      return activeTrigger();
    },
    place: () => placeLabel(),
    enterInterior,
    get saveKey() {
      return saveKey;
    },
    get saveStatus() {
      return saveStatus;
    },
    readSave,
    // Developer/scenario sessions use a separate namespace; never the player's save.
    useSaveNamespace(name) {
      saveKey = name ? `dust-mercy:preview:${name}` : SAVE;
      return saveKey;
    },
    get frontier() {
      return frontier;
    },
    get shots() {
      return shots;
    },
    get fishing() {
      return activities.fishing;
    },
    get activities() {
      return activities;
    },
    get actions() {
      return actions;
    },
    get campMenu() {
      return campMenu;
    },
    get checkpoint() {
      return checkpoint;
    },
    setHealth(v) {
      state.hp = v;
    },
    hurt,
    reset,
    get rangeTargets() {
      return rangeTargets();
    },
  };
  // Replay checksums. The original recording uses the six legacy values;
  // recordings made with ?digest=1 add a digest of content revision,
  // inventory, entities, quests, rewards, encounters and pending timers.
  function stateDigest() {
    if (!state) return 0;
    const round = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : n);
    const view = DustRuntime.canonical({
      content: content.data.revision,
      scene: game.sceneName,
      inventory: state.inventory,
      money: state.money,
      quests: Object.fromEntries(
        Object.entries(state.quests || {}).map(([id, q]) => [id, q.state]),
      ),
      flags: state.flags,
      rewards: Object.keys(state.rewardClaims || {}).sort(),
      encounters: state.encounters,
      interiors: state.interiors,
      objects: state.objects,
      actors: [...actors.values()].map((a) => [a.id, round(a.x), round(a.y), a.hp ?? null, a.alive ?? null, !!a.bound]),
      bombs: (state.frontier?.bombs || []).map((b) => [b.id, round(b.remaining)]),
      statuses: Object.fromEntries(
        Object.entries(state.statuses || {}).map(([id, s]) => [id, round(s.remaining)]),
      ),
      simTime: round(lifecycle.time),
    });
    let hash = 2166136261;
    for (const char of JSON.stringify(view))
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }
  const digestReplay =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("digest");
  game.stateHash = () =>
    state
      ? [
          hero.x,
          hero.y,
          state.hp,
          state.stage,
          state.ammo,
          state.honor,
          ...(digestReplay ? [stateDigest()] : []),
        ]
      : [];
  globalThis.dustGame = game;
  const scenes = { title, play, end, dead };
  game.start({
    scenes,
    scene: "title",
    boot: {
      title: "DUST & MERCY",
      version: "1.0",
      steps: [["Tracing the river through Cinder Valley", boot]],
      messages: [
        "Saddling Flint",
        "Lighting the last lantern",
        "Remembering the road home",
      ],
    },
  });
})();

/* Developer inspector: open the game with ?inspect=1 (F8 toggles the panel).
 * A read-mostly view over game.debug: scene, quests and blocked transitions,
 * nearby interactions with reasons, actors, inventory, effect trace, overlays,
 * jump-to-place, animation preview and a copyable bug report. Players never
 * see it; it is inert without the query flag.
 */
(() => {
  "use strict";
  if (typeof document === "undefined" || typeof location === "undefined") return;
  const params = new URLSearchParams(location.search);
  if (!params.has("inspect")) return;
  const game = globalThis.dustGame;
  if (!game) return;
  const d = game.debug;
  const css = `
#dm-inspector{position:fixed;z-index:9000;top:max(8px,env(safe-area-inset-top));right:8px;width:min(380px,calc(100vw - 16px));max-height:calc(100dvh - 64px);overflow:auto;
  background:#151a14f0;color:#efe6d2;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;border:1px solid #8f7952;border-radius:6px;padding:8px 10px;box-sizing:border-box}
#dm-inspector h3{margin:8px 0 4px;font-size:12px;color:#ddb775;text-transform:uppercase;letter-spacing:.06em}
#dm-inspector .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}
#dm-inspector button,#dm-inspector select{font:inherit;color:#efe6d2;background:#2c3326;border:1px solid #8f7952;border-radius:4px;padding:4px 6px;min-height:28px;max-width:100%}
#dm-inspector label{display:inline-flex;gap:4px;align-items:center}
#dm-inspector .ok{color:#9be29b}#dm-inspector .no{color:#ff9c8a}#dm-inspector .dim{color:#b5a98f}
#dm-inspector ul{margin:0;padding-left:14px}#dm-inspector li{margin:1px 0;overflow-wrap:anywhere}
#dm-inspector-toggle{position:fixed;z-index:9001;left:8px;bottom:max(8px,env(safe-area-inset-bottom));font:12px ui-monospace,monospace;color:#efe6d2;background:#2c3326e6;border:1px solid #8f7952;border-radius:4px;padding:6px 8px}
#dm-inspector.hidden{display:none}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const panel = Object.assign(document.createElement("aside"), { id: "dm-inspector" });
  panel.setAttribute("aria-label", "Developer inspector");
  const toggle = Object.assign(document.createElement("button"), { id: "dm-inspector-toggle", textContent: "Inspector (F8)" });
  document.body.append(panel, toggle);
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const show = (open) => panel.classList.toggle("hidden", !open);
  // Small screens start collapsed so the game stays playable.
  show(innerWidth >= 700);
  toggle.addEventListener("click", () => show(panel.classList.contains("hidden")));
  addEventListener("keydown", (e) => {
    if (e.code === "F8") {
      show(panel.classList.contains("hidden"));
      e.preventDefault();
    }
  });
  // Static controls: built once so selects keep focus between refreshes.
  const controls = document.createElement("div");
  const places = d.content
    .list("location")
    .filter((p) => !p.region || d.content.get(p.region, "region").template === "ground")
    .map((p) => `<option value="${escape(p.id)}">${escape(p.label)} (${escape(p.id)})</option>`)
    .join("");
  const clips = d
    .motionAssets()
    .flatMap((a) => a.clips.map((c) => `<option value="${escape(a.id)}|${escape(c)}">${escape(c)} · ${escape(a.id)}</option>`))
    .join("");
  const scenarios = d.content
    .list("scenario")
    .map((s) => `<option value="${escape(s.id)}">${escape(s.name)}</option>`)
    .join("");
  controls.innerHTML = `
    <h3>Tools</h3>
    <div class="row"><select id="dm-jump" aria-label="Jump to place">${places}</select><button id="dm-jump-go">Jump</button></div>
    <div class="row"><select id="dm-clip" aria-label="Preview animation">${clips}</select><button id="dm-clip-go">Play on player</button></div>
    <div class="row"><select id="dm-scenario" aria-label="Scenario">${scenarios}</select><button id="dm-scenario-go">Load scenario</button></div>
    <div class="row">${["collision", "sight", "interactions", "navigation"].map((o) => `<label><input type="checkbox" data-overlay="${o}"> ${o}</label>`).join("")}</div>
    <div class="row"><button id="dm-report">Copy bug report</button><span id="dm-report-status" class="dim"></span></div>`;
  const live = document.createElement("div");
  panel.append(controls, live);
  controls.querySelector("#dm-jump-go").onclick = () => d.jump(controls.querySelector("#dm-jump").value);
  controls.querySelector("#dm-clip-go").onclick = () => {
    const [asset, clip] = controls.querySelector("#dm-clip").value.split("|");
    d.previewAnimation(asset, clip);
  };
  controls.querySelector("#dm-scenario-go").onclick = () => {
    const url = new URL(location.href);
    url.searchParams.set("scenario", controls.querySelector("#dm-scenario").value);
    location.href = url.href;
  };
  for (const box of controls.querySelectorAll("[data-overlay]"))
    box.onchange = () => (box.checked ? d.overlays.add(box.dataset.overlay) : d.overlays.delete(box.dataset.overlay));
  controls.querySelector("#dm-report").onclick = async () => {
    const report = {
      url: location.href,
      scenario: params.get("scenario"),
      reproduce: params.get("scenario")
        ? `npm run content -- inspect --scenario ${params.get("scenario")} --json`
        : "Open the URL above; describe the inputs that led here.",
      userAgent: navigator.userAgent,
      inspect: d.inspect(),
    };
    const text = JSON.stringify(report, null, 2);
    const status = controls.querySelector("#dm-report-status");
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "copied";
    } catch {
      const link = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([text], { type: "application/json" })),
        download: "dust-mercy-bug-report.json",
      });
      link.click();
      status.textContent = "downloaded";
    }
  };
  function render() {
    if (panel.classList.contains("hidden") || game.sceneName === "title") return;
    let i;
    try {
      i = d.inspect({ radius: 160 });
    } catch (error) {
      live.innerHTML = `<p class="no">${escape(error.message)}</p>`;
      return;
    }
    const quests = Object.entries(i.quests)
      .filter(([, q]) => q.active)
      .map(([id, q]) => `<li><b>${escape(id)}</b> · ${escape(q.state)}${q.tracked ? " · tracked" : ""}<ul>${q.transitions
        .map((t) => `<li class="${t.ok ? "ok" : "no"}">→ ${escape(t.to)}: ${t.ok ? "ready" : escape(t.reason)}</li>`)
        .join("")}</ul></li>`)
      .join("");
    const near = i.interactions
      .slice(0, 8)
      .map((n) => `<li class="${n.available ? "ok" : "no"}">${escape(n.label)} <span class="dim">${n.distance}px</span>${n.available ? "" : ` — ${escape(n.reasons.join("; "))}`}</li>`)
      .join("");
    const close = i.actors
      .filter((a) => Math.hypot(a.x - (i.hero.x ?? 0), a.y - (i.hero.y ?? 0)) < 200)
      .slice(0, 8)
      .map((a) => `<li>${escape(a.id)} <span class="dim">${escape(a.behavior)}${a.hp !== undefined ? ` hp ${a.hp}` : ""}${a.alert ? ` ${a.alert}` : ""}</span></li>`)
      .join("");
    const trace = i.trace
      .slice(-6)
      .reverse()
      .map((t) => `<li class="${t.type === "rejected" ? "no" : "dim"}">${escape(t.type)} ${escape(t.reason || (t.effects || []).map((e) => e.op).join(", "))}</li>`)
      .join("");
    live.innerHTML = `
      <h3>Scene</h3><div>${escape(i.scene)} · ${escape(JSON.stringify(i.hero))}</div><div class="dim">save ${escape(i.saveKey)}</div>
      <h3>Active quests</h3><ul>${quests || "<li class=dim>none</li>"}</ul>
      <h3>Interactions</h3><ul>${near || "<li class=dim>none nearby</li>"}</ul>
      <h3>Actors nearby</h3><ul>${close || "<li class=dim>none</li>"}</ul>
      <h3>Inventory</h3><div>$${i.money} · ${escape(Object.entries(i.inventory).map(([k, v]) => `${k.split(":").pop()} ×${v}`).join(" · "))}</div>
      <h3>Effect trace</h3><ul>${trace || "<li class=dim>empty</li>"}</ul>
      ${i.errors.length ? `<h3>Errors</h3><ul>${i.errors.map((e) => `<li class=no>${escape(e)}</li>`).join("")}</ul>` : ""}`;
  }
  setInterval(render, 500);
})();
