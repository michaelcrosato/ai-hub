/* Riverblock Ruckus v3 — Lunch Money & Little Motors.
   Original game code, geometry, artwork, and audio.
   Runs on the hub's shared 3D stack: three.js r186 (WebGPU with a WebGL2 fallback) through /lib/kit.
   World: x = street direction, z = lane depth, y = height. */
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, float, dot, sqrt, max, mix as tslMix, texture, screenUV } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
// Static block batches are baked: in r186 every InstancedMesh compiles its own shaders.
import { bakeInstances } from 'kit/instancing.js';

const $=id=>document.getElementById(id), clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), mix=(a,b,t)=>a+(b-a)*t;
const PI=Math.PI, TAU=PI*2;

// ---------- The shared kit: renderer, quality tiers, settings, input on every device ----------
// Street and race read the same actions; each mode shows only its own touch buttons.
const kit=await boot({
 title:'Riverblock Ruckus',
 canvas:$('world'),
 gear:'none',
 accent:'#dbfa72',
 background:'#162d35',
 touch:{top:'right',topOffset:66},
 input:{
  move:{type:'vector',keys:'wasd+arrows',gamepad:'leftStick+dpad',touch:'stick'},
  punch:{keys:['KeyJ','KeyZ'],mouse:[0],gamepad:['X','RT'],touch:'Punch'},
  kick:{keys:['KeyK','KeyX'],mouse:[2],gamepad:['B'],touch:'Kick'},
  jump:{keys:['Space'],gamepad:['A'],touch:'Jump'},
  guard:{keys:['KeyL','KeyC'],gamepad:['LB','LT'],touch:'Guard'},
  use:{keys:['KeyE'],gamepad:['Y'],touch:'Use'},
  special:{keys:['KeyQ'],gamepad:['RB'],touch:'Grit'},
  run:{keys:['ShiftLeft','ShiftRight'],gamepad:['LS']},
  gas:{keys:['KeyJ','ArrowUp','KeyW'],gamepad:['RT','A'],touch:'Gas'},
  brake:{keys:['KeyL','ArrowDown','KeyS'],gamepad:['LT','B'],touch:'Brake'},
  fire:{keys:['KeyK','Space'],gamepad:['X'],touch:'Fire'},
  swap:{keys:['KeyE'],gamepad:['Y'],touch:'Swap'},
  reset:{keys:['KeyR'],gamepad:['Back'],touch:{label:'Reset',slot:'top'}},
  pause:{keys:['Escape','KeyP'],gamepad:['Start']},
  confirm:{keys:['Enter','NumpadEnter'],gamepad:['A']},
  back:{keys:['Backspace'],gamepad:['B']},
  mute:{keys:['KeyM']},
  full:{keys:['KeyF']}
 }
});
const input=kit.input;
kit.loading.progress(.7,'Building the block…');

let seed=73829; function rand(a=0,b=1){seed=(seed*1664525+1013904223)>>>0;return a+(seed/4294967296)*(b-a);} const choice=a=>a[Math.floor(rand(0,a.length))];
const STORE='riverblock-ruckus-v1', PREF='riverblock-options-v1', BEST='riverblock-best-v1', RUMBLE_BEST='riverblock-recess-v1';
function readStore(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function writeStore(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
let prefs=Object.assign({sound:true,music:.35,shake:true,easy:false,rcAuto:false},readStore(PREF)||{});
const lowDetail=()=>kit.tier.detail<.7;
let W=kit.size.width,H=kit.size.height,state='title',helpReturn='title',worldTime=0,elapsed=0;
let camX=5,shake=0,hitStop=0,toastTimer=0,bannerTimer=0,deathTimer=0,victoryTimer=0;
let enemies=[],weapons=[],coins=[],particles=[],labels=[],wavesFX=[],breakables=[];
let stageIndex=-1,cleared=-1,activeFight=false,triggerDelay=0,winStarted=false;
let combo=0,comboTimer=0,bestCombo=0,kills=0,hitsTaken=0,deaths=0,parries=0;
let lastSave=null,weaponId=0,entityId=0;
let hero,friend,shopAt=null,moveInput={x:0,z:0},nextEnemyAttack=0;
let uiClock=0,saveWarning=false;
// 'story' is the campaign; 'rumble' is Recess Rumble, the endless wave mode in the Block High yard.
let mode='story';
const ZMIN=-.05,ZMAX=5.25,LEFT=-5,RIGHT=96,ARENA_L=70,ARENA_R=95;
// Presses are latched here and consumed by the next fixed step, so a tap is never lost or doubled.
const pressed=new Set(),muted=new Set();
const STREET_KEYS=['punch','kick','jump','use','special'];
const HOLDABLE=['punch','kick','jump','guard','use','special','run','fire','brake','swap','reset'];
let guardHeld=0,buffer=null;

const stages=[
 {trigger:-3,gate:17,title:'THE LATE SLIPS',sub:'MALL STREET / FIGHT 01',types:['grunt','grunt','grunt'],x:[8,11.8,14],z:[2,3.7,.7]},
 {trigger:31.5,gate:44,title:'BAD BOOK CLUB',sub:'MALL STREET / FIGHT 02',types:['grunt','runner','grunt','tank'],x:[36,38.8,41.8,40],z:[1,4,2.8,.6]},
 {trigger:47.5,gate:62,title:'THE TRACK RATS',sub:'RAIL YARD / FIGHT 03',types:['thrower','runner','tank','grunt'],x:[54,58,56.5,51],z:[.8,3.8,2.5,4.5]},
 {trigger:66,gate:78,title:'HALL PASS, PLEASE.',sub:'BLOCK HIGH / FIGHT 04',types:['runner','grunt','tank'],x:[72,74.5,76],z:[1.2,3.9,2.8]},
 {trigger:80,gate:95,title:'BIG BELL',sub:'HEAD HALL MONITOR / FINAL FIGHT',types:['boss','grunt','runner'],x:[88,91,84.5],z:[2.5,4.4,.9]}
];
const shops=[{x:20,z:0,type:'food',name:'BUN & DONE'},{x:29,z:0,type:'books',name:'HARD KNOCK BOOKS'},{x:64.5,z:0,type:'food',name:'LAST BITE'}];
const lines=['MY LUNCH!','NOT THE HAIR!','I QUIT!','TIME OUT!','TELL NO ONE!','THAT COUNTS?','OOF.','MY MOM WARNED ME!'];

// ---------- Synthesized music and arcade effects ----------
class Sound {
 constructor(){this.ctx=null;this.master=null;this.music=null;this.next=0;this.step=0;this.timer=null;}
 init(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=prefs.sound?.6:0;this.master.connect(this.ctx.destination);this.music=this.ctx.createGain();this.music.gain.value=prefs.music*.28;this.music.connect(this.master);this.next=this.ctx.currentTime+.1;this.timer=setInterval(()=>this.schedule(),90);}catch(e){return;}}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}
 toggle(){prefs.sound=!prefs.sound;this.apply();savePrefs();}
 // The kit pauses the loop for its settings panel; the music clock stops with it.
 hold(on){if(!this.ctx)return;if(on)this.ctx.suspend().catch(()=>{});else if(!document.hidden)this.ctx.resume().catch(()=>{});}
 apply(){if(this.master)this.master.gain.setTargetAtTime(prefs.sound?.6:0,this.ctx.currentTime,.04);if(this.music)this.music.gain.setTargetAtTime(prefs.music*.28,this.ctx.currentTime,.04);$('titleSound').textContent='SOUND: '+(prefs.sound?'ON':'OFF');$('soundSetting').textContent=prefs.sound?'ON':'OFF';$('muteBtn').textContent=prefs.sound?'♫':'♪';$('muteBtn').style.opacity=prefs.sound?'1':'.6';}
 tone(freq,dur=.1,type='square',vol=.12,when=0,dest=null,slide=0){if(!this.ctx)return;const t=when||this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(30,freq),t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(25,slide),t+dur);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||this.master);o.start(t);o.stop(t+dur+.02);}
 // Noise bursts reuse a few decaying buffers per length instead of filling a new one for every hit and hi-hat.
 noiseBuffer(dur){const len=Math.ceil(this.ctx.sampleRate*dur);this.noiseCache??=new Map();let list=this.noiseCache.get(len);if(!list){list=[];this.noiseCache.set(len,list);}if(list.length<3){const b=this.ctx.createBuffer(1,len,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);list.push(b);return b;}return list[Math.floor(Math.random()*list.length)];}
 noise(dur=.08,vol=.2,when=0,dest=null,cut=2000){if(!this.ctx)return;const t=when||this.ctx.currentTime,b=this.noiseBuffer(dur);const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=cut;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(dest||this.master);s.start(t);s.stop(t+dur);}
 play(kind){if(!this.ctx||!prefs.sound)return;const t=this.ctx.currentTime;
  if(kind==='hit'){this.noise(.075,.45,0,null,1800);this.tone(145,.09,'square',.17,0,null,55);}
  else if(kind==='heavy'){this.noise(.14,.6,0,null,2300);this.tone(95,.2,'sawtooth',.22,0,null,36);}
  else if(kind==='swing'){this.noise(.065,.12,0,null,900);}
  else if(kind==='jump'){this.tone(230,.13,'square',.08,0,null,450);}
  else if(kind==='coin'){this.tone(988,.06,'square',.09);this.tone(1318,.14,'square',.07,t+.05);}
  else if(kind==='guard'){this.tone(460,.08,'triangle',.25);this.noise(.045,.14);}
  else if(kind==='parry'){[660,880,1320].forEach((n,i)=>this.tone(n,.13,'square',.09,t+i*.055));}
  else if(kind==='hurt'){this.tone(220,.18,'sawtooth',.15,0,null,75);this.noise(.09,.25);}
  else if(kind==='buy'){[523,659,784,1047].forEach((n,i)=>this.tone(n,.17,'square',.1,t+i*.07));}
  else if(kind==='special'){this.noise(.28,.4);this.tone(160,.35,'sawtooth',.15,0,null,850);}
  else if(kind==='ko'){this.tone(230,.2,'square',.1,0,null,70);}
  else if(kind==='alert'){this.tone(330,.1,'square',.09);this.tone(440,.13,'square',.09,t+.15);}
  else if(kind==='win'){[523,659,784,1047,784,1047].forEach((n,i)=>this.tone(n,.25,'square',.14,t+i*.14));}
 }
 schedule(){if(!this.ctx)return;const now=this.ctx.currentTime;if(this.next<now-.3)this.next=now+.04;while(this.next<now+.18){if(prefs.sound){if(state==='play')this.note(this.step,this.next);else if(state==='rcRace')Racing.raceNote(this.step,this.next);}this.step++;this.next+=.126;}}
 note(s,t){const root=[48,48,53,55][Math.floor(s/32)%4],note=n=>440*Math.pow(2,(n-69)/12),pattern=[0,7,12,7,3,7,10,7,0,7,15,12,10,7,3,7];const n=pattern[Math.floor(s/2)%16];if(s%2===0)this.tone(note(root+24+n),.13,'square',.12,t,this.music);if(s%4===0)this.tone(note(root+(s%8===0?0:7)),.22,'triangle',.4,t,this.music);if(s%8===0||s%8===5)this.tone(100,.13,'sine',.8,t,this.music,36);if(s%8===4)this.noise(.10,.32,t,this.music,2500);if(s%2===1)this.noise(.027,.12,t,this.music,8000);}
}
const sound=new Sound();

// ---------- Renderer, materials, and geometry ----------
// kit.renderer is WebGPU where the browser has it and WebGL2 otherwise. The look is the original's:
// sRGB output, ACES tone mapping at 1.18 exposure, physical light units (the r140 build already used them).
const EXPOSURE=1.18;
const renderer=kit.renderer;
const canvas=kit.canvas,overlay=$('labels'),ctx=overlay.getContext('2d');
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=EXPOSURE;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#bcdacb');scene.fog=new THREE.Fog('#bcdacb',42,94);
const camera=new THREE.OrthographicCamera(-14,14,8,-8,.1,140);
scene.add(new THREE.HemisphereLight('#eff9df','#759092',2.05));scene.add(new THREE.AmbientLight('#eef0d6',.55));
const sun=new THREE.DirectionalLight('#fff1cb',3.15);sun.position.set(-9,24,14);sun.castShadow=true;kit.shadow(sun,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=21;sun.shadow.camera.bottom=-19;sun.shadow.camera.near=1;sun.shadow.camera.far=72;sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;sun.shadow.radius=2;scene.add(sun);scene.add(sun.target);
const fill=new THREE.DirectionalLight('#c6e5e4',1.0);fill.position.set(9,9,-13);scene.add(fill);
const geometries={box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(.5,.5,1,10),leaf:new THREE.IcosahedronGeometry(1,0)};
const sh=new THREE.Shape();sh.moveTo(-.44,-.44);sh.lineTo(.44,-.44);sh.lineTo(.44,.44);sh.lineTo(-.44,.44);sh.closePath();geometries.bevel=new THREE.ExtrudeGeometry(sh,{depth:.88,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.06,bevelThickness:.06,curveSegments:1});geometries.bevel.translate(0,0,-.44);geometries.bevel.computeVertexNormals();
const mats=new Map();
function mat(color,rough=.77,metal=.02){const key=color+'|'+rough+'|'+metal;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,flatShading:true}));return mats.get(key);}
function meshBox(parent,x,y,z,w,h,d,color,bevel=false){const m=new THREE.Mesh(bevel?geometries.bevel:geometries.box,typeof color==='object'?color:mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function group(parent=scene){const g=new THREE.Group();parent.add(g);return g;}
const batches=new Map(),dummy=new THREE.Object3D();
function block(x,y,z,w,h,d,color,rx=0,ry=0,rz=0,geo='box',cast=true){const key=geo+'|'+color+'|'+cast;if(!batches.has(key))batches.set(key,{geo,color,cast,items:[]});batches.get(key).items.push([x,y,z,w,h,d,rx,ry,rz]);}
function flushBlocks(){for(const b of batches.values()){const m=new THREE.InstancedMesh(geometries[b.geo],mat(b.color),b.items.length);b.items.forEach((a,i)=>{dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4],a[5]);dummy.rotation.set(a[6],a[7],a[8]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.castShadow=b.cast;m.receiveShadow=true;m.frustumCulled=false;scene.add(bakeInstances(m));}batches.clear();}

// Signs were printed straight to the screen, past tone mapping. r186 tone-maps the whole frame, so each
// sign colour first goes through the inverse of that ACES curve and reaches the screen as it was painted.
const ACES_OUT=new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602).invert();
const ACES_IN=new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777).invert().multiplyScalar(.6/EXPOSURE);
const matRows=m=>{const e=m.elements;return [vec3(e[0],e[3],e[6]),vec3(e[1],e[4],e[7]),vec3(e[2],e[5],e[8])];};
const [aceO0,aceO1,aceO2]=matRows(ACES_OUT),[aceI0,aceI1,aceI2]=matRows(ACES_IN);
const untoneMap=Fn(([c])=>{
 // Capped at .9 so the brightest lettering stays near 1.8 in linear light and MSAA edges resolve cleanly.
 const y=vec3(dot(aceO0,c),dot(aceO1,c),dot(aceO2,c)).clamp(0,.9);
 // Invert the RRT/ODT fit per channel: (1-.983729y)v² + (.0245786-.4259068y)v - (.000090537+.238081y) = 0.
 const a=y.mul(-.983729).add(1),b=y.mul(-.4259068).add(.0245786),k=y.mul(.238081).add(.000090537);
 const v=b.negate().add(sqrt(b.mul(b).add(a.mul(k).mul(4)))).div(a.mul(2));
 return max(vec3(dot(aceI0,v),dot(aceI1,v),dot(aceI2,v)),vec3(0));
});
function printedMaterial(tex,params={}){const m=new THREE.MeshBasicNodeMaterial(params);m.colorNode=vec4(untoneMap(texture(tex).rgb),1);return m;}
// About 170 texels per world unit: as sharp as before on screen, a fraction of the texture memory.
const signWidth=(w,max)=>Math.min(max,Math.max(192,Math.ceil(w*170/64)*64));
function sign(text,x,y,z,w,h,bg='#203b41',fg='#fff4d8',sub='',angle=0){const c=document.createElement('canvas');c.width=signWidth(w,1024);c.height=Math.max(Math.round(c.width/8),Math.round(c.width*h/w));const cw=c.width,ch=c.height,k=cw/1024,c2=c.getContext('2d');c2.fillStyle=bg;c2.fillRect(0,0,cw,ch);c2.strokeStyle=fg;c2.globalAlpha=.35;c2.lineWidth=3*k;c2.strokeRect(11*k,7*k,cw-22*k,ch-14*k);c2.globalAlpha=1;c2.fillStyle=fg;c2.textAlign='center';c2.textBaseline='middle';let fs=ch*(sub?.55:.70);c2.font=`900 ${fs}px "Arial Black", "Noto Sans Display", Arial, sans-serif`;while(c2.measureText(text).width>cw-50*k&&fs>4){fs-=2*k;c2.font=`900 ${fs}px "Arial Black", "Noto Sans Display", Arial, sans-serif`;}c2.fillText(text,cw/2,ch*(sub?.41:.53));if(sub){let small=Math.min(28*k,ch*.18);c2.font=`bold ${small}px Courier New`;while(c2.measureText(sub).width>cw-35*k&&small>3){small-=k;c2.font=`bold ${small}px Courier New`;}c2.fillText(sub,cw/2,ch*.79);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),printedMaterial(t));m.position.set(x,y,z);m.rotation.z=angle;scene.add(m);return m;}

function ring(radius,color,opacity=1){const m=new THREE.Mesh(new THREE.RingGeometry(radius*.88,radius,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-PI/2;return m;}
// One soft contact-shadow texture and one plane per size, shared by every fighter and car.
let shadowTex=null;const shadowGeos=new Map();
function shadow(parent,r=.65){if(!shadowTex){const c=document.createElement('canvas');c.width=c.height=64;const c2=c.getContext('2d'),gr=c2.createRadialGradient(32,32,2,32,32,31);gr.addColorStop(0,'rgba(16,34,41,.42)');gr.addColorStop(.5,'rgba(16,34,41,.23)');gr.addColorStop(1,'rgba(16,34,41,0)');c2.fillStyle=gr;c2.fillRect(0,0,64,64);shadowTex=new THREE.CanvasTexture(c);}let g=shadowGeos.get(r);if(!g){g=new THREE.PlaneGeometry(r*3,r*2);shadowGeos.set(r,g);}const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));m.rotation.x=-PI/2;m.position.y=.018;parent.add(m);return m;}
// The original's very light vignette. (Its 2-pixel glow is left out: the printed signs now carry HDR values,
// and a glow on those would ring their lettering.) The kit adds MSAA or FXAA for the tier.
const finish=c=>{const v=screenUV.x.mul(screenUV.y).mul(screenUV.x.oneMinus()).mul(screenUV.y.oneMinus()).mul(16);
 return vec4(c.rgb.mul(tslMix(float(.92),float(1),v.pow(.23))),c.a);};
const post=createPost(kit,scene,camera,{output:finish});
// ---------- The block: a hand-built toy-town diorama ----------
function windowUnit(x,y,z,w=1.25,h=1.6){block(x,y,z,w+.17,h+.18,.15,'#ecdfbc');block(x,y,z+.09,w,h,.06,'#3b6370');block(x-w*.24,y+.08,z+.13,w*.37,h*.82,.01,'#82b9b8',0,0,-.1,'box',false);block(x,y,z+.15,.07,h,.10,'#ecdab4');block(x,y-h*.5-.07,z+.18,w+.35,.16,.3,'#f6e8c8');}
function awning(x,z,w,y,color){const count=Math.round(w/.6);for(let i=0;i<count;i++){const xx=x-w/2+(i+.5)*w/count;block(xx,y,z,w/count-.015,.15,1.42,i%2?'#fff0d1':color,.20);block(xx,y-.25,z+.63,w/count-.015,.40,.12,i%2?'#fff0d1':color);}}
function storefront(x,w,h,wall,trim,name,sub,accent){const front=-4.0;
 block(x,h/2-.1,front-2.25,w,h,4.5,wall);block(x,.35,front+.11,w+.12,.7,.4,trim);block(x,4.5,front+.13,w+.28,.25,.36,trim);block(x,h+.06,front-2.25,w+.4,.28,4.95,trim);block(x,h+.38,front-4.4,w+.1,.52,.28,wall);
 block(x,h-.17,front+.15,w+.4,.35,.4,'#efe0b9');
 for(let i=-1;i<=1;i++)windowUnit(x+i*w*.27,6.13,front+.07,w*.19,1.58);
 const door=x+w*.21;block(door,1.46,front+.17,1.55,2.84,.20,trim);block(door,1.50,front+.29,1.28,2.48,.04,'#335c68');block(door+.46,1.34,front+.35,.05,.48,.06,'#e4c780');
 const sx=x-w*.20;block(sx,1.65,front+.17,w*.45,2.56,.17,trim);block(sx,1.7,front+.28,w*.41,2.22,.04,'#315862');block(sx-w*.08,1.91,front+.34,w*.16,1.56,.015,'#82bcbd',0,0,.16,'box',false);block(sx,1.7,front+.38,.11,2.23,.12,trim);block(sx,1.31,front+.38,w*.43,.09,.12,trim);
 awning(x,front+.8,w+.2,3.38,accent);block(x,4.09,front+.26,w*.92,.98,.2,trim);sign(name,x,4.10,front+.38,w*.88,.88,trim,'#fff0d0',sub);
 sign('OPEN',door,1.82,front+.36,.83,.28,'#f3e4bd','#d96045');
 // Brick joints and drainpipe add scale without texture noise.
 for(let j=0;j<4;j++)for(let k=0;k<Math.floor(w/1.3);k++)block(x-w/2+.65+k*1.3+(j%2)*.3,4.85+j*.43,front+.014,.8,.025,.035,'#b99778',0,0,0,'box',false);
 block(x+w/2-.18,3.4,front+.25,.12,6.8,.17,trim);
 block(x-w*.18,h+.5,front-2.3,1.45,.8,1.1,'#abb8a8');for(let j=0;j<4;j++)block(x-w*.18-.45+j*.29,h+.5,front-1.72,.06,.45,.03,'#758e87');
}
function tree(x,z,s=1,autumn=false){block(x,.4,z,2*s,.75,1.7*s,'#d5b691',0,0,0,'bevel');block(x,.79,z,1.73*s,.08,1.42*s,'#6b7960');block(x,2.05*s,z,.32*s,2.8*s,.32*s,'#836748');block(x-.4*s,2.8*s,z,.23*s,1.3*s,.23*s,'#836748',0,0,-.65);const cols=autumn?['#d79545','#e8b95d','#d3a35b']:['#4d866c','#6ca57c','#82b184','#aec78b'];for(let i=0;i<11;i++){const a=i*2.399;const r=i===0?0:rand(.25,1.06)*s;block(x+Math.cos(a)*r,3.5*s+rand(-.25,.55)*s,z+Math.sin(a)*r,rand(.7,1.15)*s,rand(.8,1.25)*s,rand(.7,1.2)*s,cols[i%cols.length],rand(-.3,.3),rand(0,TAU),rand(-.2,.2),'leaf');}}
function lamp(x,z){block(x,.14,z,.48,.28,.48,'#233d42',0,0,0,'bevel');block(x,2.5,z,.14,4.8,.14,'#365252');block(x+.40,4.78,z,1.05,.13,.15,'#365252');block(x+.86,4.57,z,.45,.43,.45,'#2b4c4f',0,0,0,'bevel');block(x+.86,4.5,z,.32,.23,.32,'#ffe3a0',0,0,0,'box',false);}
function bench(x,z){for(let i=0;i<4;i++)block(x,.66,z-.32+i*.20,2,.10,.16,'#b88759',0,0,0,'bevel');for(let i=0;i<3;i++)block(x,1.05+i*.18,z-.46,2,.13,.13,'#cb9b63');for(const s of [-1,1]){block(x+s*.76,.34,z,.11,.60,.64,'#325153');block(x+s*.8,.98,z-.43,.10,1.2,.10,'#325153');}}
function fence(x,w,z,y=1.05){for(let xx=x-w/2;xx<=x+w/2;xx+=.42)block(xx,y,z,.055,y*2,.07,'#50716d');block(x,y*2-.12,z,w,.085,.13,'#50716d');block(x,.25,z,w,.09,.13,'#50716d');for(let xx=x-w/2;xx<=x+w/2;xx+=3)block(xx,y,z,.13,y*2+.16,.16,'#3e5e60');}
function vending(x,z){block(x,1.23,z,1.18,2.46,.85,'#ce6551',0,0,0,'bevel');block(x-.12,1.43,z+.46,.71,1.64,.035,'#254a56');for(let r=0;r<4;r++)for(let c=0;c<3;c++){block(x-.35+c*.23,.82+r*.39,z+.50,.13,.25,.04,['#f1c45d','#85c3a4','#e7e1b5'][(r+c)%3]);block(x-.35+c*.23,.80+r*.39,z+.525,.15,.05,.014,'#e2e6cc');}block(x+.43,1.17,z+.49,.12,.25,.05,'#eed584');block(x,.36,z+.49,.60,.20,.05,'#1e4147');sign('POP!',x,2.25,z+.47,.98,.26,'#edddad','#b95240');}
function buildWorld(){
 block(44,-.34,-6,145,.6,70,'#527e85',0,0,0,'box',false);
 block(44,-.05,2.6,145,.14,7.3,'#577e88',0,0,0,'box',false);
 block(44,.1,-2.15,145,.22,3.4,'#d8cfb3',0,0,0,'box',false);
 block(44,.10,6.8,145,.22,2.3,'#d8c1a0',0,0,0,'box',false);
 block(44,.12,-.43,145,.28,.32,'#f1e2c2',0,0,0,'box',false);block(44,.12,5.64,145,.28,.35,'#e9d7b4',0,0,0,'box',false);
 for(let x=-26;x<119;x+=1.35){block(x,.22,-1.83,.025,.012,2.8,'#c0b697',0,0,0,'box',false);block(x,.23,6.82,.03,.01,1.7,'#b99e82',0,0,0,'box',false);if(Math.floor(x)%4===0)block(x,.012,2.95,.045,.008,6.0,'#5e848d',0,0,0,'box',false);}
 for(let z=-3.5;z<-.6;z+=.82)block(44,.219,z,145,.015,.027,'#bfb495',0,0,0,'box',false);
 // Short crosswalk, patched asphalt, storm drains.
 for(let z=.2;z<5.4;z+=.75)block(5,.03,z,2.3,.015,.40,'#c1c9b8',0,0,0,'box',false);
 for(let x=-5;x<100;x+=15){block(x,.03,5.16,1.12,.02,.43,'#395f69',0,0,0,'box',false);for(let k=0;k<6;k++)block(x-.44+k*.18,.044,5.16,.055,.01,.35,'#80999a',0,0,0,'box',false);}
 for(let i=0;i<48;i++){const x=rand(-15,104),z=rand(.2,5.2);block(x,.03,z,rand(.04,.11),.015,rand(.07,.17),'#799299',0,rand(0,TAU),0,'box',false);}
 // Soft, layered skyline and square clouds.
 for(let x=-30;x<130;x+=rand(4,7)){const h=rand(9,16),z=rand(-24,-17);block(x,h/2,z,rand(4,7),h,rand(3,5),choice(['#a9c4bc','#aac2b5','#bdd0bc','#99b8b5']));for(let y=3;y<h-1;y+=1.8)for(let k=-1;k<=1;k++)block(x+k*1.3,y,z+2.7,.50,.9,.08,'#cfdbc4',0,0,0,'box',false);}
 for(let i=0;i<13;i++){const x=-25+i*12;block(x,rand(15,19),-32,rand(5,9),.9,1.2,'#e3e8cf',0,0,0,'bevel',false);}
 storefront(-10,9,7.8,'#dcac82','#537777','SPIN CYCLE','LAUNDRY · 24 HOURS','#6ca58e');
 storefront(0,10,8.1,'#deaf89','#985f4a','MUNCH CLUB','BURGERS · FRIES · GOOD TIMES','#d6704d');
 storefront(10,9.8,8.7,'#86ada0','#346772','SIDE QUEST','ARCADE & SODA','#3e8e97');
 storefront(20,9.7,7.8,'#e0c39a','#966848','BUN & DONE','FRESH BUNS · FULL HEARTS','#df7654');
 storefront(29.4,8.7,8.5,'#85aaa2','#355965','HARD KNOCK BOOKS','READ UP. HIT HARDER.','#417680');
 sign('EAT HERE',16.3,5.74,-3.62,1.12,1.52,'#d77351','#fff0d0','',-.06);
 // A roof billboard and water tank.
 block(-1.3,9.6,-5.5,.15,2.5,.15,'#576d61');block(2.3,9.6,-5.5,.15,2.5,.15,'#576d61');block(.5,10.3,-5.5,5.7,1.9,.24,'#26434b');sign('STAY HUNGRY.',.5,10.3,-5.35,5.4,1.65,'#33545c','#f5d28a','RIVERBLOCK / EST. 1989');
 block(11,9.9,-6.4,1.4,1.9,1.4,'#bca783',0,0,0,'cyl');block(11,10.9,-6.4,1.7,.17,1.7,'#517270',0,0,0,'cyl');
 for(let i=0;i<8;i++){const x=3+i*3.8,y=9.8-Math.sin(i/7*PI)*.9;block(x,y,-3.8,.9,.55,.04,choice(['#df865b','#edce75','#71a98f']),0,0,rand(-.15,.15),'box',false);}
 // Underpass retaining wall and overhead railway.
 block(48,2.65,-5.6,27,5.3,2.2,'#a9b1a0');block(48,5.45,-5.1,28,.5,4.6,'#c2c4ae');block(48,6.05,-4.6,28,.8,.42,'#467576');block(48,5.94,-3.4,28,.45,.35,'#355e63');
 for(let x=35;x<=61;x+=3){block(x,6.05,-4.25,.18,.78,.22,'#abc0ab');block(x+1.45,6.03,-4.23,2.9,.11,.1,'#abc0ab',0,0,.22);}
 for(const x of [35,46.5,60.5]){block(x,2.35,-3.5,1.25,4.7,1.65,'#c4c1a6');block(x,4.57,-3.5,1.72,.4,1.9,'#d4cdb0');block(x,.45,-3.5,1.58,.9,1.88,'#a8b29f');}
 block(51.3,2.15,-4.41,7.2,4.3,.12,'#314f59');for(let i=0;i<10;i++)block(48.15+i*.7,2.2,-4.27,.1,4.12,.08,'#587c7e');block(51.3,3.84,-4.18,7.25,.20,.2,'#779896');sign('NO RUNNING',40.5,3.28,-4.44,3.15,.73,'#e6dfb9','#43656b','(EXCEPT RIGHT NOW)');sign('RATS RULE',56.8,2.23,-4.40,3.8,1.4,'#a9b1a0','#3f726b','',-.09);
 for(let i=0;i<16;i++){const x=34+i*1.7;block(x,5.82,-5.8,1.2,.18,3.5,'#786e5a');}block(48,6.03,-6.65,28,.2,.1,'#486365');block(48,6.03,-5,28,.2,.1,'#486365');
 // High school, green iron gate, and brick walls.
 block(81,5.55,-9.5,29,11.1,6.7,'#d4b780');block(81,11.15,-9.5,29.6,.32,7.1,'#738b79');block(81,7,-6.01,29.3,.26,.2,'#efdbb0');
 for(let x=68.5;x<=94;x+=3)for(let y=4.8;y<10.5;y+=2.95)windowUnit(x,y,-6,1.8,1.75);
 block(81,9.1,-5.8,4.4,3.65,.5,'#ecd5a9');sign('BLOCK HIGH',81,8.2,-5.48,4.1,.86,'#294c51','#f1dfb5');
 const clock=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.07,24),mat('#f3e3c0'));clock.rotation.x=PI/2;clock.position.set(81,9.7,-5.48);scene.add(clock);block(81,9.92,-5.42,.06,.42,.06,'#3d5552');block(81.19,9.7,-5.41,.44,.05,.07,'#3d5552');
 for(const a of [[70,12],[91.5,10]]){const [x,w]=a;block(x,1.32,-3.27,w,2.64,.6,'#c99566');block(x,2.73,-3.27,w+.3,.21,.84,'#e3c999');for(let y=.4;y<2.6;y+=.42)for(let xx=x-w/2;xx<x+w/2;xx+=1.2)block(xx+(Math.round(y*10)%2)*.55,y,-2.95,1.1,.028,.015,'#e1b07d',0,0,0,'box',false);}
 for(const x of [77,85]){block(x,2.05,-3.25,.92,4.1,1,'#d5bb87');block(x,4.18,-3.25,1.19,.22,1.2,'#eddaa6');}fence(81,7.1,-3.2,1.65);sign('BLOCK HIGH',70,1.6,-2.9,4.2,1.05,'#dec79a','#3c5a51','NO LATE LUNCHES');
 // Basketball hoop off to one side.
 block(91,3,-2.5,.14,6,.14,'#4c6b61');block(90.1,5.65,-2.43,2.6,1.57,.16,'#f3e5c2');block(90.1,5.45,-2.30,.87,.62,.025,'#a5634b');block(90.1,5.45,-2.26,.72,.48,.024,'#f3e5c2');const hoop=new THREE.Mesh(new THREE.TorusGeometry(.38,.045,6,20),mat('#c87545'));hoop.rotation.x=PI/2;hoop.position.set(90.1,5.10,-1.96);scene.add(hoop);
 for(const x of [-16,-5,33,62,69,97])tree(x,-1.95,x===33?.95:1.02,x>=69);for(const x of [-7,15,36,64,94])lamp(x,-.99);
 bench(13.5,-1.8);bench(68,-1.85);bench(94,-1.7);vending(6.2,-3.04);vending(45,-2.28);vending(64.3,-2.7);
 // A tiny safe food stand before the final school fights.
 block(64.7,1,-2.3,2.7,1.7,1.1,'#bf8555',0,0,0,'bevel');awning(64.7,-2.2,3.15,2.62,'#70977a');sign('LAST BITE',64.7,1.27,-1.68,2.25,.6,'#355d57','#f4d692');
 // Foreground set dressing frames the road, without hiding the fighters.
 for(const x of [-13,23,50,72,101]){tree(x,8.7,.82,x>60);}
 fence(40,9,7.75,.65);fence(79,8,7.75,.7);
 // Posters, paper scraps, utility poles, wires, and road arrows.
 sign('BLOCK PARTY',-3.4,2.04,-3.75,.8,1.1,'#f1cc76','#43605a','FRIDAY',.025);sign('READ. REPEAT.',32.9,2.0,-3.75,.85,1.1,'#d8e6b0','#37636c');
 for(const x of [-18,34,65,102]){block(x,5.5,-8,.27,11,.27,'#6a7160');block(x,10.25,-8,2.4,.12,.2,'#6a7160');}
 const wirePoints=[];for(let i=0;i<50;i++){const x=-18+i*2.5;wirePoints.push(new THREE.Vector3(x,10.1-Math.abs(Math.sin((x+18)/33*PI))*.7,-7.85));}const wire=new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePoints),new THREE.LineBasicMaterial({color:'#596f66',transparent:true,opacity:.6}));scene.add(wire);
 for(const x of [23.5,44,63,79]){sign('→',x,.55,-.48,1.4,.55,'#d8cfb3','#6d9187');}
 flushBlocks();
}
buildWorld();

// ---------- Chunky fighters and street objects ----------
const defs={
 hero:{name:'NICO',shirt:'#fff1d0',jacket:'#328987',pants:'#426d94',skin:'#e7b18b',hair:'#293633',hp:100,speed:4.5},
 grunt:{name:'LATE SLIP',shirt:'#d98156',jacket:null,pants:'#506984',skin:'#e4af84',hair:'#3f3d35',hp:56,speed:2.2},
 runner:{name:'FAST EDDIE',shirt:'#8baf6e',jacket:null,pants:'#465677',skin:'#bc895f',hair:'#343932',hp:48,speed:3.15},
 tank:{name:'DETENTION DAN',shirt:'#a187af',jacket:null,pants:'#465e72',skin:'#e3b78b',hair:'#644b39',hp:90,speed:1.72},
 thrower:{name:'POCKET PETE',shirt:'#d0b363',jacket:'#786b53',pants:'#486880',skin:'#cd986e',hair:'#2d3835',hp:52,speed:2.3},
 boss:{name:'BIG BELL',shirt:'#294c58',jacket:'#365e69',pants:'#294355',skin:'#d3a379',hair:'#364036',hp:420,speed:2.65},
 friend:{name:'LUNCH CREW',shirt:'#e4b74d',jacket:null,pants:'#598683',skin:'#edba8f',hair:'#78543a',hp:100,speed:0},
 // Recess Rumble: rolls in fast, lines up in your lane, then dashes straight through it.
 skater:{name:'SKATE KID',shirt:'#6fb3c4',jacket:null,pants:'#3f5770',skin:'#d9a57c',hair:'#b9773c',hp:44,speed:3.6}
};
// Fighters and props are built from dozens of boxes. Inside each moving part, boxes that share a material
// become one mesh, so a fighter draws in about fifteen calls instead of sixty (and the same again for shadows).
function mergeMeshes(parent,geos){for(const child of parent.children)if(child.isGroup)mergeMeshes(child,geos);const buckets=new Map();for(const m of parent.children)if(m.isMesh&&!m.isInstancedMesh){if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(m);}
 for(const [material,list] of buckets){if(list.length<2)continue;let count=0;const parts=list.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);count+=g.attributes.position.count;return g;});
  const pos=new Float32Array(count*3),nor=new Float32Array(count*3),uv=new Float32Array(count*2);let off=0;for(const g of parts){const n=g.attributes.position.count;pos.set(g.attributes.position.array,off*3);if(g.attributes.normal)nor.set(g.attributes.normal.array,off*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,off*2);off+=n;g.dispose();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.computeBoundingSphere();geos.push(geo);
  const merged=new THREE.Mesh(geo,material);merged.castShadow=list.some(m=>m.castShadow);merged.receiveShadow=true;for(const m of list)parent.remove(m);parent.add(merged);}}
function dropProp(o){scene.remove(o.mesh);o.geos?.forEach(g=>g.dispose());}
function makeActor(type,x,z,index=0){const d=defs[type],a={id:entityId++,type,name:d.name,x,z,y:0,vy:0,vx:0,vz:0,face:type==='hero'?1:-1,hp:d.hp,maxHp:d.hp,speed:d.speed,stun:0,down:0,dead:false,deathT:0,attack:null,cool:rand(.55,1.4),invuln:0,walk:0,walkSpeed:0,wind:0,windTotal:0,aiT:0,bossPhase:0,specialCool:2.8,shown:0,index,carried:false,thrown:false,hitChain:0};
 a.root=group();a.facing=group(a.root);a.facing.rotation.y=a.face*1.32;a.model=group(a.facing);const m=a.model;let s=type==='boss'?1.28:type==='tank'?1.08:1;
 a.scale=s;m.scale.setScalar(s);a.baseScale=s;
 a.torso=group(m);a.torso.position.y=.95;
 meshBox(a.torso,0,.39,0,.94,.90,.56,d.shirt,true);
 if(d.jacket){meshBox(a.torso,-.36,.4,.305,.25,.86,.07,d.jacket,true);meshBox(a.torso,.36,.4,.305,.25,.86,.07,d.jacket,true);meshBox(a.torso,0,.49,-.29,.94,.80,.05,d.jacket);}
 if(type==='hero'){meshBox(a.torso,0,.61,.31,.34,.10,.015,'#536e5d');meshBox(a.torso,0,.41,.32,.23,.11,.015,'#d9ac61');}
 if(type==='boss'){meshBox(a.torso,.28,.62,.355,.18,.22,.055,'#e4bb5a',true);meshBox(a.torso,0,.44,.346,.095,.74,.03,'#e2c889');meshBox(a.torso,0,.06,.32,.98,.16,.045,'#202f33');meshBox(a.torso,0,.07,.355,.21,.15,.025,'#c1a065');}
 meshBox(m,0,.87,0,.89,.19,.58,d.pants,true);
 a.legL=group(m);a.legL.position.set(-.255,.86,0);a.legR=group(m);a.legR.position.set(.255,.86,0);
 for(const leg of [a.legL,a.legR]){meshBox(leg,0,-.30,0,.37,.63,.43,d.pants,true);meshBox(leg,0,-.69,.14,.43,.27,.72,type==='boss'?'#243436':'#efead5',true);meshBox(leg,0,-.8,.15,.45,.065,.73,'#29404a');if(type!=='boss')meshBox(leg,0,-.62,.24,.45,.07,.13,'#d2d4c0');}
 a.armL=group(a.torso);a.armL.position.set(-.60,.63,0);a.armR=group(a.torso);a.armR.position.set(.60,.63,0);
 for(const arm of [a.armL,a.armR]){meshBox(arm,0,-.12,0,.34,.37,.40,d.jacket||d.shirt,true);meshBox(arm,0,-.38,.02,.32,.30,.35,d.skin,true);meshBox(arm,0,-.58,.065,.41,.35,.43,d.skin,true);if(type==='hero')meshBox(arm,0,-.37,.015,.355,.11,.38,'#e6ce83');}
 a.head=group(a.torso);a.head.position.y=1.13;
 meshBox(a.head,0,0,0,1.10,.91,.83,d.skin,true);meshBox(a.head,0,-.34,.06,.82,.27,.77,d.skin,true);
 for(const x of [-.59,.59])meshBox(a.head,x,-.06,0,.20,.33,.32,d.skin,true);
 meshBox(a.head,0,.43,-.10,1.20,.38,.91,d.hair,true);meshBox(a.head,-.36,.27,-.03,.42,.33,.89,d.hair,true);meshBox(a.head,.40,.29,-.03,.29,.27,.89,d.hair,true);const quiff=meshBox(a.head,.13,.64,.12,.87,.24,.64,d.hair,true);quiff.rotation.z=-.08;
 meshBox(a.head,-.45,.14,-.1,.20,.40,.82,d.hair);meshBox(a.head,.47,.14,-.1,.17,.39,.82,d.hair);
 meshBox(a.head,-.23,.018,.431,.16,.18,.04,'#f7ecd2');meshBox(a.head,.23,.018,.431,.16,.18,.04,'#f7ecd2');meshBox(a.head,-.19,.011,.461,.095,.14,.045,'#263c38');meshBox(a.head,.28,.011,.461,.095,.14,.045,'#263c38');
 const bl=meshBox(a.head,-.24,.155,.467,.32,.105,.07,d.hair);bl.rotation.z=-.14;const br=meshBox(a.head,.245,.16,.467,.32,.105,.07,d.hair);br.rotation.z=.12;
 meshBox(a.head,.015,-.17,.49,.15,.15,.17,d.skin,true);meshBox(a.head,.055,-.33,.452,.33,.055,.03,'#885645');
 if(type==='hero'){meshBox(a.head,0,.277,.446,1.14,.105,.044,'#df7956');meshBox(a.head,-.63,.255,-.32,.39,.11,.17,'#df7956',true);}
 if(type==='runner'){meshBox(a.head,0,.01,.481,.9,.13,.045,'#b9c297');meshBox(a.head,-.25,.04,.515,.34,.25,.09,'#354c49',true);meshBox(a.head,.25,.04,.515,.34,.25,.09,'#354c49',true);}
 if(type==='boss'){meshBox(a.head,0,.43,.47,1.27,.13,.34,'#273f48',true);meshBox(a.head,0,.57,.03,1.23,.24,.97,'#344f57',true);meshBox(a.head,0,.53,.539,.2,.14,.055,'#d6b65f');}
 if(type==='skater'){meshBox(a.head,0,.52,.02,1.2,.2,.97,'#e07d4f',true);meshBox(a.head,0,.47,.52,1.0,.06,.34,'#e07d4f');meshBox(m,0,0,.05,.66,.06,1.55,'#e07d4f',true);meshBox(m,0,.032,.05,.5,.012,1.3,'#2f4a50');for(const bz of [-.5,.6]){meshBox(m,0,-.05,bz,.5,.04,.12,'#9fb0a8');for(const bx of [-.22,.22])meshBox(m,bx,-.09,bz,.12,.08,.14,'#f3e6c0');}}
 a.shadow=shadow(scene,type==='boss'?.89:.66);
 if(type==='hero'){a.ring=ring(.65,'#a7efcb',.8);a.ring.position.y=.025;scene.add(a.ring);a.money=3.25;a.grit=35;a.power=0;a.speedBoost=0;a.heart=0;a.weapon=null;a.carry=null;}
 if(type==='boss'){a.warning=ring(1,'#ef825f',.7);a.warning.visible=false;scene.add(a.warning);}
 const localMaterials=new Map();a.model.traverse(o=>{if(o.isMesh){if(!localMaterials.has(o.material))localMaterials.set(o.material,o.material.clone());o.material=localMaterials.get(o.material);}});a.materials=[...localMaterials.values()];a.geos=[];mergeMeshes(a.model,a.geos);a.root.position.set(x,0,z);return a;
}
function removeActor(a){scene.remove(a.root,a.shadow);for(const r of [a.ring,a.warning])if(r){scene.remove(r);r.geometry.dispose();r.material.dispose();}a.materials?.forEach(m=>m.dispose());a.geos?.forEach(g=>g.dispose());a.shadow.material.dispose();}
function animateActor(a,dt){
 if(a.carried&&hero?.carry===a){a.x=hero.x;a.z=hero.z;a.y=hero.y+2.75;a.face=hero.face;}
 const down=a.down>0||a.dead||a.carried;
 // Turn the whole fighter. Do not mirror its scale or turn its face to the camera.
 // A 76-degree stance keeps the side profile clear in this street-view camera.
 a.root.position.set(a.x,a.y,a.z);a.facing.rotation.y=a.face*1.32;
 a.model.scale.setScalar(a.baseScale);a.model.rotation.set(0,0,0);a.model.position.set(0,0,0);
 a.torso.rotation.set(0,0,0);a.head.rotation.set(0,0,0);
 a.armL.rotation.set(-.22,0,-.12);a.armR.rotation.set(-.22,0,.12);
 a.legL.rotation.set(0,0,0);a.legR.rotation.set(0,0,0);
 a.armR.position.set(.60,.63,0);a.armL.position.set(-.60,.63,0);
 a.torso.position.y=.95;a.head.position.y=1.13;
 const leadArm=a.face>0?a.armL:a.armR,rearArm=a.face>0?a.armR:a.armL;
 const leadLeg=a.face>0?a.legL:a.legR,rearLeg=a.face>0?a.legR:a.legL;
 leadArm.rotation.x=-.42;leadLeg.position.z=.12;rearLeg.position.z=-.10;
 const moving=a.walkSpeed>.1&&!down;a.walk+=dt*(moving?Math.max(5,a.walkSpeed*3):2);
 if(!down){
  // The model's local +Z is forward. Swing limbs around X, not around Z.
  if(moving){const phase=Math.sin(a.walk);a.legL.rotation.x=phase*.63;a.legR.rotation.x=-phase*.63;a.armL.rotation.x=-phase*.60-.18;a.armR.rotation.x=phase*.60-.18;a.model.position.y=Math.abs(phase)*Math.min(.10,a.walkSpeed*.02);a.torso.rotation.x=.035;}
  else a.torso.position.y+=Math.sin(worldTime*3+a.id)*.018;
  // A skater rides the board: lifted onto it, legs set, leaning into the roll.
  if(a.type==='skater'){a.model.position.y=.12;if(moving){a.legL.rotation.x=.12;a.legR.rotation.x=-.12;a.armL.rotation.x=-.45;a.armR.rotation.x=.25;a.torso.rotation.x=.12;}}
  if(a.y>.14){leadLeg.rotation.x=-.65;rearLeg.rotation.x=.40;leadArm.rotation.x=-.75;rearArm.rotation.x=.35;}
  if(a.wind>0){a.model.position.z=-.1;leadArm.rotation.x=.70;rearArm.rotation.x=-.25;a.torso.rotation.x=-.14;a.head.rotation.x=.11;rearLeg.rotation.x=.15;}
  if(a.weapon?.type==='bat')leadArm.rotation.x=-1.05;
  if(a.attack){const at=a.attack,p=clamp(at.t/at.duration,0,1),s=Math.sin(clamp((p-.12)/.60,0,1)*PI);a.model.position.z=s*.19;
   if(at.kind==='kick'||at.kind==='dropkick'){leadLeg.rotation.x=-s*1.65-.05;leadLeg.rotation.z=-a.face*.10;leadArm.rotation.x=s*.35-.50;rearArm.rotation.x=s*.55;a.torso.rotation.x=-s*.14;if(at.kind==='dropkick'){rearLeg.rotation.x=-s*1.15;a.model.rotation.x=-.16;}}
   else if(at.kind==='spin'){a.model.rotation.y=at.t/at.duration*TAU*2;a.armL.rotation.set(0,0,-1.55);a.armR.rotation.set(0,0,1.55);leadLeg.rotation.x=-.9;}
   else{const arm=at.chain===2?rearArm:leadArm;arm.rotation.x=-s*1.8;arm.position.z=s*.12;a.torso.rotation.y=(arm===a.armL?1:-1)*s*.18;a.head.rotation.x=-s*.07;}
  }
  if(a===hero&&guardHeld>0&&!a.attack){a.armL.rotation.set(-1.95,0,-.12);a.armR.rotation.set(-1.95,0,.12);a.armL.position.y=a.armR.position.y=.70;a.torso.position.y=.90;}
  if(a.carry||a.weapon?.type==='bin'){a.armL.rotation.set(-2.85,0,-.12);a.armR.rotation.set(-2.85,0,.12);a.armL.position.y=a.armR.position.y=.88;}
  if(a.stun>0){a.head.rotation.x=-.2;a.torso.rotation.x=-.14;rearArm.rotation.x=.3;}
 }else{
  // Fall onto the back in the fighter's own frame. The face stays with the body.
  a.model.rotation.x=-PI/2;a.model.position.y=.48;a.armR.rotation.x=.4;a.armL.rotation.x=-.7;a.legR.rotation.x=.3;if(a.carried)a.model.position.z=.8;
 }
 a.shadow.position.set(a.x,.021,a.z);a.shadow.scale.setScalar(clamp(1-a.y*.11,.42,1));a.shadow.material.opacity=a.dead?clamp(1-a.deathT*.38,0,1):1;
 a.root.visible=!(a.dead&&a.deathT>1.8)&&(a.invuln<=0||Math.floor(worldTime*18)%2===0||a.attack?.kind==='spin');
 const flash=a.shown>.85?.26:0;for(const m of a.materials)m.emissive.setRGB(flash,flash*.65,flash*.36);
 if(a.ring){a.ring.position.set(a.x,.026,a.z);a.ring.material.opacity=guardHeld?.95:.64;a.ring.scale.setScalar(1+Math.sin(worldTime*4)*.025);}
 if(a.warning){a.warning.visible=a.wind>0&&a.pending==='stomp';a.warning.position.set(a.x,.04,a.z);a.warning.scale.setScalar(1+(1-a.wind/(a.windTotal||1))*2.6);}
}
// Put the held bat at the hand after the current pose has been applied.
// This is a visual change only. Weapon damage, range, and throwing stay unchanged.
const gripPoint=new THREE.Vector3(),gripOffset=new THREE.Vector3();
const batGripRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),PI);
function syncHeldWeapon(){
 const w=hero.weapon;if(!w||!w.held||w.type!=='bat')return;
 const arm=hero.face>0?hero.armL:hero.armR;hero.root.updateMatrixWorld(true);
 gripPoint.set(0,-.58,.065);arm.localToWorld(gripPoint);
 arm.getWorldQuaternion(w.mesh.quaternion);w.mesh.quaternion.multiply(batGripRotation);
 gripOffset.set(0,-.50,0).applyQuaternion(w.mesh.quaternion);
 w.mesh.position.copy(gripPoint).sub(gripOffset);
}

function weaponModel(type){const g=group();
 if(type==='bat'){meshBox(g,0,0,0,.14,1.62,.14,'#c19358',true);meshBox(g,0,-.50,0,.155,.39,.155,'#405354',true);meshBox(g,0,-.77,0,.21,.1,.21,'#e0b977',true);meshBox(g,0,.55,0,.19,.48,.19,'#dbb276',true);}
 else if(type==='bin'){meshBox(g,0,0,0,.91,1.07,.77,'#7f9999',true);meshBox(g,0,.57,0,1.02,.12,.87,'#b8c3b7',true);meshBox(g,0,.68,0,.31,.11,.13,'#667f80',true);for(let i=-1;i<=1;i++)meshBox(g,i*.27,0,.394,.055,.91,.055,'#bfcbba');for(const x of [-.50,.50])meshBox(g,x,.28,0,.12,.12,.28,'#486b72',true);}
 else{const m=new THREE.Mesh(geometries.leaf,mat('#c6cbb7'));m.scale.setScalar(.23);g.add(m);}
 return g;
}
function spawnWeapon(type,x,z,air=false){const w={id:++weaponId,type,x,z,y:air?1.5:.15,vx:0,vz:0,vy:air?3:0,held:false,flying:false,hostile:false,durability:type==='bat'?9:4,hit:new Set(),rest:0,life:air?12:Infinity,mesh:weaponModel(type),geos:[]};mergeMeshes(w.mesh,w.geos);w.mesh.position.set(x,w.y,z);if(!air)w.mesh.rotation.z=PI/2;weapons.push(w);return w;}
function spawnCrate(x,z){const g=group();g.position.set(x,.58,z);meshBox(g,0,0,0,1.04,1.13,.86,'#ae7e51',true);for(const z0 of [-.46,.46]){meshBox(g,0,-.39,z0,1.12,.16,.08,'#dbb279');meshBox(g,0,.40,z0,1.12,.16,.08,'#dbb279');meshBox(g,-.4,0,z0,.15,1,.09,'#d4aa72');meshBox(g,.4,0,z0,.15,1,.09,'#d4aa72');const p=meshBox(g,0,0,z0,1.13,.14,.07,'#d8ae74');p.rotation.z=.71;}const b={x,z,hp:23,mesh:g,dead:false,geos:[]};mergeMeshes(g,b.geos);breakables.push(b);return b;}
function clearProps(){for(const w of weapons)dropProp(w);for(const b of breakables)dropProp(b);weapons=[];breakables=[];}
function initProps(){clearProps();spawnWeapon('bat',4.1,3.8);spawnWeapon('bin',14.9,1.35);spawnWeapon('bat',33.8,3.7);spawnWeapon('bin',43.1,4.25);spawnWeapon('bat',59.8,1);spawnWeapon('bin',75.7,4.6);spawnCrate(7,4.8);spawnCrate(31.5,1.1);spawnCrate(48.4,4.75);spawnCrate(68.5,4.8);}
hero=makeActor('hero',10.4,2.8);hero.face=1;hero.money=3.25;hero.grit=35;hero.power=hero.speedBoost=hero.heart=0;
enemies=[makeActor('grunt',13.6,2.25),makeActor('runner',17.0,3.2),makeActor('tank',20.5,1.1)];initProps();
friend=makeActor('friend',84.0,-2.1);friend.root.visible=false;friend.shadow.visible=false;

// ---------- Impact, coin, and score effects ----------
// Chips, coins and swipes come from pools and shared geometry: no new meshes or materials in a fight.
const particlePool=[],swipePool=[],swipeGeo=new THREE.RingGeometry(.55,.68,20,1,-PI*.45,PI*.95);
const coinGeo=new THREE.CylinderGeometry(.18,.18,.075,12),coinMidGeo=new THREE.CylinderGeometry(.113,.113,.081,12);
function freeParticle(m){scene.remove(m);particlePool.push(m);}
function burst(x,y,z,color,n=8,power=4){for(let i=0;i<n;i++){if(particles.length>100)break;const size=rand(.07,.17);const m=particlePool.pop()||new THREE.Mesh(geometries.box,mat(color));m.material=mat(color);m.scale.setScalar(size);m.position.set(x,y,z);m.rotation.set(rand(0,PI),rand(0,PI),rand(0,PI));scene.add(m);particles.push({mesh:m,vx:rand(-power,power),vy:rand(1,power+2),vz:rand(-power*.55,power*.55),life:rand(.25,.6),max:.6});}}
function floatText(text,x,y,z,color='#fff4d8',size=20,life=.75,style='number'){labels.push({text,x,y,z,color,size,life,max:life,style});}
function say(text,a){labels.push({text,x:a.x,y:3.1*a.baseScale,z:a.z,color:'#18313a',size:12,life:1.7,max:1.7,style:'speech'});}
function swipe(a,color='#fff3b0'){const m=swipePool.pop()||new THREE.Mesh(swipeGeo,new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false}));m.material.color.set(color);m.material.opacity=.8;m.scale.setScalar(1);m.position.set(a.x+a.face*.85,a.y+1.25,a.z+.25);m.rotation.set(0,0,a.face===1?-.3:PI+.3);scene.add(m);wavesFX.push({mesh:m,life:.16,max:.16,kind:'slash'});}
function dropCoins(x,z,count=3,value=1.25){for(let i=0;i<count;i++){const g=group(),m=new THREE.Mesh(coinGeo,mat('#ffc849',.35,.45));m.rotation.x=PI/2;g.add(m);const mid=new THREE.Mesh(coinMidGeo,mat('#ffe899',.3,.3));mid.rotation.x=PI/2;g.add(mid);g.position.set(x,.8,z);coins.push({mesh:g,x,z,y:.8,vx:rand(-1.8,1.8),vz:rand(-1,1),vy:rand(3.6,5.5),value,age:0,type:'coin'});}}
function dropFood(x,z){const g=group();meshBox(g,0,0,0,.38,.25,.34,'#e7ba62',true);meshBox(g,0,-.06,0,.42,.06,.36,'#678d4c');g.position.set(x,.7,z);coins.push({mesh:g,x,z,y:.7,vx:0,vz:0,vy:3,age:0,type:'food',value:18});}
function addCombo(){combo++;comboTimer=2.9;bestCombo=Math.max(bestCombo,combo);if(combo>=3){$('combo').classList.remove('hidden');$('comboNumber').textContent=String(combo).padStart(2,'0');$('comboWord').textContent=combo>=15?'BLOCK LEGEND!':combo>=9?'BIG TROUBLE!':combo>=5?'KEEP IT UP!':'NICE WORK!';}}
function toast(text,seconds=2.5){$('toast').textContent=text;$('toast').classList.remove('hidden');toastTimer=seconds;}
function banner(title,sub,duration=2.3){$('bannerTitle').textContent=title;$('bannerSub').textContent=sub;$('banner').classList.remove('hidden');bannerTimer=duration;}
function cameraHit(amount=.1,stop=.045){if(prefs.shake)shake=Math.max(shake,amount);hitStop=Math.max(hitStop,stop);}
function attackCrate(b,damage){if(b.dead)return;b.hp-=damage;burst(b.x,.8,b.z,'#d5ad75',5);sound.play('hit');if(b.hp<=0){b.dead=true;dropProp(b);burst(b.x,.8,b.z,'#be9564',12,4);dropCoins(b.x,b.z,2,.75);dropFood(b.x+.3,b.z);floatText('SNACK STASH!',b.x,1.9,b.z,'#efffa9',15,1);}}

// ---------- Input and action rules ----------
// Every device arrives as a kit action. A button still held when a menu closes stays quiet until it is let go.
function held(action){return !muted.has(action)&&input.down(action);}
function tap(action){pressed.add(action);}
function resetInput(){pressed.clear();guardHeld=0;buffer=null;for(const a of HOLDABLE)if(input.down(a))muted.add(a);input.settle();}
function canAct(a){return !a.dead&&a.stun<=0&&a.down<=0&&!a.carried;}
function startAttack(a,kind){if(!canAct(a)||a.attack||a.cool>0)return false;
 if(a===hero){if(guardHeld>0)return false;if(a.carry){if(kind==='kick'||kind==='punch'){throwBody();return true;}}
  if(a.weapon&&kind==='kick'){throwWeapon();return true;}
  if(kind==='punch'&&a.weapon)kind='swing';
  if(a.y>.22&&(kind==='kick'||kind==='punch'))kind='dropkick';
  const near=enemies.filter(e=>!e.dead&&!e.carried&&Math.abs(e.z-a.z)<1.15&&Math.abs(e.x-a.x)<2.3).sort((b,c)=>Math.abs(b.x-a.x)-Math.abs(c.x-a.x))[0];if(near&&Math.abs(moveInput.x)<.12)a.face=near.x>=a.x?1:-1;
 }
 if(kind==='punch'){a.chain=(worldTime-(a.lastAttack||-10)<.82)?(a.chain||0)%3+1:1;}else a.chain=0;
 const heavy=kind==='kick'||kind==='dropkick'||kind==='swing';const duration=kind==='spin'?.65:heavy?.44:.31;
 a.attack={kind,t:0,duration,at:kind==='spin'?.11:heavy?.17:.105,hit:false,chain:a.chain,targets:new Set()};a.lastAttack=worldTime;a.cool=duration+(kind==='kick'?.055:.045);a.wind=0;
 if(a===hero){sound.play('swing');if(kind==='dropkick'){a.vx=a.face*4.6;a.vy=Math.max(a.vy,1.7);}if(kind==='spin'){a.invuln=.9;a.grit=0;sound.play('special');banner('RECESS SPIN!','MAKE SOME ROOM.',.75);} }
 return true;
}
function doHeroHit(a,at){const kind=at.kind,spin=kind==='spin',reach=spin?3.7:kind==='swing'?(a.weapon?.type==='bin'?2.3:2.65):kind==='dropkick'?2.35:kind==='kick'?1.95:1.57;
 const dmg=(spin?29:kind==='swing'?19:kind==='dropkick'?20:kind==='kick'?15:at.chain===3?18:10)+(a.power||0);
 let didHit=false;
 for(const e of enemies){if(e.dead||e.carried||at.targets.has(e.id))continue;const dx=e.x-a.x,dz=e.z-a.z;if((spin?Math.hypot(dx,dz)<reach:(dx*a.face>-.35&&dx*a.face<reach&&Math.abs(dz)<(kind==='dropkick'?1.05:.83)))&&Math.abs(e.y-a.y)<2.15){at.targets.add(e.id);hitEnemy(e,dmg,a.face,(spin||kind==='dropkick'||at.chain===3||kind==='swing')?1:0);didHit=true;}}
 for(const b of breakables){if(!b.dead&&Math.abs(b.z-a.z)<.9&&(b.x-a.x)*a.face>-.25&&(b.x-a.x)*a.face<reach){attackCrate(b,dmg);didHit=true;}}
 swipe(a,spin?'#caf8a0':'#fff2c1');
 if(didHit&&a.weapon&&kind==='swing'){a.weapon.durability--;if(a.weapon.durability<=0){const w=a.weapon;a.weapon=null;dropProp(w);weapons=weapons.filter(v=>v!==w);burst(a.x,a.y+1.5,a.z,'#ddc99d',8);toast('Weapon worn out. Keep those fists up.',1.5);}}
}
function hitEnemy(e,damage,dir,knock=0,fromThrow=false){if(e.dead||e.invuln>0||e.carried)return false;
 // Big Bell braces during each telegraph. Punish the recovery, not the wind-up.
 const boss=e.type==='boss',armored=boss&&(e.wind>0||e.charge>0||e.pending==='land'||!!e.attack);
 if(armored)damage=Math.max(1,Math.round(damage*.62));
 e.hp=Math.max(0,e.hp-damage);e.shown=1;e.hitChain++;
 e.stun=armored?0:boss?.13:.24;e.vx=armored?0:dir*(boss?(knock?1.6:.6):(knock?6.4:2.0));e.vz=0;
 if(!armored){e.attack=null;e.wind=0;e.cool=Math.max(e.cool,boss?.20:.55);}
 if(knock&&!boss&&e.hp>0){e.down=1.12;e.vy=3.7;e.y=Math.max(e.y,.02);}
 e.invuln=.10;
 burst(e.x,e.y+1.4,e.z+.25,knock?'#ffd384':'#fff0c5',kit.detail(8,4));floatText(String(damage),e.x,e.y+2.65,e.z,knock?'#ffe789':'#fff4d8',knock?25:19);
 sound.play(knock?'heavy':'hit');cameraHit(knock?.14:.07,knock?.065:.035);if(knock)input.rumble(.3,60);addCombo();hero.grit=clamp(hero.grit+(fromThrow?8:6),0,100);
 if(combo%5===0)floatText(choice(['WHAM!','BONK!','POW!']),e.x+.2,e.y+2.0,e.z,'#f5edac',34,.62,'comic');
 if(e.hp<=0){killEnemy(e);}
 return true;
}
function killEnemy(e){e.dead=true;e.down=2;e.deathT=0;e.wind=0;e.attack=null;e.vy=4.5;e.vx=hero.face*4.8;kills++;sound.play('ko');dropCoins(e.x,e.z,e.type==='boss'?12:e.type==='tank'?4:3,e.type==='boss'?2:1.25);say(e.type==='boss'?'I WANT MY MOM.':choice(lines),e);if(e.type==='boss'){cameraHit(.35,.11);burst(e.x,2,e.z,'#ffdb6c',18,6);input.rumble(.8,260);}if(mode==='rumble')rumbleKO(e);}
function hitHero(damage,source,knock=false){if(state!=='play'||hero.dead||hero.invuln>0||hero.down>0||hero.attack?.kind==='spin')return false;
 const front=(source.x-hero.x)*hero.face>=-.3;
 if(guardHeld>0&&front&&hero.y<.2){if(guardHeld<.22){parries++;sound.play('parry');hero.grit=clamp(hero.grit+19,0,100);hero.invuln=.30;source.stun=.95;source.wind=0;source.charge=0;source.attack=null;source.vx=-hero.face*3;source.cool=1.1;floatText('PARRY!',hero.x,2.9,hero.z,'#daff9a',25,.7,'comic');burst(hero.x+hero.face*.6,1.65,hero.z,'#ddffb0',10);cameraHit(.09,.07);input.rumble(.25,50);if(mode==='rumble')rumble.score+=50;return false;}
  sound.play('guard');hero.grit=clamp(hero.grit+9,0,100);damage=Math.max(1,Math.ceil(damage*.18));hero.invuln=.26;hero.vx=-hero.face*.8;floatText('BLOCK',hero.x,2.7,hero.z,'#adf1d6',15,.5);
 }else{hero.stun=knock?.36:.23;hero.vx=(hero.x>=source.x?1:-1)*(knock?6:3.6);hero.invuln=.78;hero.attack=null;hero.cool=.27;combo=0;comboTimer=0;hitsTaken++;sound.play('hurt');cameraHit(knock?.19:.13,.07);input.rumble(knock?.75:.45,knock?190:110);$('vignette').classList.add('hurt');setTimeout(()=>$('vignette').classList.remove('hurt'),180);floatText('-'+damage,hero.x,2.9,hero.z,'#ffac89',22);burst(hero.x,1.5,hero.z,'#ffab75',5);if(hero.carry)throwBody();if(hero.weapon&&knock)dropWeapon();}
 hero.hp=Math.max(0,hero.hp-damage*(prefs.easy?.62:1));if(hero.hp<=0){hero.dead=true;hero.down=2;hero.vy=3.3;hero.attack=null;deathTimer=1.9;deaths++;resetInput();}return true;
}
function useAction(){if(!canAct(hero)||hero.attack)return;
 const s=nearShop();if(s){if(activeFight){toast('Clear this fight before you shop.',1.8);return;}openShop(s);return;}
 if(hero.carry){throwBody();return;}if(hero.weapon){dropWeapon();return;}
 const b=enemies.filter(e=>!e.dead&&e.down>.2&&!e.carried&&Math.abs(e.x-hero.x)<1.6&&Math.abs(e.z-hero.z)<1.2)[0];if(b){hero.carry=b;b.carried=true;b.thrown=false;b.attack=null;hero.cool=.2;sound.play('guard');toast('Foe picked up! '+keyName('kick')+' to throw.',1.4);return;}
 const w=nearestWeapon();if(w){w.held=true;w.hostile=false;w.flying=false;w.life=120;w.hit.clear();hero.weapon=w;hero.cool=.16;sound.play('guard');floatText(w.type==='bin'?'HEAVY METAL!':'BATTER UP!',hero.x,2.9,hero.z,'#edffb0',16,.85);}
}
function nearestWeapon(){return weapons.filter(w=>!w.held&&!w.flying&&Math.abs(w.x-hero.x)<1.55&&Math.abs(w.z-hero.z)<1.1).sort((a,b)=>Math.hypot(a.x-hero.x,a.z-hero.z)-Math.hypot(b.x-hero.x,b.z-hero.z))[0];}
function nearShop(){if(mode!=='story')return null;return shops.find(s=>Math.abs(hero.x-s.x)<2.0&&hero.z<1.2);}
function throwWeapon(){const w=hero.weapon;if(!w)return;hero.weapon=null;w.held=false;w.flying=true;w.hostile=false;w.x=hero.x+hero.face*.65;w.z=hero.z;w.y=hero.y+1.5;w.vx=hero.face*(w.type==='bin'?11:15);w.vz=moveInput.z*2;w.vy=3;w.hit.clear();w.life=70;hero.cool=.4;hero.attack={kind:'punch',t:0,duration:.32,at:.12,hit:true,chain:1,targets:new Set()};sound.play('swing');}
function dropWeapon(){const w=hero.weapon;if(!w)return;hero.weapon=null;w.held=false;w.flying=false;w.x=hero.x+hero.face*.8;w.z=hero.z+.15;w.y=1.2;w.vx=hero.face;w.vy=1;w.vz=0;}
function throwBody(){const b=hero.carry;if(!b)return;hero.carry=null;b.carried=false;b.thrown=true;b.throwHits=new Set();b.y=hero.y+2;b.vy=4;b.vx=hero.face*12;b.vz=0;b.down=1.8;b.invuln=.7;hero.cool=.45;sound.play('swing');}
function spawnRock(e){const w=spawnWeapon('rock',e.x,e.z,true);w.hostile=true;w.flying=true;w.x=e.x+e.face*.8;w.y=1.5;const dx=hero.x-e.x,dz=hero.z-e.z,len=Math.hypot(dx,dz)||1;w.vx=dx/len*8;w.vz=dz/len*8;w.vy=1.1;w.life=4;sound.play('swing');}

// ---------- Enemy decisions, motion, and collision ----------
function commonTimers(a,dt){a.cool=Math.max(0,a.cool-dt);a.invuln=Math.max(0,a.invuln-dt);a.stun=Math.max(0,a.stun-dt);a.shown=Math.max(0,a.shown-dt*2);if(a.down>0&&!a.carried){a.down=Math.max(0,a.down-dt);if(a.down===0&&!a.dead){a.invuln=.30;a.cool=.3;}}
 if(a.dead)a.deathT+=dt;
}
function physics(a,dt){if(a.carried)return;const wasAir=a.y>.03;
 a.x+=a.vx*dt;a.z+=a.vz*dt;a.vx*=Math.exp(-7*dt);a.vz*=Math.exp(-7*dt);
 if(a.y>0||a.vy>0){a.vy-=23*dt;a.y+=a.vy*dt;if(a.y<=0){a.y=0;a.vy=0;if(wasAir&&a===hero)burst(a.x,.12,a.z,'#c4c9ac',4,1.3);if(a.pending==='land'){a.pending='';bossStomp(a);}}}
 a.x=clamp(a.x,LEFT,RIGHT);a.z=clamp(a.z,ZMIN,ZMAX);
 if(a.thrown){for(const e of enemies){if(e!==a&&!e.dead&&!e.carried&&!a.throwHits.has(e.id)&&Math.abs(a.x-e.x)<1.05&&Math.abs(a.z-e.z)<.85&&a.y<2.5){a.throwHits.add(e.id);hitEnemy(e,28,Math.sign(a.vx)||hero.face,1,true);}}if(a.y===0){a.thrown=false;a.down=Math.max(a.down,1.05);a.stun=.4;}}
}
function processAttack(a,dt){if(!a.attack)return;const at=a.attack;at.t+=dt;if(!at.hit&&at.t>=at.at){at.hit=true;if(a===hero)doHeroHit(a,at);else{const dx=hero.x-a.x;if(Math.abs(hero.z-a.z)<.9&&dx*a.face>-.6&&dx*a.face<(a.type==='boss'?2.15:1.9)&&hero.y<(a.type==='boss'?1.55:1.25)){hitHero(a.type==='boss'?14:a.type==='tank'?10:7,a,a.type==='tank'||a.type==='boss');}swipe(a,'#f0c3a1');}}
 if(at.t>=at.duration)a.attack=null;
}
function updateHero(dt){commonTimers(hero,dt);if(hero.dead){physics(hero,dt);return;}
 // Stick up is into the street (-z); the kit already clamps diagonals to unit length.
 const mv=input.vector('move');let x=mv.x,z=-mv.y;
 let len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}moveInput.x=x;moveInput.z=z;
 if(held('guard')&&canAct(hero)&&!hero.attack&&hero.y===0&&!hero.carry)guardHeld+=dt;else guardHeld=0;
 const run=held('run')||(input.source!=='keyboard'&&Math.hypot(x,z)>.9);
 let speed=(hero.speed+hero.speedBoost)*(run?1.45:1);if(guardHeld)speed*=.28;if(hero.attack)speed*=hero.y>.1?.68:.20;if(hero.carry)speed*=.65;if(!canAct(hero))speed=0;
 if(Math.abs(x)>.10&&canAct(hero)&&!hero.attack)hero.face=Math.sign(x);
 hero.x+=x*speed*dt;hero.z+=z*speed*.84*dt;hero.walkSpeed=Math.hypot(x,z)*speed;
 const [minX,maxX]=heroBounds();hero.x=clamp(hero.x,minX,maxX);hero.z=clamp(hero.z,ZMIN,ZMAX);
 if(pressed.has('jump')&&canAct(hero)&&hero.y===0&&!guardHeld){hero.vy=8.8;sound.play('jump');if(hero.attack)hero.attack=null;hero.cool=Math.min(hero.cool,.06);}
 if(pressed.has('special')&&canAct(hero)&&!hero.attack){if(hero.grit>=100){hero.cool=0;guardHeld=0;startAttack(hero,'spin');}else toast('Fill the grit bar by landing hits and blocks.',1.7);}
 if(pressed.has('use'))useAction();
 if(pressed.has('punch'))buffer={kind:'punch',life:.2};if(pressed.has('kick'))buffer={kind:'kick',life:.2};
 if(buffer){buffer.life-=dt;if(startAttack(hero,buffer.kind)||buffer.life<=0)buffer=null;}
 if(!buffer&&!hero.attack&&hero.cool<=0){if(held('kick'))startAttack(hero,'kick');else if(held('punch'))startAttack(hero,'punch');}
 processAttack(hero,dt);physics(hero,dt);hero.x=clamp(hero.x,minX,maxX);
 if(hero.carry){hero.carry.x=hero.x;hero.carry.z=hero.z;hero.carry.y=hero.y+2.4;}
}
function heroBounds(){return mode==='rumble'?[ARENA_L,ARENA_R]:[LEFT,activeFight?stages[stageIndex].gate:RIGHT];}
function enemyWind(e,kind,duration){e.pending=kind;e.wind=duration;e.windTotal=duration;e.face=hero.x>=e.x?1:-1;e.walkSpeed=0;e.cool=duration+.3;if(kind==='charge'){e.chargeZ=hero.z;e.face=hero.x>=e.x?1:-1;} }
function updateEnemy(e,dt){commonTimers(e,dt);if(e.carried)return;physics(e,dt);e.walkSpeed=0;if(e.dead||!activeFight||e.down>0||e.stun>0||e.thrown)return;
 processAttack(e,dt);if(e.attack)return;
 e.specialCool-=dt;
 if(e.type==='boss'&&e.hp<e.maxHp*.5&&e.bossPhase===0){e.bossPhase=1;banner('THE FINAL BELL!','HE IS NOT DONE YET.',1.5);say('DOUBLE DETENTION!',e);e.specialCool=.6;}
 if(e.charge>0){const skate=e.type==='skater';e.charge-=dt;e.x+=e.face*(skate?11:e.bossPhase?12:10)*dt;e.x=mode==='rumble'?clamp(e.x,ARENA_L-1,ARENA_R+1):clamp(e.x,79,94.5);e.walkSpeed=10;if(Math.abs(e.x-hero.x)<(skate?1.2:1.45)&&Math.abs(e.z-hero.z)<.85&&hero.y<(skate?1.2:1.5))hitHero(skate?8:15,e,true);if(skate&&rand()<dt*12)burst(e.x-e.face*.5,.15,e.z,'#c4c9ac',1,1.2);if(e.charge<=0){e.cool=skate?1.5:1.15;e.stun=skate?.2:.28;burst(e.x,.2,e.z,'#bec5a7',skate?4:7,2);}return;}
 if(e.wind>0){e.wind-=dt;e.walkSpeed=0;if(e.wind<=0){const kind=e.pending;e.pending='';if(kind==='throw'){spawnRock(e);e.cool=1.9;}else if(kind==='stomp'){e.vy=10.5;e.y=.02;e.pending='land';e.cool=1.65;}else if(kind==='charge'){e.charge=e.type==='skater'?.5:.64;e.cool=1.4;}else{e.cool=0;startAttack(e,e.type==='tank'?'kick':'punch');e.cool=e.type==='runner'?.87:1.25+rand(0,.35);}}return;}
 if(e.pending==='land'||e.y>.1)return;
 const dx=hero.x-e.x,dz=hero.z-e.z,dist=Math.hypot(dx,dz);e.face=dx>=0?1:-1;
 if(e.type==='boss'&&e.specialCool<=0&&e.cool<=0){e.specialCool=e.bossPhase?2.8:3.7;if(dist<4.8){enemyWind(e,'stomp',.85);say('BELL RINGER!',e);}else{enemyWind(e,'charge',.65);say('HALL PASS!',e);}sound.play('alert');return;}
 if(e.type==='thrower'&&dist>3.7&&dist<10&&e.cool<=0&&nextEnemyAttack<=0){enemyWind(e,'throw',.62);nextEnemyAttack=.45;return;}
 if(e.type==='skater'&&Math.abs(dz)<.55&&Math.abs(dx)>2.6&&Math.abs(dx)<8.5&&e.cool<=0&&nextEnemyAttack<=0){enemyWind(e,'charge',.55);nextEnemyAttack=.4;if(rand()<.4)say(choice(['OLLIE!','COMING THROUGH!','KICKFLIP!','HALLWAY RULES!']),e);return;}
 if(Math.abs(dx)<1.72&&Math.abs(dz)<.73&&e.cool<=0&&nextEnemyAttack<=0){enemyWind(e,'melee',e.type==='runner'?.34:.43);nextEnemyAttack=.48;return;}
 let tx=hero.x-e.face*(e.type==='thrower'?4.3:e.type==='skater'?5.2:1.24),tz=hero.z+(e.type==='skater'?0:e.index%2===0?.12:-.12);
 // A recovering fighter takes one small step back instead of crowding the player.
 if(e.cool>.60&&dist<1.2)tx=hero.x-e.face*1.7;
 // In the yard nobody keeps their distance from outside the fence, where the player could never reach them.
 if(mode==='rumble')tx=clamp(tx,ARENA_L+.4,ARENA_R-.4);
 let mx=tx-e.x,mz=tz-e.z;const ml=Math.hypot(mx,mz);if(ml>.17){mx/=ml;mz/=ml;let sp=e.speed*(e.bossPhase?1.1:1);if(e.cool>.6)sp*=.65;e.x+=mx*sp*dt;e.z+=mz*sp*.86*dt;e.walkSpeed=sp;}
 for(const other of enemies){if(other===e||other.dead||other.carried||other.down>0)continue;const ox=e.x-other.x,oz=e.z-other.z,l=Math.hypot(ox,oz);if(l>.01&&l<.80){const p=(.8-l)*dt*2.8;e.x+=ox/l*p;e.z+=oz/l*p;}}
 e.z=clamp(e.z,ZMIN,ZMAX);
 // Rumble fighters walk in from beyond the yard and drift back in after a knockback; the street keeps its fight gates.
 if(mode==='rumble'){if(e.x<ARENA_L+.4)e.x=Math.min(ARENA_L+.4,e.x+dt*3.5);else if(e.x>ARENA_R-.4)e.x=Math.max(ARENA_R-.4,e.x-dt*3.5);}
 else e.x=clamp(e.x,LEFT,activeFight?stages[stageIndex].gate+.5:RIGHT);
}
function bossStomp(e){sound.play('heavy');cameraHit(.27,.05);burst(e.x,.3,e.z,'#edc88e',18,4.5);const m=ring(1,'#ffbd73',.85);m.position.set(e.x,.065,e.z);scene.add(m);wavesFX.push({mesh:m,life:.7,max:.7,kind:'shock',x:e.x,z:e.z,r:.1,hit:false,source:e});e.cool=.9;}
function updateWeapons(dt){for(let i=weapons.length-1;i>=0;i--){const w=weapons[i];w.life-=dt;if(w.held&&hero.weapon===w){w.x=hero.x+hero.face*(w.type==='bin'?.04:.86);w.z=hero.z+.16;w.y=hero.y+(w.type==='bin'?3.14:1.43);w.mesh.position.set(w.x,w.y,w.z);w.mesh.rotation.set(0,0,hero.face*(w.type==='bin'?.10:-.30));if(hero.attack?.kind==='swing'){const p=Math.sin(clamp(hero.attack.t/.33,0,1)*PI);w.mesh.rotation.z-=hero.face*p*1.9;w.mesh.position.x+=hero.face*p*.65;w.mesh.position.y-=p*.23;}continue;}
 w.x+=w.vx*dt;w.z+=w.vz*dt;if(w.y>.12||w.vy>0){w.vy-=18*dt;w.y+=w.vy*dt;if(w.y<.13){w.y=.13;w.vy=Math.abs(w.vy)>1.7?Math.abs(w.vy)*.29:0;w.vx*=.6;w.vz*=.6;if(w.type==='rock')w.life=0;}}else{w.vx*=Math.exp(-7*dt);w.vz*=Math.exp(-7*dt);}
 if(Math.abs(w.vx)<1&&Math.abs(w.vz)<1&&w.y<.3)w.flying=false;
 w.z=clamp(w.z,ZMIN-.2,ZMAX+.2);w.mesh.position.set(w.x,w.y+(w.type==='bin'&&!w.flying?.4:0),w.z);
 if(w.flying){w.mesh.rotation.z+=dt*15;w.mesh.rotation.x+=dt*3;
  if(w.hostile){if(Math.abs(w.x-hero.x)<.6&&Math.abs(w.z-hero.z)<.6&&Math.abs(w.y-(hero.y+1))<1.05){const proxy={x:w.x-w.vx*.2,z:w.z,stun:0,wind:0,cool:0};hitHero(7,proxy);w.life=0;}}
  else for(const e of enemies){if(e.dead||e.carried||w.hit.has(e.id))continue;if(Math.abs(w.x-e.x)<.95&&Math.abs(w.z-e.z)<.84&&w.y<e.y+2.7){w.hit.add(e.id);hitEnemy(e,w.type==='bin'?29:24,Math.sign(w.vx)||hero.face,1,true);w.vx*=.76;}}
 }else{w.mesh.rotation.x=0;w.mesh.rotation.z=w.type==='bin'?.02:PI/2+.08;}
 if(w.life<=0||w.x<LEFT-10||w.x>RIGHT+10){dropProp(w);weapons.splice(i,1);}
}}
function updateCoins(dt){for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.age+=dt;c.x+=c.vx*dt;c.z+=c.vz*dt;c.vx*=Math.exp(-2*dt);c.vz*=Math.exp(-2*dt);c.vy-=14*dt;c.y+=c.vy*dt;if(c.y<.25){c.y=.25;c.vy=Math.abs(c.vy)>1?Math.abs(c.vy)*.33:0;}const dist=Math.hypot(c.x-hero.x,c.z-hero.z);if(c.age>.35&&dist<2.0){const k=(c.type==='coin'?9:5)*dt;c.x=mix(c.x,hero.x,k);c.z=mix(c.z,hero.z,k);}
 c.mesh.position.set(c.x,c.y+Math.sin(worldTime*5+i)*.05,c.z);c.mesh.rotation.y+=dt*3;
 if(c.age>.25&&dist<.72&&!hero.dead){if(c.type==='coin'){hero.money+=c.value;if(mode==='rumble')rumble.score+=Math.round(c.value*20);sound.play('coin');}else{hero.hp=Math.min(hero.maxHp,hero.hp+c.value);floatText('+'+c.value+' HP',hero.x,2.7,hero.z,'#dfffab',18,.9);sound.play('buy');}scene.remove(c.mesh);coins.splice(i,1);}
}}
function releaseWave(w){scene.remove(w.mesh);if(w.kind==='slash')swipePool.push(w.mesh);else{w.mesh.geometry.dispose();w.mesh.material.dispose();}}
function updateEffects(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.vy-=15*dt;p.mesh.rotation.x+=dt*6;p.mesh.rotation.z+=dt*8;p.mesh.scale.multiplyScalar(Math.pow(.97,dt*60));if(p.life<=0){freeParticle(p.mesh);particles.splice(i,1);}}
 for(let i=labels.length-1;i>=0;i--){const l=labels[i];l.life-=dt;l.y+=dt*(l.style==='speech'?.11:.7);if(l.life<=0)labels.splice(i,1);}
 for(let i=wavesFX.length-1;i>=0;i--){const w=wavesFX[i];w.life-=dt;w.mesh.material.opacity=clamp(w.life/w.max,0,1)*.85;if(w.kind==='shock'){w.r+=dt*8.8;w.mesh.scale.setScalar(w.r);const d=Math.hypot(hero.x-w.x,hero.z-w.z);if(!w.hit&&Math.abs(d-w.r)<.48&&hero.y<.58){w.hit=true;hitHero(13,w.source,true);}}else w.mesh.scale.multiplyScalar(1+dt*3);if(w.life<=0){releaseWave(w);wavesFX.splice(i,1);}}
}

// ---------- Campaign, safe checkpoints, and shops ----------
function cleanDynamic(){for(const a of enemies)removeActor(a);enemies=[];for(const c of coins)scene.remove(c.mesh);coins=[];for(const p of particles)freeParticle(p.mesh);particles=[];for(const v of wavesFX)releaseWave(v);wavesFX=[];labels=[];removeActor(hero);hero=makeActor('hero',.5,2.8);initProps();friend.root.visible=false;friend.shadow.visible=false;hero.carry=null;combo=0;comboTimer=0;buffer=null;guardHeld=0;nextEnemyAttack=1;hitStop=0;shake=0;winStarted=false;victoryTimer=0;deathTimer=0;$('combo').classList.add('hidden');$('bossHud').classList.add('hidden');$('prompt').classList.add('hidden');$('banner').classList.add('hidden');bannerTimer=0;$('vignette').classList.remove('hurt');}
function hideMenus(){for(const id of ['title','help','pause','shop','gameover','win','rumbleOver'])$(id).classList.add('hidden');blurMenus();}
function beginPlay(){hideMenus();state='play';$('hud').classList.remove('hidden');resetInput();sound.init();updateHUD();}
function newGame(){mode='story';cleanDynamic();cleared=-1;stageIndex=-1;activeFight=false;triggerDelay=1.2;elapsed=0;kills=0;bestCombo=0;hitsTaken=0;deaths=0;parries=0;camX=W/H<1.1?2.5:6;hero.x=.5;hero.z=2.8;hero.hp=hero.maxHp=100;hero.money=3.25;hero.grit=35;hero.power=hero.speedBoost=hero.heart=0;saveCheckpoint();beginPlay();banner('MALL STREET','GET THE LUNCH MONEY BACK.',2.0);toast(input.source==='touch'?'Move with the stick. Tap PUNCH or KICK to attack.':input.source==='gamepad'?'Left stick to move · X to punch · B to kick':'WASD to move · J to punch · K to kick',4);}
function saveCheckpoint(){if(mode!=='story')return null;const data={version:1,cleared,x:hero.x,z:hero.z,hp:Math.max(1,hero.hp),maxHp:hero.maxHp,money:Math.round(hero.money*100)/100,grit:hero.grit,power:hero.power,speedBoost:hero.speedBoost,heart:hero.heart,elapsed,kills,bestCombo,hitsTaken,deaths,parries,easy:prefs.easy};lastSave=data;const ok=writeStore(STORE,data);if(!ok&&!saveWarning){saveWarning=true;toast('Browser storage is blocked. This tab keeps your checkpoint.',3);}return data;}
function loadCheckpoint(retry=false){const s=lastSave||readStore(STORE);if(!s||s.version!==1||s.cleared>=4){newGame();return;}mode='story';const oldDeaths=deaths;cleanDynamic();cleared=clamp(s.cleared,-1,3);stageIndex=cleared;activeFight=false;triggerDelay=1;hero.x=clamp(s.x,LEFT,cleared>=0?stages[cleared].gate:8);hero.z=clamp(s.z,ZMIN,ZMAX);hero.maxHp=clamp(s.maxHp||100,100,180);hero.hp=retry?hero.maxHp:clamp(s.hp||100,1,hero.maxHp);hero.money=Math.max(0,s.money||0);hero.grit=retry?Math.max(s.grit||0,35):(s.grit||35);hero.power=clamp(s.power||0,0,6);hero.speedBoost=clamp(s.speedBoost||0,0,1);hero.heart=s.heart||0;hero.face=1;elapsed=s.elapsed||0;kills=s.kills||0;bestCombo=s.bestCombo||0;hitsTaken=s.hitsTaken||0;deaths=retry?Math.max(oldDeaths,s.deaths||0):(s.deaths||0);parries=s.parries||0;prefs.easy=!!s.easy;camX=hero.x+4.5;beginPlay();toast(retry?'Back on your feet. Health restored.':'Checkpoint loaded. The block is waiting.',2.5);}
function startFight(i){stageIndex=i;const st=stages[i];activeFight=true;triggerDelay=0;for(let j=0;j<st.types.length;j++){const e=makeActor(st.types[j],st.x[j],st.z[j],j);if(i===1&&e.type==='grunt'){e.name=j===0?'PAGE TURNER':'BOOK WORM';}if(i===2&&e.type==='grunt')e.name='TRACK RAT';enemies.push(e);}if(i>0)banner(st.title,st.sub,i===4?2.2:1.6);else toast('Keep your target in the same lane. Pick up the bat with '+keyName('use')+'.',3.3);if(i===4){$('bossHud').classList.remove('hidden');sound.play('alert');}nextEnemyAttack=1.0;}
function bankCoins(){let sum=0;for(let i=coins.length-1;i>=0;i--){const c=coins[i];if(c.type==='coin'){sum+=c.value;scene.remove(c.mesh);coins.splice(i,1);}}if(sum){hero.money+=sum;if(mode==='rumble')rumble.score+=Math.round(sum*20);floatText('+$'+sum.toFixed(2),hero.x,3.1,hero.z,'#ffdf7e',19,1.2);sound.play('coin');}}
function clearFight(){activeFight=false;cleared=stageIndex;bankCoins();hero.grit=clamp(hero.grit+10,0,100);const heal=Math.min(14,hero.maxHp-hero.hp);hero.hp+=heal;triggerDelay=2;if(cleared===4){winStarted=true;victoryTimer=2.6;hero.invuln=99;friend.root.visible=true;friend.shadow.visible=true;banner('THE BLOCK IS YOURS!','LUNCH MONEY: RECOVERED.',2.4);sound.play('win');input.rumble(.5,300);for(let i=0;i<5;i++)burst(hero.x+rand(-5,5),rand(4,7),rand(0,4),choice(['#ebbe67','#89c39b','#e6916b']),16,3.5);return;}
 saveCheckpoint();banner('STREET CLEAR!',(heal>0?'+'+Math.round(heal)+' HEALTH · ':'')+'CHECKPOINT SAVED',1.8);if(cleared===0)toast('Shops are open. Walk up to a door and press '+keyName('use')+'.',4);else toast('Coins collected. Keep moving right.',2.4);}
const anyAlive=()=>enemies.some(e=>!e.dead);
function checkProgress(dt){triggerDelay=Math.max(0,triggerDelay-dt);if(hero.dead)return;if(mode==='rumble'){updateRumble(dt);return;}if(activeFight&&!anyAlive())clearFight();if(!activeFight&&!winStarted&&triggerDelay===0){const next=cleared+1;if(next<stages.length&&hero.x>=stages[next].trigger)startFight(next);}
 if(winStarted){victoryTimer-=dt;if(victoryTimer<=0){finishGame();}}
}
// The chapter results stay up until the player picks what comes next (they used to vanish under the comic at once).
function finishGame(){state='win';hideMenus();$('win').classList.remove('hidden');resetInput();$('resultTime').textContent=formatTime(elapsed);$('resultCombo').textContent=bestCombo;$('resultKOs').textContent=kills;const rank=deaths===0&&hitsTaken<10?'S':deaths===0&&hitsTaken<25?'A':deaths<3?'B':'C';$('rankStamp').textContent=rank;const best=readStore(BEST);if(!best||elapsed<best.time){writeStore(BEST,{time:elapsed,combo:bestCombo,rank});$('bestResult').textContent='NEW BEST TIME · '+formatTime(elapsed)+' / RANK '+rank;}else $('bestResult').textContent='BEST TIME · '+formatTime(best.time)+' / TODAY: RANK '+rank;lastSave=null;try{localStorage.removeItem(STORE);}catch{}sound.play('win');Racing.preloadComic();focusMenu($('win'));}
function formatTime(n){n=Math.floor(n);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function toTitle(){mode='story';cleanDynamic();hero.x=10.4;hero.z=2.8;hero.face=1;hero.money=3.25;hero.grit=35;hero.power=hero.speedBoost=hero.heart=0;enemies=[makeActor('grunt',13.6,2.25),makeActor('runner',17.0,3.2),makeActor('tank',20.5,1.1)];activeFight=false;stageIndex=-1;camX=7.4;hideMenus();state='title';$('hud').classList.add('hidden');$('title').classList.remove('hidden');$('banner').classList.add('hidden');$('toast').classList.add('hidden');toastTimer=bannerTimer=0;resetInput();$('continueBtn').classList.toggle('hidden',!lastSave&&!readStore(STORE));$('modeBtn').textContent='MODE: '+(prefs.easy?'EASY':'NORMAL');refreshRumbleBest();}
function togglePause(){if(state==='play'&&!hero.dead&&!winStarted){state='pause';$('retryBtn').textContent=mode==='rumble'?'RESTART RUMBLE':'RETRY CHECKPOINT';$('quitBtn').textContent=mode==='rumble'?'RETURN TO TITLE':'SAVE & RETURN TO TITLE';$('pause').classList.remove('hidden');resetInput();focusMenu($('pause'));}else if(state==='pause'){state='play';$('pause').classList.add('hidden');blurMenus();resetInput();sound.init();}}
function showHelp(){helpReturn=state;if(state==='play')state='pause';fillHelpKeys();$('help').classList.remove('hidden');resetInput();focusMenu($('help'));}
function closeHelp(){$('help').classList.add('hidden');state=helpReturn;blurMenus();resetInput();if(state==='pause')focusMenu($('pause'));else if(state==='title')focusMenu($('title'));}
const stock={food:[
 {id:'bun',icon:'B',title:'THE GOOD BUN',desc:'Restore 45 health.',price:4.50,apply:()=>hero.hp=Math.min(hero.maxHp,hero.hp+45),available:()=>hero.hp<hero.maxHp},
 {id:'meal',icon:'+',title:'THE LUNCH SPECIAL',desc:'Restore all health. No questions asked.',price:8,apply:()=>hero.hp=hero.maxHp,available:()=>hero.hp<hero.maxHp},
 {id:'heart',icon:'♥',title:'BIG-HEART COMBO',desc:'+25 max health, then a full heal. Buy once.',price:10,apply:()=>{hero.heart=1;hero.maxHp+=25;hero.hp=hero.maxHp;},available:()=>!hero.heart}
 ],books:[
 {id:'power',icon:'!',title:'THE ART OF BONK',desc:'+3 damage to each hit. Two volumes available.',price:8,apply:()=>hero.power+=3,available:()=>hero.power<6},
 {id:'speed',icon:'»',title:'FAST FEET',desc:'Move faster. Run faster. Buy once.',price:7,apply:()=>hero.speedBoost=1,available:()=>hero.speedBoost===0},
 {id:'grit',icon:'✦',title:'A LITTLE COURAGE',desc:'Fill the grit bar for a spin attack.',price:4,apply:()=>hero.grit=100,available:()=>hero.grit<100}
 ]};

function openShop(s){state='shop';shopAt=s;resetInput();$('shop').classList.remove('hidden');$('shopName').textContent=s.name;$('shopType').textContent=s.type==='food'?'GOOD FOOD. FAIR PRICES.':'A LITTLE KNOWLEDGE. A LOT OF POWER.';$('shopTalk').textContent=s.type==='food'?'You look like you missed lunch. Let us fix that.':'These books really leave a mark.';$('shopMessage').textContent='The street is safe while you shop.';renderShop();focusMenu($('shop'));}
function renderShop(){const before=[...$('shopItems').querySelectorAll('button')].indexOf(document.activeElement);$('shopCash').textContent=hero.money.toFixed(2);$('shopItems').innerHTML='';stock[shopAt.type].forEach(item=>{const available=item.available(),row=document.createElement('div');row.className='shop-item';row.innerHTML=`<div class="item-icon">${item.icon}</div><div class="item-info"><strong>${item.title}</strong><small>${item.desc}</small></div>`;const b=document.createElement('button');b.textContent=available?'$'+item.price.toFixed(2):['power','speed','heart'].includes(item.id)?'OWNED':'FULL';b.disabled=!available||hero.money+1e-5<item.price;b.onclick=()=>{if(!item.available()||hero.money+1e-5<item.price)return;hero.money=Math.round((hero.money-item.price)*100)/100;item.apply();saveCheckpoint();sound.play('buy');$('shopMessage').textContent=shopAt.type==='food'?'Good as new. Go get that lunch money.':'A good read. A better right hook.';renderShop();updateHUD();};row.appendChild(b);$('shopItems').appendChild(row);});
 // A pad or keyboard player keeps their place in the list after buying (the rows are rebuilt).
 if(before>=0){const list=[...$('shopItems').querySelectorAll('button')];(list.slice(before).find(b=>!b.disabled)||list.find(b=>!b.disabled)||$('leaveShop')).focus();}}
function closeShop(){if(state!=='shop')return;state='play';$('shop').classList.add('hidden');blurMenus();resetInput();hero.invuln=.5;updateHUD();}

// ---------- Recess Rumble: endless waves in the Block High yard ----------
// Uses the street's own fighters, props and rules. Every fifth wave brings Big Bell back.
const rumble={wave:0,score:0,breakT:0,queue:[],spawnT:0,total:0,best:null};
const RUMBLE_POINTS={grunt:100,runner:120,thrower:130,tank:180,skater:150,boss:1000};
function refreshRumbleBest(){rumble.best=readStore(RUMBLE_BEST);const b=$('rumbleBtn');if(b)b.textContent='RECESS RUMBLE / '+(rumble.best?'BEST WAVE '+rumble.best.wave:'SURVIVAL')+' →';}
function startRumble(){mode='rumble';cleanDynamic();clearProps();spawnWeapon('bat',78.5,3.9);spawnWeapon('bin',88.5,1.2);spawnCrate(73.2,4.7);spawnCrate(92.2,.9);
 stageIndex=-1;cleared=-1;activeFight=true;triggerDelay=0;elapsed=0;kills=0;bestCombo=0;hitsTaken=0;deaths=0;parries=0;
 hero.x=82.5;hero.z=2.8;hero.face=1;hero.hp=hero.maxHp=100;hero.money=0;hero.grit=35;hero.power=hero.speedBoost=hero.heart=0;camX=hero.x+3.5;
 Object.assign(rumble,{wave:0,score:0,breakT:1.6,queue:[],spawnT:0,total:0});
 beginPlay();banner('RECESS RUMBLE','HOLD THE YARD. EVERY WAVE HITS HARDER.',2.2);toast('Waves come from both sides. Skate Kids dash along your lane: step up or down to dodge.',4);}
function rumbleWave(n){const boss=n%5===0,list=[];const pool=['grunt','grunt','runner'];if(n>=2)pool.push('skater');if(n>=3)pool.push('thrower');if(n>=4)pool.push('tank');if(n>=6)pool.push('skater','runner');if(n>=8)pool.push('tank','thrower');
 if(boss){list.push('boss');for(let i=0;i<Math.min(4,1+Math.floor(n/5));i++)list.push(choice(pool));}
 else{const count=Math.min(8,2+Math.ceil(n*.75));for(let i=0;i<count;i++)list.push(choice(pool));}
 return list;}
function spawnRumbleEnemy(type){const side=rand()<.5?-1:1,x=side<0?ARENA_L-2.5:ARENA_R+1,e=makeActor(type,x,rand(.4,4.8),rumble.total++),n=rumble.wave;
 if(type==='boss'){e.hp=e.maxHp=Math.round(260+70*(Math.floor(n/5)-1));e.specialCool=2;}else e.hp=e.maxHp=Math.round(e.maxHp*Math.min(1.9,1+.07*(n-1)));
 e.speed*=Math.min(1.25,1+.02*(n-1));e.face=-side;e.cool=rand(.6,1.4);enemies.push(e);
 if(type==='boss'){banner('BIG BELL IS BACK','HALL MONITOR ON DUTY.',1.6);sound.play('alert');say('NO RUNNING IN THE YARD!',e);}}
function rumbleKO(e){const pts=Math.round((RUMBLE_POINTS[e.type]||100)*(1+Math.min(combo,20)*.05));rumble.score+=pts;floatText('+'+pts,e.x,e.y+3.4,e.z,'#efffa9',15,.9);}
function updateRumble(dt){
 let alive=0;for(const e of enemies)if(!e.dead)alive++;
 if(rumble.breakT>0){rumble.breakT-=dt;if(rumble.breakT<=0){rumble.wave++;rumble.queue=rumbleWave(rumble.wave);rumble.spawnT=0;nextEnemyAttack=Math.max(nextEnemyAttack,.9);banner('WAVE '+String(rumble.wave).padStart(2,'0'),rumble.wave%5===0?'THE BELL IS COMING.':rumble.wave===1?'HERE THEY COME.':'MORE TROUBLE AT RECESS.',1.4);sound.play('alert');}return;}
 if(rumble.queue.length){rumble.spawnT-=dt;if(rumble.spawnT<=0&&alive<5){spawnRumbleEnemy(rumble.queue.shift());rumble.spawnT=.55;}return;}
 if(alive)return;
 const bonus=250*rumble.wave,heal=Math.min(12,hero.maxHp-hero.hp);rumble.score+=bonus;bankCoins();hero.hp+=heal;hero.grit=clamp(hero.grit+10,0,100);rumble.breakT=3.2;
 banner('WAVE CLEAR!','+'+bonus+' BONUS'+(heal>0?' · +'+Math.round(heal)+' HEALTH':''),1.6);sound.play('buy');
 if(rumble.wave%3===0)dropFood(clamp(hero.x+(hero.x>ARENA_R-4?-2:2),ARENA_L+1,ARENA_R-1),clamp(hero.z,.6,4.6));
 if(rumble.wave%4===0&&!breakables.some(b=>!b.dead))spawnCrate(rand(74,91),rand(.8,4.6));
 if(!weapons.some(w=>w.type!=='rock'))spawnWeapon(rand()<.5?'bat':'bin',rand(76,90),rand(1,4.4));
}
function endRumble(){state='rumbleOver';hideMenus();const wave=Math.max(1,rumble.wave),score=rumble.score,best=readStore(RUMBLE_BEST),isBest=!best||score>best.score;if(isBest)writeStore(RUMBLE_BEST,{score,wave,combo:bestCombo,kills});
 $('rumbleWave').textContent=wave;$('rumbleScore').textContent=score;$('rumbleKOs').textContent=kills;$('rumbleCombo').textContent=bestCombo;$('rumbleStamp').textContent=wave>=15?'S':wave>=10?'A':wave>=6?'B':'C';
 $('rumbleLine').textContent=wave>=10?'Big Bell called it a draw. The yard is yours.':wave>=5?'You outlasted the hall monitors. Mostly.':'The yard held out for a while.';
 $('rumbleBest').textContent=isBest?'NEW BEST · '+score+' POINTS / WAVE '+wave:'BEST · '+best.score+' POINTS / WAVE '+best.wave;
 $('rumbleOver').classList.remove('hidden');resetInput();sound.play('ko');refreshRumbleBest();focusMenu($('rumbleOver'));}

// ---------- HUD and projected comic lettering ----------
// One reused result: every caller reads it before asking for the next point.
const projected=new THREE.Vector3(),projectedPoint={x:0,y:0,on:false};
function screenPoint(x,y,z){projected.set(x,y,z).project(camera);projectedPoint.x=(projected.x*.5+.5)*W;projectedPoint.y=(-.5*projected.y+.5)*H;projectedPoint.on=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.15;return projectedPoint;}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawLabels(){ctx.clearRect(0,0,W,H);if(state==='title')return;const scale=clamp(W/1250,.65,1.3);
 for(const e of enemies){if(e.dead||e.carried)continue;const p=screenPoint(e.x,e.y+3.05*e.baseScale,e.z);if(!p.on)continue;
  if(e.type!=='boss'&&(e.hp<e.maxHp||e.wind>0||Math.abs(e.x-hero.x)<3)){const bw=55*scale;ctx.fillStyle='#1b343ae6';roundRect(p.x-bw/2-3,p.y-3,bw+6,8*scale+6,2);ctx.fill();ctx.fillStyle='#436363';ctx.fillRect(p.x-bw/2,p.y,bw,6*scale);ctx.fillStyle=e.type==='tank'?'#e3b5df':'#ffb080';ctx.fillRect(p.x-bw/2,p.y,bw*e.hp/e.maxHp,6*scale);ctx.font=`bold ${9*scale}px Courier New`;ctx.textAlign='center';ctx.fillStyle='#fff4d6';ctx.lineWidth=3;ctx.strokeStyle='#244049';ctx.strokeText(e.name,p.x,p.y-7*scale);ctx.fillText(e.name,p.x,p.y-7*scale);}
  if(e.wind>0){const y=p.y-30*scale,r=12*scale*(1+Math.sin(worldTime*21)*.06);ctx.fillStyle=e.pending==='stomp'?'#ffe293':'#f98460';ctx.strokeStyle='#293a3b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,y,r,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#273f43';ctx.font=`bold ${18*scale}px Arial`;ctx.textAlign='center';ctx.fillText('!',p.x,y+6*scale);}
 }
 if(elapsed<12&&!hero.dead){const p=screenPoint(hero.x,3.04,hero.z);ctx.textAlign='center';ctx.fillStyle='#192f38';roundRect(p.x-21*scale,p.y-9*scale,42*scale,19*scale,3);ctx.fill();ctx.font=`bold ${9*scale}px Courier New`;ctx.fillStyle='#e5ff9e';ctx.fillText('YOU',p.x,p.y+4*scale);}
 for(const w of weapons){if(w.type==='rock'||w.held||w.flying||Math.hypot(w.x-hero.x,w.z-hero.z)>3.8)continue;const p=screenPoint(w.x,w.type==='bin'?1.2:.8,w.z);if(!p.on)continue;ctx.globalAlpha=.75+Math.sin(worldTime*4)*.2;ctx.fillStyle='#f5e2a8';ctx.strokeStyle='#29444b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,9*scale,0,TAU);ctx.fill();ctx.stroke();const g=keyName('use');ctx.font=`bold ${(g.length>1?6.5:10)*scale}px Courier New`;ctx.textAlign='center';ctx.fillStyle='#29444b';ctx.fillText(g,p.x,p.y+(g.length>1?2.5:3.5)*scale);ctx.globalAlpha=1;}
 for(const l of labels){const p=screenPoint(l.x,l.y,l.z);if(!p.on)continue;ctx.globalAlpha=clamp(l.life/.2,0,1);const f=l.size*scale;ctx.font=`${l.style==='comic'?'900':'bold'} ${f}px ${l.style==='comic'?'Impact, Arial Black':'Arial'}`;ctx.textAlign='center';
  if(l.style==='speech'){ctx.font=`bold ${Math.max(9,f)}px Courier New`;const tw=ctx.measureText(l.text).width;ctx.fillStyle='#fff4d9';ctx.strokeStyle='#233b42';ctx.lineWidth=2;roundRect(p.x-tw/2-10,p.y-20,tw+20,28,4);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-3,p.y+8);ctx.lineTo(p.x+1,p.y+15);ctx.lineTo(p.x+9,p.y+8);ctx.fill();ctx.fillStyle='#233b42';ctx.fillText(l.text,p.x,p.y-2);}
  else{ctx.save();ctx.translate(p.x,p.y);if(l.style==='comic')ctx.rotate(-.12);ctx.strokeStyle='#21343b';ctx.lineWidth=l.style==='comic'?6:4;ctx.strokeText(l.text,0,0);ctx.fillStyle=l.color;ctx.fillText(l.text,0,0);ctx.restore();}ctx.globalAlpha=1;
 }
}
// HUD writes only touch the DOM when a value changes.
const hudCache=new Map();
function hudText(id,v){v=String(v);if(hudCache.get(id)!==v){hudCache.set(id,v);$(id).textContent=v;}}
function hudHTML(id,v){const k='html:'+id;if(hudCache.get(k)!==v){hudCache.set(k,v);$(id).innerHTML=v;}}
function hudStyle(id,prop,v){const k=id+'.'+prop;if(hudCache.get(k)!==v){hudCache.set(k,v);$(id).style[prop]=v;}}
const kb=a=>'<kbd>'+keyName(a)+'</kbd>';
function updateHUD(){if(!hero)return;const hp=Math.ceil(hero.hp);hudText('hpText',hp+' / '+hero.maxHp);hudStyle('hpFill','width',(hero.hp/hero.maxHp*100).toFixed(1)+'%');hudStyle('hpFill','background',hero.hp<hero.maxHp*.25?'#ff8b64':'#dbfa72');hudStyle('gritFill','width',Math.round(hero.grit)+'%');hudText('gritText',hero.grit>=100?'SPIN READY':'GRIT');hudStyle('gritFill','background',hero.grit>=100?'#e6ffac':'#fc8454');hudText('cash',hero.money.toFixed(2).padStart(5,'0'));
 if(mode==='rumble'){hudText('zoneId','BLOCK HIGH / THE YARD');hudText('zoneName','RECESS RUMBLE');for(let i=0;i<3;i++)$('route'+i).classList.add('active');hudText('objectiveText',rumble.breakT>0&&rumble.wave>0?'Wave '+rumble.wave+' clear. Catch your breath':'Recess Rumble / wave '+Math.max(1,rumble.wave));hudText('enemyCount',String(rumble.score).padStart(5,'0'));}
 else{const zone=hero.x<35?0:hero.x<63?1:2;hudText('zoneId','RIVERBLOCK / 0'+(zone+1));hudText('zoneName',['MALL STREET','RAIL YARD','BLOCK HIGH'][zone]);for(let i=0;i<3;i++)$('route'+i).classList.toggle('active',i<=zone);
  const st=stages[stageIndex];if(activeFight&&st){let remaining=0;for(const e of enemies)if(!e.dead)remaining++;hudText('objectiveText',stageIndex===4?'Defeat Big Bell':stageIndex===0?'Clear the Late Slips':stageIndex===1?'Clear the Bad Book Club':stageIndex===2?'Clear the Track Rats':'Clear the Hall Monitors');hudText('enemyCount',(st.types.length-remaining)+' / '+st.types.length);}else{hudText('objectiveText',winStarted?'Lunch money recovered!':cleared===0?'Visit a shop. Then move right.':'Keep moving right.');hudText('enemyCount',winStarted?'CLEAR':'→');}}
 $('go').classList.toggle('hidden',activeFight||winStarted||state!=='play'||hero.dead);hudText('goText',cleared===0?'SHOPS AHEAD':cleared===3?'BIG BELL AHEAD':'NEXT BLOCK');
 const boss=enemies.find(e=>e.type==='boss'&&!e.dead);$('bossHud').classList.toggle('hidden',!boss);if(boss)hudStyle('bossFill','width',(boss.hp/boss.maxHp*100).toFixed(1)+'%');
 const w=hero.weapon;$('weaponHud').classList.toggle('hidden',!w&&!hero.carry);if(w)hudText('weaponHud',(w.type==='bin'?'TRASH CAN':'WOOD BAT')+' / '+w.durability+' HITS');else if(hero.carry)hudText('weaponHud','SPECIAL DELIVERY / '+hero.carry.name);
 let text='';if(canAct(hero)&&state==='play'&&!winStarted){const s=nearShop();if(s)text=kb('use')+' '+(activeFight?'Clear the fight to shop':'Enter '+s.name);else if(hero.carry)text=kb('kick')+' Throw your new friend';else if(w)text=kb('punch')+' Swing &nbsp; '+kb('kick')+' Throw &nbsp; '+kb('use')+' Drop';else{const item=nearestWeapon();if(item)text=kb('use')+' Pick up '+(item.type==='bin'?'trash can':'bat');else if(enemies.some(e=>!e.dead&&e.down>.2&&!e.carried&&Math.abs(e.x-hero.x)<1.6&&Math.abs(e.z-hero.z)<1.2))text=kb('use')+' Pick up fallen foe';}}
 $('prompt').classList.toggle('hidden',!text);if(text)hudHTML('prompt',text);
 // Touch: USE appears when there is something to use, GRIT when the spin is ready.
 setTouchShown('use',touchMode==='street'&&!!text);setTouchShown('special',touchMode==='street'&&hero.grit>=100);
}

// ---------- Menus, button prompts, and settings ----------
function savePrefs(){writeStore(PREF,prefs);}
// Prompts name the device in use: keys, pad buttons, or the on-screen buttons.
const KEYS={
 keyboard:{move:'WASD',steer:'← →',run:'SHIFT',punch:'J',kick:'K',jump:'SPACE',guard:'L',use:'E',special:'Q',gas:'J / ↑',brake:'L / ↓',fire:'K / SPACE',swap:'E',reset:'R'},
 gamepad:{move:'L-STICK',steer:'L-STICK',run:'L-STICK CLICK',punch:'X',kick:'B',jump:'A',guard:'LB',use:'Y',special:'RB',gas:'RT / A',brake:'LT / B',fire:'X',swap:'Y',reset:'BACK'},
 touch:{move:'STICK',steer:'STICK',run:'FULL STICK',punch:'PUNCH',kick:'KICK',jump:'JUMP',guard:'GUARD',use:'USE',special:'GRIT',gas:'GAS',brake:'BRAKE',fire:'FIRE',swap:'SWAP',reset:'RESET'}
};
function keyName(a){return (KEYS[input.source]||KEYS.keyboard)[a]||KEYS.keyboard[a]||String(a).toUpperCase();}
const HELP_KEYS={
 keyboard:{move:'WASD / ARROWS',run:'SHIFT + MOVE',punch:'J / Z / CLICK',kick:'K / X / RIGHT CLICK',jump:'SPACE / SPACE + K',guard:'HOLD L / C',use:'E',special:'Q'},
 gamepad:{move:'L-STICK / D-PAD',run:'PUSH THE STICK FULLY',punch:'X / RT',kick:'B',jump:'A / A + B',guard:'HOLD LB / LT',use:'Y',special:'RB'},
 touch:{move:'LEFT STICK',run:'PUSH THE STICK FULLY',punch:'PUNCH',kick:'KICK',jump:'JUMP / JUMP + KICK',guard:'HOLD GUARD',use:'USE',special:'GRIT'}
};
function fillHelpKeys(){const t=HELP_KEYS[input.source]||HELP_KEYS.keyboard;document.querySelectorAll('[data-help]').forEach(k=>{k.textContent=t[k.dataset.help]||k.textContent;});}
function refreshPrompts(){
 document.querySelector('.controls-strip').innerHTML=[['move','MOVE'],['punch','PUNCH'],['kick','KICK'],['jump','JUMP'],['guard','GUARD'],['use','USE']].map(([a,l])=>`<span><kbd>${keyName(a)}</kbd> ${l}</span>`).join('');
 hudText('gritKey',keyName('special'));
 $('rcDrivingHint').innerHTML=`<kbd>${keyName('steer')}</kbd> STEER &nbsp; <kbd>${keyName('gas')}</kbd> GAS &nbsp; <kbd>${keyName('brake')}</kbd> BRAKE &nbsp; <kbd>${keyName('fire')}</kbd> FIRE &nbsp; <kbd>${keyName('swap')}</kbd> SWAP &nbsp; <kbd>${keyName('reset')}</kbd> RESET`;
 $('rcComicNext').innerHTML=(input.source==='touch'?'':keyName('use')+' / ')+'NEXT RACE <span class="arr">→</span>';
 if(!$('help').classList.contains('hidden'))fillHelpKeys();
 hudCache.delete('html:prompt');
 document.documentElement.classList.toggle('pad-nav',input.source==='gamepad');
}
input.onSourceChange(refreshPrompts);

// The game's own menus with a gamepad or keys: stick, D-pad or arrows move between buttons,
// A or Enter chooses, B, Backspace or Esc goes back. Touch and mouse simply tap the buttons.
function menuRoot(){
 if(!$('help').classList.contains('hidden'))return $('help');
 switch(state){case 'title':return $('title');case 'pause':return $('pause');case 'shop':return $('shop');case 'gameover':return $('gameover');case 'win':return $('win');case 'rumbleOver':return $('rumbleOver');
  case 'rcComic':return $('rcComic');case 'rcBrief':return $('rcBrief');case 'rcResult':case 'rcCup':return $('rcResult');case 'rcPause':return $('rcPause');}
 return null;}
function focusables(root){return [...root.querySelectorAll('button,input[type=range]')].filter(e=>!e.disabled&&e.offsetParent!==null);}
const MENU_DEFAULTS={title:['continueBtn','startBtn'],help:['helpDone'],pause:['resumeBtn'],shop:['leaveShop'],gameover:['reviveBtn'],win:['winNext'],rumbleOver:['rumbleAgain'],rcComic:['rcComicNext'],rcBrief:['rcStartRace'],rcResult:['rcNextHeat','rcReplayHeat'],rcPause:['rcResume']};
function defaultButton(root){for(const id of MENU_DEFAULTS[root.id]||[]){const b=$(id);if(b&&!b.disabled&&b.offsetParent!==null)return b;}return focusables(root)[0]||null;}
function focusMenu(root){if(!root||input.source==='touch')return;defaultButton(root)?.focus({preventScroll:true});}
function blurMenus(){const a=document.activeElement;if(a&&a!==document.body&&a!==canvas&&typeof a.blur==='function')a.blur();}
let navHeld=null,navRepeat=0;
function menuInput(dt){const root=menuRoot();if(!root){navHeld=null;return false;}
 const v=input.vector('move'),dir=v.y>.55?'up':v.y<-.55?'down':v.x>.55?'right':v.x<-.55?'left':null;let step=null;
 if(dir!==navHeld){navHeld=dir;navRepeat=.36;step=dir;}else if(dir){navRepeat-=dt;if(navRepeat<=0){navRepeat=.12;step=dir;}}
 const active=document.activeElement,inside=!!active&&root.contains(active)&&active!==root;
 if(step){
  if(!inside)defaultButton(root)?.focus();
  else if(active.type==='range'&&(step==='left'||step==='right')){active.value=String(Number(active.value)+(step==='right'?10:-10));active.dispatchEvent(new Event('input',{bubbles:true}));}
  else{const list=focusables(root),i=list.indexOf(active),next=list[(Math.max(0,i)+(step==='down'||step==='right'?1:-1)+list.length)%list.length];next?.focus();next?.scrollIntoView?.({block:'nearest'});}
 }
 if(input.pressed('confirm')){sound.init();if(inside&&input.source==='gamepad'){if(active.type!=='range')active.click();}else if(!inside)defaultButton(root)?.click();}
 else if(input.pressed('back'))menuBack();
 return true;}
function menuBack(){if(!$('help').classList.contains('hidden')){closeHelp();return;}
 if(state==='pause')togglePause();else if(state==='shop')closeShop();else if(state==='rcPause')Racing.pause();else if(state==='rcBrief')Racing.exit();}
// Esc, P or Start: pause and resume everywhere, and the original shortcuts on the race screens.
function pauseAction(){const pad=input.source==='gamepad';
 if(!$('help').classList.contains('hidden')){closeHelp();return;}
 if(state==='play'||state==='pause')togglePause();
 else if(state==='shop')closeShop();
 else if(state==='rcRace'||state==='rcPause')Racing.pause();
 else if(state==='rcComic')Racing.finishComic();
 else if(state==='rcBrief'){if(pad)Racing.startRace();else Racing.exit();}
 else if((state==='rcResult'||state==='rcCup')&&pad)defaultButton($('rcResult'))?.click();
}
// Runs first every frame: device-wide shortcuts, then menus, then the street's latched presses.
function globalInput(dt){
 for(const a of muted)if(!input.down(a))muted.delete(a);
 if(input.pressed('mute')){sound.init();sound.toggle();Racing.syncSettings();}
 if(input.pressed('full'))requestFull();
 if(input.pressed('pause')){pauseAction();return;}
 if(state==='rcComic'&&(input.pressed('use')||input.pressed('jump'))){Racing.finishComic();return;}
 if(menuInput(dt))return;
 if(state==='play')for(const a of STREET_KEYS)if(input.pressed(a)&&!muted.has(a))tap(a);
}
// Each mode shows its own on-screen buttons; menus hide them all.
const STREET_TOUCH=['punch','kick','jump','guard','use','special'],RACE_TOUCH=['gas','brake','fire','swap','reset'];
let touchMode='';const touchShown=new Map();
function setTouchShown(a,on){if(!kit.touch||touchShown.get(a)===on)return;touchShown.set(a,on);kit.touch.setShown(a,on);}
function syncTouch(){const m=state==='play'?'street':state==='rcRace'?'race':'none';if(m===touchMode)return;touchMode=m;if(!kit.touch)return;for(const a of STREET_TOUCH)setTouchShown(a,m==='street'&&a!=='use'&&a!=='special');for(const a of RACE_TOUCH)setTouchShown(a,m==='race');kit.touch.suspend(m==='none','game');}

function resize(w,h){W=w;H=h;const aspect=W/H;let height=aspect<.85?23:aspect<1.3?19:17.5;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();const pd=Math.min(devicePixelRatio||1,2);overlay.width=Math.floor(W*pd);overlay.height=Math.floor(H*pd);ctx.setTransform(pd,0,0,pd,0,0);Racing.onResize();}
function requestFull(){try{if(document.fullscreenElement){document.exitFullscreen?.();}else if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(()=>toast('Full screen is not available in this browser.',2));}else toast('Use your browser full-screen control.',2);}catch{}}
$('startBtn').onclick=newGame;$('continueBtn').onclick=()=>{lastSave=lastSave||readStore(STORE);loadCheckpoint();};$('howBtn').onclick=showHelp;$('helpClose').onclick=closeHelp;$('helpDone').onclick=closeHelp;$('titleSound').onclick=()=>{sound.init();sound.toggle();};$('modeBtn').onclick=()=>{prefs.easy=!prefs.easy;$('modeBtn').textContent='MODE: '+(prefs.easy?'EASY':'NORMAL');savePrefs();};$('muteBtn').onclick=()=>{sound.init();sound.toggle();};$('soundSetting').onclick=()=>{sound.init();sound.toggle();};$('pauseBtn').onclick=togglePause;$('resumeBtn').onclick=togglePause;$('fullBtn').onclick=requestFull;$('pauseHelp').onclick=showHelp;$('retryBtn').onclick=()=>{if(mode==='rumble')startRumble();else loadCheckpoint(true);};$('reviveBtn').onclick=()=>loadCheckpoint(true);$('againBtn').onclick=newGame;$('quitBtn').onclick=()=>{if(mode==='story'&&!activeFight&&!hero.dead)saveCheckpoint();toTitle();};$('overQuit').onclick=toTitle;$('winQuit').onclick=toTitle;$('leaveShop').onclick=closeShop;$('shopClose').onclick=closeShop;
$('winNext').onclick=()=>Racing.start(true);$('rumbleAgain').onclick=startRumble;$('rumbleQuit').onclick=toTitle;
// Graphics, touch layout and controller settings live in the kit's panel (F9 as well).
$('settingsBtn').onclick=()=>kit.menu.open();$('kitSettingsBtn').onclick=()=>kit.menu.open();
$('musicVolume').value=Math.round(prefs.music*100);$('musicVolume').oninput=e=>{prefs.music=Number(e.target.value)/100;sound.apply();savePrefs();};$('shakeBtn').textContent=prefs.shake?'ON':'OFF';$('shakeBtn').onclick=()=>{prefs.shake=!prefs.shake;$('shakeBtn').textContent=prefs.shake?'ON':'OFF';savePrefs();};
// Leaving the tab or window pauses a fight or a race, as before.
function autoPause(){if(state==='play'&&!hero.dead&&!winStarted)togglePause();else if(state==='rcRace')Racing.pause();}
addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
// Browsers only start audio after a gesture: any tap, click or key unlocks it.
addEventListener('pointerdown',()=>sound.init(),{capture:true,passive:true});addEventListener('keydown',()=>sound.init(),{capture:true});
// The kit's settings panel stops the loop; the music and engine stop with it.
kit.onPause(p=>sound.hold(p));
// Drag-scroll long menu panels on small touch screens.
for(const panel of document.querySelectorAll('.panel')){let pointer=null,py=0;panel.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||e.target.closest('button,input'))return;pointer=e.pointerId;py=e.clientY;panel.setPointerCapture(e.pointerId);});panel.addEventListener('pointermove',e=>{if(pointer===e.pointerId){panel.scrollTop+=py-e.clientY;py=e.clientY;}});panel.addEventListener('pointerup',()=>pointer=null);panel.addEventListener('pointercancel',()=>pointer=null);}

// ---------- Chapter 02: Parking Lot Pro-Am ----------
// The race has its own fixed-step simulation. The brawler and its facing fix are unchanged.
const Racing=(() => {
 const STORE_RC='riverblock-parking-lot-v2', RECORD_RC='riverblock-rc-records-v2';
 const COLORS=['#ec7055','#63aee0','#8abe5e','#f6c65c'];
 const NAMES=['NICO','ZIP','PATCH','BIG BELL'];
 const POINTS=[10,7,5,2], LETTERS='RUCKUS';
 const tracks=[
  {name:'SCHOOLYARD SHUFFLE',tag:'THE SCHOOL GATES',width:9.6,theme:0,conditions:'DRY ASPHALT / OIL / BOOST PADS / SMALL JUMP',points:[[-12,18],[12,18],[25,12],[27,-3],[20,-17],[2,-21],[-20,-17],[-28,-3],[-25,11]],hazards:[['boost',.13,-1.7],['oil',.31,1.6],['water',.46,-1.7],['ramp',.62,0],['boost',.83,1.6]],items:[['engine',.09,1.5],['shield',.22,0],['letter',.37,-1.5,0],['ammo',.52,1.4],['tires',.70,-1.2],['letter',.88,0,1],['turbo',.77,-1.5]]},
  {name:'BACK-LOT BENDS',tag:'BEHIND THE ARCADE',width:9.6,theme:1,conditions:'TIGHT TURNS / WATER / TWO JUMPS / POP-UP BARRIER',points:[[-17,23],[6,23],[23,20],[32,9],[28,-5],[11,-6],[8,-20],[-10,-26],[-27,-21],[-33,-4],[-22,7]],hazards:[['boost',.11,-1.5],['ramp',.19,-1.5],['water',.31,1.4],['oil',.47,-1.5],['gate',.58,1.5],['ramp',.72,0],['boost',.80,1.4],['oil',.93,1.6]],items:[['ammo',.08,1.5],['letter',.24,0,2],['turbo',.38,-1.5],['shield',.52,0],['engine',.65,-1.5],['letter',.85,0,3],['tires',.96,-1.6]]},
  {name:'RIVERSIDE RUMBLE',tag:'THE RIVERBLOCK FINAL',width:9.4,theme:2,conditions:'FAST SWEEPERS / OIL / JUMPS / TWO POP-UP BARRIERS',points:[[-17,24],[10,24],[29,19],[34,4],[25,-8],[31,-24],[14,-31],[-9,-26],[-27,-32],[-37,-18],[-30,-3],[-37,14],[-24,24]],hazards:[['boost',.07,-1.3],['ramp',.17,-1.4],['oil',.27,1.4],['gate',.34,-1.5],['water',.46,1.2],['boost',.54,0],['ramp',.62,0],['oil',.72,-1.3],['gate',.80,1.5],['boost',.89,-1.5]],items:[['ammo',.11,1.5],['letter',.23,0,4],['shield',.39,0],['tires',.49,-1.5],['turbo',.66,1.5],['letter',.84,0,5],['engine',.94,1.5]]}
 ];
 let track=null,cars=[],hazards=[],items=[],shots=[],fx=[],skids=[],crowd=[],rcBuilt=false;
 // One race scene, camera, light rig and post chain for every track; buildTrack refills the scene.
 const rcScene=new THREE.Scene(),rcCamera=new THREE.OrthographicCamera(-25,25,20,-20,.1,210);rcScene.background=new THREE.Color('#c5d9c2');rcScene.fog=new THREE.Fog('#c5d9c2',92,170);
 const rcSun=new THREE.DirectionalLight('#fff0ca',3.1);rcSun.position.set(-20,42,23);rcSun.castShadow=true;kit.shadow(rcSun,2048);rcSun.shadow.camera.left=-37;rcSun.shadow.camera.right=37;rcSun.shadow.camera.top=32;rcSun.shadow.camera.bottom=-32;rcSun.shadow.camera.near=1;rcSun.shadow.camera.far=110;rcSun.shadow.bias=-.0003;rcSun.shadow.normalBias=.035;rcSun.shadow.radius=2;
 const fillRC=new THREE.DirectionalLight('#c4e3df',.9);fillRC.position.set(18,20,-24);
 const rcLights=[new THREE.HemisphereLight('#fff6d4','#6c9194',2.1),new THREE.AmbientLight('#e3edd0',.45),rcSun,rcSun.target,fillRC];
 const postRC=createPost(kit,rcScene,rcCamera,{output:finish});
 const COMIC_URL=new URL('./comic.webp',import.meta.url).href;
 let cup=null,startSnapshot=null,raceTime=0,countdown=3.6,clock=0,rcAccum=0,noticeTime=0,goTime=0,resultsDelay=0,finishOrder=[],resumeState='rcRace',raceEnded=false,finishedResult=null;
 let cam=new THREE.Vector3(),rcShake=0,lastCount=-1,uiTime=0,recordCache=readStore(RECORD_RC)||{},resources=[],staticBatch=new Map();
 const edge=new Set();
 const clone=o=>JSON.parse(JSON.stringify(o)), mod=(x,n)=>(x%n+n)%n, angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
 let randomSeed=519;const random=(a=0,b=1)=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return a+randomSeed/4294967296*(b-a);};
 const isActive=()=>state.startsWith('rc');
 function show(id,visible=true){$(id).classList.toggle('hidden',!visible);}
 function clearControls(){edge.clear();resetInput();}
 function hideRaceLayers(){['rcComic','rcHud','rcBrief','rcResult','rcPause'].forEach(id=>show(id,false));blurMenus();}
 function enter(){hideMenus();['hud','title','banner','toast','vignette'].forEach(id=>show(id,false));show('rcUI');clearControls();sound.init();}
 function validSave(d){return d&&d.version===2&&Number.isInteger(d.heat)&&d.heat>=0&&d.heat<3&&Array.isArray(d.points)&&d.points.length===4&&d.points.every(Number.isFinite)&&d.upgrades&&['engine','turbo','tires'].every(k=>Number.isInteger(d.upgrades[k])&&d.upgrades[k]>=0&&d.upgrades[k]<=3)&&Number.isInteger(d.letters)&&d.letters>=0&&d.letters<=63&&Array.isArray(d.history)&&Number.isFinite(d.ammo)&&Number.isFinite(d.tokens);}
 function newCup(story=false){return {version:2,heat:0,points:[0,0,0,0],upgrades:{engine:0,turbo:0,tires:0},letters:0,ammo:5,tokens:1,history:[],completed:false,story,street:story?{time:elapsed,kills,bestCombo,deaths}:null};}
 function saveCup(){const ok=writeStore(STORE_RC,cup);$('rcSaveNote').textContent=ok?'Progress saves before each race. Retries restore this garage setup.':'Browser storage is blocked. Keep this tab open to keep your progress.';refreshTitle();return ok;}
 function refreshTitle(){const d=readStore(STORE_RC);show('rcContinueBtn',!!validSave(d));$('rcContinueBtn').textContent=d?.completed?'VIEW CUP RESULT':'CONTINUE RACING';}
 function start(story=false,resume=false){enter();const d=resume?readStore(STORE_RC):null;cup=validSave(d)?d:newCup(story);if(resume&&d){if(cup.completed){buildTrack(cup.heat);showCup();}else garage();}else{saveCup();comic();}}
 function comic(){state='rcComic';hideRaceLayers();show('rcComic');$('rcComicArt').src=COMIC_URL;focusMenu($('rcComic'));}
 function finishComic(){if(state!=='rcComic')return;garage();}
 function makeTrack(def){const curve=new THREE.CatmullRomCurve3(def.points.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');curve.arcLengthDivisions=1400;curve.updateArcLengths();const pts=curve.getSpacedPoints(420);const segs=[];let length=0;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);segs.push({x:a.x,z:a.z,dx,dz,l,s:length,tx:dx/l,tz:dz/l});length+=l;}return {def,curve,segs,length,hw:def.width/2,minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minZ:Math.min(...pts.map(p=>p.z)),maxZ:Math.max(...pts.map(p=>p.z))};}
 function sample(s,lane=0){s=mod(s,track.length);const idx=Math.min(track.segs.length-1,Math.floor(s/track.length*track.segs.length));let i=idx;while(i>0&&s<track.segs[i].s)i--;while(i<track.segs.length-1&&s>track.segs[i].s+track.segs[i].l)i++;const a=track.segs[i],t=clamp((s-a.s)/a.l,0,1);return {x:a.x+a.dx*t-a.tz*lane,z:a.z+a.dz*t+a.tx*lane,tx:a.tx,tz:a.tz,s,angle:Math.atan2(a.tz,a.tx)};}
 // Nearest point on the centre line. With a hint (the segment found last step) only the stretch around it is
 // searched; the whole loop is scanned when there is no hint or the hint no longer fits (a reset, a jump).
 let pBest=Infinity,pI=0,pT=0;
 function projTest(i,x,z){const a=track.segs[i],t=clamp(((x-a.x)*a.dx+(z-a.z)*a.dz)/(a.l*a.l),0,1),px=a.x+a.dx*t,pz=a.z+a.dz*t,dx=x-px,dz=z-pz,d=dx*dx+dz*dz;if(d<pBest){pBest=d;pI=i;pT=t;}}
 function project(x,z,hint=-1){const n=track.segs.length;pBest=Infinity;if(hint>=0&&hint<n)for(let k=-24;k<=24;k++)projTest(mod(hint+k,n),x,z);if(hint<0||hint>=n||pBest>(track.hw+2.5)**2){pBest=Infinity;for(let i=0;i<n;i++)projTest(i,x,z);}const a=track.segs[pI],px=a.x+a.dx*pT,pz=a.z+a.dz*pT,dx=x-px,dz=z-pz;return {x:px,z:pz,s:a.s+a.l*pT,lane:dx*-a.tz+dz*a.tx,tx:a.tx,tz:a.tz,i:pI,d:Math.sqrt(pBest)};}
 function box(parent,x,y,z,w,h,d,color,bevel=false){return meshBox(parent,x,y,z,w,h,d,color,bevel);}
 function batch(x,y,z,w,h,d,color,ry=0,geo='box',cast=true,rx=0){const key=geo+'|'+color+'|'+cast;if(!staticBatch.has(key))staticBatch.set(key,{geo,color,cast,list:[]});staticBatch.get(key).list.push([x,y,z,w,h,d,ry,rx]);}
 function flush(){for(const b of staticBatch.values()){const m=new THREE.InstancedMesh(geometries[b.geo],mat(b.color),b.list.length);b.list.forEach((v,i)=>{dummy.position.set(v[0],v[1],v[2]);dummy.scale.set(v[3],v[4],v[5]);dummy.rotation.set(v[7],v[6],0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.castShadow=b.cast;m.receiveShadow=true;rcScene.add(bakeInstances(m));}staticBatch.clear();}
 function ownGeo(g){resources.push(g);return g;}
 function signRC(text,x,y,z,w,h,bg='#17353d',fg='#fff0d0',ry=0,sub=''){const c=document.createElement('canvas');c.width=signWidth(w,768);c.height=Math.max(16,Math.round(c.width*h/w));const k=c.width/768,a=c.getContext('2d');a.fillStyle=bg;a.fillRect(0,0,c.width,c.height);a.strokeStyle=fg;a.globalAlpha=.3;a.lineWidth=3*k;a.strokeRect(8*k,6*k,c.width-16*k,c.height-12*k);a.globalAlpha=1;a.textAlign='center';a.textBaseline='middle';a.fillStyle=fg;let fs=c.height*(sub?.5:.7);a.font=`900 ${fs}px "Arial Black",Arial,sans-serif`;while(a.measureText(text).width>c.width-34*k&&fs>4){fs-=2*k;a.font=`900 ${fs}px "Arial Black",Arial,sans-serif`;}a.fillText(text,c.width/2,c.height*(sub?.4:.53));if(sub){a.font=`700 ${c.height*.16}px Courier New`;a.fillText(sub,c.width/2,c.height*.81);}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;resources.push(tex);const material=printedMaterial(tex,{side:THREE.DoubleSide});resources.push(material);const m=new THREE.Mesh(ownGeo(new THREE.PlaneGeometry(w,h)),material);m.position.set(x,y,z);m.rotation.y=ry;rcScene.add(m);return m;}
 // Combine fixed parts by material. Wheels and all moving joints remain separate.
 function mergeFixed(parent){for(const child of [...parent.children])if(child.isGroup)mergeFixed(child);const buckets=new Map();for(const m of [...parent.children])if(m.isMesh&&!m.isInstancedMesh&&!Array.isArray(m.material)){if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(m);}for(const [material,list] of buckets){if(list.length<2)continue;const parts=[];let count=0;for(const m of list){m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);parts.push(g);count+=g.attributes.position.count;}const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);let off=0;for(const g of parts){const n=g.attributes.position.count;positions.set(g.attributes.position.array,off*3);if(g.attributes.normal)normals.set(g.attributes.normal.array,off*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,off*2);off+=n;g.dispose();}const geo=ownGeo(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));const merged=new THREE.Mesh(geo,material);merged.castShadow=list.some(m=>m.castShadow);merged.receiveShadow=list.some(m=>m.receiveShadow);for(const m of list)parent.remove(m);parent.add(merged);}}
 function road(){const pos=[],norm=[],indices=[],n=track.segs.length;for(let i=0;i<=n;i++){const p=sample(i*track.length/n);for(const side of [-1,1]){pos.push(p.x-p.tz*track.hw*side,.065,p.z+p.tx*track.hw*side);norm.push(0,1,0);}if(i<n){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=ownGeo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setIndex(indices);const m=new THREE.Mesh(g,mat('#445e69',.96));m.receiveShadow=true;rcScene.add(m);
  const shp=new THREE.Shape();for(let i=0;i<=n;i++){const p=sample(i*track.length/n,-track.hw-.45);if(!i)shp.moveTo(p.x,-p.z);else shp.lineTo(p.x,-p.z);}const inf=new THREE.Mesh(ownGeo(new THREE.ShapeGeometry(shp)),mat(track.def.theme===1?'#9cad83':'#99b383'));inf.rotation.x=-PI/2;inf.position.y=.08;inf.receiveShadow=true;rcScene.add(inf);
  const steps=Math.ceil(track.length/1.6);for(let i=0;i<steps;i++){const s=i*track.length/steps,p=sample(s),angle=-p.angle;for(const side of [-1,1]){const c=sample(s,side*(track.hw+.25));batch(c.x,.28,c.z,track.length/steps+ .06,.45,.68,Math.floor(i/2)%2?'#f1e3c8':'#df7c60',angle,'bevel');if(i%6===0){const q=sample(s,side*(track.hw+.95));batch(q.x,.08,q.z,.14,.06,.6,'#bcc5a8',angle,'box',false);}}if(i%7===0)batch(p.x,.08,p.z,1.25,.01,.10,'#aab9ac',angle,'box',false);}
  // Direction arrows and worn parking stripes.
  for(let s=12;s<track.length;s+=25){const p=sample(s,-.2),a=-p.angle;for(let q=0;q<2;q++){const xx=p.x+p.tx*q*.9,zz=p.z+p.tz*q*.9;batch(xx-p.tz*.35,.079,zz+p.tx*.35,.88,.02,.13,'#dae1c5',a+.67,'box',false);batch(xx+p.tz*.35,.079,zz-p.tx*.35,.88,.02,.13,'#dae1c5',a-.67,'box',false);}}
  const start=sample(0);for(let a=0;a<2;a++)for(let b=0;b<12;b++){const p=sample((a-.5)*.65,(b-5.5)*track.def.width/12);batch(p.x,.091,p.z,.66,.024,track.def.width/12,(a+b)%2?'#203b43':'#fff1d1',-start.angle,'box',false);}for(let slot=0;slot<4;slot++){const d=-3.2-Math.floor(slot/2)*3,lane=(slot%2?1:-1)*1.35,p=sample(d,lane);batch(p.x,.08,p.z,1.9,.015,.08,'#e8dfbb',-p.angle,'box',false);}
 }
 function treeRC(x,z,s=1){batch(x,.28,z,2.6*s,.55,2.4*s,'#d5be99',0,'bevel');batch(x,1.8*s,z,.31,3.1*s,.31,'#8c7652');const cc=['#77a682','#94b37d','#b0c48a','#6a997e'];for(let i=0;i<6;i++){const a=i*2.4,r=i?random(.4,1):0;batch(x+Math.cos(a)*r*s,3.4*s+random(-.3,.5),z+Math.sin(a)*r*s,1.5*s,1.7*s,1.4*s,cc[i%4],a,'leaf');}}
 function cone(x,z,s=.8){batch(x,.10,z,s,.2,s,'#344d50',0,'bevel');batch(x,.36,z,s*.48,.56,s*.48,'#ee9b5a',0,'cyl');batch(x,.46,z,s*.36,.12,s*.36,'#ffe7bc',0,'cyl');}
 function tyres(x,z){for(let k=0;k<2;k++)batch(x,.24+k*.38,z,.85,.36,.85,'#30464a',0,'cyl');batch(x,.81,z,.42,.03,.42,'#83978b',0,'cyl');}
 function fenceRC(x,z,w,ry=0){for(let t=-w/2;t<w/2;t+=.75){const xx=x+Math.cos(ry)*t,zz=z-Math.sin(ry)*t;batch(xx,1.15,zz,.06,2.3,.08,'#638178',ry);if(Math.round(t*4)%8===0)batch(xx,1.26,zz,.13,2.6,.14,'#47696b',ry);}for(const y of [.30,1.65,2.24])batch(x,y,z,w,.075,.10,'#638178',ry);}
 function shed(x,z,w=10){batch(x,2.6,z,w,5.2,5.5,'#d3b898',0,'bevel');batch(x,5.28,z,w+.5,.28,6.1,'#567976',0,'bevel');batch(x,1.8,z+2.82,w*.67,3.55,.1,'#567980');for(let y=.3;y<3.5;y+=.45)batch(x,y,z+2.91,w*.65,.045,.025,'#8aa29a',0,'box',false);batch(x,4.32,z+2.9,w*.87,.98,.12,'#264851');signRC('PIT STOP',x,4.32,z+2.99,w*.82,.89,'#24474b','#e8f4c8',0,'PARTS / PRIDE / NO REFUNDS');}
 function world(){const theme=track.def.theme,cx=(track.minX+track.maxX)/2,cz=(track.minZ+track.maxZ)/2,ww=track.maxX-track.minX+24,dd=track.maxZ-track.minZ+24;
  batch(cx,-1.5,cz,220,2,210,theme===2?'#76afb1':'#88a5a0',0,'box',false);batch(cx,-.65,cz,ww,1.1,dd,'#c1ae8a',0,'bevel');batch(cx,-.02,cz,ww-.7,.09,dd-.7,'#d8c9a7',0,'bevel',false);
  road();
  // Backdrop stays outside the road. The player remains readable in every corner.
  const back=track.minZ-14;for(let i=0;i<8;i++){const x=cx-40+i*11,h=random(9,15);batch(x,h/2,back-8,9,h,7,['#aabfb0','#bfccb0','#9bbab0'][i%3]);for(let y=3;y<h-1;y+=2.2)for(let j=-1;j<=1;j++)batch(x+j*2.0,y,back-4.44,.9,1.25,.04,'#d9dfba',0,'box',false);}
  batch(cx,4.4,back+1,42,8.7,5.5,'#c2997b',0,'bevel');batch(cx,8.9,back+1,42.7,.40,6.1,'#e4d0a8');for(let x=cx-18;x<cx+19;x+=4.0){batch(x,5.6,back+3.82,2.1,3.0,.20,'#eedaba');batch(x,5.65,back+3.96,1.74,2.65,.055,'#548089');batch(x,5.65,back+4.01,.075,2.65,.1,'#d0d4b1');}signRC(theme===0?'RIVERBLOCK HIGH':theme===1?'SIDE QUEST ARCADE':'RIVERBLOCK DOCKS',cx,7.75,back+4.0,17,1.4,'#244b53','#f8e9bd');
  for(let j=0;j<3;j++){const z=track.minZ-8+j*8;treeRC(track.minX-9,z,1.15);treeRC(track.maxX+9,z,.9);}fenceRC(cx,track.minZ-7,ww-7);fenceRC(track.minX-8,cz,dd-15,PI/2);fenceRC(track.maxX+8,cz,dd-15,PI/2);
  if(theme===2){batch(track.maxX+18,.07,cz,14,.12,dd+8,'#67a4ae',0,'box',false);for(let z=track.minZ-10;z<track.maxZ+12;z+=2.8){batch(track.maxX+10.1,.75,z,.28,1.5,.28,'#496f72');batch(track.maxX+18,.15,z,random(2,8),.03,.09,'#acd1bb',0,'box',false);}batch(track.maxX+10.1,1.3,cz,.12,.12,dd,'#657e75');}
  shed(-6,-2,10);for(let i=0;i<5;i++)tyres(-13+i*.95,2.5);treeRC(8,-3,1.3);treeRC(12,-6,1.05);
  // Picnic tables and workshop details keep the two chapters in the same town.
  for(let x=-2;x<9;x+=7){batch(x,.8,6,4,.16,1.5,'#b88a56',0,'bevel');for(const z of [4.85,7.15]){batch(x,.49,z,4,.13,.55,'#c8a66c',0,'bevel');for(const dx of [-1.3,1.3])batch(x+dx,.3,z,.17,.6,.43,'#4e7067');}for(const dx of [-1.4,1.4])batch(x+dx,.39,6,.18,.75,1.2,'#4e7067');}
  for(let s=8;s<track.length;s+=10.3){const p=sample(s,track.hw+1.3);if(Math.floor(s)%3===0)tyres(p.x,p.z);else cone(p.x,p.z,.72);}
  for(let i=0;i<5;i++){const p=sample((i+.4)*track.length/5,track.hw+4);batch(p.x,3.0,p.z,.13,6,.13,'#476a69');batch(p.x+.55,6,p.z,1.4,.14,.17,'#476a69');batch(p.x+1.2,5.78,p.z,.65,.4,.58,'#ebdca6',0,'bevel');}
  // Finish arch: posts outside the barrier and a high, readable sign.
  const p=sample(0),arch=new THREE.Group();rcScene.add(arch);arch.position.set(p.x,0,p.z);arch.rotation.y=-p.angle;for(const side of [-1,1]){box(arch,0,2.9,side*(track.hw+1.2),.5,5.8,.5,'#2b5259',true);box(arch,0,.6,side*(track.hw+1.2),1.9,1.2,1.9,'#d8b793',true);}box(arch,0,5.3,0,.38,1.65,track.def.width+3,'#193b42',true);for(let k=0;k<3;k++)for(const side of [-1,1])box(arch,.21,4.9+(k%2)*.66,side*(track.hw-.1-Math.floor(k/2)*.65),.04,.62,.62,'#ffedca');
  const banner=signRC('RIVERBLOCK RC',p.x,5.3,p.z,track.def.width-1.1,1.4,'#193b42','#fff1ce',PI/2-p.angle,'PARKING LOT CUP');banner.position.x+=Math.cos(p.angle)*.23;banner.position.z+=Math.sin(p.angle)*.23;const backBanner=banner.clone();backBanner.position.x-=Math.cos(p.angle)*.46;backBanner.position.z-=Math.sin(p.angle)*.46;backBanner.rotation.y+=PI;rcScene.add(backBanner);
  // Reuse the corrected fighter model. Nico now holds a remote control.
  for(let i=0;i<5;i++){const type=i===0?'hero':i===4?'friend':i===1?'runner':'grunt',a=makeActor(type,-8+i*2.9,12);rcScene.add(a.root,a.shadow);if(a.ring){scene.remove(a.ring);a.ring.visible=false;}a.face=1;a.invuln=0;a.walkSpeed=0;a.x=-8+i*2.9;a.z=12;a.baseScale=i===0?1:.87;animateActor(a,0);a.facing.rotation.y=-.08;box(a.torso,0,.10,.64,.62,.35,.27,'#293e46',true);box(a.torso,.2,.46,.64,.025,.6,.025,'#b5c3ad');box(a.torso,-.17,.27,.81,.12,.06,.08,'#ef805d');a.armL.rotation.x=a.armR.rotation.x=-1.4;mergeFixed(a.root);crowd.push(a);}
  signRC('SAME CREW. DIFFERENT WHEELS.',0,1.2,13.7,16,.85,'#325456','#ecedc5');
  for(let i=0;i<9;i++){const s=i*track.length/9,p=sample(s,-track.hw-1.45);batch(p.x,.19,p.z,.8,.35,.8,'#d1c09c',0,'bevel');}
  flush();
 }
 function releaseCar(c){rcScene.remove(c.root,c.shadow,c.glow);c.shadow.material.dispose();c.glow.geometry.dispose();c.glow.material.dispose();}
 function disposeWorld(){for(const a of crowd){a.materials?.forEach(m=>m.dispose());a.geos?.forEach(g=>g.dispose());a.shadow.material.dispose();if(a.ring){a.ring.geometry.dispose();a.ring.material.dispose();}}crowd=[];for(const c of cars)releaseCar(c);for(const it of items){it.ring.geometry.dispose();it.ring.material.dispose();}for(const f of fx)rcScene.remove(f.mesh);for(const r of resources)r.dispose?.();resources=[];rcScene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});rcScene.clear();rcBuilt=false;hazards=[];items=[];cars=[];shots=[];fx=[];skids=[];staticBatch.clear();}
 function buildTrack(index){disposeWorld();randomSeed=72691+index*117;track=makeTrack(tracks[index]);rcScene.add(...rcLights);world();buildHazards();buildItems();buildCars();resizeRC();const p=sample(0);cam.set(p.x,0,p.z);updateCamera(.1,true);rcScene.updateMatrixWorld(true);rcBuilt=true;}
 function carModel(color,id){const g=new THREE.Group(),body=new THREE.Group();g.add(body);box(body,0,.38,0,2.38,.42,1.28,color,true);box(body,-.14,.28,0,2.55,.2,1.06,'#273e44',true);box(body,.50,.62,0,1.06,.22,1.30,color,true);box(body,-.37,.86,0,.97,.73,1.08,color,true);box(body,-.34,1.255,0,1.08,.11,1.19,color,true);
  box(body,.171,.96,0,.035,.38,.88,'#2c515c');box(body,-.84,.99,0,.032,.33,.8,'#315762');for(const side of [-1,1]){box(body,-.29,1.00,side*.554,.73,.36,.022,'#355d65');box(body,-.60,1.00,side*.573,.025,.41,.04,'#add1c1');box(body,.38,.766,side*.26,1.06,.025,.19,'#fff1ce');box(body,-.34,1.32,side*.26,1.08,.025,.19,'#fff1ce');box(body,1.195,.51,side*.43,.06,.18,.23,'#fff0b7',true);box(body,-1.19,.49,side*.45,.05,.17,.22,'#ffb572');}
  box(body,1.26,.33,0,.18,.23,1.40,'#e1dac0',true);box(body,-1.25,.32,0,.15,.21,1.40,'#b6bfae',true);box(body,1.235,.52,0,.05,.15,.44,'#31505a');box(body,-1.01,.67,0,.38,.24,1.18,color,true);box(body,-1.00,.80,0,.25,.025,.87,'#314c54');
  const tires=[];for(const x of [-.77,.73])for(const side of [-1,1]){const wheel=new THREE.Group();wheel.position.set(x,.35,side*.75);body.add(wheel);const t=new THREE.Mesh(geometries.cyl,mat('#24383e',.88));t.scale.set(.73,.40,.73);t.rotation.x=PI/2;wheel.add(t);t.castShadow=true;const hub=new THREE.Mesh(geometries.cyl,mat('#d5ddc4',.45,.24));hub.scale.set(.31,.415,.31);hub.rotation.x=PI/2;wheel.add(hub);tires.push({g:wheel,x,side});}
  box(body,-.70,1.55,.38,.025,.6,.025,'#31464d');box(body,-.70,1.9,.38,.1,.10,.1,color,true);
  const buggy=new THREE.Group();body.add(buggy);buggy.visible=false;box(buggy,-1.10,1.2,0,.40,.13,1.7,color,true);for(const side of [-1,1]){box(buggy,-.98,.93,side*.55,.1,.45,.1,'#263f46');box(buggy,-.25,1.44,side*.52,1.15,.11,.1,'#d9e6c3',true);}const cage=new THREE.Group();body.add(cage);for(const side of [-1,1]){box(cage,-.5,.97,side*.66,.10,1.08,.1,'#c5f9a5',true);box(cage,-.22,1.49,side*.66,.9,.09,.1,'#c5f9a5',true);}box(cage,-.50,1.50,0,.10,.10,1.35,'#e0ffc2',true);cage.visible=false;
  const glow=ring(1.40,color,.5);glow.position.y=.10;rcScene.add(glow);if(id!==0)glow.visible=false;
  mergeFixed(body);const sh=shadow(rcScene,1.15);rcScene.add(g);return {root:g,body,tires,buggy,cage,glow,shadow:sh};}
 function buildCars(){for(let id=0;id<4;id++){const startS=id===0?-6.9:id===1?-2.8:id===2?-3.3:-6.4,lane=id%2?1.30:-1.30,p=sample(startS,lane),model=carModel(COLORS[id],id);const c={id,name:NAMES[id],...model,x:p.x,z:p.z,angle:p.angle,vx:0,vz:0,speed:0,y:0,vy:0,progress:startS,lastS:p.s,proj:project(p.x,p.z),lapStart:0,laps:[],lap:0,finishTime:null,rank:null,spin:0,stun:0,invuln:0,shield:0,boost:0,water:0,hitCool:0,jumpCool:0,fireCool:0,resetCool:0,ammo:id===0?cup.ammo:3,weapon:'rocket',upgrades:id===0?clone(cup.upgrades):{engine:cup.heat,tires:1,turbo:1},letters:id===0?cup.letters:0,lane,baseLane:lane,aiFire:7+id*3,stuck:0,steer:0,gas:0,brake:0,lastTrackS:p.s,driftTimer:0};cars.push(c);syncCar(c,0);} }
 function padMesh(kind,p,w,d){const g=new THREE.Group();g.position.set(p.x,.09,p.z);g.rotation.y=-p.angle;rcScene.add(g);if(kind==='boost'){box(g,0,.035,0,d,.07,w,'#aacb6a',true);for(let i=-1;i<=1;i++){for(const side of [-1,1]){const b=box(g,i*.65,.09,side*.30,.83,.025,.14,'#f1ffd2');b.rotation.y=side*.65;}}}else if(kind==='oil'||kind==='water'){const m=new THREE.Mesh(geometries.cyl,mat(kind==='oil'?'#243b4b':'#78b7bc',kind==='oil'?.20:.15,kind==='oil'?.27:.16));m.scale.set(d,.018,w);g.add(m);for(let j=0;j<3;j++){const l=box(g,-.7+j*.7,.018,(j%2?-.25:.24),.8,.015,.10,kind==='oil'?['#588f98','#95788b','#72ae9e'][j]:'#c6e2cf');l.rotation.y=-.25;}}else if(kind==='ramp'){const vertices=[-d/2,0,-w/2,-d/2,0,w/2,d/2,.68,w/2,d/2,.68,-w/2,d/2,0,-w/2,d/2,0,w/2];const ge=ownGeo(new THREE.BufferGeometry());ge.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));ge.setIndex([0,1,2,0,2,3,3,2,5,3,5,4,0,3,4,1,5,2]);ge.computeVertexNormals();const r=new THREE.Mesh(ge,mat('#c4985e'));r.castShadow=true;r.receiveShadow=true;g.add(r);for(const z of [-w/2+.1,w/2-.1]){const bar=box(g,0,.37,z,d+.08,.12,.15,'#e1b97b');bar.rotation.z=.22;}const stripe=box(g,0,.38,0,d*.75,.022,.30,'#f9e7ad');stripe.rotation.z=.22;}return g;}
 function buildHazards(){for(let i=0;i<track.def.hazards.length;i++){const [kind,t,lane]=track.def.hazards[i],p=sample(track.length*t,lane),w=kind==='oil'?2.5:kind==='water'?3.6:2.9,d=kind==='ramp'?3.2:kind==='water'?4.2:3.0;const g=padMesh(kind,p,w,d);const h={kind,s:track.length*t,lane,x:p.x,z:p.z,angle:p.angle,tx:p.tx,tz:p.tz,w,d,mesh:g,phase:i*.7,up:false,gate:null};if(kind==='gate'){box(g,0,0,0,.65,.06,w,'#344d4f',true);h.gate=box(g,0,.35,0,.32,.70,w,'#eab361',true);for(let j=-1;j<=1;j++)box(h.gate,0,0,j*.21,.98,.90,.10,'#33474a');}hazards.push(h);}}
 const ITEM_STYLE={engine:['E','#fcab69','ENGINE +1'],turbo:['T','#f1d26d','TURBO +1'],tires:['G','#b9e68d','GRIP +1'],shield:['C','#a6f1e5','ROLL CAGE'],ammo:['+','#cddcff','AMMO +3'],letter:['?','#f2eea0','LETTER']};
 function buildItems(){track.def.items.forEach(([type,t,lane,letter],idx)=>{const p=sample(track.length*t,lane),style=ITEM_STYLE[type],label=type==='letter'?LETTERS[letter]:style[0],g=new THREE.Group();g.position.set(p.x,1,p.z);rcScene.add(g);box(g,0,0,0,.99,.99,.24,style[1],true);const text=signRC(label,0,0,0,.80,.80,style[1],'#1a343c');g.add(text);text.position.set(0,0,.133);const back=text.clone();g.add(back);back.rotation.y=PI;back.position.z=-.133;const r=ring(.60,style[1],.45);r.position.set(p.x,.091,p.z);rcScene.add(r);const active=type!=='letter'||!(cup.letters&(1<<letter));g.visible=r.visible=active;items.push({type,letter,s:track.length*t,x:p.x,z:p.z,mesh:g,ring:r,ready:active,respawn:0,idx});});}
 function garage(){state='rcBrief';hideRaceLayers();show('rcBrief');clearControls();buildTrack(cup.heat);$('rcBriefKicker').textContent='CHAPTER 02 / PARKING LOT PRO-AM';$('rcBriefTitle').textContent=track.def.name;$('rcBriefSub').textContent=cup.heat===0?'Nico has the red car. Three rivals want the cup.':'Next stop: '+track.def.tag.toLowerCase()+'. Keep the cup run alive.';$('rcBriefHeat').textContent=String(cup.heat+1).padStart(2,'0')+' / 03';$('rcConditions').textContent=track.def.conditions;$('rcCollectNote').textContent=popcount(cup.letters)+' / 6 RUCKUS letters. Collect the full set to build the buggy.';updateGarage();drawMap($('rcPreviewMap'),false,true);saveCup();focusMenu($('rcBrief'));}
 function updateGarage(){$('rcTokens').textContent=cup.tokens+' TOKEN'+(cup.tokens===1?'':'S');for(const k of ['engine','turbo','tires']){$('rc'+k[0].toUpperCase()+k.slice(1)+'Level').textContent=cup.upgrades[k]+' / 3';document.querySelector(`[data-tune="${k}"]`).disabled=cup.tokens<=0||cup.upgrades[k]>=3;}$('rcAutoBrief').textContent='AUTO GAS: '+(prefs.rcAuto?'ON':'OFF');}
 function tune(k){if(state!=='rcBrief'||cup.tokens<=0||cup.upgrades[k]>=3)return;cup.upgrades[k]++;cup.tokens--;sound.play('buy');updateGarage();saveCup();}
 function startRace(){if(state!=='rcBrief')return;startSnapshot=clone(cup);raceTime=0;countdown=3.6;rcAccum=0;resultsDelay=0;finishOrder=[];raceEnded=false;finishedResult=null;noticeTime=0;lastCount=-1;goTime=0;for(const c of cars)releaseCar(c);cars=[];for(const o of [...fx,...shots])rcScene.remove(o.mesh);fx=[];shots=[];buildCars();hideRaceLayers();state='rcRace';show('rcHud');show('rcCountdown');show('rcNotice',false);clearControls();sound.init();cam.set(cars[0].x,0,cars[0].z);updateCamera(.016,true);updateHud();saveCup();}
 function pause(){if(state==='rcRace'){resumeState=state;state='rcPause';show('rcPause');clearControls();updateSettings();engineLevel(0);focusMenu($('rcPause'));}else if(state==='rcPause'){state=resumeState;show('rcPause',false);blurMenus();clearControls();sound.init();}}
 function updateSettings(){$('rcSoundSetting').textContent=prefs.sound?'ON':'OFF';$('rcAuto').textContent=prefs.rcAuto?'ON':'OFF';$('rcShake').textContent=prefs.shake?'ON':'OFF';$('rcMute').textContent=prefs.sound?'♫':'♪';}
 function restart(){cup=clone(startSnapshot||cup);garage();}
 function exit(){engineLevel(0);if(state==='rcRace'||state==='rcPause'){cup=clone(startSnapshot||cup);saveCup();}hideRaceLayers();show('rcUI',false);show('vignette');clearControls();disposeWorld();toTitle();refreshTitle();}
 function notify(text,duration=1.7){$('rcNotice').textContent=text;show('rcNotice');noticeTime=duration;}
 function popcount(n){let x=0;while(n){x+=n&1;n>>>=1;}return x;}
 function raceFmt(n){if(!Number.isFinite(n))return '—';return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')+'.'+String(Math.floor(n*100)%100).padStart(2,'0');}
 function stats(c){const easy=prefs.easy,base=c.id===0?17.6:(easy?[0,12.9,12.4,13.1]:[0,14.1,13.5,14.6])[c.id]+cup.heat*.2;return {max:base+c.upgrades.engine*.85+(c.letters===63?1.0:0),accel:9.8+c.upgrades.turbo*1.35,grip:5.7+c.upgrades.tires*1.25,turn:2.38+c.upgrades.tires*.09};}
 // Steering is the move stick's x (keys, D-pad or touch stick); gas and brake keep analog triggers.
 function controlInput(){const mv=input.vector('move');return {steer:clamp(mv.x,-1,1),gas:Math.max(held('gas')?input.value('gas'):0,prefs.rcAuto?1:0),brake:held('brake')?input.value('brake'):0,fire:held('fire'),swap:edge.has('swap'),reset:edge.has('reset')};}
 function ai(c,dt){const st=stats(c),proj=c.proj||project(c.x,c.z),speed=Math.hypot(c.vx,c.vz),look=clamp(3.3+speed*.38,4.0,9.2);let lane=c.baseLane+Math.sin(raceTime*.47+c.id*2)*.45;
  const ahead=cars.find(o=>o!==c&&o.finishTime===null&&o.progress>c.progress&&o.progress-c.progress<7&&Math.abs(o.proj.lane-c.proj.lane)<1.7);if(ahead)lane=clamp(-ahead.proj.lane+(c.id%2?1.1:-1.1),-2.1,2.1);
  const hz=hazards.find(h=>['oil','gate','water'].includes(h.kind)&&mod(h.s-proj.s,track.length)<look+4&&mod(h.s-proj.s,track.length)>0);if(hz)lane=hz.lane>=0?-1.9:1.9;c.lane=mix(c.lane,lane,dt*1.5);
  const p=sample(proj.s+look,c.lane),desired=Math.atan2(p.z-c.z,p.x-c.x),error=angleDiff(desired,c.angle),tangent1=sample(proj.s+look*.5),tangent2=sample(proj.s+look*1.8),bend=Math.abs(angleDiff(tangent2.angle,tangent1.angle)),target=st.max*(1-clamp(bend*.46,0,.49));let gas=speed<target?.99:.15,brake=speed>target+1.2?.52:0;if(Math.abs(error)>1.2){gas=.4;brake=.5;}const steer=clamp(error*2.15,-1,1);c.aiFire-=dt;if(c.id>0&&cup.heat>0&&c.aiFire<0&&c.ammo>0){const victim=cars.find(o=>o!==c&&o.finishTime===null&&Math.hypot(o.x-c.x,o.z-c.z)<12&&Math.hypot(o.x-c.x,o.z-c.z)>3&&Math.abs(angleDiff(Math.atan2(o.z-c.z,o.x-c.x),c.angle))<.18);if(victim){fire(c);c.aiFire=7+random(1,5);}}
  return {steer,gas,brake,fire:false};}
 function createFx(x,y,z,color,n=10,power=3){if(fx.length>120)return;for(let i=0;i<n;i++){const m=new THREE.Mesh(geometries.box,mat(color));m.position.set(x,y,z);m.scale.setScalar(random(.08,.20));rcScene.add(m);fx.push({mesh:m,life:random(.25,.65),max:.65,vx:random(-power,power),vy:random(1,power+1),vz:random(-power,power)});}}
 function burstCar(c,kind='crash'){if(c.hitCool>0)return;c.hitCool=.6;if(c.id===0){sound.play(kind==='weapon'?'heavy':'hit');rcShake=.18;input.rumble(kind==='weapon'?.7:.35,kind==='weapon'?220:90);}createFx(c.x,.5+c.y,c.z,kind==='weapon'?'#ffba75':'#efe2b4',10,3.4);}
 function hitCar(c,owner=null){if(c.invuln>0||c.finishTime!==null)return;if(c.shield>0){c.shield=Math.max(0,c.shield-1.2);c.invuln=.45;createFx(c.x,1,c.z,'#caffb7',12,3);if(c.id===0)sound.play('guard');return;}burstCar(c,'weapon');c.stun=.65;c.spin=1.05;c.vx*=.29;c.vz*=.29;c.invuln=1.5;if(c.id===0)notify('HIT! GET BACK ON THE GAS.',1.15);if(owner?.id===0&&c.id!==0){sound.play('heavy');notify(c.name+' SPUN OUT!',1.1);}}
 function resetCar(c,manual=false){if(c.resetCool>0)return;const p=sample(c.proj?.s||c.lastS,c.id===0?0:c.baseLane);c.x=p.x;c.z=p.z;c.angle=p.angle;c.vx=c.vz=0;c.speed=0;c.y=c.vy=0;c.spin=0;c.stun=.65;c.invuln=1.7;c.resetCool=2.2;c.stuck=0;c.lastS=p.s;if(c.id===0){notify('BACK ON TRACK · GO!',1.3);sound.play('alert');}}
 function fire(c){if(countdown>0||c.fireCool>0||c.stun>0||c.finishTime!==null)return;c.fireCool=.50;if(c.ammo<=0){if(c.id===0){sound.tone(190,.09,'square',.05);notify('NO AMMO · COLLECT A BLUE +',1.1);}return;}c.ammo--;const d={x:Math.cos(c.angle),z:Math.sin(c.angle)};let m,shot;if(c.weapon==='bomb'){m=new THREE.Group();const b=new THREE.Mesh(geometries.leaf,mat('#2b424a'));b.scale.setScalar(.45);m.add(b);box(m,0,.48,0,.12,.22,.12,'#f8bd5c');m.position.set(c.x-d.x*1.55,.34,c.z-d.z*1.55);shot={kind:'bomb',owner:c,mesh:m,x:m.position.x,z:m.position.z,vx:0,vz:0,life:9,age:0};}else{m=new THREE.Group();box(m,0,0,0,1.0,.23,.26,'#ffe2a1',true);box(m,-.20,0,0,.35,.13,.57,'#ed8e59',true);box(m,-.63,0,0,.42,.16,.16,'#eff88b',true);m.position.set(c.x+d.x*1.6,.57+c.y,c.z+d.z*1.6);m.rotation.y=-c.angle;shot={kind:'rocket',owner:c,mesh:m,x:m.position.x,z:m.position.z,vx:d.x*(31+c.speed*.25),vz:d.z*(31+c.speed*.25),life:2.15,age:0};}rcScene.add(m);shots.push(shot);if(c.id===0){input.rumble(.15,40);sound.tone(c.weapon==='bomb'?155:560,.17,'sawtooth',.10,0,null,c.weapon==='bomb'?80:160);}}
 function stepCar(c,input,dt){const st=stats(c);for(const k of ['shield','boost','spin','stun','invuln','hitCool','jumpCool','fireCool','resetCool'])c[k]=Math.max(0,c[k]-dt);c.water=0;
  let speed=Math.hypot(c.vx,c.vz);const grounded=c.y<.16;
  for(const h of hazards){const dx=c.x-h.x,dz=c.z-h.z,along=dx*h.tx+dz*h.tz,side=dx*-h.tz+dz*h.tx;if(Math.abs(along)>h.d*.5+.42||Math.abs(side)>h.w*.5+.3)continue;
   if(h.kind==='ramp'&&grounded&&c.jumpCool<=0&&speed>5){c.vy=4.9+speed*.04;c.y=.18;c.jumpCool=1.2;if(c.id===0){sound.play('jump');notify('AIR TIME!',.8);}}
   else if(h.kind==='boost'&&grounded){if(c.boost<.3&&c.id===0){sound.tone(280,.22,'sawtooth',.10,0,null,680);notify('ZIP!',.65);}c.boost=1.0;}
   else if(h.kind==='water'&&grounded)c.water=1;
   else if(h.kind==='oil'&&grounded&&c.spin<=0&&c.invuln<=0&&c.shield<=0&&speed>4){c.spin=.83;c.invuln=1.65;c.vx*=.65;c.vz*=.65;if(c.id===0){sound.noise(.22,.08,0,null,3400);notify('OIL! HOLD YOUR LINE.',1.2);}}
   else if(h.kind==='gate'&&h.up&&grounded&&c.invuln<=0){hitCar(c);c.vx*=-.10;c.vz*=-.10;}
  }
  c.steer=input.steer;c.gas=input.gas;c.brake=input.brake;
  if(c.spin>0){c.angle+=dt*8.3;c.vx*=Math.exp(-1.4*dt);c.vz*=Math.exp(-1.4*dt);}else if(c.stun<=0){const turn=st.turn*(.22+.78*clamp(speed/9,0,1))*(grounded?1:.34);c.angle+=input.steer*turn*dt*(input.brake>.25?1.14:1);const fx0=Math.cos(c.angle),fz0=Math.sin(c.angle);let longitudinal=c.vx*fx0+c.vz*fz0;let lateral=c.vx*-fz0+c.vz*fx0;
   longitudinal+=(input.gas*(c.boost>0?st.accel*1.7:st.accel)-(input.gas>.1?1.6:5.3)-input.brake*21)*dt;const top=(st.max+(c.boost>0?7.3:0))*(c.water?.57:1);longitudinal=clamp(longitudinal,0,Math.max(top,longitudinal-(c.water?20:12)*dt));if(longitudinal>top)longitudinal=Math.max(top,longitudinal-10*dt);lateral*=Math.exp(-st.grip*(input.brake>.2?.65:1)*(grounded?1:.2)*dt);c.vx=fx0*longitudinal-fz0*lateral;c.vz=fz0*longitudinal+fx0*lateral;
  }else{c.vx*=Math.exp(-3.5*dt);c.vz*=Math.exp(-3.5*dt);}
  c.angle=angleDiff(c.angle,0);c.x+=c.vx*dt;c.z+=c.vz*dt;if(c.y>0||c.vy>0){c.vy-=13.5*dt;c.y+=c.vy*dt;if(c.y<=0){c.y=0;c.vy=0;createFx(c.x,.18,c.z,'#e4d3ac',5,1.6);}}
  let proj=project(c.x,c.z,c.proj?c.proj.i:-1);const limit=track.hw-.62;if(Math.abs(proj.lane)>limit){const side=Math.sign(proj.lane),nx=-proj.tz*side,nz=proj.tx*side,out=c.vx*nx+c.vz*nz;c.x=proj.x+nx*limit;c.z=proj.z+nz*limit;if(out>0){const hit=out>3.3;c.vx-=nx*out*1.10;c.vz-=nz*out*1.10;if(hit&&c.hitCool<=0){burstCar(c);c.vx*=c.shield>0?.94:.73;c.vz*=c.shield>0?.94:.73;if(c.id===0&&raceTime>8)notify('EASE OFF THE GAS IN TURNS.',.85);}}proj=project(c.x,c.z,proj.i);}
  let delta=proj.s-c.lastS;if(delta>track.length/2)delta-=track.length;if(delta<-track.length/2)delta+=track.length;if(Math.abs(delta)<4){c.progress+=delta;c.lastS=proj.s;}c.proj=proj;c.speed=Math.hypot(c.vx,c.vz);c.stuck=c.speed<1.0&&input.gas>.4&&c.stun<=0?c.stuck+dt:0;if(c.stuck>3.2)resetCar(c);
  const lap=Math.max(0,Math.floor(c.progress/track.length));if(lap>c.lap){c.laps.push(raceTime-c.lapStart);c.lapStart=raceTime;c.lap=lap;if(c.id===0&&lap<3){notify(lap===2?'FINAL LAP!':'LAP 2 · KEEP IT UP!',2.0);sound.play('alert');}if(lap>=3&&c.finishTime===null){c.finishTime=raceTime;c.rank=finishOrder.length+1;finishOrder.push(c.id);if(c.id===0){raceEnded=true;resultsDelay=1.55;notify(c.rank<=3?'FINISH! QUALIFIED.':'FINISH! ONE MORE TRY.',1.7);sound.play('win');}}}
  if(input.fire)fire(c);if(c.id===0){if(input.swap){c.weapon=c.weapon==='rocket'?'bomb':'rocket';sound.tone(450,.05,'square',.05);}if(input.reset)resetCar(c,true);if(c.progress>4&&c.speed>3&&Math.cos(angleDiff(c.angle,sample(proj.s).angle))<-.4&&noticeTime<=0)notify('WRONG WAY · TURN AROUND',1.2);}
  c.driftTimer+=dt;if(grounded&&c.speed>7&&(Math.abs(input.steer)>.48||c.spin>0)&&c.driftTimer>.075){c.driftTimer=0;skid(c);}
 }
 function skid(c){if(lowDetail()&&Math.random()>.5)return;let m;if(skids.length>=100){m=skids.shift().mesh;}else{m=new THREE.Mesh(geometries.box,mat('#43595f'));rcScene.add(m);}m.position.set(c.x,.078,c.z);m.rotation.y=-c.angle;m.scale.set(.48,.006,1.1);skids.push({mesh:m});if(Math.random()<.20)createFx(c.x,.15,c.z,'#c9c8a9',1,.5);}
 function collideCars(){for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){const a=cars[i],b=cars[j];if(Math.abs(a.y-b.y)>.75||a.finishTime!==null||b.finishTime!==null)continue;let dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1.65&&len>.001){dx/=len;dz/=len;const push=(1.65-len)*.51;a.x-=dx*push;a.z-=dz*push;b.x+=dx*push;b.z+=dz*push;const rel=(a.vx-b.vx)*dx+(a.vz-b.vz)*dz;if(rel>0){a.vx-=dx*rel*.58;a.vz-=dz*rel*.58;b.vx+=dx*rel*.58;b.vz+=dz*rel*.58;if(rel>5){createFx((a.x+b.x)/2,.5,(a.z+b.z)/2,'#edd4a9',4,2);if(a.id===0||b.id===0)sound.play('guard');}}}}}
 function collect(c,item){if(!item.ready||c.finishTime!==null)return;if(c.id!==0&&item.type!=='shield')return;item.ready=false;item.mesh.visible=item.ring.visible=false;item.respawn=['ammo','shield'].includes(item.type)?11:-1;const style=ITEM_STYLE[item.type];if(item.type==='ammo')c.ammo=Math.min(18,c.ammo+3);else if(item.type==='shield')c.shield=7;else if(item.type==='letter'){c.letters|=1<<item.letter;if(c.letters===63){notify('RUCKUS! BUGGY UNLOCKED.',3);sound.play('win');createFx(c.x,1,c.z,'#dbf584',28,4);}else{notify('LETTER '+LETTERS[item.letter]+' · '+popcount(c.letters)+' / 6',1.5);sound.play('coin');}}else{c.upgrades[item.type]=Math.min(3,c.upgrades[item.type]+1);}if(c.id===0&&item.type!=='letter'){notify(style[2],1.4);sound.play('buy');}createFx(item.x,.8,item.z,style[1],8,1.5);}
 function updateItems(dt){for(const item of items){if(item.ready){item.mesh.position.y=1.02+Math.sin(clock*3+item.idx)*.15;item.mesh.rotation.y=clock*1.15;for(const c of cars){if(c.y<1.4&&Math.hypot(c.x-item.x,c.z-item.z)<1.38){collect(c,item);break;}}}else if(item.respawn>0){item.respawn-=dt;if(item.respawn<=0){item.ready=true;item.mesh.visible=item.ring.visible=true;}}}}
 function updateShots(dt){for(let i=shots.length-1;i>=0;i--){const p=shots[i];p.age+=dt;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.mesh.position.x=p.x;p.mesh.position.z=p.z;if(p.kind==='rocket'){const wall=project(p.x,p.z,p.pi??-1);p.pi=wall.i;if(wall.d>track.hw+.2)p.life=0;}else{p.mesh.rotation.y+=dt*.8;p.mesh.children[1].visible=Math.floor(p.age*9)%2===0;}
   if(p.age>(p.kind==='bomb'?.50:.055))for(const c of cars){if(c===p.owner&&p.age<1.1||c.finishTime!==null||c.invuln>0||c.y>.85)continue;const dist=Math.hypot(c.x-p.x,c.z-p.z);if(dist<(p.kind==='bomb'?1.48:1.15)){hitCar(c,p.owner);p.life=0;break;}}
   if(p.life<=0){createFx(p.x,.5,p.z,'#f9bb78',8,3.5);rcScene.remove(p.mesh);shots.splice(i,1);}}
 }
 function syncCar(c,dt){c.root.position.set(c.x,.06+c.y,c.z);c.root.rotation.y=-c.angle;c.body.rotation.z=mix(c.body.rotation.z,clamp((c.gas-.2)*.025-(c.brake*.06)+(c.vy>0?-.08:0),-.10,.10),.15);c.body.rotation.x=mix(c.body.rotation.x,-c.steer*Math.min(c.speed/18,1)*.095,.12);c.body.position.y=Math.sin(clock*34+c.id)*.009*Math.min(c.speed,10);for(const t of c.tires){t.g.rotation.y=t.x>0?-.27*c.steer:0;t.g.rotation.z-=c.speed*dt*2.6;}c.cage.visible=c.shield>0&&(c.shield>1.5||Math.floor(clock*9)%2===0);c.buggy.visible=c.letters===63;c.shadow.position.set(c.x,.075,c.z);c.shadow.rotation.z=c.angle;c.shadow.scale.setScalar(clamp(1-c.y*.17,.5,1));c.glow.position.set(c.x,.088,c.z);c.root.visible=c.invuln<=0||c.shield>0||Math.floor(clock*20)%3!==0;c.glow.visible=c.id===0;}
 function step(dt){raceTime+=dt;for(const h of hazards){if(h.kind==='gate'){h.up=Math.sin(raceTime*1.8+h.phase)>.18;h.gate.position.y=mix(h.gate.position.y,h.up?.45:-.35,.10);}}const human=controlInput();for(const c of cars){if(c.finishTime!==null){c.vx*=Math.exp(-1.0*dt);c.vz*=Math.exp(-1.0*dt);c.x+=c.vx*dt;c.z+=c.vz*dt;c.speed=Math.hypot(c.vx,c.vz);const p=project(c.x,c.z,c.proj?c.proj.i:-1);c.proj=p;if(Math.abs(p.lane)>track.hw-.7){c.x=p.x-p.tz*clamp(p.lane,-track.hw+.7,track.hw-.7);c.z=p.z+p.tx*clamp(p.lane,-track.hw+.7,track.hw-.7);c.vx*=.5;c.vz*=.5;}continue;}const input=c.id===0?human:ai(c,dt);stepCar(c,input,dt);}edge.clear();collideCars();updateItems(dt);updateShots(dt);
  if(raceTime>180&&cars[0].finishTime===null){raceEnded=true;resultsDelay=.15;cars[0].finishTime=180;cars[0].rank=4;}
  if(raceEnded){resultsDelay-=dt;if(resultsDelay<=0){finishHeat();return;}}
 }
 function order(){return [...cars].sort((a,b)=>{if(a.finishTime!==null&&b.finishTime!==null)return a.finishTime-b.finishTime;if(a.finishTime!==null)return -1;if(b.finishTime!==null)return 1;return b.progress-a.progress;});}
 function resolveRivals(){
  // Finish the rivals off-screen so the result table uses real finish times,
  // not a guessed order based on their position when Nico crosses the line.
  const savedTime=raceTime;let ticks=0;
  while(cars.some(c=>c.id!==0&&c.finishTime===null)&&ticks<7200){const dt=1/60;raceTime+=dt;for(const h of hazards)if(h.kind==='gate')h.up=Math.sin(raceTime*1.8+h.phase)>.18;for(const c of cars)if(c.id!==0&&c.finishTime===null)stepCar(c,ai(c,dt),dt);collideCars();updateItems(dt);updateShots(dt);ticks++;}
  raceTime=savedTime;
 }
 function finishHeat(){if(state!=='rcRace')return;resolveRivals();state='rcResult';engineLevel(0);clearControls();show('rcCountdown',false);show('rcNotice',false);const list=order(),p=cars[0],place=p.rank||list.findIndex(c=>c.id===0)+1,qualify=place<=3;finishedResult={place,qualify,time:p.finishTime,bestLap:p.laps.length?Math.min(...p.laps):Infinity,heat:cup.heat,order:list.map(c=>c.id)};if(qualify){cup.upgrades=clone(p.upgrades);cup.letters=p.letters;cup.ammo=p.ammo;cup.history.push(clone(finishedResult));for(let i=0;i<4;i++)cup.points[list[i].id]+=POINTS[i];cup.tokens=Math.min(cup.tokens+1,3);const rec=recordCache[cup.heat];if(!rec||p.finishTime<rec){recordCache[cup.heat]=p.finishTime;writeStore(RECORD_RC,recordCache);}}show('rcResult');$('rcResultKicker').textContent='HEAT '+String(cup.heat+1).padStart(2,'0')+' / '+track.def.name;$('rcResultTitle').textContent=qualify?place===1?'FIRST TO THE FRIES.':'STILL IN THE RACE.':'ONE MORE TRY.';$('rcResultSub').textContent=qualify?'Top three secured. Your parts, ammo, and letters carry on.':'Fourth place. Retry this heat with your saved garage setup.';$('rcResultRank').textContent=place;$('rcResultRows').innerHTML=list.map((c,i)=>`<tr class="${c.id===0?'you':''}"><td>${i+1}</td><td><i class="rc-car-dot" style="--car:${COLORS[c.id]}"></i>${c.name}${c.id===0?' / YOU':''}</td><td>${c.finishTime!==null?raceFmt(c.finishTime):'DNF'}</td><td>${cup.points[c.id]}${qualify?' (+'+POINTS[i]+')':''}</td></tr>`).join('');$('rcResultTime').textContent=raceFmt(p.finishTime);$('rcResultLap').textContent=raceFmt(finishedResult.bestLap);$('rcResultLetters').textContent=popcount(p.letters)+' / 6';$('rcResultBonus').innerHTML=qualify?'GARAGE BONUS<b>+1 TOKEN</b>':'RETRY<b>NO LIMIT</b>';show('rcNextHeat',qualify);show('rcReplayHeat',!qualify);$('rcNextHeat').innerHTML=cup.heat===2?'CUP RESULTS <span class="arr">→</span>':'NEXT GARAGE <span class="arr">→</span>';$('rcResultNote').textContent=qualify?'Record for this track: '+raceFmt(recordCache[cup.heat])+' · Progress saved.':'Retries do not cost lunch money. Ease off the gas before a tight turn.';
  if(qualify){if(cup.heat===2)cup.completed=true;else cup.heat++;saveCup();}else {cup=clone(startSnapshot);saveCup();}
  if(qualify&&place===1)input.rumble(.4,240);focusMenu($('rcResult'));
 }
 function next(){if(state!=='rcResult')return;if(cup.completed)showCup();else garage();}
 function showCup(){state='rcCup';hideRaceLayers();show('rcResult');engineLevel(0);const final=cup.history[cup.history.length-1],ids=[0,1,2,3].sort((a,b)=>cup.points[b]-cup.points[a]||((final?.order||[0,1,2,3]).indexOf(a)-(final?.order||[0,1,2,3]).indexOf(b))),rank=ids.indexOf(0)+1,total=cup.history.reduce((n,h)=>n+h.time,0),best=Math.min(...cup.history.map(h=>h.bestLap||Infinity));$('rcResultKicker').textContent='RIVERBLOCK RUCKUS / BOTH CHAPTERS COMPLETE';$('rcResultTitle').textContent=rank===1?'THE CUP IS OURS!':'SMALL CARS. BIG FINISH.';$('rcResultSub').textContent=cup.letters===63?'Six letters. One new buggy. Nico and the crew head home with the cup run complete.':'The lunch money is safe. The three-race cup is complete. The crew earned a break.';if(!cup.story){$('rcResultKicker').textContent='PARKING LOT PRO-AM / CUP COMPLETE';$('rcResultSub').textContent='Three tracks. Nine laps. The Riverblock crew has a new story to tell.';}$('rcResultRank').textContent=rank;$('rcResultRows').innerHTML=ids.map((id,i)=>`<tr class="${id===0?'you':''}"><td>${i+1}</td><td><i class="rc-car-dot" style="--car:${COLORS[id]}"></i>${NAMES[id]}${id===0?' / YOU':''}</td><td>${id===0?'3 HEATS CLEAR':'RIVAL'}</td><td>${cup.points[id]}</td></tr>`).join('');$('rcResultTime').textContent=raceFmt(total);$('rcResultLap').textContent=raceFmt(best);$('rcResultLetters').textContent=popcount(cup.letters)+' / 6';$('rcResultBonus').innerHTML=cup.letters===63?'CAR CLASS<b>BUGGY</b>':'CAR CLASS<b>RC PICKUP</b>';show('rcNextHeat');show('rcReplayHeat',false);$('rcNextHeat').innerHTML='RACE A NEW CUP <span class="arr">↻</span>';$('rcResultNote').textContent=cup.street?'Street clear: '+formatTime(cup.street.time)+' · '+cup.street.kills+' knockouts · '+cup.street.bestCombo+' best combo.':'Original tracks, vehicles, characters, and sound. A small-car tribute to the NES racer.';sound.play('win');saveCup();focusMenu($('rcResult'));}
 function resizeRC(){if(!rcCamera)return;const a=W/H,span=a<.8?56:a<1.3?42:34;rcCamera.left=-span*a/2;rcCamera.right=span*a/2;rcCamera.top=span/2;rcCamera.bottom=-span/2;rcCamera.updateProjectionMatrix();}
 function updateCamera(dt,snap=false){if(!rcCamera||!cars[0])return;const p=cars[0],spectator=state==='rcBrief'||state==='rcCup',look=clamp(p.speed*.27,0,5.4);let x=p.x+Math.cos(p.angle)*look,z=p.z+Math.sin(p.angle)*look;if(spectator){const q=sample(-3);x=q.x;z=q.z-3;}const t=snap?1:1-Math.exp(-dt*4.2);cam.x=mix(cam.x,x,t);cam.z=mix(cam.z,z,t);rcShake=Math.max(0,rcShake-dt);const shakeAmt=prefs.shake?rcShake:0;rcCamera.position.set(cam.x+23+random(-shakeAmt,shakeAmt),34,cam.z+30+random(-shakeAmt,shakeAmt));rcCamera.lookAt(cam.x,0,cam.z);rcCamera.updateMatrixWorld();rcSun.position.set(cam.x-22,42,cam.z+23);rcSun.target.position.set(cam.x,0,cam.z);rcSun.target.updateMatrixWorld();}
 function drawMap(canvas,live=false,large=false){if(!track)return;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=large?28:18,dx=track.maxX-track.minX+track.def.width,dz=track.maxZ-track.minZ+track.def.width,scale=Math.min((w-pad*2)/dx,(h-pad*2)/dz),cx=(track.maxX+track.minX)/2,cz=(track.maxZ+track.minZ)/2,px=x=>w/2+(x-cx)*scale,pz=z=>h/2+(z-cz)*scale;c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';c.beginPath();for(let i=0;i<track.segs.length;i++){const p=track.segs[i];if(!i)c.moveTo(px(p.x),pz(p.z));else c.lineTo(px(p.x),pz(p.z));}c.closePath();c.lineWidth=track.def.width*scale+3;c.strokeStyle='#93ad93';c.stroke();c.lineWidth=track.def.width*scale-1;c.strokeStyle='#557777';c.stroke();if(large){for(const h0 of hazards){c.fillStyle=h0.kind==='boost'?'#deef89':h0.kind==='oil'?'#253e4b':h0.kind==='water'?'#83ced3':'#efa86d';c.beginPath();c.arc(px(h0.x),pz(h0.z),h0.kind==='water'?5:4,0,TAU);c.fill();}for(const it of items){if(it.type!=='letter')continue;c.fillStyle='#fff3b7';c.font='bold 13px Courier New';c.textAlign='center';c.fillText(LETTERS[it.letter],px(it.x),pz(it.z)-4);}}
  const s=sample(0),nx=-s.tz*track.hw,nz=s.tx*track.hw;c.strokeStyle='#fff0d1';c.lineWidth=3;c.beginPath();c.moveTo(px(s.x+nx),pz(s.z+nz));c.lineTo(px(s.x-nx),pz(s.z-nz));c.stroke();const arr=sample(12);c.fillStyle='#dfee9a';c.save();c.translate(px(arr.x),pz(arr.z));c.rotate(arr.angle);c.beginPath();c.moveTo(7,0);c.lineTo(-4,-4);c.lineTo(-4,4);c.closePath();c.fill();c.restore();
  if(live){for(const car of [...cars].reverse()){c.fillStyle=COLORS[car.id];c.strokeStyle='#162f37';c.lineWidth=2;c.beginPath();c.arc(px(car.x),pz(car.z),car.id===0?5.7:4.5,0,TAU);c.fill();c.stroke();if(car.id===0){c.strokeStyle='#ffedce';c.lineWidth=1.7;c.beginPath();c.arc(px(car.x),pz(car.z),7.7,0,TAU);c.stroke();}}}else{c.fillStyle='#ed805f';c.beginPath();c.arc(px(s.x),pz(s.z),5,0,TAU);c.fill();}}
 function updateHud(){if(!cars[0])return;const p=cars[0],o=order(),rank=p.rank||o.findIndex(c=>c.id===0)+1,lap=clamp(Math.floor(Math.max(0,p.progress)/track.length)+1,1,3);$('rcPosition').innerHTML=rank+'<sup>'+['ST','ND','RD','TH'][rank-1]+'</sup>';$('rcHeat').textContent='PARKING LOT CUP / '+String((finishedResult?.heat??cup.heat)+1).padStart(2,'0');$('rcTrackName').textContent=track.def.name;$('rcLap').textContent='LAP '+lap+' / 3';$('rcMapLap').textContent='0'+lap+' / 03';$('rcTime').textContent=raceFmt(raceTime);$('rcSpeed').textContent=String(Math.round(p.speed*4.1)).padStart(2,'0');$('rcSpeedBar').style.width=Math.min(100,p.speed/(stats(p).max+7)*100)+'%';$('rcBoostText').textContent=p.spin>0?'SPIN!':p.boost>0?'ZIP!':p.shield>0?'CAGE':p.water?'WATER':p.y>.4?'AIR':p.speed>3?'GO!':'GAS';$('rcWeapon').innerHTML=p.weapon.toUpperCase()+' <b>× '+p.ammo+'</b>';$('rcCage').textContent=p.shield>0?'CAGE '+Math.ceil(p.shield)+'s':keyName('swap')+' / SWAP';$('rcCarClass').textContent=p.letters===63?'RED BUGGY · LUNCH CREW':'RED PICKUP · LUNCH CREW';$('rcLapDots').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i<lap));$('rcLetters').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',!!(p.letters&(1<<i))));drawMap($('rcMap'),true);}
 let engineOsc=null,engineGain=null,engineFilter=null;
 function engineLevel(level){if(!sound.ctx)return;if(!engineOsc&&level>0){engineOsc=sound.ctx.createOscillator();engineGain=sound.ctx.createGain();engineFilter=sound.ctx.createBiquadFilter();engineOsc.type='sawtooth';engineFilter.type='lowpass';engineFilter.frequency.value=620;engineGain.gain.value=0;engineOsc.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(sound.master);engineOsc.start();}if(engineOsc){const p=cars[0];engineOsc.frequency.setTargetAtTime(68+(p?.speed||0)*11,sound.ctx.currentTime,.08);engineGain.gain.setTargetAtTime(level*.022,sound.ctx.currentTime,.06);}}
 function raceNote(s,t){const root=[45,48,50,43][Math.floor(s/32)%4],n=[0,12,7,10,12,7,15,7,0,12,7,10,17,15,12,7][Math.floor(s/2)%16],hz=k=>440*Math.pow(2,(k-69)/12);if(s%2===0)sound.tone(hz(root+24+n),.10,'square',.10,t,sound.music);if(s%4===0)sound.tone(hz(root+(s%8?7:0)),.19,'triangle',.40,t,sound.music);if(s%8===0||s%8===6)sound.tone(100,.11,'sine',.68,t,sound.music,38);if(s%8===4)sound.noise(.09,.26,t,sound.music,2300);if(s%2)sound.noise(.026,.095,t,sound.music,7000);}
 function animateScene(dt){for(const c of cars)syncCar(c,dt);for(const item of items)if(item.ready){item.mesh.position.y=1.02+Math.sin(clock*3+item.idx)*.15;item.mesh.rotation.y=clock*1.15;}for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;f.mesh.position.x+=f.vx*dt;f.mesh.position.y+=f.vy*dt;f.mesh.position.z+=f.vz*dt;f.vy-=10*dt;f.mesh.rotation.z+=dt*5;if(f.life<=0){rcScene.remove(f.mesh);fx.splice(i,1);}}for(let i=0;i<crowd.length;i++){const a=crowd[i];a.torso.position.y=.95+Math.sin(clock*3+i)*.014;a.head.rotation.x=Math.sin(clock*2+i)*.03;a.armL.rotation.x=-1.40+Math.sin(clock*4+i)*.025;a.armR.rotation.x=-1.4;} }
 function frame(dt){clock+=dt;ctx.clearRect(0,0,W,H);if(state==='rcComic'){engineLevel(0);return;}if(!rcBuilt)return;
  if(state==='rcRace'){if(input.pressed('swap'))edge.add('swap');if(input.pressed('reset'))edge.add('reset');}
  if(state==='rcRace'){if(countdown>0){countdown-=dt;const count=Math.ceil(countdown);if(count!==lastCount&&count>0&&count<4){lastCount=count;sound.tone(440,.12,'square',.12);}$('rcCountdown').innerHTML=(count>3?'READY':Math.max(count,1))+'<small>HOLD GAS · LEFT / RIGHT TO STEER</small>';if(countdown<=0){countdown=0;goTime=.75;$('rcCountdown').innerHTML='GO!';sound.tone(880,.28,'square',.13);}}else{if(goTime>0){goTime-=dt;if(goTime<=0)show('rcCountdown',false);}rcAccum+=dt;let n=0;while(rcAccum>=1/120&&n<6&&state==='rcRace'){step(1/120);rcAccum-=1/120;n++;}}if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)show('rcNotice',false);}animateScene(dt);engineLevel(countdown<=0?1:0);}else{rcAccum=0;engineLevel(0);if(state==='rcBrief'||state==='rcCup')animateScene(dt);}
  updateCamera(dt);postRC.render();uiTime+=dt;if(uiTime>.06){if(state==='rcRace')updateHud();uiTime=0;}
 }
 $('rcComicNext').onclick=finishComic;$('rcComicArt').onclick=finishComic;$('rcStartRace').onclick=startRace;$('rcPauseButton').onclick=pause;$('rcResume').onclick=pause;$('rcRestart').onclick=restart;$('rcReplayHeat').onclick=restart;$('rcBriefExit').onclick=exit;$('rcResultExit').onclick=exit;$('rcPauseExit').onclick=exit;$('rcNextHeat').onclick=cupButton;$('rcMute').onclick=()=>{sound.init();sound.toggle();updateSettings();};$('rcSoundSetting').onclick=$('rcMute').onclick;$('rcFull').onclick=requestFull;$('rcKitSettings').onclick=()=>kit.menu.open();
 $('rcAutoBrief').onclick=()=>{prefs.rcAuto=!prefs.rcAuto;savePrefs();updateGarage();};$('rcAuto').onclick=()=>{prefs.rcAuto=!prefs.rcAuto;savePrefs();updateSettings();};$('rcShake').onclick=()=>{prefs.shake=!prefs.shake;savePrefs();updateSettings();};document.querySelectorAll('[data-tune]').forEach(b=>b.onclick=()=>tune(b.dataset.tune));
 const titleLinks=document.createElement('div');titleLinks.className='rc-title-link';titleLinks.innerHTML='<button id="rcQuickBtn">CHAPTER 02 / PLAY THE RACES →</button><button id="rcContinueBtn" class="hidden">CONTINUE RACING</button><button id="rumbleBtn">RECESS RUMBLE / SURVIVAL →</button>';document.querySelector('.title-body').appendChild(titleLinks);$('rcQuickBtn').onclick=()=>start(false,false);$('rcContinueBtn').onclick=()=>start(false,true);refreshTitle();
 function onResize(){resizeRC();if(state==='rcBrief')drawMap($('rcPreviewMap'),false,true);}
 function cupButton(){if(state==='rcCup'){cup=newCup(false);garage();}else next();}
 return {get active(){return isActive();},start,frame,onResize,raceNote,pause,finishComic,startRace,exit,cupButton,syncSettings:updateSettings,preloadComic(){const i=new Image();i.src=COMIC_URL;},get status(){return {state,heat:cup?.heat,track:track?.def.name,countdown,raceTime,points:cup?.points,letters:cup?.letters,completed:cup?.completed,cars:cars.map(c=>({id:c.id,x:c.x,z:c.z,angle:c.angle,speed:c.speed,progress:c.progress,lap:c.lap,ammo:c.ammo,shield:c.shield,boost:c.boost,spin:c.spin,weapon:c.weapon,upgrades:c.upgrades,letters:c.letters,y:c.y,finish:c.finishTime,rank:c.rank})),trackLength:track?.length,items:items.map(i=>({type:i.type,ready:i.ready,letter:i.letter})),projectiles:shots.length,drawCalls:renderer.info.render.calls,quality:kit.tier.name};}};
})();

// ---------- Main loop ----------
function update(dt){elapsed+=dt;worldTime+=dt;nextEnemyAttack=Math.max(0,nextEnemyAttack-dt);updateHero(dt);if(state!=='play'){pressed.clear();return;}for(const e of enemies)updateEnemy(e,dt);updateWeapons(dt);updateCoins(dt);updateEffects(dt);checkProgress(dt);comboTimer-=dt;if(comboTimer<=0){combo=0;$('combo').classList.add('hidden');}
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.dead&&e.deathT>3.5){removeActor(e);enemies.splice(i,1);}}
 if(hero.dead){deathTimer-=dt;if(deathTimer<=0){if(mode==='rumble')endRumble();else{state='gameover';$('gameover').classList.remove('hidden');resetInput();focusMenu($('gameover'));}}}
 pressed.clear();
}
function placeCamera(realDt){const narrow=W/H<1.1;let target=state==='title'?7.4:clamp(hero.x+(narrow?1.0:3.5),narrow?2.5:5.3,narrow?91:85.0);camX=mix(camX,target,1-Math.exp(-realDt*(state==='title'?.8:4.2)));shake=Math.max(0,shake-realDt*.75);let sx=0,sy=0;if(prefs.shake&&shake>0){sx=(Math.random()-.5)*shake*2;sy=(Math.random()-.5)*shake;}
 camera.position.set(camX+1.4+sx,17.2+sy,24);camera.lookAt(camX+sx,2.2,-1.3);camera.updateMatrixWorld();sun.position.set(camX-12,25,13);sun.target.position.set(camX,0,0);sun.target.updateMatrixWorld();}
let accum=0;
function frame(dt){const realDt=Math.min(dt,.05);
 globalInput(realDt);syncTouch();
 if(Racing.active){Racing.frame(realDt);return;}
 if(state==='play'){if(hitStop>0){hitStop=Math.max(0,hitStop-realDt);accum=0;}else{accum+=realDt;let steps=0;while(accum>=1/60&&steps<4&&state==='play'){update(1/60);accum-=1/60;steps++;}}}
 else{accum=0;pressed.clear();if(state==='title'||state==='win'){worldTime+=realDt;if(state==='title'){hero.walkSpeed=0;for(const e of enemies)e.walkSpeed=0;}}}
 if(state==='play'||state==='title'){if(toastTimer>0){toastTimer-=realDt;if(toastTimer<=0)$('toast').classList.add('hidden');}if(bannerTimer>0){bannerTimer-=realDt;if(bannerTimer<=0)$('banner').classList.add('hidden');}}
 placeCamera(realDt);
 const animDt=(state==='play'||state==='title'||state==='win')?realDt:0;animateActor(hero,animDt);for(const e of enemies)animateActor(e,animDt);syncHeldWeapon();if(winStarted||state==='win'){animateActor(friend,animDt);friend.root.visible=true;friend.shadow.visible=true;friend.armL.rotation.z=-1.6+Math.sin(worldTime*6)*.3;friend.armR.rotation.z=1.5;}
 post.render();drawLabels();uiClock+=realDt;if(uiClock>.1){updateHUD();uiClock=0;}
}
// A small, read-only status hook makes regression checks possible without a game server.
window.Riverblock={version:'3.0.0',get racing(){return Racing.status;},get status(){return {state,mode,face:hero.face,facingYaw:hero.facing.rotation.y,x:hero.x,z:hero.z,y:hero.y,hp:hero.hp,maxHp:hero.maxHp,cash:hero.money,grit:hero.grit,power:hero.power,stage:stageIndex,cleared,activeFight,kills,bestCombo,elapsed,rumble:mode==='rumble'?{wave:rumble.wave,score:rumble.score,queued:rumble.queue.length}:null,heldWeapon:hero.weapon?.type||null,enemyCount:enemies.filter(e=>!e.dead).length,enemies:enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,hp:e.hp,x:e.x,z:e.z,wind:e.wind,down:e.down})),renderer:{backend:kit.backend,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:kit.tier.name,three:THREE.REVISION}};}};
$('rumbleBtn').onclick=startRumble;
kit.touch?.button('gas')?.classList.add('is-primary');
kit.onResize(resize);sound.apply();$('modeBtn').textContent='MODE: '+(prefs.easy?'EASY':'NORMAL');$('continueBtn').classList.toggle('hidden',!readStore(STORE));refreshRumbleBest();refreshPrompts();
placeCamera(1);syncTouch();
$('title').classList.remove('hidden');
kit.start(frame);
