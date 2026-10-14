import { logEvent } from "./state.mjs";
/** Saved cue IDs/indices; render-only camera and audio outputs are rebuilt from that state. */
export function releaseCueAttachments(state) {
  for (const [id, previous] of Object.entries(state.cue?.attachments || {})) {
    if (previous === null) delete state.attachments?.[id];
    else state.attachments[id] = previous;
  }
}
export class PresentationService {
  constructor(runtime, world, assets = {}) {
    this.runtime = runtime;
    this.world = world;
    this.assets = assets;
    this.reset();
  }
  reset() {
    this.frame = null;
    this.fade = 0;
    this.subtitle = "";
    this.sound = null;
    this.animation = null;
    this.duck = false;
  }
  entity(id) {
    return !id || id === "player"
      ? this.runtime.state.player
      : this.runtime.state.entities[id];
  }
  start(id) {
    if (!this.runtime.definition.cues?.[id])
      throw new Error(`Unknown cue: ${id}`);
    this.cancel();
    this.runtime.state.cue = { id, step: 0, elapsed: 0 };
  }
  preview(clip, entity = "player", mask = "upper") {
    if (
      ![
        ...(this.assets.animations || []),
        ...(this.assets.poses || []),
      ].includes(clip)
    )
      throw new Error("Choose a shipped clip or registered pose.");
    if (!this.entity(entity))
      throw new Error("The preview actor is unavailable.");
    this.cancel();
    this.runtime.state.cue = {
      id: "asset-preview",
      step: 0,
      elapsed: 0,
      lockInput: false,
      preview: clip,
      steps: [
        { kind: "animation", entity, clip, mask, weight: 0.9, duration: 3 },
      ],
    };
  }
  cancel() {
    releaseCueAttachments(this.runtime.state);
    this.runtime.state.cue = null;
    this.reset();
  }
  tick(dt) {
    const active = this.runtime.state.cue;
    if (!active) {
      this.reset();
      return;
    }
    const spec = active.steps
        ? { steps: active.steps }
        : this.runtime.definition.cues[active.id],
      step = spec?.steps[active.step];
    if (!step) {
      this.cancel();
      return;
    }
    this.reset();
    active.elapsed += dt;
    const entity = this.entity(step.entity),
      target = this.entity(step.target);
    try {
      if (active.camera) {
        const focus = this.entity(active.camera.entity);
        if (!focus) throw new Error("The camera subject is unavailable.");
        this.frame = { x: focus.x, y: focus.y, z: 22, ...active.camera };
      }
      let done = active.elapsed >= (step.duration ?? 0.5);
      switch (step.kind) {
        case "animation":
          this.animation = {
            entity: entity.id,
            clip: step.clip,
            mask: step.mask,
            weight: step.weight ?? 0.9,
            time: active.elapsed,
          };
          break;
        case "walk": {
          if (!target) throw new Error("Cue destination is missing.");
          const result = this.world.toward(entity, target, dt, 68, {
            ignore: [target.id],
            stop: 24,
          });
          done = result.arrived;
          if (active.elapsed > (step.duration || 8) && !done)
            throw new Error(
              "The cue path is blocked. Movement control has been restored.",
            );
          break;
        }
        case "face":
          if (!target) throw new Error("Cue facing target is missing.");
          entity.facing = Math.atan2(target.y - entity.y, target.x - entity.x);
          break;
        case "align": {
          if (!target) throw new Error("Interaction partner is missing.");
          const distance = step.offset?.[0] || 24,
            a = target.facing || 0;
          const x = target.x + Math.cos(a) * distance,
            y = target.y + Math.sin(a) * distance;
          if (
            !this.world.clearAt(x, y, 7, entity.scene, [entity.id, target.id])
          )
            throw new Error(
              "The paired interaction has no clear alignment point.",
            );
          Object.assign(entity, { x, y, facing: a + Math.PI });
          break;
        }
        case "frame":
          active.camera = {
            entity: entity.id,
            zoom: step.zoom || 1.3,
            offset: step.offset,
          };
          this.frame = {
            x: entity.x,
            y: entity.y,
            z: 22,
            zoom: step.zoom || 1.3,
            offset: step.offset,
          };
          break;
        case "fade":
          this.fade = Math.sin(
            Math.min(1, active.elapsed / (step.duration || 1)) * Math.PI,
          );
          break;
        case "subtitle":
          this.subtitle = step.text;
          this.duck = true;
          break;
        case "sound":
          this.sound = active.elapsed <= dt ? step.sound : null;
          this.duck = true;
          break;
        case "attach": {
          this.runtime.state.attachments ||= {};
          active.attachments ||= {};
          if (!Object.hasOwn(active.attachments, step.attachment))
            active.attachments[step.attachment] = structuredClone(
              this.runtime.state.attachments[step.attachment] || null,
            );
          this.runtime.state.attachments[step.attachment] = {
            entity: entity.id,
            socket: step.socket || "handR",
            color: step.color || "#d6be86",
          };
          break;
        }
        case "wait":
          break;
        default:
          throw new Error(`Unknown cue step: ${step.kind}`);
      }
      if (done) {
        active.step++;
        active.elapsed = 0;
        if (active.step >= spec.steps.length) {
          const state = this.runtime.state;
          state.completedCues ||= {};
          state.completedCues[active.id] =
            (state.completedCues[active.id] || 0) + 1;
          if (active.preview) {
            state.previewedClips ||= {};
            state.previewedClips[active.preview] = true;
          }
          logEvent(
            state,
            "Sequence complete",
            active.preview
              ? `${active.preview} preview finished.`
              : `${active.id} finished.`,
            { incident: "cue-complete", cue: active.id },
          );
          this.cancel();
        }
      }
    } catch (e) {
      this.runtime.warnings.push(e.message);
      this.cancel();
    }
  }
}
