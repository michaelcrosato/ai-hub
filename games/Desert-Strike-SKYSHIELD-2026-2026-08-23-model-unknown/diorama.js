/**
 * diorama.js — the living backdrop behind the menus: the Nightjar gunship
 * hovering over a strip of red desert, lit in the selected operation's accent.
 */

import * as THREE from 'three/webgpu';
import { buildShowcaseHeli, std, mesh, GEO } from './models.js';

export function createDiorama(kit) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#29150d');
  scene.fog = new THREE.Fog('#5c3422', 14, 46);
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(37, 1, 0.1, 200));
  camera.position.set(11, 7, 15);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight('#e8ba83', 0.62));
  const sun = new THREE.DirectionalLight('#ffd091', 2.35);
  sun.position.set(7, 12, 5);
  sun.castShadow = true;
  kit.shadow(sun, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const accentLight = new THREE.PointLight('#69d8cd', 28, 23);
  accentLight.position.set(-8, 1, -5);
  scene.add(accentLight);

  // drei <Float speed 1.1 floatIntensity 0.38 rotationIntensity 0.08> around the gunship.
  const float = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(2.3, 0.5, 0);
  holder.scale.setScalar(1.28);
  const heli = buildShowcaseHeli('#5c6159');
  holder.add(heli.group);
  float.add(holder);
  scene.add(float);
  const offset = Math.random() * 1e4;

  // The ground strip: plane, 32 props and a grid, 5.6 below the gunship.
  const ground = new THREE.Group();
  ground.position.y = -5.6;
  const plane = new THREE.PlaneGeometry(80, 50);
  ground.add(mesh(plane, std('#8b5335', { roughness: 0.98 }), { r: [-Math.PI / 2, 0, 0], receive: true }));
  for (let n = 0; n < 32; n++) {
    const x = -12 + (n % 9) * 3.1 + Math.sin(n * 2.3);
    const z = -8 + Math.floor(n / 9) * 4.2 + Math.cos(n);
    const h = 1 + ((n * 7) % 6) * 0.62;
    const w = 1.2 + ((n * 5) % 4) * 0.42;
    const kind = n % 7;
    if (kind < 2) {
      ground.add(mesh(GEO.dodeca, std(n % 2 ? '#b77749' : '#9f633e', { roughness: 1, flatShading: true }), { p: [x, 0.12, z], r: [-0.16, n * 0.4, 0], s: [w * 2.5, 0.13, w * 1.4] }));
    } else if (kind === 2) {
      const g = new THREE.Group();
      g.position.set(x, 0.24, z);
      g.rotation.set(-0.28, 0.4, 0);
      g.add(mesh(GEO.box, std('#17343a', { metalness: 0.7 }), { s: [2.1, 0.07, 1.25] }), mesh(GEO.box, std('#554338'), { p: [0, -0.35, 0], s: [0.06, 0.55, 0.06] }));
      ground.add(g);
    } else {
      ground.add(mesh(GEO.dodeca, std(n % 3 === 0 ? '#6f4434' : '#81513a', { roughness: 0.92, flatShading: true }), { p: [x, h / 2, z], s: [w, h, w], cast: n % 6 === 0 }));
    }
  }
  const grid = new THREE.GridHelper(70, 35, '#b67a4d', '#74472f');
  grid.position.y = 0.02;
  ground.add(grid);
  scene.add(ground);

  let t = 0;
  return {
    scene,
    camera,
    setAccent(color) {
      accentLight.color.set(color);
    },
    update(dt, reduced) {
      if (reduced) return false;
      t += dt;
      const k = offset + t;
      const sp = 1.1;
      float.rotation.x = (Math.cos((k / 4) * sp) / 8) * 0.08;
      float.rotation.y = (Math.sin((k / 4) * sp) / 8) * 0.08;
      float.rotation.z = (Math.sin((k / 4) * sp) / 20) * 0.08;
      float.position.y = (Math.sin((k / 4) * sp) / 10) * 0.38;
      heli.update(dt, t, true);
      return true;
    },
  };
}
