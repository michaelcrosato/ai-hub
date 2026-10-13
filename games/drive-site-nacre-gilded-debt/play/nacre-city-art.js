/* Nacre city art. Original procedural Canvas architecture for my-3d2dge.
 * Every public feature coordinate is in metres. The Painter converts once.
 * Ordinary roof surfaces are exactly at feature.h. Pitched silhouettes belong
 * to landmarks, whose h is their total height. No network or asset dependency.
 */
(function (E) {
  'use strict';
  if (!E) throw new Error('Load my-3d2dge before nacre-city-art.js');
  const profiles = [{"id":"bell-heights","name":"Bell Heights","row":0,"col":0,"form":"Terraced old town","description":"Compact limestone terraces, stepped roof gardens and a patinated belfry above the old lanes.","coverage":0.58,"footprint":[10,22,12,26],"height":[8,22],"streetWidth":[4,7],"kinds":["terrace","tenement"],"roofs":["flat","garden"],"landmark":{"kind":"belfry","name":"The Ninth Bell","w":18,"d":18,"h":48},"palette":{"ground":"#b3a88b","road":"#c8bba0","wall":"#d2c4a3","shadow":"#798982","trim":"#ead8af","roof":"#7e9a87","roofDark":"#4d736d","accent":"#b8985f","cloth":"#344963","window":"#30444a","wood":"#79694e","green":"#748661","water":"#386f73"}},{"id":"salt-market","name":"Salt Market","row":0,"col":1,"form":"Dense market lanes","description":"Small plaster shops, crowded rooftop additions and striped awnings around a long covered salt hall.","coverage":0.74,"footprint":[7,15,9,21],"height":[5,14],"streetWidth":[3,6],"kinds":["shop","tenement","arcade"],"roofs":["terracotta","flat"],"landmark":{"kind":"market-hall","name":"The Salt Hall","w":46,"d":30,"h":19},"palette":{"ground":"#b5a17d","road":"#c5b48d","wall":"#c6a16f","shadow":"#887b68","trim":"#ead3a3","roof":"#b77751","roofDark":"#865947","accent":"#d3aa54","cloth":"#b98a42","window":"#344445","wood":"#806243","green":"#717c51","water":"#396e6e"}},{"id":"levy-court","name":"Levy Court","row":0,"col":2,"form":"Formal civic precinct","description":"Wide stone avenues, measured palace fronts and burgundy standards before the treasury court.","coverage":0.44,"footprint":[24,48,22,44],"height":[12,27],"streetWidth":[12,20],"kinds":["palace","courtyard"],"roofs":["copper","flat"],"landmark":{"kind":"levy-palace","name":"The Ledger Palace","w":76,"d":54,"h":35},"palette":{"ground":"#bdb7a4","road":"#d0c9b4","wall":"#d8ccae","shadow":"#8b9690","trim":"#ecdebc","roof":"#a48164","roofDark":"#716c61","accent":"#b39755","cloth":"#763d49","window":"#3c4a51","wood":"#75614c","green":"#708369","water":"#427779"}},{"id":"scribes-ward","name":"Scribes’ Ward","row":1,"col":0,"form":"Courts and cloisters","description":"Ivory print houses with indigo shutters, slate roofs and enclosed reading courts around a lantern-topped archive.","coverage":0.54,"footprint":[15,29,17,34],"height":[8,18],"streetWidth":[5,9],"kinds":["courtyard","tenement"],"roofs":["slate","garden"],"landmark":{"kind":"scriptorium","name":"The Lantern Archive","w":45,"d":42,"h":28},"palette":{"ground":"#aaa994","road":"#c2bd9f","wall":"#d4cfb4","shadow":"#87958f","trim":"#e6ddbe","roof":"#657883","roofDark":"#425866","accent":"#b89962","cloth":"#405874","window":"#314552","wood":"#807052","green":"#6d8062","water":"#3a737a"}},{"id":"grand-exchange","name":"Grand Exchange","row":1,"col":1,"form":"Arcades and open square","description":"Copper-roofed merchant arcades face a broad exchange square, with a faceted dome at its heart.","coverage":0.58,"footprint":[18,34,18,36],"height":[10,24],"streetWidth":[10,18],"kinds":["arcade","shop","courtyard"],"roofs":["copper","vaulted"],"landmark":{"kind":"exchange-dome","name":"The Gilded Exchange","w":42,"d":42,"h":38},"palette":{"ground":"#b8ab8d","road":"#d1c29f","wall":"#cfb78f","shadow":"#879287","trim":"#eed8ac","roof":"#b9875e","roofDark":"#81664e","accent":"#c4a35b","cloth":"#34536b","window":"#354952","wood":"#866b48","green":"#718562","water":"#3e777b"}},{"id":"glassworks","name":"Glassworks","row":1,"col":2,"form":"Workshops and furnace yards","description":"Low sawtooth sheds, glazed teal roofs, tall chimneys and soot-marked kiln courts beside the working canals.","coverage":0.43,"footprint":[18,38,15,30],"height":[5,15],"streetWidth":[8,13],"kinds":["workshop","kiln"],"roofs":["sawtooth","terracotta"],"landmark":{"kind":"glass-furnace","name":"The Green Furnace","w":40,"d":28,"h":26},"palette":{"ground":"#8e9283","road":"#adb09b","wall":"#a7ad98","shadow":"#626f6c","trim":"#c8c5a6","roof":"#53877f","roofDark":"#365f60","accent":"#bf925b","cloth":"#40776f","window":"#2f4c53","wood":"#6c5f49","green":"#68785b","water":"#32686c"}},{"id":"south-quay","name":"South Quay","row":2,"col":0,"form":"Harbor sheds and piers","description":"Long timber warehouses, cargo yards and salt-worn quays lead toward a striped harbor light.","coverage":0.39,"footprint":[14,25,30,56],"height":[6,15],"streetWidth":[10,16],"kinds":["warehouse","workshop"],"roofs":["timber","terracotta"],"landmark":{"kind":"lighthouse","name":"The Western Light","w":15,"d":15,"h":52},"palette":{"ground":"#9f9d89","road":"#b7b29a","wall":"#b7b4a0","shadow":"#72857f","trim":"#d2c7a7","roof":"#8e7455","roofDark":"#605849","accent":"#b99459","cloth":"#4d677a","window":"#31474c","wood":"#8d7350","green":"#667b65","water":"#326a73"}},{"id":"dye-canals","name":"Dye Canals","row":2,"col":1,"form":"Canals and narrow weavers’ plots","description":"Tall thin weavers’ houses, indigo drying cloth and connected vats line the teal water lanes.","coverage":0.55,"footprint":[9,17,22,42],"height":[7,18],"streetWidth":[5,9],"kinds":["weaver","workshop"],"roofs":["terracotta","flat"],"landmark":{"kind":"dye-vats","name":"The Indigo Courts","w":42,"d":32,"h":8},"palette":{"ground":"#afa58d","road":"#c6b89c","wall":"#cec3a5","shadow":"#81948c","trim":"#e3d1ad","roof":"#aa7158","roofDark":"#795449","accent":"#b99156","cloth":"#39466f","window":"#344751","wood":"#877054","green":"#728264","water":"#397b7c"}},{"id":"salt-gardens","name":"Salt Gardens","row":2,"col":2,"form":"Basins and garden compounds","description":"Open chalk paths, low courtyard houses, olive-green gardens and pale salt pans beneath a wind-driven cistern.","coverage":0.24,"footprint":[9,19,10,23],"height":[3,10],"streetWidth":[6,10],"kinds":["garden-house","utility"],"roofs":["flat","garden"],"landmark":{"kind":"windmill","name":"The Salt Windmill","w":18,"d":18,"h":24},"palette":{"ground":"#c0b99d","road":"#d6cfb4","wall":"#ded7b9","shadow":"#959e87","trim":"#ece0bd","roof":"#b8b395","roofDark":"#8c997d","accent":"#baa566","cloth":"#89926b","window":"#435654","wood":"#95815c","green":"#7e9168","water":"#719b93"}}];
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const px = E.px, mix = E.mix, shade = E.shade;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function seedOf(value) {
    if (typeof value === 'number') return value >>> 0;
    let h = 2166136261;
    for (const c of String(value || 'nacre')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function random(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function boundsOf(points) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of points) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }
    return b;
  }
  // Screen clipping prevents the engine's scanline painter from walking through
  // thousands of offscreen rows when a district patch spans a kilometre.
  function clipPoly(points, width, height) {
    let out = points;
    for (const [axis, edge, sign] of [[0, -2, 1], [0, width + 2, -1], [1, -2, 1], [1, height + 2, -1]]) {
      const input = out; out = []; if (!input.length) break;
      let a = input[input.length - 1], ina = sign * (a[axis] - edge) >= 0;
      for (const b of input) {
        const inb = sign * (b[axis] - edge) >= 0;
        if (ina !== inb) { const t = (edge - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
        if (inb) out.push(b); a = b; ina = inb;
      }
    }
    return out;
  }
  function polygon(g, points, color) {
    const p = clipPoly(points, g.canvas.width, g.canvas.height);
    if (p.length > 2) px.poly(g, p, color);
  }
  function clipLine(a, b, box) {
    const dx = b[0] - a[0], dy = b[1] - a[1]; let lo = 0, hi = 1;
    for (const [p, q] of [[-dx, a[0] - box[0]], [dx, box[2] - a[0]], [-dy, a[1] - box[1]], [dy, box[3] - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; }
      else { const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return null; }
    }
    return [[a[0] + dx * lo, a[1] + dy * lo], [a[0] + dx * hi, a[1] + dy * hi]];
  }
  function line(g, a, b, color, width = 1) {
    const p = clipLine(a, b, [-2, -2, g.canvas.width + 2, g.canvas.height + 2]);
    if (p) px.line(g, ...p[0], ...p[1], color, width);
  }
  function rect3(x, y, z, w, d) { return [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]; }
  function ring(x, y, z, rx, ry, n = 12, phase = 0) { return Array.from({ length: n }, (_, i) => { const a = phase + i * TAU / n; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry, z]; }); }

  class Mesh {
    constructor(view, unit) { this.view = view; this.unit = unit; this.ops = []; this.points = []; this.surfaces = []; }
    depth(p) { return this.view.depth(p[0], p[1], p[2]); }
    _owner(points) {
      let best = null, distance = Infinity;
      for (const s of this.surfaces) {
        if (points.some(p => Math.abs(p[s.axis] - s.value) > .18)) continue;
        if (points.some(p => p.some((n, i) => i !== s.axis && (n < s.lo[i] - .22 || n > s.hi[i] + .22)))) continue;
        const dist = Math.abs(points[0][s.axis] - s.value);
        if (dist < distance) { best = s; distance = dist; }
      }
      return best;
    }
    face(points, color, bias = 0, host = false) {
      const owner = !host && this._owner(points), depth = points.reduce((s, p) => s + this.depth(p), 0) / points.length;
      this.ops.push({ p: points, c: color, d: owner ? owner.d + .025 + bias : depth + bias });
      if (host) {
        const axis = [0, 1, 2].find(i => points.every(p => Math.abs(p[i] - points[0][i]) < 1e-8));
        if (axis !== undefined) this.surfaces.push({ axis, value: points[0][axis], d: depth, lo: [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))), hi: [0, 1, 2].map(i => Math.max(...points.map(p => p[i]))) });
      }
      this.points.push(...points); return this;
    }
    line(a, b, color, width = 1, bias = .02) {
      const owner = this._owner([a, b]);
      this.ops.push({ p: [a, b], c: color, l: width, d: owner ? owner.d + .05 + bias : (this.depth(a) + this.depth(b)) / 2 + bias }); this.points.push(a, b); return this;
    }
    box(x, y, z, w, d, h, top, front, side) {
      const X = x + w, Y = y + d, Z = z + h, v = this.view;
      const fy = v.fy >= 0 ? Y : y, fx = v.fx >= 0 ? X : x;
      if (Math.abs(v.fx) > .001) this.face([[fx, y, z], [fx, Y, z], [fx, Y, Z], [fx, y, Z]], side || shade(front, -.18), 0, true);
      if (Math.abs(v.fy) > .001) this.face([[x, fy, z], [X, fy, z], [X, fy, Z], [x, fy, Z]], front, 0, true);
      this.face(rect3(x, y, Z, w, d), top, 0, true);
      return this;
    }
    taper(x, y, z, rx, ry, height, upper, color, n = 8, cap = true) {
      const a = ring(x, y, z, rx, ry, n, Math.PI / n), b = ring(x, y, z + height, rx * upper, ry * upper, n, Math.PI / n);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, nx = (a[i][0] + a[j][0]) / 2 - x, ny = (a[i][1] + a[j][1]) / 2 - y;
        if (nx * this.view.fx + ny * this.view.fy > -.001) this.face([a[i], a[j], b[j], b[i]], shade(color, (ny - nx) / Math.max(rx, ry) * .13));
      }
      if (cap) this.face(b, shade(color, .12)); return this;
    }
    draw(g, ox, oy) {
      const P = p => { const a = this.view.p(p[0] * this.unit, p[1] * this.unit, p[2] * this.unit); return [a[0] - ox, a[1] - oy]; };
      this.ops.sort((a, b) => a.d - b.d);
      for (const op of this.ops) {
        const p = op.p.map(P);
        if (op.l) line(g, p[0], p[1], op.c, op.l); else polygon(g, p, op.c);
      }
    }
  }
  function paletteFor(feature) { return (profileMap[feature.districtId] || profiles[4]).palette; }
  function arch(m, side, edge, u, z, w, h, color, inset = .02) {
    const put = (a, b) => side === 'y' ? [a, edge + inset * Math.sign(m.view.fy || 1), b] : [edge + inset * Math.sign(m.view.fx || 1), a, b];
    m.face([[u, z], [u + w, z], [u + w, z + h * .7], [u + w * .78, z + h], [u + w * .22, z + h], [u, z + h * .7]].map(q => put(...q)), color, .025);
  }
  function facade(m, b, p, lod, opts = {}) {
    const { w, d, h } = b, v = m.view;
    const faces = [{ side: 'y', len: w, edge: v.fy >= 0 ? d : 0, shade: 0 }, { side: 'x', len: d, edge: v.fx >= 0 ? w : 0, shade: -.12 }];
    for (const f of faces) {
      if (Math.abs(f.side === 'y' ? v.fy : v.fx) < .08) continue;
      const pos = (u, z, n = .014) => f.side === 'y' ? [u, f.edge + n * Math.sign(v.fy), z] : [f.edge + n * Math.sign(v.fx), u, z];
      const trim = shade(p.trim, f.shade), dark = shade(p.window, f.shade);
      if (lod >= 2) {
        const floors = Math.min(13, Math.floor(h / 3.2));
        for (let k = 1; k <= floors; k++) {
          const z = k * 3.2 - .2; if (z > h - .6) continue;
          m.line(pos(0, z), pos(f.len, z), mix(p.wall, p.shadow, .29));
        }
      }
      if (lod >= 1) {
        const cols = Math.min(18, Math.max(1, Math.floor(f.len / (opts.bays || 3.1))));
        const spacing = f.len / cols, wide = opts.palace ? 1.42 : 1.02, high = opts.palace ? 1.9 : 1.45;
        const floors = Math.max(1, Math.floor((h - 1.2) / 3.2));
        for (let floor = 0; floor < floors; floor++) {
          const z = 1.05 + floor * 3.2; if (z + high > h - .75) continue;
          if (lod === 1 && floor % 2) continue;
          for (let col = 0; col < cols; col++) {
            const u = spacing * (col + .5) - wide / 2;
            arch(m, f.side, f.edge, u, z, wide, high, dark);
            if (lod >= 2) {
              m.line(pos(u - .16, z - .11, .05), pos(u + wide + .16, z - .11, .05), trim, 1);
              m.line(pos(u + wide / 2, z + .1, .055), pos(u + wide / 2, z + high * .84, .055), shade(p.wood, .1), 1);
              if (!opts.palace && (col + floor + seedOf(b.seed)) % 3 === 0) {
                const a = pos(u - .28, z, .07), c = pos(u - .08, z + high * .86, .07);
                m.face([a, pos(u - .08, z, .07), c, pos(u - .28, z + high * .86, .07)], shade(p.cloth, f.shade), .04);
              }
            }
          }
        }
      }
      // A closed door has human dimensions, even on very large buildings.
      if (lod >= 1 && h > 2.3) {
        const doorW = 1.05, u = f.len * .5 - doorW / 2;
        arch(m, f.side, f.edge, u - .13, 0, doorW + .26, 2.33, trim, .04);
        arch(m, f.side, f.edge, u, 0, doorW, 2.2, p.wood, .07);
        if (lod >= 2) m.line(pos(u + doorW * .55, .05, .09), pos(u + doorW * .55, 1.87, .09), shade(p.wood, -.22));
      }
      // Sparse pilasters and a bright cornice read as formal masonry at distance.
      if (opts.palace && lod >= 1) for (let u = 1.1; u < f.len; u += 5.7) {
        const a = pos(u, .2, .065), b0 = pos(u + .32, .2, .065), c = pos(u + .32, h - .55, .065), d0 = pos(u, h - .55, .065);
        m.face([a, b0, c, d0], trim, .06);
      }
      m.line(pos(0, h - .36, .08), pos(f.len, h - .36, .08), trim, lod >= 3 ? 2 : 1, .06);
    }
  }
  function roofLines(m, w, d, h, roof, p, lod) {
    if (lod < 1) return;
    const gap = lod > 2 ? 1.0 : lod === 2 ? 2.0 : 4.0;
    const flat = ['flat', 'garden'].includes(roof);
    for (let y = gap; y < d - .4; y += gap) m.line([.35, y, h + .025], [w - .35, y, h + .025], mix(p.roof, p.roofDark, flat ? .27 : .48), 1);
    if (lod >= 2) {
      const step = roof === 'copper' || roof === 'timber' ? 2.2 : 3.4;
      for (let x = step; x < w - .3; x += step) m.line([x, .35, h + .04], [x, d - .35, h + .04], mix(p.roof, p.trim, roof === 'copper' ? .28 : .15), 1);
    }
  }
  function parapet(m, w, d, h, p, lod) {
    const t = .28, ph = .32;
    m.box(0, 0, h, w, t, ph, p.trim, p.wall, p.shadow);
    m.box(0, d - t, h, w, t, ph, p.trim, p.wall, p.shadow);
    m.box(0, t, h, t, d - 2 * t, ph, p.trim, p.wall, p.shadow);
    m.box(w - t, t, h, t, d - 2 * t, ph, p.trim, p.wall, p.shadow);
    if (lod > 1) m.line([0, d, h + ph], [w, d, h + ph], shade(p.trim, .1));
  }
  function awning(m, x, y, z, width, depth, p, lod, axis = 'y') {
    const strips = Math.max(2, Math.min(12, Math.ceil(width / .8)));
    const coord = (u, v, zz) => axis === 'y' ? [x + u, y + v, zz] : [x + v, y + u, zz];
    for (let i = 0; i < strips; i++) {
      const a = width * i / strips, b = width * (i + 1) / strips, color = i % 2 ? p.cloth : p.trim;
      m.face([coord(a, 0, z), coord(b, 0, z), coord(b, depth, z - .45), coord(a, depth, z - .45)], color, .035);
      m.face([coord(a, depth, z - .45), coord(b, depth, z - .45), coord(b, depth, z - .73), coord(a, depth, z - .73)], shade(color, -.15), .04);
    }
    if (lod >= 2) for (const u of [0, width]) m.line(coord(u, depth, 0), coord(u, depth, z - .45), p.wood, 1);
  }
  function tree(m, x, y, z, size, p) {
    m.box(x - .12, y - .12, z, .24, .24, size * .7, p.wood, p.wood, shade(p.wood, -.2));
    m.taper(x, y, z + size * .42, size * .44, size * .39, size * .4, .75, shade(p.green, -.09), 7);
    m.taper(x - size * .12, y - size * .08, z + size * .7, size * .35, size * .31, size * .29, .36, shade(p.green, .12), 7);
  }
  function pitched(m, x, y, z, w, d, rise, p, roofColor) {
    const c = roofColor || p.roof, ridge = y + d * .5;
    m.face([[x, y, z], [x + w, y, z], [x + w, ridge, z + rise], [x, ridge, z + rise]], shade(c, -.09));
    m.face([[x, ridge, z + rise], [x + w, ridge, z + rise], [x + w, y + d, z], [x, y + d, z]], c);
    if (m.view.fx >= 0) m.face([[x + w, y, z], [x + w, y + d, z], [x + w, ridge, z + rise]], p.shadow);
    else m.face([[x, y, z], [x, y + d, z], [x, ridge, z + rise]], p.wall);
    m.line([x, ridge, z + rise + .02], [x + w, ridge, z + rise + .02], mix(c, p.trim, .35));
  }
  function banner(m, x, y, z, width, height, p) {
    m.face([[x, y, z], [x + width, y, z], [x + width, y, z - height + .35], [x + width * .5, y, z - height], [x, y, z - height + .35]], p.cloth, .05);
    m.line([x + width * .5, y + .012, z - .3], [x + width * .5, y + .012, z - height + .6], p.accent, 1, .07);
  }

  function ordinary(m, b, p, lod) {
    const w = b.w, d = b.d, h = b.h, roof = b.roof || 'flat', kind = b.kind || 'tenement';
    const rand = random(seedOf(b.seed ?? b.id)), tint = (rand() - .5) * .11;
    p = { ...p, wall: shade(p.wall, tint), roof: shade(p.roof, tint * .55) };
    const formal = ['palace', 'courtyard', 'arcade'].includes(kind);
    m.box(0, 0, 0, w, d, h, p.roof, p.wall, mix(p.wall, p.shadow, .85));
    facade(m, b, p, lod, { palace: formal, bays: kind === 'warehouse' ? 4.7 : 3.1 });
    roofLines(m, w, d, h, roof, p, lod);
    if (roof !== 'timber') parapet(m, w, d, h, p, lod);
    if (lod >= 1) {
      // Small roof forms have a separate silhouette but keep the landing plane h.
      if (kind === 'courtyard') {
        const aw = w * .35, ad = d * .31, ax = (w - aw) / 2, ay = (d - ad) / 2;
        m.box(ax, ay, h, aw, ad, .45, p.window, p.trim, p.shadow);
        m.face(rect3(ax + .3, ay + .3, h + .46, Math.max(.5, aw - .6), Math.max(.5, ad - .6)), mix(p.roof, p.window, .7), .025);
        if (lod >= 2) for (let x = ax + 1; x < ax + aw; x += 1.5) m.line([x, ay, h + .5], [x, ay + ad, h + .5], p.trim);
      } else if (roof === 'garden' || kind === 'garden-house') {
        const gw = Math.min(w * .42, 7), gd = Math.min(d * .3, 6);
        m.box(w * .18, d * .19, h, gw, gd, .4, shade(p.green, -.06), p.trim, p.shadow);
        for (let i = 0; i < 3; i++) tree(m, w * .23 + gw * i / 3, d * .25 + (i % 2) * 1.2, h + .4, 1.6 + rand() * .5, p);
      } else if (roof === 'sawtooth') {
        for (let y = 1.0; y < d - 2.8; y += 4.8) {
          const rr = Math.min(3, d - y - .7);
          m.face([[1, y, h + .1], [w - 1, y, h + .1], [w - 1, y + rr * .65, h + 1.1], [1, y + rr * .65, h + 1.1]], p.roofDark);
          m.face([[1, y + rr * .65, h + 1.1], [w - 1, y + rr * .65, h + 1.1], [w - 1, y + rr, h + .1], [1, y + rr, h + .1]], mix(p.window, '#9cc3b7', .5));
        }
      } else if (roof === 'vaulted') {
        pitched(m, w * .22, d * .25, h, w * .56, d * .48, 1.45, p, p.roof);
      } else if (rand() > .35) {
        m.box(w * .18, d * .19, h, Math.min(1.2, w * .12), Math.min(1.2, d * .12), 1.3, p.trim, p.wall, p.shadow);
      }
      if (['shop', 'arcade', 'weaver'].includes(kind) && h > 3) {
        if (m.view.fy > .1) awning(m, w * .17, d + .06, 3.0, w * .65, 1.55, p, lod);
        if (kind === 'weaver') for (let i = 0; i < 3; i++) banner(m, w * (.23 + .21 * i), d + .03, Math.min(h - .8, 7.2), w * .13, 2.4, p);
      }
      if (kind === 'warehouse' && lod >= 2) {
        const edge = m.view.fy >= 0 ? d + .05 : -.05;
        for (let x = 1; x < w; x += 4.5) {
          m.line([x, edge, .2], [x, edge, h - .6], p.wood, 2, .06);
          if (x + 4.1 < w) m.line([x, edge + .03, h - .8], [x + 4.1, edge + .03, .4], shade(p.wood, -.12), 1, .09);
        }
      }
      if (kind === 'kiln') {
        m.taper(w * .36, d * .3, h, Math.min(w, d) * .1, Math.min(w, d) * .1, 3.0, .7, p.roofDark);
      }
      if (formal && lod >= 2) for (const x of [w * .21, w * .7]) banner(m, x, d + .09, h - 1.1, Math.min(1.3, w * .07), Math.min(4.1, h * .4), p);
    }
    const climb = b.climbable !== false && b.climb !== false && (b.climb || b.climbable || b.roofAccess || ['flat', 'copper'].includes(roof));
    if (climb && lod >= 2 && m.view.fy > .05 && h > 3) {
      const cx = Math.min(w - 1.3, Math.max(1.3, w * .23));
      for (let z = 1; z < h - .25; z += 1) {
        m.line([cx - .8, d + .105, z], [cx + .8, d + .105, z], mix(p.accent, p.trim, .35), 1, .11);
      }
    }
  }

  function landmarkMesh(m, b, p, lod) {
    const { w, d, h } = b, kind = b.kind;
    const box = (x, y, z, ww, dd, hh, roof = p.roof, wall = p.wall) => m.box(x, y, z, ww, dd, hh, roof, wall, mix(wall, p.shadow, .83));
    const frontArch = (x, z, ww, hh) => arch(m, 'y', d + .01, x, z, ww, hh, p.window);
    if (kind === 'belfry') {
      box(0, 0, 0, w, d, h * .08, p.trim); box(w * .14, d * .14, h * .08, w * .72, d * .72, h * .56, p.trim);
      box(w * .07, d * .07, h * .64, w * .86, d * .86, h * .04, p.trim);
      box(w * .13, d * .13, h * .68, w * .74, d * .74, h * .19, p.trim);
      const y = d * .87;
      for (let i = 0; i < 3; i++) { arch(m, 'y', y, w * (.21 + i * .22), h * .715, w * .13, h * .12, p.window); if (lod > 1) m.taper(w * (.275 + i * .22), y + .04, h * .724, w * .04, w * .025, h * .055, .5, p.accent, 6); }
      m.taper(w / 2, d / 2, h * .88, w * .49, d * .49, h * .1, .13, p.roof, 8);
      box(w * .48, d * .48, h * .98, w * .04, d * .04, h * .02, p.accent);
      for (let z = h * .18; z < h * .6; z += h * .16) arch(m, 'y', d * .86, w * .43, z, w * .14, h * .085, p.window);
    } else if (kind === 'market-hall') {
      box(0, 0, 0, w, d, h * .67, p.trim);
      for (let x = 1.5; x < w - 2; x += 5.5) frontArch(x, .15, 3.4, h * .48);
      pitched(m, -.3, -.3, h * .68, w + .6, d + .6, h * .26, p);
      for (let x = 2; x < w - 2; x += 6) awning(m, x, d + .12, h * .45, Math.min(4.9, w - x - 1), 2.6, p, lod);
      box(w * .44, d * .43, h * .86, w * .12, d * .14, h * .14, p.accent);
    } else if (kind === 'levy-palace') {
      box(0, 0, 0, w, d, h * .61, p.roof);
      facade(m, { ...b, h: h * .61 }, p, lod, { palace: true, bays: 5.7 });
      box(0, 0, h * .61, w * .23, d * .47, h * .22, p.trim);
      box(w * .77, 0, h * .61, w * .23, d * .47, h * .22, p.trim);
      box(w * .32, d * .26, h * .61, w * .36, d * .38, h * .26, p.roof);
      pitched(m, w * .30, d * .23, h * .87, w * .4, d * .44, h * .13, p, p.roof);
      for (const x of [w * .12, w * .82]) banner(m, x, d + .15, h * .54, w * .055, h * .36, p);
      for (let x = w * .36; x < w * .68; x += w * .095) box(x, d - 1.1, 0, 1.0, 1.6, h * .56, p.trim, p.trim);
      frontArch(w * .465, 0, w * .07, h * .31);
    } else if (kind === 'scriptorium') {
      box(0, 0, 0, w, d, h * .48, p.roof); facade(m, { ...b, h: h * .48 }, p, lod, { palace: true, bays: 4.0 });
      box(w * .14, d * .17, h * .48, w * .72, d * .6, .7, p.window, p.trim);
      box(w * .38, d * .35, h * .5, w * .24, d * .25, h * .34, p.trim);
      for (let i = 0; i < 3; i++) arch(m, 'y', d * .60, w * (.403 + i * .069), h * .63, w * .043, h * .15, p.window);
      pitched(m, w * .35, d * .32, h * .84, w * .3, d * .31, h * .16, p);
      for (let x = w * .12; x < w * .9; x += w * .16) banner(m, x, d + .05, h * .43, 1.8, 4.5, p);
    } else if (kind === 'exchange-dome') {
      box(0, 0, 0, w, d, h * .43, p.trim); facade(m, { ...b, h: h * .43 }, p, lod, { palace: true, bays: 5.4 });
      m.taper(w / 2, d / 2, h * .43, w * .47, d * .47, h * .14, 1, p.wall, 12);
      const levels = [[.57, .47], [.68, .445], [.78, .36], [.87, .25], [.925, .11], [.95, .035]];
      for (let i = 0; i < levels.length - 1; i++) {
        const [z0, r0] = levels[i], [z1, r1] = levels[i + 1];
        m.taper(w / 2, d / 2, h * z0, w * r0, d * r0, h * (z1 - z0), r1 / r0, shade(p.roof, i * .035), 12);
      }
      box(w * .487, d * .487, h * .945, w * .026, d * .026, h * .055, p.accent, p.accent);
      for (let i = 0; i < 12; i++) {
        const a = (i + .5) * TAU / 12;
        let prev = null;
        for (const [zz, rr] of levels) { const q = [w / 2 + Math.cos(a) * w * rr, d / 2 + Math.sin(a) * d * rr, h * zz + .035]; if (prev) m.line(prev, q, p.accent, 1, .03); prev = q; }
      }
    } else if (kind === 'glass-furnace') {
      box(0, 0, 0, w, d, h * .29, p.roof);
      for (let y = 1; y < d - 2; y += d / 3) pitched(m, 0, y, h * .29, w, d / 3 - 1.5, h * .1, p, p.roof);
      for (const [cx, cy, hh, rr] of [[.18, .22, 1, .09], [.73, .27, .79, .073]]) {
        m.taper(w * cx, d * cy, h * .29, w * rr, w * rr, h * (hh - .29), .66, p.roofDark, 8);
        m.taper(w * cx, d * cy, h * (hh - .045), w * rr * .75, w * rr * .75, h * .045, 1, p.trim, 8);
      }
      m.taper(w * .57, d * .61, h * .3, w * .14, d * .2, h * .22, .64, p.roof, 8);
      for (let x = 1.5; x < w - 2; x += 5.2) frontArch(x, .1, 3.0, h * .22);
    } else if (kind === 'lighthouse') {
      m.taper(w / 2, d / 2, 0, w * .5, d * .5, h * .1, .86, p.wall, 8);
      for (let i = 0; i < 6; i++) {
        const z = .1 + i * .116, r0 = .43 - i * .026, r1 = r0 - .026;
        m.taper(w / 2, d / 2, h * z, w * r0, d * r0, h * .116, r1 / r0, i % 2 ? p.wall : p.cloth, 8);
      }
      m.taper(w / 2, d / 2, h * .80, w * .39, d * .39, h * .033, 1, p.trim, 8);
      m.taper(w / 2, d / 2, h * .833, w * .27, d * .27, h * .108, 1, mix(p.window, '#dbd39d', .48), 8);
      m.taper(w / 2, d / 2, h * .941, w * .4, d * .4, h * .059, .06, p.roofDark, 8);
      for (let i = 0; i < 8; i++) { const a = (i + .5) * TAU / 8; m.line([w / 2 + Math.cos(a) * w * .27, d / 2 + Math.sin(a) * d * .27, h * .831], [w / 2 + Math.cos(a) * w * .27, d / 2 + Math.sin(a) * d * .27, h * .941], p.accent, 1); }
    } else if (kind === 'dye-vats') {
      box(0, 0, 0, w, d, h * .12, p.wood);
      box(0, 0, h * .12, w, d * .22, h * .55, p.roof); pitched(m, 0, 0, h * .67, w, d * .22, h * .14, p);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
        const x = w * (.14 + i * .235), y = d * (.47 + j * .30), rx = w * .085, ry = d * .105;
        m.taper(x, y, h * .12, rx, ry, h * .31, .94, p.trim, 10);
        m.face(ring(x, y, h * .436, rx * .77, ry * .77, 10, Math.PI / 10), i % 2 ? '#364574' : '#3b6676', .03);
      }
      for (const x of [w * .04, w * .96]) m.box(x, d * .30, 0, .35, .35, h, p.wood, p.wood, p.wood);
      m.line([w * .04, d * .30, h], [w * .96, d * .30, h], p.wood, 2);
      for (let x = w * .08; x < w * .9; x += w * .15) banner(m, x, d * .305, h - .15, w * .10, h * .40, p);
    } else if (kind === 'windmill') {
      box(0, 0, 0, w, d, h * .15, p.trim);
      m.taper(w * .5, d * .48, h * .15, w * .31, d * .31, h * .58, .66, p.wall, 10);
      m.taper(w * .5, d * .48, h * .73, w * .28, d * .28, h * .16, .05, p.roofDark, 10);
      const cx = w * .5, cy = d * .81, cz = h * .61, radius = Math.min(w * .59, h * .385), phase = .24;
      for (let i = 0; i < 4; i++) {
        const a = phase + i * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a), nx = -dz, nz = dx;
        const pt = (r, f) => [cx + dx * r + nx * f, cy, cz + dz * r + nz * f];
        m.line(pt(-.2, 0), pt(radius, 0), p.wood, 2, .12);
        m.face([pt(radius * .22, 0), pt(radius * .92, 0), pt(radius * .92, radius * .17), pt(radius * .22, radius * .17)], p.trim, .14);
        if (lod > 1) for (let k = .3; k < .94; k += .15) m.line(pt(radius * k, 0), pt(radius * k, radius * .17), p.wood, 1, .17);
      }
      m.box(cx - .28, cy - .2, cz - .28, .56, .5, .56, p.accent, p.accent, p.wood);
    } else ordinary(m, b, p, lod);
  }

  function propMesh(m, b, p, lod) {
    const w = b.w || 1.4, d = b.d || 1.4, h = b.h || 1.4;
    if (['tree', 'olive', 'planter', 'garden'].includes(b.kind)) {
      m.box(0, 0, 0, w, d, .45, p.trim, p.wall, p.shadow); tree(m, w / 2, d / 2, .4, h, p);
    } else if (b.kind === 'crane') {
      m.box(w * .42, d * .4, 0, w * .12, d * .12, h, p.wood, p.wood, shade(p.wood, -.2));
      m.line([w * .2, d * .44, h * .73], [w * .95, d * .44, h * .95], p.wood, 3);
      m.line([w * .5, d * .44, h], [w * .9, d * .44, h * .95], p.accent, 1);
      m.line([w * .9, d * .44, h * .95], [w * .9, d * .44, h * .3], p.wood, 1);
    } else if (b.kind === 'barrels' || b.kind === 'barrel') {
      const rr = Math.min(w, d) * .22, bh = h * .92;
      for (const [fx, fy] of b.kind === 'barrel' ? [[.5, .5]] : [[.28, .35], [.73, .66]]) {
        const x = w * fx, y = d * fy;
        m.taper(x, y, 0, rr * .86, rr * .86, bh * .52, 1.16, p.wood, 9);
        m.taper(x, y, bh * .52, rr, rr, bh * .48, .86, p.wood, 9);
        for (const z of [bh * .16, bh * .79]) m.taper(x, y, z, rr * .98, rr * .98, .07, 1, p.roofDark, 9, false);
        if (lod > 1) m.line([x - rr * .6, y, bh + .01], [x + rr * .6, y, bh + .01], p.roofDark);
      }
    } else if (b.kind === 'boat') {
      const outer = [[0, d * .15, 0], [w * .65, 0, 0], [w, d * .5, 0], [w * .65, d, 0], [0, d * .85, 0]].map(q => [q[0], q[1], .4]);
      m.face(outer, p.wood); m.face(outer.map(q => [w * .5 + (q[0] - w * .5) * .79, d * .5 + (q[1] - d * .5) * .76, .42]), p.roofDark, .02);
      for (let x = w * .2; x < w * .8; x += w * .2) m.line([x, d * .15, .48], [x, d * .85, .48], p.trim, 2);
    } else if (b.kind === 'awning' || b.kind === 'stall') {
      m.box(0, 0, 0, w, d, Math.min(1, h * .4), p.wood, p.wood, p.roofDark); awning(m, -.2, -.15, h, w + .4, d + .3, p, lod);
    } else if (['wayfinding', 'signpost', 'sign'].includes(b.kind)) {
      const cx = w * .5, cy = d * .5, post = Math.min(.12, w * .22);
      m.box(cx - post / 2, cy - post / 2, 0, post, post, h, p.wood, p.wood, p.roofDark);
      m.box(cx - .18, cy - .18, 0, .36, .36, .2, p.trim, p.wall, p.shadow);
      for (const [z, dir] of [[h * .83, 1], [h * .64, -1]]) {
        const x = cx - .5, y = cy + .09;
        m.face([[x, y, z - .12], [x + .91, y, z - .12], [x + 1.08, y, z + .07], [x + .91, y, z + .25], [x, y, z + .25]].map(q => [cx + (q[0] - cx) * dir, q[1], q[2]]), p.cloth);
        m.line([cx - .28 * dir, y + .02, z + .065], [cx + .28 * dir, y + .02, z + .065], p.trim);
      }
    } else if (b.kind === 'lamp') {
      m.box(w * .4, d * .4, 0, w * .2, d * .2, h * .85, p.wood, p.wood, p.roofDark);
      m.box(w * .15, d * .15, h * .81, w * .7, d * .7, h * .19, p.accent, p.trim, p.accent);
    } else if (b.kind === 'bench') {
      m.box(0, 0, h * .55, w, d, h * .16, p.wood, p.wood, p.roofDark);
      for (const x of [.1, w * .8]) m.box(x, d * .2, 0, w * .08, d * .6, h * .58, p.wall, p.wall, p.shadow);
    } else {
      m.box(0, 0, 0, w, d, h, p.wood, p.wood, p.roofDark);
      if (lod > 1) { m.line([0, d + .01, 0], [w, d + .01, h], p.trim); m.line([w, d + .01, 0], [0, d + .01, h], p.trim); }
    }
  }

  class Painter {
    constructor(options = {}) {
      this.unit = options.metersToUnits || 20; this.seed = seedOf(options.seed || 'nacre-city');
      this.maxCachePixels = options.maxCachePixels || 12000000; this.maxCacheEntries = options.maxCacheEntries || 256;
      this.maxSpriteEdge = options.maxSpriteEdge || 1024; this.cache = new Map(); this.cachePixels = 0;
      this.bounds = null; this.metrics = { hits: 0, misses: 0, evictions: 0, culled: 0, queued: 0 };
      this.setProfiles(options.profiles || profiles);
    }
    setProfiles(list) {
      this.profiles = list && list.length ? list : profiles;
      this.profileMap = Object.fromEntries(this.profiles.map((p, i) => {
        const base = profileMap[p.id] || profiles[i] || profiles[4];
        return [p.id || base.id, { ...base, ...p, palette: { ...base.palette, ...p.palette } }];
      }));
      this.clear(); return this;
    }
    setBounds(b) { this.bounds = b ? { x: b.x ?? b.x0, y: b.y ?? b.y0, w: b.w ?? (b.x1 - b.x0), d: b.d ?? (b.y1 - b.y0) } : null; return this; }
    clear() { this.cache.clear(); this.cachePixels = 0; return this; }
    stats() { return { ...this.metrics, entries: this.cache.size, pixels: this.cachePixels, approximateRGBABytes: this.cachePixels * 4 }; }
    _profile(b) { return this.profileMap[b.districtId] || profileMap[b.districtId] || profiles[4]; }
    _rect(b) {
      let { x, y, w, d } = b;
      if (this.bounds) { const a = this.bounds, X = Math.min(x + w, a.x + a.w), Y = Math.min(y + d, a.y + a.d); x = Math.max(x, a.x); y = Math.max(y, a.y); w = X - x; d = Y - y; }
      return w > 0 && d > 0 ? { ...b, x, y, w, d } : null;
    }
    _groundRect(r, patch) {
      let b = this._rect(patch); if (!b || !r.view.inv) return b;
      const points = [[0, 0], [r.bw || r.W, 0], [0, r.bh || r.H], [r.bw || r.W, r.bh || r.H]].map(q => r.view.toGround(q[0] + r.ix, q[1] + r.iy));
      const a = boundsOf(points).map(n => n / this.unit), pad = 3 + Math.abs(b.z || 0), x = Math.max(b.x, a[0] - pad), y = Math.max(b.y, a[1] - pad);
      const w = Math.min(b.x + b.w, a[2] + pad) - x, d = Math.min(b.y + b.d, a[3] + pad) - y;
      return w > 0 && d > 0 ? { ...b, x, y, w, d } : null;
    }
    _remember(key, st) {
      while (this.cache.size && (this.cachePixels + st.pixels > this.maxCachePixels || this.cache.size >= this.maxCacheEntries)) {
        const first = this.cache.keys().next().value, old = this.cache.get(first); this.cache.delete(first); this.cachePixels -= old.pixels; this.metrics.evictions++;
      }
      if (st.pixels <= this.maxCachePixels) { this.cache.set(key, st); this.cachePixels += st.pixels; }
      return st;
    }
    _floorStamp(view, p, color) {
      const scale = Math.min(3, Math.pow(2, Math.round(Math.log2(Math.max(.002, view.scale)) * 2) / 2)), ppm = scale * this.unit;
      const size = clamp(Math.pow(2, Math.ceil(Math.log2(64 / ppm))), 8, 64);
      const key = ['paving', color, p.shadow, p.trim, size, view.yawDeg, view.pitchDeg, view.zBoost, scale].join('|');
      if (this.cache.has(key)) { const st = this.cache.get(key); this.cache.delete(key); this.cache.set(key, st); this.metrics.hits++; return st; }
      this.metrics.misses++;
      const v = new E.View('paving', 'Paving', view.yawDeg, view.pitchDeg, scale, view.zBoost), points = rect3(0, 0, 0, size, size).map(q => v.p(q[0] * this.unit, q[1] * this.unit, 0)), b = boundsOf(points), ox = Math.floor(b[0]) - 2, oy = Math.floor(b[1]) - 2;
      const c = E.mkCanvas(Math.ceil(b[2] - ox) + 3, Math.ceil(b[3] - oy) + 3), g = E.ctx2d(c), P = (x, y) => { const q = v.p(x * this.unit, y * this.unit, 0); return [q[0] - ox, q[1] - oy]; };
      polygon(g, points.map(q => [q[0] - ox, q[1] - oy]), mix(color, p.shadow, .09));
      const row = ppm > 8 ? .5 : ppm > 4 ? 1 : 2, col = row * 1.6;
      for (let y = 0, j = 0; y < size; y += row, j++) for (let x = -(j % 2) * col / 2, i = 0; x < size; x += col, i++) {
        const n = E.hash2(i + (j % 2) * 17, j + 211), gap = row * .055, x0 = Math.max(0, x + gap), y0 = y + gap, x1 = Math.min(size, x + col - gap), y1 = Math.min(size, y + row - gap);
        if (x1 <= x0) continue;
        polygon(g, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], mix(color, n > .5 ? p.trim : p.shadow, Math.abs(n - .5) * .10));
      }
      return this._remember(key, { c, x: ox, y: oy, size, scale, pixels: c.width * c.height });
    }
    _pave(r, patch, p, color, clipPoints) {
      const b = this._groundRect(r, patch); if (!b || r.view.scale * this.unit < 2.2) return;
      const g = r.tgt || r.ctx, st = this._floorStamp(r.view, p, color), ratio = r.view.scale / st.scale, z = patch.z || 0;
      const cp = clipPoints || rect3(patch.x, patch.y, z, patch.w, patch.d).map(q => this._project(r, ...q));
      g.save(); g.beginPath(); cp.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.clip();
      for (let y = Math.floor(b.y / st.size) * st.size; y < b.y + b.d; y += st.size) for (let x = Math.floor(b.x / st.size) * st.size; x < b.x + b.w; x += st.size) {
        const origin = this._project(r, x, y, z), sx = Math.round(origin[0] + st.x * ratio), sy = Math.round(origin[1] + st.y * ratio), w = Math.ceil(st.c.width * ratio), h = Math.ceil(st.c.height * ratio);
        if (sx > (r.bw || r.W) || sy > (r.bh || r.H) || sx + w < 0 || sy + h < 0) continue;
        g.imageSmoothingEnabled = false; g.drawImage(st.c, sx, sy, w, h);
      }
      g.restore(); g._c = null;
    }
    _project(r, x, y, z = 0) { return r.w(x * this.unit, y * this.unit, z * this.unit); }
    _groundQuad(r, b, color, z = 0) { polygon(r.tgt || r.ctx, rect3(b.x, b.y, z, b.w, b.d).map(q => this._project(r, ...q)), color); }
    ground(r, patch) {
      if (['water', 'canal', 'sea', 'basin', 'salt-pan'].includes(patch.kind)) return this.water(r, patch);
      const b = this._groundRect(r, patch); if (!b) return false;
      const p = this._profile(b).palette, g = r.tgt || r.ctx, z = b.z || 0, ppm = r.view.scale * this.unit;
      const color = b.color || (['plaza', 'court', 'civic-square'].includes(b.kind) ? p.road : b.kind === 'garden' ? mix(p.ground, p.green, .24) : b.kind === 'yard' ? mix(p.ground, p.shadow, .12) : p.ground);
      this._groundQuad(r, b, color, z);
      this._pave(r, b, p, color);
      return true;
    }
    water(r, patch) {
      const b = this._groundRect(r, patch); if (!b) return false;
      const p = this._profile(b).palette, g = r.tgt || r.ctx, z = b.z ?? -.08, ppm = r.view.scale * this.unit;
      const salt = ['basin', 'salt-pan'].includes(b.kind), color = b.color || (salt ? mix(p.water, p.trim, .3) : p.water);
      this._groundQuad(r, b, color, z);
      if (ppm < .9) return true;
      const step = ppm > 10 ? 3 : ppm > 4 ? 6 : 12; let count = 0;
      for (let y = Math.floor(b.y / step) * step; y < b.y + b.d && count < 90; y += step) for (let x = Math.floor(b.x / step) * step; x < b.x + b.w && count < 90; x += step) {
        if (x < b.x || y < b.y) continue; const n = E.hash2(Math.round(x / step) + 7, Math.round(y / step) + 19); if (n < .35) continue; count++;
        line(g, this._project(r, x, y, z + .02), this._project(r, Math.min(x + .7 + n * step * .45, b.x + b.w), y, z + .02), mix(color, p.trim, .13 + n * .13));
      }
      if (salt) {
        const points = rect3(b.x, b.y, z + .04, b.w, b.d).map(q => this._project(r, ...q));
        for (let i = 0; i < 4; i++) line(g, points[i], points[(i + 1) % 4], p.trim, 2);
      }
      return true;
    }
    road(r, road) {
      const spans = road.bridgeSpans || [], isDeck = road.bridge && !spans.length;
      const p = this._profile(road).palette, g = r.tgt || r.ctx, points = road.points || [], width = road.width || 6, z = road.z || (isDeck ? .10 : .018), ppm = r.view.scale * this.unit;
      const color = road.color || (isDeck ? p.wood : road.class === 'avenue' || road.class === 'primary' ? mix(p.road, p.trim, .14) : p.road);
      for (let i = 1; i < points.length; i++) {
        let a = [points[i - 1].x, points[i - 1].y], b = [points[i].x, points[i].y];
        if (this.bounds) { const q = this.bounds, c = clipLine(a, b, [q.x - width, q.y - width, q.x + q.w + width, q.y + q.d + width]); if (!c) continue; [a, b] = c; }
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < .001) continue;
        const nx = -dy / len, ny = dx / len, P = (pt, off, zz = z) => this._project(r, pt[0] + nx * off, pt[1] + ny * off, zz);
        const roadPoly = [P(a, -width / 2), P(b, -width / 2), P(b, width / 2), P(a, width / 2)];
        polygon(g, roadPoly, color);
        if (!isDeck && ppm > 4) this._pave(r, { x: Math.min(a[0], b[0]) - width, y: Math.min(a[1], b[1]) - width, w: Math.abs(dx) + width * 2, d: Math.abs(dy) + width * 2, z }, p, color, roadPoly);
        if (ppm > 1.1) {
          const c = mix(color, p.trim, isDeck ? .32 : .34);
          for (const s of [-1, 1]) line(g, P(a, width / 2 * s), P(b, width / 2 * s), c, ppm > 9 ? 2 : 1);
        }
        if (ppm > 4 && isDeck) {
          const gap = isDeck ? 1.4 : 3.4, n = Math.min(90, Math.ceil(len / gap));
          for (let j = 1; j < n; j++) { const t = j / n, c = [a[0] + dx * t, a[1] + dy * t]; line(g, P(c, -width * .44, z + .005), P(c, width * .44, z + .005), mix(color, p.shadow, isDeck ? .28 : .11)); }
        }
      }
      if (spans.length && points.length === 2) for (const span of spans) {
        const a = points[0], b = points[1], at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        this.road(r, { ...road, id: road.id + ':deck:' + span.from, bridgeSpans: [], bridge: true, points: [at(span.from), at(span.to)], color: undefined });
      }
      return true;
    }
    _screenBox(r, b) {
      const ps = [], pad = Math.max(3, Math.min(b.w, b.d) * .15), H = (b.h || 1) + 5;
      for (const x of [-pad, b.w + pad]) for (const y of [-pad, b.d + pad]) for (const z of [0, H]) ps.push(this._project(r, b.x + x, b.y + y, (b.z || 0) + z));
      return boundsOf(ps);
    }
    _bake(b, view, type) {
      const scaleBucket = Math.pow(2, Math.round(Math.log2(Math.max(.002, view.scale)) * 2) / 2);
      const key = [type, b.id || '', b.districtId, b.kind, b.roof, b.w, b.d, b.h, b.seed ?? this.seed, b.climbable, b.climb, b.roofAccess, view.yawDeg, view.pitchDeg, view.zBoost, scaleBucket].join('|');
      if (this.cache.has(key)) { const st = this.cache.get(key); this.cache.delete(key); this.cache.set(key, st); this.metrics.hits++; return st; }
      this.metrics.misses++;
      let v = new E.View('city-bake', 'City bake', view.yawDeg, view.pitchDeg, scaleBucket, view.zBoost);
      const corners = []; for (const x of [-3, b.w + 3]) for (const y of [-3, b.d + 3]) for (const z of [0, b.h + 6]) corners.push(v.p(x * this.unit, y * this.unit, z * this.unit));
      const cb = boundsOf(corners), fit = Math.min(1, (this.maxSpriteEdge - 8) / Math.max(cb[2] - cb[0], cb[3] - cb[1]));
      if (fit < 1) v = new E.View('city-bake', 'City bake', view.yawDeg, view.pitchDeg, scaleBucket * fit, view.zBoost);
      const ppm = v.scale * this.unit, lod = ppm < .85 ? 0 : ppm < 3 ? 1 : ppm < 9 ? 2 : 3;
      const m = new Mesh(v, this.unit), p = this._profile(b).palette;
      if (type === 'landmark') landmarkMesh(m, b, p, lod); else if (type === 'prop') propMesh(m, b, p, lod); else ordinary(m, b, p, lod);
      let pb = boundsOf(m.points.map(q => v.p(q[0] * this.unit, q[1] * this.unit, q[2] * this.unit)));
      const actualFit = Math.min(1, (this.maxSpriteEdge - 8) / Math.max(pb[2] - pb[0], pb[3] - pb[1]));
      if (actualFit < 1) { v.set(v.yawDeg, v.pitchDeg, v.scale * actualFit, v.zBoost); pb = boundsOf(m.points.map(q => v.p(q[0] * this.unit, q[1] * this.unit, q[2] * this.unit))); }
      const ox = Math.floor(pb[0]) - 3, oy = Math.floor(pb[1]) - 3;
      const c = E.mkCanvas(Math.max(1, Math.ceil(pb[2] - ox) + 4), Math.max(1, Math.ceil(pb[3] - oy) + 4)), g = E.ctx2d(c);
      m.draw(g, ox, oy);
      const st = { c, x: ox, y: oy, scale: v.scale, lod, ops: m.ops.length, pixels: c.width * c.height };
      return this._remember(key, st);
    }
    _feature(r, feature, type) {
      if (feature.enabled === false) return false;
      const b = { ...feature, w: feature.w || 1.4, d: feature.d || 1.4, h: feature.h || 1.4 };
      const test = this._screenBox(r, b), W = r.bw || r.W, H = r.bh || r.H;
      if (test[2] < -3 || test[0] > W + 3 || test[3] < -3 || test[1] > H + 3) { this.metrics.culled++; return false; }
      const st = this._bake(b, r.view, type), origin = this._project(r, b.x, b.y, b.z || 0), ratio = r.view.scale / st.scale;
      const sx = Math.round(origin[0] + st.x * ratio), sy = Math.round(origin[1] + st.y * ratio), sw = Math.max(1, Math.round(st.c.width * ratio)), sh = Math.max(1, Math.round(st.c.height * ratio));
      const frontX = r.view.fx >= 0 ? b.x + b.w : b.x, frontY = r.view.fy >= 0 ? b.y + b.d : b.y, z = b.z || 0;
      if (type !== 'prop' && b.shadow !== false && r.decal) {
        const ex = Math.min(7, b.h * .2), ey = Math.min(9, b.h * .28), p = this._profile(b).palette;
        const poly = [[b.x, b.y + b.d, z], [b.x + b.w, b.y, z], [b.x + b.w + ex, b.y + ey, z], [b.x + b.w + ex, b.y + b.d + ey, z], [b.x + ex, b.y + b.d + ey, z]].map(q => this._project(r, ...q));
        r.decal(g => { const ga = g.globalAlpha; g.globalAlpha = ga * .15; polygon(g, poly, p.window); g.globalAlpha = ga; });
      }
      const opacity=feature.renderOpacity??1;
      r.queue(frontX * this.unit, frontY * this.unit, z * this.unit, g => { const alpha=g.globalAlpha;g.globalAlpha=alpha*opacity;g.imageSmoothingEnabled = false; g.drawImage(st.c, sx, sy, sw, sh);g.globalAlpha=alpha; }, { occluder: type !== 'prop'&&opacity>.95, hides: type === 'prop'&&opacity>.95, box: [sx, sy, sx + sw, sy + sh] });
      this.metrics.queued++; return true;
    }
    building(r, b) { return this._feature(r, b, b.isLandmark || profiles.some(p => p.landmark.kind === b.kind) ? 'landmark' : 'building'); }
    landmark(r, b) { return this._feature(r, b, 'landmark'); }
    prop(r, b) { return this._feature(r, b, 'prop'); }
  }
  E.NacreCityArt = { version: '1.0.0', profiles, profileMap, Painter, metersToUnits: 20 };
})(window.My3D2dge);
