import { CaseRuntime } from "./cases.mjs";
import { WorldService } from "./world.mjs";
import { VehicleService } from "./vehicles.mjs";
import { ActorService } from "./actors.mjs";
import { EncounterService } from "./encounters.mjs";
import { ActionService } from "./action.mjs";
import { DialogueService } from "./dialogue.mjs";
import { InteractionService } from "./interactions.mjs";
import { checkpoint, restoreCheckpoint } from "./saves.mjs";
import { clone } from "./state.mjs";
import { PresentationService } from "./presentation.mjs";

export class Simulation {
  constructor(definition, adapter, saved, options = {}) {
    this.runtime = new CaseRuntime(definition, saved, options);
    this.world = new WorldService(this.runtime, adapter);
    this.vehicles = new VehicleService(this.runtime, this.world);
    this.actors = new ActorService(this.runtime, this.world, this.vehicles);
    this.encounters = new EncounterService(
      this.runtime,
      this.world,
      this.vehicles,
    );
    this.action = new ActionService(this.runtime, this.world, options.game);
    this.dialogue = new DialogueService(this.runtime, this.world, this.actors);
    this.interactions = new InteractionService(
      this.runtime,
      this.world,
      this.dialogue,
    );
    this.presentation = new PresentationService(
      this.runtime,
      this.world,
      options.assets,
    );
    this.services = {
      "vehicle.enter": (p) => this.vehicles.enter(p.id, p.actor, p.seat),
      "vehicle.exit": (p) => this.vehicles.exit(p.actor),
      "vehicle.recover": (p) => this.vehicles.recover(p.id),
      "vehicle.siren": (p) => {
        const v = this.vehicles.get(p.id);
        if (
          this.state.player.vehicle !== p.id &&
          Math.hypot(this.state.player.x - v.x, this.state.player.y - v.y) > 65
        )
          throw new Error("Approach your vehicle first.");
        v.siren = !v.siren;
      },
      "vehicle.pullOver": (p) => this.vehicles.pullOver(p.id),
      "actor.contact": (p) => this.actors.contact(p.id),
      "custody.restrain": (p) => this.actors.restrain(p.id),
      "custody.search": (p) => this.actors.search(p.id),
      "custody.caution": (p) => this.actors.caution(p.id),
      "custody.escort": (p) => this.actors.escort(p.id),
      "custody.seat": (p) => this.actors.seat(p.id, p.vehicle, p.seat),
      "custody.handoff": (p) => this.actors.handoff(p.id, p.facility),
      "medical.aid": (p) => this.actors.aid(p.id),
      "encounter.start": (p) => this.encounters.start(p.id),
      "encounter.cancel": (p) => this.encounters.cancel(p.id),
      "encounter.resolve": (p) => this.encounters.resolve(p.id, p.mode),
      "encounter.retry": (p) => this.encounters.retry(p.id),
      "action.equip": (p) => this.action.equip(p.on),
      "action.aim": (p) => this.action.aim(p.angle, p.on),
      "action.fire": () => this.action.fire(),
      "action.reload": () => this.action.reload(),
      "action.control": (p) => this.action.control(p.id),
      "dialogue.start": (p) => this.dialogue.start(p.id),
      "dialogue.choose": (p) => this.dialogue.choose(p.id),
      "dialogue.close": () => this.dialogue.close(),
      "interaction.begin": (p) => this.interactions.begin(p.id, p.payload),
      "interaction.cancel": () => this.interactions.cancel(),
      "action.schedule": (p) =>
        this.interactions.schedule(p.action, p.payload, p.after),
      "equipment.flashlight": () => {
        this.actors.tool("flashlight");
        this.state.player.flashlight = !this.state.player.flashlight;
      },
      "cue.start": (p) => this.presentation.start(p.id),
      "cue.cancel": () => this.presentation.cancel(),
      "cue.preview": (p) => this.presentation.preview(p.clip, p.entity, p.mask),
      "checkpoint.save": (p) => checkpoint(this.runtime, p.id),
      "checkpoint.restore": (p) => {
        const result = restoreCheckpoint(this.runtime, p.id);
        if (!result.ok) throw new Error(result.text);
        this.action.resetPresentation();
      },
    };
    this.runtime.context = {
      canSee: (a, b) => this.world.canSee(a, b),
      schedule: (action, payload, after) =>
        this.interactions.schedule(action, payload, after),
      service: (id, payload) => {
        return this.invokeService(id, payload);
      },
    };
    this.syncAnchors();
    this.state.reactionCursor ??= this.state.events.length;
    if (!saved && definition.initialCheckpoint)
      checkpoint(this.runtime, definition.initialCheckpoint);
  }
  get state() {
    return this.runtime.state;
  }
  invokeService(id, payload = {}) {
    if (!Object.hasOwn(this.services, id))
      throw new Error(`Unknown service: ${id}`);
    const guard = this.runtime.definition.serviceGuards?.[id];
    if (guard && !this.runtime.satisfies(guard.requires))
      throw new Error(
        guard.blocked ||
          "Complete the case prerequisites before this operation.",
      );
    return this.services[id](payload);
  }
  command(id, payload = {}) {
    const before = this.runtime.serialize();
    try {
      let result;
      if (Object.hasOwn(this.services, id))
        result = this.invokeService(id, payload);
      else {
        result = this.runtime.act(id, payload);
        if (!result.ok) return result;
        return result;
      }
      this.state.commandLog.push({
        at: this.state.seconds,
        service: id,
        payload: clone(payload),
      });
      return { ok: true, result };
    } catch (e) {
      this.runtime.state = before;
      return this.runtime.deny(e.message);
    }
  }
  tick(dt, controls = {}) {
    if (dt === 0) return;
    this.runtime.tick(dt);
    this.syncAnchors();
    const cueLocked =
      this.state.cue &&
      (this.state.cue.lockInput ??
        this.runtime.definition.cues[this.state.cue.id]?.lockInput) !== false;
    if (
      !controls.blocked &&
      !this.state.dialogue?.open &&
      !this.state.activeAction &&
      !cueLocked
    ) {
      const p = this.state.player;
      if (p.vehicle && p.seat === "driver")
        this.vehicles.drive(p.vehicle, controls.drive || {}, dt);
      else if (controls.move) {
        const speed = controls.sprint ? 117 : 73;
        this.world.move(
          p,
          controls.move[0] * speed,
          controls.move[1] * speed,
          dt,
        );
      }
    } else {
      this.state.player.vx = this.state.player.vy = 0;
      const vehicle =
        this.state.player.vehicle &&
        this.state.entities[this.state.player.vehicle];
      if (vehicle && this.state.player.seat === "driver") {
        vehicle.speed = 0;
        vehicle.vx = vehicle.vy = 0;
      }
    }
    this.actors.tick(dt);
    this.vehicles.tick(dt);
    this.encounters.tick(dt);
    this.action.tick(dt);
    this.presentation.tick(dt);
    this.lastInteraction = this.interactions.tick(dt, controls.hold !== false);
    for (const objective of this.runtime.objectives)
      if (
        objective.failed &&
        objective.onTimeout &&
        !this.state.consumed.includes(`timeout:${objective.id}`)
      ) {
        const result = this.runtime.act(objective.onTimeout);
        if (result.ok) this.state.consumed.push(`timeout:${objective.id}`);
      }
    for (const trigger of this.runtime.definition.triggers || []) {
      if (this.state.consumed.includes(`trigger:${trigger.id}`)) continue;
      if (this.runtime.satisfies(trigger.when)) {
        const result = this.runtime.act(trigger.action);
        if (result.ok && trigger.once !== false)
          this.state.consumed.push(`trigger:${trigger.id}`);
      }
    }
    const events = this.state.events.slice(this.state.reactionCursor || 0);
    this.state.reactionCursor = this.state.events.length;
    for (const event of events) {
      const response = this.runtime.definition.reactions?.[event.incident];
      if (response) this.runtime.act(response);
    }
  }
  syncAnchors() {
    for (const entity of Object.values(this.state.entities))
      if (entity.attachedTo) {
        const parent = this.state.entities[entity.attachedTo];
        if (!parent) continue;
        const a = parent.angle || parent.facing || 0,
          [x, y] = entity.offset || [0, 0];
        Object.assign(entity, {
          scene: parent.scene,
          x: parent.x + Math.cos(a) * x - Math.sin(a) * y,
          y: parent.y + Math.sin(a) * x + Math.cos(a) * y,
        });
      }
  }
}
