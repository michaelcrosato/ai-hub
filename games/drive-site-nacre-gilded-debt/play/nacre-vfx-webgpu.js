/* Nacre optional visual presentation. No simulation, world or gameplay access.
 * Canvas input and normalized coordinates use a top-left origin. */
(function(root){'use strict';
const COMMON=String.raw`
struct Params {
 size:vec4f, source:vec4f, focus:vec4f, control:vec4f,
 e0:vec4f, e1:vec4f, e2:vec4f, e3:vec4f, e4:vec4f, camera:vec4f,
 lights:array<vec4f,32>,
};
@group(0) @binding(0) var<uniform> P:Params;
fn hash2(p:vec2f)->f32{return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453);}
fn noise2(p:vec2f)->f32{let i=floor(p);let f=fract(p);let t=f*f*(vec2f(3.0)-2.0*f);return mix(mix(hash2(i),hash2(i+vec2f(1,0)),t.x),mix(hash2(i+vec2f(0,1)),hash2(i+vec2f(1,1)),t.x),t.y);}
fn lum(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
fn aspect()->f32{return P.size.x/max(1.0,P.size.y);}
fn clearZone(uv:vec2f)->f32{return .15+.85*smoothstep(.06,.18,length((uv-P.focus.xy)*vec2f(aspect(),1)));}
fn movingTime()->f32{return select(P.size.z,0.0,P.control.y>.5);}
`;
const EXTRACT=COMMON+String.raw`
@group(0) @binding(1) var inputT:texture_2d<f32>;
@group(0) @binding(2) var linearS:sampler;
@group(0) @binding(3) var outputT:texture_storage_2d<rgba8unorm,write>;
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3u){
 let d=textureDimensions(outputT);if(any(id.xy>=d)){return;}
 let uv=(vec2f(id.xy)+vec2f(.5))/vec2f(d);let col=textureSampleLevel(inputT,linearS,uv,0).rgb;
 let bright=max(0.0,max(col.r,max(col.g,col.b))-.78);textureStore(outputT,vec2i(id.xy),vec4f(col*bright*1.6,1));
}`;
const BLUR=COMMON+String.raw`
@group(0) @binding(1) var inputT:texture_2d<f32>;
@group(0) @binding(2) var linearS:sampler;
@group(0) @binding(3) var outputT:texture_storage_2d<rgba8unorm,write>;
fn blur(id:vec2u,axis:vec2f){let d=textureDimensions(outputT);if(any(id>=d)){return;}let uv=(vec2f(id)+vec2f(.5))/vec2f(d);let step=axis/vec2f(d);
 var col=textureSampleLevel(inputT,linearS,uv,0).rgb*.227027;
 col+=(textureSampleLevel(inputT,linearS,uv+step*1.384615,0).rgb+textureSampleLevel(inputT,linearS,uv-step*1.384615,0).rgb)*.316216;
 col+=(textureSampleLevel(inputT,linearS,uv+step*3.230769,0).rgb+textureSampleLevel(inputT,linearS,uv-step*3.230769,0).rgb)*.070270;
 textureStore(outputT,vec2i(id),vec4f(col,1));}
@compute @workgroup_size(8,8) fn blurH(@builtin(global_invocation_id) id:vec3u){blur(id.xy,vec2f(1,0));}
@compute @workgroup_size(8,8) fn blurV(@builtin(global_invocation_id) id:vec3u){blur(id.xy,vec2f(0,1));}
`;
const FIELD=COMMON+String.raw`
@group(0) @binding(1) var inputT:texture_2d<f32>;
@group(0) @binding(2) var linearS:sampler;
@group(0) @binding(3) var maskT:texture_2d<f32>;
@group(0) @binding(4) var outputT:texture_storage_2d<rgba8unorm,write>;
// Deterministic analytic particles. They have no storage or gameplay lifetime.
fn particles(uv:vec2f,grid:vec2f,speed:vec2f,seed:f32,chance:f32,radius:vec2f)->f32{
 let q=uv*grid+speed*movingTime();let cell=floor(q);let f=fract(q);var value=0.0;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let off=vec2f(f32(x),f32(y));let h=hash2(cell+off+vec2f(seed,seed*.17));if(h>chance){continue;}let center=vec2f(hash2(cell+off+vec2f(seed+3.0)),hash2(cell+off+vec2f(seed+9.0)));let d=(f-off-center)/radius;let shape=1.0-smoothstep(.25,1.0,length(d));value=max(value,shape*(.5+h/max(.01,chance)*.5));}}
 return value;
}
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3u){
 let d=textureDimensions(outputT);if(any(id.xy>=d)){return;}let uv=(vec2f(id.xy)+vec2f(.5))/vec2f(d);let protect=clearZone(uv);let t=movingTime();var col=vec3f(0);var fog=0.0;
 if(P.e0.z>.5){let n=noise2(uv*vec2f(4.0*aspect(),4.0)+vec2f(t*.013,-t*.006));fog=(.035+n*.085)*protect;col+=vec3f(.57,.69,.66)*fog;}
 if(P.e0.y>.5){var beams=0.0;for(var i=1;i<=6;i++){let k=f32(i)/7.0;let at=mix(uv,P.focus.zw,k*.65);let light=textureSampleLevel(inputT,linearS,clamp(at,vec2f(0),vec2f(1)),0).rgb;beams+=max(lum(light)-.62,0.0)*(1.0-k)*.221;}let angular=.62+.38*sin(atan2(uv.y-P.focus.w,(uv.x-P.focus.z)*aspect())*29.0);col+=vec3f(1.0,.83,.56)*beams*angular*protect;}
 if(P.e2.z>.5){for(var i=0u;i<16u;i++){if(f32(i)>=P.control.w){break;}let a=P.lights[i*2u];let b=P.lights[i*2u+1u];let q=length((uv-a.xy)*vec2f(aspect(),1.0))/max(.002,a.z);let glow=pow(max(0.0,1.0-q),2.0);col+=b.rgb*glow*.22*protect;}}
 if(P.control.y<.5){let q=select(select(.65,.85,P.control.z>.5),1.0,P.control.z>1.5);
  if(P.e0.w>.5){let v=particles(uv,vec2f(28,18)*q,vec2f(.11,-.075),13.0,.25,vec2f(.063));col+=vec3f(.81,.71,.46)*v*.34*protect;}
  if(P.e1.x>.5){let v=particles(uv,vec2f(20,14)*q,vec2f(.18,.34),29.0,.14,vec2f(.060,.075));col+=vec3f(1.0,.37,.09)*v*.58*protect;}
  if(P.e1.y>.5){let v=particles(uv,vec2f(40,26)*q,vec2f(1.7,-8.5),41.0,.448,vec2f(.026,.40));col+=vec3f(.46,.63,.68)*v*.48*protect;}
  if(P.e1.z>.5){let v=particles(uv+vec2f(sin(t*.4+uv.y*8.0)*.006,0),vec2f(28,18)*q,vec2f(.23,-.48),61.0,.308,vec2f(.085));col+=vec3f(.8,.85,.80)*v*.62*protect;}
  if(P.e1.w>.5){let v=particles(uv+vec2f(sin(t*.65+uv.y*11.0)*.013,0),vec2f(18,12)*q,vec2f(.35,-.45),79.0,.17,vec2f(.12,.045));col+=vec3f(.64,.35,.10)*v*.42*protect;}
 }
 textureStore(outputT,vec2i(id.xy),vec4f(clamp(col,vec3f(0),vec3f(.55)),fog));
}`;
const COMPOSITE=COMMON+String.raw`
@group(0) @binding(1) var inputT:texture_2d<f32>;
@group(0) @binding(2) var linearS:sampler;
@group(0) @binding(3) var maskT:texture_2d<f32>;
@group(0) @binding(4) var bloomT:texture_2d<f32>;
@group(0) @binding(5) var fieldT:texture_2d<f32>;
@group(0) @binding(6) var outputT:texture_storage_2d<rgba8unorm,write>;
fn sourceAt(uv:vec2f)->vec3f{let d=vec2i(textureDimensions(inputT));return textureLoad(inputT,clamp(vec2i(floor(uv*vec2f(d))),vec2i(0),d-vec2i(1)),0).rgb;}
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3u){
 let dims=textureDimensions(outputT);if(any(id.xy>=dims)){return;}let uv=(vec2f(id.xy)+vec2f(.5))/vec2f(dims);let strength=P.size.w;let protect=clearZone(uv);let t=movingTime();var warp=vec2f(0);
 let mask=textureSampleLevel(maskT,linearS,uv,0).r;
 if(P.e2.x>.5&&P.control.y<.5){for(var i=0u;i<16u;i++){if(f32(i)>=P.control.w){break;}let a=P.lights[i*2u];if(a.w<=0.0){continue;}let d=(uv-a.xy)*vec2f(aspect(),1);let hot=max(0.0,1.0-length(d)/max(.002,a.z));warp.x+=sin(uv.y*190.0+t*6.0+a.x*39.0)*hot*a.w*.0014*protect/aspect();}}
 if(P.e2.y>.5&&mask>.01&&P.control.y<.5){warp+=vec2f(sin(uv.y*153.0+t*1.2),sin(uv.x*173.0-t*.8))*.0012*mask*protect;}
 let at=uv+warp*strength;var col=sourceAt(at);
 if(P.e3.w>.5){let edge=smoothstep(.23,.72,length((uv-vec2f(.5))*vec2f(aspect(),1)));let off=(uv-vec2f(.5))*edge*strength*.0017*protect;col=vec3f(sourceAt(at+off).r,col.g,sourceAt(at-off).b);}
 if(P.e3.z>.5){let step=vec2f(1)/vec2f(textureDimensions(inputT));let adjacent=(sourceAt(at+vec2f(step.x,0))+sourceAt(at-vec2f(step.x,0))+sourceAt(at+vec2f(0,step.y))+sourceAt(at-vec2f(0,step.y)))*.25;col=clamp(col+(col-adjacent)*.28*strength,vec3f(0),vec3f(1));}
 if(P.e0.x>.5){col+=textureSampleLevel(bloomT,linearS,uv,0).rgb*.64*strength*protect;}
 let field=textureSampleLevel(fieldT,linearS,uv,0);col=col*(1.0-min(.18,field.a*strength))+field.rgb*strength;
 if(P.e2.y>.5&&mask>.01){let glint=pow(max(0.0,sin(uv.y*110.0+sin(uv.x*70.0)+t*.8)),18.0);col+=vec3f(.17,.30,.29)*glint*.22*mask*strength*protect;}
 if(P.e4.x>.5){let sun=(uv-P.focus.zw)*vec2f(aspect(),1);let halo=exp(-length(sun)*18.0);let ghost=length((uv-(vec2f(1)-P.focus.zw)) *vec2f(aspect(),1));let ring=max(0.0,1.0-abs(ghost-.065)/.005);col+=vec3f(1.0,.64,.30)*(halo*.14+ring*.025)*strength*protect;}
 if(P.e2.w>.5){let l=lum(col);let teal=vec3f(-.016,.010,.013)*(1.0-l);let warm=vec3f(.030,.013,-.014)*l;col=clamp(col+(teal+warm)*strength,vec3f(0),vec3f(1));
  // Weather tint belongs to the independent grade effect; rain has priority.
  var graded=col;
  if(P.e1.y>.5){graded=col*vec3f(.91,.96,1.01)+vec3f(-.005,.001,.010)*(1.0-l);}
  else if(P.e1.z>.5){graded=col*vec3f(.95,.985,1.045)+vec3f(.009,.014,.020)*(1.0-l);}
  else if(P.e1.x>.5){graded=col*vec3f(1.045,.985,.93)+vec3f(.008,-.004,-.006)*(1.0-l);}
  col=mix(col,graded,min(1.0,strength*.9)*(.7+.3*protect));
 }
 if(P.e3.x>.5){let edge=smoothstep(.22,.74,length((uv-vec2f(.5))*vec2f(1.0,.83)));col*=1.0-edge*.19*strength;}
 if(P.e3.y>.5){let tick=select(floor(t*18.0),0.0,P.control.y>.5);col+=vec3f((hash2(vec2f(id.xy)+vec2f(tick,13.0))-.5)*(.009*strength));}
 textureStore(outputT,vec2i(id.xy),vec4f(clamp(col,vec3f(0),vec3f(1)),1));
}`;
const PRESENT=String.raw`
@group(0) @binding(0) var imageT:texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{var points=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(points[i],0,1);}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f{return textureLoad(imageT,vec2i(p.xy),0);}
`;
const SHADERS=Object.freeze({extract:EXTRACT,blur:BLUR,field:FIELD,composite:COMPOSITE,present:PRESENT});
const EFFECTS=['bloom','shafts','mist','dust','embers','rain','snow','leaves','heat','water','lamps','grade','vignette','grain','sharpen','aberration','flare'];
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Backend{
 constructor(canvas,onLoss){this.canvas=canvas;this.onLoss=onLoss;this.dead=false;this.notified=false;this.resources=[];this.count={frames:0,computePasses:0,particleCount:0,inflight:0,skipped:0,width:0,height:0};this.clock=null;this.uniforms=new Float32Array(168);}
 loss(error){if(this.dead)return;this.dead=true;if(!this.notified){this.notified=true;this.onLoss?.(error instanceof Error?error:Error(String(error)));}}
 async init(){if(!root.navigator?.gpu)throw Error('WebGPU unavailable');const adapter=await root.navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU adapter');const dev=this.device=await adapter.requestDevice();this.limit=dev.limits.maxTextureDimension2D;this.context=this.canvas.getContext('webgpu');if(!this.context)throw Error('WebGPU canvas unavailable');this.format=root.navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:dev,format:this.format,alphaMode:'opaque'});
  dev.lost.then(info=>this.loss(Error('WebGPU device lost: '+info.message)));dev.addEventListener('uncapturederror',event=>this.loss(event.error));
  this.ub=dev.createBuffer({size:this.uniforms.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.sampler=dev.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  dev.pushErrorScope('validation');let scopeError;try{const modules={};for(const [name,code]of Object.entries(SHADERS)){const module=dev.createShaderModule({label:'Nacre VFX '+name,code});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(name+': '+errors.map(m=>m.message+' line'+m.lineNum).join('; '));modules[name]=module;}
   const make=(module,entryPoint='main')=>dev.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint}});this.pipelines={extract:await make(modules.extract),blurH:await make(modules.blur,'blurH'),blurV:await make(modules.blur,'blurV'),field:await make(modules.field),composite:await make(modules.composite)};this.present=await dev.createRenderPipelineAsync({layout:'auto',vertex:{module:modules.present,entryPoint:'vs'},fragment:{module:modules.present,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  }finally{scopeError=await dev.popErrorScope();}if(scopeError)throw Error(scopeError.message);return this;
 }
 texture(w,h,upload=false){const usage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|(upload?GPUTextureUsage.RENDER_ATTACHMENT:GPUTextureUsage.STORAGE_BINDING);const t=this.device.createTexture({size:[w,h],format:'rgba8unorm',usage});this.resources.push(t);return t;}
 group(pipeline,entries){return this.device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:entries.map(([binding,resource])=>({binding,resource}))});}
 ensure(sw,sh,w,h,quality,mw,mh){const divisor=quality==='high'?2:quality==='low'?4:3,bw=Math.max(1,Math.ceil(w/divisor)),bh=Math.max(1,Math.ceil(h/divisor)),key=[sw,sh,w,h,bw,bh,mw,mh].join(':');if(this.key===key)return;
  for(const t of this.resources)t.destroy();this.resources=[];this.key=key;this.sourceT=this.texture(sw,sh,true);this.maskT=this.texture(mw,mh,true);this.zeroT=this.texture(1,1);this.device.queue.writeTexture({texture:this.zeroT},new Uint8Array(4),{bytesPerRow:4},[1,1]);this.bloomA=this.texture(bw,bh);this.bloomB=this.texture(bw,bh);this.fieldT=this.texture(bw,bh);this.outputT=this.texture(w,h);this.bw=bw;this.bh=bh;this.count.width=w;this.count.height=h;
  const u=[0,{buffer:this.ub}],s=[2,this.sampler],T=t=>t.createView(),b=this.pipelines;
  // Auto layouts include only statically used bindings. Extract/blur omit U.
  this.groups={extract:this.group(b.extract,[[1,T(this.sourceT)],s,[3,T(this.bloomA)]]),blurH:this.group(b.blurH,[[1,T(this.bloomA)],s,[3,T(this.bloomB)]]),blurV:this.group(b.blurV,[[1,T(this.bloomB)],s,[3,T(this.bloomA)]]),field:this.group(b.field,[u,[1,T(this.sourceT)],s,[4,T(this.fieldT)]])};
  this.composites=new Map();this.presentGroup=this.group(this.present,[[0,T(this.outputT)]]);
 }
 compositeGroup(bloom,field){const key=Number(bloom)+':'+Number(field);if(!this.composites.has(key))this.composites.set(key,this.group(this.pipelines.composite,[[0,{buffer:this.ub}],[1,this.sourceT.createView()],[2,this.sampler],[3,this.maskT.createView()],[4,(bloom?this.bloomA:this.zeroT).createView()],[5,(field?this.fieldT:this.zeroT).createView()],[6,this.outputT.createView()]]));return this.composites.get(key);}
 render(source,frame={},settings={}){this.count.computePasses=0;if(this.dead)return false;if(this.count.inflight>=2){this.count.skipped++;return false;}try{
  const sw=source.width|0,sh=source.height|0,w=this.canvas.width|0,h=this.canvas.height|0;if(!sw||!sh||!w||!h)return false;if(Math.max(sw,sh,w,h)>this.limit)throw Error('VFX canvas exceeds GPU texture limit');const mask=frame.maskCanvas,mw=mask?.width|0,mh=mask?.height|0;if(Math.max(mw,mh)>this.limit)throw Error('VFX mask exceeds GPU texture limit');const quality=['low','balanced','high'].includes(settings.quality)?settings.quality:'balanced';this.ensure(sw,sh,w,h,quality,mw||1,mh||1);
  const dt=frame.paused?0:clamp(finite(frame.delta),0,.1);if(this.clock===null)this.clock=finite(frame.time);else this.clock+=dt;const strength=clamp(finite(settings.strength,1),0,1.5),reduce=!!settings.reduceMotion,e=settings.effects||{},enabled=Object.fromEntries(EFFECTS.map(name=>[name,e[name]===true&&strength>0]));if(reduce)for(const name of['dust','embers','rain','snow','leaves','heat'])enabled[name]=false;
  const useBloom=enabled.bloom,useField=['shafts','mist','dust','embers','rain','snow','leaves','lamps'].some(name=>enabled[name]),lights=(frame.lights||[]).slice(0,16),u=this.uniforms;u.fill(0);u.set([w,h,reduce?0:this.clock,strength],0);u.set([sw,sh,this.bw,this.bh],4);u.set([clamp(finite(frame.player?.[0],.5),0,1),clamp(finite(frame.player?.[1],.5),0,1),clamp(finite(frame.sun?.[0],.15),-1,2),clamp(finite(frame.sun?.[1],.10),-1,2)],8);u.set([dt,reduce?1:0,['low','balanced','high'].indexOf(quality),lights.length],12);for(let i=0;i<EFFECTS.length;i++)u[16+i]=enabled[EFFECTS[i]]?1:0;u[33]=mw;u[34]=mh;u.set([finite(frame.camera?.[0]),finite(frame.camera?.[1]),0,0],36);
  for(let i=0;i<lights.length;i++){const l=lights[i],at=40+i*8;u.set([clamp(finite(l.x),-1,2),clamp(finite(l.y),-1,2),clamp(finite(l.radius,.05),.001,2),clamp(finite(l.heat),0,1)],at);u.set([clamp(finite(l.color?.[0],1),0,2),clamp(finite(l.color?.[1],.8),0,2),clamp(finite(l.color?.[2],.5),0,2),1],at+4);}
  const dev=this.device;dev.queue.writeBuffer(this.ub,0,u);dev.queue.copyExternalImageToTexture({source,flipY:false},{texture:this.sourceT,premultipliedAlpha:false,colorSpace:'srgb'},[sw,sh]);if(mw&&mh)dev.queue.copyExternalImageToTexture({source:mask,flipY:false},{texture:this.maskT,premultipliedAlpha:false},[mw,mh]);else dev.queue.writeTexture({texture:this.maskT},new Uint8Array(4),{bytesPerRow:4},[1,1]);
  const enc=dev.createCommandEncoder(),dispatch=(name,group,ww,hh)=>{const p=enc.beginComputePass({label:'Nacre '+name});p.setPipeline(this.pipelines[name]);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil(ww/8),Math.ceil(hh/8));p.end();this.count.computePasses++;};if(useBloom){dispatch('extract',this.groups.extract,this.bw,this.bh);dispatch('blurH',this.groups.blurH,this.bw,this.bh);dispatch('blurV',this.groups.blurV,this.bw,this.bh);}if(useField)dispatch('field',this.groups.field,this.bw,this.bh);dispatch('composite',this.compositeGroup(useBloom,useField),w,h);
  const pass=enc.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(this.present);pass.setBindGroup(0,this.presentGroup);pass.draw(3);pass.end();dev.queue.submit([enc.finish()]);this.count.frames++;this.count.inflight++;const q=quality==='low'?.65:quality==='high'?1:.85;this.count.particleCount=Math.round((enabled.dust?126:0)+(enabled.embers?39:0)+(enabled.rain?466:0)+(enabled.snow?155:0)+(enabled.leaves?37:0))*q*q;this.count.particleCount=Math.round(this.count.particleCount);dev.queue.onSubmittedWorkDone().then(()=>{this.count.inflight=Math.max(0,this.count.inflight-1);},error=>{this.count.inflight=Math.max(0,this.count.inflight-1);this.loss(error);});return true;
 }catch(error){this.loss(error);return false;}}
 stats(){return{...this.count};}
 dispose(){if(this.disposed)return;this.disposed=true;this.dead=true;for(const t of this.resources)t.destroy();this.resources=[];this.ub?.destroy();try{this.context?.unconfigure();}catch{}this.device?.destroy();}
}
const api={SHADERS,EFFECTS:Object.freeze(EFFECTS),Backend,async create(canvas,{onLoss}={}){const backend=new Backend(canvas,onLoss);try{return await backend.init();}catch(error){backend.dispose();throw error;}}};
root.NacreVFXBackends||={};root.NacreVFXBackends.webgpu=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
