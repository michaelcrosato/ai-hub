/* Content-driven adventure scene adapter. Engine source stays unchanged. */
import { evaluateCondition } from "./adventure.js";
const copy = (value) => JSON.parse(JSON.stringify(value));
const finitePoint = (p) =>
  Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite);

/** Build an origin-aware engine navigation map, including negative world coordinates. */
export function buildNavigation(E, area) {
  const b = area.bounds,
    tile = area.navigation?.tile || 4;
  if (
    !Array.isArray(b) ||
    b.length !== 4 ||
    !b.every(Number.isFinite) ||
    b[2] <= b[0] ||
    b[3] <= b[1]
  )
    throw new Error(`Area '${area.id}' has invalid bounds`);
  const origin = [
    Math.floor(b[0] / tile) * tile - tile,
    Math.floor(b[1] / tile) * tile - tile,
  ];
  const w = Math.ceil((b[2] - origin[0]) / tile) + 2,
    h = Math.ceil((b[3] - origin[1]) / tile) + 2;
  if (w * h > 250000)
    throw new Error(
      `Area '${area.id}' navigation exceeds 250000 cells; increase navigation.tile`,
    );
  const map = new E.TileMap({ w, h, tile });
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      const x = origin[0] + (cx + 0.5) * tile,
        y = origin[1] + (cy + 0.5) * tile;
      if (
        x < b[0] ||
        x > b[2] ||
        y < b[1] ||
        y > b[3] ||
        (area.obstacles || []).some(
          (o) => x >= o[0] && x <= o[2] && y >= o[1] && y <= o[3],
        )
      )
        map.block(cx, cy);
    }
  const local = (p) => [p[0] - origin[0], p[1] - origin[1]];
  const collision = {
    collide(body) {
      body.x -= origin[0];
      body.y -= origin[1];
      let hit;
      try {
        hit = map.collide(body);
      } finally {
        body.x += origin[0];
        body.y += origin[1];
      }
      return hit;
    },
    groundAt(x, y, r, z, step) {
      return map.groundAt(x - origin[0], y - origin[1], r, z, step);
    },
  };
  function probe(from, to) {
    if (!finitePoint(from) || !finitePoint(to))
      return { reachable: false, reason: "invalid-point", pathDistance: null };
    for (const [p, role] of [
      [from, "start"],
      [to, "target"],
    ]) {
      if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3])
        return {
          reachable: false,
          reason: `${role}-outside-bounds`,
          pathDistance: null,
        };
      const q = local(p);
      if (!map.walkable(...map.toCell(...q)))
        return {
          reachable: false,
          reason: `${role}-blocked`,
          pathDistance: null,
        };
    }
    const field = new E.FlowField(map),
      p = local(from),
      q = local(to);
    field.update(...q);
    const distance =
      field.d[Math.floor(p[1] / tile) * map.w + Math.floor(p[0] / tile)];
    return {
      reachable: distance < 1e9,
      reason: distance < 1e9 ? "reachable" : "disconnected",
      pathDistance: distance < 1e9 ? distance * tile : null,
      field,
    };
  }
  return { map, origin, local, collision, probe, bounds: b, tile };
}

export function createScene({
  definition,
  onSelect = () => {},
  onReady = () => {},
  onNotice = () => {},
  headless = false,
  loop = true,
} = {}) {
  if (!definition?.areas?.length)
    throw new Error("createScene requires a definition with at least one area");
  const E = globalThis.My3D2dge;
  if (!E) throw new Error("my-3D2dge must load before createScene");
  const { px } = E;
  const config = definition.scene || {},
    areas = new Map(
      definition.areas.map((a) => [
        a.id,
        { ...a, props: (a.props || []).map((p) => ({ ...p })) },
      ]),
    );
  const hotspots = (definition.hotspots || []).map((h) => ({
    ...h,
    walk: h.walk?.slice(),
  }));
  const actorDefs = (definition.actors || []).map((a) => ({ ...a }));
  const game = new E.Game({
    canvas: config.canvas || "scene",
    id: `lastwatch-${definition.id}`,
    view: config.view || "threequarter",
    res: config.resolution || [480, 330],
    expand: true,
    bg: config.background || "#07131a",
    corner: false,
    fullscreen: "button",
    headless,
    loop,
    camera: { zoom: false },
    input: {
      ...E.Input.DEFAULT,
      interact: ["KeyE", "Space"],
      pause: [],
      start: [],
    },
    menu: {
      controls: {
        interact: "Investigate",
        attack: false,
        dash: false,
        jump: false,
        skill: false,
      },
    },
  });
  game.screen.setScale("fill");
  game.cam.smooth = 0.15;
  let area = definition.startArea || definition.areas[0].id,
    state = { flags: {}, values: {}, inventory: [], evidence: [] },
    selected = null,
    aimed = null,
    highlight = false,
    uiFocus = false,
    hover = null,
    time = 0,
    ready = false,
    lastNotice = null,
    footTimer = 0,
    rainAt = 0,
    cameraCue = null,
    debug = {};
  if (!areas.has(area)) throw new Error(`Unknown starting area '${area}'`);
  const playerDef = definition.player || {},
    spawn = areas.get(area).spawn || [
      areas.get(area).bounds[0] + 10,
      areas.get(area).bounds[1] + 10,
    ];
  const hero = new E.Body({
    x: spawn[0],
    y: spawn[1],
    r: playerDef.radius || 1.8,
  });
  hero.facing = playerDef.facing ?? -1.1;
  const defaultAppearance = {
    size: 1.05,
    build: "heroic",
    weapon: null,
    outfit: "coat",
    hair: "short",
    colors: {
      cloth: "#657d7b",
      coat: "#405c61",
      pants: "#293c47",
      skin: "#c99476",
    },
  };
  const playerRig = new E.Humanoid({
    ...defaultAppearance,
    ...playerDef.appearance,
  });
  const nav = new Map([...areas].map(([id, a]) => [id, buildNavigation(E, a)]));
  const actors = new Map(
    actorDefs.map((a) => [
      a.id,
      {
        definition: a,
        body: new E.Body({ x: a.x, y: a.y, z: a.z || 0, r: a.radius || 1.8 }),
        rig: new E.Humanoid({ ...defaultAppearance, ...a.appearance }),
        override: null,
        animation: null,
        appearanceIndex: -1,
      },
    ]),
  );
  for (const actor of actors.values()) {
    actor.body.facing = actor.definition.facing || 0;
    if (actor.definition.animation) {
      const factory =
        definition.extensions?.animations?.[actor.definition.animation];
      if (!factory)
        throw new Error(
          `Unknown animation '${actor.definition.animation}' on '${actor.definition.id}'`,
        );
      actor.animation = factory({
        E,
        game,
        rig: actor.rig,
        actor: actor.definition,
      });
    }
  }
  const walks = new Map();
  let generation = 0;
  const condition = (expr) => evaluateCondition(state, expr, definition);
  const canvas = game.screen.canvas;
  const notice = (code, message, extra = {}) => {
    lastNotice = {
      type: code.includes("unreachable") ? "unreachable" : "scene",
      code,
      message,
      area,
      ...extra,
    };
    onNotice(lastNotice);
    return lastNotice;
  };
  const currentHotspots = () =>
    hotspots.filter(
      (h) => h.area === area && condition(h.visibleWhen ?? h.visible),
    );
  // Aiming is separate from approaching: shoulder buttons may browse every
  // visible point of interest without moving the player or opening an action.
  function getTarget() {
    const available = currentHotspots().filter((h) => finitePoint(h.walk));
    const explicit = available.find((h) => h.id === aimed);
    if (explicit) return explicit;
    aimed = null;
    return available.reduce((nearest, h) => {
      const distance = Math.hypot(h.walk[0] - hero.x, h.walk[1] - hero.y);
      return !nearest || distance < nearest.distance
        ? { hotspot: h, distance }
        : nearest;
    }, null)?.hotspot || null;
  }
  function focusTarget(id) {
    const h = currentHotspots().find(
      (h) => h.id === id && finitePoint(h.walk),
    );
    if (!h) return null;
    // Re-aiming while walking cancels the previous approach so it cannot open
    // an interaction after the player's focus has moved elsewhere.
    if (walks.get("player")?.hotspot !== h.id)
      finishWalk("player", "canceled", "target-changed");
    aimed = h.id;
    selected = null;
    return h;
  }
  function cycleTarget(direction = 1) {
    const target = getTarget(),
      available = currentHotspots()
        .filter((h) => finitePoint(h.walk))
        .map((h) => ({ h, p: projectHotspot(h.id).marker }))
        .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.h.id.localeCompare(b.h.id));
    if (!available.length) return null;
    const index = available.findIndex(({ h }) => h.id === target?.id),
      step = direction < 0 ? -1 : 1;
    return focusTarget(available[(index + step + available.length) % available.length].h.id);
  }
  function interactTarget() {
    const h = getTarget();
    return h ? selectHotspot(h.id) : false;
  }
  function getWalkState() {
    const w = walks.get("player");
    return w ? {
      moving: true,
      actor: "player",
      hotspot: w.hotspot,
      area: w.area,
      destination: [...w.to],
      remainingDistance: Math.hypot(w.to[0] - hero.x, w.to[1] - hero.y),
      elapsed: w.elapsed,
    } : null;
  }
  const actorVisible = (a) =>
    a.definition.area === area &&
    condition(a.definition.visibleWhen ?? a.definition.visible);
  const context = {
    E,
    game,
    getState: () => state,
    getTime: () => time,
    getArea: () => areas.get(area),
    getActor: (id) => actors.get(id),
    condition,
  };
  const painters = new Map();
  for (const a of areas.values())
    if (a.painter) {
      const factory = definition.extensions?.painters?.[a.painter];
      if (!factory)
        throw new Error(`Unknown painter '${a.painter}' in '${a.id}'`);
      painters.set(a.id, factory({ ...context, area: a }));
    }
  for (const [id, voice] of Object.entries(definition.sounds || {}))
    game.audio.define(id, voice);
  const random = E.rng(config.seed || 17061991),
    drops = Array.from({ length: 90 }, () => [random(), random(), random()]);
  function baseCamera() {
    const a = areas.get(area),
      b = a.bounds;
    return {
      focus: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 15],
      fit: [
        Math.max(260, (b[2] - b[0]) * 1.8),
        Math.max(200, (b[3] - b[1]) * 1.6),
      ],
      yaw: 0,
      ...a.camera,
    };
  }
  function fitCamera() {
    const c = { ...baseCamera(), ...cameraCue?.camera };
    game.rotateView((c.yaw || 0) - (game.yaw || 0));
    game.setZoom(
      c.zoom ??
        Math.min(
          1.4,
          Math.max(0.5, Math.min(game.W / c.fit[0], game.H / c.fit[1])),
        ),
    );
  }
  const observer =
    canvas && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          game.screen.resize();
          fitCamera();
        })
      : null;
  observer?.observe(canvas);
  fitCamera();
  function finishWalk(key, status, reason) {
    const w = walks.get(key);
    if (!w) return;
    walks.delete(key);
    const body = key === "player" ? hero : actors.get(key)?.body;
    if (body) {
      body.vx = 0;
      body.vy = 0;
    }
    w.resolve?.({ status, reason, actor: key, hotspot: w.hotspot });
    if (status !== "arrived")
      notice(
        reason || "walk-canceled",
        `Approach ${status}: ${reason || "canceled"}.`,
        { hotspot: w.hotspot, actor: key },
      );
  }
  function cancelWalk(reason = "walk-canceled") {
    for (const key of [...walks.keys()]) finishWalk(key, "canceled", reason);
    if (reason.includes("sequence")) {
      cameraCue = null;
      for (const a of actors.values()) a.override = null;
      fitCamera();
    }
  }
  function probe({ from = [hero.x, hero.y], to, area: areaId = area } = {}) {
    const n = nav.get(areaId);
    if (!n)
      return { reachable: false, reason: "unknown-area", pathDistance: null };
    const { field, ...result } = n.probe(from, to);
    return result;
  }
  function beginWalk(key, to, hotspot = null) {
    const a = key === "player" ? null : actors.get(key),
      body = a?.body || hero;
    if (key !== "player" && !a) {
      notice("unknown-actor", `Actor '${key}' does not exist.`);
      return { accepted: false, result: { reason: "unknown-actor" } };
    }
    if (a && a.definition.area !== area) {
      notice("unreachable", `Actor '${key}' is in another location.`);
      return { accepted: false, result: { reason: "actor-outside-area" } };
    }
    const result = nav.get(area).probe([body.x, body.y], to);
    if (!result.reachable) {
      notice(
        "unreachable",
        `Cannot approach this point: ${result.reason.replaceAll("-", " ")}.`,
        { hotspot, actor: key },
      );
      return { accepted: false, result };
    }
    finishWalk(key, "canceled", "walk-replaced");
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    walks.set(key, {
      to: [...to],
      hotspot,
      field: result.field,
      area,
      generation,
      resolve,
      elapsed: 0,
      stalled: 0,
      last: [body.x, body.y],
      timeout: Math.max(
        6,
        Math.min(
          60,
          ((result.pathDistance || 0) / (playerDef.speed || 65)) * 4 + 5,
        ),
      ),
    });
    return { accepted: true, promise };
  }
  function selectHotspot(id) {
    const h = currentHotspots().find((s) => s.id === id);
    if (!h) {
      notice("unknown-hotspot", `Point of interest '${id}' is unavailable.`);
      return false;
    }
    if (!finitePoint(h.walk)) {
      notice("unreachable", `Point of interest '${id}' has no valid approach.`);
      return false;
    }
    const walk = beginWalk("player", h.walk, id);
    if (!walk.accepted) return false;
    aimed = id;
    selected = id;
    game.audio.sfx("select");
    return true;
  }
  function setArea(next, entrance) {
    const a = areas.get(next);
    if (!a) {
      notice("unknown-area", `Location '${next}' does not exist.`);
      return false;
    }
    cancelWalk("area-changed");
    generation++;
    area = next;
    selected = null;
    aimed = null;
    hover = null;
    cameraCue = null;
    const e = (a.entrances || []).find((v) => v.id === entrance),
      p = e
        ? [e.x, e.y]
        : a.spawn || [
            (a.bounds[0] + a.bounds[2]) / 2,
            (a.bounds[1] + a.bounds[3]) / 2,
          ];
    hero.x = p[0];
    hero.y = p[1];
    hero.vx = hero.vy = 0;
    hero.facing = e?.facing ?? playerDef.facing ?? -1.1;
    game.input.clear();
    game.audio.stopMusic();
    fitCamera();
    return true;
  }
  function projectHotspot(id) {
    const h = hotspots.find((s) => s.id === id);
    if (!h) return null;
    const p = game.view.p(h.x, h.y, (h.z || 0) + 6),
      marker = [p[0] - game.screen.ix, p[1] - game.screen.iy],
      text = h.markerName || h.name || id,
      w = E.font.width(text, { font: "tiny" }) + 8,
      label = { x: marker[0] - w / 2, y: marker[1] - 18, w, h: 11 };
    const toClient = (x, y) => {
      const s = game.screen,
        b = canvas?.getBoundingClientRect() || { left: 0, top: 0 };
      return {
        x: b.left + (x * s.S + s.OX) / s.dpr,
        y: b.top + (y * s.S + s.OY) / s.dpr,
      };
    };
    return {
      id,
      area: h.area,
      world: [h.x, h.y, h.z || 0],
      walk: h.walk && [...h.walk],
      marker,
      label,
      client: toClient(...marker),
      labelClient: toClient(label.x + label.w / 2, label.y + label.h / 2),
    };
  }
  function spotHit(point) {
    if (!point) return null;
    let best = null,
      distance = Infinity;
    const target = getTarget()?.id;
    for (const h of currentHotspots()) {
      const p = projectHotspot(h.id),
        shown = highlight || h.id === target || h.id === hover,
        l = p.label;
      if (
        shown &&
        point[0] >= l.x - 2 &&
        point[0] <= l.x + l.w + 2 &&
        point[1] >= l.y - 3 &&
        point[1] <= l.y + l.h + 3
      )
        return h;
      if (Math.hypot(point[0] - p.marker[0], point[1] - p.marker[1]) < 10)
        return h;
      const q = game.view.p(h.x, h.y, (h.z || 0) * 0.65),
        d = Math.hypot(
          point[0] - q[0] + game.screen.ix,
          point[1] - q[1] + game.screen.iy,
        );
      if (d < (h.pickRadius || Math.max(25, 30 * game.zoom)) && d < distance) {
        best = h;
        distance = d;
      }
    }
    return best;
  }
  function updateWalk(key, dt) {
    const w = walks.get(key);
    if (!w) return false;
    const actor = actors.get(key),
      body = key === "player" ? hero : actor?.body;
    if (!body || w.area !== area || w.generation !== generation) {
      finishWalk(key, "canceled", "stale-walk");
      return false;
    }
    if (w.hotspot && !currentHotspots().some((h) => h.id === w.hotspot)) {
      finishWalk(key, "canceled", "stale-hotspot");
      return false;
    }
    const d = Math.hypot(w.to[0] - body.x, w.to[1] - body.y);
    if (d < 2.2) {
      const id = w.hotspot;
      finishWalk(key, "arrived");
      if (id) onSelect(id);
      return false;
    }
    w.elapsed += dt;
    if (Math.hypot(body.x - w.last[0], body.y - w.last[1]) < 0.005)
      w.stalled += dt;
    else w.stalled = 0;
    w.last = [body.x, body.y];
    if (w.elapsed > w.timeout || w.stalled > 1.5) {
      finishWalk(key, "failed", "unreachable-timeout");
      return false;
    }
    const n = nav.get(area),
      q = n.local([body.x, body.y]),
      goal = n.local(w.to),
      dir = w.field.dir(...q, ...goal),
      speed = actor?.definition.speed || playerDef.speed || 65;
    body.vx = dir[0] * speed;
    body.vy = dir[1] * speed;
    body.facing = Math.atan2(dir[1], dir[0]);
    return true;
  }
  function update(dt) {
    if (!ready) {
      ready = true;
      onReady(game);
    }
    if (
      state.activeSequence &&
      state.presentation?.[state.activeSequence]?.paused
    )
      return;
    time += dt;
    const room = areas.get(area),
      amb = room.ambience || {};
    if (game.audio.ready && !game.audio.song && amb.music) {
      const song = definition.music?.[amb.music];
      if (song) game.audio.music(song);
    }
    if (amb.rain && time > rainAt && definition.sounds?.rain) {
      rainAt = time + 0.48;
      game.audio.sfx("rain");
    }
    const click = game.input.clicked();
    hover = spotHit(game.input.pointer())?.id || null;
    if (canvas) canvas.style.cursor = hover ? "pointer" : "crosshair";
    if (click && !uiFocus) {
      const h = spotHit(click);
      if (h) selectHotspot(h.id);
      else {
        const q = game.view.toGround(
          click[0] + game.screen.ix,
          click[1] + game.screen.iy,
        );
        if (q) {
          aimed = null;
          selected = null;
          beginWalk("player", q);
        }
      }
    }
    // The application owns pad confirmation across world and overlay focus.
    // Keep legacy saved Pad0 bindings from delivering the same press twice.
    if (!uiFocus && game.input.lastDevice !== "gamepad" && game.input.pressed("interact"))
      interactTarget();
    const move = uiFocus ? [0, 0] : game.input.move();
    hero.vx = hero.vy = 0;
    if (Math.hypot(...move) > 0.1) {
      aimed = null;
      selected = null;
      finishWalk("player", "canceled", "manual-movement");
      const d = game.view.screenDirToGround(...move);
      hero.vx = d[0] * (playerDef.speed || 65);
      hero.vy = d[1] * (playerDef.speed || 65);
      hero.facing = Math.atan2(d[1], d[0]);
    } else if (!uiFocus || state.activeSequence) updateWalk("player", dt);
    hero.update(dt, nav.get(area).collision);
    if (hero.vx || hero.vy) {
      footTimer += dt;
      if (footTimer > 0.32 && definition.sounds?.step) {
        game.audio.sfx("step");
        footTimer = 0;
      }
    }
    playerRig.update(dt, {
      x: hero.x,
      y: hero.y,
      z: hero.z,
      vx: hero.vx,
      vy: hero.vy,
      facing: hero.facing,
    });
    for (const a of actors.values()) {
      if (a.definition.area !== area) continue;
      const appearances =
          a.definition.appearances || a.definition.appearanceRules || [],
        appearanceIndex = appearances.findIndex((rule) => condition(rule.when));
      if (appearanceIndex !== a.appearanceIndex) {
        const base = a.definition.appearance || {},
          variant = appearances[appearanceIndex]?.appearance || {};
        a.animation?.dispose?.();
        a.rig = new E.Humanoid({
          ...defaultAppearance,
          ...base,
          ...variant,
          colors: {
            ...defaultAppearance.colors,
            ...base.colors,
            ...variant.colors,
          },
        });
        a.appearanceIndex = appearanceIndex;
        a.animation = a.definition.animation
          ? definition.extensions.animations[a.definition.animation]({
              E,
              game,
              rig: a.rig,
              actor: a.definition,
            })
          : null;
      }
      a.body.vx = a.body.vy = 0;
      updateWalk(a.definition.id, dt);
      if (walks.has(a.definition.id))
        a.body.update(dt, nav.get(area).collision);
      if (a.override?.until <= time) a.override = null;
      const pose =
        a.override?.pose ||
        (a.definition.poses || []).find((p) => condition(p.when))?.pose ||
        a.definition.pose;
      const extra =
        a.animation?.update?.({
          state,
          time,
          dt,
          actor: a.definition,
          rig: a.rig,
        }) || {};
      a.rig.update(dt, {
        x: a.body.x,
        y: a.body.y,
        z: a.body.z,
        vx: a.body.vx,
        vy: a.body.vy,
        facing: a.body.facing,
        ...extra,
        pose: a.override?.pose ?? extra.pose ?? pose,
        expr: a.override?.expr ?? extra.expr,
      });
      a.pose = a.override?.pose ?? extra.pose ?? pose;
    }
    for (const [id, p] of painters) if (id === area) p?.update?.(dt);
    if (cameraCue?.until <= time) {
      cameraCue = null;
      fitCamera();
    }
    game.focus(...{ ...baseCamera(), ...cameraCue?.camera }.focus);
  }
  function defaultRoom(r, room) {
    const b = room.bounds,
      g = r.ctx;
    px.poly(
      g,
      [
        [b[0], b[1]],
        [b[2], b[1]],
        [b[2], b[3]],
        [b[0], b[3]],
      ].map((p) => r.w(...p)),
      room.floor || "#284149",
    );
    for (let y = b[1]; y < b[3]; y += 12) {
      const a = r.w(b[0], y),
        c = r.w(b[2], y);
      px.line(g, ...a, ...c, "#324b50");
    }
    r.queue((b[0] + b[2]) / 2, b[1], 0, (g) => {
      r.box(g, b[0], b[1] - 4, 0, b[2], b[1], 36, "#64716a", "#345058");
      const p = r.w((b[0] + b[2]) / 2, b[1], 26);
      if (room.showTitle !== false) E.font.text(g, room.wallLabel || room.title || room.name || room.id, ...p, "#d3d5bd", {
        align: "center",
      });
    });
  }
  function draw(r) {
    const room = areas.get(area);
    r.sky(room.ambience?.sky || ["#081721", "#112c37", "#173d46"]);
    const painter = painters.get(area);
    if (painter?.draw) painter.draw(r);
    else if (typeof painter === "function") painter(r);
    else defaultRoom(r, room);
    for (const prop of room.props || [])
      if (condition(prop.visibleWhen ?? prop.visible)) {
        const painter = definition.extensions?.props?.[prop.painter];
        if (painter) painter({ ...context, r, prop });
        else r.prop(prop.kind || "crate", prop.x, prop.y, prop.z || 0, prop);
      }
    for (const a of actors.values())
      if (actorVisible(a)) {
        r.shadow(a.body.x, a.body.y, a.definition.shadowRadius || 9, 0.5);
        r.actor(
          a.body.x,
          a.body.y,
          a.body.z,
          (g, x, y) => a.rig.draw(g, x, y, r.view),
          { hides: true },
        );
      }
    for (const w of walks.values()) r.groundRing(...w.to, 5, "#b8c9b4", 0.7);
    r.shadow(hero.x, hero.y, 7, 0.55);
    r.actor(
      hero.x,
      hero.y,
      hero.z,
      (g, x, y) => playerRig.draw(g, x, y, r.view),
      { xray: { color: "#c0d5c5", outline: true } },
    );
    const target = getTarget()?.id;
    for (const h of currentHotspots())
        r.overlay((g) => {
          const p = projectHotspot(h.id),
            [x, y] = p.marker,
            focused = h.id === target || h.id === hover,
            c = focused ? "#f1c67f" : "#a5c9c6";
          if (!focused && !highlight) {
            px.rect(g, x - 2, y - 2, 5, 5, "#0d232d");
            px.rect(g, x - 1, y - 1, 3, 3, c);
            return;
          }
          px.poly(
            g,
            [
              [x, y - 4],
              [x + 4, y],
              [x, y + 4],
              [x - 4, y],
            ],
            "#0d232d",
          );
          px.poly(
            g,
            [
              [x, y - 2],
              [x + 2, y],
              [x, y + 2],
              [x - 2, y],
            ],
            c,
          );
          px.blend(g, 0.85, "normal", () =>
            px.rect(g, p.label.x, p.label.y, p.label.w, p.label.h, "#071923"),
          );
          E.font.text(g, h.markerName || h.name || h.id, x, y - 16, c, {
            align: "center",
            font: "tiny",
          });
        });
    r.overlay((g) => {
      if (room.ambience?.rain) {
        const motion = game.reduceMotion ? 0 : time;
        px.blend(g, 0.2, "normal", () => {
          for (const [a, b, c] of drops) {
            const x = (a * r.W + motion * (13 + c * 7)) % r.W,
              y = (b * r.H + motion * (85 + c * 75)) % r.H;
            px.line(
              g,
              x,
              y,
              x - 2,
              y + 5 + c * 4,
              c > 0.5 ? "#85b4bc" : "#5a8591",
            );
          }
        });
      }
      for (let i = 0; i < 4; i++)
        px.blend(g, 0.05, "normal", () => {
          px.rect(g, i * 7, i * 6, r.W - i * 14, 6, "#010a12");
          px.rect(g, i * 7, r.H - (i + 1) * 6, r.W - i * 14, 6, "#010a12");
        });
    });
    if (debug.navigation || debug.hotspots || debug.camera) drawDebug(r);
  }
  function drawDebug(r) {
    r.overlay((g) => {
      if (debug.navigation) {
        const n = nav.get(area);
        for (let cy = 0; cy < n.map.h; cy++)
          for (let cx = 0; cx < n.map.w; cx++)
            if (n.map.blocked[cy * n.map.w + cx]) {
              const p = r.w(
                n.origin[0] + (cx + 0.5) * n.tile,
                n.origin[1] + (cy + 0.5) * n.tile,
              );
              px.dot(g, ...p, "#b66f6b");
            }
      }
      if (debug.hotspots)
        for (const h of currentHotspots())
          if (h.walk) {
            const p = r.w(...h.walk);
            px.line(g, p[0] - 3, p[1], p[0] + 3, p[1], "#ffe4a1");
            px.line(g, p[0], p[1] - 3, p[0], p[1] + 3, "#ffe4a1");
          }
      if (debug.camera) {
        px.line(g, r.W / 2 - 8, r.H / 2, r.W / 2 + 8, r.H / 2, "#87d5c7");
        px.line(g, r.W / 2, r.H / 2 - 8, r.W / 2, r.H / 2 + 8, "#87d5c7");
      }
    });
  }
  function drawPortrait(id, targetCanvas) {
    if (!targetCanvas) return false;
    targetCanvas.width = 64;
    targetCanvas.height = 64;
    const g = targetCanvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    px.rect(g, 0, 0, 64, 64, "#11202a");
    const h = hotspots.find((h) => h.id === id),
      actorId = h?.portrait || h?.actor || id,
      rig = actorId === "player" ? playerRig : actors.get(actorId)?.rig;
    if (!rig) return false;
    rig.drawPortrait(g, 0, 0, 64, {
      zoom: 4.4,
      turn: 0.4,
      frame: false,
      upright: true,
      weapon: false,
      headY: 0.42,
    });
    return true;
  }
  function cue(c) {
    if (!c) return null;
    if (c.kind === "audio") {
      game.audio.sfx(c.audio || c.name);
      return null;
    }
    if (c.kind === "pose") {
      const a = actors.get(c.actor);
      if (!a) {
        notice("unknown-actor", `Actor '${c.actor}' does not exist.`);
        return null;
      }
      a.override = {
        pose: c.pose,
        expr: c.expr,
        until: time + (c.duration ?? 1500) / 1000,
      };
      return null;
    }
    if (c.kind === "camera") {
      cameraCue = {
        camera: c.camera || {},
        until: time + (c.duration ?? 1500) / 1000,
      };
      fitCamera();
      return null;
    }
    if (c.kind === "move") {
      const res = beginWalk(
        c.actor || "player",
        c.to || c.position || [c.x, c.y],
      );
      return res.accepted
        ? res.promise
        : Promise.resolve({ status: "failed", reason: res.result.reason });
    }
    return null;
  }
  function diagnostics() {
    return {
      area,
      areas: [...areas.keys()],
      bounds: [...areas.get(area).bounds],
      spawn: areas.get(area).spawn,
      camera: { ...baseCamera(), ...cameraCue?.camera },
      hero: { x: hero.x, y: hero.y },
      selected,
      target: getTarget()?.id || null,
      targetMode: aimed ? "explicit" : "nearest",
      walk: walks.has("player")
        ? { ...walks.get("player"), field: undefined, resolve: undefined }
        : null,
      actors: [...actors.values()].map((a) => ({
        id: a.definition.id,
        area: a.definition.area,
        x: a.body.x,
        y: a.body.y,
        z: a.body.z,
        pose: a.pose,
        animation: a.definition.animation || null,
        appearanceIndex: a.appearanceIndex,
        colors: { ...a.rig.C },
        mocapActive: !!a.rig.mocap,
        joints: {
          head: a.rig.J?.head,
          handR: a.rig.J?.handR,
          handL: a.rig.J?.handL,
        },
      })),
      hotspots: currentHotspots().map((h) => ({ ...h })),
      lastNotice,
      errors: game.errors,
    };
  }
  function place(kind, id, point) {
    let obj;
    if (kind === "hotspot") obj = hotspots.find((h) => h.id === id);
    else if (kind === "actor") obj = actors.get(id)?.definition;
    else if (kind === "prop")
      obj = [...areas.values()]
        .flatMap((a) => a.props)
        .find((p) => p.id === id);
    if (!obj) return { ok: false, message: `Unknown ${kind} '${id}'` };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      return { ok: false, message: "Placement requires finite x and y" };
    Object.assign(
      obj,
      { x: point.x, y: point.y },
      Number.isFinite(point.z) ? { z: point.z } : {},
      finitePoint(point.walk) ? { walk: [...point.walk] } : {},
    );
    if (kind === "actor") {
      const a = actors.get(id);
      a.body.x = obj.x;
      a.body.y = obj.y;
      a.body.z = obj.z || 0;
    }
    return {
      ok: true,
      placement: { id, ...point },
      message: "Session placement updated; export the snippet to save it.",
    };
  }
  function placementSnippet(kind, id) {
    const all =
        kind === "hotspot"
          ? hotspots
          : kind === "actor"
            ? [...actors.values()].map((a) => a.definition)
            : [...areas.values()].flatMap((a) => a.props),
      obj = all.find((o) => o.id === id);
    return obj ? JSON.stringify(obj, null, 2) : null;
  }
  game.start({
    scene: "case",
    scenes: { case: { pausable: true, camera: { zoom: false }, update, draw } },
  });
  game.debug = {
    snapshot: () => ({
      area,
      hero: { x: Math.round(hero.x), y: Math.round(hero.y) },
      selected,
      moving: walks.has("player"),
      hotspots: currentHotspots().map((h) => h.id),
      lastNotice,
      errors: game.errors,
    }),
  };
  return {
    game,
    setArea,
    selectHotspot,
    getTarget,
    focusTarget,
    cycleTarget,
    interactTarget,
    getWalkState,
    getArea: () => area,
    getDefinition: () => definition,
    setState(s) {
      state = {
        flags: {},
        values: {},
        inventory: [],
        evidence: [],
        ...(s || {}),
      };
    },
    setSelected(id) {
      selected = id;
    },
    setHighlight(on) {
      highlight = !!on;
    },
    setUIFocus(on) {
      uiFocus = !!on;
      game.input.clear();
    },
    drawPortrait,
    projectHotspot,
    probe,
    diagnostics,
    resetCamera() {
      cameraCue = null;
      fitCamera();
    },
    place,
    placementSnippet,
    setDebug(v) {
      debug = { ...debug, ...v };
    },
    cue,
    applyCue: cue,
    cancelWalk,
    dispose() {
      cancelWalk("disposed");
      observer?.disconnect();
      for (const a of actors.values()) a.animation?.dispose?.();
      for (const p of painters.values()) p?.dispose?.();
      game.dispose();
    },
  };
}
