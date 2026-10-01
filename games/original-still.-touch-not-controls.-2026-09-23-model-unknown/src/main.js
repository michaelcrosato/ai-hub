/**
 * still. — touch, not controls.
 * A full-screen collection of touch, water, texture and sound exhibits.
 *
 * Runs on the shared 3D kit: three.js r186 WebGPURenderer (WebGL2 fallback)
 * started by kit/boot.js; src/render.js draws the material batches with TSL.
 * Input: pointer and touch work the material directly (multi-touch, pen
 * pressure). Keyboard and gamepad go through kit.input actions: a virtual
 * finger, exhibit navigation, camera views and the game's own menus.
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createStillRenderer, MATERIAL_KINDS } from './render.js';

// The material shaders do their own tone curve and display gamma; colours stay raw.
THREE.ColorManagement.enabled = false;

const kit = await boot({
  title: 'still.',
  mount: document.getElementById('render'),
  gear: 'none', // the game's Settings sheet opens the kit's graphics panel
  touch: false, // touch plays on the material itself; the menus are the game's own
  accent: '#d8edb5',
  background: '#162729',
  input: {
    // A virtual finger for keyboard and gamepad players: move it, press to touch.
    hand: { type: 'vector', keys: 'wasd', gamepad: 'leftStick' },
    press: { keys: ['Space', 'Enter', 'KeyJ'], gamepad: ['A', 'RT'] },
    // Menu navigation (the game's own sheets) and the camera.
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    orbit: { type: 'look', mouse: 'locked', gamepad: 'rightStick' },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    watch: { keys: ['KeyH'], gamepad: ['X'] },
    reset: { keys: ['KeyR'], gamepad: ['Y'] },
    prev: { keys: ['ArrowLeft', 'KeyQ'], gamepad: ['LB', 'Left'] },
    next: { keys: ['ArrowRight', 'KeyE'], gamepad: ['RB', 'Right'] },
    color: { keys: ['KeyC'], gamepad: ['Up'] },
    tool: { keys: ['KeyT'], gamepad: ['Down'] },
    view: { keys: ['KeyV'], gamepad: ['Back'] },
    sound: { keys: ['KeyM'], gamepad: ['RS'] },
    full: { keys: ['KeyF'] },
    menu: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  },
});
const input = kit.input;
kit.loading.progress(0.7, 'Shaping the materials…');
// Thumbnails for the exhibit library live next to the game (thumbs/<scene>.jpg).
const THUMBNAILS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);

/* Shared mesh data: every exhibit is drawn from these geometries as instance batches. */
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a)||1;return a.map(x=>x/l)}};
// Linear colour from hex. Scenes ask for the same few colours every frame, so they are parsed once.
const COLOR_CACHE=new Map();
function color(h){if(Array.isArray(h))return h;let c=COLOR_CACHE.get(h);if(!c){const n=parseInt((/#([0-9a-f]{6})/i.exec(h)||[0,'808080'])[1],16);c=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(v=>Math.pow(v,2.2));COLOR_CACHE.set(h,c);}return c;}
function quat(x=0,y=0,z=0){const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);return[sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz]}
function mul4(a,b){let c=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[i*4+j]+=a[k*4+j]*b[i*4+k];return c}
function cameraAt(eye,target,w,h){let back=V.norm(V.sub(eye,target)),right=V.norm(V.cross([0,1,0],back)),up=V.cross(back,right);let view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-V.dot(right,eye),-V.dot(up,eye),-V.dot(back,eye),1]);let near=.1,far=80;let projection=new Float32Array([2/w,0,0,0,0,2/h,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1]);return{eye,target,right,up,back,width:w,height:h,vp:mul4(projection,view)}}
let GEO_ID=0;
function geometry(p,n,u,i){return{id:++GEO_ID,p:new Float32Array(p),n:new Float32Array(n),u:new Float32Array(u),i:new Uint32Array(i)}}
function plane(w=8,d=6,nx=1,nz=1){let p=[],n=[],u=[],i=[];for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){p.push((x/nx-.5)*w,0,(z/nz-.5)*d);n.push(0,1,0);u.push(x/nx,z/nz)}for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){let a=z*(nx+1)+x,b=a+nx+1;i.push(a,b,a+1,b,b+1,a+1)}return geometry(p,n,u,i)}
function roundBox(r=.12,seg=8){let p=[],n=[],u=[],idx=[],co=[],e=r<.02?2:5;for(let k=0;k<=e;k++)co.push(-.5+r*k/e);co.push(0);for(let k=0;k<=e;k++)co.push(.5-r+r*k/e);seg=co.length-1;const axes=[[0,1,2,1],[0,2,1,-1],[1,2,0,1],[1,0,2,-1],[2,0,1,1],[2,1,0,-1]];for(let [fixed,ax,ay,sign]of axes){let off=p.length/3;for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){let v=[0,0,0];v[fixed]=sign*.5;v[ax]=co[i];v[ay]=co[j];let inner=v.map(c=>clamp(c,-.5+r,.5-r));let norm=V.norm(V.sub(v,inner));v=V.add(inner,V.mul(norm,r));p.push(...v);n.push(...norm);u.push(co[i]+.5,co[j]+.5)}for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){let a=off+j*(seg+1)+i,b=a+seg+1;idx.push(a,a+1,b,a+1,b+1,b)}}return geometry(p,n,u,idx)}
function sphere(lat=18,lon=28,hemi=false){let p=[],n=[],u=[],idx=[];for(let j=0;j<=lat;j++){let ph=j/lat*Math.PI*(hemi?.5:1);for(let i=0;i<=lon;i++){let th=i/lon*TAU,v=[Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)];p.push(...v);n.push(...v);u.push(i/lon,j/lat)}}for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){let a=j*(lon+1)+i,b=a+lon+1;idx.push(a,a+1,b,a+1,b+1,b)}return geometry(p,n,u,idx)}
function torus(radius=1,tube=.04,nseg=100,tseg=10){let p=[],n=[],u=[],idx=[];for(let j=0;j<=nseg;j++){let a=j/nseg*TAU;for(let i=0;i<=tseg;i++){let b=i/tseg*TAU;p.push((radius+Math.cos(b)*tube)*Math.cos(a),Math.sin(b)*tube,(radius+Math.cos(b)*tube)*Math.sin(a));n.push(Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a));u.push(j/nseg,i/tseg)}}for(let j=0;j<nseg;j++)for(let i=0;i<tseg;i++){let a=j*(tseg+1)+i,b=a+tseg+1;idx.push(a,a+1,b,a+1,b+1,b)}return geometry(p,n,u,idx)}
function cylinder(seg=28){let p=[],n=[],u=[],idx=[];for(let j=0;j<2;j++)for(let i=0;i<=seg;i++){let a=i/seg*TAU;p.push(Math.cos(a),j-.5,Math.sin(a));n.push(Math.cos(a),0,Math.sin(a));u.push(i/seg,j)}for(let i=0;i<seg;i++){let b=i+seg+1;idx.push(i,i+1,b,i+1,b+1,b)}for(let j=0;j<2;j++){let c=p.length/3;p.push(0,j-.5,0);n.push(0,j?1:-1,0);u.push(.5,.5);for(let i=0;i<=seg;i++){let a=i/seg*TAU;p.push(Math.cos(a),j-.5,Math.sin(a));n.push(0,j?1:-1,0);u.push((Math.cos(a)+1)/2,(Math.sin(a)+1)/2)}for(let i=0;i<seg;i++)idx.push(c,c+i+1,c+i+2)}return geometry(p,n,u,idx)}
const G={full:plane(1,1,192,192),longRibbon:plane(1,1,6,120),box:roundBox(.12,16),block:roundBox(.003,3),sphere:sphere(),small:sphere(12,18),dome:sphere(14,24,true),ring:torus(1,.037,100,12),thickRing:torus(1,.065,100,12),cylinder:cylinder(),floor:plane(100,100)};
/* Per-frame instance batches: one per geometry, material kind and shadow flag.
 * Each instance is 15 floats (offset 3, scale 3, quaternion 4, colour 3, extra 2),
 * written straight into the interleaved array the renderer uploads. */
const BATCH_STRIDE=15,BATCH_CAPACITY=1024,ZERO3=[0,0,0],ONE3=[1,1,1],IDENTITY_Q=[0,0,0,1],EXTRA0=[.25,0];
class Batches{
 constructor(){this.map=new Map();this.used=[];this.id=0}
 begin(){for(const b of this.used)b.count=0;this.used.length=0}
 add(g,kind,c,pos=ZERO3,scale=ONE3,q=IDENTITY_Q,extra=EXTRA0,cast=true){
  const key=g.id*128+kind*2+(cast?1:0);let b=this.map.get(key);
  if(!b){b={id:++this.id,g,kind,cast,count:0,capacity:BATCH_CAPACITY,data:new Float32Array(BATCH_CAPACITY*BATCH_STRIDE)};this.map.set(key,b)}
  const i=b.count++;if(i===0)this.used.push(b);if(i>=b.capacity){b.count=b.capacity;return}
  const d=b.data,o=i*BATCH_STRIDE;
  d[o]=pos[0];d[o+1]=pos[1];d[o+2]=pos[2];d[o+3]=scale[0];d[o+4]=scale[1];d[o+5]=scale[2];
  d[o+6]=q[0];d[o+7]=q[1];d[o+8]=q[2];d[o+9]=q[3];d[o+10]=c[0];d[o+11]=c[1];d[o+12]=c[2];d[o+13]=extra[0];d[o+14]=extra[1];
 }
}

/* Material sound engine. No external recordings or tracking. */
class MaterialAudio {
 constructor(){this.ctx=null;this.enabled=false;this.volume=.35;this.lastEvent=0;this.eventTimes={};this.peak=0;this.level=0;this.hidden=false;this.profile=3;this.started=false;}
 async start(){
  try {
  if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
   const c=this.ctx=new AC({latencyHint:'interactive'});
   this.master=c.createGain();this.master.gain.value=0;
   const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.16;
   const high=c.createBiquadFilter();high.type='highpass';high.frequency.value=42;
   const low=c.createBiquadFilter();low.type='lowpass';low.frequency.value=6800;
   this.master.connect(high);high.connect(low);low.connect(limiter);limiter.connect(c.destination);
   this.analyser=c.createAnalyser();this.analyser.fftSize=512;limiter.connect(this.analyser);this.samples=new Float32Array(512);
   this.noise=[];for(let b=0;b<3;b++){const buf=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buf.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+white*.04)/1.04;data[i]=b===0?last*3.4:b===1?white*.45:(white*.24+last*1.4);}this.noise.push(buf);}
   this.voices=[];for(let i=0;i<3;i++){const source=c.createBufferSource();source.buffer=this.noise[i];source.loop=true;
    const filter=c.createBiquadFilter();filter.type=i===0?'lowpass':'bandpass';filter.Q.value=i===1?.55:.8;
    const gain=c.createGain();gain.gain.value=0;const pan=c.createStereoPanner();source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);source.start(0,i*.83);this.voices.push({source,filter,gain,pan});}
   const reverb=c.createConvolver();const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.21),c.sampleRate);for(let ch=0;ch<2;ch++){let data=impulse.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3.5)*.2;}reverb.buffer=impulse;
   const wet=c.createGain();wet.gain.value=.14;reverb.connect(wet);wet.connect(this.master);this.reverb=reverb;
  }
  try{await this.ctx.resume();this.enabled=true;this.started=true;this.setVolume(this.volume);return true;}catch(e){return false;}
 } catch(error){this.enabled=false;return false;}
 }
 setVolume(v){this.volume=clamp(v,0,1);if(this.ctx)this.master.gain.setTargetAtTime(this.enabled&&!this.hidden?this.volume*.56:0,this.ctx.currentTime,.07);}
 mute(){this.enabled=false;this.setVolume(this.volume);}
 visibility(hidden){this.hidden=hidden;if(this.ctx){this.setVolume(this.volume);if(hidden)this.motion(this.profile,0,0,0);}}
 motion(mode,amount,x,contact=1){
  if(!this.ctx)return;const c=this.ctx,t=c.currentTime;this.profile=mode;this.level=lerp(this.level,this.enabled?amount:0,.2);
  const presets={0:[470,1850,3600,.34,.22,.12],1:[380,2300,4400,.26,.20,.09],2:[180,800,1800,0,0,0],3:[230,720,1700,.19,.06,.017],4:[145,360,1350,.42,.07,.025],5:[230,2100,3800,.018,.012,.018],6:[280,570,1200,.20,.025,.016],7:[410,1800,3700,.25,.17,.06],8:[380,1600,3900,.23,.11,.048],9:[580,2100,4700,.13,.052,.038],10:[120,280,670,.39,.13,.022],11:[300,1250,3600,.24,.23,.05],12:[390,2550,4400,.24,.20,.11],13:[260,620,1100,.19,.03,.012],14:[390,2550,4400,.24,.20,.11],15:[390,2550,4400,.22,.18,.10],16:[390,2550,4400,.26,.20,.11],17:[140,300,760,.36,.12,.02],18:[560,1700,3800,.12,.05,.03],19:[180,1380,3600,.22,.12,.04],20:[240,1050,2600,.12,.07,.025],21:[720,1800,3400,.14,.06,.028],22:[520,2300,4300,.10,.07,.035]};
  const p=presets[mode]||presets[3];const ambient=(mode===8?.18:mode===9?.105:mode===10?.018:0);
  const a=this.enabled&&!this.hidden?Math.min(amount,1.7):0;
  this.voices.forEach((v,i)=>{v.filter.frequency.setTargetAtTime(p[i]*(.80+Math.min(a,1.4)*.32),t,.07);v.gain.gain.setTargetAtTime((a*(.6+.4*contact)+ambient)*p[i+3],t,i===2?.018:.035);v.pan.pan.setTargetAtTime(clamp(x*.12+(i-1)*.12,-.8,.8),t,.045);v.source.playbackRate.setTargetAtTime(.75+Math.min(a,1.4)*.22+(mode===10?-.14:0),t,.10);});
 }
 event(mode,x=0,strength=1){
  if(!this.ctx||!this.enabled||this.hidden)return;const c=this.ctx,t=c.currentTime;const gap=mode===22?.014:mode===2?.025:mode===12?.045:mode===5?.05:.07;if(t-(this.eventTimes[mode]||-1)<gap)return;this.eventTimes[mode]=t;this.lastEvent=t;strength=clamp(strength,.02,1.5);
  const profiles={0:[1600,.22,.34],1:[2600,.16,.27],2:[1100,.052,.48],3:[560,.18,.1],4:[200,.18,.19],5:[2600,.023,.095],6:[370,.12,.07],7:[1600,.13,.10],8:[1400,.09,.12],9:[1900,.07,.10],10:[180,.26,.24],11:[1000,.07,.075],12:[3200,.08,.30],13:[480,.2,.095],14:[3200,.08,.30],15:[2700,.07,.26],16:[2600,.07,.24],17:[240,.22,.22],18:[820,.12,.10],19:[2100,.045,.17],20:[1600,.075,.12],21:[1750,.030,.10],22:[2500,.032,.24]};const [f,dur,level]=profiles[mode]||profiles[3];
  const pan=c.createStereoPanner();pan.pan.value=clamp(x*.12,-.8,.8);pan.connect(this.master);
  const envelope=c.createGain();envelope.connect(pan);envelope.connect(this.reverb);const filter=c.createBiquadFilter();filter.type=mode===2?'highpass':'bandpass';filter.frequency.value=f*(.93+Math.random()*.14);filter.Q.value=mode===12?1.6:.7;
  const source=c.createBufferSource();source.buffer=this.noise[mode===2||mode===12?1:2];source.connect(filter);filter.connect(envelope);
  envelope.gain.setValueAtTime(.00001,t);envelope.gain.linearRampToValueAtTime(level*strength,t+.003);envelope.gain.exponentialRampToValueAtTime(.00001,t+dur);source.start(t,Math.random()*2);source.stop(t+dur+.02);
  source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();pan.disconnect();};
  if([2,3,4,5,8,9,10,13,22].includes(mode)){
   const o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();p.pan.value=clamp(x*.12,-.8,.8);o.type='sine';const fs={2:180,3:510,4:105,5:1300,8:660,9:860,10:125,13:440,22:1350};const duration=mode===22?.05:mode===5?.085:mode===10?.28:.17;
   o.frequency.setValueAtTime(fs[mode]*(.84+Math.random()*.32),t);o.frequency.exponentialRampToValueAtTime(fs[mode]*(mode===5?.88:mode===22?.72:.32),t+duration);
   g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime((mode===5||mode===22?.06:mode===3?.09:.17)*strength,t+.004);g.gain.exponentialRampToValueAtTime(.00001,t+duration);o.connect(g);g.connect(p);p.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
  }
 }
 measure(){if(!this.analyser)return 0;this.analyser.getFloatTimeDomainData(this.samples);let peak=0;for(const v of this.samples)peak=Math.max(peak,Math.abs(v));this.peak=Math.max(this.peak,peak);return peak;}
}

/* Shared material helpers and sample storage. */
function add(g,kind,c,p,s,q,extra,cast=true){batches.add(g,kind,c,p,s,q,extra,cast)}
function box(kind,c,p,s,q=[0,0,0,1],rounded=true){add(rounded?G.box:G.block,kind,c,p,s,q)}
function ball(kind,c,p,s=1,extra=[.2,0]){add(G.sphere,kind,c,p,typeof s==='number'?[s,s,s]:s,[0,0,0,1],extra)}
function burst(x,y,z,c,count=20,power=1){for(let i=0;i<count&&particles.length<240;i++)particles.push({x,y,z,vx:(Math.random()-.5)*power,vy:.6+Math.random()*power,vz:(Math.random()-.5)*power,r:.015+Math.random()*.026,age:0,life:1.5+Math.random(),c});}
function moveParticles(dt){for(let p of particles){p.age+=dt;p.vy-=5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<p.r+.035){p.y=p.r+.035;p.vy=Math.abs(p.vy)*.2;p.vx*=.85;p.vz*=.85}}particles=particles.filter(p=>p.age<p.life);}
function drawParticles(){for(let p of particles){let size=p.r*Math.min(1,(p.life-p.age)*3);add(G.small,11,p.c,[p.x,p.y,p.z],[size,size,size]);}}
function popAt(p){if(!p)return;let best=null,dist=.45;for(let b of bubbleList){let d=Math.hypot(p.x-b.x,p.z-b.z);if(d<dist){dist=d;best=b}}popBubble(best);}
function indexAt(x,z){let i=clamp(Math.round((x/world.fieldSpan[0]+.5)*(N-1)),0,N-1),j=clamp(Math.round((z/world.fieldSpan[1]+.5)*(N-1)),0,N-1);return j*N+i;}
function clayStamp(x,z,r=.58,strength=1,smooth=false){let sx=world.fieldSpan[0],sz=world.fieldSpan[1],ix=(x/sx+.5)*(N-1),iz=(z/sz+.5)*(N-1),rx=r/sx*N,rz=r/sz*N;for(let j=Math.max(1,Math.floor(iz-rz*1.4));j<Math.min(N-1,iz+rz*1.4);j++)for(let i=Math.max(1,Math.floor(ix-rx*1.4));i<Math.min(N-1,ix+rx*1.4);i++){let dist=Math.hypot((i-ix)/rx,(j-iz)/rz),k=j*N+i;if(smooth){if(dist<1.3)field[k]*=1-Math.max(0,1-dist/1.3)*.2*strength;}else{let depth=-.44*Math.exp(-dist*dist*3.3)+.064*Math.exp(-(((dist-.98)/.19)**2));let blend=Math.exp(-dist*dist*2)*.23*strength;field[k]=lerp(field[k],depth,blend);}}fieldDirty=true;}
function initInk(){let palette=['#243c57','#7896ab','#b7dbce','#e6dcb8','#c293a5','#8a80b0'].map(h=>{let n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]});for(let j=0;j<N;j++)for(let i=0;i<N;i++){let x=(i/N-.5)*8,z=(j/N-.5)*8,r=Math.hypot(x,z),a=Math.atan2(z,x);let t=(Math.sin(x*2.7+Math.sin(z*1.6)*2.4+Math.sin(r*2.1+a*2)*.6)+1)*2.49;let k=Math.floor(t),f=t-k;f=f*f*(3-2*f);let k2=(k+1)%6;for(let n=0;n<3;n++)dye[(j*N+i)*4+n]=lerp(palette[k][n],palette[k2][n],f);dye[(j*N+i)*4+3]=255;}dyeDirty=true;}
function inkSample(src,i,j,ch){let x=clamp(i,0,N-1.001),z=clamp(j,0,N-1.001),ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,a=(iz*N+ix)*4+ch;return lerp(lerp(src[a],src[a+4],fx),lerp(src[a+N*4],src[a+N*4+4],fx),fz);}
function encodeField(){for(let i=0;i<field.length;i++){let k=i*4;let val=clamp(Math.round((field[i]/world.heightScale+.5)*65535),0,65535);fieldBytes[k]=val>>8;fieldBytes[k+1]=val&255;fieldBytes[k+2]=0;fieldBytes[k+3]=255;}fieldDirty=false;}

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const N=192,field=new Float32Array(N*N),velocity=new Float32Array(N*N),fieldBytes=new Uint8Array(N*N*4),dye=new Uint8Array(N*N*4);
let inkF=new Float32Array(N*N*4),inkA=new Float32Array(N*N*4);
const materialAudio=new MaterialAudio(),batches=new Batches(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scenes=[
 {title:'Kinetic sand',desc:'Slice. Separate. Crumble.',tag:'GRAIN · CRUNCH',copy:'Clean cuts through soft layers.',hint:'Hold to cut. Move across the sand for the next slice.',colors:['#cfaaa0','#aebda2','#a8b5cb'],tool:null,bg:'#b59285'},
 {title:'Soap ribbons',desc:'A soft, continuous curl.',tag:'SHAVE · CURL',copy:'Keep the ribbon going.',hint:'Drag steadily to keep the ribbon curling.',colors:['#d7dec6','#cfc3ae','#c0cbd5'],tool:null,bg:'#aeb38d'},
 {title:'Bubble wrap',desc:'One pop. Then another.',tag:'POP · CLICK',copy:'Slow pops or a whole little run.',hint:'Tap or drag to pop a row of bubbles.',colors:['#d3d7d6','#b9c4d2','#d7cbbf'],tool:'Reset bubbles',bg:'#c4c8c9'},
 {title:'Pond ripples',desc:'Ripples that keep spreading.',tag:'WATER · RIPPLE',copy:'Touch the surface and let the circles travel.',hint:'Drag through the water. Tap to send out a ripple.',colors:['#2c968a','#448dab','#929862'],tool:'Rain',bg:'#245e58'},
 {title:'Soft clay',desc:'Press into something soft.',tag:'SOFT · PRESS',copy:'Leave a mark. Smooth it away.',hint:'Hold to press deeper. Drag to make a soft groove.',colors:['#c19184','#9cbaa8','#c5b394'],tool:'Smooth',bg:'#af887d'},
 {title:'Magnetic beads',desc:'Pull a little. Let go.',tag:'MAGNET · CLICK',copy:'A little pull brings things together.',hint:'Drag to gather the beads. Release to let them settle.',colors:['#c4b385','#b9cacc','#c79a8a'],tool:'Scatter',bg:'#877956'},
 {title:'Marbled ink',desc:'Color that follows your hand.',tag:'FLUID · SWIRL',copy:'Fold one color into another.',hint:'Drag to stir the ink. Use two fingers to make two swirls.',colors:['#a8d2ba','#c7acd0','#e6c193'],tool:'Add color',bg:'#768a9d'},
 {title:'Sand combing',desc:'One uninterrupted line.',tag:'SAND · BRUSH',copy:'Let the lines follow your hand.',hint:'Drag to comb the sand. Select Smooth to clear it.',colors:['#d4bf97','#cfafab','#a3bbc7'],tool:'Smooth',bg:'#bdac8b'},
 {title:'Waterfall',desc:'Part a sheet of water.',tag:'FLOW · SPLASH',copy:'Let the water run around your touch.',hint:'Hold a finger in the falling water. Move to split the flow.',colors:['#6aafad','#72a7c2','#92bdad'],tool:'Gentle flow',bg:'#407e80'},
 {title:'Running water',desc:'A stream over your hand.',tag:'STREAM · TRICKLE',copy:'Break the stream. Let it join again.',hint:'Move into the stream to split it. Hold to make it splash.',colors:['#a9d5d1','#aed1e6','#d5dac1'],tool:'Wide stream',bg:'#aabeb8'},
 {title:'Chocolate river',desc:'Dip. Lift. Watch it drip.',tag:'DIP · DRIP',copy:'A slow dip. A glossy coat.',hint:'Drag down to dip the candy. Drag up to lift it out.',colors:['#704128','#945e3b','#be9669'],tool:'Fresh candy',bg:'#5a3324'},
 {title:'Fresh paint',desc:'A perfect pass of the roller.',tag:'ROLL · COAT',copy:'From bare wall to a new color.',hint:'Drag the roller across the wall. Choose a color below.',colors:['#5f8d6b','#b07b79','#6c8caa'],tool:'Clean wall',bg:'#a5b69c'},
 {title:'Vinyl peel',desc:'A thick sheet. A soft fold.',tag:'PEEL · RELEASE',copy:'Keep pulling. Let the strip curl.',hint:'Touch anywhere, then drag down to peel a long strip.',colors:['#d5c9a8','#b6c9be','#ceb6c4'],tool:'New sheet',bg:'#c3b698'},
 {title:'Liquid silk',desc:'Soft color in slow motion.',tag:'FLUID · FOLD',copy:'Make a current. Follow the fold.',hint:'Drag through the silk. Each finger makes its own current.',colors:['#e8c7b9','#c6c6e4','#cae3d0'],tool:'Add color',bg:'#bfb4c0'},
 {title:'Glue peel',desc:'Lift dried glue from glass.',tag:'GLASS · PEEL',copy:'Catch the edge. Pull one satisfying sheet.',hint:'Touch near an edge and drag down to lift dried glue from the glass.',colors:['#dceaf0','#d7f1ea','#eee6f1'],tool:'New glass sheet',bg:'#9cb9c4'},
 {title:'Protective film',desc:'A clean peel from something new.',tag:'PLASTIC · PEEL',copy:'Lift the corner and pull in one glossy strip.',hint:'Touch and drag downward to peel the protective plastic from the object.',colors:['#d8eef7','#d9e0ef','#f0e7d6'],tool:'Fresh film',bg:'#6d7e8a'},
 {title:'Masking tape',desc:'Fresh paint under a clean line.',tag:'TAPE · REVEAL',copy:'Pull slow and reveal the sharp edge.',hint:'Grab the tape and drag down to reveal the painted line beneath it.',colors:['#3f7f68','#ca806f','#5f88b6'],tool:'New tape lines',bg:'#c8c0b1'},
 {title:'Candle wax',desc:'Warm wax settling into smooth pools.',tag:'WAX · POOL',copy:'Slow heat. Soft edges. Glossy pools.',hint:'Glide through the warm wax to spread it into smooth little pools.',colors:['#f0bf72','#f2c9a2','#edd6c9'],tool:'New pour',bg:'#6c4f45'},
 {title:'Melting ice',desc:'Warm water softens the edges.',tag:'ICE · MELT',copy:'Warm water, clear ripples, rounded cubes.',hint:'Drag warm water across the ice to melt it and send gentle ripples outward.',colors:['#9dd8ef','#d7f6ff','#a7d9c8'],tool:'Fresh cubes',bg:'#5f97a5'},
 {title:'Crushed leaves',desc:'Dry leaves that crisp and collapse.',tag:'LEAF · CRUSH',copy:'A brittle crackle, a soft collapse, and a warm autumn bed.',hint:'Sweep or press into the leaves to flatten them into crisp little fragments.',colors:['#c89a53','#8f6a3a','#b75d3d'],tool:'Fresh layer',bg:'#4a3527'},
 {title:'Colored resin',desc:'Pour color into fine cracks.',tag:'RESIN · FLOW',copy:'Pour, watch it seek the channel, and let it level into a glossy seam.',hint:'Guide the resin along the cracks and let the liquid settle into each groove.',colors:['#4eb8ff','#ff6f98','#ffb949'],tool:'Fresh cracks',bg:'#8a837a'},
 {title:'Color sorting',desc:'Hundreds of tiny pieces, perfectly arranged.',tag:'SORT · SNAP',copy:'Sweep through the pieces and feel them settle into tidy color rows.',hint:'Guide the pieces into matching lanes and let them snap neatly into place.',colors:['#8ccfff','#ff9fc2','#f3d26b'],tool:'Shuffle',bg:'#d6d1c6'},
 {title:'Domino run',desc:'One tap. A long, clicking chain.',tag:'TIP · CASCADE',copy:'Set a line. Tip the first one. Listen.',hint:'Drag on the table to set a line of dominoes. Tap one to tip the chain.',colors:['#ece3cf','linear-gradient(135deg,#e68a6e,#e8c36a,#7db6d8,#a88fd6)','#2a3134'],tool:'Stand them up',bg:'#6e523c'}
];
const order=[14,15,16,17,18,19,20,21,22,3,8,9,10,11,12,13,7,0,1,2,4,5,6];
const state={scene:14,watch:false,paused:false,tour:false,tourTime:0,speed:1,palette:0,tool:false,time:0,localTime:0,down:false,pointer:null,angle:0,volume:.28,force:.6,soundTouched:false,focus:false,autoHide:true,haptics:false,ready:false,cutPhase:0,cutCount:0,cutTriggered:false,reform:0,soapPhase:0,soapCount:0,lastPop:0,lastDrop:0,lastClay:0,lastGrain:0,lastInk:0,actionCount:0,frames:0,errors:[],contact:.6,smoothedSpeed:0,renderer:'',lastInteraction:0,coat:0,candyY:1.1,candyX:0,candyZ:0,candyDrip:0,painted:0,peeled:0,waxPool:.18,melt:0,leafCrush:0,resinFill:0,sortedCount:0,dominoIdle:0,dominoMoving:0,dominoFullNotice:false};
const world={time:0,camera:null,light:cameraAt([-7,15,8],[0,0,0],30,30),heightScale:1.5,fieldSpan:[12,12]};
const C={steel:color('#dde6df'),handle:color('#496250'),ivory:color('#dae0cc'),wood:color('#ae8356')};
let bridge=null,fieldDirty=true,dyeDirty=true,rect,cam,activePoint=null,lastActive=null,particles=[],slices=[],curls=[],bubbleList=[],beads=[],dropList=[],inkStep=0,fieldFrame=0,toastTimer;
let streams=[],peelLanes=[],touches=new Map(),soapRibbons=[],lastHaptic=0,seed=3,autoPrevious=null,fallAccumulator=0,fluid=null,leaves=[],resinCracks=[],sortBits=[],dominoes=[],dominoHue=0;
const touchRings=new Map();
function random(){seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2700);}
function chooseColor(){return color(scenes[state.scene].colors[state.palette]);}
function rgb8(h){let n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255];}
function settings(){try{localStorage.setItem('still-immersive-v3',JSON.stringify({volume:state.volume,force:state.force,speed:state.speed,haptics:state.haptics,autoHide:state.autoHide}));}catch(e){}}
try{const s=JSON.parse(localStorage.getItem('still-immersive-v3')||'{}');for(let [k,a,b]of[['volume',0,1],['force',.2,1],['speed',.35,1.5]])if(Number.isFinite(s[k]))state[k]=clamp(s[k],a,b);if(typeof s.autoHide==='boolean')state.autoHide=s.autoHide;if(typeof s.haptics==='boolean')state.haptics=s.haptics;}catch(e){}
function pulse(kind='soft',strength=1){if(state.watch)return;const t=performance.now();if(t-lastHaptic<75)return;
 // A controller rumbles on every contact; a phone vibrates when Touch feedback is on.
 if(input.source==='gamepad'){lastHaptic=t;input.rumble(kind==='pop'?.55:clamp(.12+strength*.22,.1,.5),kind==='pop'?60:kind==='peel'?45:30);return;}
 if(!state.haptics||!navigator.vibrate)return;lastHaptic=t;try{navigator.vibrate(kind==='pop'?[7,13,4]:kind==='peel'?Math.round(4+strength*3):Math.round(3+strength*3));}catch(e){}}
function materialEvent(mode,x=0,strength=1){materialAudio.event(mode,x,strength);pulse(mode===2?'pop':mode===12?'peel':'soft',strength);state.actionCount++;}
function surface(kind,c,y=0,extra=[.1,1],cast=false){add(G.full,kind,c,[0,y,0],[world.fieldSpan[0],1,world.fieldSpan[1]],[0,0,0,1],extra,cast);}
function fillDye(c,alpha=255){for(let i=0;i<N*N;i++){const k=i*4;dye[k]=c[0];dye[k+1]=c[1];dye[k+2]=c[2];dye[k+3]=alpha;}dyeDirty=true;}
function initBubbles(){bubbleList=[];const cols=Math.ceil(world.fieldSpan[0]/.76),rows=Math.ceil(world.fieldSpan[1]/.76);for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)bubbleList.push({x:(i-(cols-1)/2)*.76,z:(j-(rows-1)/2)*.76,value:1,vel:0,popped:false,age:0});}
function initBeads(){beads=[];const sx=world.fieldSpan[0],sz=world.fieldSpan[1],spacing=Math.sqrt(sx*sz/650),r=spacing*.43;const cols=Math.ceil(sx/spacing),rows=Math.ceil(sz/(spacing*.90));for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=(i-(cols-1)/2+(j%2)*.5)*spacing,z=(j-(rows-1)/2)*spacing*.90;beads.push({x,z,hx:x,hz:z,vx:0,vz:0,r,hue:random()});}}
function initStreams(){streams=[];const count=state.scene===8?240:130;for(let i=0;i<count;i++){streams.push({x:(random()-.5)*(state.scene===8?world.fieldSpan[0]:.28),z:(random()-.5)*world.fieldSpan[1],y:.07+random()*.045,vx:0,vy:0,speed:3+random()*3.4,r:.009+random()*.017,length:.08+random()*.21,free:false});}}

function initLeaves(){
  leaves=[];
  const sx=world.fieldSpan[0]*.84,sz=world.fieldSpan[1]*.78;
  const clusters=5,count=Math.round(clamp(sx*sz*1.55,120,220));
  const centers=Array.from({length:clusters},(_,i)=>({x:(Math.sin(i*2.2)*.32+(random()-.5)*.12)*sx,z:(Math.cos(i*1.7)*.26+(random()-.5)*.12)*sz}));
  for(let i=0;i<count;i++){
    const c=centers[i%clusters],size=.12+random()*.14,curl=.22+random()*.34,tone=random(),ang=random()*TAU;
    leaves.push({
      x:c.x+(random()-.5)*sx*.22,z:c.z+(random()-.5)*sz*.18,rot:ang,size,
      crush:0,target:0,shatter:0,dust:0,curl,baseCurl:curl,lift:.015+random()*.02,
      vx:0,vz:0,spin:(random()-.5)*.02,hue:tone,shadow:.7+random()*.3,snapped:false
    });
  }
}
function crushLeavesAt(x,z,power=1){
  const r=.84;let hit=0,hard=0;
  for(const l of leaves){
    const dx=l.x-x,dz=l.z-z,d=Math.hypot(dx,dz);if(d>r)continue;
    const fall=Math.pow(1-d/r,1.5),a=fall*(.24+power*.96),prev=l.target;
    l.target=clamp(Math.max(l.target,prev+a*.18),0,1);
    l.dust=Math.min(1,l.dust+a*.7);
    l.vx+=dx*.018*a+(random()-.5)*.004*a;l.vz+=dz*.018*a+(random()-.5)*.004*a;l.spin+=(random()-.5)*.12*a;
    if(prev<.35&&l.target>=.35)hit++;
    if(prev<.74&&l.target>=.74){
      hard++;
      l.shatter=Math.max(l.shatter,.35+.45*l.target);
      burst(l.x,.045,l.z,color('#bb9152'),4+Math.floor(random()*3),.14);
    }
  }
  if((hit||hard)&&state.localTime-state.lastGrain>.07){
    state.lastGrain=state.localTime;
    materialEvent(19,x,.18+Math.min(.36,hit*.03+hard*.05));
  }
}
function stepLeaves(dt,active,p){
  if(active&&p)crushLeavesAt(p.x,p.z,state.contact);
  let total=0;
  for(const l of leaves){
    l.crush=lerp(l.crush,l.target,1-Math.exp(-dt*11));
    l.shatter=lerp(l.shatter,clamp((l.target-.52)/.48,0,1),1-Math.exp(-dt*7));
    l.curl=lerp(l.curl,l.baseCurl*(1-l.crush*.78),1-Math.exp(-dt*6));
    l.lift=lerp(l.lift,.012+.028*(1-l.crush),1-Math.exp(-dt*5));
    l.rot+=l.spin*dt*60;l.spin*=Math.pow(.90,dt*60);
    l.vx*=Math.pow(.84,dt*60);l.vz*=Math.pow(.84,dt*60);
    l.x+=l.vx*dt*60;l.z+=l.vz*dt*60;
    l.dust=Math.max(0,l.dust-dt*.45);
    l.x=clamp(l.x,-world.fieldSpan[0]*.46,world.fieldSpan[0]*.46);
    l.z=clamp(l.z,-world.fieldSpan[1]*.46,world.fieldSpan[1]*.46);
    total+=l.crush;
  }
  state.leafCrush=total/Math.max(1,leaves.length);
}
function drawLeaves(){
  surface(20,color('#241b15'),-.03,[.22,0]);
  box(2,color('#3e2d20'),[0,-.055,0],[world.fieldSpan[0]*.96,.09,world.fieldSpan[1]*.96],undefined,false);
  const palettes=[[color('#c89a53'),color('#8f6a3a'),color('#b75d3d')],[color('#b6863f'),color('#7c5a31'),color('#9f4f2e')],[color('#d1a460'),color('#95693c'),color('#a46346')]];
  const [c0,c1,c2]=palettes[state.palette%palettes.length],stem=color('#5f4526'),shadow=color('#1a130f');
  const ordered=[...leaves].sort((a,b)=>(a.z+a.crush*.2)-(b.z+b.crush*.2));
  for(const l of ordered){
    const warm=lerp(.12,.62,l.hue),base=[lerp(c0[0],c1[0],warm),lerp(c0[1],c1[1],warm),lerp(c0[2],c2[2],warm)];
    const ang=l.rot,flat=1-l.crush*.82,frag=l.shatter, y=.03+l.lift*(1-frag*.4);
    add(G.sphere,20,shadow,[l.x,.008,l.z],[l.size*1.02,.004,l.size*.60],[0,0,0,1],[.08,0],false);
    add(G.sphere,15,base,[l.x,y,l.z],[l.size*(1+frag*.06),Math.max(.005,.028*flat),l.size*.58*(1-frag*.06)],quat(0,ang,0),[.24+.1*l.crush,0],false);
    add(G.sphere,15,base.map(v=>v*.92),[l.x+Math.cos(ang)*l.size*.14,y+l.curl*.05,l.z+Math.sin(ang)*l.size*.14],[l.size*.62,Math.max(.004,.018*flat),l.size*.34],quat(0,ang+.36,0),[.18,0],false);
    box(8,stem,[l.x-Math.cos(ang)*l.size*.14,y+.003,l.z-Math.sin(ang)*l.size*.14],[.012,.007,l.size*.42],quat(Math.PI/2,ang,0),false);
    box(8,stem,[l.x,y+.004,l.z],[.008,.006,l.size*.30],quat(Math.PI/2,ang+.22,0),false);
    if(frag>.32){
      const off=l.size*(.16+.10*frag);
      for(let k=0;k<3;k++)ball(11,base.map(v=>v*(.92-k*.05)),[l.x+Math.cos(ang+1.6+k)*off,y-.004,l.z+Math.sin(ang+1.6+k)*off],[.018+.006*frag,.006,.012+.005*frag],[.08,0]);
    }
    if(l.dust>.06){
      for(let k=0;k<2;k++)ball(11,base.map(v=>Math.min(1,v*1.06)),[l.x+(random()-.5)*l.size*.5,.014,l.z+(random()-.5)*l.size*.4],[.015,.004,.010],[.1,0]);
    }
  }
}
function initResin(){
  resinCracks=[];
  const paths=[
    [[-3.2,-3.15],[-2.0,-1.85],[-.85,-.55],[.25,.95],[1.55,3.0]],
    [[2.85,-3.25],[1.7,-1.9],[.85,-.75],[-.3,.65],[-1.45,3.05]],
    [[-2.5,.95],[-1.0,.35],[.25,.02],[1.65,-.22],[2.95,-.95]],
    [[-2.95,2.65],[-1.55,1.55],[-.35,.9],[1.0,.58],[2.45,.14]],
    [[-.35,-2.95],[.05,-1.65],[.35,-.65],[.72,.55],[1.05,1.9]]
  ];
  for(let p=0;p<paths.length;p++){
    let order=0;
    for(let s=0;s<paths[p].length-1;s++){
      const [ax,az]=paths[p][s],[bx,bz]=paths[p][s+1],len=Math.hypot(bx-ax,bz-az),steps=Math.max(4,Math.round(len/.22));
      for(let i=0;i<steps;i++){
        const t=i/steps,w=.06+.02*Math.sin((order+i+p)*.7),cap=.55+.22*random();
        resinCracks.push({path:p,order:order++,x:lerp(ax,bx,t),z:lerp(az,bz,t),mass:0,fill:0,wet:0,cap,w,depth:.02+random()*.02});
      }
    }
    const [lx,lz]=paths[p].at(-1);resinCracks.push({path:p,order:order++,x:lx,z:lz,mass:0,fill:0,wet:0,cap:.65,w:.08,depth:.024});
  }
}
function resinStamp(x,z,power=1){
  const r=.68;let hit=0;
  for(const n of resinCracks){
    const d=Math.hypot(n.x-x,n.z-z);if(d>r)continue;
    const a=Math.pow(1-d/r,1.8)*(.35+power*.95);
    n.mass=Math.min(n.cap*1.4,n.mass+a*.055);n.wet=1;hit++;
  }
  if(hit&&state.localTime-state.lastGrain>.06){state.lastGrain=state.localTime;materialEvent(20,x,.14+Math.min(.22,hit*.01));}
}
function stepResin(dt,active,p){
  if(active&&p)resinStamp(p.x,p.z,state.contact);
  const groups=new Map();for(const n of resinCracks){n.wet=Math.max(0,n.wet-dt*.9);(groups.get(n.path)||groups.set(n.path,[]).get(n.path)).push(n);}
  let total=0;
  for(const arr of groups.values()){
    arr.sort((a,b)=>a.order-b.order);
    for(let iter=0;iter<2;iter++){
      for(let i=0;i<arr.length-1;i++){
        const a=arr[i],b=arr[i+1],pressure=(a.mass/a.cap)-(b.mass/b.cap),flow=pressure*dt*.55;
        if(flow>0){const q=Math.min(a.mass,flow*.30);a.mass-=q;b.mass=Math.min(b.cap*1.4,b.mass+q);} 
        else if(flow<0){const q=Math.min(b.mass,-flow*.16);b.mass-=q;a.mass=Math.min(a.cap*1.4,a.mass+q);} 
      }
    }
    for(let i=1;i<arr.length-1;i++)arr[i].mass+=Math.max(0,((arr[i-1].mass+arr[i+1].mass)*.5-arr[i].mass))*dt*.08;
    for(const n of arr){
      n.fill=lerp(n.fill,clamp(n.mass/n.cap,0,1),1-Math.exp(-dt*(n.wet>.15?14:8)));
      if(n.fill>.985)n.mass=Math.max(n.cap*.985,n.mass-dt*.05);
      total+=n.fill;
    }
  }
  state.resinFill=total/Math.max(1,resinCracks.length);
}
function drawResin(){
  surface(20,color('#d7d1c8'),-.03,[.34,0]);
  box(2,color('#c5beb4'),[0,-.06,0],[world.fieldSpan[0]*.96,.10,world.fieldSpan[1]*.96],undefined,false);
  const slab=color('#bfb7ad'),groove=color('#5c5650'),resin=chooseColor().map(v=>Math.min(1,v*1.02+.02));
  box(2,slab,[0,-.005,0],[world.fieldSpan[0]*.90,.04,world.fieldSpan[1]*.90],undefined,false);
  const groups=new Map();for(const n of resinCracks)(groups.get(n.path)||groups.set(n.path,[]).get(n.path)).push(n);
  for(const arr of groups.values()){
    arr.sort((a,b)=>a.order-b.order);
    for(let i=1;i<arr.length;i++){
      const a=arr[i-1],b=arr[i];
      tube([a.x,.010-a.depth,a.z],[b.x,.010-b.depth,b.z],Math.max(a.w,b.w),2,groove);
      const f=(a.fill+b.fill)*.5;
      if(f>.01){
        const rr=(Math.max(a.w,b.w)*.38)+f*.020;
        tube([a.x,.026+a.fill*.002,a.z],[b.x,.026+b.fill*.002,b.z],rr,13,resin.map(v=>Math.min(1,v*(1.04+f*.12))));
        if(f>.15)tube([a.x,.034,a.z],[b.x,.034,b.z],rr*.42,31,color('#f3ffff'));
      }
    }
  }
  for(const n of resinCracks){
    if(n.fill>.02){
      const r=n.w*(.30+n.fill*.75),h=.008+n.fill*.018;
      ball(13,resin,[n.x,.023+h,n.z],[r,h,r],[.3,0]);
      if(n.fill>.2)ball(31,color('#f8ffff'),[n.x-r*.10,.035+h,n.z-r*.12],[r*.25,h*.18,r*.18],[.08,0]);
    }
  }
  if(activePoint&&(state.down||state.watch)){
    add(G.cylinder,15,color('#cfd8de'),[activePoint.x,.24,activePoint.z],[.06,.62,.06],quat(0,0,Math.PI/2),[.8,0]);
    add(G.cylinder,2,color('#94a5b2'),[activePoint.x,.08,activePoint.z],[.025,.18,.025],quat(0,0,Math.PI/2),[.4,0]);
    ball(13,resin,[activePoint.x,.048,activePoint.z],[.055,.018,.055],[.15,0]);
  }
}
const SORT_SETS=[['#f4a6c2','#f7d56b','#95d7ff','#8fd2a0','#cbb4ff'],['#ff7e8d','#ffb654','#63c7ff','#5fd0bf','#c49dff'],['#d17d52','#d7b95b','#69a6d8','#86b784','#af8ac9']].map(set=>set.map(color));
function activeSortColors(){return SORT_SETS[state.palette%SORT_SETS.length];}
function initSorting(){
  sortBits=[];const cols=5,per=42,laneW=world.fieldSpan[0]/cols,startZ=-world.fieldSpan[1]*.18;
  for(let g=0;g<cols;g++)for(let i=0;i<per;i++){
    const row=Math.floor(i/7),col=i%7,tx=-world.fieldSpan[0]*.5+laneW*(g+.5)+((col-3)*.12),tz=startZ+row*.135;
    sortBits.push({g,shape:i%3,x:(random()-.5)*world.fieldSpan[0]*.84,z:(random()-.5)*world.fieldSpan[1]*.72,vx:0,vz:0,tx,tz,r:.050+.006*(i%4),lock:0,snapped:false});
  }
}
function shuffleSorting(){for(const o of sortBits){o.x=(random()-.5)*world.fieldSpan[0]*.84;o.z=(random()-.5)*world.fieldSpan[1]*.72;o.vx=o.vz=0;o.lock=0;o.snapped=false;}}
function stepSorting(dt,active,p){
  const pts=state.watch&&p?[p]:[...touches.values()];const t=Math.min(dt,1/45)*60;
  for(const o of sortBits){
    let fx=(o.tx-o.x)*(.010+.012*o.lock),fz=(o.tz-o.z)*(.010+.014*o.lock);
    for(const p of pts){
      const dx=p.x-o.x,dz=p.z-o.z,d2=dx*dx+dz*dz,a=.13*Math.exp(-d2/1.05)*(p.pressure||state.contact);
      fx+=dx*a+(p.vx||0)*.003;fz+=dz*a+(p.vz||0)*.003;
    }
    const nearTarget=Math.hypot(o.x-o.tx,o.z-o.tz);
    if(nearTarget<.26){fx+=(o.tx-o.x)*.05;fz+=(o.tz-o.z)*.05;}
    o.vx=(o.vx+fx*t)*Math.pow(nearTarget<.18?.68:.80,t);
    o.vz=(o.vz+fz*t)*Math.pow(nearTarget<.18?.68:.80,t);
    o.x+=o.vx*t;o.z+=o.vz*t;
    o.lock=nearTarget<.085?Math.min(1,o.lock+dt*4.5):Math.max(0,o.lock-dt*1.1);
    if(o.lock>.90&&!o.snapped){o.snapped=true;materialEvent(21,o.x,.08);} else if(o.lock<.45)o.snapped=false;
  }
  const size=.13,bins=new Map();
  for(const o of sortBits){const key=Math.floor(o.x/size)+','+Math.floor(o.z/size);(bins.get(key)||bins.set(key,[]).get(key)).push(o);}
  for(let pass=0;pass<3;pass++)for(const a of sortBits){
    const gx=Math.floor(a.x/size),gz=Math.floor(a.z/size);
    for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){
      const near=bins.get((gx+x)+','+(gz+z));if(!near)continue;
      for(const b of near){if(a===b)continue;let dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz,min=(a.r+b.r)*1.04;if(d2<min*min&&d2>.00001){const d=Math.sqrt(d2),push=(min-d)*.22;a.x-=dx/d*push;a.z-=dz/d*push;b.x+=dx/d*push;b.z+=dz/d*push;}}
    }
  }
  state.sortedCount=sortBits.reduce((n,o)=>n+(o.lock>.82),0);
  if(active&&state.localTime-state.lastGrain>.09){state.lastGrain=state.localTime;materialEvent(21,(pts[0]?.x)||0,.10+state.sortedCount/sortBits.length*.07);}
}
function drawSorting(){
  surface(20,color('#ede8e0'),-.03,[.34,0]);
  box(2,color('#d8d1c8'),[0,-.055,0],[world.fieldSpan[0]*.96,.09,world.fieldSpan[1]*.96],undefined,false);
  const cols=activeSortColors(),laneW=world.fieldSpan[0]/5;
  for(let i=0;i<5;i++){
    const x=-world.fieldSpan[0]*.5+laneW*(i+.5),c=cols[i],rim=c.map(v=>Math.min(1,v*.84+.06));
    box(2,color('#c7c0b7'),[x,.018,-world.fieldSpan[1]*.01],[laneW*.92,.05,world.fieldSpan[1]*.88],undefined,false);
    box(15,c.map(v=>v*.92),[x,.006,-world.fieldSpan[1]*.01],[laneW*.84,.012,world.fieldSpan[1]*.82],undefined,false);
    box(2,rim,[x,.028,-world.fieldSpan[1]*.37],[laneW*.76,.06,.16],undefined,false);
  }
  for(const o of sortBits){
    const c=cols[o.g],y=.085+.01*o.lock;
    if(o.shape===0)add(G.small,2,c,[o.x,y,o.z],[o.r,o.r*.82,o.r],[0,0,0,1],[.12+o.lock*.18,0],false);
    else if(o.shape===1)add(G.cylinder,15,c,[o.x,y,o.z],[o.r*.92,o.r*.45,o.r*.92],[0,0,0,1],[.22+o.lock*.15,0],false);
    else box(15,c,[o.x,y,o.z],[o.r*1.6,o.r*.54,o.r*1.2],quat(0,(o.g*1.2+o.shape)*.3,0),false);
    if(o.lock>.35)ball(31,color('#ffffff'),[o.x-o.r*.18,y+.018,o.z-o.r*.12],[o.r*.24,o.r*.08,o.r*.18],[.06,0]);
  }
}

/* Domino run: standing tiles in chains. Drag on the table to set a line; tap or
 * sweep a tile to tip it. Each tile pivots on its front edge: gravity topples it
 * past the tipping point (and rights it before), and once its top edge meets the
 * next tile's back face it leans there and hands the push on, with a click. */
const DOMINO={h:.5,w:.3,t:.08,s:.31,max:320,k:60};
const DOMINO_BETA=Math.atan2(DOMINO.t,DOMINO.h);
function dominoQuat(yaw,tilt){const cy=Math.cos(yaw/2),sy=Math.sin(yaw/2),cp=Math.cos(tilt/2),sp=Math.sin(tilt/2);return[cy*sp,sy*cp,-sy*sp,cy*cp];}
function hueColor(h,s=.56,l=.62){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return Math.pow(l-a*Math.max(-1,Math.min(k-3,9-k,1)),2.2);};return[f(0),f(8),f(4)];}
function makeDomino(x,z,dx,dz,prev){const d={x,z,dx,dz,yaw:Math.atan2(dx,dz),a:0,w:0,rise:-1,prev:prev||null,next:null,rainbow:hueColor(dominoHue)};dominoHue=(dominoHue+.031)%1;if(prev)prev.next=d;dominoes.push(d);return d;}
function faceDomino(d,dx,dz){const l=Math.hypot(dx,dz);if(l<1e-6||d.a>0)return;d.dx=dx/l;d.dz=dz/l;d.yaw=Math.atan2(d.dx,d.dz);}
function initDominoes(){
  dominoes=[];dominoHue=0;
  // A spiral that runs in from the rim: tip the outer end and it winds to the centre.
  const R=Math.max(1.35,Math.min(cam?cam.width*.42:3,cam?cam.height*.4:3,world.fieldSpan[0]*.42,world.fieldSpan[1]*.42));
  const r0=.62,b=.64/TAU,pts=[];
  for(let th=0,r=r0;r<=R;){pts.push([Math.cos(th)*r,Math.sin(th)*r]);th+=DOMINO.s/Math.hypot(r,b);r=r0+b*th;}
  pts.reverse();
  let prev=null;for(const [x,z] of pts)prev=makeDomino(x,z,1,0,prev);
  for(const d of dominoes){const a=d.prev||d,c=d.next||d;faceDomino(d,c.x-a.x,c.z-a.z);}
}
function dominoLimit(d,n){
  // The lean angle at which d's top edge meets n's back face while n is tilted by phi.
  const ex=n.x-d.x,ez=n.z-d.z,s=ex*d.dx+ez*d.dz,side=Math.abs(ex*d.dz-ez*d.dx);
  if(s<=DOMINO.t*1.2||s>DOMINO.h+DOMINO.t||side>DOMINO.w*.9)return Math.PI/2;
  const phi=n.a*Math.max(0,d.dx*n.dx+d.dz*n.dz);
  return Math.min(Math.PI/2,phi+Math.asin(clamp((s*Math.cos(phi)-DOMINO.t)/DOMINO.h,-1,1)));
}
function tipDomino(d,speed){if(!d||d.rise>=0||d.a>.02)return false;d.w=Math.max(d.w,speed);materialEvent(22,d.x,.16+Math.min(.2,speed*.03));return true;}
function standDominoesUp(){let i=0;for(const d of dominoes)if(d.a>0||d.w!==0){d.rise=.12+(i++)*.022;d.w=0;}if(i)notify('Standing them back up.');}
function dominoAtScreen(sx,sy){
  // Picks by the tile's projected centre, so a tap on the visible tile finds it from any view.
  if(sx===undefined||!rect||!cam)return null;
  let best=null,dist=Math.max(22,DOMINO.w*.8/cam.height*rect.height);
  for(const d of dominoes){if(d.a>.02||d.rise>=0)continue;const q=toScreen(d.x,d.z,DOMINO.h*.5),dd=Math.hypot(q.x-sx,q.y-sy);if(dd<dist){dist=dd;best=d;}}
  return best;
}
function placeDomino(x,z,ux,uz,prev){
  if(dominoes.length>=DOMINO.max){if(!state.dominoFullNotice){state.dominoFullNotice=true;notify('The table is full. Reset for a fresh run.');}return null;}
  if(Math.abs(x)>world.fieldSpan[0]*.46||Math.abs(z)>world.fieldSpan[1]*.46)return null;
  for(const o of dominoes)if(o!==prev&&Math.hypot(o.x-x,o.z-z)<DOMINO.s*.78)return null;
  const d=makeDomino(x,z,ux,uz,prev);
  // The tile behind turns to follow the curve of the line.
  if(prev)faceDomino(prev,x-(prev.prev||prev).x,z-(prev.prev||prev).z);
  materialAudio.event(22,x,.07);state.actionCount++;return d;
}
function dominoStroke(p,prev,t){
  if(state.watch||!t)return;
  if(prev===null){
    const hit=dominoAtScreen(p.sx,p.sy);
    if(hit){t.dominoMode='push';tipDomino(hit,2.3+state.contact*1.8);return;}
    t.dominoMode='draw';t.dominoFrom={x:p.x,z:p.z};
    t.dominoLast=dominoes.find(d=>!d.next&&d.a===0&&d.rise<0&&Math.hypot(d.x-p.x,d.z-p.z)<.5)||null;
    return;
  }
  if(t.dominoMode==='push'){
    // A sweep through a line tips whatever stands in its way.
    const mx=p.x-prev.x,mz=p.z-prev.z,ml=Math.hypot(mx,mz);if(ml<.002)return;
    const hit=dominoAtScreen(p.sx,p.sy);if(hit&&(mx*hit.dx+mz*hit.dz)/ml>-.2)tipDomino(hit,2.2+Math.min(2,ml*30));
    return;
  }
  if(t.dominoMode!=='draw')return;
  let from=t.dominoLast||t.dominoFrom,ex=p.x-from.x,ez=p.z-from.z,len=Math.hypot(ex,ez),guard=0;
  while(guard++<40&&(t.dominoLast?len>=DOMINO.s:len>=DOMINO.s*.55)){
    const ux=ex/len,uz=ez/len,last=t.dominoLast;
    const placed=last?placeDomino(last.x+ux*DOMINO.s,last.z+uz*DOMINO.s,ux,uz,last):placeDomino(from.x,from.z,ux,uz,null);
    if(!placed){t.dominoLast=null;t.dominoFrom={x:p.x,z:p.z};return;}
    t.dominoLast=placed;from=placed;ex=p.x-from.x;ez=p.z-from.z;len=Math.hypot(ex,ez);
  }
}
function stepDominoes(dt){
  const sub=Math.max(1,Math.min(8,Math.ceil(dt*240))),h=dt/sub;let moving=0,settled=0;
  for(let k=0;k<sub;k++)for(const d of dominoes){
    if(d.rise>=0){
      if(d.rise>0){d.rise=Math.max(0,d.rise-h);continue;}
      d.a=Math.max(0,d.a-h*7);d.w=0;if(k===0)moving++;
      if(d.a===0){d.rise=-1;if(settled++<2)materialAudio.event(22,d.x,.05);}
      continue;
    }
    if(d.a<=0&&d.w<=0){d.a=0;d.w=0;continue;}
    d.w+=DOMINO.k*Math.sin(d.a-DOMINO_BETA)*h;d.w*=1-.35*h;d.a+=d.w*h;
    if(d.a<=0){d.a=0;d.w=0;continue;}
    const n=d.next&&d.next.rise<0?d.next:null,lim=n?dominoLimit(d,n):Math.PI/2;
    if(d.a>=lim){
      d.a=lim;
      if(n&&lim<Math.PI/2){
        // A real hit topples a standing tile; a tile still catching up pushes; a resting lean just rests.
        if(n.a===0&&n.w===0){if(d.w>.25){n.w=d.w*.88+.7;d.w*=.3;materialEvent(22,n.x,clamp(.1+n.w*.045,.1,.55));}}
        else if(d.w>n.w+.6)n.w+=(d.w-n.w)*.5;
        d.w=Math.max(0,Math.min(d.w,n.w));
      }else{if(d.w>2.2)materialAudio.event(22,d.x,Math.min(.3,d.w*.03));d.w=0;}
    }
    if(k===0&&Math.abs(d.w)>.05)moving++;
  }
  state.dominoMoving=moving;
  if(!state.watch)return;
  // Hands-free: tip the next standing line; once everything lies flat, stand it all back up.
  state.dominoIdle=moving?0:state.dominoIdle+dt;
  if(state.dominoIdle>1.1){
    const head=dominoes.find(d=>d.a===0&&d.rise<0&&(!d.prev||d.prev.a>.2));
    if(head){tipDomino(head,2.6);state.dominoIdle=0;}
    else if(state.dominoIdle>2.6){standDominoesUp();state.dominoIdle=0;}
  }
}
function drawDominoes(){
  surface(8,color('#76563d'),0,[.3,0]);
  const D=DOMINO,pal=state.palette%3,body=pal===2?color('#252b2e'):color('#ece3cf'),line=pal===2?color('#e6dec8'):color('#3b3631');
  for(const d of dominoes){
    const ca=Math.cos(d.a),sa=Math.sin(d.a),f=D.t*.5*(1-ca)+D.h*.5*sa,y=D.h*.5*ca+D.t*.5*sa,cx=d.x+d.dx*f,cz=d.z+d.dz*f,q=dominoQuat(d.yaw,d.a);
    add(G.box,20,pal===1?d.rainbow:body,[cx,y,cz],[D.w,D.h,D.t],q,[.2,0],true);
    add(G.block,15,line,[cx,y,cz],[D.w*.8,.014,D.t*1.06],q,[.3,0],false);
  }
}

function resetScene(show=false){field.fill(0);velocity.fill(0);particles=[];curls=[];soapRibbons=[];dropList=[];fieldFrame=0;state.localTime=0;state.cutPhase=0;state.cutCount=0;state.reform=0;state.tool=false;state.soapCount=0;state.soapPhase=0;state.lastDrop=-1;state.lastPop=-1;state.lastGrain=-1;state.lastInk=0;state.coat=0;state.candyY=1.1;state.candyX=0;state.candyZ=0;state.candyDrip=0;state.painted=0;state.peeled=0;state.waxPool=.18;state.melt=0;state.leafCrush=0;state.resinFill=0;state.sortedCount=0;lastActive=null;autoPrevious=null;touches.clear();endTouchUI();world.heightScale=1.5;
 slices=Array.from({length:24},(_,i)=>({i,cut:false,age:0,amount:0}));
 initBubbles();initBeads();initStreams();initLeaves();initResin();initSorting();initDominoes();state.dominoIdle=0;state.dominoMoving=0;state.dominoFullNotice=false;const num=Math.max(5,Math.ceil(world.fieldSpan[0]/.92));peelLanes=Array.from({length:num},(_,i)=>({x:(i-(num-1)/2)*world.fieldSpan[0]/num,width:world.fieldSpan[0]/num,start:0,end:0,progress:0,active:false,released:0,complete:false}));
 if(state.scene===11)fillDye([222,221,204],0);
 if(state.scene===6||state.scene===13){initInk();if(state.scene===13){for(let i=0;i<N*N;i++)for(let k=0;k<3;k++)dye[i*4+k]=Math.round(dye[i*4+k]*.42+[228,202,191][k]*.58);}inkF.set(dye);fluid=new FlowSolver(80);inkStep=0;}
 if(state.scene===7){const sx=world.fieldSpan[0],sz=world.fieldSpan[1];for(let j=0;j<N;j++)for(let i=0;i<N;i++){let x=(i/(N-1)-.5)*sx,z=(j/(N-1)-.5)*sz,r=Math.hypot(x+1,z+.2);field[j*N+i]=.022*Math.sin(r*46.)*Math.exp(-Math.pow((r-2.4)/1.65,6));}}
 if(state.scene===3||state.scene===18){ripple(-.8,.2,.11,.2);ripple(.7,-.7,.08,.15);}if(state.scene===17){ripple(0,0,.04,.12);}
 fieldDirty=true;dyeDirty=true;syncUI();if(show)notify('A fresh surface.');}
function selectScene(i){if(!scenes[i])return;state.scene=i;state.palette=0;state.tourTime=0;state.down=false;state.pointer=null;state.paused=false;state.smoothedSpeed=0;configureCamera();resetScene();resize();closeDialogs();materialAudio.motion(i,0,0,0);$('#hint').style.opacity='1';}
function selectNext(direction=1){const pos=order.indexOf(state.scene);selectScene(order[(pos+direction+order.length)%order.length]);}
function ripple(x,z,amount=.1,r=.21){const sx=world.fieldSpan[0],sz=world.fieldSpan[1],rx=(x/sx+.5)*(N-1),rz=(z/sz+.5)*(N-1),rxp=r/sx*N,rzp=r/sz*N;for(let j=Math.max(1,Math.floor(rz-rzp*2.5));j<Math.min(N-1,rz+rzp*2.5);j++)for(let i=Math.max(1,Math.floor(rx-rxp*2.5));i<Math.min(N-1,rx+rxp*2.5);i++){let d=((i-rx)/rxp)**2+((j-rz)/rzp)**2;field[j*N+i]+=(1-d)*Math.exp(-d)*amount;}fieldDirty=true;}
function waveStep(dt){fieldFrame+=dt;let count=0;const damping=state.scene===10?.956:state.scene===8||state.scene===9?.978:.993;while(fieldFrame>=1/90&&count<5){fieldFrame-=1/90;count++;for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){const k=j*N+i;velocity[k]=(velocity[k]+(field[k-1]+field[k+1]+field[k-N]+field[k+N]-4*field[k])*.225)*damping;}for(let k=0;k<field.length;k++)field[k]=clamp(field[k]+velocity[k],-.58,.58);fieldDirty=true;}}
function stepWater(dt,active,p){waveStep(dt);if(active&&p&&state.localTime-state.lastDrop>.33){state.lastDrop=state.localTime;ripple(p.x,p.z,.055*state.contact,.2);materialEvent(3,p.x,.28);}
 if(state.tool){fallAccumulator+=dt;while(fallAccumulator>.18){fallAccumulator-=.18;const x=(random()-.5)*cam.width,z=(random()-.5)*cam.height;ripple(x,z,.055,.1);dropList.push({x,z,age:0});if(random()>.7)materialAudio.event(3,x,.13);}}
 for(const d of dropList)d.age+=dt;dropList=dropList.filter(d=>d.age<.65);}
function drawWater(){surface(5,chooseColor(),.04);for(let d of dropList){let t=d.age;if(t<.18)ball(4,color('#bfebe3'),[d.x,.09+Math.sin(t/.18*Math.PI)*.3,d.z],[.035,.055,.035]);}
 // A few small floating leaves establish surface depth without framing it.
 for(let i=0;i<4;i++){let x=Math.sin(i*7.3)*cam.width*.36,z=Math.cos(i*3.4)*cam.height*.34,y=.052+field[indexAt(x,z)];add(G.sphere,15,color(i%2?'#bda766':'#6c9161'),[x,y,z],[.065,.018,.18],quat(0,i*2.3+Math.sin(state.time*.07)*.1,0),[.5,0],false);}}
function drawBubbles(){surface(4,chooseColor().map(x=>x*.6),-.045,[.1,0]);const c=chooseColor();for(const b of bubbleList){add(G.ring,4,c.map(x=>x*.8),[b.x,.025,b.z],[.345,.5,.345]);add(G.dome,4,b.popped?c.map(x=>x*.7):c,[b.x,.025,b.z],[.315,b.value*.255,.315]);}}
function popBubble(b){if(!b||b.popped)return;b.popped=true;b.vel=-10;b.age=0;materialEvent(2,b.x,.7+.25*state.contact);}
function stepBubbles(dt,active,p){if(active&&p)popAt(p);if(state.watch&&state.localTime-state.lastPop>.19){state.lastPop=state.localTime;const b=bubbleList.find(b=>!b.popped&&Math.abs(b.x)<cam.width*.42&&Math.abs(b.z)<cam.height*.34);if(b)popBubble(b);else if(state.localTime>2){initBubbles();}}for(const b of bubbleList){b.age+=dt;const target=b.popped?-.10:1;b.vel+=(target-b.value)*175*dt;b.vel*=Math.exp(-17*dt);b.value=clamp(b.value+b.vel*dt,-.2,1.1);}}
function stepClay(dt,active,p){if(active&&p){clayStamp(p.x,p.z,state.tool?.60:.39+state.contact*.14,dt*55*state.contact,state.tool);if(state.localTime-state.lastClay>.5){state.lastClay=state.localTime;materialEvent(4,p.x,.35);}}}
function drawClay(){surface(6,chooseColor(),.025,[.9,1]);}
function combStamp(x,z,a,smooth=false){const sx=world.fieldSpan[0],sz=world.fieldSpan[1],r=.83;const c=Math.cos(a),s=Math.sin(a);const ix=(x/sx+.5)*N,iz=(z/sz+.5)*N,rx=r/sx*N,rz=r/sz*N;for(let j=Math.max(1,Math.floor(iz-rz));j<Math.min(N-1,iz+rz);j++)for(let i=Math.max(1,Math.floor(ix-rx));i<Math.min(N-1,ix+rx);i++){const dx=(i/(N-1)-.5)*sx-x,dz=(j/(N-1)-.5)*sz-z,k=j*N+i;if(smooth){const d=Math.hypot(dx,dz)/r;if(d<1)field[k]*=1-(1-d*d)*.36;}else{const across=dx*c-dz*s,along=dx*s+dz*c;if(Math.abs(across)>.66||Math.abs(along)>.145)continue;const near=clamp(Math.round(across/.14),-4,4)*.14,dd=across-near,profile=(.022-.078*Math.exp(-dd*dd/.00068))*(.8+state.contact*.3),fade=(1-clamp((Math.abs(across)-.57)/.09,0,1))*Math.exp(-along*along/.009);field[k]=lerp(field[k],profile,fade*.9);}}fieldDirty=true;}
function drawComb(p,active){surface(1,chooseColor(),.02,[.94,1]);if(!p)return;if(state.tool){ball(15,C.ivory,[p.x,.18,p.z],[.57,.16,.49]);return;}const a=state.angle,q=quat(0,a,0),c=C.wood;const off=(x,y,z)=>[p.x+x*Math.cos(a)+z*Math.sin(a),y,p.z-x*Math.sin(a)+z*Math.cos(a)];box(8,c,off(0,.22,0),[1.40,.14,.15],q);for(let k=-4;k<=4;k++)box(8,c,off(k*.14,.10,-.02),[.033,.25,.041],q,false);add(G.cylinder,8,c,off(0,.49,.75),[.045,1.57,.045],quat(1.23,a,0));}
function stepBeads(dt,active,p){const t=Math.min(dt,1/45)*60;const points=state.watch&&p?[p]:[...touches.values()];for(const b of beads){let fx=(b.hx-b.x)*.006,fz=(b.hz-b.z)*.006;for(const p of points){const dx=p.x-b.x,dz=p.z-b.z,d2=dx*dx+dz*dz,f=.030*Math.exp(-d2/3.7)*state.contact;fx+=dx*f-dz*f*.17;fz+=dz*f+dx*f*.17;}b.vx=(b.vx+fx*t)*Math.pow(.83,t);b.vz=(b.vz+fz*t)*Math.pow(.83,t);b.x+=b.vx*t;b.z+=b.vz*t;b.x=clamp(b.x,-world.fieldSpan[0]*.495,world.fieldSpan[0]*.495);b.z=clamp(b.z,-world.fieldSpan[1]*.495,world.fieldSpan[1]*.495);}
 const bins=new Map(),size=(beads[0]?.r||.16)*2.1;for(const b of beads){const key=Math.floor(b.x/size)+','+Math.floor(b.z/size);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(b);}for(let pass=0;pass<3;pass++)for(const a of beads){const gx=Math.floor(a.x/size),gz=Math.floor(a.z/size);for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const near=bins.get((gx+x)+','+(gz+z));if(!near)continue;for(const b of near){if(a===b)continue;let dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;if(d2<(a.r+b.r)**2&&d2>.00001){const d=Math.sqrt(d2),push=(a.r+b.r-d)*.28;a.x-=dx/d*push;a.z-=dz/d*push;b.x+=dx/d*push;b.z+=dz/d*push;}}}}
 if(active&&state.localTime-state.lastGrain>.11){state.lastGrain=state.localTime;materialEvent(5,p?.x||0,.26);}}
function drawBeads(){surface(15,color('#234637'),-.04,[.65,0]);const c=chooseColor();for(const b of beads)add(G.small,2,c.map(v=>v*(.85+b.hue*.28)),[b.x,.165,b.z],[b.r,b.r,b.r],[0,0,0,1],[.15,0]);}
/* A stable, incompressible 2D velocity field. The pressure pass removes divergence. */
class FlowSolver{
 constructor(n){this.n=n;this.u=new Float32Array(n*n);this.v=new Float32Array(n*n);this.u2=new Float32Array(n*n);this.v2=new Float32Array(n*n);this.p=new Float32Array(n*n);this.p2=new Float32Array(n*n);this.div=new Float32Array(n*n);this.curl=new Float32Array(n*n);}
 sample(f,x,y){const n=this.n;x=clamp(x,0,n-1.001);y=clamp(y,0,n-1.001);const i=Math.floor(x),j=Math.floor(y),a=x-i,b=y-j,k=j*n+i;return lerp(lerp(f[k],f[k+1],a),lerp(f[k+n],f[k+n+1],a),b);}
 splat(x,z,dx,dz,power=1){const n=this.n,px=(x/world.fieldSpan[0]+.5)*n,py=(z/world.fieldSpan[1]+.5)*n,r=6;for(let y=Math.max(1,Math.floor(py-r*2));y<Math.min(n-1,py+r*2);y++)for(let x=Math.max(1,Math.floor(px-r*2));x<Math.min(n-1,px+r*2);x++){const d=((x-px)**2+(y-py)**2)/(r*r),a=Math.exp(-d)*power,k=y*n+x;this.u[k]+=clamp(dx*110,-25,25)*a;this.v[k]+=clamp(dz*110,-25,25)*a;}}
 step(dt){const n=this.n,u=this.u,v=this.v;dt=Math.min(dt,.05);for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;this.curl[k]=.5*(v[k+1]-v[k-1]-u[k+n]+u[k-n]);}
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i,dx=Math.abs(this.curl[k+1])-Math.abs(this.curl[k-1]),dy=Math.abs(this.curl[k+n])-Math.abs(this.curl[k-n]),len=Math.hypot(dx,dy)+.001;u[k]+=dy/len*this.curl[k]*dt*5;v[k]-=dx/len*this.curl[k]*dt*5;}
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;this.u2[k]=this.sample(u,i-u[k]*dt,j-v[k]*dt)*.995;this.v2[k]=this.sample(v,i-u[k]*dt,j-v[k]*dt)*.995;}
  this.u=this.u2;this.u2=u;this.v=this.v2;this.v2=v;const U=this.u,VV=this.v;this.p.fill(0);
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;this.div[k]=-.5*(U[k+1]-U[k-1]+VV[k+n]-VV[k-n]);}
  for(let pass=0;pass<14;pass++){for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;this.p2[k]=(this.div[k]+this.p[k-1]+this.p[k+1]+this.p[k-n]+this.p[k+n])*.25;}const q=this.p;this.p=this.p2;this.p2=q;}
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;U[k]-=.5*(this.p[k+1]-this.p[k-1]);VV[k]-=.5*(this.p[k+n]-this.p[k-n]);}
 }
}
function addInk(p){const ix=(p.x/world.fieldSpan[0]+.5)*N,iz=(p.z/world.fieldSpan[1]+.5)*N,c=rgb8(scenes[state.scene].colors[state.palette]);for(let j=Math.max(1,Math.floor(iz-7));j<Math.min(N-1,iz+7);j++)for(let i=Math.max(1,Math.floor(ix-7));i<Math.min(N-1,ix+7);i++){const a=Math.exp(-((i-ix)**2+(j-iz)**2)/24)*.33;for(let ch=0;ch<3;ch++)inkF[(j*N+i)*4+ch]=lerp(inkF[(j*N+i)*4+ch],c[ch],a);}dyeDirty=true;}
function stepInk(dt,active,p){if(!fluid)return;inkStep+=dt;if(inkStep<1/30)return;const ds=Math.min(inkStep,.06);inkStep=0;fluid.step(ds);const ratio=fluid.n/N;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,u=fluid.sample(fluid.u,i*ratio,j*ratio)/ratio,v=fluid.sample(fluid.v,i*ratio,j*ratio)/ratio;const flow=state.scene===13?.2:.07;const x=i-u*ds+Math.sin(j*.018+state.time*.12)*flow*ds,y=j-v*ds;for(let ch=0;ch<3;ch++)inkA[k*4+ch]=inkSample(inkF,x,y,ch);inkA[k*4+3]=255;}const old=inkF;inkF=inkA;inkA=old;if(active&&p&&(state.tool||state.watch)&&state.localTime-state.lastInk>.09){state.lastInk=state.localTime;addInk(p);}for(let k=0;k<dye.length;k++)dye[k]=Math.round(inkF[k]);dyeDirty=true;}
function drawInk(){surface(7,chooseColor(),.02,[.14,0]);}
function stepFalls(dt,active,p){waveStep(dt);const fall=state.scene===8,speed=state.tool?.55:1;const points=state.watch&&p?[p]:[...touches.values()];
 for(const q of streams){q.z+=q.speed*dt*speed;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=Math.exp(-dt*2.8);q.vy-=q.free?dt*3:0;if(q.y<.07){q.y=.07;q.vy=0;q.free=false;}
  for(const t of points){let dx=q.x-t.x,dz=q.z-t.z,r=.35+state.contact*.15;if(Math.abs(dz)<r&&Math.abs(dx)<r){const side=dx<0?-1:1;q.vx+=side*dt*19;q.x=t.x+side*(r-Math.abs(dz)*.35);q.y+=dt*.9;q.vy=.35+random()*.4;q.free=true;if(random()<.012)materialEvent(state.scene,t.x,.22);}}
  if(q.z>world.fieldSpan[1]*.52||Math.abs(q.x)>world.fieldSpan[0]*.56){q.z=-world.fieldSpan[1]*.52-random()*.4;q.x=(random()-.5)*(fall?world.fieldSpan[0]:(state.tool?.63:.28));q.y=.07;q.vx=0;q.vy=0;q.free=false;}}
 if(active&&p&&state.localTime-state.lastDrop>.12){state.lastDrop=state.localTime;ripple(p.x,p.z,.08,.35);materialEvent(state.scene,p.x,.2);}}
function drawFalls(){const fall=state.scene===8,c=chooseColor();if(fall)surface(12,c,.025,[.05,1]);else{surface(20,color('#c6d5c7'),-.03,[.2,0]);const width=state.tool?.72:.4;add(G.full,12,c,[0,.04,0],[width,1,world.fieldSpan[1]],[0,0,0,1],[.05,1],false);
 const z=-cam.height*.42;add(G.cylinder,2,color('#d7e4dd'),[0,.49,z],[.31,.8,.31],quat(Math.PI/2,0,0),[.10,0]);add(G.thickRing,2,color('#d0d4cd'),[0,.49,z+.41],[.31,1,.31],quat(Math.PI/2,0,0),[.08,0]);add(G.cylinder,2,color('#a8beb4'),[0,.44,z-.62],[.20,1.15,.20],quat(Math.PI/2,0,0),[.16,0]);}
 for(const q of streams){add(G.small,4,c.map(v=>v*1.5+.09),[q.x,q.y,q.z],[q.r,q.r*.6,q.length],[0,0,0,1],[.07,0],false);}const points=state.watch&&activePoint?[activePoint]:[...touches.values()];for(const p of points){if(state.down||state.watch){for(let k=0;k<7;k++){let a=k/7*TAU;ball(4,c.map(v=>v*1.3),[p.x+Math.cos(a)*.4,.1+Math.sin(state.time*8+k)*.045,p.z+Math.sin(a)*.38],[.018,.014,.056]);}}}}
function stepChocolate(dt,active,p){waveStep(dt);const targetY=active&&p?clamp(1.0-p.z*.56,-.44,1.65):1.22;const prevY=state.candyY;state.candyY=lerp(state.candyY,targetY,1-Math.exp(-dt*10));state.candyX=lerp(state.candyX,p?.x||0,1-Math.exp(-dt*12));state.candyZ=lerp(state.candyZ,(p?.z||0)*.40,1-Math.exp(-dt*12));
 const immersed=clamp((.47-state.candyY)/.9,0,1);state.coat=Math.max(state.coat,immersed);if(immersed>.05&&state.localTime-state.lastDrop>.16){state.lastDrop=state.localTime;ripple(state.candyX,state.candyZ,.043,.42);materialEvent(10,state.candyX,.36+immersed*.25);}
 if(prevY<state.candyY&&state.coat>.1){state.candyDrip=Math.min(1.0,state.candyDrip+dt*.8);if(state.localTime-state.lastGrain>.27){state.lastGrain=state.localTime;particles.push({x:state.candyX+(random()-.5)*.45,z:state.candyZ+(random()-.5)*.35,y:state.candyY-.48,vx:0,vz:0,vy:-.2,r:.035+random()*.028,age:0,life:.8,c:chooseColor()});materialAudio.event(10,state.candyX,.15);}}else state.candyDrip*=Math.exp(-dt*3);}
function drawChocolate(){surface(13,chooseColor(),.025,[.05,1]);const x=state.candyX,y=state.candyY,z=state.candyZ;
 // The candy coating follows the maximum immersion depth.
 add(G.box,18,color('#f5e6c7'),[x,y,z],[.96,.9,.96],quat(0,.23,0),[state.coat,y]);add(G.cylinder,8,color('#c9ad77'),[x,y+1.20,z],[.045,1.75,.045],quat(.05,0,0),[.8,0]);
 if(state.coat>.12&&y>.5&&state.candyDrip>.06){const len=Math.max(.02,y-.43);for(let i=0;i<3;i++){const dx=(i-1)*.28,rr=.015*(1.25-state.candyDrip*.6);add(G.cylinder,13,chooseColor(),[x+dx,.035+len*.5,z+.1*Math.sin(i)],[rr,len,rr],[0,0,0,1],[.05,0],false);ball(13,chooseColor(),[x+dx,.03,z+.1*Math.sin(i)],[.065,.022,.065]);}}}
function paintStamp(x,z,strength=1){const sx=world.fieldSpan[0],sz=world.fieldSpan[1],width=1.34,r=.2,c=rgb8(scenes[11].colors[state.palette]);const ix=(x/sx+.5)*N,iz=(z/sz+.5)*N,rx=width*.5/sx*N,rz=r/sz*N;for(let j=Math.max(0,Math.floor(iz-rz));j<Math.min(N,iz+rz);j++)for(let i=Math.max(0,Math.floor(ix-rx));i<Math.min(N,ix+rx);i++){const dx=Math.abs((i-ix)/rx),dz=Math.abs((j-iz)/rz),edge=clamp((1-dx)*22,0,1)*clamp((1-dz)*7,0,1);const a=edge*(.65+state.contact*.28)*strength,k=(j*N+i)*4;for(let ch=0;ch<3;ch++)dye[k+ch]=Math.round(lerp(dye[k+ch],c[ch],a));dye[k+3]=Math.min(255,dye[k+3]+a*180);state.painted++;}dyeDirty=true;}
function drawPaint(p){surface(14,color('#d3d3bf'),.02,[.5,0]);if(!p)p={x:cam.width*.18,z:1.5};const c=chooseColor();const roll=p.z*3.8;add(G.cylinder,19,c,[p.x,.23,p.z],[.21,1.41,.21],quat(roll,0,Math.PI/2),[.9,0]);for(const dx of[-.735,.735])ball(2,C.steel,[p.x+dx,.23,p.z],[.08,.085,.085],[.2,0]);box(2,C.steel,[p.x+.8,.20,p.z+.32],[.055,.07,.69]);box(2,C.steel,[p.x+.42,.20,p.z+.65],[.79,.06,.055]);box(2,C.steel,[p.x+.04,.20,p.z+1.0],[.055,.06,.72]);add(G.cylinder,15,color('#d9d3b7'),[p.x+.04,.25,p.z+1.55],[.13,.82,.13],quat(Math.PI/2,0,0),[.65,0]);}
function peelStart(p,t){const lane=peelLanes.reduce((best,l)=>Math.abs(l.x-p.x)<Math.abs(best.x-p.x)?l:best,peelLanes[0]);if(lane.complete){lane.start=p.z-.15;lane.end=lane.start;lane.progress=0;lane.complete=false;}if(lane.progress<.01){lane.start=clamp(p.z-.15,-world.fieldSpan[1]*.48,world.fieldSpan[1]*.39);lane.end=lane.start;lane.progress=.02;}lane.active=true;lane.released=0;t.lane=lane;}
function peelMove(p,t,dx,dz){if(!t.lane)peelStart(p,t);const l=t.lane;if(dz>0){const add=Math.min(dz*.96,.4);l.end=clamp(l.end+add,l.start,world.fieldSpan[1]*.52);l.progress=l.end-l.start;state.peeled+=add;state.actionCount++;if(state.localTime-state.lastGrain>.055){state.lastGrain=state.localTime;materialEvent(12,p.x,.27+Math.min(1,dz*9));}}}
function stepPeel(dt){for(const l of peelLanes){if(!l.active&&l.progress>.01)l.released=Math.min(.9,l.released+dt*.15);if(l.end>=world.fieldSpan[1]*.5)l.complete=true;}}
function drawPeel(){surface(15,color('#a47f72'),-.035,[.7,0]);const c=chooseColor(),half=world.fieldSpan[1]*.53;for(const l of peelLanes){const shade=1+Math.sin(l.x*9.)*.018,col=c.map(x=>x*shade);if(l.progress<.01){box(15,col,[l.x,.015,0],[l.width*.993,.06,half*2],undefined,false);continue;}if(l.start>-half){const len=l.start+half;box(15,col,[l.x,.015,-half+len*.5],[l.width*.993,.06,len],undefined,false);}if(l.end<half){const len=half-l.end;box(15,col,[l.x,.015,l.end+len*.5],[l.width*.993,.06,len],undefined,false);}const len=clamp(l.progress,.05,8.8);add(G.longRibbon,16,col,[l.x,.056,l.end],[l.width*.988,1,1],[0,0,0,1],[len,l.released]);}}
function peelVariantBase(baseColor,sheetColor,edgeColor,accent){const half=world.fieldSpan[1]*.53;surface(20,baseColor,-.05,[.25,0]);box(2,edgeColor,[0,-.02,0],[world.fieldSpan[0]*.97,.03,world.fieldSpan[1]*.97],undefined,false);if(accent)accent();for(const l of peelLanes){const col=sheetColor.map(v=>Math.min(1,v*(.985+Math.sin(l.x*6.)*.025)));if(l.progress<.01){box(15,col,[l.x,.014,0],[l.width*.99,.048,half*2],undefined,false);continue;}if(l.start>-half){const len=l.start+half;box(15,col,[l.x,.014,-half+len*.5],[l.width*.99,.048,len],undefined,false);}if(l.end<half){const len=half-l.end;box(15,col,[l.x,.014,l.end+len*.5],[l.width*.99,.048,len],undefined,false);}const len=clamp(l.progress,.05,8.8);add(G.longRibbon,16,col,[l.x,.06,l.end],[l.width*.986,1,1],[0,0,0,1],[len,l.released]);}}
function drawGluePeel(){const sheet=chooseColor();peelVariantBase(color('#d5e3ea'),sheet,color('#97adb7'),()=>{box(2,color('#eaf4f7'),[0,.004,0],[world.fieldSpan[0]*.86,.006,world.fieldSpan[1]*.86],undefined,false);for(let i=-2;i<=2;i++)ball(5,color('#ffffff'),[i*world.fieldSpan[0]*.14,.028,-world.fieldSpan[1]*.18],[.09,.018,.05],[.1,0]);});}
function drawProtectivePeel(){const film=chooseColor();peelVariantBase(color('#111c22'),film,color('#314550'),()=>{box(2,color('#dfe8ed'),[0,.00,0],[world.fieldSpan[0]*.77,.08,world.fieldSpan[1]*.70],undefined,false);box(2,color('#8ea3b1'),[0,.034,0],[world.fieldSpan[0]*.66,.018,world.fieldSpan[1]*.58],undefined,false);box(2,color('#ffffff'),[-world.fieldSpan[0]*.18,.05,-world.fieldSpan[1]*.16],[world.fieldSpan[0]*.20,.004,world.fieldSpan[1]*.18],undefined,false);});}
function drawTapePeel(){const paint=chooseColor(),tape=color('#e6dcc1');surface(14,color('#ddd8ce'),-.03,[.5,0]);for(const l of peelLanes){box(15,paint,[l.x,.006,0],[l.width*.78,.03,world.fieldSpan[1]*.95],undefined,false);}const half=world.fieldSpan[1]*.53;for(const l of peelLanes){if(l.progress<.01){box(15,tape,[l.x,.015,0],[l.width*.99,.052,half*2],undefined,false);continue;}if(l.start>-half){const len=l.start+half;box(15,tape,[l.x,.015,-half+len*.5],[l.width*.99,.052,len],undefined,false);}if(l.end<half){const len=half-l.end;box(15,tape,[l.x,.015,l.end+len*.5],[l.width*.99,.052,len],undefined,false);}const len=clamp(l.progress,.05,8.8);add(G.longRibbon,16,tape,[l.x,.06,l.end],[l.width*.986,1,1],[0,0,0,1],[len,l.released]);}}
function stepWax(dt,active,p){waveStep(dt);if(active&&p){state.waxPool=clamp(state.waxPool+dt*.15*(.5+state.contact),.18,1);if(state.localTime-state.lastDrop>.24){state.lastDrop=state.localTime;ripple(p.x,p.z,.04*state.contact,.10);materialEvent(17,p.x,.22);}}else state.waxPool=Math.max(.16,state.waxPool-dt*.015);}
function drawWax(){surface(13,chooseColor(),.018,[.05,1]);const c=chooseColor();const r=1.4+state.waxPool*1.8;for(let i=0;i<4;i++){const ox=[-1.2,.9,-.3,1.55][i],oz=[-.6,.2,.9,-.9][i],rr=r*[.55,.44,.36,.28][i];add(G.cylinder,13,c.map(v=>v*(1.02-i*.04)),[ox,.06,oz],[rr,.09,rr],[0,0,0,1],[.9,0]);ball(5,color('#fff7eb'),[ox-rr*.18,.12,oz-rr*.12],[rr*.18,rr*.06,rr*.10],[.1,0]);}add(G.cylinder,15,color('#efe3cb'),[-world.fieldSpan[0]*.18,.46,-world.fieldSpan[1]*.23],[.45,1.35,.45],[0,0,0,1],[.8,0]);box(8,color('#423126'),[-world.fieldSpan[0]*.18,1.22,-world.fieldSpan[1]*.23],[.05,.19,.05]);for(let i=0;i<3;i++)ball(13,c,[ -world.fieldSpan[0]*.18+.12*i,.17-.03*i,-world.fieldSpan[1]*(.18-.02*i)],[.16-.02*i,.05,.13-.02*i],[.05,0]);}
function stepIce(dt,active,p){waveStep(dt);if(active&&p){state.melt=clamp(state.melt+dt*.16*(.45+state.contact),0,1);if(state.localTime-state.lastDrop>.22){state.lastDrop=state.localTime;ripple(p.x,p.z,.05*state.contact,.18);materialEvent(18,p.x,.20);}}else state.melt=Math.max(0,state.melt-dt*.004);}
function drawIceMelt(){surface(5,chooseColor(),.02,[.05,1]);const cubes=[[-1.25,-.8,.0],[0.0,.0,.12],[1.3,.7,.22],[-.2,1.0,.08],[1.65,-.55,.18]];for(let i=0;i<cubes.length;i++){const [x,z,rot]=cubes[i],m=clamp(state.melt*(.65+i*.08),0,.9),sx=lerp(.85,.34,m),sy=lerp(.45,.12,m),sz=lerp(.85,.34,m);box(2,color('#dffbff'),[x,.10+sy*.5,z],[sx,sy,sz],quat(rot,rot*.35,-rot*.12),false);ball(5,color('#ffffff'),[x-sx*.16,.18+sy*.18,z-sz*.12],[sx*.14,sy*.18,sz*.12],[.1,0]);}for(let i=0;i<7;i++){const z=-world.fieldSpan[1]*.5+i*world.fieldSpan[1]/6;ball(5,color('#ffe9c2'),[-world.fieldSpan[0]*.32,.26,z],[.06,.06,.06],[.1,0]);}box(2,color('#ffdeb1'),[-world.fieldSpan[0]*.36,.25,0],[.025,.03,world.fieldSpan[1]*.9],undefined,false);}

function stepSoap(dt,active,p){for(const r of soapRibbons){r.age+=dt;if(r.released){r.drop=Math.min(.87,r.drop+dt*.23);r.y=lerp(r.y,.54,dt*.4);}}if(active&&p){const move=lastActive?Math.hypot(p.x-lastActive.x,p.z-lastActive.z):0;if(move>.003){let r=soapRibbons.at(-1);if(!r||r.released){r={x:p.x,z:p.z,y:.54,len:.02,age:0,drop:0,released:false,c:chooseColor()};soapRibbons.push(r);}r.x=p.x;r.z=p.z;r.len=Math.min(6,r.len+move*.72);if(state.localTime-state.lastGrain>.11){state.lastGrain=state.localTime;materialEvent(1,p.x,.4);}if(r.len>5.5)r.released=true;}}if(soapRibbons.length>16)soapRibbons.shift();}
function drawSoap(){const c=chooseColor();surface(3,c,.50,[.3,0]);for(const r of soapRibbons){add(G.longRibbon,16,r.c,[r.x,r.y,r.z],[.68,1,1],[0,0,0,1],[r.len,r.drop]);}const p=activePoint;if(p){box(2,C.steel,[p.x,.66,p.z+.045],[.88,.08,.23],quat(.25,0,0));box(15,color('#d7dec6'),[p.x,.86,p.z+.51],[.27,.23,.84],quat(.15,0,0));}}
function stepSandCut(dt,active,p){for(const s of slices)if(s.cut)s.age+=dt;if(!active||!p)return;const W=world.fieldSpan[0],idx=clamp(Math.floor((p.x/W+.5)*slices.length),0,slices.length-1),s=slices[idx];if(!s.cut){s.amount+=dt*(1+state.contact);state.cutPhase=s.amount;if(s.amount>.56){s.cut=true;s.age=0;state.cutCount++;materialEvent(0,p.x,.9);burst(p.x,.13,p.z,chooseColor(),26,1.2);}}else{if(state.watch&&state.cutCount>slices.length*.65)resetScene();}}
function drawSandCut(){const c=chooseColor(),W=world.fieldSpan[0],D=world.fieldSpan[1],w=W/slices.length;surface(1,c.map(v=>v*.76),-.34,[.95,0]);for(const s of slices){const x=(s.i+.5)*w-W/2;if(!s.cut){box(11,c,[x,-.34,0],[w*.998,1.28,D],undefined,false);}else{const angle=-Math.min(.8,s.age*.45),shift=Math.min(.22,s.age*.2);for(let j=0;j<5;j++){const cc=c.map((v,k)=>v*(.70+j*.075)+(j%2?.025:0)),dy=(j-2)*.255;box(11,cc,[x+Math.sin(-angle)*dy+shift,-.34+Math.cos(angle)*dy-.14,Math.min(.75,s.age*.4)],[w*.965,.26,D],quat(0,0,angle),false);}}}if(activePoint){const p=activePoint,idx=clamp(Math.floor((p.x/W+.5)*slices.length),0,slices.length-1),s=slices[idx],x=(idx+.5)*w-W/2,y=1.22-Math.min(1,s.amount/.56)*1.0;box(2,C.steel,[x,y,p.z],[.032,1.15,2.1],undefined,false);box(8,C.handle,[x,y+.67,p.z+.52],[.18,.28,1.48]);}}
function autoPoint(t){const width=cam.width*.35,height=cam.height*.30;switch(state.scene){case 0:{let s=slices.find(s=>!s.cut&&Math.abs((s.i+.5)*world.fieldSpan[0]/slices.length-world.fieldSpan[0]/2)<width);return{x:s?(s.i+.5)*world.fieldSpan[0]/slices.length-world.fieldSpan[0]/2:0,z:Math.sin(t*.4)};}case 2:{const b=bubbleList.find(b=>!b.popped&&Math.abs(b.x)<width&&Math.abs(b.z)<height);return b?{x:b.x,z:b.z}:{x:0,z:0};}case 9:return{x:Math.sin(t*.7)*.7,z:Math.sin(t*.46)*1.5};case 10:return{x:Math.sin(t*.26)*Math.min(width,1.4),z:1.2-Math.cos(t*.72)*2.0};case 11:{const cycle=t%18,row=Math.floor(cycle/3);return{x:-width*.5+row*width*.26,z:((row%2)?1:-1)*Math.cos((cycle%3)/3*Math.PI)*height*.72};}case 12:case 14:case 15:case 16:{const cycle=t%24,row=Math.floor(cycle/4);return{x:(row-2.5)*Math.min(.63,width/3),z:-height+(cycle%4)*height*.52};}case 17:return{x:Math.sin(t*.32)*width*.28,z:Math.sin(t*.43)*height*.32};case 18:return{x:Math.sin(t*.44)*width*.22,z:Math.cos(t*.38)*height*.2};case 19:return{x:Math.sin(t*.52)*width*.48,z:Math.cos(t*.67)*height*.42};case 20:{const idx=Math.floor(t*1.3)%Math.max(1,resinCracks.length);const n=resinCracks[idx]||{x:0,z:0};return{x:n.x,z:n.z};}case 21:return{x:Math.sin(t*.34)*width*.65,z:Math.sin(t*.59)*height*.40};case 22:{const d=dominoes.find(d=>d.w>.4)||dominoes.find(d=>d.a===0&&d.rise<0)||{x:0,z:0};return{x:d.x,z:d.z};}default:return{x:Math.sin(t*.39)*width,z:Math.sin(t*.62)*height};}} 
function processStroke(p,prev,t,dt=.016){const dx=prev?p.x-prev.x:0,dz=prev?p.z-prev.z:0,d=Math.hypot(dx,dz);const count=Math.min(50,Math.max(1,Math.ceil(d/.035)));if(d>.001){const target=Math.atan2(-dx,-dz),diff=((target-state.angle+Math.PI)%TAU+TAU)%TAU-Math.PI;state.angle+=diff*Math.min(1,d*8);} 
 if([6,13].includes(state.scene)&&fluid)fluid.splat(p.x,p.z,dx,dz,state.contact);
 if([12,14,15,16].includes(state.scene)){peelMove(p,t,dx,dz);return;}
 if(state.scene===22){dominoStroke(p,prev,t);if(d>.005)state.actionCount++;return;}
 for(let i=1;i<=count;i++){const a=prev?{x:lerp(prev.x,p.x,i/count),z:lerp(prev.z,p.z,i/count)}:p;switch(state.scene){case 2:popAt(a);break;case 3:case 17:case 18:if(i%3===0||count<3)ripple(a.x,a.z,(prev?.012:.095)*state.contact,.14+state.contact*.10);break;case 4:clayStamp(a.x,a.z,state.tool?.68:.44,state.contact*.72,state.tool);break;case 7:combStamp(a.x,a.z,state.angle,state.tool);break;case 8:case 9:if(i%3===0||count<3)ripple(a.x,a.z,.045*state.contact,.36);break;case 11:paintStamp(a.x,a.z);break;case 19:crushLeavesAt(a.x,a.z,state.contact);break;case 20:resinStamp(a.x,a.z,state.contact);break;}}
 if(d>.005)state.actionCount++;if(state.scene===11&&d>.01&&state.localTime-state.lastGrain>.16){state.lastGrain=state.localTime;materialEvent(11,p.x,.23);}}
function step(dt){state.time+=dt;state.localTime+=dt;world.time=state.time;const active=state.watch||touches.size>0;const p=state.watch?autoPoint(state.localTime):state.pointer;activePoint=p;state.down=touches.size>0;state.contact=state.watch?.6:Math.max(.2,...[...touches.values()].map(t=>t.pressure||state.force));
 if(state.watch&&p){if(!autoPrevious)autoPrevious={x:p.x,z:p.z,pressure:.6};if([12,14,15,16].includes(state.scene)&&Math.abs(p.z-autoPrevious.z)>2){if(autoPrevious.lane)autoPrevious.lane.active=false;autoPrevious={x:p.x,z:p.z,pressure:.6};}processStroke(p,autoPrevious,autoPrevious,dt);autoPrevious.x=p.x;autoPrevious.z=p.z;}
 switch(state.scene){case 0:stepSandCut(dt,active,p);break;case 1:stepSoap(dt,active,p);break;case 2:stepBubbles(dt,active,p);break;case 3:stepWater(dt,active,p);break;case 4:if(active){const pp=state.watch?[p]:[...touches.values()];pp.forEach(q=>stepClay(dt,true,q));}break;case 5:stepBeads(dt,active,p);break;case 6:case 13:stepInk(dt,active,p);break;case 7:break;case 8:case 9:stepFalls(dt,active,p);break;case 10:stepChocolate(dt,active,p);break;case 11:if(active&&p)paintStamp(p.x,p.z,.12);break;case 12:case 14:case 15:case 16:stepPeel(dt);break;case 17:stepWax(dt,active,p);break;case 18:stepIce(dt,active,p);break;case 19:stepLeaves(dt,active,p);break;case 20:stepResin(dt,active,p);break;case 21:stepSorting(dt,active,p);break;case 22:stepDominoes(dt);break;}
 let speed=lastActive&&p?Math.hypot(p.x-lastActive.x,p.z-lastActive.z)/Math.max(dt,.001):0;state.smoothedSpeed=lerp(state.smoothedSpeed,speed,1-Math.exp(-dt*24));let motion=active?clamp(state.smoothedSpeed*.26,0,1.4):0;if(state.scene===0&&active)motion=.3+Math.sin(state.cutPhase*Math.PI)*.3;if([3,4,8,9,17,18].includes(state.scene)&&active)motion=Math.max(.16,motion);if(state.scene===9&&p&&Math.abs(p.x)>.8)motion=0;if(state.scene===10&&active)motion=Math.max(.1,(.7-state.candyY)*.35+motion*.4);if([12,14,15,16].includes(state.scene)&&active)motion=Math.max(.1,motion*.55+.12);if(state.scene===22)motion=Math.min(.55,state.dominoMoving*.04);materialAudio.motion(state.scene,motion,p?.x||0,state.contact);lastActive=p?{x:p.x,z:p.z}:null;moveParticles(dt);
 if(state.watch&&state.tour){state.tourTime+=dt/state.speed;if(state.tourTime>=45)selectNext(1);}}
function draw(){if(!bridge)return;world.mode=state.scene;batches.begin();switch(state.scene){case 0:drawSandCut();break;case 1:drawSoap();break;case 2:drawBubbles();break;case 3:drawWater();break;case 4:drawClay();break;case 5:drawBeads();break;case 6:case 13:drawInk();break;case 7:drawComb(activePoint,state.down||state.watch);break;case 8:case 9:drawFalls();break;case 10:drawChocolate();break;case 11:drawPaint(activePoint);break;case 12:drawPeel();break;case 14:drawGluePeel();break;case 15:drawProtectivePeel();break;case 16:drawTapePeel();break;case 17:drawWax();break;case 18:drawIceMelt();break;case 19:drawLeaves();break;case 20:drawResin();break;case 21:drawSorting();break;case 22:drawDominoes();break;}drawParticles();if(fieldDirty){encodeField();bridge.upload(fieldBytes,null);}if(dyeDirty){bridge.upload(null,dye);dyeDirty=false;}bridge.render(batches.used,world);state.redraw=false;}
let lastCanvasSize='';
function frame(dt){
 const raw=Math.min(dt,.06);
 try{
  handleActions(raw);
  if(!state.paused)step(raw*state.speed);
  const size=kit.canvas.width+'x'+kit.canvas.height;if(size!==lastCanvasSize){lastCanvasSize=size;state.redraw=true;}
  if(!state.paused||state.redraw)draw();
  state.frames++;
  if(game.running&&performance.now()-lastPlaceSave>8000)savePlace();
 }catch(e){if(state.errors.length<5){state.errors.push(e.message);console.error(e);}state.paused=true;notify('Something went wrong. Choose a scene or reset to continue.');}
}
function syncUI(){const s=scenes[state.scene];$('#scene-title').textContent=s.title;$('#scene-type').textContent=s.tag;$('#scene-description').textContent=s.copy;$('#hint-text').textContent=s.hint;$('#scene-count').textContent=String(order.indexOf(state.scene)+1).padStart(2,'0')+' / '+scenes.length;$('#stage').setAttribute('aria-label',s.title+'. '+s.hint);$('#watch').setAttribute('aria-pressed',state.watch);$('#watch span').textContent=state.watch?'Take control':'Just watch';$('#watch use').setAttribute('href',state.watch?'#i-hand':'#i-play');$('#interaction-label').textContent=state.watch?'HANDS-FREE · '+(state.tour?'ALL SCENES':'JUST WATCH'):'NO SCORE. NO RUSH.';$('#tool').hidden=!s.tool;$('#tool').textContent=s.tool||'';$('#tool').setAttribute('aria-pressed',state.tool);$('#tour').setAttribute('aria-pressed',state.tour);document.body.classList.toggle('hide-on-touch',state.autoHide);document.body.classList.toggle('light-scene',[0,1,2,4,7,9,11,12,13,14,15,16,17,18,19,20,21].includes(state.scene));$$('.scene-card').forEach(b=>{const active=+b.dataset.scene===state.scene;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
 $('#palette').innerHTML='';s.colors.forEach((c,i)=>{const b=document.createElement('button');b.className='color-button';b.style.setProperty('--swatch',c);b.setAttribute('aria-label','Material color '+(i+1));b.setAttribute('aria-pressed',i===state.palette);b.onclick=()=>{state.palette=i;if([6,13].includes(state.scene))state.tool=true;syncUI();pulse('soft');};$('#palette').appendChild(b);});state.redraw=true;}
function renderUI(){for(const i of order){const s=scenes[i],b=document.createElement('button');b.className='scene-card';b.dataset.scene=i;b.setAttribute('aria-label',s.title+'. '+s.desc);b.innerHTML='<span class="thumb" style="--card-bg:'+s.bg+'">'+(THUMBNAILS.has(i)?'<img src="thumbs/'+i+'.jpg" alt="" loading="lazy" decoding="async">':'<span class="thumb-pattern"></span>')+'</span><span class="card-text"><span class="card-title">'+s.title+'</span><span class="card-desc">'+s.desc+'</span></span>';b.onclick=()=>selectScene(i);$('#scene-list').appendChild(b);}$('#volume').value=state.volume*100;$('#force').value=state.force*100;$('#speed').value=state.speed*100;materialAudio.volume=state.volume;updateSettingsUI();syncUI();}
function updateSettingsUI(){$('#volume-value').textContent=Math.round(state.volume*100)+'%';$('#force-value').textContent=state.force<.4?'Light':state.force<.75?'Medium':'Firm';$('#speed-value').textContent=state.speed.toFixed(1)+'×';$('#haptics').setAttribute('aria-pressed',state.haptics);$('#auto-hide').setAttribute('aria-pressed',state.autoHide);if(!navigator.vibrate){$('#haptics').disabled=true;$('#haptic-note').textContent='Vibration is not available in this browser.';}}
function setWatch(on){endAllTouches();if(on&&!state.soundTouched){state.soundTouched=true;materialAudio.start().then(syncSound);}state.watch=on;state.paused=false;autoPrevious=null;lastActive=null;syncUI();}
function closeDialogs(){for(const d of $$('dialog.sheet'))if(d.open)d.close();}
function openDialog(id){endAllTouches();$(id).showModal();}
function endTouchUI(){document.body.classList.remove('touching');for(const ring of touchRings.values())ring.remove();touchRings.clear();}
function endAllTouches(){for(const t of touches.values())if(t.lane)t.lane.active=false;touches.clear();state.down=false;endTouchUI();for(const r of soapRibbons)r.released=true;}
function ringAt(id,cx,cy){let r=touchRings.get(id);if(!r){r=document.createElement('span');r.className='touch-ring';$('#touch-layer').appendChild(r);touchRings.set(id,r);}r.style.left=cx+'px';r.style.top=cy+'px';}
function pointerPressure(e){return e.pointerType==='pen'&&e.pressure>0?clamp(e.pressure*.8+state.force*.3,.15,1):clamp(state.force+(e.width>10?Math.min(.12,(e.width-10)*.004):0),.2,1);}
async function soundToggle(){state.soundTouched=true;if(materialAudio.enabled)materialAudio.mute();else{const ok=await materialAudio.start();if(!ok){notify('Sound is not available in this browser.');return;}}syncSound();}
function syncSound(){$('#sound').setAttribute('aria-pressed',materialAudio.enabled);$('#sound').setAttribute('aria-label',materialAudio.enabled?'Mute sound':'Enable sound');$('#sound span').textContent=materialAudio.enabled?'Sound on':'Sound off';$('#sound use').setAttribute('href',materialAudio.enabled?'#i-sound':'#i-mute');}
function focusToggle(){state.focus=!state.focus;document.body.classList.toggle('focus-mode',state.focus);}
/* Contact with the material. Mouse, touch and pen pointers and the keyboard/gamepad
 * virtual finger all arrive here as screen points with a pressure. */
function contactStart(id,cx,cy,pressure){if(state.watch){state.watch=false;autoPrevious=null;syncUI();}state.paused=false;const p=toWorld(cx,cy);if(!p)return false;const t={...p,pressure,time:performance.now(),id,lane:null};touches.set(id,t);state.contact=t.pressure;state.pointer={...p};state.down=true;state.lastInteraction=performance.now();lastActive={...p};document.body.classList.add('touching');ringAt(id,cx,cy);if(!state.soundTouched){state.soundTouched=true;materialAudio.start().then(syncSound);}if([12,14,15,16].includes(state.scene))peelStart(p,t);processStroke(p,null,t);if(state.scene===3){materialEvent(3,p.x,.55);dropList.push({...p,age:0});}pulse('soft');return true;}
function contactMove(id,cx,cy,pressure){const t=touches.get(id);if(!t)return;const p=toWorld(cx,cy);if(!p)return;const now=performance.now();t.pressure=pressure;state.contact=t.pressure;processStroke(p,t,t,Math.max(.001,(now-t.time)/1000));t.x=p.x;t.z=p.z;t.sx=p.sx;t.sy=p.sy;t.time=now;state.pointer={...p};}
function contactEnd(id){const t=touches.get(id);if(t?.lane){if(t.lane.release)t.lane.release(t.gripId??id);else t.lane.active=false;}touches.delete(id);const r=touchRings.get(id);if(r){r.classList.add('fading');setTimeout(()=>r.remove(),400);touchRings.delete(id);}state.down=touches.size>0;if(!state.down){document.body.classList.remove('touching');lastActive=null;for(const r of soapRibbons)r.released=true;}else{const first=touches.values().next().value;state.pointer={x:first.x,z:first.z};}}
function bind(){const host=$('#render');
 // Capture on the kit canvas (the event target), so the kit's input sees the same pointer.
 host.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();try{kit.canvas.setPointerCapture(e.pointerId);}catch(err){}contactStart(e.pointerId,e.clientX,e.clientY,pointerPressure(e));},{passive:false});
 host.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId)){if(e.pointerType==='mouse'){state.pointer=toWorld(e.clientX,e.clientY);}return;}e.preventDefault();const samples=e.getCoalescedEvents?.()||[e];for(const ev of(samples.length?samples:[e]))contactMove(e.pointerId,ev.clientX,ev.clientY,pointerPressure(ev));ringAt(e.pointerId,e.clientX,e.clientY);},{passive:false});
 const end=e=>contactEnd(e.pointerId);
 host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);host.addEventListener('lostpointercapture',end);window.addEventListener('blur',()=>{endAllTouches();materialAudio.visibility(true);});window.addEventListener('focus',()=>materialAudio.visibility(false));document.addEventListener('visibilitychange',()=>{endAllTouches();materialAudio.visibility(document.hidden);});
 $('#sound').onclick=soundToggle;$('#scenes-open').onclick=()=>openDialog('#scene-dialog');$('#settings-open').onclick=()=>openDialog('#settings-dialog');$$('.close-sheet').forEach(b=>b.onclick=()=>b.closest('dialog').close());for(const d of $$('dialog.sheet'))d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
 $('#watch').onclick=()=>setWatch(!state.watch);$('#reset').onclick=()=>resetScene(true);$('#prev').onclick=()=>selectNext(-1);$('#next').onclick=()=>selectNext(1);$('#focus').onclick=focusToggle;$('#reveal').onclick=focusToggle;
 $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else{focusToggle();notify('Controls hidden. Full screen is not available here.');}}catch(e){notify('Full screen is not available here.');}};
 $('#tool').onclick=()=>{switch(state.scene){case 2:initBubbles();break;case 5:for(const b of beads){const a=random()*TAU;b.vx+=Math.cos(a)*.5;b.vz+=Math.sin(a)*.5;}break;case 10:state.coat=0;state.candyY=1.2;break;case 11:fillDye([222,221,204],0);break;case 12:case 14:case 15:case 16:case 17:case 18:case 19:case 20:resetScene();break;case 21:shuffleSorting();break;case 22:standDominoesUp();break;default:state.tool=!state.tool;}syncUI();pulse('soft');};
 $('#tour').onclick=()=>{state.tour=!state.tour;state.tourTime=0;if(state.tour)setWatch(true);syncUI();};
 for(const [id,key,scale]of[['volume','volume',100],['force','force',100],['speed','speed',100]])$('#'+id).oninput=e=>{state[key]=+e.target.value/scale;if(key==='volume')materialAudio.setVolume(state.volume);updateSettingsUI();settings();};
 $('#haptics').onclick=()=>{state.haptics=!state.haptics;updateSettingsUI();settings();pulse('pop');};$('#auto-hide').onclick=()=>{state.autoHide=!state.autoHide;updateSettingsUI();syncUI();settings();};$('#graphics-open').onclick=()=>kit.menu.open();
 $('#save').onclick=async()=>{try{draw();kit.canvas.toBlob(blob=>{if(!blob)return notify('The image could not be saved.');const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='still-'+scenes[state.scene].title.toLowerCase().replaceAll(' ','-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('Image saved.');});}catch(e){notify('The image could not be saved in this browser.');}};
window.visualViewport?.addEventListener('resize',resize);}
function rendererLabel(){state.renderer=bridge.name;$('#renderer-name').textContent=kit.backendLabel+' · '+kit.tier.name[0].toUpperCase()+kit.tier.name.slice(1)+' quality';$('#renderer-detail').textContent='three.js r'+THREE.REVISION+' · node material shaders · '+bridge.shadowSize+' px shadow map.';$('#engine-label').textContent=kit.backendLabel.toUpperCase()+' · LIVE';}
function expose(){window.__still={state,scenes,order,selectScene,resetScene,toScreen,toWorld,field,draw,step,setWatch,materialAudio,touches,processStroke,get bridge(){return bridge;},get renderer(){return bridge?.name;},get stats(){let fieldMax=-Infinity,fieldMin=Infinity;for(const v of field){if(v>fieldMax)fieldMax=v;if(v<fieldMin)fieldMin=v;}return{scene:state.scene,frames:state.frames,actions:state.actionCount,instances:batches.used.reduce((a,b)=>a+b.count,0),drawCalls:batches.used.length,errors:state.errors.slice(),sound:materialAudio.enabled,peak:materialAudio.measure(),fieldMax,fieldMin,touches:touches.size,painted:state.painted,peeled:state.peeled,coat:state.coat,backend:kit.backend};},get beads(){return beads;},get streams(){return streams;},get fluid(){return fluid;},get particles(){return particles;},get pixels(){return{dye:dye.slice(),field:fieldBytes.slice()};},get bubbles(){return bubbleList;},get ribbons(){return soapRibbons;},get lanes(){return peelLanes;},get dominoes(){return dominoes;}};}
/* Shaders for every material kind compile in the background in small groups, so the
 * first visit to an exhibit does not stall. Skipped quietly if the renderer declines. */
function scheduleWarmUp(){const kinds=MATERIAL_KINDS.slice();const next=()=>{if(!kinds.length)return;const group=kinds.splice(0,4);bridge.warm(group).catch(e=>console.warn('[still] shader warm-up skipped:',e?.message||e)).finally(()=>setTimeout(next,90));};setTimeout(next,600);}
function init(){try{
 restorePlace();resize();renderUI();resetScene();encodeField();
 bridge=createStillRenderer(kit,{fieldBytes,dye,size:N});kit.canvas.setAttribute('aria-hidden','true');
 bind();state.ready=true;state.redraw=true;rendererLabel();kit.onQuality(rendererLabel);kit.onResize(()=>resize());
 kit.onPause(p=>{if(p){endAllTouches();materialAudio.visibility(true);}else if(game.running&&!$$('dialog.sheet').some(d=>d.open)){materialAudio.visibility(false);lastPlaceSave=0;}});
 input.onSourceChange(syncControlsHelp);syncControlsHelp();syncEntryCopy();$('#enter-game').disabled=false;
 addEventListener('pagehide',savePlace);document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.started)savePlace();});
 // A gamepad press is not a user gesture, so a session started from a controller gets its sound
 // on the first click, tap or key instead (M is left to the sound toggle itself).
 const unlockAudio=e=>{if(e.code!=='KeyM'&&game.running&&game.sound&&!materialAudio.enabled)materialAudio.start().then(syncSound);};
 addEventListener('pointerdown',unlockAudio,true);addEventListener('keydown',unlockAudio,true);
 expose();if(window.__stillStartup)window.__stillStartup.ready=true;
 kit.start(frame);scheduleWarmUp();
}catch(e){state.errors.push(e.message);console.error(e);if(window.__stillStartup)window.__stillStartup.fail(e);}}
/* Still / material-response pass.
 * Small-step XPBD distance constraints and signed 3-D dihedral bending.
 * Adhesive damage depends on local opening and opening rate. This is not full shell FEM.
 * Thermal models are reduced, interactive models, not calibrated measurements.
 */
const feel = { mode:-1, sheets:[], ice:[], wax:null, accumulator:0, time:0,
  releaseRate:0, motion:0, tension:0, heatRate:0, lastSound:0, pointer:null,
  steps:0, drops:[], warm:false, autoTouch:null, changed:false, version:'5.0' };
const FEEL_DT=1/120;
const feelOriginal={reset:resetScene,step,draw,stroke:processStroke,start:peelStart,sync:syncUI,watch:setWatch};
const FEEL_CACHE=new Map();
function retainedMesh(key,make){let g=FEEL_CACHE.get(key);if(!g){g=make();g.dynamic=true;FEEL_CACHE.set(key,g);}return g;}
function meshNormals(g){
  const p=g.p,n=g.n,idx=g.i;n.fill(0);
  for(let k=0;k<idx.length;k+=3){const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3;
    const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2];
    const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx;
    n[a]+=x;n[a+1]+=y;n[a+2]+=z;n[b]+=x;n[b+1]+=y;n[b+2]+=z;n[c]+=x;n[c+1]+=y;n[c+2]+=z;
  }
  for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}
  g.version=(g.version||0)+1;
}
function smooth01(v){v=clamp(v,0,1);return v*v*(3-2*v);}

/* Material-local cohesive bonds + compliant triangle mesh.
 * XPBD stretch/shear and signed 3-D dihedral constraints.
 * Bond damage is driven by solved opening, not pointer distance or an animation.
 * Units and material data are normalized for interaction, not lab calibration.
 */
const PEEL_MATERIALS={
  12:{name:'Soft vinyl',cols:9,rows:79,stretch:5e-7,shear:8e-7,bend:8e-5,adhesion:5e-6,opening:.012,failure:.030,rate:.12,variation:.14,damping:4.0,thickness:.035,friction:.60,yield:.85,plastic:.08,elasticLimit:1.06,grip:6e-7},
  14:{name:'Dried PVA',cols:23,rows:73,stretch:2.1e-6,shear:3.1e-6,bend:3.0e-4,adhesion:7.0e-6,opening:.016,failure:.048,rate:.26,variation:.34,damping:4.6,thickness:.018,friction:.76,yield:8,plastic:0,elasticLimit:1.12,grip:1.0e-6},
  15:{name:'Protective PET film',cols:27,rows:79,stretch:1.8e-8,shear:6.0e-8,bend:1.8e-3,adhesion:9.0e-6,opening:.0045,failure:.014,rate:.10,variation:.09,damping:2.1,thickness:.010,friction:.38,yield:.65,plastic:.20,elasticLimit:1.025,grip:3.0e-7},
  16:{name:'Paper masking tape',cols:5,rows:89,stretch:5.0e-9,shear:4.0e-8,bend:4.0e-5,adhesion:4.5e-6,opening:.008,failure:.027,rate:.19,variation:.22,damping:3.5,thickness:.021,friction:.70,yield:.24,plastic:.62,elasticLimit:1.016,grip:3.0e-7}
};
class PeelSheet {
 constructor(mode,index,x,width,length,start){
  this.mode=mode;this.index=index;this.x=x;this.width=width;this.length=length;this.start=start;this.material=PEEL_MATERIALS[mode];
  const m=this.material;this.cols=cameraRig.baseW<6?(mode===14?19:mode===15?23:mode===12?7:5):m.cols;this.rows=cameraRig.baseW<6?(mode===16?81:69):m.rows;this.dx=width/(this.cols-1);this.dz=length/(this.rows-1);
  this.g=retainedMesh('cohesive-'+mode+'-'+index+'-'+this.cols+'-'+this.rows,()=>plane(1,1,this.cols-1,this.rows-1));
  const n=this.cols*this.rows;this.rest=new Float32Array(n*3);this.previous=new Float32Array(n*3);this.inverse=new Float32Array(n);this.inverse.fill(1);
  this.bonded=new Uint8Array(n);this.damage=new Float32Array(n);this.opening=new Float32Array(n);this.bondLambda=new Float32Array(n*3);this.strain=new Float32Array(n);
  this.constraints=[];this.hinges=[];this.grips=new Map();this.edgeFront=new Float32Array(this.cols);this.advance=0;this.releaseCount=0;this.energy=0;this.tension=0;this.maxStrain=0;this.rate=0;this.goal=0;this.contactCount=0;this.lastTension=0;this.anchors=new Int32Array(this.cols);this.newRelease=0;
  this.tip={x,y:.35,z:start+.18};this.freeArea=0;this.sleep=0;this.tick=0;
  const tabRows=5,p=this.g.p;
  for(let j=0;j<this.rows;j++)for(let i=0;i<this.cols;i++){
   const a=j*this.cols+i,k=a*3,u=i/(this.cols-1),v=j/(this.rows-1);
   const scallop=mode===14?.09*Math.sin(v*21+index*.4)*Math.pow(Math.abs(u-.5)*2,5):0;
   this.rest[k]=x+(u-.5)*width+scallop;this.rest[k+1]=.050;this.rest[k+2]=start+j*this.dz+(mode===14?.045*Math.sin(u*12)*Math.exp(-v*19):0);
   p[k]=this.rest[k];p[k+1]=.050;p[k+2]=this.rest[k+2];this.bonded[a]=j>=tabRows?1:0;
   if(j<tabRows){const l=(tabRows-j)*this.dz,r=Math.max(.14,this.dz*2.6),t=l/r;
    p[k+1]=.050+r*(1-Math.cos(Math.min(t,Math.PI)));
    p[k+2]=start+tabRows*this.dz-r*Math.sin(Math.min(t,Math.PI));
    if(t>Math.PI)p[k+2]+=(t-Math.PI)*r;
    p[k+1]+=.028*Math.sin(u*4.8)*Math.sin(j*.8);
   }
  }
  this.previous.set(p);
  const link=(a,b,c,kind)=>{const aa=a*3,bb=b*3,l=Math.hypot(this.rest[aa]-this.rest[bb],this.rest[aa+1]-this.rest[bb+1],this.rest[aa+2]-this.rest[bb+2]);this.constraints.push({a,b,l,c,lambda:0,kind});};
  for(let j=0;j<this.rows;j++)for(let i=0;i<this.cols;i++){
   const a=j*this.cols+i;if(i+1<this.cols)link(a,a+1,m.stretch,0);if(j+1<this.rows)link(a,a+this.cols,m.stretch,0);
   if(i+1<this.cols&&j+1<this.rows){link(a,a+this.cols+1,m.shear,1);link(a+1,a+this.cols,m.shear,1);}
  }
  const edges=new Map(),idx=this.g.i;
  for(let i=0;i<idx.length;i+=3)for(let z=0;z<3;z++){
   const a=idx[i+z],b=idx[i+(z+1)%3],c=idx[i+(z+2)%3],key=Math.min(a,b)+','+Math.max(a,b);
   if(edges.has(key)){const e=edges.get(key);this.hinges.push({a:e.a,b:e.b,c:e.c,d:c,rest:0,lambda:0});}else edges.set(key,{a,b,c});
  }
  this.updateStats();meshNormals(this.g);
 }
 get active(){return this.grips.size>0;}
 set active(v){if(!v)this.grips.clear();}
 get complete(){return this.bonded.every(x=>x===0);}
 release(id){this.grips.delete(id);this.sleep=0;}
 pick(cx,cy){
  // Two-sided ray / triangle intersection selects the visible, current surface.
  const ray=screenRay(cx,cy),o=ray.origin,d=ray.direction,p=this.g.p,idx=this.g.i;let best=null,nearest=Infinity;
  for(let i=0;i<idx.length;i+=3){
   const ai=idx[i],bi=idx[i+1],ci=idx[i+2];if(this.bonded[ai]||this.bonded[bi]||this.bonded[ci])continue;
   const a=ai*3,b=bi*3,c=ci*3,ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],fx=p[c]-p[a],fy=p[c+1]-p[a+1],fz=p[c+2]-p[a+2];
   const hx=d[1]*fz-d[2]*fy,hy=d[2]*fx-d[0]*fz,hz=d[0]*fy-d[1]*fx,det=ex*hx+ey*hy+ez*hz;if(Math.abs(det)<1e-8)continue;
   const inv=1/det,sx=o[0]-p[a],sy=o[1]-p[a+1],sz=o[2]-p[a+2],u=(sx*hx+sy*hy+sz*hz)*inv;if(u<0||u>1)continue;
   const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex,v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(v<0||u+v>1)continue;
   const t=(fx*qx+fy*qy+fz*qz)*inv;if(t<0||t>nearest)continue;
   nearest=t;best={a:ai,ids:[ai,bi,ci],weights:[1-u-v,u,v],dist:0,depth:t,x:o[0]+d[0]*t,y:o[1]+d[1]*t,z:o[2]+d[2]*t};
  }
  if(best)return best;
  // A large screen-space edge target is used only when the ray misses the film.
  let dist=Infinity;
  for(let a=0;a<this.bonded.length;a++){if(this.bonded[a])continue;const k=a*3,q=toScreen(p[k],p[k+2],p[k+1]);if(q.depth<=0)continue;
   const d=Math.hypot(q.x-cx,q.y-cy);if(d<dist){dist=d;best={a,ids:[a],weights:[1],dist,x:p[k],y:p[k+1],z:p[k+2]};}
  }
  return best;
 }
 grab(p,id='auto',hit=null){
  const pp=p.sx!==undefined?{x:p.sx,y:p.sy}:toScreen(p.x,p.z,p.y??.05);hit=hit||this.pick(pp.x,pp.y);if(!hit)return false;
  const q={x:hit.x,y:hit.y,z:hit.z},screen=toScreen(q.x,q.z,q.y);
  this.grips.set(id,{id,a:hit.a,ids:hit.ids,weights:hit.weights,start:{...q},target:{...q},hand:{...q},last:{...q},screen:{x:screen.x,y:screen.y},mouse:{x:pp.x,y:pp.y},distance:0,lambda:new Float32Array(3),force:0,velocity:0});
  this.tip={...q};this.sleep=0;feel.changed=true;return true;
 }
 move(p,prev,id='auto'){
  const g=this.grips.get(id);if(!g)return;
  const next=p.sx!==undefined?{x:p.sx,y:p.sy}:toScreen(p.x,p.z,p.y??.05);
  const dx=next.x-g.mouse.x,dy=next.y-g.mouse.y;
  if(Math.abs(dx)+Math.abs(dy)<.001)return;
  g.screen.x+=dx;g.screen.y+=dy;g.mouse=next;
  const factor=cam.height/Math.max(rect.height,1);g.distance+=Math.hypot(dx,dy)*factor;
  const height=g.start.y+(1-Math.exp(-g.distance*1.45))*(cameraRig.lift-g.start.y);
  const q=rayAtHeight(g.screen.x,g.screen.y,Math.max(.065,height));
  if(q){g.target.x=clamp(q.x,-30,30);g.target.y=Math.max(.065,height);g.target.z=clamp(q.z,-30,30);}
  this.sleep=0;
 }
 hasFreeNeighbour(a){const c=this.cols,i=a%c,j=(a/c)|0;
  return (j>0&&!this.bonded[a-c])||(j<this.rows-1&&!this.bonded[a+c])||(i>0&&!this.bonded[a-1])||(i<c-1&&!this.bonded[a+1]);
 }
 solveHinge(h,dt){
  const p=this.g.p,a=h.a*3,b=h.b*3,c=h.c*3,d=h.d*3;
  const ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],e2=ex*ex+ey*ey+ez*ez,el=Math.sqrt(e2);if(el<1e-7)return;
  const cx=p[c]-p[a],cy=p[c+1]-p[a+1],cz=p[c+2]-p[a+2],dx=p[d]-p[a],dy=p[d+1]-p[a+1],dz=p[d+2]-p[a+2];
  const nx=ey*cz-ez*cy,ny=ez*cx-ex*cz,nz=ex*cy-ey*cx,mx=dy*ez-dz*ey,my=dz*ex-dx*ez,mz=dx*ey-dy*ex;
  const n2=nx*nx+ny*ny+nz*nz,m2=mx*mx+my*my+mz*mz;if(n2<1e-10||m2<1e-10)return;
  const phi=Math.atan2((ex*(my*nz-mz*ny)+ey*(mz*nx-mx*nz)+ez*(mx*ny-my*nx))/el,nx*mx+ny*my+nz*mz);
  const C=Math.atan2(Math.sin(phi-h.rest),Math.cos(phi-h.rest));
  const sc=el/n2,sd=el/m2,qcx=nx*sc,qcy=ny*sc,qcz=nz*sc,qdx=mx*sd,qdy=my*sd,qdz=mz*sd;
  const t=(cx*ex+cy*ey+cz*ez)/e2,u=(dx*ex+dy*ey+dz*ez)/e2;
  const qbx=-t*qcx-u*qdx,qby=-t*qcy-u*qdy,qbz=-t*qcz-u*qdz,qax=-qbx-qcx-qdx,qay=-qby-qcy-qdy,qaz=-qbz-qcz-qdz;
  const alpha=this.material.bend/(dt*dt),den=qax*qax+qay*qay+qaz*qaz+qbx*qbx+qby*qby+qbz*qbz+qcx*qcx+qcy*qcy+qcz*qcz+qdx*qdx+qdy*qdy+qdz*qdz;
  const dl=clamp((-C-alpha*h.lambda)/(den+alpha),-.022,.022);h.lambda+=dl;
  p[a]+=qax*dl;p[a+1]+=qay*dl;p[a+2]+=qaz*dl;p[b]+=qbx*dl;p[b+1]+=qby*dl;p[b+2]+=qbz*dl;p[c]+=qcx*dl;p[c+1]+=qcy*dl;p[c+2]+=qcz*dl;p[d]+=qdx*dl;p[d+1]+=qdy*dl;p[d+2]+=qdz*dl;
  if(this.tick%3===0&&this.material.plastic&&!this.bonded[h.a]&&!this.bonded[h.b]&&Math.abs(C)>this.material.yield){h.rest+=clamp(C-Math.sign(C)*this.material.yield,-.06,.06)*this.material.plastic*dt;}
 }
 collide(){
  // Spatial contact for non-neighbour nodes. No scripted curl or axis constraint.
  const p=this.g.p,old=this.previous,r=Math.max(.038,this.material.thickness*2.5),grid=new Map(),cell=.19;
  this.contactCount=0;
  for(let a=0;a<this.bonded.length;a++){
   if(this.bonded[a])continue;const k=a*3;
   if(p[k+1]<.050+this.material.thickness){p[k+1]=.050+this.material.thickness;old[k+1]=p[k+1];old[k]+=(p[k]-old[k])*this.material.friction;old[k+2]+=(p[k+2]-old[k+2])*this.material.friction;this.contactCount++;}
   const x=Math.floor(p[k]/cell),y=Math.floor(p[k+1]/cell),z=Math.floor(p[k+2]/cell);
   for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=1;iy++)for(let iz=-1;iz<=1;iz++){
    const list=grid.get((x+ix+512)+((y+iy+512)<<10)+((z+iz+512)<<20));if(!list)continue;
    for(const b of list){if(Math.abs((a/this.cols|0)-(b/this.cols|0))<3&&Math.abs(a%this.cols-b%this.cols)<3)continue;
     const l=b*3,dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2],d2=dx*dx+dy*dy+dz*dz;
     if(d2<r*r&&d2>1e-12){const dd=Math.sqrt(d2),s=(r-dd)/dd*.5;p[k]+=dx*s;p[k+1]+=dy*s;p[k+2]+=dz*s;p[l]-=dx*s;p[l+1]-=dy*s;p[l+2]-=dz*s;this.contactCount++;}
    }
   }
   const key=(x+512)+((y+512)<<10)+((z+512)<<20);let l=grid.get(key);if(!l){l=[];grid.set(key,l);}l.push(a);
  }
 }
 step(dt){
  this.tick++;const p=this.g.p,old=this.previous,R=this.rest,m=this.material,n=this.bonded.length;
  const activeN=Math.min(n,(Math.ceil(Math.max(...this.edgeFront)/this.dz)+5)*this.cols);
  if(this.activeN!==activeN){this.activeN=activeN;this.activeConstraints=this.constraints.filter(c=>c.a<activeN||c.b<activeN);this.activeHinges=this.hinges.filter(h=>h.a<activeN||h.b<activeN||h.c<activeN||h.d<activeN);}
  const edges=this.activeConstraints,hinges=this.activeHinges;
  if(this.sleep>150&&!this.active){this.rate=0;this.tension=0;return;}
  this.newRelease=0;this.bondLambda.fill(0);this.strain.fill(0);let velocity2=0;
  const damp=Math.exp(-m.damping*dt);
  for(let a=0;a<activeN;a++){const k=a*3;for(let d=0;d<3;d++){const v=clamp((p[k+d]-old[k+d])*damp,-.10,.10);old[k+d]=p[k+d];p[k+d]+=v;velocity2+=v*v;}p[k+1]-=3.8*dt*dt;}
  for(const c of edges)c.lambda=0;for(const h of hinges)h.lambda=0;
  for(const g of this.grips.values()){
   g.lambda.fill(0);const dx=g.target.x-g.hand.x,dy=g.target.y-g.hand.y,dz=g.target.z-g.hand.z,dist=Math.hypot(dx,dy,dz),s=Math.min(1,dt*14/Math.max(.001,dist));
   g.hand.x+=dx*s;g.hand.y+=dy*s;g.hand.z+=dz*s;g.velocity=Math.min(15,dist/Math.max(dt,.001));
  }
  for(let i=0;i<this.cols;i++){let a=i;while(a<n&&!this.bonded[a])a+=this.cols;this.anchors[i]=a<n?a:-1;}
  for(let it=0;it<8;it++){
   for(const g of this.grips.values()){
    const alpha=m.grip/(dt*dt);let mass=0,q=[0,0,0];
    for(let j=0;j<g.ids.length;j++){const k=g.ids[j]*3,w=g.weights[j];mass+=w*w;for(let d=0;d<3;d++)q[d]+=p[k+d]*w;}
    const target=[g.hand.x,g.hand.y,g.hand.z];
    for(let d=0;d<3;d++){const C=q[d]-target[d],dl=clamp((-C-alpha*g.lambda[d])/(mass+alpha),-.085,.085);g.lambda[d]+=dl;for(let j=0;j<g.ids.length;j++)p[g.ids[j]*3+d]+=g.weights[j]*dl;}
   }

   for(let ci=it%2?edges.length-1:0;it%2?ci>=0:ci<edges.length;ci+=it%2?-1:1){
    const c=edges[ci],a=c.a*3,b=c.b*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],len=Math.hypot(dx,dy,dz)||1e-8,C=len-c.l;
    const alpha=c.c/(dt*dt),dl=(-C-alpha*c.lambda)/(2+alpha);c.lambda+=dl;const s=dl/len;
    p[a]+=dx*s;p[a+1]+=dy*s;p[a+2]+=dz*s;p[b]-=dx*s;p[b+1]-=dy*s;p[b+2]-=dz*s;
   }
   // Tension-only geodesic tethers accelerate load transfer along freed backing.
   // They limit extension, but do not prescribe a fold or curl.
   for(let i=0;i<this.cols;i++){
    const root=this.anchors[i];if(root<0)continue;const b=root*3;
    for(let a=i;a<root;a+=this.cols*2){const k=a*3,l=(root-a)/this.cols*this.dz*m.elasticLimit;
     const dx=p[k]-p[b],dy=p[k+1]-p[b+1],dz=p[k+2]-p[b+2],len=Math.hypot(dx,dy,dz);
     if(len>l&&len>1e-8){const f=(len-l)/(len*2)*.55;p[k]-=dx*f;p[k+1]-=dy*f;p[k+2]-=dz*f;p[b]+=dx*f;p[b+1]+=dy*f;p[b+2]+=dz*f;}
    }
   }
   // Bending is measured between adjacent triangles in full 3-D.
   for(let j=it%2?hinges.length-1:0;it%2?j>=0:j<hinges.length;j+=it%2?-1:1){const h=hinges[j];if(!this.bonded[h.a]||!this.bonded[h.b]||!this.bonded[h.c]||!this.bonded[h.d])this.solveHinge(h,dt);}
   for(let a=0;a<activeN;a++){
    const k=a*3;if(this.bonded[a]){
     const alpha=m.adhesion/Math.max(.025,1-this.damage[a])/(dt*dt);
     for(let d=0;d<3;d++){const C=p[k+d]-R[k+d],dl=(-C-alpha*this.bondLambda[k+d])/(1+alpha);this.bondLambda[k+d]+=dl;p[k+d]+=dl;}
    }
    if(p[k+1]<.050)p[k+1]=.050;
   }
  }
  // Irreversible cohesive damage; only the exposed crack front may fail.
  // Rate sensitivity uses the local opening rate, not the mouse travel distance.
  const breaks=[];
  for(let a=0;a<activeN;a++)if(this.bonded[a]&&this.hasFreeNeighbour(a)){
   const k=a*3,dx=p[k]-R[k],dy=Math.max(0,p[k+1]-R[k+1]),dz=p[k+2]-R[k+2];
   const sep=Math.sqrt(dy*dy+.22*(dx*dx+dz*dz));
   const vel=Math.max(0,(sep-this.opening[a])/dt),j=(a/this.cols)|0,i=a%this.cols;
   const hetero=1+m.variation*(.65*Math.sin(j*.73+i*.21+this.index*3)+.35*Math.sin(j*.29-i*.77));
   const onset=m.opening*hetero,fail=m.failure*hetero*(1+m.rate*Math.log1p(Math.min(8,vel)));
   this.opening[a]=Math.max(this.opening[a],sep);
   if(sep>onset){const damage=clamp(fail*(sep-onset)/Math.max(1e-6,sep*(fail-onset)),0,1);this.damage[a]=Math.max(this.damage[a],damage);this.damage[a]=Math.min(1,this.damage[a]+dt*Math.max(0,sep/onset-1)*2.2);}
   if(this.damage[a]>.985||sep>fail)breaks.push(a);
  }
  for(const a of breaks){this.bonded[a]=0;this.damage[a]=1;this.newRelease++;this.releaseCount++;}
  // Non-rubber backing. A separate limiter bounds large transient extension.
  for(let it=0;it<7;it++)for(const c of edges){const a=c.a*3,b=c.b*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],len=Math.hypot(dx,dy,dz);if(len>c.l*m.elasticLimit){const wa=this.bonded[c.a]?(this.damage[c.a]*.2):1,wb=this.bonded[c.b]?(this.damage[c.b]*.2):1;if(wa+wb>0){const s=(len-c.l*m.elasticLimit)/len/(wa+wb);p[a]-=dx*s*wa;p[a+1]-=dy*s*wa;p[a+2]-=dz*s*wa;p[b]+=dx*s*wb;p[b+1]+=dy*s*wb;p[b+2]+=dz*s*wb;}}}
  if(this.tick%2===0)this.collide();
  velocity2=0;let freeNodes=0;
  for(let a=0;a<activeN;a++){const k=a*3;if(p[k+1]<.050){p[k+1]=.050;old[k+1]=Math.max(old[k+1],.050);}if(!this.bonded[a]){freeNodes++;for(let d=0;d<3;d++)velocity2+=(p[k+d]-old[k+d])**2;}}

  const area=this.dx*this.dz*this.newRelease;feel.releaseRate+=area/dt;this.rate=lerp(this.rate,area/(dt*this.width),.23);
  this.energy=lerp(this.energy,Math.sqrt(velocity2/Math.max(1,freeNodes))/dt,.2);this.tension=0;
  for(const g of this.grips.values()){g.force=Math.hypot(g.lambda[0],g.lambda[1],g.lambda[2])/(dt*dt);this.tension=Math.max(this.tension,clamp(Math.log1p(g.force/55)*.17,0,1));}
  this.updateStats();if(!this.active&&this.energy<.028)this.sleep++;else this.sleep=0;
 }
 updateStats(){
  const p=this.g.p;let free=0;if(this.tick%8===0)this.maxStrain=0;
  for(let i=0;i<this.cols;i++){let far=0;for(let j=0;j<this.rows;j++){const a=j*this.cols+i;if(!this.bonded[a]){free++;far=Math.max(far,j*this.dz);}}this.edgeFront[i]=far;}
  this.freeArea=free/this.bonded.length*this.width*this.length;this.advance=this.freeArea/this.width;
  const g=this.grips.values().next().value;let col=Math.floor(this.cols/2),row=0;while(row<this.rows&&!this.bonded[row*this.cols+col])row++;let a=g?.a??(Math.max(0,row-3)*this.cols+col);const k=a*3;this.tip={x:p[k],y:p[k+1],z:p[k+2]};if(g){this.tip={x:0,y:0,z:0};for(let j=0;j<g.ids.length;j++){const k=g.ids[j]*3,w=g.weights[j];this.tip.x+=p[k]*w;this.tip.y+=p[k+1]*w;this.tip.z+=p[k+2]*w;}}
  if(this.tick%8===0)for(const c of this.constraints){if(c.kind===1)continue;const a=c.a*3,b=c.b*3,s=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2])/c.l-1;this.maxStrain=Math.max(this.maxStrain,Math.abs(s));this.strain[c.a]=Math.max(this.strain[c.a],s);this.strain[c.b]=Math.max(this.strain[c.b],s);}
 }
 draw(){
  meshNormals(this.g);const kind=this.mode===12?32:this.mode===14?21:this.mode===15?22:23;
  add(this.g,kind,chooseColor(),[0,0,0],[1,1,1],[0,0,0,1],[this.tension,this.advance/this.length],true);
 }
}
/* A height-field film with temperature-dependent mobility. Every flux update
 * subtracts from one cell and adds to its neighbour. No wax vanishes on release.
 */
class WaxFilm {
  constructor(n=96){
    this.n=n;this.h=new Float32Array(n*n);this.energy=new Float32Array(n*n);this.temp=new Float32Array(n*n);this.phase=new Float32Array(n*n);this.delta=new Float32Array(n*n);this.motion=0;this.melted=0;
    this.span=world.fieldSpan.slice();this.wick={x:-cam.width*.08,z:-.75};this.lastPoints=new Map();
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=j*n+i,x=(i/(n-1)-.5)*this.span[0],z=(j/(n-1)-.5)*this.span[1];
      const d=Math.hypot(x-this.wick.x,z-this.wick.z);
      this.h[k]=.24+.11*Math.exp(-(((d-2.25)/.32)**2))+.075*Math.exp(-(((x-.45)**2+(z-.8)**2)/.9));
      this.energy[k]=.07+1.02*Math.exp(-d*d/4.2);this.phase[k]=smooth01((this.energy[k]-.25)/.60);
    }
    this.initialMass=this.mass();this.lastMelt=0;this.lastUpdated=0;
  }
  mass(){let m=0;for(const h of this.h)m+=h;return m;}
  step(dt,points){
    const n=this.n,H=this.h,E=this.energy,P=this.phase,T=this.temp,D=this.delta,wx=this.wick.x,wz=this.wick.z;
    const sx=this.span[0]/(n-1),sz=this.span[1]/(n-1);let melt=0;
    // Enthalpy has a latent-heat interval. Diffusion and source rates use seconds.
    for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){
      const k=j*n+i,x=(i/(n-1)-.5)*this.span[0],z=(j/(n-1)-.5)*this.span[1];
      let heat=.30*Math.exp(-((x-wx)**2+(z-wz)**2)/.36);
      for(const q of points){const r=.58+(q.pressure||.5)*.32;heat+=1.50*Math.exp(-((x-q.x)**2+(z-q.z)**2)/(r*r));}
      const lap=(E[k-1]+E[k+1]-2*E[k])/(sx*sx)+(E[k-n]+E[k+n]-2*E[k])/(sz*sz);
      T[k]=clamp(E[k]+dt*(heat+.022*lap-.045*(E[k]-.07)),.04,1.75);
    }
    for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;E[k]=T[k];const f=smooth01((E[k]-.25)/.60);P[k]=f;melt+=f;}
    D.fill(0);let motion=0;
    const flux=(a,b,dist,ux,uz)=>{
      const mobility=Math.min(P[a],P[b])**2;
      let f=(H[a]-H[b]+.07*(P[a]-P[b]))*mobility*dt*.045/(dist*dist);
      if(points.length){const i=a%n,j=(a/n)|0,x=(i/(n-1)-.5)*this.span[0],z=(j/(n-1)-.5)*this.span[1];
        for(const q of points){const dx=x-q.x,dz=z-q.z,d2=dx*dx+dz*dz,w=Math.exp(-d2/.38);
          f+=w*mobility*dt*((q.vx||0)*ux+(q.vz||0)*uz)*.030;
        }
      }
      const cap=.12*Math.min(H[a],H[b]);f=clamp(f,-cap,cap);D[a]-=f;D[b]+=f;motion+=Math.abs(f);
    };
    for(let j=1;j<n-2;j++)for(let i=1;i<n-2;i++){const k=j*n+i;flux(k,k+1,sx,1,0);flux(k,k+n,sz,0,1);}
    for(let k=0;k<H.length;k++)H[k]+=D[k];
    this.motion=lerp(this.motion,motion/dt/this.n,.08);this.melted=melt/(n*n);
    feel.heatRate+=Math.abs(this.melted-this.lastMelt)/dt;this.lastMelt=this.melted;
  }
  texture(){
    const n=this.n;for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const x=i/(N-1)*(n-1),y=j/(N-1)*(n-1),a=Math.min(n-2,x|0),b=Math.min(n-2,y|0),tx=x-a,ty=y-b,k=b*n+a;
      const sample=A=>lerp(lerp(A[k],A[k+1],tx),lerp(A[k+n],A[k+n+1],tx),ty);
      const dest=j*N+i;field[dest]=sample(this.h)-.24;
      dye[dest*4]=Math.round(sample(this.phase)*255);dye[dest*4+1]=Math.round(clamp(sample(this.energy)/1.7,0,1)*255);dye[dest*4+2]=0;dye[dest*4+3]=255;
    }fieldDirty=true;dyeDirty=true;
  }
}

/* Each ice mesh stores local heat and irreversible radial ablation. A sensible
 * heat threshold precedes latent melt. This preserves a mesh, not a full 3-D
 * Stefan free boundary; local dents and rounding are the useful real-time result.
 */
class MeltingIce {
  constructor(index,x,z,size,angle){
    this.index=index;this.x=x;this.z=z;this.size=size;this.angle=angle;
    this.g=retainedMesh('ice-'+index,()=>sphere(24,36));
    this.base=new Float32Array(this.g.p.length);this.heat=new Float32Array(this.g.p.length/3);this.nextHeat=this.heat.slice();this.melt=this.heat.slice();this.neighbours=[];
    const lat=24,lon=36;
    for(let j=0;j<=lat;j++)for(let i=0;i<=lon;i++){
      const a=j*(lon+1)+i,k=a*3,theta=j/lat*Math.PI,phi=i/lon*TAU;
      const vx=Math.sin(theta)*Math.cos(phi),vy=Math.cos(theta),vz=Math.sin(theta)*Math.sin(phi);
      const rr=1/Math.pow(Math.abs(vx)**5+Math.abs(vy)**5+Math.abs(vz)**5,1/5);
      this.base[k]=vx*rr*size;this.base[k+1]=vy*rr*size*.64;this.base[k+2]=vz*rr*size;
      this.heat[a]=.015;this.neighbours[a]=[j*(lon+1)+(i+1)%lon,j*(lon+1)+(i+lon-1)%lon,Math.max(0,j-1)*(lon+1)+i,Math.min(lat,j+1)*(lon+1)+i];
    }
    this.average=0;this.volume=1;this.heatInput=0;this.rebuild();
  }
  step(dt,points){
    const M=this.melt,E=this.heat,T=this.nextHeat,B=this.base,n=M.length,co=Math.cos(this.angle),si=Math.sin(this.angle);let av=0,vol=0,input=0;
    for(let a=0;a<n;a++){
      const k=a*3,bx=B[k]*(1-M[a]),bz=B[k+2]*(1-M[a]);
      const x=this.x+bx*co+bz*si,z=this.z-bx*si+bz*co;
      let heat=0;
      for(const q of points){const dx=x-q.x,dz=z-q.z;heat+=Math.exp(-(dx*dx+dz*dz)/(.28+(q.pressure||.6)*.15))*(.75+Math.max(0,B[k+1]/this.size)*.7)*1.4;}
      const ns=this.neighbours[a];const lap=(E[ns[0]]+E[ns[1]]+E[ns[2]]+E[ns[3]])*.25-E[a];
      T[a]=clamp(E[a]+dt*(heat+lap*4.3-E[a]*.075),0,1.2);input+=heat;
    }
    for(let a=0;a<n;a++){
      E[a]=T[a];const energy=Math.max(0,E[a]-.17);let dm=energy*dt*.145;
      if(dm>0){M[a]=Math.min(.985,M[a]+dm);E[a]=Math.max(.17,E[a]-dm*.42);}
      av+=M[a];vol+=(1-M[a])**3;
    }
    this.average=av/n;this.volume=vol/n;this.heatInput=input/n;
    this.rebuild();
  }
  rebuild(){
    const p=this.g.p,B=this.base,M=this.melt,co=Math.cos(this.angle),si=Math.sin(this.angle);
    let low=Infinity;for(let a=0;a<M.length;a++)low=Math.min(low,B[a*3+1]*(1-M[a]));
    const y=.042-low;
    for(let a=0;a<M.length;a++){
      const k=a*3,scale=1-M[a],x=B[k]*scale,z=B[k+2]*scale;
      p[k]=this.x+x*co+z*si;p[k+1]=y+B[k+1]*scale;p[k+2]=this.z-x*si+z*co;
      this.g.u[a*2]=clamp(this.heat[a],0,1);this.g.u[a*2+1]=M[a];
    }meshNormals(this.g);
  }
  draw(){if(this.volume>.003)add(this.g,28,color('#aed8e3'),[0,0,0],[1,1,1],[0,0,0,1],[this.average,this.index],true);}
}

function initFeel(){
  feel.mode=state.scene;feel.time=0;feel.accumulator=0;feel.sheets=[];feel.ice=[];feel.wax=null;feel.autoTouch=null;feel.releaseRate=0;feel.motion=0;feel.tension=0;feel.heatRate=0;feel.drops=[];feel.steps=0;feel.changed=false;feel.pointer=null;feel.lastSound=0;feel.points=[];feel.pointHistory=new Map();
  if(state.scene<14&&state.scene!==12)return;
  const W=cameraRig.baseW,H=cameraRig.baseH;
  if(state.scene===12){const spacing=Math.max(1.15,W*.27);feel.stripeSpacing=spacing;for(let i=0;i<3;i++)feel.sheets.push(new PeelSheet(12,i,(i-1)*spacing,spacing*.78,H*1.10,-2.10));}else if(state.scene===14||state.scene===15){
    const width=state.scene===14?Math.max(3.4,W*.88):Math.max(3.65,W*.94);
    feel.sheets.push(new PeelSheet(state.scene,0,0,width,H*1.10,-2.10));
  }else if(state.scene===16){
    const spacing=Math.max(1.1,W*.27);feel.stripeSpacing=spacing;
    for(let i=0;i<3;i++)feel.sheets.push(new PeelSheet(16,i,(i-1)*spacing,spacing*.26,H*1.1,-2.12));
  }else if(state.scene===17){feel.wax=new WaxFilm();feel.wax.texture();}
  else if(state.scene===18){
    const sx=W<7?W*.285:Math.min(W*.20,2.4),ss=Math.min(1.17,W*.18);
    const layout=[[-sx,-1.5,ss,.14],[sx,-.7,ss*.88,-.23],[-sx*.6,1.13,ss*.96,.32],[sx*.85,2.33,ss*.76,-.20],[sx*.10,-3.0,ss*.65,.21]];
    for(let i=0;i<layout.length;i++){const [x,z,s,a]=layout[i];feel.ice.push(new MeltingIce(i,x,z,s,a));}
  }
  world.heightScale=1.5;fieldDirty=true;
}
resetScene=function(show=false){feelOriginal.reset(show);if(state.scene===12||(state.scene>=14&&state.scene<=18))initFeel();};
peelStart=function(p,t){
  if((state.scene<14&&state.scene!==12)||state.scene>18)return feelOriginal.start(p,t);
  if(state.scene>16)return;
  const screen=p.sx!==undefined?{x:p.sx,y:p.sy}:toScreen(p.x,p.z,p.y??.05);
  let best=null,hit=null,score=Infinity;
  for(const sh of feel.sheets){const h=sh.pick(screen.x,screen.y);if(h&&(h.dist<score||(h.dist===score&&(h.depth??Infinity)<(hit?.depth??Infinity)))){score=h.dist;best=sh;hit=h;}}
  if(best&&(score<Math.max(74,Math.min(rect.width,rect.height)*.15)||state.watch)){
    const id=t.id??'auto';best.grab(p,id,hit);t.lane=best;t.gripId=id;feel.changed=true;
  }else if(!state.watch){notify('Grab the loose edge. You can lift it again after release.');}
};
processStroke=function(p,prev,t,dt=.016){
  if((state.scene<14&&state.scene!==12)||state.scene>18)return feelOriginal.stroke(p,prev,t,dt);
  if(state.scene<=16){if(!t.lane&&prev===null)peelStart(p,t);if(t.lane)t.lane.move(p,prev,t.gripId??t.id??'auto');}
  if(prev&&Math.hypot(p.x-prev.x,p.z-prev.z)>.003){state.actionCount++;feel.changed=true;}
};
function gatherFeelPoints(dt){
  const points=[];
  if(state.watch){
    const t=feel.time;
    if(state.scene<=16){
      const period=7.0,cycle=t%period,idx=Math.floor(t/period)%feel.sheets.length;
      const sheet=feel.sheets[idx];
      if(!feel.autoTouch||feel.autoTouch.sheet!==sheet||cycle<dt*1.1){
        if(feel.autoTouch?.lane)feel.autoTouch.lane.release('auto');
        const tip=sheet.tip;feel.autoTouch={x:tip.x,z:tip.z,y:tip.y,pressure:.65,id:'auto',sheet};
        peelStart(feel.autoTouch,feel.autoTouch);feel.autoTouch.origin={x:tip.x,z:tip.z};
      }
      const prev={x:feel.autoTouch.x,z:feel.autoTouch.z};
      const p={x:feel.autoTouch.origin.x+Math.sin(cycle*.7)*sheet.width*.07,z:feel.autoTouch.origin.z+smooth01(Math.min(cycle/5.2,1))*3.6,pressure:.65};
      if(cycle<5.3){processStroke(p,prev,feel.autoTouch,dt);points.push(p);}else sheet.release('auto');
      feel.autoTouch.x=p.x;feel.autoTouch.z=p.z;
      if(feel.sheets.every(s=>s.complete)&&cycle>6.6)initFeel();
    }else{
      const rad=state.scene===17?1.18:Math.min(cam.width*.3,2.2);
      points.push({x:Math.sin(t*.47)*rad,z:Math.cos(t*.39)*2.0,pressure:.62,id:'auto'});
    }
  }else for(const [id,t] of touches)points.push({...t,id});
  for(const p of points){const id=p.id??'auto',prev=feel.pointHistory.get(id);p.vx=prev?clamp((p.x-prev.x)/Math.max(dt,.004),-12,12):0;p.vz=prev?clamp((p.z-prev.z)/Math.max(dt,.004),-12,12):0;feel.pointHistory.set(id,{x:p.x,z:p.z});}
  for(const key of feel.pointHistory.keys())if(!points.some(p=>(p.id??'auto')===key))feel.pointHistory.delete(key);
  return points;
}
step=function(dt){
  if((state.scene<14&&state.scene!==12)||state.scene>18)return feelOriginal.step(dt);
  state.time+=dt;state.localTime+=dt;world.time=state.time;feel.time+=dt;state.down=touches.size>0;
  const points=gatherFeelPoints(dt);feel.points=points;feel.pointer=points[0]||null;activePoint=feel.pointer;
  state.contact=points.length?Math.max(...points.map(p=>p.pressure||.6)):.6;
  if(!state.watch)for(const s of feel.sheets){for(const id of s.grips.keys())if(!touches.has(id))s.release(id);}
  feel.accumulator+=Math.min(dt,.067);feel.releaseRate=0;feel.heatRate=0;
  let count=0;
  while(feel.accumulator>=FEEL_DT&&count<8){
    if(state.scene<=16)for(const s of feel.sheets)s.step(FEEL_DT);
    if(state.scene===17)feel.wax.step(FEEL_DT,points);
    if(state.scene===18){for(const b of feel.ice)b.step(FEEL_DT,points);}
    feel.accumulator-=FEEL_DT;count++;feel.steps++;
  }
  if(count>0){feel.releaseRate/=count;feel.heatRate/=count;}
  if(state.scene<=16){
    feel.tension=Math.max(0,...feel.sheets.map(s=>s.tension));
    const totalWidth=feel.sheets.filter(s=>s.active).reduce((n,s)=>n+s.width,0)||1;const target=Math.min(1.2,feel.releaseRate/totalWidth*.60);
    feel.motion=lerp(feel.motion,target,1-Math.exp(-dt*23));
    state.peeled=feel.sheets.reduce((n,s)=>n+s.advance*s.width,0);
    if(feel.releaseRate>.012&&feel.time-feel.lastSound>.037){feel.lastSound=feel.time;const s=feel.sheets.find(s=>s.active)||feel.sheets[0];sensoryGrain(state.scene,s.tip.x,clamp(feel.releaseRate/totalWidth*.16,.018,.19),feel.tension);}
  }
  if(state.scene===17){
    feel.wax.texture();feel.motion=points.length?Math.min(.8,.08+feel.wax.motion*.20+feel.heatRate*6):0;
    state.waxPool=feel.wax.melted;
  }
  if(state.scene===18){
    waveStep(dt);
    if(points.length&&feel.time-state.lastDrop>.064){state.lastDrop=feel.time;for(const p of points){ripple(p.x,p.z,.020,.15);if(feel.drops.length<90)for(let i=0;i<4;i++)feel.drops.push({x:p.x,z:p.z,y:.13,vx:(random()-.5)*.7,vz:(random()-.5)*.7,vy:.7+random()*.7,age:0});}}
    for(const d of feel.drops){d.age+=dt;d.vy-=4.7*dt;d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;}
    feel.drops=feel.drops.filter(d=>d.age<.55&&d.y>.025);
    state.melt=feel.ice.reduce((s,b)=>s+b.average,0)/feel.ice.length;
    feel.motion=lerp(feel.motion,points.length?.45+Math.min(.35,Math.hypot(points[0].vx,points[0].vz)*.02):0,1-Math.exp(-dt*16));
    if(points.length&&feel.time-feel.lastSound>.19){feel.lastSound=feel.time;sensoryGrain(18,points[0].x,.055,.3);}
  }
  materialAudio.motion(state.scene,feel.motion,feel.pointer?.x||0,state.contact);
  if(state.watch&&state.tour){state.tourTime+=dt/state.speed;if(state.tourTime>=45)selectNext(1);}
};

function tube(a,b,r,kind,c){
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz)||1;
  const ux=dx/len,uy=dy/len,uz=dz/len;
  let q=uy<-.999?[1,0,0,0]:V.norm([uz,0,-ux,1+uy]);
  add(G.cylinder,kind,c,[(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5],[r,len,r],q,[.0,.0],false);
}
const materialCue=document.createElement('div');materialCue.id='material-cue';materialCue.setAttribute('aria-hidden','true');materialCue.innerHTML='<span></span>Grab the loose edge';document.body.appendChild(materialCue);
function placeMaterialCue(){
  const show=(state.scene===12||state.scene>=14)&&state.scene<=16&&!feel.changed&&!state.down&&!state.watch&&!state.focus&&feel.time<12;
  materialCue.hidden=!show;if(!show)return;
  const s=feel.sheets[(state.scene===12||state.scene===16)?1:0];if(!s)return;const p=toScreen(s.tip.x,s.tip.z,s.tip.y);
  materialCue.style.left=clamp(p.x,80,innerWidth-80)+'px';materialCue.style.top=clamp(p.y+34,180,innerHeight-230)+'px';
}

draw=function(){
  if((state.scene<14&&state.scene!==12)||state.scene>18){materialCue.hidden=true;return feelOriginal.draw();}
  if(!bridge)return;world.mode=state.scene;batches.begin();
  if(state.scene===12){add(G.floor,25,color('#485d67'),[0,0,0],[1,1,1],[0,0,0,1],[0,0],false);}
  if(state.scene===14){add(G.floor,24,color('#8da8ae'),[0,0,0],[1,1,1],[0,0,0,1],[0,0],false);}
  if(state.scene===15){add(G.floor,25,color('#485d67'),[0,0,0],[1,1,1],[0,0,0,1],[0,0],false);}
  if(state.scene===16){add(G.floor,26,chooseColor(),[0,0,0],[1,1,1],[0,0,0,1],[feel.stripeSpacing,0],false);}
  if(state.scene<=16){
    for(const s of feel.sheets)s.draw();

  }
  if(state.scene===17){
    surface(27,chooseColor(),.21,[0,1],false);
    const w=feel.wax.wick;const f=reduced?1:1+Math.sin(state.time*7)*.024+Math.sin(state.time*11.3)*.020;
    tube([w.x,.30,w.z],[w.x-.04,.56,w.z+.045],.047,15,color('#35281f'));
    add(G.sphere,30,color('#ffe3a0'),[w.x-.04,.93,w.z+.03],[.105,.47*f,.08],[0,0,0,1],[0,0],false);
    add(G.sphere,30,color('#fff5b4'),[w.x-.04,.72,w.z+.075],[.065,.22,.060],[0,0,0,1],[1,0],false);
  }
  if(state.scene===18){
    surface(29,color('#acc7c8'),.025,[0,1],false);for(const b of feel.ice)b.draw();
    for(const p of feel.points||[]){let y=.065;
      for(const b of feel.ice)if(Math.abs(p.x-b.x)<b.size*.86&&Math.abs(p.z-b.z)<b.size*.86)y=Math.max(y,.05+b.size*1.24*(1-b.average));
      const A=[p.x+.85,3.65,p.z-1.15],B=[p.x,y+.045,p.z];tube(A,B,.041,31,color('#c9eaf0'));
      ball(31,color('#d3edf0'),[p.x,y+.024,p.z],[.12,.028,.12],[0,0]);
    }
    for(const d of feel.drops)ball(31,color('#d2eef2'),[d.x,d.y,d.z],[.018,.026,.018],[0,0]);
  }
  if(fieldDirty){encodeField();bridge.upload(fieldBytes,null);}if(dyeDirty){bridge.upload(null,dye);dyeDirty=false;}
  bridge.render(batches.used,world);placeMaterialCue();state.redraw=false;
};

// Audio is driven by release rate or material motion. A held, still peel is quiet.
const oldAudioMotion=MaterialAudio.prototype.motion;
MaterialAudio.prototype.motion=function(mode,amount,x,contact=1){
  if((mode<14&&mode!==12)||mode>18)return oldAudioMotion.call(this,mode,amount,x,contact);
  if(!this.ctx)return;const t=this.ctx.currentTime;this.profile=mode;this.level=lerp(this.level,amount,.20);
  const P={12:[220,950,2600,.11,.065,.016],14:[290,1200,3100,.13,.10,.025],15:[470,2650,4600,.065,.075,.035],16:[330,1770,3700,.12,.11,.029],17:[150,320,850,.095,.016,.005],18:[310,1400,3450,.18,.078,.024]}[mode];
  const a=this.enabled&&!this.hidden?clamp(amount,0,1.5):0;
  this.voices.forEach((v,i)=>{v.filter.frequency.setTargetAtTime(P[i]*(.92+a*.18),t,.025);v.gain.gain.setTargetAtTime(a*P[i+3],t,a>0?.016:.022);v.pan.pan.setTargetAtTime(clamp(x/Math.max(cam.width*.6,2)+(i-1)*.12,-.8,.8),t,.03);v.source.playbackRate.setTargetAtTime(.66+a*.21+i*.07,t,.06);});
};
function sensoryGrain(mode,x,level,tension){
  const a=materialAudio;if(!a.ctx||!a.enabled||a.hidden)return;
  const c=a.ctx,t=c.currentTime,p=c.createStereoPanner(),f=c.createBiquadFilter(),g=c.createGain(),s=c.createBufferSource();
  p.pan.value=clamp(x/Math.max(cam.width*.6,2),-.8,.8);f.type='bandpass';f.Q.value=mode===15?1.1:.68;
  f.frequency.value=(mode===14?1300:mode===15?3100:mode===16?2100:850)*( .78+random()*.5);
  s.buffer=a.noise[mode===15?1:2];s.playbackRate.value=.67+random()*.65;
  const dur=mode===14?.075:mode===15?.038:mode===16?.060:.11;
  g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(Math.min(.17,level)*( .7+tension*.3),t+.0025);g.gain.exponentialRampToValueAtTime(.00001,t+dur);
  s.connect(f);f.connect(g);g.connect(p);p.connect(a.master);s.start(t,random()*2.6);s.stop(t+dur+.02);
  s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();p.disconnect();};
  if(level>.09)pulse('peel',Math.min(1,level*4));
}

syncUI=function(){feelOriginal.sync();const isFeel=state.scene===12||(state.scene>=14&&state.scene<=18);document.body.classList.toggle('feel-scene',isFeel);document.body.dataset.material=state.scene;
  const labels={14:'Grab the loose edge. Pull, release, and pick it up again.',15:'Grab the film edge. Pull sideways to change the fold.',16:'Pull the loose end. A second finger can hold another strip.',17:'Hold to warm. Move to guide the pool.',18:'Hold water on an edge. Watch it soften.',19:'Sweep and press. Let the leaves crackle, break, and flatten.',20:'Move steadily so the resin can find each crack and level out glossy.',21:'Sweep through the pieces and let them snap into neat color rows.',22:'Drag on the table to set a line. Tap a domino to tip the chain.'};
  if(isFeel||state.scene>=19){$('#hint-text').textContent=labels[state.scene]||scenes[state.scene].hint;$('#scene-description').textContent=scenes[state.scene].copy;}
  $('.count').textContent=scenes.length;
};
Object.assign(scenes[14],{title:'Glue on glass',copy:'A little resistance. A slow release.',hint:'Touch the sheet, then drag down. Lift your finger to let it settle.',colors:['#e5ded1','#d1e5df','#e6d9d7'],tool:'New sheet'});
Object.assign(scenes[15],{title:'The first peel',copy:'That untouched surface underneath.',hint:'Touch the film, then pull down. Pull sideways to twist it.',colors:['#b8d5e0','#d3dce0','#c7d7ce'],tool:'Fresh film'});
Object.assign(scenes[16],{title:'Perfect edges',copy:'Just paint, paper, and a clean line.',hint:'Touch a strip. Pull down to reveal the line.',colors:['#668975','#b57b70','#7a96ad'],tool:'New tape'});
Object.assign(scenes[17],{title:'Warm wax',copy:'Soft edges. A smooth, warm pool.',hint:'Hold to warm the wax. Drag to move it. Release to let it settle.',colors:['#e7c18c','#e2b4a8','#e9debd'],tool:'Fresh wax'});
Object.assign(scenes[18],{title:'Ice & warm water',copy:'Stay in one place. Watch it change.',hint:'Hold warm water over an edge. The melted shape stays.',colors:['#a6c8d2','#b4d0c6','#b2c3d7'],tool:'Fresh ice'});
window.__feel={get state(){return feel;},get stats(){return {version:feel.version,steps:feel.steps,scene:state.scene,sheets:feel.sheets.map(s=>({advance:s.advance,length:s.length,releaseCount:s.releaseCount,energy:s.energy,tension:s.tension,maxStrain:s.maxStrain,active:s.active,complete:s.complete,grips:s.grips.size,contactCount:s.contactCount,material:s.material.name,damage:Array.from(s.damage).reduce((a,b)=>a+b,0)/s.damage.length,vertices:s.g.p.length/3,tip:{...s.tip}})),wax:feel.wax?{mass:feel.wax.mass(),initialMass:feel.wax.initialMass,melted:feel.wax.melted,motion:feel.wax.motion}:null,ice:feel.ice.map(b=>({melt:b.average,volume:b.volume,x:b.x,z:b.z,heat:b.heatInput})),releaseRate:feel.releaseRate,motion:feel.motion};},PeelSheet,WaxFilm,MeltingIce,initFeel};

/* The camera is independent of material state. Camera changes never reset a sheet. */
const CAMERA_PRESETS={
 overhead:{label:'Overhead',pitch:88,yaw:0,zoom:1,perspective:false},
 angled:{label:'Angled',pitch:59,yaw:12,zoom:1,perspective:true},
 side:{label:'Low angle',pitch:34,yaw:25,zoom:1,perspective:true},
 close:{label:'Close-up',pitch:48,yaw:-18,zoom:1.5,perspective:true},
 orbit:{label:'Free orbit',pitch:53,yaw:15,zoom:1,perspective:true}
};
const cameraRig={preset:'angled',pitch:59,yaw:12,zoom:1,perspective:true,orbit:false,lift:.95,target:[0,.2,1.0],scene:-1,domain:null,baseH:8.8,baseW:8.8,changed:0,pointers:new Map()};
function perspectiveCamera(eye,target,w,h){
 const c=cameraAt(eye,target,w,h),back=c.back,right=c.right,up=c.up,near=.05,far=100;
 const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-V.dot(right,eye),-V.dot(up,eye),-V.dot(back,eye),1]);
 const dist=Math.hypot(...V.sub(eye,target)),fy=2*dist/h,aspect=w/h;
 const projection=new Float32Array([fy/aspect,0,0,0,0,fy,0,0,0,0,-(far+near)/(far-near),-1,0,0,-2*far*near/(far-near),0]);
 c.vp=mul4(projection,view);c.perspective=true;c.distance=dist;return c;
}
function configureCamera(){
 const aspect=(rect?.width||innerWidth)/(rect?.height||innerHeight);
 if(cameraRig.scene!==state.scene||!cameraRig.domain){
  cameraRig.scene=state.scene;cameraRig.baseW=8.8*aspect;cameraRig.baseH=8.8;cameraRig.domain=[Math.max(4.8,8.8*aspect*1.30),12];
  cameraRig.target=(state.scene===12||state.scene>=14)&&state.scene<=16?[0,.22,1.0]:[0,.12,0];
 }
 world.fieldSpan=cameraRig.domain.slice();
 const h=cameraRig.baseH/cameraRig.zoom,w=h*aspect,p=cameraRig.pitch*Math.PI/180,y=cameraRig.yaw*Math.PI/180,d=14;
 const eye=V.add(cameraRig.target,[Math.sin(y)*Math.cos(p)*d,Math.sin(p)*d,Math.cos(y)*Math.cos(p)*d]);
 cam=cameraRig.perspective?perspectiveCamera(eye,cameraRig.target,w,h):cameraAt(eye,cameraRig.target,w,h);
 world.camera=cam;world.light=cameraAt([-7,16,8],[0,0,1],Math.max(24,world.fieldSpan[0]*1.6),28);state.redraw=true;
}
/* The kit sizes the canvas to #render; the game only re-reads the rectangle for its own camera and picking. */
let relayoutTimer=0;
function resize(){
 rect=$('#render').getBoundingClientRect();if(!rect.width||!rect.height)return;
 configureCamera();state.redraw=true;
 // A much wider view than the material was laid out for (a phone turned sideways, a window
 // stretched out): lay the material out again, or only a strip in the middle would respond.
 const need=()=>Math.max(4.8,8.8*rect.width/rect.height*1.30);
 if(state.ready&&cameraRig.domain&&need()>cameraRig.domain[0]*1.1){
  clearTimeout(relayoutTimer);
  relayoutTimer=setTimeout(()=>{if(need()>cameraRig.domain[0]*1.1){cameraRig.scene=-1;configureCamera();resetScene(false);}},300);
 }
}
function screenRay(cx,cy){
 const sx=((cx-rect.left)/rect.width-.5)*cam.width,sy=(.5-(cy-rect.top)/rect.height)*cam.height;
 const q=V.add(cam.target,V.add(V.mul(cam.right,sx),V.mul(cam.up,sy)));
 return cam.perspective?{origin:cam.eye,direction:V.norm(V.sub(q,cam.eye))}:{origin:q,direction:V.mul(cam.back,-1)};
}
function rayAtHeight(cx,cy,y=.05){
 if(!rect||!cam)return null;const r=screenRay(cx,cy);if(Math.abs(r.direction[1])<1e-5)return null;
 const t=(y-r.origin[1])/r.direction[1];return{x:r.origin[0]+r.direction[0]*t,y,z:r.origin[2]+r.direction[2]*t,sx:cx,sy:cy};
}
function toWorld(cx,cy){const y=state.scene===1?.5:state.scene===0?.3:.05;return rayAtHeight(cx,cy,y);}
function toScreen(x,z,y=.05){
 const a=[x,y,z,1],m=cam.vp;let u=0,v=0,w=0;for(let i=0;i<4;i++){u+=m[i*4]*a[i];v+=m[i*4+1]*a[i];w+=m[i*4+3]*a[i];}
 if(Math.abs(w)<1e-8)w=1e-8;
 return{x:rect.left+(u/w*.5+.5)*rect.width,y:rect.top+(.5-v/w*.5)*rect.height,depth:cam.perspective?w:1};
}
function setCameraView(name){
 const v=CAMERA_PRESETS[name];if(!v)return;
 endAllTouches();Object.assign(cameraRig,{preset:name,pitch:v.pitch,yaw:v.yaw,zoom:v.zoom,perspective:v.perspective,orbit:name==='orbit'});cameraRig.changed++;
 configureCamera();syncCameraUI();
}
function syncCameraUI(){
 $('#view-label').textContent=CAMERA_PRESETS[cameraRig.preset]?.label||'View';
 $$('.view-choice').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===cameraRig.preset));
 $('#camera-orbit').setAttribute('aria-pressed',cameraRig.orbit);$('#orbit-hint').hidden=!cameraRig.orbit;
 document.body.classList.toggle('camera-mode',cameraRig.orbit);
 $('#lens-mode').setAttribute('aria-pressed',cameraRig.perspective);$('#lens-mode').textContent=cameraRig.perspective?'Perspective':'Flat view';
 $('#camera-zoom').value=Math.round(cameraRig.zoom*100);$('#camera-zoom-value').textContent=cameraRig.zoom.toFixed(1)+'×';
 $('#peel-lift').value=Math.round(cameraRig.lift*100);$('#peel-lift-value').textContent=cameraRig.lift<.6?'Low':cameraRig.lift>1.4?'High':'Medium';
 $('#camera-lift-row').hidden=!((state.scene===12||state.scene>=14)&&state.scene<=16);
}
function installCameraUI(){
 const b=document.createElement('button');b.id='view-open';b.className='glass view-button';b.setAttribute('aria-label','Camera views');b.setAttribute('aria-controls','view-dialog');
 b.innerHTML='<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></svg><span id="view-label">Angled</span>';
 $('.top-actions').prepend(b);
 const d=document.createElement('dialog');d.id='view-dialog';d.className='sheet settings-sheet view-sheet';d.setAttribute('aria-labelledby','view-title');
 d.innerHTML=`<div class="sheet-handle"></div><div class="sheet-header"><div><div class="eyebrow">A DIFFERENT POINT OF VIEW</div><h2 id="view-title">Look closer.</h2></div><button class="icon close-sheet" aria-label="Close camera views"><svg><use href="#i-close"/></svg></button></div><p class="sheet-intro">Change the view without changing the material.</p><div class="view-grid">${Object.entries(CAMERA_PRESETS).map(([id,v],i)=>`<button class="view-choice" data-view="${id}" aria-pressed="false"><span class="view-graphic vg-${id}"><i></i><i></i><i></i></span><strong>${v.label}</strong><small>${['See the whole surface','See the lift and fold','See tension at the edge','See the material detail','Turn and zoom the view'][i]}</small></button>`).join('')}</div><div class="setting"><label for="camera-zoom">Zoom <output id="camera-zoom-value">1.0×</output></label><input type="range" id="camera-zoom" min="65" max="210" value="100"></div><div class="view-options"><button id="camera-orbit" class="tool glass" aria-pressed="false">Move camera</button><button id="lens-mode" class="tool glass" aria-pressed="true">Perspective</button><button id="camera-center" class="tool glass">Center view</button></div><p class="view-help">In Move camera: drag to turn. Pinch to zoom. Use two fingers to move the center. Turn this off to touch the material.</p><div class="setting" id="camera-lift-row"><label for="peel-lift">Peel height <output id="peel-lift-value">Medium</output></label><input type="range" id="peel-lift" min="25" max="230" value="95"><p>A low pull folds the sheet back. A high pull lifts it from the surface.</p></div><button class="primary-button view-done">Done</button>`;
 document.body.appendChild(d);
 const pill=document.createElement('div');pill.id='orbit-hint';pill.hidden=true;pill.innerHTML='Drag to turn · Pinch to zoom <button id="orbit-finish">Touch material</button>';document.body.appendChild(pill);
 b.onclick=()=>{syncCameraUI();openDialog('#view-dialog');};
 d.querySelector('.close-sheet').onclick=()=>d.close();d.querySelector('.view-done').onclick=()=>d.close();
 d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
 $$('.view-choice').forEach(b=>b.onclick=()=>setCameraView(b.dataset.view));
 $('#camera-zoom').oninput=e=>{cameraRig.zoom=+e.target.value/100;configureCamera();syncCameraUI();};
 $('#peel-lift').oninput=e=>{cameraRig.lift=+e.target.value/100;syncCameraUI();};
 $('#lens-mode').onclick=()=>{cameraRig.perspective=!cameraRig.perspective;configureCamera();syncCameraUI();};
 $('#camera-center').onclick=()=>{cameraRig.target=(state.scene===12||state.scene>=14)&&state.scene<=16?[0,.22,1]:[0,.12,0];cameraRig.zoom=1;configureCamera();syncCameraUI();};
 $('#camera-orbit').onclick=()=>{endAllTouches();cameraRig.orbit=!cameraRig.orbit;syncCameraUI();};
 $('#orbit-finish').onclick=()=>{cameraRig.orbit=false;cameraRig.pointers.clear();syncCameraUI();};
 const host=$('#render'),pts=cameraRig.pointers;
 host.addEventListener('pointerdown',e=>{if(!cameraRig.orbit)return;e.preventDefault();e.stopImmediatePropagation();host.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});},{capture:true,passive:false});
 host.addEventListener('pointermove',e=>{
  if(!cameraRig.orbit)return;e.preventDefault();e.stopImmediatePropagation();const prev=pts.get(e.pointerId);if(!prev)return;
  const next={x:e.clientX,y:e.clientY},others=[...pts.entries()].filter(([id])=>id!==e.pointerId);
  if(others.length){const other=others[0][1],d0=Math.hypot(prev.x-other.x,prev.y-other.y),d1=Math.hypot(next.x-other.x,next.y-other.y);
   if(d0>12)cameraRig.zoom=clamp(cameraRig.zoom*d1/d0,.65,2.10);
   const scale=cam.height/rect.height*.5,dx=(next.x-prev.x)*scale,dy=(next.y-prev.y)*scale;
   cameraRig.target[0]-=cam.right[0]*dx-cam.up[0]*dy;cameraRig.target[2]-=cam.right[2]*dx-cam.up[2]*dy;
  }else{cameraRig.yaw+=(next.x-prev.x)*.24;cameraRig.pitch=clamp(cameraRig.pitch+(next.y-prev.y)*.18,29,88);}
  pts.set(e.pointerId,next);cameraRig.preset='orbit';configureCamera();syncCameraUI();
 },{capture:true,passive:false});
 for(const ev of['pointerup','pointercancel','lostpointercapture'])host.addEventListener(ev,e=>{if(!cameraRig.orbit&&!pts.has(e.pointerId))return;e.stopImmediatePropagation();pts.delete(e.pointerId);},{capture:true});
 host.addEventListener('wheel',e=>{if(!cameraRig.orbit)return;e.preventDefault();cameraRig.zoom=clamp(cameraRig.zoom*Math.exp(-e.deltaY*.001),.65,2.1);configureCamera();syncCameraUI();},{passive:false});
 syncCameraUI();
}
window.__camera={state:cameraRig,setView:setCameraView,project:(x,y,z)=>toScreen(x,z,y),rayAtHeight,configure:configureCamera};

const physicsSync=syncUI;syncUI=function(){physicsSync();if(document.querySelector('#view-open'))syncCameraUI();};
const physicsBind=bind;bind=function(){physicsBind();installCameraUI();};

/* Still / play session.
 * Full screen needs a direct user gesture. Unsupported locks do not block play.
 * Navigation starts in the lower rail. A material stroke is never a page swipe.
 */
const game={running:false,started:false,entering:false,transition:false,installed:false,
 live:new Set(),swipe:null,cache:new Map(),quietTimer:0,revealTimer:0,introTimer:0,
 wake:null,wakePending:false,full:false,fullSession:false,expectedExit:false,fullResult:'Not requested',
 orientationResult:'Not requested',wakeResult:'Not requested',lock:true,awake:true,
 sound:true,menuResume:false,selection:0,gestureCount:0,session:0};
try{const p=JSON.parse(localStorage.getItem('still-play-session')||'{}');for(const k of ['sound','lock','awake'])if(typeof p[k]==='boolean')game[k]=p[k];}catch(e){}
const playOriginal={bind,sync:syncUI,select:selectScene,reset:resetScene,open:openDialog,
 sound:syncSound,camera:syncCameraUI,step,draw,surface,end:endAllTouches};
/* Extend the visible bed without rescaling its touch/physics texture. */
let gameApron=null,gameApronSpan='';
function extendSurfaceBed(){
 const sx=world.fieldSpan[0],sz=world.fieldSpan[1],key=sx+':'+sz;
 if(!gameApron){gameApron=geometry(new Array(48).fill(0),Array.from({length:48},(_,i)=>i%3===1?1:0),new Array(32).fill(0),[0,2,1,2,3,1,4,6,5,6,7,5,8,10,9,10,11,9,12,14,13,14,15,13]);gameApron.dynamic=true;}
 if(key!==gameApronSpan){gameApronSpan=key;const b=100,quads=[[-b,-b,b,-sz/2],[-b,sz/2,b,b],[-b,-sz/2,-sx/2,sz/2],[sx/2,-sz/2,b,sz/2]];
  let v=0;for(const [x0,z0,x1,z1] of quads)for(const [x,z] of [[x0,z0],[x1,z0],[x0,z1],[x1,z1]]){gameApron.p.set([x,0,z],v*3);gameApron.u.set([x/sx+.5,z/sz+.5],v*2);v++;}gameApron.version=(gameApron.version||0)+1;
 }return gameApron;
}
surface=function(kind,c,y=0,extra=[.1,1],cast=false){
 playOriginal.surface(kind,c,y,extra,cast);
 add(extendSurfaceBed(),kind,c,[0,y,0],[1,1,1],[0,0,0,1],extra,false);
};
const GAME_KEYS=['localTime','palette','tool','angle','cutPhase','cutCount','cutTriggered','reform','soapPhase','soapCount','lastPop','lastDrop','lastClay','lastGrain','lastInk','coat','candyY','candyX','candyZ','candyDrip','painted','peeled','waxPool','melt','leafCrush','resinFill','sortedCount'];
function saveSessionOptions(){try{localStorage.setItem('still-play-session',JSON.stringify({sound:game.sound,lock:game.lock,awake:game.awake}));}catch(e){}}
function gameIsFull(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function installedApp(){return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;}
function stopGameContact(){
 for(const s of feel.sheets||[])if(s.grips)for(const id of [...s.grips.keys()])s.release(id);
 cameraRig.pointers.clear();playOriginal.end();game.live.clear();game.swipe=null;
 feel.points=[];feel.pointHistory?.clear();feel.pointer=null;state.pointer=null;lastActive=null;
 for(const r of touchRings.values())r.remove();touchRings.clear();
 clearTimeout(game.revealTimer);document.body.classList.remove('game-contact','touching');
}
endAllTouches=stopGameContact;
function currentGameSnapshot(){
 // Separate mesh copies protect saved shapes when retained buffers are reused.
 const meshes=[...(feel.sheets||[]),...(feel.ice||[])].filter(o=>o.g).map(o=>({g:o.g,p:o.g.p.slice(),n:o.g.n.slice(),u:o.g.u.slice()}));
 const values={};for(const k of GAME_KEYS)values[k]=state[k];
 return {values,field:field.slice(),velocity:velocity.slice(),dye:dye.slice(),ink:inkF.slice(),
  refs:{particles,slices,curls,bubbleList,beads,dropList,streams,peelLanes,soapRibbons,fluid,leaves,resinCracks,sortBits,dominoes},
  feel:{...feel,autoTouch:null,pointer:null,points:[],pointHistory:new Map(),accumulator:0},meshes,
  camera:{preset:cameraRig.preset,pitch:cameraRig.pitch,yaw:cameraRig.yaw,zoom:cameraRig.zoom,perspective:cameraRig.perspective,
   lift:cameraRig.lift,target:cameraRig.target.slice(),domain:cameraRig.domain?.slice(),baseH:cameraRig.baseH,baseW:cameraRig.baseW},
  heightScale:world.heightScale,inkStep,fieldFrame,seed};
}
function restoreGameSnapshot(s){
 Object.assign(state,s.values);field.set(s.field);velocity.set(s.velocity);dye.set(s.dye);inkF.set(s.ink);
 ({particles,slices,curls,bubbleList,beads,dropList,streams,peelLanes,soapRibbons,fluid,leaves,resinCracks,sortBits,dominoes}=s.refs);
 Object.assign(feel,s.feel);feel.sheets.forEach(sh=>{sh.grips?.clear();sh.active=false;});
 for(const m of s.meshes){m.g.p.set(m.p);m.g.n.set(m.n);m.g.u.set(m.u);m.g.version=(m.g.version||0)+1;}
 Object.assign(cameraRig,s.camera,{target:s.camera.target.slice(),domain:s.camera.domain.slice(),scene:state.scene,orbit:false});
 world.heightScale=s.heightScale;inkStep=s.inkStep;fieldFrame=s.fieldFrame;seed=s.seed;
 fieldDirty=true;dyeDirty=true;state.smoothedSpeed=0;configureCamera();syncUI();state.redraw=true;
}
selectScene=function(i){
 if(!scenes[i])return;if(game.installed&&i===state.scene){closeDialogs();return;}
 stopGameContact();if(game.installed&&state.ready)game.cache.set(state.scene,currentGameSnapshot());
 place.palettes[state.scene]=state.palette;
 const saved=game.cache.get(i);playOriginal.select(i);if(saved)restoreGameSnapshot(saved);
 else if(place.palettes[i]>0&&place.palettes[i]<scenes[i].colors.length){state.palette=place.palettes[i];syncUI();}
 cameraRig.orbit=false;syncCameraUI();game.selection++;if(game.installed){syncPlayUI();showExhibitIntro();}
 if(game.running)markVisited(i);lastPlaceSave=0;
};
// Keep the legacy auto-tour and buttons on the same navigation path.
selectNext=function(direction=1){const pos=order.indexOf(state.scene);selectScene(order[(pos+direction+order.length)%order.length]);};
resetScene=function(show=false){if(game.installed)game.cache.delete(state.scene);stopGameContact();playOriginal.reset(show);if(game.installed){syncPlayUI();showExhibitIntro();}};
function setGameQuiet(v=true){document.body.classList.toggle('game-quiet',v);}
function scheduleQuiet(ms=2700){clearTimeout(game.quietTimer);game.quietTimer=setTimeout(()=>setGameQuiet(true),ms);}
function showExhibitIntro(){
 if(!game.installed||!game.running)return;const e=$('#exhibit-intro');e.classList.add('visible');setGameQuiet(false);
 clearTimeout(game.introTimer);game.introTimer=setTimeout(()=>e.classList.remove('visible'),3000);scheduleQuiet(3400);
}
function syncPlayUI(){
 if(!game.installed)return;const s=scenes[state.scene],idx=order.indexOf(state.scene)+1;
 // Peel and paint use the lower center. Wax uses the upper-left wick.
 document.body.dataset.uiCorner=[0,1,11,12,14,15,16,20].includes(state.scene)?'left':'right';
 document.body.dataset.uiTone=[0,1,2,4,7,9,11,13,14,16,17,18,19,20,21].includes(state.scene)?'light':'dark';
 $('#play-title').textContent=s.title;$('#play-description').textContent=s.hint;
 $('#exhibit-name').textContent=s.title;$('#exhibit-number').textContent=String(idx).padStart(2,'0')+' / '+scenes.length;
 $('#intro-name').textContent=s.title;$('#intro-copy').textContent=s.hint;$('#intro-number').textContent='EXHIBIT '+String(idx).padStart(2,'0')+' / '+scenes.length;
 $('#exhibit-nav').setAttribute('aria-label',s.title+'. Swipe left for the next exhibit, or right for the previous exhibit. Tap for controls.');
 const tool=$('#context-tool');tool.hidden=!s.tool||[2,11,12,14,15,16,17,18].includes(state.scene);tool.textContent=s.tool||'';tool.setAttribute('aria-pressed',state.tool);
 $('#play-colors').hidden=!s.colors?.length;$('#camera-live').hidden=!cameraRig.orbit;$('#play-camera-value').textContent=CAMERA_PRESETS[cameraRig.preset]?.label||'View';
 $('#keep-awake').setAttribute('aria-pressed',game.awake);$('#lock-screen').setAttribute('aria-pressed',game.lock);
 $('#start-audio').checked=game.sound;syncGameStatus();
}
syncUI=function(){playOriginal.sync();syncPlayUI();};
syncSound=function(){playOriginal.sound();if(game.installed){game.sound=materialAudio.enabled;saveSessionOptions();$('#start-audio').checked=game.sound;syncGameStatus();}};
syncCameraUI=function(){playOriginal.camera();if(game.installed)syncPlayUI();};
function syncGameStatus(){
 if(!game.installed)return;game.full=gameIsFull();
 $('#session-screen').textContent=game.full?'Full screen':installedApp()?'App view':'Browser view';
 $('#session-audio').textContent=materialAudio.enabled?'Sound on':'Sound off';
 $('#screen-detail').textContent=game.full?'Full screen is active.':installedApp()?'Running as an installed app.':game.fullResult==='Not requested'?'Start requests full screen.':'Full screen was not granted. Play still fills the browser.';
 $('#orientation-detail').textContent=game.lock?(game.orientationResult==='Locked'?'The current screen direction is locked.':'Lock is requested when the browser permits it.'):'The screen can turn freely.';
 $('#wake-detail').textContent=game.awake?(game.wake&&!game.wake.released?'The screen is held awake during play.':'Keep-awake is requested when the browser permits it.'):'The device can dim the screen.';
 $('#full-action-label').textContent=game.full?'Full screen active':'Enter full screen';
}
async function requestGameWake(){
 if(!game.running||!game.awake||document.hidden||game.wakePending||game.wake&&!game.wake.released)return;
 if(!navigator.wakeLock?.request){game.wakeResult='Unavailable';syncGameStatus();return;}
 game.wakePending=true;const session=game.session;
 try{const w=await navigator.wakeLock.request('screen');if(!game.running||session!==game.session||!game.awake){await w.release();return;}game.wake=w;game.wakeResult='Active';w.addEventListener('release',()=>{if(game.wake===w)game.wake=null;game.wakeResult='Released';syncGameStatus();});}
 catch(e){game.wakeResult='Not granted';}finally{game.wakePending=false;syncGameStatus();}
}
function releaseGameLocks(){
 const w=game.wake;game.wake=null;if(w&&!w.released)w.release().catch(()=>{});
 try{screen.orientation?.unlock?.();}catch(e){}game.orientationResult='Released';syncGameStatus();
}
async function lockGameOrientation(){
 if(!game.running||!game.lock)return;const orientation=screen.orientation;
 if(!orientation?.lock){game.orientationResult='Unavailable';syncGameStatus();return;}
 const type=innerWidth>innerHeight?'landscape':'portrait';const session=game.session;
 try{await orientation.lock(type);if(!game.running||session!==game.session||!game.lock){orientation.unlock();return;}game.orientationResult='Locked';}
 catch(e){game.orientationResult='Not granted';}syncGameStatus();
}
function requestGameFull(){
 // Call this before any await. The browser requires the current user gesture.
 if(gameIsFull()){game.fullResult='Active';game.fullSession=true;return Promise.resolve(true);}
 const root=document.documentElement;try{
  const result=root.requestFullscreen?root.requestFullscreen({navigationUI:'hide'}):root.webkitRequestFullscreen?root.webkitRequestFullscreen():null;
  if(result===null){game.fullResult='Unavailable';syncGameStatus();return Promise.resolve(false);}
  return Promise.resolve(result).then(()=>{game.fullResult=gameIsFull()?'Active':'Not granted';if(gameIsFull())game.fullSession=true;syncGameStatus();return gameIsFull();},()=>{game.fullResult='Not granted';syncGameStatus();return false;});
 }catch(e){game.fullResult='Not granted';syncGameStatus();return Promise.resolve(false);}
}
function enterGame(){
 if(game.entering||!state.ready)return;game.entering=true;game.running=true;game.started=true;game.session++;
 game.sound=$('#start-audio').checked;saveSessionOptions();const full=requestGameFull();
 // Start audio in the same gesture, not after the full-screen promise.
 state.soundTouched=true;if(game.sound)materialAudio.start().then(()=>{if(!game.running)materialAudio.visibility(true);syncSound();});else materialAudio.mute();
 $('#game-entry').hidden=true;document.body.classList.add('game-running');document.body.classList.remove('game-modal','game-contact');
 state.focus=false;state.autoHide=true;document.body.classList.remove('focus-mode');state.paused=false;materialAudio.visibility(false);
 $('#stage').inert=false;$('#stage').focus({preventScroll:true});requestGameWake();showExhibitIntro();syncPlayUI();
 markVisited(state.scene);lastPlaceSave=0;
 full.then(()=>lockGameOrientation()).finally(()=>{game.entering=false;});
}
function pauseGame(reason='pause'){
 if(!game.started)return;game.running=false;game.session++;game.entering=false;stopGameContact();closeDialogs();
 state.paused=true;$('#stage').inert=true;materialAudio.visibility(true);releaseGameLocks();document.body.classList.remove('game-running','game-modal','game-contact');
 $('#entry-eyebrow').textContent='YOUR PLACE IS KEPT';$('#entry-title').textContent='Take your time.';
 $('#entry-copy').textContent='Your material is where you left it. Resume when you are ready.';
 $('#entry-button-text').textContent='Resume';$('#game-entry').hidden=false;$('#start-audio').checked=game.sound;
 $('#enter-game').focus({preventScroll:true});
}
async function leaveGame(){
 game.expectedExit=true;pauseGame('leave');try{if(gameIsFull()){const f=document.exitFullscreen||document.webkitExitFullscreen;if(f)await f.call(document);}}catch(e){}finally{game.expectedExit=false;}
}
openDialog=function(id){
 if(!game.installed)return playOriginal.open(id);if(!game.running)return;
 stopGameContact();closeDialogs();document.body.classList.add('game-modal');state.paused=true;materialAudio.visibility(true);
 if(id==='#scene-dialog')syncVisited();
 const d=$(id);if(!d.open)d.showModal();syncPlayUI();
};
function openPlayMenu(){if(game.running&&!game.transition)openDialog('#play-dialog');}
function onGameDialogClose(){
 queueMicrotask(()=>{if($$('dialog.sheet').some(d=>d.open))return;document.body.classList.remove('game-modal');
  if(game.running){state.paused=false;materialAudio.visibility(false);setGameQuiet(true);requestGameWake();lastPlaceSave=0;
   // Closing a sheet hands focus back to the button that opened it; Space and Enter belong to the material again.
   if(document.activeElement?.closest?.('#game-menu,#exhibit-nav,#camera-live'))$('#stage').focus({preventScroll:true});}
 });
}
async function navigateGame(direction){
 if(!game.running||game.transition||game.live.size||$$('dialog.sheet').some(d=>d.open))return;
 game.transition=true;stopGameContact();setGameQuiet(false);const host=$('#stage');
 const next=order[(order.indexOf(state.scene)+direction+order.length)%order.length];
 const wasPaused=state.paused;state.paused=true;materialAudio.visibility(true);
 try{
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&host.animate)await host.animate([{opacity:1,transform:'translateX(0)'},{opacity:.2,transform:`translateX(${-direction*24}px)`}],{duration:140,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'}).finished;
  if(!game.running)return;selectScene(next);state.paused=true;draw();for(const a of host.getAnimations())a.cancel();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&host.animate)await host.animate([{opacity:.2,transform:`translateX(${direction*24}px)`},{opacity:1,transform:'translateX(0)'}],{duration:210,easing:'cubic-bezier(.2,.7,.3,1)'}).finished;
  game.gestureCount++;showExhibitIntro();
 }catch(e){/* A canceled view transition does not stop the session. */}
 finally{for(const a of host.getAnimations())a.cancel();game.transition=false;state.paused=game.running?wasPaused:true;materialAudio.visibility(!game.running);$('#swipe-feedback').classList.remove('visible');}
}
function bindGameRail(){
 const rail=$('#exhibit-nav'),pill=rail.querySelector('.nav-pill'),feedback=$('#swipe-feedback');
 rail.addEventListener('pointerdown',e=>{
  if(!game.running||game.transition||game.live.size||e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();if(game.swipe){game.swipe.invalid=true;return;}rail.setPointerCapture(e.pointerId);
  game.swipe={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,invalid:false};setGameQuiet(false);clearTimeout(game.quietTimer);rail.classList.add('dragging');
 },{passive:false});
 rail.addEventListener('pointermove',e=>{
  const s=game.swipe;if(!s||s.id!==e.pointerId)return;e.preventDefault();s.dx=e.clientX-s.x;s.dy=e.clientY-s.y;
  const horiz=Math.abs(s.dx)>Math.abs(s.dy)*1.4,dist=Math.abs(s.dx),threshold=Math.min(84,innerWidth*.20);
  if(horiz&&dist>12){const dir=s.dx<0?1:-1,scene=order[(order.indexOf(state.scene)+dir+order.length)%order.length];
   $('#swipe-title').textContent=scenes[scene].title;$('#swipe-icon').setAttribute('href',dir>0?'#i-right':'#i-left');feedback.classList.add('visible');
   pill.style.transform=`translateX(${clamp(s.dx*.14,-30,30)}px)`;feedback.style.opacity=String(clamp(.35+dist/threshold*.65,.35,1));
  }else{feedback.classList.remove('visible');pill.style.transform='';}
 },{passive:false});
 const end=(e,canceled=false)=>{
  const s=game.swipe;if(!s||s.id!==e.pointerId)return;game.swipe=null;rail.classList.remove('dragging');pill.style.transform='';feedback.style.opacity='';feedback.classList.remove('visible');
  if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);
  if(!canceled&&!s.invalid){const ax=Math.abs(s.dx),ay=Math.abs(s.dy);if(ax>=Math.min(84,innerWidth*.20)&&ax>ay*1.4)navigateGame(s.dx<0?1:-1);
   else if(s.dy<-32&&ay>ax*1.2||ax<10&&ay<10)openPlayMenu();}
  scheduleQuiet(1400);
 };
 rail.addEventListener('pointerup',e=>end(e));rail.addEventListener('pointercancel',e=>end(e,true));rail.addEventListener('lostpointercapture',e=>end(e,true));
 rail.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPlayMenu();}});
 rail.addEventListener('click',e=>{if(e.detail===0&&!game.swipe)openPlayMenu();});
}
function installGameMode(){
 const node=document.createElement('div');node.id='game-root';node.innerHTML=`
 <section id="game-entry" class="game-layer" aria-labelledby="entry-title">
  <div class="entry-inner"><div class="entry-mark" aria-label="Still">still.</div><p id="entry-eyebrow" class="entry-eyebrow">${scenes.length} MATERIALS. NO FINISH LINE.</p>
  <h1 class="entry-title" id="entry-title">A little less.<br>A little closer.</h1><p id="entry-copy" class="entry-copy">Touch the material. Follow the feeling.<br>Everything else can wait.</p>
  <button id="enter-game" class="entry-go" disabled><span id="entry-button-text">Start</span><svg><use href="#i-right"/></svg></button>
  <label class="entry-audio"><input id="start-audio" type="checkbox" checked>Sound on. Start with low volume.</label>
  <div class="entry-instructions" id="entry-help"></div></div>
  <p class="entry-foot">START ENTERS FULL SCREEN WHEN AVAILABLE · YOU CAN LEAVE AT ANY TIME</p>
 </section>
 <button id="game-menu" class="game-layer game-control" aria-label="Open game controls" aria-controls="play-dialog"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>
 <div id="exhibit-intro" class="game-layer"><div id="intro-number" class="intro-kicker"></div><h2 id="intro-name"></h2><p id="intro-copy"></p></div>
 <div id="exhibit-nav" class="game-layer" tabindex="0" role="button" aria-controls="play-dialog"><span class="nav-rest"></span><span class="nav-pill"><svg><use href="#i-left"/></svg><span class="nav-middle"><span class="nav-title" id="exhibit-name"></span><span class="nav-count" id="exhibit-number"></span></span><svg><use href="#i-right"/></svg></span></div>
 <div id="swipe-feedback" class="game-layer game-control" aria-hidden="true"><svg><use id="swipe-icon" href="#i-right"/></svg><span id="swipe-title"></span></div>
 <button id="camera-live" class="game-layer game-control" hidden><svg><use href="#i-hand"/></svg>Touch material</button>
 <dialog id="play-dialog" class="sheet" aria-labelledby="play-title"><div class="sheet-handle"></div><div class="sheet-header"><div><div class="eyebrow">THIS MOMENT</div><h2 id="play-title"></h2></div><button class="icon close-sheet" aria-label="Close game controls"><svg><use href="#i-close"/></svg></button></div>
 <p class="sheet-intro" id="play-description"></p><div id="play-actions" class="play-actions"></div>
 <div id="play-colors"><span class="control-label">Material color</span></div><button id="context-tool" aria-pressed="false" hidden></button>
 <div id="menu-links" class="menu-links"></div>
 <button id="pause-play" class="menu-link"><span><svg><use href="#i-pause"/></svg>Pause & leave</span><svg class="arrow"><use href="#i-right"/></svg></button>
 <p id="play-keys" class="play-keys" hidden></p><div class="session-status"><span id="session-screen">Browser view</span><span id="session-audio">Sound off</span></div><button id="game-done" class="primary-button">Back to the material</button>
 </dialog>
 <div id="pad-finger" aria-hidden="true" hidden></div>`;
 document.body.appendChild(node);
 // Reuse the controls and their handlers. The old chrome is no longer shown.
 const actions=$('#play-actions');for(const id of ['sound','view-open','watch','reset'])actions.appendChild($('#'+id));
 $('#reset').className='';$('#reset').insertAdjacentHTML('beforeend','<span>Reset</span>');
 $('#sound').className='';$('#view-open').className='';$('#watch').className='';
 const palette=$('#palette');$('#play-colors').appendChild(palette);
 const links=$('#menu-links'),library=$('#scenes-open'),settings=$('#settings-open');
 library.className='menu-link';library.innerHTML='<span><svg><use href="#i-grid"/></svg>All exhibits</span><span class="secondary"><span class="count">'+scenes.length+'</span> materials</span>';
 settings.className='menu-link';settings.innerHTML='<span><svg><use href="#i-settings"/></svg>Settings</span><svg class="arrow"><use href="#i-right"/></svg>';links.append(library,settings);
 const camText=document.createElement('span');camText.id='play-camera-value';camText.hidden=true;node.appendChild(camText);
 $('#sound-meter').hidden=true;$('#sound-meter').style.display='none';
 const audioLabel=$('#sound').querySelector('span');if(audioLabel)audioLabel.textContent='Sound off';
 $('#play-dialog .close-sheet').onclick=()=>$('#play-dialog').close();$('#game-done').onclick=()=>$('#play-dialog').close();$('#game-menu').onclick=openPlayMenu;
 $('#enter-game').onclick=enterGame;$('#pause-play').onclick=leaveGame;
 $('#start-audio').onchange=e=>{game.sound=e.target.checked;saveSessionOptions();};
 $('#camera-live').onclick=()=>{cameraRig.orbit=false;cameraRig.pointers.clear();syncCameraUI();setGameQuiet(true);};
 $('#context-tool').onclick=()=>{$('#tool').click();syncPlayUI();$('#play-dialog').close();};
 const oldReset=$('#reset').onclick;$('#reset').onclick=()=>{oldReset();$('#play-dialog').close();};
 const oldWatch=$('#watch').onclick;$('#watch').onclick=()=>{oldWatch();$('#play-dialog').close();showExhibitIntro();};
 const settingsMarkup=`<div class="setting-row"><div><strong>Lock screen direction</strong><p id="orientation-detail"></p></div><button id="lock-screen" class="toggle" aria-label="Lock screen direction" aria-pressed="true"><span></span></button></div>
 <div class="setting-row"><div><strong>Keep screen awake</strong><p id="wake-detail"></p></div><button id="keep-awake" class="toggle" aria-label="Keep screen awake" aria-pressed="true"><span></span></button></div>
 <div class="setting-row"><div><strong id="full-action-label">Enter full screen</strong><p id="screen-detail"></p></div><button id="request-full" class="icon close-sheet" aria-label="Request full screen"><svg><use href="#i-full"/></svg></button></div>`;
 $('#settings-dialog .sheet-header').insertAdjacentHTML('afterend',settingsMarkup);
 $('#auto-hide').closest('.setting-row').remove();
 // The old sync does not read the removed auto-hide control. Keep an inert stub for its original handler reference.
 const stub=document.createElement('button');stub.id='auto-hide';stub.hidden=true;node.appendChild(stub);
 $('#lock-screen').onclick=()=>{game.lock=!game.lock;saveSessionOptions();if(game.lock)lockGameOrientation();else{try{screen.orientation?.unlock?.();}catch(e){}game.orientationResult='Released';}syncPlayUI();};
 $('#keep-awake').onclick=()=>{game.awake=!game.awake;saveSessionOptions();if(game.awake)requestGameWake();else{const w=game.wake;game.wake=null;w?.release().catch(()=>{});}syncPlayUI();};
 $('#request-full').onclick=()=>{requestGameFull().then(()=>lockGameOrientation());};
 $('#library-title').textContent='Choose a feeling.';$('#scene-dialog .sheet-intro').textContent='Your place in each exhibit is kept during this visit.';
 for(const d of $$('dialog.sheet')){
  d.addEventListener('close',onGameDialogClose);
  // Swipe down on the header to dismiss; scrolling inside the sheet stays normal.
  const header=d.querySelector('.sheet-header');if(header){let start=null;
   header.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select'))return;start={x:e.clientX,y:e.clientY,id:e.pointerId};header.setPointerCapture(e.pointerId);});
   header.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(dy>55&&dy>Math.abs(dx)*1.5)d.close();});
   header.addEventListener('pointercancel',()=>start=null);
  }
 }
 $('#play-dialog').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();});
 document.addEventListener('pointerdown',e=>{
  if(!e.target.closest?.('#render'))return;
  if(!game.running||game.transition||$$('dialog.sheet').some(d=>d.open)){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.pointerType==='mouse'&&e.button!==0)return;
  clearTimeout(game.revealTimer);clearTimeout(game.quietTimer);game.live.add(e.pointerId);document.body.classList.add('game-contact');
  $('#exhibit-intro').classList.remove('visible');setGameQuiet(true);
 },{capture:true,passive:false});
 const release=e=>{
  if(!game.live.delete(e.pointerId))return;if(!game.live.size){clearTimeout(game.revealTimer);game.revealTimer=setTimeout(()=>{if(!game.live.size)document.body.classList.remove('game-contact');},900);}
 };
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(ev,release,{capture:true});
 function fullChanged(){const now=gameIsFull();game.full=now;const exited=!now&&game.fullSession;if(now)game.fullSession=true;else game.fullSession=false;syncGameStatus();if(exited&&game.running&&!game.expectedExit){game.fullResult='Exited';pauseGame('fullscreen-exit');}}
 document.addEventListener('fullscreenchange',fullChanged);document.addEventListener('webkitfullscreenchange',fullChanged);
 // Reconcile the session flag even when a browser delays the change event.
 setInterval(()=>{if(game.running&&game.fullSession&&!gameIsFull())fullChanged();},300);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.running)pauseGame('hidden');else if(!document.hidden&&game.running)requestGameWake();});
 // Never request full screen on focus. Resume requires another explicit gesture.
 window.addEventListener('focus',()=>{if(!game.running)materialAudio.visibility(true);});
 $('#render').addEventListener('contextmenu',e=>e.preventDefault());
 bindGameRail();game.installed=true;state.autoHide=true;state.focus=false;state.paused=true;$('#stage').inert=true;
 document.body.classList.remove('focus-mode');syncPlayUI();
}
/* Your place between visits: the exhibit, its colour, the camera view and which
 * exhibits you have explored. The material itself starts fresh on a new visit. */
const PLACE_KEY='still-place-v1';
const place={restored:false,visited:new Set(),palettes:{}};
let lastPlaceSave=0;
function restorePlace(){
 try{
  const p=JSON.parse(localStorage.getItem(PLACE_KEY)||'null');if(!p||typeof p!=='object')return;
  if(Array.isArray(p.visited))for(const i of p.visited)if(scenes[i])place.visited.add(i);
  if(p.palettes&&typeof p.palettes==='object')for(const [k,v] of Object.entries(p.palettes)){const i=+k;if(scenes[i]&&Number.isInteger(v)&&v>=0&&v<scenes[i].colors.length)place.palettes[i]=v;}
  if(Number.isInteger(p.scene)&&scenes[p.scene]){state.scene=p.scene;state.palette=place.palettes[p.scene]??0;place.restored=true;}
  const v=p.view;
  if(v&&CAMERA_PRESETS[v.preset]){cameraRig.preset=v.preset;cameraRig.perspective=v.perspective!==false;for(const [k,lo,hi] of [['pitch',29,88],['yaw',-720,720],['zoom',.65,2.1],['lift',.25,2.3]])if(Number.isFinite(v[k]))cameraRig[k]=clamp(v[k],lo,hi);}
 }catch(e){/* a fresh visit */}
}
function savePlace(){
 lastPlaceSave=performance.now();place.palettes[state.scene]=state.palette;
 try{localStorage.setItem(PLACE_KEY,JSON.stringify({scene:state.scene,visited:[...place.visited],palettes:place.palettes,
  view:{preset:cameraRig.preset,pitch:cameraRig.pitch,yaw:cameraRig.yaw,zoom:cameraRig.zoom,perspective:cameraRig.perspective,lift:cameraRig.lift}}));}catch(e){/* private mode */}
}
function markVisited(i){if(!place.visited.has(i)){place.visited.add(i);lastPlaceSave=0;}}
function syncVisited(){
 const n=place.visited.size;
 for(const b of $$('.scene-card'))b.classList.toggle('unvisited',!place.visited.has(+b.dataset.scene));
 $('#scene-dialog .sheet-intro').textContent='Your place in each exhibit is kept during this visit. '+(n>=scenes.length?'You have felt every material.':n+' of '+scenes.length+' explored.');
}
function syncEntryCopy(){
 if(!place.restored||game.started)return;const n=place.visited.size;
 $('#entry-eyebrow').textContent='WELCOME BACK';$('#entry-title').textContent='Where you left off.';
 $('#entry-copy').textContent=scenes[state.scene].title+' is waiting. '+(n?n+' of '+scenes.length+' materials explored.':'Everything else can wait.');
 $('#entry-button-text').textContent='Continue';
}

/* Controls help follows the device in use: touch, mouse and keyboard, or a gamepad. */
const TOUCH_ONLY=matchMedia('(pointer: coarse)').matches&&!matchMedia('(any-pointer: fine)').matches;
const CONTROL_HELP={
 touch:{entry:'<span><svg><use href="#i-hand"/></svg>Touch to play</span><span><svg><use href="#i-left"/></svg>Swipe the lower edge<svg><use href="#i-right"/></svg></span>',
  foot:'Touch the material with one finger or more. Swipe the lower edge: next or previous exhibit. Tap the handle: controls.',keys:''},
 keyboard:{entry:'<span><svg><use href="#i-hand"/></svg>Click and drag</span><span><kbd>W A S D</kbd> + <kbd>Space</kbd> a finger</span><span><kbd>←</kbd> <kbd>→</kbd> exhibits</span>',
  foot:'Mouse: click and drag the material; the wheel zooms. Keyboard: <kbd>W A S D</kbd> move a finger, <kbd>Space</kbd> or <kbd>J</kbd> presses. <kbd>←</kbd> <kbd>→</kbd> or <kbd>Q</kbd> <kbd>E</kbd> change exhibit. <kbd>H</kbd> just watch · <kbd>R</kbd> reset · <kbd>C</kbd> color · <kbd>T</kbd> tool · <kbd>V</kbd> view · <kbd>M</kbd> sound · <kbd>F</kbd> full screen · <kbd>Esc</kbd> menu.',
  keys:'<kbd>W A S D</kbd> move · <kbd>Space</kbd> touch · <kbd>←</kbd> <kbd>→</kbd> exhibit · <kbd>C</kbd> color · <kbd>T</kbd> tool · <kbd>Esc</kbd> back'},
 gamepad:{entry:'<span><kbd>Left stick</kbd> + <kbd>A</kbd> touch</span><span><kbd>LB</kbd> <kbd>RB</kbd> exhibits</span><span><kbd>Start</kbd> menu</span>',
  foot:'Left stick moves a finger; <kbd>A</kbd> or <kbd>RT</kbd> presses. Right stick turns the camera. <kbd>LB</kbd> <kbd>RB</kbd> or the D-pad change exhibit; D-pad up: color, down: tool. <kbd>X</kbd> just watch · <kbd>Y</kbd> reset · <kbd>View</kbd> camera view · right stick click: sound · <kbd>Start</kbd> menu · <kbd>B</kbd> back.',
  keys:'<kbd>A</kbd> touch · <kbd>LB</kbd> <kbd>RB</kbd> exhibit · D-pad up: color · down: tool · <kbd>B</kbd> back'}
};
let helpSource='',sawKeyboard=false;
function syncControlsHelp(){
 if(input.source==='keyboard')sawKeyboard=true;
 const src=input.source==='gamepad'?'gamepad':input.source==='touch'||(TOUCH_ONLY&&!sawKeyboard)?'touch':'keyboard';
 if(src===helpSource)return;helpSource=src;document.body.dataset.input=src;const h=CONTROL_HELP[src];
 $('#entry-help').innerHTML=h.entry;$('#settings-dialog .settings-foot').innerHTML=h.foot;
 const k=$('#play-keys');k.innerHTML=h.keys;k.hidden=!h.keys;
}

/* Keyboard and gamepad play: a virtual finger on the material, exhibit and camera
 * shortcuts, and the game's own sheets, all driven by kit.input actions. Pointer
 * and multi-touch contact stay direct (several fingers, pen pressure). */
const PAD_ID='pad',TOGGLE_TOOLS=new Set([3,4,6,7,8,9,13]);
const pad={x:0,y:0,placed:false,down:false,hold:false,ctx:'',lastUse:-1e9,navDir:'',navAt:0,camDirty:false,shown:null,cx:NaN,cy:NaN,pressed:null};
function sheetFocusables(root){return [...root.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length>0);}
function moveFocus(root,dir){
 // Spatial: the nearest control in that direction (cards sit in a grid), else the next in order.
 const list=sheetFocusables(root);if(!list.length)return;
 const cur=list.includes(document.activeElement)?document.activeElement:null,fwd=dir==='down'||dir==='right';
 let best=null;
 if(cur){
  const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let score=Infinity;
  for(const el of list){if(el===cur)continue;const q=el.getBoundingClientRect(),x=q.left+q.width/2-cx,y=q.top+q.height/2-cy;
   const main=dir==='down'?y:dir==='up'?-y:dir==='right'?x:-x,cross=dir==='down'||dir==='up'?Math.abs(x):Math.abs(y);
   if(main>4&&main+cross*2<score){score=main+cross*2;best=el;}}
  if(!best){const i=list.indexOf(cur);best=list[(i+(fwd?1:-1)+list.length)%list.length];}
 }else best=list[fwd?0:list.length-1];
 best.focus();best.scrollIntoView?.({block:'nearest'});
}
function navRepeat(){
 const v=input.vector('nav'),dir=Math.abs(v.y)>.5?(v.y>0?'up':'down'):Math.abs(v.x)>.5?(v.x>0?'right':'left'):'',now=performance.now();
 if(!dir){pad.navDir='';return '';}
 if(dir!==pad.navDir){pad.navDir=dir;pad.navAt=now+380;return dir;}
 if(now>=pad.navAt){pad.navAt=now+140;return dir;}
 return '';
}
function driveSheet(root){
 const dir=navRepeat(),el=document.activeElement,inside=root.contains(el)&&el!==root;
 if(dir){
  if(inside&&el.matches('input[type=range]')&&(dir==='left'||dir==='right')){
   const step=(+el.max-+el.min)/20||1;el.value=String(clamp(+el.value+(dir==='right'?step:-step),+el.min,+el.max));el.dispatchEvent(new Event('input',{bubbles:true}));
  }else moveFocus(root,dir);
 }
 if(input.pressed('press')){if(inside){if(!el.matches('input[type=range]'))el.click();}else moveFocus(root,'down');}
 if(input.pressed('back')||input.pressed('menu'))root.close();
}
function finishPadContact(){if(game.live.delete(PAD_ID)&&!game.live.size){clearTimeout(game.revealTimer);game.revealTimer=setTimeout(()=>{if(!game.live.size)document.body.classList.remove('game-contact');},900);}}
function releasePad(){if(pad.down){if(touches.has(PAD_ID))contactEnd(PAD_ID);pad.down=false;finishPadContact();}}
function showFinger(active){
 const el=$('#pad-finger');if(!el)return;
 const show=active&&input.source!=='touch'&&(input.source==='gamepad'||pad.down||performance.now()-pad.lastUse<5000);
 if(show!==pad.shown){pad.shown=show;el.hidden=!show;}
 if(!show)return;
 if(pad.cx!==pad.x||pad.cy!==pad.y){pad.cx=pad.x;pad.cy=pad.y;el.style.transform=`translate(${pad.x.toFixed(1)}px,${pad.y.toFixed(1)}px) translate(-50%,-50%)`;}
 if(pad.pressed!==pad.down){pad.pressed=pad.down;el.classList.toggle('down',pad.down);}
}
function driveFinger(dt){
 if(!pad.placed){pad.x=innerWidth*.5;pad.y=innerHeight*.56;pad.placed=true;}
 pad.x=clamp(pad.x,6,innerWidth-6);pad.y=clamp(pad.y,6,innerHeight-6);
 // Anything that ended every contact (a menu, a new exhibit, focus loss) needs a fresh press.
 if(pad.down&&!touches.has(PAD_ID)){pad.down=false;pad.hold=true;finishPadContact();}
 if(pad.hold&&!input.down('press'))pad.hold=false;
 const v=input.vector('hand'),moving=Math.hypot(v.x,v.y)>.04,want=input.down('press')&&!pad.hold;
 if(moving||want)pad.lastUse=performance.now();
 if(moving){const sp=Math.min(innerWidth,innerHeight)*(pad.down?.7:1);pad.x=clamp(pad.x+v.x*sp*dt,6,innerWidth-6);pad.y=clamp(pad.y-v.y*sp*dt,6,innerHeight-6);}
 if(want&&!pad.down){
  if(contactStart(PAD_ID,pad.x,pad.y,state.force)){
   // The finger cursor marks this contact; it needs no touch ring of its own.
   touchRings.get(PAD_ID)?.remove();touchRings.delete(PAD_ID);pad.down=true;game.live.add(PAD_ID);clearTimeout(game.revealTimer);clearTimeout(game.quietTimer);document.body.classList.add('game-contact');$('#exhibit-intro').classList.remove('visible');setGameQuiet(true);}
  else pad.hold=true;
 }else if(want&&moving)contactMove(PAD_ID,pad.x,pad.y,state.force);
 else if(!want&&pad.down){contactEnd(PAD_ID);pad.down=false;finishPadContact();}
}
function cyclePalette(){const s=scenes[state.scene];if(!s.colors?.length)return;state.palette=(state.palette+1)%s.colors.length;if([6,13].includes(state.scene))state.tool=true;syncUI();pulse('soft');notify('Color '+(state.palette+1)+' of '+s.colors.length);lastPlaceSave=0;}
function useTool(){const s=scenes[state.scene];if(!s.tool){notify('This material has no tool.');return;}$('#tool').click();notify(TOGGLE_TOOLS.has(state.scene)?s.tool+(state.tool?' · on':' · off'):s.tool);}
function cycleView(){const keys=Object.keys(CAMERA_PRESETS),next=keys[(keys.indexOf(cameraRig.preset)+1)%keys.length];setCameraView(next);notify(CAMERA_PRESETS[next].label);lastPlaceSave=0;}
function steerCamera(){
 // Right stick turns the view (any time); the wheel zooms (outside Move camera, which has its own).
 const lk=input.look('orbit'),wheel=cameraRig.orbit?0:input.wheel;let changed=false;
 if(lk.x||lk.y){cameraRig.yaw+=lk.x*57.3;cameraRig.pitch=clamp(cameraRig.pitch+lk.y*57.3,29,88);cameraRig.preset='orbit';changed=true;}
 if(wheel){cameraRig.zoom=clamp(cameraRig.zoom*Math.exp(wheel*.1),.65,2.1);changed=true;}
 if(changed){configureCamera();pad.camDirty=true;}
 else if(pad.camDirty){pad.camDirty=false;syncCameraUI();lastPlaceSave=0;}
}
function handleActions(dt){
 if(!state.ready)return;
 const sheet=$$('dialog.sheet').find(d=>d.open)||null,ctx=sheet?'sheet':game.running?'game':'entry';
 if(ctx!==pad.ctx){
  // A new screen: a held button or direction does not carry over into it.
  pad.ctx=ctx;pad.hold=input.down('press');const v=input.vector('nav');
  pad.navDir=Math.abs(v.y)>.5?(v.y>0?'up':'down'):Math.abs(v.x)>.5?(v.x>0?'right':'left'):'';pad.navAt=performance.now()+380;
  // A sheet opens with focus on its first real control, not the close button, so A acts on content.
  if(sheet){const el=document.activeElement;if(!sheet.contains(el)||el.classList.contains('close-sheet'))sheetFocusables(sheet).find(x=>!x.classList.contains('close-sheet'))?.focus({preventScroll:true});}
 }
 if(ctx!=='game'){releasePad();showFinger(false);}
 if(ctx==='sheet'){driveSheet(sheet);return;}
 if(ctx==='entry'){
  if($('#game-entry').hidden)return;
  const dir=navRepeat();if(dir)moveFocus($('#game-entry'),dir);
  const el=document.activeElement;
  if(input.pressed('press')&&el?.id==='start-audio')el.click();
  else if(input.pressed('press')||(input.pressed('menu')&&input.source==='gamepad'))enterGame();
  return;
 }
 if(game.transition){releasePad();showFinger(false);return;}
 if(input.pressed('menu')){releasePad();openPlayMenu();return;}
 if(input.pressed('prev')||input.pressed('next')){releasePad();navigateGame(input.pressed('next')?1:-1);return;}
 if(input.pressed('watch')){setWatch(!state.watch);showExhibitIntro();notify(state.watch?'Just watching. Touch to take over.':'Your hands again.');}
 if(input.pressed('reset'))resetScene(true);
 if(input.pressed('color'))cyclePalette();
 if(input.pressed('tool'))useTool();
 if(input.pressed('view'))cycleView();
 if(input.pressed('sound'))soundToggle();
 if(input.pressed('full'))requestGameFull().then(()=>lockGameOrientation());
 steerCamera();driveFinger(dt);showFinger(true);
}

bind=function(){playOriginal.bind();installGameMode();};
// Read-only diagnostics plus explicit controls for browser regression tests.
window.__play={get state(){return game;},enter:enterGame,pause:pauseGame,leave:leaveGame,navigate:navigateGame,openMenu:openPlayMenu,
 get stats(){return {running:game.running,full:gameIsFull(),fullscreenResult:game.fullResult,orientation:game.orientationResult,wake:game.wakeResult,
  live:game.live.size,transition:game.transition,cache:game.cache.size,scene:state.scene,selection:game.selection,swipes:game.gestureCount,
  uiHidden:document.body.classList.contains('game-contact'),quiet:document.body.classList.contains('game-quiet')};}};

init();
