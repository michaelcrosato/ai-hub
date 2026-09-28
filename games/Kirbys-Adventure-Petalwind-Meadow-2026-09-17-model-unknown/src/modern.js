import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { startGame } from './game.js';

export async function bootModern({ forceWebGL = false } = {}) {
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    alpha: false,
    forceWebGL,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.querySelector('#game-shell').prepend(renderer.domElement);
  await renderer.init();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 240);
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, {
    storeMultisampledColorBuffer: false,
    storeMultisampledDepthBuffer: false,
    storeMultisampledStencilBuffer: false,
    resolveColorBuffer: true,
    resolveDepthBuffer: false,
    resolveStencilBuffer: false
  });
  const color = scenePass.getTextureNode('output');
  const glow = bloom(color, 0.3, 0.2, 0.72);
  pipeline.outputNode = color.add(glow);

  const backendName = renderer.backend?.constructor?.name || (forceWebGL ? 'WebGL2' : 'WebGPU');
  const label = /WebGPU/i.test(backendName) ? 'WebGPU · Three r186' : 'WebGL2 fallback · Three r186';
  startGame({ THREE, renderer, scene, camera, render: () => pipeline.render(), backendLabel: label, modern: true });
}
