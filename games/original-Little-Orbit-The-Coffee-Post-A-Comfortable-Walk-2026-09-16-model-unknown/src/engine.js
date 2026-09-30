/**
 * engine.js — the game's small scene graph (Node) and its three.js renderer.
 *
 * The game builds and animates plain Node trees (position / rotation /
 * scale arrays, or an explicit column-major matrix, a named geometry and a
 * tint). The Renderer turns those trees into three.js objects:
 *
 *   - every untextured mesh part becomes one instance of a THREE.BatchedMesh,
 *     so thousands of parts share a handful of materials and draw calls;
 *   - static parts live in their own batches and are placed once, so their
 *     matrix and colour textures are uploaded once; dynamic trees are walked
 *     every frame and only the parts whose transform or tint changed are
 *     written again, into small batches of their own;
 *   - one CPU pass per frame hides parts beyond the planet's horizon, outside
 *     the view (except near the shadow focus, so off-screen casters still
 *     cast), and small "detail" parts far from the camera. BatchedMesh then
 *     only rebuilds its draw list when that visibility changes, instead of
 *     frustum-culling every instance for every pass;
 *   - textured parts (signs, the cinema screen, the mural) are ordinary
 *     meshes with MeshBasicNodeMaterial.
 *
 * Lighting reproduces the hand-written shader: a radial sky/ground hemisphere
 * term (the "up" direction is away from the planet centre), a warm sun term
 * with three.js shadows that darken it to 52 %, a softer wrap light with a rim
 * for the painted characters, fog by eye distance, and a dithered fade for
 * small props far away.
 */
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, vec4, mix, pow, fract, floor, dot, smoothstep, uniform, fog,
  positionWorld, positionView, normalView, normalWorld, cameraPosition, diffuseColor,
  batchColor, output, screenCoordinate,
} from 'three/tsl';
import { color } from './math.js';

class Node {
  constructor(name='group'){this.name=name;this.position=[0,0,0];this.rotation=[0,0,0];this.scale=[1,1,1];this.children=[];this.mesh=null;this.tint=[1,1,1,1];this.visible=true;this.matrix=null;this.texture=null;this.unlit=false;this.painted=false;this.transparent=false;}
  add(...nodes){this.children.push(...nodes);return nodes[nodes.length-1];}
  part(geometry,tint,p=[0,0,0],s=[1,1,1],r=[0,0,0],name='part'){const n=new Node(name);n.mesh=geometry;n.tint=[...color(tint),1];n.position=p;n.scale=s;n.rotation=r;this.add(n);return n;}
  find(name){if(this.name===name)return this;for(const c of this.children){const n=c.find(name);if(n)return n;}return null;}
  clone(){const n=new Node(this.name);n.position=[...this.position];n.rotation=[...this.rotation];n.scale=[...this.scale];n.mesh=this.mesh;n.tint=[...this.tint];n.matrix=this.matrix?new Float32Array(this.matrix):null;n.texture=this.texture;n.unlit=this.unlit;n.painted=this.painted;n.visible=this.visible;n.transparent=this.transparent;n.children=this.children.map(c=>c.clone());return n;}
}

/* ------------------------------------------------------------------ shading */

const SKY = vec3(.77, .81, .73), GROUND = vec3(.51, .49, .45), SUN = vec3(.40, .31, .22);
const PAINT_SKY = vec3(.81, .80, .72), PAINT_GROUND = vec3(.66, .62, .57), PAINT_SUN = vec3(.29, .24, .19), RIM = vec3(1, .91, .72);
const FOG_COLOR = new THREE.Color(.91, .84, .72);
/** In the shadow the sun term keeps 52 % of its strength, as before. */
const SHADOW_STRENGTH = .48;
const PLANET_R = 25.85;

// Opaque batches keep three per-instance flags in the alpha of the instance colour:
// bit 0 painted (soft character light), bit 1 unlit, bit 2 detail (dithered fade).
const flagAlpha = (painted, unlit, detail) => (((painted ? 1 : 0) | (unlit ? 2 : 0) | (detail ? 4 : 0)) + .5) / 8;
const batchFlags = () => {
  const code = floor(batchColor.a.mul(8));
  return { painted: code.mod(2), unlit: floor(code.div(2)).mod(2), detail: floor(code.div(4)).mod(2) };
};
const fixedFlags = (painted, unlit) => () => ({ painted: float(painted ? 1 : 0), unlit: float(unlit ? 1 : 0), detail: float(0) });
// The mode is a string property on purpose: three.js builds a material's program cache key
// from its property values, so each mode must read differently there.
const FLAG_MODES = { batch: batchFlags, lit: fixedFlags(false, false), unlit: fixedFlags(false, true) };

class OrbitLighting extends THREE.LightingModel {
  constructor(flags) { super(); this.flags = flags; }
  direct({ lightDirection, lightColor, reflectedLight }) {
    const { painted, unlit } = this.flags();
    // The sun is white at intensity 1, so its colour here is the shadow factor.
    const shadow = lightColor.x;
    const ndl = normalView.dot(lightDirection);
    const plain = SUN.mul(ndl.max(0)).mul(shadow);
    const wrap = ndl.add(.5).div(1.5).clamp(0, 1);
    const soft = PAINT_SUN.mul(wrap).mul(mix(float(.75), float(1), shadow));
    const sun = mix(plain, soft, painted).mul(float(1).sub(unlit));
    reflectedLight.directDiffuse.addAssign(diffuseColor.rgb.mul(sun));
  }
  indirect(builder) {
    const { reflectedLight } = builder.context;
    const { painted, unlit } = this.flags();
    const hemi = normalWorld.dot(positionWorld.normalize()).mul(.5).add(.5);
    const plain = mix(GROUND, SKY, hemi);
    const rim = pow(float(1).sub(normalWorld.dot(cameraPosition.sub(positionWorld).normalize()).max(0)), 3).mul(.055);
    const soft = mix(PAINT_GROUND, PAINT_SKY, hemi).add(RIM.mul(rim));
    const light = mix(mix(plain, soft, painted), vec3(1), unlit);
    reflectedLight.indirectDiffuse.addAssign(diffuseColor.rgb.mul(light));
  }
}

class OrbitMaterial extends THREE.MeshLambertNodeMaterial {
  constructor(params, mode) { super(params); this.orbitMode = mode; }
  setupLightingModel() { return new OrbitLighting(FLAG_MODES[this.orbitMode]); }
}

/** Opaque results keep full alpha: the canvas is transparent where the sky is. */
const opaqueOutput = () => vec4(output.rgb, float(1));

/* ------------------------------------------------------------------ batches */

const IDENTITY = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v4 = new THREE.Vector4();

class Batch {
  constructor(key, kind, material, { cast = false, receive = true, sort = false } = {}) {
    this.key = key; this.kind = kind; this.material = material; this.opts = { cast, receive, sort };
    this.maxInstances = 0; this.maxVertices = 0; this.usedVertices = 0; this.count = 0;
    this.geoIds = new Map(); this.mesh = null;
  }
  create(scene, instances, vertices) {
    this.maxInstances = Math.max(64, instances); this.maxVertices = Math.max(1024, vertices);
    const m = new THREE.BatchedMesh(this.maxInstances, this.maxVertices, 0, this.material);
    m.name = 'orbit-' + this.key;
    // The batch spans the planet. Renderer.cull() hides instances itself, once per frame,
    // so three.js does not frustum-cull every instance again for the shadow and main passes.
    m.frustumCulled = false;
    m.perObjectFrustumCulled = false;
    m.sortObjects = this.opts.sort;
    m.castShadow = this.opts.cast; m.receiveShadow = this.opts.receive;
    this.mesh = m; scene.add(m);
  }
  geometryId(geo) {
    let id = this.geoIds.get(geo.id);
    if (id !== undefined) return id;
    if (this.usedVertices + geo.count > this.maxVertices) {
      this.maxVertices = Math.ceil(Math.max(this.maxVertices * 1.5, this.usedVertices + geo.count + 1024));
      this.mesh.setGeometrySize(this.maxVertices, 0);
    }
    id = this.mesh.addGeometry(geo.batchGeometry());
    this.usedVertices += geo.count;
    this.geoIds.set(geo.id, id);
    return id;
  }
  add(geo) {
    const gid = this.geometryId(geo);
    if (this.count >= this.maxInstances) {
      this.maxInstances = Math.ceil(this.maxInstances * 1.5) + 16;
      this.mesh.setInstanceCount(this.maxInstances);
    }
    this.count++;
    return this.mesh.addInstance(gid);
  }
  remove(id) { this.mesh.deleteInstance(id); this.count--; }
}

/* ------------------------------------------------------------------ geometry */

class Geometry {
  constructor(id, p, n, uv, c) {
    this.id = id; this.count = p.length / 3; this.p = p; this.n = n; this.uv = uv; this.c = c;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i++) { const j = i % 3; if (p[i] < lo[j]) lo[j] = p[i]; if (p[i] > hi[j]) hi[j] = p[i]; }
    this.center = lo.map((v, i) => (v + hi[i]) / 2);
    let r = 0;
    for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i] - this.center[0], p[i + 1] - this.center[1], p[i + 2] - this.center[2]));
    this.radius = r; this._batch = null; this._textured = new Map();
  }
  batchGeometry() {
    if (!this._batch) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
      this._batch = g;
    }
    return this._batch;
  }
  /** A copy with its UVs mapped into an atlas rectangle [x, y, w, h]. */
  texturedGeometry(rect) {
    const key = rect ? rect.join(',') : 'full';
    let g = this._textured.get(key);
    if (!g) {
      const uv = new Float32Array(this.uv);
      if (rect) for (let i = 0; i < uv.length; i += 2) { uv[i] = rect[0] + uv[i] * rect[2]; uv[i + 1] = rect[1] + uv[i + 1] * rect[3]; }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
      this._textured.set(key, g);
    }
    return g;
  }
}

/* ------------------------------------------------------------------ renderer */

class Renderer {
  constructor(kit) {
    this.kit = kit; this.gl = kit.renderer;
    this.touch = matchMedia('(any-pointer:coarse)').matches;
    this.meshes = new Map(); this.geometryPool = new Map();
    this.textures = new Map(); this.textCanvases = new Map(); this.atlasRegions = new Map(); this.textureMaterials = new Map();
    this.records = []; this.dynRecords = new Set(); this.dynamicNodes = []; this.frame = 0;
    this.resourceStats = { geometryAliases: 0, geometryBytes: 0, staticInstances: 0 };
    this.stats = {};
    this.cinematic = false;

    const scene = this.scene = new THREE.Scene();
    // Only geometry is fogged: the sky stays the page's own soft gradient.
    scene.fogNode = fog(vec3(FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b), smoothstep(48, 145, positionView.length()).mul(.7));
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(48, 1, .1, 230));

    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = .1; sc.far = 100; sc.updateProjectionMatrix();
    sun.shadow.bias = -.0012; sun.shadow.normalBias = .03; sun.shadow.radius = 2.2;
    sun.shadow.intensity = SHADOW_STRENGTH;
    kit.shadow(sun, 2048);
    scene.add(sun, sun.target);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.shadowClock = 0; this.shadowAnchor = new THREE.Vector3(1e9, 0, 0); this.shadowDir = new THREE.Vector3();

    this.fadeNear = uniform(this.touch ? 25 : 35); this.fadeFar = uniform(this.touch ? 33 : 45);
    const opaque = () => {
      const m = new OrbitMaterial({ vertexColors: true }, 'batch');
      const f = batchFlags();
      const fade = float(1).sub(smoothstep(this.fadeNear, this.fadeFar, cameraPosition.distance(positionWorld)));
      const dither = fract(float(52.9829189).mul(fract(dot(floor(screenCoordinate.xy), vec2(.06711056, .00583715)))));
      m.maskNode = f.detail.lessThan(.5).or(dither.lessThanEqual(fade));
      m.outputNode = opaqueOutput();
      return m;
    };
    const clear = (mode) => new OrbitMaterial({ vertexColors: true, transparent: true, depthWrite: false }, mode);
    // Four kinds: c = casts shadows, nc = no shadow (small, unlit or detail parts),
    // tl / tu = transparent lit / unlit. Scenery and moving parts get separate batches,
    // so a moving courier never re-uploads the whole planet's instance textures.
    const set = (suffix) => ({
      c: new Batch('c' + suffix, 'c', opaque(), { cast: true }),
      nc: new Batch('nc' + suffix, 'nc', opaque(), {}),
      tl: new Batch('tl' + suffix, 'tl', clear('lit'), { sort: true }),
      tu: new Batch('tu' + suffix, 'tu', clear('unlit'), { sort: true, receive: false }),
    });
    this.batches = { s: set('s'), d: set('d') };
    this.texGroup = new THREE.Group(); scene.add(this.texGroup);
    this.focus = new THREE.Vector3(); this.planes = new Float64Array(16); this._vp = new THREE.Matrix4();
  }

  /* ---- geometry and textures */

  register(name, g) {
    if (this.meshes.has(name)) return this.meshes.get(name);
    const count = g.p.length / 3;
    const f32 = a => a instanceof Float32Array ? a : new Float32Array(a);
    const p = f32(g.p);
    const n = g.n && g.n.length === count * 3 ? f32(g.n) : new Float32Array(count * 3).map((_, i) => i % 3 === 1 ? 1 : 0);
    const uv = g.uv && g.uv.length === count * 2 ? f32(g.uv) : new Float32Array(count * 2);
    const c = g.c && g.c.length === count * 3 ? f32(g.c) : new Float32Array(count * 3).fill(1);
    // Equal bytes share one geometry. Check bytes after hashing as well.
    const arrays = [p, n, uv, c];
    let hash = 2166136261;
    for (const a of arrays) { const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < bytes.length; i++) { hash ^= bytes[i]; hash = Math.imul(hash, 16777619); } }
    const key = count + ':' + (hash >>> 0), bucket = this.geometryPool.get(key) || [];
    for (const m of bucket) {
      const other = [m.p, m.n, m.uv, m.c];
      let same = true;
      for (let j = 0; j < 4 && same; j++) { const a = arrays[j], b = other[j]; if (a.length !== b.length) { same = false; break; } for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; } }
      if (same) { this.meshes.set(name, m); this.resourceStats.geometryAliases++; return m; }
    }
    const mesh = new Geometry(name, p, n, uv, c);
    for (const a of arrays) this.resourceStats.geometryBytes += a.byteLength;
    bucket.push(mesh); this.geometryPool.set(key, bucket); this.meshes.set(name, mesh);
    return mesh;
  }

  textTexture(id, words, opts = {}) {
    if (this.textures.has(id) || this.textCanvases.has(id)) return id;
    const c = document.createElement('canvas'); c.width = opts.width || 512; c.height = opts.height || 192;
    const x = c.getContext('2d');
    x.fillStyle = opts.bg || '#fff3d9'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = opts.color || '#385149'; x.font = `${opts.bold === false ? '' : 'bold '}${opts.size || 47}px ${opts.serif ? 'Georgia' : 'sans-serif'}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const lines = words.split('\n');
    lines.forEach((w, i) => x.fillText(w, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * (opts.line || 58), c.width - 34));
    if (id === 'pocket-film' || this.atlasBuilt) {
      // A live texture (the cinema screen) or a late sign: its own texture, not the atlas.
      const t = new THREE.CanvasTexture(c);
      t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      this.textures.set(id, t);
    } else this.textCanvases.set(id, c);
    return id;
  }

  /** Load an image texture without holding up the start. Parts using it show plain until it arrives. */
  imageTexture(id, url) {
    if (this.textures.has(id)) return Promise.resolve(id);
    return new THREE.TextureLoader().loadAsync(url).then(t => {
      t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      this.textures.set(id, t);
      for (const rec of this.records) if (rec.tex && rec.node.texture === id) rec.mesh.material = this.textureMaterial(rec.node, rec.transparent);
      return id;
    });
  }

  updateTexture(id, canvas) {
    const t = this.textures.get(id); if (!t) return;
    t.image = canvas; t.needsUpdate = true;
  }

  buildAtlas() {
    this.atlasBuilt = true;
    if (!this.textCanvases.size) return;
    const list = [...this.textCanvases];
    for (let start = 0; start < list.length; start += 128) {
      const page = list.slice(start, start + 128), rows = Math.ceil(page.length / 8), height = 2 ** Math.ceil(Math.log2(rows * 128)), width = 2048;
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const x = c.getContext('2d');
      const id = '__sign_atlas_' + start;
      page.forEach(([name, src], i) => {
        const px = (i % 8) * 256 + 6, py = Math.floor(i / 8) * 128 + 6, w = 244, h = Math.min(116, Math.round(src.height / src.width * w));
        x.drawImage(src, px, py, w, h);
        // Extend edge pixels into the gutter. This prevents colour bleed in mipmaps.
        x.drawImage(c, px, py, w, 1, px, py - 4, w, 4); x.drawImage(c, px, py + h - 1, w, 1, px, py + h, w, 4);
        x.drawImage(c, px, py, 1, h, px - 4, py, 4, h); x.drawImage(c, px + w - 1, py, 1, h, px + w, py, 4, h);
        this.atlasRegions.set(name, { texture: id, uv: [px / width, 1 - (py + h) / height, w / width, h / height] });
      });
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      this.textures.set(id, t);
    }
    this.textCanvases.clear();
  }

  textureMaterial(node, transparent) {
    const region = this.atlasRegions.get(node.texture), texId = region ? region.texture : node.texture;
    const map = this.textures.get(texId) || null, t = node.tint;
    const key = [texId, map ? 1 : 0, t[0], t[1], t[2], transparent ? t[3] : 1, !!node.unlit].join('|');
    let m = this.textureMaterials.get(key);
    if (!m) {
      const params = { color: new THREE.Color(t[0], t[1], t[2]), map, alphaTest: .15 };
      if (transparent) Object.assign(params, { transparent: true, opacity: t[3], depthWrite: false });
      if (!map) params.color = new THREE.Color(.91, .85, .74); // plaster, until the image arrives
      m = node.unlit ? new THREE.MeshBasicNodeMaterial(params) : new OrbitMaterial(params, 'lit');
      if (!transparent) m.outputNode = opaqueOutput();
      this.textureMaterials.set(key, m);
    }
    return m;
  }

  /* ---- the scene */

  /** Place the scenery that never moves. Call once, after every text texture exists. */
  setStatic(nodes) {
    this.buildAtlas();
    const flat = [];
    const walk = (n, parent, painted, transparent, detail) => {
      if (!n.visible) return;
      const c = this.cacheOf(n); this.localMatrix(n, c);
      c.world.multiplyMatrices(parent, c.local);
      painted = painted || n.painted; transparent = transparent || n.transparent;
      if (/^(flower|grain)$/.test(n.name)) detail = true;
      if (n.mesh) flat.push([n, c.world, painted, transparent, detail]);
      for (const ch of n.children) walk(ch, c.world, painted, transparent, detail);
    };
    for (const n of nodes) walk(n, IDENTITY, false, false, false);
    // Scenery batches are sized exactly (plus the warm-up instance); moving parts get
    // generous room up front, and grow if they ever need more.
    const need = { c: [16, 0], nc: [16, 0], tl: [16, 0], tu: [16, 0] }, seen = { c: new Set(), nc: new Set(), tl: new Set(), tu: new Set() };
    const warm = this.meshes.get('smooth') || this.meshes.values().next().value;
    const kinds = flat.map(([n, m, painted, transparent, detail]) => {
      const geo = this.meshes.get(n.mesh); if (!geo) return null;
      if (n.texture) return 'tex';
      const small = geo.radius * m.getMaxScaleOnAxis() < .13;
      const k = transparent ? (n.unlit ? 'tu' : 'tl') : (n.unlit || detail || small) ? 'nc' : 'c';
      need[k][0]++; if (!seen[k].has(geo)) { seen[k].add(geo); need[k][1] += geo.count; }
      return k;
    });
    const room = { c: [4096, 160000], nc: [1024, 24000], tl: [256, 8000], tu: [256, 8000] };
    for (const k of Object.keys(need)) {
      const s = this.batches.s[k], d = this.batches.d[k];
      if (!s.mesh) s.create(this.scene, need[k][0], need[k][1] + warm.count + 64);
      if (!d.mesh) d.create(this.scene, room[k][0], room[k][1]);
    }
    // One permanently hidden instance per batch: compiles every material up front
    // and creates each batch's colour texture before the first frame.
    for (const set of [this.batches.s, this.batches.d]) for (const b of Object.values(set)) {
      const id = b.add(warm); b.mesh.setColorAt(id, _v4.set(1, 1, 1, 1)); b.mesh.setVisibleAt(id, false);
    }
    flat.forEach(([n, m, painted, transparent, detail], i) => {
      const kind = kinds[i]; if (!kind) return;
      const geo = this.meshes.get(n.mesh);
      const small = geo.radius * m.getMaxScaleOnAxis() < .13;
      const rec = kind === 'tex' ? this.addTextured(n, geo, transparent, false) : this.addInstance(n, geo, kind, false);
      rec.detail = kind !== 'tex' && (detail || small);
      this.place(rec, m);
      if (kind !== 'tex') this.colour(rec, n.tint, painted, n.unlit, rec.detail);
    });
    this.resourceStats.staticInstances = flat.length;
  }

  setDynamic(nodes) { this.dynamicNodes = nodes; }

  cacheOf(n) {
    return n._rc || (n._rc = { state: new Float64Array(9).fill(NaN), src: null, local: new THREE.Matrix4(), world: new THREE.Matrix4(), ver: 0, parent: null, pver: -1 });
  }

  /** Update a node's local matrix from its arrays (or its explicit matrix). Returns true if it changed. */
  localMatrix(n, c) {
    if (n.matrix) {
      if (c.src === n.matrix) return false;
      c.local.fromArray(n.matrix); c.src = n.matrix; return true;
    }
    const s = c.state, P = n.position, R = n.rotation, S = n.scale;
    let changed = c.src !== null; c.src = null;
    for (let i = 0; i < 3; i++) {
      if (s[i] !== P[i]) { s[i] = P[i]; changed = true; }
      if (s[i + 3] !== R[i]) { s[i + 3] = R[i]; changed = true; }
      if (s[i + 6] !== S[i]) { s[i + 6] = S[i]; changed = true; }
    }
    if (changed) c.local.compose(_p.set(P[0], P[1], P[2]), _q.setFromEuler(_e.set(R[0], R[1], R[2], 'XYZ')), _s.set(S[0], S[1], S[2]));
    return changed;
  }

  addInstance(node, geo, kind, dynamic) {
    const batch = this.batches[dynamic ? 'd' : 's'][kind];
    const rec = { node, geo, batch, id: batch.add(geo), tex: false, dynamic, shown: true, nodeVisible: true, stamp: this.frame, wver: -1, wsrc: null, detail: false,
      t0: NaN, t1: NaN, t2: NaN, t3: NaN, cx: 0, cy: 0, cz: 0, r: 0, dx: 0, dy: 1, dz: 0, clen: 0, k: Infinity, cosK: 1, sinK: 0, index: this.records.length };
    this.records.push(rec);
    if (dynamic) this.dynRecords.add(rec);
    return rec;
  }

  addTextured(node, geo, transparent, dynamic) {
    const region = this.atlasRegions.get(node.texture);
    const mesh = new THREE.Mesh(geo.texturedGeometry(region ? region.uv : null), this.textureMaterial(node, transparent));
    mesh.matrixAutoUpdate = false;
    this.texGroup.add(mesh);
    const rec = { node, geo, mesh, tex: true, transparent, dynamic, shown: true, nodeVisible: true, stamp: this.frame, wver: -1, wsrc: null, detail: false,
      cx: 0, cy: 0, cz: 0, r: 0, dx: 0, dy: 1, dz: 0, clen: 0, k: Infinity, cosK: 1, sinK: 0, index: this.records.length, tintKey: node.tint.join(',') };
    this.records.push(rec);
    if (dynamic) this.dynRecords.add(rec);
    return rec;
  }

  release(rec) {
    if (rec.tex) { this.texGroup.remove(rec.mesh); if (rec.node._rt === rec) rec.node._rt = null; }
    else { rec.batch.remove(rec.id); if (rec.node._ri === rec) rec.node._ri = null; }
    this.dynRecords.delete(rec);
    const last = this.records.pop();
    if (last !== rec) { this.records[rec.index] = last; last.index = rec.index; }
  }

  /** Upload a world matrix and refresh the bounds used for horizon and detail culling. */
  place(rec, m) {
    if (rec.tex) { rec.mesh.matrix.copy(m); rec.mesh.matrixWorldNeedsUpdate = true; }
    else rec.batch.mesh.setMatrixAt(rec.id, m);
    const e = m.elements, g = rec.geo, c = g.center;
    rec.cx = e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12];
    rec.cy = e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13];
    rec.cz = e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14];
    rec.r = g.radius * m.getMaxScaleOnAxis();
    const clen = Math.hypot(rec.cx, rec.cy, rec.cz) || 1;
    rec.clen = clen; rec.dx = rec.cx / clen; rec.dy = rec.cy / clen; rec.dz = rec.cz / clen;
    // Keep a loose horizon bound. It must not remove bridges, rails, or tall trees.
    if (rec.r < 15 && clen > PLANET_R) {
      rec.k = Math.acos(Math.min(1, PLANET_R / (clen + rec.r))) + Math.asin(Math.min(1, rec.r / clen)) + .025;
      rec.cosK = Math.cos(rec.k); rec.sinK = Math.sin(rec.k);
    } else rec.k = Infinity;
  }

  colour(rec, t, painted, unlit, detail) {
    const a = rec.batch.kind === 'c' || rec.batch.kind === 'nc' ? flagAlpha(painted, unlit, detail) : (t[3] ?? 1);
    if (t[0] === rec.t0 && t[1] === rec.t1 && t[2] === rec.t2 && a === rec.t3) return;
    rec.t0 = t[0]; rec.t1 = t[1]; rec.t2 = t[2]; rec.t3 = a;
    rec.batch.mesh.setColorAt(rec.id, _v4.set(t[0], t[1], t[2], a));
  }

  /** Walk the moving trees: new parts get instances, changed parts are uploaded again. */
  sync() {
    this.frame++;
    for (const root of this.dynamicNodes) this.walk(root, IDENTITY, null, 0, false, false);
    for (const rec of this.dynRecords) {
      if (rec.stamp === this.frame) continue;
      rec.nodeVisible = false;
      // A part that has not been drawn for a while (a spent particle) gives its slot back.
      if (this.frame - rec.stamp > 900) this.release(rec);
    }
  }

  walk(n, parentWorld, parentCache, parentVer, painted, transparent) {
    if (!n.visible) return;
    const c = this.cacheOf(n);
    const changed = this.localMatrix(n, c);
    if (changed || c.parent !== parentCache || c.pver !== parentVer || c.ver === 0) {
      c.world.multiplyMatrices(parentWorld, c.local); c.ver++; c.parent = parentCache; c.pver = parentVer;
    }
    painted = painted || n.painted; transparent = transparent || n.transparent;
    if (n.mesh) this.touchPart(n, c, painted, transparent);
    const ch = n.children;
    for (let i = 0; i < ch.length; i++) this.walk(ch[i], c.world, c, c.ver, painted, transparent);
  }

  touchPart(n, c, painted, transparent) {
    const geo = this.meshes.get(n.mesh); if (!geo) return;
    let rec;
    if (n.texture) {
      rec = n._rt;
      if (rec && rec.transparent !== transparent) { this.release(rec); rec = null; }
      if (!rec) { rec = n._rt = this.addTextured(n, geo, transparent, true); }
      const tk = n.tint.join(',');
      if (tk !== rec.tintKey) { rec.tintKey = tk; rec.mesh.material = this.textureMaterial(n, transparent); }
    } else {
      const kind = transparent ? (n.unlit ? 'tu' : 'tl') : n.unlit ? 'nc' : 'c';
      rec = n._ri;
      if (rec && rec.batch.kind !== kind) { this.release(rec); rec = null; }
      if (!rec) rec = n._ri = this.addInstance(n, geo, kind, true);
      this.colour(rec, n.tint, painted, n.unlit, false);
    }
    rec.stamp = this.frame; rec.nodeVisible = true;
    if (rec.wver !== c.ver || rec.wsrc !== c) { rec.wver = c.ver; rec.wsrc = c; this.place(rec, c.world); }
  }

  /** The four side planes of the view (a, b, c, d each; inside when a·x + b·y + c·z + d ≥ 0). */
  viewPlanes(cam) {
    const e = this._vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements, P = this.planes;
    // Row r of a column-major matrix is e[r], e[r+4], e[r+8], e[r+12].
    for (let i = 0; i < 4; i++) {
      const row = i >> 1, sign = i & 1 ? -1 : 1;
      let a = e[3] + sign * e[row], b = e[7] + sign * e[4 + row], c = e[11] + sign * e[8 + row], d = e[15] + sign * e[12 + row];
      const l = Math.hypot(a, b, c) || 1;
      P[i * 4] = a / l; P[i * 4 + 1] = b / l; P[i * 4 + 2] = c / l; P[i * 4 + 3] = d / l;
    }
  }

  /**
   * Hide what is behind the planet, outside the view or too far to see. Parts near the
   * shadow focus stay even when off-screen, so they still cast into the view.
   */
  cull(eye) {
    const ex = eye.x, ey = eye.y, ez = eye.z, elen = Math.hypot(ex, ey, ez) || 1;
    const horizon = elen > PLANET_R + 1, aE = horizon ? Math.acos(PLANET_R / elen) : 0, cosE = Math.cos(aE), sinE = Math.sin(aE);
    const far = this.fadeFar.value, recs = this.records, P = this.planes, F = this.focus, keep = 27;
    let shown = 0;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      let vis = rec.nodeVisible;
      if (vis && horizon && rec.k !== Infinity && aE + rec.k < Math.PI) {
        const d = (ex * rec.dx + ey * rec.dy + ez * rec.dz) / elen;
        if (d < cosE * rec.cosK - sinE * rec.sinK) vis = false;
      }
      if (vis && rec.detail && Math.hypot(rec.cx - ex, rec.cy - ey, rec.cz - ez) - rec.r > far) vis = false;
      if (vis && !rec.tex) {
        // Textured meshes are ordinary three.js objects: three.js frustum-culls those itself.
        const r = rec.r;
        for (let p = 0; p < 16; p += 4) {
          if (P[p] * rec.cx + P[p + 1] * rec.cy + P[p + 2] * rec.cz + P[p + 3] < -r) {
            if (Math.hypot(rec.cx - F.x, rec.cy - F.y, rec.cz - F.z) - r > keep) vis = false;
            break;
          }
        }
      }
      if (vis !== rec.shown) {
        rec.shown = vis;
        if (rec.tex) rec.mesh.visible = vis; else rec.batch.mesh.setVisibleAt(rec.id, vis);
      }
      if (vis) shown++;
    }
    this.stats.visibleParts = shown; this.stats.parts = recs.length;
  }

  /**
   * Draw one frame.
   * view: { eye, target, up, fov (radians), shift, yshift, sun, focus, focusUp, shadows, viewport }
   */
  render(view) {
    const cam = this.camera, gl = this.gl;
    cam.up.set(view.up[0], view.up[1], view.up[2]);
    cam.position.set(view.eye[0], view.eye[1], view.eye[2]);
    cam.lookAt(view.target[0], view.target[1], view.target[2]);
    const fov = view.fov * 180 / Math.PI;
    const shift = view.shift || 0, yshift = view.yshift || 0;
    const vp = view.viewport || null;
    const aspect = vp ? vp.w / vp.h : this.kit.size.width / this.kit.size.height;
    let dirty = false;
    if (cam.fov !== fov) { cam.fov = fov; dirty = true; }
    if (cam.aspect !== aspect) { cam.aspect = aspect; dirty = true; }
    if (shift || yshift) {
      const v = cam.view;
      if (!v || !v.enabled || v.offsetX !== shift / 2 || v.offsetY !== -yshift / 2) { cam.setViewOffset(1, 1, shift / 2, -yshift / 2, 1, 1); dirty = false; }
    } else if (cam.view && cam.view.enabled) { cam.clearViewOffset(); dirty = false; }
    if (dirty) cam.updateProjectionMatrix();

    // The sun follows the walk: a 48 m shadow square around the focus point.
    const s = view.sun, f = view.focus, sun = this.sun;
    sun.target.position.set(f[0], f[1], f[2]);
    sun.position.set(f[0] + s[0] * 48, f[1] + s[1] * 48, f[2] + s[2] * 48);
    sun.shadow.camera.up.set(view.focusUp[0], view.focusUp[1], view.focusUp[2]);
    sun.shadow.intensity = view.shadows ? SHADOW_STRENGTH : 0;
    // Shadows refresh every frame on high tiers; lighter tiers refresh when the view moves or twice as rarely.
    const tier = this.kit.tier.name;
    const moved = this.shadowAnchor.distanceToSquared(sun.target.position) > .0004 || this.shadowDir.distanceToSquared(_p.set(s[0], s[1], s[2])) > .00002;
    this.shadowClock++;
    const refresh = view.shadows && (this.cinematic || tier === 'high' || tier === 'ultra' || moved || this.shadowClock % 2 === 0);
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = refresh;
    if (refresh) { this.shadowAnchor.copy(sun.target.position); this.shadowDir.set(s[0], s[1], s[2]); }

    this.sync();
    cam.updateMatrixWorld();
    this.viewPlanes(cam);
    this.focus.set(f[0], f[1], f[2]);
    this.cull(cam.position);
    if (vp) {
      gl.setViewport(vp.x, vp.y, vp.w, vp.h); gl.setScissor(vp.x, vp.y, vp.w, vp.h); gl.setScissorTest(true);
      this.letterboxed = true;
    } else if (this.letterboxed) {
      this.letterboxed = false; gl.setScissorTest(false); gl.setViewport(0, 0, this.kit.size.width, this.kit.size.height);
    }
    gl.render(this.scene, cam);
  }
}

export { Node, Renderer };
