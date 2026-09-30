// Rain and snow: instanced streaks and flakes in a box that travels with the camera.

import * as THREE from 'three/webgpu';

const RANGE = 46; // half-width of the box around the camera
const HEIGHT = 36; // half-height
const wrap = (v, center, half) => {
  const d = v - center + half;
  return center - half + (d - Math.floor(d / (half * 2)) * half * 2);
};

class Field {
  constructor(scene, count, geometry, material, speed, sway) {
    this.max = count;
    this.speed = speed;
    this.sway = sway;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count);
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < count; i++) {
      const k = i * 16;
      m.fill(0, k, k + 16);
      m[k] = m[k + 5] = m[k + 10] = m[k + 15] = 1;
      this.vel[i] = speed * (0.8 + Math.random() * 0.4);
    }
    this.placed = false;
    scene.add(this.mesh);
  }

  scatter(cam) {
    for (let i = 0; i < this.max; i++) {
      this.pos[i * 3] = cam.x + (Math.random() * 2 - 1) * RANGE;
      this.pos[i * 3 + 1] = cam.y + (Math.random() * 2 - 1) * HEIGHT;
      this.pos[i * 3 + 2] = cam.z + (Math.random() * 2 - 1) * RANGE;
    }
    this.placed = true;
  }

  update(dt, cam, amount, time) {
    const count = Math.round(this.max * amount);
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    if (!count) return;
    if (!this.placed) this.scatter(cam);
    const p = this.pos;
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      // World-anchored drops, wrapped into the box around the camera (so flying through rain has parallax).
      const x = wrap(p[k] + (this.sway ? Math.sin(time * 1.3 + i) * this.sway * dt : dt * 2.5), cam.x, RANGE);
      const y = wrap(p[k + 1] - this.vel[i] * dt, cam.y, HEIGHT);
      const z = wrap(p[k + 2], cam.z, RANGE);
      p[k] = x;
      p[k + 1] = y;
      p[k + 2] = z;
      const o = i * 16;
      m[o + 12] = x;
      m[o + 13] = y;
      m[o + 14] = z;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Precipitation {
  constructor(scene, kit) {
    this.kit = kit;
    // Unlit, so their colour follows the daylight by hand (no bright streaks at night).
    this.rainColor = new THREE.Color(0xd3dde4);
    this.snowColor = new THREE.Color(0xf5f8fb);
    this.rainMaterial = new THREE.MeshBasicMaterial({ color: this.rainColor, transparent: true, opacity: 0.42, depthWrite: false });
    this.snowMaterial = new THREE.MeshBasicMaterial({ color: this.snowColor, transparent: true, opacity: 0.92, depthWrite: false });
    this.rain = new Field(scene, kit.detail(1500, 300), new THREE.BoxGeometry(0.06, 1.7, 0.06), this.rainMaterial, 34, 0);
    this.snow = new Field(scene, kit.detail(900, 200), new THREE.BoxGeometry(0.26, 0.26, 0.26), this.snowMaterial, 4.2, 1.4);
    this.time = 0;
    this.light = -1;
  }

  /** Show one drop and one flake (or hide them again), so their pipelines can be built ahead of time. */
  preview(on) {
    for (const field of [this.rain, this.snow]) {
      field.mesh.count = on ? 1 : 0;
      field.mesh.visible = on;
    }
  }

  /** amount 0..1 of precipitation; snowy picks flakes over streaks; light 0..1 dims them at night. */
  update(dt, camera, amount, snowy, light = 1) {
    this.time += dt;
    const cam = camera.position;
    if (Math.abs(light - this.light) > 0.01) {
      this.light = light;
      this.rainMaterial.color.copy(this.rainColor).multiplyScalar(light);
      this.snowMaterial.color.copy(this.snowColor).multiplyScalar(light);
    }
    this.rain.update(dt, cam, snowy ? 0 : amount, this.time);
    this.snow.update(dt, cam, snowy ? amount : 0, this.time);
  }
}
