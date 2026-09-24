import { startGame } from './game.js';

const loadStatus = document.getElementById('loadStatus');
const deployButton = document.getElementById('deployButton');
let booted = false;
let game = null;

function detectCaps() {
  const canvas = document.createElement('canvas');
  const webgl2 = !!canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  const webgl1 = !!(canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || canvas.getContext('experimental-webgl'));
  return { webgpu: !!navigator.gpu, webgl2, webgl1 };
}

const caps = detectCaps();
loadStatus.textContent = caps.webgpu ? 'WebGPU ready · WebGL2 fallback armed' : caps.webgl2 ? 'WebGL2 compatibility path ready' : caps.webgl1 ? 'WebGL1 legacy path ready' : 'No compatible GPU API detected';
deployButton.disabled = !(caps.webgpu || caps.webgl2 || caps.webgl1);

async function bootGame() {
  if (booted) return;
  booted = true;
  deployButton.disabled = true;
  loadStatus.textContent = 'Building jungle…';

  try {
    if (caps.webgpu || caps.webgl2) {
      const THREE = await import('three/webgpu');
      const { pass } = await import('three/tsl');
      const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
      let renderer;
      try {
        renderer = new THREE.WebGPURenderer({ antialias: true, samples: 4, powerPreference: 'high-performance', forceWebGL: !caps.webgpu });
        await renderer.init();
      } catch (error) {
        if (!caps.webgl2) throw error;
        renderer = new THREE.WebGPURenderer({ antialias: true, samples: 4, powerPreference: 'high-performance', forceWebGL: true });
        await renderer.init();
      }
      const backendName = renderer.backend?.isWebGPUBackend ? 'WEBGPU' : 'WEBGL2';
      game = await startGame({ THREE, renderer, backendName, modern: true, pass, bloom });
    } else {
      const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js');
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
      game = await startGame({ THREE, renderer, backendName: 'WEBGL1', modern: false });
    }
    document.getElementById('startScreen').classList.add('hidden');
    game.start();
  } catch (error) {
    console.error(error);
    booted = false;
    deployButton.disabled = false;
    loadStatus.textContent = `Boot failed: ${error?.message || error}`;
  }
}

deployButton.addEventListener('click', bootGame);
