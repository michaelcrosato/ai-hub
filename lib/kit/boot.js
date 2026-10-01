/**
 * boot.js — the one startup every 3D game on the wall shares.
 *
 *   import * as THREE from 'three/webgpu';
 *   import { boot } from 'kit/boot.js';
 *
 *   const kit = await boot({
 *     title: 'Skybreak',
 *     physics: true,                       // loads Rapier 0.20 → kit.RAPIER
 *     input: { move: { type: 'vector', keys: 'wasd+arrows', touch: 'stick' },
 *              jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' } },
 *   });
 *   const scene = new THREE.Scene();
 *   const camera = kit.fitCamera(new THREE.PerspectiveCamera(60, 1, 0.1, 500));
 *   kit.start((dt, t) => { update(dt); kit.renderer.render(scene, camera); });
 *
 * boot() shows the loading card, starts WebGPU (WebGL2 as fallback), applies
 * the quality tier, sizes the canvas to its container, wires keyboard, mouse,
 * gamepad and touch, adds the settings gear (F9), and exposes diagnostics on
 * window.__kit for automated checks.
 */

import * as THREE from 'three/webgpu';
import { createSettings, resolveTier, pixelRatioFor } from './settings.js';
import { createRenderer, backendLabel } from './renderer.js';
import { Input } from './input.js';
import { createTouchControls } from './touch.js';
import { createLoading, createMenu, createFpsMeter, toast } from './ui.js';
import { loadRapier, physicsInfo } from './physics.js';
import { DynamicResolution, FpsCounter, skipForCap } from './loop.js';
import { createInstanced } from './instancing.js';

export const KIT_VERSION = '1.0.0';

function deviceProfile() {
  const mm = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  return {
    coarsePointer: mm('(pointer: coarse)'),
    screenMin: Math.min(screen?.width || 1920, screen?.height || 1080),
    memory: navigator.deviceMemory || 8,
    cores: navigator.hardwareConcurrency || 8,
  };
}

/**
 * Count render pipelines (compiled shader programs). A healthy game builds them while it
 * loads and then rarely; one rebuilt over and over (a material that changes every frame)
 * stalls on shader compiles. The log keeps the last 30, with the material and object.
 */
function watchPipelines(renderer, diag) {
  const backend = renderer.backend;
  const create = backend?.createRenderPipeline;
  if (typeof create !== 'function') return;
  backend.createRenderPipeline = function (renderObject, promises) {
    diag.pipelines += 1;
    const m = renderObject?.material;
    const o = renderObject?.object;
    diag.pipelineLog.push({
      t: Math.round(performance.now()),
      material: m ? `${m.type}${m.name ? ` "${m.name}"` : ''}` : '?',
      object: o ? `${o.type}${o.name ? ` "${o.name}"` : ''}` : '?',
      // InstancedMesh: its own shaders per mesh in r186. Distinct material ids with one
      // name: per-object materials whose node graphs differ.
      instanced: !!o?.isInstancedMesh,
      materialId: m?.id,
    });
    if (diag.pipelineLog.length > 30) diag.pipelineLog.shift();
    return create.call(this, renderObject, promises);
  };
}

function captureErrors(diag) {
  // A per-frame error repeats forever: keep one entry per message with a count.
  const push = (kind, message) => {
    message = String(message).slice(0, 500);
    const seen = diag.errors.find((e) => e.kind === kind && e.message === message);
    if (seen) seen.count = (seen.count || 1) + 1;
    else if (diag.errors.length < 50) diag.errors.push({ kind, message, t: Math.round(performance.now()) });
  };
  addEventListener('error', (e) => push('error', e.message || e.error));
  addEventListener('unhandledrejection', (e) => push('rejection', e.reason?.message || e.reason));
  return push;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.title]           loading-card title (defaults to document.title)
 * @param {HTMLCanvasElement} [opts.canvas]  use this canvas instead of creating one
 * @param {HTMLElement} [opts.mount=document.body]  what the canvas fills and tracks
 * @param {boolean} [opts.physics=false]  load Rapier
 * @param {object} [opts.input]           action definitions (see input.js)
 * @param {boolean|object} [opts.touch=true]  build on-screen controls from the actions; false for none,
 *                                        or { top: 'left'|'center'|'right', topOffset: px, theme: 'dark'|'light', hint: bool }
 * @param {'tr'|'tl'|'br'|'bl'|'none'} [opts.gear='tr']  settings button corner
 * @param {object} [opts.renderer]        extra WebGPURenderer parameters (antialias, alpha, …)
 * @param {boolean} [opts.holdLoading=false]  keep the loading card up until kit.loading.done()
 * @param {number} [opts.pixelHeight=0]   render this many lines tall, upscaled with hard pixels (retro look)
 * @param {string} [opts.accent]          loading-bar colour
 * @param {string} [opts.background]      loading-card background
 */
export async function boot(opts = {}) {
  const t0 = performance.now();
  const diag = (window.__kit = {
    version: KIT_VERSION,
    three: THREE.REVISION,
    backend: null,
    tier: null,
    frames: 0,
    fps: 0,
    errors: [],
    ready: false,
    bootMs: 0,
    pipelines: 0,
    pipelineLog: [],
  });
  const pushError = captureErrors(diag);

  const settings = createSettings();
  // For automated checks (flip quality at runtime); games use kit.settings.
  window.__kitSettings = settings;
  const device = deviceProfile();
  let tier = resolveTier(settings.get().quality, device);
  const startMsaa = opts.renderer?.antialias ?? tier.msaa;
  diag.tier = tier.name;

  const loading = createLoading({ title: opts.title || document.title, accent: opts.accent, background: opts.background });
  loading.progress(0.05, 'Starting graphics…');

  const mount = opts.mount || document.body;
  let canvas = opts.canvas;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'kit-canvas';
    if (mount === document.body) {
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
    } else {
      canvas.style.cssText = 'width:100%;height:100%;display:block;';
    }
    mount.prepend(canvas);
  }
  canvas.style.touchAction = 'none';
  canvas.setAttribute('tabindex', '0');

  let started;
  try {
    started = await createRenderer({
      canvas,
      backend: settings.get().backend,
      advanced: settings.get().advanced,
      params: { antialias: startMsaa, alpha: false, ...(opts.renderer || {}) },
      onDeviceLost: (info, backend) => {
        loading.error(
          backend === 'webgpu'
            ? 'The graphics device stopped. Restart to continue on WebGL2.'
            : 'The graphics context was lost. Restart to continue.',
          [{ label: 'Restart', onClick: () => location.reload() }]
        );
      },
    });
  } catch (err) {
    pushError('boot', err?.message || err);
    loading.error("This game needs WebGPU or WebGL2, and this browser couldn't start either.", [
      { label: 'Try again', onClick: () => location.reload() },
    ]);
    throw err;
  }

  const { renderer, backend, adapterInfo, fellBack } = started;
  canvas = renderer.domElement;
  diag.backend = backend;
  diag.adapter = adapterInfo;
  diag.fellBack = fellBack;
  watchPipelines(renderer, diag);
  const baseOnError = renderer.onError.bind(renderer);
  renderer.onError = (info) => {
    baseOnError(info);
    pushError('gpu', `${info.type}: ${info.message}`);
  };

  // ---- sizing
  const dyn = new DynamicResolution({ min: device.coarsePointer ? 0.6 : 0.7 });
  const size = { width: 1, height: 1 };
  const resizeFns = new Set();
  let pixelHeight = opts.pixelHeight || 0;
  const applyPixelRatio = () => {
    const s = settings.get();
    if (pixelHeight > 0) {
      // A fixed number of lines, scaled up with hard pixels (the retro look).
      renderer.setPixelRatio(pixelHeight / size.height);
      canvas.style.imageRendering = 'pixelated';
    } else {
      const scale = s.resolution === 'auto' ? dyn.scale : s.resolution;
      renderer.setPixelRatio(pixelRatioFor(tier, devicePixelRatio, scale));
      canvas.style.imageRendering = '';
    }
    renderer.setSize(size.width, size.height, false);
  };
  const measure = () => {
    const w = Math.max(1, Math.round(mount === document.body ? innerWidth : mount.clientWidth));
    const h = Math.max(1, Math.round(mount === document.body ? innerHeight : mount.clientHeight));
    if (w === size.width && h === size.height) return;
    size.width = w;
    size.height = h;
    applyPixelRatio();
    for (const fn of resizeFns) fn(w, h);
  };
  measure();
  addEventListener('resize', measure);
  if (mount !== document.body && typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(mount);

  // ---- physics
  let RAPIER = null;
  if (opts.physics) {
    loading.progress(0.35, 'Loading physics…');
    RAPIER = await loadRapier();
  }
  loading.progress(0.6, 'Building the world…');

  // ---- input, touch, menu
  const input = new Input({ element: canvas, actions: opts.input || {}, settings: settings.get });
  const touchOpts = typeof opts.touch === 'object' && opts.touch ? opts.touch : {};
  const touch = opts.touch === false ? null : createTouchControls({ input, settings, ...touchOpts });

  let paused = false;
  let menuPaused = false;
  const pauseFns = new Set();
  const setPaused = () => {
    const p = paused || menuPaused;
    for (const fn of pauseFns) fn(p);
  };

  const fpsMeter = createFpsMeter();
  const info = () =>
    `${backendLabel(backend)} · three.js r${THREE.REVISION}${RAPIER ? ` · Rapier ${physicsInfo.version}${physicsInfo.simd ? ' SIMD' : ''}` : ''}` +
    (fellBack ? ' · WebGPU unavailable here' : '');
  const menu = createMenu({
    settings,
    gear: opts.gear || 'tr',
    context: () => ({
      tier: tier.name,
      backendLabel: backendLabel(backend),
      info: info(),
      needsReload: tier.msaa !== startMsaa && opts.renderer?.antialias === undefined,
    }),
    onToggle: (open) => {
      menuPaused = open;
      if (open) input.unlockPointer();
      else input.settle();
      touch?.suspend(open, 'menu');
      setPaused();
    },
  });

  const qualityFns = new Set();
  settings.subscribe((s, changed) => {
    if (changed.includes('quality')) {
      const next = resolveTier(s.quality, device);
      // Auto (High) → High changes the setting, not the tier: nothing to redo.
      if (next !== tier) {
        tier = next;
        diag.tier = tier.name;
        for (const fn of qualityFns) fn(tier);
      }
    }
    if (changed.includes('quality') || changed.includes('resolution')) applyPixelRatio();
    if (changed.includes('showFps')) fpsMeter.show(s.showFps);
  });
  fpsMeter.show(settings.get().showFps);

  // ---- loop
  const fps = new FpsCounter();
  let lastRendered = 0;
  let frameFn = null;
  let firstFrame = true;
  let lastError = '';

  const tick = () => {
    const now = performance.now();
    const s = settings.get();
    if (skipForCap(now, lastRendered, s.fpsCap)) return;
    const raw = lastRendered ? now - lastRendered : 16.7;
    lastRendered = now;
    if (paused || menuPaused || !frameFn) return;

    if (s.resolution === 'auto' && !pixelHeight) {
      dyn.targetMs = s.fpsCap ? 1000 / s.fpsCap : 1000 / 60;
      if (dyn.sample(raw, now)) applyPixelRatio();
    }
    if (fps.tick(now)) {
      diag.fps = fps.fps;
      if (s.showFps) fpsMeter.set(`${backendLabel(backend)} ${fps.fps} fps\n${tier.name} ${renderer.getPixelRatio().toFixed(2)}×`);
    }

    const dt = Math.min(raw / 1000, 0.1);
    input.update(dt);
    try {
      frameFn(dt, now / 1000);
    } catch (err) {
      const msg = String(err?.stack || err);
      if (msg !== lastError) {
        lastError = msg;
        console.error(err);
        pushError('frame', err?.message || err);
      }
    }
    input.endFrame();
    diag.frames += 1;
    if (firstFrame) {
      firstFrame = false;
      diag.ready = true;
      diag.bootMs = Math.round(performance.now() - t0);
      if (!opts.holdLoading) loading.done();
    }
  };

  const kit = {
    THREE,
    renderer,
    canvas,
    backend,
    backendLabel: backendLabel(backend),
    get tier() {
      return tier;
    },
    settings,
    input,
    touch,
    menu,
    RAPIER,
    size,
    /** The loading card: progress(fraction, text) and done(). */
    loading: { progress: loading.progress, done: loading.done },

    /** Start (or replace) the per-frame function: frame(dt seconds, t seconds). */
    start(frame) {
      frameFn = frame;
      renderer.setAnimationLoop(tick);
    },
    stop() {
      renderer.setAnimationLoop(null);
    },
    /** Pause the game loop (the settings menu pauses it too). */
    pause(on = true) {
      paused = !!on;
      setPaused();
    },
    get paused() {
      return paused || menuPaused;
    },
    /** fn(paused) whenever the loop pauses or resumes, e.g. to pause audio. */
    onPause(fn) {
      pauseFns.add(fn);
      return () => pauseFns.delete(fn);
    },
    /** fn(width, height) now and on every resize (CSS pixels). */
    onResize(fn) {
      resizeFns.add(fn);
      fn(size.width, size.height);
      return () => resizeFns.delete(fn);
    },
    /** Keep a PerspectiveCamera's aspect in step with the canvas. Returns the camera. */
    fitCamera(camera) {
      kit.onResize((w, h) => {
        if (camera.isPerspectiveCamera) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      });
      return camera;
    },
    /** fn(tier) when the player changes quality. */
    onQuality(fn) {
      qualityFns.add(fn);
      return () => qualityFns.delete(fn);
    },
    /** A shadow-map size scaled from the game's own choice at 'high'. */
    shadowSize(base = 2048) {
      const v = Math.round((base * tier.shadowMapSize) / 2048);
      const max = settings.get().advanced ? 8192 : 4096;
      return 2 ** Math.round(Math.log2(Math.min(max, Math.max(256, v))));
    },
    /** Render this many lines tall and scale up with hard pixels; 0 returns to native resolution. */
    setPixelHeight(lines = 0) {
      pixelHeight = Math.max(0, lines | 0);
      applyPixelRatio();
    },
    /**
     * Size a light's shadow map for the tier now and whenever quality changes.
     * r186 resizes the map from light.shadow.mapSize on the next frame, so
     * never dispose or null shadow.map yourself (that breaks rendering).
     */
    shadow(light, base = 2048) {
      const apply = () => light.shadow.mapSize.setScalar(kit.shadowSize(base));
      apply();
      kit.onQuality(apply);
      return light;
    },
    /**
     * An InstancedMesh for a batch that moves, sharing shaders with every other
     * one made this way (see kit/instancing.js). `count` starts at `capacity`.
     */
    instanced(geometry, material, capacity) {
      return createInstanced(renderer, geometry, material, capacity);
    },
    /** Round a game-chosen count by the tier's detail factor (particles, props…). */
    detail(count, min = 1) {
      return Math.max(min, Math.round(count * tier.detail));
    },
    toast,
  };
  return kit;
}
