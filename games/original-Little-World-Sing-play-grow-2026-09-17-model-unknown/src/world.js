/* Procedural toy models on the shared 3D kit. No remote models, images, textures, or fonts.
   The stage renders with kit.renderer (WebGPU, WebGL2 fallback) into a canvas that
   moves between pages. Geometry, materials and textures are shared and kept, so a
   page change rebuilds a scene from what is already on the GPU. */

import * as THREE from 'three/webgpu';

const palette = { green: '#8eab73', deepGreen: '#527a4b', yellow: '#e9bf58', cream: '#fff7df', wood: '#d9b687', pink: '#d8927d', blue: '#7eabb3', dark: '#34433a' };

/* ------------------------------------------------------------------ shared resources */

const geometries = new Map();
const materials = new Map();
const textures = new Map();
const cached = (map, key, make) => {
  let value = map.get(key);
  if (value === undefined) {
    value = make();
    map.set(key, value);
  }
  return value;
};
const geo = (key, make) => cached(geometries, key, make);
/** Light colours in the original were linear values (three.js r140 did not convert hex). */
const linear = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

const optionKey = (options) =>
  Object.keys(options)
    .map((k) => `${k}=${options[k]?.isTexture ? 'tex' + options[k].id : options[k]}`)
    .join(',');

function material(hex, options = {}) {
  return cached(materials, `${hex}|${optionKey(options)}`, () =>
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.48, metalness: 0, clearcoat: 0.16, clearcoatRoughness: 0.52, ...options })
  );
}

function mesh(geometry, mat, parent, position = [0, 0, 0], scale = null) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...position);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function group(parent, position = [0, 0, 0], scale = 1, action = null) {
  const g = new THREE.Group();
  g.position.set(...position);
  if (scale !== 1) g.scale.setScalar(scale);
  if (action) g.userData.action = action;
  parent.add(g);
  return g;
}

const unitSphere = () => geo('sphere', () => new THREE.SphereGeometry(1, 32, 24));
/** Every sphere shares one unit geometry, scaled by radius. */
function sphereWith(parent, mat, position, radius = 1, scale = [1, 1, 1]) {
  return mesh(unitSphere(), mat, parent, position, [scale[0] * radius, scale[1] * radius, scale[2] * radius]);
}
function sphere(parent, hex, position, radius = 1, scale = [1, 1, 1], options = {}) {
  return sphereWith(parent, material(hex, options), position, radius, scale);
}
function cylinder(parent, hex, position, top, bottom, height, options = {}) {
  const g = geo(`cyl:${top}:${bottom}:${height}`, () => new THREE.CylinderGeometry(top, bottom, height, 48));
  return mesh(g, material(hex, options), parent, position);
}
function roundedGeometry(w, h, d, r = 0.12) {
  const g = new THREE.BoxGeometry(w, h, d, 8, 8, 8);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const point = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i);
    nearest.set(THREE.MathUtils.clamp(point.x, -w / 2 + r, w / 2 - r), THREE.MathUtils.clamp(point.y, -h / 2 + r, h / 2 - r), THREE.MathUtils.clamp(point.z, -d / 2 + r, d / 2 - r));
    normal.subVectors(point, nearest).normalize();
    point.copy(nearest).addScaledVector(normal, r);
    p.setXYZ(i, point.x, point.y, point.z);
    n.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return g;
}
const box = (parent, hex, position, size, options = {}) =>
  mesh(geo(`rbox:${size.join(':')}`, () => roundedGeometry(...size, Math.min(...size) * 0.14)), material(hex, options), parent, position);

function texture(key, draw, size = 256) {
  return cached(textures, key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
const woodTexture = () =>
  texture('wood', (ctx, s) => {
    ctx.fillStyle = '#dec397';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 95; i++) {
      ctx.strokeStyle = `rgba(135,96,52,${0.035 + (i % 5) * 0.007})`;
      ctx.lineWidth = 0.6 + (i % 3) * 0.2;
      ctx.beginPath();
      for (let x = 0; x <= s; x += 4) {
        const y = i * 3 + Math.sin(x * 0.02 + i * 0.61) * 2.5 + Math.sin(x * 0.06 + i) * 0.7;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
const plushTexture = () =>
  texture('plush', (ctx, s) => {
    ctx.fillStyle = '#ead9b9';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 3)
      for (let y = 0; y < s; y += 3) {
        ctx.fillStyle = (x + y) % 2 ? '#e6d2ac' : '#efdfc2';
        ctx.fillRect(x, y, 1, 2);
      }
  });
const quiltTexture = () =>
  texture('quilt', (ctx, s) => {
    const colors = ['#d8927d', '#e9bf58', '#8eab73', '#7eabb3', '#fff7df', '#c9a4d6'];
    const n = 4;
    const c = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = colors[(i * 3 + j * 2) % colors.length];
        ctx.fillRect(i * c, j * c, c, c);
      }
    ctx.strokeStyle = 'rgba(255,250,235,.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * c, 0);
      ctx.lineTo(i * c, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * c);
      ctx.lineTo(s, i * c);
      ctx.stroke();
    }
  });
const shadowTexture = () =>
  texture('blob', (ctx, s) => {
    const grad = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(61,76,43,.24)');
    grad.addColorStop(0.55, 'rgba(61,76,43,.15)');
    grad.addColorStop(1, 'rgba(61,76,43,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });

/** An unlit, see-through material for a canvas texture (letters, soft shadows). */
const decal = (map, toneMapped) =>
  cached(materials, `decal|tex${map.id}|${toneMapped}`, () => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped }));

function textPlane(parent, text, hex, size = 1, position = [0, 0, 0], rotation = 0) {
  const map = texture(
    `text:${text}:${hex}`,
    (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = hex;
      ctx.font = `700 ${s * 0.72}px "Trebuchet MS",Arial,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, s / 2, s * 0.535);
    },
    512
  );
  const m = mesh(geo(`plane:${size}`, () => new THREE.PlaneGeometry(size, size)), decal(map, false), parent, position);
  m.rotation.y = rotation;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function pathTube(parent, points, hex, radius = 0.02) {
  const g = geo(`tube:${radius}:${points.flat().join(',')}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 24, radius, 8, false));
  return mesh(g, material(hex), parent);
}

function starShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? radius * 0.5 : radius;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  shape.closePath();
  return shape;
}

/* ------------------------------------------------------------------ toy models */

function face(parent, { width = 0.25, y = 0, z = 0.42, smile = true } = {}) {
  [-1, 1].forEach((side) => {
    sphere(parent, palette.dark, [side * width, y, z], 0.055, [0.83, 1.2, 0.75], { roughness: 0.23, clearcoat: 0.8 });
    sphere(parent, '#fffbe8', [side * width - 0.012, y + 0.018, z + 0.037], 0.014, [1, 1, 0.6]);
  });
  if (smile) pathTube(parent, [[-0.105, y - 0.14, z + 0.01], [0, y - 0.185, z + 0.012], [0.105, y - 0.14, z + 0.01]], palette.dark, 0.016);
}
function cloud(parent, position, scale = 1) {
  const g = group(parent, position, scale);
  const white = material('#fffdf0', { roughness: 0.86, clearcoat: 0 });
  [[-0.43, 0, 0, 0.35], [0, 0.13, 0, 0.47], [0.44, 0, 0.015, 0.32], [0.15, -0.05, 0.03, 0.4]].forEach(([x, y, z, r]) => sphereWith(g, white, [x, y, z], r, [1, 0.84, 0.8]));
  return g;
}
function leaf(parent, position, scale = 0.2, hex = palette.green) {
  const m = sphere(parent, hex, position, 1, [scale, scale * 0.23, scale * 0.57], { roughness: 0.7, clearcoat: 0 });
  m.rotation.z = 0.38;
  return m;
}
function tree(parent, position, scale = 1) {
  const g = group(parent, position, scale);
  cylinder(g, '#be9868', [0, 0.48, 0], 0.075, 0.1, 0.85);
  sphere(g, '#94af7e', [0, 1.03, 0], 0.52, [0.92, 1.1, 0.85], { roughness: 0.8, clearcoat: 0 });
  sphere(g, '#a0b889', [-0.28, 0.9, 0.02], 0.32, [0.88, 1, 0.85], { roughness: 0.8, clearcoat: 0 });
  return g;
}
function flower(parent, position, scale = 0.15) {
  const g = group(parent, position);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4;
    sphere(g, '#fff9e2', [Math.cos(a) * scale * 0.72, 0, Math.sin(a) * scale * 0.72], scale * 0.46, [1, 0.36, 1]);
  }
  sphere(g, '#e9c463', [0, 0.025, 0], scale * 0.39, [1, 0.42, 1]);
  return g;
}
function star(parent, position, radius = 1, hex = palette.yellow, withFace = true) {
  const g = group(parent, position, 1, 'star');
  const geometry = geo(`star:${radius}`, () =>
    new THREE.ExtrudeGeometry(starShape(radius), { depth: radius * 0.23, bevelEnabled: true, bevelThickness: radius * 0.11, bevelSize: radius * 0.11, bevelSegments: 5, curveSegments: 16 })
  );
  mesh(geometry, material(hex, { roughness: 0.36, clearcoat: 0.44, clearcoatRoughness: 0.3 }), g);
  if (withFace) {
    face(g, { width: radius * 0.22, y: radius * 0.03, z: radius * 0.36 });
    [-1, 1].forEach((side) => sphere(g, '#e7a275', [side * radius * 0.34, -radius * 0.12, radius * 0.335], radius * 0.065, [1, 0.64, 0.14]));
  }
  return g;
}
function rainbow(parent, position, scale = 1) {
  const g = group(parent, position, scale);
  ['#d3937c', '#e0ba74', '#bbc391', '#93b2a0'].forEach((hex, i) => {
    const r = 1.3 - i * 0.205;
    mesh(geo(`arc:${r}`, () => new THREE.TorusGeometry(r, 0.105, 14, 70, Math.PI)), material(hex, { roughness: 0.8, clearcoat: 0 }), g);
  });
  return g;
}
function block(parent, letter, hex, position, size = 0.7, rot = 0) {
  const g = group(parent, position, 1, 'letter');
  g.rotation.y = rot;
  box(g, hex, [0, 0, 0], [size, size, size], { roughness: 0.6, clearcoat: 0.14 });
  textPlane(g, letter, '#fff9e8', size * 0.78, [0, 0, size / 2 + 0.009]);
  const side = mesh(geo(`plane:${size * 0.72}`, () => new THREE.PlaneGeometry(size * 0.72, size * 0.72)), material('#fff4d9', { map: woodTexture(), roughness: 0.65, clearcoat: 0 }), g, [size / 2 + 0.003, 0, 0]);
  side.rotation.y = Math.PI / 2;
  textPlane(g, letter.toLowerCase(), '#8f9270', size * 0.61, [size / 2 + 0.01, 0, 0], Math.PI / 2);
  return g;
}
function apple(parent, position, size = 0.35, index = 0) {
  const g = group(parent, position, 1, 'apple');
  const geometry = geo(`apple:${size}`, () => {
    const sphereGeo = new THREE.SphereGeometry(size, 32, 24);
    const p = sphereGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const rad = Math.hypot(x, z);
      const yy = y * 0.91 - (y > 0 ? size * 0.2 * Math.exp((-rad * rad) / (size * size * 0.11)) : 0);
      const factor = 1 + 0.035 * Math.sin(Math.atan2(z, x) * 5) * (Math.abs(y) / size);
      p.setXYZ(i, x * factor, yy, z * factor);
    }
    sphereGeo.computeVertexNormals();
    return sphereGeo;
  });
  mesh(geometry, material(index % 3 === 2 ? '#d68666' : '#cb6651', { roughness: 0.31, clearcoat: 0.72, clearcoatRoughness: 0.19 }), g);
  const stem = cylinder(g, '#77543d', [0.015, size * 0.98, 0], size * 0.043, size * 0.063, size * 0.32);
  stem.rotation.z = -0.19;
  leaf(g, [size * 0.26, size * 1.04, 0], size * 0.36, '#748f4c');
  g.rotation.y = index * 0.9;
  return g;
}
function cow(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'cow');
  sphere(g, '#fff7e8', [0, 1, 0], 0.72, [1.18, 0.78, 0.69], { roughness: 0.65 });
  [-0.53, 0.53].forEach((x) =>
    [-0.32, 0.32].forEach((z) => {
      cylinder(g, '#f4ebd5', [x, 0.46, z], 0.14, 0.12, 0.64);
      cylinder(g, '#576159', [x, 0.18, z], 0.147, 0.16, 0.16);
    })
  );
  [[-0.48, 1.13, 0.435, 0.23], [0.2, 0.9, 0.48, 0.2], [-0.05, 1.45, 0.18, 0.2]].forEach(([x, y, z, r]) => sphere(g, '#525c50', [x, y, z], r, [1, 1, 0.17], { roughness: 0.72 }));
  const head = group(g, [0.49, 1.57, 0.18]);
  sphere(head, '#fff8e9', [0, 0, 0], 0.51, [0.97, 1.06, 0.81], { roughness: 0.68 });
  [-1, 1].forEach((side) => {
    const ear = sphere(head, '#fbefdc', [side * 0.48, 0.16, 0.02], 0.22, [1.1, 0.52, 0.62]);
    ear.rotation.z = side * 0.3;
    sphere(head, '#d79584', [side * 0.47, 0.18, 0.15], 0.15, [1, 0.45, 0.15]);
    const horn = cylinder(head, '#dfc398', [side * 0.28, 0.5, -0.02], 0.035, 0.1, 0.25);
    horn.rotation.z = -side * 0.24;
  });
  face(head, { width: 0.2, y: 0.1, z: 0.39, smile: false });
  sphere(head, '#dfa191', [0, -0.17, 0.43], 0.37, [1.08, 0.61, 0.51], { roughness: 0.57 });
  [-1, 1].forEach((side) => sphere(head, '#a36558', [side * 0.15, -0.145, 0.604], 0.028, [1, 0.8, 0.5]));
  pathTube(g, [[-0.77, 1.2, -0.06], [-1.1, 1.25, -0.05], [-1.17, 0.9, 0.04]], '#dfd2b7', 0.036);
  sphere(g, '#697263', [-1.17, 0.88, 0.04], 0.07, [1, 1.6, 1]);
  return g;
}
function duck(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'duck');
  sphere(g, '#e8c36a', [0, 0.7, 0], 0.72, [1.1, 0.75, 0.78], { clearcoat: 0.3 });
  sphere(g, '#f0cb6c', [0.4, 1.44, 0.22], 0.49, [1, 1.08, 0.9]);
  sphere(g, '#dfbe67', [-0.18, 0.8, 0.58], 0.45, [1.14, 0.62, 0.18]);
  sphere(g, '#df985e', [0.47, 1.28, 0.68], 0.31, [1.07, 0.34, 1.05], { roughness: 0.5 });
  [-1, 1].forEach((side) => sphere(g, palette.dark, [0.4 + side * 0.22, 1.53, 0.61], 0.046));
  [-0.29, 0.31].forEach((x) => sphere(g, '#d89a65', [x, 0.19, 0.27], 0.25, [0.9, 0.24, 1.5]));
  return g;
}
function dog(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'dog');
  sphere(g, '#c39b72', [0, 0.75, 0], 0.69, [1.09, 0.87, 0.65], { roughness: 0.75 });
  [-0.46, 0.46].forEach((x) => [-0.28, 0.28].forEach((z) => sphere(g, '#c9a47f', [x, 0.29, z], 0.18, [1, 1.45, 1.13])));
  const head = group(g, [0.38, 1.51, 0.12]);
  sphere(head, '#dbb58a', [0, 0, 0], 0.52, [1, 1.01, 0.88], { roughness: 0.75 });
  [-1, 1].forEach((side) => {
    const ear = sphere(head, '#917254', [side * 0.44, -0.04, 0], 0.26, [0.72, 1.75, 0.7], { roughness: 0.8 });
    ear.rotation.z = side * 0.18;
  });
  face(head, { width: 0.2, y: 0.1, z: 0.43, smile: false });
  sphere(head, '#ebceaa', [0, -0.16, 0.43], 0.3, [1.1, 0.65, 0.61]);
  sphere(head, palette.dark, [0, -0.1, 0.62], 0.082, [1.2, 0.8, 0.65]);
  pathTube(g, [[-0.68, 0.8, -0.2], [-1.0, 1, -0.2], [-1.1, 1.35, -0.1]], '#ab815c', 0.074);
  return g;
}
// New toys for this version: a cat, a pig and a lamb, built from the same parts.
function cat(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'cat');
  const fur = '#e2ae78';
  const cream = '#f6e4c8';
  sphere(g, fur, [0, 0.78, 0], 0.62, [1.12, 0.82, 0.66], { roughness: 0.78 });
  sphere(g, cream, [0.2, 0.74, 0.34], 0.34, [1.1, 0.9, 0.3], { roughness: 0.8 });
  [-0.42, 0.42].forEach((x) => [-0.25, 0.25].forEach((z) => sphere(g, cream, [x, 0.2, z], 0.17, [1, 1.2, 1.25], { roughness: 0.8 })));
  const head = group(g, [0.46, 1.42, 0.14]);
  sphere(head, fur, [0, 0, 0], 0.46, [1.05, 0.95, 0.9], { roughness: 0.78 });
  [-1, 1].forEach((side) => {
    const ear = cylinder(head, fur, [side * 0.26, 0.42, -0.02], 0, 0.15, 0.28, { roughness: 0.78 });
    ear.rotation.z = -side * 0.3;
    const inner = cylinder(head, '#e7a89a', [side * 0.255, 0.4, 0.04], 0, 0.09, 0.18, { roughness: 0.8 });
    inner.rotation.z = -side * 0.3;
  });
  face(head, { width: 0.17, y: 0.06, z: 0.38, smile: false });
  sphere(head, cream, [0, -0.12, 0.34], 0.2, [1.2, 0.7, 0.5], { roughness: 0.8 });
  sphere(head, '#d98c80', [0, -0.06, 0.44], 0.045, [1.3, 0.8, 0.6]);
  [-1, 1].forEach((side) =>
    [0, 1].forEach((k) => pathTube(head, [[side * 0.12, -0.1 + k * 0.05, 0.42], [side * 0.3, -0.08 + k * 0.06, 0.43], [side * 0.46, -0.1 + k * 0.09, 0.38]], '#8a7a66', 0.007))
  );
  pathTube(g, [[-0.66, 0.85, -0.1], [-1.0, 0.95, -0.15], [-1.05, 1.35, -0.05], [-0.92, 1.6, 0.02]], fur, 0.07);
  sphere(g, '#c98e58', [-0.92, 1.6, 0.02], 0.075);
  return g;
}
function pig(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'pig');
  const skin = '#eeb2a4';
  const deep = '#d98f84';
  sphere(g, skin, [0, 0.86, 0], 0.72, [1.18, 0.86, 0.8], { roughness: 0.6 });
  [-0.46, 0.46].forEach((x) =>
    [-0.3, 0.3].forEach((z) => {
      cylinder(g, skin, [x, 0.3, z], 0.14, 0.13, 0.5, { roughness: 0.6 });
      cylinder(g, '#8d6a5f', [x, 0.06, z], 0.135, 0.14, 0.1);
    })
  );
  const head = group(g, [0.62, 1.3, 0.16]);
  sphere(head, skin, [0, 0, 0], 0.5, [1, 0.95, 0.92], { roughness: 0.6 });
  [-1, 1].forEach((side) => {
    const ear = sphere(head, deep, [side * 0.32, 0.4, 0], 0.17, [1, 0.45, 0.7]);
    ear.rotation.z = side * 0.55;
    ear.rotation.x = 0.4;
  });
  face(head, { width: 0.19, y: 0.12, z: 0.4, smile: false });
  const snout = cylinder(head, deep, [0, -0.1, 0.44], 0.17, 0.17, 0.14, { roughness: 0.5 });
  snout.rotation.x = Math.PI / 2;
  [-1, 1].forEach((side) => sphere(head, '#9a5b54', [side * 0.06, -0.1, 0.515], 0.035, [1, 1.3, 0.5]));
  pathTube(g, [[-0.82, 1.0, 0], [-0.98, 1.08, 0.06], [-0.94, 1.2, -0.04], [-1.04, 1.24, 0.02]], deep, 0.03);
  return g;
}
function lamb(parent, position = [0, 0, 0], scale = 1) {
  const g = group(parent, position, scale, 'lamb');
  const wool = material('#fbf7ec', { roughness: 0.92, clearcoat: 0 });
  [[0, 1.0, 0, 0.62, [1.25, 0.9, 0.85]], [-0.45, 1.12, 0.1, 0.38], [0.35, 1.18, 0.12, 0.36], [-0.2, 1.3, -0.15, 0.36], [0.2, 1.28, -0.2, 0.34], [-0.62, 0.98, -0.05, 0.3], [0.5, 0.95, -0.1, 0.32]].forEach(([x, y, z, r, s]) =>
    sphereWith(g, wool, [x, y, z], r, s || [1, 1, 1])
  );
  [-0.42, 0.42].forEach((x) =>
    [-0.26, 0.26].forEach((z) => {
      cylinder(g, '#5d524a', [x, 0.4, z], 0.085, 0.075, 0.62);
      sphere(g, '#4a413b', [x, 0.1, z + 0.03], 0.1, [1, 0.6, 1.25]);
    })
  );
  const head = group(g, [0.72, 1.45, 0.18]);
  sphere(head, '#efe3d2', [0, 0, 0], 0.36, [0.95, 1.05, 0.9], { roughness: 0.75 });
  sphereWith(head, wool, [-0.05, 0.28, -0.02], 0.24, [1.1, 0.7, 1]);
  [-1, 1].forEach((side) => {
    const ear = sphere(head, '#e6d3bd', [side * 0.36, 0.08, -0.02], 0.16, [1.2, 0.45, 0.6]);
    ear.rotation.z = -side * 0.35;
  });
  face(head, { width: 0.14, y: 0.05, z: 0.3 });
  sphere(head, '#e3a79a', [0, -0.08, 0.32], 0.06, [1.3, 0.8, 0.6]);
  sphereWith(g, wool, [-0.85, 1.12, 0], 0.16);
  return g;
}
function teddy(parent, selected = 'nose', { sleepy = false } = {}) {
  const g = group(parent, [0, 0, 0], 1, 'body');
  const fur = material('#fff2d8', { map: plushTexture(), roughness: 1, clearcoat: 0 });
  const part = (pos, r, scale, action, mat = fur) => {
    const m = sphereWith(g, mat, pos, r, scale);
    if (action) m.userData.action = action;
    if (action && action === selected) {
      // The chosen body part glows a little. The clone is this scene's own and is freed with it.
      m.material = mat.clone();
      m.material.emissive = new THREE.Color('#a97831');
      m.material.emissiveIntensity = 0.14;
      m.material.userData.transient = true;
    }
    return m;
  };
  part([0, 1.03, 0], 0.68, [0.91, 1.05, 0.69]);
  part([0, 0.99, 0.438], 0.48, [0.76, 0.9, 0.09], null, material('#f3e4c5', { roughness: 1 }));
  part([0, 1.99, 0], 0.67, [1, 1, 0.79]);
  [-1, 1].forEach((side) => {
    part([side * 0.49, 2.46, 0], 0.245, [1, 1, 0.68]);
    part([side * 0.49, 2.47, 0.16], 0.158, [1, 1, 0.23], null, material('#c5a882', { roughness: 0.9 }));
  });
  [-1, 1].forEach((side) => {
    const hand = part([side * 0.71, 1.0, 0.06], 0.23, [0.83, 1.76, 1], 'hands');
    hand.rotation.z = -side * 0.18;
    part([side * 0.36, 0.32, 0.23], 0.28, [0.99, 0.7, 1.46], 'feet');
    part([side * 0.36, 0.3, 0.577], 0.18, [0.82, 0.68, 0.23], 'feet', material('#c8ac85', { roughness: 0.9 }));
    if (sleepy) part([side * 0.22, 2.07, 0.52], 0.06, [1.05, 0.28, 0.69], 'eyes', material('#3d4438', { roughness: 0.35 }));
    else part([side * 0.22, 2.09, 0.5], 0.06, [0.85, 1, 0.69], 'eyes', material('#3d4438', { roughness: 0.35 }));
  });
  part([0, 1.86, 0.51], 0.25, [1.24, 0.83, 0.4], null, material('#f1dbb5', { roughness: 1 }));
  part([0, 1.91, 0.618], 0.082, [1.28, 0.76, 0.6], 'nose', material('#6d6654', { roughness: 0.65 }));
  pathTube(g, [[0, 1.9, 0.63], [0, 1.8, 0.621], [-0.09, 1.8, 0.596]], '#84725d', 0.016);
  pathTube(g, [[0, 1.8, 0.621], [0.05, 1.775, 0.605], [0.09, 1.8, 0.596]], '#84725d', 0.016);
  const scarf = mesh(geo('scarf', () => new THREE.TorusGeometry(0.35, 0.075, 10, 44)), material('#94a984', { roughness: 0.95 }), g, [0, 1.52, 0]);
  scarf.rotation.x = Math.PI / 2;
  return g;
}
function moon(parent, position, radius = 0.5) {
  const g = group(parent, position, 1, 'moon');
  const depth = radius * 0.3;
  const geometry = geo(`moon:${radius}`, () => {
    // A crescent: the left half of a circle, cut by a larger circle's arc.
    const s = new THREE.Shape();
    s.absarc(0, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
    s.absarc(1.2536 * radius, 0, 1.6036 * radius, -2.4683, 2.4683, true);
    const e = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: radius * 0.1, bevelSize: radius * 0.08, bevelSegments: 4, curveSegments: 24 });
    e.translate(0, 0, -depth / 2);
    return e;
  });
  mesh(geometry, material('#ecd27a', { roughness: 0.4, clearcoat: 0.4 }), g);
  const zf = depth / 2 + radius * 0.1 + 0.006;
  pathTube(g, [[-0.86 * radius, 0.16 * radius, zf], [-0.76 * radius, 0.1 * radius, zf + 0.004], [-0.66 * radius, 0.16 * radius, zf]], palette.dark, 0.012);
  sphere(g, '#e7a275', [-0.76 * radius, -0.1 * radius, zf - 0.004], radius * 0.07, [1, 0.64, 0.2]);
  return g;
}
function bell(parent, position, scale = 1) {
  const g = group(parent, position, scale, 'bell');
  const shell = geo('bell', () =>
    new THREE.LatheGeometry(
      [[0.3, -0.53], [0.29, -0.47], [0.23, -0.37], [0.19, -0.23], [0.17, -0.11], [0.11, -0.03], [0.001, 0]].map(([x, y]) => new THREE.Vector2(x, y)),
      32
    )
  );
  mesh(shell, material('#e0b75a', { roughness: 0.35, metalness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }), g);
  sphere(g, '#8a6a4f', [0, -0.5, 0], 0.06);
  return g;
}

/* Small toys for the letter page: "A is for apple" shows an apple, and so on. */
const TOYS = {
  apple: (g) => apple(g, [0, 0.35, 0], 0.35),
  ball: (g) => {
    sphere(g, '#9db699', [0, 0.32, 0], 0.32, [1, 1, 1], { roughness: 0.3, clearcoat: 0.7 });
    const stripe = mesh(geo('ballstripe', () => new THREE.TorusGeometry(0.322, 0.022, 10, 64)), material('#fff3d7', { roughness: 0.4 }), g, [0, 0.32, 0]);
    stripe.rotation.x = 0.6;
  },
  cat: (g) => cat(g, [0, 0, 0], 0.42),
  dog: (g) => dog(g, [0, 0, 0], 0.42),
  egg: (g) => {
    cylinder(g, '#9fb4a0', [0, 0.1, 0], 0.17, 0.11, 0.2, { roughness: 0.5 });
    sphere(g, '#fbf1dc', [0, 0.4, 0], 0.24, [0.82, 1.1, 0.82], { roughness: 0.35, clearcoat: 0.4 });
  },
  fish: (g, w) => {
    const f = group(g, [0, 0.45, 0]);
    sphere(f, '#e5a45f', [0, 0, 0], 0.3, [1.25, 0.78, 0.5], { roughness: 0.4, clearcoat: 0.5 });
    const tail = geo('fishtail', () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(-0.26, 0.2);
      s.quadraticCurveTo(-0.2, 0, -0.26, -0.2);
      s.closePath();
      const e = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
      e.translate(0, 0, -0.03);
      return e;
    });
    mesh(tail, material('#d98a4f', { roughness: 0.45 }), f, [-0.33, 0, 0]);
    sphere(f, '#fff9e8', [0.2, 0.05, 0.13], 0.06, [1, 1, 0.5]);
    sphere(f, palette.dark, [0.215, 0.055, 0.155], 0.035, [1, 1, 0.5]);
    const fin = sphere(f, '#d98a4f', [-0.02, 0.2, 0], 0.12, [1, 0.5, 0.2]);
    fin.rotation.z = -0.3;
    cylinder(g, '#a1c7cb', [0, 0.02, 0], 0.36, 0.38, 0.04, { roughness: 0.2, clearcoat: 0.6 });
    w.float(f, 0.05, 1);
  },
  hat: (g) => {
    cylinder(g, '#c9876f', [0, 0.03, 0], 0.46, 0.46, 0.05, { roughness: 0.8, clearcoat: 0 });
    cylinder(g, '#c9876f', [0, 0.24, 0], 0.25, 0.28, 0.38, { roughness: 0.8, clearcoat: 0 });
    cylinder(g, '#f3e3b8', [0, 0.1, 0], 0.285, 0.29, 0.08, { roughness: 0.7 });
    sphere(g, '#e9bf58', [0.2, 0.1, 0.2], 0.06, [1, 1, 0.5]);
  },
  'ice cream': (g) => {
    cylinder(g, '#d9b074', [0, 0.24, 0], 0.17, 0.02, 0.46, { roughness: 0.7, clearcoat: 0 });
    sphere(g, '#f0b5c0', [0, 0.52, 0], 0.2, [1, 0.92, 1], { roughness: 0.5 });
    sphere(g, '#fff4e0', [0, 0.68, 0], 0.14, [1, 0.85, 1], { roughness: 0.5 });
    sphere(g, '#c8463f', [0, 0.82, 0], 0.05, [1, 1, 1], { roughness: 0.2, clearcoat: 0.8 });
  },
  jam: (g) => {
    cylinder(g, '#c45a58', [0, 0.24, 0], 0.2, 0.2, 0.46, { roughness: 0.2, clearcoat: 0.8 });
    cylinder(g, '#fff4d9', [0, 0.24, 0], 0.205, 0.205, 0.18, { roughness: 0.8, clearcoat: 0 });
    cylinder(g, '#e9bf58', [0, 0.5, 0], 0.22, 0.22, 0.07, { roughness: 0.5 });
    sphere(g, '#c45a58', [0.03, 0.24, 0.2], 0.06, [1, 1, 0.3]);
  },
  kite: (g, w) => {
    const k = group(g, [0, 0.95, 0]);
    k.rotation.z = 0.25;
    const sail = geo('kite', () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0.42);
      s.lineTo(0.28, 0.05);
      s.lineTo(0, -0.46);
      s.lineTo(-0.28, 0.05);
      s.closePath();
      const e = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.015, bevelSegments: 2 });
      e.translate(0, 0, -0.015);
      return e;
    });
    mesh(sail, material('#d8927d', { roughness: 0.6 }), k);
    pathTube(k, [[0, 0.42, 0.04], [0, -0.46, 0.04]], '#fff4d9', 0.012);
    pathTube(k, [[-0.28, 0.05, 0.04], [0.28, 0.05, 0.04]], '#fff4d9', 0.012);
    pathTube(k, [[0, -0.46, 0], [0.08, -0.62, 0], [-0.05, -0.78, 0], [0.06, -0.92, 0]], '#8a7a66', 0.01);
    [[0.08, -0.62, 0], [-0.05, -0.78, 0]].forEach((p) => sphere(k, '#e9bf58', p, 0.04, [1.4, 0.7, 0.7]));
    w.float(k, 0.06, 2);
  },
  leaf: (g) => {
    leaf(g, [0, 0.14, 0], 0.45, '#7f9f5e');
    pathTube(g, [[0.3, 0.2, 0], [0.45, 0.22, 0], [0.55, 0.28, 0]], '#6b7f45', 0.018);
  },
  moon: (g, w) => {
    const m = moon(g, [0.1, 0.62, 0], 0.34);
    w.float(m, 0.05, 1);
    star(g, [0.38, 0.98, 0], 0.09, '#dfb968', false);
  },
  orange: (g) => {
    sphere(g, '#e8963f', [0, 0.31, 0], 0.31, [1, 0.94, 1], { roughness: 0.62, clearcoat: 0.2 });
    cylinder(g, '#77543d', [0, 0.62, 0], 0.018, 0.024, 0.08);
    leaf(g, [0.1, 0.64, 0], 0.13, '#748f4c');
  },
  pig: (g) => pig(g, [0, 0, 0], 0.42),
  quilt: (g) => {
    const patchwork = { map: quiltTexture(), roughness: 0.95, clearcoat: 0 };
    box(g, '#ffffff', [0, 0.07, 0], [0.95, 0.12, 0.72], patchwork);
    box(g, '#ffffff', [0.05, 0.19, -0.04], [0.8, 0.1, 0.6], patchwork);
  },
  rainbow: (g) => {
    rainbow(g, [0, 0.05, 0], 0.36);
    cloud(g, [-0.38, 0.1, 0.05], 0.25);
    cloud(g, [0.38, 0.1, 0.05], 0.25);
  },
  star: (g, w) => w.float(star(g, [0, 0.45, 0], 0.3, palette.yellow, true), 0.05, 0),
  tree: (g) => tree(g, [0, 0, 0], 0.62),
  umbrella: (g) => {
    const u = group(g);
    u.rotation.z = 0.12;
    mesh(geo('dome', () => new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)), material('#c8736a', { roughness: 0.55, side: THREE.DoubleSide }), u, [0, 0.62, 0], [0.46, 0.28, 0.46]);
    cylinder(u, '#8a6a4f', [0, 0.38, 0], 0.016, 0.016, 0.58);
    sphere(u, '#e9bf58', [0, 0.91, 0], 0.035);
    pathTube(u, [[0, 0.1, 0], [0, 0.04, 0], [0.05, -0.01, 0], [0.1, 0.03, 0]], '#8a6a4f', 0.02);
  },
  van: (g) => {
    box(g, '#80a3a6', [0, 0.36, 0], [0.95, 0.42, 0.52]);
    box(g, '#80a3a6', [-0.08, 0.64, 0], [0.66, 0.26, 0.5]);
    box(g, '#e8f1f0', [-0.08, 0.65, 0.255], [0.54, 0.16, 0.02], { roughness: 0.15, clearcoat: 0.9 });
    [[-0.3, 0.24], [0.3, 0.24], [-0.3, -0.24], [0.3, -0.24]].forEach(([x, z]) => {
      const wheel = cylinder(g, '#3f4a44', [x, 0.14, z], 0.13, 0.13, 0.08, { roughness: 0.7 });
      wheel.rotation.x = Math.PI / 2;
    });
    sphere(g, '#f3dc8c', [0.47, 0.34, 0.18], 0.045, [0.5, 1, 1]);
  },
  water: (g) => {
    const drop = { roughness: 0.12, clearcoat: 1 };
    sphere(g, '#8dbfd0', [0, 0.27, 0], 0.24, [1, 1, 1], drop);
    cylinder(g, '#8dbfd0', [0, 0.58, 0], 0, 0.205, 0.36, drop);
    [-1, 1].forEach((side) => sphere(g, palette.dark, [side * 0.075, 0.31, 0.215], 0.035, [0.83, 1.2, 0.75], { roughness: 0.23, clearcoat: 0.8 }));
    pathTube(g, [[-0.06, 0.22, 0.225], [0, 0.19, 0.232], [0.06, 0.22, 0.225]], palette.dark, 0.01);
  },
  xylophone: (g) => {
    box(g, '#b98f63', [0, 0.06, -0.13], [1.0, 0.08, 0.07]);
    box(g, '#b98f63', [0, 0.06, 0.13], [0.8, 0.08, 0.07]);
    ['#d3937c', '#e0ba74', '#bbc391', '#93b2a0', '#9d8fb8'].forEach((hex, i) => box(g, hex, [-0.4 + i * 0.2, 0.14, 0], [0.16, 0.06, 0.56 - i * 0.06], { roughness: 0.45, clearcoat: 0.4 }));
    const stick = cylinder(g, '#d9b687', [0.3, 0.2, 0.34], 0.014, 0.014, 0.44);
    stick.rotation.z = Math.PI / 2;
    sphere(g, '#d8927d', [0.08, 0.2, 0.34], 0.05);
  },
  yogurt: (g) => {
    cylinder(g, '#fdf7ea', [0, 0.2, 0], 0.21, 0.16, 0.4, { roughness: 0.4, clearcoat: 0.3 });
    cylinder(g, '#c9a4d6', [0, 0.2, 0], 0.197, 0.19, 0.12, { roughness: 0.6 });
    sphere(g, '#f6dde9', [0, 0.42, 0], 0.17, [1, 0.5, 1], { roughness: 0.5 });
    sphere(g, '#c8463f', [0.04, 0.5, 0.02], 0.045, [1, 1, 1], { roughness: 0.2, clearcoat: 0.8 });
  },
};

const ANIMALS = { cow, duck, dog, cat, pig, lamb };

/* ------------------------------------------------------------------ the world */

const easeOutBack = (p) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

export class World {
  /**
   * @param {object} kit       from boot(); the canvas lives in kit's mount
   * @param {object} opts
   * @param {(action: string) => void} opts.onTap  a toy (or the stage) was tapped
   */
  constructor(kit, { onTap = () => {} } = {}) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.onTap = onTap;
    this._calm = false;
    this.dirty = true;
    this.resetMotion = false;

    const r = this.renderer;
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.88;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    this.camera.position.set(4.2, 4.1, 8.7);
    this.camera.lookAt(0, 1.35, 0);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.moving = [];
    this.bounces = [];
    this.rootScale = 1;

    // Light units and colours from the r140 original: legacy intensities × π, colours linear.
    this.key = new THREE.DirectionalLight(linear(0xfff4d9), 1.7 * Math.PI);
    this.key.position.set(-3.5, 7, 5);
    this.key.castShadow = true;
    Object.assign(this.key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -4, near: 0.5, far: 20 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.024;
    this.key.shadow.radius = 3;
    kit.shadow(this.key, 2048); // 2048 on high, 1024 on phones, 512 on low
    this.scene.add(this.key);
    this.scene.add(new THREE.HemisphereLight(linear(0xfff9e6), linear(0x94a580), 0.6 * Math.PI));
    const rim = new THREE.DirectionalLight(linear(0xf3f9ff), 0.7 * Math.PI);
    rim.position.set(3, 4, -4);
    this.scene.add(rim);

    // Local studio-light environment gives painted surfaces soft, broad reflections.
    const room = new THREE.Scene();
    room.background = new THREE.Color(0.55, 0.55, 0.51);
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.8, 1.65) });
    [[-4, 5, 2, 5, 5, 1], [3, 4, -2, 3, 4, 1], [0, 7, 0, 7, 0.2, 7]].forEach(([x, y, z, w, h, d]) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
      panel.position.set(x, y, z);
      room.add(panel);
    });
    this.pmrem = new THREE.PMREMGenerator(r);
    this.env = this.pmrem.fromScene(room, 0.08, 0.1, 30);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.55; // was envMapIntensity on every material
    room.traverse((o) => o.geometry?.dispose());
    panelMat.dispose();

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.hits = [];
    this.down = null;
    this.cancelled = false;
    // A finger that starts scrolling the page (touch-action: pan-y) is not a tap.
    kit.canvas.addEventListener('pointercancel', () => (this.cancelled = true));

    this.lastW = 0;
    this.lastH = 0;
    kit.onResize((w, h) => {
      this.camera.aspect = w / h;
      // Widen the field of view for narrow screens instead of cropping objects.
      this.camera.fov = this.camera.aspect < 0.95 ? 41 : this.camera.aspect < 1.3 ? 36 : 33;
      this.camera.updateProjectionMatrix();
      this.dirty = true;
    });

    this.#initConfetti();
  }

  get calm() {
    return this._calm;
  }
  set calm(value) {
    value = Boolean(value);
    if (value === this._calm) return;
    this._calm = value;
    this.resetMotion = true;
    this.dirty = true;
  }

  /* ---------------------------------------------------------------- scenes */

  clear() {
    this.root.traverse((o) => {
      if (o.material?.userData?.transient) o.material.dispose();
    });
    this.root.clear();
    this.root.rotation.set(0, 0, 0);
    this.moving.length = 0;
    this.bounces.length = 0;
    this.newApple = null;
  }

  float(obj, amp = 0.06, phase = 0, type = 'float') {
    this.moving.push({ obj, y: obj.position.y, rot: obj.rotation.z, amp, phase, type });
    return obj;
  }

  flower(position, scale = 0.15, parent = this.root) {
    return flower(parent, position, scale);
  }

  base({ grass = true, water = false, radius = 2.4 } = {}) {
    const wood = material('#fff5dc', { map: woodTexture(), roughness: 0.64, clearcoat: 0.1 });
    mesh(geo(`base:${radius}`, () => new THREE.CylinderGeometry(radius, radius * 0.96, 0.23, 96)), wood, this.root, [0, 0.1, 0]);
    cylinder(this.root, water ? '#a1c7cb' : grass ? '#b9c797' : '#e8d7b5', [0, 0.253, 0], radius * 0.97, radius * 0.97, 0.09, { roughness: 0.83, clearcoat: water ? 0.35 : 0 });
    const blob = mesh(geo(`plane:${radius * 2.6}`, () => new THREE.PlaneGeometry(radius * 2.6, radius * 2.6)), decal(shadowTexture(), true), this.root, [0, -0.035, 0]);
    blob.rotation.x = -Math.PI / 2;
    blob.castShadow = false;
  }

  garden() {
    this.base({ radius: 2.45 });
    const arc = rainbow(this.root, [0.77, 0.76, -0.68]);
    arc.rotation.y = -0.04;
    cloud(this.root, [1.98, 0.68, -0.54], 0.53);
    cloud(this.root, [-0.39, 0.65, -0.73], 0.5);
    this.float(star(this.root, [0.05, 2.36, 0.26], 0.99), 0.08, 0);
    tree(this.root, [-1.56, 0.31, -0.17], 0.82);
    const b1 = block(this.root, 'A', '#c88f79', [-0.6, 0.64, 1.12], 0.61, -0.11);
    block(this.root, 'B', '#a7b995', [0.06, 0.58, 1.39], 0.52, 0.13);
    block(this.root, 'C', '#d4bc78', [0.71, 0.58, 1.18], 0.52, -0.1);
    this.float(star(this.root, [-1.55, 2.17, 0.24], 0.23, '#dfb968', false), 0.07, 2);
    this.float(cloud(this.root, [1.39, 3.1, -0.62], 0.52), 0.055, 4);
    this.flower([-1.16, 0.33, 0.88], 0.14);
    this.flower([1.61, 0.33, 0.39], 0.14);
    this.flower([1.24, 0.33, 1.13], 0.11);
    b1.userData.action = 'star';
  }

  boat() {
    this.base({ water: true, radius: 2.3 });
    const g = group(this.root, [0, 0.73, 0], 1, 'boat');
    g.rotation.y = -0.15;
    const hull = geo('hull', () => {
      const s = new THREE.Shape();
      s.moveTo(-1.3, 0.18);
      s.bezierCurveTo(-1.12, -0.54, 0.93, -0.54, 1.31, 0.18);
      s.lineTo(-1.3, 0.18);
      return new THREE.ExtrudeGeometry(s, { depth: 0.67, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, steps: 1 });
    });
    mesh(hull, material('#cc9175', { roughness: 0.55 }), g, [0, 0, -0.38]);
    box(g, '#fff2d3', [0, 0.22, 0], [2.49, 0.12, 0.86]);
    cylinder(g, '#ba966c', [0, 1.25, 0], 0.038, 0.048, 2.13);
    const sail = geo('sail', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.075, 0.6);
      s.lineTo(-0.075, 2.12);
      s.quadraticCurveTo(-0.45, 1.37, -1.13, 0.6);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.025, bevelSegments: 3 });
    });
    mesh(sail, material('#fbf3da', { roughness: 0.95, clearcoat: 0 }), g, [0, 0, 0.1]);
    const sail2 = geo('sail2', () => {
      const s = new THREE.Shape();
      s.moveTo(0.09, 0.6);
      s.lineTo(0.09, 1.92);
      s.quadraticCurveTo(0.58, 1.08, 1.04, 0.6);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelSize: 0.027, bevelThickness: 0.02, bevelSegments: 3 });
    });
    mesh(sail2, material('#8eab99', { roughness: 0.88, clearcoat: 0 }), g, [0, 0, 0.1]);
    this.float(g, 0.045, 0, 'boat');
    for (let i = 0; i < 3; i++) {
      const ring = mesh(geo(`ripple:${i}`, () => new THREE.TorusGeometry(0.85 + i * 0.46, 0.013, 6, 72)), material('#d0e4d9', { roughness: 0.9 }), this.root, [0, 0.319, 0]);
      ring.rotation.x = Math.PI / 2;
      ring.scale.y = 0.7;
      ring.castShadow = false;
    }
    this.float(cloud(this.root, [-1.5, 2.43, -0.8], 0.65), 0.04, 3);
    this.float(cloud(this.root, [1.55, 2.9, -0.5], 0.44), 0.04, 1);
  }

  /** Mary had a little lamb: the lamb in a meadow by a fence. */
  meadow() {
    this.base({ radius: 2.4 });
    const fence = group(this.root, [0, 0.3, -1.25]);
    for (let x = -1.6; x <= 1.61; x += 0.8) cylinder(fence, '#d9b687', [x, 0.3, 0], 0.05, 0.06, 0.6, { roughness: 0.7 });
    box(fence, '#e3c79a', [0, 0.42, 0], [3.4, 0.07, 0.05], { roughness: 0.7 });
    box(fence, '#e3c79a', [0, 0.22, 0], [3.4, 0.07, 0.05], { roughness: 0.7 });
    tree(this.root, [-1.7, 0.31, -0.4], 0.7);
    const l = lamb(this.root, [0.1, 0.31, 0.2], 0.95);
    l.rotation.y = 0.15;
    this.float(l, 0.1, 0, 'hop');
    [[-1.1, 0.33, 0.95, 0.14], [1.4, 0.33, 0.7, 0.13], [0.95, 0.33, 1.3, 0.11], [-0.4, 0.33, 1.5, 0.12]].forEach(([x, y, z, s]) => this.flower([x, y, z], s));
    this.float(cloud(this.root, [1.3, 2.9, -0.7], 0.5), 0.05, 2);
    this.float(cloud(this.root, [-1.2, 2.6, -0.9], 0.4), 0.04, 4);
  }

  /** Are you sleeping: a sleepy teddy in bed under the moon, with the morning bell. */
  bedtime() {
    this.base({ grass: false, radius: 2.35 });
    const bed = group(this.root, [-0.25, 0.3, 0.1], 1, 'bed');
    bed.rotation.y = 0.08;
    box(bed, '#d9b687', [0, 0.16, 0], [2.1, 0.24, 1.2], { roughness: 0.65 });
    box(bed, '#d9b687', [-1.02, 0.45, 0], [0.16, 0.8, 1.25], { roughness: 0.65 });
    box(bed, '#d9b687', [1.02, 0.3, 0], [0.14, 0.5, 1.2], { roughness: 0.65 });
    box(bed, '#fff2d3', [0, 0.34, 0], [1.95, 0.16, 1.1], { roughness: 0.9, clearcoat: 0 });
    box(bed, '#f1e6cc', [-0.72, 0.48, 0], [0.42, 0.14, 0.72], { roughness: 0.95, clearcoat: 0 });
    const bear = teddy(bed, null, { sleepy: true });
    bear.position.set(0.3, 0.52, 0);
    bear.rotation.z = Math.PI / 2;
    bear.scale.setScalar(0.42);
    box(bed, '#9fb4c9', [0.28, 0.46, 0], [1.3, 0.12, 1.14], { roughness: 0.9, clearcoat: 0 });
    this.float(moon(this.root, [1.2, 2.55, -0.5], 0.55), 0.06, 0);
    this.float(star(this.root, [-1.35, 2.35, -0.5], 0.17, '#dfb968', false), 0.07, 2);
    this.float(star(this.root, [0.15, 3.0, -0.9], 0.12, '#dfb968', false), 0.06, 4);
    this.float(star(this.root, [1.95, 1.75, -0.9], 0.1, '#dfb968', false), 0.05, 1);
    const stand = group(this.root, [1.55, 0.3, 0.75], 1, 'bell');
    [-0.32, 0.32].forEach((x) => cylinder(stand, '#c9a57a', [x, 0.48, 0], 0.035, 0.045, 0.96, { roughness: 0.7 }));
    const bar = cylinder(stand, '#c9a57a', [0, 0.96, 0], 0.03, 0.03, 0.74, { roughness: 0.7 });
    bar.rotation.z = Math.PI / 2;
    this.float(bell(stand, [0, 0.94, 0], 0.72), 0.22, 0, 'swing');
  }

  letterToy(word) {
    const g = group(this.root, [-1.27, 0.3, 0.95]);
    g.rotation.y = 0.35;
    const build = TOYS[word];
    if (build) build(g, this);
    else this.flower([0, 0.03, 0], 0.17, g);
    // One tap target for the whole toy: say its word.
    g.traverse((o) => {
      if (o !== g) delete o.userData.action;
    });
    g.userData.action = 'word';
    return g;
  }

  set(kind, data = {}) {
    const sameKind = kind === this.kind && (kind === 'count' || kind === 'body');
    this.clear();
    this.kind = kind;
    this.data = data;
    this.camera.position.set(4.2, 4.1, 8.7);
    this.camera.lookAt(0, 1.35, 0);
    if (kind === 'garden' || kind === 'star') this.garden();
    else if (kind === 'boat') this.boat();
    else if (kind === 'meadow') this.meadow();
    else if (kind === 'bedtime') this.bedtime();
    else if (kind === 'abc') {
      this.base();
      block(this.root, 'A', '#c88f79', [-0.96, 0.99, 0.08], 1.3, -0.15);
      block(this.root, 'B', '#9cac87', [0.59, 0.9, 0.29], 1.14, 0.15);
      block(this.root, 'C', '#d3ba73', [0.41, 1.98, -0.04], 0.99, -0.1);
      this.float(star(this.root, [-1.42, 2.49, -0.18], 0.28, '#dfbd68', false), 0.07, 1);
      tree(this.root, [1.63, 0.3, -0.63], 0.66);
      this.flower([-1.5, 0.33, 1], 0.15);
    } else if (kind === 'letter') {
      this.base({ radius: 2.16 });
      const letter = data.letter || 'A';
      block(this.root, letter, ['#c98f76', '#93a57c', '#c9ac62', '#80a3a6'][(data.index || 0) % 4], [-0.3, 1.22, 0], 1.73, -0.06);
      block(this.root, letter.toLowerCase(), '#e0c494', [1.0, 0.73, 0.45], 0.83, 0.12);
      this.letterToy(data.word || 'apple');
      leaf(this.root, [1.35, 0.34, -0.65], 0.35);
      this.float(cloud(this.root, [0.89, 2.88, -0.4], 0.45), 0.04, 2);
    } else if (kind === 'count') {
      this.base({ grass: false, radius: 2.34 });
      const rim = mesh(geo('tray-rim', () => new THREE.TorusGeometry(2.1, 0.055, 10, 96)), material('#c5ad84', { roughness: 0.7 }), this.root, [0, 0.337, 0]);
      rim.rotation.x = Math.PI / 2;
      const goal = data.goal || 3;
      const count = Math.max(0, Math.min(20, data.count || 0));
      const columns = goal > 10 ? 5 : goal > 5 ? 4 : 3;
      const size = goal > 10 ? 0.255 : goal > 5 ? 0.31 : 0.43;
      const spacing = goal > 10 ? 0.7 : goal > 5 ? 0.86 : 1.12;
      const rows = Math.ceil(goal / columns);
      for (let i = 0; i < count; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - (Math.min(columns, goal) - 1) / 2) * spacing;
        const z = (row - (rows - 1) / 2) * spacing;
        const a = apple(this.root, [x, 0.34 + size, z], size, i);
        if (i === count - 1 && data.grow) {
          a.userData.newAt = performance.now();
          this.newApple = a;
        }
      }
      this.camera.position.set(3.7, 5.5, 7.8);
      this.camera.lookAt(0, 0.45, 0);
    } else if (ANIMALS[kind]) {
      this.base({ radius: 2.22 });
      const animal = ANIMALS[kind](this.root, [0, 0.32, 0], 1.07);
      this.float(animal, 0.025, 0);
      tree(this.root, [-1.46, 0.31, -0.68], 0.85);
      tree(this.root, [1.47, 0.31, -0.92], 0.56);
      this.flower([-0.92, 0.33, 1.28], 0.16);
      this.flower([1.24, 0.33, 0.74], 0.12);
    } else if (kind === 'body') {
      this.base({ radius: 1.95 });
      const bear = teddy(this.root, data.part);
      bear.position.y = 0.31;
      this.float(bear, 0.016, 0);
      this.camera.position.set(2.0, 3.5, 8.4);
      this.camera.lookAt(0, 1.55, 0);
    } else if (kind === 'color') {
      this.base({ grass: false, radius: 2.1 });
      const ball = sphere(this.root, data.hex || '#cb6959', [0, 1.22, 0], 0.91, [1, 1, 1], { roughness: 0.27, clearcoat: 0.8, clearcoatRoughness: 0.2 });
      ball.userData.action = 'color';
      this.float(ball, 0.025, 0);
      const stripe = mesh(geo('ball-stripe', () => new THREE.TorusGeometry(0.904, 0.027, 10, 64)), material('#fff3d7', { roughness: 0.4 }), this.root, [0, 1.22, 0]);
      stripe.rotation.x = 0.65;
      stripe.rotation.y = -0.18;
      this.float(stripe, 0.025, 0);
      this.flower([1.31, 0.33, 0.85], 0.16);
    } else if (kind === 'shape') {
      this.base({ grass: false, radius: 2.1 });
      if (data.shape === 'cube') {
        const b = box(this.root, '#95ac84', [0, 1.05, 0], [1.48, 1.48, 1.48]);
        b.rotation.y = 0.2;
        b.userData.action = 'shape';
      } else if (data.shape === 'triangle') {
        const tri = geo('triangle', () => {
          const s = new THREE.Shape();
          s.moveTo(-0.9, 0);
          s.lineTo(0.9, 0);
          s.lineTo(0, 1.56);
          s.closePath();
          return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.075, bevelThickness: 0.08, bevelSegments: 4 });
        });
        mesh(tri, material('#dab66b'), this.root, [0, 0.41, -0.25]).userData.action = 'shape';
      } else sphere(this.root, '#83a8af', [0, 1.18, 0], 0.86, [1, 1, 1], { roughness: 0.35, clearcoat: 0.6 }).userData.action = 'shape';
    }
    this.pulseAt = 0;
    this.popAt = this._calm || sameKind ? 0 : performance.now();
    this.dirty = true;
  }

  /* ---------------------------------------------------------------- feedback */

  pulse() {
    if (!this._calm) this.pulseAt = performance.now();
  }

  /** Squash and stretch one toy. */
  bounce(obj) {
    if (this._calm || !obj || obj === this.newApple) return;
    let b = this.bounces.find((x) => x.obj === obj);
    if (!b) {
      b = { obj, base: obj.scale.clone(), t0: 0 };
      this.bounces.push(b);
    }
    b.t0 = performance.now();
  }

  #initConfetti() {
    const count = this.kit.detail(48, 16);
    const geometry = geo('confetti', () => {
      const e = new THREE.ExtrudeGeometry(starShape(0.085), { depth: 0.025, bevelEnabled: false, curveSegments: 4 });
      e.translate(0, 0, -0.0125);
      return e;
    });
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
    const confetti = new THREE.InstancedMesh(geometry, mat, count);
    confetti.frustumCulled = false;
    confetti.visible = false;
    const colors = ['#e9bf58', '#d8927d', '#8eab73', '#7eabb3', '#c9a4d6', '#f3e3b8'].map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) confetti.setColorAt(i, colors[i % colors.length]);
    confetti.instanceColor.needsUpdate = true;
    this.scene.add(confetti);
    this.confetti = {
      mesh: confetti,
      count,
      pos: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      rot: new Float32Array(count * 2),
      spin: new Float32Array(count * 2),
      age: 0,
      life: 1.9,
      active: false,
      dummy: new THREE.Object3D(),
    };
  }

  /** A little burst of stars for a finished moment. */
  celebrate() {
    if (this._calm) return;
    const c = this.confetti;
    for (let i = 0; i < c.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.7 + Math.random() * 1.5;
      c.pos[i * 3] = (Math.random() - 0.5) * 0.6;
      c.pos[i * 3 + 1] = 1.1 + Math.random() * 0.4;
      c.pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      c.vel[i * 3] = Math.cos(a) * s;
      c.vel[i * 3 + 1] = 2.8 + Math.random() * 2.2;
      c.vel[i * 3 + 2] = Math.sin(a) * s;
      c.rot[i * 2] = Math.random() * 6;
      c.rot[i * 2 + 1] = Math.random() * 6;
      c.spin[i * 2] = (Math.random() - 0.5) * 10;
      c.spin[i * 2 + 1] = (Math.random() - 0.5) * 10;
    }
    c.age = 0;
    c.active = true;
    c.mesh.visible = true;
  }

  /* ---------------------------------------------------------------- input */

  #pointer() {
    const p = this.kit.input.pointer;
    if (p.justDown) {
      this.down = { x: p.x, y: p.y, t: performance.now() };
      this.cancelled = false;
    }
    if (p.justUp && this.down) {
      const d = this.down;
      this.down = null;
      if (!this.cancelled && Math.hypot(p.x - d.x, p.y - d.y) <= 15 && performance.now() - d.t <= 800) this.tap(p.nx, p.ny);
    }
  }

  /** A tap at normalised canvas coordinates: find the toy under it. */
  tap(nx, ny) {
    this.ndc.set(nx, ny);
    this.ray.setFromCamera(this.ndc, this.camera);
    this.hits.length = 0;
    this.ray.intersectObject(this.root, true, this.hits);
    let action = 'stage';
    let target = null;
    for (const hit of this.hits) {
      let o = hit.object;
      while (o && o !== this.root) {
        if (o.userData.action) {
          action = o.userData.action;
          target = o;
          break;
        }
        o = o.parent;
      }
      if (target) break;
    }
    this.pulse();
    if (target) this.bounce(target);
    this.onTap(action);
  }

  /* ---------------------------------------------------------------- frame */

  update(dt, t) {
    this.#pointer();
    const now = performance.now();
    let animating = false;

    if (!this._calm) {
      for (const a of this.moving) {
        if (a.type === 'swing') a.obj.rotation.z = a.rot + Math.sin(t * 1.6 + a.phase) * a.amp;
        else if (a.type === 'hop') a.obj.position.y = a.y + Math.max(0, Math.sin(t * 2.4 + a.phase)) * a.amp;
        else {
          a.obj.position.y = a.y + Math.sin(t * 1.3 + a.phase) * a.amp;
          if (a.type === 'boat') a.obj.rotation.z = a.rot + Math.sin(t * 1.2) * 0.04;
        }
      }
      animating = this.moving.length > 0;
    } else if (this.resetMotion) {
      for (const a of this.moving) {
        a.obj.position.y = a.y;
        a.obj.rotation.z = a.rot;
      }
    }
    if (this.resetMotion) {
      this.resetMotion = false;
      if (this._calm) {
        this.popAt = this.pulseAt = 0;
        for (const b of this.bounces) b.obj.scale.copy(b.base);
        this.bounces.length = 0;
        if (this.newApple) this.newApple.scale.setScalar(1);
        this.newApple = null;
        this.confetti.active = false;
        this.confetti.mesh.visible = false;
      }
    }

    let s = 1;
    if (this.popAt) {
      const p = (now - this.popAt) / 380;
      if (p < 1) s *= 0.9 + 0.1 * easeOutBack(p);
      else this.popAt = 0;
    }
    if (this.pulseAt) {
      const p = (now - this.pulseAt) / 800;
      if (p < 1) s *= 1 + Math.sin(p * Math.PI) * 0.025;
      else this.pulseAt = 0;
    }
    if (s !== this.rootScale) {
      this.root.scale.setScalar(s);
      this.rootScale = s;
      animating = true;
    }

    for (let i = this.bounces.length - 1; i >= 0; i--) {
      const b = this.bounces[i];
      const p = (now - b.t0) / 460;
      if (p >= 1) {
        b.obj.scale.copy(b.base);
        this.bounces.splice(i, 1);
      } else {
        const k = Math.sin(p * Math.PI) * (1 - p) * 1.6;
        b.obj.scale.set(b.base.x * (1 - 0.07 * k), b.base.y * (1 + 0.14 * k), b.base.z * (1 - 0.07 * k));
      }
      animating = true;
    }

    if (this.newApple) {
      const t0 = Math.min(1, (now - this.newApple.userData.newAt) / 430);
      this.newApple.scale.setScalar(this._calm ? 1 : 0.72 + 0.28 * (1 - (1 - t0) ** 3));
      if (t0 >= 1) this.newApple = null;
      animating = true;
    }

    const c = this.confetti;
    if (c.active) {
      c.age += dt;
      if (c.age >= c.life) {
        c.active = false;
        c.mesh.visible = false;
      } else {
        const fade = Math.max(0.001, Math.min(1, (c.life - c.age) / 0.5));
        const drag = Math.max(0, 1 - 0.6 * dt);
        for (let i = 0; i < c.count; i++) {
          const j = i * 3;
          c.vel[j] *= drag;
          c.vel[j + 2] *= drag;
          c.vel[j + 1] -= 5.5 * dt;
          c.pos[j] += c.vel[j] * dt;
          c.pos[j + 1] += c.vel[j + 1] * dt;
          c.pos[j + 2] += c.vel[j + 2] * dt;
          c.rot[i * 2] += c.spin[i * 2] * dt;
          c.rot[i * 2 + 1] += c.spin[i * 2 + 1] * dt;
          c.dummy.position.set(c.pos[j], c.pos[j + 1], c.pos[j + 2]);
          c.dummy.rotation.set(c.rot[i * 2], c.rot[i * 2 + 1], 0);
          c.dummy.scale.setScalar(fade);
          c.dummy.updateMatrix();
          c.mesh.setMatrixAt(i, c.dummy.matrix);
        }
        c.mesh.instanceMatrix.needsUpdate = true;
      }
      animating = true;
    }

    // A resized drawing buffer is blank until drawn again.
    const canvas = this.kit.canvas;
    if (canvas.width !== this.lastW || canvas.height !== this.lastH) {
      this.lastW = canvas.width;
      this.lastH = canvas.height;
      this.dirty = true;
    }
    // Calm motion keeps the toys still, so the stage only draws when something changed.
    if (animating || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** Build every kind of scene once and compile its pipelines, so later page changes do not stutter. */
  async warmUp(onProgress = () => {}) {
    const kinds = [
      ['garden'], ['boat'], ['abc'], ['letter', { letter: 'Q', index: 16, word: 'quilt' }], ['count', { count: 3, goal: 3 }],
      ['cow'], ['cat'], ['pig'], ['lamb'], ['body', { part: 'nose' }], ['color', { hex: '#c73832' }],
      ['shape', { shape: 'triangle' }], ['meadow'], ['bedtime'],
    ];
    const started = performance.now();
    this.confetti.mesh.visible = true;
    for (let i = 0; i < kinds.length; i++) {
      try {
        this.set(...kinds[i]);
      } catch (err) {
        console.error(`Little World: the ${kinds[i][0]} scene could not be built.`, err);
        continue;
      }
      try {
        await this.renderer.compileAsync(this.scene, this.camera);
      } catch (err) {
        console.warn('Little World: warm-up stopped early.', err);
        break;
      }
      onProgress((i + 1) / kinds.length);
      if (performance.now() - started > 4000) break;
    }
    this.confetti.mesh.visible = this.confetti.active;
    this.pmrem?.dispose();
    this.pmrem = null;
  }
}
