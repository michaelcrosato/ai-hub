/**
 * Optional Canvas 2D -> WebGPU display filter. No game logic depends on this.
 *
 * Put outputCanvas over sourceCanvas, with the same CSS position and size.
 * Keep sourceCanvas visible. This class hides outputCanvas for Off, failure,
 * and device loss, so the base image remains available without a restart.
 * The output canvas must not already have a 2D or WebGL context.
 *
 * const filter = new GPUFilter(outputCanvas, game.screen.canvas);
 * filter.onStatus = ({ status, reason }) => updateStatusText(status, reason);
 * await filter.init(); // Call on filter selection; startup need not wait.
 * // Call after the engine's screen.present(), in the same animation frame:
 * filter.render({ mode: 'cel', colorLevels: 7, outlineStrength: .7,
 *                 pixelSize: 5, dithering: .25 });
 *
 * Settings: mode 'off'|'cel'|'pixel'; colorLevels 2..32;
 * outlineStrength 0..2; pixelSize 1..24 SOURCE pixels; dithering 0..1.
 * A color band and edge filter approximates cel shading from a finished image.
 * It does not change the game's materials, lighting, timing, or hit detection.
 *
 * API references, checked 2026-10-09:
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost
 */

const SHADER = /* wgsl */ `
struct Settings {
  geometry: vec4f, // source width, height, mode, pixel size
  style: vec4f,    // color levels, outline strength, dither strength, reserved
};
@group(0) @binding(0) var sourceImage: texture_2d<f32>;
@group(0) @binding(1) var<uniform> settings: Settings;

@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let points = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(points[vertexIndex], 0.0, 1.0);
}

fn readColor(point: vec2f) -> vec3f {
  let maxPoint = vec2i(textureDimensions(sourceImage)) - vec2i(1);
  let location = clamp(vec2i(point), vec2i(0), maxPoint);
  return textureLoad(sourceImage, location, 0).rgb;
}

fn luminance(point: vec2f) -> f32 {
  return dot(readColor(point), vec3f(0.2126, 0.7152, 0.0722));
}

fn bayer4(point: vec2f) -> f32 {
  let table = array<f32, 16>(
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  let cell = vec2u(point) % vec2u(4u);
  return (table[cell.y * 4u + cell.x] + 0.5) / 16.0 - 0.5;
}

@fragment fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let mode = settings.geometry.z;
  let blockSize = select(1.0, max(1.0, settings.geometry.w), mode > 1.5);
  let block = floor(position.xy / blockSize);
  let point = (block + vec2f(0.5)) * blockSize;
  let levels = max(2.0, settings.style.x) - 1.0;
  let dither = bayer4(block) * settings.style.z / levels;
  let color = clamp(readColor(point) + vec3f(dither), vec3f(0.0), vec3f(1.0));
  var result = floor(color * levels + vec3f(0.5)) / levels;

  // A Sobel edge uses the unmodified image, so band boundaries do not flicker.
  let step = blockSize;
  let a = luminance(point + vec2f(-step, -step));
  let b = luminance(point + vec2f( 0.0,  -step));
  let c = luminance(point + vec2f( step, -step));
  let d = luminance(point + vec2f(-step,  0.0));
  let f = luminance(point + vec2f( step,  0.0));
  let g = luminance(point + vec2f(-step,  step));
  let h = luminance(point + vec2f( 0.0,   step));
  let i = luminance(point + vec2f( step,  step));
  let gradient = vec2f(-a - 2.0*d - g + c + 2.0*f + i,
                      -a - 2.0*b - c + g + 2.0*h + i);
  let edge = clamp(smoothstep(0.12, 0.65, length(gradient)) * settings.style.y, 0.0, 0.95);
  result = mix(result, vec3f(0.025, 0.025, 0.04), edge);
  return vec4f(result, 1.0);
}
`;

const numberInRange = (value, fallback, low, high) => {
  const number = Number(value);
  return Math.min(high, Math.max(low, Number.isFinite(number) ? number : fallback));
};

export class GPUFilter {
  constructor(canvas, sourceCanvas) {
    if (!canvas || !sourceCanvas || canvas === sourceCanvas) {
      throw new TypeError('GPUFilter needs separate output and source canvases.');
    }
    this.canvas = canvas;
    this.sourceCanvas = sourceCanvas;
    this.ready = false;
    this.status = 'idle';
    this.reason = '';
    this.onStatus = null;
    this.device = null;
    this.context = null;
    this.texture = null;
    this.uniform = null;
    this.pipeline = null;
    this.bindGroup = null;
    this.uniformValues = new Float32Array(8);
    this.sourceWidth = 0;
    this.sourceHeight = 0;
    this._generation = 0;
    this._initializing = null;
    this._destroyed = false;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.visibility = 'hidden';
    this.canvas.setAttribute('aria-hidden', 'true');
  }

  _status(status, reason = '') {
    this.status = status;
    this.reason = reason;
    if (typeof this.onStatus === 'function') {
      // A host status label must not interrupt the game render loop.
      try { this.onStatus({ status, reason, ready: this.ready }); } catch (_) { /* UI callback */ }
    }
  }

  _fallback(status, reason) {
    this.ready = false;
    this.canvas.style.visibility = 'hidden';
    this._status(status, reason);
    return false;
  }

  async init() {
    if (this.ready) return true;
    if (this._destroyed) return false;
    if (this._initializing) return this._initializing;
    this._initializing = this._initialize();
    try { return await this._initializing; }
    finally { this._initializing = null; }
  }

  async _initialize() {
    if (!globalThis.navigator?.gpu || globalThis.isSecureContext === false) {
      return this._fallback('unavailable', 'WebGPU is not available here. The base image remains active.');
    }
    const generation = ++this._generation;
    this._releaseResources();
    this._status('loading');
    let device;
    try {
      const gpu = navigator.gpu;
      const adapter = await gpu.requestAdapter({ powerPreference: 'low-power' });
      if (!adapter) return this._fallback('unavailable', 'No WebGPU adapter is available.');
      if (generation !== this._generation || this._destroyed) return false;
      device = await adapter.requestDevice();
      if (generation !== this._generation || this._destroyed) { device.destroy(); return false; }
      this.device = device;
      let wasLost = false;
      device.lost.then(info => {
        wasLost = true;
        if (generation === this._generation && !this._destroyed) {
          this._fallback('lost', info.message || 'The graphics device was lost. The base image remains active.');
        }
      }).catch(() => this._fallback('lost', 'The graphics device is no longer available.'));
      device.addEventListener('uncapturederror', event => {
        if (generation !== this._generation || this._destroyed) return;
        event.preventDefault();
        this._fallback('error', event.error?.message || 'The filter could not render.');
      });

      this.context = this.canvas.getContext('webgpu');
      if (!this.context) throw new Error('The output canvas cannot use WebGPU.');
      this.format = gpu.getPreferredCanvasFormat();
      this.context.configure({ device, format: this.format, alphaMode: 'opaque' });
      const module = device.createShaderModule({ label: 'Boxing display filter', code: SHADER });
      if (module.getCompilationInfo) {
        const diagnostics = await module.getCompilationInfo();
        const errors = diagnostics.messages.filter(message => message.type === 'error');
        if (errors.length) throw new Error(errors.map(message => message.message).join('\n'));
      }
      this.pipeline = await device.createRenderPipelineAsync({
        label: 'Optional cel and pixel filter',
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format: this.format }] },
        primitive: { topology: 'triangle-list' }
      });
      if (wasLost || generation !== this._generation || this._destroyed) return false;
      this.uniform = device.createBuffer({
        label: 'Display filter settings',
        size: this.uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.ready = true;
      this._status('ready');
      return true;
    } catch (error) {
      if (generation !== this._generation || this._destroyed) return false;
      this._fallback('unavailable', error?.message || 'The filter could not start.');
      // Invalidate the old device callbacks before releasing an invalid device.
      ++this._generation;
      this._releaseResources();
      return false;
    }
  }

  _resize(width, height) {
    if (width === this.sourceWidth && height === this.sourceHeight && this.texture) return;
    this.texture?.destroy();
    this.canvas.width = width;
    this.canvas.height = height;
    this.sourceWidth = width;
    this.sourceHeight = height;
    this.texture = this.device.createTexture({
      label: 'Canvas frame for display filter',
      size: [width, height],
      format: 'rgba8unorm',
      // The browser may use a render pass for the external image conversion.
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: { buffer: this.uniform } }
      ]
    });
  }

  render(settings = {}) {
    const mode = settings.mode === 'cel' ? 1 : settings.mode === 'pixel' ? 2 : 0;
    if (!mode || !this.ready || this._destroyed) {
      this.canvas.style.visibility = 'hidden';
      return false;
    }
    try {
      const width = this.sourceCanvas.width;
      const height = this.sourceCanvas.height;
      const limit = this.device.limits.maxTextureDimension2D;
      if (!(width > 0 && height > 0 && width <= limit && height <= limit)) {
        this.canvas.style.visibility = 'hidden';
        return false; // A temporary size or hidden element must not stop the game.
      }
      this._resize(width, height);
      const values = this.uniformValues;
      values[0] = width;
      values[1] = height;
      values[2] = mode;
      values[3] = Math.round(numberInRange(settings.pixelSize, 5, 1, 24));
      values[4] = Math.round(numberInRange(settings.colorLevels, 7, 2, 32));
      values[5] = numberInRange(settings.outlineStrength, .65, 0, 2);
      values[6] = numberInRange(settings.dithering, .2, 0, 1);
      this.device.queue.writeBuffer(this.uniform, 0, values);
      this.device.queue.copyExternalImageToTexture(
        { source: this.sourceCanvas, flipY: false },
        { texture: this.texture, premultipliedAlpha: false },
        [width, height]
      );
      const encoder = this.device.createCommandEncoder({ label: 'Display filter frame' });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(3);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      this.canvas.style.visibility = 'visible';
      return true;
    } catch (error) {
      return this._fallback('error', error?.message || 'The filter could not render.');
    }
  }

  _releaseResources() {
    this.texture?.destroy();
    this.uniform?.destroy();
    this.device?.destroy();
    this.texture = this.uniform = this.device = this.pipeline = this.bindGroup = null;
    this.sourceWidth = this.sourceHeight = 0;
  }

  destroy() {
    this._destroyed = true;
    ++this._generation;
    this.ready = false;
    this.canvas.style.visibility = 'hidden';
    this._releaseResources();
    try { this.context?.unconfigure(); } catch (_) { /* Device already lost. */ }
    this.context = null;
    this._status('destroyed');
  }
}

export default GPUFilter;
