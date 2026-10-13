/* WebGPU post processing. Canvas fallback keeps both looks available. */
(() => {
 'use strict';
 class StageFilters {
  constructor(canvas,onStatus){this.canvas=canvas;this.onStatus=onStatus;this.mode='original';this.levels=6;this.edge=.45;this.pixel=4;this.palette=12;this.state='checking';this.backend='Canvas 2D';this.small=document.createElement('canvas');this.smallCtx=this.small.getContext('2d',{willReadFrequently:true});this.init();}
  async init(){
   try{
    if(!navigator.gpu)throw new Error('WebGPU is unavailable');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter');
    const device=await adapter.requestDevice();this.device=device;
    device.addEventListener('uncapturederror',event=>{event.preventDefault();this.fallback('Canvas fallback · GPU error',event.error);});
    device.lost.then(info=>this.fallback('WebGPU lost · Canvas fallback',info.message||'WebGPU device lost','lost'));
    this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('No WebGPU canvas');
    this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device,format:this.format,alphaMode:'opaque'});
    const code=`
struct Params { size: vec2f, mode: f32, bands: f32, edge: f32, pixel: f32, palette: f32, unused: f32 }
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var sam: sampler;
@group(0) @binding(2) var<uniform> p: Params;
struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
 var xy=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));
 var o:VOut;o.pos=vec4f(xy[i],0.,1.);o.uv=vec2f((xy[i].x+1.)*.5,1.-(xy[i].y+1.)*.5);return o;
}
fn luminance(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
@fragment fn fs(i:VOut)->@location(0) vec4f {
 var uv=i.uv;
 if(p.mode>1.5){uv=(floor(uv*p.size/p.pixel)+.5)*p.pixel/p.size;}
 var color=textureSampleLevel(src,sam,uv,0.).rgb;
 if(p.mode<1.5){
  let d=1.6/p.size;
  let left=luminance(textureSampleLevel(src,sam,uv-vec2f(d.x,0.),0.).rgb);
  let right=luminance(textureSampleLevel(src,sam,uv+vec2f(d.x,0.),0.).rgb);
  let up=luminance(textureSampleLevel(src,sam,uv-vec2f(0.,d.y),0.).rgb);
  let down=luminance(textureSampleLevel(src,sam,uv+vec2f(0.,d.y),0.).rgb);
  let edge=clamp((abs(left-right)+abs(up-down))*p.edge*5.,0.,.9);
  color=floor(color*p.bands+.5)/p.bands;color*=1.-edge;
 }else{
  let grid=floor(uv*p.size/p.pixel);let noise=(fract(dot(grid,vec2f(.754877,.569841)))-.5)/p.palette*.65;
  color=floor(clamp(color+noise,vec3f(0.),vec3f(1.))*p.palette+.5)/p.palette;
 }
 return vec4f(color,1.);
}`;
    const module=device.createShaderModule({code});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw new Error(info.messages.filter(m=>m.type==='error').map(m=>m.message).join('; '));
    if(this.state!=='checking')return;
    this.pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
    if(this.state!=='checking')return;
    this.uniform=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});
    this.state='ready';this.backend='WebGPU';this.onStatus('WebGPU available');
   }catch(err){this.fallback('Canvas fallback · WebGPU unavailable',err);}
  }
  fallback(message,error,state='fallback'){this.canvas.style.display='none';if(this.state==='fallback'||this.state==='lost')return;this.state=state;this.backend='Canvas 2D';this.error=typeof error==='string'?error:error?.message||'WebGPU error';this.onStatus(message);}
  setMode(mode){if(!['original','cel','pixel'].includes(mode))throw new Error('Unknown visual style');this.mode=mode;if(mode==='original')this.canvas.style.display='none';}
  render(source,screen){
   if(this.mode==='original'){this.canvas.style.display='none';return;}
   // Screen.buf includes two padding pixels; sample only the visible stage.
   const srcW=screen.W,srcH=screen.H;
   if(this.state==='ready'){
    try{
     const d=this.device,w=srcW,h=srcH;
     if(!this.texture||this.texW!==w||this.texH!==h){this.texture?.destroy();this.texW=w;this.texH=h;this.texture=d.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.bind=d.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.uniform}}]});}
     if(this.canvas.width!==screen.canvas.width||this.canvas.height!==screen.canvas.height){this.canvas.width=screen.canvas.width;this.canvas.height=screen.canvas.height;}
     d.queue.copyExternalImageToTexture({source},{texture:this.texture},[w,h]);d.queue.writeBuffer(this.uniform,0,new Float32Array([w,h,this.mode==='cel'?1:2,this.levels,this.edge,this.pixel,this.palette,0]));
     const enc=d.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.setViewport(screen.OX,screen.OY,screen.W*screen.S,screen.H*screen.S,0,1);pass.draw(3);pass.end();d.queue.submit([enc.finish()]);this.canvas.style.display='block';return;
    }catch(e){this.fallback('Canvas fallback · GPU error',e);}
   }
   // Fallback uses a small staging buffer to limit CPU cost.
   this.canvas.style.display='none';const cell=this.mode==='pixel'?this.pixel:2.5,w=Math.ceil(srcW/cell),h=Math.ceil(srcH/cell),g=this.smallCtx;
   if(this.small.width!==w||this.small.height!==h){this.small.width=w;this.small.height=h;}g.imageSmoothingEnabled=this.mode==='cel';g.drawImage(source,0,0,srcW,srcH,0,0,w,h);
   const img=g.getImageData(0,0,w,h),data=img.data,bands=this.mode==='cel'?this.levels:this.palette;
   const original=this.mode==='cel'?data.slice():data,row=w*4,lum=j=>original[j]*.2126+original[j+1]*.7152+original[j+2]*.0722;
   for(let i=0;i<data.length;i+=4){let edge=0;const x=(i/4)%w;if(this.mode==='cel'&&i>=row&&i<data.length-row&&x>0&&x<w-1){edge=Math.min(.8,(Math.abs(lum(i-4)-lum(i+4))+Math.abs(lum(i-row)-lum(i+row)))/255*this.edge*2.4);}for(let k=0;k<3;k++)data[i+k]=Math.round(original[i+k]/255*bands)/bands*255*(1-edge);}
   g.putImageData(img,0,0);const out=screen.sctx;out.imageSmoothingEnabled=this.mode==='cel';out.drawImage(this.small,screen.OX,screen.OY,screen.W*screen.S,screen.H*screen.S);
  }
 }
 window.StageFilters=StageFilters;
})();
