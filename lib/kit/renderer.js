/**
 * renderer.js — one way to start three.js r186's WebGPURenderer everywhere.
 *
 * WebGPU first, WebGL2 when the browser has no WebGPU, when the adapter or
 * device refuses, or when WebGPU already failed on this device. Both backends
 * run the same node materials, so they draw the same scene.
 *
 * The WebGPU device is created here rather than by three.js so the default
 * can be conservative: three.js asks for every optional feature the adapter
 * lists, and a few of those (shader-f16, subgroups, timestamp queries,
 * dual-source blending) are where mobile drivers have misbehaved. The
 * "Advanced WebGPU features" setting hands device creation back to three.js,
 * which then requests everything.
 */

import * as THREE from 'three/webgpu';
import { chooseBackend, deviceMemory, webgpuFailedRecently } from './settings.js';

/** Optional features that are widely supported and safe to request. */
export const SAFE_FEATURES = [
  'core-features-and-limits',
  'depth-clip-control',
  'depth32float-stencil8',
  'float32-filterable',
  'float32-blendable',
  'rg11b10ufloat-renderable',
  'indirect-first-instance',
  'texture-compression-bc',
  'texture-compression-etc2',
  'texture-compression-astc',
];

async function conservativeDevice() {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter');
  const requiredFeatures = SAFE_FEATURES.filter((f) => adapter.features.has(f));
  const device = await adapter.requestDevice({ requiredFeatures });
  return { adapter, device };
}

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} [opts.canvas]
 * @param {'auto'|'webgpu'|'webgl2'} [opts.backend]
 * @param {boolean} [opts.advanced]  let three.js request every adapter feature
 * @param {object} [opts.params]     extra WebGPURenderer parameters (antialias, alpha, …)
 * @param {(info: object) => void} [opts.onDeviceLost]
 * @returns {Promise<{ renderer: THREE.WebGPURenderer, backend: 'webgpu'|'webgl2', adapterInfo: object|null, fellBack: string|null }>}
 */
export async function createRenderer({ canvas, backend = 'auto', advanced = false, params = {}, onDeviceLost } = {}) {
  // `canvas` may be replaced (see build); callers use renderer.domElement afterwards.
  const memory = deviceMemory.read();
  const wanted = chooseBackend(backend, {
    hasWebGPU: typeof navigator !== 'undefined' && !!navigator.gpu,
    webgpuFailed: webgpuFailedRecently(memory),
  });

  let fellBack = null;
  let adapterInfo = null;

  const build = async (useWebGPU) => {
    const extra = {};
    if (useWebGPU && !advanced) {
      const { adapter, device } = await conservativeDevice();
      extra.device = device;
      adapterInfo = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture } : null;
    }
    if (!useWebGPU && canvas) {
      // three.js asks for an antialiased WebGL2 context only if it plans to render through its
      // own framebuffer target at init. A game that switches to linear output or no tone mapping
      // afterwards then draws straight into a canvas without MSAA, and WebGL2 loses the
      // anti-aliasing WebGPU keeps. Creating the context here keeps the two backends alike.
      const attrs = { antialias: !!(params.antialias || params.samples), alpha: true, depth: params.depth ?? true, stencil: params.stencil ?? false, powerPreference: 'high-performance' };
      let gl = canvas.getContext('webgl2', attrs);
      if (!gl) {
        // The canvas already holds another context (a failed WebGPU start): swap in a fresh one.
        const fresh = canvas.cloneNode(false);
        canvas.replaceWith(fresh);
        canvas = fresh;
        gl = canvas.getContext('webgl2', attrs);
      }
      if (gl) extra.context = gl;
    }
    const renderer = new THREE.WebGPURenderer({
      canvas,
      powerPreference: 'high-performance',
      ...params,
      ...extra,
      forceWebGL: !useWebGPU,
    });
    await renderer.init();
    return renderer;
  };

  let renderer;
  if (wanted === 'webgpu') {
    try {
      renderer = await build(true);
    } catch (err) {
      fellBack = String(err?.message || err);
      console.warn('[kit] WebGPU start failed, using WebGL2:', fellBack);
      renderer = await build(false);
    }
  } else {
    renderer = await build(false);
  }

  const active = renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
  if (wanted === 'webgpu' && active !== 'webgpu' && !fellBack) fellBack = 'three.js fell back to WebGL2';

  const reportLost = renderer.onDeviceLost.bind(renderer);
  renderer.onDeviceLost = (info) => {
    reportLost(info);
    if (active === 'webgpu') deviceMemory.write({ webgpuFailed: Date.now(), reason: String(info?.message || 'device lost') });
    onDeviceLost?.(info, active);
  };

  return { renderer, backend: active, adapterInfo, fellBack };
}

/** A human label for HUDs and the settings panel. */
export const backendLabel = (backend) => (backend === 'webgpu' ? 'WebGPU' : 'WebGL2');
