// water.js — one large water plane that follows the camera: rolling normals and
// a fresnel blend toward the sky colour (the old onBeforeCompile shader, in TSL).
import * as THREE from 'three/webgpu';
import { uniform, vec4, sin, mix, pow, clamp, dot, normalize, normalView, positionViewDirection, positionWorld, cameraViewMatrix } from 'three/tsl';
import { CONFIG } from './terrain.js';

class WaterMaterial extends THREE.MeshStandardNodeMaterial {
  constructor(params, sky) {
    super(params);
    this.skyNode = sky;
  }

  /** Blend the lit colour toward the sky at grazing angles, before fog (as the old shader did). */
  setupOutput(builder, outputNode) {
    const fresnel = pow(clamp(dot(normalView, positionViewDirection), 0, 1).oneMinus(), 4);
    const blended = vec4(mix(outputNode.rgb, this.skyNode, fresnel.mul(0.52)), outputNode.a);
    return super.setupOutput(builder, blended);
  }

  customProgramCacheKey() {
    return `${super.customProgramCacheKey()}:wildlands-water`;
  }
}

export class Water {
  constructor(game) {
    this.game = game;
    this.uTime = uniform(0);
    this.uOrigin = uniform(new THREE.Vector2());
    this.uSky = uniform(new THREE.Color('#8abebc'));
    this.material = new WaterMaterial({ color: '#318f92', roughness: 0.25, metalness: 0.18, side: THREE.DoubleSide }, this.uSky);
    const world = positionWorld.xz.add(this.uOrigin);
    const w1 = sin(world.x.mul(0.11).add(world.y.mul(0.07)).add(this.uTime.mul(0.85)));
    const w2 = sin(world.y.mul(0.17).sub(world.x.mul(0.055)).sub(this.uTime.mul(0.61)));
    this.material.normalNode = normalize(normalView.add(cameraViewMatrix.mul(vec4(w1.mul(0.11), 0, w2.mul(0.09), 0)).xyz));
    this.geometry = new THREE.PlaneGeometry(60000, 60000);
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.position.y = CONFIG.waterLevel;
    game.scene.add(this.mesh);
  }

  update(dt) {
    const game = this.game;
    this.uTime.value += dt;
    this.uOrigin.value.set(game.origin.x, game.origin.z);
    this.uSky.value.copy(game.lighting.skyHorizon);
    this.mesh.position.x = game.camera.position.x;
    this.mesh.position.z = game.camera.position.z;
  }
}
