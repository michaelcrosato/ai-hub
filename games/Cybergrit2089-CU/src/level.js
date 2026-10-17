import { OBJECTIVES, DIALOGUE } from "./data.js";
// Content is world-space data. One tile = 16 units. The simulation and renderer share these footprints.
export const LOWLIGHT = {
  id: "lowlight",
  name: "LOWLIGHT DISTRICT",
  subtitle: "The city keeps what you owe.",
  width: 56,
  height: 44,
  spawn: [176, 584],
  objectives: OBJECTIVES,
  dialogue: DIALOGUE,
  encounter: { bounds: [558, 80, 864, 416], stage: 2 },
  securityWalls: [
    { x: 34, y: 5, axis: "y", length: 22 },
    { x: 54, y: 5, axis: "y", length: 22 },
    { x: 34, y: 5, axis: "x", length: 21 },
    { x: 34, y: 26, axis: "x", length: 21 },
  ],
  gates: {
    main: { x: 34, y: 19, axis: "y", length: 4, flag: "relay" },
    service: { x: 34, y: 11, axis: "y", length: 3, flag: "captive" },
  },
  buildings: [
    {
      id: "noodles",
      x: 3,
      y: 28,
      w: 5,
      d: 8,
      h: 82,
      color: "#223e4b",
      neon: "#ff885b",
      sign: "AFTERHOURS",
      sub: "NOODLE BAR",
      face: "y",
    },
    {
      id: "clinic",
      x: 3,
      y: 15,
      w: 6,
      d: 10,
      h: 114,
      color: "#263448",
      neon: "#69f5da",
      sign: "IRIS",
      sub: "BODY / REPAIR",
      face: "y",
    },
    {
      id: "arcade",
      x: 12,
      y: 28,
      w: 6,
      d: 4,
      h: 74,
      color: "#433148",
      neon: "#f175b7",
      sign: "99 LIVES",
      sub: "ARCADE",
      face: "y",
    },
    {
      id: "motel",
      x: 14,
      y: 13,
      w: 8,
      d: 6,
      h: 102,
      color: "#29354b",
      neon: "#f4d67c",
      sign: "NO VACANCY",
      sub: "ROOMS / 24H",
      face: "y",
    },
    {
      id: "freight",
      x: 24,
      y: 22,
      w: 4,
      d: 5,
      h: 62,
      color: "#364350",
      neon: "#a6cde1",
      sign: "CARGO",
      sub: "04",
      face: "y",
    },
    {
      id: "south",
      x: 21,
      y: 36,
      w: 10,
      d: 6,
      h: 100,
      color: "#222f43",
      neon: "#9685de",
      sign: "VANTA",
      sub: "THE NIGHT IS YOURS",
      face: "x",
    },
    {
      id: "north",
      x: 4,
      y: 3,
      w: 13,
      d: 5,
      h: 140,
      color: "#263345",
      neon: "#ef8b85",
      sign: "SLEEP / LESS",
      sub: "DREAM / MORE",
      face: "y",
    },
    {
      id: "tower",
      x: 24,
      y: 3,
      w: 6,
      d: 9,
      h: 150,
      color: "#273448",
      neon: "#83b4fb",
      sign: "NEURO",
      sub: "A BETTER YOU",
      face: "x",
    },
    {
      id: "helix",
      x: 38,
      y: 6,
      w: 13,
      d: 8,
      h: 132,
      color: "#36414b",
      neon: "#dafa60",
      sign: "HELIX",
      sub: "YOUR PAST. OUR FUTURE.",
      face: "y",
    },
    {
      id: "power",
      x: 38,
      y: 20,
      w: 4,
      d: 4,
      h: 42,
      color: "#39404a",
      neon: "#ff9f69",
      sign: "HV / 06",
      sub: "DANGER",
      face: "x",
    },
    {
      id: "east",
      x: 45,
      y: 35,
      w: 9,
      d: 7,
      h: 120,
      color: "#24354a",
      neon: "#65d4ea",
      sign: "LOWLIGHT",
      sub: "TRANSIT AUTHORITY",
      face: "x",
    },
    {
      id: "southwest",
      x: 3,
      y: 40,
      w: 12,
      d: 3,
      h: 68,
      color: "#202a3f",
      neon: "#e07db4",
      sign: "DREAM / DIVE",
      sub: "OPEN ALL NIGHT",
      face: "x",
    },
  ],
  interactables: [
    { id: "rook", kind: "npc", x: 160, y: 560, name: "Rook", role: "Fixer" },
    {
      id: "iris",
      kind: "npc",
      x: 160,
      y: 432,
      name: "Iris",
      role: "Street clinic",
    },
    {
      id: "captive",
      kind: "npc",
      x: 296,
      y: 176,
      name: "Sable",
      role: "Sever neural tether",
    },
    {
      id: "relay",
      kind: "terminal",
      x: 480,
      y: 432,
      name: "Security relay",
      role: "Breach network",
    },
    {
      id: "core",
      kind: "terminal",
      x: 736,
      y: 264,
      name: "Mnemosyne core",
      role: "Extract memory archive",
    },
    {
      id: "exit",
      kind: "vehicle",
      x: 792,
      y: 536,
      name: "Extraction",
      role: "Leave Lowlight",
    },
    {
      id: "cache",
      kind: "cache",
      x: 288,
      y: 352,
      name: "Runner’s stash",
      role: "Salvage supplies",
    },
    {
      id: "shard",
      kind: "shard",
      x: 640,
      y: 464,
      name: "Memory shard",
      role: "Read archived message",
    },
  ],
  enemies: [
    {
      id: "g1",
      kind: "guard",
      x: 320,
      y: 416,
      route: [
        [320, 416],
        [320, 464],
        [368, 464],
      ],
      facing: 1.5,
    },
    {
      id: "g2",
      kind: "guard",
      x: 496,
      y: 336,
      route: [
        [496, 336],
        [464, 288],
        [400, 288],
      ],
      facing: 1.5,
    },
    {
      id: "g3",
      kind: "guard",
      x: 240,
      y: 176,
      route: [
        [240, 176],
        [320, 176],
        [320, 144],
      ],
      facing: Math.PI,
    },
    {
      id: "g4",
      kind: "guard",
      x: 592,
      y: 344,
      route: [
        [592, 344],
        [592, 272],
        [640, 272],
      ],
      facing: Math.PI,
    },
    {
      id: "g5",
      kind: "guard",
      x: 800,
      y: 368,
      route: [
        [800, 368],
        [816, 288],
        [784, 288],
      ],
      facing: 2.7,
    },
    {
      id: "warden",
      kind: "boss",
      x: 720,
      y: 328,
      route: [[720, 328]],
      facing: Math.PI,
      asleep: true,
    },
  ],
  cover: [
    [304, 400, 24, 16],
    [336, 504, 32, 16],
    [464, 352, 20, 20],
    [240, 336, 24, 16],
    [576, 304, 16, 32],
    [672, 352, 32, 16],
    [752, 400, 32, 16],
    [784, 296, 16, 24],
    [352, 208, 16, 24],
  ],
  props: [
    ["stall", 144, 608],
    ["stall", 264, 552],
    ["stall", 304, 608],
    ["bench", 216, 624],
    ["vending", 192, 520],
    ["vending", 160, 396],
    ["vending", 352, 304],
    ["barrel", 288, 384],
    ["barrel", 304, 384],
    ["barrel", 480, 304],
    ["barrel", 512, 464],
    ["planter", 208, 416],
    ["planter", 208, 448],
    ["planter", 544, 496],
    ["planter", 576, 496],
    ["server", 656, 248],
    ["server", 688, 248],
    ["server", 784, 248],
    ["server", 816, 248],
    ["car", 416, 544],
    ["car", 688, 576],
    ["car", 112, 240],
    ["streetlamp", 144, 528],
    ["streetlamp", 272, 624],
    ["streetlamp", 352, 464],
    ["streetlamp", 464, 240],
    ["streetlamp", 560, 432],
    ["streetlamp", 832, 432],
    ["streetlamp", 720, 496],
    ["streetlamp", 176, 320],
  ],
  civilians: [
    [224, 560],
    [256, 624],
    [176, 368],
    [336, 560],
    [224, 384],
    [400, 496],
  ],
  signs: [
    ["NIGHT MARKET", 224, 584, "#f9ce83"],
    ["NO MEMORY IS FREE", 448, 208, "#ef8ac5"],
    ["HELIX / RESTRICTED", 568, 384, "#dafa60"],
  ],
  zones: [
    { name: "AFTERHOURS MARKET", bounds: [16, 480, 512, 704] },
    { name: "THE FREIGHT CUT", bounds: [208, 304, 528, 480] },
    { name: "BACKSTREET CLINIC", bounds: [16, 304, 208, 480] },
    { name: "DEAD SIGNAL ALLEY", bounds: [16, 16, 528, 304] },
    { name: "HELIX / MEMORY DIVISION", bounds: [528, 16, 896, 432] },
    { name: "LOWLIGHT TRANSIT", bounds: [512, 432, 896, 704] },
  ],
};

export function createMap(E, level = LOWLIGHT, MapClass = E.TileMap) {
  const rows = Array.from({ length: level.height }, (_, y) =>
    Array.from({ length: level.width }, (_, x) =>
      x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1
        ? "#"
        : ".",
    ),
  );
  const types = { 1: { h: 90 }, 2: { h: 38 }, 3: { h: 19 }, 4: { h: 55 } };
  level.buildings.forEach((b, i) => {
    const id = i + 10;
    types[id] = { h: b.h };
    for (let y = b.y; y < b.y + b.d; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        rows[y][x] = String.fromCharCode(107 + i);
  });
  for (const wall of level.securityWalls || [])
    for (let n = 0; n < wall.length; n++)
      rows[wall.y + (wall.axis === "y" ? n : 0)][
        wall.x + (wall.axis === "x" ? n : 0)
      ] = "|";
  for (const gate of Object.values(level.gates || {}))
    for (let n = 0; n < gate.length; n++)
      rows[gate.y + (gate.axis === "y" ? n : 0)][
        gate.x + (gate.axis === "x" ? n : 0)
      ] = "G";
  // Exact tile footprints keep cover, line of sight, bullets and navigation in agreement.
  for (const [x, y, w, d] of level.cover)
    for (
      let cy = Math.floor((y - d / 2) / 16);
      cy <= Math.floor((y + d / 2 - 1) / 16);
      cy++
    )
      for (
        let cx = Math.floor((x - w / 2) / 16);
        cx <= Math.floor((x + w / 2 - 1) / 16);
        cx++
      )
        rows[cy][cx] = "c";
  const legend = { "#": 1, "|": 2, c: 3, G: 4 };
  level.buildings.forEach(
    (b, i) => (legend[String.fromCharCode(107 + i)] = i + 10),
  );
  return new MapClass({
    rows: rows.map((r) => r.join("")),
    legend,
    types,
    ao: 0,
    floorTex(x, y) {
      const cx = Math.floor(x / 16),
        cy = Math.floor(y / 16),
        fine = (Math.floor(x) * 17 + Math.floor(y) * 31) % 13;
      const sidewalk = cx < 10 || cy > 38 || (cx > 34 && cy < 26);
      const seam =
        sidewalk && (Math.floor(x) % 16 === 0 || Math.floor(y) % 16 === 0);
      const lane =
        (Math.abs(y - 552) < 1.5 && cx % 5 < 3 && x > 320 && x < 800) ||
        (Math.abs(x - 496) < 1.5 && cy % 5 < 3 && y > 200 && y < 480);
      if (lane) return [78, 88, 85];
      if (seam) return [21, 30, 40];
      const k = sidewalk ? 6 : 0;
      return [27 + k + fine * 0.3, 38 + k + fine * 0.45, 49 + k + fine * 0.55];
    },
  });
}

export const LEVELS = { lowlight: LOWLIGHT };
export function registerLevel(level) {
  if (!level?.id || LEVELS[level.id])
    throw new Error("Level id must be new and nonempty");
  for (const key of [
    "buildings",
    "interactables",
    "enemies",
    "props",
    "cover",
    "civilians",
    "zones",
    "objectives",
  ])
    if (!Array.isArray(level[key]))
      throw new Error("Missing level collection: " + key);
  for (const role of [
    "rook",
    "iris",
    "captive",
    "relay",
    "core",
    "exit",
    "cache",
  ])
    if (!level.interactables.some((i) => i.id === role))
      throw new Error("Heist level needs role: " + role);
  if (!level.enemies.some((e) => e.kind === "boss"))
    throw new Error("Heist level needs a Warden archetype");
  LEVELS[level.id] = level;
  return level;
}
