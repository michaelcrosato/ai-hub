import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, normalLocal, normalView, positionLocal, time, vec3, float, mix, sin, dot, fract, floor, smoothstep, uniform } from 'three/tsl';
import { VOXEL_SIZE, PROFILES } from './config.js';

export function makeMaterialUniforms(settings = PROFILES.mobile.graphics) {
  return Object.fromEntries(['aoStrength', 'roughness', 'metalness', 'surfaceDetail', 'emission', 'waterRoughness', 'waterRipples']
    .map(key => [key, uniform(settings[key])]));
}
export function voxelMaterial(u = makeMaterialUniforms()) {
  const material = new THREE.MeshStandardNodeMaterial();
  // Work in object space so the pattern stays attached to falling fragments.
  const inside = positionGeometry.div(VOXEL_SIZE).sub(normalLocal.mul(0.001));
  const cell = floor(inside);
  const noise = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  const grain = sin(positionGeometry.x.mul(68).add(positionGeometry.z.mul(41))).mul(0.012);
  const base = attribute('voxelColor', 'vec3'), surface = attribute('surface', 'vec3');
  material.colorNode = base.mul(noise.sub(0.5).mul(0.10).add(grain).mul(u.surfaceDetail).add(1));
  material.roughnessNode = surface.x.mul(u.roughness).add(noise.sub(0.5).mul(0.06).mul(u.surfaceDetail)).clamp(0.04, 1);
  material.metalnessNode = surface.y.mul(u.metalness).clamp(0, 1);
  material.emissiveNode = base.mul(surface.z).mul(u.emission);
  // AO affects indirect light. It does not paint direct sunlight black.
  material.aoNode = float(1).sub(float(1).sub(attribute('voxelAO', 'float')).mul(u.aoStrength)).clamp(0, 1);
  return material;
}
export function waterMaterial(u = makeMaterialUniforms()) {
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x427e77, roughness: 0.19, metalness: 0.38 });
  const ripple = sin(positionLocal.x.mul(17).add(time.mul(0.8)))
    .mul(sin(positionLocal.y.mul(13).sub(time.mul(0.6))));
  material.roughnessNode = ripple.mul(0.035).mul(u.waterRipples).add(u.waterRoughness).clamp(0.04, 1);
  // A deliberately small lighting-normal effect; the water surface is not simulated.
  material.normalNode = normalView.add(vec3(ripple.mul(0.028).mul(u.waterRipples), ripple.mul(0.016).mul(u.waterRipples), 0)).normalize();
  return material;
}
export function makeSky() {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const altitude = positionLocal.normalize().y;
  material.colorNode = mix(vec3(0.78, 0.76, 0.68), vec3(0.31, 0.47, 0.56), smoothstep(float(-0.04), float(0.85), altitude));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), material);
  mesh.renderOrder = -100; mesh.frustumCulled = false; return mesh;
}
/** Small HDR sky for reflections. No image request or large texture download. */
export function environmentTexture() {
  const width = 256, height = 128, data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dy = Math.cos((y + 0.5) / height * Math.PI);
    const t = Math.max(0, dy), ground = dy < 0 ? 0.32 : 1;
    const i = (x + y * width) * 4;
    data[i] = (0.77 * (1 - t) + 0.32 * t) * ground;
    data[i + 1] = (0.79 * (1 - t) + 0.51 * t) * ground;
    data[i + 2] = (0.77 * (1 - t) + 0.67 * t) * ground;
    data[i + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.needsUpdate = true;
  return texture;
}
