import { BIOMES, ENEMY_TYPES, FAMILY_NAMES, FIRST_NAMES, QUEST_WORDS } from "./data.js";
import { Rng, deriveSeed, distance2D } from "./util.js";

function validateQuest(s, e) {
  let t = [];
  if (!s.id || !s.title || !s.description) {
    t.push("Missing identity or text");
  }
  if (!Number.isFinite(s.location.x) || !Number.isFinite(s.location.z)) {
    t.push("Invalid location");
  }
  if (s.required <= 0 || s.progress < 0) {
    t.push("Invalid progress bounds");
  }
  if (s.rewards.xp <= 0 || s.rewards.gold < 0) {
    t.push("Invalid rewards");
  }
  if (s.targetPoiId && e && !e.getPoiById(s.targetPoiId)) {
    t.push("Target point of interest does not exist");
  }
  if (["clear", "retrieve", "investigate", "activate", "boss", "defend"].includes(s.type) && !s.targetPoiId) {
    t.push("Objective requires a target location");
  }
  if (s.type === "hunt" && !s.targetArchetypeId) {
    t.push("Hunt objective requires an enemy archetype");
  }
  if ((s.type === "retrieve" || s.type === "gather") && !s.targetItemId) {
    t.push("Item objective requires an item id");
  }
  return {
    valid: t.length === 0,
    reasons: t,
  };
}

export class QuestSystem {
  constructor(e, t, n, i) {
    this.world = e;
    this.persistence = n;
    this.events = i;
    this.quests = t;
  }
  world;
  persistence;
  events;
  quests;
  ensureForSettlement(e, t) {
    let n = this.quests.filter((l) => l.giverPoiId === e.id && l.state !== "completed");
    let i = 2 + (e.tier ?? 1);
    if (n.length >= i) {
      return n;
    }
    let r = this.persistence.completedQuestIds.filter((l) => l.includes(e.id)).length;
    let a = this.persistence.generatedQuestSeeds[e.id] ?? [];
    this.persistence.generatedQuestSeeds[e.id] = a;
    if (e.id === this.world.getStartingSettlement().id && a.length === 0) {
      let l = this.generateStartingContracts(e, t);
      for (let c of l) {
        a.push(c.seed);
        if (!this.quests.some((h) => h.id === c.id) && !this.persistence.completedQuestIds.includes(c.id)) {
          this.quests.push(c);
        }
      }
    }
    let o = a.length;
    while (this.quests.filter((l) => l.giverPoiId === e.id && l.state !== "completed").length < i && o < i + r + 8) {
      let l = deriveSeed(e.seed, "quest", o + r * 7);
      if (!a.includes(l)) {
        a.push(l);
      }
      let c = this.generateQuest(l, e, o, t);
      if (
        c &&
        validateQuest(c, this.world).valid &&
        !this.quests.some((h) => h.id === c.id) &&
        !this.persistence.completedQuestIds.includes(c.id)
      ) {
        this.quests.push(c);
      }
      o += 1;
    }
    return this.quests.filter((l) => l.giverPoiId === e.id && l.state !== "completed");
  }
  accept(e) {
    let t = this.quests.find((n) => n.id === e);
    if (!t || t.state !== "available") {
      return false;
    } else {
      t.state = "active";
      this.events.emit("questChanged", t);
      this.events.emit("toast", {
        title: "Quest accepted",
        detail: t.title,
      });
      return true;
    }
  }
  abandon(e) {
    let t = this.quests.find((n) => n.id === e);
    if (!t || !["active", "ready"].includes(t.state)) {
      return false;
    } else {
      t.state = "available";
      t.progress = 0;
      t.currentStage = 1;
      this.events.emit("questChanged", t);
      return true;
    }
  }
  turnIn(e, t) {
    let n = this.quests.find((i) => i.id === e);
    if (!!n && n.state === "ready" && n.giverPoiId === t) {
      n.state = "completed";
      n.completedAt = Date.now();
      if (!this.persistence.completedQuestIds.includes(n.id)) {
        this.persistence.completedQuestIds.push(n.id);
      }
      this.events.emit("questChanged", n);
      this.events.emit("toast", {
        title: "Quest complete",
        detail: n.title,
        tone: "good",
      });
      return {
        ...n.rewards,
      };
    }
  }
  onEnemyKilled(e) {
    for (let t of this.activeQuests()) {
      if (t.type === "hunt" && e.archetypeId === t.targetArchetypeId && distance2D(e.position2D, t.location) <= 90) {
        this.addProgress(t, 1);
      } else if (t.type === "defend" && distance2D(e.position2D, t.location) <= 65) {
        this.addProgress(t, 1);
      } else if (
        t.type === "boss" &&
        e.archetypeId.startsWith("boss-") &&
        (!t.targetPoiId || e.guardingPoiId === t.targetPoiId)
      ) {
        this.addProgress(t, 1);
      }
    }
  }
  onPoiDiscovered(e) {
    for (let t of this.activeQuests()) {
      if (t.targetPoiId === e.id) {
        if (t.type === "investigate") {
          this.addProgress(t, 1);
        }
        if (t.stages > 1 && t.currentStage === 1) {
          t.currentStage = 2;
          t.progress = 0;
          t.description = `The site is real. Enter ${e.name} and remove the threat within.`;
          this.events.emit("questChanged", t);
          this.events.emit("toast", {
            title: "Quest updated",
            detail: `${t.title}: enter the location`,
          });
        }
      }
    }
  }
  onPoiCleared(e) {
    for (let t of this.activeQuests()) {
      if (t.targetPoiId === e) {
        if (t.type === "clear" && (t.stages === 1 || t.currentStage >= 2)) {
          this.addProgress(t, 1);
        }
        if (t.type === "boss") {
          this.addProgress(t, 1);
        }
      }
    }
  }
  onActivatedPoi(e) {
    for (let t of this.activeQuests()) {
      if (t.type === "activate" && t.targetPoiId === e) {
        this.addProgress(t, 1);
      }
    }
  }
  onQuestItem(e, t = 1) {
    for (let n of this.activeQuests()) {
      if ((n.type === "retrieve" || n.type === "gather") && n.targetItemId === e) {
        this.addProgress(n, t);
      }
    }
  }
  getQuestItemsForPoi(e) {
    return this.activeQuests()
      .filter((t) => t.targetPoiId === e && (t.type === "retrieve" || t.type === "gather") && t.targetItemId)
      .map((t) => ({
        questId: t.id,
        itemId: t.targetItemId,
        name: t.targetItemId.replace(/^quest:(?:\d+:)?/, "").replaceAll("-", " "),
        count: t.required,
        remaining: Math.max(0, t.required - t.progress),
      }));
  }
  getActiveTracker(e = 3) {
    return this.quests.filter((t) => t.state === "active" || t.state === "ready").slice(0, e);
  }
  getByState(e) {
    return this.quests.filter((t) => t.state === e);
  }
  activeQuests() {
    return this.quests.filter((e) => e.state === "active");
  }
  addProgress(e, t) {
    if (e.state === "active") {
      e.progress = Math.min(e.required, e.progress + t);
      if (e.progress >= e.required) {
        e.state = "ready";
      }
      this.events.emit("questChanged", e);
      this.events.emit("toast", {
        title: e.state === "ready" ? "Objective complete" : "Quest updated",
        detail: e.state === "ready" ? `Return to ${e.giverName}` : `${e.title}: ${e.progress}/${e.required}`,
        tone: e.state === "ready" ? "good" : "normal",
      });
    }
  }
  generateStartingContracts(e, t) {
    let n = new Rng(deriveSeed(e.seed, "starter-contracts"));
    let i = this.world.getPoisAround(e.x, e.z, 260).filter((d) => d.kind !== "settlement");
    let r = i.find((d) => ["dungeon", "mine", "ruin", "portal"].includes(d.kind)) ?? i[0];
    let a = n.pick(BIOMES[e.biome].enemyIds);
    let o = this.questGiverName(e, n);
    let l = deriveSeed(e.seed, "starter");
    let c = {
      id: `quest:${e.id}:starter-hunt`,
      seed: deriveSeed(l, 1),
      title: `Teeth on the ${e.name} Road`,
      description: `${ENEMY_TYPES[a]?.name ?? "Creatures"} are stalking travelers. Thin the pack near the settlement.`,
      type: "hunt",
      state: "available",
      difficulty: 1,
      giverPoiId: e.id,
      giverName: o,
      faction: e.faction ?? "Wayfarers Guild",
      targetArchetypeId: a,
      locationName: `${e.name} outskirts`,
      location: {
        x: e.x,
        z: e.z,
      },
      required: 3,
      progress: 0,
      stages: 1,
      currentStage: 1,
      rewards: this.rewardsFor(1, 1, t, l),
    };
    // A seed with no landmark near the start still gets its hunt contract (this used to throw).
    if (!r) {
      return [c];
    }
    let h = {
      id: `quest:${e.id}:starter-investigate`,
      seed: deriveSeed(l, 2),
      title: "Smoke Beyond the Waystones",
      description: `Scouts marked ${r.name} but did not return. Find the entrance and report what remains.`,
      type: "investigate",
      state: "available",
      difficulty: Math.max(1, r.danger),
      giverPoiId: e.id,
      giverName: o,
      faction: e.faction ?? "Wayfarers Guild",
      targetPoiId: r.id,
      locationName: r.name,
      location: {
        x: r.x,
        z: r.z,
      },
      required: 1,
      progress: 0,
      stages: 1,
      currentStage: 1,
      rewards: this.rewardsFor(r.danger, distance2D(e, r) / 70, t, deriveSeed(l, 2)),
    };
    let u = {
      id: `quest:${e.id}:starter-clear`,
      seed: deriveSeed(l, 3),
      title: `The Heart of ${r.name}`,
      description: `Investigate ${r.name}, descend inside, and defeat whatever commands it.`,
      type: "clear",
      state: "available",
      difficulty: Math.max(2, r.danger + 1),
      giverPoiId: e.id,
      giverName: o,
      faction: e.faction ?? "Wayfarers Guild",
      targetPoiId: r.id,
      locationName: r.name,
      location: {
        x: r.x,
        z: r.z,
      },
      required: 1,
      progress: 0,
      optionalGoal: "Open the hidden cache",
      stages: 2,
      currentStage: 1,
      rewards: this.rewardsFor(r.danger + 2, distance2D(e, r) / 55, t, deriveSeed(l, 3), 1.4),
    };
    return [c, h, u];
  }
  generateQuest(e, t, n, i) {
    let r = new Rng(e);
    let a = 240 + (t.tier ?? 1) * 90;
    let o = this.world.getPoisAround(t.x, t.z, a).filter((F) => F.id !== t.id && F.kind !== "settlement");
    if (o.length === 0) {
      return;
    }
    let l = r.weighted([
      {
        value: "hunt",
        weight: 2.4,
      },
      {
        value: "clear",
        weight: 2.2,
      },
      {
        value: "retrieve",
        weight: 1.7,
      },
      {
        value: "gather",
        weight: 1.4,
      },
      {
        value: "investigate",
        weight: 1.5,
      },
      {
        value: "activate",
        weight: 1.1,
      },
      {
        value: "defend",
        weight: 0.9,
      },
      {
        value: "boss",
        weight: i >= 3 ? 0.75 : 0.25,
      },
    ]);
    let c = o.filter((F) => ["dungeon", "mine", "ruin", "portal"].includes(F.kind));
    let h = o.filter((F) => ["shrine", "tower"].includes(F.kind));
    let u = o.filter((F) => ["camp", "farm", "shrine", "tower"].includes(F.kind));
    if (
      ((l === "clear" || l === "retrieve" || l === "boss") && c.length === 0) ||
      (l === "activate" && h.length === 0)
    ) {
      return;
    }
    let d = r.pick(
      l === "clear" || l === "retrieve" || l === "boss"
        ? c
        : l === "activate"
          ? h
          : l === "defend" && u.length > 0
            ? u
            : o,
    );
    let p = Math.max(1, d.danger + r.int(0, 2));
    let x = this.questGiverName(t, r);
    let y = r.pick(BIOMES[d.biome].enemyIds);
    let m = r.pick(QUEST_WORDS.relics);
    let f = BIOMES[d.biome].resources[0];
    let S = l === "hunt" ? r.int(4, 7) : l === "gather" ? r.int(3, 6) : l === "defend" ? r.int(4, 7) : 1;
    let A = l === "gather" ? f : m;
    let _ = `quest:${e >>> 0}:${A.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
    let w = r.pick(QUEST_WORDS.disturbances);
    let M = r.pick(QUEST_WORDS.devices);
    let R = (l === "clear" || l === "boss") && r.chance(0.22) ? 2 : 1;
    let v = {
      hunt: `Bounty: ${ENEMY_TYPES[y]?.name ?? "Wild Beast"}`,
      clear: `Silence ${d.name}`,
      retrieve: `The Lost ${m}`,
      gather: `${BIOMES[d.biome].resources[0]} Requisition`,
      investigate: `Reports of ${w}`,
      activate: `Restore the ${M}`,
      defend: `Hold ${d.name}`,
      boss: `High Contract: ${d.name}`,
    };
    let E = {
      hunt: `${ENEMY_TYPES[y]?.name ?? "Creatures"} have claimed the trails near ${d.name}. Bring the number down.`,
      clear: `${d.name} has become a refuge for hostile forces. Clear its final chamber.`,
      retrieve: `The ${m} was last carried into ${d.name}. Recover it and return.`,
      gather: `Gather ${S} samples of ${BIOMES[d.biome].resources[0]} around ${d.name}.`,
      investigate: `Travel to ${d.name} and determine whether the reports of ${w} are true.`,
      activate: `Reach ${d.name} and ${r.pick(["activate", "cleanse", "repair"])} the ${M}.`,
      defend: `Hostiles are converging on ${d.name}. Defeat ${S} attackers in the area.`,
      boss: `A dangerous leader has occupied ${d.name}. Enter, find it, and end the threat.`,
    };
    let C = r.chance(0.24)
      ? r.pick([
          "Finish without using a draught",
          "Defeat an elite",
          "Open the hidden cache",
          "Complete before nightfall",
        ])
      : undefined;
    return {
      id: `quest:${t.id}:${e >>> 0}`,
      seed: e,
      title: v[l],
      description: E[l],
      type: l,
      state: "available",
      difficulty: p,
      giverPoiId: t.id,
      giverName: x,
      faction: t.faction ?? "Free Delvers",
      targetPoiId: d.id,
      ...(l === "hunt"
        ? {
            targetArchetypeId: y,
          }
        : {}),
      ...(l === "retrieve" || l === "gather"
        ? {
            targetItemId: _,
          }
        : {}),
      locationName: d.name,
      location: {
        x: d.x,
        z: d.z,
      },
      required: S,
      progress: 0,
      ...(C
        ? {
            optionalGoal: C,
          }
        : {}),
      stages: R,
      currentStage: 1,
      rewards: this.rewardsFor(p, distance2D(t, d) / 75, i, e, R > 1 ? 1.25 : 1),
    };
  }
  rewardsFor(e, t, n, i, r = 1) {
    let a = Math.max(1, e);
    return {
      xp: Math.round((45 + a * 24 + t * 12) * r),
      gold: Math.round((18 + a * 11 + t * 6) * r),
      reputation: Math.max(2, Math.round((2 + a * 0.8) * r)),
      itemSeed: deriveSeed(i, "reward-item"),
      itemLevel: Math.max(n, a),
      itemRarityBonus: Math.min(0.5, a * 0.035 + (r - 1) * 0.3),
    };
  }
  questGiverName(e, t) {
    return `${t.pick(FIRST_NAMES)} ${t.pick(FAMILY_NAMES)}, ${e.tier === 3 ? "Guild Provost" : e.tier === 2 ? "Contract Keeper" : "Road Warden"}`;
  }
}
