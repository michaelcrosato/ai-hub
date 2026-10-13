/* Optional, real WebGPU image filters. The Canvas renderer remains the fallback. */
const WGSL = `
struct Params { size: vec2f, mode: f32, block: f32, bands: f32, edge: f32, mixValue: f32, saturation: f32, levels: f32, dither: f32, pad: vec2f };
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> p: Params;
@vertex fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let xy = array<vec2f, 3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  return vec4f(xy[i],0.0,1.0);
}
fn readAt(at: vec2f) -> vec3f { return textureLoad(scene,vec2i(clamp(at,vec2f(0.0),p.size-vec2f(1.0))),0).rgb; }
fn luma(c: vec3f) -> f32 { return dot(c,vec3f(.2126,.7152,.0722)); }
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let original = readAt(pos.xy);
  var color = original;
  if (p.mode > 1.5) {
    let block = max(1.0,p.block);
    let cell = floor(pos.xy/block);
    color = readAt(cell*block+vec2f(block*.5));
    let pattern = array<f32,16>(0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);
    let idx = (u32(cell.y)%4u)*4u+(u32(cell.x)%4u);
    let d = (pattern[idx]/16.0-.5)*p.dither;
    color = floor(color*p.levels+vec3f(.5+d))/p.levels;
  } else {
    let brightness = luma(color);
    let band = floor(brightness*p.bands+.5)/p.bands;
    color *= (band+.08)/(brightness+.08);
    let dx = abs(luma(readAt(pos.xy+vec2f(1.5,0.0)))-luma(readAt(pos.xy-vec2f(1.5,0.0))));
    let dy = abs(luma(readAt(pos.xy+vec2f(0.0,1.5)))-luma(readAt(pos.xy-vec2f(0.0,1.5))));
    color *= 1.0-smoothstep(.025,.16,dx+dy)*p.edge;
  }
  color = mix(vec3f(luma(color)),color,p.saturation);
  return vec4f(clamp(mix(original,color,p.mixValue),vec3f(0.0),vec3f(1.0)),1.0);
}`;
export class WebGPUFilter {
  constructor(canvas,onStatus=()=>{}){this.canvas=canvas;this.onStatus=onStatus;this.status='idle';this.options={mode:'none',pixelSize:4,bands:7,edge:.65,mix:.9,saturation:1.08,levels:16,dither:.3};this.ready=false;this.destroyed=false;this.canvas.hidden=true;}
  report(status,detail=''){this.status=status;this.onStatus({status,detail});}
  async init(){
    if(this.ready)return true;if(this.pending)return this.pending;
    this.pending=(async()=>{
      if(!globalThis.isSecureContext||!navigator.gpu){this.report('unavailable','WebGPU is not available in this browser. The original view is active.');return false;}
      this.report('initializing','Preparing the graphics filter…');
      try{
        const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
        if(!adapter)throw new Error('No WebGPU adapter is available.');
        const device=await adapter.requestDevice();if(this.destroyed){device.destroy();return false;}this.device=device;
        this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('A WebGPU canvas could not be created.');
        this.format=navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({device,format:this.format,alphaMode:'opaque'});
        const shader=device.createShaderModule({label:'HUSHLINE cel and pixel filter',code:WGSL});
        if(shader.getCompilationInfo){const info=await shader.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(e=>e.message).join('; '));}
        this.pipeline=await device.createRenderPipelineAsync({label:'HUSHLINE scene filter',layout:'auto',vertex:{module:shader,entryPoint:'vertex'},fragment:{module:shader,entryPoint:'fragment',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
        this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
        device.lost.then(info=>{if(!this.destroyed){this.ready=false;this.canvas.hidden=true;this.report('unavailable','The GPU connection was lost. The original view is active.');}});
        device.addEventListener('uncapturederror',event=>{if(!this.destroyed){this.ready=false;this.canvas.hidden=true;this.report('unavailable','The filter stopped. The original view is active.');console.warn('HUSHLINE WebGPU:',event.error.message);}});
        this.ready=true;this.report('ready','WebGPU ready');return true;
      }catch(error){this.canvas.hidden=true;this.report('unavailable',error.message+' The original view is active.');return false;}
    })();return this.pending;
  }
  async set(options){Object.assign(this.options,options);if(this.options.mode==='none'){this.canvas.hidden=true;return;}await this.init();}
  render(source,logicalHeight=720){
    if(!this.ready||this.options.mode==='none'||this.destroyed){this.canvas.hidden=true;return;}
    try{
      const {device}=this,w=source.width,h=source.height;if(w<1||h<1)return;
      if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.canvas.width=w;this.canvas.height=h;if(this.texture)this.texture.destroy();this.texture=device.createTexture({label:'HUSHLINE Canvas source',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.bindGroup=device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:{buffer:this.uniform}}]});}
      const o=this.options;device.queue.copyExternalImageToTexture({source},{texture:this.texture},[w,h]);
      device.queue.writeBuffer(this.uniform,0,new Float32Array([w,h,o.mode==='pixel'?2:1,o.pixelSize*h/logicalHeight,o.bands,o.edge,o.mix,o.saturation,o.levels,o.dither,0,0]));
      const encoder=device.createCommandEncoder({label:'HUSHLINE filter frame'});const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);this.canvas.hidden=false;
    }catch(error){this.ready=false;this.canvas.hidden=true;this.report('unavailable','The filter stopped. The original view is active.');console.warn('HUSHLINE filter fallback:',error.message);}
  }
  destroy(){this.destroyed=true;this.canvas.hidden=true;this.texture?.destroy();this.uniform?.destroy();this.context?.unconfigure();this.device?.destroy();}
}
