import * as THREE from 'three-legacy';
import { startGame } from './game.js';

export async function bootLegacy() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.querySelector('#game-shell').prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 240);
  startGame({ THREE, renderer, scene, camera, render: () => renderer.render(scene, camera), backendLabel: 'WebGL1 fallback · Three r162', modern: false });
}
