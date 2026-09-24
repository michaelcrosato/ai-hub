import { BufferGeometry, BufferAttribute } from 'three/webgpu';
export function makeGeometry(data) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
  geometry.setAttribute('voxelColor', new BufferAttribute(data.colors, 3));
  geometry.setAttribute('voxelAO', new BufferAttribute(data.ao, 1));
  geometry.setAttribute('surface', new BufferAttribute(data.surfaces, 3));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
