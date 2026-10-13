/* Foldlight paper compositor. WebGPU -> WebGL2 -> Canvas 2D.
 * Both GPU paths use a 320 x 180 bright pass, two blur passes, and a final pass.
 * Game and UI remain independent. All shader coordinates use a top-left origin.
 */
(function(root){
'use strict';
const W=1280,H=720,BW=320,BH=180;
const wgsl=`
struct Params { frame:vec4f, style:vec4f, effects:vec4f, light:vec4f, impact:vec4f, water:vec4f, mood:vec4f, flags:vec4f };
@group(0) @binding(0) var scene:texture_2d<f32>;
@group(0) @binding(1) var bloom:texture_2d<f32>;
@group(0) @binding(2) var samp:sampler;
@group(0) @binding(3) var<uniform> p:Params;
struct V { @builtin(position) pos:vec4f, @location(0) uv:vec2f };
@vertex fn vs(@builtin(vertex_index) i:u32)->V {
 var points=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
 var v:V;v.pos=vec4f(points[i],0,1);v.uv=vec2f((points[i].x+1)*.5,1-(points[i].y+1)*.5);return v;
}
fn lum(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
fn sampleAt(uv:vec2f)->vec3f{return textureSampleLevel(scene,samp,clamp(uv,vec2f(0),vec2f(1)),0).rgb;}
fn blurAt(uv:vec2f,d:vec2f)->vec4f{
 var c=sampleAt(uv)*.227027;
 c+=(sampleAt(uv+d*1.384615)+sampleAt(uv-d*1.384615))*.316216;
 c+=(sampleAt(uv+d*3.230769)+sampleAt(uv-d*3.230769))*.070270;
 return vec4f(c,1);
}
@fragment fn bright(v:V)->@location(0) vec4f{let c=sampleAt(v.uv);return vec4f(c*smoothstep(.55,.92,lum(c)),1);}
@fragment fn blurH(v:V)->@location(0) vec4f{return blurAt(v.uv,vec2f(1.5/320.,0));}
@fragment fn blurV(v:V)->@location(0) vec4f{return blurAt(v.uv,vec2f(0,1.5/180.));}
fn shade(uv:vec2f,ef:f32,water:f32)->vec3f {
 var color=sampleAt(uv);let lit=textureSampleLevel(bloom,samp,clamp(uv,vec2f(0),vec2f(1)),0).rgb;
 color+=lit*p.effects.y*.85*ef;
 let ld=vec2f((uv.x-p.light.x)*1.777778,uv.y-p.light.y);
 let pool=exp(-dot(ld,ld)*32.)*(.65+p.light.z*.85)*p.effects.z*ef;
 color+=vec3f(.16,.105,.035)*pool;let l=lum(color);let warm=p.mood.w*.035;
 let grade=mix(vec3f(l),color,1.07)+vec3f(warm,.008,-.004)*(1-l)+vec3f(-.012,.01,.018)*(1-l)*(1-p.mood.z*.5);
 return mix(color,grade,ef*.75)+vec3f(.05,.10,.09)*water*.08*ef;
}
@fragment fn composite(v:V)->@location(0) vec4f {
 let ef=p.effects.x*(1-p.flags.x);let tm=p.frame.z;var uv=v.uv;let pixel=p.frame.w>1.5;
 let delta=vec2f((uv.x-p.impact.x)*1.777778,uv.y-p.impact.y);let dist=length(delta);let age=p.impact.z;
 if(ef>0 && p.mood.y>0 && age>=0 && age<.48){
  let rd=(dist-age*1.15)/.026;let ring=exp(-rd*rd)*(1-age/.48)*p.impact.w;
  uv+=delta/max(dist,.001)*vec2f(.0015,.0027)*ring*ef;
 }
 let water=smoothstep(p.water.x,p.water.x+.02,uv.x)*(1-smoothstep(p.water.y-.02,p.water.y,uv.x))*smoothstep(p.water.z,p.water.z+.012,uv.y)*(1-smoothstep(p.water.w-.012,p.water.w,uv.y));
 uv.x+=sin(uv.y*215.+tm*2.4)*.0007*water*ef*p.mood.y;
 let cleanUV=uv;if(pixel&&p.style.w>0){let grid=p.frame.xy/max(1.,p.style.x);uv=(floor(uv*grid)+vec2f(.5))/grid;}
 let original=sampleAt(v.uv);var color=shade(uv,ef,water);var base=color;
 if(pixel){base=shade(cleanUV,ef,water);}
 if(p.frame.w>.5){
  let cell=floor(uv*p.frame.xy/max(1.,p.style.x));let checker=fract((cell.x+cell.y)*.5)*2.-.5;
  let noise=select(0.,checker*.045*p.flags.w,pixel);
  color=floor(clamp(color+vec3f(noise),vec3f(0),vec3f(1))*p.style.y+vec3f(.5))/p.style.y;
  if(p.frame.w<1.5||p.frame.w>2.5){
   let d=vec2f(max(1.,p.style.x*.5))/p.frame.xy;
   let gx=lum(sampleAt(uv+vec2f(d.x,0)))-lum(sampleAt(uv-vec2f(d.x,0)));
   let gy=lum(sampleAt(uv+vec2f(0,d.y)))-lum(sampleAt(uv-vec2f(0,d.y)));
   let edge=smoothstep(.05,.23,length(vec2f(gx,gy)))*p.style.z;
   color=mix(color,vec3f(.035,.105,.13),clamp(edge,0.,.9));
  }
  color=mix(base,color,p.style.w);
 }
 let edge=dot((v.uv-vec2f(.5))*vec2f(1.05,1.2),(v.uv-vec2f(.5))*vec2f(1.05,1.2));
 color*=1-smoothstep(.10,.59,edge)*p.effects.w*.42*ef;
 let grain=fract(sin(dot(floor(uv*p.frame.xy),vec2f(12.9898,78.233)))*43758.5453)-.5;
 color+=vec3f(grain*p.mood.x*.025*ef);
 if(p.frame.w<.5 && ef<=0){color=original;}
 return vec4f(clamp(color,vec3f(0),vec3f(1)),1);
}`;
const glVertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 pts[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));vec2 p=pts[gl_VertexID];gl_Position=vec4(p,0.,1.);uv=vec2((p.x+1.)*.5,1.-(p.y+1.)*.5);}`;
const glHeader=`#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
out vec4 outColor;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform vec4 frame,style,effects,light,impact,water,mood,flags;
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 sampleAt(vec2 q){return texture(scene,clamp(q,vec2(0.),vec2(1.))).rgb;}
// Canvas upload is top-left. GL framebuffer textures need the inverse Y lookup.
vec3 fbAt(vec2 q){return texture(scene,clamp(vec2(q.x,1.-q.y),vec2(0.),vec2(1.))).rgb;}
`;
const glBright=glHeader+`void main(){vec3 c=sampleAt(uv);outColor=vec4(c*smoothstep(.55,.92,lum(c)),1.);}`;
const glBlur=axis=>glHeader+`void main(){vec2 d=${axis==='x'?'vec2(1.5/320.,0.)':'vec2(0.,1.5/180.)'};vec3 c=fbAt(uv)*.227027;c+=(fbAt(uv+d*1.384615)+fbAt(uv-d*1.384615))*.316216;c+=(fbAt(uv+d*3.230769)+fbAt(uv-d*3.230769))*.070270;outColor=vec4(c,1.);}`;
const glComposite=glHeader+`vec3 shade(vec2 q,float ef,float wm){
 vec3 color=sampleAt(q);color+=texture(bloom,clamp(vec2(q.x,1.-q.y),vec2(0.),vec2(1.))).rgb*effects.y*.85*ef;
 vec2 ld=vec2((q.x-light.x)*1.777778,q.y-light.y);float pool=exp(-dot(ld,ld)*32.)*(.65+light.z*.85)*effects.z*ef;color+=vec3(.16,.105,.035)*pool;
 float l=lum(color),warm=mood.w*.035;vec3 grade=mix(vec3(l),color,1.07)+vec3(warm,.008,-.004)*(1.-l)+vec3(-.012,.01,.018)*(1.-l)*(1.-mood.z*.5);
 return mix(color,grade,ef*.75)+vec3(.05,.10,.09)*wm*.08*ef;
}
void main(){
 float ef=effects.x*(1.-flags.x),tm=frame.z;vec2 q=uv;bool pixel=frame.w>1.5;
 vec2 delta=vec2((q.x-impact.x)*1.777778,q.y-impact.y);float dist=length(delta),age=impact.z;
 if(ef>0.&&mood.y>0.&&age>=0.&&age<.48){float rd=(dist-age*1.15)/.026;float ring=exp(-rd*rd)*(1.-age/.48)*impact.w;q+=delta/max(dist,.001)*vec2(.0015,.0027)*ring*ef;}
 float wm=smoothstep(water.x,water.x+.02,q.x)*(1.-smoothstep(water.y-.02,water.y,q.x))*smoothstep(water.z,water.z+.012,q.y)*(1.-smoothstep(water.w-.012,water.w,q.y));
 q.x+=sin(q.y*215.+tm*2.4)*.0007*wm*ef*mood.y;
 vec2 cleanUV=q;if(pixel&&style.w>0.){vec2 grid=frame.xy/max(1.,style.x);q=(floor(q*grid)+.5)/grid;}
 vec3 original=sampleAt(uv),color=shade(q,ef,wm),base=color;if(pixel)base=shade(cleanUV,ef,wm);
 if(frame.w>.5){vec2 cell=floor(q*frame.xy/max(1.,style.x));float checker=fract((cell.x+cell.y)*.5)*2.-.5;float noise=pixel?checker*.045*flags.w:0.;color=floor(clamp(color+noise,vec3(0.),vec3(1.))*style.y+.5)/style.y;
  if(frame.w<1.5||frame.w>2.5){vec2 d=vec2(max(1.,style.x*.5))/frame.xy;float gx=lum(sampleAt(q+vec2(d.x,0.)))-lum(sampleAt(q-vec2(d.x,0.)));float gy=lum(sampleAt(q+vec2(0.,d.y)))-lum(sampleAt(q-vec2(0.,d.y)));float edge=smoothstep(.05,.23,length(vec2(gx,gy)))*style.z;color=mix(color,vec3(.035,.105,.13),clamp(edge,0.,.9));}color=mix(base,color,style.w);
 }
 float edge=dot((uv-.5)*vec2(1.05,1.2),(uv-.5)*vec2(1.05,1.2));color*=1.-smoothstep(.10,.59,edge)*effects.w*.42*ef;
 float grain=fract(sin(dot(floor(q*frame.xy),vec2(12.9898,78.233)))*43758.5453)-.5;color+=grain*mood.x*.025*ef;
 if(frame.w<.5&&ef<=0.)color=original;outColor=vec4(clamp(color,vec3(0.),vec3(1.)),1.);
}`;
class PaperFilter{
 constructor(game,canvas,onStatus){this.game=game;this.canvas=canvas;this.onStatus=onStatus||(()=>{});this.settings={filter:'none',pixel:4,levels:6,outline:1,strength:1,dither:.6,effects:true,effectsStrength:.85,bloom:.5,light:.65,vignette:.45,grain:.2,renderer:'auto',motion:false};this.scene={};this.backend='off';this.last=0;this.frame=0;this.generation=0;this.lastError='';this.params=new Float32Array(32);this.passes=0;}
 status(text){this.description=text;this.onStatus(text);}
 active(){const p=this.settings;return (p.effects&&p.effectsStrength>0)||(p.filter!=='none'&&p.strength>0);}
 async set(options){Object.assign(this.settings,options);const choice=this.settings.renderer||'auto';
  if(this.choice!==choice){this.choice=choice;this.generation++;this.release();this.initPromise=null;}
  if(!this.active()){this.canvas.style.display='none';this.status('Original paper art. Scene effects and paper styles are off.');return;}
  if(!this.device&&!this.gl&&!this.soft){if(!this.initPromise)this.initPromise=this.init(this.generation,choice);await this.initPromise;}
  if(!this.active())return;this.canvas.style.display='block';this.describe();this.last=0;
 }
 describe(){this.status(this.backend==='webgpu'?'WebGPU · light bloom, paper grain, and scene effects.':this.backend==='webgl2'?'WebGL2 · light bloom, paper grain, and scene effects.':this.backend==='canvas2d'?'Canvas 2D · simple lighting and paper styles.':'Preparing the picture…');}
 freshCanvas(){const c=document.createElement('canvas');c.id='filter-screen';c.setAttribute('aria-hidden','true');return c;}
 attach(c){this.canvas.replaceWith(c);this.canvas=c;c.style.display=this.active()?'block':'none';}
 release(){const device=this.device;this.device=null;if(device)device.destroy();if(this.gl){const gl=this.gl;this.gl=null;for(const p of this.programs||[])gl.deleteProgram(p.program);for(const x of this.glTextures||[])gl.deleteTexture(x);for(const x of this.fbos||[])gl.deleteFramebuffer(x);if(this.vao)gl.deleteVertexArray(this.vao);}this.soft=null;this.backend='off';this.passes=0;this.firstDrawValidated=false;this.firstDrawPending=false;}
 async init(generation,choice){this.status('Preparing the picture…');
  if(choice==='auto'||choice==='webgpu')try{await this.initGPU(generation);if(generation===this.generation)return;}catch(e){if(generation!==this.generation)return;this.lastError=e.message;}
  if(generation!==this.generation)return;
  if(choice!=='canvas2d')try{this.initGL(generation);return;}catch(e){this.lastError=e.message;}
  if(generation===this.generation)this.fallback();
 }
 async initGPU(generation){
  if(!navigator.gpu)throw Error('WebGPU API unavailable');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter');const device=await adapter.requestDevice();
  try{
   if(generation!==this.generation){device.destroy();return;}
   const canvas=this.freshCanvas(),context=canvas.getContext('webgpu');if(!context)throw Error('No WebGPU canvas');const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
   device.pushErrorScope('validation');const module=device.createShaderModule({code:wgsl});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(m=>m.message).join('; '));
   const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
   const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});const entries=['bright','blurH','blurV','composite'];const pipelines=await Promise.all(entries.map((entryPoint,i)=>device.createRenderPipelineAsync({layout:pipelineLayout,vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint,targets:[{format:i===3?format:'rgba8unorm'}]},primitive:{topology:'triangle-list'}})));
   const make=(w,h)=>device.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});const texture=make(W,H),a=make(BW,BH),b=make(BW,BH),uniform=device.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});
   const bind=(src,bloomTex)=>device.createBindGroup({layout,entries:[{binding:0,resource:src.createView()},{binding:1,resource:bloomTex.createView()},{binding:2,resource:sampler},{binding:3,resource:{buffer:uniform}}]});
   const binds=[bind(texture,b),bind(a,texture),bind(b,texture),bind(texture,a)];const err=await device.popErrorScope();if(err)throw Error(err.message);if(generation!==this.generation){device.destroy();return;}
   Object.assign(this,{device,context,format,texture,uniform,pipelines,binds,bloomTextures:[a,b],backend:'webgpu',passes:4,lastError:''});this.attach(canvas);
   device.addEventListener('uncapturederror',e=>{e.preventDefault();if(this.device===device)this.failed(e.error.message,'webgl2');});device.lost.then(info=>{if(this.device===device)this.failed(info.message,'webgl2');});this.describe();
  }catch(e){device.destroy();throw e;}
 }
 initGL(generation){
  const canvas=this.freshCanvas(),gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:false});if(!gl)throw Error('WebGL2 unavailable');
  try{
  const compile=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(message);}return s;};
  const vs=compile(gl.VERTEX_SHADER,glVertex);const names=['frame','style','effects','light','impact','water','mood','flags'];
  const programs=[glBright,glBlur('x'),glBlur('y'),glComposite].map(code=>{const fs=compile(gl.FRAGMENT_SHADER,code),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'scene'),0);gl.uniform1i(gl.getUniformLocation(program,'bloom'),1);return{program,loc:names.map(n=>gl.getUniformLocation(program,n))};});gl.deleteShader(vs);
  const make=(w,h)=>{const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tx;};
  const source=make(W,H),a=make(BW,BH),b=make(BW,BH),fbos=[a,b].map(tx=>{const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tx,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Bloom framebuffer is incomplete');return f;});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL2 setup failed');Object.assign(this,{gl,programs,glTextures:[source,a,b],fbos,vao,backend:'webgl2',passes:4,lastError:''});this.attach(canvas);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(this.gl===gl&&generation===this.generation)this.failed('WebGL2 context lost','canvas2d');});this.describe();
  }catch(error){gl.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
 }
 failed(message,next){this.lastError=message;this.generation++;this.release();this.initPromise=this.init(this.generation,next);this.initPromise.then(()=>{this.canvas.style.display=this.active()?'block':'none';this.describe();});}
 fallback(){const canvas=this.freshCanvas();this.soft=canvas.getContext('2d');this.work=document.createElement('canvas');this.workCtx=this.work.getContext('2d',{willReadFrequently:true});this.backend='canvas2d';this.passes=1;this.attach(canvas);this.describe();}
 values(){const p=this.settings,s=this.scene||{},mode=p.filter==='none'?0:p.filter==='cel'?1:p.filter==='pixel'?2:3;this.params.set([W,H,s.time||0,mode,p.pixel,p.levels,p.outline,p.strength,p.effects?p.effectsStrength:0,p.bloom,p.light,p.vignette,(s.lightX??432)/W,(s.lightY??421)/H,s.cast||0,s.room||0,(s.impactX??640)/W,(s.impactY??450)/H,s.impactAge??2,s.impactStrength||0,(s.waterX0??-1280)/W,(s.waterX1??-640)/W,(s.waterY0??605)/H,(s.waterY1??651)/H,p.grain,p.motion?0:1,s.battle?1:0,s.complete?1:0,s.fade||0,s.charge||0,0,p.dither]);return this.params;}
 present(){if(!this.active()||(!this.device&&!this.gl&&!this.soft))return;const screen=this.game.screen,ratio=Math.min(1,1920/screen.canvas.width,1080/screen.canvas.height),width=Math.round(screen.canvas.width*ratio),height=Math.round(screen.canvas.height*ratio);if(width<1||height<1)return;if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}this.renderSize=[width,height];const x=Math.max(0,Math.round(screen.OX*ratio)),y=Math.max(0,Math.round(screen.OY*ratio)),w=Math.min(width-x,Math.round(W*screen.S*ratio)),h=Math.min(height-y,Math.round(H*screen.S*ratio)),data=this.values();
  if(this.device)try{
   const device=this.device;device.queue.copyExternalImageToTexture({source:screen.buf},{texture:this.texture},{width:W,height:H});device.queue.writeBuffer(this.uniform,0,data);const validate=!this.firstDrawValidated&&!this.firstDrawPending;if(validate){device.pushErrorScope('validation');this.firstDrawPending=true;}const encoder=device.createCommandEncoder(),dest=[this.bloomTextures[0],this.bloomTextures[1],this.bloomTextures[0],this.context.getCurrentTexture()];
   for(let i=0;i<4;i++){const pass=encoder.beginRenderPass({colorAttachments:[{view:dest[i].createView(),clearValue:{r:.02,g:.06,b:.085,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(this.pipelines[i]);pass.setBindGroup(0,this.binds[i]);if(i===3)pass.setViewport(x,y,w,h,0,1);pass.draw(3);pass.end();}device.queue.submit([encoder.finish()]);this.frame++;if(validate)device.popErrorScope().then(error=>{if(this.device!==device)return;this.firstDrawPending=false;if(error)this.failed(error.message,'webgl2');else this.firstDrawValidated=true;});
  }catch(e){this.failed(e.message,'webgl2');}
  else if(this.gl)try{
   const gl=this.gl,[source,a,b]=this.glTextures;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,screen.buf);gl.bindVertexArray(this.vao);
   const sources=[source,a,b,source],targets=[this.fbos[0],this.fbos[1],this.fbos[0],null];for(let i=0;i<4;i++){const pr=this.programs[i];gl.bindFramebuffer(gl.FRAMEBUFFER,targets[i]);gl.viewport(i===3?x:0,i===3?height-y-h:0,i===3?w:BW,i===3?h:BH);if(i===3){gl.clearColor(.02,.06,.085,1);gl.clear(gl.COLOR_BUFFER_BIT);}gl.useProgram(pr.program);for(let j=0;j<8;j++)gl.uniform4fv(pr.loc[j],data.subarray(j*4,j*4+4));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sources[i]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,i===3?a:source);gl.drawArrays(gl.TRIANGLES,0,3);}
   if(!this.firstDrawValidated){const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('WebGL2 first draw failed: '+error);this.firstDrawValidated=true;}this.frame++;
  }catch(e){this.failed(e.message,'canvas2d');}
  else this.present2D(screen,x,y,w,h,data);
 }
 present2D(screen,x,y,w,h,data){const now=performance.now();if(now-this.last<33)return;this.last=now;const p=this.settings,out=this.soft,mode=data[3],isPixel=mode>1;out.globalAlpha=1;out.fillStyle='#081b24';out.fillRect(0,0,this.canvas.width,this.canvas.height);out.imageSmoothingEnabled=true;out.drawImage(screen.buf,0,0,W,H,x,y,w,h);
  if(mode&&p.strength>0){const px=isPixel?Math.max(2,p.pixel):2,ww=Math.floor(W/px),hh=Math.floor(H/px);if(this.work.width!==ww||this.work.height!==hh){this.work.width=ww;this.work.height=hh;}const c=this.workCtx;c.imageSmoothingEnabled=!isPixel;c.drawImage(screen.buf,0,0,W,H,0,0,ww,hh);const im=c.getImageData(0,0,ww,hh),d=im.data,lum=(mode!==2&&p.outline>0)?new Float32Array(ww*hh):null;if(lum)for(let i=0,k=0;i<d.length;i+=4,k++)lum[k]=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;for(let i=0,k=0;i<d.length;i+=4,k++){const xx=k%ww,yy=(k/ww)|0,noise=isPixel?(((xx+yy)%2)-.5)*11*p.dither:0;let edge=0;if(lum&&xx>0&&xx<ww-1&&yy>0&&yy<hh-1)edge=Math.min(.9,Math.max(0,(Math.abs(lum[k+1]-lum[k-1])+Math.abs(lum[k+ww]-lum[k-ww])-20)/90)*p.outline);for(let j=0;j<3;j++){const quant=Math.round(Math.max(0,Math.min(255,d[i+j]+noise))*p.levels/255)*255/p.levels;d[i+j]=quant*(1-edge)+[9,27,33][j]*edge;}}c.putImageData(im,0,0);out.globalAlpha=p.strength;out.imageSmoothingEnabled=!isPixel;out.drawImage(this.work,x,y,w,h);out.globalAlpha=1;}
  if(p.effects&&p.effectsStrength>0){out.save();out.beginPath();out.rect(x,y,w,h);out.clip();const lx=x+data[12]*w,ly=y+data[13]*h,ef=p.effectsStrength*(1-data[28]);let grad=out.createRadialGradient(lx,ly,0,lx,ly,w*.17);grad.addColorStop(0,'#ffd486');grad.addColorStop(1,'#ffd48600');out.globalCompositeOperation='screen';out.globalAlpha=.12*p.light*ef;out.fillStyle=grad;out.fillRect(x,y,w,h);out.globalCompositeOperation='source-over';out.globalAlpha=p.vignette*.24*ef;grad=out.createRadialGradient(x+w*.5,y+h*.5,w*.2,x+w*.5,y+h*.5,w*.7);grad.addColorStop(0,'#071b2600');grad.addColorStop(1,'#071b26');out.fillStyle=grad;out.fillRect(x,y,w,h);out.restore();}this.frame++;this.firstDrawValidated=true;
 }
}
root.FoldlightFilter=PaperFilter;
})(window);
