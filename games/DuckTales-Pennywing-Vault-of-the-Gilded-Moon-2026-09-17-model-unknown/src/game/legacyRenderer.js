import * as THREE from 'three-legacy';
import { createGameScene } from './sceneFactory.js';

export async function createLegacyRenderer(container) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl');
  if (!context) throw new Error('WebGL 1 is not available.');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 160);
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  container.appendChild(canvas);

  const world = createGameScene(THREE, scene, { legacy: true, shadowSize: 0 });
  let camDistance = innerHeight > innerWidth ? 23.5 : 17.8;
  let targetX = 4, targetY = 2.4;

  function resize() {
    camera.aspect = innerWidth / Math.max(1, innerHeight);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
    renderer.setSize(innerWidth, innerHeight);
  }

  function render(snapshot, t, input) {
    if (input?.zoomDelta) camDistance = THREE.MathUtils.clamp(camDistance + input.zoomDelta, 12, innerHeight > innerWidth ? 27 : 23);
    world.update(snapshot, t);
    const p = snapshot.player;
    const bossFocus = snapshot.boss.active && snapshot.boss.alive;
    const lead = snapshot.phase === 'escape' ? -2.0 : (p.facing || 1) * 1.6;
    const desiredX = bossFocus ? 71.2 : THREE.MathUtils.clamp(p.x + lead, 4.4, 86.3);
    const desiredY = bossFocus ? 2.7 : THREE.MathUtils.clamp(p.y + 2.35, 0.7, 6.4);
    targetX = THREE.MathUtils.lerp(targetX, desiredX, 0.08);
    targetY = THREE.MathUtils.lerp(targetY, desiredY, 0.08);
    camera.position.set(targetX, targetY + 0.8, camDistance);
    camera.lookAt(targetX, targetY - 0.2, 0);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();
  return {
    backend: 'WebGL 1',
    render,
    resize,
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      canvas.remove();
    }
  };
}
