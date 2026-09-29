function systemById(r) {
  return SYSTEMS.find((e) => e.id === r) ?? SYSTEMS[0];
}
function commodityById(r) {
  return COMMODITIES.find((e) => e.id === r);
}
function shipById(r) {
  return SHIPS.find((e) => e.id === r) ?? SHIPS[0];
}
function moduleById(r) {
  return MODULES[r];
}
const FACTIONS = {
  concord: {
    id: "concord",
    name: "Concord Directorate",
    short: "CON",
    color: "#68d8ff",
    description: "Orderly civic worlds backed by fast-response security fleets.",
    law: "Contraband, piracy, and unlicensed weapons are aggressively prosecuted.",
    doctrine: "Layered patrols, disabling ion fire, and disciplined reinforcements.",
    specialty: "Sensors, shields, law-enforcement hulls",
    scanStrictness: 0.9,
    allies: ["choir"],
    enemies: ["freewake", "vanta"],
  },
  aurora: {
    id: "aurora",
    name: "Aurora Combine",
    short: "AUR",
    color: "#ffc857",
    description: "A merchant-industrial bloc that treats every crisis as a market.",
    law: "Trade law is strict; officials are famously open to administrative fees.",
    doctrine: "Escort screens protect heavy commercial batteries.",
    specialty: "Trade, reactors, cargo engineering",
    scanStrictness: 0.62,
    allies: ["concord"],
    enemies: ["vanta"],
  },
  vanta: {
    id: "vanta",
    name: "Vanta Hegemony",
    short: "VAN",
    color: "#ff6d8d",
    description: "A militarized frontier power expanding through disciplined force.",
    law: "Weapons are legal. Disobedience is not.",
    doctrine: "Rush formations, armor, torpedoes, and decisive force.",
    specialty: "Armor, railguns, military hulls",
    scanStrictness: 0.78,
    allies: [],
    enemies: ["concord", "aurora", "freewake"],
  },
  freewake: {
    id: "freewake",
    name: "Freewake Cartel",
    short: "FWK",
    color: "#c782ff",
    description: "Pirates, smugglers, fixers, and defectors held together by profit.",
    law: "The only crime is failing to pay your cut.",
    doctrine: "Ambush, electronic warfare, mines, and escape routes.",
    specialty: "Smuggling, boarding, black-market systems",
    scanStrictness: 0.08,
    allies: [],
    enemies: ["concord", "vanta"],
  },
  choir: {
    id: "choir",
    name: "The Luminous Choir",
    short: "LUX",
    color: "#65f5b4",
    description: "Nomadic researchers seeking signals inside ancient machine ruins.",
    law: "Artifact trafficking is forbidden; exploration is sacred.",
    doctrine: "Long-range beams, drones, and sensor superiority.",
    specialty: "Exploration, plasma, anomaly technology",
    scanStrictness: 0.54,
    allies: ["concord"],
    enemies: ["freewake"],
  },
  independent: {
    id: "independent",
    name: "Independent League",
    short: "IND",
    color: "#aab5d6",
    description: "Loose colonies and cooperatives surviving between larger powers.",
    law: "Local rules vary. Mutual aid travels farther than paperwork.",
    doctrine: "Improvised mixed fleets that protect local infrastructure.",
    specialty: "Mining, salvage, adaptable civilian hulls",
    scanStrictness: 0.32,
    allies: [],
    enemies: [],
  },
};
const COMMODITIES = [
  {
    id: "rations",
    name: "Hydro Rations",
    icon: "RA",
    base: 18,
    volatility: 0.2,
    illegal: !1,
    mass: 1,
    warDemand: 1.35,
    description: "Shelf-stable food for crowded habitats.",
  },
  {
    id: "medicine",
    name: "Medigel",
    icon: "MG",
    base: 66,
    volatility: 0.36,
    illegal: !1,
    mass: 1,
    warDemand: 1.8,
    description: "Trauma treatment and colony vaccines.",
  },
  {
    id: "ore",
    name: "Ferric Ore",
    icon: "OR",
    base: 14,
    volatility: 0.24,
    illegal: !1,
    mass: 2,
    warDemand: 0.9,
    description: "Raw asteroid feedstock.",
  },
  {
    id: "alloys",
    name: "Smart Alloys",
    icon: "AL",
    base: 54,
    volatility: 0.25,
    illegal: !1,
    mass: 2,
    warDemand: 1.45,
    description: "Self-tempering construction metals.",
  },
  {
    id: "electronics",
    name: "Quantum Circuits",
    icon: "QC",
    base: 92,
    volatility: 0.31,
    illegal: !1,
    mass: 1,
    warDemand: 1.25,
    description: "Processors for ships and stations.",
  },
  {
    id: "fuel",
    name: "Helium-3",
    icon: "H3",
    base: 31,
    volatility: 0.18,
    illegal: !1,
    mass: 1,
    warDemand: 1.65,
    description: "Refined jump and reactor fuel.",
  },
  {
    id: "machinery",
    name: "Industrial Assemblies",
    icon: "MA",
    base: 112,
    volatility: 0.28,
    illegal: !1,
    mass: 2,
    warDemand: 1.2,
    description: "Mining heads, fabbers, and station repair systems.",
  },
  {
    id: "luxuries",
    name: "Orbital Luxuries",
    icon: "LX",
    base: 125,
    volatility: 0.42,
    illegal: !1,
    mass: 1,
    warDemand: 0.45,
    description: "Designer flora, cuisine, and zero-g art.",
  },
  {
    id: "weapons",
    name: "Restricted Arms",
    icon: "RX",
    base: 160,
    volatility: 0.52,
    illegal: !0,
    mass: 2,
    warDemand: 2.1,
    description: "Unregistered military hardware.",
  },
  {
    id: "artifacts",
    name: "Choir Relics",
    icon: "AR",
    base: 240,
    volatility: 0.7,
    illegal: !0,
    mass: 1,
    warDemand: 0.6,
    description: "Pre-collapse machine fragments.",
  },
  {
    id: "spice",
    name: "Dreamspice",
    icon: "DS",
    base: 190,
    volatility: 0.64,
    illegal: !0,
    mass: 1,
    warDemand: 0.5,
    description: "A banned neural stimulant.",
  },
  {
    id: "scrap",
    name: "Reactor Scrap",
    icon: "SC",
    base: 24,
    volatility: 0.3,
    illegal: !1,
    mass: 2,
    warDemand: 1.1,
    description: "Recoverable wreck metal, cabling, and drive ceramics.",
  },
];
const FULL_SERVICES = ["market", "contracts", "shipyard", "equipment", "crew", "repair", "legal", "storage", "intel"];
const OUTPOST_SERVICES = ["market", "contracts", "equipment", "crew", "repair", "storage"];
const SYSTEMS = [
  {
    id: "meridian",
    name: "Meridian",
    subtitle: "Bright heart of the frontier",
    owner: "concord",
    security: 4,
    piracy: 0.08,
    war: 0.05,
    hazard: 0.05,
    population: 5,
    economy: "Civic trade nexus",
    government: "Directorate prefecture",
    danger: "Low",
    palette: ["#08182b", "#2b7fff", "#58e1ff"],
    position: [43, 43],
    links: ["cinder", "halcyon", "morrow", "argent"],
    supply: {
      rations: 1.28,
      medicine: 0.8,
      ore: 0.62,
      electronics: 1.14,
      luxuries: 0.82,
      weapons: 0.55,
      machinery: 0.95,
    },
    industries: ["administration", "finance", "orbital assembly"],
    stations: [
      {
        name: "Crown Exchange",
        type: "Metropolitan orbital",
        services: FULL_SERVICES,
      },
      {
        name: "Concord Ring",
        type: "Security citadel",
        services: ["contracts", "equipment", "repair", "legal", "intel"],
      },
    ],
    landmarks: ["Crown Exchange", "Blueglass Moon", "Concord Ring"],
    mechanicalIdentity: "Highest lawful traffic density, fast police response, and low market spreads.",
  },
  {
    id: "cinder",
    name: "Cinder",
    subtitle: "Foundries under a red sun",
    owner: "aurora",
    security: 3,
    piracy: 0.2,
    war: 0.14,
    hazard: 0.28,
    population: 4,
    economy: "Heavy industry",
    government: "Combine industrial charter",
    danger: "Guarded",
    palette: ["#23101a", "#ff733d", "#ffc857"],
    position: [27, 28],
    links: ["meridian", "bastion", "gloam", "pyre"],
    supply: {
      rations: 0.72,
      medicine: 0.78,
      ore: 1.45,
      alloys: 1.38,
      electronics: 0.88,
      fuel: 1.2,
      machinery: 1.32,
      scrap: 1.1,
    },
    industries: ["mining", "refining", "shipbuilding"],
    stations: [
      {
        name: "Kiln Shipyard",
        type: "Industrial shipyard",
        services: FULL_SERVICES,
      },
      {
        name: "Foundry Belt",
        type: "Distributed refinery",
        services: OUTPOST_SERVICES,
      },
    ],
    landmarks: ["Kiln Shipyard", "Foundry Belt", "Ashfall Relay"],
    mechanicalIdentity: "Dense mineable fields, superior industrial modules, and heat hazards.",
  },
  {
    id: "halcyon",
    name: "Halcyon",
    subtitle: "Garden habitats and quiet money",
    owner: "aurora",
    security: 4,
    piracy: 0.07,
    war: 0.03,
    hazard: 0.04,
    population: 4,
    economy: "Biotech & luxury",
    government: "Combine garden trust",
    danger: "Low",
    palette: ["#071d25", "#00b894", "#ffe27a"],
    position: [64, 27],
    links: ["meridian", "veil", "solace", "zenith"],
    supply: {
      rations: 1.5,
      medicine: 1.42,
      luxuries: 1.35,
      ore: 0.58,
      alloys: 0.7,
      fuel: 0.82,
      machinery: 0.78,
    },
    industries: ["agriculture", "biotech", "luxury fabrication"],
    stations: [
      {
        name: "Verdant Arcology",
        type: "Habitat city",
        services: FULL_SERVICES,
      },
      {
        name: "Silk Market",
        type: "Luxury exchange",
        services: ["market", "contracts", "crew", "storage", "intel"],
      },
    ],
    landmarks: ["Verdant Arcology", "Silk Market", "Pilgrim Comet"],
    mechanicalIdentity: "Cheap food and medicine, high luxury demand, and premium crew contacts.",
  },
  {
    id: "morrow",
    name: "Morrow",
    subtitle: "Free ports beyond the patrol line",
    owner: "independent",
    security: 2,
    piracy: 0.36,
    war: 0.18,
    hazard: 0.16,
    population: 3,
    economy: "Salvage & free trade",
    government: "Freeport compact",
    danger: "Unstable",
    palette: ["#151125", "#7768ff", "#49dcb1"],
    position: [54, 59],
    links: ["meridian", "rift", "veil", "echo"],
    supply: {
      ore: 1.2,
      fuel: 0.9,
      weapons: 1.18,
      artifacts: 0.72,
      rations: 0.82,
      electronics: 0.76,
      scrap: 1.6,
    },
    industries: ["salvage", "repair", "gambling"],
    stations: [
      {
        name: "Morrow Freeport",
        type: "Independent freeport",
        services: [...OUTPOST_SERVICES, "blackMarket", "intel"],
      },
      {
        name: "Lucky Nine",
        type: "Casino habitat",
        services: ["market", "contracts", "crew", "intel"],
      },
    ],
    landmarks: ["Morrow Freeport", "Old War Grave", "Lucky Nine Casino"],
    mechanicalIdentity: "Abundant salvage, permissive trade, and frequent criminal opportunities.",
  },
  {
    id: "bastion",
    name: "Bastion",
    subtitle: "A fortress pointed at the dark",
    owner: "vanta",
    security: 5,
    piracy: 0.04,
    war: 0.5,
    hazard: 0.08,
    population: 3,
    economy: "Military production",
    government: "Hegemony martial district",
    danger: "Restricted",
    palette: ["#1e0c18", "#e13f68", "#ffad66"],
    position: [17, 55],
    links: ["cinder", "rift", "pyre"],
    supply: {
      weapons: 1.5,
      alloys: 1.3,
      fuel: 1.1,
      medicine: 0.62,
      luxuries: 0.5,
      electronics: 1.2,
      machinery: 1.25,
    },
    industries: ["arms", "armor", "fleet logistics"],
    stations: [
      {
        name: "Iron Basilica",
        type: "Military citadel",
        services: ["contracts", "shipyard", "equipment", "repair", "legal"],
      },
      {
        name: "Red Banner Yards",
        type: "Naval shipyard",
        services: ["shipyard", "equipment", "repair"],
      },
    ],
    landmarks: ["Iron Basilica", "Blockade Line", "Red Banner Yards"],
    mechanicalIdentity: "Restricted military market, elite patrols, and high-value faction contracts.",
  },
  {
    id: "gloam",
    name: "Gloam",
    subtitle: "A black market wearing a star system",
    owner: "freewake",
    security: 1,
    piracy: 0.82,
    war: 0.28,
    hazard: 0.34,
    population: 2,
    economy: "Contraband & piracy",
    government: "Cartel council",
    danger: "Severe",
    palette: ["#14091e", "#9a4dff", "#ff4d91"],
    position: [8, 18],
    links: ["cinder", "null", "corsair"],
    supply: {
      weapons: 1.4,
      spice: 1.52,
      artifacts: 1.15,
      medicine: 0.7,
      rations: 0.7,
      luxuries: 0.96,
      scrap: 1.35,
    },
    industries: ["smuggling", "ship breaking", "forgery"],
    stations: [
      {
        name: "The Crooked Crown",
        type: "Pirate city",
        services: [...OUTPOST_SERVICES, "blackMarket", "intel"],
      },
      {
        name: "Widow's Gate",
        type: "Smuggler den",
        services: ["market", "contracts", "equipment", "blackMarket", "intel"],
      },
    ],
    landmarks: ["The Crooked Crown", "Knife Nebula", "Widow's Gate"],
    mechanicalIdentity: "No contraband restrictions, pirate reputation services, and constant ambush risk.",
  },
  {
    id: "veil",
    name: "Veil",
    subtitle: "Signals in a turquoise nebula",
    owner: "choir",
    security: 2,
    piracy: 0.16,
    war: 0.05,
    hazard: 0.72,
    population: 2,
    economy: "Research & pilgrimage",
    government: "Choir conclave",
    danger: "Anomalous",
    palette: ["#061923", "#00d2c6", "#8bffb7"],
    position: [80, 48],
    links: ["halcyon", "morrow", "null", "echo"],
    supply: {
      artifacts: 1.3,
      electronics: 1.35,
      medicine: 1.1,
      ore: 0.52,
      weapons: 0.5,
      luxuries: 0.8,
      machinery: 0.9,
    },
    industries: ["research", "sensor fabrication", "pilgrimage"],
    stations: [
      {
        name: "Canticle Array",
        type: "Research sanctuary",
        services: ["market", "contracts", "equipment", "crew", "repair", "intel"],
      },
      {
        name: "Glass Labyrinth",
        type: "Anomaly observatory",
        services: ["contracts", "equipment", "intel"],
      },
    ],
    landmarks: ["Canticle Array", "Glass Labyrinth", "Sleeping Beacon"],
    mechanicalIdentity: "Environmental interference, rich anomalies, and rare exploration technology.",
  },
  {
    id: "rift",
    name: "Rift",
    subtitle: "The war keeps changing hands",
    owner: "vanta",
    security: 2,
    piracy: 0.42,
    war: 0.9,
    hazard: 0.32,
    population: 1,
    economy: "War salvage",
    government: "Contested military zone",
    danger: "Warzone",
    palette: ["#10142c", "#f24e72", "#7a80ff"],
    position: [36, 79],
    links: ["bastion", "morrow", "null", "argent"],
    supply: {
      ore: 1.28,
      alloys: 0.95,
      weapons: 0.88,
      medicine: 0.55,
      rations: 0.64,
      fuel: 0.74,
      scrap: 1.75,
    },
    industries: ["battle salvage", "forward logistics"],
    stations: [
      {
        name: "Kestrel Redoubt",
        type: "Forward fortress",
        services: ["contracts", "equipment", "repair", "legal"],
      },
      {
        name: "No-Man's Beacon",
        type: "Neutral relief post",
        services: OUTPOST_SERVICES,
      },
    ],
    landmarks: ["Broken Armada", "Kestrel Redoubt", "No-Man's Beacon"],
    mechanicalIdentity: "Large spontaneous battles, shortages, blockades, and valuable wreck fields.",
  },
  {
    id: "null",
    name: "Null",
    subtitle: "No charts agree on what lives here",
    owner: "independent",
    security: 0,
    piracy: 0.55,
    war: 0.08,
    hazard: 0.95,
    population: 0,
    economy: "Unknown",
    government: "Unclaimed",
    danger: "Extreme",
    palette: ["#050715", "#3758c9", "#d266ff"],
    position: [91, 83],
    links: ["gloam", "veil", "rift", "echo"],
    supply: {
      artifacts: 1.62,
      ore: 1.2,
      fuel: 0.52,
      rations: 0.44,
      medicine: 0.48,
      electronics: 0.72,
      scrap: 1.2,
    },
    industries: ["unknown"],
    stations: [
      {
        name: "Unmarked Gate",
        type: "Hidden refuge",
        services: ["market", "contracts", "repair", "storage", "intel"],
      },
    ],
    landmarks: ["The Quiet Star", "Impossible Orbit", "Unmarked Gate"],
    mechanicalIdentity: "Endgame anomalies, unique technology, navigation distortions, and no lawful rescue.",
  },
  {
    id: "solace",
    name: "Solace",
    subtitle: "Cooperatives beneath a pale ring",
    owner: "independent",
    security: 3,
    piracy: 0.12,
    war: 0.02,
    hazard: 0.08,
    population: 3,
    economy: "Agriculture & colonization",
    government: "Colony assembly",
    danger: "Low",
    palette: ["#0b2030", "#45b7a1", "#d7f27c"],
    position: [76, 14],
    links: ["halcyon", "zenith"],
    supply: {
      rations: 1.72,
      medicine: 1.18,
      machinery: 0.62,
      electronics: 0.7,
      fuel: 0.78,
      luxuries: 0.9,
    },
    industries: ["agriculture", "terraforming", "passenger traffic"],
    stations: [
      {
        name: "Hearthwheel",
        type: "Colony capital",
        services: FULL_SERVICES,
      },
      {
        name: "Seed Vault Twelve",
        type: "Agricultural vault",
        services: ["market", "contracts", "repair"],
      },
    ],
    landmarks: ["Hearthwheel", "Pale Ring", "Seed Vault Twelve"],
    mechanicalIdentity: "Passenger and relief work, cheap necessities, and low-risk starter trade.",
  },
  {
    id: "argent",
    name: "Argent",
    subtitle: "Chrome docks around a blue giant",
    owner: "concord",
    security: 4,
    piracy: 0.1,
    war: 0.25,
    hazard: 0.12,
    population: 4,
    economy: "Advanced shipbuilding",
    government: "Directorate naval franchise",
    danger: "Guarded",
    palette: ["#071526", "#4f80c8", "#d9edff"],
    position: [43, 15],
    links: ["meridian", "rift", "zenith"],
    supply: {
      alloys: 1.4,
      electronics: 1.34,
      machinery: 1.28,
      weapons: 0.94,
      ore: 0.76,
      rations: 0.82,
    },
    industries: ["shipbuilding", "shield fabrication", "naval research"],
    stations: [
      {
        name: "Argent Spire",
        type: "Grand shipyard",
        services: FULL_SERVICES,
      },
      {
        name: "Mirror Drydock",
        type: "Prototype dock",
        services: ["shipyard", "equipment", "repair", "intel"],
      },
    ],
    landmarks: ["Argent Spire", "Mirror Drydock", "Sapphire Giant"],
    mechanicalIdentity: "Broadest lawful hull inventory and advanced shield equipment.",
  },
  {
    id: "pyre",
    name: "Pyre",
    subtitle: "The Hegemony's furnace frontier",
    owner: "vanta",
    security: 3,
    piracy: 0.22,
    war: 0.64,
    hazard: 0.52,
    population: 2,
    economy: "Arms & extraction",
    government: "Hegemony commandery",
    danger: "Hostile",
    palette: ["#240c16", "#bf2f4d", "#ff8a42"],
    position: [13, 76],
    links: ["cinder", "bastion", "corsair"],
    supply: {
      ore: 1.52,
      alloys: 1.45,
      weapons: 1.42,
      machinery: 1.2,
      medicine: 0.58,
      rations: 0.56,
      fuel: 1.16,
    },
    industries: ["mining", "arms", "torpedo fabrication"],
    stations: [
      {
        name: "Forge of Oaths",
        type: "Military foundry",
        services: ["market", "contracts", "shipyard", "equipment", "repair", "legal"],
      },
    ],
    landmarks: ["Forge of Oaths", "Ember Mines", "Oathkeeper Fleet"],
    mechanicalIdentity: "Dangerous legal mining, heavy weapons, and coercive military contracts.",
  },
  {
    id: "echo",
    name: "Echo",
    subtitle: "Every transmission returns changed",
    owner: "choir",
    security: 1,
    piracy: 0.2,
    war: 0.03,
    hazard: 0.88,
    population: 1,
    economy: "Anomaly survey",
    government: "Choir expedition",
    danger: "Anomalous",
    palette: ["#07151e", "#2d9e9b", "#c1ffdc"],
    position: [70, 72],
    links: ["morrow", "veil", "null"],
    supply: {
      artifacts: 1.48,
      electronics: 1.18,
      fuel: 0.65,
      medicine: 0.72,
      machinery: 0.78,
      scrap: 1.12,
    },
    industries: ["surveying", "relic study", "signal cartography"],
    stations: [
      {
        name: "Echo Array",
        type: "Deep survey station",
        services: ["contracts", "equipment", "repair", "intel", "storage"],
      },
    ],
    landmarks: ["Echo Array", "Recursive Signal", "Drift Cathedral"],
    mechanicalIdentity: "Scan-focused exploration, sensor ghosts, and story-critical discoveries.",
  },
  {
    id: "corsair",
    name: "Corsair",
    subtitle: "A republic of stolen transponders",
    owner: "freewake",
    security: 0,
    piracy: 0.92,
    war: 0.42,
    hazard: 0.25,
    population: 2,
    economy: "Raiding & ship capture",
    government: "Captain's moot",
    danger: "Extreme",
    palette: ["#160b1c", "#7546a8", "#ff5f8f"],
    position: [4, 47],
    links: ["gloam", "pyre"],
    supply: {
      weapons: 1.55,
      scrap: 1.62,
      spice: 1.24,
      fuel: 0.78,
      medicine: 0.6,
      luxuries: 1.1,
    },
    industries: ["piracy", "boarding", "chop shops"],
    stations: [
      {
        name: "Red Knuckle",
        type: "Pirate fortress",
        services: [...OUTPOST_SERVICES, "blackMarket", "intel"],
      },
      {
        name: "Chopshop Moon",
        type: "Hijacked ship market",
        services: ["shipyard", "equipment", "repair", "blackMarket"],
      },
    ],
    landmarks: ["Red Knuckle", "Chopshop Moon", "The Gauntlet"],
    mechanicalIdentity: "Boarding rewards, captured hull markets, and relentless pirate traffic.",
  },
  {
    id: "zenith",
    name: "Zenith",
    subtitle: "Markets move before the news arrives",
    owner: "aurora",
    security: 4,
    piracy: 0.08,
    war: 0.08,
    hazard: 0.03,
    population: 5,
    economy: "Finance & logistics",
    government: "Combine exchange authority",
    danger: "Low",
    palette: ["#11152a", "#6e66cf", "#ffd26b"],
    position: [59, 7],
    links: ["halcyon", "solace", "argent"],
    supply: {
      electronics: 1.28,
      luxuries: 1.4,
      machinery: 1.1,
      ore: 0.52,
      rations: 0.88,
      fuel: 1.02,
    },
    industries: ["finance", "logistics", "consumer fabrication"],
    stations: [
      {
        name: "Zenith Exchange",
        type: "Megamarket",
        services: FULL_SERVICES,
      },
      {
        name: "Convoy Crown",
        type: "Logistics hub",
        services: ["market", "contracts", "repair", "storage", "intel"],
      },
    ],
    landmarks: ["Zenith Exchange", "Convoy Crown", "Dividend Gardens"],
    mechanicalIdentity: "Lowest trade spreads, live market intelligence, and high-value convoys.",
  },
];
const SHIPS = [
  {
    id: "kite",
    name: "Kite Mk II",
    className: "Courier",
    price: 0,
    hull: 110,
    armor: 42,
    shield: 80,
    speed: 15,
    acceleration: 25,
    braking: 0.88,
    drift: 0.26,
    boost: 1.62,
    cargo: 12,
    hiddenCargo: 0,
    energy: 100,
    turn: 8,
    mass: 32,
    slots: 2,
    mounts: 2,
    signature: 0.8,
    weapon: "pulse",
    defaultWeapons: ["pulse", "laser"],
    defaultModules: [],
    blurb: "Light, forgiving, and quick enough to survive bad decisions.",
  },
  {
    id: "needle",
    name: "Needle",
    className: "Interceptor",
    price: 11800,
    hull: 92,
    armor: 28,
    shield: 115,
    speed: 20.5,
    acceleration: 35,
    braking: 0.94,
    drift: 0.18,
    boost: 1.82,
    cargo: 5,
    hiddenCargo: 0,
    energy: 138,
    turn: 12,
    mass: 25,
    slots: 2,
    mounts: 3,
    signature: 0.62,
    weapon: "autocannon",
    defaultWeapons: ["autocannon", "pulse", "rocket"],
    defaultModules: ["overdrive"],
    faction: "concord",
    requiredReputation: 10,
    blurb: "A razor-fast pursuit hull that trades cargo and armor for initiative.",
  },
  {
    id: "mule",
    name: "Mule 7",
    className: "Freighter",
    price: 8200,
    hull: 175,
    armor: 95,
    shield: 100,
    speed: 10.5,
    acceleration: 16,
    braking: 0.72,
    drift: 0.48,
    boost: 1.42,
    cargo: 38,
    hiddenCargo: 0,
    energy: 120,
    turn: 5,
    mass: 86,
    slots: 3,
    mounts: 2,
    signature: 1.25,
    weapon: "scatter",
    defaultWeapons: ["scatter", "flak"],
    defaultModules: ["cargoPods"],
    blurb: "A reinforced cargo brick with surprising close-range teeth.",
  },
  {
    id: "prospector",
    name: "Prospector V",
    className: "Mining ship",
    price: 17600,
    hull: 205,
    armor: 105,
    shield: 118,
    speed: 10.8,
    acceleration: 17,
    braking: 0.76,
    drift: 0.42,
    boost: 1.38,
    cargo: 32,
    hiddenCargo: 0,
    energy: 150,
    turn: 5.4,
    mass: 92,
    slots: 4,
    mounts: 2,
    signature: 1.12,
    weapon: "miningLaser",
    defaultWeapons: ["miningLaser", "flak"],
    defaultModules: ["miningRig", "surveyScanner"],
    faction: "independent",
    blurb: "Industrial scanners and reinforced ore bays make dangerous rocks profitable.",
  },
  {
    id: "wraith",
    name: "Wraith",
    className: "Smuggler",
    price: 14500,
    hull: 98,
    armor: 45,
    shield: 135,
    speed: 19,
    acceleration: 32,
    braking: 0.92,
    drift: 0.2,
    boost: 1.76,
    cargo: 16,
    hiddenCargo: 7,
    energy: 145,
    turn: 11,
    mass: 29,
    slots: 3,
    mounts: 3,
    signature: 0.42,
    weapon: "plasma",
    defaultWeapons: ["plasma", "ion", "rocket"],
    defaultModules: ["hiddenHold", "ecmSuite"],
    faction: "freewake",
    requiredReputation: 5,
    blurb: "Fast, narrow, difficult to scan, and built around a concealed hold.",
  },
  {
    id: "bulwark",
    name: "Bulwark",
    className: "Gunship",
    price: 26e3,
    hull: 285,
    armor: 180,
    shield: 165,
    speed: 9.5,
    acceleration: 14,
    braking: 0.7,
    drift: 0.52,
    boost: 1.34,
    cargo: 18,
    hiddenCargo: 0,
    energy: 170,
    turn: 4.5,
    mass: 138,
    slots: 4,
    mounts: 4,
    signature: 1.42,
    weapon: "rail",
    defaultWeapons: ["rail", "autocannon", "flak", "torpedo"],
    defaultModules: ["reactiveArmor", "pointDefense"],
    faction: "vanta",
    requiredReputation: 10,
    blurb: "Slow authority. It turns incoming fire into an accounting problem.",
  },
  {
    id: "corsair",
    name: "Corsair",
    className: "Corvette",
    price: 52e3,
    hull: 510,
    armor: 310,
    shield: 265,
    speed: 10.2,
    acceleration: 15,
    braking: 0.68,
    drift: 0.56,
    boost: 1.3,
    cargo: 36,
    hiddenCargo: 6,
    energy: 230,
    turn: 4,
    mass: 220,
    slots: 6,
    mounts: 5,
    signature: 1.55,
    weapon: "autocannon",
    defaultWeapons: ["autocannon", "rail", "ion", "rocket", "flak"],
    defaultModules: ["reactiveArmor", "droneBay", "salvageArray"],
    faction: "freewake",
    requiredReputation: 25,
    blurb: "A compact fleet leader designed to disable, board, and disappear with the prize.",
  },
  {
    id: "atlas",
    name: "Atlas Crown",
    className: "Exploration cruiser",
    price: 48e3,
    hull: 245,
    armor: 125,
    shield: 230,
    speed: 12,
    acceleration: 18,
    braking: 0.82,
    drift: 0.34,
    boost: 1.5,
    cargo: 54,
    hiddenCargo: 0,
    energy: 220,
    turn: 5.4,
    mass: 126,
    slots: 5,
    mounts: 4,
    signature: 0.9,
    weapon: "plasma",
    defaultWeapons: ["plasma", "beam", "ion", "flak"],
    defaultModules: ["surveyScanner", "repairDrones", "droneBay"],
    faction: "choir",
    requiredReputation: 20,
    blurb: "A long-range command ship built for a career, not a single job.",
  },
  {
    id: "revenant",
    name: "Revenant",
    className: "Destroyer",
    price: 94e3,
    hull: 760,
    armor: 510,
    shield: 340,
    speed: 8.2,
    acceleration: 11.5,
    braking: 0.62,
    drift: 0.64,
    boost: 1.24,
    cargo: 30,
    hiddenCargo: 0,
    energy: 310,
    turn: 3.1,
    mass: 390,
    slots: 7,
    mounts: 7,
    signature: 1.9,
    weapon: "rail",
    defaultWeapons: ["rail", "rail", "autocannon", "beam", "torpedo", "flak", "ion"],
    defaultModules: ["reactiveArmor", "pointDefense", "repairDrones"],
    faction: "vanta",
    requiredReputation: 45,
    blurb: "A line-breaking warship whose mass, armor, and broadside define the fight.",
  },
  {
    id: "leviathan",
    name: "Leviathan",
    className: "Frigate carrier",
    price: 168e3,
    hull: 1180,
    armor: 720,
    shield: 620,
    speed: 6.6,
    acceleration: 8,
    braking: 0.54,
    drift: 0.7,
    boost: 1.18,
    cargo: 80,
    hiddenCargo: 0,
    energy: 430,
    turn: 2.3,
    mass: 680,
    slots: 9,
    mounts: 8,
    signature: 2.4,
    weapon: "beam",
    defaultWeapons: ["beam", "rail", "plasma", "autocannon", "torpedo", "flak", "ion", "rocket"],
    defaultModules: ["droneBay", "droneBay", "pointDefense", "repairDrones", "shieldBooster"],
    faction: "concord",
    requiredReputation: 60,
    blurb: "A late-career command platform for pilots ready to become a regional power.",
  },
];
const WEAPONS = {
  pulse: {
    id: "pulse",
    name: "Pulse Repeater",
    category: "Machine gun",
    damage: 10,
    shieldMultiplier: 1,
    armorMultiplier: 0.85,
    penetration: 0.08,
    fireRate: 0.15,
    speed: 45,
    range: 34,
    heat: 4,
    energy: 1,
    spread: 0.018,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#68e9ff",
    price: 650,
    blurb: "Reliable paired bolts with excellent handling.",
  },
  autocannon: {
    id: "autocannon",
    name: "Manticore Autocannon",
    category: "Cannon",
    damage: 17,
    shieldMultiplier: 0.72,
    armorMultiplier: 1.28,
    penetration: 0.22,
    fireRate: 0.24,
    speed: 42,
    range: 37,
    heat: 6,
    energy: 1,
    spread: 0.03,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#ffd477",
    price: 1850,
    blurb: "Kinetic shells chew armor and reward sustained tracking.",
  },
  scatter: {
    id: "scatter",
    name: "Nova Scattergun",
    category: "Shot cannon",
    damage: 7,
    shieldMultiplier: 0.9,
    armorMultiplier: 0.92,
    penetration: 0.05,
    fireRate: 0.62,
    speed: 38,
    range: 19,
    heat: 13,
    energy: 2,
    spread: 0.14,
    bolts: 6,
    splash: 0,
    tracking: 0,
    color: "#ffd36c",
    price: 2200,
    blurb: "A bright wall of shrapnel for convoy intimidation.",
  },
  rail: {
    id: "rail",
    name: "Kestrel Railcannon",
    category: "Railgun",
    damage: 54,
    shieldMultiplier: 0.68,
    armorMultiplier: 1.55,
    penetration: 0.62,
    fireRate: 1.05,
    speed: 74,
    range: 54,
    heat: 22,
    energy: 8,
    spread: 0.004,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#ff6d8d",
    price: 7200,
    blurb: "Slow cycling, accurate, and devastating through armor.",
  },
  laser: {
    id: "laser",
    name: "Sunline Laser",
    category: "Laser",
    damage: 8,
    shieldMultiplier: 1.35,
    armorMultiplier: 0.62,
    penetration: 0.02,
    fireRate: 0.11,
    speed: 82,
    range: 40,
    heat: 5,
    energy: 3,
    spread: 0.006,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#fff27b",
    price: 1450,
    blurb: "Fast light pulses strip shields with almost no lead time.",
  },
  beam: {
    id: "beam",
    name: "Choir Prism Beam",
    category: "Beam",
    damage: 25,
    shieldMultiplier: 1.25,
    armorMultiplier: 0.8,
    penetration: 0.12,
    fireRate: 0.42,
    speed: 110,
    range: 48,
    heat: 12,
    energy: 10,
    spread: 0,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#9dffca",
    price: 6800,
    blurb: "A sustained-looking lance that rewards precise long-range aim.",
  },
  plasma: {
    id: "plasma",
    name: "Choir Plasma Fork",
    category: "Plasma",
    damage: 21,
    shieldMultiplier: 1.42,
    armorMultiplier: 0.92,
    penetration: 0.18,
    fireRate: 0.32,
    speed: 34,
    range: 30,
    heat: 9,
    energy: 6,
    spread: 0.035,
    bolts: 2,
    splash: 0.35,
    tracking: 0,
    color: "#91ffbd",
    price: 4200,
    blurb: "Twin charged projectiles that punish shields.",
  },
  ion: {
    id: "ion",
    name: "Bluehook Ion Driver",
    category: "Electronic warfare",
    damage: 9,
    shieldMultiplier: 1.7,
    armorMultiplier: 0.35,
    penetration: 0,
    fireRate: 0.28,
    speed: 39,
    range: 32,
    heat: 7,
    energy: 7,
    spread: 0.018,
    bolts: 1,
    splash: 0,
    tracking: 0.12,
    color: "#69b9ff",
    price: 3900,
    blurb: "Disabling arcs drain shields and make surrender more likely.",
  },
  rocket: {
    id: "rocket",
    name: "Jackal Rocket Rack",
    category: "Rocket",
    damage: 34,
    shieldMultiplier: 0.9,
    armorMultiplier: 1.15,
    penetration: 0.24,
    fireRate: 0.76,
    speed: 27,
    range: 35,
    heat: 8,
    energy: 3,
    spread: 0.035,
    bolts: 1,
    splash: 2.2,
    tracking: 0.42,
    color: "#ffb45f",
    price: 3600,
    blurb: "Quick-lock rockets deliver readable splash damage.",
  },
  torpedo: {
    id: "torpedo",
    name: "Oathbreaker Torpedo",
    category: "Torpedo",
    damage: 96,
    shieldMultiplier: 0.85,
    armorMultiplier: 1.42,
    penetration: 0.46,
    fireRate: 2.4,
    speed: 19,
    range: 45,
    heat: 15,
    energy: 14,
    spread: 0,
    bolts: 1,
    splash: 4.4,
    tracking: 0.28,
    color: "#ff7b68",
    price: 9800,
    blurb: "A slow capital-killer that demands commitment and space.",
  },
  flak: {
    id: "flak",
    name: "Firefly Flak Array",
    category: "Point defense",
    damage: 6,
    shieldMultiplier: 0.8,
    armorMultiplier: 0.72,
    penetration: 0,
    fireRate: 0.12,
    speed: 58,
    range: 18,
    heat: 3,
    energy: 2,
    spread: 0.08,
    bolts: 3,
    splash: 0.4,
    tracking: 0.7,
    color: "#f4f7ff",
    price: 2700,
    blurb: "Short-range fragments suppress missiles, drones, and light craft.",
  },
  miningLaser: {
    id: "miningLaser",
    name: "Deepcut Mining Beam",
    category: "Industrial laser",
    damage: 12,
    shieldMultiplier: 0.55,
    armorMultiplier: 0.8,
    penetration: 0.1,
    fireRate: 0.2,
    speed: 72,
    range: 22,
    heat: 5,
    energy: 4,
    spread: 0,
    bolts: 1,
    splash: 0,
    tracking: 0,
    color: "#ff9e68",
    price: 2400,
    blurb: "Extracts more material from deposits and remains adequate in a fight.",
  },
};
const MODULES = {
  shieldBooster: {
    id: "shieldBooster",
    name: "Flux Shield Booster",
    category: "defense",
    price: 4800,
    mass: 8,
    power: 18,
    description: "Raises shield capacity and emergency recovery.",
    effect: "+25% shield \xB7 faster recharge",
  },
  reactiveArmor: {
    id: "reactiveArmor",
    name: "Reactive Armor Web",
    category: "defense",
    price: 4200,
    mass: 20,
    power: 2,
    description: "Layered plates blunt kinetic and explosive hits.",
    effect: "+35% armor \xB7 more mass",
  },
  overdrive: {
    id: "overdrive",
    name: "Vector Overdrive",
    category: "engine",
    price: 3900,
    mass: 6,
    power: 20,
    description: "Aggressive thrust mapping for chase and escape.",
    effect: "+14% speed \xB7 +18% boost drain",
  },
  cargoPods: {
    id: "cargoPods",
    name: "Foldspace Cargo Pods",
    category: "cargo",
    price: 2800,
    mass: 12,
    power: 5,
    description: "External compacted racks expand carrying capacity.",
    effect: "+14 cargo \xB7 -4% speed",
  },
  hiddenHold: {
    id: "hiddenHold",
    name: "Ghosted Cargo Hold",
    category: "cargo",
    price: 5200,
    mass: 7,
    power: 8,
    description: "Shielded compartments reduce contraband detection.",
    effect: "+8 concealed cargo \xB7 -45% scan detection",
  },
  pointDefense: {
    id: "pointDefense",
    name: "Firefly Point Defense",
    category: "defense",
    price: 6100,
    mass: 9,
    power: 16,
    description: "Automated flak intercepts incoming ordnance.",
    effect: "45% missile intercept chance",
  },
  repairDrones: {
    id: "repairDrones",
    name: "Patchwork Repair Drones",
    category: "drone",
    price: 6700,
    mass: 11,
    power: 14,
    description: "Drones restore armor and hull outside immediate fire.",
    effect: "Passive armor/hull recovery",
  },
  ecmSuite: {
    id: "ecmSuite",
    name: "Veil ECM Suite",
    category: "utility",
    price: 5900,
    mass: 5,
    power: 22,
    description: "Spoofs scans and degrades homing weapons.",
    effect: "-35% scan and missile lock",
  },
  miningRig: {
    id: "miningRig",
    name: "Industrial Fracture Rig",
    category: "industry",
    price: 4400,
    mass: 16,
    power: 18,
    description: "Focused cutters expose additional ore pockets.",
    effect: "+75% mining yield",
  },
  salvageArray: {
    id: "salvageArray",
    name: "Tractor Salvage Array",
    category: "industry",
    price: 4700,
    mass: 13,
    power: 16,
    description: "Recovers intact components from disabled ships and wrecks.",
    effect: "+60% salvage value \xB7 boarding options",
  },
  surveyScanner: {
    id: "surveyScanner",
    name: "Choir Survey Scanner",
    category: "utility",
    price: 5600,
    mass: 4,
    power: 19,
    description: "Resolves anomalies, deposits, and hidden navigation signals.",
    effect: "+scan range \xB7 rare discovery chance",
  },
  droneBay: {
    id: "droneBay",
    name: "Companion Drone Bay",
    category: "drone",
    price: 7600,
    mass: 18,
    power: 24,
    description: "Deploys autonomous combat and support drones.",
    effect: "+12% damage \xB7 escort support",
  },
};
const CREW = [
  {
    id: "mara",
    name: "Mara Venn",
    role: "Gunner",
    cost: 1400,
    salary: 90,
    bonus: "+12% weapon damage",
    trait: "Laughs when missiles lock on.",
    companion: !0,
  },
  {
    id: "io",
    name: "Io-7",
    role: "Engineer",
    cost: 1700,
    salary: 110,
    bonus: "+18% shield recovery",
    trait: "Claims to remember the old gates.",
    companion: !0,
  },
  {
    id: "sable",
    name: "Sable Quist",
    role: "Broker",
    cost: 1200,
    salary: 80,
    bonus: "+8% market margins",
    trait: "Owes favors in three jurisdictions.",
    companion: !1,
  },
  {
    id: "brin",
    name: "Brin Calder",
    role: "Navigator",
    cost: 1500,
    salary: 95,
    bonus: "+20% boost efficiency",
    trait: "Treats minefields as shortcuts.",
    companion: !0,
  },
  {
    id: "tamsin",
    name: "Tamsin Rook",
    role: "Boarding chief",
    cost: 2300,
    salary: 140,
    bonus: "+35% boarding success",
    trait: "Keeps a list of ships worth stealing.",
    companion: !0,
  },
  {
    id: "mina",
    name: "Mina Sol",
    role: "Surveyor",
    cost: 2100,
    salary: 125,
    bonus: "+40% anomaly rewards",
    trait: "Hears patterns inside broken signals.",
    companion: !0,
  },
  {
    id: "juno",
    name: "Juno Pike",
    role: "Quartermaster",
    cost: 1900,
    salary: 115,
    bonus: "+20% mining and salvage yield",
    trait: "Can price a wreck before it stops burning.",
    companion: !1,
  },
  {
    id: "vale",
    name: "Marshal Vale",
    role: "Security liaison",
    cost: 2800,
    salary: 160,
    bonus: "Slower lawful heat gain",
    trait: "Still carries a Directorate badge\u2014with conditions.",
    companion: !0,
  },
];
const CONTACTS = [
  {
    id: "rhea",
    name: "Rhea Voss",
    role: "Independent fixer",
    faction: "independent",
    system: "meridian",
    unlock: "Signal in the Static and flexible recovery work",
    greeting: "The route is optional. The consequence isn't.",
  },
  {
    id: "imani",
    name: "Marshal Imani Vale",
    role: "Concord marshal",
    faction: "concord",
    system: "meridian",
    unlock: "Lawful bounties, record settlement, restricted security gear",
    greeting: "Help keep the lane open and I can make doors open with it.",
  },
  {
    id: "cass",
    name: "Cass Meridian",
    role: "Aurora factor",
    faction: "aurora",
    system: "zenith",
    unlock: "Convoy intelligence, commercial licenses, market manipulation",
    greeting: "Shortages are simply urgency with a price attached.",
  },
  {
    id: "kade",
    name: "Razor Kade",
    role: "Freewake captain",
    faction: "freewake",
    system: "gloam",
    unlock: "Piracy, boarding, forged identities, black-market hulls",
    greeting: "If it broadcasts ownership, it can broadcast surrender.",
  },
  {
    id: "sola",
    name: "Dr. Sola Quill",
    role: "Choir signal scholar",
    faction: "choir",
    system: "veil",
    unlock: "Anomaly chain, survey technology, relic decisions",
    greeting: "The static is not empty. It is waiting for a better question.",
  },
  {
    id: "ferro",
    name: "Brakk Ferro",
    role: "Claim boss",
    faction: "independent",
    system: "cinder",
    unlock: "Mining leases, salvage rights, industrial property",
    greeting: "Rock pays clean. People make it complicated.",
  },
  {
    id: "vesk",
    name: "Commander Vesk",
    role: "Vanta defector",
    faction: "vanta",
    system: "rift",
    unlock: "War contracts, capital equipment, Hegemony secrets",
    greeting: "Wars are lost in logistics before they are lost in fire.",
  },
  {
    id: "latch",
    name: "Latch Niko",
    role: "Transponder artist",
    faction: "freewake",
    system: "morrow",
    unlock: "Hidden holds, bribes, record hacks, smuggler routes",
    greeting: "Your ship can be anyone for the right fee.",
  },
];
const PROPERTIES = [
  {
    id: "warehouse",
    name: "Bonded Warehouse",
    price: 9e3,
    income: 80,
    capacity: 80,
    service: "storage",
    blurb: "Stores cargo remotely and earns handling fees from legitimate traffic.",
  },
  {
    id: "mine",
    name: "Autonomous Claim",
    price: 16500,
    income: 150,
    capacity: 20,
    service: "production",
    blurb: "Produces ore and scrap, affecting the local industrial market.",
  },
  {
    id: "relay",
    name: "Whisper Relay",
    price: 24e3,
    income: 170,
    capacity: 0,
    service: "intel",
    blurb: "Reveals current prices, bounties, blockades, and hidden route signals.",
  },
  {
    id: "hideout",
    name: "Smuggler Hideout",
    price: 31e3,
    income: 120,
    capacity: 40,
    service: "crime",
    blurb: "Accelerates heat decay, stores stolen goods, and enables identity changes.",
  },
  {
    id: "dock",
    name: "Freeport Berth",
    price: 42e3,
    income: 260,
    capacity: 60,
    service: "repair",
    blurb: "A personal base with discounted repair, ship storage, and discreet business.",
  },
  {
    id: "tradeOffice",
    name: "Regional Trade Office",
    price: 56e3,
    income: 340,
    capacity: 30,
    service: "trade",
    blurb: "Creates a real automated route that moves stock between known markets.",
  },
];
function clamp(r, e, t) {
  return Math.max(e, Math.min(t, r));
}
function hashUnit(r) {
  let e = 2166136261;
  for (let t = 0; t < r.length; t += 1) ((e ^= r.charCodeAt(t)), (e = Math.imul(e, 16777619)));
  return ((e ^= e >>> 16), (e = Math.imul(e, 2246822507)), (e ^= e >>> 13), (e >>> 0) / 4294967295);
}
function marketPrice(r, e, t, i) {
  let s = commodityById(e),
    n = clamp((t.target - t.stock) / Math.max(1, t.target), -0.72, 1.5),
    a = i.piracy * 0.18 + i.war * s.warDemand * 0.16 + i.blockade * 0.34;
  return Math.round(clamp(s.base * Math.exp(0.48 * n + 0.42 * t.shock + a), s.base * 0.45, s.base * 3.5));
}
function createWorld() {
  let r = Object.fromEntries(
      SYSTEMS.map((s) => {
        let n = {
          [s.owner]: 72,
        };
        for (let o of s.links) {
          let l = systemById(o).owner;
          l !== s.owner && (n[l] = Math.max(n[l] ?? 0, 8));
        }
        let a = Object.values(n).reduce((o, l) => o + (l ?? 0), 0);
        return (
          (n.independent = (n.independent ?? 0) + Math.max(0, 100 - a)),
          [
            s.id,
            {
              owner: s.owner,
              security: s.security / 5,
              piracy: s.piracy,
              war: s.war,
              hazard: s.hazard,
              prosperity: clamp(0.38 + s.population * 0.1 - s.war * 0.15, 0.1, 0.95),
              blockade: s.war > 0.75 ? 0.28 : 0,
              influence: n,
            },
          ]
        );
      }),
    ),
    e = Object.fromEntries(
      SYSTEMS.map((s) => [
        s.id,
        Object.fromEntries(
          COMMODITIES.map((n) => {
            let a = s.supply[n.id] ?? 0.84,
              o = Math.round(38 + s.population * 8 + a * 12),
              l = o * 0.52,
              c = Math.round(clamp(l * (0.58 + a * 0.72), 2, o)),
              u = Math.max(0.12, (a - 0.42) * 3.2),
              h = Math.max(0.18, 1.55 - a * 0.65 + s.population * 0.08 + s.war * n.warDemand * 0.55);
            return [
              n.id,
              {
                stock: c,
                capacity: o,
                target: l,
                production: u,
                consumption: h,
                shock: 0,
                lastPrice: n.base,
                history: [n.base],
                incoming: 0,
              },
            ];
          }),
        ),
      ]),
    ),
    t = Object.fromEntries(
      Object.keys(FACTIONS).map((s, n) => [
        s,
        {
          treasury: 52e3 + n * 8500,
          military: s === "vanta" ? 82 : s === "concord" ? 76 : s === "freewake" ? 58 : 48 + n * 3,
          technology: s === "choir" ? 88 : s === "concord" ? 72 : 50 + n * 2,
          exhaustion: 0,
          objective:
            s === "concord"
              ? "Secure civilian lanes"
              : s === "aurora"
                ? "Expand commercial influence"
                : s === "vanta"
                  ? "Break the Rift front"
                  : s === "freewake"
                    ? "Disrupt lawful logistics"
                    : s === "choir"
                      ? "Decode the Null signal"
                      : "Protect independent settlements",
        },
      ]),
    );
  return {
    tick: 0,
    gameHour: 0,
    markets: e,
    systems: r,
    factions: t,
    events: [
      {
        id: "signal-static",
        type: "anomaly",
        title: "Signal in the Static",
        description: "A navigation fragment is repeating beyond normal beacon space.",
        system: "meridian",
        createdTick: 0,
        expiresTick: 9999,
        severity: 2,
        faction: "choir",
      },
    ],
    targets: [
      {
        id: "varro",
        name: "Brass Comet Varo",
        faction: "freewake",
        system: "cinder",
        threat: 2,
        bounty: 1300,
        behavior: "Aggressive interceptor; flees through industrial traffic",
        status: "active",
        escort: 1,
        lastSeenTick: 0,
      },
      {
        id: "saint9",
        name: "Saint-9",
        faction: "freewake",
        system: "echo",
        threat: 3,
        bounty: 2600,
        behavior: "Cloaked courier and information broker",
        status: "hidden",
        escort: 0,
        lastSeenTick: 0,
      },
      {
        id: "auntieHex",
        name: "Auntie Hex",
        faction: "freewake",
        system: "gloam",
        threat: 4,
        bounty: 4200,
        behavior: "Drone-and-mine pirate with two escorts",
        status: "active",
        escort: 2,
        lastSeenTick: 0,
      },
      {
        id: "majorSol",
        name: "Major Sol",
        faction: "vanta",
        system: "rift",
        threat: 5,
        bounty: 6900,
        behavior: "Hegemony deserter in a railgun corvette",
        status: "active",
        escort: 3,
        lastSeenTick: 0,
      },
    ],
    contacts: Object.fromEntries(
      CONTACTS.map((s) => [
        s.id,
        {
          met: s.id === "rhea",
          trust: s.id === "rhea" ? 8 : 0,
          arc: 0,
          lastTalkTick: -1,
        },
      ]),
    ),
    intel: {},
    news: [
      {
        id: "news-start",
        tick: 0,
        tone: "info",
        system: "meridian",
        headline: "Frontier cycle opens",
        detail: "Convoys are moving, patrols are scanning, and every faction is short of something.",
      },
    ],
    discoveries: [],
    depletedDeposits: [],
    story: {
      chapter: 0,
      shards: [],
      choice: "undecided",
      signalDecoded: !1,
      wardenDefeated: !1,
      finaleDone: !1,
    },
  };
}
function pushNews(r, e) {
  (r.news.unshift({
    id: `news-${r.tick}-${r.news.length}-${e.system}`,
    tick: r.tick,
    ...e,
  }),
    (r.news = r.news.slice(0, 32)));
}
function simulateConvoys(r, e) {
  for (let t of SYSTEMS) {
    if (t.links.length === 0) continue;
    let i = COMMODITIES[Math.floor(hashUnit(`${r.tick}:${t.id}:cargo`) * COMMODITIES.length)],
      s = r.markets[t.id][i.id];
    if (s.stock < s.target * 1.12) continue;
    let a = t.links
      .map((u) => ({
        id: u,
        cell: r.markets[u][i.id],
      }))
      .filter(({ cell: u }) => u.stock < u.target * 0.86)
      .sort((u, h) => u.cell.stock / u.cell.target - h.cell.stock / h.cell.target)[0];
    if (!a) continue;
    let o = Math.max(2, Math.min(8, Math.floor((s.stock - s.target) * 0.32))),
      l = (r.systems[t.id].piracy + r.systems[a.id].piracy) * 0.5,
      c = hashUnit(`${r.tick}:${t.id}:${a.id}:intercept`) < l * 0.26;
    ((s.stock -= o),
      c
        ? ((a.cell.shock = clamp(a.cell.shock + 0.08 + o * 0.008, -0.35, 1.25)),
          (r.systems[a.id].piracy = clamp(r.systems[a.id].piracy + 0.012, 0, 1)),
          e.length < 3 &&
            e.push({
              tone: "warn",
              headline: `${i.name} convoy lost`,
              detail: `${t.name} exports failed to reach ${systemById(a.id).name}; prices are rising.`,
              system: a.id,
            }))
        : ((a.cell.stock = clamp(a.cell.stock + o, 0, a.cell.capacity)),
          (a.cell.incoming = o),
          (r.systems[a.id].piracy = clamp(r.systems[a.id].piracy - 0.004, 0, 1))));
  }
}
function simulateFactionOperations(r, e) {
  let t = Object.keys(FACTIONS),
    i = t[r.tick % t.length],
    s = r.factions[i],
    n = SYSTEMS.filter((f) => r.systems[f.id].owner === i)
      .flatMap((f) =>
        f.links.map((m) => ({
          origin: f.id,
          target: m,
        })),
      )
      .filter(({ target: f }) => r.systems[f].owner !== i);
  if (n.length === 0) return;
  let a = n[Math.floor(hashUnit(`${r.tick}:${i}:operation`) * n.length)],
    o = r.systems[a.target],
    l = o.owner,
    c = FACTIONS[i].enemies.includes(l) || FACTIONS[l].enemies.includes(i),
    u = i === "aurora" || i === "independent",
    h = (c ? 3.2 : u ? 1.6 : 0.8) * (0.75 + hashUnit(`${r.tick}:${i}:strength`) * 0.5);
  ((o.influence[i] = clamp((o.influence[i] ?? 0) + h, 0, 100)),
    (o.influence[l] = clamp((o.influence[l] ?? 0) - h * 0.7, 0, 100)),
    (s.treasury = Math.max(0, s.treasury - 850)),
    c
      ? ((o.war = clamp(o.war + 0.035, 0, 1)),
        (o.blockade = clamp(o.blockade + 0.02, 0, 1)),
        e.push({
          tone: "danger",
          headline: `${FACTIONS[i].short} raid near ${systemById(a.target).name}`,
          detail: `${FACTIONS[l].name} traffic is diverting while military influence shifts.`,
          system: a.target,
        }))
      : u &&
        e.length < 3 &&
        e.push({
          tone: "info",
          headline: `${FACTIONS[i].short} expands commercial influence`,
          detail: `New contracts and price pressure are appearing in ${systemById(a.target).name}.`,
          system: a.target,
        }));
  let d = Object.entries(o.influence).sort((f, m) => m[1] - f[1]);
  d[0] &&
    d[0][0] !== l &&
    d[0][1] >= 60 &&
    d[0][1] - (d[1]?.[1] ?? 0) >= 15 &&
    ((o.owner = d[0][0]),
    (o.security = clamp(o.security - 0.15, 0, 1)),
    e.push({
      tone: "danger",
      headline: `${systemById(a.target).name} changes hands`,
      detail: `${FACTIONS[d[0][0]].name} now controls the system after a sustained influence campaign.`,
      system: a.target,
    }));
}
function moveNamedTargets(r) {
  for (let e of r.targets) {
    if (e.status === "dead" || e.status === "captured" || r.tick % Math.max(2, 6 - e.threat) !== 0) continue;
    let t = systemById(e.system);
    t.links.length !== 0 &&
      ((e.system = t.links[Math.floor(hashUnit(`${r.tick}:${e.id}:route`) * t.links.length)]),
      (e.status = hashUnit(`${r.tick}:${e.id}:hidden`) < 0.2 ? "hidden" : "active"),
      e.status === "active" && (e.lastSeenTick = r.tick));
  }
}
function spawnWorldEvent(r, e) {
  if (r.events.filter((h) => !h.resolved && h.expiresTick > r.tick).length >= 7) return;
  let i = hashUnit(`${r.tick}:world-event`),
    s = SYSTEMS[Math.floor(hashUnit(`${r.tick}:world-system`) * SYSTEMS.length)],
    n = COMMODITIES[Math.floor(hashUnit(`${r.tick}:world-commodity`) * COMMODITIES.length)],
    a =
      i < 0.12
        ? "distress"
        : i < 0.22
          ? "pirateRaid"
          : i < 0.31
            ? "policeChase"
            : i < 0.4
              ? "cargoSpill"
              : i < 0.5
                ? "blockade"
                : i < 0.6
                  ? "battle"
                  : i < 0.69
                    ? "rareMerchant"
                    : i < 0.78
                      ? "resourceStrike"
                      : i < 0.87
                        ? "derelict"
                        : i < 0.94
                          ? "smugglerMeet"
                          : "shortage",
    o = {
      distress: ["Distress call", "A civilian ship is broadcasting engine failure and an unstable contact list."],
      pirateRaid: ["Pirate raid forming", "Freewake raiders are converging on a commercial route."],
      policeChase: ["Police pursuit", "Security is chasing a wanted courier through local traffic."],
      cargoSpill: ["Cargo spill", `Loose ${n.name} containers are tumbling off the marked lane.`],
      blockade: ["Blockade warning", "Military inspections are delaying imports and driving shortages."],
      battle: ["Fleet engagement", "Opposing formations are maneuvering around a strategic beacon."],
      rareMerchant: ["Rare merchant", "A traveling dealer is broadcasting limited prototype stock."],
      resourceStrike: ["Resource strike", "Surveyors located a temporary high-yield asteroid pocket."],
      derelict: ["Unclaimed derelict", "A silent hull is drifting with salvageable systems intact."],
      smugglerMeet: ["Smuggler rendezvous", "A burst-coded market is open for one navigation cycle."],
      shortage: ["Regional shortage", `${n.name} demand is outrunning local supply.`],
      anomaly: ["Anomaly", "A signal outside mapped physics is repeating nearby."],
    },
    [l, c] = o[a],
    u = {
      id: `event-${r.tick}-${s.id}`,
      type: a,
      title: l,
      description: c,
      system: s.id,
      commodity: ["cargoSpill", "shortage"].includes(a) ? n.id : void 0,
      faction: s.owner,
      createdTick: r.tick,
      expiresTick: r.tick + 4 + Math.floor(i * 5),
      severity: 1 + Math.floor(i * 4),
    };
  (r.events.push(u),
    (a === "shortage" || a === "blockade") &&
      ((r.markets[s.id][n.id].shock = clamp(r.markets[s.id][n.id].shock + 0.22, -0.35, 1.25)),
      a === "blockade" && (r.systems[s.id].blockade = clamp(r.systems[s.id].blockade + 0.18, 0, 1))),
    e.length < 3 &&
      e.push({
        tone:
          a === "battle" || a === "pirateRaid" || a === "blockade"
            ? "danger"
            : a === "rareMerchant" || a === "resourceStrike"
              ? "good"
              : "info",
        headline: `${l}: ${s.name}`,
        detail: c,
        system: s.id,
      }));
}
function advanceWorld(r, e = 1) {
  let t = [];
  for (let i = 0; i < e; i += 1) {
    ((r.tick += 1), (r.gameHour += 0.25));
    for (let s of SYSTEMS) {
      let n = r.systems[s.id];
      ((n.blockade = clamp(n.blockade * 0.9, 0, 1)),
        (n.war = clamp(n.war * 0.995, 0, 1)),
        (n.piracy = clamp(n.piracy * 0.998 + (1 - n.security) * 8e-4, 0, 1)));
      for (let a of COMMODITIES) {
        let o = r.markets[s.id][a.id],
          l = o.consumption * (1 + n.war * (a.warDemand - 1) + n.blockade * 0.35),
          c = (hashUnit(`${r.tick}:${s.id}:${a.id}:market`) - 0.5) * a.volatility;
        ((o.stock = clamp(o.stock + o.production - l + c, 0, o.capacity)),
          (o.shock *= 0.82),
          (o.incoming *= 0.4),
          (o.lastPrice = marketPrice(s.id, a.id, o, n)),
          o.history.push(o.lastPrice),
          (o.history = o.history.slice(-16)));
      }
    }
    (simulateConvoys(r, t),
      r.tick % 2 === 0 && simulateFactionOperations(r, t),
      moveNamedTargets(r),
      (r.events = r.events.filter((s) => s.expiresTick > r.tick || (!s.resolved && s.id === "signal-static"))),
      spawnWorldEvent(r, t));
  }
  for (let i of t) pushNews(r, i);
  return t.slice(0, 5);
}
function systemOwner(r, e) {
  return r.systems[e]?.owner ?? systemById(e).owner;
}
function systemSecurity(r, e) {
  return r.systems[e]?.security ?? systemById(e).security / 5;
}
function systemPiracy(r, e) {
  return r.systems[e]?.piracy ?? systemById(e).piracy;
}
function systemWar(r, e) {
  return r.systems[e]?.war ?? systemById(e).war;
}
function recordIntel(r, e, t, i, s, n) {
  ((r.intel[e] ??= {}),
    (r.intel[e][t] = {
      buy: i,
      sell: s,
      stock: n,
      tick: r.tick,
    }));
}
function addNews(r, e) {
  pushNews(r, e);
}
function defaultWeaponLoadouts() {
  return Object.fromEntries(SHIPS.map((r) => [r.id, [...r.defaultWeapons]]));
}
function defaultModuleLoadouts() {
  return Object.fromEntries(SHIPS.map((r) => [r.id, [...r.defaultModules]]));
}
function createCareer(r = DEFAULT_SETTINGS) {
  let e = shipById("kite"),
    t = createWorld();
  return {
    version: 4,
    started: !1,
    currentSystem: "meridian",
    credits: 2400,
    renown: 0,
    shipId: "kite",
    ownedShips: ["kite"],
    hull: e.hull,
    armor: e.armor,
    shield: e.shield,
    energy: e.energy,
    weaponHeat: 0,
    missiles: 6,
    activeWeaponIndex: 0,
    weaponLoadouts: defaultWeaponLoadouts(),
    installedModules: defaultModuleLoadouts(),
    ownedWeapons: ["pulse", "laser"],
    ownedModules: [],
    cargo: {
      rations: 2,
    },
    contractCargo: {},
    stolenCargo: {},
    reputation: {
      ...START_REPUTATION,
    },
    jurisdictionHeat: Object.fromEntries(SYSTEMS.map((i) => [i.id, 0])),
    jurisdictionBounty: Object.fromEntries(SYSTEMS.map((i) => [i.id, 0])),
    crimes: [],
    forgedIdCharges: 0,
    knownSystems: ["meridian", "cinder", "halcyon", "morrow", "argent"],
    visitedSystems: ["meridian"],
    marketTick: 1,
    acceptedMissions: [],
    crew: [],
    crewLoyalty: {},
    properties: [],
    propertyOperations: [],
    fleetAssignments: {},
    fleetOrders: {},
    marketShock: Object.fromEntries(SYSTEMS.map((i) => [i.id, {}])),
    upgrades: {
      weapon: 0,
      shield: 0,
      engine: 0,
      cargo: 0,
    },
    skills: {
      piloting: 0,
      gunnery: 0,
      engineering: 0,
      trading: 0,
      smuggling: 0,
      mining: 0,
      exploration: 0,
      leadership: 0,
    },
    kills: 0,
    mined: 0,
    salvaged: 0,
    boarded: 0,
    contractsCompleted: 0,
    bountiesCollected: 0,
    playSeconds: 0,
    tutorialStep: 0,
    lastPayrollTick: 0,
    world: t,
    settings: {
      ...DEFAULT_SETTINGS,
      ...r,
    },
  };
}
function bound(r, e, t) {
  return Math.max(e, Math.min(t, r));
}
function cargoUnits(r, e) {
  return (r.cargo[e] ?? 0) + (r.contractCargo[e] ?? 0);
}
function cargoMass(r) {
  return COMMODITIES.reduce((e, t) => e + cargoUnits(r, t.id) * t.mass, 0);
}
function cargoCapacity(r) {
  return computeShipStats(r).cargo;
}
function hiddenCapacity(r) {
  let e = shipById(r.shipId),
    t = r.installedModules[r.shipId] ?? [];
  return e.hiddenCargo + t.filter((i) => i === "hiddenHold").length * 8;
}
function computeShipStats(r) {
  let e = shipById(r.shipId),
    t = r.installedModules[r.shipId] ?? [],
    i = (l) => t.filter((c) => c === l).length,
    s = e.mass + t.reduce((l, c) => l + moduleById(c).mass, 0),
    n = e.cargo + r.upgrades.cargo * 5 + i("cargoPods") * 14,
    a = Math.max(0.72, 1 - Math.max(0, s - e.mass) / Math.max(80, e.mass * 5)),
    o = Math.pow(1.14, i("overdrive")),
    story = r.world?.story?.choice;
  return {
    ...e,
    hull: e.hull,
    armor: e.armor * (1 + i("reactiveArmor") * 0.35),
    shield: e.shield * (1 + r.upgrades.shield * 0.12 + i("shieldBooster") * 0.25) * (story === "self" ? 1.15 : 1),
    energy: e.energy * (story === "self" ? 1.2 : 1),
    speed: e.speed * (1 + r.upgrades.engine * 0.07) * o * Math.pow(0.96, i("cargoPods")) * a,
    acceleration: e.acceleration * (1 + r.upgrades.engine * 0.08) * (1 + i("overdrive") * 0.1) * a,
    cargo: n,
    mass: s,
    boost: e.boost * (1 + i("overdrive") * 0.08),
    scanSignature: e.signature * Math.pow(0.65, i("ecmSuite")) * Math.pow(0.55, i("hiddenHold")),
    powerUsed: t.reduce((l, c) => l + moduleById(c).power, 0),
    powerCapacity: Math.round(e.energy * 0.58),
    pointDefense: i("pointDefense") > 0,
    repairDrones: i("repairDrones") > 0,
    miningMultiplier: (1 + i("miningRig") * 0.75) * (r.crew.includes("juno") ? 1.2 : 1),
    salvageMultiplier: (1 + i("salvageArray") * 0.6) * (r.crew.includes("juno") ? 1.2 : 1),
    surveyMultiplier:
      (1 + i("surveyScanner") * 0.55) * (r.crew.includes("mina") ? 1.4 : 1) * (story === "choir" ? 1.5 : 1),
    damageMultiplier: 1 + i("droneBay") * 0.12,
  };
}
function shipStats(r) {
  return computeShipStats(r);
}
function activeWeapon(r) {
  let e = r.weaponLoadouts[r.shipId] ?? [shipById(r.shipId).weapon];
  return WEAPONS[e[r.activeWeaponIndex % Math.max(1, e.length)] ?? shipById(r.shipId).weapon];
}
function reputationLabel(r) {
  return r <= -60
    ? "Hated"
    : r <= -30
      ? "Hostile"
      : r < -10
        ? "Distrusted"
        : r < 25
          ? "Neutral"
          : r < 60
            ? "Friendly"
            : "Allied";
}
function heatLabel(r) {
  return r < 1
    ? "CLEAR"
    : r < 15
      ? "FLAGGED"
      : r < 30
        ? "WANTED"
        : r < 50
          ? "PURSUED"
          : r < 70
            ? "HUNTED"
            : r < 90
              ? "ELITE RESPONSE"
              : "MILITARY ORDER";
}
function heatTier(r) {
  return r < 5 ? 0 : r < 15 ? 1 : r < 30 ? 2 : r < 50 ? 3 : r < 70 ? 4 : r < 90 ? 5 : 6;
}
function isContraband(r, e, t) {
  let i = systemOwner(r.world, e);
  return i === "freewake" || (i === "vanta" && t === "weapons") ? !1 : commodityById(t).illegal;
}
function marketQuotes(r, e = r.currentSystem) {
  let t = systemById(e),
    i = r.world.systems[e],
    s = systemOwner(r.world, e),
    n = r.crew.includes("sable") ? 0.04 : 0,
    a = r.reputation[s] ?? 0,
    o = bound(a, -60, 80) * 7e-4,
    l = e === "zenith" ? 0.075 : s === "freewake" ? 0.21 : 0.1 + (1 - systemSecurity(r.world, e)) * 0.1;
  return COMMODITIES.map((c) => {
    let u = r.world.markets[e]?.[c.id],
      h = Math.max(1, Math.round(10 + (t.supply[c.id] ?? 0.8) * 18)),
      d = Math.max(0, Math.floor(u?.stock ?? h)),
      f = u?.target ?? 24,
      m = bound((f - d) / Math.max(1, f), -0.72, 1.5),
      p = (u?.shock ?? 0) + (r.marketShock[e]?.[c.id] ?? 0),
      g = (i?.piracy ?? t.piracy) * 0.18 + (i?.war ?? t.war) * c.warDemand * 0.16 + (i?.blockade ?? 0) * 0.34,
      S = c.base * Math.exp(0.5 * m + 0.38 * p + g),
      x = bound(S, c.base * 0.45, c.base * 3.5),
      v = isContraband(r, e, c.id),
      R = Math.max(2, Math.round(x * (v ? 1.13 : 1) * (1 + l / 2 - n - o))),
      I = Math.max(1, Math.round(x * (1 - l / 2 + n + o * 0.5))),
      C = u?.history ?? [c.base],
      P = C.length > 1 ? C[C.length - 2] : c.base,
      M = P > 0 ? Math.round(((x - P) / P) * 100) : 0;
    return {
      id: c.id,
      buy: R,
      sell: I,
      trend: M,
      illegal: v,
      owned: r.cargo[c.id] ?? 0,
      stock: d,
      production: u?.production ?? 0,
      consumption: u?.consumption ?? 0,
      history: [...C],
    };
  });
}
function bestKnownSale(r, e) {
  return (
    r.knownSystems
      .map((i) => ({
        system: systemById(i),
        record: r.world.intel[i]?.[e],
      }))
      .filter((i) => !!i.record)
      .sort((i, s) => s.record.sell - i.record.sell)[0] ?? null
  );
}
function localContact(r) {
  return CONTACTS.find((e) => e.system === r) ?? CONTACTS.find((e) => e.id === "rhea");
}
function missionObjective(r) {
  return ["delivery", "courier", "passenger", "smuggle", "escort", "blockade", "espionage"].includes(r)
    ? "visit"
    : ["bounty", "assassination", "patrol", "defense", "convoyRaid", "sabotage"].includes(r)
      ? "kill"
      : r === "mining"
        ? "mine"
        : r === "salvage"
          ? "salvage"
          : r === "boarding"
            ? "board"
            : r === "rescue"
              ? "rescue"
              : ["scan", "story"].includes(r)
                ? "scan"
                : "visit";
}
function pickMissionType(r, e) {
  let t = r.world.systems[r.currentSystem],
    i = marketQuotes(r).some((n) => n.stock < 6),
    s = [
      "delivery",
      "courier",
      "passenger",
      "bounty",
      "mining",
      "smuggle",
      "patrol",
      "explore",
      "scan",
      "salvage",
      "escort",
      "rescue",
    ];
  return (
    t.war > 0.35 && s.push("defense", "blockade", "sabotage", "convoyRaid", "assassination"),
    t.piracy > 0.32 && s.push("boarding", "bounty", "escort", "convoyRaid"),
    i && s.push("delivery", "blockade", "smuggle"),
    r.world.story.chapter < 5 && e === 0
      ? "story"
      : s[Math.floor(hashUnit(`${r.currentSystem}:${r.world.tick}:${e}:mission-type`) * s.length)]
  );
}
function storyMission(r) {
  let e = r.world.story.chapter,
    t = ["meridian", "veil", "cinder", "gloam", "null"],
    i = t[Math.min(e, t.length - 1)],
    s = [
      "Signal in the Static",
      "The Veil Echo",
      "Shard in the Furnace",
      "A Pirate's Frequency",
      "The Impossible Route",
    ],
    n = [
      "Scan the impossible navigation fragment near Meridian. Rhea insists the signal arrived before it was sent.",
      "Sola Quill believes an echo shard is concealed inside Veil's interference.",
      "A second shard is embedded in industrial debris in Cinder. Survey it before Aurora claims the data.",
      "The final shard is circulating through Gloam's pirate beacons. Recover its transmission without asking permission.",
      "The assembled route points toward Null. Scan the Quiet Star and decide who should control what answers.",
    ];
  return {
    id: `story-${e}`,
    type: "story",
    title: s[e] ?? s[4],
    description: n[e] ?? n[4],
    issuer: e === 0 ? "independent" : "choir",
    contactId: e === 0 ? "rhea" : "sola",
    targetSystem: i,
    reward: 1200 + e * 900,
    amount: 1,
    progress: 0,
    objective: "scan",
    risk: e > 2 ? "HIGH" : "MED",
    illegal: e === 3,
    deadlineTick: r.world.tick + 999,
    consequences: "Advances the optional Signal in the Static storyline.",
    story: !0,
  };
}
function missionBoard(r) {
  let e = systemById(r.currentSystem),
    t = e.links.map((s) => systemById(s)),
    i = localContact(r.currentSystem);
  return Array.from(
    {
      length: 10,
    },
    (s, n) => {
      let a = pickMissionType(r, n);
      if (a === "story") return storyMission(r);
      let o = `${r.currentSystem}:${r.world.tick}:${n}`,
        l = t[Math.floor(hashUnit(`${o}:target`) * Math.max(1, t.length))] ?? e,
        c = ["delivery", "smuggle", "blockade"].includes(a)
          ? 2 + Math.floor(hashUnit(`${o}:amount`) * 6)
          : ["patrol", "defense", "convoyRaid"].includes(a)
            ? 2 + Math.floor(hashUnit(`${o}:amount`) * 4)
            : 1,
        u = bound((systemWar(r.world, l.id) + systemPiracy(r.world, l.id) + hashUnit(`${o}:risk`)) / 2.4, 0, 1),
        h = u > 0.82 ? "EXTREME" : u > 0.62 ? "HIGH" : u > 0.3 ? "MED" : "LOW",
        d = ["smuggle", "assassination", "convoyRaid", "sabotage", "espionage", "boarding"].includes(a),
        f = marketQuotes(r, l.id).sort((C, P) => C.stock - P.stock)[0],
        m = ["delivery", "blockade"].includes(a)
          ? f.id
          : a === "smuggle"
            ? ["weapons", "artifacts", "spice"][n % 3]
            : void 0,
        p = ["bounty", "assassination"].includes(a)
          ? r.world.targets.find((C) => C.status === "active" && C.system === l.id)
          : void 0,
        g = a === "convoyRaid" ? "trader" : a === "boarding" ? "courier" : a === "bounty" ? "pirate" : void 0,
        S = a === "patrol" || a === "bounty" ? "freewake" : a === "convoyRaid" ? systemOwner(r.world, l.id) : void 0,
        x = h === "EXTREME" ? 1500 : h === "HIGH" ? 850 : h === "MED" ? 360 : 0,
        v = Math.round((420 + c * 170 + x + (d ? 820 : 0) + (p?.bounty ?? 0) * 0.35) / 10) * 10,
        E = missionObjective(a),
        R =
          E === "kill"
            ? `Neutralize ${c} valid target${c === 1 ? "" : "s"}`
            : E === "mine"
              ? `Extract ${c} registered ore cache${c === 1 ? "" : "s"}`
              : E === "salvage"
                ? `Recover ${c} salvage package${c === 1 ? "" : "s"}`
                : E === "board"
                  ? "Disable and board the assigned vessel"
                  : E === "scan"
                    ? "Complete a close-range anomaly scan"
                    : E === "rescue"
                      ? "Recover the distressed crew"
                      : `Reach ${l.name}${m ? ` with ${c} ${commodityById(m).name}` : ""}`,
        I = MISSION_TITLES[a];
      return {
        id: `job-${r.currentSystem}-${r.world.tick}-${n}`,
        type: a,
        title: p?.name ? `Hunt ${p.name}` : I[n % I.length],
        description: `${R}. ${d ? "The issuer will deny authorizing this operation." : "Only relevant actions in the marked system count."}`,
        issuer: d && n % 2 === 0 ? "freewake" : systemOwner(r.world, r.currentSystem),
        contactId: i.id,
        targetSystem: l.id,
        reward: v,
        amount: c,
        progress: 0,
        objective: E,
        risk: h,
        illegal: d,
        commodity: m,
        targetId: p?.id,
        targetRole: g,
        targetFaction: S,
        deadlineTick: r.world.tick + 10 + Math.ceil(u * 8),
        consequences: d
          ? "Failure or witnesses may increase heat and damage lawful reputation."
          : `Success improves ${FACTIONS[systemOwner(r.world, r.currentSystem)].short} standing and regional conditions.`,
        requiredReputation: a === "assassination" || a === "sabotage" ? 10 : void 0,
      };
    },
  );
}
function migrateSave(r, e) {
  if (!r || typeof r != "object") return null;
  let t = r;
  if (t.version === 4) {
    let i = t,
      s = createCareer({
        ...e,
        ...(i.settings ?? {}),
      });
    return {
      ...s,
      ...i,
      settings: {
        ...s.settings,
        ...(i.settings ?? {}),
      },
      reputation: {
        ...s.reputation,
        ...(i.reputation ?? {}),
      },
      jurisdictionHeat: {
        ...s.jurisdictionHeat,
        ...(i.jurisdictionHeat ?? {}),
      },
      jurisdictionBounty: {
        ...s.jurisdictionBounty,
        ...(i.jurisdictionBounty ?? {}),
      },
      weaponLoadouts: {
        ...s.weaponLoadouts,
        ...(i.weaponLoadouts ?? {}),
      },
      installedModules: {
        ...s.installedModules,
        ...(i.installedModules ?? {}),
      },
      world: i.world ?? s.world,
    };
  }
  if (t.version === 3) {
    let i = t,
      s = createCareer({
        ...e,
        ...(i.settings ?? {}),
      });
    return (
      (s.started = !0),
      (s.currentSystem = i.currentSystem ?? s.currentSystem),
      (s.credits = i.credits ?? s.credits),
      (s.renown = i.renown ?? 0),
      (s.shipId = i.shipId ?? s.shipId),
      (s.ownedShips = i.ownedShips ?? s.ownedShips),
      (s.hull = i.hull ?? shipById(s.shipId).hull),
      (s.armor = shipById(s.shipId).armor),
      (s.shield = i.shield ?? shipById(s.shipId).shield),
      (s.energy = i.energy ?? shipById(s.shipId).energy),
      (s.weaponHeat = i.weaponHeat ?? 0),
      (s.cargo = i.cargo ?? {}),
      (s.reputation = {
        ...s.reputation,
        ...(i.reputation ?? {}),
      }),
      (s.jurisdictionHeat = {
        ...s.jurisdictionHeat,
        ...(i.jurisdictionHeat ?? {}),
      }),
      (s.knownSystems = i.knownSystems ?? s.knownSystems),
      (s.visitedSystems = i.visitedSystems ?? s.visitedSystems),
      (s.acceptedMissions = []),
      (s.crew = i.crew ?? []),
      (s.crewLoyalty = Object.fromEntries(s.crew.map((n) => [n, 55]))),
      (s.properties = i.properties ?? []),
      (s.propertyOperations = s.properties.map((n) => ({
        id: n,
        system: s.currentSystem,
        level: 1,
        condition: 100,
        stored: {},
      }))),
      (s.fleetAssignments = i.fleetAssignments ?? {}),
      (s.marketShock = i.marketShock ?? s.marketShock),
      (s.upgrades = i.upgrades ?? s.upgrades),
      (s.kills = i.kills ?? 0),
      (s.mined = i.mined ?? 0),
      (s.salvaged = i.salvaged ?? 0),
      (s.playSeconds = i.playSeconds ?? 0),
      (s.tutorialStep = i.tutorialStep ?? 0),
      s
    );
  }
  return null;
}
function upgradeCost(r) {
  return 900 * (r + 1) * (r + 1);
}
const SAVE_KEY = "voidrunner-save-v4";
const OLD_SAVE_KEY = "voidrunner-save-v3";
const START_REPUTATION = {
  concord: 0,
  aurora: 0,
  vanta: 0,
  freewake: -5,
  choir: 0,
  independent: 8,
};
const DEFAULT_SETTINGS = {
  reducedMotion: !1,
  aimAssist: !0,
  autoFire: !1,
  autoBrake: !0,
  cameraShake: !0,
  highContrast: !1,
  uiScale: 1,
  touchControls: !1,
  graphicsQuality: "auto",
  sfxVolume: 0.7,
  difficulty: "standard",
};
/** Difficulty: incoming damage, hostile rate of fire, insurance deductible, bounty payouts. */
const DIFFICULTY = {
  relaxed: { id: "relaxed", label: "Relaxed", incoming: 0.65, enemyFire: 1.35, deductible: 0.5, bounty: 0.9 },
  standard: { id: "standard", label: "Standard", incoming: 1, enemyFire: 1, deductible: 1, bounty: 1 },
  veteran: { id: "veteran", label: "Veteran", incoming: 1.3, enemyFire: 0.85, deductible: 1.5, bounty: 1.25 },
};
function difficultyOf(r) {
  return DIFFICULTY[r?.settings?.difficulty] ?? DIFFICULTY.standard;
}
/**
 * The Signal in the Static finale: who receives the impossible route once the
 * Quiet Warden falls. Each choice pays, shifts standing and leaves a lasting perk.
 */
const STORY_CHOICES = {
  choir: {
    id: "choir",
    faction: "choir",
    title: "Give it to the Luminous Choir",
    body: "The Choir will study the Quiet Star in silence and share the charts with anyone who asks politely.",
    perk: "Choir Prism Beam gifted \xB7 survey grants +50%",
    credits: 3500,
    reputation: { choir: 30, concord: 8, freewake: -10 },
  },
  concord: {
    id: "concord",
    faction: "concord",
    title: "Secure it for the Directorate",
    body: "Concord patrols will fortify the corridor and open it to licensed civilian traffic.",
    perk: "Every warrant in Concord space dismissed",
    credits: 7000,
    reputation: { concord: 30, aurora: 10, choir: 6, freewake: -15, vanta: -10 },
  },
  freewake: {
    id: "freewake",
    faction: "freewake",
    title: "Sell it to the Freewake Cartel",
    body: "The Cartel pays best. The route becomes a smuggler's highway nobody else can watch.",
    perk: "3 forged transponder IDs \xB7 fenced cargo sells for +30%",
    credits: 9000,
    reputation: { freewake: 35, concord: -20, choir: -12 },
  },
  self: {
    id: "self",
    faction: "independent",
    title: "Keep it for yourself",
    body: "Nobody receives the coordinates. You wire the Warden's heart into your reactor and fly on.",
    perk: "Quiet Star Core: +15% shields \xB7 +20% reactor energy",
    credits: 4000,
    reputation: { concord: -6, aurora: -6, vanta: -6, freewake: -6, choir: -8 },
  },
};
const MISSION_TITLES = {
  delivery: ["Cold-chain courier", "Parts before dawn", "Supply the shortage"],
  courier: ["Data before the guns", "Sealed dispatch", "No-delay packet"],
  passenger: ["Quiet passage", "A seat off-world", "Specialist transfer"],
  bounty: ["A name on the board", "No safe harbor", "Hunt the raider"],
  assassination: ["Cut the command link", "A precise removal", "Unfriendly acquisition"],
  mining: ["Bright rocks, clean credits", "Industrial appetite", "Claim quota"],
  smuggle: ["Quiet cargo", "No questions at the gate", "A favor in sealed crates"],
  patrol: ["Keep the lane open", "Sweep and clear", "Show of force"],
  explore: ["Signal beyond the chart", "Map the impossible", "A light in the static"],
  scan: ["Resolve the echo", "Survey contract", "Find the hidden orbit"],
  salvage: ["What the battle left", "Recover lost hardware", "Wreck rights"],
  escort: ["Ride shotgun", "Convoy through trouble", "Protect the margin"],
  rescue: ["Bring them home", "Engines cold", "Distress priority"],
  defense: ["Hold the beacon", "Station under threat", "Stand the line"],
  convoyRaid: ["Break the supply line", "Take the manifest", "A profitable interruption"],
  sabotage: ["Pull one critical wire", "Quiet demolition", "Make the relay fail"],
  espionage: ["Borrow their telemetry", "Eyes inside the fleet", "Listen at the door"],
  boarding: ["Take it intact", "A ship worth stealing", "Cargo without debris"],
  blockade: ["Run the line", "Medicine through fire", "Break the cordon"],
  story: ["Signal in the Static", "Echo shard", "The impossible route"],
};
class Career {
  constructor() {
    this.toastCounter = 0;
    this.state = createCareer();
  }
  notify(e, t, i) {
    this.onToast?.({
      id: ++this.toastCounter,
      tone: e,
      title: t,
      body: i,
    });
  }
  changed() {
    this.onChange?.();
  }
  startNewGame() {
    let e = {
      ...this.state.settings,
    };
    ((this.state = createCareer(e)), (this.state.started = !0), this.recordLocalIntel(), this.save(!0), this.changed());
  }
  continueGame() {
    if (typeof window > "u") return !1;
    let e = window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem(OLD_SAVE_KEY);
    if (!e) return !1;
    try {
      let t = migrateSave(JSON.parse(e), this.state.settings);
      return t ? ((this.state = t), (this.state.started = !0), this.recordLocalIntel(), this.changed(), !0) : !1;
    } catch {
      return !1;
    }
  }
  hasSave() {
    return (
      typeof window < "u" && !!(window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem(OLD_SAVE_KEY))
    );
  }
  save(e = !1) {
    typeof window > "u" ||
      (window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)),
      e ||
        this.notify(
          "good",
          "Game saved",
          `${systemById(this.state.currentSystem).name} \xB7 ${shipById(this.state.shipId).name}`,
        ));
  }
  resetSave() {
    (typeof window < "u" && (window.localStorage.removeItem(SAVE_KEY), window.localStorage.removeItem(OLD_SAVE_KEY)),
      (this.state = createCareer(this.state.settings)),
      this.changed());
  }
  recordLocalIntel(e = this.state.currentSystem) {
    for (let t of marketQuotes(this.state, e)) recordIntel(this.state.world, e, t.id, t.buy, t.sell, t.stock);
  }
  buyCommodity(e, t = 1) {
    let i = marketQuotes(this.state).find((c) => c.id === e),
      s = cargoCapacity(this.state) - cargoMass(this.state),
      n = commodityById(e).mass,
      a = Math.floor(s / n),
      o = Math.max(0, Math.min(t, a, i.stock, Math.floor(this.state.credits / i.buy)));
    if (o <= 0) {
      this.notify(
        "warn",
        "Transaction blocked",
        s < n ? "Cargo mass limit reached." : "Not enough credits or local stock.",
      );
      return;
    }
    ((this.state.credits -= i.buy * o), (this.state.cargo[e] = (this.state.cargo[e] ?? 0) + o));
    let l = this.state.world.markets[this.state.currentSystem][e];
    ((l.stock = Math.max(0, l.stock - o)),
      (l.shock = bound(l.shock + 0.008 * o, -0.35, 1.25)),
      (this.state.skills.trading += Math.max(1, Math.round(o / 3))),
      this.recordLocalIntel(),
      this.notify(
        i.illegal ? "warn" : "good",
        `Bought ${o} ${commodityById(e).name}`,
        `${(i.buy * o).toLocaleString()} cr \xB7 ${Math.round(cargoMass(this.state))}/${cargoCapacity(this.state)} cargo mass`,
      ),
      this.changed());
  }
  sellCommodity(e, t = 1) {
    let i = marketQuotes(this.state).find((c) => c.id === e),
      s = this.state.cargo[e] ?? 0,
      n = Math.max(0, Math.min(t, s));
    if (n <= 0) return;
    let a = Math.min(this.state.stolenCargo[e] ?? 0, n);
    if (
      a > 0 &&
      systemOwner(this.state.world, this.state.currentSystem) !== "freewake" &&
      !systemById(this.state.currentSystem).stations.some((c) => c.services.includes("blackMarket"))
    ) {
      this.notify("warn", "Fence required", "Stolen cargo can only be sold through a black market or Freewake port.");
      return;
    }
    ((this.state.cargo[e] = s - n), (this.state.stolenCargo[e] = Math.max(0, (this.state.stolenCargo[e] ?? 0) - n)));
    let o = a > 0 ? (this.state.world.story.choice === "freewake" ? 1.3 : 1.16) : 1;
    this.state.credits += Math.round(i.sell * n * o);
    let l = this.state.world.markets[this.state.currentSystem][e];
    ((l.stock = Math.min(l.capacity, l.stock + n)),
      (l.shock = bound(l.shock - 0.011 * n, -0.35, 1.25)),
      (this.state.skills.trading += Math.max(1, Math.round(n / 3))),
      a > 0 && (this.state.reputation.freewake = bound(this.state.reputation.freewake + a * 0.3, -100, 100)),
      this.recordLocalIntel(),
      this.notify(
        "good",
        `Sold ${n} ${commodityById(e).name}`,
        `+${Math.round(i.sell * n * o).toLocaleString()} cr${a ? " \xB7 fenced cargo" : ""}`,
      ),
      this.recordGameEvent({
        kind: "trade",
        system: this.state.currentSystem,
        commodity: e,
        amount: n,
      }),
      this.changed());
  }
  acceptMission(e) {
    if (this.state.acceptedMissions.some((t) => t.id === e.id)) return !1;
    if (this.state.acceptedMissions.length >= 5)
      return (this.notify("warn", "Contract limit reached", "Finish or abandon an active contract first."), !1);
    if (e.requiredReputation && this.state.reputation[e.issuer] < e.requiredReputation)
      return (
        this.notify(
          "warn",
          "Contact trust too low",
          `Reach ${e.requiredReputation} reputation with ${FACTIONS[e.issuer].short}.`,
        ),
        !1
      );
    if (["delivery", "smuggle", "blockade"].includes(e.type) && e.commodity) {
      let t = cargoCapacity(this.state) - cargoMass(this.state),
        i = e.amount * commodityById(e.commodity).mass;
      if (t < i)
        return (this.notify("warn", "Not enough cargo capacity", `Free ${Math.ceil(i - t)} more cargo mass.`), !1);
      this.state.contractCargo[e.commodity] = (this.state.contractCargo[e.commodity] ?? 0) + e.amount;
    }
    return (
      this.state.acceptedMissions.push({
        ...e,
        accepted: !0,
      }),
      this.notify(
        e.illegal ? "warn" : "good",
        "Contract accepted",
        `${systemById(e.targetSystem).name} \xB7 ${e.reward.toLocaleString()} cr \xB7 expires cycle ${e.deadlineTick}`,
      ),
      this.changed(),
      !0
    );
  }
  abandonMission(e) {
    let t = this.state.acceptedMissions.find((i) => i.id === e);
    t &&
      (["delivery", "smuggle", "blockade"].includes(t.type) &&
        t.commodity &&
        (this.state.contractCargo[t.commodity] = Math.max(0, (this.state.contractCargo[t.commodity] ?? 0) - t.amount)),
      (this.state.reputation[t.issuer] = bound(this.state.reputation[t.issuer] - 3, -100, 100)),
      (this.state.acceptedMissions = this.state.acceptedMissions.filter((i) => i.id !== e)),
      this.notify("warn", "Contract abandoned", `Reputation with ${FACTIONS[t.issuer].name} decreased.`),
      this.changed());
  }
  recordGameEvent(e) {
    let t = [];
    for (let i of this.state.acceptedMissions)
      i.complete ||
        i.objective !== e.kind ||
        i.targetSystem !== e.system ||
        (e.kind === "visit" &&
          ["delivery", "smuggle", "blockade", "courier", "passenger", "escort", "espionage"].includes(i.type)) ||
        (i.targetId && i.targetId !== e.targetId) ||
        (i.targetRole && i.targetRole !== e.targetRole) ||
        (i.targetFaction && i.targetFaction !== e.targetFaction) ||
        (["bounty", "patrol", "defense", "assassination"].includes(i.type) && !e.legalTarget) ||
        (i.commodity && i.objective === "trade" && i.commodity !== e.commodity) ||
        ((i.progress = Math.min(i.amount, i.progress + Math.max(1, e.amount ?? 1))),
        i.progress >= i.amount && t.push(i.id));
    for (let i of t) this.completeMission(i);
    t.length === 0 && this.changed();
  }
  advanceMission(e, t = 1) {
    this.recordGameEvent({
      kind: e,
      system: this.state.currentSystem,
      amount: t,
      legalTarget: e !== "kill",
    });
  }
  resolveDockMissions() {
    this.recordLocalIntel();
    let e = [];
    for (let t of this.state.acceptedMissions)
      if (t.targetSystem === this.state.currentSystem)
        if (["delivery", "smuggle", "blockade"].includes(t.type) && t.commodity) {
          let i = this.state.contractCargo[t.commodity] ?? 0;
          if (i >= t.amount) {
            ((this.state.contractCargo[t.commodity] = i - t.amount), (t.progress = t.amount));
            let s = this.state.world.markets[this.state.currentSystem][t.commodity];
            ((s.stock = Math.min(s.capacity, s.stock + t.amount)),
              (s.shock = bound(s.shock - t.amount * 0.025, -0.35, 1.25)),
              e.push(t.id));
          }
        } else
          ["courier", "passenger", "escort", "espionage", "explore"].includes(t.type) &&
            ((t.progress = t.amount), e.push(t.id));
    for (let t of e) this.completeMission(t);
  }
  completeMission(e) {
    let t = this.state.acceptedMissions.find((s) => s.id === e);
    if (!t) return;
    ((t.complete = !0),
      (this.state.credits += t.reward),
      (this.state.contractsCompleted = (this.state.contractsCompleted ?? 0) + 1),
      (this.state.renown += Math.max(1, Math.round(t.reward / 450))));
    let i = t.risk === "EXTREME" ? 9 : t.risk === "HIGH" ? 7 : t.risk === "MED" ? 5 : 3;
    this.state.reputation[t.issuer] = bound(this.state.reputation[t.issuer] + i, -100, 100);
    for (let s of FACTIONS[t.issuer].allies)
      this.state.reputation[s] = bound(this.state.reputation[s] + i * 0.25, -100, 100);
    for (let s of FACTIONS[t.issuer].enemies)
      this.state.reputation[s] = bound(this.state.reputation[s] - i * 0.15, -100, 100);
    (t.contactId &&
      this.state.world.contacts[t.contactId] &&
      (this.state.world.contacts[t.contactId].trust = bound(this.state.world.contacts[t.contactId].trust + i, 0, 100)),
      t.story &&
        ((this.state.world.story.chapter = Math.min(5, this.state.world.story.chapter + 1)),
        (this.state.world.story.shards = Array.from(new Set([...this.state.world.story.shards, t.targetSystem])))),
      (this.state.acceptedMissions = this.state.acceptedMissions.filter((s) => s.id !== e)),
      addNews(this.state.world, {
        tone: "good",
        headline: `Contract completed: ${t.title}`,
        detail: t.consequences,
        system: this.state.currentSystem,
      }),
      this.notify(
        "good",
        "Contract complete",
        `+${t.reward.toLocaleString()} cr \xB7 ${FACTIONS[t.issuer].short} reputation increased`,
      ),
      this.save(!0),
      this.changed());
  }
  expireMissions() {
    let e = this.state.acceptedMissions.filter((t) => !t.story && t.deadlineTick < this.state.world.tick);
    for (let t of e)
      (t.commodity &&
        (this.state.contractCargo[t.commodity] = Math.max(0, (this.state.contractCargo[t.commodity] ?? 0) - t.amount)),
        (this.state.reputation[t.issuer] = bound(this.state.reputation[t.issuer] - 4, -100, 100)),
        this.notify(
          "danger",
          "Contract failed",
          `${t.title} expired. ${FACTIONS[t.issuer].short} reputation decreased.`,
        ));
    e.length > 0 && (this.state.acceptedMissions = this.state.acceptedMissions.filter((t) => !e.includes(t)));
  }
  registerCrime(e, t, i = !0, s) {
    if (!i) {
      this.notify("info", "Evidence uplink jammed", `${e} was not reported to local authorities.`);
      return;
    }
    let n = this.state.currentSystem,
      a = systemOwner(this.state.world, n);
    if (a === "freewake") {
      this.state.reputation.freewake = bound(
        this.state.reputation.freewake - (e.includes("Cartel") ? t * 0.4 : 0),
        -100,
        100,
      );
      return;
    }
    let o = systemSecurity(this.state.world, n),
      l = this.state.crew.includes("vale") ? 0.82 : 1,
      c = t * (0.6 + o * 0.6) * l,
      u = Math.round(t * t * 7 + t * 90);
    ((this.state.jurisdictionHeat[n] = bound((this.state.jurisdictionHeat[n] ?? 0) + c, 0, 100)),
      (this.state.jurisdictionBounty[n] = Math.max(0, (this.state.jurisdictionBounty[n] ?? 0) + u)),
      this.state.crimes.unshift({
        id: `crime-${this.state.world.tick}-${this.state.crimes.length}`,
        system: n,
        jurisdiction: a,
        type: e,
        severity: t,
        bounty: u,
        witnessed: i,
        tick: this.state.world.tick,
      }),
      (this.state.crimes = this.state.crimes.slice(0, 24)),
      (this.state.reputation[a] = bound(this.state.reputation[a] - Math.max(1, t * 0.18), -100, 100)),
      s && (this.state.reputation[s] = bound(this.state.reputation[s] - t * 0.12, -100, 100)),
      (this.state.reputation.freewake = bound(this.state.reputation.freewake + t * 0.035, -100, 100)),
      this.notify(
        "danger",
        e,
        `${heatLabel(this.state.jurisdictionHeat[n])} \xB7 ${this.state.jurisdictionBounty[n].toLocaleString()} cr bounty`,
      ),
      addNews(this.state.world, {
        tone: "danger",
        headline: `${e} reported in ${systemById(n).name}`,
        detail: "Security response and regional reputation have changed.",
        system: n,
      }),
      this.changed());
  }
  resolveContrabandScan() {
    let e = systemOwner(this.state.world, this.state.currentSystem);
    if (e === "freewake") return !1;
    let t = COMMODITIES.filter((h) => isContraband(this.state, this.state.currentSystem, h.id))
      .map((h) => ({
        commodity: h,
        amount: cargoUnits(this.state, h.id),
      }))
      .filter((h) => h.amount > 0);
    if (t.length === 0) return (this.notify("info", "Cargo scan clear", "No restricted signatures detected."), !1);
    let i = t.reduce((h, d) => h + d.amount, 0),
      s = hiddenCapacity(this.state),
      n = Math.max(0, i - s),
      a = this.state.forgedIdCharges > 0 ? 0.45 : 1,
      o = FACTIONS[e].scanStrictness * shipStats(this.state).scanSignature * a * bound(n / Math.max(1, i), 0.08, 1);
    if ((this.state.forgedIdCharges > 0 && (this.state.forgedIdCharges -= 1), n <= 0 || Math.random() > o))
      return (
        this.notify(
          "good",
          "Cargo scan passed",
          s > 0 ? "Shielded compartments masked the restricted cargo." : "Documentation accepted.",
        ),
        (this.state.skills.smuggling += 2),
        !1
      );
    let l = n,
      c = 0,
      u = new Set();
    for (let h of t) {
      if (l <= 0) break;
      let d = this.state.cargo[h.commodity.id] ?? 0,
        f = Math.min(d, l);
      if (
        ((this.state.cargo[h.commodity.id] = d - f),
        (this.state.stolenCargo[h.commodity.id] = Math.max(0, (this.state.stolenCargo[h.commodity.id] ?? 0) - f)),
        (l -= f),
        (c += f * h.commodity.base),
        l > 0)
      ) {
        let m = this.state.contractCargo[h.commodity.id] ?? 0,
          p = Math.min(m, l);
        ((this.state.contractCargo[h.commodity.id] = m - p),
          (l -= p),
          (c += p * h.commodity.base),
          p > 0 && u.add(h.commodity.id));
      }
    }
    this.registerCrime("Contraband discovered", 12 + Math.min(18, c / 120), !0);
    for (let h of [...this.state.acceptedMissions])
      h.commodity &&
        u.has(h.commodity) &&
        ["delivery", "smuggle", "blockade"].includes(h.type) &&
        this.abandonMission(h.id);
    return (
      this.notify(
        "danger",
        "Cargo confiscated",
        `${Math.ceil(n)} exposed unit${n === 1 ? "" : "s"} seized by ${FACTIONS[e].short} security.`,
      ),
      !0
    );
  }
  payFine() {
    let e = this.state.currentSystem,
      t = this.state.jurisdictionBounty[e] ?? 0,
      i = this.state.jurisdictionHeat[e] ?? 0,
      s = Math.ceil(t + i * 22);
    return s <= 0
      ? !0
      : i >= 70
        ? (this.notify("warn", "Settlement refused", "Military warrants require a record hack or heat below 70."), !1)
        : this.state.credits < s
          ? (this.notify(
              "warn",
              "Fine payment declined",
              `Need ${(s - this.state.credits).toLocaleString()} more credits.`,
            ),
            !1)
          : ((this.state.credits -= s),
            (this.state.jurisdictionHeat[e] = 0),
            (this.state.jurisdictionBounty[e] = 0),
            this.notify(
              "good",
              "Legal account settled",
              `${s.toLocaleString()} cr paid \xB7 faction reputation was not restored`,
            ),
            this.changed(),
            !0);
  }
  bribeOfficials() {
    let e = this.state.currentSystem,
      t = this.state.jurisdictionBounty[e] ?? 0,
      i = this.state.jurisdictionHeat[e] ?? 0;
    if (
      !(
        this.state.reputation.freewake >= 10 ||
        this.state.world.contacts.latch?.trust >= 10 ||
        systemById(e).stations.some((a) => a.services.includes("blackMarket"))
      )
    )
      return (
        this.notify("warn", "No trusted intermediary", "Build Freewake reputation or find Latch Niko first."),
        !1
      );
    let n = Math.ceil(750 + t * 0.45 + i * 9);
    return this.state.credits < n
      ? (this.notify("warn", "Bribe shortfall", `Need ${(n - this.state.credits).toLocaleString()} more credits.`), !1)
      : ((this.state.credits -= n),
        (this.state.jurisdictionHeat[e] *= 0.2),
        (this.state.jurisdictionBounty[e] *= 0.55),
        (this.state.reputation.freewake = bound(this.state.reputation.freewake + 1, -100, 100)),
        this.notify(
          "good",
          "Administrative correction filed",
          `${n.toLocaleString()} cr \xB7 heat and bounty sharply reduced`,
        ),
        this.changed(),
        !0);
  }
  forgeIdentity() {
    let e = this.state.currentSystem;
    if (
      !(
        systemOwner(this.state.world, e) === "freewake" ||
        systemById(e).stations.some((s) => s.services.includes("blackMarket")) ||
        this.state.world.contacts.latch?.trust >= 10 ||
        this.state.propertyOperations.some((s) => s.id === "hideout" && s.system === e)
      )
    )
      return (
        this.notify(
          "warn",
          "No transponder artist",
          "Find a black market, earn Latch Niko's trust, or establish a local hideout.",
        ),
        !1
      );
    let i = Math.ceil(1400 + (this.state.jurisdictionBounty[e] ?? 0) * 0.18);
    return this.state.credits < i
      ? (this.notify("warn", "Forgery unavailable", `Need ${(i - this.state.credits).toLocaleString()} more credits.`),
        !1)
      : ((this.state.credits -= i),
        (this.state.forgedIdCharges = 3),
        (this.state.jurisdictionHeat[e] *= 0.65),
        this.notify(
          "good",
          "Transponder identity changed",
          "The next three cargo scans are far less likely to match your warrants.",
        ),
        this.changed(),
        !0);
  }
  hackRecords() {
    let e = this.state.currentSystem;
    if (!(this.state.properties.includes("relay") || this.state.world.contacts.latch?.trust >= 25))
      return (this.notify("warn", "No records access", "Establish a Whisper Relay or earn Latch Niko's trust."), !1);
    let i = 2200;
    if (this.state.credits < i) return !1;
    this.state.credits -= i;
    let s = hashUnit(`${this.state.world.tick}:${e}:hack:${this.state.renown}`) > 0.25;
    return (
      s
        ? ((this.state.jurisdictionBounty[e] *= 0.28),
          (this.state.jurisdictionHeat[e] *= 0.45),
          this.notify(
            "good",
            "Records intrusion successful",
            "Most of the active bounty was reassigned to a nonexistent ship.",
          ))
        : this.registerCrime("Faction records intrusion", 18, !0),
      this.changed(),
      s
    );
  }
  buyShip(e) {
    let t = shipById(e);
    if (this.state.ownedShips.includes(e)) {
      this.switchShip(e);
      return;
    }
    if (t.faction && this.state.reputation[t.faction] < (t.requiredReputation ?? 0)) {
      this.notify(
        "warn",
        "Purchase license denied",
        `Requires ${t.requiredReputation} reputation with ${FACTIONS[t.faction].short}.`,
      );
      return;
    }
    let i = systemOwner(this.state.world, this.state.currentSystem);
    if (
      t.faction &&
      t.faction !== i &&
      !systemById(this.state.currentSystem).stations.some((s) => s.services.includes("blackMarket"))
    ) {
      this.notify(
        "warn",
        "Hull not stocked here",
        `Find a ${FACTIONS[t.faction].short} shipyard or black-market dealer.`,
      );
      return;
    }
    if (this.state.credits < t.price) {
      this.notify("warn", "Not enough credits", `Need ${(t.price - this.state.credits).toLocaleString()} more.`);
      return;
    }
    ((this.state.credits -= t.price), this.state.ownedShips.push(e));
    for (let s of t.defaultWeapons) this.state.ownedWeapons.includes(s) || this.state.ownedWeapons.push(s);
    for (let s of t.defaultModules) this.state.ownedModules.includes(s) || this.state.ownedModules.push(s);
    (this.switchShip(e),
      this.notify(
        "good",
        `${t.name} acquired`,
        "Its individual loadout and installed systems are ready in the refit bay.",
      ));
  }
  captureShip(e) {
    this.state.ownedShips.includes(e) ||
      (this.state.ownedShips.push(e),
      (this.state.weaponLoadouts[e] = [...shipById(e).defaultWeapons]),
      (this.state.installedModules[e] = [...shipById(e).defaultModules]),
      this.notify("good", `${shipById(e).name} captured`, "The damaged hull was towed to your storage fleet."),
      this.changed());
  }
  switchShip(e) {
    if (!this.state.ownedShips.includes(e)) return;
    let t = this.state.shipId;
    if (((this.state.shipId = e), cargoMass(this.state) > cargoCapacity(this.state))) {
      ((this.state.shipId = t),
        this.notify("warn", "Cargo does not fit", "Sell or transfer cargo before switching ships."));
      return;
    }
    let i = shipStats(this.state);
    ((this.state.hull = i.hull),
      (this.state.armor = i.armor),
      (this.state.shield = i.shield),
      (this.state.energy = i.energy),
      (this.state.activeWeaponIndex = 0),
      this.changed());
  }
  buyUpgrade(e) {
    let t = this.state.upgrades[e],
      i = upgradeCost(t);
    if (t >= 5) return;
    if (this.state.credits < i) {
      this.notify("warn", "Upgrade unavailable", `Need ${(i - this.state.credits).toLocaleString()} more credits.`);
      return;
    }
    ((this.state.credits -= i), (this.state.upgrades[e] += 1));
    let s = shipStats(this.state);
    (e === "shield" && (this.state.shield = s.shield),
      e === "cargo" && cargoMass(this.state) > s.cargo && (this.state.upgrades[e] -= 1),
      this.notify("good", `${e[0].toUpperCase()}${e.slice(1)} tuned to Mk ${t + 1}`),
      this.changed());
  }
  buyWeapon(e) {
    let t = WEAPONS[e];
    return this.state.ownedWeapons.includes(e)
      ? this.equipWeapon(e)
      : this.state.credits < t.price
        ? (this.notify(
            "warn",
            "Weapon unavailable",
            `Need ${(t.price - this.state.credits).toLocaleString()} more credits.`,
          ),
          !1)
        : ((this.state.credits -= t.price), this.state.ownedWeapons.push(e), this.equipWeapon(e), !0);
  }
  equipWeapon(e, t) {
    if (!this.state.ownedWeapons.includes(e)) return !1;
    let i = [...(this.state.weaponLoadouts[this.state.shipId] ?? [])],
      s = shipById(this.state.shipId).mounts,
      n = t ?? Math.min(i.length, s - 1);
    return (
      (i[n] = e),
      (this.state.weaponLoadouts[this.state.shipId] = i.slice(0, s)),
      (this.state.activeWeaponIndex = n),
      this.notify("good", `${WEAPONS[e].name} mounted`, `Weapon slot ${n + 1} is now active.`),
      this.changed(),
      !0
    );
  }
  cycleWeapon(e = 1) {
    let t = this.state.weaponLoadouts[this.state.shipId] ?? [];
    t.length !== 0 &&
      ((this.state.activeWeaponIndex = (this.state.activeWeaponIndex + e + t.length) % t.length),
      this.notify("info", `Weapon ${this.state.activeWeaponIndex + 1}: ${activeWeapon(this.state).name}`),
      this.changed());
  }
  buyModule(e) {
    let t = MODULES[e];
    if (!this.state.ownedModules.includes(e)) {
      if (this.state.credits < t.price)
        return (
          this.notify(
            "warn",
            "Module unavailable",
            `Need ${(t.price - this.state.credits).toLocaleString()} more credits.`,
          ),
          !1
        );
      ((this.state.credits -= t.price), this.state.ownedModules.push(e));
    }
    return this.installModule(e);
  }
  installModule(e) {
    let t = this.state.installedModules[this.state.shipId] ?? [];
    if (t.includes(e)) return this.uninstallModule(e);
    if (t.length >= shipById(this.state.shipId).slots)
      return (this.notify("warn", "No free module slot", "Remove a system before installing another."), !1);
    if (t.reduce((n, a) => n + MODULES[a].power, 0) + MODULES[e].power > shipById(this.state.shipId).energy * 0.58)
      return (
        this.notify(
          "warn",
          "Reactor margin exceeded",
          "Remove a high-draw module or use a hull with a larger reactor.",
        ),
        !1
      );
    this.state.installedModules[this.state.shipId] = [...t, e];
    let s = shipStats(this.state);
    return (
      (this.state.shield = Math.min(s.shield, this.state.shield + (e === "shieldBooster" ? s.shield * 0.25 : 0))),
      (this.state.armor = Math.min(s.armor, this.state.armor + (e === "reactiveArmor" ? s.armor * 0.25 : 0))),
      this.notify("good", `${MODULES[e].name} installed`, MODULES[e].effect),
      this.changed(),
      !0
    );
  }
  uninstallModule(e) {
    let t = [...(this.state.installedModules[this.state.shipId] ?? [])],
      i = t.indexOf(e);
    if (i < 0) return !1;
    (t.splice(i, 1), (this.state.installedModules[this.state.shipId] = t));
    let s = shipStats(this.state);
    return (
      (this.state.shield = Math.min(this.state.shield, s.shield)),
      (this.state.armor = Math.min(this.state.armor, s.armor)),
      cargoMass(this.state) > s.cargo
        ? (t.splice(i, 0, e),
          (this.state.installedModules[this.state.shipId] = t),
          this.notify("warn", "Module still required", "Cargo would exceed the ship's mass capacity."),
          !1)
        : (this.notify("info", `${MODULES[e].name} removed`, "The module remains in your equipment inventory."),
          this.changed(),
          !0)
    );
  }
  hireCrew(e) {
    let t = CREW.find((s) => s.id === e);
    if (!t || this.state.crew.includes(e)) return;
    let i = Math.min(8, 2 + Math.ceil(shipById(this.state.shipId).slots / 2));
    if (this.state.crew.length >= i) {
      this.notify("warn", "No free crew berth", `This hull supports ${i} active specialists.`);
      return;
    }
    if (this.state.credits < t.cost) {
      this.notify(
        "warn",
        "Signing fee required",
        `Need ${(t.cost - this.state.credits).toLocaleString()} more credits.`,
      );
      return;
    }
    ((this.state.credits -= t.cost),
      this.state.crew.push(e),
      (this.state.crewLoyalty[e] = 55),
      this.notify("good", `${t.name} joined your crew`, `${t.bonus} \xB7 ${t.salary} cr per payroll`),
      this.changed());
  }
  buyProperty(e) {
    let t = PROPERTIES.find((i) => i.id === e);
    if (!(!t || this.state.properties.includes(e))) {
      if (this.state.credits < t.price) {
        this.notify(
          "warn",
          "Investment unavailable",
          `Need ${(t.price - this.state.credits).toLocaleString()} more credits.`,
        );
        return;
      }
      ((this.state.credits -= t.price),
        this.state.properties.push(e),
        this.state.propertyOperations.push({
          id: e,
          system: this.state.currentSystem,
          level: 1,
          condition: 100,
          stored: {},
        }),
        this.notify("good", `${t.name} established in ${systemById(this.state.currentSystem).name}`, t.blurb),
        this.changed());
    }
  }
  transferToStorage(e, t, i) {
    let s = this.state.propertyOperations.find((l) => l.id === e),
      n = PROPERTIES.find((l) => l.id === e);
    if (!s || !n || s.system !== this.state.currentSystem) return !1;
    let a = Object.entries(s.stored).reduce((l, [c, u]) => l + (u ?? 0) * commodityById(c).mass, 0),
      o = Math.min(i, this.state.cargo[t] ?? 0, Math.floor((n.capacity - a) / commodityById(t).mass));
    return o <= 0
      ? !1
      : ((this.state.cargo[t] = (this.state.cargo[t] ?? 0) - o),
        (s.stored[t] = (s.stored[t] ?? 0) + o),
        this.notify("good", `Stored ${o} ${commodityById(t).name}`, `${n.name} \xB7 ${systemById(s.system).name}`),
        this.changed(),
        !0);
  }
  withdrawFromStorage(e, t, i) {
    let s = this.state.propertyOperations.find((l) => l.id === e);
    if (!s || s.system !== this.state.currentSystem) return !1;
    let n = s.stored[t] ?? 0,
      a = Math.floor((cargoCapacity(this.state) - cargoMass(this.state)) / commodityById(t).mass),
      o = Math.max(0, Math.min(i, n, a));
    return o <= 0
      ? (this.notify(
          "warn",
          "Transfer blocked",
          n <= 0 ? "No stored units are available." : "Your cargo hold has no free mass capacity.",
        ),
        !1)
      : ((s.stored[t] = n - o),
        (this.state.cargo[t] = (this.state.cargo[t] ?? 0) + o),
        this.notify(
          "good",
          `Retrieved ${o} ${commodityById(t).name}`,
          `${systemById(s.system).name} storage transfer complete`,
        ),
        this.changed(),
        !0);
  }
  assignFleetShip(e, t) {
    if (!this.state.ownedShips.includes(e) || e === this.state.shipId) return;
    let i = systemById(this.state.currentSystem).links[0] ?? this.state.currentSystem,
      s = (systemPiracy(this.state.world, i) + systemWar(this.state.world, i)) * 0.5,
      n = this.state.crew.find((o) => !Object.values(this.state.fleetOrders).some((l) => l?.captain === o));
    ((this.state.fleetOrders[e] = {
      shipId: e,
      role: t,
      destination: i,
      progress: t === "standby" ? 0 : 5,
      risk: s,
      captain: n,
      status: t === "standby" ? "ready" : "active",
      lastReport: t === "standby" ? "Awaiting orders" : `Departing for ${systemById(i).name}`,
    }),
      ["standby", "trade", "mining", "escort"].includes(t)
        ? (this.state.fleetAssignments[e] = t)
        : delete this.state.fleetAssignments[e]);
    let a = t === "standby" ? "standing by" : `${t} operation toward ${systemById(i).name}`;
    (this.notify(
      "good",
      `${shipById(e).name} orders updated`,
      `${n ? `${CREW.find((o) => o.id === n)?.name} commanding \xB7 ` : "Automated captain \xB7 "}${a}`,
    ),
      this.changed());
  }
  applyMarketShock(e, t, i) {
    this.state.marketShock[e] ??= {};
    let s = this.state.marketShock[e][t] ?? 0;
    this.state.marketShock[e][t] = bound(s + i, -0.3, 1.25);
    let n = this.state.world.markets[e]?.[t];
    n && (n.shock = bound(n.shock + i, -0.35, 1.25));
  }
  resolveOperations() {
    let e = this.state.world.tick;
    for (let i of Object.values(this.state.fleetOrders)) {
      if (!i || i.role === "standby" || ((i.progress += i.status === "delayed" ? 12 : 25), i.progress < 100)) continue;
      let s = shipById(i.shipId),
        n = i.captain ? 0.12 : 0,
        a = bound(0.9 - i.risk * 0.45 + n + s.speed * 0.004, 0.42, 0.98),
        o = hashUnit(`${e}:${i.shipId}:${i.role}:fleet`);
      if (o <= a) {
        let l =
          i.role === "trade"
            ? 420 + s.cargo * 7
            : i.role === "mining"
              ? 360 + s.cargo * 5
              : i.role === "escort"
                ? 440 + s.hull
                : i.role === "salvage"
                  ? 500 + s.slots * 80
                  : 390 + s.shield;
        if (
          ((this.state.credits += Math.round(l)),
          (i.status = "active"),
          (i.lastReport = `${i.role} operation succeeded \xB7 +${Math.round(l).toLocaleString()} cr`),
          i.role === "trade")
        ) {
          let c = COMMODITIES[Math.floor(hashUnit(`${e}:${i.shipId}:cargo`) * COMMODITIES.length)].id;
          this.state.world.markets[i.destination][c].stock = Math.min(
            this.state.world.markets[i.destination][c].capacity,
            this.state.world.markets[i.destination][c].stock + 4,
          );
        }
        (i.role === "mining" &&
          (this.state.world.markets[i.destination].ore.stock = Math.min(
            this.state.world.markets[i.destination].ore.capacity,
            this.state.world.markets[i.destination].ore.stock + 6,
          )),
          i.role === "salvage" &&
            (this.state.world.markets[i.destination].scrap.stock = Math.min(
              this.state.world.markets[i.destination].scrap.capacity,
              this.state.world.markets[i.destination].scrap.stock + 5,
            )),
          i.role === "escort" &&
            ((this.state.world.systems[i.destination].piracy = bound(
              this.state.world.systems[i.destination].piracy - 0.035,
              0,
              1,
            )),
            (this.state.reputation[systemOwner(this.state.world, i.destination)] = bound(
              this.state.reputation[systemOwner(this.state.world, i.destination)] + 0.6,
              -100,
              100,
            ))),
          i.role === "patrol" &&
            ((this.state.world.systems[i.destination].security = bound(
              this.state.world.systems[i.destination].security + 0.025,
              0,
              1,
            )),
            (this.state.world.systems[i.destination].war = bound(
              this.state.world.systems[i.destination].war - 0.018,
              0,
              1,
            ))));
      } else
        ((i.status = o < i.risk * 0.18 ? "damaged" : "delayed"),
          (i.lastReport =
            i.status === "damaged"
              ? "Ambushed; hull damaged and cargo lost"
              : "Route delayed by inspections and hostile traffic"),
          (this.state.credits = Math.max(0, this.state.credits - Math.round(s.price * 0.015))));
      ((i.progress = 0),
        (i.destination =
          systemById(i.destination).links[
            Math.floor(hashUnit(`${e}:${i.shipId}:next`) * Math.max(1, systemById(i.destination).links.length))
          ] ?? this.state.currentSystem),
        this.notify(i.status === "active" ? "good" : "warn", `${s.name} fleet report`, i.lastReport));
    }
    for (let i of this.state.propertyOperations) {
      let s = PROPERTIES.find((o) => o.id === i.id),
        n = Math.round(s.income * 0.28),
        a = Math.round(s.income * i.level * (i.condition / 100)) - n;
      if (
        (i.id === "warehouse" && (a += Math.round(Object.values(i.stored).reduce((o, l) => o + (l ?? 0), 0) * 2.5)),
        (this.state.credits += Math.max(0, a)),
        i.id === "mine")
      ) {
        let o = this.state.world.markets[i.system].ore;
        ((o.stock = Math.min(o.capacity, o.stock + 5 * i.level)),
          (i.stored.ore = Math.min(s.capacity, (i.stored.ore ?? 0) + 1 * i.level)));
      }
      if (i.id === "relay")
        for (let o of this.state.knownSystems)
          for (let l of marketQuotes(this.state, o)) recordIntel(this.state.world, o, l.id, l.buy, l.sell, l.stock);
      if (i.id === "hideout")
        for (let o of Object.keys(this.state.jurisdictionHeat))
          this.state.jurisdictionHeat[o] *= o === i.system ? 0.45 : 0.9;
      if (i.id === "dock" && i.system === this.state.currentSystem) {
        let o = shipStats(this.state);
        ((this.state.hull = Math.min(o.hull, this.state.hull + o.hull * 0.12)),
          (this.state.armor = Math.min(o.armor, this.state.armor + o.armor * 0.18)),
          (this.state.shield = o.shield));
      }
      if (i.id === "tradeOffice") {
        let o = systemById(i.system).links,
          l = o[Math.floor(hashUnit(`${e}:${i.system}:office-route`) * Math.max(1, o.length))] ?? i.system,
          c = marketQuotes(this.state, i.system),
          u = marketQuotes(this.state, l),
          h = c
            .map((d) => ({
              id: d.id,
              margin: (u.find((f) => f.id === d.id)?.sell ?? 0) - d.buy,
            }))
            .sort((d, f) => f.margin - d.margin)[0];
        if (h && h.margin > 0) {
          let d = this.state.world.markets[i.system][h.id],
            f = this.state.world.markets[l][h.id],
            m = Math.min(4 * i.level, Math.max(0, Math.floor(d.stock - 2)));
          ((d.stock -= m), (f.stock = Math.min(f.capacity, f.stock + m)));
          let p = Math.round(m * h.margin * 0.38);
          ((this.state.credits += p),
            m > 0 &&
              addNews(this.state.world, {
                tone: "good",
                headline: `Player trade office supplied ${systemById(l).name}`,
                detail: `${m} ${commodityById(h.id).name} moved from ${systemById(i.system).name}; regional stock and prices changed.`,
                system: l,
              }));
        }
      }
    }
    let t = CREW.filter((i) => this.state.crew.includes(i.id)).reduce((i, s) => i + s.salary, 0);
    if (t > 0)
      if (this.state.credits >= t) {
        this.state.credits -= t;
        for (let i of this.state.crew) this.state.crewLoyalty[i] = bound((this.state.crewLoyalty[i] ?? 50) + 1, 0, 100);
      } else {
        for (let s of this.state.crew) this.state.crewLoyalty[s] = bound((this.state.crewLoyalty[s] ?? 50) - 8, 0, 100);
        this.notify(
          "danger",
          "Crew payroll missed",
          "Loyalty fell. Complete work or sell cargo before the next payroll.",
        );
        let i = this.state.crew.find(
          (s) => (this.state.crewLoyalty[s] ?? 50) <= 5 && hashUnit(`${e}:${s}:departure`) > 0.45,
        );
        if (i) {
          let s = CREW.find((n) => n.id === i);
          this.state.crew = this.state.crew.filter((n) => n !== i);
          for (let n of Object.values(this.state.fleetOrders)) n?.captain === i && (n.captain = void 0);
          this.notify(
            "danger",
            `${s?.name ?? "A crew member"} left`,
            "Repeated missed payroll exhausted their loyalty. They may reappear through a future contact.",
          );
        }
      }
  }
  tickMarket() {
    let e = advanceWorld(this.state.world, 1);
    this.state.marketTick = this.state.world.tick + 1;
    for (let t of Object.values(this.state.marketShock)) for (let i of Object.keys(t)) t[i] = (t[i] ?? 0) * 0.72;
    for (let [t, i] of Object.entries(this.state.jurisdictionHeat)) {
      let s = this.state.propertyOperations.some((n) => n.id === "hideout" && n.system === t);
      this.state.jurisdictionHeat[t] = Math.max(0, i - (t === this.state.currentSystem ? 0.4 : s ? 5 : 1.6));
    }
    (this.expireMissions(),
      this.state.world.tick - this.state.lastPayrollTick >= 4 &&
        ((this.state.lastPayrollTick = this.state.world.tick), this.resolveOperations()),
      e[0] && this.notify(e[0].tone, e[0].headline, e[0].detail),
      this.recordLocalIntel(),
      this.changed());
  }
  talkToContact(e, t) {
    let i = CONTACTS.find((n) => n.id === e),
      s = this.state.world.contacts[e];
    if (!i || !s || i.system !== this.state.currentSystem) return !1;
    if (((s.met = !0), (s.lastTalkTick = this.state.world.tick), t === "work"))
      ((s.trust = bound(s.trust + 2, 0, 100)),
        (s.arc = Math.min(4, s.arc + (s.trust >= 20 ? 1 : 0))),
        this.notify("good", `${i.name}: opportunity unlocked`, i.unlock));
    else if (t === "trust") {
      if (this.state.credits < 350) return !1;
      ((this.state.credits -= 350),
        (s.trust = bound(s.trust + 6, 0, 100)),
        this.notify("good", `${i.name} remembers the favor`, `Trust ${Math.round(s.trust)}/100`));
    } else {
      s.trust = bound(s.trust + 1, 0, 100);
      let n = this.state.world.targets.find((a) => a.status !== "dead" && a.status !== "captured");
      n &&
        ((n.status = "active"),
        (n.lastSeenTick = this.state.world.tick),
        this.notify("info", `${i.name}: fresh intelligence`, `${n.name} was seen in ${systemById(n.system).name}.`));
    }
    return (
      (this.state.reputation[i.faction] = bound(this.state.reputation[i.faction] + 0.5, -100, 100)),
      this.changed(),
      !0
    );
  }
  discover(e, t) {
    if (this.state.world.discoveries.includes(e)) return !1;
    this.state.world.discoveries.push(e);
    let i = Math.round(450 * shipStats(this.state).surveyMultiplier + systemWar(this.state.world, t) * 250);
    ((this.state.credits += i), (this.state.renown += 2), (this.state.skills.exploration += 3));
    let s = this.state.world.story.signalDecoded;
    return (
      ["meridian", "veil", "cinder", "gloam", "null"].includes(t) &&
        ((this.state.world.story.shards = Array.from(new Set([...this.state.world.story.shards, t]))),
        this.state.world.story.shards.length >= 4 && (this.state.world.story.signalDecoded = !0)),
      this.recordGameEvent({
        kind: "scan",
        system: t,
        targetId: e,
        amount: 1,
        legalTarget: !0,
      }),
      this.notify("good", "Discovery catalogued", `+${i.toLocaleString()} cr survey grant \xB7 ${systemById(t).name}`),
      !s &&
        this.state.world.story.signalDecoded &&
        ((this.state.knownSystems = Array.from(new Set([...this.state.knownSystems, "null", "zenith"]))),
        this.notify(
          "good",
          "Impossible route decoded",
          "A hidden Null\u2013Zenith jump corridor is now available on the galaxy map.",
        ),
        addNews(this.state.world, {
          tone: "warn",
          headline: "Impossible route decoded",
          detail: "A private transit corridor now bridges Null and Zenith. Every faction would pay to control it.",
          system: "null",
        })),
      addNews(this.state.world, {
        tone: "good",
        headline: `New discovery in ${systemById(t).name}`,
        detail: "Your survey data is now part of the frontier intelligence network.",
        system: t,
      }),
      this.changed(),
      !0
    );
  }
  resolveNamedTarget(e, t) {
    let i = this.state.world.targets.find((s) => s.id === e);
    !i ||
      i.status === "dead" ||
      i.status === "captured" ||
      ((i.status = t ? "captured" : "dead"),
      (this.state.credits += Math.round(i.bounty * (t ? 1.35 : 1))),
      (this.state.bountiesCollected = (this.state.bountiesCollected ?? 0) + Math.round(i.bounty * (t ? 1.35 : 1))),
      this.recordGameEvent({
        kind: t ? "board" : "kill",
        system: this.state.currentSystem,
        targetId: i.id,
        targetRole: "pirate",
        targetFaction: i.faction,
        legalTarget: !0,
      }),
      this.notify(
        "good",
        `${i.name} ${t ? "captured" : "confirmed"}`,
        `+${Math.round(i.bounty * (t ? 1.35 : 1)).toLocaleString()} cr`,
      ),
      this.changed());
  }
  /** The Quiet Warden fell: the route can now be given away (see resolveStoryChoice). */
  wardenDefeated() {
    let e = this.state.world.story;
    e.wardenDefeated ||
      ((e.wardenDefeated = !0),
      (this.state.renown += 12),
      (this.state.skills.exploration += 6),
      addNews(this.state.world, {
        tone: "warn",
        headline: "Something ancient went quiet in Null",
        detail: "Every long-range array on the frontier recorded the same collapse. Nobody admits to firing the shot.",
        system: "null",
      }),
      this.save(!0),
      this.changed());
  }
  /** The finale: hand the impossible route to a faction, or keep it. */
  resolveStoryChoice(e) {
    let t = STORY_CHOICES[e],
      i = this.state.world.story;
    if (!t || i.finaleDone) return !1;
    ((i.choice = e), (i.finaleDone = !0), (i.chapter = 5), (this.state.credits += t.credits), (this.state.renown += 10));
    for (let [s, n] of Object.entries(t.reputation))
      this.state.reputation[s] = bound((this.state.reputation[s] ?? 0) + n, -100, 100);
    if (e === "choir" && !this.state.ownedWeapons.includes("beam")) this.state.ownedWeapons.push("beam");
    if (e === "freewake") this.state.forgedIdCharges = (this.state.forgedIdCharges ?? 0) + 3;
    if (e === "concord")
      for (let s of SYSTEMS)
        systemOwner(this.state.world, s.id) === "concord" &&
          ((this.state.jurisdictionHeat[s.id] = 0), (this.state.jurisdictionBounty[s.id] = 0));
    if (e === "self") {
      let s = shipStats(this.state);
      ((this.state.shield = s.shield), (this.state.energy = s.energy));
    }
    return (
      addNews(this.state.world, {
        tone: e === "freewake" ? "danger" : "good",
        headline:
          e === "self" ? "The impossible route goes dark" : `${FACTIONS[t.faction].name} takes the impossible route`,
        detail:
          e === "self"
            ? "The Null\u2013Zenith corridor answers one transponder only. Every faction wants to know whose."
            : t.body,
        system: "null",
      }),
      this.notify("good", "Signal in the Static resolved", `+${t.credits.toLocaleString()} cr \xB7 ${t.perk}`),
      this.save(!0),
      this.changed(),
      !0
    );
  }
}
export {
  systemById,
  commodityById,
  shipById,
  moduleById,
  FACTIONS,
  COMMODITIES,
  FULL_SERVICES,
  OUTPOST_SERVICES,
  SYSTEMS,
  SHIPS,
  WEAPONS,
  MODULES,
  CREW,
  CONTACTS,
  PROPERTIES,
  clamp,
  hashUnit,
  marketPrice,
  createWorld,
  pushNews,
  simulateConvoys,
  simulateFactionOperations,
  moveNamedTargets,
  spawnWorldEvent,
  advanceWorld,
  systemOwner,
  systemSecurity,
  systemPiracy,
  systemWar,
  recordIntel,
  addNews,
  defaultWeaponLoadouts,
  defaultModuleLoadouts,
  createCareer,
  bound,
  cargoUnits,
  cargoMass,
  cargoCapacity,
  hiddenCapacity,
  computeShipStats,
  shipStats,
  activeWeapon,
  reputationLabel,
  heatLabel,
  heatTier,
  isContraband,
  marketQuotes,
  bestKnownSale,
  localContact,
  missionObjective,
  pickMissionType,
  storyMission,
  missionBoard,
  migrateSave,
  upgradeCost,
  SAVE_KEY,
  OLD_SAVE_KEY,
  START_REPUTATION,
  DEFAULT_SETTINGS,
  DIFFICULTY,
  difficultyOf,
  STORY_CHOICES,
  MISSION_TITLES,
  Career,
};
