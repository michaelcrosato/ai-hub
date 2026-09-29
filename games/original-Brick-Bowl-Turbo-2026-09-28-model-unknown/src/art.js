import * as THREE from "three/webgpu";
import { FIELD } from "./config.js";
import { SKIN_TONES } from "./teams.js";

export const FONT_DISPLAY = `"Bungee", "Impact", "Arial Black", sans-serif`;
export const FONT_BODY = `"Russo One", "Arial Black", sans-serif`;
export function makeCanvas(e, t) {
  let n = document.createElement(`canvas`);
  return ((n.width = e), (n.height = t), [n, n.getContext(`2d`)]);
}
export function canvasTexture(e, t = true) {
  let n = new THREE.CanvasTexture(e);
  return (t && (n.colorSpace = THREE.SRGBColorSpace), (n.anisotropy = 8), (n.needsUpdate = true), n);
}
export function fieldTexture(t) {
  let n = Math.round(FIELD.HALF_W * 2 * 24),
    r = FIELD.END * 2 * 24,
    [i, a] = makeCanvas(n, r),
    o = (t) => (t + FIELD.HALF_W) * 24,
    s = (t) => (t + FIELD.END) * 24;
  for (let t = -FIELD.GOAL; t < FIELD.GOAL; t += 5) {
    a.fillStyle = Math.round((t + FIELD.GOAL) / 5) % 2 == 0 ? `#3fbf4c` : `#36ad43`;
    a.fillRect(0, s(t), n, 120);
  }
  a.globalAlpha = 0.06;
  for (let t = -FIELD.HALF_W; t < FIELD.HALF_W; t += 2.5)
    Math.round((t + FIELD.HALF_W) / 2.5) % 2 &&
      ((a.fillStyle = `#ffffff`), a.fillRect(o(t), s(-FIELD.GOAL), 60, 2400));
  a.globalAlpha = 1;
  let c = (e, t, i) => {
    a.fillStyle = t.colors.jersey;
    a.fillRect(0, s(e), n, 240);
    a.save();
    a.beginPath();
    a.rect(0, s(e), n, 240);
    a.clip();
    a.strokeStyle = `rgba(255,255,255,0.10)`;
    a.lineWidth = 18;
    for (let t = -r; t < n + r; t += 60) {
      a.beginPath();
      a.moveTo(t, s(e));
      a.lineTo(t + 240, s(e) + 240);
      a.stroke();
    }
    a.restore();
    a.save();
    a.translate(n / 2, s(e + 5));
    i && a.rotate(Math.PI);
    a.font = `148.8px ${FONT_DISPLAY}`;
    a.textAlign = `center`;
    a.textBaseline = `middle`;
    a.lineWidth = 16;
    a.strokeStyle = t.colors.dark;
    a.fillStyle = t.colors.trim;
    let o = t.name.toUpperCase();
    a.strokeText(o, 0, 8);
    a.fillText(o, 0, 8);
    a.restore();
  };
  c(-FIELD.END, t[0], false);
  c(FIELD.GOAL, t[1], true);
  a.fillStyle = `#ffffff`;
  let l = 0.35 * 24;
  a.fillRect(0, 0, l, r);
  a.fillRect(n - l, 0, l, r);
  a.fillRect(0, 0, n, l);
  a.fillRect(0, r - l, n, l);
  for (let t = -FIELD.GOAL; t <= FIELD.GOAL; t += 5) {
    let r = t === -FIELD.GOAL || t === FIELD.GOAL ? 0.35 : 0.14;
    a.fillRect(0, s(t) - (r * 24) / 2, n, r * 24);
  }
  for (let t = -FIELD.GOAL + 1; t < FIELD.GOAL; t++)
    if ((t + FIELD.GOAL) % 5 != 0) {
      for (let n of [-FIELD.HASH, FIELD.HASH]) a.fillRect(o(n) - 0.35 * 24, s(t) - 1.44, 0.7 * 24, 2.88);
      a.fillRect(o(-FIELD.HALF_W) + 0.35 * 24, s(t) - 1.44, 0.7 * 24, 2.88);
      a.fillRect(o(FIELD.HALF_W) - 1.05 * 24, s(t) - 1.44, 0.7 * 24, 2.88);
    }
  for (let t of [-1, 1]) a.fillRect(o(-0.5), s(t * (FIELD.GOAL - 2)) - 1.44, 24, 2.88);
  a.textAlign = `center`;
  a.textBaseline = `middle`;
  a.font = `${2.2 * 24}px ${FONT_DISPLAY}`;
  for (let t = 10; t <= 90; t += 10) {
    let n = -FIELD.GOAL + t,
      r = t <= 50 ? t : 100 - t;
    for (let i of [-1, 1]) {
      let c = i * (FIELD.HALF_W - 10);
      if (
        (a.save(),
        a.translate(o(c), s(n)),
        a.rotate(i < 0 ? Math.PI / 2 : -Math.PI / 2),
        (a.fillStyle = `#ffffff`),
        a.fillText(String(r), 0, 0),
        r !== 50)
      ) {
        let e = (t < 50 ? -1 : 1) * (i < 0 ? -1 : 1);
        a.beginPath();
        let n = e * 2.1 * 24;
        a.moveTo(n + e * 0.45 * 24, -0.3 * 24);
        a.lineTo(n, -0.62 * 24);
        a.lineTo(n, 0.48);
        a.closePath();
        a.fill();
      }
      a.restore();
    }
  }
  a.save();
  a.translate(n / 2, s(0));
  a.fillStyle = `rgba(255,255,255,0.18)`;
  a.beginPath();
  a.arc(0, 0, 144, 0, Math.PI * 2);
  a.fill();
  a.rotate(-Math.PI / 2);
  drawLogo(a, 0, 0, 5.3 * 24);
  a.restore();
  let u = canvasTexture(i);
  return ((u.generateMipmaps = true), (u.minFilter = THREE.LinearMipmapLinearFilter), (u.anisotropy = 16), u);
}
export function drawLogo(e, t, n, r) {
  e.save();
  e.translate(t, n);
  let i = r / 100;
  e.fillStyle = `#ff5a1f`;
  e.strokeStyle = `#1b1035`;
  e.lineWidth = 6 * i;
  e.beginPath();
  e.roundRect(-92 * i, -44 * i, 184 * i, 88 * i, 12 * i);
  e.fill();
  e.stroke();
  e.fillStyle = `#ffd23f`;
  for (let t = -2; t <= 2; t++) {
    e.beginPath();
    e.roundRect(t * 34 * i - 13 * i, -60 * i, 26 * i, 18 * i, 4 * i);
    e.fill();
    e.stroke();
  }
  e.fillStyle = `#ffffff`;
  e.font = `${40 * i}px ${FONT_DISPLAY}`;
  e.textAlign = `center`;
  e.textBaseline = `middle`;
  e.lineWidth = 10 * i;
  e.strokeText(`BRICK`, 0, -12 * i);
  e.fillText(`BRICK`, 0, -12 * i);
  e.fillStyle = `#ffd23f`;
  e.font = `${30 * i}px ${FONT_DISPLAY}`;
  e.strokeText(`BOWL`, 0, 24 * i);
  e.fillText(`BOWL`, 0, 24 * i);
  e.restore();
}
export const jerseyCache = new Map();
export function jerseyTextures(e, t) {
  let n = `${e.abbr}-${t.num}`,
    r = jerseyCache.get(n);
  if (r) return r;
  let i = (n) => {
      let [r, i] = makeCanvas(256, 256);
      i.fillStyle = e.colors.jersey;
      i.fillRect(0, 0, 256, 256);
      i.fillStyle = e.colors.trim;
      i.fillRect(0, 0, 18, 256);
      i.fillRect(238, 0, 18, 256);
      i.textAlign = `center`;
      i.textBaseline = `middle`;
      n &&
        ((i.font = `36px ${FONT_BODY}`),
        (i.fillStyle = e.colors.number),
        i.fillText(t.last.toUpperCase(), 128, 38, 220));
      i.font = `${n ? 150 : 170}px ${FONT_DISPLAY}`;
      i.lineJoin = `round`;
      i.lineWidth = 16;
      i.strokeStyle = e.colors.trim;
      let a = n ? 158 : 140;
      return (
        i.strokeText(String(t.num), 128, a),
        (i.fillStyle = e.colors.number),
        i.fillText(String(t.num), 128, a),
        canvasTexture(r)
      );
    },
    a = { front: i(false), back: i(true) };
  return (jerseyCache.set(n, a), a);
}
export function helmetTexture(e) {
  let [t, n] = makeCanvas(128, 128);
  return (
    (n.fillStyle = e.colors.helmet),
    n.fillRect(0, 0, 128, 128),
    n.save(),
    n.translate(64, 64),
    (n.fillStyle = e.colors.stripe),
    (n.strokeStyle = e.colors.dark),
    (n.lineWidth = 6),
    e.id === 0
      ? (n.beginPath(),
        n.arc(-4, 8, 34, 0, Math.PI * 2),
        n.fill(),
        n.stroke(),
        (n.fillStyle = `#ffffff`),
        n.fillRect(18, -40, 12, 18),
        (n.fillStyle = `#ff9d00`),
        n.beginPath(),
        n.arc(30, -44, 10, 0, Math.PI * 2),
        n.fill())
      : (n.beginPath(),
        n.moveTo(-40, 34),
        n.quadraticCurveTo(-8, -10, 22, -44),
        n.quadraticCurveTo(14, 4, 42, 34),
        n.closePath(),
        n.fill(),
        n.stroke()),
    n.restore(),
    canvasTexture(t)
  );
}
export const SPONSORS = [
  [`BLOCK COLA`, `#ff2d55`, `#ffffff`],
  [`CUBE BURGER`, `#ffcc00`, `#c1121f`],
  [`BRICK BANK`, `#0a84ff`, `#ffffff`],
  [`VOXEL AIR`, `#30d158`, `#0b3d20`],
  [`STACK SNACKS`, `#ff9f0a`, `#2b1700`],
  [`TURBO FUEL`, `#bf5af2`, `#ffffff`],
  [`STUD MOBILE`, `#64d2ff`, `#00243d`],
  [`GRID GUM`, `#ff375f`, `#fff4a3`],
];
export function sponsorTexture() {
  let [e, t] = makeCanvas(2048, 128),
    n = 2048 / SPONSORS.length;
  SPONSORS.forEach(([e, r, i], a) => {
    t.fillStyle = r;
    t.fillRect(a * n, 0, n, 128);
    t.fillStyle = i;
    t.font = `58px ${FONT_DISPLAY}`;
    t.textAlign = `center`;
    t.textBaseline = `middle`;
    t.fillText(e, a * n + n / 2, 68, n - 20);
  });
  let r = canvasTexture(e);
  return ((r.wrapS = THREE.RepeatWrapping), r);
}
export function ribbonTexture(e) {
  let [t, n] = makeCanvas(2048, 64);
  n.fillStyle = `#0b0b1a`;
  n.fillRect(0, 0, 2048, 64);
  let r = [
      `${e[0].city.toUpperCase()} ${e[0].name.toUpperCase()}`,
      `BRICK BOWL TURBO`,
      `${e[1].city.toUpperCase()} ${e[1].name.toUpperCase()}`,
      `MAKE SOME NOISE!`,
    ],
    i = [e[0].colors.accent, `#ffd23f`, e[1].colors.accent, `#ff5a1f`],
    a = 2048 / r.length;
  r.forEach((e, t) => {
    n.fillStyle = i[t];
    n.font = `40px ${FONT_DISPLAY}`;
    n.textAlign = `center`;
    n.textBaseline = `middle`;
    n.fillText(e, t * a + a / 2, 34, a - 30);
  });
  let o = canvasTexture(t);
  return ((o.wrapS = THREE.RepeatWrapping), o);
}
export function blimpTexture() {
  let [e, t] = makeCanvas(512, 128);
  return (
    (t.fillStyle = `#ffffff`),
    t.fillRect(0, 0, 512, 128),
    (t.fillStyle = `#ff5a1f`),
    (t.font = `64px ${FONT_DISPLAY}`),
    (t.textAlign = `center`),
    (t.textBaseline = `middle`),
    t.fillText(`BRICK BOWL`, 256, 68),
    canvasTexture(e)
  );
}
export const Jumbotron = class {
  teams;
  canvas;
  g;
  texture;
  flashText = null;
  flashT = 0;
  lastKey = ``;
  constructor(e) {
    this.teams = e;
    [this.canvas, this.g] = makeCanvas(512, 256);
    this.texture = canvasTexture(this.canvas);
  }
  flash(e, t = 4) {
    this.flashText = e;
    this.flashT = t;
    this.lastKey = ``;
  }
  update(e, t) {
    this.flashT > 0 && (this.flashT -= e);
    let n = this.flashT > 0 && this.flashText,
      r = n ? Math.floor(this.flashT * 4) % 2 : 0,
      i = n ? `${this.flashText}-${r}` : `${t.scores}-${t.quarter}-${t.clock}-${t.down}`;
    if (i === this.lastKey) return;
    this.lastKey = i;
    let a = this.g;
    a.fillStyle = `#05050f`;
    a.fillRect(0, 0, 512, 256);
    a.fillStyle = `rgba(255,255,255,0.03)`;
    for (let e = 0; e < 512; e += 4) a.fillRect(e, 0, 1, 256);
    if (((a.textAlign = `center`), (a.textBaseline = `middle`), n)) {
      a.fillStyle = r ? `#ffd23f` : `#ff5a1f`;
      a.font = `64px ${FONT_DISPLAY}`;
      let e = this.flashText.split(` `);
      if (e.length > 1 && this.flashText.length > 10) {
        let t = Math.ceil(e.length / 2);
        a.fillText(e.slice(0, t).join(` `), 256, 90, 490);
        a.fillText(e.slice(t).join(` `), 256, 170, 490);
      } else a.fillText(this.flashText, 256, 128, 490);
    } else {
      for (let e = 0; e < 2; e++) {
        let n = this.teams[e],
          r = e === 0 ? 128 : 384;
        a.fillStyle = n.colors.jersey;
        a.fillRect(r - 118, 16, 236, 56);
        a.fillStyle = `#ffffff`;
        a.font = `40px ${FONT_DISPLAY}`;
        a.fillText(n.abbr, r, 46);
        a.fillStyle = n.colors.accent;
        a.font = `96px ${FONT_DISPLAY}`;
        a.fillText(String(t.scores[e]), r, 136);
      }
      a.fillStyle = `#ffffff`;
      a.font = `30px ${FONT_DISPLAY}`;
      a.fillText(`${t.quarter}  ${t.clock}`, 256, 206);
      a.fillStyle = `#ffd23f`;
      a.font = `22px ${FONT_BODY}`;
      a.fillText(t.down, 256, 238);
    }
    this.texture.needsUpdate = true;
  }
};
export function skyTexture() {
  let [e, t] = makeCanvas(4, 512),
    n = t.createLinearGradient(0, 0, 0, 512);
  return (
    n.addColorStop(0, `#1f6fff`),
    n.addColorStop(0.45, `#58b4ff`),
    n.addColorStop(0.75, `#b9ecff`),
    n.addColorStop(1, `#fff1c9`),
    (t.fillStyle = n),
    t.fillRect(0, 0, 4, 512),
    canvasTexture(e)
  );
}
export const mat = (e, t = 0.5) => new THREE.MeshStandardMaterial({ color: e, roughness: t, metalness: 0 });
export function teamMaterials(e) {
  let t = e.colors,
    n = mat(t.helmet, 0.28),
    r = new THREE.MeshStandardMaterial({ map: helmetTexture(e), roughness: 0.3 });
  return {
    jersey: mat(t.jersey, 0.6),
    trim: mat(t.trim, 0.5),
    pants: mat(t.pants, 0.55),
    socks: mat(t.socks, 0.6),
    helmet: n,
    helmetMats: [r, r, n, n, n, n],
    stripe: mat(t.stripe, 0.3),
    mask: mat(t.mask, 0.4),
    glove: mat(t.trim, 0.6),
    shoe: mat(`#18181f`, 0.4),
    skins: SKIN_TONES.map((e) => mat(e, 0.7)),
    eye: new THREE.MeshBasicMaterial({ color: `#141414` }),
  };
}
export const boxCache = new Map();
export function box(e, t, n) {
  let r = `${e.toFixed(3)}|${t.toFixed(3)}|${n.toFixed(3)}`,
    i = boxCache.get(r);
  return (i || ((i = new THREE.BoxGeometry(e, t, n)), boxCache.set(r, i)), i);
}
export function part(e, t, n = 0, r = 0, i = 0) {
  let a = new THREE.Mesh(e, t);
  return (a.position.set(n, r, i), (a.castShadow = true), a);
}
export const HIP_Y = 0.98;
/** Jersey front/back materials per rostered player, built once and reused on every snap. */
const torsoMatCache = new Map();
function torsoMaterials(team, info) {
  const key = `${team.abbr}-${info.num}`;
  let m = torsoMatCache.get(key);
  if (!m) {
    const tex = jerseyTextures(team, info);
    m = [
      new THREE.MeshStandardMaterial({ map: tex.front, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: tex.back, roughness: 0.6 }),
    ];
    torsoMatCache.set(key, m);
  }
  return m;
}
export const PlayerModel = class {
  root = new THREE.Group();
  hips = new THREE.Group();
  spine = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  shinL = new THREE.Group();
  shinR = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  foreL = new THREE.Group();
  foreR = new THREE.Group();
  head = new THREE.Group();
  ballAnchor = new THREE.Object3D();
  torso;
  torsoMats;
  skinMeshes = [];
  mats;
  widthScale = 1;
  mode = `idle`;
  modeT = 0;
  runPhase = Math.random() * 10;
  celebrateStyle = 0;
  flipX = false;
  constructor(e) {
    this.mats = e;
    this.root.add(this.hips);
    this.hips.position.y = HIP_Y;
    this.hips.add(part(box(0.64, 0.28, 0.4), e.pants, 0, 0.02, 0));
    for (let [t, n, r] of [
      [this.legL, this.shinL, -1],
      [this.legR, this.shinR, 1],
    ]) {
      t.position.set(r * 0.17, -0.02, 0);
      this.hips.add(t);
      t.add(part(box(0.27, 0.46, 0.33), e.pants, 0, -0.23, 0));
      n.position.set(0, -0.46, 0);
      t.add(n);
      n.add(part(box(0.23, 0.4, 0.27), e.socks, 0, -0.2, 0));
      n.add(part(box(0.26, 0.14, 0.4), e.shoe, 0, -0.44, 0.05));
    }
    this.spine.position.y = 0.14;
    this.hips.add(this.spine);
    let t = e.jersey;
    this.torsoMats = [t, t, t, t, t, t];
    this.torso = part(box(0.7, 0.52, 0.42), this.torsoMats, 0, 0.27, 0);
    this.spine.add(this.torso);
    this.spine.add(part(box(0.98, 0.22, 0.54), e.jersey, 0, 0.62, 0));
    this.spine.add(part(box(0.3, 0.06, 0.56), e.trim, -0.3, 0.745, 0));
    this.spine.add(part(box(0.3, 0.06, 0.56), e.trim, 0.3, 0.745, 0));
    for (let [t, n, r] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ]) {
      t.position.set(r * 0.55, 0.62, 0);
      this.spine.add(t);
      t.add(part(box(0.22, 0.34, 0.24), e.jersey, 0, -0.16, 0));
      t.add(part(box(0.23, 0.06, 0.25), e.trim, 0, -0.3, 0));
      n.position.set(0, -0.33, 0);
      t.add(n);
      let i = part(box(0.18, 0.3, 0.2), e.skins[0], 0, -0.15, 0);
      this.skinMeshes.push(i);
      n.add(i);
      n.add(part(box(0.21, 0.14, 0.23), e.glove, 0, -0.34, 0));
    }
    this.ballAnchor.position.set(0, -0.36, 0.14);
    this.foreR.add(this.ballAnchor);
    this.head.position.y = 0.74;
    this.spine.add(this.head);
    let n = part(box(0.24, 0.14, 0.24), e.skins[0], 0, 0.02, 0);
    this.skinMeshes.push(n);
    this.head.add(n);
    this.head.add(part(box(0.58, 0.52, 0.6), e.helmetMats, 0, 0.32, -0.02));
    this.head.add(part(box(0.14, 0.06, 0.64), e.stripe, 0, 0.6, -0.02));
    let r = part(box(0.4, 0.26, 0.06), e.skins[0], 0, 0.26, 0.28);
    this.skinMeshes.push(r);
    this.head.add(r);
    this.head.add(part(box(0.07, 0.07, 0.02), e.eye, -0.1, 0.3, 0.315));
    this.head.add(part(box(0.07, 0.07, 0.02), e.eye, 0.1, 0.3, 0.315));
    this.head.add(part(box(0.5, 0.05, 0.05), e.mask, 0, 0.14, 0.34));
    this.head.add(part(box(0.5, 0.05, 0.05), e.mask, 0, 0.24, 0.35));
    this.head.add(part(box(0.05, 0.2, 0.05), e.mask, 0, 0.18, 0.36));
    this.head.add(part(box(0.05, 0.28, 0.2), e.mask, -0.26, 0.2, 0.26));
    this.head.add(part(box(0.05, 0.28, 0.2), e.mask, 0.26, 0.2, 0.26));
    // Trim, shoes, gloves, face mask and the face itself barely change a player's shadow but cost
    // ~18 extra draws each in the shadow pass; only the big blocks cast shadows.
    const minor = new Set([e.trim, e.shoe, e.glove, e.stripe, e.mask, e.eye]);
    this.root.traverse((m) => {
      if (m.isMesh && (minor.has(m.material) || (m.parent === this.head && this.skinMeshes.includes(m))))
        m.castShadow = false;
    });
  }
  setIdentity(e, t) {
    // Cached per player: re-binding a squad every snap no longer creates (and disposes) 44 materials.
    let [r, i] = torsoMaterials(e, t);
    this.torsoMats[4] = r;
    this.torsoMats[5] = i;
    this.torso.material = this.torsoMats;
    let a = this.mats.skins[t.skin % this.mats.skins.length];
    for (let e of this.skinMeshes) e.material = a;
    this.widthScale = t.size;
    let o = t.size;
    this.hips.scale.set(o, 1, 0.9 + (o - 1) * 0.6);
    this.celebrateStyle = t.num % 4;
  }
  setMode(e) {
    e !== this.mode && ((this.mode = e), (this.modeT = 0));
  }
  animate(e, t, n) {
    this.modeT += e;
    let r = this.modeT,
      i = 1 - Math.exp(-e * 16),
      a = (e, t, n = 0, r = 0) => {
        e.rotation.x += (t - e.rotation.x) * i;
        e.rotation.y += (n - e.rotation.y) * i;
        e.rotation.z += (r - e.rotation.z) * i;
      },
      o = HIP_Y,
      s = 0,
      c = 0,
      l = 0,
      u = 0,
      d = 0,
      f = 0,
      p = 0,
      m = 0,
      h = 0,
      g = -0.2,
      _ = -0.2,
      v = 0.12,
      y = -0.12,
      b = 0;
    switch (this.mode) {
      case `run`: {
        let r = Math.min(1.4, t / 8.5);
        this.runPhase += e * (4 + t * 1.35);
        let i = Math.sin(this.runPhase),
          a = Math.cos(this.runPhase);
        u = i * 1 * r;
        d = -i * 1 * r;
        f = Math.max(0, -a) * 1.3 * r + 0.1;
        p = Math.max(0, a) * 1.3 * r + 0.1;
        m = i * 0.9 * r;
        h = -i * 0.9 * r;
        g = -0.9 * r - 0.2;
        _ = -0.9 * r - 0.2;
        o = HIP_Y + Math.abs(a) * 0.07 * r - 0.03;
        c = 0.12 + 0.18 * r + (n ? 0.12 : 0);
        t < 0.4 && ((u = d = f = p = m = h = 0), (c = 0.03));
        break;
      }
      case `idle`:
        o = HIP_Y + Math.sin(r * 2.2) * 0.012;
        m = 0.08;
        h = 0.08;
        break;
      case `stance3`:
        o = 0.62;
        s = 0.1;
        c = 1.05;
        u = 1;
        d = 0.6;
        f = 1.9;
        p = 1.3;
        h = -1.5;
        _ = -0.2;
        m = -0.5;
        g = -0.9;
        b = -0.8;
        break;
      case `stance2`:
        o = 0.78;
        c = 0.45;
        u = 0.5;
        d = 0.2;
        f = 1;
        p = 0.5;
        m = -0.3;
        h = -0.3;
        g = -0.8;
        _ = -0.8;
        b = -0.3;
        break;
      case `qbset`:
      case `hold`:
        o = 0.92;
        c = 0.1;
        u = 0.25;
        d = -0.15;
        f = 0.4;
        p = 0.3;
        h = -1.1;
        _ = -1.2;
        m = -0.9;
        g = -1.3;
        y = 0.2;
        v = -0.3;
        break;
      case `throw`: {
        let e = Math.min(1, r / 0.28);
        h = e < 0.45 ? -2.6 : -2.6 + (e - 0.45) * 5;
        _ = e < 0.45 ? -1.4 : -0.2;
        m = -1;
        g = -0.6;
        c = e < 0.45 ? -0.15 : 0.35;
        u = 0.4;
        d = -0.3;
        p = 0.3;
        break;
      }
      case `spike`:
        h = -2.8 + Math.min(1, r / 0.2) * 2.4;
        c = 0.3;
        break;
      case `catch`:
      case `jump`:
        m = -2.9;
        h = -2.9;
        g = -0.2;
        _ = -0.2;
        v = 0.15;
        y = -0.15;
        u = -0.3;
        f = 0.8;
        d = 0.2;
        p = 0.4;
        break;
      case `dive`:
        s = Math.min(1.35, r * 6);
        o = Math.max(0.35, HIP_Y - r * 2.2);
        m = -3;
        h = -3;
        g = 0;
        _ = 0;
        u = 0.5;
        d = 0.3;
        b = -0.6;
        break;
      case `down`:
        s = 1.5;
        o = 0.26;
        m = -2.4;
        h = -1.2;
        u = 0.2;
        d = -0.1;
        b = -0.3;
        break;
      case `getup`:
        s = Math.max(0, 1.5 - r * 3);
        o = 0.26 + Math.min(1, r * 1.8) * 0.72;
        break;
      case `kneel`:
        o = 0.62;
        u = 1.4;
        f = 1.45;
        d = 0.1;
        p = 1.55;
        c = 0.2;
        h = -1;
        _ = -1.2;
        m = -0.4;
        break;
      case `kick`: {
        let e = Math.min(1, r / 0.35);
        d = e < 0.4 ? -0.9 : -0.9 + (e - 0.4) * 4;
        p = e < 0.4 ? 1.4 : 0.1;
        u = -0.1;
        m = -1.2;
        v = 0.8;
        h = 0.8;
        c = -0.25;
        break;
      }
      case `spin`:
        l = Math.min(1, r / 0.38) * Math.PI * 2;
        m = -1.2;
        v = 1.1;
        h = -0.4;
        c = 0.3;
        u = Math.sin(r * 30) * 0.5;
        d = -Math.sin(r * 30) * 0.5;
        break;
      case `stiffarm`:
        m = -1.55;
        g = 0;
        v = 0.1;
        h = -0.8;
        _ = -1.3;
        c = 0.3;
        this.runPhase += e * (4 + t * 1.35);
        u = Math.sin(this.runPhase) * 0.9;
        d = -u;
        f = 0.6;
        p = 0.6;
        break;
      case `hurdle`:
        u = 1.6;
        f = 0.3;
        d = -0.9;
        p = 1.8;
        m = -2.2;
        h = -0.4;
        c = 0.3;
        break;
      case `block`:
        o = 0.88;
        c = 0.45;
        m = -1.4;
        h = -1.4;
        g = -0.3;
        _ = -0.3;
        v = -0.2;
        y = 0.2;
        this.runPhase += e * (3 + t * 1.5);
        u = -0.4 + Math.sin(this.runPhase) * 0.4 * Math.min(1, t / 3);
        d = -0.4 - Math.sin(this.runPhase) * 0.4 * Math.min(1, t / 3);
        f = 0.7;
        p = 0.7;
        break;
      case `handoff`:
        m = -1.2;
        h = -1.2;
        g = -0.9;
        _ = -0.9;
        c = 0.3;
        break;
      case `wave`:
        m = -2.9 + Math.sin(r * 12) * 0.3;
        v = 0.3;
        h = -2.9 - Math.sin(r * 12) * 0.3;
        y = -0.3;
        break;
      case `celebrate`: {
        let e = this.celebrateStyle;
        if (e === 0) {
          o = HIP_Y + Math.abs(Math.sin(r * 7)) * 0.55;
          m = -2.9;
          h = -2.9;
          v = 0.35 + Math.sin(r * 14) * 0.2;
          y = -0.35 - Math.sin(r * 14) * 0.2;
          u = -0.4;
          f = 0.9;
        } else if (e === 1) {
          let e = Math.floor(r * 4) % 4;
          m = e % 2 ? -1.57 : 0;
          h = e % 2 ? 0 : -1.57;
          g = e < 2 ? -1.57 : 0;
          _ = e < 2 ? 0 : -1.57;
          l = Math.floor(r * 2) % 2 ? 0.5 : -0.5;
          o = HIP_Y - (e % 2) * 0.08;
        } else
          e === 2
            ? ((m = -1.57),
              (h = -1.57),
              (v = 1.4),
              (y = -1.4),
              (g = -2.2),
              (_ = -2.2),
              (o = 0.86 + Math.sin(r * 5) * 0.05),
              (u = -0.4),
              (d = 0.4),
              (c = -0.1 + Math.sin(r * 5) * 0.05))
            : ((l = r * 7),
              (m = -1.57),
              (h = -1.57),
              (v = 1.2 + Math.sin(r * 16) * 0.3),
              (y = -1.2 - Math.sin(r * 16) * 0.3),
              (u = Math.sin(r * 16) * 0.5),
              (d = -Math.sin(r * 16) * 0.5));
        break;
      }
      case `ragdoll`:
        m = -2.5;
        h = -2.2;
        v = 0.8;
        y = -0.8;
        u = 0.6;
        d = -0.4;
        f = 0.8;
    }
    let ee = this.mode === `run` || this.mode === `stiffarm` || this.mode === `block`,
      x = (e, t, n = 0, r = 0) => {
        ee ? e.rotation.set(t, n, r) : a(e, t, n, r);
      };
    x(this.legL, -u);
    x(this.legR, -d);
    x(this.shinL, f);
    x(this.shinR, p);
    a(this.armL, m, 0, v);
    a(this.armR, h, 0, y);
    a(this.foreL, g);
    a(this.foreR, _);
    a(this.spine, c);
    a(this.head, b * 0.5);
    this.hips.position.y += (o - this.hips.position.y) * (ee ? 0.6 : i);
    this.hips.rotation.x += (s - this.hips.rotation.x) * i;
    this.hips.rotation.z += (0 - this.hips.rotation.z) * i;
    this.hips.rotation.y = l;
    this.widthScale;
  }
};
