const SAVE_KEY = "seedfall-rpg-save-v1";

const VALID_ARCHETYPES = new Set(["vanguard", "ranger", "shadow", "arcanist", "warden"]);

const VALID_QUEST_TYPES = new Set(["hunt", "clear", "retrieve", "gather", "investigate", "activate", "defend", "boss"]);

const VALID_QUEST_STATES = new Set(["available", "active", "ready", "completed", "failed"]);

const VALID_CATEGORIES = new Set(["weapon", "armor", "accessory", "consumable", "material", "quest"]);

const VALID_RARITIES = new Set(["common", "uncommon", "rare", "epic", "legendary"]);

const EQUIP_SLOTS = new Set(["weapon", "armor", "accessory"]);

const VALID_WEAPON_STYLES = new Set(["blade", "bow", "dagger", "staff", "mace"]);

const VALID_STATS = new Set([
  "power",
  "armor",
  "maxHealth",
  "maxResource",
  "critChance",
  "critDamage",
  "attackSpeed",
  "moveSpeed",
  "cooldownRate",
  "healthRegen",
  "resourceRegen",
  "fireDamage",
  "frostDamage",
  "poisonDamage",
  "healingPower",
]);

function isObject(s) {
  return !!s && typeof s == "object" && !Array.isArray(s);
}

function isNumber(s) {
  return typeof s == "number" && Number.isFinite(s);
}

function isInt(s) {
  return isNumber(s) && Number.isInteger(s);
}

function isNonNegInt(s) {
  return isInt(s) && s >= 0;
}

function isUint32(s) {
  return isNonNegInt(s) && s <= 4294967295;
}

function isStringArray(s) {
  return Array.isArray(s) && s.every((e) => typeof e == "string");
}

function isValidStats(s) {
  if (isObject(s)) {
    return Object.entries(s).every(([e, t]) => VALID_STATS.has(e) && isNumber(t));
  } else {
    return false;
  }
}

function isValidAffix(s) {
  if (isObject(s)) {
    return (
      typeof s.id == "string" &&
      typeof s.name == "string" &&
      typeof s.stat == "string" &&
      VALID_STATS.has(s.stat) &&
      isNumber(s.value) &&
      (s.suffix === undefined || typeof s.suffix == "boolean")
    );
  } else {
    return false;
  }
}

function isValidItem(s) {
  if (!isObject(s)) {
    return false;
  }
  let e = typeof s.category == "string" ? s.category : "";
  let t = typeof s.slot == "string" ? s.slot : undefined;
  let n = typeof s.weaponStyle == "string" ? s.weaponStyle : undefined;
  let r = EQUIP_SLOTS.has(e) ? t === e : t === undefined;
  let a = e === "weapon" ? n !== undefined && VALID_WEAPON_STYLES.has(n) : n === undefined;
  return (
    typeof s.id == "string" &&
    typeof s.baseId == "string" &&
    typeof s.name == "string" &&
    VALID_CATEGORIES.has(e) &&
    r &&
    a &&
    VALID_RARITIES.has(String(s.rarity)) &&
    isUint32(s.seed) &&
    isInt(s.level) &&
    s.level >= 1 &&
    isNonNegInt(s.value) &&
    isInt(s.quantity) &&
    s.quantity >= 1 &&
    isValidStats(s.stats) &&
    Array.isArray(s.affixes) &&
    s.affixes.every(isValidAffix) &&
    typeof s.description == "string" &&
    // Tempered at the forge (+1 … +5); older saves have no temper.
    (s.temper === undefined || (isNonNegInt(s.temper) && s.temper <= 5))
  );
}

function isValidQuest(s) {
  if (!isObject(s)) {
    return false;
  }
  let e = s.location;
  let t = s.rewards;
  if (!isObject(e) || !isObject(t)) {
    return false;
  } else {
    return (
      typeof s.id == "string" &&
      typeof s.title == "string" &&
      typeof s.description == "string" &&
      VALID_QUEST_TYPES.has(String(s.type)) &&
      VALID_QUEST_STATES.has(String(s.state)) &&
      typeof s.giverPoiId == "string" &&
      typeof s.giverName == "string" &&
      typeof s.faction == "string" &&
      typeof s.locationName == "string" &&
      (s.targetPoiId === undefined || typeof s.targetPoiId == "string") &&
      (s.targetEntityId === undefined || typeof s.targetEntityId == "string") &&
      (s.targetArchetypeId === undefined || typeof s.targetArchetypeId == "string") &&
      (s.targetItemId === undefined || typeof s.targetItemId == "string") &&
      (s.optionalGoal === undefined || typeof s.optionalGoal == "string") &&
      (s.completedAt === undefined || isNonNegInt(s.completedAt)) &&
      isUint32(s.seed) &&
      isInt(s.difficulty) &&
      s.difficulty >= 1 &&
      isInt(s.required) &&
      s.required >= 1 &&
      isNonNegInt(s.progress) &&
      s.progress <= s.required &&
      isInt(s.stages) &&
      s.stages >= 1 &&
      isInt(s.currentStage) &&
      s.currentStage >= 1 &&
      s.currentStage <= s.stages &&
      isNumber(e.x) &&
      isNumber(e.z) &&
      isNonNegInt(t.xp) &&
      isNonNegInt(t.gold) &&
      isInt(t.reputation) &&
      (t.itemSeed === undefined || isUint32(t.itemSeed)) &&
      (t.itemLevel === undefined || (isInt(t.itemLevel) && t.itemLevel >= 1)) &&
      (t.itemRarityBonus === undefined ||
        (isNumber(t.itemRarityBonus) && t.itemRarityBonus >= 0 && t.itemRarityBonus <= 1))
    );
  }
}

function isValidPlayer(s) {
  if (!isObject(s)) {
    return false;
  }
  let e = s.attributes;
  let t = s.progress;
  let n = s.equipment;
  let i = s.hotbar;
  let r = s.learnedSkills;
  if (!isObject(e) || !isObject(t) || !isObject(t.reputation) || !isObject(n)) {
    return false;
  }
  let a = t.reputation;
  return (
    isNumber(s.x) &&
    isNumber(s.z) &&
    isNumber(s.health) &&
    s.health >= 0 &&
    isNumber(s.resource) &&
    s.resource >= 0 &&
    VALID_ARCHETYPES.has(String(s.archetype)) &&
    ["might", "finesse", "intellect", "vitality"].every((o) => isNonNegInt(e[o])) &&
    isInt(t.level) &&
    t.level >= 1 &&
    isNonNegInt(t.xp) &&
    isInt(t.xpToNext) &&
    t.xpToNext > 0 &&
    ["skillPoints", "attributePoints", "gold"].every((o) => isNonNegInt(t[o])) &&
    Object.values(a).every(isInt) &&
    Array.isArray(s.inventory) &&
    s.inventory.every(isValidItem) &&
    Object.entries(n).every(
      ([o, l]) => EQUIP_SLOTS.has(o) && (l === undefined || (isValidItem(l) && isObject(l) && l.slot === o)),
    ) &&
    Array.isArray(r) &&
    r.every(
      (o) => isObject(o) && typeof o.id == "string" && isNumber(o.rank) && Number.isInteger(o.rank) && o.rank >= 1,
    ) &&
    Array.isArray(i) &&
    i.length === 6 &&
    i.every((o) => o === null || typeof o == "string") &&
    isInt(s.potions) &&
    s.potions >= 0
  );
}

function isValidWorldState(s) {
  if (!isObject(s) || !isObject(s.generatedQuestSeeds)) {
    return false;
  } else {
    return (
      isStringArray(s.discoveredPoiIds) &&
      isStringArray(s.clearedPoiIds) &&
      isStringArray(s.openedChestIds) &&
      isStringArray(s.completedQuestIds) &&
      isStringArray(s.defeatedImportantEntityIds) &&
      Object.values(s.generatedQuestSeeds).every((e) => Array.isArray(e) && e.every(isUint32)) &&
      isNumber(s.timeOfDay) &&
      s.timeOfDay >= 0 &&
      s.timeOfDay < 1 &&
      // Shrines whose trial was won; older saves have none.
      (s.completedTrials === undefined || isStringArray(s.completedTrials))
    );
  }
}

function isValidSettings(s) {
  return (
    isObject(s) &&
    isNumber(s.masterVolume) &&
    s.masterVolume >= 0 &&
    s.masterVolume <= 1 &&
    typeof s.cameraShake == "boolean" &&
    typeof s.damageNumbers == "boolean" &&
    typeof s.reduceMotion == "boolean" &&
    (s.difficulty === undefined || VALID_DIFFICULTIES.has(s.difficulty))
  );
}

const VALID_DIFFICULTIES = new Set(["story", "normal", "hard"]);

const RECORD_KEYS = ["kills", "elites", "bosses", "dungeons", "quests", "trials", "deaths", "playSeconds"];

/** The journey record (optional: saves from before it existed have none). */
function isValidRecord(s) {
  return isObject(s) && RECORD_KEYS.every((k) => s[k] === undefined || (isNumber(s[k]) && s[k] >= 0));
}

function isValidSave(s) {
  if (isObject(s)) {
    return (
      s.version === 1 &&
      isNonNegInt(s.timestamp) &&
      typeof s.seedText == "string" &&
      s.seedText.length > 0 &&
      isUint32(s.seed) &&
      isValidPlayer(s.player) &&
      Array.isArray(s.quests) &&
      s.quests.every(isValidQuest) &&
      isValidWorldState(s.world) &&
      isValidSettings(s.settings) &&
      (s.stats === undefined || isValidRecord(s.stats))
    );
  } else {
    return false;
  }
}

function serializeSave(s) {
  if (!isValidSave(s)) {
    throw new Error("Refusing to serialize invalid save data");
  }
  return JSON.stringify(s);
}

function parseSave(s) {
  let e = JSON.parse(s);
  if (!isValidSave(e)) {
    throw new Error("Save data is missing required fields or uses an unsupported version");
  }
  return e;
}

export class SaveSystem {
  hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }
  save(e) {
    localStorage.setItem(SAVE_KEY, serializeSave(e));
  }
  load() {
    try {
      let e = localStorage.getItem(SAVE_KEY);
      if (e) {
        return parseSave(e);
      } else {
        return undefined;
      }
    } catch (e) {
      console.warn("Unable to load Seedfall save:", e);
      return;
    }
  }
  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
}
