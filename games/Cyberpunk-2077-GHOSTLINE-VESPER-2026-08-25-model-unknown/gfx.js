/**
 * gfx.js — the small engine layer under the game: unit primitives that match
 * the PlayCanvas originals, one shared "vertex-painted" material pair, a mesh
 * builder that bakes many primitives into one draw call, a cache for the few
 * standalone materials, and a fixed pool of point lights.
 *
 * Every static thing in Vesper (city blocks, enemies, landmarks, the view
 * weapon) is built from boxes, spheres, cylinders and cones with a colour, an
 * emissive glow, metalness and gloss. Instead of one material per colour, the
 * builder writes those values into vertex attributes, so a whole city block is
 * two draws (lit and unlit) and every lit mesh shares one pipeline.
 */

import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';

export const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ primitives */

// PlayCanvas primitives are unit sized: box 1×1×1, sphere/cylinder/cone of
// radius 0.5 and height 1 along Y. three's defaults are set to match.
const PRIMITIVES = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 20, 14),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 18, 1),
};
export const primitive = (type) => PRIMITIVES[type];

/**
 * PlayCanvas gloss → three roughness. PlayCanvas's GGX distribution uses
 * (1 − gloss)⁴ where three uses roughness⁴, so roughness = 1 − gloss gives the
 * same highlight.
 */
export const glossToRoughness = (gloss) => Math.max(0.001, 1 - gloss);

/** A linear colour from an sRGB '#hex', times an intensity (values above 1 glow). */
export function hdr(hex, intensity = 1, target = new THREE.Color()) {
  return target.set(hex).multiplyScalar(intensity);
}

/* ------------------------------------------------------------------ shared materials */

/**
 * The two materials every baked mesh uses. Lit: base colour, emissive and
 * metalness/roughness come from vertex attributes. Unlit: an HDR colour
 * attribute (the PlayCanvas "unlit + emissive" look).
 */
export function createBakedMaterials() {
  const lit = new THREE.MeshStandardNodeMaterial();
  lit.colorNode = attribute('color', 'vec3');
  lit.emissiveNode = attribute('emissive', 'vec3');
  const pbr = attribute('pbr', 'vec2');
  lit.metalnessNode = pbr.x;
  lit.roughnessNode = pbr.y;
  lit.name = 'ghostline:baked-lit';

  const unlit = new THREE.MeshBasicNodeMaterial();
  unlit.colorNode = attribute('color', 'vec3');
  unlit.name = 'ghostline:baked-unlit';
  return { lit, unlit };
}

/* ------------------------------------------------------------------ mesh builder */

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'ZYX'); // PlayCanvas setEulerAngles order
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _em = new THREE.Color();

/** Compose a PlayCanvas-style local transform: position, Euler degrees, scale. */
export function composeTRS(target, position, eulerDeg, scale) {
  if (eulerDeg) _q.setFromEuler(_e.set(eulerDeg[0] * DEG, eulerDeg[1] * DEG, eulerDeg[2] * DEG, 'ZYX'));
  else _q.identity();
  return target.compose(_p.set(position[0], position[1], position[2]), _q, _s.set(scale[0], scale[1], scale[2]));
}

/**
 * Collects primitives and bakes them into one BufferGeometry.
 *
 *   const b = new MeshBuilder(true);
 *   b.add('box', [0, 2, 0], [4, 4, 4], null, { color: '#101526', metalness: 0.4, gloss: 0.68 });
 *   const mesh = new THREE.Mesh(b.build(), materials.lit);
 *
 * Styles follow the old material cache: { color, emissive, emissiveIntensity,
 * metalness, gloss }. For an unlit builder only the glow colour matters.
 */
export class MeshBuilder {
  constructor(lit = true) {
    this.lit = lit;
    this.parts = [];
    this.vertices = 0;
    this.indices = 0;
  }

  get empty() {
    return this.parts.length === 0;
  }

  /**
   * @param {'box'|'sphere'|'cylinder'|'cone'} type
   * @param {number[]} position  local position
   * @param {number[]} scale
   * @param {number[]|null} eulerDeg  local rotation in degrees (PlayCanvas order)
   * @param {object} style
   * @param {THREE.Matrix4} [parent]  an extra transform applied after this one
   */
  add(type, position, scale, eulerDeg, style, parent) {
    const geo = PRIMITIVES[type];
    const matrix = composeTRS(new THREE.Matrix4(), position, eulerDeg, scale);
    if (parent) matrix.premultiply(parent);
    this.parts.push({ geo, matrix, style });
    this.vertices += geo.attributes.position.count;
    this.indices += geo.index.count;
    return this;
  }

  build() {
    if (!this.parts.length) return null;
    const n = this.vertices;
    const position = new Float32Array(n * 3);
    const normal = this.lit ? new Float32Array(n * 3) : null;
    const color = new Float32Array(n * 3);
    const emissive = this.lit ? new Float32Array(n * 3) : null;
    const pbr = this.lit ? new Float32Array(n * 2) : null;
    const index = n > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices);
    let v = 0;
    let i = 0;
    for (const { geo, matrix, style } of this.parts) {
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const idx = geo.index;
      if (this.lit) {
        _n.getNormalMatrix(matrix);
        _c.set(style.color);
        if (style.emissive) hdr(style.emissive, style.emissiveIntensity ?? 2, _em);
        else _em.setRGB(0, 0, 0);
      } else {
        hdr(style.emissive ?? style.color, style.emissive ? (style.emissiveIntensity ?? 2) : 1, _c);
      }
      const metalness = style.metalness ?? 0.25;
      const roughness = glossToRoughness(style.gloss ?? 0.55);
      for (let k = 0; k < idx.count; k++) index[i++] = idx.array[k] + v;
      for (let k = 0; k < pos.count; k++, v++) {
        _v.fromBufferAttribute(pos, k).applyMatrix4(matrix);
        position[v * 3] = _v.x;
        position[v * 3 + 1] = _v.y;
        position[v * 3 + 2] = _v.z;
        color[v * 3] = _c.r;
        color[v * 3 + 1] = _c.g;
        color[v * 3 + 2] = _c.b;
        if (this.lit) {
          _v.fromBufferAttribute(nor, k).applyMatrix3(_n).normalize();
          normal[v * 3] = _v.x;
          normal[v * 3 + 1] = _v.y;
          normal[v * 3 + 2] = _v.z;
          emissive[v * 3] = _em.r;
          emissive[v * 3 + 1] = _em.g;
          emissive[v * 3 + 2] = _em.b;
          pbr[v * 2] = metalness;
          pbr[v * 2 + 1] = roughness;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    if (this.lit) {
      g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      g.setAttribute('emissive', new THREE.BufferAttribute(emissive, 3));
      g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 2));
    }
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/* ------------------------------------------------------------------ standalone materials */

/** The old material cache, for the few meshes that are not baked (pulses, rain, sky). */
export class Materials {
  cache = new Map();
  get(o) {
    const key = JSON.stringify(o);
    let m = this.cache.get(key);
    if (m) return m;
    if (o.unlit) {
      m = new THREE.MeshBasicNodeMaterial({ color: hdr(o.emissive ?? o.color, o.emissive ? (o.emissiveIntensity ?? 2) : 1) });
    } else {
      m = new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(o.color),
        metalness: o.metalness ?? 0.25,
        roughness: glossToRoughness(o.gloss ?? 0.55),
      });
      if (o.emissive) {
        m.emissive.set(o.emissive);
        m.emissiveIntensity = o.emissiveIntensity ?? 2;
      }
    }
    if (o.opacity !== undefined && o.opacity < 1) {
      m.transparent = true;
      m.opacity = o.opacity;
      m.depthWrite = false;
    }
    if (o.backSide) m.side = THREE.BackSide;
    m.name = `ghostline:${key}`;
    this.cache.set(key, m);
    return m;
  }
  destroy() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}

/* ------------------------------------------------------------------ point lights */

/**
 * Neon spills and the Whiteout core's glow. Forward lighting recompiles every
 * lit shader when the number of lights changes, and streaming blocks in and
 * out would change it constantly, so a fixed pool of lights stays in the
 * scene and is handed to the nearest sources. Unused lights sit at zero.
 *
 * What these lights show on Vesper's near-black streets is their GGX highlight
 * on the wet ground. PlayCanvas's GGX has the same shape as three's but no
 * Fresnel boost at grazing angles (where the player always sees the street),
 * and it falls off linearly to the range; decay 0 with a range cutoff at 0.12×
 * the intensity matches the old highlights.
 */
export class LightPool {
  constructor(scene, count) {
    this.scene = scene;
    this.sources = new Set();
    this.lights = [];
    this.dirty = true;
    this.timer = 0;
    this.resize(count);
  }

  resize(count) {
    while (this.lights.length > count) this.scene.remove(this.lights.pop());
    while (this.lights.length < count) {
      const l = new THREE.PointLight(0xffffff, 0, 20, 0);
      l.castShadow = false;
      this.scene.add(l);
      this.lights.push(l);
    }
    this.dirty = true;
  }

  /** src: { position: Vector3 (world, live), color: '#hex' or Color, intensity, range } */
  add(src) {
    src.linear = src.color instanceof THREE.Color ? src.color.clone() : new THREE.Color(src.color);
    this.sources.add(src);
    this.dirty = true;
    return src;
  }

  remove(src) {
    if (this.sources.delete(src)) this.dirty = true;
  }

  update(dt, center) {
    this.timer -= dt;
    if (this.dirty || this.timer <= 0) {
      this.timer = 0.25;
      this.dirty = false;
      const ranked = [...this.sources].sort((a, b) => a.position.distanceToSquared(center) - b.position.distanceToSquared(center));
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i];
        const s = ranked[i] ?? null;
        l.userData.source = s;
        if (!s) {
          l.intensity = 0;
          continue;
        }
        l.color.copy(s.linear);
        l.intensity = s.intensity * 0.12;
        l.distance = s.range;
      }
    }
    // Sources can move (the Whiteout core drifts), so positions follow every frame.
    for (const l of this.lights) if (l.userData.source) l.position.copy(l.userData.source.position);
  }
}
