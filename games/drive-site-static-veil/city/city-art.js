/*!
 * STATIC VEIL — original procedural city architecture, 1.0.0.
 * Load after my-3d2dge.js. VeilArt is optional; no external images or lights.
 *
 * CityArt.building(r, b, context) -> boolean visible
 * b = { id, x, y, w, d, floors, floorH=64, type, variant, name,
 *       accent, palette }
 * Building x/y are the MINIMUM footprint corner, z starts at 0, w/d > 0.
 * All dimensions are engine world units: 16 units = 1 metre; 64 = one floor.
 * Types: industrial, residential, office, garden, market, tower (fallback).
 * District names tideward/lattice/crownline/furnace/verdant/surge also work.
 * Palette may be a named palette, a numeric index, or a partial color object.
 * context = { cutHeight=96, fullHeight=false, selected=false, time=0,
 *             reduced=false }
 * An explicit cutHeight is always respected; fullHeight:true uses the actual
 * roof when cutHeight is absent. Floors are NEVER compressed into the cut.
 * A cut surface is a plain section slab; roof equipment appears only at the
 * real roof and only while unselected. Selected means an inspection highlight.
 * The caller can skip building() entirely for its active interior/roof view.
 *
 * CityArt.streetProp(r, p, time=0) / floorProp(r, p, time=0) -> boolean visible
 * Props use CENTERED x/y, optional z=0, scale=1, color/accent, active=true,
 * reduced/reducedMotion=false, orientation=0 (quarter turns; 'y' means 1).
 * Floor types: apartment-desk, apartment-bed, office-desk, industrial-machine,
 * garden-planter, roof-vent, stairhead, lifthead, radio, sofa, shelf, crate.
 * Street types: lamp, bollard, bench, kiosk, market-stall, bin, barrier,
 * hydrant, planter, tree, cable; existing VeilArt types may also be wrapped.
 *
 * Rendering: vertical facade bays are separately depth-sorted; all custom
 * polygons and lines are clipped before E.px rasterization. Visible bay/floor
 * index ranges are solved from the projection, not visited then discarded.
 * This matters because E.px.poly scans every projected row, even off screen.
 * No gameplay objects, input state, collision maps, or light lists are changed.
 */
(function (root) {
  'use strict';
  const E = root.My3D2dge;
  if (!E || !E.Renderer || !E.px) throw new Error('CityArt requires my-3d2dge.js first.');
  const px = E.px, EPS = 1e-6;
  const C = Object.freeze({
    ink: '#08121d', side: '#243b4e', top: '#354e61', edge: '#587488',
    frame: '#132738', glass: '#152e3b', glassDim: '#102430',
    light: '#9bced0', warm: '#c4a26b', accent: '#5ff5cf',
    rust: '#735044', leaf: '#587f58', lime: '#c8e578'
  });
  const PALETTES = Object.freeze({
    slate: Object.freeze({ side: '#243b4e', top: '#354e61', edge: '#587488' }),
    blue: Object.freeze({ side: '#203a53', top: '#345875', edge: '#64849a', accent: '#5bdbed' }),
    oxide: Object.freeze({ side: '#353d43', top: '#525851', edge: '#78877f', accent: '#e6ad62', rust: '#835b45' }),
    garden: Object.freeze({ side: '#263e3e', top: '#3c5c56', edge: '#648477', accent: '#c8e578', glass: '#17382f' }),
    market: Object.freeze({ side: '#2c414f', top: '#49586b', edge: '#718194', accent: '#f0c66c' })
  });
  const PALETTE_NAMES = Object.keys(PALETTES);
  const TYPE_ALIASES = {
    tideward: 'industrial', furnace: 'industrial', lattice: 'residential',
    crownline: 'office', verdant: 'garden', surge: 'market',
    apartment: 'residential', apartments: 'residential', warehouse: 'industrial',
    factory: 'industrial', corporate: 'office', park: 'garden'
  };
  const PROP_ALIASES = {
    apartmentdesk: 'desk', apartmentbed: 'bed', officedesk: 'officedesk',
    industrialmachine: 'machine', gardenplanter: 'planter', roofvent: 'roofvent',
    stairwell: 'stairhead', stair: 'stairhead', lift: 'lifthead', elevator: 'lifthead',
    radiomast: 'radio', radioantenna: 'radio', streetlamp: 'lamp', lightpole: 'lamp',
    marketstall: 'stall', vendor: 'stall', vending: 'kiosk', vendingmachine: 'kiosk',
    trash: 'bin', trashcan: 'bin', dumpster: 'bin', roadblock: 'barrier',
    garden: 'planter', flowerbox: 'planter', cabinet: 'shelf', shelves: 'shelf',
    rooftopvent: 'roofvent', rooftopstair: 'stairhead', rooftoplift: 'lifthead',
    rooftopradio: 'radio', antenna: 'radio'
  };
  const PROP_BOUNDS = {
    desk: [20, 16, 27], officedesk: [24, 22, 31], bed: [16, 24, 19],
    machine: [25, 21, 42], planter: [21, 14, 31], roofvent: [17, 14, 18],
    stairhead: [19, 25, 43], lifthead: [20, 20, 49], radio: [22, 22, 77],
    lamp: [13, 26, 81], bollard: [6, 6, 18], bench: [23, 10, 21],
    kiosk: [16, 14, 43], stall: [27, 22, 43], bin: [9, 9, 19],
    barrier: [25, 9, 20], hydrant: [12, 9, 22], tree: [23, 23, 62],
    cable: [29, 19, 4], sofa: [24, 16, 23], shelf: [19, 11, 39],
    crate: [13, 13, 20]
  };
  const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const normalize = v => String(v || '').toLowerCase().replace(/[\s_-]+/g, '');
  const hexColor = (v, fallback) => typeof v === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(v) ? v : fallback;
  const shade = E.shade;
  const palettes = new Map();
  function colorSet(b, type) {
    const auto = type === 'industrial' ? 'oxide' : type === 'garden' ? 'garden' : type === 'market' ? 'market' : type === 'office' ? 'blue' : 'slate';
    const named = typeof b.palette === 'number' ? PALETTE_NAMES[((b.palette | 0) % PALETTE_NAMES.length + PALETTE_NAMES.length) % PALETTE_NAMES.length] : b.palette;
    const custom = b.palette && typeof b.palette === 'object' && !Array.isArray(b.palette) ? b.palette : null;
    const key = (typeof named === 'string' ? named : auto) + '|' + (b.accent || '') + '|' + (custom ? JSON.stringify(custom) : '');
    if (palettes.has(key)) return palettes.get(key);
    const c = Object.assign({}, C, PALETTES[named] || PALETTES[auto]);
    if (custom) for (const k of Object.keys(C)) c[k] = hexColor(custom[k], c[k]);
    c.accent = hexColor(b.accent, c.accent);
    c.shadow = shade(c.side, -.28); c.sill = shade(c.edge, -.13);
    c.wet = shade(c.top, .12); c.accentDim = E.mix(c.accent, c.frame, .68);
    c.glassLit = E.mix(c.glass, c.light, .34); c.rustDim = E.mix(c.rust, c.side, .38);
    if (palettes.size > 128) palettes.clear();
    palettes.set(key, c);
    return c;
  }
  function seedFor(b) {
    const s = String(b.id === undefined ? String(b.x) + ':' + b.y : b.id);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h ^ ((number(b.variant, 0) | 0) * 65537)) >>> 0;
  }
  function bounds(points) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return [x0, y0, x1, y1];
  }
  function visibleBounds(r, a, margin = 2) {
    return a[2] >= -margin && a[0] <= r.W + margin && a[3] >= -margin && a[1] <= r.H + margin;
  }
  function boxBounds(r, x0, y0, z0, x1, y1, z1) {
    return bounds([
      r.w(x0, y0, z0), r.w(x1, y0, z0), r.w(x1, y1, z0), r.w(x0, y1, z0),
      r.w(x0, y0, z1), r.w(x1, y0, z1), r.w(x1, y1, z1), r.w(x0, y1, z1)
    ]);
  }
  // Sutherland-Hodgman clipping bounds the native scan-line primitive's work.
  function clippedPolygon(r, points) {
    if (!visibleBounds(r, bounds(points))) return [];
    let out = points;
    for (const [axis, edge, greater] of [[0, -2, true], [0, r.W + 2, false], [1, -2, true], [1, r.H + 2, false]]) {
      if (!out.length) break;
      const input = out; out = [];
      let a = input[input.length - 1], ai = greater ? a[axis] >= edge : a[axis] <= edge;
      for (const b of input) {
        const bi = greater ? b[axis] >= edge : b[axis] <= edge;
        if (ai !== bi) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        if (bi) out.push(b);
        a = b; ai = bi;
      }
    }
    return out;
  }
  function polygon(r, g, points, color) {
    const q = clippedPolygon(r, points);
    if (q.length > 2) px.poly(g, q, color);
  }
  function worldPoly(r, g, points, color) { polygon(r, g, points.map(p => r.w(p[0], p[1], p[2])), color); }
  function screenLine(r, g, a, b, color, width = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], margin = width + 2;
    let lo = 0, hi = 1;
    for (const [p, q] of [[-dx, a[0] + margin], [dx, r.W + margin - a[0]], [-dy, a[1] + margin], [dy, r.H + margin - a[1]]]) {
      if (Math.abs(p) < EPS) { if (q < 0) return; }
      else { const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return; }
    }
    px.line(g, a[0] + dx * lo, a[1] + dy * lo, a[0] + dx * hi, a[1] + dy * hi, color, width);
  }
  function line(r, g, a, b, color, width = 1) { screenLine(r, g, r.w(...a), r.w(...b), color, width); }
  function safeBox(r, g, x0, y0, z0, x1, y1, z1, top, side) {
    if (z1 < z0 || x1 <= x0 || y1 <= y0) return;
    const bb = boxBounds(r, x0, y0, z0, x1, y1, z1);
    if (!visibleBounds(r, bb)) return;
    if (bb[0] >= 0 && bb[1] >= 0 && bb[2] <= r.W && bb[3] <= r.H) {
      r.box(g, x0, y0, z0, x1, y1, z1, top, side);
      return;
    }
    if (!r.view.isTop) for (const [nx, ny, a, b] of [
      [0, -1, [x1, y0], [x0, y0]], [0, 1, [x0, y1], [x1, y1]],
      [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y1], [x1, y0]]
    ]) {
      if (nx * r.view.fx + ny * r.view.fy <= .02) continue;
      const lit = .6 * nx + .8 * ny, col = lit < -.2 ? shade(side, .12) : lit > .5 ? shade(side, -.25) : side;
      worldPoly(r, g, [[...a, z0], [...b, z0], [...b, z1], [...a, z1]], col);
    }
    worldPoly(r, g, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top);
  }
  function facePoint(f, u, z, out = .12) { return [f.x + f.ux * u + f.nx * out, f.y + f.uy * u + f.ny * out, z]; }
  function faceRect(r, g, f, u0, z0, u1, z1, color, cap, out = .16) {
    z0 = Math.max(0, z0); z1 = Math.min(cap, z1);
    if (z1 <= z0 || u1 <= u0) return;
    worldPoly(r, g, [facePoint(f, u0, z0, out), facePoint(f, u1, z0, out), facePoint(f, u1, z1, out), facePoint(f, u0, z1, out)], color);
  }
  function faceLine(r, g, f, u0, z0, u1, z1, color, cap, out = .25) {
    if (Math.min(z0, z1) > cap || Math.max(z0, z1) < 0) return;
    if (Math.abs(z1 - z0) > EPS) {
      const dz = z1 - z0, du = u1 - u0, a = -z0 / dz, b = (cap - z0) / dz;
      const lo = Math.max(0, Math.min(a, b)), hi = Math.min(1, Math.max(a, b));
      if (lo > hi) return;
      u1 = u0 + du * hi; z1 = z0 + dz * hi;
      u0 += du * lo; z0 += dz * lo;
    }
    line(r, g, facePoint(f, u0, z0, out), facePoint(f, u1, z1, out), color);
  }
  // Only the visible span of a long facade is visited, including at a shallow yaw.
  function faceRange(r, f, height) {
    const a = r.w(f.x, f.y, 0), b = r.w(f.x + f.ux * f.len, f.y + f.uy * f.len, 0);
    const vx = (b[0] - a[0]) / f.len;
    let u0 = 0, u1 = f.len;
    if (Math.abs(vx) > .001) {
      const q0 = (-4 - a[0]) / vx, q1 = (r.W + 4 - a[0]) / vx;
      u0 = Math.max(0, Math.min(q0, q1)); u1 = Math.min(f.len, Math.max(q0, q1));
    } else if (a[0] < -4 || a[0] > r.W + 4) return null;
    if (u1 <= u0) return null;
    const y0 = a[1] + (b[1] - a[1]) * u0 / f.len, y1 = a[1] + (b[1] - a[1]) * u1 / f.len;
    const lift = -r.view.bz;
    let z0 = 0, z1 = height;
    if (lift > .001) { z0 = Math.max(0, (Math.min(y0, y1) - r.H - 4) / lift); z1 = Math.min(height, (Math.max(y0, y1) + 4) / lift); }
    if (z1 < z0) return null;
    return { u0, u1, z0, z1, pxPerUnit: Math.abs(vx) };
  }
  function windowPane(r, g, f, a, z, width, height, lit, c, cap, industrial) {
    faceRect(r, g, f, a, z, a + width, z + height, c.frame, cap);
    faceRect(r, g, f, a + 1.5, z + 1.5, a + width - 1.5, z + height - 1.6, lit > .74 ? c.warm : lit > .32 ? c.glassLit : c.glassDim, cap);
    if (width * Math.abs(r.view.ax * f.ux + r.view.ay * f.uy) > 8) {
      faceLine(r, g, f, a + width * .54, z + 1, a + width * .54, z + height - 1, industrial ? c.edge : c.frame, cap);
      if (lit > .4) faceLine(r, g, f, a + 3, z + height - 4, a + width * .42, z + height - 4, c.light, cap);
    }
    faceRect(r, g, f, a - 1, z - 1.5, a + width + 1, z, c.sill, cap);
  }
  function drawBay(r, g, f, left, right, height, fh, first, last, stride, index, seed, type, c, selected) {
    const width = right - left, detail = width * Math.abs(r.view.ax * f.ux + r.view.ay * f.uy) >= 7;
    const wall = f.nx > 0 || f.ny > 0 ? c.side : c.top;
    faceRect(r, g, f, left, 0, right + .02, height, wall, height, 0);
    faceRect(r, g, f, left, 0, right, Math.min(6, fh * .13), c.frame, height);
    faceRect(r, g, f, left, 0, left + 1.2, height, c.shadow, height);
    if (!detail) return;
    const salt = seed + index * 31 + f.id * 997;
    for (let floor = first; floor <= last; floor += stride) {
      const z = floor * fh, n = E.hash2(salt, floor + 19);
      const rect = (a, b, cc, dd, col) => faceRect(r, g, f, left + a, z + b, left + cc, z + dd, col, height);
      const stroke = (a, b, cc, dd, col) => faceLine(r, g, f, left + a, z + b, left + cc, z + dd, col, height);
      rect(0, 0, width, Math.min(2.4, fh * .05), c.shadow);
      stroke(1, Math.min(3.2, fh * .07), width, Math.min(3.2, fh * .07), c.sill);
      if (floor === 0) {
        const top = fh * .67, sill = Math.min(7, fh * .12), entrance = index % 5 === 1;
        if (type === 'industrial') {
          rect(4, sill, width - 4, top, c.frame);
          rect(6, sill + 2, width - 6, top - 3, c.shadow);
          for (let k = 1; k <= 5; k++) stroke(6, sill + (top - sill) * k / 6, width - 6, sill + (top - sill) * k / 6, c.sill);
          for (let k = 0; k < 4; k++) rect(4 + k * (width - 8) / 4, 4, 8 + k * (width - 8) / 4, 6.2, k % 2 ? c.rustDim : c.warm);
          rect(6, fh * .78, width - 6, fh * .88, n > .5 ? c.glassLit : c.frame);
        } else {
          windowPane(r, g, f, left + 4, sill, Math.max(3, width - 8), top - sill, entrance ? .38 : n, c, height, false);
          if (entrance) {
            stroke(width * .5, sill, width * .5, top, c.edge);
            rect(width * .57, fh * .32, width * .6, fh * .37, c.accent);
            rect(3, 0, width - 3, 3.4, c.edge);
          }
          if (type === 'market' || type === 'residential' || type === 'garden') {
            const awningZ = fh * .72, over = type === 'market' ? 9 : 4;
            if (awningZ <= height) {
              worldPoly(r, g, [facePoint(f, left + 1, awningZ, .4), facePoint(f, right - 1, awningZ, .4), facePoint(f, right - 1, awningZ - 3, over), facePoint(f, left + 1, awningZ - 3, over)], index % 2 ? c.accentDim : c.top);
              faceRect(r, g, f, left + 1, awningZ - 5, right - 1, awningZ - 3, type === 'market' ? c.warm : c.sill, height, over);
            }
          }
          if (type === 'office') { stroke(width * .5, top, width * .5, fh * .94, c.edge); rect(4, fh * .8, width - 4, fh * .9, c.glass); }
        }
        rect(3, fh * .9, width - 3, fh * .945, index % 4 === 0 ? c.accent : c.accentDim);
      } else {
        const narrow = type === 'industrial', winZ = z + fh * (narrow ? .47 : .2), winH = fh * (narrow ? .29 : .55);
        if (type === 'residential' || type === 'market') {
          const ww = (width - 13) * .5;
          if (ww >= 4) {
            windowPane(r, g, f, left + 4, winZ, ww, winH, n, c, height, false);
            windowPane(r, g, f, left + width / 2 + 2, winZ, ww, winH, E.hash2(salt + 5, floor + 2), c, height, false);
          } else windowPane(r, g, f, left + 3, winZ, width - 6, winH, n, c, height, false);
          if (floor % 3 === 1 && index % 3 === 0) {
            faceRect(r, g, f, left + 2, z + fh * .16, right - 2, z + fh * .2, c.edge, height, 3);
            faceLine(r, g, f, left + 3, z + fh * .3, right - 3, z + fh * .3, c.sill, height, 4);
          }
        } else {
          windowPane(r, g, f, left + 4, winZ, Math.max(3, width - 8), winH, n, c, height, narrow);
          if (type === 'office') rect(width * .48, fh * .08, width * .52, fh * .91, c.sill);
          if (narrow) {
            stroke(3, fh * .1, width - 3, fh * .4, c.rustDim);
            stroke(3, fh * .4, width - 3, fh * .1, c.shadow);
          }
          if (type === 'garden') {
            rect(2, fh * .14, width - 2, fh * .2, c.edge);
            rect(3, fh * .2, width - 3, fh * .26, c.leaf);
            stroke(width * .28, fh * .22, width * .24, fh * .36, c.lime);
            stroke(width * .64, fh * .22, width * .73, fh * .4, c.leaf);
          }
        }
        // Fixed material streaks: no frame-to-frame random noise or flicker.
        if (n > .55) stroke(width - 3, fh * .07, width - 3, fh * .35, c.rustDim);
        if (n < .45) stroke(width * .25, fh * .82, width * .25, fh * .94, c.shadow);
      }
    }
    if (index % 5 === 0) {
      faceRect(r, g, f, left + 1.5, 5, left + 3.2, height, type === 'industrial' ? c.rustDim : c.sill, height, .3);
      if (type === 'office') faceRect(r, g, f, left + 3.2, 7, left + 4, height, c.accentDim, height, .31);
    }
    if (selected) faceLine(r, g, f, left, height, right, height, c.accent, height, .3);
  }
  function facadeSign(r, f, height, fh, b, c, seed) {
    const name = String(b.name || (b.type === 'industrial' ? 'RELAY WORKS' : 'STATIC VEIL')).toUpperCase().replace(/[^A-Z0-9 /.-]/g, '').slice(0, 18);
    const width = Math.min(f.len - 12, 118), z0 = fh * .77, z1 = Math.min(height - 1, fh * .96);
    if (width < 18 || z1 - z0 < 6) return;
    const middle = Math.min(f.len - width * .5 - 6, Math.max(width * .5 + 6, f.len * .5));
    const a = middle - width * .5, b0 = middle + width * .5;
    const bb = bounds([r.w(...facePoint(f, a, z0, 2)), r.w(...facePoint(f, b0, z0, 2)), r.w(...facePoint(f, b0, z1, 2)), r.w(...facePoint(f, a, z1, 2))]);
    if (!visibleBounds(r, bb)) return;
    // Put the entire sign after the facade bays that its physical span covers.
    const qa = facePoint(f, a, 0, 2), qb = facePoint(f, b0, 0, 2);
    const anchor = r.view.order(...qa) > r.view.order(...qb) ? qa : qb;
    r.queue(anchor[0], anchor[1], z0, g => {
      faceRect(r, g, f, a, z0, b0, z1, c.frame, height, 2);
      faceLine(r, g, f, a, z1, b0, z1, c.sill, height, 2.1);
      faceLine(r, g, f, a + 2, z0 + 1, b0 - 2, z0 + 1, c.accentDim, height, 2.1);
      for (let i = 0; i < 4; i++) {
        const u = a + 3 + E.hash2(seed, i + 71) * Math.max(1, width - 9);
        faceRect(r, g, f, u, z0 + 1, u + 2, z0 + 3, c.rust, height, 2.2);
      }
      const point = r.w(...facePoint(f, middle, (z0 + z1) * .5, 2.3));
      const available = Math.abs((f.ux * r.view.ax + f.uy * r.view.ay) * width) - 8;
      const maxChars = Math.floor(available / 4);
      if (maxChars >= 3 && z1 - z0 > 8 && point[1] > 2 && point[1] < r.H - 6) {
        E.font.text(g, name.slice(0, maxChars), point[0], point[1] - 2, c.accent, { font: 'tiny', align: 'center', outline: c.frame, shadow: false });
      }
    }, { solid: true, hides: true, bias: .02, box: bb });
  }
  function building(r, b, context = {}) {
    if (!b || !r || !r.view) return false;
    const x = number(b.x, NaN), y = number(b.y, NaN), w = number(b.w, 0), d = number(b.d, 0);
    const floors = Math.max(0, Math.floor(number(b.floors, 1))), fh = Math.max(1, number(b.floorH, 64));
    if (!Number.isFinite(x + y + w + d) || w <= 0 || d <= 0 || floors <= 0) return false;
    const actual = floors * fh;
    if (!Number.isFinite(actual)) return false;
    const explicit = context.cutHeight !== undefined && context.cutHeight !== null && Number.isFinite(Number(context.cutHeight));
    const height = Math.max(0, Math.min(actual, explicit ? Number(context.cutHeight) : context.fullHeight ? actual : 96));
    if (height <= 0) return false;
    const bb = boxBounds(r, x, y, 0, x + w, y + d, height);
    if (!visibleBounds(r, bb, 14)) return false;
    const type = TYPE_ALIASES[normalize(b.type)] || normalize(b.type) || 'tower', c = colorSet(b, type), seed = seedFor(b);
    const selected = context.selected === true || context.selected === b || (b.id !== undefined && context.selected === b.id);
    const allFaces = [
      { id: 0, x, y, ux: 1, uy: 0, nx: 0, ny: -1, len: w },
      { id: 1, x, y: y + d, ux: 1, uy: 0, nx: 0, ny: 1, len: w },
      { id: 2, x, y, ux: 0, uy: 1, nx: -1, ny: 0, len: d },
      { id: 3, x: x + w, y, ux: 0, uy: 1, nx: 1, ny: 0, len: d }
    ];
    const faces = r.view.isTop ? [] : allFaces.filter(f => f.nx * r.view.fx + f.ny * r.view.fy > .02);
    let queued = false;
    for (const f of faces) {
      const range = faceRange(r, f, height);
      if (!range) continue;
      // Normal bays are 2.5–3m wide. At a near-edge view they coalesce, so the
      // number of queue items follows visible screen pixels instead of metres.
      const baseBay = type === 'industrial' ? 48 : type === 'office' ? 40 : 44;
      const count = Math.max(1, Math.floor(f.len / baseBay)), bay = f.len / count;
      const step = Math.max(1, Math.ceil(6 / Math.max(.001, bay * range.pxPerUnit)));
      const start = Math.max(0, Math.floor(range.u0 / bay / step) * step);
      const end = Math.min(count - 1, Math.floor(range.u1 / bay));
      const stride = Math.max(1, Math.ceil(5 / Math.max(.001, Math.abs(r.view.bz) * fh)));
      for (let col = start; col <= end; col += step) {
        const left = col * bay, right = Math.min(f.len, (col + step) * bay);
        const at = facePoint(f, (left + right) * .5, 0, .02);
        const q = bounds([r.w(...facePoint(f, left, 0)), r.w(...facePoint(f, right, 0)), r.w(...facePoint(f, right, height)), r.w(...facePoint(f, left, height))]);
        if (!visibleBounds(r, q, 12)) continue;
        const localRange = faceRange(r, Object.assign({}, f, { x: f.x + f.ux * left, y: f.y + f.uy * left, len: right - left }), height);
        if (!localRange) continue;
        const first = Math.max(0, Math.floor(localRange.z0 / fh / stride) * stride);
        const last = Math.min(floors - 1, Math.floor(Math.min(height - EPS, localRange.z1) / fh));
        r.queue(at[0], at[1], 0, g => drawBay(r, g, f, left, right, height, fh, first, last, stride, col, seed, type, c, selected),
          { occluder: true, hides: true, box: q, bias: -.005 });
        queued = true;
      }
    }
    // A roof is only a roof at its real elevation. Cut caps have no roof props.
    const roof = height >= actual - EPS;
    const topPts = [[x, y, height], [x + w, y, height], [x + w, y + d, height], [x, y + d, height]];
    const topBounds = bounds(topPts.map(p => r.w(...p)));
    if (visibleBounds(r, topBounds, 3)) {
      const front = topPts.reduce((a, p) => r.view.order(...p) > r.view.order(...a) ? p : a);
      r.queue(front[0], front[1], height, g => {
        worldPoly(r, g, topPts, roof ? c.frame : c.top);
        for (let i = 0; i < 4; i++) line(r, g, topPts[i], topPts[(i + 1) & 3], selected ? c.accent : roof ? c.edge : c.sill);
        if (roof && w > 28 && d > 28) {
          const inset = 5, zz = height + .2;
          const rim = [[x + inset, y + inset, zz], [x + w - inset, y + inset, zz], [x + w - inset, y + d - inset, zz], [x + inset, y + d - inset, zz]];
          for (let i = 0; i < 4; i++) line(r, g, rim[i], rim[(i + 1) & 3], c.shadow);
          line(r, g, [x + w * .2, y + d * .23, zz], [x + w * .76, y + d * .23, zz], c.top);
          line(r, g, [x + w * .76, y + d * .23, zz], [x + w * .76, y + d * .77, zz], c.top);
        }
      }, { occluder: true, box: topBounds, bias: .005 });
      queued = true;
      if (roof && !selected && w >= 96 && d >= 96) {
        const reduced = !!context.reduced;
        // The cap sorts as a single footprint. Its own equipment must follow
        // that cap, even when the equipment's ground position is farther back.
        const capOrder = r.view.order(...front) + .005;
        const roofProp = (type0, u, v) => {
          const xx = x + w * u, yy = y + d * v, zz = actual + .3;
          const bias = Math.max(.01, capOrder - r.view.order(xx, yy, zz) + .02);
          floorProp(r, { type: type0, x: xx, y: yy, z: zz, color: c.accent, reduced, bias }, number(context.time, 0));
        };
        roofProp(type === 'garden' ? 'planter' : 'roofvent', .45, .42);
        roofProp('stairhead', .22, .26);
        if (type === 'industrial' || type === 'tower') roofProp('radio', .7, .64);
      }
    }
    const signFace = faces.slice().sort((a, b0) => Math.abs(b0.ux * r.view.ax + b0.uy * r.view.ay) * b0.len - Math.abs(a.ux * r.view.ax + a.uy * r.view.ay) * a.len)[0];
    if (signFace && height >= fh * .82) facadeSign(r, signFace, height, fh, b, c, seed);
    return queued;
  }
  function brush(r, g, p, c) {
    const s = p.scale, q = p.quarter, co = [1, 0, -1, 0][q], si = [0, 1, 0, -1][q];
    const world = (u, v, z) => [p.x + (u * co - v * si) * s, p.y + (u * si + v * co) * s, p.z + z * s];
    const B = (u0, v0, z0, u1, v1, z1, top = c.top, side = c.side) => {
      const a = world(u0, v0, z0), b = world(u1, v1, z1);
      safeBox(r, g, Math.min(a[0], b[0]), Math.min(a[1], b[1]), a[2], Math.max(a[0], b[0]), Math.max(a[1], b[1]), b[2], top, side);
    };
    const L = (a, b, color = c.edge, width = 1) => line(r, g, world(...a), world(...b), color, Math.max(1, Math.min(3, Math.round(width * s * r.view.scale))));
    const F = (points, color) => worldPoly(r, g, points.map(a => world(...a)), color);
    const dot = (u, v, z, color = c.accent, size = 1) => {
      const a = r.w(...world(u, v, z)), rad = Math.min(8, Math.max(.6, size * s * r.view.scale));
      if (a[0] >= -rad && a[0] <= r.W + rad && a[1] >= -rad && a[1] <= r.H + rad) px.disc(g, a[0], a[1], rad, color);
    };
    const label = (text, u, v, z, color = c.accent, max = 10) => {
      const a = r.w(...world(u, v, z));
      if (a[0] > 8 && a[0] < r.W - 8 && a[1] > 0 && a[1] < r.H - 6 && s * r.view.scale > .7)
        E.font.text(g, String(text).toUpperCase().slice(0, max), a[0], a[1] - 2, color, { font: 'tiny', align: 'center', outline: c.ink, shadow: false });
    };
    return { B, L, F, dot, label };
  }
  function leaves(B, L, F, c, x = 0, y = 0, z = 8, spread = 1) {
    for (let i = 0; i < 5; i++) {
      const u = x + (i - 2) * 5.3 * spread, v = y + (i % 2 ? 2 : -2), h = z + 9 + i % 3 * 3;
      L([u, v, z], [u, v, h], c.leaf);
      F([[u, v, h - 2], [u - 4 * spread, v + 1, h + 4], [u + 1, v, h]], i % 2 ? c.leaf : c.lime);
      F([[u, v, h - 3], [u + 4 * spread, v - 1, h + 1], [u, v, h]], c.leaf);
    }
  }
  function propMesh(r, g, p, type, c, time) {
    const { B, L, F, dot, label } = brush(r, g, p, c);
    const accent = p.active === false ? c.accentDim : c.accent;
    switch (type) {
      case 'desk': case 'officedesk': {
        const wide = type === 'officedesk', x = wide ? 19 : 15;
        B(-x + 2, -6, 0, -x + 6, 6, 14, c.top, c.frame); B(x - 4, -6, 0, x - 1, 6, 14, c.edge, c.frame);
        B(-x, -9, 14, x, 9, 17, c.top, c.side); L([-x, 9, 16], [x, 9, 16], c.edge);
        if (wide) {
          B(-5, -5, 17, 6, 0, 19, c.frame, c.ink); B(-1, -4, 19, 1, -2, 23, c.edge, c.frame);
          B(-9, -5, 22, 9, -3, 31, c.edge, c.frame);
          F([[-8, -2.9, 23], [8, -2.9, 23], [8, -2.9, 30], [-8, -2.9, 30]], c.glass);
          L([-6, -2.8, 28], [3, -2.8, 28], accent); L([-6, -2.8, 26], [-1, -2.8, 26], c.accentDim);
          B(-7, 2, 17, 6, 6, 18, c.edge, c.frame); L([-5, 4, 18.2], [3, 4, 18.2], c.frame);
          B(-5, 13, 0, 5, 19, 2, c.frame, c.ink); B(-1, 13, 2, 1, 17, 8, c.edge, c.frame);
          B(-7, 10, 8, 7, 20, 11, c.top, c.frame); B(-7, 18, 11, 7, 21, 23, c.side, c.frame);
        } else {
          B(-10, 0, 17, -1, 5, 17.6, c.light, c.edge); L([-8, 4, 17.8], [-3, 4, 17.8], c.sill);
          B(7, -5, 17, 11, -1, 18, c.edge, c.frame); L([9, -3, 18], [7, -3, 26], c.edge);
          L([7, -3, 26], [2, -3, 26], c.edge); B(0, -5, 24, 5, -1, 26, c.top, c.frame);
          L([1, -1, 24], [4, -1, 24], c.warm); B(5, 4, 17, 8, 7, 21, c.light, c.side);
        }
        L([-x + 3, 6.1, 10], [-x + 5, 6.1, 10], c.edge); break;
      }
      case 'bed':
        B(-13, -21, 0, 13, 21, 5, c.edge, c.frame); B(-12, -19, 5, 12, 20, 10, c.light, c.sill);
        B(-12, -6, 10, 12, 20, 11.5, c.accentDim, c.side); B(-10, -17, 10, 10, -10, 13, '#c2d2c9', c.sill);
        B(-14, -23, 1, 14, -20, 18, c.top, c.side); L([-11, 15, 11.8], [11, 15, 11.8], c.edge);
        L([-8, -5, 11.8], [-8, 18, 11.8], c.sill); break;
      case 'machine': {
        B(-22, -17, 0, 22, 17, 4, c.edge, c.frame); B(-19, -14, 4, 19, 14, 28, c.top, c.side);
        B(-20, -15, 28, 20, 15, 31, c.edge, c.frame); B(6, -8, 31, 16, 6, 37, c.top, c.side);
        for (let i = 0; i < 6; i++) L([-16 + i * 4.5, 14.1, 7], [-16 + i * 4.5, 14.1, 24], c.frame);
        for (let i = 0; i < 5; i++) F([[-18 + i * 7, 17.1, 1], [-14 + i * 7, 17.1, 1], [-10 + i * 7, 17.1, 4], [-14 + i * 7, 17.1, 4]], i % 2 ? c.frame : c.warm);
        B(-15, -10, 31, -1, 1, 33, c.frame, c.ink); L([-13, 0, 33.1], [-5, 0, 33.1], accent);
        L([-22, -5, 5], [-22, -5, 38], c.rust, 2); L([-22, -5, 38], [-9, -5, 38], c.rust, 2);
        B(-3, -9, 31, 2, -5, 40, c.edge, c.frame); dot(-.5, -4.8, 37, accent);
        const ring = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ring.push([19.2, Math.cos(a) * 8, 17 + Math.sin(a) * 8]); }
        F(ring, c.frame); L([19.4, -6, 17], [19.4, 6, 17], c.edge); L([19.4, 0, 11], [19.4, 0, 23], c.edge); break;
      }
      case 'planter':
        B(-19, -10, 0, 19, 10, 8, c.edge, c.side); B(-17, -8, 8, 17, 8, 9, c.ink, c.frame);
        leaves(B, L, F, c); L([-17, 10.1, 3], [17, 10.1, 3], c.frame); break;
      case 'roofvent':
        B(-15, -12, 0, 15, 12, 3, c.edge, c.frame); B(-13, -10, 3, 13, 10, 13, c.top, c.side);
        B(-15, -12, 13, 15, 12, 15, c.edge, c.frame);
        for (let i = 0; i < 6; i++) L([-11 + i * 4.4, -8, 15.1], [-11 + i * 4.4, 8, 15.1], c.frame);
        for (let i = 0; i < 3; i++) L([-11, 10.1, 5 + i * 2.6], [11, 10.1, 5 + i * 2.6], c.shadow);
        break;
      case 'stairhead': case 'lifthead': {
        const lift = type === 'lifthead', d = lift ? 17 : 22, h = lift ? 39 : 35;
        B(-17, -d, 0, 17, d, h, c.top, c.side); B(-18, -d - 1, h, 18, d + 1, h + 3, c.edge, c.frame);
        B(-11, d, 0, 11, d + 1, 29, c.edge, c.frame);
        F([[-9, d + 1.2, 1], [9, d + 1.2, 1], [9, d + 1.2, 27], [-9, d + 1.2, 27]], c.shadow);
        L([0, d + 1.4, 1], [0, d + 1.4, 27], c.frame); L([-8, d + 1.4, 31], [8, d + 1.4, 31], accent);
        dot(12, d + 1.3, 17, accent); B(-11, -9, h + 3, 9, 7, h + (lift ? 9 : 6), c.top, c.side);
        for (let i = 0; i < 3; i++) L([-9 + i * 7, -7, h + (lift ? 9.2 : 6.2)], [-9 + i * 7, 5, h + (lift ? 9.2 : 6.2)], c.frame);
        if (!lift) { L([-13, d + 1.4, 11], [-13, d + 1.4, 26], c.warm); L([-15, d + 1.4, 23], [-13, d + 1.4, 26], c.warm); }
        break;
      }
      case 'radio': {
        B(-10, -10, 0, 10, 10, 4, c.edge, c.frame); B(-2, -2, 4, 2, 2, 67, c.edge, c.side);
        for (const h of [20, 39, 58]) { L([-11, 0, h], [11, 0, h], c.edge, 1.2); L([-11, 0, h - 6], [-11, 0, h + 6], c.sill); L([11, 0, h - 6], [11, 0, h + 6], c.sill); }
        for (const a of [[-17, -17, 0], [17, 17, 0], [-17, 17, 0]]) L(a, [0, 0, 47], c.sill);
        L([0, 0, 67], [0, 0, 76], c.light);
        B(4, -3, 5, 11, 4, 15, c.top, c.side); L([7, 4.1, 8], [7, 4.1, 12], accent);
        dot(0, 0, 72, p.reduced || Math.sin(time * 2 + p.x) > -.3 ? c.warm : c.rust, 1);
        break;
      }
      case 'lamp':
        B(-5, -5, 0, 5, 5, 4, c.edge, c.frame); B(-1.5, -1.5, 4, 1.5, 1.5, 76, c.top, c.side);
        L([0, 0, 76], [0, 18, 76], c.edge, 2); B(-7, 13, 73, 7, 23, 77, c.top, c.frame);
        F([[-6, 14, 72.9], [6, 14, 72.9], [6, 22, 72.9], [-6, 22, 72.9]], p.active === false ? c.glass : c.warm);
        L([-5, 22, 73], [5, 22, 73], p.active === false ? c.edge : '#e6d7ad'); break;
      case 'bollard':
        B(-4, -4, 0, 4, 4, 3, c.edge, c.frame); B(-2.5, -2.5, 3, 2.5, 2.5, 16, c.top, c.side);
        B(-3, -3, 12, 3, 3, 14, accent, c.accentDim); break;
      case 'bench':
        for (const x of [-16, 14]) B(x, -5, 0, x + 3, 6, 8, c.edge, c.frame);
        for (let i = 0; i < 3; i++) B(-22, -6 + i * 4, 8, 22, -3 + i * 4, 10, c.sill, c.side);
        B(-19, -8, 0, -16, -6, 20, c.edge, c.frame); B(16, -8, 0, 19, -6, 20, c.edge, c.frame);
        B(-22, -9, 14, 22, -6, 19, c.top, c.side); L([-21, -5.8, 17], [21, -5.8, 17], c.edge); break;
      case 'kiosk':
        B(-14, -11, 0, 14, 11, 3, c.edge, c.frame); B(-12, -9, 3, 12, 9, 38, c.top, c.side);
        B(-14, -11, 38, 14, 11, 41, c.edge, c.frame);
        F([[-9, 9.1, 12], [5, 9.1, 12], [5, 9.1, 32], [-9, 9.1, 32]], c.glass);
        for (let i = 0; i < 3; i++) {
          L([-7, 9.3, 17 + i * 6], [3, 9.3, 17 + i * 6], i % 2 ? c.warm : accent);
          dot(8, 9.3, 20 + i * 4, i === 0 ? accent : c.edge, .7);
        }
        B(-8, 9, 5, 7, 10, 10, c.frame, c.ink); label(p.label || 'LINK', 0, 9.4, 35, accent, 6); break;
      case 'stall':
        for (const x of [-22, 22]) for (const y of [-16, 16]) B(x - 1, y - 1, 0, x + 1, y + 1, 36, c.edge, c.frame);
        B(-23, -14, 0, 23, 14, 13, c.top, c.side); B(-25, -17, 13, 25, 17, 15, c.edge, c.frame);
        for (let i = 0; i < 6; i++) {
          const x = -26 + i * 52 / 6;
          F([[x, -20, 35], [x + 52 / 6, -20, 35], [x + 52 / 6, 0, 41], [x, 0, 41]], i % 2 ? c.top : c.accentDim);
          F([[x, 0, 41], [x + 52 / 6, 0, 41], [x + 52 / 6, 20, 35], [x, 20, 35]], i % 2 ? c.warm : c.accentDim);
        }
        for (let i = 0; i < 5; i++) B(-21 + i * 9, -2, 15, -15 + i * 9, 9, 19 + i % 2 * 2, i % 2 ? c.leaf : c.warm, c.side);
        L([-26, 20, 34], [26, 20, 34], c.edge); dot(0, 15, 31, c.warm); break;
      case 'bin':
        B(-7, -7, 0, 7, 7, 15, c.top, c.side); B(-8, -8, 15, 8, 8, 18, c.edge, c.frame);
        B(-4, -3, 18, 4, 3, 18.4, c.frame, c.ink);
        for (const x of [-4, 0, 4]) L([x, 7.1, 3], [x, 7.1, 13], c.shadow); break;
      case 'barrier':
        B(-24, -7, 0, 24, 7, 4, c.edge, c.side); B(-21, -4, 4, 21, 4, 17, c.top, c.side);
        for (let i = 0; i < 6; i++) F([[-20 + i * 6.5, 4.1, 8], [-17 + i * 6.5, 4.1, 8], [-12 + i * 6.5, 4.1, 15], [-15 + i * 6.5, 4.1, 15]], i % 2 ? c.warm : c.frame);
        for (const x of [-16, 16]) dot(x, 0, 19, c.warm, .9); break;
      case 'hydrant':
        B(-7, -7, 0, 7, 7, 3, c.edge, c.frame); B(-4, -4, 3, 4, 4, 16, c.rust, c.side);
        B(-10, -2, 10, 10, 2, 14, c.edge, c.rust); B(-5, -5, 16, 5, 5, 19, c.sill, c.rust);
        B(-2, -2, 19, 2, 2, 21, c.edge, c.side); break;
      case 'tree':
        B(-17, -17, 0, 17, 17, 7, c.edge, c.side); B(-15, -15, 7, 15, 15, 8, c.ink, c.frame);
        B(-2, -2, 8, 2, 2, 34, c.rust, c.side);
        L([0, 0, 23], [-9, -6, 41], c.sill, 2); L([0, 0, 28], [9, 6, 48], c.sill, 2);
        B(-19, -15, 34, 4, 7, 46, c.leaf, '#29493f');
        B(-7, -9, 43, 17, 15, 55, '#6c9066', c.leaf);
        B(-10, -7, 52, 7, 9, 61, c.leaf, '#355b49'); break;
      case 'cable':
        for (const [a, b] of [[[-28, 0, 1], [-14, 0, 1]], [[-14, 0, 1], [-8, 14, 1]], [[-8, 14, 1], [13, 14, 1]], [[13, 14, 1], [19, -6, 1]], [[19, -6, 1], [28, -6, 1]]]) { L(a, b, c.ink, 2); L([a[0], a[1], 1.2], [b[0], b[1], 1.2], c.sill); }
        break;
      case 'sofa':
        B(-22, -13, 0, 22, 13, 5, c.frame, c.ink); B(-21, -12, 5, 21, 12, 11, c.top, c.side);
        B(-23, -14, 7, 23, -10, 22, c.sill, c.side); B(-23, -10, 7, -18, 14, 17, c.top, c.side); B(18, -10, 7, 23, 14, 17, c.top, c.side);
        L([0, -8, 11.1], [0, 11, 11.1], c.frame); break;
      case 'shelf':
        B(-18, -9, 0, 18, -6, 38, c.top, c.side);
        for (const x of [-18, 16]) B(x, -8, 0, x + 2, 9, 38, c.edge, c.frame);
        for (let i = 0; i < 4; i++) {
          B(-17, -8, i * 11, 17, 9, i * 11 + 2, c.edge, c.side);
          if (i < 3) { B(-14, -5, i * 11 + 2, -3, 6, i * 11 + 8, c.top, c.shadow); B(2, -3, i * 11 + 2, 13, 7, i * 11 + 10, i % 2 ? c.sill : c.rustDim, c.side); }
        }
        break;
      default:
        B(-11, -11, 0, 11, 11, 17, c.top, c.side); B(-12, -12, 17, 12, 12, 19, c.edge, c.frame);
        for (const x of [-7, 7]) L([x, 11.1, 2], [x, 11.1, 16], c.frame);
        L([-10, -10, 19.1], [10, 10, 19.1], c.shadow); break;
    }
  }
  function normalizeProp(p, fallback) {
    const raw = normalize(p.type || p.kind || fallback), type = PROP_ALIASES[raw] || raw;
    const orientation = p.orientation === 'y' ? 1 : number(p.orientation, 0);
    return Object.assign({}, p, { type, x: number(p.x, 0), y: number(p.y, 0), z: number(p.z, 0),
      scale: Math.max(.25, Math.min(4, number(p.scale, 1))),
      quarter: ((Math.round(orientation) % 4) + 4) % 4,
      reduced: !!(p.reduced || p.reducedMotion) });
  }
  function drawLocalProp(r, input, time, fallback) {
    if (!input) return false;
    const p = normalizeProp(input, fallback), type = PROP_BOUNDS[p.type] ? p.type : 'crate';
    const extent = PROP_BOUNDS[type], sw = p.quarter % 2 ? extent[1] : extent[0], sd = p.quarter % 2 ? extent[0] : extent[1];
    const bb = boxBounds(r, p.x - sw * p.scale, p.y - sd * p.scale, p.z, p.x + sw * p.scale, p.y + sd * p.scale, p.z + extent[2] * p.scale);
    if (!visibleBounds(r, bb, 3)) return false;
    const c = colorSet({ palette: input.palette, accent: input.color || input.accent }, type === 'planter' || type === 'tree' ? 'garden' : 'tower');
    const t = p.reduced ? 0 : number(time, 0);
    r.queue(p.x, p.y, p.z, g => propMesh(r, g, p, type, c, t),
      { solid: true, hides: true, box: bb, bias: number(p.bias, .01) });
    return true;
  }
  function floorProp(r, p, time = 0) { return drawLocalProp(r, p, time, 'desk'); }
  function streetProp(r, p, time = 0) {
    if (!p) return false;
    const type = normalize(p.type || p.kind || 'bollard');
    if (root.VeilArt && typeof root.VeilArt.drawProp === 'function' && ['pylon', 'sign', 'vent', 'dish', 'console', 'server', 'transformer', 'camera'].includes(type)) {
      // Copy options and explicitly turn lights off; never mutate a caller prop.
      return root.VeilArt.drawProp(r, Object.assign({}, p, { type, light: false, reducedMotion: !!(p.reduced || p.reducedMotion) }), number(time, 0));
    }
    return drawLocalProp(r, p, time, 'bollard');
  }
  root.CityArt = Object.freeze({
    building, streetProp, floorProp, version: '1.0.0',
    colors: C, palettes: PALETTES,
    buildingTypes: Object.freeze(['tower', 'industrial', 'residential', 'office', 'garden', 'market']),
    floorTypes: Object.freeze(['apartment-desk', 'apartment-bed', 'office-desk', 'industrial-machine', 'garden-planter', 'roof-vent', 'stairhead', 'lifthead', 'radio', 'sofa', 'shelf', 'crate']),
    streetTypes: Object.freeze(['lamp', 'bollard', 'bench', 'kiosk', 'market-stall', 'bin', 'barrier', 'hydrant', 'planter', 'tree', 'cable', 'pylon', 'sign', 'vent'])
  });
})(typeof window !== 'undefined' ? window : globalThis);
