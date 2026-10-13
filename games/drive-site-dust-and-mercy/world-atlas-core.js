/*
 * World Atlas — deterministic, streamed frontier geography.
 * Original project source. No third-party runtime dependencies.
 * Coordinates, distances, elevations and collision radii are in metres.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WorldAtlas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const generatorVersion = '1.0.0';
  const schema = 'dust-and-mercy/world-atlas';
  const schemaVersion = 1;
  const unitsPerMetre = 16;
  const chunkSizeM = 64;
  const maxCachedChunks = 48;
  const naturalCellM = 8;
  const indexCellM = 128;
  const defaults = Object.freeze({
    areaKm2: 100,
    aspect: 1,
    seed: 'bitter-creek-1887',
    ruggedness: 0.55,
    vegetation: 0.55,
    settlements: 8
  });
  const configKeys = Object.keys(defaults);
  const limits = Object.freeze({
    areaKm2: Object.freeze([1, 10000]),
    aspect: Object.freeze([0.25, 4]),
    ruggedness: Object.freeze([0, 1]),
    vegetation: Object.freeze([0, 1]),
    settlements: Object.freeze([2, 24]),
    seedLength: Object.freeze([1, 128])
  });
  const biomeColors = Object.freeze({
    grassland: '#9b9e69',
    'dry scrub': '#b8a479',
    'pine slopes': '#71846b',
    riverbank: '#879c79',
    highlands: '#91958b',
    boundary: '#26332d'
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function plainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function numberInRange(value, name, low, high) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
      throw new RangeError(name + ' must be a finite number from ' + low + ' to ' + high + '.');
    }
  }

  /** Return a frozen, complete config. Unknown fields and coercion are rejected. */
  function validateConfig(input, options) {
    if (input === undefined) input = {};
    if (!plainObject(input)) throw new TypeError('Config must be a plain object.');
    for (const key of Object.keys(input)) {
      if (!configKeys.includes(key)) throw new TypeError('Unknown config field: ' + key);
    }
    if (options && options.complete) {
      for (const key of configKeys) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) throw new TypeError('Missing config field: ' + key);
      }
    }
    const config = {};
    for (const key of configKeys) {
      config[key] = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : defaults[key];
    }
    for (const key of ['areaKm2', 'aspect', 'ruggedness', 'vegetation', 'settlements']) {
      numberInRange(config[key], key, limits[key][0], limits[key][1]);
      if (config[key] === 0) config[key] = 0;
    }
    if (!Number.isInteger(config.settlements)) throw new RangeError('settlements must be an integer.');
    if (typeof config.seed !== 'string' || config.seed.length < 1 || config.seed.length > 128 || !config.seed.trim()) {
      throw new TypeError('seed must contain 1 to 128 characters and must not be blank.');
    }
    if (/[\u0000-\u001f\u007f]/.test(config.seed)) throw new TypeError('seed must not contain control characters.');
    return Object.freeze(config);
  }

  /** Produce an export object. Serialize it with JSON.stringify(envelope, null, 2). */
  function exportConfig(configOrWorld) {
    const value = configOrWorld && configOrWorld.config ? configOrWorld.config : configOrWorld;
    return Object.freeze({ schema, schemaVersion, generatorVersion, config: validateConfig(value) });
  }

  /** Import only this exact schema and generator version. Never execute imported data. */
  function importConfig(input) {
    let envelope = input;
    if (typeof input === 'string') {
      if (input.length > 4096) throw new RangeError('The atlas config file is too large.');
      try { envelope = JSON.parse(input); }
      catch (_) { throw new TypeError('The atlas config file is not valid JSON.'); }
    }
    if (!plainObject(envelope)) throw new TypeError('The atlas export must be an object.');
    const keys = ['schema', 'schemaVersion', 'generatorVersion', 'config'];
    if (Object.keys(envelope).length !== keys.length || Object.keys(envelope).some(key => !keys.includes(key))) {
      throw new TypeError('The atlas export must contain only schema, schemaVersion, generatorVersion and config.');
    }
    if (envelope.schema !== schema) throw new TypeError('Unsupported atlas schema.');
    if (envelope.schemaVersion !== schemaVersion) throw new TypeError('Unsupported atlas schema version.');
    if (envelope.generatorVersion !== generatorVersion) throw new TypeError('Unsupported atlas generator version.');
    return validateConfig(envelope.config, { complete: true });
  }

  /** Stable unsigned 32-bit hash. String input is recommended for public use. */
  function hash(value) {
    const text = String(value);
    let result = 2166136261;
    for (let i = 0; i < text.length; i++) {
      result ^= text.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    result ^= result >>> 16;
    result = Math.imul(result, 0x7feb352d);
    result ^= result >>> 15;
    result = Math.imul(result, 0x846ca68b);
    return (result ^ (result >>> 16)) >>> 0;
  }

  // Hash global lattice coordinates. This does not use shared random state.
  function latticeHash(x, y, salt) {
    let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ salt;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  }

  function randomAt(x, y, salt) { return latticeHash(x, y, salt) / 4294967296; }

  function noise(x, y, salt) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = smooth(x - ix), ty = smooth(y - iy);
    return lerp(
      lerp(randomAt(ix, iy, salt), randomAt(ix + 1, iy, salt), tx),
      lerp(randomAt(ix, iy + 1, salt), randomAt(ix + 1, iy + 1, salt), tx), ty
    );
  }

  function point(value, name) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
      throw new TypeError((name || 'Point') + ' must have finite numeric x and y values.');
    }
    return value;
  }

  function routeLength(points) {
    if (!Array.isArray(points)) throw new TypeError('Route points must be an array.');
    let length = 0;
    for (let i = 0; i < points.length; i++) {
      point(points[i]);
      if (i) length += distance(points[i - 1], points[i]);
    }
    if (!Number.isFinite(length)) throw new RangeError('Route length is too large.');
    return length;
  }

  function travelSeconds(distanceM, speedKmh, factor) {
    if (factor === undefined) factor = 1;
    numberInRange(distanceM, 'distanceM', 0, Number.MAX_VALUE);
    numberInRange(speedKmh, 'speedKmh', Number.MIN_VALUE, Number.MAX_VALUE);
    numberInRange(factor, 'factor', Number.MIN_VALUE, Number.MAX_VALUE);
    const seconds = distanceM / (speedKmh / 3.6) / factor;
    if (!Number.isFinite(seconds)) throw new RangeError('Travel time is too large.');
    return seconds;
  }

  function projectOnSegment(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const denominator = dx * dx + dy * dy;
    const t = denominator ? clamp(((x - a.x) * dx + (y - a.y) * dy) / denominator, 0, 1) : 0;
    const px = t === 0 ? a.x : t === 1 ? b.x : a.x + dx * t;
    const py = t === 0 ? a.y : t === 1 ? b.y : a.y + dy * t;
    return { x: px, y: py, t, distanceM: Math.hypot(x - px, y - py) };
  }

  function nearestOnRoute(x, y, points) {
    let best = null;
    for (let i = 1; i < points.length; i++) {
      const candidate = projectOnSegment(x, y, points[i - 1], points[i]);
      if (!best || candidate.distanceM < best.distanceM) best = Object.assign(candidate, { segment: i - 1 });
    }
    return best;
  }

  /** Spatial hash for nearby line segments. A tile never scans the whole network. */
  function segmentIndex(paths, paddingM, counters, counterName) {
    const buckets = new Map();
    let segmentCount = 0;
    for (const path of paths) {
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i];
        const segment = { a, b, widthM: path.widthM || 8, id: path.id };
        segmentCount++;
        const padding = paddingM + segment.widthM / 2;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / (indexCellM / 2)));
        // Subdivide only while building the index. Long diagonals do not fill
        // their whole bounding rectangle with irrelevant index entries.
        for (let j = 0; j < steps; j++) {
          const x0 = lerp(a.x, b.x, j / steps), y0 = lerp(a.y, b.y, j / steps);
          const x1 = lerp(a.x, b.x, (j + 1) / steps), y1 = lerp(a.y, b.y, (j + 1) / steps);
          const minX = Math.floor((Math.min(x0, x1) - padding) / indexCellM);
          const maxX = Math.floor((Math.max(x0, x1) + padding) / indexCellM);
          const minY = Math.floor((Math.min(y0, y1) - padding) / indexCellM);
          const maxY = Math.floor((Math.max(y0, y1) + padding) / indexCellM);
          for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
              const key = cx + ',' + cy;
              let bucket = buckets.get(key);
              if (!bucket) buckets.set(key, bucket = new Set());
              bucket.add(segment);
            }
          }
        }
      }
    }
    for (const [key, value] of buckets) buckets.set(key, Array.from(value));
    return {
      cellCount: buckets.size,
      segmentCount,
      nearest(x, y) {
        const bucket = buckets.get(Math.floor(x / indexCellM) + ',' + Math.floor(y / indexCellM));
        let best = null;
        if (bucket) {
          counters[counterName] += bucket.length;
          for (const segment of bucket) {
            const candidate = projectOnSegment(x, y, segment.a, segment.b);
            if (!best || candidate.distanceM < best.distanceM) {
              best = { distanceM: candidate.distanceM, widthM: segment.widthM, id: segment.id };
            }
          }
        }
        return best;
      }
    };
  }

  function freezePath(path) {
    path.points = Object.freeze(path.points.map(p => Object.freeze({ x: p.x, y: p.y })));
    path.lengthM = routeLength(path.points);
    return Object.freeze(path);
  }

  function shade(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const red = clamp((value >>> 16) + amount, 0, 255) | 0;
    const green = clamp(((value >>> 8) & 255) + amount, 0, 255) | 0;
    const blue = clamp((value & 255) + amount, 0, 255) | 0;
    return '#' + ((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0');
  }

  function create(input) {
    const config = validateConfig(input);
    const areaM2 = config.areaKm2 * 1000000;
    const widthM = Math.sqrt(areaM2 * config.aspect);
    const heightM = Math.sqrt(areaM2 / config.aspect);
    const seed = config.seed;
    const seedHash = hash(seed);
    const worldKey = generatorVersion + '-' + hash(JSON.stringify(config)).toString(16);
    const counters = {
      sampleCalls: 0, chunkRequests: 0, chunksGenerated: 0, cacheHits: 0,
      cacheEvictions: 0, roadSegmentTests: 0, riverSegmentTests: 0
    };
    const cache = new Map();
    const inBounds = (x, y) => x >= 0 && y >= 0 && x <= widthM && y <= heightM;
    const r = (index, salt) => randomAt(index, salt || 0, seedHash);

    // Elevation is continuous data. The engine can shade it without changing
    // its ground-plane projection. It is not a vertical terrain collision mesh.
    function baseTerrain(x, y) {
      const broad = noise(x / 1450, y / 1450, seedHash ^ 0x25171);
      const medium = noise(x / 370, y / 370, seedHash ^ 0x91da3);
      const fine = noise(x / 83, y / 83, seedHash ^ 0x7532d);
      const ridge = 1 - Math.abs(2 * noise(x / 690 + 19, y / 690 - 7, seedHash ^ 0x37ca1) - 1);
      const north = clamp((0.69 - y / heightM + (broad - 0.5) * 0.2) / 0.47, 0, 1);
      const upland = smooth(north);
      const height = 65 + broad * 90 + config.ruggedness * (medium * 160 + ridge * upland * 790 + fine * 24);
      const roughness = clamp(0.025 + config.ruggedness * (upland * (0.23 + ridge * 0.52) + Math.abs(fine - 0.5) * 0.2), 0, 1);
      const moisture = clamp(0.28 + noise(x / 910 - 4, y / 910 + 31, seedHash ^ 0x512b3) * 0.42 + (1 - x / widthM) * 0.1 - y / heightM * 0.22, 0, 1);
      return { heightM: height, moisture, roughness, fine };
    }

    // Water uses world-scale routes. The width remains in real metres.
    const riverPoints = [];
    const riverSteps = clamp(Math.ceil(heightM / 390), 12, 256);
    const riverPhase = r(1, 31) * Math.PI * 2;
    for (let i = 0; i <= riverSteps; i++) {
      const t = i / riverSteps;
      const bend = Math.sin(t * Math.PI * 2.7 + riverPhase) * 0.051 + Math.sin(t * Math.PI * 7.2 + riverPhase * 0.3) * 0.018;
      riverPoints.push({ x: widthM * (0.54 + bend), y: heightM * t });
    }
    const tributaryEndIndex = Math.max(2, Math.floor(riverSteps * 0.34));
    const tributaryEnd = riverPoints[tributaryEndIndex];
    const tributaryPoints = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      tributaryPoints.push({
        x: lerp(widthM * 0.15, tributaryEnd.x, t) + Math.sin(t * Math.PI * 3) * widthM * 0.014 * Math.sin(t * Math.PI),
        y: tributaryEnd.y * t
      });
    }
    tributaryPoints[tributaryPoints.length - 1] = { x: tributaryEnd.x, y: tributaryEnd.y };
    const rivers = Object.freeze([
      freezePath({ id: 'bitter-river', name: 'Bitter River', points: riverPoints, widthM: 14 + r(9, 7) * 6 }),
      freezePath({ id: 'alder-run', name: 'Alder Run', points: tributaryPoints, widthM: 6 + r(13, 7) * 3 })
    ]);
    const riverIndex = segmentIndex(rivers, 130, counters, 'riverSegmentTests');

    const traversePoints = [];
    const traverseSteps = clamp(Math.ceil(widthM / 660), 8, 192);
    const roadPhase = r(6, 19) * Math.PI * 2;
    for (let i = 0; i <= traverseSteps; i++) {
      const t = i / traverseSteps;
      traversePoints.push({
        x: widthM * t,
        y: heightM * (0.5 + Math.sin(t * Math.PI) * (Math.sin(t * Math.PI * 2 + roadPhase) * 0.068 + Math.sin(t * Math.PI * 5) * 0.021))
      });
    }
    // Assign endpoints directly. Trigonometric rounding must not move them.
    traversePoints[0] = { x: 0, y: heightM / 2 };
    traversePoints[traversePoints.length - 1] = { x: widthM, y: heightM / 2 };
    // The west entrance includes at least 100 m of straight, level-speed road.
    // It provides a visible distance calibration lane at the true metre scale.
    const entranceStraightM = Math.min(150, widthM / 4);
    const middlePoints = traversePoints.filter(p => p.x > entranceStraightM && p.x < widthM - entranceStraightM);
    traversePoints.splice(0, traversePoints.length,
      { x: 0, y: heightM / 2 },
      { x: entranceStraightM, y: heightM / 2 },
      ...middlePoints,
      { x: widthM - entranceStraightM, y: heightM / 2 },
      { x: widthM, y: heightM / 2 }
    );

    const landmarks = [];
    const townNames = [
      'Stag’s Rest', 'Bitter Creek', 'Alder Crossing', 'Cinder Spur',
      'Copper Wash', 'Juniper Wells', 'Prospect Hollow', 'Redwater',
      'Coyote Bend', 'Barrel Spring', 'Hawthorn Post', 'Ember Bluff',
      'Dry Lantern', 'Morrow Flats', 'Westward Bell', 'Cottonwood Reach',
      'Old Quarry', 'Tamarack', 'Sable Fork', 'Horseshoe Basin',
      'Gannet Creek', 'Sparrow Ridge', 'Broken Anvil', 'Willow Rest'
    ];

    function placeLandmark(id, name, type, x, y, ordinal) {
      const clearRadiusM = type === 'settlement' ? 38 : type === 'camp' ? 19 : 14;
      const margin = clearRadiusM + 12;
      let px = clamp(x, margin, widthM - margin), py = clamp(y, margin, heightM - margin);
      // Bounded deterministic search prevents a marker from sitting in water
      // or directly inside another landmark clearing.
      for (let attempt = 0; attempt < 72; attempt++) {
        const water = riverIndex.nearest(px, py);
        const tooWet = water && water.distanceM < water.widthM / 2 + clearRadiusM + 10;
        const tooClose = landmarks.some(item => Math.hypot(px - item.x, py - item.y) < item.clearRadiusM + clearRadiusM + 20);
        if (!tooWet && !tooClose) break;
        const angle = r(ordinal * 97 + attempt, 101) * Math.PI * 2;
        const offset = 50 + attempt * 9;
        px = clamp(x + Math.cos(angle) * offset, margin, widthM - margin);
        py = clamp(y + Math.sin(angle) * offset, margin, heightM - margin);
      }
      const entry = { id, name, x: px, y: py, type, elevationM: baseTerrain(px, py).heightM, clearRadiusM };
      landmarks.push(entry);
      return entry;
    }

    // The first landmark is a camp near the west entrance. The finite world
    // still starts at x=0, rather than at the camp or the first chunk center.
    placeLandmark('mercy-camp', 'Mercy Camp', 'camp', Math.min(120, widthM * 0.08), heightM / 2 + 45, 0);
    const columns = Math.max(2, Math.ceil(Math.sqrt(config.settlements * config.aspect)));
    const rows = Math.ceil(config.settlements / columns);
    for (let i = 0; i < config.settlements; i++) {
      const col = i % columns, row = Math.floor(i / columns);
      const x = widthM * (0.09 + 0.82 * (col + 0.5 + (r(i, 43) - 0.5) * 0.4) / columns);
      const y = heightM * (0.1 + 0.8 * (row + 0.5 + (r(i, 47) - 0.5) * 0.4) / rows);
      placeLandmark('settlement-' + (i + 1), townNames[i], 'settlement', x, y, i + 1);
    }
    placeLandmark('alder-camp', 'Alder Camp', 'camp', widthM * 0.42, heightM * 0.64, 31);
    placeLandmark('nightjar-camp', 'Nightjar Camp', 'camp', widthM * 0.86, heightM * 0.76, 32);
    placeLandmark('crows-lookout', 'Crow’s Lookout', 'viewpoint', widthM * 0.18, heightM * 0.13, 33);
    placeLandmark('calder-overlook', 'Calder Overlook', 'viewpoint', widthM * 0.66, heightM * 0.14, 34);
    placeLandmark('sunset-bluff', 'Sunset Bluff', 'viewpoint', widthM * 0.91, heightM * 0.3, 35);

    // Grow a road tree from the main route. Every branch ends at a connected
    // landmark or at an exact point on the traverse road.
    const roads = [{ id: 'west-east-traverse', name: 'The Calder Road', points: traversePoints, widthM: 8.5 }];
    const connected = [];
    const pending = landmarks.slice();
    const anchors = [];
    while (pending.length) {
      let best = null;
      for (let i = 0; i < pending.length; i++) {
        const landmark = pending[i];
        const anchor = nearestOnRoute(landmark.x, landmark.y, traversePoints);
        let target = { x: anchor.x, y: anchor.y };
        let cost = anchor.distanceM;
        let mainAnchor = anchor;
        for (const other of connected) {
          const candidate = distance(landmark, other);
          if (candidate < cost) { cost = candidate; target = other; mainAnchor = null; }
        }
        if (!best || cost < best.cost) best = { index: i, landmark, target, cost, mainAnchor };
      }
      const a = best.landmark, b = best.target;
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.max(best.cost, 0.001);
      const bend = (r(hash(a.id), 71) - 0.5) * Math.min(160, best.cost * 0.16);
      const points = [{ x: a.x, y: a.y }];
      if (best.cost > 24) {
        for (const t of [1 / 3, 2 / 3]) {
          const offset = Math.sin(t * Math.PI) * bend;
          points.push({
            x: clamp(lerp(a.x, b.x, t) - dy / length * offset, 0, widthM),
            y: clamp(lerp(a.y, b.y, t) + dx / length * offset, 0, heightM)
          });
        }
      }
      points.push({ x: b.x, y: b.y });
      roads.push({ id: 'road-' + a.id, name: a.name + ' Road', points, widthM: a.type === 'viewpoint' ? 4.5 : 6 });
      if (best.mainAnchor) anchors.push(best.mainAnchor);
      connected.push(a);
      pending.splice(best.index, 1);
    }
    // Include branch joins as explicit main-route vertices. Consumers can build
    // a connected graph without geometric intersection or approximate matching.
    const joinedTraverse = [];
    for (let i = 0; i < traversePoints.length - 1; i++) {
      joinedTraverse.push(traversePoints[i]);
      const joins = anchors.filter(anchor => anchor.segment === i && anchor.t > 0 && anchor.t < 1).sort((a, b) => a.t - b.t);
      for (const join of joins) {
        const previous = joinedTraverse[joinedTraverse.length - 1];
        if (previous.x !== join.x || previous.y !== join.y) joinedTraverse.push({ x: join.x, y: join.y });
      }
    }
    joinedTraverse.push(traversePoints[traversePoints.length - 1]);
    roads[0].points = joinedTraverse;
    for (let i = 0; i < roads.length; i++) roads[i] = freezePath(roads[i]);
    Object.freeze(roads);
    for (let i = 0; i < landmarks.length; i++) Object.freeze(landmarks[i]);
    Object.freeze(landmarks);
    const roadIndex = segmentIndex(roads, 16, counters, 'roadSegmentTests');

    const boundarySample = Object.freeze({
      heightM: 0, moisture: 0, biome: 'boundary', roughness: 1,
      road: false, water: false, ford: false, speedFactor: 0,
      color: biomeColors.boundary, inBounds: false, roadDistanceM: 128, riverDistanceM: 256
    });

    function sample(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Sample coordinates must be finite numbers.');
      counters.sampleCalls++;
      if (!inBounds(x, y)) return boundarySample;
      const terrain = baseTerrain(x, y);
      const river = riverIndex.nearest(x, y);
      const roadSegment = roadIndex.nearest(x, y);
      const riverDistanceM = river ? Math.min(256, river.distanceM) : 256;
      const roadDistanceM = roadSegment ? Math.min(128, roadSegment.distanceM) : 128;
      const riverHalf = river ? river.widthM / 2 : 0;
      const water = !!river && riverDistanceM <= riverHalf;
      const road = !!roadSegment && roadDistanceM <= roadSegment.widthM / 2;
      const ford = water && road;
      const bank = !!river && riverDistanceM <= riverHalf + 19;
      const moisture = clamp(terrain.moisture + (river ? clamp(1 - Math.max(0, riverDistanceM - riverHalf) / 130, 0, 1) * 0.36 : 0), 0, 1);
      let biome = 'grassland';
      if (bank) biome = 'riverbank';
      else if (terrain.heightM > 490 || terrain.roughness > 0.66) biome = 'highlands';
      else if (terrain.heightM > 315 && moisture > 0.37) biome = 'pine slopes';
      else if (moisture < 0.355) biome = 'dry scrub';
      let speedFactor = clamp(1 - terrain.roughness * 0.43, 0.52, 1);
      if (biome === 'pine slopes') speedFactor *= 0.88;
      if (biome === 'highlands') speedFactor *= 0.82;
      if (biome === 'dry scrub') speedFactor *= 0.95;
      if (road) speedFactor = 1;
      if (water) speedFactor = ford ? 0.68 : 0.36;
      let color = shade(biomeColors[biome], Math.round((terrain.fine - 0.5) * 12 + terrain.roughness * 7));
      if (road) color = '#c5af82';
      if (water) color = ford ? '#839d91' : '#628b8d';
      return {
        heightM: terrain.heightM, moisture, biome, roughness: terrain.roughness,
        road, water, ford, speedFactor, color, inBounds: true,
        roadDistanceM, riverDistanceM
      };
    }

    function clearForProp(x, y, radiusM) {
      if (x < radiusM || y < radiusM || x > widthM - radiusM || y > heightM - radiusM) return false;
      const road = roadIndex.nearest(x, y);
      if (road && road.distanceM < road.widthM / 2 + radiusM + 3) return false;
      const river = riverIndex.nearest(x, y);
      if (river && river.distanceM < river.widthM / 2 + radiusM + 3) return false;
      for (const landmark of landmarks) {
        if (Math.hypot(x - landmark.x, y - landmark.y) < landmark.clearRadiusM + radiusM) return false;
      }
      return true;
    }

    function makeNaturalProp(cellX, cellY) {
      const propSeed = latticeHash(cellX, cellY, seedHash ^ 0x251ac);
      const chance = randomAt(cellX, cellY, seedHash ^ 0x181);
      if (chance > 0.24 + config.vegetation * 0.64) return null;
      const x = (cellX + 0.15 + randomAt(cellX, cellY, seedHash ^ 0x281) * 0.7) * naturalCellM;
      const y = (cellY + 0.15 + randomAt(cellX, cellY, seedHash ^ 0x381) * 0.7) * naturalCellM;
      if (!inBounds(x, y)) return null;
      const terrain = sample(x, y);
      const choice = randomAt(cellX, cellY, seedHash ^ 0x481);
      const scale = randomAt(cellX, cellY, seedHash ^ 0x581);
      let type, size, radiusM, color;
      if (choice < 0.12 || (terrain.biome === 'highlands' && choice < 0.46)) {
        type = 'boulder'; size = 0.65 + scale * 1.4; radiusM = 0.68 * size; color = '#827967';
      } else if (terrain.biome === 'dry scrub' && choice < 0.44 && config.vegetation > 0) {
        type = 'cactus'; size = 0.8 + scale * 0.75; radiusM = 0.35 * size; color = '#708364';
      } else if (config.vegetation > 0 && choice < (terrain.biome === 'pine slopes' ? 0.77 : terrain.biome === 'riverbank' ? 0.72 : 0.22 + config.vegetation * 0.22)) {
        type = 'tree';
        size = terrain.biome === 'pine slopes' ? 1.4 + scale * 1.3 : 0.9 + scale * 1.1;
        radiusM = 0.7 * size;
        color = terrain.biome === 'pine slopes' ? '#486450' : '#788450';
      } else if (config.vegetation > 0) {
        type = 'grass'; size = 0.65 + scale * 0.75; radiusM = 0;
        color = terrain.biome === 'dry scrub' ? '#938551' : '#7c8e57';
      } else return null;
      if (!clearForProp(x, y, radiusM)) return null;
      return Object.freeze({ id: worldKey + ':n:' + cellX + ':' + cellY, type, x, y, size, seed: propSeed, color, radiusM });
    }

    // Tiny, fixed landmark fixtures are evaluated only for nearby chunks.
    // Their positions depend on IDs, not on the order in which chunks load.
    function addLandmarkProps(props, cx, cy) {
      const minX = cx * chunkSizeM, minY = cy * chunkSizeM;
      const maxX = Math.min(widthM, minX + chunkSizeM), maxY = Math.min(heightM, minY + chunkSizeM);
      for (const landmark of landmarks) {
        const ring = landmark.clearRadiusM + 12;
        if (landmark.x + ring + 4 < minX || landmark.x - ring - 4 >= maxX || landmark.y + ring + 4 < minY || landmark.y - ring - 4 >= maxY) continue;
        const types = landmark.type === 'settlement' ? ['tent', 'wagon', 'crate', 'pole', 'fence', 'sign'] :
          landmark.type === 'camp' ? ['tent', 'campfire', 'wagon', 'crate'] : ['sign', 'boulder'];
        for (let i = 0; i < types.length; i++) {
          const propSeed = hash(seed + ':' + landmark.id + ':' + i);
          const angle = i / types.length * Math.PI * 2 + r(hash(landmark.id), 801) * Math.PI * 2;
          const x = landmark.x + Math.cos(angle) * ring;
          const y = landmark.y + Math.sin(angle) * ring;
          if (x < minX || y < minY || x >= maxX || y >= maxY) continue;
          const type = types[i];
          const radiusM = type === 'tent' || type === 'wagon' ? 1.5 : type === 'fence' ? 1.3 : type === 'boulder' ? 0.9 : 0.45;
          if (!clearForProp(x, y, radiusM)) continue;
          props.push(Object.freeze({ id: worldKey + ':l:' + landmark.id + ':' + i, type, x, y, size: 1, seed: propSeed, color: type === 'tent' ? '#b7a57c' : '#826d4c', radiusM }));
        }
      }
    }

    function getChunk(cx, cy) {
      if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) throw new TypeError('Chunk indices must be safe integers.');
      counters.chunkRequests++;
      const key = worldKey + ':' + cx + ':' + cy;
      if (cx < 0 || cy < 0 || cx >= Math.ceil(widthM / chunkSizeM) || cy >= Math.ceil(heightM / chunkSizeM)) {
        return Object.freeze({ cx, cy, props: Object.freeze([]), key });
      }
      if (cache.has(key)) {
        const chunk = cache.get(key);
        cache.delete(key);
        cache.set(key, chunk);
        counters.cacheHits++;
        return chunk;
      }
      const props = [];
      const cellsPerChunk = chunkSizeM / naturalCellM;
      for (let y = cy * cellsPerChunk; y < (cy + 1) * cellsPerChunk; y++) {
        for (let x = cx * cellsPerChunk; x < (cx + 1) * cellsPerChunk; x++) {
          const prop = makeNaturalProp(x, y);
          if (prop) props.push(prop);
        }
      }
      addLandmarkProps(props, cx, cy);
      const chunk = Object.freeze({ cx, cy, props: Object.freeze(props), key });
      cache.set(key, chunk);
      counters.chunksGenerated++;
      if (cache.size > maxCachedChunks) {
        cache.delete(cache.keys().next().value);
        counters.cacheEvictions++;
      }
      return chunk;
    }

    function chunkStats() {
      return Object.assign({}, counters, {
        cachedChunks: cache.size,
        maxCachedChunks,
        roadIndexCells: roadIndex.cellCount,
        riverIndexCells: riverIndex.cellCount,
        roadSegments: roadIndex.segmentCount,
        riverSegments: riverIndex.segmentCount,
        worldChunkColumns: Math.ceil(widthM / chunkSizeM),
        worldChunkRows: Math.ceil(heightM / chunkSizeM)
      });
    }

    // Construction should not appear as runtime terrain queries in diagnostics.
    counters.roadSegmentTests = 0;
    counters.riverSegmentTests = 0;
    return Object.freeze({
      config, widthM, heightM, areaKm2: config.areaKm2, areaM2, seed, generatorVersion,
      unitsPerMetre, chunkSizeM, landmarks, roads, rivers, sample, getChunk, chunkStats,
      clearCache() { cache.clear(); },
      metadata: Object.freeze({
        coordinateUnit: 'metre', xDirection: 'east', yDirection: 'south',
        engineUnitsPerMetre: unitsPerMetre, chunkSizeM, maxCachedChunks,
        surfaceModel: 'Continuous elevation data; flat ground-plane rendering.',
        speedModel: 'Caller supplies real km/h. Multiply by sample.speedFactor; use real elapsed seconds.',
        traverseRoadId: 'west-east-traverse',
        entranceStraightM,
        westEntrance: Object.freeze({ x: 0, y: heightM / 2 }),
        eastEntrance: Object.freeze({ x: widthM, y: heightM / 2 })
      })
    });
  }

  return Object.freeze({
    generatorVersion, schema, schemaVersion, unitsPerMetre, chunkSizeM,
    maxCachedChunks, defaults, limits, biomeColors,
    create, validateConfig, exportConfig, importConfig, hash, routeLength, travelSeconds
  });
});
