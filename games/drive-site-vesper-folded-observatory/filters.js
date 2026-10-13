/* Optional WebGPU presentation pass. The original Canvas renderer is always available. */
(function(root){
  'use strict';
  const shader=`
struct Settings { size: vec2f, pixelSize: f32, bands: f32, outline: f32, saturation: f32, mode: f32, padding: f32 };
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var<uniform> settings: Settings;
struct Output { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vertexMain(@builtin(vertex_index) i:u32) -> Output {
  let positions=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
  var out:Output; out.position=vec4f(positions[i],0.0,1.0); out.uv=positions[i]*vec2f(0.5,-0.5)+vec2f(0.5); return out;
}
fn readColor(p:vec2f)->vec3f {
  let bounds=vec2i(textureDimensions(source))-vec2i(1);
  return textureLoad(source,clamp(vec2i(p),vec2i(0),bounds),0).rgb;
}
@fragment fn fragmentMain(in:Output)->@location(0) vec4f {
  var pixel=in.uv*settings.size;
  let isPixel=settings.mode>1.5;
  let isCel=settings.mode<1.5||settings.mode>2.5;
  if(isPixel){pixel=floor(pixel/settings.pixelSize)*settings.pixelSize+vec2f(settings.pixelSize*0.5);}
  var color=readColor(pixel);
  let luminance=dot(color,vec3f(0.2126,0.7152,0.0722));
  color=mix(vec3f(luminance),color,settings.saturation);
  if(isCel){
    let quantized=floor(color*settings.bands+vec3f(0.5))/settings.bands;
    color=mix(color,quantized,0.76);
    let stepSize=max(1.0,select(1.5,settings.pixelSize,isPixel));
    let right=readColor(pixel+vec2f(stepSize,0.0));
    let left=readColor(pixel-vec2f(stepSize,0.0));
    let up=readColor(pixel-vec2f(0.0,stepSize));
    let down=readColor(pixel+vec2f(0.0,stepSize));
    let edge=length(right-left)+length(up-down);
    let ink=smoothstep(0.12,0.65,edge)*settings.outline;
    color=mix(color,vec3f(0.018,0.055,0.073),ink);
  }
  if(isPixel){
    let cell=vec2u(pixel/settings.pixelSize)%vec2u(2u);
    let ordered=array<f32,4>(0.0,0.5,0.75,0.25);
    let dither=(ordered[cell.x+cell.y*2u]-0.375)/(settings.bands*2.0);
    color=floor(clamp(color+vec3f(dither),vec3f(0.0),vec3f(1.0))*settings.bands+vec3f(0.5))/settings.bands;
  }
  return vec4f(clamp(color,vec3f(0.0),vec3f(1.0)),1.0);
}`;
  class VesperFilter{
    constructor(canvas,onStatus){this.canvas=canvas;this.onStatus=onStatus;this.mode='none';this.ready=false;this.failed=false;this.initializing=null;this.params={bands:7,outline:.45,pixels:3,saturation:1};this.generation=0;}
    async init(){
      if(this.ready)return true;if(this.failed)return false;if(this.initializing)return this.initializing;
      this.initializing=this.setup();return this.initializing;
    }
    async setup(){
      try{
        if(!navigator.gpu||!isSecureContext)throw new Error('WebGPU is not available here. The original picture remains active.');
        const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter is available. The original picture remains active.');
        this.device=await adapter.requestDevice();const d=this.device;
        this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('The WebGPU canvas could not start.');
        this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format:this.format,alphaMode:'opaque'});
        const module=d.createShaderModule({label:'Vesper cel and pixel filter',code:shader});
        if(module.getCompilationInfo){const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>m.message).join('; '));}
        this.pipeline=await d.createRenderPipelineAsync({label:'Vesper postprocess',layout:'auto',vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
        this.uniform=d.createBuffer({label:'Vesper filter controls',size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
        d.lost.then(()=>this.fail('The graphics device was reset. The original picture is active.'));
        d.addEventListener('uncapturederror',e=>this.fail('The filter stopped. The original picture is active.'));
        this.ready=true;return true;
      }catch(e){this.fail(e.message||'WebGPU could not start. The original picture is active.');return false;}
    }
    async setMode(mode){
      const ticket=++this.generation;this.mode=mode;
      if(mode==='none'){this.canvas.style.display='none';this.onStatus('Original rendering is active.',false);return true;}
      this.onStatus('Starting WebGPU…',false);const ok=await this.init();if(ticket!==this.generation)return false;
      if(!ok){this.mode='none';this.onStatus(this.lastError||'WebGPU is unavailable. The original picture is active.',true);return false;}this.onStatus('WebGPU is active. Adjust the picture below.',false);return true;
    }
    fail(message){this.lastError=message;this.failed=true;this.ready=false;this.mode='none';this.canvas.style.display='none';this.onStatus(message,true);}
    render(source){
      if(!this.ready||this.mode==='none')return;
      try{
        const d=this.device,w=source.width,h=source.height;if(!w||!h)return;
        if(this.width!==w||this.height!==h){this.texture?.destroy();this.canvas.width=w;this.canvas.height=h;this.width=w;this.height=h;this.texture=d.createTexture({label:'Canvas frame',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.bind=d.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:{buffer:this.uniform}}]});}
        d.queue.copyExternalImageToTexture({source},{texture:this.texture},[w,h]);
        const p=this.params,pixelRatio=source.clientWidth?Math.max(1,w/source.clientWidth):1;d.queue.writeBuffer(this.uniform,0,new Float32Array([w,h,p.pixels*pixelRatio,p.bands,p.outline,p.saturation,{cel:1,pixel:2,hybrid:3}[this.mode]||0,0]));
        const encoder=d.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();d.queue.submit([encoder.finish()]);this.canvas.style.display='block';
      }catch(e){this.fail('The filter could not render. The original picture is active.');}
    }
  }
  root.VesperFilter=VesperFilter;
})(window);
