import * as THREE from 'three-legacy';
import { createSceneVisuals } from './scene-factory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function createLegacyRenderer(canvas, world) {
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 780;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.2 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);

  const context = renderer.getContext();
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext;
  const backend = isWebGL2 ? 'Legacy three.js r162 / WebGL 2' : 'Legacy three.js r162 / WebGL 1';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120f27);
  scene.fog = new THREE.Fog(0x1b1734, 13, 46);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 160);
  const target = new THREE.Vector3();
  const visuals = createSceneVisuals({ THREE, scene, world, modern: false });

  let zoom = mobile ? 11.2 : 10.2;
  let cameraX = 4.5;
  let cameraY = 1.8;

  function resize() {
    const mobileNow = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 780;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobileNow ? 1.2 : 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  function adjustZoom(delta) {
    zoom = clamp(zoom + delta, 8.4, 15.2);
  }

  function render(worldState, dt) {
    visuals.sync(worldState, dt);
    const p = worldState.player;
    const lead = clamp(p.vx * 0.18 + p.facing * 0.9, -1.8, 1.8);
    const desiredX = clamp(p.x + lead, 5.5, 132.5);
    const desiredY = clamp(p.y + 0.7, 1.7, 6.0);
    const smooth = 1 - Math.exp(-dt * 6.2);
    cameraX += (desiredX - cameraX) * smooth;
    cameraY += (desiredY - cameraY) * smooth;
    const aspect = Math.max(0.42, innerWidth / Math.max(1, innerHeight));
    const portraitCompensation = Math.max(1, 0.90 / aspect);
    camera.position.set(cameraX, cameraY + 2.15, zoom * portraitCompensation);
    target.set(cameraX, cameraY - 0.15, 0);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function setAnimationLoop(fn) { renderer.setAnimationLoop(fn); }
  function spawnBurst(event) { visuals.spawnBurst(event); }
  function dispose() {
    renderer.setAnimationLoop(null);
    visuals.dispose();
    renderer.dispose();
  }

  return { backend, render, resize, adjustZoom, setAnimationLoop, spawnBurst, dispose, renderer, scene, camera };
}
