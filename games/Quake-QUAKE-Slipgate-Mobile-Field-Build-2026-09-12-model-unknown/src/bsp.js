// Quake BSP29 map explorer: geometry, palette textures, baked light levels and world collision
// from a pak0.pak the player loads locally. QuakeC, doors, lifts and monsters are not run.
import { parseEntities } from './pak.js';
import { geometry, triangle } from './geometry.js';
import { dot } from './math.js';

const SCALE = 1 / 32;
const toWorld = (p) => [p[0] * SCALE, p[2] * SCALE, -p[1] * SCALE];
const toQuake = (p) => [p[0] / SCALE, -p[2] / SCALE, p[1] / SCALE];

export class BSPWorld {
  constructor(bytes, palette, name = 'Quake map') {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.batches = new Map();
    this.colliders = [];
    this.textures = {};
    // Materials for this map's own textures; view.js looks here before the shared table.
    this.materialDefs = {};
    this.pickups = [];
    this.lava = [];
    this.decor = [];
    this.imported = true;
    this.id = 'bsp';
    this.name = name.replace('maps/', '').replace('.bsp', '').toUpperCase();
    this.subtitle = 'LOCAL PAK / MAP EXPLORER';
    this.exit = [0, 0, 0];
    this.lights = [];
    this.waves = [];
    this.secretCount = 0;
    this.clampXZ = null;
    this.menuEnemies = [];
    if (bytes.byteLength < 124 || this.view.getInt32(0, true) !== 29) throw Error('Only Quake BSP version 29 is supported.');
    this.lumps = [];
    for (let i = 0; i < 15; i++) {
      const offset = this.i32(4 + i * 8);
      const length = this.i32(8 + i * 8);
      if (offset < 0 || length < 0 || offset + length > bytes.byteLength) throw Error(`BSP lump ${i} is outside the file.`);
      this.lumps.push({ offset, length });
    }
    const count = (i, size) => {
      const l = this.lumps[i];
      if (l.length % size) throw Error(`BSP lump ${i} has a broken record.`);
      return l.length / size;
    };
    this.entities = parseEntities(new TextDecoder().decode(this.lump(0)));
    this.vertices = Array.from({ length: count(3, 12) }, (_, i) => this.vec(this.lumps[3].offset + i * 12));
    this.planes = Array.from({ length: count(1, 20) }, (_, i) => {
      const p = this.lumps[1].offset + i * 20;
      return { normal: this.vec(p), distance: this.f32(p + 12) };
    });
    this.clipnodes = Array.from({ length: count(9, 8) }, (_, i) => {
      const p = this.lumps[9].offset + i * 8;
      return { plane: this.i32(p), children: [this.i16(p + 4), this.i16(p + 6)] };
    });
    this.models = Array.from({ length: count(14, 64) }, (_, i) => {
      const p = this.lumps[14].offset + i * 64;
      return { min: this.vec(p), max: this.vec(p + 12), head: this.i32(p + 40), first: this.i32(p + 56), count: this.i32(p + 60) };
    });
    if (!this.models.length) throw Error('The BSP has no world model.');
    this.validateCollision();
    this.parseTextures(palette);
    this.parseFaces(count(7, 20));
    this.spawnEntity = this.entities.find((e) => e.classname === 'info_player_start') || this.entities.find((e) => e.classname === 'info_player_deathmatch');
    const origin = (this.spawnEntity?.origin || '0 0 80').split(/\s+/).map(Number);
    if (origin.length !== 3 || origin.some((x) => !Number.isFinite(x))) throw Error('The player start is not valid.');
    this.spawn = toWorld(origin);
    this.spawn[1] -= 0.75;
    this.spawnYaw = (((Number(this.spawnEntity?.angle) || 0) - 90) * Math.PI) / 180;
    const a = toWorld(this.models[0].min);
    const b = toWorld(this.models[0].max);
    this.bounds = { min: a.map((v, i) => Math.min(v, b[i])), max: a.map((v, i) => Math.max(v, b[i])) };
    this.exit = this.spawn;
    for (const e of this.entities.filter((e) => e.classname?.startsWith('light')).slice(0, 8)) {
      const q = (e.origin || '0 0 0').split(/\s+/).map(Number);
      this.lights.push({ pos: toWorld(q), color: [1, 0.68, 0.32], power: 8, range: 8 });
    }
  }

  i32(p) {
    return this.view.getInt32(p, true);
  }
  i16(p) {
    return this.view.getInt16(p, true);
  }
  u16(p) {
    return this.view.getUint16(p, true);
  }
  f32(p) {
    return this.view.getFloat32(p, true);
  }
  vec(p) {
    const v = [this.f32(p), this.f32(p + 4), this.f32(p + 8)];
    if (v.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e8)) throw Error('The BSP contains an invalid coordinate.');
    return v;
  }
  lump(i) {
    const l = this.lumps[i];
    return this.bytes.subarray(l.offset, l.offset + l.length);
  }

  validateCollision() {
    if (this.clipnodes.length > 65536 || this.planes.length > 65536) throw Error('The BSP collision data exceeds the mobile limit.');
    for (const c of this.clipnodes) {
      if (!this.planes[c.plane] || c.children.some((n) => n >= this.clipnodes.length || n < -6)) throw Error('The BSP collision tree contains an invalid reference.');
    }
    const seen = new Set();
    const active = new Set();
    const visit = (n, depth) => {
      if (n < 0 || seen.has(n)) return;
      if (depth > 512 || active.has(n)) throw Error('The BSP collision tree contains a cycle.');
      const c = this.clipnodes[n];
      if (!c) throw Error('The BSP world hull is invalid.');
      active.add(n);
      for (const child of c.children) visit(child, depth + 1);
      active.delete(n);
      seen.add(n);
    };
    visit(this.models[0].head, 0);
  }

  parseTextures(palette) {
    if (!palette || palette.length !== 768) throw Error('gfx/palette.lmp is missing or invalid.');
    const l = this.lumps[2];
    if (l.length < 4) throw Error('The BSP texture table is missing.');
    const n = this.i32(l.offset);
    if (n < 0 || n > 8192 || 4 + n * 4 > l.length) throw Error('The BSP texture table is invalid.');
    this.tex = [];
    let totalPixels = 0;
    for (let i = 0; i < n; i++) {
      const relative = this.i32(l.offset + 4 + i * 4);
      if (relative === -1) {
        this.tex.push({ name: 'missing', width: 64, height: 64, mat: 'stone' });
        continue;
      }
      if (relative < 0 || relative + 40 > l.length) throw Error('Texture header is outside the lump.');
      const p = l.offset + relative;
      const width = this.i32(p + 16);
      const height = this.i32(p + 20);
      const dataOffset = this.i32(p + 24);
      if (width < 1 || height < 1 || width > 4096 || height > 4096 || dataOffset < 40 || relative + dataOffset + width * height > l.length) {
        throw Error('BSP texture dimensions or pixels are invalid.');
      }
      totalPixels += width * height;
      if (totalPixels > 16 * 1024 * 1024) throw Error('The map textures exceed the 64 MB mobile limit.');
      const name = new TextDecoder().decode(this.bytes.subarray(p, p + 16)).split('\0')[0];
      const data = new Uint8Array(width * height * 4);
      for (let j = 0; j < width * height; j++) {
        const index = this.bytes[p + dataOffset + j];
        data[j * 4] = palette[index * 3];
        data[j * 4 + 1] = palette[index * 3 + 1];
        data[j * 4 + 2] = palette[index * 3 + 2];
        data[j * 4 + 3] = 255;
      }
      const key = `pak_${i}`;
      this.textures[key] = { data, width, height };
      this.materialDefs[key] = { texture: key, color: [1, 1, 1], emissive: name.startsWith('*lava') ? 0.7 : 0 };
      this.tex.push({ name, width, height, mat: key });
    }
  }

  parseFaces(n) {
    let totalTriangles = 0;
    const edges = this.lumps[12];
    const surf = this.lumps[13];
    const texinfo = this.lumps[6];
    const light = this.lumps[8];
    if (edges.length % 4 || surf.length % 4 || texinfo.length % 40) throw Error('BSP face tables are invalid.');
    for (let i = 0; i < n; i++) {
      const p = this.lumps[7].offset + i * 20;
      const first = this.i32(p + 4);
      const num = this.u16(p + 8);
      const ti = this.u16(p + 10);
      const lightOffset = this.i32(p + 16);
      if (num < 3) continue;
      totalTriangles += num - 2;
      if (totalTriangles > 250000) throw Error('The map exceeds the mobile triangle limit.');
      if (num > 2048 || first < 0 || (first + num) * 4 > surf.length || ti * 40 + 40 > texinfo.length) throw Error('A BSP face has invalid edges.');
      const t = texinfo.offset + ti * 40;
      const svec = this.vec(t);
      const soff = this.f32(t + 12);
      const tvec = this.vec(t + 16);
      const toff = this.f32(t + 28);
      const texture = this.tex[this.i32(t + 32)] || { mat: 'stone', width: 64, height: 64, name: 'missing' };
      if (texture.name.startsWith('sky')) continue;
      const verts = [];
      const uv = [];
      for (let j = 0; j < num; j++) {
        const signed = this.i32(surf.offset + (first + j) * 4);
        const edge = Math.abs(signed);
        if (edge * 4 + 4 > edges.length) throw Error('A BSP edge index is invalid.');
        const vi = this.u16(edges.offset + edge * 4 + (signed < 0 ? 2 : 0));
        const v = this.vertices[vi];
        if (!v) throw Error('A BSP vertex index is invalid.');
        verts.push(v);
        uv.push([(dot(v, svec) + soff) / texture.width, (dot(v, tvec) + toff) / texture.height]);
      }
      let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      for (const q of uv) {
        minU = Math.min(minU, q[0] * texture.width);
        maxU = Math.max(maxU, q[0] * texture.width);
        minV = Math.min(minV, q[1] * texture.height);
        maxV = Math.max(maxV, q[1] * texture.height);
      }
      const lw = Math.ceil(maxU / 16) - Math.floor(minU / 16) + 1;
      const lh = Math.ceil(maxV / 16) - Math.floor(minV / 16) + 1;
      let shade = 0.75;
      if (lightOffset >= 0 && lw > 0 && lh > 0 && lw * lh < 65536 && lightOffset + lw * lh <= light.length) {
        let total = 0;
        for (let j = 0; j < lw * lh; j++) total += this.bytes[light.offset + lightOffset + j];
        shade = Math.min(1.3, 0.22 + total / (lw * lh) / 150);
      }
      if (!this.batches.has(texture.mat)) this.batches.set(texture.mat, geometry());
      const g = this.batches.get(texture.mat);
      const tint = [shade, shade, shade];
      for (let j = 1; j < num - 1; j++) triangle(g, toWorld(verts[0]), toWorld(verts[j]), toWorld(verts[j + 1]), [uv[0], uv[j], uv[j + 1]], tint);
    }
  }

  contents(p) {
    const q = toQuake([p[0], p[1] + 0.75, p[2]]);
    let node = this.models[0].head;
    for (let depth = 0; node >= 0; depth++) {
      if (depth > 512) throw Error('The BSP collision tree has a cycle.');
      const c = this.clipnodes[node];
      if (!c) throw Error('A BSP collision node is invalid.');
      const plane = this.planes[c.plane];
      if (!plane) throw Error('A BSP collision plane is invalid.');
      node = c.children[dot(q, plane.normal) - plane.distance >= 0 ? 0 : 1];
    }
    return node;
  }

  blocked(x, y, z) {
    return this.contents([x, y, z]) === -2;
  }

  floorAt(x, z, y = 10) {
    let top = y + 0.4;
    if (this.blocked(x, top, z)) top = y;
    let previous = top;
    for (let low = top - 0.2; low >= top - 8; low -= 0.2) {
      if (this.blocked(x, low, z)) {
        let a = low;
        let b = previous;
        for (let i = 0; i < 9; i++) {
          const mid = (a + b) / 2;
          if (this.blocked(x, mid, z)) a = mid;
          else b = mid;
        }
        return b;
      }
      previous = low;
    }
    return y - 8;
  }

  isLava(p) {
    return this.contents(p) === -5;
  }
}
