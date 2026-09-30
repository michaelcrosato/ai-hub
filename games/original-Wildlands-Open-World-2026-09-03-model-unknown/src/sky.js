// sky.js — sun and moon, sky dome, cascaded sun shadows, clouds, the lantern and fog.
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec3, vec4, float, positionLocal, normalize, max, pow, mix, dot, smoothstep, step, fract, floor, sin } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { lerp, smoothstep as smooth, seededRandom } from './terrain.js';

const C = {
  topNight: new THREE.Color('#142941'),
  topDay: new THREE.Color('#64a5c0'),
  horizonNight: new THREE.Color('#263d51'),
  horizonDay: new THREE.Color('#d1ddd2'),
  horizonWarm: new THREE.Color('#e6b884'),
  hemiNight: new THREE.Color('#7397bb'),
  hemiDay: new THREE.Color('#bddde8'),
  groundNight: new THREE.Color('#242f2c'),
  groundDay: new THREE.Color('#6a7353'),
  sunWarm: new THREE.Color('#ffe4ba'),
  sunWhite: new THREE.Color('#fff6e5'),
  moon: new THREE.Color('#a1bfdc'),
};

/** Cheap 3D hash for the star field (the original GLSL, in TSL). */
const hash3 = Fn(([p0]) => {
  const p = fract(p0.mul(0.3183099).add(vec3(0.1, 0.2, 0.3))).mul(17.0).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
});

export class Lighting {
  constructor(game) {
    this.game = game;
    const { scene, kit } = game;
    this.hours = 16.8;
    this.cycle = false;
    this.lanternEnabled = false;
    this.day = 1;
    this.time = 0;
    this.sun = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.skyTop = new THREE.Color();
    this.skyHorizon = new THREE.Color();
    this.sunColor = new THREE.Color();

    this.hemi = new THREE.HemisphereLight('#b4d9e3', '#536242', 1.8);
    scene.add(this.hemi);

    // One sun; CSMShadowNode splits its shadow into three cascades that follow the camera.
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
    this.sunLight.castShadow = true;
    const sh = this.sunLight.shadow;
    sh.camera.near = 1;
    sh.camera.far = 15000;
    sh.bias = -2e-6;
    sh.normalBias = 1.4;
    sh.radius = 2;
    this.csm = new CSMShadowNode(this.sunLight, { cascades: 3, maxFar: game.view.shadowFar, mode: 'practical', lightMargin: 4000 });
    this.csm.fade = true;
    sh.shadowNode = this.csm;
    scene.add(this.sunLight, this.sunLight.target);
    this.applyShadowSize();
    kit.onQuality(() => this.applyShadowSize());

    // Sky dome: gradient, sun disk and glow, moon, twinkling stars.
    this.uTop = uniform(new THREE.Color('#6bafc5'));
    this.uHorizon = uniform(new THREE.Color('#d4ded3'));
    this.uSun = uniform(this.sun);
    this.uDay = uniform(1);
    this.uTime = uniform(0);
    const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
    skyMaterial.colorNode = Fn(() => {
      const d = normalize(positionLocal);
      const h = max(d.y, 0.0);
      const color = mix(this.uHorizon, this.uTop, pow(h, 0.52)).toVar();
      const sd = max(dot(d, this.uSun), 0.0);
      const warm = pow(sd, 8.0).mul(float(1).sub(smoothstep(0.05, 0.55, this.uSun.y)));
      color.addAssign(vec3(0.32, 0.14, 0.035).mul(warm).mul(this.uDay));
      const disk = smoothstep(0.99972, 0.99986, sd);
      color.addAssign(vec3(1.0, 0.77, 0.43).mul(disk.mul(3.0).add(pow(sd, 180.0).mul(0.14))).mul(this.uDay));
      const moon = dot(d, this.uSun.negate());
      color.addAssign(vec3(0.62, 0.76, 0.89).mul(smoothstep(0.99978, 0.9999, moon)).mul(float(1).sub(this.uDay)).mul(1.6));
      const star = hash3(floor(d.mul(660.0)));
      const stars = step(0.9984, star).mul(pow(h, 0.4)).mul(float(1).sub(this.uDay));
      color.addAssign(vec3(stars.mul(0.7).mul(sin(this.uTime.add(star.mul(3000.0))).mul(0.2).add(0.8))));
      return vec4(color, 1.0);
    })();
    this.skyMaterial = skyMaterial;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    scene.add(this.sky);

    // The lantern stays in the scene at zero intensity when off, so switching it on never rebuilds a pipeline;
    // its shadow map is only rendered while it is lit.
    this.lantern = new THREE.SpotLight('#ffdfa4', 0, 150, Math.PI / 5.5, 0.65, 2);
    this.lantern.castShadow = true;
    kit.shadow(this.lantern, 1024);
    this.lantern.shadow.bias = -5e-5;
    this.lantern.shadow.normalBias = 0.035;
    this.lantern.shadow.camera.near = 0.15;
    this.lantern.shadow.camera.far = 150;
    this.lantern.shadow.autoUpdate = false;
    scene.add(this.lantern, this.lantern.target);

    // Clouds: 54 flat-shaded puffs that drift and wrap around the player.
    this.cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: '#e2e7df', roughness: 1, flatShading: true });
    this.clouds = new THREE.InstancedMesh(this.cloudGeometry, this.cloudMaterial, 54);
    this.clouds.castShadow = true;
    this.clouds.receiveShadow = true;
    this.clouds.frustumCulled = false;
    const rnd = seededRandom(7124);
    this.cloudData = Array.from({ length: 54 }, () => ({
      x: (rnd() - 0.5) * 23000,
      z: (rnd() - 0.5) * 23000,
      y: 2250 + rnd() * 650,
      sx: 140 + rnd() * 360,
      sy: 35 + rnd() * 70,
      sz: 75 + rnd() * 150,
    }));
    this.dummy = new THREE.Object3D();
    scene.add(this.clouds);
    this.lastCloudUpdate = -10;
    this.update(0);
  }

  /** Shadow maps follow the kit's quality tier (2048 at high). */
  applyShadowSize() {
    const size = this.game.kit.shadowSize(2048);
    this.sunLight.shadow.mapSize.set(size, size);
    for (const light of this.csm.lights) light.shadow.mapSize.set(size, size);
  }

  /** The view distance changed: longer cascades, a little more normal bias. */
  setView(view) {
    this.csm.maxFar = view.shadowFar;
    const bias = view.shadowFar > 2200 ? 1.6 : 1.4;
    this.sunLight.shadow.normalBias = bias;
    for (const light of this.csm.lights) light.shadow.normalBias = bias;
    this.refreshCascades();
  }

  /** Cascades are fitted to the camera frustum; they exist after the first render. */
  refreshCascades() {
    if (this.csm.camera) this.csm.updateFrustums();
  }

  update(dt) {
    const game = this.game;
    const camera = game.camera;
    this.time += dt;
    if (this.cycle) this.hours = (this.hours + dt / 75) % 24;
    const angle = ((this.hours - 6) / 24) * Math.PI * 2;
    this.sun.set(Math.cos(angle) * 0.84, Math.sin(angle), 0.32).normalize();
    const day = smooth(-0.12, 0.18, this.sun.y);
    this.day = day;
    const low = 1 - smooth(0.03, 0.48, Math.abs(this.sun.y));
    this.skyTop.copy(C.topNight).lerp(C.topDay, day);
    this.skyHorizon.copy(C.horizonNight).lerp(C.horizonDay, day);
    this.skyHorizon.lerp(C.horizonWarm, low * day * 0.52);
    this.uTop.value.copy(this.skyTop);
    this.uHorizon.value.copy(this.skyHorizon);
    this.uDay.value = day;
    this.uTime.value = this.time;
    this.sky.position.copy(camera.position);
    this.sky.scale.setScalar(camera.far * 0.8);

    this.hemi.intensity = lerp(0.28, 1.65, day);
    this.hemi.color.copy(C.hemiNight).lerp(C.hemiDay, day);
    this.hemi.groundColor.copy(C.groundNight).lerp(C.groundDay, day);

    // Light travels from the sun (or the moon, opposite it) toward the ground, never flatter than ~7°.
    this.direction.copy(this.sun).multiplyScalar(this.sun.y >= 0 ? -1 : 1);
    this.direction.y = -Math.max(0.12, Math.abs(this.direction.y));
    this.direction.normalize();
    this.sunLight.target.position.copy(camera.position);
    this.sunLight.position.copy(camera.position).addScaledVector(this.direction, -1000);
    this.sunLight.intensity = this.sun.y >= 0 ? lerp(1.4, 3.2, smooth(0, 0.4, this.sun.y)) : 0.45;
    if (this.sun.y >= 0) this.sunColor.copy(C.sunWarm).lerp(C.sunWhite, 1 - low);
    else this.sunColor.copy(C.moon);
    this.sunLight.color.copy(this.sunColor);

    if (!game.underwater) {
      const fog = game.scene.fog;
      fog.color.copy(this.skyHorizon);
      fog.near = game.view.distance * (game.haze ? 0.28 : 0.6);
      fog.far = game.view.distance * 0.97;
    }

    this.lantern.intensity = this.lanternEnabled ? 1100 : 0;
    this.lantern.shadow.autoUpdate = this.lanternEnabled;
    this.lantern.position.copy(camera.position);
    this.lantern.position.y -= 0.2;
    camera.getWorldDirection(this.direction);
    this.lantern.target.position.copy(camera.position).addScaledVector(this.direction, 15);

    if (this.time - this.lastCloudUpdate > 0.2 || dt === 0) {
      const p = game.player?.position || { x: -580, z: 1150 };
      const origin = game.origin;
      for (let i = 0; i < this.cloudData.length; i++) {
        const c = this.cloudData[i];
        const x = ((((c.x + this.time * 2 - p.x + 34500) % 23000) + 23000) % 23000) - 11500 + p.x;
        const z = ((((c.z - p.z + 34500) % 23000) + 23000) % 23000) - 11500 + p.z;
        this.dummy.position.set(x - origin.x, c.y, z - origin.z);
        this.dummy.scale.set(c.sx, c.sy, c.sz);
        this.dummy.updateMatrix();
        this.clouds.setMatrixAt(i, this.dummy.matrix);
      }
      this.clouds.instanceMatrix.needsUpdate = true;
      this.lastCloudUpdate = this.time;
    }
  }
}
