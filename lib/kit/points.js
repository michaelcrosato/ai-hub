/**
 * points.js — sized points that look the same on WebGPU and WebGL2.
 *
 * WebGPU draws THREE.Points at exactly one pixel whatever material.size says,
 * so starfields, sparks and rain built on Points vanish there. This builds
 * the same thing as instanced sprites: one quad per point, sized in pixels
 * like PointsMaterial (with the same size attenuation).
 *
 *   const stars = createPoints({ positions, colors, size: 2, sizeAttenuation: false });
 *   scene.add(stars.object);
 *   // animate: write into stars.positions.array, then stars.positions.needsUpdate = true
 */

import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, materialColor, vec4 } from 'three/tsl';

/**
 * @param {object} o
 * @param {Float32Array} o.positions  xyz per point
 * @param {Float32Array} [o.colors]   rgb per point (multiplies color/map)
 * @param {Float32Array} [o.sizes]    size per point in pixels (replaces `size`)
 * @param {number} [o.size=1]         pixels, like PointsMaterial.size
 * @param {boolean} [o.sizeAttenuation=true]
 * @param {object} [o.material]       any other PointsNodeMaterial parameters (map, color, transparent, blending, depthWrite, opacity, alphaTest…)
 */
export function createPoints({ positions, colors, sizes, size = 1, sizeAttenuation = true, material: params = {} }) {
  const count = Math.floor(positions.length / 3);
  const position = new THREE.InstancedBufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  const material = new THREE.PointsNodeMaterial({ size, sizeAttenuation, ...params });
  material.positionNode = instancedBufferAttribute(position);

  let color = null;
  if (colors) {
    color = new THREE.InstancedBufferAttribute(colors, 3);
    color.setUsage(THREE.DynamicDrawUsage);
    material.colorNode = materialColor.mul(vec4(instancedBufferAttribute(color), 1));
  }
  let sizeAttr = null;
  if (sizes) {
    sizeAttr = new THREE.InstancedBufferAttribute(sizes, 1);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    material.sizeNode = instancedBufferAttribute(sizeAttr);
  }

  const object = new THREE.Sprite(material);
  object.count = count;
  object.frustumCulled = false;

  return {
    object,
    material,
    positions: position,
    colors: color,
    sizes: sizeAttr,
    /** Draw only the first n points (particle pools). */
    setCount(n) {
      object.count = Math.max(0, Math.min(count, n | 0));
    },
  };
}
