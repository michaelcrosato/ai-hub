import { AFFIXES, ARCHETYPES, ITEM_BASES, RARITIES } from "./data.js";
import { Rng, clamp, deriveSeed } from "./util.js";

export function addStats(s, e, t = 1) {
  let n = {
    ...s,
  };
  for (let [i, r] of Object.entries(e)) {
    if (r !== undefined) {
      n[i] = (n[i] ?? 0) + r * t;
    }
  }
  return n;
}

export function itemScore(s) {
  let e = 0;
  for (let [t, n] of Object.entries(s.stats)) {
    let i = ["critChance", "attackSpeed", "moveSpeed", "cooldownRate", "healingPower"].includes(t)
      ? 100
      : t === "critDamage"
        ? 45
        : 1;
    e += n * i;
  }
  return Math.round(e * 10) / 10;
}

export class LootSystem {
  generateItem(e, t, n = 0, i, r) {
    let a = new Rng(e);
    let o = ITEM_BASES.filter((_) => (!i || _.category === i) && (!r || _.weaponStyle === r));
    let l = a.pick(o.length > 0 ? o : ITEM_BASES.filter((_) => ["weapon", "armor", "accessory"].includes(_.category)));
    let c = this.rollRarity(a, n);
    let h = RARITIES.indexOf(c);
    let u = 1 + Math.max(0, t - 1) * 0.115;
    let d = {};
    for (let [_, w] of Object.entries(l.baseStats)) {
      d[_] = this.roundStat(_, w * u * (1 + h * 0.08));
    }
    let p = Math.min(4, h + (c === "legendary" ? 1 : 0));
    let y = a
      .shuffle(AFFIXES.filter((_) => _.categories.includes(l.category)))
      .slice(0, p)
      .map((_, w) => {
        let M = this.roundStat(_.stat, a.range(_.min, _.max) * (0.72 + t * 0.045));
        d = addStats(d, {
          [_.stat]: M,
        });
        return {
          id: `${_.id}:${w}`,
          name: _.name,
          stat: _.stat,
          value: M,
          ...(_.suffix
            ? {
                suffix: true,
              }
            : {}),
        };
      });
    let m = y.find((_) => !_.suffix)?.name ?? a.pick(l.namePrefixes);
    let f = y.find((_) => _.suffix)?.name;
    let S = `${m} ${l.name}${f ? ` ${f}` : ""}`;
    let A = Math.max(
      1,
      Math.round(
        l.baseValue * u * (1 + h * 0.75) +
          itemScore({
            stats: d,
          }) *
            1.4,
      ),
    );
    return {
      id: `item:${e >>> 0}`,
      seed: e >>> 0,
      baseId: l.id,
      name: S,
      category: l.category,
      ...(l.slot
        ? {
            slot: l.slot,
          }
        : {}),
      ...(l.weaponStyle
        ? {
            weaponStyle: l.weaponStyle,
          }
        : {}),
      rarity: c,
      level: t,
      value: A,
      stats: d,
      affixes: y,
      description: l.description,
      quantity: 1,
    };
  }
  generateStartingGear(e, t) {
    let n = ARCHETYPES.find((a) => a.id === t) ?? ARCHETYPES[0];
    let i = this.generateItem(deriveSeed(e, "starter-weapon"), 1, -10, "weapon", n.startingWeapon);
    i.rarity = "common";
    i.name = `Weathered ${ITEM_BASES.find((a) => a.id === i.baseId)?.name ?? "Weapon"}`;
    i.value = 8;
    i.affixes = [];
    let r = this.generateItem(deriveSeed(e, "starter-armor"), 1, -10, "armor");
    r.rarity = "common";
    r.name = "Roadworn " + (ITEM_BASES.find((a) => a.id === r.baseId)?.name ?? "Armor");
    r.value = 6;
    r.affixes = [];
    return [i, r];
  }
  rollDrops(e, t, n, i) {
    let r = new Rng(e);
    let a = r.int(Math.max(1, t * 2), Math.max(4, t * 5)) * (i ? 5 : n ? 2 : 1);
    let o = [];
    let l = i ? 2 : n ? 1 : 0;
    let c = r.chance(i ? 1 : n ? 0.7 : 0.22) ? 1 : 0;
    for (let h = 0; h < l + c; h += 1) {
      o.push(this.generateItem(deriveSeed(e, "drop", h), Math.max(1, t + r.int(-1, 1)), i ? 0.42 : n ? 0.2 : 0));
    }
    return {
      gold: a,
      items: o,
      potions: r.chance(i ? 0.85 : n ? 0.32 : 0.08) ? 1 : 0,
    };
  }
  addItem(e, t, n = 30) {
    if (t.category === "consumable" || t.category === "material" || t.category === "quest") {
      let i = e.find((r) => r.baseId === t.baseId && r.category === t.category);
      if (i) {
        i.quantity += t.quantity;
        return true;
      }
    }
    if (e.length >= n) {
      return false;
    } else {
      e.push(t);
      return true;
    }
  }
  removeItem(e, t, n = 1) {
    let i = e.findIndex((a) => a.id === t);
    if (i < 0) {
      return;
    }
    let r = e[i];
    if (r.quantity > n) {
      r.quantity -= n;
      return {
        ...r,
        quantity: n,
      };
    } else {
      e.splice(i, 1);
      return r;
    }
  }
  equip(e, t, n) {
    let i = e.findIndex((o) => o.id === n);
    if (i < 0) {
      return false;
    }
    let r = e[i];
    if (!r.slot) {
      return false;
    }
    e.splice(i, 1);
    let a = t[r.slot];
    t[r.slot] = r;
    if (a) {
      e.push(a);
    }
    return true;
  }
  unequip(e, t, n, i = 30) {
    let r = t[n];
    if (!r || e.length >= i) {
      return false;
    } else {
      delete t[n];
      e.push(r);
      return true;
    }
  }
  rollRarity(e, t) {
    let n = clamp(e.next() + t * 0.12, 0, 0.9999);
    if (n > 0.992) {
      return "legendary";
    } else if (n > 0.95) {
      return "epic";
    } else if (n > 0.78) {
      return "rare";
    } else if (n > 0.45) {
      return "uncommon";
    } else {
      return "common";
    }
  }
  roundStat(e, t) {
    if (["critChance", "critDamage", "attackSpeed", "moveSpeed", "cooldownRate", "healingPower"].includes(e)) {
      return Math.round(t * 1000) / 1000;
    } else {
      return Math.round(t * 10) / 10;
    }
  }
}

// ---------- The Forge: tempering gear with Crafting Scrap from salvage

export const MAX_TEMPER = 5;

/** How much Crafting Scrap the pack holds (it stacks as one material item). */
export function scrapCount(inventory) {
  let total = 0;
  for (const item of inventory) if (item.category === "material" && item.baseId === "salvage") total += item.quantity;
  return total;
}

/** Scrap and gold for the next temper level of an item. */
export function temperCost(item) {
  const temper = item.temper ?? 0;
  const rarity = Math.max(0, RARITIES.indexOf(item.rarity));
  return {
    scrap: temper + 1,
    gold: Math.round(20 + item.level * 6 * (temper + 1) + rarity * 12),
  };
}

const PERCENT_STATS = ["critChance", "critDamage", "attackSpeed", "moveSpeed", "cooldownRate", "healingPower"];

/** Raise every stat by 7% and the value by 12%; the name shows the level (+1 … +5). */
export function temperItem(item) {
  if ((item.temper ?? 0) >= MAX_TEMPER) return false;
  for (const [stat, value] of Object.entries(item.stats)) {
    const raised = value * 1.07;
    item.stats[stat] = PERCENT_STATS.includes(stat) ? Math.round(raised * 1000) / 1000 : Math.round(raised * 10) / 10;
  }
  item.temper = (item.temper ?? 0) + 1;
  item.value = Math.max(1, Math.round(item.value * 1.12));
  item.name = `${item.name.replace(/ \+\d+$/, "")} +${item.temper}`;
  return true;
}

/** Take `count` scrap out of the pack. Returns false (and takes nothing) if there is not enough. */
export function spendScrap(inventory, count) {
  if (scrapCount(inventory) < count) return false;
  let left = count;
  for (let k = inventory.length - 1; k >= 0 && left > 0; k -= 1) {
    const item = inventory[k];
    if (item.category !== "material" || item.baseId !== "salvage") continue;
    const take = Math.min(left, item.quantity);
    item.quantity -= take;
    left -= take;
    if (item.quantity <= 0) inventory.splice(k, 1);
  }
  return true;
}
