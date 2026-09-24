import * as THREE from 'three';
import * as TSL from 'three/tsl';
import { bootGame } from './game.js';

let renderer;
let backend = 'WebGPU';
try {
  renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  await renderer.init();
  backend = navigator.gpu ? 'WebGPU' : 'WebGL2';
} catch (err) {
  console.warn('WebGPU init failed; trying WebGL2 backend.', err);
  renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL: true, powerPreference: 'high-performance' });
  await renderer.init();
  backend = 'WebGL2';
}

renderer.setClearColor(0x071117, 1);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

await bootGame({ THREE, TSL, renderer, backend, legacy: false });
