/**
 * primitives.js — the game's building blocks on three.js: shared unit
 * primitives (box, sphere, cylinder, cone, plane sized like PlayCanvas's),
 * the shared material palette, single meshes, and StaticBatch, which merges
 * static props into one mesh per material so a settlement or the field
 * compound costs a handful of draw calls instead of dozens.
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DEG = Math.PI / 180;

/** Unit primitives: every one fits a 1 x 1 x 1 box centred on the origin. */
export const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
  cone: new THREE.ConeGeometry(0.5, 1, 16),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
const SHARED_GEOMETRY = new Set(Object.values(GEOMETRY));

/** PlayCanvas-style Euler angles in degrees (its X-then-Y-then-Z order is three's 'ZYX'). */
export function setEulerDeg(object, x = 0, y = 0, z = 0) {
  object.rotation.set(x * DEG, y * DEG, z * DEG, 'ZYX');
  return object;
}

/** Set a colour from sRGB components (the original palette is authored in sRGB). */
export function srgb(color, r, g, b) {
  return color.setRGB(r, g, b, THREE.SRGBColorSpace);
}

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

/** One primitive mesh parented to `parent`, positioned in the parent's space. */
export function prim(parent, type, material, position, scale, { cast = true, receive = true, rotation = null, name = '' } = {}) {
  const mesh = new THREE.Mesh(GEOMETRY[type], material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) setEulerDeg(mesh, rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

/** Freeze an object's local matrix (static props that never move). */
export function freeze(object) {
  object.updateMatrix();
  object.matrixAutoUpdate = false;
  return object;
}

/**
 * Collects static primitives and merges them into one mesh per
 * (material, casts-shadow) pair. Build once; add nothing afterwards.
 */
export class StaticBatch {
  constructor() {
    this.groups = new Map();
  }

  add(type, material, position, scale, rotation = null, cast = true) {
    _pos.set(position[0], position[1], position[2]);
    _scale.set(scale[0], scale[1], scale[2]);
    if (rotation) _quat.setFromEuler(_euler.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG, 'ZYX'));
    else _quat.identity();
    _matrix.compose(_pos, _quat, _scale);
    const geometry = GEOMETRY[type].clone().applyMatrix4(_matrix);
    const key = `${material.uuid}:${cast ? 1 : 0}`;
    let group = this.groups.get(key);
    if (!group) {
      group = { material, cast, geometries: [] };
      this.groups.set(key, group);
    }
    group.geometries.push(geometry);
    return this;
  }

  get size() {
    let n = 0;
    for (const g of this.groups.values()) n += g.geometries.length;
    return n;
  }

  /** Merge into meshes under `parent`; returns the meshes. */
  build(parent, { receive = true } = {}) {
    const meshes = [];
    for (const group of this.groups.values()) {
      if (!group.geometries.length) continue;
      const merged = group.geometries.length === 1 ? group.geometries[0] : mergeGeometries(group.geometries, false);
      if (group.geometries.length > 1) for (const g of group.geometries) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, group.material);
      mesh.castShadow = group.cast;
      mesh.receiveShadow = receive;
      freeze(mesh);
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

/** Remove an object and free the geometry it owns (shared unit primitives and materials stay). */
export function disposeObject(object) {
  if (!object) return;
  object.removeFromParent();
  object.traverse((child) => {
    if (child.isMesh && child.geometry && !SHARED_GEOMETRY.has(child.geometry)) child.geometry.dispose();
  });
}

/* ---------------------------------------------------------------- materials */

/**
 * A lit surface from the original's PlayCanvas parameters: gloss becomes
 * roughness, colours are sRGB.
 */
export function standardMaterial(name, { color = [1, 1, 1], metalness = 0, gloss = 0.35, vertexColor = false, emissive = null, emissiveIntensity = 1 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    name,
    metalness,
    roughness: Math.max(0.04, Math.min(1, 1 - gloss)),
    vertexColors: vertexColor,
  });
  srgb(material.color, color[0], color[1], color[2]);
  if (emissive) {
    srgb(material.emissive, emissive[0], emissive[1], emissive[2]);
    material.emissiveIntensity = emissiveIntensity;
  }
  material.userData.baseRoughness = material.roughness;
  return material;
}

/** Dark metallic body with a bright emissive core (signal lights, windows, glass). */
export function glowMaterial(name, emissive, intensity = 8) {
  return standardMaterial(name, { color: [0.018, 0.024, 0.024], metalness: 0.75, gloss: 0.7, emissive, emissiveIntensity: intensity });
}

/** Unlit additive glow (beams, rain): colour is the sRGB tint times an HDR intensity. */
export function additiveMaterial(name, tint, intensity, opacity, { fog = false, doubleSided = false } = {}) {
  const material = new THREE.MeshBasicMaterial({
    name,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  srgb(material.color, tint[0], tint[1], tint[2]).multiplyScalar(intensity);
  material.userData.tint = tint;
  return material;
}

export function createMaterials() {
  const terrain = standardMaterial('Terrain / vertex palette', { color: [1, 1, 1], metalness: 0.02, gloss: 0.22, vertexColor: true });
  const rock = standardMaterial('Basalt', { color: [0.16, 0.2, 0.19], metalness: 0.04, gloss: 0.28 });
  const foliage = standardMaterial('Lichen', { color: [0.25, 0.37, 0.29], metalness: 0, gloss: 0.2 });
  const water = standardMaterial('Still water', { color: [0.035, 0.16, 0.19], metalness: 0.5, gloss: 0.92, emissive: [0.015, 0.07, 0.08], emissiveIntensity: 0.8 });
  water.transparent = true;
  water.opacity = 0.88;
  water.depthWrite = false;
  const structure = standardMaterial('Oxidized alloy', { color: [0.075, 0.105, 0.105], metalness: 0.38, gloss: 0.48, emissive: [0.009, 0.014, 0.014], emissiveIntensity: 0.45 });
  const structureAccent = standardMaterial('Ceramic', { color: [0.34, 0.38, 0.32], metalness: 0.15, gloss: 0.45 });

  const sky = new THREE.MeshBasicMaterial({ name: 'Procedural sky', vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false });
  const sun = new THREE.MeshBasicMaterial({ name: 'Sun disc', fog: false });
  const moon = new THREE.MeshBasicMaterial({ name: 'Faceted lunar surface', vertexColors: true, fog: false });
  const stars = new THREE.MeshBasicMaterial({
    name: 'Frontier stars',
    vertexColors: true,
    fog: false,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beam = additiveMaterial('Relay beam', [0.28, 0.95, 0.78], 16, 0.16);
  const rain = additiveMaterial('Charged rain', [0.48, 0.78, 0.9], 1.4, 0.24, { fog: true, doubleSided: true });

  return {
    terrain,
    rock,
    foliage,
    water,
    structure,
    structureAccent,
    sky,
    sun,
    moon,
    stars,
    beam,
    rain,
    road: standardMaterial('Peat aggregate road', { color: [0.105, 0.12, 0.105], metalness: 0.02, gloss: 0.18 }),
    roadEdge: standardMaterial('Chalk road edge', { color: [0.48, 0.48, 0.37], metalness: 0.02, gloss: 0.25 }),
    roof: standardMaterial('Weathered roof', { color: [0.055, 0.075, 0.08], metalness: 0.42, gloss: 0.38, emissive: [0.006, 0.009, 0.01], emissiveIntensity: 0.35 }),
    timber: standardMaterial('Resin timber', { color: [0.19, 0.13, 0.085], metalness: 0, gloss: 0.25 }),
    window: glowMaterial('Inhabited window', [1, 0.43, 0.14], 5.5),
    fieldOrange: glowMaterial('Field equipment amber', [1, 0.32, 0.08], 5),
    lichenGlow: glowMaterial('Conductive lichen', [0.28, 1, 0.73], 3.8),
    hazard: glowMaterial('Rejected signal', [1, 0.12, 0.07], 8),
    citizen: standardMaterial('Field cloth', { color: [0.2, 0.27, 0.25], metalness: 0.04, gloss: 0.25 }),
    wildlife: standardMaterial('Pebbleback shell', { color: [0.34, 0.31, 0.24], metalness: 0.08, gloss: 0.28 }),
  };
}

/** Surfaces that darken and gloss up in rain: [material, dry gloss, wet gloss]. */
export function wetSurfaces(materials) {
  return [
    [materials.terrain, 0.22, 0.56],
    [materials.rock, 0.28, 0.72],
    [materials.foliage, 0.2, 0.5],
    [materials.road, 0.18, 0.68],
    [materials.structure, 0.48, 0.76],
    [materials.structureAccent, 0.45, 0.72],
    [materials.roof, 0.38, 0.8],
    [materials.timber, 0.25, 0.54],
  ];
}
