import { ActorRenderer } from "./actors.mjs";

export class SceneRenderer {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.actors = new ActorRenderer(My3D2dge, Mocap.load(MOCAP.HARBOR));
    this.scenery = new Map();
  }
  update(dt) {
    for (const actor of [
      this.sim.state.player,
      ...this.sim.world.entities().filter((e) => e.kind === "person"),
    ])
      this.actors.update(actor, dt, this.sim);
  }
  draw(r, { title = false } = {}) {
    const sim = this.sim,
      state = sim.state,
      world = sim.world,
      loc = world.location(),
      E = My3D2dge;
    this.game.lights.ambient = loc.lighting?.ambient ?? 0.86;
    this.game.lights.tint = loc.lighting?.tint || "#1c4259";
    if (loc.style === "harbor") {
      if (!this.scenery.has(loc.id))
        this.scenery.set(
          loc.id,
          new HarborWorld.HarborWorld(loc, () => world.map(loc.id)),
        );
      this.scenery.get(loc.id).draw(r, {
        time: state.seconds,
        visible: (condition) => sim.runtime.satisfies(condition),
      });
    } else {
      r.sky(loc.sky || ["#25464d", "#597970"]);
      world.map().drawFloor(r);
      if (loc.style === "district") {
        for (const shape of world.solidShapes()) {
          if (shape.name)
            HarborWorld.building(r, {
              kind: "office",
              color: "#78877b",
              roof: "#516861",
              sub: "",
              ...shape,
            });
          else
            r.queue(
              shape.x + shape.w / 2,
              shape.y + shape.d / 2,
              0,
              (g) =>
                r.box(
                  g,
                  shape.x,
                  shape.y,
                  0,
                  shape.x + shape.w,
                  shape.y + shape.d,
                  shape.h,
                  shape.roof || shape.color || "#849183",
                  shape.color || "#64786c",
                ),
              { hides: true },
            );
        }
      } else world.map().queueWalls(r);
      for (const prop of loc.props || [])
        if (!prop.solid && prop.name)
          r.prop(prop.name, prop.x, prop.y, 0, {
            size: prop.size || 1,
            color: prop.color,
            halo: false,
          });
    }
    for (const e of world.entities()) {
      if (e.kind === "person") {
        this.actors.draw(r, e);
        if (e.properties?.showState)
          r.textAt(
            e.x,
            e.y,
            52,
            `${e.label} / ${e.mode === "incapacitated" ? "NEEDS AID" : e.awareness >= 0.3 ? "ALERT" : e.mode.toUpperCase()}`,
            e.awareness >= 0.3 ? "#e6a281" : "#d7cfb3",
          );
        if (
          sim.runtime.definition.presentation?.showPerception &&
          e.properties?.perception &&
          e.mode !== "incapacitated"
        )
          r.sightCone(e, {
            map: world.map(),
            range: e.properties.perception.range || 120,
            fov: e.properties.perception.fov || 1.6,
          });
        continue;
      }
      if (e.kind === "vehicle") {
        HarborWorld.car(r, e, state.seconds, {
          lights: e.siren,
          civilian: !["patrol", "support"].includes(e.role),
          number: e.number,
          van: e.van,
          headlights: true,
          occupied: !!Object.keys(e.occupants || {}).length,
          color: e.color,
        });
        continue;
      }
      if (e.kind === "light") {
        if (e.active !== false)
          this.game.lights.add(e.x, e.y, 30, 80, 0.3, {
            color: e.color || "#e7d39b",
          });
        continue;
      }
      if (["surface", "container", "prop"].includes(e.kind)) {
        const exhibit = Object.entries(sim.runtime.definition.evidence).find(
          ([id, spec]) => (spec.entity || id) === e.id,
        );
        if (
          exhibit &&
          !["statement", "observation", "comparison"].includes(
            exhibit[1].kind,
          ) &&
          state.evidence[exhibit[0]]?.holder !== "scene" &&
          state.evidence[exhibit[0]]?.holder
        )
          continue;
        if (e.shape) {
          this.drawExhibit(r, e);
          continue;
        }
        const h = e.h || 16,
          w = e.w || 24,
          d = e.d || 16;
        if (!e.solid)
          r.queue(e.x, e.y, 0, (g) => {
            r.box(
              g,
              e.x - w / 2,
              e.y - d / 2,
              0,
              e.x + w / 2,
              e.y + d / 2,
              h,
              e.color || "#ac9a76",
              "#6e7360",
            );
            if (e.kind === "surface")
              r.box(
                g,
                e.x - 7,
                e.y - 4,
                h,
                e.x + 7,
                e.y + 4,
                h + 1,
                "#eee0b7",
                "#b3a88c",
              );
          });
      }
      if (e.kind === "container" && e.open) {
        const w = e.w || 24,
          d = e.d || 16,
          h = e.h || 16;
        r.queue(e.x, e.y, h, (g) =>
          r.box(
            g,
            e.x - w / 2,
            e.y - d / 2,
            h,
            e.x + w / 2,
            e.y - d / 2 + 2,
            h + 14,
            e.color || "#ac9a76",
            "#6e7360",
          ),
        );
      }
      if (e.label && e.kind !== "door" && loc.style !== "harbor")
        r.textAt(e.x, e.y, 48, e.label.toUpperCase(), "#e9d4a3");
    }
    this.actors.draw(r, state.player);
    for (const attachment of Object.values(state.attachments || {}))
      this.actors.attachment(r, attachment);
    sim.action.shots.draw(r);
    if (state.player.flashlight) {
      const p = state.player;
      this.game.lights.add(
        p.x + Math.cos(p.facing) * 40,
        p.y + Math.sin(p.facing) * 40,
        22,
        55,
        0.5,
        { color: "#fff0b5" },
      );
    }
    if (title) return;
    const objective = world.objectiveTarget();
    if (objective && objective.scene === state.scene && !state.outcome) {
      r.groundRing(objective.x, objective.y, 18, "#e0b66f", 0.4);
      r.queue(
        objective.x,
        objective.y,
        37,
        (g) => {
          const [x, y] = r.w(
            objective.x,
            objective.y,
            37 + Math.sin(state.seconds * 2) * 2,
          );
          E.px.poly(
            g,
            [
              [x, y - 5],
              [x + 4, y],
              [x, y + 5],
              [x - 4, y],
            ],
            "#f5d58f",
          );
        },
        { emissive: true },
      );
      const p = r.w(objective.x, objective.y, 20);
      if (p[0] < 30 || p[1] < 75 || p[0] > r.W - 30 || p[1] > r.H - 90)
        r.overlay((g) => {
          const x = E.clamp(p[0], 28, r.W - 28),
            y = E.clamp(
              p[1],
              this.game.upright ? 112 : 80,
              r.H - (this.game.upright ? 165 : 72),
            );
          E.px.disc(g, x, y, 9, "#214147");
          E.px.poly(
            g,
            [
              [x, y - 5],
              [x + 4, y],
              [x, y + 5],
              [x - 4, y],
            ],
            "#ecc780",
          );
        });
    }
    const near = sim.interactions.selected();
    if (near && !state.dialogue?.open) {
      r.groundRing(near.entity.x, near.entity.y, 12, "#e9c58c", 0.7);
      r.textAt(
        near.entity.x,
        near.entity.y,
        40,
        this.game.input.label("interact"),
        "#ffdf9e",
      );
    }
    if (sim.debugOverlay) {
      const selected =
        sim.debugEntity === "player"
          ? state.player
          : state.entities[sim.debugEntity];
      if (selected?.scene === state.scene)
        r.groundRing(selected.x, selected.y, 16, "#f8d37f", 0.8);
      const target =
        selected?.scene === state.scene ? selected : world.objectiveTarget();
      if (target) {
        const map = world.map();
        if (this.debugMap !== map) {
          this.debugMap = map;
          this.debugFlow = new E.FlowField(map);
        }
        this.debugFlow.update(target.x, target.y);
        let from = state.player;
        const visited = new Set();
        for (let i = 0; i < 40; i++) {
          const next = this.debugFlow.next(from.x, from.y);
          if (!next) break;
          const key = next.x + ":" + next.y;
          if (visited.has(key)) break;
          visited.add(key);
          const a = [from.x, from.y, 2],
            b = [next.x, next.y, 2];
          r.decal((g) => HarborWorld.line(r, g, a, b, "#83cede", 2));
          from = next;
        }
      }
      for (const shape of world.solidShapes())
        r.queue(shape.x, shape.y, 0, (g) => {
          const points = [
            [shape.x, shape.y],
            [shape.x + shape.w, shape.y],
            [shape.x + shape.w, shape.y + shape.d],
            [shape.x, shape.y + shape.d],
          ].map((p) => r.w(...p, 1));
          E.px.poly(g, points, "#d87e7377");
        });
      for (const actor of world
        .entities()
        .filter((e) => e.kind === "person" && e.properties?.perception))
        r.sightCone(actor, {
          map: world.map(),
          range: actor.properties.perception.range || 120,
        });
    }
  }
  drawExhibit(r, e) {
    const { x, y } = e,
      E = My3D2dge;
    r.queue(x, y, 0, (g) => {
      if (e.shape === "seal") {
        const p = r.w(x, y, 1);
        E.px.ell(g, p[0], p[1], 5, 3, "#5fbbcb");
        E.px.line(g, p[0] + 2, p[1], p[0] + 7, p[1] + 1, "#203e4d", 2);
      } else if (e.shape === "document") {
        HarborWorld.quad(
          r,
          g,
          [
            [x - 6, y - 7, 1],
            [x + 6, y - 7, 1],
            [x + 6, y + 7, 1],
            [x - 6, y + 7, 1],
          ],
          "#eddfb5",
        );
        for (let dy = -4; dy < 5; dy += 3)
          HarborWorld.line(
            r,
            g,
            [x - 3, y + dy, 1],
            [x + 3, y + dy, 1],
            "#87938a",
          );
      } else if (e.shape === "radio-crate") {
        r.box(g, x - 16, y - 12, 0, x + 16, y + 12, 20, "#afa27e", "#897852");
        r.box(g, x - 14, y - 10, 20, x + 14, y + 10, 23, "#525f54", "#837958");
        for (let dx = -11; dx < 13; dx += 8)
          r.box(
            g,
            x + dx,
            y - 8,
            22,
            x + dx + 5,
            y + 4,
            29,
            "#54787a",
            "#29464f",
          );
        if (e.serial)
          HarborWorld.billboard(
            r,
            g,
            x,
            y + 13,
            12,
            e.serial,
            null,
            "#263f42",
            "#dbcf9d",
          );
      }
    });
  }
}
