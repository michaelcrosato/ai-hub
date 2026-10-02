/**
 * The 3D asset view on the shared kit (three.js r186, WebGPU with WebGL2 fallback).
 *
 * Documents stay in the editor's Z-up world units: the cameras use +Z as up, so
 * no axis conversion happens anywhere. Shading reproduces the editor's original
 * flat key + fill light exactly (unlit node materials, no colour management), so
 * colours match the exported data. Picking, the axis handles and the overlay use
 * the same CPU camera math as before, mirrored into the three.js cameras.
 */
import * as THREE from 'three/webgpu';
import { attribute, normalize, dot, max, vec3, vec4 } from 'three/tsl';
import { boundsOf, worldMesh, triangles, vcross, vsub, vnorm, vadd, vmul, vdot, project, m4mul, perspective, orthographic, lookAt, rayTriangle, bound } from '../core/math.js';

/** Vertical field of view in radians, and the orthographic half-height per unit of distance. */
const FOV = .68, ORTHO = .34;
const TOP = Math.PI / 2 - .0001;
const KEY = vnorm([-.35, -.65, 1]), FILL = vnorm([.7, .3, .4]);
const CLAY = [.69, .73, .66];
const SELECTED = [.78, .96, .53, 1], WIRE = [.56, .63, .6, .72], COLLIDER = [1, .48, .28, .8], SHADOW = [.012, .016, .014, .055];
const GRID_MAJOR = [.3, .39, .34, .4], GRID_MINOR = [.3, .39, .34, .17];
const SOLID = [['position', 3], ['normal', 3], ['color', 4]], FLAT = [['position', 3], ['color', 4]];

/** The editor's original look: raw vertex colours (no colour management) over a transparent clear. */
export function setupRenderer(renderer) {
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
}

let shared = null;
/** One set of materials for every view: four pipelines, whatever is on screen. */
function materials() {
  if (shared) return shared;
  // The original fragment shader: 0.5 ambient + 0.46 key + 0.12 fill, on the face normal.
  const lit = () => {
    const rgba = attribute('color', 'vec4');
    const n = normalize(attribute('normal', 'vec3'));
    const light = max(dot(n, vec3(KEY[0], KEY[1], KEY[2])), 0).mul(.46).add(max(dot(n, vec3(FILL[0], FILL[1], FILL[2])), 0).mul(.12)).add(.5);
    return vec4(rgba.rgb.mul(light), rgba.a);
  };
  // Hand-written WebGL drew both sides of every face; imported meshes rely on it.
  const fill = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const solid = new THREE.MeshBasicNodeMaterial(fill);
  solid.name = 'part';
  solid.colorNode = lit();
  const glass = new THREE.MeshBasicNodeMaterial({ ...fill, transparent: true, forceSinglePass: true });
  glass.name = 'part (translucent)';
  glass.colorNode = lit();
  const line = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false });
  line.name = 'edge';
  line.colorNode = attribute('color', 'vec4');
  const shadow = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
  shadow.name = 'contact shadow';
  shadow.colorNode = attribute('color', 'vec4');
  shared = { solid, glass, line, shadow };
  return shared;
}

/** A growable float array, reused between rebuilds (no per-rebuild garbage). */
class FloatList {
  constructor(n = 4096) { this.a = new Float32Array(n); this.n = 0; }
  reset() { this.n = 0; }
  reserve(k) {
    if (this.n + k <= this.a.length) return;
    let size = this.a.length * 2;
    while (size < this.n + k) size *= 2;
    const next = new Float32Array(size);
    next.set(this.a.subarray(0, this.n));
    this.a = next;
  }
  push3(v) { this.reserve(3); const a = this.a; a[this.n++] = v[0]; a[this.n++] = v[1]; a[this.n++] = v[2]; }
  push4(v) { this.reserve(4); const a = this.a; a[this.n++] = v[0]; a[this.n++] = v[1]; a[this.n++] = v[2]; a[this.n++] = v[3]; }
}

/** One drawable (mesh or line set) whose vertex data is replaced on every rebuild. */
class Batch {
  constructor(object, layout, renderOrder) {
    this.object = object;
    this.layout = layout;
    this.capacity = 0;
    this.lists = Object.fromEntries(layout.map(([name, size]) => [name, new FloatList(1024 * size)]));
    object.renderOrder = renderOrder;
    object.frustumCulled = false;
    object.visible = false;
  }
  reset() { for (const l of Object.values(this.lists)) l.reset(); }
  get count() { return this.lists.position.n / 3; }
  commit() {
    const count = this.count;
    if (count > this.capacity) {
      // Grow in powers of two, so dragging a big asset does not reallocate every frame.
      const cap = Math.max(1024, 2 ** Math.ceil(Math.log2(count)));
      const geometry = new THREE.BufferGeometry();
      for (const [name, size] of this.layout) {
        const attr = new THREE.BufferAttribute(new Float32Array(cap * size), size);
        attr.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute(name, attr);
      }
      const old = this.object.geometry;
      this.object.geometry = geometry;
      old?.dispose();
      this.capacity = cap;
    }
    const geometry = this.object.geometry;
    if (count) {
      for (const [name, size] of this.layout) {
        const attr = geometry.attributes[name];
        attr.array.set(this.lists[name].a.subarray(0, count * size));
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, count * size);
        attr.needsUpdate = true;
      }
    }
    geometry.setDrawRange(0, count);
    this.object.visible = count > 0;
  }
}

function distanceToLine(px, py, a, b) {
  const x = b[0] - a[0], y = b[1] - a[1], t = bound(((px - a[0]) * x + (py - a[1]) * y) / (x * x + y * y || 1), 0, 1);
  return Math.hypot(px - a[0] - t * x, py - a[1] - t * y);
}

/**
 * Turn read-back pixels into a PNG data URL. Rows come top-down on WebGPU (padded to
 * 256 bytes) and bottom-up on WebGL2. Blending leaves premultiplied colour, so a
 * transparent image is un-premultiplied and an opaque one is laid over `background`.
 */
function encodePNG(px, w, h, { webgpu, background }) {
  const stride = webgpu ? Math.ceil(w * 4 / 256) * 256 : w * 4;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h), d = image.data;
  for (let y = 0; y < h; y++) {
    const row = (webgpu ? y : h - 1 - y) * stride;
    let o = y * w * 4;
    for (let x = 0; x < w; x++, o += 4) {
      const s = row + x * 4, a = px[s + 3];
      if (background) {
        const k = 1 - a / 255;
        d[o] = px[s] + background[0] * k;
        d[o + 1] = px[s + 1] + background[1] * k;
        d[o + 2] = px[s + 2] + background[2] * k;
        d[o + 3] = 255;
      } else if (a) {
        const k = 255 / a;
        d[o] = px[s] * k;
        d[o + 1] = px[s + 1] * k;
        d[o + 2] = px[s + 2] * k;
        d[o + 3] = a;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export class Viewport {
  /**
   * @param {THREE.WebGPURenderer} renderer  kit.renderer
   * @param {{grid?: boolean, overlay?: HTMLCanvasElement|null}} [opts]
   */
  constructor(renderer, { grid = true, overlay = null } = {}) {
    this.renderer = renderer;
    this.overlay = overlay;
    this.grid = grid;
    this.selected = [];
    this.collisions = false;
    this.wireframe = false;
    this.clay = false;
    this.isolated = false;
    this.mode = 'translate';
    this.ortho = false;
    this.yaw = -.83;
    this.elevation = .29;
    this.distance = 10;
    this.target = [0, 0, 1];
    this.bounds = boundsOf([]);
    this.doc = null;
    this.dirty = true;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    const m = materials();
    this.scene = new THREE.Scene();
    // Opaque parts draw first; then the contact shadow, translucent parts and edges.
    this.solid = new Batch(new THREE.Mesh(new THREE.BufferGeometry(), m.solid), SOLID, 0);
    this.shadow = new Batch(new THREE.Mesh(new THREE.BufferGeometry(), m.shadow), FLAT, 0);
    this.glass = new Batch(new THREE.Mesh(new THREE.BufferGeometry(), m.glass), SOLID, 1);
    this.lines = new Batch(new THREE.LineSegments(new THREE.BufferGeometry(), m.line), FLAT, 2);
    this.batches = [this.solid, this.shadow, this.glass, this.lines];
    for (const b of this.batches) this.scene.add(b.object);
    this.perspCam = new THREE.PerspectiveCamera(FOV * 180 / Math.PI, 1, .01, 1000);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 1000);
    this.perspCam.up.set(0, 0, 1);
    this.orthoCam.up.set(0, 0, 1);
    this.cam = this.perspCam;
    this.target3 = new THREE.Vector3();
    this.rt = null;
  }

  get backend() { return this.renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2'; }

  /** CSS size of the view. The drawing buffer itself is sized by the kit. */
  resize(w, h, dpr = 1) {
    this.width = w;
    this.height = h;
    this.dpr = Math.min(dpr, 2);
    if (this.overlay) {
      this.overlay.width = Math.max(1, Math.floor(w * this.dpr));
      this.overlay.height = Math.max(1, Math.floor(h * this.dpr));
    }
    this.dirty = true;
  }

  setAsset(doc, { fit = false, selected = this.selected } = {}) {
    this.doc = doc;
    this.selected = selected;
    this.bounds = boundsOf(doc.parts.filter((p) => p.visible));
    if (fit) this.fit();
    this.rebuild();
  }

  fit(parts) {
    const b = parts ? boundsOf(parts) : this.bounds;
    this.target = [...b.center];
    const radius = Math.max(Math.hypot(...b.size) / 2, .5), aspect = (this.width || 1) / (this.height || 1);
    this.distance = radius / Math.sin(.34) * Math.max(1, 1 / aspect) * 1.02;
    this.dirty = true;
  }

  setView(view) {
    this.ortho = view !== 'perspective' && view !== 'rear-quarter';
    if (view === 'rear') { this.yaw = Math.PI; this.elevation = .0001; }
    else if (view === 'rear-quarter') { this.yaw = -2.30; this.elevation = .3; }
    else if (view === 'front') { this.yaw = 0; this.elevation = .0001; }
    else if (view === 'side') { this.yaw = -Math.PI / 2; this.elevation = .0001; }
    else if (view === 'top') { this.yaw = -Math.PI / 2; this.elevation = TOP; }
    else { this.yaw = -.83; this.elevation = .29; }
    this.dirty = true;
  }

  /** Drag-style orbit in CSS pixels. */
  orbit(dx, dy) { this.orbitBy(dx * .008, dy * .008); }

  /** Orbit by radians: yaw to the left for positive `a`, tilt up for positive `b`. */
  orbitBy(a, b) {
    this.yaw -= a;
    // Up to straight down, so orbiting out of the Top view does not jump.
    this.elevation = bound(this.elevation + b, -1.2, TOP);
    this.dirty = true;
  }

  pan(dx, dy) {
    this.camera();
    const k = this.distance * .0012;
    this.target = vadd(this.target, vadd(vmul(this.right, -dx * k), vmul(this.up, dy * k)));
    this.dirty = true;
  }

  /** Wheel units (positive = away), as before. */
  zoom(delta) { this.zoomBy(-delta * .001); }

  /** Logarithmic zoom: positive moves in. */
  zoomBy(amount) {
    this.distance = bound(this.distance * Math.exp(-amount), .05, 1e6);
    this.dirty = true;
  }

  camera() {
    const c = Math.cos(this.elevation);
    this.eye = vadd(this.target, [Math.cos(this.yaw) * c * this.distance, Math.sin(this.yaw) * c * this.distance, Math.sin(this.elevation) * this.distance]);
    this.forward = vnorm(vsub(this.target, this.eye));
    this.right = vnorm(vcross(this.forward, [0, 0, 1]));
    this.up = vcross(this.right, this.forward);
    const aspect = (this.width || 1) / (this.height || 1), far = Math.max(this.distance * 10, 1000), near = Math.max(.001, this.distance * .001);
    this.vp = m4mul(this.ortho ? orthographic(this.distance * ORTHO, aspect, near, far) : perspective(FOV, aspect, near, far), lookAt(this.eye, this.target));
    const cam = this.ortho ? this.orthoCam : this.perspCam;
    if (this.ortho) {
      const h = this.distance * ORTHO;
      cam.left = -h * aspect;
      cam.right = h * aspect;
      cam.top = h;
      cam.bottom = -h;
    } else cam.aspect = aspect;
    cam.near = near;
    cam.far = far;
    cam.position.set(this.eye[0], this.eye[1], this.eye[2]);
    cam.lookAt(this.target3.set(this.target[0], this.target[1], this.target[2]));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.cam = cam;
  }

  /** True when a part is drawn: visible, and inside the isolated selection if there is one. */
  shows(p, picked) { return p.visible && (!this.isolated || !this.selected.length || picked.has(p.id)); }

  rebuild() {
    if (!this.doc) return;
    for (const b of this.batches) b.reset();
    const picked = new Set(this.selected);
    const S = this.solid.lists, G = this.glass.lists, L = this.lines.lists, H = this.shadow.lists;
    const n = [0, 0, 1], col = [0, 0, 0, 1];
    const line = (a, b, c) => { L.position.push3(a); L.position.push3(b); L.color.push4(c); L.color.push4(c); };
    for (const p of this.doc.parts) {
      if (!this.shows(p, picked)) continue;
      const m = worldMesh(p), v = m.vertices;
      if (!this.wireframe) {
        const out = p.color[3] < 1 ? G : S;
        if (this.clay) { col[0] = CLAY[0]; col[1] = CLAY[1]; col[2] = CLAY[2]; col[3] = p.color[3]; }
        else { col[0] = p.color[0]; col[1] = p.color[1]; col[2] = p.color[2]; col[3] = p.color[3]; }
        for (const f of m.faces) {
          for (let i = 1; i < f.length - 1; i++) {
            const a = v[f[0]], b = v[f[i]], c = v[f[i + 1]];
            const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
            const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, len = Math.hypot(nx, ny, nz);
            if (len > 1e-12) { n[0] = nx / len; n[1] = ny / len; n[2] = nz / len; } else { n[0] = 0; n[1] = 0; n[2] = 1; }
            out.position.push3(a); out.position.push3(b); out.position.push3(c);
            out.normal.push3(n); out.normal.push3(n); out.normal.push3(n);
            out.color.push4(col); out.color.push4(col); out.color.push4(col);
          }
        }
      }
      if (picked.has(p.id) || this.wireframe) {
        const c = picked.has(p.id) ? SELECTED : WIRE;
        for (const f of m.faces) for (let i = 0; i < f.length; i++) line(v[f[i]], v[f[(i + 1) % f.length]], c);
      }
    }
    if (this.grid) {
      const size = Math.max(...this.bounds.size, 1), step = Math.pow(10, Math.floor(Math.log10(size))) / 2, extent = step * 24;
      const cx = Math.round(this.bounds.center[0] / step) * step, cy = Math.round(this.bounds.center[1] / step) * step;
      for (let i = -24; i <= 24; i++) {
        const t = i * step, c = i % 4 === 0 ? GRID_MAJOR : GRID_MINOR;
        line([cx - extent, cy + t, -.018], [cx + extent, cy + t, -.018], c);
        line([cx + t, cy - extent, -.018], [cx + t, cy + extent, -.018], c);
      }
      // A neutral contact shadow is an editor aid. It is never exported.
      const b = this.bounds, sx = Math.max(.1, b.size[0] * .68), sy = Math.max(.1, b.size[1] * .72);
      for (let ring = 5; ring > 0; ring--) {
        const s = 1 + ring * .055;
        for (let i = 0; i < 48; i++) {
          const t = i * Math.PI / 24, u = (i + 1) * Math.PI / 24;
          H.position.push3([b.center[0], b.center[1], -.008]);
          H.position.push3([b.center[0] + Math.cos(t) * sx * s, b.center[1] + Math.sin(t) * sy * s, -.008]);
          H.position.push3([b.center[0] + Math.cos(u) * sx * s, b.center[1] + Math.sin(u) * sy * s, -.008]);
          H.color.push4(SHADOW); H.color.push4(SHADOW); H.color.push4(SHADOW);
        }
      }
    }
    if (this.collisions) {
      for (const c of this.doc.colliders) {
        const box = { kind: 'box', size: [c.halfX * 2, c.halfY * 2, c.height], position: [c.x, c.y, (c.baseZ || 0) + c.height / 2], rotation: [0, 0, 0], scale: [1, 1, 1] }, m = worldMesh(box);
        for (const f of m.faces) for (let i = 0; i < f.length; i++) line(m.vertices[f[i]], m.vertices[f[(i + 1) % f.length]], COLLIDER);
      }
    }
    for (const b of this.batches) b.commit();
    this.dirty = true;
  }

  render() {
    if (!this.width || !this.height) return;
    this.camera();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
    this.drawOverlay();
    this.dirty = false;
  }

  /**
   * Render the current view into an image, `scale` device pixels per CSS pixel.
   * The draw happens now; only the read-back is awaited, so callers may change the
   * view again straight away.
   */
  snapshot({ scale = 1, background = null } = {}) {
    let w = Math.max(1, Math.round(this.width * scale)), h = Math.max(1, Math.round(this.height * scale));
    const limit = 4096 / Math.max(w, h);
    if (limit < 1) { w = Math.max(1, Math.floor(w * limit)); h = Math.max(1, Math.floor(h * limit)); }
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      this.rt?.dispose();
      this.rt = new THREE.RenderTarget(w, h, { samples: 4, depthBuffer: true });
    }
    const rt = this.rt, renderer = this.renderer, webgpu = this.backend === 'webgpu';
    this.camera();
    renderer.setRenderTarget(rt);
    renderer.render(this.scene, this.cam);
    renderer.setRenderTarget(null);
    const pixels = renderer.readRenderTargetPixelsAsync(rt, 0, 0, w, h);
    return pixels.then((px) => encodePNG(px, w, h, { webgpu, background }));
  }

  /** A PNG of the main view on the editor background, without selection or grid. */
  async capture({ transparent = false, clean = true } = {}) {
    const keep = { selected: this.selected, grid: this.grid };
    if (clean) {
      this.selected = [];
      this.grid = false;
      this.rebuild();
    }
    let image;
    try {
      image = this.snapshot({ scale: Math.min(globalThis.devicePixelRatio || 1, 2), background: transparent ? null : [0x22, 0x2a, 0x27] });
    } finally {
      if (clean) {
        this.selected = keep.selected;
        this.grid = keep.grid;
        this.rebuild();
      }
    }
    const url = await image;
    // Large one-off targets are not worth keeping around.
    if (this.rt && this.rt.width * this.rt.height > 1e6) { this.rt.dispose(); this.rt = null; }
    return url;
  }

  ray(x, y) {
    this.camera();
    const nx = x / this.width * 2 - 1, ny = 1 - y / this.height * 2, aspect = this.width / this.height, k = this.ortho ? this.distance * ORTHO : Math.tan(FOV / 2);
    const o = vadd(vmul(this.right, nx * k * aspect), vmul(this.up, ny * k));
    return this.ortho ? { origin: vadd(this.eye, o), dir: this.forward } : { origin: this.eye, dir: vnorm(vadd(this.forward, o)) };
  }

  pick(x, y) {
    if (!this.doc) return null;
    const ray = this.ray(x, y), picked = new Set(this.selected);
    let hit = null, best = Infinity;
    for (const p of this.doc.parts) {
      if (!this.shows(p, picked)) continue;
      for (const t of triangles(p)) {
        const d = rayTriangle(ray.origin, ray.dir, ...t);
        if (d !== null && d < best) { best = d; hit = p.id; }
      }
    }
    return hit;
  }

  gizmo() {
    const chosen = this.doc?.parts.filter((p) => this.selected.includes(p.id) && p.visible);
    if (!chosen?.length) return null;
    this.camera();
    const center = boundsOf(chosen).center, start = project(center, this.vp, this.width, this.height), length = this.distance * .12;
    return { center, start, axes: [0, 1, 2].map((i) => { const v = [...center]; v[i] += length; return project(v, this.vp, this.width, this.height); }) };
  }

  /** The axis handle under (x, y), within `reach` CSS pixels (wider for fingers). */
  hitGizmo(x, y, reach = 12) {
    const g = this.gizmo();
    if (!g) return null;
    let best = reach, axis = null;
    g.axes.forEach((end, i) => {
      const d = distanceToLine(x, y, g.start, end);
      if (d < best && Math.hypot(x - g.start[0], y - g.start[1]) > 12) { best = d; axis = i; }
    });
    return axis;
  }

  drawOverlay() {
    if (!this.overlay) return;
    const ctx = this.overlay.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const colors = ['#ef8f7b', '#96cda9', '#8db9ef'], g = this.gizmo();
    if (g) {
      g.axes.forEach((end, i) => {
        ctx.strokeStyle = colors[i];
        ctx.fillStyle = colors[i];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(g.start[0], g.start[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
        ctx.beginPath();
        if (this.mode === 'scale') ctx.rect(end[0] - 4, end[1] - 4, 8, 8);
        else ctx.arc(end[0], end[1], 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 11px ui-monospace,monospace';
        ctx.fillText(['X', 'Y', 'Z'][i], end[0] + 7, end[1] - 5);
      });
      ctx.beginPath();
      ctx.fillStyle = '#f3f6e8';
      ctx.arc(g.start[0], g.start[1], 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const c = [this.width - 43, 45];
    this.camera();
    [0, 1, 2].forEach((i) => {
      const d = [0, 0, 0];
      d[i] = 1;
      const x = vdot(d, this.right) * 22, y = -vdot(d, this.up) * 22;
      ctx.strokeStyle = colors[i];
      ctx.fillStyle = colors[i];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[0] + x, c[1] + y);
      ctx.stroke();
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText(['X', 'Y', 'Z'][i], c[0] + x * 1.4 - 3, c[1] + y * 1.4 + 3);
    });
  }

  dispose() {
    for (const b of this.batches) b.object.geometry.dispose();
    this.rt?.dispose();
  }
}
