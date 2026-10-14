/* Harbor district: original procedural scenery and vehicles, rendered with my-3D2dge primitives. */
(function (root) {
  "use strict";
  const E = My3D2dge,
    P = E.px;
  const COLORS = {
    road: "#394247",
    concrete: "#83938d",
    grass: "#515f51",
    water: "#214b55",
    dock: "#716653",
    paper: "#e2d0a4",
    gold: "#e8b967",
  };
  const hash = (x, y) => {
    let n = ((x | 0) * 374761393 + (y | 0) * 668265263) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const rgb = Object.fromEntries(
    Object.entries(COLORS).map(([k, v]) => [k, E.hex(v)]),
  );
  function texture(x, y, tag) {
    let c = rgb[tag] || rgb.concrete,
      n = hash(x, y),
      q = (n - 0.5) * 10;
    if (tag === "water") q = Math.sin(y * 0.32 + x * 0.024) * 5 + (n - 0.5) * 5;
    if (tag === "dock") q = (y % 10 < 1 ? -25 : 0) + (n - 0.5) * 12;
    if (tag === "concrete")
      q = (x % 24 < 1 || y % 24 < 1 ? -12 : 0) + (n - 0.5) * 9;
    if (tag === "grass") q = (n - 0.5) * 20;
    if (tag === "road") {
      if (y > 699 && y < 704 && x % 58 < 34 && x < 883 && n > 0.1)
        c = [217, 184, 114];
      if (x > 924 && x < 928 && y % 58 < 34 && y < 656 && n > 0.1)
        c = [217, 184, 114];
      if ((y > 663 && y < 667 && x < 880) || (y > 755 && y < 758 && x < 880))
        c = [161, 163, 147];
      if (x > 834 && x < 878 && y > 664 && y < 755 && y % 22 < 12)
        c = [175, 183, 167];
      if (x > 878 && x < 974 && y > 784 && y < 818 && x % 22 < 12)
        c = [175, 183, 167];
      q = (n - 0.5) * 12;
    }
    return [
      E.clamp(c[0] + q, 0, 255),
      E.clamp(c[1] + q, 0, 255),
      E.clamp(c[2] + q, 0, 255),
    ];
  }
  function quad(r, g, pts, c) {
    P.poly(
      g,
      pts.map((p) => r.w(...p)),
      c,
    );
  }
  function line(r, g, a, b, c, w = 1) {
    const A = r.w(...a),
      B = r.w(...b);
    P.line(g, A[0], A[1], B[0], B[1], c, w);
  }
  function billboard(
    r,
    g,
    x,
    y,
    z,
    title,
    sub,
    color = "#efc985",
    bg = "#263e40",
  ) {
    const p = r.w(x, y, z),
      s = r.view.zoom || 1,
      tw = E.font.width(title, { scale: s });
    P.rect(
      g,
      p[0] - tw / 2 - 8 * s,
      p[1] - 5 * s,
      tw + 16 * s,
      sub ? 26 * s : 16 * s,
      bg,
    );
    P.rect(g, p[0] - tw / 2 - 8 * s, p[1] - 5 * s, tw + 16 * s, 1 * s, color);
    E.font.text(g, title, p[0], p[1], color, {
      align: "center",
      scale: s,
      shadow: "#142428",
    });
    if (sub)
      E.font.text(g, sub.replace(/·/g, "-"), p[0], p[1] + 12 * s, "#d4cfb7", {
        align: "center",
        scale: 0.72 * s,
      });
  }
  function building(r, b) {
    if (!r.visible(b.x + b.w / 2, b.y + b.d / 2, b.h / 2, 280)) return;
    r.queue(
      b.x + b.w / 2,
      b.y + b.d / 2,
      0,
      (g) => {
        const { x, y, w, d, h } = b,
          t = E.tones(b.color);
        r.box(
          g,
          x - 3,
          y - 3,
          0,
          x + w + 3,
          y + d + 3,
          3,
          "#a6ab96",
          "#5a6660",
        );
        r.box(g, x, y, 3, x + w, y + d, h, t.lt, t.base);
        // Cut-stone courses and long rows of glazed windows.
        for (let z = 16; z < h - 8; z += 18) {
          line(r, g, [x, y + d, z], [x + w, y + d, z], t.sh);
          line(r, g, [x + w, y, z], [x + w, y + d, z], t.sh);
        }
        const floors = b.kind === "office" || h > 90 ? 2 : 1;
        for (let f = 0; f < floors; f++) {
          let z = 14 + f * 35;
          for (let wx = x + 12; wx < x + w - 20; wx += 34) {
            const bright = hash(wx, f) > 0.28;
            quad(
              r,
              g,
              [
                [wx, y + d + 0.2, z],
                [wx + 24, y + d + 0.2, z],
                [wx + 24, y + d + 0.2, z + 23],
                [wx, y + d + 0.2, z + 23],
              ],
              "#253d3d",
            );
            quad(
              r,
              g,
              [
                [wx + 2, y + d + 0.5, z + 2],
                [wx + 22, y + d + 0.5, z + 2],
                [wx + 22, y + d + 0.5, z + 21],
                [wx + 2, y + d + 0.5, z + 21],
              ],
              bright ? "#d0a96f" : "#476967",
            );
            line(
              r,
              g,
              [wx + 12, y + d + 1, z + 1],
              [wx + 12, y + d + 1, z + 22],
              "#48645c",
              2,
            );
            line(
              r,
              g,
              [wx, y + d + 1, z + 10],
              [wx + 24, y + d + 1, z + 10],
              "#48645c",
            );
            r.box(
              g,
              wx - 2,
              y + d,
              z - 2,
              wx + 26,
              y + d + 4,
              z,
              "#a9ad94",
              t.sh,
            );
          }
          for (let wy = y + 16; wy < y + d - 18; wy += 34) {
            quad(
              r,
              g,
              [
                [x + w + 0.3, wy, z],
                [x + w + 0.3, wy + 22, z],
                [x + w + 0.3, wy + 22, z + 22],
                [x + w + 0.3, wy, z + 22],
              ],
              "#385354",
            );
            line(
              r,
              g,
              [x + w + 1, wy + 10, z],
              [x + w + 1, wy + 10, z + 22],
              "#243c3f",
            );
          }
        }
        r.box(
          g,
          x - 4,
          y - 4,
          h,
          x + w + 4,
          y + d + 4,
          h + 5,
          b.roof,
          "#364d4d",
        );
        r.box(
          g,
          x + 7,
          y + 7,
          h + 5,
          x + w - 7,
          y + d - 7,
          h + 7,
          E.tones(b.roof).lt,
          b.roof,
        );
        for (let vx = x + 20; vx < x + w - 24; vx += 72) {
          r.box(
            g,
            vx,
            y + 25,
            h + 7,
            vx + 26,
            y + 49,
            h + 17,
            "#82908a",
            "#4e6260",
          );
          for (let v = 0; v < 5; v++)
            line(
              r,
              g,
              [vx + 3, y + 29 + v * 3, h + 18],
              [vx + 23, y + 29 + v * 3, h + 18],
              "#435859",
            );
        }
        r.box(
          g,
          x + 15,
          y + 9,
          h + 7,
          x + 27,
          y + 21,
          h + 34,
          "#a5a99a",
          "#6a756e",
        );
        if (b.kind === "diner") {
          // Striped diner awning, roof trim and diner stools visible at the sidewalk.
          for (let a = 0; a < w; a += 12) {
            const col = (a / 12) % 2 ? "#d7c09a" : "#497c78";
            quad(
              r,
              g,
              [
                [x + a, y + d + 2, 37],
                [x + a + 12, y + d + 2, 37],
                [x + a + 12, y + d + 20, 30],
                [x + a, y + d + 20, 30],
              ],
              col,
            );
            quad(
              r,
              g,
              [
                [x + a, y + d + 20, 30],
                [x + a + 12, y + d + 20, 30],
                [x + a + 12, y + d + 20, 25],
                [x + a, y + d + 20, 25],
              ],
              E.tones(col).sh,
            );
          }
          billboard(
            r,
            g,
            x + w / 2,
            y + d + 1,
            h + 23,
            b.name,
            b.sub,
            "#f1b56b",
            "#3d5353",
          );
          line(
            r,
            g,
            [x + 18, y + d, h + 2],
            [x + w - 18, y + d, h + 2],
            "#f7b271",
            2,
          );
        } else
          billboard(
            r,
            g,
            x + w / 2,
            y + d + 1,
            h - 10,
            b.name,
            b.sub,
            b.kind === "station" ? "#e3d4a6" : "#d9c29b",
          );
        // Front door.
        quad(
          r,
          g,
          [
            [x + w * 0.6, y + d + 1, 3],
            [x + w * 0.6 + 20, y + d + 1, 3],
            [x + w * 0.6 + 20, y + d + 1, 32],
            [x + w * 0.6, y + d + 1, 32],
          ],
          "#304c4d",
        );
        line(
          r,
          g,
          [x + w * 0.6 + 16, y + d + 2, 12],
          [x + w * 0.6 + 16, y + d + 2, 19],
          "#dfc58f",
          2,
        );
        if (b.kind === "station")
          billboard(
            r,
            g,
            x + w * 0.6 + 10,
            y + d + 3,
            35,
            "DUTY",
            null,
            "#83caca",
          );
      },
      { footprint: [b.x, b.y, b.x + b.w, b.y + b.d], hides: true, solid: true },
    );
  }
  function boxTurn(r, g, c, a, x0, y0, z0, x1, y1, z1, top, side) {
    const cs = Math.cos(a),
      sn = Math.sin(a),
      at = (x, y, z) => [
        c.x + x * cs - y * sn,
        c.y + x * sn + y * cs,
        z + (c.z || 0),
      ];
    const v = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ].map((p) => at(...p));
    const t = E.tones(side),
      faces = [
        [[0, 1, 5, 4], t.sh],
        [[1, 2, 6, 5], t.base],
        [[2, 3, 7, 6], t.lt],
        [[3, 0, 4, 7], t.deep],
        [[4, 5, 6, 7], top],
      ];
    faces.sort(
      (a, b) =>
        a[0].reduce((s, i) => s + r.view.depth(...v[i]), 0) -
        b[0].reduce((s, i) => s + r.view.depth(...v[i]), 0),
    );
    for (const [inds, col] of faces)
      quad(
        r,
        g,
        inds.map((i) => v[i]),
        col,
      );
    return at;
  }
  function car(r, c, time, opts = {}) {
    if (!r.visible(c.x, c.y, 10, 130)) return;
    const a = c.angle || 0,
      van = opts.van,
      color = opts.color || (van ? "#ab744e" : "#d2d8c4");
    r.shadow(c.x, c.y, van ? 39 : 35, 0.34);
    r.queue(
      c.x,
      c.y,
      0,
      (g) => {
        const draw = (x, y, z, X, Y, Z, top, side) =>
          boxTurn(r, g, c, a, x, y, z, X, Y, Z, top, side);
        for (const x of [-23, 21])
          for (const y of [-17, 13])
            draw(x - 5, y, 3, x + 5, y + 5, 15, "#253134", "#202b30");
        draw(-36, -16, 7, 36, 16, 19, E.tones(color).lt, color);
        draw(-38, -16, 7, -34, 16, 11, "#adb8ab", "#647a75");
        draw(34, -16, 7, 38, 16, 11, "#adb8ab", "#647a75");
        if (van) {
          draw(-32, -15, 19, 10, 15, 41, "#b9b09a", "#a59b83");
          draw(10, -14, 19, 27, 14, 34, "#b6bdab", "#486d72");
          draw(12, -13, 33, 28, 13, 35, "#bdbba3", "#c6c5ad");
          draw(30, -15, 18, 35, 15, 21, "#836c58", "#82674f");
        } else {
          draw(-18, -14, 19, 18, 14, 30, "#263e45", "#3b626a");
          draw(-11, -13, 29, 10, 13, 32, "#d6d8be", "#bac8b8");
          if (!opts.civilian) {
            draw(-32, -16.3, 13, 28, -15.6, 18, "#253b42", "#263d43");
            draw(-32, 15.6, 13, 28, 16.3, 18, "#253b42", "#263d43");
            draw(-4, -13, 32, 4, 13, 34, "#35484b", "#253c43");
            draw(
              -3,
              -12,
              34,
              3,
              0,
              37,
              opts.lights && Math.sin(time * 12) > 0 ? "#ffc0aa" : "#bc5550",
              "#813c3e",
            );
            draw(
              -3,
              0,
              34,
              3,
              12,
              37,
              opts.lights && Math.sin(time * 12) < 0 ? "#baf4fb" : "#5e9bbb",
              "#3b6687",
            );
          }
          const at = boxTurn(
            r,
            g,
            c,
            a,
            20,
            -14,
            20,
            28,
            14,
            21,
            E.tones(color).lt,
            color,
          );
          if (!opts.civilian) {
            const p = r.w(...at(-22, 0, 21));
            E.font.text(
              g,
              opts.number || c.number || "",
              p[0],
              p[1] - 3,
              "#263e43",
              {
                align: "center",
                scale: r.view.zoom || 1,
              },
            );
          }
          if (opts.occupied) {
            const p = r.w(...at(8, 6, 27));
            P.disc(g, p[0], p[1], 2, "#c8a481");
          }
        }
        for (const y of [-12, 8]) {
          draw(36, y, 12, 38, y + 4, 18, "#ffe4a8", "#edc68c");
          draw(-37, y, 12, -36, y + 4, 16, "#e67e56", "#96483e");
        }
      },
      { hides: true, solid: true },
    );
    if (opts.lights) {
      const red = Math.sin(time * 12) > 0;
      r.groundDisc(c.x, c.y, 48, red ? "#db6654" : "#62b6cf", 0.1);
      gameLight(r, c.x, c.y, 30, red ? "#f48469" : "#6bb8df", 62, 0.28);
    }
    if (opts.headlights) {
      const cs = Math.cos(a),
        sn = Math.sin(a);
      gameLight(r, c.x + cs * 55, c.y + sn * 55, 8, "#f2d294", 80, 0.28);
    }
  }
  function gameLight(r, x, y, z, color, radius, intensity) {
    E.current?.lights.add(x, y, z, radius, intensity, { color });
  }
  class HarborWorld {
    constructor(location, mapProvider) {
      this.location = location;
      this.mapProvider = mapProvider;
      this.props = location.props || [];
      this.bg = new E.Backdrop(location.background || {});
    }
    draw(r, st) {
      const t = st.time || 0,
        visible = st.visible || (() => true);
      this.map = this.mapProvider();
      this.map.floorTex = texture;
      this.bg.draw(r);
      this.map.drawFloor(r);
      r.decal((g) => {
        // Soft puddles, lane lettering, loading bay and gentle harbor ripples.
        for (const [x, y, w] of [
          [352, 746, 58],
          [474, 680, 70],
          [769, 743, 50],
          [907, 534, 36],
          [834, 662, 27],
        ]) {
          P.polyDither(
            g,
            [
              [x, y, 0],
              [x + w, y - 6, 0],
              [x + w + 16, y + 3, 0],
              [x + 12, y + 9, 0],
            ].map((v) => r.w(...v)),
            "#9fbaad",
            0.16,
          );
          line(r, g, [x + 10, y + 2, 0], [x + w - 5, y + 2, 0], "#657d79");
        }
        for (let y = 170; y < 940; y += 26)
          for (let x = 1100; x < 1280; x += 38) {
            const j = Math.sin(t * 0.7 + y) * 4;
            line(
              r,
              g,
              [x + j, y, 0],
              [x + j + 10 + Math.sin(y) * 6, y, 0],
              "#38636b",
            );
          }
        for (let x = 191; x < 370; x += 65) {
          line(r, g, [x, 683, 0], [x, 739, 0], "#b3b196");
        }
        const p = r.w(480, 698, 0);
        E.font.text(g, "H A R B O R   R D", p[0], p[1], "#9a9e8e", {
          align: "center",
          scale: 1.05,
        });
        for (let x = 692; x < 802; x += 22)
          line(r, g, [x, 564, 0], [x + 19, 629, 0], "#a9a38a");
        // Handcart trail provides a real spatial clue.
        for (let x = 780; x < 960; x += 9)
          for (const d of [-5, 5])
            line(
              r,
              g,
              [x, 587 - (x - 780) * 0.35 + d, 0],
              [x + 5, 586 - (x - 780) * 0.35 + d, 0],
              "#657a72",
            );
      });
      for (const b of this.location.buildings) {
        if (b.kind !== "fence") building(r, b);
      }
      // Quay coping, mooring bollards and the freight gate.
      for (let y = 144; y < 973; y += 64) {
        r.queue(1084, y, 0, (g) =>
          r.box(g, 1078, y, 0, 1090, y + 60, 6, "#aaa990", "#71877d"),
        );
        r.prop("pillar", 1077, y + 32, 0, { size: 0.35, color: "#394d50" });
      }
      for (const gate of [
        ...(this.location.gates || []),
        ...this.location.buildings.filter((b) => b.kind === "fence"),
      ]) {
        if (gate.openWhen && visible(gate.openWhen)) continue;
        for (let x = gate.x; x < gate.x + gate.w; x += 16)
          r.queue(
            x,
            gate.y,
            0,
            (g) => {
              r.box(
                g,
                x,
                gate.y + 5,
                0,
                x + 2,
                gate.y + 7,
                gate.h,
                "#aab3a1",
                "#718a80",
              );
              line(
                r,
                g,
                [x, gate.y + 6, 10],
                [x + 16, gate.y + 6, gate.h - 3],
                "#829a8a",
              );
              line(
                r,
                g,
                [x, gate.y + 6, gate.h - 1],
                [x + 16, gate.y + 6, gate.h - 1],
                "#bdbe9f",
              );
            },
            { hides: true },
          );
      }
      for (const p of this.props)
        if (r.visible(p.x, p.y, 25, 100))
          r.prop(p.name, p.x, p.y, 0, {
            size: p.size,
            color: p.color,
            light: p.name === "streetlamp",
            halo: false,
            cone: false,
          });
      for (const [x, y] of [
        [535, 579],
        [205, 630],
      ])
        r.queue(x, y, 0, (g) => {
          r.box(g, x - 17, y - 5, 11, x + 17, y + 5, 14, "#b9a27d", "#756c54");
          r.box(g, x - 15, y - 7, 14, x + 15, y - 4, 24, "#a49371", "#695f4e");
          for (const dx of [-13, 13])
            r.box(
              g,
              x + dx,
              y - 3,
              0,
              x + dx + 3,
              y + 3,
              12,
              "#536c61",
              "#425d57",
            );
        });
      // Boats and a cargo gantry silhouette make the waterfront readable.
      for (const [bx, by] of this.location.boats || [])
        r.queue(bx, by, 0, (g) => {
          quad(
            r,
            g,
            [
              [bx - 22, by - 45, 1],
              [bx + 22, by - 45, 1],
              [bx + 26, by + 30, 1],
              [bx, by + 58, 1],
              [bx - 26, by + 30, 1],
            ],
            "#b7b9a1",
          );
          r.box(
            g,
            bx - 18,
            by - 37,
            1,
            bx + 18,
            by + 27,
            7,
            "#8b8270",
            "#3c5c62",
          );
          r.box(
            g,
            bx - 13,
            by - 18,
            7,
            bx + 13,
            by + 9,
            29,
            "#c0c5ae",
            "#78948d",
          );
          r.box(
            g,
            bx - 11,
            by + 9,
            15,
            bx + 11,
            by + 10,
            25,
            "#40626a",
            "#35555e",
          );
          line(r, g, [bx, by, 29], [bx, by, 64], "#c6bfa0", 2);
          line(r, g, [bx - 20, by - 30, 1], [1079, by - 35, 5], "#919581");
        });
      r.queue(
        1040,
        155,
        0,
        (g) => {
          r.box(g, 1027, 146, 0, 1039, 158, 150, "#cdb98a", "#927953");
          r.box(g, 1026, 136, 143, 1175, 149, 153, "#d1b981", "#927951");
          line(r, g, [1171, 143, 145], [1171, 143, 54], "#657879", 2);
          for (let x = 1030; x < 1170; x += 20)
            line(r, g, [x, 149, 144], [x + 20, 149, 152], "#795f45");
        },
        { hides: true },
      );
      if (this.location.cones && visible(this.location.cones.when)) {
        for (const [x, y] of this.location.cones.positions)
          r.queue(x, y, 0, (g) => {
            r.box(g, x - 4, y - 4, 0, x + 4, y + 4, 2, "#56483a", "#3d4440");
            quad(
              r,
              g,
              [
                [x - 4, y, 2],
                [x + 4, y, 2],
                [x, y, 17],
              ],
              "#e49b61",
            );
            line(r, g, [x - 2, y, 9], [x + 2, y, 9], "#ede5bf", 2);
          });
      }
    }
  }
  root.HarborWorld = {
    HarborWorld,
    building,
    texture,
    car,
    quad,
    line,
    billboard,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
