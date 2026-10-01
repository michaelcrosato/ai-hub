import * as THREE from 'three/webgpu';
import { createPost } from 'kit/post.js';
import { createSceneVisuals } from './scene-factory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The 3D view on the kit's renderer: scene, lights, side-on follow camera, bloom.
 * Palaces are rebuilt with setWorld(); lights and post-processing stay.
 */
export function createView(kit) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120f27);
  scene.fog = new THREE.Fog(0x1b1734, 14, 52);

  const camera = kit.fitCamera(new THREE.PerspectiveCamera(45, 1, 0.1, 160));
  camera.position.set(5, 4, 11);
  const target = new THREE.Vector3(5, 1.8, 0);

  scene.add(new THREE.HemisphereLight(0x8fb4ce, 0x271b30, 1.55));

  // The key light travels with the camera, so shadows exist along the whole palace
  // (its fixed shadow box used to cover only the first stretch of the approach).
  const key = new THREE.DirectionalLight(0xffd2a0, 3.0);
  key.position.set(20, 18, 16);
  key.castShadow = true;
  kit.shadow(key, 2048);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 13, bottom: -8, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  // Four warm torch lights, moved per palace (a fixed count keeps the shaders unchanged).
  const lamps = [];
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.PointLight(0xff7048, 18, 10, 2);
    lamp.castShadow = false;
    scene.add(lamp);
    lamps.push(lamp);
  }

  const post = createPost(kit, scene, camera, { bloom: { strength: 0.32, radius: 0.18, threshold: 0.74 } });

  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 780;
  const ZOOMS = mobile ? [10.8, 13.4, 8.8] : [9.8, 12.8, 8.4];
  let zoomIndex = 0;
  let zoomGoal = ZOOMS[0];
  let zoom = zoomGoal;
  let cameraX = 4.5;
  let cameraY = 1.8;
  let shake = 0;
  let maxX = 138;

  let visuals = null;
  let currentWorld = null;

  function setWorld(world) {
    visuals?.dispose();
    currentWorld = world;
    visuals = createSceneVisuals({ scene, world, kit });
    const l = world.level;
    scene.background.setHex(l.atmosphere.background);
    scene.fog.color.setHex(l.atmosphere.fog);
    l.lights.forEach((p, i) => lamps[i]?.position.set(p.x, p.y, 1.8));
    maxX = l.maxX;
    const p = world.player;
    cameraX = clamp(p.x + p.facing * 0.9, 5.5, maxX - 5.5);
    cameraY = clamp(p.y + 0.7, 1.7, 6.0);
    shake = 0;
  }

  /** Mouse wheel / pinch: + zooms in. */
  function adjustZoom(amount) {
    zoomGoal = clamp(zoomGoal - amount * 0.8, 8.2, 14.8);
  }

  /** The zoom button steps through near, wide and close framings. */
  function cycleZoom() {
    zoomIndex = (zoomIndex + 1) % ZOOMS.length;
    zoomGoal = ZOOMS[zoomIndex];
  }

  function addShake(power) {
    shake = Math.min(0.5, shake + power * 0.22);
  }

  function updateCamera(world, dt) {
    const p = world.player;
    const lead = clamp(p.vx * 0.18 + p.facing * 0.9, -1.8, 1.8);
    const desiredX = clamp(p.x + lead, 5.5, maxX - 5.5);
    const desiredY = clamp(p.y + 0.7, 1.7, 6.0);
    const smooth = 1 - Math.exp(-dt * 6.8);
    cameraX += (desiredX - cameraX) * smooth;
    cameraY += (desiredY - cameraY) * smooth;
    zoom += (zoomGoal - zoom) * (1 - Math.exp(-dt * 8));

    const aspect = Math.max(0.42, kit.size.width / Math.max(1, kit.size.height));
    const portraitCompensation = Math.max(1, 0.90 / aspect);
    const z = zoom * portraitCompensation;
    let sx = 0;
    let sy = 0;
    if (shake > 0.002) {
      sx = (Math.random() - 0.5) * shake;
      sy = (Math.random() - 0.5) * shake;
      shake *= Math.exp(-dt * 9);
    } else shake = 0;
    camera.position.set(cameraX + sx, cameraY + 2.15 + sy, z);
    target.set(cameraX + sx, cameraY - 0.15 + sy, 0);
    camera.lookAt(target);

    // Follow with the key light, snapped to shadow texels so the shadow edges don't crawl.
    const texel = 36 / Math.max(256, key.shadow.mapSize.x);
    const lx = Math.round(cameraX / texel) * texel;
    key.position.set(lx + 20, 18, 16);
    key.target.position.set(lx, 0, 0);
  }

  function render(world, dt, vt) {
    if (world !== currentWorld) setWorld(world);
    visuals.sync(world, dt, vt);
    updateCamera(world, dt);
    post.render();
  }

  return {
    scene,
    camera,
    setWorld,
    render,
    adjustZoom,
    cycleZoom,
    shake: addShake,
    spawnBurst: (event) => visuals?.spawnBurst(event)
  };
}
