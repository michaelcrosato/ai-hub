// Shared palette: one material per surface type, reused by every mesh that needs it.
import * as THREE from 'three/webgpu';

const standard = (color, roughness, metalness, vertexColors = false) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness, flatShading: true, vertexColors });

export class Materials {
  constructor() {
    this.ground = standard('#777963', 0.93, 0.01);
    this.stone = standard('#b6a17f', 0.86, 0.02);
    this.stoneLight = standard('#d8c49f', 0.78, 0.02);
    this.charcoal = standard('#303b3d', 0.68, 0.06);
    this.moss = standard('#64715d', 0.9, 0.01);
    this.terracotta = standard('#b96142', 0.72, 0.03);
    this.player = standard('#ef8b3d', 0.56, 0.04);
    this.playerHead = standard('#f3dec1', 0.62, 0.02);
    // Instanced props take their colour per instance (setColorAt), so the base stays white.
    this.instancedStone = standard('#ffffff', 0.84, 0.02);
    this.instancedRock = standard('#ffffff', 0.94, 0.01);
    this.lamp = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff1bd'),
      emissive: new THREE.Color('#ffbd5c'),
      emissiveIntensity: 5,
      roughness: 0.38,
      metalness: 0,
    });
  }
}
