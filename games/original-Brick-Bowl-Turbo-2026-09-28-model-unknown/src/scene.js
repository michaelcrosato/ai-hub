import * as THREE from "three/webgpu";
import {
  cos,
  float,
  hash,
  instanceIndex,
  instancedBufferAttribute,
  positionLocal,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
} from "three/tsl";
import { createPost } from "kit/post.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  Jumbotron,
  blimpTexture,
  fieldTexture,
  helmetTexture,
  ribbonTexture,
  skyTexture,
  sponsorTexture,
} from "./art.js";
import { FIELD } from "./config.js";
import { SKIN_TONES } from "./teams.js";

export const Graphics = class {
  kit = null;
  renderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1, 0.3, 900);
  sun = new THREE.DirectionalLight(`#fff4de`, 2.6);
  hemi = new THREE.HemisphereLight(`#cfe9ff`, `#5e8f3c`, 1.35);
  post = null; // scene pass + bloom (the default look)
  plain = null; // scene pass without bloom, built the first time BLOOM FX is switched off
  bloomOn = true;
  isWebGPU = false;
  shadowTarget = new THREE.Object3D();
  /** Set up lights, shadows, camera sizing and the post chain on the kit's renderer. */
  init(kit) {
    this.kit = kit;
    const n = (this.renderer = kit.renderer);
    this.isWebGPU = kit.backend === `webgpu`;
    n.toneMapping = THREE.NeutralToneMapping;
    n.toneMappingExposure = 1.05;
    n.shadowMap.enabled = true;
    n.shadowMap.type = THREE.PCFShadowMap;
    kit.canvas.id = `game-canvas`;
    let r = this.scene;
    r.background = skyTexture();
    r.fog = new THREE.Fog(`#c9ecff`, 240, 520);
    r.add(this.hemi);
    let i = new THREE.AmbientLight(`#ffffff`, 0.25);
    r.add(i);
    this.sun.position.set(-30, 60, -25);
    this.sun.castShadow = true;
    kit.shadow(this.sun, 2048); // 2048 at high, scaled per quality tier
    let a = this.sun.shadow.camera;
    a.left = -34;
    a.right = 34;
    a.top = 34;
    a.bottom = -34;
    a.near = 1;
    a.far = 160;
    this.sun.shadow.bias = -6e-4;
    this.sun.shadow.normalBias = 0.02;
    r.add(this.sun);
    r.add(this.shadowTarget);
    this.sun.target = this.shadowTarget;
    // Wider lens in portrait so the play still fits on a phone held upright.
    kit.onResize((w, h) => {
      this.camera.aspect = w / h;
      this.camera.fov = w / h < 1 ? 70 : 52;
      this.camera.updateProjectionMatrix();
    });
    this.post = createPost(kit, this.scene, this.camera, {
      bloom: { strength: 0.32, radius: 0.35, threshold: 0.86 },
    });
  }
  setBloom(e) {
    this.bloomOn = e;
  }
  focusShadows(e, t) {
    this.shadowTarget.position.set(e, 0, t);
    this.sun.position.set(e - 30, 60, t - 25);
  }
  render() {
    if (this.bloomOn) this.post.render();
    else (this.plain ??= createPost(this.kit, this.scene, this.camera)).render();
  }
};
export const CameraRig = class {
  cam;
  mode = `menu`;
  focus = new THREE.Vector3();
  smoothFocus = new THREE.Vector3();
  pos = new THREE.Vector3(0, 60, -120);
  look = new THREE.Vector3();
  yaw = 0;
  targetYaw = 0;
  height = 12.5;
  back = 15;
  ahead = 8;
  zoom = 1;
  targetZoom = 1;
  shakeAmt = 0;
  t = 0;
  orbitSpeed = 0.35;
  replaySide = 1;
  _goal = new THREE.Vector3(); // reused every frame (no per-frame allocation)
  _aim = new THREE.Vector3();
  constructor(e) {
    this.cam = e;
  }
  setDir(e, t = false) {
    this.targetYaw = e > 0 ? 0 : Math.PI;
    t && (this.yaw = this.targetYaw);
  }
  swingTo(e) {
    let t = (e > 0 ? 0 : Math.PI) - this.yaw;
    for (; t > Math.PI; ) t -= Math.PI * 2;
    for (; t < -Math.PI; ) t += Math.PI * 2;
    this.targetYaw = this.yaw + t;
  }
  shake(e) {
    this.shakeAmt = Math.max(this.shakeAmt, e);
  }
  snap() {
    this.smoothFocus.copy(this.focus);
    this.yaw = this.targetYaw;
  }
  forward(e) {
    return e.set(Math.sin(this.yaw), Math.cos(this.yaw));
  }
  stickToWorld(e, t, n) {
    let r = Math.sin(this.yaw),
      i = Math.cos(this.yaw);
    return n.set(-i * e + r * t, r * e + i * t);
  }
  update(e) {
    this.t += e;
    let t = 1 - Math.exp(-e * 5.5);
    this.smoothFocus.lerp(this.focus, this.mode === `play` ? 1 - Math.exp(-e * 7) : t);
    let n = this.targetYaw - this.yaw;
    this.yaw += n * (1 - Math.exp(-e * 3.2));
    Math.abs(n) < 5e-4 && (this.yaw = this.targetYaw);
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-e * 2.5));
    let r = this.smoothFocus,
      i = this._goal.set(0, 0, 0),
      a = this._aim.set(0, 0, 0),
      o = Math.sin(this.yaw),
      s = Math.cos(this.yaw);
    switch (this.mode) {
      case `play`:
      case `wide`: {
        let e = this.mode === `wide` ? 1.6 : 1,
          t = this.back * this.zoom * e,
          n = this.height * this.zoom * e;
        if (
          (i.set(r.x * 0.82 - o * t, n, r.z - s * t),
          a.set(r.x * 0.9 + o * this.ahead, 0.5, r.z + s * this.ahead),
          Math.abs(i.z) > 59)
        ) {
          let e = Math.abs(i.z) - 59;
          i.z = Math.sign(i.z) * 59;
          i.y += e * 0.55;
        }
        break;
      }
      case `orbit`: {
        let e = this.t * this.orbitSpeed;
        i.set(r.x + Math.sin(e) * 9, 4.2, r.z + Math.cos(e) * 9);
        a.set(r.x, 1.3, r.z);
        break;
      }
      case `toss`:
        i.set(r.x + 1.5, 3.2, r.z - 6.5);
        a.set(r.x, 2.2, r.z);
        break;
      case `replay`:
        i.set(r.x + this.replaySide * 16, 5.5, r.z - 3);
        a.set(r.x, 1, r.z);
        break;
      case `menu`: {
        let e = this.t * 0.06;
        i.set(Math.sin(e) * 70, 34, Math.cos(e) * 95);
        a.set(0, 0, 0);
        break;
      }
    }
    let c = this.mode === `play` ? 1 - Math.exp(-e * 6) : t;
    if (
      (this.pos.lerp(i, c), this.look.lerp(a, c), this.cam.position.copy(this.pos), this.shakeAmt > 0.001)
    ) {
      let t = this.shakeAmt;
      this.cam.position.x += (Math.random() - 0.5) * t;
      this.cam.position.y += (Math.random() - 0.5) * t;
      this.cam.position.z += (Math.random() - 0.5) * t;
      this.shakeAmt *= Math.exp(-e * 7);
    }
    this.cam.lookAt(this.look);
    n = 0;
  }
};
export const boxGeo = (e, t, n, r = 0, i = 0, a = 0) => {
  let o = new THREE.BoxGeometry(e, t, n);
  return (o.translate(r, i, a), o);
};
export function tint(e, t) {
  let n = new THREE.Color(t),
    r = e.attributes.position.count,
    i = new Float32Array(r * 3);
  for (let e = 0; e < r; e++) {
    i[e * 3] = n.r;
    i[e * 3 + 1] = n.g;
    i[e * 3 + 2] = n.b;
  }
  return (e.setAttribute(`color`, new THREE.BufferAttribute(i, 3)), e);
}
/** Merge static meshes that share one material into a single draw (transforms baked in). */
function bakeMerge(meshes, material) {
  const geos = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    return m.geometry.clone().applyMatrix4(m.matrixWorld);
  });
  for (const m of meshes) m.geometry.dispose();
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return new THREE.Mesh(merged, material);
}
export function buildStadium(t, n) {
  let r = new THREE.Group();
  t.add(r);
  let i = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ color: `#4d9e45` }),
  );
  i.rotation.x = -Math.PI / 2;
  i.position.y = -0.4;
  r.add(i);
  let a = new THREE.Mesh(
    new THREE.PlaneGeometry(78, 142),
    new THREE.MeshLambertMaterial({ color: `#2f9a3d` }),
  );
  a.rotation.x = -Math.PI / 2;
  a.position.y = -0.01;
  a.receiveShadow = true;
  r.add(a);
  for (let e of [-1, 1]) {
    let t = n[e < 0 ? 0 : 1],
      i = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 50),
        new THREE.MeshLambertMaterial({ color: t.colors.dark }),
      );
    i.rotation.x = -Math.PI / 2;
    i.position.set(e * 31.5, -0.005, 0);
    i.receiveShadow = true;
    r.add(i);
  }
  let o = fieldTexture(n),
    s = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.HALF_W * 2, FIELD.END * 2),
      new THREE.MeshLambertMaterial({ map: o }),
    );
  s.rotation.x = -Math.PI / 2;
  s.receiveShadow = true;
  r.add(s);
  let c = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD.HALF_W * 2, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: `#2e7bff`, transparent: true, opacity: 0.9 }),
  );
  c.position.y = 0.012;
  r.add(c);
  let l = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD.HALF_W * 2, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: `#ffe01a`, transparent: true, opacity: 0.95 }),
  );
  l.position.y = 0.014;
  r.add(l);
  let u = sponsorTexture(),
    d = new THREE.MeshBasicMaterial({ map: u }),
    f = new THREE.MeshLambertMaterial({ color: `#23233a` }),
    p = [
      [0, 71, 78, 0],
      [0, -71, 78, Math.PI],
      [39, 0, 142, -Math.PI / 2],
      [-39, 0, 142, Math.PI / 2],
    ],
    m = [];
  const adWalls = [];
  for (let [e, t, n, i] of p) {
    let a = new THREE.Mesh(new THREE.BoxGeometry(n, 1.6, 0.6), f);
    a.position.set(e, 0.8, t);
    a.rotation.y = i;
    adWalls.push(a);
    let o = u.clone();
    o.needsUpdate = true;
    o.repeat.set(n / 40, 1);
    m.push(o);
    let s = new THREE.Mesh(new THREE.PlaneGeometry(n, 1.2), new THREE.MeshBasicMaterial({ map: o }));
    s.position.set(e, 0.85, t);
    s.rotation.y = i + Math.PI;
    s.translateZ(-0.32);
    r.add(s);
  }
  d.dispose();
  r.add(bakeMerge(adWalls, f));
  let h = [],
    g = [],
    _ = [`#dfe3ee`, `#c9cfe0`],
    v = (e, t, r, i, a) => {
      for (let o = 0; o < 16; o++) {
        let s = i + o * 1.05,
          c = 1.2 + o * 0.72,
          l =
            e === `x`
              ? boxGeo(1.1, c, r * 2, t * s, c / 2 - 0.4, 0)
              : boxGeo(r * 2, c, 1.1, 0, c / 2 - 0.4, t * s),
          u = o % 5 == 4 ? (a === 1 ? n[1].colors.jersey : n[0].colors.jersey) : _[o % 2];
        h.push(tint(l, u));
        for (let n = -r + 0.6; n < r - 0.4; n += 0.78) {
          if (Math.random() < 0.07) continue;
          let r = e === `x` ? t * s : n + (Math.random() - 0.5) * 0.1,
            i = e === `x` ? n + (Math.random() - 0.5) * 0.1 : t * s,
            o = e === `x` ? (t > 0 ? -Math.PI / 2 : Math.PI / 2) : t > 0 ? Math.PI : 0,
            l = Math.atan2(i, r);
          g.push({ x: r, y: c - 0.4, z: i, rot: o, seat: (l / (Math.PI * 2) + 1) % 1, team: a });
        }
      }
    };
  v(`x`, -1, 64, 41, 0);
  v(`x`, 1, 64, 41, 1);
  v(`z`, -1, 38, 73, 0);
  v(`z`, 1, 38, 73, 1);
  let y = new THREE.Mesh(mergeGeometries(h), new THREE.MeshLambertMaterial({ vertexColors: true }));
  y.receiveShadow = true;
  r.add(y);
  let b = ribbonTexture(n),
    ee = [],
    ribbonFrameMat = new THREE.MeshLambertMaterial({ color: `#2b2b48` }),
    ribbonFrames = [];
  for (let [e, t, n, i] of [
    [-57.8, 0, 128, Math.PI / 2],
    [57.8, 0, 128, -Math.PI / 2],
    [0, -89.8, 76, 0],
    [0, 89.8, 76, Math.PI],
  ]) {
    let a = b.clone();
    a.needsUpdate = true;
    a.repeat.set(n / 60, 1);
    ee.push(a);
    let o = new THREE.Mesh(new THREE.BoxGeometry(n, 4, 1), ribbonFrameMat);
    o.position.set(e, 14.12, t);
    o.rotation.y = i;
    ribbonFrames.push(o);
    let s = new THREE.Mesh(new THREE.PlaneGeometry(n, 1.6), new THREE.MeshBasicMaterial({ map: a }));
    s.position.copy(o.position);
    s.rotation.y = i;
    s.translateZ(0.52);
    s.position.y += 0.4;
    r.add(s);
  }
  r.add(bakeMerge(ribbonFrames, ribbonFrameMat));
  let x = uniform(0.25),
    te = uniform(0),
    ne = g.length,
    re = new THREE.BoxGeometry(0.56, 0.72, 0.42);
  re.translate(0, 0.36, 0);
  let ie = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  ie.translate(0, 0.92, 0);
  let ae = new THREE.BoxGeometry(0.72, 0.16, 0.16);
  ae.translate(0, 0.62, 0.08);
  let oe = instancedBufferAttribute(
      new THREE.InstancedBufferAttribute(new Float32Array(g.map((e) => e.seat)), 1),
      `float`,
    ),
    se = hash(float(instanceIndex)).mul(6.283),
    ce = float(7).add(hash(float(instanceIndex).add(13.1)).mul(5)),
    le = sin(time.mul(ce).add(se)).max(0).mul(x).mul(0.75),
    ue = smoothstep(
      0.93,
      1,
      cos(oe.mul(6.283).sub(time.mul(1.6)))
        .mul(0.5)
        .add(0.5),
    )
      .mul(te)
      .mul(1.1),
    de = vec3(0, le.add(ue), 0),
    fe = new THREE.MeshLambertNodeMaterial();
  fe.positionNode = positionLocal.add(de);
  let pe = new THREE.MeshLambertNodeMaterial();
  pe.positionNode = positionLocal.add(de).add(vec3(0, x.mul(0.5).add(ue.mul(0.6)), 0));
  let me = new THREE.InstancedMesh(re, fe, ne),
    he = new THREE.InstancedMesh(ie, fe, ne),
    ge = new THREE.InstancedMesh(ae, pe, ne),
    _e = new THREE.Matrix4(),
    ve = new THREE.Quaternion(),
    ye = new THREE.Color(),
    be = (e) => {
      let t = e === 2 ? n[Math.random() < 0.5 ? 0 : 1].colors : n[e].colors,
        r = Math.random();
      return r < 0.45
        ? t.jersey
        : r < 0.65
          ? t.trim
          : r < 0.72
            ? n[+(e === 0)].colors.jersey
            : [`#ffffff`, `#20232e`, `#ff8a00`, `#6e6e7e`, `#e5e5e5`, `#3a86ff`][
                Math.floor(Math.random() * 6)
              ];
    };
  g.forEach((e, t) => {
    ve.setFromAxisAngle(new THREE.Vector3(0, 1, 0), e.rot + (Math.random() - 0.5) * 0.3);
    _e.compose(new THREE.Vector3(e.x, e.y, e.z), ve, new THREE.Vector3(1, 0.9 + Math.random() * 0.25, 1));
    me.setMatrixAt(t, _e);
    he.setMatrixAt(t, _e);
    ge.setMatrixAt(t, _e);
    let n = be(e.team);
    me.setColorAt(t, ye.set(n));
    ge.setColorAt(t, ye.set(n));
    he.setColorAt(t, ye.set(SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]));
  });
  for (let e of [me, he, ge]) {
    e.instanceMatrix.needsUpdate = true;
    e.instanceColor && (e.instanceColor.needsUpdate = true);
    e.frustumCulled = false;
    r.add(e);
  }
  let xe = [
      new THREE.MeshLambertMaterial({ color: `#ffd400`, transparent: true }),
      new THREE.MeshLambertMaterial({ color: `#ffd400`, transparent: true }),
    ],
    Se = [],
    Ce = [],
    flagMat = new THREE.MeshBasicMaterial({ color: `#ff3b30` });
  for (let t of [-1, 1]) {
    let i = t * FIELD.END,
      a = new THREE.Group(),
      o = xe[t < 0 ? 0 : 1],
      s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), o);
    s.position.set(0, 1.5, i + t * 1.4);
    let c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1.8), o);
    c.position.set(0, 3.1, i + t * 0.7);
    let l = new THREE.Mesh(new THREE.BoxGeometry(FIELD.POST_HALF * 2 + 0.3, 0.3, 0.3), o);
    l.position.set(0, FIELD.CROSSBAR, i);
    let u = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2, 0.9),
      new THREE.MeshLambertMaterial({ color: n[t < 0 ? 0 : 1].colors.jersey }),
    );
    u.position.set(0, 1, i + t * 1.4);
    const yellow = [s, c, l],
      flags = [];
    for (let n of [-FIELD.POST_HALF, FIELD.POST_HALF]) {
      let r = new THREE.Mesh(new THREE.BoxGeometry(0.22, FIELD.UPRIGHT_TOP - FIELD.CROSSBAR, 0.22), o);
      r.position.set(n, (FIELD.UPRIGHT_TOP + FIELD.CROSSBAR) / 2, i);
      let s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.35), flagMat);
      s.position.set(n, FIELD.UPRIGHT_TOP - 0.2, i - t * 0.2);
      yellow.push(r);
      flags.push(s);
    }
    a.add(bakeMerge(yellow, o), u, bakeMerge(flags, flagMat));
    a.traverse((e) => (e.castShadow = true));
    r.add(a);
    Se.push({ z: i });
    Ce.push(a);
  }
  let we = new THREE.MeshLambertMaterial({ color: `#ff7a00` }),
    pylons = [];
  for (let t of [-1, 1])
    for (let n of [FIELD.GOAL, FIELD.END])
      for (let i of [-1, 1]) {
        let a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), we);
        a.position.set(i * (FIELD.HALF_W + 0.15), 0.28, t * n);
        pylons.push(a);
      }
  const pylonMesh = bakeMerge(pylons, we);
  pylonMesh.castShadow = true;
  r.add(pylonMesh);
  let Te = new THREE.MeshLambertMaterial({ color: `#4a4f6a` }),
    Ee = new THREE.MeshBasicMaterial({ color: `#fffbe0` }),
    steel = [],
    lamps = [];
  for (let e of [-1, 1])
    for (let t of [-1, 1]) {
      let n = new THREE.Group(),
        i = new THREE.Mesh(new THREE.BoxGeometry(1.4, 44, 1.4), Te);
      i.position.y = 22;
      n.add(i);
      steel.push(i);
      let a = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.8), Te);
      a.position.y = 45;
      n.add(a);
      steel.push(a);
      for (let e = 0; e < 4; e++)
        for (let t = 0; t < 2; t++) {
          let r = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.3), Ee);
          r.position.set(-3.3 + e * 2.2, 44 + t * 2.1, 0.5);
          n.add(r);
          lamps.push(r);
        }
      n.position.set(e * 50, 0, t * 82);
      n.rotation.y = Math.atan2(-n.position.x, -n.position.z);
    }
  let De = new Jumbotron(n),
    Oe = new THREE.MeshBasicMaterial({ map: De.texture }),
    boardMat = new THREE.MeshLambertMaterial({ color: `#1a1a2e` }),
    boards = [];
  for (let e of [-1, 1]) {
    let t = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 1.5), boardMat),
      i = e * 92.8;
    t.position.set(0, 24.72, i);
    boards.push(t);
    let a = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), Oe);
    a.position.set(0, 24.72, i - e * 0.8);
    a.rotation.y = e > 0 ? Math.PI : 0;
    r.add(a);
    for (let t of [-9, 9]) {
      let n = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 1.2), Te);
      n.position.set(t, 12.72, i + e * 0.5);
      steel.push(n);
    }
    const logoMat = new THREE.MeshBasicMaterial({ map: helmetTexture(n[+(e < 0)]) });
    let o = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 1), [
      boardMat,
      boardMat,
      boardMat,
      boardMat,
      logoMat,
      logoMat,
    ]);
    o.position.set(-18, 24.72, i);
    r.add(o);
    let s = o.clone();
    s.position.x = 18;
    r.add(s);
  }
  r.add(bakeMerge(boards, boardMat), bakeMerge(steel, Te), bakeMerge(lamps, Ee));
  let ke = [];
  for (let e of [-1, 1]) {
    let t = n[e < 0 ? 0 : 1];
    ke.push(tint(boxGeo(1.2, 0.6, 30, e * 34, 0.3, 0), `#50506a`));
    for (let n = 0; n < 14; n++) {
      let r = -13 + n * 2 + (Math.random() - 0.5) * 0.6,
        i = e * (32.4 + Math.random() * 1.4);
      ke.push(tint(boxGeo(0.4, 0.95, 0.4, i, 0.47, r), t.colors.pants));
      ke.push(tint(boxGeo(0.75, 0.75, 0.5, i, 1.3, r), t.colors.jersey));
      ke.push(tint(boxGeo(0.5, 0.5, 0.55, i, 1.95, r), t.colors.helmet));
    }
    ke.push(tint(boxGeo(0.8, 0.9, 0.8, e * 35, 0.45, 16), `#ff8a00`));
    ke.push(tint(boxGeo(0.8, 0.9, 0.8, e * 35, 0.45, -16), `#ff8a00`));
  }
  let Ae = new THREE.Mesh(mergeGeometries(ke), new THREE.MeshLambertMaterial({ vertexColors: true }));
  Ae.castShadow = true;
  r.add(Ae);
  let je = new THREE.MeshLambertMaterial({ color: `#ffffff`, emissive: `#c8dcff`, emissiveIntensity: 0.35 }),
    Me = new THREE.Group(),
    puffs = [];
  for (let e = 0; e < 14; e++) {
    let t = new THREE.Group(),
      n = 3 + Math.floor(Math.random() * 4);
    for (let e = 0; e < n; e++) {
      let r = new THREE.Mesh(
        new THREE.BoxGeometry(8 + Math.random() * 10, 4 + Math.random() * 4, 6 + Math.random() * 6),
        je,
      );
      r.position.set(e * 7 - n * 3, Math.random() * 3, (Math.random() - 0.5) * 6);
      t.add(r);
      puffs.push(r);
    }
    let r = (e / 14) * Math.PI * 2 + Math.random() * 0.3,
      i = 180 + Math.random() * 120;
    t.position.set(Math.cos(r) * i, 55 + Math.random() * 45, Math.sin(r) * i);
    t.lookAt(0, t.position.y, 0);
  }
  // All cloud puffs as one mesh; the group still turns slowly overhead.
  Me.add(bakeMerge(puffs, je));
  r.add(Me);
  let Ne = new THREE.Group(),
    Pe = blimpTexture(),
    Fe = [
      new THREE.MeshLambertMaterial({ color: `#f4f4f8` }),
      new THREE.MeshLambertMaterial({ color: `#f4f4f8` }),
      new THREE.MeshLambertMaterial({ color: `#f4f4f8` }),
      new THREE.MeshLambertMaterial({ color: `#f4f4f8` }),
      new THREE.MeshBasicMaterial({ map: Pe }),
      new THREE.MeshBasicMaterial({ map: Pe }),
    ],
    Ie = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 20), [Fe[4], Fe[5], Fe[0], Fe[1], Fe[2], Fe[3]]);
  Ne.add(Ie);
  let Le = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 3), Fe[0]);
  Le.position.z = 11;
  let Re = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3), Fe[0]);
  Re.position.z = -11;
  let ze = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 4, 3),
    new THREE.MeshLambertMaterial({ color: `#ff5a1f` }),
  );
  ze.position.set(0, 3, -11);
  let Be = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 3),
    new THREE.MeshLambertMaterial({ color: `#ff5a1f` }),
  );
  Be.position.set(0, 0, -11);
  let Ve = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.2, 4),
    new THREE.MeshLambertMaterial({ color: `#333` }),
  );
  Ve.position.y = -3;
  Ne.add(Le, Re, ze, Be, Ve);
  r.add(Ne);
  let He = new THREE.MeshBasicMaterial({ color: `#fff7c2` }),
    Ue = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 2), He);
  Ue.position.set(-160, 160, -260);
  Ue.lookAt(0, 0, 0);
  r.add(Ue);
  let We = 0;
  return {
    group: r,
    excitement: x,
    wave: te,
    losLine: c,
    firstDownLine: l,
    jumbotron: De,
    posts: Se,
    fadePosts(t) {
      for (let n = 0; n < 2; n++) {
        let r = n === 0 ? -FIELD.END : FIELD.END,
          i = Math.abs(t - r) < 9 && Math.sign(t) === Math.sign(r),
          a = xe[n];
        a.opacity += ((i ? 0.18 : 1) - a.opacity) * 0.15;
        a.depthWrite = a.opacity > 0.9;
      }
    },
    update(e) {
      We += e;
      for (let t of m) t.offset.x = (t.offset.x + e * 0.03) % 1;
      for (let t of ee) t.offset.x = (t.offset.x - e * 0.05) % 1;
      let t = We * 0.05;
      Ne.position.set(Math.cos(t) * 110, 62, Math.sin(t) * 140);
      Ne.rotation.y = -t;
      Me.rotation.y = We * 0.004;
    },
  };
}
