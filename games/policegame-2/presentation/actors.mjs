export function custodyPose(lib, cuffed, t) {
  const pose = lib.sample(lib.clip("Idle_FoldArms_Loop"), t);
  const put = (name, p) => {
    const i = lib.idx[name] * 3;
    pose[i] = p[0];
    pose[i + 1] = p[1];
    pose[i + 2] = p[2];
  };
  for (const [side, sign] of [
    ["L", -1],
    ["R", 1],
  ]) {
    const sh = lib.pt(pose, "sh" + side),
      w = cuffed
        ? [sh[0] + 340, sign * 58, sh[2] - 330]
        : [sh[0] + 75, sign * 430, sh[2] + 390];
    put(
      "elbow" + side,
      cuffed
        ? [sh[0] + 110, sign * 260, sh[2] - 305]
        : [sh[0] + 55, sign * 510, sh[2] + 25],
    );
    for (const joint of ["wrist", "fist", "knuck", "index", "pinky"])
      put(joint + side, [w[0], w[1], w[2] + (joint === "wrist" ? 0 : 35)]);
  }
  return pose;
}

export class ActorRenderer {
  constructor(E, lib) {
    this.E = E;
    this.lib = lib;
    this.rigs = new Map();
  }
  rig(actor) {
    const armed = !!actor.weapon?.equipped,
      key = actor.id;
    if (!this.rigs.has(key) || this.rigs.get(key).armed !== armed) {
      const rig = new this.E.Humanoid({
        size: 1.3,
        build: "heroic",
        outfit: "shirt",
        hair: "short",
        sleeves: "long",
        colors: {
          cloth: "#314e61",
          pants: "#283f4b",
          boot: "#24363a",
          belt: "#232e33",
          trim: "#d9ba7c",
          skin: "#b99576",
          hair: "#493f36",
        },
        ...actor.look,
        weapon: armed ? "gun" : actor.look?.weapon || null,
      });
      Mocap.drive(rig, this.lib);
      this.rigs.set(key, { rig, armed, weight: 0 });
    }
    return this.rigs.get(key);
  }
  update(actor, dt, sim) {
    const entry = this.rig(actor),
      rig = entry.rig,
      lib = this.lib,
      t = sim.state.seconds;
    const cue =
      sim.presentation.animation?.entity === actor.id
        ? sim.presentation.animation
        : null;
    let pose = null,
      weight = 0,
      mask = "upper";
    if (cue) {
      pose = cue.clip.startsWith("pose:")
        ? custodyPose(lib, cue.clip === "pose:restrained", cue.time)
        : lib.sample(lib.clip(cue.clip), cue.time);
      weight = cue.weight;
      mask = cue.mask;
    } else if (actor.mode === "comply" || actor.custody?.restrained) {
      pose = custodyPose(lib, !!actor.custody?.restrained, t);
      weight = 0.9;
    } else if (
      sim.state.dialogue?.open &&
      sim.dialogue.view()?.speaker?.id === actor.id
    ) {
      pose = lib.sample(lib.clip("Idle_Talking_Loop"), t);
      weight = 0.7;
    } else if (actor.id === "player" && sim.state.activeAction) {
      pose = lib.sample(lib.clip(sim.state.activeAction.clip || "Interact"), t);
      weight = 0.8;
    } else if (actor.id === "player" && sim.presentation.uiPanel === "radio") {
      pose = lib.sample(lib.clip("Idle_TalkingPhone_Loop"), t);
      weight = 0.8;
    } else if (actor.animation) {
      pose = lib.sample(lib.clip(actor.animation), t);
      weight = 0.75;
    }
    entry.weight = this.E.approach(entry.weight, weight, dt * 4);
    if (pose) {
      if (entry.pose) pose = lib.blend(entry.pose, pose, Math.min(1, dt * 14));
      entry.pose = pose;
    }
    rig.mocap = pose || entry.pose;
    rig.mocapW = entry.weight;
    rig.mocapMask = mask;
    rig.update(dt, {
      ...actor,
      pose: actor.mode === "incapacitated" ? "down" : actor.pose,
      point: actor.aiming,
      attack: actor.id === "player" ? sim.action.attack.state : undefined,
    });
  }
  draw(r, actor) {
    if (actor.vehicle || actor.handedOver || actor.active === false) return;
    const rig = this.rig(actor).rig;
    if (!r.visible(actor.x, actor.y, 20, 90)) return;
    r.shadow(actor.x, actor.y, 8, 0.3);
    r.actor(
      actor.x,
      actor.y,
      actor.z || 0,
      (g, x, y) => rig.draw(g, x, y, r.view),
      {
        xray: {
          color: actor.id === "player" ? "#e9c980" : "#a6c5b7",
          outline: "#f0e7c5",
        },
        every: actor.id === "player" ? 1 : 2,
        key: rig,
      },
    );
    if (actor.id === "player")
      r.groundRing(actor.x, actor.y, 10, "#f0d18c", 0.25);
  }
  attachment(r, attachment) {
    const entry = this.rigs.get(attachment.entity);
    if (!entry) return;
    const p =
      attachment.socket === "head"
        ? entry.rig.head()
        : entry.rig.hand(attachment.socket === "handL" ? "L" : "R");
    r.queue(p[0], p[1], p[2], (g) =>
      r.box(
        g,
        p[0] - 2,
        p[1] - 2,
        p[2] - 2,
        p[0] + 2,
        p[1] + 2,
        p[2] + 4,
        attachment.color,
        "#415c60",
      ),
    );
  }
}
