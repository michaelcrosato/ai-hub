// A low-poly helicopter circling the house with a searchlight sweeping the yard.
import * as THREE from 'three/webgpu';

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s += 1831565813;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Helicopter {
  constructor(scene, mats, center, director) {
    this.scene = scene;
    this.roomCenter = center;
    this.root = new THREE.Group();
    this.rotor = new THREE.Group();
    this.lightMount = new THREE.Object3D();
    this.searchTarget = new THREE.Object3D();
    this.lookTarget = new THREE.Vector3();
    this.desiredSearchTarget = new THREE.Vector3();
    this.random = seededRandom(75368977);
    this.phase = this.random() * Math.PI * 2;
    this.radius = 20 + this.random() * 4;
    this.targetRadius = this.radius;
    this.height = 18 + this.random() * 4;
    this.targetHeight = this.height;
    this.speed = 0.08;
    this.targetSpeed = 0.08;
    this.routeTimer = 8;
    this.elapsed = 0;
    this.enabled = true;
    this.root.name = 'helicopter-searchlight-rig';
    this.centerX = this.targetCenterX = center.x;
    this.centerZ = this.targetCenterZ = center.z;

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 1.35), mats.charcoal);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.76, 8, 6), mats.playerHead);
    canopy.scale.set(1, 0.72, 0.8);
    canopy.position.set(0, 0.05, -0.95);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 3.2), mats.charcoal);
    tail.position.z = 2.15;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.75), mats.terracotta);
    fin.position.set(0, 0.5, 3.55);
    this.rotor.position.y = 0.65;
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.07, 0.18), mats.stoneLight);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 6.2), mats.stoneLight);
    this.rotor.add(bladeA, bladeB);
    const skidA = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 6), mats.charcoal);
    skidA.rotation.z = Math.PI / 2;
    skidA.position.set(-0.72, -0.72, 0);
    const skidB = skidA.clone();
    skidB.position.x = 0.72;
    this.emitterMaterial = mats.lamp.clone();
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), this.emitterMaterial);
    emitter.position.set(0, -0.65, -0.3);
    emitter.castShadow = false;
    for (const m of [body, canopy, tail, fin, bladeA, bladeB, skidA, skidB]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    this.searchlight = new THREE.SpotLight('#dbeaff', 2600, 55, Math.PI * 0.17, 0.48, 2);
    this.searchlight.name = 'helicopter-searchlight';
    this.lightMount.position.set(0, -0.75, -0.3);
    this.searchlight.target = this.searchTarget;
    this.searchlight.castShadow = true;
    this.searchlight.shadow.bias = -35e-5;
    this.searchlight.shadow.normalBias = 0.04;
    this.searchlight.shadow.camera.near = 1.4;
    this.searchlight.shadow.camera.far = 55;
    this.searchlight.shadow.autoUpdate = false;
    this.root.add(body, canopy, tail, fin, this.rotor, skidA, skidB, emitter, this.lightMount);
    scene.add(this.root, this.searchTarget, this.searchlight);

    this.lightHandle = director.add({
      id: 'helicopter-light',
      label: 'Helicopter searchlight',
      fixture: 'airborne-searchlight',
      zone: 'exterior',
      mobility: 'animated',
      light: this.searchlight,
      root: this.root,
      emitter: this.emitterMaterial,
      intensity: 2600,
      emissiveIntensity: 5,
      temperatureK: 6700,
      sourceRadius: 0.42,
      importance: 0.95,
      shadow: 'important',
      shadowMinQuality: 'low',
      shadowDistance: 55,
      shadowFps: { low: 12, medium: 20, high: 30, ultra: 60 },
    });
    this.lightControl = {
      id: 'helicopter-light',
      label: 'Helicopter searchlight',
      room: 'exterior',
      root: this.root,
      maxDistance: 120,
      isEnabled: () => this.enabled,
      setEnabled: (on) => this.setEnabled(on),
    };
    this.setEnabled(true);
  }

  /** Returns true when it moved (so shadows near it need a refresh). */
  update(dt) {
    this.elapsed += dt;
    this.routeTimer -= dt;
    if (this.routeTimer <= 0) {
      this.targetRadius = 18 + this.random() * 7;
      this.targetHeight = 17 + this.random() * 7;
      this.targetCenterX = this.roomCenter.x + (this.random() - 0.5) * 8;
      this.targetCenterZ = this.roomCenter.z + (this.random() - 0.5) * 8;
      this.targetSpeed = 0.055 + this.random() * 0.055;
      this.routeTimer = 10 + this.random() * 10;
    }
    const k = 1 - Math.exp(-0.18 * dt);
    this.radius += (this.targetRadius - this.radius) * k;
    this.height += (this.targetHeight - this.height) * k;
    this.centerX += (this.targetCenterX - this.centerX) * k;
    this.centerZ += (this.targetCenterZ - this.centerZ) * k;
    this.speed += (this.targetSpeed - this.speed) * k;
    this.phase += dt * this.speed;
    const x = this.centerX + Math.cos(this.phase) * this.radius;
    const z = this.centerZ + Math.sin(this.phase) * this.radius;
    const y = this.height + Math.sin(this.elapsed * 0.41) * 1.1;
    this.root.position.set(x, y, z);
    this.lookTarget.set(this.centerX + Math.cos(this.phase - 0.06) * this.radius, y, this.centerZ + Math.sin(this.phase - 0.06) * this.radius);
    this.root.lookAt(this.lookTarget);
    this.rotor.rotation.y += dt * 18;
    this.desiredSearchTarget.set(this.roomCenter.x + Math.sin(this.elapsed * 0.29) * 16, 0.12, this.roomCenter.z + Math.cos(this.elapsed * 0.23) * 16);
    this.root.updateMatrixWorld(true);
    this.lightMount.getWorldPosition(this.searchlight.position);
    this.searchTarget.position.copy(this.desiredSearchTarget);
    this.searchlight.updateMatrixWorld(true);
    this.searchTarget.updateMatrixWorld(true);
    if (this.enabled) this.lightHandle.invalidate();
    return true;
  }

  setEnabled(on) {
    this.enabled = on;
    this.lightHandle.setEnabled(on);
    this.emitterMaterial.emissiveIntensity = on ? 5 : 0.03;
    this.emitterMaterial.color.set(on ? '#e8f3ff' : '#303435');
    if (on) this.lightHandle.invalidate(true);
  }
}
