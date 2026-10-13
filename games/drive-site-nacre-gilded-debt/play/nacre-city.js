/* Nacre city generator. Metres are the only geometry unit in this module.
 * A small reproducible spec, a connected street graph, and lazy 100 m chunks.
 * No engine map or browser is required. Original implementation, 2026.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.NacreCity = api; if (root.My3D2dge) root.My3D2dge.NacreCity = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0', SIZE = 3000, CHUNK = 100, AREA = 10000000, UNITS = 20;
  const SIDE = Math.sqrt(AREA), MARGIN = (SIDE - SIZE) / 2, EPS = 1e-8;
  const DEFAULT_PROFILES = [
  {"id":"bell-heights","name":"Bell Heights","row":0,"col":0,"form":"Terraced old town","description":"Compact limestone terraces, stepped roof gardens and a patinated belfry above the old lanes.","coverage":0.58,"footprint":[10,22,12,26],"height":[8,22],"streetWidth":[4,7],"kinds":["terrace","tenement"],"roofs":["flat","garden"],"landmark":{"kind":"belfry","name":"The Ninth Bell","w":18,"d":18,"h":48},"palette":{"ground":"#b3a88b","road":"#c8bba0","wall":"#d2c4a3","shadow":"#798982","trim":"#ead8af","roof":"#7e9a87","roofDark":"#4d736d","accent":"#b8985f","cloth":"#344963","window":"#30444a","wood":"#79694e","green":"#748661","water":"#386f73"}},
  {"id":"salt-market","name":"Salt Market","row":0,"col":1,"form":"Dense market lanes","description":"Small plaster shops, crowded rooftop additions and striped awnings around a long covered salt hall.","coverage":0.74,"footprint":[7,15,9,21],"height":[5,14],"streetWidth":[3,6],"kinds":["shop","tenement","arcade"],"roofs":["terracotta","flat"],"landmark":{"kind":"market-hall","name":"The Salt Hall","w":46,"d":30,"h":19},"palette":{"ground":"#b5a17d","road":"#c5b48d","wall":"#c6a16f","shadow":"#887b68","trim":"#ead3a3","roof":"#b77751","roofDark":"#865947","accent":"#d3aa54","cloth":"#b98a42","window":"#344445","wood":"#806243","green":"#717c51","water":"#396e6e"}},
  {"id":"levy-court","name":"Levy Court","row":0,"col":2,"form":"Formal civic precinct","description":"Wide stone avenues, measured palace fronts and burgundy standards before the treasury court.","coverage":0.44,"footprint":[24,48,22,44],"height":[12,27],"streetWidth":[12,20],"kinds":["palace","courtyard"],"roofs":["copper","flat"],"landmark":{"kind":"levy-palace","name":"The Ledger Palace","w":76,"d":54,"h":35},"palette":{"ground":"#bdb7a4","road":"#d0c9b4","wall":"#d8ccae","shadow":"#8b9690","trim":"#ecdebc","roof":"#a48164","roofDark":"#716c61","accent":"#b39755","cloth":"#763d49","window":"#3c4a51","wood":"#75614c","green":"#708369","water":"#427779"}},
  {"id":"scribes-ward","name":"Scribes’ Ward","row":1,"col":0,"form":"Courts and cloisters","description":"Ivory print houses with indigo shutters, slate roofs and enclosed reading courts around a lantern-topped archive.","coverage":0.54,"footprint":[15,29,17,34],"height":[8,18],"streetWidth":[5,9],"kinds":["courtyard","tenement"],"roofs":["slate","garden"],"landmark":{"kind":"scriptorium","name":"The Lantern Archive","w":45,"d":42,"h":28},"palette":{"ground":"#aaa994","road":"#c2bd9f","wall":"#d4cfb4","shadow":"#87958f","trim":"#e6ddbe","roof":"#657883","roofDark":"#425866","accent":"#b89962","cloth":"#405874","window":"#314552","wood":"#807052","green":"#6d8062","water":"#3a737a"}},
  {"id":"grand-exchange","name":"Grand Exchange","row":1,"col":1,"form":"Arcades and open square","description":"Copper-roofed merchant arcades face a broad exchange square, with a faceted dome at its heart.","coverage":0.58,"footprint":[18,34,18,36],"height":[10,24],"streetWidth":[10,18],"kinds":["arcade","shop","courtyard"],"roofs":["copper","vaulted"],"landmark":{"kind":"exchange-dome","name":"The Gilded Exchange","w":42,"d":42,"h":38},"palette":{"ground":"#b8ab8d","road":"#d1c29f","wall":"#cfb78f","shadow":"#879287","trim":"#eed8ac","roof":"#b9875e","roofDark":"#81664e","accent":"#c4a35b","cloth":"#34536b","window":"#354952","wood":"#866b48","green":"#718562","water":"#3e777b"}},
  {"id":"glassworks","name":"Glassworks","row":1,"col":2,"form":"Workshops and furnace yards","description":"Low sawtooth sheds, glazed teal roofs, tall chimneys and soot-marked kiln courts beside the working canals.","coverage":0.43,"footprint":[18,38,15,30],"height":[5,15],"streetWidth":[8,13],"kinds":["workshop","kiln"],"roofs":["sawtooth","terracotta"],"landmark":{"kind":"glass-furnace","name":"The Green Furnace","w":40,"d":28,"h":26},"palette":{"ground":"#8e9283","road":"#adb09b","wall":"#a7ad98","shadow":"#626f6c","trim":"#c8c5a6","roof":"#53877f","roofDark":"#365f60","accent":"#bf925b","cloth":"#40776f","window":"#2f4c53","wood":"#6c5f49","green":"#68785b","water":"#32686c"}},
  {"id":"south-quay","name":"South Quay","row":2,"col":0,"form":"Harbor sheds and piers","description":"Long timber warehouses, cargo yards and salt-worn quays lead toward a striped harbor light.","coverage":0.39,"footprint":[14,25,30,56],"height":[6,15],"streetWidth":[10,16],"kinds":["warehouse","workshop"],"roofs":["timber","terracotta"],"landmark":{"kind":"lighthouse","name":"The Western Light","w":15,"d":15,"h":52},"palette":{"ground":"#9f9d89","road":"#b7b29a","wall":"#b7b4a0","shadow":"#72857f","trim":"#d2c7a7","roof":"#8e7455","roofDark":"#605849","accent":"#b99459","cloth":"#4d677a","window":"#31474c","wood":"#8d7350","green":"#667b65","water":"#326a73"}},
  {"id":"dye-canals","name":"Dye Canals","row":2,"col":1,"form":"Canals and narrow weavers’ plots","description":"Tall thin weavers’ houses, indigo drying cloth and connected vats line the teal water lanes.","coverage":0.55,"footprint":[9,17,22,42],"height":[7,18],"streetWidth":[5,9],"kinds":["weaver","workshop"],"roofs":["terracotta","flat"],"landmark":{"kind":"dye-vats","name":"The Indigo Courts","w":42,"d":32,"h":8},"palette":{"ground":"#afa58d","road":"#c6b89c","wall":"#cec3a5","shadow":"#81948c","trim":"#e3d1ad","roof":"#aa7158","roofDark":"#795449","accent":"#b99156","cloth":"#39466f","window":"#344751","wood":"#877054","green":"#728264","water":"#397b7c"}},
  {"id":"salt-gardens","name":"Salt Gardens","row":2,"col":2,"form":"Basins and garden compounds","description":"Open chalk paths, low courtyard houses, olive-green gardens and pale salt pans beneath a wind-driven cistern.","coverage":0.24,"footprint":[9,19,10,23],"height":[3,10],"streetWidth":[6,10],"kinds":["garden-house","utility"],"roofs":["flat","garden"],"landmark":{"kind":"windmill","name":"The Salt Windmill","w":18,"d":18,"h":24},"palette":{"ground":"#c0b99d","road":"#d6cfb4","wall":"#ded7b9","shadow":"#959e87","trim":"#ece0bd","roof":"#b8b395","roofDark":"#8c997d","accent":"#baa566","cloth":"#89926b","window":"#435654","wood":"#95815c","green":"#7e9168","water":"#719b93"}}
];
  const LAYERS = ['buildings', 'roads', 'water', 'props', 'plazas', 'landmarks'];
  const BUILDING_KINDS = new Set(DEFAULT_PROFILES.flatMap(p => p.kinds));
  const ROOF_KINDS = new Set(DEFAULT_PROFILES.flatMap(p => p.roofs));
  const LANDMARK_KINDS = new Set(DEFAULT_PROFILES.map(p => p.landmark.kind));
  const PALETTE_KEYS = Object.keys(DEFAULT_PROFILES[0].palette);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const copy = o => JSON.parse(JSON.stringify(o));
  const finite = (n, label) => { if (!Number.isFinite(n)) throw new TypeError(label + ' must be a finite number'); return n; };
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }
  const MOVEMENT = deepFreeze({ walkUnitsPerSecond: 54, sprintUnitsPerSecond: 107, crouchUnitsPerSecond: 32, walkMps: 54 / UNITS, sprintMps: 107 / UNITS, crouchMps: 32 / UNITS });
  function checkFiniteTree(value, label) { if (typeof value === 'number') finite(value, label); else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) checkFiniteTree(child, label + '.' + key); }
  function hash(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); return (h ^ h >>> 16) >>> 0; }
  function random(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const range = (r, a, b) => a + (b - a) * r();
  const pick = (r, values) => values[Math.floor(r() * values.length)];
  const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const intersects = (a, b) => a.x <= b.x + b.w + EPS && a.x + a.w >= b.x - EPS && a.y <= b.y + b.d + EPS && a.y + a.d >= b.y - EPS;
  const contains = (b, x, y, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.d + pad;
  const expand = (b, p) => ({ x: b.x - p, y: b.y - p, w: b.w + p * 2, d: b.d + p * 2 });
  const boundsOf = (a, b, p = 0) => ({ x: Math.min(a.x, b.x) - p, y: Math.min(a.y, b.y) - p, w: Math.abs(a.x - b.x) + p * 2, d: Math.abs(a.y - b.y) + p * 2 });
  function queryBounds(b) {
    if (!b || typeof b !== 'object') throw new TypeError('bounds must be an object');
    const out = b.x !== undefined ? { x: b.x, y: b.y, w: b.w, d: b.d === undefined ? b.h : b.d } : { x: b.minX, y: b.minY, w: b.maxX - b.minX, d: b.maxY - b.minY };
    for (const [key, n] of Object.entries(out)) finite(n, 'bounds.' + key);
    if (out.w < 0 || out.d < 0) throw new RangeError('bounds dimensions must be non-negative');
    return out;
  }
  function point(p, label) { if (!p || typeof p !== 'object') throw new TypeError(label + ' must be a point'); return { x: finite(p.x, label + '.x'), y: finite(p.y, label + '.y') }; }
  function closest(a, b, p) { const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); return { x: a.x + dx * t, y: a.y + dy * t, t }; }
  function segmentRect(a, b, box) {
    let lo = 0, hi = 1; const dx = b.x - a.x, dy = b.y - a.y;
    for (const [p, q] of [[-dx, a.x - box.x], [dx, box.x + box.w - a.x], [-dy, a.y - box.y], [dy, box.y + box.d - a.y]]) {
      if (Math.abs(p) < EPS) { if (q < 0) return null; }
      else { const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return null; }
    }
    return [lo, hi];
  }
  const onRoad = (road, x, y, inset = 0) => pointDistance({ x, y }, closest(road.points[0], road.points[1], { x, y })) <= Math.max(0, road.width * .5 - inset) + EPS;
  function circleRect(x, y, radius, b) { const dx = x - clamp(x, b.x, b.x + b.w), dy = y - clamp(y, b.y, b.y + b.d); return dx * dx + dy * dy < radius * radius + EPS; }
  function emptyChunk(cx, cy) { const o = { id: cx + ',' + cy, cx, cy, bounds: { x: cx * CHUNK, y: cy * CHUNK, w: CHUNK, d: CHUNK } }; for (const key of LAYERS) o[key] = []; return o; }

  function makeSpec(options = {}) {
    if (typeof options === 'string' || typeof options === 'number') options = { seed: options };
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('city options must be an object');
    checkFiniteTree(options, 'spec');
    const fixed = { schema: 'nacre-city', version: 1, generatorVersion: VERSION, unitsPerMetre: UNITS, districtSizeM: 1000, rows: 3, cols: 3, footprintAreaM2: AREA, chunkSizeM: CHUNK };
    for (const [key, value] of Object.entries(fixed)) if (options[key] !== undefined && options[key] !== value) throw new RangeError('unsupported ' + key);
    const seed = options.seed === undefined ? '7421' : options.seed;
    if (!['string', 'number'].includes(typeof seed) || !String(seed).trim().length || String(seed).trim().length > 160) throw new TypeError('seed must be a non-empty string or number');
    const density = options.density === undefined ? 1 : options.density;
    if (![.75, 1, 1.25].includes(density)) throw new RangeError('density must be 0.75, 1, or 1.25');
    if (options.layout !== undefined && options.layout !== 'legacy' && options.layout !== 'lived-in') throw new RangeError('unsupported city layout');
    const limit = options.chunkCacheLimit === undefined ? 64 : options.chunkCacheLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 512) throw new RangeError('chunkCacheLimit must be an integer from 1 to 512');
    const profiles = copy(options.profiles === undefined ? DEFAULT_PROFILES : options.profiles);
    if (!Array.isArray(profiles) || profiles.length !== 9) throw new RangeError('nine district profiles are required');
    profiles.forEach((p, i) => {
      if (!p || typeof p !== 'object' || Array.isArray(p)) throw new TypeError('each district profile must be an object');
      if (p.id !== DEFAULT_PROFILES[i].id || p.row !== Math.floor(i / 3) || p.col !== i % 3) throw new RangeError('district IDs and grid order are fixed');
      for (const k of ['name', 'form', 'description']) if (typeof p[k] !== 'string' || !p[k].trim() || p[k].length > 1000) throw new TypeError('invalid district ' + k);
      if (!(p.coverage > 0 && p.coverage <= 1)) throw new RangeError('coverage must be greater than zero and at most one');
      for (const [key, length, minimum, maximum] of [['footprint', 4, 2, 80], ['height', 2, 1, 80], ['streetWidth', 2, .8, 24]]) {
        if (!Array.isArray(p[key]) || p[key].length !== length || p[key].some(n => !Number.isFinite(n) || n < minimum || n > maximum)) throw new RangeError('invalid ' + key + ' range');
        for (let q = 0; q < length; q += 2) if (p[key][q] > p[key][q + 1]) throw new RangeError(key + ' range must increase');
      }
      for (const [key, allowed] of [['kinds', BUILDING_KINDS], ['roofs', ROOF_KINDS]]) if (!Array.isArray(p[key]) || !p[key].length || p[key].length > 32 || p[key].some(x => typeof x !== 'string' || !allowed.has(x))) throw new TypeError('unsupported ' + key);
      if (!p.landmark || typeof p.landmark !== 'object' || Array.isArray(p.landmark)) throw new TypeError('landmark must be an object');
      if (typeof p.landmark.name !== 'string' || !p.landmark.name.trim() || p.landmark.name.length > 160) throw new TypeError('landmark name must be a non-empty string');
      if (typeof p.landmark.kind !== 'string' || !LANDMARK_KINDS.has(p.landmark.kind)) throw new TypeError('unsupported landmark kind');
      if (!['w', 'd', 'h'].every(k => Number.isFinite(p.landmark[k]) && p.landmark[k] >= (k === 'h' ? 1 : 2) && p.landmark[k] <= (k === 'h' ? 80 : 78))) throw new RangeError('invalid landmark size');
      if (!p.palette || typeof p.palette !== 'object' || Array.isArray(p.palette) || PALETTE_KEYS.some(k => !Object.prototype.hasOwnProperty.call(p.palette, k)) || Object.values(p.palette).some(x => typeof x !== 'string' || !/^#[0-9a-f]{6}$/i.test(x))) throw new TypeError('palette requires all district colors as six-digit hex strings');
    });
    return { ...fixed, seed: String(seed).trim(), density, chunkCacheLimit: limit, profiles, ...(options.layout === 'lived-in' ? { layout: 'lived-in' } : {}) };
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(v) { const a = this.items; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= v.cost) break; a[i] = a[p]; i = p; } a[i] = v; }
    pop() { const a = this.items, out = a[0], last = a.pop(); if (a.length) { let i = 0; while (true) { let child = i * 2 + 1; if (child >= a.length) break; if (child + 1 < a.length && a[child + 1].cost < a[child].cost) child++; if (a[child].cost >= last.cost) break; a[i] = a[child]; i = child; } a[i] = last; } return out; }
    get length() { return this.items.length; }
  }

  class City {
    constructor(options) {
      this.spec = deepFreeze(makeSpec(options)); this.unitsPerMetre = UNITS; this.chunkSizeM = CHUNK; this.movement = MOVEMENT;
      this.bounds = deepFreeze({ x: -MARGIN, y: -MARGIN, w: SIDE, d: SIDE });
      this.urbanBounds = deepFreeze({ x: 0, y: 0, w: SIZE, d: SIZE });
      this._cache = new Map(); this._hits = 0; this._misses = 0; this._ever = new Set(); this._overviewSummary = null;
      this.districts = this.spec.profiles.map((p, i) => ({ id: p.id, name: p.name, row: p.row, col: p.col, areaM2: 1000000,
        bounds: { x: p.col * 1000, y: p.row * 1000, w: 1000, d: 1000 }, center: { x: p.col * 1000 + 500, y: p.row * 1000 + 500 },
        arrival: { x: p.col * 1000 + 450, y: p.row * 1000 + 448 + p.landmark.d / 2, z: 0 }, landmarkId: 'landmark:' + p.id, profile: p }));
      this.landmarks = this.districts.map(d => ({ id: d.landmarkId, x: d.bounds.x + 445 - d.profile.landmark.w / 2, y: d.bounds.y + 445 - d.profile.landmark.d / 2,
        w: d.profile.landmark.w, d: d.profile.landmark.d, h: d.profile.landmark.h, z: 0, districtId: d.id, kind: d.profile.landmark.kind,
        name: d.profile.landmark.name, roof: d.profile.roofs[0], seed: hash(this.spec.seed + ':' + d.id + ':landmark'), isLandmark: true, climb: false }));
      this._plazas = this.districts.map(d => ({ id: 'plaza:' + d.id, x: d.bounds.x + 397, y: d.bounds.y + 397, w: 96, d: 96, z: 0, districtId: d.id, kind: 'civic-square' }));
      this._outerWater = [
        { id: 'water:outer-east', x: SIZE + MARGIN * .7, y: -MARGIN, w: MARGIN * .3, d: SIDE, z: -.2, districtId: 'perimeter', kind: 'sea' },
        { id: 'water:outer-south', x: -MARGIN, y: SIZE + MARGIN * .7, w: SIZE + MARGIN * 1.7, d: MARGIN * .3, z: -.2, districtId: 'perimeter', kind: 'sea' }
      ];
      this.graph = { nodes: [], edges: [] }; this.roads = []; this._nodeMap = new Map(); this._adj = new Map(); this._roadIndex = new Map(); this._roadById = new Map();
      this._buildGraph();
      this._indexRoads();
      deepFreeze(this.districts); deepFreeze(this.landmarks); deepFreeze(this.roads); deepFreeze(this.graph);
    }

    exportSpec() { return copy(this.spec); }
    // Missions retain their historical seed/recipe identity across visual layouts.
    missionSpec() { const spec = this.exportSpec(); delete spec.layout; return spec; }
    get stats() { return { cachedChunks: this._cache.size, cacheLimit: this.spec.chunkCacheLimit, cacheHits: this._hits, cacheMisses: this._misses, generatedChunks: this._misses, uniqueChunks: this._ever.size, roadNodes: this.graph.nodes.length, roadEdges: this.graph.edges.length, ...(this._overviewSummary || {}) }; }
    cacheStats() { return { size: this._cache.size, limit: this.spec.chunkCacheLimit, hits: this._hits, misses: this._misses }; }
    clearCache() { this._cache.clear(); }
    districtAt(x, y) { finite(x, 'x'); finite(y, 'y'); if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null; return this.districts[Math.floor(y / 1000) * 3 + Math.floor(x / 1000)]; }
    _key(cx, cy) { return cx + ',' + cy; }
    _node(id, x, y) { const d = this.districtAt(clamp(x, 0, SIZE - EPS), clamp(y, 0, SIZE - EPS)), n = { id, x, y, districtId: contains(this.urbanBounds, x, y) ? d.id : 'perimeter' }; this.graph.nodes.push(n); this._nodeMap.set(id, n); this._adj.set(id, []); return n; }
    _link(a, b, width, roadClass) {
      const A = this._nodeMap.get(a), B = this._nodeMap.get(b), id = 'road:' + a + '>' + b, mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, district = this.districtAt(mid.x, mid.y);
      const box = boundsOf(A, B, width / 2), road = { id, points: [{ x: A.x, y: A.y }, { x: B.x, y: B.y }], width, class: roadClass, districtId: district ? district.id : 'perimeter', a, b, ...box, bounds: box, bridge: false, bridgeSpans: [] };
      const edge = { id: 'edge:' + a + '>' + b, a, b, lengthM: pointDistance(A, B), roadId: id };
      this.roads.push(road); this._roadById.set(id, road); this.graph.edges.push(edge); this._adj.get(a).push({ id: b, edge }); this._adj.get(b).push({ id: a, edge });
    }
    _buildGraph() {
      const jitterByDistrict = [8, 9, 0, 4, 2, 3, 1, 2, 4];
      for (let gy = 0; gy <= 30; gy++) for (let gx = 0; gx <= 30; gx++) {
        const p = this.districtAt(Math.min(SIZE - EPS, gx * 100 + .01), Math.min(SIZE - EPS, gy * 100 + .01)), r = random(hash(this.spec.seed + ':node:' + gx + ':' + gy)), j = jitterByDistrict[p.row * 3 + p.col];
        let x = gx * 100 + (gx % 5 ? range(r, -j, j) : 0), y = gy * 100 + (gy % 5 ? range(r, -j, j) : 0);
        const lx = gx % 10, ly = gy % 10;
        if (lx === 4 && (ly === 4 || ly === 5)) x = gx * 100 - 10;
        if (ly === 4 && (lx === 4 || lx === 5)) y = gy * 100 - 10;
        this._node('n:' + gx + ':' + gy, x, y);
      }
      const streetWidth = (gx, gy, horizontal) => {
        const axis = horizontal ? gy : gx;
        const lived = this.spec.layout === 'lived-in';
        if (axis % 10 === 0) return [lived ? 14 : 26, 'district-avenue'];
        if (axis % 5 === 0) return [lived && !(horizontal && gy === 15 && gx >= 10 && gx < 20) ? 10 : 22, 'avenue'];
        const d = this.districtAt(Math.min(SIZE - EPS, gx * 100 + 50), Math.min(SIZE - EPS, gy * 100 + 50)), r = random(hash(this.spec.seed + ':street:' + gx + ':' + gy + ':' + horizontal));
        if (lived) { const widths = d.id === 'grand-exchange' ? [4, 7] : d.id === 'levy-court' || d.id === 'south-quay' ? [5, 7] : d.id === 'salt-market' ? [3, 4.5] : [3.5, 6]; return [range(r, ...widths), 'lane']; }
        return [range(r, ...d.profile.streetWidth), 'lane'];
      };
      for (let gy = 0; gy <= 30; gy++) for (let gx = 0; gx <= 30; gx++) {
        if (gx < 30) this._link('n:' + gx + ':' + gy, 'n:' + (gx + 1) + ':' + gy, ...streetWidth(gx, gy, true));
        if (gy < 30) this._link('n:' + gx + ':' + gy, 'n:' + gx + ':' + (gy + 1), ...streetWidth(gx, gy, false));
      }
      const a = -MARGIN * .45, b = SIZE + MARGIN * .45, ring = [];
      this._node('p:nw', a, a); ring.push('p:nw');
      for (let i = 0; i <= 6; i++) { const id = 'p:n:' + i; this._node(id, i * 500, a); ring.push(id); this._link(id, 'n:' + i * 5 + ':0', 10, 'promenade'); }
      this._node('p:ne', b, a); ring.push('p:ne');
      for (let i = 0; i <= 6; i++) { const id = 'p:e:' + i; this._node(id, b, i * 500); ring.push(id); this._link(id, 'n:30:' + i * 5, 10, 'promenade'); }
      this._node('p:se', b, b); ring.push('p:se');
      for (let i = 6; i >= 0; i--) { const id = 'p:s:' + i; this._node(id, i * 500, b); ring.push(id); this._link(id, 'n:' + i * 5 + ':30', 10, 'promenade'); }
      this._node('p:sw', a, b); ring.push('p:sw');
      for (let i = 6; i >= 0; i--) { const id = 'p:w:' + i; this._node(id, a, i * 500); ring.push(id); this._link(id, 'n:0:' + i * 5, 10, 'promenade'); }
      for (let i = 0; i < ring.length; i++) this._link(ring[i], ring[(i + 1) % ring.length], 8, 'promenade');
    }
    _indexRoads() {
      for (const road of this.roads) {
        const b = road.bounds;
        for (let cy = Math.floor(b.y / CHUNK); cy <= Math.floor((b.y + b.d) / CHUNK); cy++) for (let cx = Math.floor(b.x / CHUNK); cx <= Math.floor((b.x + b.w) / CHUNK); cx++) {
          const key = this._key(cx, cy); if (!this._roadIndex.has(key)) this._roadIndex.set(key, []); this._roadIndex.get(key).push(road);
        }
        const water = this._outerWater.slice();
        for (let cy = Math.max(0, Math.floor(b.y / CHUNK)); cy <= Math.min(29, Math.floor((b.y + b.d) / CHUNK)); cy++) for (let cx = Math.max(0, Math.floor(b.x / CHUNK)); cx <= Math.min(29, Math.floor((b.x + b.w) / CHUNK)); cx++) water.push(...this._waterForCell(cx, cy));
        for (const w of water) { const span = segmentRect(road.points[0], road.points[1], w); if (span) { road.bridge = true; road.bridgeSpans.push({ from: span[0], to: span[1], waterId: w.id }); } }
      }
    }
    _roadsNear(box) {
      const out = new Map();
      for (let cy = Math.floor(box.y / CHUNK); cy <= Math.floor((box.y + box.d) / CHUNK); cy++) for (let cx = Math.floor(box.x / CHUNK); cx <= Math.floor((box.x + box.w) / CHUNK); cx++) for (const road of this._roadIndex.get(this._key(cx, cy)) || []) if (intersects(box, road.bounds)) out.set(road.id, road);
      return [...out.values()];
    }
    _waterForCell(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= 30 || cy >= 30 || cx % 10 === 4 && cy % 10 === 4) return [];
      const d = this.districtAt(cx * CHUNK + 50, cy * CHUNK + 50), x = cx * CHUNK, y = cy * CHUNK, lx = cx % 10, ly = cy % 10, r = random(hash(this.spec.seed + ':water:' + cx + ':' + cy)); let rect = null, kind = 'canal';
      if (d.id === 'dye-canals' && lx % 2 === 1) rect = { x: x + 43, y, w: 14, d: 100 };
      else if (d.id === 'glassworks' && (lx === 3 || lx === 7)) rect = { x: x + 44, y, w: 12, d: 100 };
      else if (d.id === 'south-quay' && ly >= 7 && lx % 3 === 1) { rect = { x: x + 28, y: y + 12, w: 44, d: 88 }; kind = 'harbor-slip'; }
      else if (d.id === 'salt-gardens' && r() < .45) { rect = { x: x + 22, y: y + 24, w: 56, d: 42 }; kind = 'salt-pan'; }
      return rect ? [{ id: 'water:' + cx + ':' + cy, ...rect, z: -.2, districtId: d.id, kind }] : [];
    }
    _clearBuilding(b, roads, water) {
      if (roads.some(road => segmentRect(road.points[0], road.points[1], expand(b, road.width / 2 + (this.spec.layout === 'lived-in' ? .5 : 1.4))))) return false;
      return !water.some(w => intersects(expand(b, 1.8), w));
    }
    _parcelBounds(cx, cy) {
      const id = (x, y) => 'n:' + x + ':' + y;
      const a = this._nodeMap.get(id(cx, cy)), b = this._nodeMap.get(id(cx + 1, cy)), c = this._nodeMap.get(id(cx, cy + 1)), d = this._nodeMap.get(id(cx + 1, cy + 1));
      const width = (A, B) => this._roadById.get('road:' + A.id + '>' + B.id).width / 2 + (this.spec.layout === 'lived-in' ? .65 : 1.6);
      // The extremes of each street edge keep every axis-aligned parcel clear
      // of the complete sloping road. Parcels remain in their owning chunk.
      const x = Math.max(cx * CHUNK + 1, Math.max(a.x, c.x) + width(a, c));
      const y = Math.max(cy * CHUNK + 1, Math.max(a.y, b.y) + width(a, b));
      const right = Math.min((cx + 1) * CHUNK - 1, Math.min(b.x, d.x) - width(b, d));
      const bottom = Math.min((cy + 1) * CHUNK - 1, Math.min(c.y, d.y) - width(c, d));
      return { x, y, w: Math.max(0, right - x), d: Math.max(0, bottom - y) };
    }
    _generate(cx, cy) {
      const out = emptyChunk(cx, cy), box = out.bounds;
      out.roads = (this._roadIndex.get(this._key(cx, cy)) || []).filter(r => intersects(box, r.bounds));
      out.plazas = this._plazas.filter(p => intersects(box, p));
      out.landmarks = this.landmarks.filter(l => intersects(box, l));
      out.buildings.push(...out.landmarks);
      out.water = this._outerWater.filter(w => intersects(box, w));
      if (cx < 0 || cy < 0 || cx >= 30 || cy >= 30) return out;
      const d = this.districtAt(cx * CHUNK + 50, cy * CHUNK + 50), profile = d.profile, seed = hash(this.spec.seed + ':cell:' + cx + ':' + cy), r = random(seed), civic = cx % 10 === 4 && cy % 10 === 4;
      out.districtId = d.id; out.water.push(...this._waterForCell(cx, cy));
      if (this.spec.layout === 'lived-in') return this._livedInChunk(out, d, seed, civic);
      if (civic) {
        out.props.push({ id: 'prop:arrival:' + d.id, x: d.arrival.x + 3.6, y: d.arrival.y - .4, w: .8, d: .8, h: 2.7, z: 0, districtId: d.id, kind: 'wayfinding', solid: false, seed });
        return out;
      }
      const lane = clamp(profile.streetWidth[0] * .55, 2.2, 5.5), parcel = this._parcelBounds(cx, cy);
      const water = out.water, roads = this._roadsNear(expand(box, 30));
      if (['scribes-ward', 'grand-exchange', 'salt-gardens'].includes(d.id) && r() < .2) out.plazas.push({ id: 'plaza:' + cx + ':' + cy, x: box.x + 33, y: box.y + 33, w: 34, d: 34, z: 0, districtId: d.id, kind: d.id === 'salt-gardens' ? 'garden' : 'court' });
      const cols = Math.min(20, Math.floor((parcel.w + lane) / (profile.footprint[0] + lane)));
      const rows = Math.min(20, Math.floor((parcel.d + lane) / (profile.footprint[2] + lane)));
      const slotW = cols ? (parcel.w - lane * (cols - 1)) / cols : 0, slotD = rows ? (parcel.d - lane * (rows - 1)) / rows : 0;
      const openLots = [];
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const index = row * cols + col, x0 = parcel.x + col * (slotW + lane), y0 = parcel.y + row * (slotD + lane);
        const width = range(r, profile.footprint[0], Math.min(profile.footprint[1], slotW)), depth = range(r, profile.footprint[2], Math.min(profile.footprint[3], slotD));
        const x = x0 + (slotW - width) * r(), y = y0 + (slotD - depth) * r(), h = range(r, ...profile.height);
        const id = 'building:' + cx + ':' + cy + ':' + index, keep = r() < Math.min(.97, profile.coverage * this.spec.density);
        const b = { id, x, y, w: width, d: depth, h, z: 0, districtId: d.id, kind: pick(r, profile.kinds), roof: pick(r, profile.roofs), seed: hash(seed + ':' + id), climb: h <= 30 };
        const clear = this._clearBuilding(b, roads, water) && !out.plazas.some(p => intersects(expand(b, 1), p));
        if (keep && clear) out.buildings.push(b);
        else if (clear) openLots.push({ index, x: x0, y: y0, w: slotW, d: slotD });
      }
      // A few deliberately open lots have actual garden or cargo dressing.
      // These features are non-solid and never change the route graph.
      const industrial = ['south-quay', 'glassworks', 'dye-canals'].includes(d.id);
      for (const lot of openLots) {
        const lr = random(hash(seed + ':open-lot:' + lot.index));
        if (lr() > (industrial ? .5 : .3) || !this._clearBuilding(lot, roads, water)) continue;
        const kind = industrial ? 'barrels' : 'tree', count = industrial ? 2 : 1;
        if (!industrial && lot.w > 8 && lot.d > 8 && lr() < .45) out.plazas.push({ id: 'garden:' + cx + ':' + cy + ':' + lot.index, x: lot.x + 1, y: lot.y + 1, w: lot.w - 2, d: lot.d - 2, z: 0, districtId: d.id, kind: 'garden' });
        for (let i = 0; i < count; i++) out.props.push({ id: 'prop:lot:' + cx + ':' + cy + ':' + lot.index + ':' + i, x: lot.x + lot.w * (.32 + i * .32) - 1, y: lot.y + lot.d * .55 - 1, w: 2, d: 2, h: industrial ? 1.3 : 4.5, z: 0, districtId: d.id, kind, solid: false, seed: hash(seed + ':lot-prop:' + lot.index + ':' + i) });
      }
      // Non-solid dressing never consumes a route or an arrival point.
      for (let i = 0; i < 3; i++) {
        const px = range(r, box.x + 12, box.x + 88), py = range(r, box.y + 12, box.y + 88), kind = d.id === 'salt-gardens' || r() < .35 ? 'tree' : r() < .5 ? 'barrels' : 'bench', p = { id: 'prop:' + cx + ':' + cy + ':' + i, x: px - 1, y: py - 1, w: 2, d: 2, h: kind === 'tree' ? 4.5 : 1.1, z: 0, districtId: d.id, kind, solid: false, seed: hash(seed + ':prop:' + i) };
        if (!out.buildings.some(b => intersects(expand(p, .5), b)) && !water.some(w => intersects(p, w)) && !roads.some(road => onRoad(road, px, py, -1))) out.props.push(p);
      }
      return out;
    }
    _livedInChunk(out, district, seed, civic) {
      const p = district.profile, box = out.bounds, r = random(hash(seed + ':frontage')), parcel = this._parcelBounds(out.cx, out.cy), roads = this._roadsNear(expand(box, 30));
      const garden = district.id === 'salt-gardens', harbor = district.id === 'south-quay', gap = garden ? 2 : 1.35;
      const landmarks = this.landmarks.filter(b => b.districtId === district.id), landmark = landmarks[0], arrival = district.arrival;
      const reserved = [];
      if (civic) {
        reserved.push(expand(landmark, 3));
        // A working entrance square and a straight accessible passage to the south road.
        reserved.push({ x: arrival.x - 12, y: landmark.y + landmark.d, w: 24, d: box.y + box.d - landmark.y - landmark.d });
        out.props.push({ id: 'prop:arrival:' + district.id, x: arrival.x + 3.6, y: arrival.y - .4, w: .8, d: .8, h: 2.7, z: 0, districtId: district.id, kind: 'wayfinding', solid: false, seed });
      } else if (!garden && r() < .12) {
        const w = range(r, 9, 15), depth = range(r, 10, 16), court = { id: 'court:life:' + out.cx + ':' + out.cy, x: box.x + 50 - w / 2, y: box.y + 50 - depth / 2, w, d: depth, z: 0, districtId: district.id, kind: 'court' };
        if (!out.water.some(water => intersects(court, water))) { reserved.push(expand(court, .7)); out.plazas.push(court); }
      }
      const minW = civic ? 8 : p.footprint[0], maxW = civic ? 14 : p.footprint[1], minD = civic ? 9 : p.footprint[2], maxD = civic ? 16 : p.footprint[3];
      const cols = Math.max(1, Math.floor((parcel.w + gap) / (minW + gap))), rows = Math.max(1, Math.floor((parcel.d + gap) / (minD + gap)));
      const slotW = (parcel.w - gap * (cols - 1)) / cols, slotD = (parcel.d - gap * (rows - 1)) / rows;
      const baseKeep = civic ? .98 : garden ? .45 : harbor ? .86 : district.id === 'glassworks' ? .91 : .97;
      const keep = Math.min(.995, baseKeep + (this.spec.density - 1) * .16);
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const index = row * cols + col, x0 = parcel.x + col * (slotW + gap), y0 = parcel.y + row * (slotD + gap);
        // Lot edges form continuous fronts. Tiny variation changes elevations, not huge setbacks.
        const w = Math.min(maxW, slotW), depth = Math.min(maxD, slotD), x = x0 + (col === cols - 1 ? slotW - w : 0), y = y0 + (row === rows - 1 ? slotD - depth : 0);
        const id = 'life-building:' + out.cx + ':' + out.cy + ':' + index, h = civic ? range(r, 6, Math.min(13, p.height[1])) : range(r, ...p.height);
        const b = { id, x, y, w, d: depth, h, z: 0, districtId: district.id, kind: civic ? 'shop' : pick(r, p.kinds), roof: pick(r, p.roofs), seed: hash(seed + ':' + id), climb: h <= 30 };
        const exists = r() < keep, safe = w >= 2 && depth >= 2 && this._clearBuilding(b, roads, out.water) && !reserved.some(q => intersects(expand(b, .2), q));
        if (exists && safe) out.buildings.push(b);
        else if (safe && (!civic || r() < .3)) {
          const kind = garden ? 'tree' : harbor || district.id === 'glassworks' ? 'barrels' : 'bench';
          out.props.push({ id: 'prop:life-lot:' + out.cx + ':' + out.cy + ':' + index, x: x + w * .5 - .6, y: y + depth * .5 - .6, w: 1.2, d: 1.2, h: kind === 'tree' ? 4.5 : 1.1, z: 0, districtId: district.id, kind, solid: false, seed: hash(id) });
        }
      }
      return out;
    }
    getChunk(cx, cy) {
      if (!Number.isInteger(cx) || !Number.isInteger(cy)) throw new TypeError('chunk coordinates must be integers');
      const key = this._key(cx, cy), box = { x: cx * CHUNK, y: cy * CHUNK, w: CHUNK, d: CHUNK };
      if (!intersects(box, this.bounds)) return emptyChunk(cx, cy);
      if (this._cache.has(key)) { const chunk = this._cache.get(key); this._cache.delete(key); this._cache.set(key, chunk); this._hits++; return chunk; }
      const chunk = deepFreeze(this._generate(cx, cy)); this._cache.set(key, chunk); this._misses++; this._ever.add(key);
      while (this._cache.size > this.spec.chunkCacheLimit) this._cache.delete(this._cache.keys().next().value);
      return chunk;
    }
    query(bounds) {
      const b = queryBounds(bounds), out = { bounds: b }; for (const key of LAYERS) out[key] = [];
      if (!intersects(b, this.bounds)) return out;
      const seen = Object.fromEntries(LAYERS.map(key => [key, new Set()]));
      const x0 = Math.max(-1, Math.floor((b.x - EPS) / CHUNK)), y0 = Math.max(-1, Math.floor((b.y - EPS) / CHUNK)), x1 = Math.min(30, Math.floor((b.x + b.w) / CHUNK)), y1 = Math.min(30, Math.floor((b.y + b.d) / CHUNK));
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const chunk = this.getChunk(cx, cy);
        for (const key of LAYERS) for (const feature of chunk[key]) if (!seen[key].has(feature.id) && intersects(b, feature.bounds || feature)) { out[key].push(feature); seen[key].add(feature.id); }
      }
      for (const key of LAYERS) out[key].sort((a, b) => a.id.localeCompare(b.id));
      return out;
    }
    overview() {
      const out = this.query(this.bounds);
      out.districts = this.districts; out.bounds = this.bounds;
      out.summary = { footprintAreaM2: AREA, districtAreaM2: 9000000, perimeterAreaM2: 1000000, buildingCount: out.buildings.length, landmarkCount: out.landmarks.length, roadLengthM: this.graph.edges.reduce((sum, e) => sum + e.lengthM, 0), waterCount: out.water.length, propCount: out.props.length };
      this._overviewSummary = copy(out.summary); return out;
    }
    isWalkable(x, y, radius = .275, z = 0) {
      finite(x, 'x'); finite(y, 'y'); finite(radius, 'radius'); finite(z, 'z');
      if (radius < 0 || radius > 10) throw new RangeError('radius must be from zero to10 metres');
      if (!contains({ x: this.bounds.x + radius, y: this.bounds.y + radius, w: this.bounds.w - radius * 2, d: this.bounds.d - radius * 2 }, x, y)) return false;
      const q = this.query({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2 });
      if (q.buildings.some(b => z < b.z + b.h - .001 && circleRect(x, y, radius, b))) return false;
      if (q.water.some(w => circleRect(x, y, radius, w)) && !q.roads.some(road => onRoad(road, x, y, radius))) return false;
      return !q.props.some(p => p.solid && circleRect(x, y, radius, p));
    }
    safePoint(position, radius = .275) {
      const p = point(position, 'position'), z = position.z === undefined ? 0 : finite(position.z, 'position.z');
      finite(radius, 'radius'); if (radius < 0 || radius > 10) throw new RangeError('radius must be from zero to10 metres');
      if (this.isWalkable(p.x, p.y, radius, z)) return { x: p.x, y: p.y, z, relocated: false, distanceM: 0 };
      const candidates = this.roads.map(road => { const at = closest(road.points[0], road.points[1], p); return { x: at.x, y: at.y, z: 0, distanceM: pointDistance(p, at), id: road.id }; }).sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id));
      for (const q of candidates) if (this.isWalkable(q.x, q.y, radius, 0)) return { x: q.x, y: q.y, z: 0, relocated: true, distanceM: q.distanceM };
      throw new RangeError('No safe street can hold this character radius');
    }
    sample(x, y) {
      const q = this.query({ x, y, w: 0, d: 0 }), building = q.buildings.find(b => contains(b, x, y)) || null, road = q.roads.find(r => onRoad(r, x, y)) || null, water = q.water.find(w => contains(w, x, y)) || null;
      return { district: this.districtAt(x, y), building, road, water, height: building ? building.h + building.z : 0, walkable: this.isWalkable(x, y) };
    }
    _clearSegment(a, b, radius) {
      const q = this.query(boundsOf(a, b, radius));
      if (q.buildings.some(building => segmentRect(a, b, expand(building, radius)))) return false;
      if (!q.water.length) return true;
      const count = Math.max(1, Math.ceil(pointDistance(a, b) / .5));
      for (let i = 0; i <= count; i++) { const t = i / count, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (q.water.some(w => circleRect(x, y, radius, w)) && !q.roads.some(road => onRoad(road, x, y, radius))) return false; }
      return true;
    }
    _anchors(p, radius) {
      for (const distance of [80, 160, 260]) {
        const candidates = this._roadsNear({ x: p.x - distance, y: p.y - distance, w: distance * 2, d: distance * 2 }).map(road => { const at = closest(road.points[0], road.points[1], p); return { road, at: { x: at.x, y: at.y }, distance: pointDistance(p, at) }; }).sort((a, b) => a.distance - b.distance || a.road.id.localeCompare(b.road.id));
        const safe = []; for (const c of candidates) if (this._clearSegment(p, c.at, radius)) { safe.push(c); if (safe.length >= 3) break; }
        if (safe.length) return safe;
      }
      return [];
    }
    route(start, end, options = {}) {
      const a = point(start, 'start'), b = point(end, 'end'), radius = options.radius === undefined ? .275 : finite(options.radius, 'radius');
      const fail = reason => ({ ok: false, points: [], lengthM: 0, districts: [], reason });
      if (!this.isWalkable(a.x, a.y, radius) || !this.isWalkable(b.x, b.y, radius)) return fail('An endpoint is outside the walkable city.');
      if (pointDistance(a, b) < EPS) return { ok: true, points: [a], lengthM: 0, districts: [this.districtAt(a.x, a.y)?.id || 'perimeter'] };
      const starts = this._anchors(a, radius), ends = this._anchors(b, radius); if (!starts.length || !ends.length) return fail('No clear connection to a street was found.');
      let direct = null;
      for (const s of starts) for (const e of ends) if (s.road.id === e.road.id) { const length = s.distance + pointDistance(s.at, e.at) + e.distance; if (!direct || length < direct.length) direct = { points: [a, s.at, e.at, b], length }; }
      const goals = new Map(); for (const e of ends) for (const id of [e.road.a, e.road.b]) { const cost = e.distance + pointDistance(e.at, this._nodeMap.get(id)); if (!goals.has(id) || cost < goals.get(id).cost) goals.set(id, { cost, anchor: e }); }
      const heap = new MinHeap(), distances = new Map(), came = new Map(), source = new Map();
      for (const s of starts) for (const id of [s.road.a, s.road.b]) { const distance = s.distance + pointDistance(s.at, this._nodeMap.get(id)); if (distance < (distances.get(id) ?? Infinity)) { distances.set(id, distance); source.set(id, s); heap.push({ id, distance, cost: distance + pointDistance(this._nodeMap.get(id), b) }); } }
      let best = direct ? direct.length : Infinity, goal = null;
      while (heap.length) {
        const q = heap.pop(); if (q.distance !== distances.get(q.id) || q.cost >= best) continue;
        if (goals.has(q.id)) { const total = q.distance + goals.get(q.id).cost; if (total < best) { best = total; goal = q.id; } }
        for (const next of this._adj.get(q.id)) { const distance = q.distance + next.edge.lengthM; if (distance < (distances.get(next.id) ?? Infinity)) { distances.set(next.id, distance); came.set(next.id, q.id); source.set(next.id, source.get(q.id)); heap.push({ id: next.id, distance, cost: distance + pointDistance(this._nodeMap.get(next.id), b) }); } }
      }
      let points;
      if (goal) { const ids = []; let id = goal; while (id) { ids.push(id); id = came.get(id); } ids.reverse(); points = [a, source.get(goal).at, ...ids.map(id => ({ x: this._nodeMap.get(id).x, y: this._nodeMap.get(id).y })), goals.get(goal).anchor.at, b]; }
      else if (direct) points = direct.points; else return fail('No street route was found.');
      points = points.filter((p, i) => i === 0 || pointDistance(p, points[i - 1]) > EPS);
      const districts = []; for (const p of points) { const id = this.districtAt(p.x, p.y)?.id || 'perimeter'; if (!districts.includes(id)) districts.push(id); }
      return { ok: true, points, lengthM: points.slice(1).reduce((sum, p, i) => sum + pointDistance(points[i], p), 0), districts };
    }
    calibrationRoute() {
      const start = { x: 1000, y: 1500 }, end = { x: 2000, y: 1500 };
      return { ok: true, points: [start, end], start, end, lengthM: 1000, districts: ['grand-exchange'], marks: Array.from({ length: 11 }, (_, i) => ({ x: 1000 + i * 100, y: 1500, distanceM: i * 100 })) };
    }
    toEngine(point) { return { x: point.x * UNITS, y: point.y * UNITS, z: (point.z || 0) * UNITS }; }
    fromEngine(point) { return { x: point.x / UNITS, y: point.y / UNITS, z: (point.z || 0) / UNITS }; }
  }

  const create = options => new City(options);
  const fromSpec = input => { let value = input; if (typeof input === 'string') { try { value = JSON.parse(input); } catch (e) { throw new TypeError('city spec is not valid JSON'); } } if (!value || value.schema !== 'nacre-city' || value.version !== 1) throw new RangeError('unsupported city spec'); return new City(value); };
  return { version: VERSION, City, create, fromSpec, defaultSpec: options => copy(makeSpec(options)), profiles: deepFreeze(copy(DEFAULT_PROFILES)), unitsPerMetre: UNITS, movement: MOVEMENT, constants: deepFreeze({ districtSizeM: 1000, cityCoreSideM: SIZE, chunkSizeM: CHUNK, footprintAreaM2: AREA, outerSideM: SIDE, perimeterWidthM: MARGIN }) };
});
