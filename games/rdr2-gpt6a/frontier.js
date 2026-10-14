/* Scene adapter for authored roadside activities, responders, props and throws. */
(() => {
  "use strict";
  globalThis.WesternFrontier = {
    create(E, game, api) {
      const content = api.content || new DustRuntime.ContentIndex(DustContent),
        streams = new DustRuntime.RandomStreams(1887);
      const region = () => api.world.region;
      const definitions = content
        .list("actor")
        .filter(
          (d) =>
            ["traveler", "law"].includes(
              content.get(d.archetype, "archetype").behavior.op,
            ) && content.resolve(d.id).region === region(),
        )
        .sort(
          (a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id),
        );
      // Keep these world-owned presentations alive across campaign resets. The
      // original two rigs retain their original late construction/update order.
      let actors = new Map(
        definitions.map((d) => [
          d.id,
          DustRuntime.createActor(E, content, d, null, streams),
        ]),
      );
      const rigs = new Map([...actors].map(([id, a]) => [id, a.rig]));
      const space = new E.SpatialHash(64);
      let owner = null,
        campaign,
        inventory,
        activities,
        law,
        objects,
        throwables;
      const allActors = () => api.actors || actors;
      function witnesses() {
        if (api.witnesses) return api.witnesses;
        return content
          .list("actor")
          .filter(
            (d) =>
              (d.witness ??
                ["witness", "traveler"].includes(
                  content.get(d.archetype, "archetype").behavior.op,
                )) &&
              content.resolve(d.id).region === region(),
          )
          .map(
            (d) =>
              actors.get(d.id) || {
                id: d.id,
                legacyId: d.legacyId,
                ...content.resolve(d.id),
                r: 6,
              },
          );
      }
      function close() {
        api.ui?.hide();
        game.input.clear();
      }
      function ensure() {
        if (owner === api.state && campaign) return owner.frontier;
        activities?.exit();
        throwables?.dispose();
        owner = api.state;
        if (!owner) return null;
        const saved = DustRuntime.bindFrontier(owner, content);
        actors = new Map(
          definitions.map((d) => [
            d.id,
            DustRuntime.createActor(E, content, d, null, streams, {
              reuseRig: rigs.get(d.id),
            }),
          ]),
        );
        api.registerActors?.(actors);
        const owned = owner;
        campaign =
          api.campaign ||
          new DustRuntime.Campaign(content, {
            getState: () => owned,
            actors: allActors,
            hero: () => api.hero,
            onCommit: () => objects?.sync(),
            activityAvailable: (id) => activities?.available(id),
            effects: {
              notify: (p) => api.notify(p.title, p.text || ""),
              sound: (p) => game.audio.sfx(p.cue),
              save: api.save,
              "law.report": (p) =>
                law.report(
                  p.law,
                  allActors().get(p.witness) || content.resolve(p.witness),
                  p.reason,
                ),
              "activity.open": (p) => activities.open(p.activity),
            },
          });
        inventory = api.inventory || new DustRuntime.Inventory(campaign);
        activities =
          api.activities ||
          new DustRuntime.Activities(campaign, {
            game,
            inventory,
            random: streams,
            notify: api.notify,
            save: api.save,
            close,
            modal: (name, spec) => {
              api.ui.show(name, spec);
              game.input.clear();
            },
          });
        objects = new DustRuntime.WorldObjects(content, campaign, {
          map: () => api.world.map,
          region,
          notify: api.notify,
        });
        law = new DustRuntime.Law(E, campaign, {
          actors: allActors,
          witnesses,
          hero: () => api.hero,
          map: () => api.world.map,
          statuses: api.statuses,
          notify: api.notify,
          save: api.save,
        });
        throwables = new DustRuntime.Throwables(
          E,
          game,
          content,
          {
            state: () => api.state,
            hero: () => api.hero,
            map: () => api.world.map,
            defaultProfile: () =>
              api.defaultThrowable?.() ||
              content.list("archetype").find((a) => a.behavior.op === "player")
                .throwable,
            attackPower: () => api.attackPower?.() ?? 1,
            targets: (body, radius) => {
              space.build([...witnesses(), ...(api.foes || []), api.hero]);
              const result = [];
              space.near(body.x, body.y, radius, (a) => {
                if (a === api.hero || (api.foes || []).includes(a))
                  result.push(a);
              });
              return result;
            },
            hit: (target, damage, event) =>
              target === api.hero
                ? api.hurt(damage, event)
                : api.enemyHit(target, damage, event),
            onThrow: () => {
              owned.activities.dynamite = true;
            },
            onBlast: (body, profile) => {
              objects.blast(body, profile);
              law.blast(body);
            },
            notify: api.notify,
            save: api.save,
          },
          { sequence: saved.bombSeq, records: saved.bombs },
        );
        const savedThrows = owned.throwables;
        Object.defineProperty(saved, "bombs", {
          enumerable: true,
          configurable: true,
          get: () => savedThrows.records,
          set: (v) => {
            savedThrows.records = v;
          },
        });
        Object.defineProperty(saved, "bombSeq", {
          enumerable: true,
          configurable: true,
          get: () => savedThrows.sequence,
          set: (v) => {
            savedThrows.sequence = v;
          },
        });
        return saved;
      }
      function resolvedInteraction(id) {
        return content
          .list("interaction")
          .find((d) => d.id === id || d.legacyId === id);
      }
      function interact(id) {
        ensure();
        const d = resolvedInteraction(id);
        if (!d) return false;
        const effect = d.effects.find((e) => e.op === "activity.open");
        if (!effect) return false;
        const activity = content.get(effect.params.activity, "activity");
        if (activity.handler.op === "traveler")
          activities.openTraveler(activity.id);
        else activities.open(activity.id);
        return true;
      }
      function interactionEntries() {
        ensure();
        return content
          .list("interaction")
          .filter((d) => d.legacyId?.startsWith("frontier-"))
          .map((d) => {
            const at = content.get(d.at),
              point =
                at.kind === "actor"
                  ? allActors().get(at.id)
                  : content.resolve(d.at),
              guard = campaign.explain(d.when);
            return {
              ...d,
              id: d.legacyId,
              point: { ...point, region: content.resolve(d.at).region },
              availability: guard,
            };
          });
      }
      function update(dt) {
        if (!ensure() || game.sceneName !== "play") return;
        objects.sync();
        law.update(dt);
        for (const actor of actors.values())
          if (actor.behavior === "traveler") {
            const p = actor.archetype.behavior.params,
              outcome = activities.outcome(p.activity);
            actor.rig.update(dt, {
              x: actor.x,
              y: actor.y,
              z: actor.z || 0,
              facing: actor.facing,
              pose: p.poses[outcome] || actor.pose,
              expr: p.expressions[outcome] || null,
            });
          }
        throwables.update(dt);
      }
      function draw(r) {
        if (!ensure()) return;
        for (const actor of actors.values())
          if (actor.behavior === "traveler") {
            const p = actor.archetype.behavior.params;
            r.shadow(actor.x, actor.y, 7, 0.22);
            WesternWorld.drawCowboy(r, E, actor, actor.rig, {
              xray: false,
              every: 2,
              key: actor.rig,
            });
            if (
              activities.available(p.activity).ok &&
              E.dist(api.hero, actor) < p.markerDistance
            )
              r.marker(actor.x, actor.y, p.markerHeight, {
                label: p.marker,
                color: p.markerColor,
              });
          }
        objects.draw(r, (renderer, item) => globalThis.WesternWorld.drawItem(renderer, game, api.world, api.state, item));
        law.draw(r);
        throwables.draw(r);
      }
      const legacyTraveler = () =>
        definitions.find((d) => d.legacyId === "frontier-traveler");
      const legacyLaw = () =>
        definitions.find((d) => d.legacyId === "frontier-law");
      ensure();
      return {
        hydrate: ensure,
        update,
        draw,
        interact,
        interactionEntries,
        interactions: () =>
          interactionEntries()
            .filter((d) => d.availability.ok && E.dist(api.hero, d.point) <= 80)
            .map((d) => ({
              ...d.point,
              id: d.id,
              label: d.label,
              range: d.radius,
            })),
        throwDynamite(profile) {
          ensure();
          return game.sceneName === "play" && throwables.throw(profile);
        },
        gunfire(at) {
          ensure();
          law.gunfire(at);
        },
        report(p) {
          ensure();
          return law.report(
            p.law,
            allActors().get(p.witness) || content.resolve(p.witness),
            p.reason,
          );
        },
        syncObjects() {
          objects?.sync();
        },
        get objects() {
          ensure();
          return objects;
        },
        get law() {
          ensure();
          return law;
        },
        debug: {
          snapshot: () => {
            ensure();
            return JSON.parse(JSON.stringify(owner.frontier));
          },
          report: (w, r) => {
            ensure();
            return law.report(legacyLaw()?.id, w, r);
          },
          finishTraveler: (help) => {
            ensure();
            const d = legacyTraveler(),
              p = content.get(d.archetype, "archetype").behavior.params;
            return activities.choose(p.activity, help ? "help" : "rob");
          },
          get witnesses() {
            ensure();
            return witnesses();
          },
          get law() {
            ensure();
            return actors.get(legacyLaw()?.id);
          },
          get bombs() {
            ensure();
            return [...throwables.bodies.values()];
          },
          get hash() {
            return space;
          },
        },
      };
    },
  };
})();
