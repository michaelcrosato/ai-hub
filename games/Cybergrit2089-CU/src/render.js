const E = globalThis.My3D2dge;
const { px } = E;
const ring = (r, x, y, r0, r1, color, alpha = 1) =>
  r.decal(() => r.groundArc(x, y, r0, r1, 0, Math.PI * 2, color, alpha));
const C = {
  lime: "#dbf859",
  teal: "#70edd6",
  pink: "#f081b7",
  red: "#ff7e8d",
  ink: "#111c2c",
};
const face = (r, g, points, color) =>
  px.poly(
    g,
    points.map((p) => r.w(...p)),
    color,
  );
const line = (r, g, a, b, color, width = 1) => {
  const p = r.w(...a),
    q = r.w(...b);
  px.line(g, ...p, ...q, color, width);
};

export class CityRenderer {
  constructor(game) {
    this.game = game;
    this.title = false;
    this.cache = new Map();
    const ua = globalThis.navigator?.userAgent || "";
    this.webkit =
      /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR)/.test(ua);
    this.rain = Array.from({ length: 90 }, (_, i) => ({
      x: (i * 179.13) % 1031,
      y: (i * 97.37) % 601,
      s: 38 + (i % 27),
    }));
  }
  heroOccluded(r, w) {
    const p = w.player,
      [hx, hy] = r.w(p.x, p.y, 32);
    return (w.map.solids || []).some((s) => {
      if (
        s.top < 30 ||
        s.x + s.y <= p.x + p.y ||
        Math.hypot(s.x - p.x, s.y - p.y) > 65
      )
        return false;
      const points = [];
      for (const x of [-s.hx, s.hx])
        for (const y of [-s.hy, s.hy])
          for (const z of [s.z, s.top])
            points.push(
              r.w(s.x + x * s.c - y * s.s, s.y + x * s.s + y * s.c, z),
            );
      return (
        hx >= Math.min(...points.map((p) => p[0])) &&
        hx <= Math.max(...points.map((p) => p[0])) &&
        hy >= Math.min(...points.map((p) => p[1])) &&
        hy <= Math.max(...points.map((p) => p[1]))
      );
    });
  }
  building(r, b, time, player, title) {
    const x = b.x * 16,
      y = b.y * 16,
      w = b.w * 16,
      d = b.d * 16,
      h = b.h,
      t = E.tones(b.color);
    const corners = [
      [x, y, 0],
      [x + w, y, 0],
      [x, y + d, 0],
      [x + w, y + d, 0],
      [x, y, h + 25],
      [x + w, y, h + 25],
      [x, y + d, h + 25],
      [x + w, y + d, h + 25],
    ].map((p) => r.w(...p));
    const left = Math.min(...corners.map((p) => p[0])),
      right = Math.max(...corners.map((p) => p[0])),
      top = Math.min(...corners.map((p) => p[1])),
      bottom = Math.max(...corners.map((p) => p[1]));
    if (right < 0 || left > r.W || bottom < 0 || top > r.H) return;
    const ph = r.w(player.x, player.y, 24);
    const cut =
      !title &&
      x + y + (w + d) / 2 > player.x + player.y &&
      ph[0] > left &&
      ph[0] < right &&
      ph[1] > top &&
      ph[1] < bottom;
    const paint = (r, g) => {
      r.box(g, x, y, 0, x + w, y + d, h, t.lt, t.base);
      // Facade panels, repeated windows, concrete lintels, roof flashing and neon gutters.
      for (let z = 18; z < h - 14; z += 22) {
        for (let a = 7; a < w - 10; a += 18) {
          const on = (Math.floor(a) + z + b.x) % 5 !== 0;
          face(
            r,
            g,
            [
              [x + a, y + d + 0.1, z],
              [x + a + 10, y + d + 0.1, z],
              [x + a + 10, y + d + 0.1, z + 12],
              [x + a, y + d + 0.1, z + 12],
            ],
            on ? ((a + z) % 3 ? "#456779" : "#b79768") : "#172838",
          );
          line(
            r,
            g,
            [x + a, y + d + 0.2, z + 6],
            [x + a + 10, y + d + 0.2, z + 6],
            b.color,
          );
        }
        for (let a = 8; a < d - 10; a += 18) {
          const on = (a + z + b.y) % 4 === 0;
          face(
            r,
            g,
            [
              [x + w + 0.1, y + a, z],
              [x + w + 0.1, y + a + 10, z],
              [x + w + 0.1, y + a + 10, z + 12],
              [x + w + 0.1, y + a, z + 12],
            ],
            on ? "#a28d76" : "#2c455c",
          );
        }
        line(r, g, [x, y + d + 0.3, z - 4], [x + w, y + d + 0.3, z - 4], t.sh);
        line(
          r,
          g,
          [x + w + 0.3, y, z - 4],
          [x + w + 0.3, y + d, z - 4],
          t.deep,
        );
      }
      r.box(
        g,
        x - 1,
        y - 1,
        h,
        x + w + 1,
        y + d + 1,
        h + 3,
        "#617080",
        "#2e4052",
      );
      r.box(g, x + 7, y + 7, h + 3, x + w - 7, y + d - 7, h + 4, t.sh, t.deep);
      for (let i = 0; i < Math.max(1, b.w / 4); i++) {
        const bx = x + 14 + i * 23,
          by = y + 15;
        r.box(g, bx, by, h + 4, bx + 15, by + 20, h + 13, "#617283", "#354b5f");
        for (let n = 0; n < 5; n++)
          line(
            r,
            g,
            [bx + 2, by + 2 + n * 3, h + 13.1],
            [bx + 13, by + 2 + n * 3, h + 13.1],
            "#233747",
          );
      }
      line(r, g, [x + w, y + d, 4], [x + w, y + d, h], b.neon);
      line(r, g, [x, y + d, h - 3], [x + w, y + d, h - 3], b.neon);
      // Service cables and conduit keep the street architecture from reading as empty cubes.
      line(
        r,
        g,
        [x + w - 4, y + d + 1, 0],
        [x + w - 4, y + d + 1, h - 10],
        "#809099",
        2,
      );
      r.box(
        g,
        x + 4,
        y + d + 1,
        5,
        x + 13,
        y + d + 5,
        16,
        "#576574",
        "#243c4e",
      );
      const [sx, sy] = r.w(
        b.face === "x" ? x + w + 1 : x + w / 2,
        b.face === "x" ? y + d / 2 : y + d + 2,
        h * 0.56,
      );
      const tw = E.font.width(b.sign, { scale: 1 }) + 12;
      px.rect(g, sx - tw / 2 - 2, sy - 5, tw + 4, 25, "#0f1c2b");
      px.rect(g, sx - tw / 2, sy - 3, tw, 1, b.neon);
      E.font.text(g, b.sign, sx, sy, b.neon, {
        align: "center",
        shadow: "#10202a",
      });
      E.font.text(g, b.sub, sx, sy + 11, "#9eb5bf", {
        align: "center",
        font: "tiny",
      });
      if (b.id === "noodles") {
        const [ax, ay] = r.w(x + w, y + d + 3, 10);
        px.rect(g, ax - 6, ay - 13, 10, 18, "#e68e60");
        px.rect(g, ax - 4, ay - 10, 6, 12, "#efd9b0");
      }
    };
    const key =
      b.id + ":" + r.view.scale + ":" + r.view.pitchDeg + ":" + r.view.yawDeg;
    let stamp = this.cache.get(key);
    if (!stamp) {
      const pts = [
        [x, y, 0],
        [x + w, y, 0],
        [x, y + d, 0],
        [x + w, y + d, 0],
        [x, y, h + 25],
        [x + w, y, h + 25],
        [x, y + d, h + 25],
        [x + w, y + d, h + 25],
      ].map((p) => r.view.p(...p));
      const minX = Math.floor(Math.min(...pts.map((p) => p[0]))) - 30,
        minY = Math.floor(Math.min(...pts.map((p) => p[1]))) - 20;
      const width = Math.ceil(Math.max(...pts.map((p) => p[0])) - minX) + 40,
        height = Math.ceil(Math.max(...pts.map((p) => p[1])) - minY) + 30;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const pr = Object.create(r);
      pr.w = (wx, wy, wz = 0) => {
        const q = r.view.p(wx, wy, wz);
        return [q[0] - minX, q[1] - minY];
      };
      paint(pr, canvas.getContext("2d"));
      const origin = r.view.p(x + w / 2, y + d / 2, 0);
      stamp = { canvas, ox: origin[0] - minX, oy: origin[1] - minY };
      if (this.cache.size > 48) this.cache.clear();
      this.cache.set(key, stamp);
    }
    r.queue(
      x + w / 2,
      y + d / 2,
      0,
      (g) => {
        const q = r.w(x + w / 2, y + d / 2, 0),
          alpha = g.globalAlpha;
        if (cut) g.globalAlpha *= 0.2;
        g.drawImage(
          stamp.canvas,
          Math.round(q[0] - stamp.ox),
          Math.round(q[1] - stamp.oy),
        );
        g.globalAlpha = alpha;
      },
      { hides: !cut, solid: !cut },
    );
  }
  fence(r, x, y, along, len, color = "#7e92a0", open = false) {
    if (open) return;
    r.queue(x + (!along ? len / 2 : 0), y + (along ? len / 2 : 0), 0, (g) => {
      const a = [x, y, 0],
        b = [x + (along ? 0 : len), y + (along ? len : 0), 0];
      for (let i = 0; i <= len; i += 16) {
        const q = [x + (along ? 0 : i), y + (along ? i : 0)];
        line(r, g, [...q, 0], [...q, 36], color);
      }
      for (const h of [10, 26, 36])
        line(
          r,
          g,
          [a[0], a[1], h],
          [b[0], b[1], h],
          h === 36 ? "#d9f57a" : "#4a6574",
        );
    });
  }
  draw(r, w, { title = false, scan = false } = {}) {
    const time = this.game.time;
    if (this.levelId !== w.level.id) {
      this.levelId = w.level.id;
      this.cache.clear();
    }
    r.sky(["#0b1424", "#182739", "#172638"]);
    w.map.drawFloor(r);
    // A little reflected color in the wet pavement. Geometry stays on the ground plane.
    r.decal((g) => {
      for (const [x, y, color] of [
        [152, 592, C.pink],
        [264, 568, "#f1a15e"],
        [160, 432, C.teal],
        [480, 448, C.pink],
        [736, 280, C.teal],
      ]) {
        const points = [
          [x - 9, y, 0],
          [x + 9, y, 0],
          [x + 23, y + 50, 0],
          [x - 6, y + 50, 0],
        ].map((p) => r.w(...p));
        px.polyDither(g, points, color, 0.16, r.ix, r.iy);
        for (let j = 0; j < 8; j++) {
          const yy = y + 6 + j * 5;
          line(
            r,
            g,
            [x - 7 + (j % 3), yy, 0],
            [x + 9, yy, 0],
            E.mix(color, "#233b4c", 0.78),
          );
        }
      }
      // Lane edges and directional road markings.
      for (let x = 344; x < 848; x += 32)
        line(r, g, [x, 520, 0], [x + 17, 520, 0], "#677977");
      for (const [x, y] of [
        [192, 640],
        [480, 512],
        [816, 464],
      ])
        for (let i = 0; i < 5; i++)
          face(
            r,
            g,
            [
              [x + i * 8, y, 0],
              [x + i * 8 + 4, y, 0],
              [x + i * 8 + 4, y + 20, 0],
              [x + i * 8, y + 20, 0],
            ],
            "#6a7b7b",
          );
      for (let i = 0; i < 24; i++) {
        const x = 32 + ((i * 137) % 820),
          y = 32 + ((i * 191) % 620);
        r.groundDisc(x, y, 9 + (i % 8), "#385164", 0.18);
      }
    });
    for (const b of w.level.buildings)
      this.building(r, b, time, w.player, title);
    for (const wall of w.level.securityWalls || []) {
      let start = -1;
      for (let n = 0; n <= wall.length; n++) {
        const x = wall.x + (wall.axis === "x" ? n : 0),
          y = wall.y + (wall.axis === "y" ? n : 0);
        const closed = n < wall.length && w.map.cell(x, y) > 0;
        if (closed && start < 0) start = n;
        if (!closed && start >= 0) {
          this.fence(
            r,
            (wall.x + (wall.axis === "x" ? start : 0)) * 16,
            (wall.y + (wall.axis === "y" ? start : 0)) * 16,
            wall.axis === "y",
            (n - start) * 16,
          );
          start = -1;
        }
      }
    }
    for (const [x, y] of w.level.cover) r.shape("cg:cover", x, y, 0);
    for (const [id, x, y] of w.level.props) {
      if (!r.visible(x, y, 18, 80, 80, 80)) continue;
      if (id === "streetlamp")
        r.prop("streetlamp", x, y, 0, {
          size: 1.2,
          color: "#9bb5c3",
          haloColor: "#83d8dc",
          light: false,
        });
      else if (id === "barrel")
        r.shape("barrel", x, y, 0, {
          mats: { w: "#614454 metal", h: "cgEdge" },
        });
      else if (id === "bench")
        r.shape("bench", x, y, 0, { mats: { w: "cgSteel" } });
      else
        r.shape("cg:" + id, x, y, 0, {
          facing: id === "car" ? Math.PI / 2 : 0,
        });
    }
    // Overhead utility lines, lanterns and animated signal sweeps.
    r.queue(210, 600, 90, (g) => {
      for (let i = 0; i < 8; i++) {
        line(
          r,
          g,
          [130 + i * 20, 590, 62 - Math.sin((i / 7) * Math.PI) * 8],
          [150 + i * 20, 590, 62 - Math.sin(((i + 1) / 7) * Math.PI) * 8],
          "#172538",
        );
        if (i % 2 === 0) {
          const p = r.w(
            140 + i * 20,
            590,
            57 - Math.sin((i / 7) * Math.PI) * 8,
          );
          px.rect(g, p[0] - 3, p[1], 6, 9, i % 4 === 0 ? "#ed9e72" : "#e67cad");
        }
      }
    });
    for (const i of w.interactables) {
      if (i.kind === "terminal") {
        r.shape(i.id === "core" ? "cg:core" : "cg:relay", i.x, i.y, 0);
        if (
          (i.id === "relay" && !w.flags.relay) ||
          (i.id === "core" && w.stage < 4)
        )
          ring(r, i.x, i.y, 15, 17, i.id === "core" ? C.teal : C.pink, 0.6);
      } else if (i.kind === "vehicle") {
        r.shape("cg:car", i.x, i.y, 0, {
          scale: 1.3,
          facing: Math.PI / 2,
          mats: { m: "#b3c2bf metal" },
        });
        if (w.stage === 4) ring(r, i.x, i.y, 30, 31, C.lime, 0.8);
      } else if (i.id === "cache" && !w.flags.cache)
        r.shape("chest", i.x, i.y, 0, {
          mats: { w: "cgSteel", b: "cgEdge", l: "cgTeal" },
        });
      else if (i.id === "shard" && !w.flags.shard)
        r.shape("cg:terminal", i.x, i.y, 0, { scale: 0.6 });
    }
    for (const e of w.enemies) {
      if (
        !e.dead &&
        !e.asleep &&
        (scan || w.player.crouched || e.mind.level > 0)
      )
        r.sightCone(e, {
          map: w.map,
          range: 155,
          fov: 1.5,
          color: e.mind.state === "alert" ? C.red : C.lime,
          alpha: 0.1,
        });
      if (e.windup > 0 && e.attackPoint) {
        r.groundDisc(e.attackPoint.x, e.attackPoint.y, 36, "#ec774b", 0.2);
        ring(r, e.attackPoint.x, e.attackPoint.y, 34, 36, "#ffb476", 0.9);
        ring(
          r,
          e.attackPoint.x,
          e.attackPoint.y,
          35 * (1 - e.windup / 1.1),
          35 * (1 - e.windup / 1.1) + 1,
          "#ffdcb2",
          1,
        );
      }
    }
    const actors = [...w.civilians, ...w.npcs, ...w.enemies, w.player],
      heroOccluded = this.heroOccluded(r, w);
    for (const a of actors) {
      if (!r.visible(a.x, a.y, 0, 45, 45, 100)) continue;
      r.shadow(a.x, a.y, a.kind === "boss" ? 11 : 6, 0.4);
      r.actor(
        a.x,
        a.y,
        a.z || 0,
        (g, x, y) => {
          const alpha = g.globalAlpha;
          if (this.webkit && a.cloak > 0) g.globalAlpha *= 0.42;
          a.rig.draw(g, x, y, r.view);
          g.globalAlpha = alpha;
        },
        {
          outline: false,
          rim: false,
          xray:
            !this.webkit && a === w.player && heroOccluded
              ? { color: C.lime, outline: "#e5ffce", actors: true }
              : false,
          alpha: !this.webkit && a.cloak > 0 ? 0.42 : 1,
          flash: !this.webkit && a.hurt > 0 ? "#effff9" : null,
          flashMix: 0.5,
        },
      );
      if (
        a.mind &&
        !a.dead &&
        !a.asleep &&
        (a.mind.level > 0 || a === w.target || scan)
      ) {
        r.queue(a.x, a.y, 65, (g) => {
          const [x, y] = r.w(a.x, a.y, a.kind === "boss" ? 66 : 46),
            width = a.kind === "boss" ? 42 : 20;
          px.rect(g, x - width / 2, y, width, 2, "#1b2431");
          px.rect(
            g,
            x - width / 2,
            y,
            (width * a.hp) / a.maxHp,
            2,
            a.stunned > 0 ? C.teal : C.red,
          );
          if (a.mind.state === "alert")
            E.font.text(g, "!", x, y - 10, C.red, { align: "center" });
        });
      }
    }
    ring(r, w.player.x, w.player.y, 7, 8, C.lime, 0.8);
    if (this.webkit && heroOccluded)
      r.marker(w.player.x, w.player.y, 40, { color: C.lime, offscreen: false });
    if (w.target && !title)
      ring(
        r,
        w.target.x,
        w.target.y,
        9,
        10,
        w.target.stunned > 0 ? C.teal : C.red,
        0.8,
      );
    if (!title) {
      const o = w.objectivePoint();
      if (o)
        r.marker(o.x, o.y, 50, {
          color: C.lime,
          label:
            Math.round(Math.hypot(o.x - w.player.x, o.y - w.player.y) / 8) +
            " M",
        });
      const near = w.nearest();
      if (near && near !== o) r.marker(near.x, near.y, 46, { color: C.teal });
    }
    for (const d of w.drops)
      if (!d.taken)
        r.queue(d.x, d.y, 4, (g) => {
          const [x, y] = r.w(d.x, d.y, 6 + Math.sin(time * 3) * 2);
          px.poly(
            g,
            [
              [x, y - 3],
              [x + 3, y],
              [x, y + 3],
              [x - 3, y],
            ],
            C.lime,
          );
        });
    w.shots.draw(r);
    for (const fx of w.effects) {
      if (fx.type === "link")
        r.queue(fx.x, fx.y, 40, (g) => {
          line(r, g, [fx.x, fx.y, 25], [fx.tx, fx.ty, 28], C.teal, 2);
        });
      if (fx.type === "muzzle")
        r.queue(fx.x, fx.y, fx.z, (g) => {
          const p = r.w(fx.x, fx.y, fx.z);
          px.disc(g, ...p, 3, "#fff8cb");
        });
    }
    // Rain is cheap, deterministic and disabled by the comfort setting.
    if (this.game.settings.rain !== false && !this.game.reduceMotion)
      r.overlay((g) => {
        for (const drop of this.rain) {
          const x = (drop.x + time * 14) % r.W,
            y = (drop.y + time * drop.s) % r.H;
          px.line(g, x, y, x - 2, y + 6, "#496779");
        }
      });
    if (scan)
      r.overlay((g) => {
        for (let y = 0; y < r.H; y += 4) px.rect(g, 0, y, r.W, 1, "#142f39");
      });
  }
}
