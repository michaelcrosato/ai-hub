// Poringbound: The Amber Oath, on the shared 3D stack (three.js r186 WebGPURenderer + Rapier 0.20 via the kit).
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";
import { boot } from "kit/boot.js";
import { createPost } from "kit/post.js";
import { createWorld } from "kit/physics.js";
import yg from "./guide.js";

var fA = (C, A, g) => Math.min(g, Math.max(A, C)),
  Vg = (C, A, g) => C + (A - C) * g,
  yA = (C, A) => Math.hypot(C.x - A.x, C.z - A.z),
  Y2 = (C) =>
    String(C)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  Ac = (C) =>
    String(C)
      .toLowerCase()
      .replace(/\(mvp\)|\(.*?slot.*?\)/g, "")
      .replace(/[^a-z0-9]/g, ""),
  rw = (C, A = 0) => {
    let g = String(C)
      .replaceAll(",", "")
      .match(/[-+]?\d+(?:\.\d+)?/);
    return g ? +g[0] : A;
  },
  ic = (C) => {
    let A = 2166136261;
    for (let g of String(C)) A = Math.imul(A ^ g.charCodeAt(0), 16777619);
    return A >>> 0;
  };
function b2(C) {
  let A = C >>> 0;
  return () => {
    A += 1831565813;
    let g = A;
    return ((g = Math.imul(g ^ (g >>> 15), g | 1)), (g ^= g + Math.imul(g ^ (g >>> 7), g | 61)), ((g ^ (g >>> 14)) >>> 0) / 4294967296);
  };
}
var CA = (C) => String(C).replace(/[&<>"']/g, (A) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[A]),
  FC = (C) => Math.floor(C).toLocaleString("en-US");
function ji(C, A = Math.random) {
  return C[Math.floor(A() * C.length)];
}
var gF = (C) => JSON.parse(JSON.stringify(C));
function LI(C, A, g) {
  let I = (t) => parseInt(t.slice(1), 16),
    e = I(C),
    i = I(A);
  return (
    "#" +
    [16, 8, 0]
      .map((t) =>
        Math.round(Vg((e >> t) & 255, (i >> t) & 255, g))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function TN(C, A, g, I = 24, e = 0.8) {
  let i = Math.floor((I * 2) / e) + 1,
    t = (M) => fA(Math.round((M + I) / e), 0, i - 1),
    s = (M, N) =>
      M < 0 ||
      N < 0 ||
      M >= i ||
      N >= i ||
      g.some((p) => Math.abs(M * e - I - p.x) < p.w / 2 + 0.36 && Math.abs(N * e - I - p.z) < p.d / 2 + 0.36),
    o = t(A.x),
    B = t(A.z),
    Q = t(C.x),
    a = t(C.z);
  if (s(o, B)) {
    let M = !1;
    for (let N = 1; N < 8 && !M; N++)
      for (let p = -N; p <= N && !M; p++)
        for (let m = -N; m <= N; m++)
          if (!s(o + p, B + m)) {
            ((o += p), (B += m), (M = !0));
            break;
          }
    if (!M) return [];
  }
  let r = (M, N) => N * i + M,
    E = [r(Q, a)],
    n = new Map([[r(Q, a), 0]]),
    l = new Map(),
    c = new Set(),
    h = (M) => Math.hypot((M % i) - o, Math.floor(M / i) - B),
    u = -1,
    S = E[0];
  for (let M = 0; E.length && M < 5e3; M++) {
    let N = 0;
    for (let J = 1; J < E.length; J++) n.get(E[J]) + h(E[J]) < n.get(E[N]) + h(E[N]) && (N = J);
    let p = E.splice(N, 1)[0],
      m = p % i,
      f = Math.floor(p / i);
    if ((h(p) < h(S) && (S = p), m === o && f === B)) {
      u = p;
      break;
    }
    c.add(p);
    for (let [J, x] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      let O = m + J,
        V = f + x,
        P = r(O, V);
      if (s(O, V) || c.has(P) || (J && x && (s(m + J, f) || s(m, f + x)))) continue;
      let eA = n.get(p) + (J && x ? 1.414 : 1);
      eA < (n.get(P) ?? 1 / 0) && (n.set(P, eA), l.set(P, p), E.includes(P) || E.push(P));
    }
  }
  u < 0 && (u = S);
  let w = [],
    k = 0;
  for (; l.has(u) && k++ < 5e3; ) (w.push({ x: (u % i) * e - I, z: Math.floor(u / i) * e - I }), (u = l.get(u)));
  return w.reverse();
}
var dr = { title: "Poringbound", subtitle: "The Amber Oath", date: "2026-09-26", model: "GPT-6 Astra Pro", saveVersion: 3 },
  gc = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"],
  Qg = {
    Novice: {
      color: "#bf895d",
      role: "A little courage goes a long way.",
      city: "training",
      weapon: "Knife",
      parent: null,
      skills: ["First Aid", "Play Dead"],
    },
    Swordsman: {
      color: "#cf6557",
      role: "Stand your ground. Bash, endure, and lead the charge.",
      city: "izlude",
      weapon: "Sword",
      parent: "Novice",
      skills: ["Bash", "Magnum Break", "Provoke", "Endure"],
    },
    Thief: {
      color: "#9677bb",
      role: "Strike quickly. Steal a little. Disappear before trouble.",
      city: "morroc",
      weapon: "Cutter",
      parent: "Novice",
      skills: ["Envenom", "Steal", "Hide", "Back Slide"],
    },
    Archer: {
      color: "#70a070",
      role: "Keep your distance. Every arrow is a decision.",
      city: "archer-village",
      weapon: "Bow",
      parent: "Novice",
      skills: ["Double Strafing", "Arrow Shower", "Attention Concentrate", "Arrow Repel"],
    },
    Magician: {
      color: "#769cce",
      role: "Choose the element. Find time to finish your spell.",
      city: "geffen",
      weapon: "Rod",
      parent: "Novice",
      skills: ["Fire Bolt", "Cold Bolt", "Lightning Bolt", "Fire Wall"],
    },
    Acolyte: {
      color: "#e6bd69",
      role: "Heal your companions. Bring light to the restless dead.",
      city: "prontera",
      weapon: "Club",
      parent: "Novice",
      skills: ["Heal", "Blessing", "Holy Light", "Increase AGI"],
    },
    Merchant: {
      color: "#d39853",
      role: "Turn a humble cart into an extraordinary living.",
      city: "alberta",
      weapon: "Axe",
      parent: "Novice",
      skills: ["Mammonite", "Cart Revolution", "Crazy Uproar", "Vending"],
    },
    Knight: {
      color: "#cd6257",
      city: "prontera",
      parent: "Swordsman",
      weapon: "Katana",
      skills: ["Bash", "Bowling Bash", "Two-Hand Quicken", "Spear Boomerang"],
    },
    Crusader: {
      color: "#dbad55",
      city: "prontera",
      parent: "Swordsman",
      weapon: "Spear",
      skills: ["Holy Cross", "Grand Cross", "Guard", "Heal"],
    },
    Assassin: {
      color: "#8266a5",
      city: "morroc",
      parent: "Thief",
      weapon: "Jur",
      skills: ["Sonic Blow", "Grim Tooth", "Cloaking", "Enchant Poison"],
    },
    Rogue: {
      color: "#a37777",
      city: "comodo",
      parent: "Thief",
      weapon: "Gladius",
      skills: ["Back Stab", "Steal", "Stalk", "Sightless Mind"],
    },
    Hunter: {
      color: "#68966a",
      city: "archer-village",
      parent: "Archer",
      weapon: "Crossbow",
      skills: ["Double Strafing", "Blitz Beat", "Ankles Snare", "Arrow Shower"],
    },
    Bard: {
      color: "#829983",
      city: "comodo",
      parent: "Archer",
      weapon: "Violin",
      skills: ["Melody Strike", "Impressive Riff", "Song of Lutie", "Unbarring Octave"],
    },
    Dancer: {
      color: "#ca85a2",
      city: "comodo",
      parent: "Archer",
      weapon: "Rope",
      skills: ["Slinging Arrow", "Slow Grace", "Lady Luck", "Dazzler"],
    },
    Wizard: {
      color: "#718bbc",
      city: "geffen",
      parent: "Magician",
      weapon: "Staff",
      skills: ["Fire Bolt", "Storm Gust", "Jupitel Thunder", "Meteor Storm"],
    },
    Sage: {
      color: "#9980b9",
      city: "juno",
      parent: "Magician",
      weapon: "Book",
      skills: ["Fire Bolt", "Frost Diver", "Lightning Bolt", "Endow Blaze"],
    },
    Priest: {
      color: "#d7b25f",
      city: "prontera",
      parent: "Acolyte",
      weapon: "Wand",
      skills: ["Heal", "Magnus Exorcismus", "Kyrie Eleison", "Lex Aeterna"],
    },
    Monk: {
      color: "#c59151",
      city: "monastery",
      parent: "Acolyte",
      weapon: "Hora",
      skills: ["Summon Spirit Sphere", "Fury", "Occult Impaction", "Guillotine Fist (aka Asura Strike)"],
    },
    Blacksmith: {
      color: "#bc784e",
      city: "geffen",
      parent: "Merchant",
      weapon: "Chain",
      skills: ["Cart Revolution", "Hammer Fall", "Adrenaline Rush", "Weapon Perfection"],
    },
    Alchemist: {
      color: "#80a493",
      city: "al-de-baren",
      parent: "Merchant",
      weapon: "Axe",
      skills: ["Aid Potion (aka Potion Pitcher)", "Acid Terror", "Bomb", "Summon Flora"],
    },
  },
  BAA = Object.keys(Qg).filter((C) => Qg[C].parent === "Novice"),
  fC = (C) => (Qg[C]?.parent === "Novice" ? C : Qg[C]?.parent || "Novice"),
  QAA = {
    leatherjacket: "jacket",
    flash: "flasharrow",
    pharcon: "phracon",
    emveratarcon: "emveretarcon",
    emvertacon: "emveretarcon",
    emveretacon: "emveretarcon",
    familiar: "farmiliar",
    drianliar: "drainliar",
    goldenthiefbug: "goldthiefbug",
    doppleganger: "doppelganger",
    bathoroy: "bathory",
    eggyra: "eggrya",
    skeletonsoldier: "soldierskeleton",
    skelbone: "skel-bone",
    swordfish: "swordfish",
    roughaluminum: "roughelunium",
    rougheluminum: "roughelunium",
    roughoridecon: "roughoridecon",
    mysticfrozen: "misticfrozen",
    windofverdue: "windofverdure",
    garm: "hatii",
    hati: "hatii",
    skeletonarcher: "archerskeleton",
    "e-petit": "earthpetit",
    epetit: "earthpetit",
    spetit: "skypetit",
    savagebebe: "savagebabe",
    "baby-desert-wolf": "desertwolfpuppy",
    babydesertwolf: "desertwolfpuppy",
    monsterfeed: "monsterfeed",
    magnifyingglass: "magnifier",
    baphometjr: "baphometjr",
    moonlightflower: "moonlightflower",
    swordmace: "swordmace",
    guillotinefist: "guillotinefistakaasurastrike",
  },
  Vi = (C) => {
    let A = Ac(C);
    return QAA[A] || A;
  },
  Rs = new Map(),
  Sr = new Map(),
  aAA = new Map();
for (let C of yg.items) {
  let A = C.type === "Arrow" ? { ...C, kind: "material", ammunition: !0 } : C;
  (Rs.set(A.id, A), Rs.set(Vi(A.name), A));
}
for (let C of yg.monsters) (Sr.set(C.id, C), Sr.set(Vi(C.name), C));
for (let C of yg.skills) aAA.set(C.id, C);
function rA(C) {
  let A = Rs.get(C) || Rs.get(Vi(C));
  if (A) return A;
  let g = String(C).trim().replace(/s$/, ""),
    I = Rs.get(Vi(g));
  if (I) return I;
  let e = {
    id: Y2(C),
    name: String(C),
    kind: "material",
    description: "Referenced by the guide; testing-build value inferred.",
    weight: 1,
    buy: 30,
    sell: 6,
    type: "material",
    atk: 0,
    def: 0,
    weaponLevel: 1,
    source: [],
    inferred: !0,
  };
  return (Rs.set(e.id, e), Rs.set(Vi(C), e), e);
}
function Ae(C) {
  let A = Sr.get(C) || Sr.get(Vi(C));
  if (A) return A;
  let g = {
    id: Y2(C),
    name: C.replace(/\s*\(MVP\)/, "").trim(),
    hp: 300,
    atk: 25,
    def: 3,
    mdef: 0,
    baseXP: 50,
    jobXP: 35,
    element: "Neutral 1",
    size: "Medium",
    species: "Brute",
    drops: ["Jellopy", "Red Herb"],
    aggressive: !1,
    assist: !1,
    looter: !1,
    magicSense: !1,
    recommended: 12,
    boss: /MVP/.test(C),
    source: [],
    inferred: !0,
  };
  return (Sr.set(g.id, g), Sr.set(Vi(C), g), g);
}
var x2 = () => [...new Map([...Rs.values()].map((C) => [C.id, C])).values()];
function Ew(C) {
  let A = [C, fC(C), "Novice"];
  return ((C === "Bard" || C === "Dancer") && A.push("Ensemble"), yg.skills.filter((g) => A.includes(g.class)));
}
function Us(C, A) {
  return Ew(C).find((g) => Vi(g.name) === Vi(A)) || yg.skills.find((g) => Vi(g.name) === Vi(A));
}
function HN(C) {
  if (C.kind === "weapon") return "weapon";
  let A = (C.type + " " + (C.raw?.Type || "") + " " + C.name).toLowerCase();
  return /shield|guard|buckler/.test(A)
    ? "shield"
    : /accessory|ring|brooch|clip|necklace|glove|rosary|belt/.test(A)
      ? "accessory"
      : /foot|shoe|sandal|boot/.test(A)
        ? "shoes"
        : /garment|manteau|muffler|hood/.test(A)
          ? "garment"
          : /head|helm|hat|cap|band|mask|muff|bonnet|sakkat|crown|tiara|ribbon|goggle|blinker|antler/.test(A)
            ? "head"
            : "armor";
}
function vN(C) {
  let A = C.toLowerCase();
  return /fire|magnum|meteor|bomb|blaze/.test(A)
    ? "Fire"
    : /cold|frost|ice|storm gust|water|tsunami/.test(A)
      ? "Water"
      : /lightning|thunder|vermilion|tornado/.test(A)
        ? "Wind"
        : /earth|heaven|sand attack|quake/.test(A)
          ? "Earth"
          : /holy|heal|cross|exorc|undead/.test(A)
            ? "Holy"
            : /poison|venom/.test(A)
              ? "Poison"
              : /napalm|soul/.test(A)
                ? "Ghost"
                : "Neutral";
}
var WN = {
    meadow: {
      ground: "#8eb88b",
      edge: "#5e7961",
      path: "#d6d0b3",
      roof: "#b7624b",
      wall: "#eee1bd",
      leaf: "#638963",
      water: "#6bacb4",
      sky: "#dce8dc",
      accent: "#f3c678",
    },
    coast: {
      ground: "#a5b7a0",
      edge: "#789a91",
      path: "#dfd8bf",
      roof: "#688da4",
      wall: "#f1e6c9",
      leaf: "#6d9c7d",
      water: "#68a6bd",
      sky: "#daeaf0",
      accent: "#94d4e2",
    },
    desert: {
      ground: "#dbbf84",
      edge: "#b49763",
      path: "#ead3a1",
      roof: "#b67e60",
      wall: "#efd8a4",
      leaf: "#7c9e72",
      water: "#71aaad",
      sky: "#f0e3c9",
      accent: "#ffc877",
    },
    forest: {
      ground: "#749173",
      edge: "#4d6953",
      path: "#c2b195",
      roof: "#886259",
      wall: "#dcbf90",
      leaf: "#537257",
      water: "#679590",
      sky: "#d8e4d5",
      accent: "#edc683",
    },
    magic: {
      ground: "#91a399",
      edge: "#596f76",
      path: "#ddd3c6",
      roof: "#9182a3",
      wall: "#e6dcd0",
      leaf: "#687f78",
      water: "#85adc4",
      sky: "#e4e2ed",
      accent: "#bba1ef",
    },
    snow: {
      ground: "#d6e3df",
      edge: "#94aba8",
      path: "#b4cbc8",
      roof: "#bc7167",
      wall: "#f5e7cd",
      leaf: "#698d83",
      water: "#84aebc",
      sky: "#e5eeee",
      accent: "#d4edf1",
    },
    dungeon: {
      ground: "#727d7e",
      edge: "#4a5358",
      path: "#929c99",
      roof: "#605f77",
      wall: "#a9aaa0",
      leaf: "#626f62",
      water: "#57858c",
      sky: "#a8b8bc",
      accent: "#baabeb",
    },
    castle: {
      ground: "#69737c",
      edge: "#404b57",
      path: "#a7aaa3",
      roof: "#6e657d",
      wall: "#c7c5b1",
      leaf: "#60736c",
      water: "#638393",
      sky: "#b8c5c9",
      accent: "#e8bf65",
    },
  },
  Js = [
    { id: "training", name: "Novice Training Grounds", theme: "meadow", tag: "Your first little adventure", pos: [0, 0] },
    { id: "prontera", name: "Prontera", theme: "meadow", tag: "The heart of Rune-Midgard", pos: [56, 41] },
    { id: "izlude", name: "Izlude", theme: "coast", tag: "The island of swords", pos: [71, 49] },
    { id: "morroc", name: "Morroc", theme: "desert", tag: "Footprints in golden sand", pos: [39, 70] },
    { id: "geffen", name: "Geffen", theme: "magic", tag: "Where wonder takes root", pos: [31, 33] },
    { id: "payon", name: "Payon", theme: "forest", tag: "A quiet village beneath the trees", pos: [76, 70] },
    { id: "archer-village", name: "Archer Village", theme: "forest", tag: "Listen for the whisper of an arrow", pos: [76, 62] },
    { id: "alberta", name: "Alberta", theme: "coast", tag: "Every ship carries a story", pos: [88, 86] },
    { id: "al-de-baren", name: "Al De Baren", theme: "magic", tag: "The city that keeps time", pos: [56, 21] },
    { id: "juno", name: "Juno", theme: "magic", tag: "Wisdom above the clouds", pos: [56, 6] },
    { id: "comodo", name: "Comodo", theme: "coast", tag: "Where the tide meets the music", pos: [9, 70] },
    { id: "lutie", name: "Lutie", theme: "snow", tag: "A pocketful of winter wishes", pos: [76, 16] },
    { id: "monastery", name: "Monastery", theme: "forest", tag: "A path of patience", pos: [90, 37] },
  ],
  ur = [
    {
      key: "courage",
      name: "Courage",
      city: "prontera",
      area: "culvert-level-4",
      boss: "Gold Thief Bug",
      hint: "Beneath Prontera, golden wings disturb the water.",
    },
    {
      key: "tides",
      name: "Tides",
      city: "izlude",
      area: "bibilan-island-level-5",
      boss: "Deviace",
      hint: "At the bottom of Bibilan, the sea remembers.",
    },
    {
      key: "memory",
      name: "Memory",
      city: "payon",
      area: "payon-dungeon-level-5",
      boss: "Moonlight Flower",
      hint: "Follow the lanterns into Payon\u2019s oldest dream.",
    },
    {
      key: "wonder",
      name: "Wonder",
      city: "geffen",
      area: "geffen-dungeon-level-3",
      boss: "Doppleganger",
      hint: "A familiar shadow waits beneath Geffen Tower.",
    },
    {
      key: "sun",
      name: "Sun",
      city: "morroc",
      area: "pyramid-level-4",
      boss: "Osiris",
      hint: "The fourth chamber still keeps the desert\u2019s oath.",
    },
    {
      key: "horizon",
      name: "Horizon",
      city: "alberta",
      area: "sunken-ship-level-1",
      boss: "Drake",
      hint: "A captain will not abandon a ship, even now.",
    },
  ];
function rAA(C) {
  let A = C.toLowerCase();
  return /bibilan/.test(A)
    ? "izlude"
    : /pyramid|sphinx|ant hell/.test(A)
      ? "morroc"
      : /payon/.test(A)
        ? "payon"
        : /geffen|ghast|orc/.test(A)
          ? "geffen"
          : /sunken|turtle/.test(A)
            ? "alberta"
            : /toy/.test(A)
              ? "lutie"
              : /clock|coal|magma/.test(A)
                ? "al-de-baren"
                : "prontera";
}
var SI = new Map();
for (let C of Js)
  SI.set(C.id, {
    ...C,
    kind: C.id === "training" ? "training" : "city",
    recommended: 1,
    monsters: [],
    source: C.id === "training" ? [790, 810] : [8233, 8262],
  });
for (let C of yg.fields) {
  let A =
      C.number < 5
        ? "juno"
        : C.number === 83
          ? "lutie"
          : C.number < 12
            ? "al-de-baren"
            : C.number < 32
              ? "geffen"
              : C.number < 44
                ? "prontera"
                : C.number < 61
                  ? "morroc"
                  : C.number < 65
                    ? "payon"
                    : C.number < 74
                      ? "comodo"
                      : "alberta",
    g = Js.find((I) => I.id === A).theme;
  SI.set(C.id, {
    ...C,
    kind: "field",
    city: A,
    theme: g,
    tag: "Open country \u2022 explore at your own pace",
    recommended: Math.max(
      1,
      Math.round(C.monsters.reduce((I, e) => I + Math.min(80, Ae(e).recommended), 0) / Math.max(1, C.monsters.length) / 3),
    ),
  });
}
for (let C of yg.dungeons) {
  let A = rAA(C.name),
    g = /pyramid|sphinx|ant/.test(C.id)
      ? "desert"
      : /bibilan|sunken/.test(C.id)
        ? "coast"
        : /toy/.test(C.id)
          ? "snow"
          : /ghast/.test(C.id)
            ? "castle"
            : "dungeon";
  SI.set(C.id, {
    ...C,
    guideRecommended: C.recommended,
    recommended: Math.max(4, Math.round(C.recommended / 3)),
    city: A,
    theme: g,
    kind: "dungeon",
    tag: "An expedition into the unknown",
  });
}
for (let [C, A, g, I, e, i] of [
  ["hidden-temple", "Hidden Temple", "prontera", "forest", ["Baphomet Jr.", "Sidewinder", "Hunter Fly", "Rocker"], 22],
  ["magma-dungeon", "Magma Dungeon", "juno", "desert", ["Deleter", "Blazer", "Lava Golem"], 25],
  ["turtle-island", "Turtle Island", "alberta", "forest", ["Spring Rabbit", "Dragon Tail", "Turtle General"], 27],
  ["ember-castle", "Emperium Castle", "prontera", "castle", ["Reydric", "Abysmal Knight", "Baphomet"], 30],
])
  SI.set(C, {
    id: C,
    name: A,
    city: g,
    theme: I,
    monsters: e,
    recommended: i,
    kind: "dungeon",
    source: C === "ember-castle" ? [] : [8233, 8262],
    tag: C === "ember-castle" ? "The Amber Oath \u2022 final chapter" : "Guide landmark \u2022 inferred interior",
  });
var K2 = (C) => [...SI.values()].filter((A) => A.city === C),
  zi = (C) => SI.get(C)?.name || C,
  Ls = {
    Swordsman: {
      city: "izlude",
      fee: 0,
      steps: [{ type: "trial", trial: "ledges", text: "Cross three narrow training ledges. Avoid the gaps." }],
    },
    Thief: {
      city: "morroc",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [["Gooey Mushroom", 25]],
          trial: "mushrooms",
          text: "Collect 25 mushroom points in the guild\u2019s practice grove. Net Mushrooms count as 3.",
        },
      ],
    },
    Archer: {
      city: "archer-village",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [["Trunk", 4]],
          text: "Bring 25 points in trunks. Trunk 7 \u2022 Fine-grained 5 \u2022 Solid 3 \u2022 Barren 1.",
        },
      ],
    },
    Magician: {
      city: "geffen",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [
            ["Jellopy", 3],
            ["Milk", 1],
            ["Empty Bottle", 1],
          ],
          text: "Prepare the guild solution: 3 Jellopy, Milk, and an Empty Bottle. The guide omits the formula; this is a test-build recipe.",
        },
      ],
    },
    Acolyte: {
      city: "prontera",
      fee: 0,
      steps: [{ type: "visit", area: "monastery", text: "Make a pilgrimage to the Monastery. Speak to the Hermit and return." }],
    },
    Merchant: {
      city: "alberta",
      fee: 3e3,
      steps: [{ type: "delivery", area: "izlude", text: "Deliver package 2468 to the Izlude Quartermaster. Bring the receipt back." }],
    },
    Knight: {
      city: "prontera",
      fee: 2500,
      steps: [
        {
          type: "quiz",
          question: "What keeps a party alive?",
          choices: ["Protect the healer", "Attack every monster at once", "Leave everyone behind"],
          answer: 0,
          text: "Speak your oath to the Chivalry.",
        },
      ],
    },
    Crusader: {
      city: "prontera",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [
            ["Horrendous Mouth", 10],
            ["Rotten Bandage", 10],
            ["Lantern", 10],
            ["Jakk o Pumpkin", 10],
          ],
          text: "Bring the first of the guide\u2019s three material sets.",
        },
        { type: "collect", needs: [["Rosary", 1]], text: "Equip yourself for a patient walk: bring a Rosary." },
        { type: "trial", trial: "endure", text: "Endure the corridor. Reach the light without attacking." },
        {
          type: "quiz",
          question: "What is the first duty of a shield?",
          choices: ["To protect", "To glitter", "To weigh the most"],
          answer: 0,
          text: "Answer the church examination.",
        },
        { type: "trial", trial: "battle", text: "Defeat four undead in the final chamber." },
      ],
    },
    Assassin: {
      city: "morroc",
      fee: 666,
      steps: [
        {
          type: "quiz",
          question: "When surrounded, a Thief should\u2026",
          choices: ["Hide and reposition", "Provoke everything", "Stand still"],
          answer: 0,
          text: "Pay the guild\u2019s fee and take the oath.",
        },
      ],
    },
    Rogue: {
      city: "comodo",
      fee: 1e4,
      steps: [
        {
          type: "quiz",
          question: "Where is a safe escape?",
          choices: ["The lighthouse", "The deepest dungeon", "Inside a crowd of monsters"],
          answer: 0,
          text: "Answer Maki\u2019s quiz.",
        },
        { type: "visit", area: "morroc", text: "Follow Semaslato\u2019s clue to the Morroc Quartermaster." },
        { type: "trial", trial: "endure", text: "Run the gauntlet without attacking. Return to Maki." },
      ],
    },
    Hunter: {
      city: "archer-village",
      fee: 0,
      steps: [
        {
          type: "quiz",
          question: "A monster belongs to another hunter. You\u2026",
          choices: ["Find a different target", "Take their kill", "Take the loot"],
          answer: 0,
          text: "Answer the senior hunter.",
        },
        {
          type: "collect",
          needs: [
            ["Feather", 5],
            ["Trunk", 3],
          ],
          text: "Bring 5 Feathers and 3 Trunks. This set fills an unspecified guide requirement.",
        },
        { type: "trial", trial: "selective", text: "Defeat only the four Job Change Monsters. Do not hit a Poring." },
      ],
    },
    Bard: {
      city: "comodo",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [["Flower", 1]],
          text: "Bring a flower to the Wandering Bard. The requested item is unspecified in the guide.",
        },
        { type: "visit", area: "lutie", text: "Visit Lutie. Speak with the Snow Man to finish his tale." },
        {
          type: "quiz",
          question: "Complete the refrain: A little light, a little\u2026",
          choices: ["wonder", "zeny", "thunder"],
          answer: 0,
          text: "Sing the travelling refrain. (Original test-build verse.)",
        },
      ],
    },
    Dancer: {
      city: "comodo",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [
            ["Feather", 5],
            ["Red Potion", 2],
          ],
          text: "Bring 5 Feathers and 2 Red Potions. The guide\u2019s item set is unspecified.",
        },
        {
          type: "quiz",
          question: "When should a dance stop?",
          choices: ["When a friend needs help", "Never", "Only at sunrise"],
          answer: 0,
          text: "Take the theatre quiz.",
        },
        { type: "trial", trial: "dance", text: "Follow the four floor markers in order." },
      ],
    },
    Wizard: {
      city: "geffen",
      fee: 0,
      steps: [{ type: "visit", area: "geffen", text: "Speak to the Tower Master at Geffen\u2019s north end." }],
    },
    Sage: {
      city: "juno",
      fee: 0,
      steps: [
        {
          type: "quiz",
          question: "A frozen foe is weak against\u2026",
          choices: ["Wind", "Water", "Neutral"],
          answer: 0,
          text: "Pass the Juno academy examination.",
        },
      ],
    },
    Priest: {
      city: "prontera",
      fee: 0,
      steps: [
        {
          type: "quiz",
          question: "An injured stranger asks politely. You\u2026",
          choices: ["Offer a heal", "Demand all their zeny", "Walk away"],
          answer: 0,
          text: "Answer the church\u2019s questions.",
        },
        { type: "trial", trial: "endure", text: "Pass the hall of temptations without attacking." },
        { type: "trial", trial: "battle", text: "Release the undead from the final chamber." },
      ],
    },
    Monk: {
      city: "monastery",
      fee: 0,
      steps: [
        {
          type: "collect",
          needs: [
            ["Jellopy", 10],
            ["Clover", 10],
          ],
          text: "Bring the abbey\u2019s training materials. The guide leaves the set random and unspecified.",
        },
        {
          type: "quiz",
          question: "Complete the verse: Quiet hands, a steady\u2026",
          choices: ["heart", "cart", "dart"],
          answer: 0,
          text: "Recite the abbey verse. (Original test-build verse.)",
        },
        { type: "trial", trial: "ledges", text: "Choose the running trial and follow the path." },
        { type: "trial", trial: "maze", text: "Find your way through the walls, then drink the ritual potion." },
      ],
    },
    Blacksmith: {
      city: "geffen",
      fee: 0,
      steps: [
        {
          type: "quiz",
          question: "Steel is forged from\u2026",
          choices: ["5 Iron and 1 Coal", "5 Coal and 1 Iron", "Jellopy alone"],
          answer: 0,
          text: "Meet the master smith in Geffen.",
        },
      ],
    },
    Alchemist: {
      city: "al-de-baren",
      fee: 5e4,
      steps: [
        {
          type: "collect",
          needs: [
            ["Jellopy", 20],
            ["Iron", 5],
          ],
          text: "Bring the laboratory\u2019s material set (inferred). Old Magic Scroll + Hammer of Blacksmith also accepted.",
        },
        {
          type: "quiz",
          question: "320 \xD7 164 = ?",
          choices: ["52,480", "52,840", "54,280"],
          answer: 0,
          text: "Complete the mathematical examination.",
        },
        {
          type: "collect",
          needs: [
            ["Red Herb", 1],
            ["Yellow Herb", 1],
            ["White Herb", 1],
            ["Empty Bottle", 3],
            ["Medicine Bowl", 3],
          ],
          text: "Crush the herbs, not Darsia\u2019s foot.",
        },
        { type: "visit", area: "geffen", text: "Speak with Geffen\u2019s dyestuff scientist." },
        {
          type: "collect",
          needs: [
            ["Coal", 5],
            ["Mini Furnace", 5],
          ],
          text: "Prepare the brothers\u2019 machine.",
        },
        { type: "visit", area: "juno", text: "Take the supplied ores to the Juno brothers. Return to the guild." },
      ],
    },
  },
  pB = [
    {
      id: "first-aid",
      title: "A small kindness",
      city: "prontera",
      skill: "First Aid",
      class: "Novice",
      needs: [
        ["Clover", 3],
        ["Red Herb", 3],
      ],
      text: "The nurse has clean gauze ready. Bring three Clovers and three Red Herbs to learn First Aid.",
      source: [858, 870],
    },
    {
      id: "play-dead",
      title: "A very convincing nap",
      city: "prontera",
      skill: "Play Dead",
      class: "Novice",
      needs: [],
      text: "The Chivalry has obtained a Novice Card from the nurse. Practice the art of playing dead.",
      source: [877, 891],
    },
    {
      id: "juice",
      title: "Something sweeter",
      city: "prontera",
      needs: [["Meat", 1]],
      text: "Show the boy a piece of Meat, but keep it. His mother will introduce the Payon juice maker.",
      source: [9367, 9380],
    },
    {
      id: "dye",
      title: "A different shade of you",
      city: "alberta",
      needs: [["Alcohol", 1]],
      text: "Show the sea-side researcher your ingredients. Then Geffen\u2019s scientist can prepare mixtures and counteragents.",
      source: [9435, 9450],
    },
    {
      id: "bunny",
      title: "Ears to the wind",
      city: "prontera",
      needs: [
        ["Kitty Band", 1],
        ["Feather", 100],
        ["Pearl", 1],
        ["4 Leaf Clover", 1],
      ],
      reward: "Bunny Band",
      text: "A familiar recipe. A rather extraordinary hat.",
      source: [9577, 9586],
    },
  ];
for (let C of yg.questSkills) {
  if (pB.some((I) => I.skill === C.name)) continue;
  let A = [],
    g = C.instructions.split(/\. (?:Then|Go|Head|Talk|First)/)[0];
  for (let I of g.matchAll(/(\d+)\s+([A-Z][A-Za-z' -]+?)(?=,| and |\.|$)/g)) {
    let e = I[2].trim();
    (e.endsWith("s") && !rA(e).source?.length && (e = e.slice(0, -1)), A.push([e, +I[1]]));
  }
  pB.push({
    id: "quest-" + C.id,
    title: C.name,
    skill: C.name,
    class: C.class,
    city: Qg[C.class]?.city || "prontera",
    needs: A,
    text: C.instructions,
    source: C.source,
  });
}
var EAA = {
  "First Aid": [
    5,
    [
      ["Clover", 3],
      ["Red Herb", 3],
    ],
  ],
  "Play Dead": [7, []],
  "Auto Berserk": [
    30,
    [
      ["Powder of Butterfly", 35],
      ["Honey", 10],
      ["Horrendous Mouth", 10],
      ["Decayed Nail", 10],
    ],
  ],
  "Fatal Blow": [
    30,
    [
      ["Fire Arrow", 10],
      ["Silver Arrow", 10],
      ["Banana Juice", 10],
      ["Tentacle", 30],
      ["Royal Jelly", 5],
    ],
  ],
  "Walking HP Recovery": [
    35,
    [
      ["Empty Bottle", 500],
      ["Padded Armor", 1],
      ["Rocker Doll", 1],
    ],
  ],
  "Back Slide": [35, [["Grasshopper Leg", 20]]],
  "Find Stone": [
    20,
    [
      ["Bear's Footskin", 1],
      ["Zargon", 1],
      ["Spawn", 5],
    ],
  ],
  "Stone Fling": [
    20,
    [
      ["Garlet", 2],
      ["Scell", 2],
    ],
  ],
  "Sand Attack": [
    25,
    [
      ["Fine Grit", 5],
      ["Cobweb", 1],
      ["Snail's Shell", 1],
      ["Cactus Needle", 1],
      ["Earthworm Peeling", 1],
    ],
  ],
  "Arrow Crafting": [
    30,
    [
      ["Red Potion", 1],
      ["Resin", 20],
      ["Trunk", 13],
      ["Tough Scalelike Stem", 41],
      ["Mushroom Spore", 7],
    ],
  ],
  "Arrow Repel": [
    35,
    [
      ["Crossbow", 1],
      ["Tentacle", 10],
      ["Bill of Birds", 10],
      ["Yoyo Tail", 3],
      ["Emerald", 2],
      ["Banana Juice", 36],
    ],
  ],
  "Energy Coat": [
    35,
    [
      ["Glass Bead", 3],
      ["1 Karat Diamond", 1],
      ["Shell", 5],
      ["Solid Shell", 1],
    ],
  ],
  "Holy Light": [
    30,
    [
      ["Opal", 1],
      ["Crystal Blue", 1],
      ["Rosary", 1],
    ],
  ],
  "Crazy Uproar": [
    15,
    [
      ["Pearl", 7],
      ["Mushroom Spore", 50],
      ["Banana Juice", 1],
    ],
  ],
  "Change Cart": [
    30,
    [
      ["Trunk", 50],
      ["Iron", 10],
      ["Animal Skin", 20],
    ],
  ],
  "Cart Revolution": [
    35,
    [
      ["Iron", 30],
      ["Sticky Mucus", 30],
      ["Fly Wing", 20],
      ["Tentacle", 5],
      ["Grape Juice", 2],
    ],
  ],
};
for (let C of pB) {
  let A = EAA[C.skill];
  A && ((C.minJob = A[0]), (C.needs = A[1]));
}
function U2(C) {
  let A = C.toLowerCase();
  return /fire/.test(A)
    ? "Fire"
    : /silver/.test(A)
      ? "Holy"
      : /wind/.test(A)
        ? "Wind"
        : /crystal|freezing/.test(A)
          ? "Water"
          : /stone/.test(A)
            ? "Earth"
            : /shadow/.test(A)
              ? "Dark"
              : /immaterial/.test(A)
                ? "Ghost"
                : /poison|rusty/.test(A)
                  ? "Poison"
                  : "Neutral";
}
var R2 = {
  id: "guild-trial",
  name: "Guild Proving Grounds",
  kind: "trial",
  theme: "magic",
  recommended: 1,
  monsters: [],
  source: [],
  tag: "A test of patience, not just power",
};
SI.set(R2.id, R2);
var uB = 1 / 60,
  PN = "poringbound.amber-oath.v3",
  ZN = (C, A = 0) => (Number.isFinite(+C) ? Math.max(0, +C) : A),
  zg = (C) => C.hp > 0,
  nAA = (C, A) => C === A;
var J2 = {
    Neutral: "N",
    Normal: "N",
    Water: "T",
    Earth: "E",
    Fire: "F",
    Wind: "W",
    Poison: "P",
    Holy: "H",
    Dark: "D",
    Shadow: "D",
    Ghost: "S",
    Spirit: "S",
    Undead: "U",
  },
  lAA = ["N", "T", "E", "F", "W", "P", "H", "D", "S", "U"];
function cAA(C, A) {
  let g = String(A).split(" "),
    I = fA(rw(g[1], 1), 1, 4),
    e = J2[C] || "N",
    i = lAA.indexOf(J2[g[0]] || "N");
  return yg.elements[String(I)]?.[e]?.[i] ?? 1;
}
function hAA(C, A) {
  let g = /small/i.test(A) ? 0 : /large/i.test(A) ? 2 : 1,
    I = C?.toLowerCase() || "";
  return (
    /knife|dagger/.test(I)
      ? [1, 0.75, 0.5]
      : /spear/.test(I)
        ? [0.75, 0.75, 1]
        : /axe/.test(I)
          ? [0.5, 0.75, 1]
          : /bow/.test(I)
            ? [1, 1, 0.75]
            : /sword/.test(I)
              ? [0.75, 1, 0.75]
              : [1, 1, 1]
  )[g];
}
function T2(C = "Aster", A = "#6989a6") {
  return {
    version: dr.saveVersion,
    name: String(C).trim().slice(0, 24) || "Aster",
    hair: A,
    job: "Novice",
    base: 1,
    jobLevel: 1,
    baseXP: 0,
    jobXP: 0,
    statPoints: 10,
    skillPoints: 0,
    stats: { STR: 7, AGI: 7, VIT: 5, INT: 5, DEX: 7, LUK: 3 },
    skills: {},
    hotbar: ["First Aid", "Play Dead", null, null],
    inventory: {},
    gear: [],
    equipped: {},
    storage: {},
    zeny: 100,
    area: "training",
    savePoint: "prontera",
    x: 0,
    z: 8,
    hp: 140,
    sp: 55,
    visited: ["training"],
    wards: [],
    sideDone: [],
    jobsDone: [],
    kills: {},
    seen: [],
    found: [],
    training: 0,
    trainingKills: 0,
    jobQuest: null,
    guild: null,
    donation: 0,
    ammo: "arrow",
    companion: "Mira",
    pet: !1,
    mount: !1,
    cart: !1,
    companionMode: "assist",
    playTime: 0,
    deaths: 0,
    totalKills: 0,
    totalZeny: 100,
    totalCrafts: 0,
    totalRefines: 0,
    finished: !1,
    endingTime: 0,
    bossesDefeated: [],
    bounty: null,
    bountyProgress: 0,
    storyStarted: !1,
    snowTalk: 0,
    seed: 26741,
  };
}
function H2(C) {
  let A = JSON.parse(C),
    g = A.state || A;
  if (g.version !== dr.saveVersion || !Qg[g.job] || !SI.has(g.area) || !g.stats || !g.inventory || !Array.isArray(g.gear))
    throw new Error("This is not a compatible Poringbound save.");
  if (A.checksum && A.checksum !== ic(JSON.stringify(g)).toString(16))
    throw new Error("The save checksum does not match. Your older save has not been changed.");
  for (let e of ["base", "jobLevel", "baseXP", "jobXP", "hp", "sp", "zeny", "x", "z", "statPoints", "skillPoints", "playTime"])
    if (!Number.isFinite(g[e])) throw new Error("The save contains an invalid " + e + ".");
  let I = { ...T2(), ...gF(g) };
  ((I.base = fA(I.base, 1, 99)),
    (I.jobLevel = fA(I.jobLevel, 1, I.job === "Novice" ? 10 : 50)),
    (I.x = fA(I.x, -23, 23)),
    (I.z = fA(I.z, -23, 23)));
  for (let e of gc) I.stats[e] = fA(rw(I.stats[e], 1), 1, 99);
  for (let [e, i] of Object.entries(I.inventory)) I.inventory[e] = Math.floor(fA(ZN(i), 0, 99999));
  if (I.gear.length > 1e3) throw new Error("The equipment list is too large.");
  for (let e of ["visited", "wards", "sideDone", "jobsDone", "seen", "found", "bossesDefeated", "hotbar"])
    if (!Array.isArray(I[e]) || I[e].some((i) => i !== null && typeof i != "string")) throw new Error("Invalid saved " + e + ".");
  typeof I.ammo != "string" && (I.ammo = "arrow");
  for (let e of ["storage", "skills", "equipped", "kills"])
    if (!I[e] || typeof I[e] != "object" || Array.isArray(I[e])) throw new Error("Invalid saved " + e + ".");
  for (let e of I.gear) {
    if (
      !e ||
      typeof e.id != "string" ||
      typeof e.item != "string" ||
      !["weapon", "armor"].includes(rA(e.item).kind) ||
      !Array.isArray(e.cards) ||
      e.cards.some((i) => typeof i != "string") ||
      !Number.isFinite(e.refine) ||
      !Number.isFinite(e.slots)
    )
      throw new Error("Invalid saved equipment.");
    ((e.refine = fA(Math.floor(e.refine), 0, 10)), (e.slots = fA(Math.floor(e.slots), 0, 4)), (e.cards = e.cards.slice(0, e.slots)));
  }
  if (
    I.jobQuest &&
    (!Ls[I.jobQuest.job] || !Number.isInteger(I.jobQuest.step) || I.jobQuest.step < 0 || I.jobQuest.step > Ls[I.jobQuest.job].steps.length)
  )
    throw new Error("Invalid saved job quest.");
  if (I.guild && (!Number.isFinite(I.guild.xp) || typeof I.guild.name != "string")) throw new Error("Invalid saved guild.");
  for (let e of ["zeny", "statPoints", "skillPoints", "baseXP", "jobXP", "playTime"]) I[e] = Math.max(0, I[e]);
  return ((I.name = String(I.name).slice(0, 24)), /^#[0-9a-f]{6}$/i.test(I.hair) || (I.hair = "#6989a6"), I);
}
function v2(C) {
  let A = gF(C);
  return JSON.stringify({ format: "Poringbound save", checksum: ic(JSON.stringify(A)).toString(16), state: A });
}
var Ic = class {
  constructor(A = null, g = null) {
    ((this.state = A ? gF(A) : T2()),
      (this.rng = g || b2(this.state.seed)),
      (this.events = []),
      (this.time = 0),
      (this.uid = 1),
      (this.enemies = []),
      (this.loot = []),
      (this.npcs = []),
      (this.portals = []),
      (this.obstacles = []),
      (this.path = []),
      (this.target = null),
      (this.interactTarget = null),
      (this.buffs = {}),
      (this.status = {}),
      (this.cooldowns = {}),
      (this.sitting = !1),
      (this.dead = !1),
      (this.cast = null),
      (this.traps = []),
      (this.summons = []),
      (this.telegraphs = []),
      (this.trial = null),
      (this.mover = null),
      (this.paused = !1),
      (this.sinceCombat = 20),
      (this.attackTimer = 0),
      (this.regenTimer = 0),
      (this.ambientTimer = 0),
      (this.potionTimer = 0),
      (this.companionTimer = 0),
      (this.respawnTimer = 0),
      (this.basicAttack = !0),
      (this.changed = !0),
      (this.player = { x: this.state.x, z: this.state.z, prevX: this.state.x, prevZ: this.state.z, y: 0, angle: 0, walk: 0, attack: 0 }),
      (this.friend = { x: this.state.x - 1.6, z: this.state.z + 1.5, hp: 100, maxHp: 100, angle: 0, walk: 0, attack: 0 }),
      A ||
        (this.addItem("Red Potion", 12, !1),
        this.addItem("Blue Potion", 6, !1),
        this.addItem("Butterfly Wing", 3, !1),
        this.addItem("Fly Wing", 4, !1),
        this.addItem("Arrow", 200, !1),
        this.addItem("Apple", 5, !1),
        this.addItem("Empty Bottle", 3, !1),
        this.addGear("Knife", !0),
        this.addGear("Cotton Shirt", !0)),
      (this.state.hp = Math.min(this.state.hp, this.derived().maxHp)),
      (this.state.sp = Math.min(this.state.sp, this.derived().maxSp)));
  }
  emit(A, g = {}) {
    (this.events.push({ type: A, time: this.time, ...g }), (this.changed = !0));
  }
  notify(A, g = "info") {
    this.emit("notice", { text: A, kind: g });
  }
  drain() {
    let A = this.events;
    return ((this.events = []), A);
  }
  get area() {
    return SI.get(this.state.area);
  }
  get city() {
    return this.area.kind === "city" ? this.area.id : this.area.city || "prontera";
  }
  get p() {
    return this.state;
  }
  count(A) {
    let g = rA(A).id;
    return (this.p.inventory[g] || 0) + this.p.gear.filter((I) => I.item === g).length;
  }
  owns(A) {
    return this.count(A) > 0 || this.p.gear.some((g) => g.item === rA(A).id);
  }
  skillLevel(A) {
    let g = Us(this.p.job, A);
    return (g && this.p.skills[g.id]) || 0;
  }
  addItem(A, g = 1, I = !0) {
    let e = rA(A);
    if (((g = Math.floor(ZN(g))), !!g)) {
      if (["weapon", "armor"].includes(e.kind)) {
        for (let i = 0; i < Math.min(g, 100); i++) this.addGear(e.id, !1, !0);
        I && this.emit("pickup", { text: `${e.name} \xD7${g}`, item: e.id });
        return;
      }
      ((this.p.inventory[e.id] = (this.p.inventory[e.id] || 0) + g),
        this.p.found.includes(e.id) || this.p.found.push(e.id),
        I && this.emit("pickup", { text: `${e.name} \xD7${g}`, item: e.id }),
        (this.changed = !0));
    }
  }
  removeItem(A, g = 1) {
    let I = rA(A);
    if (((g = Math.floor(ZN(g))), this.count(I.id) < g)) return !1;
    let e = Math.min(g, this.p.inventory[I.id] || 0);
    e && ((this.p.inventory[I.id] -= e), this.p.inventory[I.id] || delete this.p.inventory[I.id]);
    let i = g - e;
    for (; i-- > 0; ) {
      let t = this.p.gear.find((s) => s.item === I.id);
      if (!t) break;
      for (let [s, o] of Object.entries(this.p.equipped)) o === t.id && delete this.p.equipped[s];
      this.p.gear = this.p.gear.filter((s) => s !== t);
    }
    return ((this.changed = !0), !0);
  }
  addGear(A, g = !1, I = !1) {
    let e = rA(A);
    if (!["weapon", "armor"].includes(e.kind)) return null;
    let i = {
      id: `g${Date.now().toString(36)}-${this.uid++}`,
      item: e.id,
      refine: 0,
      cards: [],
      element: vN(e.description || ""),
      star: 0,
      slots: I ? (e.kind === "weapon" ? Math.max(1, 5 - (e.weaponLevel || 1)) : 1) : 0,
    };
    return (
      this.p.gear.push(i),
      g && (this.p.equipped[HN(e)] = i.id),
      this.p.found.includes(e.id) || this.p.found.push(e.id),
      (this.changed = !0),
      i
    );
  }
  gear(A) {
    return this.p.gear.find((g) => g.id === this.p.equipped[A]);
  }
  gearName(A) {
    return `${A.refine ? "+" + A.refine + " " : ""}${A.element && A.element !== "Neutral" ? A.element + " " : ""}${rA(A.item).name}${A.slots ? " [" + A.slots + "]" : ""}`;
  }
  equip(A) {
    let g = this.p.gear.find((t) => t.id === A);
    if (!g) return !1;
    let I = rA(g.item),
      e = fC(this.p.job),
      i = (I.classes || "").toLowerCase();
    return I.level && this.p.base < Math.max(1, Math.ceil(I.level / 3))
      ? (this.notify(`Requires journey level ${Math.ceil(I.level / 3)}.`), !1)
      : i && !/all|every/.test(i) && !i.includes(this.p.job.toLowerCase()) && !i.includes(e.toLowerCase()) && !this.compatibleWeapon(I)
        ? (this.notify("Your calling cannot equip this piece."), !1)
        : ((this.p.equipped[HN(I)] = A), this.notify(`${this.gearName(g)} equipped.`, "good"), this.emit("equip"), !0);
  }
  compatibleWeapon(A) {
    if (A.kind !== "weapon") return !0;
    let g = fC(this.p.job),
      I = A.type.toLowerCase();
    return (
      (g === "Magician" && /rod|staff|wand|book|knife/.test(I)) ||
      (g === "Acolyte" && /mace|staff|wand|knuckle/.test(I)) ||
      (g === "Archer" && /bow|music|whip/.test(I)) ||
      (g === "Thief" && /knife|dagger|katar|bow/.test(I)) ||
      (g === "Merchant" && /axe|mace|sword|knife/.test(I)) ||
      (g === "Swordsman" && /sword|spear|knife/.test(I))
    );
  }
  setAmmo(A) {
    let g = rA(A);
    return !/arrow/i.test(g.name) || !this.count(g.id) ? !1 : ((this.p.ammo = g.id), (this.changed = !0), !0);
  }
  unequip(A) {
    (delete this.p.equipped[A], (this.changed = !0));
  }
  weight() {
    let A = 0;
    for (let [g, I] of Object.entries(this.p.inventory)) A += rA(g).weight * I;
    for (let g of this.p.gear) A += rA(g.item).weight;
    return A;
  }
  maxWeight() {
    return 1600 + this.p.stats.STR * 30 + this.skillLevel("Increase Weight Limit") * 100 + (this.p.cart ? 8e3 : 0);
  }
  derived() {
    let A = { ...this.p.stats },
      g = { atk: 0, def: 0, mdef: 0, maxHp: 0, maxSp: 0, hpPercent: 0, spPercent: 0, flee: 0, hit: 0, crit: 0, magicPercent: 0 },
      I = [];
    for (let E of Object.values(this.p.equipped)) {
      let n = this.p.gear.find((h) => h.id === E);
      if (!n) continue;
      let l = rA(n.item);
      ((g.def += (l.def || 0) + (l.kind === "armor" ? n.refine * 0.667 : 0)), (g.mdef += l.mdef || 0));
      let c = l.description || "";
      for (let h of gc) {
        let u = c.match(new RegExp(h + "\\s*\\+\\s*(\\d+)", "i")) || c.match(new RegExp("\\+(\\d+)\\s*" + h, "i"));
        u && (A[h] += +u[1]);
      }
      for (let h of n.cards) {
        let u = rA(h);
        I.push(u);
        let S = u.description;
        for (let M of gc) {
          let N = S.match(new RegExp(M + "\\s*\\+\\s*(\\d+)", "i"));
          N && (A[M] += +N[1]);
        }
        for (let [M, N] of [
          [/ATK\s*\+\s*(\d+)(?!%)/i, "atk"],
          [/Flee\s*\+\s*(\d+)/i, "flee"],
          [/HIT\s*\+\s*(\d+)/i, "hit"],
          [/Critical\s*\+\s*(\d+)/i, "crit"],
          [/(?:Maximum|Max) HP\s*\+\s*(\d+)%/i, "hpPercent"],
          [/(?:Maximum|Max) SP\s*\+\s*(\d+)%/i, "spPercent"],
        ]) {
          let p = S.match(M);
          p && (g[N] += +p[1]);
        }
        let w = S.match(/(?:Maximum|Max) HP\s*\+\s*(\d+)(?![\d%])/i);
        w && (g.maxHp += +w[1]);
        let k = S.match(/(?:Maximum|Max) SP\s*\+\s*(\d+)(?![\d%])/i);
        k && (g.maxSp += +k[1]);
      }
    }
    let e = this.buffs.Blessing?.level || 0;
    for (let E of ["STR", "INT", "DEX"]) A[E] += e;
    ((A.AGI += this.buffs["Increase AGI"] ? this.buffs["Increase AGI"].level + 2 : 0),
      (A.STR += this.buffs["Crazy Uproar"] ? 4 : 0),
      (A.DEX += this.skillLevel("Owl's Eye")));
    let i = this.gear("weapon"),
      t = i ? rA(i.item) : null,
      s = /bow|instrument|whip/i.test(t?.type || ""),
      o =
        12 +
        A[s ? "DEX" : "STR"] +
        Math.floor(this.p.base * 1.8) +
        (t?.atk || 0) * 0.55 +
        (s ? (rA(this.p.ammo || "Arrow").atk || 0) * 0.25 : 0) +
        g.atk,
      B = Ew(this.p.job).filter((E) => !E.active && /mastery|research|iron fists|study|lessons/i.test(E.name));
    for (let E of B) o += (this.p.skills[E.id] || 0) * 2;
    (this.buffs["Power Thrust"] && (o *= 1.2), this.buffs.Provoke && (o *= 1.2));
    let Q = (110 + this.p.base * 14 + A.VIT * 9 + g.maxHp + this.skillLevel("Faith") * 50) * (1 + g.hpPercent / 100),
      a = (35 + this.p.base * 4 + A.INT * 4 + g.maxSp) * (1 + g.spPercent / 100),
      r = fA(1.15 - A.AGI * 0.008, 0.28, 1.15);
    return (
      Object.keys(this.buffs).some((E) => /quicken|adrenaline|impressive riff/i.test(E)) && (r *= 0.7),
      {
        ...A,
        atk: Math.round(o),
        matk: Math.round(16 + A.INT * 2.6 + this.p.base * 2 + (t?.atk || 0) * 0.35),
        def: g.def + A.VIT * 0.65,
        mdef: g.mdef + A.INT * 0.45,
        maxHp: Math.round(Q),
        maxSp: Math.round(a),
        hit: 80 + this.p.base + A.DEX + g.hit,
        flee: this.p.base + A.AGI + g.flee + this.skillLevel("Increase Dodge") * 3,
        crit: 3 + A.LUK * 0.3 + g.crit + (this.buffs.Fury ? 15 : 0),
        range: s ? 8 + this.skillLevel("Vulture's Eye") * 0.3 : 1.9,
        attackDelay: r,
        bow: s,
        cards: I,
        element:
          s && U2(rA(this.p.ammo || "Arrow").name) !== "Neutral"
            ? U2(rA(this.p.ammo || "Arrow").name)
            : this.buffs.endow?.element || i?.element || "Neutral",
        weapon: t,
        refineAtk: (i?.refine || 0) * ([0, 2, 3, 5][t?.weaponLevel || 1] || 0) + (i?.star || 0) * 5,
      }
    );
  }
  awardZeny(A) {
    ((this.p.zeny += Math.floor(A)), (this.p.totalZeny += Math.floor(A)), (this.changed = !0));
  }
  baseNeed() {
    return 35 + this.p.base * this.p.base * 5;
  }
  jobNeed() {
    return this.p.job === "Novice" ? 12 + this.p.jobLevel * 5 : 25 + this.p.jobLevel * 8;
  }
  xp(A, g) {
    if (this.p.guild && this.p.donation) {
      let e = (A * this.p.donation) / 100;
      ((this.p.guild.xp += e), (A -= e));
    }
    ((this.p.baseXP += A), (this.p.jobXP += g));
    let I = !1;
    for (; this.p.base < 99 && this.p.baseXP >= this.baseNeed(); )
      ((this.p.baseXP -= this.baseNeed()), this.p.base++, (this.p.statPoints += 6 + Math.floor(this.p.base / 5)), (I = !0));
    for (; this.p.jobLevel < (this.p.job === "Novice" ? 10 : 50) && this.p.jobXP >= this.jobNeed(); )
      if (((this.p.jobXP -= this.jobNeed()), this.p.jobLevel++, this.p.skillPoints++, this.p.job === "Novice")) {
        let e = Us("Novice", "Basic Skill");
        (e && (this.p.skills[e.id] = this.p.jobLevel - 1), this.p.skillPoints--);
      }
    if (I) {
      let e = this.derived();
      ((this.p.hp = e.maxHp), (this.p.sp = e.maxSp), this.emit("level", { text: `Base level ${this.p.base}!` }));
    }
    this.changed = !0;
  }
  raiseStat(A) {
    if (!gc.includes(A) || this.p.stats[A] >= 99) return !1;
    let g = 1 + Math.floor(this.p.stats[A] / 10);
    return this.p.statPoints < g ? !1 : ((this.p.statPoints -= g), this.p.stats[A]++, (this.changed = !0), !0);
  }
  canLearn(A) {
    return !(
      !A ||
      !Ew(this.p.job).some((g) => g.id === A.id) ||
      (A.quest && !this.p.sideDone.some((g) => pB.find((I) => I.id === g)?.skill === A.name))
    );
  }
  prerequisitesMet(A) {
    return !A.prerequisites || A.prerequisites === "None" || /Job Level/.test(A.prerequisites)
      ? !0
      : [...A.prerequisites.matchAll(/Level\s+(\d+)\s+(.+?)(?=,\s*(?:Level|and)|$)/gi)].every((I) => {
          let e = I[2].replace(/ and$/, "").trim(),
            i = Us(this.p.job, e);
          return !i || this.skillLevel(i.name) >= +I[1];
        });
  }
  learn(A) {
    let g = yg.skills.find((I) => I.id === A);
    return this.canLearn(g)
      ? this.prerequisitesMet(g)
        ? this.p.skillPoints < 1 || (this.p.skills[A] || 0) >= g.max
          ? !1
          : (this.p.skillPoints--,
            (this.p.skills[A] = (this.p.skills[A] || 0) + 1),
            this.emit("skillLearn", { text: `${g.name} Lv. ${this.p.skills[A]}` }),
            !0)
        : (this.notify("Learn the prerequisite skills first."), !1)
      : (this.notify("This skill is learned through its town quest."), !1);
  }
  setHotbar(A, g) {
    if (A < 0 || A > 3) return !1;
    let I = Us(this.p.job, g);
    return !I || !I.active || !this.skillLevel(g) ? !1 : ((this.p.hotbar[A] = I.name), (this.changed = !0), !0);
  }
  selectTarget(A) {
    let g = this.enemies.find((I) => I.id === A && zg(I));
    g && ((this.target = g.id), (this.path = []), (this.sitting = !1), delete this.buffs["Play Dead"], (this.changed = !0));
  }
  nearestTarget() {
    return this.enemies.filter(zg).sort((A, g) => yA(this.player, A) - yA(this.player, g))[0];
  }
  cycleTarget() {
    let A = this.enemies.filter((I) => zg(I) && yA(this.player, I) < 18).sort((I, e) => yA(this.player, I) - yA(this.player, e)),
      g = A.findIndex((I) => I.id === this.target);
    A.length && this.selectTarget(A[(g + 1) % A.length].id);
  }
  moveTo(A) {
    ((this.target = null),
      (this.interactTarget = null),
      (this.sitting = !1),
      delete this.buffs["Play Dead"],
      (this.path = TN(this.player, A, this.obstacles)),
      this.emit("moveMarker", A));
  }
  nearNpc(A) {
    return this.npcs.find((g) => g.role === A && yA(g, this.player) < 3.6);
  }
  interact(A = null) {
    let g = A || this.npcs.filter((i) => yA(i, this.player) < 3.6).sort((i, t) => yA(i, this.player) - yA(t, this.player))[0];
    if (!g) {
      let i = this.loot.find((t) => yA(t, this.player) < 2.8);
      if (i) {
        this.pickup(i.id);
        return;
      }
      this.notify("Move close to a person, a dropped item, or a portal.");
      return;
    }
    if (yA(g, this.player) > 3.6) {
      (this.moveTo(g), (this.interactTarget = g.id));
      return;
    }
    ((this.target = null), (this.path = []), (this.sitting = !1));
    let I = this.p.jobQuest,
      e = I ? Ls[I.job]?.steps[I.step] : null;
    if (e && ["visit", "delivery"].includes(e.type) && this.p.area === e.area && ["quartermaster", "mentor", "master"].includes(g.role)) {
      if (
        I.job === "Bard" &&
        this.p.area === "lutie" &&
        this.p.snowTalk < 5 &&
        (this.p.snowTalk++,
        this.notify(
          [
            "The Snow Man remembers a song without a name.",
            "A warm house. A window looking east.",
            "The clown hummed it beside the winter fountain.",
            "The children remember the last line.",
            "\u201CA little light, a little wonder.\u201D The story is complete.",
          ][this.p.snowTalk - 1],
        ),
        this.p.snowTalk < 5)
      )
        return;
      (I.step++,
        this.notify(
          e.type === "delivery" ? "Receipt received. Return to the Merchant Guild." : "Your errand is complete. Return to the guild.",
          "good",
        ),
        I.job === "Alchemist" && this.p.area === "juno" && this.addItem("Iron Ore", 5),
        (this.changed = !0));
    }
    this.emit("interact", { npc: g });
  }
  loadArea(A, g = null) {
    return SI.has(A)
      ? A === "ember-castle" && (!this.p.guild || this.p.wards.length < 6 || Qg[this.p.job].parent === "Novice" || this.p.job === "Novice")
        ? (this.notify("The castle opens after six wards, a second calling, and a guild oath."), !1)
        : ((this.p.area = A),
          (this.p.x = 0),
          (this.p.z = g?.spawn?.z ?? 14),
          (this.player.x = 0),
          (this.player.z = this.p.z),
          (this.player.prevX = 0),
          (this.player.prevZ = this.p.z),
          (this.friend.x = -1.5),
          (this.friend.z = this.p.z + 1.5),
          (this.target = null),
          (this.path = []),
          (this.interactTarget = null),
          (this.cast = null),
          (this.enemies = []),
          (this.loot = []),
          (this.traps = []),
          (this.summons = []),
          (this.telegraphs = []),
          (this.buffs = {}),
          (this.status = {}),
          (this.dead = !1),
          (this.sitting = !1),
          (this.respawnTimer = 0),
          this.p.visited.includes(A) || this.p.visited.push(A),
          g && this.setLayout(g),
          this.emit("area", { id: A }),
          !0)
      : !1;
  }
  setLayout(A) {
    if (
      ((this.obstacles = A.obstacles || []),
      (this.npcs = A.npcs || []),
      (this.portals = A.portals || []),
      (this.spawnPoints = A.spawns || []),
      this.area.kind === "training")
    )
      for (let g = 0; g < 5; g++) this.spawnEnemy("Poring", 5 + (g % 3) * 3, 4 + Math.floor(g / 3) * 4, { training: !0 });
    else if (this.area.kind === "trial") this.setupTrialEnemies();
    else if (this.area.kind !== "city") {
      let g = ur.find((t) => t.area === this.p.area),
        I = this.area.monsters || [],
        e = I.filter((t) => !Ae(t).boss && (!g || Ac(t) !== Ac(g.boss)));
      for (let t = 0; t < Math.min(20, Math.max(10, e.length)); t++) {
        let s = this.spawnPoints[t % this.spawnPoints.length] || { x: 5 + (t % 3) * 3, z: 5 - Math.floor(t / 3) * 5 };
        this.spawnEnemy(e[t % e.length] || "Poring", s.x, s.z);
      }
      let i = g ? [g.boss] : I.filter((t) => Ae(t).boss).slice(0, 2);
      this.p.area === "ember-castle" && i.splice(0, i.length, "Baphomet");
      for (let t = 0; t < i.length; t++) this.spawnEnemy(i[t], t * 5, -15, { boss: !0, ward: g?.key });
    }
    this.emit("population");
  }
  spawnEnemy(A, g, I, e = {}) {
    let i = Ae(A),
      t = e.training ? 1 : Math.max(1, Math.round((i.recommended || this.area.recommended * 3) / 3)),
      s = e.boss || i.boss,
      o = e.training ? 45 : Math.round(s ? 1100 + this.area.recommended * 55 : 35 + Math.sqrt(Math.max(1, i.hp)) * 3.5),
      B = {
        id: "e" + this.uid++,
        name: i.name.replace(/\s*\(MVP\)/, ""),
        spec: i.id,
        x: g,
        z: I,
        prevX: g,
        prevZ: I,
        spawnX: g,
        spawnZ: I,
        angle: 0,
        hp: o,
        maxHp: o,
        level: t,
        atk: s ? 20 + this.area.recommended * 2.2 : Math.max(5, Math.sqrt(i.atk || 4) * 2),
        def: Math.min(50, i.def * 0.35),
        mdef: i.mdef * 0.3,
        element: i.element,
        size: i.size,
        boss: s,
        ward: e.ward || null,
        aggro: !1,
        attackTime: 1.2 + this.rng(),
        phase: 0,
        skillTime: 4 + this.rng() * 3,
        walk: 0,
        attack: 0,
        stun: 0,
        freeze: 0,
        sleep: 0,
        poison: 0,
        blind: 0,
        silence: 0,
        slow: 0,
        lex: !1,
        stolen: !1,
        deadFor: 0,
        ...e,
      };
    return (this.enemies.push(B), this.p.seen.includes(i.id) || this.p.seen.push(i.id), this.emit("spawn", { id: B.id }), B);
  }
  price(A, g = !1) {
    A = typeof A == "string" ? rA(A) : A;
    let I = g
        ? A.kind === "card"
          ? 8e3
          : A.kind === "weapon"
            ? Math.max(300, (A.atk || 30) * 32)
            : A.kind === "armor"
              ? Math.max(250, (A.def || 1) * 1100)
              : Math.max(18, Math.min(1200, A.buy || A.sell * 3 || 30))
        : A.buy || Math.max(20, A.sell * 3 || 30),
      e = this.skillLevel("Discount"),
      i = this.skillLevel("Haggle");
    return Math.max(1, Math.floor(I * (1 - Math.max(e ? Math.min(0.24, 0.05 + e * 0.02) : 0, i ? 0.05 + i * 0.04 : 0))));
  }
  buy(A, g = 1, I = !1) {
    let e = rA(A),
      i = Math.floor(fA(+g || 1, 1, 999)),
      t = this.price(e, I) * i;
    return this.nearNpc("shop")
      ? this.p.zeny < t
        ? (this.notify("Not enough zeny. Sell spare drops, or accept a bounty."), !1)
        : this.weight() + e.weight * i > this.maxWeight()
          ? (this.notify("That would exceed your carrying limit. Use Kafra storage."), !1)
          : ((this.p.zeny -= t), this.addItem(e.id, i), this.emit("buy"), !0)
      : (this.notify("Visit a Kit Shop or Quartermaster to trade."), !1);
  }
  sell(A, g = 1) {
    if (!this.nearNpc("shop")) return !1;
    let I = rA(A);
    if (((g = Math.min(this.count(I.id), Math.max(1, Math.floor(g)))), !g)) return !1;
    this.removeItem(I.id, g);
    let e = this.skillLevel("Overcharge");
    return (this.awardZeny(Math.floor((I.sell || 1) * g * (1 + (e ? Math.min(0.24, 0.05 + e * 0.02) : 0)))), this.emit("sell"), !0);
  }
  sellGear(A) {
    if (!this.nearNpc("shop")) return !1;
    if (Object.values(this.p.equipped).includes(A)) return (this.notify("Unequip this piece before selling it."), !1);
    let g = this.p.gear.find((I) => I.id === A);
    return g ? (this.awardZeny(rA(g.item).sell || 10), (this.p.gear = this.p.gear.filter((I) => I.id !== A)), this.emit("sell"), !0) : !1;
  }
  deposit(A, g = 1) {
    if (!this.nearNpc("kafra")) return !1;
    if (["weapon", "armor"].includes(rA(A).kind))
      return (this.notify("Equipment stays in your bag; storage holds stackable supplies."), !1);
    let I = rA(A).id;
    return (
      (g = Math.min(this.count(I), Math.floor(g))),
      g <= 0 ? !1 : (this.removeItem(I, g), (this.p.storage[I] = (this.p.storage[I] || 0) + g), !0)
    );
  }
  withdraw(A, g = 1) {
    if (!this.nearNpc("kafra")) return !1;
    let I = rA(A).id;
    return (
      (g = Math.min(this.p.storage[I] || 0, Math.floor(g))),
      g <= 0 || this.weight() + rA(I).weight * g > this.maxWeight() ? !1 : ((this.p.storage[I] -= g), this.addItem(I, g), !0)
    );
  }
  restAtKafra() {
    if (!this.nearNpc("kafra")) return !1;
    let A = this.derived();
    return (
      (this.p.hp = A.maxHp),
      (this.p.sp = A.maxSp),
      (this.friend.hp = this.friend.maxHp),
      (this.p.savePoint = this.city),
      (this.status = {}),
      this.emit("saveRequested"),
      this.notify("Rested, restored, and saved. Kafra will be here.", "good"),
      !0
    );
  }
  useItem(A) {
    if (this.dead || this.potionTimer > 0) return !1;
    let g = rA(A);
    if (!this.count(g.id)) return (this.notify(`No ${g.name} in your bag.`), !1);
    let I = this.derived(),
      e = g.description || "",
      i = !1,
      t = g.name.toLowerCase();
    if (/butterfly wing/.test(t))
      return (this.removeItem(g.id), this.loadArea(this.p.savePoint), this.notify("Home, on borrowed wings."), !0);
    if (/fly wing/.test(t)) {
      let s = ji(this.spawnPoints?.length ? this.spawnPoints : [{ x: 0, z: 14 }], this.rng);
      ((this.player.x = s.x),
        (this.player.z = s.z),
        (this.player.prevX = s.x),
        (this.player.prevZ = s.z),
        (this.target = null),
        (this.path = []),
        this.emit("teleport", s),
        (i = !0));
    } else if (/dead branch/.test(t))
      (this.spawnEnemy(ji(yg.monsters, this.rng).name, this.player.x + 3, this.player.z, { aggro: !0 }), (i = !0));
    else if (/blue box|violet box|gift box/.test(t)) {
      let s = x2().filter((o) => o.blueBox || (["weapon", "armor", "card"].includes(o.kind) && o.rare));
      (this.addItem(ji(s, this.rng).id), this.notify("Something extraordinary was waiting inside.", "rare"), (i = !0));
    } else if (/green potion|green herb|panacea/.test(t)) ((this.status = {}), (i = !0));
    else if (/dye/.test(t)) {
      let s = {
        scarlet: "#b35b51",
        blue: "#6b95b8",
        green: "#7c9f77",
        yellow: "#dbb86b",
        orange: "#d89961",
        violet: "#9c83b8",
        white: "#e8dec9",
        black: "#585e65",
      };
      ((this.p.hair = Object.entries(s).find(([o]) => t.includes(o))?.[1] || "#a68abb"), this.emit("equip"), (i = !0));
    } else if (/concentration|awakening|berserk potion/.test(t)) ((this.buffs["Adrenaline Rush"] = { time: 180, level: 3 }), (i = !0));
    else {
      if (/magnifier|magnifying/.test(t)) return (this.notify("All test-build drops are identified on pickup."), !1);
      {
        let s = 0,
          o = 0,
          B = e.match(/(?:Restores?|Recovers?|Heals?).*?(\d+)\s*HP/i),
          Q = e.match(/(?:Restores?|Recovers?).*?(\d+)\s*SP/i);
        (B && (s = +B[1]),
          Q && (o = +Q[1]),
          !s &&
            !o &&
            (/red potion/.test(t)
              ? (s = 60)
              : /orange potion/.test(t)
                ? (s = 120)
                : /yellow potion/.test(t)
                  ? (s = 180)
                  : /white potion/.test(t)
                    ? (s = 240)
                    : /blue potion/.test(t)
                      ? (o = 100)
                      : /blue herb|grape/.test(t)
                        ? (o = 30)
                        : /herb|apple|carrot|meat|banana|milk|honey|jelly|feed|juice/.test(t) && (s = 35)),
          (s || o) &&
            ((s = Math.round(s * (1 + I.VIT * 0.012 + this.skillLevel("Potion Research") * 0.05))),
            (this.p.hp = fA(this.p.hp + s, 0, I.maxHp)),
            (this.p.sp = fA(this.p.sp + o, 0, I.maxSp)),
            this.emit("heal", { x: this.player.x, z: this.player.z, text: o ? `+${o} SP` : `+${s}` }),
            (i = !0)));
      }
    }
    return (
      i
        ? (this.removeItem(g.id), (this.potionTimer = 0.6), this.emit("useItem"))
        : this.notify("This is a crafting, collection, or trading item."),
      i
    );
  }
  slotCard(A, g) {
    if (!this.nearNpc("forge")) return (this.notify("The smith can set a card safely."), !1);
    let I = rA(A),
      e = this.p.gear.find((o) => o.id === g);
    if (!e || I.kind !== "card" || !this.count(I.id) || e.cards.length >= e.slots) return !1;
    let i = HN(rA(e.item)),
      t = I.slot.toLowerCase();
    return (i === "weapon" && /weapon/.test(t)) ||
      (i === "armor" && /armor/.test(t)) ||
      (i === "head" && /head|helm/.test(t)) ||
      (i === "shoes" && /foot|shoe/.test(t)) ||
      (i === "shield" && /shield/.test(t)) ||
      (i === "garment" && /garment|cloak/.test(t)) ||
      (i === "accessory" && /accessor/.test(t))
      ? (this.removeItem(I.id), e.cards.push(I.id), this.emit("refine", { text: `${I.name} set in ${rA(e.item).name}.` }), !0)
      : (this.notify(`This card belongs in ${I.slot}.`), !1);
  }
  refineInfo(A) {
    let g = rA(A.item),
      I = g.kind === "armor",
      e = g.weaponLevel || 1,
      i = I ? 5 : [0, 7, 6, 5][e] || 0,
      t = I ? 2e3 : [0, 50, 200, 1e3][e] || 0;
    return {
      material: I ? "Elunium" : [null, "Phracon", "Emveretarcon", "Oridecon"][e],
      cost: t,
      safe: i,
      chance: A.refine < i ? 1 : Math.max(0.05, 0.5 - Math.max(0, A.refine - i) * 0.12),
    };
  }
  refine(A, g = !1) {
    if (!this.nearNpc("forge")) return !1;
    let I = this.p.gear.find((t) => t.id === A);
    if (!I) return !1;
    let e = this.refineInfo(I);
    if (!e.material) return (this.notify("The guide does not allow refining level 4 weapons."), !1);
    if (I.refine >= 10) return (this.notify("This testing journey caps refinement at +10."), !1);
    if (e.chance < 1 && !g) return (this.notify("This is beyond the safe limit. Confirm the risk in the forge."), !1);
    if (this.p.zeny < e.cost || !this.count(e.material)) return (this.notify(`You need ${e.material} and ${e.cost} zeny.`), !1);
    ((this.p.zeny -= e.cost), this.removeItem(e.material));
    let i = this.rng() < e.chance;
    return (
      (I.refine = i ? I.refine + 1 : 0),
      this.p.totalRefines++,
      this.emit("refine", {
        text: i ? `${this.gearName(I)} \u2014 success!` : "The temper failed. Refinement returned to +0; the item survived.",
        success: i,
      }),
      i
    );
  }
  recipeById(A) {
    return [...yg.recipes, ...yg.arrowRecipes].find((g) => g.id === A);
  }
  craft(A, g = "Neutral", I = !1) {
    let e = this.recipeById(A);
    if (!e) return !1;
    if (e.kind === "arrow") {
      if (!this.skillLevel("Arrow Crafting")) return (this.notify("Learn Arrow Crafting through its quest first."), !1);
      if (this.weight() / this.maxWeight() >= 0.5 || this.p.sp < 10)
        return (this.notify("Arrow Crafting needs 10 SP and less than 50% weight."), !1);
      if (!e.ingredients.every(([B, Q]) => this.count(B) >= Q)) return (this.notify("Carry the conversion ingredient first."), !1);
      for (let [B, Q] of e.ingredients) this.removeItem(B, Q);
      this.p.sp -= 10;
      for (let [B, Q] of e.outputs) this.addItem(B, Q);
      return (
        this.p.totalCrafts++,
        this.emit("refine", { text: e.outputs.map(([B, Q]) => Q + " " + B).join(" + ") + " crafted.", success: !0 }),
        !0
      );
    }
    if (!this.nearNpc("forge")) return !1;
    if (/Juice/.test(e.name) && !this.p.sideDone.includes("juice"))
      return (this.notify("Complete Something sweeter in Prontera first."), !1);
    if (/Mixture|Counteragent|Dye/.test(e.name) && !this.p.sideDone.includes("dye"))
      return (this.notify("Complete A different shade of you in Alberta first."), !1);
    let i = e.ingredients.map(([B, Q]) => [rA(B).id, Q]),
      t = { Fire: "Flame Heart", Water: "Mistic Frozen", Earth: "Great Nature", Wind: "Rough Wind" }[g];
    if (
      (t && i.push([rA(t).id, 1]), I && i.push([rA("Star Crumb").id, 1]), !i.every(([B, Q]) => this.count(B) >= Q) || this.p.zeny < e.cost)
    )
      return (this.notify("Gather the listed ingredients and zeny first."), !1);
    for (let [B, Q] of i) this.removeItem(B, Q);
    this.p.zeny -= e.cost;
    let s =
        e.kind === "forge"
          ? fA(0.6 + this.p.base * 0.004 + this.p.stats.DEX * 0.001 + this.p.stats.LUK * 5e-4 - (t ? 0.12 : 0) - (I ? 0.08 : 0), 0.15, 0.98)
          : 1,
      o = this.rng() < s;
    if (o) {
      let B = this.addGear(e.name, !1, !0);
      (B ? ((B.element = g), (B.star = I ? 1 : 0)) : this.addItem(e.name), this.p.totalCrafts++);
    }
    return (this.emit("refine", { text: o ? `${e.name} crafted.` : "The forging failed. The ingredients were consumed.", success: o }), o);
  }
  startBounty(A = null) {
    if (!this.nearNpc("board")) return !1;
    let g = A || ji(this.area.kind === "city" ? P2(this.city) : this.area.monsters, this.rng);
    return (
      (this.p.bounty = { name: g, goal: 6, reward: 1200 + this.p.base * 70 }),
      (this.p.bountyProgress = 0),
      this.notify(`Bounty accepted: defeat 6 ${g}.`),
      !0
    );
  }
  claimBounty() {
    if (!this.nearNpc("board") || !this.p.bounty || this.p.bountyProgress < this.p.bounty.goal) return !1;
    let A = this.p.bounty.reward;
    return (
      this.awardZeny(A),
      this.xp(A * 0.4, A * 0.7),
      this.addItem("Red Potion", 5),
      (this.p.bounty = null),
      (this.p.bountyProgress = 0),
      this.notify(`Bounty complete. ${A} zeny earned.`, "good"),
      !0
    );
  }
  completeSide(A) {
    let g = pB.find((I) => I.id === A);
    if (!g || this.p.sideDone.includes(A) || this.city !== g.city || !this.nearNpc("mentor")) return !1;
    if (g.minJob && nAA(this.p.job, g.class) && this.p.jobLevel < g.minJob)
      return (this.notify("This request needs job level " + g.minJob + "."), !1);
    if (g.class && g.class !== "Novice" && g.class !== fC(this.p.job) && g.class !== this.p.job)
      return (this.notify("This quest belongs to a different calling."), !1);
    if (!g.needs.every(([I, e]) => this.count(I) >= e)) return (this.notify("Bring the requested ingredients first."), !1);
    if (!["juice", "dye"].includes(A)) for (let [I, e] of g.needs) this.removeItem(I, e);
    if ((this.p.sideDone.push(A), g.skill)) {
      let I = Us(g.class || this.p.job, g.skill);
      I && (this.p.skills[I.id] = 1);
    }
    return (g.reward && this.addItem(g.reward), this.xp(100, 100), this.emit("quest", { text: `${g.title} complete.` }), !0);
  }
  graduateTraining() {
    return this.p.trainingKills < 3 || !this.nearNpc("mentor")
      ? !1
      : (this.p.training < 2 &&
          ((this.p.training = 2),
          this.xp(150, 500),
          this.awardZeny(100),
          this.addItem("Phracon", 4),
          this.addItem("Clover", 3),
          this.addItem("Red Herb", 3),
          (this.p.storyStarted = !0),
          this.emit("quest", { text: "The road is yours. Choose a calling at its guild." })),
        !0);
  }
  acceptJob(A) {
    let g = Ls[A],
      I = this.p.job;
    if (!g || this.city !== g.city || !this.nearNpc("guild")) return !1;
    let e = I === "Novice" ? 10 : 40;
    return this.p.jobLevel < e || Qg[A].parent !== I
      ? (this.notify(`Reach job level ${e} as ${Qg[A].parent} first.`), !1)
      : ((this.p.jobQuest && this.p.jobQuest.job === A) ||
          ((this.p.jobQuest = { job: A, step: 0, feePaid: !1 }),
          A === "Merchant" &&
            !this.p.jobsDone.length &&
            this.p.zeny < 3e3 &&
            (this.awardZeny(3e3 - this.p.zeny), this.notify("A first-business bursary covers your entry fee. (Journey addition.)", "good")),
          this.notify(`Your path to ${A} has begun.`)),
        !0);
  }
  advanceJob(A = null) {
    let g = this.p.jobQuest;
    if (!g) return !1;
    let I = Ls[g.job];
    if (this.city !== I.city || !this.nearNpc("guild")) return !1;
    if (g.step >= I.steps.length)
      return !g.feePaid && this.p.zeny < I.fee
        ? (this.notify(`The guild fee is ${I.fee} zeny.`), !1)
        : (g.feePaid || (this.p.zeny -= I.fee), this.changeJob(g.job), !0);
    let e = I.steps[g.step];
    if (e.type === "collect") {
      if (g.job === "Thief") {
        if (this.count("Gooey Mushroom") + this.count("Net Mushroom") * 3 < 25) return (this.beginTrial("mushrooms"), !0);
        (this.removeItem("Gooey Mushroom", this.count("Gooey Mushroom")), this.removeItem("Net Mushroom", this.count("Net Mushroom")));
      } else if (g.job === "Archer") {
        let i = [
            ["Trunk", 7],
            ["Fine-grained Trunk", 5],
            ["Solid Trunk", 3],
            ["Barren Trunk", 1],
          ],
          t = i.reduce((s, [o, B]) => s + this.count(o) * B, 0);
        if (t < 25) return (this.notify("Willows drop trunks. You need 25 points."), !1);
        for (let [s] of i) this.removeItem(s, this.count(s));
        this.addItem("Arrow", 200 + t - 25);
      } else {
        if (g.job === "Crusader" && g.step === 0 && this.owns("Hand of God") && this.owns("Chivalry Emblem"))
          return (this.removeItem("Hand of God"), this.removeItem("Chivalry Emblem"), (g.step = I.steps.length), !0);
        if (g.job === "Alchemist" && g.step === 0 && this.owns("Old Magic Scroll") && this.owns("Hammer of Blacksmith"))
          (this.removeItem("Old Magic Scroll"), this.removeItem("Hammer of Blacksmith"));
        else {
          if (!e.needs.every(([i, t]) => this.count(i) >= t)) return (this.notify("Bring the listed ingredients to continue."), !1);
          for (let [i, t] of e.needs) this.removeItem(i, t);
        }
      }
      g.step++;
    } else if (e.type === "quiz") {
      if (A === null) return (this.emit("quiz", { ...e }), !1);
      if (A !== e.answer) return (this.notify("Not quite. Take your time and try again."), !1);
      g.step++;
    } else return e.type === "trial" ? (this.beginTrial(e.trial), !0) : (this.notify(e.text), !1);
    return (this.emit("quest", { text: "Trial complete. Speak to the guild to continue." }), !0);
  }
  changeJob(A) {
    if (!Qg[A]) return !1;
    ((this.p.job = A),
      (this.p.jobLevel = 1),
      (this.p.jobXP = 0),
      (this.p.skillPoints = 5),
      this.p.jobsDone.push(A),
      (this.p.jobQuest = null),
      (this.p.hotbar = [...Qg[A].skills].slice(0, 4)));
    let g = Us(A, Qg[A].skills[0]);
    return (
      g && (this.p.skills[g.id] = Math.max(1, this.p.skills[g.id] || 0)),
      this.addGear(Qg[A].weapon, !0, !0),
      fC(A) === "Archer" && this.addItem("Arrow", 300),
      fC(A) === "Merchant" && (this.p.cart = !0),
      (this.p.hp = this.derived().maxHp),
      (this.p.sp = this.derived().maxSp),
      this.emit("job", { text: `You are now a ${A}.` }),
      this.emit("saveRequested"),
      !0
    );
  }
  beginTrial(A) {
    ((this.trial = {
      type: A,
      returnArea: this.city,
      progress: 0,
      failures: 0,
      start: this.time,
      points:
        A === "dance"
          ? [
              { x: -4, z: 6 },
              { x: 4, z: 1 },
              { x: -4, z: -5 },
              { x: 0, z: -13 },
            ]
          : [
              { x: 0, z: 6 },
              { x: 6, z: 0 },
              { x: 0, z: -6 },
              { x: 0, z: -15 },
            ],
    }),
      this.loadArea("guild-trial"),
      this.emit("trialStart"));
  }
  setupTrialEnemies() {
    if (!this.trial) return;
    let A = this.trial.type;
    if (A === "mushrooms")
      for (let g = 0; g < 18; g++)
        this.spawnEnemy("Poring", -10 + (g % 6) * 4, 8 - Math.floor(g / 6) * 7, {
          name: g % 3 ? "Gooey Mushroom" : "Net Mushroom",
          trialMushroom: !0,
          hp: 15,
          maxHp: 15,
          atk: 0,
        });
    else if (["battle", "selective"].includes(A)) {
      for (let g = 0; g < 4; g++)
        this.spawnEnemy("Zombie", -6 + g * 4, -6, {
          name: A === "selective" ? "Job Change Monster" : "Zombie",
          trialTarget: !0,
          hp: 110,
          maxHp: 110,
        });
      if (A === "selective") for (let g = 0; g < 3; g++) this.spawnEnemy("Poring", -5 + g * 5, 3, { trialDecoy: !0 });
    } else if (A === "endure") for (let g = 0; g < 6; g++) this.spawnEnemy("Fabre", g % 2 ? 4 : -4, 9 - g * 4, { aggro: !0, atk: 7 });
  }
  finishTrial() {
    if (!this.trial) return;
    let A = this.trial.returnArea;
    (this.trial.type !== "mushrooms" && this.p.jobQuest && this.p.jobQuest.step++,
      (this.trial = null),
      this.loadArea(A),
      this.emit("quest", { text: "You passed. Return to the guild master." }));
  }
  failTrial(A) {
    this.trial &&
      (this.trial.failures++,
      (this.trial.progress = 0),
      (this.player.x = 0),
      (this.player.z = 14),
      (this.path = []),
      (this.target = null),
      (this.p.hp = Math.max(this.p.hp, this.derived().maxHp * 0.5)),
      this.notify(A + " Try again from the entrance."),
      this.emit("teleport", { x: 0, z: 14 }));
  }
  foundGuild(A = "Amber Company") {
    return !this.nearNpc("guild") || !this.count("Emperium")
      ? (this.notify("Bring an Emperium to any guild master. A ward guardian carries one."), !1)
      : this.p.guild
        ? !1
        : (this.removeItem("Emperium"),
          (this.p.guild = { name: String(A).trim().slice(0, 28) || "Amber Company", xp: 0, level: 1 }),
          this.emit("quest", { text: `${this.p.guild.name} has been founded.` }),
          !0);
  }
  setDonation(A) {
    ((this.p.donation = fA(Math.round(+A) || 0, 0, 100)), (this.changed = !0));
  }
  hire(A) {
    return !this.nearNpc("kafra") || !["Mira", "Rowan", "Linn", null].includes(A)
      ? !1
      : ((this.p.companion = A),
        (this.friend.hp = this.friend.maxHp),
        this.emit("equip"),
        this.notify(A ? `${A} joined your party. Offline companion; no network players.` : "Travelling solo."),
        !0);
  }
  toggleMount() {
    return ["Knight", "Crusader"].includes(this.p.job)
      ? !this.nearNpc("kafra") || (this.p.zeny < 250 && !this.p.mount)
        ? !1
        : (this.p.mount || (this.p.zeny -= 250), (this.p.mount = !this.p.mount), this.emit("equip"), !0)
      : (this.notify("PecoPeco rentals are for Knights and Crusaders."), !1);
  }
  toggleSit() {
    this.dead || ((this.target = null), (this.path = []), (this.sitting = !this.sitting), (this.cast = null), (this.changed = !0));
  }
  pickup(A) {
    let g = this.loot.find((e) => e.id === A);
    if (!g || yA(g, this.player) > 3.4) return !1;
    let I = rA(g.item);
    return this.weight() + I.weight * g.count > this.maxWeight()
      ? (this.notify("Bag full. Deposit or sell some supplies."), !1)
      : (this.addItem(g.item, g.count), (this.loot = this.loot.filter((e) => e.id !== A)), this.emit("lootRemoved", { id: A }), !0);
  }
  die() {
    this.dead ||
      ((this.dead = !0),
      (this.target = null),
      (this.path = []),
      (this.cast = null),
      this.p.deaths++,
      (this.p.baseXP = Math.max(0, this.p.baseXP - Math.floor(this.baseNeed() * 0.01))),
      this.emit("defeat"));
  }
  revive() {
    ((this.p.hp = this.derived().maxHp),
      (this.p.sp = this.derived().maxSp),
      (this.trial = null),
      this.loadArea(this.p.savePoint),
      this.notify("A new morning. Your equipment and job experience are safe."));
  }
  useSkill(A) {
    if (!A || this.dead || this.paused) return !1;
    let g = Us(this.p.job, A),
      I = this.skillLevel(A);
    if (!g || !I) return (this.notify("Learn this skill in your character book first."), !1);
    if (!g.active) return (this.notify("This is a passive skill."), !1);
    if (this.weight() / this.maxWeight() >= 0.9) return (this.notify("Over 90% weight: put down some supplies."), !1);
    if (this.status.silence) return (this.notify("Silenced. Use a Green Potion."), !1);
    if (this.cast || this.cooldowns[g.id] > 0) return !1;
    if (A === "Play Dead" && this.p.job !== "Novice") return (this.notify("Only Novices may play dead."), !1);
    let e = this.derived(),
      i = g.levels.find((n) => n.level === I)?.text || g.levels[0]?.text || "",
      t = g.name.toLowerCase(),
      s = rw(i.match(/(\d+)\s*SP(?:\s|,|$)/i)?.[1] || g.sp, 8);
    (/varying|none|\?\?/.test(String(g.sp).toLowerCase()) && !/\d+\s*SP/i.test(i) && (s = /bolt/.test(t) ? 10 + I * 2 : 8 + I * 2),
      t === "bash" && (s = I <= 5 ? 8 : 15),
      /first aid/.test(t) && (s = 3),
      /guillotine/.test(t) && (s = this.p.sp),
      (s = Math.min(120, Math.max(0, s))),
      this.buffs["Gypsy's Kiss"] && (s *= 0.7));
    let o = this.enemies.find((n) => n.id === this.target && zg(n)),
      B =
        /heal|first aid|bless|increase agi|angelus|kyrie|guard|coat|quicken|adrenaline|crazy uproar|sphere absorption|summon spirit|fury|mental strength|magnificat|gloria|sacrifice|defend|resistan|protection|endow|enchant|hindsight|perfection|maximize|power thrust|hide|hiding|cloaking|stalk|play dead|amp|encore|song of|magic strings|impressive riff|tablature|lady luck|focus ballet|gypsy|acoustic|battle theme|harmonic|power chord|pneuma|safety wall|sanctuary|cure|detox|recovery|resurrection|ressurection|teleport|warp portal|back slide|snap|find stone|appraisal|vending|cart change|change cart|arrow crafting|prepare potion|aqua benedicta|repair weapon|sense|sight|ruwach|detection|hocus pocus|cast cancel|summon flora|summon marine/.test(
          t,
        );
    if (!B && !o && !/trap|mine|claymore|talkie|freezing|sandman|flasher|shockwave/.test(t))
      return (this.notify("Select a monster first."), !1);
    let Q = /bolt|strike|thunder|arrow|spell|meteor|gust|ball|spike|drive|boomerang|soul|napalm|lex|holy light|sense/.test(t)
      ? 12
      : e.range;
    if (o && !B && yA(this.player, o) > Q)
      return (this.notify("Move closer to your target."), (this.path = TN(this.player, o, this.obstacles)), !1);
    if (this.p.sp < s) return (this.notify("Not enough SP. Sit to recover, or use a Blue Potion."), !1);
    let a = null;
    if (
      (/Blue Gem|Blue Gemstone/i.test(g.sp) && (a = "Blue Gemstone"),
      /Red Gem/i.test(g.sp) && (a = "Red Gemstone"),
      /Yellow Gem/i.test(g.sp) && (a = "Yellow Gemstone"),
      /acid terror/.test(t) && (a = "Acid Bottle"),
      t === "bomb" && (a = "Bomb Bottle"),
      t === "summon flora" && (a = "Plant Bottle"),
      t === "summon marine sphere" && (a = "Marine Sphere Bottle"),
      /trap|landmine|blast mine|claymore|ankles snare|flasher|sandman|shockwave|^freezing$/.test(t) &&
        !/^remove|^spring/.test(t) &&
        (a = "Trap"),
      a && !this.count(a))
    )
      return (this.notify(`This skill needs a ${a}.`), !1);
    if (/mammonite/.test(t)) {
      if (this.p.zeny < I * 100) return (this.notify("Mammonite needs " + I * 100 + " zeny."), !1);
      this.p.zeny -= I * 100;
    }
    if (/occult|throw spirit|guillotine|mental strength|^root$|^snap$/.test(t)) {
      let n = /guillotine|mental/.test(t) ? 5 : 1;
      if ((this.buffs.spheres?.level || 0) < n) return (this.notify(`Summon ${n} Spirit Spheres first.`), !1);
      if (/guillotine/.test(t) && !this.buffs.Fury) return (this.notify("Enter Fury before using Guillotine Fist."), !1);
      this.buffs.spheres.level -= n;
    }
    ((this.p.sp -= s),
      a && this.removeItem(a),
      (this.sitting = !1),
      (this.cooldowns[g.id] = /heal|first aid/.test(t) ? 1 : /bolt|bash|strike/.test(t) ? 1.3 : 4));
    let r = /bolt|meteor|gust|vermilion|exorcismus|guillotine/.test(t)
        ? fA((/bolt/.test(t) ? 0.35 + I * 0.1 : 1.8) - e.DEX * 0.008, 0.15, 3)
        : 0,
      E = () => this.resolveSkill(g, I, o, i, s);
    return (
      r > 0
        ? ((this.cast = { name: g.name, remaining: r, total: r, resolve: E }),
          this.emit("cast", { name: g.name, element: vN(g.name) }),
          o && Ae(o.spec).magicSense && (o.aggro = !0))
        : E(),
      (this.changed = !0),
      !0
    );
  }
  resolveSkill(A, g, I, e, i) {
    let t = A.name.toLowerCase(),
      s = this.derived(),
      o = this.player,
      B = vN(A.name),
      Q = (c = A.name, h = 60) => {
        ((this.buffs[c] = { time: h, level: g }), this.emit("buff", { text: A.name, element: B }));
      };
    if (
      (this.emit("skill", { name: A.name, element: B, x: I?.x ?? o.x, z: I?.z ?? o.z }), (this.player.attack = 0.35), /first aid/.test(t))
    ) {
      this.heal(5);
      return;
    }
    if (t === "heal") {
      I && /undead/i.test(I.element)
        ? this.hit(I, (this.p.base + s.INT) * g * 0.8, "Holy", !0)
        : this.heal((this.p.base + s.INT) * g * 1.5 + 25);
      return;
    }
    if (/aid potion/.test(t)) {
      let c = ["Red Potion", "Orange Potion", "Yellow Potion", "White Potion", "Blue Potion"][fA(g - 1, 0, 4)];
      this.count(c)
        ? (this.useItem(c), this.heal(g * 25), (this.friend.hp = this.friend.maxHp))
        : this.notify("Carry " + c + " for Potion Pitcher.");
      return;
    }
    if (/cure|detox|status recovery|slow poison|resurrection|ressurection/.test(t)) {
      ((this.status = {}), (this.friend.hp = this.friend.maxHp));
      return;
    }
    if (/summon spirit/.test(t)) {
      this.buffs.spheres = { time: 600, level: Math.min(g, (this.buffs.spheres?.level || 0) + 1) };
      return;
    }
    if (/sphere absorption/.test(t)) {
      ((this.p.sp = fA(this.p.sp + 10 * (this.buffs.spheres?.level || 0), 0, s.maxSp)), delete this.buffs.spheres);
      return;
    }
    if (/guillotine/.test(t)) {
      (I && this.hit(I, s.atk * 6 + i * 5 + g * 100, "Neutral", !0, !0),
        (this.p.sp = 0),
        delete this.buffs.Fury,
        (this.buffs.spLock = { time: 30, level: 1 }));
      return;
    }
    if (/play dead|hide|hiding|cloaking|stalk/.test(t)) {
      (this.buffs[A.name] ? delete this.buffs[A.name] : Q(A.name, Math.min(60, 20 + g * 5)), (this.target = null));
      return;
    }
    if (/back slide|snap/.test(t)) {
      let c = /snap/.test(t) ? 6 : -5;
      (this.displace(Math.sin(o.angle) * c, Math.cos(o.angle) * c), (this.target = null), (this.path = []));
      return;
    }
    if (/teleport|warp portal/.test(t)) {
      g >= 2 || /warp/.test(t)
        ? this.loadArea(this.p.savePoint)
        : ((this.player.x = 0), (this.player.z = 14), (this.path = []), (this.target = null), this.emit("teleport", { x: 0, z: 14 }));
      return;
    }
    if (/steal|^mug$|^gank$/.test(t)) {
      I && !I.stolen && this.rng() < Math.min(0.9, 0.1 + g * 0.04 + s.DEX * 0.005)
        ? ((I.stolen = !0),
          t === "mug"
            ? this.awardZeny(100 + I.level * 50)
            : this.addItem(ji(Ae(I.spec).drops.length ? Ae(I.spec).drops : ["Jellopy"], this.rng)),
          this.notify("Stolen successfully.", "good"))
        : this.notify("Nothing stolen.");
      return;
    }
    if (/endow|enchant poison|asperio/.test(t)) {
      this.gear("weapon") &&
        ((this.buffs.endow = { time: 60, level: g, element: B === "Neutral" ? (/asperio/.test(t) ? "Holy" : "Fire") : B }), Q());
      return;
    }
    if (/find stone/.test(t)) {
      this.addItem("Stone");
      return;
    }
    if (/arrow crafting/.test(t)) {
      ((this.p.sp = Math.min(s.maxSp, this.p.sp + i)), this.emit("openArrowCrafting"));
      return;
    }
    if (/aqua benedicta/.test(t)) {
      if (this.area.theme !== "coast") {
        this.notify("Stand near water in a coastal area.");
        return;
      }
      this.removeItem("Empty Bottle") && this.addItem("Holy Water");
      return;
    }
    if (/prepare potion/.test(t)) {
      this.count("Red Herb") >= 2 && this.count("Empty Bottle") && this.count("Medicine Bowl")
        ? (this.removeItem("Red Herb", 2), this.removeItem("Empty Bottle"), this.removeItem("Medicine Bowl"), this.addItem("Red Potion"))
        : this.notify("Carry 2 Red Herbs, an Empty Bottle, and a Medicine Bowl.");
      return;
    }
    if (/vending/.test(t)) {
      if (!this.p.cart) {
        this.notify("Rent a Pushcart from Kafra first.");
        return;
      }
      this.emit("openVending");
      return;
    }
    if (/change cart|cart change/.test(t)) {
      ((this.p.cartStyle = ((this.p.cartStyle || 0) + 1) % 5), this.emit("equip"));
      return;
    }
    if (/appraisal|sense|sight|ruwach|detection/.test(t)) {
      this.emit("openCodex", { monster: I?.spec });
      return;
    }
    if (/repair/.test(t)) {
      this.notify("Your equipment is in good condition.");
      return;
    }
    if (/^amp$/.test(t)) {
      for (let c of Object.keys(this.buffs)) /song|riff|strings|ballet|grace|luck|tablature/.test(c.toLowerCase()) && delete this.buffs[c];
      return;
    }
    if (/encore/.test(t)) {
      Q("Impressive Riff", 30);
      return;
    }
    if (/summon flora|summon marine/.test(t)) {
      (this.summons.length >= 3 && this.summons.shift(),
        this.summons.push({
          x: o.x + 2,
          z: o.z,
          type: t === "summon flora" ? "flora" : "sphere",
          time: t === "summon flora" ? 45 : 5,
          cool: 0,
          level: g,
        }));
      return;
    }
    if (/hocus pocus/.test(t)) {
      let c = ji(yg.monsters, this.rng);
      this.spawnEnemy(c.name, o.x + 4, o.z, { boss: c.boss });
      return;
    }
    if (/remove trap|spring trap/.test(t)) {
      let c = this.traps.find((h) => yA(h, o) < 8);
      c && ((this.traps = this.traps.filter((h) => h !== c)), this.addItem("Trap"));
      return;
    }
    if (/trap|landmine|blast mine|claymore|ankles snare|flasher|sandman|shockwave|^freezing$|talkie/.test(t)) {
      this.traps.push({ x: o.x + Math.sin(o.angle) * 2, z: o.z + Math.cos(o.angle) * 2, name: A.name, level: g, time: 30 });
      return;
    }
    if (/lex aeterna/.test(t)) {
      I && (I.lex = !0);
      return;
    }
    if (/lex divina/.test(t)) {
      I && (I.silence = 8);
      return;
    }
    if (/provoke/.test(t)) {
      I && ((I.def *= 0.65), (I.atk *= 1.15), (I.aggro = !0));
      return;
    }
    if (/divest/.test(t)) {
      I && (/weapon/.test(t) ? (I.atk *= 0.9) : (I.def *= 0.9), (I.aggro = !0));
      return;
    }
    if (/dispel|spell breaker/.test(t)) {
      (I && ((I.skillTime = 12), (I.silence = 5)), (this.telegraphs = []));
      return;
    }
    if (/snatch/.test(t)) {
      I && ((I.x = o.x + 2), (I.z = o.z - 2), this.hit(I, s.atk * 1.5, B));
      return;
    }
    if (/quagmire|decrease agi|slow grace/.test(t)) {
      for (let c of this.enemies.filter((h) => zg(h) && yA(h, o) < 10)) c.slow = 12;
      Q();
      return;
    }
    if (/stone curse/.test(t)) {
      I && !I.boss && ((I.stun = 8), this.hit(I, I.maxHp * 0.12, "Earth", !0));
      return;
    }
    if (/freeze|frost diver|unbarring octave/.test(t)) {
      for (let c of this.enemies.filter((h) => zg(h) && (h === I || yA(h, o) < 6)))
        (c.boss || (c.freeze = 8), this.hit(c, s.matk * (1 + g * 0.1), "Water", !0, !1, !0));
      return;
    }
    if (/hammer fall|dazzler|^root$/.test(t)) {
      for (let c of this.enemies.filter((h) => zg(h) && yA(h, o) < 6)) !c.boss && this.rng() < 0.3 + g * 0.1 && (c.stun = 3);
      return;
    }
    if (/lullaby/.test(t)) {
      for (let c of this.enemies.filter((h) => zg(h) && yA(h, o) < 8)) c.boss || (c.sleep = 12);
      return;
    }
    if (/sanctuary|pneuma|safety wall|ice wall|fire wall|fire pillar|magnetic earth|volcano|whirlwhind|deluge/.test(t)) {
      (this.traps.push({ x: I?.x ?? o.x, z: I?.z ?? o.z, name: A.name, level: g, time: 12, field: !0, tick: 0 }), Q(A.name, 12));
      return;
    }
    if (
      /bless|increase agi|angelus|kyrie|^guard$|coat|quicken|adrenaline|crazy uproar|^fury$|mental strength|magnificat|gloria|sacrifice|defend|resistan|protection|hindsight|perfection|maximize|power thrust|song of|magic strings|impressive riff|tablature|lady luck|focus ballet|gypsy|acoustic|battle theme|harmonic|power chord|classical pluck|down tempo|mental sensing|energy|auto-counter|endure|reflect|react|attention concentrate|magic rod/.test(
        t,
      )
    ) {
      Q();
      return;
    }
    if (/cast cancel/.test(t)) {
      ((this.cast = null), (this.p.sp = fA(this.p.sp + i * 0.9, 0, s.maxSp)));
      return;
    }
    let a = /bolt|ball|storm|gust|thunder|vermilion|pillar|soul|napalm|exorcismus|holy light|spike|drive/.test(t),
      r = rw(e.match(/(\d+)%\s*(?:Damage|MATK|ATK)/i)?.[1], 0),
      E = r ? Math.min(12, r / 100) : /bolt/.test(t) ? 1 + g * 0.65 : 1.3 + g * 0.25;
    (/mammonite/.test(t) && (E = 1 + g * 0.5),
      /guillotine/.test(t) && (E = 10),
      /grand cross/.test(t) && ((E = 2 + g * 0.5), (this.p.hp = Math.max(1, this.p.hp - s.maxHp * 0.12))));
    let l =
      /magnum|bowling|brandish|shower|storm|gust|meteor|vermilion|cart revolution|grand cross|sightless|napalm|fire ball|heaven|bomb|venom|serenade|hip shaker|earth|exorcismus/.test(
        t,
      )
        ? this.enemies.filter((c) => zg(c) && yA(c, I || o) < (/storm|gust|meteor|exorc/.test(t) ? 8 : 4.5))
        : [I];
    for (let c of l)
      if (!(!c || !zg(c))) {
        if (
          (this.hit(c, (a ? s.matk : s.atk) * E, B, a),
          /venom|poison/.test(t) && (c.poison = 10),
          /bash|smite/.test(t) && g >= 6 && this.rng() < 0.3 && !c.boss && (c.stun = 3),
          /bowling|magnum|boomerang|repel|thunder/.test(t))
        ) {
          let h = yA(c, o) || 1;
          ((c.x = fA(c.x + ((c.x - o.x) / h) * 1.6, -22, 22)), (c.z = fA(c.z + ((c.z - o.z) / h) * 1.6, -22, 22)));
        }
        /storm gust/.test(t) && !c.boss && (c.freeze = 4);
      }
  }
  heal(A) {
    let g = this.derived();
    ((this.p.hp = Math.min(g.maxHp, this.p.hp + A)), this.emit("heal", { x: this.player.x, z: this.player.z, text: "+" + Math.round(A) }));
  }
  hit(A, g, I = "Neutral", e = !1, i = !1, t = !1) {
    if (!A || !zg(A)) return 0;
    if (this.trial?.type === "endure") return (this.failTrial("Attacking breaks the vow of endurance."), 0);
    if (A.trialDecoy) return (this.failTrial("That was not a Job Change Monster."), 0);
    let s = this.derived(),
      o = !e && this.rng() * 100 < s.crit,
      B = A.freeze ? "Water 1" : A.element,
      Q = cAA(I, B);
    if ((Number.isFinite(Q) || (Q = 1), !e && !i && this.rng() * 100 > fA(s.hit - A.level * 0.7, 65, 99)))
      return (this.emit("damage", { x: A.x, z: A.z, text: "Miss", kind: "miss" }), (A.aggro = !0), 0);
    let a = g * Q * (o ? 1.5 : 1);
    if (
      (!e && !this.buffs["Weapon Perfection"] && (a *= hAA(s.weapon?.type, A.size)),
      i || (a -= e ? A.mdef : A.def * (A.poison ? 0.75 : 1)),
      e || (a += s.refineAtk),
      A.lex && ((a *= 2), (A.lex = !1)),
      Q < 0)
    )
      return ((A.hp = fA(A.hp + Math.abs(a), 0, A.maxHp)), this.emit("damage", { x: A.x, z: A.z, text: "Absorb", kind: "heal" }), 0);
    if (
      ((a = Q === 0 ? 0 : Math.max(1, Math.round(a * (0.93 + this.rng() * 0.14)))),
      (A.hp -= a),
      (A.aggro = !0),
      (A.attack = 0.2),
      (A.sleep = 0),
      t || (A.freeze = 0),
      (this.sinceCombat = 0),
      Ae(A.spec).assist)
    )
      for (let r of this.enemies) r.spec === A.spec && yA(r, A) < 7 && (r.aggro = !0);
    (this.emit("damage", { x: A.x, z: A.z, text: (o ? "\u2726 " : "") + a, kind: o ? "crit" : "enemy", element: I }),
      this.skillLevel("Double Attack") && this.rng() < this.skillLevel("Double Attack") * 0.05 && !e && (A.hp -= Math.floor(a * 0.7)));
    for (let r of s.cards) {
      let E = r.description.toLowerCase(),
        n = this.rng() < 0.05;
      (n && /poison/.test(E) && (A.poison = 10),
        n && /stun/.test(E) && !A.boss && (A.stun = 3),
        n && /sleep/.test(E) && !A.boss && (A.sleep = 6));
    }
    return (A.hp <= 0 && this.kill(A), a);
  }
  kill(A) {
    if (A.rewarded) return;
    if (
      ((A.rewarded = !0),
      (A.hp = 0),
      (A.deadFor = 0),
      this.target === A.id && (this.target = null),
      this.p.totalKills++,
      (this.p.kills[A.spec] = (this.p.kills[A.spec] || 0) + 1),
      A.training && this.p.trainingKills++,
      A.trialMushroom)
    ) {
      (this.addItem(A.name, 1), this.emit("death", { x: A.x, z: A.z, id: A.id }));
      return;
    }
    if (this.trial && A.trialTarget) {
      (this.trial.progress++, this.trial.progress >= 4 && this.finishTrial());
      return;
    }
    let g = Ae(A.spec),
      I = A.training ? 45 : Math.round(35 + Math.sqrt(g.baseXP || 20) * 22),
      e = A.training ? 65 : Math.round(35 + Math.sqrt(g.jobXP || 15) * 26);
    (this.xp(A.boss ? I * 5 : I, A.boss ? e * 7 : e),
      this.awardZeny(A.boss ? 5e3 + A.level * 120 : 20 + A.level * 8),
      this.p.bounty && Ac(A.name) === Ac(this.p.bounty.name) && this.p.bountyProgress++);
    let i = g.drops.filter((B) => B.length > 1),
      t = i.filter((B) => !["weapon", "armor", "card"].includes(rA(B).kind)),
      s = t.length ? t : ["Jellopy"];
    (this.drop(ji(s, this.rng), A.x, A.z, A.boss ? 5 : 1), this.rng() < 0.4 && this.drop(ji(s, this.rng), A.x + 0.6, A.z + 0.5, 1));
    let o = i.filter((B) => ["weapon", "armor", "card"].includes(rA(B).kind));
    (o.length && this.rng() < (A.boss ? 1 : 0.13) && this.drop(ji(o, this.rng), A.x - 0.6, A.z + 0.5),
      A.boss &&
        (this.addItem("Old Blue Box"),
        this.addItem("Oridecon", 3),
        this.addItem("Elunium", 3),
        this.p.bossesDefeated.includes(A.spec) || this.p.bossesDefeated.push(A.spec),
        A.ward &&
          !this.p.wards.includes(A.ward) &&
          (this.p.wards.push(A.ward),
          this.addItem("Emperium"),
          (this.p.pet = !0),
          this.emit("ward", { key: A.ward, text: `The ${ur.find((B) => B.key === A.ward)?.name} ward is yours.` }),
          this.xp(1800, 6500),
          this.emit("saveRequested")),
        this.p.area === "ember-castle" &&
          ((this.p.castleCleared = !0), this.emit("quest", { text: "The shadow has lifted. Touch the Emperium to seal the oath." }))),
      this.emit("death", { x: A.x, z: A.z, id: A.id, boss: A.boss }));
  }
  drop(A, g, I, e = 1) {
    let i = rA(A),
      t = { id: "l" + this.uid++, item: i.id, name: i.name, count: e, x: g, z: I, time: 90 };
    if ((this.loot.push(t), this.loot.length > 50)) {
      let s = this.loot.shift();
      this.emit("lootRemoved", { id: s.id });
    }
    this.emit("lootSpawn", t);
  }
  win() {
    return this.p.area !== "ember-castle" || !this.p.castleCleared || yA(this.player, { x: 0, z: -18 }) > 4
      ? !1
      : ((this.p.finished = !0), (this.p.endingTime = this.p.playTime), this.emit("ending"), this.emit("saveRequested"), !0);
  }
  damagePlayer(A, g = !1) {
    if (this.dead) return;
    let I = this.derived();
    if (this.isHidden()) return;
    if (this.rng() < Math.min(0.42, I.flee * 0.003)) {
      this.emit("damage", { x: this.player.x, z: this.player.z, text: "Dodge", kind: "miss" });
      return;
    }
    let e = Math.max(2, A - (g ? I.mdef * 0.25 : I.def * 0.3));
    (this.buffs.Guard && this.rng() < 0.1 + this.buffs.Guard.level * 0.02 && (e = 0),
      (this.buffs["Kyrie Eleison"] || this.buffs["Safety Wall"]) && (e *= 0.3),
      this.buffs["Energy Coat"] && ((e *= 0.75), (this.p.sp = Math.max(0, this.p.sp - 1))),
      this.buffs["Mental Strength"] && (e *= 0.15),
      (this.p.hp -= Math.round(e)),
      (this.sinceCombat = 0),
      (this.sitting = !1),
      this.cast &&
        this.p.job !== "Sage" &&
        !I.cards.some((i) => /phen/i.test(i.name)) &&
        ((this.cast = null), this.notify("Casting interrupted. Create some distance.")),
      this.emit("damage", { x: this.player.x, z: this.player.z, text: "\u2212" + Math.round(e), kind: "player" }),
      this.p.hp <= 0 && ((this.p.hp = 0), this.die()));
  }
  isHidden() {
    return Object.keys(this.buffs).some((A) => /^(hide|hiding|cloaking|stalk|play dead)$/i.test(A));
  }
  displace(A, g) {
    let I = this.player;
    if (this.mover) {
      let s = this.mover(I.x, I.z, A, g);
      ((I.x = s.x), (I.z = s.z));
      return;
    }
    let e = (s, o) => this.obstacles.some((B) => Math.abs(s - B.x) < B.w / 2 + 0.38 && Math.abs(o - B.z) < B.d / 2 + 0.38),
      i = fA(I.x + A, -23, 23),
      t = fA(I.z + g, -23, 23);
    (e(i, I.z) || (I.x = i), e(I.x, t) || (I.z = t));
  }
  step(A = uB, g = { x: 0, z: 0 }) {
    if (this.paused || this.dead) return;
    ((A = fA(A, 0, 0.05)),
      (this.time += A),
      (this.p.playTime += A),
      (this.sinceCombat += A),
      (this.attackTimer -= A),
      (this.potionTimer -= A),
      (this.regenTimer += A),
      (this.companionTimer -= A));
    let I = this.player;
    ((I.prevX = I.x),
      (I.prevZ = I.z),
      (this.friend.prevX = this.friend.x),
      (this.friend.prevZ = this.friend.z),
      (I.attack = Math.max(0, I.attack - A)));
    for (let a of Object.keys(this.cooldowns)) ((this.cooldowns[a] -= A), this.cooldowns[a] <= 0 && delete this.cooldowns[a]);
    for (let a of Object.keys(this.buffs)) ((this.buffs[a].time -= A), this.buffs[a].time <= 0 && delete this.buffs[a]);
    for (let a of Object.keys(this.status)) ((this.status[a] -= A), this.status[a] <= 0 && delete this.status[a]);
    let e = this.derived(),
      i = g.x || 0,
      t = g.z || 0,
      s = Math.hypot(i, t) > 0.05;
    s && ((this.path = []), (this.target = null), (this.sitting = !1), (this.interactTarget = null), delete this.buffs["Play Dead"]);
    let o = this.enemies.find((a) => a.id === this.target && zg(a));
    if ((o && yA(I, o) > e.range && !s && !this.path.length && (this.path = TN(I, o, this.obstacles)), this.path.length && !s)) {
      let a = this.path[0],
        r = yA(I, a);
      r < 0.18 ? this.path.shift() : ((i = (a.x - I.x) / r), (t = (a.z - I.z) / r));
    }
    (o && yA(I, o) <= e.range && ((this.path = []), (i = t = 0)),
      (this.sitting || this.buffs["Play Dead"] || this.status.stun || (this.cast && this.p.job !== "Sage")) && (i = t = 0));
    let B = Math.hypot(i, t),
      Q =
        (this.p.mount ? 7 : 4.6) *
        (this.status.slow ? 0.6 : 1) *
        (this.buffs["Increase AGI"] ? 1.2 : 1) *
        (this.weight() / this.maxWeight() > 0.9 ? 0.55 : 1);
    if (
      (B > 0.01
        ? (this.displace((i / Math.max(1, B)) * Q * A, (t / Math.max(1, B)) * Q * A), (I.angle = Math.atan2(i, t)), (I.walk += A * 10))
        : (I.walk = 0),
      this.interactTarget && !this.path.length)
    ) {
      let a = this.npcs.find((r) => r.id === this.interactTarget);
      ((this.interactTarget = null), a && yA(a, I) < 3.6 && this.interact(a));
    }
    if (this.cast && ((this.cast.remaining -= A), this.cast.remaining <= 0)) {
      let a = this.cast.resolve;
      ((this.cast = null), a());
    }
    if (
      o &&
      zg(o) &&
      yA(I, o) <= e.range &&
      this.attackTimer <= 0 &&
      !this.cast &&
      !this.isHidden() &&
      this.weight() / this.maxWeight() < 0.9 &&
      !this.status.stun
    )
      if (e.bow && !this.removeItem(this.p.ammo || "Arrow"))
        (this.notify("Out of the selected arrows. Choose ammunition in your satchel or refill at a Kit Shop."), (this.target = null));
      else {
        if (
          ((I.angle = Math.atan2(o.x - I.x, o.z - I.z)),
          (I.attack = 0.3),
          (this.attackTimer = e.attackDelay),
          this.hit(o, e.atk, e.element),
          e.bow && !o.boss && this.rng() < 0.15)
        ) {
          let a = rA(this.p.ammo || "Arrow").name.toLowerCase();
          (/freezing/.test(a) && (o.freeze = 5),
            /sleep/.test(a) && (o.sleep = 8),
            /stun/.test(a) && (o.stun = 3),
            /poison|rusty/.test(a) && (o.poison = 8),
            /mute|silence/.test(a) && (o.silence = 8));
        }
        (this.emit("attack", { x: I.x, z: I.z, toX: o.x, toZ: o.z, ranged: e.bow }),
          this.p.job === "Hunter" && this.rng() < 0.22 && this.hit(o, 20 + e.DEX + e.INT, "Neutral", !0),
          this.skillLevel("Gank") &&
            this.rng() < 0.2 &&
            !o.stolen &&
            ((o.stolen = !0), this.addItem(ji(Ae(o.spec).drops.length ? Ae(o.spec).drops : ["Jellopy"], this.rng))));
      }
    for (let a of [...this.enemies]) {
      if (((a.prevX = a.x), (a.prevZ = a.z), (a.attack = Math.max(0, a.attack - A)), !zg(a))) {
        a.deadFor += A;
        continue;
      }
      for (let n of ["stun", "freeze", "sleep", "poison", "blind", "silence", "slow"]) a[n] = Math.max(0, (a[n] || 0) - A);
      ((a.attackTime -= A), (a.skillTime -= A));
      let r = Ae(a.spec),
        E = yA(a, I);
      if (a.stun || a.freeze || a.sleep) {
        a.walk = 0;
        continue;
      }
      if (
        (r.aggressive && E < 7 && !this.isHidden() && (a.aggro = !0),
        this.isHidden() && !a.boss && (a.aggro = !1),
        E > 19 && (a.aggro = !1),
        a.aggro && !this.isHidden())
      ) {
        if (((a.angle = Math.atan2(I.x - a.x, I.z - a.z)), E > 1.65)) {
          let n = (a.boss ? 2.4 : 2) * (a.slow ? 0.45 : 1),
            l = ((I.x - a.x) / E) * n * A,
            c = ((I.z - a.z) / E) * n * A,
            h = (u, S) => this.obstacles.some((w) => Math.abs(u - w.x) < w.w / 2 + 0.3 && Math.abs(S - w.z) < w.d / 2 + 0.3);
          (h(a.x + l, a.z) || (a.x += l), h(a.x, a.z + c) || (a.z += c), (a.walk += A * 8));
        } else
          ((a.walk = 0),
            a.attackTime <= 0 &&
              ((a.attackTime = a.boss ? 1.65 : 1.7),
              (a.attack = 0.25),
              this.damagePlayer(a.atk * (a.poison ? 0.8 : 1)),
              /poison spore|mummy|osiris/i.test(a.name) && this.rng() < 0.1 && (this.status.poison = 6)));
        if (
          (a.boss &&
            a.skillTime <= 0 &&
            !a.silence &&
            ((a.skillTime = 6),
            this.telegraphs.push({ x: I.x, z: I.z, r: 3.5, time: 1.7, total: 1.7, damage: a.atk * 1.8 }),
            this.emit("telegraph")),
          a.boss && a.hp / a.maxHp < 0.66 - a.phase * 0.33 && a.phase < 2)
        ) {
          a.phase++;
          for (let n = 0; n < 2; n++) this.spawnEnemy(/osiris/i.test(a.name) ? "Mummy" : "Poring", a.x + (n ? 3 : -3), a.z, { aggro: !0 });
          this.notify(`${a.name} calls for help!`, "danger");
        }
      } else {
        ((a.walk = 0),
          (!a.wanderUntil || this.time > a.wanderUntil) &&
            ((a.wanderUntil = this.time + 3 + this.rng() * 3),
            (a.wanderX = fA(a.spawnX + (this.rng() - 0.5) * 4, -20, 20)),
            (a.wanderZ = fA(a.spawnZ + (this.rng() - 0.5) * 4, -20, 20))));
        let n = Math.hypot(a.wanderX - a.x, a.wanderZ - a.z);
        if (n > 0.2) {
          let l = a.x + ((a.wanderX - a.x) / n) * 0.5 * A,
            c = a.z + ((a.wanderZ - a.z) / n) * 0.5 * A;
          this.obstacles.some((h) => Math.abs(l - h.x) < h.w / 2 + 0.3 && Math.abs(c - h.z) < h.d / 2 + 0.3) ||
            ((a.x = l), (a.z = c), (a.walk += A * 3), (a.angle = Math.atan2(a.wanderX - a.x, a.wanderZ - a.z)));
        }
      }
      if (r.looter && !a.aggro) {
        let n = this.loot.find((l) => yA(l, a) < 1);
        n &&
          ((a.swallowed = a.swallowed || []),
          a.swallowed.push(n),
          (this.loot = this.loot.filter((l) => l !== n)),
          this.emit("lootRemoved", { id: n.id }));
      }
    }
    for (let a of this.enemies)
      if (a.rewarded && a.swallowed?.length) {
        for (let r of a.swallowed) this.drop(r.item, a.x, a.z, r.count);
        a.swallowed = [];
      }
    for (let a of this.telegraphs)
      ((a.time -= A),
        a.time <= 0 &&
          (yA(I, a) < a.r && this.damagePlayer(a.damage, !0),
          this.emit("skill", { name: "Ground surge", element: "Fire", x: a.x, z: a.z })));
    this.telegraphs = this.telegraphs.filter((a) => a.time > 0);
    for (let a of this.traps)
      if (((a.time -= A), a.field)) {
        if (
          ((a.tick = (a.tick || 0) - A),
          a.tick <= 0 && ((a.tick = 1), /sanctuary/i.test(a.name) && yA(a, I) < 4 && this.heal(20 + a.level * 15), /fire/i.test(a.name)))
        )
          for (let r of this.enemies.filter((E) => zg(E) && yA(E, a) < 3)) this.hit(r, e.matk * 0.6, "Fire", !0);
      } else {
        let r = this.enemies.find((E) => zg(E) && yA(E, a) < 2);
        r &&
          (/snare|skid/i.test(a.name)
            ? (r.stun = 4 + a.level)
            : /freezing/i.test(a.name)
              ? (r.freeze = 8)
              : /sandman/i.test(a.name)
                ? (r.sleep = 12)
                : /flasher/i.test(a.name)
                  ? (r.blind = 10)
                  : /shockwave/i.test(a.name)
                    ? (r.silence = 10)
                    : this.hit(r, (e.DEX + e.INT) * a.level * 2, "Earth", !0),
          (a.time = 0),
          this.emit("skill", { name: a.name, x: a.x, z: a.z, element: "Earth" }));
      }
    this.traps = this.traps.filter((a) => a.time > 0);
    for (let a of this.summons)
      if (((a.time -= A), (a.cool -= A), a.type === "sphere" && a.time <= 0)) {
        for (let r of this.enemies.filter((E) => zg(E) && yA(E, a) < 6)) this.hit(r, 250 * a.level, "Fire", !0);
        this.emit("skill", { name: "Marine Sphere", element: "Fire", x: a.x, z: a.z });
      } else if (a.type === "flora" && a.cool <= 0) {
        a.cool = 1;
        let r = this.enemies.find((E) => zg(E) && E.aggro && yA(E, a) < 9);
        r && this.hit(r, 30 + a.level * 20, "Earth", !0);
      }
    if (((this.summons = this.summons.filter((a) => a.time > 0)), this.p.companion)) {
      let a = this.friend,
        r = yA(a, I);
      if (
        (this.p.companionMode === "assist" && r > 2
          ? ((a.x += (I.x - 1.3 - a.x) * A * 3), (a.z += (I.z + 1.5 - a.z) * A * 3), (a.walk = (a.walk || 0) + A * 8))
          : (a.walk = 0),
        this.companionTimer <= 0 && this.p.companionMode === "assist")
      ) {
        this.companionTimer = this.p.companion === "Mira" ? 6 : 2;
        let E = this.enemies.find((n) => zg(n) && n.aggro && yA(n, I) < 8);
        this.p.companion === "Mira" && this.p.hp < e.maxHp * 0.75
          ? this.heal(35 + this.p.base * 4)
          : E && this.hit(E, this.p.companion === "Mira" ? 12 + this.p.base : 18 + this.p.base * 2, "Neutral", !1);
      }
    }
    if (this.regenTimer >= 1) {
      if (((this.regenTimer -= 1), this.weight() / this.maxWeight() < 0.5 && !this.status.poison)) {
        let E = this.sitting ? 2 : 1;
        (this.sinceCombat > 5 || this.sitting) &&
          ((this.p.hp = Math.min(e.maxHp, this.p.hp + (2 + e.VIT * 0.3 + this.p.base * 0.25) * E)),
          this.buffs.spLock || (this.p.sp = Math.min(e.maxSp, this.p.sp + (2 + e.INT * 0.18) * E)));
      }
      (this.status.poison && (this.p.hp = Math.max(1, this.p.hp - e.maxHp * 0.02)),
        this.buffs["Song of Lutie"] && this.heal(15 + this.skillLevel("Song of Lutie") * 8));
      for (let E of this.enemies) zg(E) && E.poison && (E.hp = Math.max(1, E.hp - E.maxHp * 0.012));
      for (let E of this.loot) ((E.time -= 1), this.p.pet && yA(E, I) < 4 && this.pickup(E.id));
      let r = this.loot.filter((E) => E.time <= 0);
      for (let E of r) this.emit("lootRemoved", { id: E.id });
      ((this.loot = this.loot.filter((E) => E.time > 0)),
        this.p.guild && (this.p.guild.level = 1 + Math.floor(Math.sqrt(this.p.guild.xp / 1e3))),
        (this.changed = !0));
    }
    if (((this.respawnTimer += A), this.respawnTimer > 14 && !this.trial && this.area.kind !== "city")) {
      this.respawnTimer = 0;
      let a = this.enemies.filter((r) => !zg(r) && !r.boss && r.deadFor > 10).slice(0, 3);
      for (let r of a)
        ((this.enemies = this.enemies.filter((E) => E !== r)), this.spawnEnemy(r.spec, r.spawnX, r.spawnZ, { training: r.training }));
    }
    if (this.trial) {
      let a = this.trial;
      if (a.type === "mushrooms" && this.count("Gooey Mushroom") + this.count("Net Mushroom") * 3 >= 25) {
        this.finishTrial();
        return;
      }
      if (!["mushrooms", "battle", "selective"].includes(a.type)) {
        let r = a.points[a.progress];
        if (
          r &&
          yA(I, r) < 1.4 &&
          (a.progress++, this.emit("pickup", { text: `Trial marker ${a.progress} / ${a.points.length}` }), a.progress >= a.points.length)
        ) {
          this.finishTrial();
          return;
        }
        a.type === "ledges" && this.path.length === 0 && Math.abs(I.x) > 9 && this.failTrial("You stepped off the training ledge.");
      }
    }
    this.p.area === "ember-castle" && this.p.castleCleared && yA(I, { x: 0, z: -18 }) < 2.5 && !this.p.finished && this.win();
    for (let a of this.portals)
      if (yA(I, a) < 1.4 && this.time > (this.lastPortal || 0) + 3) {
        if (((this.lastPortal = this.time), a.to === "atlas")) this.emit("openAtlas");
        else if (a.to === "exit-trial") {
          let r = this.trial?.returnArea || "prontera";
          ((this.trial = null), this.loadArea(r));
        } else this.loadArea(a.to);
        break;
      }
    ((this.p.x = I.x), (this.p.z = I.z));
  }
};
function P2(C) {
  let A = [...SI.values()]
    .filter((g) => g.city === C && g.kind === "field")
    .flatMap((g) => g.monsters)
    .filter((g) => !Ae(g).boss);
  return [...new Set(A.length ? A : ["Poring"])];
}
function DAA(C, A = null) {
  let g = WN[C.theme] || WN.meadow,
    I = b2(ic(C.id)),
    e = [],
    i = [],
    t = [],
    s = [],
    o = [],
    B = [],
    Q = (p, m, f, J, x, O, V, P, eA = {}) => {
      let tA = { type: p, x: m, y: f, z: J, w: x, h: O, d: V, color: P, ...eA };
      return (e.push(tA), tA);
    },
    a = (p, m, f, J, x, O, V, P) => Q("box", p, m, f, J, x, O, V, P),
    r = (p, m, f, J, x, O, V) => Q("cylinder", p, m, f, J * 2, x, J * 2, O, V),
    E = (p, m, f, J, x = 3) => i.push({ x: p, z: m, w: f, d: J, h: x }),
    n = (p, m, f, J = g.ground, x = 0.17) => r(p, m, f, x, 0.11, J, { detail: !0 }),
    l = (p, m, f, J, x, O = "#87a59d") => t.push({ id: p, name: m, role: f, x: J, z: x, color: O }),
    c = (p, m, f, J) => {
      (s.push({ id: "gate-" + s.length, x: p, z: m, to: f, label: J }), r(p, 0.08, m, 1.15, 0.16, LI(g.path, "#fbf7d9", 0.6)));
      for (let x of [-1, 1]) (a(p + x * 1.45, 1.4, m, 0.5, 2.8, 0.65, g.wall), n(p + x * 1.45, 2.87, m, g.wall, 0.2));
      Q("torus", p, 1.4, m, 2.25, 2.65, 0.14, g.accent, { emissive: 0.35, vertical: !0, portal: !0 });
    },
    h = (p, m) => {
      for (let f = 0; f < 4; f++) {
        let J = p + (I() - 0.5) * 1.7,
          x = m + (I() - 0.5) * 1.2;
        (r(J, 0.23, x, 0.04, 0.4, "#738663"), r(J, 0.44, x, 0.17, 0.1, ji(["#e8b289", "#e6d6a2", "#dac4d7"], I), { detail: !0 }));
      }
    },
    u = (p, m, f = 1) => {
      (E(p, m, 0.75, 0.75, 3), r(p, f * 1.1, m, 0.27 * f, f * 2.2, "#8b7555"));
      let J = C.theme === "snow" ? "#d6e2d8" : g.leaf;
      for (let [x, O, V, P] of [
        [0, 2.8, 0, 1.4],
        [-0.6, 2.45, 0.45, 1.05],
        [0.65, 2.5, -0.25, 1.1],
        [0, 3.7, 0, 0.85],
      ])
        Q("ico", p + x * f, O * f, m + V * f, P * 2 * f, P * 1.8 * f, P * 2 * f, LI(J, "#d9dc9d", O * 0.028));
      n(p, 4.43 * f, m, LI(J, "#d9dc9d", 0.12), 0.25 * f);
    },
    S = (p, m) => {
      (a(p, 0.15, m, 0.65, 0.3, 0.65, g.edge),
        a(p, 1.6, m, 0.15, 2.8, 0.15, "#656659"),
        a(p, 3.03, m, 0.6, 0.16, 0.6, "#6e715f"),
        a(p, 2.69, m, 0.36, 0.6, 0.36, "#f5dca3", { emissive: 0.45 }),
        Q("roof", p, 3.22, m, 0.85, 0.36, 0.8, "#737969"));
    },
    w = (p, m, f = 5, J = 4, x = g.roof, O = !1) => {
      (E(p, m, f, J, 5), a(p, 0.2, m, f + 0.6, 0.4, J + 0.6, g.edge), a(p, 1.75, m, f, 3.1, J, g.wall));
      for (let V = 0.65; V < 3; V += 0.75) a(p, V, m, f + 0.06, 0.095, J + 0.06, LI(g.wall, g.edge, 0.13), { detail: !0 });
      for (let V of [-f / 2 + 0.14, f / 2 - 0.14, 0]) a(p + V, 1.8, m + J / 2 + 0.04, 0.18, 3, 0.18, "#82705c");
      for (let V of [-J / 2 + 0.08, J / 2 - 0.08]) a(p - f / 2 - 0.03, 1.8, m + V, 0.14, 3, 0.14, "#82705c");
      (a(p, 1.27, m + J / 2 + 0.1, 1.02, 2.08, 0.15, "#8a7255"),
        a(p, 2.4, m + J / 2 + 0.2, 1.27, 0.23, 0.3, "#77694f"),
        a(p, 0.35, m + J / 2 + 0.5, 1.65, 0.4, 0.9, g.path),
        a(p, 0.12, m + J / 2 + 1, 2, 0.25, 0.7, g.path));
      for (let V of [-f * 0.29, f * 0.29])
        (a(p + V, 1.92, m + J / 2 + 0.13, 0.92, 1.1, 0.15, "#788f8d"),
          a(p + V, 1.9, m + J / 2 + 0.23, 0.075, 1, 0.09, "#f6dfa9"),
          a(p + V, 1.9, m + J / 2 + 0.24, 0.85, 0.08, 0.09, "#f6dfa9"),
          a(p + V, 1.22, m + J / 2 + 0.26, 1.1, 0.19, 0.42, "#988269"));
      (a(p, 3.28, m, f + 0.45, 0.24, J + 0.55, LI(x, "#564b42", 0.2)), Q("roof", p, 4.28, m, f + 1, 2, J + 0.9, x));
      for (let V = 0; V < 3; V++) {
        let P = 3.63 + V * 0.46,
          eA = (f + 1) * (1 - (V + 0.3) / 4);
        a(p, P, m, eA, 0.12, J + 0.95, LI(x, "#edc19f", 0.11), { detail: !0 });
      }
      (O && (Q("roof", p, 5.36, m, f * 0.65, 1.3, J * 0.65, x), a(p, 4.9, m, f * 0.7, 0.3, J * 0.7, g.wall)),
        a(p + f * 0.29, 4.62, m - 0.6, 0.63, 1.5, 0.7, "#b89176"),
        a(p + f * 0.29, 5.42, m - 0.6, 0.83, 0.2, 0.9, "#d3b899"));
      for (let V of [-0.2, 0.2]) n(p + f * 0.29 + V, 5.58, m - 0.6, "#bca78b", 0.12);
      h(p + f * 0.4, m + J / 2 + 0.9);
    },
    k = (p, m, f = 2, J = 6) => {
      (E(p, m, f * 1.65, f * 1.65, J),
        r(p, J / 2, m, f, J, g.wall),
        r(p, 0.25, m, f + 0.3, 0.5, g.path),
        r(p, J - 0.4, m, f + 0.18, 0.35, g.path));
      for (let x = 1; x < J; x += 1.05) r(p, x, m, f + 0.03, 0.1, LI(g.wall, g.edge, 0.17), { detail: !0 });
      for (let x = 0; x < 8; x++) {
        let O = (x * Math.PI) / 4;
        (a(p + Math.sin(O) * f * 0.86, J + 0.05, m + Math.cos(O) * f * 0.86, 0.7, 0.8, 0.7, g.wall),
          n(p + Math.sin(O) * f * 0.86, J + 0.51, m + Math.cos(O) * f * 0.86, g.wall, 0.22));
      }
      a(p, J * 0.65, m + f, 0.55, 1.3, 0.12, "#738783");
    };
  (a(0, -0.65, 0, 49, 1.1, 49, g.edge),
    a(0, -0.07, 0, 48, 0.35, 48, g.ground),
    C.theme === "coast" &&
      (a(0, -0.1, 0, 48, 0.15, 48, g.water, { water: !0 }),
      a(0, 0.03, -1, 35, 0.38, 39, g.ground),
      E(-21, 0, 6, 48, 0.2),
      E(21, 0, 6, 48, 0.2)));
  let M = ["city", "training"].includes(C.kind),
    N = C.kind === "dungeon";
  if (M) {
    (a(0, 0.16, 0, 5, 0.15, 45, g.path), a(0, 0.17, 1, 43, 0.15, 4.5, g.path), r(0, 0.19, -1, 5.7, 0.13, g.path));
    for (let p = -21; p < 22; p += 1.5)
      for (let m of [-1.6, 0, 1.6]) a(m, 0.27, p, 1.42, 0.07, 1.32, LI(g.path, "#f2ecd8", I() * 0.18), { detail: !0 });
    for (let p = -19; p < 20; p += 1.7)
      if (Math.abs(p) > 3) for (let m of [-0.5, 1, 2.5]) a(p, 0.27, m, 1.55, 0.07, 1.3, LI(g.path, "#eee8d9", I() * 0.2), { detail: !0 });
    (E(0, -1, 4.6, 4.6, 2),
      r(0, 0.45, -1, 2.65, 0.45, "#d9d3b7"),
      r(0, 0.75, -1, 2.32, 0.38, "#efdfb9"),
      r(0, 0.97, -1, 1.98, 0.14, g.water, { water: !0 }),
      r(0, 1.42, -1, 0.4, 1.04, "#e2d5b7"),
      r(0, 1.95, -1, 1.1, 0.22, "#ede1c5"),
      r(0, 2.09, -1, 0.9, 0.12, g.water, { water: !0 }),
      Q("ico", 0, 2.52, -1, 0.32, 0.72, 0.32, "#b0dadd", { emissive: 0.15 }));
    for (let p = 0; p < 8; p++) {
      let m = (p * Math.PI) / 4;
      n(Math.sin(m) * 2.43, 0.75, Math.cos(m) * 2.43 - 1, "#e7dec6", 0.22);
    }
    if (C.id === "morroc") {
      (w(-11, -9, 6, 5, g.roof), w(11, -9, 6, 5, g.roof));
      for (let p = 0; p < 6; p++) a(-15, 0.4 + p * 0.65, -18, 8 - p, 0.7, 8 - p, LI(g.wall, g.roof, p * 0.035));
      a(0, 0.16, -14, 9, 0.15, 5, g.water, { water: !0 });
    } else if (["geffen", "al-de-baren", "juno"].includes(C.id))
      (k(0, -14, 2.8, 8),
        Q("cone", 0, 10.3, -14, 7, 4.2, 7, g.roof),
        r(0, 12.55, -14, 0.18, 0.5, "#e4c17f"),
        w(-11, -10, 5, 4),
        w(11, -10, 5, 4),
        C.id === "al-de-baren" &&
          (r(0, 6, -10.9, 1, 0.15, "#e9d9b6", { vertical: !0 }),
          a(0, 6.25, -10.76, 0.1, 0.65, 0.1, "#676b60"),
          a(0.3, 6, -10.74, 0.65, 0.1, 0.1, "#676b60")));
    else if (["payon", "archer-village", "monastery"].includes(C.id))
      (w(0, -15, 7, 5, g.roof, !0), w(-11, -9, 5, 4, g.roof, !0), w(11, -9, 5, 4, g.roof, !0));
    else {
      (w(-11, -9, 5.5, 4.5),
        w(11, -9, 5.5, 4.5),
        k(-5.2, -19, 1.65, 5.5),
        k(5.2, -19, 1.65, 5.5),
        a(0, 4, -19, 7, 1.2, 2.7, g.wall),
        a(-2.7, 1.7, -19, 1.2, 3.4, 2.6, g.wall),
        a(2.7, 1.7, -19, 1.2, 3.4, 2.6, g.wall),
        E(-2.8, -19, 1.3, 2.7),
        E(2.8, -19, 1.3, 2.7));
      for (let p = -3; p <= 3; p++) a(p, 4.9, -19, 0.55, 0.65, 2.8, g.wall);
    }
    (w(-12, 10, 5.2, 4, LI(g.roof, "#7b8c83", 0.25)), w(12, 10, 5.2, 4, LI(g.roof, "#d99565", 0.22)));
    for (let [p, m, f] of [
      [-18, -16, 1.25],
      [18, -16, 1.3],
      [-20, -6, 0.9],
      [19, 7, 1.15],
      [-19, 17, 1.1],
      [19, 18, 1.2],
      [-7, 17, 0.85],
      [7, 17, 0.75],
      [-7, -4, 0.7],
      [7, -4, 0.7],
    ])
      u(p, m, f);
    for (let [p, m] of [
      [-3.8, 6],
      [3.8, 6],
      [-3.8, -8],
      [3.8, -8],
      [-8, 3.9],
      [8, 3.9],
    ])
      S(p, m);
    for (let [p, m, f] of [
      [-8, 5, "#bd8268"],
      [8, 5, "#829b86"],
    ]) {
      a(p, 0.7, m, 3, 1.2, 1.2, "#b79a70");
      for (let J of [-1.3, 1.3]) a(p + J, 1.8, m, 0.12, 2.1, 0.12, "#897559");
      a(p, 2.9, m, 3.4, 0.18, 2, f);
      for (let J = -1; J <= 1; J++) a(p + J * 0.8, 2.91, m, 0.4, 0.19, 2, "#f1deb7");
      for (let J = 0; J < 3; J++) Q("ico", p - 1 + J, 1.5, m, 0.43, 0.45, 0.4, ["#d0a26b", "#d3b979", "#b48994"][J]);
    }
    for (let p of [-6.6, 6.6]) {
      (a(p, 0.6, -1, 1.1, 0.15, 2.2, "#9b8765"), a(p, 0.95, -1, 0.17, 0.7, 2.2, "#a79674"));
      for (let m of [-1.65, -0.35]) a(p, 0.28, m, 0.75, 0.56, 0.17, "#766c55");
    }
    if (
      (l("mentor", "Mira \xB7 Guide", "mentor", -4.5, 5.2, "#dfc17e"),
      l("kafra", "Kafra \xB7 Rest & storage", "kafra", 4.5, 5.2, "#95a7a0"),
      l("shop", "Kit Shop", "shop", 8.3, 3.3, "#bf8d6c"),
      l("smith", "Refiner & artisan", "forge", -8.3, 3.3, "#ac8c6b"),
      l("guild", "Guild Master", "guild", -4.3, -9.8, "#9c899e"),
      l("board", "Adventurers\u2019 board", "board", 4.3, -9.8, "#789697"),
      l(
        "quartermaster",
        C.id === "lutie" ? "Snow Man" : C.id === "monastery" ? "Hermit" : "Quartermaster",
        "quartermaster",
        7,
        -14,
        "#b29e7f",
      ),
      l("master", C.id === "juno" ? "The two brothers" : "Tower Master", "master", 0, -11, "#a1a2b2"),
      a(4.3, 1.8, -11, 2.2, 1.5, 0.2, "#957c5e"),
      a(4.3, 1.8, -10.86, 1.85, 1.18, 0.08, "#e7d7b2"),
      a(4.3, 0.65, -11, 0.2, 1.3, 0.2, "#957c5e"),
      C.id === "training")
    )
      (c(0, -22, "prontera", "Prontera"), c(0, 22, "field-40", "Practice meadow"));
    else {
      let p = K2(C.id).filter((f) => f.kind === "field"),
        m = K2(C.id).filter((f) => f.kind === "dungeon");
      (c(0, 22, p[0]?.id || "field-40", p[0]?.name || "Meadow"),
        c(-22, 1, "atlas", "Rune-Midgard"),
        c(22, 1, "atlas", C.id === "alberta" ? "The harbour" : "Town roads"),
        m.length && c(0, -22, m[0].id, m[0].name));
    }
    if (C.id === "alberta" || C.id === "izlude") {
      for (let p = 0; p < 9; p++) a(19, 0.4, -8 + p, 6, 0.22, 0.9, "#bca077");
      (a(20, 1.1, -4, 3.5, 1.4, 8, "#987d5b"),
        a(20, 2, -4, 4, 0.15, 8.5, "#c1a67d"),
        a(20, 5, -4, 0.16, 6, 0.16, "#967d60"),
        Q("sail", 20, 5, -4, 3.2, 4.6, 0.06, "#f3e5c6"));
    }
  } else if (C.kind === "trial") {
    if ((a(0, 0.15, 0, 7, 0.2, 43, g.path), A?.type === "maze"))
      for (let p = 0; p < 5; p++) {
        let m = p % 2 ? 4 : -4,
          f = 8 - p * 4;
        (a(m, 1.2, f, 9, 2.4, 0.8, g.wall), E(m, f, 9, 0.8, 2.4));
      }
    if (A?.type === "ledges") {
      for (let p = 0; p < 5; p++) {
        let m = p % 2 ? 9 : -9,
          f = 8 - p * 5;
        a(m, 0.25, f, 9, 0.4, 3, g.water, { water: !0 });
      }
      a(6, 0.15, 0, 3, 0.25, 14, g.path);
    }
    for (let p of A?.points || []) r(p.x, 0.22, p.z, 0.9, 0.22, g.accent, { emissive: 0.25, marker: !0 });
    c(0, 22, "exit-trial", "Return to guild");
    for (let p of [-18, 18]) for (let m of [-16, -8, 0, 8, 16]) k(p, m, 1.1, 2.7);
  } else {
    if ((a(0, 0.15, 0, 6, 0.16, 45, g.path), N)) {
      for (let J = -20; J <= 20; J += 4)
        for (let x = -20; x <= 20; x += 4) a(J, 0.17, x, 3.85, 0.16, 3.85, LI(g.path, g.ground, I() * 0.16), { detail: !0 });
      for (let J = 0; J < 16; J++) {
        let x = (J % 2 ? 1 : -1) * (7 + I() * 11),
          O = -17 + Math.floor(J / 2) * 4.5,
          V = 2 + I() * 2,
          P = 1.5 + I() * 2,
          eA = 1.5 + I() * 2;
        (a(x, eA / 2 + 0.2, O, V, eA, P, g.wall), E(x, O, V, P, eA));
        for (let tA = 0.5; tA < eA; tA += 0.6) a(x, tA, O, V + 0.08, 0.1, P + 0.08, LI(g.wall, g.edge, 0.22), { detail: !0 });
        for (let tA = 0; tA < 3; tA++) n(x - V * 0.3 + tA * V * 0.3, eA + 0.27, O, g.wall, 0.22);
      }
      for (let J of [-22, 22]) a(J, 1.2, 0, 0.9, 2.4, 45, g.edge);
      for (let J of [-22, 22]) (a(-13, 1.2, J, 18, 2.4, 0.9, g.edge), a(13, 1.2, J, 18, 2.4, 0.9, g.edge));
      for (let [J, x] of [
        [-4, 10],
        [4, 10],
        [-4, -9],
        [4, -9],
        [-18, 0],
        [18, 0],
      ])
        S(J, x);
      if (
        (C.theme === "coast" && (a(-13, 0.24, -4, 7, 0.16, 5, g.water, { water: !0 }), a(13, 0.24, 7, 7, 0.16, 5, g.water, { water: !0 })),
        C.theme === "desert")
      )
        for (let J = 0; J < 4; J++) a(0, 0.4 + J * 0.5, -17, 7 - J, 0.5, 7 - J, g.wall);
      C.id === "ember-castle" &&
        (r(0, 0.7, -18, 3, 0.8, g.wall),
        Q("crystal", 0, 2.8, -18, 1.65, 3.7, 1.65, "#e1bd75", { emissive: 0.25 }),
        k(-5, -18, 1, 4),
        k(5, -18, 1, 4));
    } else {
      for (let J = 0; J < 28; J++) {
        let x = (J % 2 ? 1 : -1) * (6 + I() * 15),
          O = -20 + I() * 40;
        C.theme === "desert"
          ? (Q("ico", x, 0.7, O, 1.6, 1.4, 1.3, LI(g.edge, g.wall, 0.2)),
            E(x, O, 1.2, 1.2, 1.1),
            J % 3 === 0 && (a(x + 1, 1.4, O, 0.5, 2.8, 0.5, "#8b9c70"), a(x + 1.4, 1.7, O, 1.2, 0.4, 0.4, "#8b9c70")))
          : u(x, O, 0.7 + I() * 0.5);
      }
      for (let J = 0; J < 12; J++) h((I() - 0.5) * 32, (I() - 0.5) * 36);
    }
    let p = C.name.match(/^(.*?) Level (\d+)$/),
      m = p ? [...SI.values()].find((J) => J.name === `${p[1]} Level ${+p[2] + 1}`) : null,
      f = p && +p[2] > 1 ? [...SI.values()].find((J) => J.name === `${p[1]} Level ${+p[2] - 1}`) : null;
    (c(0, 22, f?.id || C.city || "prontera", f?.name || Js.find((J) => J.id === C.city)?.name || "Town"),
      m
        ? c(0, -22, m.id, m.name)
        : C.kind === "field" && c(0, -22, SI.has("field-" + (C.number + 1)) ? "field-" + (C.number + 1) : C.city, "The onward road"),
      c(-22, 0, "atlas", "Expedition atlas"));
    for (let J = 0; J < 20; J++) {
      let x,
        O,
        V = 0;
      do ((x = (J % 2 ? 1 : -1) * (3 + I() * 14)), (O = 9 - I() * 25));
      while (i.some((P) => Math.abs(x - P.x) < P.w / 2 + 1 && Math.abs(O - P.z) < P.d / 2 + 1) && ++V < 100);
      o.push({ x, z: O });
    }
  }
  for (let p = 0; p < (M ? 130 : 70); p++) {
    let m = (I() - 0.5) * 43,
      f = (I() - 0.5) * 42;
    Math.abs(m) < 3.5 ||
      Math.abs(f - 1) < 3 ||
      i.some((J) => Math.abs(m - J.x) < J.w / 2 + 1 && Math.abs(f - J.z) < J.d / 2 + 1) ||
      n(m, 0.26, f, LI(g.ground, "#e5dfb1", 0.08), 0.17);
  }
  for (let [p, m] of [
    [-6, 10],
    [7, 11],
    [-9, -2],
  ])
    B.push({ x: p, z: m, w: 0.8, h: 0.8, d: 0.8, color: "#b3966c" });
  return { parts: e, obstacles: i, npcs: t, portals: s, spawns: o, props: B, palette: g, spawn: { x: 0, z: M ? 8 : 14 }, kind: C.kind };
}
function wB({ color: C = "#bd8f64", hair: A = "#7896aa", kind: g = "hero", job: I = "Novice", hat: e = !1, mount: i = !1 } = {}) {
  let t = [],
    s = (E, n, l, c, h, u, S, w, k) => t.push({ type: E, x: n, y: l, z: c, w: h, h: u, d: S, color: w, anim: k }),
    o = (E, n, l, c, h, u, S, w) => s("box", E, n, l, c, h, u, S, w),
    B = "#e9c69f",
    Q = "#716c59",
    a = "#e1d1ab";
  for (let E of [-1, 1])
    (o(E * 0.23, 0.32, 0, 0.35, 0.62, 0.44, "#dfd3b6", E < 0 ? "legL" : "legR"),
      o(E * 0.23, 0.1, 0.1, 0.4, 0.25, 0.63, Q, E < 0 ? "legL" : "legR"));
  (o(0, 0.94, 0, 0.91, 0.94, 0.61, C, "body"),
    o(0, 0.66, 0.01, 0.95, 0.14, 0.66, a, "body"),
    o(0.04, 0.65, 0.36, 0.2, 0.17, 0.07, "#b5965e", "body"));
  for (let E of [-1, 1])
    (o(E * 0.63, 1.03, 0, 0.3, 0.73, 0.37, C, E < 0 ? "armL" : "armR"),
      s("cylinder", E * 0.63, 0.63, 0, 0.28, 0.3, 0.28, B, E < 0 ? "armL" : "armR"));
  (s("cylinder", 0, 1.87, 0, 1.04, 0.85, 1.04, B, "head"),
    s("cylinder", 0, 2.28, -0.03, 1.12, 0.24, 1.08, A, "head"),
    o(0, 2.2, -0.41, 0.98, 0.55, 0.28, A, "head"));
  for (let [E, n] of [
    [-0.38, 2.17],
    [-0.1, 2.22],
    [0.22, 2.17],
  ])
    o(E, n, 0.43, 0.3, 0.28, 0.24, A, "head");
  s("cylinder", 0, 2.46, -0.03, 0.32, 0.16, 0.32, A, "head");
  for (let E of [-0.2, 0.2])
    (o(E, 1.92, 0.48, 0.085, 0.115, 0.065, "#505a57", "head"), o(E * 1.55, 1.74, 0.47, 0.14, 0.06, 0.04, "#d69c86", "head"));
  (o(0, 1.69, 0.516, 0.13, 0.045, 0.04, "#ad8269", "head"),
    o(0, 1.35, 0.39, 0.65, 0.18, 0.18, "#efe0b5", "body"),
    o(-0.15, 1.02, 0.37, 0.17, 0.59, 0.12, "#eee0b5", "body"));
  let r = fC(I);
  return (
    g === "hero" &&
      (r === "Archer"
        ? (s("torus", 0.75, 1.03, 0.3, 0.8, 1.65, 0.13, "#9a7b51", "weapon"), o(0.75, 1.05, 0.3, 0.055, 1.5, 0.07, "#e5d2ac", "weapon"))
        : r === "Magician" || r === "Acolyte"
          ? (o(0.75, 1.25, 0.15, 0.13, 2.1, 0.13, "#9c8261", "weapon"),
            s("crystal", 0.75, 2.42, 0.15, 0.35, 0.6, 0.35, r === "Magician" ? "#95bdd4" : "#edcd84", "weapon"))
          : (o(0.77, 1.21, 0.3, 0.19, 1.3, 0.12, "#d7e0d5", "weapon"),
            o(0.77, 0.64, 0.3, 0.67, 0.12, 0.17, "#cdb478", "weapon"),
            o(0.77, 0.42, 0.3, 0.14, 0.35, 0.15, "#8d735d", "weapon")),
      o(0, 1.05, -0.47, 0.7, 0.85, 0.3, "#947958", "body"),
      o(0, 1.3, -0.66, 0.35, 0.35, 0.12, "#ae956b", "body")),
    e && (o(0, 2.5, 0, 1.32, 0.18, 1.12, "#cab37d", "head"), o(0, 2.76, -0.1, 0.82, 0.48, 0.78, "#d8c18e", "head")),
    i &&
      (s("dome", 0, -0.1, 0, 1.8, 1.2, 2.1, "#d7b778"),
      s("dome", 0, 0.4, 0.95, 0.7, 0.8, 0.7, "#d7b778"),
      s("cone", 0, 0.32, 1.44, 0.4, 0.25, 0.5, "#bf8d57")),
    t
  );
}
function nw(C) {
  let A = C.name.toLowerCase(),
    g = Ae(C.spec),
    I = [],
    e = (t, s, o, B, Q, a, r, E) => I.push({ type: t, x: s, y: o, z: B, w: Q, h: a, d: r, color: E }),
    i = /drop|mastering/.test(A)
      ? "#dbb078"
      : /poporing/.test(A)
        ? "#a5ba80"
        : /marin|ghostring/.test(A)
          ? "#a7c7d1"
          : /angeling/.test(A)
            ? "#e2bdcc"
            : "#dea2b1";
  if (/poring|drops|marin$|ring$|mastering/.test(A)) {
    (e("dome", 0, 0.5, 0, 1.36, 1.06, 1.32, i), e("cylinder", 0, 1.06, -0.08, 0.29, 0.12, 0.29, i));
    for (let t of [-0.24, 0.24]) e("box", t, 0.53, 0.57, 0.075, 0.095, 0.05, "#5c5960");
    for (let t of [-0.4, 0.4]) e("box", t, 0.4, 0.52, 0.18, 0.055, 0.05, "#c988a2");
    (e("box", 0, 0.36, 0.65, 0.15, 0.042, 0.03, "#a27485"),
      /angeling/.test(A) &&
        (e("box", -0.91, 0.65, 0, 0.65, 0.18, 0.5, "#efe9d8"),
        e("box", 0.91, 0.65, 0, 0.65, 0.18, 0.5, "#efe9d8"),
        e("torus", 0, 1.4, 0, 0.68, 0.12, 0.68, "#e1c97e")));
  } else if (/marine sphere/.test(A)) {
    (e("dome", 0, 0.9, 0, 1.45, 1.6, 1.45, "#a5c8cc"), e("ico", 0, 0.9, 0, 0.6, 0.7, 0.6, "#cfbb83"));
    for (let t of [-0.22, 0.22]) e("box", t, 1.1, 0.64, 0.1, 0.13, 0.06, "#5b727e");
  } else if (/mushroom|spore/.test(A)) {
    (e("cylinder", 0, 0.45, 0, 0.5, 0.85, 0.5, "#ddcca6"), e("dome", 0, 1.1, 0, 1.7, 0.8, 1.6, /poison/.test(A) ? "#a58bb7" : "#be8470"));
    for (let [t, s] of [
      [-0.45, 0.35],
      [0.4, 0.2],
      [0, -0.45],
    ])
      e("cylinder", t, 1.37, s, 0.3, 0.11, 0.3, "#eee1c4");
    for (let t of [-0.15, 0.15]) e("box", t, 0.61, 0.25, 0.08, 0.1, 0.06, "#5b6358");
  } else if (/lunatic|rabbit/.test(A)) {
    e("dome", 0, 0.5, 0, 1.2, 1.05, 1.3, "#e4dcd3");
    for (let t of [-0.27, 0.27])
      (e("box", t, 1.32, -0.15, 0.24, 0.95, 0.25, "#e4dcd3"),
        e("box", t, 1.39, 0, 0.1, 0.63, 0.03, "#d8a4ab"),
        e("box", t, 0.56, 0.54, 0.07, 0.1, 0.05, "#5f605c"));
    e("ico", 0, 0.4, -0.66, 0.5, 0.5, 0.5, "#e4dcd3");
  } else if (/fabre|pupa|argiope/.test(A)) {
    for (let t = 0; t < 3; t++) e("dome", 0, 0.36, -0.45 + t * 0.45, 1 - 0.1 * t, 0.73, 0.74, ["#93ac6b", "#a7bb7e", "#b8c688"][t]);
    for (let t of [-0.2, 0.2]) e("box", t, 0.44, 0.81, 0.07, 0.1, 0.05, "#585f4e");
  } else if (/bug|andre|deniro|pierre|vitata|scorpion|hornet|chonchon|ant |arg[o]?s|mantis|fly/.test(A)) {
    ((i = C.boss ? "#d4b266" : /deniro/.test(A) ? "#c08b76" : /pierre/.test(A) ? "#a998be" : "#9baf7c"),
      e("dome", 0, 0.5, 0, 1.18, 0.9, 1.6, i),
      e("dome", 0, 0.53, 0.83, 0.85, 0.65, 0.7, i));
    for (let t of [-0.8, 0.8]) for (let s of [-0.45, 0.15, 0.55]) e("box", t, 0.2, s, 0.65, 0.17, 0.18, "#776e58");
    e("box", 0, 0.76, 0, 0.09, 0.22, 1.5, LI(i, "#606658", 0.4));
    for (let t of [-0.2, 0.2]) e("box", t, 0.58, 1.16, 0.07, 0.11, 0.05, "#586152");
    /fly|chonchon|hornet/.test(A) && (e("box", -0.78, 0.9, 0, 1, 0.08, 0.65, "#d4ddd0"), e("box", 0.78, 0.9, 0, 1, 0.08, 0.65, "#d4ddd0"));
  } else if (/willow|plant|mandragora|flora|geographer/.test(A)) {
    (e("cylinder", 0, 0.65, 0, 0.85, 1.3, 0.85, "#b69872"),
      e("ico", 0, 1.6, 0, 1.9, 1.8, 1.6, "#8caa75"),
      e("box", -0.75, 1, 0, 0.8, 0.25, 0.3, "#a9936c"),
      e("box", 0.75, 1, 0, 0.8, 0.25, 0.3, "#a9936c"));
    for (let t of [-0.2, 0.2]) e("box", t, 0.75, 0.43, 0.1, 0.16, 0.04, "#655f4e");
  } else if (/picky|peco|condor|bird|raggler/.test(A)) {
    (e("dome", 0, 0.7, 0, 1.12, 1.3, 1.28, "#d7bf82"),
      e("dome", 0, 1.4, 0.28, 0.7, 0.65, 0.75, "#d7bf82"),
      e("box", 0, 1.3, 0.76, 0.32, 0.19, 0.42, "#bb8a53"));
    for (let t of [-0.25, 0.25]) (e("box", t, 0.14, 0.1, 0.18, 0.4, 0.3, "#a0845a"), e("box", t, 1.48, 0.48, 0.07, 0.1, 0.05, "#5c6454"));
  } else if (/wolf|smokie|yoyo|bigfoot|coco|savage|tiger|eddga|fox|nine tails/.test(A)) {
    (e("dome", 0, 0.65, 0, 1.2, 1.25, 1.35, "#ae9b7f"), e("dome", 0, 1.33, 0.35, 0.9, 0.8, 0.85, "#baab8f"));
    for (let t of [-0.34, 0.34])
      (e("cone", t, 1.88, 0.24, 0.35, 0.55, 0.32, "#8d8271"), e("box", t * 0.58, 1.42, 0.75, 0.075, 0.1, 0.06, "#515c53"));
    e("box", 0, 1.18, 0.81, 0.43, 0.3, 0.24, "#d5c6a9");
  } else if (/fish|hydra|kukre|vadon|cornutus|marse|deviace|marina|phen|plankton|strouf/.test(A)) {
    (e("dome", 0, 0.66, 0, 1.5, 1.2, 1.6, C.boss ? "#90aebe" : "#91b7b4"), e("cone", 0, 1.4, -0.3, 0.7, 0.8, 0.7, "#7a9eac"));
    for (let t of [-0.35, 0.35]) e("box", t, 0.84, 0.65, 0.12, 0.15, 0.07, "#506977");
    e("box", 0, 0.55, 0.83, 0.35, 0.08, 0.1, "#667f8b");
    for (let t of [-0.8, 0.8]) e("box", t, 0.5, -0.1, 0.6, 0.2, 0.85, "#aacbc2");
  } else {
    let t = /baphomet|knight|doppel|dopple/.test(A)
      ? "#737184"
      : /osiris|mummy/.test(A)
        ? "#d2bd89"
        : /moonlight/.test(A)
          ? "#ce9a90"
          : /drake|pirate/.test(A)
            ? "#7b8c9c"
            : /zombie|orc/.test(A)
              ? "#92a184"
              : "#c4c3ad";
    if ((I.push(...wB({ color: t, hair: LI(t, "#5e6572", 0.4), kind: "enemy", job: "Novice" })), /skeleton|mummy|osiris/.test(A)))
      for (let s of [-0.21, 0.21]) e("box", s, 1.94, 0.52, 0.17, 0.18, 0.06, "#706857");
    if (/baphomet/.test(A)) {
      for (let s of [-0.55, 0.55]) e("cone", s, 2.9, -0.12, 0.5, 1.7, 0.5, "#b3a18d");
      (e("box", 1, 1.9, 0, 0.15, 3.3, 0.14, "#9d8a72"), e("box", 1.55, 3.25, 0, 1.4, 0.3, 0.14, "#c4c7b6"));
    }
    if (
      (/osiris/.test(A) && (e("box", 0, 2.47, 0, 1.5, 0.38, 0.9, "#d8b465"), e("box", 0, 2.94, 0, 0.65, 0.66, 0.7, "#baa25f")),
      /drake/.test(A) &&
        (e("box", 0, 2.47, 0, 1.55, 0.26, 0.88, "#536475"),
        e("box", 0, 2.67, -0.1, 0.91, 0.3, 0.75, "#536475"),
        e("box", 0.2, 1.93, 0.53, 0.22, 0.2, 0.06, "#565d63")),
      /moonlight/.test(A))
    ) {
      for (let s of [-0.4, 0.4]) e("cone", s, 2.7, -0.1, 0.42, 0.73, 0.35, "#d5ad86");
      e("ico", 0, 0.7, -0.8, 1.2, 1.7, 0.65, "#dfc198");
    }
  }
  return I;
}
function dAA(C) {
  let A = [],
    g = (I) => A.push(I);
  if (C === "roof") {
    let I = [-0.5, -0.5, -0.5],
      e = [0.5, -0.5, -0.5],
      i = [0, 0.5, -0.5],
      t = [-0.5, -0.5, 0.5],
      s = [0.5, -0.5, 0.5],
      o = [0, 0.5, 0.5];
    (g([I, i, e]), g([t, s, o]), g([I, t, o, i]), g([e, i, o, s]), g([I, e, s, t]));
  } else if (C === "crystal" || C === "ico")
    if (C === "crystal") {
      let I = [0, 0.5, 0],
        e = [0, -0.5, 0],
        i = [
          [0.5, 0, 0],
          [0, 0, 0.5],
          [-0.5, 0, 0],
          [0, 0, -0.5],
        ];
      for (let t = 0; t < 4; t++) (g([I, i[t], i[(t + 1) % 4]]), g([e, i[(t + 1) % 4], i[t]]));
    } else {
      let I = (1 + Math.sqrt(5)) / 2,
        e = [
          [-1, I, 0],
          [1, I, 0],
          [-1, -I, 0],
          [1, -I, 0],
          [0, -1, I],
          [0, 1, I],
          [0, -1, -I],
          [0, 1, -I],
          [I, 0, -1],
          [I, 0, 1],
          [-I, 0, -1],
          [-I, 0, 1],
        ],
        i = e.map((t) => t.map((s) => s / (Math.sqrt(1 + I * I) * 2)));
      for (let t of [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1],
      ])
        g(t.map((s) => i[s]));
    }
  else if (C === "cylinder" || C === "cone") {
    let e = [],
      i = [];
    for (let t = 0; t < 8; t++) {
      let s = (t * 2 * Math.PI) / 8;
      (e.push([Math.cos(s) * 0.5, C === "cone" ? -0.5 : 0.5, Math.sin(s) * 0.5]), i.push([Math.cos(s) * 0.5, -0.5, Math.sin(s) * 0.5]));
    }
    if (C === "cylinder") {
      g(e.slice().reverse());
      for (let t = 0; t < 8; t++) g([i[t], e[t], e[(t + 1) % 8], i[(t + 1) % 8]]);
    } else for (let t = 0; t < 8; t++) g([i[t], [0, 0.5, 0], i[(t + 1) % 8]]);
  } else if (C === "dome") {
    let I = (e, i) => {
      let t = (e * Math.PI) / 4,
        s = -Math.PI / 2 + (i * Math.PI) / 5;
      return [0.5 * Math.cos(s) * Math.cos(t), 0.5 * Math.sin(s), 0.5 * Math.cos(s) * Math.sin(t)];
    };
    for (let e = 0; e < 5; e++) for (let i = 0; i < 8; i++) g([I(i, e), I(i, e + 1), I(i + 1, e + 1), I(i + 1, e)]);
  } else if (C === "torus") {
    let i = (t, s) => [(0.46 + 0.06 * Math.cos(s)) * Math.cos(t), (0.46 + 0.06 * Math.cos(s)) * Math.sin(t), 0.06 * Math.sin(s)];
    for (let t = 0; t < 20; t++)
      for (let s = 0; s < 4; s++)
        g([
          i((t * Math.PI * 2) / 20, (s * Math.PI * 2) / 4),
          i(((t + 1) * Math.PI * 2) / 20, (s * Math.PI * 2) / 4),
          i(((t + 1) * Math.PI * 2) / 20, ((s + 1) * Math.PI * 2) / 4),
          i((t * Math.PI * 2) / 20, ((s + 1) * Math.PI * 2) / 4),
        ]);
  } else if (C === "sail")
    g([
      [-0.5, -0.5, 0],
      [0.5, -0.5, 0],
      [0, 0.5, 0],
    ]);
  else {
    let I = [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ];
    for (let e of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ])
      g(e.map((i) => I[i]));
  }
  return A;
}
var ON = new Map();
function O2(C) {
  return (ON.has(C) || ON.set(C, dAA(C)), ON.get(C));
}
function _2(C) {
  return /fire|volcano/i.test(C.name)
    ? "#e99965"
    : /ice|freez|deluge/i.test(C.name)
      ? "#9ad3da"
      : /sanctuary|safety|pneuma/i.test(C.name)
        ? "#d2dfad"
        : "#bba2c9";
}
function W2(C) {
  return nw({ name: C.type === "flora" ? "Flora" : "Marine Sphere", spec: C.type === "flora" ? "flora" : "marine-sphere" });
}
class View {
  constructor(kit) {
    this.kit = kit;
    this.canvas = kit.canvas;
    this.yaw = Math.PI / 4;
    this.pitch = Math.PI / 4;
    this.zoom = 30;
    this.cameraFollow = { x: 0, z: 2 };
    this.title = true;
    this.models = new Map();
    this.effects = [];
    this.materials = new Map();
    this.geometries = new Map();
    this.flatGeometries = new Map();
    this.T = THREE;
    this.N = TSL;
    this.backend = kit.backendLabel;
    // Reused for picking and label projection (called for every label, every few frames).
    this._v = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    this._hit = new THREE.Vector3();

    const renderer = (this.renderer = kit.renderer);
    // Colour and light are matched to the look the game shipped with (its flat-shaded CPU renderer):
    // no tone mapping, so the palette keeps its saturation; a neutral hemisphere fill leaves the faces
    // turned away from the sun at about half brightness, and the sun lifts the tops to just above
    // their base colour.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#bcbcbc", 1.72));
    const sun = (this.sun = new THREE.DirectionalLight("#ffffff", 1.9));
    sun.position.set(-14, 32, 18);
    sun.castShadow = true;
    // 2048 at high (the old "High" preset), 1024 at medium (the old "Balanced").
    kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, far: 100 });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -3e-4;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    // A small procedural sky for image-based light: a soft vertical gradient and a warm sun spot.
    const w = 128,
      h = 64,
      data = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / w,
          v = y / h,
          o = (y * w + x) * 4,
          spot = Math.exp(-((u - 0.65) ** 2 / 0.004 + (v - 0.22) ** 2 / 0.015)) * 8,
          base = 0.25 + Math.pow(1 - v, 2) * 0.85;
        data[o] = base * 1.02 + spot;
        data[o + 1] = base * 1.05 + spot * 0.91;
        data[o + 2] = base * 1.04 + spot * 0.75;
        data[o + 3] = 1;
      }
    this.hdr = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
    this.hdr.mapping = THREE.EquirectangularReflectionMapping;
    this.hdr.needsUpdate = true;
    this.scene.environment = this.hdr;
    this.scene.environmentIntensity = 0.15;

    // Scene pass + a faint bloom on emissive crystals, on every tier (only its resolution follows the tier).
    this.post = createPost(kit, this.scene, this.camera, { bloom: { strength: 0.16, radius: 0.4, threshold: 1.15 } });
    // Shared by every short-lived ring effect.
    this.effectRing = new THREE.RingGeometry(0.4, 0.48, 24);
    this.contactGeometry = new THREE.PlaneGeometry(1, 1);
    this.contactMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, color: "#273c2b" });
    // Every solid part of a level, coloured per vertex (see bake).
    this.bakedMaterial = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.73, metalness: 0, flatShading: true });
    this.contactMaterial.opacityNode = TSL.float(0.2).mul(TSL.float(1).sub(TSL.smoothstep(0.08, 0.5, TSL.length(TSL.uv().sub(0.5)))));
    kit.onResize(() => this.resize());
  }
  /**
   * Compile the scene's shaders before the first frame, for the render target the post chain draws
   * into (a compile for the canvas would build a second set the game never uses), so the title
   * screen does not open with a hitch.
   */
  async precompile() {
    let r = this.renderer,
      sp = this.post.scenePass;
    // The same set-up the pass does on its first frame (sample count and colour format).
    ((sp.renderTarget.samples = sp.options?.samples ?? r.samples), (sp.renderTarget.texture.type = r.getOutputBufferType()));
    await sp.compileAsync(r);
  }
  /** How many transient ring effects may be alive at once (64 at high, as the old "High" preset). */
  get particleCap() {
    return this.kit.detail(64, 16);
  }
  resize() {
    const { width, height } = this.kit.size,
      aspect = width / height,
      z = this.zoom;
    this.camera.left = (-z * aspect) / 2;
    this.camera.right = (z * aspect) / 2;
    this.camera.top = z / 2;
    this.camera.bottom = -z / 2;
    this.camera.updateProjectionMatrix();
  }
  mat(A) {
    let g = [A.color, A.water ? "water" : "solid", A.emissive || 0, A.alpha || 1].join(":");
    if (this.materials.has(g)) return this.materials.get(g);
    let I = this.T,
      e = this.N,
      i = new I.MeshStandardNodeMaterial({
        color: A.color,
        roughness: A.water ? 0.28 : 0.73,
        metalness: A.water ? 0.12 : 0,
        flatShading: !0,
      });
    if (A.water) {
      let t = e
        .sin(e.positionWorld.x.mul(0.65).add(e.positionWorld.z.mul(0.4)).add(e.time.mul(0.75)))
        .mul(0.11)
        .add(0.32);
      ((i.colorNode = e.mix(e.color(A.color), e.color("#c3e0d1"), t)), (i.roughnessNode = e.float(0.28)));
    }
    return (
      A.emissive && ((i.emissive = new I.Color(A.color)), (i.emissiveIntensity = A.emissive * 2)),
      A.alpha && ((i.transparent = !0), (i.opacity = A.alpha), (i.depthWrite = !1)),
      this.materials.set(g, i),
      i
    );
  }
  geo(A) {
    if (this.geometries.has(A)) return this.geometries.get(A);
    let g = this.T,
      I;
    if (A === "box") I = new g.BoxGeometry(1, 1, 1);
    else if (A === "cylinder") I = new g.CylinderGeometry(0.5, 0.5, 1, 8);
    else if (A === "cone") I = new g.ConeGeometry(0.5, 1, 8);
    else if (A === "dome") I = new g.SphereGeometry(0.5, 12, 6);
    else if (A === "ico") I = new g.IcosahedronGeometry(0.5, 0);
    else if (A === "crystal") I = new g.OctahedronGeometry(0.5, 0);
    else if (A === "torus") I = new g.TorusGeometry(0.46, 0.06, 6, 24);
    else {
      let e = [];
      for (let i of O2(A)) for (let t = 1; t < i.length - 1; t++) for (let s of [i[0], i[t], i[t + 1]]) e.push(...s);
      ((I = new g.BufferGeometry()), I.setAttribute("position", new g.Float32BufferAttribute(e, 3)), I.computeVertexNormals());
    }
    return (this.geometries.set(A, I), I);
  }
  applyShape(A, g) {
    return (
      A.position.set(g.x, g.y, g.z),
      A.scale.set(g.w, g.h, g.d),
      g.type === "torus" && (g.h < 0.4 ? ((A.rotation.x = -Math.PI / 2), A.scale.set(g.w, g.d, 0.35)) : A.scale.set(g.w, g.h, 1)),
      g.vertical && g.type === "cylinder" && ((A.rotation.x = Math.PI / 2), A.scale.set(g.w, g.h, g.d)),
      A
    );
  }
  /** A unit shape as flat (non-indexed) position and normal arrays, for baking. */
  flat(A) {
    let g = this.flatGeometries.get(A);
    if (!g) {
      let e = this.geo(A),
        n = e.index ? e.toNonIndexed() : e;
      ((g = { position: n.attributes.position.array, normal: n.attributes.normal.array }), this.flatGeometries.set(A, g));
    }
    return g;
  }
  /**
   * Merge parts ({ part, matrix }) into meshes: solid parts share one vertex-coloured material and one
   * draw, water and glowing parts keep their own materials. Regular meshes with shared materials let
   * three.js reuse its compiled shaders from one area to the next.
   */
  bake(list) {
    let T = this.T,
      groups = new Map();
    for (let item of list) {
      let t = item.part,
        key = t.water || t.emissive || t.alpha ? [t.color, t.water ? "water" : "solid", t.emissive || 0, t.alpha || 1].join(":") : "solid",
        grp = groups.get(key);
      (grp || groups.set(key, (grp = { items: [], count: 0, sample: t })),
        grp.items.push(item),
        (grp.count += this.flat(t.type).position.length / 3));
    }
    let v = new T.Vector3(),
      nm = new T.Matrix3(),
      c = new T.Color(),
      out = [];
    for (let [key, grp] of groups) {
      let solid = key === "solid",
        pos = new Float32Array(grp.count * 3),
        nor = new Float32Array(grp.count * 3),
        col = solid ? new Float32Array(grp.count * 3) : null,
        o = 0;
      for (let { part, matrix } of grp.items) {
        let f = this.flat(part.type);
        (nm.getNormalMatrix(matrix), solid && c.set(part.color));
        for (let k = 0; k < f.position.length; k += 3, o += 3) {
          (v.set(f.position[k], f.position[k + 1], f.position[k + 2]).applyMatrix4(matrix),
            (pos[o] = v.x),
            (pos[o + 1] = v.y),
            (pos[o + 2] = v.z));
          (v
            .set(f.normal[k], f.normal[k + 1], f.normal[k + 2])
            .applyMatrix3(nm)
            .normalize(),
            (nor[o] = v.x),
            (nor[o + 1] = v.y),
            (nor[o + 2] = v.z));
          solid && ((col[o] = c.r), (col[o + 1] = c.g), (col[o + 2] = c.b));
        }
      }
      let geometry = new T.BufferGeometry();
      (geometry.setAttribute("position", new T.BufferAttribute(pos, 3)),
        geometry.setAttribute("normal", new T.BufferAttribute(nor, 3)),
        solid && geometry.setAttribute("color", new T.BufferAttribute(col, 3)),
        geometry.computeBoundingSphere());
      let mesh = new T.Mesh(geometry, solid ? this.bakedMaterial : this.mat(grp.sample));
      ((mesh.castShadow = !grp.sample.water), (mesh.receiveShadow = !0), (mesh.userData.ownGeometry = !0), out.push(mesh));
    }
    return out;
  }
  group(A) {
    let g = new this.T.Group();
    for (let I of A) {
      let e = new this.T.Mesh(this.geo(I.type), this.mat(I));
      (this.applyShape(e, I),
        (e.castShadow = !I.water),
        (e.receiveShadow = !0),
        (e.userData = { anim: I.anim, baseY: I.y, baseZ: I.z }),
        g.add(e));
    }
    return g;
  }
  contact(A = 0.7) {
    // A soft round contact shadow; every disk shares one unit plane and one material.
    let i = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
    return (i.scale.set(A * 3, A * 3, 1), (i.rotation.x = -Math.PI / 2), (i.position.y = 0.3), i);
  }
  clearWorld() {
    this.worldRoot &&
      (this.scene.remove(this.worldRoot),
      this.worldRoot.traverse((A) => {
        (A.isInstancedMesh && A.dispose(),
          A.userData.own && (A.geometry?.dispose(), A.material?.dispose()),
          A.userData.ownMaterial && A.material?.dispose(),
          A.userData.ownGeometry && A.geometry.dispose());
      }),
      this.models.clear(),
      (this.effects = []),
      (this.hero = null),
      (this.heroDisk = null),
      (this.friend = null),
      (this.pet = null),
      (this.lootMeshes = new Map()),
      (this.warningMeshes = []),
      (this.fieldMeshes = new Map()),
      (this.summonMeshes = new Map()));
  }
  setWorld(A, g) {
    (this.clearWorld(), (this.layout = A), (this.game = g));
    let I = this.T;
    // One Fog and one background colour for the whole game, recoloured per area: a new Fog object
    // would make three.js rebuild every material on each area change (a second-long hitch).
    (this.scene.background ? this.scene.background.set(A.palette.sky) : (this.scene.background = new I.Color(A.palette.sky)),
      this.scene.fog ? this.scene.fog.color.set(A.palette.sky) : (this.scene.fog = new I.Fog(A.palette.sky, 68, 140)),
      (this.worldRoot = new I.Group()),
      this.scene.add(this.worldRoot),
      (this.cameraFollow = { x: g.player.x, z: g.player.z }));
    // The level's static parts and its townsfolk are baked into a handful of merged meshes (one draw
    // for every solid part, one per water or glowing material) instead of hundreds of instanced batches.
    let i = new I.Object3D(),
      baked = A.parts.map((t) => (i.rotation.set(0, 0, 0), this.applyShape(i, t), i.updateMatrix(), { part: t, matrix: i.matrix.clone() })),
      npc = new I.Object3D();
    for (let t of g.npcs) {
      (npc.position.set(t.x, 0.3, t.z), (npc.rotation.y = 0.35), npc.updateMatrix());
      for (let part of wB({ color: t.color, hair: t.id === "kafra" ? "#c5ba99" : "#877d70", kind: "npc" }))
        (i.rotation.set(0, 0, 0),
          this.applyShape(i, part),
          i.updateMatrix(),
          baked.push({ part, matrix: npc.matrix.clone().multiply(i.matrix) }));
      let o = this.contact(0.6);
      ((o.position.x = t.x), (o.position.z = t.z), this.worldRoot.add(o));
    }
    for (let o of this.bake(baked)) this.worldRoot.add(o);
    ((this.highlight = new I.Mesh(
      new I.RingGeometry(0.8, 1, 40),
      new I.MeshBasicNodeMaterial({ color: "#f2d69b", transparent: !0, opacity: 0.82, side: I.DoubleSide, depthWrite: !1 }),
    )),
      (this.highlight.rotation.x = -Math.PI / 2),
      (this.highlight.position.y = 0.35),
      (this.highlight.userData.own = !0),
      this.worldRoot.add(this.highlight),
      (this.propMeshes = []));
    for (let t of A.props) {
      let s = this.group([{ type: "box", x: 0, y: 0, z: 0, w: t.w, h: t.h, d: t.d, color: t.color }]);
      (s.position.set(t.x, 0.8, t.z), this.worldRoot.add(s), this.propMeshes.push(s));
    }
    ((this.fieldMeshes = new Map()),
      (this.summonMeshes = new Map()),
      (this.trialRing = this.highlight.clone()),
      (this.trialRing.material = this.highlight.material),
      (this.trialRing.userData = {}),
      this.worldRoot.add(this.trialRing),
      this.syncActors(g));
  }
  syncActors(A) {
    let g = A.p.job + A.p.hair + A.gear("head")?.item + A.p.mount;
    (g !== this.heroKey || !this.hero) &&
      (this.hero && this.worldRoot.remove(this.hero),
      (this.hero = this.group(wB({ color: Qg[A.p.job].color, hair: A.p.hair, job: A.p.job, hat: !!A.gear("head"), mount: A.p.mount }))),
      this.worldRoot.add(this.hero),
      (this.heroKey = g));
    for (let I of A.enemies) {
      if (this.models.has(I.id)) continue;
      let e = this.group(nw(I));
      (I.boss && e.scale.setScalar(2.05), this.worldRoot.add(e));
      let i = this.contact(I.boss ? 1.5 : 0.7);
      (this.worldRoot.add(i), this.models.set(I.id, { root: e, disk: i }));
    }
    (this.heroDisk || (this.heroDisk = this.contact(0.7)),
      this.heroDisk.parent !== this.worldRoot && this.worldRoot.add(this.heroDisk),
      (!this.friend || this.friend.parent !== this.worldRoot) &&
        ((this.friend = this.group(wB({ color: "#9aa997", hair: "#d3be98", kind: "npc" }))), this.worldRoot.add(this.friend)),
      (!this.pet || this.pet.parent !== this.worldRoot) &&
        ((this.pet = this.group(nw({ name: "Poring", spec: "poring" }))), this.pet.scale.setScalar(0.65), this.worldRoot.add(this.pet)));
  }
  event(A) {
    if (
      ((A.type === "population" || A.type === "equip" || A.type === "spawn") && this.syncActors(this.game),
      ["skill", "heal", "level", "ward", "moveMarker"].includes(A.type) && this.worldRoot)
    ) {
      let g = this.T,
        I = this.effectRing,
        e = new g.MeshBasicNodeMaterial({
          color: A.type === "heal" ? "#c8e7ad" : A.type === "moveMarker" ? "#f4edd5" : "#efcfa3",
          transparent: !0,
          opacity: 0.8,
          side: g.DoubleSide,
          depthWrite: !1,
        }),
        i = new g.Mesh(I, e);
      ((i.rotation.x = -Math.PI / 2),
        i.position.set(A.x ?? this.game.player.x, 0.4, A.z ?? this.game.player.z),
        (i.userData.ownMaterial = !0),
        this.worldRoot.add(i),
        this.effects.push({ mesh: i, life: 0.6, total: 0.6 }));
    }
  }
  animate(A, g, I) {
    for (let e of A.children) {
      let i = e.userData.anim;
      (i === "legL" && (e.position.y = e.userData.baseY + Math.max(0, Math.sin(g)) * 0.14),
        i === "legR" && (e.position.y = e.userData.baseY + Math.max(0, -Math.sin(g)) * 0.14),
        i === "weapon" && ((e.position.z = e.userData.baseZ + Math.sin(I * 10) * 0.45), (e.rotation.x = -I * 1.3)));
    }
  }
  project(A, g, I) {
    let e = this._v.set(A, g, I).project(this.camera),
      { width: w, height: h } = this.kit.size;
    return { x: (e.x * 0.5 + 0.5) * w, y: (-0.5 * e.y + 0.5) * h };
  }
  ground(A, g) {
    let { width: w, height: h } = this.kit.size,
      e = this._ray;
    e.setFromCamera(this._ndc.set((A / w) * 2 - 1, (-g / h) * 2 + 1), this.camera);
    let i = this._hit;
    return e.ray.intersectPlane(this._plane, i) ? { x: i.x, z: i.z } : { x: 0, z: 0 };
  }
  render(A, g, I, e) {
    if (!this.worldRoot) return;
    let i = this.T;
    this.syncActors(A);
    let t = A.player,
      s = this.cameraFollow,
      o = this.title ? { x: -1, z: 1 } : t;
    ((s.x = Vg(s.x, o.x, 1 - Math.exp(-e * 5))), (s.z = Vg(s.z, o.z, 1 - Math.exp(-e * 5))));
    let B = this.kit.size.width / this.kit.size.height,
      Q = this.title ? -this.zoom * B * 0.18 : 0,
      a = s.x + Math.cos(this.yaw) * Q,
      r = s.z - Math.sin(this.yaw) * Q;
    (this.camera.position.set(a + Math.sin(this.yaw) * 38, 38 * Math.tan(this.pitch), r + Math.cos(this.yaw) * 38),
      this.camera.lookAt(a, 1.4, r),
      this.camera.updateMatrixWorld(),
      this.hero.position.set(Vg(t.prevX, t.x, g), 0.3, Vg(t.prevZ, t.z, g)),
      (this.hero.rotation.y = t.angle),
      (this.hero.scale.y = A.sitting || A.buffs["Play Dead"] ? 0.68 : 1),
      (this.hero.visible = !A.buffs.Hide || Math.floor(I * 4) % 2 === 0),
      this.animate(this.hero, t.walk, t.attack),
      (this.heroDisk.position.x = this.hero.position.x),
      (this.heroDisk.position.z = this.hero.position.z),
      (this.friend.visible = !!A.p.companion && !this.title),
      this.friend.position.set(A.friend.x, 0.3, A.friend.z),
      (this.friend.rotation.y = t.angle),
      this.animate(this.friend, A.friend.walk, 0),
      (this.pet.visible = A.p.pet && !this.title),
      this.pet.position.set(t.x + 1.7, 0.4 + Math.sin(I * 5) * 0.1, t.z + 1.3),
      (this.pet.rotation.y = t.angle));
    for (let l of A.enemies) {
      let c = this.models.get(l.id);
      if (!c) continue;
      let { root: h, disk: u } = c;
      ((h.visible = l.hp > 0 || l.deadFor < 0.3),
        (u.visible = l.hp > 0),
        h.position.set(Vg(l.prevX, l.x, g), 0.3 + (l.walk ? Math.sin(I * 5 + ic(l.id)) * 0.07 : 0), Vg(l.prevZ, l.z, g)),
        (h.rotation.y = l.angle),
        l.hp <= 0 && (h.scale.y = Math.max(0.01, (1 - l.deadFor * 3) * (l.boss ? 2.05 : 1))),
        (u.position.x = l.x),
        (u.position.z = l.z),
        this.animate(h, l.walk, l.attack));
    }
    for (let [l, c] of this.models) A.enemies.some((h) => h.id === l) || (this.worldRoot.remove(c.root, c.disk), this.models.delete(l));
    let E = A.enemies.find((l) => l.id === A.target && l.hp > 0);
    ((this.highlight.visible = !!E), E && (this.highlight.position.set(E.x, 0.35, E.z), this.highlight.scale.setScalar(E.boss ? 1.8 : 1)));
    let n = A.trial?.points[A.trial.progress];
    ((this.trialRing.visible = !!n), n && this.trialRing.position.set(n.x, 0.36, n.z));
    for (let l of A.traps) {
      let c = this.fieldMeshes.get(l);
      (c ||
        ((c = new i.Mesh(
          new i.RingGeometry(l.field ? 2.4 : 0.82, l.field ? 2.65 : 1, 32),
          new i.MeshBasicNodeMaterial({ color: _2(l), transparent: !0, opacity: 0.65, side: i.DoubleSide, depthWrite: !1 }),
        )),
        (c.rotation.x = -Math.PI / 2),
        (c.userData.own = !0),
        this.fieldMeshes.set(l, c),
        this.worldRoot.add(c)),
        c.position.set(l.x, 0.4, l.z),
        (c.material.opacity = 0.6 + 0.2 * Math.sin(I * 4)));
    }
    for (let [l, c] of this.fieldMeshes)
      A.traps.includes(l) || (this.worldRoot.remove(c), c.geometry.dispose(), c.material.dispose(), this.fieldMeshes.delete(l));
    for (let l of A.summons) {
      let c = this.summonMeshes.get(l);
      (c || ((c = this.group(W2(l))), this.summonMeshes.set(l, c), this.worldRoot.add(c)),
        c.position.set(l.x, 0.3 + (l.type === "sphere" ? Math.sin(I * 7) * 0.12 : 0), l.z),
        (c.rotation.y = I * 0.4));
    }
    for (let [l, c] of this.summonMeshes) A.summons.includes(l) || (this.worldRoot.remove(c), this.summonMeshes.delete(l));
    this.lootMeshes || (this.lootMeshes = new Map());
    for (let l of A.loot) {
      let c = this.lootMeshes.get(l.id);
      ((!c || c.parent !== this.worldRoot) &&
        ((c = this.group([
          { type: "box", x: 0, y: 0, z: 0, w: 0.4, h: 0.44, d: 0.4, color: rA(l.item).kind === "card" ? "#b2a0c8" : "#dcc58d" },
        ])),
        this.worldRoot.add(c),
        this.lootMeshes.set(l.id, c)),
        c.position.set(l.x, 0.68 + Math.sin(I * 3 + l.x) * 0.08, l.z),
        (c.rotation.y = I * 0.6));
    }
    for (let [l, c] of this.lootMeshes) A.loot.some((h) => h.id === l) || (this.worldRoot.remove(c), this.lootMeshes.delete(l));
    for (this.warningMeshes || (this.warningMeshes = []); this.warningMeshes.length < A.telegraphs.length; ) {
      let l = new i.Mesh(
        new i.CircleGeometry(1, 40),
        new i.MeshBasicNodeMaterial({ color: "#ce7958", transparent: !0, opacity: 0.3, side: i.DoubleSide, depthWrite: !1 }),
      );
      ((l.rotation.x = -Math.PI / 2), (l.userData.own = !0), this.worldRoot.add(l), this.warningMeshes.push(l));
    }
    this.warningMeshes.forEach((l, c) => {
      l.parent !== this.worldRoot && this.worldRoot.add(l);
      let h = A.telegraphs[c];
      ((l.visible = !!h),
        h && (l.position.set(h.x, 0.38, h.z), l.scale.setScalar(h.r), (l.material.opacity = 0.12 + (1 - h.time / h.total) * 0.4)));
    });
    for (let l of this.effects)
      ((l.life -= e),
        l.mesh.scale.setScalar(1 + (1 - l.life / l.total) * 5),
        (l.mesh.material.opacity = Math.max(0, l.life / l.total) * 0.65));
    for (let l of this.effects.filter((c) => c.life <= 0)) (this.worldRoot.remove(l.mesh), l.mesh.material.dispose());
    if (((this.effects = this.effects.filter((l) => l.life > 0)), this.effects.length > this.particleCap)) {
      let l = this.effects.shift();
      (this.worldRoot.remove(l.mesh), l.mesh.material.dispose());
    }
    if (this.physics)
      for (let [l] of this.physics.bodies) {
        let c = this.physics.interpolate(l, g),
          h = l.startsWith("prop") ? this.propMeshes[Number(l.slice(4))] : this.lootMeshes.get(l);
        if (h && c) {
          h.position.set(c.x, c.y, c.z);
          let u = this.physics.rotation(l, g);
          u && h.quaternion.set(u.x, u.y, u.z, u.w);
        }
      }
    this.post.render();
  }
}
// Rapier 0.20 from the kit: a kinematic character controller for the hero, and a few dynamic
// boxes (market crates, dropped loot) that the hero can shove around.
class Physics {
  constructor(RAPIER, cap = 28) {
    ((this.R = RAPIER), (this.world = null), (this.bodies = new Map()), (this.cap = cap), (this.serial = 0));
  }
  setCap(A) {
    for (this.cap = A; this.bodies.size > this.cap; ) this.remove(this.bodies.keys().next().value);
  }
  setWorld(A, g) {
    this.disposeWorld();
    let I = this.R;
    ((this.world = createWorld(I, { hz: 1 / uB })),
      this.world.createCollider(I.ColliderDesc.cuboid(25, 0.2, 25).setTranslation(0, -0.05, 0).setFriction(0.8)));
    for (let e of A.obstacles)
      this.world.createCollider(
        I.ColliderDesc.cuboid(e.w / 2, (e.h || 3) / 2, e.d / 2)
          .setTranslation(e.x, (e.h || 3) / 2 + 0.15, e.z)
          .setFriction(0.7),
      );
    ((this.playerBody = this.world.createRigidBody(I.RigidBodyDesc.kinematicPositionBased().setTranslation(g.player.x, 1.2, g.player.z))),
      (this.playerCollider = this.world.createCollider(I.ColliderDesc.capsule(0.5, 0.34).setMass(70).setFriction(0.5), this.playerBody)),
      (this.controller = this.world.createCharacterController(0.02)),
      this.controller.enableAutostep(0.28, 0.3, !0),
      this.controller.enableSnapToGround(0.35),
      this.controller.setApplyImpulsesToDynamicBodies(!0),
      this.controller.setCharacterMass(70),
      A.props.forEach((e, i) => this.add("prop" + i, e.x, e.z, e.w, e.h, e.d, 5, e.color)),
      (g.mover = (e, i, t, s) => this.move(e, i, t, s)));
  }
  move(A, g, I, e) {
    if (!this.world) return { x: A + I, z: g + e };
    let i = this.playerBody.translation();
    (Math.hypot(i.x - A, i.z - g) > 1 && (this.playerBody.setTranslation({ x: A, y: 1.2, z: g }, !0), (i = this.playerBody.translation())),
      this.controller.computeColliderMovement(this.playerCollider, { x: I, y: -0.12, z: e }));
    let t = this.controller.computedMovement(),
      s = { x: i.x + t.x, y: i.y + t.y, z: i.z + t.z };
    return (this.playerBody.setNextKinematicTranslation(s), { x: s.x, z: s.z });
  }
  add(A, g, I, e = 0.4, i = 0.4, t = 0.4, s = 0.2, o = "#d9c599") {
    if (!this.world) return;
    for (; this.bodies.size >= this.cap; ) this.remove(this.bodies.keys().next().value);
    let B = this.R,
      Q = this.world.createRigidBody(B.RigidBodyDesc.dynamic().setTranslation(g, 1.4, I).setLinearDamping(0.5).setAngularDamping(0.8));
    (this.world.createCollider(
      B.ColliderDesc.cuboid(e / 2, i / 2, t / 2)
        .setMass(s)
        .setFriction(0.65)
        .setRestitution(0.22),
      Q,
    ),
      Q.setLinvel({ x: 0.3, y: 2, z: 0.2 }, !0));
    let a = Q.translation();
    this.bodies.set(A, {
      body: Q,
      previous: { ...a },
      current: { ...a },
      previousRotation: { ...Q.rotation() },
      currentRotation: { ...Q.rotation() },
      color: o,
    });
  }
  remove(A) {
    let g = this.bodies.get(A);
    g && (this.world.removeRigidBody(g.body), this.bodies.delete(A));
  }
  step() {
    if (this.world) {
      for (let A of this.bodies.values()) ((A.previous = { ...A.current }), (A.previousRotation = { ...A.currentRotation }));
      this.world.step();
      for (let A of this.bodies.values()) ((A.current = { ...A.body.translation() }), (A.currentRotation = { ...A.body.rotation() }));
    }
  }
  interpolate(A, g) {
    let I = this.bodies.get(A);
    return I ? { x: Vg(I.previous.x, I.current.x, g), y: Vg(I.previous.y, I.current.y, g), z: Vg(I.previous.z, I.current.z, g) } : null;
  }
  rotation(A, g) {
    let I = this.bodies.get(A);
    if (!I) return null;
    let e = I.previousRotation,
      i = I.currentRotation,
      t = e.x * i.x + e.y * i.y + e.z * i.z + e.w * i.w < 0 ? -1 : 1,
      s = { x: Vg(e.x, i.x * t, g), y: Vg(e.y, i.y * t, g), z: Vg(e.z, i.z * t, g), w: Vg(e.w, i.w * t, g) },
      o = Math.hypot(s.x, s.y, s.z, s.w) || 1;
    for (let B of ["x", "y", "z", "w"]) s[B] /= o;
    return s;
  }
  disposeWorld() {
    if (this.world) {
      this.controller && this.world.removeCharacterController(this.controller);
      for (let A of [...this.bodies.keys()]) this.remove(A);
      (this.world.free(), (this.world = null), (this.controller = null));
    }
  }
  dispose() {
    this.disposeWorld();
  }
}
class GameAudio {
  constructor() {
    ((this.volume = 0.6),
      (this.muted = !1),
      (this.context = null),
      (this.buffers = new Map()),
      (this.music = null),
      (this.current = null),
      (this.loaded = !1),
      (this.disabled = !1));
  }
  async load() {
    try {
      let A = new URL("./audio/manifest.json", import.meta.url),
        g = await (await fetch(A)).json();
      for (let I of Object.values(g.assets)) I.url = new URL(I.url, A).href;
      ((this.manifest = g), (this.loaded = !0));
    } catch (A) {
      ((this.disabled = !0), console.warn("Audio manifest unavailable; continuing silently.", A));
    }
  }
  unlock() {
    if (!(!this.loaded || this.disabled))
      try {
        (this.context ||
          ((this.context = new (window.AudioContext || window.webkitAudioContext)()),
          // Decode the short effects once, right after the first gesture, so the first hit is not late.
          Object.entries(this.manifest.assets).forEach(([g, I]) => I.loop || this.buffer(g))),
          this.context.resume().catch(() => {}),
          this.playMusic(this.wanted || "town"));
      } catch {
        this.disabled = !0;
      }
  }
  setVolume(A) {
    ((this.volume = Math.min(1, Math.max(0, Number(A) || 0))), this.update());
  }
  setMute(A) {
    ((this.muted = !!A), this.update());
  }
  update() {
    this.music && (this.music.volume = this.muted ? 0 : this.volume * 0.26);
  }
  async playMusic(A = "town") {
    if (((this.wanted = A), !this.context || !this.loaded)) return;
    let g = this.manifest.music[A];
    if (this.current === g) {
      this.music?.play().catch(() => {});
      return;
    }
    this.music?.pause();
    let I = this.manifest.assets[g];
    I &&
      ((this.current = g),
      (this.music = new Audio(I.url)),
      (this.music.loop = !0),
      (this.music.preload = "auto"),
      this.update(),
      this.music.play().catch(() => {}));
  }
  buffer(A) {
    let g = this.manifest.assets[A],
      I = this.buffers.get(A);
    return (
      !I &&
        g &&
        ((I = fetch(g.url)
          .then((e) => e.arrayBuffer())
          .then((e) => this.context.decodeAudioData(e))),
        I.catch(() => this.buffers.delete(A)),
        this.buffers.set(A, I)),
      I
    );
  }
  async play(A) {
    if (!this.context || !this.loaded || this.muted || this.volume === 0) return;
    let g = this.manifest.assets[A];
    if (g)
      try {
        let I = await this.buffer(A),
          e = this.context.createBufferSource(),
          i = this.context.createGain();
        ((e.buffer = I),
          (i.gain.value = this.volume * 0.35),
          e.connect(i),
          i.connect(this.context.destination),
          e.start(),
          (e.onended = () => {
            (e.disconnect(), i.disconnect());
          }));
      } catch {}
  }
  suspend() {
    this.music?.pause();
  }
  resume() {
    this.context && this.playMusic(this.wanted || "town");
  }
  dispose() {
    (this.music?.pause(), this.context?.close(), this.buffers.clear());
  }
}
var L2 = {
    poring: "M4 17c-1-6 3-13 8-13s9 7 8 13c-3 4-13 4-16 0Z M9 12v1m6-1v1m-4 3h2",
    sword: "m5 19 3-3m-3-3 6 6m-3-6L18 3l3 3-10 10",
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6L12 3Z m-4 9 3 3 5-6",
    bow: "M5 3c14 0 14 18 0 18L17 12 5 3Z M2 12h19m-3-3 3 3-3 3",
    magic: "m12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Z M19 3v4m-2-2h4",
    heal: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z",
    coin: "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 7v10m3-8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9",
    bag: "M6 7h12l2 14H4L6 7Zm3 0V5a3 3 0 0 1 6 0v2m-7 8h8",
    book: "M12 5C9 2 4 3 3 4v15c3-2 6-1 9 1 3-2 6-3 9-1V4c-3-1-6-2-9 1Zm0 0v15",
    journal: "M6 3h13v18H6V3Zm3 4h7m-7 4h7m-7 4h5M3 6h4M3 11h4M3 16h4",
    map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
    gear: "m12 3 2 3 4-1 1 4 3 3-3 2 1 4-4 1-4 3-2-3-4 1-1-4-3-2 3-3-1-4 4 1 2-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    sound: "M4 9h4l5-5v16l-5-5H4V9Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
    mute: "M4 9h4l5-5v16l-5-5H4V9Zm12 0 6 6m0-6-6 6",
    fullscreen: "M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5",
    help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.3",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    potion: "M9 3h6m-5 0v6L5 17c-1 3 1 4 3 4h8c2 0 4-1 3-4l-5-8V3M8 15h8",
    rest: "M8 4h8v9H8V4ZM5 13h14v4H5v-4Zm2 4v4m10-4v4",
    feather: "M5 21 18 8M8 17c-6-4-1-13 11-14 1 11-3 18-11 14Zm3-3h6m-3-4h5",
    hammer: "m5 21 10-12M9 5l4-3 9 7-4 4-9-8Z",
    card: "M5 3h14v18H5V3Zm7 4 4 5-4 5-4-5 4-5Z",
    party:
      "M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21v-4a6 6 0 0 1 12 0v4M4 9a2 2 0 1 0 0-4M2 19v-4c0-2 1-3 3-3m15-3a2 2 0 1 1 0-4m2 14v-4c0-2-1-3-3-3",
    flag: "M5 22V3m0 0c5-4 9 4 15 0v10c-6 4-10-4-15 0",
    compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6-4-2 6-5 2 2-6 5-2Z",
    leaf: "M5 19C0 11 7 3 21 3c0 14-8 18-16 16Zm0 0L17 7",
    save: "M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-8h8v8",
    home: "m2 11 10-9 10 9M5 9v12h14V9m-9 12v-7h4v7",
    skull: "M5 15a8 8 0 1 1 14 0l-3 2v4H8v-4l-3-2Zm4-5v2m6-2v2m-3 6v3",
    check: "m5 12 4 4L20 5",
    close: "M6 6l12 12M18 6 6 18",
    moon: "M19 15A8 8 0 1 1 9 3c-3 7 4 14 10 12Z",
    scroll: "M7 4h12v14H8a3 3 0 0 1-3-3V6a2 2 0 1 0-4 0h6m1 12v3h13v-3M11 8h5m-5 4h5",
  },
  zA = (C = "magic") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${L2[C] || L2.magic}"/></svg>`,
  $l = (C) =>
    ({
      Swordsman: "sword",
      Knight: "shield",
      Crusader: "shield",
      Thief: "moon",
      Assassin: "moon",
      Rogue: "feather",
      Archer: "bow",
      Hunter: "bow",
      Bard: "feather",
      Dancer: "feather",
      Magician: "magic",
      Wizard: "magic",
      Sage: "book",
      Acolyte: "heal",
      Priest: "heal",
      Monk: "shield",
      Merchant: "coin",
      Blacksmith: "hammer",
      Alchemist: "potion",
      Novice: "poring",
    })[C] || "magic",
  Dr = (C) =>
    C.kind === "card"
      ? "card"
      : C.kind === "weapon"
        ? /bow/i.test(C.type)
          ? "bow"
          : /staff|rod|wand/i.test(C.type)
            ? "magic"
            : "sword"
        : C.kind === "armor"
          ? "shield"
          : C.kind === "usable"
            ? "potion"
            : "leaf",
  q2 = (C) =>
    /heal|aid|bless|cure|sanctuary/i.test(C)
      ? "heal"
      : /bolt|thunder|gust|fire|meteor|magic|sphere/i.test(C)
        ? "magic"
        : /arrow|straf|blitz|snare/i.test(C)
          ? "bow"
          : /steal|mammon|vend|cart/i.test(C)
            ? "coin"
            : /hide|dead|cloak|stalk/i.test(C)
              ? "moon"
              : /guard|endure|coat/i.test(C)
                ? "shield"
                : /song|dance|riff|melody|slinging/i.test(C)
                  ? "feather"
                  : "sword",
  IA = (C, A, g = "", I = "small-button") => `<button class="${I}" data-act="${A}" ${g}>${C}</button>`,
  jg = (C) => (C ? "disabled" : ""),
  aw = (C, A, g) => `<span class="requirement ${C.count(A) >= g ? "met" : ""}">${CA(rA(A).name)} ${C.count(A)} / ${g}</span>`,
  _N = (C) => (C?.length ? `Guide lines ${C[0]}\u2013${C[1]}` : "Original addition / inferred record");
class UI {
  constructor(A) {
    ((this.c = A),
      (this.active = null),
      (this.tab = ""),
      (this.page = 0),
      (this.query = ""),
      (this.searchKind = ""),
      (this.city = "prontera"),
      (this.createdName = "Aster"),
      (this.hair = "#6989a6"),
      (this.forgeElement = "Neutral"),
      (this.forgeStar = !1),
      (this.selectedCard = ""),
      (this.logs = []),
      (this.floaters = []),
      (this.modalData = {}),
      this.build(),
      this.bind());
  }
  get g() {
    return this.c.game;
  }
  build() {
    (document.querySelector("#app").insertAdjacentHTML(
      "beforeend",
      `
  <section id="title" class="title-screen" aria-label="Title screen">
    <div class="title-top"><div class="brand-mark">${zA("poring")}<span>A RUNE-MIDGARD ADVENTURE</span></div><span class="badge">INTERNAL \xB7 NON-COMMERCIAL</span></div>
    <div class="title-content"><span class="eyebrow">A LITTLE COURAGE. A WORLD OF WONDER.</span><h1>Poringbound</h1><div class="title-subtitle">THE AMBER OATH</div><div class="title-rule"></div><p class="title-copy">Every great adventure<br>starts with a little Poring.</p><p class="title-description">Find your calling. Make a few friends.<br>Leave your own small mark on Rune-Midgard.</p>
      <div class="title-buttons">${IA("Begin your journey " + zA("arrow"), "new", "", "primary")}<button class="secondary" id="continue-button" data-act="continue">${zA("save")} Continue adventure</button></div>
      <div class="title-links">${IA("How to play", "modal", 'data-modal="controls"', "quiet")}${IA("Settings", "modal", 'data-modal="options"', "quiet")}${IA("About", "modal", 'data-modal="about"', "quiet")}</div>
    </div><div class="title-note"><span class="serif">A familiar place. A new little story.</span>Prontera \xB7 Kingdom of Rune-Midgard</div>
    <footer class="title-footer"><span>SEPTEMBER 26, 2026 \xB7 GPT-6 ASTRA PRO<br>SOLO ADAPTATION \xB7 ORIGINAL TOY-WORLD ART</span><span>Inspired by Ragnarok Online (PC)<br>Weggy\u2019s guide \xB7 version 6.7</span></footer>
  </section>
  <div id="object-labels" class="object-labels hidden"></div>
  <section id="hud" class="hud hidden" aria-label="Game interface">
    <div class="player-card"><div class="portrait" id="portrait"></div><div class="player-details"><div class="player-name"><span id="hero-name">Aster</span><span id="zeny" class="gold">100 z</span></div><div class="player-class"><span id="hero-class">Novice</span><span id="hero-levels">Base 1 \xB7 Job 1</span></div><div class="player-bars"><div class="bar"><div id="hp-bar" class="bar-fill"></div></div><div class="bar sp"><div id="sp-bar" class="bar-fill"></div></div></div><div class="bar-meta"><span id="hp-text"></span><span id="sp-text"></span></div><div class="bar xp"><div id="xp-bar" class="bar-fill"></div></div></div></div>
    <div class="top-location"><span class="eyebrow" id="location-kind">NOVICE TRAINING GROUNDS</span><strong id="location">A new beginning</strong><small id="location-note">A little courage goes a long way.</small></div>
    <div class="top-actions">${IA(zA("help"), "modal", 'data-modal="controls" aria-label="Controls" title="Controls \xB7 H"', "icon-button extra-action")}<button class="icon-button" data-act="mute" id="mute-button" aria-label="Mute audio" title="Mute audio">${zA("sound")}</button>${IA(zA("fullscreen"), "fullscreen", 'aria-label="Fullscreen" title="Fullscreen"', "icon-button extra-action")}${IA(zA("gear"), "modal", 'data-modal="options" aria-label="Options" title="Options \xB7 Esc"', "icon-button")}</div>
    <button class="minimap" data-act="modal" data-modal="atlas" aria-label="Open travel atlas"><canvas id="minimap-canvas" width="180" height="180"></canvas><span class="north">N</span><span class="minimap-foot">${zA("compass").replace("svg ", 'svg style="width:10px;height:10px;vertical-align:middle" ')} EXPLORE RUNE-MIDGARD</span></button>
    <div class="quest-tracker" id="quest-tracker"></div>
    <div class="target-card" id="target-card"><div id="target-name" class="target-name"></div><small id="target-type"></small><div class="bar"><div id="target-hp" class="bar-fill"></div></div><small id="target-vitals"></small></div>
    <div class="log-feed" id="log-feed"></div>
    <div class="bottom-tools">${[
      ["bag", "bag", "B"],
      ["book", "character", "C"],
      ["journal", "journal", "J"],
      ["map", "atlas", "M"],
    ]
      .map(([A, g, I]) =>
        IA(zA(A) + `<span class="key">${I}</span>`, "modal", `data-modal="${g}" aria-label="${g}" title="${g} \xB7 ${I}"`, "icon-button"),
      )
      .join("")}</div>
    <div class="action-dock"><button class="hotkey potion" data-act="potion" title="Red Potion \xB7 Q"><span class="key">Q</span><span class="count" id="potion-count"></span>${zA("potion")}<small>Red Potion</small></button><div class="dock-separator"></div>${[0, 1, 2, 3].map((A) => `<button class="hotkey" id="hotbar-${A}" data-act="skill" data-slot="${A}"><span class="key">${A + 1}</span><span class="skill-icon"></span><small></small><span class="cooldown"></span></button>`).join("")}<div class="dock-separator"></div><button class="hotkey attack" data-act="attack" title="Attack selected / nearest \xB7 Space"><span class="key">SPACE</span>${zA("sword")}<small>Attack</small></button><button class="hotkey" data-act="sit" id="sit-button" title="Sit / stand \xB7 R"> <span class="key">R</span>${zA("rest")}<small>Rest</small></button></div>
    <button id="interact-hint" class="interact-hint" data-act="interact"></button>
    <div class="diagnostics" id="diagnostics"></div><div class="zone-banner" id="zone-banner"><strong></strong><span></span></div>
  </section>
  <div class="toast-stack" id="toast-stack" aria-live="polite"></div>
  <dialog id="modal"><header class="modal-head"><div><span class="eyebrow" id="modal-eyebrow">YOUR ADVENTURE</span><h2 id="modal-title"></h2></div><button class="close-modal" data-act="close" aria-label="Close">${zA("close")}</button></header><div id="modal-body" class="modal-body"></div></dialog>
  <input id="save-import" type="file" accept="application/json,.json" class="hidden" aria-label="Import saved game">
`,
    ),
      (this.dialog = document.querySelector("#modal")),
      (this.body = document.querySelector("#modal-body")));
  }
  bind() {
    (document.addEventListener("click", (A) => {
      let g = A.target.closest("[data-act]");
      g && !g.disabled && (this.c.audio.unlock(), this.c.audio.play("click"), this.action(g.dataset, g));
    }),
      this.dialog.addEventListener("cancel", (A) => {
        (A.preventDefault(), this.close());
      }),
      this.body.addEventListener("input", (A) => {
        (A.target.id === "search-input" && ((this.query = A.target.value), (this.page = 0), this.renderSearchResults()),
          A.target.id === "new-name" && (this.createdName = A.target.value),
          A.target.id === "volume" &&
            (this.c.audio.setVolume(A.target.value / 100),
            (this.c.settings.volume = this.c.audio.volume),
            this.c.saveSettings(),
            (document.querySelector("#volume-value").textContent = A.target.value + "%")));
      }),
      this.body.addEventListener("change", (A) => {
        (A.target.id === "motion" &&
          ((this.c.settings.reducedMotion = A.target.checked),
          document.body.classList.toggle("reduce-motion", A.target.checked),
          this.c.saveSettings()),
          A.target.id === "mute-option" &&
            (this.c.audio.setMute(A.target.checked), (this.c.settings.muted = A.target.checked), this.c.saveSettings()),
          A.target.id === "forge-element" && (this.forgeElement = A.target.value),
          A.target.id === "forge-star" && (this.forgeStar = A.target.checked),
          A.target.id === "card-select" && ((this.selectedCard = A.target.value), this.refresh()),
          A.target.id === "donation" && (this.g.setDonation(A.target.value), this.refresh()));
      }),
      document.querySelector("#save-import").addEventListener("change", async (A) => {
        let g = A.target.files[0];
        if (g) {
          if (g.size > 3e6) {
            this.toast("This save file is too large.", "danger");
            return;
          }
          try {
            let I = H2(await g.text());
            this.confirm(
              "Replace the current journey?",
              "The imported character will replace this device\u2019s active save. Export your current journey first to keep both.",
              () => this.c.loadState(I),
            );
          } catch (I) {
            this.toast(I.message, "danger");
          }
          A.target.value = "";
        }
      }));
  }
  action(A, g) {
    let I = this.g,
      e = !0;
    switch (A.act) {
      case "new":
        this.open("new");
        return;
      case "start-run":
        (this.close(), this.c.newRun(this.createdName, this.hair));
        return;
      case "hair":
        ((this.hair = A.color), this.refresh());
        return;
      case "continue":
        this.c.continueRun();
        return;
      case "modal":
        this.open(A.modal);
        return;
      case "close":
        this.close();
        return;
      case "tab":
        ((this.tab = A.tab), (this.query = ""), (this.page = 0), this.refresh());
        return;
      case "city":
        ((this.city = A.city), (this.page = 0), (this.query = ""), this.refresh());
        return;
      case "page":
        ((this.page = Math.max(0, this.page + +A.delta)), this.renderSearchResults());
        return;
      case "mute":
        ((this.c.settings.muted = !this.c.audio.muted), this.c.audio.setMute(this.c.settings.muted), this.c.saveSettings(), this.update());
        return;
      case "fullscreen":
        this.c.fullscreen();
        return;
      case "kit-settings":
        this.c.openKitSettings();
        return;
      case "potion":
        I.useItem("Red Potion");
        return;
      case "skill":
        I.useSkill(I.p.hotbar[+A.slot]);
        return;
      case "attack":
        if (!I.target) {
          let i = I.nearestTarget();
          i && I.selectTarget(i.id);
        }
        return;
      case "sit":
        I.toggleSit();
        return;
      case "interact":
        I.interact();
        return;
      case "stat":
        I.raiseStat(A.stat);
        break;
      case "learn":
        I.learn(A.id);
        break;
      case "bind":
        I.setHotbar(+A.slot, A.name);
        break;
      case "skill-use":
        (this.close(), I.useSkill(A.name));
        return;
      case "equip":
        I.equip(A.id);
        break;
      case "ammo":
        I.setAmmo(A.id);
        break;
      case "unequip":
        I.unequip(A.slot);
        break;
      case "use-item":
        I.useItem(A.id);
        break;
      case "buy":
        I.buy(A.id, +A.qty, A.commission === "true");
        break;
      case "sell":
        I.sell(A.id, +A.qty);
        break;
      case "sell-gear":
        this.confirm("Sell this equipment?", "Cards and upgrades are not reimbursed. Equipped gear must be removed first.", () => {
          (I.sellGear(A.id), this.open("shop"));
        });
        return;
      case "travel":
        this.travel(A.id);
        return;
      case "goto-city":
        ((this.city = A.id), this.open("atlas", { keepCity: !0 }));
        return;
      case "track-ward":
        ((this.tracked = A.key), this.close(), this.update());
        return;
      case "refine": {
        let i = I.p.gear.find((s) => s.id === A.id),
          t = I.refineInfo(i);
        if (t.chance < 1) {
          this.confirm(
            "Beyond the safe temper",
            `Success chance: ${Math.round(t.chance * 100)}%. Failure returns refinement to +0. The item survives. ${t.cost} zeny and ${t.material} are consumed either way.`,
            () => {
              (I.refine(A.id, !0), this.open("forge"));
            },
          );
          return;
        }
        I.refine(A.id);
        break;
      }
      case "craft":
        I.craft(A.id, this.forgeElement, this.forgeStar);
        break;
      case "slot-card": {
        let i = this.selectedCard;
        this.confirm(
          "Set this card permanently?",
          `${rA(i).name} will be consumed and attached to this equipment. Cards cannot be removed in this journey.`,
          () => {
            (I.slotCard(i, A.id), this.open("forge", { tab: "cards" }));
          },
        );
        return;
      }
      case "rest-kafra":
        I.restAtKafra();
        break;
      case "deposit":
        I.deposit(A.id, +A.qty);
        break;
      case "withdraw":
        I.withdraw(A.id, +A.qty);
        break;
      case "hire":
        I.hire(A.name === "solo" ? null : A.name);
        break;
      case "party-mode":
        ((I.p.companionMode = I.p.companionMode === "assist" ? "hold" : "assist"), (I.changed = !0));
        break;
      case "mount":
        I.toggleMount();
        break;
      case "cart":
        I.nearNpc("kafra") && fC(I.p.job) === "Merchant"
          ? ((I.p.cart = !I.p.cart), I.emit("equip"))
          : this.toast("A Pushcart is available to Merchant-family jobs.");
        break;
      case "save":
        this.c.save()
          ? this.toast("Your journey has been saved on this device.", "good")
          : this.toast("Saving is unavailable here. Export your save instead.", "danger");
        break;
      case "export":
        this.exportSave();
        return;
      case "import":
        document.querySelector("#save-import").click();
        return;
      case "to-title":
        (this.close(), this.c.showTitle());
        return;
      case "revive":
        (this.close(), I.revive());
        return;
      case "graduate":
        I.graduateTraining() && this.open("calling");
        break;
      case "choose-calling":
        ((this.city = Qg[A.job].city),
          this.close(),
          this.travel(this.city),
          this.toast(`Visit the ${A.job} Guild Master. Your class changes only after the test.`));
        return;
      case "accept-job":
        I.acceptJob(A.job);
        break;
      case "advance-job":
        if ((I.advanceJob(), I.area.kind === "trial")) {
          this.close();
          return;
        }
        break;
      case "quiz-answer":
        (I.advanceJob(+A.answer), this.open("guild"));
        return;
      case "side":
        I.completeSide(A.id);
        break;
      case "bounty":
        I.startBounty(A.name);
        break;
      case "claim-bounty":
        I.claimBounty();
        break;
      case "guild-found":
        I.foundGuild(this.body.querySelector("#guild-name")?.value || "Amber Company");
        break;
      case "codex-detail":
        ((this.modalData.selected = A.id), this.refresh());
        return;
      case "codex-back":
        ((this.modalData.selected = null), this.refresh());
        return;
      case "confirm": {
        let i = this.confirmCallback;
        ((this.confirmCallback = null), this.close(), i?.());
        return;
      }
      case "freeroam":
        (document.querySelector("#results")?.remove(), (I.paused = !1));
        return;
      case "vend": {
        if (fC(I.p.job) !== "Merchant" || !I.p.cart || I.p.zeny < 0) return;
        let i = rA(A.id),
          t = I.count(i.id),
          s = Math.min(t, 10);
        s &&
          (I.removeItem(i.id, s),
          I.awardZeny(Math.max(2, i.sell) * s * 2),
          I.notify("A simulated town buyer purchased your stock.", "good"));
        break;
      }
      default:
        e = !1;
    }
    (e && this.active && this.refresh(), this.update());
  }
  open(A, g = {}) {
    ((this.active = A),
      (this.modalData = g),
      (this.query = ""),
      (this.page = 0),
      (this.tab =
        g.tab ||
        { character: "status", bag: "usable", journal: "campaign", forge: "refine", shop: "supplies", kafra: "rest", codex: "monsters" }[
          A
        ] ||
        ""),
      A === "atlas" && !g.keepCity && (this.city = this.g.city),
      (this.g.paused = !0),
      this.refresh(),
      this.dialog.open || this.dialog.showModal(),
      // Start on the window's main control, so a controller's A (or Enter) does the obvious thing; a
      // "Are you sure?" prompt starts on Cancel, so a double press never confirms by accident.
      (A === "confirm" ? this.body.querySelector('[data-act="close"]') : this.c.nav.first(this.dialog))?.focus({ preventScroll: !0 }));
  }
  close() {
    (this.dialog.open && this.dialog.close(),
      (this.active = null),
      (this.g.paused = this.c.mode !== "play"),
      // The button or key that closed the window must not also act in the game.
      this.c.kit.input.settle());
  }
  confirm(A, g, I) {
    ((this.confirmCallback = I), this.open("confirm", { title: A, text: g }));
  }
  refresh() {
    keepFocus(this.body, () => this.render());
  }
  render() {
    if (!this.active) return;
    let A = this.body.scrollTop,
      g = {
        new: "A name for your story",
        character: "Your calling",
        bag: "Adventurer\u2019s satchel",
        journal: "The adventure journal",
        atlas: "The roads of Rune-Midgard",
        options: "Make yourself at home",
        controls: "A little field guide",
        about: "About this little world",
        shop: "The town market",
        forge: "Good things take a little craft",
        kafra: "Welcome back, traveller",
        mentor: "A little guidance",
        guild: "Find your calling",
        calling: "Which road will be yours?",
        quiz: "The guild examination",
        board: "Adventurers wanted",
        codex: "The Rune-Midgard compendium",
        defeat: "Even heroes need a little help",
        confirm: this.modalData.title || "Are you sure?",
        vending: "Your little shop",
      };
    ((document.querySelector("#modal-title").textContent = g[this.active] || "Your adventure"),
      (document.querySelector("#modal-eyebrow").textContent = ["new", "about", "controls"].includes(this.active)
        ? "PORINGBOUND \xB7 THE AMBER OATH"
        : this.active === "forge"
          ? "REFINEMENT \xB7 RECIPES \xB7 CARDS"
          : this.active === "shop"
            ? `${zi(this.g.p.area)} \xB7 ${FC(this.g.p.zeny)} ZENY`
            : "YOUR ADVENTURE"),
      this.dialog.classList.toggle(
        "narrow",
        ["new", "options", "about", "controls", "mentor", "quiz", "defeat", "confirm"].includes(this.active),
      ));
    let I = this["panel_" + this.active];
    ((this.body.innerHTML = I ? I.call(this) : ""),
      ["shop", "forge", "codex", "bag", "character"].includes(this.active) && this.renderSearchResults(),
      (this.body.scrollTop = A));
  }
  tabs(A) {
    return `<div class="tabs">${A.map(([g, I, e]) => IA((e ? zA(e) : "") + CA(I), "tab", `data-tab="${g}"`, "tab " + (this.tab === g ? "active" : ""))).join("")}</div>`;
  }
  search(A, g = "Search\u2026") {
    return (
      (this.searchKind = A),
      `<div class="search-row"><input type="search" id="search-input" placeholder="${CA(g)}" value="${CA(this.query)}" autocomplete="off" aria-label="Search ${A}"><span class="search-count" id="search-count"></span></div><div id="search-results"></div>`
    );
  }
  panel_new() {
    return `<p class="serif" style="font-size:19px;color:#81906f">No grand destiny required.<br>Just a name, and a first step.</p><label for="new-name" class="field-label">YOUR NAME</label><input id="new-name" type="text" class="name-input" maxlength="24" value="${CA(this.createdName)}" autocomplete="off"><span class="field-label">A LITTLE PERSONALITY</span><div class="hair-swatches">${["#6989a6", "#a88666", "#7b7869", "#ac7c79", "#9c87ab", "#c5ac7c"].map((A) => IA("", "hair", `data-color="${A}" style="background:${A}" aria-label="Hair colour ${A}"`, "swatch " + (A === this.hair ? "selected" : ""))).join("")}</div><p class="tip">Begin as a Novice. Learn the basics, then earn one of six first jobs. Your base and job levels grow separately; you decide how to spend your stat and skill points.</p>${this.c.hasSave() ? '<div class="panel-note warning">Beginning a new journey replaces the active local save. Export it from Settings first to keep your previous character.</div>' : ""}${IA("Take the first step " + zA("arrow"), "start-run", "", "primary")}<p class="footer-caption">Solo play \xB7 Local save \xB7 No account or online server</p>`;
  }
  panel_character() {
    let A = this.g,
      g = A.derived();
    return (
      this.tabs([
        ["status", "Status", "book"],
        ["skills", "Skills", "magic"],
        ["equipment", "Equipment", "shield"],
        ["party", "Company", "party"],
        ["guild", "Guild", "flag"],
      ]) +
      (this.tab === "status"
        ? `<div class="grid-two"><div><h3>${CA(A.p.name)} <span style="color:${Qg[A.p.job].color}">${zA($l(A.p.job))}</span></h3><p class="tip">${CA(A.p.job)} \xB7 Base ${A.p.base} \xB7 Job ${A.p.jobLevel}<br>${A.p.statPoints} unspent stat points</p>${gc.map((I, e) => `<div class="stat-row"><span class="stat-letter">${I}</span><span class="stat-desc">${["Melee power & carrying", "Attack speed & evasion", "Health & resilience", "Magic power & spirit", "Accuracy, bows & casting", "Criticals & crafting"][e]}</span><span class="stat-value">${A.p.stats[I]}</span>${IA("+", "stat", `data-stat="${I}" ${jg(A.p.statPoints < 1 + Math.floor(A.p.stats[I] / 10) || A.p.stats[I] >= 99)} aria-label="Increase ${I}"`, "stat-add")}<span class="stat-cost">${1 + Math.floor(A.p.stats[I] / 10)} pt</span></div>`).join("")}</div><div class="card"><span class="eyebrow">THE DETAILS MATTER</span><div class="metrics">${[
            ["Attack", g.atk],
            ["Magic attack", g.matk],
            ["Defense", Math.round(g.def)],
            ["Magic defense", Math.round(g.mdef)],
            ["Hit", g.hit],
            ["Flee", g.flee],
            ["Critical", g.crit.toFixed(1) + "%"],
            ["Attack interval", g.attackDelay.toFixed(2) + "s"],
          ]
            .map(([I, e]) => `<div class="metric"><small>${I.toUpperCase()}</small><strong>${e}</strong></div>`)
            .join(
              "",
            )}</div><p class="tip">Base EXP: ${Math.floor(A.p.baseXP)} / ${A.baseNeed()}<br>Job EXP: ${Math.floor(A.p.jobXP)} / ${A.jobNeed()}<br>Weapon element: ${CA(g.element)}</p><div class="panel-note">Journey combat values are compressed for solo play. The compendium preserves the guide\u2019s original figures.</div>${IA("Open compendium", "modal", 'data-modal="codex"')}${A.p.job === "Novice" ? IA("Explore the six callings", "modal", 'data-modal="calling"') : ""}</div></div>`
        : this.tab === "skills"
          ? `<div class="panel-note">${A.p.skillPoints} skill points available. Learned active skills can be bound to slots 1\u20134. Quest skills are earned through a town mentor. Skill numbers and prerequisites originate in the guide; complex compound effects are condensed.</div>${this.search("skills", "Find a skill or element\u2026")}`
          : this.tab === "equipment"
            ? `<div class="panel-note">Dropped and crafted gear may have card slots. Refinement and card setting happen at the town artisan. Guide level requirements are divided by three for this journey.</div>${[
                "weapon",
                "head",
                "armor",
                "shield",
                "garment",
                "shoes",
                "accessory",
              ]
                .map((I) => {
                  let e = A.gear(I);
                  return `<div class="equipment-row"><div class="item-emblem">${zA(I === "weapon" ? "sword" : "shield")}</div><div class="row-copy"><small>${I.toUpperCase()}</small><strong>${e ? CA(A.gearName(e)) : "Not equipped"}</strong>${e?.cards.length ? `<small>${e.cards.map((i) => CA(rA(i).name)).join(" \xB7 ")}</small>` : ""}</div>${e ? IA("Remove", "unequip", `data-slot="${I}"`) : ""}</div>`;
                })
                .join("")}<div class="row-gap"></div><h3>In your satchel</h3>${this.search("equipment", "Search your equipment\u2026")}`
            : this.tab === "party"
              ? this.partyPanel()
              : this.guildPanel())
    );
  }
  partyPanel() {
    let A = this.g;
    return `<div class="panel-note">Your company is simulated locally, not other players. One companion can follow at a time. Hire or change companions at Kafra. You keep full base and job experience.</div><div class="grid-three">${[
      ["Mira", "Acolyte", "A patient healer. Restores health when you need it."],
      ["Rowan", "Swordsman", "A steady blade. Adds dependable close-range damage."],
      ["Linn", "Archer", "A watchful ranger. Adds damage to your chosen fight."],
    ]
      .map(
        ([g, I, e]) =>
          `<div class="card">${zA($l(I))}<h3>${g}</h3><span class="eyebrow">${I}</span><p class="tip">${e}</p>${A.p.companion === g ? '<span class="badge">IN YOUR COMPANY</span>' : IA("Invite at Kafra", "hire", `data-name="${g}" ${jg(!A.nearNpc("kafra"))}`)}</div>`,
      )
      .join(
        "",
      )}</div><div class="button-row" style="margin-top:18px">${IA("Order: " + (A.p.companionMode === "assist" ? "Follow & assist" : "Hold position"), "party-mode")}${IA("Travel solo", "hire", `data-name="solo" ${jg(!A.nearNpc("kafra"))}`)}</div><p class="tip">${A.p.pet ? "Pip, your tiny Poring friend, picks up nearby drops. Pip is an original campaign reward." : "A tiny travelling friend awaits after your first ward."}</p>`;
  }
  guildPanel() {
    let A = this.g;
    return A.p.guild
      ? `<div class="card"><span class="eyebrow">YOUR OFFLINE GUILD</span><h3>${CA(A.p.guild.name)}</h3><p>Guild level ${A.p.guild.level} \xB7 ${Math.floor(A.p.guild.xp)} donated base experience</p><label class="field-label">BASE EXPERIENCE DONATION</label><select id="donation">${[0, 10, 25, 50, 100].map((g) => `<option value="${g}" ${A.p.donation === g ? "selected" : ""}>${g}%</option>`).join("")}</select><p class="tip">Donated experience grows the guild instead of your base level. Guild levels are recorded; this compact journey does not simulate an online guild economy.</p></div><div class="row-gap"></div><div class="chapter-card"><h4>The Amber Oath</h4><p>Restore six wards, earn a second job, then challenge the Emperium Castle with your company.</p>${IA("Open the castle route", "goto-city", 'data-id="prontera"')}</div>`
      : `<p class="serif" style="font-size:22px">An oath is stronger when it is shared.</p><p class="tip">A ward guardian carries an Emperium. Bring one to a Guild Master to create your own company. The guide\u2019s guild creation consumes this stone.</p><label class="field-label">GUILD NAME</label><input id="guild-name" type="text" value="Amber Company" maxlength="28"><div class="row-gap"></div>${IA("Found your guild \xB7 1 Emperium", "guild-found", jg(!A.nearNpc("guild") || !A.count("Emperium")), "primary")}<p class="tip">This build is offline. The siege is an original ending, not a recreation of live War of Emperium.</p>`;
  }
  panel_bag() {
    let A = this.g,
      g = A.weight() / A.maxWeight();
    return `<div class="panel-note ${g >= 0.5 ? "warning" : ""}">Weight ${Math.ceil(A.weight())} / ${A.maxWeight()} \xB7 ${Math.round(g * 100)}%. Above 50%, natural HP/SP recovery stops. Above 90%, attacks and skills stop.</div>${this.tabs(
      [
        ["usable", "Usable", "potion"],
        ["equipment", "Equipment", "sword"],
        ["material", "Materials", "leaf"],
        ["card", "Cards", "card"],
      ],
    )}${this.search("bag", "Search your satchel\u2026")}`;
  }
  panel_journal() {
    let A = this.g;
    return (
      this.tabs([
        ["campaign", "The Amber Oath", "compass"],
        ["job", "Your calling", "flag"],
        ["side", "Town stories", "journal"],
      ]) +
      (this.tab === "campaign"
        ? `<p class="tip">The Amber Oath is an original campaign connecting the guide\u2019s towns and encounters. It is not a lost Ragnarok Online main quest.</p><div class="chapter-card ${A.p.training >= 2 ? "done" : ""}"><div class="chapter-header"><span class="chapter-number">I</span><div><h4>The smallest beginning</h4><span class="tip">Defeat three Porings and speak with Mira. Earn your first job.</span></div></div><p>${A.p.training >= 2 ? "Training complete." : `${Math.min(3, A.p.trainingKills)} / 3 Porings defeated.`} ${A.p.job === "Novice" ? "Your first calling still awaits." : `Your calling: ${CA(A.p.job)}.`}</p></div><div class="chapter-card"><div class="chapter-header"><span class="chapter-number">II</span><div><h4>Six lights across the kingdom</h4><span class="tip">Hunt the six ward guardians. Build your equipment and your skills along the way.</span></div></div></div><div class="ward-cards">${ur.map((g) => `<div class="ward-card ${A.p.wards.includes(g.key) ? "done" : ""}"><span class="ward-icon">${A.p.wards.includes(g.key) ? "\u2726" : "\u25C7"}</span><strong>${g.name}</strong><small>${CA(g.boss)}<br>${CA(zi(g.area))}</small><div class="row-gap"></div>${IA(A.p.wards.includes(g.key) ? "Restored" : "Track ward", "track-ward", `data-key="${g.key}"`)}</div>`).join("")}</div><div class="row-gap"></div><div class="chapter-card ${A.p.finished ? "done" : ""}"><div class="chapter-header"><span class="chapter-number">III</span><div><h4>The oath we keep</h4><span class="tip">Become a second job, found a guild, and restore the Emperium.</span></div></div><p>Wards ${A.p.wards.length} / 6 \xB7 Second job ${Qg[A.p.job].parent !== "Novice" && A.p.job !== "Novice" ? "\u2713" : "\u2014"} \xB7 Guild ${A.p.guild ? "\u2713" : "\u2014"}</p>${IA("The Emperium Castle", "travel", 'data-id="ember-castle"')}</div>`
        : this.tab === "job"
          ? this.jobQuestPanel()
          : `<p class="tip">Talk to the local mentor to turn in materials. Travel and NPC sequences from the guide are condensed into town turn-ins; the original instructions remain visible.</p>${pB.map((g) => `<div class="quest-row"><div class="check">${A.p.sideDone.includes(g.id) ? "\u2713" : "\xB7"}</div><div class="row-copy"><strong>${CA(g.title)}</strong><small>${CA(zi(g.city))} ${g.class ? "\xB7 " + g.class : ""} \xB7 ${_N(g.source)}</small><p class="tip">${CA(g.text)}</p><div class="requirements">${g.needs.map(([I, e]) => aw(A, I, e)).join("")}</div>${A.p.sideDone.includes(g.id) ? '<span class="badge">COMPLETED</span>' : IA("Turn in at mentor", "side", `data-id="${g.id}" ${jg(!A.nearNpc("mentor") || A.city !== g.city)}`)}</div></div>`).join("")}`)
    );
  }
  jobQuestPanel() {
    let A = this.g,
      g = A.p.jobQuest;
    if (!g)
      return `<div class="panel-note">${A.p.job === "Novice" ? "Reach Novice job level 10, then choose one of six first callings." : "Reach first-job level 40 to earn a second calling."}</div><h3>${CA(A.p.job)} \xB7 Job ${A.p.jobLevel}</h3><div class="job-grid">${Object.keys(
        Qg,
      )
        .filter((i) => Qg[i].parent === A.p.job)
        .map(
          (i) =>
            `<div class="job-card">${zA($l(i))}<strong>${i}</strong><small>${zi(Qg[i].city)}</small>${IA("Find the guild", "goto-city", `data-id="${Qg[i].city}"`)}</div>`,
        )
        .join("")}</div>`;
    let I = Ls[g.job],
      e = I.steps[g.step];
    return `<h3>The path to ${g.job}</h3><p class="tip">${zi(I.city)} Guild \xB7 Step ${Math.min(g.step + 1, I.steps.length)} / ${I.steps.length} \xB7 Fee ${FC(I.fee)} zeny</p>${I.steps.map((i, t) => `<div class="quest-row"><div class="check">${t < g.step ? "\u2713" : t + 1}</div><div class="row-copy"><strong>${CA(i.text)}</strong>${i.needs && t === g.step ? '<div class="requirements">' + i.needs.map(([s, o]) => aw(A, s, o)).join("") + "</div>" : ""}</div></div>`).join("")}<div class="row-gap"></div>${A.nearNpc("guild") && A.city === I.city ? IA(e ? (e.type === "trial" ? "Enter the proving grounds" : e.type === "quiz" ? "Take the examination" : "Continue your trial") : `Take the ${g.job} oath`, "advance-job", "", "primary") : IA("Find your Guild Master", "goto-city", `data-id="${I.city}"`)}<p class="tip">Guild tests retain their source themes. Detailed dialogue, fixed material sets where the guide is vague, and compact trial layouts are this adaptation\u2019s additions.</p>`;
  }
  panel_atlas() {
    let A = this.g,
      g = Js.find((i) => i.id === this.city) || Js[1],
      I = [SI.get(g.id), ...[...SI.values()].filter((i) => i.city === g.id)].filter(Boolean),
      e = (i) =>
        i.id !== "ember-castle" || (A.p.wards.length === 6 && A.p.guild && A.p.job !== "Novice" && Qg[A.p.job].parent !== "Novice");
    return `<div class="panel-note">A compact travel network connects every imported field and dungeon floor. Town departures cost 20 zeny; field recalls cost 50. First visits to towns are free. Travel is unavailable during combat. These routes are an adaptation, not exact original map adjacency.</div><div class="area-layout"><nav class="city-list">${Js.filter(
      (i) => i.id !== "training",
    )
      .map((i) => IA(CA(i.name), "city", `data-city="${i.id}"`, "city-tab " + (i.id === g.id ? "active" : "")))
      .join("")}</nav><div><svg class="world-map" viewBox="0 0 105 96" role="img" aria-label="Compact Rune-Midgard town map">${Js.filter(
      (i) => i.id !== "training",
    )
      .map((i, t, s) => (t ? `<line x1="${s[t - 1].pos[0]}" y1="${s[t - 1].pos[1]}" x2="${i.pos[0]}" y2="${i.pos[1]}"/>` : ""))
      .join("")}${Js.filter((i) => i.id !== "training")
      .map(
        (i) =>
          `<circle cx="${i.pos[0]}" cy="${i.pos[1]}" r="${g.id === i.id ? 2.3 : 1.4}"/><text x="${i.pos[0]}" y="${i.pos[1] + 4.8}" text-anchor="middle">${CA(i.name)}</text>`,
      )
      .join(
        "",
      )}</svg><h3>${g.name}</h3><div class="area-grid">${I.map((i) => `<div class="area-card ${i.id === A.p.area ? "current" : ""}"><span class="eyebrow">${i.kind === "city" ? "TOWN \xB7 SAFE HAVEN" : i.kind === "field" ? "FIELD \xB7 JOURNEY LV. " + i.recommended : "DUNGEON \xB7 JOURNEY LV. " + i.recommended}</span><h4>${CA(i.name)}</h4><small>${i.kind === "city" ? CA(i.tag) : CA((i.monsters || []).slice(0, 4).join(" \xB7 "))}${i.guideRecommended ? "<br>Guide recommendation: " + i.guideRecommended : ""}</small>${IA(i.id === A.p.area ? "You are here" : e(i) ? "Travel " + zA("arrow") : "The oath is not ready", "travel", `data-id="${i.id}" ${jg(i.id === A.p.area || !e(i))}`)}</div>`).join("")}</div></div></div>`;
  }
  panel_shop() {
    let A = this.g;
    return (
      this.tabs([
        ["supplies", "Supplies", "potion"],
        ["equipment", "Equipment", "sword"],
        ["commission", "Special orders", "scroll"],
        ["sell", "Sell drops", "coin"],
      ]) +
      `<div class="panel-note">${this.tab === "commission" ? "Special orders are an original testing-build service: every catalogued item is obtainable for zeny, including rare drops and otherwise missing quest materials. Prices here are not the guide\u2019s historical market prices." : this.tab === "sell" ? "Only unequipped equipment can be sold. Merchant Overcharge increases the value of stackable drops." : "Town prices come from the guide. Merchant Discount and Rogue Haggle apply. Arrows are consumable; keep a reserve."}</div>${this.search("shop", this.tab === "commission" ? "Search every item, rare, card, or ingredient\u2026" : "Find supplies or equipment\u2026")}`
    );
  }
  panel_forge() {
    let A = this.g;
    return (
      this.tabs([
        ["refine", "Refinement", "hammer"],
        ["craft", "Recipes", "potion"],
        ["arrows", "Arrows", "bow"],
        ["cards", "Set cards", "card"],
      ]) +
      (this.tab === "refine"
        ? `<div class="panel-note">The guide\u2019s weapon-safe levels are +7 / +6 / +5 for weapon levels 1 / 2 / 3. Armor is safe through +5. Beyond this, the journey displays its own success rates. Failure resets refinement to +0 without destroying your item.</div>${A.p.gear
            .map((g) => {
              let I = rA(g.item),
                e = A.refineInfo(g);
              return `<div class="item-row"><div class="item-emblem">${zA(Dr(I))}</div><div class="row-copy"><strong>${CA(A.gearName(g))}</strong><small>${e.material ? `${rA(e.material).name} ${A.count(e.material)} / 1 \xB7 ${e.cost} z \xB7 ${Math.round(e.chance * 100)}% success` : "Level 4 weapons cannot be refined."}</small></div>${IA("Temper +" + (g.refine + 1), "refine", `data-id="${g.id}" ${jg(!e.material || g.refine >= 10)}`)}</div>`;
            })
            .join("")}`
        : this.tab === "arrows"
          ? `<div class="panel-note">Arrow Crafting consumes 10 SP and one listed ingredient per conversion. Learn it through the Archer quest; remain below 50% weight. Multiple outputs follow the guide. Equip ammunition in Satchel \u2192 Materials.</div>${this.search("arrow-recipes", "Find an arrow conversion\u2026")}`
          : this.tab === "craft"
            ? `<div class="panel-note">All imported recipes consume their listed ingredients. Geffen\u2019s artisan service is available in each town for this compact journey. Forge chance: 60% + base\xD70.4% + DEX\xD70.1% + LUK\xD70.05%, capped at 98%. An element subtracts 12%; a star subtracts 8%. Potions, dyes, hats, and ores are guaranteed.</div><div class="grid-two"><div><label class="field-label">OPTIONAL FORGED WEAPON ELEMENT</label><select id="forge-element">${["Neutral", "Fire", "Water", "Earth", "Wind"].map((g) => `<option ${g === this.forgeElement ? "selected" : ""}>${g}</option>`).join("")}</select></div><div><label class="field-label">OPTIONAL STAR CRUMB</label><label class="toggle"><input type="checkbox" id="forge-star" ${this.forgeStar ? "checked" : ""}> Add a star \xB7 consumes 1 Star Crumb</label></div></div><p class="tip">Elemental forging also consumes Flame Heart / Mistic Frozen / Great Nature / Rough Wind.</p>${this.search("recipes", "Find a recipe or ingredient\u2026")}`
            : `<div class="panel-note">Cards permanently occupy a slot in compatible gear. Common stat bonuses and basic on-hit ailments are active. Complex conditional and granted-skill card effects are preserved in the compendium but are not all simulated; see the completion report.</div><label class="field-label">CHOOSE A CARD</label><select id="card-select"><option value="">Choose from your satchel\u2026</option>${Object.entries(
                A.p.inventory,
              )
                .filter(([g]) => rA(g).kind === "card")
                .map(([g, I]) => `<option value="${g}" ${g === this.selectedCard ? "selected" : ""}>${CA(rA(g).name)} \xD7${I}</option>`)
                .join(
                  "",
                )}</select>${this.selectedCard ? `<p class="tip">${CA(rA(this.selectedCard).description)}<br>Fits: ${CA(rA(this.selectedCard).slot)}</p>` : ""}${A.p.gear
                .filter((g) => g.slots > 0)
                .map(
                  (g) =>
                    `<div class="item-row"><div class="item-emblem">${zA("shield")}</div><div class="row-copy"><strong>${CA(A.gearName(g))}</strong><small>${g.cards.length} / ${g.slots} slots used \xB7 ${g.cards.map((I) => CA(rA(I).name)).join(" \xB7 ") || "Unoccupied"}</small></div>${IA("Set card", "slot-card", `data-id="${g.id}" ${jg(!this.selectedCard || g.cards.length >= g.slots)}`)}</div>`,
                )
                .join("")}`)
    );
  }
  panel_kafra() {
    let A = this.g;
    return (
      this.tabs([
        ["rest", "Rest & save", "home"],
        ["storage", "Storage", "bag"],
        ["company", "Company", "party"],
      ]) +
      (this.tab === "rest"
        ? `<div class="grid-two"><div class="card"><span class="eyebrow">A PLACE TO RETURN TO</span><h3>${zi(A.city)}</h3><p class="tip">A warm welcome, full HP and SP, and a safe place to save. Your Butterfly Wings will bring you back here.</p>${IA("Rest, restore & save", "rest-kafra", "", "primary")}</div><div class="card"><h3>On the road</h3><p class="tip">Travel light. Empty your pack regularly. Carrying more than half your weight limit stops natural recovery.</p><div class="button-row">${IA(A.p.mount ? "Return your PecoPeco" : "Rent PecoPeco \xB7 250 z", "mount", jg(!["Knight", "Crusader"].includes(A.p.job)))}${IA(A.p.cart ? "Return Pushcart" : "Rent Pushcart", "cart", jg(fC(A.p.job) !== "Merchant"))}</div></div></div>`
        : this.tab === "company"
          ? this.partyPanel()
          : `<div class="grid-two"><div><h3>Your satchel</h3>${Object.entries(A.p.inventory)
              .map(
                ([g, I]) =>
                  `<div class="item-row"><div class="row-copy"><strong>${CA(rA(g).name)} \xD7${I}</strong></div>${IA("Store all", "deposit", `data-id="${g}" data-qty="${I}"`)}</div>`,
              )
              .join("")}</div><div><h3>Kafra storage</h3>${
              Object.entries(A.p.storage)
                .filter(([, g]) => g > 0)
                .map(
                  ([g, I]) =>
                    `<div class="item-row"><div class="row-copy"><strong>${CA(rA(g).name)} \xD7${I}</strong></div>${IA("Withdraw", "withdraw", `data-id="${g}" data-qty="${I}"`)}</div>`,
                )
                .join("") || '<div class="empty">A little room for your treasures.</div>'
            }</div></div>`)
    );
  }
  panel_mentor() {
    let A = this.g;
    return A.p.training < 2
      ? `<p class="serif" style="font-size:22px">\u201CNo one begins as a hero.<br>We all begin here.\u201D</p><p>I\u2019m Mira. Click the ground to move, or use WASD. Click a pink Poring to attack it until it falls. Pick up what it drops. Rest with R, and keep a Red Potion ready on Q.</p><div class="panel-note">Defeat three Porings, then come back. Base levels give stat points; job levels give skill points. As a Novice, your basic skill grows with your job level.</div><h3>${Math.min(A.p.trainingKills, 3)} / 3 Porings</h3><div class="button-row">${IA("Back to the meadow", "close", "", "secondary")}${IA("I\u2019m ready for the road", "graduate", jg(A.p.trainingKills < 3), "primary")}</div>`
      : `<p class="serif" style="font-size:22px">\u201CThe kingdom is full of little lights.<br>Let\u2019s not let them go out.\u201D</p><p>The six ward guardians have grown restless. Carry their lights home, earn your calling, and find the courage to face the castle\u2019s shadow.</p><div class="button-row">${IA("Read the Amber Oath", "modal", 'data-modal="journal"')}${A.p.job === "Novice" ? IA("Choose a first calling", "modal", 'data-modal="calling"') : ""}</div><div class="row-gap"></div><h3>Stories in this town</h3>${
          pB
            .filter((g) => g.city === A.city)
            .map(
              (g) =>
                `<div class="quest-row"><div class="row-copy"><strong>${CA(g.title)}</strong><p class="tip">${CA(g.text)}</p><div class="requirements">${g.needs.map(([I, e]) => aw(A, I, e)).join("")}</div>${A.p.sideDone.includes(g.id) ? '<span class="badge">COMPLETED</span>' : IA("Complete this request", "side", `data-id="${g.id}"`)}</div></div>`,
            )
            .join("") || '<p class="tip">There are no mentor requests here. Try a Guild Master or the Adventurers\u2019 Board.</p>'
        }`;
  }
  panel_calling() {
    return `<p class="serif" style="font-size:22px">Six paths. Every one starts with you.</p><p class="tip">First jobs require Novice job level 10. Choosing a road here takes you to its town; you still need to pass the guild\u2019s test.</p><div class="job-grid">${BAA.map((A) => `<div class="job-card">${zA($l(A))}<strong>${A}</strong><small>${Qg[A].role}</small><small>${zi(Qg[A].city)}</small>${IA("Visit the guild", "choose-calling", `data-job="${A}"`)}</div>`).join("")}</div>`;
  }
  panel_guild() {
    let A = this.g,
      g = Object.keys(Qg).filter((I) => Qg[I].parent === A.p.job && Qg[I].city === A.city);
    return `${A.p.jobQuest ? this.jobQuestPanel() : `<h3>${zi(A.city)} Guild</h3><p class="tip">Current calling: ${A.p.job} \xB7 Job level ${A.p.jobLevel}. First jobs require Novice job 10; second jobs require first-job level 40.</p><div class="job-grid">${g.map((I) => `<div class="job-card">${zA($l(I))}<strong>${I}</strong><small>Guild fee: ${FC(Ls[I].fee)} zeny</small>${IA("Begin the trial", "accept-job", `data-job="${I}" ${jg(A.p.jobLevel < (A.p.job === "Novice" ? 10 : 40))}`)}</div>`).join("") || '<p class="tip">Your next calling is taught in another town. The journal will point the way.</p>'}</div>`}<div class="row-gap"></div>${this.guildPanel()}`;
  }
  panel_quiz() {
    let A = this.modalData;
    return `<h3>${CA(A.question || "The examination")}</h3><p class="tip">${CA(A.text || "")}</p><div style="display:flex;flex-direction:column;gap:10px">${(A.choices || []).map((g, I) => IA(CA(g), "quiz-answer", `data-answer="${I}"`, "secondary")).join("")}</div><p class="footer-caption">There is no penalty for thinking it through or trying again.</p>`;
  }
  panel_board() {
    let A = this.g;
    return `<div class="panel-note">Bounties are original side content. Hunt six monsters of your choice from the local fields, then claim zeny, experience, and supplies here. Accepting another replaces the current bounty.</div>${A.p.bounty ? `<div class="card"><h3>${CA(A.p.bounty.name)} \xB7 ${A.p.bountyProgress} / 6</h3><p class="tip">Reward: ${FC(A.p.bounty.reward)} zeny + EXP + 5 Red Potions</p>${IA("Claim your reward", "claim-bounty", jg(A.p.bountyProgress < 6), "primary")}</div><div class="row-gap"></div>` : ""}<div class="grid-three">${P2(
      A.city,
    )
      .slice(0, 24)
      .map(
        (g) =>
          `<div class="card"><h4>${CA(g)}</h4><p class="tip">${CA(Ae(g).element)} \xB7 ${CA(Ae(g).size)}</p>${IA("Take bounty", "bounty", `data-name="${CA(g)}"`)}</div>`,
      )
      .join("")}</div>`;
  }
  panel_codex() {
    let A = this.modalData.selected;
    if (A) {
      let g = yg.monsters.find((I) => I.id === A) || yg.items.find((I) => I.id === A) || yg.skills.find((I) => I.id === A) || rA(A);
      return `${IA("\u2190 Back to compendium", "codex-back")}<div class="row-gap"></div><div class="codex-details"><span class="eyebrow">SOURCE RECORD \xB7 ${_N(g.source)}</span><h3>${CA(g.name)}</h3><p class="tip">Original guide data. Journey combat values and availability may differ. Spellings and contradictions have not been silently replaced with modern server data.</p><pre>${CA(
        Object.entries(g.raw || g)
          .filter(([I]) => !["id", "source"].includes(I))
          .map(
            ([I, e]) =>
              `${I}: ${Array.isArray(e) ? e.map((i) => (typeof i == "object" ? JSON.stringify(i) : i)).join(", ") : typeof e == "object" ? JSON.stringify(e) : e}`,
          ).join(`
`),
      )}</pre></div>`;
    }
    return (
      this.tabs([
        ["monsters", "Bestiary", "skull"],
        ["items", "Items", "bag"],
        ["skills", "Skills", "magic"],
        ["areas", "World", "map"],
      ]) +
      `<div class="panel-note">Imported records from Weggy\u2019s v6.7 guide. ${yg.monsters.length} monster records \xB7 ${yg.items.length} item records \xB7 ${yg.skills.length} skill records \xB7 83 fields \xB7 61 dungeon floors. A catalog entry does not imply every original conditional mechanic is implemented.</div>${this.search("codex", "Search the source compendium\u2026")}`
    );
  }
  panel_vending() {
    let A = this.g;
    return `<div class="panel-note">Offline vending simulation: town buyers immediately buy a lot of up to 10 units at twice the NPC sell value. This is not an online marketplace. The guide\u2019s social price discovery is not simulated.</div>${Object.entries(
      A.p.inventory,
    )
      .slice(0, 40)
      .map(
        ([g, I]) =>
          `<div class="item-row"><div class="row-copy"><strong>${CA(rA(g).name)} \xD7${I}</strong></div>${IA("Vend lot \xB7 " + FC(Math.max(2, rA(g).sell) * Math.min(10, I) * 2) + " z", "vend", `data-id="${g}"`)}</div>`,
      )
      .join("")}`;
  }
  panel_options() {
    let A = this.c,
      g = this.g;
    return `<div class="option-row"><div><label>Graphics &amp; controls</label><small>Quality, resolution, renderer, touch controls, camera speed.</small></div>${IA("Open settings", "kit-settings")}</div><p class="tip">Active: ${CA(A.view.backend)} \xB7 ${CA(A.kit.tier.name)} quality. Higher tiers render sharper, with larger shadow maps and more loose crates and drops.</p><div class="option-row"><div><label for="volume">Master volume</label><small id="volume-value">${Math.round(A.audio.volume * 100)}%</small></div><input type="range" id="volume" min="0" max="100" value="${Math.round(A.audio.volume * 100)}"></div><div class="option-row"><label for="mute-option">Mute all audio</label><input id="mute-option" type="checkbox" ${A.audio.muted ? "checked" : ""}></div><div class="option-row"><label for="motion">Reduce interface motion</label><input id="motion" type="checkbox" ${A.settings.reducedMotion ? "checked" : ""}></div><div class="option-row"><label>Display</label>${IA("Toggle fullscreen", "fullscreen")}</div><div class="row-gap"></div><h3>Your journey, on this device</h3><p class="tip">Autosaved during play and after milestones. Export a copy before changing devices or clearing browser data. Private browsing and file:// storage may not persist consistently.</p><div class="button-row">${IA("Save now", "save", jg(A.mode !== "play"))}${IA("Export save", "export", jg(A.mode !== "play"))}${IA("Import save", "import")}</div><div class="row-gap"></div><div class="button-row">${IA("Return to title", "to-title", "", "secondary")}${IA("About & credits", "modal", 'data-modal="about"', "quiet")}</div>`;
  }
  panel_controls() {
    return `<p class="serif" style="font-size:21px">Pick your fights. Mind your pack.<br>And always be kind to an Acolyte.</p><table class="controls-table"><tbody>${[
      ["Click / tap ground", "Walk to that spot. WASD or arrow keys also move."],
      ["Click / tap a monster", "Lock onto that target and attack until it falls. No automatic target chaining."],
      ["Space / Attack", "Attack the selected monster, or select the nearest one."],
      ["1 \xB7 2 \xB7 3 \xB7 4", "Cast the skill in that slot. Learn and assign skills in the character book."],
      ["Q \xB7 R", "Q uses a Red Potion. R or Insert sits / stands; sitting doubles recovery."],
      ["E / Talk button", "Talk to a nearby person or pick up a nearby drop."],
      ["Tab", "Cycle nearby targets."],
      ["B \xB7 C \xB7 J \xB7 M", "Satchel \xB7 Character \xB7 Journal \xB7 Travel atlas."],
      ["H \xB7 Esc", "Controls \xB7 Options / close a window."],
      ["Drag \xB7 wheel", "Rotate and tilt the camera \xB7 zoom. Right double-click resets the camera."],
      [
        "Controller",
        "Left stick or D-pad moves \xB7 right stick turns the camera \xB7 A attacks \xB7 X talks \xB7 B drinks a Red Potion \xB7 Y cycles targets \xB7 LB RB LT RT cast skills 1\u20134 \xB7 L3 sits \xB7 R3 zooms \xB7 View opens the satchel \xB7 Start opens options.",
      ],
      ["Controller in windows", "D-pad or stick moves between buttons \xB7 A presses \xB7 B or Start closes \xB7 LB / RB switch tabs."],
      ["Touch stick", "Put your left thumb down low on the left and slide to walk; tap a target and use the action buttons."],
      ["Drag / pinch", "Drag open ground to rotate and tilt the camera; pinch to zoom."],
      ["Red floor circle", "A boss attack is coming. Move out before it fills."],
    ]
      .map(([A, g]) => `<tr><td>${A}</td><td>${g}</td></tr>`)
      .join(
        "",
      )}</tbody></table><p class="tip">At 50% weight, recovery stops; at 90%, combat stops. Keep arrows, potions, and escape wings ready. The minimap shows people, monsters, and exits.</p>`;
  }
  panel_about() {
    return `<p class="serif" style="font-size:25px">Poringbound<br><span style="font-size:16px;letter-spacing:.1em">THE AMBER OATH</span></p><p>A solo, non-commercial internal adaptation inspired by <strong>Ragnarok Online (PC)</strong>, with original low-poly toy art and an original ending campaign.</p><div class="card"><p style="margin:0">Generated <strong>${dr.date}</strong><br>AI model: <strong>${dr.model}</strong><br>Authoritative content: Weggy\u2019s Ragnarok Online FAQ, version 6.7, July 9, 2004.<br>City composition reference: the supplied seven-city map sheet.</p></div><p class="tip">Ragnarok Online and its characters, locations, and terminology belong to their respective rights holders, including Gravity. This is not an official product and has no connection to official game servers.</p><div class="panel-note warning"><strong>Audio substitution disclosed:</strong> the requested source-game audio could not be retrieved. This build uses 11 original synthesized temporary tracks/effects, all listed in one audio manifest. No Ragnarok DS or unverified recordings were passed off as PC audio.</div><p class="tip">Renderer: three.js r186 WebGPURenderer on the wall\u2019s shared 3D kit, WebGPU with a WebGL2 fallback, TSL materials and a node post chain. Physics: Rapier 0.20.</p><p class="tip">The complete source inventory, adaptations, and unimplemented compound mechanics are documented in COMPLETION_REPORT.md and docs/SOURCE_CHECKLIST.md. This solo game does not reproduce an MMO service, social economy, or every historical skill/card condition.</p>`;
  }
  panel_defeat() {
    return `<p class="serif" style="font-size:24px">\u201CCome on. The road<br>hasn\u2019t run out of you yet.\u201D</p><p>Kafra is ready to bring you home. Your equipment, zeny, and job experience are safe. You lose 1% of the experience needed for your next base level, never a level.</p><p class="tip">Prepare potions, avoid crowds, and try a different element. Sitting is best done somewhere safe.</p>${IA("Return to " + zi(this.g.p.savePoint), "revive", "", "primary")}`;
  }
  panel_confirm() {
    return `<p>${CA(this.modalData.text)}</p><div class="button-row">${IA("Cancel", "close", "", "secondary")}${IA("Confirm", "confirm", "", "primary")}</div>`;
  }
  renderSearchResults() {
    keepFocus(this.body, () => this.renderResults());
  }
  renderResults() {
    let A = this.body.querySelector("#search-results");
    if (!A) return;
    let g = this.g,
      I = this.query.trim().toLowerCase(),
      e = [],
      i;
    if (this.searchKind === "skills")
      ((e = Ew(g.p.job).filter((Q) => !I || (Q.name + " " + Q.description).toLowerCase().includes(I))),
        (i = (Q) => {
          let a = g.p.skills[Q.id] || 0;
          return `<div class="skill-row"><div class="item-emblem">${zA(q2(Q.name))}</div><div class="row-copy"><strong>${CA(Q.name)} <span class="skill-lv">${a} / ${Q.max}</span></strong><small>${Q.active ? "Active \xB7 " + CA(Q.sp) + " SP" : "Passive"}${Q.quest ? " \xB7 Quest skill" : ""}</small><small>${CA((Q.levels.find((r) => r.level === Math.max(1, a)) || Q.levels[0])?.text || Q.description)}</small><small>Needs: ${CA(Q.prerequisites)}</small></div><div class="skill-actions">${IA("+ Learn", "learn", `data-id="${Q.id}" ${jg(g.p.skillPoints < 1 || a >= Q.max || !g.canLearn(Q) || !g.prerequisitesMet(Q))}`)}${a && Q.active ? IA("Cast", "skill-use", `data-name="${CA(Q.name)}"`) : ""}${a && Q.active ? `<div class="button-row">${[0, 1, 2, 3].map((r) => IA("" + (r + 1), "bind", `data-slot="${r}" data-name="${CA(Q.name)}" title="Assign to ${r + 1}"`, "small-button bind")).join("")}</div>` : ""}</div></div>`;
        }));
    else if (this.searchKind === "equipment" || (this.searchKind === "bag" && this.tab === "equipment"))
      ((e = g.p.gear.filter((Q) => !I || rA(Q.item).name.toLowerCase().includes(I))),
        (i = (Q) =>
          `<div class="item-row"><div class="item-emblem">${zA(Dr(rA(Q.item)))}</div><div class="row-copy"><strong>${CA(g.gearName(Q))}</strong><small>${CA(rA(Q.item).description)} \xB7 ${rA(Q.item).weight} wt.</small></div>${IA(Object.values(g.p.equipped).includes(Q.id) ? "Equipped" : "Equip", "equip", `data-id="${Q.id}" ${jg(Object.values(g.p.equipped).includes(Q.id))}`)}</div>`));
    else if (this.searchKind === "bag")
      ((e = Object.entries(g.p.inventory)
        .map(([Q, a]) => ({ ...rA(Q), count: a }))
        .filter((Q) => Q.kind === this.tab && (!I || Q.name.toLowerCase().includes(I)))),
        (i = (Q) =>
          `<div class="item-row"><div class="item-emblem ${Q.kind === "card" ? "card" : ""}">${zA(Dr(Q))}</div><div class="row-copy"><strong>${CA(Q.name)} \xD7${Q.count}</strong><small>${CA(Q.description)} \xB7 ${Q.weight} wt.</small></div>${Q.kind === "usable" ? IA("Use", "use-item", `data-id="${Q.id}"`) : /arrow/i.test(Q.name) ? IA(g.p.ammo === Q.id ? "Selected" : "Equip arrows", "ammo", `data-id="${Q.id}"`) : ""}</div>`));
    else if (["recipes", "arrow-recipes"].includes(this.searchKind))
      ((e = (this.searchKind === "arrow-recipes" ? yg.arrowRecipes : yg.recipes).filter(
        (Q) => !I || (Q.name + " " + Q.ingredients.map((a) => a[0]).join(" ")).toLowerCase().includes(I),
      )),
        (i = (Q) =>
          `<div class="recipe-row"><div class="item-emblem">${zA(Q.kind === "forge" ? "hammer" : "potion")}</div><div class="row-copy"><strong>${CA(Q.name)}</strong><small>${CA(Q.station)} \xB7 ${Q.kind === "arrow" ? "10 SP" : Q.cost + " z"}${Q.outputs ? "<br>" + Q.outputs.map(([a, r]) => r + " " + CA(a)).join(" + ") : ""}</small><div class="requirements">${Q.ingredients.map(([a, r]) => aw(g, a, r)).join("")}</div></div>${IA("Craft", "craft", `data-id="${Q.id}"`)}</div>`));
    else if (this.searchKind === "shop")
      if (this.tab === "sell")
        ((e = [
          ...Object.entries(g.p.inventory).map(([Q, a]) => ({ ...rA(Q), count: a })),
          ...g.p.gear.filter((Q) => !Object.values(g.p.equipped).includes(Q.id)).map((Q) => ({ ...rA(Q.item), gearId: Q.id, count: 1 })),
        ].filter((Q) => !I || Q.name.toLowerCase().includes(I))),
          (i = (Q) =>
            `<div class="item-row"><div class="item-emblem">${zA(Dr(Q))}</div><div class="row-copy"><strong>${CA(Q.name)} \xD7${Q.count}</strong><small>${FC(Q.sell || 1)} z each before Overcharge</small></div><div class="button-row">${Q.gearId ? IA("Sell", "sell-gear", `data-id="${Q.gearId}"`) : IA("Sell 1", "sell", `data-id="${Q.id}" data-qty="1"`) + IA("Sell all", "sell", `data-id="${Q.id}" data-qty="${Q.count}"`)}</div></div>`));
      else {
        let Q = [
          "Red Potion",
          "Blue Potion",
          "Orange Potion",
          "Yellow Potion",
          "White Potion",
          "Green Potion",
          "Fly Wing",
          "Butterfly Wing",
          "Arrow",
          "Trap",
          "Milk",
          "Carrot",
          "Meat",
          "Phracon",
          "Emveretarcon",
          "Blue Gemstone",
          "Red Gemstone",
          "Yellow Gemstone",
          "Empty Bottle",
          "Medicine Bowl",
        ];
        ((e =
          this.tab === "supplies"
            ? Q.map((a) => rA(a))
            : x2().filter((a) => this.tab === "commission" || (["weapon", "armor"].includes(a.kind) && a.buy > 0 && !a.rare))),
          (e = e.filter((a) => !I || (a.name + " " + a.description).toLowerCase().includes(I))),
          (i = (a) => {
            let r = g.price(a, this.tab === "commission");
            return `<div class="item-row"><div class="item-emblem ${a.kind === "card" ? "card" : ""}">${zA(Dr(a))}</div><div class="row-copy"><strong>${CA(a.name)}</strong><small>${CA(a.description)}<br>${a.weight} wt. \xB7 ${FC(r)} z${g.count(a.id) ? " \xB7 Carrying " + g.count(a.id) : ""}</small></div><div class="button-row">${IA("Buy \xB7 " + FC(r), "buy", `data-id="${a.id}" data-qty="1" data-commission="${this.tab === "commission"}" ${jg(g.p.zeny < r)}`)}${["weapon", "armor", "card"].includes(a.kind) ? "" : IA("\xD710", "buy", `data-id="${a.id}" data-qty="10" data-commission="${this.tab === "commission"}" ${jg(g.p.zeny < r * 10)}`)}</div></div>`;
          }));
      }
    else
      this.searchKind === "codex" &&
        ((e = (
          this.tab === "monsters" ? yg.monsters : this.tab === "items" ? yg.items : this.tab === "skills" ? yg.skills : [...SI.values()]
        ).filter(
          (Q) => !I || (Q.name + " " + (Q.element || "") + " " + (Q.class || "") + " " + (Q.description || "")).toLowerCase().includes(I),
        )),
        (i = (Q) =>
          `<div class="item-row"><div class="item-emblem">${zA(this.tab === "monsters" ? "skull" : this.tab === "skills" ? "magic" : this.tab === "areas" ? "map" : Dr(Q))}</div><div class="row-copy"><strong>${CA(Q.name)}</strong><small>${this.tab === "monsters" ? `${Q.element} \xB7 ${Q.size} \xB7 Guide HP ${FC(Q.hp)}` : this.tab === "skills" ? `${Q.class} \xB7 ${Q.active ? "Active" : "Passive"}` : this.tab === "areas" ? `${Q.kind} \xB7 ${_N(Q.source)}` : CA(Q.description)}</small></div>${this.tab === "areas" ? IA("View route", "goto-city", `data-id="${Q.city || Q.id}"`) : IA("Read", "codex-detail", `data-id="${Q.id}"`)}</div>`));
    let t = 18,
      s = Math.max(0, Math.ceil(e.length / t) - 1);
    this.page = fA(this.page, 0, s);
    let o = e.slice(this.page * t, (this.page + 1) * t);
    ((A.innerHTML = o.map(i).join("") || '<div class="empty">Nothing here just yet.</div>'),
      e.length > t &&
        A.insertAdjacentHTML(
          "beforeend",
          `<div class="page-buttons">${IA("\u2190 Previous", "page", `data-delta="-1" ${jg(!this.page)}`)}<span>${this.page + 1} / ${s + 1}</span>${IA("Next \u2192", "page", `data-delta="1" ${jg(this.page >= s)}`)}</div>`,
        ));
    let B = this.body.querySelector("#search-count");
    B && (B.textContent = e.length + " entries");
  }
  travel(A) {
    let g = this.g;
    if (!SI.has(A)) return;
    if (g.sinceCombat < 3 && g.area.kind !== "city" && g.area.kind !== "training") {
      this.toast("Get clear of combat for a moment, or use a Butterfly Wing.");
      return;
    }
    let I = SI.get(A).kind === "city" && !g.p.visited.includes(A),
      e = I ? 0 : ["city", "training"].includes(g.area.kind) ? 20 : 50;
    if (g.p.zeny < e) {
      this.toast(`Travel costs ${e} zeny. Walk through a nearby portal instead.`);
      return;
    }
    if (A === "ember-castle" && (!g.p.guild || g.p.wards.length < 6 || Qg[g.p.job].parent === "Novice" || g.p.job === "Novice")) {
      this.toast("Six wards, a second calling, and a guild oath are needed.");
      return;
    }
    (this.close(), g.loadArea(A) && ((g.p.zeny -= e), this.c.audio.play("heal")));
  }
  exportSave() {
    let A = new Blob([v2(this.g.p)], { type: "application/json" }),
      g = URL.createObjectURL(A),
      I = document.createElement("a");
    ((I.href = g),
      (I.download = "poringbound-" + this.g.p.name.replace(/[^a-zA-Z0-9]/g, "-") + ".json"),
      I.click(),
      setTimeout(() => URL.revokeObjectURL(g), 5e3),
      this.toast("A save copy is ready."));
  }
  toast(A, g = "info") {
    let I = document.createElement("div");
    ((I.className = "toast " + g),
      (I.textContent = A),
      document.querySelector("#toast-stack").append(I),
      setTimeout(() => I.remove(), 4200));
  }
  log(A, g = "info") {
    (this.logs.push({ text: A, kind: g }),
      (this.logs = this.logs.slice(-4)),
      (document.querySelector("#log-feed").innerHTML = this.logs
        .map((I) => `<div class="log-entry ${I.kind}">${CA(I.text)}</div>`)
        .join("")));
  }
  float(A) {
    let g = document.createElement("div");
    ((g.className = "floating-text " + (A.kind || "heal")),
      (g.textContent = A.text),
      document.querySelector("#app").append(g),
      this.floaters.push({ ...A, node: g, age: 0 }));
  }
  showZone() {
    let A = this.g.area,
      g = document.querySelector("#zone-banner");
    ((g.querySelector("strong").textContent = A.name),
      (g.querySelector("span").textContent = A.tag || "A LITTLE FURTHER ALONG THE ROAD"),
      g.classList.add("show"),
      clearTimeout(this.zoneTimer),
      (this.zoneTimer = setTimeout(() => g.classList.remove("show"), 2700)));
  }
  showEnding() {
    (this.close(), (this.g.paused = !0));
    let A = this.g,
      g = Math.floor(A.p.endingTime / 60);
    (document.querySelector("#results")?.remove(),
      document
        .querySelector("#app")
        .insertAdjacentHTML(
          "beforeend",
          `<section id="results" class="result-screen"><div class="result-card"><div class="result-crest">\u2726</div><span class="eyebrow">THE AMBER OATH \xB7 COMPLETE</span><h1>A little light.<br>A world of wonder.</h1><p>The last shadow loosens its hold on the Emperium. Across the kingdom, six small lights shine a little brighter.<br><br>And somewhere outside Prontera, a Poring bounces along a road that is no longer quite so lonely.</p><div class="results-stats"><div><strong>${CA(A.p.name)}</strong><span>${CA(A.p.job)}</span></div><div><strong>6 / 6</strong><span>WARDS RESTORED</span></div><div><strong>${g}m</strong><span>YOUR JOURNEY</span></div><div><strong>${A.p.totalKills}</strong><span>MONSTERS DEFEATED</span></div></div><div class="button-row">${IA("Keep wandering " + zA("arrow"), "freeroam", "", "primary")}${IA("Save your story", "export", "", "secondary")}${IA("Return to title", "to-title", "", "quiet")}</div><p class="footer-caption">An original campaign ending for this solo adaptation.<br>${dr.date} \xB7 ${dr.model}</p></div></section>`,
        ));
  }
  update() {
    let A = this.g,
      g = A.derived(),
      I = (o, B) => {
        let Q = document.getElementById(o);
        Q && Q.textContent !== B && (Q.textContent = B);
      };
    (I("hero-name", A.p.name),
      I("hero-class", A.p.job),
      I("hero-levels", `Base ${A.p.base} \xB7 Job ${A.p.jobLevel}`),
      I("zeny", FC(A.p.zeny) + " z"),
      I("hp-text", `HP ${Math.ceil(A.p.hp)} / ${g.maxHp}`),
      I("sp-text", `SP ${Math.floor(A.p.sp)} / ${g.maxSp}`),
      (document.querySelector("#hp-bar").style.width = fA((A.p.hp / g.maxHp) * 100, 0, 100) + "%"),
      (document.querySelector("#sp-bar").style.width = fA((A.p.sp / g.maxSp) * 100, 0, 100) + "%"),
      (document.querySelector("#xp-bar").style.width = fA((A.p.baseXP / A.baseNeed()) * 100, 0, 100) + "%"),
      document.querySelector("#portrait").style.setProperty("--hair", A.p.hair),
      I("location", A.area.name),
      I(
        "location-kind",
        A.area.kind === "city"
          ? "KINGDOM OF RUNE-MIDGARD"
          : A.area.kind === "training"
            ? "YOUR FIRST LITTLE ADVENTURE"
            : A.area.kind === "trial"
              ? "GUILD PROVING GROUNDS"
              : "EXPEDITION \xB7 JOURNEY LEVEL " + A.area.recommended,
      ),
      I("location-note", A.area.tag || "Explore at your own pace."),
      I("potion-count", "" + A.count("Red Potion")));
    let e = A.enemies.find((o) => o.id === A.target && o.hp > 0),
      i = document.querySelector("#target-card");
    ((i.style.display = e ? "block" : "none"),
      e &&
        (i.classList.toggle("boss", !!e.boss),
        I("target-name", e.name + (e.boss ? " \xB7 MVP" : "")),
        I("target-type", e.element + " \xB7 " + e.size + " \xB7 Lv. " + e.level),
        I(
          "target-vitals",
          Math.ceil(e.hp) +
            " / " +
            e.maxHp +
            " HP" +
            (e.freeze ? " \xB7 FROZEN" : e.poison ? " \xB7 POISONED" : e.stun ? " \xB7 STUNNED" : ""),
        ),
        (document.querySelector("#target-hp").style.width = fA((e.hp / e.maxHp) * 100, 0, 100) + "%")));
    for (let o = 0; o < 4; o++) {
      let B = document.querySelector("#hotbar-" + o),
        Q = A.p.hotbar[o],
        a = Q ? Us(A.p.job, Q) : null,
        r = Q ? A.skillLevel(Q) : 0,
        E = (Q || "Empty slot").replace(/ \(.*\)/, "");
      ((B.title = Q ? `${Q} \xB7 Lv. ${r} \xB7 ${o + 1}` : "Assign a skill in your character book"),
        B.querySelector("small").textContent !== E &&
          ((B.querySelector("small").textContent = E), (B.querySelector(".skill-icon").innerHTML = zA(q2(Q || "")))),
        B.classList.toggle("locked", !r),
        (B.querySelector(".cooldown").style.height = (a ? fA((A.cooldowns[a.id] || 0) / 4, 0, 1) * 100 : 0) + "%"));
    }
    ((document.querySelector("#mute-button").innerHTML = zA(this.c.audio.muted ? "mute" : "sound")),
      (document.querySelector("#mute-button").ariaLabel = this.c.audio.muted ? "Unmute audio" : "Mute audio"),
      I(
        "diagnostics",
        `${this.c.view.backend} \xB7 ${this.c.kit.tier.name}\n${this.c.frameMs.toFixed(1)} ms${this.c.physics ? " \xB7 " + this.c.physics.bodies.size + " bodies" : ""}`,
      ));
    let t = A.npcs.filter((o) => yA(o, A.player) < 3.6).sort((o, B) => yA(o, A.player) - yA(B, A.player))[0],
      s = document.querySelector("#interact-hint");
    ((s.style.display = t ? "block" : "none"),
      t && (s.innerHTML = `<span class="key">E</span> Speak with ${CA(t.name)}`),
      this.updateQuest(),
      this.drawMinimap());
  }
  updateQuest() {
    let A = this.g,
      g,
      I,
      e;
    if (A.trial)
      ((g = "A test of patience"),
        (I =
          A.trial.type === "selective"
            ? "Only attack Job Change Monsters."
            : A.trial.type === "mushrooms"
              ? "Collect 25 mushroom points. Net Mushrooms count as three."
              : "Reach the glowing floor markers in order."),
        (e =
          A.trial.type === "mushrooms"
            ? `${A.count("Gooey Mushroom") + A.count("Net Mushroom") * 3} / 25 points`
            : `${A.trial.progress} / 4 markers`));
    else if (A.p.training < 2)
      ((g = "Your first little adventure"),
        (I =
          A.p.trainingKills < 3
            ? "Defeat three Porings in the meadow. Click a Poring, or press Space."
            : "Return to Mira by the fountain. Your first calling is waiting."),
        (e = `${Math.min(3, A.p.trainingKills)} / 3 PORINGS`));
    else if (A.p.jobQuest) {
      let s = A.p.jobQuest,
        o = Ls[s.job];
      ((g = "The path to " + s.job),
        (I = o.steps[s.step]?.text || "Return to your Guild Master and take the oath."),
        (e = `${zi(o.city).toUpperCase()} \xB7 STEP ${Math.min(s.step + 1, o.steps.length)}/${o.steps.length}`));
    } else if (A.p.job === "Novice")
      ((g = "Find your calling"),
        (I = "Visit a Guild Master. Open your journal to discover the six first jobs."),
        (e = `NOVICE JOB ${A.p.jobLevel} / 10`));
    else if (A.p.wards.length < 6) {
      let s = ur.find((o) => o.key === this.tracked && !A.p.wards.includes(o.key)) || ur.find((o) => !A.p.wards.includes(o.key));
      ((g = "The " + s.name + " ward"), (I = `${s.hint} Find ${s.boss} in ${zi(s.area)}.`), (e = `${A.p.wards.length} / 6 WARDS RESTORED`));
    } else
      ((g = A.p.finished ? "A world still waiting" : "The oath we keep"),
        (I = A.p.finished
          ? "Every road is open. Keep wandering, try a new recipe, or finish the town stories."
          : "Earn a second job, create your guild with an Emperium, then travel to Emperium Castle."),
        (e = A.p.finished ? "YOUR STORY CONTINUES" : "THE FINAL CHAPTER"));
    let i = `<span class="eyebrow">${A.p.finished ? "THE OPEN ROAD" : "THE AMBER OATH"}</span><h3>${CA(g)}</h3><p>${CA(I)}</p><span class="progress">${CA(e)}</span><div class="ward-row">${ur.map((s) => `<span class="ward-dot ${A.p.wards.includes(s.key) ? "on" : ""}" title="${s.name}">${A.p.wards.includes(s.key) ? "\u2726" : "\xB7"}</span>`).join("")}</div>`,
      t = document.querySelector("#quest-tracker");
    t.innerHTML !== i && (t.innerHTML = i);
  }
  drawMinimap() {
    let A = document.querySelector("#minimap-canvas"),
      g = A.getContext("2d"),
      I = this.g,
      e = WN[I.area.theme];
    (g.clearRect(0, 0, 180, 180), (g.fillStyle = e.ground), g.fillRect(0, 0, 180, 180));
    let i = (s) => 90 + s * 3.45;
    ((g.fillStyle = e.path),
      g.fillRect(82, 8, 16, 164),
      ["city", "training"].includes(I.area.kind) && g.fillRect(8, 85, 164, 16),
      (g.fillStyle = e.wall));
    for (let s of I.obstacles) g.fillRect(i(s.x - s.w / 2), i(s.z - s.d / 2), s.w * 3.45, s.d * 3.45);
    let t = (s, o, B, Q) => {
      ((g.fillStyle = Q), g.beginPath(), g.arc(i(s), i(o), B, 0, Math.PI * 2), g.fill());
    };
    for (let s of I.npcs) t(s.x, s.z, 2.2, "#f8e4a2");
    for (let s of I.enemies) s.hp > 0 && t(s.x, s.z, s.boss ? 3 : 1.4, s.boss ? "#b57f78" : "#9b8775");
    for (let s of I.portals) t(s.x, s.z, 2.3, "#deece0");
    (t(I.player.x, I.player.z, 4, "#fbfae2"), t(I.player.x, I.player.z, 2.5, "#66866d"));
  }
  frame(A) {
    if (this.c.mode !== "play") return;
    let g = this.g,
      I = this.c.view,
      e = [];
    for (let i of g.npcs) {
      if (yA(i, g.player) > 22) continue;
      let t = I.project(i.x, 3.05, i.z);
      t.x > 0 &&
        t.x < innerWidth &&
        t.y > 110 &&
        t.y < innerHeight - 130 &&
        e.push(`<span class="object-label npc" style="left:${t.x}px;top:${t.y}px">${CA(i.name)}</span>`);
    }
    for (let i of g.enemies) {
      if (i.hp <= 0 || (!i.aggro && i.id !== g.target && !i.training && !i.boss)) continue;
      let t = I.project(i.x, i.boss ? 5.7 : 1.7, i.z);
      t.y < 90 ||
        t.y > innerHeight - 110 ||
        t.x < 0 ||
        t.x > innerWidth ||
        e.push(
          `<span class="object-label enemy" style="left:${t.x}px;top:${t.y}px">${CA(i.name)}${i.boss ? " \u2726" : ""}<span class="tiny-hp"><i style="width:${fA((i.hp / i.maxHp) * 100, 0, 100)}%"></i></span></span>`,
        );
    }
    for (let i of g.loot) {
      if (yA(i, g.player) > 6) continue;
      let t = I.project(i.x, 1.15, i.z);
      e.push(`<span class="object-label loot" style="left:${t.x}px;top:${t.y}px">${CA(i.name)}</span>`);
    }
    document.querySelector("#object-labels").innerHTML = e.join("");
    for (let i of this.floaters) {
      i.age += A;
      let t = I.project(i.x, 1.9 + i.age * 0.8, i.z);
      ((i.node.style.left = t.x + "px"), (i.node.style.top = t.y + "px"), (i.node.style.opacity = 1 - i.age / 1.1));
    }
    for (let i of this.floaters.filter((t) => t.age > 1.1)) i.node.remove();
    this.floaters = this.floaters.filter((i) => i.age <= 1.1);
  }
}
// Gameplay actions (keyboard + mouse, controller, touch), following the wall's standard bindings.
// Menu actions drive the game's own DOM windows with a controller (and arrow keys).
const ACTIONS = {
  move: { type: "vector", keys: "wasd+arrows", gamepad: "leftStick+dpad", touch: "stick" },
  look: { type: "look", mouse: "drag", gamepad: "rightStick", touch: "drag" },
  attack: { keys: ["Space"], gamepad: ["A"], touch: "Attack" },
  interact: { keys: ["KeyE"], gamepad: ["X"], touch: "Talk" },
  potion: { keys: ["KeyQ"], gamepad: ["B"] },
  target: { keys: ["Tab"], gamepad: ["Y"] },
  skill1: { keys: ["Digit1"], gamepad: ["LB"] },
  skill2: { keys: ["Digit2"], gamepad: ["RB"] },
  skill3: { keys: ["Digit3"], gamepad: ["LT"] },
  skill4: { keys: ["Digit4"], gamepad: ["RT"] },
  sit: { keys: ["KeyR", "Insert"], gamepad: ["LS"] },
  zoom: { gamepad: ["RS"] },
  camera: { mouse: [2] },
  bag: { keys: ["KeyB"], gamepad: ["Back"] },
  character: { keys: ["KeyC"] },
  journal: { keys: ["KeyJ"] },
  atlas: { keys: ["KeyM"] },
  help: { keys: ["KeyH"] },
  menu: { keys: ["Escape", "KeyP"], gamepad: ["Start"] },
  confirm: { keys: ["Enter", "NumpadEnter"], gamepad: ["A"] },
  back: { gamepad: ["B"] },
  prevTab: { gamepad: ["LB"] },
  nextTab: { gamepad: ["RB"] },
  prevWindow: { gamepad: ["LT"] },
  nextWindow: { gamepad: ["RT"] },
};
const WINDOW_KEYS = [
  ["bag", "bag"],
  ["character", "character"],
  ["journal", "journal"],
  ["atlas", "atlas"],
  ["help", "controls"],
];
const MAIN_WINDOWS = ["bag", "character", "journal", "atlas"];
const ZOOM_STEPS = [30, 22, 40];
const MAX_STEPS = 5;

/** Identifies a menu control across a re-render, so a controller keeps its place after a Buy or a tab switch. */
const navKey = (el) =>
  el
    ? [
        el.tagName,
        el.id,
        ...["act", "id", "tab", "slot", "name", "modal", "stat", "city", "qty", "delta", "color", "job", "answer"].map(
          (k) => el.dataset?.[k] ?? "",
        ),
      ].join("|")
    : "";
const focusables = (root) =>
  [...root.querySelectorAll("button, input:not([type=hidden]):not([type=file]), select, a[href]")].filter(
    (el) => !el.disabled && el.getClientRects().length > 0,
  );
/** Run fn (which re-renders part of a window) and put focus back on the same control, or the one in its place. */
function keepFocus(container, fn) {
  let a = document.activeElement,
    had = !!a && a !== container && container.contains(a),
    key = had && navKey(a),
    index = had ? focusables(container).indexOf(a) : -1;
  fn();
  if (!had) return;
  let list = focusables(container),
    el = list.find((e) => navKey(e) === key) || list[Math.min(index, list.length - 1)];
  el?.focus({ preventScroll: !0 });
}

/**
 * Controller and arrow-key navigation for the game's own DOM menus: the title screen, every
 * window and the ending card. Directions move focus to the nearest control that way, A presses,
 * B or Start closes a window, LB/RB switch tabs and LT/RT switch between the main windows.
 */
class MenuNav {
  constructor(app) {
    ((this.app = app), (this.lastDir = null), (this.repeatAt = 0));
  }
  focus(el) {
    if (!el) return;
    (document.body.classList.add("nav-focus"),
      el.focus({ preventScroll: !0 }),
      el.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
  }
  current(root) {
    let a = document.activeElement;
    return a && a !== root && root.contains(a) && a.getClientRects().length ? a : null;
  }
  first(root) {
    let list = focusables(root);
    return list.find((e) => e.classList.contains("primary")) || list.find((e) => !e.classList.contains("close-modal")) || list[0];
  }
  move(root, dir) {
    let cur = this.current(root);
    if (!cur) return this.focus(this.first(root));
    let dx = dir === "left" ? -1 : dir === "right" ? 1 : 0,
      dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    if (dx && cur.tagName === "SELECT") {
      let i = fA(cur.selectedIndex + dx, 0, cur.options.length - 1);
      i !== cur.selectedIndex && ((cur.selectedIndex = i), cur.dispatchEvent(new Event("change", { bubbles: !0 })));
      return;
    }
    if (dx && cur.type === "range") {
      ((cur.value = +cur.value + dx * 5 * (+cur.step || 1)), cur.dispatchEvent(new Event("input", { bubbles: !0 })));
      return;
    }
    let a = cur.getBoundingClientRect(),
      ax = a.left + a.width / 2,
      ay = a.top + a.height / 2,
      best = null,
      bestScore = 1 / 0;
    for (let el of focusables(root)) {
      if (el === cur) continue;
      let b = el.getBoundingClientRect(),
        ahead = dx > 0 ? b.left >= a.right - 4 : dx < 0 ? b.right <= a.left + 4 : dy > 0 ? b.top >= a.bottom - 4 : b.bottom <= a.top + 4;
      if (!ahead) continue;
      let bx = b.left + b.width / 2,
        by = b.top + b.height / 2,
        along = dx ? (bx - ax) * dx : (by - ay) * dy,
        across = dx ? Math.abs(by - ay) : Math.abs(bx - ax),
        score = along + across * 2.2;
      score < bestScore && ((bestScore = score), (best = el));
    }
    best ? this.focus(best) : dy && this.scroll(root, dy);
  }
  scroll(root, dy) {
    let body = root.querySelector(".modal-body");
    body && body.scrollBy({ top: dy * 120 });
  }
  activate(root) {
    let cur = this.current(root);
    if (!cur) {
      let el = this.first(root);
      return (this.focus(el), el?.click());
    }
    if (cur.tagName === "SELECT") {
      ((cur.selectedIndex = (cur.selectedIndex + 1) % cur.options.length), cur.dispatchEvent(new Event("change", { bubbles: !0 })));
      return;
    }
    if (cur.tagName === "INPUT" && !["checkbox", "radio", "button", "submit"].includes(cur.type)) return;
    cur.click();
  }
  tab(root, d) {
    let tabs = [...root.querySelectorAll(".tabs .tab")].filter((e) => !e.disabled);
    if (!tabs.length) return;
    let i = tabs.findIndex((e) => e.classList.contains("active"));
    tabs[(i + d + tabs.length) % tabs.length].click();
    let now = root.querySelector(".tabs .tab.active");
    now && this.focus(now);
  }
  window(d) {
    let ui = this.app.ui,
      i = MAIN_WINDOWS.indexOf(ui.active);
    i < 0 ||
      (this.app.kit.input.settle(),
      ui.open(MAIN_WINDOWS[(i + d + MAIN_WINDOWS.length) % MAIN_WINDOWS.length]),
      this.focus(this.first(ui.dialog)));
  }
  update(root) {
    let input = this.app.kit.input,
      mv = input.vector("move"),
      dir = null;
    (Math.abs(mv.x) > 0.5 || Math.abs(mv.y) > 0.5) &&
      (dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x > 0 ? "right" : "left") : mv.y > 0 ? "up" : "down");
    let now = performance.now();
    (dir &&
      (dir !== this.lastDir || now >= this.repeatAt) &&
      ((this.repeatAt = now + (dir !== this.lastDir ? 380 : 130)), this.move(root, dir)),
      (this.lastDir = dir));
    if (input.pressed("confirm")) return this.activate(root);
    if (input.pressed("back") || input.pressed("menu")) return root === this.app.ui.dialog ? this.app.ui.close() : void 0;
    (input.pressed("prevTab") && this.tab(root, -1), input.pressed("nextTab") && this.tab(root, 1));
    root === this.app.ui.dialog && (input.pressed("prevWindow") && this.window(-1), input.pressed("nextWindow") && this.window(1));
  }
}

class App {
  constructor(kit) {
    ((this.kit = kit),
      (this.mode = "title"),
      (this.game = new Ic()),
      (this.game.p.area = "prontera"),
      (this.game.paused = !0),
      (this.accumulator = 0),
      (this.uiElapsed = 0),
      (this.saveElapsed = 0),
      (this.labelElapsed = 0),
      (this.frameMs = 16.7),
      (this.physics = null),
      (this.pendingLoot = null),
      (this.press = null),
      (this.lastRightClick = 0),
      (this.inMenu = null),
      (this.settings = this.loadSettings()),
      (this.audio = new GameAudio()),
      (this.audio.volume = this.settings.volume),
      (this.audio.muted = this.settings.muted),
      (this.nav = new MenuNav(this)));
  }
  loadSettings() {
    try {
      let A = JSON.parse(localStorage.getItem("poringbound.options") || "{}");
      return {
        volume: typeof A.volume == "number" ? fA(A.volume, 0, 1) : 0.6,
        muted: !!A.muted,
        reducedMotion: !!A.reducedMotion,
      };
    } catch {
      return { volume: 0.6, muted: !1, reducedMotion: !1 };
    }
  }
  saveSettings() {
    try {
      localStorage.setItem("poringbound.options", JSON.stringify(this.settings));
    } catch {}
  }
  hasSave() {
    try {
      return !!localStorage.getItem(PN);
    } catch {
      return !1;
    }
  }
  async init() {
    let kit = this.kit;
    (kit.loading.progress(0.7, "Tuning the lutes\u2026"), await this.audio.load());
    ((this.view = new View(kit)),
      (this.physics = new Physics(kit.RAPIER, kit.detail(64, 16))),
      kit.onQuality(() => this.physics.setCap(kit.detail(64, 16))),
      document.body.classList.toggle("reduce-motion", this.settings.reducedMotion),
      (this.ui = new UI(this)),
      this.installWorld(),
      this.bindControls(),
      this.ui.update(),
      (document.querySelector("#continue-button").style.display = this.hasSave() ? "flex" : "none"),
      kit.loading.progress(0.85, "Building a little world\u2026"));
    try {
      await this.view.precompile();
    } catch (A) {
      console.warn("Shader pre-compilation skipped.", A);
    }
    (kit.start((A, g) => this.frame(A, g)),
      new URLSearchParams(location.search).has("test") &&
        (window.__PORINGBOUND__ = {
          app: this,
          get game() {
            return this.app.game;
          },
          get ui() {
            return this.app.ui;
          },
          apiVersion: 1,
        }),
      (this.ready = !0));
  }
  installWorld() {
    let A = DAA(this.game.area, this.game.trial);
    (this.game.setLayout(A),
      (this.layout = A),
      this.view.setWorld(A, this.game),
      (this.view.title = this.mode === "title"),
      this.physics.setWorld(A, this.game),
      (this.view.physics = this.physics),
      (this.accumulator = 0),
      (this.pendingLoot = null),
      this.audio.playMusic(["dungeon", "trial"].includes(this.game.area.kind) ? "dungeon" : "town"));
  }
  newRun(A, g) {
    ((this.game = new Ic()),
      (this.game.p.name = String(A).trim().slice(0, 24) || "Aster"),
      (this.game.p.hair = g),
      this.startPlay(),
      (this.ui.logs = []),
      this.ui.log("Click a Poring to begin. Talk to Mira beside the fountain."),
      this.ui.showZone(),
      this.save());
  }
  startPlay() {
    (document.querySelector("#results")?.remove(),
      (this.mode = "play"),
      (this.game.paused = !1),
      this.kit.input.settle(),
      this.installWorld(),
      (this.ui.g.paused = !1),
      document.querySelector("#title").classList.add("hidden"),
      document.querySelector("#hud").classList.remove("hidden"),
      document.querySelector("#object-labels").classList.remove("hidden"),
      this.ui.update(),
      this.layoutTouch(),
      this.audio.unlock());
  }
  loadState(A) {
    (this.ui.close(), (this.game = new Ic(A)), this.startPlay(), this.save(), this.ui.showZone());
  }
  continueRun() {
    try {
      let A = localStorage.getItem(PN);
      if (!A) throw new Error("There is no saved journey on this device yet.");
      this.loadState(H2(A));
    } catch (A) {
      this.ui.toast(A.message, "danger");
    }
  }
  showTitle() {
    (this.mode === "play" && this.save(),
      this.ui.close(),
      document.querySelector("#results")?.remove(),
      (this.mode = "title"),
      (this.game.paused = !0),
      (this.view.title = !0),
      this.kit.input.settle(),
      document.querySelector("#title").classList.remove("hidden"),
      document.querySelector("#hud").classList.add("hidden"),
      document.querySelector("#object-labels").classList.add("hidden"),
      (document.querySelector("#continue-button").style.display = this.hasSave() ? "flex" : "none"));
  }
  save() {
    if (this.mode !== "play") return !1;
    try {
      let A = { ...this.game.p, x: this.game.player.x, z: this.game.player.z };
      return (
        A.area === "guild-trial" && ((A.area = this.game.trial?.returnArea || A.savePoint), (A.x = 0), (A.z = 14)),
        localStorage.setItem(PN, v2(A)),
        (this.lastSaved = this.game.p.playTime),
        !0
      );
    } catch {
      return (
        this.storageWarned ||
          ((this.storageWarned = !0),
          this.ui?.toast("Local saving is unavailable. Export a save from Settings to keep this journey.", "danger")),
        !1
      );
    }
  }
  async fullscreen() {
    try {
      document.fullscreenElement
        ? await document.exitFullscreen()
        : document.documentElement.requestFullscreen
          ? await document.documentElement.requestFullscreen()
          : this.ui.toast("Fullscreen is unavailable in this browser. Add the game to your home screen instead.");
    } catch {
      this.ui.toast("The browser did not allow fullscreen.");
    }
  }
  /** The kit's settings panel (quality, resolution, renderer, controls). A game window is modal, so it steps aside and comes back after. */
  openKitSettings() {
    ((this.reopen = this.ui.active ? { panel: this.ui.active, data: this.ui.modalData } : null), this.ui.close(), this.kit.menu.open());
  }
  bindControls() {
    let kit = this.kit;
    // The kit's settings panel pauses the loop: pause the music with it, and bring back the window it replaced.
    (kit.onPause((A) => {
      if (A) {
        (this.audio.suspend(),
          kit.menu.isOpen && this.ui.dialog.open && ((this.reopen = { panel: this.ui.active, data: this.ui.modalData }), this.ui.close()));
        return;
      }
      if ((document.hidden || this.audio.resume(), this.reopen)) {
        let { panel: g, data: I } = this.reopen;
        ((this.reopen = null), this.ui.open(g, I));
      }
    }),
      document.addEventListener("visibilitychange", () => {
        ((this.accumulator = 0), document.hidden ? (this.save(), this.audio.suspend()) : kit.paused || this.audio.resume());
      }),
      addEventListener("pagehide", () => this.save()),
      kit.onResize(() => this.layoutTouch()),
      kit.settings.subscribe(() => this.layoutTouch()),
      // A mouse click on a HUD button leaves it focused; Space would then press it again instead of attacking.
      document.addEventListener(
        "click",
        (A) => A.target.closest?.("#hud button") && A.detail > 0 && A.target.closest("#hud button").blur(),
      ));
  }
  /** The DOM menu that owns input right now, if any: a window, the ending card, or the title screen. */
  menuRoot() {
    return this.ui.dialog.open
      ? this.ui.dialog
      : document.querySelector("#results") || (this.mode === "title" ? document.querySelector("#title") : null);
  }
  setMenuMode(A) {
    if (A === this.inMenu) return;
    let kit = this.kit;
    ((this.inMenu = A),
      // Tab moves focus in menus and cycles targets in play.
      kit.input.define({ target: { keys: A ? [] : ["Tab"], gamepad: ["Y"] } }),
      kit.touch?.suspend(A, "game"),
      A || (document.body.classList.remove("nav-focus"), document.activeElement?.closest?.("#hud") && document.activeElement.blur()),
      (this.press = null));
  }
  handleInput() {
    let kit = this.kit,
      input = kit.input,
      g = this.game,
      view = this.view,
      root = this.menuRoot();
    if ((this.setMenuMode(!!root), root)) return this.nav.update(root);
    if (this.mode !== "play") return;
    // Camera: drag (mouse or finger) or the right stick turns and tilts; wheel, pinch or R3 zooms.
    let look = input.look("look"),
      k = input.source === "touch" ? 1.2 : input.source === "gamepad" ? 1 : 2.5,
      p = input.pointer;
    // A click or tap that wobbles a few pixels selects or walks; it does not also nudge the camera.
    this.press &&
      !this.press.drag &&
      (Math.hypot(p.x - this.press.x, p.y - this.press.y) < 8 ? (look = { x: 0, y: 0 }) : (this.press.drag = !0));
    (look.x || look.y) && ((view.yaw -= look.x * k), (view.pitch = fA(view.pitch + (look.y * k) / 3, 0.5, 1)));
    let z = input.zoom();
    if (
      (z && ((view.zoom = fA(view.zoom * Math.exp(-z * (input.source === "touch" ? 0.25 : 0.04)), 18, 43)), view.resize()),
      input.pressed("zoom"))
    ) {
      let i = ZOOM_STEPS.findIndex((e) => Math.abs(e - view.zoom) < 0.5);
      ((view.zoom = ZOOM_STEPS[(i + 1) % ZOOM_STEPS.length]), view.resize());
    }
    this.pointer(z);
    if (input.pressed("menu")) return (this.audio.unlock(), this.ui.open("options"));
    for (let [e, i] of WINDOW_KEYS) if (input.pressed(e)) return (this.audio.unlock(), this.ui.open(i));
    let acted = !0;
    if (input.pressed("potion")) g.useItem("Red Potion");
    else if (input.pressed("sit")) g.toggleSit();
    else if (input.pressed("interact")) g.interact();
    else if (input.pressed("target")) g.cycleTarget();
    else if (input.pressed("attack")) {
      if (!g.target) {
        let e = g.nearestTarget();
        e && g.selectTarget(e.id);
      }
    } else {
      acted = !1;
      for (let e = 0; e < 4; e++) input.pressed("skill" + (e + 1)) && (g.useSkill(g.p.hotbar[e]), (acted = !0));
    }
    acted && this.audio.unlock();
  }
  /** Click or tap the world: select a monster, talk to someone, pick something up, or walk there. */
  pointer(zoomed) {
    let input = this.kit.input,
      p = input.pointer;
    if (input.pressed("camera")) {
      let e = performance.now();
      (e - this.lastRightClick < 350 &&
        ((this.view.yaw = Math.PI / 4), (this.view.pitch = Math.PI / 4), (this.view.zoom = 30), this.view.resize()),
        (this.lastRightClick = e));
    }
    (p.justDown && ((this.press = { x: p.x, y: p.y, right: input.down("camera"), pinch: !1 }), this.audio.unlock()),
      this.press && zoomed && (this.press.pinch = !0),
      p.justUp &&
        this.press &&
        (!this.press.right && !this.press.pinch && Math.hypot(p.x - this.press.x, p.y - this.press.y) < 10 && this.clickWorld(p.x, p.y),
        (this.press = null)));
  }
  clickWorld(A, g) {
    let I = this.game;
    if (I.paused || I.dead) return;
    let e = [];
    for (let t of I.enemies) {
      if (t.hp <= 0) continue;
      let s = this.view.project(t.x, t.boss ? 2.1 : 0.8, t.z),
        o = Math.hypot(s.x - A, s.y - g);
      o < (t.boss ? 56 : 28) && e.push({ type: "enemy", o: t, d: o });
    }
    for (let t of I.npcs) {
      let s = this.view.project(t.x, 1.5, t.z),
        o = Math.hypot(s.x - A, s.y - g);
      o < 28 && e.push({ type: "npc", o: t, d: o });
    }
    for (let t of I.loot) {
      let s = this.view.project(t.x, 0.7, t.z),
        o = Math.hypot(s.x - A, s.y - g);
      o < 22 && e.push({ type: "loot", o: t, d: o });
    }
    e.sort((t, s) => t.d - s.d);
    let i = e[0];
    ((this.pendingLoot = null),
      i?.type === "enemy"
        ? I.selectTarget(i.o.id)
        : i?.type === "npc"
          ? I.interact(i.o)
          : i?.type === "loot"
            ? I.pickup(i.o.id) || (I.moveTo(i.o), (this.pendingLoot = i.o.id))
            : I.moveTo(this.view.ground(A, g)));
  }
  inputVector() {
    let A = this.kit.input.vector("move"),
      e = this.view.yaw,
      x = A.x,
      g = -A.y;
    return { x: x * Math.cos(e) + g * Math.sin(e), z: -x * Math.sin(e) + g * Math.cos(e) };
  }
  processEvents() {
    for (let A of this.game.drain()) {
      if (A.type === "area") {
        (this.installWorld(), this.ui.showZone(), this.ui.update());
        continue;
      }
      if (A.type === "interact") {
        let g = {
          mentor: "mentor",
          kafra: "kafra",
          shop: "shop",
          forge: "forge",
          guild: "guild",
          board: "board",
          quartermaster: "mentor",
          master: "mentor",
        };
        this.ui.open(g[A.npc.role] || "mentor");
      }
      (A.type === "openArrowCrafting" && this.ui.open("forge", { tab: "arrows" }),
        A.type === "openAtlas" && this.ui.open("atlas"),
        A.type === "openCodex" && this.ui.open("codex", { selected: A.monster }),
        A.type === "openVending" && this.ui.open("vending"),
        A.type === "quiz" && this.ui.open("quiz", A),
        A.type === "notice" && (this.ui.toast(A.text, A.kind), this.ui.log(A.text, A.kind)),
        A.type === "pickup" &&
          (this.ui.log("\uFF0B " + A.text, rA(A.item || "Jellopy").kind === "card" ? "rare" : "good"), this.audio.play("pickup")),
        A.type === "damage" && (this.ui.float(A), A.kind === "player" && this.audio.play("hit")),
        A.type === "heal" && (this.ui.float({ ...A, kind: "heal" }), this.audio.play("heal")),
        A.type === "attack" && this.audio.play("attack"),
        ["quest", "job", "level", "ward", "refine", "skillLearn"].includes(A.type) &&
          (this.ui.toast(A.text, A.success === !1 ? "danger" : A.type === "ward" ? "rare" : "good"),
          this.ui.log(A.text, "good"),
          this.audio.play(A.type === "level" || A.type === "job" ? "level" : A.type === "refine" ? "refine" : "quest")),
        A.type === "defeat" && (this.audio.play("defeat"), this.ui.open("defeat")),
        A.type === "ending" && (this.audio.play("quest"), this.ui.showEnding()),
        A.type === "saveRequested" && this.save(),
        A.type === "lootSpawn" && this.physics?.add(A.id, A.x, A.z),
        A.type === "lootRemoved" && this.physics?.remove(A.id),
        this.view.event(A));
    }
  }
  frame(A, t) {
    ((this.frameMs = Vg(this.frameMs, A * 1e3, 0.035)), this.processEvents(), this.handleInput());
    if (this.mode === "play" && !this.game.paused && !document.hidden) {
      this.accumulator = Math.min(0.12, this.accumulator + A);
      let e = 0,
        i = this.inputVector();
      for (; this.accumulator >= uB && e < MAX_STEPS; ) {
        if ((this.game.step(uB, i), this.physics.step(), (this.accumulator -= uB), e++, this.pendingLoot)) {
          let s = this.game.loot.find((o) => o.id === this.pendingLoot);
          s
            ? yA(s, this.game.player) < 2.8 && (this.game.pickup(s.id), (this.pendingLoot = null), (this.game.path = []))
            : (this.pendingLoot = null);
        }
        if ((this.processEvents(), this.game.paused)) break;
      }
      (e >= MAX_STEPS && (this.accumulator %= uB),
        (this.saveElapsed += A),
        this.saveElapsed >= 12 && ((this.saveElapsed = 0), this.save()));
    }
    try {
      this.view.render(this.game, fA(this.accumulator / uB, 0, 1), t, A);
    } catch (e) {
      (console.error("Rendering failed", e),
        this.renderErrorShown ||
          ((this.renderErrorShown = !0), this.ui.toast("A renderer error occurred. Details are in the browser console.", "danger")));
    }
    ((this.uiElapsed += A),
      (this.labelElapsed += A),
      this.uiElapsed > 0.1 && ((this.uiElapsed = 0), this.ui.update(), this.updateTouch()),
      this.labelElapsed > 0.033 && (this.ui.frame(this.labelElapsed), (this.labelElapsed = 0)));
  }
  /**
   * Keep the kit's touch controls clear of the HUD's own bottom row: the Attack/Talk cluster and the
   * idle stick ring rise above whatever HUD box sits in their column (the action dock on a phone, the
   * diagnostics or satchel buttons on wider screens). Measured on resize and when the HUD appears.
   */
  layoutTouch() {
    let kit = this.kit;
    if (!kit.touch || this.mode !== "play") return;
    let W = innerWidth,
      H = innerHeight,
      s = kit.settings.get(),
      k = s.touchScale || 1,
      lefty = s.touchHand === "left",
      boxes = ["#hud .action-dock", "#hud .bottom-tools", "#diagnostics"]
        .map((q) => document.querySelector(q)?.getBoundingClientRect())
        .filter((r) => r && r.width);
    if (!boxes.length) return;
    // The interaction pill is hidden most of the time; reserve its place so the controls do not jump.
    let hint = document.querySelector("#interact-hint"),
      hb = hint ? parseFloat(getComputedStyle(hint).bottom) || 0 : 0,
      hw = Math.min(W * 0.4, 140);
    hb && boxes.push({ left: W / 2 - hw, right: W / 2 + hw, top: H - hb - 38 });
    let lift = (a, b, base) =>
        Math.min(
          H * 0.5,
          boxes.reduce((m, r) => (r.right > a && r.left < b ? Math.max(m, H - r.top + 8) : m), base),
        ),
      cw = (80 + 12 + 62) * k + 18,
      cluster = lefty ? lift(0, cw, 18) : lift(W - cw, W, 18),
      stick = lefty ? lift(W - 140 * k, W, 20) : lift(0, 140 * k, 20),
      root = document.documentElement.style;
    (root.setProperty("--pb-cluster-lift", Math.round(cluster) + "px"), root.setProperty("--pb-stick-lift", Math.round(stick) + "px"));
  }
  /** The touch Talk button only shows when someone or something is close enough to use it. */
  updateTouch() {
    let g = this.game,
      A = this.mode === "play" && (g.npcs.some((e) => yA(e, g.player) < 3.6) || g.loot.some((e) => yA(e, g.player) < 2.8));
    A !== this.talkShown && ((this.talkShown = A), this.kit.touch?.setShown("interact", A));
  }
}

const kit = await boot({
  title: "Poringbound",
  physics: true,
  canvas: document.querySelector("#world"),
  gear: "none",
  accent: "#c7ad76",
  background: "#394c45",
  input: ACTIONS,
});
new App(kit).init().catch((A) => {
  (console.error(A), kit.loading.progress(1, "The game could not start: " + String(A?.message || A)));
});
