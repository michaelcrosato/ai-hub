/*
 * IONWAKE — optional WebGPU presentation filter.
 *
 * Keep drawing the game into sourceCanvas each frame. Show outputCanvas only
 * when render() returns true. A false result means the source is the display.
 * Canvas display styles and input events stay under the host game's control.
 *
 * API:
 *   new IonPostFX({ sourceCanvas, outputCanvas, onStatus })
 *   await init() -> boolean
 *   setOptions({ mode, levels, edgeStrength, pixelSize, dither, saturation })
 *   render() -> boolean
 *   resize(width, height) -> boolean
 *   dispose()
 *
 * The two canvases must be different. The source must stay origin-clean.
 * resize() changes the output and GPU resources; it never clears the source.
 * render() also follows changes to the source canvas's backing dimensions.
 *
 * WebGPU reports some faults asynchronously. A successful render() means that
 * the frame was submitted without a known error. A later GPU fault switches
 * ready to false and calls onStatus, so the host can expose the source at once.
 */
(function installIonPostFX(global) {
  'use strict';

  const DEFAULTS = Object.freeze({
    mode: 'off',
    levels: 6,
    edgeStrength: 0.85,
    pixelSize: 3,
    dither: 0.35,
    saturation: 1.05,
  });
  const MODES = Object.freeze({ off: 0, cel: 1, pixel: 2, hybrid: 3 });

  // Two vec4 values give a simple, portable 32-byte uniform layout.
  const SHADER = /* wgsl */ `
struct FilterOptions {
  // width, height, color levels, outline strength
  image: vec4<f32>,
  // pixel size, dither amount, saturation, mode
  style: vec4<f32>,
};

@group(0) @binding(0) var imageSampler: sampler;
@group(0) @binding(1) var sourceImage: texture_2d<f32>;
@group(0) @binding(2) var<uniform> settings: FilterOptions;

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  // A single large triangle covers the viewport without a diagonal seam.
  let x = f32((index << 1u) & 2u);
  let y = f32(index & 2u);
  return vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
}

fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn color_at(uv: vec2<f32>) -> vec3<f32> {
  // Explicit LOD is valid inside the uniform branches below.
  return textureSampleLevel(sourceImage, imageSampler, uv, 0.0).rgb;
}

fn light_at(uv: vec2<f32>) -> f32 {
  return luminance(color_at(uv));
}

fn bayer4(pixel: vec2<u32>) -> f32 {
  // The standard 4 x 4 Bayer pattern, expressed without a lookup texture.
  let x = pixel.x & 3u;
  let y = pixel.y & 3u;
  let low = (((x ^ y) & 1u) << 1u) | (y & 1u);
  let high = ((((x >> 1u) ^ (y >> 1u)) & 1u) << 1u) | ((y >> 1u) & 1u);
  return (f32(low * 4u + high) + 0.5) / 16.0 - 0.5;
}

fn edge_at(uv: vec2<f32>, delta: vec2<f32>) -> f32 {
  let a = light_at(uv + delta * vec2<f32>(-1.0, -1.0));
  let b = light_at(uv + delta * vec2<f32>( 0.0, -1.0));
  let c = light_at(uv + delta * vec2<f32>( 1.0, -1.0));
  let d = light_at(uv + delta * vec2<f32>(-1.0,  0.0));
  let f = light_at(uv + delta * vec2<f32>( 1.0,  0.0));
  let g = light_at(uv + delta * vec2<f32>(-1.0,  1.0));
  let h = light_at(uv + delta * vec2<f32>( 0.0,  1.0));
  let i = light_at(uv + delta * vec2<f32>( 1.0,  1.0));
  let gradient = vec2<f32>(-a - 2.0 * d - g + c + 2.0 * f + i,
                          -a - 2.0 * b - c + g + 2.0 * h + i);
  return smoothstep(0.12, 0.72, length(gradient));
}

@fragment
fn fs_main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let size = settings.image.xy;
  let mode = settings.style.w;
  let pixelMode = mode >= 2.0;
  let celMode = mode == 1.0 || mode == 3.0;
  let block = select(1.0, settings.style.x, pixelMode);
  let cell = floor(position.xy / block);
  let samplePixel = cell * block + vec2<f32>(block * 0.5);

  // Fragment coordinates and the unflipped Canvas2D copy both start at the
  // top left. This preserves orientation without an extra image conversion.
  let uv = clamp(samplePixel / size, vec2<f32>(0.5) / size,
                 vec2<f32>(1.0) - vec2<f32>(0.5) / size);
  var color = color_at(uv);
  if (mode < 0.5) {
    return vec4<f32>(color, 1.0);
  }

  color = clamp(mix(vec3<f32>(luminance(color)), color, settings.style.z),
                vec3<f32>(0.0), vec3<f32>(1.0));
  let bands = max(settings.image.z - 1.0, 1.0);
  let noise = bayer4(vec2<u32>(cell)) * settings.style.y / bands;

  if (celMode) {
    // Quantize perceptual brightness to preserve hue and dark-space detail.
    let before = luminance(color);
    let perceptual = sqrt(max(before, 0.0));
    let jitter = select(0.0, noise * 0.35, pixelMode);
    let band = floor(clamp(perceptual + jitter, 0.0, 1.0) * bands + 0.5) / bands;
    color = clamp(color * (band * band / max(before, 0.0001)),
                  vec3<f32>(0.0), vec3<f32>(1.0));
  }

  if (pixelMode) {
    // Quantize the palette after pixel sampling; noise is fixed in the pixel
    // grid, so dithering cannot shimmer as the frame number changes.
    color = floor(clamp(color + vec3<f32>(noise), vec3<f32>(0.0),
                        vec3<f32>(1.0)) * bands + vec3<f32>(0.5)) / bands;
  }

  if (celMode && settings.image.w > 0.001) {
    let edge = edge_at(uv, vec2<f32>(block) / size);
    color *= 1.0 - clamp(edge * settings.image.w * 0.7, 0.0, 0.92);
  }
  return vec4<f32>(color, 1.0);
}
`;

  function errorText(error) {
    const message = error && error.message ? error.message : String(error || 'Unknown error');
    return message.trim().slice(0, 1200);
  }

  function numericOption(value, previous, min, max, integer) {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && value.trim() === '')) return previous;
    const number = Number(value);
    if (!Number.isFinite(number)) return previous;
    const bounded = Math.min(max, Math.max(min, number));
    return integer ? Math.round(bounded) : bounded;
  }

  class IonPostFX {
    constructor(config = {}) {
      config = config && typeof config === 'object' ? config : {};
      this.sourceCanvas = config.sourceCanvas;
      this.outputCanvas = config.outputCanvas;
      this._onStatus = typeof config.onStatus === 'function' ? config.onStatus : null;
      this._options = { ...DEFAULTS };
      this._status = { state: 'unavailable', message: 'WebGPU filter has not started.' };
      this._ready = false;
      this._disposed = false;
      this._epoch = 0;
      this._initPromise = null;
      this._device = null;
      this._context = null;
      this._pipeline = null;
      this._sampler = null;
      this._uniform = null;
      this._texture = null;
      this._bindGroup = null;
      this._errorListener = null;
      this._format = null;
      this._width = 0;
      this._height = 0;
      this._uniformData = new Float32Array(8);
      this._uniformDirty = true;
    }

    get ready() { return this._ready; }
    get status() { return { ...this._status }; }
    get options() { return { ...this._options }; }

    /** Concurrent callers share one setup operation. Call again after a fault to retry. */
    init() {
      if (this._disposed) return Promise.resolve(false);
      if (this._ready) return Promise.resolve(true);
      if (this._initPromise) return this._initPromise;
      const epoch = ++this._epoch;
      let pending;
      pending = this._initialize(epoch).finally(() => {
        if (this._initPromise === pending) this._initPromise = null;
      });
      this._initPromise = pending;
      return pending;
    }

    setOptions(values = {}) {
      if (!values || typeof values !== 'object') return this.options;
      const next = { ...this._options };
      if (typeof values.mode === 'string' && Object.hasOwn(MODES, values.mode)) {
        next.mode = values.mode;
      }
      next.levels = numericOption(values.levels, next.levels, 2, 12, true);
      next.edgeStrength = numericOption(values.edgeStrength, next.edgeStrength, 0, 2, false);
      next.pixelSize = numericOption(values.pixelSize, next.pixelSize, 1, 8, true);
      next.dither = numericOption(values.dither, next.dither, 0, 1, false);
      next.saturation = numericOption(values.saturation, next.saturation, 0.5, 1.5, false);
      this._options = next;
      this._uniformDirty = true;
      return this.options;
    }

    /** Change only output dimensions. A zero-size source can resume on a later frame. */
    resize(width = this.sourceCanvas && this.sourceCanvas.width,
           height = this.sourceCanvas && this.sourceCanvas.height) {
      if (this._disposed) return false;
      if ((typeof width !== 'number' && typeof width !== 'string') ||
          (typeof height !== 'number' && typeof height !== 'string')) return false;
      width = Math.round(Number(width));
      height = Math.round(Number(height));
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        return false;
      }
      try {
        if (!this.outputCanvas) throw new Error('The output canvas is missing.');
        if (this._device && this._pipeline) {
          this._resizeGPU(width, height);
        } else {
          if (this.outputCanvas.width !== width) this.outputCanvas.width = width;
          if (this.outputCanvas.height !== height) this.outputCanvas.height = height;
          this._width = width;
          this._height = height;
          this._uniformDirty = true;
        }
        return true;
      } catch (error) {
        this._fail('error', 'WebGPU resize failed: ' + errorText(error));
        return false;
      }
    }

    render() {
      if (!this._ready || this._disposed || this._options.mode === 'off') return false;
      try {
        const width = this.sourceCanvas.width;
        const height = this.sourceCanvas.height;
        if (!width || !height) return false;
        if (width !== this._width || height !== this._height ||
            this.outputCanvas.width !== width || this.outputCanvas.height !== height) {
          this._resizeGPU(width, height);
        }
        this._submitFrame();
        return true;
      } catch (error) {
        this._fail('error', 'WebGPU frame failed: ' + errorText(error));
        return false;
      }
    }

    dispose() {
      if (this._disposed) return;
      this._disposed = true;
      this._epoch += 1;
      this._ready = false;
      this._releaseGPU();
      this._emit('unavailable', 'WebGPU filter was disposed.');
    }

    _current(epoch, device) {
      return !this._disposed && epoch === this._epoch && (!device || this._device === device);
    }

    async _initialize(epoch) {
      let stage = 'setup';
      try {
        if (!this.sourceCanvas || !this.outputCanvas ||
            typeof this.sourceCanvas.getContext !== 'function' ||
            typeof this.outputCanvas.getContext !== 'function') {
          throw new Error('Provide a source canvas and a separate output canvas.');
        }
        if (this.sourceCanvas === this.outputCanvas) {
          throw new Error('The source canvas and output canvas must be different.');
        }
        if (!global.isSecureContext) {
          this._fail('unavailable', 'WebGPU needs a secure page. Use HTTPS or localhost.');
          return false;
        }
        const gpu = global.navigator && global.navigator.gpu;
        if (!gpu || typeof gpu.requestAdapter !== 'function') {
          this._fail('unavailable', 'This browser does not expose WebGPU. Normal rendering is active.');
          return false;
        }

        this._context = this.outputCanvas.getContext('webgpu');
        if (!this._context) {
          this._fail('unavailable', 'A WebGPU canvas is not available. Normal rendering is active.');
          return false;
        }
        stage = 'adapter request';
        let adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!this._current(epoch)) return false;
        if (!adapter) adapter = await gpu.requestAdapter();
        if (!this._current(epoch)) return false;
        if (!adapter) {
          this._fail('unavailable', 'No WebGPU adapter is available. Normal rendering is active.');
          return false;
        }

        stage = 'device request';
        const device = await adapter.requestDevice();
        if (!this._current(epoch)) {
          device.destroy();
          return false;
        }
        this._device = device;
        this._format = gpu.getPreferredCanvasFormat();
        this._watchDevice(device, epoch);

        // Catch shader, pipeline, allocation, and first-frame faults before the
        // host receives "ready". Uncaptured errors cover later runtime faults.
        let scopes = 0;
        let setupError = null;
        const gpuErrors = [];
        try {
          for (const filter of ['out-of-memory', 'internal', 'validation']) {
            device.pushErrorScope(filter);
            scopes += 1;
          }
          stage = 'shader compilation';
          const module = device.createShaderModule({ label: 'IONWAKE filter shader', code: SHADER });
          if (typeof module.getCompilationInfo === 'function') {
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(message => message.type === 'error');
            if (errors.length) {
              throw new Error(errors.slice(0, 3).map(message =>
                'Line ' + message.lineNum + ': ' + message.message).join(' '));
            }
          }
          if (!this._current(epoch, device)) throw new Error('Setup was cancelled.');
          const descriptor = {
            label: 'IONWAKE filter pipeline',
            layout: 'auto',
            vertex: { module, entryPoint: 'vs_main' },
            fragment: { module, entryPoint: 'fs_main', targets: [{ format: this._format }] },
            primitive: { topology: 'triangle-list' },
          };
          const pipeline = typeof device.createRenderPipelineAsync === 'function'
            ? await device.createRenderPipelineAsync(descriptor)
            : device.createRenderPipeline(descriptor);
          if (!this._current(epoch, device)) throw new Error('Setup was cancelled.');
          this._pipeline = pipeline;
          this._sampler = device.createSampler({
            label: 'IONWAKE pixel sampler',
            addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
            magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'nearest',
          });
          this._uniform = device.createBuffer({
            label: 'IONWAKE filter options', size: 32,
            usage: global.GPUBufferUsage.UNIFORM | global.GPUBufferUsage.COPY_DST,
          });
          stage = 'canvas setup';
          this._resizeGPU(this.sourceCanvas.width, this.sourceCanvas.height);
          stage = 'first frame';
          this._submitFrame();
          await device.queue.onSubmittedWorkDone();
        } catch (error) {
          setupError = error;
        } finally {
          while (scopes > 0) {
            scopes -= 1;
            try {
              const error = await device.popErrorScope();
              if (error) gpuErrors.push(errorText(error));
            } catch (error) {
              if (!setupError) setupError = error;
            }
          }
        }
        if (!this._current(epoch, device)) return false;
        if (setupError) throw setupError;
        if (gpuErrors.length) throw new Error(gpuErrors.join(' '));
        this._ready = true;
        this._emit('ready', 'WebGPU is ready. Cel, Pixel, and Hybrid filters are available.');
        return true;
      } catch (error) {
        if (this._current(epoch)) {
          this._fail('error', 'WebGPU ' + stage + ' failed: ' + errorText(error));
        }
        return false;
      }
    }

    _watchDevice(device, epoch) {
      this._errorListener = event => {
        if (!this._current(epoch, device)) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        this._fail('error', 'WebGPU reported an error: ' + errorText(event.error));
      };
      device.addEventListener('uncapturederror', this._errorListener);
      device.lost.then(info => {
        if (!this._current(epoch, device)) return;
        const reason = info && info.reason ? info.reason : 'unknown';
        const detail = info && info.message ? ' ' + info.message : '';
        this._fail('lost', 'WebGPU device was lost (' + reason + ').' + detail +
          ' Normal rendering is active. Select a filter again to retry.');
      }).catch(error => {
        if (this._current(epoch, device)) {
          this._fail('lost', 'WebGPU device monitoring failed: ' + errorText(error));
        }
      });
    }

    _resizeGPU(width, height) {
      const device = this._device;
      const limit = device.limits.maxTextureDimension2D;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error('The source canvas must have positive integer dimensions.');
      }
      if (width > limit || height > limit) {
        throw new Error('Canvas size ' + width + ' × ' + height +
          ' exceeds this device limit of ' + limit + ' pixels per side.');
      }
      if (this._texture && width === this._width && height === this._height &&
          this.outputCanvas.width === width && this.outputCanvas.height === height) return;

      if (this.outputCanvas.width !== width) this.outputCanvas.width = width;
      if (this.outputCanvas.height !== height) this.outputCanvas.height = height;
      this._context.configure({
        device, format: this._format, alphaMode: 'opaque', colorSpace: 'srgb',
      });
      const texture = device.createTexture({
        label: 'IONWAKE source frame',
        size: { width, height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: global.GPUTextureUsage.TEXTURE_BINDING |
               global.GPUTextureUsage.COPY_DST |
               global.GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const bindGroup = device.createBindGroup({
        label: 'IONWAKE filter bindings',
        layout: this._pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this._sampler },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: { buffer: this._uniform } },
        ],
      });
      const oldTexture = this._texture;
      this._texture = texture;
      this._bindGroup = bindGroup;
      this._width = width;
      this._height = height;
      this._uniformDirty = true;
      if (oldTexture) oldTexture.destroy();
    }

    _submitFrame() {
      const device = this._device;
      if (!device || !this._texture || !this._bindGroup) {
        throw new Error('The GPU frame resources are not ready.');
      }
      if (this._uniformDirty) {
        const data = this._uniformData;
        const options = this._options;
        data[0] = this._width; data[1] = this._height;
        data[2] = options.levels; data[3] = options.edgeStrength;
        data[4] = options.pixelSize; data[5] = options.dither;
        data[6] = options.saturation; data[7] = MODES[options.mode];
        device.queue.writeBuffer(this._uniform, 0, data);
        this._uniformDirty = false;
      }
      device.queue.copyExternalImageToTexture(
        { source: this.sourceCanvas, flipY: false },
        { texture: this._texture, premultipliedAlpha: false, colorSpace: 'srgb' },
        { width: this._width, height: this._height, depthOrArrayLayers: 1 }
      );
      const encoder = device.createCommandEncoder({ label: 'IONWAKE filter frame' });
      const pass = encoder.beginRenderPass({
        label: 'IONWAKE full-screen filter',
        colorAttachments: [{
          view: this._context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(this._pipeline);
      pass.setBindGroup(0, this._bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    _fail(state, message) {
      this._epoch += 1;
      this._ready = false;
      this._releaseGPU();
      this._emit(state, message);
    }

    _emit(state, message) {
      if (this._status.state === state && this._status.message === message) return;
      this._status = { state, message };
      if (this._onStatus) {
        // A host UI callback must never break a game frame or GPU cleanup.
        try { this._onStatus({ state, message }); } catch (_) { /* Host owns UI errors. */ }
      }
    }

    _releaseGPU() {
      const device = this._device;
      this._device = null;
      if (device && this._errorListener) {
        try { device.removeEventListener('uncapturederror', this._errorListener); } catch (_) {}
      }
      this._errorListener = null;
      for (const resource of [this._texture, this._uniform]) {
        try { if (resource) resource.destroy(); } catch (_) {}
      }
      try { if (this._context) this._context.unconfigure(); } catch (_) {}
      try { if (device) device.destroy(); } catch (_) {}
      this._texture = null;
      this._uniform = null;
      this._sampler = null;
      this._pipeline = null;
      this._bindGroup = null;
      this._context = null;
      this._format = null;
      this._width = 0;
      this._height = 0;
      this._uniformDirty = true;
    }
  }

  global.IonPostFX = IonPostFX;
})(typeof window !== 'undefined' ? window : globalThis);
