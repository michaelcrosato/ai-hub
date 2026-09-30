/* Bark & Brush — the painted vale as real geometry.

   The original painted a sky gradient, a mountain strip, a mist band and ink
   clouds in screen space, then the ground as flat polygons in painter order.
   Here the ground is one terrain mesh (the river and its banks are painted
   into it, so nothing can z-fight), the patches and the path are flat layers
   drawn over it in a fixed order, and the sky, sun, mountains and clouds sit
   on camera-centred bands at the horizon. Every colour is the original's. */

import * as THREE from 'three/webgpu';
import { vec2, vec3, vec4, color, mix, smoothstep, texture, uv, positionLocal, normalize, attribute, uniform, float, sin, time } from 'three/tsl';
import { terrainH, riverW, GATE } from './data.js';
import { canvasTexture } from './scene.js';

export const COLORS = {
  ground: '#b1b78a',
  groundWon: '#96b073',
  path: '#c8b78b',
  pathWon: '#d4c391',
  water: '#779f94',
  waterWon: '#68a59a',
  bank: '#667a52',
  skyTop: '#d1dbc0',
  skyTopWon: '#bbd5bd',
  horizon: '#e4e0bd',
  mist: '#d6d6b8',
};

/** Uniforms the game tweens when spring comes home. */
export function makeTints() {
  return {
    ground: uniform(new THREE.Color(COLORS.ground)),
    path: uniform(new THREE.Color(COLORS.path)),
    water: uniform(new THREE.Color(COLORS.water)),
    skyTop: uniform(new THREE.Color(COLORS.skyTop)),
  };
}

/** '#rrggbb' → 0xrrggbb for TSL color(). */
export const hex = (s) => parseInt(s.slice(1, 7), 16);

const layer = (params) =>
  new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, ...params });

/* ------------------------------------------------------------------ ground */

function groundAxes() {
  const xs = [];
  for (let x = -150; x < -40; x += 5) xs.push(x);
  for (let x = -40; x <= 40; x += 1) xs.push(x);
  for (let x = 45; x <= 150; x += 5) xs.push(x);
  const zs = [];
  for (let z = 150; z > 40; z -= 5) zs.push(z);
  for (let z = 40; z > -2.45; z -= 1) zs.push(z);
  for (let k = 0; k <= 72; k++) zs.push(+(-2.4 - k * 0.1).toFixed(2));
  for (let z = -10.6; z > -80; z -= 1) zs.push(+z.toFixed(2));
  for (let z = -85; z >= -200; z -= 5) zs.push(z);
  return { xs, zs };
}

/** Weight 0..1 for the river and for its dark banks at (x, z). */
function riverMix(x, z) {
  const w = riverW(x);
  const dS = z - (-3 + w); // > 0 south of the water
  const dN = -9 + w - z; // > 0 north of the water
  const inside = Math.min(-dS, -dN);
  const river = Math.min(1, Math.max(0, (inside + 0.03) / 0.06));
  const strip = (d, width) => (d > -0.03 && d < width + 0.03 ? Math.min(1, Math.min(d + 0.03, width + 0.03 - d) / 0.05) : 0);
  const bank = Math.max(strip(dS, 0.16), strip(dN, 0.17));
  return [river, bank, inside];
}

export function buildGround(tints) {
  const { xs, zs } = groundAxes();
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const mixA = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i];
      const z = zs[j];
      const k = j * nx + i;
      const [river, bank, inside] = riverMix(x, z);
      // A shallow bed under the painted water gives the river a little depth.
      const carve = inside > 0 ? Math.min(1, inside / 0.35) * 0.08 : 0;
      pos[k * 3] = x;
      pos[k * 3 + 1] = terrainH(x, z) - carve;
      pos[k * 3 + 2] = z;
      mixA[k * 2] = river;
      mixA[k * 2 + 1] = bank;
    }
  }
  const index = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aMix', new THREE.BufferAttribute(mixA, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  const m = attribute('aMix', 'vec2');
  mat.colorNode = mix(mix(tints.ground, tints.water, m.x), color(hex(COLORS.bank)), m.y);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  return mesh;
}

/** Soft painted patches on the grass (the original's translucent heptagons), one draw. */
export function buildPatches(patches) {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (const p of patches) {
    c.set(p.color.slice(0, 7));
    const a = parseInt(p.color.slice(7, 9), 16) / 255;
    const cy = terrainH(p.x, p.z) + 0.012;
    const n = p.pts.length;
    for (let k = 0; k < n; k++) {
      const [x0, z0] = p.pts[k];
      const [x1, z1] = p.pts[(k + 1) % n];
      pos.push(p.x, cy, p.z, x0, terrainH(x0, z0) + 0.012, z0, x1, terrainH(x1, z1) + 0.012, z1);
      for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.computeBoundingSphere();
  const mat = layer({});
  mat.colorNode = attribute('color', 'vec4');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

/** The sandy path, one draw, tinted by a uniform (it brightens when spring comes). */
export function buildPath(pieces, tints) {
  const pos = [];
  for (const q of pieces) {
    const P = q.map(([x, z]) => [x, terrainH(x, z) + 0.016, z]);
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(P[i][0], P[i][1], P[i][2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeBoundingSphere();
  const mat = layer({ polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  mat.colorNode = tints.path;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

/** The drifting light and dark streaks on the river (1px strokes in the original). */
export function buildStreaks() {
  const make = (col, opacity, count) => {
    const pos = new Float32Array(count * 7 * 2 * 3);
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr);
    const mat = new THREE.LineBasicNodeMaterial({ color: col, transparent: true, opacity, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    return { lines, pos, attr, n: 0 };
  };
  const light = make('#e8dfaf', 0.56, 11);
  const dark = make('#446f65', 0.25, 22);
  const group = new THREE.Group();
  group.add(light.lines, dark.lines);
  return {
    group,
    update(worldT) {
      light.n = 0;
      dark.n = 0;
      for (let i = 0; i < 33; i++) {
        const x = -27 + ((i * 2.39 + worldT * 0.28) % 54);
        const z = -3.7 + (i % 5) * -1.03;
        const t = i % 3 === 0 ? light : dark;
        const y = terrainH(x, z) - 0.03;
        for (let j = 0; j < 7; j++) {
          const o = t.n * 6;
          t.pos[o] = x + j * 0.2;
          t.pos[o + 1] = y;
          t.pos[o + 2] = z + Math.sin(j * 0.7 + i) * 0.055;
          t.pos[o + 3] = x + (j + 1) * 0.2;
          t.pos[o + 4] = y;
          t.pos[o + 5] = z + Math.sin((j + 1) * 0.7 + i) * 0.055;
          t.n++;
        }
      }
      light.attr.needsUpdate = true;
      dark.attr.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------------ sky, sun, mountains, clouds */

function band(radius, y0, y1, segs = 96) {
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.sin(a) * radius;
    const z = -Math.cos(a) * radius;
    pos.push(x, y0, z, x, y1, z);
    uvs.push(i / segs, 0, i / segs, 1);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

function discCanvas(soft) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (soft) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  } else {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/**
 * Camera-centred backdrop: sky dome, a low sun, the mountain strip with the mist
 * band baked into its foot, and the ink clouds. Call follow(camera, worldT) each frame.
 */
export function buildBackdrop(mountainCanvas, cloudCanvas, tints) {
  const group = new THREE.Group();

  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false });
  const e = normalize(positionLocal).y;
  const sky = mix(color(hex(COLORS.horizon)), tints.skyTop, smoothstep(0.0, 0.2, e));
  skyMat.colorNode = mix(sky, color(hex(COLORS.mist)), float(1).sub(smoothstep(-0.05, 0.015, e)));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // The sun: 27° right of north, a few degrees over the hills (where the original painted it).
  const sunDir = new THREE.Vector3(Math.sin(0.47), 0.1, -Math.cos(0.47)).normalize();
  const glow = new THREE.Sprite(new THREE.SpriteNodeMaterial({ map: canvasTexture(discCanvas(true)), color: '#f4d789', opacity: 0.53, transparent: true, depthWrite: false, fog: false }));
  glow.scale.setScalar(140);
  glow.renderOrder = -9;
  const disc = new THREE.Sprite(new THREE.SpriteNodeMaterial({ map: canvasTexture(discCanvas(false)), color: '#d8a65b', opacity: 0.33, transparent: true, depthWrite: false, fog: false }));
  disc.scale.setScalar(47);
  disc.renderOrder = -9;
  group.add(glow, disc);

  // Mountains: -8.8° to +28° elevation, two repeats round the horizon, drawn at 52% like the original.
  const R = 420;
  const y0 = R * Math.tan((-8.8 * Math.PI) / 180);
  const y1 = R * Math.tan((28 * Math.PI) / 180);
  const mtnTex = canvasTexture(mountainCanvas, { repeat: true });
  const mtnMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const t = texture(mtnTex, vec2(uv().x.mul(2), uv().y));
  const mist = float(1).sub(smoothstep(0.08, 0.3, uv().y));
  mtnMat.colorNode = vec4(mix(t.rgb, color(hex(COLORS.mist)), mist), mix(t.a.mul(0.52), float(1), mist));
  const mountains = new THREE.Mesh(band(R, y0, y1), mtnMat);
  mountains.renderOrder = -8;
  mountains.frustumCulled = false;
  group.add(mountains);

  // Clouds drift slowly along a band just over the horizon.
  const cloudTex = canvasTexture(cloudCanvas, { repeat: true });
  const drift = uniform(0);
  const cloudMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  cloudMat.colorNode = texture(cloudTex, vec2(uv().x.mul(3).add(drift), uv().y));
  const cR = 400;
  const clouds = new THREE.Mesh(band(cR, cR * Math.tan((-2 * Math.PI) / 180), cR * Math.tan((11 * Math.PI) / 180)), cloudMat);
  clouds.renderOrder = -7;
  clouds.frustumCulled = false;
  group.add(clouds);

  return {
    group,
    follow(camera, worldT) {
      group.position.copy(camera.position);
      glow.position.copy(sunDir).multiplyScalar(450);
      disc.position.copy(glow.position);
      drift.value = (worldT * 0.0015) % 1;
    },
  };
}

/* ------------------------------------------------------------------ the old gate and its ink veil */

export function buildGate(gateCanvas, veilCanvas) {
  const group = new THREE.Group();
  const gy = terrainH(GATE.x, GATE.z);
  const gateMat = new THREE.MeshBasicNodeMaterial({ map: canvasTexture(gateCanvas), alphaTest: 0.5, side: THREE.DoubleSide });
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(GATE.w, GATE.h), gateMat);
  gate.position.set(GATE.x, gy + GATE.h / 2 - 0.3, GATE.z);
  group.add(gate);

  const veilH = 6.5;
  const veilMat = new THREE.MeshBasicNodeMaterial({ map: canvasTexture(veilCanvas), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // A slow flutter, strongest at the hem.
  veilMat.positionNode = positionLocal.add(vec3(0, 0, sin(time.mul(1.7).add(positionLocal.x.mul(0.9))).mul(uv().y.oneMinus()).mul(0.12)));
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(GATE.veilW, veilH, 6, 6), veilMat);
  const top = gy + veilH - 0.05;
  veil.position.set(GATE.veilX, top - veilH / 2, GATE.z + 0.03);
  veil.renderOrder = 11;
  group.add(veil);

  return {
    group,
    /** open: 0 closed … 1 gone. The veil rolls up and fades. */
    setOpen(open) {
      const o = Math.max(0, Math.min(1, open));
      veil.visible = o < 0.999;
      veilMat.opacity = 1 - o;
      const s = 1 - o * 0.85;
      veil.scale.y = s;
      veil.position.y = top - (veilH * s) / 2;
    },
  };
}
