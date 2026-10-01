// Pocket Parade. The three.js layer, drawn by the kit's WebGPU / WebGL2 renderer.
// It reproduces the old hand-written WebGL renderer: vertex-coloured toy meshes with the
// same soft sun-and-sky shading (a fixed sun direction, a gentle hemisphere term and a warm
// tint on lit faces), canvas textures, unlit and see-through layers, the far fog, inked
// outlines on the little roller (inverted hulls), and soft blob shadows under everything.
// Colours go straight to the screen as before, so colour management is off.
import * as THREE from 'three/webgpu';
import { vec3, vec4, float, normalWorld, positionLocal, normalLocal, positionView, vertexColor, texture, dot, max, mix, length, smoothstep, fog } from 'three/tsl';
import { createPost } from 'kit/post.js';

// The old renderer used the vertex colours and canvas pixels as display values.
THREE.ColorManagement.enabled = false;

const FOG = [.78, .85, .74];
const SUN = (() => { const v = [-.55, .85, .55], l = Math.hypot(...v); return v.map((x) => x / l); })();

export function createRenderLayer(kit) {
  const renderer = kit.renderer;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(FOG[0], FOG[1], FOG[2]);
  // Fog fades in from 40 m to 90 m, up to 65 %, toward the clear colour.
  scene.fogNode = fog(vec3(FOG[0], FOG[1], FOG[2]), smoothstep(40, 90, length(positionView)).mul(0.65));
  const camera = new THREE.PerspectiveCamera(51, 1, 0.065, 120);
  kit.onResize((w, h) => {
    camera.aspect = w / h;
    camera.fov = h > w ? 59 : 51;
    camera.updateProjectionMatrix();
  });

  // ---- shading: the old vertex shader's sun, sky and warm tint, per pixel on flat normals
  const L = vec3(SUN[0], SUN[1], SUN[2]);
  const shade = (rgb) => {
    const n = normalWorld;
    const sun = max(dot(n, L), 0);
    const hemi = n.y.mul(0.07).add(0.92);
    return rgb.mul(hemi).mul(sun.mul(0.32).add(0.81)).mul(mix(vec3(0.9, 0.98, 0.97), vec3(1.04, 1.015, 0.94), sun));
  };

  // ---- textures from the room's painted canvases
  const texCache = new Map();
  function textureFor(canvas) {
    let t = texCache.get(canvas);
    if (t) return t;
    t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache.set(canvas, t);
    return t;
  }

  // ---- geometry from the Builder's vertex arrays (position, normal, rgba, uv)
  function geometryFor(def) {
    if (def.geometry) return def.geometry;
    const a = def.raw, n = (a.length / 12) | 0;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 4), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      pos[i * 3] = a[o]; pos[i * 3 + 1] = a[o + 1]; pos[i * 3 + 2] = a[o + 2];
      nor[i * 3] = a[o + 3]; nor[i * 3 + 1] = a[o + 4]; nor[i * 3 + 2] = a[o + 5];
      col[i * 4] = a[o + 6]; col[i * 4 + 1] = a[o + 7]; col[i * 4 + 2] = a[o + 8]; col[i * 4 + 3] = a[o + 9];
      uv[i * 2] = a[o + 10]; uv[i * 2 + 1] = a[o + 11];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    def.geometry = g;
    return g;
  }

  // ---- one material per look, shared by every mesh with that look
  const matCache = new Map();
  let texIds = 0;
  function materialFor(def) {
    const tex = def.tex ? textureFor(def.tex) : null;
    if (tex && tex.userData.key === undefined) tex.userData.key = ++texIds;
    const key = `${tex ? tex.userData.key : '-'}|${def.unlit ? 1 : 0}|${def.transparent ? 1 : 0}|${def.doubleSided ? 1 : 0}`;
    let m = matCache.get(key);
    if (m) return m;
    const vc = vertexColor();
    let rgb = vc.rgb, alpha = vc.a;
    if (tex) {
      const t = texture(tex);
      rgb = rgb.mul(t.rgb);
      alpha = alpha.mul(t.a);
    }
    const transparent = !!def.transparent;
    m = new THREE.MeshBasicNodeMaterial({ side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent, depthWrite: !transparent });
    m.colorNode = vec4(def.unlit ? rgb : shade(rgb), alpha);
    if (transparent) m.alphaTest = 0.015;
    matCache.set(key, m);
    return m;
  }

  // Inked outline: back faces of a hull pushed out along the normals, one dark ink colour.
  const outlineCache = new Map();
  function outlineMaterial(width) {
    let m = outlineCache.get(width);
    if (m) return m;
    m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
    m.colorNode = vec4(0.13, 0.255, 0.205, 1);
    m.positionNode = positionLocal.add(normalLocal.mul(width));
    outlineCache.set(width, m);
    return m;
  }

  /** A static mesh (identity transform, or a column-major matrix). Transparent layers draw in `order`. */
  function mesh(def, matrix = null, order = 0) {
    const m = new THREE.Mesh(geometryFor(def), materialFor(def));
    m.matrixAutoUpdate = false;
    if (matrix) m.matrix.fromArray(matrix);
    // With matrixAutoUpdate off, three only rebuilds matrixWorld when asked to.
    m.matrixWorldNeedsUpdate = true;
    m.renderOrder = order;
    scene.add(m);
    return m;
  }

  /** A mesh moved by hand each frame, with its outline hull when the model has one. */
  function puppet(def) {
    const m = new THREE.Mesh(geometryFor(def), materialFor(def));
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    scene.add(m);
    let hull = null;
    if (def.outline) {
      hull = new THREE.Mesh(m.geometry, outlineMaterial(def.outline));
      hull.matrixAutoUpdate = false;
      hull.frustumCulled = false;
      scene.add(hull);
    }
    return {
      mesh: m,
      set(elements) {
        m.matrix.fromArray(elements);
        m.matrixWorldNeedsUpdate = true;
        if (hull) {
          hull.matrix.copy(m.matrix);
          hull.matrixWorldNeedsUpdate = true;
        }
      },
      show(on) {
        m.visible = on;
        if (hull) hull.visible = on;
      },
    };
  }

  /**
   * Instanced copies of one model, refilled every frame: begin(), push(matrix)…, end().
   * kit.instanced keeps every batch on one shared shader (r186 compiles one per plain
   * InstancedMesh). Frustum culling is off: copies move, and the old renderer drew all.
   */
  function batch(def, capacity, material = materialFor(def)) {
    const m = kit.instanced(geometryFor(def), material, capacity);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.visible = false;
    m.frustumCulled = false;
    scene.add(m);
    const arr = m.instanceMatrix.array;
    return {
      mesh: m,
      n: 0,
      begin() { this.n = 0; },
      push(elements) {
        if (this.n >= capacity) return;
        arr.set(elements, this.n * 16);
        this.n++;
      },
      /** A flat, axis-aligned copy: translation and x/z scale (shadow blobs). */
      pushFlat(x, y, z, sx, sz) {
        if (this.n >= capacity) return;
        const o = this.n * 16;
        arr[o] = sx; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
        arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sz; arr[o + 11] = 0;
        arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
        this.n++;
      },
      end() {
        m.count = this.n;
        m.visible = this.n > 0;
        if (!this.n) return;
        const im = m.instanceMatrix;
        im.clearUpdateRanges();
        im.addUpdateRange(0, this.n * 16);
        im.needsUpdate = true;
      },
    };
  }

  // ---- soft blob shadows: one radial-gradient quad per thing, three strengths as before
  function shadowLayer(shadowCanvas) {
    const quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const tex = textureFor(shadowCanvas);
    const make = (strength) => {
      const t = texture(tex);
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      m.colorNode = vec4(vec3(0.22, 0.31, 0.24).mul(t.rgb), t.a.mul(float(strength)));
      m.alphaTest = 0.015;
      return m;
    };
    const def = { raw: [], geometry: quad };
    const soft = batch(def, 1024, make(0.23));
    const firm = batch(def, 16, make(0.37));
    const ball = batch(def, 2, make(0.32));
    for (const b of [soft, firm, ball]) b.mesh.renderOrder = 3;
    return {
      soft, firm, ball,
      begin() { soft.begin(); firm.begin(); ball.begin(); },
      end() { soft.end(); firm.end(); ball.end(); },
    };
  }

  // ---- post: the kit chain (MSAA on high/ultra, FXAA on medium) with the colours left alone
  const post = createPost(kit, scene, camera, { bloom: false });

  // ---- per frame
  const vp = new THREE.Matrix4();
  function view(eye, look) {
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.updateMatrixWorld();
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }

  /** World point to CSS pixels, like the old project(): null when behind the camera. Fills `out`. */
  function project(x, y, z, out) {
    const m = vp.elements;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.05) return null;
    const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    const py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out.x = (px * 0.5 + 0.5) * kit.size.width;
    out.y = (0.5 - py * 0.5) * kit.size.height;
    out.w = w;
    out.visible = px > -1.2 && px < 1.2 && py > -1.2 && py < 1.2;
    return out;
  }

  return {
    scene, camera, post,
    geometryFor, materialFor, mesh, puppet, batch, shadowLayer,
    view, project,
    render() { post.render(); },
  };
}
