/* Optional real WebGPU post-processing, with a named Canvas compatibility path. */
export class ArtFilter {
 constructor(base,canvas,onStatus){this.base=base;this.canvas=canvas;this.onStatus=onStatus;this.settings={mode:'standard',gpu:true,bands:10,edge:.8,pixel:4,dither:.18,saturation:1.05,strength:.75};this.backend='Standard';this.device=null;this.context=null;this.ready=false;this.pending=false;this.failed=false;this.lastCPU=0;this.small=document.createElement('canvas');this.cpuCanvas=null;}
 async apply(settings){const generation=this.applyGeneration=(this.applyGeneration||0)+1;Object.assign(this.settings,settings);this.canvas.style.display='none';if(this.cpuCanvas)this.cpuCanvas.style.display='none';if(this.settings.mode==='standard'){this.backend='Standard';this.report();return;}
 if(this.settings.gpu&&!this.failed&&!this.ready)await this.initGPU();
 if(generation!==this.applyGeneration)return;
 this.canvas.style.display='none';if(this.cpuCanvas)this.cpuCanvas.style.display='none';if(this.settings.mode==='standard'){this.backend='Standard';this.report();return;}
 if(this.ready&&this.settings.gpu){this.backend='WebGPU';this.canvas.style.display='block';}else{this.backend='Canvas compatibility';if(!this.cpuCanvas){this.cpuCanvas=document.createElement('canvas');this.cpuCanvas.className='filter-canvas';this.base.after(this.cpuCanvas);}this.cpuCanvas.style.display='block';}this.report();
 }
 report(){this.onStatus?.(this.backend,this.failed?'WebGPU is unavailable. The compatibility filter is active.':'');}
 initGPU(){if(!this.initPromise){this.pending=true;this.initPromise=this.createGPU();}return this.initPromise;}
 async createGPU(){try{
 if(!navigator.gpu)throw new Error('No WebGPU API');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No adapter');this.device=await adapter.requestDevice();
 const device=this.device;this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('No WebGPU context');this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device,format:this.format,alphaMode:'opaque'});
 const code=`struct Params { a:vec4f, b:vec4f, c:vec4f }; @group(0) @binding(0) var tex:texture_2d<f32>; @group(0) @binding(1) var samp:sampler; @group(0) @binding(2) var<uniform> p:Params;
 struct VOut { @builtin(position) pos:vec4f, @location(0) uv:vec2f };
 @vertex fn vs(@builtin(vertex_index) i:u32)->VOut { var points=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));var out:VOut;out.pos=vec4f(points[i],0.,1.);out.uv=vec2f((points[i].x+1.)*.5,1.-(points[i].y+1.)*.5);return out; }
 fn sampleColor(uv:vec2f)->vec3f { return textureSampleLevel(tex,samp,clamp(uv,vec2f(0.),vec2f(1.)),0.).rgb; }
 fn lum(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
 @fragment fn fs(in:VOut)->@location(0) vec4f {let wh=p.a.xy;let mode=p.a.z;let block=p.a.w;let bands=p.b.x;let edge=p.b.y;let dither=p.b.z;let sat=p.b.w;let strength=p.c.x;
 var uv=in.uv;if(mode>1.5){uv=(floor(uv*wh/block)+vec2f(.5))*block/wh;}
 let original=sampleColor(in.uv);var color=sampleColor(uv);color=mix(vec3f(lum(color)),color,sat);
 var noise=0.;if(mode>1.5){let cell=floor(in.uv*wh/block);noise=(fract(sin(dot(cell,vec2f(12.9898,78.233)))*43758.5453)-.5)*dither/bands;}
 color=floor(clamp(color+vec3f(noise),vec3f(0.),vec3f(1.))*bands+vec3f(.5))/bands;
 if(mode<1.5){let step=vec2f(1.5)/wh;let dx=abs(lum(sampleColor(uv+vec2f(step.x,0.)))-lum(sampleColor(uv-vec2f(step.x,0.))));let dy=abs(lum(sampleColor(uv+vec2f(0.,step.y)))-lum(sampleColor(uv-vec2f(0.,step.y))));let ink=smoothstep(.06,.26,(dx+dy)*edge);color=mix(color,vec3f(.07,.16,.13),ink*.85);}
 return vec4f(mix(original,color,strength),1.); }`;
 const module=device.createShaderModule({code});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw new Error('Shader compilation failed');
 this.pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
 this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});this.ready=true;
 device.lost.then(()=>{this.ready=false;this.failed=true;this.apply(this.settings);});device.addEventListener('uncapturederror',()=>{this.ready=false;this.failed=true;this.apply(this.settings);},{once:true});
 }catch(error){this.failed=true;this.ready=false;this.error=error.message;}finally{this.pending=false;}}
 render(){const s=this.settings;if(s.mode==='standard')return;if(this.ready&&s.gpu){try{const w=this.base.width,h=this.base.height;if(!w||!h)return;if(this.canvas.width!==w||this.canvas.height!==h||!this.texture){this.canvas.width=w;this.canvas.height=h;this.texture?.destroy();this.texture=this.device.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.bind=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.uniform}}]});}
 this.device.queue.copyExternalImageToTexture({source:this.base},{texture:this.texture},[w,h]);this.device.queue.writeBuffer(this.uniform,0,new Float32Array([w,h,s.mode==='pixel'?2:1,s.pixel,s.bands,s.edge,s.dither,s.saturation,s.strength,0,0,0]));const encoder=this.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
 }catch(e){this.ready=false;this.failed=true;this.apply(s);}return;}
 if(!this.cpuCanvas)return;const now=performance.now();if(now-this.lastCPU<65)return;this.lastCPU=now;this.renderCPU();
 }
 renderCPU(){const s=this.settings,w=this.base.width,h=this.base.height;if(s.strength===0){const out=this.cpuCanvas;if(out.width!==w||out.height!==h){out.width=w;out.height=h;}out.getContext('2d').drawImage(this.base,0,0);return;}const pixel=s.mode==='pixel',factor=pixel?Math.max(2,s.pixel):Math.max(1,w/800),sw=Math.max(1,Math.floor(w/factor)),sh=Math.max(1,Math.floor(h/factor));if(this.small.width!==sw||this.small.height!==sh){this.small.width=sw;this.small.height=sh;}const g=this.small.getContext('2d',{willReadFrequently:true});g.drawImage(this.base,0,0,sw,sh);const image=g.getImageData(0,0,sw,sh),a=image.data,bands=s.bands;const original=!pixel?new Uint8ClampedArray(a):null;
 for(let i=0;i<a.length;i+=4){const y=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2],j=i/4,x=j%sw,row=Math.floor(j/sw),n=pixel?((((x+row)%2)*2-1)*s.dither*255/bands*.3):0;let ink=0;if(!pixel&&x>0&&x<sw-1&&row>0&&row<sh-1){const l=(k)=>.2126*original[k]+.7152*original[k+1]+.0722*original[k+2];ink=Math.min(.8,Math.max(0,(Math.abs(l(i-4)-l(i+4))+Math.abs(l(i-sw*4)-l(i+sw*4))-32)/160*s.edge));}for(let c=0;c<3;c++){const base=a[i+c],value=y+(base-y)*s.saturation,quant=Math.round((value+n)/255*bands)/bands*255,target=quant*(1-ink);a[i+c]=base+(target-base)*s.strength;}}
 g.putImageData(image,0,0);const out=this.cpuCanvas;if(out.width!==w||out.height!==h){out.width=w;out.height=h;}const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=!pixel;ctx.drawImage(this.small,0,0,w,h);
 }
}
