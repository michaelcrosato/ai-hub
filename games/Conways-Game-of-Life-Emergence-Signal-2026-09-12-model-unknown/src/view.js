/**
 * view.js — the voxel field on the kit's WebGPURenderer (WebGL2 fallback).
 *
 * One instanced draw for every live or fading cell: per-cell data sits in two
 * instanced attributes (height from/to plus board position, and colour), and a
 * TSL position node grows each voxel from the board, so cell changes animate
 * on the GPU. The floor reads a small data texture of the field for its glow.
 * The camera is an orbit rig driven by kit.input (see main.js).
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
  instancedBufferAttribute,
  positionGeometry,
  vec2,
  vec3,
  vec4,
  float,
  color,
  mix,
  smoothstep,
  max,
  min,
  abs,
  fract,
  fwidth,
  length,
  texture,
  uv,
  screenUV,
  dot,
  pow,
} from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPost } from 'kit/post.js';

export const PALETTES = {
  aurora: ['#b9ffd3', '#39c9b1', '#ffd09b'],
  ember: ['#ffedb9', '#ec8261', '#d65c9a'],
  glacier: ['#d0f8ff', '#66a6ed', '#bd9bff'],
  mono: ['#f0efe3', '#b6c5c2', '#d7c9a3'],
};

const BACKGROUND = '#0b1318';
const BLOOM_STRENGTH = 0.38;
const TWO_PI = Math.PI * 2;

const cellHeight = (alive, age, ageHeight) => (alive ? (ageHeight ? 0.68 + Math.min(2.5, Math.log2(age + 1) * 0.32) : 0.82) : 0);

/**
 * An orbit camera in the spirit of OrbitControls (damped rotate, ground-plane
 * pan, dolly toward a point), fed by kit.input instead of DOM events.
 */
class OrbitRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.spherical = new THREE.Spherical();
    this.dTheta = 0;
    this.dPhi = 0;
    this.panOffset = new THREE.Vector3();
    this.scale = 1;
    this.dollyPoint = new THREE.Vector3();
    this.hasDollyPoint = false;
    this.minDistance = 4;
    this.maxDistance = 512;
    this.minPolar = 0.001;
    this.maxPolar = Math.PI * 0.475;
    this.maxTargetRadius = Infinity;
    this.damping = 0.09;
    this.enableRotate = true;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.3;
    this._offset = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  /** Radians: + x turns the view left like dragging right with OrbitControls. */
  rotate(dx, dy) {
    if (!this.enableRotate) return;
    this.dTheta -= dx;
    this.dPhi -= dy;
  }

  /** Pan by screen pixels along the ground plane. */
  pan(dxPx, dyPx, viewHeight) {
    const cam = this.camera;
    const distance = this._offset.copy(cam.position).sub(this.target).length() * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const kx = (2 * dxPx * distance) / Math.max(1, viewHeight);
    const ky = (2 * dyPx * distance) / Math.max(1, viewHeight);
    cam.updateMatrix();
    const right = this._v.setFromMatrixColumn(cam.matrix, 0);
    this.panOffset.addScaledVector(right, -kx);
    const forward = right.crossVectors(this._up, this._v.setFromMatrixColumn(cam.matrix, 0));
    this.panOffset.addScaledVector(forward, ky);
  }

  /** factor < 1 moves in. point (optional, on the board) stays roughly under the cursor. */
  dolly(factor, point = null) {
    this.scale *= factor;
    this.hasDollyPoint = !!point;
    if (point) this.dollyPoint.copy(point);
  }

  distance() {
    return this.camera.position.distanceTo(this.target);
  }

  update(dt) {
    const cam = this.camera;
    const offset = this._offset.copy(cam.position).sub(this.target);
    this.spherical.setFromVector3(offset);
    const f = this.damping >= 1 ? 1 : 1 - Math.pow(1 - this.damping, Math.max(0, dt) * 60);
    if (this.autoRotate && this.enableRotate) this.spherical.theta -= ((TWO_PI / 60) * this.autoRotateSpeed) * dt;
    this.spherical.theta += this.dTheta * f;
    this.spherical.phi += this.dPhi * f;
    this.spherical.phi = Math.max(this.minPolar, Math.min(this.maxPolar, this.spherical.phi));
    this.spherical.makeSafe();
    const before = this.spherical.radius;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, before * this.scale));
    if (this.hasDollyPoint && before > 0) {
      const k = 1 - this.spherical.radius / before;
      this.target.x += (this.dollyPoint.x - this.target.x) * k;
      this.target.z += (this.dollyPoint.z - this.target.z) * k;
    }
    this.scale = 1;
    this.hasDollyPoint = false;
    this.target.addScaledVector(this.panOffset, f);
    this.target.y = 0;
    if (this.target.length() > this.maxTargetRadius) this.target.setLength(this.maxTargetRadius);
    offset.setFromSpherical(this.spherical);
    cam.position.copy(this.target).add(offset);
    cam.lookAt(this.target);
    const keep = 1 - f;
    this.dTheta *= keep;
    this.dPhi *= keep;
    this.panOffset.multiplyScalar(keep);
    if (Math.abs(this.dTheta) < 1e-5) this.dTheta = 0;
    if (Math.abs(this.dPhi) < 1e-5) this.dPhi = 0;
  }

  /** Drop any momentum (after a jump or a tween). */
  halt() {
    this.dTheta = this.dPhi = 0;
    this.panOffset.set(0, 0, 0);
    this.scale = 1;
    this.hasDollyPoint = false;
  }
}

export class VoxelView {
  /**
   * @param {object} kit       from boot()
   * @param {object} settings  the game's display preferences
   */
  constructor(kit, settings) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.settings = { ...settings };
    this.size = 0;
    this.top = false;
    this.tool = 'orbit';
    this.detail = 'VOXELS';
    this.life = null;
    this.mesh = null;
    this.missionGroup = null;
    this.missionKey = null;
    this.receiverMeshes = [];
    this.cameraTween = null;
    this.lastSync = performance.now();
    this.animationLength = 150;
    this.previewTint = null;

    this.u = {
      blend: uniform(1),
      grid: uniform(1),
      trails: uniform(1),
      n: uniform(64),
      gridFade: uniform(1),
      accent: uniform(new THREE.Color('#49ba9e')),
    };

    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.06;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.fog = new THREE.FogExp2(BACKGROUND, 0.006);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(36, 1, 0.1, 2000));
    this.rig = new OrbitRig(this.camera);

    this.scene.add(new THREE.HemisphereLight('#baf1e6', '#182229', 1.6));
    this.key = new THREE.DirectionalLight('#e6ffe4', 3.1);
    this.key.position.set(-25, 65, 28);
    this.key.castShadow = true;
    this.key.shadow.bias = -2e-4;
    this.key.shadow.normalBias = 0.06;
    this.key.shadow.radius = 3;
    // The field only changes when cells change: re-render the shadow map on demand.
    this.key.shadow.autoUpdate = false;
    this.key.shadow.needsUpdate = true;
    kit.shadow(this.key, 2048);
    this.scene.add(this.key, this.key.target);
    this.fill = new THREE.DirectionalLight('#62d8c6', 2.1);
    this.fill.position.set(40, 18, -36);
    this.rim = new THREE.DirectionalLight('#8fb4e5', 1.5);
    this.rim.position.set(-10, 10, -45);
    this.scene.add(this.fill, this.rim);

    // Bloom (a soft glow around bright cells) and the original's gentle vignette.
    this.post = createPost(kit, this.scene, this.camera, {
      bloom: { strength: BLOOM_STRENGTH, radius: 0.55, threshold: 0.95 },
      output: (c) => {
        const p = screenUV.sub(0.5).mul(1.3);
        const vignette = pow(float(1).sub(dot(p, p).mul(0.3)), 2.2);
        return vec4(c.rgb.mul(vignette), c.a);
      },
    });

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.rayPoint = new THREE.Vector3();
    this.ndc = new THREE.Vector2();
    this.pickBox = new THREE.Box3();
    this.pickHit = new THREE.Vector3();
    this.pickSeen = new Set();
    this.tmpMatrix = new THREE.Object3D();
    this.projectVec = new THREE.Vector3();
    this.lastCamera = new THREE.Matrix4();
    this.cameraMoved = true;

    kit.onQuality(() => {
      this.key.shadow.needsUpdate = true;
    });
    this.configure(settings);
  }

  // ---------------------------------------------------------------- building

  disposeGroup(group) {
    const geometries = new Set();
    const materials = new Set();
    group.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
      // Frees the instance matrix buffer of the placement preview.
      if (o.isInstancedMesh) o.dispose();
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  }

  prepare(size) {
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
      this.disposeGroup(this.boardGroup);
      this.fineGeometry?.dispose();
      this.coarseGeometry?.dispose();
      this.lifeMap?.dispose();
    }
    this.size = size;
    this.u.n.value = size;
    this.scene.fog.density = 0.12 / size;
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const total = size * size;
    this.previousHeights = new Float32Array(total);
    this.targetHeights = new Float32Array(total);
    // Per voxel: height from, height to, board x, board z.
    this.lifeData = new Float32Array(total * 4);
    this.lifeAttribute = new THREE.InstancedBufferAttribute(this.lifeData, 4).setUsage(THREE.DynamicDrawUsage);
    this.colorData = new Float32Array(total * 3);
    this.colorAttribute = new THREE.InstancedBufferAttribute(this.colorData, 3).setUsage(THREE.DynamicDrawUsage);
    this.coarseGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.fineGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.055);

    const life = instancedBufferAttribute(this.lifeAttribute);
    const tint = instancedBufferAttribute(this.colorAttribute);
    const t = smoothstep(0, 1, this.u.blend);
    const height = max(mix(life.x, life.y, t), 0.0001);
    const local = positionGeometry;
    const mat = new THREE.MeshStandardNodeMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.29 });
    // Grow from the board: x/z shrink to 87% (a gap between cells), y scales by the animated height.
    mat.positionNode = vec3(local.x.mul(0.87).add(life.z), local.y.add(0.5).mul(height).add(0.025), local.z.mul(0.87).add(life.w));
    mat.colorNode = vec4(tint.mul(mix(0.53, 1, smoothstep(-0.45, 0.42, local.y))), 1);
    mat.emissiveNode = tint.mul(0.5).mul(float(0.24).add(smoothstep(0.37, 0.49, local.y).mul(0.86)));
    this.voxelMaterial = mat;

    // A plain mesh drawn `count` times: the instanced attributes carry each voxel.
    this.mesh = new THREE.Mesh(this.coarseGeometry, mat);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.boardGroup.add(this.mesh);

    this.mapData = new Uint8Array(total * 4);
    this.lifeMap = new THREE.DataTexture(this.mapData, size, size, THREE.RGBAFormat);
    this.lifeMap.magFilter = THREE.NearestFilter;
    this.lifeMap.minFilter = THREE.NearestFilter;
    this.lifeMap.generateMipmaps = false;
    this.lifeMap.needsUpdate = true;

    const plane = new THREE.PlaneGeometry(size, size);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position;
    const uvs = plane.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, pos.getX(i) / size + 0.5, pos.getZ(i) / size + 0.5);

    const floorMat = new THREE.MeshStandardNodeMaterial({ color: '#12242a', roughness: 0.55, metalness: 0.25 });
    const cell = uv().mul(this.u.n);
    const g = abs(fract(cell.sub(0.5)).sub(0.5)).div(max(fwidth(cell), vec2(0.001)));
    const line = float(1).sub(min(min(g.x, g.y), 1));
    const cell8 = cell.div(8);
    const gm = abs(fract(cell8.sub(0.5)).sub(0.5)).div(max(fwidth(cell8), vec2(0.001)));
    const major = float(1).sub(min(min(gm.x, gm.y), 1));
    const gridGlow = vec3(0.035, 0.085, 0.085).mul(this.u.grid).mul(line.mul(0.47).mul(this.u.gridFade).add(major.mul(0.55)));
    floorMat.colorNode = vec4(color(0x12242a).add(gridGlow), 1);
    const field = texture(this.lifeMap, uv());
    const q = fract(cell).sub(0.5);
    const pool = float(1).sub(smoothstep(0.15, 0.61, length(q)));
    const tile = float(1).sub(smoothstep(0.39, 0.49, max(abs(q.x), abs(q.y))));
    floorMat.emissiveNode = this.u.accent.mul(field.r.mul(0.25).mul(pool).add(field.g.mul(0.25).mul(tile).mul(this.u.trails)));
    const floor = new THREE.Mesh(plane, floorMat);
    floor.receiveShadow = true;
    this.boardGroup.add(floor);

    const base = new THREE.Mesh(new THREE.BoxGeometry(size + 0.55, 0.95, size + 0.55), new THREE.MeshStandardMaterial({ color: '#10262c', roughness: 0.38, metalness: 0.55 }));
    base.position.y = -0.5;
    this.boardGroup.add(base);

    const h = size / 2;
    const border = [
      [-h, 0.04, -h],
      [h, 0.04, -h],
      [h, 0.04, h],
      [-h, 0.04, h],
      [-h, 0.04, -h], // closed by hand: WebGPURenderer does not draw THREE.LineLoop
    ].map((p) => new THREE.Vector3(...p));
    this.boardGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(border), new THREE.LineBasicMaterial({ color: '#578f81', transparent: true, opacity: 0.65 })));
    const corners = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (h + 0.1);
        const z = sz * (h + 0.1);
        corners.push(new THREE.Vector3(x - sx * 2, 0.1, z), new THREE.Vector3(x, 0.1, z), new THREE.Vector3(x, 0.1, z), new THREE.Vector3(x, 0.1, z - sz * 2));
      }
    }
    this.boardGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color: '#b9d99d', transparent: true, opacity: 0.85 })));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 10, size * 10), new THREE.MeshStandardMaterial({ color: '#0c151b', roughness: 0.94, metalness: 0.08 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.1;
    ground.receiveShadow = true;
    this.boardGroup.add(ground);

    this.preview = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.13, 0.9),
      new THREE.MeshBasicMaterial({ color: '#d1f69d', transparent: true, opacity: 0.55, depthWrite: false }),
      1024
    );
    this.preview.count = 0;
    this.preview.frustumCulled = false;
    this.preview.renderOrder = 3;
    this.boardGroup.add(this.preview);

    this.key.position.set(-size * 0.4, size * 0.95, size * 0.45);
    const sc = this.key.shadow.camera;
    sc.left = -size * 0.8;
    sc.right = size * 0.8;
    sc.top = size * 0.8;
    sc.bottom = -size * 0.8;
    sc.near = 0.5;
    sc.far = size * 3;
    sc.updateProjectionMatrix();
    this.key.shadow.needsUpdate = true;

    this.rig.minDistance = 4;
    this.rig.maxDistance = size * 8;
    this.rig.maxTargetRadius = size * 0.8;
    this.fit(false);
    this.applyPalette();
  }

  applyPalette() {
    const hex = PALETTES[this.settings.palette] || PALETTES.aurora;
    this.palette = hex.map((c) => new THREE.Color(c));
    this.u.accent.value.copy(this.palette[1]);
  }

  // ---------------------------------------------------------------- field

  /** Upload the field. immediate skips the grow/shrink animation. */
  sync(life, immediate = false) {
    this.life = life;
    if (!this.mesh || this.size !== life.size) this.prepare(life.size);
    const n = life.size;
    const half = n / 2 - 0.5;
    const now = performance.now();
    const r = this.settings.reducedMotion ? 1 : Math.min(1, (now - this.lastSync) / this.animationLength);
    const a = r * r * (3 - 2 * r);
    const [c0, c1, c2] = this.palette;
    const ageHeight = this.settings.ageHeight;
    const L = this.lifeData;
    const C = this.colorData;
    const M = this.mapData;
    const prev = this.previousHeights;
    const target = this.targetHeights;
    let count = 0;
    for (let i = 0; i < life.cells.length; i++) {
      const alive = life.cells[i];
      const age = life.ages[i];
      const current = prev[i] + (target[i] - prev[i]) * a;
      const next = cellHeight(alive, age, ageHeight);
      prev[i] = immediate ? next : current;
      target[i] = next;
      const m = i * 4;
      M[m] = alive ? 255 : 0;
      M[m + 1] = Math.round((life.trails[i] / 12) * 255);
      M[m + 2] = Math.min(255, age);
      M[m + 3] = 255;
      if (!alive && current < 0.001) continue;
      const o = count * 4;
      L[o] = immediate ? next : current;
      L[o + 1] = next;
      L[o + 2] = (i % n) - half;
      L[o + 3] = Math.floor(i / n) - half;
      const k = count * 3;
      if (alive) {
        const t1 = Math.min(1, Math.max(0, (age - 1) / 15));
        let rr = c0.r + (c1.r - c0.r) * t1;
        let gg = c0.g + (c1.g - c0.g) * t1;
        let bb = c0.b + (c1.b - c0.b) * t1;
        if (age > 32) {
          const t2 = Math.min(1, (age - 32) / 55);
          rr += (c2.r - rr) * t2;
          gg += (c2.g - gg) * t2;
          bb += (c2.b - bb) * t2;
        }
        C[k] = rr;
        C[k + 1] = gg;
        C[k + 2] = bb;
      } else {
        C[k] = c1.r * 0.45;
        C[k + 1] = c1.g * 0.45;
        C[k + 2] = c1.b * 0.45;
      }
      count++;
    }
    this.mesh.count = count;
    // Upload only the voxels in use (an empty range list would upload the whole buffer).
    if (count) {
      this.lifeAttribute.clearUpdateRanges();
      this.lifeAttribute.addUpdateRange(0, count * 4);
      this.lifeAttribute.needsUpdate = true;
      this.colorAttribute.clearUpdateRanges();
      this.colorAttribute.addUpdateRange(0, count * 3);
      this.colorAttribute.needsUpdate = true;
    }
    this.lifeMap.needsUpdate = true;
    this.key.shadow.needsUpdate = true;
    this.lastSync = now;
    this.u.blend.value = immediate ? 1 : 0;
  }

  configure(patch) {
    this.settings = { ...this.settings, ...patch };
    const s = this.settings;
    this.key.castShadow = !!s.shadows;
    this.key.shadow.needsUpdate = true;
    if (this.post.bloom) this.post.bloom.strength.value = s.bloom ? BLOOM_STRENGTH : 0;
    this.u.grid.value = s.gridLines ? 1 : 0;
    this.u.trails.value = s.trails ? 1 : 0;
    this.animationLength = s.reducedMotion ? 1 : 150;
    this.rig.autoRotate = !!s.autoRotate && !s.reducedMotion && this.tool === 'orbit' && !this.top;
    if (this.size) this.applyPalette();
    if (this.life) this.sync(this.life, true);
  }

  setTool(tool) {
    this.tool = tool;
    this.rig.autoRotate = !!this.settings.autoRotate && !this.settings.reducedMotion && tool === 'orbit' && !this.top;
    this.kit.canvas.style.cursor = tool === 'orbit' ? 'grab' : 'crosshair';
    if (this.preview) this.preview.count = 0;
  }

  // ---------------------------------------------------------------- camera

  /** The board is framed in the .board-frame box (clear of the panels) while the canvas fills the stage. */
  frameBoard() {
    const c = this.kit.canvas.getBoundingClientRect();
    const box = document.querySelector('.board-frame');
    const f = box && box.getBoundingClientRect();
    const W = Math.max(1, c.width), H = Math.max(1, c.height);
    const ok = f && f.width > 1 && f.height > 1;
    const dx = ok ? f.left + f.width / 2 - (c.left + W / 2) : 0;
    const dy = ok ? f.top + f.height / 2 - (c.top + H / 2) : 0;
    const zoom = ok ? Math.min(1, f.height / H) : 1;
    this.frameAspect = ok ? f.width / f.height : W / H;
    const key = `${W}|${H}|${dx}|${dy}|${zoom}`;
    if (key === this.frameKey) return;
    this.frameKey = key;
    this.camera.zoom = zoom;
    this.camera.setViewOffset(W, H, -dx, -dy, W, H);
    this.camera.updateProjectionMatrix();
  }

  fit(animate = true) {
    this.frameBoard();
    const aspect = this.frameAspect;
    const distance = this.size * Math.max(1.75, 2 / aspect);
    const dir = this.top ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0.81, 1.12, 1.05).normalize();
    this.moveCamera(dir.multiplyScalar(distance), new THREE.Vector3(0, 0, 0), animate);
  }

  focusPattern(width, height) {
    const distance = Math.max(this.size * 0.42, Math.max(width, height) * 2.3) / Math.min(1, this.frameAspect || this.camera.aspect);
    const dir = this.camera.position.clone().sub(this.rig.target).normalize();
    this.moveCamera(dir.multiplyScalar(distance), new THREE.Vector3(0, 0, 0));
  }

  moveCamera(position, target, animate = true) {
    this.rig.halt();
    if (animate && !this.settings.reducedMotion) {
      this.cameraTween = { start: performance.now(), from: this.camera.position.clone(), to: position, fromTarget: this.rig.target.clone(), toTarget: target };
    } else {
      this.cameraTween = null;
      this.camera.position.copy(position);
      this.rig.target.copy(target);
      this.rig.update(0);
    }
  }

  /** Any direct camera input cancels a running fit/focus animation. */
  takeCamera() {
    this.cameraTween = null;
  }

  /** factor < 1 zooms in. With an NDC position, the board point under it stays under the cursor. */
  zoom(factor, nx = null, ny = null) {
    this.takeCamera();
    const point = nx === null ? null : this.groundAt(nx, ny);
    this.rig.dolly(factor, point);
  }

  toggleTop() {
    this.top = !this.top;
    this.rig.enableRotate = !this.top;
    this.setTool(this.tool);
    this.fit();
    return this.top;
  }

  // ---------------------------------------------------------------- picking

  /** The board cell under a canvas position given in NDC (-1..1, y up), or null. */
  pick(nx, ny) {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.rayPoint)) return null;
    const n = this.size;
    const gx = Math.floor(this.rayPoint.x + n / 2);
    const gy = Math.floor(this.rayPoint.z + n / 2);
    const ray = this.raycaster.ray;
    const dy = ray.direction.y;
    let best = null;
    let bestDistance = Infinity;
    // Tall voxels hide the floor cell behind them: march the ray through the columns it crosses.
    if (this.life && dy < -0.001) {
      const tFloor = -ray.origin.y / dy;
      const tTop = Math.max(0, (3.4 - ray.origin.y) / dy);
      const steps = Math.min(256, Math.max(1, Math.ceil((tFloor - tTop) * Math.max(Math.abs(ray.direction.x), Math.abs(ray.direction.z)) * 3)));
      const seen = this.pickSeen;
      seen.clear();
      const b = this.u.blend.value;
      const eased = b * b * (3 - 2 * b);
      for (let s = 0; s <= steps; s++) {
        const t = tTop + ((tFloor - tTop) * s) / steps;
        const cx = Math.floor(ray.origin.x + ray.direction.x * t + n / 2);
        const cy = Math.floor(ray.origin.z + ray.direction.z * t + n / 2);
        if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
        const i = cy * n + cx;
        if (seen.has(i)) continue;
        seen.add(i);
        const hgt = this.previousHeights[i] + (this.targetHeights[i] - this.previousHeights[i]) * eased;
        if (hgt < 0.05) continue;
        this.pickBox.min.set(cx - n / 2 + 0.065, 0.025, cy - n / 2 + 0.065);
        this.pickBox.max.set(cx - n / 2 + 0.935, hgt + 0.025, cy - n / 2 + 0.935);
        if (ray.intersectBox(this.pickBox, this.pickHit)) {
          const d = this.pickHit.distanceToSquared(ray.origin);
          if (d < bestDistance) {
            bestDistance = d;
            best = { x: cx, y: cy };
          }
        }
      }
    }
    return best || (gx >= 0 && gy >= 0 && gx < n && gy < n ? { x: gx, y: gy } : null);
  }

  /** Ground point (on the board plane) under an NDC position, for zooming toward the cursor. */
  groundAt(nx, ny) {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, this.rayPoint) ? this.rayPoint : null;
  }

  previewCells(cells, erasing = false, tint = null) {
    if (!this.preview) return;
    const want = tint || (erasing ? '#fa9b88' : '#cff49d');
    if (want !== this.previewTint) {
      this.previewTint = want;
      this.preview.material.color.set(want);
    }
    let i = 0;
    const n = this.size;
    const d = this.tmpMatrix;
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= n || y >= n || i >= 1024) continue;
      const k = y * n + x;
      const h = this.life ? cellHeight(this.life.cells[k], this.life.ages[k] || 0, this.settings.ageHeight) : 0;
      d.position.set(x - n / 2 + 0.5, h + 0.13, y - n / 2 + 0.5);
      d.updateMatrix();
      this.preview.setMatrixAt(i++, d.matrix);
    }
    this.preview.count = i;
    this.preview.instanceMatrix.needsUpdate = true;
  }

  /** Page coordinates (client pixels) of a cell centre, using a canvas rect the caller measured. */
  cellToScreen(x, y, rect = this.kit.canvas.getBoundingClientRect()) {
    const p = this.projectVec.set(x - this.size / 2 + 0.5, 0, y - this.size / 2 + 0.5).project(this.camera);
    return { x: rect.left + ((p.x + 1) * rect.width) / 2, y: rect.top + ((1 - p.y) * rect.height) / 2 };
  }

  // ---------------------------------------------------------------- missions

  clearMission() {
    if (!this.missionGroup) return;
    this.scene.remove(this.missionGroup);
    this.disposeGroup(this.missionGroup);
    this.missionGroup = null;
    this.missionKey = null;
    this.receiverMeshes = [];
  }

  setMission(state) {
    if (!state?.mission) {
      this.clearMission();
      return;
    }
    const m = state.mission;
    const key = `${m.id}-${m.size}`;
    if (this.missionKey !== key) {
      this.clearMission();
      this.missionKey = key;
      this.missionGroup = new THREE.Group();
      this.scene.add(this.missionGroup);
      const half = m.size / 2;
      const group = this.missionGroup;
      const plate = (r, tint, opacity) => {
        const geo = new THREE.PlaneGeometry(r.w, r.h);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(r.x + r.w / 2 - half, 0.055, r.y + r.h / 2 - half);
        group.add(mesh);
        return mesh;
      };
      const outline = (r, tint, dashed = false) => {
        const pts = [
          [r.x - half, r.y - half],
          [r.x + r.w - half, r.y - half],
          [r.x + r.w - half, r.y + r.h - half],
          [r.x - half, r.y + r.h - half],
          [r.x - half, r.y - half],
        ].map(([x, z]) => new THREE.Vector3(x, 0.095, z));
        const mat = dashed
          ? new THREE.LineDashedMaterial({ color: tint, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.8 })
          : new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.8 });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
        line.computeLineDistances();
        group.add(line);
      };
      for (const z of m.zones) {
        plate(z, '#59c4dd', 0.11);
        outline(z, '#81d9ec', true);
      }
      for (const z of m.hazards) {
        plate(z, '#f48b74', 0.075);
        outline(z, '#eb9b84', true);
      }
      for (const r of m.receivers) {
        const cx = r.x + r.w / 2 - half;
        const cz = r.y + r.h / 2 - half;
        const pad = plate(r, '#e6bb65', 0.13);
        outline(r, '#f0c577');
        const radius = Math.min(r.w, r.h) * 0.48;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.048, 5, 48), new THREE.MeshBasicMaterial({ color: '#ecca82', transparent: true, opacity: 0.82 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, 0.16, cz);
        group.add(ring);
        const inner = new THREE.Mesh(
          new THREE.RingGeometry(radius * 0.57, radius * 0.64, 40),
          new THREE.MeshBasicMaterial({ color: '#e3b96a', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
        );
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(cx, 0.07, cz);
        group.add(inner);
        const pulse = new THREE.Mesh(
          new THREE.RingGeometry(radius * 0.95, radius, 40),
          new THREE.MeshBasicMaterial({ color: '#daeeac', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
        );
        pulse.rotation.x = -Math.PI / 2;
        pulse.position.set(cx, 0.09, cz);
        pulse.visible = false;
        group.add(pulse);
        // One shared beacon material per receiver (four posts change colour together).
        const beaconMat = new THREE.MeshStandardMaterial({ color: '#cda965', emissive: '#e5c886', emissiveIntensity: 0.8, metalness: 0.45, roughness: 0.35 });
        const beaconGeo = new THREE.BoxGeometry(0.16, 0.28, 0.16);
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const post = new THREE.Mesh(beaconGeo, beaconMat);
            post.position.set(cx + sx * (r.w / 2 + 0.18), 0.15, cz + sz * (r.h / 2 + 0.18));
            group.add(post);
          }
        }
        this.receiverMeshes.push({ id: r.id, ring, inner, plate: pad, pulse, beaconMat, active: false, hitAt: -1 });
      }
    }
    this.missionState = state;
    for (const rm of this.receiverMeshes) {
      const on = state.hits[rm.id] !== undefined;
      if (rm.active === on) continue;
      rm.active = on;
      rm.hitAt = on ? performance.now() : -1;
      const tint = on ? '#d6eda0' : '#ecca82';
      rm.ring.material.color.set(tint);
      rm.inner.material.color.set(tint);
      rm.plate.material.color.set(tint);
      rm.plate.material.opacity = on ? 0.19 : 0.09;
      rm.beaconMat.color.set(tint);
      rm.beaconMat.emissive.set(tint);
      rm.beaconMat.emissiveIntensity = on ? 1.8 : 0.65;
    }
  }

  animateMission(now) {
    if (!this.missionGroup) return;
    const still = this.settings.reducedMotion;
    for (const rm of this.receiverMeshes) {
      const age = rm.hitAt < 0 ? 2 : (now - rm.hitAt) / 1000;
      const show = rm.active && age < 1.8 && !still;
      rm.pulse.visible = show;
      if (show) {
        rm.pulse.scale.setScalar(1 + age * 1.4);
        rm.pulse.material.opacity = (1 - age / 1.8) * 0.5;
      }
      rm.inner.material.opacity = rm.active ? 0.7 : still ? 0.35 : 0.28 + Math.sin(now * 0.0015) * 0.09;
    }
  }

  // ---------------------------------------------------------------- frame

  render(now, dt) {
    this.frameBoard();
    if (this.cameraTween) {
      const tw = this.cameraTween;
      const k = Math.min(1, (now - tw.start) / 500);
      const e = 1 - (1 - k) ** 3;
      this.camera.position.lerpVectors(tw.from, tw.to, e);
      this.rig.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      if (k === 1) this.cameraTween = null;
      this.camera.lookAt(this.rig.target);
    } else {
      this.rig.update(dt);
    }
    this.animateMission(now);
    this.u.blend.value = this.settings.reducedMotion ? 1 : Math.min(1, (now - this.lastSync) / this.animationLength);
    const pxPerCell = (this.kit.size.height || 1) * this.camera.zoom / (2 * Math.tan(THREE.MathUtils.degToRad(18)) * Math.max(0.001, this.rig.distance()));
    this.u.gridFade.value = THREE.MathUtils.smoothstep(pxPerCell, 2, 7);
    // Beveled voxels up close on high and ultra; simple cubes elsewhere (and on phones).
    const fine = pxPerCell > 12 && this.kit.tier.detail >= 1;
    if (this.mesh) {
      const geo = fine ? this.fineGeometry : this.coarseGeometry;
      if (this.mesh.geometry !== geo) this.mesh.geometry = geo;
    }
    if (this.u.blend.value < 1) this.key.shadow.needsUpdate = true;
    this.camera.updateMatrixWorld();
    this.cameraMoved = !this.lastCamera.equals(this.camera.matrixWorld);
    if (this.cameraMoved) this.lastCamera.copy(this.camera.matrixWorld);
    this.post.render();
    this.detail = fine ? 'BEVELED VOXELS' : pxPerCell < 3 ? 'OVERVIEW' : 'VOXELS';
  }

  /** A PNG of the current view (rendered and read back in the same task). */
  capture() {
    this.post.render();
    return new Promise((resolve, reject) => this.kit.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image capture failed.'))), 'image/png'));
  }
}
