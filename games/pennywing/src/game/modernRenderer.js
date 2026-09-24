import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createGameScene } from './sceneFactory.js';

export async function createModernRenderer(container, { forceWebGL = false } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 180);
  const isCoarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const maxDpr = isCoarse ? 1.55 : 2.0;
  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL, outputBufferType: isCoarse ? THREE.UnsignedByteType : THREE.HalfFloatType });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  await renderer.init();

  const shadowSize = isCoarse ? 1024 : 2048;
  const world = createGameScene(THREE, scene, { legacy: false, shadowSize });

  let pipeline = null;
  try {
    pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera, {
      storeMultisampledColorBuffer: false,
      storeMultisampledDepthBuffer: false,
      storeMultisampledStencilBuffer: false,
      resolveColorBuffer: true,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
    });
    const color = scenePass.getTextureNode('output');
    const glow = bloom(color);
    glow.threshold.value = 0.72;
    glow.strength.value = isCoarse ? 0.22 : 0.30;
    glow.radius.value = 0.45;
    pipeline.outputNode = color.add(glow);
  } catch (err) {
    console.warn('Post-processing disabled:', err);
    pipeline = null;
  }

  const backendName = renderer.backend?.constructor?.name || '';
  const backend = forceWebGL ? 'WebGL 2' : (/webgpu/i.test(backendName) ? 'WebGPU' : 'WebGL 2');
  let camDistance = innerHeight > innerWidth ? 22.5 : (isCoarse ? 17.3 : 16.2);
  let targetX = 4, targetY = 2.4;

  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h);
    if (h > w) camDistance = Math.max(camDistance, 21.0);
  }

  function render(snapshot, t, input) {
    if (input?.zoomDelta) camDistance = THREE.MathUtils.clamp(camDistance + input.zoomDelta, 11.5, innerHeight > innerWidth ? 27 : 23);
    world.update(snapshot, t);
    const p = snapshot.player;
    const bossFocus = snapshot.boss.active && snapshot.boss.alive;
    const lead = snapshot.phase === 'escape' ? -2.1 : (p.facing || 1) * 1.7;
    const desiredX = bossFocus ? 71.2 : THREE.MathUtils.clamp(p.x + lead, 4.4, 86.3);
    const desiredY = bossFocus ? 2.7 : THREE.MathUtils.clamp(p.y + 2.35, 0.7, 6.4);
    targetX = THREE.MathUtils.lerp(targetX, desiredX, 0.075);
    targetY = THREE.MathUtils.lerp(targetY, desiredY, 0.075);
    camera.position.x = targetX;
    camera.position.y = targetY + 0.8;
    camera.position.z = camDistance;
    camera.lookAt(targetX, targetY - 0.2, 0);

    // Move the shadow window with the player so the 90-unit level stays sharp without a huge shadow map.
    world.key.position.x = targetX + 11;
    world.key.position.y = targetY + 18;
    world.key.target.position.set(targetX, targetY, 0);
    world.key.target.updateMatrixWorld();

    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();
  return {
    backend,
    render,
    resize,
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
