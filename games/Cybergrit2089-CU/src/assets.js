export function registerAssets(E) {
  // Adapted from the engine's core box, barrel, table and lamppost construction vocabulary.
  Object.assign(E.MATERIALS, {
    cgSteel: { color: "#273447", pattern: "metal" },
    cgEdge: { color: "#667b8c", pattern: "none" },
    cgDark: { color: "#141f30", pattern: "none" },
    cgGlass: { color: "#174557", pattern: "glaze" },
    cgTeal: { color: "#66f5d2", pattern: "none", glow: 1 },
    cgPink: { color: "#ed73ac", pattern: "none", glow: 1 },
    cgGold: { color: "#edb573", pattern: "none", glow: 0.7 },
    cgRubber: { color: "#131924", pattern: "none" },
  });
  Object.assign(E.SHAPES, {
    "cg:terminal": {
      about: "Helix neural interface on an industrial plinth",
      mats: { m: "cgSteel", s: "cgTeal", d: "cgDark" },
      parts: [
        ["box", "m", [0, 0, 0], [13, 10, 16]],
        ["box", "d", [0, 0, 16], [18, 12, 15]],
        ["box", "s", [0, 6.2, 19], [14, 1, 9]],
        ["box", "m", [0, 9, 15], [19, 6, 2]],
        ["row", 4, [3, 0, 0], ["box", "s", [0, 10, 17], [1.5, 2, 1]]],
      ],
    },
    "cg:server": {
      about: "Memory bank with exposed vertical light strips",
      mats: { m: "cgSteel", s: "cgTeal", d: "cgDark" },
      parts: [
        ["box", "m", [0, 0, 0], [20, 16, 43]],
        ["box", "d", [0, 8.2, 4], [16, 1, 35]],
        ["row", 5, [0, 0, 6], ["box", "s", [0, 9, 20], [12, 1, 1]]],
        ["box", "s", [8.4, 0, 2], [1, 16, 39]],
      ],
    },
    "cg:vending": {
      about: "Pink drink vending machine with glass and lit buttons",
      mats: { m: "cgSteel", s: "cgPink", g: "cgGlass" },
      parts: [
        ["box", "m", [0, 0, 0], [17, 13, 34]],
        ["box", "s", [0, 7, 27], [17, 1, 6]],
        ["box", "g", [-2, 7, 8], [10, 1, 17]],
        ["row", 3, [0, 0, 4], ["box", "s", [6, 7.5, 16], [2, 1, 1]]],
        ["box", "m", [0, 8, 3], [12, 2, 3]],
      ],
    },
    "cg:stall": {
      about:
        "Afterhours street food counter with striped canopy and steam pots",
      mats: { m: "cgSteel", s: "cgGold", c: "cgPink", d: "cgDark" },
      parts: [
        ["box", "m", [0, 0, 0], [30, 16, 15]],
        ["box", "d", [0, 0, 15], [33, 19, 2]],
        ["mirror", "x", ["box", "m", [14, 0, 0], [1, 1, 38]]],
        ["box", "s", [0, 0, 37], [38, 25, 3]],
        ["row", 5, [6, 0, 0], ["box", "c", [0, 0, 40], [2, 25, 1]]],
        ["row", 3, [7, 0, 0], ["cyl", "m", [0, 0, 17], 2.7, 4]],
        ["box", "s", [0, 8.5, 6], [23, 1, 5]],
      ],
    },
    "cg:car": {
      about: "Lowlight electric sedan with low roof, hood and cyan headlights",
      mats: {
        m: "cgSteel",
        g: "cgGlass",
        s: "cgTeal",
        r: "cgRubber",
        p: "cgPink",
      },
      parts: [
        ["box", "m", [0, 0, 5], [23, 48, 10]],
        ["box", "g", [0, -2, 15], [20, 24, 11]],
        ["box", "m", [0, -2, 26], [22, 21, 2]],
        ["mirror", "x", ["box", "s", [8, 24.5, 10], [6, 1, 3]]],
        ["mirror", "x", ["box", "p", [8, -24.5, 10], [5, 1, 2]]],
        ["mirror", "xy", ["box", "r", [11, 15, 2], [5, 9, 8]]],
      ],
    },
    "cg:planter": {
      about: "Concrete street planter with low foliage",
      mats: { m: "cgSteel", f: "#346862 foliage" },
      parts: [
        ["box", "m", [0, 0, 0], [24, 14, 9]],
        ["box", "f", [0, 0, 9], [21, 11, 9]],
      ],
    },
    "cg:cover": {
      about: "Stacked reinforced cargo crates",
      mats: { m: "cgSteel", e: "cgEdge", s: "cgGold" },
      parts: [
        ["box", "m", [0, 0, 0], [24, 16, 19]],
        ["mirror", "x", ["box", "e", [9, 0, 0], [2, 17, 19]]],
        ["box", "s", [0, 8.5, 9], [9, 1, 2]],
      ],
    },
    "cg:relay": {
      about: "Security relay with an antenna and warning lights",
      mats: { m: "cgSteel", d: "cgDark", s: "cgPink" },
      parts: [
        ["box", "m", [0, 0, 0], [21, 17, 33]],
        ["box", "d", [0, 9, 3], [16, 1, 25]],
        ["row", 4, [0, 0, 5], ["box", "s", [0, 10, 14], [10, 1, 1]]],
        ["cyl", "m", [0, 0, 33], 1, 26],
        ["box", "s", [0, 0, 53], [15, 2, 2]],
        ["box", "s", [0, 0, 60], [7, 2, 1]],
      ],
    },
    "cg:core": {
      about: "Mnemosyne memory archive suspended in a magnetic cage",
      mats: { m: "cgSteel", s: "cgTeal", g: "cgGlass" },
      parts: [
        ["cyl", "m", [0, 0, 0], 17, 6, { seg: 6 }],
        ["cyl", "g", [0, 0, 7], 10, 30, { seg: 6 }],
        ["cyl", "s", [0, 0, 13], 4, 20, { seg: 6 }],
        ["ring", 4, 12, ["box", "m", [0, 0, 4], [2, 2, 39]]],
        ["cyl", "m", [0, 0, 43], 16, 4, { seg: 6 }],
        ["cyl", "s", [0, 0, 47], 11, 1, { seg: 6 }],
      ],
    },
  });
}

export function makeRig(E, kind, n = 0) {
  const pal = {
    player: {
      skin: "#d1a48f",
      hair: "#e5e7dd",
      cloth: "#2a384a",
      coat: "#34465a",
      pants: "#182332",
      boot: "#101826",
      trim: "#cefa64",
      glove: "#253c49",
      eye: "#b1ffec",
      metal: "#a8c8cd",
    },
    guard: {
      skin: "#bda18c",
      hair: "#302b36",
      cloth: "#654457",
      coat: "#654457",
      pants: "#242c41",
      plate: "#455368",
      trim: "#ef839d",
      boot: "#182235",
      eye: "#f75b8d",
      metal: "#6f899e",
    },
    boss: {
      skin: "#7d8a96",
      hair: "#293140",
      cloth: "#334753",
      coat: "#334753",
      pants: "#29313d",
      plate: "#536673",
      trim: "#e9ea8b",
      boot: "#192732",
      eye: "#ff9868",
      metal: "#b3d9c8",
    },
    rook: {
      skin: "#ba896d",
      hair: "#2c2135",
      cloth: "#54404e",
      coat: "#7b4c4c",
      pants: "#243044",
      trim: "#eea87d",
      boot: "#1c2434",
    },
    iris: {
      skin: "#d7af93",
      hair: "#64dabd",
      cloth: "#335b5d",
      coat: "#6d8b80",
      pants: "#213747",
      trim: "#b5f3d8",
      boot: "#23323c",
    },
    captive: {
      skin: "#bb8d79",
      hair: "#27323c",
      cloth: "#b9ada3",
      coat: "#a8b6b5",
      pants: "#42434f",
      trim: "#ed989e",
      boot: "#323b47",
    },
  };
  const colors = pal[kind] || {
    skin: "#b7a08f",
    hair: "#453148",
    cloth: ["#6e596b", "#3d6c75", "#b69c6c"][n % 3],
    pants: "#263447",
    boot: "#1b283a",
    trim: "#cbb3a5",
  };
  return new E.Humanoid({
    size: kind === "boss" ? 1.65 : 1.08,
    build: kind === "boss" ? "bulky" : "heroic",
    weapon: ["player", "guard", "boss"].includes(kind) ? "gun" : null,
    outfit: "coat",
    hair: kind === "iris" ? "ponytail" : kind === "player" ? "spiky" : "short",
    hat: kind === "guard" ? "helmet" : undefined,
    armor: kind === "boss" || kind === "guard",
    eyeGlow: kind === "player" || kind === "boss",
    sleeves: "long",
    colors,
  });
}
