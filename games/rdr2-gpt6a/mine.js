/* Dust & Mercy — side-view interior template (Cinder No. 4 and authored interiors).
 * A scene definition's validated `config` supplies the grid, physics, pickups,
 * barriers, lifts, hazards, decor and presentation; this file owns behavior only.
 * Public integration: WesternMine.create(E, game, callbacks, setup) -> { scene, debug }
 * where setup = { definition, region, grid, entry, music }.
 */
(() => {
  "use strict";

  const LABELS = ["attack", "jump", "dash", "view", "interact"];

  function create(E, game, callbacks = {}, setup = {}) {
    const definition = setup.definition,
      config = definition?.config,
      grid = setup.grid;
    if (!config || !grid?.rows)
      throw new Error("Interior template needs a scene definition and grid");
    const T = grid.tileSize,
      W = grid.width,
      H = grid.height;
    const P = E.px,
      colors = config.ambience || {},
      palette = config.ui || {};
    const entry = { x: setup.entry?.x ?? T * 2, z: setup.entry?.z ?? T * 2 };
    // Presentation randomness: the original Cinder bats are created at boot,
    // in their historical position in engine random order. Additional interiors
    // receive an isolated scope from the game adapter.
    const scope = (fn) => (callbacks.scopeRandom ? callbacks.scopeRandom(fn) : fn());
    let rig =
      callbacks.getRig?.() ||
      callbacks.rig ||
      new E.Humanoid({ build: "heroic", size: 1.25, weapon: "gun" });
    const copy = (value) => JSON.parse(JSON.stringify(value));
    const background = new E.Backdrop(copy(config.backdrop));
    const shots = new E.Bullets(game, { plane: "side", max: 48 });
    const bash = new E.Attack("bash", copy(config.combat.melee));
    const input = Object.assign({}, E.Input.PLATFORMER, {
      interact: [...config.controls.interact],
      view: [...config.controls.view],
    });
    const fliers = config.fliers || { actors: [] };
    const flierRigs = scope(() =>
      fliers.actors.map(() => new E.Blob(copy(fliers.rig))),
    );
    const primary = config.pickups.find((p) => p.primary) || config.pickups[0];
    let level,
      hero,
      lifts = [],
      bats = [],
      debris = [],
      barriers = [],
      elapsed = 0,
      cooldown = 0,
      hurt = 0,
      sparkle = 0;
    let collected = new Set(),
      enteredCollected = new Set(),
      exited = false;
    let checkpoint = { ...entry },
      rope = 0,
      context = "",
      contextTarget = null,
      hint = "",
      stats,
      savedLighting,
      savedParticleGround;
    let priorMocap = null,
      priorMocapWeight;

    function toast(message) {
      if (!message) return;
      if (callbacks.onToast) callbacks.onToast(message.title, message.text);
      else if (game.shell) game.shell.toast(message.title, message.text, 2.4);
      else game.note(message.title, 2.4);
    }
    function label(text) {
      let out = text;
      for (const name of LABELS)
        out = out.replaceAll(`{${name}}`, game.input.label(name));
      return out;
    }

    function build() {
      level = new E.PlatformMap({
        rows: [...grid.rows],
        depth: grid.depth,
        legend: { ...grid.legend },
        types: copy(grid.types),
      });
    }

    // Barrier columns are mutable geometry: the grid never contains them.
    function applyBarrier(barrier) {
      for (let z = barrier.def.bottom; z <= barrier.def.top; z++)
        level.set(barrier.def.column, z, barrier.hp > 0 ? barrier.def.tile : 0);
    }

    function damageBarrier(barrier, amount, z = 56) {
      if (barrier.hp <= 0) return;
      barrier.hp = Math.max(0, barrier.hp - amount);
      const x = barrier.def.column * T;
      game.particles.bits(x, 0, z, 7, colors.splinters);
      game.audio.sfx("bump", { pitch: 0.7, vol: 0.4 });
      game.shake(0.9);
      if (barrier.hp === 0) {
        applyBarrier(barrier);
        stats.breached = true;
        game.particles.smoke(x, 0, 70, 6, { color: colors.smoke, size: 5 });
        game.audio.sfx("secret", { pitch: 0.7, vol: 0.5 });
        toast(barrier.def.toast);
      }
    }

    function enter(data = {}) {
      rig = callbacks.getRig?.() || rig;
      build();
      hero = new E.Platformer({ x: entry.x, z: entry.z, ...copy(config.player) });
      hero.movementDefaults = { run: hero.run };
      lifts = (config.lifts || []).map((l) => ({
        def: l,
        x: l.x,
        z: l.z,
        w: l.w,
        h: l.h,
        vx: 0,
        vz: 0,
        oneway: true,
      }));
      elapsed = cooldown = hurt = sparkle = rope = 0;
      collected = new Set(Object.keys(data.collected || {}).filter((k) => data.collected[k]));
      enteredCollected = new Set(collected);
      exited = false;
      barriers = (config.barriers || []).map((def) => {
        const x = def.column * T + T / 2;
        // The melee attack records hits per target object; keep it stable.
        return { def, hp: data.barriers?.[def.id] ?? def.hp, x, target: { x, y: 0, z: 32, r: 10 } };
      });
      barriers.forEach(applyBarrier);
      checkpoint = { ...entry };
      stats = {
        jumps: 0,
        ropes: 0,
        dashes: 0,
        shots: 0,
        hits: 0,
        falls: 0,
        ladder: false,
        lift: false,
        chamber: false,
        crates: 0,
        breached: barriers.some((b) => b.hp <= 0),
        pickups: 0,
        seconds: 0,
      };
      debris = (config.debris || []).map((d) => ({ ...d, y: 0, dead: false }));
      bats = flierRigs.map((body, i) => ({
        rig: body,
        x: fliers.actors[i].x,
        y: fliers.actors[i].y,
        z: fliers.actors[i].z,
        home: fliers.actors[i].x,
        fly: false,
        r: 5,
      }));
      shots.clear();
      bash.cancel();
      savedLighting = {
        enabled: game.lights.enabled,
        ambient: game.lights.ambient,
      };
      game.lights.enabled = true;
      game.lights.ambient = config.lighting.ambient;
      savedParticleGround = game.particles.ground;
      game.particles.ground = (x, y, z) => {
        for (const lift of lifts)
          if (Math.abs(x - lift.x) < lift.w / 2 && z >= lift.z + lift.h - 1)
            return Math.max(level.groundBelow(x, z) || 0, lift.z + lift.h);
        return level.groundBelow(x, z) || 0;
      };
      priorMocap = rig.mocap;
      priorMocapWeight = rig.mocapW;
      rig.mocap = null;
      rig.mocapW = 0;
      const cam = config.camera;
      game.follow(hero, { ...cam.follow });
      game.cam.bounds = (view) => level.bounds(view);
      game.cam.room = null;
      game.cam.offset = [...(game.upright ? cam.offsetPortrait : cam.offsetLandscape)];
      game.cam.smooth = cam.smooth;
      game.cam.snap = true;
      if (game.shell) {
        game.shell.hud({});
        game.shell.tutorial(null);
      }
      if (setup.music) game.audio.music(setup.music);
      callbacks.onEnter?.(definition);
      toast(config.intro);
      rig.update(0, hero.rigState());
      updateContext();
    }

    function exit() {
      shots.clear();
      bash.cancel();
      game.particles.ground = savedParticleGround;
      if (savedLighting) Object.assign(game.lights, savedLighting);
      rig.mocap = priorMocap;
      rig.mocapW = priorMocapWeight;
      game.cam.room = null;
      game.cam.offset = [0, 0];
      if (game.shell) game.shell.hud({});
    }

    function result() {
      const fresh = [...collected].filter((id) => !enteredCollected.has(id));
      return {
        scene: definition.id,
        collected: fresh,
        barriers: Object.fromEntries(barriers.map((b) => [b.def.id, b.hp])),
        completed: collected.has(primary.id),
        stats: { ...stats, seconds: Math.round(elapsed) },
      };
    }

    function leave() {
      if (exited) return;
      exited = true;
      if (callbacks.onExit) callbacks.onExit(result());
      else {
        exited = false;
        toast(config.exit.fallback);
      }
    }

    function damage() {
      if (hurt > 0) return;
      const hazard = config.hazard;
      stats.falls++;
      hurt = hazard.invulnerability;
      game.particles.sparks(hero.x, 0, hero.z + 10, 8, null, {
        color: colors.sparks,
      });
      game.audio.sfx("hurt", { pitch: 0.7, vol: 0.45 });
      game.flash(colors.flash, 0.1, 0.25);
      Object.assign(hero, {
        x: checkpoint.x,
        z: checkpoint.z,
        vx: 0,
        vz: 0,
        climbing: false,
        onGround: false,
        drop: 0,
        dashing: 0,
      });
      game.cam.snap = true;
      if (callbacks.onHurt) callbacks.onHurt(hazard.damage, hazard);
      toast(hazard.toast);
    }

    const alive = () => barriers.filter((b) => b.hp > 0);

    function fire() {
      const combat = config.combat;
      if (cooldown > 0 || bash.busy) return;
      const seal = alive().find(
        (b) => Math.abs(hero.x - b.x) < b.def.meleeRange && hero.z < b.def.maxZ,
      );
      if (seal) {
        hero.facing = hero.x < seal.def.column * T ? 1 : -1;
        bash.start();
        cooldown = combat.meleeCooldown;
        return;
      }
      cooldown = combat.shotCooldown;
      stats.shots++;
      const origin = { x: hero.x + hero.facing * 12, y: 0, z: hero.z + 26 };
      const angle = hero.facing > 0 ? 0 : Math.PI;
      const ahead = alive().find(
        (b) => (b.def.column * T - hero.x) * hero.facing > 0,
      );
      const crate = debris.find(
        (item) =>
          !item.dead &&
          (item.x - hero.x) * hero.facing > 0 &&
          Math.abs(item.x - hero.x) < combat.aimRange,
      );
      const aim = ahead
        ? { x: ahead.x, z: E.clamp(origin.z, combat.aimZ[0], combat.aimZ[1]) }
        : crate
          ? { x: crate.x, z: crate.z + crate.h / 2 }
          : { x: origin.x + hero.facing * combat.shotDistance, z: origin.z };
      shots.burst(
        {
          ...origin,
          team: "miner",
          color: colors.shots,
          r: 1.25,
          life: 1.8,
          pierce: true,
          onWall(b) {
            const column = Math.floor(b.x / T);
            const hit = alive().find((barrier) => barrier.def.column === column);
            if (hit) damageBarrier(hit, hit.def.projectileDamage, b.z);
          },
        },
        [E.pattern.aimSide(origin, aim, combat.shotSpeed)],
      );
      game.particles.sparks(origin.x, 0, origin.z, 4, angle, {
        color: colors.muzzle,
        speed: 35,
      });
      game.audio.sfx("shoot", { pitch: 0.7, vol: 0.45 });
      for (const bat of bats)
        if (Math.abs(bat.x - hero.x) < (combat.startle ?? 150)) bat.fly = true;
    }

    function pickupInReach(p) {
      return (
        Math.abs(hero.x - p.x) < p.range &&
        (p.height !== undefined
          ? Math.abs(hero.z - p.z) < p.height
          : hero.z < (p.maxZ ?? p.z + 43))
      );
    }

    function zoneHint(short) {
      const seal = alive().find(
        (b) => Math.abs(hero.x - b.x) < (b.def.hintRange ?? b.def.meleeRange),
      );
      if (seal) return label(short ? seal.def.shortHint : seal.def.hint);
      const zone = (config.hints || []).find(
        (h) => hero.x > h.fromX && hero.x < h.toX,
      );
      if (zone) return label(short ? zone.short : zone.text);
      return label(short ? config.hint.short : config.hint.text);
    }

    function updateContext() {
      context = "";
      contextTarget = null;
      hint = "";
      const exitPoint = config.exit;
      if (hero.x < exitPoint.maxX && hero.z < exitPoint.maxZ) {
        context = exitPoint.label;
        contextTarget = "exit";
        hint = collected.has(primary.id) ? exitPoint.complete : exitPoint.pending;
      } else {
        const p = config.pickups.find(
          (p) => !collected.has(p.id) && pickupInReach(p),
        );
        if (p) {
          context = p.label;
          contextTarget = p;
          hint = p.hint;
        } else hint = zoneHint(false);
      }
      game.input.touchSet("interact", context ? "USE" : null, !!context);
      game.input.touchSet(
        "attack",
        config.controls.attackLabel || "FIRE",
        config.controls.touch.includes("attack"),
      );
      game.input.touchSet("view", "VIEW", config.controls.touch.includes("view"));
    }

    function collect(p) {
      collected.add(p.id);
      stats.pickups++;
      const cue = p.cue || { sound: "pickup" };
      game.audio.sfx(cue.sound, { pitch: cue.pitch ?? 0.7, vol: cue.volume ?? 0.5 });
      game.particles.glints(
        p.x,
        0,
        p.z + (cue.glintZ ?? 10),
        cue.glints ?? 8,
        cue.color || "#eed899",
      );
      toast(p.toast);
    }

    function update(dt) {
      if (exited || callbacks.paused?.()) return;
      callbacks.onSimulation?.(dt);
      hero.run =
        hero.movementDefaults.run * (callbacks.speedMultiplier?.() ?? 1);
      elapsed += dt;
      stats.seconds = elapsed;
      cooldown = Math.max(0, cooldown - dt);
      hurt = Math.max(0, hurt - dt);
      rope = Math.max(0, rope - dt);
      const I = game.input;
      if (I.pressed("view")) game.nextView();
      for (const lift of lifts) {
        const previous = lift.z;
        lift.z =
          lift.def.mean +
          Math.sin(elapsed * lift.def.rate + lift.def.phase) * lift.def.amplitude;
        lift.vz = dt > 0 ? (lift.z - previous) / dt : 0;
      }
      const wasGround = hero.onGround,
        wasClimbing = hero.climbing,
        wasDashing = hero.dashing > 0;
      hero.update(dt, level, I, [
        ...lifts,
        ...debris.filter((item) => !item.dead),
      ]);
      // Framed rooms keep their width smaller than the viewport, even on a portrait phone.
      const room = (config.camera.rooms || []).find(
        (r) => hero.x > r.fromX && (r.toX === undefined || hero.x < r.toX),
      );
      game.cam.room = room
        ? [(game.W / game.view.scale) * room.width, 0.001]
        : null;
      if (game.cam.room) stats.chamber = true;
      if (hero.jumped) {
        stats.jumps++;
        game.audio.sfx("jump", { pitch: 0.68, vol: 0.2 });
        if (!wasGround && !wasClimbing) {
          rope = 0.28;
          stats.ropes++;
          game.audio.sfx("whoosh", { pitch: 0.65, vol: 0.22 });
        }
      }
      if (hero.landed) {
        game.particles.dust(hero.x, 0, hero.z, 3, {
          color: colors.land,
          size: 1.2,
        });
        game.audio.sfx("land", { pitch: 0.75, vol: 0.18 });
      }
      if (hero.climbing) stats.ladder = true;
      if (lifts.includes(hero.ground)) stats.lift = true;
      if (hero.dashing > 0 && !wasDashing) {
        stats.dashes++;
        game.audio.sfx("whoosh", { pitch: 0.65, vol: 0.2 });
      }
      const hazard = config.hazard;
      if (level.touching(hero, "hazard") || hero.z < hazard.fallBelow) damage();
      if (
        hero.onGround &&
        hero.z < hazard.checkpointMaxZ &&
        !(hazard.unsafe || []).some(([a, b]) => hero.x >= a && hero.x <= b) &&
        !level.touching(hero, "hazard")
      )
        checkpoint = { x: hero.x, z: hero.z };
      if (I.pressed("attack")) fire();
      if (bash.update(dt) === "active")
        game.audio.sfx("swing", { pitch: 0.65, vol: 0.25 });
      for (const barrier of alive())
        bash.hits(
          [barrier.target],
          (target) =>
            Math.abs(hero.x - target.x) < barrier.def.hitRange &&
            hero.z < barrier.def.maxZ,
          () => {
            stats.hits++;
            damageBarrier(barrier, barrier.def.meleeDamage, hero.z + 21);
          },
        );
      shots.update(dt, level);
      shots.hit(
        debris,
        (bullet, crate) => {
          crate.dead = true;
          stats.crates++;
          game.particles.bits(crate.x, 0, crate.z + 20, 9, colors.debris);
          game.audio.sfx("bump", { pitch: 0.8, vol: 0.25 });
        },
        "miner",
      );
      shots.hit(
        bats,
        (bullet, bat) => {
          bat.fly = true;
          bat.rig.kick(1.2);
        },
        "miner",
      );
      scope(() => {
        for (let i = 0; i < bats.length; i++) {
          const bat = bats[i];
          if (Math.abs(hero.x - bat.home) < fliers.wake) bat.fly = true;
          if (bat.fly) {
            bat.x = bat.home + Math.sin(elapsed * 1.7 + i) * fliers.swing;
            bat.z = fliers.flyZ + Math.sin(elapsed * 2.5 + i * 1.9) * fliers.bob;
          }
          bat.rig.update(dt, {
            flap: bat.fly ? 0.7 : 0,
            hang: !bat.fly,
            look: [Math.cos(elapsed * 1.7 + i), -0.2],
          });
        }
      });
      sparkle += dt;
      if (sparkle > 0.15) {
        sparkle = 0;
        const px = hero.x + Math.sin(elapsed * 5.4) * 75;
        game.particles.add({
          kind: "dust",
          x: px,
          y: -8,
          z: 122 + Math.sin(elapsed * 4.1) * 45,
          vx: -1,
          vy: 0,
          vz: -7,
          life: 1.5,
          size: 0.6,
          color: colors.dust,
        });
        if (hero.dashing > 0)
          game.particles.dust(hero.x, 0, hero.z, 2, {
            color: colors.dash,
            size: 1.5,
          });
      }
      rig.update(
        dt,
        hero.rigState({
          attack: bash.state,
          point: cooldown > 0.2 && !bash.busy,
          hurt: hurt > 0,
          expr: hurt > 0 ? "wince" : null,
        }),
      );
      updateContext();
      if (I.pressed("interact") && context) {
        I.consume("interact");
        if (contextTarget === "exit") leave();
        else if (contextTarget) collect(contextTarget);
        updateContext();
      }
    }

    function beam(r, x, color = "#7e6847") {
      r.queue(x, -10, 32, (g) => {
        r.box(g, x - 3, -13, 32, x + 3, -7, 184, "#aa9168", "#6a563b");
        r.box(g, x - 6, -13, 174, x + 74, -7, 182, "#a38c64", "#624d36");
        const a = r.w(x, -6, 154),
          b = r.w(x + 22, -6, 178);
        P.line(g, ...a, ...b, color, Math.max(2, Math.round(4 * (r.view.zoom || 1))));
        for (const z of [44, 168]) {
          const a = r.w(x, -5, z);
          P.dot(g, a[0], a[1], "#c2b17e");
        }
      });
      r.prop("lantern", x + 34, -7, 174, {
        anchor: "top",
        size: 0.95,
        light: true,
        haloR: 21,
        haloColor: "#e6b36d",
      });
    }

    const decorOps = {
      strata(r, d) {
        // Far wall strata use world coordinates so they stay fixed as the camera travels.
        for (let x = d.fromX; x < W * T; x += d.step) {
          const g = r.ctx;
          const a = r.w(x, d.y, d.bottom),
            b = r.w(x + d.width, d.y, d.top);
          P.rect(g, a[0], b[1], b[0] - a[0], a[1] - b[1], x % (d.step * 2) ? d.colors[0] : d.colors[1]);
          for (let k = 0; k < 5; k++) {
            const p = r.w(x + 2, d.y, d.bottom + 15 + k * 24),
              q = r.w(x + d.width - 3, d.y, d.bottom + 18 + k * 24);
            P.line(g, ...p, ...q, k % 2 ? d.lines[0] : d.lines[1]);
          }
        }
      },
      beam: (r, d) => beam(r, d.x, d.color),
      prop(r, d) {
        const { op, name, x, y, z, ...options } = d;
        r.prop(name, x, y, z, options);
      },
      handline(r, d) {
        // The guide rope makes the traversal route legible.
        const [ax, ay, az] = d.anchor || [(d.fromX + d.toX) / 2, -5, d.z + 1];
        r.queue(ax, ay, az, (g) => {
          let last = null;
          for (let x = d.fromX; x <= d.toX; x += 5) {
            const p = r.w(
              x,
              -5,
              d.z - Math.sin(((x - d.fromX) / (d.toX - d.fromX)) * Math.PI) * d.sag,
            );
            if (last) P.line(g, ...last, ...p, d.color);
            last = p;
          }
        });
      },
      rails(r, d) {
        const [ax, ay, az] = d.anchor || [d.segments[0][0], 2, d.z];
        r.queue(ax, ay, az, (g) => {
          for (const [a, b] of d.segments) {
            for (const y of [-4, 4]) {
              const p = r.w(a, y, d.z),
                q = r.w(b, y, d.z);
              P.line(g, ...p, ...q, d.rail);
            }
            for (let x = a; x < b; x += 12) {
              const p = r.w(x, -7, d.z - 1),
                q = r.w(x, 7, d.z - 1);
              P.line(g, ...p, ...q, d.tie, 2);
            }
          }
        });
      },
    };
    const handline = (config.decor || []).find((d) => d.op === "handline");

    function draw(r) {
      background.draw(r);
      const decor = config.decor || [];
      for (const d of decor) if (d.op === "strata") decorOps.strata(r, d);
      level.draw(r);
      for (const d of decor) if (d.op !== "strata") decorOps[d.op](r, d);
      for (const crate of debris)
        if (!crate.dead) {
          r.prop("crate", crate.x, 0, crate.z, { size: 0.9, color: crate.color });
          r.prop("crate", crate.x, 0, crate.z + 16, {
            size: 0.85,
            color: crate.color,
          });
        }
      for (const lift of lifts)
        r.queue(lift.x, 0, lift.z, (g) => {
          for (const xx of [lift.x - 16, lift.x + 16]) {
            const a = r.w(xx, 0, lift.z + 5),
              b = r.w(xx, 0, lift.def.cableTop);
            P.line(g, ...a, ...b, "#b7a477");
          }
          r.box(
            g,
            lift.x - lift.w / 2,
            -10,
            lift.z,
            lift.x + lift.w / 2,
            10,
            lift.z + lift.h,
            "#c4a578",
            "#716047",
          );
          for (let x = lift.x - 14; x < lift.x + 20; x += 7) {
            const a = r.w(x, 0, lift.z + lift.h);
            P.dot(g, a[0], a[1], "#e5c693");
          }
        });
      for (const p of config.pickups) {
        const taken = collected.has(p.id);
        if (p.prop && (!taken || p.prop.keep))
          r.prop(p.prop.name, p.x, p.prop.y ?? 0, p.z, {
            size: p.prop.size ?? 1,
            ...(p.prop.keep ? { open: taken } : {}),
            ...(p.prop.color ? { color: p.prop.color } : {}),
          });
        if (!taken && p.light)
          game.lights.add(p.x, 0, p.light.z, p.light.radius, p.light.intensity, {
            color: p.light.color,
          });
      }
      for (const bat of bats)
        r.actor(
          bat.x,
          bat.y,
          bat.z,
          (g, ox, oy) => bat.rig.draw(g, ox, oy, r.view),
          { outline: false, rim: false },
        );
      const lift = lifts.find((l) => hero.ground === l);
      const ground = lift
        ? lift.z + lift.h
        : level.groundBelow(hero.x, hero.z + 0.1) || 16;
      r.shadow(hero.x, 0, 7, 0.35, colors.shadow, ground);
      const actorStyle = {
        flash: hurt > 0 && Math.floor(hurt * 9) % 2 ? colors.hurtFlash : null,
        ghost:
          hero.dashing > 0
            ? { color: colors.ghost, life: 0.15, alpha: 0.15, owner: hero }
            : null,
        xray: { color: colors.xray, outline: true },
      };
      if (globalThis.WesternWorld?.drawCowboy)
        globalThis.WesternWorld.drawCowboy(r, E, hero, rig, {
          ...actorStyle,
          mounted: true,
          rideZ: 0,
        });
      else
        r.actor(
          hero.x,
          0,
          hero.z,
          (g, ox, oy) => rig.draw(g, ox, oy, r.view),
          actorStyle,
        );
      if (rope > 0 && handline) {
        r.queue(hero.x, 1, hero.z + 26, (g) => {
          const a = r.w(hero.x + hero.facing * 3, 0, hero.z + 30),
            b = r.w(hero.x + 8, -5, handline.z);
          P.line(g, ...a, ...b, colors.rope);
        });
      }
      rig.drawSmear(r);
      shots.draw(r);
      // World labels supplement color and point toward the objective without covering the character.
      for (const barrier of alive())
        if (barrier.def.label && Math.abs(hero.x - barrier.x) < (barrier.def.labelRange ?? 90))
          r.textAt(barrier.x, 0, barrier.def.labelZ ?? 112, barrier.def.label, "#dcc58f", {
            align: "center",
            font: "tiny",
          });
      for (const p of config.pickups)
        if (p.marker && !collected.has(p.id) && hero.x > (p.marker.fromX ?? -Infinity))
          r.textAt(p.x, 0, p.marker.z, p.marker.text, p.marker.color || "#efdba3", {
            align: "center",
            font: "tiny",
          });
      const touch = game.input.touchArea(),
        bottom = touch ? Math.max(52, r.H - touch.y0 + 11) : 19;
      r.overlay((g) => {
        const textStyle = { font: "normal", scale: game.upright ? 2 : 1 };
        E.font.text(g, config.title, 10, 11, palette.title || "#e9d29b", {
          scale: textStyle.scale,
          shadow: colors.shadow,
        });
        E.font.text(
          g,
          collected.has(primary.id)
            ? config.objective.complete
            : config.objective.pending,
          10,
          game.upright ? 31 : 23,
          palette.objective || "#b3bb9d",
          { font: "tiny", wrap: r.W - 58 },
        );
        const footer = context
          ? `${game.input.label("interact")}  ${context}`
          : game.upright
            ? zoneHint(true)
            : hint;
        const lines = E.font.wrap(footer, r.W - 28, textStyle);
        const height = E.font.height(lines.length, textStyle);
        const y = Math.max(40, r.H - bottom - height);
        E.ui.box(g, 7, y - 6, r.W - 14, height + 12, {
          bg: palette.panel || "#18251f",
          border: palette.border || "#6d7052",
          shadow: false,
          gradient: false,
        });
        E.font.text(
          g,
          lines.join("\n"),
          r.W / 2,
          y,
          context ? palette.context || "#f1dcaa" : palette.text || "#c1c5a8",
          { ...textStyle, align: "center", shadow: palette.shadow || "#152019" },
        );
      });
    }

    const scene = {
      pausable: true,
      view: config.view,
      views: [...config.views],
      input,
      res: config.resolution || "ps1",
      expand: true,
      touch: [...config.controls.touch],
      propSize: config.propSize || 1.3,
      camera: {
        zoom: [...config.camera.zoom],
        start: config.camera.start,
        tall: config.camera.tall,
      },
      enter,
      exit,
      update,
      draw,
    };
    const debug = {
      definition,
      snapshot() {
        const lift = lifts[0];
        const pickups = Object.fromEntries(
          config.pickups.map((p) => [p.id, collected.has(p.id)]),
        );
        return {
          scene: game.sceneName,
          interior: definition.id,
          hero: hero
            ? {
                x: +hero.x.toFixed(2),
                z: +hero.z.toFixed(2),
                vx: +hero.vx.toFixed(2),
                vz: +hero.vz.toFixed(2),
                ground: hero.onGround,
                climbing: hero.climbing,
                facing: hero.facing,
              }
            : null,
          lift: lift
            ? {
                x: lift.x,
                z: +lift.z.toFixed(2),
                top: +(lift.z + lift.h).toFixed(2),
              }
            : null,
          claimed: collected.has(primary.id),
          enteredClaimed: enteredCollected.has(primary.id),
          pickups,
          bonus: config.pickups
            .filter((p) => p !== primary)
            .every((p) => collected.has(p.id)),
          barriers: Object.fromEntries(barriers.map((b) => [b.def.id, b.hp])),
          barricadeHP: barriers[0]?.hp ?? 0,
          context,
          checkpoint,
          debris: debris.filter((item) => !item.dead).length,
          room: game.cam.room,
          stats: stats ? { ...stats } : null,
          errors: game.errors.map((e) => e.message),
        };
      },
      teleport(x, z = entry.z, facing = 1) {
        Object.assign(hero, {
          x,
          z,
          vx: 0,
          vz: 0,
          facing,
          climbing: false,
          onGround: false,
          drop: 0,
          dashing: 0,
        });
        game.cam.snap = true;
        updateContext();
      },
      get level() {
        return level;
      },
      get hero() {
        return hero;
      },
      get rig() {
        return rig;
      },
    };
    return { scene, debug };
  }

  // Resolve a template setup from compiled content data (dist/content.json).
  function setupFrom(data, sceneId) {
    const records = new Map(
      data.packs.flatMap((pack) => pack.records).map((r) => [r.id, r]),
    );
    const definition = records.get(sceneId);
    if (definition?.kind !== "scene" || definition.template !== "mine")
      throw new Error(`${sceneId} is not an interior scene`);
    const region = records.get(definition.region);
    return {
      definition,
      region,
      grid: data.assets.find((asset) => asset.id === region.gridAsset).data,
      entry: records.get(definition.entry),
      music: definition.config.music
        ? records.get(definition.config.music).config
        : null,
    };
  }

  globalThis.WesternMine = { create, setupFrom };
})();
