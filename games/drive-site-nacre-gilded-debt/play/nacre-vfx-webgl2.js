/* Nacre optional visual effects. Canvas gameplay remains authoritative.
 * WebGL2 raster passes and deterministic instanced particles; no compute or simulation.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.NacreVFXBackends=root.NacreVFXBackends||{};root.NacreVFXBackends.webgl2=api;}})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SHADERS=Object.freeze({
fullscreen:`#version 300 es
precision highp float;
precision highp int;
out vec2 v_uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}
`,
extract:`#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
out vec4 outColor;
void main(){vec3 c=(texture(u_source,v_uv+u_texel*vec2(-0.5,-0.5)).rgb+texture(u_source,v_uv+u_texel*vec2(0.5,-0.5)).rgb+texture(u_source,v_uv+u_texel*vec2(-0.5,0.5)).rgb+texture(u_source,v_uv+u_texel*vec2(0.5,0.5)).rgb)*0.25;float l=dot(c,vec3(0.2126,0.7152,0.0722));float knee=smoothstep(0.73,0.91,l);outColor=vec4(c*knee*max(0.0,l-0.70),1.0);}
`,
blur:`#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_step;
out vec4 outColor;
void main(){vec3 c=texture(u_source,v_uv).rgb*0.227027;c+=(texture(u_source,v_uv+u_step*1.384615).rgb+texture(u_source,v_uv-u_step*1.384615).rgb)*0.316216;c+=(texture(u_source,v_uv+u_step*3.230769).rgb+texture(u_source,v_uv-u_step*3.230769).rgb)*0.070270;outColor=vec4(c,1.0);}
`,
composite:`#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_bloom;
uniform sampler2D u_water;
uniform vec2 u_resolution;
uniform vec2 u_sourceSize;
uniform vec2 u_player;
uniform vec2 u_sun;
uniform vec2 u_camera;
uniform float u_time;
uniform float u_strength;
uniform float u_reduce;
uniform vec4 u_fx0; // bloom shafts mist heat
uniform vec4 u_fx1; // water lamps grade vignette
uniform vec4 u_fx2; // grain sharpen aberration flare
uniform vec3 u_weather; // rain snow embers; palette only when grade is enabled
uniform int u_lightCount;
uniform vec4 u_lights[16]; // top-left x y, radius / output height, heat
uniform vec3 u_colors[16];
out vec4 outColor;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float clearZone(vec2 p){return smoothstep(0.055,0.185,length((p-u_player)*vec2(u_resolution.x/u_resolution.y,1.0)));}
vec3 scene(vec2 uv){return texture(u_source,clamp(uv,vec2(0.0),vec2(1.0))).rgb;}
void main(){
 vec2 p=vec2(v_uv.x,1.0-v_uv.y),aspect=vec2(u_resolution.x/u_resolution.y,1.0),texel=1.0/u_sourceSize;
 float s=u_strength,clear=clearZone(p),t=u_time*(1.0-u_reduce);
 vec2 uv=v_uv;
 if(u_fx0.w>0.0&&u_reduce<0.5){float heat=0.0;for(int i=0;i<16;i++){if(i>=u_lightCount)break;vec4 L=u_lights[i];if(L.w<=0.0)continue;vec2 d=(p-L.xy)*aspect;float r=max(L.z,0.004);float shape=(1.0-smoothstep(r*0.25,r,abs(d.x)))*(1.0-smoothstep(0.0,r*2.8,-d.y))*step(d.y,0.0);heat+=shape*L.w*sin(p.y*u_sourceSize.y*0.12+t*2.5+float(i)*1.7);}uv.x+=clamp(heat,-1.0,1.0)*texel.x*0.9*s*clear;}
 vec3 c=scene(uv);
 if(u_fx2.z>0.0){vec2 d=(p-vec2(0.5))*aspect;vec2 shift=normalize(d+vec2(0.0001))*texel*min(0.85,length(d))*s*clear;c.r=scene(uv+shift).r;c.b=scene(uv-shift).b;}
 if(u_fx2.y>0.0){vec3 around=(scene(uv+vec2(texel.x,0))+scene(uv-vec2(texel.x,0))+scene(uv+vec2(0,texel.y))+scene(uv-vec2(0,texel.y)))*0.25;c+=clamp(c-around,vec3(-0.07),vec3(0.07))*0.36*s;}
 if(u_fx1.z>0.0){float l=dot(c,vec3(0.2126,0.7152,0.0722));vec3 graded=(c-0.5)*1.035+0.5;graded+=vec3(0.014,0.003,-0.011)*smoothstep(0.25,0.9,l);graded+=vec3(-0.005,0.003,0.009)*(1.0-smoothstep(0.1,0.5,l));if(u_weather.x>0.5){graded*=vec3(0.91,0.96,1.01);graded+=vec3(-0.005,0.001,0.01)*(1.0-l);}else if(u_weather.y>0.5){graded*=vec3(0.95,0.985,1.045);graded+=vec3(0.009,0.014,0.02)*(1.0-l);}else if(u_weather.z>0.5){graded*=vec3(1.045,0.985,0.93);graded+=vec3(0.008,-0.004,-0.006)*(1.0-l);}c=mix(c,graded,min(1.0,s*0.9)*(0.7+0.3*clear));}
 if(u_fx0.x>0.0)c+=texture(u_bloom,v_uv).rgb*0.42*s;
 if(u_fx1.y>0.0){vec3 glow=vec3(0);for(int i=0;i<16;i++){if(i>=u_lightCount)break;vec4 L=u_lights[i];float d=length((p-L.xy)*aspect)/max(L.z,0.004);float g=exp(-d*d*3.6);glow+=u_colors[i]*g*0.12;}c+=min(glow,vec3(0.15))*s*(0.65+0.35*clear);}
 if(u_fx0.y>0.0){vec2 d=(p-u_sun)*aspect;float angle=atan(d.y,d.x),ray=pow(0.5+0.5*sin(angle*36.0+0.45*sin(angle*13.0)),14.0);float rays=ray*exp(-length(d)*1.35)*smoothstep(-0.08,0.5,p.y-u_sun.y);c+=vec3(1.0,0.84,0.58)*rays*0.09*s*(0.35+0.65*clear);}
 if(u_fx0.z>0.0){float n=noise(p*vec2(4.0,3.0)+u_camera*0.00006+vec2(t*0.008,0));float n2=noise(p*vec2(9.0,6.0)-vec2(t*0.005,0));float density=(0.045+0.17*n*n2)*(0.5+0.5*(1.0-p.y))*s*clear;c=mix(c,vec3(0.66,0.76,0.73),min(0.18,density));}
 if(u_fx1.x>0.0){float mask=smoothstep(0.1,0.7,texture(u_water,v_uv).r);float band=pow(max(0.0,sin(p.y*u_sourceSize.y*0.14+t*1.2+noise(p*20.0)*3.0)),14.0);float sparkle=pow(hash21(floor(p*u_sourceSize*0.22)+floor(t*1.5)),24.0);c+=mask*vec3(0.52,0.79,0.76)*(band*0.035+sparkle*0.04)*s;}
 if(u_fx2.w>0.0){vec2 ds=(p-u_sun)*aspect;float sun=exp(-dot(ds,ds)*100.0)*0.035;vec2 axis=vec2(0.5)-u_sun;float ghosts=0.0;for(int i=1;i<=3;i++){vec2 gp=u_sun+axis*(0.5+float(i)*0.43);float d=length((p-gp)*aspect),rr=0.014+float(i)*0.008;ghosts+=exp(-pow(d/max(rr,0.001),2.0)*3.0)*0.009;}c+=vec3(1.0,0.70,0.38)*min(0.055,sun+ghosts)*s*(0.4+0.6*clear);}
 if(u_fx1.w>0.0){float edge=smoothstep(0.28,0.78,length((p-0.5)*vec2(1.05,0.92)));c*=1.0-edge*0.095*s;}
 if(u_fx2.x>0.0){float tick=u_reduce>0.5?0.0:floor(u_time*10.0);float grain=hash21(floor(p*u_sourceSize)+vec2(tick,17.0))-0.5;c+=grain*(1.5/255.0)*s;}
 outColor=vec4(clamp(c,0.0,1.0),1.0);
}
`,
particleVertex:`#version 300 es
precision highp float;
precision highp int;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_strength;
uniform int u_kind; // dust ember rain snow leaf
out vec2 v_local;
out vec2 v_screen;
flat out float v_seed;
float h(float n){return fract(sin(n*127.1+311.7)*43758.5453123);}
void main(){
 vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));vec2 q=corners[gl_VertexID];
 float id=float(gl_InstanceID)+float(u_kind)*397.0,seed=h(id+3.0),t=u_time;
 vec2 p=vec2(h(id+9.0),h(id+19.0));float size=1.2+seed*1.8;vec2 halfSize=vec2(size);float angle=0.0;
 if(u_kind==0){p=fract(p+vec2(t*(0.006+seed*0.005),-t*0.004));p.x+=sin(t*0.32+seed*30.0)*0.011;halfSize=vec2(0.7+seed*0.8);}
 else if(u_kind==1){p=fract(p+vec2(sin(t*0.4+seed*20.0)*0.025,-t*(0.025+seed*0.025)));halfSize=vec2(0.95+seed*1.25);}
 else if(u_kind==2){p=fract(p+vec2(t*0.055,t*(0.55+seed*0.28)));halfSize=vec2(0.7,10.0+seed*10.0);angle=-0.13;}
 else if(u_kind==3){p=fract(p+vec2(t*0.015+sin(t*0.45+seed*20.0)*0.025,t*(0.035+seed*0.028)));halfSize=vec2(1.4+seed*1.6);}
 else{p=fract(p+vec2(t*0.022+sin(t*0.55+seed*20.0)*0.017,t*(0.026+seed*0.032)));halfSize=vec2(2.1+seed*1.5,1.0+seed);angle=t*(0.5+seed)+seed*6.28;halfSize.x*=0.55+0.45*abs(sin(t+seed*9.0));}
 float ca=cos(angle),sa=sin(angle);vec2 offset=mat2(ca,sa,-sa,ca)*(q*halfSize);v_screen=p+offset/u_resolution;v_local=q;v_seed=seed;gl_Position=vec4(v_screen.x*2.0-1.0,1.0-v_screen.y*2.0,0.0,1.0);
}
`,
particleFragment:`#version 300 es
precision highp float;
precision highp int;
in vec2 v_local;
in vec2 v_screen;
flat in float v_seed;
uniform vec2 u_resolution;
uniform vec2 u_player;
uniform float u_strength;
uniform int u_kind;
out vec4 outColor;
void main(){float dist=length((v_screen-u_player)*vec2(u_resolution.x/u_resolution.y,1.0)),clear=smoothstep(0.055,0.185,dist);float a=1.0-smoothstep(0.18,1.0,length(v_local));vec3 c=vec3(0.88,0.78,0.56);float alpha=0.19;
 if(u_kind==1){c=vec3(1.0,0.59+v_seed*0.17,0.24);alpha=0.58;}
 else if(u_kind==2){a=(1.0-smoothstep(0.1,1.0,abs(v_local.x)))*(1.0-smoothstep(0.72,1.0,abs(v_local.y)));c=vec3(0.64,0.77,0.80);alpha=0.42;}
 else if(u_kind==3){c=vec3(0.90,0.94,0.91);alpha=0.56;}
 else if(u_kind==4){a=1.0-smoothstep(0.65,1.05,abs(v_local.x)+abs(v_local.y)*0.7);c=mix(vec3(0.42,0.52,0.31),vec3(0.68,0.43,0.24),v_seed);alpha=0.56;}
 outColor=vec4(c,a*alpha*min(1.5,u_strength)*clear);
}
`
});
const QUALITIES=Object.freeze({low:{bloomScale:.25,particles:160},balanced:{bloomScale:.4,particles:320},high:{bloomScale:.5,particles:560}});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f=0)=>Number.isFinite(v)?v:f;
function compile(gl,type,source){const sh=gl.createShader(type);if(!sh)throw Error('WebGL2 shader allocation failed');gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const info=gl.getShaderInfoLog(sh)||'Unknown shader error';gl.deleteShader(sh);throw Error('Nacre WebGL2 shader: '+info);}return sh;}
function program(gl,vs,fs){let a=null,b=null,p=null;try{a=compile(gl,gl.VERTEX_SHADER,vs);b=compile(gl,gl.FRAGMENT_SHADER,fs);p=gl.createProgram();if(!p)throw Error('WebGL2 program allocation failed');gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Nacre WebGL2 link: '+gl.getProgramInfoLog(p));return p;}catch(e){if(p)gl.deleteProgram(p);throw e;}finally{if(a)gl.deleteShader(a);if(b)gl.deleteShader(b);}}
class Backend{
 constructor(canvas,onLoss){this.canvas=canvas;this.onLoss=typeof onLoss==='function'?onLoss:()=>{};this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});if(!this.gl)throw Error('WebGL2 is unavailable');this.dead=false;this.disposed=false;this.lossSent=false;this.textures=[];this.programs=[];this.targets=[];this.locations=new Map();this.frames=0;this.skipped=0;this.particleCount=0;this.width=0;this.height=0;this.lastTime=null;this.bloomKey='';this.sourceSize=[0,0];this.maskSize=[0,0];this.handleLoss=e=>{e?.preventDefault?.();this._loss('WebGL2 context lost');};canvas.addEventListener?.('webglcontextlost',this.handleLoss,false);
  try{this._init();}catch(e){this.dispose();throw e;}
 }
 _loss(message){this.dead=true;if(!this.lossSent){this.lossSent=true;this.onLoss(new Error(message));}}
 _init(){const g=this.gl;this.maxTexture=g.getParameter(g.MAX_TEXTURE_SIZE);this.vao=g.createVertexArray();if(!this.vao)throw Error('WebGL2 vertex array allocation failed');g.bindVertexArray(this.vao);this.extract=this._program(SHADERS.fullscreen,SHADERS.extract);this.blur=this._program(SHADERS.fullscreen,SHADERS.blur);this.composite=this._program(SHADERS.fullscreen,SHADERS.composite);this.particles=this._program(SHADERS.particleVertex,SHADERS.particleFragment);this.source=this._texture(g.NEAREST);this.water=this._texture(g.NEAREST);this.black=this._texture(g.LINEAR);g.bindTexture(g.TEXTURE_2D,this.black);g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));g.disable(g.DEPTH_TEST);g.disable(g.CULL_FACE);g.disable(g.SCISSOR_TEST);}
 _program(v,f){const p=program(this.gl,v,f);this.programs.push(p);return p;}
 _texture(filter){const g=this.gl,t=g.createTexture();if(!t)throw Error('WebGL2 texture allocation failed');this.textures.push(t);g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;}
 _uniform(p,name){let map=this.locations.get(p);if(!map){map=new Map();this.locations.set(p,map);}if(!map.has(name))map.set(name,this.gl.getUniformLocation(p,name));return map.get(name);}
 _f(p,k,v){this.gl.uniform1f(this._uniform(p,k),v);}
 _i(p,k,v){this.gl.uniform1i(this._uniform(p,k),v);}
 _v2(p,k,a,b){this.gl.uniform2f(this._uniform(p,k),a,b);}
 _v4(p,k,a){this.gl.uniform4fv(this._uniform(p,k),a);}
 _bind(p,name,texture,unit){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);this._i(p,name,unit);}
 _clearTargets(){const g=this.gl;for(const t of this.targets){g.deleteFramebuffer(t.fbo);g.deleteTexture(t.texture);const i=this.textures.indexOf(t.texture);if(i>=0)this.textures.splice(i,1);}this.targets=[];this.bloomKey='';}
 _resize(w,h,q){const g=this.gl,bw=Math.max(1,Math.ceil(w*q.bloomScale)),bh=Math.max(1,Math.ceil(h*q.bloomScale)),key=bw+':'+bh;if(key===this.bloomKey)return;this._clearTargets();try{for(let i=0;i<2;i++){const texture=this._texture(g.LINEAR),fbo=g.createFramebuffer();if(!fbo)throw Error('WebGL2 framebuffer allocation failed');const item={texture,fbo,w:bw,h:bh};this.targets.push(item);g.bindTexture(g.TEXTURE_2D,texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,bw,bh,0,g.RGBA,g.UNSIGNED_BYTE,null);g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Nacre WebGL2 framebuffer is incomplete');}this.bloomKey=key;}catch(e){this._clearTargets();throw e;}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);}}
 _upload(texture,canvas,size){const g=this.gl,w=canvas.width|0,h=canvas.height|0;if(w<1||h<1||w>this.maxTexture||h>this.maxTexture)throw Error('Nacre WebGL2 source dimensions exceed texture limits');g.bindTexture(g.TEXTURE_2D,texture);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);if(g.UNPACK_COLORSPACE_CONVERSION_WEBGL!==undefined)g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL,g.NONE);if(size[0]!==w||size[1]!==h){g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);size[0]=w;size[1]=h;}else g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,canvas);}
 _pass(p,target){const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,target?target.fbo:null);g.viewport(0,0,target?target.w:this.width,target?target.h:this.height);g.useProgram(p);}
 render(source,frame={},settings={}){
  if(this.disposed||this.dead){this.skipped++;return false;}const g=this.gl;if(g.isContextLost()){this._loss('WebGL2 context lost');this.skipped++;return false;}
  const w=this.canvas.width|0,h=this.canvas.height|0;if(!source||w<1||h<1||source.width<1||source.height<1){this.skipped++;return false;}if(w>this.maxTexture||h>this.maxTexture)throw Error('Nacre WebGL2 output dimensions exceed texture limits');
  this.width=w;this.height=h;const q=QUALITIES[settings.quality]||QUALITIES.balanced,e=settings.effects||{},strength=clamp(num(settings.strength,1),0,1.5),reduce=!!settings.reduceMotion;
  const supplied=Math.max(0,num(frame.time,0)),time=frame.paused&&this.lastTime!==null?this.lastTime:supplied;this.lastTime=time;
  const player=Array.isArray(frame.player)?frame.player:[.5,.5],sun=Array.isArray(frame.sun)?frame.sun:[.15,.10],camera=Array.isArray(frame.camera)?frame.camera:[0,0],on=k=>e[k]===true?1:0;
  g.bindVertexArray(this.vao);g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.SCISSOR_TEST);g.activeTexture(g.TEXTURE0);this._upload(this.source,source,this.sourceSize);
  let water=this.black;if(e.water&&frame.maskCanvas){g.activeTexture(g.TEXTURE2);this._upload(this.water,frame.maskCanvas,this.maskSize);water=this.water;}
  let bloom=this.black;if(e.bloom&&strength>0){this._resize(w,h,q);const [a,b]=this.targets;this._pass(this.extract,a);this._bind(this.extract,'u_source',this.source,0);this._v2(this.extract,'u_texel',1/this.sourceSize[0],1/this.sourceSize[1]);g.drawArrays(g.TRIANGLES,0,3);this._pass(this.blur,b);this._bind(this.blur,'u_source',a.texture,0);this._v2(this.blur,'u_step',1/a.w,0);g.drawArrays(g.TRIANGLES,0,3);this._pass(this.blur,a);this._bind(this.blur,'u_source',b.texture,0);this._v2(this.blur,'u_step',0,1/a.h);g.drawArrays(g.TRIANGLES,0,3);bloom=a.texture;}
  const p=this.composite;this._pass(p,null);this._bind(p,'u_source',this.source,0);this._bind(p,'u_bloom',bloom,1);this._bind(p,'u_water',water,2);this._v2(p,'u_resolution',w,h);this._v2(p,'u_sourceSize',...this.sourceSize);this._v2(p,'u_player',num(player[0],.5),num(player[1],.5));this._v2(p,'u_sun',num(sun[0],.15),num(sun[1],.10));this._v2(p,'u_camera',num(camera[0]),num(camera[1]));this._f(p,'u_time',time%4096);this._f(p,'u_strength',strength);this._f(p,'u_reduce',reduce?1:0);this._v4(p,'u_fx0',[on('bloom'),on('shafts'),on('mist'),on('heat')]);this._v4(p,'u_fx1',[on('water'),on('lamps'),on('grade'),on('vignette')]);this._v4(p,'u_fx2',[on('grain'),on('sharpen'),on('aberration'),on('flare')]);g.uniform3fv(this._uniform(p,'u_weather'),[on('rain'),on('snow'),on('embers')]);
  const lights=Array.isArray(frame.lights)?frame.lights.slice(0,16):[],lp=new Float32Array(64),lc=new Float32Array(48);for(let i=0;i<lights.length;i++){const l=lights[i]||{},c=l.color||[1,.75,.4];lp.set([num(l.x),num(l.y),clamp(num(l.radius,.04),.001,2),clamp(num(l.heat),0,1)],i*4);lc.set([clamp(num(c[0],1),0,1),clamp(num(c[1],.75),0,1),clamp(num(c[2],.4),0,1)],i*3);}this._i(p,'u_lightCount',lights.length);g.uniform4fv(this._uniform(p,'u_lights[0]'),lp);g.uniform3fv(this._uniform(p,'u_colors[0]'),lc);g.drawArrays(g.TRIANGLES,0,3);
  const weather=['dust','embers','rain','snow','leaves'],enabled=weather.map((k,i)=>e[k]?i:-1).filter(i=>i>=0);this.particleCount=0;if(!reduce&&strength>0&&enabled.length){const pp=this.particles;g.useProgram(pp);this._v2(pp,'u_resolution',w,h);this._v2(pp,'u_player',num(player[0],.5),num(player[1],.5));this._f(pp,'u_time',time%4096);this._f(pp,'u_strength',strength);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);const count=Math.floor(q.particles/enabled.length);for(const kind of enabled){this._i(pp,'u_kind',kind);g.drawArraysInstanced(g.TRIANGLES,0,6,count);this.particleCount+=count;}g.disable(g.BLEND);}
  this.frames++;return true;
 }
 stats(){return{frames:this.frames,computePasses:0,particleCount:this.particleCount,inflight:0,skipped:this.skipped,width:this.width,height:this.height};}
 dispose(){if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener?.('webglcontextlost',this.handleLoss,false);const g=this.gl;this._clearTargets();for(const p of this.programs)g.deleteProgram(p);for(const t of this.textures)g.deleteTexture(t);if(this.vao)g.deleteVertexArray(this.vao);this.programs=[];this.textures=[];this.locations.clear();this.particleCount=0;}
}
return{async create(canvas,options={}){if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('Nacre WebGL2 needs an output canvas');return new Backend(canvas,options.onLoss);},SHADERS,QUALITIES};
});
