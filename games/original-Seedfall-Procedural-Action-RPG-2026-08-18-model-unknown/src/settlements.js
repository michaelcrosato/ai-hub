import { FAMILY_NAMES, FIRST_NAMES } from "./data.js";
import { Rng, deriveSeed } from "./util.js";
import { LootSystem } from "./loot.js";
import { Npc } from "./entities.js";

const NPC_COLORS = {
  quest: 0x9a7042,
  merchant: 0x398b83,
  healer: 0x638fc4,
  trainer: 0x6f5ca1,
  smith: 0x8b4d38,
  innkeeper: 0x986b58,
  citizen: 0x707d6f,
  guard: 0x536173,
};

const SERVICE_ROLES = {
  questBoard: "quest",
  merchant: "merchant",
  healer: "healer",
  trainer: "trainer",
  smith: "smith",
  inn: "innkeeper",
};

const NPC_DESCRIPTIONS = {
  quest: [
    "Keeps the local contract ledger and remembers every unpaid favor.",
    "A practical guild agent with a stack of sealed notices.",
  ],
  merchant: [
    "Trades in roadworthy goods and rumors from passing caravans.",
    "A careful appraiser with an eye for useful salvage.",
  ],
  healer: [
    "Tends wounds with herbs, prayer, and unsentimental advice.",
    "A traveling chirurgeon who settled where the roads grew dangerous.",
  ],
  trainer: [
    "Studies unusual combat forms and teaches any student who can pay.",
    "A veteran delver who values adaptable technique over pedigree.",
  ],
  smith: [
    "Repairs damaged gear and buys material fit for the forge.",
    "A soot-marked craftsperson with a precise, economical manner.",
  ],
  innkeeper: [
    "Runs the busiest room in the settlement and hears every story twice.",
    "Offers hot food, a clean bed, and local warnings.",
  ],
  citizen: [
    "A resident occupied with the ordinary work that keeps the settlement alive.",
    "Knows the nearby trails and which ones should be avoided.",
  ],
  guard: [
    "A watchful local guard trained to hold gates and escort caravans.",
    "Keeps one hand near a weapon and the other near the alarm bell.",
  ],
};

const NPC_LINES = {
  quest: [
    "The board is current. The dangers are not.",
    "Take only what you can finish. A failed contract travels faster than a completed one.",
  ],
  merchant: ["I buy what the road gives you and sell what might keep you on it.", "Quality costs less than a funeral."],
  healer: ["Stand still. Heroics make poor bandages.", "Rest is cheaper than resurrection."],
  trainer: ["A class is a beginning, not a cage.", "Learn the principle, then break the habit."],
  smith: ["Good steel tells you how it failed.", "Bring coin, scrap, or both."],
  innkeeper: ["The stew is safer than the eastern road.", "Rooms upstairs. Rumors at the long table."],
  citizen: ["Strange lights again last night.", "The old road is quicker, provided nothing notices you."],
  guard: ["Keep your weapon lowered inside the marker stones.", "The watch changes at dusk. Trouble does not."],
};

export class SettlementSystem {
  loot = new LootSystem();
  generateNpcs(e) {
    if (e.kind !== "settlement") {
      return [];
    }
    let t = new Rng(deriveSeed(e.seed, "npcs"));
    let n = [];
    for (let r of e.services ?? []) {
      let a = SERVICE_ROLES[r];
      if (a && !n.includes(a)) {
        n.push(a);
      }
    }
    let i = e.tier ?? 1;
    for (let r = 0; r < i + 1; r += 1) {
      n.push("guard");
    }
    for (let r = 0; r < i * 2; r += 1) {
      n.push("citizen");
    }
    return n.map((r, a) => {
      let o = (a / Math.max(1, n.length)) * Math.PI * 2 + t.range(-0.2, 0.2);
      let l = r === "quest" ? 3.2 : r === "guard" ? 9 + i * 3 : 5.5 + t.range(0, i * 2.5);
      let c = t.pick(FIRST_NAMES);
      let h = t.pick(FAMILY_NAMES);
      let u =
        r === "quest"
          ? "Contract Keeper"
          : r === "merchant"
            ? "Quartermaster"
            : r === "trainer"
              ? "Waymaster"
              : r === "healer"
                ? "Healer"
                : r === "smith"
                  ? "Smith"
                  : r === "innkeeper"
                    ? "Innkeeper"
                    : r === "guard"
                      ? "Watch"
                      : "Resident";
      return new Npc({
        id: `npc:${e.id}:${a}`,
        name: `${c} ${h}`,
        role: r,
        faction: e.faction ?? "Free Delvers",
        poiId: e.id,
        description: t.pick(NPC_DESCRIPTIONS[r]),
        dialogue: t.shuffle(NPC_LINES[r]),
        shopSeed: deriveSeed(e.seed, "shop", a),
        x: e.x + Math.sin(o) * l,
        z: e.z + Math.cos(o) * l,
        color: NPC_COLORS[r],
      });
    });
  }
  generateShopInventory(e, t, n, i = 0) {
    let r = deriveSeed(e.seed, "shop-stock", n, Math.floor(t / 2), i);
    let a = new Rng(r);
    let o = n === "smith" ? 8 : n === "merchant" ? 10 : 6;
    let l = [];
    for (let c = 0; c < o; c += 1) {
      let h =
        n === "smith"
          ? a.pick(["weapon", "armor", "accessory"])
          : a.weighted([
              {
                value: "weapon",
                weight: 1.2,
              },
              {
                value: "armor",
                weight: 1.2,
              },
              {
                value: "accessory",
                weight: 1,
              },
              {
                value: "consumable",
                weight: 2,
              },
            ]);
      let u = this.loot.generateItem(deriveSeed(r, c), Math.max(1, t + a.int(-1, 2)), n === "smith" ? 0.08 : -0.02, h);
      if (h === "consumable") {
        u.baseId = "healing-draught";
        u.name = "Healing Draught";
        u.description = "Restores 45% of maximum health.";
        u.value = 18 + t * 3;
        u.quantity = a.int(1, 3);
      }
      l.push(u);
    }
    return l;
  }
  getBuyPrice(e, t) {
    let n = Math.min(0.22, Math.max(-0.12, t * 0.002));
    return Math.max(1, Math.ceil(e.value * 1.35 * (1 - n)));
  }
  getSellPrice(e, t) {
    let n = Math.min(0.18, Math.max(-0.08, t * 0.0015));
    return Math.max(1, Math.floor(e.value * 0.48 * (1 + n)));
  }
}
