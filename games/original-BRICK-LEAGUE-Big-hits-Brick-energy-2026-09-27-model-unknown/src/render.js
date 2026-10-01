import * as THREE from 'three/webgpu';
import { attribute, positionLocal, vec3, sin, abs, time, uniform, step, instancedBufferAttribute } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { stadium, drawDynamic } from './world.js';

/**
 * Sunset Park in three.js. The original painted the same blocks with a software projection
 * onto Canvas2D: 0.7 ambient + 0.32 Lambert from one sun, applied straight to the sRGB
 * colours. Colour management is off and the output stays linear, so the lights below do
 * exactly that maths again (three divides Lambert by π, hence the π on each intensity).
 */
THREE.ColorManagement.enabled = false;

const SUN_DIR = new THREE.Vector3(-0.45, 0.9, 0.6).normalize();
const BROADCAST_EYE = new THREE.Vector3(91, 89, 108);
const BROADCAST_AT = new THREE.Vector3(0, 0, -35);
const BROADCAST_FOV = 43;
const REPLAY_FOV = 40;
const BLOCK_CAPACITY = 1000;
const TRAIL_MAX = 16;
const LABEL_PX = 22; // atlas pixels per world unit

const colorCache = new Map();
/** A shared THREE.Color per hex string (no allocation once seen). */
export function hexColor(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YZX');
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();

/** Rotate like the original (x, then z, then y) and move into place. */
function place(o, x, y, z, out) {
  if (o.rx) {
    const c = Math.cos(o.rx), s = Math.sin(o.rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (o.rz) {
    const c = Math.cos(o.rz), s = Math.sin(o.rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  if (o.ry) {
    const c = Math.cos(o.ry), s = Math.sin(o.ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  return out.set(x + o.p.x, y + o.p.y, z + o.p.z);
}

/** Flat-shaded triangles with per-vertex colour and a crowd phase (0 = not a fan). */
class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.crowd = [];
  }
  tri(a, b, c, n, color, crowd) {
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(color.r, color.g, color.b);
      this.crowd.push(crowd);
    }
  }
  /** A convex face: a fan from its first point, lit by the normal of its first triangle. */
  face(points, color, crowd) {
    _u.subVectors(points[1], points[0]);
    _w.subVectors(points[2], points[0]);
    const n = _v.crossVectors(_u, _w).normalize();
    for (let i = 1; i < points.length - 1; i++) this.tri(points[0], points[i], points[i + 1], n, color, crowd);
  }
  /** A flat ground polygon (any shape) facing up. */
  ground(points, color) {
    const contour = points.map((p) => new THREE.Vector2(p.x, p.z));
    const up = new THREE.Vector3(0, 1, 0);
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const a = points[i], b = points[j], c = points[k];
      // Counter-clockwise seen from above, so the face is not culled.
      const cy = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      if (cy >= 0) this.tri(a, b, c, up, color, 0);
      else this.tri(a, c, b, up, color, 0);
    }
  }
  add(o) {
    const color = hexColor(o.color);
    const crowd = o.crowd || 0;
    const w = o.s.x / 2, h = o.s.y / 2, d = o.s.z / 2;
    const P = (x, y, z) => place(o, x, y, z, new THREE.Vector3());
    if (o.kind === 'box') {
      const v = [P(-w, -h, -d), P(w, -h, -d), P(w, h, -d), P(-w, h, -d), P(-w, -h, d), P(w, -h, d), P(w, h, d), P(-w, h, d)];
      for (const side of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) this.face(side.map((i) => v[i]), color, crowd);
    } else if (o.kind === 'polygon') {
      this.ground(o.vertices.map((p) => P(p.x, p.y, p.z)), color);
    } else if (o.kind === 'cylinder' || o.kind === 'cone') {
      const n = o.segments || 10;
      const top = o.kind === 'cone' ? 0 : 1;
      const lo = [], hi = [];
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        lo.push(P(Math.cos(a) * w, -h, Math.sin(a) * d));
        hi.push(P(Math.cos(a) * w * top, h, Math.sin(a) * d * top));
      }
      // The original wound the walls inward (it only ever saw the cap); these face out.
      for (let i = 0; i < n; i++) this.face([lo[i], hi[i], hi[(i + 1) % n], lo[(i + 1) % n]], color, crowd);
      if (top) this.face([...hi].reverse(), color, crowd);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aCrowd', new THREE.Float32BufferAttribute(this.crowd, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Every sign and scoreboard line in one texture atlas and one draw. */
function buildLabels(labels) {
  const W = 1024;
  const pad = 4;
  const cells = labels.map((o) => ({ o, w: Math.ceil(o.s.x * LABEL_PX), h: Math.ceil(o.s.y * LABEL_PX), x: 0, y: 0 }));
  let x = pad, y = pad, row = 0;
  for (const c of [...cells].sort((a, b) => b.h - a.h)) {
    if (x + c.w + pad > W) {
      x = pad;
      y += row + pad;
      row = 0;
    }
    c.x = x;
    c.y = y;
    x += c.w + pad;
    row = Math.max(row, c.h);
  }
  const H = 2 ** Math.ceil(Math.log2(y + row + pad));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  for (const c of cells) {
    const o = c.o;
    ctx.fillStyle = o.color;
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = o.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = (o.text || '').split('\n');
    const size = Math.min(c.h / (lines.length + 0.2), (c.w / Math.max(...lines.map((l) => l.length))) * 1.6);
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], c.x + c.w / 2, c.y + (c.h * (i + 0.5)) / lines.length, c.w * 0.92);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.anisotropy = 4;
  const pos = [], uv = [], index = [];
  cells.forEach((c, i) => {
    const o = c.o;
    const w = o.s.x / 2, h = o.s.y / 2;
    for (const [lx, ly] of [[-w, -h], [w, -h], [w, h], [-w, h]]) {
      place(o, lx, ly, 0, _v);
      pos.push(_v.x, _v.y, _v.z);
      uv.push((c.x + (lx > 0 ? c.w : 0)) / W, 1 - (c.y + (ly > 0 ? 0 : c.h)) / H);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  // Like the original, signs are painted over the stadium blocks (some sit inside them).
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 1;
  mesh.name = 'signs';
  return mesh;
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#b6dfdc');
  g.addColorStop(0.55, '#cee7d7');
  g.addColorStop(1, '#d7e7c5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** One instanced batch for every moving block; written in place each frame. */
class Blocks {
  constructor(kit, material, capacity) {
    this.mesh = kit.instanced(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    this.capacity = Math.min(capacity, this.mesh.instanceMatrix.count);
    this.mesh.setColorAt(0, hexColor('#ffffff'));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'players';
    this.mesh.count = 0;
    this.n = 0;
    this.marked = false;
    this.mx = 0;
    this.mz = 0;
  }
  begin() {
    this.n = 0;
    this.marked = false;
  }
  box(x, y, z, w, h, d, hex, ry = 0, rz = 0) {
    if (this.n >= this.capacity) return;
    _e.set(0, ry, rz, 'YZX');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(w, h, d));
    this.mesh.setMatrixAt(this.n, _m);
    this.mesh.setColorAt(this.n, hexColor(hex));
    this.n++;
  }
  mark(x, z) {
    this.marked = true;
    this.mx = x;
    this.mz = z;
  }
  end() {
    const m = this.mesh;
    m.count = this.n;
    if (!this.n) return;
    for (const [attr, size] of [[m.instanceMatrix, 16], [m.instanceColor, 3]]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.n * size);
      attr.needsUpdate = true;
    }
  }
}

export class FieldRenderer {
  constructor(kit) {
    this.kit = kit;
    // The sRGB values are the working values (colour management off), so the output stays linear.
    kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    kit.renderer.toneMapping = THREE.NoToneMapping;
    const scene = (this.scene = new THREE.Scene());
    scene.background = skyTexture();
    this.camera = new THREE.PerspectiveCamera(BROADCAST_FOV, 1, 1, 1400);
    this.w = 1;
    this.h = 1;
    this.appliedFov = -1;
    this.appliedPy = -1;
    this.appliedPx = -1;

    // ---- light: 0.7 ambient + 0.32 sun, as the original shaded every face
    scene.add(new THREE.AmbientLight(0xffffff, 0.7 * Math.PI));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 0.32 * Math.PI));
    sun.target.position.set(0, 0, -30);
    sun.position.copy(SUN_DIR).multiplyScalar(170).add(sun.target.position);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 400 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.06;
    sun.shadow.radius = 2;
    kit.shadow(sun, 2048);
    scene.add(sun, sun.target);
    kit.renderer.shadowMap.enabled = true;

    // ---- the ballpark: one merged mesh (with a TSL bounce for the fans) and one sign atlas
    this.cheer = uniform(0);
    const worldMat = (this.worldMat = new THREE.MeshLambertNodeMaterial({ vertexColors: true }));
    worldMat.name = 'ballpark';
    const phase = attribute('aCrowd', 'float');
    worldMat.positionNode = positionLocal.add(vec3(0, abs(sin(time.mul(11).add(phase))).mul(this.cheer).mul(step(0.5, phase)).mul(0.55), 0));
    const builder = new MeshBuilder();
    const labels = [];
    for (const o of stadium()) {
      if (o.kind === 'label') labels.push(o);
      else builder.add(o);
    }
    const world = new THREE.Mesh(builder.geometry(), worldMat);
    world.name = 'ballpark';
    world.castShadow = true;
    world.receiveShadow = true;
    scene.add(world, buildLabels(labels));

    // ---- what moves
    this.blocks = new Blocks(kit, new THREE.MeshLambertMaterial({ color: 0xffffff }), BLOCK_CAPACITY);
    scene.add(this.blocks.mesh);

    const small = (o) => {
      const b = new MeshBuilder();
      b.add(o);
      const mesh = new THREE.Mesh(b.geometry(), worldMat);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    };
    // The ball's ground marker and the selected-fielder arrow sit just above every turf layer.
    this.ballShadow = small({ kind: 'cylinder', p: new THREE.Vector3(0, 0, 0), s: new THREE.Vector3(1, 0.03, 1), segments: 10, color: '#43723e' });
    this.marker = small({ kind: 'polygon', p: new THREE.Vector3(0, 0, 0), s: new THREE.Vector3(1, 1, 1), vertices: [new THREE.Vector3(-1.4, 0, 0.6), new THREE.Vector3(1.4, 0, 0.6), new THREE.Vector3(0, 0, -1.4)], color: '#ffe270' });

    this.ballMat = new THREE.MeshBasicMaterial({ color: hexColor('#fffce8') });
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), this.ballMat);
    this.ball.scale.setScalar(0.65);
    this.ball.renderOrder = 2;
    this.ball.visible = false;
    scene.add(this.ball);

    this.trailAlpha = new THREE.InstancedBufferAttribute(new Float32Array(TRAIL_MAX), 1);
    this.trailAlpha.setUsage(THREE.DynamicDrawUsage);
    const trailMat = (this.trailMat = new THREE.MeshBasicNodeMaterial({ color: hexColor('#fff4cc'), transparent: true, depthWrite: false }));
    trailMat.opacityNode = instancedBufferAttribute(this.trailAlpha);
    this.trail = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), trailMat, TRAIL_MAX);
    this.trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 3;
    this.trail.count = 0;
    scene.add(this.trail);

    // ---- camera state: the broadcast view, eased; a TV angle for replays; a little shake
    this.eye = BROADCAST_EYE.clone();
    this.at = BROADCAST_AT.clone();
    this.fov = BROADCAST_FOV;
    this.mode = 'broadcast';
    this.shake = 0;
    this.cheerLevel = 0;
    this.warm = 3;
    this.wantEye = new THREE.Vector3();
    this.wantAt = new THREE.Vector3();

    this.post = createPost(kit, scene, this.camera);
  }

  resize(w, h) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.appliedFov = -1;
    this.applyProjection(this.fov);
  }

  /**
   * The original's projection: vertical field of view capped so narrow screens keep the
   * width (focal ≤ 1.1 × width), and the view centre at 55% across and 54% down.
   */
  applyProjection(fov) {
    const { w, h } = this;
    const py = h < 480 && w > h * 1.2 ? 0.49 : 0.54; // short landscape screens: lift the diamond above the controls
    // Portrait phones: the width cap left the whole park about half the screen wide. Zoom in
    // and centre it (the field sits right of centre in this camera), so it fills the width.
    const portrait = w < h * 0.8;
    const px = portrait ? 0.45 : 0.55;
    const widthCap = portrait ? 1.5 : 1.1;
    if (Math.abs(fov - this.appliedFov) < 0.01 && py === this.appliedPy && px === this.appliedPx) return;
    const focal = Math.min(h / (2 * Math.tan((fov * Math.PI) / 360)), w * widthCap);
    const cam = this.camera;
    cam.fov = (2 * Math.atan(h / (2 * focal)) * 180) / Math.PI;
    cam.aspect = w / h;
    cam.setViewOffset(w, h, -(px - 0.5) * w, -(py - 0.5) * h, w, h);
    this.appliedPx = px;
    this.appliedFov = fov;
    this.appliedPy = py;
  }

  /** A crowd reaction, 0..1 (home runs are 1). */
  roar(level) {
    this.cheerLevel = Math.max(this.cheerLevel, level);
  }
  bump(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  updateDynamic(frame, opts) {
    const blocks = this.blocks;
    blocks.begin();
    drawDynamic(frame, blocks, !opts.reduced);
    blocks.end();
    this.marker.visible = blocks.marked;
    if (blocks.marked) this.marker.position.set(blocks.mx, 0.2, blocks.mz);

    const ball = frame.ball;
    const warm = this.warm > 0;
    this.ball.visible = !!ball || warm;
    this.ballShadow.visible = !!ball || warm;
    if (ball) {
      this.ball.position.set(ball.x, ball.y, ball.z);
      this.ballShadow.position.set(ball.x, 0.2, ball.z);
      this.ballMat.color.copy(hexColor(frame.golden ? '#ffd23f' : frame.power ? frame.powerColor : '#fffce8'));
    } else if (warm) {
      // First frames: draw everything once out of sight, so no shader compiles mid-play.
      this.ball.position.set(0, -20, -40);
      this.ballShadow.position.set(0, -20, -40);
    }
    const trail = frame.trail;
    const n = warm ? 1 : Math.min(TRAIL_MAX, trail.length);
    for (let i = 0; i < n; i++) {
      const p = warm ? _v.set(0, -20, -40) : trail[i];
      const t = i / Math.max(1, trail.length);
      const s = 0.12 + t * 0.3;
      _m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.trail.setMatrixAt(i, _m);
      this.trailAlpha.array[i] = 0.2 + t * 0.55;
    }
    this.trail.count = n;
    if (n) {
      this.trail.instanceMatrix.needsUpdate = true;
      this.trailAlpha.needsUpdate = true;
      this.trailMat.color.copy(hexColor(frame.golden ? '#ffd23f' : frame.power ? frame.powerColor : '#fff4cc'));
    }
  }

  updateCamera(dt, t, frame, opts) {
    const want = opts.replay && frame.ball ? 'replay' : 'broadcast';
    const cut = want !== this.mode;
    this.mode = want;
    let fov = BROADCAST_FOV;
    if (want === 'replay') {
      // A high-home TV angle that follows the ball out to the wall.
      const b = frame.ball;
      this.wantAt.set(b.x, Math.max(1, b.y * 0.8), b.z);
      this.wantEye.set(b.x * 0.3 + 10, 8 + Math.max(0, b.y) * 0.35, b.z * 0.55 + 22);
      fov = REPLAY_FOV;
    } else {
      this.wantEye.copy(BROADCAST_EYE);
      this.wantAt.copy(BROADCAST_AT);
      if (opts.attract && !opts.reduced) {
        // The menu drifts gently around the park.
        const a = Math.sin(t * 0.22) * 0.07;
        const dx = BROADCAST_EYE.x - BROADCAST_AT.x, dz = BROADCAST_EYE.z - BROADCAST_AT.z;
        this.wantEye.x = BROADCAST_AT.x + dx * Math.cos(a) + dz * Math.sin(a);
        this.wantEye.z = BROADCAST_AT.z - dx * Math.sin(a) + dz * Math.cos(a);
      }
    }
    const k = cut ? 1 : 1 - Math.exp(-dt * (want === 'replay' ? 5 : 2.5));
    this.eye.lerp(this.wantEye, k);
    this.at.lerp(this.wantAt, k);
    this.fov += (fov - this.fov) * k;
    this.applyProjection(this.fov);
    const cam = this.camera;
    cam.position.copy(this.eye);
    _v.copy(this.at);
    this.shake *= Math.exp(-dt * 6);
    if (this.shake > 0.01 && !opts.reduced) {
      const a = this.shake;
      cam.position.x += Math.sin(t * 47) * a;
      cam.position.y += Math.sin(t * 31 + 1) * a * 0.6;
      _v.x += Math.sin(t * 53 + 2) * a * 0.5;
      _v.y += Math.sin(t * 41 + 3) * a * 0.5;
    }
    cam.lookAt(_v);
    cam.updateMatrixWorld();
  }

  render(frame, dt, t, opts) {
    this.updateDynamic(frame, opts);
    this.updateCamera(dt, t, frame, opts);
    this.cheerLevel = Math.max(0, this.cheerLevel - dt * 0.3);
    this.cheer.value = opts.reduced ? 0 : Math.min(1, this.cheerLevel * 1.4);
    if (this.warm > 0) this.warm--;
    this.post.render();
  }

  /** Stage pixel position of a world point (for the BALL tag). */
  project(p) {
    _v.set(p.x, p.y, p.z).applyMatrix4(this.camera.matrixWorldInverse);
    const visible = -_v.z > 1;
    _v.applyMatrix4(this.camera.projectionMatrix);
    return { x: ((_v.x + 1) / 2) * this.w, y: ((1 - _v.y) / 2) * this.h, visible };
  }
}
