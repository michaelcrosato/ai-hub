import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { createSceneVisuals } from './scene-factory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function createModernRenderer(canvas, world, { forceWebGL = false } = {}) {
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 780;
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
    forceWebGL
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);

  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120f27);
  scene.fog = new THREE.Fog(0x1b1734, 14, 52);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 160);
  camera.position.set(5, 4, 11);
  const target = new THREE.Vector3(5, 1.8, 0);

  const visuals = createSceneVisuals({ THREE, scene, world, modern: true });

  let pipeline = null;
  let bloomPass = null;
  try {
    const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
    pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera, {
      storeMultisampledColorBuffer: false,
      storeMultisampledDepthBuffer: false,
      storeMultisampledStencilBuffer: false,
      resolveColorBuffer: true,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false
    });
    const sceneColor = scenePass.getTextureNode('output');
    bloomPass = bloom(sceneColor, mobile ? 0.26 : 0.34, 0.18, 0.74);
    bloomPass.setResolutionScale?.(mobile ? 0.42 : 0.5);
    pipeline.outputNode = sceneColor.add(bloomPass);
  } catch (err) {
    console.warn('TSL bloom unavailable; continuing without post-processing.', err);
  }

  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : renderer.backend?.isWebGLBackend ? 'WebGL 2 fallback' : forceWebGL ? 'WebGL 2 forced' : 'Modern renderer';
  let zoom = mobile ? 10.8 : 9.8;
  let cameraX = 4.5;
  let cameraY = 1.8;
  let pipelineFailed = false;

  function resize() {
    const mobileNow = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 780;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobileNow ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  function adjustZoom(delta) {
    zoom = clamp(zoom + delta, 8.2, 14.8);
  }

  function updateCamera(worldState, dt) {
    const p = worldState.player;
    const lead = clamp(p.vx * 0.18 + p.facing * 0.9, -1.8, 1.8);
    const desiredX = clamp(p.x + lead, 5.5, 132.5);
    const desiredY = clamp(p.y + 0.7, 1.7, 6.0);
    const smooth = 1 - Math.exp(-dt * 6.8);
    cameraX += (desiredX - cameraX) * smooth;
    cameraY += (desiredY - cameraY) * smooth;

    const aspect = Math.max(0.42, innerWidth / Math.max(1, innerHeight));
    const portraitCompensation = Math.max(1, 0.90 / aspect);
    const z = zoom * portraitCompensation;
    camera.position.set(cameraX, cameraY + 2.15, z);
    target.set(cameraX, cameraY - 0.15, 0);
    camera.lookAt(target);
  }

  function render(worldState, dt) {
    visuals.sync(worldState, dt);
    updateCamera(worldState, dt);
    if (pipeline && !pipelineFailed) {
      try {
        pipeline.render();
        return;
      } catch (err) {
        pipelineFailed = true;
        console.warn('RenderPipeline failed; falling back to direct render.', err);
      }
    }
    renderer.render(scene, camera);
  }

  function setAnimationLoop(fn) {
    renderer.setAnimationLoop(fn);
  }

  function spawnBurst(event) {
    visuals.spawnBurst(event);
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    bloomPass?.dispose?.();
    pipeline?.dispose?.();
    visuals.dispose();
    renderer.dispose();
  }

  return { backend, render, resize, adjustZoom, setAnimationLoop, spawnBurst, dispose, renderer, scene, camera };
}
