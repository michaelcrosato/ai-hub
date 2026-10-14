import { createReedWaitingAnimation } from "./assets/reed-animation.js";
const officerAppearance = {
  size: 1.05,
  build: "heroic",
  weapon: null,
  outfit: "shirt",
  sleeves: "long",
  hair: "short",
  hat: { style: "cap", color: "#2c4656" },
  colors: {
    skin: "#d29a79",
    hair: "#342c27",
    cloth: "#344959",
    pants: "#20303e",
    boot: "#0a1218",
    belt: "#161e23",
    trim: "#d5b969",
    glove: "#be886c",
  },
};
const courierAppearance = {
  size: 1.05,
  build: "heroic",
  weapon: null,
  outfit: "coat",
  sleeves: "long",
  hair: "short",
  colors: {
    skin: "#b78160",
    hair: "#241c1a",
    cloth: "#927a4e",
    coat: "#a8884f",
    pants: "#454744",
    boot: "#1e2629",
    trim: "#c7a168",
  },
};
const witnessAppearance = {
  size: 1.02,
  build: "heroic",
  weapon: null,
  outfit: "shirt",
  sleeves: "short",
  hair: "ponytail",
  colors: {
    skin: "#ad7255",
    hair: "#241c20",
    cloth: "#f0d7b0",
    pants: "#82544a",
    boot: "#342b2a",
    belt: "#eee2ce",
    trim: "#bc8665",
  },
};
const suspectAppearance = {
  size: 1.12,
  build: "heroic",
  weapon: null,
  outfit: "coat",
  sleeves: "long",
  hair: "short",
  colors: {
    skin: "#c49378",
    hair: "#3a302b",
    cloth: "#5a6360",
    coat: "#414f50",
    pants: "#273238",
    boot: "#111c23",
    trim: "#7e8982",
  },
};
const spots = {
  street: [
    { id: "radio", name: "DISPATCH", x: 77, y: 207, z: 20, walk: [120, 217] },
    {
      id: "courier",
      name: "COURIER",
      x: 177,
      y: 140,
      z: 25,
      walk: [162, 157],
    },
    {
      id: "trace",
      name: "TIRE MARK",
      x: 216,
      y: 174,
      z: 2,
      walk: [202, 185],
    },
  ],
  diner: [
    {
      id: "witness",
      name: "JUNE PARK",
      x: 110,
      y: 139,
      z: 36,
      walk: [138, 157],
    },
    {
      id: "camera",
      name: "SECURITY",
      x: 267,
      y: 97,
      z: 36,
      walk: [244, 124],
    },
  ],
  depot: [
    {
      id: "van",
      name: "DELIVERY VAN",
      x: 107,
      y: 151,
      z: 28,
      walk: [156, 180],
    },
    {
      id: "manifest",
      name: "MANIFEST",
      x: 254,
      y: 116,
      z: 18,
      walk: [237, 140],
    },
    {
      id: "suspect",
      name: "ELLIS REED",
      x: 246,
      y: 191,
      z: 37,
      walk: [226, 207],
    },
    {
      id: "report",
      name: "DISPATCH",
      x: 174,
      y: 235,
      z: 8,
      walk: [171, 220],
    },
  ],
};
const music = {
  bpm: 54,
  steps: 2,
  tracks: [
    {
      wave: "triangle",
      vol: 0.045,
      notes:
        "D3 - - - . . A2 - | Bb2 - - - . . A2 - | D3 - - - F3 - - - | E3 - - - C3 - A2 -",
    },
    {
      wave: "sine",
      vol: 0.034,
      notes:
        "A4 - . . . . F4 - | E4 - . . . . D4 - | F4 - - - . . E4 - | D4 - . . C4 - - -",
    },
  ],
};

const areas = [
  {
    id: "street",
    name: "Pier 17 · Waterfront",
    shortName: "Waterfront",
    title: "PIER 17",
    subtitle: "THE COLLISION",
    description: "Some things don't wash away.",
    spawn: [128, 191],
    bounds: [32, 108, 256, 264],
    obstacles: [[37, 179, 112, 207]],
    camera: { focus: [143, 123, 13], fit: [565, 367], yaw: -12 },
    painter: "pier-street",
    ambience: { rain: true, music: "pier-nocturne" },
    entrances: [{ id: "main", x: 128, y: 191 }],
  },
  {
    id: "diner",
    name: "Night Owl · All-night diner",
    shortName: "Night Owl",
    title: "NIGHT OWL",
    subtitle: "THE WITNESS",
    description: "The city sleeps. Somebody always sees.",
    spawn: [145, 207],
    bounds: [32, 110, 256, 228],
    obstacles: [
      [51, 97, 90, 138],
      [51, 165, 90, 206],
      [180, 184, 219, 226],
    ],
    camera: { focus: [151, 135, 18], fit: [565, 367], yaw: -12 },
    painter: "pier-diner",
    ambience: { rain: false, music: "pier-nocturne" },
    entrances: [{ id: "main", x: 145, y: 207 }],
  },
  {
    id: "depot",
    name: "Pier 17 · Loading bay",
    shortName: "Loading bay",
    title: "AFTER HOURS",
    subtitle: "THE PAPER TRAIL",
    description: "Every shipment leaves a paper trail.",
    spawn: [176, 211],
    bounds: [32, 108, 256, 264],
    obstacles: [
      [64, 137, 145, 170],
      [213, 95, 267, 137],
    ],
    camera: { focus: [143, 123, 13], fit: [565, 367], yaw: -12 },
    painter: "pier-depot",
    ambience: { rain: true, music: "pier-nocturne" },
    entrances: [{ id: "main", x: 176, y: 211 }],
  },
];
const actors = [
  {
    id: "niko",
    area: "street",
    x: 177,
    y: 140,
    facing: 2.2,
    appearance: courierAppearance,
    pose: "kneel",
    poses: [{ when: { flag: "aidGiven" }, pose: "hips" }],
    portrait: true,
  },
  {
    id: "june",
    area: "diner",
    x: 110,
    y: 139,
    facing: 0.7,
    appearance: witnessAppearance,
    pose: "hips",
    portrait: true,
  },
  {
    id: "ellis",
    area: "depot",
    x: 246,
    y: 191,
    facing: 2.1,
    appearance: suspectAppearance,
    pose: "hips",
    poses: [{ when: { flag: "suspectDetained" }, pose: "kneel" }],
    animation: "reed-wait",
    portrait: true,
  },
];
const links = {
  courier: "niko",
  witness: "june",
  suspect: "ellis",
  radio: "player",
  report: "player",
};
export const pier17Scene = {
  scene: {
    view: "threequarter",
    resolution: [480, 330],
    background: "#07131a",
    seed: 17061991,
  },
  player: {
    appearance: officerAppearance,
    speed: 65,
    radius: 1.8,
    facing: -1.1,
  },
  areas,
  actors,
  hotspots: Object.entries(spots).flatMap(([area, list]) =>
    list.map((s) => ({
      ...s,
      area,
      markerName: s.name,
      ...(links[s.id]
        ? {
            ...(links[s.id] !== "player" ? { actor: links[s.id] } : {}),
            portrait: links[s.id],
          }
        : {}),
    })),
  ),
  music: { "pier-nocturne": music },
  sounds: {
    step: { wave: "noise", freq: 220, to: 90, dur: 0.055, vol: 0.08 },
    select: { wave: "sine", freq: 720, to: 530, dur: 0.07, vol: 0.16 },
    rain: { wave: "noise", freq: 700, to: 500, dur: 0.55, vol: 0.018 },
  },
  extensions: {
    painters: {
      "pier-street": (ctx) => createPierPainter(ctx, "street"),
      "pier-diner": (ctx) => createPierPainter(ctx, "diner"),
      "pier-depot": (ctx) => createPierPainter(ctx, "depot"),
    },
    animations: { "reed-wait": createReedWaitingAnimation },
  },
};
function createPierPainter(ctx, room) {
  const { E, game } = ctx,
    { px } = E;
  let state = {},
    sceneTime = 0;
  const random = E.rng(17061991),
    specks = Array.from({ length: 1900 }, () => [
      random() * 620 - 120,
      random() * 430 - 90,
      random(),
    ]);
  const palette = {
    road: "#14262e",
    roadLight: "#1b3038",
    curb: "#3d4e50",
    brick: "#263d42",
    trim: "#9b9986",
    gold: "#edba6c",
    water: "#092931",
  };
  function P(r, x, y, z = 0) {
    return r.w(x, y, z);
  }
  function poly(r, g, pts, c) {
    px.poly(
      g,
      pts.map((p) => P(r, ...p)),
      c,
    );
  }
  function line(r, g, a, b, c, w = 1) {
    const A = P(r, ...a),
      B = P(r, ...b);
    px.line(g, ...A, ...B, c, w);
  }
  function flat(r, g, x, y, w, d, c, z = 0) {
    poly(
      r,
      g,
      [
        [x, y, z],
        [x + w, y, z],
        [x + w, y + d, z],
        [x, y + d, z],
      ],
      c,
    );
  }
  function box(r, g, x, y, w, d, h, top = "#40575b", side = "#233c44", z = 0) {
    r.box(g, x, y, z, x + w, y + d, z + h, top, side);
  }
  function label(r, g, text, x, y, z, c = "#e5b977", scale = 1) {
    const p = P(r, x, y, z);
    E.font.text(g, text, p[0], p[1], c, {
      align: "center",
      scale,
      shadow: "#07141a",
    });
  }
  function rectangle(r, g, x, y, z, w, h, c) {
    poly(
      r,
      g,
      [
        [x, y, z],
        [x + w, y, z],
        [x + w, y, z + h],
        [x, y, z + h],
      ],
      c,
    );
  }
  function glow(r, g, x, y, z, rad, c, a = 0.15) {
    const p = P(r, x, y, z);
    r.glowDisc(g, ...p, rad * game.zoom, c, a);
  }
  function building(r, x, y, w, d, h, kind = "diner") {
    r.queue(
      x + w / 2,
      y + d,
      0,
      (g) => {
        const diner = kind === "diner";
        box(
          r,
          g,
          x,
          y,
          w,
          d,
          h,
          diner ? "#253b40" : "#24353b",
          diner ? "#385158" : "#31454b",
        );
        // Layered masonry and corrugated sides.
        for (let z = 4; z < h - 7; z += 7) {
          line(r, g, [x, y + d, z], [x + w, y + d, z], "#233b43");
          for (let a = 0; a < w; a += 17)
            line(
              r,
              g,
              [x + a + (z % 14 ? 8 : 0), y + d, z],
              [x + a + (z % 14 ? 8 : 0), y + d, z + 7],
              "#29444b",
            );
        }
        for (let a = 0; a < d; a += 8)
          line(r, g, [x + w, y + a, 3], [x + w, y + a, h - 2], "#1d3137");
        box(r, g, x - 3, y - 2, w + 6, d + 5, 3, "#647276", "#283b40", h);
        box(r, g, x + 8, y + 6, w - 16, d - 12, 2, "#172c32", "#162831", h + 3);
        for (let a = 15; a < w - 12; a += 18)
          line(
            r,
            g,
            [x + a, y + 7, h + 6],
            [x + a, y + d - 7, h + 6],
            "#263f43",
          );
        if (diner) {
          for (let a = 8; a < w - 20; a += 34) {
            rectangle(r, g, x + a, y + d + 0.2, 12, 28, 26, "#152b32");
            rectangle(r, g, x + a + 2, y + d + 0.4, 14, 24, 22, "#c18b52");
            rectangle(r, g, x + a + 3, y + d + 0.6, 19, 22, 14, "#f0c385");
            rectangle(r, g, x + a + 3, y + d + 0.8, 16, 22, 3, "#6c4c36");
            line(
              r,
              g,
              [x + a + 14, y + d + 1, 14],
              [x + a + 14, y + d + 1, 36],
              "#4d4a3c",
              2,
            );
            line(
              r,
              g,
              [x + a + 2, y + d + 1, 27],
              [x + a + 26, y + d + 1, 27],
              "#725a3a",
            );
            const p = P(r, x + a + 7, y + d + 2, 20);
            px.rect(g, p[0], p[1], 5, 4, "#825944");
            glow(r, g, x + a + 14, y + d + 1, 23, 32, "#eaaa56", 0.18);
          }
          rectangle(r, g, x + 3, y + d + 2, 41, w - 6, 13, "#15252b");
          line(
            r,
            g,
            [x + 5, y + d + 3, 53],
            [x + w - 5, y + d + 3, 53],
            "#bb824e",
          );
          label(r, g, "N I G H T   O W L", x + w / 2, y + d + 3, 54, "#f9cf87");
          line(
            r,
            g,
            [x + 5, y + d + 3, 41],
            [x + w - 5, y + d + 3, 41],
            "#7b5037",
          );
          box(r, g, x - 2, y + d + 1, w + 4, 6, 3, "#c3a683", "#725c4a", 38);
          for (let a = 0; a < w; a += 16)
            flat(r, g, x + a, y + d + 1, 8, 6, "#835447", 41);
          rectangle(r, g, x + w - 25, y + d + 3, 1, 16, 35, "#172f34");
          rectangle(r, g, x + w - 23, y + d + 4, 13, 12, 20, "#cfaa71");
          line(
            r,
            g,
            [x + w - 11, y + d + 5, 12],
            [x + w - 11, y + d + 5, 17],
            "#ece0b6",
          );
          label(r, g, "OPEN", x + w - 17, y + d + 5, 28, "#f4ce8b");
          box(r, g, x + 15, y + 12, 25, 13, 7, "#56696b", "#35494e", h + 4);
          for (let i = 0; i < 5; i++)
            line(
              r,
              g,
              [x + 17 + i * 4, y + 24, h + 5],
              [x + 17 + i * 4, y + 24, h + 9],
              "#162e35",
            );
        } else {
          rectangle(r, g, x + 22, y + d + 1, 0, w - 55, h - 18, "#192f36");
          for (let z = 4; z < h - 20; z += 5)
            line(
              r,
              g,
              [x + 23, y + d + 2, z],
              [x + w - 34, y + d + 2, z],
              "#36515a",
            );
          rectangle(r, g, x + 24, y + d + 3, 3, w - 59, 5, "#17262a");
          label(r, g, "HARBOR FREIGHT", x + w / 2, y + d + 4, h - 8, "#aab7ad");
          label(r, g, "17", x + w - 16, y + d + 4, 31, "#c8b885", 2);
          rectangle(r, g, x + 5, y + d + 1, 18, 10, 22, "#15282e");
        }
      },
      { hides: true },
    );
  }
  function lamp(r, x, y, height = 77) {
    r.queue(x, y, 0, (g) => {
      box(r, g, x - 3, y - 3, 6, 6, 4, "#526166", "#1b2b32");
      line(r, g, [x, y, 2], [x, y, height], "#0b1b22", 4);
      line(r, g, [x - 1, y, 5], [x - 1, y, height], "#57635e");
      line(r, g, [x, y, height], [x + 15, y, height + 2], "#4a5755", 3);
      const p = P(r, x + 15, y, height);
      px.rect(g, p[0] - 5, p[1] - 2, 10, 3, "#b3b49b");
      px.rect(g, p[0] - 4, p[1] + 1, 8, 2, "#ffe3a0");
      glow(r, g, x + 15, y, height, 35, "#ebbc78", 0.25);
      px.blend(g, 0.045, "add", () =>
        poly(
          r,
          g,
          [
            [x + 12, y, height],
            [x + 18, y, height],
            [x + 45, y + 25, 0],
            [x - 8, y + 25, 0],
          ],
          "#ffe6a1",
        ),
      );
    });
    r.decal((g) => {
      for (let i = 0; i < 8; i++)
        flat(
          r,
          g,
          x - 8 - i * 2,
          y + 10 + i * 5,
          25 + i * 3,
          1,
          i % 3 ? "#425148" : "#5f6550",
        );
    });
  }
  function cone(r, x, y) {
    r.queue(x, y, 0, (g) => {
      flat(r, g, x - 4, y - 4, 8, 8, "#141d22");
      poly(
        r,
        g,
        [
          [x - 3, y + 2, 1],
          [x + 3, y + 2, 1],
          [x, y, 14],
        ],
        "#d67b47",
      );
      poly(
        r,
        g,
        [
          [x - 2, y + 1, 7],
          [x + 2, y + 1, 7],
          [x + 1, y + 1, 10],
          [x - 1, y + 1, 10],
        ],
        "#d6c7a1",
      );
    });
  }
  function sedan(r, x, y) {
    r.queue(x + 34, y + 18, 0, (g) => {
      r.shadow(x + 35, y + 11, 37, 0.7);
      for (const wx of [12, 59])
        for (const wy of [2, 24]) {
          box(r, g, x + wx - 5, y + wy - 2, 11, 4, 10, "#15232b", "#060d13");
          const p = P(r, x + wx, y + wy + 3, 5);
          px.disc(g, ...p, 3, "#748080");
          px.disc(g, ...p, 1, "#142a33");
        }
      box(r, g, x, y, 75, 25, 12, "#b7c1b7", "#657e80", 6);
      box(r, g, x + 2, y + 1, 72, 23, 2, "#e3ddc3", "#9aab9f", 18);
      box(r, g, x + 22, y + 3, 34, 19, 13, "#385361", "#162d3a", 19);
      flat(r, g, x + 25, y + 5, 28, 15, "#172e3a", 33);
      rectangle(r, g, x + 26, y + 22, 22, 27, 7, "#34525c");
      line(r, g, [x + 40, y + 23, 20], [x + 40, y + 23, 31], "#a8b8ad", 2);
      rectangle(r, g, x + 2, y + 26, 11, 68, 5, "#203941");
      label(r, g, "POLICE", x + 40, y + 27, 18, "#d9e1cd");
      box(r, g, x + 30, y + 7, 16, 9, 2, "#253640", "#172632", 34);
      const lit =
        game.reduceMotion || game.settings.flashes < 0.5
          ? true
          : Math.sin(sceneTime * 6) > 0;
      box(
        r,
        g,
        x + 30,
        y + 8,
        7,
        6,
        3,
        lit ? "#ff796c" : "#913b43",
        "#53333d",
        36,
      );
      box(
        r,
        g,
        x + 39,
        y + 8,
        7,
        6,
        3,
        lit ? "#345c8e" : "#86c1e7",
        "#254359",
        36,
      );
      if (!game.reduceMotion) {
        glow(
          r,
          g,
          x + (lit ? 33 : 42),
          y + 12,
          39,
          31,
          lit ? "#ef624e" : "#60b9ec",
          0.25,
        );
      }
      for (const a of [3, 18]) {
        rectangle(r, g, x + 75, y + a, 11, 1, 5, "#f4e5b5");
      }
      line(r, g, [x - 1, y + 2, 7], [x - 1, y + 24, 7], "#b0b8a9", 2);
    });
    r.decal((g) => {
      const lit =
        game.reduceMotion || game.settings.flashes < 0.5
          ? true
          : Math.sin(sceneTime * 6) > 0;
      for (let i = 0; i < 14; i++)
        flat(
          r,
          g,
          x + 13 + (i % 3) * 5,
          y + 34 + i * 2,
          30 - i * 1.2,
          1,
          lit ? "#503c40" : "#254651",
        );
    });
  }
  function van(r, x, y) {
    r.queue(x + 35, y + 19, 0, (g) => {
      r.shadow(x + 36, y + 12, 40, 0.7);
      for (const wx of [12, 63])
        for (const wy of [0, 27])
          box(r, g, x + wx - 5, y + wy, 12, 5, 12, "#1e2e32", "#080f16");
      box(r, g, x, y, 79, 30, 24, "#467e95", "#295d78", 8);
      box(r, g, x + 2, y + 1, 55, 28, 13, "#548ba0", "#346e88", 31);
      box(r, g, x + 58, y + 2, 17, 25, 10, "#293f46", "#213741", 31);
      rectangle(r, g, x + 8, y + 31, 16, 43, 17, "#316982");
      label(r, g, "HARBOR", x + 29, y + 32, 32, "#e0dcc3");
      label(r, g, "TRANSFER", x + 29, y + 32, 24, "#b9c9bc");
      line(r, g, [x + 3, y + 31, 13], [x + 73, y + 31, 13], "#91aaa9", 2);
      line(r, g, [x + 54, y + 31, 13], [x + 54, y + 31, 39], "#586e69");
      line(r, g, [x + 65, y + 31, 24], [x + 70, y + 31, 24], "#cbd1b8", 2);
      rectangle(r, g, x + 78, y + 5, 16, 1, 7, "#e9d9a1");
      // The two roof beacons and exposed primer are physical clues in the case.
      for (const yy of [7, 22]) {
        box(r, g, x + 58, y + yy, 5, 4, 3, "#f0c174", "#a9753d", 43);
        glow(r, g, x + 60, y + yy, 46, 11, "#f2b967", 0.1);
      }
      for (let i = 0; i < 4; i++)
        line(
          r,
          g,
          [x + 67 + i * 2, y + 31.5, 9 + i * 2],
          [x + 77, y + 31.5, 11 + i * 2],
          i % 2 ? "#a1ada3" : "#c9c3a6",
        );
      label(r, g, "HV-412", x + 64, y + 32, 12, "#e5daba");
      const p = P(r, x + 65, y + 32, 4);
      px.disc(g, ...p, 4, "#485a5b");
      px.disc(g, ...p, 2, "#9ea79a");
    });
  }
  function crate(r, x, y, w = 20, d = 18, h = 20) {
    r.queue(x + w / 2, y + d, 0, (g) => {
      box(r, g, x, y, w, d, h, "#77735c", "#565c4b");
      for (let z = 4; z < h; z += 5)
        line(r, g, [x, y + d, z], [x + w, y + d, z], "#3d483f");
      line(r, g, [x + 2, y + d, 1], [x + 2, y + d, h], "#9c9370", 2);
      line(r, g, [x + w - 2, y + d, 1], [x + w - 2, y + d, h], "#9c9370", 2);
      line(r, g, [x + 3, y + d, 2], [x + w - 3, y + d, h - 2], "#898464", 2);
    });
  }
  function bollard(r, x, y) {
    r.queue(x, y, 0, (g) => {
      box(r, g, x - 2, y - 2, 4, 4, 16, "#869488", "#354f50");
      box(r, g, x - 3, y - 3, 6, 6, 2, "#b7b69a", "#506460", 15);
    });
  }
  function waterfront(r) {
    flat(r, r.ctx, 263, -110, 340, 540, "#09242e");
    for (let i = 0; i < 145; i++) {
      const x = 267 + ((i * 57.13) % 320),
        y = -90 + ((i * 21.19) % 460);
      line(
        r,
        r.ctx,
        [x, y, -2],
        [x + 3 + (i % 8), y, -2],
        i % 5 ? "#113b44" : "#1d5156",
      );
    }
    for (let i = 0; i < 17; i++) {
      const y = 27 + i * 14;
      flat(
        r,
        r.ctx,
        268 + (i % 3) * 4,
        y,
        12 + (i % 4) * 7,
        1,
        i % 2 ? "#325d60" : "#285253",
      );
    }
    flat(r, r.ctx, 240, -90, 23, 420, "#4c6060");
    flat(r, r.ctx, 244, -90, 17, 420, "#304b50");
    for (let y = -50; y < 340; y += 14)
      line(r, r.ctx, [243, y, 0], [262, y, 0], "#263e45");
    for (let y = -25; y < 300; y += 41) {
      bollard(r, 262, y);
      if (y < 260)
        r.queue(262, y + 41, 0, (g) => {
          line(r, g, [262, y, 12], [262, y + 41, 12], "#5b7774");
          line(r, g, [262, y, 8], [262, y + 41, 8], "#1b333b");
        });
    }
    // Across the water: silhouettes, gantry cranes, distant sodium lamps.
    r.queue(340, -58, 0, (g) => {
      for (let i = 0; i < 7; i++)
        box(
          r,
          g,
          279 + i * 24,
          -80,
          21,
          37,
          15 + (i % 3) * 12,
          "#122f39",
          "#0c2530",
        );
      for (let i = 0; i < 16; i++) {
        const p = P(r, 283 + i * 10, -42, 8 + (i % 3) * 3);
        px.rect(g, p[0], p[1], 2, 1, i % 3 ? "#7c835c" : "#cba777");
      }
      for (let x = 310; x < 430; x += 77) {
        line(r, g, [x, -54, 0], [x, -54, 93], "#183741", 3);
        line(r, g, [x - 36, -54, 82], [x + 52, -54, 97], "#24454d", 3);
        line(r, g, [x - 34, -54, 82], [x, -54, 93], "#31525a");
        line(r, g, [x + 48, -54, 96], [x + 48, -54, 50], "#284852");
      }
    });
  }
  function road(r) {
    flat(r, r.ctx, -140, -70, 403, 470, palette.road);
    flat(r, r.ctx, -110, 90, 350, 15, "#34474b");
    flat(r, r.ctx, -110, 105, 350, 3, "#708076");
    for (let x = -100; x < 240; x += 19)
      line(r, r.ctx, [x, 91, 0], [x, 104, 0], "#253b41");
    for (const [x, y, n] of specks)
      if (x < 240 && y > 106) {
        const p = P(r, x, y);
        px.rect(
          r.ctx,
          p[0],
          p[1],
          n > 0.8 ? 2 : 1,
          1,
          n > 0.75 ? "#294048" : n > 0.3 ? "#1c343e" : "#10232d",
        );
      }
    for (let x = -90; x < 230; x += 45) {
      flat(r, r.ctx, x, 232, 23, 2, "#6a6a53");
      flat(r, r.ctx, x, 238, 23, 1, "#545f51");
    }
    for (let i = 0; i < 30; i++) {
      const x = (i * 71) % 230,
        y = 120 + ((i * 37) % 145);
      flat(r, r.ctx, x, y, 8 + (i % 5) * 4, 1, i % 3 ? "#29464d" : "#3c5454");
    }
  }
  function street(r) {
    road(r);
    waterfront(r);
    building(r, 15, 28, 172, 61, 60, "diner");
    building(r, 196, -22, 67, 66, 83, "warehouse");
    r.decal((g) => {
      for (let i = 0; i < 24; i++) {
        const x = 20 + ((i * 33) % 150),
          y = 113 + ((i * 13) % 53);
        flat(r, g, x, y, 9 + (i % 6) * 3, 1, i % 4 ? "#5b5746" : "#8e7350");
      }
    });
    sedan(r, 37, 179);
    lamp(r, 13, 116, 82);
    lamp(r, 231, 219, 88);
    cone(r, 153, 158);
    cone(r, 190, 165);
    cone(r, 221, 124);
    if (state.flags?.sceneSecured)
      r.queue(187, 167, 0, (g) => {
        line(r, g, [153, 158, 10], [190, 165, 10], "#d5bc69", 2);
        label(r, g, "POLICE LINE", 171, 163, 14, "#ddca88");
      });
    if (state.flags?.aidGiven)
      r.queue(186, 145, 0, (g) => {
        box(r, g, 180, 140, 11, 7, 6, "#b8c8b3", "#587f79");
        rectangle(r, g, 184, 148, 1, 2, 5, "#9a5648");
        rectangle(r, g, 182, 148, 3, 6, 1, "#9a5648");
      });
    r.prop("trashcan", 194, 89, 0, { size: 1.3, color: "#385254" });
    r.prop("hydrant", 28, 107, 0, { size: 1.15, color: "#98634a" });
    crate(r, 212, 61, 16, 16, 17);
    crate(r, 231, 67, 14, 14, 24);
    // Fallen courier bicycle, built from projected wheels, spokes and frame tubing.
    r.queue(204, 143, 0, (g) => {
      for (const [cx, cy] of [
        [192, 126],
        [216, 139],
      ]) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2,
            b = ((i + 1) / 16) * Math.PI * 2;
          line(
            r,
            g,
            [cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 1],
            [cx + Math.cos(b) * 7, cy + Math.sin(b) * 7, 1],
            "#0b171d",
            3,
          );
          line(
            r,
            g,
            [cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1],
            [cx + Math.cos(b) * 6, cy + Math.sin(b) * 6, 1],
            "#8caaa6",
          );
        }
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          line(
            r,
            g,
            [cx, cy, 1],
            [cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1],
            "#536f73",
          );
        }
      }
      for (const [a, b] of [
        [
          [192, 126, 2],
          [203, 126, 3],
        ],
        [
          [203, 126, 3],
          [204, 138, 2],
        ],
        [
          [204, 138, 2],
          [192, 126, 2],
        ],
        [
          [203, 126, 3],
          [215, 130, 3],
        ],
        [
          [215, 130, 3],
          [204, 138, 2],
        ],
        [
          [215, 130, 3],
          [216, 139, 2],
        ],
      ])
        line(r, g, a, b, "#7bafa6", 2);
      line(r, g, [213, 127, 3], [219, 129, 3], "#c4c8b3", 2);
      line(r, g, [201, 123, 3], [207, 125, 3], "#1a252b", 3);
      line(r, g, [202, 138, 3], [207, 140, 3], "#a7b3a5");
      box(r, g, 181, 149, 10, 7, 5, "#957f54", "#665e45");
    });
    r.decal((g) => {
      for (let i = 0; i < 3; i++)
        line(r, g, [215 + i * 3, 148, 0], [219 + i * 3, 190, 0], "#08171d", 2);
      flat(r, g, 208, 158, 5, 3, "#475b59");
    });
    r.queue(213, 97, 0, (g) => {
      label(r, g, "PIER 17", 220, 95, 46, "#c6c2a0");
      line(r, g, [214, 95, 1], [214, 95, 50], "#182e35", 3);
    });
    // Utility cable and foreground rail add a layered, lived-in silhouette.
    r.queue(0, 295, 0, (g) => {
      for (let i = 0; i < 14; i++)
        line(
          r,
          g,
          [-35 + i * 24, 248, 102 + Math.sin((i / 13) * Math.PI) * -12],
          [-11 + i * 24, 248, 102 + Math.sin(((i + 1) / 13) * Math.PI) * -12],
          "#08151d",
          2,
        );
    });
  }
  function diner(r) {
    road(r);
    waterfront(r);
    // A cutaway room opens in the same physical waterfront, no miniature map.
    flat(r, r.ctx, 30, 58, 245, 168, "#2d4144");
    for (let y = 60; y < 226; y += 12)
      for (let x = 30; x < 275; x += 12)
        flat(
          r,
          r.ctx,
          x,
          y,
          12,
          12,
          ((x - 30) / 12 + (y - 60) / 12) % 2 ? "#69716a" : "#405551",
        );
    r.queue(150, 61, 0, (g) => {
      box(r, g, 28, 53, 249, 8, 68, "#7a8070", "#324a4a");
      rectangle(r, g, 31, 62, 3, 242, 24, "#5c4439");
      for (let x = 32; x < 273; x += 8)
        line(r, g, [x, 62, 3], [x, 62, 26], "#785644");
      for (let x = 37; x < 255; x += 49) {
        rectangle(r, g, x, 62, 31, 40, 27, "#203941");
        rectangle(r, g, x + 2, 63, 33, 36, 23, "#486764");
        line(r, g, [x + 20, 64, 32], [x + 20, 64, 56], "#acaa8b", 2);
        line(r, g, [x, 64, 44], [x + 39, 64, 44], "#c0b091");
      }
      label(r, g, "GOOD COFFEE. LONG NIGHTS.", 151, 63, 65, "#edd8a3");
      rectangle(r, g, 112, 64, 29, 73, 22, "#172e34");
      label(r, g, "NIGHT OWL", 149, 65, 46, "#efbc72");
      label(r, g, "EST. 1968", 149, 65, 37, "#9fb3a6");
    });
    r.queue(34, 139, 0, (g) =>
      box(r, g, 27, 61, 7, 150, 30, "#8f866e", "#354c48"),
    );
    // Counter, coffee machine, chrome stools.
    r.queue(195, 104, 0, (g) => {
      box(r, g, 165, 72, 101, 31, 29, "#cdc0a0", "#6e5544");
      for (let x = 168; x < 264; x += 9)
        line(r, g, [x, 104, 3], [x, 104, 27], "#8c6a4d");
      box(r, g, 162, 70, 107, 35, 3, "#d7ccb0", "#9d9175", 29);
      box(r, g, 202, 76, 19, 13, 20, "#819490", "#3d5b5c", 32);
      rectangle(r, g, 204, 90, 37, 15, 9, "#213e42");
      for (let x = 208; x < 218; x += 5) {
        const p = P(r, x, 91, 47);
        px.dot(g, ...p, "#f2c17c");
      }
      box(r, g, 239, 78, 18, 13, 3, "#283f42", "#142a31", 32);
      label(r, g, "PIE", 242, 86, 40, "#e4c99b");
    });
    for (let x = 174; x < 265; x += 25) {
      r.queue(x, 121, 0, (g) => {
        line(r, g, [x, 120, 0], [x, 120, 18], "#9ba590", 2);
        flat(r, g, x - 5, 115, 10, 10, "#9b543f", 19);
        line(r, g, [x - 5, 121, 4], [x + 5, 121, 4], "#80978c");
      });
    }
    for (const [x, y] of [
      [51, 97],
      [51, 165],
      [180, 184],
    ]) {
      r.queue(x + 18, y + 22, 0, (g) => {
        box(r, g, x, y, 39, 9, 19, "#a9664b", "#6f4439");
        box(r, g, x, y + 32, 39, 9, 19, "#a9664b", "#6f4439");
        box(r, g, x + 3, y + 14, 33, 17, 22, "#b8aa86", "#605348");
        box(r, g, x + 2, y + 13, 35, 19, 2, "#dbc9a2", "#aa9673", 22);
        for (let a = 10; a < 31; a += 12) {
          box(r, g, x + a, y + 21, 3, 3, 4, "#ece2bd", "#a99976", 24);
        }
        box(r, g, x + 26, y + 18, 5, 6, 8, "#a7563b", "#73352c", 24);
      });
    }
    for (const [x, y] of [
      [73, 113],
      [208, 94],
      [200, 196],
    ]) {
      r.queue(x, y, 0, (g) => {
        line(r, g, [x, y, 83], [x, y, 58], "#1d3034");
        poly(
          r,
          g,
          [
            [x - 10, y, 54],
            [x + 10, y, 54],
            [x + 4, y, 61],
            [x - 4, y, 61],
          ],
          "#516e60",
        );
        line(r, g, [x - 9, y, 54], [x + 9, y, 54], "#f4d99c", 2);
        glow(r, g, x, y, 48, 38, "#dfac65", 0.22);
      });
    }
    r.queue(270, 98, 0, (g) => {
      line(r, g, [273, 98, 28], [265, 98, 37], "#8d9f91", 2);
      box(r, g, 260, 95, 12, 7, 6, "#939e8a", "#435c56", 35);
      const p = P(r, 260, 102, 38);
      px.rect(g, p[0] - 2, p[1], 3, 3, "#111f27");
      px.dot(
        g,
        p[0] + 5,
        p[1] - 3,
        Math.sin(sceneTime * 2) > 0 ? "#a4db8a" : "#487c63",
      );
    });
    r.queue(65, 222, 0, (g) => {
      label(r, g, "ALL NIGHT", 69, 228, 4, "#d1b783");
    });
  }
  function depot(r) {
    road(r);
    waterfront(r);
    building(r, 20, 7, 249, 75, 78, "warehouse");
    for (let x = 34; x < 270; x += 38) {
      flat(r, r.ctx, x, 93, 16, 3, "#a59159");
      flat(r, r.ctx, x + 9, 96, 16, 3, "#756c4b");
    }
    flat(r, r.ctx, 43, 114, 157, 3, "#54645a");
    flat(r, r.ctx, 43, 114, 3, 90, "#54645a");
    flat(r, r.ctx, 43, 201, 157, 3, "#54645a");
    van(r, 64, 137);
    lamp(r, 28, 116, 86);
    lamp(r, 231, 229, 88);
    crate(r, 213, 95, 23, 20, 21);
    crate(r, 239, 95, 24, 21, 31);
    crate(r, 222, 117, 20, 18, 16);
    r.queue(253, 117, 0, (g) => {
      label(r, g, "M-314", 251, 117, 22, "#d9d1ad");
      flat(r, g, 246, 107, 15, 10, "#c6bd93", 34);
      line(r, g, [249, 109, 34], [257, 109, 34], "#566057");
      line(r, g, [249, 112, 34], [259, 112, 34], "#566057");
      box(r, g, 260, 108, 2, 9, 1, "#2b494a", "#2b494a", 35);
    });
    cone(r, 49, 190);
    cone(r, 156, 133);
    r.prop("barrel", 198, 97, 0, { size: 1.15, color: "#485d56" });
    r.prop("trashcan", 27, 87, 0, { size: 1.3, color: "#49635e" });
    r.queue(174, 235, 0, (g) => {
      box(r, g, 168, 227, 12, 12, 6, "#536970", "#263c45");
      box(r, g, 170, 229, 7, 7, 4, "#bcc4af", "#6c827b", 6);
      line(r, g, [172, 232, 10], [171, 232, 22], "#203740", 2);
      const p = P(r, 175, 234, 9);
      px.rect(g, p[0], p[1], 2, 2, "#ebc983");
    });
    // Overhead bay light and loading signage.
    r.queue(145, 87, 0, (g) => {
      glow(r, g, 142, 87, 71, 47, "#a3d7c5", 0.17);
      label(r, g, "BAY 04 / MEDICAL FREIGHT", 142, 85, 10, "#9baaa0");
    });
  }

  return {
    draw(r) {
      state = ctx.getState();
      sceneTime = ctx.getTime();
      ({ street, diner, depot })[room](r);
    },
  };
}
