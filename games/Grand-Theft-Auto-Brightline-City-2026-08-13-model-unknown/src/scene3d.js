/**
 * scene3d.js — the rendering pieces Brightline City builds its world from:
 * low-poly geometry shaped like the original builders, the colour rules,
 * CPU particles drawn as instanced billboards, and the post chain
 * (selective glow, bloom, neutral tone mapping, contrast, FXAA).
 *
 * World coordinates. The game was written for a left-handed engine. Game
 * logic keeps those coordinates unchanged; everything it places lives under
 * one `world` group mirrored on X, which turns the left-handed layout into
 * three.js's right-handed space without touching a single gameplay number.
 * Cameras and particles live outside the mirror and go through `toWorld`.
 */

import * as THREE from 'three/webgpu';
import {
  Fn, mrt, output, vec3, vec4, float, uniform, mix, max, saturate, pow, length, fog, positionView,
  materialEmissive, materialOpacity, pass, renderOutput, texture, instancedBufferAttribute, renderGroup,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';

/** Game (left-handed) coordinates → three.js world coordinates. */
export function toWorld(v, out = new THREE.Vector3()) {
  return out.set(-v.x, v.y, v.z);
}

/**
 * The original fed hex colours straight into its PBR shaders as linear
 * values. Doing the same keeps every surface the colour it was.
 */
export function linearColor(hex, scale = 1) {
  const c = new THREE.Color().setHex(parseInt(String(hex).slice(1), 16), THREE.LinearSRGBColorSpace);
  return scale === 1 ? c : c.multiplyScalar(scale);
}

/* ------------------------------------------------------------------ geometry */

const geometries = new Map();
const cached = (key, make) => {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
};

export const shapes = {
  box: (width = 1, height = 1, depth = 1) =>
    cached(`box:${width}:${height}:${depth}`, () => new THREE.BoxGeometry(width, height, depth)),
  /** A cylinder like the original's: first facet vertex on +X. */
  cylinder: ({ height = 1, diameter = 1, diameterTop = diameter, diameterBottom = diameter, tessellation = 24 }) =>
    cached(`cyl:${height}:${diameterTop}:${diameterBottom}:${tessellation}`, () =>
      new THREE.CylinderGeometry(diameterTop / 2, diameterBottom / 2, height, tessellation, 1, false, Math.PI / 2)
    ),
  /** A flat ground plane facing up. */
  ground: (width, depth) => cached(`ground:${width}:${depth}`, () => new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2)),
  /** Faceted icosphere (one subdivision level = the plain icosahedron). */
  ico: (radius) => cached(`ico:${radius}`, () => new THREE.IcosahedronGeometry(radius, 0)),
  /** Octahedron with the original "size" (vertices at size·√2). */
  octa: (size) => cached(`octa:${size}`, () => new THREE.OctahedronGeometry(size * Math.SQRT2, 0)),
  /** A flat ring lying on the ground. */
  torus: (diameter, thickness, tessellation) =>
    cached(`torus:${diameter}:${thickness}:${tessellation}`, () =>
      new THREE.TorusGeometry(diameter / 2, thickness / 2, tessellation, tessellation).rotateX(Math.PI / 2)
    ),
  /** A flat disc facing up. */
  disc: (radius, tessellation) => cached(`disc:${radius}:${tessellation}`, () => new THREE.CircleGeometry(radius, tessellation).rotateX(-Math.PI / 2)),
};

/* ------------------------------------------------------------------ materials */

/**
 * Mark a material as part of the selective glow (the original's glow layer):
 * its emissive colour goes to the glow target, which is blurred and added.
 */
export function makeGlow(material) {
  material.mrtNode = mrt({ glow: vec4(materialEmissive, materialOpacity) });
  return material;
}

/* ------------------------------------------------------------------ fog */

/**
 * The original's linear fog on its PBR materials: distance from the eye,
 * the kept-colour factor raised to 2.2, and the fog colour taken as a
 * gamma-space value and brought to linear (x^2.2), as its PBR shaders did.
 * That conversion is what turns the whole isometric view deep blue at night.
 * Returns the uniforms to drive; setColor() takes the scene's sky colour.
 */
export function installFog(scene) {
  // Scene-wide values go in the render group: a plain uniform() is refreshed
  // per object, and static meshes that never move would keep the old fog.
  const fogColor = uniform(new THREE.Color()).setGroup(renderGroup);
  const fogStart = uniform(112).setGroup(renderGroup);
  const fogEnd = uniform(205).setGroup(renderGroup);
  const keep = pow(saturate(fogEnd.sub(length(positionView)).div(fogEnd.sub(fogStart))), 2.2);
  scene.fogNode = fog(fogColor, float(1).sub(keep));
  return {
    start: fogStart,
    end: fogEnd,
    setColor(c) {
      fogColor.value.setRGB(c.r ** 2.2, c.g ** 2.2, c.b ** 2.2, THREE.LinearSRGBColorSpace);
    },
  };
}

/* ------------------------------------------------------------------ particles */

/**
 * A CPU particle system that behaves like the original's: box emitter,
 * random direction between two vectors, gravity, colour fading toward
 * `colorDead` over the particle's life, alpha-blended billboards sized in
 * meters. Time runs at the original's particle speed (0.6 units per second).
 */
export class Particles {
  constructor({ capacity, map, color1, color2, colorDead = [0, 0, 0, 1], minSize, maxSize, minLife, maxLife, emitRate, dir1, dir2, gravity, boxMin, boxMax }) {
    Object.assign(this, { capacity, color1, color2, colorDead, minSize, maxSize, minLife, maxLife, emitRate, dir1, dir2, gravity, boxMin, boxMax });
    this.emitter = new THREE.Vector3();
    this.running = false;
    this.excess = 0;
    this.alive = 0;
    // Per particle: position(3) direction(3) color(4) colorStep(4) age life size
    this.pos = new Float32Array(capacity * 3);
    this.dir = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.step = new Float32Array(capacity * 4);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);

    this.posAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, fog: false });
    material.positionNode = instancedBufferAttribute(this.posAttr);
    material.scaleNode = instancedBufferAttribute(this.sizeAttr);
    material.colorNode = texture(map).mul(instancedBufferAttribute(this.colAttr));
    this.object = new THREE.Sprite(material);
    this.object.count = 0;
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  /** dt in seconds. */
  update(dt) {
    const t = dt * 0.6; // the original advanced particles 0.01 per 60 Hz frame
    const { pos, dir, col, step, age, life, size, gravity } = this;
    // age and move
    for (let i = 0; i < this.alive; i++) {
      age[i] += t;
      if (age[i] >= life[i]) {
        this.#kill(i);
        i--;
        continue;
      }
      const i3 = i * 3, i4 = i * 4;
      pos[i3] += dir[i3] * t;
      pos[i3 + 1] += dir[i3 + 1] * t;
      pos[i3 + 2] += dir[i3 + 2] * t;
      dir[i3] += gravity[0] * t;
      dir[i3 + 1] += gravity[1] * t;
      dir[i3 + 2] += gravity[2] * t;
      for (let k = 0; k < 4; k++) col[i4 + k] += step[i4 + k] * t;
    }
    // emit
    if (this.running) {
      this.excess += this.emitRate * t;
      let n = Math.floor(this.excess);
      this.excess -= n;
      while (n-- > 0 && this.alive < this.capacity) this.#spawn(this.alive++);
    } else {
      this.excess = 0;
    }
    // upload (mirrored into three.js space)
    const P = this.posAttr.array, C = this.colAttr.array, S = this.sizeAttr.array;
    for (let i = 0; i < this.alive; i++) {
      const i3 = i * 3, i4 = i * 4;
      P[i3] = -pos[i3];
      P[i3 + 1] = pos[i3 + 1];
      P[i3 + 2] = pos[i3 + 2];
      C[i4] = Math.max(0, col[i4]);
      C[i4 + 1] = Math.max(0, col[i4 + 1]);
      C[i4 + 2] = Math.max(0, col[i4 + 2]);
      C[i4 + 3] = Math.min(1, Math.max(0, col[i4 + 3]));
      S[i] = size[i];
    }
    this.object.count = this.alive;
    this.object.visible = this.alive > 0;
    if (this.alive) {
      this.posAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
      this.sizeAttr.needsUpdate = true;
    }
  }

  clear() {
    this.alive = 0;
    this.object.count = 0;
    this.object.visible = false;
  }

  #spawn(i) {
    const r = Math.random;
    const i3 = i * 3, i4 = i * 4;
    const { boxMin: a, boxMax: b, dir1: d1, dir2: d2, color1: c1, color2: c2, colorDead: cd } = this;
    this.pos[i3] = this.emitter.x + a[0] + (b[0] - a[0]) * r();
    this.pos[i3 + 1] = this.emitter.y + a[1] + (b[1] - a[1]) * r();
    this.pos[i3 + 2] = this.emitter.z + a[2] + (b[2] - a[2]) * r();
    this.dir[i3] = d1[0] + (d2[0] - d1[0]) * r();
    this.dir[i3 + 1] = d1[1] + (d2[1] - d1[1]) * r();
    this.dir[i3 + 2] = d1[2] + (d2[2] - d1[2]) * r();
    const life = this.minLife + (this.maxLife - this.minLife) * r();
    this.life[i] = life;
    this.age[i] = 0;
    this.size[i] = this.minSize + (this.maxSize - this.minSize) * r();
    const m = r();
    for (let k = 0; k < 4; k++) {
      const c = c1[k] + (c2[k] - c1[k]) * m;
      this.col[i4 + k] = c;
      this.step[i4 + k] = (cd[k] - c) / life;
    }
  }

  #kill(i) {
    const last = --this.alive;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.dir.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.col.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.step.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
  }
}

/** A small canvas texture for particle sprites. */
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ post */

/** Contrast curve applied to display colour, as the original's image processing did. */
const contrastCurve = Fn(([color, amount]) => {
  const c = saturate(color.rgb);
  const high = c.mul(c).mul(float(3).sub(c.mul(2)));
  return vec4(mix(c, high, amount.sub(1)), color.a);
});

/**
 * Scene → (selective glow + HDR bloom) → neutral tone mapping → contrast → FXAA.
 * The glow target comes from materials marked with makeGlow(); everything
 * else writes black into it and so occludes glow behind it.
 */
export function createCityPost(kit, scene, camera) {
  const pipeline = new THREE.RenderPipeline(kit.renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, glow: vec4(0, 0, 0, 1) }));
  const color = scenePass.getTextureNode('output');
  const glow = scenePass.getTextureNode('glow');

  const glowGain = uniform(0.9).setGroup(renderGroup);
  const hdrGain = uniform(1).setGroup(renderGroup);
  const contrast = uniform(1.12).setGroup(renderGroup);
  const bloomInput = vec4(glow.rgb.mul(glowGain).add(max(color.rgb.sub(1.05), vec3(0)).mul(hdrGain)), 1);
  const glowBloom = bloom(bloomInput, 1, 0.35, 0);

  const build = (tier) => {
    glowBloom.setResolutionScale(tier.post === 'lite' ? 0.35 : 0.5);
    const display = contrastCurve(renderOutput(color.add(glowBloom)), contrast);
    const useFxaa = !tier.msaa && tier.name !== 'low';
    pipeline.outputColorTransform = false;
    pipeline.outputNode = useFxaa ? fxaa(display) : display;
    pipeline.needsUpdate = true;
  };
  build(kit.tier);
  const offQuality = kit.onQuality(build);

  return {
    pipeline,
    scenePass,
    glowGain,
    hdrGain,
    contrast,
    setCamera(cam) {
      scenePass.camera = cam;
    },
    render() {
      pipeline.render();
    },
    dispose() {
      offQuality();
      pipeline.dispose();
    },
  };
}
