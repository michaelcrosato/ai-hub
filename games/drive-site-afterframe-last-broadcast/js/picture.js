/* AFTERFRAME picture pipeline. The source game always remains on Canvas 2D.
 * WebGPU is an optional, real WGSL postprocess. A CPU path retains play on
 * devices without WebGPU. HTML status and controls remain sharp. */
(() => {
 'use strict';
 const defaults={mode:'none',gpu:true,levels:6,edge:.65,pixel:4,mix:.8};
 const shader=`
 struct Params { size: vec2f, pixel: f32, levels: f32, edge: f32, amount: f32, mode: f32, pad: f32 };
 @group(0) @binding(0) var frame: texture_2d<f32>;
 @group(0) @binding(1) var frameSampler: sampler;
 @group(0) @binding(2) var<uniform> params: Params;
 struct Vert { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
 @vertex fn vertex(@builtin(vertex_index) index: u32) -> Vert {
   var points=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
   var result:Vert; let p=points[index]; result.pos=vec4f(p,0.0,1.0);
   result.uv=vec2f((p.x+1.0)*0.5,(1.0-p.y)*0.5); return result;
 }
 fn luma(c:vec3f)->f32 { return dot(c,vec3f(.2126,.7152,.0722)); }
 @fragment fn fragment(in:Vert) -> @location(0) vec4f {
   let original=textureSample(frame,frameSampler,in.uv).rgb;
   var uv=in.uv;
   let isPixel=params.mode>1.5;
   let isCel=params.mode<1.5 || params.mode>2.5;
   if(isPixel){let cell=max(1.0,params.pixel)*params.size.x/1280.0; uv=(floor(in.uv*params.size/cell)*cell+cell*.5)/params.size;}
   let colour=textureSample(frame,frameSampler,uv).rgb;
   let levels=max(params.levels-1.0,1.0);
   var result=floor(colour*levels+.5)/levels;
   if(isCel){
     let step=vec2f(1.6)/params.size;
     let a=luma(textureSample(frame,frameSampler,uv+vec2f(step.x,0.0)).rgb);
     let b=luma(textureSample(frame,frameSampler,uv-vec2f(step.x,0.0)).rgb);
     let c=luma(textureSample(frame,frameSampler,uv+vec2f(0.0,step.y)).rgb);
     let d=luma(textureSample(frame,frameSampler,uv-vec2f(0.0,step.y)).rgb);
     let contour=smoothstep(.025,.22,length(vec2f(a-b,c-d)));
     result=mix(result,vec3f(.016,.045,.065),clamp(contour*params.edge,0.0,1.0));
   }
   return vec4f(mix(original,result,params.amount),1.0);
 }`;
 class Picture {
  constructor(game,onStatus){
   this.game=game;this.source=game.screen.canvas;this.canvas=document.getElementById('gpuScreen');
   this.cpu=document.createElement('canvas');this.cpu.id='cpuScreen';this.cpu.setAttribute('aria-hidden','true');
   this.cpu.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none';
   this.canvas.after(this.cpu);this.cpuCtx=this.cpu.getContext('2d');
   this.work=document.createElement('canvas');this.workCtx=this.work.getContext('2d',{willReadFrequently:true});
   this.options={...defaults};this.onStatus=onStatus||(()=>{});this.status='Original picture. Select a filter to start.';this.backend='none';
   this.device=null;this.texture=null;this.initializing=null;this.failed=false;this.ready=false;this.failureReason='';this.frame=0;
   const present=game.screen.present.bind(game.screen);game.screen.present=()=>{present();this.draw();};
  }
  report(text){if(this.status!==text){this.status=text;this.onStatus(text);}}
  set(options){Object.assign(this.options,options);if(this.options.mode==='none'){this.hide();this.backend='none';this.report('Original ink · no image filter.');return;}
   if(this.options.gpu&&!this.device&&!this.failed&&!this.initializing)this.init();
   if(!this.options.gpu)this.report('Canvas filter · WebGPU is off.');
  }
  hide(){this.canvas.style.display='none';this.cpu.style.display='none';}
  failGPU(reason,device){
   if(device&&this.device&&device!==this.device)return;
   const old=this.device;this.failed=true;this.ready=false;this.failureReason=reason;this.device=null;this.pipeline=null;
   if(this.texture){this.texture.destroy();this.texture=null;}this.canvas.style.display='none';
   if(old){try{old.destroy();}catch{}}
   if(this.options.mode!=='none')this.report('Canvas filter · '+reason);
  }
  async init(){
   // The first microtask keeps `initializing` assignment correct on early failure.
   this.initializing=Promise.resolve().then(async()=>{
    let device=null,scope=false,lostDuringInit=false,failedDuringInit=false;
    try{
     if(!navigator.gpu)throw new Error('This browser does not expose WebGPU.');
     if(this.options.mode!=='none')this.report('Starting WebGPU…');
     const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
     if(!adapter)throw new Error('No WebGPU adapter is available.');
     device=await adapter.requestDevice();
     device.addEventListener('uncapturederror',event=>{event.preventDefault();failedDuringInit=true;this.failGPU('A GPU validation error occurred.',device);});
     device.lost.then(info=>{lostDuringInit=true;if(this.device===device)this.failGPU('The GPU device was lost.',device);});
     device.pushErrorScope('validation');scope=true;
     const module=device.createShaderModule({label:'AFTERFRAME cel and pixel WGSL',code:shader});
     const compile=await module.getCompilationInfo();const errors=compile.messages.filter(m=>m.type==='error');
     if(errors.length)throw new Error(errors.map(m=>m.message).join(' '));
     const context=this.canvas.getContext('webgpu');
     if(!context)throw new Error('A WebGPU canvas is not available.');
     const format=navigator.gpu.getPreferredCanvasFormat();
     context.configure({device,format,alphaMode:'opaque'});
     const pipeline=await device.createRenderPipelineAsync({label:'AFTERFRAME postprocess',layout:'auto',vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
     const sampler=device.createSampler({magFilter:'nearest',minFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
     const params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
     const validation=await device.popErrorScope();scope=false;if(validation)throw new Error(validation.message);
     if(lostDuringInit)throw new Error('The GPU device was lost during setup.');
     if(failedDuringInit)throw new Error('A GPU validation error occurred during setup.');
     Object.assign(this,{device,context,format,pipeline,sampler,params,ready:true});
    }catch(error){if(scope&&device){try{await device.popErrorScope();}catch{}}if(device){try{device.destroy();}catch{}}this.failGPU(error.message);}
    finally{this.initializing=null;}
   });return this.initializing;
  }
  draw(){
   const o=this.options;if(o.mode==='none'||o.mix===0){this.hide();this.backend='none';this.report(o.mode==='none'?'Original ink · no image filter.':'Original picture · filter mix is zero.');return;}
   if(o.gpu&&this.device&&this.ready){try{this.drawGPU();return;}catch(error){this.failGPU(error.message);}}
   this.drawCPU();
  }
  drawGPU(){
   const d=this.device,w=this.source.width,h=this.source.height,o=this.options;
   if(w>d.limits.maxTextureDimension2D||h>d.limits.maxTextureDimension2D)throw new Error('The picture size exceeds the GPU limit.');
   if(!this.texture||this.width!==w||this.height!==h){
    if(this.texture)this.texture.destroy();this.width=w;this.height=h;this.canvas.width=w;this.canvas.height=h;
    this.texture=d.createTexture({label:'Completed Canvas game frame',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
    this.bind=d.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.params}}]});
   }
   d.queue.copyExternalImageToTexture({source:this.source},{texture:this.texture},[w,h]);
   d.queue.writeBuffer(this.params,0,new Float32Array([w,h,o.pixel,o.levels,o.edge,o.mix,{cel:1,pixel:2,hybrid:3}[o.mode],0]));
   const encoder=d.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
   pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();d.queue.submit([encoder.finish()]);
   this.canvas.style.display='block';this.cpu.style.display='none';this.backend='webgpu';this.report('WebGPU active · hardware cel / pixel filter.');
  }
  drawCPU(){
   const o=this.options,src=this.source;this.canvas.style.display='none';this.cpu.style.display='block';this.backend='canvas';
   if(this.cpu.width!==src.width||this.cpu.height!==src.height){this.cpu.width=src.width;this.cpu.height=src.height;}
   const pixel=o.mode==='pixel'||o.mode==='hybrid',cel=o.mode!=='pixel';
   const w=Math.max(96,Math.round(pixel?1280/o.pixel:640)),h=Math.max(54,Math.round(w*src.height/src.width));
   if(this.work.width!==w||this.work.height!==h){this.work.width=w;this.work.height=h;}
   const c=this.workCtx;c.imageSmoothingEnabled=!pixel;c.drawImage(src,0,0,w,h);
   const image=c.getImageData(0,0,w,h),data=image.data,levels=Math.max(1,o.levels-1),ink=[4,11,17];
   let lum;if(cel){lum=new Float32Array(w*h);for(let k=0,i=0;k<lum.length;k++,i+=4)lum[k]=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;}
   for(let k=0,i=0;k<w*h;k++,i+=4){
    let edge=0;
    if(cel&&k%w>0&&k%w<w-1&&k>=w&&k<(h-1)*w){edge=Math.min(1,Math.max(0,(Math.hypot(lum[k-1]-lum[k+1],lum[k-w]-lum[k+w])-.025)/.195))*o.edge;edge=Math.min(1,edge);}
    for(let ch=0;ch<3;ch++){const q=Math.round(data[i+ch]/255*levels)/levels*255;data[i+ch]=q*(1-edge)+ink[ch]*edge;}
   }
   c.putImageData(image,0,0);const g=this.cpuCtx;g.globalAlpha=1;g.imageSmoothingEnabled=true;g.drawImage(src,0,0);g.globalAlpha=o.mix;g.imageSmoothingEnabled=!pixel;g.drawImage(this.work,0,0,this.cpu.width,this.cpu.height);g.globalAlpha=1;
   if(!o.gpu)this.report('Canvas filter · WebGPU is off.');else if(this.failureReason)this.report('Canvas filter · '+this.failureReason);else this.report('Canvas filter · waiting for WebGPU.');
  }
 }
 window.AfterframePicture=Picture;
})();
