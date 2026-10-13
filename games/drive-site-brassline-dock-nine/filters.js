/* Image-space WebGPU presentation. Combat never depends on this module. */
(function (root) {
  'use strict';
  const SHADER = `
struct Params { size: vec2f, mode: f32, amount: f32, levels: f32, ink: f32, pixel: f32, saturation: f32 }
@group(0) @binding(0) var picture: texture_2d<f32>;
@group(0) @binding(1) var pictureSampler: sampler;
@group(0) @binding(2) var<uniform> p: Params;
struct VertexOut { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) index: u32) -> VertexOut {
  var points = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VertexOut;
  out.position = vec4f(points[index], 0.0, 1.0);
  out.uv = points[index] * vec2f(0.5, -0.5) + vec2f(0.5);
  return out;
}
fn sampleAt(uv: vec2f) -> vec3f { return textureSampleLevel(picture, pictureSampler, clamp(uv, vec2f(0.001), vec2f(0.999)), 0.0).rgb; }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
@fragment fn fs(in: VertexOut) -> @location(0) vec4f {
  let original = sampleAt(in.uv);
  var uv = in.uv;
  if (p.mode > 1.5) {
    let grid = p.size / max(1.0, p.pixel);
    uv = (floor(uv * grid) + vec2f(0.5)) / grid;
  }
  var c = sampleAt(uv);
  let luminance = luma(c);
  c = mix(vec3f(luminance), c, p.saturation);
  let levels = max(3.0, p.levels);
  c = floor(c * levels + vec3f(0.5)) / levels;
  if (p.mode < 1.5 || p.mode > 2.5) {
    let d = vec2f(max(1.0, select(1.2, p.pixel, p.mode > 2.5))) / p.size;
    let gx = luma(sampleAt(uv + vec2f(d.x, 0.0))) - luma(sampleAt(uv - vec2f(d.x, 0.0)));
    let gy = luma(sampleAt(uv + vec2f(0.0, d.y))) - luma(sampleAt(uv - vec2f(0.0, d.y)));
    let edge = smoothstep(0.055, 0.25, length(vec2f(gx, gy))) * p.ink;
    c = mix(c, vec3f(0.035, 0.065, 0.085), edge);
  }
  return vec4f(mix(original, clamp(c, vec3f(0.0), vec3f(1.0)), p.amount), 1.0);
}`;
  class PictureFilter {
    constructor(source, output, status) {
      this.source = source; this.output = output; this.status = status;
      this.mode = 'off'; this.ready = false; this.failed = false; this.initPromise = null;
      this.settings = { mix: .85, levels: 7, edge: .55, pixel: 3, saturation: 1.05 };
      this.frames = 0; this.failure = ''; this.onStatus = null;
    }
    report(text, failed = false) {
      if (this.status) { this.status.textContent = text; this.status.classList.toggle('failed', failed); }
      if (this.onStatus) this.onStatus({ text, failed });
    }
    fallback(reason) {
      this.ready = false; this.failed = true; this.failure = reason;
      this.output.style.display = 'none'; this.source.style.opacity = '1';
      this.report(reason + ' Original picture is active.', true);
    }
    async init() {
      if (this.ready) return true;
      if (this.initPromise) return this.initPromise;
      this.initPromise = (async () => {
        try {
          if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser.');
          const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
          if (!adapter) throw new Error('No WebGPU graphics device is available.');
          this.device = await adapter.requestDevice();
          this.device.lost.then(info => { if (info.reason !== 'destroyed') this.fallback('The graphics device disconnected.'); });
          this.device.addEventListener('uncapturederror', event => { event.preventDefault?.(); this.fallback('The graphics filter could not continue.'); });
          this.context = this.output.getContext('webgpu');
          if (!this.context) throw new Error('A WebGPU canvas could not start.');
          this.format = navigator.gpu.getPreferredCanvasFormat();
          this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
          const shader = this.device.createShaderModule({ label: 'Brassline cel and pixel shader', code: SHADER });
          if (shader.getCompilationInfo) {
            const info = await shader.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');
            if (errors.length) throw new Error('The graphics filter could not compile.');
          }
          this.pipeline = await this.device.createRenderPipelineAsync({ label: 'Brassline picture pipeline', layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' } });
          this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
          this.uniform = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
          this.ready = true; this.failed = false; this.texture = null;
          return true;
        } catch (e) { this.fallback(e.message || 'WebGPU could not start.'); return false; }
      })();
      const ok = await this.initPromise; this.initPromise = null; return ok;
    }
    async setMode(mode) {
      this.mode = ['off', 'cel', 'pixel', 'hybrid'].includes(mode) ? mode : 'off';
      if (this.mode === 'off') { this.output.style.display = 'none'; this.source.style.opacity = '1'; this.report('Original picture. No filter active.'); return true; }
      this.report('Starting the WebGPU filter…');
      const ok = await this.init();
      if (ok && this.mode !== 'off') this.report('WebGPU active. Interface text stays clear.');
      return ok;
    }
    present(canvas, width, height) {
      if (this.mode === 'off' || !this.ready || this.failed) return;
      try {
        if (!this.texture || this.texture.width !== width || this.texture.height !== height) {
          this.texture?.destroy();
          this.texture = this.device.createTexture({ label: 'Brassline source image', size: [width, height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
          this.bindGroup = this.device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.texture.createView() }, { binding: 1, resource: this.sampler }, { binding: 2, resource: { buffer: this.uniform } }] });
        }
        const tw = this.source.width, th = this.source.height;
        if (this.output.width !== tw || this.output.height !== th) { this.output.width = tw; this.output.height = th; }
        const s = this.settings;
        this.device.queue.writeBuffer(this.uniform, 0, new Float32Array([width, height, this.mode === 'cel' ? 1 : this.mode === 'pixel' ? 2 : 3, s.mix, s.levels, s.edge, s.pixel, s.saturation]));
        this.device.queue.copyExternalImageToTexture({ source: canvas }, { texture: this.texture }, [width, height]);
        const encoder = this.device.createCommandEncoder({ label: 'Brassline filter frame' });
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: .04, g: .07, b: .09, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
        const ratio = Math.min(tw / width, th / height);
        pass.setViewport((tw - width * ratio) / 2, (th - height * ratio) / 2, width * ratio, height * ratio, 0, 1);
        pass.setPipeline(this.pipeline); pass.setBindGroup(0, this.bindGroup); pass.draw(3); pass.end();
        this.device.queue.submit([encoder.finish()]); this.frames++;
        this.output.style.display = 'block'; this.source.style.opacity = '0';
      } catch (e) { this.fallback('The graphics filter is unavailable.'); }
    }
    snapshot() { return { requested: this.mode, active: this.ready && !this.failed && this.mode !== 'off', available: !!navigator.gpu, frames: this.frames, failure: this.failure, parameters: { ...this.settings } }; }
  }
  root.BrasslineFilter = PictureFilter;
})(globalThis);
