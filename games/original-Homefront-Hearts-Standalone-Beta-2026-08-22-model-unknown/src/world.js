/**
 * world.js — the isometric household in three.js r186 on the kit.
 *
 * A port of the original React Three Fiber scene: the same lawn, fence,
 * trees, rooms, furniture, appliances, people, clouds and sun, at the same
 * positions and colours, seen through the same orthographic camera. The
 * static house is merged into one vertex-coloured mesh; every clickable
 * object (a "hotspot") and every person is one small mesh of its own, so the
 * whole scene draws in a few dozen calls instead of several hundred.
 *
 * The original rendered with WebGLRenderer, ACES Filmic tone mapping, sRGB
 * output and three.js fog, which WebGL mixes in *after* tone mapping. The
 * materials here do the same in TSL (tone map, encode, then fog toward the
 * exact sky colour), so both backends show the original picture.
 *
 * New: household project sites that grow step by step, a broom for "Reset
 * the rooms" (the one priority with no object in the house), hover and
 * card-preview highlights, a little bounce when the week is lived, and a
 * camera the player can turn and zoom (smoothed, clamped, resettable).
 */

import * as THREE from 'three/webgpu';
import { Fn, output, vec4, mix, smoothstep, positionView, float, uniform, acesFilmicToneMapping, sRGBTransferOETF } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { chapterOf, yearOf, childrenAtHome, currentProject, projectProgress, projectDone, isAvailableId } from './sim.js';

const FOG_NEAR = 18;
const FOG_FAR = 34;
const TARGET = new THREE.Vector3(0.25, 0.35, 0.9);
const YAW_LIMIT = 0.62;
const ZOOM_MIN = 0.72;
const ZOOM_MAX = 1.9;
const HOVER_SCALE = 1.045;
const PREVIEW_SCALE = 1.07;

// ------------------------------------------------------------------ geometry

const stripUv = (g) => {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  return g;
};
const BOX = stripUv(new THREE.BoxGeometry(1, 1, 1));
const geoCache = new Map();
function cylGeo(args) {
  const key = `c${args.join(',')}`;
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = stripUv(new THREE.CylinderGeometry(args[0], args[1], args[2], args[3] ?? 8))));
  return g;
}
function icoGeo(radius, detail) {
  const key = `i${radius},${detail}`;
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = stripUv(new THREE.IcosahedronGeometry(radius, detail))));
  return g;
}

const colorCache = new Map();
function col(hex) {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new THREE.Color(hex)));
  return c;
}

const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _nm = new THREE.Matrix3();
const ZERO3 = [0, 0, 0];
const ONE3 = [1, 1, 1];

/** A transform from [x,y,z] position, Euler rotation and scale; null or undefined means none. */
function compose(pos, rot, scale) {
  pos = pos || ZERO3;
  rot = rot || ZERO3;
  scale = scale || ONE3;
  return new THREE.Matrix4().compose(
    _v.set(pos[0], pos[1], pos[2]),
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])),
    _s.set(scale[0], scale[1], scale[2])
  );
}

/** Collects primitives (geometry + matrix + colour) and merges them into one mesh geometry. */
class Sink {
  constructor() {
    this.parts = [];
    this.count = 0;
  }
  add(geo, matrix, color) {
    this.parts.push({ geo, matrix, color });
    this.count += geo.attributes.position.count;
  }
  build() {
    const n = this.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const clr = new Float32Array(n * 3);
    let o = 0;
    for (const { geo, matrix, color } of this.parts) {
      const p = geo.attributes.position.array;
      const q = geo.attributes.normal.array;
      const e = matrix.elements;
      const m = _nm.getNormalMatrix(matrix).elements;
      for (let i = 0; i < p.length; i += 3, o += 3) {
        const x = p[i];
        const y = p[i + 1];
        const z = p[i + 2];
        pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const a = q[i];
        const b = q[i + 1];
        const c = q[i + 2];
        const nx = m[0] * a + m[3] * b + m[6] * c;
        const ny = m[1] * a + m[4] * b + m[7] * c;
        const nz = m[2] * a + m[5] * b + m[8] * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        nor[o] = nx / l;
        nor[o + 1] = ny / l;
        nor[o + 2] = nz / l;
        clr[o] = color.r;
        clr[o + 1] = color.g;
        clr[o + 2] = color.b;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(clr, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** The original's primitives (Ce box, fa cylinder, Vn icosahedron) with a transform stack for groups. */
class Builder {
  constructor(sink) {
    this.sink = sink;
    this.stack = [new THREE.Matrix4()];
  }
  get top() {
    return this.stack[this.stack.length - 1];
  }
  group(pos, rot, scale, fn) {
    this.stack.push(this.top.clone().multiply(compose(pos, rot || ZERO3, scale || ONE3)));
    try {
      fn();
    } finally {
      this.stack.pop();
    }
  }
  box(pos, size, color, rot) {
    this.sink.add(BOX, this.top.clone().multiply(compose(pos, rot || ZERO3, size)), col(color));
  }
  cyl(pos, args, color, rot) {
    this.sink.add(cylGeo(args), this.top.clone().multiply(compose(pos, rot || ZERO3)), col(color));
  }
  ico(pos, radius, color, scale, detail = 1) {
    this.sink.add(icoGeo(radius, detail), this.top.clone().multiply(compose(pos, ZERO3, scale || ONE3)), col(color));
  }
}

// ------------------------------------------------------------------ colour pipeline

/** The sky in display (sRGB) values, for fog and the background. */
const skyDisplay = uniform(new THREE.Vector3(0.682, 0.91, 1));

/**
 * The original WebGL output: ACES Filmic, sRGB encoding, then linear-distance
 * fog (smoothstep, as three.js WebGL fog) mixed toward the sky in display space.
 */
const displayOutput = Fn(() => {
  const mapped = sRGBTransferOETF(acesFilmicToneMapping(output.rgb, float(1)));
  const fog = smoothstep(float(FOG_NEAR), float(FOG_FAR), positionView.z.negate());
  return vec4(mix(mapped, skyDisplay, fog), output.a);
});

function hexToDisplay(hex, target) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return target.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ------------------------------------------------------------------ project sites

const QUILT_COLORS = ['#f47c7c', '#ffd166', '#2bb9ad', '#7cc8ff', '#9b79d0', '#fff4dc', '#ef9f76'];

/** A stake-and-string marker with a crate of materials: where a project will be built. */
function siteMarker(b, [x, z], w = 1.2, d = 0.9) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box([x + (sx * w) / 2, 0.22, z + (sz * d) / 2], [0.06, 0.44, 0.06], '#c8895f');
  b.box([x, 0.4, z - d / 2], [w, 0.015, 0.015], '#f47c7c');
  b.box([x, 0.4, z + d / 2], [w, 0.015, 0.015], '#f47c7c');
  b.box([x - w / 2, 0.4, z], [0.015, 0.015, d], '#f47c7c');
  b.box([x + w / 2, 0.4, z], [0.015, 0.015, d], '#f47c7c');
  b.box([x + 0.18, 0.15, z + 0.05], [0.42, 0.3, 0.32], '#b9824e');
  b.box([x + 0.18, 0.31, z + 0.05], [0.44, 0.03, 0.34], '#d8a96f');
}

const PROJECT_MODELS = {
  picnicTable: {
    position: [-6.1, 0, 3.9],
    beacon: 1.35,
    build(b, p) {
      if (p === 0) return siteMarker(b, [0, 0], 1.7, 1.2);
      for (const x of [-0.7, 0.7]) for (const z of [-0.28, 0.28]) b.box([x, 0.36, z], [0.1, 0.72, 0.1], '#9f6748');
      b.box([0, 0.62, 0], [1.6, 0.08, 0.1], '#9f6748');
      if (p >= 2) {
        for (const z of [-0.26, 0, 0.26]) b.box([0, 0.72, z], [1.7, 0.07, 0.24], '#c78358');
        b.box([0, 0.42, 0.62], [1.7, 0.07, 0.28], '#c78358');
        for (const x of [-0.7, 0.7]) b.box([x, 0.21, 0.62], [0.08, 0.42, 0.08], '#9f6748');
      } else {
        for (const z of [-0.2, 0.05]) b.box([0.1, 0.06 + (z + 0.2) * 0.4, 0.95 + z], [1.5, 0.06, 0.22], '#d8a96f', [0, 0.1, 0]);
      }
      if (p >= 3) {
        b.box([0, 0.42, -0.62], [1.7, 0.07, 0.28], '#c78358');
        for (const x of [-0.7, 0.7]) b.box([x, 0.21, -0.62], [0.08, 0.42, 0.08], '#9f6748');
        for (let i = 0; i < 6; i++) b.box([-0.62 + i * 0.25, 0.763, 0], [0.24, 0.012, 0.34], i % 2 ? '#fff4dc' : '#f47c7c');
        b.cyl([0.2, 0.8, 0.02], [0.16, 0.13, 0.06, 12], '#e8b86b');
        b.cyl([-0.45, 0.79, 0.15], [0.05, 0.05, 0.1, 8], '#7cc8ff');
      }
    },
  },
  swingSet: {
    position: [2.3, 0, -5.05],
    beacon: 2.05,
    build(b, p) {
      if (p === 0) return siteMarker(b, [0, 0], 2.3, 0.9);
      for (const x of [-1.1, 1.1]) {
        // A-frame legs: splayed at the ground, meeting under the top beam.
        b.box([x, 0.8, 0.26], [0.1, 1.7, 0.1], '#2bb9ad', [-0.31, 0, 0]);
        b.box([x, 0.8, -0.26], [0.1, 1.7, 0.1], '#2bb9ad', [0.31, 0, 0]);
        b.box([x, 0.45, 0], [0.08, 0.06, 0.52], '#147f79');
      }
      if (p === 1) b.box([0, 0.06, 0.55], [2.3, 0.1, 0.12], '#2bb9ad', [0, 0.05, 0]);
      if (p >= 2) {
        b.box([0, 1.62, 0], [2.45, 0.12, 0.12], '#2bb9ad');
        for (const x of [-0.72, -0.36]) b.box([x, 1.07, 0], [0.025, 1.08, 0.025], '#6d5b8c');
        b.box([-0.54, 0.52, 0], [0.44, 0.05, 0.2], '#f47c7c');
      }
      if (p >= 3) {
        for (const x of [0.36, 0.72]) b.box([x, 1.07, 0], [0.025, 1.08, 0.025], '#6d5b8c');
        b.box([0.54, 0.52, 0], [0.44, 0.05, 0.2], '#ffd166');
        b.box([0, 0.08, 0.95], [1.2, 0.16, 0.08], '#c8895f');
        b.box([0, 0.08, 1.55], [1.2, 0.16, 0.08], '#c8895f');
        b.box([-0.56, 0.08, 1.25], [0.08, 0.16, 0.6], '#c8895f');
        b.box([0.56, 0.08, 1.25], [0.08, 0.16, 0.6], '#c8895f');
        b.box([0, 0.07, 1.25], [1.04, 0.1, 0.52], '#f4d19d');
        b.cyl([0.25, 0.19, 1.2], [0.07, 0.05, 0.12, 8], '#f47c7c');
      }
    },
  },
  treehouse: {
    position: [-7.2, 0, -4.7],
    beacon: 2.75,
    build(b, p) {
      if (p === 0) {
        for (let i = 0; i < 3; i++) b.box([0.9, 0.05 + i * 0.07, 0.7], [1.1, 0.06, 0.2], '#d8a96f', [0, 0.25 + i * 0.12, 0]);
        b.cyl([0.35, 0.08, 1.05], [0.17, 0.17, 0.12, 12], '#c9b27c');
        return;
      }
      b.box([0.55, 1.12, 0.55], [1.5, 0.1, 1.3], '#b9824e');
      b.box([1.15, 0.56, 1.05], [0.1, 1.12, 0.1], '#8c5d3b');
      b.box([1.15, 0.56, 0.05], [0.1, 1.12, 0.1], '#8c5d3b');
      if (p >= 2) {
        b.group([1.55, 0, 1.0], [0, 0, 0.18], null, () => {
          b.box([0, 0.6, -0.17], [0.06, 1.2, 0.06], '#9f6748');
          b.box([0, 0.6, 0.17], [0.06, 1.2, 0.06], '#9f6748');
          for (const y of [0.22, 0.48, 0.74, 1.0]) b.box([0, y, 0], [0.05, 0.05, 0.36], '#c78358');
        });
        b.box([0.55, 1.42, 1.18], [1.5, 0.06, 0.06], '#f7efd8');
        for (const x of [-0.15, 0.55, 1.25]) b.box([x, 1.29, 1.18], [0.06, 0.3, 0.06], '#f7efd8');
      }
      if (p >= 3) {
        b.box([0.62, 1.47, 0.42], [0.8, 0.6, 0.7], '#c8895f');
        b.box([0.62, 1.52, 0.78], [0.3, 0.26, 0.03], '#7fb3c8');
        b.cyl([0.62, 1.98, 0.42], [0, 0.66, 0.45, 4], '#f47c7c', [0, Math.PI / 4, 0]);
        b.box([1.02, 2.1, 0.42], [0.03, 0.5, 0.03], '#f7efd8');
        b.box([1.13, 2.26, 0.42], [0.2, 0.13, 0.02], '#ffd166');
      }
    },
  },
  cookbook: {
    position: [-4.28, 0, -1.4],
    rotation: [0, Math.PI / 2, 0],
    beacon: 1.65,
    build(b, p) {
      if (p === 0) {
        b.box([0, 0.14, 0.05], [0.42, 0.28, 0.3], '#c7945e');
        for (let i = 0; i < 3; i++) b.box([0, 0.3 + i * 0.02, 0.05], [0.3, 0.015, 0.2], i % 2 ? '#fff4dc' : '#f2dfbb', [0, i * 0.25, 0]);
        return;
      }
      b.box([0, 0.25, 0], [0.85, 0.5, 0.4], '#a66d4d');
      b.box([0, 0.52, 0.02], [0.9, 0.05, 0.44], '#fff2d9');
      b.box([-0.2, 0.25, 0.205], [0.34, 0.36, 0.02], '#c78358');
      b.box([0.2, 0.25, 0.205], [0.34, 0.36, 0.02], '#c78358');
      if (p >= 2) {
        b.box([0, 0.95, -0.16], [0.85, 0.85, 0.06], '#a66d4d');
        b.box([-0.4, 0.95, -0.06], [0.05, 0.85, 0.22], '#a66d4d');
        b.box([0.4, 0.95, -0.06], [0.05, 0.85, 0.22], '#a66d4d');
        b.box([0, 1.39, -0.06], [0.88, 0.05, 0.26], '#8c5d3b');
        b.box([0, 0.9, -0.06], [0.78, 0.03, 0.2], '#c78358');
        ['#f47c7c', '#ffd166', '#2bb9ad', '#fff4dc'].forEach((c, i) => b.cyl([-0.27 + i * 0.18, 0.99, -0.05], [0.05, 0.05, 0.14, 8], c));
      }
      if (p >= 3) {
        b.box([0, 1.08, -0.06], [0.78, 0.03, 0.2], '#c78358');
        ['#ef7c73', '#76b6c4', '#f1c45b', '#9b79d0', '#7bb79e', '#e8b86b'].forEach((c, i) => {
          const h = 0.24 - (i % 3) * 0.03;
          b.box([-0.3 + i * 0.1, 1.095 + h / 2, -0.06], [0.07, h, 0.18], c);
        });
        b.box([-0.12, 0.57, 0.08], [0.24, 0.02, 0.3], '#fff4dc', [0, 0, 0.12]);
        b.box([0.12, 0.57, 0.08], [0.24, 0.02, 0.3], '#fff4dc', [0, 0, -0.12]);
        b.box([0, 0.585, 0.2], [0.02, 0.01, 0.1], '#f47c7c');
      }
    },
  },
  messageBoard: {
    position: [0.25, 0, -3.05],
    beacon: 1.6,
    build(b, p) {
      if (p === 0) {
        b.box([0, 0.15, 0.2], [0.44, 0.3, 0.3], '#c7945e');
        b.box([0.05, 0.36, 0.2], [0.34, 0.14, 0.05], '#d9a86c', [0.2, 0, 0]);
        return;
      }
      b.box([0, 0.55, 0.12], [0.6, 0.05, 0.38], '#b97c54');
      for (const x of [-0.25, 0.25]) for (const z of [-0.03, 0.27]) b.box([x, 0.27, z], [0.05, 0.54, 0.05], '#87583e');
      b.box([-0.1, 0.62, 0.12], [0.22, 0.1, 0.16], '#e05252');
      b.box([-0.1, 0.69, 0.12], [0.24, 0.05, 0.06], '#c9535d');
      if (p >= 2) {
        b.box([0, 1.0, -0.25], [0.76, 0.56, 0.04], '#a66d4d');
        b.box([0, 1.0, -0.23], [0.68, 0.48, 0.02], '#d9a86c');
      }
      if (p >= 3) {
        const notes = [
          [-0.22, 1.12, '#ffd166'],
          [-0.02, 1.1, '#7cc8ff'],
          [0.18, 1.14, '#f47c7c'],
          [-0.18, 0.9, '#fff4dc'],
          [0.05, 0.88, '#7bb79e'],
          [0.22, 0.92, '#ffd166'],
        ];
        notes.forEach(([x, y, c], i) => b.box([x, y, -0.215], [0.13, 0.12, 0.012], c, [0, 0, (i % 3) * 0.08 - 0.08]));
        b.box([0.52, 1.02, -0.25], [0.24, 0.3, 0.02], '#fff4dc');
        b.box([0.52, 1.15, -0.24], [0.24, 0.05, 0.02], '#f47c7c');
      }
    },
  },
  orchard: {
    position: [8.25, 0, 0.1],
    beacon: 1.75,
    build(b, p) {
      const zs = [-2.7, -0.9, 0.9, 2.7];
      if (p === 0) {
        for (const z of zs) b.box([0, 0.2, z], [0.05, 0.4, 0.05], '#c8895f');
        b.cyl([0.25, 0.12, -0.9], [0.14, 0.11, 0.24, 8], '#c77b55');
        b.cyl([0.25, 0.12, 0.9], [0.14, 0.11, 0.24, 8], '#c77b55');
        return;
      }
      const grown = p === 1 ? [0.9, -0.9] : zs;
      const size = p === 1 ? 0.55 : p === 2 ? 0.8 : 1;
      for (const z of grown) {
        b.group([0, 0, z], null, [size, size, size], () => {
          b.cyl([0, 0.45, 0], [0.07, 0.1, 0.9, 6], '#9b6b49');
          b.ico([0, 1.18, 0], 0.46, '#6cae5f', [1, 0.9, 1]);
          b.ico([0.2, 1.05, 0.18], 0.28, '#79b968', null, 0);
          if (p >= 3) {
            b.ico([0.3, 1.1, 0.28], 0.07, '#f47c7c', null, 0);
            b.ico([-0.28, 1.2, 0.3], 0.07, '#ffd166', null, 0);
            b.ico([0.05, 0.95, 0.42], 0.07, '#f47c7c', null, 0);
          }
        });
      }
      if (p >= 3) {
        b.cyl([-0.55, 0.14, 1.8], [0.22, 0.17, 0.28, 10], '#c8895f');
        b.ico([-0.55, 0.3, 1.8], 0.12, '#f47c7c', [1.4, 0.6, 1.4], 0);
      }
    },
  },
};

// ------------------------------------------------------------------ the world

export class HouseWorld {
  constructor(kit) {
    this.kit = kit;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.width = 1;
    this.height = 1;
    this.view = { yaw: 0, yawTarget: 0, zoom: 1, zoomTarget: 1 };
    this.cameraKey = '';
    this.key = '';
    this.state = null;
    this.hotspots = [];
    this.pickList = [];
    this.bobs = [];
    this.clouds = [];
    this.hovered = null;
    this.preview = null;
    this.pickDirty = true;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();

    const renderer = kit.renderer;
    // Materials tone map, encode and fog themselves (see displayOutput), so the renderer writes as-is.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, flatShading: true });
    this.material.outputNode = displayOutput();
    this.ringMaterial = new THREE.MeshBasicNodeMaterial({ color: '#fff4a8' });
    this.ringMaterial.outputNode = displayOutput();
    this.gemMaterial = new THREE.MeshBasicNodeMaterial({ color: '#f47c7c' });
    this.gemMaterial.outputNode = displayOutput();
    this.ringGeo = new THREE.TorusGeometry(0.22, 0.05, 6, 12);
    this.gemGeo = new THREE.OctahedronGeometry(0.11, 0);

    this.background = new THREE.Color();
    this.scene.background = this.background;
    this.hemi = new THREE.HemisphereLight('#aee8ff', '#60754d', 1.65);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.58));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(8, 13, 8);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    sun.shadow.bias = -4e-4;
    sun.shadow.normalBias = 0.015;
    sun.shadow.radius = 3;
    kit.shadow(sun, 2048);
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.buildSky();

    kit.onResize((w, h) => {
      this.width = w;
      this.height = h;
      Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
      this.cameraKey = '';
      this.pickDirty = true;
    });

    this.post = createPost(kit, this.scene, this.camera);
  }

  /** Clouds drift and the sun hangs in the corner, as in the original sky. */
  buildSky() {
    const cloud = (position, speed, color) => {
      const sink = new Sink();
      const b = new Builder(sink);
      b.ico([-0.65, 0, 0], 0.55, color, [1.3, 0.7, 0.8]);
      b.ico([0, 0.18, 0], 0.72, color, [1.4, 0.75, 0.85]);
      b.ico([0.78, 0, 0], 0.52, color, [1.35, 0.68, 0.8]);
      const mesh = new THREE.Mesh(sink.build(), this.material);
      mesh.position.set(...position);
      this.scene.add(mesh);
      this.clouds.push({ mesh, x: position[0], speed });
    };
    cloud([-7, 7.3, -8], 0.18, '#ffffff');
    cloud([6, 6.3, -10], 0.12, '#f7fbff');
    const sink = new Sink();
    new Builder(sink).ico([8.5, 8.4, -11], 1.05, '#ffd166', null, 1);
    this.scene.add(new THREE.Mesh(sink.build(), this.material));
  }

  makeBeacon() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(this.ringGeo, this.ringMaterial);
    ring.rotation.x = Math.PI / 2;
    g.add(ring, new THREE.Mesh(this.gemGeo, this.gemMaterial));
    g.visible = false;
    return g;
  }

  // ---------------------------------------------------------------- sync with the game

  /** Everything that changes geometry. Anything else (plan beacons, hover) is live state. */
  sceneKey(s) {
    const h = s.household;
    const kids = childrenAtHome(s)
      .map((c) => c.id)
      .join(',');
    const proj = currentProject(s);
    return [
      s.chapterIndex,
      [...h.rooms].sort().join(','),
      [...h.owned].sort().join(','),
      s.flags.bigGarden ? 1 : 0,
      s.flags.studyUnlocked ? 1 : 0,
      s.flags.organizeUnlocked ? 1 : 0,
      kids,
      (h.dependents ?? 0) > 0 ? 1 : 0,
      Math.min(2, h.grandchildren ?? 0),
      s.plan.includes('host') ? 1 : 0,
      s.metrics.meals > 55 ? 1 : 0,
      s.metrics.wear > 60 ? 1 : 0,
      s.metrics.wear > 72 ? 1 : 0,
      Math.min(5, Math.max(2, Math.floor(s.metrics.mentalLoad / 18))),
      this.clutterCount(s),
      JSON.stringify(s.projects ?? {}),
      proj ? proj.id : '',
      s.started ? 1 : 0,
    ].join('|');
  }

  clutterCount(s) {
    return Math.max(0, Math.min(8, Math.floor((58 - s.metrics.order) / 8) + childrenAtHome(s).length));
  }

  sync(state) {
    this.state = state;
    const palette = chapterOf(state).palette;
    hexToDisplay(palette.sky, skyDisplay.value);
    this.background.setRGB(skyDisplay.value.x, skyDisplay.value.y, skyDisplay.value.z, THREE.LinearSRGBColorSpace);
    this.hemi.color.set(palette.sky);
    const key = this.sceneKey(state);
    if (key !== this.key) {
      this.key = key;
      this.rebuild(state);
    }
    // Live state: which objects are planned, which can be used this era.
    for (const h of this.hotspots) {
      h.active = h.activeFor.some((id) => state.plan.includes(id));
      h.disabled = h.fixedDisabled || !isAvailableId(h.actionId, state);
    }
    this.pickList = this.hotspots.filter((h) => !h.disabled).map((h) => h.mesh);
    if (this.hovered && this.hovered.disabled) this.hovered = null;
    this.pickDirty = true;
  }

  clear() {
    for (const child of [...this.root.children]) {
      child.traverse((o) => {
        if (o.isMesh && o.geometry !== this.ringGeo && o.geometry !== this.gemGeo) o.geometry.dispose();
      });
      this.root.remove(child);
    }
    this.hotspots = [];
    this.bobs = [];
    this.hovered = null;
  }

  rebuild(state) {
    this.clear();
    const sink = new Sink();
    const b = new Builder(sink);
    const ctx = { b, state, palette: chapterOf(state).palette, world: this };
    buildGrounds(ctx);
    buildHouse(ctx);
    buildPeople(ctx);
    buildProjects(ctx);
    const mesh = new THREE.Mesh(sink.build(), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  /** A clickable object: its own mesh, a hover scale, and a beacon when its priority is planned. */
  hotspot(parent, actionId, { position = ZERO3, rotation = ZERO3, beaconHeight = 1.4, disabled = false, activeFor = null } = {}, fn) {
    const group = new THREE.Group();
    // Parent groups only ever translate, so the parent's translation plus the local position places it.
    group.position.setFromMatrixPosition(parent.top.clone().multiply(compose(position)));
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    const sink = new Sink();
    fn(new Builder(sink));
    const mesh = new THREE.Mesh(sink.build(), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const beacon = this.makeBeacon();
    beacon.position.y = beaconHeight;
    group.add(beacon);
    this.root.add(group);
    const rec = {
      actionId,
      activeFor: activeFor || [actionId],
      group,
      mesh,
      beacon,
      beaconHeight,
      rotY: rotation[1],
      fixedDisabled: disabled,
      disabled,
      active: false,
      scale: 1,
      bounce: 0,
    };
    mesh.userData.hotspot = rec;
    this.hotspots.push(rec);
    return rec;
  }

  /** A person: a hotspot (or plain group) whose body sways gently. */
  person(parent, { position, color, accent, age = 30, phase = 0, actionId = null, activeFor = null }) {
    const g = age < 4 ? 0.52 : age < 11 ? 0.68 : age < 17 ? 0.86 : age > 72 ? 0.94 : 1;
    const skin = age > 70 ? '#d8b09b' : '#e8b69b';
    const hair = age > 65 ? '#d5d2cc' : age < 15 ? '#8e6248' : '#66473a';
    const legs = age > 72 ? '#6f6575' : '#3e5870';
    const body = (pb) =>
      pb.group(null, null, [g, g, g], () => {
        pb.cyl([0, 0.75, 0], [0.2, 0.28, 0.65, 6], color);
        pb.ico([0, 1.32, 0], 0.24, skin, null, 1);
        pb.ico([0, 1.49, -0.02], 0.2, hair, [1, 0.55, 1], 1);
        pb.box([-0.12, 0.28, 0], [0.13, 0.55, 0.16], legs);
        pb.box([0.12, 0.28, 0], [0.13, 0.55, 0.16], legs);
        pb.box([-0.29, 0.79, 0], [0.13, 0.55, 0.13], skin, [0, 0, -0.2]);
        pb.box([0.29, 0.79, 0], [0.13, 0.55, 0.13], skin, [0, 0, 0.2]);
        pb.box([0, 0.77, 0.22], [0.3, 0.38, 0.06], accent);
      });
    if (actionId) {
      const rec = this.hotspot(parent, actionId, { position, beaconHeight: 1.85, activeFor }, body);
      this.bobs.push({ obj: rec.mesh, phase });
      return;
    }
    const sink = new Sink();
    body(new Builder(sink));
    const mesh = new THREE.Mesh(sink.build(), this.material);
    mesh.castShadow = true;
    const group = new THREE.Group();
    group.position.setFromMatrixPosition(parent.top.clone().multiply(compose(position)));
    group.add(mesh);
    this.root.add(group);
    this.bobs.push({ obj: mesh, phase });
  }

  // ---------------------------------------------------------------- interaction

  /** The enabled hotspot under a canvas point (normalised device coordinates), or null. */
  pick(nx, ny) {
    if (!this.pickList.length) return null;
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickList, false)[0];
    return hit ? hit.object.userData.hotspot : null;
  }

  setHover(rec) {
    this.hovered = rec && !rec.disabled ? rec : null;
  }

  /** Highlight every object for an action (a task card is hovered or focused). */
  setPreview(actionId) {
    this.preview = actionId || null;
  }

  hasHotspot(actionId) {
    return this.hotspots.some((h) => h.actionId === actionId);
  }

  /** Bounce the objects of the week's priorities. */
  celebrate(ids) {
    for (const h of this.hotspots) if (ids.includes(h.actionId)) h.bounce = 1;
  }

  /** Where an action's object sits on screen (CSS pixels inside the world panel), or null. */
  screenPoint(actionId) {
    const rec = this.hotspots.find((h) => h.actionId === actionId);
    if (rec) {
      rec.group.updateWorldMatrix(true, false);
      rec.group.localToWorld(this.tmp.set(0, rec.beaconHeight * 0.7, 0));
    }
    else this.tmp.set(TARGET.x, 1.2, TARGET.z);
    this.tmp.project(this.camera);
    if (Math.abs(this.tmp.x) > 1.1 || Math.abs(this.tmp.y) > 1.1) return null;
    return { x: ((this.tmp.x + 1) / 2) * this.width, y: ((1 - this.tmp.y) / 2) * this.height, found: !!rec };
  }

  /** Where a project's site sits on screen (CSS pixels inside the world panel), or null. */
  projectPoint(id) {
    const model = PROJECT_MODELS[id];
    const pos = model ? model.position : id === 'memoryQuilt' ? [-3.05, 0, 1.8] : null;
    if (!pos) return null;
    this.tmp.set(pos[0], (model?.beacon ?? 1.5) * 0.7, pos[2]).project(this.camera);
    if (Math.abs(this.tmp.x) > 1.1 || Math.abs(this.tmp.y) > 1.1) return null;
    return { x: ((this.tmp.x + 1) / 2) * this.width, y: ((1 - this.tmp.y) / 2) * this.height };
  }

  // ---------------------------------------------------------------- camera

  rotateBy(radians) {
    this.view.yawTarget = THREE.MathUtils.clamp(this.view.yawTarget + radians, -YAW_LIMIT, YAW_LIMIT);
  }

  zoomBy(amount) {
    this.view.zoomTarget = THREE.MathUtils.clamp(this.view.zoomTarget * Math.exp(amount), ZOOM_MIN, ZOOM_MAX);
  }

  resetView() {
    this.view.yawTarget = 0;
    this.view.zoomTarget = 1;
  }

  updateCamera(dt) {
    const v = this.view;
    const k = 1 - Math.exp(-9 * dt);
    v.yaw += (v.yawTarget - v.yaw) * k;
    v.zoom += (v.zoomTarget - v.zoom) * k;
    const s = this.state;
    const rooms = s ? s.household.rooms.length : 3;
    const chapter = s ? s.chapterIndex : 0;
    const key = `${v.yaw.toFixed(4)}|${v.zoom.toFixed(4)}|${rooms}|${chapter}|${this.width}|${this.height}`;
    if (key === this.cameraKey) return;
    this.cameraKey = key;
    // The original framing (camera position and zoom grow with the house), turned by the player's yaw.
    const u = Math.max(0, rooms - 4);
    const narrow = this.width < 700;
    const off = this.tmp.set(13.5 + u * 0.25 - TARGET.x, 12.5 + u * 0.12 - TARGET.y, 14.5 + u * 0.25 - TARGET.z);
    off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, v.yaw);
    this.camera.position.copy(TARGET).add(off);
    const zoom = (narrow ? 32 : 46) - u * (narrow ? 1.3 : 1.6) - Math.max(0, chapter - 4) * 0.5;
    this.camera.zoom = zoom * v.zoom;
    this.camera.lookAt(TARGET);
    this.camera.updateProjectionMatrix();
    this.pickDirty = true;
  }

  // ---------------------------------------------------------------- per frame

  update(dt, t) {
    this.updateCamera(dt);
    const k = 1 - Math.pow(1 - 0.16, dt * 60);
    for (const h of this.hotspots) {
      const previewed = !!this.preview && h.actionId === this.preview && !h.disabled;
      const target = previewed ? PREVIEW_SCALE : h === this.hovered ? HOVER_SCALE : 1;
      h.scale += (target - h.scale) * k;
      let s = h.scale;
      if (h.bounce > 0) {
        h.bounce = Math.max(0, h.bounce - dt * 1.6);
        s *= 1 + Math.sin((1 - h.bounce) * Math.PI) * 0.09;
      }
      h.group.scale.setScalar(s);
      h.group.rotation.y = h.rotY + (h.active ? Math.sin(t * 2.1) * 0.008 : 0);
      const showBeacon = h.active || previewed;
      h.beacon.visible = showBeacon;
      if (showBeacon) {
        h.beacon.position.y = h.beaconHeight + Math.sin(t * 3.1) * 0.09;
        h.beacon.rotation.y += dt * 1.08;
      }
    }
    for (const p of this.bobs) {
      p.obj.position.y = Math.sin(t * 1.7 + p.phase) * 0.025;
      p.obj.rotation.y = Math.sin(t * 0.7 + p.phase) * 0.04;
    }
    for (const c of this.clouds) c.mesh.position.x = c.x + Math.sin(t * c.speed) * 1.4;
  }

  render() {
    this.post.render();
  }

  /** Pre-compile every pipeline (beacons included) so the first planned priority does not hitch. */
  async warm() {
    const h = this.hotspots[0];
    if (h) h.beacon.visible = true;
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } finally {
      if (h) h.beacon.visible = false;
    }
  }
}

// ------------------------------------------------------------------ scene builders (ported component by component)

function tree(b, position, scale, color) {
  b.group(position, null, [scale, scale, scale], () => {
    b.cyl([0, 0.85, 0], [0.2, 0.27, 1.7, 6], '#9b6b49');
    b.ico([0, 2.05, 0], 0.82, color, [1, 0.9, 1]);
    b.ico([-0.48, 1.85, 0.1], 0.56, '#79b968');
    b.ico([0.46, 1.9, -0.1], 0.58, '#6cae5f');
  });
}

function flowers(b, position, count) {
  const colors = ['#f47c7c', '#ffd166', '#9b79d0', '#fff4dc'];
  b.group(position, null, null, () => {
    for (let s = 0; s < count; s++) {
      b.group([(s % 4) * 0.28, 0, Math.floor(s / 4) * 0.32], null, null, () => {
        b.cyl([0, 0.16, 0], [0.025, 0.035, 0.32, 5], '#4d8d4a');
        b.ico([0, 0.36, 0], 0.09, colors[s % colors.length], null, 0);
      });
    }
  });
}

function room(b, [x, z], [w, d], floor, wall) {
  b.box([x, 0.05, z], [w, 0.12, d], floor);
  b.box([x, 0.68, z - d / 2], [w, 1.34, 0.13], wall);
  b.box([x - w / 2, 0.68, z], [0.13, 1.34, d], wall);
  b.box([x, 1.31, z - d / 2 + 0.07], [w, 0.08, 0.18], '#ffffff');
  b.box([x - w / 2 + 0.07, 1.31, z], [0.18, 0.08, d], '#ffffff');
}

function chair(b, position, rotation, color) {
  b.group(position, rotation, null, () => {
    b.box([0, 0.42, 0], [0.55, 0.12, 0.55], color);
    b.box([0, 0.82, -0.24], [0.55, 0.68, 0.12], color);
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) b.box([x, 0.2, z], [0.08, 0.42, 0.08], '#9f6748');
  });
}

function papers(b, position, count) {
  b.group(position, null, null, () => {
    for (let n = 0; n < Math.min(count, 5); n++) {
      b.box([0, n * 0.035, 0], [0.42, 0.025, 0.28], n % 2 ? '#fff0cf' : '#f2dfbb', [0, n * 0.08, 0]);
    }
  });
}

function buildGrounds({ b, state, palette, world }) {
  const wear = state.metrics.wear;
  b.box([0, -0.24, 0.8], [18, 0.45, 15], palette.lawn);
  b.box([0.8, -0.005, 7.4], [4.8, 0.06, 1.15], '#f4d19d');
  b.box([0.2, 0, 5.8], [1.1, 0.07, 3.3], '#f4d19d');

  // The fence (a post leans when the house is worn).
  const back = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
  back.forEach((x, n) => {
    b.box([x, 0.45, -6.4], [0.13, 0.95, 0.13], '#f7efd8', [0, 0, n === 7 && wear > 60 ? 0.18 : 0]);
    if (n < back.length - 1) b.box([x + 1, 0.5, -6.4], [1.9, 0.1, 0.1], '#f7efd8');
  });
  [-5.6, -3.6, -1.6, 0.4, 2.4, 4.4].forEach((z, n) => {
    b.box([-8.2, 0.45, z], [0.13, 0.95, 0.13], '#f7efd8');
    b.box([-8.2, 0.5, z + 0.85], [0.1, 0.1, 1.75], '#f7efd8', [n === 4 && wear > 72 ? 0.1 : 0, 0, 0]);
  });

  tree(b, [-7.2, 0, -4.7], 1.05, '#62a85a');
  tree(b, [7.2, 0, -4.6], 0.86, '#72b663');
  tree(b, [-7.3, 0, 5.2], 0.78, '#5f9f54');
  flowers(b, [-5.5, 0, -3.5], 7);
  flowers(b, [5.9, 0, 5.2], 6);

  // Garden bed.
  const big = !!state.flags.bigGarden;
  const gs = big ? 1.25 : 0.92;
  world.hotspot(b, 'garden', { position: big ? [-5.55, 0, 1.3] : [-5.8, 0, 2.15], beaconHeight: 1.15 }, (hb) =>
    hb.group(null, null, [gs, gs, gs], () => {
      hb.box([0, 0.12, 0], [2.4, 0.22, 1.45], '#8c5d3b');
      hb.box([0, 0.25, 0], [2.15, 0.12, 1.2], '#4d3b2b');
      [-0.7, 0, 0.7].forEach((x, f) =>
        [-0.35, 0, 0.35].forEach((z) =>
          hb.group([x, 0.36, z], null, null, () => {
            hb.cyl([0, 0.13, 0], [0.025, 0.035, 0.26, 5], '#4d8d4a');
            hb.ico([0, 0.3, 0], 0.1, f % 2 ? '#77b85f' : '#5ea557', null, 0);
          })
        )
      );
    })
  );

  // Workbench.
  const owns = new Set(state.household.owned);
  world.hotspot(b, 'repair', { position: [-5.9, 0, -2.75], beaconHeight: 1.25 }, (hb) => {
    hb.box([0, 0.72, 0], [1.6, 0.16, 0.65], '#a66d48');
    for (const x of [-0.62, 0.62]) for (const z of [-0.2, 0.2]) hb.box([x, 0.35, z], [0.14, 0.72, 0.14], '#7e5137');
    hb.box([0.25, 0.89, 0], [0.6, 0.08, 0.14], '#51606f', [0, 0.2, 0.15]);
    if (owns.has('toolKit')) hb.box([-0.42, 0.93, 0], [0.52, 0.26, 0.34], '#e05252');
  });

  // Station wagon.
  if (owns.has('stationWagon')) {
    b.group([5.45, 0.28, 6.15], [0, -0.08, 0], null, () => {
      b.box([0, 0.36, 0], [2.1, 0.55, 0.95], palette.accent);
      b.box([-0.2, 0.78, 0], [1.2, 0.45, 0.86], '#f3e8d0');
      b.box([-0.2, 0.81, -0.44], [0.95, 0.3, 0.04], '#7fb3c8');
      b.box([-0.2, 0.81, 0.44], [0.95, 0.3, 0.04], '#7fb3c8');
      for (const x of [-0.65, 0.67]) for (const z of [-0.48, 0.48]) b.cyl([x, 0.22, z], [0.19, 0.19, 0.12, 10], '#30343b', [Math.PI / 2, 0, 0]);
    });
  }

  // Boxes to sort in the later eras.
  if (state.chapterIndex >= 5) {
    world.hotspot(b, 'declutter', { position: [5.7, 0, 4.7], beaconHeight: 1.45 }, (hb) => {
      hb.box([0, 0.35, 0], [0.9, 0.7, 0.8], '#c7945e');
      hb.box([0.7, 0.26, 0.15], [0.65, 0.52, 0.62], '#d8a96f');
      hb.box([0.15, 0.92, -0.05], [0.66, 0.45, 0.58], '#b9824e');
      hb.box([-0.28, 0.73, 0.01], [0.08, 0.25, 0.6], '#f4e5bb');
    });
  }

  // Mailbox.
  b.group([3.6, 0, 7.1], null, null, () => {
    b.box([0, 0.55, 0], [0.12, 1.1, 0.12], '#f7efd8');
    b.box([0, 1.15, 0], [0.55, 0.4, 0.42], palette.accent);
    b.box([0.34, 1.25, 0], [0.06, 0.5, 0.06], '#e9d44c');
  });
}

function buildHouse({ b, state, palette, world }) {
  const rooms = new Set(state.household.rooms);
  const owns = new Set(state.household.owned);
  const wall = palette.wall;
  room(b, [-2.45, -1.65], [4.3, 3.5], palette.floor, wall);
  room(b, [2, -1.65], [4.35, 3.5], '#f3c59f', wall);
  room(b, [-2.45, 2.05], [4.3, 3.55], '#eac49f', wall);
  if (rooms.has('nursery')) room(b, [2, 2.05], [4.35, 3.55], '#f7dcb2', '#f6e7cf');
  if (rooms.has('familyRoom')) room(b, [5.85, -1.15], [3.2, 4.5], '#d8b47d', '#f0dfc6');
  if (rooms.has('porch')) {
    const [x, z] = [5.75, 2.1];
    b.box([x, 0.12, z], [3.1, 0.24, 3], '#bf8a58');
    for (const sx of [-1.35, 1.35]) for (const sz of [-1.25, 1.25]) b.box([x + sx, 0.9, z + sz], [0.12, 1.8, 0.12], wall);
    b.box([x, 1.78, z - 1.25], [3, 0.12, 0.12], wall);
    b.box([x - 1.35, 1.78, z], [0.12, 0.12, 2.6], wall);
  }
  if (rooms.has('kidsRoom')) room(b, [1.95, 5.15], [4.35, 2.55], '#e7be88', '#eee0cb');
  if (rooms.has('guestRoom')) room(b, [-2.45, 5.15], [4.3, 2.55], '#d7b58d', '#eee1d2');

  // ---- Kitchen.
  b.box([-2.4, 0.55, -2.95], [4, 0.9, 0.55], '#8fc7b4');
  b.box([-2.4, 1.04, -2.95], [4.05, 0.12, 0.62], '#fff2d9');
  world.hotspot(b, 'cook', { position: [-3.5, 0, -2.35], beaconHeight: 1.45 }, (hb) => {
    hb.box([0, 0.52, 0], [0.95, 1.02, 0.78], '#f4efe7');
    for (const x of [-0.22, 0.22]) for (const z of [-0.18, 0.18]) hb.cyl([x, 1.06, z], [0.09, 0.09, 0.035, 10], '#4d535a');
    hb.box([0, 0.53, 0.405], [0.62, 0.48, 0.04], '#8599a1');
    if (owns.has('pressureCooker')) hb.cyl([0.18, 1.2, 0], [0.17, 0.2, 0.23, 10], '#d7d9d8');
    if (owns.has('microwave')) hb.box([-0.02, 1.48, -0.06], [0.65, 0.38, 0.45], '#e9d8c6');
  });
  const fridge = owns.has('refrigerator');
  world.hotspot(b, 'shop', { position: [-1.25, 0, -2.45], beaconHeight: 1.75 }, (hb) => {
    hb.box([0, fridge ? 0.8 : 0.62, 0], [0.9, fridge ? 1.6 : 1.22, 0.75], fridge ? '#d9efe9' : '#e8cfa9');
    hb.box([0.32, 0.95, 0.39], [0.05, 0.45, 0.04], '#7e8a8d');
    if (fridge) hb.box([0, 1.15, 0.39], [0.78, 0.04, 0.03], '#b5cfca');
  });
  const fed = state.metrics.meals > 55;
  world.hotspot(b, 'host', { position: [-2.35, 0, -0.55], beaconHeight: 1.35 }, (hb) => {
    hb.box([0, 0.62, 0], [1.85, 0.16, 1.15], '#c78358');
    for (const x of [-0.68, 0.68]) for (const z of [-0.38, 0.38]) hb.box([x, 0.3, z], [0.12, 0.62, 0.12], '#9f6748');
    if (fed) {
      hb.cyl([-0.35, 0.75, 0], [0.18, 0.18, 0.04, 12], '#fff6df');
      hb.cyl([0.35, 0.75, 0], [0.18, 0.18, 0.04, 12], '#fff6df');
      hb.cyl([0, 0.8, 0], [0.16, 0.2, 0.17, 10], '#f2c35c');
    }
  });
  chair(b, [-3.35, 0, -0.55], [0, Math.PI / 2, 0], '#d59a6d');
  chair(b, [-1.35, 0, -0.55], [0, -Math.PI / 2, 0], '#d59a6d');
  world.hotspot(b, 'laundry', { position: [-0.58, 0, -0.6], beaconHeight: 1.3 }, (hb) => {
    if (owns.has('washer')) {
      hb.cyl([0, 0.48, 0], [0.48, 0.5, 0.95, 12], '#e9f0ee');
      hb.cyl([0, 0.58, 0.49], [0.24, 0.24, 0.04, 12], '#88aeb8', [Math.PI / 2, 0, 0]);
    } else {
      hb.box([0, 0.28, 0], [0.7, 0.55, 0.62], '#c9976e');
      hb.box([0, 0.63, 0], [0.75, 0.1, 0.66], '#ecd4aa');
    }
    if (owns.has('sewingMachine')) {
      hb.group([0.75, 0.6, 0], null, null, () => {
        hb.box([0, 0, 0], [0.45, 0.12, 0.28], '#604f57');
        hb.box([-0.1, 0.2, 0], [0.12, 0.4, 0.16], '#4f4449');
        hb.box([0.05, 0.34, 0], [0.42, 0.12, 0.16], '#4f4449');
        hb.cyl([0.23, 0.38, 0], [0.08, 0.08, 0.04, 10], '#d4bf8f', [Math.PI / 2, 0, 0]);
      });
    }
  });
  if (owns.has('dishwasher')) b.box([-0.25, 0.48, -2.87], [0.72, 0.86, 0.45], '#dce5e3');
  if (owns.has('freezer')) {
    b.group([-0.78, 0, -1.48], null, null, () => {
      b.box([0, 0.38, 0], [0.9, 0.72, 0.62], '#e2eeeb');
      b.box([0, 0.77, 0], [0.94, 0.08, 0.66], '#f7fbf7');
      b.box([0.28, 0.81, 0.26], [0.22, 0.04, 0.04], '#879a9b');
    });
  }

  // ---- Living room.
  world.hotspot(b, 'connect', { position: [1.65, 0, -2.45], beaconHeight: 1.45 }, (hb) => {
    hb.box([0, 0.38, 0], [1.95, 0.5, 0.78], '#69b9ae');
    hb.box([0, 0.83, -0.3], [1.95, 0.75, 0.22], '#55a89d');
    hb.box([-1.03, 0.55, 0], [0.18, 0.58, 0.78], '#55a89d');
    hb.box([1.03, 0.55, 0], [0.18, 0.58, 0.78], '#55a89d');
    hb.box([-0.48, 0.68, 0.18], [0.62, 0.16, 0.45], '#f6c8ae');
    hb.box([0.48, 0.68, 0.18], [0.62, 0.16, 0.45], '#ffd166');
  });
  world.hotspot(b, 'rest', { position: [3.25, 0, -1.15], rotation: [0, -0.35, 0], beaconHeight: 1.5 }, (hb) => {
    hb.box([0, 0.42, 0], [0.88, 0.5, 0.82], '#f08a7e');
    hb.box([0, 0.9, -0.3], [0.9, 0.78, 0.22], '#dc746b');
    hb.box([-0.5, 0.58, 0], [0.16, 0.48, 0.75], '#dc746b');
    hb.box([0.5, 0.58, 0], [0.16, 0.48, 0.75], '#dc746b');
  });
  b.box([1.65, 0.35, -1.1], [1.25, 0.16, 0.72], '#b87750');
  b.group([0.45, 0, -0.35], null, null, () => {
    if (owns.has('television')) {
      b.box([0, 0.72, 0], [1.15, 0.78, 0.55], '#674f42');
      b.box([0, 0.76, 0.29], [0.78, 0.48, 0.04], '#7ba8aa');
      b.cyl([0.34, 0.42, 0.31], [0.05, 0.05, 0.04, 8], '#d4c69b', [Math.PI / 2, 0, 0]);
    } else {
      b.box([0, 0.52, 0], [0.82, 0.54, 0.36], '#8f614b');
      b.box([0, 0.54, 0.2], [0.5, 0.26, 0.03], '#d5b376');
      for (const x of [-0.15, 0, 0.15]) b.box([x, 0.75, 0.21], [0.04, 0.14, 0.03], '#4d4a45');
    }
  });
  if (state.chapterIndex >= 5) {
    world.hotspot(b, 'reminisce', { position: [3.1, 0, -2.65], beaconHeight: 1.35 }, (hb) => {
      hb.box([0, 0.55, 0], [0.82, 0.12, 0.62], '#ad744f');
      hb.box([0, 0.71, 0], [0.56, 0.04, 0.4], '#f2e3c5', [0, 0.2, 0]);
      if (owns.has('photoScanner')) hb.box([0.2, 0.82, -0.1], [0.38, 0.13, 0.28], '#d8dfe0');
      if (owns.has('camcorder')) hb.box([-0.24, 0.82, 0.12], [0.28, 0.18, 0.18], '#4a4d53');
    });
  }
  // The broom and dustpan: "Reset the rooms" had no object in the house.
  world.hotspot(b, 'tidy', { position: [3.85, 0, -3.02], beaconHeight: 1.6 }, (hb) => {
    hb.cyl([0, 0.72, -0.02], [0.025, 0.025, 1.25, 6], '#c8895f', [-0.16, 0, 0]);
    hb.box([0, 0.14, 0.1], [0.3, 0.22, 0.08], '#e8c36a', [-0.16, 0, 0]);
    hb.box([0, 0.03, 0.1], [0.32, 0.05, 0.1], '#c9976e');
    hb.box([0.3, 0.02, 0.18], [0.3, 0.03, 0.28], '#2bb9ad');
    hb.box([0.3, 0.07, 0.04], [0.3, 0.1, 0.03], '#2bb9ad');
    hb.box([0.3, 0.07, 0.36], [0.05, 0.04, 0.12], '#147f79');
  });

  // ---- Bedroom (the bed becomes the memory-quilt project in the last era).
  const quiltStep = projectProgress(state, 'memoryQuilt');
  const quiltCurrent = currentProject(state)?.id === 'memoryQuilt';
  const quiltDone = projectDone(state, 'memoryQuilt');
  const bed = (bb) => {
    bb.box([0, 0.4, 0], [1.65, 0.55, 2.25], '#bd815e');
    bb.box([0, 0.73, 0.05], [1.48, 0.32, 2.05], '#fff1d2');
    bb.box([0, 0.98, -0.72], [1.45, 0.22, 0.52], '#f2b0ae');
    bb.box([0, 0.78, -1.06], [1.72, 1.1, 0.16], '#a66d4d');
    if (quiltCurrent || quiltDone) {
      const rows = quiltStep >= 3 ? 5 : quiltStep === 2 ? 4 : quiltStep === 1 ? 2 : 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 4; c++) {
          bb.box([-0.54 + c * 0.36, 0.905, 0.905 - r * 0.29], [0.35, 0.03, 0.28], QUILT_COLORS[(r * 4 + c + r) % QUILT_COLORS.length]);
        }
      }
      if (quiltStep >= 3) bb.box([0, 0.9, 1.1], [1.5, 0.06, 0.08], '#fff4dc');
      else {
        bb.cyl([1.05, 0.14, 0.7], [0.22, 0.18, 0.28, 10], '#c8895f');
        QUILT_COLORS.slice(0, 4).forEach((c, i) => bb.box([0.98 + (i % 2) * 0.12, 0.3 + i * 0.02, 0.64 + (i >> 1) * 0.12], [0.16, 0.03, 0.14], c, [0, i * 0.4, 0]));
      }
    }
  };
  if (quiltCurrent) world.hotspot(b, 'project', { position: [-3.05, 0, 1.8], beaconHeight: 1.55 }, bed);
  else if (quiltDone) world.hotspot(b, 'reminisce', { position: [-3.05, 0, 1.8], beaconHeight: 1.55 }, bed);
  else b.group([-3.05, 0, 1.8], null, null, () => bed(b));
  world.hotspot(b, 'budget', { position: [-1.18, 0, 1.45], beaconHeight: 1.5 }, (hb) => {
    hb.box([0, 0.62, 0], [1.12, 0.14, 0.65], '#b97c54');
    for (const x of [-0.43, 0.43]) for (const z of [-0.22, 0.22]) hb.box([x, 0.3, z], [0.1, 0.6, 0.1], '#87583e');
    papers(hb, [-0.25, 0.76, 0], Math.max(2, Math.floor(state.metrics.mentalLoad / 18)));
    if (owns.has('homeComputer')) {
      hb.group([0.22, 0.82, -0.03], null, null, () => {
        hb.box([0, 0, 0], [0.42, 0.4, 0.34], '#d8d4c5');
        hb.box([0, 0.02, 0.18], [0.29, 0.22, 0.03], '#648b83');
        hb.box([0, -0.27, 0.15], [0.48, 0.08, 0.28], '#c8c4b6');
      });
    }
  });
  b.box([-1.25, 0.55, 2.7], [0.9, 1.05, 0.52], '#d29a6d');
  b.box([-1.25, 1.05, 2.97], [0.65, 0.12, 0.05], '#f7e8bf');

  // ---- Nursery.
  if (rooms.has('nursery')) {
    const kids = childrenAtHome(state);
    const id = state.chapterIndex >= 2 ? 'homework' : 'childcare';
    world.hotspot(b, id, { position: [1.3, 0, 1.75], beaconHeight: 1.35 }, (hb) => {
      if (state.chapterIndex < 2) {
        hb.box([0, 0.45, 0], [1.25, 0.55, 0.72], '#f4c6a5');
        for (const x of [-0.55, 0.55]) for (const z of [-0.28, 0.28]) hb.box([x, 0.82, z], [0.08, 0.72, 0.08], '#fff0d1');
        for (const x of [-0.3, 0, 0.3]) hb.box([x, 0.82, -0.34], [0.05, 0.68, 0.05], '#fff0d1');
      } else {
        hb.box([0, 0.38, 0], [1.5, 0.5, 0.8], '#9ecbe1');
        hb.box([0, 0.72, 0], [1.35, 0.22, 0.68], '#fff2dc');
      }
      if (kids.length > 0) hb.ico([0.35, 1, 0.15], 0.18, '#ffd166', null, 0);
    });
    b.box([2.75, 0.48, 1.35], [0.85, 0.92, 0.55], '#f2b79f');
    b.box([3, 0.2, 2.75], [0.9, 0.38, 0.72], '#d8a76e');
    b.ico([2.85, 0.55, 2.7], 0.18, '#8dbde0', null, 0);
    b.box([3.15, 0.5, 2.85], [0.3, 0.3, 0.3], '#ffd166');
  }

  // ---- Family room.
  if (rooms.has('familyRoom')) {
    const id = state.flags.studyUnlocked ? 'study' : state.flags.organizeUnlocked ? 'organize' : 'connect';
    b.group([5.85, 0, -1.15], null, null, () => {
      world.hotspot(b, id, { position: [0.25, 0, -1.15], beaconHeight: 1.5 }, (hb) => {
        hb.box([0, 0.62, 0], [1.35, 0.14, 0.7], '#9a6848');
        hb.box([0, 1.05, -0.28], [1.3, 0.72, 0.1], '#b57c53');
        papers(hb, [-0.32, 0.75, 0], 3);
        if (owns.has('writingDesk')) hb.box([0.28, 0.78, 0.02], [0.25, 0.04, 0.4], '#f4e7bd', [0, 0.2, 0]);
      });
      b.box([0, 0.38, 1.15], [2, 0.5, 0.78], '#d09b55');
      b.box([0, 0.83, 0.86], [2, 0.75, 0.22], '#bc8846');
      b.box([-1.2, 0.78, -0.9], [0.6, 1.4, 0.35], '#8c674a');
      [-1.35, -0.95, -0.55].forEach((y, i) => b.box([-1.2, y + 1.4, -0.7], [0.44, 0.12, 0.22], ['#ef7c73', '#76b6c4', '#f1c45b'][i]));
    });
  }

  // ---- Porch.
  if (rooms.has('porch')) {
    const id = state.flags.organizeUnlocked ? 'organize' : 'host';
    b.group([5.75, 0, 2.1], null, null, () => {
      world.hotspot(b, id, { position: [0, 0, -0.25], beaconHeight: 1.4 }, (hb) => {
        hb.box([0, 0.45, 0], [1.85, 0.42, 0.65], '#7bb79e');
        hb.box([0, 0.85, -0.25], [1.85, 0.62, 0.14], '#64a88e');
        hb.box([-0.8, 0.25, 0], [0.1, 0.52, 0.55], '#4f876f');
        hb.box([0.8, 0.25, 0], [0.1, 0.52, 0.55], '#4f876f');
      });
      b.box([-1.05, 0.45, 0.92], [0.45, 0.8, 0.45], '#c77b55');
      b.ico([-1.05, 1.05, 0.92], 0.35, '#6ead61', null, 0);
      if (owns.has('gardenBench')) b.box([0.85, 0.38, 0.95], [1.1, 0.38, 0.48], '#a36c48');
    });
  }

  // ---- Children's room.
  if (rooms.has('kidsRoom')) {
    const kids = childrenAtHome(state);
    const id = state.chapterIndex <= 3 ? 'homework' : 'connect';
    b.group([1.95, 0, 5.15], null, null, () => {
      world.hotspot(b, id, { position: [-0.8, 0, 0], beaconHeight: 1.4 }, (hb) => {
        hb.box([0, 0.35, 0], [1.45, 0.46, 0.72], '#79b6d8');
        hb.box([0, 0.65, 0], [1.3, 0.18, 0.62], '#fff0d4');
        if (kids.length > 0) hb.ico([0.35, 0.86, 0.05], 0.16, '#ef7c73', null, 0);
      });
      b.box([1.05, 0.55, -0.2], [0.95, 0.12, 0.58], '#a76d49');
      b.box([1.05, 0.78, -0.25], [0.34, 0.04, 0.36], '#f1e1b8', [0, -0.25, 0]);
      [-0.55, 0, 0.55].forEach((x, i) => b.box([x, 0.28, 0.82], [0.36, 0.48, 0.36], ['#f0a175', '#ffd166', '#82b8c8'][i]));
    });
  }

  // ---- Guest room.
  if (rooms.has('guestRoom')) {
    b.group([-2.45, 0, 5.15], null, null, () => {
      world.hotspot(b, 'eldercare', { position: [-0.65, 0, 0], beaconHeight: 1.45, disabled: state.chapterIndex !== 4 }, (hb) => {
        hb.box([0, 0.38, 0], [1.55, 0.5, 0.78], '#b68c6f');
        hb.box([0, 0.72, 0], [1.4, 0.22, 0.66], '#f6e6c8');
        hb.box([0, 0.85, -0.24], [0.55, 0.16, 0.38], '#b7cbd1');
      });
      b.box([0.85, 0.52, -0.25], [0.7, 0.95, 0.46], '#a77856');
      b.cyl([0.92, 1.16, -0.25], [0.24, 0.34, 0.42, 8], '#f0d787');
    });
  }

  // ---- Clutter: toys and things left out when the house slips.
  const spots = [
    [0.8, 0.18, -0.65],
    [2.8, 0.16, -2.6],
    [-0.7, 0.15, 2.6],
    [2.8, 0.16, 2.6],
    [-3.6, 0.14, -0.2],
    [4.8, 0.16, -0.1],
    [0.5, 0.14, 4.7],
    [-1.2, 0.14, 5.5],
  ];
  const clutterColors = ['#ef7c73', '#ffd166', '#73b7c8', '#9c7ac7'];
  const clutter = world.clutterCount(state);
  for (let d = 0; d < clutter; d++) {
    b.group(spots[d], [0, d * 0.55, 0], null, () => {
      if (d % 2) b.box([0, 0, 0], [0.36, 0.12, 0.26], clutterColors[d % 4]);
      else b.ico([0, 0.05, 0], 0.14, clutterColors[d % 4], null, 0);
    });
  }

  // ---- Chimney.
  b.group([-3.7, 1.1, -3.12], null, null, () => {
    b.box([0, 0.5, 0], [0.55, 1, 0.55], '#b56652');
    b.box([0, 1.02, 0], [0.7, 0.12, 0.7], '#8f5044');
  });

  // ---- The table where the load gets shared.
  world.hotspot(b, 'askHelp', { position: [0.2, 0.02, -0.45], beaconHeight: 1.15 }, (hb) => {
    hb.box([0, 0.15, 0], [0.58, 0.18, 0.42], '#fff0c7');
    hb.box([-0.15, 0.27, 0], [0.18, 0.04, 0.26], '#ef7c73', [0, 0.2, 0]);
    hb.box([0.15, 0.28, 0], [0.18, 0.04, 0.26], '#54a7b2', [0, -0.18, 0]);
  });
}

function buildPeople({ b, state, world }) {
  const year = yearOf(state);
  const kids = childrenAtHome(state);
  const kidAction = state.chapterIndex >= 2 && state.chapterIndex <= 3 ? 'homework' : 'childcare';
  world.person(b, { position: [-1.35, 0.08, -1.15], color: '#ef7c73', accent: '#fff0d4', age: 22 + (year - 1954), phase: 0, actionId: 'rest' });
  world.person(b, {
    position: [1.55, 0.08, -1.25],
    color: '#4fa6b3',
    accent: '#f2d49a',
    age: 24 + (year - 1954),
    phase: 1.6,
    actionId: 'connect',
    activeFor: ['connect', 'askHelp'],
  });
  kids.forEach((child, i) =>
    world.person(b, {
      position: i === 0 ? [1.75, 0.08, 2.3] : [2.55, 0.08, 4.9],
      color: child.color,
      accent: i % 2 ? '#f47c7c' : '#ffd166',
      age: year - child.birthYear,
      phase: 2.4 + i,
      actionId: kidAction,
    })
  );
  if ((state.household.dependents ?? 0) > 0) {
    world.person(b, { position: [-2.6, 0.08, 5.1], color: '#9b87a8', accent: '#d9d3ca', age: 78, phase: 4.2, actionId: 'eldercare' });
  }
  if (state.chapterIndex >= 5) {
    for (let i = 0; i < Math.min(2, state.household.grandchildren ?? 0); i++) {
      world.person(b, {
        position: [4.35 + i * 0.65, 0.08, 2.7 + i * 0.45],
        color: i ? '#ffd166' : '#a9d0ea',
        accent: '#f47c7c',
        age: 7 + i * 2 + Math.max(0, year - 1997),
        phase: 5.2 + i,
        actionId: 'reminisce',
      });
    }
  }
  if (state.plan.includes('host')) {
    world.person(b, { position: [4.6, 0.08, 4.5], color: '#8c72bd', accent: '#f1d48b', age: 45, phase: 6.2 });
    world.person(b, { position: [5.3, 0.08, 4], color: '#df8a68', accent: '#7ac2b5', age: 48, phase: 7.1 });
  }
}

/** Project sites: the current project is a clickable work site; finished ones stay and link to a priority. */
function buildProjects({ b, state, world }) {
  const current = currentProject(state);
  for (const [id, model] of Object.entries(PROJECT_MODELS)) {
    const step = projectProgress(state, id);
    const isCurrent = current?.id === id;
    const done = projectDone(state, id);
    if (!isCurrent && !done) continue;
    const link = id === 'treehouse' && !isAvailableId('homework', state) ? 'childcare' : null;
    const actionId = isCurrent ? 'project' : link || projectLink(id);
    world.hotspot(b, actionId, { position: model.position, rotation: model.rotation, beaconHeight: model.beacon }, (hb) => model.build(hb, step));
  }
}

const LINKS = { picnicTable: 'host', swingSet: 'childcare', treehouse: 'homework', cookbook: 'cook', messageBoard: 'askHelp', orchard: 'garden' };
function projectLink(id) {
  return LINKS[id] || 'project';
}
