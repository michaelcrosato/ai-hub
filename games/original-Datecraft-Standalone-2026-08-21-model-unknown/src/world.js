/**
 * world.js — Brightside City, the isometric 3D city behind the management UI.
 *
 * A three.js port of the original Babylon.js world (world/babylon-world): the
 * same ground, roads, buildings, venues, trees, lamps, cars, pedestrians and
 * player, the same orthographic isometric camera, windows and lamps after dark.
 * The original always fell back to its 2D canvas view (the embedded Babylon
 * build never registered), so the layout, the sea on the near sides, the sky
 * clouds, the always-visible player and the time-of-day palette (sky, ground,
 * roads, sea, the Late veil, buildings pastel all day) follow what players
 * actually saw.
 * Colours stay in gamma space (as both original renderers drew them), so the
 * pastel palette reads exactly as the hex values say.
 */

import * as THREE from 'three/webgpu';
import { Fn, If, Discard, uniform, mix, mod, floor, float, vec3, vec4, color, smoothstep, screenUV, screenCoordinate } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { VENUES } from './data.js';

// Hex colours are used as-is and written out as-is, like the original canvas/Babylon look.
THREE.ColorManagement.enabled = false;

const PI = Math.PI;
/**
 * What players saw per time slot: the original canvas view's PALETTES (sky
 * gradient, ground, roads, sea). The canvas kept every building its pastel
 * colour all day; only the sky, ground, roads and sea changed, and Late laid
 * a navy veil over the whole picture.
 */
const SLOT_PALETTE = [
  { skyTop: '#9edfee', skyBottom: '#ffe0a4', ground: '#9bd58d', road: '#d9d0c3', water: '#62bfd7', veil: 0 },
  { skyTop: '#78cfeb', skyBottom: '#f9de97', ground: '#92d286', road: '#d7cbbd', water: '#4eb7d4', veil: 0 },
  { skyTop: '#f7b28f', skyBottom: '#f4d095', ground: '#84c27f', road: '#c8b8af', water: '#4ea4c8', veil: 0 },
  { skyTop: '#4a4f85', skyBottom: '#8b6993', ground: '#5d8f69', road: '#7a7180', water: '#315f8e', veil: 0.18 },
];
/** The canvas view's Late veil: rgba(36, 36, 73, .18) over everything. */
const VEIL_COLOR = '#242449';
/** Lit ground, road and pavement colours at Morning; the other slots scale them like the canvas palette. */
const BASE = { ground: '#91cf83', road: '#d2c8bd', walk: '#eee3d3' };
/**
 * Light per time slot. Like the canvas view, buildings keep their pastel
 * faces through the day: the light only warms at Evening and cools at Late
 * (where the veil does the darkening). Lit windows and street lamps come on
 * after dark, from the Babylon world.
 */
const SLOT_LIGHT = [
  { sky: 1.0, sun: 1.0, sunColor: '#fff2cf', windows: ['#14242d', 0.18], lamps: false },
  { sky: 1.0, sun: 1.02, sunColor: '#fff2cf', windows: ['#14242d', 0.18], lamps: false },
  { sky: 1.0, sun: 1.0, sunColor: '#ffe2c6', windows: ['#8a6b22', 0.55], lamps: true },
  { sky: 1.0, sun: 0.96, sunColor: '#e4e6ff', windows: ['#8a6b22', 0.55], lamps: true },
];

/** `base` scaled per channel by `hex / ref`: a palette change carried over to a lit material. */
function relative(base, hex, ref) {
  const b = new THREE.Color(base);
  const h = new THREE.Color(hex);
  const r = new THREE.Color(ref);
  return b.setRGB(Math.min(1, (b.r * h.r) / r.r), Math.min(1, (b.g * h.g) / r.g), Math.min(1, (b.b * h.b) / r.b));
}
// Base light levels (gamma-space Lambert factors; three.js wants them × π).
const AMBIENT = 0.22;
const HEMI = 0.5;
const SUN = 0.38;
/** Filler buildings: x, z, width, depth, height, colour. */
const FILLER = [
  [-13, -11, 3, 3, 3.5, '#f4c77d'], [-9, -11, 3, 2.5, 5, '#89c9d3'], [-5, -11, 2.8, 3, 4, '#eaa4a0'], [5, -11, 3, 3, 5, '#9dc993'], [10, -11, 3, 2.8, 4, '#b6a5df'], [13, -7, 2.5, 3, 3, '#f1b27d'],
  [13, 7, 3, 3, 5, '#85bed9'], [10, 11, 3, 2.5, 4, '#ef9da3'], [4, 12, 2.8, 3, 3, '#e5c37e'], [-4, 12, 3, 2.5, 5, '#91c8a6'], [-10, 12, 3, 3, 4, '#b6a0d8'], [-13, 7, 2.5, 3, 3, '#e8b989'],
  [4, 5, 2.2, 2.2, 2.7, '#fac586'], [-5, 4, 2.4, 2.4, 3.2, '#8fc7d8'], [5, -4, 2.5, 2.1, 3.8, '#eaa0ad'], [-4, -5, 2.3, 2.8, 2.6, '#9acb99'],
];
const TREES = [[-14, 3, 0.9], [-12, 10, 0.8], [-7, 2, 0.75], [-6, -9, 0.9], [2, 12, 0.8], [4, -8, 0.75], [9, 5, 0.9], [12, -3, 0.8], [6, 4, 0.7], [-2, -3, 0.8], [13, 1, 0.75], [-13, -3, 0.9]];
const VENUE_SIZE = { w: 2.85, d: 2.85, h: 3.7 };
/** True isometric elevation, as the original ArcRotateCamera (beta = atan √2). */
const ELEVATION = Math.atan(1 / Math.SQRT2);
const HOME_YAW = PI / 4;
const ROTATE_STEP = PI / 8;
const ZOOM = { home: 18, min: 11, max: 25 };
const PAN_LIMIT = 16;
const CITY_EDGE = 16.6;
const CAMERA_DISTANCE = 160;
/** The original sky's faint clouds: 7 ellipses (55 × 17 px, 16% white) drifting at 3 or 4.8 px/s. */
const CLOUDS = 7;
const LABEL_FONT = '750 40px Inter, ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif';

const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();
const dummy = new THREE.Object3D();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class CityWorld {
  /**
   * @param {object} kit  from boot()
   * @param {{ onVenueSelected?: (id: string) => void }} [options]
   */
  constructor(kit, options = {}) {
    this.kit = kit;
    this.onVenueSelected = options.onVenueSelected || (() => {});
    this.state = null;
    this.slot = -1;
    this.selected = null;
    this.hovered = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 420);
    this.view = {
      yaw: HOME_YAW,
      yawNow: HOME_YAW,
      zoom: ZOOM.home,
      zoomNow: ZOOM.home,
      target: new THREE.Vector3(),
      now: new THREE.Vector3(),
      halfH: ZOOM.home,
      pxPerUnit: 20,
    };
    this.size = { w: 1, h: 1 };
    this.materials = new Map();
    this.labels = [];
    this.venueIndex = new Map(VENUES.map((v, i) => [v.id, i]));
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.target = new THREE.Vector3();
    this.time = 0;
    this.light = null;
  }

  async init() {
    const { kit, scene } = this;
    const renderer = kit.renderer;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Sky: a vertical gradient per time slot with the original's drifting clouds, in screen space.
    this.skyTop = uniform(new THREE.Color(SLOT_PALETTE[0].skyTop));
    this.skyBottom = uniform(new THREE.Color(SLOT_PALETTE[0].skyBottom));
    this.veil = uniform(0);
    this.veilColor = uniform(new THREE.Color(VEIL_COLOR));
    this.cssSize = uniform(new THREE.Vector2(1, 1));
    this.cloudTime = uniform(0);
    scene.backgroundNode = this.skyNode();

    this.ambient = new THREE.AmbientLight(0xffffff, AMBIENT * PI);
    this.hemi = new THREE.HemisphereLight(0xffffff, new THREE.Color('#8ab0a5'), HEMI * PI);
    this.sun = new THREE.DirectionalLight(new THREE.Color('#fff2cf'), SUN * PI);
    // From the upper left of the view, so the left faces read lighter than the right ones.
    this.sun.position.set(0.31, 0.79, 0.52).multiplyScalar(60);
    this.sun.castShadow = true;
    kit.shadow(this.sun, 2048);
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2;
    scene.add(this.ambient, this.hemi, this.sun, this.sun.target);

    this.createEnvironment();
    this.createCity();
    this.createPlayer();
    this.createAmbientLife();

    // The Late veil goes over the finished picture (sky, city and labels), as the canvas drew it.
    this.post = createPost(kit, scene, this.camera, { output: (c) => vec4(mix(c.rgb, this.veilColor, this.veil), c.a) });
    kit.onResize((w, h) => {
      this.size.w = w;
      this.size.h = h;
      this.cssSize.value.set(w, h);
      this.updateFrustum(true);
    });
    this.placeCamera();

    // Build every pipeline now (street lamps included), so dusk does not stutter.
    this.bulbs.visible = true;
    this.marker.visible = true;
    this.post.render();
    this.applyTime(0, true);
    this.marker.visible = false;
    return this;
  }

  /** Sky gradient plus clouds, laid out in CSS pixels like the original canvas sky. */
  skyNode() {
    const px = screenUV.mul(this.cssSize);
    let sky = mix(this.skyTop, this.skyBottom, screenUV.y);
    const white = vec3(1, 1, 1);
    for (let i = 0; i < CLOUDS; i += 1) {
      const speed = i % 2 ? 4.8 : 3;
      const cx = mod(this.cloudTime.mul(speed).add(i * 250), this.cssSize.x.add(300)).sub(150);
      const dx = px.x.sub(cx).div(55);
      const dy = px.y.sub(70 + (i % 3) * 52).div(17);
      const inside = float(1).sub(smoothstep(0.94, 1.06, dx.mul(dx).add(dy.mul(dy))));
      sky = mix(sky, white, inside.mul(0.16));
    }
    return sky;
  }

  material(hex, { emissive = null, basic = false, flat = false, opacity = 1 } = {}) {
    const key = `${hex}|${emissive}|${basic}|${flat}|${opacity}`;
    let m = this.materials.get(key);
    if (!m) {
      const params = { color: new THREE.Color(hex) };
      if (opacity < 1) Object.assign(params, { transparent: true, opacity, depthWrite: false });
      if (basic) m = new THREE.MeshBasicMaterial(params);
      else {
        m = new THREE.MeshLambertMaterial({ ...params, flatShading: flat });
        if (emissive) m.emissive = new THREE.Color(emissive);
      }
      this.materials.set(key, m);
    }
    return m;
  }

  mesh(geometry, material, { x = 0, y = 0, z = 0, cast = false, receive = false, ground = false } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (ground) m.userData.ground = true;
    this.scene.add(m);
    return m;
  }

  instanced(geometry, material, count, { cast = false, receive = false, dynamic = false } = {}) {
    const m = new THREE.InstancedMesh(geometry, material, count);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (dynamic) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
    }
    this.scene.add(m);
    return m;
  }

  createEnvironment() {
    const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-PI / 2);
    // Ground, roads, pavements and sea change colour with the time slot (stepLight), so each has its own material.
    const own = (name, m) => (this.materials.set(name, m), m);
    this.env = {
      ground: own('env-ground', new THREE.MeshLambertMaterial({ color: new THREE.Color(BASE.ground) })),
      road: own('env-road', new THREE.MeshLambertMaterial({ color: new THREE.Color(BASE.road) })),
      walk: own('env-walk', new THREE.MeshLambertMaterial({ color: new THREE.Color(BASE.walk) })),
      // Flat and unlit, like the canvas view's sea: exactly the palette's water colour.
      sea: own('env-sea', new THREE.MeshBasicMaterial({ color: new THREE.Color(SLOT_PALETTE[0].water) })),
    };
    this.groundMesh = this.mesh(flat(34, 34), this.env.ground, { receive: true, ground: true });
    // The sea wraps the two near sides of the city, as in the original canvas view; the sky shows behind it.
    const sea = 127;
    this.mesh(flat(sea, sea), this.env.sea, { x: -17 + sea / 2, y: -0.08, z: -17 + sea / 2 });

    const road = this.env.road;
    const walk = this.env.walk;
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    this.mesh(box(32, 0.08, 2.2), road, { y: 0.04, receive: true, ground: true });
    this.mesh(box(2.2, 0.08, 32), road, { y: 0.045, receive: true, ground: true });
    for (const offset of [-1.65, 1.65]) {
      this.mesh(box(32, 0.11, 0.62), walk, { y: 0.06, z: offset, receive: true, ground: true });
      this.mesh(box(0.62, 0.11, 32), walk, { x: offset, y: 0.06, receive: true, ground: true });
    }
    // Lane marks, both roads, one draw call.
    const marks = [];
    for (let v = -14; v <= 14; v += 2) marks.push([v, 0, 0.7, 0.08], [0, v, 0.08, 0.7]);
    const markMesh = this.instanced(box(1, 0.015, 1), this.material('#faf1e2'), marks.length);
    marks.forEach(([x, z, w, d], i) => {
      dummy.position.set(x, 0.1, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(w, 1, d);
      dummy.updateMatrix();
      markMesh.setMatrixAt(i, dummy.matrix);
    });
    markMesh.userData.ground = true;
    this.groundPickables = this.scene.children.filter((o) => o.userData.ground);
  }

  createCity() {
    const buildings = FILLER.map(([x, z, w, d, h, color]) => ({ x, z, w, d, h, color, venue: null }));
    for (const venue of VENUES) buildings.push({ x: venue.x, z: venue.z, ...VENUE_SIZE, color: venue.color, venue });
    this.buildings = buildings;

    // Bodies and roofs: one instanced mesh each, coloured per instance.
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.bodies = this.instanced(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), buildings.length, { cast: true, receive: true });
    // A low truncated pyramid on every roof (the original 4-sided cylinder).
    const roofGeo = new THREE.CylinderGeometry(0.05, 0.38, 0.7, 4, 1).rotateY(PI / 4).translate(0, 0.35, 0);
    this.roofs = this.instanced(roofGeo, this.material('#fff3df', { flat: true }), buildings.length, { cast: true });
    buildings.forEach((b, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      this.bodies.setMatrixAt(i, dummy.matrix);
      this.bodies.setColorAt(i, tmpColor.set(b.color));
      const m = Math.max(b.w, b.d);
      dummy.position.set(b.x, b.h, b.z);
      dummy.scale.set(m, 1, m);
      dummy.updateMatrix();
      this.roofs.setMatrixAt(i, dummy.matrix);
    });
    this.bodies.userData.venueAt = (i) => buildings[i]?.venue?.id || null;
    this.roofs.userData.venueAt = this.bodies.userData.venueAt;

    // Venue fronts (face the camera's default side): windows, door, awning.
    const n = VENUES.length;
    const front = VENUE_SIZE.d / 2;
    this.windowMat = this.material('#7897a7', { emissive: '#14242d' }).clone();
    const levels = [];
    for (let level = 0.9; level < VENUE_SIZE.h - 0.3; level += 1.05) levels.push(level);
    const panes = this.instanced(new THREE.BoxGeometry(Math.min(0.7, VENUE_SIZE.w * 0.25), 0.42, 0.05), this.windowMat, n * 2 * levels.length);
    const doors = this.instanced(new THREE.BoxGeometry(0.68, 1.1, 0.08), this.material('#5e526c'), n);
    const awnings = this.instanced(new THREE.BoxGeometry(1.5, 0.18, 0.45), this.material('#fff8e8'), n, { cast: true });
    let p = 0;
    VENUES.forEach((v, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      for (const side of [-1, 1]) {
        for (const level of levels) {
          dummy.position.set(v.x + side * VENUE_SIZE.w * 0.24, level, v.z + front + 0.026);
          dummy.updateMatrix();
          panes.setMatrixAt(p++, dummy.matrix);
        }
      }
      dummy.position.set(v.x, 0.58, v.z + front + 0.035);
      dummy.updateMatrix();
      doors.setMatrixAt(i, dummy.matrix);
      dummy.position.set(v.x, 1.25, v.z + front + 0.195);
      dummy.updateMatrix();
      awnings.setMatrixAt(i, dummy.matrix);
    });
    const byIndex = (i) => VENUES[i]?.id || null;
    doors.userData.venueAt = byIndex;
    awnings.userData.venueAt = byIndex;
    panes.userData.venueAt = (i) => VENUES[Math.floor(i / (2 * levels.length))]?.id || null;

    // The selection ring (one, moved to the selected venue).
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.04, 8, 48), this.material('#ffffff', { basic: true, opacity: 0.92 }));
    this.marker.rotation.x = PI / 2;
    this.marker.position.y = 0.09;
    this.marker.visible = false;
    this.scene.add(this.marker);

    for (const venue of VENUES) this.createLabel(venue);

    // Trees: trunks and flat-shaded crowns, instanced.
    const trunks = this.instanced(new THREE.CylinderGeometry(0.125, 0.125, 1.25, 7).translate(0, 0.625, 0), this.material('#8c674c'), TREES.length, { cast: true });
    const crowns = this.instanced(new THREE.IcosahedronGeometry(0.78, 0), this.material('#58ad78', { flat: true }), TREES.length, { cast: true });
    TREES.forEach(([x, z, s], i) => {
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.setScalar(s);
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 1.55 * s, z);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    });

    // Street lamps along both roads; the bulbs light up after dark.
    const lamps = [];
    for (let v = -14; v <= 14; v += 3.5) lamps.push([v, -1.45], [1.45, v]);
    const poles = this.instanced(new THREE.CylinderGeometry(0.04, 0.04, 1.75, 7).translate(0, 0.875, 0), this.material('#62596a'), lamps.length);
    this.bulbs = this.instanced(new THREE.SphereGeometry(0.14, 10, 8), this.material('#ffe59a', { emissive: '#7d5c15' }), lamps.length);
    lamps.forEach(([x, z], i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 1.78, z);
      dummy.updateMatrix();
      this.bulbs.setMatrixAt(i, dummy.matrix);
    });

    this.venuePickables = [this.bodies, this.roofs, doors, awnings, panes, ...this.labels.map((l) => l.sprite)];
  }

  createLabel(venue) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = LABEL_FONT;
    const textWidth = Math.ceil(ctx.measureText(venue.name).width);
    canvas.width = 98 + textWidth + 38;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
    sprite.center.set(0.5, 0);
    sprite.position.set(venue.x, 4.75, venue.z);
    sprite.renderOrder = 10;
    sprite.userData.venueId = venue.id;
    this.scene.add(sprite);
    const label = { venue, canvas, ctx, texture, sprite, aspect: canvas.width / canvas.height, dark: null };
    this.labels.push(label);
    this.drawLabel(label, false);
  }

  drawLabel(label, dark) {
    if (label.dark === dark) return;
    label.dark = dark;
    const { ctx, canvas, venue } = label;
    const W = canvas.width;
    ctx.clearRect(0, 0, W, canvas.height);
    roundRect(ctx, 6, 12, W - 12, 104, 36);
    ctx.fillStyle = dark ? 'rgba(61,57,81,.96)' : 'rgba(255,253,247,.96)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(61,57,81,.16)';
    ctx.stroke();
    ctx.fillStyle = venue.color;
    ctx.beginPath();
    ctx.arc(58, 64, 27, 0, PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3d3951';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(venue.icon, 58, 66);
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#ffffff' : '#3d3951';
    ctx.font = LABEL_FONT;
    ctx.fillText(venue.name, 98, 67);
    label.texture.needsUpdate = true;
  }

  createPlayer() {
    const root = new THREE.Group();
    this.standPoint(-9, 7, this.target);
    root.position.copy(this.target);
    const outfit = this.material('#55466f');
    const skin = this.material('#d99772');
    const hairMat = this.material('#4a3543');
    const cast = (m) => ((m.castShadow = true), m);
    const body = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.31, 1.15, 10), outfit));
    body.position.y = 1.08;
    const head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.275, 16, 12), skin));
    head.position.y = 1.9;
    const hair = cast(new THREE.Mesh(new THREE.SphereGeometry(0.285, 16, 10, 0, PI * 2, 0, PI * 0.55), hairMat));
    hair.position.set(0, 1.93, -0.02);
    // Legs swing from the hip.
    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.72, 7).translate(0, -0.36, 0);
    const leftLeg = cast(new THREE.Mesh(legGeo, outfit));
    leftLeg.position.set(-0.18, 0.74, 0);
    const rightLeg = cast(new THREE.Mesh(legGeo, outfit));
    rightLeg.position.set(0.18, 0.74, 0);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.625, 0.0225, 8, 40), this.material('#ffffff', { basic: true }));
    aura.rotation.x = PI / 2;
    aura.position.y = 0.06;
    root.add(body, head, hair, leftLeg, rightLeg, aura);
    // The original drew the player over everything. In 3D a building can stand in front, so the
    // hidden part shows as a dithered silhouette: drawn only where something nearer already is,
    // before the player itself (renderOrder), so it never covers the visible figure.
    const ghost = new THREE.MeshBasicNodeMaterial({ depthWrite: false, depthFunc: THREE.GreaterDepth });
    ghost.colorNode = Fn(() => {
      If(mod(floor(screenCoordinate.x).add(floor(screenCoordinate.y)), 2).lessThan(0.5), () => {
        Discard();
      });
      return color('#3d3951');
    })();
    this.materials.set('player-silhouette', ghost);
    for (const part of [body, head, hair, leftLeg, rightLeg]) part.renderOrder = 2;
    for (const part of [body, head, hair]) {
      const shade = new THREE.Mesh(part.geometry, ghost);
      shade.renderOrder = 1;
      part.add(shade);
    }
    this.scene.add(root);
    this.player = { root, body, leftLeg, rightLeg, aura, phase: 0, moving: false };
  }

  createAmbientLife() {
    const carColors = ['#ff8f8f', '#f7c873', '#72bde9', '#a991e8'];
    // Long side along z; rotated to face along the road it drives on.
    this.carMesh = this.instanced(new THREE.BoxGeometry(0.42, 0.28, 0.78), new THREE.MeshLambertMaterial({ color: 0xffffff }), 6, { cast: true, dynamic: true });
    this.cars = [];
    for (let i = 0; i < 6; i += 1) {
      const direction = i % 3 ? 1 : -1;
      const axis = i % 2 ? 'z' : 'x';
      // Keep to the right-hand lane of the direction of travel, so oncoming cars never overlap.
      const lane = (axis === 'x' ? 0.55 : -0.55) * direction;
      this.cars.push({ axis, direction, offset: -14 + i * 5.2, lane, speed: 0.75 + i * 0.07 });
      this.carMesh.setColorAt(i, tmpColor.set(carColors[i % carColors.length]));
    }
    const npcColors = ['#477b78', '#735a78', '#506f8d', '#8e5c61'];
    this.npcBodies = this.instanced(new THREE.CylinderGeometry(0.14, 0.18, 0.75, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), 10, { cast: true, dynamic: true });
    this.npcHeads = this.instanced(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), 10, { cast: true, dynamic: true });
    this.npcs = [];
    for (let i = 0; i < 10; i += 1) {
      const axis = i % 2 ? 'x' : 'z';
      const along = -12 + ((i * 3.1) % 24);
      const side = i % 4 < 2 ? 2.2 : -2.2;
      // Pedestrians keep to the pavements beside the two roads.
      const pos = axis === 'x' ? new THREE.Vector3(along, 0, side) : new THREE.Vector3(side, 0, along);
      this.npcs.push({ pos, axis, direction: i % 3 ? 1 : -1, speed: 0.3 + (i % 4) * 0.05, phase: i });
      this.npcBodies.setColorAt(i, tmpColor.set(npcColors[i % npcColors.length]));
      this.npcHeads.setColorAt(i, tmpColor.set(i % 3 ? '#c88767' : '#8b5d4b'));
    }
    this.updateAmbientLife(0);
  }

  /* ------------------------------------------------------------ state */

  /**
   * Where the player stands for a saved position. A venue's position is the
   * middle of its building, so the player waits at its front door instead of
   * disappearing inside.
   */
  standPoint(x, z, out = tmpVec) {
    const atVenue = VENUES.some((v) => Math.abs(v.x - x) < 0.01 && Math.abs(v.z - z) < 0.01);
    return out.set(x, 0, atVenue ? z + VENUE_SIZE.d / 2 + 0.75 : z);
  }

  setState(state) {
    this.state = state;
    this.setSelected(state.world.selectedVenue);
    const p = state.world.player;
    if (p) {
      const stand = this.standPoint(p.x, p.z);
      if (Math.abs(this.target.x - stand.x) > 0.01 || Math.abs(this.target.z - stand.z) > 0.01) this.target.copy(stand);
    }
    this.applyTime(state.clock.slot);
  }

  focusVenue(venueId) {
    const venue = VENUES.find((item) => item.id === venueId);
    if (!venue) return;
    this.standPoint(venue.x, venue.z, this.target);
    this.setSelected(venueId);
  }

  setSelected(venueId) {
    const changed = this.selected !== venueId;
    this.selected = venueId || null;
    const venue = VENUES.find((v) => v.id === this.selected);
    this.marker.visible = !!venue;
    if (venue) this.marker.position.set(venue.x, 0.09, venue.z);
    if (!changed) return;
    // A selected venue lifts slightly, as the original highlighted it.
    this.buildings.forEach((b, i) => {
      if (!b.venue) return;
      tmpColor.set(b.color);
      if (b.venue.id === this.selected) tmpColor.lerp(new THREE.Color(0xffffff), 0.14);
      this.bodies.setColorAt(i, tmpColor);
    });
    this.bodies.instanceColor.needsUpdate = true;
    this.refreshLabels();
  }

  refreshLabels() {
    for (const label of this.labels) this.drawLabel(label, label.venue.id === this.selected || label.venue.id === this.hovered);
  }

  /** Change the sky and light for a time slot; eases over a second unless `now`. */
  applyTime(slot, now = false) {
    slot = Math.max(0, Math.min(3, slot | 0));
    if (slot === this.slot && !now) return;
    this.slot = slot;
    const L = SLOT_LIGHT[slot];
    const P = SLOT_PALETTE[slot];
    const P0 = SLOT_PALETTE[0];
    const to = {
      skyTop: new THREE.Color(P.skyTop),
      skyBottom: new THREE.Color(P.skyBottom),
      ground: relative(BASE.ground, P.ground, P0.ground),
      road: relative(BASE.road, P.road, P0.road),
      walk: relative(BASE.walk, P.road, P0.road),
      sea: new THREE.Color(P.water),
      veil: P.veil,
      sunColor: new THREE.Color(L.sunColor),
      windows: new THREE.Color(L.windows[0]).multiplyScalar(L.windows[1]),
      sky: L.sky,
      sun: L.sun,
    };
    this.bulbs.visible = L.lamps;
    this.light = { to, t: now ? 1 : 0 };
    if (now) this.stepLight(1);
  }

  stepLight(k) {
    const { to } = this.light;
    this.skyTop.value.lerp(to.skyTop, k);
    this.skyBottom.value.lerp(to.skyBottom, k);
    for (const name of ['ground', 'road', 'walk', 'sea']) this.env[name].color.lerp(to[name], k);
    this.veil.value += (to.veil - this.veil.value) * k;
    this.sun.color.lerp(to.sunColor, k);
    this.windowMat.emissive.lerp(to.windows, k);
    const sky = this.hemi.intensity / (HEMI * PI);
    const sun = this.sun.intensity / (SUN * PI);
    const s = sky + (to.sky - sky) * k;
    this.hemi.intensity = HEMI * PI * s;
    this.ambient.intensity = AMBIENT * PI * s;
    this.sun.intensity = SUN * PI * (sun + (to.sun - sun) * k);
  }

  /* ------------------------------------------------------------ camera */

  rotateStep(dir) {
    this.view.yaw += dir * ROTATE_STEP;
  }

  rotateBy(radians) {
    this.view.yaw += radians;
    this.view.yawNow += radians;
  }

  zoomBy(amount) {
    this.view.zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, this.view.zoom - amount));
  }

  resetCamera() {
    // Back to the nearest equivalent of the home angle, so the reset never spins twice around.
    const turns = Math.round((this.view.yaw - HOME_YAW) / (PI * 2));
    this.view.yaw = HOME_YAW + turns * PI * 2;
    this.view.target.set(0, 0, 0);
    this.view.zoom = ZOOM.home;
  }

  /** Grab-and-drag: move the city with the pointer by (dx, dy) CSS pixels. */
  panPixels(dx, dy) {
    const unit = 1 / this.view.pxPerUnit;
    this.panWorld(-dx * unit, dy * unit / Math.sin(ELEVATION));
  }

  /** Stick or keys: (x, y) in -1..1, y is up the screen. */
  panStick(x, y, dt) {
    const speed = this.view.halfH * 1.3 * dt;
    this.panWorld(x * speed, y * speed / Math.sin(ELEVATION));
  }

  panWorld(right, up) {
    const yaw = this.view.yaw;
    const t = this.view.target;
    // Screen right and screen up, projected on the ground.
    t.x += Math.sin(yaw) * right - Math.cos(yaw) * up;
    t.z += -Math.cos(yaw) * right - Math.sin(yaw) * up;
    t.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, t.x));
    t.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, t.z));
  }

  /** Ease the camera toward a venue (used when a controller cycles through venues). */
  lookAtVenue(venueId) {
    const v = VENUES.find((item) => item.id === venueId);
    if (!v) return;
    const t = this.view.target;
    t.lerp(tmpVec.set(v.x, 0, v.z), 0.5);
  }

  updateFrustum(force = false) {
    const v = this.view;
    const aspect = this.size.w / Math.max(1, this.size.h);
    // Portrait screens see the same width of city a landscape one would.
    const halfH = v.zoomNow * Math.max(1, 0.8 / aspect);
    if (!force && Math.abs(halfH - v.halfH) < 1e-4) return;
    v.halfH = halfH;
    v.pxPerUnit = this.size.h / (2 * halfH);
    const halfW = halfH * aspect;
    // Sit the city a little lower, clear of the top bar (the original canvas view did the same).
    const lift = 36 / v.pxPerUnit;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH + lift, bottom: -halfH + lift });
    this.camera.updateProjectionMatrix();
    this.updateLabelScale();
  }

  updateLabelScale() {
    const px = Math.max(24, Math.min(34, Math.min(this.size.w, this.size.h) * 0.045));
    const h = px / this.view.pxPerUnit;
    for (const label of this.labels) label.sprite.scale.set(h * label.aspect, h, 1);
  }

  placeCamera() {
    const v = this.view;
    const c = Math.cos(ELEVATION);
    this.camera.position.set(
      v.now.x + Math.cos(v.yawNow) * c * CAMERA_DISTANCE,
      v.now.y + Math.sin(ELEVATION) * CAMERA_DISTANCE,
      v.now.z + Math.sin(v.yawNow) * c * CAMERA_DISTANCE
    );
    this.camera.lookAt(v.now);
    this.updateFrustum();
  }

  /* ------------------------------------------------------------ pointer */

  pick(nx, ny, objects) {
    this.pointerNdc.set(nx, ny);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return this.raycaster.intersectObjects(objects, false);
  }

  /** Labels draw on top of everything, so a label under the pointer wins over a nearer building. */
  venueAt(hits) {
    const label = hits.find((h) => h.object.isSprite);
    return this.venueFromHit(label || hits[0]);
  }

  venueFromHit(hit) {
    if (!hit) return null;
    const o = hit.object;
    if (o.userData.venueId) return o.userData.venueId;
    if (o.userData.venueAt && hit.instanceId != null) return o.userData.venueAt(hit.instanceId);
    return null;
  }

  /** A click or tap at normalised device coordinates. */
  tap(nx, ny) {
    const hits = this.pick(nx, ny, [...this.venuePickables, ...this.groundPickables]);
    const venueId = this.venueAt(hits);
    if (venueId) {
      this.focusVenue(venueId);
      this.onVenueSelected(venueId);
      return venueId;
    }
    const hit = hits[0];
    if (hit?.object.userData.ground) {
      // Stroll to the spot (a visual walk; the calendar stays at the selected venue).
      this.target.set(Math.max(-CITY_EDGE, Math.min(CITY_EDGE, hit.point.x)), 0, Math.max(-CITY_EDGE, Math.min(CITY_EDGE, hit.point.z)));
    }
    return null;
  }

  /** Mouse hover: highlights the venue label under the pointer. Returns the venue id or null. */
  hover(nx, ny) {
    const venueId = nx == null ? null : this.venueAt(this.pick(nx, ny, this.venuePickables));
    if (venueId !== this.hovered) {
      this.hovered = venueId;
      this.refreshLabels();
    }
    return venueId;
  }

  /** Select the next or previous venue (controller shoulder triggers). */
  cycleVenue(dir) {
    const current = this.venueIndex.get(this.selected);
    const i = current == null ? (dir > 0 ? 0 : VENUES.length - 1) : (current + dir + VENUES.length) % VENUES.length;
    const id = VENUES[i].id;
    this.focusVenue(id);
    this.lookAtVenue(id);
    this.onVenueSelected(id);
    return id;
  }

  /* ------------------------------------------------------------ frame */

  update(dt, t) {
    this.time = t;
    this.cloudTime.value += dt;
    const v = this.view;
    const k = 1 - Math.exp(-10 * dt);
    v.yawNow += (v.yaw - v.yawNow) * k;
    v.zoomNow += (v.zoom - v.zoomNow) * k;
    v.now.lerp(v.target, k);
    this.placeCamera();

    if (this.light && this.light.t < 1) {
      const step = Math.min(1, dt * 1.2);
      this.light.t += step;
      this.stepLight(this.light.t >= 1 ? 1 : 1 - Math.exp(-4 * dt));
    }

    const player = this.player;
    const dx = this.target.x - player.root.position.x;
    const dz = this.target.z - player.root.position.z;
    const distance = Math.hypot(dx, dz);
    player.moving = distance > 0.05;
    if (player.moving) {
      const step = Math.min(distance, dt * 5.2);
      player.root.position.x += (dx / distance) * step;
      player.root.position.z += (dz / distance) * step;
      player.root.rotation.y = Math.atan2(dx, dz);
      player.phase += dt * 12;
    }
    const swing = player.moving ? Math.sin(player.phase) * 0.38 : 0;
    player.leftLeg.rotation.x = swing;
    player.rightLeg.rotation.x = -swing;
    player.body.position.y = 1.08 + (player.moving ? Math.abs(Math.sin(player.phase)) * 0.045 : 0);
    player.aura.scale.setScalar(1 + Math.sin(t * 2.1) * 0.06);
    this.marker.rotation.z += dt * 0.28;

    this.updateAmbientLife(dt);
  }

  updateAmbientLife(dt) {
    this.cars.forEach((car, i) => {
      car.offset += dt * car.speed * car.direction * 4;
      if (car.offset > 16) car.offset = -16;
      if (car.offset < -16) car.offset = 16;
      if (car.axis === 'x') {
        dummy.position.set(car.offset, 0.24, car.lane);
        dummy.rotation.set(0, car.direction > 0 ? PI / 2 : -PI / 2, 0);
      } else {
        dummy.position.set(car.lane, 0.24, car.offset);
        dummy.rotation.set(0, car.direction > 0 ? 0 : PI, 0);
      }
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.carMesh.setMatrixAt(i, dummy.matrix);
    });
    this.carMesh.instanceMatrix.needsUpdate = true;

    dummy.rotation.set(0, 0, 0);
    this.npcs.forEach((npc, i) => {
      const along = npc.axis === 'x' ? 'x' : 'z';
      if (Math.abs(npc.pos[along] + dt * npc.speed * npc.direction) > 14) npc.direction *= -1;
      npc.pos[along] += dt * npc.speed * npc.direction;
      const bob = Math.abs(Math.sin(this.time * 2.4 + npc.phase)) * 0.025;
      dummy.position.set(npc.pos.x, bob + 0.55, npc.pos.z);
      dummy.updateMatrix();
      this.npcBodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y = bob + 1.08;
      dummy.updateMatrix();
      this.npcHeads.setMatrixAt(i, dummy.matrix);
    });
    this.npcBodies.instanceMatrix.needsUpdate = true;
    this.npcHeads.instanceMatrix.needsUpdate = true;
  }

  render() {
    this.post.render();
  }

  dispose() {
    this.kit.stop();
    this.post.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material?.map) o.material.map.dispose();
    });
    for (const m of this.materials.values()) m.dispose();
  }
}
