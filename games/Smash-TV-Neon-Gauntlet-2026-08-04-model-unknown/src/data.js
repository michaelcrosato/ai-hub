/**
 * data.js — Neon Gauntlet's content: the five campaign levels, rooms and
 * routes, hostiles, weapons, sponsor upgrades, the saved campaign record, and
 * the new Prize Studio room and Overtime mode. Pure data and pure functions.
 */

/** Half extents of the arena floor (x and z), in world units. */
export const ARENA_X = 15.2;
export const ARENA_Z = 10.2;
/** Combat rooms per level before the boss gate. */
export const ROOMS_PER_LEVEL = 5;
export const DIRECTIONS = ["NORTH", "EAST", "SOUTH", "WEST"];
/** Live Armor upgrade: +max health and immediate repair. */
export const REINFORCED_MAX_HP = 30;
export const REINFORCED_REPAIR = 50;

export const ROOM_NAMES = {
  opening: "OPENING FLOOR",
  jackpot: "JACKPOT HALL",
  crossfire: "CROSSFIRE GALLERY",
  rush: "STAMPEDE CHANNEL",
  armory: "PRISM ARMORY",
  recovery: "HELIX RECOVERY WARD",
  demolition: "DEMOLITION BAY",
  fortress: "VANTA FORTRESS",
  blackout: "BLACKOUT RELAY",
  boss: "EXECUTIVE SUITE",
};

export const LEVELS = {
  1: {
    id: 1,
    name: "NEON GAUNTLET",
    shortName: "GAUNTLET",
    kicker: "PRIME TIME SCORE ATTACK",
    challenge: "Break the house's first forecast.",
    accent: "#23e6ff",
    secondary: "#ff2d87",
    background: "#03070d",
    floor: "#0a141d",
    grid: "#29d8e6",
    mechanic: "broadcast",
    mechanicName: "FORECAST TRAINING",
    signatureWeapon: "pulse",
    enemies: ["rusher", "gunner", "charger", "tank"],
    boss: "executive",
    bossName: "THE EXECUTIVE",
    roomNames: ROOM_NAMES,
    introLine: "Five rooms, one Executive, and no reverse door. Make every angle expensive.",
    clearLine:
      "The Executive was only the front desk. I found where Lux feeds the cameras. We cut the light next.",
  },
  2: {
    id: 2,
    name: "LUX UNDERGRID",
    shortName: "UNDERGRID",
    kicker: "TAKE BACK THE LIGHT",
    challenge: "Rewire the grid and avoid charged floodwater.",
    accent: "#27f2ff",
    secondary: "#ffb02e",
    background: "#020b10",
    floor: "#07191d",
    grid: "#28d9c7",
    mechanic: "powerGrid",
    mechanicName: "POWER GRID",
    signatureWeapon: "arc",
    enemies: ["lamprey", "conductor", "bailiff"],
    boss: "collector",
    bossName: "THE COLLECTOR",
    sponsorId: "lux",
    roomNames: {
      opening: "METERING YARD",
      jackpot: "SPARK MARKET",
      crossfire: "FLOODED RELAY",
      rush: "COLLECTIONS ROW",
      armory: "COIL ARMORY",
      recovery: "INSULATOR BAY",
      demolition: "SURGE CHAMBER",
      fortress: "CAPACITOR CATHEDRAL",
      blackout: "CROWN SUBSTATION",
      boss: "COLLECTOR'S GRID",
    },
    introLine: "Lux owns the light. Today we repossess it one breaker at a time.",
    clearLine:
      "Grid down. Surveillance went blind long enough for me to pull a Helix transport ledger. They kept more than bodies.",
  },
  3: {
    id: 3,
    name: "HELIX REPLACEMENT WARD",
    shortName: "HELIX WARD",
    kicker: "NOTHING STAYS DEAD",
    challenge: "Destroy remains before the Ward rebuilds them.",
    accent: "#9cff57",
    secondary: "#ff3f9f",
    background: "#07100d",
    floor: "#102119",
    grid: "#87ff79",
    mechanic: "reconstruction",
    mechanicName: "RECONSTRUCTION",
    signatureWeapon: "graft",
    enemies: ["graftling", "stitcher", "orderly"],
    boss: "continuityOfficer",
    bossName: "CHIEF CONTINUITY OFFICER",
    sponsorId: "helix",
    roomNames: {
      opening: "TRIAGE INTAKE",
      jackpot: "GRAFT NURSERY",
      crossfire: "TRANSPLANT THEATRE",
      rush: "CULTURE RUN",
      armory: "SEVERANCE LAB",
      recovery: "REPAIR BAY",
      demolition: "BLOOM CHAMBER",
      fortress: "CONTINUITY LAB",
      blackout: "RECLAMATION WARD",
      boss: "CONTINUITY CORE",
    },
    introLine:
      "Helix calls this continuity. The people in those vats had names before they became inventory.",
    clearLine:
      "Those replacements carry combat memories. VantaVault holds the originals\u2014and the proof of who started the Black Minute.",
  },
  4: {
    id: 4,
    name: "VANTAVAULT: PERMANENT RECORD",
    shortName: "VANTAVAULT",
    kicker: "FIGHT WHAT IT REMEMBERS",
    challenge: "Survive hostile recordings of your own habits.",
    accent: "#9d70ff",
    secondary: "#77ffd1",
    background: "#070412",
    floor: "#130d25",
    grid: "#855dff",
    mechanic: "memoryReplay",
    mechanicName: "HOSTILE PLAYBACK",
    signatureWeapon: "disc",
    enemies: ["echo", "redactor", "curator"],
    boss: "archivist",
    bossName: "THE ARCHIVIST",
    sponsorId: "vantaVault",
    roomNames: {
      opening: "INTAKE HALL",
      jackpot: "REPLAY MARKET",
      crossfire: "PLAYBACK GALLERY",
      rush: "ECHO CORRIDOR",
      armory: "RETURN VAULT",
      recovery: "RESTORE POINT",
      demolition: "DELETION CHAMBER",
      fortress: "CLONE LEDGER",
      blackout: "PERMANENT RECORD",
      boss: "ARCHIVIST STACK",
    },
    introLine:
      "VantaVault kept every route you survived and every one you did not. Change the pattern before it plays back.",
    clearLine:
      "I did it. I killed the feed and opened the doors once. Meridian buried the forecast that says I can do it again.",
  },
  5: {
    id: 5,
    name: "MERIDIAN ODDSPIRE",
    shortName: "ODDSPIRE",
    kicker: "MAKE THE IMPOSSIBLE HAPPEN",
    challenge: "Contradict the system predicting your next move.",
    accent: "#ff3c9d",
    secondary: "#ffd15c",
    background: "#0d0310",
    floor: "#1c0a1d",
    grid: "#ff4caf",
    mechanic: "forecast",
    mechanicName: "LIVE PREDICTION",
    signatureWeapon: "contradiction",
    enemies: ["actuary", "underwriter", "adjuster"],
    boss: "forecastPrime",
    bossName: "FORECAST PRIME",
    sponsorId: "meridian",
    roomNames: {
      opening: "RISK DESK",
      jackpot: "LOSS MARKET",
      crossfire: "CLAIMS FLOOR",
      rush: "VARIANCE PIT",
      armory: "CONTRADICTION LAB",
      recovery: "SAFE HARBOR",
      demolition: "BLACK SWAN ROOM",
      fortress: "BOARDROOM APPROACH",
      blackout: "FORECAST CORE",
      boss: "BOARD OF ONE",
    },
    introLine: "Meridian has a price for every outcome except the one where you stop behaving like data.",
    clearLine: "Nine seconds. Turn around. The door behind you is finally ours.",
  },
};

export const LEVEL_IDS = [1, 2, 3, 4, 5];

export const ENEMIES = {
  rusher: {
    label: "RUSHER",
    silhouette: "rush",
    color: 16730949,
    hp: 38,
    radius: 0.58,
    speed: 3.2,
    score: 100,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.62,
    boss: false,
  },
  gunner: {
    label: "GUNNER",
    silhouette: "ranged",
    color: 16723335,
    hp: 62,
    radius: 0.68,
    speed: 2.1,
    score: 180,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.62,
    boss: false,
  },
  charger: {
    label: "CHARGER",
    silhouette: "charge",
    color: 16762967,
    hp: 82,
    radius: 0.72,
    speed: 2.45,
    score: 240,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.7,
    boss: false,
  },
  tank: {
    label: "TANK",
    silhouette: "heavy",
    color: 9397247,
    hp: 165,
    radius: 0.94,
    speed: 1.35,
    score: 420,
    contactDamage: 70,
    projectileDamage: 60,
    heavyDamage: 70,
    warningSeconds: 0.8,
    boss: false,
  },
  lamprey: {
    label: "LAMPREY",
    silhouette: "rush",
    color: 2683103,
    hp: 48,
    radius: 0.58,
    speed: 3.35,
    score: 140,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.75,
    boss: false,
  },
  conductor: {
    label: "CONDUCTOR",
    silhouette: "ranged",
    color: 2607359,
    hp: 72,
    radius: 0.7,
    speed: 2,
    score: 220,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.75,
    boss: false,
  },
  bailiff: {
    label: "BAILIFF",
    silhouette: "heavy",
    color: 16756782,
    hp: 180,
    radius: 0.98,
    speed: 1.3,
    score: 460,
    contactDamage: 70,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.9,
    boss: false,
  },
  graftling: {
    label: "GRAFTLING",
    silhouette: "rush",
    color: 16731293,
    hp: 45,
    radius: 0.56,
    speed: 3.1,
    score: 150,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.72,
    boss: false,
  },
  stitcher: {
    label: "STITCHER",
    silhouette: "ranged",
    color: 10288983,
    hp: 85,
    radius: 0.72,
    speed: 1.85,
    score: 250,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.8,
    boss: false,
  },
  orderly: {
    label: "ORDERLY",
    silhouette: "heavy",
    color: 15335384,
    hp: 150,
    radius: 0.94,
    speed: 1.45,
    score: 430,
    contactDamage: 70,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.9,
    boss: false,
  },
  echo: {
    label: "ECHO",
    silhouette: "rush",
    color: 7864273,
    hp: 58,
    radius: 0.6,
    speed: 3,
    score: 180,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.72,
    boss: false,
  },
  redactor: {
    label: "REDACTOR",
    silhouette: "ranged",
    color: 11559167,
    hp: 78,
    radius: 0.7,
    speed: 1.95,
    score: 260,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.85,
    boss: false,
  },
  curator: {
    label: "CURATOR",
    silhouette: "heavy",
    color: 9397247,
    hp: 170,
    radius: 0.96,
    speed: 1.35,
    score: 480,
    contactDamage: 70,
    projectileDamage: 50,
    heavyDamage: 75,
    warningSeconds: 1,
    boss: false,
  },
  actuary: {
    label: "ACTUARY",
    silhouette: "ranged",
    color: 16731311,
    hp: 65,
    radius: 0.68,
    speed: 2.05,
    score: 230,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.9,
    boss: false,
  },
  underwriter: {
    label: "UNDERWRITER",
    silhouette: "ranged",
    color: 16765276,
    hp: 100,
    radius: 0.78,
    speed: 1.75,
    score: 320,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.9,
    boss: false,
  },
  adjuster: {
    label: "ADJUSTER",
    silhouette: "charge",
    color: 16739413,
    hp: 145,
    radius: 0.82,
    speed: 2.25,
    score: 420,
    contactDamage: 50,
    projectileDamage: 50,
    heavyDamage: 70,
    warningSeconds: 0.75,
    boss: false,
  },
  executive: {
    label: "THE EXECUTIVE",
    silhouette: "boss",
    color: 16717645,
    hp: 2800,
    radius: 2.05,
    speed: 1.25,
    score: 6e3,
    contactDamage: 80,
    projectileDamage: 60,
    heavyDamage: 75,
    warningSeconds: 1.1,
    boss: true,
  },
  collector: {
    label: "THE COLLECTOR",
    silhouette: "boss",
    color: 2618111,
    hp: 3e3,
    radius: 2.05,
    speed: 1.2,
    score: 7e3,
    contactDamage: 80,
    projectileDamage: 60,
    heavyDamage: 75,
    warningSeconds: 1,
    boss: true,
  },
  continuityOfficer: {
    label: "CHIEF CONTINUITY OFFICER",
    silhouette: "boss",
    color: 10288983,
    hp: 3300,
    radius: 2.08,
    speed: 1.15,
    score: 8e3,
    contactDamage: 80,
    projectileDamage: 60,
    heavyDamage: 75,
    warningSeconds: 1,
    boss: true,
  },
  archivist: {
    label: "THE ARCHIVIST",
    silhouette: "boss",
    color: 10318079,
    hp: 3600,
    radius: 2.08,
    speed: 1.2,
    score: 9e3,
    contactDamage: 80,
    projectileDamage: 60,
    heavyDamage: 75,
    warningSeconds: 1,
    boss: true,
  },
  forecastPrime: {
    label: "FORECAST PRIME",
    silhouette: "boss",
    color: 16727197,
    hp: 4e3,
    radius: 2.12,
    speed: 1.28,
    score: 12e3,
    contactDamage: 80,
    projectileDamage: 60,
    heavyDamage: 75,
    warningSeconds: 1,
    boss: true,
  },
};

export const WEAPONS = {
  pulse: {
    label: "PULSE-9",
    cooldown: 0.1,
    damage: 18,
    speed: 29,
    spread: 0.025,
    count: 1,
    pierce: 0,
    life: 1.45,
    radius: 0.18,
    effect: "standard",
  },
  scatter: {
    label: "STAR SCATTER",
    cooldown: 0.31,
    damage: 14,
    speed: 25,
    spread: 0.48,
    count: 7,
    pierce: 0,
    life: 1.45,
    radius: 0.18,
    effect: "standard",
  },
  rail: {
    label: "PRISM RAIL",
    cooldown: 0.43,
    damage: 68,
    speed: 39,
    spread: 0,
    count: 1,
    pierce: 3,
    life: 0.72,
    radius: 0.24,
    effect: "standard",
  },
  rocket: {
    label: "APPLAUSE ROCKET",
    cooldown: 0.56,
    damage: 74,
    speed: 19,
    spread: 0.02,
    count: 1,
    pierce: 0,
    life: 1.45,
    radius: 0.35,
    effect: "rocket",
  },
  arc: {
    label: "ARC COIL",
    cooldown: 0.22,
    damage: 24,
    speed: 28,
    spread: 0.015,
    count: 1,
    pierce: 0,
    life: 1.35,
    radius: 0.2,
    effect: "chain",
  },
  graft: {
    label: "GRAFTGUN",
    cooldown: 0.14,
    damage: 20,
    speed: 30,
    spread: 0.035,
    count: 1,
    pierce: 0,
    life: 1.4,
    radius: 0.18,
    effect: "seed",
  },
  disc: {
    label: "RETURN DISC",
    cooldown: 0.55,
    damage: 48,
    speed: 20,
    spread: 0,
    count: 1,
    pierce: 8,
    life: 1.8,
    radius: 0.38,
    effect: "disc",
  },
  contradiction: {
    label: "CONTRADICTION ENGINE",
    cooldown: 0.24,
    damage: 30,
    speed: 30,
    spread: 0,
    count: 1,
    pierce: 1,
    life: 1.35,
    radius: 0.22,
    effect: "contradiction",
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export const SILHOUETTES = ["rush", "ranged", "charge", "heavy", "boss"];

export const WEAPON_LABELS = Object.fromEntries(WEAPON_IDS.map((id) => [id, WEAPONS[id].label]));

/** Prize Studio names per level (level 1 uses the base room). */
const PRIZE_ROOM_NAMES = {
  1: "PRIZE STUDIO",
  2: "LIGHT-UP LOTTERY",
  3: "DONOR RAFFLE",
  4: "MEMORY AUCTION",
  5: "JACKPOT FUTURES",
};
for (const id of LEVEL_IDS) LEVELS[id].roomNames.prize = PRIZE_ROOM_NAMES[id];

export const isBoss = (type) => ENEMIES[type].boss;
export const nextLevel = (level) => (level < 5 ? level + 1 : null);
export const enemyColor = (type) => ENEMIES[type].color;

/** The "HOSTILES" line on a door for a level's room kind. */
export function dangerLabel(level, kind) {
  const def = LEVELS[level];
  if (kind === "boss") return def.bossName;
  const labels = def.enemies.map((type) => ENEMIES[type].label);
  if (kind === "opening") return labels.slice(0, 2).join(" + ");
  if (kind === "jackpot") return `DENSE ${labels[0]} PACKS`;
  if (kind === "crossfire") return `${labels[1]} SATURATION`;
  if (kind === "rush") return `${labels[0]} PRESSURE`;
  if (kind === "fortress") return `ARMORED ${labels.at(-1)}`;
  if (kind === "blackout") return "UNFILTERED LEVEL MIX";
  if (kind === "prize") return `PRIZE GUARDS // ${labels[0]}`;
  return `${def.mechanicName} HAZARD`;
}

export function emptyWeaponKills() {
  return Object.fromEntries(WEAPON_IDS.map((id) => [id, 0]));
}

/** Room kinds. Level 1 uses these as they are; later levels rename them (roomFor). */
export const ROOMS = {
  opening: {
    kind: "opening",
    name: "OPENING FLOOR",
    kicker: "MANDATORY BROADCAST",
    description: "The only room the Network chooses for you.",
    reward: "ROUTE ACCESS",
    danger: "RUSHERS + GUNNERS",
    risk: "LOW",
    accent: "#23e6ff",
    targetBonus: 0,
    clearBonus: 500,
    spawnFactor: 1,
  },
  jackpot: {
    kind: "jackpot",
    name: "JACKPOT HALL",
    kicker: "PRIZE POOL // UNLOCKED",
    description: "Fast targets, rich drops, and nowhere polite to stand.",
    reward: "+750 ENTRY PURSE",
    danger: "DENSE RUSH PACKS",
    risk: "HIGH",
    accent: "#ffc857",
    targetBonus: 3,
    clearBonus: 900,
    spawnFactor: 0.82,
    sponsorId: "meridian",
  },
  crossfire: {
    kind: "crossfire",
    name: "CROSSFIRE GALLERY",
    kicker: "BALLISTIC EXHIBITION",
    description: "Gunners own the edges. The center is only temporarily yours.",
    reward: "+1,100 CLEAR BONUS",
    danger: "RANGED SATURATION",
    risk: "HIGH",
    accent: "#ff2d87",
    targetBonus: 2,
    clearBonus: 1100,
    spawnFactor: 0.92,
  },
  rush: {
    kind: "rush",
    name: "STAMPEDE CHANNEL",
    kicker: "MOTION MARKET",
    description: "Chargers and rushers turn every safe lane into a short-term lease.",
    reward: "+900 CLEAR BONUS",
    danger: "CHARGE LINES",
    risk: "HIGH",
    accent: "#ff674f",
    targetBonus: 3,
    clearBonus: 900,
    spawnFactor: 0.78,
    sponsorId: "kessler",
  },
  armory: {
    kind: "armory",
    name: "PRISM ARMORY",
    kicker: "LOADOUT DIVERSION",
    description: "Temporary hardware. Permanent telemetry.",
    reward: "PREMIUM WEAPON",
    danger: "MIXED SECURITY",
    risk: "MEDIUM",
    accent: "#23e6ff",
    targetBonus: 1,
    clearBonus: 700,
    spawnFactor: 1,
  },
  recovery: {
    kind: "recovery",
    name: "HELIX RECOVERY WARD",
    kicker: "MEDICAL INVENTORY",
    description: "The room repairs contestants so the contract can continue.",
    reward: "REPAIR +30",
    danger: "ARMORED ORDERLIES",
    risk: "LOW",
    accent: "#94ff54",
    targetBonus: 1,
    clearBonus: 550,
    spawnFactor: 1.08,
    sponsorId: "helix",
  },
  demolition: {
    kind: "demolition",
    name: "DEMOLITION BAY",
    kicker: "ORDNANCE TEST FLOOR",
    description: "More bodies, more blast radius, fewer surviving disclaimers.",
    reward: "SCREEN WIPE +1",
    danger: "TIGHT FORMATIONS",
    risk: "MEDIUM",
    accent: "#ff8b2d",
    targetBonus: 3,
    clearBonus: 800,
    spawnFactor: 0.86,
  },
  fortress: {
    kind: "fortress",
    name: "VANTA FORTRESS",
    kicker: "HEAVY ASSET STORAGE",
    description: "Tanks hold the floor while the Network compounds interest.",
    reward: "+1,400 CLEAR BONUS",
    danger: "HEAVY ARMOR",
    risk: "EXTREME",
    accent: "#8f63ff",
    targetBonus: 2,
    clearBonus: 1400,
    spawnFactor: 1.12,
    sponsorId: "vantaVault",
  },
  blackout: {
    kind: "blackout",
    name: "BLACKOUT RELAY",
    kicker: "OFF-SCRIPT CHANNEL",
    description: "The cameras lose certainty here. So does the Forecast Engine.",
    reward: "+1,600 CLEAR BONUS",
    danger: "UNFILTERED MIX",
    risk: "EXTREME",
    accent: "#d16cff",
    targetBonus: 4,
    clearBonus: 1600,
    spawnFactor: 0.75,
    sponsorId: "lux",
  },
  prize: {
    kind: "prize",
    name: "PRIZE STUDIO",
    kicker: "BONUS ROUND // CLOCK IS LIVE",
    description: "Twenty seconds, a floor full of prizes, and security that hates sharing.",
    reward: "PRIZES + CASH",
    danger: "PRIZE GUARDS",
    risk: "MEDIUM",
    accent: "#ffd15c",
    targetBonus: 0,
    clearBonus: 600,
    spawnFactor: 1.15,
    sponsorId: "meridian",
  },
  boss: {
    kind: "boss",
    name: "EXECUTIVE SUITE",
    kicker: "TERMINAL BROADCAST",
    description: "No branches remain. The Forecast Engine is waiting in person.",
    reward: "LEVEL 01 CLEARANCE",
    danger: "THE EXECUTIVE",
    risk: "EXTREME",
    accent: "#ff174d",
    targetBonus: 0,
    clearBonus: 0,
    spawnFactor: 1,
  },
};

/** Sponsor-break upgrades. */
export const UPGRADES = {
  overclock: {
    id: "overclock",
    name: "Overclock",
    kicker: "FIRE RATE",
    description: "Weapons cycle 18% faster.",
    icon: "\u21AF",
  },
  heavyRounds: {
    id: "heavyRounds",
    name: "Heavy Rounds",
    kicker: "DAMAGE",
    description: "All shots deal 25% more damage.",
    icon: "\u25C6",
  },
  multishot: {
    id: "multishot",
    name: "Split Signal",
    kicker: "MULTISHOT",
    description: "Fire two angled bonus rounds.",
    icon: "\u22D4",
  },
  pierce: {
    id: "pierce",
    name: "Ghost Rounds",
    kicker: "PIERCE",
    description: "Projectiles punch through one extra target.",
    icon: "\u21E5",
  },
  thrusters: {
    id: "thrusters",
    name: "Hot Soles",
    kicker: "MOVEMENT",
    description: "Move 14% faster in every direction.",
    icon: "\u25B2",
  },
  dashCore: {
    id: "dashCore",
    name: "Blink Core",
    kicker: "DASH",
    description: "Dash recharges 22% faster.",
    icon: "\xBB",
  },
  magnet: {
    id: "magnet",
    name: "Prize Magnet",
    kicker: "PICKUPS",
    description: "Pull rewards in from twice the distance.",
    icon: "\u2299",
  },
  reinforced: {
    id: "reinforced",
    name: "Live Armor",
    kicker: "SURVIVAL",
    description: "Gain 30 max health and repair 50.",
    icon: "\u271A",
  },
};

/** Room kinds a route door can offer (the opening and boss rooms are fixed). */
export const ROUTE_KINDS = [
  "jackpot",
  "crossfire",
  "rush",
  "armory",
  "recovery",
  "demolition",
  "fortress",
  "blackout",
  "prize",
];

export const oppositeDirection = (direction) =>
  ({ NORTH: "SOUTH", EAST: "WEST", SOUTH: "NORTH", WEST: "EAST" })[direction];

/** A room kind dressed for a level: its own names, danger line, accent and sponsor. */
export function roomFor(level, kind) {
  if (level === 1) return ROOMS[kind];
  const def = LEVELS[level];
  const base = ROOMS[kind];
  return {
    ...base,
    name: def.roomNames[kind],
    kicker: kind === "opening" ? def.kicker : `${def.shortName} // ${base.kicker}`,
    description: `${def.challenge} ${base.description}`,
    reward:
      kind === "boss"
        ? `LEVEL ${String(level).padStart(2, "0")} CLEARANCE`
        : kind === "armory"
          ? `SIGNATURE WEAPON // ${def.signatureWeapon.toUpperCase()}`
          : base.reward,
    danger: dangerLabel(level, kind),
    accent:
      kind === "crossfire" || kind === "rush" || kind === "demolition"
        ? def.secondary
        : kind === "prize"
          ? base.accent
          : def.accent,
    sponsorId: base.sponsorId ? (def.sponsorId ?? base.sponsorId) : undefined,
  };
}

export function openingRoom(level) {
  return {
    id: `level-${level}-room-1-0-opening`,
    level,
    depth: 1,
    lane: 0,
    direction: "NORTH",
    destination: "room",
    ...roomFor(level, "opening"),
  };
}

export function bossDoor(level, lane, direction, depth = ROOMS_PER_LEVEL + 1) {
  return {
    id: `level-${level}-boss-${lane}-${depth}`,
    level,
    depth,
    lane,
    direction,
    destination: "boss",
    ...roomFor(level, "boss"),
  };
}

export function nextLevelDoor(level, lane, direction) {
  const next = nextLevel(level);
  if (!next) return null;
  const def = LEVELS[next];
  return {
    id: `level-${level}-exit-to-${next}`,
    level: next,
    depth: 1,
    lane,
    direction,
    destination: "nextLevel",
    kind: "opening",
    name: def.name,
    kicker: `LEVEL ${String(next).padStart(2, "0")} // ${def.kicker}`,
    description: def.challenge,
    reward: `${def.signatureWeapon === "pulse" ? "PULSE-9" : def.signatureWeapon.toUpperCase()} BASE LOADOUT`,
    danger: def.mechanicName,
    risk: "EXTREME",
    accent: def.accent,
    sponsorId: def.sponsorId,
  };
}

export function campaignExitDoor(lane, direction) {
  return {
    id: "campaign-signal-nine-exit",
    level: 5,
    depth: ROOMS_PER_LEVEL + 2,
    lane,
    direction,
    destination: "campaignExit",
    kind: "boss",
    name: "SIGNAL NINE EXIT",
    kicker: "QUADE PROTOCOL // RESTORED",
    description: "The sealed return door is open. Leave the forecast behind.",
    reward: "FREEDOM",
    danger: "NONE // RUN",
    risk: "LOW",
    accent: "#ffd15c",
  };
}

export function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function doorFor(level, depth, lane, kind, direction) {
  const room = roomFor(level, kind);
  return {
    id: `level-${level}-room-${depth}-${lane}-${room.kind}`,
    level,
    depth,
    lane,
    destination: "room",
    kind: room.kind,
    name: room.name,
    kicker: room.kicker,
    description: room.description,
    reward: room.reward,
    danger: room.danger,
    risk: room.risk,
    direction,
    accent: room.accent,
    sponsorId: room.sponsorId,
  };
}

/**
 * The doors out of a cleared room: two or three forward lanes, one sponsored
 * room among them, never the room just played and never back the way you came.
 */
export function routeChoices({
  level,
  currentDepth,
  currentLane,
  currentKind,
  backDirection,
  previousRoomId,
  random,
}) {
  if (currentDepth >= ROOMS_PER_LEVEL) return [];
  const depth = currentDepth + 1;
  const lanes = currentLane === 0 ? [-1, 0, 1] : currentLane < 0 ? [-1, 0] : [0, 1];
  const kinds = ROUTE_KINDS.filter((kind) => kind !== currentKind);
  const plain = kinds.filter((kind) => !ROOMS[kind].sponsorId);
  const sponsored = kinds.filter((kind) => ROOMS[kind].sponsorId);
  const pick = sponsored[Math.floor(random() * sponsored.length)];
  const order = depth === 2 ? ["jackpot", ...shuffle(plain, random)] : shuffle([...plain, pick], random);
  const directions = shuffle(
    DIRECTIONS.filter((direction) => direction !== backDirection),
    random,
  );
  return lanes
    .map((lane, index) => doorFor(level, depth, lane, order[index], directions[index]))
    .filter((door) => door.id !== previousRoomId);
}

/* ---------------------------------------------------------------- overtime */

/** Overtime: a boss every OVERTIME_BOSS_EVERY waves, a sponsor break every OVERTIME_UPGRADE_EVERY. */
export const OVERTIME_BOSS_EVERY = 6;
export const OVERTIME_UPGRADE_EVERY = 3;
/** The floor theme (and its hostiles, hazards and boss) changes every this many waves. */
export const OVERTIME_THEME_WAVES = 4;

export const overtimeTheme = (wave) => (Math.floor((wave - 1) / OVERTIME_THEME_WAVES) % 5) + 1;

/** Doors after an Overtime wave: two or three random rooms, or the boss gate. */
export function overtimeChoices({ wave, lane, backDirection, currentKind, random }) {
  const next = wave + 1;
  const level = overtimeTheme(next);
  const directions = shuffle(
    DIRECTIONS.filter((direction) => direction !== backDirection),
    random,
  );
  if (next % OVERTIME_BOSS_EVERY === 0) {
    const door = bossDoor(level, lane, directions[0], next);
    return [
      { ...door, id: `overtime-${next}-boss`, kicker: `OVERTIME // WAVE ${String(next).padStart(2, "0")}` },
    ];
  }
  const kinds = shuffle(
    ROUTE_KINDS.filter((kind) => kind !== currentKind),
    random,
  );
  const count = random() > 0.4 ? 3 : 2;
  const lanes = count === 3 ? [-1, 0, 1] : [0, 1];
  return lanes.map((laneId, index) => {
    const door = doorFor(level, next, laneId, kinds[index], directions[index]);
    return {
      ...door,
      id: `overtime-${next}-${index}-${door.kind}`,
      kicker: `OVERTIME // WAVE ${String(next).padStart(2, "0")}`,
    };
  });
}

/* ---------------------------------------------------------------- contracts (difficulty) */

export const CONTRACTS = {
  rookie: {
    id: "rookie",
    label: "ROOKIE",
    note: "Hits land softer, enemy fire slows. Score x0.75.",
    damageTaken: 0.6,
    enemyHp: 0.9,
    bulletSpeed: 0.85,
    score: 0.75,
  },
  standard: {
    id: "standard",
    label: "STANDARD",
    note: "The broadcast as the Network designed it.",
    damageTaken: 1,
    enemyHp: 1,
    bulletSpeed: 1,
    score: 1,
  },
  prime: {
    id: "prime",
    label: "PRIME TIME",
    note: "Harder hits, tougher crowds, faster fire. Score x1.25.",
    damageTaken: 1.25,
    enemyHp: 1.2,
    bulletSpeed: 1.1,
    score: 1.25,
  },
};

/* ---------------------------------------------------------------- prize studio */

export const PRIZE_ROUND_SECONDS = 20;
export const PRIZES = [
  { name: "NEON TOASTER", value: 500, weight: 5 },
  { name: "HOLO VCR", value: 750, weight: 4 },
  { name: "JET SKI", value: 1200, weight: 2 },
  { name: "DREAM CONDO", value: 2500, weight: 0.6 },
];
const PRIZE_WEIGHT = PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
export function pickPrize(roll) {
  let left = roll * PRIZE_WEIGHT;
  for (const prize of PRIZES) {
    left -= prize.weight;
    if (left <= 0) return prize;
  }
  return PRIZES[0];
}

/* ---------------------------------------------------------------- campaign record */

const CAMPAIGN_KEY = "neon-gauntlet-campaign-v1";
const LEGACY_BEST_KEY = "neon-gauntlet-best";
const SIGNATURE_UNLOCKS = ["arc", "graft", "disc", "contradiction"];

export const CAMPAIGN_DEFAULT = {
  version: 1,
  highestUnlockedLevel: 1,
  completedLevels: [],
  unlockedWeapons: [],
  bestByLevel: {},
  bestTimeByLevel: {},
  campaignCompletions: 0,
  lastSelectedLevel: 1,
  overtimeBest: 0,
  overtimeBestWave: 0,
};

const isLevel = (value) => typeof value === "number" && LEVEL_IDS.includes(value);
const isUnlockableWeapon = (value) => typeof value === "string" && SIGNATURE_UNLOCKS.includes(value);
const wholeNumber = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** Coerce anything read from storage into a valid campaign record. */
export function sanitizeCampaign(raw, legacyBest = 0) {
  const source = raw && typeof raw === "object" ? raw : {};
  const completed = Array.from(new Set((source.completedLevels ?? []).filter(isLevel))).sort((a, b) => a - b);
  const weapons = Array.from(new Set((source.unlockedWeapons ?? []).filter(isUnlockableWeapon)));
  const best = {};
  const times = {};
  for (const level of LEVEL_IDS) {
    const score = Number(source.bestByLevel?.[level] ?? (level === 1 ? legacyBest : 0));
    if (Number.isFinite(score) && score > 0) best[level] = Math.floor(score);
    const time = Number(source.bestTimeByLevel?.[level] ?? 0);
    if (Number.isFinite(time) && time > 0) times[level] = Math.round(time * 10) / 10;
  }
  const fromCompleted = completed.length ? Math.min(5, Math.max(...completed) + 1) : 1;
  const stored = isLevel(source.highestUnlockedLevel) ? source.highestUnlockedLevel : 1;
  const highest = Math.max(stored, fromCompleted);
  return {
    version: 1,
    highestUnlockedLevel: highest,
    completedLevels: completed,
    unlockedWeapons: weapons,
    bestByLevel: best,
    bestTimeByLevel: times,
    campaignCompletions: wholeNumber(source.campaignCompletions),
    lastSelectedLevel:
      isLevel(source.lastSelectedLevel) && source.lastSelectedLevel <= highest
        ? source.lastSelectedLevel
        : highest,
    overtimeBest: wholeNumber(source.overtimeBest),
    overtimeBestWave: wholeNumber(source.overtimeBestWave),
  };
}

export function loadCampaign(storage) {
  try {
    const legacy = Number.parseInt(storage.getItem(LEGACY_BEST_KEY) ?? "0", 10) || 0;
    return sanitizeCampaign(JSON.parse(storage.getItem(CAMPAIGN_KEY) ?? "null"), legacy);
  } catch {
    return sanitizeCampaign(null);
  }
}

export function saveCampaign(storage, progress) {
  try {
    storage.setItem(CAMPAIGN_KEY, JSON.stringify(progress));
  } catch {
    /* private mode or full storage: the run still plays */
  }
}

export function saveLegacyBest(storage, best) {
  try {
    storage.setItem(LEGACY_BEST_KEY, String(best));
  } catch {
    /* ignore */
  }
}

export function selectLevel(progress, level) {
  return level > progress.highestUnlockedLevel ? progress : { ...progress, lastSelectedLevel: level };
}

/** A level's boss is down: mark it, unlock the next level and its signature weapon, keep the best score and time. */
export function recordLevelClear(progress, level, score, signatureWeapon, time) {
  const firstClear = !progress.completedLevels.includes(level);
  const completed = firstClear
    ? [...progress.completedLevels, level].sort((a, b) => a - b)
    : progress.completedLevels;
  const weapons =
    signatureWeapon === "pulse" || progress.unlockedWeapons.includes(signatureWeapon)
      ? progress.unlockedWeapons
      : [...progress.unlockedWeapons, signatureWeapon];
  const next = Math.min(5, level + 1);
  const previousTime = progress.bestTimeByLevel?.[level] ?? 0;
  return {
    ...progress,
    highestUnlockedLevel: Math.max(progress.highestUnlockedLevel, next),
    completedLevels: completed,
    unlockedWeapons: weapons,
    bestByLevel: {
      ...progress.bestByLevel,
      [level]: Math.max(progress.bestByLevel[level] ?? 0, Math.floor(score)),
    },
    bestTimeByLevel: {
      ...progress.bestTimeByLevel,
      [level]:
        previousTime > 0 ? Math.min(previousTime, Math.round(time * 10) / 10) : Math.round(time * 10) / 10,
    },
    campaignCompletions: progress.campaignCompletions + Number(level === 5 && firstClear),
    lastSelectedLevel: next,
  };
}
