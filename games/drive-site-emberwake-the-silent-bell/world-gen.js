/*
 * Emberwake Worldforge — deterministic, finite, streaming world generation.
 * No dependencies. Browser: EWWorld. Node: require('./world-gen.js').
 *
 * sample(x, y) and tile(x, y) return identical frozen tile records. sample does
 * not allocate tile chunks, so a coarse world preview cannot fill that cache.
 * tile lazily fills 32 x 32 chunks in a 64-chunk LRU. Macro cells have a separate
 * 256-entry LRU. Generation never allocates an array the size of the world.
 * Coordinates in terrain queries are floored; out-of-bounds queries return an
 * impassable boundary tile. Edits require in-bounds integer coordinates.
 * sitesInRect uses inclusive bounds and returns at most limit records.
 *
 * Rivers are coherent, warped contour channels, not a drainage simulation.
 * Roads connect neighboring land anchors and bridge rivers/mountain passes.
 * Sparse overrides accept biome and/or road. A road:true override also makes
 * water passable. {} clears an override. getOverride returns a detached copy
 * or null, suitable for editor undo/redo. Recipe overrides are an array of
 * {x, y, biome?, road?}, limited to 20,000 unique tile coordinates.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EWWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CHUNK_SIZE = 32;
  const MAX_CHUNKS = 64;
  const MACRO_SIZE = 128;
  const MAX_MACRO_CELLS = 256;
  const MAX_OVERRIDES = 20000;
  const MAX_SITE_RESULTS = 5000;
  const MAX_RECIPE_TEXT = 4 * 1024 * 1024;
  const SIZES = Object.freeze([512, 2048, 8192, 16384]);
  const CONFIG_KEYS = ['seed', 'size', 'seaLevel', 'ruggedness', 'moisture', 'siteDensity'];
  const DEFAULTS = Object.freeze({
    seed: 'The Silent Bell', size: 8192, seaLevel: 0.43,
    ruggedness: 0.58, moisture: 0.52, siteDensity: 0.58
  });
  const BIOMES = Object.freeze(Object.fromEntries([
    ['ocean', 'Ocean', '#173b56', false, 0, 'Deep water. Find a bridge or choose another route.'],
    ['coast', 'Coast', '#bbad7b', true, 1, 'Salt grass and pale shores border the open water.'],
    ['grassland', 'Grassland', '#738f62', true, 1, 'Open country with room to travel and make camp.'],
    ['forest', 'Forest', '#345d4f', true, 2, 'Dense woodland conceals fragments of the old network.'],
    ['desert', 'Desert', '#c4975d', true, 3, 'Dry basins and wind-cut stone hold the day\'s heat.'],
    ['tundra', 'Tundra', '#b2c1bd', true, 3, 'Cold heath lies under a wide and quiet sky.'],
    ['mountain', 'Mountain', '#727d86', false, 4, 'Steep ridges require a marked pass.'],
    ['marsh', 'Marsh', '#57776a', true, 3, 'Reeds and dark pools fill the low ground.']
  ].map(([id, label, color, passable, danger, description]) => [id,
    Object.freeze({id, label, color, passable, danger, description})])));
  const PREFIXES = Object.freeze(['Ash', 'Amber', 'Brine', 'Cinder', 'Copper', 'Dawn',
    'Ember', 'Glass', 'Hollow', 'Ivory', 'Juniper', 'Morrow', 'Ochre', 'Pale',
    'Rain', 'Reed', 'Sable', 'Salt', 'Silver', 'Still', 'Thorn', 'Umber', 'Veil', 'Wind']);
  const SITE_WORDS = Object.freeze({
    settlement: Object.freeze(['Reach', 'Haven', 'Crossing', 'Market', 'Rest', 'Quay', 'Hearth', 'Vale']),
    ruins: Object.freeze(['Archive', 'Remnant', 'Court', 'Bastion', 'Garden', 'Steps', 'Observatory', 'Spire']),
    relay: Object.freeze(['Relay', 'Beacon', 'Signal', 'Pylon', 'Station', 'Crown', 'Resonator', 'Watch']),
    sanctuary: Object.freeze(['Sanctuary', 'Chapel', 'Refuge', 'Well', 'Grove', 'Cloister', 'Shrine', 'Shelter']),
    vault: Object.freeze(['Vault', 'Reliquary', 'Chamber', 'Sepulchre', 'Lock', 'Repository', 'Crypt', 'Cache'])
  });
  const SITE_DESCRIPTIONS = Object.freeze({
    settlement: 'A small community keeps its lamps lit beside the old road. Trade and news still pass through here.',
    ruins: 'An abandoned structure holds weathered records of the age before the bells fell silent.',
    relay: 'An ancient signal tower waits for a voice to reconnect it to the distant network.',
    sanctuary: 'Travelers have repaired this quiet refuge. Its shelter offers a pause between uncertain roads.',
    vault: 'A sealed chamber lies below the surface. Its makers left a lock, a warning, and no clear account of what remains.'
  });
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const key = (x, y) => x + ',' + y;

  function plainObject(value, allowed, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(label + ' must be a plain object.');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(label + ' must not have a custom prototype.');
    }
    for (const name of Reflect.ownKeys(value)) {
      if (typeof name !== 'string' || !allowed.includes(name)) {
        throw new TypeError('Unknown ' + label + ' field: ' + String(name));
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !hasOwn(descriptor, 'value')) {
        throw new TypeError(label + ' must contain data fields only.');
      }
    }
    return value;
  }

  function boundedNumber(value, min, max, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(label + ' must be a finite number.');
    }
    if (value < min || value > max) throw new RangeError(label + ' is outside its allowed range.');
    return value;
  }

  function normalizeConfig(config) {
    if (config === undefined) config = {};
    plainObject(config, CONFIG_KEYS, 'config');
    const out = {};
    for (const field of CONFIG_KEYS) out[field] = hasOwn(config, field) ? config[field] : DEFAULTS[field];
    if (typeof out.seed !== 'string' || out.seed.length > 80) {
      throw new TypeError('seed must be a string of at most 80 UTF-16 code units.');
    }
    if (!SIZES.includes(out.size)) throw new RangeError('size must be 512, 2048, 8192, or 16384.');
    boundedNumber(out.seaLevel, 0.2, 0.7, 'seaLevel');
    boundedNumber(out.ruggedness, 0, 1, 'ruggedness');
    boundedNumber(out.moisture, 0, 1, 'moisture');
    boundedNumber(out.siteDensity, 0, 1, 'siteDensity');
    return Object.freeze(out);
  }

  function seedHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    return h >>> 0;
  }

  function hash2(x, y, seed) {
    let h = seed ^ Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function noise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    return lerp(lerp(hash2(ix, iy, seed), hash2(ix + 1, iy, seed), fx),
      lerp(hash2(ix, iy + 1, seed), hash2(ix + 1, iy + 1, seed), fx), fy);
  }

  function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const ex = px - ax - t * dx, ey = py - ay - t * dy;
    return ex * ex + ey * ey;
  }

  function queryCoordinates(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Tile coordinates must be finite numbers.');
    }
    return [Math.floor(x), Math.floor(y)];
  }

  function editCoordinates(x, y, size) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      throw new TypeError('Edit coordinates must be safe integers.');
    }
    if (x < 0 || y < 0 || x >= size || y >= size) throw new RangeError('Edit coordinates are outside the world.');
  }

  function normalizeOverride(patch, allowEmpty) {
    plainObject(patch, ['biome', 'road'], 'override');
    const out = {};
    if (hasOwn(patch, 'biome')) {
      if (typeof patch.biome !== 'string' || !hasOwn(BIOMES, patch.biome)) {
        throw new TypeError('override.biome must name one of the eight biomes.');
      }
      out.biome = patch.biome;
    }
    if (hasOwn(patch, 'road')) {
      if (typeof patch.road !== 'boolean') throw new TypeError('override.road must be boolean.');
      out.road = patch.road;
    }
    if (!allowEmpty && !Object.keys(out).length) throw new TypeError('A recipe override must change biome or road.');
    return Object.freeze(out);
  }

  function parseOverrides(overrides, size) {
    if (overrides === undefined) return new Map();
    if (!Array.isArray(overrides)) throw new TypeError('overrides must be an array.');
    if (overrides.length > MAX_OVERRIDES) throw new RangeError('A world can contain at most 20,000 overrides.');
    const result = new Map();
    for (const entry of overrides) {
      plainObject(entry, ['x', 'y', 'biome', 'road'], 'recipe override');
      if (!hasOwn(entry, 'x') || !hasOwn(entry, 'y')) throw new TypeError('A recipe override requires x and y.');
      editCoordinates(entry.x, entry.y, size);
      const patch = {};
      if (hasOwn(entry, 'biome')) patch.biome = entry.biome;
      if (hasOwn(entry, 'road')) patch.road = entry.road;
      const id = key(entry.x, entry.y);
      if (result.has(id)) throw new TypeError('Duplicate override coordinates: ' + id);
      result.set(id, normalizeOverride(patch, false));
    }
    return result;
  }

  class World {
    constructor(config, overrides) {
      Object.defineProperty(this, 'config', {value: normalizeConfig(config), enumerable: true});
      this._seed = seedHash(this.config.seed);
      this._overrides = parseOverrides(overrides, this.config.size);
      this._chunks = new Map();
      this._macro = new Map();
      this._tileCount = 0;
      this._cacheHits = 0;
      this._cacheMisses = 0;
      this._scale = Math.min(920, Math.max(170, this.config.size / 7));
      this._haven = Object.freeze({
        x: Math.floor(this.config.size * (0.37 + hash2(19, 37, this._seed) * 0.26)),
        y: Math.floor(this.config.size * (0.37 + hash2(41, 13, this._seed) * 0.26))
      });
      this._havenRadius = Math.min(96, Math.max(64, this.config.size / 32));
    }

    inBounds(x, y) {
      return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 &&
        x < this.config.size && y < this.config.size;
    }

    _terrain(x, y) {
      const c = this.config, s = this._seed, scale = this._scale;
      const continent = noise(x / scale, y / scale, s ^ 0x6917a2c1);
      const hills = noise(x / (scale * 0.34), y / (scale * 0.34), s ^ 0x20cdb7a3);
      const detail = noise(x / 61, y / 61, s ^ 0x42b709c5);
      const ridge = Math.abs(noise(x / 113, y / 113, s ^ 0x798deb13) * 2 - 1);
      let height = clamp(continent * 0.60 + hills * 0.27 + detail * 0.13 +
        (ridge - 0.4) * c.ruggedness * 0.19, 0, 1);
      const edge = Math.min(x, y, c.size - 1 - x, c.size - 1 - y);
      height *= smooth(clamp(edge / Math.min(40, c.size / 20), 0, 1));
      const havenDistance = Math.hypot(x - this._haven.x, y - this._haven.y);
      if (havenDistance < this._havenRadius) {
        height = Math.max(height, c.seaLevel + 0.135 - havenDistance / this._havenRadius * 0.16);
      }
      let wet = clamp(c.moisture + (noise(x / 273, y / 273, s ^ 0x284c8a61) - 0.5) * 0.82 +
        (noise(x / 79, y / 79, s ^ 0x762b4f39) - 0.5) * 0.26, 0, 1);
      const latitude = 1 - Math.abs(y / (c.size - 1) * 2 - 1);
      const temperature = clamp(0.1 + latitude * 0.81 +
        (noise(x / 347, y / 347, s ^ 0x473ed105) - 0.5) * 0.24 -
        Math.max(0, height - 0.62) * 0.52, 0, 1);
      const warpX = (detail - 0.5) * 0.43;
      const warpY = (hills - 0.5) * 0.36;
      const channel = Math.abs(noise(x / 283 + warpX, y / 283 + warpY, s ^ 0x134daf73) - 0.5);
      let river = height > c.seaLevel + 0.018 && height < c.seaLevel + 0.265 &&
        channel < 0.0045 + c.moisture * 0.003 && havenDistance > 12;
      if (river) {
        height = Math.max(c.seaLevel + 0.019, height - 0.025);
        wet = clamp(wet + 0.17, 0, 1);
      }
      let biome;
      const mountainLine = Math.max(c.seaLevel + 0.20, 0.76 - c.ruggedness * 0.11);
      if (height < c.seaLevel) biome = 'ocean';
      else if (height < c.seaLevel + 0.026) biome = 'coast';
      else if (height > mountainLine) biome = 'mountain';
      else if (temperature < 0.28) biome = 'tundra';
      else if (wet < 0.35 && temperature > 0.36) biome = 'desert';
      else if (wet > 0.67 && height < c.seaLevel + 0.145) biome = 'marsh';
      else if (wet > 0.55) biome = 'forest';
      else biome = 'grassland';
      if (havenDistance <= 7) { biome = 'grassland'; river = false; }
      return {x, y, height, moisture: wet, temperature, biome, river,
        passable: BIOMES[biome].passable && !river, havenDistance};
    }

    _cell(cx, cy) {
      const count = this.config.size / MACRO_SIZE;
      if (cx < 0 || cy < 0 || cx >= count || cy >= count) return null;
      const id = key(cx, cy);
      if (this._macro.has(id)) {
        const saved = this._macro.get(id);
        this._macro.delete(id);
        this._macro.set(id, saved);
        return saved;
      }
      let cell = {cx, cy, x: 0, y: 0, land: false, feature: null, east: undefined, south: undefined};
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = cx * MACRO_SIZE + 24 + Math.floor(hash2(cx, cy, this._seed ^ (0x1287d39b + attempt * 97)) * 80);
        const y = cy * MACRO_SIZE + 24 + Math.floor(hash2(cx, cy, this._seed ^ (0x731ac645 + attempt * 131)) * 80);
        const t = this._terrain(x, y);
        if (t.passable && t.height >= this.config.seaLevel + 0.032) {
          cell.x = x; cell.y = y; cell.land = true;
          break;
        }
      }
      if (cell.land && hash2(cx, cy, this._seed ^ 0x734971af) < this.config.siteDensity) {
        const roll = hash2(cx, cy, this._seed ^ 0x683adb27);
        const kind = roll < 0.30 ? 'settlement' : roll < 0.54 ? 'ruins' :
          roll < 0.75 ? 'relay' : roll < 0.9 ? 'sanctuary' : 'vault';
        const prefix = PREFIXES[Math.floor(hash2(cx, cy, this._seed ^ 0x492dba71) * PREFIXES.length)];
        const words = SITE_WORDS[kind];
        const suffix = words[Math.floor(hash2(cx, cy, this._seed ^ 0x26ba487f) * words.length)];
        cell.feature = Object.freeze({
          id: 'site-' + this._seed.toString(36) + '-' + cx.toString(36) + '-' + cy.toString(36),
          kind, name: prefix + ' ' + suffix, x: cell.x, y: cell.y,
          description: SITE_DESCRIPTIONS[kind]
        });
      }
      this._macro.set(id, cell);
      if (this._macro.size > MAX_MACRO_CELLS) this._macro.delete(this._macro.keys().next().value);
      return cell;
    }

    _edge(cell, axis) {
      if (!cell || !cell.land) return null;
      const field = axis === 0 ? 'east' : 'south';
      if (cell[field] !== undefined) return cell[field];
      const other = this._cell(cell.cx + (axis === 0 ? 1 : 0), cell.cy + (axis === 1 ? 1 : 0));
      if (!other || !other.land) { cell[field] = null; return null; }
      const bend = (hash2(cell.cx, cell.cy, this._seed ^ (axis === 0 ? 0x2379d4a1 : 0x748acf91)) - 0.5) * 24;
      const mx = (cell.x + other.x) / 2 + (axis === 1 ? bend : 0);
      const my = (cell.y + other.y) / 2 + (axis === 0 ? bend : 0);
      const road = {ax: cell.x, ay: cell.y, mx, my, bx: other.x, by: other.y};
      for (const p of [[lerp(cell.x, mx, 0.5), lerp(cell.y, my, 0.5)], [mx, my],
        [lerp(mx, other.x, 0.5), lerp(my, other.y, 0.5)]]) {
        if (this._terrain(p[0], p[1]).biome === 'ocean') { cell[field] = null; return null; }
      }
      cell[field] = road;
      return road;
    }

    _onRoad(x, y, cx, cy, cell) {
      const edges = [this._edge(cell, 0), this._edge(cell, 1),
        this._edge(this._cell(cx - 1, cy), 0), this._edge(this._cell(cx, cy - 1), 1)];
      for (const edge of edges) {
        if (edge && (distanceToSegmentSquared(x, y, edge.ax, edge.ay, edge.mx, edge.my) <= 1.7 ||
          distanceToSegmentSquared(x, y, edge.mx, edge.my, edge.bx, edge.by) <= 1.7)) return true;
      }
      return false;
    }

    sample(x, y) {
      [x, y] = queryCoordinates(x, y);
      if (!this.inBounds(x, y)) return Object.freeze({x, y, height: 0, moisture: 1,
        temperature: 0.5, biome: 'ocean', passable: false, river: false, road: false,
        danger: 0, feature: null, outside: true});
      const terrain = this._terrain(x, y);
      const patch = this._overrides.get(key(x, y));
      let biome = terrain.biome, river = terrain.river;
      if (patch && hasOwn(patch, 'biome')) { biome = patch.biome; river = false; }
      const cx = Math.floor(x / MACRO_SIZE), cy = Math.floor(y / MACRO_SIZE);
      const cell = biome === 'ocean' ? null : this._cell(cx, cy);
      let road = biome !== 'ocean' && this._onRoad(x, y, cx, cy, cell);
      if (patch && hasOwn(patch, 'road')) road = patch.road;
      const passable = road || (BIOMES[biome].passable && !river);
      const feature = cell && cell.feature && x === cell.x && y === cell.y && passable ? cell.feature : null;
      let danger = biome === 'ocean' && !road ? 0 : clamp(BIOMES[biome].danger +
        Math.floor(terrain.havenDistance / Math.max(180, this.config.size * 0.23)), 1, 5);
      if (road) danger = Math.max(1, danger - 1);
      if (feature && (feature.kind === 'settlement' || feature.kind === 'sanctuary')) danger = 0;
      return Object.freeze({x, y, height: terrain.height, moisture: terrain.moisture,
        temperature: terrain.temperature, biome, passable, river, road, danger, feature});
    }

    tile(x, y) {
      [x, y] = queryCoordinates(x, y);
      if (!this.inBounds(x, y)) return this.sample(x, y);
      const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE);
      const id = key(cx, cy), offset = (y % CHUNK_SIZE) * CHUNK_SIZE + x % CHUNK_SIZE;
      let chunk = this._chunks.get(id);
      if (chunk) {
        this._chunks.delete(id);
        this._chunks.set(id, chunk);
        if (chunk.data[offset]) { this._cacheHits++; return chunk.data[offset]; }
      } else {
        chunk = {data: new Array(CHUNK_SIZE * CHUNK_SIZE), count: 0};
        this._chunks.set(id, chunk);
        if (this._chunks.size > MAX_CHUNKS) {
          const oldest = this._chunks.keys().next().value;
          this._tileCount -= this._chunks.get(oldest).count;
          this._chunks.delete(oldest);
        }
      }
      this._cacheMisses++;
      chunk.data[offset] = this.sample(x, y);
      chunk.count++;
      this._tileCount++;
      return chunk.data[offset];
    }

    sitesInRect(x0, y0, x1, y1, limit = 500) {
      [x0, y0] = queryCoordinates(x0, y0);
      [x1, y1] = queryCoordinates(x1, y1);
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_SITE_RESULTS) {
        throw new RangeError('Site limit must be an integer from 0 through 5,000.');
      }
      if (limit === 0) return [];
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (x1 < 0 || y1 < 0 || x0 >= this.config.size || y0 >= this.config.size) return [];
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(this.config.size - 1, x1); y1 = Math.min(this.config.size - 1, y1);
      const result = [];
      for (let cy = Math.floor(y0 / MACRO_SIZE); cy <= Math.floor(y1 / MACRO_SIZE); cy++) {
        for (let cx = Math.floor(x0 / MACRO_SIZE); cx <= Math.floor(x1 / MACRO_SIZE); cx++) {
          const cell = this._cell(cx, cy);
          if (cell && cell.feature && cell.x >= x0 && cell.x <= x1 && cell.y >= y0 && cell.y <= y1) {
            const tile = this.sample(cell.x, cell.y);
            if (tile.feature) result.push(tile.feature);
            if (result.length >= limit) return result;
          }
        }
      }
      return result;
    }

    findSpawn(preferred) {
      let target = this._haven;
      if (preferred !== undefined) {
        plainObject(preferred, ['x', 'y'], 'preferred spawn');
        const [x, y] = queryCoordinates(preferred.x, preferred.y);
        target = {x: clamp(x, 0, this.config.size - 1), y: clamp(y, 0, this.config.size - 1)};
      }
      const safe = (x, y) => {
        if (!this.inBounds(x, y)) return null;
        return this.sample(x, y).passable ? {x, y} : null;
      };
      const localSearch = (center, radius) => {
        let found = safe(center.x, center.y);
        if (found) return found;
        for (let r = 1; r <= radius; r++) {
          for (let d = -r; d <= r; d++) {
            found = safe(center.x + d, center.y - r) || safe(center.x + d, center.y + r);
            if (found) return found;
          }
          for (let d = -r + 1; d < r; d++) {
            found = safe(center.x - r, center.y + d) || safe(center.x + r, center.y + d);
            if (found) return found;
          }
        }
        return null;
      };
      let result = localSearch(target, 24);
      if (result) return result;
      const cx = Math.floor(target.x / MACRO_SIZE), cy = Math.floor(target.y / MACRO_SIZE);
      for (let r = 0; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (r && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const cell = this._cell(cx + dx, cy + dy);
          if (cell && cell.land && (result = safe(cell.x, cell.y))) return result;
        }
      }
      result = localSearch(this._haven, 80);
      if (result) return result;
      // This bounded fallback is for imported edits that flood the landing area.
      for (let i = 0; i < 512; i++) {
        const x = Math.floor(hash2(i, 71, this._seed ^ 0x56d92a71) * this.config.size);
        const y = Math.floor(hash2(i, 97, this._seed ^ 0x219d734f) * this.config.size);
        if ((result = safe(x, y))) return result;
      }
      throw new Error('No passable spawn was found. Clear a terrain override or lower the sea level.');
    }

    getOverride(x, y) {
      editCoordinates(x, y, this.config.size);
      const patch = this._overrides.get(key(x, y));
      return patch ? Object.assign({}, patch) : null;
    }

    setOverride(x, y, patch) {
      editCoordinates(x, y, this.config.size);
      const normalized = normalizeOverride(patch, true), id = key(x, y);
      if (Object.keys(normalized).length) {
        if (!this._overrides.has(id) && this._overrides.size >= MAX_OVERRIDES) {
          throw new RangeError('A world can contain at most 20,000 overrides.');
        }
        this._overrides.set(id, normalized);
      } else this._overrides.delete(id);
      const chunkId = key(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
      const chunk = this._chunks.get(chunkId);
      if (chunk) { this._tileCount -= chunk.count; this._chunks.delete(chunkId); }
      return this;
    }

    exportRecipe() {
      const overrides = [];
      for (const [id, patch] of this._overrides) {
        const [x, y] = id.split(',').map(Number);
        overrides.push(Object.assign({x, y}, patch));
      }
      overrides.sort((a, b) => a.y - b.y || a.x - b.x);
      return {format: 'emberwake-world', version: 1, config: Object.assign({}, this.config), overrides};
    }

    static fromRecipe(recipe) {
      if (typeof recipe === 'string') {
        if (recipe.length > MAX_RECIPE_TEXT) throw new RangeError('Recipe text exceeds the 4 MiB import limit.');
        try { recipe = JSON.parse(recipe); } catch (_) { throw new TypeError('Recipe text is not valid JSON.'); }
      }
      plainObject(recipe, ['format', 'version', 'config', 'overrides'], 'recipe');
      if (recipe.format !== 'emberwake-world' || recipe.version !== 1) {
        throw new TypeError('Unsupported world recipe format or version.');
      }
      if (!hasOwn(recipe, 'config') || !hasOwn(recipe, 'overrides')) {
        throw new TypeError('A recipe requires config and overrides.');
      }
      plainObject(recipe.config, CONFIG_KEYS, 'recipe config');
      if (CONFIG_KEYS.some(field => !hasOwn(recipe.config, field))) {
        throw new TypeError('A recipe must include all six config fields.');
      }
      return new World(recipe.config, recipe.overrides);
    }

    stats() {
      return Object.freeze({chunks: this._chunks.size, tiles: this._tileCount,
        macroCells: this._macro.size, cacheHits: this._cacheHits, cacheMisses: this._cacheMisses,
        overrides: this._overrides.size, chunkSize: CHUNK_SIZE, maxChunks: MAX_CHUNKS,
        macroSize: MACRO_SIZE, maxMacroCells: MAX_MACRO_CELLS, maxOverrides: MAX_OVERRIDES});
    }
  }

  return Object.freeze({World, normalizeConfig, BIOMES, DEFAULTS, SIZES,
    fromRecipe: recipe => World.fromRecipe(recipe),
    LIMITS: Object.freeze({chunkSize: CHUNK_SIZE, maxChunks: MAX_CHUNKS,
      macroSize: MACRO_SIZE, maxMacroCells: MAX_MACRO_CELLS,
      maxOverrides: MAX_OVERRIDES, maxSiteResults: MAX_SITE_RESULTS, maxRecipeText: MAX_RECIPE_TEXT})});
});
